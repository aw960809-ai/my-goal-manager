import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]/'tools'/'autofetch'))
from scholarship_autofetch import review_scholarship_evidence as review

class V5Examples(unittest.TestCase):
    def assertStatus(self, info, expected, title=''):
        status, reason = review(info, title)
        self.assertEqual(status, expected, (reason,info,title))

    def test_855_explicit_low_income_audience(self):
        self.assertStatus({'eligibilityTarget':'低收入戶學生、中低收入戶、因美國關稅影響而遭變故學生'},'excluded')

    def test_689_low_income_proof_in_numbered_restriction(self):
        self.assertStatus({'restrictions':'①在職生不可申請 ②延修生不可申請 1. 領有低收入戶證明或家庭總收入平均每人每月低於當年度最低生活費。'},'excluded')

    def test_hearing_impaired_target(self):
        self.assertStatus({'eligibilityTarget':'聽障生'},'excluded')

    def test_853_specific_electrical_major(self):
        self.assertStatus({'restrictions':'1. 就讀於電機系之三年級以上碩士班及博士班在學學生'},'excluded')

    def test_838_theater_major(self):
        self.assertStatus({'restrictions':'就讀劇場藝術相關學系者。'},'excluded')

    def test_650_restricted_place_of_origin(self):
        self.assertStatus({'restrictions':'限制籍貫河省、熱河省籍者得申請'},'excluded')

    def test_single_optional_low_income_topup(self):
        self.assertStatus({'eligibilityTarget':'一般學生','restrictions':'另可申請低收入戶加發補助。'},'eligible_evidence')

    def test_negative_low_income_constraint(self):
        self.assertStatus({'eligibilityTarget':'一般學生','restrictions':'不得具低收入戶身分。'},'eligible_evidence')

    def test_separate_mandatory_rule_overrides_general(self):
        self.assertStatus({'eligibilityTarget':'一般學生','applicationNote':'申請資格：須具備低收入戶身分'},'excluded')

    def test_general_and_restricted_alternative_track(self):
        self.assertStatus({'restrictions':'申請資格：本校一般學生及低收入戶學生分兩組審查。'},'unverified')

    def test_general_undergraduate_evidence(self):
        self.assertStatus({'restrictions':'申請資格：本校大學部在學學生不限科系均可申請。'},'eligible_evidence')

    def test_grade_alone_insufficient(self):
        self.assertStatus({'scoreCondition':'學業成績平均 80 分以上'},'unverified')

    def test_external_attachment_required(self):
        self.assertStatus({'eligibilityTarget':'一般學生','applicationNote':'完整資格條件詳見附件簡章'},'unverified')

    def test_unspecified_document_is_not_exclusion(self):
        self.assertStatus({'requiredDocuments':'低收入戶證明等文件'},'unverified')

    def test_plain_highschool_target_not_proven(self):
        self.assertStatus({'eligibilityTarget':'高中職學生'},'unverified')

    def test_unspecified_major_not_proven(self):
        self.assertStatus({'eligibilityTarget':'不限科系'},'unverified')

if __name__=='__main__': unittest.main()
