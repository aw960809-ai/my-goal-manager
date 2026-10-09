'use strict';
/* Android accordion-feedback + weekly KPI-label regression, static only. */
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const sheet=read('css/refinements.css');
const html=read('index.html');
const sw=read('sw.js');
const version=read('config/version.js');
const settings=read('js/settings.js');
const refinements=read('js/refinements.js');
const app=read('js/app.js');
const analytics=read('js/domain/analytics.js');

assert(version.includes("GOAL_MANAGER_VERSION='98.13.4'"));
assert(version.includes('GOAL_MANAGER_SCHEMA_VERSION=6'));
assert(sw.includes("importScripts('./config/version.js')"));
assert(sw.includes("'./css/refinements.css'"));
assert(html.includes('<small>本週待完成</small><b id="dToday">'));
assert(!html.includes('<small>本週待辦</small>'));
assert(html.includes('id="weekEngagedActionCount"'));
assert(html.includes('本週投入行動'));
assert(app.includes('function getTodayItems()'));
assert(app.includes('w.active&&w.remaining>0'));
assert(analytics.includes('function weeklyEngagedActionCount('));
assert(analytics.includes('engaged.add(id)'));

assert(settings.includes('class="settings-hub-summary"'));
assert(settings.includes("settingsPanelMarkup('appearance'"));
assert(settings.includes("settingsPanelMarkup('health'"));
assert(refinements.includes("wrap.className='gm-radar-source-details'"));
assert(refinements.includes("'來源需注意 · '"));
const marker='/* GM-V98.13.4: prevent Android native blue touch highlight on accordions.';
assert.strictEqual(sheet.split(marker).length-1,1);
const hotfix=sheet.slice(sheet.indexOf(marker));
for(const selector of [
  '#activity .gm-radar-source-details > summary',
  '#settingsBody .settings-hub-panel > summary.settings-hub-summary',
  '#activity .gm-radar-advanced > summary',
  '#settingsBody .settings-hub-advanced > summary'
]){
  assert(hotfix.includes(selector),`Missing summary selector: ${selector}`);
}
assert(hotfix.includes('-webkit-tap-highlight-color: transparent !important;'));
assert(hotfix.includes('-webkit-user-select: none !important;'));
assert(hotfix.includes('touch-action: manipulation;'));
assert(hotfix.includes(':focus:not(:focus-visible)'));
assert(hotfix.includes(':focus-visible'));
assert(hotfix.includes('var(--gm-focus'));
assert(!hotfix.includes('999px'));
assert(!hotfix.includes('transition: none'));
assert(!hotfix.includes('display: none'));
assert(!hotfix.includes('localStorage') && !hotfix.includes('db.logs'));
console.log('OK: Android source/settings accordions suppress native tap artifacts, accessible focus, weekly metrics remain distinct');
