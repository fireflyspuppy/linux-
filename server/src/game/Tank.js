const C = require('./constants');

let nextId = 1;

class Tank {
  constructor(options = {}) {
    this.id = `tank_${nextId++}`;
    this.playerIndex = options.playerIndex || 0;
    this.playerName = options.playerName || 'Player';
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.rotation = options.rotation || 0;      // degrees, 0 = right
    this.alive = true;
    this.justRespawned = false;
    this.score = 0;
    this.lives = options.lives || 3;

    // Movement state
    this.rotateInput = 0;   // -1 left, 0 none, 1 right
    this.thrustInput = 0;   // -1 back, 0 none, 1 forward

    // Shooting
    this.shootCooldown = 0;     // ms remaining
    this.bulletsInFlight = 0;
    this.maxBullets = C.MAX_SIMULTANEOUS_BULLETS;

    // Respawning
    this.respawnTimer = 0;
    this.shieldTimer = 0;
    this.half = C.TANK_HALF;

    // AI flag
    this.isAI = options.isAI || false;
  }

  getNextPosition(dt) {
    // Apply rotation
    const newRotation = this.rotation + this.rotateInput * C.TANK_ROTATION_SPEED * dt;

    // Apply thrust along current rotation direction
    const rad = this.rotation * Math.PI / 180;
    let dx = 0, dy = 0;
    if (this.thrustInput !== 0) {
      dx = Math.cos(rad) * C.TANK_SPEED * dt * this.thrustInput;
      dy = -Math.sin(rad) * C.TANK_SPEED * dt * this.thrustInput; // screen Y-down
    }

    return {
      x: this.x + dx,
      y: this.y + dy,
      rotation: newRotation,
    };
  }

  applyPosition(pos) {
    this.x = pos.x;
    this.y = pos.y;
    this.rotation = pos.rotation;
  }

  // Get barrel tip position (for bullet spawn)
  getBarrelTip() {
    const rad = this.rotation * Math.PI / 180;
    return {
      x: this.x + Math.cos(rad) * (C.TANK_HALF + C.TANK_BARREL_LENGTH),
      y: this.y - Math.sin(rad) * (C.TANK_HALF + C.TANK_BARREL_LENGTH),
    };
  }

  spawnBullet() {
    if (!this.alive) return null;
    if (this.shootCooldown > 0) return null;
    if (this.bulletsInFlight >= this.maxBullets) return null;
    if (this.shieldTimer > 0) return null;

    const tip = this.getBarrelTip();
    const rad = this.rotation * Math.PI / 180;
    const speed = C.BULLET_SPEED;

    // Offset bullet forward to avoid spawning on top of a wall surface,
    // which would cause the ray-intersection t≈0 guard to miss the hit.
    const spawnOffset = 2;
    const dirX = Math.cos(rad);
    const dirY = -Math.sin(rad);

    this.shootCooldown = C.SHOOT_COOLDOWN;
    this.bulletsInFlight++;

    return {
      id: `bullet_${nextId++}`,
      ownerIndex: this.playerIndex,
      x: tip.x + dirX * spawnOffset,
      y: tip.y + dirY * spawnOffset,
      vx: dirX * speed,
      vy: dirY * speed,
      bounces: 0,
      active: true,
    };
  }

  update(dt) {
    if (this.shootCooldown > 0) {
      this.shootCooldown -= dt * 1000;
    }
    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
    }
    if (!this.alive) {
      this.respawnTimer -= dt * 1000;
      if (this.respawnTimer <= 0) {
        this.alive = true;
        this.shieldTimer = C.RESPAWN_SHIELD_TIME;
        this.justRespawned = true;
      }
    }
  }

  kill() {
    this.alive = false;
    this.respawnTimer = C.RESPAWN_DELAY;
    this.shootCooldown = 0;
    this.bulletsInFlight = 0;
  }

  toJSON() {
    return {
      id: this.id,
      playerIndex: this.playerIndex,
      playerName: this.playerName,
      x: this.x,
      y: this.y,
      rotation: this.rotation,
      alive: this.alive,
      score: this.score,
      shieldTimer: this.shieldTimer,
      bulletsInFlight: this.bulletsInFlight,
      isAI: this.isAI,
    };
  }
}

module.exports = Tank;
