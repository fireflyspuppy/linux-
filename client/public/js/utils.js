// Vector math utilities
const Utils = {
  degToRad(deg) { return deg * Math.PI / 180; },
  radToDeg(rad) { return rad * 180 / Math.PI; },

  dist(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  lerp(a, b, t) { return a + (b - a) * t; },

  clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },
};
