(function (root) {
  'use strict';

  const WORLD_W = 1280;
  const WORLD_H = 720;
  const FATAL_FALL_DIST = 120;
  const MAX_STEP_UP = 6;
  const MAX_STEP_DOWN = 6;

  const SKILL_KEYS = [
    'climber',
    'floater',
    'bomber',
    'blocker',
    'builder',
    'basher',
    'miner',
    'digger'
  ];

  // ===========================================================================
  // WEBAUDIO PROCEDURAL SOUND SYNTHESIZER (No external audio files)
  // ===========================================================================
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.muted = false;
      try {
        const saved = localStorage.getItem('lemmings_muted');
        if (saved === '1') this.muted = true;
      } catch (_) {}
    }

    ensureContext() {
      if (this.muted) return null;
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          try {
            this.ctx = new AudioCtx();
          } catch (_) {}
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    setMuted(flag) {
      this.muted = !!flag;
      try {
        localStorage.setItem('lemmings_muted', this.muted ? '1' : '0');
      } catch (_) {}
    }

    toggleMute() {
      this.setMuted(!this.muted);
      if (!this.muted) this.playClick();
      return this.muted;
    }

    playTone(freqStart, freqEnd, duration, type = 'square', gainVal = 0.08, delay = 0) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freqStart, now);
        if (freqEnd !== freqStart) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
        }
        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.01);
      } catch (_) {}
    }

    playClick() {
      this.playTone(660, 880, 0.045, 'square', 0.05);
    }

    playAssign() {
      this.playTone(520, 780, 0.07, 'square', 0.07, 0);
      this.playTone(780, 1040, 0.09, 'triangle', 0.07, 0.06);
    }

    playInvalid() {
      this.playTone(220, 140, 0.11, 'sawtooth', 0.06);
    }

    playBrick(lowLeft) {
      const base = lowLeft ? 920 : 440;
      this.playTone(base, base * 1.15, 0.04, 'triangle', 0.05);
    }

    playSteelClink() {
      this.playTone(1480, 620, 0.08, 'square', 0.06);
    }

    playSplat() {
      this.playTone(320, 65, 0.18, 'sawtooth', 0.09);
    }

    playSplash() {
      this.playTone(480, 160, 0.16, 'sine', 0.07);
      this.playTone(260, 390, 0.12, 'triangle', 0.05, 0.08);
    }

    playBurn() {
      this.playTone(600, 120, 0.2, 'sawtooth', 0.08);
    }

    playCrush() {
      this.playTone(130, 42, 0.18, 'sawtooth', 0.1);
    }

    playOhNo() {
      this.playTone(740, 580, 0.12, 'square', 0.07, 0);
      this.playTone(540, 320, 0.18, 'square', 0.07, 0.12);
    }

    playExplosion() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      try {
        const duration = 0.32;
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(520, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + duration);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.16, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
      } catch (_) {}
    }

    playSave() {
      this.playTone(523.25, 659.25, 0.08, 'triangle', 0.08, 0);
      this.playTone(659.25, 783.99, 0.08, 'triangle', 0.08, 0.07);
      this.playTone(783.99, 1046.5, 0.14, 'triangle', 0.09, 0.14);
    }

    playWinJingle() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
      const durs = [0.11, 0.11, 0.11, 0.18, 0.1, 0.3];
      let t = 0;
      for (let i = 0; i < notes.length; i++) {
        this.playTone(notes[i], notes[i], durs[i], 'triangle', 0.09, t);
        t += durs[i] + 0.02;
      }
    }

    playLoseJingle() {
      const notes = [392.0, 369.99, 349.23, 311.13];
      let t = 0;
      for (let i = 0; i < notes.length; i++) {
        this.playTone(notes[i], notes[i] * 0.96, 0.18, 'sawtooth', 0.07, t);
        t += 0.2;
      }
    }
  }

  // ===========================================================================
  // CORE SIMULATION ENGINE
  // ===========================================================================
  class LemmingsEngine {
    constructor(options = {}) {
      this.width = WORLD_W;
      this.height = WORLD_H;
      this.sfx = options.sfx || null;
      this.headless = !!options.headless;

      this.terrainAlpha = new Uint8Array(this.width * this.height);
      this.steelMask = new Uint8Array(this.width * this.height);

      this.terrainCanvas = null;
      this.terrainCtx = null;
      this.steelCanvas = null;
      this.steelCtx = null;

      if (!this.headless && typeof document !== 'undefined') {
        this.terrainCanvas = document.createElement('canvas');
        this.terrainCanvas.width = this.width;
        this.terrainCanvas.height = this.height;
        this.terrainCtx = this.terrainCanvas.getContext('2d', { willReadFrequently: true });

        this.steelCanvas = document.createElement('canvas');
        this.steelCanvas.width = this.width;
        this.steelCanvas.height = this.height;
        this.steelCtx = this.steelCanvas.getContext('2d');
      }

      this.level = null;
      this.levelIndex = 0;
      this.tickCount = 0;
      this.lemmings = [];
      this.particles = [];
      this.nextLemmingId = 1;

      this.spawnedCount = 0;
      this.savedCount = 0;
      this.lostCount = 0;
      this.releaseRate = 50;
      this.minReleaseRate = 20;
      this.spawnTimer = 0;
      this.nuked = false;
      this.timeRemainingTicks = 0;
      this.skills = {};
      this.selectedSkill = 'builder';
      this.finished = false;
      this.won = false;
    }

    loadLevel(levelDef, index = 0) {
      this.level = levelDef;
      this.levelIndex = index;
      this.tickCount = 0;
      this.lemmings = [];
      this.particles = [];
      this.nextLemmingId = 1;

      this.spawnedCount = 0;
      this.savedCount = 0;
      this.lostCount = 0;
      this.releaseRate = levelDef.releaseRate || 40;
      this.minReleaseRate = levelDef.minReleaseRate || 15;
      this.spawnTimer = 35; // Initial trapdoor open delay
      this.nuked = false;
      this.timeRemainingTicks = (levelDef.timeLimit || 180) * 60;
      this.finished = false;
      this.won = false;

      this.skills = {};
      for (const k of SKILL_KEYS) {
        this.skills[k] = (levelDef.skills && levelDef.skills[k]) || 0;
      }

      // Select first skill with count > 0
      this.selectedSkill = SKILL_KEYS.find((k) => this.skills[k] > 0) || 'builder';

      this.buildTerrainAndSteel(levelDef);
    }

    getSpawnIntervalTicks() {
      // Maps releaseRate 1..99 to 155..14 ticks
      return Math.max(14, Math.round(158 - this.releaseRate * 1.45));
    }

    adjustReleaseRate(delta) {
      this.releaseRate = Math.max(this.minReleaseRate, Math.min(99, this.releaseRate + delta));
      return this.releaseRate;
    }

    // -------------------------------------------------------------------------
    // TERRAIN & STEEL INITIALIZATION AND PROCEDURAL RENDERING
    // -------------------------------------------------------------------------
    buildTerrainAndSteel(levelDef) {
      this.terrainAlpha.fill(0);
      this.steelMask.fill(0);

      if (this.terrainCtx) {
        this.terrainCtx.clearRect(0, 0, this.width, this.height);
        this.terrainCtx.globalCompositeOperation = 'source-over';
      }
      if (this.steelCtx) {
        this.steelCtx.clearRect(0, 0, this.width, this.height);
      }

      const theme = levelDef.theme || {
        dirtMain: '#7c5333',
        dirtDark: '#56371e',
        dirtLight: '#9e6d47',
        crustTop: '#3ca352',
        crustHighlight: '#63cc78',
        rockAccent: '#3f4d5e'
      };

      // Build terrain primitives
      for (const shape of levelDef.terrain || []) {
        if (shape.type === 'rect') {
          this.fillRectMask(this.terrainAlpha, shape.x, shape.y, shape.w, shape.h, 255);
          if (this.terrainCtx) {
            this.drawTexturedRect(this.terrainCtx, shape, theme);
          }
        } else if (shape.type === 'circle') {
          this.fillCircleMask(this.terrainAlpha, shape.cx, shape.cy, shape.r, 255);
          if (this.terrainCtx) {
            this.drawTexturedCircle(this.terrainCtx, shape, theme);
          }
        } else if (shape.type === 'polygon' && Array.isArray(shape.points)) {
          this.fillPolygonMask(this.terrainAlpha, shape.points, 255);
          if (this.terrainCtx) {
            this.drawTexturedPolygon(this.terrainCtx, shape, theme);
          }
        } else if (shape.type === 'carveRect') {
          this.fillRectMask(this.terrainAlpha, shape.x, shape.y, shape.w, shape.h, 0);
          if (this.terrainCtx) {
            this.terrainCtx.save();
            this.terrainCtx.globalCompositeOperation = 'destination-out';
            this.terrainCtx.fillStyle = '#000';
            this.terrainCtx.fillRect(shape.x, shape.y, shape.w, shape.h);
            this.terrainCtx.restore();
          }
        } else if (shape.type === 'carveCircle') {
          this.fillCircleMask(this.terrainAlpha, shape.cx, shape.cy, shape.r, 0);
          if (this.terrainCtx) {
            this.terrainCtx.save();
            this.terrainCtx.globalCompositeOperation = 'destination-out';
            this.terrainCtx.beginPath();
            this.terrainCtx.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
            this.terrainCtx.fill();
            this.terrainCtx.restore();
          }
        }
      }

      // Sync terrainAlpha from terrainCtx ImageData when running in browser
      if (this.terrainCtx) {
        this.syncAlphaFromCanvas(0, 0, this.width, this.height);
      }

      // Build steel blocks
      for (const s of levelDef.steel || []) {
        this.fillRectMask(this.steelMask, s.x, s.y, s.w, s.h, 255);
        if (this.steelCtx) {
          this.drawSteelBlock(this.steelCtx, s.x, s.y, s.w, s.h);
        }
      }
    }

    drawTexturedRect(ctx, shape, theme) {
      const { x, y, w, h, style, crust } = shape;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      const baseColor = style === 'rock' ? theme.rockAccent : theme.dirtMain;
      ctx.fillStyle = baseColor;
      ctx.fillRect(x, y, w, h);

      // Horizontal geological strata bands (4px pixel grid)
      for (let py = y; py < y + h; py += 4) {
        const band = ((py >> 2) * 13) % 7;
        if (band === 0 || band === 3) {
          ctx.fillStyle = theme.dirtDark;
          ctx.fillRect(x, py, w, 4);
        } else if (band === 5 && style !== 'rock') {
          ctx.fillStyle = theme.dirtLight;
          ctx.fillRect(x, py, w, 2);
        }
      }

      // Chunky pixel-art pebbles and speckles
      let seed = (x * 73856093) ^ (y * 19349663);
      const count = Math.floor((w * h) / 140);
      for (let i = 0; i < count; i++) {
        seed = (seed * 1664525 + 1013904223) | 0;
        const px = x + ((Math.abs(seed) % Math.max(1, Math.floor(w / 4))) * 4);
        seed = (seed * 1664525 + 1013904223) | 0;
        const py = y + ((Math.abs(seed) % Math.max(1, Math.floor(h / 4))) * 4);
        ctx.fillStyle = (i & 1) === 0 ? theme.dirtDark : theme.dirtLight;
        ctx.fillRect(px, py, 4, 4);
      }

      // Top crust (moss / sandstone / ice / volcanic rim)
      if (crust) {
        ctx.fillStyle = theme.crustTop;
        ctx.fillRect(x, y, w, 6);
        ctx.fillStyle = theme.crustHighlight;
        ctx.fillRect(x, y, w, 2);
        for (let px = x; px < x + w; px += 8) {
          const drop = ((px * 31) % 3) * 2;
          ctx.fillStyle = theme.crustTop;
          ctx.fillRect(px, y + 6, 4, drop);
        }
      }

      ctx.restore();
    }

    drawTexturedCircle(ctx, shape, theme) {
      const { cx, cy, r, style } = shape;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      this.drawTexturedRect(
        ctx,
        { x: cx - r, y: cy - r, w: r * 2, h: r * 2, style, crust: false },
        theme
      );
      ctx.restore();
    }

    drawTexturedPolygon(ctx, shape, theme) {
      const pts = shape.points;
      if (!pts || pts.length < 3) return;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      ctx.save();
      ctx.beginPath();
      pts.forEach(([px, py], idx) => {
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.clip();
      this.drawTexturedRect(
        ctx,
        {
          x: Math.floor(minX),
          y: Math.floor(minY),
          w: Math.ceil(maxX - minX),
          h: Math.ceil(maxY - minY),
          style: shape.style,
          crust: shape.crust
        },
        theme
      );
      ctx.restore();
    }

    drawSteelBlock(ctx, x, y, w, h) {
      ctx.save();
      ctx.fillStyle = '#526070';
      ctx.fillRect(x, y, w, h);

      // Tile into 20x20 riveted steel plates
      const tile = 20;
      for (let ty = y; ty < y + h; ty += tile) {
        for (let tx = x; tx < x + w; tx += tile) {
          const tw = Math.min(tile, x + w - tx);
          const th = Math.min(tile, y + h - ty);

          // Plate bevel
          ctx.fillStyle = '#78899c';
          ctx.fillRect(tx, ty, tw, 2);
          ctx.fillRect(tx, ty, 2, th);

          ctx.fillStyle = '#2d3640';
          ctx.fillRect(tx, ty + th - 2, tw, 2);
          ctx.fillRect(tx + tw - 2, ty, 2, th);

          // Inner sheen
          ctx.fillStyle = '#5f6f82';
          if (tw > 6 && th > 6) {
            ctx.fillRect(tx + 3, ty + 3, tw - 6, th - 6);
          }

          // Corner rivets
          if (tw >= 12 && th >= 12) {
            ctx.fillStyle = '#9fb2c7';
            ctx.fillRect(tx + 3, ty + 3, 2, 2);
            ctx.fillRect(tx + tw - 5, ty + 3, 2, 2);
            ctx.fillRect(tx + 3, ty + th - 5, 2, 2);
            ctx.fillRect(tx + tw - 5, ty + th - 5, 2, 2);
          }
        }
      }
      ctx.restore();
    }

    // -------------------------------------------------------------------------
    // MASK & CANVAS ALPHA SYNCHRONIZATION
    // -------------------------------------------------------------------------
    syncAlphaFromCanvas(bx, by, bw, bh) {
      if (!this.terrainCtx) return;
      const x0 = Math.max(0, Math.floor(bx));
      const y0 = Math.max(0, Math.floor(by));
      const x1 = Math.min(this.width, Math.ceil(bx + bw));
      const y1 = Math.min(this.height, Math.ceil(by + bh));
      const w = x1 - x0;
      const h = y1 - y0;
      if (w <= 0 || h <= 0) return;

      const img = this.terrainCtx.getImageData(x0, y0, w, h).data;
      for (let ry = 0; ry < h; ry++) {
        const worldY = y0 + ry;
        const rowOffset = worldY * this.width + x0;
        const imgRowOffset = ry * w * 4;
        for (let rx = 0; rx < w; rx++) {
          this.terrainAlpha[rowOffset + rx] = img[imgRowOffset + rx * 4 + 3];
        }
      }
    }

    fillRectMask(mask, rx, ry, rw, rh, val) {
      const x0 = Math.max(0, Math.floor(rx));
      const y0 = Math.max(0, Math.floor(ry));
      const x1 = Math.min(this.width, Math.ceil(rx + rw));
      const y1 = Math.min(this.height, Math.ceil(ry + rh));
      for (let y = y0; y < y1; y++) {
        const row = y * this.width;
        for (let x = x0; x < x1; x++) {
          mask[row + x] = val;
        }
      }
    }

    fillCircleMask(mask, cx, cy, r, val) {
      const x0 = Math.max(0, Math.floor(cx - r));
      const y0 = Math.max(0, Math.floor(cy - r));
      const x1 = Math.min(this.width - 1, Math.ceil(cx + r));
      const y1 = Math.min(this.height - 1, Math.ceil(cy + r));
      const r2 = r * r;
      for (let y = y0; y <= y1; y++) {
        const dy = y - cy;
        const row = y * this.width;
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx;
          if (dx * dx + dy * dy <= r2) {
            mask[row + x] = val;
          }
        }
      }
    }

    fillPolygonMask(mask, points, val) {
      let minY = this.height,
        maxY = 0;
      for (const [, py] of points) {
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      minY = Math.max(0, Math.floor(minY));
      maxY = Math.min(this.height - 1, Math.ceil(maxY));

      for (let y = minY; y <= maxY; y++) {
        const nodes = [];
        let j = points.length - 1;
        for (let i = 0; i < points.length; i++) {
          const yi = points[i][1];
          const yj = points[j][1];
          if ((yi < y && yj >= y) || (yj < y && yi >= y)) {
            nodes.push(points[i][0] + ((y - yi) / (yj - yi)) * (points[j][0] - points[i][0]));
          }
          j = i;
        }
        nodes.sort((a, b) => a - b);
        for (let i = 0; i < nodes.length; i += 2) {
          if (i + 1 >= nodes.length) break;
          const x0 = Math.max(0, Math.floor(nodes[i]));
          const x1 = Math.min(this.width - 1, Math.ceil(nodes[i + 1]));
          const row = y * this.width;
          for (let x = x0; x <= x1; x++) {
            mask[row + x] = val;
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // TERRAIN COLLISION & MODIFICATION OPERATIONS
    // -------------------------------------------------------------------------
    isSteel(x, y) {
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return false;
      return this.steelMask[iy * this.width + ix] > 128;
    }

    isDirt(x, y) {
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return false;
      const idx = iy * this.width + ix;
      return this.steelMask[idx] <= 128 && this.terrainAlpha[idx] > 128;
    }

    isSolid(x, y) {
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (ix < 4 || ix >= this.width - 4) return true; // Level side boundaries
      if (iy < 4) return true; // Ceiling boundary
      if (iy >= this.height) return false; // Bottom abyss
      const idx = iy * this.width + ix;
      return this.steelMask[idx] > 128 || this.terrainAlpha[idx] > 128;
    }

    carveRect(rx, ry, rw, rh) {
      if (this.terrainCtx) {
        this.terrainCtx.save();
        this.terrainCtx.globalCompositeOperation = 'destination-out';
        this.terrainCtx.fillStyle = '#000';
        this.terrainCtx.fillRect(rx, ry, rw, rh);
        this.terrainCtx.restore();
        this.syncAlphaFromCanvas(rx - 1, ry - 1, rw + 2, rh + 2);
      } else {
        this.fillRectMask(this.terrainAlpha, rx, ry, rw, rh, 0);
      }
    }

    carveCircle(cx, cy, r) {
      if (this.terrainCtx) {
        this.terrainCtx.save();
        this.terrainCtx.globalCompositeOperation = 'destination-out';
        this.terrainCtx.beginPath();
        this.terrainCtx.arc(cx, cy, r, 0, Math.PI * 2);
        this.terrainCtx.fill();
        this.terrainCtx.restore();
        this.syncAlphaFromCanvas(cx - r - 2, cy - r - 2, r * 2 + 4, r * 2 + 4);
      } else {
        this.fillCircleMask(this.terrainAlpha, cx, cy, r, 0);
      }
    }

    addBuilderBrick(rx, ry, rw, rh) {
      if (this.terrainCtx) {
        this.terrainCtx.save();
        this.terrainCtx.globalCompositeOperation = 'source-over';
        this.terrainCtx.fillStyle = '#e8b948';
        this.terrainCtx.fillRect(rx, ry, rw, rh);
        this.terrainCtx.fillStyle = '#ffe28a';
        this.terrainCtx.fillRect(rx, ry, rw, 1);
        this.terrainCtx.restore();
        this.syncAlphaFromCanvas(rx - 1, ry - 1, rw + 2, rh + 2);
      } else {
        this.fillRectMask(this.terrainAlpha, rx, ry, rw, rh, 255);
      }
    }

    // -------------------------------------------------------------------------
    // SKILL ASSIGNMENT
    // -------------------------------------------------------------------------
    canAssignSkill(lem, skill) {
      if (!lem || lem.removed) return false;
      const deadOrDone = [
        'SPLATTING',
        'DROWNING',
        'BURNING',
        'CRUSHED',
        'OH_NO',
        'EXITING'
      ];
      if (deadOrDone.includes(lem.state)) return false;

      if (skill === 'bomber') {
        return lem.bomberTimer === 0;
      }

      // Blockers cannot be assigned other skills (except bomber above)
      if (lem.state === 'BLOCKING') return false;

      if (skill === 'climber') {
        return !lem.isClimber;
      }
      if (skill === 'floater') {
        return !lem.isFloater;
      }

      // Grounded work skills require the lemming to be on solid ground
      const groundedStates = ['WALKING', 'BUILDING', 'BASHING', 'MINING', 'DIGGING'];
      if (!groundedStates.includes(lem.state)) return false;

      if (skill === 'blocker') return lem.state !== 'BLOCKING';
      if (skill === 'builder') return lem.state !== 'BUILDING';
      if (skill === 'basher') return lem.state !== 'BASHING';
      if (skill === 'miner') return lem.state !== 'MINING';
      if (skill === 'digger') return lem.state !== 'DIGGING';

      return false;
    }

    assignSkill(lem, skill = this.selectedSkill) {
      if (!skill || (this.skills[skill] || 0) <= 0) {
        if (this.sfx) this.sfx.playInvalid();
        return false;
      }
      if (!this.canAssignSkill(lem, skill)) {
        if (this.sfx) this.sfx.playInvalid();
        return false;
      }

      this.skills[skill] -= 1;

      if (skill === 'climber') {
        lem.isClimber = true;
      } else if (skill === 'floater') {
        lem.isFloater = true;
      } else if (skill === 'bomber') {
        lem.bomberTimer = 300; // 5.0 seconds at 60 Hz
      } else if (skill === 'blocker') {
        lem.state = 'BLOCKING';
        lem.skillTimer = 0;
      } else if (skill === 'builder') {
        lem.state = 'BUILDING';
        lem.bricksLeft = 12;
        lem.skillTimer = 0;
        lem.skillStep = 0;
      } else if (skill === 'basher') {
        lem.state = 'BASHING';
        lem.skillTimer = 0;
        lem.skillStep = 0;
      } else if (skill === 'miner') {
        lem.state = 'MINING';
        lem.skillTimer = 0;
        lem.skillStep = 0;
      } else if (skill === 'digger') {
        lem.state = 'DIGGING';
        lem.skillTimer = 0;
        lem.skillStep = 0;
      }

      if (this.sfx) this.sfx.playAssign();
      this.spawnParticles(lem.x, lem.y - 8, '#7ef9ff', 8, 1.8);
      return true;
    }

    findBestLemmingAt(worldX, worldY, skill = this.selectedSkill, maxRadius = 32) {
      let best = null;
      let bestScore = Infinity;

      for (const lem of this.lemmings) {
        if (lem.removed) continue;
        const cx = lem.x;
        const cy = lem.y - 8;
        const dist = Math.hypot(worldX - cx, worldY - cy);
        if (dist > maxRadius) continue;

        const eligible = this.canAssignSkill(lem, skill);
        // Strongly prioritize lemmings that can actually accept the selected skill
        const score = eligible ? dist : dist + 1000;
        if (score < bestScore) {
          bestScore = score;
          best = lem;
        }
      }
      return best;
    }

    triggerNuke() {
      if (this.nuked) {
        // Second tap on Nuke detonates remaining active bombers immediately
        for (const lem of this.lemmings) {
          if (!lem.removed && lem.bomberTimer > 1) {
            lem.bomberTimer = 1;
          }
        }
        return;
      }
      this.nuked = true;
      this.spawnedCount = this.level.lemmingCount; // Stop further spawns
      let delay = 1;
      for (const lem of this.lemmings) {
        if (!lem.removed && lem.bomberTimer === 0 && lem.state !== 'EXITING') {
          lem.bomberTimer = Math.min(300, 15 + delay * 6);
          delay++;
        }
      }
      if (this.sfx) this.sfx.playOhNo();
    }

    // -------------------------------------------------------------------------
    // FIXED-TIMESTEP SIMULATION TICK (60 Hz)
    // -------------------------------------------------------------------------
    step() {
      if (this.finished || !this.level) return;

      this.tickCount += 1;

      // Countdown level timer
      if (this.timeRemainingTicks > 0) {
        this.timeRemainingTicks -= 1;
        if (this.timeRemainingTicks === 0) {
          this.finishLevel();
          return;
        }
      }

      // Spawn lemmings from trapdoor
      if (!this.nuked && this.spawnedCount < this.level.lemmingCount) {
        this.spawnTimer -= 1;
        if (this.spawnTimer <= 0) {
          this.spawnLemming();
          this.spawnTimer = this.getSpawnIntervalTicks();
        }
      }

      // Update crusher hazards & sound effects
      this.updateCrushers();

      // Update all lemmings
      for (const lem of this.lemmings) {
        if (!lem.removed) {
          this.updateLemming(lem);
        }
      }

      // Update visual particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity || 0.08;
        p.life -= 1;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }

      // Check end-of-level condition: all lemmings accounted for
      const activeCount = this.lemmings.filter((l) => !l.removed).length;
      if (this.spawnedCount >= this.level.lemmingCount && activeCount === 0) {
        this.finishLevel();
      }
    }

    spawnLemming() {
      const td = this.level.trapdoor;
      const lem = {
        id: this.nextLemmingId++,
        x: td.x,
        y: td.y,
        dir: td.dir || 1,
        state: 'FALLING',
        fallDistance: 0,
        isClimber: false,
        isFloater: false,
        bomberTimer: 0,
        bricksLeft: 0,
        skillTimer: 0,
        skillStep: 0,
        stateTimer: 0,
        animTick: 0,
        removed: false
      };
      this.lemmings.push(lem);
      this.spawnedCount += 1;
    }

    getCrusherExtension(hazard) {
      const cycle = hazard.cycleTicks || 240;
      const t = ((this.tickCount + (hazard.offsetTicks || 0)) % cycle) / cycle;
      const range = hazard.range || 55;
      // 0..0.68: retracted at top
      // 0.68..0.75: slamming down fast
      // 0.75..0.81: held at bottom
      // 0.81..1.00: winching back up
      if (t < 0.68) {
        return { ext: 0, lethal: false, warning: t > 0.56 };
      } else if (t < 0.75) {
        const p = (t - 0.68) / 0.07;
        return { ext: p * range, lethal: p > 0.4, warning: true, justSlammed: p > 0.88 };
      } else if (t < 0.81) {
        return { ext: range, lethal: true, warning: false };
      } else {
        const p = 1 - (t - 0.81) / 0.19;
        return { ext: p * range, lethal: false, warning: false };
      }
    }

    updateCrushers() {
      for (const h of this.level.hazards || []) {
        if (h.type !== 'crusher') continue;
        const cycle = h.cycleTicks || 240;
        const phaseTick = (this.tickCount + (h.offsetTicks || 0)) % cycle;
        if (phaseTick === Math.floor(cycle * 0.75) && this.sfx) {
          this.sfx.playCrush();
        }
      }
    }

    checkHazardsAndExit(lem) {
      const deadOrDone = [
        'SPLATTING',
        'DROWNING',
        'BURNING',
        'CRUSHED',
        'OH_NO',
        'EXITING'
      ];
      if (deadOrDone.includes(lem.state)) return true;

      // Fall into bottom void
      if (lem.y >= this.height - 2) {
        lem.removed = true;
        this.lostCount += 1;
        if (this.sfx) this.sfx.playSplat();
        return true;
      }

      // Check water, lava, and crusher hazards
      for (const h of this.level.hazards || []) {
        if (h.type === 'water') {
          if (lem.x >= h.x && lem.x <= h.x + h.w && lem.y >= h.y && lem.y <= h.y + h.h + 8) {
            lem.state = 'DROWNING';
            lem.stateTimer = 28;
            if (this.sfx) this.sfx.playSplash();
            this.spawnParticles(lem.x, lem.y - 4, '#5ec8ff', 10, 1.6);
            return true;
          }
        } else if (h.type === 'lava') {
          if (lem.x >= h.x && lem.x <= h.x + h.w && lem.y >= h.y && lem.y <= h.y + h.h + 8) {
            lem.state = 'BURNING';
            lem.stateTimer = 24;
            if (this.sfx) this.sfx.playBurn();
            this.spawnParticles(lem.x, lem.y - 4, '#ff6b2b', 12, 2.2);
            return true;
          }
        } else if (h.type === 'crusher') {
          const cState = this.getCrusherExtension(h);
          if (cState.lethal) {
            const headBottom = h.y + h.h + cState.ext;
            if (
              lem.x >= h.x + 2 &&
              lem.x <= h.x + h.w - 2 &&
              lem.y - 4 >= h.y &&
              lem.y - 10 <= headBottom
            ) {
              lem.state = 'CRUSHED';
              lem.stateTimer = 22;
              if (this.sfx) this.sfx.playCrush();
              this.spawnParticles(lem.x, lem.y - 6, '#ff4757', 12, 2.0);
              return true;
            }
          }
        }
      }

      // Check exit portal (only when grounded or landing right at the door)
      const ex = this.level.exit;
      if (
        lem.state !== 'FALLING' &&
        Math.abs(lem.x - ex.x) <= 12 &&
        Math.abs(lem.y - ex.y) <= 10
      ) {
        lem.state = 'EXITING';
        lem.stateTimer = 20;
        if (this.sfx) this.sfx.playSave();
        this.spawnParticles(ex.x, ex.y - 12, '#ffeaa7', 10, 1.8);
        return true;
      }

      return false;
    }

    detonateBomber(lem) {
      const bx = lem.x;
      const by = lem.y - 6;
      const blastRadius = 26;

      this.carveCircle(bx, by, blastRadius);
      if (this.sfx) this.sfx.playExplosion();
      this.spawnParticles(bx, by, '#ff9f43', 22, 3.2);
      this.spawnParticles(bx, by, '#ff5252', 14, 2.5);

      lem.removed = true;
      this.lostCount += 1;

      // Classic rule from spec: removes lemmings caught in the blast radius
      for (const other of this.lemmings) {
        if (other !== lem && !other.removed && other.state !== 'EXITING') {
          const d = Math.hypot(other.x - bx, other.y - 6 - by);
          if (d <= 20) {
            other.removed = true;
            this.lostCount += 1;
            this.spawnParticles(other.x, other.y - 6, '#ff5252', 8, 2.0);
          }
        }
      }
    }

    findBlockerRepel(lem) {
      for (const other of this.lemmings) {
        if (other === lem || other.removed || other.state !== 'BLOCKING') continue;
        const dx = other.x - lem.x;
        const dy = Math.abs(other.y - lem.y);
        if (dy <= 14 && dx * lem.dir > 0 && Math.abs(dx) <= 10) {
          return other;
        }
      }
      return null;
    }

    updateLemming(lem) {
      lem.animTick += 1;

      // Bomber countdown
      if (lem.bomberTimer > 0 && lem.state !== 'EXITING') {
        lem.bomberTimer -= 1;
        if (lem.bomberTimer === 0) {
          lem.state = 'OH_NO';
          lem.stateTimer = 20;
          if (this.sfx) this.sfx.playOhNo();
          return;
        }
      }

      // Terminal animations
      if (lem.state === 'OH_NO') {
        lem.stateTimer -= 1;
        if (lem.stateTimer <= 0) {
          this.detonateBomber(lem);
        }
        return;
      }

      if (
        lem.state === 'SPLATTING' ||
        lem.state === 'DROWNING' ||
        lem.state === 'BURNING' ||
        lem.state === 'CRUSHED'
      ) {
        lem.stateTimer -= 1;
        if (lem.stateTimer <= 0) {
          lem.removed = true;
          this.lostCount += 1;
        }
        return;
      }

      if (lem.state === 'EXITING') {
        lem.stateTimer -= 1;
        if (lem.stateTimer <= 0) {
          lem.removed = true;
          this.savedCount += 1;
        }
        return;
      }

      // Hazard and exit check
      if (this.checkHazardsAndExit(lem)) return;

      // Active state logic
      switch (lem.state) {
        case 'FALLING':
        case 'FLOATING':
          this.updateFalling(lem);
          break;
        case 'WALKING':
          this.updateWalking(lem);
          break;
        case 'CLIMBING':
          this.updateClimbing(lem);
          break;
        case 'BLOCKING':
          this.updateBlocking(lem);
          break;
        case 'BUILDING':
          this.updateBuilding(lem);
          break;
        case 'BASHING':
          this.updateBashing(lem);
          break;
        case 'MINING':
          this.updateMining(lem);
          break;
        case 'DIGGING':
          this.updateDigging(lem);
          break;
      }

      this.checkHazardsAndExit(lem);
    }

    updateFalling(lem) {
      if (lem.isFloater && lem.fallDistance >= 18) {
        lem.state = 'FLOATING';
      }

      const steps = lem.state === 'FLOATING' ? 1 : 2;
      for (let s = 0; s < steps; s++) {
        if (this.isSolid(lem.x, lem.y)) {
          // Landed on solid ground at lem.y
          if (lem.state !== 'FLOATING' && !lem.isFloater && lem.fallDistance > FATAL_FALL_DIST) {
            lem.state = 'SPLATTING';
            lem.stateTimer = 24;
            if (this.sfx) this.sfx.playSplat();
            this.spawnParticles(lem.x, lem.y - 2, '#ff6b6b', 10, 1.8);
          } else {
            lem.state = 'WALKING';
            lem.fallDistance = 0;
          }
          return;
        }
        lem.y += 1;
        if (lem.state === 'FLOATING') {
          lem.fallDistance = 0;
        } else {
          lem.fallDistance += 1;
          if (lem.isFloater && lem.fallDistance >= 18) {
            lem.state = 'FLOATING';
            lem.fallDistance = 0;
          }
        }
        if (lem.y >= this.height) return;
      }

      // Final ground check after moving
      if (this.isSolid(lem.x, lem.y)) {
        if (lem.state !== 'FLOATING' && !lem.isFloater && lem.fallDistance > FATAL_FALL_DIST) {
          lem.state = 'SPLATTING';
          lem.stateTimer = 24;
          if (this.sfx) this.sfx.playSplat();
          this.spawnParticles(lem.x, lem.y - 2, '#ff6b6b', 10, 1.8);
        } else {
          lem.state = 'WALKING';
          lem.fallDistance = 0;
        }
      }
    }

    updateWalking(lem) {
      // Check blocker collision
      if (this.findBlockerRepel(lem)) {
        lem.dir = -lem.dir;
        return;
      }

      const nx = lem.x + lem.dir;

      // Case 1: Ankle pixel (nx, lem.y - 1) is air -> flat walk or step-down or fall
      if (!this.isSolid(nx, lem.y - 1)) {
        let foundGroundY = -1;
        for (let dy = 0; dy <= MAX_STEP_DOWN; dy++) {
          if (this.isSolid(nx, lem.y + dy)) {
            foundGroundY = lem.y + dy;
            break;
          }
        }
        if (foundGroundY !== -1) {
          lem.x = nx;
          lem.y = foundGroundY;
        } else {
          lem.x = nx;
          lem.state = 'FALLING';
          lem.fallDistance = 0;
        }
        return;
      }

      // Case 2: Ground rises at nx -> try stepping up up to MAX_STEP_UP
      let stepUpY = -1;
      for (let up = 1; up <= MAX_STEP_UP; up++) {
        const candidateY = lem.y - up;
        if (
          !this.isSolid(nx, candidateY - 1) &&
          !this.isSolid(nx, candidateY - 5) &&
          !this.isSolid(nx, candidateY - 9)
        ) {
          stepUpY = candidateY;
          break;
        }
      }

      if (stepUpY !== -1) {
        lem.x = nx;
        lem.y = stepUpY;
        return;
      }

      // Case 3: Wall taller than MAX_STEP_UP -> climb if climber, else turn around
      if (lem.isClimber && !this.isSolid(lem.x, lem.y - 13)) {
        lem.state = 'CLIMBING';
      } else {
        lem.dir = -lem.dir;
      }
    }

    updateClimbing(lem) {
      const wx = lem.x + lem.dir;

      // Overhang check above climber's head
      if (this.isSolid(lem.x, lem.y - 13)) {
        lem.dir = -lem.dir;
        lem.state = 'FALLING';
        lem.fallDistance = 0;
        return;
      }

      lem.y -= 1;

      // Reached top of ledge if air ahead at ankle & torso height
      if (
        !this.isSolid(wx, lem.y - 1) &&
        !this.isSolid(wx, lem.y - 5) &&
        !this.isSolid(wx, lem.y - 9)
      ) {
        lem.x = wx + lem.dir;
        for (let dy = -2; dy <= 4; dy++) {
          if (this.isSolid(lem.x, lem.y + dy) && !this.isSolid(lem.x, lem.y + dy - 1)) {
            lem.y = lem.y + dy;
            break;
          }
        }
        lem.state = 'WALKING';
      }
    }

    updateBlocking(lem) {
      // If ground beneath blocker is removed, blocker falls
      if (
        !this.isSolid(lem.x, lem.y) &&
        !this.isSolid(lem.x - 2, lem.y) &&
        !this.isSolid(lem.x + 2, lem.y)
      ) {
        lem.state = 'FALLING';
        lem.fallDistance = 0;
      }
    }

    updateBuilding(lem) {
      if (this.findBlockerRepel(lem)) {
        lem.dir = -lem.dir;
        lem.state = 'WALKING';
        return;
      }

      lem.skillTimer += 1;
      if (lem.skillTimer < 15) return;
      lem.skillTimer = 0;

      if (lem.bricksLeft <= 0) {
        lem.state = 'WALKING';
        return;
      }

      // Lay a 10x2 brick at (bx, lem.y - 2)
      const bx = lem.dir > 0 ? lem.x : lem.x - 9;
      const by = lem.y - 2;
      this.addBuilderBrick(bx, by, 10, 2);
      lem.bricksLeft -= 1;
      lem.skillStep += 1;

      if (this.sfx) {
        this.sfx.playBrick(lem.bricksLeft < 3);
      }

      const nx = lem.x + lem.dir * 5;
      const ny = lem.y - 2;

      // Stop if head or forward path hits steel or ceiling overhang
      if (this.isSolid(nx, ny - 10) || this.isSteel(nx, ny - 3)) {
        lem.dir = -lem.dir;
        lem.state = 'WALKING';
        return;
      }

      lem.x = nx;
      lem.y = ny;

      if (lem.bricksLeft <= 0) {
        lem.state = 'WALKING';
      }
    }

    updateBashing(lem) {
      if (this.findBlockerRepel(lem)) {
        lem.dir = -lem.dir;
        lem.state = 'WALKING';
        return;
      }

      lem.skillTimer += 1;
      if (lem.skillTimer < 3) return;
      lem.skillTimer = 0;
      lem.skillStep += 1;

      // Check for steel ahead (at y - 12 .. y - 2 so steel floor at y is ignored)
      for (let dx = 1; dx <= 6; dx++) {
        const sx = lem.x + lem.dir * dx;
        for (let dy = -12; dy <= -2; dy++) {
          if (this.isSteel(sx, lem.y + dy)) {
            if (this.sfx) this.sfx.playSteelClink();
            lem.dir = -lem.dir;
            lem.state = 'WALKING';
            return;
          }
        }
      }

      // Carve horizontal tunnel slice (14px high, 10px ahead)
      const rx = lem.dir > 0 ? lem.x : lem.x - 9;
      const ry = lem.y - 14;
      this.carveRect(rx, ry, 10, 14);
      if ((lem.skillStep & 1) === 0) {
        this.spawnParticles(lem.x + lem.dir * 5, lem.y - 6, '#c2834f', 2, 1.1);
      }

      lem.x += lem.dir * 2;

      // Check if ground beneath disappeared
      let foundFloor = -1;
      for (let dy = 0; dy <= 3; dy++) {
        if (this.isSolid(lem.x, lem.y + dy)) {
          foundFloor = lem.y + dy;
          break;
        }
      }
      if (foundFloor === -1) {
        lem.state = 'FALLING';
        lem.fallDistance = 0;
        return;
      }
      lem.y = foundFloor;

      // After initial walk-in steps, stop bashing if open air ahead
      if (lem.skillStep > 5) {
        let hasDirtAhead = false;
        for (let dx = 2; dx <= 12; dx++) {
          const checkX = lem.x + lem.dir * dx;
          for (let dy = -12; dy <= -3; dy++) {
            if (this.isDirt(checkX, lem.y + dy)) {
              hasDirtAhead = true;
              break;
            }
          }
          if (hasDirtAhead) break;
        }
        if (!hasDirtAhead) {
          lem.state = 'WALKING';
        }
      }
    }

    updateMining(lem) {
      if (this.findBlockerRepel(lem)) {
        lem.dir = -lem.dir;
        lem.state = 'WALKING';
        return;
      }

      lem.skillTimer += 1;
      if (lem.skillTimer < 4) return;
      lem.skillTimer = 0;
      lem.skillStep += 1;

      // Check steel wall ahead in diagonal path
      for (let dx = 1; dx <= 6; dx++) {
        const sx = lem.x + lem.dir * dx;
        for (let dy = -10; dy <= 0; dy++) {
          if (this.isSteel(sx, lem.y + dy)) {
            if (this.sfx) this.sfx.playSteelClink();
            if (dy < 0) {
              lem.dir = -lem.dir;
            }
            lem.state = 'WALKING';
            return;
          }
        }
      }

      // Carve diagonal slice and step (dx = 2 * dir, dy = +1)
      const rx = lem.dir > 0 ? lem.x - 2 : lem.x - 10;
      const ry = lem.y - 14;
      this.carveRect(rx, ry, 12, 15);
      if ((lem.skillStep & 1) === 0) {
        this.spawnParticles(lem.x + lem.dir * 4, lem.y - 4, '#c2834f', 2, 1.2);
      }

      lem.x += lem.dir * 2;
      lem.y += 1;

      // If we just stepped onto a steel floor, stop mining and walk forward
      if (this.isSteel(lem.x, lem.y) || this.isSteel(lem.x + lem.dir * 2, lem.y)) {
        if (this.sfx) this.sfx.playSteelClink();
        lem.state = 'WALKING';
        return;
      }

      // Check if floor beneath disappeared into open air
      if (
        !this.isSolid(lem.x, lem.y) &&
        !this.isSolid(lem.x, lem.y + 1) &&
        !this.isSolid(lem.x, lem.y + 2)
      ) {
        lem.state = 'FALLING';
        lem.fallDistance = 0;
      }
    }

    updateDigging(lem) {
      lem.skillTimer += 1;
      if (lem.skillTimer < 3) return;
      lem.skillTimer = 0;
      lem.skillStep += 1;

      // Check steel directly beneath feet (at lem.y, which is the floor pixel)
      for (let dx = -4; dx <= 4; dx++) {
        if (this.isSteel(lem.x + dx, lem.y)) {
          if (this.sfx) this.sfx.playSteelClink();
          lem.state = 'WALKING';
          return;
        }
      }

      // Carve vertical shaft slice (14px wide, carving lem.y so lem steps down to lem.y + 1)
      this.carveRect(lem.x - 7, lem.y - 14, 14, 15);
      if ((lem.skillStep & 1) === 0) {
        this.spawnParticles(lem.x, lem.y - 2, '#c2834f', 2, 1.0);
      }

      lem.y += 1;

      // If we just stepped onto steel, transition cleanly to WALKING
      for (let dx = -4; dx <= 4; dx++) {
        if (this.isSteel(lem.x + dx, lem.y)) {
          if (this.sfx) this.sfx.playSteelClink();
          lem.state = 'WALKING';
          return;
        }
      }

      // Check if broke through into open air
      let hasSupport = false;
      for (let dx = -4; dx <= 4; dx++) {
        if (this.isSolid(lem.x + dx, lem.y) || this.isSolid(lem.x + dx, lem.y + 1)) {
          hasSupport = true;
          break;
        }
      }
      if (!hasSupport) {
        lem.state = 'FALLING';
        lem.fallDistance = 0;
      }
    }

    spawnParticles(x, y, color, count = 8, speed = 1.5) {
      if (this.headless) return;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const spd = speed * (0.4 + Math.random() * 0.8);
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 0.8,
          color,
          life: 14 + Math.floor(Math.random() * 14)
        });
      }
    }

    getSavedPercent() {
      if (!this.level || !this.level.lemmingCount) return 0;
      return Math.floor((this.savedCount / this.level.lemmingCount) * 100);
    }

    finishLevel() {
      if (this.finished) return;
      this.finished = true;
      const pct = this.getSavedPercent();
      this.won = pct >= (this.level.saveQuota || 50);
      if (this.sfx) {
        if (this.won) this.sfx.playWinJingle();
        else this.sfx.playLoseJingle();
      }
      if (this.onLevelFinish) {
        this.onLevelFinish({
          won: this.won,
          savedCount: this.savedCount,
          lemmingCount: this.level.lemmingCount,
          savedPercent: pct,
          quotaPercent: this.level.saveQuota
        });
      }
    }
  }

  // ===========================================================================
  // BROWSER APPLICATION, RENDERER, TOUCH/PINCH-ZOOM CONTROLLER & HUD
  // ===========================================================================
  class LemmingsApp {
    constructor() {
      this.levels = root.LEMMINGS_LEVELS || [];
      this.sfx = new SoundFX();
      this.engine = new LemmingsEngine({ sfx: this.sfx, headless: false });

      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

      this.paused = false;
      this.fastForward = false;
      this.currentLevelIndex = 0;

      // Camera state (supports pinch-zoom 1.0x..3.5x and drag-pan)
      this.zoom = 1.0;
      this.panX = 0;
      this.panY = 0;

      // Pointer & touch gesture tracking
      this.pointers = new Map();
      this.dragStartPanX = 0;
      this.dragStartPanY = 0;
      this.dragStartX = 0;
      this.dragStartY = 0;
      this.pointerMovedDist = 0;
      this.initialPinchDist = 0;
      this.initialPinchZoom = 1.0;
      this.initialPinchWorldX = WORLD_W / 2;
      this.initialPinchWorldY = WORLD_H / 2;
      this.lastTapTime = 0;
      this.lastTapX = 0;
      this.lastTapY = 0;
      this.hoverWorldPos = null;

      // Progress persistence
      this.progress = this.loadProgress();

      this.engine.onLevelFinish = (result) => this.handleLevelFinish(result);

      if (this.canvas) {
        this.initDOM();
        this.initInputHandlers();
        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());
        this.startLevel(this.currentLevelIndex);
        this.startLoop();
      }
    }

    loadProgress() {
      const def = { unlockedLevel: 0, bestScores: {} };
      try {
        const raw = localStorage.getItem('lemmings_progress_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            unlockedLevel: Math.max(0, parsed.unlockedLevel || 0),
            bestScores: parsed.bestScores || {}
          };
        }
      } catch (_) {}
      return def;
    }

    saveProgress() {
      try {
        localStorage.setItem('lemmings_progress_v1', JSON.stringify(this.progress));
      } catch (_) {}
    }

    // -------------------------------------------------------------------------
    // DOM & HUD INITIALIZATION
    // -------------------------------------------------------------------------
    initDOM() {
      // Skill buttons
      document.querySelectorAll('.skill-btn').forEach((btn) => {
        const skill = btn.getAttribute('data-skill');
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.selectSkill(skill);
        });
      });

      // Release rate - / + (supports tap and press-and-hold)
      const bindHoldButton = (id, delta) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        let holdInterval = null;
        const stepRate = () => {
          this.engine.adjustReleaseRate(delta);
          this.updateHUD();
        };
        const stopHold = () => {
          if (holdInterval) {
            clearInterval(holdInterval);
            holdInterval = null;
          }
        };
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.sfx.playClick();
          stepRate();
          stopHold();
          holdInterval = setInterval(stepRate, 90);
        });
        btn.addEventListener('pointerup', stopHold);
        btn.addEventListener('pointerleave', stopHold);
        btn.addEventListener('pointercancel', stopHold);
      };

      bindHoldButton('btn-rate-minus', -3);
      bindHoldButton('btn-rate-plus', 3);

      // Pause toggle
      const btnPause = document.getElementById('btn-pause');
      if (btnPause) {
        btnPause.addEventListener('click', () => {
          this.paused = !this.paused;
          this.sfx.playClick();
          this.updateHUD();
        });
      }

      // Fast-forward (2x) toggle
      const btnFF = document.getElementById('btn-ff');
      if (btnFF) {
        btnFF.addEventListener('click', () => {
          this.fastForward = !this.fastForward;
          this.sfx.playClick();
          this.updateHUD();
        });
      }

      // Restart level
      const btnRestart = document.getElementById('btn-restart');
      if (btnRestart) {
        btnRestart.addEventListener('click', () => {
          this.sfx.playClick();
          this.startLevel(this.currentLevelIndex);
        });
      }

      // Nuke button
      const btnNuke = document.getElementById('btn-nuke');
      if (btnNuke) {
        btnNuke.addEventListener('click', () => {
          this.paused = false;
          this.engine.triggerNuke();
          this.updateHUD();
        });
      }

      // Mute toggle
      const btnMute = document.getElementById('btn-mute');
      if (btnMute) {
        btnMute.addEventListener('click', () => {
          this.sfx.toggleMute();
          this.updateHUD();
        });
      }

      // Reset Zoom button
      const btnResetView = document.getElementById('btn-reset-view');
      if (btnResetView) {
        btnResetView.addEventListener('click', () => {
          this.sfx.playClick();
          this.resetView();
        });
      }

      // Level select modal open/close
      const btnLevels = document.getElementById('btn-levels');
      if (btnLevels) {
        btnLevels.addEventListener('click', () => {
          this.sfx.playClick();
          this.openLevelSelectModal();
        });
      }
      const btnCloseLevels = document.getElementById('btn-close-levels');
      if (btnCloseLevels) {
        btnCloseLevels.addEventListener('click', () => {
          this.sfx.playClick();
          this.closeLevelSelectModal();
        });
      }

      // Result modal buttons
      const btnResultRetry = document.getElementById('btn-result-retry');
      if (btnResultRetry) {
        btnResultRetry.addEventListener('click', () => {
          this.sfx.playClick();
          this.hideResultModal();
          this.startLevel(this.currentLevelIndex);
        });
      }
      const btnResultNext = document.getElementById('btn-result-next');
      if (btnResultNext) {
        btnResultNext.addEventListener('click', () => {
          this.sfx.playClick();
          this.hideResultModal();
          const nextIdx = (this.currentLevelIndex + 1) % this.levels.length;
          this.startLevel(nextIdx);
        });
      }

      // Dismiss portrait hint button
      const btnDismissRotate = document.getElementById('btn-dismiss-rotate');
      if (btnDismissRotate) {
        btnDismissRotate.addEventListener('click', () => {
          const hint = document.getElementById('rotate-overlay');
          if (hint) hint.classList.add('dismissed');
        });
      }

      // Keyboard shortcuts for desktop convenience (1-8 skills, Space pause, F fast-forward, R restart)
      window.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '8') {
          const sk = SKILL_KEYS[parseInt(e.key, 10) - 1];
          if (sk) this.selectSkill(sk);
        } else if (e.key === ' ') {
          e.preventDefault();
          this.paused = !this.paused;
          this.updateHUD();
        } else if (e.key === 'f' || e.key === 'F') {
          this.fastForward = !this.fastForward;
          this.updateHUD();
        } else if (e.key === 'r' || e.key === 'R') {
          this.startLevel(this.currentLevelIndex);
        }
      });
    }

    selectSkill(skill) {
      if (!SKILL_KEYS.includes(skill)) return;
      this.engine.selectedSkill = skill;
      this.sfx.playClick();
      this.updateHUD();
    }

    startLevel(index) {
      const clamped = Math.max(0, Math.min(this.levels.length - 1, index));
      this.currentLevelIndex = clamped;
      this.paused = false;
      this.fastForward = false;
      this.resetView();
      this.hideResultModal();
      this.closeLevelSelectModal();
      this.engine.loadLevel(this.levels[clamped], clamped);
      this.showHintBanner(this.levels[clamped]);
      this.updateHUD();
    }

    showHintBanner(levelDef) {
      const banner = document.getElementById('level-banner');
      if (!banner) return;
      const titleEl = document.getElementById('banner-title');
      const hintEl = document.getElementById('banner-hint');
      if (titleEl) titleEl.textContent = `LEVEL ${levelDef.id}: ${levelDef.name.toUpperCase()}`;
      if (hintEl) hintEl.textContent = levelDef.hint || levelDef.subtitle || '';
      banner.classList.remove('hidden');
      clearTimeout(this.bannerTimeout);
      this.bannerTimeout = setTimeout(() => {
        banner.classList.add('hidden');
      }, 5200);
    }

    handleLevelFinish(result) {
      const lvlId = this.levels[this.currentLevelIndex].id;
      const prevBest = this.progress.bestScores[lvlId] || 0;
      if (result.savedPercent > prevBest) {
        this.progress.bestScores[lvlId] = result.savedPercent;
      }
      if (result.won && this.currentLevelIndex + 1 > this.progress.unlockedLevel) {
        this.progress.unlockedLevel = Math.min(
          this.levels.length - 1,
          this.currentLevelIndex + 1
        );
      }
      this.saveProgress();
      this.updateHUD();
      this.showResultModal(result);
    }

    showResultModal(result) {
      const modal = document.getElementById('result-modal');
      if (!modal) return;
      const lvl = this.levels[this.currentLevelIndex];
      const best = this.progress.bestScores[lvl.id] || 0;

      const title = document.getElementById('result-title');
      const subtitle = document.getElementById('result-subtitle');
      const savedEl = document.getElementById('result-saved');
      const quotaEl = document.getElementById('result-quota');
      const bestEl = document.getElementById('result-best');
      const nextBtn = document.getElementById('btn-result-next');

      if (title) {
        title.textContent = result.won ? 'LEVEL COMPLETE!' : 'TRY AGAIN!';
        title.className = result.won ? 'modal-title win-text' : 'modal-title lose-text';
      }
      if (subtitle) {
        subtitle.textContent = `Level ${lvl.id}: ${lvl.name}`;
      }
      if (savedEl) {
        savedEl.textContent = `${result.savedPercent}% (${result.savedCount} / ${result.lemmingCount})`;
      }
      if (quotaEl) {
        quotaEl.textContent = `${result.quotaPercent}%`;
      }
      if (bestEl) {
        bestEl.textContent = `${best}%`;
      }
      if (nextBtn) {
        const hasNext = this.currentLevelIndex < this.levels.length - 1;
        nextBtn.style.display = result.won ? 'inline-flex' : 'none';
        nextBtn.textContent = hasNext ? 'NEXT LEVEL ▶' : 'PLAY LEVEL 1 ▶';
      }

      modal.classList.remove('hidden');
    }

    hideResultModal() {
      const modal = document.getElementById('result-modal');
      if (modal) modal.classList.add('hidden');
    }

    openLevelSelectModal() {
      const modal = document.getElementById('levels-modal');
      const list = document.getElementById('levels-list');
      if (!modal || !list) return;

      list.innerHTML = '';
      this.levels.forEach((lvl, idx) => {
        const unlocked = idx <= this.progress.unlockedLevel;
        const best = this.progress.bestScores[lvl.id];
        const card = document.createElement('button');
        card.type = 'button';
        card.className =
          'level-card' +
          (idx === this.currentLevelIndex ? ' active' : '') +
          (!unlocked ? ' locked-hint' : '');

        const badge = best !== undefined ? `BEST: ${best}%` : unlocked ? 'UNLOCKED' : 'CHALLENGE';
        card.innerHTML = `
          <div class="level-card-header">
            <span class="level-num">L${lvl.id}: ${lvl.name}</span>
            <span class="level-best">${badge}</span>
          </div>
          <div class="level-desc">${lvl.subtitle}</div>
          <div class="level-meta">Lemmings: ${lvl.lemmingCount} • Quota: ${lvl.saveQuota}%</div>
        `;
        card.addEventListener('click', () => {
          this.sfx.playClick();
          this.startLevel(idx);
        });
        list.appendChild(card);
      });

      modal.classList.remove('hidden');
    }

    closeLevelSelectModal() {
      const modal = document.getElementById('levels-modal');
      if (modal) modal.classList.add('hidden');
    }

    updateHUD() {
      const eng = this.engine;
      if (!eng.level) return;

      // Skill buttons
      document.querySelectorAll('.skill-btn').forEach((btn) => {
        const sk = btn.getAttribute('data-skill');
        const count = eng.skills[sk] || 0;
        const countEl = btn.querySelector('.skill-count');
        if (countEl) countEl.textContent = String(count).padStart(2, '0');
        btn.classList.toggle('selected', eng.selectedSkill === sk);
        btn.classList.toggle('depleted', count <= 0);
      });

      // Release rate display
      const rateVal = document.getElementById('hud-rate');
      if (rateVal) rateVal.textContent = String(eng.releaseRate).padStart(2, '0');

      // Level name
      const lvlEl = document.getElementById('hud-level');
      if (lvlEl) lvlEl.textContent = `L${eng.level.id}: ${eng.level.name}`;

      // Out & Left to spawn
      const activeCount = eng.lemmings.filter((l) => !l.removed).length;
      const leftToSpawn = Math.max(0, eng.level.lemmingCount - eng.spawnedCount);
      const outEl = document.getElementById('hud-out');
      if (outEl) outEl.textContent = `OUT ${activeCount} • WAIT ${leftToSpawn}`;

      // Saved / Quota
      const savedPct = eng.getSavedPercent();
      const quotaPct = eng.level.saveQuota;
      const savedEl = document.getElementById('hud-saved');
      if (savedEl) {
        savedEl.textContent = `SAVED ${savedPct}% / ${quotaPct}% (${eng.savedCount}/${eng.level.lemmingCount})`;
        savedEl.classList.toggle('quota-met', savedPct >= quotaPct);
      }

      // Timer
      const totalSec = Math.ceil(eng.timeRemainingTicks / 60);
      const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
      const ss = String(totalSec % 60).padStart(2, '0');
      const timerEl = document.getElementById('hud-timer');
      if (timerEl) {
        timerEl.textContent = `${mm}:${ss}`;
        timerEl.classList.toggle('low-time', totalSec <= 30);
      }

      // Utility button states
      const btnPause = document.getElementById('btn-pause');
      if (btnPause) btnPause.classList.toggle('active-toggle', this.paused);

      const btnFF = document.getElementById('btn-ff');
      if (btnFF) btnFF.classList.toggle('active-toggle', this.fastForward);

      const btnNuke = document.getElementById('btn-nuke');
      if (btnNuke) btnNuke.classList.toggle('active-toggle', eng.nuked);

      const btnMute = document.getElementById('btn-mute');
      if (btnMute) {
        btnMute.textContent = this.sfx.muted ? '🔇' : '🔊';
        btnMute.classList.toggle('active-toggle', this.sfx.muted);
      }

      const btnResetView = document.getElementById('btn-reset-view');
      if (btnResetView) {
        btnResetView.classList.toggle(
          'hidden',
          Math.abs(this.zoom - 1.0) < 0.03 && Math.hypot(this.panX, this.panY) < 4
        );
      }
    }

    // -------------------------------------------------------------------------
    // VIEWPORT, CAMERA TRANSFORM, TOUCH PAN & PINCH-ZOOM
    // -------------------------------------------------------------------------
    handleResize() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      this.dpr = dpr;
      this.cssWidth = Math.max(1, rect.width);
      this.cssHeight = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.cssWidth * dpr);
      this.canvas.height = Math.round(this.cssHeight * dpr);
      this.clampCamera();
    }

    getBaseViewportTransform() {
      const scaleX = this.cssWidth / WORLD_W;
      const scaleY = this.cssHeight / WORLD_H;
      const baseScale = Math.min(scaleX, scaleY);
      const totalScale = baseScale * this.zoom;
      const offsetX = (this.cssWidth - WORLD_W * totalScale) * 0.5 + this.panX;
      const offsetY = (this.cssHeight - WORLD_H * totalScale) * 0.5 + this.panY;
      return { baseScale, totalScale, offsetX, offsetY };
    }

    screenToWorld(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const { totalScale, offsetX, offsetY } = this.getBaseViewportTransform();
      return {
        x: (sx - offsetX) / totalScale,
        y: (sy - offsetY) / totalScale,
        sx,
        sy
      };
    }

    clampCamera() {
      this.zoom = Math.max(1.0, Math.min(3.5, this.zoom));
      if (this.zoom <= 1.01) {
        this.panX = 0;
        this.panY = 0;
        return;
      }
      const scaleX = (this.cssWidth || WORLD_W) / WORLD_W;
      const scaleY = (this.cssHeight || WORLD_H) / WORLD_H;
      const baseScale = Math.min(scaleX, scaleY);
      const totalScale = baseScale * this.zoom;
      const maxPanX = Math.max(40, (WORLD_W * totalScale - this.cssWidth) * 0.5 + 80);
      const maxPanY = Math.max(40, (WORLD_H * totalScale - this.cssHeight) * 0.5 + 80);
      this.panX = Math.max(-maxPanX, Math.min(maxPanX, this.panX));
      this.panY = Math.max(-maxPanY, Math.min(maxPanY, this.panY));
    }

    resetView() {
      this.zoom = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.updateHUD();
    }

    zoomAtScreenPoint(newZoom, sx, sy) {
      const clampedZoom = Math.max(1.0, Math.min(3.5, newZoom));
      const before = this.getBaseViewportTransform();
      const worldX = (sx - before.offsetX) / before.totalScale;
      const worldY = (sy - before.offsetY) / before.totalScale;

      this.zoom = clampedZoom;
      const afterScale = before.baseScale * this.zoom;
      const centeredOffsetX = (this.cssWidth - WORLD_W * afterScale) * 0.5;
      const centeredOffsetY = (this.cssHeight - WORLD_H * afterScale) * 0.5;

      this.panX = sx - worldX * afterScale - centeredOffsetX;
      this.panY = sy - worldY * afterScale - centeredOffsetY;
      this.clampCamera();
      this.updateHUD();
    }

    initInputHandlers() {
      const c = this.canvas;
      c.addEventListener('contextmenu', (e) => e.preventDefault());

      // Prevent default iOS touch bounce/zoom on canvas
      c.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
      c.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

      c.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        c.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (this.pointers.size === 1) {
          this.dragStartX = e.clientX;
          this.dragStartY = e.clientY;
          this.dragStartPanX = this.panX;
          this.dragStartPanY = this.panY;
          this.pointerMovedDist = 0;
        } else if (this.pointers.size === 2) {
          const pts = Array.from(this.pointers.values());
          this.initialPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          this.initialPinchZoom = this.zoom;
          const midX = (pts[0].x + pts[1].x) * 0.5;
          const midY = (pts[0].y + pts[1].y) * 0.5;
          const rect = c.getBoundingClientRect();
          this.pinchMidSX = midX - rect.left;
          this.pinchMidSY = midY - rect.top;
          this.pointerMovedDist = 999; // Suppress single-tap on pinch
        }
      });

      c.addEventListener('pointermove', (e) => {
        const wPos = this.screenToWorld(e.clientX, e.clientY);
        this.hoverWorldPos = wPos;

        if (!this.pointers.has(e.pointerId)) return;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (this.pointers.size === 1) {
          const dx = e.clientX - this.dragStartX;
          const dy = e.clientY - this.dragStartY;
          this.pointerMovedDist = Math.max(this.pointerMovedDist, Math.hypot(dx, dy));

          if (this.pointerMovedDist > 10 && this.zoom > 1.01) {
            this.panX = this.dragStartPanX + dx;
            this.panY = this.dragStartPanY + dy;
            this.clampCamera();
            this.updateHUD();
          }
        } else if (this.pointers.size === 2) {
          const pts = Array.from(this.pointers.values());
          const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          if (this.initialPinchDist > 12) {
            const factor = dist / this.initialPinchDist;
            this.zoomAtScreenPoint(
              this.initialPinchZoom * factor,
              this.pinchMidSX,
              this.pinchMidSY
            );
          }
        }
      });

      const handlePointerEnd = (e) => {
        if (!this.pointers.has(e.pointerId)) return;
        this.pointers.delete(e.pointerId);

        if (this.pointers.size === 0 && this.pointerMovedDist <= 10) {
          this.handleCanvasTap(e.clientX, e.clientY);
        } else if (this.pointers.size === 1) {
          const remaining = Array.from(this.pointers.values())[0];
          this.dragStartX = remaining.x;
          this.dragStartY = remaining.y;
          this.dragStartPanX = this.panX;
          this.dragStartPanY = this.panY;
        }
      };

      c.addEventListener('pointerup', handlePointerEnd);
      c.addEventListener('pointercancel', handlePointerEnd);

      // Mouse wheel zoom support
      c.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          const rect = c.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const zoomDelta = e.deltaY < 0 ? 1.15 : 0.87;
          this.zoomAtScreenPoint(this.zoom * zoomDelta, sx, sy);
        },
        { passive: false }
      );
    }

    handleCanvasTap(clientX, clientY) {
      const now = performance.now();
      const world = this.screenToWorld(clientX, clientY);

      // Hide intro banner on first tap
      const banner = document.getElementById('level-banner');
      if (banner) banner.classList.add('hidden');

      // Find if a lemming is under the tap
      const targetLem = this.engine.findBestLemmingAt(
        world.x,
        world.y,
        this.engine.selectedSkill,
        34
      );

      if (targetLem) {
        this.engine.assignSkill(targetLem, this.engine.selectedSkill);
        this.updateHUD();
        this.lastTapTime = 0;
        return;
      }

      // Check double-tap on empty space -> Reset View (or toggle 2x zoom if already at 1x)
      if (
        now - this.lastTapTime < 320 &&
        Math.hypot(clientX - this.lastTapX, clientY - this.lastTapY) < 36
      ) {
        this.sfx.playClick();
        this.resetView();
        this.lastTapTime = 0;
        return;
      }

      this.lastTapTime = now;
      this.lastTapX = clientX;
      this.lastTapY = clientY;
    }

    // -------------------------------------------------------------------------
    // FIXED-TIMESTEP GAME LOOP & PROCEDURAL PIXEL-ART RENDERING
    // -------------------------------------------------------------------------
    startLoop() {
      let lastTime = performance.now();
      let accumulator = 0;
      const stepMs = 1000 / 60;

      const frame = (now) => {
        const dt = Math.min(100, now - lastTime);
        lastTime = now;

        if (!this.paused && !this.engine.finished) {
          accumulator += dt * (this.fastForward ? 2.2 : 1.0);
          let steps = 0;
          while (accumulator >= stepMs && steps < 6) {
            this.engine.step();
            accumulator -= stepMs;
            steps++;
          }
          if ((this.engine.tickCount & 7) === 0) {
            this.updateHUD();
          }
        } else {
          accumulator = 0;
        }

        this.render(now);
        requestAnimationFrame(frame);
      };

      requestAnimationFrame(frame);
    }

    render(now) {
      const ctx = this.ctx;
      const eng = this.engine;
      if (!ctx || !eng.level) return;

      const dpr = this.dpr || 1;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear letterbox space
      ctx.fillStyle = '#090c12';
      ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

      const { totalScale, offsetX, offsetY } = this.getBaseViewportTransform();
      ctx.translate(offsetX, offsetY);
      ctx.scale(totalScale, totalScale);

      // Clip to logical world
      ctx.beginPath();
      ctx.rect(0, 0, WORLD_W, WORLD_H);
      ctx.clip();

      this.drawWorldBackground(ctx, eng.level);

      // Draw destructible terrain canvas and steel canvas
      ctx.imageSmoothingEnabled = false;
      if (eng.terrainCanvas) {
        ctx.drawImage(eng.terrainCanvas, 0, 0);
      }
      if (eng.steelCanvas) {
        ctx.drawImage(eng.steelCanvas, 0, 0);
      }

      // Draw hazards (water, lava, crushers)
      this.drawHazards(ctx, eng.level, now);

      // Draw trapdoor spawner and exit portal
      this.drawTrapdoor(ctx, eng.level.trapdoor);
      this.drawExitPortal(ctx, eng.level.exit, now);

      // Draw all active lemmings
      const hoveredLem = this.hoverWorldPos
        ? eng.findBestLemmingAt(
            this.hoverWorldPos.x,
            this.hoverWorldPos.y,
            eng.selectedSkill,
            34
          )
        : null;

      for (const lem of eng.lemmings) {
        if (!lem.removed) {
          this.drawLemming(ctx, lem, lem === hoveredLem);
        }
      }

      // Draw particles
      for (const p of eng.particles) {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - 2), Math.round(p.y - 2), 4, 4);
      }

      ctx.restore();
    }

    drawWorldBackground(ctx, levelDef) {
      const theme = levelDef.theme || { bgTop: '#0d1520', bgBottom: '#182638' };
      const grad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
      grad.addColorStop(0, theme.bgTop);
      grad.addColorStop(1, theme.bgBottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);

      // Subtle atmospheric cavern columns & distant rock strata
      ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      for (let x = 60; x < WORLD_W; x += 180) {
        ctx.fillRect(x, 0, 28, WORLD_H);
        ctx.fillRect(x + 36, 0, 10, WORLD_H);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      for (let y = 100; y < WORLD_H; y += 90) {
        ctx.fillRect(0, y, WORLD_W, 14);
      }
    }

    drawHazards(ctx, levelDef, now) {
      const t = now * 0.004;
      for (const h of levelDef.hazards || []) {
        if (h.type === 'water') {
          ctx.fillStyle = 'rgba(20, 120, 220, 0.85)';
          ctx.fillRect(h.x, h.y + 4, h.w, h.h - 4);
          ctx.fillStyle = '#38b6ff';
          for (let wx = h.x; wx < h.x + h.w; wx += 8) {
            const wy = h.y + Math.sin(t * 2 + wx * 0.12) * 3;
            ctx.fillRect(wx, wy, 8, 6);
          }
          ctx.fillStyle = '#c7f0ff';
          for (let wx = h.x + 2; wx < h.x + h.w - 4; wx += 16) {
            const wy = h.y + Math.sin(t * 2 + wx * 0.12) * 3;
            ctx.fillRect(wx, wy, 6, 2);
          }
        } else if (h.type === 'lava') {
          ctx.fillStyle = '#b81d13';
          ctx.fillRect(h.x, h.y + 4, h.w, h.h - 4);
          ctx.fillStyle = '#ff5e1a';
          for (let lx = h.x; lx < h.x + h.w; lx += 8) {
            const ly = h.y + Math.sin(t * 2.5 + lx * 0.15) * 3;
            ctx.fillRect(lx, ly, 8, 8);
          }
          ctx.fillStyle = '#ffdd47';
          for (let lx = h.x + 4; lx < h.x + h.w - 6; lx += 14) {
            const ly = h.y + 2 + Math.cos(t * 3 + lx * 0.2) * 2;
            ctx.fillRect(lx, ly, 6, 3);
          }
        } else if (h.type === 'crusher') {
          const cState = this.engine.getCrusherExtension(h);
          const ext = Math.round(cState.ext);

          // Ceiling housing mount
          ctx.fillStyle = '#2d3436';
          ctx.fillRect(h.x - 4, h.y - 10, h.w + 8, 12);
          // Warning indicator light
          ctx.fillStyle = cState.warning || cState.lethal ? '#ff3838' : '#2ecc71';
          ctx.fillRect(h.x + h.w * 0.5 - 4, h.y - 7, 8, 5);

          // Hydraulic shaft
          ctx.fillStyle = '#7f8fa6';
          ctx.fillRect(h.x + h.w * 0.5 - 5, h.y, 10, ext + 4);
          ctx.fillStyle = '#dcdde1';
          ctx.fillRect(h.x + h.w * 0.5 - 2, h.y, 3, ext + 4);

          // Heavy spiked iron crusher head
          const hy = h.y + ext;
          ctx.fillStyle = '#485460';
          ctx.fillRect(h.x, hy, h.w, h.h);
          ctx.fillStyle = '#ffd32a';
          for (let sx = h.x + 2; sx < h.x + h.w - 4; sx += 8) {
            ctx.fillRect(sx, hy + 3, 4, 6);
          }
          // Bottom spikes
          ctx.fillStyle = '#d2dae2';
          for (let sx = h.x + 2; sx < h.x + h.w - 2; sx += 6) {
            ctx.fillRect(sx, hy + h.h, 4, 4);
          }
        }
      }
    }

    drawTrapdoor(ctx, td) {
      const x = td.x;
      const y = td.y;
      ctx.save();
      // Chains up to ceiling
      ctx.fillStyle = '#7f8c8d';
      for (let cy = y - 48; cy < y - 14; cy += 6) {
        ctx.fillRect(x - 20, cy, 4, 4);
        ctx.fillRect(x + 16, cy, 4, 4);
      }

      // Main wooden/iron beam frame
      ctx.fillStyle = '#5c3c1e';
      ctx.fillRect(x - 28, y - 18, 56, 16);
      ctx.fillStyle = '#8c5a2b';
      ctx.fillRect(x - 24, y - 15, 48, 10);

      // Iron corner brackets
      ctx.fillStyle = '#95a5a6';
      ctx.fillRect(x - 28, y - 18, 8, 16);
      ctx.fillRect(x + 20, y - 18, 8, 16);

      // Animated hatch flaps
      const openAmt = Math.min(1, this.engine.tickCount / 25);
      ctx.fillStyle = '#3d2713';
      ctx.fillRect(x - 18, y - 2, 14, 4 + openAmt * 10);
      ctx.fillRect(x + 4, y - 2, 14, 4 + openAmt * 10);

      // Directional indicator arrow
      ctx.fillStyle = '#ffeaa7';
      const dir = td.dir || 1;
      ctx.fillRect(x - 4, y - 12, 8, 3);
      ctx.fillRect(x + dir * 4, y - 14, 3, 7);
      ctx.restore();
    }

    drawExitPortal(ctx, ex, now) {
      const x = ex.x;
      const y = ex.y;
      ctx.save();

      // Stone archway pillars
      ctx.fillStyle = '#636e72';
      ctx.fillRect(x - 24, y - 38, 48, 38);
      ctx.fillStyle = '#b2bec3';
      ctx.fillRect(x - 26, y - 42, 52, 6);
      ctx.fillRect(x - 20, y - 46, 40, 4);

      // Glowing portal vortex inside doorway
      const pulse = 0.7 + 0.3 * Math.sin(now * 0.008);
      ctx.fillStyle = '#0984e3';
      ctx.fillRect(x - 12, y - 28, 24, 28);
      ctx.fillStyle = `rgba(116, 185, 255, ${pulse.toFixed(2)})`;
      ctx.fillRect(x - 8, y - 24, 16, 24);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 4, y - 18, 8, 14);

      // Animated torches on either side of arch
      const flicker = Math.sin(now * 0.02) > 0 ? '#fdcb6e' : '#e17055';
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(x - 20, y - 26, 4, 8);
      ctx.fillRect(x + 16, y - 26, 4, 8);
      ctx.fillStyle = flicker;
      ctx.fillRect(x - 21, y - 32, 6, 6);
      ctx.fillRect(x + 15, y - 32, 6, 6);

      ctx.restore();
    }

    drawLemming(ctx, lem, isHovered) {
      const x = Math.round(lem.x);
      const y = Math.round(lem.y);
      const d = lem.dir;
      const step = Math.floor(lem.animTick / 4) % 4;

      ctx.save();

      // Target highlight bracket if hovered or near pointer
      if (isHovered) {
        ctx.strokeStyle = '#7ef9ff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 9, y - 19, 18, 21);
      }

      // Bomber countdown label above head
      if (lem.bomberTimer > 0) {
        const sec = Math.ceil(lem.bomberTimer / 60);
        ctx.fillStyle = '#ff4757';
        ctx.fillRect(x - 5, y - 28, 10, 9);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(sec), x, y - 21);
      }

      // Floater open umbrella
      if (lem.state === 'FLOATING') {
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(x - 9, y - 23, 18, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 5, y - 25, 10, 2);
        ctx.fillStyle = '#dfe6e9';
        ctx.fillRect(x - 1, y - 19, 2, 7);
      }

      // Special death / exit animations
      if (lem.state === 'SPLATTING' || lem.state === 'CRUSHED') {
        ctx.fillStyle = '#3742fa';
        ctx.fillRect(x - 7, y - 3, 14, 3);
        ctx.fillStyle = '#2ed573';
        ctx.fillRect(x - 5, y - 5, 10, 2);
        ctx.restore();
        return;
      }

      if (lem.state === 'DROWNING') {
        const bob = (lem.animTick % 6) - 2;
        ctx.fillStyle = '#2ed573';
        ctx.fillRect(x - 4, y - 8 + bob, 8, 4);
        ctx.fillStyle = '#ffb8b8';
        ctx.fillRect(x - 5, y - 11 + bob, 2, 4);
        ctx.fillRect(x + 3, y - 11 + bob, 2, 4);
        ctx.restore();
        return;
      }

      if (lem.state === 'BURNING') {
        ctx.fillStyle = (lem.animTick & 2) === 0 ? '#ff9f43' : '#ff4757';
        ctx.fillRect(x - 4, y - 14, 8, 14);
        ctx.fillStyle = '#ffeaa7';
        ctx.fillRect(x - 2, y - 10, 4, 8);
        ctx.restore();
        return;
      }

      if (lem.state === 'EXITING') {
        const shrink = Math.max(2, Math.floor((lem.stateTimer / 20) * 14));
        ctx.fillStyle = '#2ed573';
        ctx.fillRect(x - 3, y - shrink - 2, 6, 3);
        ctx.fillStyle = '#3742fa';
        ctx.fillRect(x - 3, y - shrink + 1, 6, shrink - 1);
        ctx.restore();
        return;
      }

      // Hair color: classic bright green, or golden-cyan crest if Climber/Floater
      const hairColor =
        lem.isClimber && lem.isFloater
          ? '#ffeaa7'
          : lem.isClimber
          ? '#00d2d3'
          : '#2ed573';

      // Head & Hair
      ctx.fillStyle = hairColor;
      ctx.fillRect(x - 4, y - 15, 8, 3);
      ctx.fillRect(x - 3 - d, y - 16, 6, 2);

      // Face
      ctx.fillStyle = '#ffcccc';
      ctx.fillRect(x - 3, y - 12, 6, 4);
      // Nose/eye in facing direction
      ctx.fillStyle = '#1e272e';
      ctx.fillRect(x + (d > 0 ? 1 : -2), y - 11, 1, 1);

      // Tunic torso
      ctx.fillStyle = '#3742fa';
      ctx.fillRect(x - 3, y - 8, 6, 6);

      // State-specific limbs and tools
      if (lem.state === 'BLOCKING') {
        // Outstretched red stop-hands
        ctx.fillStyle = '#ff4757';
        ctx.fillRect(x - 8, y - 9, 4, 4);
        ctx.fillRect(x + 4, y - 9, 4, 4);
        // Wide stance boots
        ctx.fillStyle = '#ffa502';
        ctx.fillRect(x - 4, y - 2, 3, 2);
        ctx.fillRect(x + 1, y - 2, 3, 2);
      } else if (lem.state === 'BUILDING') {
        // Brick pack on back + extended arm laying gold brick
        ctx.fillStyle = '#e8b948';
        ctx.fillRect(x - d * 5, y - 9, 3, 5);
        ctx.fillStyle = '#ffcccc';
        const reach = (step & 1) === 0 ? 4 : 6;
        ctx.fillRect(x + d * 2, y - 7, d * reach, 2);
        ctx.fillStyle = '#ffa502';
        ctx.fillRect(x - 2, y - 2, 4, 2);
      } else if (lem.state === 'BASHING') {
        // Forward digging scoop arms
        const thrust = (step % 2) * 3;
        ctx.fillStyle = '#ffcccc';
        ctx.fillRect(x + d * (2 + thrust), y - 8, 4, 3);
        ctx.fillStyle = '#ffa502';
        ctx.fillRect(x - 3, y - 2, 6, 2);
      } else if (lem.state === 'MINING') {
        // Swinging pickaxe
        ctx.fillStyle = '#dfe6e9';
        const swingY = (step & 1) === 0 ? y - 12 : y - 4;
        ctx.fillRect(x + d * 4, swingY, 4, 3);
        ctx.fillStyle = '#ffa502';
        ctx.fillRect(x - 2, y - 2, 4, 2);
      } else if (lem.state === 'DIGGING') {
        // Vertical shovel / drill beneath feet
        ctx.fillStyle = '#dfe6e9';
        ctx.fillRect(x - 2, y - 3, 4, 4);
        ctx.fillStyle = '#ffcccc';
        ctx.fillRect(x - 4, y - 7, 8, 2);
      } else if (lem.state === 'OH_NO') {
        // Hands on head shaking
        ctx.fillStyle = '#ffcccc';
        ctx.fillRect(x - 5, y - 14, 2, 4);
        ctx.fillRect(x + 3, y - 14, 2, 4);
      } else {
        // Walking / Falling / Climbing animated feet
        const fOffset = step === 0 ? -2 : step === 2 ? 1 : 0;
        ctx.fillStyle = '#ffa502';
        ctx.fillRect(x - 2 + fOffset, y - 2, 3, 2);
        ctx.fillRect(x - fOffset, y - 2, 3, 2);
      }

      ctx.restore();
    }
  }

  // Export for Node verification scripts and initialize in browser
  root.LemmingsEngine = LemmingsEngine;
  root.LemmingsApp = LemmingsApp;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LemmingsEngine, SKILL_KEYS };
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('game-canvas')) {
        window.lemmingsApp = new LemmingsApp();
      }
      // Register PWA Service Worker when served over HTTP(S)
      if (
        'serviceWorker' in navigator &&
        (window.location.protocol === 'https:' || window.location.protocol === 'http:')
      ) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      }
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
