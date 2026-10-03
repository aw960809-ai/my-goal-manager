const assert=require('assert');
const CalendarDomain=require('../../js/domain/calendar.js');

const school=[
  {id:'s1',date:'2026-10-10',title:'學校A'},
  {id:'s2',date:'2026-10-10',title:'學校B'}
];

const user=[
  {id:'u1',type:'manual',date:'2026-10-10',title:'手動',meta:'已確認'},
  {id:'u2',type:'activity',date:'2026-10-10',title:'活動',meta:'已確認'},
  {id:'u3',type:'activity',date:'2026-10-10',title:'取消',meta:'已確認',status:'已取消'}
];

assert.strictEqual(
  CalendarDomain.dateKey(new Date(2026,9,3)),
  '2026-10-03'
);

const days=CalendarDomain.monthGridKeys(new Date(2026,9,1));
assert.strictEqual(days.length,42);
assert.strictEqual(days[0],'2026-09-27');
assert.strictEqual(days[41],'2026-11-07');

const rows=CalendarDomain.eventsForDate({
  schoolCalendar:school,
  calendarEvents:user,
  key:'2026-10-10'
});

assert.strictEqual(rows.length,4);
assert.strictEqual(
  rows.filter(x=>x.type==='school').length,
  2
);

const counts=CalendarDomain.monthCounts({
  schoolCalendar:school,
  calendarEvents:user,
  baseDate:new Date(2026,9,1)
});

assert.strictEqual(counts.school,2);
assert.strictEqual(counts.confirmed,2);
assert.strictEqual(counts.active,2);

console.log(
  'OK: CalendarDomain grid, event filtering and month counts'
);
