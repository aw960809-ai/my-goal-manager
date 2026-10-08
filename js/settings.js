/* V96.4.4 Settings / control layer — no PIN lock. */
const SETTINGS_KEY='lawLangGoalSystem_settings_v1';
const DEFAULT_SETTINGS=Object.freeze({
  appearance:'system',
  accent:'slate',
  textSize:'normal',
  density:'comfortable',
  reducedMotion:false,
  dateFormat:'yyyy/mm/dd',
  timeFormat:'24',
  activityReminder:true,
  scholarshipReminder:true,
  reminderDays:3
});
let appSettings=loadAppSettings();
function loadAppSettings(){
  try{
    const raw=localStorage.getItem(SETTINGS_KEY);
    const parsed=raw?JSON.parse(raw):{};
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {...DEFAULT_SETTINGS};
    const safe={...DEFAULT_SETTINGS};
    const allowed={
      appearance:['system','light','dark'],
      accent:['slate','sage','plum','charcoal'],
      textSize:['normal','large'],
      density:['comfortable','standard','compact'],
      dateFormat:['yyyy/mm/dd','yyyy-mm-dd'],
      timeFormat:['24','12']
    };
    for(const [key,values] of Object.entries(allowed)){
      if(values.includes(parsed[key]))safe[key]=parsed[key];
    }
    for(const key of ['reducedMotion','activityReminder','scholarshipReminder']){
      if(typeof parsed[key]==='boolean')safe[key]=parsed[key];
    }
    if(Number.isFinite(Number(parsed.reminderDays)))
      safe.reminderDays=Math.max(1,Math.min(30,Math.trunc(Number(parsed.reminderDays))));
    return safe;
  }catch(e){return {...DEFAULT_SETTINGS}}
}
function saveAppSettings(){
  try{
    const raw=JSON.stringify(appSettings);
    localStorage.setItem(SETTINGS_KEY,raw);
    return localStorage.getItem(SETTINGS_KEY)===raw;
  }catch(e){return false}
}
function isAppDark(){
  if(appSettings.appearance==='dark')return true;
  if(appSettings.appearance==='light')return false;
  try{return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches}catch(e){return false}
}
function applyAppSettings(persist=true){
  const root=document.documentElement;
  root.dataset.appearance=appSettings.appearance;
  root.dataset.accent=appSettings.accent;
  root.dataset.textSize=appSettings.textSize;
  root.dataset.density=appSettings.density;
  root.dataset.reducedMotion=appSettings.reducedMotion?'true':'false';
  root.dataset.timeFormat=appSettings.timeFormat;
  if(isAppDark())root.classList.add('app-dark');else root.classList.remove('app-dark');
  return persist?saveAppSettings():true;
}
function resetAppSettings(){
  const old={...appSettings};appSettings={...DEFAULT_SETTINGS};
  if(!applyAppSettings()){
    appSettings=old;applyAppSettings(false);renderSettings();toast('無法儲存預設設定，已恢復原設定');return;
  }
  renderSettings();toast('已恢復預設外觀與提醒偏好');
}
function setAppSetting(key,value){
  if(!(key in DEFAULT_SETTINGS))return;
  const allowed={
    appearance:['system','light','dark'],
    accent:['slate','sage','plum','charcoal'],
    textSize:['normal','large'],
    density:['comfortable','standard','compact'],
    dateFormat:['yyyy/mm/dd','yyyy-mm-dd'],
    timeFormat:['24','12']
  };
  if(Object.prototype.hasOwnProperty.call(allowed,key)){
    if(!allowed[key].includes(value))return;
  }else if(key==='reducedMotion'||key==='activityReminder'||key==='scholarshipReminder'){
    value=!!value;
  }else if(key==='reminderDays'){
    if(!Number.isFinite(Number(value)))return;
    value=Math.max(1,Math.min(30,Math.trunc(Number(value))));
  }else return;
  if(appSettings[key]===value)return;
  const old={...appSettings};appSettings[key]=value;
  if(!applyAppSettings()){
    appSettings=old;applyAppSettings(false);renderSettings();toast('設定未能永久保存，已恢復原值');return;
  }
  // Avoid re-rendering the whole modal: retain focus and scroll position.
  const feedback=document.getElementById('settingsSaveStatus');
  if(feedback)feedback.textContent='已儲存於本機（不修改目標與學習紀錄）';
}
// Restore persisted appearance at each startup without writing to storage.
applyAppSettings(false);
// Follow OS appearance changes without writing to local storage or showing notifications.
try{
  const gmScheme=window.matchMedia?.('(prefers-color-scheme: dark)');
  const refreshScheme=()=>{if(appSettings.appearance==='system')applyAppSettings(false)};
  if(gmScheme?.addEventListener)gmScheme.addEventListener('change',refreshScheme);
  else if(gmScheme?.addListener)gmScheme.addListener(refreshScheme);
}catch(e){}
// Close only the settings dialog when Escape is pressed.
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.getElementById('settingsModal')?.classList.contains('show'))closeSettings();
});
function openSettings(){
  const modal=document.getElementById('settingsModal');if(!modal)return false;
  renderSettings();
  modal.classList.add('show');
  modal.style.display='flex';
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
  return true;
}
function closeSettings(){
  const modal=document.getElementById('settingsModal');
  if(modal){modal.classList.remove('show');modal.style.display='none';modal.setAttribute('aria-hidden','true');}
  document.body.style.overflow='';
}
function settingsSelect(key,options){return `<select onchange="setAppSetting('${key}',this.value)">${options.map(([v,t])=>`<option value="${v}" ${String(appSettings[key])===String(v)?'selected':''}>${t}</option>`).join('')}</select>`}
function settingsSwitch(key,label){return `<label class="settings-switch"><span>${label}</span><input type="checkbox" ${appSettings[key]?'checked':''} onchange="setAppSetting('${key}',this.checked)"><i></i></label>`}
/* GM-SETTINGS-HUB-20261008: five sections, one surface, local-only preferences. */
let settingsOpenPanel='appearance';
function settingsPanelMarkup(id,number,title,description,content){
  return `<details id="settings-panel-${id}" class="settings-hub-panel" data-section="${id}" ${settingsOpenPanel===id?'open':''}>
    <summary class="settings-hub-summary"><span class="settings-hub-number">${number}</span><span class="settings-hub-label"><b>${title}</b><small>${description}</small></span><span class="settings-hub-chevron" aria-hidden="true">⌄</span></summary>
    <div class="settings-hub-content">${content}</div>
  </details>`;
}
function syncSettingsHubNav(){
  const body=document.getElementById('settingsBody');if(!body)return;
  body.querySelectorAll('[data-settings-jump]').forEach(button=>{
    const active=button.dataset.settingsJump===settingsOpenPanel;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
}
function showSettingsSection(section){
  const body=document.getElementById('settingsBody');if(!body)return;
  const target=body.querySelector('#settings-panel-'+section);if(!target)return;
  settingsOpenPanel=section;
  body.querySelectorAll('.settings-hub-panel').forEach(panel=>{panel.open=panel===target;});
  syncSettingsHubNav();
  target.scrollIntoView?.({block:'start',behavior:appSettings.reducedMotion?'auto':'smooth'});
}
function renderSettings(){
  const b=document.getElementById('settingsBody');if(!b)return;
  const modal=document.getElementById('settingsModal');
  const scrollTop=modal?.scrollTop||0;
  const notif=('Notification' in window)?(Notification.permission||'default'):'unsupported';
  const notice=notif==='granted'?'已允許':notif==='denied'?'已拒絕':notif==='unsupported'?'不支援':'尚未設定';
  const colors=[['slate','霧藍'],['sage','鼠尾草綠'],['plum','灰紫'],['charcoal','石墨灰']];
  const colorOptions=colors.map(([value,label])=>`<label class="settings-hub-color-option">
      <input type="radio" name="settingsAccent" value="${value}" ${appSettings.accent===value?'checked':''} onchange="setAppSetting('accent',this.value)">
      <span class="settings-hub-color-swatch" data-swatch="${value}" aria-hidden="true"></span><span>${label}</span>
    </label>`).join('');
  const appearance=`
    <div class="settings-section">
      <div class="settings-row"><div><b>顯示模式</b><small>跟隨系統、淺色或深色；隨裝置切換</small></div>${settingsSelect('appearance',[['system','跟隨系統'],['light','淺色'],['dark','深色']])}</div>
      <div class="settings-row settings-hub-colors"><div><b>全站主色</b><small>套用至主要按鈕、導覽與統一設計元件</small></div><div class="settings-hub-color-options" role="group" aria-label="全站主色">${colorOptions}</div></div>
      <div class="settings-row"><div><b>字體大小</b><small>依手機閱讀需求調整字體</small></div>${settingsSelect('textSize',[['normal','標準'],['large','加大']])}</div>
      <div class="settings-row"><div><b>資訊密度</b><small>調整卡片間距，避免資訊過度擁擠</small></div>${settingsSelect('density',[['comfortable','舒適'],['standard','標準'],['compact','精簡']])}</div>
      <div class="settings-row">${settingsSwitch('reducedMotion','減少轉場動畫')}</div>
      <div class="settings-hub-inline-actions"><button class="btn" type="button" onclick="resetAppSettings()">恢復顯示與提醒預設</button></div>
    </div>`;
  const notification=`
    <div class="settings-section">
      <p class="settings-hub-note">以下為本機提醒偏好；目前不保證 App 關閉後的定時背景推播。系統不會因開啟權限而自行發送通知。</p>
      ${settingsSwitch('activityReminder','活動截止提醒偏好')}
      ${settingsSwitch('scholarshipReminder','獎學金截止提醒偏好')}
      <div class="settings-row"><div><b>提前天數</b><small>供支援提醒的功能使用</small></div>${settingsSelect('reminderDays',[['1','1 天前'],['3','3 天前'],['7','7 天前'],['14','14 天前']])}</div>
      <div class="settings-permission"><div>瀏覽器通知權限：<b>${notice}</b><small>${notif==='denied'?'請在瀏覽器網站設定中調整權限':'權限狀態不等於已啟用背景通知'}</small></div><button class="btn" type="button" onclick="requestNotificationPermission()" ${notif==='unsupported'||notif==='denied'?'disabled':''}>${notif==='granted'?'確認權限':'請求權限'}</button></div>
    </div>`;
  const application=`
    ${typeof pwaSettingsPanelHTML==='function'?pwaSettingsPanelHTML():'<div class="settings-section">PWA 更新資訊載入中，仍可透過瀏覽器重新開啟。</div>'}
    <div class="settings-section about-section"><div class="settings-section-head"><div><h3>版本與應用程式資訊</h3><p>此處只呈現系統版本，不會修改使用者資料。</p></div></div>
      <div class="about-version"><b id="settingsVersion">${window.AppConfig?.version||'V98.12.0'}</b><span>個人目標與學習行動管理系統｜資料結構 V${globalThis.GOAL_MANAGER_SCHEMA_VERSION||6}</span></div>
      ${window.__DEV_PREVIEW__===true?'<button class="text-button developer-entry" type="button" onclick="registerDeveloperTap()">檢視進階系統資訊</button>':''}
    </div>`;
  const data=`
    <div class="settings-section">
      <div class="settings-section-head"><div><h3>匯出與還原</h3><p>備份與檢查不會改變現有目標；匯入及還原會先驗證資料。</p></div></div>
      <div class="settings-action-grid">
        <button class="btn primary" type="button" onclick="exportDBWithFeedback()">匯出全部資料</button>
        <button class="btn" type="button" onclick="importDB()">匯入備份檔</button>
        <button class="btn" type="button" onclick="createRestorePoint()">建立復原點</button>
        <button class="btn" type="button" onclick="restoreLatestBackup()">還原最近備份</button>
      </div>
      <div class="settings-data-status" id="settingsDataStatus">正在檢查資料狀態…</div>
      <div class="security-facts settings-hub-security"><div><b>使用者資料</b><span>主要儲存在本機瀏覽器</span></div><div><b>資料保護</b><span>多份備份、驗證與歷程保護維持不變</span></div></div>
      <details class="settings-hub-advanced"><summary>進階資料操作（須再次確認）</summary>
        <div class="settings-hub-advanced-body"><p>只有明確選擇修復或清除時才會執行；請先匯出備份。</p>
          <div class="settings-action-grid"><button class="btn" type="button" onclick="clearCacheOnly()">僅清除應用快取</button><button class="btn" type="button" onclick="rebuildLocalIndexes()">重建資料索引</button></div>
          <div class="settings-danger"><div><b>危險操作</b><small>清除本機資料前會再次確認並建立備份；唯讀救援模式禁止執行。</small></div><button class="dangerbtn" type="button" onclick="resetUserData()">清除本機使用者資料</button></div>
        </div>
      </details>
    </div>`;
  const health=`
    <div class="settings-section">
      <div class="settings-section-head"><div><h3>系統診斷</h3><p>檢查資料完整性、程式邊界、快取與儲存；不執行資料修復。</p></div><button class="btn gold" type="button" onclick="runDiagnostics()">執行檢查</button></div>
      <div id="diagnosticResult" class="diagnostic-result"><div class="diagnostic-empty">尚未執行完整檢查。</div></div>
    </div>
    <div id="settingsHealthMount" aria-label="自動資料健康與汰除歷程"><p class="settings-hub-note">活動雷達、獎學金及汰除歷程的監測資訊正在載入。</p></div>`;
  const tabs=[['appearance','外觀顯示'],['notification','提醒通知'],['application','應用程式'],['data','資料備份'],['health','系統健康']];
  b.innerHTML=`<div class="settings-hub-intro"><div><strong>系統控制中心</strong><small>5 個區塊，集中設定與檢查；目標資料不受外觀更改影響。</small></div><span>${window.AppConfig?.version||'V98.12.0'}</span></div>
    <nav class="settings-hub-nav" aria-label="設定區域">${tabs.map(([id,label])=>`<button type="button" data-settings-jump="${id}" aria-pressed="false" onclick="showSettingsSection('${id}')">${label}</button>`).join('')}</nav>
    <p class="settings-hub-save-status" id="settingsSaveStatus" role="status" aria-live="polite">偏好儲存於這台裝置，與目標／學習紀錄分離。</p>`+
    settingsPanelMarkup('appearance','01','外觀與顯示','深淺模式、主色、字體、資訊密度',appearance)+
    settingsPanelMarkup('notification','02','提醒與通知','提醒偏好與通知權限',notification)+
    settingsPanelMarkup('application','03','應用程式','PWA 安裝、更新與版本',application)+
    settingsPanelMarkup('data','04','資料與備份','匯入匯出、復原與資料安全',data)+
    settingsPanelMarkup('health','05','系統健康','資料來源、汰除歷程與診斷',health);
  if(b.dataset.settingsHubBound!=='1'){
    b.addEventListener('toggle',event=>{
      const panel=event.target;
      if(!panel?.classList?.contains('settings-hub-panel'))return;
      if(panel.open){
        settingsOpenPanel=panel.dataset.section;
        b.querySelectorAll('.settings-hub-panel').forEach(other=>{if(other!==panel)other.open=false;});
      }else if(settingsOpenPanel===panel.dataset.section)settingsOpenPanel=null;
      syncSettingsHubNav();
    },true);
    b.dataset.settingsHubBound='1';
  }
  syncSettingsHubNav();
  if(modal)modal.scrollTop=scrollTop;
  updateSettingsDataStatus();
}
async function updateSettingsDataStatus(){
 const el=document.getElementById('settingsDataStatus');if(!el)return;
 const storeState=typeof storeWriteStatus==='function'?storeWriteStatus():null;let storage='不可用';try{storage=storeState?.persistent===false?'⚠ 暫存模式（關閉後可能遺失）':(localStorage?'✓ 永久儲存可用':'不可用')}catch(e){storage='⚠ 暫存模式'}
 if(typeof persistenceRecoveryBlocked!=='undefined'&&persistenceRecoveryBlocked)storage='⚠ 唯讀救援模式：不得寫入或清除資料';
 const size=(()=>{try{return Math.round(new Blob([storeGet(KEY)||'']).size/1024)}catch(e){return 0}})();
 const backups=BACKUP_KEYS.filter(k=>!!storeGet(k)).length;
 const anchor=typeof historyAnchorSummary==='function'?historyAnchorSummary():null;
 const anchorText=anchor?`✓ ${anchor.logCount} 筆／${anchor.totalMinutes} 分鐘`:'⚠ 尚未建立';
 const errs=typeof validateDB==='function'?validateDB():[];
 el.innerHTML=`<div><b>資料結構</b><span>${errs.length?'⚠ '+errs.length+' 項問題':'✓ 正常'}</span></div><div><b>本機儲存</b><span>${storage}</span></div><div><b>目前資料大小</b><span>${size} KB</span></div><div><b>可用備份</b><span>${backups} 份</span></div><div><b>歷程安全基準</b><span>${anchorText}</span></div>`;
}
function exportDBWithFeedback(){
 Promise.resolve().then(()=>exportDB()).then(()=>toast('備份檔已準備下載'))
  .catch(e=>{console.error('Backup export failed',e);toast('備份產生失敗，請勿刪除原資料')});
}
function createRestorePoint(){
 try{if(save({backup:true})) {renderSettings();toast('已建立復原點；目前資料未改變')}}catch(e){toast('建立復原點失敗')}
}
function restoreLatestBackup(){
 const raws=BACKUP_KEYS.map(k=>({key:k,raw:storeGet(k)})).filter(x=>x.raw);
 if(!raws.length){toast('目前沒有可還原的備份');return}
 const latest=raws[0];
 if(!confirm('確定要還原最近一份備份？\n目前資料會先保留在另一個備份槽。'))return;
 try{
  const d=tryReadCandidate(latest.raw,latest.key);if(!d)throw new Error('備份資料無效');
  const previous=db;db=d;if(!save({backup:true,allowLogReplacement:true})){db=previous;throw new Error('保存失敗')}
  selected=null;goalPath={long:null,mid:null,short:null,exec:null};renderAll();renderSettings();toast('已還原最近備份');
 }catch(e){toast('還原失敗；目前資料未變更')}
}
function resetUserData(){
 if(typeof persistenceRecoveryBlocked!=='undefined'&&persistenceRecoveryBlocked){
  toast('資料正在唯讀救援保護模式；禁止清除');return;
 }
 if(!confirm('⚠️ 確定清除本機使用者資料？\n\n系統會先建立一次備份，再恢復為初始資料。'))return;
 const previous=db;
 const current=storeGet(KEY);
 if(current){
  const backedUp=storeSet(BACKUP_KEYS[0],current)&&storeWriteStatus().persistent!==false&&storeGet(BACKUP_KEYS[0])===current;
  if(!backedUp){toast('無法確認復原備份完整，已取消清除');return}
 }
 try{
  db=normalize(seed());ensureSchoolCalendar();ensureToeicPlan();
  if(!save({backup:false,allowLogReplacement:true}))throw new Error('儲存失敗');
  selected=null;goalPath={long:null,mid:null,short:null,exec:null};renderAll();closeSettings();toast('已恢復初始資料；舊資料已保留備份');
 }catch(e){db=previous;toast('重置失敗；原資料保持不變')}
}
async function requestNotificationPermission(){
 if(!('Notification' in window)){toast('此瀏覽器不支援通知');return}
 try{const result=await Notification.requestPermission();renderSettings();toast(result==='granted'?'通知權限已允許':result==='denied'?'通知權限已拒絕':'尚未允許通知')}catch(e){toast('無法取得通知權限')}
}
function rebuildLocalIndexes(){
 const previous=JSON.parse(JSON.stringify(db));
 try{
  db=normalize(db);rebuildExecutionPlanActuals();ensureActivities();ensureSchoolCalendar();recalcAllStatuses();
  if(!save({backup:true}))throw new Error('儲存失敗');
  renderAll();renderSettings();toast('資料索引已重建並重新驗證');
 }catch(e){db=previous;toast('重建索引失敗；原資料保持不變')}
}
async function runDiagnostics(){
 const box=document.getElementById('diagnosticResult');if(!box)return;
 box.innerHTML='<div class="diagnostic-running">正在檢查系統…</div>';
 const checks=[];
 try{checks.push(['核心資料結構',validateDB().length===0,validateDB().slice(0,2).join('；')])}catch(e){checks.push(['核心資料結構',false,e.message])}
 try{const normalized=normalize(db);const env=makeEnvelope(normalized);const p=parseEnvelope(JSON.stringify(env));checks.push(['Checksum／序列化',dataPayload(p.data)===dataPayload(normalized),''])
 try{const env2=await makeSecureBackupEnvelope(normalized);const secureOk=!env2.integrity||((await sha256Hex(dataPayload(env2.data)))===env2.integrity.digest);checks.push(['SHA-256 備份完整性',secureOk,env2.integrity?'Web Crypto 已啟用':'瀏覽器未提供 Web Crypto'])}catch(e){checks.push(['SHA-256 備份完整性',false,e.message])}}catch(e){checks.push(['Checksum／序列化',false,e.message])}
 try{checks.push(['七模組 DOM',auditDOM().ok,''])}catch(e){checks.push(['七模組 DOM',false,e.message])}
 try{checks.push(['安全邊界',securityDiagnostics().ok&&safeExternalUrl('javascript:alert(1)')==='',''])}catch(e){checks.push(['安全邊界',false,e.message])}
 try{checks.push(['活動資料',Array.isArray(db.activities)&&db.activities.length>0,''])}catch(e){checks.push(['活動資料',false,e.message])}
 try{checks.push(['獎學金資料',Array.isArray(db.scholarships)&&db.scholarships.length>0,''])}catch(e){checks.push(['獎學金資料',false,e.message])}
 try{const anchor=typeof historyAnchorSummary==='function'?historyAnchorSummary():null;checks.push(['歷程安全基準',!!anchor,anchor?`${anchor.logCount} 筆／${anchor.totalMinutes} 分鐘`:'尚未建立'])}catch(e){checks.push(['歷程安全基準',false,e.message])}
 try{const ok=typeof indexedDB!=='undefined';checks.push(['IndexedDB 鏡像',ok,'瀏覽器支援狀態'])}catch(e){checks.push(['IndexedDB 鏡像',false,e.message])}
 try{let cacheCount=0;if('caches' in window)cacheCount=(await caches.keys()).length;checks.push(['Cache／Service Worker',('serviceWorker' in navigator),'快取 '+cacheCount+' 組'])}catch(e){checks.push(['Cache／Service Worker',false,e.message])}
 try{const estimate=navigator.storage?.estimate?await navigator.storage.estimate():null;const used=estimate?.usage?Math.round(estimate.usage/1024):null;checks.push(['瀏覽器儲存空間',true,used===null?'可用':'約 '+used+' KB 已使用'])}catch(e){checks.push(['瀏覽器儲存空間',true,'瀏覽器未提供估算'])}
 box.innerHTML=checks.map(c=>`<div class="diagnostic-row"><span>${c[1]?'✓':'✗'} ${esc(c[0])}</span><b class="${c[1]?'ok':'bad'}">${c[1]?'正常':esc(c[2]||'失敗')}</b></div>`).join('')+`<div class="diagnostic-summary ${checks.every(c=>c[1])?'ok':'warn'}">${checks.every(c=>c[1])?'系統完整性檢查通過':'發現需要注意的項目，請查看上方結果。'}</div>`;
}
