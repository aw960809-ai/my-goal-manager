/* Calendar page renderer: year / month / day. No persistence or business-data mutation. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CalendarPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const daysOfWeek=['日','一','二','三','四','五','六'];
  const categoryOf=e=>e?.type==='task'?'deadline':e?.type==='school'?'school':'planned';
  function summaryButton(label,count,mode,active=false){
    return `<button type="button" class="summary-pill ${active?'active':''}" aria-pressed="${!!active}" onclick="showCalendarSummary('${mode}')"><b>${label}</b> ${count} 項</button>`;
  }
  function cellHTML({key,baseMonth,today,selectedDate,events,esc,categorize=categoryOf}){
    const d=new Date(key+'T12:00:00');
    const inMonth=d.getMonth()===baseMonth;
    const isToday=key===today,isSelected=key===selectedDate;
    const rows=Array.isArray(events)?events:[];
    const categories=[...new Set(rows.map(categorize))].filter(x=>['school','planned','deadline'].includes(x));
    const dots=categories.slice(0,3).map(x=>`<i class="cal-dot ${x}"></i>`).join('');
    const titles=rows.slice(0,2).map(x=>`<span class="cal-cell-title ${categorize(x)}">${esc(x.title||'未命名')}</span>`).join('');
    const more=rows.length>2?`<span class="cal-cell-overflow">+${rows.length-2}</span>`:'';
    return `<button type="button" class="calendar-cell ${inMonth?'':'outside'} ${isToday?'today':''} ${isSelected?'selected-day':''}" data-date="${key}" aria-label="${key}，${rows.length} 項行程" aria-pressed="${isSelected}" onclick="calendarSelectDay('${key}')">
      <span class="cell-head"><b>${d.getDate()}</b>${isToday?'<em>今</em>':''}</span>
      <span class="cal-cell-marks" aria-hidden="true">${dots}${rows.length>3?`<small>${rows.length}</small>`:''}</span>
      <span class="cal-cell-titles" aria-hidden="true">${titles}${more}</span>
    </button>`;
  }
  function agendaHTML({baseDate,days,today,selectedDate,eventsForDate,esc,categorize=categoryOf}){
    const base=baseDate instanceof Date?baseDate:new Date(baseDate);
    const cells=(Array.isArray(days)?days:[]).map(key=>cellHTML({key,baseMonth:base.getMonth(),today,selectedDate,
      events:eventsForDate(key),esc,categorize})).join('');
    return `<div class="calendar-weekdays">${daysOfWeek.map(x=>`<div>${x}</div>`).join('')}</div><div class="calendar-days">${cells}</div>`;
  }
  function yearHTML({baseDate,eventsForDate,esc}){
    const y=baseDate.getFullYear();
    let cards='';
    for(let m=0;m<12;m++){
      let school=0,planned=0,deadline=0;
      const last=new Date(y,m+1,0,12).getDate();
      for(let d=1;d<=last;d++){
        const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        for(const event of eventsForDate(key)){
          const type=categoryOf(event);
          if(type==='school')school++;
          else if(type==='deadline')deadline++;
          else planned++;
        }
      }
      const n=school+planned+deadline;
      cards+=`<button type="button" class="cal-year-month" onclick="calendarPickMonth(${y},${m+1})" aria-label="${y} 年 ${m+1} 月，${n} 項行程">
        <b>${m+1} 月</b><span>${n?n+' 項':'無行程'}</span><small>校曆 ${school} · 安排 ${planned} · 截止 ${deadline}</small>
      </button>`;
    }
    return `<div class="cal-year-grid" aria-label="全年行事概覽">${cards}</div>`;
  }
  function upcomingHTML({today,eventsForDate,esc,addDays}){
    const items=[];
    for(let i=0;i<14;i++){
      const date=addDays(today,i);
      if(!date)continue;
      for(const e of eventsForDate(date))items.push({date,event:e});
    }
    const list=items.slice(0,6);
    return `<div class="cal-upcoming-head"><h3>接下來 14 天</h3><small>${items.length} 項</small></div>`+
      (list.length?`<div class="cal-upcoming-list">${list.map(({date,event})=>`<button type="button" class="cal-upcoming-item" onclick="calendarSelectDay('${date}')">
        <time>${date.slice(5).replace('-','/')}</time><i class="cal-dot ${categoryOf(event)}"></i><span>${esc(event.title||'未命名')}</span><b>›</b>
      </button>`).join('')}</div>`:'<div class="cal-upcoming-empty">未來兩週暫無安排或截止事項。</div>')+
      (items.length>6?'<p class="cal-upcoming-foot">其餘事項可點選月曆日期查看。</p>':'');
  }
  function render({document,baseDate,days,today,selectedDate,eventsForDate,esc,detailHTML,hideDetail,
    mode='month',category='all',categorize=categoryOf,addDays}){
    const base=baseDate instanceof Date?baseDate:new Date(baseDate);
    const year=base.getFullYear(),month=base.getMonth(),prefix=`${year}-${String(month+1).padStart(2,'0')}`;
    const focus=(typeof selectedDate==='string'&&selectedDate.startsWith(prefix)&&/\d{4}-\d{2}-\d{2}/.test(selectedDate))
      ?selectedDate:(today.startsWith(prefix)?today:`${prefix}-01`);
    const categoryFilter=rows=>category==='all'?rows:rows.filter(e=>categorize(e)===category);
    const getEvents=key=>categoryFilter(eventsForDate(key)||[]);
    const monthRows=[];
    for(let d=1;d<=new Date(year,month+1,0,12).getDate();d++){
      const key=`${prefix}-${String(d).padStart(2,'0')}`;
      monthRows.push(...(eventsForDate(key)||[]));
    }
    const nSchool=monthRows.filter(e=>categorize(e)==='school').length;
    const nPlan=monthRows.filter(e=>categorize(e)==='planned').length;
    const nDue=monthRows.filter(e=>categorize(e)==='deadline').length;
    const calendar=document.getElementById('calendar');if(calendar)calendar.dataset.mode=mode;
    const title=document.getElementById('calMonthTitle');
    if(title)title.textContent=mode==='year'?`${year} 年`:mode==='day'?focus.replaceAll('-',' / '):`${year} 年 ${month+1} 月`;
    const sub=document.getElementById('calMonthSub');
    if(sub)sub.textContent='東海校曆 · 已安排活動 · 子任務截止';
    const prev=document.getElementById('calendarPrev'),next=document.getElementById('calendarNext');
    const unit=mode==='year'?'年':mode==='day'?'日':'月';
    if(prev){prev.textContent=`‹ 上${unit}`;prev.setAttribute?.('aria-label',`上${unit}`)}
    if(next){next.textContent=`下${unit} ›`;next.setAttribute?.('aria-label',`下${unit}`)}
    const modes=document.getElementById('calendarModeTabs');
    if(modes)modes.innerHTML=['year','month','day'].map((key,i)=>`<button type="button" class="cal-mode-option ${mode===key?'active':''}" aria-pressed="${mode===key}" onclick="calendarSetMode('${key}')">${['年','月','日'][i]}</button>`).join('');
    const summary=document.getElementById('calendarSummary');
    if(summary)summary.innerHTML=`<button id="calendarFilterAll" type="button" class="calendar-filter-all ${category==='all'?'active':''}" aria-pressed="${category==='all'}" onclick="calendarFilterAll()"><b>全部</b>所有分類</button>`+summaryButton('校曆',nSchool,'school',category==='school')+
      summaryButton('已安排',nPlan,'confirmed',category==='planned')+
      summaryButton('截止',nDue,'deadline',category==='deadline');
    const all=document.getElementById('calendarFilterAll');
    if(all){all.setAttribute?.('aria-pressed',String(category==='all'));all.classList.toggle?.('active',category==='all')}
    const agenda=document.getElementById('calendarAgenda');
    if(agenda)agenda.innerHTML=mode==='year'?yearHTML({baseDate:base,eventsForDate:getEvents,esc}):
      mode==='month'?agendaHTML({baseDate:base,days,today,selectedDate:focus,eventsForDate:getEvents,esc,categorize}):'';
    const date=mode==='year'?'':focus;
    if(date){
      const d=new Date(date+'T12:00:00');
      const label=`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}（${daysOfWeek[d.getDay()]}）`;
      const rows=getEvents(date);
      const subtitle=`${rows.length} 項 · ${category==='all'?'全部':{school:'學校校曆',planned:'已安排活動',deadline:'子任務截止'}[category]}`;
      detailHTML(label,subtitle,rows,date);
    }else hideDetail();
    const upcoming=document.getElementById('calendarUpcoming');
    if(upcoming&&typeof addDays==='function')upcoming.innerHTML=upcomingHTML({today,eventsForDate:getEvents,esc,addDays});
    return {focus,nSchool,nPlan,nDue};
  }
  return Object.freeze({summaryButton,cellHTML,agendaHTML,yearHTML,upcomingHTML,render});
});
