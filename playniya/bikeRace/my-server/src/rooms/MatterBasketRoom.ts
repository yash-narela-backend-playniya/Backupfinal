import Matter from 'matter-js';

export class GameEngine {
  private engine: Matter.Engine;
  private ball: Matter.Body | null = null;
  private basketRim: Matter.Body;
  private scoringArea: Matter.Body;
  private lastShooterId: string = '';
  private rimContact = false;
  private scored = false;
  private isActive = false;

  constructor() {
    // Initialize physics engine with custom gravity
    this.engine = Matter.Engine.create({ 
      gravity: { x: 0, y: 0.9 } 
    });

    // Create basket rim (sensor)
    this.basketRim = Matter.Bodies.rectangle(400, 300, 50, 5, { 
      isSensor: true,
      isStatic: true,
      label: 'rim',
      render: { fillStyle: '#ff0000' }
    });

    // Create scoring area (sensor)
    this.scoringArea = Matter.Bodies.rectangle(400, 320, 40, 20, {
      isSensor: true,
      isStatic: true,
      label: 'scoringArea',
      render: { fillStyle: '#00ff00' }
    });

    // Create boundaries
    const ground = Matter.Bodies.rectangle(400, 600, 800, 40, { 
      isStatic: true,
      label: 'ground'
    });
    const leftWall = Matter.Bodies.rectangle(0, 300, 40, 600, { 
      isStatic: true,
      label: 'leftWall'
    });
    const rightWall = Matter.Bodies.rectangle(800, 300, 40, 600, { 
      isStatic: true,
      label: 'rightWall'
    });

    // Add to world
    Matter.World.add(this.engine.world, [
      this.basketRim,
      this.scoringArea,
      ground,
      leftWall,
      rightWall
    ]);

    // Collision detection
    Matter.Events.on(this.engine, 'collisionStart', this.handleCollisions.bind(this));
  }

  private handleCollisions(event: Matter.IEventCollision<Matter.Engine>) {
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
      const { bodyA, bodyB } = pairs[i];
      
      // Rim contact detection
      if (
        (bodyA.label === 'rim' && bodyB.label === 'ball') ||
        (bodyA.label === 'ball' && bodyB.label === 'rim')
      ) {
        this.rimContact = true;
      }

      // Scoring detection
      if (
        this.rimContact && 
        ((bodyA.label === 'scoringArea' && bodyB.label === 'ball') || 
         (bodyA.label === 'ball' && bodyB.label === 'scoringArea'))
      ) {
        this.scored = true;
        this.rimContact = false;
      }

      // Reset on ground contact
      if (
        (bodyA.label === 'ground' && bodyB.label === 'ball') ||
        (bodyA.label === 'ball' && bodyB.label === 'ground')
      ) {
        this.isActive = false;
      }
    }
  }

  startShot(angle: number, power: number, playerX: number, shooterId: string): boolean {
    if (this.isActive) return false;

    // Remove existing ball
    if (this.ball) {
      Matter.World.remove(this.engine.world, this.ball);
    }

    // Create new ball with physics properties
    this.ball = Matter.Bodies.circle(
      playerX, 
      550,
      12,  // Ball radius
      {
        restitution: 0.7,
        friction: 0.01,
        frictionAir: 0.001,
        density: 0.008,
        label: 'ball',
        render: { fillStyle: '#ff9900' }
      }
    );

    Matter.World.add(this.engine.world, this.ball);

    // Apply force (convert angle to vector)
    const force = {
      x: Math.cos(angle * Math.PI / 180) * power * 0.04,
      y: -Math.sin(angle * Math.PI / 180) * power * 0.04  // Negative for upward force
    };
    
    Matter.Body.applyForce(
      this.ball, 
      this.ball.position, 
      force
    );

    // Reset flags
    this.isActive = true;
    this.rimContact = false;
    this.scored = false;
    this.lastShooterId = shooterId;

    return true;
  }

  update(basketX: number) {
    if (!this.isActive || !this.ball) return null;

    // Update basket position
    Matter.Body.setPosition(this.basketRim, { x: basketX, y: 300 });
    Matter.Body.setPosition(this.scoringArea, { x: basketX, y: 320 });

    // Update physics
    Matter.Engine.update(this.engine, 16);

    // Check for scoring
    let result = {
      position: { x: this.ball.position.x, y: this.ball.position.y },
      scored: this.scored,
      points: this.scored ? 2 : 0,
      reset: !this.isActive
    };

    return result;
  }

  getBallState() {
    return { isActive: this.isActive };
  }

  getLastShooterId() {
    return this.lastShooterId;
  }
}