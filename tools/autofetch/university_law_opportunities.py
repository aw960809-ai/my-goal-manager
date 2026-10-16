#!/usr/bin/env python3
"""Verified public university law lectures (NTU + NCCU), fail-closed.

Only official HTTPS law-school notices with a future date, verifiable place and
explicit open attendance are auto-recommended. A restricted or registration-
unknown event is NOT made available by assuming any eligibility.
"""
from __future__ import annotations

from datetime import date
from hashlib import sha256
from html.parser import HTMLParser
import re
from urllib.parse import unquote, urljoin, urlparse

from moc_national_opportunities import date_key

SOURCES = {
    'ntu_law': {
        'host': 'www.law.ntu.edu.tw',
        'url': 'https://www.law.ntu.edu.tw/',
        'name': '國立臺灣大學法律學院學術活動',
        'prefix': 'auto-law-ntu-',
        'location': '臺北市',
    },
    'nccu_law': {
        'host': 'law.nccu.edu.tw',
        'url': 'https://law.nccu.edu.tw/zh_tw/news/events',
        'name': '國立政治大學法學院學術活動',
        'prefix': 'auto-law-nccu-',
        'location': '臺北市',
    },
}
DATE_LINE = re.compile(r'^(?:時間|日期|活動日期|活動時間|辦理日期|演講時間|研討會時間|日期及時間)\s*[:：]')
LOCATION_LINE = re.compile(r'^(?:地點|活動地點|場地|舉辦地點|演講地點|研討會地點)\s*[:：]')
OPEN_ATTENDANCE = re.compile(r'無需報名|免(?:事先)?報名|自由入場|自由入座|自由參加|開放一般民眾參加|歡迎社會大眾參加')
BLOCKED = re.compile(r'活動取消|取消辦理|停止舉辦|報名已額滿|已額滿|停止報名|不開放現場候補|僅限(?:本校|本院|本系|教職員|教師|法官|檢察官|律師|碩士|博士)|限(?:本校|本院|本系)')
LEGAL_TOPIC = re.compile(r'法律|法學|民法|刑法|憲法|行政法|法官|法理|司法|人權|裁判|訴訟|國際法|財經法|公司法|勞動法|學術研討|專題演講|研究交流|法哲學|法律政策|WTO', re.I)
STOP_LINE = re.compile(r'^(?:更多相關文章|More in this category|學術出版|場地借用|資源連結|法規公告|回到上一頁)$', re.I)


class AnchorParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.current = None
        self.depth = 0
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in ('script', 'style', 'noscript'):
            self.skip += 1
        if self.skip:
            return
        if tag == 'a':
            if self.current is None:
                d = dict(attrs)
                self.current = {'href': d.get('href',''), 'words': [], 'title': d.get('title','')}
                self.depth = 1
            else:
                self.depth += 1

    def handle_data(self, data):
        if not self.skip and self.current is not None:
            self.current['words'].append(data)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ('script', 'style', 'noscript'):
            self.skip = max(0, self.skip - 1)
            return
        if tag == 'a' and self.current is not None:
            self.depth -= 1
            if self.depth <= 0:
                c = self.current
                title = re.sub(r'\s+', ' ', ''.join(c['words']) or c['title']).strip()
                self.rows.append((c['href'], title))
                self.current = None


def valid_detail(url, spec):
    p = urlparse(url)
    if (p.scheme != 'https' or p.hostname != spec['host'] or
            p.port is not None or p.username or p.password or len(url) > 1200):
        return False
    path = unquote(p.path).lower()
    if spec['prefix'] == 'auto-law-ntu-':
        return '/公告/item/' in path
    return path.startswith('/zh_tw/news/events/') and len(path) > len('/zh_tw/news/events/')


def listing_details(body, base, spec, limit=12):
    parser = AnchorParser()
    parser.feed(body.decode('utf-8', 'replace') if isinstance(body,bytes) else str(body))
    seen = set()
    result = []
    for href, title in parser.rows:
        full = urljoin(base, href).split('#')[0]
        if not valid_detail(full, spec) or full in seen:
            continue
        # Only actual legal or academic opportunities; exclude awards/results.
        if not (6 <= len(title) <= 200) or not LEGAL_TOPIC.search(title):
            continue
        if re.search(r'得獎|圓滿落幕|活動報導|已舉辦|錄取名單|頒獎', title):
            continue
        seen.add(full)
        result.append({'url':full, 'title':title})
        if len(result) >= limit:
            break
    return result


def _trim_article(lines, title):
    key = re.sub(r'\s+', '', title)[:22]
    matches = [i for i, v in enumerate(lines) if key and key in re.sub(r'\s+', '', str(v))]
    if not matches:
        return []
    # Prefer the heading that is followed by the dated article, not <title>.
    index = next((i for i in reversed(matches)
                  if any(DATE_LINE.search(s.strip()) and date_key(s)
                         for s in lines[i:i+95])), matches[-1])
    section = []
    for line in lines[index:index+130]:
        line = re.sub(r'\s+', ' ', str(line or '')).strip()
        if STOP_LINE.search(line):
            break
        if line:
            section.append(line)
    return section


def _venue_near(lines, i):
    for candidate in lines[i+1:i+8]:
        if DATE_LINE.search(candidate) and date_key(candidate):
            break
        if LOCATION_LINE.search(candidate):
            value = re.sub(LOCATION_LINE, '', candidate).strip()
            return value[:150]
    return ''


