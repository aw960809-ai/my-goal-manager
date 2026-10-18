'use strict';
const assert=require('node:assert/strict');
const D=require('../../js/domain/toeic-outcomes.js');
const Plan=require('../../js/domain/toeic-plan.js');
function catalog(writtenIds,vocabIds=[]){
 const a=writtenIds.slice().sort(),b=vocabIds.slice().sort();
 return {source:'toeic-trainer-standalone',schema:1,version:1,kind:'active-audited-bank-ids',
   writtenIds:a,vocabIds:b,writtenCount:a.length,vocabCount:b.length,
   signature:D.catalogSignature(a,b)};
}
const active=catalog(['a','b','c'],['v001']);
const trainer={appId:'toeic-trainer-standalone',schema:1,sessions:[],questionStats:{
 a:{wrong:1,dueAt:'2026-10-01'},b:{wrong:1,dueAt:'2026-12-01'},
 c:{wrong:1,mastered:true},orphan:{wrong:1,dueAt:'2026-10-01'}
 },review:{v001:{times:2,dueAt:'2026-10-01'},lost:{times:5,dueAt:'2026-10-01'}}};
const q=D.pendingQueue(trainer,active,new Date('2026-10-18T08:00:00Z'));
assert.equal(q.due,1,'only currently answerable written items count');
assert.equal(q.waiting,1);assert.equal(q.mastered,1);assert.equal(q.dueWords,1);
assert.equal(D.pendingQueue(trainer,null),null,'missing catalog must not invent due number');
assert.equal(D.pendingQueue(trainer,{...active,signature:'corrupt'}),null);
const tasks=[];Plan.apply(tasks);D.migrate(tasks);
const task=tasks.find(x=>x.id==='g3-2026-10-review');
const make=(id,date,due,correct,mastered=[])=>({appId:'toeic-trainer-standalone',schema:1,
 id,unit:'review',suggestedGoalTaskId:task.id,date,
 questionsAnswered:3,correct:2,questionIds:['a','b','variation'],
 reviewDueIds:due,reviewCorrectIds:correct,reviewMasteredIds:mastered});
const first=make('tt-review-v76-00001','2026-10-15',['a','b'],['a'],['a']);
const second=make('tt-review-v76-00002','2026-10-16',['a'],['a']);
const older=make('tt-review-v76-00003','2026-10-16',[],[]);
const logs=[first,second,older].map(e=>({id:'toeic-sync-'+e.id,taskId:task.id,source:'toeic-trainer-v05',
  sourceEventId:e.id,sourceLearningUnit:'review',sourceAnswered:e.questionsAnswered,
  sourceCorrect:e.correct,actual:true,time:e.date+'T10:00:00+08:00'}));
const doc={...trainer,sessions:[first,second,older]};
const sum=D.summary(tasks,logs,task,'2026-10-15',doc);
assert.equal(sum.done,2,'repeat due original credited only once in weekly target');
assert.equal(sum.reviewAnswered,3,'quality based on due attempts, not all 9 exam items');
assert.equal(sum.reviewCorrect,2);
assert.equal(sum.accuracy,67,'2/3 due attempts, not 6/9 total or 2/2 unique');
assert.equal(sum.masteredThisWeek,1,'mastered needs verified review evidence');
const bad=make('tt-review-v76-00004','2026-10-16',['a'],['variation']);
const badLog={...logs[0],id:'toeic-sync-'+bad.id,sourceEventId:bad.id};
const missing=make('tt-review-v76-00005','2026-10-16',['a'],[]);
delete missing.reviewCorrectIds;
const missingLog={...logs[0],id:'toeic-sync-'+missing.id,sourceEventId:missing.id};
const untrusted=D.summary(tasks,[...logs,badLog,missingLog],task,'2026-10-15',
 {...trainer,sessions:[...doc.sessions,bad,missing]});
assert.equal(untrusted.done,2);assert.equal(untrusted.reviewAnswered,3);
assert.equal(untrusted.evidenceMissing,2);
const legacy=make('tt-review-v76-00006','2026-10-16',['a'],['a']);
delete legacy.reviewDueIds;delete legacy.reviewCorrectIds;
const legacyLog={...logs[0],id:'toeic-sync-'+legacy.id,sourceEventId:legacy.id};
const historic=D.summary(tasks,[...logs,legacyLog],task,'2026-10-15',
 {...trainer,sessions:[...doc.sessions,legacy]});
assert.equal(historic.evidenceMissing,1);
console.log('PASS V7.6: answerable due count matches Trainer; due-only accuracy, weekly mastery, evidence safety');
