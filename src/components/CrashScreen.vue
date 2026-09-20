<!-- SPDX-License-Identifier: MIT -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { CrashSequence } from '../core/crashes.ts';
import type { Universe } from '../core/types.ts';
import { formatAge } from '../core/simulation.ts';

defineProps<{ crash: CrashSequence; universe: Universe }>();
const dialog = ref<HTMLDialogElement>();
onMounted(() => dialog.value?.showModal());
const faults = ['CAUSAL_GRAPH_DIVERGENCE', 'VACUUM_STATE_UNSTABLE', 'RECURSION_BOUNDARY_EXCEEDED'];
</script>

<template>
  <dialog ref="dialog" class="crash-screen" aria-labelledby="crash-title" aria-describedby="crash-description" @cancel.prevent>
    <div class="crash-report">
      <div class="crash-kicker">EIGENSTATE / SIMULATED SYSTEM FAULT</div>
      <div class="crash-rule"></div>
      <p class="crash-code">FATAL :: {{ faults[universe.seed % faults.length] }}</p>
      <h2 id="crash-title" tabindex="-1" autofocus>Universe halted.</h2>
      <p id="crash-description">{{ crash.preview ? 'Visual preview only. Your current universe will resume.' : 'This synthetic universe has become unstable. A new universe will begin shortly.' }}</p>
      <dl class="crash-registers">
        <div><dt>UNIVERSE</dt><dd>{{ universe.id.slice(0, 8).toUpperCase() }}</dd></div>
        <div><dt>LIFETIME</dt><dd>{{ formatAge(universe.age) }}</dd></div>
        <div><dt>LAST EPOCH</dt><dd>{{ String(universe.epoch).padStart(6, '0') }}</dd></div>
        <div><dt>STATE</dt><dd>EXECUTION SUSPENDED</dd></div>
      </dl>
      <div class="crash-log" aria-hidden="true">
        <p><span>[halt]</span> agent scheduler .......... stopped</p>
        <p :class="{ 'crash-pending': crash.remaining > 6 }"><span>[drain]</span> branch propagation ....... terminated</p>
        <p :class="{ 'crash-pending': crash.remaining > 4 }"><span>[hold]</span> {{ crash.preview ? 'current universe ......... retained' : 'final snapshot ........... queued for archive' }}</p>
        <p :class="{ 'crash-pending': crash.remaining > 2 }"><span>[boot]</span> {{ crash.preview ? 'preview complete ......... returning' : 'new seed ................. pending' }}</p>
      </div>
      <div class="crash-countdown"><span>{{ crash.preview ? 'RESUMING' : 'REINITIALIZING' }}</span><strong>{{ crash.remaining > 0 ? `${String(Math.ceil(crash.remaining)).padStart(2, '0')}s` : '…' }}</strong></div>
      <p class="crash-disclaimer">Fictional screensaver sequence. No browser or device error.<br />{{ crash.preview ? 'Preview does not reset or archive anything.' : 'Previous universe saved before restart. Export it from Settings.' }}</p>
    </div>
  </dialog>
</template>

<style scoped>
.crash-screen{inset:0;margin:0;width:100vw;height:100dvh;max-width:none;max-height:none;border:0;border-radius:0;background:var(--background);color:var(--text);font-family:"SFMono-Regular",Consolas,monospace;overflow:auto;cursor:default}
.crash-screen[open]{display:grid;place-items:center}.crash-screen::backdrop{background:var(--background)}
.crash-report{width:min(740px,100%);padding:clamp(24px,5vw,64px);box-sizing:border-box}.crash-kicker{font-size:10px;letter-spacing:2px;color:var(--muted)}.crash-rule{height:2px;background:var(--warning);margin:22px 0 30px}.crash-code{font-size:11px;color:var(--warning);overflow-wrap:anywhere}
h2{font-size:clamp(30px,5vw,54px);font-weight:400;letter-spacing:-2px;margin:12px 0 18px;outline:none}#crash-description{font-size:12px;line-height:1.8;color:var(--muted);max-width:520px}.crash-registers{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:30px 0}.crash-registers dt{color:var(--muted);font-size:9px;letter-spacing:1px;margin-bottom:7px}.crash-registers dd{font-size:12px;margin:0}.crash-log{border-block:1px solid var(--line);padding:18px 0;font-size:11px;line-height:2;overflow-wrap:anywhere}.crash-log p{margin:0}.crash-log span{color:var(--warning)}.crash-pending{visibility:hidden}.crash-countdown{display:flex;align-items:center;justify-content:space-between;margin:24px 0;color:var(--warning);font-size:11px;letter-spacing:2px}.crash-countdown strong{font-size:30px;font-weight:400;font-variant-numeric:tabular-nums}.crash-disclaimer{font-size:10px;line-height:1.8;color:var(--muted);margin:0}
@media(max-width:420px){.crash-log{font-size:9px}.crash-registers dd{font-size:10px}}
</style>
