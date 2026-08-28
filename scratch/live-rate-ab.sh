#!/bin/bash
set -u
OUT="${1:-/tmp/live-rate.txt}"
: > "$OUT"
run() {
  local label="$1" extra="$2"
  echo "=== $label ===" >> "$OUT"
  ULG_PROBE_SCENARIO=bulk-water ULG_PROBE_EXTRA="$extra" ULG_PROBE_WINDOW_MS=45000 \
    node scratch/census-probe.mjs 2>/dev/null | node -e "
let s=''; process.stdin.on('data',(d)=>s+=d).on('end',()=>{
  try {
    const j = JSON.parse(s.slice(s.indexOf('{')));
    const c = j.commits;
    if (!c || c.length < 2) { console.log('insufficient commits'); return; }
    const spanMs = c[c.length-1].t - c[0].t;
    const steps = c[c.length-1].committed - c[0].committed;
    console.log('n:', c[0].n, 'steps/s:', (steps/spanMs*1000).toFixed(1), 'ms/step:', (spanMs/steps).toFixed(2));
    if (j.errors?.length) console.log('errors:', JSON.stringify(j.errors.slice(0,2)));
  } catch (e) { console.log('parse-failed', String(e).slice(0,120)); }
});" >> "$OUT"
}
run "32.8k V1 live physics, contact ON" "&compactMechanicsView=0"
run "32.8k V1 live physics, contact OFF" "&compactMechanicsView=0&contactSolver=0"
echo "DONE" >> "$OUT"
cat "$OUT"
