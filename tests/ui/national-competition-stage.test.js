'use strict';
/* Presentation-only contract: data remains untouched, final is explicitly flagged. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const repo = path.resolve(__dirname, '../..');
const activity = fs.readFileSync(path.join(repo, 'js/activity.js'), 'utf8');
const settings = fs.readFileSync(path.join(repo, 'js/autofetch-status.js'), 'utf8');

assert(activity.includes('const finalBadge=a.finalAttendanceRequired===true'));
assert(activity.includes('決賽需到場'));
assert(activity.includes('${finalBadge}<span class="activity-chip">${esc(f.timeState)}'));
assert(settings.includes('全國未收錄主因'));
assert(settings.includes('nationalExpansionReviewReasons'));
assert(settings.includes('線上初賽／實體決賽'));
// A normal cached event with no final flag must NOT display the final badge.
const fixture = {
  id:'auto-youthfirst-99881', title:'2026全國青年公共政策競賽',
  date:'2026-11-25', dateKind:'application_deadline',kind:'event',
  deadline:'2026-11-25', url:'https://youthfirst.yda.gov.tw/index.php/subject/content/99881',
  location:'線上初賽／投稿；決賽需到場（臺北市）', finalAttendanceRequired:true,finalLocation:'臺北市',
  fit:{score:76,tier:'高適配',circleLevel:4,circleLabel:'全國',
       reasons:[],goalMatches:[],timeState:'可報名'},
  type:'法律／學術'
};
// This is a detached VM, not a real browser. The optional Goal Filter is absent.
// Model a valid document interface and an empty goal collection without
// mutating or mocking any of the app's production functions.
const scope={window:{},document:{readyState:'loading',addEventListener(){},getElementById(){return null}},setTimeout(){},
  db:{activities:[],tasks:[]},RadarPolicy:require('../../js/domain/radar-policy.js'),
  todayKey:()=> '2026-10-16', esc:x=>String(x||''), safeExternalUrl:u=>u};
vm.createContext(scope);
vm.runInContext(activity,scope,{filename:'activity.js'});
scope.fixture=fixture;
const rendered=vm.runInContext("activityCardHTML(fixture,'2026-10-16')",scope);
assert(rendered.includes('決賽需到場 · 臺北市'));
assert(rendered.includes('徵件截止 2026-11-25'));
assert(!rendered.includes('決賽需到場 · 南投縣'));
scope.fixture={...fixture,finalAttendanceRequired:false,finalLocation:''};
const normal=vm.runInContext("activityCardHTML(fixture,'2026-10-16')",scope);
assert(!normal.includes('決賽需到場 · 臺北市'));
console.log('PASS: verified hybrid competition final warning and preserved deadline meaning');
