import {
  Schema,
  MapSchema,
  ArraySchema,
  type,
  SetSchema,
} from "@colyseus/schema";
import { Room, Client, Delayed } from "colyseus";
import { nanoid } from "nanoid";
import mongoose from "mongoose";
import KafkaWalletService from "../kafka/walletKafka";
import MatchOption from "../models/MatchOption.model";

// --- SCHEMA ---
class Vector2 extends Schema {
  @type("number") x: number = 0;
  @type("number") z: number = 0;
}
class Car extends Schema {
  @type("string") uniqueId: string = "";
  @type("string") id: string = "";
  @type(Vector2) position = new Vector2();
  @type(Vector2) velocity = new Vector2();
  @type("number") angle: number = 0;
  @type("number") steering: number = 0;
  @type("number") throttle: number = 0;
  @type("number") brake: number = 0;
  @type("number") nitro: number = 100;
  @type("boolean") nitroActive: boolean = false;
  @type("number") score: number = 0;
  @type("number") laps: number = 0;
  @type("number") lastCheckpointIndex: number = -1;
  @type("number") health: number = 100;
  @type("number") lives: number = 3;
  @type("boolean") respawning: boolean = false;
  @type("number") respawnEndTime: number = 0;
  @type("number") distanceCovered: number = 0;
  @type("string") name: string = "";
  @type("number") speedPercent: number = 0;
}

class Checkpoint extends Schema {
  @type(Vector2) position = new Vector2();
}
class NitroPickup extends Schema {
  @type(Vector2) position = new Vector2();
  @type("boolean") active: boolean = true;
  @type("number") respawnAt: number = 0;
}
class GameState extends Schema {
  @type({ map: Car }) cars = new MapSchema<Car>();
  @type([Checkpoint]) checkpoints = new ArraySchema<Checkpoint>();
  @type([NitroPickup]) nitros = new ArraySchema<NitroPickup>();
  @type("number") gameTime: number = 120; // 2 minutes = 120 seconds
  @type("string") winner: string = "";
  @type([Vector2]) path = new ArraySchema<Vector2>();
  @type({ map: "boolean" }) playReady = new MapSchema<boolean>();
  @type("boolean") countdownStarted: boolean = false;
  @type("number") countdown: number = 3;
  @type("string") gamestatus: string = "waiting"; // "waiting" | "countdown" | "playing" | "ended"
}

// --- GAME CONSTANTS ---
const TRACK_LENGTH = 9000;
const TRACK_WIDTH = 60;
const CHECKPOINT_RADIUS = 10;
const NITRO_RADIUS = 8;
const NITRO_REFILL = 60;
const NITRO_MAX = 100;
const NITRO_BOOST = 16;
const NITRO_CONSUMPTION = 28;
const NITRO_PICKUP_RESPAWN = 5000;
const CAR_LENGTH = 4.5;
const CAR_WIDTH = 2;
const MAX_SPEED = 44;
const ACCEL = 13;
const BRAKE_DECEL = 22;
const FRICTION = 0.984;
const LATERAL_GRIP = 0.82;
const MAX_STEER = Math.PI / 2.2;
const STEER_SPEED = 2.1;
const WALL_SLOWDOWN = 0.35;
const RESPAWN_DURATION = 2000;
const GAME_DURATION_SECONDS = 120;

export class CarRaceRoom extends Room<GameState> {
  minPlayer: number = 2;
  playerCount: number = 4;
  countdownInterval: any;
  matchTimer: Delayed;
  updateInterval: Delayed;
  betAmount: number = 0;
  winAmount: number = 0;
  matchOptionId: string = "";

  async onAuth(client: Client, options: any): Promise<any> {
    const uniqueId = options.uniqueId;
    const useBonus = options.useBonus;
    try {
      if (this.betAmount > 0) {
        const walletResponse =
          await KafkaWalletService.sendWalletRequestAndWait(
            uniqueId,
            Number(this.betAmount),
            useBonus,
            this.roomId
          );
        if (!walletResponse.success) {
          throw new Error(walletResponse.message || "Wallet deduction failed.");
        }
      }
    } catch (err) {
      console.error("Wallet Error:", err);
      throw new Error("Unable to join: Wallet validation failed.");
    }
    return true;
  }

