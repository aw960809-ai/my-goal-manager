/* Analytics page renderer. Metrics are supplied by AnalyticsDomain. */
(function(root,factory){
  const time=typeof module==='object'&&module.exports
    ?require('../time-format.js')
    :root.TimeFormat;
  const api=factory(time);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AnalyticsPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(TimeFormat){
  'use strict';

  if(!TimeFormat)throw new Error('AnalyticsPage requires TimeFormat');

  function formatMinutes(minutes){
    return TimeFormat.shortEnglish(minutes);
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
    setText(document,'weekCreditedKpi',TimeFormat.minutes(week?.creditedGoalMinutes));
    setText(document,'logsN',actualLogCount||0);

    setText(document,'statsWeekRatio',`${week?.ratio||0}%`);
    setWidth(document,'statsWeekBar',`${week?.ratio||0}%`);
    setText(document,'statsActual',TimeFormat.minutes(week?.goalActualMinutes));
    setText(document,'statsCredited',TimeFormat.minutes(week?.creditedGoalMinutes));
    setText(document,'statsOverrun',TimeFormat.minutes(week?.overrunGoalMinutes));
    setText(document,'statsOtherStudy',TimeFormat.minutes(week?.otherStudyMinutes));
    setText(document,'statsTotalStudy',TimeFormat.minutes(week?.totalStudyMinutes));
    setText(document,'statsTarget',TimeFormat.minutes(week?.target));
    setText(document,'statsRemaining',TimeFormat.minutes(week?.remaining));

    const directionHTML=safeDirections.map(row=>{
      const ratio=Math.max(0,Math.min(100,+row.ratio||0));
      const actual=Math.max(0,+row.actual||0),credited=Math.max(0,+row.credited||0),overrun=Math.max(0,+row.overrun||0),target=Math.max(0,+row.target||0);
      return `<div class="direction-row"><div class="direction-head"><b>${esc(row.name)}</b><span>${ratio}%</span></div><div class="direction-track"><div class="direction-fill" style="width:${ratio}%"></div></div><div class="direction-meta"><span>實際 ${TimeFormat.minutes(actual)} 分</span><span>有效 ${TimeFormat.minutes(credited)} 分</span><span>超時 ${TimeFormat.minutes(overrun)} 分</span><span>目標 ${TimeFormat.minutes(target)} 分</span></div></div>`;
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
      ?rows.map(log=>`<div class="listitem deleted-log-row"><div><b>${esc(log.name||getTask(log.taskId)?.name||'未命名行動')}</b><small class="muted" style="display:block">${esc(TimeFormat.dateTimeLabel(log.time)||'—')} · ${TimeFormat.minutes(log.minutes)} 分 · 已刪除</small></div><button class="btn" type="button" onclick="restoreActualLog('${esc(log.id)}')">恢復紀錄</button></div>`).join('')
      :'<div class="empty">尚無已刪除的實際紀錄。</div>';
  }

  function actualHistoryDateKey(log){
    return TimeFormat.dateKey(log?.time)||'無日期';
  }

  function actualHistoryTimeLabel(log){
    return TimeFormat.dateTimeLabel(log?.time)||'—';
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
     <small>${esc(actualHistoryTimeLabel(log))} · ${TimeFormat.minutes(log.minutes)} 分 · ${isOtherStudyLog(log)?'其他讀書':'目標執行'}</small>
   </div>
 </div>`).join('')+
 `<button class="actual-history-open" type="button" onclick="openActualLogHistory()">
   查看全部紀錄（共 ${all.length} 筆） <span>→</span>
 </button>`;
  }

  function actualHistoryModalShell(){
    return `<div class="edit-modal-box actual-history-box">
  <div class="edit-modal-head actual-history-head">
    <div><h2 id="actualHistoryTitle">實際投入歷程</h2></div>
    <button class="edit-modal-close" type="button" onclick="closeActualLogHistory()" aria-label="關閉實際投入歷程">×</button>
  </div>
  <div id="actualHistoryBody"></div>
 </div>`;
  }

  function actualHistoryDayLabel(date,currentYear=Number(TimeFormat.dateKey(new Date()).slice(0,4))){
    const raw=String(date||'');
    const parts=raw.split('-').map(Number);
    if(parts.length!==3||parts.some(x=>!Number.isFinite(x))){
      return raw||'無日期';
    }

    const [year,month,day]=parts;
    const d=new Date(year,month-1,day);
    const weekday=['日','一','二','三','四','五','六'][d.getDay()];
    const core=`${month} 月 ${day} 日・週${weekday}`;

    return year===Number(currentYear)
      ?core
      :`${year} 年 ${core}`;
  }

  function actualHistoryClockLabel(log){
    return TimeFormat.clock(log?.time)||'—';
  }

  function actualHistoryLogName(log,{getTask}){
    return String(
      log?.name||
      getTask(log?.taskId)?.name||
      '未命名行動'
    );
  }

  function actualHistoryTags(log,{isOtherStudyLog}){
    const tags=[];
    if(isOtherStudyLog(log))tags.push('其他讀書');

    const source=String(log?.source||'').toLowerCase();
    if(source==='manual'||source==='manual-backfill'){
      tags.push('補登');
    }else if(source==='import'||source==='legacy'){
      tags.push('匯入');
    }

    return [...new Set(tags)];
  }

  function actualHistoryClusterKey(log,{getTask,isOtherStudyLog}){
    const name=actualHistoryLogName(log,{getTask}).trim().toLowerCase();
    if(isOtherStudyLog(log)){
      return `other:${name}`;
    }

    const taskId=String(log?.taskId||'').trim();
    return `goal:${taskId||name}`;
  }

  function actualHistoryTagHTML(tags,{esc}){
    const rows=Array.isArray(tags)?tags:[];
    return rows.length
      ?`<span class="actual-history-tags">${rows.map(tag=>
        `<em>${esc(tag)}</em>`
      ).join('')}</span>`
      :'';
  }

  function actualHistoryLogRow(log,{
    esc,
    getTask,
    isOtherStudyLog,
    compact=false
  }){
    const name=actualHistoryLogName(log,{getTask});
    const tags=actualHistoryTags(log,{isOtherStudyLog});
    const meta=`${esc(actualHistoryClockLabel(log))} · ${esc(TimeFormat.human(log?.minutes))}`;

    return `<div class="actual-history-row ${compact?'actual-history-row-compact':''}">
      <div class="actual-history-row-main">
        ${compact?'':`<b>${esc(name)}</b>`}
        <small>${meta}${actualHistoryTagHTML(tags,{esc})}</small>
      </div>
      <details class="actual-log-menu">
        <summary aria-label="紀錄操作">⋯</summary>
        <div><button type="button" onclick="deleteActualLogFromHistory('${esc(log?.id)}')">刪除紀錄</button></div>
      </details>
    </div>`;
  }

  function actualHistoryDayHTML(date,logs,{
    currentYear,
    esc,
    getTask,
    isOtherStudyLog
  }){
    const rows=Array.isArray(logs)?logs:[];
    const total=rows.reduce(
      (sum,log)=>sum+Math.max(0,+log?.minutes||0),
      0
    );

    const grouped=new Map();

    rows.forEach(log=>{
      const key=actualHistoryClusterKey(log,{getTask,isOtherStudyLog});
      if(!grouped.has(key))grouped.set(key,[]);
      grouped.get(key).push(log);
    });

    const emitted=new Set();
    const body=rows.map(log=>{
      const key=actualHistoryClusterKey(log,{getTask,isOtherStudyLog});
      const same=grouped.get(key)||[];

      if(same.length<3){
        return actualHistoryLogRow(log,{
          esc,
          getTask,
          isOtherStudyLog
        });
      }

      if(emitted.has(key))return '';
      emitted.add(key);

      const name=actualHistoryLogName(log,{getTask});
      const mins=same.reduce(
        (sum,row)=>sum+Math.max(0,+row?.minutes||0),
        0
      );

      return `<details class="actual-history-cluster">
        <summary>
          <span><b>${esc(name)}</b><small>${same.length} 次 · 共 ${esc(TimeFormat.human(mins))}</small></span>
          <span class="actual-history-cluster-toggle" aria-hidden="true">⌄</span>
        </summary>
        <div class="actual-history-cluster-list">
          ${same.map(row=>actualHistoryLogRow(row,{
            esc,
            getTask,
            isOtherStudyLog,
            compact:true
          })).join('')}
        </div>
      </details>`;
    }).join('');

    return `<details class="actual-history-day" open>
      <summary>
        <span>${esc(actualHistoryDayLabel(date,currentYear))}</span>
        <small>${rows.length} 筆 · ${esc(TimeFormat.human(total))}</small>
      </summary>
      <div class="actual-history-day-list">${body}</div>
    </details>`;
  }

  function actualHistoryBodyHTML({
    filtered,
    totalMinutes,
    taskRows,
    range,
    taskFilter,
    esc,
    getTask,
    isOtherStudyLog,
    currentYear=Number(TimeFormat.dateKey(new Date()).slice(0,4))
  }){
    const rows=Array.isArray(filtered)?filtered:[];
    const groups=new Map();

    rows.forEach(log=>{
      const day=actualHistoryDateKey(log);
      if(!groups.has(day))groups.set(day,[]);
      groups.get(day).push(log);
    });

    const rangeLabel={
      '7':'近 7 日',
      '30':'近 30 日',
      all:'全部'
    }[range]||'近 7 日';

    const filters=`<div class="actual-history-toolbar">
      <div class="actual-history-range" role="group" aria-label="歷程期間">
        <button type="button" class="${range==='7'?'active':''}" onclick="setActualHistoryRange('7')">近 7 日</button>
        <button type="button" class="${range==='30'?'active':''}" onclick="setActualHistoryRange('30')">近 30 日</button>
        <button type="button" class="${range==='all'?'active':''}" onclick="setActualHistoryRange('all')">全部</button>
      </div>
      <details class="actual-history-filter">
        <summary>篩選</summary>
        <div class="actual-history-filter-panel">
          <label>顯示
            <select onchange="setActualHistoryTask(this.value)">
              <option value="all"${taskFilter==='all'?' selected':''}>全部紀錄</option>
              ${(Array.isArray(taskRows)?taskRows:[]).map(([id,name])=>
                `<option value="${esc(id)}"${taskFilter===id?' selected':''}>${esc(name)}</option>`
              ).join('')}
            </select>
          </label>
        </div>
      </details>
    </div>`;

    const summary=`<div class="actual-history-summary">
      <b>${esc(rangeLabel)}</b>
      <span>${rows.length} 筆 · ${esc(TimeFormat.human(totalMinutes))}</span>
    </div>`;

    const grouped=rows.length
      ?[...groups.entries()].map(([date,logs])=>
        actualHistoryDayHTML(date,logs,{
          currentYear,
          esc,
          getTask,
          isOtherStudyLog
        })
      ).join('')
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

      return `<div class="weekly-review-item"><div class="weekly-review-head"><div><b>${esc(item.t.name)}</b><small>目標 ${TimeFormat.minutes(item.w.target)} 分 · 實際 ${TimeFormat.minutes(item.w.actual)} 分 · 未完成 ${TimeFormat.minutes(item.shortfall)} 分</small></div><span class="pill">${calc(item.t)}%</span></div><div class="review-reasons">${reasons.map(reason=>`<button type="button" class="review-reason ${selected===reason?'active':''}" onclick="setWeeklyReview('${String(item.t.id).replace(/'/g,"\\'")}','${reason}', '${date}')">${reason}</button>`).join('')}</div>${selected?`<div class="review-saved">已記錄：${esc(selected)}</div>`:''}</div>`;
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
    actualHistoryDayLabel,
    actualHistoryClockLabel,
    actualHistoryLogName,
    actualHistoryTags,
    actualHistoryClusterKey,
    actualHistoryLogRow,
    actualHistoryDayHTML,
    recentActualLogsHTML,
    actualHistoryModalShell,
    actualHistoryBodyHTML,
    weeklyReviewHTML
  });
});
