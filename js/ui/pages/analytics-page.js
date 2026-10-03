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

  function executionAnalysisHTML(analysis,{timerRunning=false}={}){
    const a=analysis;
    const fmt=formatMinutes;
    const gap=a.planActualMinutes-a.plannedMinutes;

    const executionRateValue=
      a.executionRate===null?'—':a.executionRate+'%';

    const timeRateValue=
      a.timeRate===null?'—':a.timeRate+'%';

    const executionRateText=
      a.executionRate===null
        ?'目前沒有有效執行安排可計算'
        :'已開始實際執行／有效安排';

    const timeRateText=
      a.timeRate===null
        ?'目前沒有有效執行安排可計算'
        :`計畫實際 ${fmt(a.planActualMinutes)} ／有效計畫 ${fmt(a.plannedMinutes)}${timerRunning?' · 計時中即時計入':''}`;

    const estimateValue=
      a.estimateAccuracy===null?'—':a.estimateAccuracy+'%';

    const estimateText=
      a.estimateAccuracy===null
        ?'待至少一筆有效計畫達成後評估'
        :'以已達成有效計畫的預計／實際差距計算';

    const cancelledActual=Math.max(
      0,
      +a.cancelledPlanActualMinutes||0
    );

    return `<div class="execution-analysis-group-title">計畫 × 實際執行 <small>有效安排與實際投入分開統計</small></div>
 <div class="execution-analysis-kpis">
   <div><small>計畫實際執行率</small><b>${executionRateValue}</b><span>${a.startedPlans.length} / ${a.scheduledPlans.length} 次 · ${executionRateText}</span></div>
   <div><small>時間達成率</small><b>${timeRateValue}</b><span>${timeRateText}</span></div>
   <div><small>逾期未達計畫</small><b>${a.expiredPlans.length}</b><span>取消不列入失敗 · 已達成 ${a.fulfilledPlans.length} 次</span></div>
   <div><small>估時吻合度</small><b>${estimateValue}</b><span>${estimateText}</span></div>
 </div>
 <div class="execution-analysis-detail">
   <span>本週有效執行安排 <b>${fmt(a.plannedMinutes)}</b></span>
   <span>有效安排實際 <b>${fmt(a.planActualMinutes)}</b></span>
   <span>本週目標實際 <b>${fmt(a.actualMinutes)}</b></span>
   <span>其他讀書 <b>${fmt(a.otherStudyMinutes)}</b></span>
   <span>總讀書時間 <b>${fmt(a.totalStudyMinutes)}</b></span>
   <span>未配對安排之目標實際 <b>${fmt(a.unplannedActualMinutes)}</b></span>
   <span>已取消安排 <b>${a.cancelledPlans.length}</b></span>
   ${cancelledActual?`<span>已取消安排之歷史實際 <b>${fmt(cancelledActual)}</b></span>`:''}
   <span>安排差額 <b>${gap>=0?'+':''}${fmt(Math.abs(gap))}</b></span>
   <span>已達安排 <b>${a.fulfilledPlans.length}/${a.scheduledPlans.length}</b></span>
 </div>`;
  }

  function renderExecutionAnalysis({
    document,
    analysis,
    timerRunning=false
  }){
    const el=document.getElementById('executionAnalysis');
    if(!el)return;
    el.innerHTML=executionAnalysisHTML(
      analysis,
      {timerRunning}
    );
  }

  function renderStats({
    document,
    leaves,
    done,
    avg,
    planAnalysis,
    week,
    rootsActive,
    currentWeekTargetForRoot,
    actualLogCount,
    esc,
    calc
  }){
    document.getElementById('leafDone').textContent=
      done+'/'+leaves.length;

    document.getElementById('avg').textContent=
      avg+'%';

    document.getElementById('est').textContent=
      planAnalysis.plannedMinutes;

    document.getElementById('logsN').textContent=
      actualLogCount;

    document.getElementById('statsWeekRatio').textContent=
      week.ratio+'%';

    document.getElementById('statsWeekBar').style.width=
      week.ratio+'%';

    document.getElementById('statsActual').textContent=
      week.goalActualMinutes;

    const otherEl=document.getElementById('statsOtherStudy');
    if(otherEl)otherEl.textContent=week.otherStudyMinutes;

    const totalEl=document.getElementById('statsTotalStudy');
    if(totalEl)totalEl.textContent=week.totalStudyMinutes;

    document.getElementById('statsTarget').textContent=
      week.target;

    document.getElementById('statsRemaining').textContent=
      week.remaining;

    document.getElementById('domains').innerHTML=
      rootsActive.map(task=>{
        const minutes=currentWeekTargetForRoot(task);
        const pct=week.target
          ?Math.round(minutes/week.target*100)
          :0;

        return `<div class="direction-row"><div class="direction-head"><b>${esc(task.name)}</b><span>${minutes} 分 · ${pct}%</span></div><div class="direction-track"><div class="direction-fill" style="width:${Math.min(100,pct)}%"></div></div></div>`;
      }).join('')||
      '<div class="empty">尚無有效方向</div>';

    const buckets=[
      ['尚未開始',0],
      ['進行中',0],
      ['高完成度',0],
      ['已完成',0]
    ];

    leaves.forEach(task=>{
      const progress=calc(task);
      if(progress===100)buckets[3][1]++;
      else if(progress>=70)buckets[2][1]++;
      else if(progress>0)buckets[1][1]++;
      else buckets[0][1]++;
    });

    document.getElementById('progressDistribution').innerHTML=
      buckets.map(bucket=>{
        const pct=leaves.length
          ?Math.round(bucket[1]/leaves.length*100)
          :0;

        return `<div class="distribution-row"><div class="distribution-head"><span>${bucket[0]}</span><b>${pct}%</b></div><div class="distribution-track"><div class="distribution-fill" style="width:${pct}%"></div></div><div class="distribution-meta">${bucket[1]} 個具體行動</div></div>`;
      }).join('');
  }

  return Object.freeze({
    formatMinutes,
    executionAnalysisHTML,
    renderExecutionAnalysis,
    renderStats
  });
});
