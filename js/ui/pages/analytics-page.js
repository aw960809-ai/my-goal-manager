/* Analytics page renderer. Metrics are supplied by AnalyticsDomain. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AnalyticsPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function formatMinutes(minutes){
    const n=Math.max(0,Math.round(+minutes||0));
    const h=Math.floor(n/60);
    const m=n%60;
    return h?`${h}h ${m}m`:`${m}m`;
  }

  function setText(document,id,value){
    const el=document.getElementById(id);
    if(el)el.textContent=String(value);
  }

  function setHTML(document,id,value){
    const el=document.getElementById(id);
    if(el)el.innerHTML=value;
  }

  function setWidth(document,id,value){
    const el=document.getElementById(id);
    if(el&&el.style)el.style.width=value;
  }

  function renderStats({
    document,
    leaves,
    done,
    avg,
    week,
    directionRows,
    actualLogCount,
    esc,
    calc
  }){
    const safeLeaves=Array.isArray(leaves)?leaves:[];
    const safeDirections=Array.isArray(directionRows)?directionRows:[];

    setText(document,'leafDone',`${done}/${safeLeaves.length}`);
    setText(document,'avg',`${avg}%`);
    setText(document,'weekCreditedKpi',week?.creditedGoalMinutes||0);
    setText(document,'logsN',actualLogCount||0);

    setText(document,'statsWeekRatio',`${week?.ratio||0}%`);
    setWidth(document,'statsWeekBar',`${week?.ratio||0}%`);
    setText(document,'statsActual',week?.goalActualMinutes||0);
    setText(document,'statsCredited',week?.creditedGoalMinutes||0);
    setText(document,'statsOverrun',week?.overrunGoalMinutes||0);
    setText(document,'statsOtherStudy',week?.otherStudyMinutes||0);
    setText(document,'statsTotalStudy',week?.totalStudyMinutes||0);
    setText(document,'statsTarget',week?.target||0);
    setText(document,'statsRemaining',week?.remaining||0);

    const directionHTML=safeDirections.map(row=>{
      const ratio=Math.max(0,Math.min(100,+row.ratio||0));
      const actual=Math.max(0,+row.actual||0),credited=Math.max(0,+row.credited||0),overrun=Math.max(0,+row.overrun||0),target=Math.max(0,+row.target||0);
      return `<div class="direction-row"><div class="direction-head"><b>${esc(row.name)}</b><span>${ratio}%</span></div><div class="direction-track"><div class="direction-fill" style="width:${ratio}%"></div></div><div class="direction-meta"><span>實際 ${actual} 分</span><span>有效 ${credited} 分</span><span>超時 ${overrun} 分</span><span>目標 ${target} 分</span></div></div>`;
    }).join('')||'<div class="empty">尚無有效方向</div>';
    setHTML(document,'domains',directionHTML);

    const buckets=[
      ['尚未開始',0],
      ['進行中',0],
      ['高完成度',0],
      ['已完成',0]
    ];

    safeLeaves.forEach(task=>{
      let progress=0;
      try{
        progress=Math.max(0,Math.min(100,+calc(task)||0));
      }catch(error){
        if(typeof console!=='undefined'&&console.error){
          console.error('[GoalManager:analytics-progress]',error);
        }
      }

      if(progress===100)buckets[3][1]++;
      else if(progress>=70)buckets[2][1]++;
      else if(progress>0)buckets[1][1]++;
      else buckets[0][1]++;
    });

    const distributionHTML=buckets.map(bucket=>{
      const pct=safeLeaves.length
        ?Math.round(bucket[1]/safeLeaves.length*100)
        :0;

      return `<div class="distribution-row"><div class="distribution-head"><span>${bucket[0]}</span><b>${pct}%</b></div><div class="distribution-track"><div class="distribution-fill" style="width:${pct}%"></div></div><div class="distribution-meta">${bucket[1]} 個具體行動</div></div>`;
    }).join('');

    setHTML(document,'progressDistribution',distributionHTML);
  }

  function deletedLogsHTML(logs,{esc,getTask}){
    const rows=Array.isArray(logs)?logs:[];
    return rows.length
      ?rows.map(log=>`<div class="listitem deleted-log-row"><div><b>${esc(log.name||getTask(log.taskId)?.name||'未命名行動')}</b><small class="muted" style="display:block">${esc((log.time||'').slice(0,16).replace('T',' · '))} · ${+log.minutes||0} 分 · 已刪除</small></div><button class="btn" type="button" onclick="restoreActualLog('${esc(log.id)}')">恢復紀錄</button></div>`).join('')
      :'<div class="empty">尚無已刪除的實際紀錄。</div>';
  }

  function actualHistoryDateKey(log){
    return String(log?.time||'').slice(0,10)||'無日期';
  }

  function actualHistoryTimeLabel(log){
    const raw=String(log?.time||'');
    const date=raw.slice(0,10)||'—';
    const time=raw.slice(11,16)||'';
    return time?date+' · '+time:date;
  }

  function recentActualLogsHTML(logs,{esc,getTask,isOtherStudyLog}){
    const all=Array.isArray(logs)?logs:[];
    if(!all.length){
      return '<div class="empty">尚無實際投入紀錄</div>';
    }

    const recent=all.slice(0,5);

    return recent.map(log=>`<div class="actual-log-compact-row">
   <div class="actual-log-compact-main">
     <b>${esc(log.name||getTask(log.taskId)?.name||'未命名行動')}</b>
     <small>${esc(actualHistoryTimeLabel(log))} · ${Math.max(0,+log.minutes||0)} 分 · ${isOtherStudyLog(log)?'其他讀書':'目標執行'}</small>
   </div>
 </div>`).join('')+
 `<button class="actual-history-open" type="button" onclick="openActualLogHistory()">
   查看全部紀錄（共 ${all.length} 筆） <span>→</span>
 </button>`;
  }

  function actualHistoryModalShell(){
    return `<div class="edit-modal-box actual-history-box">
  <div class="edit-modal-head">
    <div><h2 id="actualHistoryTitle">實際投入歷程</h2><p>完整紀錄仍參與完成度與分析；此處只改變瀏覽方式。</p></div>
    <button class="edit-modal-close" type="button" onclick="closeActualLogHistory()" aria-label="關閉實際投入歷程">×</button>
  </div>
  <div id="actualHistoryBody"></div>
 </div>`;
  }

  function actualHistoryBodyHTML({
    filtered,
    totalMinutes,
    taskRows,
    range,
    taskFilter,
    esc,
    getTask,
    isOtherStudyLog
  }){
    const groups=new Map();

    (Array.isArray(filtered)?filtered:[]).forEach(log=>{
      const day=actualHistoryDateKey(log);
      if(!groups.has(day))groups.set(day,[]);
      groups.get(day).push(log);
    });

    const filters=`<div class="actual-history-controls">
   <div class="actual-history-range" role="group" aria-label="歷程期間">
     <button type="button" class="${range==='7'?'active':''}" onclick="setActualHistoryRange('7')">近 7 日</button>
     <button type="button" class="${range==='30'?'active':''}" onclick="setActualHistoryRange('30')">近 30 日</button>
     <button type="button" class="${range==='all'?'active':''}" onclick="setActualHistoryRange('all')">全部</button>
   </div>
   <label class="actual-history-task-filter">紀錄類型／具體實現方式
     <select onchange="setActualHistoryTask(this.value)">
       <option value="all"${taskFilter==='all'?' selected':''}>全部</option>
       ${(Array.isArray(taskRows)?taskRows:[]).map(([id,name])=>`<option value="${esc(id)}"${taskFilter===id?' selected':''}>${esc(name)}</option>`).join('')}
     </select>
   </label>
 </div>`;

    const summary=`<div class="actual-history-summary">
   <span>目前顯示 <b>${filtered.length}</b> 筆</span>
   <span>合計 <b>${totalMinutes}</b> 分</span>
 </div>`;

    const grouped=filtered.length
      ?[...groups.entries()].map(([date,logs])=>{
        const mins=logs.reduce(
          (sum,log)=>sum+Math.max(0,+log.minutes||0),
          0
        );

        return `<details class="actual-history-day" open>
    <summary><span>${esc(date)}</span><small>${logs.length} 筆 · ${mins} 分</small></summary>
    <div class="actual-history-day-list">
      ${logs.map(log=>`<div class="actual-history-row">
        <div class="actual-history-row-main">
          <b>${esc(log.name||getTask(log.taskId)?.name||'未命名行動')}</b>
          <small>${esc(actualHistoryTimeLabel(log))} · ${Math.max(0,+log.minutes||0)} 分 · ${isOtherStudyLog(log)?'其他讀書':'目標執行'}</small>
        </div>
        <details class="actual-log-menu">
          <summary aria-label="紀錄操作">⋯</summary>
          <div><button type="button" onclick="deleteActualLogFromHistory('${esc(log.id)}')">刪除紀錄</button></div>
        </details>
      </div>`).join('')}
    </div>
   </details>`;
      }).join('')
      :'<div class="empty">這個篩選條件下沒有實際投入紀錄。</div>';

    return filters+summary+
      `<div class="actual-history-groups">${grouped}</div>`;
  }

  function weeklyReviewHTML(items,{date,reasons,esc,calc}){
    const rows=Array.isArray(items)?items:[];

    if(!rows.length){
      return '<div class="review-empty">上週沒有需要補記原因的未完成事項。</div>';
    }

    return rows.map(item=>{
      const selected=item.review?.reason||'';

      return `<div class="weekly-review-item"><div class="weekly-review-head"><div><b>${esc(item.t.name)}</b><small>目標 ${item.w.target} 分 · 實際 ${item.w.actual} 分 · 未完成 ${item.shortfall} 分</small></div><span class="pill">${calc(item.t)}%</span></div><div class="review-reasons">${reasons.map(reason=>`<button type="button" class="review-reason ${selected===reason?'active':''}" onclick="setWeeklyReview('${String(item.t.id).replace(/'/g,"\\'")}','${reason}', '${date}')">${reason}</button>`).join('')}</div>${selected?`<div class="review-saved">已記錄：${esc(selected)}</div>`:''}</div>`;
    }).join('');
  }

  return Object.freeze({
    formatMinutes,
    renderStats,
    setText,
    setHTML,
    setWidth,
    deletedLogsHTML,
    actualHistoryDateKey,
    actualHistoryTimeLabel,
    recentActualLogsHTML,
    actualHistoryModalShell,
    actualHistoryBodyHTML,
    weeklyReviewHTML
  });
});
