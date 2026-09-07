#!/usr/bin/env python3

from pathlib import Path
from collections import Counter
import re
import json
import subprocess
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

SCAN_EXTS = {
    ".js", ".html", ".css", ".py",
    ".json", ".yml", ".yaml", ".webmanifest"
}

IGNORE_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    "_site",
    "dist",
    "data/staging",
}

PERSONAL_TERMS = [
    "台大及政大轉學考",
    "台政大",
    "刑總",
    "民總",
    "TOEIC",
    "嘉義高中",
    "東海大學",
    "東海校內",
]

SECRET_PATTERNS = {
    "GitHub classic token": re.compile(r"\bghp_[A-Za-z0-9]{20,}\b"),
    "GitHub fine-grained token": re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"),
    "Private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "Generic bearer": re.compile(r"Bearer\s+[A-Za-z0-9._\-]{20,}", re.I),
}

VERSION_PATTERNS = [
    re.compile(r"APP_VERSION\s*=\s*['\"]([^'\"]+)"),
    re.compile(r"PWA_VERSION\s*=\s*['\"]([^'\"]+)"),
    re.compile(r"CURRENT_VERSION\s*=\s*['\"]([^'\"]+)"),
    re.compile(r"SCHEMA_VERSION\s*=\s*(\d+)"),
    re.compile(r'"version"\s*:\s*"([^"]+)"'),
]

def git(*args):
    try:
        return subprocess.check_output(
            ["git", *args],
            cwd=ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return "unknown"

def ignored(path: Path):
    rel = path.relative_to(ROOT).as_posix()
    for d in IGNORE_DIRS:
        if rel == d or rel.startswith(d + "/"):
            return True
    return False

files = []

for p in ROOT.rglob("*"):
    if not p.is_file():
        continue
    if ignored(p):
        continue
    if p.suffix.lower() not in SCAN_EXTS:
        continue

    try:
        text = p.read_text(encoding="utf-8")
    except Exception:
        continue

    files.append((p, text))

results = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "branch": git("branch", "--show-current"),
    "commit": git("rev-parse", "HEAD"),
    "filesScanned": len(files),
}

large_files = []
personal_hits = []
inline_handlers = []
inner_html = []
window_globals = []
storage_usage = []
dangerous_js = []
secrets = []
versions = []
root_tokens = []
workflow_duplication = []
direct_db_mutations = []

handler_rx = re.compile(
    r"\bon(?:click|change|input|submit|keydown|keyup|load)\s*=",
    re.I,
)

window_rx = re.compile(r"\bwindow\.([A-Za-z_$][\w$]*)")
inner_rx = re.compile(r"\.innerHTML\s*=")
storage_rx = re.compile(
    r"\b(?:localStorage|sessionStorage|indexedDB)\b"
)
danger_rx = re.compile(
    r"\b(?:eval\s*\(|new\s+Function\s*\(|document\.write\s*\()"
)
db_mutation_rx = re.compile(
    r"\bdb\.(?:tasks|logs|executionPlans|events|calendar|settings)"
)

for p, text in files:
    rel = p.relative_to(ROOT).as_posix()
    lines = text.splitlines()

    if len(lines) >= 500:
        large_files.append((rel, len(lines)))

    for n, line in enumerate(lines, 1):

        for term in PERSONAL_TERMS:
            if term in line:
                personal_hits.append((rel, n, term))

        if handler_rx.search(line):
            inline_handlers.append((rel, n))

        if inner_rx.search(line):
            inner_html.append((rel, n))

        for name in window_rx.findall(line):
            window_globals.append((rel, n, name))

        if storage_rx.search(line):
            storage_usage.append((rel, n))

        if danger_rx.search(line):
            dangerous_js.append((rel, n, line.strip()[:140]))

        if db_mutation_rx.search(line):
            direct_db_mutations.append((rel, n))

        for label, rx in SECRET_PATTERNS.items():
            if rx.search(line):
                secrets.append((rel, n, label))

        for rx in VERSION_PATTERNS:
            for m in rx.finditer(line):
                versions.append((rel, n, m.group(1)))

    if p.name == "autofetch.py":
        if re.search(r"\bWORKFLOW\s*=\s*['\"]{3}", text):
            workflow_duplication.append(
                "tools/autofetch/autofetch.py contains embedded WORKFLOW"
            )

    if p.suffix == ".css":
        root_tokens.extend(
            (rel, n)
            for n, line in enumerate(lines, 1)
            if ":root" in line
        )

global_counts = Counter(
    name for _, _, name in window_globals
)

