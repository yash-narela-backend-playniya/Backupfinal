import {
  Schema,
  MapSchema,
  ArraySchema,
  type,
  SetSchema,
} from "@colyseus/schema";
import { Room, Client, Delayed } from "colyseus";
import { nanoid } from "nanoid";

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
  @type("number") angle: number = 0; // radians, car heading
  @type("number") steering: number = 0; // -1(left) ... 1(right)
  @type("number") throttle: number = 0; // 0...1
  @type("number") brake: number = 0; // 0...1
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
  @type("number") speed: number = 0;
  @type("number") lastValidX: number = 0;
  @type("number") lastValidZ: number = 0;
}

class Checkpoint extends Schema {
  @type(Vector2) position = new Vector2();
  @type("number") index: number = 0;
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
  @type("number") gameTime: number = 0;
  @type("string") winner: string = "";
  @type("number") gameEndTime: number = 0;
}

// --- GAME CONSTANTS ---
const GAME_DURATION = 2 * 60 * 1000; // 2 minutes
const TRACK_WIDTH = 80;
const CHECKPOINT_RADIUS = 25;
const NITRO_RADIUS = 15;
const NITRO_REFILL = 40;
const NITRO_MAX = 100;
const NITRO_BOOST_MULTIPLIER = 1.5;
const NITRO_CONSUMPTION = 30;
const NITRO_PICKUP_RESPAWN = 8000; // ms
const CAR_LENGTH = 30;
const CAR_WIDTH = 16;
const MAX_SPEED = 6;
const NITRO_MAX_SPEED = 9;
const ACCEL = 0.15;
const BRAKE_DECEL = 0.3;
const FRICTION = 0.02;
const STEER_SPEED = 0.08;
const WALL_COLLISION_SLOWDOWN = 0.3;
const RESPAWN_DURATION = 2000;
const POINTS_PER_METER = 10;
const LAP_BONUS_POINTS = 1000;
const NITRO_REGEN_RATE = 0.3;

// S-shaped track path (scaled for better gameplay)
const TRACK_PATH = [
  { x: 100, z: 300 },
  { x: 200, z: 200 },
  { x: 350, z: 150 },
  { x: 500, z: 100 },
  { x: 650, z: 120 },
  { x: 750, z: 200 },
  { x: 780, z: 350 },
  { x: 750, z: 500 },
  { x: 650, z: 550 },
  { x: 500, z: 580 },
  { x: 350, z: 550 },
  { x: 200, z: 500 },
  { x: 150, z: 400 },
  { x: 100, z: 300 }
];

// --- TRACK UTILITIES ---
class TrackUtils {
  static trackBoundaries = TrackUtils.createTrackBoundaries();

  static createTrackBoundaries() {
    const innerTrack = [];
    const outerTrack = [];

    for (let i = 0; i < TRACK_PATH.length; i++) {
      const current = TRACK_PATH[i];
      const next = TRACK_PATH[(i + 1) % TRACK_PATH.length];
      const prev = TRACK_PATH[i === 0 ? TRACK_PATH.length - 1 : i - 1];

      // Calculate perpendicular vector for track width
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      const perpX = -dz / length;
      const perpZ = dx / length;

      innerTrack.push({
        x: current.x + perpX * (TRACK_WIDTH / 2),
        z: current.z + perpZ * (TRACK_WIDTH / 2)
      });

      outerTrack.push({
        x: current.x - perpX * (TRACK_WIDTH / 2),
        z: current.z - perpZ * (TRACK_WIDTH / 2)
      });
    }

    return { inner: innerTrack, outer: outerTrack };
  }

  static isPointInTrack(x: number, z: number): boolean {
    const isInsideOuter = this.isPointInPolygon(x, z, this.trackBoundaries.outer);
    const isInsideInner = this.isPointInPolygon(x, z, this.trackBoundaries.inner);
    return isInsideOuter && !isInsideInner;
  }

