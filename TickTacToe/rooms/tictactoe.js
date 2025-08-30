const { Room } = require("colyseus");

class TicTacToeRoom extends Room {
  onCreate(options) {
    console.log(`Room created: ${this.roomId}`);

    this.setState({
      board: Array(9).fill(""),
      currentPlayer: "X",
      gameOver: false,
      winner: null,
      players: {},
      playerXTime: 0,
      playerOTime: 0,
      lastMoveTime: Date.now(),
    });

    // Handle player moves
    this.onMessage("move", (client, message) => {
      console.log(`Move received from ${client.sessionId}:`, message);
      const player = this.state.players[client.sessionId];
      if (player && player.symbol === this.state.currentPlayer) {
        this.makeMove(client, message.index);
      } else {
        console.warn("Invalid move attempt:", client.sessionId, message);
      }
    });

    // Handle game restart
    this.onMessage("restart", (client) => {
      console.log(`Restart requested by ${client.sessionId}`);
      if (this.state.gameOver) {
        this.resetGame();
      }
    });
  }

  // When a client joins
  onJoin(client, options) {
    console.log(`${client.sessionId} joined room ${this.roomId}`);

    // Assign player symbol
    const playerSymbol =
      Object.keys(this.state.players).length === 0 ? "X" : "O";

    this.state.players[client.sessionId] = {
      symbol: playerSymbol,
      sessionId: client.sessionId,
    };

    // Start timer for first player
    if (playerSymbol === "X") {
      this.state.lastMoveTime = Date.now();
    }

    console.log(`Assigned ${playerSymbol} to ${client.sessionId}`);
    console.log(`Players: ${JSON.stringify(this.state.players)}`);

    // Notify all clients about the new player
    this.broadcast("players", this.state.players);

    // If two players are present, start the game
    if (Object.keys(this.state.players).length === 2) {
      console.log("Game starting with two players");
      this.broadcast("start", { currentPlayer: "X" });
    }
  }

  // When a client leaves
  onLeave(client, consented) {
    console.log(`${client.sessionId} left room ${this.roomId}`);
    delete this.state.players[client.sessionId];
    this.broadcast("players", this.state.players);

    // End game if a player leaves
    this.state.gameOver = true;
    const remainingPlayer = Object.values(this.state.players)[0];
    this.state.winner = remainingPlayer ? remainingPlayer.symbol : null;

    console.log(`Game over. Winner: ${this.state.winner}`);
    this.broadcast("gameOver", { winner: this.state.winner });
  }

  // Make a move (rest of the methods remain the same as before)
  // ... [keep all existing makeMove, checkWin, checkDraw, resetGame methods]
}

module.exports = { TicTacToeRoom };
