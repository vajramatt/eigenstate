// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONE, MARK, PHASES, latitude, markFrames, project, smil } from '../src/rendering/eigenmark.ts';

test('the mark cycle loops without a seam', () => {
  const frames = markFrames(), first = frames[0], last = frames.at(-1)!;
  assert.equal(first.t, 0);
  assert.equal(last.t, 1);
  assert.deepEqual([first.x, first.y], [last.x, last.y]);
  for (let i = 1; i < frames.length; i++) assert.ok(frames[i].t > frames[i - 1].t, `keyTimes must increase at ${i}`);
});

test('measurement rests the vector on the |0⟩ pole', () => {
  const pole = project(0, 0), frames = markFrames();
  assert.deepEqual([pole.x, pole.y], [MARK.cx, MARK.cy - MARK.r * Math.sqrt(1 - MARK.tilt ** 2)].map(v => Math.round(v * 1000) / 1000));
  const resting = frames.filter(f => f.t >= PHASES.rest && f.t <= PHASES.release);
  assert.ok(resting.length >= 2);
  for (const f of resting) assert.deepEqual([f.x, f.y], [pole.x, pole.y]);
});

test('precession traces the cone ring, passing behind and in front of the sphere', () => {
  const ring = latitude(CONE), frames = markFrames().filter(f => f.t <= PHASES.measure);
  for (const f of frames) {
    const e = ((f.x - MARK.cx) / ring.rx) ** 2 + ((f.y - ring.cy) / ring.ry) ** 2;
    assert.ok(Math.abs(e - 1) < 0.01, `frame ${f.t} leaves the ring`);
  }
  assert.ok(frames.some(f => f.front) && frames.some(f => !f.front));
});

test('smil channels align with keyTimes', () => {
  const frames = markFrames(), { values, keyTimes } = smil(frames, f => f.x);
  assert.equal(values.split(';').length, keyTimes.split(';').length);
  assert.ok(values.split(';').every(v => Number.isFinite(Number(v))));
});
