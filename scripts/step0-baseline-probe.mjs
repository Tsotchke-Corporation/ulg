// Step 0 of the 2026-11-03 audit: is a preset's measured rate real physics?
// Runs the real app headed, presses Play, then records over one window:
//   - the unprofiled rate (lane steps per wall second, no timestamp writes);
//   - an API census per device (passes, dispatches, submits, writes, waits);
//   - with &observeSpatialAuthority=1, every per-step canonical G2P authority
//     trace the app reads back, so a fail-closed rollback becomes visible.
// The field route rolls a step back when the mechanics field view's header
// statusFlags carry FAIL_CLOSED | INVALID_SOURCE | CAPACITY_OVERFLOW at
// finalize (see g2p_p2g_authority_rejected in sphMlsMpmGpuStep.js).
//
//   node scripts/step0-baseline-probe.mjs [scenario] [tag] [extraQuery]
//
// The dev server must be running (npm run dev). S0_WINDOW_MS sets the window
// length, S0_UNTIL_SIM_S an earlier stop at a simulated time, S0_OUT_DIR the
// evidence directory, S0_BASE_URL the server.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_CAPACITY_OVERFLOW
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';

const scenario = process.argv[2] || 'iron-ice-quench';
const tag = process.argv[3] || scenario;
const extra = process.argv[4] || '';
const windowMs = Number(process.env.S0_WINDOW_MS || 120000);
const outDir = process.env.S0_OUT_DIR || join(homedir(), '.cache/icc/repos/ulg/step0-baseline-20261113');
const url = new URL(`pages.html?scenario=${scenario}&residentAuto=1${extra}`,
  process.env.S0_BASE_URL || 'https://127.0.0.1:5173/').href;
const started = new Date();
const evidence = { schema: 'ulg.step0-baseline-probe.v1', started: started.toISOString(), url, windowMs,
  samples: [], workers: [], errors: [], console: [] };

// Installed in the page and every worker. Census only: it never adds GPU work.
// S0_PROPOSAL_AUDIT=1 is the one exception: it copies each canonical thermal
// proposal header into a readback ring.
const hookOptions = { tickPump: process.env.S0_TICK_PUMP === '1', submitNudge: process.env.S0_SUBMIT_NUDGE || '', proposalAudit: process.env.S0_PROPOSAL_AUDIT === '1', stateAtApply: Number(process.env.S0_STATE_AT_APPLY || 0),
  dumpPhaseZero: process.env.S0_DUMP_PHASE_ZERO === '1',
  disableParcelStage: process.env.S0_DISABLE_PARCEL_STAGE === '1',
  disableParcelOptics: process.env.S0_DISABLE_PARCEL_OPTICS === '1',
  // S0_DISABLE_SOLID_LANE=coupling (A5 heat + contact off) or =all (no rigid lane step).
  disableSolidLane: process.env.S0_DISABLE_SOLID_LANE || '',
  // Light audit: proposal header, evidence, derived header and receipt only.
  proposalLight: process.env.S0_PROPOSAL_LIGHT === '1',
  proposalMinimal: process.env.S0_PROPOSAL_MINIMAL === '1',
  // Contact audit: like the light audit, plus the graph pass's traversal
  // evidence, spatial-directory header and aggregate-view header in place of
  // the cleanup control (which DIRECTORY_REJECT site fired, and why).
  contactAudit: process.env.S0_CONTACT_AUDIT === '1',
  // Tag every g2p_spatial_reject(17u) site in compiled shaders with its own
  // field-view status bit (20 + k); G.g2pRejectSites names them.
  g2pRejectTag: process.env.S0_G2P_REJECT_TAG === '1',
  p2gRejectTag: process.env.S0_P2G_REJECT_TAG === '1',
  p2gTagStart: Number(process.env.S0_P2G_TAG_START || 0),
  ringSkipApplies: Number(process.env.S0_RING_SKIP_APPLIES || 0),
  countFromStart: process.env.S0_COUNT_FROM_START === '1',
  workspaceTimeline: process.env.S0_WORKSPACE_TIMELINE === '1',
  attributionEnabled: process.env.S0_ATTRIBUTION === '1',
  timelineEnabled: process.env.S0_TIMELINE === '1',
  passTimingEnabled: process.env.S0_PASS_TIMING === '1',
  // Per-step trace of chosen rows at each thermal apply input: state (8 floats)
  // and thermo (12 floats), e.g. S0_TRACE_ROWS=1022,1023.
  traceRows: (process.env.S0_TRACE_ROWS || '').split(',').filter(Boolean).map(Number).slice(0, 4),
  // With S0_TRACE_ROWS: at these thermal-apply slots, copy the first traced
  // row out of every state/thermo-sized buffer bound to each compute pass, at
  // pass end (S0_PASS_TRACE_SLOTS=59,60,61; S0_PASS_TRACE_ROWS=1464 rows).
  passTraceSlots: (process.env.S0_PASS_TRACE_SLOTS || '').split(',').filter(Boolean).map(Number),
  passTraceRows: Number(process.env.S0_PASS_TRACE_ROWS || 0) };
