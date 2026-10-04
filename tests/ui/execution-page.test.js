const assert=require('assert');
const ExecutionPage=require('../../js/ui/pages/execution-page.js');
const today=ExecutionPage.todayListHTML({items:[{id:'t1',name:'行政法'}],totalCount:6,expanded:false,timer:{id:'t1'},currentWeekSummary:()=>({actual:130,credited:120,overrun:10,target:120,remaining:0}),ancestors:()=>[],esc:x=>String(x),calc:()=>100});
assert(today.includes('today-item-selected'));assert(today.includes('本週 130/120 分'));assert(today.includes('有效 120 分'));assert(today.includes('超時 10 分'));assert(today.includes('100%'));assert(today.includes('顯示全部（6 項）'));assert(today.includes("startTodayExecution('t1')"));assert(!today.includes('安排'));assert(!today.includes('plan'));
console.log('OK: ExecutionPage direct execution rendering without schedule plans');
