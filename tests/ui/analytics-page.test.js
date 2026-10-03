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
