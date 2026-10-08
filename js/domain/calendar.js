/* Goal Manager calendar domain: read-only projections, local-date arithmetic and one event taxonomy. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CalendarDomain=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const list=value=>Array.isArray(value)?value:[];
  const validKey=key=>{
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key||''));
    if(!m)return false;
    const y=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
    if(y<1900||y>2200||month<1||month>12||day<1||day>31)return false;
    const d=new Date(y,month-1,day,12);
    return d.getFullYear()===y&&d.getMonth()===month-1&&d.getDate()===day;
  };
  function dateKey(value){
    if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return validKey(value)?value:'';
    const d=value instanceof Date?value:new Date(value);
    if(Number.isNaN(d.getTime()))return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function fromKey(key){return validKey(key)?new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,Number(key.slice(8,10)),12):null;}
  function addDays(key,delta){const d=fromKey(key);if(!d)return '';d.setDate(d.getDate()+Number(delta||0));return dateKey(d);}
  function shiftMonth(key,delta){
    const d=fromKey(key);if(!d)return '';
    const first=new Date(d.getFullYear(),d.getMonth()+Number(delta||0),1,12);
    const last=new Date(first.getFullYear(),first.getMonth()+1,0,12).getDate();
    return dateKey(new Date(first.getFullYear(),first.getMonth(),Math.min(d.getDate(),last),12));
  }
  function monthGridKeys(baseValue){
    const base=baseValue instanceof Date?new Date(baseValue):new Date(baseValue);
    if(Number.isNaN(base.getTime()))return [];
    const first=new Date(base.getFullYear(),base.getMonth(),1,12);
    const start=new Date(first.getFullYear(),first.getMonth(),1-first.getDay(),12);
    return Array.from({length:42},(_,i)=>dateKey(new Date(start.getFullYear(),start.getMonth(),start.getDate()+i,12)));
  }
  function activeCalendarEvents(events){return list(events).filter(e=>e&&e.status!=='已取消');}
  function eventCategory(event){
    const type=String(event?.type||'');
    if(type==='task'||type==='deadline')return 'deadline';
    if(['school','holiday','exam','special'].includes(type))return 'school';
    return 'planned';
  }
  function filterEvents(events,category='all'){
    return category==='all'?list(events):list(events).filter(e=>eventCategory(e)===category);
  }
  function schoolEventsForDate(schoolCalendar,key){
    return list(schoolCalendar).filter(e=>e&&e.date===key).map(e=>({...e,type:'school',calendarSubType:e.type||'school',meta:e.meta||'東海校曆'}));
  }
  function userEventsForDate(calendarEvents,key){
    return activeCalendarEvents(calendarEvents).filter(e=>e.date===key);
  }
  function taskDeadlinesForDate(tasks,key,periodForTask){
    return list(tasks).filter(t=>t&&Number(t.level)===3&&!['已完成','已封存','已取消'].includes(String(t.status||'')))
      .flatMap(t=>{
        let period=null;
        try{period=typeof periodForTask==='function'?periodForTask(t):t;}catch(_){return []}
        const due=dateKey(period?.due||t.due||'');
        if(due!==key)return [];
        return [{id:`cal-due-${String(t.id)}`,taskId:String(t.id||''),date:key,
          title:String(t.name||'未命名子任務'),type:'task',meta:'子任務截止日',source:'goal'}];
      });
  }
  function eventsForDate({schoolCalendar,calendarEvents,tasks,key,enrichEvent,periodForTask}){
    if(!validKey(key))return [];
    const school=schoolEventsForDate(schoolCalendar,key);
    const user=userEventsForDate(calendarEvents,key).map(e=>typeof enrichEvent==='function'?enrichEvent({...e}):({...e}));
    const deadlines=taskDeadlinesForDate(tasks,key,periodForTask);
    const combined=[...deadlines,...user,...school];
    // Legacy data sometimes contains a duplicate school entry. Only remove it in the view.
    const seenSchool=new Set();
    return combined.filter(e=>{
      if(eventCategory(e)!=='school')return true;
      const sig=`${e.date}|${String(e.title||'').trim()}`;
      if(seenSchool.has(sig))return false;
      seenSchool.add(sig);return true;
    }).sort((a,b)=>{
      const rank={deadline:0,planned:1,school:2};
      const ra=rank[eventCategory(a)],rb=rank[eventCategory(b)];
      const ta=String(a.time||''),tb=String(b.time||'');
      return ra-rb||((ta&&tb)?ta.localeCompare(tb):0)||String(a.title||'').localeCompare(String(b.title||''),'zh-Hant');
    });
  }
  function monthCounts({schoolCalendar,calendarEvents,tasks,periodForTask,baseDate}){
    const base=baseDate instanceof Date?baseDate:new Date(baseDate);
    if(Number.isNaN(base.getTime()))return {school:0,confirmed:0,active:0,deadline:0};
    const year=base.getFullYear(),month=base.getMonth();
    let school=0,planned=0,deadline=0;
    const last=new Date(year,month+1,0,12).getDate();
    for(let d=1;d<=last;d++){
      const key=dateKey(new Date(year,month,d,12));
      const events=eventsForDate({schoolCalendar,calendarEvents,tasks,periodForTask,key});
      for(const e of events){const group=eventCategory(e);if(group==='school')school++;else if(group==='planned')planned++;else deadline++;}
    }
    return {school,confirmed:planned,active:planned,deadline};
  }
  return Object.freeze({dateKey,validKey,fromKey,addDays,shiftMonth,monthGridKeys,
    activeCalendarEvents,eventCategory,filterEvents,schoolEventsForDate,userEventsForDate,
    taskDeadlinesForDate,eventsForDate,monthCounts});
});
