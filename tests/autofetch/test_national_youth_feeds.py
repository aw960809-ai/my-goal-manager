#!/usr/bin/env python3
"""No actual outbound requests or production user data; official HTML fixtures."""
import sys,unittest
from datetime import date
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
MODULE_DIR=ROOT/'tools'/'autofetch'
if not MODULE_DIR.exists(): MODULE_DIR=Path(__file__).resolve().parent
sys.path.insert(0,str(MODULE_DIR))
import national_youth_feeds as y
TODAY=date(2026,10,16)

class Tests(unittest.TestCase):
    def yf(self,title='2026全國青年公共政策創意提案競賽',uid='99881',end='2026.11.25',desc='採線上報名並上傳計畫書'):
        listing=f'<html><h1>青年第一讚主題資源</h1><article><a href="/index.php/subject/content/{uid}">{title}</a><span>教育部青年發展署</span><p>申請期限： 2026.10.01 - {end}</p><a href="/category">競賽</a></article></html>'
        detail=f'<html><h1>{title}</h1><p>單位：教育部青年發展署</p><p>報名/申請期間：2026-10-01 至 {end}</p><h2>申請方式</h2><p>{desc}</p></html>'
        return listing.encode(),detail.encode()
    def yn(self,title='全國青年法治政策徵文競賽線上投稿',uid='70999',deadline='115年11月25日',desc='全程採線上投稿，填寫網路表單。'):
        listing=f'<html><h1>全部消息</h1><span>115-10-05</span><a href="/docDetail.aspx?docid={uid}&pid=53&uid=60">{title}</a></html>'
        detail=f'<html><h2>{title}</h2><p>上架日期:115-10-05</p><p>徵件截止：{deadline}</p><p>{desc}</p></html>'
        return listing.encode(),detail.encode()
    def test_date(self):
        self.assertEqual(y.iso('115年11月25日'),'2026-11-25')
        self.assertEqual(y.iso('2026.11.25'),'2026-11-25')
        self.assertEqual(y.iso('115/02/30'),'')
    def test_yf_link_exact(self):
        sp=y.SOURCES['youthfirst_national']
        self.assertEqual(y.detail_url('/index.php/subject/content/88451',sp),'https://youthfirst.yda.gov.tw/index.php/subject/content/88451')
        self.assertEqual(y.detail_url('index.php/subject/content/88451',sp),'https://youthfirst.yda.gov.tw/index.php/subject/content/88451')
        for url in ['https://evil.com/index.php/subject/content/88451','http://youthfirst.yda.gov.tw/index.php/subject/content/88451','//evil.com/subject/content/88451','/subject/content/abc']:
            self.assertEqual(y.detail_url(url,sp),'',url)
    def test_yda_link_exact(self):
        sp=y.SOURCES['yda_national_news']
        self.assertEqual(y.detail_url('/docDetail.aspx?docid=69582&pid=53&uid=60',sp),'https://www.yda.gov.tw/docDetail.aspx?docid=69582&pid=53&uid=60')
        for url in ['https://attacker.gov.tw/docDetail.aspx?docid=69582','https://www.yda.gov.tw:9443/docDetail.aspx?docid=69582','/docDetail.aspx?docid=NaN']:
            self.assertEqual(y.detail_url(url,sp),'',url)
    def test_yf_listing_period(self):
        p,_=y.listing(self.yf()[0],y.SOURCES['youthfirst_national'])
        self.assertEqual(len(p),1)
        self.assertEqual(p[0]['deadline'],'2026-11-25')
        self.assertEqual(p[0]['start'],'2026-10-01')
    def test_yf_real_candidate(self):
        html,detail=self.yf()
        cards,_=y.listing(html,y.SOURCES['youthfirst_national'])
        e=y.candidate(cards[0],detail,'youthfirst_national','stamp',today=TODAY)
        self.assertEqual(e['date'],'2026-11-25')
        self.assertEqual(e['dateKind'],'application_deadline')
        self.assertEqual(e['deadline'],'2026-11-25')
        self.assertEqual(e['location'],'線上投稿／全國參與')
        self.assertTrue(e['id'].startswith('auto-youthfirst-'))
        self.assertIn('非活動舉辦日期',e['statusText'])
    def test_yda_news_candidate(self):
        html,detail=self.yn()
        cards,_=y.listing(html,y.SOURCES['yda_national_news'])
        e=y.candidate(cards[0],detail,'yda_national_news','stamp',today=TODAY)
        self.assertEqual(e['deadline'],'2026-11-25')
        self.assertIn('青年發展署',e['source'])
    def test_false_positive_rejected(self):
        for title in ['兒童英文繪本快樂遊','國際友好音樂祭','跨文化美食料理講座','台北金融知識平台','2026臺大人工智慧法學研討會入選名單']:
            with self.subTest(title=title):
                self.assertFalse(y.topic_ok(title))
    def test_past_and_undated_rejected(self):
        title='全國青年公共政策提案競賽'
        for day in ('2026.10.15','2026.09.13'):
            html,detail=self.yf(title=title,end=day)
            cards,_=y.listing(html,y.SOURCES['youthfirst_national'])
            self.assertIsNone(y.candidate(cards[0],detail,'youthfirst_national','s',today=TODAY))
        html,detail=self.yf()
        cards,_=y.listing(html,y.SOURCES['youthfirst_national'])
        cards[0]['deadline']=''
        self.assertIsNone(y.candidate(cards[0],detail,'youthfirst_national','s',today=TODAY))
    def test_onsite_camp_not_online_due_to_signup(self):
        title='116年YOUNG飛全球行動計畫培訓營開始報名'
        html,detail=self.yn(title=title,desc='需先線上報名，並完成線上課程學習，北區於臺北飯店實體辦理。')
        cards,_=y.listing(html,y.SOURCES['yda_national_news'])
        self.assertIsNone(y.candidate(cards[0],detail,'yda_national_news','s',today=TODAY))
    def test_mandatory_prerequisite_not_assumed(self):
        html,detail=self.yn(title='青年帶路公共政策創意提案線上徵件',desc='須於投稿截止日前實際參與青年壯遊點，採線上投稿。')
        cards,_=y.listing(html,y.SOURCES['yda_national_news'])
        self.assertIsNone(y.candidate(cards[0],detail,'yda_national_news','s',today=TODAY))
    def test_inperson_final_disqualifies(self):
        html,detail=self.yf(desc='採線上投稿，初賽通過後決賽須到場。')
        cards,_=y.listing(html,y.SOURCES['youthfirst_national'])
        self.assertIsNone(y.candidate(cards[0],detail,'youthfirst_national','s',today=TODAY))
    def test_restrict_qualifications(self):
        html,detail=self.yf(desc='採線上投稿，僅限本校教師參與。')
        cards,_=y.listing(html,y.SOURCES['youthfirst_national'])
        self.assertIsNone(y.candidate(cards[0],detail,'youthfirst_national','s',today=TODAY))
    def test_strict_article_provenance(self):
        html,detail=self.yf()
        cards,_=y.listing(html,y.SOURCES['youthfirst_national'])
        self.assertFalse(y.article('<h2>無關的網頁</h2><p>2026-11-25可報名</p>'.encode(),cards[0]['title']))
        self.assertIsNone(y.candidate(cards[0],'<h2>無關的網頁</h2><p>線上投稿</p>'.encode(),'youthfirst_national','s',today=TODAY))
    def test_complete_source_and_failure(self):
        source='youthfirst_national'
        h,d=self.yf()
        spec=y.SOURCES[source]
        seen=[]
        def fetch(u,allowlist):
            self.assertEqual(allowlist,[spec['host']]);seen.append(u)
            return u,(d if '/subject/content/' in u else h)
        res=y.run_source(source,fetch_fn=fetch,stamp='s',today=TODAY,logger=lambda s:None)
        self.assertTrue(res['healthy'],res)
        self.assertEqual(len(res['accepted']),1)
        self.assertEqual(res['discovered'],1)
        self.assertEqual(res['parsedOk'],1)
        self.assertTrue(len(seen)>3)
        def fail(u,allowlist):
            if '/0/2?' in u:raise TimeoutError('timeout')
            return fetch(u,allowlist)
        res2=y.run_source(source,fetch_fn=fail,stamp='s',today=TODAY,logger=lambda s:None)
        self.assertFalse(res2['healthy'])
        self.assertEqual(res2['accepted'],[])
        self.assertGreaterEqual(len(res2['fetchFailures']),1)
    def test_news_source_listing_and_fallback(self):
        source='yda_national_news'
        h,d=self.yn()
        spec=y.SOURCES[source]
        def fetch(u,allowlist):return u,d if 'docDetail' in u else h
        r=y.run_source(source,fetch_fn=fetch,stamp='s',today=TODAY,logger=lambda s:None)
        self.assertTrue(r['healthy'],r)
        self.assertEqual(len(r['accepted']),1)
    def test_broken_links_unhealthy(self):
        for src in y.SOURCES:
            sp=y.SOURCES[src]
            r=y.run_source(src,fetch_fn=lambda u,a:(u,b'<html><a href="/login">login</a></html>'),stamp='s',today=TODAY,logger=lambda s:None)
            self.assertFalse(r['healthy'],src)
            self.assertFalse(r['accepted'])
    def test_valid_empty_source_is_healthy(self):
        spec=y.SOURCES['yda_national_news']
        def fetch(u,a):return u,'<html><p>顯示0筆，沒有符合條件的資料</p></html>'.encode()
        r=y.run_source('yda_national_news',fetch_fn=fetch,stamp='s',today=TODAY,logger=lambda s:None)
        self.assertTrue(r['healthy'])
        self.assertFalse(r['accepted'])

if __name__=='__main__':unittest.main(verbosity=2)
