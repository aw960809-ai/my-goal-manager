const assert=require('assert');
const DashboardPage=require('../../js/ui/pages/dashboard-page.js');

const execute=DashboardPage.executeListHTML([
  {id:'t1',name:'行政法'}
],{
  currentWeekSummary:()=>({
    actual:30,
    target:120,
    remaining:90
  }),
  ancestors:()=>[
    {id:'root',name:'轉學考'},
    {id:'t1',name:'行政法'}
  ],
  esc:x=>String(x),
  calc:()=>25
});

assert(execute.includes('行政法'));
assert(execute.includes('本週 30/120 分'));
assert(execute.includes("executeFromDashboard('t1')"));

const decisions=DashboardPage.decisionListHTML([{
  t:{id:'t1',name:'行政法'},
  days:5,
  state:'urgent',
  label:'接近截止',
  progress:25,
  gap:10,
  w:{remaining:90}
}],{
  esc:x=>String(x)
});

assert(decisions.includes('接近截止'));
assert(decisions.includes('5 天後'));
assert(decisions.includes('進度落後約 10%'));

const directions=DashboardPage.directionsHTML([
  {id:'root',name:'台政大轉學考'}
],{
  selected:'root',
  calc:()=>40,
  kids:()=>[
    {id:'stage',status:'進行中'}
  ],
  esc:x=>String(x)
});

assert(directions.includes('台政大轉學考'));
assert(directions.includes('40%'));
assert(directions.includes('1 個階段目標'));

console.log('OK: DashboardPage execution, decision and direction rendering');
