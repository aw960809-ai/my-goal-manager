'use strict';

const assert=require('assert');
const AnalyticsDomain=require('../../js/domain/analytics.js');
const fixture=require('../fixtures/canonical-db.js');

const leaves=AnalyticsDomain.analysisValidLeafTasks(fixture.tasks);
assert.deepStrictEqual(leaves.map(x=>x.id),['action']);

const week=AnalyticsDomain.weeklyStudySummary({
  tasks:fixture.tasks,
  logs:fixture.logs,
  date:fixture.anchorDate
});

assert.strictEqual(week.target,420);
assert.strictEqual(week.goalActualMinutes,90);
assert.strictEqual(week.otherStudyMinutes,40);
assert.strictEqual(week.totalStudyMinutes,130);
assert.strictEqual(week.remaining,330);
assert.strictEqual(week.ratio,21);

const analysis=AnalyticsDomain.executionAnalysis({
  tasks:fixture.tasks,
  logs:fixture.logs,
  plans:fixture.executionPlans,
  timer:{running:false,planId:null,elapsed:0,start:0},
  date:fixture.anchorDate,
  nowMs:Date.parse('2026-10-01T22:00:00+08:00')
});

assert.strictEqual(analysis.plannedMinutes,120);
assert.strictEqual(analysis.actualMinutes,90);
assert.strictEqual(analysis.otherStudyMinutes,40);
assert.strictEqual(analysis.totalStudyMinutes,130);
assert.strictEqual(analysis.planActualMinutes,0);
assert.strictEqual(analysis.unplannedActualMinutes,90);
assert.strictEqual(analysis.cancelledPlans.length,0);

console.log('OK: AnalyticsDomain weekly and plan-vs-actual aggregation');
