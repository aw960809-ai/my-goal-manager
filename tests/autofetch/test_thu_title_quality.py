#!/usr/bin/env python3
"""THU heading quality: synthetic page, no network or personal data."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'/'autofetch'))
import autofetch as af

TITLE='國科會2026年哲學學門專題研究計畫成果發表會'
NOTES='*注意事項： 1. 報名人員不另提供午膳。 2. 如有發燒請勿出席。'

class TitleTests(unittest.TestCase):
    def test_notes_heading_does_not_override_real_heading(self):
        page=f'<h1>{TITLE}</h1><h1>{NOTES}</h1>'
        title,lines=af.parse_thu_detail(page.encode())
        self.assertEqual(title,TITLE)
        self.assertIn(NOTES,lines)

    def test_generic_site_header_and_note_are_not_event_name(self):
        page=f'<h1>東海大學活動報名系統</h1><h1>{TITLE}</h1><h1>{NOTES}</h1>'
        title,_=af.parse_thu_detail(page.encode())
        self.assertEqual(title,TITLE)

    def test_notes_only_fails_closed(self):
        url='https://tevent.thu.edu.tw/tEvent_front/tEvent.php?conference_code=2026080007'
        item,why=af.build_thu_candidate(url,f'<h1>{NOTES}</h1><p>報名資訊</p>'.encode())
        self.assertIsNone(item)
        self.assertEqual(why,'invalid_heading')

    def test_academic_philosophy_not_incorrectly_labeled_law(self):
        page=(f'<p>學術活動</p><h1>{TITLE}</h1>'
              '<p>報名起迄</p><p>2026-10-15 10:00 ~ 2026-11-13 16:00</p>'
              '<p>開放對象</p><p>學生，費用：0</p>'
              '<p>承辦單位</p><p>哲學系</p>'
              '<p>活動簡介</p><p>哲學學術會議兼談刑法與法律哲學</p>'
              f'<h1>{NOTES}</h1>'
              '<p>報名場次</p><p>人文大樓展學廳 H321</p>'
              '<p>2026-11-20 ~ 2026-11-20</p>')
        url='https://tevent.thu.edu.tw/tEvent_front/tEvent.php?conference_code=2026080007'
        event,why=af.build_thu_candidate(url,page.encode())
        self.assertIsNone(why,why)
        self.assertEqual(event['title'],TITLE)
        self.assertEqual(event['type'],'學術／講座')

if __name__=='__main__':unittest.main(verbosity=2)
