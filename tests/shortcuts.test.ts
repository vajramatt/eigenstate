// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortcutFor } from '../src/core/shortcuts.ts';
test('Space pauses from toolbar buttons, links, or the page', () => {
  for (const tag of ['BUTTON', 'A', 'BODY', 'CANVAS']) assert.equal(shortcutFor(' ', 'Space', tag, false, false), 'pause');
  assert.equal(shortcutFor('F', 'KeyF', 'BUTTON', false, false), 'fullscreen');
  assert.equal(shortcutFor('p', 'KeyP', 'BODY', false, false), 'privacy');
});
test('shortcuts preserve typing and browser modifier combinations', () => {
  for (const tag of ['INPUT', 'SELECT', 'TEXTAREA']) assert.equal(shortcutFor(' ', 'Space', tag, false, false), null);
  assert.equal(shortcutFor('f', 'KeyF', 'DIV', true, false), null);
  assert.equal(shortcutFor('f', 'KeyF', 'BODY', false, true), null);
});
