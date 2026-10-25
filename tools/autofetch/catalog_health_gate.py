#!/usr/bin/env python3
"""Do not skip a scheduled catalog refresh unless all sources are healthy."""
from __future__ import annotations
import json
import os
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

TAIPEI = ZoneInfo("Asia/Taipei")


def catalog_day(meta):
    try:
        raw = str(meta.get("updatedAt") or "").strip()
        stamp = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=TAIPEI)
        return stamp.astimezone(TAIPEI).date()
    except (ValueError, TypeError, AttributeError, OverflowError):
        return None


def healthy(document, kind, today):
    if not isinstance(document, dict):
        return False
    meta = document.get("meta")
    if not isinstance(meta, dict) or catalog_day(meta) != today:
        return False
    try:
        if kind == "activity":
            total = int(meta["totalSources"])
            good = int(meta["healthySources"])
            failed = int(meta["failedSources"])
            item_failures = int(meta.get("fetchFailedItems", 0))
            return total > 0 and good == total and failed == 0 and item_failures == 0
        if kind == "scholarship":
            total = int(meta["categories"])
            good = int(meta["healthyCategories"])
            failed = int(meta["failedCategories"])
            details = meta.get("eligibilityDetail") or {}
            if not isinstance(details, dict):
                return False
            pending = int(details.get("detailUnverified", 0))
            expired = int(details.get("detailBudgetExpired", 0))
            return total > 0 and good == total and failed == 0 and pending == 0 and expired == 0
    except (KeyError, TypeError, ValueError, OverflowError):
        return False
    return False


def should_skip(activity, scholarship, *, event_name, today):
    return (event_name == "schedule"
            and healthy(activity, "activity", today)
            and healthy(scholarship, "scholarship", today))


def load(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def main():
    today = datetime.now(TAIPEI).date()
    event_name = os.getenv("EVENT_NAME", "")
    activity = load("data/activities.json")
    scholarship = load("data/scholarships.json")
    skip = should_skip(activity, scholarship, event_name=event_name, today=today)
    value = "true" if skip else "false"
    output = os.getenv("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as stream:
            stream.write(f"skip={value}\n")
    print(f"CATALOG_FRESHNESS today={today} event={event_name} "
          f"activity_healthy={healthy(activity, 'activity', today)} "
          f"scholarship_healthy={healthy(scholarship, 'scholarship', today)} skip={value}")


if __name__ == "__main__":
    main()
