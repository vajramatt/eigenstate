<!-- SPDX-License-Identifier: MIT -->
<script setup lang="ts">
import { computed, useId } from 'vue';
import { CONE, MARK, PHASES, latitude, markFrames, project, smil } from '../rendering/eigenmark.ts';

// The Eigenstate mark. A state vector precesses in superposition, is measured onto |0⟩,
// rests as an eigenstate, and is released. SMIL keyframes come from tested geometry and
// exist only while `animated` is set, so quiet motion and paused universes show one still pose.
const props = withDefaults(defineProps<{ animated?: boolean; detailed?: boolean; seconds?: number }>(), { animated: false, detailed: false, seconds: 10 });

const frames = markFrames();
const x = smil(frames, f => f.x), y = smil(frames, f => f.y), depth = smil(frames, f => f.front ? 1 : 0.42);
const pole = project(0, 0), south = project(Math.PI, 0), still = project(CONE, -Math.PI / 5);
const cone = latitude(CONE), equator = latitude(Math.PI / 2);
const { cx, cy, r } = MARK;
const dur = computed(() => `${props.seconds}s`);
const glow = `eigen-glow-${useId()}`;
const phase = (...pairs: [number, number | string][]) => ({ keyTimes: pairs.map(p => p[0]).join(';'), values: pairs.map(p => p[1]).join(';') });
const ring = phase([0, 1], [PHASES.measure, 1], [PHASES.rest, 0], [PHASES.release, 0], [1, 1]);
const bloomR = phase([0, 1.6], [PHASES.rest - 0.01, 1.6], [PHASES.rest + 0.14, 7.5], [1, 7.5]);
const bloomO = phase([0, 0], [PHASES.rest - 0.01, 0], [PHASES.rest, 0.9], [PHASES.rest + 0.14, 0], [1, 0]);
const settled = phase([0, 0], [PHASES.rest - 0.02, 0], [PHASES.rest + 0.02, 1], [PHASES.release, 1], [PHASES.release + 0.04, 0], [1, 0]);
const drifting = phase([0, 1], [PHASES.measure - 0.03, 1], [PHASES.measure + 0.03, 0], [1 - 0.04, 0], [1, 1]);
</script>

