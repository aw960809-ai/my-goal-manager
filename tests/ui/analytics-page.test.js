const assert=require('assert');
const AnalyticsPage=require('../../js/ui/pages/analytics-page.js');
assert.strictEqual(AnalyticsPage.formatMinutes(0),'0m');assert.strictEqual(AnalyticsPage.formatMinutes(90),'1h 30m');
const recent=AnalyticsPage.recentActualLogsHTML([{id:'l1',taskId:'t1',name:'行政法',time:'2026-10-03T10:30:00+08:00',minutes:45}],{esc:x=>String(x),getTask:()=>null,isOtherStudyLog:()=>false});assert(recent.includes('行政法'));assert(recent.includes('45 分'));assert(recent.includes('查看全部紀錄'));
const review=AnalyticsPage.weeklyReviewHTML([{t:{id:'t1',name:'行政法'},w:{target:120,actual:60},shortfall:60,review:{reason:'課業負荷'}}],{date:'2026-10-03',reasons:['課業負荷','時間不足'],esc:x=>String(x),calc:()=>30});assert(review.includes('行政法'));assert(review.includes('課業負荷'));assert(review.includes('30%'));
const nodes={weekEngagedActionCount:{textContent:'',style:{}},avg:{textContent:'',style:{}},weekCreditedKpi:{textContent:'',style:{}},logsN:{textContent:'',style:{}},statsWeekRatio:{textContent:'',style:{}},statsWeekBar:{textContent:'',style:{}},statsActual:{textContent:'',style:{}},statsCredited:{textContent:'',style:{}},statsOverrun:{textContent:'',style:{}},statsOtherStudy:{textContent:'',style:{}},statsTotalStudy:{textContent:'',style:{}},statsTarget:{textContent:'',style:{}},statsRemaining:{textContent:'',style:{}},domains:{innerHTML:'',style:{},textContent:''},progressDistribution:{innerHTML:'',style:{},textContent:''}};
AnalyticsPage.renderStats({document:{getElementById:id=>nodes[id]||null},leaves:[],done:0,avg:0,weekEngagedActionCount:2,week:{ratio:53,goalActualMinutes:582,creditedGoalMinutes:549,overrunGoalMinutes:33,otherStudyMinutes:59,totalStudyMinutes:641,target:1030,remaining:481},directionRows:[{rootId:'r1',name:'台大及政大轉學考',actual:500,credited:470,overrun:30,target:930,remaining:460,ratio:51}],actualLogCount:58,esc:x=>String(x),calc:()=>0});
assert.strictEqual(nodes.weekEngagedActionCount.textContent,'2');assert.strictEqual(nodes.weekCreditedKpi.textContent,'549');assert.strictEqual(nodes.statsWeekRatio.textContent,'53%');assert(nodes.domains.innerHTML.includes('實際 500 分'));assert(nodes.domains.innerHTML.includes('有效 470 分'));assert(nodes.domains.innerHTML.includes('超時 30 分'));assert(nodes.domains.innerHTML.includes('目標 930 分'));assert(!nodes.domains.innerHTML.includes('計畫實際'));

const historyLogs=[
  {id:'a1',taskId:'short',name:'短時間複習',time:'2026-10-05T13:49:00+08:00',minutes:2,source:'timer'},
  {id:'a2',taskId:'short',name:'短時間複習',time:'2026-10-05T11:12:00+08:00',minutes:2,source:'timer'},
  {id:'a3',taskId:'short',name:'短時間複習',time:'2026-10-05T09:30:00+08:00',minutes:3,source:'manual-backfill'},
  {id:'b1',taskId:'law',name:'英美法案例閱讀',time:'2026-10-05T13:43:00+08:00',minutes:38,source:'timer'},
  {id:'o1',taskId:null,name:'憲法複習',time:'2026-10-04T12:18:00+08:00',minutes:89,source:'manual',kind:'other-study'}
];

const history=AnalyticsPage.actualHistoryBodyHTML({
  filtered:historyLogs,
  totalMinutes:134,
  taskRows:[['__other-study__','其他讀書時間'],['short','短時間複習'],['law','英美法案例閱讀']],
  range:'7',
  taskFilter:'all',
  esc:x=>String(x),
  getTask:id=>({id,name:id==='short'?'短時間複習':'英美法案例閱讀'}),
  isOtherStudyLog:log=>log.kind==='other-study',
  currentYear:2026
});

assert(history.includes('近 7 日'));
assert(history.includes('5 筆 · 2 小時 14 分'));
assert(history.includes('10 月 5 日・週一'));
assert(history.includes('4 筆 · 45 分'));
assert(history.includes('短時間複習'));
assert(history.includes('3 次 · 共 7 分'));
assert(history.includes('actual-history-cluster'));
assert(history.includes('13:49 · 2 分'));
assert(history.includes('補登'));
assert(history.includes('其他讀書'));
assert(history.includes('篩選'));
assert(!history.includes('2026-10-05 · 13:49'));

assert.strictEqual(
  AnalyticsPage.actualHistoryDayLabel('2026-10-05',2026),
  '10 月 5 日・週一'
);
assert.strictEqual(
  AnalyticsPage.actualHistoryDayLabel('2025-12-31',2026).startsWith('2025 年'),
  true
);

const twoOnly=AnalyticsPage.actualHistoryBodyHTML({
  filtered:historyLogs.slice(0,2),
  totalMinutes:4,
  taskRows:[['short','短時間複習']],
  range:'7',
  taskFilter:'all',
  esc:x=>String(x),
  getTask:()=>({name:'短時間複習'}),
  isOtherStudyLog:()=>false,
  currentYear:2026
});
assert(!twoOnly.includes('actual-history-cluster'));
assert(twoOnly.includes('13:49 · 2 分'));
assert(twoOnly.includes('11:12 · 2 分'));
assert.strictEqual((twoOnly.match(/class=\"actual-history-row /g)||[]).length,2);

console.log('OK: AnalyticsPage weekly study, direction and compact history rendering');
