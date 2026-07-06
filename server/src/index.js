const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const { setupSocketHandlers } = require('./socket/handlers');
const leaderboard = require('./routes/leaderboard');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});

app.use(cors());
app.use(express.json());

// Serve static client files
const clientDir = path.join(__dirname, '..', '..', 'client', 'public');
app.use(express.static(clientDir));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/leaderboard', leaderboard);

setupSocketHandlers(io);

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await db.testConnection();
    console.log('Database connected');
  } catch (err) {
    console.warn('Database not available, leaderboard disabled:', err.message);
  }
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
