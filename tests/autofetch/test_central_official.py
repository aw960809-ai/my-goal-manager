#!/usr/bin/env python3
"""Offline regression for four official Circle-3 adapters. No web or user data."""
import importlib.util
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path

MOD = Path(__file__).resolve().parents[2] / 'tools' / 'autofetch' / 'central_official.py'
spec=importlib.util.spec_from_file_location('central_official',MOD)
region=importlib.util.module_from_spec(spec)
spec.loader.exec_module(region)


def future_days(n=32):
    d=date.today()+timedelta(days=n)
    return d, f'{d.year-1911}年{d.month}月{d.day}日', f'{d.year}/{d.month:02}/{d.day:02}'


class OfficialRegionTests(unittest.TestCase):
    def setUp(self):
        self.d,self.roc,self.gregorian=future_days()
        self.stamp='2026-10-08T06:45:00+00:00'
        self.record={}
        self.counter={}
        self.pages={}
        self.snippets={
            'miaoli_government':(
                '/News_Content2.aspx?n=286&s=1000208','青年法治講座與模擬法庭',
                f'<h3>青年法治講座與模擬法庭</h3><p>將於{self.roc}上午10時辦理，免費參加。苗栗縣立圖書館</p>'
            ),
            'changhua_government':(
                '/ch2/active.aspx?bull_id=438517','大學生法律研習工作坊',
                f'<h2>大學生法律研習工作坊</h2><p>活動日期</p><p>{self.d.year-1911}/{self.d.month:02}/{self.d.day:02}～{self.d.year-1911}/{self.d.month:02}/{self.d.day:02}</p><p>活動地點：彰化縣文化中心</p>'
            ),
            'nantou_culture':(
                '/A4_1/content/34381','青年法律及資訊研習',
                f'<h3>青年法律及資訊研習</h3><table><tr><td>活動日期</td><td>{self.gregorian} ~ {self.gregorian}</td></tr></table><p>南投縣政府文化局</p>'
            ),
            'yunlin_government':(
                '/News_Content.aspx?n=1245&s=606004','雲林青年國際交流研習課程',
                f'<h2>雲林青年國際交流研習課程</h2><p>活動日期(起)</p><p>{self.d.year-1911}-{self.d.month:02}-{self.d.day:02}</p><p>活動日期(迄)</p><p>{self.d.year-1911}-{self.d.month:02}-{self.d.day:02}</p><p>地點：斗六市</p>'
            )
        }

    @staticmethod
    def parser(body):
        p=region.ListingParser();p.feed(body.decode('utf-8','replace'))
        # A faithful stand-in for the existing repo's PlainTextParser
        from html.parser import HTMLParser
        class Text(HTMLParser):
            def __init__(self):super().__init__();self.lines=[]
            def handle_data(self,data):
                s=data.strip()
                if s:self.lines.append(s)
        t=Text();t.feed(body.decode('utf-8','replace'));return t.lines

    def build_mock(self,srcid):
        spec=region.REGIONS[srcid]
        href,title,detail=self.snippets[srcid]
        page=f'<html><table><tr><td>教育活動</td><td><a href="{href}">{title}</a></td><td>{self.gregorian} ~ {self.gregorian}</td></tr></table></html>'
        full=spec['url'].split('?',1)[0]
        self.pages[spec['url']]=page.encode()
        self.pages[region.urljoin(spec['url'],href)]=detail.encode()

        def mock_fetch(url,allowlist):
            self.assertEqual(allowlist,[spec['host']])
            self.assertIn(url,self.pages,'Unexpected URL, possible cross-source request')
            return url,self.pages[url]
        return mock_fetch

    def test_official_registry(self):
        self.assertEqual(len(region.REGIONS),4)
        self.assertEqual({sid for sid,x in region.REGIONS.items() if x['enabled']},
                         {'changhua_government','nantou_culture'})
        for sid,v in region.REGIONS.items():
            self.assertEqual(v['url'].split('/')[2],v['host'])
            self.assertTrue(v['url'].startswith('https://'))
            self.assertEqual(v['prefix'].count('auto-central-'),1)

    def test_four_successful_structured_candidates(self):
        for sid in region.REGIONS:
            with self.subTest(source=sid):
                self.pages={}
                fetch=self.build_mock(sid)
                result=region.run_source(sid,fetch_fn=fetch,parse_lines=self.parser,stamp=self.stamp,limit=6,logger=lambda _s:None)
                self.assertEqual(result['discovered'],1)
                self.assertEqual(result['parsedOk'],1)
                self.assertTrue(result['healthy'],result)
                self.assertEqual(len(result['accepted']),1)
                c=result['accepted'][0]
                self.assertEqual(c['scope'],'中部')
                self.assertEqual(c['date'],self.d.isoformat())
                self.assertEqual(c['eventEndDate'],self.d.isoformat())
                self.assertEqual(c['autofetch']['sourceId'],sid)
                self.assertTrue(c['id'].startswith(region.REGIONS[sid]['prefix']))
                self.assertTrue(c['url'].startswith('https://'+region.REGIONS[sid]['host']+'/'))

    def test_rejects_untrusted_or_changed_url(self):
        src=region.REGIONS['yunlin_government']
        for url in [
            'http://www.yunlin.gov.tw/News_Content.aspx?n=1245&s=123',
            'https://www.attacker.com/News_Content.aspx?n=1245&s=123',
            'https://www.yunlin.gov.tw.evil.com/News_Content.aspx?n=1245&s=123',
            'https://www.yunlin.gov.tw/News_Content.aspx?n=4321&s=123',
            'https://www.yunlin.gov.tw/News.aspx?site=1',
            'https://www.yunlin.gov.tw/News_Content.aspx?n=1245&s=../secret',
        ]:
            self.assertFalse(region.valid_detail(url,src),url)

    def test_roc_date_conversion_and_sanity(self):
        self.assertEqual(region.iso_date('115-10-08'),'2026-10-08')
        self.assertEqual(region.iso_date('2026/10/08'),'2026-10-08')
        self.assertEqual(region.iso_date('115/02/30'),'')
        self.assertEqual(region.date_range('115/10/17 ~ 115/10/28'),('2026-10-17','2026-10-28'))
        self.assertEqual(region.iso_date('刊登 99月88日'),'')

    def test_miaoli_published_date_is_not_event_date(self):
        src=region.REGIONS['miaoli_government']
        rec={'title':'青年法治講座與模擬法庭','url':'https://www.miaoli.gov.tw/News_Content2.aspx?n=286&s=123'}
        body='<h3>青年法治講座與模擬法庭</h3><p>此為新聞公告</p><p>上版日期：115-10-08</p><p>下版日期：115-11-30</p>'
        c,reason=region.build_candidate(rec,body.encode(),src,self.parser,self.stamp)
        self.assertIsNone(c);self.assertEqual(reason,'event_date_missing')

    def test_full_restricted_or_already_started_never_admitted(self):
        src=region.REGIONS['changhua_government']
        rec={'title':'AI青年工作坊〖報名已額滿〗','url':'https://www.chcg.gov.tw/ch2/active.aspx?bull_id=444'}
        body=f'<h2>{rec["title"]}</h2><div>活動日期</div><p>{self.gregorian}</p>'
        c,reason=region.build_candidate(rec,body.encode(),src,self.parser,self.stamp)
        self.assertIsNone(c);self.assertEqual(reason,'closed_or_restricted')
        rec['title']='青年職涯實習體驗'
        old=date.today()-timedelta(days=3)
        body=f'<h2>{rec["title"]}</h2><p>活動日期</p><p>{old.isoformat()}</p>'
        c,reason=region.build_candidate(rec,body.encode(),src,self.parser,self.stamp)
        self.assertIsNone(c);self.assertEqual(reason,'event_started_before_today')

    def test_changhua_real_page_title_precedes_navigation(self):
        src=region.REGIONS['changhua_government']
        title='青年法律與職涯講座'
        rec={'title':title,'url':'https://www.chcg.gov.tw/ch2/active.aspx?bull_id=435390'}
        # Real county pages repeat article title in <title> above long navigation.
        navigation=''.join(f'<li>選單項目 {i}</li>' for i in range(150))
        future=f'{self.d.year-1911}/{self.d.month:02}/{self.d.day:02}'
        body=(f'<html><head><title>{title}-彰化縣政府</title></head>'
              f'<body>{navigation}<h2>{title}</h2><p>發布日期</p>'
              f'<p>115/01/01～115/12/31</p><p>活動日期</p>'
              f'<p>{future}～{future}</p></body></html>').encode()
        candidate,reason=region.build_candidate(rec,body,src,self.parser,self.stamp)
        self.assertIsNone(reason,reason)
        self.assertEqual(candidate['date'],self.d.isoformat())
        self.assertNotEqual(candidate['date'],'2026-01-01', 'published date is never an event date')

    def test_failed_listing_is_unhealthy_and_does_not_produce_candidates(self):
        for sid in region.REGIONS:
            def failure(url,allowlist):raise RuntimeError('connection timeout')
            r=region.run_source(sid,fetch_fn=failure,parse_lines=self.parser,stamp=self.stamp,logger=lambda _:None)
            self.assertFalse(r['healthy']);self.assertEqual(r['accepted'],[])
            self.assertEqual(r['prefix'],region.REGIONS[sid]['prefix'])
            self.assertEqual(len(r['fetchFailures']),1)

    def test_markup_changed_is_unhealthy_not_an_empty_success(self):
        sid='miaoli_government'
        fetch=self.build_mock(sid)
        href,title,_detail=self.snippets[sid]
        url=region.urljoin(region.REGIONS[sid]['url'],href)
        self.pages[url]=b'<html><h1>Different government page</h1><p>Unrelated publication</p></html>'
        outcome=region.run_source(sid,fetch_fn=fetch,parse_lines=self.parser,stamp=self.stamp,logger=lambda _:None)
        self.assertFalse(outcome['healthy'])
        self.assertFalse(outcome['accepted'])
        self.assertEqual(outcome['rejected'][0]['reason'],'detail_title_unverified')

    def test_list_has_no_official_detail(self):
        s=region.REGIONS['changhua_government']
        listing=b'<html><a href="https://elsewhere.example.com/?bull_id=123">other</a><a href="/ch2/about.aspx">nav</a></html>'
        self.assertEqual(region.discover_listing(listing,s['url'],s,limit=4),[])

if __name__=='__main__':
    unittest.main(verbosity=2)
