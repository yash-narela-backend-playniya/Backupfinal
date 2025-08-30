import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") uniqueId: string = "";
  @type("number") timeRemaining: number = 0;
}

export class TicTacToeAIState extends Schema {
  // Player identifiers
  @type("string") playerX: string = "";     // Human player session ID
  @type("string") playerO: string = "AI";   // AI identifier
  
  // Game state
  @type("string") currentTurn: string = ""; // Current player's session ID
  @type("string") winner: string = "";      // Winner's session ID
  @type("boolean") isDraw: boolean = false; // Draw status
  @type("string") gameStatus: string = "waiting"; // waiting, in-progress, finished
  
  // Game board (3x3 grid)
  @type(["string"]) board = new ArraySchema<string>(
    "", "", "", 
    "", "", "", 
    "", "", ""
  );
  
  // Player information
  @type({ map: Player }) players = new MapSchema<Player>();
  
  // AI configuration
  @type("string") difficulty: string = "medium"; // easy, medium, hard
  
  // Rematch tracking
  @type({ map: "boolean" }) rematchVotes = new MapSchema<boolean>();
  
  // Player class reference
  PlayerSchema = Player;
}



