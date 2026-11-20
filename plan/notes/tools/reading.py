#!/usr/bin/env python3
"""Reading manifest for plan/notes (Hermes, 2026-11-17).

Splits the plan, the log and the codebase into slices of about 300 KB, writes
one assignment file per slice, and checks the notes that come back.

  reading.py build              build manifest.json, assignments/, COVERAGE.md
  reading.py next N [KINDS]     print the next N pending slices as task specs
                                and mark them dispatched (KINDS e.g. L,S,P)
  reading.py verify [ID ...]    check notes of the given (or all dispatched)
                                slices: coverage line, summary, quotes
  reading.py summaries ID ...   print the SUMMARY section of each notes file
  reading.py status             counts by kind and state
  reading.py redo ID ...        mark slices pending again

Nothing here edits the repository outside plan/notes/.
"""
import datetime
import json
import os
import re
import subprocess
import sys

ULG = '/home/cos/projects/ulg'
PC = '/home/cos/projects/peercompute'
NOTES = f'{ULG}/plan/notes'
MANIFEST = f'{NOTES}/manifest.json'
ASSIGN = f'{NOTES}/assignments'
CACHE = os.path.expanduser('~/.cache/icc/repos/ulg/hermes-20261117/reading')
TARGET = 300_000

BINARY_EXT = {'.pdf', '.jpg', '.jpeg', '.png', '.gif', '.wasm', '.zip', '.tgz',
              '.gz', '.ico', '.woff', '.woff2', '.ttf', '.bin', '.map'}
# Data, generated glue and duplicates: listed and sampled, not read line by line.
INVENTORY = [r'^data/', r'package-lock\.json$', r'\.cpuprofile$', r'\.orig$',
             r'public/service-assets/moonlab/moonlab\.js$',
             r'public/service-assets/eshkol/vm/eshkol-vm\.js$',
             r'magnetar-closure\.ulg\.json$']
PRUNE_DIRS = {'node_modules', '.git', 'dist', 'docs', '.cache', 'test-results'}
NOTES_DIR = {'L': 'log', 'S': 'status', 'P': 'docs', 'C': 'code', 'T': 'tests',
             'X': 'code'}


def sh(args, cwd=None):
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                          errors='replace').stdout


def git_state(repo):
    state = {}
    for line in sh(['git', '-C', repo, 'status', '--porcelain',
                    '--untracked-files=all']).splitlines():
        code, path = line[:2], line[3:].strip('"')
        if ' -> ' in path:
            path = path.split(' -> ')[1]
        state[path] = 'new' if code == '??' else 'changed'
    return state


def diff_hunks(repo, rel):
    """Hunks of the uncommitted change to rel, keyed by new-side start line."""
    out = sh(['git', '-C', repo, 'diff', '-U3', 'HEAD', '--', rel])
    hunks, cur = [], None
    for line in out.split('\n'):
        m = re.match(r'@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@', line)
        if m:
            cur = {'start': int(m.group(1)), 'text': [line]}
            hunks.append(cur)
        elif cur is not None:
            cur['text'].append(line)
    return hunks


def walk(repo, sub, pred=lambda rel: True):
    base = os.path.join(repo, sub)
    if os.path.isfile(base):
        return [sub] if pred(sub) else []
    found = []
    for root, dirs, files in os.walk(base):
        dirs[:] = sorted(d for d in dirs if d not in PRUNE_DIRS)
        for name in sorted(files):
            rel = os.path.relpath(os.path.join(root, name), repo)
            if pred(rel):
                found.append(rel)
    return found


