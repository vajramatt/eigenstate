<!-- SPDX-License-Identifier: MIT -->
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Universe } from '../core/types.ts';
import { formatAge } from '../core/simulation.ts';
import { eventLines, telemetryLine, type TerminalLine } from '../rendering/terminal.ts';
const props = defineProps<{ universe: Universe; revision: number; quiet: boolean; paused: boolean; ready: boolean }>();
const lines = ref<TerminalLine[]>([]), viewport = ref<HTMLElement>(), following = ref(true);
const typing = ref<{ id: string; count: number }>();
let identity = '', sequence = -1, lastAge = -Infinity, samples = 0;
let typingTimer: ReturnType<typeof setTimeout> | undefined;
let visible = true, intersection: IntersectionObserver | undefined;
function stopTyping() { clearTimeout(typingTimer); typingTimer = undefined; }
function animateTyping() {
  stopTyping();
  if (!typing.value || props.paused || document.hidden || !visible) return;
  if (props.quiet || !following.value) { typing.value = undefined; return; }
  const line = lines.value.find(entry => entry.id === typing.value?.id);
  if (!line) { typing.value = undefined; return; }
  // Short bursts and tiny hesitations, with no changes to the underlying record.
  typingTimer = setTimeout(() => {
    if (!typing.value) return;
    typing.value.count = Math.min(line.text.length, typing.value.count + 3 + typing.value.count % 4);
    if (typing.value.count >= line.text.length) typing.value = undefined;
    animateTyping();
  }, typing.value.count % 19 < 4 ? 75 : 30);
}
watch(() => [props.paused, props.quiet, following.value], animateTyping);
onMounted(() => {
  document.addEventListener('visibilitychange', animateTyping);
  intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; animateTyping(); });
  if (viewport.value) intersection.observe(viewport.value);
});
onBeforeUnmount(() => { stopTyping(); intersection?.disconnect(); document.removeEventListener('visibilitychange', animateTyping); });
function scroll() { const el = viewport.value; if (el) following.value = el.scrollHeight - el.scrollTop - el.clientHeight < 28; }
async function tail() { following.value = true; await nextTick(); if (viewport.value) viewport.value.scrollTop = viewport.value.scrollHeight; }
watch(() => props.revision, async () => {
  if (!props.ready || document.hidden) return;
  const u = props.universe;
  if (identity !== u.id) { stopTyping(); typing.value = undefined; samples = 0; identity = u.id; lines.value = eventLines(u, -1).slice(-6); sequence = u.sequence; lastAge = -Infinity; following.value = true; }
  if (props.paused || u.age === lastAge || (props.quiet && u.age - lastAge < 5)) return;
  const fresh = eventLines(u, sequence);
  const sample = telemetryLine(u);
  lines.value = [...lines.value, ...fresh, sample].slice(-80);
  if (++samples % 5 === 1 && !typing.value && !props.quiet && following.value && visible) {
    typing.value = { id: sample.id, count: 0 }; animateTyping();
  }
  sequence = u.sequence; lastAge = u.age;
  if (following.value) await tail();
}, { immediate: true });
</script>
<template>
  <div class="live-terminal" :class="{ 'terminal-still': quiet || paused }">
    <div class="terminal-session"><span class="terminal-prompt">❯</span><span>observe /{{ universe.id.slice(0, 8) }}/telemetry</span><span class="stream-state">{{ paused ? 'HELD' : 'FOLLOW' }}</span></div>
    <div ref="viewport" class="terminal-scroll" tabindex="0" role="region" aria-label="Live telemetry scrollback" aria-live="off" @scroll="scroll">
      <div v-for="entry in lines" :key="entry.id" class="terminal-line" :class="{ 'terminal-event': entry.event, 'terminal-anomaly': entry.channel === 'anomaly' }"><time>{{ formatAge(entry.age).slice(5) }}</time><span class="terminal-channel">{{ entry.channel }}</span><span class="terminal-text" :class="{ 'terminal-typing': typing?.id === entry.id }"><template v-if="typing?.id === entry.id"><span class="sr-only">{{ entry.text }}</span><span class="terminal-measure" aria-hidden="true">{{ entry.text }}</span><span class="terminal-typed" aria-hidden="true">{{ entry.text.slice(0, typing.count) }}<span class="typing-caret"></span></span></template><template v-else>{{ entry.text }}</template></span></div>
      <div class="terminal-cursor-row"><span class="terminal-prompt">❯</span><span class="terminal-cursor" aria-hidden="true"></span></div>
    </div>
    <footer class="terminal-status"><span>{{ lines.length }} / 80 lines · local telemetry</span><button v-if="!following" @click="tail">Resume following ↓</button><span v-else>{{ paused ? 'stream paused' : 'stream open' }}</span></footer>
  </div>
</template>
