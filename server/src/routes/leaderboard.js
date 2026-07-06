const { Router } = require('express');
const db = require('../db');
const router = Router();

router.get('/', async (_req, res) => {
  const players = await db.getTopPlayers(20);
  res.json(players);
});

router.post('/', async (req, res) => {
  const { name, score_diff, win_diff, loss_diff } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name is required' });
  }
  const player = await db.upsertPlayer(
    name.trim().slice(0, 32),
    parseInt(score_diff) || 0,
    parseInt(win_diff) || 0,
    parseInt(loss_diff) || 0
  );
  if (!player) {
    return res.status(503).json({ error: 'database unavailable' });
  }
  res.json(player);
});

module.exports = router;
