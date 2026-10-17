#!/usr/bin/env python3
"""Bounded official cross-university national competition discovery (NCUT).

Real public official source: National Chin-Yi University of Technology's
'最新比賽資訊'.  Discovers recent contest bulletin links, verifies each on the same
HTTPS .edu.tw host, then admits ONLY dated, relevant, remote-entry contests.
The university is a verified notice publisher, not necessarily the organizer.

No registry-wide crawling, search-engine scraping, stored credentials, generated
submission links, production writes, or inference of participation eligibility.
Source failures fail closed and preserve previous source-owned records.
"""
from __future__ import annotations

from datetime import date, datetime
from hashlib import sha256
from html.parser import HTMLParser
from urllib.parse import urlparse, urljoin, unquote
from zoneinfo import ZoneInfo
import re

SOURCE_ID = 'ncut_competitions_official'
PREFIX = 'auto-ncut-competition-'
HOST = 'n058.ncut.edu.tw'
LIST_URL = 'https://n058.ncut.edu.tw/p/403-1058-292-1.php?Lang=zh-tw'
TITLE_TOPIC = re.compile(r'法律|法學|法治|政策|公民|人權|金融|財經|財務|理財|Fintech|國際|海外|商務|行銷|貿易|創業|創新|企劃|辯論|演辯|論辯|演說|語言|英文|英語|日語|日文|徵文|寫作|青年|智慧|AI|人工智慧|數位|資訊|ESG|永續', re.I)
CONTEST_WORD = re.compile(r'競賽|比賽|大賽|徵件|徵文|黑客松|挑戰賽|提案', re.I)
LOW_VALUE = re.compile(r'得獎名單|入圍名單|錄取名單|競賽說明會|結案|成果公告|成績公告|圓滿落幕', re.I)
RESTRICTED = re.compile(r'僅限本校|限本校|僅限(?:教職員|教師|高中生|高中職生|國小|國中)|限特定系所|只限(?:教職員|教師)',re.I)
STUDENT_WORDS = re.compile(r'大專(?:院校|校院)?(?:在學)?學生|(?:全國)?大學生|大學部學生|學士班|碩士班|全國.{0,18}(?:大專|大學).{0,12}(?:學生|參賽)|青年(?:學子|學生)|社會人士',re.I)
UPLOAD_PROOF = re.compile(
  r'初賽.{0,50}(?:作品|企劃書|計畫書|摘要|簡報|提案|文件|報名資料).{0,45}(?:上傳|線上繳件|線上投件|線上投稿)|'
  r'(?:初賽|企劃書|作品|提案|參賽資料).{0,40}(?:線上|網路).{0,40}(?:上傳|提交|投稿|投件|繳交)|'
  r'(?:線上|網路).{0,35}(?:上傳|提交|投稿|投件|繳交).{0,35}(?:企劃書|計畫書|作品|報名資料)|'
  r'初賽參展企劃書上傳網址|線上報名.*?競賽資料.*?上傳',re.I)
ON_SITE_FIRST = re.compile(r'(?:初賽|資格審查|第一階段).{0,36}(?:須|必須|現場|實體|到場|出席).{0,35}(?:現場|實體|到場|出席)|(?:初賽|第一階段)須(?:親自)?到場',re.I)
ON_SITE_FINAL = re.compile(r'(?:總決賽|決賽|最後階段).{0,45}(?:現場|實體|到場|會場|本校|舉行|辦理)',re.I)
REGION_DISALLOWED = re.compile(r'彰化(?:縣|市|師大)|南投(?:縣|市|鎮|埔里)',re.I)
DEADLINE_MARKER = re.compile(r'(?:初賽)?(?:報名|收件|徵件|投稿|提案|作品|企劃書).{0,12}(?:截止(?:時間|日期|日)?|期間|時間|日期)|(?:截止(?:日期|時間)?).{0,12}(?:報名|徵件|作品)',re.I)
DATE_PAT = re.compile(r'(?<!\d)(20\d{2}|1\d{2})\s*[/\.\-年]\s*(\d{1,2})\s*[/\.\-月]\s*(\d{1,2})\s*日?(?!\d)')
ANNOUNCEMENT_LINK = re.compile(r'^/p/406-1058-(\d{3,9}),r292\.php$',re.I)


