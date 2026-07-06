const C = require('./constants');

const DIRS = [
  { dr: -1, dc: 0, wall: 'N', opp: 'S' },
  { dr: 1, dc: 0, wall: 'S', opp: 'N' },
  { dr: 0, dc: 1, wall: 'E', opp: 'W' },
  { dr: 0, dc: -1, wall: 'W', opp: 'E' },
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMaze(rows, cols) {
  // Each cell: { walls: { N:true, S:true, E:true, W:true } }
  const cells = [];
  for (let r = 0; r < rows; r++) {
    cells[r] = [];
    for (let c = 0; c < cols; c++) {
      cells[r][c] = { r, c, walls: { N: true, S: true, E: true, W: true } };
    }
  }

  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const sr = randInt(0, rows - 1);
  const sc = randInt(0, cols - 1);
  visited[sr][sc] = true;

  const frontier = [];
  for (const d of DIRS) {
    const nr = sr + d.dr, nc = sc + d.dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      frontier.push({ r1: sr, c1: sc, r2: nr, c2: nc });
    }
  }

  while (frontier.length > 0) {
    const idx = randInt(0, frontier.length - 1);
    const { r1, c1, r2, c2 } = frontier.splice(idx, 1)[0];

    if (visited[r2][c2]) continue;

    // Find direction and carve passage
    for (const d of DIRS) {
      if (r1 + d.dr === r2 && c1 + d.dc === c2) {
        cells[r1][c1].walls[d.wall] = false;
        cells[r2][c2].walls[d.opp] = false;
        break;
      }
    }

    visited[r2][c2] = true;

    for (const d of DIRS) {
      const nr = r2 + d.dr, nc = c2 + d.dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        frontier.push({ r1: r2, c1: c2, r2: nr, c2: nc });
      }
    }
  }

  // Punch a few extra holes to create loops (less dead ends)
  const extraHoles = Math.floor(rows * cols * 0.03);
  for (let i = 0; i < extraHoles; i++) {
    const r = randInt(0, rows - 1);
    const c = randInt(0, cols - 1);
    const d = DIRS[randInt(0, 3)];
    const nr = r + d.dr, nc = c + d.dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      cells[r][c].walls[d.wall] = false;
      cells[nr][nc].walls[d.opp] = false;
    }
  }

  // Build wall segment list for physics
  const wallSegments = [];
  const cs = C.CELL_SIZE;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cs, y = r * cs;
      if (cells[r][c].walls.N) {
        wallSegments.push({ x1: x, y1: y, x2: x + cs, y2: y, nx: 0, ny: 1 });
      }
      if (cells[r][c].walls.W) {
        wallSegments.push({ x1: x, y1: y, x2: x, y2: y + cs, nx: 1, ny: 0 });
      }
      // Only add S/E for edge cells (inner walls handled by neighbor's N/W)
      if (r === rows - 1 && cells[r][c].walls.S) {
        wallSegments.push({ x1: x, y1: y + cs, x2: x + cs, y2: y + cs, nx: 0, ny: -1 });
      }
      if (c === cols - 1 && cells[r][c].walls.E) {
        wallSegments.push({ x1: x + cs, y1: y, x2: x + cs, y2: y + cs, nx: -1, ny: 0 });
      }
    }
  }

  return { cells, wallSegments, rows, cols, cellSize: cs };
}

// Find empty spawn positions (cells with open space, far from walls)
function findSpawnPositions(maze, count) {
  const positions = [];
  const margin = 2;
  const cs = maze.cellSize;

  for (let r = margin; r < maze.rows - margin; r++) {
    for (let c = margin; c < maze.cols - margin; c++) {
      const cell = maze.cells[r][c];
      const openWalls = Object.values(cell.walls).filter(w => !w).length;
      // Prefer cells with multiple open passages
      if (openWalls >= 2) {
        positions.push({
          x: c * cs + cs / 2,
          y: r * cs + cs / 2,
          r,
          c,
        });
      }
    }
  }

  // Shuffle and pick 'count' positions far apart
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  const chosen = [];
  for (const pos of positions) {
    if (chosen.length >= count) break;
    const tooClose = chosen.some(p =>
      Math.abs(p.x - pos.x) < cs * 3 && Math.abs(p.y - pos.y) < cs * 3
    );
    if (!tooClose) chosen.push({ x: pos.x, y: pos.y, r: pos.r, c: pos.c });
  }

  // Fallback: use any positions
  while (chosen.length < count) {
    const p = positions[chosen.length] || { x: cs * (chosen.length + 1), y: cs * (chosen.length + 1) };
    chosen.push(p);
  }

  return chosen;
}

module.exports = { generateMaze, findSpawnPositions };
