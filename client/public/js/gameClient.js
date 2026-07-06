class GameClient {
  constructor(network, input, renderer) {
    this.network = network;
    this.input = input;
    this.renderer = renderer;
    this.state = null;
    this.maze = null;
    this.localPlayerIndex = -1;
    this.inputSeq = 0;
    this.inputInterval = null;
    this.onMatchEnd = null;

    // Bind
    this._onGameState = this._onGameState.bind(this);
    this._onGameEvent = this._onGameEvent.bind(this);
    this._onMatchEnd = this._onMatchEnd.bind(this);
    this._onCountdown = this._onCountdown.bind(this);
  }

  init(localPlayerIndex, maze) {
    this.localPlayerIndex = localPlayerIndex;
    this.maze = maze;
    this.state = null;

    this.network.on('game_state', this._onGameState);
    this.network.on('game_event', this._onGameEvent);
    this.network.on('match_end', this._onMatchEnd);
    this.network.on('countdown', this._onCountdown);
  }

  startSendingInput() {
    this.inputInterval = setInterval(() => {
      const raw = this.input.getState();
      this.network.emit('player_input', {
        rotate: raw.rotate,
        thrust: raw.thrust,
        shoot: raw.shoot,
        seq: this.inputSeq++,
      });
      this.input.clearJustPressed();
    }, 33); // ~30Hz
  }

  stopSendingInput() {
    if (this.inputInterval) {
      clearInterval(this.inputInterval);
      this.inputInterval = null;
    }
  }

  _onGameState(state) { this.state = state; }
  _onCountdown(data) {
    const el = document.getElementById('countdown-overlay');
    if (data.seconds > 0) {
      el.classList.remove('hidden');
      el.textContent = data.seconds;
    } else {
      el.classList.add('hidden');
    }
  }

  _onGameEvent(event) {
    if (event.type === 'hit') {
      this.renderer.addExplosion(event.x, event.y);
      this._showKillMsg(event);
    }
  }

  _showKillMsg(event) {
    const feed = document.getElementById('kill-feed');
    // Determine who killed who from score context
    let msg = '';
    if (event.shooterIndex === this.localPlayerIndex) {
      msg = '你击杀了一个敌人！';
    } else if (event.victimIndex === this.localPlayerIndex) {
      msg = '你被击杀了！';
    } else {
      msg = `玩家${event.shooterIndex + 1} 击杀 玩家${event.victimIndex + 1}`;
    }
    const div = document.createElement('div');
    div.className = 'kill-msg';
    div.textContent = msg;
    feed.appendChild(div);
    setTimeout(() => div.remove(), 2000);
  }

  _onMatchEnd(data) {
    console.log('[CLIENT] _onMatchEnd received:', data);
    this.stopSendingInput();
    this.network.off('game_state', this._onGameState);
    this.network.off('game_event', this._onGameEvent);
    this.network.off('match_end', this._onMatchEnd);
    if (this.onMatchEnd) this.onMatchEnd(data);
  }

  cleanup() {
    this.stopSendingInput();
    this.network.off('game_state', this._onGameState);
    this.network.off('game_event', this._onGameEvent);
    this.network.off('match_end', this._onMatchEnd);
  }

  getState() { return this.state; }
  getLocalPlayerIndex() { return this.localPlayerIndex; }
}
