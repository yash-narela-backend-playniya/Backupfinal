import { Room, Client } from "colyseus";
import { TicTacToeAIState, Player } from "../schema/TicTacRoomFree.State";
import { ArraySchema } from "@colyseus/schema";

export class TicTacToeAIRoom extends Room<TicTacToeAIState> {
  private aiDifficulty: "easy" | "medium" | "hard" = "medium";
  private aiMoveTimer: any;
  private playerSessionId: string = "";
  private aiSessionId: string = "AI";

  onCreate(options: any) {
    this.aiDifficulty = options.difficulty || "medium";

    this.setMetadata({
      isAIRoom: true,
      difficulty: this.aiDifficulty,
      createdAt: new Date().toISOString(),
    });

    this.maxClients = 1;

    // ✅ FIX: Correctly instantiate the schema state
    this.setState(new TicTacToeAIState());

    // Game configuration for free play
    this.state.gameStatus = "waiting";
    this.state.betAmount = 0;
    this.state.winAmount = 0;
    this.state.matchOptionId = "free";
    this.state.minPlayer = 1;
    this.state.playerCount = 1;
    this.state.timePerPlayer = 0;

    this.onMessage("makeMove", (client, message) => {
      if (this.state.gameStatus !== "in-progress") return;
      this.handlePlayerMove(client.sessionId, message.position);
    });

    this.onMessage("rematch", () => {
      if (this.state.gameStatus === "finished") {
        this.resetGame();
      }
    });

    this.onMessage("changeDifficulty", (_, message) => {
      if (["easy", "medium", "hard"].includes(message.difficulty)) {
        this.aiDifficulty = message.difficulty;
        this.setMetadata({ difficulty: this.aiDifficulty });
      }
    });
  }

  onJoin(client: Client) {
    this.playerSessionId = client.sessionId;

    // Create human player
    const player = new Player();
    player.uniqueId = "player";
    this.state.players.set(this.playerSessionId, player);

    // Create AI player
    const aiPlayer = new Player();
    aiPlayer.uniqueId = "AI";
    this.state.players.set(this.aiSessionId, aiPlayer);

    this.state.playerX = this.playerSessionId;
    this.state.playerO = this.aiSessionId;
    this.state.currentTurn = this.playerSessionId;

    this.startGame();
  }

  onLeave(client: Client) {
    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId);
    }
    this.disconnect();
  }

  private startGame() {
    this.state.gameStatus = "in-progress";
    this.state.winner = "";
    this.state.isDraw = false;
    this.state.board = new ArraySchema<string>(
      "", "", "", "", "", "", "", "", ""
    );
  }

  private handlePlayerMove(sessionId: string, position: number) {
    if (this.state.currentTurn !== sessionId) return;
    if (position < 0 || position > 8 || this.state.board[position] !== "") return;

    this.state.board[position] = "X";
    this.checkGameStatus();

    if (this.state.gameStatus === "in-progress") {
      this.state.currentTurn = this.aiSessionId;
      this.scheduleAIMove();
    }
  }

  private scheduleAIMove() {
    const delay =
      this.aiDifficulty === "easy" ? 1000 :
      this.aiDifficulty === "medium" ? 700 : 400;

    this.aiMoveTimer = this.clock.setTimeout(() => {
      this.makeAIMove();
    }, delay);
  }

  private makeAIMove() {
    if (this.state.gameStatus !== "in-progress") return;

    const position = this.calculateAIMove();
    this.state.board[position] = "O";

    this.checkGameStatus();

    if (this.state.gameStatus === "in-progress") {
      this.state.currentTurn = this.playerSessionId;
    }
  }

  private calculateAIMove(): number {
    const board = [...this.state.board];

    const win = this.findWinningMove(board, "O");
    if (win !== -1) return win;

    const block = this.findWinningMove(board, "X");
    if (block !== -1) return block;

    switch (this.aiDifficulty) {
      case "easy": return this.makeRandomMove(board);
      case "medium": return this.makeStrategicMove(board);
      case "hard": return this.findOptimalMove(board);
    }
  }

  private findWinningMove(board: string[], player: "X" | "O"): number {
    const wins = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];

    for (const [a, b, c] of wins) {
      if (board[a] === player && board[b] === player && board[c] === "") return c;
      if (board[a] === player && board[c] === player && board[b] === "") return b;
      if (board[b] === player && board[c] === player && board[a] === "") return a;
    }

    return -1;
  }

  private makeStrategicMove(board: string[]): number {
    const moves = [4, 0, 2, 6, 8, 1, 3, 5, 7];
    return moves.find(i => board[i] === "")!;
  }

  private findOptimalMove(board: string[]): number {
    let best = -Infinity;
    let move = -1;

    for (let i = 0; i < 9; i++) {
      if (board[i] !== "") continue;
      board[i] = "O";
      const score = this.minimax(board, 0, false);
      board[i] = "";
      if (score > best) {
        best = score;
        move = i;
      }
    }

    return move;
  }

  private minimax(board: string[], depth: number, isMax: boolean): number {
    const result = this.getGameResult(board);
    if (result) return result === "O" ? 10 - depth : result === "X" ? depth - 10 : 0;

    if (isMax) {
      let best = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] !== "") continue;
        board[i] = "O";
        best = Math.max(best, this.minimax(board, depth + 1, false));
        board[i] = "";
      }
      return best;
    } else {
      let best = Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] !== "") continue;
        board[i] = "X";
        best = Math.min(best, this.minimax(board, depth + 1, true));
        board[i] = "";
      }
      return best;
    }
  }

  private getGameResult(board: string[]): "X" | "O" | "draw" | null {
    const wins = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];

    for (const [a, b, c] of wins) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a] as "X" | "O";
    }

    return board.includes("") ? null : "draw";
  }

  private makeRandomMove(board: string[]): number {
    const available = board.map((val, i) => val === "" ? i : -1).filter(i => i !== -1);
    return available[Math.floor(Math.random() * available.length)];
  }

  private checkGameStatus() {
    if (this.checkWin("X")) {
      this.endGame(this.playerSessionId);
    } else if (this.checkWin("O")) {
      this.endGame(this.aiSessionId);
    } else if (this.checkDraw()) {
      this.state.isDraw = true;
      this.endGame();
    }
  }

  private checkWin(symbol: string): boolean {
    const wins = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    return wins.some(pattern => pattern.every(i => this.state.board[i] === symbol));
  }

  private checkDraw(): boolean {
    return this.state.board.every(cell => cell !== "");
  }

  private endGame(winner?: string) {
    if (winner) this.state.winner = winner;
    this.state.gameStatus = "finished";
    if (this.aiMoveTimer) this.aiMoveTimer.clear();
  }

  private resetGame() {
    this.state.board = new ArraySchema<string>("", "", "", "", "", "", "", "", "");
    this.state.winner = "";
    this.state.isDraw = false;
    this.state.gameStatus = "in-progress";
    this.state.currentTurn = this.playerSessionId;
  }
}
