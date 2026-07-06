const GameRoom = require('../game/GameRoom');

class MatchMaker {
  constructor() {
    this.queue = [];        // { socket, playerName }
    this.rooms = new Map(); // roomId -> GameRoom
    this.nextRoomId = 1;
    this.onMatchResult = null; // callback(roomId, result)
  }

  enqueue(socket, playerName) {
    // Remove if already in queue
    this.dequeue(socket.id);

    this.queue.push({ socket, playerName });
    socket.emit('queue_status', { position: this.queue.length });

    // Notify other queued players
    this.notifyQueue();

    // Try to match
    this.tryMatch();
  }

  dequeue(socketId) {
    const idx = this.queue.findIndex(p => p.socket.id === socketId);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      this.notifyQueue();
    }
  }

  notifyQueue() {
    for (let i = 0; i < this.queue.length; i++) {
      this.queue[i].socket.emit('queue_status', { position: i + 1 });
    }
  }

  tryMatch() {
    if (this.queue.length >= 2) {
      const p1 = this.queue.shift();
      const p2 = this.queue.shift();
      this.notifyQueue();

      const roomId = `room_${this.nextRoomId++}`;
      const players = [
        { socket: p1.socket, playerIndex: 0, playerName: p1.playerName },
        { socket: p2.socket, playerIndex: 1, playerName: p2.playerName },
      ];

      const room = new GameRoom(roomId, players, {
        isAI: false,
        onClose: (id, result) => this.onRoomClose(id, result),
      });

      this.rooms.set(roomId, room);
      room.start();
      return room;
    }
    return null;
  }

  createAIMatch(socket, playerName) {
    // Remove from queue if present
    this.dequeue(socket.id);

    const roomId = `room_ai_${this.nextRoomId++}`;
    const players = [
      { socket, playerIndex: 0, playerName },
    ];

    const room = new GameRoom(roomId, players, {
      isAI: true,
      onClose: (id, result) => this.onRoomClose(id, result),
    });

    this.rooms.set(roomId, room);
    room.start();
    return room;
  }

  onRoomClose(roomId, result) {
    this.rooms.delete(roomId);
    if (this.onMatchResult) {
      this.onMatchResult(roomId, result);
    }
  }

  findRoomBySocketId(socketId) {
    for (const [id, room] of this.rooms) {
      if (room.players.some(p => p.socket.id === socketId)) {
        return room;
      }
    }
    return null;
  }

  getQueueLength() {
    return this.queue.length;
  }
}

module.exports = MatchMaker;
