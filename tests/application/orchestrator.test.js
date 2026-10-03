const assert=require('assert');
const AppOrchestrator=require('../../js/application/orchestrator.js');

const calls=[];
const names=[
  'normalizeState',
  'rebuildExecutionPlanActuals',
  'removeLegacyStandaloneToeicGoals',
  'ensureActivities',
  'ensureToeicPlan',
  'recalcAllStatuses',
  'renderGoalsPage',
  'dashboard',
  'today',
  'renderTimerState',
  'renderActivities',
  'renderScholarships',
  'renderCalendar',
  'stats',
  'bindInteractionFeedback',
  'bindActivitySearch'
];

const steps={};
names.forEach(name=>{
  steps[name]=()=>calls.push(name);
});

const order=AppOrchestrator.renderAll(steps);

assert.deepStrictEqual(calls,names);
assert.deepStrictEqual(order,names);

console.log('OK: AppOrchestrator preserves render pipeline order');