def load(repo, rel):
    """Return (lines, sizes) or None for a binary or unreadable file."""
    if os.path.splitext(rel)[1].lower() in BINARY_EXT:
        return None
    try:
        raw = open(os.path.join(repo, rel), 'rb').read()
    except OSError:
        return None
    sample = raw[:65536]
    if sample.count(b'\x00') > max(4, len(sample) // 200):
        return None
    parts = raw.split(b'\n')
    if parts and parts[-1] == b'':
        parts.pop()
    lines = [p.decode('utf-8', 'replace') for p in parts]
    sizes = [len(p) + 1 for p in parts]
    return lines, sizes


def split_ranges(lines, sizes, markdown, TARGET=TARGET):
    """1-based inclusive line ranges of about TARGET bytes each."""
    n, total = len(lines), sum(sizes)
    if total <= TARGET * 1.25 or n == 0:
        return [(1, max(n, 1))]

    def boundary(text):
        if markdown:
            return text.startswith('## ') or text.startswith('# ')
        return text.strip() == ''

    ranges, start, acc, i, left = [], 0, 0, 0, total
    while i < n:
        acc += sizes[i]
        i += 1
        if acc >= TARGET * 0.85 and i < n:
            j, extra, cut = i, 0, None
            while j < n and extra < TARGET * 0.30:
                if boundary(lines[j]):
                    cut = j
                    break
                extra += sizes[j]
                j += 1
            if cut is None:
                cut = i
            piece = sum(sizes[start:cut])
            if left - piece < TARGET * 0.25:      # do not leave a tiny tail
                break
            ranges.append((start + 1, cut))
            left -= piece
            start, i, acc = cut, cut, 0
    ranges.append((start + 1, n))
    return ranges


def build():
    os.makedirs(ASSIGN, exist_ok=True)
    os.makedirs(f'{CACHE}/diffs', exist_ok=True)
    state = {ULG: git_state(ULG), PC: git_state(PC)}
    skipped, slices, counters = [], [], {}

    def items_for(repo, rel, markdown):
        label = rel if repo == ULG else 'PC/' + rel
        loaded = load(repo, rel)
        if loaded is None:
            skipped.append({'label': label, 'reason': 'binary or unreadable'})
            return []
        lines, sizes = loaded
        st = state[repo].get(rel, 'same')
        inventory = any(re.search(p, rel) for p in INVENTORY)
        hunks = diff_hunks(repo, rel) if st == 'changed' and not inventory else []
        out = []
        # A heavily changed file is cut smaller, so a range plus its diff stays near TARGET.
        total = sum(sizes)
        diff_total = sum(len('\n'.join(h['text'])) for h in hunks)
        target = int(TARGET * total / (total + diff_total)) if total else TARGET
        ranges = ([(1, max(len(lines), 1))] if inventory
                  else split_ranges(lines, sizes, markdown, max(target, 120_000)))
        for a, b in ranges:
            mine = [h for h in hunks if a <= h['start'] <= b]
            # a hunk starting at line 0 (pure deletion at the top) goes to the first range
            if a == 1:
                mine += [h for h in hunks if h['start'] < 1]
            nbytes = sum(sizes[a - 1:b])
            out.append({
                'repo': 'ulg' if repo == ULG else 'peercompute',
                'label': label, 'abs': os.path.join(repo, rel),
                'start': a, 'end': b, 'lines_total': len(lines),
                'bytes': nbytes, 'state': st,
                'mode': 'inventory' if inventory else 'read',
                'hunks': len(mine),
                'diff_text': '\n'.join('\n'.join(h['text']) for h in mine),
            })
        return out

    def pack(prefix, group, entries, markdown=False):
        """entries: list of (repo, rel). Appends slices to the manifest."""
        cur, cur_w = [], 0

        def flush():
            nonlocal cur, cur_w
            if not cur:
                return
            counters[prefix] = counters.get(prefix, 0) + 1
            width = 3 if prefix in ('C', 'T') else 2
            sid = f'{prefix}{counters[prefix]:0{width}d}'
            diff = '\n'.join(
                f'##### {it["label"]} (hunks starting in lines {it["start"]}-{it["end"]})\n{it["diff_text"]}'
                for it in cur if it['diff_text'])
            diff_path = ''
            if diff:
                diff_path = f'{CACHE}/diffs/{sid}.diff'
                open(diff_path, 'w').write(diff + '\n')
            for it in cur:
                del it['diff_text']
            total = sum(it['bytes'] for it in cur)
            recent = sum(it['bytes'] for it in cur if it['state'] != 'same')
            ss = sum(it['bytes'] for it in cur
                     if re.search(r'schroeder|/SS/|(^|/)ss-|-ss-', it['label'], re.I))
            slices.append({
                'id': sid, 'kind': prefix, 'group': group, 'items': cur,
                'bytes': total, 'lines': sum(it['end'] - it['start'] + 1 for it in cur),
                'diff': diff_path, 'diff_bytes': len(diff),
                'recent_fraction': round(recent / total, 3) if total else 0,
                'ss_fraction': round(ss / total, 3) if total else 0,
                'notes': f'{NOTES}/{NOTES_DIR[prefix]}/{sid}.md',
                'status': 'pending',
            })
            cur, cur_w = [], 0

        for repo, rel in entries:
            for it in items_for(repo, rel, markdown):
                w = (min(it['bytes'], 20_000) if it['mode'] == 'inventory'
                     else it['bytes']) + len(it['diff_text'])
                if cur and cur_w + w > TARGET * 1.15:
                    flush()
                cur.append(it)
                cur_w += w
                if cur_w >= TARGET * 0.9:
                    flush()
        flush()

    U = lambda rels: [(ULG, r) for r in rels]
    md = lambda rel: rel.endswith(('.md', '.html', '.yaml', '.yml', '.txt'))
    todo_all = walk(ULG, 'plan/todo', lambda r: r.count('/') == 2 and md(r))
    campaign = [r for r in todo_all if state[ULG].get(r) in ('new', 'changed')]
    older = [r for r in todo_all if r not in campaign]

    pack('L', 'log', U(['plan/log.md']), markdown=True)
    pack('S', 'status', U(['plan/implementation-status.md']), markdown=True)
    pack('P', 'plan-campaign', U(sorted(campaign) + ['plan/handoff-2026-10-24.md',
         'plan/STATUS.md', '.icc/completion-oracles.yaml', '.icc/assistant-goals.yaml',
         '.icc/quality-campaigns.yaml', '.icc/production-audit.yaml', '.icc/README.md']),
         markdown=True)
    pack('P', 'plan-ss', U(walk(ULG, 'plan/todo/SS') + ['plan/ss-law-architecture-assessment.md']
         + walk(ULG, 'plan/done/SS') + walk(ULG, 'plan/moot/SS')
         + ['plan/refactor/handoff.md']), markdown=True)
    pack('P', 'plan-todo-older', U(sorted(older)), markdown=True)
    top = [r for r in walk(ULG, 'plan', lambda r: r.count('/') == 1 and md(r))
           if r not in ('plan/log.md', 'plan/implementation-status.md', 'plan/tests.md',
                        'plan/handoff-2026-10-24.md', 'plan/handoff-2026-11-17.md',
                        'plan/STATUS.md', 'plan/ss-law-architecture-assessment.md')]
    pack('P', 'plan-top', U(top + ['README.md', 'oldagents.md', 'todo-handoff-6-12.md',
         'public/service-assets/README.md', 'ulg-gpu-abi/README.md']), markdown=True)
    pack('P', 'plan-done', U(walk(ULG, 'plan/done', lambda r: '/SS/' not in r and md(r))),
         markdown=True)
    pack('P', 'plan-moot', U(walk(ULG, 'plan/moot', lambda r: '/SS/' not in r and md(r))
         + [r for r in walk(ULG, 'plan/refactor') if r != 'plan/refactor/handoff.md']),
         markdown=True)
    pack('P', 'plan-tests-md', U(['plan/tests.md']), markdown=True)

    pack('C', 'src-visualization', U(walk(ULG, 'src/visualization')))
    pack('C', 'src-services', U(walk(ULG, 'src/services')))
    pack('C', 'src-runtime-top', U(walk(ULG, 'src/runtime', lambda r: r.count('/') == 2)))
    pack('C', 'src-runtime-sub', U(walk(ULG, 'src/runtime',
         lambda r: r.count('/') > 2 and not r.startswith('src/runtime/sph/'))
         + walk(ULG, 'src/tools')))
    pack('C', 'src-runtime-sph', U(walk(ULG, 'src/runtime/sph')))
    pack('C', 'gpu-abi', U(walk(ULG, 'ulg-gpu-abi', lambda r: not r.endswith('README.md'))))
    pack('C', 'root-and-public', U(['index.html', 'pages.html', 'vite.config.mjs',
         'vite.pages.config.mjs', 'package.json']
         + walk(ULG, 'public', lambda r: not r.endswith('README.md')) + walk(ULG, 'tools')))
    pack('C', 'peercompute-src', [(PC, r) for r in walk(PC, 'peercompute/src')]
         + [(PC, 'peercompute/tests/unit/reservationLedger.test.js')])
    pack('T', 'tests', U(walk(ULG, 'tests')))
    pack('X', 'scripts', U(walk(ULG, 'scripts')))
    pack('X', 'scratch-data-misc', U(walk(ULG, 'scratch') + walk(ULG, 'data')
         + ['.icc/modularity-justifications.json', '.icc/ulg_doc_intel.md',
            '.claude/skills/icc-code-search/SKILL.md', 'package-lock.json',
            'sncu.cpuprofile']))

    # Dispatch order: log and status, the campaign plans, SS plans, then code
    # with the most recent change first, then the rest.
    def order_key(s):
        g = s['group']
        if s['kind'] in ('L', 'S'):
            tier = 0
        elif g in ('plan-campaign', 'plan-ss'):
            tier = 1
        elif s['kind'] == 'C' and s['recent_fraction'] > 0:
            tier = 2
        elif g in ('plan-todo-older', 'plan-top'):
            tier = 3
        elif s['kind'] == 'C':
            tier = 4
        elif s['kind'] == 'P':
            tier = 5
        elif s['kind'] == 'T' and s['recent_fraction'] > 0:
            tier = 6
        elif s['kind'] == 'X':
            tier = 7
        else:
            tier = 8
        return (tier, -s['recent_fraction'], -s['ss_fraction'], s['id'])

    for n, s in enumerate(sorted(slices, key=order_key)):
        s['order'] = n
    json.dump({'built': datetime.datetime.now().isoformat(timespec='seconds'),
               'head': sh(['git', '-C', ULG, 'rev-parse', '--short', 'HEAD']).strip(),
               'target_bytes': TARGET, 'slices': slices, 'skipped': skipped},
              open(MANIFEST, 'w'), indent=1)
    for s in slices:
        write_assignment(s)
    write_coverage(slices, skipped)
    report(slices)
    print(f'skipped (binary): {len(skipped)}')


def write_assignment(s):
    kind_name = {'L': 'dev log', 'S': 'status log', 'P': 'plan documents', 'C': 'application code',
                 'T': 'tests', 'X': 'scripts and miscellany'}[s['kind']]
    out = [f'# Assignment {s["id"]} ({kind_name})', '',
           'Brief (read it first, in full): /home/cos/projects/ulg/plan/notes/BRIEF.md',
           f'Your notes file (the only file you may write): {s["notes"]}', '',
           f'Read these ranges completely and in this order ({s["bytes"]:,} bytes, {s["lines"]:,} lines):', '']
    for n, it in enumerate(s['items'], 1):
        tag = {'same': 'unchanged since 2026-10-27',
               'changed': f'CHANGED during the campaign (after 2026-10-27): {it["hunks"]} diff hunks start in this range',
               'new': 'NEW: created during the campaign (after 2026-10-27), all of it is recent'}[it['state']]
        whole = '' if (it['start'] == 1 and it['end'] == it['lines_total']) else f' (the file has {it["lines_total"]:,} lines; other slices have the rest)'
        if it['mode'] == 'inventory':
            out.append(f'{n}. {it["abs"]} — INVENTORY ONLY ({it["bytes"]:,} bytes, data or generated): read the first 150 lines, sample the middle and the end, and describe what it is. [{tag}]')
        else:
            out.append(f'{n}. {it["abs"]} lines {it["start"]}-{it["end"]}{whole} [{tag}]')
    out.append('')
    if s['diff']:
        out.append(f'Campaign diff for this slice (uncommitted changes since 2026-10-27, {s["diff_bytes"]:,} bytes): {s["diff"]}')
        out.append('Read it in full after the files. It shows exactly what the recent campaign changed here.')
        out.append('')
    cov = '; '.join(f'{it["label"]}:{it["start"]}-{it["end"]}' for it in s['items'])
    out.append('When every range is read, the last line of your notes file must be exactly:')
    out.append('')
    out.append(f'COVERAGE: {cov}')
    out.append('')
    open(f'{ASSIGN}/{s["id"]}.md', 'w').write('\n'.join(out))


def write_coverage(slices, skipped):
    out = ['# Reading coverage', '',
           'Generated by `tools/reading.py`. One row per slice; `manifest.json` has the line ranges.',
           'State: pending, dispatched, done (notes verified), failed (notes missing or incomplete).', '',
           '| Slice | Group | Bytes | Lines | Items | Recent | State | First item |',
           '|---|---|---:|---:|---:|---:|---|---|']
    for s in slices:
        first = s['items'][0]
        out.append(f'| {s["id"]} | {s["group"]} | {s["bytes"]:,} | {s["lines"]:,} | {len(s["items"])} | '
                   f'{int(s["recent_fraction"] * 100)}% | {s["status"]} | `{first["label"]}:{first["start"]}-{first["end"]}` |')
    out += ['', f'Binary files not read ({len(skipped)}): ' + ', '.join(f'`{k["label"]}`' for k in skipped), '']
    open(f'{NOTES}/COVERAGE.md', 'w').write('\n'.join(out))


def load_manifest():
    return json.load(open(MANIFEST))


def save_manifest(m):
    json.dump(m, open(MANIFEST, 'w'), indent=1)
    write_coverage(m['slices'], m['skipped'])


def report(slices):
    by = {}
    for s in slices:
        k = (s['kind'], s['status'])
        by.setdefault(k, [0, 0])
        by[k][0] += 1
        by[k][1] += s['bytes']
    for (kind, status), (n, b) in sorted(by.items()):
        print(f'{kind} {status:10s} {n:4d} slices {b / 1e6:8.2f} MB')
    print(f'total {len(slices)} slices, {sum(s["bytes"] for s in slices) / 1e6:.2f} MB')


def next_batch(n, kinds=None):
    m = load_manifest()
    pend = sorted((s for s in m['slices'] if s['status'] == 'pending'
                   and (not kinds or s['kind'] in kinds)), key=lambda s: s['order'])[:n]
    tasks = []
    for s in pend:
        s['status'] = 'dispatched'
        s['dispatched_at'] = datetime.datetime.now().isoformat(timespec='seconds')
        tasks.append({
            'goal': f'Read-only reading assignment {s["id"]} for the ULG repository: read every line of the '
                    f'assigned ranges and write structured notes to {s["notes"]}.',
            'context': f'First read /home/cos/projects/ulg/plan/notes/BRIEF.md in full, then '
                       f'/home/cos/projects/ulg/plan/notes/assignments/{s["id"]}.md, and follow both exactly. '
                       f'Hard rules: the only file you may create or modify anywhere is your notes file '
                       f'{s["notes"]}. Do not edit, move or delete anything else. Do not run tests, builds, '
                       f'browsers, GPU work, servers, installs, or any git command that changes state '
                       f'(git diff, log, show and status are fine). Write in English.',
        })
    save_manifest(m)
    if '--json' in sys.argv:
        print(json.dumps(tasks, indent=1))
    for s in pend:
        print(f'{s["id"]} {s["notes"]} ({s["group"]}, {s["bytes"] // 1000} KB, recent {int(s["recent_fraction"] * 100)}%)')


def norm(text):
    return re.sub(r'\s+', ' ', text).strip()


def resolve(label):
    return os.path.join(PC, label[3:]) if label.startswith('PC/') else os.path.join(ULG, label)


def verify(ids):
    m = load_manifest()
    todo = [s for s in m['slices'] if (s['id'] in ids if ids else s['status'] == 'dispatched')]
    cache = {}
    for s in todo:
        problems = []
        if not os.path.exists(s['notes']):
            s['status'] = 'failed'
            print(f'{s["id"]}: NO NOTES FILE')
            continue
        text = open(s['notes'], errors='replace').read()
        if '## SUMMARY' not in text:
            problems.append('no SUMMARY section')
        want = {f'{it["label"]}:{it["start"]}-{it["end"]}' for it in s['items']}
        cov = [l for l in text.splitlines() if l.startswith('COVERAGE:')]
        got = {c.strip() for c in cov[-1][len('COVERAGE:'):].split(';')} if cov else set()
        got.discard('')
        if not cov:
            problems.append('no COVERAGE line')
        elif got != want:
            problems.append(f'coverage differs: missing {sorted(want - got)[:3]} extra {sorted(got - want)[:3]}')
        ok = bad = 0
        bad_examples = []
        for q in re.finditer(r'Q\[([^\]\s:]+):(\d+)(?:-(\d+))?\]\s*"([^"\n]{8,})"', text):
            label, a, b, quote = q.group(1), int(q.group(2)), int(q.group(3) or q.group(2)), q.group(4)
            path = resolve(label)
            if path not in cache:
                try:
                    cache[path] = open(path, errors='replace').read().split('\n')
                except OSError:
                    cache[path] = None
            lines = cache[path]
            if lines is None:
                bad += 1
                bad_examples.append(f'{label}: no such file')
                continue
            window = norm(' '.join(lines[max(0, a - 26):b + 25]))
            needle = norm(quote.replace('…', '...').split('...')[0])[:70]
            if needle and needle in window:
                ok += 1
            else:
                bad += 1
                bad_examples.append(f'{label}:{a} "{quote[:50]}"')
        if ok + bad < 5:
            problems.append(f'only {ok + bad} checkable quotes')
        if bad > max(1, (ok + bad) // 5):
            problems.append(f'{bad}/{ok + bad} quotes not found near the cited line: {bad_examples[:3]}')
        s['quotes_ok'], s['quotes_bad'], s['notes_bytes'] = ok, bad, len(text)
        s['status'] = 'failed' if problems else 'done'
        s['problems'] = problems
        print(f'{s["id"]}: {s["status"]:6s} notes {len(text):6,d} B  quotes {ok}/{ok + bad}  ' + '; '.join(problems))
    save_manifest(m)


def summaries(ids):
    m = load_manifest()
    for s in m['slices']:
        if s['id'] in ids and os.path.exists(s['notes']):
            text = open(s['notes'], errors='replace').read()
            i = text.rfind('## SUMMARY')
            body = text[i:] if i >= 0 else '(no SUMMARY section)\n' + text[-3000:]
            print(f'=================== {s["id"]} ({s["group"]}; {s["items"][0]["label"]} ...)')
            print(body.strip())
            print()


SECTION_HEAD = re.compile(r'^(?:\*\*)?(What this slice is|[A-H]\. |Dates covered|Top five)')


def sections(keys, ids):
    """Print only some blocks of each SUMMARY: keys are letters A-H, W (what), D8 (dates), T (top five)."""
    want = set(keys.split(','))
    m = load_manifest()
    for s in m['slices']:
        if s['id'] not in ids or not os.path.exists(s['notes']):
            continue
        text = open(s['notes'], errors='replace').read()
        i = text.rfind('## SUMMARY')
        if i < 0:
            print(f'=== {s["id"]}: no SUMMARY section')
            continue
        files = ', '.join(sorted({it['label'].split('/')[-1] for it in s['items']}))[:160]
        print(f'=== {s["id"]} ({s["group"]}; {files})')
        key = None
        for line in text[i:].splitlines()[1:]:
            if line.startswith('COVERAGE'):
                break
            h = SECTION_HEAD.match(line)
            if h:
                g = h.group(1)
                key = {'What this slice is': 'W', 'Dates covered': 'D8', 'Top five': 'T'}.get(g, g[0])
            if key in want and line.strip():
                print(line)
        print()


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'status'
    if cmd == 'build':
        if os.path.exists(MANIFEST) and '--force' not in sys.argv:
            sys.exit('manifest exists; pass --force to rebuild (this resets all states)')
        build()
    elif cmd == 'next':
        kinds = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else None
        next_batch(int(sys.argv[2]), kinds)
    elif cmd == 'verify':
        verify(set(sys.argv[2:]))
    elif cmd == 'summaries':
        summaries(set(sys.argv[2:]))
    elif cmd == 'sections':
        sections(sys.argv[2], set(sys.argv[3:]))
    elif cmd == 'redo':
        m = load_manifest()
        for s in m['slices']:
            if s['id'] in sys.argv[2:]:
                s['status'] = 'pending'
        save_manifest(m)
    else:
        report(load_manifest()['slices'])


if __name__ == '__main__':
    main()
