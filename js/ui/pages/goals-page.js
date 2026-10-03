/* Goals page renderer. Hierarchy and period rules stay in GoalDomain. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GoalsPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function browseMeta(task,{
    kids,
    periodLabel,
    executionSummary,
    calc,
    levelLabels
  }){
    const childCount=kids(task.id).filter(x=>x.status!=='已封存').length;

    if(task.level===4){
      const summary=executionSummary(task);
      return `本週 ${summary.weeklyActual}/${summary.weeklyTarget} 分 · 剩餘 ${summary.weeklyRemaining} 分 · 累計 ${calc(task)}%`;
    }

    if(task.level===3){
      return `${periodLabel(task)} · ${childCount} 個具體行動`;
    }

    return `${childCount} 個${levelLabels[task.level+1]||'下層目標'} · 完成度 ${calc(task)}%`;
  }

  function browseCard(task,deps){
    const p=deps.calc(task);
    const childCount=deps.kids(task.id).filter(x=>x.status!=='已封存').length;
    const action=task.level===4?'查看':'進入';

    return `<article class="goal-browse-card level-${task.level}">
   <button class="goal-browse-main" type="button" onclick="browseGoal('${task.id}')">
     <span class="goal-browse-level">${deps.esc(deps.levelLabels[task.level])}</span>
     <b>${deps.esc(task.name)}</b>
     <small>${deps.esc(browseMeta(task,deps))}</small>
     <span class="goal-browse-progress"><i style="width:${p}%"></i></span>
   </button>
   <div class="goal-browse-side">
     <span class="goal-browse-pct">${p}%</span>
     <span class="goal-browse-status ${task.status==='已完成'?'done':task.status==='進行中'?'run':''}">${deps.esc(task.status)}</span>
     <button class="goal-browse-info" type="button" aria-label="查看 ${deps.esc(task.name)} 資訊" onclick="openGoalInfoModal('${task.id}')">ⓘ</button>
     <span class="goal-browse-enter">${action}${task.level<4&&childCount?` · ${childCount}`:''}</span>
   </div>
 </article>`;
  }

  function renderBrowse({
    document,
    current,
    chain,
    rows,
    levelLabels,
    calc,
    kids,
    periodLabel,
    executionSummary,
    esc
  }){
    const list=document.getElementById('goalBrowseList');
    const crumb=document.getElementById('goalBreadcrumb');
    const context=document.getElementById('goalBrowseContext');
    const up=document.getElementById('goalBrowseUp');
    const add=document.getElementById('goalBrowseAdd');

    if(!list||!crumb||!context)return;

    const deps={
      levelLabels,
      calc,
      kids,
      periodLabel,
      executionSummary,
      esc
    };

    crumb.innerHTML=
      `<button type="button" onclick="browseGoalTo('')">全部方向</button>`+
      (Array.isArray(chain)?chain:[]).map(x=>
        `<span>›</span><button type="button" onclick="browseGoalTo('${x.id}')">${esc(x.name)}</button>`
      ).join('');

    const progress=current?calc(current):0;

    context.innerHTML=current
      ?`<div><small>${esc(levelLabels[current.level])}</small><b>${esc(current.name)}</b><span>完成度 ${progress}% · ${rows.length} 個下層</span></div><button type="button" onclick="openGoalInfoModal('${current.id}')">詳細資訊 →</button>`
      :`<div><small>ROOT</small><b>主要方向</b><span>${rows.length} 個主要目標</span></div><button type="button" onclick="setGoalViewMode('map')">查看完整地圖 →</button>`;

    list.innerHTML=rows.length
      ?rows.map(task=>browseCard(task,deps)).join('')
      :'<div class="empty">這一層目前沒有下層目標。</div>';

    if(up){
      up.disabled=!current;
      up.textContent=current?'← 上一層':'已在最上層';
    }

    if(add){
      add.textContent=current
        ?`＋ 新增${levelLabels[Math.min(4,current.level+1)]}`
        :'＋ 新增方向';
    }
  }

  function resultCard(task,{
    ancestors,
    calc,
    periodLabel,
    levelLabels,
    esc,
    isOpen
  }){
    const chain=ancestors(task.id);
    const path=chain.map(x=>esc(x.name)).join(' → ');
    const progress=calc(task);
    const parent=chain.length>1?chain[chain.length-2].name:'頂層主要目標';

    return `<div class="goal-result-card" id="search-result-${task.id}"><div><div class="goal-result-name">${esc(task.name)}<small>${levelLabels[task.level]}</small></div><div class="goal-result-path">位置：${path}</div><div class="goal-result-meta">完成度 ${progress}% · 父層：${esc(parent)}${(task.level===3||task.level===4)?' · '+esc(periodLabel(task)):''}</div></div><div class="goal-result-actions"><button class="btn" type="button" onclick="openSearchEdit('${task.id}')">編輯</button>${task.level<4?`<button class="softbtn" type="button" onclick="toggleSearchBranch('${task.id}')">${isOpen(task.id)?'收合父子樹':'展開父子樹'}</button>`:''}</div></div>`;
  }

  function renderSearchResults({
    document,
    matches,
    query,
    statusFilter,
    levelFilter,
    ancestors,
    calc,
    periodLabel,
    levelLabels,
    esc,
    isOpen
  }){
    const tree=document.getElementById('tree');
    if(!tree)return false;

    const mode=!!(
      query||
      statusFilter!=='all'||
      levelFilter!=='all'
    );

    if(!mode)return false;

    const labels=[];
    if(query)labels.push('搜尋「'+query+'」');
    if(statusFilter!=='all')labels.push('狀態：'+statusFilter);
    if(levelFilter!=='all'){
      labels.push(
        '層級：'+({
          1:'方向',
          2:'階段目標',
          3:'子任務',
          4:'具體實現方式'
        }[levelFilter]||levelFilter)
      );
    }

    const deps={
      ancestors,
      calc,
      periodLabel,
      levelLabels,
      esc,
      isOpen
    };

    tree.innerHTML=
      `<div class="goal-result-mode"><span><strong>直接結果</strong>　${esc(labels.join(' · '))}</span><span>${matches.length} 筆</span></div>`+
      `<div class="goal-results">${matches.length?matches.map(task=>resultCard(task,deps)).join(''):'<div class="empty">沒有符合目前搜尋／篩選條件的目標。</div>'}</div>`;

    const state=document.getElementById('goalFilterState');

    if(state){
      state.innerHTML=
        `<span>結果已直接對應到符合條件的階層，不再只顯示根方向。</span><span>${matches.length} 筆</span>`;
    }

    return true;
  }

  return Object.freeze({
    browseMeta,
    browseCard,
    renderBrowse,
    resultCard,
    renderSearchResults
  });
});
