#!/usr/bin/env python3
"""National activity relevance regression (the actual 2026-10-16 incident)."""
import sys
import unittest
from pathlib import Path
from datetime import date

sys.path.insert(0, str(Path(__file__).resolve().parents[2]/'tools'/'autofetch') if (Path(__file__).resolve().parents[2]/'tools'/'autofetch').exists() else str(Path(__file__).parent))
import moc_national_opportunities as nat


class SemanticQualityTests(unittest.TestCase):
    def make_row(self,title):
        return {
          'UID':'2026-test-888881', 'category':'7', 'title':title,
          'descriptionFilterHtml':'一般民眾可參加，請依主辦單位公告。',
          'showInfo':[{'time':'2026-11-08 10:00:00', 'location':'彰化縣員林市三民街2號'}],
          'sourceWebPromote':'https://www.yuanlin.gov.tw/event/1',
          'masterUnit':'員林市立圖書館'
        }

    def test_real_false_positive_must_not_be_recommended(self):
        bad=[
          '2026年11月【員林市立圖書館-英文繪本快樂遊】',
          '2026年12月【員林市立圖書館-英文繪本快樂遊】',
          '親子英語故事屋', '幼兒日語遊戲日', '英文故事時間',
        ]
        for title in bad:
            with self.subTest(title=title):
                self.assertFalse(nat.topic_relevant(title),title)
                self.assertIsNone(nat.event_candidate(
                    self.make_row(title),'7','stamp',today=date(2026,10,16)))

    def test_real_training_lectures_remain_eligible(self):
        good=['大學生英語口譯與跨文化溝通工作坊',
              'TOEIC 多益聽力閱讀檢定講座',
              '成人英文寫作研習',
              '全國青年演辯及公共政策競賽',
              '兒少人權與刑法責任學術研討會']
        for title in good:
            with self.subTest(title=title):
                self.assertTrue(nat.topic_relevant(title),title)
                self.assertIsNotNone(nat.event_candidate(
                    self.make_row(title),'7','stamp',today=date(2026,10,16)))

    def test_english_only_is_not_a_professional_opportunity(self):
        for title in ['英文同樂會','日文親子歡樂日','英語歌謠欣賞','英文學習小遊戲']:
            self.assertFalse(nat.topic_relevant(title))


if __name__=='__main__': unittest.main(verbosity=2)
