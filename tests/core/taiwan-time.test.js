'use strict';
const assert=require('assert');
const TaiwanTime=require('../../js/core/taiwan-time.js');
const StudyLogDomain=require('../../js/domain/study-logs.js');
const TimeFormat=require('../../js/ui/time-format.js');
const AnalyticsPage=require('../../js/ui/pages/analytics-page.js');

const before='2026-10-07T13:25:00.000Z';
const across='2026-10-07T16:20:00.000Z';
const sameInstant='2026-10-07T21:25:00+08:00';
const record={id:'immutable',time:before,minutes:59,kind:'goal-study',actual:true};
const original=JSON.stringify(record);

assert.strictEqual(TaiwanTime.zone,'Asia/Taipei');
assert.strictEqual(TaiwanTime.dateKey(before),'2026-10-07');
assert.strictEqual(TaiwanTime.clock(before),'21:25');
assert.strictEqual(TaiwanTime.dateTimeLabel(before),'2026-10-07 · 21:25');
assert.strictEqual(TaiwanTime.dateTimeLabel(sameInstant),'2026-10-07 · 21:25');
assert.strictEqual(TaiwanTime.timestamp(before),TaiwanTime.timestamp(sameInstant));
assert.strictEqual(TaiwanTime.dateKey(across),'2026-10-08');
assert.strictEqual(TaiwanTime.clock(across),'00:20');
assert.strictEqual(TaiwanTime.dateKey('2026-10-07T15:59:00Z'),'2026-10-07');
assert.strictEqual(TaiwanTime.dateKey('2026-10-07'),'2026-10-07');
assert.strictEqual(TaiwanTime.dateTimeLabel('2026-10-07'),'2026-10-07');
assert.strictEqual(TaiwanTime.dateTimeLabel('2026-10-07 21:25'),'2026-10-07 · 21:25');
assert.strictEqual(TaiwanTime.dateTimeLabel('2026-10-07T21:25:00'),'2026-10-07 · 21:25');
assert.strictEqual(TaiwanTime.dateKey('2026-02-31T21:25:00'),'');
assert.strictEqual(TaiwanTime.dateKey('not-a-time'),'');
assert(Number.isNaN(TaiwanTime.timestamp('')));

assert.strictEqual(StudyLogDomain.logDate(before),'2026-10-07');
assert.strictEqual(StudyLogDomain.logDate(across),'2026-10-08');
assert.strictEqual(AnalyticsPage.actualHistoryDateKey({time:across}),'2026-10-08');
assert.strictEqual(AnalyticsPage.actualHistoryTimeLabel({time:before}),'2026-10-07 · 21:25');
assert.strictEqual(AnalyticsPage.actualHistoryClockLabel({time:across}),'00:20');
assert.strictEqual(TimeFormat.dateKey(across),StudyLogDomain.logDate(across));

const logs=[record,{id:'next',time:across,minutes:30,kind:'goal-study',actual:true}];
const html=AnalyticsPage.actualHistoryBodyHTML({
  filtered:logs,totalMinutes:89,taskRows:[],range:'all',taskFilter:'all',
  esc:x=>String(x),getTask:()=>null,isOtherStudyLog:()=>false,currentYear:2026
});
assert(html.includes('10 月 7 日・週三'));
assert(html.includes('10 月 8 日・週四'));
assert(html.includes('21:25 · 59 分'));
assert(html.includes('00:20 · 30 分'));
assert.strictEqual((html.match(/class="actual-history-day"/g)||[]).length,2);
assert.strictEqual(StudyLogDomain.totalStudyMinutesInRange(logs,'2026-10-07','2026-10-07'),59);
assert.strictEqual(StudyLogDomain.totalStudyMinutesInRange(logs,'2026-10-08','2026-10-08'),30);
assert.strictEqual(JSON.stringify(record),original,'timestamp must not be rewritten by UI or aggregation');
assert.strictEqual(TimeFormat.human(59),'59 分','minute calculations and display must be unchanged');

console.log('OK: Asia/Taipei time, cross-midnight grouping, analytics alignment, immutable history');
