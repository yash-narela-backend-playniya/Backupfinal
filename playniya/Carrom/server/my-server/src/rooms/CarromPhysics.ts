
const Matter = require('matter-js');

class CarromPhysics {
  constructor() {
    this.engine = null;
    this.world = null;
    this.bodies = {
      striker: null,
      coins: [],
      queen: null,
      walls: [],
      pockets: []
    };
    this.boardSize = 600; // Board size in pixels
    this.coinRadius = 12;
    this.strikerRadius = 18;
    this.pocketRadius = 25;
    this.pocketedPieces = [];
  }
  
  createWorld() {
    // Create physics engine
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;
    
    // Configure physics settings
    this.engine.world.gravity.y = 0; // Top-down view, no gravity
    this.engine.enableSleeping = true;
    
    // Set up collision detection
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      this.handleCollisions(event);
    });
  }
  
  setupCarromBoard() {
    // Create board boundaries
    this.createBoundaries();
    
    // Create pockets
    this.createPockets();
    
    // Create coins
    this.createCoins();
    
    // Create queen
    this.createQueen();
    
    // Create striker
    this.createStriker();
  }
  
  createBoundaries() {
    const thickness = 20;
    const halfBoard = this.boardSize / 2;
    
    // Top wall
    this.bodies.walls.push(
      Matter.Bodies.rectangle(0, -halfBoard - thickness/2, this.boardSize, thickness, {
        isStatic: true,
        label: 'wall'
      })
    );
    
    // Bottom wall
    this.bodies.walls.push(
      Matter.Bodies.rectangle(0, halfBoard + thickness/2, this.boardSize, thickness, {
        isStatic: true,
        label: 'wall'
      })
    );
    
    // Left wall
    this.bodies.walls.push(
      Matter.Bodies.rectangle(-halfBoard - thickness/2, 0, thickness, this.boardSize, {
        isStatic: true,
        label: 'wall'
      })
    );
    
    // Right wall
    this.bodies.walls.push(
      Matter.Bodies.rectangle(halfBoard + thickness/2, 0, thickness, this.boardSize, {
        isStatic: true,
        label: 'wall'
      })
    );
    
    // Add walls to world
    Matter.World.add(this.world, this.bodies.walls);
  }
  
  createPockets() {
    const pocketPositions = [
      { x: -this.boardSize/2 + 30, y: -this.boardSize/2 + 30 }, // Top-left
      { x: this.boardSize/2 - 30, y: -this.boardSize/2 + 30 },  // Top-right
      { x: -this.boardSize/2 + 30, y: this.boardSize/2 - 30 },  // Bottom-left
      { x: this.boardSize/2 - 30, y: this.boardSize/2 - 30 }    // Bottom-right
    ];
    
    pocketPositions.forEach((pos, index) => {
      const pocket = Matter.Bodies.circle(pos.x, pos.y, this.pocketRadius, {
        isStatic: true,
        isSensor: true,
        label: `pocket_${index}`
      });
      this.bodies.pockets.push(pocket);
    });
    
    Matter.World.add(this.world, this.bodies.pockets);
  }
  
  createCoins() {
    // Create white coins (9 total)
    for (let i = 0; i < 9; i++) {
      const angle = (i * Math.PI * 2) / 9;
      const radius = 40;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      const coin = Matter.Bodies.circle(x, y, this.coinRadius, {
        restitution: 0.8,
        friction: 0.1,
        frictionAir: 0.01,
        label: `white_coin_${i}`
      });
      
      this.bodies.coins.push(coin);
    }
    
    // Create black coins (9 total)
    for (let i = 0; i < 9; i++) {
      const angle = (i * Math.PI * 2) / 9 + Math.PI / 9;
      const radius = 60;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      const coin = Matter.Bodies.circle(x, y, this.coinRadius, {
        restitution: 0.8,
        friction: 0.1,
        frictionAir: 0.01,
        label: `black_coin_${i}`
      });
      
      this.bodies.coins.push(coin);
    }
    
    Matter.World.add(this.world, this.bodies.coins);
  }
  
  createQueen() {
    this.bodies.queen = Matter.Bodies.circle(0, 0, this.coinRadius, {
      restitution: 0.8,
      friction: 0.1,
      frictionAir: 0.01,
      label: 'queen'
    });
    
    Matter.World.add(this.world, this.bodies.queen);
  }
  
  createStriker() {
    // Start striker at bottom center
    this.bodies.striker = Matter.Bodies.circle(0, this.boardSize/2 - 50, this.strikerRadius, {
      restitution: 0.9,
      friction: 0.05,
      frictionAir: 0.02,
      label: 'striker'
    });
    
    Matter.World.add(this.world, this.bodies.striker);
  }
  
  shootStriker(angle, power) {
    if (!this.bodies.striker) return;
    
    // Convert angle and power to force
    const maxForce = 0.05;
    const force = (power / 100) * maxForce;
    
    const forceX = Math.cos(angle) * force;
    const forceY = Math.sin(angle) * force;
    
    // Apply force to striker
    Matter.Body.applyForce(this.bodies.striker, this.bodies.striker.position, {
      x: forceX,
      y: forceY
    });
  }
  
  handleCollisions(event) {
    const pairs = event.pairs;
    
    for (let pair of pairs) {
      const { bodyA, bodyB } = pair;
      
      // Check if any piece hit a pocket
      if (bodyA.label.includes('pocket') || bodyB.label.includes('pocket')) {
        const piece = bodyA.label.includes('pocket') ? bodyB : bodyA;
        this.handlePocketing(piece);
      }
    }
  }
  
  handlePocketing(piece) {
    if (piece.label === 'striker') {
      // Foul - striker pocketed
      this.resetStriker();
    } else if (piece.label.includes('coin') || piece.label === 'queen') {
      // Coin or queen pocketed
      this.pocketedPieces.push({
        label: piece.label,
        type: piece.label === 'queen' ? 'queen' : 'coin',
        color: piece.label.includes('white') ? 'white' : 'black'
      });
      
      // Remove piece from world
      Matter.World.remove(this.world, piece);
    }
  }
  
  resetStriker() {
    if (this.bodies.striker) {
      Matter.Body.setPosition(this.bodies.striker, { x: 0, y: this.boardSize/2 - 50 });
      Matter.Body.setVelocity(this.bodies.striker, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(this.bodies.striker, 0);
    }
  }
  
  update() {
    Matter.Engine.update(this.engine, 1000 / 60);
  }
  
  isAnyPieceMoving() {
    const threshold = 0.1;
    
    // Check striker
    if (this.bodies.striker) {
      const strikerSpeed = Matter.Vector.magnitude(this.bodies.striker.velocity);
      if (strikerSpeed > threshold) return true;
    }
    
    // Check coins
    for (let coin of this.bodies.coins) {
      const speed = Matter.Vector.magnitude(coin.velocity);
      if (speed > threshold) return true;
    }
    
    // Check queen
    if (this.bodies.queen) {
      const queenSpeed = Matter.Vector.magnitude(this.bodies.queen.velocity);
      if (queenSpeed > threshold) return true;
    }
    
    return false;
  }
  
  getState() {
    const state = {
      pieces: new Map(),
      striker: null
    };
    
    // Get striker state
    if (this.bodies.striker) {
      state.striker = {
        id: 'striker',
        type: 'striker',
        color: 'white',
        x: this.bodies.striker.position.x,
        y: this.bodies.striker.position.y,
        angle: this.bodies.striker.angle,
        active: true,
        pocketed: false
      };
    }
    
    // Get coin states
    this.bodies.coins.forEach((coin, index) => {
      state.pieces.set(`coin_${index}`, {
        id: `coin_${index}`,
        type: 'coin',
        color: coin.label.includes('white') ? 'white' : 'black',
        x: coin.position.x,
        y: coin.position.y,
        angle: coin.angle,
        active: true,
        pocketed: false
      });
    });
    
    // Get queen state
    if (this.bodies.queen) {
      state.pieces.set('queen', {
        id: 'queen',
        type: 'queen',
        color: 'red',
        x: this.bodies.queen.position.x,
        y: this.bodies.queen.position.y,
        angle: this.bodies.queen.angle,
        active: true,
        pocketed: false
      });
    }
    
    return state;
  }
  
  getPocketedPieces() {
    const pocketed = [...this.pocketedPieces];
    this.pocketedPieces = []; // Clear after getting
    return pocketed;
  }
  
  resetGame() {
    // Remove all bodies
    Matter.World.clear(this.world);
    
    // Reset arrays
    this.bodies.coins = [];
    this.bodies.walls = [];
    this.bodies.pockets = [];
    this.pocketedPieces = [];
    
    // Recreate the game
    this.setupCarromBoard();
  }
  
  destroy() {
    if (this.engine) {
      Matter.Engine.clear(this.engine);
      this.engine = null;
    }
  }
}

module.exports = { CarromPhysics };