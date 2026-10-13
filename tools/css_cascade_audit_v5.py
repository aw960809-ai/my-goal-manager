#!/usr/bin/env python3
"""V5 CSS cascade budget checker. No third-party Python dependencies.

Supported interfaces:
  python3 tools/css_cascade_audit_v5.py --self-test
  python3 tools/css_cascade_audit_v5.py --write-baseline
  python3 tools/css_cascade_audit_v5.py --check

Existing rules are measured, not automatically deleted. Only an explicitly
reviewed baseline update can change the guard's budget. This does not replace
Chromium visual checks.
"""
from __future__ import annotations
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import urlsplit

BASELINE = Path('docs/css-cascade-baseline-v5.json')
REQUIRED = {
    'goal': ['tokens.css', 'base.css', 'app-ui.css', 'design-system.css',
             'calendar.css', 'refinements.css', 'mobile-fullbleed.css',
             'toeic-embed.css', 'ui-layout-v4.css'],
    'toeic': ['style.css', 'layout-v043.css', 'preferences-v0433.css',
              'ui-layout-v4.css'],
}


def css_mask_comments(css: str) -> str:
    """Mask comments while respecting quoted strings; catch unclosed comments."""
    out = []
    i = 0
    quote = None
    while i < len(css):
        c = css[i]
        if quote:
            out.append(c)
            if c == '\\' and i + 1 < len(css):
                i += 1
                out.append(css[i])
            elif c == quote:
                quote = None
            i += 1
            continue
        if c in '\'"':
            quote = c
            out.append(c)
            i += 1
            continue
        if css.startswith('/*', i):
            end = css.find('*/', i + 2)
            if end < 0:
                raise ValueError('Unclosed CSS comment')
            out.extend(('\n' if x == '\n' else ' ') for x in css[i:end + 2])
            i = end + 2
            continue
        if css.startswith('*/', i):
            raise ValueError('Unmatched CSS comment terminator')
        out.append(c)
        i += 1
    if quote:
        raise ValueError('Unclosed CSS string')
    return ''.join(out)


def declarations(body: str) -> list[tuple[str, str]]:
    """Read leaf property/value pairs without splitting semicolons in strings."""
    parts = []
    start = 0
    quote = None
    depth = 0
    for i, ch in enumerate(body):
        if quote:
            if ch == quote and (i == 0 or body[i - 1] != '\\'):
                quote = None
        elif ch in "\'\"":
            quote = ch
        elif ch == '(':
            depth += 1
        elif ch == ')':
            depth = max(0, depth - 1)
        elif ch == ';' and depth == 0:
            parts.append(body[start:i].strip())
            start = i + 1
    if body[start:].strip():
        parts.append(body[start:].strip())
    out = []
    for part in parts:
        if ':' not in part:
            continue
        key, value = part.split(':', 1)
        key = key.strip().lower()
        if not re.fullmatch(r'--[-\w]+|[-_a-z][-\w]*', key):
            continue
        out.append((key, re.sub(r'\s+', ' ', value.strip())))
    return out


def css_metrics(css: str) -> dict[str, int]:
    masked = css_mask_comments(css)
    frames = []
    selectors = Counter()
    blocks = 0
    exact_decls = 0
    rule_start = 0
    quote = None
    for i, ch in enumerate(masked):
        if quote:
            if ch == quote and (i == 0 or masked[i - 1] != '\\'):
                quote = None
            continue
        if ch in "\'\"":
            quote = ch
            continue
        if ch == '{':
            name = masked[rule_start:i].strip()
            if not name:
                raise ValueError('CSS rule has no selector or at-rule')
            frames.append((name, i, any(name.startswith('@') for name, *_ in frames)))
            blocks += 1
            rule_start = i + 1
        elif ch == '}':
            if not frames:
                raise ValueError('Unmatched closing CSS brace')
            name, start, outer_at = frames.pop()
            if not name.startswith('@'):
                context = tuple(f[0] for f in frames if f[0].startswith('@'))
                selectors[(context, re.sub(r'\s+', ' ', name))] += 1
                pairs = declarations(masked[start + 1:i])
                seen = set()
                for pair in pairs:
                    if pair in seen:
                        exact_decls += 1
                    seen.add(pair)
            rule_start = i + 1
    if frames:
        raise ValueError('Unclosed CSS brace')
    return {
        'bytes': len(css.encode('utf-8')),
        'blocks': blocks,
        'important': len(re.findall(r'!\s*important\b', masked, flags=re.I)),
        'duplicate_scoped_rules': sum(n - 1 for n in selectors.values() if n > 1),
        'duplicate_declarations': exact_decls,
    }


