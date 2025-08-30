import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";

export class ObstacleSchema extends Schema {
  @type("number") id: number;
  @type("number") lane: number;
  @type("number") y: number;
  @type(["string"]) passedByPlayers: string[] = [];

  constructor(id: number, lane: number, y: number) {
    super();
    this.id = id;
    this.lane = lane;
    this.y = y;
  }
}

export class PlayerSchema extends Schema {
  @type("string") sessionId: string;
  @type("number") lane: number = 1;
  @type("number") score: number = 0;
  @type("number") speed: number = 0;
  @type("boolean") isAccelerating: boolean = false;
  @type("boolean") isRespawning: boolean = false;
  @type("number") respawnTimer: number = 0;
  @type("number") respawnCount: number = 0;
  @type("boolean") finished: boolean = false;

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
  }
}

export class GameState extends Schema {
  @type("string") gamePhase: "waiting" | "countdown" | "racing" | "finished" = "waiting";
  @type("number") countdownTimer: number = 0;
  @type("number") gameTimer: number = 0;
  @type("number") gameSpeed: number = 0;
  @type("number") obstacleSpawnTimer: number = 0;
  @type("number") nextObstacleId: number = 1;
  @type("number") screenHeight: number = 800;
  @type("number") screenWidth: number = 300;
  @type("number") carWidth: number = 60;
  @type("number") carHeight: number = 100;
  @type("number") obstacleWidth: number = 60;
  @type("number") obstacleHeight: number = 60;
  @type("number") betAmount: number = 0;
  @type("number") winAmount: number = 0;
  @type("number") minPlayers: number = 2;
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type([ObstacleSchema]) obstacles = new ArraySchema<ObstacleSchema>();
}

// Game constants
export const GAME_DURATION = 60; // 60 seconds
export const COUNTDOWN_DURATION = 3; // 3 seconds
export const RESPAWN_TIME = 2; // 2 seconds
export const BASE_SPEED = 200; // pixels per second
export const SPEED_INCREMENT = 5; // speed increase per second
export const MAX_SPEED = 400; // max speed
export const ACCELERATION = 300; // acceleration rate
export const OBSTACLE_SPAWN_INTERVAL = 1; // seconds between obstacles