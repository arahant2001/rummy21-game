import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDeck, resolveJokerRoles, calculateMaal, calculateDeadwood, calculateGroupedDeadwood, getDeadwoodCards, validateShow, countDoubles, countTunellas, isWildCard, autoArrangeHandToGroups, CONFIG, DEFAULT_RULES, RULE_PRESETS, sanitizeRules, MAX_PLAYERS, MIN_NON_HAND_CARDS, shuffleCards, getMaxPlayersForRules } from './rules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

// Render health check / quick deployment sanity check
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'rummy21-game', rooms: rooms.size });
});

const rooms = new Map();
const ROOM_INACTIVITY_TIMEOUT_MS = Math.max(
  1000,
  parseInt(process.env.ROOM_INACTIVITY_TIMEOUT_MS || String(60 * 60 * 1000), 10) || (60 * 60 * 1000)
);

function clearRoomTimers(room) {
  if (!room) return;
  if (room.groupingTimer) {
    clearTimeout(room.groupingTimer);
    room.groupingTimer = null;
  }
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }
  if (room.inactivityTimer) {
    clearTimeout(room.inactivityTimer);
    room.inactivityTimer = null;
  }
}

function touchRoomActivity(room) {
  if (!room) return;
  room.lastActivityAt = Date.now();
  if (room.inactivityTimer) {
    clearTimeout(room.inactivityTimer);
    room.inactivityTimer = null;
  }
  room.inactivityTimer = setTimeout(() => {
    if (!rooms.has(room.id) || rooms.get(room.id) !== room) return;
    (room.players || []).forEach(p => {
      if (p.ws && p.ws.readyState === WebSocket.OPEN) {
        try {
          p.ws.send(JSON.stringify({
            type: 'ROOM_CLOSED',
            reason: 'inactivity_timeout',
            message: `Table "${room.id}" was closed after 1 hour of inactivity.`
          }));
        } catch (_) {}
      }
    });
    clearRoomTimers(room);
    rooms.delete(room.id);
  }, ROOM_INACTIVITY_TIMEOUT_MS);
}

function recycleDiscardIntoStock(room) {
  if (!room || !Array.isArray(room.discardPile) || room.discardPile.length <= 1) {
    return 0;
  }
  const top = room.discardPile.pop();
  const recycled = room.discardPile.map(card => {
    const clean = { ...card };
    delete clean.isInitialOpenCard;
    delete clean.discardedBy;
    delete clean.isDiscardedJoker;
    delete clean.isJoker;
    return clean;
  });
  shuffleCards(recycled);
  room.deck = recycled;
  room.discardPile = top ? [top] : [];
  return recycled.length;
}

function ensurePlayerHand(player, room, targetCount = null) {
  if (!player.hand) player.hand = [];
  const rConfig = room.rules || DEFAULT_RULES;
  const handTarget = targetCount ?? (rConfig.cardsPerPlayer || 21);
  if (!room.deck || !Array.isArray(room.deck)) room.deck = createDeck(rConfig);
  while (player.hand.length < handTarget) {
    if (room.deck.length === 0) {
      recycleDiscardIntoStock(room);
      if (room.deck.length === 0) {
        room.deck = createDeck(rConfig);
      }
    }
    const nextCard = room.deck.pop();
    if (!nextCard) break;
    player.hand.push(nextCard);
  }
  // Clamp invariant: player hand never exceeds handTarget + 1 cards
  if (player.hand.length > handTarget + 1) {
    player.hand = player.hand.slice(0, handTarget + 1);
  }
}

function getSafeRoom(room) {
  const rawTop = room.discardPile[room.discardPile.length - 1] || null;
  const isTopJoker = rawTop && room.cutCard ? isWildCard(rawTop, room.cutCard) : false;
  const rConfig = room.rules || DEFAULT_RULES;
  const topDiscard = rawTop ? {
    ...rawTop,
    isInitialOpenCard: Boolean(rawTop.isInitialOpenCard),
    isDiscardedJoker: Boolean(isTopJoker && !rawTop.isInitialOpenCard && (rConfig.blockDiscardedJokerPickup !== false))
  } : null;

  return {
    id: room.id,
    status: room.status,
    hasStarted: Boolean(room.hasStarted),
    creatorId: room.creatorId || null,
    creatorName: room.creatorName || null,
    maxPlayers: getMaxPlayersForRules(rConfig),
    rules: rConfig,
    winnerId: room.winnerId || null,
    winnerName: room.winnerName || null,
    tournamentFinished: Boolean(room.tournamentFinished),
    tournamentWinnerId: room.tournamentWinnerId || null,
    tournamentWinnerName: room.tournamentWinnerName || null,
    groupingDeadline: room.groupingDeadline || null,
    turnPlayerId: room.players[room.turnIndex]?.id || null,
    turnPlayerName: room.players[room.turnIndex]?.name || '',
    turnStage: room.turnStage,
    lastMove: room.lastMove || null,
    cutCard: room.cutCard,
    roles: room.cutCard ? resolveJokerRoles(room.cutCard) : null,
    topDiscard,
    // Return all buried discards with metadata so players can inspect full discard history
    discardHistory: room.discardPile.slice(0, Math.max(0, room.discardPile.length - 1)).map(c => ({
      ...c,
      isInitialOpenCard: Boolean(c.isInitialOpenCard),
      isJoker: room.cutCard ? isWildCard(c, room.cutCard) : false
    })),
    deckCount: room.deck.length,

    lastAction: room.lastAction || '',
    handNumber: room.handNumber || 1,
    starterIndex: room.starterIndex || 0,
    dealerId: room.dealerId || (room.players.length > 0 ? room.players[(room.starterIndex - 1 + room.players.length) % room.players.length]?.id : null),
    readyPlayers: room.players.filter(p => p.readyForNextHand).map(p => p.id),
    sessionScores: Object.values(room.sessionScores || {}).filter(sc => {
      if (!sc || !sc.name) return false;
      const isSeated = (room.players || []).some(p => (p.name || '').trim().toLowerCase() === sc.name.trim().toLowerCase());
      return sc.handsPlayed > 0 || isSeated;
    }).map(sc => ({ ...sc, playerId: sc.id })),
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      connected: Boolean(p.ws && p.ws.readyState === WebSocket.OPEN),
      hasDropped: Boolean(p.hasDropped),
      hasForfeited: Boolean(p.hasForfeited),
      isEliminated: Boolean(p.isEliminated),
      dropType: p.dropType || (p.hasForfeited ? 'FORFEIT' : p.hasDropped ? (p.turnsTaken === 0 ? 'FIRST_DROP' : 'MIDDLE_DROP') : null),
      dropPenalty: p.dropPenalty || 0,
      turnsTaken: p.turnsTaken || 0,
      isGrouped: Boolean(p.isGrouped),
      readyForNextHand: Boolean(p.readyForNextHand)
    }))
  };
}

