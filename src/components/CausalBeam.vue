<!-- SPDX-License-Identifier: MIT -->
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { Universe } from '../core/types.ts';
import { agentPoints } from '../rendering/panes.ts';

// One visible causal chain per retained trace: agent node → experiment row → world model.
// Presentation only. It measures the panes at the moment a trace appears and never reads the PRNG.
const props = defineProps<{ universe: Universe; revision: number; host?: HTMLElement; active: boolean }>();
interface Beam { key: number; width: number; height: number; path: string; stops: [number, number][] }
const beam = ref<Beam>();
let serial = 0, seen = '', timer: ReturnType<typeof setTimeout> | undefined;

function center(el: Element | null | undefined, origin: DOMRect): [number, number] | undefined {
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  return r.width && r.height ? [r.left - origin.left + r.width / 2, r.top - origin.top + r.height / 2] : undefined;
}
function bend([ax, ay]: [number, number], [bx, by]: [number, number], lift: number): [number, number] {
  const mx = (ax + bx) / 2, my = (ay + by) / 2, length = Math.hypot(bx - ax, by - ay) || 1;
  return [mx - (by - ay) / length * length * lift, my + (bx - ax) / length * length * lift];
}
async function fire() {
  const trace = props.universe.traces.at(-1);
  if (!trace || !props.active || !props.host || innerWidth < 820) return;
  await nextTick();
  const host = props.host, origin = host.getBoundingClientRect();
  const canvas = host.querySelector('.agent-pane .telemetry-canvas');
  const box = canvas?.getBoundingClientRect(), node = box && agentPoints(props.universe, box.width, box.height).find(p => p.id === trace.agent);
  const from: [number, number] | undefined = box && node ? [box.left - origin.left + node.x, box.top - origin.top + node.y] : center(canvas, origin);
  const via = center(host.querySelector('.experiment-pane tr.trace-linked .experiment-link') ?? host.querySelector('.experiment-pane .pane-heading'), origin);
  const to = center(host.querySelector('.world-pane .telemetry-canvas'), origin);
  if (!from || !via || !to) return;
  const [q1, q2] = [bend(from, via, 0.22), bend(via, to, -0.18)];
  beam.value = {
    key: ++serial, width: origin.width, height: origin.height, stops: [from, via, to],
    path: `M${from.join(' ')} Q${q1.join(' ')} ${via.join(' ')} Q${q2.join(' ')} ${to.join(' ')}`,
  };
  clearTimeout(timer); timer = setTimeout(() => beam.value = undefined, 3200);
}
// The universe object is mutated in place, so the revision counter signals each step.
watch(() => props.revision, () => {
  const current = `${props.universe.id}/${props.universe.traces.at(-1)?.id ?? ''}`, previous = seen;
  seen = current;
  if (previous && previous !== current && previous.startsWith(`${props.universe.id}/`)) void fire();
}, { immediate: true });
watch(() => props.active, active => { if (!active) { clearTimeout(timer); beam.value = undefined; } });
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <svg v-if="beam" :key="beam.key" class="causal-beam" :viewBox="`0 0 ${beam.width} ${beam.height}`" aria-hidden="true">
    <defs>
      <linearGradient :id="`beam-gradient-${beam.key}`" gradientUnits="userSpaceOnUse" :x1="beam.stops[0][0]" :y1="beam.stops[0][1]" :x2="beam.stops[2][0]" :y2="beam.stops[2][1]">
        <stop offset="0" class="beam-stop-cause" /><stop offset="0.5" class="beam-stop-sun" /><stop offset="1" class="beam-stop-leaf" />
      </linearGradient>
    </defs>
    <path class="beam-glow" :d="beam.path" :stroke="`url(#beam-gradient-${beam.key})`" pathLength="1" />
    <path class="beam-core" :d="beam.path" :stroke="`url(#beam-gradient-${beam.key})`" pathLength="1" />
    <circle v-for="([x, y], i) in beam.stops" :key="i" class="beam-node" :class="`beam-node-${i}`" :cx="x" :cy="y" r="10" />
    <circle class="beam-photon" r="2.6">
      <animateMotion dur="1.5s" fill="freeze" calcMode="spline" keyTimes="0;1" keyPoints="0;1" keySplines=".65 0 .35 1" :path="beam.path" />
    </circle>
  </svg>
</template>
