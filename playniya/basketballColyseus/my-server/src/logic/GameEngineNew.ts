
// Updated Physics Engine
export class GameEngine {
  private readonly GRAVITY = 9.8;
  private readonly TIME_STEP = 0.016;
  private readonly BALL_RADIUS = 15;
  private readonly HOOP_RADIUS = 40; // Larger radius for 3D
  private readonly HOOP_Y = 300;
  private readonly COURT_DEPTH = 1000; // Depth of the court

  private ballPosition = { x: 0, y: 0, z: 0 };
  private ballVelocity = { x: 0, y: 0, z: 0 };
  private isBallActive = false;
  private lastShooterId: string | null = null;

  // Calculate trajectory in 3D space
  calculateTrajectory(angle: number, power: number, shooterX: number, basketZ: number) {
    const verticalRad = angle * Math.PI / 180;
    const velocity = power * 15;
    
    // Calculate distance to basket
    const distanceZ = basketZ;
    
    // Calculate horizontal angle based on player position and basket depth
    const horizontalAngle = Math.atan2(distanceZ, 300); // Assume fixed distance in X
    
    return {
      velocityX: velocity * Math.cos(verticalRad) * Math.cos(horizontalAngle),
      velocityY: velocity * Math.sin(verticalRad),
      velocityZ: velocity * Math.cos(verticalRad) * Math.sin(horizontalAngle),
      startX: shooterX,
      startY: 50,
      startZ: 0 // Players shoot from front of court
    };
  }

  startShot(angle: number, power: number, shooterX: number, basketZ: number, shooterId?: string) {
    if (this.isBallActive) return false;

    const trajectory = this.calculateTrajectory(angle, power, shooterX, basketZ);
    this.ballPosition = { 
      x: trajectory.startX, 
      y: trajectory.startY, 
      z: trajectory.startZ 
    };
    this.ballVelocity = { 
      x: trajectory.velocityX, 
      y: trajectory.velocityY,
      z: trajectory.velocityZ
    };
    this.isBallActive = true;

    if (shooterId) this.lastShooterId = shooterId;
    
    return true;
  }

  update(basketZ: number) {
    if (!this.isBallActive) return null;

    // Update position
    this.ballPosition.x += this.ballVelocity.x * this.TIME_STEP;
    this.ballPosition.y += this.ballVelocity.y * this.TIME_STEP;
    this.ballPosition.z += this.ballVelocity.z * this.TIME_STEP;
    
    // Apply gravity
    this.ballVelocity.y -= this.GRAVITY * this.TIME_STEP;

    // Check for collisions
    const result = this.checkCollisions(basketZ);

    // Reset if ball goes out of bounds or hits ground
    if (this.ballPosition.y <= 0 || 
        this.ballPosition.z > this.COURT_DEPTH || 
        this.ballPosition.z < 0) {
      this.isBallActive = false;
      return {
        position: this.ballPosition,
        scored: false,
        reset: true
      };
    }

    return {
      position: this.ballPosition,
      scored: result.scored,
      points: result.points,
      reset: false
    };
  }

  private checkCollisions(basketZ: number) {
    // Calculate 3D distance to basket
    const dx = this.ballPosition.x - 400; // Basket at center of X-axis
    const dy = this.ballPosition.y - this.HOOP_Y;
    const dz = this.ballPosition.z - basketZ;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

    // Score if ball passes through hoop
    if (dist < this.HOOP_RADIUS) {
      this.isBallActive = false;
      return { scored: true, points: 2 };
    }

    return { scored: false, points: 0 };
  }

  getBallState() {
    return {
      x: this.ballPosition.x,
      y: this.ballPosition.y,
      z: this.ballPosition.z,
      isActive: this.isBallActive
    };
  }

  getLastShooterId() {
    return this.lastShooterId;
  }
}
