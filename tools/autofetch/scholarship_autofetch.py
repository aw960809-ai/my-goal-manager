#!/usr/bin/env python3
from __future__ import annotations
import urllib.parse
import argparse, json, os, re, ssl, tempfile, urllib.request
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from lifecycle_archive import archive_document, atomic_write_json, reconcile_scholarship_catalog

BASE="https://tscholarship.thu.edu.tw/wwwstud/frontend/Scholarship.php"
SOURCE_ID="thu_scholarship_official"
CATEGORIES=[
 ("external",BASE,"校外單位"),
 ("government",BASE+"?scholartype=C","政府預算"),
 ("department",BASE+"?scholartype=D","校內各系"),
 ("campus",BASE+"?scholartype=E","校內其他單位"),
]
DATE_RX=re.compile(r"(20\d{2})[./-](\d{1,2})[./-](\d{1,2})")
SPACE=re.compile(r"\s+")

def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")

def clean(v):
    return SPACE.sub(" ",str(v or "")).strip()

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.row=None;self.cell=None;self.rows=[]
    def handle_starttag(self,tag,attrs):
        tag=tag.lower()
        if tag=="tr":self.row=[]
        elif self.row is not None and tag in ("td","th"):self.cell=[]
    def handle_data(self,data):
        if self.cell is not None:self.cell.append(data)
    def handle_endtag(self,tag):
        tag=tag.lower()
        if self.cell is not None and tag in ("td","th"):
            self.row.append(clean("".join(self.cell)));self.cell=None
        elif tag=="tr" and self.row is not None:
            if self.row:self.rows.append(self.row)
            self.row=None

def ssl_context():
    ctx=ssl.create_default_context()
    if hasattr(ssl,"VERIFY_X509_STRICT"):
        ctx.verify_flags &= ~ssl.VERIFY_X509_STRICT
    return ctx

def fetch(url):
    req=urllib.request.Request(url,headers={
      "User-Agent":"GoalManagerTHUScholarship/96.8.2",
      "Accept-Language":"zh-TW,zh;q=0.9",
      "Cache-Control":"no-cache"
    })
    with urllib.request.urlopen(req,timeout=25,context=ssl_context()) as r:
        raw=r.read()
        enc=r.headers.get_content_charset() or "utf-8"
        return raw.decode(enc,"replace")

def last_date(text):
    out=[]
    for m in DATE_RX.finditer(text):
        try:out.append(date(int(m.group(1)),int(m.group(2)),int(m.group(3))))
        except ValueError:pass
    return max(out).isoformat() if out else ""

def parse(html,sub_id,sub_name,url,today=None):
    today=today or date.today()
    p=TableParser();p.feed(html)
    recognized=any("獎助學金名稱" in " ".join(r) and "申請日期" in " ".join(r) for r in p.rows)
    rows=[];parsed_total=0
    for r in p.rows:
        if len(r)<5:continue
        joined=" | ".join(r)
        if "獎助學金名稱" in joined or "申請日期" in joined:continue
        number=clean(r[2]) if len(r)>2 else ""
        title=clean(r[3]) if len(r)>3 else ""
        window=clean(r[4]) if len(r)>4 else ""
        if not number or not title:continue
        parsed_total+=1
        deadline=last_date(window)
        if not deadline or deadline<today.isoformat():continue
        category=clean(r[1]) if len(r)>1 else sub_name
        amount=clean(r[6]) if len(r)>6 else ""
        rows.append({
          "id":f"auto-thu-sch-{sub_id}-{number}",
          "title":title,"date":deadline,"deadline":deadline,"time":"",
          "scope":"東海校內","type":"獎學金／助學金","kind":"scholarship",
          "url":url,"keywords":f"{title} {category} {amount} 東海大學 獎學金",
          "direct":True,"team":False,"available":True,
          "source":"東海大學｜獎助學金查詢",
          "sourceId":SOURCE_ID,"sourceSubId":sub_id,"sourcePriority":"core",
          "scholarship":True,"auto":True,
          "applicationWindow":window,"category":category,"amount":amount,
          "statusText":f"東海官方獎助學金；申請期限 {deadline}",
          "fetchedAt":now_iso()
        })
    uniq={x["id"]:x for x in rows}
    return sorted(uniq.values(),key=lambda x:(x["deadline"],x["title"])),recognized,parsed_total

def load(path):
    try:return json.loads(path.read_text(encoding="utf-8"))
    except Exception:return {"scholarships":[],"meta":{}}

def rows_of(x):
    if isinstance(x,list):return x
    if isinstance(x,dict):
        for k in ("scholarships","items","events"):
            if isinstance(x.get(k),list):return x[k]
    return []

