'use strict';
// Third-stage phone UI contract: CSS-only; must preserve all data/runtime code.
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const design=read('css/design-system.css');
const tokens=read('css/tokens.css');
const markup=read('index.html');
const scholarship=read('js/scholarship.js');
const START='GM-VISUAL-PHASE3-20261008-BEGIN';
const END='GM-VISUAL-PHASE3-20261008-END';
const REVIEW='GM-PHASE3-MOBILE-REVIEW-20261008';
const count=(text,value)=>text.split(value).length-1;
assert.strictEqual(count(design,START),1,'Only one Phase-3 source of truth');
assert.strictEqual(count(design,END),1,'The Phase-3 source must close once');
assert.strictEqual(count(design,REVIEW),1,'One consolidated mobile review in the original block');
assert(design.indexOf(REVIEW)<design.indexOf(START),'Do not append a second patch after Phase-3');
assert(design.trim().endsWith('/* '+END+' */'),'Existing CSS block must still end the file');
for(const fragment of [
  '.app{position:relative!important}',
  'position:absolute!important;top:12px!important;right:14px!important',
  '#scholarship .scholarship-action-row{',
  'grid-template-areas:\'main main\' \'badge chevron\'!important',
  '#scholarship #scholarshipStats{',
  '#scholarship .scholarship-action-row .title{',
  'font-size:15px!important;line-height:1.38!important',
  '#dash .home-focus-panel .decision-item{',
  'grid-template-columns:27px minmax(0,1fr) auto!important',
  '#dash .home-focus-panel .decision-item>.decision-badge{',
  'grid-column:3!important;grid-row:1!important',
  '.panel{padding:clamp(12px,calc(var(--gm-layout-pad) - 3px),17px)!important}',
  '.home-metric{min-height:83px!important;padding:9px!important}'
])assert(design.includes(fragment),`missing mobile design boundary: ${fragment}`);
for(const outdated of [
  'html[data-density="comfortable"] .panel{padding:var(--gm-space-6)!important}',
  'html[data-density="compact"] .panel{padding:var(--gm-space-4)!important}',
  'html[data-density="comfortable"] .panel{padding:var(--gm-space-5)!important}'
])assert(!design.includes(outdated),`obsolete density override remains: ${outdated}`);
assert(!design.includes('.panel{padding:16px!important}\n  html[data-density="comfortable"] .panel'),'duplicated mobile density block remains');
for(const d of ['comfortable','compact'])assert(tokens.includes('html[data-density="'+d+'"]'),'density options missing');
assert(markup.includes('class="settings-trigger"')&&markup.includes('data-action="open-settings"'),'settings button must remain functional');
assert(markup.includes('id="scholarshipStats"')&&markup.includes('id="scholarshipList"'),'scholarship data endpoints retained');
assert(scholarship.includes('scholarship-action-row')&&scholarship.includes('openScholarshipInfo'),'scholarship click action retained');
assert(scholarship.includes('<span class="main">')&&scholarship.includes('<span class="badge${cls}">'),'scholarship grid items retained');
console.log('OK: single design source, mobile readability, scholarship actions, home density and settings');
