const PF = require('./Pathfinding');
const C = require('../game/constants');

const State = {
  IDLE: 'IDLE',
  PATROL: 'PATROL',
  CHASE: 'CHASE',
  AIM: 'AIM',
  SHOOT: 'SHOOT',
  DODGE: 'DODGE',
};

class AIController {
  constructor(tank, maze) {
    this.tank = tank;
    this.maze = maze;
    this.state = State.IDLE;
    this.stateTimer = 0;
    this.path = [];
    this.pathIndex = 0;
    this.patrolTarget = null;
    this.aimTimer = 0;
    this.reactionDelay = 200 + Math.random() * 300; // 200-500ms
    this.aimAccuracy = 0.05 + Math.random() * 0.1;   // radians of inaccuracy
  }

  tick(dt, gameState) {
    if (!this.tank.alive) {
      this.tank.rotateInput = 0;
      this.tank.thrustInput = 0;
      return { shoot: false };
    }

    this.stateTimer += dt * 1000;
    const enemy = gameState.tanks.find(t => t.playerIndex !== this.tank.playerIndex);
    const bullets = gameState.bullets;
    const myCell = PF.worldToCell(this.tank.x, this.tank.y);
    const enemyCell = enemy ? PF.worldToCell(enemy.x, enemy.y) : null;

    // Always check for incoming bullets (highest priority)
    const threat = this.findThreat(bullets);
    if (threat) {
      this.transitionTo(State.DODGE);
      return this.dodge(threat, dt);
    }

    // State machine
    switch (this.state) {
      case State.IDLE:
        this.transitionTo(State.PATROL);
        return this.patrol(dt, myCell);

      case State.PATROL:
        if (enemy && enemy.alive && this.canSeeEnemy(myCell, enemyCell)) {
          this.transitionTo(State.CHASE);
          return this.chase(dt, myCell, enemyCell, enemy);
        }
        // Randomly try to find enemy
        if (enemy && enemy.alive && this.stateTimer > 3000) {
          this.transitionTo(State.CHASE);
          return this.chase(dt, myCell, enemyCell, enemy);
        }
        return this.patrol(dt, myCell);

      case State.CHASE:
        if (!enemy || !enemy.alive) {
          this.transitionTo(State.PATROL);
          return this.patrol(dt, myCell);
        }
        if (this.canSeeEnemy(myCell, enemyCell)) {
          this.transitionTo(State.AIM);
          return this.aim(dt, enemy);
        }
        return this.chase(dt, myCell, enemyCell, enemy);

      case State.AIM:
        if (!enemy || !enemy.alive) {
          this.transitionTo(State.PATROL);
          return this.patrol(dt, myCell);
        }
        this.aimTimer += dt * 1000;
        if (this.aimTimer > this.reactionDelay && this.isAimedAt(enemy)) {
          this.transitionTo(State.SHOOT);
          this.aimTimer = 0;
          this.reactionDelay = 200 + Math.random() * 300;
        }
        return this.aim(dt, enemy);

      case State.SHOOT:
        this.transitionTo(State.AIM);
        return { shoot: true };

      case State.DODGE:
        if (!this.findThreat(bullets)) {
          this.transitionTo(enemy && enemy.alive ? State.CHASE : State.PATROL);
          return enemy ? this.chase(dt, myCell, enemyCell, enemy) : this.patrol(dt, myCell);
        }
        return this.dodge(this.findThreat(bullets), dt);
    }

    return { shoot: false };
  }

  transitionTo(newState) {
    if (this.state !== newState) {
      this.state = newState;
      this.stateTimer = 0;
    }
  }

  findThreat(bullets) {
    let closest = null;
    let closestDist = 150; // threat detection radius

    for (const bullet of bullets) {
      if (bullet.ownerIndex === this.tank.playerIndex) continue;
      const dx = bullet.x - this.tank.x;
      const dy = bullet.y - this.tank.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check if bullet is moving roughly toward us
      const dot = dx * bullet.vx + dy * bullet.vy;
      if (dist < closestDist && dot > -50) {
        closestDist = dist;
        closest = bullet;
      }
    }

    return closest;
  }