def linked_css(root: Path) -> list[str]:
    page = (root / 'index.html').read_text(encoding='utf-8')
    files = []
    for m in re.finditer(r'<link\b[^>]*\brel=["\']stylesheet["\'][^>]*\bhref=["\']([^"\']+)["\']', page, re.I):
        link = urlsplit(m.group(1)).path
        if not link.startswith('./css/'):
            raise ValueError('Stylesheet must use local ./css/ path: ' + link)
        parts = Path(link).parts
        if '..' in parts or len(parts) != 2 or parts[0] != 'css':
            raise ValueError('Untrusted CSS href: ' + link)
        file = '/'.join(parts)
        if not (root / file).is_file():
            raise ValueError('Linked stylesheet missing: ' + file)
        files.append(file)
    if len(files) != len(set(files)):
        raise ValueError('Duplicate CSS <link> tags')
    return files


def inventory(root: Path, project: str) -> dict:
    if project not in REQUIRED:
        raise ValueError('Unknown project: ' + project)
    styles = sorted((root / 'css').glob('*.css'))
    expected = set(REQUIRED[project])
    actual = {p.name for p in styles}
    if not expected.issubset(actual):
        raise ValueError('Required CSS files missing: ' + ', '.join(sorted(expected - actual)))
    links = linked_css(root)
    missing = sorted('css/' + name for name in expected if 'css/' + name not in links)
    if missing:
        raise ValueError('CSS missing from HTML: ' + ', '.join(missing))
    files = {'css/' + p.name: css_metrics(p.read_text(encoding='utf-8')) for p in styles}
    return {'schema': 1, 'project': project, 'linked_stylesheets': links, 'files': files}


def check(current: dict, baseline: dict) -> list[str]:
    errors = []
    if current['project'] != baseline.get('project') or baseline.get('schema') != 1:
        errors.append('Baseline belongs to a different application or schema')
    if current['linked_stylesheets'] != baseline.get('linked_stylesheets'):
        errors.append('Stylesheet load order changed: inspect cascading and refresh reviewed baseline')
    if current['files'].keys() != baseline.get('files', {}).keys():
        errors.append('CSS file set changed: review new owner and refresh baseline')
    for file, stats in current['files'].items():
        previous = baseline.get('files', {}).get(file)
        if not previous:
            continue
        # Compare structural debt, not total rule/bytes counts: legitimate new
        # UI rules may grow the file but must avoid added cascade overrides.
        for item in ('important', 'duplicate_scoped_rules', 'duplicate_declarations'):
            if stats[item] > previous[item]:
                errors.append(f'{file}: new CSS override debt {item} {previous[item]} -> {stats[item]}')
    return errors


def self_test() -> None:
    assert css_metrics('h1{color:red;color:red;}')['duplicate_declarations'] == 1
    assert css_metrics('@media(max-width:700px){h1{color:blue}}h1{color:red}')['duplicate_scoped_rules'] == 0
    assert css_metrics('h1{color:red}h1{font-size:12px}')['duplicate_scoped_rules'] == 1
    assert css_metrics('h1{content:"{";background:url("x;y")}')['blocks'] == 1
    assert css_metrics('h1{color:red!important}h2{color:blue}')['important'] == 1
    for src in ('h1{color:red', 'h1{color:red}}', 'h1{/* missing'):
        try:
            css_metrics(src)
        except ValueError:
            pass
        else:
            raise AssertionError('Invalid CSS accepted: ' + src)
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / 'css').mkdir()
        (root / 'css/a.css').write_text('a{color:red}', encoding='utf-8')
        (root / 'index.html').write_text('<link rel="stylesheet" href="./css/a.css">', encoding='utf-8')
        assert linked_css(root) == ['css/a.css']
    print('PASS: CSS rule parsing, scoped cascade budgets, local stylesheet manifest')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', choices=tuple(REQUIRED))
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--self-test', action='store_true')
    group.add_argument('--write-baseline', action='store_true')
    group.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    if not args.project:
        parser.error('--project is required with --check or --write-baseline')
    root = Path.cwd()
    current = inventory(root, args.project)
    if args.write_baseline:
        (root / BASELINE).parent.mkdir(parents=True, exist_ok=True)
        (root / BASELINE).write_text(json.dumps(current, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print('CSS baseline recorded: ', BASELINE, 'stylesheets:', len(current['files']))
        return 0
    baseline = json.loads((root / BASELINE).read_text(encoding='utf-8'))
    errors = check(current, baseline)
    if errors:
        for error in errors:
            print('FAIL:', error, file=sys.stderr)
        return 1
    print('PASS: CSS ownership, import order, balanced syntax, and override-debt baseline (' + args.project + ')')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        print('CSS audit error:', error, file=sys.stderr)
        sys.exit(1)
