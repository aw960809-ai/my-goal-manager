#!/usr/bin/env python3
"""Official nationwide event adapter for Goal Manager Activity Radar.

Uses the Ministry of Culture's documented iCulture structured feeds (lecture,
course, competition, open call), without a county limitation.  This is an
additional nationwide source, not a mirror of every ministry's opportunities.

Feed guide: https://data.gov.tw/dataset/6478
Categories: 7 lectures, 19 courses, 13 competitions, 14 open calls.

Security: official HTTPS feed with domain validation; records may only use an
HTTPS link directly supplied by that verified feed; no fabricated registration
pages; no HTTP/SSRF or private-host URLs; no applicant eligibility assumptions.
"""
from __future__ import annotations

from datetime import date
import html
import ipaddress
import json
import re
from urllib.parse import urlparse

SOURCE_ID = 'moc_national'
PREFIX = 'auto-moc-national-'
FEED_DOMAIN = 'cloud.culture.tw'
API_ROOT = ('https://cloud.culture.tw/frontsite/trans/'
            'SearchShowAction.do?method=doFindTypeJ&category=')
CATEGORIES = ('7', '19', '13', '14')
TYPES = {'7':'講座／研討', '19':'研習／進修', '13':'競賽／表達', '14':'徵件／徵選'}
DATE_RE = re.compile(r'(?<!\d)(?P<year>20\d{2}|1\d{2})[-/.年](?P<month>\d{1,2})[-/.月](?P<day>\d{1,2})日?(?!\d)')
# No general "講座" or "文化" signal: a broad nationwide catalogue must not
# overwhelm Goal Manager with irrelevant concerts, craft shows or paid markets.
TOPIC_RULES = (
    ('法律／公民', re.compile(r'法律|法學|法治|司法|憲法|民法|刑法|行政法|勞動法|人權|著作權|智慧財產|個資|隱私權|公民參與|公共政策|媒體識讀')),
    ('語言／國際', re.compile(r'英語|英文|日語|日文|多益|托福|雅思|外語|雙語|翻譯|口譯|國際交流|海外交流|跨國|交換學生|跨文化')),
    ('辯論／表達', re.compile(r'辯論|論辯|演辯|論證|思辨|批判思考|公眾演說|口語表達|寫作|徵文|徵稿|論壇|議題倡議')),
    ('學習／生涯', re.compile(r'大學生|大專學生|大專院校|大專校院|青年|職涯|實習|學術研究|社會科學|學術研討|創業|創新|AI應用|人工智慧|金融素養|投資理財|數位素養|自主學習|生涯探索')),
)
CLOSED_RE = re.compile(r'取消辦理|活動取消|已停辦|停止報名|報名截止|報名已截止|報名已額滿|已額滿|徵件截止|停止徵件')
RESTRICTED_TITLE = re.compile(r'^[【［（(\[]?\s*(?:國小專屬|國中專屬|教師專用|教職員專用|銀髮|樂齡|長者|原住民專屬|身障專屬|新住民專屬)')
RESTRICTED_DETAILS = re.compile(r'僅限(?:教師|教職員|國小|國中|原住民|身心障礙|新住民|銀髮|本校教職員)|不開放一般民眾|不受理個人報名')
ADDRESS_ONLINE = re.compile(r'線上|線上參與|直播|遠距|webinar|online', re.I)
CATE_WEIGHT = {'7':0, '19':0, '13':0, '14':0}


def date_key(value):
    match = DATE_RE.search(str(value or ''))
    if not match:
        return ''
    year = int(match['year'])
    if year < 1900:
        year += 1911
    try:
        return date(year, int(match['month']), int(match['day'])).isoformat()
    except ValueError:
        return ''


def clean_text(value, maximum=1400):
    if isinstance(value, list):
        value = '、'.join(str(x) for x in value[:8])
    value = str(value or '')
    # Strip tags and decode entities, for read-only feed data. HTML not rendered.
    value = html.unescape(re.sub(r'<[^>]{0,4000}>', ' ', value))
    return re.sub(r'\s+', ' ', value).strip()[:maximum]


def record_url(raw):
    """Only use source-provided HTTPS public web URLs (not scraped redirects)."""
    raw = str(raw or '').strip()
    if len(raw) > 1500 or any(c.isspace() for c in raw):
        return ''
    try:
        p = urlparse(raw)
        if p.scheme != 'https' or not p.hostname or p.username or p.password or p.port is not None:
            return ''
        host = p.hostname.lower().strip('.')
        if not re.fullmatch(r'[a-z0-9.-]{5,253}', host) or '..' in host:
            return ''
        if host in ('localhost','localhost.localdomain') or host.endswith(('.local','.localhost','.invalid','.internal')):
            return ''
        try:
            ipaddress.ip_address(host)
            return ''  # no IP literals, even public IPs, in event links
        except ValueError:
            pass
        if host.count('.') < 1:
            return ''
        # .example/.test and untrusted internal suffixes are not real pages.
        if host.endswith(('.example','.test')):
            return ''
        if p.fragment and len(p.fragment)>100:
            return ''
    except ValueError:
        return ''
    return raw


def parse_feed(body):
    if not isinstance(body, (bytes, str)):
        raise ValueError('文化部回應型態錯誤')
    raw = body.decode('utf-8-sig','strict') if isinstance(body,bytes) else body
    if len(raw) > 12_000_000:
        raise ValueError('文化部回應超過預期大小')
    doc = json.loads(raw)
    if not isinstance(doc, list) or len(doc) > 40000:
        raise ValueError('文化部回應不是有界 JSON 陣列')
    if doc and not any(isinstance(x,dict) and 'UID' in x and 'title' in x and 'showInfo' in x for x in doc):
        raise ValueError('文化部欄位結構不符')
    return doc


