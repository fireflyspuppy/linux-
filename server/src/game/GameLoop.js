const C = require('./constants');
const Physics = require('./Physics');

class GameLoop {
  constructor(room) {
    this.room = room;
    this.tick = 0;
    this.intervalId = null;
    this.phase = 'WAITING';     // WAITING | COUNTDOWN | PLAYING | ROUND_OVER | MATCH_OVER
    this.roundTimeRemaining = C.ROUND_DURATION;
    this.countdownTimer = 3;
    this.roundOverTimer = 0;
  }

  start() {
    this.phase = 'COUNTDOWN';
    this.countdownTimer = 3;
    this.intervalId = setInterval(() => this.tickFn(), C.TICK_INTERVAL);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  tickFn() {
    const dt = C.TICK_INTERVAL / 1000; // seconds

    switch (this.phase) {
      case 'WAITING':
        break;

      case 'COUNTDOWN':
        this.countdownTimer -= dt;
        if (this.countdownTimer <= 0) {
          this.phase = 'PLAYING';
          this.room.broadcast('game_event', { type: 'countdown', seconds: 0 });
          this.room.broadcast('game_event', { type: 'game_start' });
        } else {
          this.room.broadcast('game_event', { type: 'countdown', seconds: Math.ceil(this.countdownTimer) });
        }
        break;

      case 'PLAYING':
        this.updateGame(dt);
        this.roundTimeRemaining -= dt;

        if (this.checkRoundEnd()) {
          console.log(`[ENDMATCH] tick=${this.tick} round ended, time=${this.roundTimeRemaining}`);
          this.phase = 'ROUND_OVER';
          this.roundOverTimer = 2;
        }
        break;

      case 'ROUND_OVER':
        this.roundOverTimer -= dt;
        if (this.roundOverTimer <= 0) {
          console.log(`[ENDMATCH] round_over finished, checkMatchEnd=${this.checkMatchEnd()}`);
          if (this.checkMatchEnd()) {
            console.log(`[ENDMATCH] calling endMatch...`);
            this.endMatch();
            return;
          }
          this.resetRound();
          this.phase = 'COUNTDOWN';
          this.countdownTimer = 3;
        }
        break;

      case 'MATCH_OVER':
        // Room handles cleanup
        break;
    }

    this.tick++;
    this.broadcastState();
  }

  updateGame(dt) {
    const { tanks, bullets, wallSegments } = this.room.state;

    // 1. Update tank positions
    for (const tank of tanks) {
      tank.update(dt);
      if (!tank.alive) continue;

      // Random respawn position
      if (tank.justRespawned) {
        tank.justRespawned = false;
        const pos = this.room.getRandomRespawnPosition(tank);
        tank.x = pos.x;
        tank.y = pos.y;
        tank.rotation = Math.random() * 360;
      }

      const nextPos = tank.getNextPosition(dt);
      tank.applyPosition(nextPos);

      // Wall collision resolution
      const resolved = Physics.resolveTankWallCollision(tank, wallSegments);
      tank.x = resolved.x;
      tank.y = resolved.y;

      // Clamp to canvas bounds
      tank.x = Math.max(C.TANK_HALF, Math.min(C.CANVAS_WIDTH - C.TANK_HALF, tank.x));
      tank.y = Math.max(C.TANK_HALF, Math.min(C.CANVAS_HEIGHT - C.TANK_HALF, tank.y));
    }

    // Tank-tank collision resolution
    for (let i = 0; i < tanks.length; i++) {
      for (let j = i + 1; j < tanks.length; j++) {
        if (tanks[i].alive && tanks[j].alive) {
          Physics.resolveTankTankCollision(tanks[i], tanks[j]);
        }
      }
    }

    // 2. Apply buffered inputs (human players)
    for (const tank of tanks) {
      if (!tank.alive || tank.isAI) continue;
      const input = this.room.getLatestInput(tank.playerIndex);
      if (input) {
        tank.rotateInput = input.rotate || 0;
        tank.thrustInput = input.thrust || 0;
        if (input.shoot) {
          const bullet = tank.spawnBullet();
          if (bullet) {
            bullet.id = `bullet_${this.tick}_${tank.playerIndex}_${bullets.length}`;
            bullets.push(bullet);
          }
        }
      }
    }

    // 2b. AI tank processing
    for (const tank of tanks) {
      if (!tank.isAI) continue;
      const aiCtrl = this.room.aiControllers.get(tank.playerIndex);
      if (aiCtrl && tank.alive) {
        const aiAction = aiCtrl.tick(dt, {
          tanks: this.room.state.tanks,
          bullets: this.room.state.bullets,
        });
        if (aiAction.shoot) {
          const bullet = tank.spawnBullet();
          if (bullet) {
            bullet.id = `bullet_${this.tick}_ai_${tank.playerIndex}_${bullets.length}`;
            bullets.push(bullet);
          }
        }
      }
    }

    // 3. Move bullets + bounce
    const remainingBullets = [];
    for (const bullet of bullets) {
      if (!bullet.active) continue;
      const result = Physics.updateBullet(bullet, dt, wallSegments);
      if (result.status === 'destroyed') {
        const owner = tanks.find(t => t.playerIndex === bullet.ownerIndex);
        if (owner) owner.bulletsInFlight = Math.max(0, owner.bulletsInFlight - 1);
        continue;
      }
      bullet.x = result.x;
      bullet.y = result.y;
      bullet.vx = result.vx;
      bullet.vy = result.vy;
      bullet.bounces = result.bounces;
      remainingBullets.push(bullet);
    }
    this.room.state.bullets = remainingBullets;

    // 4. Bullet-tank collision
    for (const bullet of remainingBullets) {
      for (const tank of tanks) {
        if (!tank.alive) continue;
        if (tank.shieldTimer > 0) continue;
        // Don't hit own tank on first 2 bounces (to give chance to escape)
        if (tank.playerIndex === bullet.ownerIndex && bullet.bounces < 1) continue;

        if (Physics.pointInTank(bullet.x, bullet.y, tank)) {
          // Hit!
          tank.kill();

          // Award score
          // Self-hit from bounced bullet → opponent scores
          if (bullet.ownerIndex === tank.playerIndex) {
            const opponent = tanks.find(t => t.playerIndex !== tank.playerIndex);
            if (opponent) opponent.score++;
          } else {
            const shooter = tanks.find(t => t.playerIndex === bullet.ownerIndex);
            if (shooter) shooter.score++;
          }

          // Remove bullet
          bullet.active = false;
          const owner = tanks.find(t => t.playerIndex === bullet.ownerIndex);
          if (owner) owner.bulletsInFlight = Math.max(0, owner.bulletsInFlight - 1);

          // Event
          this.room.broadcast('game_event', {
            type: 'hit',
            victimIndex: tank.playerIndex,
            shooterIndex: bullet.ownerIndex,
            x: bullet.x,
            y: bullet.y,
          });
          break;
        }
      }
    }

    // Clean up inactive bullets
    this.room.state.bullets = this.room.state.bullets.filter(b => b.active);
  }

  checkRoundEnd() {
    // Round ends when time runs out
    return this.roundTimeRemaining <= 0;
  }

  checkMatchEnd() {
    // Game ends when time runs out (single round, highest score wins)
    return true;
  }

  endMatch() {
    this.phase = 'MATCH_OVER';
    const tanks = this.room.state.tanks;
    let winner = tanks[0];
    if (tanks[1] && tanks[1].score > winner.score) winner = tanks[1];

    console.log(`[ENDMATCH] broadcasting match_end, winner=${winner.playerIndex} tanks=${tanks.length}`);
    this.room.broadcast('match_end', {
      winner: winner.playerIndex,
      tanks: tanks.map(t => t.toJSON()),
    });
    this.stop();
    this.room.onMatchEnd(winner);
  }

  resetRound() {
    this.roundTimeRemaining = C.ROUND_DURATION;
    this.room.state.bullets = [];
    const spawns = this.room.spawnPositions;
    for (const tank of this.room.state.tanks) {
      tank.alive = true;
      tank.shieldTimer = C.RESPAWN_SHIELD_TIME;
      tank.shootCooldown = 0;
      tank.bulletsInFlight = 0;
      // Reset to spawn
      const sp = spawns[tank.playerIndex];
      if (sp) {
        tank.x = sp.x;
        tank.y = sp.y;
        tank.rotation = 0;
      }
    }
  }

  broadcastState() {
    this.room.broadcastState();
  }
}

module.exports = GameLoop;