  static isPointInPolygon(x: number, z: number, polygon: any[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const zi = polygon[i].z;
      const xj = polygon[j].x;
      const zj = polygon[j].z;
      
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  static getClosestTrackPoint(x: number, z: number): { x: number, z: number } {
    let minDistance = Infinity;
    let closestPoint = TRACK_PATH[0];

    for (let i = 0; i < TRACK_PATH.length; i++) {
      const point = TRACK_PATH[i];
      const distance = Math.sqrt((x - point.x) ** 2 + (z - point.z) ** 2);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    }

    return closestPoint;
  }

  static getTrackDirection(x: number, z: number): number {
    const closest = this.getClosestTrackPoint(x, z);
    let closestIndex = 0;
    
    for (let i = 0; i < TRACK_PATH.length; i++) {
      if (TRACK_PATH[i].x === closest.x && TRACK_PATH[i].z === closest.z) {
        closestIndex = i;
        break;
      }
    }

    const nextPoint = TRACK_PATH[(closestIndex + 1) % TRACK_PATH.length];
    return Math.atan2(nextPoint.z - closest.z, nextPoint.x - closest.x);
  }
}

// --- MAIN ROOM ---
export class CarRaceRoom extends Room<GameState> {
  minPlayer: number = 1;
  playerCount: number = 8;
  gamePhase: "waiting" | "countdown" | "playing" | "ended" = "waiting";
  countdownTimer: Delayed;
  matchTimer: Delayed;
  updateInterval: Delayed;
  gameStartTime: number = 0;

  async onAuth(client: Client, options: any): Promise<any> {
    return true;
  }

  async onCreate(options: any) {
    this.playerCount = options.playerCount || 8;
    this.minPlayer = options.minPlayer || 1;
    this.setState(new GameState());
    this.createCheckpoints();
    this.placeNitroPickups();

    this.maxClients = this.playerCount;

    // Handle input messages
    this.onMessage("input", (client: Client, message: any) => {
      if (this.gamePhase !== "playing") return;
      const car = this.state.cars.get(client.sessionId);
      if (!car || car.respawning) return;

      // Convert frontend input to backend format
      let steering = 0;
      let throttle = 0;
      let brake = 0;
      let nitro = false;

      if (message.left) steering = -1;
      if (message.right) steering = 1;
      if (message.accelerate) throttle = 1;
      if (message.brake) brake = 1;
      if (message.nitro) nitro = true;

      car.steering = steering;
      car.throttle = throttle;
      car.brake = brake;
      car.nitroActive = nitro;
    });

    // Legacy controls message support
    this.onMessage("controls", (client: Client, message: any) => {
      if (this.gamePhase !== "playing") return;
      const car = this.state.cars.get(client.sessionId);
      if (!car || car.respawning) return;
      car.throttle = message.throttle || 0;
      car.brake = message.brake || 0;
      car.steering = message.steering || 0;
      car.nitroActive = !!message.nitro;
    });
  }

  onJoin(client: Client, options: any) {
    const idx = this.clients.length - 1;
    const car = new Car();
    car.id = client.sessionId;
    car.uniqueId = options.uniqueId || car.id;
    car.name = options.name || `Player${this.clients.length}`;
    car.lives = 3;
    
    // Set starting position
    const startPos = this.getStartPosition(idx);
    car.position.x = startPos.x;
    car.position.z = startPos.z;
    car.lastValidX = startPos.x;
    car.lastValidZ = startPos.z;
    
    car.velocity = new Vector2();
    car.angle = 0;
    car.nitro = 100;
    car.laps = 0;
    car.score = 0;
    car.lastCheckpointIndex = -1;
    car.distanceCovered = 0;
    car.speed = 0;
    
    this.state.cars.set(client.sessionId, car);

    if (this.state.cars.size >= this.minPlayer && this.gamePhase === "waiting") {
      this.startCountdown();
    }
  }

  onLeave(client: Client, consented: boolean) {
    this.state.cars.delete(client.sessionId);
    if (this.gamePhase === "playing" && this.state.cars.size < this.minPlayer) {
      this.endGame(true);
    }
  }

 private getStartPosition(idx: number): { x: number, z: number } {
  const startPoint = TRACK_PATH[0];
  const nextPoint = TRACK_PATH[1];

  // Direction vector of the track
  const dx = nextPoint.x - startPoint.x;
  const dz = nextPoint.z - startPoint.z;
  const length = Math.sqrt(dx * dx + dz * dz);

  // Perpendicular unit vector to place cars side-by-side
  const perpX = -dz / length;
  const perpZ = dx / length;

  // Space between cars
  const spacing = 25;

  // Shift from center (e.g., -1.5, -0.5, 0.5, 1.5 for 4 cars)
  const offset = (idx - (TOTAL_PLAYERS - 1) / 2) * spacing;

  return {
    x: startPoint.x + perpX * offset,
    z: startPoint.z + perpZ * offset
  };
}


  private startCountdown() {
    this.gamePhase = "countdown";
    this.broadcast("countdown_start", { countdown: 3 });
    this.countdownTimer = this.clock.setTimeout(() => this.startMatch(), 3000);
  }

  private startMatch() {
    this.gamePhase = "playing";
    this.gameStartTime = Date.now();
    this.state.gameTime = 0;
    this.state.gameEndTime = this.gameStartTime + GAME_DURATION;
    
    this.broadcast("match_started");
    
    // Game timer
    this.clock.setInterval(() => {
      this.state.gameTime = Date.now() - this.gameStartTime;
    }, 1000);
    
    // End game after 2 minutes
    this.matchTimer = this.clock.setTimeout(() => this.endGame(false), GAME_DURATION);
    
    // Game update loop (60 FPS)
    this.updateInterval = this.clock.setInterval(() => this.updateGame(16), 16);
  }

  private endGame(aborted: boolean) {
    this.gamePhase = "ended";
    if (this.updateInterval) this.updateInterval.clear();
    if (this.matchTimer) this.matchTimer.clear();
    
    const cars = Array.from(this.state.cars.values());
    
    // Sort by: 1. Score (highest), 2. Distance (highest), 3. Laps (highest)
    cars.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.distanceCovered !== b.distanceCovered) return b.distanceCovered - a.distanceCovered;
      return b.laps - a.laps;
    });
    
