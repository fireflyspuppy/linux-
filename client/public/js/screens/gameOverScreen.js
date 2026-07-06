class GameOverScreen {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('screen-gameover');
  }

  show(data) {
    console.log('[UI] GameOverScreen.show called, data:', data);
    this.el.classList.remove('hidden');

    const title = document.getElementById('gameover-title');
    const stats = document.getElementById('gameover-stats');

    const localIndex = data.localPlayerIndex || 0;
    const winnerIdx = data.winner !== undefined ? data.winner : data.winnerIndex;
    const won = winnerIdx === localIndex;

    title.textContent = won ? '胜利！' : '失败';
    title.style.color = won ? '#4ecdc4' : '#e94560';

    if (data.tanks) {
      const myTank = data.tanks.find(t => t.playerIndex === localIndex);
      const enemyTank = data.tanks.find(t => t.playerIndex !== localIndex);
      if (myTank && enemyTank) {
        stats.innerHTML = `
          <p>你: ${myTank.score} 击杀 | 对手: ${enemyTank.score} 击杀</p>
        `;
      }
    }

    const isAI = data.isAI !== false;
    const name = localStorage.getItem('tank_name') || 'Player';

    document.getElementById('btn-play-again').onclick = () => {
      this.hide();
      if (isAI) {
        this.app.network.emit('request_ai_match', { name });
      } else {
        this.app.network.emit('join_queue', { name });
      }
      this.app.showScreen('lobby', { isAI, name });
    };
    document.getElementById('btn-back-menu').onclick = () => {
      this.hide();
      this.app.showScreen('menu');
    };
  }

  hide() {
    this.el.classList.add('hidden');
  }

  update(_dt) {}
  render() {}
}
