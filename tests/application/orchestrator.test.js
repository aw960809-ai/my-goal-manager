const assert=require('assert');
const AppOrchestrator=require('../../js/application/orchestrator.js');

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

const calls=[];
const steps={};
names.forEach(name=>{steps[name]=()=>calls.push(name)});

const result=AppOrchestrator.renderAll(steps);

assert.deepStrictEqual(calls,names);
assert.deepStrictEqual(result.order,names);
assert.deepStrictEqual(result.errors,[]);
assert.strictEqual(result.ok,true);

const isolatedCalls=[];
const isolatedErrors=[];
const isolatedSteps={};

names.forEach(name=>{
  isolatedSteps[name]=()=>{
    isolatedCalls.push(name);
    if(name==='renderActivities'){
      throw new Error('activity renderer failed');
    }
  };
});

const isolated=AppOrchestrator.renderAll(
  isolatedSteps,
  {onError:entry=>isolatedErrors.push(entry)}
);

assert.strictEqual(isolated.ok,false);
assert.strictEqual(isolated.errors.length,1);
assert.strictEqual(isolated.errors[0].name,'renderActivities');
assert.strictEqual(isolatedErrors.length,1);
assert(
  isolatedCalls.includes('stats'),
  'analytics must still run after an earlier renderer fails'
);

console.log('OK: AppOrchestrator preserves order and isolates renderer failures');
