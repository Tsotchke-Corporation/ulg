#!/bin/bash
# Sequential A/B: burst off vs on (K=8) at 13.8k and 104k. Never concurrent.
set -u
OUT="${1:-/tmp/burst-ab-results.txt}"
: > "$OUT"
run() {
  local label="$1" extra="$2" window="$3"
  echo "=== $label ===" >> "$OUT"
  ULG_PROBE_SCENARIO=bulk-water ULG_PROBE_EXTRA="$extra" ULG_PROBE_WINDOW_MS="$window" \
    node scratch/census-probe.mjs 2>/dev/null | node -e "
let s=''; process.stdin.on('data',(d)=>s+=d).on('end',()=>{
  try {
    const j = JSON.parse(s.slice(s.indexOf('{')));
    const c = j.commits;
    if (!c || c.length < 2) { console.log('insufficient commits', JSON.stringify(j).slice(0,300)); return; }
    const spanMs = c[c.length-1].t - c[0].t;
    const steps = c[c.length-1].committed - c[0].committed;
    console.log('n:', c[0].n, 'steps/s:', (steps/spanMs*1000).toFixed(1), 'wall ms/step:', (spanMs/steps).toFixed(2));
    const lc = j.lastCensus;
    if (lc) {
      console.log('internal ms/step:', ((lc.lastStepEnd-lc.firstStepStart)/lc.completedStepCount).toFixed(2),
        'tailFenceLagMs:', (lc.tailFenceDone-lc.lastStepEnd).toFixed(1));
      const b = lc.submitBurstObservation;
      if (b) console.log('burst:', JSON.stringify({eligible:b.eligible, opened:b.opened, stats: b.stats && {flushes:b.stats.flushCount, held:b.stats.heldSubmitTotal, direct:b.stats.directSubmitTotal, staleFlush:b.stats.staleWriteFlushCount, fenceFlush:b.stats.fenceFlushCount, maxHeld:b.stats.maxHeldCommandBuffers}}));
    }
    if (j.errors?.length) console.log('errors:', JSON.stringify(j.errors));
  } catch (e) { console.log('parse-failed', String(e).slice(0,150), s.slice(0,200)); }
});" >> "$OUT"
}
run "13.8k baseline" "&basen=24" 40000
run "13.8k burst K=8" "&basen=24&submitBurstSteps=8" 40000
run "104k baseline" "&basen=47" 60000
run "104k burst K=8" "&basen=47&submitBurstSteps=8" 60000
echo "DONE" >> "$OUT"
cat "$OUT"
