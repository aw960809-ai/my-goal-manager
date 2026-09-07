#!/usr/bin/env python3

import argparse
import hashlib
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
CONFIG_FILE = ROOT / "tools" / "autofetch" / "sources.json"
NORMALIZED_DIR = ROOT / "data" / "staging" / "normalized"
VALIDATED_DIR = ROOT / "data" / "staging" / "validated"
REPORT_FILE = ROOT / "data" / "staging" / "validation-report.json"

MIN_TEXT_CHARS = 20
MAX_TEXT_CHARS = 200000
MAX_FUTURE_SKEW = timedelta(minutes=10)
MAX_STAGING_AGE = timedelta(days=14)


def load_sources():
    with CONFIG_FILE.open("r", encoding="utf-8") as f:
        config = json.load(f)

    return {
        source["id"]: source
        for source in config.get("sources", [])
    }


def hostname_allowed(hostname, allowlist):
    hostname = (hostname or "").lower().strip(".")

    for allowed in allowlist:
        allowed = allowed.lower().strip(".")

        if hostname == allowed or hostname.endswith("." + allowed):
            return True

    return False


def parse_datetime(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("missing datetime")

    value = value.strip()

    if value.endswith("Z"):
        value = value[:-1] + "+00:00"

    dt = datetime.fromisoformat(value)

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def valid_sha256(value):
    if not isinstance(value, str) or len(value) != 64:
        return False

    try:
        bytes.fromhex(value)
        return True
    except ValueError:
        return False


def validate_document(document, source):
    errors = []
    warnings = []

    if document.get("schema_version") != "96.6-normalized-1":
        errors.append("invalid_schema_version")

    if document.get("source_id") != source.get("id"):
        errors.append("source_id_mismatch")

    if document.get("trust_level") != source.get("trust_level"):
        errors.append("trust_level_mismatch")

    final_url = document.get("final_url", "")
    parsed = urlparse(final_url)

    if parsed.scheme != "https":
        errors.append("final_url_not_https")

    if not hostname_allowed(
        parsed.hostname,
        source.get("domain_allowlist", []),
    ):
        errors.append("final_url_domain_not_allowed")

    title = document.get("title", "")
    if not isinstance(title, str):
        errors.append("title_not_string")
    elif len(title.strip()) == 0:
        warnings.append("empty_title")
    elif len(title) > 500:
        warnings.append("title_too_long")

    text = document.get("text", "")
    if not isinstance(text, str):
        errors.append("text_not_string")
    else:
        if len(text) < MIN_TEXT_CHARS:
            errors.append("text_too_short")

        if len(text) > MAX_TEXT_CHARS:
            errors.append("text_too_long")

    sha256 = document.get("content_sha256")
    if not valid_sha256(sha256):
        errors.append("invalid_content_sha256")

    try:
        fetched_at = parse_datetime(
            document.get("fetched_at")
        )

        now = datetime.now(timezone.utc)

        if fetched_at > now + MAX_FUTURE_SKEW:
            errors.append("fetched_at_in_future")

        if fetched_at < now - MAX_STAGING_AGE:
            warnings.append("staging_document_old")

    except Exception:
        errors.append("invalid_fetched_at")

    links = document.get("links", [])

    if not isinstance(links, list):
        errors.append("links_not_list")

    return errors, warnings

def discover_documents():
    if not NORMALIZED_DIR.exists():
        return []

    return sorted(NORMALIZED_DIR.glob("*/*.json"))


def save_validated(source_id, filename, document):
    target_dir = VALIDATED_DIR / source_id
    target_dir.mkdir(parents=True, exist_ok=True)

    target = target_dir / filename
    target.write_text(
        json.dumps(
            document,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate normalized documents without writing validated output",
    )

    args = parser.parse_args()

    sources = load_sources()
    documents = discover_documents()

    total = 0
    passed = 0
    failed = 0
    warning_count = 0
    report_items = []

    for path in documents:
        total += 1

        source_id = path.parent.name
        source = sources.get(source_id)

        if source is None:
            failed += 1

            report_items.append({
                "file": str(path.relative_to(ROOT)),
                "source_id": source_id,
                "status": "failed",
                "errors": ["unknown_source"],
                "warnings": [],
            })

            print(
                f"VALIDATE_FAIL "
                f"source={source_id} "
                f"file={path.name} "
                f"errors=unknown_source"
            )
            continue

        try:
            document = json.loads(
                path.read_text(encoding="utf-8")
            )
        except Exception as exc:
            failed += 1

            report_items.append({
                "file": str(path.relative_to(ROOT)),
                "source_id": source_id,
                "status": "failed",
                "errors": [f"invalid_json:{exc}"],
                "warnings": [],
            })

            print(
                f"VALIDATE_FAIL "
                f"source={source_id} "
                f"file={path.name} "
                f"errors=invalid_json"
            )
            continue

        errors, warnings = validate_document(
            document,
            source,
        )

        warning_count += len(warnings)

        if errors:
            failed += 1
            status = "failed"

            print(
                f"VALIDATE_FAIL "
                f"source={source_id} "
                f"file={path.name} "
                f"errors={','.join(errors)}"
            )

        else:
            passed += 1
            status = "passed"

            if not args.dry_run:
                save_validated(
                    source_id,
                    path.name,
                    document,
                )

            print(
                f"VALIDATE_OK "
                f"source={source_id} "
                f"file={path.name} "
                f"warnings={len(warnings)}"
            )

        report_items.append({
            "file": str(path.relative_to(ROOT)),
            "source_id": source_id,
            "status": status,
            "errors": errors,
            "warnings": warnings,
        })

    report = {
        "schema_version": "96.6-validation-report-1",
        "generated_at": datetime.now(
            timezone.utc
        ).isoformat(),
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "warnings": warning_count,
        },
        "items": report_items,
    }

    if not args.dry_run:
        REPORT_FILE.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        REPORT_FILE.write_text(
            json.dumps(
                report,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    if args.dry_run:
        print(
            f"VALIDATE_DRY_RUN_OK "
            f"documents={total} "
            f"passed={passed} "
            f"failed={failed} "
            f"warnings={warning_count}"
        )
    else:
        print(
            f"VALIDATE_SUMMARY "
            f"documents={total} "
            f"passed={passed} "
            f"failed={failed} "
            f"warnings={warning_count}"
        )

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
