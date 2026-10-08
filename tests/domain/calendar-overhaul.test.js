const assert=require('assert');
const C=require('../../js/domain/calendar.js');
assert.strictEqual(C.dateKey(new Date(2026,9,8,12)), '2026-10-08');
assert(C.validKey('2026-02-28'));
assert(!C.validKey('2026-02-29'));
assert(C.validKey('2028-02-29'));
assert(!C.validKey('2026-13-02'));
assert(!C.validKey('2026-09-31'));
assert.strictEqual(C.addDays('2026-12-31',1),'2027-01-01');
assert.strictEqual(C.shiftMonth('2027-01-31',1),'2027-02-28');
assert.strictEqual(C.shiftMonth('2028-01-31',1),'2028-02-29');
const grid=C.monthGridKeys(new Date(2026,9,1));
assert.strictEqual(grid.length,42);
assert.strictEqual(grid[0],'2026-09-27');
assert.strictEqual(grid[41],'2026-11-07');
const school=[{id:'s',date:'2026-10-10',title:'校慶',type:'holiday'}];
const calendar=[
 {id:'a',date:'2026-10-10',title:'法律講座',type:'activity',meta:'已確認'},
 {id:'m',date:'2026-10-10',title:'自己安排的讀書',type:'manual'},
 {id:'c',date:'2026-10-10',title:'取消的活動',type:'activity',status:'已取消'},
 {id:'duplicated-school',date:'2026-10-10',title:'校慶',type:'school'}
];
const tasks=[
 {id:'t1',name:'憲法體系',level:3,status:'進行中',due:'2026-10-10'},
 {id:'t2',name:'已完成的刑法',level:3,status:'已完成',due:'2026-10-10'},
 {id:'t3',name:'子行動',level:4,due:'2026-10-10'},
 {id:'t4',name:'跨層父任務',level:3,status:'未開始',due:'2026-10-12'}
];
const before=JSON.stringify({school,calendar,tasks});
const e=C.eventsForDate({schoolCalendar:school,calendarEvents:calendar,tasks,key:'2026-10-10',periodForTask:t=>({due:t.due})});
assert.strictEqual(e.length,4,'school duplicate view filtered; cancelled and completed removed');
assert.deepStrictEqual(e.map(C.eventCategory),['deadline','planned','planned','school']);
assert.strictEqual(C.filterEvents(e,'school').length,1);
assert.strictEqual(C.filterEvents(e,'deadline').length,1);
assert.strictEqual(C.filterEvents(e,'planned').length,2);
assert(e.some(x=>x.type==='task'&&x.taskId==='t1'&&x.meta.includes('截止')));
assert.strictEqual(C.eventsForDate({schoolCalendar:school,calendarEvents:calendar,tasks,key:'not-a-day'}).length,0);
const count=C.monthCounts({schoolCalendar:school,calendarEvents:calendar,tasks,periodForTask:t=>({due:t.due}),baseDate:new Date(2026,9,1)});
assert.deepStrictEqual(count,{school:1,confirmed:2,active:2,deadline:2});
assert.strictEqual(JSON.stringify({school,calendar,tasks}),before,'calendar projection must not mutate underlying records');
console.log('OK: CalendarDomain year/month/day boundaries, selected-date projection, goal deadlines, cancellation and storage immutability');
