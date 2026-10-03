/* Calendar domain: pure date-grid and event-selection helpers. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CalendarDomain=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function list(value){return Array.isArray(value)?value:[]}

  function dateKey(value){
    const d=value instanceof Date?value:new Date(value);
    if(Number.isNaN(d.getTime()))return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function monthGridKeys(baseValue){
    const base=baseValue instanceof Date?new Date(baseValue):new Date(baseValue);
    if(Number.isNaN(base.getTime()))return [];
    const first=new Date(base.getFullYear(),base.getMonth(),1);
    const gridStart=new Date(base.getFullYear(),base.getMonth(),1-first.getDay());
    const out=[];
    for(let i=0;i<42;i++){
      out.push(dateKey(new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate()+i
      )));
    }
    return out;
  }

  function activeCalendarEvents(events){
    return list(events).filter(e=>e&&e.status!=='已取消');
  }

  function schoolEventsForDate(schoolCalendar,key){
    return list(schoolCalendar)
      .filter(e=>e&&e.date===key)
      .map(e=>({...e,type:'school',meta:e.meta||'學校行事'}));
  }

  function userEventsForDate(calendarEvents,key){
    return activeCalendarEvents(calendarEvents)
      .filter(e=>e.date===key);
  }

  function eventsForDate({schoolCalendar,calendarEvents,key,enrichEvent}){
    const school=schoolEventsForDate(schoolCalendar,key);
    const user=userEventsForDate(calendarEvents,key)
      .map(e=>typeof enrichEvent==='function'?enrichEvent({...e}):({...e}));
    return [...school,...user];
  }

  function monthCounts({schoolCalendar,calendarEvents,baseDate}){
    const days=new Set(monthGridKeys(baseDate));
    const school=list(schoolCalendar).filter(e=>e&&days.has(e.date));
    const active=activeCalendarEvents(calendarEvents).filter(e=>days.has(e.date));
    return {
      school:school.length,
      confirmed:active.filter(e=>
        (e.type==='activity'||e.type==='manual')&&
        String(e.meta||'').includes('已確認')
      ).length,
      active:active.length
    };
  }

  return Object.freeze({
    dateKey,
    monthGridKeys,
    activeCalendarEvents,
    schoolEventsForDate,
    userEventsForDate,
    eventsForDate,
    monthCounts
  });
});
