// CarRaceRoom.ts
import { Room, Client, Delayed } from "colyseus";
import { nanoid } from "nanoid";
import {
  GameState,
  Car,
  Checkpoint,
  Particle,
  Vector2,
} from  "./schema/CarRacingState"

// Game Constants   
const TRACK_WIDTH = 2000;
const TRACK_HEIGHT = 1000;
const CAR_WIDTH = 50;
const CAR_HEIGHT = 30;
const CHECKPOINT_RADIUS = 50;
const MAX_SPEED = 15;
const FRICTION = 0.96;
const DRAG = 0.99;
const TRACTION = 0.2;

export class CarRaceRoom extends Room<GameState> {
  maxClients = 8;
  updateInterval: Delayed;
  walls: { x1: number; y1: number; x2: number; y2: number }[] = [];

  private calculateVelocity(car: Car, dt: number) {
    const rad = (car.angle * Math.PI) / 180;
    const acceleration = car.throttle * 15 * dt;

    car.velocity.x += Math.cos(rad) * acceleration;
    car.velocity.y += Math.sin(rad) * acceleration;

    return Math.sqrt(car.velocity.x ** 2 + car.velocity.y ** 2);
  }

  private applyTraction(car: Car, speed: number, dt: number) {
    const rad = (car.angle * Math.PI) / 180;
    if (speed > 0) {
      const direction = Math.atan2(car.velocity.y, car.velocity.x);
      const drift = Math.sin(direction - rad);
      car.velocity.x -= drift * Math.cos(rad) * TRACTION * dt * 60;
      car.velocity.y -= drift * Math.sin(rad) * TRACTION * dt * 60;
    }
  }

  private limitSpeed(car: Car, speed: number) {
    if (speed > MAX_SPEED) {
      car.velocity.x = (car.velocity.x / speed) * MAX_SPEED;
      car.velocity.y = (car.velocity.y / speed) * MAX_SPEED;
    }
  }

  private updateCarPosition(car: Car, dt: number) {
    car.x += car.velocity.x;
    car.y += car.velocity.y;
  }

