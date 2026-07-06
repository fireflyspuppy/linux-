class MenuScreen {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('screen-menu');
    this.leaderboardPanel = document.getElementById('leaderboard-panel');
    this.leaderboardList = document.getElementById('leaderboard-list');
  }

  show() {
    this.el.classList.remove('hidden');
    this.leaderboardPanel.classList.add('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
  }

  async showLeaderboard() {
    try {
      const resp = await fetch('/api/leaderboard');
      const data = await resp.json();
      this.leaderboardList.innerHTML = '';
      if (data.length === 0) {
        this.leaderboardList.innerHTML = '<li>暂无记录</li>';
      } else {
        data.forEach(p => {
          const li = document.createElement('li');
          li.textContent = `${p.player_name} — ${p.score}分 (${p.wins}胜 ${p.losses}负)`;
          this.leaderboardList.appendChild(li);
        });
      }
    } catch (e) {
      this.leaderboardList.innerHTML = '<li>排行榜暂不可用</li>';
    }
    this.leaderboardPanel.classList.remove('hidden');
  }

  setupEvents() {
    const btnAIMatch = document.getElementById('btn-ai-match');
    const btnQueue = document.getElementById('btn-queue');
    const btnLeaderboard = document.getElementById('btn-leaderboard');
    const btnCloseLB = document.getElementById('btn-close-leaderboard');

    btnAIMatch.addEventListener('click', () => {
      this._getNameAndStart(true);
    });

    btnQueue.addEventListener('click', () => {
      this._getNameAndStart(false);
    });

    btnLeaderboard.addEventListener('click', () => {
      this.showLeaderboard();
    });

    btnCloseLB.addEventListener('click', () => {
      this.leaderboardPanel.classList.add('hidden');
    });
  }

  _getNameAndStart(isAI) {
    let name = localStorage.getItem('tank_name');
    if (!name) {
      name = 'Player_' + Math.random().toString(36).slice(2, 7);
      localStorage.setItem('tank_name', name);
    }
    // Allow editing name
    const newName = prompt('输入你的名字:', name);
    if (newName === null) return; // cancelled
    if (newName.trim()) {
      name = newName.trim().slice(0, 32);
      localStorage.setItem('tank_name', name);
    }

    this.hide();
    if (isAI) {
      this.app.network.emit('request_ai_match', { name });
      this.app.showScreen('lobby', { isAI: true, name });
    } else {
      this.app.network.emit('join_queue', { name });
      this.app.showScreen('lobby', { isAI: false, name });
    }
  }

  update(_dt) {}
  render() {}
}
