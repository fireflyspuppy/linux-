class LobbyScreen {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('screen-lobby');
    this.positionEl = document.getElementById('queue-position');
    this.isAI = false;
  }

  show(data) {
    this.isAI = data.isAI;
    this.el.classList.remove('hidden');

    if (this.isAI) {
      this.positionEl.textContent = '正在创建 AI 对战...';
      // AI match is instant - wait for match_found
    } else {
      this.positionEl.textContent = '队列位置: 1';
      this.app.network.on('queue_status', this._onQueueStatus);
    }

    this.app.network.on('match_found', this._onMatchFound);

    document.getElementById('btn-cancel-queue').onclick = () => {
      this.app.network.emit('leave_queue');
      this.app.network.off('match_found', this._onMatchFound);
      this.app.network.off('queue_status', this._onQueueStatus);
      this.hide();
      this.app.showScreen('menu');
    };
  }

  hide() {
    this.el.classList.add('hidden');
  }

  _onQueueStatus = (data) => {
    if (data.position > 0) {
      this.positionEl.textContent = `队列位置: ${data.position}`;
    }
  };

  _onMatchFound = (data) => {
    this.app.network.off('queue_status', this._onQueueStatus);
    this.app.network.off('match_found', this._onMatchFound);
    this.hide();
    this.app.showScreen('game', data);
  };

  update(_dt) {}
  render() {}
}