function broadcastRoom(room) {
  const safeState = getSafeRoom(room);
  room.players.forEach(p => {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify({
        type: 'SYNC',
        room: safeState,
        yourHand: p.hand,
        yourMaal: room.cutCard ? calculateMaal(p.hand, room.cutCard, room.rules || DEFAULT_RULES) : null
      }));
    }
  });
}

function finalizeRound(userRoom) {
  if (!userRoom || userRoom.status === 'ROUND_OVER') return;
  if (userRoom.groupingTimer) {
    clearTimeout(userRoom.groupingTimer);
    userRoom.groupingTimer = null;
  }
  userRoom.status = 'ROUND_OVER';
  userRoom.turnStage = 'WAITING';

  const rConfig = userRoom.rules || DEFAULT_RULES;
  const winner = userRoom.players.find(p => p.id === userRoom.winnerId) || userRoom.players[0];
  const winnerMaal = calculateMaal(winner.hand, userRoom.cutCard, rConfig);

  userRoom.sessionScores = userRoom.sessionScores || {};
  // Paying losers: only active participants in this hand (excluding already-eliminated spectators, winner, and Free Scoots)
  const handParticipants = userRoom.players.filter(pl => !pl.isEliminated || pl._inCurrentHand);
  const payingLosersCount = handParticipants.filter(pl => pl.id !== winner.id && !pl.isFreeScoot && pl.dropType !== 'FREE_SCOOT').length;

  const results = userRoom.players.map(p => {
    // Ensure player session entry exists keyed by normalized player name
    const scoreKey = (p.name || '').trim().toLowerCase();
    if (!userRoom.sessionScores[scoreKey]) {
      userRoom.sessionScores[scoreKey] = {
        id: p.id,
        name: p.name,
        handsPlayed: 0,
        handsWon: 0,
        points: 0,
        honors: 0,
        maal: 0,
        totalScore: 0,
        isEliminated: Boolean(p.isEliminated),
        eliminatedInHand: null
      };
    }
    const sc = userRoom.sessionScores[scoreKey];
    sc.name = p.name;
    sc.id = p.id;
    p.readyForNextHand = false;

    // Players eliminated in earlier tournament hands were not dealt cards and do not owe or play
    if (p.isEliminated && !p._inCurrentHand) {
      return {
        name: p.name,
        status: 'ELIMINATED',
        points: 0,
        net: `Eliminated earlier (${sc.points} pts > ${rConfig.scoreLimit} limit — spectating)`
      };
    }

    const alreadySettled = Boolean(p._settledInRound);
    if (!alreadySettled) {
      sc.handsPlayed += 1;
      p._settledInRound = true;
    }

    if (p.id === winner.id) {
      if (!alreadySettled) {
        sc.handsWon += 1;
        const netMaal = payingLosersCount * winnerMaal.total;
        sc.maal += netMaal;
        sc.honors = sc.maal;
        sc.totalScore += netMaal;
      }
      const netMaalDisplay = payingLosersCount * winnerMaal.total;
      return {
        name: p.name,
        status: 'WINNER',
        points: 0,
        maalCollected: netMaalDisplay,
        honorsCollected: netMaalDisplay,
        net: payingLosersCount > 0
          ? `Won + collects ${winnerMaal.total} Honors from each paying loser (+${netMaalDisplay} pts)`
          : `Won (all opponents Free Scooted, 0 Honors collected)`
      };
    }
    if (p.hasDropped) {
      if (p.isFreeScoot || p.dropType === 'FREE_SCOOT') {
        if (!alreadySettled) {
          sc.honors = sc.maal;
        }
        return {
          name: p.name,
          status: 'DROPPED',
          points: 0,
          dropPenalty: 0,
          maalOwed: 0,
          honorsOwed: 0,
          net: 'Free Scoot / Free Game (0 pts & 0 Honors owed)'
        };
      }
      const defaultDropPts = p.dropType === 'MIDDLE_DROP' ? (rConfig.middleDrop ?? 70) : (rConfig.firstDrop ?? 30);
      const drop = p.dropPenalty || (p.hasForfeited ? (rConfig.forfeitPenalty ?? 100) : defaultDropPts);
      const totalPay = drop + winnerMaal.total;
      if (!alreadySettled) {
        sc.points += drop;
        sc.maal -= winnerMaal.total;
        sc.honors = sc.maal;
        sc.totalScore -= totalPay;
      }
      return {
        name: p.name,
        status: p.hasForfeited ? 'FORFEITED' : 'DROPPED',
        points: totalPay,
        dropPenalty: drop,
        maalOwed: winnerMaal.total,
        honorsOwed: winnerMaal.total,
        net: `Pays ${totalPay} pts (${drop} ${p.hasForfeited ? 'forfeit' : 'drop'} + ${winnerMaal.total} winner Honors)`
      };
    }

    // Only auto-arrange on timeout if the player never submitted groups during GROUPING
    if (!p.isGrouped && !p.hasDropped && (!Array.isArray(p.declaredGroups) || p.declaredGroups.length === 0)) {
      p.declaredGroups = autoArrangeHandToGroups(p.hand, userRoom.cutCard, rConfig);
    }

    const deadwood = calculateGroupedDeadwood(p.declaredGroups, p.hand, userRoom.cutCard, rConfig);
    const totalPay = deadwood + winnerMaal.total;
    if (!alreadySettled) {
      sc.points += deadwood;
      sc.maal -= winnerMaal.total;
      sc.honors = sc.maal;
      sc.totalScore -= totalPay;
    }
    return {
      name: p.name,
      status: 'LOST',
      deadwood,
      maalOwed: winnerMaal.total,
      honorsOwed: winnerMaal.total,
      net: `Pays ${totalPay} pts (${deadwood} deadwood + ${winnerMaal.total} winner Honors)`
    };
  });

  // Tournament Elimination Check: cumulative penalty points (excluding Honors) strictly exceeding scoreLimit
  const newlyEliminated = [];
  if (rConfig.eliminationEnabled) {
    userRoom.players.forEach(p => {
      if (p.hasLeft || p.isEliminated) return;
      const scoreKey = (p.name || '').trim().toLowerCase();
      const sc = userRoom.sessionScores[scoreKey];
      if (sc && sc.points > rConfig.scoreLimit) {
        p.isEliminated = true;
        sc.isEliminated = true;
        sc.eliminatedInHand = userRoom.handNumber || 1;
        newlyEliminated.push({ id: p.id, name: p.name, points: sc.points });
      }
    });

    const surviving = userRoom.players.filter(p => !p.hasLeft && !p.isEliminated);
    if (userRoom.players.length >= 2 && surviving.length === 1) {
      const champion = surviving[0];
      userRoom.tournamentFinished = true;
      userRoom.tournamentWinnerId = champion.id;
      userRoom.tournamentWinnerName = champion.name;
      userRoom.lastAction = `🏆 ${champion.name} wins the Tournament as the last player standing!`;
    } else if (newlyEliminated.length > 0) {
      userRoom.lastAction = `💀 Eliminated (> ${rConfig.scoreLimit} pts): ${newlyEliminated.map(e => `${e.name} (${e.points})`).join(', ')}`;
    }
  } else {
    userRoom.tournamentFinished = false;
    userRoom.tournamentWinnerId = null;
    userRoom.tournamentWinnerName = null;
  }

  const revealedHands = handParticipants.map(pl => {
    const handCards = (Array.isArray(pl.hand) && pl.hand.length > 0)
      ? pl.hand
      : (Array.isArray(pl._finalHandSnapshot) ? pl._finalHandSnapshot : []);
    return {
      name: pl.name,
      id: pl.id,
      hasDropped: Boolean(pl.hasDropped),
      hasForfeited: Boolean(pl.hasForfeited),
      isEliminated: Boolean(pl.isEliminated),
      dropType: pl.dropType || null,
      dropPenalty: pl.dropPenalty || 0,
      isFreeScoot: Boolean(pl.isFreeScoot || pl.dropType === 'FREE_SCOOT'),
      isGrouped: Boolean(pl.isGrouped),
      isWinner: pl.id === winner.id,
      hand: handCards,
      finalDiscard: pl.finalDiscard || null,
      groups: pl.declaredGroups || [],
      maal: calculateMaal(handCards, userRoom.cutCard, rConfig),
      deadwood: (pl.isFreeScoot || pl.dropType === 'FREE_SCOOT') ? 0 : pl.hasDropped ? (pl.dropPenalty || (pl.dropType === 'MIDDLE_DROP' ? rConfig.middleDrop : rConfig.firstDrop)) : (pl.id === winner.id ? 0 : calculateGroupedDeadwood(pl.declaredGroups, handCards, userRoom.cutCard, rConfig)),
      deadwoodCardIds: (pl.isFreeScoot || pl.dropType === 'FREE_SCOOT' || pl.hasDropped || pl.id === winner.id) ? [] : getDeadwoodCards(pl.declaredGroups, handCards, userRoom.cutCard, rConfig).map(c => c.id)
    };
  });

  const resultPayload = {
    type: 'SHOW_RESULT',
    winnerId: winner.id,
    winnerName: winner.name,
    winnerMaal,
    results,
    revealedHands,
    cutCard: userRoom.cutCard,
    rules: rConfig,
    roles: userRoom.cutCard ? resolveJokerRoles(userRoom.cutCard) : null,
    newlyEliminated,
    tournamentFinished: Boolean(userRoom.tournamentFinished),
    tournamentWinnerId: userRoom.tournamentWinnerId || null,
    tournamentWinnerName: userRoom.tournamentWinnerName || null,
    sessionScores: Object.values(userRoom.sessionScores || {}).filter(sc => {
      if (!sc || !sc.name) return false;
      const isSeated = (userRoom.players || []).some(pl => (pl.name || '').trim().toLowerCase() === sc.name.trim().toLowerCase());
      return sc.handsPlayed > 0 || isSeated;
    }).map(sc => ({ ...sc, playerId: sc.id })),
    handNumber: userRoom.handNumber || 1,
    readyPlayers: []
  };
  userRoom.lastRoundResult = resultPayload;

  userRoom.players.forEach(p => {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(resultPayload));
    }
  });

  broadcastRoom(userRoom);
}

