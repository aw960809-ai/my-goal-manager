import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"tools"/"autofetch"))
import scholarship_autofetch as a

class QualificationEvidenceV4(unittest.TestCase):
    def test_required_low_income(self):
        self.assertEqual(a.review_scholarship_evidence({"restrictions":"申請資格：須具備低收入戶身分。"},"生活助學金")[0],"excluded")
    def test_excluded_by_title(self):
        self.assertEqual(a.review_scholarship_evidence({},"原住民專屬獎學金")[0],"excluded")
    def test_mixed_general_and_restricted_tracks_hold_for_review(self):
        self.assertEqual(a.review_scholarship_evidence({"restrictions":"申請資格：本校一般學生及低收入戶學生分兩組審查。"})[0],"unverified")
    def test_missing_target_explicit_general_audience(self):
        self.assertEqual(a.review_scholarship_evidence({"restrictions":"申請資格：本校大學部在學學生不限科系均可申請。"})[0],"eligible_evidence")
    def test_target_general_but_optional_low_income_topup(self):
        self.assertEqual(a.review_scholarship_evidence({"eligibilityTarget":"一般學生","restrictions":"另可申請低收入戶加發補助。"})[0],"eligible_evidence")
    def test_negative_constraint_is_not_required_low_income(self):
        self.assertEqual(a.review_scholarship_evidence({"eligibilityTarget":"一般學生","restrictions":"不得具低收入戶身分。"})[0],"eligible_evidence")
    def test_non_undergraduate_audience_not_eligible(self):
        self.assertEqual(a.review_scholarship_evidence({"eligibilityTarget":"高中職學生"})[0],"unverified")
    def test_nonempty_generic_major_is_not_an_audience(self):
        self.assertEqual(a.review_scholarship_evidence({"eligibilityTarget":"不限科系"})[0],"unverified")
    def test_application_note_mandatory_restricted_identity(self):
        self.assertEqual(a.review_scholarship_evidence({"eligibilityTarget":"一般學生", "applicationNote":"申請資格：須具備低收入戶身分"})[0],"excluded")
    def test_only_grades_no_audience(self):
        self.assertEqual(a.review_scholarship_evidence({"scoreCondition":"學業平均75分以上"})[0],"unverified")
    def test_attachment_qualification(self):
        self.assertEqual(a.review_scholarship_evidence({"eligibilityTarget":"一般學生","applicationNote":"完整資格條件詳見附件簡章"})[0],"unverified")
    def test_empty_detail(self):
        self.assertEqual(a.review_scholarship_evidence({})[0],"unverified")
    def test_manual_rows_untouched_by_duplicate_scan(self):
        row={"id":"manual","title":"自訂獎學金","duplicateOf":"personal-note"}
        a.mark_cross_category_duplicates([row])
        self.assertEqual(row["duplicateOf"],"personal-note")
    def test_duplicate_annotations_preserve_rows(self):
        rows=[
          {"id":"auto-thu-sch-external-601","sourceId":a.SOURCE_ID,"sourceSubId":"external","auto":True,"number":"601","title":"生活助學金","date":"2026-11-03","eligibilityReviewStatus":"excluded","eligibilityVerified":True},
          {"id":"auto-thu-sch-government-601","sourceId":a.SOURCE_ID,"sourceSubId":"government","auto":True,"number":"601","title":"生活助學金","date":"2026-11-03","eligibilityReviewStatus":"excluded","eligibilityVerified":True},
          {"id":"auto-thu-sch-campus-601","sourceId":a.SOURCE_ID,"sourceSubId":"campus","auto":True,"number":"601","title":"生活助學金","date":"2026-11-15"},
        ]
        count,conflicts=a.mark_cross_category_duplicates(rows)
        self.assertEqual((count,conflicts),(1,0));self.assertEqual(len(rows),3)
        self.assertEqual(rows[1]["duplicateOf"],rows[0]["id"])
        self.assertNotIn("duplicateOf",rows[2])
    def test_conflicting_duplicate_status_blocks(self):
        rows=[
          {"id":"auto-thu-sch-external-601","sourceId":a.SOURCE_ID,"sourceSubId":"external","auto":True,"number":"601","title":"生活助學金","date":"2026-11-03","eligibilityReviewStatus":"eligible_evidence","eligibilityVerified":True},
          {"id":"auto-thu-sch-government-601","sourceId":a.SOURCE_ID,"sourceSubId":"government","auto":True,"number":"601","title":"生活助學金","date":"2026-11-03","eligibilityReviewStatus":"excluded","eligibilityVerified":True},
        ]
        count,conflicts=a.mark_cross_category_duplicates(rows)
        self.assertEqual((count,conflicts),(1,1))
        self.assertFalse(rows[0]["eligibilityVerified"])
        self.assertEqual(rows[0]["eligibilityReviewStatus"],"unverified")

if __name__=='__main__':unittest.main()
