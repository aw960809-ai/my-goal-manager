'use strict';
const assert=require('node:assert/strict');
const Dashboard=require('../../js/ui/pages/dashboard-page.js');
const Execution=require('../../js/ui/pages/execution-page.js');
const Goals=require('../../js/ui/pages/goals-page.js');
const esc=x=>String(x);
const task={id:'g3-2026-10-review',level:4,name:'錯題鞏固',progressMetric:'questions'};
const week={active:true,target:0,actual:11,remaining:0,outcome:{
 kind:'review',done:12,target:15,remaining:3,accuracy:67,masteredThisWeek:1,
 reviewCorrect:2,reviewAnswered:3,evidenceMissing:8,queue:{due:0,mastered:0}}};
const deps={currentWeekSummary:()=>week,ancestors:()=>[{id:'root',name:'階段'},task],
 calc:()=>16,esc};
const html=Dashboard.executeListHTML([task],deps);
for(const expected of ['本週 12/15 題','重測 67%','新掌握 1','到期 0','待證 8','去練習'])
 assert(html.includes(expected),`Missing compact outcome metric: ${expected}`);
assert(!html.includes('目前到期 1'));
const timed=Dashboard.executeListHTML([{id:'law',name:'刑法'}],{...deps,
 currentWeekSummary:()=>({actual:40,target:60,remaining:20,outcome:null})});
assert(timed.includes('本週 40/60 分'));
const exec=Execution.todayItemHTML({task,timer:{},currentWeekSummary:()=>week,
 ancestors:()=>[],esc,calc:()=>16});
assert(exec.includes('重測 67%'));
const meta=Goals.browseMeta(task,{kids:()=>[],periodLabel:()=>'',
 executionSummary:()=>({weeklyActual:11,outcome:week.outcome}),calc:()=>16,
 levelLabels:{1:'方向',2:'階段',3:'子任務',4:'具體行動'}});
assert(meta.includes('重測 67%'));
console.log('PASS V7.6 UI: review quality is due-only, dashboard compact; time-based tasks unchanged');
