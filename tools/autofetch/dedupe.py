#!/usr/bin/env python3

import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[2]
VALIDATED_DIR = ROOT / "data" / "staging" / "validated"
DEDUPED_DIR = ROOT / "data" / "staging" / "deduped"
REPORT_FILE = ROOT / "data" / "staging" / "dedupe-report.json"

MAX_COMPARE_TEXT = 5000


def normalize_text(value):
    if not isinstance(value, str):
        return ""

    value = unicodedata.normalize("NFKC", value)
    value = value.lower()
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"[^\w\u4e00-\u9fff]+", "", value)

    return value.strip()


def normalize_url(url):
    if not isinstance(url, str) or not url:
        return ""

    try:
        parts = urlsplit(url)

        scheme = parts.scheme.lower()
        netloc = parts.netloc.lower()

        path = parts.path.rstrip("/")
        if not path:
            path = "/"

        return urlunsplit((
            scheme,
            netloc,
            path,
            parts.query,
            "",
        ))

    except Exception:
        return url


def make_fingerprint(document):
    title = normalize_text(
        document.get("title", "")
    )

    text = normalize_text(
        document.get("text", "")
    )[:MAX_COMPARE_TEXT]

    url = normalize_url(
        document.get("final_url", "")
    )

    material = "\n".join([
        title,
        text,
        url,
    ])

    return hashlib.sha256(
        material.encode("utf-8")
    ).hexdigest()


def make_content_fingerprint(document):
    title = normalize_text(
        document.get("title", "")
    )

    text = normalize_text(
        document.get("text", "")
    )[:MAX_COMPARE_TEXT]

    material = "\n".join([
        title,
        text,
    ])

    return hashlib.sha256(
        material.encode("utf-8")
    ).hexdigest()


def discover_documents():
    if not VALIDATED_DIR.exists():
        return []

    return sorted(
        VALIDATED_DIR.glob("*/*.json")
    )


def load_document(path):
    return json.loads(
        path.read_text(encoding="utf-8")
    )

def save_document(source_id, filename, document):
    target_dir = DEDUPED_DIR / source_id
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
        help="Inspect duplicates without writing deduped output",
    )

    args = parser.parse_args()

    paths = discover_documents()

    exact_seen = {}
    content_seen = {}

    total = 0
    kept = 0
    duplicates = 0
    failed = 0

    report_items = []

    for path in paths:
        total += 1

        try:
            document = load_document(path)
        except Exception as exc:
            failed += 1

            report_items.append({
                "file": str(path.relative_to(ROOT)),
                "status": "failed",
                "reason": f"invalid_json:{exc}",
            })

            print(
                f"DEDUPE_FAIL "
                f"file={path.name} "
                f"reason=invalid_json"
            )
            continue

        exact_fp = make_fingerprint(document)
        content_fp = make_content_fingerprint(document)

        duplicate_of = None
        duplicate_reason = None

        if exact_fp in exact_seen:
            duplicate_of = exact_seen[exact_fp]
            duplicate_reason = "exact_fingerprint"

        elif content_fp in content_seen:
            duplicate_of = content_seen[content_fp]
            duplicate_reason = "same_content"

        if duplicate_of:
            duplicates += 1

            report_items.append({
                "file": str(path.relative_to(ROOT)),
                "status": "duplicate",
                "reason": duplicate_reason,
                "duplicate_of": duplicate_of,
                "exact_fingerprint": exact_fp,
                "content_fingerprint": content_fp,
            })

            print(
                f"DEDUPE_DUPLICATE "
                f"file={path.name} "
                f"reason={duplicate_reason} "
                f"duplicate_of={duplicate_of}"
            )

            continue

        relative_path = str(path.relative_to(ROOT))

        exact_seen[exact_fp] = relative_path
        content_seen[content_fp] = relative_path

        document["dedupe"] = {
            "exact_fingerprint": exact_fp,
            "content_fingerprint": content_fp,
            "status": "unique",
        }

        kept += 1

        if not args.dry_run:
            save_document(
                path.parent.name,
                path.name,
                document,
            )

        report_items.append({
            "file": relative_path,
            "status": "kept",
            "reason": "unique",
            "exact_fingerprint": exact_fp,
            "content_fingerprint": content_fp,
        })

        print(
            f"DEDUPE_KEEP "
            f"source={path.parent.name} "
            f"file={path.name}"
        )

    report = {
        "schema_version": "96.6-dedupe-report-1",
        "total": total,
        "kept": kept,
        "duplicates": duplicates,
        "failed": failed,
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
            f"DEDUPE_DRY_RUN_OK "
            f"documents={total} "
            f"kept={kept} "
            f"duplicates={duplicates} "
            f"failed={failed}"
        )
    else:
        print(
            f"DEDUPE_SUMMARY "
            f"documents={total} "
            f"kept={kept} "
            f"duplicates={duplicates} "
            f"failed={failed}"
        )

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