def output_shape(old,rows,meta):
    if isinstance(old,list):return rows
    out=dict(old) if isinstance(old,dict) else {}
    if "items" in out and "scholarships" not in out:out["items"]=rows
    else:out["scholarships"]=rows
    out["meta"]=meta
    return out

def atomic(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix=path.name+".",suffix=".tmp",dir=str(path.parent));os.close(fd)
    p=Path(tmp)
    try:
        p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        json.loads(p.read_text(encoding="utf-8"))
        p.replace(path)
    finally:p.unlink(missing_ok=True)

# V97.4.9 THU specialty scholarship/reward source
SPECIALTY_NEWS_URL="https://teach.thu.edu.tw/web/news/list.php?cid=4&lang=zh_tw"
SPECIALTY_TITLE_RX=re.compile(r"(專業證照.*?(?:獎勵|獎勵|補助).*?申請公告|外語能力檢定.*?(?:獎勵|獎勵|補助).*?申請公告)",re.I)
SPECIALTY_DEADLINE_RX=re.compile(r"(?<!\d)(\d{1,2})\s*/\s*(\d{1,2})\s*截止")

class SpecialtyNewsParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.href=None;self.parts=[];self.links=[];self.all_text=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower()=="a":self.href=dict(attrs).get("href");self.parts=[]
    def handle_data(self,data):
        value=clean(data)
        if not value:return
        self.all_text.append(value)
        if self.href is not None:self.parts.append(value)
    def handle_endtag(self,tag):
        if tag.lower()=="a" and self.href is not None:
            text=clean(" ".join(self.parts))
            if text:self.links.append((self.href,text))
            self.href=None;self.parts=[]

def specialty_deadline(text,today=None):
    today=today or date.today();m=SPECIALTY_DEADLINE_RX.search(clean(text))
    if not m:return ""
    try:d=date(today.year,int(m.group(1)),int(m.group(2)))
    except ValueError:return ""
    if d<today and today.month>=11:d=date(today.year+1,d.month,d.day)
    return d.isoformat()

def specialty_kind(title):
    return "professional" if "專業證照" in title else "language"

def parse_specialty_news(html,today=None):
    today=today or date.today();p=SpecialtyNewsParser();p.feed(html)
    recognized=bool(re.search(r"專業證照|外語能力檢定"," ".join(p.all_text)));by_kind={}
    for href,title in p.links:
        if not SPECIALTY_TITLE_RX.search(title):continue
        kind=specialty_kind(title);deadline=specialty_deadline(title,today);detail=urllib.parse.urljoin(SPECIALTY_NEWS_URL,href)
        if not deadline:
            try:
                detail_text=fetch(detail);tp=SpecialtyNewsParser();tp.feed(detail_text);deadline=specialty_deadline(" ".join(tp.all_text),today)
            except Exception:deadline=""
        if not deadline or deadline<today.isoformat():continue
        label="專業考照" if kind=="professional" else "外語能力"
        row={
          "id":"auto-thu-sch-specialty-"+("professional-certificate" if kind=="professional" else "foreign-language"),
          "title":title,"date":deadline,"deadline":deadline,"time":"",
          "scope":"東海校內","type":"獎學金／助學金","kind":"scholarship",
          "url":detail,"detailUrl":detail,
          "keywords":f"{title} 東海大學 教務處 教學發展中心 {label} 獎勵 補助",
          "description":f"東海大學教務處教學發展中心官方{label}獎勵申請公告",
          "direct":True,"team":False,"available":True,"source":"東海大學教務處｜教學發展中心",
          "sourceId":SOURCE_ID,"sourceSubId":"specialty","sourcePriority":"core","scholarship":True,"auto":True,
          "category":label,"specialtyKind":kind,"eligibilityTarget":"general_student",
          "statusText":f"東海官方{label}獎勵；申請期限 {deadline}","fetchedAt":now_iso()
        }
        old=by_kind.get(kind)
        if old is None or row["deadline"]<old["deadline"]:by_kind[kind]=row
    return sorted(by_kind.values(),key=lambda x:(x["deadline"],x["title"])),recognized,len(p.links)

