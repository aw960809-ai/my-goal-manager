#!/usr/bin/env python3
"""Regional Circle-3 county-government sources.

Read-only adapters: HTTPS government listings, bounded detail fetch, verified dates.
Never adds undated news, restricted registration or assumed eligibility.
Existing fit/identity/dedup/lifecycle policy remains the authority.
"""
from __future__ import annotations

import re
from datetime import date
from html.parser import HTMLParser
from urllib.parse import parse_qs, urljoin, urlparse

REGIONS = {
    'miaoli_government': {
        'county': '苗栗', 'name': '苗栗縣政府活動訊息', 'host': 'www.miaoli.gov.tw',
        'url': 'https://www.miaoli.gov.tw/News.aspx?n=286&sms=9463',
        'prefix': 'auto-central-ml-', 'site': 'miaoli',
    },
    'changhua_government': {
        'county': '彰化', 'name': '彰化縣政府活動快訊', 'host': 'www.chcg.gov.tw',
        'url': 'https://www.chcg.gov.tw/ch2/actives.aspx',
        'prefix': 'auto-central-ch-', 'site': 'changhua',
    },
    'nantou_culture': {
        'county': '南投', 'name': '南投縣政府文化局藝文活動', 'host': 'www.nthcc.gov.tw',
        'url': 'https://www.nthcc.gov.tw/A4_1/list2',
        'prefix': 'auto-central-nt-', 'site': 'nantou',
    },
    'yunlin_government': {
        'county': '雲林', 'name': '雲林縣政府活動行事曆', 'host': 'www.yunlin.gov.tw',
        'url': 'https://www.yunlin.gov.tw/News.aspx?_CSN=811&n=1245&sms=16727',
        'prefix': 'auto-central-yl-', 'site': 'yunlin',
    },
}

DATE_EXPR = re.compile(r'(?<!\d)(?P<year>(?:20\d{2}|1\d{2}))\s*[年/\-.]\s*(?P<month>\d{1,2})\s*[月/\-.]\s*(?P<day>\d{1,2})\s*日?(?!\d)')
TIME_EXPR = re.compile(r'(?<!\d)([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)(?!\d)')
# Do not treat general press releases or job postings as an actionable event.
CLOSED = re.compile(r'已額滿|報名截止|停止報名|已取消|活動取消|不再受理|不受理個人報名|僅開放團體報名|須組隊報名')
IDENTITY_ONLY = re.compile(r'^(?:\[|【|（|\()?\s*(?:新住民|銀髮|樂齡|長者|原住民|原住民族|教師專用|教職員專用|身障者專屬|中高齡)')
NON_EVENTS = re.compile(r'徵才公告|招標|宣導文宣|議會開議|施政報告|停班停課|更正公告|新聞稿|財政預算|採購公告')


def iso_date(raw):
    m = DATE_EXPR.search(str(raw or ''))
    if not m:
        return ''
    yy = int(m['year'])
    if yy < 1900:
        yy += 1911
    try:
        return date(yy, int(m['month']), int(m['day'])).isoformat()
    except ValueError:
        return ''


def date_range(raw):
    matches = [iso_date(m.group()) for m in DATE_EXPR.finditer(str(raw or ''))]
    matches = [x for x in matches if x]
    if not matches:
        return '', ''
    return matches[0], matches[1] if len(matches) > 1 else matches[0]


def valid_detail(url, source):
    p = urlparse(url)
    if p.scheme != 'https' or p.hostname != source['host'] or p.username or p.password or p.port:
        return False
    q = parse_qs(p.query)
    site = source['site']
    if site == 'miaoli':
        return p.path.lower().endswith('/news_content2.aspx') and q.get('n') == ['286'] and bool(re.fullmatch(r'\d{1,12}', q.get('s',[''])[0]))
    if site == 'changhua':
        return p.path.lower() == '/ch2/active.aspx' and bool(re.fullmatch(r'\d{1,12}', q.get('bull_id',[''])[0]))
    if site == 'nantou':
        return bool(re.fullmatch(r'/A4_1/content/\d{1,12}', p.path, flags=re.I))
    if site == 'yunlin':
        return p.path.lower() in ('/news_content.aspx','/news_content_pic.aspx') and q.get('n') == ['1245'] and bool(re.fullmatch(r'\d{1,12}',q.get('s',[''])[0]))
    return False


