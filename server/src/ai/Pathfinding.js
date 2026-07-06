const C = require('../game/constants');

// A* pathfinding on the maze cell graph
// Nodes are cells (r, c). Edges exist between adjacent cells that share an open wall.

class MinHeap {
  constructor() {
    this.data = [];
  }

  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }

  pop() {
    if (this.data.length === 0) return null;
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() { return this.data.length; }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.data[idx].f < this.data[parent].f) {
        [this.data[idx], this.data[parent]] = [this.data[parent], this.data[idx]];
        idx = parent;
      } else break;
    }
  }

  _sinkDown(idx) {
    const len = this.data.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < len && this.data[left].f < this.data[smallest].f) smallest = left;
      if (right < len && this.data[right].f < this.data[smallest].f) smallest = right;
      if (smallest !== idx) {
        [this.data[idx], this.data[smallest]] = [this.data[smallest], this.data[idx]];
        idx = smallest;
      } else break;
    }
  }
}

function findPath(maze, startR, startC, goalR, goalC) {
  const rows = maze.rows;
  const cols = maze.cols;
  const cells = maze.cells;

  // Build adjacency on the fly
  const getNeighbors = (r, c) => {
    const neighbors = [];
    const cell = cells[r][c];
    if (!cell.walls.N && r > 0) neighbors.push({ r: r - 1, c });
    if (!cell.walls.S && r < rows - 1) neighbors.push({ r: r + 1, c });
    if (!cell.walls.E && c < cols - 1) neighbors.push({ r, c: c + 1 });
    if (!cell.walls.W && c > 0) neighbors.push({ r, c: c - 1 });
    return neighbors;
  };

  const heuristic = (r, c) => Math.abs(r - goalR) + Math.abs(c - goalC);

  const openSet = new MinHeap();
  const cameFrom = new Map();
  const gScore = new Map();

  const startKey = `${startR},${startC}`;
  gScore.set(startKey, 0);
  openSet.push({ r: startR, c: startC, f: heuristic(startR, startC) });

  while (openSet.size > 0) {
    const current = openSet.pop();
    const currentKey = `${current.r},${current.c}`;

    if (current.r === goalR && current.c === goalC) {
      // Reconstruct path
      const path = [];
      let key = currentKey;
      while (cameFrom.has(key)) {
        const [r, c] = key.split(',').map(Number);
        path.unshift({ r, c });
        key = cameFrom.get(key);
      }
      return path;
    }

    for (const nbr of getNeighbors(current.r, current.c)) {
      const nbrKey = `${nbr.r},${nbr.c}`;
      const tentativeG = (gScore.get(currentKey) || 0) + 1;

      if (!gScore.has(nbrKey) || tentativeG < gScore.get(nbrKey)) {
        gScore.set(nbrKey, tentativeG);
        cameFrom.set(nbrKey, currentKey);
        openSet.push({ r: nbr.r, c: nbr.c, f: tentativeG + heuristic(nbr.r, nbr.c) });
      }
    }
  }

  return null; // No path
}

// Convert world position to cell coordinates
function worldToCell(x, y) {
  return {
    r: Math.floor(y / C.CELL_SIZE),
    c: Math.floor(x / C.CELL_SIZE),
  };
}

// Convert cell center to world position
function cellToWorld(r, c) {
  return {
    x: c * C.CELL_SIZE + C.CELL_SIZE / 2,
    y: r * C.CELL_SIZE + C.CELL_SIZE / 2,
  };
}

// Check if there's line of sight between two cells (no walls blocking)
function hasLineOfSight(maze, r1, c1, r2, c2) {
  // Simple: check if they're in same row or column with no walls between
  if (r1 === r2) {
    const minC = Math.min(c1, c2);
    const maxC = Math.max(c1, c2);
    for (let c = minC; c < maxC; c++) {
      if (maze.cells[r1][c].walls.E) return false;
    }
    return true;
  }
  if (c1 === c2) {
    const minR = Math.min(r1, r2);
    const maxR = Math.max(r1, r2);
    for (let r = minR; r < maxR; r++) {
      if (maze.cells[r][c1].walls.S) return false;
    }
    return true;
  }
  return false;
}

module.exports = { findPath, worldToCell, cellToWorld, hasLineOfSight };
