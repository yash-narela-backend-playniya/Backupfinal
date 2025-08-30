import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import { Room, Client } from 'colyseus';

// Player Schema
class Player extends Schema {
    @type("string") id: string;
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") z: number = 0;
    @type("number") rotationX: number = 0;
    @type("number") rotationY: number = 0;
    @type("number") rotationZ: number = 0;
    @type("number") velocityX: number = 0;
    @type("number") velocityY: number = 0;
    @type("number") velocityZ: number = 0;
    @type("number") speed: number = 0;
    @type("number") maxSpeed: number = 50;
    @type("number") acceleration: number = 0;
    @type("number") steering: number = 0;
    @type("boolean") nitroActive: boolean = false;
    @type("number") nitroAmount: number = 100;
    @type("number") nitroRegenRate: number = 1;
    @type("number") distanceCovered: number = 0;
    @type("number") currentLap: number = 0;
    @type("boolean") isRespawning: boolean = false;
    @type("number") respawnTime: number = 0;
    @type("number") rank: number = 1;
    @type("boolean") finished: boolean = false;
    @type("number") finishTime: number = 0;
    @type("number") lastCheckpoint: number = 0;
}

// Nitro Pickup Schema
class NitroPickup extends Schema {
    @type("number") x: number;
    @type("number") y: number;
    @type("number") z: number;
    @type("boolean") active: boolean = true;
    @type("number") respawnTime: number = 0;

    constructor(x: number, y: number, z: number) {
        super();
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

// Game State Schema
class GameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: NitroPickup }) nitroPickups = new MapSchema<NitroPickup>();
    @type("boolean") gameStarted: boolean = false;
    @type("boolean") gameEnded: boolean = false;
    @type("number") timeRemaining: number = 120; // 2 minutes
    @type("string") winner: string | null = null;
    @type("number") trackLength: number = 1000; // meters
    @type(["number"]) checkpoints = new ArraySchema<number>();
}

export class RacingRoom extends Room<GameState> {
    physics = {
        friction: 0.95,
        airResistance: 0.02,
        gravity: 9.8,
        nitroMultiplier: 1.5,
        collisionDamping: 0.3,
        minRespawnSpeed: 10
    };
    
    onCreate(options: any) {
        this.setState(new GameState());
        this.maxClients = 8;
        this.initializeTrack();
        this.initializeNitroPickups();
        
        // Game loop - 60 FPS
        this.setSimulationInterval((deltaTime) => this.updateGame(deltaTime), 1000 / 60);
        
        // Timer countdown
        this.clock.setInterval(() => {
            if (this.state.gameStarted && !this.state.gameEnded) {
                this.state.timeRemaining--;
                if (this.state.timeRemaining <= 0) {
                    this.endGame();
                }
            }
        }, 1000);


        this.onMessage( "input",(client,message)=>{

      const player = this.state.players.get(client.sessionId);
        if (!player || player.isRespawning) return;


            this.handleInput(player, message.data);

        } )


         this.onMessage( "nitro",(client,message)=>{

      const player = this.state.players.get(client.sessionId);
        if (!player || player.isRespawning) return;


         this.handleNitro(player, message.data);
        } )

  

        
    }

    onJoin(client: Client, options: any) {
        const player = new Player();
        player.id = client.sessionId;
        
        // Set starting position
        const startingPositions = [
            { x: -20, y: 0, z: 0 },
            { x: -15, y: 0, z: 0 },
            { x: -10, y: 0, z: 0 },
            { x: -5, y: 0, z: 0 },
            { x: 5, y: 0, z: 0 },
            { x: 10, y: 0, z: 0 },
            { x: 15, y: 0, z: 0 },
            { x: 20, y: 0, z: 0 }
        ];
        
        const numPlayers = Array.from(this.state.players.keys()).length;
        const startPos = startingPositions[numPlayers % startingPositions.length];
        
        player.x = startPos.x;
        player.y = startPos.y;
        player.z = startPos.z;
        
        this.state.players.set(client.sessionId, player);
        
        // Start game when minimum players join
        if (this.state.players.size >= 2 && !this.state.gameStarted) {
            this.state.gameStarted = true;
            this.broadcast("gameStarted");
        }
    }

    

    handleInput(player: Player, input: any) {
        // Handle steering input (-1 to 1)
        if (input.left) player.steering = Math.max(player.steering - 0.1, -1);
        if (input.right) player.steering = Math.min(player.steering + 0.1, 1);
        if (!input.left && !input.right) {
            player.steering *= 0.8; // Gradual return to center
        }
        
        // Handle acceleration input (0 to 1)
        if (input.accelerate) {
            player.acceleration = Math.min(player.acceleration + 0.05, 1);
        } else {
            player.acceleration = Math.max(player.acceleration - 0.1, 0);
        }
    }

