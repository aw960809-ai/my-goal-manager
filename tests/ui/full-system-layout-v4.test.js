/* Full-suite UI V4: verify coverage, responsive/offline boundaries and original data code. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const css=read('css/ui-layout-v4.css'),html=read('index.html'),sw=read('sw.js');
assert(css.includes('UI-LAYOUT-V4'));
for(const id of ['dash','goals','activity','scholarship','calendar','today','stats']){
  assert(html.includes(`id="${id}"`),`missing original page ${id}`);
  assert(css.includes('#'+id),`missing V4 page coverage ${id}`);
}
assert(html.indexOf('./css/ui-layout-v4.css')>html.indexOf('./css/mobile-fullbleed.css'));
assert(html.indexOf('./css/ui-layout-v4.css')<html.indexOf('</head>'));
assert(sw.includes("'./css/ui-layout-v4.css'"),'offline CSS asset missing');
assert(css.includes('@media(max-width:700px)'));
assert(css.includes('min-height:var(--ux-control-height)'));
assert(css.includes('#calendar .calendar-detail'));
assert(css.includes('#settingsModal .settings-box'));
assert(css.includes('env(safe-area-inset-left)'));
assert(!css.includes('display:none!important'),'no hidden functional UI');
assert(!/@import|url\(/.test(css),'no external fonts/media');
assert(!/localStorage|indexedDB|fetch\(/.test(css),'style cannot access data');
assert(read('js/app.js').includes("const KEY='lawLangGoalSystemV92'"));
assert(read('js/toeic-sync-runtime.js').includes('GoalToeicSyncRuntime'));
console.log('PASS: seven goal modules, full-bleed/safe-area, offline CSS, no data or navigation changes');