class ListingParser(HTMLParser):
    """Collect official detail anchors plus table cells, without external parsers."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.anchors = []
        self.rows = []
        self._anchor = None
        self._row = None
        self._cell = None
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in ('script','style','noscript'):
            self._skip += 1
        if self._skip:
            return
        d = dict(attrs)
        if tag == 'tr':
            self._row = []
        if tag in ('th','td') and self._row is not None:
            self._cell = []
        if tag == 'a':
            self._anchor = {'href':d.get('href',''), 'text':[]}

    def handle_data(self, data):
        if self._skip:
            return
        s = re.sub(r'\s+', ' ', data).strip()
        if not s:
            return
        if self._anchor is not None:
            self._anchor['text'].append(s)
        if self._cell is not None:
            self._cell.append(s)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ('script','style','noscript'):
            self._skip = max(0,self._skip-1)
            return
        if tag == 'a' and self._anchor is not None:
            item = self._anchor
            item['text']=' '.join(item['text']).strip()
            self.anchors.append(item)
            self._anchor = None
        if tag in ('th','td') and self._row is not None and self._cell is not None:
            self._row.append(' '.join(self._cell).strip())
            self._cell = None
        if tag == 'tr' and self._row is not None:
            self.rows.append(self._row)
            self._row = None


def discover_listing(body, base, src, limit=8):
    p = ListingParser()
    p.feed(body.decode('utf-8','replace') if isinstance(body,bytes) else str(body))
    accepted = []
    seen = set()
    for a in p.anchors:
        full = urljoin(base, a['href']).split('#',1)[0]
        if full in seen or not valid_detail(full,src):
            continue
        title = re.sub(r'\s+', ' ', a['text']).strip()
        if not (5 <= len(title) <= 175) or title in ('更多', '詳細', '查看詳情','連結'):
            continue
        seen.add(full)
        accepted.append({'url':full,'title':title})
    if not accepted:
        return []
    # Do not treat publication dates as event dates. Allow start/end dates only
    # when an actual activity/exhibition listing row contains them.
    for row in p.rows:
        joined = ' '.join(row)
        for a in accepted:
            if a['title'] in joined and 'dates' not in a:
                # This narrow row matches an official event calendar row.
                if src['site'] in ('nantou','yunlin'):
                    dates = [v for v in row if DATE_EXPR.search(v)]
                    if dates:
                        a['dates'] = date_range(dates[-1] if src['site']=='nantou' else ' ~ '.join(dates[:2]))
                    if src['site']=='yunlin' and row:
                        a['category']=row[0]
                elif src['site']=='changhua':
                    # Other dates on this list are publication windows; do not infer.
                    pass
                break
    return accepted[:max(1,min(int(limit),10))]


def date_from_detail(site, lines):
    # Only read in the article neighborhood, not navigation or footer dates.
    if site in ('changhua','nantou','yunlin'):
        for i,line in enumerate(lines):
            if re.search(r'^(?:活動日期|活動日期\(起\)|展覽日期|演出日期)\s*[：:]?\s*$',line):
                value=' '.join(lines[i+1:i+3])
                start,end = date_range(value)
                if start:
                    return start,end
            if re.search(r'^(?:活動日期|展覽日期|演出日期)\s*[：:]\s*',line):
                start,end=date_range(line)
                if start:
                    return start,end
    if site == 'miaoli':
        for line in lines:
            # Publication date is never accepted as activity date.
            if '上版日期' in line or '下版日期' in line or '發布日期' in line:
                continue
            if re.search(r'於\s*(?:20\d{2}|1\d{2})\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日|活動日期|辦理日期|演出日期',line):
                start,end=date_range(line)
                if start:
                    return start,end
    return '', ''


def is_allowed_audience(title, lines):
    if NON_EVENTS.search(title) or IDENTITY_ONLY.search(title):
        return False
    if CLOSED.search(title):
        return False
    joined=' '.join(lines[:100])
    # Do not recommend a registration announcement that explicitly excludes
    # individual members, is full, or is targeted at a specific identity only.
    if re.search(r'限額已滿|報名已額滿|停止受理報名|不受理個人報名|限本縣(?:國中|國小|教師)|僅限(?:新住民|原住民|長者|教職員)',joined):
        return False
    return True


def _extract_lines(body, title, parse_lines):
    lines=parse_lines(body)
    key=re.sub(r'\s+','',title)[:18]
    for i,line in enumerate(lines):
        if key and key in re.sub(r'\s+','',line):
            return lines[i:i+115]
    # Fail-closed for an unrelated/generic detail page.
    return []


def build_candidate(record, detail_body, src, parse_lines, stamp):
    url,title=record['url'],record['title']
    lines=_extract_lines(detail_body,title,parse_lines)
    if len(lines)<2:
        return None, 'detail_title_unverified'
    if not is_allowed_audience(title,lines):
        return None, 'closed_or_restricted'
    start,end=record.get('dates',('',''))
    detail_start,detail_end=date_from_detail(src['site'],lines)
    if detail_start:
        # Preserve a verified multi-day range from the official calendar when
        # a detail page only repeats its start date.
        if not start or start != detail_start or not end or end == start:
            start,end=detail_start,detail_end
    if not start:
        return None,'event_date_missing'
    if end and end<start:
        return None,'invalid_date_range'
    # Keep the existing lifecycle expiry implementation unchanged: do not ingest
    # already-started exhibitions, even when they are still open to visitors.
    if start<date.today().isoformat():
        return None,'event_started_before_today'
    if start>f'{date.today().year+2}-12-31':
        return None,'event_date_implausible'
    q=urlparse(url)
    qs=parse_qs(q.query)
    suffix=(qs.get('s') or qs.get('bull_id') or [q.path.rstrip('/').split('/')[-1]])[0]
    if not re.fullmatch(r'\d{1,12}',suffix):
        return None,'invalid_detail_id'
    kind='event'
    typ='公共參與'
    if re.search(r'法律|法治|法學|司法|憲法|民法|刑法|人權',title):
        typ='法律／學術'
    elif re.search(r'外語|英文|英語|日語|國際交流|交換|海外',title):
        typ='語言／國際'
    elif re.search(r'職涯|工作坊|實習|面試|就業|履歷|創業|研習|培訓|訓練',title):
        typ='職涯／實習'
    elif re.search(r'青年|學生|教育|教學|營隊|講座',title):
        typ='教育／青少年'
    city=src['county']+'縣'
    return {
        'id':src['prefix']+suffix,'title':title,'date':start,'eventEndDate':end or start,
        'time':'','deadline':'','scope':'中部','type':typ,'kind':kind,
        'url':url,'keywords':f'{title} {city} {typ}',
        'direct':True,'team':False,'available':True,'government':True,
        'source':src['name'],'sourceId':next(k for k,v in REGIONS.items() if v is src),
        'statusText':f'官方活動頁｜日期 {start}'+(f'～{end}' if end and end!=start else '')+'；報名及實際參加資格依原站公告',
        'location':city,'organizer':src['name'],
        'audience':'參加及報名資格依官方活動公告確認',
        'openEnded':False,
        'autofetch':{'engine':'central-official-v1','sourceId':next(k for k,v in REGIONS.items() if v is src),'fetchedAt':stamp},
    }, None


def run_source(source_id, *, fetch_fn, parse_lines, stamp, limit=6, logger=print):
    src=REGIONS[source_id]
    out={'sourceId':source_id,'prefix':src['prefix'],'discovered':0,'parsedOk':0,
         'accepted':[],'skippedPast':0,'rejected':[],'fetchFailures':[],'healthy':False}
    allowlist=[src['host']]
    try:
        final,body=fetch_fn(src['url'],allowlist)
        records=discover_listing(body,final,src,limit)
        if not records:
            out['fetchFailures'].append({'url':src['url'],'reason':'no_verifiable_official_activity_links'})
            return out
        out['discovered']=len(records)
    except Exception as exc:
        out['fetchFailures'].append({'url':src['url'],'reason':str(exc)})
        return out
    # A temporary failure must not wipe the previous official regional catalog.
    for rec in records:
        try:
            _,page=fetch_fn(rec['url'],allowlist)
            candidate,reason=build_candidate(rec,page,src,parse_lines,stamp)
            if candidate is None:
                out['rejected'].append({'url':rec['url'],'reason':reason})
                if reason=='event_started_before_today':
                    out['skippedPast']+=1
                continue
            out['parsedOk']+=1
            out['accepted'].append(candidate)
        except Exception as exc:
            out['fetchFailures'].append({'url':rec['url'],'reason':str(exc)})
    # A successful fetch with only expired/restricted events is valid, but
    # structural parse failures or all network errors are not.
    structural_errors=sum(x['reason'] in ('detail_title_unverified','event_date_missing','invalid_date_range') for x in out['rejected'])
    network_errors=len(out['fetchFailures'])
    # Structural changes or any network timeouts fail closed for this source.
    # Existing persisted rows are retained by reconcile_activity_catalog().
    out['healthy']=(network_errors==0 and structural_errors==0
                    and out['discovered']>0)
    logger(f'CENTRAL_SOURCE source={source_id} healthy={out["healthy"]} links={out["discovered"]} '
           f'accepted={len(out["accepted"])} rejected={len(out["rejected"])} fetchFailed={network_errors}')
    return out
