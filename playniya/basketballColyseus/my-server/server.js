    const WebSocket = require('ws');
const colyseus = require('colyseus.js');

const COLYSEUS_ENDPOINT = 'ws://localhost:2567'; // Colyseus backend
const FRONTEND_PORT = 8000; // Frontend connection port

const client = new colyseus.Client(COLYSEUS_ENDPOINT);
const frontendServer = new WebSocket.Server({ port: FRONTEND_PORT });

console.log(`🚀 WebSocket relay running at ws://localhost:${FRONTEND_PORT}`);

const playerMap = new Map(); // Map frontend socket => room

frontendServer.on('connection', async (frontendSocket) => {
  console.log('🧑 Client connected to WebSocket relay');

  frontendSocket.on('message', async (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      const { type, data } = parsed;

      if (type === 'join') {
        const room = await client.joinOrCreate("arcade_basketball", {
          name: data.name || "Guest"
        });

        playerMap.set(frontendSocket, room);

        // Forward room state to frontend
        room.onStateChange((state) => {
          frontendSocket.send(JSON.stringify({ type: 'state', data: state }));
        });

        // Forward any room messages
        room.onMessage("*", (type, message) => {
          frontendSocket.send(JSON.stringify({ type, data: message }));
        });

        // Confirm join
        frontendSocket.send(JSON.stringify({ type: 'joined', data: room.id }));
        console.log(`✅ Player joined room ${room.id}`);
      }

      else if (type === 'joinById') {
        const room = await client.joinById(data.roomId);
        playerMap.set(frontendSocket, room);

        room.onStateChange((state) => {
          frontendSocket.send(JSON.stringify({ type: 'state', data: state }));
        });

        room.onMessage("*", (type, message) => {
          frontendSocket.send(JSON.stringify({ type, data: message }));
        });

        frontendSocket.send(JSON.stringify({ type: 'joined', data: room.id }));
        console.log(`✅ Player joined room by ID ${room.id}`);
      }

      else if (type === 'move') {
        const room = playerMap.get(frontendSocket);
        if (room) {
          room.send("move", { x: data.x });
        }
      }

      else if (type === 'shoot') {
        const room = playerMap.get(frontendSocket);
        if (room) {
          room.send("shoot", {
            angle: data.angle,
            power: data.power
          });
        }
      }

      else if (type === 'autoShoot') {
        const room = playerMap.get(frontendSocket);
        if (room) {
          room.send("autoShoot");
        }
      }

    } catch (err) {
      console.error('❌ Message error:', err);
    }
  });

  frontendSocket.on('close', () => {
    console.log('❌ Client disconnected');
    const room = playerMap.get(frontendSocket);
    if (room) room.leave();
    playerMap.delete(frontendSocket);
  });
});
