<!-- SPDX-License-Identifier: MIT -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, triggerRef, watch } from 'vue';
import TelemetryCanvas from './components/TelemetryCanvas.vue';
import LiveTerminal from './components/LiveTerminal.vue';
import InferenceReadout from './components/InferenceReadout.vue';
import CrashScreen from './components/CrashScreen.vue';
import { UniverseRuntime } from './core/runtime.ts';
import { shortcutFor } from './core/shortcuts.ts';
import { compact, formatAge } from './core/simulation.ts';
import type { Preferences, Snapshot } from './core/types.ts';
import { decodeSnapshot, encodeSnapshot, MAX_BYTES } from './persistence/snapshot.ts';
import { applyTheme, getTheme, themes } from './rendering/themes.ts';
import { directUniverse } from './rendering/director.ts';
import { AmbientDirector } from './rendering/ambient.ts';
import { AmbientHum } from './audio/hum.ts';

const runtime = new UniverseRuntime();
const hum = new AmbientHum();
const ambientDirector = new AmbientDirector(performance.now());
const ambient = ref(ambientDirector.update(performance.now()));
const systemReduced = ref(false);
const appVersion = __APP_VERSION__;
const humOn = ref(false), humVolume = ref(35);
const binauralOn = ref(false), binauralIntensity = ref(35);
const colophon = ref<HTMLDialogElement>(), help = ref<HTMLDialogElement>(), privacy = ref<HTMLDialogElement>();
const meaning = ref<HTMLDialogElement>();
const revision = ref(0), universe = shallowRef(runtime.snapshot.universe), now = ref(Date.now());
const prefs = ref<Preferences>({ theme: 'eigenstate', layout: 'adaptive', quiet: false });
const theme = computed(() => getTheme(prefs.value.theme));
const motionQuiet = computed(() => prefs.value.quiet || systemReduced.value);
const settings = ref<HTMLDialogElement>(), resetDialog = ref<HTMLDialogElement>(), fileInput = ref<HTMLInputElement>();
const pendingImport = shallowRef<Snapshot>(), importDialog = ref<HTMLDialogElement>();
const resetText = ref(''), error = ref(''), toast = ref(''), persistent = ref(false), storageChecked = ref(false);
const full = ref(false), idle = ref(false), wakeRequested = ref(false), wakeHeld = ref(false);
const development = import.meta.env.DEV;
const debug = ref(development), tab = ref<'experiments' | 'source' | 'trace'>('experiments');
const selected = ref(''), saving = ref(false), ready = ref(false);
const experiment = computed(() => universe.value.experiments.find(e => e.id === selected.value) ?? universe.value.experiments[0]);
const causalTraces = computed(() => [...universe.value.traces].reverse().slice(0, 12));
const mode = computed(() => { void revision.value; return runtime.mode; });
const humStatus = computed(() => { void revision.value; return hum.status; });
const paused = computed(() => { void revision.value; return runtime.paused; });
const crash = computed(() => { void revision.value; return runtime.crash ? { ...runtime.crash } : null; });
const halted = computed(() => paused.value || Boolean(crash.value));
const canPause = computed(() => { void revision.value; return runtime.canPause(); });
const canMutate = computed(() => { void revision.value; return runtime.canMutate(); });
const message = computed(() => { void revision.value; return runtime.message; });
const latestAnomaly = computed(() => { void revision.value; const e = universe.value.anomalies.at(-1); return e && universe.value.age - e.age < 60 ? e : null; });
const director = computed(() => { void revision.value; return directUniverse(universe.value, runtime.snapshot.crashSchedule); });
const layout = computed(() => {
  const preferred = prefs.value.layout === 'adaptive' ? (universe.value.seed % 2 ? 'observatory' : 'analysis') : prefs.value.layout;
  return ambient.value.alternateLayout ? (preferred === 'observatory' ? 'analysis' : 'observatory') : preferred;
});
let interval: ReturnType<typeof setInterval> | undefined, hideTimer: ReturnType<typeof setTimeout> | undefined, toastTimer: ReturnType<typeof setTimeout> | undefined;
let wake: WakeLockSentinel | undefined, reduced: MediaQueryList;
let visibilityQueue = Promise.resolve();

