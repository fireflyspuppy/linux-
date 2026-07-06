const GameLoop = require('./GameLoop');
const { generateMaze, findSpawnPositions } = require('./MazeGen');
const { AIController } = require('../ai/AIController');
const Tank = require('./Tank');
const C = require('./constants');

class GameRoom {
  constructor(id, players, options = {}) {
    this.id = id;
    this.players = players;           // Array of { socket, playerIndex, playerName }
    this.isAI = options.isAI || false;
    this.gameLoop = new GameLoop(this);
    this.spawnPositions = [];
    this.inputBuffers = new Map();    // playerIndex -> latest input
    this.aiControllers = new Map();   // playerIndex -> AIController
    this.mazeData = null;             // full maze for AI pathfinding
    this.state = {
      tanks: [],
      bullets: [],
      wallSegments: [],
      maze: null,
    };
    this.onClose = options.onClose || (() => {});
  }

  start() {
    const maze = generateMaze(C.MAZE_ROWS, C.MAZE_COLS);
    this.mazeData = maze;
    this.state.wallSegments = maze.wallSegments;
    this.state.maze = {
      rows: maze.rows,
      cols: maze.cols,
      cellSize: maze.cellSize,
      wallSegments: maze.wallSegments,
    };
    this.spawnPositions = findSpawnPositions(maze, 2);

    // Create tanks
    for (const p of this.players) {
      const sp = this.spawnPositions[p.playerIndex];
      const tank = new Tank({
        playerIndex: p.playerIndex,
        playerName: p.playerName,
        x: sp.x,
        y: sp.y,
        rotation: 0,
        isAI: false,
      });
      this.state.tanks.push(tank);
    }

    // If AI match, add AI tank with controller
    if (this.isAI) {
      const sp = this.spawnPositions[1];
      const aiTank = new Tank({
        playerIndex: 1,
        playerName: 'AI',
        x: sp.x,
        y: sp.y,
        rotation: 180,
        isAI: true,
      });
      this.state.tanks.push(aiTank);
      this.aiControllers.set(1, new AIController(aiTank, maze));
    }

    // Notify all players
    for (const p of this.players) {
      p.socket.emit('match_found', {
        roomId: this.id,
        playerIndex: p.playerIndex,
        opponent: this.players.find(o => o.playerIndex !== p.playerIndex)?.playerName || 'AI',
        isAI: this.isAI,
        maze: this.state.maze,
      });
    }

    this.gameLoop.start();
  }

  getLatestInput(playerIndex) {
    const input = this.inputBuffers.get(playerIndex);
    if (!input) return null;
    const result = { ...input };
    // Consume accumulated shoot flag after reading
    this.inputBuffers.set(playerIndex, { ...input, shoot: false });
    return result;
  }

  onPlayerInput(playerIndex, input) {
    const existing = this.inputBuffers.get(playerIndex);
    // Accumulate shoot flag: once true, stays true until consumed by getLatestInput
    const shoot = (existing?.shoot || false) || input.shoot;
    this.inputBuffers.set(playerIndex, {
      rotate: input.rotate,
      thrust: input.thrust,
      shoot,
    });
  }

  broadcastState() {
    const state = {
      tick: this.gameLoop.tick,
      phase: this.gameLoop.phase,
      roundTimeRemaining: Math.round(this.gameLoop.roundTimeRemaining * 10) / 10,
      countdown: Math.ceil(this.gameLoop.countdownTimer),
      tanks: this.state.tanks.map(t => t.toJSON()),
      bullets: this.state.bullets.map(b => ({
        id: b.id,
        ownerIndex: b.ownerIndex,
        x: Math.round(b.x * 100) / 100,
        y: Math.round(b.y * 100) / 100,
        vx: Math.round(b.vx * 100) / 100,
        vy: Math.round(b.vy * 100) / 100,
        bounces: b.bounces,
      })),
    };

    for (const p of this.players) {
      if (p.socket.connected) {
        p.socket.emit('game_state', state);
      }
    }
  }

  broadcast(event, data) {
    for (const p of this.players) {
      if (p.socket.connected) {
        p.socket.emit(event, data);
      }
    }
  }

  handleDisconnect(playerIndex) {
    // Notify other player and end match
    this.broadcast('game_event', {
      type: 'player_disconnected',
      playerIndex,
    });
    this.gameLoop.stop();
    this.onClose(this.id);
  }

  getRandomRespawnPosition(tank) {
    const otherTanks = this.state.tanks.filter(t => t !== tank && t.alive);
    const margin = C.CELL_SIZE * 3;
    const cells = [];

    for (let r = 1; r < this.mazeData.rows - 1; r++) {
      for (let c = 1; c < this.mazeData.cols - 1; c++) {
        const cx = c * C.CELL_SIZE + C.CELL_SIZE / 2;
        const cy = r * C.CELL_SIZE + C.CELL_SIZE / 2;
        let tooClose = false;
        for (const other of otherTanks) {
          if (Math.abs(cx - other.x) < margin && Math.abs(cy - other.y) < margin) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) cells.push({ x: cx, y: cy });
      }
    }

    if (cells.length > 0) {
      return cells[Math.floor(Math.random() * cells.length)];
    }
    return {
      x: C.CELL_SIZE * 2 + Math.random() * (C.CANVAS_WIDTH - C.CELL_SIZE * 4),
      y: C.CELL_SIZE * 2 + Math.random() * (C.CANVAS_HEIGHT - C.CELL_SIZE * 4),
    };
  }

  onMatchEnd(winner) {
    this.onClose(this.id, {
      winner: winner.toJSON(),
      tanks: this.state.tanks.map(t => t.toJSON()),
    });
  }

  stop() {
    this.gameLoop.stop();
  }
}

module.exports = GameRoom;
