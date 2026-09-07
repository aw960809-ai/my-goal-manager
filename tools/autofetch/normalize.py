#!/usr/bin/env python3

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "staging" / "raw"
NORMALIZED_DIR = ROOT / "data" / "staging" / "normalized"
CONFIG_FILE = ROOT / "tools" / "autofetch" / "sources.json"

MAX_TEXT_CHARS = 200000
MAX_LINKS = 500


class HTMLExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_script = False
        self.in_style = False
        self.in_title = False
        self.title_parts = []
        self.text_parts = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()

        if tag == "script":
            self.in_script = True
            return

        if tag == "style":
            self.in_style = True
            return

        if tag == "title":
            self.in_title = True

        if tag == "a" and len(self.links) < MAX_LINKS:
            href = dict(attrs).get("href")
            if href:
                self.links.append(href)

    def handle_endtag(self, tag):
        tag = tag.lower()

        if tag == "script":
            self.in_script = False
        elif tag == "style":
            self.in_style = False
        elif tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_script or self.in_style:
            return

        text = data.strip()
        if not text:
            return

        if self.in_title:
            self.title_parts.append(text)

        self.text_parts.append(text)


def load_sources():
    with CONFIG_FILE.open("r", encoding="utf-8") as f:
        config = json.load(f)

    return {
        source["id"]: source
        for source in config.get("sources", [])
    }


def clean_text(parts):
    text = "\n".join(parts)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()[:MAX_TEXT_CHARS]


def hostname_allowed(hostname, allowlist):
    hostname = (hostname or "").lower().strip(".")

    for allowed in allowlist:
        allowed = allowed.lower().strip(".")
        if hostname == allowed or hostname.endswith("." + allowed):
            return True

    return False


def normalize_links(raw_links, base_url, allowlist):
    output = []
    seen = set()

    for href in raw_links:
        try:
            absolute = urljoin(base_url, href)
            parsed = urlparse(absolute)

            if parsed.scheme not in ("http", "https"):
                continue

            if not hostname_allowed(parsed.hostname, allowlist):
                continue

            clean = parsed._replace(fragment="").geturl()

            if clean in seen:
                continue

            seen.add(clean)
            output.append(clean)

            if len(output) >= MAX_LINKS:
                break

        except Exception:
            continue

    return output

def normalize_document(source, meta_path):
    html_path = meta_path.with_suffix(".html")

    if not html_path.exists():
        raise FileNotFoundError(
            f"Missing HTML file for {meta_path.name}"
        )

    metadata = json.loads(
        meta_path.read_text(encoding="utf-8")
    )

    html = html_path.read_text(
        encoding="utf-8",
        errors="replace",
    )

    parser = HTMLExtractor()
    parser.feed(html)

    final_url = metadata.get(
        "final_url",
        metadata.get("requested_url", ""),
    )

    title = " ".join(parser.title_parts).strip()
    text = clean_text(parser.text_parts)

    links = normalize_links(
        parser.links,
        final_url,
        source.get("domain_allowlist", []),
    )

    return {
        "schema_version": "96.6-normalized-1",
        "source_id": source["id"],
        "source_name": source["name"],
        "scope": source.get("scope"),
        "priority": source.get("priority"),
        "trust_level": source.get("trust_level"),
        "requested_url": metadata.get("requested_url"),
        "final_url": final_url,
        "fetched_at": metadata.get("fetched_at"),
        "content_sha256": metadata.get("sha256"),
        "title": title,
        "text": text,
        "links": links,
        "normalization": {
            "text_chars": len(text),
            "link_count": len(links),
        },
    }


def save_document(source_id, filename, document):
    target_dir = NORMALIZED_DIR / source_id
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


def discover_raw_documents():
    if not RAW_DIR.exists():
        return []

    return sorted(RAW_DIR.glob("*/*.json"))


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Inspect staging files without writing normalized output",
    )

    args = parser.parse_args()

    sources = load_sources()
    meta_files = discover_raw_documents()

    if args.dry_run:
        print(
            f"NORMALIZE_DRY_RUN_OK "
            f"sources={len(sources)} "
            f"raw_documents={len(meta_files)}"
        )
        return 0

    normalized = 0
    failed = 0

    for meta_path in meta_files:
        source_id = meta_path.parent.name
        source = sources.get(source_id)

        if source is None:
            print(f"NORMALIZE_SKIP unknown_source={source_id}")
            failed += 1
            continue

        try:
            document = normalize_document(source, meta_path)
            save_document(source_id, meta_path.name, document)

            normalized += 1

            print(
                f"NORMALIZE_OK "
                f"source={source_id} "
                f"file={meta_path.name}"
            )

        except Exception as exc:
            failed += 1

            print(
                f"NORMALIZE_FAIL "
                f"source={source_id} "
                f"file={meta_path.name} "
                f"error={exc}"
            )

    print(
        f"NORMALIZE_SUMMARY "
        f"normalized={normalized} "
        f"failed={failed}"
    )

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