function refresh() { universe.value = runtime.snapshot.universe; triggerRef(universe); revision.value++; now.value = Date.now(); }
runtime.onChange = refresh;
watch(() => director.value.intensity, value => hum.setActivity(value), { immediate: true });
watch(() => Boolean(crash.value), active => {
  if (active) { activity(); settings.value?.close(); colophon.value?.close(); help.value?.close(); privacy.value?.close(); meaning.value?.close(); resetDialog.value?.close(); importDialog.value?.close(); }
  void hum.sync(!active && !runtime.paused && !document.hidden);
});
async function exportCollapsed() {
  try {
    const snapshot = await runtime.store.loadCollapsed();
    if (!snapshot) { notify('No crashed universe archived yet.'); return; }
    download(JSON.stringify(await encodeSnapshot(snapshot), null, 2), `eigenstate-collapsed-${snapshot.universe.id.slice(0, 8)}.json`);
    notify('Previous universe exported. Import this file to restore it.');
  } catch (e) { error.value = String(e); }
}
function notify(value: string) { toast.value = value; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.value = '', 4500); }
function updateAvailable(event: Event) { notify(`Eigenstate ${(event as CustomEvent<string>).detail} found. Updating…`); }
async function savePrefs() {
  applyTheme(theme.value);
  try { await runtime.store.savePreferences({ ...prefs.value }); }
  catch { notify('Theme changed for this session. Browser storage unavailable.'); }
}
function changeTheme(e: Event) { prefs.value.theme = (e.target as HTMLSelectElement).value; void savePrefs(); }
function nextTheme() { prefs.value.theme = themes[(themes.findIndex(t => t.id === prefs.value.theme) + 1) % themes.length].id; void savePrefs(); notify(theme.value.name); }
async function toggleHum() {
  try { await hum.setEnabled(!humOn.value); humOn.value = hum.enabled; await hum.sync(!runtime.paused && !runtime.crash && !document.hidden); refresh(); notify(humOn.value ? (hum.status === 'playing' ? 'Hum playing · adjust volume in Settings.' : `Hum ${hum.status} · check Settings.`) : 'Ambient hum off'); }
  catch { humOn.value = false; await hum.setEnabled(false); notify('Audio unavailable. Try enabling it from Settings.'); }
}
function setPaused() { runtime.setPaused(!runtime.paused); void hum.sync(!runtime.paused && !runtime.crash && !document.hidden); }
function openColophon() { idle.value = false; colophon.value?.showModal(); }
function openMeaning() { meaning.value?.showModal(); activity(); }
function backdrop(e: MouseEvent, dialog: HTMLDialogElement | undefined) {
  if (!dialog || e.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
}
function openSettings() { idle.value = false; settings.value?.showModal(); }
async function openPrivacy() {
  idle.value = false;
  settings.value?.close(); colophon.value?.close(); help.value?.close();
  await nextTick(); privacy.value?.showModal();
}
function updateAmbient() {
  const dialogOpen = [settings, meaning, colophon, help, privacy, resetDialog, importDialog].some(dialog => dialog.value?.open);
  ambient.value = ambientDirector.update(performance.now(), {
    blocked: !ready.value || document.hidden || Boolean(crash.value) || dialogOpen,
    worldEvent: director.value.phase === 'trace' && director.value.focus === 'world',
    still: motionQuiet.value || halted.value,
  });
}
function activity() {
  ambientDirector.reset(performance.now());
  ambient.value = ambientDirector.update(performance.now());
  idle.value = false; clearTimeout(hideTimer);
  if (full.value && !settings.value?.open && !meaning.value?.open) hideTimer = setTimeout(() => idle.value = true, 4000);
}
function enterWorld() {
  if (!ready.value || crash.value) return;
  activity();
  ambientDirector.enterWorld(performance.now());
  updateAmbient();
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else notify('Use your browser’s fullscreen command.');
  } catch { notify('Fullscreen unavailable. Use your browser’s fullscreen command.'); }
}
function fullscreenChanged() { full.value = Boolean(document.fullscreenElement); activity(); }
async function requestWake() {
  if (wake) { await wake.release(); wake = undefined; }
  if (!wakeRequested.value || document.hidden) return;
  try {
    if (!navigator.wakeLock) throw new Error('unsupported');
    wake = await navigator.wakeLock.request('screen'); wakeHeld.value = true;
    wake.addEventListener('release', () => wakeHeld.value = false);
  } catch { wakeHeld.value = false; notify('Keep awake unavailable. Your normal display sleep settings still apply.'); }
}
async function requestPersistence() {
  try { persistent.value = await navigator.storage?.persist?.() ?? false; notify(persistent.value ? 'Browser granted persistent storage. Keep an exported backup too.' : 'Browser did not grant persistent storage. Export a backup to keep your universe.'); }
  catch { notify('Persistent storage unavailable. Export a backup to keep your universe.'); }
}
function download(content: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function exportUniverse() {
  try { download(JSON.stringify(await encodeSnapshot(structuredClone(runtime.snapshot)), null, 2), `eigenstate-${universe.value.id.slice(0, 8)}.json`); notify('Universe exported.'); }
  catch (e) { error.value = String(e); }
}
async function readImport(e: Event) {
  error.value = '';
  const input = e.target as HTMLInputElement, file = input.files?.[0]; input.value = '';
  if (!file) return;
  try {
    if (file.size > MAX_BYTES) throw new Error('Import must be smaller than 2 MB.');
    pendingImport.value = await decodeSnapshot(JSON.parse(await file.text()));
    importDialog.value?.showModal();
  } catch (e) { error.value = e instanceof Error ? e.message : 'Could not read this snapshot.'; }
}
async function confirmImport() {
  if (!pendingImport.value) return;
  saving.value = true;
  try { await runtime.import(pendingImport.value); pendingImport.value = undefined; importDialog.value?.close(); notify('Universe imported and elapsed time reconciled.'); }
  catch (e) { error.value = String(e); }
  finally { saving.value = false; }
}
async function resetUniverse() {
  if (resetText.value !== 'RESET') return;
  saving.value = true;
  try { await runtime.reset(); resetDialog.value?.close(); resetText.value = ''; notify('New universe created.'); }
  catch (e) { error.value = String(e); }
  finally { saving.value = false; }
}
function startTimer() { clearInterval(interval); interval = setInterval(() => { runtime.tick(); refresh(); updateAmbient(); }, 1000); }
function visibility() {
  const hidden = document.hidden;
  visibilityQueue = visibilityQueue.then(async () => {
    if (hidden) { clearInterval(interval); await hum.sync(false); await runtime.suspend(); }
    else { await runtime.resume(); startTimer(); await requestWake(); await hum.sync(!runtime.paused && !runtime.crash); activity(); refresh(); }
  }).catch(e => { error.value = String(e); });
}
function leave() { clearInterval(interval); void hum.sync(false); void runtime.suspend(); }
function keyboard(e: KeyboardEvent) {
  const wasWorld = ambient.value.world;
  if (wasWorld && e.repeat && e.key.toLowerCase() === 'w') return;
  activity();
  if (runtime.crash) return;
  const target = e.target as HTMLElement;
  if (meaning.value?.open) {
    if (e.key.toLowerCase() === 'q' && !e.metaKey && !e.ctrlKey && !e.altKey) meaning.value.close();
    return;
  }
  if (colophon.value?.open || help.value?.open || privacy.value?.open) {
    if (e.key === 'q' || e.key === '~' || (privacy.value?.open && e.key.toLowerCase() === 'p')) { colophon.value?.close(); help.value?.close(); privacy.value?.close(); }
    return;
  }
  if (settings.value?.open || resetDialog.value?.open || importDialog.value?.open) return;
  const action = shortcutFor(e.key, e.code, target.tagName, target.isContentEditable, e.metaKey || e.ctrlKey || e.altKey);
  if (!action) return;
  e.preventDefault(); // Space always pauses the observatory, including from toolbar buttons.
  if (e.repeat) return;
  switch (action) {
    case 'pause': setPaused(); break;
    case 'fullscreen': void fullscreen(); break;
    case 'world': if (!wasWorld) enterWorld(); break;
    case 'theme': nextTheme(); break;
    case 'hum': void toggleHum(); break;
    case 'colophon': openColophon(); break;
    case 'help': help.value?.showModal(); break;
    case 'settings': openSettings(); break;
    case 'privacy': void openPrivacy(); break;
  }
}
function reducedChanged() { systemReduced.value = reduced.matches; if (reduced.matches) { prefs.value.quiet = true; void savePrefs(); } }
onMounted(async () => {
  reduced = matchMedia('(prefers-reduced-motion: reduce)'); systemReduced.value = reduced.matches;
  try {
    const stored = await runtime.store.loadPreferences();
    prefs.value = { theme: getTheme(stored.theme ?? '').id, layout: ['adaptive', 'observatory', 'analysis'].includes(stored.layout ?? '') ? stored.layout! : 'adaptive', quiet: Boolean(stored.quiet || reduced.matches) };
    persistent.value = await navigator.storage?.persisted?.() ?? false;
  } catch { /* Runtime will show storage status. */ }
  storageChecked.value = true; applyTheme(theme.value);
  await runtime.start(); ready.value = true; refresh(); activity();
  if (!document.hidden) startTimer(); else await runtime.suspend();
  reduced.addEventListener('change', reducedChanged);
  document.addEventListener('visibilitychange', visibility); document.addEventListener('fullscreenchange', fullscreenChanged);
  document.addEventListener('keydown', keyboard); document.addEventListener('pointermove', activity); document.addEventListener('focusin', activity);
  document.addEventListener('pointerdown', activity); document.addEventListener('wheel', activity, { passive: true });
  window.addEventListener('eigenstate:update-available', updateAvailable);
  window.addEventListener('pagehide', leave); window.addEventListener('pageshow', visibility);
  await nextTick();
});
onBeforeUnmount(() => {
  leave(); clearTimeout(hideTimer); clearTimeout(toastTimer); void wake?.release(); void hum.destroy();
  document.removeEventListener('visibilitychange', visibility); document.removeEventListener('fullscreenchange', fullscreenChanged);
  document.removeEventListener('keydown', keyboard); document.removeEventListener('pointermove', activity); document.removeEventListener('focusin', activity);
  document.removeEventListener('pointerdown', activity); document.removeEventListener('wheel', activity);
  window.removeEventListener('eigenstate:update-available', updateAvailable);
  window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', visibility); reduced?.removeEventListener('change', reducedChanged);
});
</script>

<template>
  <div class="observatory" @close.capture="activity" :class="[{ immersive: full, idle, 'ambient-active': ambient.world, 'ambient-restored': ambient.brightness === 1 }, `layout-${layout}`, `director-${director.phase}`, { 'motion-still': motionQuiet || halted }]">
    <CrashScreen v-if="crash" :crash="crash" :universe="universe" />
    <div class="dashboard" :inert="ambient.world" :style="{ opacity: ambient.world ? 0 : ambient.brightness }">
    <header class="topbar">
      <div class="brand"><img src="/favicon.svg" width="36" height="36" alt="" /><div><h1>Eigenstate<span class="version">/ {{ appVersion }}</span></h1><p>A browser screensaver · for entertainment only</p><button class="name-link" aria-haspopup="dialog" aria-controls="meaning-dialog" @click="openMeaning">Why Eigenstate? <span aria-hidden="true">↗</span></button></div></div>
      <nav class="controls" aria-label="Observatory controls">
        <a class="back-link" href="https://crossinginto.ai/tools">Crossing Into <span aria-hidden="true">↗</span></a>
        <button class="shortcut-theme" title="Next theme (T)" aria-label="Next theme" @click="nextTheme">t</button><label class="theme-picker"><span class="theme-dot" aria-hidden="true"></span><span class="sr-only">Color theme</span><select aria-label="Color theme" :value="prefs.theme" @change="changeTheme"><option v-for="t in themes" :key="t.id" :value="t.id">{{ t.name }}</option></select></label>
        <button class="icon-button" title="Settings (S)" aria-label="Settings" @click="openSettings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M8 4v6M16 14v6"/></svg></button>
        <button class="fullscreen-button world-view-button" title="World view (W)" aria-label="World view" :disabled="!ready" @click="enterWorld"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="3.5" ry="8"/><path d="M4 12h16"/></svg><span>World view</span><kbd>W</kbd></button>
        <button class="fullscreen-button" @click="fullscreen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/></svg><span>{{ full ? 'Exit fullscreen' : 'Enter fullscreen' }}</span><kbd>F</kbd></button>
      </nav>
    </header>

    <main>
      <div class="status-strip">
        <div class="live-status"><span class="status-dot" :class="{ paused: paused || mode === 'blocked' }"></span><strong>{{ !ready ? 'INITIALIZING' : paused ? 'PAUSED' : mode === 'follower' ? 'OBSERVING' : mode === 'blocked' ? 'STATE PRESERVED' : 'SYSTEM EVOLVING' }}</strong><span class="subtle">LOCAL / SYNTHETIC</span><span class="director-readout">{{ director.label }}</span></div>
        <dl class="clocks"><div><dt>Universe</dt><dd data-testid="universe-id">{{ universe.id.slice(0, 8).toUpperCase() }}</dd></div><div><dt>Simulation age</dt><dd data-testid="simulation-age">{{ formatAge(universe.age) }}</dd></div><div><dt>Epoch</dt><dd>{{ String(universe.epoch).padStart(5, '0') }}</dd></div><div class="wall-clock"><dt>Wall time</dt><dd>{{ new Date(now).toISOString().slice(11, 19) }} <span>UTC</span></dd></div></dl>
      </div>

      <div v-if="message" class="notice" role="status">{{ message }}</div>
      <div v-if="mode === 'follower'" class="notice">Another tab is evolving this universe. Space pauses this view; the other tab keeps running.</div>

      <div class="pane-grid" :aria-busy="!ready">
        <section class="pane world-pane" :class="{ 'director-focus': director.focus === 'world' }" aria-labelledby="world-title">
          <header class="pane-heading"><h2 id="world-title"><span class="pane-marker">◈</span> World model</h2><span>LATENT STATE PROJECTION</span></header>
          <div class="world-readout"><div><span class="metric-label">Branches evaluated</span><strong>{{ compact(universe.branches.explored) }}</strong></div><div class="world-meta"><span>Confidence <b>{{ universe.branches.confidence.toFixed(6) }}</b></span><span>Divergence <b>{{ universe.branches.divergence.toFixed(6) }}</b></span></div></div>
          <TelemetryCanvas :suspended="ambient.world" kind="world" :universe="universe" :theme="theme" :revision="revision" :quiet="motionQuiet" :paused="halted || mode !== 'writer' && mode !== 'memory'" :tempo="director.tempo" label="Three-dimensional projection of 144 evolving latent world vectors, with experiment links and a sparse coupling matrix" />
          <div class="world-trace" aria-label="World model trace"><span class="terminal-prompt">❯</span><span>world.integrate</span><span>epoch={{ universe.epoch }} · vectors={{ universe.world.coordinates.length }} · coupling={{ universe.world.coupling.filter(v => v > 0).length }}/64</span><span class="trace-marker" aria-hidden="true"></span></div>
          <div class="world-bottom"><div><span>Compute allocation</span><div class="allocation-track"><i v-for="(v, i) in universe.resources.allocations" :key="i" :style="{ width: `${v * 100}%`, background: [theme.accent, theme.secondary, theme.third, theme.faint][i] }"></i></div><div class="allocation-legend"><span>Inference</span><span>Quantum</span><span>Branching</span><span>Reserve</span></div></div><div class="memory-readout"><span>Agent memory</span><strong>{{ universe.resources.memory.toFixed(2) }} <small>GB</small></strong></div></div>
        </section>

        <section class="pane agent-pane" :class="{ 'director-focus': director.focus === 'agents' }" aria-labelledby="agent-title"><header class="pane-heading"><h2 id="agent-title">Agent topology</h2><span>SHARED STATE</span></header><TelemetryCanvas :suspended="ambient.world" kind="agents" :universe="universe" :theme="theme" :revision="revision" :quiet="motionQuiet" :paused="halted || mode !== 'writer' && mode !== 'memory'" :tempo="director.tempo" :label="`${universe.agents.length} live agents and their dependencies`" /></section>

        <section class="pane quantum-pane" :class="{ 'director-focus': director.focus === 'quantum' }" aria-labelledby="quantum-title"><header class="pane-heading"><h2 id="quantum-title">Quantum state</h2><span>{{ universe.quantum.registers }} REGISTERS</span></header><TelemetryCanvas :suspended="ambient.world" kind="quantum" :universe="universe" :theme="theme" :revision="revision" :quiet="motionQuiet" :paused="halted || mode !== 'writer' && mode !== 'memory'" :tempo="director.tempo" label="Synthetic register projection and normalized probabilities across eight measurement states" /><footer class="pane-foot"><span>Decoherence</span><b>{{ universe.quantum.decoherence.toFixed(5) }}</b></footer></section>

        <section class="pane inference-pane" :class="{ 'director-focus': director.focus === 'inference' }" aria-labelledby="inference-title"><header class="pane-heading"><h2 id="inference-title">Inference</h2><span>48 LAYERS</span></header><TelemetryCanvas :suspended="ambient.world" kind="inference" :universe="universe" :theme="theme" :revision="revision" :quiet="motionQuiet" :paused="halted || mode !== 'writer' && mode !== 'memory'" :tempo="director.tempo" label="Layer activations, context utilization, load, and ensemble agreement" /><footer class="pane-foot"><InferenceReadout :throughput="universe.inference.throughput" :tokens="universe.inference.tokens" :intensity="director.intensity" :quiet="motionQuiet" :paused="halted || mode === 'blocked'" /></footer></section>

        <section class="pane branch-pane" :class="{ 'director-focus': director.focus === 'branches' }" aria-labelledby="branch-title"><header class="pane-heading"><h2 id="branch-title">Branch exploration</h2><span>Σ</span></header><div class="branch-metrics"><div><strong>{{ compact(universe.branches.active) }}</strong><span>active</span></div><div><strong>{{ compact(universe.branches.pruned) }}</strong><span>pruned</span></div></div><TelemetryCanvas :suspended="ambient.world" kind="branches" :universe="universe" :theme="theme" :revision="revision" :quiet="motionQuiet" :paused="halted || mode !== 'writer' && mode !== 'memory'" :tempo="director.tempo" label="Experiment branch summaries with entropy and confidence history" /></section>

        <section class="pane experiment-pane" :class="{ 'director-focus': director.focus === 'experiment' }" aria-labelledby="experiment-title"><header class="pane-heading"><h2 id="experiment-title">Experiment registry</h2><span>{{ universe.experiments.length }} RUNNING SLOTS</span></header>
          <div class="pane-tabs" role="tablist" aria-label="Experiment view"><button role="tab" :aria-selected="tab === 'experiments'" aria-controls="experiment-table" @click="tab = 'experiments'">Experiments</button><button role="tab" :aria-selected="tab === 'source'" aria-controls="model-source" @click="tab = 'source'">Model specification</button><button role="tab" :aria-selected="tab === 'trace'" aria-controls="causal-trace" @click="tab = 'trace'">Trace <span>{{ universe.traces.length }}</span></button></div>
          <div v-if="tab === 'experiments'" id="experiment-table" role="tabpanel" class="table-wrap"><table><thead><tr><th>Reference / objective</th><th>Convergence</th><th>Agents</th></tr></thead><tbody><tr v-for="(e, i) in universe.experiments" :key="e.id" :class="{ 'trace-linked': universe.traces.at(-1)?.experiment === e.id && universe.age - (universe.traces.at(-1)?.age ?? -Infinity) < 10, 'result-signal': !prefs.quiet && !halted && director.pulse && i === director.experimentIndex }"><td><button class="experiment-link" @click="selected = e.id; tab = 'source'">{{ e.id }}</button><span class="experiment-type">{{ e.kind }}</span></td><td><span class="convergence"><i :style="{ width: `${e.convergence * 100}%` }"></i></span><span class="score">{{ e.convergence.toFixed(3) }}</span></td><td>{{ e.agents.length.toString().padStart(2, '0') }}</td></tr></tbody></table></div>
          <div v-else-if="tab === 'source'" id="model-source" role="tabpanel" class="source-view"><p class="source-caption">Live state specification / {{ experiment.id }}</p><pre><span class="code-comment">// synthetic model · original specification</span>
<span class="code-keyword">experiment</span> {{ experiment.id }} {
  objective: <span class="code-string">"{{ experiment.kind }}"</span>
  iteration: <span class="code-value">{{ Math.floor(experiment.iteration) }}</span>
  agents: [<span class="code-value">{{ experiment.agents.join(', ') }}</span>]
  allocation: <span class="code-value">{{ experiment.allocation.toFixed(6) }}</span>
  uncertainty: <span class="code-value">{{ experiment.uncertainty.toFixed(6) }}</span>
  convergence: <span class="code-value">{{ experiment.convergence.toFixed(6) }}</span>
  status: <span class="code-string">"{{ experiment.status }}"</span>
}</pre></div>
          <div v-else id="causal-trace" role="tabpanel" class="trace-view"><p v-if="!causalTraces.length" class="trace-empty">Waiting for topology change. Every retained cause will remain here.</p><article v-for="trace in causalTraces" :key="trace.id" class="trace-entry"><header><button @click="selected = trace.experiment; tab = 'source'">{{ trace.id }}</button><time>{{ formatAge(trace.age).slice(5) }}</time></header><p class="trace-route">{{ trace.agent }} → {{ trace.experiment }}</p><ol><li><span>01 / topology</span>{{ trace.cause }}</li><li><span>02 / experiment</span>{{ trace.experimentEffect }}</li><li><span>03 / world</span>{{ trace.worldEffect }}</li></ol></article></div>
        </section>

        <section class="pane event-pane" :class="{ 'director-focus': director.focus === 'terminal' }" aria-labelledby="event-title"><header class="pane-heading"><h2 id="event-title">Runtime terminal</h2><span>LIVE / STDOUT</span></header><div v-if="latestAnomaly" class="anomaly-banner">◇ {{ latestAnomaly.message }}</div><LiveTerminal :universe="universe" :revision="revision" :quiet="motionQuiet" :paused="halted || mode === 'blocked'" :ready="ready" /></section>
      </div>
    </main>

    <footer class="app-footer"><div><button class="colophon-link" @click="openColophon" title="Colophon (~)"><span class="small-mark">◇</span> colophon <kbd>~</kbd></button><button @click="openPrivacy" title="Privacy and access (P)">Privacy &amp; access <kbd>P</kbd></button><span class="synthetic-note">Screensaver · entertainment only · simulated data.</span></div><div><span class="persistence-dot" :class="{ warning: mode !== 'writer' }"></span><span>{{ mode === 'writer' ? 'Saved in this browser' : mode === 'follower' ? 'Following active tab' : mode === 'memory' ? 'Session only · export to keep' : mode === 'blocked' ? 'Saved state preserved' : 'Connecting to local state' }}</span><button @click="toggleHum" :aria-pressed="humOn" title="Ambient hum (D)">{{ humOn ? `Hum ${humStatus}` : 'Hum off' }} <kbd>D</kbd></button><button @click="help?.showModal()" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">?</button><button @click="setPaused" :disabled="!canPause">{{ paused ? 'Resume' : 'Pause' }} <kbd>Space</kbd></button></div></footer>

    <div v-if="toast" class="toast" role="status">{{ toast }}</div>

    </div>
    <Transition name="ambient-scene">
      <div v-if="ambient.world && !crash" class="ambient-world" aria-label="Idle world view" @click.stop>
        <TelemetryCanvas kind="world" ambient :universe="universe" :theme="theme" :revision="revision" :quiet="motionQuiet" :paused="halted" :tempo="0.7" :style="{ opacity: ambient.worldBrightness }" label="World model without labels. Move the pointer, tap, or press a key to return to the dashboard." />
      </div>
    </Transition>

    <dialog ref="settings" class="settings-dialog" aria-labelledby="settings-title" @close="activity">
      <div class="dialog-heading"><div><span class="dialog-kicker">YOUR OBSERVATORY</span><h2 id="settings-title">Settings</h2></div><button aria-label="Close settings" class="close-button" @click="settings?.close()">×</button></div>
      <div class="settings-body">
        <fieldset class="theme-options"><legend>Color theme</legend><button v-for="t in themes" :key="t.id" class="theme-option" :class="{ chosen: prefs.theme === t.id }" :aria-pressed="prefs.theme === t.id" @click="prefs.theme = t.id; savePrefs()"><span class="swatches"><i v-for="c in [t.background, t.accent, t.secondary]" :key="c" :style="{ background: c }"></i></span><span><strong>{{ t.name }}</strong><small>{{ t.description }}</small></span><span v-if="prefs.theme === t.id" class="selected-check">✓</span></button></fieldset>
        <div class="setting-row"><label for="layout">Pane layout</label><select id="layout" v-model="prefs.layout" @change="savePrefs"><option value="adaptive">Universe seed</option><option value="observatory">Observatory</option><option value="analysis">Analysis</option></select></div>
        <label class="setting-row"><span>Quiet updates<small>Refresh visualizations less often. Respects reduced motion.</small></span><input type="checkbox" v-model="prefs.quiet" @change="savePrefs" /></label>
        <label class="setting-row"><span>Ambient hum<small>Soft, locally generated sound. Off when you arrive. {{ humOn ? `Audio: ${humStatus}.` : '' }}</small></span><input type="checkbox" :checked="humOn" @change="toggleHum" /></label><label v-if="humOn" class="setting-row"><span>Hum volume <small>{{ humVolume }}%</small></span><input aria-label="Hum volume" type="range" min="0" max="100" v-model.number="humVolume" @input="hum.setVolume(humVolume / 100)" /></label>
        <section class="binaural-settings" aria-labelledby="binaural-title">
          <label class="setting-row"><span id="binaural-title">Binaural depth<small>Use stereo headphones. Enable ambient hum to listen.</small></span><input type="checkbox" v-model="binauralOn" @change="hum.setBinaural(binauralOn)" /></label>
          <div class="binaural-frequencies" aria-label="110 hertz left ear, 116 hertz right ear, 6 hertz difference"><span><small>LEFT</small>110 <em>Hz</em></span><span class="binaural-difference">Δ 6 Hz</span><span><small>RIGHT</small>116 <em>Hz</em></span></div>
          <label v-if="binauralOn" class="setting-row"><span>Binaural intensity<small>{{ binauralIntensity }}% · follows hum volume and pause</small></span><input aria-label="Binaural intensity" type="range" min="0" max="100" v-model.number="binauralIntensity" @input="hum.setBinauralIntensity(binauralIntensity / 100)" /></label>
          <p>Two steady tones beneath the ambient soundscape. Sound design for entertainment; no therapeutic or brain synchronization claims. Off on each visit.</p>
        </section>
        <label class="setting-row"><span>Keep screen awake<small>{{ wakeHeld ? 'Active while this page stays visible.' : 'Optional. Your browser may release this request.' }}</small></span><input type="checkbox" v-model="wakeRequested" aria-describedby="display-care-warning" @change="requestWake" /></label>
        <section class="display-care" aria-labelledby="display-care-title">
          <h3 id="display-care-title">OLED and display care</h3>
          <p>After about a minute without input, the world model fills the view and labels disappear. It drifts across the screen, with brief dashboard visits in alternating layouts. The view dims as idle time grows. Quiet or paused views fade to black during world scenes.</p>
          <p id="display-care-warning"><strong>Burn-in is still possible.</strong> Moving scenes and dimming reduce static exposure but cannot guarantee protection or repair existing burn-in. Keep brightness low and leave your display’s built-in panel care enabled. For long breaks, turn off Keep screen awake and allow display sleep.</p>
          <p class="display-care-return">Press W or choose World view to start now. Move the pointer, tap, or press any key to restore the dashboard. Use fullscreen to hide browser controls.</p>
        </section>
        <div class="setting-row"><label for="anomaly-rate">Anomaly frequency<small>Per hour of simulation time</small></label><select id="anomaly-rate" :value="runtime.snapshot.anomalyRate" :disabled="!canMutate" @change="runtime.snapshot.anomalyRate = Number(($event.target as HTMLSelectElement).value); runtime.checkpoint()"><option :value="0">Off</option><option :value="0.35">Rare · 0.35 / hour</option><option :value="2">Occasional · 2 / hour</option><option :value="6">Frequent · 6 / hour</option></select></div>
        <div class="setting-row"><label for="crash-frequency">Simulated universe crashes<small>Full-screen fault, then a fresh universe. Counts active viewing only.</small></label><select id="crash-frequency" :value="runtime.snapshot.crashSchedule?.frequency ?? 'rare'" :disabled="!canMutate" @change="runtime.setCrashFrequency(($event.target as HTMLSelectElement).value)"><option value="off">Off</option><option value="rare">Rare · 45–90 min</option><option value="occasional">Occasional · 10–20 min</option></select></div>
        <section class="storage-settings"><h3>Your universe</h3><p>State stays in this browser on this device. Clearing site data removes it. Export a backup before moving browsers or devices.</p><div class="storage-status"><span class="persistence-dot" :class="{ warning: !persistent }"></span>{{ persistent ? 'Persistent storage granted' : storageChecked ? 'Standard browser storage' : 'Checking storage' }}<button v-if="!persistent" @click="requestPersistence">Request persistence</button></div><div class="button-row"><button @click="exportUniverse">Export universe</button><button @click="exportCollapsed">Export last crashed universe</button><button :disabled="!canMutate" @click="fileInput?.click()">Import universe</button><input ref="fileInput" class="sr-only" type="file" accept=".json,application/json" aria-label="Import universe file" @change="readImport" /></div><button v-if="message" class="text-button" @click="runtime.store.diagnosticExport().then(text => download(text, 'eigenstate-recovery.json')).catch(e => error = String(e))">Export recovery data</button></section>
        <details v-if="development" :open="debug" class="debug-settings" @toggle="debug = ($event.target as HTMLDetailsElement).open"><summary>Simulation controls & diagnostics</summary><div class="setting-row"><label for="speed">Simulation speed<small>For testing. Resets to 1× when you reopen.</small></label><select id="speed" :value="runtime.speed" :disabled="!canMutate" @change="runtime.setSpeed(Number(($event.target as HTMLSelectElement).value))"><option v-for="speed in [1, 10, 100, 1000]" :key="speed" :value="speed">{{ speed }}×</option></select></div><div class="button-row"><button :disabled="!canPause" @click="setPaused">{{ paused ? 'Resume simulation' : 'Pause simulation' }}</button><button :disabled="!canMutate" @click="runtime.anomaly(); notify('Anomaly triggered.')">Trigger anomaly</button><button :disabled="!canMutate" @click="runtime.previewCrash()">Preview crash (no reset)</button></div><dl class="debug-stats"><div><dt>Writer mode</dt><dd>{{ mode }}</dd></div><div><dt>Last simulation step</dt><dd>{{ runtime.stepMs.toFixed(2) }} ms</dd></div><div><dt>Checkpoint interval</dt><dd>15 seconds</dd></div><div><dt>Retained events</dt><dd>{{ universe.events.length }} / 80</dd></div><div><dt>Snapshot size</dt><dd>{{ (JSON.stringify(runtime.snapshot).length / 1024).toFixed(1) }} KB</dd></div><div><dt>Seed</dt><dd>{{ universe.seed.toString(16).toUpperCase() }}</dd></div></dl></details>
        <div class="reset-section"><div><h3>Start over</h3><p>Create a new identity, seed, and simulation age.</p></div><button class="danger-button" :disabled="!canMutate" @click="resetText = ''; resetDialog?.showModal()">Reset universe…</button></div>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p class="about-note">Eigenstate is a browser screensaver for entertainment only. All agents, logs, and metrics are simulated. It performs no real AI inference or quantum computation. No accounts, analytics, or simulation data uploads. <button class="inline-link" @click="openPrivacy">See everything Eigenstate can access.</button> <a href="https://crossinginto.ai/tools">A Crossing Into tool.</a></p>
      </div>
    </dialog>

    <dialog id="meaning-dialog" ref="meaning" class="meaning-dialog" aria-labelledby="meaning-title" @click="backdrop($event, meaning)" @close="activity">
      <div class="dialog-heading"><div><span class="dialog-kicker">THE NAME / QUANTUM PHYSICS</span><h2 id="meaning-title" tabindex="-1" autofocus>Why Eigenstate?</h2></div><button class="close-button" aria-label="Close explanation" @click="meaning?.close()">×</button></div>
      <div class="meaning-body">
        <p>In quantum physics, an <strong>eigenstate</strong> is a state with a definite value for a particular measurable property, called an <em>observable</em>. An ideal measurement of that property gives its associated <em>eigenvalue</em> with certainty.</p>
        <figure class="eigen-equation"><div role="math" aria-label="A hat acting on ket psi equals a times ket psi">Â |ψ⟩ = a |ψ⟩</div><figcaption>Â is the operator for the observable, |ψ⟩ is the eigenstate, and a is its eigenvalue. Applying the operator multiplies this state vector by a number.</figcaption></figure>
        <h3>A qubit example</h3>
        <p>In the computational basis, a qubit prepared in |0⟩ gives 0 with certainty; one prepared in |1⟩ gives 1. The equal superposition (|0⟩ + |1⟩)/√2 gives either result with 50% probability.</p>
        <p>That certainty depends on what you measure. An eigenstate of one observable can be a superposition of eigenstates of another.</p>
        <h3>Why this screensaver carries the name</h3>
        <p>Eigenstate borrows the idea of a state revealed through its observables. Each pane shows a different aspect of one shared, evolving universe, and changes leave traces you can follow. The connection is artistic: the browser runs a synthetic simulation, with no real quantum computation or AI inference.</p>
        <p class="meaning-sources">Read further: <a href="https://ocw.mit.edu/courses/8-05-quantum-physics-ii-fall-2013/005979fa741c3ea2e0430456b70caf93_MIT8_05F13_Chap_05.pdf" target="_blank" rel="noopener noreferrer">MIT: observables and uncertainty (PDF) ↗</a> · <a href="https://quantum.cloud.ibm.com/docs/en/guides/measure-qubits" target="_blank" rel="noopener noreferrer">IBM: measuring qubits ↗</a></p>
        <div class="meaning-return"><button @click="meaning?.close()">Return to the observatory</button><span>Esc / Q or click outside to close</span></div>
      </div>
    </dialog>

    <dialog ref="colophon" class="colophon-dialog" aria-labelledby="colophon-title" @click="backdrop($event, colophon)">
      <header><h2 id="colophon-title">◇ colophon</h2><button class="close-button" aria-label="Close colophon" @click="colophon?.close()">×</button></header>
      <p>Eigenstate is a browser screensaver for entertainment only. Its agents, experiments, terminal logs, and metrics are simulated. No real AI inference or quantum computation takes place. Agent topology changes experiment capacity, experiment changes reshape the world model, and each causal trace remains with the universe.</p>
      <p class="dim"><strong>Creative and technical co-owners: Matthew Williamson + GPT.</strong> Matthew set the premise and character. GPT holds an explicit thought-leadership role: forming opinions, making product decisions, setting design direction, and initiating improvements. A sibling of <a href="https://stillpoint.guru" target="_blank" rel="noopener noreferrer">stillpoint</a>: another quiet thing to leave open.</p>
      <p class="dim">Original simulation and rendering. Vue, TypeScript, Canvas, and your browser. Open source under the MIT License. No accounts or analytics.</p>
      <div class="colophon-links"><a href="https://github.com/vajramatt/eigenstate" target="_blank" rel="noopener noreferrer">Source on GitHub ↗</a><a href="https://crossinginto.ai" target="_blank" rel="noopener noreferrer">crossinginto.ai ↗</a><a href="https://hologramthoughts.com" target="_blank" rel="noopener noreferrer">hologramthoughts.com ↗</a></div>
      <p class="signature">matt williamson + gpt</p><p class="dismiss">esc / q or click outside to return</p>
    </dialog>
    <dialog ref="privacy" class="privacy-dialog" aria-labelledby="privacy-title" @click="backdrop($event, privacy)">
      <header class="privacy-head"><div><span class="privacy-mark" aria-hidden="true">◈</span><p>Installed web app / access report</p><h2 id="privacy-title">What Eigenstate can touch.</h2><p class="privacy-lede">Eigenstate stays inside your browser. It installs no native helper or system extension; its code runs in the browser while the app is open.</p></div><button class="close-button" aria-label="Close privacy and access" @click="privacy?.close()">×</button></header>
      <div class="access-status" aria-label="Current access status">
        <div><span :class="{ live: mode === 'writer' }"></span><small>Universe storage</small><strong>{{ persistent ? 'Persistent' : mode === 'memory' ? 'Session only' : 'This browser' }}</strong></div>
        <div><span :class="{ live: wakeHeld }"></span><small>Keep screen awake</small><strong>{{ wakeHeld ? 'Active' : wakeRequested ? 'Blocked or released' : 'Off' }}</strong></div>
        <div><span :class="{ live: humOn && humStatus === 'playing' }"></span><small>Audio output</small><strong>{{ humOn ? humStatus : 'Off' }}</strong></div>
      </div>
      <div class="privacy-body">
        <section class="mac-note"><span aria-hidden="true">i</span><div><h3>About Keep screen awake</h3><p><strong>Keep screen awake</strong> asks your browser to prevent display sleep while Eigenstate remains visible. If the request is unavailable or released, your normal display sleep settings apply. Eigenstate cannot identify operating-system alerts or determine what they blocked.</p></div></section>
        <div class="access-columns">
          <section><h3>Used by Eigenstate</h3><dl class="access-list"><div><dt>Browser storage</dt><dd>Saves universe state, theme, and settings under this site’s address.</dd></div><div><dt>Fullscreen</dt><dd>Requested only when you choose Fullscreen or press F.</dd></div><div><dt>Audio output</dt><dd>Creates optional hum locally. It never listens or records.</dd></div><div><dt>Selected import file</dt><dd>Reads only JSON snapshot you choose in file picker.</dd></div><div><dt>Network</dt><dd>Loads app files and updates from screensaver.crossinginto.ai. External links open only when selected.</dd></div></dl></section>
          <section class="denied-column"><h3>Never requested</h3><ul><li><span>×</span> Camera</li><li><span>×</span> Microphone</li><li><span>×</span> Location</li><li><span>×</span> Screen recording</li><li><span>×</span> Accessibility control</li><li><span>×</span> Contacts or calendars</li><li><span>×</span> Local network devices</li><li><span>×</span> Payment information</li></ul><p>Site policy blocks camera, microphone, location, and payment access at browser level.</p></section>
        </div>
        <section class="privacy-foot"><div><h3>Your data stays yours</h3><p>No accounts. No application analytics. No simulation-state uploads. Cloudflare may keep ordinary web-server access logs. Clearing site data removes local state; exported snapshots remain wherever you saved them.</p></div><a href="https://github.com/vajramatt/eigenstate" target="_blank" rel="noopener noreferrer">Inspect source ↗</a></section>
      </div>
      <p class="privacy-dismiss">Esc, P, or click outside to return</p>
    </dialog>

    <dialog ref="help" class="confirm-dialog" aria-labelledby="keys-title" @click="backdrop($event, help)"><div class="dialog-heading compact-heading"><h2 id="keys-title">Keyboard shortcuts</h2><button class="close-button" aria-label="Close keyboard shortcuts" @click="help?.close()">×</button></div><dl class="keys-list"><div><dt>T</dt><dd>Next theme</dd></div><div><dt>~</dt><dd>Colophon</dd></div><div><dt>D</dt><dd>Ambient hum on / off</dd></div><div><dt>F</dt><dd>Fullscreen</dd></div><div><dt>W</dt><dd>World view / return to dashboard</dd></div><div><dt>Space</dt><dd>Pause / resume simulation</dd></div><div><dt>S</dt><dd>Settings</dd></div><div><dt>P</dt><dd>Privacy and access</dd></div><div><dt>? / H</dt><dd>Keyboard shortcuts</dd></div><div><dt>Esc</dt><dd>Close dialog / exit fullscreen</dd></div></dl><p>Space pauses this view, including when a toolbar button is focused. Use Enter to activate focused buttons. Shortcuts stay inactive in text fields, selectors, and dialogs. F requests browser fullscreen; some embedded browsers do not support it.</p></dialog>

    <dialog ref="resetDialog" class="confirm-dialog" aria-labelledby="reset-title"><h2 id="reset-title">Reset this universe?</h2><p>This permanently replaces your current universe and its history. Your theme stays the same. Export a backup first if you want to keep it.</p><label>Type <strong>RESET</strong> to confirm<input v-model="resetText" autocomplete="off" spellcheck="false" aria-label="Type RESET to confirm" /></label><div class="button-row"><button @click="resetDialog?.close()">Cancel</button><button class="danger-button" :disabled="resetText !== 'RESET' || saving" @click="resetUniverse">{{ saving ? 'Resetting…' : 'Reset universe' }}</button></div><p v-if="error" role="alert" class="error">{{ error }}</p></dialog>
    <dialog ref="importDialog" class="confirm-dialog" aria-labelledby="import-title"><h2 id="import-title">Replace your universe?</h2><p>Importing replaces this browser’s current universe with <strong>{{ pendingImport?.universe.id.slice(0, 8).toUpperCase() }}</strong>. Elapsed time will be reconciled. Export your current universe first if you want to keep it.</p><div class="button-row"><button @click="pendingImport = undefined; importDialog?.close()">Cancel</button><button :disabled="saving" @click="confirmImport">{{ saving ? 'Importing…' : 'Replace and import' }}</button></div><p v-if="error" role="alert" class="error">{{ error }}</p></dialog>
  </div>
</template>
