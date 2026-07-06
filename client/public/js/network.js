class NetworkClient {
  constructor() {
    this.socket = null;
    this.listeners = {};
    this.connected = false;
  }

  connect() {
    this.socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      console.log('WS connected:', this.socket.id);
      this.connected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WS disconnected:', reason);
      this.connected = false;
    });

    this.socket.onAny((event, data) => {
      if (this.listeners[event]) {
        for (const fn of this.listeners[event]) fn(data);
      }
    });
  }

  on(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  off(event, fn) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(f => f !== fn);
  }

  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }

  getId() { return this.socket?.id || ''; }
}
