/* V5 phase 3: CSS consolidation and reproducible structural budget. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const nav=read('css/app-ui.css');
assert(!nav.includes('/* V96.4.3: mobile navigation follows gesture'));
assert(nav.includes('/* V96.4.4: authoritative mobile bottom-nav state'));
assert(nav.includes('visibility:hidden!important;pointer-events:none!important'));
assert(read('css/ui-layout-v4.css').includes('UI-LAYOUT-V4'));
assert(read('js/toeic-sync-runtime.js').includes('GoalToeicSyncRuntime'));
assert(read('docs/CSS_OWNERSHIP_V5.md').includes('Chromium'));
cp.execFileSync('python3',['tools/css_cascade_audit_v5.py','--self-test'],{cwd:root,stdio:'inherit'});
cp.execFileSync('python3',['tools/css_cascade_audit_v5.py','--project','goal','--check'],{cwd:root,stdio:'inherit'});
console.log('PASS: Goal Manager V5 CSS duplicate removal and future cascade guard');
