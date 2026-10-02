import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDeck, resolveJokerRoles, calculateMaal, calculateDeadwood, calculateGroupedDeadwood, validateShow, CONFIG } from './rules.js';

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

function getSafeRoom(room) {
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
    topDiscard: room.discardPile[room.discardPile.length - 1] || null,
    // Return all buried discards with metadata so players can inspect full discard history
    discardHistory: room.discardPile.slice(0, Math.max(0, room.discardPile.length - 1)),
    deckCount: room.deck.length,
    lastAction: room.lastAction || '',
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      hasDropped: Boolean(p.hasDropped),
      hasForfeited: Boolean(p.hasForfeited),
      dropType: p.dropType || (p.hasForfeited ? 'FORFEIT' : p.hasDropped ? (p.turnsTaken === 0 ? 'FIRST_DROP' : 'MIDDLE_DROP') : null),
      dropPenalty: p.dropPenalty || 0,
      turnsTaken: p.turnsTaken || 0,
      isGrouped: Boolean(p.isGrouped)
    }))
  };
}

function broadcastRoom(room) {
  const safeState = getSafeRoom(room);
  room.players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) {
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

  const results = userRoom.players.map(p => {
    if (p.id === winner.id) {
      return {
        name: p.name,
        status: 'WINNER',
        points: 0,
        maalCollected: winnerMaal.total,
        net: `Won + collects ${winnerMaal.total} Maal from each loser`
      };
    }
    if (p.hasDropped) {
      const drop = p.dropPenalty || CONFIG.firstDrop || 30;
      const totalPay = drop + winnerMaal.total;
      return {
        name: p.name,
        status: p.hasForfeited ? 'FORFEITED' : 'DROPPED',
        points: totalPay,
        dropPenalty: drop,
        maalOwed: winnerMaal.total,
        net: `Pays ${totalPay} pts (${drop} ${p.hasForfeited ? 'forfeit' : 'drop'} + ${winnerMaal.total} winner Maal)`
      };
    }
    const deadwood = calculateGroupedDeadwood(p.declaredGroups, p.hand, userRoom.cutCard);
    const totalPay = deadwood + winnerMaal.total;
    return {
      name: p.name,
      status: 'LOST',
      deadwood,
      maalOwed: winnerMaal.total,
      net: `Pays ${totalPay} pts (${deadwood} deadwood + ${winnerMaal.total} winner Maal)`
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
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify({
        type: 'SHOW_RESULT',
        winnerName: winner.name,
        winnerMaal,
        results,
        revealedHands
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

  room.players.forEach(p => {
    p.hand = deck.splice(0, 21);
    p.hasDropped = false;
    p.hasForfeited = false;
    p.dropType = null;
    p.dropPenalty = 0;
    p.turnsTaken = 0;
    p.isGrouped = false;
    p.declaredGroups = [];
  });

  room.cutCard = deck.pop();
  room.discardPile = [deck.pop()];
  room.deck = deck;
  room.status = 'PLAYING';
  room.turnIndex = 0;
  room.turnStage = 'DRAW';
  room.lastAction = 'New hand dealt. Game on!';
}

wss.on('connection', (ws) => {
  let userRoom = null;
  let playerId = null;

  // Heartbeat ping to keep remote connections alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  }, 25000);

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);

      if (data.type === 'JOIN') {
        const roomId = (data.roomId || 'FAMILY').trim().toUpperCase();
        const playerName = (data.playerName || 'Player').trim();
        playerId = `p_${Math.random().toString(36).substring(2, 9)}`;

        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            id: roomId,
            status: 'LOBBY',
            players: [],
            deck: [],
            discardPile: [],
            cutCard: null,
            turnIndex: 0,
            turnStage: 'DRAW'
          });
        }

        userRoom = rooms.get(roomId);
        userRoom.players.push({
          id: playerId,
          name: playerName,
          hand: [],
          hasDropped: false,
          turnsTaken: 0,
          ws
        });

        broadcastRoom(userRoom);
      }

      if (!userRoom) return;

      if (data.type === 'NEXT_HAND' && userRoom) {
        dealNextHand(userRoom);
        broadcastRoom(userRoom);
        return;
      }

      if (data.type === 'START_GAME' && userRoom.status === 'LOBBY') {
        const deck = createDeck();
        userRoom.players.forEach(p => {
          p.hand = deck.splice(0, 21);
          p.hasDropped = false;
          p.turnsTaken = 0;
        });

        userRoom.cutCard = deck.pop(); // Open Cut Joker immediately
        userRoom.discardPile = [deck.pop()];
        userRoom.deck = deck;
        userRoom.status = 'PLAYING';
        userRoom.turnIndex = 0;
        userRoom.turnStage = 'DRAW';

        broadcastRoom(userRoom);
      }

      const activePlayer = userRoom.players[userRoom.turnIndex];
      const isTurn = activePlayer && activePlayer.id === playerId;

      if (data.type === 'DRAW_STOCK' && isTurn && userRoom.turnStage === 'DRAW') {
        if (activePlayer.hand.length >= 22) return;
        if (userRoom.deck.length === 0) {
          // Recycle discard pile if stock runs dry
          const top = userRoom.discardPile.pop();
          userRoom.deck = userRoom.discardPile.reverse();
          userRoom.discardPile = [top];
        }
        activePlayer.hand.push(userRoom.deck.pop());
        userRoom.turnStage = 'DISCARD';
        userRoom.lastAction = 'DRAW_STOCK';
        broadcastRoom(userRoom);
      }

      if (data.type === 'DRAW_DISCARD' && isTurn && userRoom.turnStage === 'DRAW') {
        if (activePlayer.hand.length >= 22) return;
        if (userRoom.discardPile.length > 0) {
          activePlayer.hand.push(userRoom.discardPile.pop());
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
          userRoom.discardPile.push(discarded);
          activePlayer.turnsTaken++;
          userRoom.lastAction = `${activePlayer.name} discarded ${discarded.rank}${discarded.suit}`;
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

      if (data.type === 'NEXT_HAND' && userRoom.status === 'ROUND_OVER') {
        dealNextHand(userRoom);
        broadcastRoom(userRoom);
      }
    } catch (e) {
      console.error('Socket error:', e);
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (userRoom) {
      userRoom.players = userRoom.players.filter(p => p.id !== playerId);
      if (userRoom.players.length === 0) {
        rooms.delete(userRoom.id);
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