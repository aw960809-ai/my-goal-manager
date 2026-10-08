const assert=require('assert');
const fs=require('fs');const path=require('path');
const CalendarPage=require('../../js/ui/pages/calendar-page.js');
const CalendarDomain=require('../../js/domain/calendar.js');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),app=read('js/app.js'),css=read('css/calendar.css'),sw=read('sw.js');
const version=read('config/version.js');
for(const id of ['calendarModeTabs','calendarDatePicker','calendarSummary','calendarAgenda','calendarDetail','calendarUpcoming','calendarPrev','calendarNext'])assert(html.includes(`id="${id}"`),`missing ${id}`);
for(const f of ['calendarSetMode','calendarPickMonth','calendarFilterAll','calendarEventsForDate','calendarToday','calendarShift'])assert(app.includes(`function ${f}(`),`missing controller ${f}`);
assert(app.includes('CalendarDomain.eventsForDate')&&app.includes('periodForTask,'),'calendar must project goal deadlines');
assert(css.includes('#calendar .calendar-days')&&css.includes('54px'),'mobile dots-only grid required');
assert(sw.includes("'./css/calendar.css'"),'PWA shell must include calendar style');
assert(version.includes("GOAL_MANAGER_VERSION='98.13.0'"),'calendar release version bump required');
assert(!app.includes("el.scrollIntoView({behavior:'smooth',block:'nearest'})"),'calendar render must not auto-scroll');
const day='2026-10-10';
const school={type:'school',title:'<script>校曆</script>',date:day};
const deadline={type:'task',title:'報告截止',date:day};
const manual={type:'manual',title:'讀書',date:day};
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eventsForDate=k=>k===day?[deadline,manual,school]:[];
const cells=CalendarPage.agendaHTML({baseDate:new Date(2026,9,1),days:CalendarDomain.monthGridKeys(new Date(2026,9,1)),today:day,selectedDate:day,eventsForDate,esc,categorize:CalendarDomain.eventCategory});
assert.strictEqual((cells.match(/class="calendar-cell/g)||[]).length,42);
assert(cells.includes('selected-day')&&cells.includes('cal-dot deadline')&&cells.includes('cal-dot school')&&cells.includes('cal-dot planned'));
assert(!cells.includes('<script>校曆</script>'));
const year=CalendarPage.yearHTML({baseDate:new Date(2026,9,1),eventsForDate,esc});
assert.strictEqual((year.match(/class="cal-year-month"/g)||[]).length,12);
assert(year.includes('calendarPickMonth(2026,10)'));
const nodes={};const make=()=>({innerHTML:'',textContent:'',dataset:{},style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v},classList:{toggle(){}}});
for(const id of ['calendar','calendarModeTabs','calendarSummary','calendarAgenda','calendarDetail','calendarUpcoming','calMonthTitle','calMonthSub','calendarPrev','calendarNext'])nodes[id]=make();
let details=0,lastDate='',lastEvents=[];
const fake={getElementById(id){return nodes[id]||null}};
for(const mode of ['year','month','day']){
 CalendarPage.render({document:fake,baseDate:new Date(2026,9,1),days:CalendarDomain.monthGridKeys(new Date(2026,9,1)),today:day,selectedDate:day,
   eventsForDate,esc,mode,category:'all',categorize:CalendarDomain.eventCategory,addDays:CalendarDomain.addDays,
   detailHTML(_title,_subtitle,events,date){details++;lastDate=date;lastEvents=events},hideDetail(){lastDate=''}});
 assert.strictEqual(nodes.calendar.dataset.mode,mode);
 if(mode==='year')assert(nodes.calendarAgenda.innerHTML.includes('cal-year-grid'));
 if(mode==='month')assert(nodes.calendarAgenda.innerHTML.includes('calendar-weekdays'));
 if(mode==='day')assert.strictEqual(nodes.calendarAgenda.innerHTML,'');
}
assert.strictEqual(lastDate,day);assert.strictEqual(lastEvents.length,3);
assert(nodes.calendarSummary.innerHTML.includes('calendarFilterAll'));
assert.strictEqual((nodes.calendarSummary.innerHTML.match(/summary-pill/g)||[]).length,3);
assert(nodes.calendarUpcoming.innerHTML.includes('10/10'));
assert(details>=2);
const matched=CalendarPage.render({document:fake,baseDate:new Date(2026,9,1),days:CalendarDomain.monthGridKeys(new Date(2026,9,1)),today:day,selectedDate:day,
   eventsForDate,esc,mode:'month',category:'school',categorize:CalendarDomain.eventCategory,addDays:CalendarDomain.addDays,
   detailHTML(_title,_subtitle,events){lastEvents=events},hideDetail(){}});
assert.strictEqual(lastEvents.length,1);
assert.strictEqual(matched.nDue,1);
assert.strictEqual(matched.nSchool,1);
console.log('OK: CalendarPage year/month/day, mobile indicators, focus, 3 filters, deadline projection, navigation, safe text, PWA shell');
