/* V5 phase 2 workflow regression: simple navigation, no new data writers. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),app=read('js/app.js'),css=read('css/ui-layout-v4.css');
const dashboard=require('../../js/ui/pages/dashboard-page.js');
assert(html.includes('id="homeQuickAddCalendar"'));
const quick=html.match(/<button[^>]*id="homeQuickAddCalendar"[^>]*onclick="([^"]+)"/);
assert(quick,'quick add calendar control must be in home');
const calls=[];
vm.runInNewContext(quick[1],{
  go:id=>calls.push(['route',id]),
  openCalendarAddModal:day=>calls.push(['add',day]),
  todayKey:()=> '2026-10-13'
});
assert.deepEqual(calls,[['route','calendar'],['add','2026-10-13']]);
const output=dashboard.deadlinesHTML([{date:'2026-10-25',title:'期中考',meta:'校內'}],{esc:s=>String(s)});
assert(output.includes('class="listitem home-deadline-link"'));
assert(output.includes('data-date="2026-10-25"'));
assert(output.includes('onclick="openCalendarFromDeadline(this.dataset.date)"'));
const invalid=dashboard.deadlinesHTML([{date:'2026-10-13" onclick="evil()',title:'特殊',meta:''}],{esc:s=>String(s)});
assert(!invalid.includes('home-deadline-link'),'invalid dates must not be interactive');
const fn=app.match(/function openCalendarFromDeadline\(dayKey\)\{[\s\S]*?\n\}/);
assert(fn,'validated calendar destination must exist');
const out=[];
const context={CalendarDomain:{validKey:key=>/^\d{4}-\d{2}-\d{2}$/.test(key)},
  go:id=>out.push(['go',id]),showCalendarDay:(day,scroll)=>out.push(['day',day,scroll]),
  toast:text=>out.push(['error',text]),calendarViewMode:'year'};
vm.createContext(context);
vm.runInContext(fn[0]+"\nopenCalendarFromDeadline('2026-10-25')",context);
assert.deepEqual(out,[['go','calendar'],['day','2026-10-25',false]]);
assert.equal(context.calendarViewMode,'month');
vm.runInContext("openCalendarFromDeadline('invalid')",context);
assert.equal(out.length,3,'invalid date should only produce an error');
assert(css.includes('V5-PHASE2-WORKFLOW'));
assert(css.includes('.home-deadline-link:focus-visible'));
assert(!fn[0].includes('localStorage'));
console.log('PASS: home add/date shortcuts, safe calendar routing, bad date rejection, no new writers');