  async onCreate(options: any) {
    if (!KafkaWalletService.initialized) {
      await KafkaWalletService.initialize();
    }
    if (options.matchOptionId) {
      const matchoptionId = new mongoose.Types.ObjectId(options.matchOptionId);
      const matchOption = await MatchOption.findById(matchoptionId);
      if (!matchOption) throw new Error("MatchOption not found");
      const { numberOfPlayers, winningAmount, bettingAmount, minimumPlayers } =
        matchOption;
      this.playerCount = numberOfPlayers;
      this.minPlayer = minimumPlayers;
      this.betAmount = bettingAmount;
      this.winAmount = winningAmount;
      this.matchOptionId = options.matchOptionId;
    } else {
      this.playerCount = options.playerCount || 4;
      this.minPlayer = options.minPlayer || 2;
    }

    this.setState(new GameState());
    this.createSShapePath();
    this.createCheckpoints();
    this.placeNitroPickups();
    this.maxClients = this.playerCount;

    this.onMessage("playReady", (client) => {
      this.state.playReady.set(client.sessionId, true);
      if (
        this.state.playReady.size === this.maxClients &&
        Array.from(this.state.playReady.values()).every((v) => v) &&
        !this.state.countdownStarted
      ) {
        this.state.countdownStarted = true;
        this.startCountdown();
      }
    });

    this.onMessage("controls", (client: Client, message: any) => {
      if (this.state.gamestatus !== "playing") return;
      const car = this.state.cars.get(client.sessionId);
      if (!car || car.respawning) return;
      car.throttle = message.throttle || 0;
      car.brake = message.brake || 0;
      car.steering = message.steering || 0;
      car.nitroActive = !!message.nitro;
    });
  }

  async onJoin(client: Client, options: any) {
    const idx = this.clients.length - 1;
    const car = new Car();
    car.id = client.sessionId;
    car.uniqueId = options.uniqueId || car.id;
    car.name = options.name || `Player${this.clients.length}`;
    car.lives = 3;
    car.position = this.startPosition(idx);
    car.velocity = new Vector2();
    car.angle = 0;
    car.nitro = 100;
    car.laps = 0;
    car.score = 0;
    car.lastCheckpointIndex = -1;
    car.distanceCovered = 0;
    car.speedPercent = 0;
    this.state.cars.set(client.sessionId, car);
    this.state.playReady.set(client.sessionId, false);

    client.send("playReady", { countdown: this.state.countdown });

    this.broadcast("ready_state", {
      ready: Array.from(this.state.playReady.entries()).map(([id, v]) => ({
        id,
        ready: v,
      })),
    });

    client.send("track_path", {
      path: this.state.path.map((p) => ({ x: p.x, z: p.z })),
      checkpoints: this.state.checkpoints.map((c) => ({
        x: c.position.x,
        z: c.position.z,
      })),
    });
  }

  async onLeave(client: Client, consented: boolean) {
    this.state.cars.delete(client.sessionId);
    this.state.playReady.delete(client.sessionId);
    this.broadcast("ready_state", {
      ready: Array.from(this.state.playReady.entries()).map(([id, v]) => ({
        id,
        ready: v,
      })),
    });
    if (
      this.state.gamestatus === "playing" &&
      this.state.cars.size < this.minPlayer
    ) {
      this.endGame(true);
    }
  }

  private startCountdown() {
    this.state.gamestatus = "countdown";
    this.state.countdown = 3;
    this.broadcast("countdown", { countdown: this.state.countdown });
    this.countdownInterval = setInterval(() => {
      this.state.countdown--;
      this.broadcast("countdown", { countdown: this.state.countdown });
      if (this.state.countdown <= 0) {
        clearInterval(this.countdownInterval);
        this.startMatch();
      }
    }, 1000);
  }

