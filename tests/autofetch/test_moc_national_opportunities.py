#!/usr/bin/env python3
"""Offline only. No network, user settings, or production data touched."""
import json
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'/'autofetch'))
import moc_national_opportunities as nat


class NationalSourceTests(unittest.TestCase):
    def setUp(self):
        self.today=date(2026,10,16)
        self.day=self.today+timedelta(days=14)
        self.stamp='2026-10-16T02:50:00Z'
        self.titles=[
            '公共政策與人權法律學術座談',
            '英語口譯與跨文化溝通工作坊',
            '全國青年演辯及公共政策競賽',
            '大學生創新企劃徵件',
        ]
        self.places=['臺北市中正區','高雄市','花蓮縣','臺中市']

    def fixture(self,i,**overrides):
        c=nat.CATEGORIES[i]
        row={
            'UID':f'2026-national-{i+10000}',
            'category':c,'title':self.titles[i],
            'showInfo':[{'time':f'{self.day.isoformat()} 14:00:00',
                         'endTime':f'{self.day.isoformat()} 16:00:00',
                         'location':self.places[i],'locationName':'大學講堂'}],
            'sourceWebPromote':'https://www.someuni.edu.tw/event/112233',
            'masterUnit':'大學學術活動中心','descriptionFilterHtml':'開放一般民眾報名',
            'startDate':self.day.isoformat(),
        }
        row.update(overrides)
        return row

    def test_four_nationwide_official_categories_without_county_gate(self):
        pages={nat.API_ROOT+cat:json.dumps([self.fixture(i)],ensure_ascii=False).encode()
               for i,cat in enumerate(nat.CATEGORIES)}
        requests=[]
        def fetch(url,allowlist):
            self.assertEqual(allowlist,[nat.FEED_DOMAIN])
            requests.append(url)
            return url,pages[url]
        result=nat.run_source(fetch_fn=fetch,stamp=self.stamp,today=self.today,logger=lambda _:None)
        self.assertEqual(result['categoryOk'],4)
        self.assertEqual(requests,list(pages))
        self.assertTrue(result['healthy'])
        self.assertEqual(len(result['accepted']),4)
        self.assertEqual({x['location'] for x in result['accepted']},set(self.places))
        self.assertEqual({x['scope'] for x in result['accepted']},{'全國'})
        self.assertEqual(len({x['id'] for x in result['accepted']}),4)

    def test_future_only_no_unspecified_registration_deadline(self):
        past=(self.today-timedelta(days=1)).isoformat()
        future=self.day.isoformat()
        old=self.fixture(0,showInfo=[{'time':past+' 10:00','location':'臺北市'}])
        no_place=self.fixture(0,showInfo=[{'time':future,'location':''}])
        self.assertIsNone(nat.event_candidate(old,'7',self.stamp,today=self.today))
        self.assertIsNone(nat.event_candidate(no_place,'7',self.stamp,today=self.today))
        live=self.fixture(0)
        event=nat.event_candidate(live,'7',self.stamp,today=self.today)
        self.assertEqual(event['deadline'],'')
        self.assertFalse(event['government'])
        self.assertEqual(event['date'],future)
        self.assertIn('以原公告',event['statusText'])

    def test_closed_or_restricted_excluded(self):
        for name in ['英語演說競賽（報名已額滿）','【教師專用】公民法治工作坊']:
            row=self.fixture(0,title=name)
            self.assertIsNone(nat.event_candidate(row,'7',self.stamp,today=self.today),name)
        row=self.fixture(0,descriptionFilterHtml='僅限教師參加')
        self.assertIsNone(nat.event_candidate(row,'7',self.stamp,today=self.today))

    def test_no_unrelated_concerts_or_random_museum_activities(self):
        for name in ['週末親子手作陶藝活動', '傳統織布體驗', '2026音樂欣賞會']:
            row=self.fixture(0,title=name)
            self.assertIsNone(nat.event_candidate(row,'7',self.stamp,today=self.today),name)

    def test_links_must_be_explicit_and_https_public(self):
        for link in ['', 'http://lawschool.edu.tw/',
                     'https://localhost/admin',
                     'https://192.168.0.10/private',
                     'https://username:password@www.gov.tw/',
                     'https://www.gov.tw:8443/app',
                     'https://private.local', 'https://evil.example']:
            self.assertEqual(nat.record_url(link),'',link)
            row=self.fixture(0,sourceWebPromote=link,webSales='')
            self.assertIsNone(nat.event_candidate(row,'7',self.stamp,today=self.today),link)
        self.assertTrue(nat.record_url('https://www.accupass.com/event/123'))

    def test_structural_drift_and_source_errors_fail_closed(self):
        def fetch(url,allowlist):
            if url.endswith('14'):
                raise RuntimeError('HTTP 503')
            return url,json.dumps([self.fixture(nat.CATEGORIES.index(url.split('=')[-1]))]).encode()
        res=nat.run_source(fetch_fn=fetch,stamp=self.stamp,today=self.today,logger=lambda _:None)
        self.assertFalse(res['healthy'])
        self.assertEqual(res['accepted'],[],'partial source must not replace last healthy data')
        self.assertEqual(len(res['fetchFailures']),1)
        self.assertEqual(res['categoryOk'],3)
        with self.assertRaisesRegex(ValueError,'JSON 陣列'):
            nat.parse_feed(b'{"wrong":true}')
        with self.assertRaisesRegex(ValueError,'欄位'):
            nat.parse_feed(b'[{"bad":"x"}]')

    def test_id_stability_and_multiple_sessions(self):
        future=self.day.isoformat()
        later=(self.day+timedelta(days=3)).isoformat()
        row=self.fixture(0,showInfo=[
            {'time':later+' 13:00','location':'高雄市'},
            {'time':future+' 14:00','location':'臺北市'},
        ])
        x=nat.event_candidate(row,'7',self.stamp,today=self.today)
        y=nat.event_candidate(row,'7','2026-10-17T00:00:00Z',today=self.today)
        self.assertEqual(x['id'],y['id'])
        self.assertEqual(x['date'],future)
        self.assertEqual(x['location'],'臺北市')

    def test_roc_date_and_online_activity(self):
        self.assertEqual(nat.date_key('115年10月28日'),'2026-10-28')
        self.assertEqual(nat.date_key('115/02/30'),'')
        row=self.fixture(0,title='法律與社會線上公開講座',
                        showInfo=[{'time':'115年11月02日 19:00','location':''}])
        result=nat.event_candidate(row,'7',self.stamp,today=self.today)
        self.assertEqual(result['location'],'線上活動（詳見官方活動連結）')

if __name__=='__main__':unittest.main(verbosity=2)
