/* V96 Activity module: independent catalog, matching, ranking and UI */
const ACTIVITY_SEED=[
{id:'thu-official',title:'東海大學官方活動／公告入口',date:'',time:'持續更新',scope:'東海校內',type:'教育／青少年',kind:'reference',url:'https://activity.thu.edu.tw/web/news/list.php',keywords:'東海大學 官方 活動 公告 講座 學術 職涯 實習 國際 校內活動 校外活動',direct:true,team:false,available:true,source:'東海大學學生事務處課外活動暨學生發展組',statusText:'東海官方活動入口',government:false,sourcePriority:'core'},
{id:'g01',title:'青年第一讚 Youth First｜政府青年資源總入口',date:'',time:'持續更新',scope:'全臺',type:'公共參與',kind:'reference',url:'https://youthfirst.yda.gov.tw/',keywords:'政府 青年 職涯 實習 就業 訓練 升學 地方創生 公共參與 國際連結 活動 獎補助',direct:true,team:false,available:true,source:'教育部青年發展署',statusText:'政府資訊彙整平台'},
{id:'g02',title:'青年百億海外圓夢基金計畫',date:'',time:'依各梯次徵件期程',scope:'線上／海外',type:'職涯／實習',kind:'plan',url:'https://twpathfinder.yda.gov.tw/',keywords:'青年 海外 圓夢 實習 見習 培訓 交流 國際 教育部 青年發展署',direct:true,team:false,available:true,source:'教育部青年發展署',statusText:'依各梯次公告'},
{id:'g03',title:'法國企業國際實習 VIE',date:'',time:'依企業職缺公告',scope:'線上／海外',type:'職涯／實習',kind:'plan',url:'https://www.mofa.gov.tw/cl.aspx?n=2493',keywords:'法國 VIE 海外 實習 工作 法律 金融 行銷 管理 會計 資訊 人力資源 國際職涯',direct:true,team:false,available:true,source:'外交部',statusText:'持續依參與企業職缺公告'},
{id:'g04',title:'青年度假打工',date:'',time:'依目的國申請期程',scope:'線上／海外',type:'語言／國際',kind:'plan',url:'https://youthtaiwan.mofa.gov.tw/WorkingHoliday/',keywords:'青年 海外 度假打工 工作 日本 澳洲 紐西蘭 加拿大 英國 德國 法國 國際 文化',direct:true,team:false,available:true,source:'外交部',statusText:'依各國簽證與名額規定申請'},
{id:'g05',title:'教育部學海系列計畫',date:'',time:'依年度及學校甄選期程',scope:'線上／海外',type:'職涯／實習',kind:'reference',url:'https://www.studyabroad.moe.gov.tw/new/',keywords:'學海飛颺 學海惜珠 學海築夢 新南向學海築夢 海外研修 實習 補助 教育部',direct:false,team:false,available:true,source:'教育部',statusText:'需依學校校內甄選與教育部期程辦理'}
];

function mergeActivityCatalog(existing){
 const old=(Array.isArray(existing)?existing:[]).filter(a=>!['a5','a6','a7','a8','a9'].includes(String(a.id))&&!a.scholarship&&a.type!=='獎學金／助學金'&&a.kind!=='scholarship');
 const byId=new Map(old.map(a=>[String(a.id),a]));
 ACTIVITY_SEED.forEach(a=>byId.set(String(a.id),{...(byId.get(String(a.id))||{}),...a}));
 return [...byId.values()].filter(a=>!/^a[1-4]$/.test(String(a.id))||ACTIVITY_SEED.some(x=>x.id===a.id));
}
function mergeScholarshipCatalog(existing){
 const old=Array.isArray(existing)?existing:[];
 const byId=new Map(old.map(a=>[String(a.id),a]));
 SCHOLARSHIP_SEED.forEach(a=>byId.set(String(a.id),{...(byId.get(String(a.id))||{}),...a,kind:'scholarship',scholarship:true,type:'獎學金／助學金'}));
 return [...byId.values()].filter(a=>a&&(a.scholarship||a.type==='獎學金／助學金'||a.kind==='scholarship')&&String(a.id));
}
function activityStore(){return Array.isArray(db.activities)?db.activities.filter(a=>!a.scholarship&&a.type!=='獎學金／助學金'&&a.kind!=='scholarship'):[]}
function scholarshipStore(){return Array.isArray(db.scholarships)?db.scholarships:[]}
function catalogItemById(id){
 const key=String(id);
 return activityStore().find(x=>String(x.id)===key)||scholarshipStore().find(x=>String(x.id)===key)||null;
}

