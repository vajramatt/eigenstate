// SPDX-License-Identifier: MIT
export type Shortcut = 'pause' | 'fullscreen' | 'theme' | 'hum' | 'colophon' | 'help' | 'settings';
export function shortcutFor(key: string, code: string, tag: string, editable: boolean, modified: boolean): Shortcut | null {
  if (editable || modified || ['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return null;
  if (code === 'Space' || key === ' ') return 'pause';
  return ({ f: 'fullscreen', t: 'theme', d: 'hum', '~': 'colophon', '?': 'help', h: 'help', s: 'settings' } as Record<string, Shortcut>)[key.toLowerCase()] ?? null;
}
