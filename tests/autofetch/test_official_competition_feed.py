#!/usr/bin/env python3
"""NCUT institutional competition announcements: official HTML fixtures, no network."""
import sys
import unittest
from pathlib import Path
from datetime import date
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'/'autofetch'))
import official_competition_feed as c

TODAY=date(2026,10,17)
GREEN_TITLE='〖競賽〗德明財經科技大學-2026 全國大專綠色商品展暨海外行銷企劃大賽'
GREEN_URL='https://n058.ncut.edu.tw/p/406-1058-96514,r292.php?Lang=zh-tw'
SIMPLE_TITLE='〖競賽〗朝陽科技大學-2026全國金融科技校園創新創意競賽'
SIMPLE_URL='https://n058.ncut.edu.tw/p/406-1058-96597,r292.php?Lang=zh-tw'
HACK_TITLE='〖競賽〗新竹市政府-115年度新竹政策黑客松競賽'
HACK_URL='https://n058.ncut.edu.tw/p/406-1058-96515,r292.php?Lang=zh-tw'

def notice(title, body):
    return (f'<html><head><title>{title}</title></head><body>'
      f'<nav>首頁｜活動資訊</nav><h2>{title}</h2>'
      f'<p>發佈日期 : 2026-10-06</p>{body}'
      '<p>瀏覽數:</p><footer>國立勤益科技大學 National Chin-Yi University</footer></body></html>').encode()

GREEN_HTML=notice(GREEN_TITLE,
    '<p>三、參賽對象與組隊方式：全國大專校院在學學生（含學士班、碩士班），每隊1至8人，得跨校跨系組隊。</p>'
    '<p>四、競賽重要時程：</p>'
    '<p>(一)報名截止日期：即日起至115年10月30日（星期五）中午12:00止。</p>'
    '<p>(二)初賽企劃書繳交截止：115年11月13日（星期五）中午12:00止。</p>'
    '<p>(三)決賽名單公告日期：115年11月27日。</p>'
    '<p>(五)全國總決賽暨現場商務簡報：115年12月9日（星期三）於本校綜合大樓 A506 國際會議廳舉行。</p>'
    '<p>六、報名及相關網址：</p>'
    '<p>(一)線上報名網址：https://reurl.cc/4Y8dO3</p>'
    '<p>(二)初賽參展企劃書上傳網址：https://forms.gle/iVXmdLmAc7GaNYnv5</p>')

SIMPLE_HTML=notice(SIMPLE_TITLE,
    '<p>一、參賽對象：全國大專院校在學學生。</p>'
    '<p>二、競賽初賽報名截止日至115年11月6日（星期五）中午12時止。</p>'
    '<p>三、本競賽一律採線上系統報名，初賽報名網址為：https://forms.gle/sample</p>')

HACK_HTML=notice(HACK_TITLE,
    '<p>報名時間：115年9月16日起至115年10月30日止。</p>'
    '<p>報名資格：年滿16歲至40歲之青年學生、社會人士。</p>'
    '<p>活動時間：115年11月21日至11月22日兩天一夜於新竹市身心障礙者就業綜合大樓實體辦理。</p>')

INDEX=f'''<html><h2>最新比賽資訊</h2>
 <div><a href="/p/406-1058-96514,r292.php?Lang=zh-tw">{GREEN_TITLE}</a></div>
 <div><a href="/p/406-1058-96597,r292.php?Lang=zh-tw">{SIMPLE_TITLE}</a></div>
 <div><a href="/p/406-1058-96515,r292.php?Lang=zh-tw">{HACK_TITLE}</a></div>
 <div><a href="/p/406-1058-96514,r292.php?Lang=zh-tw">{GREEN_TITLE}</a></div>
 </html>'''.encode()

