class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.explosions = []; // client-side visual effects
  }

  clear() {
    const ctx = this.ctx;
    ctx.fillStyle = CONFIG.COLORS.BG;
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
  }

  drawMaze(wallSegments) {
    if (!wallSegments) return;
    const ctx = this.ctx;
    ctx.strokeStyle = CONFIG.COLORS.WALL;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    for (const wall of wallSegments) {
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();
    }
  }

  drawTank(tank, isLocal) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(-Utils.degToRad(tank.rotation));

    // Color
    let color;
    if (!tank.alive) {
      color = CONFIG.COLORS.TANK_DEAD;
    } else if (tank.isAI) {
      color = CONFIG.COLORS.TANK_AI;
    } else if (isLocal) {
      color = CONFIG.COLORS.TANK_P1;
    } else {
      color = CONFIG.COLORS.TANK_P2;
    }

    // Body
    ctx.fillStyle = color;
    ctx.fillRect(-16, -12, 32, 24);

    // Track details
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-16, -12, 32, 5);
    ctx.fillRect(-16, 7, 32, 5);

    // Barrel — tip at (TANK_HALF + TANK_BARREL_LENGTH) = 32px from center
    if (tank.alive) {
      ctx.fillStyle = '#ddd';
      ctx.fillRect(4, -3.5, 28, 7);
    }

    ctx.restore();

    // Shield effect
    if (tank.shieldTimer > 0 && tank.alive) {
      ctx.strokeStyle = CONFIG.COLORS.SHIELD;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tank.x, tank.y, 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player name tag
    if (tank.alive) {
      ctx.fillStyle = '#fff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tank.playerName || '', tank.x, tank.y - 26);
    }
  }

  drawBullet(bullet) {
    const ctx = this.ctx;
    let color;
    if (bullet.ownerIndex === 0) color = CONFIG.COLORS.BULLET_P1;
    else if (bullet.ownerIndex === 1) color = CONFIG.COLORS.BULLET_P2;

    // Glow
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHUD(gameState, localPlayerIndex) {
    // HUD is managed by HTML overlay, this is for canvas-drawn elements
  }

  addExplosion(x, y) {
    this.explosions.push({ x, y, t: 0, maxT: 0.5 });
  }

  updateExplosions(dt) {
    for (const exp of this.explosions) {
      exp.t += dt;
    }
    this.explosions = this.explosions.filter(e => e.t < e.maxT);
  }

  drawExplosions() {
    const ctx = this.ctx;
    for (const exp of this.explosions) {
      const progress = exp.t / exp.maxT;
      const alpha = 1 - progress;
      const radius = 10 + progress * 20;

      ctx.fillStyle = `rgba(255, 150, 50, ${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
