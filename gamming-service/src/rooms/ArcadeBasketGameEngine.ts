export class GameEngine {
  private readonly GRAVITY = 9.8;
  private readonly TIME_STEP = 0.016;
  private readonly BALL_RADIUS = 15;
  private readonly HOOP_RADIUS = 30;
  private readonly HOOP_Y = 300;
  private readonly BACKBOARD_X = 700;
  private readonly BACKBOARD_WIDTH = 20;

  private ballPosition = { x: 400, y: 0 };
  private ballVelocity = { x: 0, y: 0 };
  private isBallActive = false;
  private lastShooterId: string | null = null;

  calculateTrajectory(angle: number, power: number, shooterX: number) {
    const rad = angle * Math.PI / 180;
    const velocity = power * 15;  // Increased multiplier from 10 to 15 for more power
    return {
      velocityX: velocity * Math.cos(rad),
      velocityY: velocity * Math.sin(rad),
      startX: shooterX,
      startY: 50  // start ball a bit above ground for better trajectory
    };
  }

  startShot(angle: number, power: number, shooterX: number, shooterId?: string) {
    if (this.isBallActive) return false;

    const trajectory = this.calculateTrajectory(angle, power, shooterX);
    this.ballPosition = { x: trajectory.startX, y: trajectory.startY };
    this.ballVelocity = { x: trajectory.velocityX, y: trajectory.velocityY };
    this.isBallActive = true;

    if (shooterId) {
      this.lastShooterId = shooterId;
    }

    console.log(`GameEngine: Shot started by ${shooterId} at (${trajectory.startX}, ${trajectory.startY}) with velocity (${this.ballVelocity.x.toFixed(2)}, ${this.ballVelocity.y.toFixed(2)})`);

    return true;
  }

  update(basketX: number) {
    if (!this.isBallActive) return null;

    this.ballPosition.x += this.ballVelocity.x * this.TIME_STEP;
    this.ballPosition.y += this.ballVelocity.y * this.TIME_STEP;
    this.ballVelocity.y -= this.GRAVITY * this.TIME_STEP;

    const result = this.checkCollisions(basketX);

    if (this.ballPosition.y <= 0) {
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

  private checkCollisions(basketX: number) {
    // Backboard collision
    if (Math.abs(this.ballPosition.x - this.BACKBOARD_X) < this.BACKBOARD_WIDTH &&
      this.ballPosition.y > this.HOOP_Y) {
      this.ballVelocity.x = -this.ballVelocity.x * 0.7;
      this.ballVelocity.y *= 0.8;
      console.log("🛑 Backboard collision detected");
      return { scored: false, points: 0 };
    }

    // Hoop collision - check if ball within hoop radius (centered at basketX, HOOP_Y)
    const dx = this.ballPosition.x - basketX;
    const dy = this.ballPosition.y - this.HOOP_Y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < this.HOOP_RADIUS) {
      console.log(`✅ Hoop hit! Distance: ${dist.toFixed(2)}`);
      this.isBallActive = false;
      return { scored: true, points: 2 };
    }

    return { scored: false, points: 0 };
  }

  getBallState() {
    return {
      x: this.ballPosition.x,
      y: this.ballPosition.y,
      isActive: this.isBallActive
    };
  }

  getLastShooterId() {
    return this.lastShooterId;
  }
}
 