    handleNitro(player: Player, active: boolean) {
        if (active && player.nitroAmount > 0) {
            player.nitroActive = true;
        } else {
            player.nitroActive = false; 
        }
    }

    updateGame(deltaTime: number) {
        if (!this.state.gameStarted || this.state.gameEnded) return;

        // Update each player
        this.state.players.forEach((player) => {
            this.updatePlayer(player, deltaTime);
        });

        // Update nitro pickups
        this.updateNitroPickups(deltaTime);

        // Check collisions
        this.checkCollisions();

        // Update rankings
        this.updateRankings();

        // Check for winner
        this.checkWinCondition();
    }

    updatePlayer(player: Player, deltaTime: number) {
        if (player.isRespawning) {
            player.respawnTime -= deltaTime / 1000;
            if (player.respawnTime <= 0) {
                player.isRespawning = false;
                player.speed = this.physics.minRespawnSpeed;
            }
            return;
        }

        // Calculate speed based on acceleration
        const targetSpeed = player.acceleration * player.maxSpeed;
        
        // Apply nitro boost
        if (player.nitroActive && player.nitroAmount > 0) {
            player.speed = Math.min(player.speed + 2, targetSpeed * this.physics.nitroMultiplier);
            player.nitroAmount = Math.max(0, player.nitroAmount - 1);
        } else {
            player.speed = this.lerp(player.speed, targetSpeed, 0.1);
        }

        // Regenerate nitro when not active
        if (!player.nitroActive) {
            player.nitroAmount = Math.min(100, player.nitroAmount + player.nitroRegenRate * (deltaTime / 1000));
        }

        // Apply physics
        player.speed *= this.physics.friction;
        player.speed = Math.max(0, player.speed - this.physics.airResistance * player.speed * player.speed);

        // Calculate rotation based on steering and speed
        const steeringEffect = player.steering * (player.speed / player.maxSpeed) * 0.05;
        player.rotationY += steeringEffect;

        // Update position based on rotation and speed
        const speedFactor = player.speed * (deltaTime / 1000);
        player.velocityX = Math.sin(player.rotationY) * speedFactor;
        player.velocityZ = Math.cos(player.rotationY) * speedFactor;

        // Update position
        player.x += player.velocityX;
        player.z += player.velocityZ;

        // Calculate distance covered
        const distanceThisFrame = Math.sqrt(
            player.velocityX * player.velocityX + 
            player.velocityZ * player.velocityZ
        );
        player.distanceCovered += distanceThisFrame;

        // Check lap completion
        this.checkLapCompletion(player);

        // Keep player within track bounds (simple boundary check)
        this.applyTrackBoundaries(player);
    }

    checkLapCompletion(player: Player) {
        // Simple lap detection based on distance and position
        const lapDistance = this.state.trackLength;
        
        if (player.distanceCovered >= lapDistance * (player.currentLap + 1)) {
            player.currentLap++;
            
            // Check if finished race (e.g., 3 laps)
            if (player.currentLap >= 3) {
                player.finished = true;
                player.finishTime = 120 - this.state.timeRemaining;
            }
        }
    }

    applyTrackBoundaries(player: Player) {
        // Simple track boundaries (-100 to 100 on X axis)
        if (player.x < -100) {
            player.x = -100;
            player.speed *= this.physics.collisionDamping;
        }
        if (player.x > 100) {
            player.x = 100;
            player.speed *= this.physics.collisionDamping;
        }
        
        // Z axis boundaries (0 to trackLength)
        if (player.z < 0) {
            player.z = 0;
            player.speed *= this.physics.collisionDamping;
        }
        if (player.z > this.state.trackLength) {
            player.z = this.state.trackLength;
        }
    }

