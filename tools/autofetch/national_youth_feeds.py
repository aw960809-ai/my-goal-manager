#!/usr/bin/env python3
"""Two bounded public YDA opportunity feeds for Goal Manager (2026-10-16).

Strict admission: official HTTPS listing + official HTTPS detail + evidenced open
application deadline + specific study/competition goal + online participation or
submission. A valid feed with zero eligible opportunities remains healthy; a
network/markup failure is fail-closed and must not replace prior production rows.
This module never touches personal storage, Google services, or production JSON.
"""
from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo
from html.parser import HTMLParser
from urllib.parse import urlparse, parse_qs
import re

SOURCES = {
    'youthfirst_national': {
        'name': '教育部青年第一讚｜全國競賽及徵件',
        'host': 'youthfirst.yda.gov.tw',
        'prefix': 'auto-youthfirst-',
        'lists': (
            'https://youthfirst.yda.gov.tw/index.php/subject/index?project_type%5B%5D=%E7%AB%B6%E8%B3%BD',
            'https://youthfirst.yda.gov.tw/index.php/subject/index?project_type%5B%5D=%E6%B4%BB%E5%8B%95',
        ),
        'detail_path': 'subject/content',
    },
    'yda_national_news': {
        'name': '教育部青年發展署｜全國徵件及線上機會',
        'host': 'www.yda.gov.tw',
        'prefix': 'auto-yda-news-',
        'lists': (
            'https://www.yda.gov.tw/',
            'https://www.yda.gov.tw/docList.aspx?pid=53&uid=59',
            'https://www.yda.gov.tw/planDocList.aspx?c=1&p=1008',
            'https://www.yda.gov.tw/planDocList.aspx?c=1&p=1014',
        ),
        'detail_path': 'docdetail.aspx',
    },
}

# Only these national themes, and only if the title also describes an actionable
# application, program, submission, competition, or online learning activity.
GOAL = re.compile(
    r'法律|法學|司法|憲法|刑法|民法|人權|公民|公共政策|政策提案|'
    r'國際交流|國際參與|海外實習|國際青年|跨文化|外交|英語演說|'
    r'英文寫作|日語演說|日語檢定|日語能力測驗|日本語能力試驗|英語口譯|多益|TOEIC|TOEFL|JLPT|IELTS|'
    r'辯論|演辯|論辯|徵文|論文競賽|青年提案|創意提案|'
    r'青年志工|青年培力|青年創業|青年創新|社會創新|'
    r'職涯探索|青年行動|社區參與|Dream ?Idea|'
    r'生成式AI|數位素養|媒體識讀|理財素養|金融素養', re.I)
ACTION = re.compile(r'競賽|比賽|徵選|徵件|徵稿|投稿|提案|招募|報名|徵求|培訓|研習|工作坊|講座|交流|挑戰賽|獎|申請', re.I)
LOW_RELEVANCE = re.compile(r'親子|兒童|幼兒|繪本|故事屋|美食|烹飪|料理|食譜|音樂祭|健康講座|團購|貸款|房屋|房貸|租金補助',re.I)
NOT_ACTIONABLE = re.compile(r'得獎名單|入選名單|錄取名單|公告結果|成果揭曉|圓滿落幕|回顧|決審入圍|已截止|活動取消|取消辦理|不再受理',re.I)
ONLINE_APPLICATION = re.compile(
    r'線上(?:投稿|投件|繳件|徵件|報名|申請|提案|上傳)|'
    r'(?:網路|網上)(?:報名|申請|投稿|投件)|'
    r'(?:Google|網路)(?:線上)?表單|填寫線上表單|電子郵件(?:投稿|繳件)|'
    r'(?:e-mail|Email)(?:報名|投稿)|(?:上傳|提交)(?:作品|計畫書|報名表)',re.I)
