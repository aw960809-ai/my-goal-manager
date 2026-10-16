#!/usr/bin/env python3
"""Offline fake official HTML, no outbound network or production data changes."""
import sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]/'tools'/'autofetch') if (Path(__file__).resolve().parents[2]/'tools'/'autofetch').exists() else str(Path(__file__).parent))
import university_law_opportunities as legal

TODAY=date(2026,10,16)
NTU_TITLE='專題演講: 1115/11/3（二）、11/6（五）井田良教授法學國際講座專題演講'
NCCU_TITLE='115.11.05（四）當代刑法學的角色與課題（今日の刑法学の役割と課題）'
NCCU_RESTRICTED='115.10.19（一）民事裁判研習專題研討會（第二場）'

class Plain(HTMLParser):
    def __init__(self):
        super().__init__();self.lines=[];self.skip=0
    def handle_data(self, data):
        data=data.strip()
        if data: self.lines.append(data)

def parse_lines(body):
    p=Plain();p.feed(body.decode() if isinstance(body,bytes) else body);return p.lines

NTU_DETAIL=f'''<html><head><title>{NTU_TITLE} - 臺大法律學院</title></head>
<body><nav>首頁 法學 學術活動</nav><h2>{NTU_TITLE}</h2>
<p>蔡墩銘教授法學國際講座專題演講</p>
<h3>場次一</h3><p>追究人工智慧刑事責任之可能性</p>
<p>時間：民國115年11月3日（二）上午10:00 - 12:00</p>
<p>地點：臺大法律學院霖澤館1301多媒體教室</p>
<h3>場次二</h3><p>理論刑法學的思想與方法：Welzel、Habermas與Hegel</p>
<p>時間：民國115年11月6日（五）下午15:00 - 17:00</p>
<p>地點：臺大法律學院霖澤館7樓第1會議室</p>
<p>本次研討會無需報名，自由入座。</p>
</body></html>'''
NCCU_DETAIL=f'''<html><nav>招生 學校公告 法學院</nav><h1>{NCCU_TITLE}</h1>
<div>政大刑事法講座（三十九）</div>
<p>日期：2026年11月5日（週四）10:00-12:00</p>
<p>地點：國立政治大學法學院4F 王文杰講堂</p>
<p>主題：當代刑法學的角色與課題</p><p>本次演講為自由入場。</p></html>'''
NCCU_CLOSED=f'''<html><h1>{NCCU_RESTRICTED}</h1><p>活動日期：2026年10月19日（週一）</p>
<p>活動地點：政大法學院民事法中心</p><p>名額有限，法研所民法組學生優先錄取，
錄取通知於10月15日寄出，不開放現場候補。</p></html>'''

