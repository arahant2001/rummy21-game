import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDeck, resolveJokerRoles, calculateMaal, calculateDeadwood, calculateGroupedDeadwood, validateShow, isWildCard, CONFIG } from './rules.js';

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

function ensurePlayerHand(player, room, targetCount = 21) {
  if (!player.hand) player.hand = [];
  if (!room.deck || !Array.isArray(room.deck)) room.deck = createDeck();
  while (player.hand.length < targetCount) {
    if (room.deck.length === 0) {
      room.deck = createDeck();
    }
    player.hand.push(room.deck.pop());
  }
  // Clamp invariant: player hand never exceeds 22 cards
  if (player.hand.length > 22) {
    player.hand = player.hand.slice(0, 22);
  }
}

function getSafeRoom(room) {
  const rawTop = room.discardPile[room.discardPile.length - 1] || null;
  const isTopJoker = rawTop && room.cutCard ? isWildCard(rawTop, room.cutCard) : false;
  const topDiscard = rawTop ? {
    ...rawTop,
    isInitialOpenCard: Boolean(rawTop.isInitialOpenCard),
    isDiscardedJoker: Boolean(isTopJoker && !rawTop.isInitialOpenCard)
  } : null;

  return {
    id: room.id,
    status: room.status,
    winnerId: room.winnerId || null,
    winnerName: room.winnerName || null,
    groupingDeadline: room.groupingDeadline || null,
    turnPlayerId: room.players[room.turnIndex]?.id || null,
    turnPlayerName: room.players[room.turnIndex]?.name || '',
    turnStage: room.turnStage,
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
    sessionScores: Object.values(room.sessionScores || {}),
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      connected: Boolean(p.ws && p.ws.readyState === WebSocket.OPEN),
      hasDropped: Boolean(p.hasDropped),
      hasForfeited: Boolean(p.hasForfeited),
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
        yourMaal: room.cutCard ? calculateMaal(p.hand, room.cutCard) : null
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

  const winner = userRoom.players.find(p => p.id === userRoom.winnerId) || userRoom.players[0];
  const winnerMaal = calculateMaal(winner.hand, userRoom.cutCard);

  userRoom.sessionScores = userRoom.sessionScores || {};
  const losersCount = Math.max(0, userRoom.players.length - 1);

  const results = userRoom.players.map(p => {
    // Ensure player session entry exists
    if (!userRoom.sessionScores[p.id]) {
      userRoom.sessionScores[p.id] = {
        id: p.id,
        name: p.name,
        handsPlayed: 0,
        handsWon: 0,
        points: 0,
        maal: 0,
        totalScore: 0
      };
    }
    const sc = userRoom.sessionScores[p.id];
    sc.name = p.name;
    sc.handsPlayed += 1;
    p.readyForNextHand = false;

    if (p.id === winner.id) {
      sc.handsWon += 1;
      const netMaal = losersCount * winnerMaal.total;
      sc.maal += netMaal;
      sc.honors = sc.maal;
      sc.totalScore += netMaal;
      return {
        name: p.name,
        status: 'WINNER',
        points: 0,
        maalCollected: winnerMaal.total,
        honorsCollected: winnerMaal.total,
        net: `Won + collects ${winnerMaal.total} Honors from each loser`
      };
    }
    if (p.hasDropped) {
      const drop = p.dropPenalty || CONFIG.firstDrop || 30;
      const totalPay = drop + winnerMaal.total;
      sc.points += drop;
      sc.maal -= winnerMaal.total;
      sc.honors = sc.maal;
      sc.totalScore -= totalPay;
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
    const deadwood = calculateGroupedDeadwood(p.declaredGroups, p.hand, userRoom.cutCard);
    const totalPay = deadwood + winnerMaal.total;
    sc.points += deadwood;
    sc.maal -= winnerMaal.total;
    sc.honors = sc.maal;
    sc.totalScore -= totalPay;
    return {
      name: p.name,
      status: 'LOST',
      deadwood,
      maalOwed: winnerMaal.total,
      honorsOwed: winnerMaal.total,
      net: `Pays ${totalPay} pts (${deadwood} deadwood + ${winnerMaal.total} winner Honors)`
    };
  });

  const revealedHands = userRoom.players.map(pl => ({
    name: pl.name,
    id: pl.id,
    hasDropped: pl.hasDropped,
    dropType: pl.dropType,
    isWinner: pl.id === winner.id,
    hand: pl.hand,
    finalDiscard: pl.finalDiscard || null,
    groups: pl.declaredGroups || [],
    maal: calculateMaal(pl.hand, userRoom.cutCard),
    deadwood: pl.hasDropped ? (pl.dropPenalty || 30) : (pl.id === winner.id ? 0 : calculateGroupedDeadwood(pl.declaredGroups, pl.hand, userRoom.cutCard))
  }));

  userRoom.players.forEach(p => {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify({
        type: 'SHOW_RESULT',
        winnerName: winner.name,
        winnerMaal,
        results,
        revealedHands,
        sessionScores: Object.values(userRoom.sessionScores),
        handNumber: userRoom.handNumber || 1,
        readyPlayers: []
      }));
    }
  });

  broadcastRoom(userRoom);
}

