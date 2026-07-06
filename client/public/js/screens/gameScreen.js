class GameScreen {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('screen-game');
    this.hudP1Name = document.getElementById('hud-p1-name');
    this.hudP2Name = document.getElementById('hud-p2-name');
    this.hudP1Score = document.getElementById('hud-p1-score');
    this.hudP2Score = document.getElementById('hud-p2-score');
    this.hudTimer = document.getElementById('hud-timer');
    this.killFeed = document.getElementById('kill-feed');
    this.countdownEl = document.getElementById('countdown-overlay');
  }

  show(data) {
    this.el.classList.remove('hidden');
    this.countdownEl.classList.add('hidden');
    this.killFeed.innerHTML = '';

    const localIndex = data.playerIndex;
    const opponent = data.opponent || 'AI';

    if (localIndex === 0) {
      this.hudP1Name.textContent = '你';
      this.hudP2Name.textContent = opponent;
    } else {
      this.hudP1Name.textContent = opponent;
      this.hudP2Name.textContent = '你';
    }
    this.hudP1Score.textContent = '0';
    this.hudP2Score.textContent = '0';
    this.hudTimer.textContent = '60';

    // Initialize game client
    this.app.gameClient = new GameClient(this.app.network, this.app.input, this.app.renderer);
    this.app.gameClient.init(localIndex, data.maze);
    this.app.gameClient.onMatchEnd = (result) => {
      console.log('[UI] onMatchEnd called, result:', result);
      const myIndex = localIndex;
      this.hide();
      this.app.showScreen('gameOver', { ...result, localPlayerIndex: myIndex, isAI: data.isAI });
      console.log('[UI] gameover screen shown');
    };
    this.app.gameClient.startSendingInput();
  }

  hide() {
    this.el.classList.add('hidden');
    if (this.app.gameClient) {
      this.app.gameClient.cleanup();
      this.app.gameClient = null;
    }
  }

  update(dt) {
    const gc = this.app.gameClient;
    if (!gc) return;

    const state = gc.getState();
    if (!state) return;

    // Update HUD
    const localIndex = gc.getLocalPlayerIndex();
    const myTank = state.tanks.find(t => t.playerIndex === localIndex);
    const enemyTank = state.tanks.find(t => t.playerIndex !== localIndex);

    if (myTank) this.hudP1Score.textContent = myTank.score;
    if (enemyTank) this.hudP2Score.textContent = enemyTank.score;
    this.hudTimer.textContent = Math.ceil(state.roundTimeRemaining);

    this.app.renderer.updateExplosions(dt);
  }

  render() {
    const gc = this.app.gameClient;
    if (!gc) return;

    const state = gc.getState();
    const localIndex = gc.getLocalPlayerIndex();
    const renderer = this.app.renderer;

    renderer.clear();

    // Draw maze
    if (this._mazeCache) {
      renderer.drawMaze(this._mazeCache);
    }

    // Draw bullets
    if (state && state.bullets) {
      for (const bullet of state.bullets) {
        renderer.drawBullet(bullet);
      }
    }

    // Draw tanks
    if (state && state.tanks) {
      for (const tank of state.tanks) {
        renderer.drawTank(tank, tank.playerIndex === localIndex);
      }
    }

    // Draw explosions
    renderer.drawExplosions();

    // Draw countdown if visible
    if (state && state.phase === 'COUNTDOWN' && state.countdown > 0) {
      this.countdownEl.classList.remove('hidden');
      this.countdownEl.textContent = state.countdown;
    } else if (state && state.phase === 'PLAYING') {
      this.countdownEl.classList.add('hidden');
    }
  }

  set mazeCache(maze) { this._mazeCache = maze?.wallSegments; }
}