def run(repo,check):
    target=repo/"data"/"scholarships.json"
    archive_target=repo/"data"/"scholarship-archive.json"
    old=load(target);old_rows=rows_of(old)
    old_archive=load(archive_target)
    archive_rows=(old_archive.get("archive",[]) if isinstance(old_archive,dict) else [])
    healthy=set();fresh={};report=[]
    for sid,url,name in CATEGORIES:
        info={"id":sid,"name":name,"url":url,"ok":False}
        try:
            body=fetch(url)
            rows,recognized,total=parse(body,sid,name,url)
            info.update({"recognized":recognized,"parsedTotal":total,"active":len(rows)})
            if not recognized or total<=0:
                info["error"]="structure_not_trusted"
            else:
                info["ok"]=True;healthy.add(sid);fresh[sid]=rows
        except Exception as e:
            info["error"]=f"{type(e).__name__}: {e}"
        report.append(info)
# V97.4.9 specialty source: professional certification + foreign-language rewards.
    specialty_info={"id":"specialty","name":"教發中心｜專業證照／外語檢定","url":SPECIALTY_NEWS_URL,"ok":False}
    try:
        specialty_body=fetch(SPECIALTY_NEWS_URL)
        specialty_rows,specialty_recognized,specialty_total=parse_specialty_news(specialty_body)
        specialty_info.update({"recognized":specialty_recognized,"parsedTotal":specialty_total,"active":len(specialty_rows)})
        if specialty_recognized:
            specialty_info["ok"]=True;healthy.add("specialty");fresh["specialty"]=specialty_rows
        else:specialty_info["error"]="structure_not_trusted"
    except Exception as e:
        specialty_info["error"]=f"{type(e).__name__}: {e}"
    report.append(specialty_info)

    if not healthy:
        print(json.dumps({"ok":False,"preservedPrevious":True,"categories":report},ensure_ascii=False,indent=2))
        raise SystemExit(2)

    keep=[];preserved_failed=0;replaced=0
    for x in old_rows:
        if not isinstance(x,dict):continue
        if x.get("sourceId")==SOURCE_ID and x.get("auto"):
            sub=x.get("sourceSubId")
            if sub in healthy:
                replaced+=1;continue
            preserved_failed+=1
        keep.append(x)
    new_auto=[]
    for sid in healthy:new_auto.extend(fresh[sid])
    by={}
    for x in keep+new_auto:
        k=str(x.get("id") or "")
        if k:by[k]=x
    candidate_rows=list(by.values())

    stamp=now_iso()
    rows,archive_rows,lifecycle=reconcile_scholarship_catalog(
        old_rows=old_rows,
        candidate_rows=candidate_rows,
        healthy_categories=healthy,
        archive_rows=archive_rows,
        source_id=SOURCE_ID,
        now=stamp,
    )
    active_auto=sum(1 for x in rows if isinstance(x,dict) and x.get("sourceId")==SOURCE_ID and x.get("auto") is True)
    meta={
      "updatedAt":stamp,"sourceId":SOURCE_ID,
      "categories":len(CATEGORIES)+1,
      "healthyCategories":len(healthy),
      "failedCategories":len(CATEGORIES)+1-len(healthy),
      "freshAuto":len(new_auto),
      "activeAuto":active_auto,
      "replacedPreviousAuto":replaced,
      "preservedFailedAuto":int(lifecycle.get("retainedOnFailure") or preserved_failed),
      "failClosedUndated":True,
      "preserveOnFailure":True,
      "atomicWrite":True,
      "lifecycleArchive":True,
      "retiredThisRun":int(lifecycle.get("retiredThisRun") or 0),
      "revivedThisRun":int(lifecycle.get("revivedThisRun") or 0),
      "archiveCount":int(lifecycle.get("archiveCount") or 0),
      "carriedMissing":int(lifecycle.get("carriedMissing") or 0),
      "needsReview":int(lifecycle.get("needsReview") or 0),
      "lifecyclePolicy":"expired-immediate; missing-two-hits-plus-30-days; failed-source-no-miss; source-reappearance-auto-revive"
    }
    result=output_shape(old,rows,meta)
    archive_doc=archive_document(old_archive if isinstance(old_archive,dict) else {},archive_rows,lifecycle,"scholarship",now=stamp)
    if check:
        print(json.dumps({"ok":True,"meta":meta,"lifecycle":lifecycle,"categories":report,"sample":new_auto[:8]},ensure_ascii=False,indent=2))
        return

    # Write archive first: if the second atomic write fails, history is preserved and the
    # next successful run will automatically reconcile/remove any active/archive overlap.
    atomic_write_json(archive_target,archive_doc)
    atomic(target,result)
    print(json.dumps({"ok":True,"meta":meta,"lifecycle":lifecycle,"categories":report},ensure_ascii=False,indent=2))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--repo",type=Path,default=Path("."))
    ap.add_argument("--check",action="store_true")
    args=ap.parse_args()
    run(args.repo.expanduser().resolve(),args.check)

if __name__=="__main__":
    main()
