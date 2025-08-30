// relay.js
const WebSocket = require("ws");
const colyseus = require("colyseus.js");

const COLYSEUS_ENDPOINT = "ws://localhost:2567"; // Colyseus server
const FRONTEND_PORT = 8000; // WebSocket port for frontend

const client = new colyseus.Client(COLYSEUS_ENDPOINT);
const frontendServer = new WebSocket.Server({ port: FRONTEND_PORT });
console.log(`🚀 WebSocket relay running at ws://localhost:${FRONTEND_PORT}`);

const playerMap = new Map(); // frontendSocket -> Colyseus room

frontendServer.on("connection", async (frontendSocket) => {
  console.log("🧑 Frontend client connected");

  frontendSocket.on("message", async (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      const { type, data } = parsed;

      if (type === "join") {
        const room = await client.joinOrCreate("bike_race", {
          name: data.name,
          uniqueId: data.uniqueId,
          matchOptionId: data.matchOptionId,
        });

        playerMap.set(frontendSocket, room);

        // Forward state changes
        room.onStateChange((state) => {
          frontendSocket.send(JSON.stringify({ type: "state", data: state }));
        });

        // Forward messages from server
        room.onMessage("*", (type, message) => {
          frontendSocket.send(JSON.stringify({ type, data: message }));
        });

        frontendSocket.send(JSON.stringify({ type: "joined", data: room.id }));
        console.log(`✅ Joined room ${room.id}`);
      } else if (["move", "accelerate", "brake"].includes(type)) {
        const room = playerMap.get(frontendSocket);
        if (room) {
          room.send(type, data);
        }
      }
    } catch (err) {
      console.error("❌ Error in relay:", err);
    }
  });

  frontendSocket.on("close", () => {
    console.log("❌ Frontend disconnected");
    const room = playerMap.get(frontendSocket);
    if (room) room.leave();
    playerMap.delete(frontendSocket);
  });
});