const hook = (options = {}) => {
  if (globalThis.__s0) return;
  if (options.disableParcelStage) globalThis.__ulgDisableLedgerParcelStage = true;
  if (options.disableParcelOptics) globalThis.__ulgDisableLedgerParcelOptics = true;
  if (options.disableSolidLane) globalThis.__ulgDisableSolidLane = options.disableSolidLane;
  const G = globalThis.__s0 = { devices: [], traces: [], traceDrops: 0, traceLimit: 6000, ledgerLabels: {},
    ledgerLatest: {}, ledgerCold: {}, proposalAudit: Boolean(options.proposalAudit), stateAtApply: options.stateAtApply || 0,
    dumpPhaseZero: Boolean(options.dumpPhaseZero), proposalLight: Boolean(options.proposalLight),
    proposalMinimal: Boolean(options.proposalMinimal), contactAudit: Boolean(options.contactAudit), g2pRejectTag: Boolean(options.g2pRejectTag), p2gRejectTag: Boolean(options.p2gRejectTag), p2gTagStart: options.p2gTagStart || 0, ringSkipApplies: options.ringSkipApplies || 0, traceRows: options.traceRows || [],
    passTraceSlots: options.passTraceSlots || [], passTraceRows: options.passTraceRows || 0, passTrace: [],
    attributionEnabled: Boolean(options.attributionEnabled), timelineEnabled: Boolean(options.timelineEnabled),
    passTimingEnabled: Boolean(options.passTimingEnabled) };
  G.readSubmitTimeline = () => G.submitTimeline ?? null;
  const encDev = new WeakMap(), passDev = new WeakMap(), queueDev = new WeakMap(), traceBuffers = new WeakMap();
  const fresh = () => ({ encoders: 0, computePasses: 0, renderPasses: 0, dispatch: 0, dispatchIndirect: 0,
    submits: 0, commandBuffers: 0, writeBuffer: 0, writeBytes: 0, mapAsync: 0, workDone: 0, createBuffer: 0,
    pipelines: 0, bindGroups: 0, setBindGroup: 0, copies: 0 });
  const entryFor = device => {
    let e = G.devices.find(x => x.device === device);
    if (!e) {
      e = { device, c: fresh() };
      G.devices.push(e); queueDev.set(device.queue, e);
      // S0_TICK_PUMP=1: keep one onSubmittedWorkDone pending per device (no GPU
      // work), to test whether completion latency comes from idle device ticks.
      if (options.tickPump) {
        const pump = () => { if (e.lost) return; device.queue.onSubmittedWorkDone().then(pump, () => {}); };
        pump();
      }
      device.lost.then(info => { e.lost = `${info.reason}: ${info.message}`; });
      // Uncaptured validation errors (an invalid command buffer is otherwise silent).
      device.addEventListener?.('uncapturederror', event => {
        G.gpuErrors ??= [];
        if (G.gpuErrors.length < 20) G.gpuErrors.push(String(event?.error?.message ?? event).slice(0, 400));
      });
    }
    return e;
  };
  // Errors the app itself pops from its own scopes are invisible to the
  // uncapturederror listener; record those too (prefixed "scoped:").
  if (typeof GPUDevice !== 'undefined' && !GPUDevice.prototype.__s0ScopeWrapped) {
    GPUDevice.prototype.__s0ScopeWrapped = true;
    const realPop = GPUDevice.prototype.popErrorScope;
    GPUDevice.prototype.popErrorScope = function () {
      return Reflect.apply(realPop, this, []).then((error) => {
        if (error) { G.gpuErrors ??= []; if (G.gpuErrors.length < 20) G.gpuErrors.push(`scoped: ${String(error?.message ?? error).slice(0, 400)}`); }
        return error;
      });
    };
  }
  const wrap = (proto, name, fn) => {
    const original = proto[name];
    if (!original || original.__s0) return;
    const wrapped = function (...args) { return fn.call(this, original, args); };
    wrapped.__s0 = true; proto[name] = wrapped;
  };
  wrap(GPUDevice.prototype, 'createCommandEncoder', function (o, a) {
    const e = entryFor(this); e.c.encoders++;
    const encoder = Reflect.apply(o, this, a); encDev.set(encoder, e); return encoder;
  });
  // Host-overhead attribution: who creates buffers, waits on the queue, and
  // maps buffers, per counted window (labels and the first app call site).
  const callSite = () => {
    const lines = String(new Error().stack || '').split('\n').slice(3);
    const frame = lines.find(line => !/step0-baseline-probe|__s0|wrapped/.test(line)) || '';
    return frame.replace(/^\s*at\s+/, '').replace(/https?:\/\/[^/]+/, '').slice(0, 140);
  };
  const tally = (bucket, key) => { if (!G.counting) return; const t = (G.attribution ??= {}); (t[bucket] ??= {})[key] = (t[bucket][key] ?? 0) + 1; };
  G.readAttribution = () => {
    const top = (bucket, n) => Object.entries(G.attribution?.[bucket] ?? {}).sort((a, b) => b[1] - a[1]).slice(0, n);
    return G.attribution ? { indirect: top('indirect', 30), createBuffer: top('createBuffer', 25), bindGroup: top('bindGroup', 30), writeBuffer: top('writeBuffer', 20), workDone: top('workDone', 12), mapAsync: top('mapAsync', 12), submit: top('submit', 20) } : null;
  };
  if (G.g2pRejectTag || G.p2gRejectTag) wrap(GPUDevice.prototype, 'createShaderModule', function (o, a) {
    const code = a[0]?.code;
    if (G.g2pRejectTag && typeof code === 'string' && code.includes('g2p_spatial_reject(17u);') && code.includes('fn g2p_spatial_reject(')) {
      G.g2pRejectSites ??= [];
      const module = G.g2pRejectSites.length;
      const sites = [];
      let k = 0;
      const tagged = code.replace(/g2p_spatial_reject\(17u\);/g, (match, offset) => {
        const before = code.slice(Math.max(0, offset - 220), offset).split('\n').slice(-4).map(l => l.trim()).join(' | ');
        const bit = 20 + (k % 12);
        sites.push({ k, bit, before });
        k += 1;
        // First wave only: tag while the status is still clean (no FAIL_CLOSED).
        return `if ((atomicLoad(&mechanics_field_view[2u]) & 4u) == 0u) { atomicOr(&mechanics_field_view[2u], ${(1 << bit) >>> 0}u); } ` + match;
      }).replace('  if (field_index >= g2p_field_load(34u)) {\n',
        '  if (field_index >= g2p_field_load(34u)) {\n    if ((atomicLoad(&mechanics_field_view[2u]) & 4u) == 0u) { atomicOr(&mechanics_field_view[2u], 1u << 30u); }\n')
        .replace('  if (descriptor.w != 1u) { return G2P_FIELD_INVALID_INDEX; }',
        '  if (descriptor.w != 1u) { if ((atomicLoad(&mechanics_field_view[2u]) & 4u) == 0u) { atomicOr(&mechanics_field_view[2u], 1u << 31u); } return G2P_FIELD_INVALID_INDEX; }');
      G.g2pRejectSites.push({ module, label: a[0]?.label ?? null, sites });
      a = [{ ...a[0], code: tagged }];
    }
    // S0_P2G_REJECT_TAG=1: same, for P2G's p2g_field_reject() and
    // compact_mechanics_view_reject() call sites (grid_accumulators header).
    const code2 = a[0]?.code;
    if (G.p2gRejectTag && typeof code2 === 'string' && /fn (p2g_field_reject|compact_mechanics_view_reject)\(/.test(code2)) {
      G.p2gRejectSites ??= [];
      const sites = [];
      let k = 0;
      const tagged = code2.replace(/(?<!fn )\b(p2g_field_reject|compact_mechanics_view_reject)\(\);/g, (match, name, offset) => {
        const before = code2.slice(Math.max(0, offset - 240), offset).split('\n').slice(-4).map(l => l.trim()).join(' | ');
        const bit = 20 + (k % 12);
        const inRange = k >= G.p2gTagStart && k < G.p2gTagStart + 12;
        sites.push({ k, bit: inRange ? bit : null, name, before });
        k += 1;
        if (!inRange) return match;
        return `if ((atomicLoad(&grid_accumulators[2u]) & 4) == 0) { atomicOr(&grid_accumulators[2u], bitcast<i32>(${(1 << bit) >>> 0}u)); } ` + match;
      });
      G.p2gRejectSites.push({ module: G.p2gRejectSites.length, label: a[0]?.label ?? null, sites });
      a = [{ ...a[0], code: tagged }];
    }
    return Reflect.apply(o, this, a);
  });
  wrap(GPUDevice.prototype, 'createBuffer', function (o, a) {
    entryFor(this).c.createBuffer++;
    if (G.attributionEnabled) tally('createBuffer', String(a[0]?.label || '(unlabelled) ' + callSite()).replace(/-\d+(-|$)/g, '-#$1').slice(0, 120));
    // Contact audit: make ActiveSource view buffers copyable (usage only).
    const activeView = G.contactAudit && /^ulg-schroeder-(spatial|direct)-active-source-view.*-view$/.test(a[0]?.label || '');
    if (activeView) a = [{ ...a[0], usage: a[0].usage | GPUBufferUsage.COPY_SRC }];
    const buffer = Reflect.apply(o, this, a);
    const label = a[0]?.label || '';
    if (activeView) { buffer.__s0Device = this; (G.activeSourceViews ??= []).push({ buffer, label }); if (G.activeSourceViews.length > 4) G.activeSourceViews.shift(); }
    if (/canonical-(field-)?authority-trace-readback$/.test(label)) traceBuffers.set(buffer, label);
    // Two-level diagnosis: parent-field workspace buffers (header counters name
    // every ws_reject site that fired).
    if (options.workspaceTimeline && /-field-view$/.test(label) && (buffer.usage & GPUBufferUsage.COPY_SRC)) {
      (G.fieldViewBuffers ??= []).push({ buffer, label, device: this });
      if (G.fieldViewBuffers.length > 8) G.fieldViewBuffers.shift();
    }
    // Honest finite walls: the GPU-resident face state (T, C, pending, total).
    if (label === 'ulg-sph-finite-wall-state') {
      (G.finiteWallBuffers ??= []).push({ buffer, device: this });
      if (G.finiteWallBuffers.length > 4) G.finiteWallBuffers.shift();
    }
    if (/-arena-\d+-workspace$/.test(label)) {
      (G.workspaceBuffers ??= []).push({ buffer, label, device: this });
      if (G.workspaceBuffers.length > 8) G.workspaceBuffers.shift();
    }
    // Reaction placement completion receipts (one per arena entry).
    if (G.proposalAudit && /reaction-product-placement-completion-receipt/.test(label)) {
      (G.receiptBuffers ??= []).push({ buffer, label, device: this });
    }
    // G2 ledger buffers: one per ledger thermal step / phase reconcile.
    if (G.counting && /exact-(energy|mass)/.test(label)) G.ledgerLabels[label] = (G.ledgerLabels[label] || 0) + 1;
    // Ledger audit: keep the newest record buffers to read back at the end.
    if (/^ulg-exact-(energy-phase-ledger|energy-thermal|energy-reaction-ledger|mass-ledger-phase-successor|energy-initial|mass-initial|reaction-lineage)$/.test(label)
      || label === 'ulg-sph-phase-carrier-transfer-thermo'
      || label === 'ulg-ledger-parcel-rows' || label === 'ulg-ledger-parcel-sinks' || label === 'ulg-ledger-parcel-params') {
      // Keep the newest few: the very newest may belong to a step the pause
      // interrupted before it was written.
      (G.ledgerLatest[label] ??= []).push({ buffer, device: this });
      if (G.ledgerLatest[label].length > 4) G.ledgerLatest[label].shift();
    }
    return buffer;
  });
  for (const name of ['createComputePipeline', 'createComputePipelineAsync', 'createRenderPipeline', 'createRenderPipelineAsync']) {
    wrap(GPUDevice.prototype, name, function (o, a) { entryFor(this).c.pipelines++; return Reflect.apply(o, this, a); });
  }
  // Proposal audit: after every canonical thermal apply pass, copy the
  // proposal header (binding 10) into a ring, on either route.
  const receiptEncoders = new WeakSet();
  const bindGroupEntries = new WeakMap(), applyPasses = new WeakMap(), evidenceFor = new WeakMap(), graphControlFor = new WeakMap(), cleanupControlFor = new WeakMap(), thermoFor = new WeakMap(), graphPassFor = new WeakMap(), directoryEvidenceFor = new WeakMap(), activeViewInputs = new WeakMap();
  wrap(GPUDevice.prototype, 'createBindGroup', function (o, a) {
    entryFor(this).c.bindGroups++;
    if (G.attributionEnabled) tally('bindGroup', String(a[0]?.label || callSite()).replace(/\d+/g, '#').slice(0, 120));
    const group = Reflect.apply(o, this, a);
    // A probe hook must never throw into the app: entries may be any iterable.
    if (G.proposalAudit) try {
      const entries = Array.from(a[0]?.entries ?? []);
      bindGroupEntries.set(group, entries);
      // A proposal pass binds proposals at 3 and the two evidence buffers at 4, 5.
      const at = binding => entries.find(item => item.binding === binding)?.resource?.buffer;
      if (at(3) && at(4)?.size === 64 && at(5)?.size === 64 && at(1)?.size >= 64) evidenceFor.set(at(3), [at(4), at(5), at(1), at(12) ?? null, at(0), at(15) ?? null]);
      // A contact receipt pass binds graph control at 6 and the receipt at 7.
      if (at(6)?.size >= 520 && at(7)) graphControlFor.set(at(7), at(6));
      // The matching-cleanup pass binds graph control at 8, its control at 10
      // and the cleanup dispatch at 14.
      if (at(8)?.size >= 520 && at(10) && at(14)) cleanupControlFor.set(at(8), [at(10), at(14)]);
      // The graph build pass binds the directory at 4, graph control at 8,
      // traversal evidence at 9 and the aggregate view at 13.
      if (at(8)?.size >= 520 && at(9) && at(4) && at(13) && !at(14)) graphPassFor.set(at(8), [at(9), at(4), at(13)]);
      // The spatial-epoch directory finalize pass binds unique evidence at 4,
      // epoch evidence at 5 and the directory at 6 (8 is its uniform).
      if (at(4) && at(5) && at(6) && at(7) && at(8) && at(8).usage & GPUBufferUsage.UNIFORM && at(6).size >= 4 * 48)
        directoryEvidenceFor.set(at(6), [at(4), at(5)]);
      // The ActiveSource classify pass binds source rows at 0, the view at 3
      // and its evidence at 4.
      if (G.contactAudit && at(3) && at(0) && at(4) && (G.activeSourceViews ?? []).some(v => v.buffer === at(3))) {
        activeViewInputs.set(at(3), [at(0), at(4)]);
        G.activeViewSourceLabel = `${at(0).label}|usage=${at(0).usage}|size=${at(0).size}`;
      }
      // A thermal prepass binds the state (8 floats/row) at 0 and thermo (12 floats/row) at 1.
      if (at(0) && at(1) && at(1).size * 2 === at(0).size * 3) thermoFor.set(at(0), at(1));
      // Phase-volume transport scratch (tail holds a diagnostic record when a
      // DIAG build writes one; needs COPY_SRC, which only DIAG builds add).
      for (const item of entries) {
        const buffer = item?.resource?.buffer;
        if (buffer?.label === 'ulg-schroeder-phase-volume-transport-scratch'
          && (buffer.usage & GPUBufferUsage.COPY_SRC)) G.transportScratch = buffer;
      }
    } catch {}
    return group;
  });
  const passMeta = new WeakMap();
  // Per-pass GPU timing (S0_PASS_TIMING=1, device with timestamp-query):
  // every compute pass without its own timestampWrites gets a begin/end pair
  // in a per-device query set; each encoder resolves its pairs at finish into
  // a mappable ring, read once at the end and aggregated by pass label.
  const passTimer = (encoder, e, descriptor) => {
    if (!G.passTimingEnabled || !G.counting || !e?.device?.features?.has?.('timestamp-query')
        || descriptor?.timestampWrites) return descriptor;
    const t = (G.passTiming ??= new Map()); let d = t.get(e.device);
    if (!d) {
      d = { querySet: e.device.createQuerySet({ type: 'timestamp', count: 4096 }), next: 0,
        resolve: e.device.createBuffer({ size: 4096 * 8, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }),
        ring: e.device.createBuffer({ size: 64 * 4096 * 8, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }),
        ringUsed: 0, labels: [], device: e.device };
      t.set(e.device, d);
    }
    if (d.next + 2 > 4096 || d.ringUsed >= 64 * 4096) return descriptor;
    const index = d.next; d.next += 2;
    (encoderPasses.get(encoder) ?? encoderPasses.set(encoder, []).get(encoder)).push({ index, label: String(descriptor?.label || '(unlabelled)') });
    return { ...(descriptor || {}), timestampWrites: { querySet: d.querySet, beginningOfPassWriteIndex: index, endOfPassWriteIndex: index + 1 } };
  };
  const encoderPasses = new WeakMap();
  const passLabels = new WeakMap();
  if (G.passTimingEnabled && typeof GPUAdapter !== 'undefined') {
    const realRequestDevice = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = function (descriptor = {}) {
      const features = new Set(descriptor?.requiredFeatures ?? []);
      if (this.features?.has?.('timestamp-query')) features.add('timestamp-query');
      return realRequestDevice.call(this, { ...descriptor, requiredFeatures: [...features] });
    };
  }
  wrap(GPUCommandEncoder.prototype, 'finish', function (o, a) {
    const passes = encoderPasses.get(this);
    if (passes?.length) {
      const e = encDev.get(this); const d = G.passTiming?.get(e?.device);
      if (d) {
        const first = Math.min(...passes.map(p => p.index)), last = Math.max(...passes.map(p => p.index)) + 2;
        if (d.ringUsed + (last - first) <= 64 * 4096) {
          this.resolveQuerySet(d.querySet, first, last - first, d.resolve, first * 8);
          this.copyBufferToBuffer(d.resolve, first * 8, d.ring, d.ringUsed * 8, (last - first) * 8);
          for (const p of passes) d.labels.push({ slot: d.ringUsed + (p.index - first), label: p.label });
          d.ringUsed += last - first;
        }
        // Query indices recycle once every pair of this encoder is resolved.
        if (d.next >= 4000) d.next = 0;
      }
      encoderPasses.delete(this);
    }
    return Reflect.apply(o, this, a);
  });
  G.readPassTiming = async () => {
    const out = [];
    for (const d of G.passTiming?.values() ?? []) {
      await d.ring.mapAsync(GPUMapMode.READ);
      const times = new BigUint64Array(d.ring.getMappedRange().slice(0)); d.ring.unmap();
      const byLabel = new Map();
      for (const { slot, label } of d.labels) {
        const begin = times[slot], end = times[slot + 1];
        if (!(end > begin)) continue;
        const key = label.replace(/-\d+(-|$)/g, '-#$1').slice(0, 90);
        const r = byLabel.get(key) ?? { count: 0, ns: 0 }; r.count++; r.ns += Number(end - begin); byLabel.set(key, r);
      }
      out.push([...byLabel].sort((x, y) => y[1].ns - x[1].ns).slice(0, 45).map(([label, r]) => [label, r.count, +(r.ns / 1e6).toFixed(3)]));
    }
    return out.length ? out : null;
  };
  wrap(GPUCommandEncoder.prototype, 'beginComputePass', function (o, a) {
    const e = encDev.get(this);
    if (G.passTimingEnabled) a = [passTimer(this, e, a[0])];
    const pass = Reflect.apply(o, this, a);
    if (G.attributionEnabled) passLabels.set(pass, String(a[0]?.label || '(unlabelled)'));
    if (G.passTraceSlots.length || options.workspaceTimeline) passMeta.set(pass, { encoder: this, device: e?.device ?? null, label: a[0]?.label || '', groups: [] });
    if (e) { e.c.computePasses++; passDev.set(pass, e); }
    if (G.proposalAudit && G.counting && a[0]?.label === 'ulg-exact-reaction-ledger' && e && !receiptEncoders.has(this)
        && G.receiptBuffers?.length) {
      receiptEncoders.add(this);
      if (!G.ledgerReceiptRing) G.ledgerReceiptRing = { used: 0, slots: 4096,
        buffer: e.device.createBuffer({ size: 4096 * 4 * 312, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }) };
      const r = G.ledgerReceiptRing;
      if (r.used < r.slots) {
        G.receiptBuffers.slice(-4).forEach(({ buffer, device }, k) => {
          if (device === e.device && buffer.size >= 312) this.copyBufferToBuffer(buffer, 0, r.buffer, (r.used * 4 + k) * 312, 312);
        });
        r.used++;
      }
    }
    if (G.proposalAudit && a[0]?.label === 'ulg-sph-thermal-v2-canonical-proposal-apply') {
      applyPasses.set(pass, { encoder: this, device: e?.device ?? null, bins: null });
    }
    return pass;
  });
  wrap(GPUComputePassEncoder.prototype, 'setBindGroup', function (o, a) {
    try { passMeta.get(this)?.groups.push(a[1]); } catch {}
    try {
      const apply = applyPasses.get(this);
      if (apply) {
        const entry = (bindGroupEntries.get(a[1]) ?? []).find(item => item.binding === 10);
        apply.bins = entry?.resource?.buffer ?? null;
      }
    } catch {}
    return Reflect.apply(o, this, a);
  });
  wrap(GPUComputePassEncoder.prototype, 'end', function (o, a) {
    const result = Reflect.apply(o, this, a);
    try { probeAfterPassEnd(this); } catch (error) { (G.probeErrors ??= []).push(String(error).slice(0, 200)); }
    return result;
  });
  const passTraceAfterEnd = pass => {
    const meta = passMeta.get(pass), ring = G.proposalRing;
    if (!meta?.device || !ring || !G.passTraceSlots.includes(ring.used)) return;
    const rows = G.passTraceRows, row = G.traceRows[0];
    if (!G.passTraceBuffer) G.passTraceBuffer = meta.device.createBuffer({ size: 600 * 64,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    // Field-view headers (words 0..63) bound to this pass, for per-pass
    // status transitions around a fail-closed onset.
    for (const group of meta.groups) for (const entry of bindGroupEntries.get(group) ?? []) {
      const buffer = entry?.resource?.buffer;
      if (!buffer || !(buffer.usage & GPUBufferUsage.COPY_SRC) || !/-field-view$|gas-pressure-boundary-scratch$/.test(buffer.label || '')) continue;
      G.fvTrace ??= []; if (G.fvTrace.length >= 3000) continue;
      G.fvTraceBuffer ??= meta.device.createBuffer({ size: 3000 * 256, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      meta.encoder.copyBufferToBuffer(buffer, 0, G.fvTraceBuffer, G.fvTrace.length * 256, 256);
      G.fvTrace.push({ slot: ring.used, pass: meta.label, binding: entry.binding, buffer: (buffer.label || '').slice(-60) });
    }
    for (const group of meta.groups) for (const entry of bindGroupEntries.get(group) ?? []) {
      const buffer = entry?.resource?.buffer;
      if (!buffer || !(buffer.usage & GPUBufferUsage.COPY_SRC) || G.passTrace.length >= 600) continue;
      const kind = buffer.size === rows * 32 ? 'state' : buffer.size === rows * 48 ? 'thermo' : null;
      if (!kind) continue;
      const bytes = kind === 'state' ? 32 : 48;
      meta.encoder.copyBufferToBuffer(buffer, row * bytes, G.passTraceBuffer, G.passTrace.length * 64, bytes);
      G.passTrace.push({ slot: ring.used, pass: meta.label, binding: entry.binding, buffer: buffer.label || '', kind });
    }
  };
  const probeAfterPassEnd = pass => {
    try { passTraceAfterEnd(pass); } catch (error) { (G.probeErrors ??= []).push(String(error).slice(0, 200)); }
    // Two-level diagnosis: the fine (level-0, arena-0) field view status after
    // every compute pass, to name the pass that fails it closed.
    try {
      const meta = passMeta.get(pass);
      const view = (G.fieldViewBuffers ?? []).find(({ label }) => /arena-0-level-0-field-view$/.test(label));
      if (options.workspaceTimeline && meta?.device && view && view.device === meta.device) {
        const LIMIT = 1500;
        G.passStatus ??= { used: 0, labels: [] };
        const ps = G.passStatus;
        if (ps.used < LIMIT) {
          ps.buffer ??= meta.device.createBuffer({ size: LIMIT * 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
          meta.encoder.copyBufferToBuffer(view.buffer, 0, ps.buffer, ps.used * 16, 16);
          ps.labels.push(meta.label.slice(0, 90));
          ps.used++;
        }
      }
    } catch (error) { (G.probeErrors ??= []).push(String(error).slice(0, 200)); }
    const apply = applyPasses.get(pass);
    if (apply?.bins && apply.device && G.counting) {
      // Slot words: proposal header 0-15, conduction evidence 16-31, radiation
      // evidence 32-47, derived header 48-63, contact receipt 64-79, graph
      // control 80-211, cleanup control 212-(212+CLEANUP).
      const SLOT = 4 * (212 + 4108 + 8);
      if (!G.proposalRing) G.proposalRing = { device: apply.device, slots: 1024, used: 0, slotBytes: SLOT,
        buffer: apply.device.createBuffer({ size: 1024 * SLOT, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }) };
      const ring = G.proposalRing;
      // S0_RING_SKIP_APPLIES: record only after this many counted applies, so
      // the 1,024-slot ring can cover a late event (the newest-state copies
      // below still run every step).
      G.ringApplies = (G.ringApplies ?? 0) + 1;
      const ringOpen = ring.used < ring.slots
        && G.ringApplies > Number(G.ringSkipApplies || 0);
      if (ring.device === apply.device) {
        const base = Math.min(ring.used, ring.slots - 1) * SLOT;
        const copy = (buffer, wordOffset, bytes) => {
          if (!buffer || !(buffer.usage & GPUBufferUsage.COPY_SRC)) return;
          const size = Math.min(bytes, buffer.size) & ~3;
          if (size) apply.encoder.copyBufferToBuffer(buffer, 0, ring.buffer, base + 4 * wordOffset, size);
        };
        if (ringOpen) copy(apply.bins, 0, 64);
        const [conduction, radiation, derived, receipt, sourceState, sidecar] = evidenceFor.get(apply.bins) ?? [];
        // Keep the newest thermal source state (pos/mass, vel/u per particle).
        if (!G.proposalMinimal && sourceState && (sourceState.usage & GPUBufferUsage.COPY_SRC)
          && !(G.stateAtApply > 0 && ring.used > G.stateAtApply)) {
          if (!G.stateCopy || G.stateCopy.size < sourceState.size) G.stateCopy = apply.device.createBuffer({
            size: sourceState.size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
          apply.encoder.copyBufferToBuffer(sourceState, 0, G.stateCopy, 0, sourceState.size);
          // Newest proposal rows and conductivity sidecar, for per-material deltas.
          for (const [name, buffer] of [['proposalCopy', apply.bins], ['sidecarCopy', sidecar], ['receiptCopy', receipt],
            ['derivedCopy', derived]]) {
            if (!buffer || !(buffer.usage & GPUBufferUsage.COPY_SRC)) continue;
            if (!G[name] || G[name].size < buffer.size) G[name] = apply.device.createBuffer({
              size: buffer.size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
            apply.encoder.copyBufferToBuffer(buffer, 0, G[name], 0, buffer.size);
          }
          if (G.transportScratch && G.transportScratch.size >= 128) {
            G.scratchTailCopy ??= apply.device.createBuffer({ size: 128,
              usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
            apply.encoder.copyBufferToBuffer(G.transportScratch, G.transportScratch.size - 128,
              G.scratchTailCopy, 0, 128);
          }
          const thermo = thermoFor.get(sourceState);
          if (thermo && (thermo.usage & GPUBufferUsage.COPY_SRC)) {
            if (!G.thermoCopy || G.thermoCopy.size < thermo.size) G.thermoCopy = apply.device.createBuffer({
              size: thermo.size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
            apply.encoder.copyBufferToBuffer(thermo, 0, G.thermoCopy, 0, thermo.size);
          }
        }
        const graph = receipt ? graphControlFor.get(receipt) : null;
        const cleanup = graph ? cleanupControlFor.get(graph) : null;
        if (ringOpen && G.traceRows?.length && sourceState) {
          const thermoRows = thermoFor.get(sourceState);
          G.traceRows.forEach((row, k) => {
            if ((sourceState.usage & GPUBufferUsage.COPY_SRC) && (row + 1) * 32 <= sourceState.size)
              apply.encoder.copyBufferToBuffer(sourceState, row * 32, ring.buffer, base + 4 * (700 + 20 * k), 32);
            if (thermoRows && (thermoRows.usage & GPUBufferUsage.COPY_SRC) && (row + 1) * 48 <= thermoRows.size)
              apply.encoder.copyBufferToBuffer(thermoRows, row * 48, ring.buffer, base + 4 * (708 + 20 * k), 48);
          });
        }
        if (ringOpen && !G.proposalMinimal) {
          copy(conduction, 16, 64); copy(radiation, 32, 64); copy(derived, 48, 64); copy(receipt, 64, 64);
          if (G.contactAudit) {
            const [traversal, directory, aggregate] = graph ? graphPassFor.get(graph) ?? [] : [];
            copy(graph, 80, 520); copy(traversal, 212, 4 * 64); copy(directory, 276, 4 * 64); copy(aggregate, 340, 4 * 112);
            const [uniqueEvidence, epochEvidence] = directory ? directoryEvidenceFor.get(directory) ?? [] : [];
            copy(uniqueEvidence, 452, 4 * 16); copy(epochEvidence, 468, 4 * 16);
            // Newest two ActiveSource view headers (40 words each).
            (G.activeSourceViews ?? []).slice(-3).forEach(({ buffer }, k) => {
              copy(buffer, 484 + 40 * k, 4 * 40);
              // Classifier evidence (11 words) per arena.
              copy(activeViewInputs.get(buffer)?.[1], 604 + 12 * k, 4 * 12);
              // Newest source rows of arena 0, overwritten each step, read at the end.
              const rows = k === 0 ? activeViewInputs.get(buffer)?.[0] : null;
              if (rows && (rows.usage & GPUBufferUsage.COPY_SRC)) {
                if (!G.sourceRowsCopy || G.sourceRowsCopy.size < rows.size) G.sourceRowsCopy = apply.device.createBuffer({
                  size: rows.size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
                apply.encoder.copyBufferToBuffer(rows, 0, G.sourceRowsCopy, 0, rows.size);
              }
            });
          } else if (!G.proposalLight) {
            copy(graph, 80, 520); copy(cleanup?.[0], 212, 4 * 4108);
            // Owner per-particle flags (cleanup dispatch: 5 header words, then
            // one flag word per particle) for naming unconverged particles.
            const flags = cleanup?.[1];
            if (ringOpen && flags && (flags.usage & GPUBufferUsage.COPY_SRC)) {
              const FW = 5 + 4096;
              if (!G.flagRing) G.flagRing = apply.device.createBuffer({ size: ring.slots * 4 * FW,
                usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
              const bytes = Math.min(flags.size, 4 * FW) & ~3;
              apply.encoder.copyBufferToBuffer(flags, 0, G.flagRing, ring.used * 4 * FW, bytes);
            }
            // Owner dispatch header (active count, active cursor count) after the cleanup control.
            copy(cleanup?.[1], 212 + 4108, 32);
          }
        }
        // Placement receipts: the previous step's reaction, read at this step's thermal apply.
        if (ringOpen && G.receiptBuffers?.length) {
          if (!G.receiptRing) G.receiptRing = apply.device.createBuffer({ size: ring.slots * 4 * 312,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
          G.receiptBuffers.slice(-4).forEach(({ buffer, device }, k) => {
            if (device === apply.device && buffer.size >= 312)
              apply.encoder.copyBufferToBuffer(buffer, 0, G.receiptRing, (ring.used * 4 + k) * 312, 312);
          });
        }
        if (ringOpen) ring.used++;
      }
    }
  };
  wrap(GPUCommandEncoder.prototype, 'beginRenderPass', function (o, a) {
    const e = encDev.get(this); if (e) e.c.renderPasses++;
    return Reflect.apply(o, this, a);
  });
  wrap(GPUComputePassEncoder.prototype, 'dispatchWorkgroups', function (o, a) {
    const e = passDev.get(this); if (e) e.c.dispatch++;
    return Reflect.apply(o, this, a);
  });
  wrap(GPUComputePassEncoder.prototype, 'dispatchWorkgroupsIndirect', function (o, a) {
    const e = passDev.get(this); if (e) e.c.dispatchIndirect++;
    if (G.attributionEnabled) {
      const passLabel = passLabels.get(this);
      tally('indirect', (passLabel && passLabel !== '(unlabelled)' ? String(passLabel) : `(unlabelled) ${callSite()}`)
        .replace(/-\d+(-|$)/g, '-#$1').replace(/\?t=\d+/g, '').slice(0, 160));
    }
    return Reflect.apply(o, this, a);
  });
  wrap(GPUQueue.prototype, 'submit', function (o, a) {
    const e = queueDev.get(this); if (e) { e.c.submits++; e.c.commandBuffers += a[0]?.length || 0; }
    // S0_SUBMIT_NUDGE=workdone|map: after each submit, an onSubmittedWorkDone
    // call, or a 4-byte copy plus mapAsync (no app work), to isolate why the
    // pass census's per-encoder readback speeds the lane up.
    if (options.submitNudge && e) {
      const result = Reflect.apply(o, this, a);
      if (options.submitNudge === 'workdone') this.onSubmittedWorkDone().catch(() => {});
      else if (options.submitNudge === 'map') {
        const device = e.device;
        e.nudgeSrc ??= device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE });
        e.nudgePool ??= [];
        const read = e.nudgePool.pop() ?? device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(e.nudgeSrc, 0, read, 0, 4);
        Reflect.apply(o, this, [[encoder.finish()]]);
        read.mapAsync(GPUMapMode.READ, 0, 4).then(() => { read.unmap(); e.nudgePool.push(read); }, () => {});
      }
      return result;
    }
    if (G.attributionEnabled) tally('submit', callSite());
    // Submit timeline (S0_TIMELINE=1): time and simulation/presentation class.
    if (G.timelineEnabled && G.counting) {
      const stack = String(new Error().stack || '');
      const kind = /IsosurfacePresenter|NativeSurface|renderFrame|Presentation/.test(stack) ? 'p' : 's';
      (G.submitTimeline ??= []).length < 200000 && G.submitTimeline.push([performance.now(), kind]);
    }
    const result = Reflect.apply(o, this, a);
    // Two-level diagnosis: snapshot every workspace header after each of the
    // first submits (queue order makes each copy see the post-submit state).
    if (options.workspaceTimeline && (G.workspaceBuffers?.length ?? 0) > 0) {
      const SLOTS = 400, W = 104;
      G.wsTimeline ??= { used: 0, meta: [] };
      const t = G.wsTimeline;
      const device = G.workspaceBuffers[0].device;
      if (t.used < SLOTS && e?.device === device) {
        t.buffer ??= device.createBuffer({ size: SLOTS * 4 * 4 * W, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        try {
          const encoder = device.createCommandEncoder();
          G.workspaceBuffers.slice(-4).forEach(({ buffer }, k) => {
            const bytes = Math.min(buffer.size, 4 * W) & ~3;
            encoder.copyBufferToBuffer(buffer, 0, t.buffer, (t.used * 4 + k) * 4 * W, bytes);
          });
          // Field-view headers too (64 words each, up to 8 views).
          t.fv ??= device.createBuffer({ size: SLOTS * 8 * 4 * 64, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
          (G.fieldViewBuffers ?? []).slice(-8).forEach(({ buffer }, k) => {
            const bytes = Math.min(buffer.size, 4 * 64) & ~3;
            encoder.copyBufferToBuffer(buffer, 0, t.fv, (t.used * 8 + k) * 4 * 64, bytes);
          });
          t.fvMeta ??= [];
          t.fvMeta.push((G.fieldViewBuffers ?? []).slice(-8).map(({ label }) => label.slice(-48)));
          Reflect.apply(o, this, [[encoder.finish()]]);
          t.meta.push(G.workspaceBuffers.slice(-4).map(({ label }) => label.slice(-24)));
          t.used++;
        } catch (error) { (G.probeErrors ??= []).push(String(error).slice(0, 160)); }
      }
    }
    return result;
  });
  wrap(GPUQueue.prototype, 'writeBuffer', function (o, a) {
    if (G.attributionEnabled) tally('writeBuffer', String(a[0]?.label || '(unlabelled)').replace(/\d+/g, '#').slice(0, 120));
    const coldLabel = a[0]?.label;
    if (coldLabel === 'ulg-sph-particle-thermo' && a[2]?.byteLength) {
      // The cold material ids of the upload that seeds the exact rows.
      G.lastThermoWrite = Array.from(new Float32Array(a[2].buffer, a[2].byteOffset, a[2].byteLength / 4));
    }
    if (coldLabel === 'ulg-ledger-parcel-rows' && a[2]?.byteLength && !G.ledgerCold.parcelRows) {
      G.ledgerCold.parcelRows = Array.from(new Uint32Array(a[2].buffer, a[2].byteOffset, a[2].byteLength / 4));
    }
    if (coldLabel === 'ulg-exact-energy-initial' || coldLabel === 'ulg-exact-mass-initial') {
      const data = a[2];
      G.ledgerCold[coldLabel] = Array.from(new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4));
      if (coldLabel === 'ulg-exact-mass-initial' && G.lastThermoWrite) G.ledgerCold.thermo = G.lastThermoWrite;
    }
    const e = queueDev.get(this);
    if (e) { e.c.writeBuffer++; e.c.writeBytes += a[4] ?? (a[2]?.byteLength ?? 0); }
    return Reflect.apply(o, this, a);
  });
  wrap(GPUQueue.prototype, 'onSubmittedWorkDone', function (o, a) {
    const e = queueDev.get(this); if (e) e.c.workDone++;
    if (G.attributionEnabled) tally('workDone', callSite());
    return Reflect.apply(o, this, a);
  });
  wrap(GPUBuffer.prototype, 'mapAsync', function (o, a) {
    for (const e of G.devices) e.c.mapAsync++;
    if (G.attributionEnabled) tally('mapAsync', String(this.label || '') + ' @ ' + callSite());
    return Reflect.apply(o, this, a);
  });
  // The app copies the mapped words and unmaps; copy them here first.
  wrap(GPUBuffer.prototype, 'getMappedRange', function (o, a) {
    const range = Reflect.apply(o, this, a);
    const label = traceBuffers.get(this);
    if (label && G.counting) {
      if (G.traces.length < G.traceLimit) {
        G.traces.push({ label, at: performance.now(), words: Array.from(new Uint32Array(range)) });
      } else G.traceDrops++;
    }
    return range;
  });
  // A row trace must see the steps before the window: count from the start.
  G.counting = G.traceRows.length > 0 || options.countFromStart === true;
  G.readPassStatus = async () => {
    const ps = G.passStatus; if (!ps?.buffer || !ps.used) return null;
    await ps.buffer.mapAsync(GPUMapMode.READ);
    const words = new Uint32Array(ps.buffer.getMappedRange().slice(0)); ps.buffer.unmap();
    const out = []; let prev = null;
    for (let i = 0; i < ps.used; i++) {
      const status = words[i * 4 + 2];
      if (status !== prev) out.push({ pass: i, label: ps.labels[i], status });
      prev = status;
    }
    return { used: ps.used, transitions: out.slice(0, 40) };
  };
  G.readWorkspaceTimeline = async () => {
    const t = G.wsTimeline; if (!t?.buffer || !t.used) return null;
    await t.buffer.mapAsync(GPUMapMode.READ);
    const words = new Uint32Array(t.buffer.getMappedRange().slice(0)); t.buffer.unmap();
    const W = 104, out = [];
    let firstFail = null;
    for (let i = 0; i < t.used; i++) {
      for (let k = 0; k < 4; k++) {
        const base = (i * 4 + k) * W; const status = words[base + 2];
        if (status === undefined) continue;
        if ((status & 4) && !firstFail) {
          const nonzero = {}; for (let w = 2; w < W; w++) if (words[base + w]) nonzero[w] = words[base + w];
          firstFail = { submit: i, arena: t.meta[i]?.[k], nonzero };
        }
      }
    }
    // Phase/status per submit for arena 0..3 (compact).
    const trail = []; for (let i = 0; i < t.used; i++) trail.push([0, 1, 2, 3].map(k => `${words[(i * 4 + k) * W + 2]}/${words[(i * 4 + k) * W + 36]}`).join(' '));
    let fieldViewFirstFail = null; const fvTrail = [];
    if (t.fv) {
      await t.fv.mapAsync(GPUMapMode.READ);
      const fv = new Uint32Array(t.fv.getMappedRange().slice(0)); t.fv.unmap();
      for (let i = 0; i < t.used; i++) {
        const row = [];
        for (let k = 0; k < 8; k++) {
          const base = (i * 8 + k) * 64; const status = fv[base + 2];
          row.push(status);
          if ((status & 4) && !fieldViewFirstFail && t.fvMeta?.[i]?.[k]) {
            const nonzero = {}; for (let w = 2; w < 64; w++) if (fv[base + w]) nonzero[w] = fv[base + w];
            fieldViewFirstFail = { submit: i, label: t.fvMeta[i][k], nonzero };
          }
        }
        fvTrail.push(row.join(','));
      }
    }
    out.push({ used: t.used, firstFail, fieldViewFirstFail, fvLabels: t.fvMeta?.[t.used - 1] ?? null,
      fvTrail: fvTrail.slice(0, 60), trail: trail.slice(0, 120) });
    return out;
  };
  G.readFiniteWalls = async () => {
    const out = [];
    for (const { buffer, device } of G.finiteWallBuffers ?? []) {
      try {
        const copy = device.createBuffer({ size: 128, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        const e = device.createCommandEncoder(); e.copyBufferToBuffer(buffer, 0, copy, 0, 128);
        device.queue.submit([e.finish()]); await copy.mapAsync(GPUMapMode.READ);
        const f = new Float32Array(copy.getMappedRange().slice(0)); const u = new Uint32Array(f.buffer);
        copy.unmap(); copy.destroy();
        out.push({ temperatureK: Array.from(f.slice(0, 6)), capacityJPerK: Array.from(f.slice(6, 12)),
          pendingJ: Array.from(f.slice(12, 18)), totalJ: Array.from(f.slice(18, 24)), updates: u[26] });
      } catch (error) { out.push({ error: String(error).slice(0, 120) }); }
    }
    return out.length ? out : null;
  };
  G.readWorkspaceHeaders = async () => {
    const out = [];
    for (const { buffer, label, device } of G.workspaceBuffers ?? []) {
      try {
        const bytes = Math.min(buffer.size, 4 * 104) & ~3;
        const copy = device.createBuffer({ size: bytes, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(buffer, 0, copy, 0, bytes);
        device.queue.submit([encoder.finish()]);
        await copy.mapAsync(GPUMapMode.READ);
        const words = new Uint32Array(copy.getMappedRange().slice(0)); copy.unmap(); copy.destroy();
        const nonzero = {};
        words.forEach((value, index) => { if (value && index >= 2) nonzero[index] = value; });
        out.push({ label, status: words[2], nonzero });
      } catch (error) { out.push({ label, error: String(error).slice(0, 120) }); }
    }
    return out;
  };
  // S0_CONTACT_AUDIT: physical <-> active map consistency of the newest
  // active-source views (the G2P ActiveSource-v2 check that rejects with 17).
  G.readActiveSourceConsistency = async () => {
    const out = [];
    for (const { buffer, label } of (G.activeSourceViews ?? []).slice(-3)) {
      try {
        const device = buffer.__s0Device;
        if (!device) continue;
        const read = device.createBuffer({ size: buffer.size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(buffer, 0, read, 0, buffer.size);
        device.queue.submit([encoder.finish()]); await read.mapAsync(GPUMapMode.READ);
        const v = new Uint32Array(read.getMappedRange().slice(0)); read.unmap(); read.destroy();
        const physical = v[16], active = v[18], a2p = v[25], p2a = v[26];
        const bad = [];
        let mappedCount = 0;
        for (let p = 0; p < Math.min(v[17], v.length - p2a); p++) {
          const ordinal = v[p2a + p];
          if (ordinal === 0xffffffff) continue;
          mappedCount++;
          if (ordinal >= active || v[a2p + ordinal] !== p) { if (bad.length < 8) bad.push({ p, ordinal, back: v[a2p + ordinal] }); }
        }
        out.push({ label: label.slice(-70), physicalSourceCount: physical, physicalSourceCapacity: v[17], activeSourceCount: active,
          activeSourceCapacity: v[19], dormant: v[20], invalid: v[21], overflow: v[22], mappedCount, bad });
      } catch (error) { out.push({ label, error: String(error).slice(0, 120) }); }
    }
    return out;
  };
  G.readStateLanes = async (lanes = 4) => {
    if (!G.stateCopy) return null;
    await G.stateCopy.mapAsync(GPUMapMode.READ);
    const f = new Float32Array(G.stateCopy.getMappedRange().slice(0));
    G.stateCopy.unmap();
    const particles = f.length / 8, stride = particles / lanes;
    const mass = Array.from({ length: lanes }, () => 0), count = Array.from({ length: lanes }, () => 0);
    for (let i = 0; i < particles; i++) { const lane = Math.floor(i / stride); const m = f[i * 8 + 3];
      if (m > 0) { mass[lane] += m; count[lane]++; } }
    const uMax = Array.from({ length: lanes }, (_, lane) => { let u = -Infinity;
      for (let i = lane * stride; i < (lane + 1) * stride; i++) if (f[i * 8 + 3] > 0) u = Math.max(u, f[i * 8 + 7]); return u; });
    // Per (material, phase, lane): rows, mass, u range, from the thermo copy.
    let byKind = null;
    if (G.thermoCopy) {
      await G.thermoCopy.mapAsync(GPUMapMode.READ);
      const t = new Float32Array(G.thermoCopy.getMappedRange().slice(0));
      G.thermoCopy.unmap();
      byKind = {};
      for (let i = 0; i < particles; i++) { const m = f[i * 8 + 3]; if (!(m > 0)) continue;
        const key = `mat${t[i * 12]}/phase${t[i * 12 + 1]}/lane${Math.floor(i / stride)}/rho${Math.round(t[i * 12 + 3])}`;
        const k = byKind[key] ??= { rows: 0, massKg: 0, uMin: Infinity, uMax: -Infinity, tMaxK: -Infinity, gasFractionMax: 0 };
        k.rows++; k.massKg += m; k.uMin = Math.min(k.uMin, f[i * 8 + 7]); k.uMax = Math.max(k.uMax, f[i * 8 + 7]);
        k.massMinKg = Math.min(k.massMinKg ?? Infinity, m); k.massMaxKg = Math.max(k.massMaxKg ?? 0, m);
        k.tMaxK = Math.max(k.tMaxK, t[i * 12 + 2]); k.gasFractionMax = Math.max(k.gasFractionMax, t[i * 12 + 6]);
        k.lo ??= [Infinity, Infinity, Infinity]; k.hi ??= [-Infinity, -Infinity, -Infinity];
        for (let a = 0; a < 3; a++) { k.lo[a] = Math.min(k.lo[a], f[i * 8 + a]); k.hi[a] = Math.max(k.hi[a], f[i * 8 + a]); }
        k.vMax = Math.max(k.vMax ?? 0, Math.hypot(f[i * 8 + 4], f[i * 8 + 5], f[i * 8 + 6])); }
      // Species co-location audit (phase 3 rows): for each row of the most
      // populous gas material, the nearest row of every other gas material,
      // its distance and velocity difference. Co-located rows with different
      // velocities mean the node mixture binding failed; no co-located rows
      // mean something displaced the parcel's species apart.
      {
        const gasRows = [];
        for (let i = 0; i < particles; i++) {
          if (!(f[i * 8 + 3] > 0) || t[i * 12 + 1] !== 3) continue;
          gasRows.push({ i, mat: t[i * 12], x: [f[i * 8], f[i * 8 + 1], f[i * 8 + 2]], v: [f[i * 8 + 4], f[i * 8 + 5], f[i * 8 + 6]], T: t[i * 12 + 2] });
        }
        const counts = {}; gasRows.forEach((r) => { counts[r.mat] = (counts[r.mat] ?? 0) + 1; });
        const refMat = Object.entries(counts).sort((l, r) => r[1] - l[1])[0]?.[0];
        const audit = { refMat, perMaterial: {} };
        for (const r of gasRows.filter((row) => String(row.mat) === refMat)) {
          for (const mat of Object.keys(counts)) {
            if (mat === refMat) continue;
            let best = null;
            for (const o of gasRows) {
              if (String(o.mat) !== mat) continue;
              const d = Math.hypot(o.x[0] - r.x[0], o.x[1] - r.x[1], o.x[2] - r.x[2]);
              if (!best || d < best.d) best = { d, dv: Math.hypot(o.v[0] - r.v[0], o.v[1] - r.v[1], o.v[2] - r.v[2]), dT: o.T - r.T };
            }
            if (!best) continue;
            const m = audit.perMaterial[mat] ??= { pairs: 0, coLocated: 0, coLocatedMaxDv: 0, maxD: 0, medianD: [], maxAbsDT: 0 };
            m.pairs++; m.maxD = Math.max(m.maxD, best.d); m.medianD.push(best.d);
            if (best.d < 1e-6) { m.coLocated++; m.coLocatedMaxDv = Math.max(m.coLocatedMaxDv, best.dv); }
            m.maxAbsDT = Math.max(m.maxAbsDT, Math.abs(best.dT));
          }
        }
        for (const m of Object.values(audit.perMaterial)) { m.medianD.sort((l, r) => l - r); m.medianD = m.medianD[Math.floor(m.medianD.length / 2)]; }
        byKind.__speciesColocation = audit;
        // One thermo row (12 words) per gas material, for EOS/pressure checks.
        const seen = new Set(); byKind.__gasThermoSample = [];
        for (const r of gasRows) { if (seen.has(r.mat)) continue; seen.add(r.mat);
          byKind.__gasThermoSample.push({ i: r.i, mat: r.mat, m: f[r.i * 8 + 3], thermo: Array.from(t.slice(r.i * 12, r.i * 12 + 12)).map((x) => +x.toPrecision(7)) }); }
      }
      // Gas rows beside their own lineage's other lanes (same index in each
      // lane): is the gas co-located with and velocity-locked to them?
      const row = i => ({ i, lane: Math.floor(i / stride), phase: t[i * 12 + 1], m: +f[i * 8 + 3].toPrecision(4),
        p: [0, 1, 2].map(a => +(f[i * 8 + a] * 1000).toFixed(2)), v: [4, 5, 6].map(a => +f[i * 8 + a].toFixed(4)),
        T: +t[i * 12 + 2].toFixed(1) });
      // Rows the particle gas-ledger EOS would reject as invalid candidates
      // (sphSpatialGasLedgerEosGpu.js emit pass): declared gas, not pure gas.
      byKind.__invalidGasCandidates = [];
      const tol = 1e-5, fin = Number.isFinite;
      for (let i = 0; i < particles && byKind.__invalidGasCandidates.length < 16; i++) {
        const m = f[i * 8 + 3]; if (!(m > 0)) continue;
        const T = t.slice(i * 12, i * 12 + 12); const [solid, liquid, gas, plasma] = [T[4], T[5], T[6], T[7]];
        const phaseGas = fin(T[1]) && Math.abs(T[1] - 3) < 0.5;
        const oneHot = Math.abs(solid) <= tol && Math.abs(liquid) <= tol && Math.abs(gas - 1) <= tol && Math.abs(plasma) <= tol;
        if (!phaseGas && !oneHot) continue;
        const valid = phaseGas && oneHot && T[10] > 0.5 && T[10] < 3.5 && T[0] > 0 && T[2] > 0 && T[3] > 0 && T[9] > 0;
        if (!valid) byKind.__invalidGasCandidates.push({ i, lane: Math.floor(i / stride), m, thermo: Array.from(T).map(x => +x.toPrecision(5)) });
      }
      // Rows the mechanics field view's field_source_admitted would refuse
      // (phase 1..4, material >= 1, status bits vs mass), from state + thermo.
      byKind.__fieldInadmissible = { count: 0, rows: [] };
      for (let i = 0; i < particles; i++) {
        const m = f[i * 8 + 3], phase = t[i * 12 + 1], material = t[i * 12], status = t[i * 12 + 10];
        const st = Math.round(status);
        const integral = (x) => Number.isFinite(x) && Math.round(x) === x;
        const statusOk = integral(status) && status >= 0 && status <= 255
          && ((m === 0 && (st & 31) !== 0) || (m > 0 && (st & 31) !== 0 && (st & 64) === 0 && (st & 128) === 0));
        const ok = Number.isFinite(m) && m >= 0 && integral(phase) && phase >= 1 && phase <= 4
          && integral(material) && material >= 1 && statusOk
          && [0, 1, 2].every((a) => Number.isFinite(f[i * 8 + a]));
        if (ok) continue;
        byKind.__fieldInadmissible.count += 1;
        if (byKind.__fieldInadmissible.rows.length < 12) byKind.__fieldInadmissible.rows.push({ i, lane: Math.floor(i / stride),
          m: +m.toPrecision(4), phase, material, status, p: [0, 1, 2].map((a) => +f[i * 8 + a].toFixed(4)) });
      }
      byKind.__gasLineages = [];
      for (let i = 0; i < particles && byKind.__gasLineages.length < 12; i++) {
        if (!(f[i * 8 + 3] > 0) || t[i * 12 + 1] !== 3) continue;
        const local = i % stride;
        byKind.__gasLineages.push(Array.from({ length: lanes }, (_, lane) => lane * stride + local)
          .filter(j => f[j * 8 + 3] > 0).map(row));
      }
      // Lineages whose active lanes (mass > 0) hold different materials: the
      // contact graph's aggregateSummaryLineageMaterialMismatchCount site.
      byKind.__lineageMaterialMismatch = [];
      for (let local = 0; local < stride && byKind.__lineageMaterialMismatch.length < 12; local++) {
        const active = Array.from({ length: lanes }, (_, lane) => lane * stride + local).filter(j => j < particles && f[j * 8 + 3] > 0);
        if (new Set(active.map(j => t[j * 12])).size > 1)
          byKind.__lineageMaterialMismatch.push(active.map(j => ({ ...row(j), mat: t[j * 12], status: t[j * 12 + 10] })));
      }
    }
    // Conduction and radiation energy per kind on the newest step (J), and
    // the conductivity sidecar per kind.
    let transportScratchTail = null;
    if (G.scratchTailCopy) {
      await G.scratchTailCopy.mapAsync(GPUMapMode.READ);
      transportScratchTail = Array.from(new Uint32Array(G.scratchTailCopy.getMappedRange().slice(0)));
      G.scratchTailCopy.unmap();
    }
    const readWords = async buffer => { if (!buffer) return null; await buffer.mapAsync(GPUMapMode.READ);
      const w = new Uint32Array(buffer.getMappedRange().slice(0)); buffer.unmap(); return w; };
    const proposal = await readWords(G.proposalCopy), sidecarWords = await readWords(G.sidecarCopy);
    if (byKind && G.thermoCopy && proposal) {
      await G.thermoCopy.mapAsync(GPUMapMode.READ);
      const t = new Float32Array(G.thermoCopy.getMappedRange().slice(0)); G.thermoCopy.unmap();
      const pf = new Float32Array(proposal.buffer);
      for (let i = 0; i < particles; i++) { const m = f[i * 8 + 3]; if (!(m > 0)) continue;
        const key = `mat${t[i * 12]}/phase${t[i * 12 + 1]}/lane${Math.floor(i / stride)}/rho${Math.round(t[i * 12 + 3])}`;
        const k = byKind[key]; const row = 16 + i * 4;
        k.conductionJ = (k.conductionJ ?? 0) + pf[row] * m; k.radiationJ = (k.radiationJ ?? 0) + pf[row + 1] * m;
        k.conductionRowsNonzero = (k.conductionRowsNonzero ?? 0) + (pf[row] !== 0 ? 1 : 0);
        if (sidecarWords) { const sf = new Float32Array(sidecarWords.buffer); const srow = 12 + i * 2;
          k.kMin = Math.min(k.kMin ?? Infinity, sf[srow]); k.kMax = Math.max(k.kMax ?? -Infinity, sf[srow]);
          (k.sidecarStatus ??= {})[sidecarWords[srow + 1]] = ((k.sidecarStatus[sidecarWords[srow + 1]]) ?? 0) + 1; }
      }
    }
    // Contact interface receipt: per material pair, rows with positive /
    // negative / zero signed face area, and the summed positive area.
    const receiptWords = await readWords(G.receiptCopy);
    let interfacePairs = null;
    if (receiptWords && G.thermoCopy) {
      await G.thermoCopy.mapAsync(GPUMapMode.READ);
      const t = new Float32Array(G.thermoCopy.getMappedRange().slice(0)); G.thermoCopy.unmap();
      const rf = new Float32Array(receiptWords.buffer); const H = 22, rowBase = H + particles + 1;
      interfacePairs = { status: receiptWords[15], total: receiptWords[13] };
      // A failed-closed receipt leaves its offsets unwritten: bound every row
      // by the copied words, or a garbage [begin, end) spins this worker for
      // minutes and every later evaluate times out behind it.
      const rowCapacity = Math.floor((receiptWords.length - rowBase) / 2);
      for (let i = 0; i < particles; i++) {
        const begin = receiptWords[H + i], end = receiptWords[H + i + 1];
        if (!(begin <= end && end <= rowCapacity)) { interfacePairs.malformedRows = (interfacePairs.malformedRows ?? 0) + 1; continue; }
        for (let c = begin; c < end; c++) { const peer = receiptWords[rowBase + 2 * c], area = rf[rowBase + 2 * c + 1];
          const key = `${t[i * 12]}->${t[peer * 12]}`; const e = interfacePairs[key] ??= { rows: 0, positive: 0, negative: 0, zero: 0, areaM2: 0, maxAreaM2: 0 };
          e.rows++; if (area > 0) { e.positive++; e.areaM2 += area; e.maxAreaM2 = Math.max(e.maxAreaM2, area); } else if (area < 0) e.negative++; else e.zero++; }
      }
    }
    // Rows whose u lies outside their thermal derived [lower, upper] bound
    // (derived rows: 24 words after a 10-word header; words 6, 7 = bounds;
    // 15..22 the interface skin row).
    const derivedWords = await readWords(G.derivedCopy);
    let outsideDomain = null;
    if (derivedWords && G.thermoCopy) {
      await G.thermoCopy.mapAsync(GPUMapMode.READ);
      const t = new Float32Array(G.thermoCopy.getMappedRange().slice(0)); G.thermoCopy.unmap();
      const df = new Float32Array(derivedWords.buffer); outsideDomain = {};
      for (let i = 0; i < particles; i++) { const m = f[i * 8 + 3]; if (!(m > 0)) continue;
        const D = 24, lo = df[10 + i * D + 6], hi = df[10 + i * D + 7], u = f[i * 8 + 7];
        const stamp = derivedWords[10 + i * D + 19];
        if (stamp !== 0) { const key = `mat${t[i * 12]}/phase${t[i * 12 + 1]}->${stamp & 7}`;
          const sk = (G.skinRows ??= {})[key] ??= { rows: 0, energyJ: 0 }; sk.rows++; sk.energyJ += df[10 + i * D + 15]; }
        if (u < lo || u > hi) { const key = `mat${t[i * 12]}/phase${t[i * 12 + 1]}`;
          const o = outsideDomain[key] ??= { rows: 0, examples: [] }; o.rows++;
          if (o.examples.length < 3) o.examples.push({ row: i, u, lo, hi, T: t[i * 12 + 2] }); } }
    }
    // Rows with mass but phase 0, and every lane of their lineage.
    let phaseZero = null;
    if (G.dumpPhaseZero && G.thermoCopy) {
      await G.thermoCopy.mapAsync(GPUMapMode.READ);
      const t = new Float32Array(G.thermoCopy.getMappedRange().slice(0)); G.thermoCopy.unmap();
      phaseZero = [];
      for (let i = 0; i < particles && phaseZero.length < 4; i++) {
        if (!(f[i * 8 + 3] > 0) || Math.round(t[i * 12 + 1]) !== 0) continue;
        const lineage = i % stride;
        phaseZero.push({ row: i, lineage, lanes: [0, 1, 2, 3].map(l => { const r = l * stride + lineage;
          return { row: r, pos: Array.from(f.slice(r * 8, r * 8 + 3)).map(x => +x.toFixed(4)), m: f[r * 8 + 3], u: f[r * 8 + 7],
            thermo: Array.from(t.slice(r * 12, r * 12 + 8)) }; }) });
      }
    }
    const skinRows = G.skinRows ?? null; G.skinRows = null;
    return { particles, laneMassKg: mass, laneActive: count, laneMaxU: uMax, byKind, interfacePairs, outsideDomain, phaseZero, skinRows, transportScratchTail,
      proposalHeader: proposal ? Array.from(proposal.slice(0, 16)) : null,
      sidecarHeader: sidecarWords ? Array.from(sidecarWords.slice(0, 12)) : null };
  };
  G.readReceiptRing = async () => {
    // Prefer receipts copied at the reaction-ledger pass (the current step's).
    const ledgerRing = G.ledgerReceiptRing;
    const ring = ledgerRing?.used ? ledgerRing : G.proposalRing;
    const source = ledgerRing?.used ? ledgerRing.buffer : G.receiptRing;
    if (!source || !ring?.used) return null;
    await source.mapAsync(GPUMapMode.READ);
    const w = new Uint32Array(source.getMappedRange().slice(0, ring.used * 4 * 312));
    source.unmap();
    // Per step: the receipt with the newest generation id among the copied arenas.
    const names = { active: 8, direct: 32, spare: 33, merge: 34, fallback: 35, subthreshold: 36,
      noCarrier: 37, rejected: 38, unknown: 39, status: 47, terminal: 77 };
    const steps = [], totals = {}; let seen = new Set();
    for (let i = 0; i < ring.used; i++) {
      let best = null;
      for (let k = 0; k < 4; k++) { const b = (i * 4 + k) * 78; if (w[b] !== 0x52505039) continue;
        if (!best || w[b + 2] > w[best + 2]) best = b; }
      if (best == null || seen.has(w[best + 2])) continue;
      seen.add(w[best + 2]);
      const row = Object.fromEntries(Object.entries(names).map(([n, j]) => [n, w[best + j]]));
      row.generation = w[best + 2]; steps.push(row);
      for (const [n, v] of Object.entries(row)) if (!['status', 'terminal', 'generation'].includes(n)) totals[n] = (totals[n] ?? 0) + v;
      totals[`terminal${row.terminal}`] = (totals[`terminal${row.terminal}`] ?? 0) + 1;
      totals[`status${row.status}`] = (totals[`status${row.status}`] ?? 0) + 1;
    }
    return { receipts: G.receiptBuffers.map(r => r.label), uniqueSteps: steps.length, totals,
      firstActive: steps.filter(r => r.active > 0).slice(0, 12) };
  };
  G.readProposalRing = async () => {
    const ring = G.proposalRing;
    if (!ring?.used) return null;
    await ring.buffer.mapAsync(GPUMapMode.READ);
    const words = new Uint32Array(ring.buffer.getMappedRange().slice(0, ring.used * ring.slotBytes));
    ring.buffer.unmap();
    const W = ring.slotBytes / 4;
    const headers = Array.from({ length: ring.used }, (_, i) => Array.from(words.slice(i * W, i * W + 16)));
    const evidence = Array.from({ length: ring.used }, (_, i) => Array.from(words.slice(i * W + 16, (i + 1) * W)));
    // Distinct [particleCount, word6, word7, publishedRows] patterns, with
    // the step indices where each occurs.
    const patterns = {};
    headers.forEach((h, i) => { const key = [h[4], h[6], h[7], h[15]].join(',');
      (patterns[key] ??= []).push(i); });
    // Contact audit: per slot, graph failure/stage, the traversal evidence
    // counters that name a DIRECTORY_REJECT site, and the directory header.
    // Owner flags on failing slots: which particles stayed in the frontier.
    let ownerFlags = null;
    if (G.flagRing && !G.contactAudit) {
      await G.flagRing.mapAsync(GPUMapMode.READ);
      const fw = new Uint32Array(G.flagRing.getMappedRange().slice(0)); G.flagRing.unmap();
      const FW = 5 + 4096; ownerFlags = [];
      let thermo = null;
      if (G.thermoCopy) { await G.thermoCopy.mapAsync(GPUMapMode.READ);
        thermo = new Float32Array(G.thermoCopy.getMappedRange().slice(0)); G.thermoCopy.unmap(); }
      for (let i = 0; i < ring.used && ownerFlags.length < 12; i++) {
        const failure = words[i * W + 80 + 14];
        const prevFailure = i > 0 ? words[(i - 1) * W + 80 + 14] : 0;
        // Keep the first failing slots, the step before onset, and a late one.
        if (!(failure && (!prevFailure || ownerFlags.length < 3)) && !(i === ring.used - 1)) continue;
        const header = Array.from(fw.slice(i * FW, i * FW + 5));
        const flagged = [];
        for (let p = 0; p < 4096 && 5 + p < FW; p++) { const f = fw[i * FW + 5 + p]; if (f) flagged.push([p, f >>> 0]); }
        const kinds = {};
        for (const [p, f] of flagged) { const key = thermo ? `mat${thermo[p * 12]}/ph${thermo[p * 12 + 1]}` : 'na';
          const k = kinds[key] ??= { n: 0, contact: 0, frontier: 0, wall: 0, sample: [] }; k.n++;
          if (f & 0x80000000) k.contact++; if (f & 1) k.frontier++; if (f & 4) k.wall++; if (k.sample.length < 8) k.sample.push(p); }
        ownerFlags.push({ slot: i, failure, header, flaggedCount: flagged.length, kinds });
      }
    }
    const contact = G.contactAudit ? Array.from({ length: ring.used }, (_, i) => {
      const w = k => words[i * W + k];
      // Graph epochs (generation, storage generation, tick, substep, position,
      // topology, support) against the directory header's same fields.
      const graphEpochs = [2, 3, 4, 5, 6, 7, 8].map(k => w(80 + k));
      const dirEpochs = [3, 8, 9, 10, 11, 12, 15].map(k => w(276 + k));
      // Ordered-f32 residual words decode back to floats (sign-flipped order key).
      const ordered = k => { const u = w(80 + k) >>> 0; const bits = (u & 0x80000000) ? (u ^ 0x80000000) : (~u >>> 0);
        return new Float32Array(new Uint32Array([bits]).buffer)[0]; };
      const f32 = k => new Float32Array(new Uint32Array([w(80 + k) >>> 0]).buffer)[0];
      return { failure: w(80 + 14), stage: w(80 + 15), graphEpochs, dirEpochs,
        pairs: { required: w(80 + 12), published: w(80 + 13), appendAttempts: w(80 + 11), capacity: w(80 + 10) },
        residual: { position: ordered(27), velocity: ordered(28), rawPosition: w(80 + 27), rawVelocity: w(80 + 28) },
        energy: { pairKineticDeltaJ: f32(36), pairHeatJ: f32(37), wallHeatJ: f32(38), energyResidualJ: f32(39) },
        epochMismatch: graphEpochs.map((v, k) => v === dirEpochs[k] ? 0 : 1).join(''),
        dirIdentity: [0, 1, 4, 5, 6, 7, 13, 14].map(k => w(276 + k)),
        trav: Array.from(words.slice(i * W + 212, i * W + 260)),
        dir: { status: w(276 + 2), generation: w(276 + 3), tick: w(276 + 9), sources: w(276 + 16), sourceCap: w(276 + 17),
          cells: w(276 + 18), cellCap: w(276 + 19), invalid: w(276 + 23), overflow: w(276 + 24), build: w(276 + 33) },
        aggregate: Array.from(words.slice(i * W + 340, i * W + 356)),
        // unique: [generation, input, unique, admitted, overflow, keyWords, keyWords, status]
        unique: Array.from(words.slice(i * W + 452, i * W + 460)),
        // epoch: [invalid0, invalid1, emitted, assemblyOverflow, levelMaskLo, levelMaskHi, ...]
        epoch: Array.from(words.slice(i * W + 468, i * W + 476)),
        // ActiveSource view: [status, generation, tick, physCount, activeCount, dormant, invalid, overflow, buildOrdinal, completionOrdinal]
        // [invalid, nonfinite, dormant, classified, active, scatter, reverse, highWater, structural, geometry, unsupported]
        classifier: [0, 1, 2].map(k => Array.from(words.slice(i * W + 604 + 12 * k, i * W + 615 + 12 * k))),
        activeViews: [0, 1, 2].map(k => { const b = i * W + 484 + 40 * k, v = j => words[b + j];
          return [v(2), v(3), v(9), v(16), v(18), v(20), v(21), v(22), v(29), v(30)]; }) };
    }) : null;
    // Source rows the classifier would reject (16 floats per row).
    let invalidRows = null;
    if (G.contactAudit && G.sourceRowsCopy) {
      await G.sourceRowsCopy.mapAsync(GPUMapMode.READ);
      const f = new Float32Array(G.sourceRowsCopy.getMappedRange().slice(0)); G.sourceRowsCopy.unmap();
      invalidRows = [];
      const physical = contact?.at(-1)?.activeViews?.[0]?.[3] || f.length / 16;
      for (let r = 0; r < physical && r * 16 < f.length && invalidRows.length < 16; r++) {
        const row = Array.from(f.slice(r * 16, r * 16 + 16));
        const [level, spacing, support, repV, restV, curV, mass, rho] = row;
        const dormant = [support, repV, restV, curV, mass].every(v => Object.is(v, 0));
        const active = mass > 0 && support >= 0 && repV >= 0 && restV > 0 && curV > 0 && rho > 0;
        const finite = row.every(Number.isFinite);
        if (!finite || (!active && !dormant) || !(spacing > 0) || ((row[10] & 31) === 0)) invalidRows.push({ r, row });
      }
      // Source rows of the traced rows (and their level histogram by phase).
      invalidRows.traced = (G.traceRows ?? []).map(r => ({ r, row: Array.from(f.slice(r * 16, r * 16 + 16)) }));
      const levelsByPhase = {};
      for (let r = 0; r < physical && r * 16 < f.length; r++) {
        const row = f.slice(r * 16, r * 16 + 16); if (!(row[6] > 0)) continue;
        const key = `L${row[0]}`; levelsByPhase[key] = (levelsByPhase[key] ?? 0) + 1;
      }
      invalidRows.levels = levelsByPhase;
    }
    const rowTrace = G.traceRows?.length ? Array.from({ length: ring.used }, (_, i) => G.traceRows.map((row, k) => {
      const f = new Float32Array(words.buffer.slice((i * W + 700 + 20 * k) * 4, (i * W + 720 + 20 * k) * 4));
      return { row, m: f[3], pos: [f[0], f[1], f[2]], v: [f[4], f[5], f[6]], u: f[7], material: f[8], phase: f[9], T: f[10] };
    })) : null;
    let fvTransitions = null;
    if (G.fvTrace?.length && G.fvTraceBuffer) {
      await G.fvTraceBuffer.mapAsync(GPUMapMode.READ);
      const w = new Uint32Array(G.fvTraceBuffer.getMappedRange().slice(0)); G.fvTraceBuffer.unmap();
      fvTransitions = []; const last = new Map();
      G.fvTrace.forEach((meta, i) => {
        const key = meta.buffer;
        if (/gas-pressure-boundary-scratch$/.test(key)) {
          // Boundary scratch: failure word 2, validated count 8, seals 9/10,
          // row-0 status word (12 + 10) carries the source reject reason.
          const sig = [2, 8, 9, 10].map(k => w[i * 64 + k]).concat([w[i * 64 + 22]]).join(',');
          const prevSig = last.get(key)?.sig;
          if (sig !== prevSig) fvTransitions.push({ i, slot: meta.slot, pass: meta.pass.slice(0, 80), binding: meta.binding, buffer: key,
            scratch: { failure: w[i * 64 + 2], validated: w[i * 64 + 8], fieldSeal: w[i * 64 + 9].toString(16), sourceSeal: w[i * 64 + 10].toString(16),
              row0: Array.from(w.slice(i * 64 + 12, i * 64 + 24)).map(x => x.toString(16)) }, status: -1, count: -1, tick: -1 });
          last.set(key, { sig });
          return;
        }
        const status = w[i * 64 + 2], count = w[i * 64 + 34], tick = w[i * 64 + 9];
        const prev = last.get(key);
        if (!prev || prev.status !== status || prev.tick !== tick) {
          fvTransitions.push({ i, slot: meta.slot, pass: meta.pass.slice(0, 80), binding: meta.binding, buffer: key, status, count, tick,
            w57: w[i * 64 + 57], w59: w[i * 64 + 59], w63: w[i * 64 + 63] });
        }
        last.set(key, { status, tick });
      });
      fvTransitions = fvTransitions.slice(0, 400);
    }
    let passTrace = null;
    if (G.passTrace?.length && G.passTraceBuffer) {
      await G.passTraceBuffer.mapAsync(GPUMapMode.READ);
      const f = new Float32Array(G.passTraceBuffer.getMappedRange().slice(0)); G.passTraceBuffer.unmap();
      passTrace = G.passTrace.map((meta, i) => ({ ...meta, values: Array.from(f.slice(i * 16, i * 16 + (meta.kind === 'state' ? 8 : 12))) }));
    }
    const contactFailureSeq = Array.from({ length: ring.used }, (_, i) => (words[i * W + 80 + 14] ? 'F' : '.')).join('');
    return { count: ring.used, fvTransitions, contact, ownerFlags, contactFailureSeq, invalidRows, tracedSourceRows: invalidRows?.traced ?? null, sourceLevels: invalidRows?.levels ?? null, rowTrace, passTrace, probeErrors: G.probeErrors ?? [], activeViewSourceLabel: G.activeViewSourceLabel ?? null,
      activeViewLabels: (G.activeSourceViews ?? []).map(v => v.label),
      published: headers.filter(h => h[15] === h[4]).length,
      patterns: Object.fromEntries(Object.entries(patterns).map(([k, steps]) => [k, { n: steps.length,
        steps: steps.slice(0, 60), firstHeader: headers[steps[0]], firstEvidence: evidence[steps[0]],
        lastEvidence: evidence[steps.at(-1)] }])),
      // Raw slot words for the steps around a header-pattern change.
      raw: Object.fromEntries(headers.map((h, i) => [i, h]).filter(([i]) => i > 0
        && headers[i][15] !== headers[i - 1][15] || (i + 1 < headers.length && headers[i][15] !== headers[i + 1][15]))
        .flatMap(([i]) => [i - 1, i].filter(j => j >= 0)).map(j => [j, Array.from(words.slice(j * W, (j + 1) * W))])) };
  };
  G.readLedger = async () => {
    const out = { cold: G.ledgerCold, latest: {} };
    for (const [label, entries] of Object.entries(G.ledgerLatest)) {
      out.latest[label] = [];
      for (const { buffer, device } of entries) {
        try {
          device.pushErrorScope('validation');
          const copy = device.createBuffer({ size: buffer.size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
          const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(buffer, 0, copy, 0, buffer.size);
          device.queue.submit([encoder.finish()]);
          const scope = await device.popErrorScope();
          if (scope) { out.latest[label].push({ error: String(scope.message).slice(0, 200) }); copy.destroy(); continue; }
          await copy.mapAsync(GPUMapMode.READ);
          out.latest[label].push(Array.from(new Uint32Array(copy.getMappedRange().slice(0)))); copy.unmap(); copy.destroy();
        } catch (error) { out.latest[label].push({ error: String(error?.message ?? error).slice(0, 200) }); }
      }
    }
    return out;
  };
  G.reset = () => { for (const e of G.devices) e.c = fresh(); G.traces = []; G.traceDrops = 0; G.ledgerLabels = {}; };
  G.snapshot = () => ({ devices: G.devices.map(e => ({ lost: e.lost ?? null, counters: { ...e.c } })),
    traces: G.traces, traceDrops: G.traceDrops, ledgerLabels: G.ledgerLabels, gpuErrors: G.gpuErrors ?? [] });
};

const appRow = () => {
  const overlay = document.querySelector('#sph-phase-overlay');
  const lane = overlay?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  // Any error-like text the scene publishes on the overlay (diagnostics only).
  const errorText = (() => {
    const out = [];
    for (const key of Object.keys(overlay ?? {})) {
      if (!key.startsWith('__')) continue;
      try {
        const text = JSON.stringify(overlay[key], (k, v) => (typeof v === 'object' && v && Object.keys(v).length > 200) ? '[big]' : v);
        for (const m of (text ?? '').matchAll(/"[^"]*(?:[Ee]rror|[Ff]ail|reject)[^"]*"\s*:\s*"([^"]{8,400})"/g)) out.push(`${key}: ${m[1]}`);
      } catch {}
    }
    return out.slice(0, 6);
  })();
  return {
    errorText,
    fps: document.querySelector('#sph-fps')?.textContent ?? '',
    play: document.querySelector('#sph-play')?.textContent ?? '',
    rebuild: overlay?.__sphPhaseRebuildWorker?.status ?? null,
    laneSteps: lane?.laneCompletedStepTotal ?? null,
    laneSimTimeS: lane?.laneSimTimeS ?? null,
    scheduleId: lane?.scheduleId ?? null
  };
};
const simT = fps => Number(fps.match(/sim t ([0-9.]+)s/)?.[1] ?? NaN);

const HEADER_WORDS = SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS;
const SNAPSHOT_WORDS = HEADER_WORDS + SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS;
const REJECTED = SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_CAPACITY_OVERFLOW;
const READY_ADMITTED = SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED;
const f32 = bits => new Float32Array(new Uint32Array([bits]).buffer)[0];
const decode = (words, layout, start) => Object.fromEntries(layout.map((field, index) => {
  const [name, type = 'u32'] = field.split(':');
  const bits = words[start + index] >>> 0;
  return [name, type === 'f32-bits' ? f32(bits) : type === 'i32-bits' ? (bits | 0) : bits];
}));

// One verdict per traced step, from the post-finalize (terminal) snapshot.
function summarizeTraces(traces) {
  const field = traces.filter(t => t.label.includes('field') && t.words.length >= 2 * SNAPSHOT_WORDS);
  const steps = field.map(t => {
    const pre = decode(t.words, SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT, 0);
    const header = decode(t.words, SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT, SNAPSHOT_WORDS);
    const receipt = decode(t.words, SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT, SNAPSHOT_WORDS + HEADER_WORDS);
    return {
      physicsTick: header.physicsTick, physicsSubstep: header.physicsSubstep, positionEpoch: header.positionEpoch,
      preStatus: pre.statusFlags, status: header.statusFlags, receiptStatus: receipt.statusFlags,
      // Single-level: receipt word 4 holds field_receipt_reject_reason's code.
      rejectReason: receipt.macroSubstepOrdinal, receiptPhase: receipt.phase,
      header58: [t.words[58] >>> 0, t.words[SNAPSHOT_WORDS + 58] >>> 0], header59: [t.words[59] >>> 0, t.words[SNAPSHOT_WORDS + 59] >>> 0],
      prePressureStatus: decode(t.words, SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT, HEADER_WORDS).pressureStatusFlags,
      preRejectReason: decode(t.words, SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT, HEADER_WORDS).macroSubstepOrdinal,
      rolledBack: (header.statusFlags & REJECTED) !== 0,
      admitted: (header.statusFlags & READY_ADMITTED) === READY_ADMITTED && (header.statusFlags & REJECTED) === 0,
      sourceCount: header.sourceCount, fieldCount: header.fieldCount, invalidSourceCount: header.invalidSourceCount,
      clippedCandidateCount: header.clippedCandidateCount, overflowCount: header.overflowCount,
      maxFineCflRatio: receipt.maxFineCflRatio, partitionOfUnityResidual: receipt.partitionOfUnityResidual
    };
  });
  const finite = values => values.filter(Number.isFinite);
  const cfl = finite(steps.map(s => s.maxFineCflRatio));
  const ticks = steps.map(s => s.physicsTick);
  return {
    tracedSteps: steps.length,
    denseTraces: traces.length - field.length,
    rolledBack: steps.filter(s => s.rolledBack).length,
    admitted: steps.filter(s => s.admitted).length,
    neither: steps.filter(s => !s.rolledBack && !s.admitted).length,
    statusHistogram: steps.reduce((h, s) => { h[s.status] = (h[s.status] || 0) + 1; return h; }, {}),
    rejectReasonHistogram: steps.filter(s => s.rolledBack).reduce((h, s) => { const k = `${s.preRejectReason}/${s.rejectReason}`; h[k] = (h[k] || 0) + 1; return h; }, {}),
    headerDiagHistogram: steps.filter(s => s.rolledBack).reduce((h, s) => { const k = `${s.header58.join(',')}|${s.header59.join(',')}`; h[k] = (h[k] || 0) + 1; return h; }, {}),
    tickRange: ticks.length ? [Math.min(...ticks), Math.max(...ticks)] : null,
    maxFineCflRatio: cfl.length ? { min: Math.min(...cfl), max: Math.max(...cfl) } : null,
    invalidSourceTotal: steps.reduce((sum, s) => sum + s.invalidSourceCount, 0),
    overflowTotal: steps.reduce((sum, s) => sum + s.overflowCount, 0),
    first: steps.slice(0, 3),
    firstRolledBack: steps.find(s => s.rolledBack) ?? null
  };
}

let browser;
try {
  await mkdir(outDir, { recursive: true });
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: process.env.ULG_HEADED !== '1',
    args: [...(process.env.ULG_HEADED === '1' ? ['--ozone-platform=wayland'] : []), '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-webgpu-developer-features',
      // S0_CHROME_ARGS: extra flags for diagnostic A/Bs (space-separated).
      ...String(process.env.S0_CHROME_ARGS || '').split(/\s+/).filter(Boolean)] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.addInitScript(hook, hookOptions);
  const workers = [];
  page.on('worker', worker => { workers.push(worker); evidence.workers.push(worker.url());
    // S0_FORCE_INDIRECT=1: keep A1's direct-launch conversions on their
    // indirect launches (throughput A/B; scripts/a1-ab-check.mjs checks exactness).
    if (process.env.S0_FORCE_INDIRECT === '1') worker.evaluate(() => { globalThis.__ulgForceIndirectFieldConsumers = true; }).catch(() => {});
    // S0_WORKER_GLOBALS: a JSON object of worker globals (diagnostic overrides).
    if (process.env.S0_WORKER_GLOBALS) {
      worker.evaluate((globals) => Object.assign(globalThis, globals), JSON.parse(process.env.S0_WORKER_GLOBALS)).catch(() => {});
    }
    void worker.evaluate(hook, hookOptions).catch(error => evidence.errors.push(`hook ${String(error).slice(0, 200)}`)); });
  page.on('pageerror', error => evidence.errors.push(String(error).slice(0, 400)));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) evidence.console.push(message.text().slice(0, 400));
  });
  const contexts = () => [{ name: 'page', target: page },
    ...workers.map(worker => ({ name: worker.url().split('/').pop().split('?')[0], target: worker }))];
  // A busy or wedged worker must not hang the audit: bound every context.
  const inAll = async (fn, timeoutMs = 60000) => {
    const out = [];
    // PeerCompute compute workers hold no simulation device.
    for (const { name, target } of contexts().filter(c => !c.name.startsWith('computeWorker'))) {
      let timer;
      const value = await Promise.race([target.evaluate(fn).catch(() => null),
        new Promise(resolve => { timer = setTimeout(() => { evidence.errors.push(`evaluate timeout ${name}`); resolve(null); }, timeoutMs); })]);
      clearTimeout(timer);
      if (value) out.push({ context: name, value });
    }
    return out;
  };
  const sample = async phase => {
    const row = { phase, at: (Date.now() - started.getTime()) / 1000, ...(await page.evaluate(appRow)) };
    row.simTimeS = simT(row.fps);
    evidence.samples.push(row);
    return row;
  };
  // S0_INIT_GLOBALS: a JSON object of page globals set before the app loads (diagnostics).
  if (process.env.S0_INIT_GLOBALS) {
    await page.addInitScript(globals => Object.assign(globalThis, globals), JSON.parse(process.env.S0_INIT_GLOBALS));
  }
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // S0_WARMUP_S: cold two-level pipelines can take longer than the default
  // 240 s to reach the first step in a fresh browser profile.
  const warmupIterations = Math.max(1, Math.round(Number(process.env.S0_WARMUP_S || 240) / 2));
  for (let i = 0; i < warmupIterations; i++) {
    await page.waitForTimeout(2000);
    const row = await sample('warmup');
    console.log(JSON.stringify({ warmup: row.at.toFixed(0), rebuild: row.rebuild, play: row.play, simTimeS: row.simTimeS,
      laneSteps: row.laneSteps }));
    if (!evidence.playClickedAt && row.rebuild === 'complete' && row.play === 'Play') {
      await page.locator('#sph-play').click({ timeout: 5000 }); evidence.playClickedAt = row.at;
    }
    if (row.laneSteps > 0 || row.simTimeS > 0.002) break;
  }
  if (!(evidence.samples.at(-1).laneSteps > 0 || evidence.samples.at(-1).simTimeS > 0)) {
    // Read any two-level reflux rejection the worker recorded before failing.
    const rejection = (await inAll(() => globalThis.__ulgTwoLevelRefluxRejection ?? null, 20000))
      .filter((entry) => entry.value);
    console.log(JSON.stringify({ twoLevelRefluxRejection: rejection }));
    const workspaceHeaders = (await inAll(() => globalThis.__s0?.readWorkspaceHeaders?.() ?? null, 30000))
      .filter((entry) => entry.value && entry.value.length);
    console.log(JSON.stringify({ workspaceHeaders }));
    const workspaceTimeline = (await inAll(() => globalThis.__s0?.readWorkspaceTimeline?.() ?? null, 30000))
      .filter((entry) => entry.value);
    console.log(JSON.stringify({ workspaceTimeline }));
    const passStatus = (await inAll(() => globalThis.__s0?.readPassStatus?.() ?? null, 30000)).filter((entry) => entry.value);
    console.log(JSON.stringify({ passStatus }));
    const earlyTraces = (await inAll(() => globalThis.__s0?.snapshot?.()?.traces ?? null, 30000))
      .filter((entry) => entry.value && entry.value.length);
    for (const entry of earlyTraces) {
      console.log(JSON.stringify({ earlyAuthority: { context: entry.context, summary: summarizeTraces(entry.value) } }));
    }
    evidence.twoLevelRefluxRejection = rejection;
    throw new Error('The app never started stepping');
  }
  await page.waitForTimeout(10_000);
  await inAll(() => { globalThis.__s0.reset(); globalThis.__s0.counting = true; return true; });
  // S0_PASS_CENSUS=1 (with &residentGpuTimestampProfile=1): per-pass GPU
  // times by label over the window (src/runtime/sph/sphPassTimestampCensus.js).
  if (process.env.S0_PASS_CENSUS === '1') {
    evidence.passCensusArm = await inAll(() => globalThis.__ulgArmPassTimestampCensus?.()?.status ?? null);
    console.log(JSON.stringify({ passCensusArm: evidence.passCensusArm }));
  }
  // S0_CPU_PROFILE=<seconds>: a V8 CPU profile of the render worker (or the
  // first worker matching S0_CPU_PROFILE_WORKER) over the start of the window,
  // via the page CDP session (auto-attach, non-flattened target messages).
  // S0_RESIDENT_PERF=1: record every resident schedule's page-side timings
  // (__sphResidentPerf: compute, whole cycle, post-compute) over the window.
  if (process.env.S0_RESIDENT_PERF === '1') {
    await page.evaluate(() => {
      const overlay = document.querySelector('#sph-phase-overlay');
      globalThis.__s0PerfRing = [];
      let last = null;
      globalThis.__s0PerfTimer = setInterval(() => {
        const perf = overlay?.__sphResidentPerf;
        if (!perf || perf.updatedAtMs === last) return;
        last = perf.updatedAtMs;
        globalThis.__s0PerfRing.push({ t: perf.updatedAtMs, computeMs: perf.lastResidentMs ?? null,
          cycleMs: perf.lastResidentCycleMs ?? null, postMs: perf.lastResidentPostComputeMs ?? null });
      }, 20);
    });
  }
  // S0_SCHEDULE_TRACE=1: where a schedule's wall time goes on the page. Records
  // the mount's schedule trace (scheduled, refresh-invoked, refresh-settled,
  // published, presentation gate) and the scene's workerLanePageTiming stamps
  // for every schedule in the window, on the page clock. No GPU work.
  if (process.env.S0_SCHEDULE_TRACE === '1') {
    await page.evaluate(() => {
      const overlay = document.querySelector('#sph-phase-overlay');
      const seen = new WeakSet();
      const log = globalThis.__s0ScheduleTrace = { events: [], lanes: [] };
      let lastLaneSchedule = null;
      globalThis.__s0ScheduleTraceTimer = setInterval(() => {
        for (const event of overlay?.__sphResidentScheduleTrace ?? []) {
          if (seen.has(event)) continue;
          seen.add(event);
          log.events.push([event.scheduleToken, event.stage, event.atMs]);
        }
        const lane = overlay?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
        if (lane?.workerLanePageTiming && lane.scheduleId !== lastLaneSchedule) {
          lastLaneSchedule = lane.scheduleId;
          log.lanes.push({ ...lane.workerLanePageTiming });
        }
      }, 25);
    });
  }
  const cpuProfileSeconds = Number(process.env.S0_CPU_PROFILE || 0);
  let cpuProfileDone = null;
  if (cpuProfileSeconds > 0) {
    const cdp = await context.newCDPSession(page);
    const pattern = new RegExp(process.env.S0_CPU_PROFILE_WORKER || 'ulgOffscreenRender');
    const sessions = [];
    const pending = new Map(); let nextId = 1;
    cdp.on('Target.attachedToTarget', (event) => {
      if (event.targetInfo.type === 'worker' && pattern.test(event.targetInfo.url)) sessions.push(event.sessionId);
    });
    const heapChunks = [];
    cdp.on('Target.receivedMessageFromTarget', (event) => {
      const message = JSON.parse(event.message);
      if (message.method === 'HeapProfiler.addHeapSnapshotChunk') { heapChunks.push(message.params.chunk); return; }
      if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    });
    const send = (sessionId, method, params = {}) => sessionId === 'page'
      ? cdp.send(method, params).then(result => ({ result }))
      : new Promise((resolve) => {
      const id = nextId++; pending.set(id, resolve);
      cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(() => {});
    });
    const profilePage = process.env.S0_CPU_PROFILE_WORKER === 'page';
    if (!profilePage) {
      await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: false });
      await page.waitForTimeout(500);
    }
    // The page's own main thread: the same calls on the page session.
    const sessionId = profilePage ? 'page' : sessions[0];
    if (profilePage) {
      const direct = send;
      // eslint-disable-next-line no-func-assign
      Object.assign(globalThis, { __s0PageSend: (method, params = {}) => cdp.send(method, params).then(result => ({ result })) });
    }
    const heapGap = Number(process.env.S0_HEAP_SNAPSHOTS || 0);
    if (sessionId && heapGap > 0) {
      cpuProfileDone = (async () => {
        const take = async (name) => {
          heapChunks.length = 0;
          await send(sessionId, 'HeapProfiler.enable');
          await send(sessionId, 'HeapProfiler.collectGarbage');
          await send(sessionId, 'HeapProfiler.takeHeapSnapshot', { reportProgress: false });
          const path = join(outDir, `${tag}-${name}.heapsnapshot`);
          await writeFile(path, heapChunks.join(''));
          return path;
        };
        const first = await take('a');
        await page.waitForTimeout(heapGap * 1000);
        const second = await take('b');
        return { heapSnapshots: [first, second] };
      })();
    } else if (sessionId) {
      // S0_CPU_PROFILE_DELAY=<seconds>: start the profile after the cold
      // start (pipeline compiles), so it samples the steady state.
      const profileDelayMs = Math.max(0, Number(process.env.S0_CPU_PROFILE_DELAY || 0)) * 1000;
      await send(sessionId, 'Profiler.enable');
      await send(sessionId, 'Profiler.setSamplingInterval', { interval: 200 });
      if (profileDelayMs > 0) await page.waitForTimeout(profileDelayMs);
      await send(sessionId, 'Profiler.start');
      cpuProfileDone = (async () => {
        await page.waitForTimeout(cpuProfileSeconds * 1000);
        const reply = await send(sessionId, 'Profiler.stop');
        const profile = reply.result?.profile;
        if (!profile) return { error: 'no profile' };
        await writeFile(join(outDir, `${tag}.cpuprofile`), JSON.stringify(profile));
        // Self time per function (samples x interval), and per URL file.
        const byId = new Map(profile.nodes.map(node => [node.id, node]));
        const counts = new Map(); for (const id of profile.samples) counts.set(id, (counts.get(id) ?? 0) + 1);
        const totalSamples = profile.samples.length;
        const self = new Map(); const files = new Map();
        for (const [id, count] of counts) {
          const frame = byId.get(id)?.callFrame ?? {};
          const file = String(frame.url || '').replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '') || '(native)';
          const key = `${frame.functionName || '(anon)'} ${file}:${frame.lineNumber + 1}`;
          self.set(key, (self.get(key) ?? 0) + count); files.set(file, (files.get(file) ?? 0) + count);
        }
        const pct = n => +(100 * n / totalSamples).toFixed(2);
        return { totalSamples, topSelf: [...self].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, n]) => [pct(n), k]),
          byFile: [...files].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => [pct(n), k]) };
      })();
    } else {
      cpuProfileDone = Promise.resolve({ error: 'no matching worker target', seen: sessions.length });
    }
  }
  const begin = await sample('window-begin'); const t0 = Date.now();
  // S0_UNTIL_SIM_S ends the window at a simulated time, for same-time comparisons.
  const untilSimS = Number(process.env.S0_UNTIL_SIM_S || NaN);
  // S0_FRAME_SAMPLE=1: screenshot every 250 ms and hash it, so the window also
  // measures whether the display keeps updating (distinct frames, longest
  // static stretch). Meaningful headed; headless screenshots may not show
  // the worker's canvas.
  const frameSampling = process.env.S0_FRAME_SAMPLE === '1';
  const frames = { samples: 0, distinct: 0, maxStaticMs: 0, lastHash: null, staticSinceMs: null };
  const sampleFrame = async () => {
    const shot = await page.screenshot({ type: 'jpeg', quality: 40 }).catch(() => null);
    if (!shot) return;
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha1').update(shot).digest('hex');
    const now = Date.now();
    frames.samples += 1;
    if (hash !== frames.lastHash) {
      frames.distinct += 1;
      frames.lastHash = hash;
      frames.staticSinceMs = now;
    } else if (frames.staticSinceMs != null) {
      frames.maxStaticMs = Math.max(frames.maxStaticMs, now - frames.staticSinceMs);
    }
  };
  while (Date.now() - t0 < windowMs) {
    if (frameSampling) {
      const sliceStart = Date.now();
      while (Date.now() - sliceStart < 2000) { await sampleFrame(); await page.waitForTimeout(250); }
    } else {
      await page.waitForTimeout(2000);
    }
    if ((await sample('window')).simTimeS >= untilSimS) break;
  }
  if (frameSampling) {
    evidence.frameSampling = { samples: frames.samples, distinct: frames.distinct,
      distinctFraction: frames.samples ? +(frames.distinct / frames.samples).toFixed(3) : null,
      maxStaticMs: frames.maxStaticMs };
    console.log(JSON.stringify({ frameSampling: evidence.frameSampling }));
  }
  await inAll(() => { globalThis.__s0.counting = false; return true; });
  const end = await sample('window-end');
  if (process.env.S0_PASS_TIMING === '1') {
    evidence.passTiming = (await inAll(() => globalThis.__s0?.readPassTiming?.() ?? null)).filter(entry => entry.value);
    console.log(JSON.stringify({ passTiming: evidence.passTiming }));
  }
  if (process.env.S0_TIMELINE === '1') {
    const timelines = (await inAll(() => globalThis.__s0?.readSubmitTimeline?.() ?? null)).filter(entry => entry.value);
    for (const { context, value } of timelines) {
      // Gaps between consecutive simulation submits, binned.
      const sim = value.filter(([, kind]) => kind === 's').map(([t]) => t);
      const gaps = sim.slice(1).map((t, i) => t - sim[i]);
      const bins = [0.5, 1, 2, 4, 8, 16, 32, 64, 128, Infinity];
      const hist = bins.map(() => [0, 0]);
      for (const gap of gaps) { const b = bins.findIndex(edge => gap <= edge); hist[b][0]++; hist[b][1] += gap; }
      const span = sim.length > 1 ? sim[sim.length - 1] - sim[0] : 0;
      evidence.submitTimeline = { context, simSubmits: sim.length, presentSubmits: value.length - sim.length, spanMs: span,
        gapHistogram: bins.map((edge, i) => ({ leMs: edge, count: hist[i][0], totalMs: +hist[i][1].toFixed(1) })) };
      console.log(JSON.stringify({ submitTimeline: evidence.submitTimeline }));
    }
  }
  if (process.env.S0_RESIDENT_PERF === '1') {
    const ring = await page.evaluate(() => { clearInterval(globalThis.__s0PerfTimer); return globalThis.__s0PerfRing; });
    const stat = (key) => {
      const v = ring.map((row) => row[key]).filter((x) => Number.isFinite(x)).sort((l, r) => l - r);
      return v.length ? { n: v.length, median: +v[Math.floor(v.length / 2)].toFixed(1),
        p90: +v[Math.floor(0.9 * (v.length - 1))].toFixed(1), mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) } : null;
    };
    const starts = ring.map((row) => row.t);
    const intervals = starts.slice(1).map((t, i) => t - starts[i]).sort((l, r) => l - r);
    evidence.residentPerf = { samples: ring.length, compute: stat('computeMs'), cycle: stat('cycleMs'), post: stat('postMs'),
      updateIntervalMedianMs: intervals.length ? +intervals[Math.floor(intervals.length / 2)].toFixed(1) : null };
    console.log(JSON.stringify({ residentPerf: evidence.residentPerf }));
  }
  if (process.env.S0_SCHEDULE_TRACE === '1') {
    const log = await page.evaluate(() => { clearInterval(globalThis.__s0ScheduleTraceTimer); return globalThis.__s0ScheduleTrace; });
    const stat = (values) => {
      const v = values.filter((x) => Number.isFinite(x)).sort((l, r) => l - r);
      return v.length ? { n: v.length, median: +v[Math.floor(v.length / 2)].toFixed(1),
        p90: +v[Math.floor(0.9 * (v.length - 1))].toFixed(1), mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) } : null;
    };
    const span = (from, to) => (Number.isFinite(from) && Number.isFinite(to) ? to - from : null);
    // One record per schedule token: first stamp of each stage, and the last stamp of any stage.
    const byToken = new Map();
    for (const [token, stage, atMs] of log.events) {
      let record = byToken.get(token);
      if (!record) { record = { stages: {}, lastAtMs: atMs }; byToken.set(token, record); }
      record.stages[stage] ??= atMs;
      record.lastAtMs = Math.max(record.lastAtMs, atMs);
    }
    const schedules = [...byToken.values()].filter((record) => record.stages.scheduled != null)
      .sort((l, r) => l.stages.scheduled - r.stages.scheduled);
    const rows = [];
    for (let i = 0; i + 1 < schedules.length; i++) {
      const stages = schedules[i].stages, next = schedules[i + 1].stages;
      const invoked = stages['refresh-invoked'], settled = stages['refresh-settled'];
      if (invoked == null || settled == null) continue;
      // The scene's stamps for the same schedule: its entry lies inside the mount's compute span.
      const lane = log.lanes.find((entry) => entry.scheduleFunctionEnteredAtMs >= invoked - 1
        && entry.scheduleFunctionEnteredAtMs <= settled) ?? {};
      rows.push({
        cycle: span(stages.scheduled, next.scheduled),
        mountPrelude: span(stages.scheduled, invoked),
        compute: span(invoked, settled),
        pagePrepare: span(lane.scheduleFunctionEnteredAtMs, lane.scheduleDispatchPostedAtMs),
        workerSchedule: span(lane.scheduleDispatchPostedAtMs, lane.scheduleTerminalReceivedAtMs),
        authorityCommit: span(lane.scheduleTerminalReceivedAtMs, lane.authorityCommitCompletedAtMs),
        committedPresentationWait: span(lane.presentationAdmissionPostedAtMs, lane.presentationTerminalReceivedAtMs),
        returnToMount: span(lane.presentationTerminalReceivedAtMs ?? lane.authorityCommitCompletedAtMs, settled),
        mountPostCompute: span(settled, schedules[i].lastAtMs),
        tailToNextSchedule: span(schedules[i].lastAtMs, next.scheduled),
        computeEndToNextSchedule: span(settled, next.scheduled)
      });
    }
    const keys = rows.length ? Object.keys(rows[0]) : [];
    // The lane loop's own clock (worker): step cost, and the gap between a
    // schedule's last step ending and the next schedule's first step starting.
    const ring = (await inAll(() => globalThis.__ulgLaneStepTiming ?? null, 20000))
      .map((entry) => entry.value).find((value) => Array.isArray(value) && value.length) ?? [];
    const withinGap = [], betweenGap = [], firstStepMs = [], laterStepMs = [], yieldWaitMs = [];
    const epochStageMs = [], mechanicsStageMs = [];
    for (let i = 1; i < ring.length; i++) {
      const previous = ring[i - 1], current = ring[i];
      const sameSchedule = current.scheduleId === previous.scheduleId;
      (sameSchedule ? withinGap : betweenGap).push(
        current.stepStartedAtMs - (previous.stepStartedAtMs + previous.stepElapsedMs));
      (sameSchedule ? laterStepMs : firstStepMs).push(current.stepElapsedMs);
      yieldWaitMs.push(current.yieldWaitMs);
      epochStageMs.push(current.epochStageElapsedMs);
      mechanicsStageMs.push(current.mechanicsStageElapsedMs);
    }
    evidence.scheduleTrace = {
      schedules: rows.length, stagesSeen: [...new Set(log.events.map(([, stage]) => stage))],
      pageMs: Object.fromEntries(keys.map((key) => [key, stat(rows.map((row) => row[key]))])),
      workerLaneMs: { ringSteps: ring.length, laterStep: stat(laterStepMs), firstStepOfSchedule: stat(firstStepMs),
        epochStage: stat(epochStageMs), mechanicsStage: stat(mechanicsStageMs),
        gapWithinSchedule: stat(withinGap), gapBetweenSchedules: stat(betweenGap), yieldWait: stat(yieldWaitMs) },
      // Per step: [ordinal, start, step, epoch stage, mechanics stage, yield wait], ms on the worker clock.
      laneRing: ring.map((row) => [row.stepOrdinal, row.stepStartedAtMs, row.stepElapsedMs, row.epochStageElapsedMs,
        row.mechanicsStageElapsedMs, row.yieldWaitMs].map((value) => (Number.isFinite(value) ? +value.toFixed(1) : null))),
      rows: rows.slice(-24).map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) =>
        [key, value == null ? null : +value.toFixed(1)])))
    };
    console.log(JSON.stringify({ scheduleTrace: { ...evidence.scheduleTrace, rows: undefined, laneRing: undefined } }));
  }
  if (cpuProfileDone) {
    evidence.cpuProfile = await cpuProfileDone;
    console.log(JSON.stringify({ cpuProfile: evidence.cpuProfile }));
  }
  if (process.env.S0_PROPOSAL_AUDIT === '1') {
    if ((await page.evaluate(appRow)).play === 'Pause') await page.locator('#sph-play').click({ timeout: 5000 });
    await page.waitForTimeout(8000);
    evidence.proposalAudit = (await inAll(() => globalThis.__s0.readProposalRing())).filter(entry => entry.value);
    evidence.stateLanes = (await inAll(() => globalThis.__s0.readStateLanes())).filter(entry => entry.value);
    evidence.receiptAudit = (await inAll(() => globalThis.__s0.readReceiptRing())).filter(entry => entry.value);
    console.log(JSON.stringify({ receiptAudit: evidence.receiptAudit.map(entry => entry.value) }));
    console.log(JSON.stringify({ stateLanes: evidence.stateLanes.map(entry => entry.value) }));
    console.log(JSON.stringify({ proposalAudit: evidence.proposalAudit.map(entry => entry.value) }));
  }
  // Ambient boundary condition actually resolved by the scene (and buoyancy).
  evidence.ambient = await page.evaluate(() => {
    const out = {}; const seen = new Set();
    const walk = (value, path, depth) => {
      if (!value || typeof value !== 'object' || depth > 7 || seen.has(value) || Object.keys(out).length > 200) return;
      seen.add(value);
      for (const [key, child] of Object.entries(value)) {
        if (/ambient|buoyancy|phaseVolume|transport|drag|slip|gasFraction|sidecar/i.test(key) && (child === null || ['number', 'string', 'boolean'].includes(typeof child))) out[`${path}.${key}`] = child;
        else if (child && typeof child === 'object' && !ArrayBuffer.isView(child)) walk(child, `${path}.${key}`, depth + 1);
      }
    };
    const overlay = document.querySelector('#sph-phase-overlay');
    out.__overlayKeys = overlay ? Object.keys(overlay).filter(k => k.startsWith('__')).slice(0, 30).join(',') : '';
    try { walk(overlay?.__mlsMpmResidentSteps, 'residentSteps', 0); } catch (error) { out.__error = String(error).slice(0, 120); }
    try { walk(overlay?.__sphScene?.userData, 'userData', 0); } catch {}
    return out;
  }).catch(() => null);
  console.log(JSON.stringify({ ambient: evidence.ambient }));
  if (process.env.S0_ATTRIBUTION === '1') {
    evidence.attribution = (await inAll(() => globalThis.__s0?.readAttribution?.() ?? null)).filter(entry => entry.value);
    console.log(JSON.stringify({ attribution: evidence.attribution }));
  }
  evidence.finiteWalls = (await inAll(() => globalThis.__s0?.readFiniteWalls?.() ?? null)).filter(entry => entry.value);
  console.log(JSON.stringify({ finiteWalls: evidence.finiteWalls }));
  evidence.parcelStage = (await inAll(() => globalThis.__ulgLedgerParcelStage ?? null)).filter(entry => entry.value);
  if (evidence.parcelStage.length) console.log(JSON.stringify({ parcelStage: evidence.parcelStage }));
  evidence.parcelOptics = (await inAll(() => globalThis.__ulgLedgerParcelOptics ?? null)).filter(entry => entry.value);
  console.log(JSON.stringify({ parcelOptics: evidence.parcelOptics }));
  evidence.solidRigidLane = (await inAll(() => globalThis.__ulgSolidRigidLane ?? null)).filter(entry => entry.value);
  console.log(JSON.stringify({ solidRigidLane: evidence.solidRigidLane }));
  // A2 evidence: the lane's cumulative spatial-key churn totals (with &spatialChurnProfile=1).
  evidence.spatialKeyChurn = await page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const seen = new Set();
    const find = (value, depth) => {
      if (!value || typeof value !== 'object' || depth > 6 || seen.has(value)) return null;
      seen.add(value);
      if (value.spatialKeyChurnCumulativeTotals) return value.spatialKeyChurnCumulativeTotals;
      for (const key of Object.keys(value)) { const hit = find(value[key], depth + 1); if (hit) return hit; }
      return null;
    };
    try { return JSON.parse(JSON.stringify(find(overlay?.__mlsMpmResidentSteps, 0))); } catch { return null; }
  });
  console.log(JSON.stringify({ spatialKeyChurn: evidence.spatialKeyChurn }));
  // With &residentGpuTimestampProfile=1: real per-stage GPU times of the worker lane.
  evidence.residentStageTiming = await page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const seen = new Set();
    const find = (value, depth) => {
      if (!value || typeof value !== 'object' || depth > 7 || seen.has(value)) return null;
      seen.add(value);
      if (value.residentStageTiming?.stageGpuMs) return value.residentStageTiming;
      for (const key of Object.keys(value)) { const hit = find(value[key], depth + 1); if (hit) return hit; }
      return null;
    };
    try { return JSON.parse(JSON.stringify(find(overlay?.__mlsMpmResidentSteps, 0))); } catch { return null; }
  });
  console.log(JSON.stringify({ residentStageTiming: evidence.residentStageTiming }));
  // Presentation admission readouts (why a worker-owned scene does or does not present).
  evidence.presentationReadout = await page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o?.[k] ?? null]));
    const counters = overlay?.__sphFrameCounters ?? null;
    const presentation = overlay?.__sphScene?.getWorkerOffscreenPresentation?.() ?? null;
    const lane = overlay?.__mlsMpmResidentSteps?.workerOwnedResidentLane ?? null;
    const safe = v => { try { return JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'object' && x && Object.keys(x).length > 60) ? '[big]' : x)); } catch { return String(v); } };
    return safe({
      cadence: pick(counters, ['presentationCadenceStatus', 'presentationCadenceBlockers']),
      renderRows: pick(presentation?.workerOffscreenRenderRows, ['status', 'reason', 'errorMessage']),
      displayOwnerContentReady: presentation?.displayOwnerContentReady ?? null,
      displayOwner: presentation?.displayOwner ?? null,
      pending: overlay?.__sphPendingPresentation?.active ?? null,
      lane: { laneId: lane?.laneId ?? null, stateKey: lane?.stateKey ?? null,
        committedPresentation: lane?.committedPresentation?.status ?? null,
        executionRoute: lane?.executionRouteReceipt?.status ?? null },
      lastFallback: overlay?.__sphScene?.userData?.sphWorkerLaneLastFallback ?? null
    });
  });
  console.log(JSON.stringify({ presentationReadout: evidence.presentationReadout }));
  if (process.env.S0_PASS_CENSUS === '1') {
    evidence.passCensus = await inAll(() => {
      const census = globalThis.__ulgArmPassTimestampCensus?.();
      return census?.read ? census.read() : null;
    });
    for (const { context, value } of evidence.passCensus) {
      console.log(JSON.stringify({ passCensus: { context, ...value, rows: value.rows.slice(0, 40) } }));
    }
  }
  evidence.thermalDormancy = (await inAll(() => globalThis.__ulgThermalDormancy?.readCounts?.() ?? null))
    .filter(entry => entry.value);
  console.log(JSON.stringify({ thermalDormancy: evidence.thermalDormancy }));
  evidence.reactionDormancy = (await inAll(() => globalThis.__ulgReactionDormancy?.readCounts?.() ?? null))
    .filter(entry => entry.value);
  console.log(JSON.stringify({ reactionDormancy: evidence.reactionDormancy }));
  evidence.lawScopeReceipt = (await inAll(() => globalThis.__ulgLastLawScopeReceipt ?? null)).filter(entry => entry.value);
  console.log(JSON.stringify({ lawScopeReceipt: evidence.lawScopeReceipt }));
  evidence.implicitPressure = (await inAll(() => globalThis.__ulgImplicitPressure ?? null)).filter(entry => entry.value);
  console.log(JSON.stringify({ implicitPressure: evidence.implicitPressure }));
  // S0_LANE_TRACE=1: the worker lane's last 96 timestamped events.
  if (process.env.S0_LANE_TRACE === '1') {
    evidence.laneTrace = (await inAll(() => globalThis.__ulgLaneTrace?.slice?.() ?? null)).filter(entry => entry.value);
    console.log(JSON.stringify({ laneTrace: evidence.laneTrace }));
  }
  evidence.gasEosRejects = (await inAll(() => globalThis.__ulgGasEosRejects ?? null)).filter(entry => entry.value);
  evidence.gasAuthorityPicks = (await inAll(() => globalThis.__ulgGasAuthorityPicks ?? null)).filter(entry => entry.value);
  if (evidence.gasAuthorityPicks.length) console.log(JSON.stringify({ gasAuthorityPicks: evidence.gasAuthorityPicks }));
  if (evidence.gasEosRejects.length) console.log(JSON.stringify({ gasEosRejects: evidence.gasEosRejects }));
  if (process.env.S0_P2G_REJECT_TAG === '1') {
    evidence.p2gRejectSites = (await inAll(() => globalThis.__s0?.p2gRejectSites ?? null)).filter(entry => entry.value);
    console.log(JSON.stringify({ p2gRejectSites: evidence.p2gRejectSites }));
  }
  if (process.env.S0_G2P_REJECT_TAG === '1') {
    evidence.g2pRejectSites = (await inAll(() => globalThis.__s0?.g2pRejectSites ?? null)).filter(entry => entry.value);
    console.log(JSON.stringify({ g2pRejectSites: evidence.g2pRejectSites }));
  }
  if (process.env.S0_CONTACT_AUDIT === '1') {
    evidence.activeSourceConsistency = (await inAll(() => globalThis.__s0?.readActiveSourceConsistency?.() ?? null))
      .filter(entry => entry.value);
    console.log(JSON.stringify({ activeSourceConsistency: evidence.activeSourceConsistency }));
  }
  evidence.realtimePacing = (await inAll(() => globalThis.__ulgTier0RealtimePacing ?? null)).filter(entry => entry.value);
  console.log(JSON.stringify({ realtimePacing: evidence.realtimePacing }));
  if (process.env.S0_LEDGER_AUDIT === '1') {
    // Pause so the newest ledger records stay owned, then read them back.
    if ((await page.evaluate(appRow)).play === 'Pause') await page.locator('#sph-play').click({ timeout: 5000 });
    await page.waitForTimeout(8000);
    evidence.ledgerAudit = (await inAll(() => globalThis.__s0.readLedger()))
      .filter(entry => Object.keys(entry.value.latest).length || Object.keys(entry.value.cold).length);
  }
  const wallS = (Date.now() - t0) / 1000;
  const snapshots = await inAll(() => globalThis.__s0.snapshot());
  const traces = snapshots.flatMap(s => s.value.traces);
  const steps = end.laneSteps != null && begin.laneSteps != null ? end.laneSteps - begin.laneSteps : null;
  const simS = end.simTimeS - begin.simTimeS;
  const busiest = snapshots.flatMap(s => s.value.devices.map(d => ({ context: s.context, ...d })))
    .sort((x, y) => y.counters.computePasses - x.counters.computePasses)[0] ?? null;
  evidence.window = {
    wallS, steps, simS, stepsPerS: steps != null ? steps / wallS : null,
    simSecondsPerWallSecond: simS / wallS, dtS: steps ? simS / steps : null,
    perStep: busiest && steps ? Object.fromEntries(Object.entries(busiest.counters)
      .map(([key, value]) => [key, Number((value / steps).toFixed(2))])) : null,
    busiestDevice: busiest,
    devices: snapshots.map(s => ({ context: s.context, devices: s.value.devices, traceDrops: s.value.traceDrops })),
    authority: summarizeTraces(traces),
    ledgerLabels: Object.assign({}, ...snapshots.map(s => s.value.ledgerLabels || {})),
    gpuErrors: snapshots.flatMap(s => (s.value.gpuErrors ?? []).map(m => `${s.context}: ${m}`))
  };
  if (evidence.window.gpuErrors.length) console.log(JSON.stringify({ gpuErrors: evidence.window.gpuErrors.slice(0, 6) }));
  console.log(JSON.stringify({ tag, wallS: wallS.toFixed(1), steps, stepsPerS: evidence.window.stepsPerS?.toFixed(2),
    dtS: evidence.window.dtS, simPerWall: evidence.window.simSecondsPerWallSecond.toFixed(5),
    authority: { traced: evidence.window.authority.tracedSteps, rolledBack: evidence.window.authority.rolledBack,
      admitted: evidence.window.authority.admitted, neither: evidence.window.authority.neither,
      cfl: evidence.window.authority.maxFineCflRatio }, ledger: evidence.window.ledgerLabels }));
  await page.screenshot({ path: `${outDir}/${tag}.png` });
} catch (error) {
  evidence.failure = error?.stack || String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  evidence.finished = new Date().toISOString();
  try {
    evidence.xid = execFileSync('journalctl', ['-k', '--since', `@${Math.floor(started.getTime() / 1000)}`, '--no-pager'],
      { encoding: 'utf8' }).split('\n').filter(line => /Xid/.test(line));
  } catch (error) { evidence.xidError = String(error); }
  await writeFile(`${outDir}/${tag}.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ out: `${outDir}/${tag}.json`, failure: evidence.failure?.slice(0, 400),
    xid: evidence.xid, errors: evidence.errors.slice(0, 4) }));
}
