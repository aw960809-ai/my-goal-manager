'use strict';
/* Mobile full-width UI contract. No real data, DOM mutation or network calls. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const sheet = read('css/mobile-fullbleed.css');
const html = read('index.html');
const sw = read('sw.js');
const version = read('config/version.js');
const refinements = read('js/refinements.js');

assert(version.includes("GOAL_MANAGER_VERSION='98.13.3'"));
assert(version.includes('GOAL_MANAGER_SCHEMA_VERSION=6'));
assert(html.includes('id="weekEngagedActionCount"'));
assert(html.includes('本週投入行動'));
assert(html.indexOf('./css/refinements.css') < html.indexOf('./css/mobile-fullbleed.css'));
assert(html.indexOf('./css/mobile-fullbleed.css') < html.indexOf('</head>'));
assert(sw.includes("'./css/mobile-fullbleed.css'"));

assert(sheet.startsWith('/* Goal Manager V98.13.3'));
assert(sheet.includes('@media (max-width: 700px)'));
assert.strictEqual((sheet.match(/@media/g) || []).length, 1);
assert(!/@import|url\(/.test(sheet));

const mandatory = [
  '.app', '.app > .view', '.app > .view > .panel',
  '#dash .home-metrics', '#stats .stats-kpi.cards',
  '#dash .home-grid-two', '#stats .stats-grid',
  '#goals > #goalBrowsePanel', '#activity > .panel',
  '#scholarship > .panel', '#today > .compact-execution-panel',
  '#today #todayList > .listitem', '#today #todayList .today-actions',
  '#calendar .calendar-shell', '.bottom-nav'
];
mandatory.forEach(selector => {
  assert(sheet.includes(selector), `Missing full-width target: ${selector}`);
});
assert(sheet.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
assert(sheet.includes('padding: 14px var(--gm-mobile-inline) !important;'));
assert(sheet.includes('env(safe-area-inset-bottom)'));
assert(sheet.includes('env(safe-area-inset-left)'));
assert(sheet.includes('env(safe-area-inset-right)'));
assert(sheet.includes('max-width: none !important;'));
assert(!sheet.includes('position: fixed'));
assert(!sheet.includes('body.nav-hidden'));

assert(refinements.includes('function installGoals()'));
assert(refinements.includes('function installActivityCompression()'));
assert(!sheet.includes('db.logs') && !sheet.includes('db.tasks'));
assert(read('js/app.js').includes("const KEY='lawLangGoalSystemV92'"));
console.log('OK: V98.13.3 edge-to-edge phone surfaces, safe insets, calendar/nav, execution full-title, original schema and KPI');
