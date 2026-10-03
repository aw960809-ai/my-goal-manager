const assert=require('assert');
const fs=require('fs');
const path=require('path');
const AnalyticsPage=require('../../js/ui/pages/analytics-page.js');

function element(){
  return {textContent:'',innerHTML:'',style:{}};
}

const ids=[
  'leafDone','avg','est','logsN',
  'statsWeekRatio','statsWeekBar',
  'statsActual','statsOtherStudy',
  'statsTotalStudy','statsTarget',
  'statsRemaining','domains',
  'progressDistribution'
];

const elements=Object.fromEntries(ids.map(id=>[id,element()]));
const document={getElementById:id=>elements[id]||null};

AnalyticsPage.renderStats({
  document,
  leaves:[],
  done:0,
  avg:0,
  planAnalysis:{plannedMinutes:0},
  week:{
    ratio:0,
    goalActualMinutes:0,
    otherStudyMinutes:0,
    totalStudyMinutes:0,
    target:0,
    remaining:0
  },
  rootsActive:[],
  currentWeekTargetForRoot:()=>0,
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
  planAnalysis:{plannedMinutes:120},
  week:{
    ratio:50,
    goalActualMinutes:60,
    otherStudyMinutes:30,
    totalStudyMinutes:90,
    target:120,
    remaining:60
  },
  rootsActive:[{id:'root',name:'台大及政大轉學考'}],
  currentWeekTargetForRoot:()=>120,
  actualLogCount:2,
  esc:x=>String(x),
  calc:()=>25
});

assert(elements.domains.innerHTML.includes('台大及政大轉學考'));
assert(elements.progressDistribution.innerHTML.includes('1 個具體行動'));

const app=fs.readFileSync(
  path.join(__dirname,'../../js/app.js'),
  'utf8'
);

assert(app.includes("if(id==='stats')stats();"));
assert(app.includes("if(id==='today'){today();renderTimerState();}"));

console.log('OK: analytics renders empty/data states and view routing refreshes page');
