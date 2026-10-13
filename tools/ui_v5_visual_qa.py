#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V5 isolated browser UI audit of two independent PWA frontends.

Only GitHub Actions runs Chromium; ``--self-test`` has no external dependencies.
All hosted assets are fulfilled from local repository files. No user profiles,
cloud accounts, live GitHub Pages visits or real browser storage are used.
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlsplit

HOST = "aw960809-ai.github.io"
GOAL_URL = f"https://{HOST}/my-goal-manager/"
TOEIC_URL = f"https://{HOST}/toeic-trainer/"
WIDTHS = (360, 390, 430, 768, 1280)
HEIGHTS = (800, 844, 932, 1024, 900)
THEMES = ("light", "dark")
GOAL_VIEWS = ("dash", "goals", "today", "calendar", "activity", "scholarship", "stats")
TOEIC_VIEWS = ("home", "reading", "vocab", "grammar", "mistakes", "history", "settings")
MIME = {".js": "application/javascript", ".css": "text/css", ".json": "application/json",
        ".html": "text/html; charset=utf-8", ".webmanifest": "application/manifest+json"}


@dataclass(frozen=True)
class LocalSite:
    goal: Path
    toeic: Path

    def file_for(self, url: str) -> Path | None:
        parsed = urlsplit(url)
        if parsed.scheme != "https" or parsed.hostname != HOST:
            return None
        parts = [unquote(x) for x in parsed.path.split("/") if x]
        if not parts or parts[0] not in ("my-goal-manager", "toeic-trainer"):
            return None
        if any(x in (".", "..") or "\\" in x or "/" in x or "\x00" in x for x in parts):
            return None
        base = self.goal if parts[0] == "my-goal-manager" else self.toeic
        relative = parts[1:] or ["index.html"]
        destination = base.joinpath(*relative).resolve()
        if not destination.is_relative_to(base.resolve()):
            return None
        return destination


def static_content_type(path: Path) -> str:
    return MIME.get(path.suffix.lower(), mimetypes.guess_type(path.name)[0] or "application/octet-stream")


def self_test() -> None:
    with tempfile.TemporaryDirectory() as temp:
        goal, toeic = Path(temp) / "goal", Path(temp) / "toeic"
        for root in (goal, toeic):
            root.mkdir()
            (root / "index.html").write_text("<!doctype html><title>isolated fixture</title>", encoding="utf-8")
            (root / "style.css").write_text(":root{color-scheme:light}", encoding="utf-8")
        sites = LocalSite(goal, toeic)
        assert sites.file_for(GOAL_URL) == goal / "index.html"
        assert sites.file_for(TOEIC_URL) == toeic / "index.html"
        assert sites.file_for(GOAL_URL + "style.css?cached=1") == goal / "style.css"
        assert sites.file_for(TOEIC_URL + "style.css") == toeic / "style.css"
        assert sites.file_for("http://" + HOST + "/my-goal-manager/") is None
        assert sites.file_for("https://evil.example/my-goal-manager/") is None
        assert sites.file_for(GOAL_URL + "%2e%2e/secret") is None
        assert sites.file_for(GOAL_URL + "%5csecret") is None
        assert static_content_type(Path("script.js")) == "application/javascript"
        assert static_content_type(Path("app.css")) == "text/css"
        assert len(WIDTHS) == len(HEIGHTS) and min(WIDTHS) <= 360
        assert len(GOAL_VIEWS) == 7 and len(TOEIC_VIEWS) == 7
        assert "".join(THEMES) == "lightdark"
    print("PASS: isolated URL routing, no traversal/external fetch, safe MIME, 5 widths × 2 themes, 14 view targets")


def report_issue(entries: list[dict], app: str, view: str, width: int, theme: str, message: str) -> None:
    entries.append({"app": app, "view": view, "width": width, "theme": theme, "issue": str(message)[:500]})