    checkCollisions() {
        const players = Array.from(this.state.players.values());
        
        // Player-to-player collision
        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                const player1 = players[i];
                const player2 = players[j];
                
                if (player1.isRespawning || player2.isRespawning) continue;
                
                const distance = Math.sqrt(
                    Math.pow(player1.x - player2.x, 2) + 
                    Math.pow(player1.z - player2.z, 2)
                );
                
                if (distance < 5) { // Collision threshold
                    // Rear-end collision detection
                    if (this.isRearEndCollision(player1, player2)) {
                        this.handleRearEndCollision(player1, player2);
                    } else if (this.isRearEndCollision(player2, player1)) {
                        this.handleRearEndCollision(player2, player1);
                    }
                }
            }
        }

        // Nitro pickup collision
        this.state.players.forEach((player) => {
            if (player.isRespawning) return;
            
            this.state.nitroPickups.forEach((pickup) => {
                if (!pickup.active) return;
                
                const distance = Math.sqrt(
                    Math.pow(player.x - pickup.x, 2) + 
                    Math.pow(player.z - pickup.z, 2)
                );
                
                if (distance < 3) {
                    player.nitroAmount = Math.min(100, player.nitroAmount + 25);
                    pickup.active = false;
                    pickup.respawnTime = 10; // Respawn after 10 seconds
                }
            });
        });
    }

    isRearEndCollision(player1: Player, player2: Player) {
        // Check if player1 is behind player2 based on their forward vectors
        const dx = player2.x - player1.x;
        const dz = player2.z - player1.z;
        const player1Forward = Math.cos(player1.rotationY);
        const player1Right = Math.sin(player1.rotationY);
        
        // Dot product to determine if player1 is approaching from behind
        const dot = dx * player1Right + dz * player1Forward;
        return dot > 0 && player1.speed > player2.speed;
    }

    handleRearEndCollision(collider: Player, victim: Player) {
        // Respawn the colliding player
        collider.isRespawning = true;
        collider.respawnTime = 2; // 2 seconds
        collider.speed = 0;
        
        // Move collider back slightly
        collider.x -= Math.sin(collider.rotationY) * 10;
        collider.z -= Math.cos(collider.rotationY) * 10;
        
        // Spawn nitro pickup at collision location
        this.spawnNitroPickup(victim.x, victim.y, victim.z);
    }

    spawnNitroPickup(x: number, y: number, z: number) {
        const pickupId = `nitro_${Date.now()}_${Math.random()}`;
        const pickup = new NitroPickup(x, y, z);
        this.state.nitroPickups.set(pickupId, pickup);
    }

    updateNitroPickups(deltaTime: number) {
        this.state.nitroPickups.forEach((pickup) => {
            if (!pickup.active && pickup.respawnTime > 0) {
                pickup.respawnTime -= deltaTime / 1000;
                if (pickup.respawnTime <= 0) {
                    pickup.active = true;
                }
            }
        });
    }

    updateRankings() {
        const players = Array.from(this.state.players.values());
        
        // Sort players by lap completion and distance
        players.sort((a, b) => {
            if (a.finished && !b.finished) return -1;
            if (!a.finished && b.finished) return 1;
            if (a.finished && b.finished) return a.finishTime - b.finishTime;
            
            if (a.currentLap !== b.currentLap) {
                return b.currentLap - a.currentLap;
            }
            
            return b.distanceCovered - a.distanceCovered;
        });
        
        // Update ranks
        players.forEach((player, index) => {
            player.rank = index + 1;
        });
    }

    checkWinCondition() {
        const players = Array.from(this.state.players.values());
        const finishedPlayers = players.filter(p => p.finished);
        
        if (finishedPlayers.length > 0) {
            // Someone finished the race
            const winner = finishedPlayers.sort((a, b) => a.finishTime - b.finishTime)[0];
            this.endGame(winner);
        }
    }

    endGame(winner: Player | null = null) {
        this.state.gameEnded = true;
        
        if (winner) {
            this.state.winner = winner.id;
        } else {
            // Find winner by distance if time ran out
            const players = Array.from(this.state.players.values());
            const leadingPlayer = players.sort((a, b) => {
                if (a.currentLap !== b.currentLap) {
                    return b.currentLap - a.currentLap;
                }
                return b.distanceCovered - a.distanceCovered;
            })[0];
            
            this.state.winner = leadingPlayer.id;
        }
        
        this.broadcast("gameEnded", { winner: this.state.winner });
        
        // Clean up game loops
        this.clock.clear();
    }

    initializeTrack() {
        // Initialize track checkpoints for lap detection
        this.state.checkpoints.push(0, 250, 500, 750, 1000);
    }

    initializeNitroPickups() {
        // Place initial nitro pickups around the track
        const pickupLocations = [
            { x: -30, y: 0, z: 200 },
            { x: 30, y: 0, z: 200 },
            { x: -30, y: 0, z: 400 },
            { x: 30, y: 0, z: 400 },
            { x: -30, y: 0, z: 600 },
            { x: 30, y: 0, z: 600 },
            { x: -30, y: 0, z: 800 },
            { x: 30, y: 0, z: 800 }
        ];
        
        pickupLocations.forEach((location, index) => {
            const pickup = new NitroPickup(location.x, location.y, location.z);
            this.state.nitroPickups.set(`initial_${index}`, pickup);
        });
    }

    onLeave(client: Client, consented: boolean) {
        this.state.players.delete(client.sessionId);
        
        // End game if not enough players
        if (this.state.players.size < 2) {
            this.endGame();
        }
    }

    onDispose() {
        this.clock.clear();
    }

    lerp(start: number, end: number, factor: number): number {
        return start + (end - start) * factor;
    }
} 