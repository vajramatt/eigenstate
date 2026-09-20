<!-- SPDX-License-Identifier: MIT -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { compact } from '../core/simulation.ts';

const props = defineProps<{ throughput: number; tokens: number; intensity: number; quiet: boolean; paused: boolean }>();
const shownRate = ref(props.throughput), shownTokens = ref(props.tokens);
let frame = 0, lastPaint = 0, anchorTime = performance.now(), anchorTokens = props.tokens;
const moving = () => !props.quiet && !props.paused && !document.hidden;
function syncAnchor() { anchorTime = performance.now(); anchorTokens = props.tokens; if (!moving()) { shownRate.value = props.throughput; shownTokens.value = props.tokens; } }
function loop(now: number) {
  frame = requestAnimationFrame(loop);
  if (!moving() || now - lastPaint < 100) return;
  lastPaint = now;
  const drift = (Math.sin(now / 730) + Math.sin(now / 2110) * 0.5) * 0.012 * props.intensity;
  const target = props.throughput * (1 + drift);
  shownRate.value += (target - shownRate.value) * 0.22;
  shownTokens.value = anchorTokens + Math.max(0, now - anchorTime) / 1000 * props.throughput;
}
function visibility() { syncAnchor(); }
watch(() => [props.throughput, props.tokens, props.quiet, props.paused], syncAnchor);
onMounted(() => { document.addEventListener('visibilitychange', visibility); frame = requestAnimationFrame(loop); });
onBeforeUnmount(() => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); });
</script>

<template>
  <div class="inference-readout" aria-live="off" :aria-label="`${Math.round(shownRate).toLocaleString('en-US')} tokens per second; ${Math.round(shownTokens).toLocaleString('en-US')} tokens processed`">
    <div><span>Token throughput</span><b>{{ compact(shownRate) }} / s</b></div>
    <small>{{ compact(shownTokens) }} tokens processed</small>
  </div>
</template>