<template>
  <svg class="eigen-mark" :class="{ 'is-animated': animated, 'is-detailed': detailed }" :viewBox="detailed ? '-2 -1 44 47' : '0 0 40 40'" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient :id="glow"><stop offset="0" stop-color="var(--lc-sun)" stop-opacity=".55" /><stop offset="1" stop-color="var(--lc-sun)" stop-opacity="0" /></radialGradient>
    </defs>
    <circle class="mark-sphere" :cx="cx" :cy="cy" :r="r" />
    <ellipse class="mark-back" :cx="cx" :cy="equator.cy" :rx="equator.rx" :ry="equator.ry" />
    <path class="mark-equator" :d="`M${cx - r} ${cy}A${equator.rx} ${equator.ry} 0 0 0 ${cx + r} ${cy}`" />
    <line class="mark-axis" :x1="cx" :y1="pole.y" :x2="cx" :y2="south.y" />
    <ellipse class="mark-cone" :cx="cx" :cy="cone.cy" :rx="cone.rx" :ry="cone.ry">
      <animate v-if="animated" attributeName="opacity" :dur="dur" repeatCount="indefinite" v-bind="ring" />
    </ellipse>
    <circle class="mark-pole" :cx="pole.x" :cy="pole.y" r="1.1" />
    <circle class="mark-bloom" :cx="pole.x" :cy="pole.y" r="1.6" opacity="0">
      <template v-if="animated"><animate attributeName="r" :dur="dur" repeatCount="indefinite" v-bind="bloomR" /><animate attributeName="opacity" :dur="dur" repeatCount="indefinite" v-bind="bloomO" /></template>
    </circle>
    <circle class="mark-halo" :cx="still.x" :cy="still.y" r="5.5" :fill="`url(#${glow})`">
      <template v-if="animated"><animate attributeName="cx" :dur="dur" repeatCount="indefinite" calcMode="linear" v-bind="x" /><animate attributeName="cy" :dur="dur" repeatCount="indefinite" calcMode="linear" v-bind="y" /></template>
    </circle>
    <line class="mark-vector" :x1="cx" :y1="cy" :x2="still.x" :y2="still.y">
      <template v-if="animated"><animate attributeName="x2" :dur="dur" repeatCount="indefinite" calcMode="linear" v-bind="x" /><animate attributeName="y2" :dur="dur" repeatCount="indefinite" calcMode="linear" v-bind="y" /><animate attributeName="stroke-opacity" :dur="dur" repeatCount="indefinite" calcMode="linear" v-bind="depth" /></template>
    </line>
    <circle class="mark-origin" :cx="cx" :cy="cy" r=".9" />
    <circle class="mark-tip" :cx="still.x" :cy="still.y" r="2">
      <template v-if="animated"><animate attributeName="cx" :dur="dur" repeatCount="indefinite" calcMode="linear" v-bind="x" /><animate attributeName="cy" :dur="dur" repeatCount="indefinite" calcMode="linear" v-bind="y" /><animate attributeName="fill-opacity" :dur="dur" repeatCount="indefinite" calcMode="linear" v-bind="depth" /></template>
    </circle>
    <g v-if="detailed" class="mark-labels">
      <text :x="pole.x + 2.6" :y="pole.y - 1.4">|0⟩</text>
      <text :x="south.x + 2.6" :y="south.y + 3.4">|1⟩</text>
      <text class="mark-readout" :x="cx" y="44.2" text-anchor="middle" :opacity="animated ? 1 : 0">superposition<animate v-if="animated" attributeName="opacity" :dur="dur" repeatCount="indefinite" v-bind="drifting" /></text>
      <text class="mark-readout is-eigen" :x="cx" y="44.2" text-anchor="middle" :opacity="animated ? 0 : 1">measured · a = +1<animate v-if="animated" attributeName="opacity" :dur="dur" repeatCount="indefinite" v-bind="settled" /></text>
    </g>
  </svg>
</template>

<style scoped>
.eigen-mark { overflow: visible; fill: none; stroke-linecap: round; }
.mark-sphere { stroke: currentColor; stroke-width: 1.2; opacity: .62; }
.mark-back { stroke: currentColor; stroke-width: .7; stroke-dasharray: 1.2 1.8; opacity: .28; }
.mark-equator { stroke: currentColor; stroke-width: 1; opacity: .5; }
.mark-axis { stroke: currentColor; stroke-width: .6; stroke-dasharray: .8 1.6; opacity: .32; }
.mark-cone { stroke: var(--lc-sun); stroke-width: .6; stroke-dasharray: .6 1.4; opacity: .55; }
.eigen-mark:not(.is-animated) .mark-cone { opacity: .45; }
.mark-pole { fill: currentColor; stroke: none; opacity: .55; }
.mark-bloom { stroke: var(--lc-sun); stroke-width: .7; }
.mark-halo { stroke: none; }
.mark-vector { stroke: var(--lc-sun); stroke-width: 1.7; }
.mark-origin { fill: currentColor; stroke: none; opacity: .7; }
.mark-tip { fill: var(--lc-sun); stroke: none; }
.mark-labels text { fill: currentColor; stroke: none; font: 3px var(--mono); letter-spacing: .04em; opacity: .72; }
.mark-labels .mark-readout { font-size: 2.6px; letter-spacing: .12em; text-transform: uppercase; opacity: 1; }
.mark-labels .is-eigen { fill: var(--lc-sun-ink); }
.is-detailed .mark-sphere { stroke-width: .7; }
.is-detailed .mark-equator { stroke-width: .6; }
.is-detailed .mark-vector { stroke-width: 1.1; }
.is-detailed .mark-tip { r: 1.5px; }
</style>