def _clock_from(line):
    m = re.search(r'(?<!\d)([01]?\d|2[0-3]):([0-5]\d)',line)
    if not m:
        return ''
    hh = int(m.group(1))
    if '下午' in line and hh < 12:
        hh += 12
    return f'{hh:02d}:{m.group(2)}'


def events_from_detail(record, body, spec, parse_lines, stamp, *, today=None):
    today = today or date.today()
    title = record['title'].strip()
    raw_lines = parse_lines(body)
    section = _trim_article(raw_lines, title)
    if not section:
        return [], 'detail_heading_unverified'
    body_text = ' '.join(section)
    # Critical eligibility boundary: missing evidence of OPEN attendance => exclude.
    if BLOCKED.search(body_text) or not OPEN_ATTENDANCE.search(body_text):
        return [], 'attendance_not_verified_or_closed'
    results = []
    for i, line in enumerate(section):
        if not DATE_LINE.search(line):
            continue
        day = date_key(line)
        if not day or not today.isoformat() <= day <= f'{today.year+2}-12-31':
            continue
        venue = _venue_near(section,i)
        if not venue and re.search(r'線上|webinar|online', body_text, re.I):
            venue = '線上活動（請見學院原公告）'
        if not venue:
            continue
        # Prefer the event topic of this session when a single post contains
        # several dated sessions. Do not infer topics from unrelated footers.
        session_topic = section[i-1].strip() if i else ''
        # Structured legal notices sometimes place the true lecture topic
        # after the date/location fields (NCCU), unlike NTU multi-session posts.
        for nearby in section[i+1:i+6]:
            m = re.match(r'^(?:主題|題目|講題)\s*[:：]\s*(.+)$', nearby)
            if m and m.group(1).strip():
                session_topic = m.group(1).strip()
                break
        if (session_topic and len(session_topic) <= 88 and
                not re.match(r'^(?:場次|日期|時間|主辦|活動|蔡墩銘教授)',session_topic) and
                session_topic not in title):
            display_title = f'{spec["name"].split("學術活動")[0]}｜{session_topic}'
        else:
            display_title = title
        clock = _clock_from(line)
        event_id = spec['prefix'] + sha256((record['url']+'\n'+day+'\n'+clock).encode()).hexdigest()[:20]
        results.append({
            'id':event_id, 'title':display_title[:170], 'date':day,
            'eventEndDate':day, 'time':clock, 'deadline':'', 'scope':'全國',
            'type':'法律／學術', 'kind':'event', 'url':record['url'],
            'keywords':f'{title} {session_topic}', 'direct':True, 'team':False,
            'available':True, 'government':False, 'source':spec['name'],
            'sourceId':next(k for k,v in SOURCES.items() if v is spec),
            'location':venue, 'organizer':spec['name'],
            'audience':'官方明示自由入場／無需報名；實際條件依官方公告',
            'openEnded':False,
            'statusText':f'法律學院官網：已確認開放參與；活動日期 {day}，地點及入場規則請依原公告。',
            'autofetch':{
                'engine':'official-university-law-v1',
                'sourceId':next(k for k,v in SOURCES.items() if v is spec),
                'fetchedAt':stamp,
            }
        })
    # A verified article with old events is a valid zero-result state.
    uniq = {r['id']:r for r in results}
    return list(uniq.values()), None


def run_source(source_id, *, fetch_fn, parse_lines, stamp, limit=12, logger=print, today=None):
    spec=SOURCES[source_id]
    out={'sourceId':source_id,'prefix':spec['prefix'],'discovered':0,
         'parsedOk':0,'accepted':[],'skippedPast':0,'rejected':[],
         'fetchFailures':[],'healthy':False}
    allowlist=[spec['host']]
    try:
        final, body = fetch_fn(spec['url'], allowlist)
        if urlparse(final).hostname != spec['host']:
            raise ValueError('官方清單網域變更，已拒絕')
        listings = listing_details(body, final, spec,limit=min(24,max(12,limit*2)))
        if not listings:
            out['fetchFailures'].append({'url':spec['url'],'reason':'official_listing_structure_not_verified'})
            return out
        out['discovered']=len(listings)
    except Exception as exc:
        out['fetchFailures'].append({'url':spec['url'],'reason':str(exc)})
        return out
    accepted=[]
    parsed_pages=0
    for rec in listings:
        try:
            final, detail=fetch_fn(rec['url'],allowlist)
            if not valid_detail(final,spec):
                raise ValueError('非官方活動詳情網頁')
            events,reason=events_from_detail(rec,detail,spec,parse_lines,stamp,today=today)
            if reason=='detail_heading_unverified':
                out['rejected'].append({'url':rec['url'],'reason':reason})
                continue
            parsed_pages+=1
            accepted.extend(events)
        except Exception as exc:
            out['fetchFailures'].append({'url':rec['url'],'reason':str(exc)})
    structural=sum(x['reason']=='detail_heading_unverified' for x in out['rejected'])
    out['parsedOk']=parsed_pages
    out['healthy']=parsed_pages>0 and not out['fetchFailures'] and not structural
    out['accepted']=list({r['id']:r for r in accepted}.values())[:max(1,limit)] if out['healthy'] else []
    logger(f'UNIVERSITY_LAW source={source_id} healthy={out["healthy"]} '
           f'listing={out["discovered"]} parsed={parsed_pages} accepted={len(out["accepted"])} '
           f'fetchFailed={len(out["fetchFailures"])}')
    return out