  // Collision detection
  private detectCarCollisions() {
    const cars = Array.from(this.state.cars.values());
    
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const carA = cars[i];
        const carB = cars[j];
        const dx = carA.x - carB.x;
        const dy = carA.y - carB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < CAR_WIDTH) {
          this.resolveCollision(carA, carB);
        }
      }
    }
  }

  private resolveCollision(carA: Car, carB: Car) {
    const dx = carA.x - carB.x;
    const dy = carA.y - carB.y;
    const angle = Math.atan2(dy, dx);

    const speedA = Math.sqrt(carA.velocity.x ** 2 + carA.velocity.y ** 2);
    const speedB = Math.sqrt(carB.velocity.x ** 2 + carB.velocity.y ** 2);
    const relativeSpeed = Math.abs(speedA - speedB);
    const impact = relativeSpeed * 5;
    const carAIsInFront = carA.x > carB.x;

    if (impact <= 10) {
      const bumpAmount = 1;
      if (carAIsInFront) {
        carA.velocity.x += bumpAmount;
        carB.velocity.x -= bumpAmount;
      } else {
        carB.velocity.x += bumpAmount;
        carA.velocity.x -= bumpAmount;
      }
    }

    if (impact > 10) {
      this.applyDamage(carA, impact);
      this.applyDamage(carB, impact);
      const explosionX = (carA.x + carB.x) / 2;
      const explosionY = (carA.y + carB.y) / 2;
      this.createExplosion(explosionX, explosionY);
    }
  }
 
  private applyDamage(car: Car, amount: number) {
    car.health -= amount;
    if (car.health <= 0) {
      this.respawnCar(car);
    }
  }

  private createExplosion(x: number, y: number) {
    for (let i = 0; i < 20; i++) {
      const particle = new Particle();
      particle.id = nanoid();
      particle.type = "explosion";
      particle.x = x;
      particle.y = y;
      particle.velocity = new Vector2();
      particle.velocity.x = (Math.random() - 0.5) * 10;
      particle.velocity.y = (Math.random() - 0.5) * 10;
      particle.ttl = 500 + Math.random() * 500;
      this.state.particles.push(particle);
    }
  }

  private respawnCar(car: Car) {
    car.x = 300 + Math.random() * 100;
    car.y = 300 + Math.random() * 100;
    car.velocity.x = 0;
    car.velocity.y = 0;
    car.health = 100;
    car.angle = 0;
    this.createExplosion(car.x, car.y);
  }

  // Room lifecycle
  onCreate() {
    this.setState(new GameState());
    this.setMetadata({ gameStartTime: Date.now() });
    this.createRaceTrack();  

        // New game state initialization
    this.gamePhase = "waiting";
    this.countdownValue = 0;


   this.onMessage("controls", (client: Client, message: any) => {





    const car = this.state.cars.get(client.sessionId);
    if (!car) return;
    
    car.throttle = message.throttle;
    car.steering = message.steering;

    this.send(client, "controls", {
        throttle: car.throttle,
        steering: car.steering,
    })
    


});

    this.clock.setInterval(() => {
      this.state.gameTime = Date.now() - this.metadata.gameStartTime;
    }, 1000);

    this.clock.setTimeout(() => this.endGame(), 3 * 60 * 1000);
    this.updateInterval = this.clock.setInterval(() => this.updateGame(16), 16);
  }

  private createRaceTrack() {
    const checkpointPositions = [
      { x: 300, y: 300 },
      { x: 1500, y: 300 },
      { x: 1700, y: 500 },
      { x: 1700, y: 800 },
      { x: 1500, y: 900 },
      { x: 300, y: 900 },
      { x: 100, y: 700 },
      { x: 100, y: 500 },
    ];

    checkpointPositions.forEach((pos) => {
      const cp = new Checkpoint();
      cp.x = pos.x;
      cp.y = pos.y;
      this.state.checkpoints.push(cp);
    });

    this.walls = [
      { x1: 0, y1: 0, x2: TRACK_WIDTH, y2: 0 },
      { x1: TRACK_WIDTH, y1: 0, x2: TRACK_WIDTH, y2: TRACK_HEIGHT },
      { x1: TRACK_WIDTH, y1: TRACK_HEIGHT, x2: 0, y2: TRACK_HEIGHT },
      { x1: 0, y1: TRACK_HEIGHT, x2: 0, y2: 0 },
      { x1: 400, y1: 400, x2: 1600, y2: 400 },
      { x1: 1600, y1: 400, x2: 1600, y2: 800 },
      { x1: 1600, y1: 800, x2: 400, y2: 800 },
      { x1: 400, y1: 800, x2: 400, y2: 400 },
    ];
  }

  onJoin(client: Client, options: any) {
    const car = new Car();
    car.id = client.sessionId;
    car.name = options.name || `Player${this.clients.length}`;

    const startX = 300;
    const startY = 300;
    const spacing = 50;
    const index = this.clients.length - 1;
    
    car.x = startX;
    car.y = startY + index * spacing;
    car.angle = 0;
    this.state.cars.set(client.sessionId, car);
  }







  private updateGame(deltaTime: number) {
    const dt = deltaTime / 1000;

    this.updateCars(dt);
    this.updateParticles(dt);
    this.detectCarCollisions();
    this.checkCheckpointProgress();
    this.broadcastState();
  }

  private updateCars(dt: number) {
    this.state.cars.forEach((car) => {
      const speed = this.calculateVelocity(car, dt);
      this.applyTraction(car, speed, dt);
      car.velocity.x *= FRICTION;
      car.velocity.y *= FRICTION;
      car.velocity.x *= Math.pow(DRAG, dt * 60);
      car.velocity.y *= Math.pow(DRAG, dt * 60);
      this.limitSpeed(car, speed);
      this.updateCarPosition(car, dt);
      this.enforceTrackBoundaries(car);
      car.score += speed * dt * 0.1;
    });
  }

  private updateParticles(dt: number) {
    for (let i = this.state.particles.length - 1; i >= 0; i--) {
      const p = this.state.particles[i];
      p.x += p.velocity.x * dt;
      p.y += p.velocity.y * dt;
      p.ttl -= dt;

      if (p.ttl <= 0) {
        this.state.particles.splice(i, 1);
      }
    }
  }

  private enforceTrackBoundaries(car: Car) {
    const halfWidth = CAR_WIDTH / 2;
    const halfHeight = CAR_HEIGHT / 2;

    if (car.x < halfWidth) car.x = halfWidth;
    if (car.x > TRACK_WIDTH - halfWidth) car.x = TRACK_WIDTH - halfWidth;
    if (car.y < halfHeight) car.y = halfHeight;
    if (car.y > TRACK_HEIGHT - halfHeight) car.y = TRACK_HEIGHT - halfHeight;
  }

  private checkCheckpointProgress() {
    const checkpoints = this.state.checkpoints;

    this.state.cars.forEach((car) => {
      const nextIndex = (car.lastCheckpointIndex + 1) % checkpoints.length;
      const checkpoint = checkpoints[nextIndex];
      const dx = car.x - checkpoint.x;
      const dy = car.y - checkpoint.y;

      if (Math.sqrt(dx * dx + dy * dy) < CHECKPOINT_RADIUS) {
        car.lastCheckpointIndex = nextIndex;

        if (nextIndex === 0) {
          car.laps++;
          car.score += 1000;
          this.broadcast("lap_completed", {
            id: car.id,
            name: car.name,
            laps: car.laps,
          });
        }
      }
    });
  }

  private broadcastState() {
    this.broadcast("game_state", {
      time: this.state.gameTime,
      cars: Array.from(this.state.cars.values()).map((car) => ({
        id: car.id,
        x: car.x,
        y: car.y,
        angle: car.angle,
        velocity: { x: car.velocity.x, y: car.velocity.y },
        health: car.health,
        laps: car.laps,
        lastCheckpoint: car.lastCheckpointIndex,
      })),
      particles: this.state.particles.map((p) => ({
        id: p.id,
        type: p.type,
        x: p.x,
        y: p.y,
      })),
    });

    this.updateLeaderboard();
  }

  private updateLeaderboard() {
    const ranking = [...this.state.cars.values()].sort(
      (a, b) =>
        b.laps - a.laps ||
        b.lastCheckpointIndex - a.lastCheckpointIndex ||
        b.score - a.score
    );

    this.broadcast(
      "leaderboard",
      ranking.map((car, i) => ({
        id: car.id,
        name: car.name,
        position: i + 1,
        laps: car.laps,
        score: Math.floor(car.score),
        health: car.health,
      }))
    );
  }

  private endGame() {
    const results = [...this.state.cars.values()].sort(
      (a, b) =>
        b.laps - a.laps ||
        b.lastCheckpointIndex - a.lastCheckpointIndex ||
        b.score - a.score
    );

    this.broadcast(
      "game_over",
      results.map((car, i) => ({
        id: car.id,
        name: car.name,
        position: i + 1,
        laps: car.laps,
        score: Math.floor(car.score),
      }))
    );

    this.disconnect();
  }

  onLeave(client: Client) {
    this.state.cars.delete(client.sessionId);
  }
}