def scan_view(page, app: str, view: str, width: int, theme: str, issues: list[dict]) -> None:
    try:
        metrics = page.evaluate("""() => {
          window.scrollTo({top:0,behavior:'instant'});
          const vw=document.documentElement.clientWidth||window.innerWidth;
          const nav=document.querySelector('nav.bottom-nav,nav.main-nav');
          const controls=nav?[...nav.querySelectorAll('button')].filter(x=>getComputedStyle(x).display!=='none'):[];
          return {viewport:vw, root:document.documentElement.scrollWidth,
            body:document.body.scrollWidth, appearance:document.documentElement.dataset.appearance,
            navigation:controls.map(b=>{const r=b.getBoundingClientRect();return {
              text:b.textContent.trim().slice(0,28),x:r.x,right:r.right,width:r.width,height:r.height
            }}),
            fatal:/題庫檢查失敗|程式資料載入失敗|閱讀、單字、文法或題庫資料載入失敗/.test(document.body.innerText.slice(0,600))};
        }""")
        max_scroll = max(metrics["root"], metrics["body"])
        if max_scroll > metrics["viewport"] + 3:
            report_issue(issues, app, view, width, theme,
                         f"水平溢出：內容 {max_scroll}px，畫面 {metrics['viewport']}px")
        if metrics["appearance"] != theme:
            report_issue(issues, app, view, width, theme,
                         f"深淺模式不符：預期 {theme}，實際 {metrics['appearance']}")
        if metrics["fatal"]:
            report_issue(issues, app, view, width, theme, "頁面呈現致命資料或題庫載入錯誤")
        if view == "settings-dialog":
            rect = page.locator("#settingsModal .settings-box").bounding_box()
            if not rect or rect["x"] < -3 or rect["x"] + rect["width"] > width + 3:
                report_issue(issues, app, view, width, theme,
                             "設定視窗超出螢幕左右邊界")
        nav = metrics["navigation"]
        if len(nav) < 5:
            report_issue(issues, app, view, width, theme, f"頂層導航只有 {len(nav)} 個可見按鈕")
        for button in nav:
            if button["height"] < 40:
                report_issue(issues, app, view, width, theme,
                             f"導航按鈕觸控高度不足：{button['text']} {button['height']:.0f}px")
            if button["x"] < -3 or button["right"] > width + 3:
                report_issue(issues, app, view, width, theme,
                             f"導航按鈕超出左右邊界：{button['text']}")
    except Exception as error:
        report_issue(issues, app, view, width, theme, f"瀏覽器幾何檢查異常：{error}")


def stored_theme(theme: str) -> str:
    # Fresh temporary browser context only. Do not inject goals, logs, sessions or test users.
    return """(() => {
      const visual={version:1,appearance:THEME,accent:'slate',textSize:'normal',density:'compact'};
      try {
        localStorage.setItem('gm-suite:appearance-v1',JSON.stringify(visual));
        localStorage.setItem('lawLangGoalSystem_settings_v1',JSON.stringify(visual));
      } catch(_) {}
    })();""".replace("THEME", json.dumps(theme))


