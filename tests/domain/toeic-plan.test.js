'use strict';
const assert=require('assert');
const ToeicPlanDomain=require('../../js/domain/toeic-plan.js');
const ExecutionDomain=require('../../js/domain/execution.js');
const StudyLogDomain=require('../../js/domain/study-logs.js');

const tasks=[
 {id:'g3',name:'語言能力準備',level:1,parent:null,status:'未開始',weeklyMinutes:0,start:'',due:'',progress:0},
 {id:'g3-2',name:'TOEIC 題型能力建立',level:2,parent:'g3',status:'進行中',weeklyMinutes:0,start:'',due:'',progress:20},
 {id:'g3-2-2',name:'閱讀題型訓練 Part 5–7',level:3,parent:'g3-2',status:'進行中',weeklyMinutes:0,start:'2026-09-28',due:'2026-10-25',progress:10},
 {id:'g3-2-2-2',name:'Part 7 閱讀理解',level:4,parent:'g3-2-2',status:'進行中',weeklyMinutes:90,start:'',due:'',progress:10}
];

const first=ToeicPlanDomain.apply(tasks);
assert.strictEqual(first.applied,true);
assert.deepStrictEqual(first.weeklyTargets.map(x=>x.minutes),[100,120,150]);
assert.strictEqual(tasks.find(x=>x.id==='g3-2').status,'已封存');
assert.strictEqual(ToeicPlanDomain.apply(tasks).applied,false);
assert.strictEqual(ToeicPlanDomain.targetTaskId('2026-10-03','article'),'g3-2026-10-article');
assert.strictEqual(ToeicPlanDomain.targetTaskId('2026-11-10','review'),'g3-2026-11-review');
assert.strictEqual(ToeicPlanDomain.targetTaskId('2026-12-05','mock'),'g3-2026-12-mock');
assert.strictEqual(ToeicPlanDomain.targetTaskId('2026-12-05','article'),'g3-2026-12-practice');
assert.strictEqual(ToeicPlanDomain.targetTaskId('2026-12-20','practice'),null);

const oct=tasks.find(x=>x.id==='g3-2026-10');
const article=tasks.find(x=>x.id==='g3-2026-10-article');
const review=tasks.find(x=>x.id==='g3-2026-10-review');
const practice=tasks.find(x=>x.id==='g3-2026-10-practice');
assert.strictEqual(ToeicPlanDomain.aggregateProgress(tasks,oct,[
 {task:article,progress:50},{task:review,progress:100},{task:practice,progress:0}
],()=>1),50);

const historical=[{id:'legacy-reading',taskId:'g3-2-2-2',name:'Part 7 閱讀理解',time:'2026-10-03T12:00:00+08:00',minutes:20,actual:true,source:'news-toeic-github',sourceEventId:'toeic-github-legacy-1',sourceArticleId:'lesson-1'}];
const aliases=ToeicPlanDomain.progressAliases(tasks,historical);
assert.strictEqual(aliases.length,1);
assert.strictEqual(aliases[0].taskId,'g3-2026-10-article');
assert.strictEqual(StudyLogDomain.isCountableActualLog(aliases[0]),false);
assert.strictEqual(ExecutionDomain.currentWeekSummary(tasks,[...historical,...aliases],article,'2026-10-03').actual,20);
console.log('OK: TOEIC integrated plan migration, routing, historical carry-forward and weighted progress');
