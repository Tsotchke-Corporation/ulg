#!/bin/bash
# GPU-budgeted live probe (user, 2026-11-17: up to about 80% GPU, and never
# crash or hang the window manager).
#
#   scripts/gpuprobe.sh LABEL "QUERY" [WINDOW_MS] [ENV=VALUE ...]
#
#   LABEL      tag for the run; names the files LABEL.log, LABEL.json, LABEL.gpu
#   QUERY      extra URL query for the app, e.g. "&environmentMode=vacuum"
#   WINDOW_MS  measurement window (default 60000)
#   ENV=VALUE  extra probe options, e.g. S0_RESIDENT_PERF=1 S0_CPU_PROFILE=40
#
#   GPU_CPU_QUOTA       CPU quota once the app is stepping (default 50%)
#   GPU_BOOT_CPU_QUOTA  CPU quota while the app boots (default 400%)
#   GPUPROBE_OUT        evidence directory (default ~/.cache/icc/repos/ulg/gpuprobe)
#   GPUPROBE_SCENARIO   preset (default iron-ice-quench)
#
# The probe (scripts/step0-baseline-probe.mjs) and its headless Chrome run in
# one systemd scope with a CPU quota and a memory cap. The quota lowers average
# GPU use but does not bound the peak: an Iron Ice run under a 50% quota
# measured a 60% mean with p90 at 100%. Nothing here stops a run that goes
# over budget, and VRAM is not sampled. nvidia-smi is sampled once a second
# for the whole run; the summary reports total utilisation, which includes
# whatever else is using the GPU. Rates measured under a quota are not
# comparable with unthrottled ones.
#
# The quota has two phases. Booting the app under the stepping quota makes
# PeerCompute's 5 s worker-bootstrap acknowledgement time out, and Play then
# stays disabled. Boot barely uses the GPU, so it runs under the boot quota;
# the stepping quota is applied when the probe reports its first lane step.
#
# Evidence goes to real disk: /tmp is a tmpfs, fills up, and is emptied by a
# reboot. Always headless; DISPLAY and WAYLAND_DISPLAY are removed.
set -u
cd "$(dirname "$(readlink -f "$0")")/.." || exit 2
if [ $# -lt 2 ]; then
  sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
fi
L=$1; Q=$2; WIN=${3:-60000}
shift 2; [ $# -gt 0 ] && shift
QUOTA=${GPU_CPU_QUOTA:-50%}
BOOT_QUOTA=${GPU_BOOT_CPU_QUOTA:-400%}
OUT=${GPUPROBE_OUT:-$HOME/.cache/icc/repos/ulg/gpuprobe}
SCENARIO=${GPUPROBE_SCENARIO:-iron-ice-quench}
UNIT="ulg-gpuprobe-${L//[^A-Za-z0-9]/-}-$$"
mkdir -p "$OUT" || exit 2

if pgrep -f '[s]tep0-baseline-probe.mjs' >/dev/null; then
  echo "another step0 probe is running; one GPU workload at a time" >&2
  exit 3
fi

rm -f "$OUT/$L.json" "$OUT/$L.quota"
nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits -l 1 > "$OUT/$L.gpu" 2>/dev/null &
SMI=$!
timeout 1500 systemd-run --user --scope -q --unit="$UNIT" -p CPUQuota="$BOOT_QUOTA" -p MemoryMax=8G \
  env -u DISPLAY -u WAYLAND_DISPLAY -u XAUTHORITY \
  S0_WARMUP_S=300 S0_WINDOW_MS="$WIN" S0_OUT_DIR="$OUT" "$@" \
  node scripts/step0-baseline-probe.mjs "$SCENARIO" "$L" "$Q" > "$OUT/$L.log" 2>&1 &
PROBE=$!
trap 'kill $SMI $PROBE 2>/dev/null; systemctl --user stop "$UNIT.scope" 2>/dev/null' EXIT

# Apply the stepping quota at the first reported lane step.
(
  while kill -0 $PROBE 2>/dev/null; do
    if grep -qE '"laneSteps":[1-9]|"simTimeS":(0\.0*[1-9]|[1-9])' "$OUT/$L.log" 2>/dev/null; then
      if systemctl --user set-property --runtime "$UNIT.scope" CPUQuota="$QUOTA" 2>>"$OUT/$L.quota"; then
        echo "stepping quota $QUOTA applied at sample $(wc -l < "$OUT/$L.gpu")" >> "$OUT/$L.quota"
      else
        echo "FAILED to apply stepping quota $QUOTA" >> "$OUT/$L.quota"
      fi
      break
    fi
    sleep 1
  done
) &
WATCH=$!
wait $PROBE
STATUS=$?
kill $SMI $WATCH 2>/dev/null; wait $SMI $WATCH 2>/dev/null
trap - EXIT

grep '"tag"' "$OUT/$L.log" | cut -c1-220
python3 - "$OUT/$L" "$QUOTA" "$BOOT_QUOTA" <<'PY'
import json, os, re, sys
base, quota, boot = sys.argv[1], sys.argv[2], sys.argv[3]
u = [int(x) for x in open(base + '.gpu').read().split() if x.strip().isdigit()]
note = open(base + '.quota').read().strip() if os.path.exists(base + '.quota') else ''
applied = re.search(r'applied at sample (\d+)', note)
def line(tag, v):
    if not v:
        return
    s = sorted(v)
    print(f'gpu {tag}: samples={len(v)} mean={sum(v) / len(v):.1f}% '
          f'p90={s[int(0.9 * (len(s) - 1))]}% max={max(v)}%')
if applied:
    k = int(applied.group(1))
    line(f'boot (quota {boot})', u[:k])
    line(f'stepping (quota {quota})', u[k:])
else:
    line('whole run', u)
    print('stepping quota was NEVER applied:', note or 'the app did not report a lane step')
print('gpu figures are total utilisation, all users of the GPU')
if os.path.exists(base + '.json'):
    o = json.load(open(base + '.json'))
    console = o.get('console') or []
    print('failure', str(o.get('failure'))[:160],
          '| cert errors', sum('CERT' in str(c) for c in console),
          '| page errors', len(o.get('errors') or []))
else:
    print('no evidence JSON was written; read', base + '.log')
PY
echo "evidence: $OUT/$L.{log,json,gpu,quota}  probe exit=$STATUS"
exit $STATUS
