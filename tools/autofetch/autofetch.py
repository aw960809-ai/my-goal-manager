#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse

USER_AGENT = 'GoalManager-AutoFetch/96.6.4 (+https://github.com/aw960809-ai/my-goal-manager)'
MAX_BYTES = 2_000_000
AUTO_PREFIX = 'auto-yda-'
YDA_LIST = 'https://www.yda.gov.tw/EventList.aspx?pid=56&uid=101'

DEADLINE_SIGNAL = re.compile(r'報名截止|截止日期|申請截止|收件截止|徵件期間|報名期間|申請期間|投件期間|額滿提早截止|截止')
DATE_SECTION_SIGNAL = re.compile(r'活動日期及地點|活動時間及地點|活動日期|活動時間|活動期間|辦理日期|體驗期間|展出資訊')
DATE_CONTEXT_SIGNAL = re.compile(r'日期[：:｜|]|時間[：:｜|]|期間[：:｜|]|場次|說明會|宣導會|培訓|展出|體驗')
LOCATION_SIGNAL = re.compile(r'活動地點|體驗地點|辦理地點|說明會場地|地址|地點|場地')
TIME_RE = re.compile(r'(?<!\d)(\d{1,2})[：:](\d{2})(?:\s*[-–~至]\s*(\d{1,2})[：:](\d{2}))?')
FULL_DATE_RE = re.compile(r'(?<!\d)(20\d{2}|\d{3})[./\-年]\s*(\d{1,2})[./\-月]\s*(\d{1,2})日?')
PARTIAL_DATE_RE = re.compile(r'(?<![\d./\-年])(\d{1,2})[./\-月]\s*(\d{1,2})日?')
MAJOR_SECTION_RE = re.compile(r'^[壹貳參肆伍陸柒捌玖拾一二三四五六七八九十]+[、.]')

WORKFLOW = '''name: V96.6 Scheduled Activity AutoFetch\n\non:\n  schedule:\n    - cron: "17 1 * * *"\n  workflow_dispatch:\n\npermissions:\n  contents: read\n  pages: write\n  id-token: write\n\nconcurrency:\n  group: pages-autofetch\n  cancel-in-progress: true\n\njobs:\n  fetch-build-deploy:\n    runs-on: ubuntu-latest\n    environment:\n      name: github-pages\n      url: ${{ steps.deployment.outputs.page_url }}\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with:\n          python-version: "3.12"\n      - name: AutoFetch activities\n        run: |\n          python tools/autofetch/autofetch.py --apply --limit 30\n          python -m json.tool data/activities.json >/dev/null\n      - name: Existing static QA\n        run: |\n          if [ -f qa_static.py ]; then python qa_static.py; fi\n      - name: Build site\n        run: |\n          if [ -f tools_build_preview.py ]; then python tools_build_preview.py; fi\n          if [ -d _site ]; then echo "SITE_DIR=_site" >> "$GITHUB_ENV";\n          elif [ -d dist ]; then echo "SITE_DIR=dist" >> "$GITHUB_ENV";\n          else mkdir -p _autofetch_site; cp -a . _autofetch_site/repo; rm -rf _autofetch_site/repo/.git _autofetch_site/repo/data/staging; echo "SITE_DIR=_autofetch_site/repo" >> "$GITHUB_ENV"; fi\n      - uses: actions/configure-pages@v5\n      - uses: actions/upload-pages-artifact@v4\n        with:\n          path: ${{ env.SITE_DIR }}\n      - id: deployment\n        uses: actions/deploy-pages@v4\n'''

