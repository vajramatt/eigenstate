<!-- SPDX-License-Identifier: MIT -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import type { Postcard } from '../core/homecoming.ts';

// A short note from the universe when you return. It leaves on its own.
const props = defineProps<{ card: Postcard; name: string }>();
const emit = defineEmits<{ close: [] }>();
let timer: ReturnType<typeof setTimeout> | undefined;
onMounted(() => { timer = setTimeout(() => emit('close'), 14_000 + props.card.lines.length * 1_500); });
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <aside class="homecoming" role="status" aria-live="polite" aria-labelledby="homecoming-title">
    <svg class="homecoming-sprout" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 36V19"/><path d="M20 24c-6 0-10-4-10-10 6 0 10 4 10 10Z"/><path d="M20 19c0-6 4-10 10-10 0 6-4 10-10 10Z"/><circle cx="30" cy="9" r="1.6"/></svg>
    <div class="homecoming-body">
      <p class="homecoming-kicker">Welcome back · {{ card.greeting }}</p>
      <h2 id="homecoming-title"><em>{{ name }}</em> kept going for {{ card.away }}.</h2>
      <ul v-if="card.lines.length"><li v-for="(line, i) in card.lines" :key="line" :style="{ animationDelay: `${0.5 + i * 0.18}s` }">{{ line }}</li></ul>
      <p v-if="card.milestone" class="homecoming-milestone">◇ It turned {{ card.milestone }} while you were away.</p>
    </div>
    <button class="close-button" aria-label="Dismiss welcome note" @click="emit('close')">×</button>
  </aside>
</template>
