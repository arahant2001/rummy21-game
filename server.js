import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDeck, resolveJokerRoles, calculateMaal, calculateDeadwood, validateShow, CONFIG } from './rules.js';

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
    turnPlayerId: room.players[room.turnIndex]?.id || null,
    turnPlayerName: room.players[room.turnIndex]?.name || '',
    turnStage: room.turnStage,
    cutCard: room.cutCard,
    roles: room.cutCard ? resolveJokerRoles(room.cutCard) : null,
    topDiscard: room.discardPile[room.discardPile.length - 1] || null,
    // Keep a short, ordered history so clients can review older discards without
    // confusing them with the current top discard.
    discardHistory: room.discardPile.slice(Math.max(0, room.discardPile.length - 9), Math.max(0, room.discardPile.length - 1)),
    deckCount: room.deck.length,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      hasDropped: p.hasDropped
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

function advanceTurn(room) {
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
  room.players.forEach(p => {
    p.hand = deck.splice(0, 21);
    p.hasDropped = false;
    p.dropPenalty = 0;
    p.turnsTaken = 0;
  });

  room.cutCard = deck.pop();
  room.discardPile = [deck.pop()];
  room.deck = deck;
  room.status = 'PLAYING';
  room.turnIndex = 0;
  room.turnStage = 'DRAW';
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
          userRoom.discardPile.push(discarded);
          activePlayer.turnsTaken++;
          userRoom.lastAction = 'DISCARD';
          advanceTurn(userRoom);
          broadcastRoom(userRoom);
        }
      }

      if (data.type === 'DROP' && isTurn && userRoom.turnStage === 'DRAW') {
        activePlayer.hasDropped = true;
        const penalty = activePlayer.turnsTaken === 0 ? CONFIG.firstDrop : CONFIG.middleDrop;
        activePlayer.dropPenalty = penalty;

        advanceTurn(userRoom);
        broadcastRoom(userRoom);
      }

      if (data.type === 'FORFEIT_DECLARATION' && isTurn && userRoom.turnStage === 'DISCARD') {
        activePlayer.hasDropped = true;
        activePlayer.dropPenalty = 100;
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
          activePlayer.dropPenalty = 100;
          advanceTurn(userRoom);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'SHOW_INVALID', reason: validation.reason, penalty: 100 }));
          }
          broadcastRoom(userRoom);
          return;
        }

        const idx = finalIdx;
        if (idx !== -1) {
          const [finalDiscard] = activePlayer.hand.splice(idx, 1);
          userRoom.discardPile.push(finalDiscard);
        }

        userRoom.status = 'ROUND_OVER';
        userRoom.turnStage = 'WAITING';
        const winnerMaal = calculateMaal(activePlayer.hand, userRoom.cutCard);

        const results = userRoom.players.map(p => {
          if (p.id === activePlayer.id) {
            return {
              name: p.name,
              status: 'WINNER',
              points: 0,
              maalCollected: winnerMaal.total,
              net: `Won + collects ${winnerMaal.total} Maal from each loser`
            };
          }
          if (p.hasDropped) {
            const totalPay = p.dropPenalty + winnerMaal.total;
            return {
              name: p.name,
              status: 'DROPPED',
              points: totalPay,
              dropPenalty: p.dropPenalty,
              maalOwed: winnerMaal.total,
              net: `Pays ${totalPay} pts (${p.dropPenalty} drop penalty + ${winnerMaal.total} winner Maal)`
            };
          }
          const deadwood = calculateDeadwood(p.hand, userRoom.cutCard);
          const totalPay = deadwood + winnerMaal.total;
          return {
            name: p.name,
            status: 'LOST',
            deadwood,
            maalOwed: winnerMaal.total,
            net: `Pays ${totalPay} pts (${deadwood} deadwood + ${winnerMaal.total} winner maal)`
          };
        });

        userRoom.players.forEach(p => {
          if (p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(JSON.stringify({
              type: 'SHOW_RESULT',
              winnerName: activePlayer.name,
              winnerMaal,
              results,
              revealedHands: userRoom.players.map(p => ({
                name: p.name,
                id: p.id,
                hasDropped: p.hasDropped,
                hand: p.hand
              }))
            }));
          }
        });

        // Show the settlement briefly, then automatically start the next hand
        // without sending anyone back to the lobby.
        setTimeout(() => {
          if (userRoom && rooms.get(userRoom.id) === userRoom && userRoom.players.length) {
            dealNextHand(userRoom);
            broadcastRoom(userRoom);
          }
        }, 3500);
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