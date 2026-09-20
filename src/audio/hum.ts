// SPDX-License-Identifier: MIT
/** Original, locally synthesized room hum. No samples, network, or audio capture. */
export class AmbientHum {
  private context?: AudioContext;
  private master?: GainNode;
  private stopTimer?: ReturnType<typeof setTimeout>;
  private nodes: AudioNode[] = [];
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
      this.nodes.push(filter, breath, lfo, depth, this.master);
      // Keep audible upper harmonics so the hum does not depend on deep bass output.
      for (const [frequency, level] of [[55, 0.55], [110.06, 0.22], [165, 0.12]]) {
        const oscillator = this.context.createOscillator(), gain = this.context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.value = level;
        oscillator.connect(gain); gain.connect(filter); oscillator.start(); this.nodes.push(oscillator, gain);
      }
    }
    await this.sync(this.active);
  }
  setVolume(volume: number): void { this.volume = Math.min(1, Math.max(0, volume)); this.setGain(); }
  private setGain(): void {
    if (!this.context || !this.master) return;
    const time = this.context.currentTime;
    this.master.gain.cancelScheduledValues(time);
    this.master.gain.setTargetAtTime(this.enabled && this.active ? this.volume * 0.2 : 0, time, 0.25);
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
    this.nodes = []; await this.context?.close(); this.context = undefined; this.master = undefined;
  }
}
