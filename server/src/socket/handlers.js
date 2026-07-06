const MatchMaker = require('../matchmaking/MatchMaker');
const db = require('../db');

const matchMaker = new MatchMaker();

// Set up match result recording
matchMaker.onMatchResult = async (roomId, result) => {
  if (!result || !result.tanks) return;
  try {
    for (const tank of result.tanks) {
      if (tank.isAI) continue;
      const winnerScore = result.winner.playerIndex === tank.playerIndex ? 1 : 0;
      await db.upsertPlayer(
        tank.playerName,
        tank.score,
        winnerScore,
        winnerScore === 0 ? 1 : 0
      );
    }
  } catch (err) {
    console.error('Failed to record match result:', err.message);
  }
};

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('join_queue', (data) => {
      const name = (data && data.name) || `Player_${socket.id.slice(0, 5)}`;
      matchMaker.enqueue(socket, name);
    });

    socket.on('leave_queue', () => {
      matchMaker.dequeue(socket.id);
    });

    socket.on('request_ai_match', (data) => {
      const name = (data && data.name) || `Player_${socket.id.slice(0, 5)}`;
      matchMaker.createAIMatch(socket, name);
    });

    socket.on('player_input', (data) => {
      const room = matchMaker.findRoomBySocketId(socket.id);
      if (!room) return;

      const player = room.players.find(p => p.socket.id === socket.id);
      if (!player) return;
      room.onPlayerInput(player.playerIndex, {
        rotate: Math.max(-1, Math.min(1, data.rotate || 0)),
        thrust: Math.max(-1, Math.min(1, data.thrust || 0)),
        shoot: !!data.shoot,
      });
    });

    socket.on('ping', (data) => {
      socket.emit('pong', { serverTime: Date.now(), clientTime: data?.clientTime });
    });

    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      matchMaker.dequeue(socket.id);

      // Handle in-game disconnect
      const room = matchMaker.findRoomBySocketId(socket.id);
      if (room) {
        const player = room.players.find(p => p.socket.id === socket.id);
        if (player) {
          room.handleDisconnect(player.playerIndex);
        }
      }
    });
  });
}

module.exports = { setupSocketHandlers, matchMaker };
