class App {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.network = new NetworkClient();
    this.input = new InputManager();
    this.renderer = new Renderer(this.ctx);
    this.gameClient = null;
    this.currentScreen = null;
    this._lastTime = 0;

    this.screens = {
      menu: new MenuScreen(this),
      lobby: new LobbyScreen(this),
      game: new GameScreen(this),
      gameOver: new GameOverScreen(this),
    };
  }

  init() {
    this.canvas.width = CONFIG.CANVAS_WIDTH;
    this.canvas.height = CONFIG.CANVAS_HEIGHT;
    this.network.connect();
    this.screens.menu.setupEvents();
    this.showScreen('menu');
    this._startLoop();
  }

  showScreen(name, data) {
    if (this.currentScreen && this.currentScreen.hide) {
      this.currentScreen.hide();
    }
    this.currentScreen = this.screens[name];
    if (data) {
      // Pass maze data to game screen
      if (name === 'game' && data.maze) {
        this.screens.game.mazeCache = data.maze;
      }
    }
    this.currentScreen.show(data);
  }

  _startLoop() {
    const loop = (timestamp) => {
      const dt = this._lastTime ? Math.min((timestamp - this._lastTime) / 1000, 0.1) : 0.016;
      this._lastTime = timestamp;

      if (this.currentScreen) {
        if (this.currentScreen.update) this.currentScreen.update(dt);
        if (this.currentScreen.render) this.currentScreen.render();
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