function activityDistance(scope){return ({'東海校內':1,'西屯／沙鹿':2,'臺中':3,'中部':4,'全臺':5,'線上／海外':6}[scope]||6)}
function activityAutoClass(a){
 const allowed=['法律／學術','語言／國際','教育／青少年','職涯／實習','公共參與'];
 if(allowed.includes(a.type))return a.type;
 const s=(a.title+' '+(a.keywords||'')).toLowerCase();
 if(/法律|憲法|民法|刑法|學術/.test(s))return'法律／學術';
 if(/英語|日語|語言|國際|海外|交換/.test(s))return'語言／國際';
 if(/青少年|教育|教學|課程|帶領/.test(s))return'教育／青少年';
 if(/工作|實習|打工|履歷|職涯/.test(s))return'職涯／實習';
 return a.type||'公共參與';
}
function activityMatchDetails(a){
 const tasks=db.tasks.filter(t=>Number(t.level)>=1&&Number(t.level)<=4&&t.status!=='已封存');
 const text=(String(a.title||'')+' '+String(a.keywords||'')+' '+String(a.type||'')).toLowerCase();
 let best=null,bestScore=0;
 tasks.forEach(t=>{
   const chain=ancestors(t.id),path=chain.map(x=>String(x.name||'')).join(' ').toLowerCase(),name=String(t.name||'').toLowerCase();
   const corpus=name+' '+path;if(!corpus.trim())return;
   const weight={1:2,2:4,3:7,4:10}[Number(t.level)]||2;let z=0;
   const words=[...new Set(corpus.split(/[／/、，,\s+｜·]+/).filter(w=>w.length>=2))];
   words.forEach(w=>{if(text.includes(w))z+=weight});
   if(/海外|國際|實習|工作|打工|青年/.test(text)&&/青年計畫|海外活動|語言能力準備|海外|國際|實習|工作/.test(corpus))z+=weight*2;
   if(t.level===1&&t.id==='g2'&&/海外|國際|實習|工作|打工|青年|計畫/.test(text))z+=15;
   if(t.level===1&&t.id==='g3'&&a.type==='語言／國際'&&/語言|英語|日語/.test(text))z+=8;
   if(a.type==='職涯／實習'&&/海外|實習|工作|職涯|青年/.test(corpus))z+=weight*2;
   if(a.type==='語言／國際'&&/海外|國際|語言|交換|青年/.test(corpus))z+=weight*2;
   if(z>bestScore){bestScore=z;best=t}
 });
 return {task:best,matchScore:bestScore};
}
function activityTimeState(a){
 const today=todayKey();
 const date=String(a.date||'').trim();
 const duration=Number(a.durationMinutes||a.duration||0)||0;
 if(a.available===false)return {eligible:false,state:'停用',reason:'資料標示不可用'};
 if(a.kind==='reference')return {eligible:false,state:'參考',reason:'資訊入口，不列入可直接參加清單'};
 if(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date<today)return {eligible:false,state:'已過期',reason:'活動日期已經過去'};
 if(duration>0 && duration<(window.ActivityRules?.minimumDurationMinutes||30))return {eligible:false,state:'過短',reason:'活動時間少於 30 分鐘，暫不列入行動推薦'};
 if(date)return {eligible:true,state:'可安排',reason:'已有明確日期'};
 return {eligible:true,state:'持續資訊',reason:'未提供單一日期，依公告／梯次判斷'};
}
function activityFit(a){
 // V95.2：把「目標匹配度」與「推薦優先度／同心圓」分開。
 // 目標匹配度回答「它適不適合我」；同心圓回答「我現在應不應優先投入」。
 const rel=activityMatchDetails(a),d=activityDistance(a.scope),text=(a.title+' '+(a.keywords||'')+' '+(a.type||'')).toLowerCase();
 const goal=Math.min(45,Math.round(rel.matchScore*3));
 const direct=a.direct===true&&!a.team;
 const knowledge=/實習|工作|打工|職涯|學術|法律|教育|語言|國際|技能|培訓|講座|見習|證照/.test(text)?(window.ActivityRules?.weights?.knowledge||15):8;
 const proximity={1:15,2:12,3:9,4:6,5:3,6:0}[d]||0;
 const freshness=a.available===false?0:(a.date?5:3);
 const time=activityTimeState(a);
 const action=direct?(window.ActivityRules?.weights?.direct||20):10;
 const institutional=(a.scope==='東海校內'&&a.sourcePriority==='core')?(window.ActivityRules?.institutionalBonus||5):0;
 const priority=Math.max(0,Math.min(100,goal+action+knowledge+proximity+freshness+institutional));
 const matchPercent=Math.max(0,Math.min(100,Math.round((goal/45)*100)));
 let ring='explore';
 const rr=window.ActivityRules?.rings||{};
 if(time.eligible&&d<=(rr.core?.distance||2)&&priority>=(rr.core?.priority||75))ring='core';
 else if(time.eligible&&d<=(rr.near?.distance||3)&&priority>=(rr.near?.priority||65))ring='near';
 else if(time.eligible&&priority>=(rr.extended?.priority||45))ring='extended';
 return {score:priority,priority,matchPercent,goal,direct:action,knowledge,geo:proximity,freshness,institutional,task:rel.task,eligible:time.eligible,timeState:time.state,timeReason:time.reason,ring};
}
function activityRingLabel(r){return ({core:'① 核心圈',near:'② 近距圈',extended:'③ 延伸圈',explore:'④ 探索圈'})[r]||'④ 探索圈'}
function activitySort(a,b){
 const order={core:1,near:2,extended:3,explore:4};
 return (order[a.fit.ring]-order[b.fit.ring])||((a.date||'9999-12-31').localeCompare(b.date||'9999-12-31'))||(b.fit.score-a.fit.score)||a.title.localeCompare(b.title,'zh-Hant');
}
let activityPage=1;
const ACTIVITY_PAGE_SIZE=window.ActivityRules?.pageSize||4;
function clearActivitySearch(){const input=document.getElementById('activitySearch');if(input)input.value='';activityPage=1;updateActivitySearchUI();renderActivities();toast('已清除搜尋')}
function bindActivitySearch(){const e=document.getElementById('activitySearch');if(e&&!e.dataset.bound){e.dataset.bound='1';e.addEventListener('input',()=>{activityPage=1;updateActivitySearchUI()})}}
function applyActivitySearch(){bindActivitySearch();activityPage=1;const b=document.getElementById('activitySearchButton');if(b){b.classList.add('searching');setTimeout(()=>b.classList.remove('searching'),180)}renderActivities();updateActivitySearchUI();toast('已套用活動搜尋')}
function activityIsEligible(a){return activityTimeState(a).eligible}
function activityExternalUrl(a){return String(a?.url||a?.externalUrl||a?.sourceUrl||'').trim()}
function activityDateLabel(a,today){if(a.date)return `${esc(a.date)}${a.time?' · '+esc(a.time):''}`;return `<span class="muted">${esc(a.time||'持續資訊／依公告')}</span>`}
let remoteActivityCatalog=[];
let activityAutoMeta={updatedAt:'',sources:0,events:0,ok:0,failed:0};
function normalizeRemoteActivity(a,i){
 const x={...(a||{})};
 x.id=String(x.id||('auto-'+i+'-'+Math.abs(hashCode(String(x.title||'activity')+String(x.date||'')))));
 x.title=String(x.title||'未命名活動').trim();x.date=String(x.date||'').trim();x.time=String(x.time||'').trim();
 x.scope=String(x.scope||'全臺').trim();x.type=String(x.type||'公共參與').trim();x.kind=x.kind||'event';
 x.scholarship=!!x.scholarship;x.url=String(x.url||x.externalUrl||'').trim();x.keywords=String(x.keywords||'').trim();x.source=String(x.source||'自動活動資料').trim();
 x.statusText=String(x.statusText||'自動抓取').trim();x.direct=x.direct!==false;x.team=!!x.team;x.available=x.available!==false;
 x.durationMinutes=Number(x.durationMinutes||x.duration||0)||0;if(x.scholarship)x.type='獎學金／助學金';return x;
}
function hashCode(str){let h=0;for(let i=0;i<str.length;i++)h=((h<<5)-h)+str.charCodeAt(i)|0;return h}
function mergeRemoteActivities(base,remote){const map=new Map((Array.isArray(base)?base:[]).map(a=>[String(a.id),a]));(Array.isArray(remote)?remote:[]).forEach((a,i)=>{const x=normalizeRemoteActivity(a,i);map.set(String(x.id),{...(map.get(String(x.id))||{}),...x})});return [...map.values()]}
async function loadRemoteActivities(){
 try{
  // Standalone preview mode: local content:// / file:// pages cannot reliably fetch sibling JSON.
  // The production GitHub Pages build still uses the external JSON files below.
  if(window.__PREVIEW_CATALOG){
   const payload=window.__PREVIEW_CATALOG||{};
   const items=Array.isArray(payload.activities)?payload.activities:[];
   const scholarshipItems=Array.isArray(payload.scholarships)?payload.scholarships:[];
   remoteActivityCatalog=items.map(normalizeRemoteActivity).filter(x=>!x.scholarship&&x.type!=='獎學金／助學金'&&x.kind!=='scholarship');
   activityAutoMeta=payload.meta||{mode:'standalone-preview'};
   db.scholarships=mergeScholarshipCatalog([...(Array.isArray(db.scholarships)?db.scholarships:[]),...scholarshipItems.map(normalizeRemoteActivity)]);
   db.activities=mergeActivityCatalog([...(Array.isArray(db.activities)?db.activities:[]),...remoteActivityCatalog]);
   activityPage=1;renderActivities();renderScholarships();
   const box=document.getElementById('activityAutoStatus');
   if(box){box.style.display='block';const u=document.getElementById('activityAutoUpdated'),m=document.getElementById('activityAutoMeta');if(u)u.textContent='獨立預覽資料';if(m)m.textContent=`預覽模式 · 活動 ${remoteActivityCatalog.length} · 獎學金 ${scholarshipItems.length}`}
   return;
  }
  const activityUrl=window.AppConfig?.data?.activities||'./data/activities.json';
  const scholarshipUrl=window.AppConfig?.data?.scholarships||'./data/scholarships.json';
  let payload={};
  const r=await fetch(activityUrl+'?ts='+Date.now(),{cache:'no-store'});
  if(r.ok) payload=await r.json();
  else { const legacy=await fetch((window.AppConfig?.data?.legacyCombined||'./data/events.json')+'?ts='+Date.now(),{cache:'no-store'}); if(!legacy.ok)throw new Error('activity data unavailable'); payload=await legacy.json(); }
  const items=Array.isArray(payload)?payload:(Array.isArray(payload.events)?payload.events:[]);
  let scholarshipItems=Array.isArray(payload.scholarships)?payload.scholarships:[];
  if(!scholarshipItems.length){try{const sr=await fetch(scholarshipUrl+'?ts='+Date.now(),{cache:'no-store'});if(sr.ok){const sp=await sr.json();scholarshipItems=Array.isArray(sp)?sp:(Array.isArray(sp.scholarships)?sp.scholarships:[]);}}catch(_){} }
  const normalizedItems=validateCatalogBoundary(items.map(normalizeRemoteActivity),'活動'),normalizedScholarships=validateCatalogBoundary(scholarshipItems.map(normalizeRemoteActivity),'獎學金');
  const remoteScholarships=[...normalizedItems.filter(x=>x.scholarship||x.type==='獎學金／助學金'||x.kind==='scholarship'),...normalizedScholarships];
  remoteActivityCatalog=normalizedItems.filter(x=>!x.scholarship&&x.type!=='獎學金／助學金'&&x.kind!=='scholarship');activityAutoMeta=payload.meta||{};
  db.scholarships=mergeScholarshipCatalog([...(Array.isArray(db.scholarships)?db.scholarships:[]),...remoteScholarships]);db.activities=mergeActivityCatalog([...(Array.isArray(db.activities)?db.activities:[]),...remoteActivityCatalog]);
  activityPage=1;renderActivities();renderScholarships();
  const box=document.getElementById('activityAutoStatus');if(box){box.style.display='block';const u=document.getElementById('activityAutoUpdated'),m=document.getElementById('activityAutoMeta');if(u)u.textContent=activityAutoMeta.updatedAt?('更新 '+new Date(activityAutoMeta.updatedAt).toLocaleString('zh-TW',{hour12:false})):'自動資料';if(m)m.textContent=`來源 ${activityAutoMeta.sources||0} · 活動 ${items.length} · 獎學金 ${scholarshipItems.length} · 成功 ${activityAutoMeta.ok||0} · 失敗 ${activityAutoMeta.failed||0}`}
 }catch(e){const box=document.getElementById('activityAutoStatus');if(box){box.style.display='block';const u=document.getElementById('activityAutoUpdated'),m=document.getElementById('activityAutoMeta');if(u)u.textContent='自動資料暫不可用';if(m)m.textContent='目前使用內建活動資料；下次更新會再嘗試。'}}
}
function activityCardHTML(a,today){
 const f=a.fit,relation=f.task?`<span class="activity-chip">→ ${esc(f.task.name)}</span>`:'';const dateBadge=f.timeState==='已過期'?'<span class="activity-chip">已過期</span>':f.timeState==='過短'?'<span class="activity-chip">過短，不推薦</span>':(a.date?'<span class="activity-chip">可安排</span>':'<span class="activity-chip">持續資訊</span>');
 const priorityLabel=f.ring==='core'?'現在優先':f.ring==='near'?'可優先安排':f.ring==='extended'?'值得保留':'探索／長期';
 return `<div class="activity-card ${f.ring==='core'?'recommended':''}"><div class="activity-head"><div><h3>${esc(a.title)}</h3><div class="muted">${activityDateLabel(a,today)}</div></div><div class="activity-score-block"><span class="activity-score">${f.score}%</span><small>推薦優先度</small></div></div><div class="activity-meta"><span class="activity-chip">${esc(activityRingLabel(f.ring))}</span><span class="activity-chip">${priorityLabel}</span><span class="activity-chip">${esc(a.scope)}</span><span class="activity-chip">${esc(a.type)}</span>${relation}${dateBadge}</div><div class="activity-fit"><b>判斷</b><span>目標匹配 ${f.matchPercent}%</span><span>可直接參加 ${f.direct}/20</span><span>專業價值 ${f.knowledge}/15</span><span>生活圈 ${f.geo}/15</span><span>時效 ${f.freshness}/5</span>${f.institutional?`<span>東海官方 +${f.institutional}</span>`:''}</div><div class="activity-actions">${activityExternalUrl(a)?`<a class="btn" href="${esc(safeExternalUrl(activityExternalUrl(a)))}" target="_blank" rel="noopener noreferrer">外部資訊</a>`:''}${((a.kind==='event'||a.kind==='plan')&&a.date)?`<button class="btn gold" type="button" onclick="addActivityToCalendar('${a.id}')">加入行事曆</button>`:''}</div></div>`;
}
function renderActivityPagination(total){
 const el=document.getElementById('activityPagination');if(!el)return;const pages=Math.max(1,Math.ceil(total/ACTIVITY_PAGE_SIZE));activityPage=Math.min(Math.max(1,activityPage),pages);
 el.innerHTML=total>ACTIVITY_PAGE_SIZE?`<button class="btn" type="button" onclick="activityPrevPage()" ${activityPage===1?'disabled':''}>‹</button><span class="activity-page-info">第 ${activityPage} / ${pages} 頁</span><button class="btn" type="button" onclick="activityNextPage()" ${activityPage===pages?'disabled':''}>›</button>`:'';
}
function activityPrevPage(){if(activityPage>1){activityPage--;renderActivities();window.scrollTo({top:0,behavior:'smooth'})}}
function activityNextPage(){activityPage++;renderActivities();window.scrollTo({top:0,behavior:'smooth'})}
function renderActivities(){
 ensureActivities();bindActivitySearch();
 const q=(document.getElementById('activitySearch')?.value||'').trim().toLowerCase(),scope=document.getElementById('activityScope')?.value||'全部',type=document.getElementById('activityType')?.value||'全部',today=todayKey();
 let arr=activityStore().filter(activityIsEligible).map(a=>({...a,type:activityAutoClass(a),fit:activityFit(a)})).filter(a=>(!q||(a.title+' '+a.keywords+' '+a.scope).toLowerCase().includes(q))&&(scope==='全部'||a.scope===scope)&&(type==='全部'||a.type===type));
 arr.sort(activitySort);
 const groups={core:arr.filter(a=>a.fit.ring==='core'),near:arr.filter(a=>a.fit.ring==='near'),extended:arr.filter(a=>a.fit.ring==='extended'),explore:arr.filter(a=>a.fit.ring==='explore')};
 const pages=Math.max(1,Math.ceil(arr.length/ACTIVITY_PAGE_SIZE));activityPage=Math.min(Math.max(1,activityPage),pages);const pageItems=arr.slice((activityPage-1)*ACTIVITY_PAGE_SIZE,activityPage*ACTIVITY_PAGE_SIZE);
 const upcoming=arr.filter(a=>!a.date||a.date>=today).length;
 document.getElementById('activityStats').innerHTML=`目前 <b>${arr.length}</b> 項 · 核心 ${groups.core.length} · 近距 ${groups.near.length} · 延伸 ${groups.extended.length} · 探索 ${groups.explore.length} · 已排除過期／過短／參考入口 ${activityStore().length-arr.length} 項。`;
 const st=document.getElementById('activitySearchStatus');if(st)st.textContent=q?`搜尋「${esc(q)}」：找到 ${arr.length} 項`:`目前顯示 ${arr.length} 項符合時間與參加判準的活動／計畫`;
 const list=document.getElementById('activityList');
 if(!pageItems.length){list.innerHTML='<div class="empty">目前沒有符合條件的活動。可調整搜尋或範圍／類型。</div>';renderActivityPagination(0);renderActivityReferences();return;}
 const pageGroups={core:[],near:[],extended:[],explore:[]};pageItems.forEach(a=>pageGroups[a.fit.ring].push(a));
 list.innerHTML=Object.entries(pageGroups).filter(([,items])=>items.length).map(([ring,items])=>`<section class="activity-group ${ring}"><div class="activity-group-head"><div class="activity-group-title"><i></i>${activityRingLabel(ring)}</div><small>${ring==='core'?'現在最值得行動':ring==='near'?'可優先安排':ring==='extended'?'值得保留':'探索／長期資訊'}</small></div><div class="list">${items.map(a=>activityCardHTML(a,today)).join('')}</div></section>`).join('');
 renderActivityPagination(arr.length);renderActivityReferences();
}
function renderActivityReferences(){
 const box=document.getElementById('activityReferences');if(!box)return;const refs=activityStore().filter(a=>a.kind==='reference'&&activityExternalUrl(a));box.innerHTML=refs.length?`<div class="reference-title">📚 相關計畫資料（不列入可直接參加活動）</div>`+refs.map(a=>`<div class="reference-item"><div><b>${esc(a.title)}</b><small>${esc(a.statusText||'參考資料')} · ${esc(a.source||'官方來源')}</small></div><a class="btn" href="${esc(safeExternalUrl(activityExternalUrl(a)))}" target="_blank" rel="noopener noreferrer">查看官方資訊</a></div>`).join(''):'';
}
function activityResetFilters(){['activitySearch'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});['activityScope','activityType'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='全部'});activityPage=1;renderActivities()}
