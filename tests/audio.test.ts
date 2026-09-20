// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AmbientHum } from '../src/audio/hum.ts';

class Param {
  value = 0; target = 0;
  cancelScheduledValues() {}
  setTargetAtTime(value: number) { this.target = value; }
}
class Node { connections: unknown[] = []; connect(target: unknown) { this.connections.push(target); } disconnect() {} }
class Oscillator extends Node { type = ''; frequency = new Param(); detune = new Param(); start() {} stop() {} }
class Context {
  static last: Context;
  state = 'suspended'; currentTime = 0; destination = new Node();
  gains: (Node & { gain: Param })[] = [];
  oscillators: Oscillator[] = [];
  constructor() { Context.last = this; }
  createGain() { const n = Object.assign(new Node(), { gain: new Param() }); this.gains.push(n); return n; }
  createBiquadFilter() { return Object.assign(new Node(), { type: '', frequency: new Param(), Q: new Param() }); }
  createOscillator() { const n = new Oscillator(); this.oscillators.push(n); return n; }
  createStereoPanner() { return Object.assign(new Node(), { pan: new Param() }); }
  createDelay() { return Object.assign(new Node(), { delayTime: new Param() }); }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}
test('hum creates audio only on request and reports pause, mute, and playing states', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const originalOscillator = Object.getOwnPropertyDescriptor(globalThis, 'OscillatorNode');
  Object.defineProperty(globalThis, 'AudioContext', { value: Context, configurable: true });
  Object.defineProperty(globalThis, 'OscillatorNode', { value: Oscillator, configurable: true });
  const hum = new AmbientHum();
  t.after(async () => {
    await hum.destroy();
    if (original) Object.defineProperty(globalThis, 'AudioContext', original); else Reflect.deleteProperty(globalThis, 'AudioContext');
    if (originalOscillator) Object.defineProperty(globalThis, 'OscillatorNode', originalOscillator); else Reflect.deleteProperty(globalThis, 'OscillatorNode');
  });
  assert.equal(hum.status, 'off'); await hum.setEnabled(true);
  assert.equal(hum.status, 'playing'); assert.ok(Context.last.gains[0].gain.target > 0);
  const carriers = [110, 116].map(f => Context.last.oscillators.find(o => o.frequency.value === f)!);
  const channels = carriers.map(o => o.connections[0] as Node & { pan: Param });
  assert.deepEqual(channels.map(p => p.pan.value), [-1, 1], 'carriers must remain isolated to opposite ears');
  const binaural = channels[0].connections[0] as Node & { gain: Param };
  assert.equal(channels[1].connections[0], binaural);
  assert.equal(binaural.gain.target, 0, 'binaural layer starts silent');
  assert.deepEqual(binaural.connections, [Context.last.gains[0]], 'carriers bypass echo and modulation but obey master volume');
  hum.setBinaural(true); assert.ok(binaural.gain.target > 0);
  hum.setBinauralIntensity(0); assert.equal(binaural.gain.target, 0);
  hum.setBinauralIntensity(2); assert.equal(binaural.gain.target, 0.18);
  hum.setBinauralIntensity(NaN); assert.equal(binaural.gain.target, 0.18);
  hum.setBinaural(false); assert.equal(binaural.gain.target, 0);
  hum.setBinaural(true);
  const lfo = Context.last.oscillators.find(o => o.frequency.value < 1)!;
  const depth = lfo.connections[0] as Node & { gain: Param };
  const breath = Context.last.gains.find(g => depth.connections.includes(g.gain))!;
  assert.ok(lfo.frequency.value > 0 && lfo.frequency.value < 0.2, 'swells must be slow');
  assert.ok(breath.gain.value - depth.gain.value > 0, 'swells should not cut to silence');
  assert.ok(breath.gain.value + depth.gain.value <= 1, 'modulation must not amplify the peak');
  assert.ok(breath.connections.includes(Context.last.gains[0]), 'master volume must remain after modulation');
  const voices = Context.last.oscillators.filter(o => o.frequency.value > 1);
  assert.ok(voices.some(o => o.frequency.value === 55), 'preserve the low foundation');
  assert.ok(voices.some(o => o.frequency.value > 300), 'upper voices should carry on small speakers');
  const count = Context.last.oscillators.length;
  await hum.setEnabled(true);
  assert.equal(Context.last.oscillators.length, count, 'repeated enable must not duplicate voices');
  hum.setActivity(0); const quietGain = Context.last.gains[0].gain.target;
  hum.setActivity(1); assert.ok(Context.last.gains[0].gain.target > quietGain, 'simulation activity should subtly raise the hum');
  assert.deepEqual(carriers.map(o => o.frequency.value), [110, 116], 'activity must not change the binaural difference');
  await hum.sync(false); assert.equal(hum.status, 'paused'); assert.equal(Context.last.gains[0].gain.target, 0);
  await hum.sync(true); assert.equal(hum.status, 'playing');
  hum.setVolume(0); assert.equal(hum.status, 'muted'); assert.equal(Context.last.gains[0].gain.target, 0);
  hum.setVolume(0.5); assert.equal(hum.status, 'playing'); await hum.setEnabled(false); assert.equal(hum.status, 'off');
});