ONLINE_EVENT = re.compile(r'線上(?:講座|課程|研習|交流|培訓|工作坊|座談|活動|舉行|辦理|進行)|線上直播|遠距課程|全程線上|Webex\s*線上|Zoom\s*線上|Google\s*Meet\s*線上',re.I)
# Finals may be in-person if (and only if) the initial competition submission
# is verifiably remote. An obligatory in-person PRELIMINARY round is excluded.
FINAL_ONSITE_RE = re.compile(
    r'(?:總決賽|決賽|決審|決選|複賽)[^。；;\n]{0,60}?'
    r'(?:須|需|必須|應|採|於|在|為)[^。；;\n]{0,35}?'
    r'(?:親自到場|到場|出席|現場|實體|舉辦|辦理|發表|進行)',re.I)
IN_PERSON_REQUIRED = re.compile(
    r'必須(?:親自)?到場|須(?:親自)?出席|限現場參加|僅限現場|不得線上參與|'
    r'必須現場發表|(?:初賽|初審|第一階段|資格審查|初選)[^。；;]{0,40}'
    r'(?:須|需|必須|採)[^。；;]{0,15}(?:現場|實體|到場|出席)',re.I)
# A registration link alone is NOT proof of remote submission of the work.
ONLINE_SUBMISSION = re.compile(
    r'線上(?:投稿|投件|繳件|徵件|提案|上傳(?:作品|計畫書|檔案|影片))|'
    r'(?:網路|網上)(?:投稿|投件|繳件)|'
    r'(?:上傳|提交|遞交)(?:作品|計畫書|企劃書|報名作品|參賽作品|論文|影片)|'
    r'(?:電子郵件|e-?mail|Email)(?:投稿|寄送作品|繳件|投件)|'
    r'線上初賽|初賽(?:採|以|為)(?:線上|遠距)|'
    r'(?:(?:Google|線上|網路)表單)[^。；;]{0,25}(?:投稿|繳交作品|上傳|投件)',re.I)
CITY_RE = re.compile(r'臺北市|台北市|新北市|臺中市|台中市|高雄市|臺南市|台南市|'
                     r'桃園市|新竹市|新竹縣|基隆市|宜蘭縣|彰化縣|南投縣|嘉義市|'
                     r'嘉義縣|屏東縣|花蓮縣|臺東縣|台東縣|雲林縣|苗栗縣|臺北|台北|高雄')

RESTRICTED = re.compile(r'僅限(?:本校|本院|本系|教師|教職員|博士生|國小|國中|高中|原住民|原住民族)|須設籍(?:本|該)|限本[縣市]戶籍|不開放一般民眾|未開放個人', re.I)
PREREQUISITE = re.compile(r'(?:須|必須|需)(?:於.{0,22})?先(?:行)?(?:參加|完成).{0,25}(?:特定|指定|壯遊點)|(?:須|必須)於投稿截止日前.{0,24}實際參與', re.I)
DATE_RE = re.compile(r'(?<!\d)(20\d{2}|1\d{2})[./\-年]\s*(\d{1,2})[./\-月]\s*(\d{1,2})日?(?!\d)')
YEAR_DATE = r'(?:20\d{2}|1\d{2})[./\-年]\s*\d{1,2}[./\-月]\s*\d{1,2}日?'
PERIOD_RE = re.compile(r'申請期限\s*[:：]\s*(' + YEAR_DATE + r')\s*(?:至|~|～|\-|—|–)\s*(' + YEAR_DATE + r')')
DEADLINE_MARKER = re.compile(r'(?:徵件|投稿|報名|申請|收件|投件)(?:期程|日期|期間|截止(?:日期|時間|日)?)\s*[：:]?')
ARTICLE_STOP = re.compile(r'^(?:收合快速導覽|回頂端|版權所有|其他服務|相關消息|最新公告)$')


def taipei_today():
    return datetime.now(ZoneInfo('Asia/Taipei')).date()


def iso(raw):
    match = DATE_RE.search(str(raw or ''))
    if not match:
        return ''
    yy,mm,dd = (int(x) for x in match.groups())
    if yy < 1900:
        yy += 1911
    try:
        return date(yy,mm,dd).isoformat()
    except ValueError:
        return ''


def clean(s):
    return re.sub(r'\s+',' ',str(s or '')).strip()