def taipei_today():
    return datetime.now(ZoneInfo('Asia/Taipei')).date()


def iso_date(text):
    m = DATE_PAT.search(str(text or ''))
    if not m:
        return ''
    y,mo,dd = (int(x) for x in m.groups())
    if y < 1900:
        y += 1911
    try:
        return date(y,mo,dd).isoformat()
    except ValueError:
        return ''


def tidy(value):
    return re.sub(r'\s+', ' ', str(value or '').replace('\u3000',' ')).strip()


class PublicHtml(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip=0
        self.a=None
        self.anchors=[]
        self.lines=[]
        self.h=None
        self.htxt=[]
        self.headings=[]

    def handle_starttag(self, tag, attrs):
        tag=tag.lower()
        if tag in ('script','style','noscript'):
            self.skip+=1
            return
        if self.skip:
            return
        if tag=='a' and self.a is None:
            self.a={'href':dict(attrs).get('href',''),'text':[]}
        if tag in ('h1','h2','h3','h4'):
            self.h=tag
            self.htxt=[]

    def handle_endtag(self,tag):
        tag=tag.lower()
        if tag in ('script','style','noscript'):
            self.skip=max(0,self.skip-1)
            return
        if self.skip:
            return
        if tag=='a' and self.a is not None:
            self.anchors.append((self.a['href'],tidy(' '.join(self.a['text']))))
            self.a=None
        if tag==self.h:
            self.headings.append(tidy(' '.join(self.htxt)))
            self.h=None

    def handle_data(self,data):
        if self.skip:
            return
        s=tidy(data)
        if not s:
            return
        self.lines.append(s)
        if self.a is not None:
            self.a['text'].append(s)
        if self.h:
            self.htxt.append(s)


def read_html(payload):
    raw=payload.decode('utf-8','replace') if isinstance(payload,bytes) else str(payload)
    if not raw or len(raw)>2_000_000:
        raise ValueError('官方競賽網頁內容為空或超出上限')
    p=PublicHtml()
    p.feed(raw)
    return p


def valid_url(raw, *, list_page=False):
    try:
        p=urlparse(raw)
        if p.scheme!='https' or p.hostname!=HOST or p.username or p.password or p.port is not None:
            return False
    except ValueError:
        return False
    if len(raw)>1400 or p.fragment:
        return False
    if list_page:
        return p.path in ('/','/index.php','/p/403-1058-292-1.php')
    return bool(ANNOUNCEMENT_LINK.fullmatch(unquote(p.path)))


def listing(payload, base=LIST_URL):
    parsed=read_html(payload)
    entries=[]
    seen=set()
    for href, raw_title in parsed.anchors:
        title=tidy(raw_title)
        if not title.startswith(('〖競賽〗','【競賽】','「競賽」')):
            continue
        url=urljoin(base,href).split('#',1)[0]
        if not valid_url(url) or url in seen:
            continue
        if not (8<=len(title)<=210) or LOW_VALUE.search(title):
            continue
        seen.add(url)
        entries.append({'url':url,'title':title,'identifier':ANNOUNCEMENT_LINK.fullmatch(unquote(urlparse(url).path)).group(1)})
    return entries


def article(payload, expected_title):
    p=read_html(payload)
    tkey=re.sub(r'\s+','',expected_title)
    # A bulletin's heading must match the indexed notice, not menu text.
    if not any(tkey in re.sub(r'\s+','',h) for h in p.headings):
        return []
    start=next((i for i,s in enumerate(p.lines) if tkey in re.sub(r'\s+','',s)),None)
    if start is None:
        return []
    out=[]
    for line in p.lines[start:start+160]:
        if re.match(r'^瀏覽數\s*[:：]?$',line) or line.startswith('國立勤益科技大學 National'):
            break
        out.append(line)
    return out


def deadline_from_lines(lines):
    candidates=[]
    for line in lines:
        if not DEADLINE_MARKER.search(line):
            continue
        dates=[iso_date(m.group(0)) for m in DATE_PAT.finditer(line)]
        dates=[x for x in dates if x]
        if not dates:
            continue
        # Do not confuse 'start on 10/09' with an application deadline.
        explicit=re.search(r'截止|至.{0,45}止',line)
        if not explicit:
            continue
        # When a period provides both start/end, the latter is the deadline.
        selected=dates[-1] if len(dates)>1 else dates[0]
        candidates.append(selected)
    return min(candidates) if candidates else ''


def _full(lines):
    return tidy(' '.join(lines))


def final_venue(lines):
    for line in lines:
        if not re.search(r'(?:總決賽|決賽)',line):
            continue
        # Use only explicit place tokens near a FINAL marker; never guess city.
        m=re.search(r'(?:總決賽|決賽).{0,45}(?:在|於)\s*([^。；，,]{4,80})',line)
        if m:
            candidate=tidy(m.group(1))
            candidate=re.sub(r'(?:舉行|辦理|進行|舉辦).*$', '',candidate).strip()
            if candidate:
                return candidate[:110]
    return ''


def topic_category(title):
    if re.search(r'法律|法學|司法|公民|人權|政策|辯論|論辯|演辯',title):
        return '法律／學術'
    if re.search(r'國際|海外|行銷|貿易|英語|日語|語言',title):
        return '語言／國際'
    if re.search(r'金融|財務|Fintech|創業|創新|企劃',title,re.I):
        return '職涯／實習'
    return '公共參與'


def candidate(record,payload,stamp,*,today=None,reasons=None):
    """Strictly accept verified remote proposal rounds, never bare online signup."""
    today=today or taipei_today()
    def reject(reason):
        if reasons is not None:
            reasons.append(reason)
        return None
    title=record.get('title','')
    if not (TITLE_TOPIC.search(title) and CONTEST_WORD.search(title)) or LOW_VALUE.search(title):
        return reject('topic_mismatch')
    lines=article(payload,title)
    if len(lines)<3:
        return reject('detail_heading_unverified')
    text=_full(lines)
    if RESTRICTED.search(text):
        return reject('eligibility_restricted')
    if not STUDENT_WORDS.search(text):
        return reject('eligibility_not_verified')
    deadline=deadline_from_lines(lines)
    if not deadline:
        return reject('deadline_not_verified')
    if deadline < today.isoformat():
        return reject('deadline_expired')
    if ON_SITE_FIRST.search(text):
        return reject('mandatory_first_stage_inperson')
    if not UPLOAD_PROOF.search(text):
        return reject('remote_submission_not_verified')
    onsite=bool(ON_SITE_FINAL.search(text))
    venue=final_venue(lines) if onsite else ''
    # A forwarded bulletin's word ‘本校’ normally refers to the contest
    # organizer, not to NCUT, which published the forwarded notice.
    if venue.startswith('本校'):
        venue='原公告稱「本校」'+venue[2:]+'（請核對主辦校地址）'
    if onsite and REGION_DISALLOWED.search(venue):
        return reject('user_disallowed_final_region')
    title_clean=re.sub(r'^[〖【「](?:競賽)[〗】」]\s*','',title).strip()
    finalText='；決賽需到場'+('（'+venue+'）' if venue else '（地點依官方公告）') if onsite else ''
    return {
        'id':PREFIX+record['identifier'], 'title':title_clean, 'date':deadline,
        'deadline':deadline, 'time':'', 'dateKind':'application_deadline',
        'eventEndDate':deadline, 'scope':'全國','type':topic_category(title),
        'kind':'event', 'url':record['url'], 'keywords':title_clean,
        'direct':True, 'team':False, 'available':True, 'government':False,
        'source':'國立勤益科技大學研發處｜全國競賽官方轉知',
        'sourceId':SOURCE_ID,
        'organizer':'原主辦機關詳見公告（勤益科大為轉知平台）',
        'location':'線上初賽／企劃書投稿'+finalText,
        'participationMode':'online_submission_onsite_final' if onsite else 'online_submission',
        'finalAttendanceRequired':onsite, 'finalLocation':venue,
        'audience':'已見大專／青年參加對象；實際跨系限制、組隊及其他資格應以競賽簡章核實',
        'statusText':'校方公告已核實截止日 '+deadline+' 及線上初賽交件；'+
           ('決賽需到場：'+(venue or '地點依官方公告') if onsite else '後續階段請依主辦方公告')+
           '。報名／截止日期不代表競賽實際舉辦日期。',
        'autofetch':{'engine':'official-contests-v4','sourceId':SOURCE_ID,
                     'noticeId':record['identifier'],'fetchedAt':stamp,'reviewLevel':'official_list_and_detail'},
    }


def run_source(*,fetch_fn,stamp,logger=print,limit=10,today=None):
    today=today or taipei_today()
    out={'sourceId':SOURCE_ID,'prefix':PREFIX,'discovered':0,'parsedOk':0,
         'accepted':[],'skippedPast':0,'rejected':[],'fetchFailures':[],
         'healthy':False,'reviewReasons':{},'reviewSamples':{}}
    reasons={}
    samples={}
    def observe(label,rec):
        reasons[label]=reasons.get(label,0)+1
        coll=samples.setdefault(label,[])
        if len(coll)<2:
            coll.append({'title':rec['title'][:120],'url':rec['url']})
    try:
        final,html=fetch_fn(LIST_URL,[HOST])
        if not valid_url(final,list_page=True):
            raise ValueError('official index redirect not trusted')
        articles=listing(html,final)
        if not articles:
            raise ValueError('official competition index has no verified links')
    except Exception as exc:
        out['fetchFailures'].append({'url':LIST_URL,'reason':str(exc)[:240]})
        return out
    out['discovered']=len(articles)
    eligible=[]
    for rec in articles:
        if not TITLE_TOPIC.search(rec['title']) or not CONTEST_WORD.search(rec['title']):
            observe('topic_mismatch',rec)
        else:
            eligible.append(rec)
    # Fails closed when relevant announcements exceed verification budget.
    budget=max(1,min(int(limit),20))
    if len(eligible)>budget:
        out['fetchFailures'].append({'url':LIST_URL,'reason':'relevant_articles_exceed_verification_budget'})
    accepted=[]
    for rec in eligible[:budget]:
        try:
            final,html=fetch_fn(rec['url'],[HOST])
            if not valid_url(final) or final!=rec['url']:
                raise ValueError('official notice redirected outside verified article')
            lines=article(html,rec['title'])
            if len(lines)<3:
                raise ValueError('official article structure/heading changed')
            out['parsedOk']+=1
            why=[]
            item=candidate(rec,html,stamp,today=today,reasons=why)
            if item:
                accepted.append(item)
            elif why:
                observe(why[0],rec)
                if why[0]=='deadline_expired':
                    out['skippedPast']+=1
        except Exception as exc:
            out['fetchFailures'].append({'url':rec['url'],'reason':str(exc)[:240]})
    out['reviewReasons']=reasons
    out['reviewSamples']=samples
    out['healthy']=not out['fetchFailures']
    out['accepted']=list({x['id']:x for x in accepted}.values()) if out['healthy'] else []
    logger(f'NCUT_COMPETITIONS source={SOURCE_ID} healthy={out["healthy"]} '
           f'discovered={out["discovered"]} verified={out["parsedOk"]} '
           f'accepted={len(out["accepted"])} exclusions={reasons} '
           f'failures={len(out["fetchFailures"])}')
    return out
