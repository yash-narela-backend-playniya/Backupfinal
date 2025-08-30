const express = require("express");
const { createServer } = require("http");
const { Server } = require("colyseus");
const { monitor } = require("@colyseus/monitor");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { TicTacToeRoom } = require("./rooms/tictactoe");
const path = require("path");

// Serve static files from /public

const port = process.env.PORT || 2567;
const app = express();
const server = createServer(app);

// Use WebSocketTransport (Colyseus v0.15+ requirement)
const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
    pingInterval: 0, // For debugging
    pingMaxRetries: 5,
  }),
});

// ✅ DO NOT use gameServer.setSeatReservationTime (removed in v0.15+)
// Instead, set it per room inside your room constructor (optional)

// Register room handler
gameServer.define("tic-tac-toe", TicTacToeRoom);

// Attach monitoring panel
app.use("/colyseus", monitor());
app.use(express.static(path.join(__dirname, "public")));

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Tic Tac Toe Server is running");
});

// Start listening
gameServer.listen(port);
console.log(`Server is listening on port ${port}`);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down...");
  gameServer.gracefullyShutdown().then(() => process.exit(0));
});