class UniversityLawTests(unittest.TestCase):
    def mk(self,source,*,closed=False,fail=None):
        s=legal.SOURCES[source]
        title = NTU_TITLE if source=='ntu_law' else NCCU_TITLE
        url = ('https://www.law.ntu.edu.tw/index.php/公告/item/3573-a'
               if source=='ntu_law' else
               'https://law.nccu.edu.tw/zh_tw/news/events/115-11-05-74360647')
        pages={s['url']:f'<html><a href="{url}">{title}</a></html>'.encode(),
               url: (NTU_DETAIL if source=='ntu_law' else NCCU_DETAIL).encode()}
        if closed and source=='nccu_law':
            url2='https://law.nccu.edu.tw/zh_tw/news/events/115-10-19-68704906'
            pages[s['url']]=f'<html><a href="{url}">{title}</a><a href="{url2}">{NCCU_RESTRICTED}</a></html>'.encode()
            pages[url2]=NCCU_CLOSED.encode()
        def fetch(u,allowlist):
            self.assertEqual(allowlist,[s['host']]);self.assertIn(u,pages)
            if fail and u==fail: raise TimeoutError('upstream timeout')
            return u,pages[u]
        return fetch

    def test_university_sources_have_real_verified_official_urls(self):
        self.assertEqual(set(legal.SOURCES),{'ntu_law','nccu_law'})
        for sid,s in legal.SOURCES.items():
            self.assertEqual(s['host'],s['url'].split('/')[2]);self.assertTrue(s['url'].startswith('https://'))
            self.assertTrue(s['prefix'].startswith('auto-law-'))

    def test_ntu_two_open_public_legal_sessions(self):
        r=legal.run_source('ntu_law',fetch_fn=self.mk('ntu_law'),parse_lines=parse_lines,
                           stamp='2026-10-16T00:00:00Z',today=TODAY,logger=lambda x:None)
        self.assertTrue(r['healthy'],r);self.assertEqual(r['parsedOk'],1)
        self.assertEqual({x['date'] for x in r['accepted']},{'2026-11-03','2026-11-06'})
        self.assertEqual(len({x['id'] for x in r['accepted']}),2)
        self.assertTrue(all(x['scope']=='全國' for x in r['accepted']))
        self.assertTrue(all(x['sourceId']=='ntu_law' for x in r['accepted']))
        self.assertTrue(all('霖澤館' in x['location'] for x in r['accepted']))
        self.assertIn('追究人工智慧刑事責任之可能性',r['accepted'][0]['title'])

    def test_nccu_public_lecture_and_restricted_19th(self):
        r=legal.run_source('nccu_law',fetch_fn=self.mk('nccu_law',closed=True),
            parse_lines=parse_lines,stamp='2026-10-16T00:00:00Z',today=TODAY,logger=lambda x:None)
        self.assertTrue(r['healthy'],r)
        self.assertEqual([x['date'] for x in r['accepted']],['2026-11-05'])
        self.assertIn('刑法學',r['accepted'][0]['title'])
        self.assertEqual(r['accepted'][0]['time'],'10:00')

    def test_nonofficial_redirects_rejected(self):
        spec=legal.SOURCES['nccu_law']
        for url in ('http://law.nccu.edu.tw/zh_tw/news/events/a',
                    'https://law.nccu.edu.tw.evil.test/zh_tw/news/events/a',
                    'https://evil.test/zh_tw/news/events/a',
                    'https://law.nccu.edu.tw:8443/zh_tw/news/events/a',
                    'https://username:pass@law.nccu.edu.tw/zh_tw/news/events/a'):
            self.assertFalse(legal.valid_detail(url,spec),url)

    def test_broken_official_listing_is_not_healthy(self):
        s=legal.SOURCES['nccu_law']
        def fetch(u,a):return u,b'<html><nav><a href="/login">login</a></nav></html>'
        r=legal.run_source('nccu_law',fetch_fn=fetch,parse_lines=parse_lines,
                           stamp='stamp',today=TODAY,logger=lambda x:None)
        self.assertFalse(r['healthy']);self.assertFalse(r['accepted'])
        self.assertEqual(len(r['fetchFailures']),1)

    def test_detail_network_failure_is_fail_closed(self):
        url='https://law.nccu.edu.tw/zh_tw/news/events/115-11-05-74360647'
        r=legal.run_source('nccu_law',fetch_fn=self.mk('nccu_law',fail=url),
                           parse_lines=parse_lines,stamp='stamp',today=TODAY,logger=lambda x:None)
        self.assertFalse(r['healthy']);self.assertFalse(r['accepted'])
        self.assertEqual(len(r['fetchFailures']),1)

    def test_open_entry_without_real_future_date_rejected(self):
        s=legal.SOURCES['ntu_law']
        rec={'title':NTU_TITLE,'url':'https://www.law.ntu.edu.tw/index.php/公告/item/3573-a'}
        html=f'<h2>{NTU_TITLE}</h2><p>2026/10/07 發布日期</p><p>無需報名自由入場</p><p>地點：臺大法律學院</p>'
        accepted,reason=legal.events_from_detail(rec,html.encode(),s,parse_lines,'stamp',today=TODAY)
        self.assertFalse(accepted)

if __name__=='__main__':unittest.main(verbosity=2)
