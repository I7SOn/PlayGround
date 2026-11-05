export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.noise = null;
    this.ambient = [];
    this.heartbeat = 0;
  }

  init() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    this.noise = this.makeNoise(2.2);
    this.startAmbient();
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.72 + white * 0.28;
      data[i] = last * 1.9;
    }
    return buffer;
  }

  noiseSource(playbackRate = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = playbackRate;
    return src;
  }

  startAmbient() {
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0.12;
    bus.connect(this.master);

    const rain = this.noiseSource(1.35);
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1800;
    rainFilter.Q.value = 0.35;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.42;
    rain.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(bus);
    rain.start();

    const wind = this.noiseSource(0.45);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 190;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.3;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(bus);
    wind.start();

    const humGain = ctx.createGain();
    humGain.gain.value = 0.035;
    humGain.connect(this.master);
    [45, 67.5, 90.5].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 2 ? 'triangle' : 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.3 / (i + 1);
      osc.connect(g);
      g.connect(humGain);
      osc.start();
      this.ambient.push(osc);
    });

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain);
    lfoGain.connect(humGain.gain);
    lfo.start();
    this.ambient.push(lfo);
    this.ambient.push(rain, wind);
  }

  env(gain, t, peak, attack, decay) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  burst({ rate = 1, freq = 1000, q = 0.7, peak = 0.5, attack = 0.002, decay = 0.12, type = 'lowpass', delay = 0, pan = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.noiseSource(rate);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    let node = gain;
    if (pan) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      gain.connect(p);
      node = p;
    }
    src.connect(filter);
    filter.connect(gain);
    node.connect(this.master);
    this.env(gain, t, peak, attack, decay);
    src.start(t);
    src.stop(t + attack + decay + 0.05);
  }

  tone({ freq = 440, end = null, type = 'sine', peak = 0.15, attack = 0.005, decay = 0.15, delay = 0, pan = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(10, end), t + attack + decay);
    const gain = this.ctx.createGain();
    let node = gain;
    if (pan) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      gain.connect(p);
      node = p;
    }
    osc.connect(gain);
    node.connect(this.master);
    this.env(gain, t, peak, attack, decay);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  shot() {
    if (!this.ctx) return;
    this.burst({ rate: 1.8, freq: 4600, type: 'highpass', peak: 0.5, decay: 0.045 });
    this.burst({ rate: 1, freq: 820, type: 'lowpass', peak: 0.55, decay: 0.14 });
    this.burst({ rate: 0.7, freq: 300, type: 'lowpass', peak: 0.6, decay: 0.28, delay: 0.015 });
    this.tone({ freq: 145, end: 38, type: 'sine', peak: 0.55, decay: 0.17 });
    this.tone({ freq: 78, end: 32, type: 'triangle', peak: 0.25, decay: 0.26 });
  }

  enemyShot(distance = 10, pan = 0) {
    const v = Math.max(0.05, 1 - distance / 55);
    this.burst({ rate: 1.2, freq: 2800, type: 'highpass', peak: 0.22 * v, decay: 0.05, pan });
    this.burst({ rate: 0.8, freq: 420, peak: 0.3 * v, decay: 0.2, delay: 0.01, pan });
    this.tone({ freq: 110, end: 35, peak: 0.17 * v, decay: 0.2, pan });
  }

  hit(head = false) {
    if (!this.ctx) return;
    this.tone({ freq: head ? 2300 : 1500, end: head ? 1400 : 1100, type: 'square', peak: 0.06, decay: 0.035 });
    if (head) {
      this.tone({ freq: 3100, peak: 0.045, decay: 0.1, delay: 0.015 });
      this.burst({ freq: 6000, type: 'highpass', peak: 0.07, decay: 0.05 });
    }
  }

  empty() {
    this.burst({ freq: 2800, type: 'highpass', peak: 0.16, decay: 0.025 });
    this.tone({ freq: 900, end: 450, type: 'square', peak: 0.035, decay: 0.04 });
  }

  reload(duration = 1.8) {
    if (!this.ctx) return;
    const t = 0;
    this.burst({ freq: 2200, type: 'bandpass', q: 1.2, peak: 0.14, decay: 0.045, delay: t });
    this.burst({ freq: 1200, q: 2, type: 'bandpass', peak: 0.18, decay: 0.07, delay: duration * 0.36 });
    this.tone({ freq: 310, end: 190, type: 'square', peak: 0.04, decay: 0.06, delay: duration * 0.55 });
    this.burst({ freq: 1800, type: 'bandpass', q: 1.4, peak: 0.2, decay: 0.08, delay: duration * 0.8 });
    this.tone({ freq: 520, end: 300, type: 'square', peak: 0.05, decay: 0.05, delay: duration * 0.84 });
  }

  damage() {
    if (!this.ctx) return;
    this.tone({ freq: 82, end: 34, type: 'sine', peak: 0.36, decay: 0.26 });
    this.burst({ rate: 0.5, freq: 520, type: 'lowpass', peak: 0.26, decay: 0.18 });
    this.tone({ freq: 1900, end: 700, type: 'sawtooth', peak: 0.035, decay: 0.17, delay: 0.03 });
  }

  enemyDown() {
    this.burst({ rate: 0.6, freq: 700, type: 'lowpass', peak: 0.12, decay: 0.2 });
  }

  waveStart(wave = 1) {
    if (!this.ctx) return;
    this.tone({ freq: 190, end: 320, type: 'sawtooth', peak: 0.08, attack: 0.02, decay: 0.4 });
    this.tone({ freq: 95, end: 160, type: 'square', peak: 0.06, attack: 0.02, decay: 0.5 });
    this.tone({ freq: 1120, peak: 0.05, decay: 0.08, delay: 0.12 });
    this.tone({ freq: 1120, peak: 0.05, decay: 0.08, delay: 0.24 });
    if (wave >= 5) {
      this.tone({ freq: 240, end: 90, type: 'sawtooth', peak: 0.1, decay: 0.9, delay: 0.4 });
    }
  }

  waveClear() {
    if (!this.ctx) return;
    [523.25, 659.25, 783.99].forEach((f, i) => this.tone({ freq: f, peak: 0.055, decay: 0.45, delay: i * 0.1 }));
  }

  win() {
    if (!this.ctx) return;
    [261.6, 329.6, 392, 523.25, 659.25].forEach((f, i) => this.tone({ freq: f, type: 'triangle', peak: 0.07, decay: 0.8, delay: i * 0.16 }));
  }

  lose() {
    if (!this.ctx) return;
    this.tone({ freq: 180, end: 48, type: 'sawtooth', peak: 0.15, decay: 1.2 });
    this.tone({ freq: 90, end: 30, type: 'sine', peak: 0.2, decay: 1.4 });
  }

  pickup() {
    this.tone({ freq: 740, end: 1180, type: 'sine', peak: 0.07, decay: 0.12 });
    this.tone({ freq: 1480, peak: 0.045, decay: 0.14, delay: 0.06 });
  }

  lowHealthBeat(intensity = 1) {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.heartbeat < 720) return;
    this.heartbeat = now;
    this.tone({ freq: 58, end: 34, type: 'sine', peak: 0.11 * intensity, decay: 0.18 });
    this.tone({ freq: 48, end: 28, type: 'sine', peak: 0.07 * intensity, decay: 0.22, delay: 0.2 });
  }
}

export const audio = new AudioEngine();
