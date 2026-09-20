// SPDX-License-Identifier: MIT
import type { Theme } from './themes.ts';
export type Ctx = CanvasRenderingContext2D;
export function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, width = 0.7): void {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
export function dot(ctx: Ctx, x: number, y: number, color: string, radius = 2): void {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
}
export function text(ctx: Ctx, value: string, x: number, y: number, color: string, size = 10, align: CanvasTextAlign = 'left'): void {
  ctx.font = `${size}px "SFMono-Regular", Consolas, "Liberation Mono", monospace`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(value, x, y);
}
export function plot(ctx: Ctx, values: number[], x: number, y: number, width: number, height: number, color: string): void {
  if (values.length < 2) return;
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.1;
  values.forEach((v, i) => { const px = x + i / (values.length - 1) * width, py = y + height * (1 - v); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke();
}
export function grid(ctx: Ctx, w: number, h: number, theme: Theme, spacing = 40): void {
  for (let x = 0; x < w; x += spacing) for (let y = 0; y < h; y += spacing) dot(ctx, x, y, `${theme.line}b0`, 0.65);
}