  dodge(threat, dt) {
    if (!threat) {
      this.tank.rotateInput = 0;
      this.tank.thrustInput = 0;
      return { shoot: false };
    }

    // Move perpendicular to bullet's trajectory
    const dx = this.tank.x - threat.x;
    const perpX = -threat.vy;
    const perpY = threat.vx;

    // Determine if we should move along +perp or -perp
    const dot = dx * perpX + (this.tank.y - threat.y) * perpY;
    const sign = dot > 0 ? 1 : -1;

    // Steer toward perpendicular direction
    const targetAngle = Math.atan2(-sign * perpY, sign * perpX) * 180 / Math.PI;
    const angleDiff = this.angleDiff(targetAngle, this.tank.rotation);

    this.tank.rotateInput = Math.max(-1, Math.min(1, angleDiff / 30));
    this.tank.thrustInput = 1;

    return { shoot: false };
  }

  patrol(dt, myCell) {
    if (!this.patrolTarget || this.atTarget()) {
      // Pick new random patrol target
      const randR = Math.floor(Math.random() * this.maze.rows);
      const randC = Math.floor(Math.random() * this.maze.cols);
      this.patrolTarget = { r: randR, c: randC };
      this.path = PF.findPath(this.maze, myCell.r, myCell.c, randR, randC);
      this.pathIndex = 0;
    }

    return this.followPath();
  }

  chase(dt, myCell, enemyCell, enemy) {
    // Recompute path periodically
    if (!this.path || this.path.length === 0 || this.stateTimer > 1000) {
      this.path = PF.findPath(this.maze, myCell.r, myCell.c, enemyCell.r, enemyCell.c);
      this.pathIndex = 0;
      this.stateTimer = 0;
    }

    return this.followPath();
  }

  aim(dt, enemy) {
    // Rotate toward enemy
    const dx = enemy.x - this.tank.x;
    const dy = enemy.y - this.tank.y;
    const targetAngle = Math.atan2(-dy, dx) * 180 / Math.PI;
    const diff = this.angleDiff(targetAngle, this.tank.rotation);

    // Stop moving while aiming
    this.tank.thrustInput = 0;
    this.tank.rotateInput = Math.max(-1, Math.min(1, diff / 20));

    return { shoot: false };
  }

  isAimedAt(enemy) {
    const dx = enemy.x - this.tank.x;
    const dy = enemy.y - this.tank.y;
    const targetAngle = Math.atan2(-dy, dx) * 180 / Math.PI;
    const diff = Math.abs(this.angleDiff(targetAngle, this.tank.rotation));
    return diff < 8; // within 8 degrees
  }

  followPath() {
    if (!this.path || this.path.length === 0 || this.pathIndex >= this.path.length) {
      // Arrived at target
      this.tank.rotateInput = 0;
      this.tank.thrustInput = 0;
      this.patrolTarget = null;
      return { shoot: false };
    }

    const target = this.path[this.pathIndex];
    const world = PF.cellToWorld(target.r, target.c);
    const dx = world.x - this.tank.x;
    const dy = world.y - this.tank.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < C.CELL_SIZE * 0.5) {
      this.pathIndex++;
      return this.followPath();
    }

    const targetAngle = Math.atan2(-dy, dx) * 180 / Math.PI;
    const diff = this.angleDiff(targetAngle, this.tank.rotation);

    this.tank.rotateInput = Math.max(-1, Math.min(1, diff / 30));
    this.tank.thrustInput = Math.abs(diff) < 45 ? 1 : 0;

    return { shoot: false };
  }

  atTarget() {
    if (!this.patrolTarget) return true;
    const world = PF.cellToWorld(this.patrolTarget.r, this.patrolTarget.c);
    const dx = world.x - this.tank.x;
    const dy = world.y - this.tank.y;
    return Math.sqrt(dx * dx + dy * dy) < C.CELL_SIZE * 0.5;
  }

  canSeeEnemy(myCell, enemyCell) {
    if (!myCell || !enemyCell) return false;
    return PF.hasLineOfSight(this.maze, myCell.r, myCell.c, enemyCell.r, enemyCell.c);
  }

  angleDiff(target, current) {
    let diff = target - current;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  }
}

module.exports = { AIController, State };