function advanceTurn(room) {
  const activePlayers = room.players.filter(p => !p.hasDropped);
  if (activePlayers.length <= 1 && room.players.length > 1) {
    const soleWinner = activePlayers[0] || room.players[0];
    room.winnerId = soleWinner.id;
    room.winnerName = soleWinner.name;
    finalizeRound(room);
    return;
  }

  let attempts = 0;
  do {
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    attempts++;
  } while (room.players[room.turnIndex].hasDropped && attempts < room.players.length);

  room.turnStage = 'DRAW';
}

function dealNextHand(room) {
  if (!room.players.length) return;

  const deck = createDeck();
  room.winnerId = null;
  room.winnerName = null;
  room.groupingDeadline = null;
  if (room.groupingTimer) {
    clearTimeout(room.groupingTimer);
    room.groupingTimer = null;
  }

  // Refinement 5: Rotate starting player anti-clockwise around the table
  // Array progression 0 -> 1 -> 2 -> 3 -> 0 matches anti-clockwise table rotation
  room.starterIndex = ((room.starterIndex ?? 0) + 1) % room.players.length;
  room.turnIndex = room.starterIndex;
  // Dealer button sits on preceding player who dealt to starter
  room.dealerId = room.players[(room.starterIndex - 1 + room.players.length) % room.players.length]?.id;
  room.handNumber = (room.handNumber || 1) + 1;

  room.players.forEach(p => {
    p.hand = deck.splice(0, 21);
    p.hasDropped = false;
    p.hasForfeited = false;
    p.dropType = null;
    p.dropPenalty = 0;
    p.turnsTaken = 0;
    p.isGrouped = false;
    p.declaredGroups = [];
    p.readyForNextHand = false;
  });

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
            players: [],
            deck: [],
            discardPile: [],
            cutCard: null,
            turnIndex: 0,
            turnStage: 'DRAW',
            handNumber: 1,
            starterIndex: 0,
            sessionScores: {}
          });
        }

        userRoom = rooms.get(roomId);
        userRoom.sessionScores = userRoom.sessionScores || {};

        // Cancel any pending room deletion timer since active reconnect occurred
        if (userRoom.cleanupTimer) {
          clearTimeout(userRoom.cleanupTimer);
          userRoom.cleanupTimer = null;
        }

        // 1. Reconnection Check: Support mobile players reconnecting after tab switch / screen sleep
        const existingPlayer = userRoom.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
        if (existingPlayer) {
          existingPlayer.ws = ws;
          playerId = existingPlayer.id;
          // Invariant: Ensure rejoining player has strictly 21 (or 22) cards if game is active
          if (userRoom.status === 'PLAYING') {
            ensurePlayerHand(existingPlayer, userRoom, 21);
          }
          broadcastRoom(userRoom);
          return;
        }

        playerId = `p_${Math.random().toString(36).substring(2, 9)}`;

        if (!userRoom.sessionScores[playerId]) {
          userRoom.sessionScores[playerId] = {
            id: playerId,
            name: playerName,
            handsPlayed: 0,
            handsWon: 0,
            points: 0,
            honors: 0,
            maal: 0,
            totalScore: 0
          };
        }

        const newPlayer = {
          id: playerId,
          name: playerName,
          hand: [],
          hasDropped: false,
          turnsTaken: 0,
          readyForNextHand: false,
          ws
        };

        // Requirement 3: When a player joins from a phone (or mid-game), deal them strictly 21 cards
        if (userRoom.status === 'PLAYING') {
          ensurePlayerHand(newPlayer, userRoom, 21);
        }

        userRoom.players.push(newPlayer);
        broadcastRoom(userRoom);
      }

      if (!userRoom) return;

      if ((data.type === 'NEXT_HAND' || data.type === 'CONTINUE_NEXT_HAND') && userRoom && userRoom.status === 'ROUND_OVER') {
        const p = userRoom.players.find(x => x.id === playerId);
        if (p) p.readyForNextHand = true;

        const allReady = userRoom.players.length > 0 && userRoom.players.every(x => x.readyForNextHand);
        if (allReady) {
          dealNextHand(userRoom);
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

        const deck = createDeck();
        userRoom.players.forEach(p => {
          p.hand = deck.splice(0, 21);
          p.hasDropped = false;
          p.turnsTaken = 0;
        });

        userRoom.cutCard = deck.pop(); // Open Cut Joker immediately
        const initialOpen = deck.pop();
        initialOpen.isInitialOpenCard = true; // First open card can be picked up even if a Joker
        userRoom.discardPile = [initialOpen];
        userRoom.deck = deck;
        userRoom.status = 'PLAYING';
        userRoom.turnIndex = 0;
        userRoom.turnStage = 'DRAW';

        broadcastRoom(userRoom);
      }

      const activePlayer = userRoom.players[userRoom.turnIndex];
      const isTurn = activePlayer && activePlayer.id === playerId;

      if (data.type === 'DRAW_STOCK' && isTurn && userRoom.turnStage === 'DRAW') {
        // Enforce strict hand size invariant: exactly 21 before draw, 22 after draw
        if (activePlayer.hand.length >= 22) return;
        if (activePlayer.hand.length < 21) {
          ensurePlayerHand(activePlayer, userRoom, 21);
        }
        if (userRoom.deck.length === 0) {
          // Recycle discard pile if stock runs dry
          const top = userRoom.discardPile.pop();
          userRoom.deck = userRoom.discardPile.reverse();
          userRoom.discardPile = [top];
        }
        activePlayer.hand.push(userRoom.deck.pop());
        // Clamp invariant: exactly 22 cards
        if (activePlayer.hand.length > 22) {
          activePlayer.hand = activePlayer.hand.slice(0, 22);
        }
        userRoom.turnStage = 'DISCARD';
        userRoom.lastAction = 'DRAW_STOCK';
        broadcastRoom(userRoom);
      }

      if (data.type === 'DRAW_DISCARD' && isTurn && userRoom.turnStage === 'DRAW') {
        // Enforce strict hand size invariant: exactly 21 before draw, 22 after draw
        if (activePlayer.hand.length >= 22) return;
        if (userRoom.discardPile.length > 0) {
          const topCard = userRoom.discardPile[userRoom.discardPile.length - 1];
          const isJoker = isWildCard(topCard, userRoom.cutCard);

          // Requirement 4: Do not allow a discarded joker to be picked up from discard pile.
          // However if the first open card is a joker, that CAN be picked up!
          if (isJoker && !topCard.isInitialOpenCard) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'INVALID_MOVE',
                message: 'A discarded Joker cannot be picked up from the discard pile. (Only the initial open card can be picked up if it is a Joker). You must draw from the Stock deck.'
              }));
            }
            return;
          }

          if (activePlayer.hand.length < 21) {
            ensurePlayerHand(activePlayer, userRoom, 21);
          }
          activePlayer.hand.push(userRoom.discardPile.pop());
          // Clamp invariant: exactly 22 cards
          if (activePlayer.hand.length > 22) {
            activePlayer.hand = activePlayer.hand.slice(0, 22);
          }
          userRoom.turnStage = 'DISCARD';
          userRoom.lastAction = 'DRAW_DISCARD';
          broadcastRoom(userRoom);
        }
      }

      if (data.type === 'DISCARD' && isTurn && userRoom.turnStage === 'DISCARD') {
        const idx = activePlayer.hand.findIndex(c => c.id === data.cardId);
        if (idx !== -1) {
          const [discarded] = activePlayer.hand.splice(idx, 1);
          discarded.discardedBy = activePlayer.name;
          discarded.discardedAt = Date.now();
          discarded.isInitialOpenCard = false; // Discarded by a player!
          userRoom.discardPile.push(discarded);
          activePlayer.turnsTaken++;
          userRoom.lastAction = `${activePlayer.name} discarded ${discarded.rank}${discarded.suit}`;

          // Invariant: after discard, hand must have strictly 21 cards
          if (activePlayer.hand.length > 21) {
            activePlayer.hand = activePlayer.hand.slice(0, 21);
          }

          advanceTurn(userRoom);
          broadcastRoom(userRoom);
        }
      }

      if (data.type === 'DROP' && isTurn && userRoom.turnStage === 'DRAW') {
        activePlayer.hasDropped = true;
        const isFirst = activePlayer.turnsTaken === 0;
        const penalty = isFirst ? CONFIG.firstDrop : CONFIG.middleDrop;
        const dropKind = isFirst ? 'First Drop' : 'Middle Drop';
        activePlayer.dropType = isFirst ? 'FIRST_DROP' : 'MIDDLE_DROP';
        activePlayer.dropPenalty = penalty;
        userRoom.lastAction = `${activePlayer.name} scooted (${dropKind}: ${penalty} pts)`;

        advanceTurn(userRoom);
        broadcastRoom(userRoom);
      }

      if (data.type === 'FORFEIT_DECLARATION' && isTurn && userRoom.turnStage === 'DISCARD') {
        activePlayer.hasDropped = true;
        activePlayer.hasForfeited = true;
        activePlayer.dropType = 'FORFEIT';
        activePlayer.dropPenalty = 100;
        userRoom.lastAction = `${activePlayer.name} forfeited declaration (100 pts)`;
        advanceTurn(userRoom);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'DECLARATION_FORFEITED', penalty: 100 }));
        }
        broadcastRoom(userRoom);
      }

      if (data.type === 'DECLARE' && isTurn && userRoom.turnStage === 'DISCARD') {
        const finalIdx = activePlayer.hand.findIndex(c => c.id === data.cardId);
        if (finalIdx === -1) return;
        const showHand = activePlayer.hand.filter(c => c.id !== data.cardId);
        const validation = validateShow(data.groups, showHand, userRoom.cutCard);
        if (!validation.valid) {
          activePlayer.hasDropped = true;
          activePlayer.hasForfeited = true;
          activePlayer.dropType = 'FORFEIT';
          activePlayer.dropPenalty = 100;
          userRoom.lastAction = `${activePlayer.name} made invalid show (100 pts penalty)`;
          advanceTurn(userRoom);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'SHOW_INVALID', reason: validation.reason, penalty: 100 }));
          }
          broadcastRoom(userRoom);
          return;
        }

        const [finalDiscard] = activePlayer.hand.splice(finalIdx, 1);
        userRoom.discardPile.push(finalDiscard);
        activePlayer.finalDiscard = finalDiscard;
        activePlayer.declaredGroups = data.groups;
        activePlayer.isGrouped = true;
        userRoom.winnerId = activePlayer.id;
        userRoom.winnerName = activePlayer.name;

        const activeNonDropped = userRoom.players.filter(p => !p.hasDropped);
        const othersToGroup = activeNonDropped.filter(p => p.id !== activePlayer.id);

        if (othersToGroup.length === 0) {
          finalizeRound(userRoom);
        } else {
          userRoom.status = 'GROUPING';
          userRoom.turnStage = 'GROUPING';
          userRoom.groupingDeadline = Date.now() + 45000;
          userRoom.lastAction = `${activePlayer.name} declared 21-card show! Players grouping their cards...`;

          if (userRoom.groupingTimer) clearTimeout(userRoom.groupingTimer);
          userRoom.groupingTimer = setTimeout(() => {
            if (userRoom && userRoom.status === 'GROUPING') {
              finalizeRound(userRoom);
            }
          }, 45000);

          broadcastRoom(userRoom);
        }
      }

      if (data.type === 'SUBMIT_GROUPS' && userRoom.status === 'GROUPING') {
        const player = userRoom.players.find(p => p.id === playerId);
        if (player && !player.hasDropped && !player.isGrouped) {
          player.declaredGroups = Array.isArray(data.groups) ? data.groups : [];
          player.isGrouped = true;
          userRoom.lastAction = `${player.name} finished grouping their cards.`;

          const activeNonDropped = userRoom.players.filter(p => !p.hasDropped);
          const allDone = activeNonDropped.every(p => p.isGrouped);
          if (allDone) {
            finalizeRound(userRoom);
          } else {
            broadcastRoom(userRoom);
          }
        }
      }
    } catch (e) {
      console.error('Socket error:', e);
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (userRoom) {
      const p = userRoom.players.find(x => x.id === playerId);
      if (p) {
        p.ws = null;
      }
      if (userRoom.status === 'LOBBY') {
        userRoom.players = userRoom.players.filter(p => p.id !== playerId);
      }
      const allDisconnected = userRoom.players.length === 0 || userRoom.players.every(p => !p.ws);
      if (allDisconnected) {
        // Prevent session drops: give 30 minutes grace period for phones/laptops to reconnect
        if (!userRoom.cleanupTimer) {
          userRoom.cleanupTimer = setTimeout(() => {
            const stillEmpty = !userRoom.players || userRoom.players.length === 0 || userRoom.players.every(p => !p.ws);
            if (stillEmpty) {
              rooms.delete(userRoom.id);
            }
          }, 30 * 60 * 1000);
        }
      } else {
        broadcastRoom(userRoom);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`21 Card Rummy live on port ${PORT}`);
});