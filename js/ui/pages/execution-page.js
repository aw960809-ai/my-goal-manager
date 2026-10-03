/* Execution page renderer. Scheduling and timing rules stay in services/domains. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ExecutionPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function plannedQueueHTML({plans,today,esc,getTask}){
    const rows=Array.isArray(plans)?plans:[];

    return rows.slice(0,8).map(x=>{
      const isToday=x.date===today;
      return `<div class="listitem planned-row"><div><b>${esc(x.name||getTask(x.taskId)?.name||'未命名行動')}</b><small class="muted" style="display:block">${esc(x.date)} ${esc(x.time)} · ${esc(x.minutes)} 分鐘${isToday?' · 今日':''}</small></div><div class="planned-actions"><span class="planned-status">${isToday?'待執行':'已安排'}</span><button class="btn" type="button" onclick="openTodayExecution('${esc(x.taskId)}','${esc(x.id)}')">選取</button><button class="dangerbtn" type="button" onclick="cancelExecutionPlan('${esc(x.id)}')">取消安排</button></div></div>`;
    }).join('')||
      '<div class="empty">尚未安排未來執行項目。可在「目標地圖 → 具體實現方式 → 安排執行」建立。</div>';
  }

  function todayItemHTML({
    task,
    timer,
    currentWeekSummary,
    executionPlans,
    activeExecutionPlan,
    today,
    ancestors,
    esc,
    calc
  }){
    const isSelected=String(timer.id)===String(task.id);
    const week=currentWeekSummary(task);

    const plans=(Array.isArray(executionPlans)?executionPlans:[])
      .filter(x=>
        String(x.taskId)===String(task.id)&&
        activeExecutionPlan(x)
      )
      .sort((a,b)=>(a.date+' '+a.time).localeCompare(b.date+' '+b.time));

    const todayPlan=plans.find(x=>x.date===today);
    const path=ancestors(task.id).slice(0,-1).map(x=>x.name).join(' › ');

    return `<div class="listitem ${isSelected?'today-item-selected':''}"><div class="today-item-main"><span class="today-select-icon" aria-hidden="true">${isSelected?'✓':'○'}</span><div class="today-item-copy"><b>${esc(task.name)}</b><small class="muted today-metrics">${todayPlan?`今日 ${esc(todayPlan.time)} · 預計 ${esc(todayPlan.minutes)} 分 · `:''}本週 ${week.actual}/${week.target} 分 · 剩餘 ${week.remaining} 分 · ${calc(task)}%</small>${path?`<small class="today-path" title="${esc(path)}">${esc(path)}</small>`:''}</div></div><div class="today-actions">${isSelected?'<span class="today-selected-label">● 已選取</span>':''}<button class="btn" onclick="selectTodayExecution('${task.id}','${todayPlan?esc(todayPlan.id):''}')">${isSelected?'重新選取':'選取'}</button><button class="btn primary" onclick="startTodayExecution('${task.id}','${todayPlan?esc(todayPlan.id):''}')">開始</button></div></div>`;
  }

  function todayListHTML({
    items,
    totalCount,
    expanded,
    timer,
    currentWeekSummary,
    executionPlans,
    activeExecutionPlan,
    today,
    ancestors,
    esc,
    calc
  }){
    const rows=(Array.isArray(items)?items:[]).map(task=>todayItemHTML({
      task,
      timer,
      currentWeekSummary,
      executionPlans,
      activeExecutionPlan,
      today,
      ancestors,
      esc,
      calc
    })).join('')||
      '<div class="empty">目前沒有可投入的具體實現方式。</div>';

    const toggle=totalCount>5
      ?`<div style="display:flex;justify-content:center;padding:10px 0 2px"><button class="btn" type="button" onclick="toggleTodayItemsPreview()">${expanded?'收合為 5 項':`顯示全部（${totalCount} 項）`}</button></div>`
      :'';

    return rows+toggle;
  }

  function renderPlannedQueue({
    document,
    plans,
    today,
    esc,
    getTask
  }){
    const box=document.getElementById('plannedQueue');
    const count=document.getElementById('plannedQueueCount');
    if(!box)return;

    if(count)count.textContent=plans.length?`${plans.length} 項`:'尚無安排';

    box.innerHTML=plannedQueueHTML({
      plans,
      today,
      esc,
      getTask
    });
  }

  function renderToday({
    document,
    items,
    totalCount,
    expanded,
    timer,
    currentWeekSummary,
    executionPlans,
    activeExecutionPlan,
    today,
    ancestors,
    esc,
    calc
  }){
    const list=document.getElementById('todayList');
    if(!list)return;

    list.innerHTML=todayListHTML({
      items,
      totalCount,
      expanded,
      timer,
      currentWeekSummary,
      executionPlans,
      activeExecutionPlan,
      today,
      ancestors,
      esc,
      calc
    });
  }

  return Object.freeze({
    plannedQueueHTML,
    todayItemHTML,
    todayListHTML,
    renderPlannedQueue,
    renderToday
  });
});
