/* Dashboard page renderer. Business priorities stay in app/domain services. */
(function(root,factory){
  const time=typeof module==='object'&&module.exports
    ?require('../time-format.js')
    :root.TimeFormat;
  const api=factory(time);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.DashboardPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(TimeFormat){
  'use strict';

  if(!TimeFormat)throw new Error('DashboardPage requires TimeFormat');

  function executeListHTML(items,{
    currentWeekSummary,
    ancestors,
    esc,
    calc
  }){
    const rows=Array.isArray(items)?items:[];

    return rows.length
      ?rows.map(task=>{
        const week=currentWeekSummary(task);
        const parent=ancestors(task.id).slice(-2,-1)[0]?.name||'';

        const outcome=week.outcome;
        const metrics=outcome?.kind==='review'
          ?`本週 ${outcome.done}/${outcome.target} 題 · 待 ${outcome.remaining} 題`+
            ` · 重測 ${outcome.accuracy===null?'—':outcome.accuracy+'%'} · 新掌握 ${outcome.masteredThisWeek}`+
            (outcome.queue?` · 到期 ${outcome.queue.due}`:' · 題庫待同步')+
            (outcome.evidenceMissing?` · 待證 ${outcome.evidenceMissing}`:'')
          :outcome
            ?`${calc(task)}% · 本週 ${outcome.done}/${outcome.target} 題 · 剩餘 ${outcome.remaining} 題`+
              (outcome.accuracy===null?' · 尚無正確率證據':` · 正確率 ${outcome.accuracy}%`)+
              (outcome.evidenceMissing?` · ${outcome.evidenceMissing} 筆待補證據`:'')
            :`${calc(task)}% · 本週 ${TimeFormat.minutes(week.actual)}/${TimeFormat.minutes(week.target)} 分 · 剩餘 ${TimeFormat.minutes(week.remaining)} 分`;
        return `<div class="listitem dash-exec"><div><b>${esc(task.name)}</b><small>${metrics}${outcome?.kind==='review'?'':parent?' · '+esc(parent):''}</small></div><button class="btn primary" onclick="executeFromDashboard('${task.id}')">${outcome?'去練習':'開始'}</button></div>`;
      }).join('')
      :'<div class="empty">本週沒有待辦執行事項。</div>';
  }

  function renderExecuteList({
    document,
    items,
    currentWeekSummary,
    ancestors,
    esc,
    calc
  }){
    const box=document.getElementById('dashActions');
    if(!box)return;

    box.innerHTML=executeListHTML(items,{
      currentWeekSummary,
      ancestors,
      esc,
      calc
    });
  }

  function decisionListHTML(items,{esc}){
    const rows=Array.isArray(items)?items:[];

    return rows.length
      ?rows.map((item,index)=>{
        const due=item.days===0
          ?'今天'
          :item.days<0
            ?'已截止'
            :`${item.days} 天後`;

        const left=item.w.outcome?`${item.w.outcome.remaining} 題`:`${TimeFormat.minutes(item.w.remaining)} 分`;
        return `<div class="decision-item ${item.state}"><span class="decision-rank">${index+1}</span><div class="decision-main"><b>${esc(item.t.name)}</b><small>${item.progress}% · 本週剩餘 ${left} · ${item.gap>0?'進度落後約 '+item.gap+'%':'進度正常'} · ${due}</small></div><span class="decision-badge ${item.state}">${item.label}</span></div>`;
      }).join('')
      :'<div class="empty">目前沒有需要優先處理的事項。</div>';
  }

  function renderDecisionList({
    document,
    load,
    items,
    esc
  }){
    const list=document.getElementById('decisionList');
    if(!list)return;

    const badge=document.getElementById('weekLoadBadge');

    if(badge){
      badge.textContent=
        `本週 ${load.hours.toFixed(1).replace('.0','')}h · ${load.level}`;

      badge.className=
        'decision-badge '+
        (load.score>=85?'urgent':load.score>=60?'normal':'ahead');
    }

    list.innerHTML=decisionListHTML(items,{esc});
  }

  function directionsHTML(roots,{
    selected,
    calc,
    kids,
    esc
  }){
    const rows=Array.isArray(roots)?roots:[];

    return rows.map(task=>{
      const progress=calc(task);
      const stageCount=kids(task.id)
        .filter(x=>x.status!=='已封存')
        .length;

      return `<button type="button" class="direction ${selected===task.id?'active':''}" style="--progress:${progress}%" aria-pressed="${selected===task.id}" onclick="selectTask('${task.id}',true);go('goals')"><div class="num">主要目標</div><h3>${esc(task.name)}</h3><p>目前完成度 ${progress}% · ${stageCount} 個階段目標</p><div class="direction-progress" aria-label="完成度 ${progress}%"><span style="width:${progress}%"></span></div><div class="foot"><span>進入目標地圖</span><b>${progress}%</b></div></button>`;
    }).join('')||
      '<div class="empty">尚無主要目標。</div>';
  }

  function deadlinesHTML(items,{esc}){
    const rows=Array.isArray(items)?items:[];

    return rows.length
      ?rows.map(item=>{
        const date=String(item.date||'');
        const valid=/^\d{4}-\d{2}-\d{2}$/.test(date);
        const row=`<span><b>${esc(item.title)}</b><small class="muted" style="display:block">${esc(item.meta||'')}</small></span><small>${esc(date)}</small>`;
        // Only a validated date can enter a data-* attribute. Event handlers
        // are constant source text; no calendar title enters JavaScript code.
        return valid
          ?`<button type="button" class="listitem home-deadline-link" data-date="${date}" onclick="openCalendarFromDeadline(this.dataset.date)" aria-label="查看 ${esc(item.title)} 的行事曆">${row}</button>`
          :`<div class="listitem">${row}</div>`;
      }).join('')
      :'<div class="empty">未來一個月沒有已登錄的重要時間節點。</div>';
  }

  function renderDashboard({
    document,
    overall,
    todayItemCount,
    weeklyTargetMinutes,
    weekActualMinutes,
    todayActualMinutes,
    date,
    roots,
    selected,
    calc,
    kids,
    deadlines,
    esc
  }){
    document.getElementById('dOverall').textContent=overall+'%';
    document.getElementById('dToday').textContent=todayItemCount;
    document.getElementById('dRun').textContent=
      TimeFormat.hoursLabel(weeklyTargetMinutes);
    document.getElementById('dMin').textContent=
      TimeFormat.minutes(weekActualMinutes);

    const todayActual=document.getElementById('dTodayMin');
    if(todayActual){
      todayActual.textContent=TimeFormat.minutes(todayActualMinutes);
    }

    const dateEl=document.getElementById('homeDateLabel');
    if(dateEl){
      const d=date instanceof Date?date:new Date(date);
      const weekday=['日','一','二','三','四','五','六'][d.getDay()];
      dateEl.textContent=
        `${d.getMonth()+1} 月 ${d.getDate()} 日 · 星期${weekday}`;
    }

    document.getElementById('directions').innerHTML=directionsHTML(
      roots,
      {selected,calc,kids,esc}
    );

    const count=document.getElementById('mainGoalCount');
    if(count)count.textContent=`${roots.length} 個主要目標`;

    document.getElementById('deadlines').innerHTML=
      deadlinesHTML(deadlines,{esc});
  }

  return Object.freeze({
    executeListHTML,
    renderExecuteList,
    decisionListHTML,
    renderDecisionList,
    directionsHTML,
    deadlinesHTML,
    renderDashboard
  });
});