  private startMatch() {
    this.state.gamestatus = "playing";
    (this.state as any).gameStartTime = Date.now();
    this.state.gameTime = GAME_DURATION_SECONDS; // seconds countdown from 120

    // Update gameTime every second; count down
    this.clock.setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - (this.state as any).gameStartTime) / 1000
      );
      this.state.gameTime = Math.max(0, GAME_DURATION_SECONDS - elapsed);
      if (this.state.gameTime <= 0) {
        this.endGame(false);
      }
    }, 1000);

    // End game after 2 minutes
    this.matchTimer = this.clock.setTimeout(
      () => this.endGame(false),
      GAME_DURATION_SECONDS * 1000
    );
    this.updateInterval = this.clock.setInterval(() => this.updateGame(16), 16);

    this.broadcast("match_started");
    this.broadcast("track_path", {
      path: this.state.path.map((p) => ({ x: p.x, z: p.z })),
      checkpoints: this.state.checkpoints.map((c) => ({
        x: c.position.x,
        z: c.position.z,
      })),
    });
  }

  private endGame(aborted: boolean) {
    this.state.gamestatus = "ended";
    if (this.updateInterval) this.updateInterval.clear();
    const cars = Array.from(this.state.cars.values());
    cars.sort(
      (a, b) =>
        b.score - a.score ||
        b.laps - a.laps ||
        b.distanceCovered - a.distanceCovered
    );
    const winner = cars[0];
    this.state.winner = winner?.id || "";
    this.broadcast("game_over", {
      winner: winner?.id || "",
      top3: cars.slice(0, 3).map((car, i) => ({
        id: car.id,
        name: car.name,
        position: i + 1,
        laps: car.laps,
        score: Math.floor(car.score),
        distance: Math.floor(car.distanceCovered),
        lives: car.lives,
      })),
    });
    if (winner && winner.uniqueId && this.winAmount > 0) {
      const users = Array.from(this.state.cars.values()).map(
        (car) => car.uniqueId
      );
      KafkaWalletService.sendGameEndRequest(
        users,
        winner.uniqueId,
        "carrace",
        this.roomId,
        this.winAmount
      );
    }
    this.clock.setTimeout(() => this.disconnect(), 10000);
  }

  private createSShapePath() {
    const points: { x: number; z: number }[] = [];
    points.push({ x: 0, z: 0 });
    points.push({ x: 1000, z: 30 });
    points.push({ x: 2000, z: -40 });
    points.push({ x: 3000, z: 40 });
    points.push({ x: 4000, z: -35 });
    points.push({ x: 5000, z: 25 });
    points.push({ x: 6000, z: -30 });
    points.push({ x: 7000, z: 35 });
    points.push({ x: 8000, z: 0 });
    points.push({ x: 9000, z: 0 });
    let step = 50;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const dx = p1.x - p0.x;
      const dz = p1.z - p0.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const nSteps = Math.ceil(dist / step);
      for (let t = 0; t < nSteps; t++) {
        const alpha = t / nSteps;
        const px = p0.x + dx * alpha;
        const pz = p0.z + dz * alpha;
        const v = new Vector2();
        v.x = px;
        v.z = pz;
        this.state.path.push(v);
      }
    }
    const last = points[points.length - 1];
    const vlast = new Vector2();
    vlast.x = last.x;
    vlast.z = last.z;
    this.state.path.push(vlast);
  }

  private createCheckpoints() {
    const numCP = 12;
    const step = Math.floor(this.state.path.length / numCP);
    for (let i = 0; i < numCP; i++) {
      const idx = i * step;
      const pt = this.state.path[idx];
      const cp = new Checkpoint();
      cp.position = new Vector2();
      cp.position.x = pt.x;
      cp.position.z = pt.z;
      this.state.checkpoints.push(cp);
    }
  }

  private placeNitroPickups() {
    const spots = [2, 5, 8];
    for (let i = 0; i < spots.length; i++) {
      const idx = Math.floor((spots[i] / 12) * this.state.path.length);
      const pt = this.state.path[idx];
      const n = new NitroPickup();
      n.position = new Vector2();
      n.position.x = pt.x;
      n.position.z = pt.z;
      n.active = true;
      n.respawnAt = 0;
      this.state.nitros.push(n);
    }
  }

  private startPosition(idx: number): Vector2 {
    const pos = new Vector2();
    pos.x = 5 + (idx % 4) * (CAR_LENGTH + 3);
    pos.z = -12 + Math.floor(idx / 4) * (CAR_WIDTH + 2);
    return pos;
  }

  private updateGame(deltaTime: number) {
    const dt = deltaTime / 1000;
    this.updateNitroPickups();
    this.updateCars(dt);
    this.checkCarCollisions();
    this.checkPickups();
    this.checkCheckpointProgress();
    // No broadcastState here; all state changes are auto-synced by Colyseus
  }

  private updateCars(dt: number) {
    this.state.cars.forEach((car) => {
      if (car.respawning && Date.now() < car.respawnEndTime) {
        car.throttle = 0;
        car.brake = 0;
        car.steering = 0;
        car.velocity.x = 0;
        car.velocity.z = 0;
        car.speedPercent = 0;
        return;
      }
      if (car.respawning && Date.now() >= car.respawnEndTime) {
        car.respawning = false;
      }
      car.steering = Math.max(-1, Math.min(1, car.steering));
      const steerAngle = car.steering * MAX_STEER;
      const spd = Math.sqrt(car.velocity.x ** 2 + car.velocity.z ** 2);
      if (Math.abs(car.throttle) > 0.01 || spd > 1) {
        car.angle += steerAngle * dt * STEER_SPEED;
      }
      const forward = { x: Math.cos(car.angle), z: Math.sin(car.angle) };
      let accel = 0;
      if (car.throttle > 0) accel += ACCEL * car.throttle;
      if (car.nitroActive && car.nitro > 0) {
        accel += NITRO_BOOST;
        car.nitro -= NITRO_CONSUMPTION * dt;
        if (car.nitro < 0) car.nitro = 0;
      }
      if (car.brake > 0) accel -= BRAKE_DECEL * car.brake;
      car.velocity.x += forward.x * accel * dt;
      car.velocity.z += forward.z * accel * dt;
      car.velocity.x *= Math.pow(FRICTION, dt * 60);
      car.velocity.z *= Math.pow(FRICTION, dt * 60);
      const v_forward = car.velocity.x * forward.x + car.velocity.z * forward.z;
      const v_side = -car.velocity.x * forward.z + car.velocity.z * forward.x;
      const new_v_side = v_side * Math.pow(LATERAL_GRIP, dt * 60);
      car.velocity.x = v_forward * forward.x - new_v_side * forward.z;
      car.velocity.z = v_forward * forward.z + new_v_side * forward.x;
      const speed = Math.sqrt(car.velocity.x ** 2 + car.velocity.z ** 2);
      const maxSpeed = MAX_SPEED + (car.nitroActive ? NITRO_BOOST : 0);
      if (speed > maxSpeed) {
        car.velocity.x = (car.velocity.x / speed) * maxSpeed;
        car.velocity.z = (car.velocity.z / speed) * maxSpeed;
      }
      let hitWall = false;
      if (Math.abs(car.position.z) > TRACK_WIDTH / 2) {
        car.velocity.x *= WALL_SLOWDOWN;
        car.velocity.z *= -WALL_SLOWDOWN;
        car.position.z = Math.sign(car.position.z) * (TRACK_WIDTH / 2 - 1);
        hitWall = true;
      }
      car.position.x += car.velocity.x * dt;
      car.position.z += car.velocity.z * dt;
      const deltaDist =
        Math.sqrt(car.velocity.x ** 2 + car.velocity.z ** 2) * dt;
      car.distanceCovered += deltaDist;
      car.score += deltaDist * 10;
      car.speedPercent = Math.floor((speed / (MAX_SPEED + NITRO_BOOST)) * 100);
      if (hitWall) {
        car.speedPercent = Math.floor(car.speedPercent * 0.4);
      }
    });
  }

  private updateNitroPickups() {
    const now = Date.now();
    this.state.nitros.forEach((n) => {
      if (!n.active && n.respawnAt && now > n.respawnAt) {
        n.active = true;
        n.respawnAt = 0;
      }
    });
  }

  private checkCarCollisions() {
    const arr = Array.from(this.state.cars.values());
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i],
          b = arr[j];
        if (a.respawning || b.respawning) continue;
        const dx = a.position.x - b.position.x;
        const dz = a.position.z - b.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < CAR_LENGTH) {
          this.respawnCar(a);
          this.respawnCar(b);
        }
      }
    }
  }

  private respawnCar(car: Car) {
    if (car.lives > 1) {
      car.lives -= 1;
      const idx = Math.floor(Math.random() * this.playerCount);
      car.position = this.startPosition(idx);
      car.velocity.x = 0;
      car.velocity.z = 0;
      car.health = 100;
      car.nitro = 100;
      car.angle = 0;
      car.respawning = true;
      car.respawnEndTime = Date.now() + RESPAWN_DURATION;
    } else {
      car.lives = 0;
      car.health = 0;
      car.respawning = true;
      car.respawnEndTime = Date.now() + RESPAWN_DURATION;
    }
  }

  private checkPickups() {
    this.state.cars.forEach((car) => {
      if (car.lives === 0) return;
      this.state.nitros.forEach((n) => {
        if (!n.active) return;
        const dx = car.position.x - n.position.x;
        const dz = car.position.z - n.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < NITRO_RADIUS) {
          car.nitro = Math.min(NITRO_MAX, car.nitro + NITRO_REFILL);
          n.active = false;
          n.respawnAt = Date.now() + NITRO_PICKUP_RESPAWN;
        }
      });
    });
  }

  private checkCheckpointProgress() {
    const checkpoints = this.state.checkpoints;
    this.state.cars.forEach((car) => {
      if (car.lives === 0) return;
      const nextIndex = (car.lastCheckpointIndex + 1) % checkpoints.length;
      const cp = checkpoints[nextIndex];
      const dx = car.position.x - cp.position.x;
      const dz = car.position.z - cp.position.z;
      if (Math.sqrt(dx * dx + dz * dz) < CHECKPOINT_RADIUS) {
        car.lastCheckpointIndex = nextIndex;
        if (nextIndex === 0) {
          car.laps++;
          car.score += 500;
          this.broadcast("lap_completed", {
            id: car.id,
            name: car.name,
            laps: car.laps,
          });
        }
        this.broadcast("checkpoint_progress", {
          carId: car.id,
          checkpointIndex: nextIndex,
          laps: car.laps,
        });
      }
    });
  }
}