SOURCES = {
    'version': '96.6.4',
    'mode': 'whitelist',
    'default_enabled': False,
    'sources': [
        {
            'id': 'thu_official',
            'name': '東海大學官方',
            'scope': 'campus',
            'priority': 1,
            'domain_allowlist': ['thu.edu.tw'],
            'enabled': False,
            'start_urls': [],
            'fetch_type': 'html',
            'trust_level': 'official',
            'notes': '待建立東海專用 adapter 後再啟用。',
        },
        {
            'id': 'yda_official',
            'name': '教育部青年發展署',
            'scope': 'national',
            'priority': 3,
            'domain_allowlist': ['yda.gov.tw'],
            'enabled': True,
            'start_urls': [YDA_LIST],
            'fetch_type': 'html',
            'trust_level': 'official',
            'notes': 'V96.6.4 青年署專用結構化 adapter。',
        },
    ],
}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def log(message):
    print(message, flush=True)


def find_repo(start: Path) -> Path:
    p = start.expanduser().resolve()
    for q in [p, *p.parents]:
        if (q / '.git').exists() and (q / 'data/activities.json').exists():
            return q
    raise SystemExit('找不到 repository；請用 --repo 指定 ~/goal-manager-work/github-v96.5')


def install(repo: Path, src: Path):
    branch = subprocess.run(
        ['git', 'branch', '--show-current'], cwd=repo, text=True, capture_output=True
    ).stdout.strip()
    if branch == 'main':
        raise SystemExit('安全保護：拒絕直接安裝到 main，請先切到 v96.6-auto-fetch')

    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    backup = repo / 'data/staging' / f'installer-backup-{stamp}'
    backup.mkdir(parents=True, exist_ok=True)

    dest = repo / 'tools/autofetch/autofetch.py'
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        shutil.copy2(dest, backup / 'autofetch.py')
    shutil.copy2(src, dest)

    write_json(repo / 'tools/autofetch/sources.json', SOURCES)
    wf = repo / '.github/workflows/autofetch.yml'
    wf.parent.mkdir(parents=True, exist_ok=True)
    wf.write_text(WORKFLOW, encoding='utf-8')

    staging = repo / 'data/staging'
    staging.mkdir(parents=True, exist_ok=True)
    (staging / '.gitkeep').touch()
    (staging / '.gitignore').write_text('*\n!.gitignore\n!.gitkeep\n', encoding='utf-8')

    subprocess.run([sys.executable, '-m', 'py_compile', str(dest)], check=True)
    read_json(repo / 'data/activities.json')
    log('INSTALL_OK version=96.6.4')
    log('下一步： python tools/autofetch/autofetch.py --check --limit 12')


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in {'script', 'style', 'noscript'}:
            self.skip += 1
        if tag == 'a':
            href = dict(attrs).get('href')
            if href:
                self.links.append(href)

    def handle_endtag(self, tag):
        if tag.lower() in {'script', 'style', 'noscript'} and self.skip:
            self.skip -= 1