function advanceTurn(room) {
  const activePlayers = room.players.filter(p => !p.hasDropped && !p.isEliminated);
  if (activePlayers.length <= 1 && room.players.length > 1) {
    const soleWinner = activePlayers[0] || room.players.find(p => !p.isEliminated) || room.players[0];
    room.winnerId = soleWinner.id;
    room.winnerName = soleWinner.name;
    finalizeRound(room);
    return;
  }

  let attempts = 0;
  do {
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    attempts++;
  } while ((room.players[room.turnIndex].hasDropped || room.players[room.turnIndex].isEliminated) && attempts < room.players.length);

  room.turnStage = 'DRAW';
}

function dealNextHand(room) {
  if (!room.players.length) return;

  // Prune players who left the session or disconnected
  room.players = room.players.filter(p => !p.hasLeft && p.ws);
  const survivingPlayers = room.players.filter(p => !p.isEliminated);
  if (survivingPlayers.length < 2) {
    room.status = 'LOBBY';
    room.turnStage = 'WAITING';
    room.lastAction = 'Waiting for at least 2 active players to start a hand.';
    broadcastRoom(room);
    return;
  }

  const deck = createDeck(room.rules || DEFAULT_RULES);
  room.winnerId = null;
  room.winnerName = null;
  room.lastRoundResult = null;
  room.lastMove = null;
  room.groupingDeadline = null;
  if (room.groupingTimer) {
    clearTimeout(room.groupingTimer);
    room.groupingTimer = null;
  }

  // Rotate starting player clockwise around the table, skipping eliminated players
  let nextStarter = ((room.starterIndex ?? 0) + 1) % room.players.length;
  let guard = 0;
  while (room.players[nextStarter]?.isEliminated && guard < room.players.length) {
    nextStarter = (nextStarter + 1) % room.players.length;
    guard++;
  }
  room.starterIndex = nextStarter;
  room.turnIndex = nextStarter;

  let dealerIdx = (nextStarter - 1 + room.players.length) % room.players.length;
  let dGuard = 0;
  while (room.players[dealerIdx]?.isEliminated && dGuard < room.players.length) {
    dealerIdx = (dealerIdx - 1 + room.players.length) % room.players.length;
    dGuard++;
  }
  room.dealerId = room.players[dealerIdx]?.id;
  room.handNumber = (room.handNumber || 0) + 1;

  room.players.forEach(p => {
    if (p.isEliminated) {
      p.hand = [];
      p._inCurrentHand = false;
      p._finalHandSnapshot = null;
      p.finalDiscard = null;
      p.hasDropped = false;
      p.hasForfeited = false;
      p.isFreeScoot = false;
      p.dropType = null;
      p.dropPenalty = 0;
      p.turnsTaken = 0;
      p.isGrouped = true;
      p.declaredGroups = [];
      p.readyForNextHand = false;
      p._settledInRound = true;
    } else {
      const handTarget = (room.rules?.cardsPerPlayer) || 21;
      if (deck.length < handTarget) {
        deck.push(...createDeck(room.rules || DEFAULT_RULES));
      }
      p.hand = deck.splice(0, handTarget);
      p._inCurrentHand = true;
      p._finalHandSnapshot = null;
      p.finalDiscard = null;
      p.hasDropped = false;
      p.hasForfeited = false;
      p.isFreeScoot = false;
      p.dropType = null;
      p.dropPenalty = 0;
      p.turnsTaken = 0;
      p.isGrouped = false;
      p.declaredGroups = [];
      p.readyForNextHand = false;
      p._settledInRound = false;
    }
  });

  if (deck.length < 2) {
    deck.push(...createDeck(room.rules || DEFAULT_RULES));
  }
  room.cutCard = deck.pop();
  const initialOpen = deck.pop();
  initialOpen.isInitialOpenCard = true;
  room.discardPile = [initialOpen];
  room.deck = deck;
  room.status = 'PLAYING';
  room.turnStage = 'DRAW';
  const starter = room.players[room.starterIndex];
  room.lastAction = `Hand #${room.handNumber} dealt. ${starter ? starter.name : 'First player'} starts drawing.`;
}

