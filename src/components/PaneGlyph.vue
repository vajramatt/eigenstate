<!-- SPDX-License-Identifier: MIT -->
<script setup lang="ts">
import { useId } from 'vue';

// A small instrument glyph for each pane heading. It moves only while the presentation
// director is focused on that pane, so its motion always points at real system state.
export type GlyphKind = 'world' | 'agents' | 'quantum' | 'inference' | 'branches' | 'experiment' | 'terminal';
defineProps<{ kind: GlyphKind; active: boolean }>();
const id = useId();
const orbit = `glyph-orbit-${id}`, wave = `glyph-wave-${id}`, fork = `glyph-fork-${id}`;
</script>

<template>
  <svg class="pane-glyph" :class="{ 'is-active': active }" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <template v-if="kind === 'world'">
      <circle cx="8" cy="8" r="3.2" />
      <path :id="orbit" d="M1.5 8a6.5 2.6 0 1 0 13 0a6.5 2.6 0 1 0 -13 0" class="glyph-faint" />
      <circle r="1.15" class="glyph-sun" :cx="active ? 0 : 14.5" :cy="active ? 0 : 8"><animateMotion v-if="active" dur="4s" repeatCount="indefinite"><mpath :href="`#${orbit}`" /></animateMotion></circle>
    </template>
    <template v-else-if="kind === 'agents'">
      <path d="M3.5 12 8 3.5l4.5 8.5z" class="glyph-faint" />
      <path d="M3.5 12 8 3.5l4.5 8.5z" class="glyph-signal" pathLength="30" stroke-dasharray="4 26"><animate v-if="active" attributeName="stroke-dashoffset" from="30" to="0" dur="2.4s" repeatCount="indefinite" /></path>
      <circle cx="8" cy="3.5" r="1.5" class="glyph-node" />
      <circle cx="3.5" cy="12" r="1.5" class="glyph-node" />
      <circle cx="12.5" cy="12" r="1.5" class="glyph-node" />
    </template>
    <template v-else-if="kind === 'quantum'">
      <clipPath :id="wave"><rect x="1" y="2" width="14" height="12" /></clipPath>
      <line x1="1.5" y1="8" x2="14.5" y2="8" class="glyph-faint" />
      <g :clip-path="`url(#${wave})`"><path :d="`M-15 8${'c1.5-5 3-5 4.5 0s3 5 4.5 0'.repeat(4)}`"><animateTransform v-if="active" attributeName="transform" type="translate" from="0 0" to="9 0" dur="1.8s" repeatCount="indefinite" /></path></g>
    </template>
    <template v-else-if="kind === 'inference'">
      <rect v-for="(h, i) in [6, 10, 4, 8]" :key="i" :x="2 + i * 3.4" :y="14 - h" width="1.8" :height="h" rx=".6" class="glyph-bar">
        <template v-if="active"><animate attributeName="height" :values="`${h};${12 - h};${h}`" :dur="`${1.6 + i * 0.35}s`" repeatCount="indefinite" /><animate attributeName="y" :values="`${14 - h};${2 + h};${14 - h}`" :dur="`${1.6 + i * 0.35}s`" repeatCount="indefinite" /></template>
      </rect>
    </template>
    <template v-else-if="kind === 'branches'">
      <path d="M2 8h4" />
      <path :id="fork" d="M6 8c3 0 4-4.5 8-4.5" />
      <path d="M6 8c3 0 4 4.5 8 4.5" />
      <path d="M6 8h8" class="glyph-faint" />
      <circle cx="2" cy="8" r="1.3" class="glyph-node" />
      <circle r="1.1" class="glyph-sun" :cx="active ? 0 : 14" :cy="active ? 0 : 3.5"><animateMotion v-if="active" dur="1.9s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".4 0 .2 1"><mpath :href="`#${fork}`" /></animateMotion></circle>
    </template>
    <template v-else-if="kind === 'experiment'">
      <circle cx="8" cy="8" r="5.5" class="glyph-faint" />
      <circle cx="8" cy="8" r="5.5" pathLength="1" stroke-dasharray=".72 1" transform="rotate(-90 8 8)" class="glyph-signal"><animate v-if="active" attributeName="stroke-dasharray" values="0 1;1 1;1 1" keyTimes="0;.8;1" dur="3s" repeatCount="indefinite" /></circle>
      <circle cx="8" cy="8" r="1.4" class="glyph-sun" />
    </template>
    <template v-else>
      <path d="m3 5 3 3-3 3" />
      <rect x="8" y="10" width="5" height="1.6" rx=".5" class="glyph-sun"><animate v-if="active" attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1.1s" repeatCount="indefinite" /></rect>
    </template>
  </svg>
</template>

<style scoped>
.pane-glyph { overflow: visible; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
.glyph-faint { opacity: .38; stroke-width: 1; }
.glyph-node { fill: var(--panel); }
.glyph-sun { fill: var(--lc-sun); stroke: none; }
.glyph-signal { stroke: var(--lc-sun); }
.glyph-bar { fill: currentColor; stroke: none; opacity: .85; }
.is-active .glyph-sun { filter: drop-shadow(0 0 2px var(--lc-sun)); }
</style>