class YDADetailParser(HTMLParser):
    """Extract only the activity article between its real heading and '更多活動'."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.heading_tag = None
        self.heading_parts = []
        self.section_seen = False
        self.started = False
        self.ended = False
        self.title = None
        self.lines = []
        self.fallback = []

    @staticmethod
    def clean(value):
        return re.sub(r'\s+', ' ', value.replace('\u3000', ' ')).strip()

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in {'script', 'style', 'noscript'}:
            self.skip += 1
        if tag in {'h1', 'h2', 'h3', 'h4'}:
            self.heading_tag = tag
            self.heading_parts = []

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in {'script', 'style', 'noscript'} and self.skip:
            self.skip -= 1
        if self.heading_tag == tag:
            heading = self.clean(' '.join(self.heading_parts))
            self.heading_tag = None
            self.heading_parts = []
            if not heading:
                return
            if heading == '活動專區':
                self.section_seen = True
                return
            if self.section_seen and not self.started and heading not in {'活動列表', '成果分享'}:
                self.title = heading
                self.started = True
                self.lines.append(heading)
                return
            if self.started and not self.ended:
                if '更多活動' in heading:
                    self.ended = True
                else:
                    self.lines.append(heading)

    def handle_data(self, data):
        if self.skip:
            return
        text = self.clean(data)
        if not text:
            return
        self.fallback.append(text)
        if self.heading_tag:
            self.heading_parts.append(text)
            return
        if self.started and not self.ended:
            if '更多活動' in text:
                self.ended = True
                return
            self.lines.append(text)


def allowed(host, allowlist):
    host = (host or '').lower().strip('.')
    return any(host == a or host.endswith('.' + a) for a in [x.lower().strip('.') for x in allowlist])


def fetch(url, allowlist):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or not allowed(parsed.hostname, allowlist):
        raise RuntimeError('URL 白名單拒絕')
    cmd = [
        'curl', '--fail', '--location', '--silent', '--show-error',
        '--connect-timeout', '10', '--max-time', '30',
        '--proto', '=https', '--proto-redir', '=https',
        '--user-agent', USER_AGENT,
        '--write-out', '\n__META__%{url_effective}\t%{http_code}',
        url,
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8', 'replace').strip())
    marker = b'\n__META__'
    pos = result.stdout.rfind(marker)
    if pos < 0:
        raise RuntimeError('curl metadata missing')
    body = result.stdout[:pos]
    meta = result.stdout[pos + len(marker):].decode('utf-8', 'replace').split('\t')
    final, status = meta[0].strip(), meta[1].strip()
    final_p = urlparse(final)
    if status != '200' or final_p.scheme != 'https' or not allowed(final_p.hostname, allowlist):
        raise RuntimeError(f'HTTP/redirect 驗證失敗 {status}')
    if len(body) > MAX_BYTES:
        raise RuntimeError('頁面過大')
    return final, body


def decode_body(body: bytes) -> str:
    # YDA is UTF-8. Keep a conservative fallback for malformed responses.
    text = body.decode('utf-8', 'replace')
    if text.count('\ufffd') > max(10, len(text) // 200):
        try:
            alt = body.decode('cp950')
            if alt.count('\ufffd') < text.count('\ufffd'):
                return alt
        except Exception:
            pass
    return text


def discover_links(body: bytes, base: str):
    parser = LinkParser()
    parser.feed(decode_body(body))
    seen = set()
    output = []
    for href in parser.links:
        u = urlparse(urljoin(base, href))._replace(fragment='').geturl()
        if u not in seen:
            seen.add(u)
            output.append(u)
    return output


def fallback_detail(parser: YDADetailParser):
    lines = parser.fallback
    start = None
    for i, line in enumerate(lines):
        if ('Ctrl+P' in line or 'ctrl+P' in line) and ('列印' in line or '鍵盤' in line):
            start = i + 1
    if start is None:
        return None, []
    body = lines[start:]
    for i, line in enumerate(body):
        if '更多活動' in line:
            body = body[:i]
            break
    ignored = {'活動專區', '活動列表', '小', '中', '大', '分享', 'Facebook', 'Line', 'Twitter', ':::'}
    body = [x for x in body if x not in ignored]
    title = None
    for x in body[:12]:
        if 4 <= len(x) <= 180 and x not in ignored:
            title = x
            break
    return title, body


def parse_yda_detail(body: bytes):
    parser = YDADetailParser()
    parser.feed(decode_body(body))
    title = parser.title
    lines = parser.lines
    if not title or len(lines) < 2:
        title, lines = fallback_detail(parser)
    # Normalize duplicates caused by nested inline elements while preserving order.
    out = []
    for line in lines:
        line = re.sub(r'\s+', ' ', line).strip()
        if not line:
            continue
        if out and line == out[-1]:
            continue
        out.append(line)
    return title, out


def is_detail(url):
    p = urlparse(url)
    q = parse_qs(p.query)
    return (
        p.scheme == 'https'
        and p.hostname in {'yda.gov.tw', 'www.yda.gov.tw'}
        and p.path.lower().endswith('/eventdoc.aspx')
        and bool(q.get('eid') and q['eid'][0].isdigit())
    )


def eid(url):
    return parse_qs(urlparse(url).query).get('eid', [''])[0]


def roc(year):
    year = int(year)
    return year + 1911 if year < 1911 else year


def mkdate(year, month, day):
    try:
        return date(int(year), int(month), int(day)).isoformat()
    except Exception:
        return None


def context_year(title, lines):
    for line in [title or '', *lines[:40]]:
        m = re.search(r'(?<!\d)(20\d{2})年?', line)
        if m:
            return int(m.group(1))
        m = re.search(r'(?<!\d)(\d{3})年', line)
        if m:
            return roc(m.group(1))
    return None


WEEKDAY_MAP = {
    '一': 0, '二': 1, '三': 2, '四': 3,
    '五': 4, '六': 5, '日': 6, '天': 6,
}


def year_from_weekday(line, match, context):
    """Resolve partial M/D dates using a nearby Chinese weekday.

    Weekday evidence overrides a plan/program year from the title.
    Example: "115年...計畫" can describe a briefing held
    on 2025-11-26（週三）for the 2026 plan year.
    """
    tail = line[match.end():match.end() + 18]
    wm = re.search(r'[（(]?\s*(?:週|星期)\s*([一二三四五六日天])', tail)
    if not wm:
        return None

    target = WEEKDAY_MAP[wm.group(1)]
    month = int(match.group(1))
    day = int(match.group(2))
    base = int(context or date.today().year)

    candidates = [
        base, base - 1, base + 1, base - 2, base + 2,
        date.today().year, date.today().year - 1, date.today().year + 1,
    ]

    seen = set()
    for y in candidates:
        if y in seen:
            continue
        seen.add(y)
        try:
            d = date(y, month, day)
        except ValueError:
            continue
        if d.weekday() == target:
            return y
    return None


def dates_in_line(line, year):
    values = []
    spans = []

    for m in FULL_DATE_RE.finditer(line):
        value = mkdate(roc(m.group(1)), m.group(2), m.group(3))
        if value:
            values.append(value)
            spans.append(m.span())

    for m in PARTIAL_DATE_RE.finditer(line):
        if any(a <= m.start() < b for a, b in spans):
            continue

        resolved_year = year_from_weekday(line, m, year)
        if resolved_year is None:
            resolved_year = year

        if resolved_year:
            value = mkdate(resolved_year, m.group(1), m.group(2))
            if value:
                values.append(value)

    return list(dict.fromkeys(values))


def deadline_of(lines, year):
    for line in lines:
        if DEADLINE_SIGNAL.search(line):
            ds = dates_in_line(line, year)
            if ds:
                return ds[-1]
    return None


def section_event_dates(lines, year, deadline):
    """Prefer dates inside a named activity-date section."""
    collected = []
    active = False
    for i, line in enumerate(lines):
        if DATE_SECTION_SIGNAL.search(line):
            active = True
            ds = dates_in_line(line, year)
            collected.extend(ds)
            continue
        if active:
            if DEADLINE_SIGNAL.search(line) or '重要時程' in line or '報名方式' in line or '報名連結' in line:
                break
            if MAJOR_SECTION_RE.match(line) and not DATE_CONTEXT_SIGNAL.search(line):
                break
            ds = dates_in_line(line, year)
            collected.extend(ds)
            if len(collected) >= 12:
                break
    collected = [d for d in dict.fromkeys(collected) if d != deadline]
    if collected:
        return collected[0], (collected[-1] if len(collected) > 1 else None)
    return None, None


def scored_event_dates(lines, year, deadline):
    candidates = []
    for i, line in enumerate(lines):
        ds = dates_in_line(line, year)
        if not ds:
            continue
        score = 0
        if DATE_CONTEXT_SIGNAL.search(line):
            score += 8
        if TIME_RE.search(line):
            score += 6
        if any(k in line for k in ['活動', '體驗', '展出', '培訓', '宣導會', '說明會', '課程場', '實作場']):
            score += 4
        if DEADLINE_SIGNAL.search(line):
            score -= 12
        if any(k in line for k in ['公告', '發布', '更新', '敬啟']):
            score -= 10
        if re.fullmatch(r'\s*(?:20\d{2}|\d{3})年\d{1,2}月\d{1,2}日\s*', line):
            score -= 8
        candidates.append((score, -i, ds))
    if not candidates:
        return None, None
    candidates.sort(reverse=True)
    best = candidates[0][0]
    selected = []
    for score, _, ds in candidates:
        if score < max(1, best - 2):
            continue
        for d in ds:
            if d != deadline and d not in selected:
                selected.append(d)
    if selected:
        return selected[0], (selected[-1] if len(selected) > 1 else None)
    return None, None


def event_dates(lines, year, deadline):
    start, end = section_event_dates(lines, year, deadline)
    if start:
        return start, end
    return scored_event_dates(lines, year, deadline)


def location_of(lines):
    for line in lines:
        if not LOCATION_SIGNAL.search(line):
            continue
        value = re.split(r'活動地點|體驗地點|辦理地點|說明會場地|地址|地點|場地', line, maxsplit=1)[-1]
        value = value.lstrip('：:｜|◎●• -–—').strip()
        if value and len(value) <= 300:
            return value
    return None


def time_of(lines):
    for line in lines:
        if DATE_CONTEXT_SIGNAL.search(line) or '場次' in line:
            m = TIME_RE.search(line)
            if m:
                return f'{int(m.group(1)):02d}:{m.group(2)}' + (
                    f'–{int(m.group(3)):02d}:{m.group(4)}' if m.group(3) else ''
                )
    return ''


def classify(title, body, location):
    s = f'{title} {body[:2500]} {location or ""}'
    scope = '線上／海外' if re.search(r'海外|國際|度假打工|交換|全球|Webex|Google Meet|線上', s, re.I) else '全臺'
    if re.search(r'法律|憲法|民法|刑法|學術', s):
        typ = '法律／學術'
    elif re.search(r'英語|日語|語言|國際|海外|交換|度假打工', s):
        typ = '語言／國際'
    elif re.search(r'工作|實習|職涯|履歷|創業|職場|培訓', s):
        typ = '職涯／實習'
    elif re.search(r'青少年|教育|教學|課程|營隊', s):
        typ = '教育／青少年'
    else:
        typ = '公共參與'
    return scope, typ


def build_candidate(url, body):
    title, lines = parse_yda_detail(body)
    if not title:
        return None, 'no_activity_heading'
    if title in {'活動專區', '活動列表'} or '活動列表 - 教育部青年發展署' in title:
        return None, 'generic_heading'
    if len(title) < 4 or len(title) > 180:
        return None, 'invalid_heading_length'
    if len(lines) < 2:
        return None, 'article_too_short'

    year = context_year(title, lines)
    deadline = deadline_of(lines, year)
    start, end = event_dates(lines, year, deadline)
    location = location_of(lines)
    time_value = time_of(lines)
    scope, typ = classify(title, '\n'.join(lines), location)

    action_date = start or deadline or ''
    status = ['教育部青年發展署官方活動']
    if start:
        status.append('活動日 ' + start + (('–' + end) if end else ''))
    if deadline:
        status.append('截止 ' + deadline)

    candidate = {
        'id': AUTO_PREFIX + eid(url),
        'title': title,
        'date': action_date,
        'time': time_value,
        'scope': scope,
        'type': typ,
        'kind': 'event',
        'url': url,
        'keywords': f'{title} 青年 教育部 青年發展署 {typ} {scope}',
        'direct': True,
        'team': False,
        'available': True,
        'source': '教育部青年發展署',
        'statusText': '；'.join(status),
        'government': True,
        'deadline': deadline or '',
        'eventEndDate': end or '',
        'location': location or '',
        'autofetch': {
            'engine': 'V96.6.4',
            'sourceId': 'yda_official',
            'eid': eid(url),
            'fetchedAt': now_iso(),
        },
    }
    return candidate, None


def actionable_status(candidate):
    """Return (is_actionable, reason).

    Policy for the main Activity Radar:
    - If a machine-readable registration/application deadline exists and it is
      already past, the item is NOT actionable even when the event itself is
      still in the future.
    - If there is no deadline, a future event date/end date can remain visible.
    - If all relevant dates are in the past or missing, it is not actionable.
    """
    today = date.today().isoformat()
    deadline = candidate.get('deadline', '')
    start = candidate.get('date', '')
    end = candidate.get('eventEndDate', '')

    if deadline and deadline < today:
        return False, 'deadline_passed'

    if deadline and deadline >= today:
        return True, 'deadline_open'

    if end and end >= today:
        return True, 'event_future'

    if start and start >= today:
        return True, 'event_future'

    return False, 'past_or_undated'


def run(repo, limit, apply):
    src = next(x for x in SOURCES['sources'] if x['id'] == 'yda_official')
    allowlist = src['domain_allowlist']
    final, body = fetch(YDA_LIST, allowlist)
    links = discover_links(body, final)

    details = []
    seen = set()
    for url in links:
        if is_detail(url) and eid(url) not in seen:
            seen.add(eid(url))
            details.append(url)
        if len(details) >= limit:
            break

    accepted = []
    skipped_past = 0
    rejected = []
    fetch_failed = []
    parsed_ok = 0

    for i, url in enumerate(details, 1):
        try:
            _, detail_body = fetch(url, allowlist)
            candidate, reason = build_candidate(url, detail_body)
            if candidate is None:
                rejected.append({'url': url, 'reason': reason})
                log(f'YDA {i:02d}/{len(details):02d} REJECT reason={reason}')
                continue
            parsed_ok += 1
            actionable, action_reason = actionable_status(candidate)
            if actionable:
                accepted.append(candidate)
                log(
                    f'YDA {i:02d}/{len(details):02d} ACCEPT '
                    f'reason={action_reason} date={candidate["date"] or "-"} '
                    f'deadline={candidate["deadline"] or "-"} '
                    f'title={candidate["title"]}'
                )
            else:
                skipped_past += 1
                label = 'SKIP_DEADLINE' if action_reason == 'deadline_passed' else 'SKIP_PAST'
                log(
                    f'YDA {i:02d}/{len(details):02d} {label} '
                    f'date={candidate["date"] or "-"} '
                    f'deadline={candidate["deadline"] or "-"} '
                    f'title={candidate["title"]}'
                )
        except Exception as exc:
            fetch_failed.append({'url': url, 'reason': str(exc)})
            log(f'YDA {i:02d}/{len(details):02d} FAIL {exc}')

    accepted = list({c['id']: c for c in accepted}.values())
    accepted.sort(key=lambda x: (x.get('date') or '9999-12-31', x['title']))

    staging = repo / 'data/staging'
    write_json(staging / 'autofetch-candidates.json', {'events': accepted})
    report = {
        'schemaVersion': '96.6.4-report-1',
        'generatedAt': now_iso(),
        'mode': 'apply' if apply else 'check',
        'summary': {
            'discovered': len(details),
            'parsedOk': parsed_ok,
            'accepted': len(accepted),
            'skippedPast': skipped_past,
            'rejected': len(rejected),
            'fetchFailed': len(fetch_failed),
        },
        'rejected': rejected,
        'fetchFailures': fetch_failed,
    }
    write_json(staging / 'autofetch-report.json', report)

    if apply:
        discovered = len(details)
        healthy = discovered > 0 and parsed_ok >= max(1, (discovered * 7) // 10) and len(fetch_failed) <= max(1, discovered // 5)
        if not healthy:
            raise RuntimeError('fail-closed：解析健康度不足，不覆蓋正式資料')

        activities_file = repo / 'data/activities.json'
        payload = read_json(activities_file)
        existing = payload.get('events', [])
        preserved = [e for e in existing if not str(e.get('id', '')).startswith(AUTO_PREFIX)]

        backup_dir = staging / 'backups'
        backup_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(
            activities_file,
            backup_dir / f'activities-{datetime.now().strftime("%Y%m%d-%H%M%S")}.json',
        )

        merged = preserved + accepted
        meta = dict(payload.get('meta', {}))
        meta.update({
            'updatedAt': now_iso(),
            'events': len(merged),
            'ok': len(accepted),
            'failed': len(rejected) + len(fetch_failed),
            'errors': [x['reason'] for x in rejected + fetch_failed][:20],
            'generator': 'V96.6.4 AutoFetch + Activity Radar',
        })
        write_json(activities_file, {'meta': meta, 'events': merged})
        log(
            f'AUTOFETCH_APPLY_OK discovered={len(details)} parsed={parsed_ok} '
            f'accepted={len(accepted)} skippedPast={skipped_past} rejected={len(rejected)} fetchFailed={len(fetch_failed)}'
        )
    else:
        log(
            f'AUTOFETCH_CHECK_OK discovered={len(details)} parsed={parsed_ok} '
            f'accepted={len(accepted)} skippedPast={skipped_past} rejected={len(rejected)} fetchFailed={len(fetch_failed)}'
        )
        log('production data was NOT changed')


def self_test():
    fixture = '''<!doctype html><html><body>
    <h2>活動專區</h2><div>小 中 大</div><div>請使用鍵盤按住Ctrl+P列印</div>
    <h2>115年U-start創創展示會「U-start創新創業主題專區」</h2>
    <p>📍 展出資訊</p><p>日期｜115年11月19日（四） 至 115年11月21日（六）</p>
    <p>地點｜臺北圓山花博園區（台北市中山區玉門街1號）</p>
    <p>📅 重要時程</p><p>徵件期間｜即日起至115年9月4日（五）止</p>
    <h3>更多活動</h3><p>活動日期：2021-07-09 ~ 2021-08-20</p>
    </body></html>'''.encode('utf-8')
    c, reason = build_candidate('https://www.yda.gov.tw/eventDoc.aspx?eid=119&pid=56&uid=101', fixture)
    assert reason is None and c
    assert c['title'].startswith('115年U-start')
    assert c['date'] == '2026-11-19', c
    assert c['eventEndDate'] == '2026-11-21', c
    assert c['deadline'] == '2026-09-04', c
    assert not c['date'].startswith('2021-')

    fixture2 = '''<html><body><h2>活動專區</h2><h2>〖115年青年海外度假打工宣導會〗開始報名！</h2>
    <p>教育部青年發展署敬啟</p><p>115年6月30日</p><h3>參、活動日期及地點</h3>
    <p>一、日期：7月17日（五）13：30-16：45</p><p>二、地址：臺大醫院國際會議中心301廳</p>
    <p>伍、 報名方式</p><p>報名期間自即日起至額滿為止</p><div>更多活動</div><p>活動日期：2021-07-09</p></body></html>'''.encode('utf-8')
    c2, reason2 = build_candidate('https://www.yda.gov.tw/eventDoc.aspx?eid=118&pid=56&uid=101', fixture2)
    assert reason2 is None and c2
    assert c2['date'] == '2026-07-17', c2
    assert c2['location'].startswith('臺大醫院'), c2
    wd = dates_in_line('場次1：11月26日（週三）19:00-20:30', 2026)
    assert wd == ['2025-11-26'], wd

    # Actionability policy regression:
    # event in the future but deadline already passed -> exclude from main radar
    action, why = actionable_status({
        'date': '2099-11-19',
        'eventEndDate': '2099-11-21',
        'deadline': '2000-09-04',
    })
    assert action is False and why == 'deadline_passed', (action, why)

    # no deadline + future event -> still actionable
    action2, why2 = actionable_status({
        'date': '2099-07-17',
        'eventEndDate': '',
        'deadline': '',
    })
    assert action2 is True and why2 == 'event_future', (action2, why2)

    log('SELF_TEST_OK version=96.6.4')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', default='.')
    ap.add_argument('--install', action='store_true')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--limit', type=int, default=12)
    args = ap.parse_args()

    if args.self_test:
        self_test()
        return

    repo = find_repo(Path(args.repo))
    if args.install:
        install(repo, Path(__file__).resolve())
        return
    run(repo, max(1, min(args.limit, 50)), args.apply)


if __name__ == '__main__':
    main()
