const assert=require('assert');
const fs=require('fs');
const path=require('path');
const AnalyticsPage=require('../../js/ui/pages/analytics-page.js');

function element(){
  return {textContent:'',innerHTML:'',style:{}};
}

const ids=[
  'leafDone','avg','weekCreditedKpi','logsN',
  'statsWeekRatio','statsWeekBar',
  'statsActual','statsCredited','statsOverrun',
  'statsOtherStudy','statsTotalStudy','statsTarget',
  'statsRemaining','domains','progressDistribution'
];

const elements=Object.fromEntries(ids.map(id=>[id,element()]));
const document={getElementById:id=>elements[id]||null};

AnalyticsPage.renderStats({
  document,
  leaves:[],
  done:0,
  avg:0,
  week:{
    ratio:0,
    goalActualMinutes:0,
    creditedGoalMinutes:0,
    overrunGoalMinutes:0,
    otherStudyMinutes:0,
    totalStudyMinutes:0,
    target:0,
    remaining:0
  },
  directionRows:[],
  actualLogCount:0,
  esc:x=>String(x),
  calc:()=>0
});

assert.strictEqual(elements.leafDone.textContent,'0/0');
assert.strictEqual(elements.avg.textContent,'0%');
assert.strictEqual(elements.statsWeekRatio.textContent,'0%');
assert.strictEqual(elements.statsWeekBar.style.width,'0%');
assert(elements.domains.innerHTML.includes('尚無有效方向'));
assert(elements.progressDistribution.innerHTML.includes('尚未開始'));

AnalyticsPage.renderStats({
  document,
  leaves:[{id:'task-1',name:'行政法',level:4,status:'進行中'}],
  done:0,
  avg:25,
  week:{
    ratio:50,
    goalActualMinutes:80,
    creditedGoalMinutes:60,
    overrunGoalMinutes:20,
    otherStudyMinutes:30,
    totalStudyMinutes:110,
    target:120,
    remaining:60
  },
  directionRows:[{
    rootId:'root',
    name:'台大及政大轉學考',
    target:120,
    actual:80,
    credited:60,
    overrun:20,
    remaining:60,
    ratio:50
  }],
  actualLogCount:2,
  esc:x=>String(x),
  calc:()=>25
});

assert(elements.domains.innerHTML.includes('台大及政大轉學考'));
assert(elements.domains.innerHTML.includes('實際 80 分'));
assert(elements.domains.innerHTML.includes('有效 60 分'));
assert(elements.domains.innerHTML.includes('超時 20 分'));
assert(elements.domains.innerHTML.includes('目標 120 分'));
assert(elements.progressDistribution.innerHTML.includes('1 個具體行動'));

const app=fs.readFileSync(
  path.join(__dirname,'../../js/app.js'),
  'utf8'
);

assert(app.includes("if(id==='stats')stats();"));
assert(app.includes("if(id==='today'){today();renderTimerState();}"));
assert(!app.includes('saveExecutionPlan'));
assert(!app.includes('findActivePlanForDate'));

assert(app.includes('function addGoalStudyLog()'));
assert(app.includes("source:'manual-backfill'"));
assert(app.includes('kind:STUDY_LOG_KIND.GOAL'));
assert(app.includes("if(date>todayKey())"));
assert(app.includes('date<p.start||date>p.due'));
assert(!app.includes("source:'manual-backfill',planId"));

assert(app.includes('function goalStudyBackfillTasks(date=todayKey())'));
assert(app.includes('day>=p.start&&day<=p.due'));
assert(app.includes('function goalStudyBackfillLabel(t)'));
assert(app.includes('parent?`${parent.name} › ${t.name}`'));
assert(app.includes('沒有有效具體實現'));

assert(app.includes('function startFreeStudyTimer()'));
assert(app.includes("TimerService.selectOther(name)"));
assert(app.includes("document.getElementById('freeStudyName')"));
assert(!app.includes('function selectOtherStudyTimer()'));

console.log('OK: analytics renders direct-execution weekly/direction states and routing refreshes pages');
