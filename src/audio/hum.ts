// SPDX-License-Identifier: MIT
/** Locally synthesized ambient soundscape. No samples, network, or audio capture. */
export class AmbientHum {
  private context?: AudioContext;
  private master?: GainNode;
  private filter?: BiquadFilterNode;
  private breathLfo?: OscillatorNode;
  private stopTimer?: ReturnType<typeof setTimeout>;
  private nodes: AudioNode[] = [];
  private activity = 0.22;
  enabled = false;
  volume = 0.35;
  private active = true;
  get status(): string {
    if (!this.enabled) return 'off';
    if (!this.active) return 'paused';
    if (this.volume === 0) return 'muted';
    return this.context?.state === 'running' ? 'playing' : 'blocked';
  }
  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    clearTimeout(this.stopTimer);
    if (!enabled) { this.fadeOut(); return; }
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain(); this.master.gain.value = 0; this.master.connect(this.context.destination);
      const breath = this.context.createGain(); breath.gain.value = 0.78; breath.connect(this.master);
      const lfo = this.context.createOscillator(), depth = this.context.createGain();
      lfo.type = 'sine'; lfo.frequency.value = 0.09; depth.gain.value = 0.22;
      // Eleven-second swells, never silent. Modulate before the master so mute
      // and pause always silence the complete signal, including modulation.
      lfo.connect(depth); depth.connect(breath.gain); lfo.start();
      const filter = this.context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 380; filter.Q.value = 0.4; filter.connect(breath);
      this.filter = filter; this.breathLfo = lfo; this.setActivity(this.activity);
      this.nodes.push(filter, breath, lfo, depth, this.master);
      // A low A/E foundation with a restrained minor chord above it. Upper
      // voices remain audible on laptop speakers; independent envelopes keep
      // the chord moving without scheduling notes or advancing simulation RNG.
      const voices = [[55, 0.30], [82.4069, 0.16], [110.06, 0.13], [130.8128, 0.09], [164.8138, 0.09], [220.08, 0.06], [329.6276, 0.04]];
      voices.forEach(([frequency, level], index) => {
        const oscillator = this.context!.createOscillator(), gain = this.context!.createGain();
        const pan = this.context!.createStereoPanner();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.value = level;
        oscillator.connect(gain); gain.connect(pan); pan.connect(filter);
        // Keep the bass centered; higher partials drift slowly across stereo.
        if (index > 1) {
          const orbit = this.context!.createOscillator(), width = this.context!.createGain();
          orbit.frequency.value = 0.013 + index * 0.003; width.gain.value = 0.65;
          orbit.connect(width); width.connect(pan.pan); orbit.start();
          const swell = this.context!.createOscillator(), swellDepth = this.context!.createGain();
          swell.frequency.value = 0.019 + index * 0.004; swellDepth.gain.value = level * 0.35;
          gain.gain.value = level * 0.65;
          swell.connect(swellDepth); swellDepth.connect(gain.gain); swell.start();
          const drift = this.context!.createOscillator(), cents = this.context!.createGain();
          drift.frequency.value = 0.009 + index * 0.002; cents.gain.value = 3;
          drift.connect(cents); cents.connect(oscillator.detune); drift.start();
          this.nodes.push(orbit, width, swell, swellDepth, drift, cents);
        }
        oscillator.start(); this.nodes.push(oscillator, gain, pan);
      });
      // Two quiet stereo reflections add space. No feedback loop: echoes are
      // bounded, and all dry/wet audio passes through breath and master gain.
      for (const [delayTime, position] of [[0.37, -0.8], [0.61, 0.8]]) {
        const delay = this.context.createDelay(1), wet = this.context.createGain(), pan = this.context.createStereoPanner();
        delay.delayTime.value = delayTime; wet.gain.value = 0.12; pan.pan.value = position;
        filter.connect(delay); delay.connect(wet); wet.connect(pan); pan.connect(breath);
        this.nodes.push(delay, wet, pan);
      }
    }
    await this.sync(this.active);
  }
  setVolume(volume: number): void { this.volume = Math.min(1, Math.max(0, volume)); this.setGain(); }
  setActivity(activity: number): void {
    this.activity = Math.min(1, Math.max(0, activity));
    if (!this.context) return;
    const time = this.context.currentTime;
    this.filter?.frequency.setTargetAtTime(250 + this.activity * 230, time, 1.8);
    this.breathLfo?.frequency.setTargetAtTime(0.055 + this.activity * 0.08, time, 2.5);
    this.setGain();
  }
  private setGain(): void {
    if (!this.context || !this.master) return;
    const time = this.context.currentTime;
    this.master.gain.cancelScheduledValues(time);
    this.master.gain.setTargetAtTime(this.enabled && this.active ? this.volume * (0.16 + this.activity * 0.05) : 0, time, 0.45);
  }
  private fadeOut(): void {
    if (!this.context) return;
    this.setGain();
    this.stopTimer = setTimeout(() => { if (!this.enabled) void this.context?.suspend(); }, 800);
  }
  async sync(active: boolean): Promise<void> {
    this.active = active;
    if (!this.context) return;
    if (active && this.enabled) { await this.context.resume(); this.setGain(); }
    else { this.setGain(); await this.context.suspend(); }
  }
  async destroy(): Promise<void> {
    clearTimeout(this.stopTimer);
    for (const node of this.nodes) { if (node instanceof OscillatorNode) node.stop(); node.disconnect(); }
    this.nodes = []; await this.context?.close(); this.context = undefined; this.master = undefined; this.filter = undefined; this.breathLfo = undefined;
  }
}
