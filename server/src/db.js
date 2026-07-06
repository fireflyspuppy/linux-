const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'tanktrouble.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT UNIQUE NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    games_played INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC)');

let enabled = true;

function testConnection() {
  // SQLite is always connected
  db.prepare('SELECT 1').get();
}

function query(text, params = []) {
  if (!enabled) return null;
  try {
    const stmt = db.prepare(text);
    // For SELECT queries, return rows via .all(); for others, .run()
    if (text.trim().toUpperCase().startsWith('SELECT') || text.trim().toUpperCase().startsWith('WITH')) {
      return { rows: stmt.all(...params) };
    }
    return stmt.run(...params);
  } catch (err) {
    console.error('DB query error:', err.message);
    return null;
  }
}

async function getTopPlayers(limit = 20) {
  const result = query(
    'SELECT player_name, score, wins, losses, games_played FROM leaderboard ORDER BY score DESC LIMIT ?',
    [limit]
  );
  return result ? result.rows : [];
}

async function upsertPlayer(name, scoreDiff, winDiff, lossDiff) {
  const result = query(
    `INSERT INTO leaderboard (player_name, score, wins, losses, games_played)
     VALUES (?, MAX(0, ?), MAX(0, ?), MAX(0, ?), 1)
     ON CONFLICT (player_name) DO UPDATE SET
       score = MAX(0, leaderboard.score + ?),
       wins = leaderboard.wins + ?,
       losses = leaderboard.losses + ?,
       games_played = leaderboard.games_played + 1,
       updated_at = datetime('now')
     RETURNING *`,
    [name, scoreDiff, winDiff, lossDiff, scoreDiff, winDiff, lossDiff]
  );
  return result ? result.rows[0] : null;
}

module.exports = { testConnection, getTopPlayers, upsertPlayer, query };
