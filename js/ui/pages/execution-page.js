/* Execution page renderer: direct selection -> timing -> study log. */
(function(root,factory){
  const time=typeof module==='object'&&module.exports
    ?require('../time-format.js')
    :root.TimeFormat;
  const api=factory(time);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ExecutionPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(TimeFormat){
  'use strict';

  if(!TimeFormat)throw new Error('ExecutionPage requires TimeFormat');

  function todayItemHTML({task,timer,currentWeekSummary,ancestors,esc,calc}){
    const isSelected=String(timer.id)===String(task.id);
    const week=currentWeekSummary(task);
    const path=ancestors(task.id).slice(0,-1).map(x=>x.name).join(' › ');
    const credited=Math.max(0,+week.credited||Math.min(+week.actual||0,+week.target||0));
    const overrun=Math.max(0,+week.overrun||0);
    const overrunText=overrun?` · 超時 ${TimeFormat.minutes(overrun)} 分`:'';
    return `<div class="listitem ${isSelected?'today-item-selected':''}"><div class="today-item-main"><span class="today-select-icon" aria-hidden="true">${isSelected?'✓':'○'}</span><div class="today-item-copy"><b>${esc(task.name)}</b><small class="muted today-metrics">本週 ${TimeFormat.minutes(week.actual)}/${TimeFormat.minutes(week.target)} 分 · 有效 ${TimeFormat.minutes(credited)} 分 · 剩餘 ${TimeFormat.minutes(week.remaining)} 分${overrunText} · ${calc(task)}%</small>${path?`<small class="today-path" title="${esc(path)}">${esc(path)}</small>`:''}</div></div><div class="today-actions">${isSelected?'<span class="today-selected-label">● 已選取</span>':''}<button class="btn" onclick="selectTodayExecution('${task.id}')">${isSelected?'重新選取':'選取'}</button><button class="btn primary" onclick="startTodayExecution('${task.id}')">開始</button></div></div>`;
  }

  function todayListHTML({items,totalCount,expanded,timer,currentWeekSummary,ancestors,esc,calc}){
    const rows=(Array.isArray(items)?items:[]).map(task=>todayItemHTML({task,timer,currentWeekSummary,ancestors,esc,calc})).join('')||'<div class="empty">目前沒有可投入的具體實現方式。</div>';
    const toggle=totalCount>5?`<div style="display:flex;justify-content:center;padding:10px 0 2px"><button class="btn" type="button" onclick="toggleTodayItemsPreview()">${expanded?'收合為 5 項':`顯示全部（${totalCount} 項）`}</button></div>`:'';
    return rows+toggle;
  }

  function renderToday({document,items,totalCount,expanded,timer,currentWeekSummary,ancestors,esc,calc}){
    const list=document.getElementById('todayList');if(!list)return;
    list.innerHTML=todayListHTML({items,totalCount,expanded,timer,currentWeekSummary,ancestors,esc,calc});
  }

  return Object.freeze({todayItemHTML,todayListHTML,renderToday});
});