    const winner = cars[0];
    this.state.winner = winner?.id || "";
    
    this.broadcast("game_over", {
      winner: winner?.id || "",
      aborted,
      rankings: cars.map((car, i) => ({
        id: car.id,
        name: car.name,
        position: i + 1,
        laps: car.laps,
        score: Math.floor(car.score),
        distance: Math.floor(car.distanceCovered),
        lives: car.lives,
      })),
    });
    
    this.clock.setTimeout(() => this.disconnect(), 10000);
  }

  private createCheckpoints() {
    // Create checkpoints at every 3rd point along the track
    const checkpointIndices = [0, 3, 6, 9, 12];
    
    checkpointIndices.forEach((idx, i) => {
      const point = TRACK_PATH[idx % TRACK_PATH.length];
      const cp = new Checkpoint();
      cp.position.x = point.x;
      cp.position.z = point.z;
      cp.index = i;
      this.state.checkpoints.push(cp);
    });
  }

  private placeNitroPickups() {
    // Place nitro pickups at strategic points
    const nitroSpots = [
      { x: 350, z: 150 },  // Curve 1
      { x: 750, z: 350 },  // Curve 2
      { x: 350, z: 550 },  // Curve 3
    ];
    
    nitroSpots.forEach((pos) => {
      const n = new NitroPickup();
      n.position.x = pos.x;
      n.position.z = pos.z;
      n.active = true;
      n.respawnAt = 0;
      this.state.nitros.push(n);
    });
  }

  private updateGame(deltaTime: number) {
    const dt = deltaTime / 1000;
    this.updateNitroPickups();
    this.updateCars(dt);
    this.checkCarCollisions();
    this.checkPickups();
    this.checkCheckpointProgress();
    this.broadcastState();
  }

  private updateCars(dt: number) {
    this.state.cars.forEach((car) => {
      // Skip if respawning
      if (car.respawning) {
        if (Date.now() >= car.respawnEndTime) {
          car.respawning = false;
        } else {
          car.throttle = 0;
          car.brake = 0;
          car.steering = 0;
          car.velocity.x = 0;
          car.velocity.z = 0;
          return;
        }
      }

      // Get track direction for forward movement restriction
      const trackDirection = TrackUtils.getTrackDirection(car.position.x, car.position.z);
      const carDirection = car.angle;
      
      // Calculate angle difference (-π to π)
      let angleDiff = carDirection - trackDirection;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      
      // Restrict reverse movement (more than 90 degrees off track direction)
      const isReverse = Math.abs(angleDiff) > Math.PI / 2;
      
      // --- STEERING ---
      car.steering = Math.max(-1, Math.min(1, car.steering));
      const currentSpeed = Math.sqrt(car.velocity.x ** 2 + car.velocity.z ** 2);
      
      if (Math.abs(car.steering) > 0.01 && (Math.abs(car.throttle) > 0.01 || currentSpeed > 0.1)) {
        const steerInfluence = Math.max(0.3, currentSpeed / MAX_SPEED);
        car.angle += car.steering * STEER_SPEED * steerInfluence * dt * 60;
      }

      // --- ACCELERATION ---
      const forward = { x: Math.cos(car.angle), z: Math.sin(car.angle) };
      let acceleration = 0;
      
      if (car.throttle > 0 && !isReverse) {
        acceleration += ACCEL * car.throttle;
      }
      
      if (car.brake > 0) {
        acceleration -= BRAKE_DECEL * car.brake;
      }
      
      // --- NITRO ---
      if (car.nitroActive && car.nitro > 0 && !isReverse) {
        acceleration *= NITRO_BOOST_MULTIPLIER;
        car.nitro = Math.max(0, car.nitro - NITRO_CONSUMPTION * dt);
      }
      
      // Apply acceleration
      car.velocity.x += forward.x * acceleration * dt;
      car.velocity.z += forward.z * acceleration * dt;

      // --- FRICTION ---
      car.velocity.x *= Math.max(0, 1 - FRICTION);
      car.velocity.z *= Math.max(0, 1 - FRICTION);

      // --- SPEED LIMITING ---
      const speed = Math.sqrt(car.velocity.x ** 2 + car.velocity.z ** 2);
      const maxSpeed = car.nitroActive && car.nitro > 0 ? NITRO_MAX_SPEED : MAX_SPEED;
      
      if (speed > maxSpeed) {
        car.velocity.x = (car.velocity.x / speed) * maxSpeed;
        car.velocity.z = (car.velocity.z / speed) * maxSpeed;
      }

      // --- POSITION UPDATE ---
      const newX = car.position.x + car.velocity.x * dt * 60;
      const newZ = car.position.z + car.velocity.z * dt * 60;

      // --- TRACK BOUNDARY CHECK ---
      if (TrackUtils.isPointInTrack(newX, newZ)) {
        car.position.x = newX;
        car.position.z = newZ;
        car.lastValidX = newX;
        car.lastValidZ = newZ;
      } else {
        // Collision with track boundary
        car.velocity.x *= WALL_COLLISION_SLOWDOWN;
        car.velocity.z *= WALL_COLLISION_SLOWDOWN;
        
        // Push car back toward track center
        const closestPoint = TrackUtils.getClosestTrackPoint(car.position.x, car.position.z);
        const pushX = (closestPoint.x - car.position.x) * 0.1;
        const pushZ = (closestPoint.z - car.position.z) * 0.1;
        car.position.x += pushX;
        car.position.z += pushZ;
      }

      // --- SCORING AND DISTANCE ---
      const deltaDistance = Math.sqrt(car.velocity.x ** 2 + car.velocity.z ** 2) * dt * 60;
      car.distanceCovered += deltaDistance;
      car.score += deltaDistance * POINTS_PER_METER;
      car.speed = Math.sqrt(car.velocity.x ** 2 + car.velocity.z ** 2);

      // --- NITRO REGENERATION ---
      if (!car.nitroActive && car.nitro < NITRO_MAX) {
        car.nitro = Math.min(NITRO_MAX, car.nitro + NITRO_REGEN_RATE * dt * 60);
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
        const a = arr[i];
        const b = arr[j];
        if (a.respawning || b.respawning) continue;
        
        const dx = a.position.x - b.position.x;
        const dz = a.position.z - b.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < CAR_LENGTH) {
          // Reduce speed on collision
          a.velocity.x *= 0.5;
          a.velocity.z *= 0.5;
          b.velocity.x *= 0.5;
          b.velocity.z *= 0.5;
          
          // Push cars apart
          const pushX = (dx / dist) * (CAR_LENGTH - dist) * 0.5;
          const pushZ = (dz / dist) * (CAR_LENGTH - dist) * 0.5;
          
          a.position.x += pushX;
          a.position.z += pushZ;
          b.position.x -= pushX;
          b.position.z -= pushZ;
        }
      }
    }
  }

  private checkPickups() {
    this.state.cars.forEach((car) => {
      if (car.lives === 0 || car.respawning) return;
      
      this.state.nitros.forEach((n) => {
        if (!n.active) return;
        
        const dx = car.position.x - n.position.x;
        const dz = car.position.z - n.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < NITRO_RADIUS) {
          car.nitro = Math.min(NITRO_MAX, car.nitro + NITRO_REFILL);
          n.active = false;
          n.respawnAt = Date.now() + NITRO_PICKUP_RESPAWN;
          
          this.broadcast("nitro_pickup", {
            playerId: car.id,
            playerName: car.name,
          });
        }
      });
    });
  }

  private checkCheckpointProgress() {
    const checkpoints = this.state.checkpoints;
    this.state.cars.forEach((car) => {
      if (car.lives === 0 || car.respawning) return;
      
      const nextIndex = (car.lastCheckpointIndex + 1) % checkpoints.length;
      const cp = checkpoints[nextIndex];
      
      const dx = car.position.x - cp.position.x;
      const dz = car.position.z - cp.position.z;
      
      if (Math.sqrt(dx * dx + dz * dz) < CHECKPOINT_RADIUS) {
        car.lastCheckpointIndex = nextIndex;
        
        if (nextIndex === 0) {
          car.laps++;
          car.score += LAP_BONUS_POINTS;
          
          this.broadcast("lap_completed", {
            id: car.id,
            name: car.name,
            laps: car.laps,
            score: Math.floor(car.score),
          });
        } else {
          this.broadcast("checkpoint_passed", {
            id: car.id,
            name: car.name,
            checkpoint: nextIndex,
          });
        }
      }
    });
  }

  private broadcastState() {
    const carsArr = Array.from(this.state.cars.values());
    
    // Sort for leaderboard
    const sortedCars = [...carsArr].sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.distanceCovered !== b.distanceCovered) return b.distanceCovered - a.distanceCovered;
      return b.laps - a.laps;
    });

    this.broadcast("state_update", {
      state: {
        cars: Object.fromEntries(
          carsArr.map((car) => [
            car.id,
            {
              id: car.id,
              x: car.position.x,
              y: car.position.z, // Frontend uses y for z
              rotation: car.angle,
              speed: car.speed,
              nitro: car.nitro,
              nitroActive: car.nitroActive,
              score: Math.floor(car.score),
              laps: car.laps,
              lives: car.lives,
              distanceCovered: Math.floor(car.distanceCovered),
              respawning: car.respawning,
              name: car.name,
            },
          ])
        ),
      },
      gameTime: this.state.gameTime,
      timeLeft: Math.max(0, GAME_DURATION - this.state.gameTime),
      leaderboard: sortedCars.slice(0, 5).map((car, i) => ({
        position: i + 1,
        id: car.id,
        name: car.name,
        score: Math.floor(car.score),
        laps: car.laps,
        distance: Math.floor(car.distanceCovered),
      })),
      nitros: this.state.nitros.map((n) => ({
        x: n.position.x,
        y: n.position.z,
        active: n.active,
      })),
    });
  } 
}   