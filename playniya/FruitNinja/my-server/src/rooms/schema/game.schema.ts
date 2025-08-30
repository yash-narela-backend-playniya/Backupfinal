// game.schema.ts
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export enum GameObjectType {
  FRUIT = "fruit",
  BOMB = "bomb",
  PARTICLE = "particle"
}

export enum FruitType {
  APPLE = "apple",
  BANANA = "banana",
  ORANGE = "orange",
  WATERMELON = "watermelon",
  STRAWBERRY = "strawberry"
}

export class Player extends Schema {
  @type("string") id: string;
  @type("string") name: string;
  @type("number") score: number = 0;
  @type("number") lives: number = 3;
  @type("boolean") isGameOver: boolean = false;
}

export class GameObject extends Schema {
  @type("string") id: string;
  @type("string") type: GameObjectType;
  @type("string") fruitType?: FruitType;
  @type("number") x: number;
  @type("number") y: number;
  @type("number") radius: number;
  @type("number") rotation: number = 0;
  @type("boolean") isSliced: boolean = false;
  @type("number") bodyId: number = -1; // Reference to MatterJS body
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type([GameObject]) objects = new ArraySchema<GameObject>();
  @type("boolean") isGameActive: boolean = false;
  @type("number") gameTime: number = 0;
  @type("string") roomName: string = "Fruit Ninja Arena";
}