def detail_url(raw, spec):
    """Build canonical internal detail URL only from a verified official href."""
    raw=str(raw or '').strip()
    if len(raw)>1400 or any(c.isspace() for c in raw):
        return ''
    try:
        p=urlparse(raw)
        if p.scheme and p.scheme!='https':
            return ''
        if p.netloc and (p.hostname!=spec['host'] or p.username or p.password or p.port):
            return ''
    except ValueError:
        return ''
    if spec['prefix']=='auto-youthfirst-':
        m=re.search(r'(?:^|/)subject/content/(\d{2,10})(?:$|[?/#])',p.path+'?')
        if not m:
            return ''
        return f"https://{spec['host']}/index.php/subject/content/{m.group(1)}"
    if p.path.lower().rsplit('/',1)[-1]!='docdetail.aspx':
        return ''
    qs=parse_qs(p.query)
    docid=(qs.get('docid') or [''])[0]
    if not re.fullmatch(r'\d{3,10}',docid):
        return ''
    return f"https://{spec['host']}/docDetail.aspx?docid={docid}&pid=53&uid=60"


class PlainHtml(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip=0
        self.lines=[]
        self.anchor=None
        self.links=[]
        self.head_tag=None
        self.head_text=[]
        self.headings=[]

    def handle_starttag(self, tag, attrs):
        tag=tag.lower()
        if tag in ('script','style','noscript'):
            self.skip+=1
            return
        if self.skip:
            return
        if tag=='a':
            self.anchor={'href':dict(attrs).get('href',''),'words':[],'pos':len(self.lines)}
        if tag in ('h1','h2','h3'):
            self.head_tag=tag
            self.head_text=[]

    def handle_endtag(self, tag):
        tag=tag.lower()
        if tag in ('script','style','noscript'):
            self.skip=max(0,self.skip-1)
            return
        if self.skip:
            return
        if tag=='a' and self.anchor is not None:
            self.links.append((self.anchor['href'],clean(' '.join(self.anchor['words'])),self.anchor['pos']))
            self.anchor=None
        if tag==self.head_tag:
            self.headings.append(clean(' '.join(self.head_text)))
            self.head_tag=None

    def handle_data(self, data):
        if self.skip:
            return
        s=clean(data)
        if not s:
            return
        self.lines.append(s)
        if self.anchor is not None:
            self.anchor['words'].append(s)
        if self.head_tag:
            self.head_text.append(s)


def parser(body):
    if not isinstance(body,(bytes,str)):
        raise ValueError('非文字 HTML 回應')
    text=body.decode('utf-8','replace') if isinstance(body,bytes) else body
    if len(text)>3_000_000:
        raise ValueError('官方清單頁面過大')
    p=PlainHtml()
    p.feed(text)
    return p


def listing(body, spec):
    p=parser(body)
    raw=[]
    for href,title,pos in p.links:
        url=detail_url(href,spec)
        if url and 8<=len(title)<=180 and not NOT_ACTIONABLE.search(title):
            raw.append({'url':url,'title':title,'index':pos})
    cards=[]
    seen=set()
    for i,row in enumerate(raw):
        if row['url'] in seen:
            continue
        seen.add(row['url'])
        end=raw[i+1]['index'] if i+1<len(raw) else min(len(p.lines),row['index']+42)
        tail=clean(' '.join(p.lines[row['index']:end]))[:1500]
        period=PERIOD_RE.search(tail) if spec['prefix']=='auto-youthfirst-' else None
        cards.append({'url':row['url'],'title':row['title'],
                      'start':iso(period.group(1)) if period else '',
                      'deadline':iso(period.group(2)) if period else ''})
    return cards,p


def article(body,title):
    p=parser(body)
    tkey=re.sub(r'\s+','',title)
    headings={re.sub(r'\s+','',s) for s in p.headings if s}
    if tkey not in headings and not any(tkey in re.sub(r'\s+','',s) for s in p.headings if s):
        return []
    idx=next((i for i,s in enumerate(p.lines) if tkey in re.sub(r'\s+','',s)),None)
    if idx is None:
        return []
    out=[]
    for s in p.lines[idx:idx+400]:
        if ARTICLE_STOP.match(s):
            break
        out.append(s)
    return out


def deadline_from_text(lines, *, expected=''):
    full=clean(' '.join(lines))
    candidates=[]
    for marker in DEADLINE_MARKER.finditer(full):
        # Never treat a page publication date or an award ceremony as a deadline.
        tail=full[marker.end():marker.end()+115]
        found=list(DATE_RE.finditer(tail))
        if not found:
            continue
        first=iso(found[0].group(0))
        if not first:
            continue
        # A registration *period* gives opening then closing dates.
        is_period=bool(re.search(r'期間|期程',marker.group(0)))
        if is_period:
            # A period's first date is the OPENING date, never the deadline.
            # If the closing date is absent or malformed, reject the period.
            if len(found)<2:
                continue
            between=tail[found[0].end():found[1].start()]
            if not re.search(r'至|~|～|[-–—]',between):
                continue
            end=iso(found[1].group(0))
            if end and end>=first:
                candidates.append(end)
            continue
        candidates.append(first)
    if expected:
        # Official listing's deadline must also be explicitly found in the
        # detail's deadline context. No incidental date anywhere is sufficient.
        return expected if expected in candidates else ''
    return min(candidates) if candidates else ''


def topic_ok(title):
    return bool(GOAL.search(title) and ACTION.search(title)
                and not (NOT_ACTIONABLE.search(title) or LOW_RELEVANCE.search(title)))


def source_type(title):
    if re.search(r'法律|司法|法學|人權|政策|公民|辯論|論辯|演辯',title):
        return '法律／學術'
    if re.search(r'國際|海外|英語|英文|日語|日文|多益|TOEIC|跨文化',title,re.I):
        return '語言／國際'
    if re.search(r'職涯|實習|創業|創新|提案',title):
        return '職涯／實習'
    return '教育／青少年'


def onsite_final_phases(text):
    """Extract only explicitly in-person finals; never infer a venue."""
    stages=[m.group(0) for m in FINAL_ONSITE_RE.finditer(text)
            if not ONLINE_EVENT.search(m.group(0))]
    # Remove the final-stage obligation before checking for mandatory attendance
    # at another stage, including preliminaries and eligibility reviews.
    remaining=FINAL_ONSITE_RE.sub('',text)
    # City evidence is restricted to the matching finals span (not event header).
    city=next((m.group(0) for part in stages if (m:=CITY_RE.search(part))), '')
    city={'台北':'臺北市','臺北':'臺北市','高雄':'高雄市',
          '台北市':'臺北市','台中市':'臺中市','台南市':'臺南市',
          '台東縣':'臺東縣'}.get(city,city)
    return bool(stages),city,remaining


def candidate(card,body,source_id,stamp,*,today=None,reasons=None):
    """Return an opportunity or a concrete reason in a read-only audit list."""
    today=today or taipei_today()
    spec=SOURCES[source_id]
    title=card['title']

    def reject(reason):
        if reasons is not None:
            reasons.append(reason)
        return None

    if not topic_ok(title):
        return reject('topic_mismatch')
    lines=article(body,title)
    if len(lines)<3:
        return reject('detail_unverified')
    all_text=clean(' '.join(lines))
    if RESTRICTED.search(all_text):
        return reject('eligibility_restricted')
    if PREREQUISITE.search(all_text):
        return reject('mandatory_prerequisite')
    # The official detail must explicitly state an open deadline. A dated
    # *listing* alone is insufficient; a listing without a deadline may still
    # link to a perfectly verifiable deadline in the detail.
    deadline=deadline_from_text(lines,expected=card.get('deadline',''))
    if not deadline:
        return reject('deadline_not_verified')
    if not today.isoformat()<=deadline<=f'{today.year+2}-12-31':
        return reject('deadline_closed_or_too_far')

    is_submission=bool(re.search(r'競賽|徵件|徵文|投稿|提案|徵選|徵稿|比賽|挑戰賽',title,re.I))
    final_attendance,final_city,other_stages=onsite_final_phases(all_text)
    if IN_PERSON_REQUIRED.search(other_stages):
        return reject('mandatory_in_person_stage')

    if is_submission:
        if not ONLINE_SUBMISSION.search(all_text):
            return reject('remote_submission_not_verified')
        # A hybrid competition may require a physical FINAL, but cannot
        # require in-person submission, preliminary attendance or review.
        mode='online_submission_onsite_final' if final_attendance else 'online_submission'
        place='線上初賽／投稿'
        if final_attendance:
            place+='；決賽需到場' + (f'（{final_city}）' if final_city else '（地點以官方公告為準）')
    else:
        if final_attendance or not (re.search(r'線上|遠距|Webinar',title,re.I) and ONLINE_EVENT.search(all_text)):
            return reject('online_event_not_verified')
        mode='online_event'
        place='線上參與'

    ident=urlparse(card['url'])
    if source_id=='youthfirst_national':
        unique=re.search(r'/(\d+)$',ident.path).group(1)
    else:
        unique=parse_qs(ident.query)['docid'][0]
    prefix=spec['prefix']
    owner='教育部青年發展署' if source_id=='yda_national_news' else '青年第一讚官方平台所刊登之主辦機關'
    status=(f'官方截止日 {deadline}（非活動舉辦日期）；已確認'
            +('線上投稿／初賽' if is_submission else '線上參與'))
    if final_attendance:
        status+=f'；決賽須實體到場（{final_city or "舉辦地點依官方公告"}）'
    status+='；實際參賽資格及初、決賽規則請核對官方簡章。'
    return {
        'id':prefix+unique,'title':title,'date':deadline,'deadline':deadline,
        'time':'','dateKind':'application_deadline','eventEndDate':deadline,
        'scope':'全國','type':source_type(title),'kind':'event','url':card['url'],
        'keywords':title,'direct':True,'team':False,'available':True,
        'government':False,'source':spec['name'],'sourceId':source_id,
        'organizer':owner,'location':place,
        'participationMode':mode,'finalAttendanceRequired':final_attendance,
        'finalLocation':final_city,
        'audience':'申請資格與參與方式以官方徵件簡章為準（尚未完成個人資格核驗）',
        'statusText':status,
        'autofetch':{'engine':'national-yda-v3','sourceId':source_id,'fetchedAt':stamp,
                     'provenance':'official-list-and-detail'},
    }



def youthfirst_verified_pages(page, listing_url):
    """Only canonical, source-advertised pagination links (no guessed 404s)."""
    query=urlparse(listing_url).query
    if not query or 'project_type' not in query:
        return []
    # Match only the two configured categories; pages are bounded, not crawled.
    is_competition='%E7%AB%B6' in query.upper()
    max_offset=6 if is_competition else 2
    collected=[]
    for href,label,_pos in page.links:
        try:
            raw=urlparse(str(href).strip())
            if raw.scheme and raw.scheme!='https':
                continue
            if raw.netloc and (raw.hostname!='youthfirst.yda.gov.tw' or raw.username or raw.password or raw.port is not None):
                continue
        except ValueError:
            continue
        # Accept exactly the pagination path published by the website, but
        # reconstruct an HTTPS URL under our fixed, trusted category query.
        match=re.search(r'(?:^|/)subject/index/0/(\d{1,2})$',raw.path)
        if not match:
            continue
        offset=int(match.group(1))
        if 1<=offset<=max_offset:
            canonical='https://youthfirst.yda.gov.tw/index.php/subject/index/0/'+str(offset)+'?'+query
            if canonical not in collected:
                collected.append(canonical)
    return collected


def run_source(source_id,*,fetch_fn,stamp,logger=print,limit=10,today=None):
    """Standard per-source isolation, bounded network IO, strict partial fail-closed."""
    today=today or taipei_today()
    spec=SOURCES[source_id]
    out={'sourceId':source_id,'prefix':spec['prefix'],'discovered':0,
         'parsedOk':0,'accepted':[],'skippedPast':0,'rejected':[],
         'fetchFailures':[],'healthy':False,'reviewReasons':{},'reviewSamples':{}}
    seen={}
    def note(code, rec=None):
        reasons=out['reviewReasons']
        reasons[code]=reasons.get(code,0)+1
        if rec and len(out['reviewSamples'].get(code,[]))<2:
            out['reviewSamples'].setdefault(code,[]).append({
                'title':rec['title'][:120],'url':rec['url']})
    # Load only two configured category pages. Further pages must first be
    # advertised in a verified official HTML page (no manufactured offsets).
    urls=list(spec['lists'])
    visited_urls=set()
    failures=[]
    empty_verified=False
    for url in urls:
        if url in visited_urls:
            continue
        visited_urls.add(url)
        try:
            final,html=fetch_fn(url,[spec['host']])
            fp=urlparse(final)
            if fp.scheme!='https' or fp.hostname!=spec['host'] or fp.username or fp.password or fp.port:
                raise ValueError('official listing redirect mismatch')
            cards,p=listing(html,spec)
            if source_id=='youthfirst_national':
                for next_page in youthfirst_verified_pages(p,url):
                    if next_page not in visited_urls and next_page not in urls:
                        urls.append(next_page)
            if not cards:
                if re.search(r'顯示\s*0\s*筆|沒有符合',clean(' '.join(p.lines))):
                    empty_verified=True
                else:
                    raise ValueError('官方清單無法辨識任何活動連結')
            for rec in cards:
                if rec['url'] not in seen:
                    seen[rec['url']]=rec
        except Exception as exc:
            failures.append({'url':url,'reason':str(exc)[:220]})
    out['discovered']=len(seen)
    eligible_cards=[]
    for rec in seen.values():
        if not topic_ok(rec['title']):
            note('topic_mismatch',rec)
            continue
        if rec.get('deadline') and rec['deadline']<today.isoformat():
            out['skippedPast']+=1
            note('listing_deadline_closed',rec)
            continue
        # Older code rejected every YouthFirst entry without a listing-level
        # deadline. Check the official detail instead, while still requiring a
        # verified, open explicit deadline before a recommendation is made.
        eligible_cards.append(rec)
    eligible_cards.sort(key=lambda x:(x['deadline'] or '9999-12-31',x['url']))
    # If the upstream publishes more than the bounded budget, mark the source
    # unhealthy rather than pretending this was a complete replacement set.
    budget=min(20,max(1,limit*2))
    if len(eligible_cards)>budget:
        note('detail_verification_budget_exceeded')
        failures.append({'url':spec['lists'][0],'reason':'too_many_candidates_for_bounded_verification'})
    checked=eligible_cards[:budget]
    admitted=[]
    for rec in checked:
        try:
            final,html=fetch_fn(rec['url'],[spec['host']])
            if detail_url(final,spec)!=rec['url']:
                raise ValueError('official detail redirect mismatch')
            lines=article(html,rec['title'])
            if not lines:
                # Mark a structural drift, not an intentional zero-match.
                raise ValueError('official article heading not verified')
            out['parsedOk']+=1
            reasons=[]
            item=candidate(rec,html,source_id,stamp,today=today,reasons=reasons)
            if item:
                admitted.append(item)
            else:
                note(reasons[0] if reasons else 'unclassified_rejection',rec)
        except Exception as exc:
            failures.append({'url':rec['url'],'reason':str(exc)[:220]})
            note('detail_fetch_or_structure_failure',rec)
    out['fetchFailures']=failures
    out['healthy']=not failures and (bool(seen) or empty_verified)
    out['accepted']=list({x['id']:x for x in admitted}.values()) if out['healthy'] else []
    logger(f'NATIONAL_YOUTH source={source_id} healthy={out["healthy"]} '
           f'lists={len(urls)} links={out["discovered"]} verified={out["parsedOk"]} '
           f'accepted={len(out["accepted"])} skipped={out["skippedPast"]} failures={len(failures)} '
           f'reasons={dict(sorted(out["reviewReasons"].items()))}')
    return out
