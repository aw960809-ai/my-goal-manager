#!/usr/bin/env python3
"""No network and no personal data: synthetic activity preferences."""
from datetime import date
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'/'autofetch'))
from lifecycle_archive import activity_preference_state,reconcile_activity_catalog

class PreferenceTests(unittest.TestCase):
    def setUp(self):
        self.when='2026-10-16T07:00:00+00:00'
        self.today='2026-10-16'
    def event(self,uid,venue,source='moc_national'):
        return {'id':uid,'title':'法律與政策工作坊','date':'2026-11-20',
                'location':venue,'available':True,'kind':'event',
                'sourceId':source,'autofetch':{'sourceId':source}}
    def reconcile(self,old, candidates,archive=None,source_results=None):
        return reconcile_activity_catalog(old_rows=old,candidate_rows=candidates,
                 source_results=source_results or [],archive_rows=archive or [],
                 now=self.when,today=self.today)
    def test_disabled_sources_auto_only(self):
        for sid,uid in [
            ('ntu_law','auto-law-ntu-test'),('nccu_law','auto-law-nccu-test'),
            ('changhua_government','auto-central-ch-test'),
            ('nantou_culture','auto-central-nt-test')]:
            with self.subTest(source=sid):
                item=self.event(uid,'臺北市',sid)
                self.assertEqual(activity_preference_state(item)[0],'user_preference_source')
                active,arch,stats=self.reconcile([item],[item])
                self.assertFalse(active)
                self.assertEqual(arch[0]['id'],uid)
                self.assertEqual(stats['preferenceExcludedThisRun'],1)
    def test_county_locations_even_from_nationwide_feeds(self):
        for place in ('彰化縣員林市三民街','南投縣埔里鎮', '南投市中山路'):
            with self.subTest(place=place):
                e=self.event('auto-moc-national-abc',place)
                self.assertEqual(activity_preference_state(e)[0],'user_preference_location')
                active,arch,_=self.reconcile([e],[e])
                self.assertFalse(active);self.assertEqual(arch[0]['id'],e['id'])
    def test_online_and_manual_entries_preserved(self):
        online=self.event('auto-moc-national-online','線上／彰化縣')
        taichung=self.event('auto-moc-national-taichung','臺中市')
        manual=self.event('my-calendar-personal','南投縣',source='manual')
        old=[online,taichung,manual]
        out,arch,stats=self.reconcile(old,old,source_results=[{
            'prefix':'auto-moc-national-','sourceId':'moc_national','healthy':True}])
        self.assertEqual({x['id'] for x in out},{x['id'] for x in old})
        self.assertFalse(arch)
        self.assertEqual(stats['preferenceExcludedThisRun'],0)
    def test_no_duplicate_archive_on_next_run(self):
        item=self.event('auto-law-nccu-test','臺北市','nccu_law')
        out,arch,s=self.reconcile([item],[item])
        self.assertFalse(out);self.assertEqual(s['preferenceExcludedThisRun'],1)
        out2,arch2,s2=self.reconcile([item],[item],archive=arch)
        self.assertFalse(out2);self.assertEqual(len(arch2),1)
        self.assertEqual(s2['preferenceExcludedThisRun'],0)
    def test_disabled_sources_archive_when_missing_from_run_results(self):
        item=self.event('auto-law-ntu-123','臺北市','ntu_law')
        out,arch,stats=self.reconcile([item],[],source_results=[{
           'prefix':'auto-moc-national-','sourceId':'moc_national','healthy':True}])
        self.assertFalse(out);self.assertEqual(arch[0]['id'],item['id'])
        self.assertEqual(stats['preferenceExcludedThisRun'],1)

if __name__=='__main__':unittest.main(verbosity=2)
