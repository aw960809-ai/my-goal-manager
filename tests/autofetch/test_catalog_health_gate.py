import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools" / "autofetch"))
from catalog_health_gate import healthy, should_skip

TODAY = date(2026, 10, 25)
STAMP = "2026-10-25T06:18:10+00:00"


def activity(**extra):
    return {"meta": {"updatedAt": STAMP, "totalSources": 9,
            "healthySources": 9, "failedSources": 0, "fetchFailedItems": 0, **extra}}


def scholarship(**extra):
    return {"meta": {"updatedAt": STAMP, "categories": 5,
            "healthyCategories": 5, "failedCategories": 0,
            "eligibilityDetail": {"detailUnverified": 0, "detailBudgetExpired": 0}, **extra}}


class CatalogHealthGateTest(unittest.TestCase):
    def test_skip_only_full_health_same_day(self):
        self.assertTrue(should_skip(activity(), scholarship(), event_name="schedule", today=TODAY))
    def test_manual_never_skipped(self):
        self.assertFalse(should_skip(activity(), scholarship(), event_name="workflow_dispatch", today=TODAY))
    def test_thu_failure_requires_retry(self):
        self.assertFalse(should_skip(activity(healthySources=8, failedSources=1), scholarship(), event_name="schedule", today=TODAY))
    def test_scholarship_partial_failure_requires_retry(self):
        self.assertFalse(should_skip(activity(), scholarship(healthyCategories=1, failedCategories=4), event_name="schedule", today=TODAY))
    def test_individual_fetch_failure_requires_retry(self):
        self.assertFalse(healthy(activity(fetchFailedItems=2), "activity", TODAY))
    def test_detail_budget_failure_requires_retry(self):
        self.assertFalse(healthy(scholarship(eligibilityDetail={"detailUnverified": 0,"detailBudgetExpired": 1}), "scholarship", TODAY))
    def test_missing_health_fails_closed(self):
        self.assertFalse(healthy({"meta": {"updatedAt": STAMP}}, "activity", TODAY))
    def test_stale_not_fresh(self):
        self.assertFalse(healthy(activity(updatedAt="2026-10-24T02:00:00+00:00"), "activity", TODAY))
    def test_invalid_timestamp_not_fresh(self):
        self.assertFalse(healthy(activity(updatedAt="bad"), "activity", TODAY))
    def test_timezone_rollover(self):
        self.assertTrue(healthy(activity(updatedAt="2026-10-24T17:30:00+00:00"), "activity", TODAY))


if __name__ == "__main__":
    unittest.main()
