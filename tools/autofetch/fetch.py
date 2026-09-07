#!/usr/bin/env python3

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
CONFIG_FILE = ROOT / "tools" / "autofetch" / "sources.json"
STAGING_DIR = ROOT / "data" / "staging" / "raw"

TIMEOUT_SECONDS = 15
MAX_BYTES = 2_000_000

USER_AGENT = (
    "GoalManager-AutoFetch/96.6 "
    "(https://github.com/aw960809-ai/my-goal-manager)"
)


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def load_config():
    with CONFIG_FILE.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if data.get("mode") != "whitelist":
        raise ValueError("sources.json must use whitelist mode")

    sources = data.get("sources")
    if not isinstance(sources, list):
        raise ValueError("sources must be a list")

    return data


def hostname_allowed(hostname, allowlist):
    hostname = (hostname or "").lower().strip(".")

    for allowed in allowlist:
        allowed = allowed.lower().strip(".")
        if hostname == allowed or hostname.endswith("." + allowed):
            return True

    return False


def validate_url(url, allowlist):
    parsed = urlparse(url)

    if parsed.scheme != "https":
        raise ValueError(f"Only HTTPS is allowed: {url}")

    if not hostname_allowed(parsed.hostname, allowlist):
        raise ValueError(f"Domain not allowed: {url}")

    return True


def fetch_url(url, allowlist):
    validate_url(url, allowlist)

    req = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
        },
    )

    with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
        final_url = response.geturl()
        validate_url(final_url, allowlist)

        status = getattr(response, "status", 200)
        if status != 200:
            raise RuntimeError(f"HTTP status {status}")

        content_type = response.headers.get("Content-Type", "")

        raw = response.read(MAX_BYTES + 1)

        if len(raw) > MAX_BYTES:
            raise RuntimeError(
                f"Response exceeds {MAX_BYTES} bytes"
            )

        charset = response.headers.get_content_charset() or "utf-8"
        text = raw.decode(charset, errors="replace")

    return {
        "requested_url": url,
        "final_url": final_url,
        "fetched_at": utc_now(),
        "content_type": content_type,
        "byte_size": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "body": text,
    }


def save_result(source_id, index, result):
    source_dir = STAGING_DIR / source_id
    source_dir.mkdir(parents=True, exist_ok=True)

    html_path = source_dir / f"{index:03d}.html"
    meta_path = source_dir / f"{index:03d}.json"

    html_path.write_text(result["body"], encoding="utf-8")

    metadata = {
        key: value
        for key, value in result.items()
        if key != "body"
    }

    meta_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def validate_source(source):
    required = [
        "id",
        "name",
        "domain_allowlist",
        "enabled",
        "fetch_type",
        "trust_level",
    ]

    for key in required:
        if key not in source:
            raise ValueError(
                f"Source missing required field {key}: {source}"
            )

    if not isinstance(source["domain_allowlist"], list):
        raise ValueError(
            f"{source['id']}: domain_allowlist must be a list"
        )

    for url in source.get("start_urls", []):
        validate_url(url, source["domain_allowlist"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate configuration without network requests",
    )
    args = parser.parse_args()

    config = load_config()
    sources = config["sources"]

    for source in sources:
        validate_source(source)

    enabled_sources = [
        source for source in sources
        if source.get("enabled") is True
    ]

    if args.dry_run:
        print(
            f"FETCH_DRY_RUN_OK "
            f"sources={len(sources)} "
            f"enabled={len(enabled_sources)}"
        )

        for source in sources:
            print(
                f"- {source['id']}: "
                f"enabled={source['enabled']} "
                f"urls={len(source.get('start_urls', []))}"
            )

        return 0

    if not enabled_sources:
        print("NO_ENABLED_SOURCES")
        print("No network request was performed.")
        return 0

    failures = 0
    fetched = 0

    for source in enabled_sources:
        source_id = source["id"]
        urls = source.get("start_urls", [])

        for index, url in enumerate(urls, start=1):
            try:
                result = fetch_url(
                    url,
                    source["domain_allowlist"],
                )

                save_result(source_id, index, result)
                fetched += 1

                print(
                    f"FETCH_OK source={source_id} "
                    f"url={url}"
                )

            except Exception as exc:
                failures += 1

                print(
                    f"FETCH_FAIL source={source_id} "
                    f"url={url} error={exc}",
                    file=sys.stderr,
                )

    print(
        f"FETCH_SUMMARY fetched={fetched} "
        f"failed={failures}"
    )

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
