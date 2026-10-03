const assert=require('assert');
const CalendarPage=require('../../js/ui/pages/calendar-page.js');

const html=CalendarPage.summaryButton(
  '今天',
  2,
  'today',
  true
);

assert(html.includes('summary-pill active'));
assert(html.includes("showCalendarSummary('today')"));
assert(html.includes('<b>今天</b> 2 項'));

const agenda=CalendarPage.agendaHTML({
  baseDate:new Date(2026,9,1),
  days:['2026-10-03'],
  today:'2026-10-03',
  selectedDate:'2026-10-03',
  eventsForDate:()=>[
    {type:'school',title:'測試行事',meta:'學校行事'}
  ],
  esc:x=>String(x)
});

assert(agenda.includes('calendar-weekdays'));
assert(agenda.includes('calendar-cell'));
assert(agenda.includes('today'));
assert(agenda.includes('selected-day'));
assert(agenda.includes('測試行事'));

console.log('OK: CalendarPage summary and agenda rendering');
