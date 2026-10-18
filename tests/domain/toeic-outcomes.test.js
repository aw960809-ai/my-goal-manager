'use strict';
const assert=require('node:assert/strict');
const D=require('../../js/domain/toeic-outcomes.js');
const Normalize=require('../../js/data/normalization.js');
const Execute=require('../../js/domain/execution.js');
const Plan=require('../../js/domain/toeic-plan.js');
const tasks=[];
Plan.apply(tasks);
const oldIDs=tasks.map(x=>x.id).join('|');
const m=D.migrate(tasks);
assert.equal(m.leaves,6);
assert.equal(tasks.map(x=>x.id).join('|'),oldIDs);
assert.equal(D.migrate(tasks).changed,false);
const act=tasks.find(x=>x.id==='g3-2026-10-practice');
const review=tasks.find(x=>x.id==='g3-2026-10-review');
const article=tasks.find(x=>x.id==='g3-2026-10-article');
assert.equal(act.name,'題目練習與訂正');
assert.equal(review.name,'錯題鞏固');
assert.equal(article.progressMetric,undefined);
assert.equal(act.weeklyTargetCount,20);
assert.equal(tasks.find(x=>x.id===D.RULES['g3-2026-10-review'].parent).level,3);
assert.equal(Normalize.normalizeTask({...review}).progressMetric,'questions');
assert.equal(Normalize.normalizeTask({...review}).previousTimeProgress,0);
const consented={appId:'toeic-trainer-standalone',schema:1,sessions:[
  {appId:'toeic-trainer-standalone',schema:1,id:'tt-proof-000000001',unit:'practice',
   suggestedGoalTaskId:act.id,date:'2026-10-13',questionsAnswered:3,correct:2,
   questionIds:['q1','q2','q3']},
  {appId:'toeic-trainer-standalone',schema:1,id:'tt-proof-000000002',unit:'practice',
   suggestedGoalTaskId:act.id,date:'2026-10-15',questionsAnswered:2,correct:1,
   questionIds:['q1','q4']},
  {appId:'toeic-trainer-standalone',schema:1,id:'tt-proof-000000003',unit:'review',
   suggestedGoalTaskId:review.id,date:'2026-10-15',questionsAnswered:2,correct:1,
   questionIds:['bad1','variant1'],reviewDueIds:['bad1'],reviewCorrectIds:['bad1']}
]};
const logs=consented.sessions.map(e=>({id:'toeic-sync-'+e.id,source:'toeic-trainer-v05',
  sourceEventId:e.id,sourceLearningUnit:e.unit,sourceAnswered:e.questionsAnswered,
  sourceCorrect:e.correct,taskId:e.suggestedGoalTaskId,actual:true,
  minutes:2,time:e.date+'T08:00:00+08:00'}));
logs.push({id:'timer-1',taskId:act.id,actual:true,minutes:999,
  time:'2026-10-15T09:00:00+08:00'});
const s=D.summary(tasks,logs,act,'2026-10-14',consented);
assert.equal(s.done,4,'Do not double count repeated q1');
assert.equal(s.actualAnswered,5);
assert.equal(s.accuracy,60);
assert.equal(D.summary(tasks,logs,review,'2026-10-15',consented).done,1);
assert.equal(D.summary(tasks,logs,review,'2026-10-15',null).done,0);
assert.equal(D.leafProgress(tasks,logs,act,consented)>0,true);
assert.equal(D.leafProgress(tasks,logs,act,null),0,'No unverified results as progress');
assert.equal(Execute.currentWeekSummary(tasks,logs,act,'2026-10-15',consented).target,0);
assert.equal(Execute.currentWeekSummary(tasks,logs,act,'2026-10-15',consented).outcome.done,4);
assert.equal(Execute.leafProgress(tasks,logs,act,consented),D.leafProgress(tasks,logs,act,consented));
const recalc=Normalize.normalizeTasks(tasks);
assert.equal(D.migrate(recalc).changed,false,'Schema6 normalization must preserve migration');
const q=D.pendingQueue({appId:'toeic-trainer-standalone',schema:1,
 questionStats:{a:{wrong:1,dueAt:'2026-10-01'},b:{wrong:1,mastered:true},c:{wrong:1,dueAt:'2026-12-01'}},
 review:{v001:{times:3,dueAt:'2026-10-02'}}},new Date('2026-10-18T00:00:00Z'));
assert.equal(q.due,1);assert.equal(q.mastered,1);assert.equal(q.waiting,1);assert.equal(q.dueWords,1);
assert.equal(tasks.find(x=>x.id==='g3-2026-integrated').previousTimeProgress,0);
console.log('PASS result-first TOEIC goal tree: IDs/history preserved, 6 outcomes, due-only, de-dup and time isolation');
