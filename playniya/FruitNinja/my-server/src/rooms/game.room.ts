// game.room.ts
import { Room, Client } from "colyseus";
import * as Matter from "matter-js";
import { GameState, Player, GameObject, GameObjectType, FruitType } from "./schema/game.schema";

export class FruitNinjaRoom extends Room<GameState> {
  private engine: Matter.Engine;
  private world: Matter.World;
  private spawnTimer: number;
  private gameTimer: number;
  private objectMap = new Map<number, Matter.Body>(); // Use body ID as key
  private nextObjectId = 0;

  // Game configuration
  private readonly WORLD_WIDTH = 800;
  private readonly WORLD_HEIGHT = 600;
  private readonly SPAWN_INTERVAL = 1000;
  private readonly GAME_DURATION = 60;
  private readonly FRUIT_RADIUS = 25;
  private readonly BOMB_RADIUS = 30;
  private readonly PARTICLE_COUNT = 4;
  private readonly PARTICLE_RADIUS = 10;

  onCreate(options: any) {
    this.setState(new GameState());
    this.setupPhysics();
    this.setupEventHandlers();

    // Set room name if provided
    if (options.roomName) {
      this.state.roomName = options.roomName;
    }

    this.state.isGameActive = true;
    this.startGameTimer();
    this.startSpawnTimer();

    this.setSimulationInterval((delta) => this.update(delta));
  }

  private setupPhysics() {
    this.engine = Matter.Engine.create({ 
      gravity: { x: 0, y: 0.8 },
      timing: { timeScale: 1.5 }
    });
    this.world = this.engine.world;

    // Create invisible walls
    const walls = [
      Matter.Bodies.rectangle(this.WORLD_WIDTH/2, -10, this.WORLD_WIDTH, 20, { isStatic: true }),
      Matter.Bodies.rectangle(-10, this.WORLD_HEIGHT/2, 20, this.WORLD_HEIGHT, { isStatic: true }),
      Matter.Bodies.rectangle(this.WORLD_WIDTH+10, this.WORLD_HEIGHT/2, 20, this.WORLD_HEIGHT, { isStatic: true })
    ];
    Matter.World.add(this.world, walls);
  }

