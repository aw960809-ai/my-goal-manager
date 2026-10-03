/* Calendar page renderer. Business/date rules stay in CalendarDomain. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CalendarPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function summaryButton(label,count,mode,active=false){
    return `<button type="button" class="summary-pill ${active?'active':''}" onclick="showCalendarSummary('${mode}')"><b>${label}</b> ${count} 項</button>`;
  }

  function cellHTML({key,baseMonth,today,selectedDate,events,esc}){
    const d=new Date(key+'T00:00:00');
    const inMonth=d.getMonth()===baseMonth;
    const isToday=key===today;
    const isSelected=key===selectedDate;
    const rows=Array.isArray(events)?events:[];

    return `<button class="calendar-cell ${inMonth?'':'outside'} ${isToday?'today':''} ${isSelected?'selected-day':''}" type="button" onclick="calendarSelectDay('${key}')"><span class="cell-head"><b>${d.getDate()}</b>${isToday?'<em>今天</em>':''}</span><span class="cell-events">${rows.slice(0,3).map(e=>`<span class="cell-event ${e.type} ${e.meta&&e.meta.includes('已確認')?'confirmed':''}"><i></i>${esc(e.title)}</span>`).join('')}${rows.length>3?`<span class="cell-more">＋${rows.length-3} 項</span>`:''}</span></button>`;
  }

  function agendaHTML({baseDate,days,today,selectedDate,eventsForDate,esc}){
    const base=baseDate instanceof Date?baseDate:new Date(baseDate);
    const cells=(Array.isArray(days)?days:[]).map(key=>cellHTML({
      key,
      baseMonth:base.getMonth(),
      today,
      selectedDate,
      events:eventsForDate(key),
      esc
    })).join('');

    return `<div class="calendar-weekdays">${['日','一','二','三','四','五','六'].map(x=>`<div>${x}</div>`).join('')}</div><div class="calendar-days">${cells}</div>`;
  }

  function render({
    document,
    baseDate,
    days,
    today,
    selectedDate,
    eventsForDate,
    esc,
    detailHTML,
    hideDetail
  }){
    const base=baseDate instanceof Date?baseDate:new Date(baseDate);
    const rows=(Array.isArray(days)?days:[]).flatMap(eventsForDate);

    const schoolN=rows.filter(e=>e.type==='school').length;
    const confirmedN=rows.filter(
      e=>e.type==='activity'&&String(e.meta||'').includes('已確認')
    ).length;
    const todayCount=eventsForDate(today).length;

    document.getElementById('calMonthTitle').textContent=
      `${base.getFullYear()} 年 ${base.getMonth()+1} 月`;

    document.getElementById('calMonthSub').textContent=
      `115 學年度 · ${base.getMonth()+1} 月行事`;

    document.getElementById('calendarSummary').innerHTML=
      summaryButton('今天',todayCount,'today',selectedDate===today)+
      summaryButton('本月學校行事',schoolN,'school')+
      summaryButton('已確認活動',confirmedN,'confirmed');

    document.getElementById('calendarAgenda').innerHTML=agendaHTML({
      baseDate:base,
      days,
      today,
      selectedDate,
      eventsForDate,
      esc
    });

    if(selectedDate&&days.includes(selectedDate)){
      const events=eventsForDate(selectedDate);
      const d=new Date(selectedDate+'T00:00:00');
      const label=
        `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}（${['日','一','二','三','四','五','六'][d.getDay()]}）`;
      detailHTML(label,'已選日期 · 當日行程與活動',events);
    }else{
      hideDetail();
    }
  }

  return Object.freeze({
    summaryButton,
    cellHTML,
    agendaHTML,
    render
  });
});
