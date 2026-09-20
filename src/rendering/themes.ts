// SPDX-License-Identifier: MIT
// Palette references and upstream licenses are recorded in THIRD_PARTY_NOTICES.md.
export interface Theme {
  id: string; name: string; description: string; background: string; panel: string; raised: string;
  text: string; muted: string; faint: string; accent: string; secondary: string; third: string; line: string; warning: string;
}
export const themes: Theme[] = [
  { id: 'eigenstate', name: 'Eigenstate', description: 'Deep ocean · ion blue', background: '#080e18', panel: '#0b1421', raised: '#111e2e', text: '#d1e0ed', muted: '#8c9eb5', faint: '#536981', accent: '#78dce8', secondary: '#6a94ef', third: '#a8b7d8', line: '#203044', warning: '#e4c18a' },
  { id: 'tokyonight', name: 'Tokyo Night', description: 'Midnight · electric lavender', background: '#1a1b26', panel: '#1e2030', raised: '#25283d', text: '#c0caf5', muted: '#a0aace', faint: '#697492', accent: '#7dcfff', secondary: '#bb9af7', third: '#9ece6a', line: '#343b58', warning: '#e0af68' },
  { id: 'synthwave84', name: "Synthwave '84", description: 'Deep violet · hot pink', background: '#241b2f', panel: '#2a2038', raised: '#342546', text: '#f4e8fc', muted: '#c3a6d2', faint: '#9476a5', accent: '#ff7edb', secondary: '#36f9f6', third: '#fede5d', line: '#4a345c', warning: '#fede5d' },
  { id: 'nord', name: 'Nord', description: 'Polar night · arctic blue', background: '#242a35', panel: '#2e3440', raised: '#3b4252', text: '#eceff4', muted: '#bbc5d5', faint: '#78869a', accent: '#88c0d0', secondary: '#81a1c1', third: '#a3be8c', line: '#434c5e', warning: '#ebcb8b' },
  { id: 'catppuccin', name: 'Catppuccin Mocha', description: 'Soft charcoal · mauve', background: '#181825', panel: '#1e1e2e', raised: '#313244', text: '#cdd6f4', muted: '#bac2de', faint: '#7f849c', accent: '#cba6f7', secondary: '#89dceb', third: '#a6e3a1', line: '#45475a', warning: '#f9e2af' },
];
export function getTheme(id: string): Theme { return themes.find(t => t.id === id) ?? themes[0]; }
export function applyTheme(theme: Theme): void {
  for (const [key, value] of Object.entries(theme)) if (value.startsWith('#')) document.documentElement.style.setProperty(`--${key}`, value);
  document.documentElement.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.background);
}
