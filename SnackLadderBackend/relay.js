const WebSocket = require('ws');
const { Client } = require('colyseus.js');

const COLYSEUS_ENDPOINT = 'ws://198.168.1.204:2567';
const GATEWAY_PORT = 5002;

const server = new WebSocket.Server({ port: GATEWAY_PORT });
console.log(`🚀 SnakeLadder Gateway running on ws://localhost:${GATEWAY_PORT}`);

const clientMap = new Map(); // Map WebSocket => { client, room }

server.on('connection', (ws) => {
  console.log('🌐 Frontend connected to SnakeLadder gateway');

  ws.on('message', async (message) => {
    let parsed;
    try {
      parsed = JSON.parse(message.toString());
    } catch (err) {
      return sendError(ws, 'Invalid JSON');
    }

    const { type, data } = parsed;
    const clientData = clientMap.get(ws);

    try {
      switch (type) {
        case 'join_room':
          await handleJoinRoom(ws, data);
          break;

        case 'join_game':
          if (!clientData) return sendError(ws, 'Not in a room');
          clientData.room.send('join_game', {
            name: data.name,
            uniqueId: data.uniqueId,
          });
          break;

        case 'vote_mode':
          if (!clientData) return sendError(ws, 'Not in a room');
          if (!data.mode || (data.mode !== 'turn' && data.mode !== 'time')) {
            return sendError(ws, 'Mode must be "turn" or "time"');
          }
          clientData.room.send('vote_mode', {
            mode: data.mode,
          });
          break;

        case 'roll_dice':
          if (!clientData) return sendError(ws, 'Not in a room');
          clientData.room.send('rollDice', {
            pawnIndex: data.pawnIndex, // optional
          });
          break;

        case 'rematch_request':
          if (!clientData) return sendError(ws, 'Not in a room');
          clientData.room.send('rematch_request');
          break;

        case 'exit':
          await handleExit(ws);
          break;

        default:
          sendError(ws, 'Unknown message type');
      }
    } catch (err) {
      console.error('[SnakeLadder Gateway Error]', err);
      sendError(ws, err.message || 'Internal server error');
    }
  });

  ws.on('close', async () => {
    await handleExit(ws);
    console.log('❌ Frontend disconnected from SnakeLadder gateway');
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

function sendError(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'error', data: { message } }));
  }
}

async function handleJoinRoom(ws, data) {
  try {
    const client = new Client(COLYSEUS_ENDPOINT);

    // If mode is present, pass it, else leave undefined (mode is chosen after "join_game" and voting)
    const roomOptions = {
      name: data.name || 'Player',
      uniqueId: data.uniqueId,
      userId: data.userId,
      matchOptionId: data.matchOptionId,
      isPrivate: data.isPrivate || false,
      allowedUserIds: data.allowedUserIds || [],
      useBonus: data.useBonus || false,
    };

    // If your room requires mode on creation, pass it here.
    if (data.mode && (data.mode === "turn" || data.mode === "time")) {
      roomOptions.mode = data.mode;
    }

    // Connect to Colyseus room
    const room = await client.joinOrCreate('snake_ladder_room', roomOptions);

    clientMap.set(ws, { client, room });

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'joined',
          data: {
            roomId: room.roomId,
            sessionId: room.sessionId,
          },
        })
      );
    }

    setupRoomListeners(ws, room);
  } catch (err) {
    console.error('Failed to join or create room:', err);
    sendError(ws, 'Failed to join or create room: ' + err.message);
  }
}

function setupRoomListeners(ws, room) {
  // Forward state changes
  room.onStateChange((state) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'state-update', data: state }));
    }
  });

  // Forward all important room messages to client
  const messageTypes = [
    'player_ready',
    'player_joined',
    'player_left',
    'game_started',
    'game_ended',
    'dice_rolled',
    'pawn_moved',
    'ladder_climbed',
    'snake_bitten',
    'collision',
    'missed_move',
    'player_disqualified',
    'turn_changed',
    'mode_selected',
    'mode_vote_start',
    'mode_vote_update',
    'vote_received',
    'countdown-update',
    'game_restarted',
    'info',
    'error',
  ];

  messageTypes.forEach((msgType) => {
    room.onMessage(msgType, (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: msgType, data }));
      }
    });
  });

  room.onLeave((code) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'left', data: { code } }));
    }
  });
}

async function handleExit(ws) {
  const clientData = clientMap.get(ws);
  if (clientData && clientData.room) {
    try {
      await clientData.room.leave();
    } catch (err) {
      console.warn('⚠ Error leaving room:', err.message);
    }
  }

  clientMap.delete(ws);

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'left', data: { code: 1000 } }));
  }
}