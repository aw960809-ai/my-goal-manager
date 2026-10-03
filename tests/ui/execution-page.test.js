const assert=require('assert');
const ExecutionPage=require('../../js/ui/pages/execution-page.js');

const queue=ExecutionPage.plannedQueueHTML({
  plans:[{
    id:'p1',
    taskId:'t1',
    name:'行政法',
    date:'2026-10-03',
    time:'19:00',
    minutes:60
  }],
  today:'2026-10-03',
  esc:x=>String(x),
  getTask:()=>null
});

assert(queue.includes('行政法'));
assert(queue.includes('今日'));
assert(queue.includes("openTodayExecution('t1','p1')"));

const today=ExecutionPage.todayListHTML({
  items:[{id:'t1',name:'行政法'}],
  totalCount:6,
  expanded:false,
  timer:{id:'t1'},
  currentWeekSummary:()=>({
    actual:30,
    target:120,
    remaining:90
  }),
  executionPlans:[],
  activeExecutionPlan:()=>true,
  today:'2026-10-03',
  ancestors:()=>[],
  esc:x=>String(x),
  calc:()=>25
});

assert(today.includes('today-item-selected'));
assert(today.includes('本週 30/120 分'));
assert(today.includes('25%'));
assert(today.includes('顯示全部（6 項）'));

console.log('OK: ExecutionPage queue and today-list rendering');
