'use strict';
/* Official visual integration contract: synthetic/static only, no user data. */
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'../..');
const read=src=>fs.readFileSync(path.join(root,src),'utf8');
const html=read('index.html');
const js=read('js/refinements.js');
const css=read('css/refinements.css');
const sw=read('sw.js');
const version=read('config/version.js');

assert(version.includes("GOAL_MANAGER_VERSION='98.13.4'"));
assert(version.includes('GOAL_MANAGER_SCHEMA_VERSION=6'));
assert(html.includes('id="weekEngagedActionCount"'));
assert(html.includes('本週投入行動'),'The existing V98.13.1 KPI must remain');
assert(!html.includes('id="leafDone"'));
assert(html.includes('./css/refinements.css'));
assert(html.includes('./js/refinements.js'));
assert(html.indexOf('./css/calendar.css')<html.indexOf('./css/refinements.css'));
assert(html.indexOf('./js/bootstrap.js')<html.indexOf('./js/refinements.js'));
assert(sw.includes("'./css/refinements.css'"));
assert(sw.includes("'./js/refinements.js'"));

for(const keyword of [
  'function installGoals()',
  'function installUnifiedGoalSearch()',
  'function installActivityCompression()',
  'function installRadarAdvancedFilters()',
  'function installRadarSourceDisclosure()',
  'function installScholarshipPolicyDisclosure()',
  'function installScholarshipStatPresentation()',
  'function installExecutionReadingOrder()',
  'function installAnalyticsMetricHierarchy()',
  'function installAnalyticsDeletedLogDisclosure()',
  'function installSettingsCleanup()'
])assert(js.includes(keyword),`Missing refined UX feature: ${keyword}`);

for(const selector of [
  '#goals .gm-goal-toolbar',
  '#activity .activity-card',
  '#activity .gm-radar-advanced',
  '#scholarship .gm-scholarship-policy',
  '#stats .gm-stats-primary-metrics',
  '#today .other-study-disclosure'
])assert(css.includes(selector),`Missing refined styles: ${selector}`);
for(const forbidden of [
  '__GOAL_MANAGER_STAGING__',
  'installWeeklyEngagedKpi',
  'localStorage.', 'sessionStorage.', 'indexedDB.',
  'persistEnvelope(', 'db.logs.push(', 'db.tasks.push('
])assert(!js.includes(forbidden),`Unexpected staging/storage logic: ${forbidden}`);
assert(js.includes("window.addEventListener('load',start,{once:true})"));
assert(css.includes('-webkit-tap-highlight-color:transparent'));
assert(!/@import|url\(/.test(css),'Remote CSS asset injection is disallowed');
vm.runInNewContext(js,{window:{},document:{getElementById:()=>null}},
                   {filename:'js/refinements.js'});
assert(read('js/app.js').includes("const KEY='lawLangGoalSystemV92'"));
console.log('OK: V98.13.4 refinements loaded after bootstrap; original KPI, store and UI boundaries preserved');
