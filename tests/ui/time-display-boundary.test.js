const assert=require('assert');
const TimeFormat=require('../../js/ui/time-format.js');
const DashboardPage=require('../../js/ui/pages/dashboard-page.js');
const ExecutionPage=require('../../js/ui/pages/execution-page.js');
const AnalyticsPage=require('../../js/ui/pages/analytics-page.js');
const GoalsPage=require('../../js/ui/pages/goals-page.js');

assert.strictEqual(TimeFormat.minutes(97.0111),97);
assert.strictEqual(TimeFormat.hoursLabel(1030),'17.2h');
assert.strictEqual(TimeFormat.human(97.0111),'1 小時 37 分');
assert.strictEqual(TimeFormat.shortEnglish(90),'1h 30m');

const nodes={
  dOverall:{textContent:''},
  dToday:{textContent:''},
  dRun:{textContent:''},
  dMin:{textContent:''},
  dTodayMin:{textContent:''},
  homeDateLabel:{textContent:''},
  directions:{innerHTML:''},
  mainGoalCount:{textContent:''},
  deadlines:{innerHTML:''}
};

DashboardPage.renderDashboard({
  document:{getElementById:id=>nodes[id]||null},
  overall:2,
  todayItemCount:11,
  weeklyTargetMinutes:1030,
  weekActualMinutes:97.0111,
  todayActualMinutes:97.0111,
  date:new Date('2026-10-05T21:46:00+08:00'),
  roots:[],
  selected:null,
  calc:()=>0,
  kids:()=>[],
  deadlines:[],
  esc:x=>String(x)
});

assert.strictEqual(nodes.dRun.textContent,'17.2h');
assert.strictEqual(nodes.dMin.textContent,97);
assert.strictEqual(nodes.dTodayMin.textContent,97);

const execution=ExecutionPage.todayItemHTML({
  task:{id:'t1',name:'行政法'},
  timer:{id:null},
  currentWeekSummary:()=>({
    actual:97.0111,
    credited:97.0111,
    overrun:0,
    target:120,
    remaining:22.9889
  }),
  ancestors:()=>[],
  esc:x=>String(x),
  calc:()=>50
});
assert(execution.includes('本週 97/120 分'));
assert(execution.includes('有效 97 分'));
assert(execution.includes('剩餘 23 分'));
assert(!execution.includes('97.0111'));

const goalMeta=GoalsPage.browseMeta(
  {id:'t1',level:4,status:'進行中'},
  {
    kids:()=>[],
    periodLabel:()=> '2026-10-01 ～ 2026-10-31',
    executionSummary:()=>({
      weeklyActual:97.0111,
      weeklyTarget:120,
      weeklyRemaining:22.9889
    }),
    calc:()=>50,
    levelLabels:{4:'具體行動'}
  }
);
assert(goalMeta.includes('本週 97/120 分'));
assert(goalMeta.includes('剩餘 23 分'));
assert(!goalMeta.includes('97.0111'));

const recent=AnalyticsPage.recentActualLogsHTML(
  [{id:'l1',taskId:'t1',name:'行政法',time:'2026-10-05T20:00:00+08:00',minutes:97.0111}],
  {esc:x=>String(x),getTask:()=>null,isOtherStudyLog:()=>false}
);
assert(recent.includes('97 分'));
assert(!recent.includes('97.0111'));

console.log('OK: time display boundary rounds legacy fractional minutes consistently');