def matching_topics(title):
    return [name for name, rule in TOPIC_RULES if rule.search(title)]


def event_candidate(row, category, stamp, today=None):
    if not isinstance(row,dict):
        return None
    today = today or date.today()
    uid=str(row.get('UID') or '').strip()
    if not re.fullmatch(r'[A-Za-z0-9_-]{6,100}',uid):
        return None
    # The feed's category must match the source-specific query.
    if str(row.get('category') or category) != str(category):
        return None
    title=clean_text(row.get('title'),175)
    if not (5<=len(title)<=175) or CLOSED_RE.search(title) or RESTRICTED_TITLE.search(title):
        return None
    topics=matching_topics(title)
    if not topics:
        return None
    description=clean_text(row.get('descriptionFilterHtml'),1800)
    if RESTRICTED_DETAILS.search(description[:700]) or CLOSED_RE.search(description[:230]):
        return None
    info=row.get('showInfo')
    if isinstance(info,dict):
        info=[info]
    if not isinstance(info,list):
        return None
    sessions=[]
    for item in info[:100]:
        if not isinstance(item,dict):
            continue
        raw_time=item.get('time')
        start=date_key(raw_time)
        if not start or not today.isoformat()<=start<=f'{today.year+2}-12-31':
            continue
        raw_end=item.get('endTime')
        end=date_key(raw_end) or start
        if end<start:
            continue
        loc=clean_text(item.get('location'),200)
        venue=clean_text(item.get('locationName'),140)
        if not loc and not venue and not ADDRESS_ONLINE.search(title+' '+description[:200]):
            # A real-world event with no known place cannot be treated as actionable.
            continue
        if not loc and not venue:
            venue='線上活動（詳見官方活動連結）'
        time_match=re.search(r'(?:\s|T)([01]\d|2[0-3]):([0-5]\d)',str(raw_time or ''))
        clock=':'.join(time_match.groups()) if time_match else ''
        sessions.append((start,end,loc or venue,clock))
    if not sessions:
        return None
    start,end,venue,clock=min(sessions)
    # Don't synthesize website URLs from UID: use only links in the official feed.
    official_link=record_url(row.get('sourceWebPromote')) or record_url(row.get('webSales'))
    if not official_link:
        return None
    owner=clean_text(row.get('masterUnit'),200) or '文化部 iCulture 所登載主辦單位'
    return {
        'id':PREFIX+uid.lower(),'title':title,'date':start,'eventEndDate':end,
        'time':clock,'deadline':'','scope':'全國','type':TYPES.get(category,'公共參與'),
        'kind':'event','url':official_link, 'keywords':title,
        'direct':True,'team':False,'available':True,'government':False,
        'source':'文化部 iCulture 全國活動開放資料','sourceId':SOURCE_ID,
        'statusText':f'文化部官方資料彙整；活動日期 {start}，報名資格與截止時間請以原公告為準。',
        'location':venue,'organizer':owner,'audience':'依活動公告確認',
        'openEnded':False,'nationwideTopics':topics,
        'autofetch':{
            'engine':'moc-national-v1','sourceId':SOURCE_ID,
            'mocUID':uid,'mocCategory':category,'fetchedAt':stamp,
            'catalog':'https://data.gov.tw/dataset/6478',
        },
    }


def run_source(*, fetch_fn, stamp, limit=50, logger=print, today=None):
    """Return a standard AutoFetch source result. Partial API failures fail closed.

    No category failure may wipe previous national records, and successful
    categories never masquerade as full four-category coverage.
    """
    today=today or date.today()
    failures=[]
    seen=0
    category_ok=0
    results={}
    skipped_past=0
    for cat in CATEGORIES:
        url=API_ROOT+cat
        try:
            effective,body=fetch_fn(url,[FEED_DOMAIN])
            parsed=urlparse(effective)
            if parsed.scheme!='https' or parsed.hostname!=FEED_DOMAIN:
                raise ValueError('文化部網域／重新導向驗證失敗')
            rows=parse_feed(body)
            category_ok+=1
        except Exception as exc:
            failures.append({'url':url,'reason':str(exc)[:250],'category':cat})
            continue
        seen+=len(rows)
        for row in rows:
            candidate=event_candidate(row,cat,stamp,today=today)
            if candidate:
                results[candidate['id']]=candidate
            elif isinstance(row,dict) and row.get('startDate') and date_key(row['startDate']) and date_key(row['startDate'])<today.isoformat():
                skipped_past+=1
    healthy=category_ok==len(CATEGORIES) and seen>0
    candidates=sorted(results.values(), key=lambda c:(c['date'],c['title']))[:max(1,min(int(limit),80))]
    logger(f'MOC_NATIONAL source={SOURCE_ID} categories={category_ok}/{len(CATEGORIES)} '
           f'observed={seen} matched={len(results)} bounded={len(candidates)} healthy={healthy}')
    return {
        'sourceId':SOURCE_ID,'prefix':PREFIX,'discovered':seen,
        'parsedOk':len(results),'accepted':candidates if healthy else [],
        'skippedPast':skipped_past,'rejected':[],'fetchFailures':failures,
        'healthy':healthy,'nationalTopics':sorted({tag for c in candidates for tag in c['nationwideTopics']}),
        'categoryOk':category_ok,'categoryTotal':len(CATEGORIES),
        'nationwideMatchCount':len(results),
    }
