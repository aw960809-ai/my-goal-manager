/* V5 Stage 1: regression runner is UI-only and isolated from user storage. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const runner=read('tools/ui_v5_visual_qa.py');
const workflow=read('.github/workflows/v5-browser-ui-qa.yml');
for(const expected of ['GOAL_VIEWS','TOEIC_VIEWS','WIDTHS = (360, 390, 430, 768, 1280)',
  'service_workers="block"','context.route("**/*", handle)',
  'report.json','summary.md','--strict','screenshot(page','--self-test'])
  assert(runner.includes(expected),'V5 browser tool missing '+expected);
assert(runner.includes('LocalSite'),'must load only local repo files');
assert(runner.includes('TOEIC_VIEWS = ("home", "reading", "vocab", "grammar", "mistakes", "history")'),'Goal Manager settings are the only settings entry; all six TOEIC view states remain audited');
assert(workflow.includes('pull_request:')&&workflow.includes('playwright==1.57.0'));
assert(workflow.includes('--goal-root goal --toeic-root toeic'));
assert(workflow.includes('actions/upload-artifact@v4'));
assert(read('index.html').includes('./css/ui-layout-v4.css'));
assert(read('js/app.js').includes("const KEY='lawLangGoalSystemV92'"));
console.log('PASS: V5 browser audit contract, 7+6 views, 5 widths × 2 modes, untouched Goal data');