  private setupEventHandlers() {
    this.onMessage("slice", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.isGameOver) return;
      
      this.handleSlice(
        client.sessionId, 
        message.start, 
        message.end
      );
    });

    this.onMessage("restart", (client) => {
      this.resetPlayer(client.sessionId);
    });
  }

  private startGameTimer() {
    this.state.gameTime = this.GAME_DURATION;
    this.gameTimer = this.clock.setInterval(() => {
      if (--this.state.gameTime <= 0) {
        this.endGame();
      }
    }, 1000).id;
  }

  private startSpawnTimer() {
    this.spawnTimer = this.clock.setInterval(() => {
      if (this.state.isGameActive) {
        this.spawnRandomObject();
      }
    }, this.SPAWN_INTERVAL).id;
  }

  private spawnRandomObject() {
    const objectTypes = [
      GameObjectType.FRUIT, 
      GameObjectType.FRUIT,
      GameObjectType.FRUIT,
      GameObjectType.BOMB
    ];
    
    const type = objectTypes[Math.floor(Math.random() * objectTypes.length)];
    const fruitTypes = Object.values(FruitType);
    
    const x = Math.random() * (this.WORLD_WIDTH - 100) + 50;
    const force = {
      x: (Math.random() - 0.5) * 0.02,
      y: -0.03 - Math.random() * 0.02
    };

    if (type === GameObjectType.FRUIT) {
      const fruitType = fruitTypes[Math.floor(Math.random() * fruitTypes.length)];
      this.spawnFruit(x, fruitType, force);
    } else {
      this.spawnBomb(x, force);
    }
  }

  private spawnFruit(x: number, fruitType: FruitType, force: { x: number, y: number }) {
    const id = `obj_${this.nextObjectId++}`;
    const radius = this.FRUIT_RADIUS;
    
    const body = Matter.Bodies.circle(x, this.WORLD_HEIGHT + 50, radius, {
      restitution: 0.8,
      friction: 0.001,
      render: { visible: false },
      label: id
    });
    
    Matter.Body.applyForce(body, body.position, force);
    Matter.World.add(this.world, body);
    
    const gameObj = new GameObject();
    gameObj.id = id;
    gameObj.type = GameObjectType.FRUIT;
    gameObj.fruitType = fruitType;
    gameObj.x = body.position.x;
    gameObj.y = body.position.y;
    gameObj.radius = radius;
    gameObj.bodyId = body.id; // Store body reference
    
    this.state.objects.push(gameObj);
    this.objectMap.set(body.id, body);
  }

  private spawnBomb(x: number, force: { x: number, y: number }) {
    const id = `obj_${this.nextObjectId++}`;
    const radius = this.BOMB_RADIUS;
    
    const body = Matter.Bodies.circle(x, this.WORLD_HEIGHT + 50, radius, {
      restitution: 0.7,
      friction: 0.01,
      render: { visible: false },
      label: id
    });
    
    Matter.Body.applyForce(body, body.position, force);
    Matter.World.add(this.world, body);
    
    const gameObj = new GameObject();
    gameObj.id = id;
    gameObj.type = GameObjectType.BOMB;
    gameObj.x = body.position.x;
    gameObj.y = body.position.y;
    gameObj.radius = radius;
    gameObj.bodyId = body.id; // Store body reference
    
    this.state.objects.push(gameObj);
    this.objectMap.set(body.id, body);
  }

  private createParticles(originalObj: GameObject) {
    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      const id = `part_${this.nextObjectId++}`;
      const radius = this.PARTICLE_RADIUS;
      
      const body = Matter.Bodies.circle(
        originalObj.x,
        originalObj.y,
        radius,
        {
          restitution: 0.9,
          friction: 0.001,
          render: { visible: false },
          label: id
        }
      );
      
      // Apply explosion force
      const angle = Math.random() * Math.PI * 2;
      const force = {
        x: Math.cos(angle) * 0.02,
        y: Math.sin(angle) * 0.02
      };
      
      Matter.Body.applyForce(body, body.position, force);
      Matter.World.add(this.world, body);
      
      const particle = new GameObject();
      particle.id = id;
      particle.type = GameObjectType.PARTICLE;
      if (originalObj.fruitType) particle.fruitType = originalObj.fruitType;
      particle.x = body.position.x;
      particle.y = body.position.y;
      particle.radius = radius;
      particle.isSliced = true;
      particle.bodyId = body.id; // Store body reference
      
      this.state.objects.push(particle);
      this.objectMap.set(body.id, body);
      
      // Remove particle after delay
      this.clock.setTimeout(() => {
        this.removeObject(particle.id);
      }, 2000);
    }
  }

  private handleSlice(playerId: string, start: {x: number, y: number}, end: {x: number, y: number}) {
    const player = this.state.players.get(playerId);
    if (!player || player.isGameOver) return;
    
    // Check collision with objects
    for (let i = this.state.objects.length - 1; i >= 0; i--) {
      const obj = this.state.objects[i];
      if (obj.isSliced) continue;
      
      if (this.isLineIntersectingCircle(start, end, obj)) {
        obj.isSliced = true;
        this.handleObjectSliced(obj, player);
      }
    }
  }

  private isLineIntersectingCircle(
    start: {x: number, y: number},
    end: {x: number, y: number},
    circle: GameObject
  ): boolean {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx*dx + dy*dy);
    
    const dot = ((circle.x - start.x) * dx + (circle.y - start.y) * dy) / (length * length);
    const closestX = start.x + dot * dx;
    const closestY = start.y + dot * dy;
    
    const distX = closestX - circle.x;
    const distY = closestY - circle.y;
    const distance = Math.sqrt(distX*distX + distY*distY);
    
    return distance <= circle.radius;
  }

  private handleObjectSliced(obj: GameObject, player: Player) {
    const body = this.objectMap.get(obj.bodyId);
    if (body) {
      Matter.World.remove(this.world, body);
      this.objectMap.delete(obj.bodyId);
    }
    
    if (obj.type === GameObjectType.FRUIT) {
      player.score += 10;
      this.createParticles(obj);
    } 
    else if (obj.type === GameObjectType.BOMB) {
      player.lives--;
      
      if (player.lives <= 0) {
        player.lives = 0;
        player.isGameOver = true;
      }
    }
    
    this.removeObject(obj.id);
  }

  private removeObject(id: string) {
    const index = this.state.objects.findIndex(o => o.id === id);
    if (index !== -1) {
      // Use ArraySchema safe deletion
      this.state.objects.deleteAt(index);
    }
    
    // Physics body cleanup handled in handleObjectSliced
  }

  private resetPlayer(playerId: string) {
    const player = this.state.players.get(playerId);
    if (player) {
      player.score = 0;
      player.lives = 3;
      player.isGameOver = false;
    }
  }

  private endGame() {
    this.state.isGameActive = false;
    
    // Clear timers using Colyseus clock methods
    this.clock.clear(this.spawnTimer);
    this.clock.clear(this.gameTimer);
    
    this.state.players.forEach(player => {
      player.isGameOver = true;
    });
  }

  update(deltaTime: number) {
    // Cap delta to 16.67ms (60fps) to prevent physics issues
    const cappedDelta = Math.min(deltaTime * 1000, 16.67);
    Matter.Engine.update(this.engine, cappedDelta);
    
    // Update game objects from physics bodies
    for (const obj of this.state.objects) {
      const body = this.objectMap.get(obj.bodyId);
      if (body) {
        obj.x = body.position.x;
        obj.y = body.position.y;
        obj.rotation = body.angle;
        
        // Remove objects that fall off screen
        if (obj.y > this.WORLD_HEIGHT + 100) {
          this.removeObject(obj.id);
        }
      }
    }
  }

  onJoin(client: Client, options: any) {
    const player = new Player();
    player.id = client.sessionId;
    player.name = options.name || "Player";
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    // Clean up physics engine
    Matter.Engine.clear(this.engine);
    
    // Clear all intervals
    this.clock.clear();
    
    // Clear object maps
    this.objectMap.clear();
  }
}