class OfficialContestTests(unittest.TestCase):
    def record(self):
        return {'url':GREEN_URL,'title':GREEN_TITLE,'identifier':'96514'}

    def test_date_roc_gregorian_invalid(self):
        self.assertEqual(c.iso_date('115年10月30日'),'2026-10-30')
        self.assertEqual(c.iso_date('2026/11/13'),'2026-11-13')
        self.assertEqual(c.iso_date('115年2月30日'),'')

    def test_exact_https_official_domain(self):
        self.assertTrue(c.valid_url(GREEN_URL))
        self.assertFalse(c.valid_url(GREEN_URL.replace('https:','http:')))
        self.assertFalse(c.valid_url(GREEN_URL.replace('n058.ncut.edu.tw','n058.ncut.edu.tw.evil.test')))
        self.assertFalse(c.valid_url('https://n058.ncut.edu.tw:8443/p/406-1058-96514,r292.php'))
        self.assertFalse(c.valid_url('https://n058.ncut.edu.tw@attacker.test/p/406-1058-96514,r292.php'))
        self.assertFalse(c.valid_url('https://n058.ncut.edu.tw/p/406-1058-96514,r292.php#foo'))
        self.assertFalse(c.valid_url('https://n058.ncut.edu.tw/p/406-1058-96514,r123.php'))

    def test_official_listing_scoped_dedup(self):
        entries=c.listing(INDEX)
        self.assertEqual(len(entries),3)
        self.assertEqual(entries[0]['url'],GREEN_URL)
        self.assertEqual(entries[0]['identifier'],'96514')

    def test_official_detail_must_match_listing_heading(self):
        self.assertGreater(len(c.article(GREEN_HTML,GREEN_TITLE)),3)
        self.assertEqual(c.article(SIMPLE_HTML,GREEN_TITLE),[])

    def test_notice_date_is_not_deadline(self):
        self.assertEqual(c.deadline_from_lines(['發佈日期：2026-10-06','決賽日期：115年12月09日']), '')
        self.assertEqual(c.deadline_from_lines(['報名時間：自115年10月09日起正式受理報名']), '')

    def test_initial_deadline_not_later_upload_date(self):
        lines=c.article(GREEN_HTML,GREEN_TITLE)
        self.assertEqual(c.deadline_from_lines(lines),'2026-10-30')

    def test_known_development_contest_admitted(self):
        a=c.candidate(self.record(),GREEN_HTML,'2026-10-17T03:00:00Z',today=TODAY)
        self.assertIsNotNone(a)
        self.assertEqual(a['deadline'],'2026-10-30')
        self.assertEqual(a['dateKind'],'application_deadline')
        self.assertTrue(a['finalAttendanceRequired'])
        self.assertIn('原公告稱「本校」綜合大樓',a['finalLocation'])
        self.assertIn('請核對主辦校地址',a['finalLocation'])
        self.assertTrue(a['id'].startswith(c.PREFIX))
        self.assertEqual(a['url'],GREEN_URL)
        self.assertIn('校方公告已核實',a['statusText'])

    def test_school_name_alone_is_not_personal_eligibility(self):
        # ‘德明財經科技大學’ in the title is NOT evidence that any
        # particular student may enter; official announcement must say who.
        altered=GREEN_HTML.decode().replace(
            '全國大專校院在學學生（含學士班、碩士班）',
            '參賽者應依各組簡章辦理')
        why=[]
        self.assertIsNone(c.candidate(self.record(),altered.encode(),'stamp',today=TODAY,reasons=why))
        self.assertEqual(why,['eligibility_not_verified'])

    def test_h4_official_detail_heading_supported(self):
        html=GREEN_HTML.replace('<h2>'.encode(),'<h4>'.encode()).replace('</h2>'.encode(),'</h4>'.encode())
        self.assertTrue(c.article(html,GREEN_TITLE))

    def test_online_signup_without_remote_work_excluded(self):
        simple={'url':SIMPLE_URL,'title':SIMPLE_TITLE,'identifier':'96597'}
        reasons=[]
        self.assertIsNone(c.candidate(simple,SIMPLE_HTML,'stamp',today=TODAY,reasons=reasons))
        self.assertEqual(reasons,['remote_submission_not_verified'])

    def test_onsite_event_not_accepted_as_online_competition(self):
        hack={'url':HACK_URL,'title':HACK_TITLE,'identifier':'96515'}
        reasons=[]
        self.assertIsNone(c.candidate(hack,HACK_HTML,'stamp',today=TODAY,reasons=reasons))
        self.assertIn(reasons[0],{'remote_submission_not_verified','mandatory_first_stage_inperson'})

    def test_expired_registration_is_not_revived_by_future_final(self):
        old=GREEN_HTML.replace(b'115',b'115')
        title=GREEN_TITLE
        old=old.decode().replace('115年10月30日','115年10月16日').encode()
        reasons=[]
        self.assertIsNone(c.candidate(self.record(),old,'stamp',today=TODAY,reasons=reasons))
        self.assertEqual(reasons,['deadline_expired'])

    def test_registration_already_closed_loses_even_with_online_proposal(self):
        old=c.candidate(self.record(),GREEN_HTML,'stamp',today=date(2026,11,1))
        self.assertIsNone(old)

    def test_restrict_only_staff_never_recommend(self):
        altered=GREEN_HTML.decode().replace('全國大專校院在學學生','僅限本校教師')
        why=[]
        self.assertIsNone(c.candidate(self.record(),altered.encode(),'stamp',today=TODAY,reasons=why))
        self.assertEqual(why,['eligibility_restricted'])

    def test_disallowed_changhua_nantou_final(self):
        altered=GREEN_HTML.decode().replace('本校綜合大樓 A506 國際會議廳','彰化師大工學院')
        reasons=[]
        self.assertIsNone(c.candidate(self.record(),altered.encode(),'stamp',today=TODAY,reasons=reasons))
        self.assertEqual(reasons,['user_disallowed_final_region'])

    def test_source_stable_id_and_reason_counts(self):
        links={GREEN_URL:GREEN_HTML,SIMPLE_URL:SIMPLE_HTML,HACK_URL:HACK_HTML,c.LIST_URL:INDEX}
        def fetch(url,allowlist):
            self.assertEqual(allowlist,[c.HOST]);return url,links[url]
        result=c.run_source(fetch_fn=fetch,stamp='stamp',today=TODAY,logger=lambda _:None)
        self.assertTrue(result['healthy'],result)
        self.assertEqual(result['discovered'],3)
        self.assertEqual(result['parsedOk'],3)
        self.assertEqual(len(result['accepted']),1)
        self.assertEqual(result['accepted'][0]['id'],c.PREFIX+'96514')
        self.assertEqual(result['reviewReasons']['remote_submission_not_verified'],2)

    def test_partial_failure_preserves_existing(self):
        def fetch(url,allowlist):
            if url==SIMPLE_URL:raise TimeoutError('upstream 503')
            return url,{GREEN_URL:GREEN_HTML,HACK_URL:HACK_HTML,c.LIST_URL:INDEX}[url]
        r=c.run_source(fetch_fn=fetch,stamp='stamp',today=TODAY,logger=lambda _:None)
        self.assertFalse(r['healthy']);self.assertFalse(r['accepted'])
        self.assertEqual(len(r['fetchFailures']),1)

    def test_unverified_listing_fail_closed(self):
        r=c.run_source(fetch_fn=lambda u,a:(u,b'<html><a href="/signin">login</a></html>'),stamp='s',today=TODAY,logger=lambda _:None)
        self.assertFalse(r['healthy']);self.assertFalse(r['accepted'])

    def test_budget_fail_closed(self):
        extra=INDEX.decode().replace('</html>','')
        # 20 distinct relevant official bulletin links: a bounded 1-record run cannot overwrite.
        extra+=''.join(f'<a href="/p/406-1058-{96000+i},r292.php">{GREEN_TITLE}</a>' for i in range(21))+'</html>'
        result=c.run_source(fetch_fn=lambda u,a:(u,extra.encode() if u==c.LIST_URL else GREEN_HTML),stamp='s',today=TODAY,limit=1,logger=lambda _:None)
        self.assertFalse(result['healthy']);self.assertEqual(result['accepted'],[])

if __name__=='__main__': unittest.main(verbosity=2)