def audit_goal(page, width: int, theme: str, issues: list[dict], pictures: Path, sample: bool) -> None:
    page.goto(GOAL_URL, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_selector("#dash", timeout=15000)
    page.wait_for_function("typeof go === 'function'", timeout=12000)
    for view in GOAL_VIEWS:
        before = len(issues)
        try:
            if view in ("dash", "goals", "today", "calendar", "stats"):
                page.locator(f'nav.bottom-nav button[data-view="{view}"]').click(timeout=8000)
            else:
                page.evaluate("id => go(id)", view)
            page.wait_for_timeout(120)
            if not page.locator(f"#{view}.view.active").is_visible():
                report_issue(issues, "goal", view, width, theme, "切換後目標頁面未顯示")
            scan_view(page, "goal", view, width, theme, issues)
        except Exception as error:
            report_issue(issues, "goal", view, width, theme, f"頁面切換失敗：{error}")
        if sample or len(issues) > before:
            screenshot(page, pictures / f"goal-{width}-{theme}-{view}.png", issues, "goal", view, width, theme)
    before = len(issues)
    try:
        page.locator(".settings-trigger").click(timeout=9000)
        page.locator("#settingsModal.show").wait_for(state="visible", timeout=9000)
        scan_view(page, "goal", "settings-dialog", width, theme, issues)
        if not page.locator("#settingsBody .settings-hub-panel").count() == 5:
            report_issue(issues, "goal", "settings-dialog", width, theme, "設定中心並非五大模組")
        if sample or len(issues) > before:
            screenshot(page, pictures / f"goal-{width}-{theme}-settings-dialog.png", issues,
                       "goal", "settings-dialog", width, theme)
        page.locator(".settings-close").click(timeout=8000)
    except Exception as error:
        report_issue(issues, "goal", "settings-dialog", width, theme, f"設定彈窗操作失敗：{error}")
        screenshot(page, pictures / f"goal-{width}-{theme}-settings-error.png", issues,
                   "goal", "settings-dialog", width, theme)
    # Integration smoke: real same-origin iframe, not a mock visual placeholder.
    before = len(issues)
    try:
        # The mobile nav deliberately auto-hides after scrolling or closing a
        # dialog. Earlier page checks already exercise visible nav buttons;
        # return to Home through the app route to set up this separate test.
        page.evaluate("go('dash')")
        page.locator('#dash.view.active').wait_for(state='visible', timeout=8000)
        page.locator('#homeToeicTraining').click(timeout=8000)
        page.locator('#gmToeicImmersive').wait_for(state='visible',timeout=8000)
        frame = page.frame_locator('#gmToeicFrame')
        frame.locator('nav.main-nav').wait_for(state='visible',timeout=18000)
        frame.locator('#gmToeicEmbeddedChromeV1').wait_for(state='attached',timeout=9000)
        if frame.locator('.masthead').is_visible():
            report_issue(issues,'goal','embedded-toeic',width,theme,
                         '內嵌 TOEIC 仍顯示重複品牌標題')
        if not page.locator('#gmToeicBack').is_visible():
            report_issue(issues,'goal','embedded-toeic',width,theme,
                         '返回目標系統按鈕不可見')
        if sample or len(issues)>before:
            screenshot(page,pictures / f'goal-{width}-{theme}-embedded-toeic.png',
                       issues,'goal','embedded-toeic',width,theme)
        page.locator('#gmToeicBack').click(timeout=8000)
        if page.locator('#gmToeicImmersive').is_visible():
            report_issue(issues,'goal','embedded-toeic',width,theme,
                         '返回目標系統後內嵌遮罩未關閉')
    except Exception as error:
        report_issue(issues,'goal','embedded-toeic',width,theme,
                     f'內嵌訓練整合失敗：{error}')
        screenshot(page,pictures / f'goal-{width}-{theme}-embedded-error.png',
                   issues,'goal','embedded-toeic',width,theme)


def audit_toeic(page, width: int, theme: str, issues: list[dict], pictures: Path, sample: bool) -> None:
    page.goto(TOEIC_URL, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_selector('nav.main-nav button[data-tab="home"]', timeout=12000)
    for view in TOEIC_VIEWS:
        before = len(issues)
        try:
            if view == "history":
                page.locator('nav.main-nav button[data-tab="analysis"]').click(timeout=8000)
                page.locator('#analysisSwitcher [data-analysis-tab="history"]').click(timeout=8000)
            elif view == "mistakes":
                page.locator('nav.main-nav button[data-tab="analysis"]').click(timeout=8000)
            else:
                page.locator(f'nav.main-nav button[data-tab="{view}"]').click(timeout=8000)
            page.wait_for_timeout(120)
            actual = "practice" if view in ("reading", "grammar") else view
            if not page.locator(f"#tab-{actual}").is_visible():
                report_issue(issues, "toeic", view, width, theme, "導覽切換後訓練頁未顯示")
            if view in ("reading", "grammar"):
                expected = "閱讀理解" if view == "reading" else "文法訓練"
                title = page.locator("#practicePageTitle").inner_text(timeout=6000)
                if expected not in title:
                    report_issue(issues, "toeic", view, width, theme, f"頁面標題不符：{title}")
            scan_view(page, "toeic", view, width, theme, issues)
        except Exception as error:
            report_issue(issues, "toeic", view, width, theme, f"頁面導覽失敗：{error}")
        if sample or len(issues) > before:
            screenshot(page, pictures / f"toeic-{width}-{theme}-{view}.png", issues,
                       "toeic", view, width, theme)


def screenshot(page, path: Path, issues: list[dict], app: str, view: str, width: int, theme: str) -> None:
    try:
        page.screenshot(path=str(path), animations="disabled", timeout=7000)
    except Exception as err:
        report_issue(issues, app, view, width, theme, f"截圖失敗：{err}")


def render_summary(report: dict) -> str:
    issues = report["issues"]
    lines = ["# V5 雙系統瀏覽器 UI 自動驗收", "",
             f"- 全部頁面檢查：{report['checks']} 次", f"- 發現問題：{len(issues)} 項",
             "- 測試環境：隔離 Chromium，全部網站資產從 PR 工作目錄載入",
             "- 瀏覽器儲存：每組測試建立全新暫存空間，不讀取手機或真人資料", "",
             "## 檢查範圍", "",
             "360／390／430／768／1280px × 淺色／深色；Goal Manager 七區、設定視窗及內嵌 TOEIC；另有 TOEIC 七區。", ""]
    if issues:
        lines += ["## 需修復的問題", ""]
        for x in issues[:100]:
            lines.append(f"- `{x['app']}` {x['width']}px {x['theme']}／{x['view']}：{x['issue']}")
        if len(issues) > 100:
            lines.append(f"- 另有 {len(issues)-100} 項，請查閱 report.json")
    else:
        lines += ["## 驗收結果", "", "已通過目前設定的可見性、導航、文字寬度及觸控區檢查。", ""]
    return "\n".join(lines) + "\n"


def run_visual(goal: Path, toeic: Path, out: Path, strict: bool) -> int:
    from playwright.sync_api import sync_playwright
    for name, folder in (("Goal Manager", goal), ("TOEIC Trainer", toeic)):
        if not (folder / "index.html").is_file():
            raise RuntimeError(f"缺少 {name} 工作目錄中的 index.html：{folder}")
    out.mkdir(parents=True, exist_ok=True)
    pictures = out / "screenshots"
    pictures.mkdir(parents=True, exist_ok=True)
    sites = LocalSite(goal.resolve(), toeic.resolve())
    issues: list[dict] = []
    checks = 0
    missing: set[str] = set()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        try:
            for width, height in zip(WIDTHS, HEIGHTS):
                for theme in THEMES:
                    print(f"Auditing {width}×{height} {theme} ...", flush=True)
                    context = browser.new_context(viewport={"width": width, "height": height},
                        device_scale_factor=1, is_mobile=width < 600, has_touch=width < 600,
                        color_scheme=theme, reduced_motion="reduce", locale="zh-TW",
                        timezone_id="Asia/Taipei", service_workers="block")
                    context.add_init_script(script=stored_theme(theme))
                    def handle(route):
                        requested = route.request.url
                        path = sites.file_for(requested)
                        if path is None:
                            route.fulfill(status=204, body="", content_type="text/plain")
                            return
                        if not path.is_file():
                            if path.suffix in (".js", ".css", ".webmanifest"):
                                missing.add(requested.split("?", 1)[0])
                            route.fulfill(status=404, body="Missing local asset", content_type="text/plain")
                            return
                        route.fulfill(status=200, path=str(path), content_type=static_content_type(path))
                    context.route("**/*", handle)
                    for app in ("goal", "toeic"):
                        page = context.new_page()
                        errors = []
                        page.on("pageerror", lambda error: errors.append(str(error)[:320]))
                        page.on("dialog", lambda dialog: dialog.dismiss())
                        current = "startup"
                        try:
                            if app == "goal":
                                audit_goal(page, width, theme, issues, pictures, width == 390 and theme == "light")
                                checks += len(GOAL_VIEWS) + 2
                            else:
                                audit_toeic(page, width, theme, issues, pictures, width == 390 and theme == "light")
                                checks += len(TOEIC_VIEWS)
                        except Exception as error:
                            report_issue(issues, app, current, width, theme, f"首次載入失敗：{error}")
                            screenshot(page, pictures / f"{app}-{width}-{theme}-startup-error.png",
                                       issues, app, current, width, theme)
                        if any("ResizeObserver loop" not in err for err in errors):
                            screenshot(page, pictures / f"{app}-{width}-{theme}-runtime-error.png",
                                       issues, app, "runtime", width, theme)
                        for error in sorted(set(errors))[:8]:
                            if "ResizeObserver loop" not in error:
                                report_issue(issues, app, "runtime", width, theme, "JavaScript 未捕捉例外：" + error)
                        page.close()
                    context.close()
        finally:
            browser.close()
    for asset in sorted(missing):
        report_issue(issues, "shared", "asset", 0, "all", "靜態資產缺失：" + asset)
    report = {"version": "V5", "isolated": True, "checks": checks,
              "widths": list(WIDTHS), "themes": list(THEMES), "issues": issues}
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "summary.md").write_text(render_summary(report), encoding="utf-8")
    print(f"UI audit: {checks} checks; {len(issues)} issue(s); output {out}")
    for item in issues[:16]:
        print(f"  {item['app']}/{item['view']} {item['width']}px {item['theme']}: {item['issue']}")
    return 1 if issues and strict else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="V5 isolated real-browser UI audit")
    parser.add_argument("--goal-root", type=Path)
    parser.add_argument("--toeic-root", type=Path)
    parser.add_argument("--out", type=Path, default=Path("visual-qa"))
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--strict", action="store_true", help="fail CI when visual violations are detected")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    if not args.goal_root or not args.toeic_root:
        parser.error("running a browser audit requires --goal-root and --toeic-root")
    return run_visual(args.goal_root, args.toeic_root, args.out, args.strict)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"V5 automated browser audit failed: {exc}", file=sys.stderr)
        sys.exit(2)
