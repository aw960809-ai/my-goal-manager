const assert=require('assert');
const GoalsPage=require('../../js/ui/pages/goals-page.js');

const task={
  id:'a',
  name:'行政法',
  level:4,
  status:'進行中'
};

const deps={
  kids:()=>[],
  periodLabel:()=> '2026-10-01 ～ 2026-10-31',
  executionSummary:()=>({
    weeklyActual:30,
    weeklyTarget:120,
    weeklyRemaining:90
  }),
  calc:()=>25,
  levelLabels:{
    1:'方向',
    2:'階段',
    3:'子任務',
    4:'具體行動'
  },
  esc:x=>String(x)
};

const card=GoalsPage.browseCard(task,deps);

assert(card.includes('行政法'));
assert(card.includes('本週 30/120 分'));
assert(card.includes('25%'));
assert(card.includes("browseGoal('a')"));

const result=GoalsPage.resultCard(task,{
  ancestors:()=>[
    {id:'root',name:'轉學考'},
    task
  ],
  calc:()=>25,
  periodLabel:()=> '2026-10-01 ～ 2026-10-31',
  levelLabels:deps.levelLabels,
  esc:x=>String(x),
  isOpen:()=>true
});

assert(result.includes('轉學考 → 行政法'));
assert(result.includes('具體行動'));

console.log('OK: GoalsPage browse and search-result rendering');


const treeNode=GoalsPage.taskNode({
  id:'root',
  name:'轉學考',
  level:1,
  status:'進行中'
},{
  calc:()=>20,
  kids:()=>[],
  isOpen:()=>true,
  isHit:()=>false,
  executionSummary:()=>null,
  executionPlans:[],
  activeExecutionPlan:()=>true,
  periodLabel:()=> '尚未設定',
  levelLabels:deps.levelLabels,
  esc:x=>String(x)
});

assert(treeNode.includes('task-root'));
assert(treeNode.includes('轉學考'));
assert(treeNode.includes('20%'));
