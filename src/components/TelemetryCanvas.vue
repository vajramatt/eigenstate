<!-- SPDX-License-Identifier: MIT -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Universe } from '../core/types.ts';
import type { Theme } from '../rendering/themes.ts';
import { drawPane, REFRESH, type PaneKind } from '../rendering/panes.ts';
import { blendVisual } from '../rendering/motion.ts';
const props = defineProps<{ kind: PaneKind; universe: Universe; theme: Theme; revision: number; label: string; quiet: boolean; paused: boolean; tempo?: number }>();
const canvas = ref<HTMLCanvasElement>();
let observer: ResizeObserver | undefined, visible = true, intersection: IntersectionObserver | undefined;
let lastDraw = -Infinity, frame = 0, width = 0, height = 0, dpr = 1;
let visual = structuredClone(props.universe), clock = props.universe.age;
const moving = () => !props.quiet && !props.paused && visible && !document.hidden;
function draw(force = false) {
  const el = canvas.value;
  if (!el || !visible || document.hidden || !width || !height) return;
  const now = performance.now(), interval = moving() ? 1000 / 30 : props.quiet ? 5000 : REFRESH[props.kind];
  if (!force && now - lastDraw < interval) return;
  const dt = Number.isFinite(lastDraw) ? Math.min((now - lastDraw) / 1000, 0.1) : 0;
  if (moving()) { clock += dt * (props.tempo ?? 1); blendVisual(visual, props.universe, 1 - Math.exp(-dt * 7)); }
  const ctx = el.getContext('2d'); if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPane(props.kind, ctx, moving() ? visual : props.universe, props.theme, width, height, clock);
  lastDraw = now;
}
function loop() { frame = 0; draw(); if (moving()) frame = requestAnimationFrame(loop); }
function sync() { cancelAnimationFrame(frame); frame = 0; lastDraw = -Infinity; draw(true); if (moving()) frame = requestAnimationFrame(loop); }
function resize() {
  if (!canvas.value) return;
  const rect = canvas.value.getBoundingClientRect(); width = rect.width; height = rect.height;
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.value.width = Math.round(width * dpr); canvas.value.height = Math.round(height * dpr); draw(true);
}
watch(() => props.revision, () => { if (!moving()) draw(); });
watch(() => props.theme.id, () => draw(true));
watch(() => props.universe.id, () => { visual = structuredClone(props.universe); clock = props.universe.age; sync(); });
watch(() => [props.quiet, props.paused, props.tempo], () => { visual = structuredClone(props.universe); sync(); });
onMounted(() => {
  observer = new ResizeObserver(resize); observer.observe(canvas.value!);
  intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }); intersection.observe(canvas.value!);
  document.addEventListener('visibilitychange', sync); resize(); sync();
});
onBeforeUnmount(() => { cancelAnimationFrame(frame); observer?.disconnect(); intersection?.disconnect(); document.removeEventListener('visibilitychange', sync); });
</script>
<template><canvas ref="canvas" class="telemetry-canvas" role="img" :aria-label="label"></canvas></template>
