module.exports = {
  TICK_RATE: 20,
  TICK_INTERVAL: 1000 / 20,       // 50ms

  // Tank
  TANK_SPEED: 150,                 // pixels/sec
  TANK_ROTATION_SPEED: 180,        // degrees/sec
  TANK_SIZE: 32,                   // pixels, square collision box
  TANK_BARREL_LENGTH: 16,

  // Bullet
  BULLET_SPEED: 400,               // pixels/sec
  BULLET_RADIUS: 4,
  MAX_BOUNCES: 15,
  MAX_SIMULTANEOUS_BULLETS: 4,
  SHOOT_COOLDOWN: 350,             // ms
  BULLET_SUB_STEPS: 4,             // min sub-steps per frame to avoid tunneling

  // Game
  RESPAWN_DELAY: 3000,             // ms
  ROUND_DURATION: 60,              // seconds
  SCORE_TO_WIN: 5,
  RESPAWN_SHIELD_TIME: 2,          // seconds

  // Maze
  CELL_SIZE: 64,                   // pixels
  MAZE_ROWS: 13,
  MAZE_COLS: 19,
  WALL_THICKNESS: 4,

  // Canvas (derived)
  get CANVAS_WIDTH()  { return this.MAZE_COLS * this.CELL_SIZE; },   // 1216
  get CANVAS_HEIGHT() { return this.MAZE_ROWS * this.CELL_SIZE; },   // 832
};