results.update({
    "largeFiles": large_files,
    "personalCoupling": personal_hits,
    "inlineHandlers": inline_handlers,
    "innerHTMLAssignments": inner_html,
    "windowGlobals": window_globals,
    "storageUsage": storage_usage,
    "dangerousJS": dangerous_js,
    "possibleSecrets": secrets,
    "versions": versions,
    "cssRootBlocks": root_tokens,
    "workflowDuplication": workflow_duplication,
    "directDbReferences": direct_db_mutations,
})

json_path = ROOT / "docs/audit/v97-architecture-audit.json"
md_path = ROOT / "docs/audit/v97-architecture-audit.md"

json_path.write_text(
    json.dumps(results, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

def table(rows, headers):
    if not rows:
        return "_None found._\n"

    out = []
    out.append("| " + " | ".join(headers) + " |")
    out.append("| " + " | ".join("---" for _ in headers) + " |")

    for row in rows:
        out.append(
            "| " +
            " | ".join(str(x).replace("|", "\\|") for x in row) +
            " |"
        )

    return "\n".join(out) + "\n"

md = []

md.append("# V97 Architecture Audit")
md.append("")
md.append(f"- Branch: `{results['branch']}`")
md.append(f"- Commit: `{results['commit']}`")
md.append(f"- Files scanned: `{results['filesScanned']}`")
md.append("")

md.append("## P0 — Secrets")
md.append(table(secrets, ["File", "Line", "Pattern"]))

md.append("## P0 — Personal/Core Coupling")
md.append(table(personal_hits, ["File", "Line", "Term"]))

md.append("## P0/P1 — Inline Event Handlers")
md.append(f"Count: **{len(inline_handlers)}**")
md.append("")
md.append(table(inline_handlers[:100], ["File", "Line"]))

md.append("## P1 — innerHTML Assignments")
md.append(f"Count: **{len(inner_html)}**")
md.append("")
md.append(table(inner_html[:100], ["File", "Line"]))

md.append("## P1 — Global window API")
md.append(f"Occurrences: **{len(window_globals)}**")
md.append("")
md.append(
    table(
        global_counts.most_common(40),
        ["Global", "Count"]
    )
)

md.append("## P1 — Large Files")
md.append(table(
    sorted(large_files, key=lambda x: -x[1]),
    ["File", "Lines"]
))

md.append("## P1 — Version Sources")
md.append(table(
    versions,
    ["File", "Line", "Version"]
))

md.append("## P1 — Storage Coupling")
md.append(f"References: **{len(storage_usage)}**")
md.append("")

md.append("## P1 — Direct DB References")
md.append(f"References: **{len(direct_db_mutations)}**")
md.append("")

md.append("## P1 — Workflow Duplication")
if workflow_duplication:
    for x in workflow_duplication:
        md.append(f"- {x}")
else:
    md.append("_None found._")
md.append("")

md.append("## P2 — CSS :root Blocks")
md.append(f"Count: **{len(root_tokens)}**")
md.append("")
md.append(table(root_tokens, ["File", "Line"]))

md.append("## Dangerous JavaScript")
md.append(table(
    dangerous_js,
    ["File", "Line", "Expression"]
))

md.append("## Audit Decision")
md.append("")
md.append(
    "This report is diagnostic only. "
    "No production behavior is changed by this audit."
)

md_path.write_text(
    "\n".join(md) + "\n",
    encoding="utf-8"
)

print("=== V97 ARCHITECTURE AUDIT ===")
print("branch =", results["branch"])
print("commit =", results["commit"])
print("files =", results["filesScanned"])
print("possible_secrets =", len(secrets))
print("personal_core_hits =", len(personal_hits))
print("inline_handlers =", len(inline_handlers))
print("innerHTML_assignments =", len(inner_html))
print("window_global_occurrences =", len(window_globals))
print("storage_references =", len(storage_usage))
print("direct_db_references =", len(direct_db_mutations))
print("css_root_blocks =", len(root_tokens))
print("large_files =", len(large_files))
print("version_declarations =", len(versions))
print("dangerous_js =", len(dangerous_js))
print("workflow_duplication =", len(workflow_duplication))
print()
print("REPORT_MD=docs/audit/v97-architecture-audit.md")
print("REPORT_JSON=docs/audit/v97-architecture-audit.json")

if secrets:
    print("AUDIT_STATUS=P0_SECRET_REVIEW_REQUIRED")
else:
    print("AUDIT_STATUS=READY_FOR_ARCHITECTURE_REFACTOR")
