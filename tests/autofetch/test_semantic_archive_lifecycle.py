#!/usr/bin/env python3
"""Archive, rather than resurrect, known off-target official events.

The actual user-production case: two English picture-book dates are not
relevant language exams; official-source failure must preserve old records.
"""
import sys
import unittest
from datetime import date
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'/'autofetch'))
from lifecycle_archive import reconcile_activity_catalog

class RetirementTests(unittest.TestCase):
    def setUp(self):
        self.legacy={
            'id':'auto-moc-national-6a2b070b26b3243414ccd1fd',
            'title':'2026年11月【員林市立圖書館-英文繪本快樂遊】',
            'date':'2026-11-08','available':True,'scope':'全國',
            'autofetch':{'sourceId':'moc_national'},
        }
        self.manual={'id':'my-manual-activity','title':'嘉中演辯社教學','date':'2026-12-23'}
        self.healthy={'sourceId':'moc_national','prefix':'auto-moc-national-','healthy':True}

    def test_verified_false_positive_is_archived_not_carried(self):
        row=dict(self.legacy,semanticRetire=True)
        active,archive,stats=reconcile_activity_catalog(
            old_rows=[self.legacy,self.manual], candidate_rows=[row,self.manual],
            source_results=[self.healthy],archive_rows=[],
            now='2026-10-16T04:00:00+00:00',today='2026-10-16')
        self.assertEqual([x['id'] for x in active],[self.manual['id']])
        self.assertEqual(len(archive),1)
        self.assertEqual(archive[0]['retireCode'],'source_quality_mismatch')
        self.assertEqual(stats['retiredThisRun'],1)

    def test_failed_national_source_preserves_old_rows(self):
        active,archive,stats=reconcile_activity_catalog(
            old_rows=[self.legacy,self.manual],candidate_rows=[self.legacy,self.manual],
            source_results=[dict(self.healthy,healthy=False)],archive_rows=[],
            now='2026-10-16T04:00:00+00:00',today='2026-10-16')
        self.assertEqual({x['id'] for x in active},{self.legacy['id'],self.manual['id']})
        self.assertEqual(archive,[])
        self.assertEqual(stats['retainedOnFailure'],1)

if __name__=='__main__':unittest.main(verbosity=2)
