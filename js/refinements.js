
/* Goal Manager V98.13.2: production UI refinement; core state and storage untouched. */
(function(){
  'use strict';
  if(!document.getElementById('goals'))return;

  function byId(id){return document.getElementById(id)}

  function installUnifiedGoalSearch(){
    const browse=byId('goalBrowsePanel');
    if(!browse||byId('gmGoalSearchDisclosure'))return;
    const context=byId('goalBrowseContext');
    const d=document.createElement('details');
    d.id='gmGoalSearchDisclosure';
    d.className='gm-goal-search';
    d.innerHTML='<summary>⌕ 搜尋所有目標 <small>快速定位四個層級</small></summary>'+
      '<div class="gm-goal-search-content">'+
        '<input class="gm-goal-search-input" id="gmGoalSearchInput" type="search" placeholder="輸入目標名稱或關鍵字…" autocomplete="off" aria-label="搜尋所有目標">'+
        '<div class="gm-goal-search-filters">'+
          '<label>狀態<select id="gmGoalSearchStatus"><option value="all">全部狀態</option><option value="未開始">未開始</option><option value="進行中">進行中</option><option value="已完成">已完成</option></select></label>'+
          '<label>層級<select id="gmGoalSearchLevel"><option value="all">全部層級</option><option value="1">方向</option><option value="2">階段目標</option><option value="3">子任務</option><option value="4">具體行動</option></select></label>'+
        '</div>'+
        '<div class="gm-goal-search-count" id="gmGoalSearchCount">輸入名稱即可搜尋全部四級目標。</div>'+
        '<div class="gm-goal-search-results" id="gmGoalSearchResults" aria-live="polite"></div>'+
      '</div>';
    if(context)browse.insertBefore(d,context);
    else browse.appendChild(d);
    for(const selector of ['gmGoalSearchInput','gmGoalSearchStatus','gmGoalSearchLevel']){
      byId(selector)?.addEventListener(selector==='gmGoalSearchInput'?'input':'change',renderGoalSearchResults);
    }
    d.addEventListener('toggle',function(){if(d.open)renderGoalSearchResults()});
  }

  function renderGoalSearchResults(){
    const region=byId('gmGoalSearchResults'),count=byId('gmGoalSearchCount');
    if(!region||!count)return;
    const input=byId('gmGoalSearchInput');
    const q=String(input?.value||'').trim().toLocaleLowerCase();
    const status=byId('gmGoalSearchStatus')?.value||'all';
    const level=byId('gmGoalSearchLevel')?.value||'all';
    const all=typeof db!=='undefined'&&Array.isArray(db?.tasks)?db.tasks:[];
    const filtered=all.filter(t=>{
      if(t.status==='已封存')return false;
      if(status!=='all'&&t.status!==status)return false;
      if(level!=='all'&&String(t.level)!==level)return false;
      if(!q)return status!=='all'||level!=='all';
      return String(t.name||'').toLocaleLowerCase().includes(q);
    }).slice(0,30);
    region.replaceChildren();
    if(!q&&status==='all'&&level==='all'){
      count.textContent='輸入名稱，或選擇狀態與層級，即可搜尋所有目標。';
      return;
    }
    count.textContent=filtered.length===30?'顯示前 30 筆結果，可輸入更精確名稱。':'找到 '+filtered.length+' 筆目標';
    if(!filtered.length){
      const empty=document.createElement('p');
      empty.textContent='沒有符合條件的目標，請調整搜尋字詞或篩選。';
      empty.className='gm-goal-search-count';
      region.appendChild(empty);
      return;
    }
    filtered.forEach(t=>{
      const row=document.createElement('div');
      row.className='gm-goal-search-row';
      const info=document.createElement('div');
      const title=document.createElement('b');
      title.textContent=String(t.name||'未命名目標');
      const path=document.createElement('small');
      let parents=[];
      try{parents=ancestors(t.id).map(x=>String(x.name||'')).filter(Boolean)}catch(_){}
      path.textContent=(parents.length?parents.join(' → '):'目標層級 '+String(t.level))+' · '+String(t.status||'');
      info.append(title,path);
      const action=document.createElement('button');
      action.type='button';
      action.textContent=Number(t.level)===4?'查看詳情':'進入此層';
      action.addEventListener('click',function(){
        if(Number(t.level)===4){
          if(typeof browseGoalTo==='function')browseGoalTo(String(t.parent||''));
          if(typeof openGoalInfoModal==='function')openGoalInfoModal(String(t.id));
        }else if(typeof browseGoalTo==='function'){
          browseGoalTo(String(t.id));
          byId('gmGoalSearchDisclosure').open=false;
          byId('goalBrowseContext')?.scrollIntoView({block:'start',behavior:'smooth'});
        }
      });
      row.append(info,action);
      region.appendChild(row);
    });
  }

  function openUnifiedGoalSearch(){
    installUnifiedGoalSearch();
    const search=byId('gmGoalSearchDisclosure');
    if(search){
      search.open=true;
      renderGoalSearchResults();
      byId('gmGoalSearchInput')?.focus();
      search.scrollIntoView({block:'nearest',behavior:'smooth'});
    }
  }

  function installGoals(){
    if(typeof window.renderGoalsPage!=='function'||typeof window.renderGoalBrowse!=='function')return;
    const browse=byId('goalBrowsePanel');
    const toolbar=browse?.querySelector('.goal-browse-toolbar');
    const breadcrumbs=byId('goalBreadcrumb');
    const add=byId('goalBrowseAdd');
    const context=byId('goalBrowseContext');
    if(!browse||!toolbar||!breadcrumbs||!add||!context)return;

    // Reuse the canonical breadcrumbs and add action; no duplicated root card,
    // separate back button or second search button. Existing handlers remain.
    const location=document.createElement('div');
    location.className='gm-goal-location';
    const count=document.createElement('small');
    count.id='gmGoalLocationCount';
    count.className='gm-goal-count';
    location.append(breadcrumbs,count);
    toolbar.replaceChildren(location,add);
    toolbar.classList.add('gm-goal-toolbar');

    installUnifiedGoalSearch();

    const originalBrowse=window.renderGoalBrowse;
    window.renderGoalBrowse=function(){
      const result=originalBrowse.apply(this,arguments);
      const current=typeof goalBrowseCurrent==='function'?goalBrowseCurrent():null;
      const total=byId('goalBrowseList')?.querySelectorAll('.goal-browse-card').length||0;
      const isRoot=!current;
      count.textContent=isRoot
        ?total+' 個主要目標'
        :total+' 個'+(current.level===3?'具體行動':'下層目標');
      context.hidden=isRoot;
      if(byId('gmGoalSearchDisclosure')?.open)renderGoalSearchResults();
      return result;
    };

    const originalPage=window.renderGoalsPage;
    window.renderGoalsPage=function(){
      const browsePanel=byId('goalBrowsePanel'),mapPanel=byId('goalMapPanel');
      if(!browsePanel||!mapPanel)return originalPage.apply(this,arguments);
      browsePanel.hidden=false;
      mapPanel.hidden=true;
      window.renderGoalBrowse();
    };

    // Old map links still resolve to the unified search, but only one
    // visible search entry remains. The breadcrumb owns return navigation.
    window.setGoalViewMode=function(mode){
      if(mode==='map')openUnifiedGoalSearch();
      else if(byId('gmGoalSearchDisclosure'))byId('gmGoalSearchDisclosure').open=false;
      window.renderGoalsPage();
    };
    window.focusGoalSearch=openUnifiedGoalSearch;

    const heading=document.querySelector('#goals .goal-page-head p');
    if(heading)heading.textContent='依目標階層逐層瀏覽，也能一次搜尋四級目標。';
    window.renderGoalsPage();
    if(window.AppModules?.goals)window.AppModules.goals.render=window.renderGoalsPage;
  }

  // Keep the event essentials, ranking and existing booking/calendar actions.
  // The goal bridge is deliberately not rendered in activity cards anymore.
  function compactActivityCards(){
    const list=byId('activityList');
    if(!list)return;
    list.querySelectorAll('article.activity-card:not([data-gm-compact])').forEach(card=>{
      const actions=card.querySelector('.activity-actions');
      const meta=card.querySelector('.activity-meta');
      if(!actions||!meta)return;
      card.dataset.gmCompact='1';

      const decision=card.querySelector('.activity-decision-grid');
      const due=decision?.querySelector('div:first-child b')?.textContent?.trim();
      const date=card.querySelector('.activity-title-block>.muted')?.textContent?.trim()||'';
      if(due&&!(due.includes('無單一截止日')&&date)){
        const deadline=document.createElement('div');
        deadline.className='gm-activity-deadline';
        const label=document.createElement('b');
        label.textContent='時效：';
        deadline.append(label,document.createTextNode(due));
        meta.insertAdjacentElement('afterend',deadline);
      }

      // Score and tier stay in the score block; the duplicate tag is unused.
      meta.querySelectorAll('.tier-chip').forEach(chip=>chip.remove());
      // Goal evidence is retained in the app's calculations but not in this UI.
      decision?.remove();
      card.querySelector('.activity-goal-bridge-card')?.remove();
      actions.querySelectorAll('button[onclick*="activityOpenGoal"]')
        .forEach(button=>button.remove());

      // A short, optional explanation remains available after primary actions.
      const reasons=card.querySelector('details.activity-reasons');
      if(reasons){
        const summary=reasons.querySelector('summary');
        if(summary)summary.textContent='推薦原因';
        const listItems=reasons.querySelectorAll('li');
        listItems.forEach(item=>{
          if(String(item.textContent||'').trim().startsWith('目標地圖：與子任務')){
            item.remove();
          }
        });
        reasons.classList.add('gm-activity-reason-details');
        actions.insertAdjacentElement('afterend',reasons);
      }
    });
  }

  function installActivityCompression(){
    const list=byId('activityList');
    if(!list)return;
    const observer=new MutationObserver(compactActivityCards);
    observer.observe(list,{childList:true});
    compactActivityCards();
  }

  // Long source-health panels belong in diagnostics. Keep a visible
  // summary while preserving the complete, unmodified diagnostic DOM.
  function installRadarSourceDisclosure(){
    const status=byId('activityAutoStatus');
    if(!status||byId('gmRadarSourceDetails'))return;
    const parent=status.parentNode;
    if(!parent)return;
    const wrap=document.createElement('details');
    wrap.id='gmRadarSourceDetails';
    wrap.className='gm-radar-source-details';
    const summary=document.createElement('summary');
    summary.textContent='活動資料更新狀態';
    parent.insertBefore(wrap,status);
    wrap.appendChild(summary);
    wrap.appendChild(status);
    function syncSourceSummary(){
      const message=byId('activityAutoMeta')?.textContent||'';
      const match=message.match(/來源健康\s*(\d+)\s*\/\s*(\d+)/);
      if(!match){summary.textContent='活動資料更新狀態 · 點擊查看';return}
      const healthy=Number(match[1]),total=Number(match[2]);
      wrap.dataset.attention=String(total>0&&healthy<total);
      summary.textContent=(total>0&&healthy<total?'來源需注意 · ':'資料來源正常 · ')+healthy+'/'+total;
    }
    if(typeof MutationObserver==='function'){
      new MutationObserver(syncSourceSummary).observe(status,{
        childList:true,subtree:true,characterData:true
      });
    }
    syncSourceSummary();
  }

  // Three optional filters use the existing selects; the four visible
  // circle cards remain the sole primary location filter.
  function installRadarAdvancedFilters(){
    const row=document.querySelector('#activity .activity-filter-row.visual-filters');
    if(!row||byId('gmRadarAdvancedFilters'))return;
    const parent=row.parentNode;
    if(!parent)return;
    const disclosure=document.createElement('details');
    disclosure.id='gmRadarAdvancedFilters';
    disclosure.className='gm-radar-advanced';
    const summary=document.createElement('summary');
    const title=document.createElement('b');
    title.textContent='進階篩選';
    const current=document.createElement('small');
    current.id='gmRadarActiveFilters';
    summary.append(title,current);
    parent.insertBefore(disclosure,row);
    disclosure.append(summary,row);
    function refreshFilterLabel(){
      const active=[];
      const type=byId('activityType')?.value||'全部';
      const tier=byId('activityFitTier')?.value||'全部';
      const goal=byId('activityGoalFilter');
      if(type!=='全部')active.push(type);
      if(tier!=='全部')active.push(tier);
      if(goal&&goal.value!=='全部'){
        active.push('子任務：'+(goal.selectedOptions?.[0]?.textContent||'已選擇'));
      }
      current.textContent=active.length?active.join(' · '):'類型、適配度、子任務';
      disclosure.dataset.filtered=active.length?'true':'false';
    }
    row.addEventListener('change',refreshFilterLabel);
    const stats=byId('activityStats');
    if(stats&&typeof MutationObserver==='function'){
      new MutationObserver(refreshFilterLabel).observe(stats,{childList:true});
    }
    refreshFilterLabel();
  }

  // Dashboard root goals previously used the hidden map's selected node.
  // Run AFTER the existing button onclick, without intercepting its action.
  function installDashboardGoalNavigation(){
    const roots=byId('directions');
    if(!roots||roots.dataset.gmStagingBrowseBridge==='1')return;
    roots.dataset.gmStagingBrowseBridge='1';
    roots.addEventListener('click',event=>{
      const button=event.target.closest?.('button.direction');
      if(!button||!roots.contains(button))return;
      const source=button.getAttribute('onclick')||'';
      const found=source.match(/selectTask\('([^']+)'/);
      if(found&&byId('goals')?.classList.contains('active')&&
         typeof window.browseGoalTo==='function'){
        window.browseGoalTo(found[1]);
      }
    });
  }

  // Keep the existing strict qualification policy, but show its long
  // explanation only when requested. Move the original text node intact.
  function installScholarshipPolicyDisclosure(){
    const panel=document.querySelector('#scholarship .scholarship-panel');
    const notice=panel?.querySelector(':scope > .notice');
    if(!panel||!notice||byId('gmScholarshipPolicy'))return;
    const disclosure=document.createElement('details');
    disclosure.id='gmScholarshipPolicy';
    disclosure.className='gm-scholarship-policy';
    const summary=document.createElement('summary');
    summary.textContent='資格篩選與推薦原則';
    notice.parentNode.insertBefore(disclosure,notice);
    disclosure.append(summary,notice);
  }

  // The five native settings panels are the sole navigation. The old
  // quick-link bar can be removed from each dynamic render without changing
  // the settings persistence code or any setting controls.
  function installSettingsCleanup(){
    const body=byId('settingsBody');
    if(!body||body.dataset.gmStagingCleaned==='1')return;
    body.dataset.gmStagingCleaned='1';
    const removeDuplicateNavigation=()=>{
      body.querySelector('nav.settings-hub-nav')?.remove();
    };
    if(typeof MutationObserver==='function'){
      new MutationObserver(removeDuplicateNavigation).observe(body,{childList:true});
    }
    removeDuplicateNavigation();
  }

  // Present four key weekly figures first without moving or recalculating
  // the underlying statistic nodes: analytics still updates each original id.
  function installAnalyticsMetricHierarchy(){
    const metricRow=document.querySelector('#stats .stats-progress-meta');
    if(!metricRow||byId('gmStatsExtra'))return;
    const all=Array.from(metricRow.children).filter(node=>node.tagName==='SPAN');
    const metric=id=>all.find(node=>node.querySelector('b#'+id));
    const primary=['statsTotalStudy','statsCredited','statsTarget','statsRemaining'].map(metric);
    const secondary=['statsActual','statsOverrun','statsOtherStudy'].map(metric);
    if([...primary,...secondary].some(node=>!node)||all.length!==7)return;
    metricRow.classList.add('gm-stats-primary-metrics');
    metricRow.replaceChildren(...primary);
    const details=document.createElement('details');
    details.id='gmStatsExtra';
    details.className='gm-stats-extra';
    const summary=document.createElement('summary');
    summary.textContent='其他本週時數明細';
    const inner=document.createElement('div');
    inner.className='gm-stats-secondary-metrics';
    inner.replaceChildren(...secondary);
    details.append(summary,inner);
    metricRow.insertAdjacentElement('afterend',details);
  }

  // Deleted logs must remain restorable, but their management area should
  // not occupy the analysis overview unless an item requires attention.
  function installAnalyticsDeletedLogDisclosure(){
    const panel=document.querySelector('#stats .log-management-panel');
    const list=byId('deletedLogs');
    if(!panel||!list||byId('gmStatsDeleted'))return;
    const helpText=panel.querySelector('.section-title small')?.textContent?.trim()||
      '刪除的實際紀錄會保留，並可恢復。';
    panel.querySelector('.section-title')?.remove();
    const disclosure=document.createElement('details');
    disclosure.id='gmStatsDeleted';
    disclosure.className='panel log-management-panel gm-stats-deleted';
    const summary=document.createElement('summary');
    summary.className='gm-stats-deleted-summary';
    const title=document.createElement('b');
    title.textContent='已刪除紀錄';
    const count=document.createElement('small');
    count.className='gm-stats-deleted-count';
    summary.append(title,count);
    const help=document.createElement('p');
    help.className='gm-stats-deleted-help';
    help.textContent=helpText;
    panel.parentNode.insertBefore(disclosure,panel);
    disclosure.append(summary,help,...Array.from(panel.childNodes));
    panel.remove();

    let previousCount=0;
    const sync=()=>{
      const current=list.querySelectorAll('.deleted-log-row').length;
      count.textContent=current?current+' 筆可恢復':'目前沒有待恢復的紀錄';
      disclosure.dataset.hasLogs=current?'true':'false';
      if(current>previousCount)disclosure.open=true;
      previousCount=current;
    };
    if(typeof MutationObserver==='function'){
      new MutationObserver(sync).observe(list,{childList:true});
    }
    sync();
  }

  // The original scholarship renderer keeps the filter state and eligibility
  // logic. Turn only its existing text summary into two readable rows.
  function installScholarshipStatPresentation(){
    const stats=byId('scholarshipStats');
    if(!stats||stats.dataset.gmMetricsBound==='1')return;
    stats.dataset.gmMetricsBound='1';
    const presentation=()=>{
      if(stats.querySelector('.gm-scholarship-metrics'))return;
      const raw=String(stats.textContent||'').replace(/\s+/g,' ').trim();
      const values=raw.match(/^目前\s*(\d+)\s*項\s*·\s*高度符合\s*(\d+)\s*·\s*專業考照\s*(\d+)\s*·\s*外語能力\s*(\d+)\s*·\s*資格排除\s*(\d+)(?:\s*·\s*自動汰除\s*(\d+))?$/);
      if(!values)return;
      const root=document.createElement('div');
      root.className='gm-scholarship-metrics';
      const main=document.createElement('div');
      main.className='gm-scholarship-summary-main';
      const secondary=document.createElement('div');
      secondary.className='gm-scholarship-summary-extra';
      const add=(parent,label,value,isPrimary)=>{
        const item=document.createElement('span');
        item.className=isPrimary?'gm-scholarship-main-item':'gm-scholarship-extra-item';
        const title=document.createElement('small');
        title.textContent=label;
        const number=document.createElement(isPrimary?'strong':'b');
        number.textContent=value;
        item.append(title,number);
        parent.appendChild(item);
      };
      add(main,'目前符合',values[1],true);
      add(main,'高度符合',values[2],true);
      add(secondary,'專業考照',values[3],false);
      add(secondary,'外語能力',values[4],false);
      add(secondary,'資格排除',values[5],false);
      if(values[6]!==undefined)add(secondary,'自動汰除',values[6],false);
      root.append(main,secondary);
      stats.replaceChildren(root);
    };
    if(typeof MutationObserver==='function'){
      new MutationObserver(presentation).observe(stats,{childList:true});
    }
    presentation();
  }

  // Reduce explanatory text without changing timer or backfill inputs.
  function installExecutionReadingOrder(){
    const restore=document.querySelector('#today .execution-now-head small');
    if(restore)restore.textContent='計時中斷後可恢復';
    const backfill=document.querySelector('#today .other-study-disclosure>summary small');
    if(backfill)backfill.textContent='補記目標投入或其他讀書時間';
    const freeStudy=document.querySelector('#today .free-study-quick-copy small');
    if(freeStudy)freeStudy.textContent='不列入目標完成度的其他讀書';
  }

  function start(){
    try{installGoals()}catch(e){console.warn('[staging] Goal UI preview error:',e)}
    try{installDashboardGoalNavigation()}catch(e){console.warn('[staging] Dashboard goal routing error:',e)}
    try{installActivityCompression()}catch(e){console.warn('[staging] Radar card preview error:',e)}
    try{installRadarSourceDisclosure()}catch(e){console.warn('[staging] Source disclosure preview error:',e)}
    try{installRadarAdvancedFilters()}catch(e){console.warn('[staging] Advanced filter preview error:',e)}
    try{installScholarshipPolicyDisclosure()}catch(e){console.warn('[staging] Scholarship policy disclosure error:',e)}
    try{installScholarshipStatPresentation()}catch(e){console.warn('[staging] Scholarship statistics layout error:',e)}
    try{installExecutionReadingOrder()}catch(e){console.warn('[staging] Execution reading order error:',e)}
    try{installAnalyticsMetricHierarchy()}catch(e){console.warn('[staging] Analytics metric layout error:',e)}
    try{installAnalyticsDeletedLogDisclosure()}catch(e){console.warn('[staging] Deleted log layout error:',e)}
    try{installSettingsCleanup()}catch(e){console.warn('[staging] Settings cleanup error:',e)}
  }
  // Boot after bootstrap has rendered and exposed AppModules.
  if(document.readyState==='complete')start();
  else window.addEventListener('load',start,{once:true});
})();
