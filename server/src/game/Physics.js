const C = require('./constants');

// Ray vs line segment intersection
// Returns { t, x, y } where t is distance along ray (0-1), or null
function raySegmentIntersection(ox, oy, dx, dy, x1, y1, x2, y2) {
  const sdx = x2 - x1;
  const sdy = y2 - y1;
  const denom = dx * sdy - dy * sdx;

  if (Math.abs(denom) < 1e-10) return null; // parallel

  const t = ((x1 - ox) * sdy - (y1 - oy) * sdx) / denom;
  const u = ((x1 - ox) * dy - (y1 - oy) * dx) / denom;

  // t in (0, 1) means hit along ray (exclude t=0 to avoid self-hit)
  // u in [0, 1] means hit within segment
  if (t > 0.001 && t <= 1.0 && u >= -0.001 && u <= 1.001) {
    return { t, x: ox + t * dx, y: oy + t * dy, nx: 0, ny: 0 };
  }
  return null;
}

// Reflect velocity vector across wall normal
function reflect(vx, vy, nx, ny) {
  const dot = 2 * (vx * nx + vy * ny);
  return { vx: vx - dot * nx, vy: vy - dot * ny };
}

// Update bullet position with bounce. Returns { status: 'alive'|'destroyed', x, y, vx, vy, bounces }
function updateBullet(bullet, dt, wallSegments) {
  const speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
  const steps = Math.max(1, Math.ceil(speed * dt / C.BULLET_RADIUS));

  let { x, y, vx, vy, bounces } = bullet;
  const subDt = dt / steps;

  for (let s = 0; s < steps; s++) {
    let newX = x + vx * subDt;
    let newY = y + vy * subDt;

    // Check all wall segments for collision
    let closestHit = null;
    let closestWall = null;

    for (const wall of wallSegments) {
      const hit = raySegmentIntersection(
        x, y,
        newX - x, newY - y,
        wall.x1, wall.y1, wall.x2, wall.y2
      );
      if (hit && (!closestHit || hit.t < closestHit.t)) {
        closestHit = hit;
        closestWall = wall;
      }
    }

    if (closestHit) {
      // Place bullet at collision point
      x = closestHit.x;
      y = closestHit.y;
      // Reflect velocity
      const r = reflect(vx, vy, closestWall.nx, closestWall.ny);
      vx = r.vx;
      vy = r.vy;
      bounces++;
      if (bounces > C.MAX_BOUNCES) {
        return { status: 'destroyed', x, y, vx, vy, bounces };
      }
      // Move remaining sub-step distance along reflected direction
      const consumed = closestHit.t * subDt;
      const remaining = subDt - consumed;
      x += vx * remaining;
      y += vy * remaining;
    } else {
      x = newX;
      y = newY;
    }
  }

  return { status: 'alive', x, y, vx, vy, bounces };
}

// AABB collision between two rectangles
function aabbOverlap(a, b) {
  const halfA = a.half || C.TANK_HALF;
  const halfB = b.half || C.TANK_HALF;
  return (
    a.x - halfA < b.x + halfB &&
    a.x + halfA > b.x - halfB &&
    a.y - halfA < b.y + halfB &&
    a.y + halfA > b.y - halfB
  );
}

// Check if a point is inside a tank's AABB
function pointInTank(px, py, tank) {
  const half = tank.half || C.TANK_HALF;
  return (
    px >= tank.x - half &&
    px <= tank.x + half &&
    py >= tank.y - half &&
    py <= tank.y + half
  );
}

// Find closest point on a line segment to a given point
function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: x1, y: y1 };

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: x1 + t * dx, y: y1 + t * dy };
}

// Tank-wall collision: iterative push-out
// For each wall segment, if the tank's circular collision body
// overlaps the wall, push the tank away along the shortest direction.
function resolveTankWallCollision(tank, wallSegments) {
  const half = tank.half || C.TANK_HALF;
  // Effective collision radius: tank radius + half wall thickness
  const collisionRadius = half + C.WALL_THICKNESS / 2 + 1;
  let { x, y } = tank;

  // Iterate multiple times to resolve cascading pushes
  for (let iter = 0; iter < 3; iter++) {
    let pushed = false;

    for (const wall of wallSegments) {
      // Find closest point on wall to tank center
      const cp = closestPointOnSegment(x, y, wall.x1, wall.y1, wall.x2, wall.y2);

      // Vector from wall to tank
      const vx = x - cp.x;
      const vy = y - cp.y;
      const dist = Math.sqrt(vx * vx + vy * vy);

      if (dist < collisionRadius && dist > 0.001) {
        // Tank is overlapping the wall, push it out
        const overlap = collisionRadius - dist;
        const nx = vx / dist;  // normalized push direction
        const ny = vy / dist;
        x += nx * overlap;
        y += ny * overlap;
        pushed = true;
      } else if (dist < 0.001) {
        // Tank center is exactly on the wall line (unlikely but handle it)
        // Use wall normal to push
        x += wall.nx * collisionRadius;
        y += wall.ny * collisionRadius;
        pushed = true;
      }
    }

    if (!pushed) break; // No more overlaps, we're done
  }

  return { x, y };
}

// Resolve two tanks overlapping
function resolveTankTankCollision(t1, t2) {
  const half1 = t1.half || C.TANK_HALF;
  const half2 = t2.half || C.TANK_HALF;
  const dx = t2.x - t1.x;
  const dy = t2.y - t1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = half1 + half2;

  if (dist < minDist && dist > 0.001) {
    const overlap = minDist - dist;
    const nx = dx / dist;
    const ny = dy / dist;
    t1.x -= nx * overlap / 2;
    t1.y -= ny * overlap / 2;
    t2.x += nx * overlap / 2;
    t2.y += ny * overlap / 2;
  } else if (dist < 0.001) {
    // Exactly overlapping, push apart arbitrarily
    t1.x -= half1;
    t2.x += half2;
  }
}

module.exports = {
  raySegmentIntersection,
  reflect,
  updateBullet,
  aabbOverlap,
  pointInTank,
  resolveTankWallCollision,
  resolveTankTankCollision,
};
