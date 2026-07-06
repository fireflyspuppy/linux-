// Bullet is a plain object managed by GameLoop. This module provides helpers.
const C = require('./constants');

function createBullet(ownerIndex, x, y, rotation) {
  const rad = rotation * Math.PI / 180;
  const speed = C.BULLET_SPEED;
  return {
    id: `bullet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ownerIndex,
    x,
    y,
    vx: Math.cos(rad) * speed,
    vy: -Math.sin(rad) * speed,
    bounces: 0,
    active: true,
  };
}

function bulletToJSON(bullet) {
  return {
    id: bullet.id,
    ownerIndex: bullet.ownerIndex,
    x: Math.round(bullet.x * 100) / 100,
    y: Math.round(bullet.y * 100) / 100,
    vx: Math.round(bullet.vx * 100) / 100,
    vy: Math.round(bullet.vy * 100) / 100,
    bounces: bullet.bounces,
  };
}

module.exports = { createBullet, bulletToJSON };
