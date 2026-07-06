class InputManager {
  constructor() {
    this.keys = {};
    this.justPressed = {};

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
           'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Enter'].includes(e.code)) {
        e.preventDefault();
      }
      if (!this.keys[e.code]) this.justPressed[e.code] = true;
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  // WASD + Space
  getState() {
    return {
      rotate: (this.keys['KeyA'] ? -1 : 0) + (this.keys['KeyD'] ? 1 : 0),
      thrust: (this.keys['KeyW'] ? 1 : 0) + (this.keys['KeyS'] ? -1 : 0),
      shoot: this.keys['Space'] || false,
    };
  }

  clearJustPressed() {
    this.justPressed = {};
  }
}