wss.on('connection', (ws) => {
  let userRoom = null;
  let playerId = null;

  // Heartbeat ping to keep remote connections alive every 15s
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.ping();
      } catch (e) {}
    }
  }, 15000);

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);

      // Keepalive ping from client to prevent proxy/cloud timeouts
      if (data.type === 'PING') {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        }
        return;
      }

      if (data.type === 'JOIN') {
        const roomId = (data.roomId || 'FAMILY').trim().toUpperCase();
        const playerName = (data.playerName || 'Player').trim();

        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            id: roomId,
            status: 'LOBBY',
            hasStarted: false,
            creatorId: null,
            creatorName: null,
            lastActivityAt: Date.now(),
            rules: sanitizeRules(data.rules),
            players: [],
            deck: [],
            discardPile: [],
            cutCard: null,
            turnIndex: 0,
            turnStage: 'WAITING',
            handNumber: 1,
            starterIndex: 0,
            sessionScores: {}
          });
        }

        userRoom = rooms.get(roomId);
        userRoom.sessionScores = userRoom.sessionScores || {};

        // 1. Reconnection Check: Support mobile players reconnecting after tab switch / screen sleep
        const existingPlayer = userRoom.players.find(p => 
          (data.playerId && p.id === data.playerId) || 
          p.name.trim().toLowerCase() === playerName.trim().toLowerCase()
        );
        if (existingPlayer) {
          if (existingPlayer.ws && existingPlayer.ws !== ws) {
            try { existingPlayer.ws.close(); } catch (_) {}
          }
          existingPlayer.ws = ws;
          playerId = existingPlayer.id;
          if (userRoom.cleanupTimer) {
            clearTimeout(userRoom.cleanupTimer);
            userRoom.cleanupTimer = null;
          }
          touchRoomActivity(userRoom);
          // Invariant: Ensure non-eliminated rejoining player has configured hand count if game is active
          if (userRoom.status === 'PLAYING' && !existingPlayer.isEliminated && existingPlayer._inCurrentHand !== false) {
            ensurePlayerHand(existingPlayer, userRoom, userRoom.rules?.cardsPerPlayer || 21);
          }
          broadcastRoom(userRoom);
          if (userRoom.status === 'ROUND_OVER' && userRoom.lastRoundResult && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              ...userRoom.lastRoundResult,
              sessionScores: Object.values(userRoom.sessionScores || {}).filter(sc => {
                if (!sc || !sc.name) return false;
                const isSeated = (userRoom.players || []).some(pl => (pl.name || '').trim().toLowerCase() === sc.name.trim().toLowerCase());
                return sc.handsPlayed > 0 || isSeated;
              }).map(sc => ({ ...sc, playerId: sc.id })),
              readyPlayers: userRoom.players.filter(p => p.readyForNextHand).map(p => p.id)
            }));
          }
          return;
        }

        if (userRoom.hasStarted) {
          const modeLabel = userRoom.rules?.eliminationEnabled ? 'tournament' : 'game';
          const safeAttemptName = playerName || 'A player';
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'GAME_IN_PROGRESS',
              roomId,
              isTournament: Boolean(userRoom.rules?.eliminationEnabled),
              message: `A ${modeLabel} has already started at table "${roomId}", so new players cannot join.\n\nPlease create a new table with a different room code and invite others to join you there.`
            }));
          }
          const tableNoticeMsg = `${safeAttemptName} tried to join table "${roomId}" but was rejected because the ${modeLabel} has already started. Close the table and re-enter if you want ${safeAttemptName} to join.`;
          userRoom.players.forEach(p => {
            if (p.ws && p.ws.readyState === WebSocket.OPEN) {
              p.ws.send(JSON.stringify({
                type: 'TABLE_NOTICE',
                kind: 'join_rejected',
                playerName: safeAttemptName,
                roomId,
                message: tableNoticeMsg
              }));
            }
          });
          userRoom = null;
          return;
        }

        const seatedCount = userRoom.players.filter(p => !p.hasLeft).length;
        if (seatedCount >= MAX_PLAYERS) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'ROOM_FULL',
              maxPlayers: MAX_PLAYERS,
              message: `Room ${roomId} is full (maximum ${MAX_PLAYERS} players allowed).`
            }));
          }
          userRoom = null;
          return;
        }

        if (userRoom.cleanupTimer) {
          clearTimeout(userRoom.cleanupTimer);
          userRoom.cleanupTimer = null;
        }

        playerId = `p_${Math.random().toString(36).substring(2, 9)}`;

        const scoreKey = playerName.trim().toLowerCase();
        if (!userRoom.sessionScores[scoreKey]) {
          userRoom.sessionScores[scoreKey] = {
            id: playerId,
            name: playerName,
            handsPlayed: 0,
            handsWon: 0,
            points: 0,
            honors: 0,
            maal: 0,
            totalScore: 0,
            isEliminated: false,
            eliminatedInHand: null
          };
        } else {
          userRoom.sessionScores[scoreKey].id = playerId;
          userRoom.sessionScores[scoreKey].name = playerName;
        }

        const wasEliminated = Boolean(userRoom.rules?.eliminationEnabled && userRoom.sessionScores[scoreKey]?.isEliminated);
        const newPlayer = {
          id: playerId,
          name: playerName,
          hand: [],
          hasDropped: false,
          isEliminated: wasEliminated,
          _inCurrentHand: false,
          turnsTaken: 0,
          readyForNextHand: false,
          ws
        };

        userRoom.players.push(newPlayer);
        if (!userRoom.creatorId) {
          userRoom.creatorId = newPlayer.id;
          userRoom.creatorName = newPlayer.name;
        }
        touchRoomActivity(userRoom);
        broadcastRoom(userRoom);
        return;
      }

      if (!userRoom) return;
      touchRoomActivity(userRoom);

      if (data.type === 'UPDATE_RULES') {
        if (userRoom.hasStarted || userRoom.status !== 'LOBBY') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'INVALID_MOVE',
              message: 'Table rules can only be customized before the game starts.'
            }));
          }
          return;
        }
        if (userRoom.creatorId && userRoom.creatorId !== playerId) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'INVALID_MOVE',
              message: `Only ${userRoom.creatorName || 'the table creator'} (who created this table) can customize the table rules before Start.`
            }));
          }
          return;
        }
        userRoom.rules = sanitizeRules(data.rules);
        userRoom.tournamentFinished = false;
        userRoom.tournamentWinnerId = null;
        userRoom.tournamentWinnerName = null;
        userRoom.players.forEach(p => { p.isEliminated = false; });
        Object.values(userRoom.sessionScores || {}).forEach(sc => {
          if (sc) {
            sc.isEliminated = false;
            sc.eliminatedInHand = null;
          }
        });
        const updater = userRoom.players.find(p => p.id === playerId);
        userRoom.lastAction = `${updater ? updater.name : 'Host'} updated the table rules.`;
        broadcastRoom(userRoom);
        return;
      }

      if ((data.type === 'NEXT_HAND' || data.type === 'CONTINUE_NEXT_HAND') && userRoom && userRoom.status === 'ROUND_OVER') {
        const p = userRoom.players.find(x => x.id === playerId);
        if (p) p.readyForNextHand = true;

        if (userRoom.tournamentFinished) {
          const connectedPool = userRoom.players.filter(x => x.ws && !x.hasLeft);
          const pool = connectedPool.length > 0 ? connectedPool : userRoom.players;
          const allReady = pool.length > 0 && pool.every(x => x.readyForNextHand);
          if (allReady) {
            Object.values(userRoom.sessionScores || {}).forEach(sc => {
              if (!sc) return;
              sc.handsPlayed = 0;
              sc.handsWon = 0;
              sc.points = 0;
              sc.honors = 0;
              sc.maal = 0;
              sc.totalScore = 0;
              sc.isEliminated = false;
              sc.eliminatedInHand = null;
            });
            userRoom.players.forEach(pl => { pl.isEliminated = false; });
            userRoom.handNumber = 0;
            userRoom.starterIndex = -1;
            userRoom.tournamentFinished = false;
            userRoom.tournamentWinnerId = null;
            userRoom.tournamentWinnerName = null;
            dealNextHand(userRoom);
          }
        } else {
          const survivingReadyPool = userRoom.players.filter(x => !x.isEliminated && !x.hasLeft);
          const pool = survivingReadyPool.length > 0 ? survivingReadyPool : userRoom.players;
          const allReady = pool.length > 0 && pool.every(x => x.readyForNextHand);
          if (allReady) {
            dealNextHand(userRoom);
          }
        }
        broadcastRoom(userRoom);
        return;
      }

      if (data.type === 'START_GAME' && userRoom.status === 'LOBBY') {
        if (userRoom.players.length < 2) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'INVALID_MOVE',
              message: 'At least 2 players are required to start the game. Share the room code so another player can join!'
            }));
          }
          return;
        }
        if (userRoom.players.length > MAX_PLAYERS) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'INVALID_MOVE',
              message: `Maximum ${MAX_PLAYERS} players are allowed at a table.`
            }));
          }
          return;
        }

        const rConfig = userRoom.rules || DEFAULT_RULES;
        const handTarget = rConfig.cardsPerPlayer || 21;
        const deck = createDeck(rConfig);
        const minCardsNeeded = userRoom.players.length * handTarget + MIN_NON_HAND_CARDS;
        if (deck.length < minCardsNeeded) {
          const cardsPerPack = 52 + (rConfig.poochiesPerDeck ?? 1);
          const neededPacks = Math.min(6, Math.ceil(minCardsNeeded / cardsPerPack));
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'INVALID_MOVE',
              message: `${userRoom.players.length} players at ${handTarget} cards require at least ${neededPacks} pack(s) (currently ${rConfig.decks} pack(s) = ${deck.length} cards). Increase Packs (up to 6) in Rules → Customize!`
            }));
          }
          return;
        }

        const priorMaxHands = Object.values(userRoom.sessionScores || {}).reduce((m, sc) => Math.max(m, sc?.handsPlayed || 0), 0);
        if (priorMaxHands > 0) {
          userRoom.handNumber = Math.max(userRoom.handNumber || 1, priorMaxHands + 1);
        }
        userRoom.winnerId = null;
        userRoom.winnerName = null;
        userRoom.tournamentFinished = false;
        userRoom.tournamentWinnerId = null;
        userRoom.tournamentWinnerName = null;
        userRoom.lastRoundResult = null;
        userRoom.players.forEach(p => {
          p.hand = deck.splice(0, handTarget);
          p._inCurrentHand = true;
          p._finalHandSnapshot = null;
          p.finalDiscard = null;
          p.hasDropped = false;
          p.hasForfeited = false;
          p.isEliminated = false;
          p.isFreeScoot = false;
          p.dropType = null;
          p.dropPenalty = 0;
          p.turnsTaken = 0;
          p.isGrouped = false;
          p.declaredGroups = [];
          p.readyForNextHand = false;
          p._settledInRound = false;
        });

        userRoom.cutCard = deck.pop(); // Open Cut Joker immediately
        const initialOpen = deck.pop();
        initialOpen.isInitialOpenCard = true; // First open card can be picked up even if a Joker
        userRoom.discardPile = [initialOpen];
        userRoom.deck = deck;
        userRoom.lastMove = null;
        userRoom.hasStarted = true;
        userRoom.status = 'PLAYING';
        userRoom.turnIndex = 0;
        userRoom.turnStage = 'DRAW';

        broadcastRoom(userRoom);
      }

      const activePlayer = userRoom.players[userRoom.turnIndex];
      const isTurn = activePlayer && activePlayer.id === playerId;
      const isPlaying = userRoom.status === 'PLAYING';
      const handTarget = userRoom.rules?.cardsPerPlayer || 21;
      const drawnTarget = handTarget + 1;

      if (data.type === 'DRAW_STOCK' && isPlaying && isTurn && userRoom.turnStage === 'DRAW') {
        // Enforce strict hand size invariant: handTarget before draw, drawnTarget after draw
        if (activePlayer.hand.length >= drawnTarget) return;
        if (activePlayer.hand.length < handTarget) {
          ensurePlayerHand(activePlayer, userRoom, handTarget);
        }
        let recycledCount = 0;
        if (userRoom.deck.length === 0) {
          // Reshuffle buried discards back into Stock if stock runs dry
          recycledCount = recycleDiscardIntoStock(userRoom);
        }
        if (userRoom.deck.length === 0) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'INVALID_MOVE',
              message: 'Stock deck is empty and no buried discards remain to reshuffle.'
            }));
          }
          return;
        }
        const drawnCard = userRoom.deck.pop();
        if (!drawnCard) return;
        activePlayer.hand.push(drawnCard);
        // Clamp invariant: exactly drawnTarget cards
        if (activePlayer.hand.length > drawnTarget) {
          activePlayer.hand = activePlayer.hand.slice(0, drawnTarget);
        }
        userRoom.turnStage = 'DISCARD';
        userRoom.moveSeq = (userRoom.moveSeq || 0) + 1;
        userRoom.lastMove = {
          seq: userRoom.moveSeq,
          type: 'DRAW_STOCK',
          playerId: activePlayer.id,
          playerName: activePlayer.name,
          at: Date.now()
        };
        userRoom.lastAction = recycledCount > 0
          ? `♻️ Discard pile reshuffled into Stock (${recycledCount} cards)`
          : 'DRAW_STOCK';
        broadcastRoom(userRoom);
      }

      if (data.type === 'DRAW_DISCARD' && isPlaying && isTurn && userRoom.turnStage === 'DRAW') {
        // Enforce strict hand size invariant: handTarget before draw, drawnTarget after draw
        if (activePlayer.hand.length >= drawnTarget) return;
        if (userRoom.discardPile.length > 0) {
          const topCard = userRoom.discardPile[userRoom.discardPile.length - 1];
          const isJoker = isWildCard(topCard, userRoom.cutCard);

          // Requirement 4: Do not allow a discarded joker to be picked up from discard pile (unless disabled by table rules).
          // However if the first open card is a joker, that CAN be picked up!
          const blockJokerPickup = userRoom.rules?.blockDiscardedJokerPickup !== false;
          if (blockJokerPickup && isJoker && !topCard.isInitialOpenCard) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'INVALID_MOVE',
                message: 'A discarded Joker cannot be picked up from the discard pile. (Only the initial open card can be picked up if it is a Joker). You must draw from the Stock deck.'
              }));
            }
            return;
          }

          if (activePlayer.hand.length < handTarget) {
            ensurePlayerHand(activePlayer, userRoom, handTarget);
          }
          const pickedCard = userRoom.discardPile.pop();
          activePlayer.hand.push(pickedCard);
          // Clamp invariant: exactly drawnTarget cards
          if (activePlayer.hand.length > drawnTarget) {
            activePlayer.hand = activePlayer.hand.slice(0, drawnTarget);
          }
          userRoom.turnStage = 'DISCARD';
          userRoom.moveSeq = (userRoom.moveSeq || 0) + 1;
          userRoom.lastMove = {
            seq: userRoom.moveSeq,
            type: 'DRAW_DISCARD',
            playerId: activePlayer.id,
            playerName: activePlayer.name,
            card: pickedCard,
            at: Date.now()
          };
          userRoom.lastAction = 'DRAW_DISCARD';
          broadcastRoom(userRoom);
        }
      }

      if (data.type === 'DISCARD' && isPlaying && isTurn && userRoom.turnStage === 'DISCARD') {
        if (activePlayer.hand.length < drawnTarget) {
          const ordSuffix = (drawnTarget >= 11 && drawnTarget <= 13) ? 'th' : (drawnTarget % 10 === 1 ? 'st' : drawnTarget % 10 === 2 ? 'nd' : drawnTarget % 10 === 3 ? 'rd' : 'th');
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'INVALID_MOVE',
              message: `You have already discarded or have not drawn your ${drawnTarget}${ordSuffix} card yet.`
            }));
          }
          return;
        }
        const idx = activePlayer.hand.findIndex(c => c.id === data.cardId);
        if (idx !== -1) {
          const [discarded] = activePlayer.hand.splice(idx, 1);
          discarded.discardedBy = activePlayer.name;
          discarded.discardedAt = Date.now();
          discarded.isInitialOpenCard = false; // Discarded by a player!
          userRoom.discardPile.push(discarded);
          activePlayer.turnsTaken++;
          userRoom.moveSeq = (userRoom.moveSeq || 0) + 1;
          userRoom.lastMove = {
            seq: userRoom.moveSeq,
            type: 'DISCARD',
            playerId: activePlayer.id,
            playerName: activePlayer.name,
            card: discarded,
            at: Date.now()
          };
          userRoom.lastAction = `${activePlayer.name} discarded ${discarded.rank}${discarded.suit}`;

          // Invariant: after discard, hand must have strictly handTarget cards
          if (activePlayer.hand.length > handTarget) {
            activePlayer.hand = activePlayer.hand.slice(0, handTarget);
          }

          advanceTurn(userRoom);
          broadcastRoom(userRoom);
        } else {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'INVALID_MOVE',
              message: 'Selected card to discard not found in hand.'
            }));
          }
          broadcastRoom(userRoom);
        }
      }

      if (data.type === 'DROP' && isPlaying && isTurn) {
        const rConfig = userRoom.rules || DEFAULT_RULES;
        const dInfo = countDoubles(activePlayer.hand);
        const isDealt = activePlayer.turnsTaken === 0 && userRoom.turnStage === 'DRAW';
        const hasDrawn = activePlayer.turnsTaken > 0 || userRoom.turnStage === 'DISCARD';

        // Check Free Scoot / Free Game conditions
        const isFreeScootDealt = isDealt && rConfig.allowDoublesShow && dInfo.count >= rConfig.freeScootDealtDoubles;
        const isFreeGameDrawn = hasDrawn && rConfig.allowDoublesShow && dInfo.count >= rConfig.freeGameDrawnDoubles;

        if (isFreeScootDealt || isFreeGameDrawn) {
          activePlayer.hasDropped = true;
          activePlayer.isFreeScoot = true;
          activePlayer.dropType = 'FREE_SCOOT';
          activePlayer.dropPenalty = 0;
          const label = isFreeScootDealt
            ? `Free Scoot (${rConfig.freeScootDealtDoubles}+ Doubles dealt)`
            : `Free Game (${rConfig.freeGameDrawnDoubles}+ Doubles)`;
          userRoom.lastAction = `${activePlayer.name} scooted (${label}: 0 pts & 0 Honors)`;
          advanceTurn(userRoom);
          broadcastRoom(userRoom);
        } else if (userRoom.turnStage === 'DRAW') {
          // Normal first drop or middle drop
          activePlayer.hasDropped = true;
          activePlayer.isFreeScoot = false;
          const isFirst = activePlayer.turnsTaken === 0;
          const penalty = isFirst ? rConfig.firstDrop : rConfig.middleDrop;
          const dropKind = isFirst ? 'First Drop' : 'Middle Drop';
          activePlayer.dropType = isFirst ? 'FIRST_DROP' : 'MIDDLE_DROP';
          activePlayer.dropPenalty = penalty;
          userRoom.lastAction = `${activePlayer.name} scooted (${dropKind}: ${penalty} pts)`;

          advanceTurn(userRoom);
          broadcastRoom(userRoom);
        }
      }

      if (data.type === 'FORFEIT_DECLARATION' && isPlaying && isTurn && userRoom.turnStage === 'DISCARD') {
        const forfeitPts = userRoom.rules?.forfeitPenalty ?? 100;
        activePlayer.hasDropped = true;
        activePlayer.hasForfeited = true;
        activePlayer.dropType = 'FORFEIT';
        activePlayer.dropPenalty = forfeitPts;
        userRoom.lastAction = `${activePlayer.name} forfeited declaration (${forfeitPts} pts)`;
        advanceTurn(userRoom);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'DECLARATION_FORFEITED', penalty: forfeitPts }));
        }
        broadcastRoom(userRoom);
      }

      if (data.type === 'DECLARE' && isPlaying && isTurn) {
        const rConfig = sanitizeRules(userRoom.rules || DEFAULT_RULES);
        const isDealtTurn = activePlayer.turnsTaken === 0 && userRoom.turnStage === 'DRAW';
        const isDrawnTurn = userRoom.turnStage === 'DISCARD';
        if (!isDealtTurn && !isDrawnTurn) return;

        let showHand = [];
        let finalDiscard = null;
        const dInfo = countDoubles(activePlayer.hand);
        const tInfo = countTunellas(activePlayer.hand);

        if (isDealtTurn) {
          // If dealt enough doubles or 3 Tunellas (when enabled), can declare without drawing a card
          const canDealtDoubles = rConfig.allowDoublesShow && dInfo.count >= rConfig.dealtDoublesForShow;
          const canDealt3Tunellas = rConfig.allow3TunellasShow && tInfo.count >= 3;
          if (!canDealtDoubles && !canDealt3Tunellas) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'SHOW_INVALID',
                reason: rConfig.allowDoublesShow
                  ? `Declaring without drawing requires holding at least ${rConfig.dealtDoublesForShow} doubles dealt${rConfig.allow3TunellasShow ? ' or 3 Tunellas' : ''}.`
                  : (rConfig.allow3TunellasShow ? 'Declaring without drawing requires holding 3 Tunellas.' : 'Dealt instant show is disabled under current table rules.'),
                penalty: 0
              }));
            }
            return;
          }
          showHand = [...activePlayer.hand];
        } else {
          // Normal declaration after drawing: requires final discard
          const finalIdx = activePlayer.hand.findIndex(c => c.id === data.cardId);
          if (finalIdx === -1) return;
          showHand = activePlayer.hand.filter(c => c.id !== data.cardId);
          finalDiscard = activePlayer.hand[finalIdx];
        }

        const validation = validateShow(data.groups, showHand, userRoom.cutCard, isDealtTurn, rConfig);
        if (!validation.valid) {
          const forfeitPts = rConfig.forfeitPenalty ?? 100;
          activePlayer.hasDropped = true;
          activePlayer.hasForfeited = true;
          activePlayer.dropType = 'FORFEIT';
          activePlayer.dropPenalty = forfeitPts;
          userRoom.lastAction = `${activePlayer.name} made invalid show (${forfeitPts} pts penalty)`;
          advanceTurn(userRoom);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'SHOW_INVALID', reason: validation.reason, penalty: forfeitPts }));
          }
          broadcastRoom(userRoom);
          return;
        }

        if (finalDiscard) {
          const finalIdx = activePlayer.hand.findIndex(c => c.id === finalDiscard.id);
          if (finalIdx !== -1) {
            activePlayer.hand.splice(finalIdx, 1);
            userRoom.discardPile.push(finalDiscard);
            activePlayer.finalDiscard = finalDiscard;
          }
        }
        activePlayer.declaredGroups = data.groups || [];
        activePlayer.isGrouped = true;
        userRoom.winnerId = activePlayer.id;
        userRoom.winnerName = activePlayer.name;

        const activeNonDropped = userRoom.players.filter(p => !p.hasDropped && !p.isEliminated);
        const othersToGroup = activeNonDropped.filter(p => p.id !== activePlayer.id);

        if (othersToGroup.length === 0) {
          finalizeRound(userRoom);
        } else {
          const groupingSec = rConfig.groupingTimeSec || 300;
          const groupingMs = groupingSec * 1000;
          const minsLabel = groupingSec >= 60 ? `${Math.round(groupingSec / 60)}m` : `${groupingSec}s`;
          userRoom.status = 'GROUPING';
          userRoom.turnStage = 'GROUPING';
          userRoom.groupingDeadline = Date.now() + groupingMs;
          const declareTypeNotice = validation.isThreeTunellas
            ? '3 Tunellas direct show'
            : (isDealtTurn
              ? `${rConfig.dealtDoublesForShow} Doubles direct show`
              : (validation.isDoubles ? `${rConfig.drawnDoublesForShow} Doubles show` : `${handTarget}-card show`));
          userRoom.lastAction = `${activePlayer.name} declared (${declareTypeNotice})! Players grouping their cards (${minsLabel})...`;

          if (userRoom.groupingTimer) clearTimeout(userRoom.groupingTimer);
          userRoom.groupingTimer = setTimeout(() => {
            if (userRoom && userRoom.status === 'GROUPING') {
              finalizeRound(userRoom);
            }
          }, groupingMs);

          broadcastRoom(userRoom);
        }
      }

      if (data.type === 'SUBMIT_GROUPS' && userRoom.status === 'GROUPING') {
        const player = userRoom.players.find(p => p.id === playerId);
        if (player && !player.hasDropped && !player.isEliminated && !player.isGrouped) {
          player.declaredGroups = Array.isArray(data.groups) ? data.groups : [];
          player.isGrouped = true;
          userRoom.lastAction = `${player.name} finished grouping their cards.`;

          const activeNonDropped = userRoom.players.filter(p => !p.hasDropped && !p.isEliminated);
          const allDone = activeNonDropped.every(p => p.isGrouped);
          if (allDone) {
            finalizeRound(userRoom);
          } else {
            broadcastRoom(userRoom);
          }
        }
      }

      if (data.type === 'CLOSE_ROOM') {
        if (userRoom.creatorId && userRoom.creatorId !== playerId) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'INVALID_MOVE',
              message: `Only ${userRoom.creatorName || 'the table creator'} (who created this table) can close the room.`
            }));
          }
          return;
        }
        const closingPlayer = userRoom.players.find(p => p.id === playerId);
        const closingName = closingPlayer ? closingPlayer.name : 'A player';
        userRoom.players.forEach(p => {
          if (p.ws && p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(JSON.stringify({
              type: 'ROOM_CLOSED',
              message: `${closingName} closed the room.`
            }));
          }
        });
        clearRoomTimers(userRoom);
        rooms.delete(userRoom.id);
        return;
      }

      if (data.type === 'LEAVE_SESSION') {
        const leavingPlayer = userRoom.players.find(p => p.id === playerId);
        if (!leavingPlayer) return;

        const wasPlaying = userRoom.status === 'PLAYING' || userRoom.status === 'GROUPING';

        if (wasPlaying && leavingPlayer.isEliminated && !leavingPlayer._inCurrentHand) {
          leavingPlayer.hasLeft = true;
          leavingPlayer.ws = null;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'SESSION_LEFT',
              message: 'You left the tournament table.'
            }));
          }
          userRoom.lastAction = `${leavingPlayer.name} (eliminated) left the table.`;
          broadcastRoom(userRoom);
        } else if (wasPlaying) {
          const rConfig = userRoom.rules || DEFAULT_RULES;
          const forfeitPts = rConfig.forfeitPenalty ?? 100;
          const midPts = rConfig.middleDrop ?? 70;
          // If leaving after a wrong declare, invalid show, or forfeit, penalize forfeitPts instead of normal mid-scoot
          const isForfeit = Boolean(leavingPlayer.hasForfeited || leavingPlayer.dropType === 'FORFEIT' || leavingPlayer.dropPenalty === forfeitPts || data.forfeit);
          const penalty = isForfeit ? forfeitPts : midPts;
          const dropType = isForfeit ? 'FORFEIT' : 'MIDDLE_DROP';
          const penaltyLabel = isForfeit ? `Wrong Declare / Forfeit: ${forfeitPts} pts` : `Mid-scoot: ${midPts} pts`;

          leavingPlayer.hasDropped = true;
          leavingPlayer.hasForfeited = isForfeit;
          leavingPlayer.dropType = dropType;
          leavingPlayer.dropPenalty = penalty;
          leavingPlayer.hasLeft = true;

          // Ensure sessionScores entry exists; finalizeRound will settle dropPenalty + winnerMaal cleanly once per hand
          const scoreKey = (leavingPlayer.name || '').trim().toLowerCase();
          if (!userRoom.sessionScores[scoreKey]) {
            userRoom.sessionScores[scoreKey] = {
              id: leavingPlayer.id,
              name: leavingPlayer.name,
              handsPlayed: 0,
              handsWon: 0,
              points: 0,
              honors: 0,
              maal: 0,
              totalScore: 0,
              isEliminated: false,
              eliminatedInHand: null
            };
          }

          userRoom.lastAction = `${leavingPlayer.name} left the game (${penaltyLabel})`;

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'SESSION_LEFT',
              message: isForfeit
                ? `You left the game after a wrong declare / forfeit (${forfeitPts} pts penalty).`
                : `You left the game as a Mid-Scoot (${midPts} pts penalty).`
            }));
          }
          leavingPlayer.ws = null;
          leavingPlayer._finalHandSnapshot = Array.isArray(leavingPlayer.hand) ? [...leavingPlayer.hand] : [];
          leavingPlayer.hand = [];

          const activeIndex = userRoom.turnIndex;
          const isLeavingTurn = userRoom.players[activeIndex]?.id === playerId;

          const activeNonDropped = userRoom.players.filter(p => !p.hasDropped && !p.isEliminated && !p.hasLeft);
          if (activeNonDropped.length <= 1 && userRoom.players.length > 1) {
            const soleWinner = activeNonDropped[0] || userRoom.players.find(p => !p.hasLeft && !p.isEliminated);
            if (soleWinner) {
              userRoom.winnerId = soleWinner.id;
              userRoom.winnerName = soleWinner.name;
              finalizeRound(userRoom);
            } else {
              userRoom.status = 'LOBBY';
              broadcastRoom(userRoom);
            }
          } else {
            if (isLeavingTurn) {
              advanceTurn(userRoom);
            }
            broadcastRoom(userRoom);
          }
        } else {
          // In LOBBY or ROUND_OVER
          userRoom.players = userRoom.players.filter(p => p.id !== playerId);
          if (!userRoom.hasStarted && userRoom.creatorId === playerId) {
            userRoom.creatorId = userRoom.players[0]?.id || null;
            userRoom.creatorName = userRoom.players[0]?.name || null;
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'SESSION_LEFT',
              message: 'You left the table.'
            }));
          }
          userRoom.lastAction = `${leavingPlayer.name} left the table.`;
          if (userRoom.players.length === 0) {
            clearRoomTimers(userRoom);
            rooms.delete(userRoom.id);
          } else {
            broadcastRoom(userRoom);
          }
        }
        return;
      }
    } catch (e) {
      console.error('Socket error:', e);
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (userRoom) {
      const p = userRoom.players.find(x => x.id === playerId);
      if (p && p.ws === ws) {
        p.ws = null;
        if (!userRoom.hasStarted) {
          userRoom.players = userRoom.players.filter(pl => pl.id !== playerId);
          if (userRoom.creatorId === playerId) {
            userRoom.creatorId = userRoom.players[0]?.id || null;
            userRoom.creatorName = userRoom.players[0]?.name || null;
          }
        }
      }
      const allDisconnected = userRoom.players.length === 0 || userRoom.players.every(p => !p.ws);
      if (allDisconnected) {
        // Keep room alive until the 1-hour inactivity timeout expires so players can reconnect
        if (!userRoom.inactivityTimer) {
          touchRoomActivity(userRoom);
        }
      } else {
        broadcastRoom(userRoom);
      }
    }
  });
});

function resolvePort() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
      const p = parseInt(args[i + 1], 10);
      if (p > 0 && p < 65536) return p;
    }
  }
  if (process.env.DEFAULT_APP_PORT) {
    const p = parseInt(process.env.DEFAULT_APP_PORT, 10);
    if (p > 0 && p < 65536) return p;
  }
  // In AI Studio container environment, nginx occupies port 8080 and proxies to port 3000
  if (process.env.NGINX_PORT || process.env.PORT === '8080') {
    return 3000;
  }
  return parseInt(process.env.PORT, 10) || 3000;
}

const PORT = resolvePort();

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Exiting process so supervisor can restart cleanly.`);
    process.exit(1);
  }
  console.error('HTTP/WebSocket Server error:', err);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`21 Card Rummy live on port ${PORT}`);
  console.log(`  ➜  Local:   http://localhost:${PORT}/`);
  console.log(`  ➜  Network: http://0.0.0.0:${PORT}/`);
});