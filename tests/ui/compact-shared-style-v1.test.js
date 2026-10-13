/* Dual-app compact design foundation: presentation-only. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const tokens = read('css/tokens.css');
const design = read('css/design-system.css');
const refinements = read('css/refinements.css');
assert(tokens.includes('--gm-font-size-body:15px;'));
assert(tokens.includes('--gm-font-size-page:22px;'));
assert(tokens.includes('--gm-font-size-section:17px;'));
assert(tokens.includes('--gm-font-size-stat:24px;'));
// QA and runtime must use the same deliberately approved 15px text token.
const staticQA = read('qa_static.py');
assert(staticQA.includes("'--gm-font-size-body:15px'"), 'static QA must track revised 15px body token');
assert(!staticQA.includes("'--gm-font-size-body:16px'"), 'obsolete 16px assumption must be removed');
assert(tokens.includes('--gm-font-size-small:13px;'));
assert(tokens.includes('--gm-font-size-meta:12px;'));
for(const semantic of ['neutral','positive','warm']) {
  for(const part of ['bg','text','border'])
    assert(tokens.includes(`--gm-tag-${semantic}-${part}:`), `${semantic} tag token missing: ${part}`);
}
assert(design.includes('.goal-browse-status.run{'));
assert(design.includes('.goal-browse-status.done{'));
assert(refinements.includes('#activity .activity-card .activity-chip:not(.circle-chip):not(.tier-chip)'));
// The existing scholarship identity is preserved; styles aren't remapped across all UI.
assert(design.includes('#scholarship .badge.gold{'));
assert(!refinements.includes('#scholarship .badge{background:var(--gm-tag-'));
const html = read('index.html');
assert(html.includes('id="gmToeicImmersive"') && html.includes('id="homeToeicTraining"'));
const runtime = read('js/toeic-sync-runtime.js');
assert(runtime.includes('window.GoalToeicSyncRuntime=Object.freeze({sync,status:()=>lastSummary});'));
console.log('PASS: compact GM text hierarchy, selective status tags, scholarship untouched, TOEIC link intact');
