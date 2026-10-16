#!/usr/bin/env python3
"""Offline regressions: retry policy, source diagnosis and source-level isolation."""
import importlib.util
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'/'autofetch'))
spec=importlib.util.spec_from_file_location('gm_activity_autofetch',ROOT/'tools'/'autofetch'/'autofetch.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class FetchIsolationTests(unittest.TestCase):
    def test_403_is_not_a_retry_all_errors_policy(self):
        called=[]
        def failure(cmd,**kwargs):
            called.append(cmd)
            return SimpleNamespace(returncode=22,stderr=b'curl: (22) The requested URL returned error: 403',stdout=b'')
        with patch.object(module.subprocess,'run',side_effect=failure):
            with self.assertRaisesRegex(RuntimeError,r'example\.gov\.tw.*403'):
                module.fetch('https://example.gov.tw/official',['example.gov.tw'])
        args=called[0]
        self.assertEqual(args[args.index('--retry')+1],'1')
        self.assertNotIn('--retry-all-errors',args)
        self.assertEqual(args[args.index('--proto-redir')+1],'=https')

    def test_timeout_has_source_identity(self):
        def timeout(cmd,**kwargs):
            return SimpleNamespace(returncode=28,stderr=b'curl: (28) connection timed out',stdout=b'')
        with patch.object(module.subprocess,'run',side_effect=timeout):
            with self.assertRaisesRegex(RuntimeError,r'www\.nthcc\.gov\.tw.*28'):
                module.fetch('https://www.nthcc.gov.tw/A4_1/list2',['www.nthcc.gov.tw'])

    def test_invalid_source_host_stops_before_network(self):
        with patch.object(module.subprocess,'run') as called:
            with self.assertRaisesRegex(RuntimeError,'白名單'):
                module.fetch('https://example.gov.tw.attacker.invalid/',['example.gov.tw'])
            called.assert_not_called()

    def test_yda_listing_failure_does_not_abort_other_sources(self):
        with patch.object(module,'fetch',side_effect=RuntimeError('www.yda.gov.tw: HTTP 403')):
            result=module.run_yda_source(limit=5)
        self.assertFalse(result['healthy'])
        self.assertEqual(result['sourceId'],'yda_official')
        self.assertEqual(result['accepted'],[])
        self.assertEqual(len(result['fetchFailures']),1)
        self.assertIn('403',result['fetchFailures'][0]['reason'])

if __name__=='__main__':unittest.main()
