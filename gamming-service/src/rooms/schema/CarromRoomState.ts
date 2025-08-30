import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export enum PieceType {
  WHITE = "white",
  BLACK = "black",
  QUEEN = "queen",
  STRIKER = "striker",
}

export const FRICTION = 0.99;
export const BOARD_SIZE = 600;
export const POCKET_RADIUS = 25;
export const PIECE_RADIUS = 12;
export const STRIKER_RADIUS = 15;
export const MAX_POWER = 35;
export const MIN_VELOCITY = 0.4;
export const WALL_BOUNCE = 0.95;
export const TURN_TIME = 10;
export const COUNTDOWN_TIME = 3;

export const POCKET_MULTIPLIERS = [1.0, 1.2, 1.5, 2.0];

export const POCKETS = [
  { x: 30, y: 30 },
  { x: 570, y: 30 },
  { x: 30, y: 570 },
  { x: 570, y: 570 },
];

export class CarromPiece extends Schema {
  @type("string") id: string;
  @type("string") type: PieceType;
  @type("number") x: number;
  @type("number") y: number;
  @type("number") vx: number = 0;
  @type("number") vy: number = 0;
  @type("number") radius: number;
  @type("boolean") isActive: boolean = true;
  @type("boolean") isPocketed: boolean = false;

  constructor(id: string, type: PieceType, x: number, y: number) {
    super();
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.radius = type === PieceType.STRIKER ? STRIKER_RADIUS : PIECE_RADIUS;
  }
}

export class Player extends Schema {
  @type("string") sessionId: string;
  @type("string") name: string;
  @type("number") score: number = 0;
  @type("number") position: number; // 0-3 (clockwise positions)
  @type("boolean") isActive: boolean = false;
  @type("number") timeRemaining: number = TURN_TIME;
  @type("number") whitesPocketed: number = 0;
  @type("number") blacksPocketed: number = 0;
  @type("boolean") hasQueen: boolean = false;
  @type("boolean") queenCovered: boolean = false;
  @type("number") lives: number = 3;
  @type("boolean") disqualified: boolean = false;
  @type("string") uniqueId: string = "";
  @type("boolean") isReady: boolean = false;

  constructor(
    sessionId: string,
    name: string,
    position: number,
    uniqueId: string
  ) {
    super();
    this.sessionId = sessionId;
    this.name = name;
    this.position = position;
    this.uniqueId = uniqueId;
  }
}

export class GameEvent extends Schema {
  @type("string") type: string;
  @type("string") playerId: string;
  @type("string") pieceType?: string;
  @type("number") points?: number;
  @type("string") message?: string;
  @type("number") timestamp: number;

  constructor() {
    super();
    this.timestamp = Date.now();
  }
}

export class CarromGameState extends Schema {
  @type("number") currentPlayerIndex: number = 0;
  @type("number") gameTimeRemaining: number = 180;
  @type("boolean") isGameStarted: boolean = false;
  @type("boolean") isGameOver: boolean = false;
  @type("string") gameStatus: string = "waiting"; // waiting, playing, ended
  @type("number") turnTimeRemaining: number = TURN_TIME;
  @type("boolean") isPaused: boolean = false;
  @type("string") winner?: string;
  @type("number") totalPlayers: number = 0;
  @type("string") matchOptionId: string = "";
  @type("number") minPlayer: number = 2;
  @type("number") betAmount: number = 0;
  @type("number") winAmount: number = 0;

  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: CarromPiece }) pieces = new MapSchema<CarromPiece>();
  @type([GameEvent]) events = new ArraySchema<GameEvent>();
  @type({ map: "boolean" }) playReady = new MapSchema<boolean>();
}
