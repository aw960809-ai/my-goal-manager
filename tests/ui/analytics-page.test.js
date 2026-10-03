const assert=require('assert');
const AnalyticsPage=require('../../js/ui/pages/analytics-page.js');

assert.strictEqual(
  AnalyticsPage.formatMinutes(0),
  '0m'
);

assert.strictEqual(
  AnalyticsPage.formatMinutes(90),
  '1h 30m'
);

const html=AnalyticsPage.executionAnalysisHTML({
  plannedMinutes:120,
  planActualMinutes:60,
  actualMinutes:90,
  otherStudyMinutes:40,
  totalStudyMinutes:130,
  unplannedActualMinutes:30,
  cancelledPlanActualMinutes:0,
  scheduledPlans:[{id:'p1'}],
  startedPlans:[{id:'p1'}],
  fulfilledPlans:[],
  expiredPlans:[],
  cancelledPlans:[],
  executionRate:100,
  timeRate:50,
  estimateAccuracy:null
},{
  timerRunning:false
});

assert(html.includes('計畫實際執行率'));
assert(html.includes('100%'));
assert(html.includes('總讀書時間'));
assert(html.includes('2h 10m'));

console.log('OK: AnalyticsPage formatting and execution-analysis rendering');


const recent=AnalyticsPage.recentActualLogsHTML([
  {
    id:'l1',
    taskId:'t1',
    name:'行政法',
    time:'2026-10-03T10:30:00+08:00',
    minutes:45
  }
],{
  esc:x=>String(x),
  getTask:()=>null,
  isOtherStudyLog:()=>false
});

assert(recent.includes('行政法'));
assert(recent.includes('45 分'));
assert(recent.includes('查看全部紀錄'));

const review=AnalyticsPage.weeklyReviewHTML([{
  t:{id:'t1',name:'行政法'},
  w:{target:120,actual:60},
  shortfall:60,
  review:{reason:'課業負荷'}
}],{
  date:'2026-10-03',
  reasons:['課業負荷','時間不足'],
  esc:x=>String(x),
  calc:()=>30
});

assert(review.includes('行政法'));
assert(review.includes('課業負荷'));
assert(review.includes('30%'));
