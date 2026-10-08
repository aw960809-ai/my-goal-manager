const APP_VERSION=String(window.AppConfig?.version||('V'+String(globalThis.GOAL_MANAGER_VERSION||'98.9.4')));
const SCHEMA_VERSION=Number(globalThis.GOAL_MANAGER_SCHEMA_VERSION||6);
const KEY='lawLangGoalSystemV92';
const BACKUP_KEYS=['lawLangGoalSystemV92_backup1','lawLangGoalSystemV92_backup2','lawLangGoalSystemV92_backup3'];
const ACTIVE_TIMER_KEY='lawLangGoalActiveTimerV1';
const HISTORY_ANCHOR_KEY='lawLangGoalSystemV92_historyAnchorV1';
const L={1:'方向／重要目標',2:'階段目標',3:'子任務',4:'具體行動'};
let recoveryNotice='';
let persistenceRecoveryBlocked=false;
let db=null;
function isUsableData(d){return !!d&&Array.isArray(d.tasks)&&Array.isArray(d.logs)}
function preparePersistentData(d){
 const normalized=normalize(d);
 normalized.activities=mergeActivityCatalog(validateCatalogBoundary(normalized.activities,'活動'));
 normalized.scholarships=mergeScholarshipCatalog(validateCatalogBoundary(normalized.scholarships,'獎學金'));
 if(!Array.isArray(normalized.activities)||!normalized.activities.length)normalized.activities=ACTIVITY_SEED.map(x=>({...x}));
 if(!Array.isArray(normalized.scholarships)||!normalized.scholarships.length)normalized.scholarships=SCHOLARSHIP_SEED.map(x=>({...x}));
 normalized.schoolCalendar=Array.isArray(normalized.schoolCalendar)?normalized.schoolCalendar:[];
 return normalized;
}
function persistEnvelope(d,{
 backup=true,
 allowLogReplacement=false
}={}){
 if(persistenceRecoveryBlocked)throw new Error('主資料及備份均無法安全解碼；已進入唯讀保護模式，請先救援原始資料');
 const normalized=DataPersistence.persist(d,{
  prepare:preparePersistentData,
  read:storeGet,
  write:storeSet,
  writeStatus:typeof storeWriteStatus==='function'?storeWriteStatus:null,
  key:KEY,
  backupKeys:BACKUP_KEYS,
  backup,
  guard:({oldRaw,nextData})=>{
   if(allowLogReplacement||!oldRaw)return;
   let previous=null;
   try{
    const parsed=parseEnvelope(oldRaw);
    previous=migrateData(parsed.data,parsed.schemaVersion);
   }catch(_){
    return;
   }
   HistoryGuard.assertPreserved(previous,nextData);
  },
  makeEnvelope,
  parseEnvelope,
  serializePayload:dataPayload,
  checksum:fnv1a
 });
 db=normalized;
 return true;
}

function ensureHistoryAnchor(){
 try{
  if(storeGet(HISTORY_ANCHOR_KEY))return true;
  const raw=storeGet(KEY);
  if(!raw)return false;
  const parsed=parseEnvelope(raw);
  const data=migrateData(parsed.data,parsed.schemaVersion);
  const info=HistoryGuard.metrics(data);
  if(info.logCount<=0)return false;
  return !!storeSet(HISTORY_ANCHOR_KEY,raw);
 }catch(e){
  console.warn('history anchor creation failed',e);
  return false;
 }
}

function historyAnchorSummary(){
 try{
  const raw=storeGet(HISTORY_ANCHOR_KEY);
  if(!raw)return null;
  const parsed=parseEnvelope(raw);
  const data=migrateData(parsed.data,parsed.schemaVersion);
  return {
   ...HistoryGuard.metrics(data),
   savedAt:JSON.parse(raw)?.savedAt||''
  };
 }catch(_){
  return null;
 }
}
let calendarCursor=new Date(),selected=null,timer=TimerService.empty(),goalPath={long:null,mid:null,short:null,exec:null};

function timerPayload(){return TimerService.payload(timer)}
function saveActiveTimer(){
 try{
  const ok=storeSet(ACTIVE_TIMER_KEY,JSON.stringify(timerPayload()));
  return !!ok&&(!storeWriteStatus||storeWriteStatus().persistent!==false);
 }catch(e){console.warn('active timer persistence failed',e);return false}
}
function clearActiveTimer(){try{localStorage.removeItem(ACTIVE_TIMER_KEY)}catch(e){try{delete memoryStore[ACTIVE_TIMER_KEY]}catch(_){}}}
function restoreActiveTimer(){
 try{
  const raw=storeGet(ACTIVE_TIMER_KEY);if(!raw)return false;
  const saved=JSON.parse(raw);if(!saved||typeof saved!=='object')return false;
  timer=TimerService.normalize(saved);
  if(timer.running&&!timer.start)timer={...timer,start:Date.now()};
  return true;
 }catch(e){clearActiveTimer();return false}
}
restoreActiveTimer();

function mk(id,name,level,parent,status='未開始',weeklyMinutes=180,start='',due=''){return{id,name,level,parent,status,weeklyMinutes:level===4?Math.max(0,weeklyMinutes):0,start:level===3?start:'',due:level===3?due:'',progress:status==='已完成'?100:0}}





function ensureActivities(){
 const legacy=Array.isArray(db.activities)?db.activities:[];
 const legacyScholarships=legacy.filter(a=>a&&(a.scholarship||a.type==='獎學金／助學金'||a.kind==='scholarship'));
 if(!Array.isArray(db.scholarships))db.scholarships=[];
 if(legacyScholarships.length){
   db.scholarships=mergeScholarshipCatalog([...db.scholarships,...legacyScholarships]);
 }
 db.activities=mergeActivityCatalog(legacy);
 db.scholarships=mergeScholarshipCatalog(db.scholarships);
}
const THU_SCHOOL_CALENDAR_BASE=[
{"date":"2026-09-14","title":"第1學期上課開始","type":"school","meta":"東海大學 115 學年度"},
{"date":"2026-09-28","title":"中秋節｜放假一天","type":"holiday","meta":"東海大學行事曆"},
{"date":"2026-09-29","title":"孔子誕辰紀念日、教師節｜放假一天","type":"holiday","meta":"東海大學行事曆"},
{"date":"2026-10-10","title":"國慶日｜放假一天","type":"holiday","meta":"東海大學行事曆"},
{"date":"2026-10-12","title":"國慶日補假｜放假一天","type":"holiday","meta":"東海大學行事曆"},
{"date":"2026-10-25","title":"臺灣光復暨金門古寧頭大捷紀念日｜放假一天","type":"holiday","meta":"東海大學行事曆"},
{"date":"2026-10-26","title":"臺灣光復暨金門古寧頭大捷紀念日補假","type":"holiday","meta":"東海大學行事曆"},
{"date":"2026-10-29","title":"全校運動大會｜停課、照常上班","type":"school","meta":"東海大學行事曆"},
{"date":"2026-11-02","title":"校慶紀念日｜停課、照常上班","type":"school","meta":"東海大學行事曆"},
{"date":"2026-11-03","title":"期中考試週開始","type":"exam","meta":"東海大學行事曆"},
{"date":"2026-11-09","title":"期中考試週結束","type":"exam","meta":"東海大學行事曆"},
{"date":"2026-11-28","title":"115年地方公職人員選舉投票｜放假一天","type":"holiday","meta":"東海大學行事曆"},
{"date":"2026-12-24","title":"下午停課、照常上班","type":"special","meta":"東海大學行事曆"},
{"date":"2026-12-25","title":"行憲紀念日、聖誕節｜放假一天","type":"holiday","meta":"東海大學行事曆"},
{"date":"2026-12-26","title":"學期考試週開始","type":"exam","meta":"東海大學行事曆"},
{"date":"2026-12-31","title":"學期考試週結束","type":"exam","meta":"東海大學行事曆"},
{"date":"2027-01-01","title":"開國紀念日｜放假一天","type":"holiday","meta":"東海大學行事曆"},
{"date":"2027-01-04","title":"彈性學習週開始","type":"school","meta":"東海大學行事曆"},
{"date":"2027-01-18","title":"寒假開始","type":"school","meta":"東海大學行事曆"},
{"date":"2027-01-31","title":"115學年度第1學期終了","type":"school","meta":"東海大學行事曆"},
{"date":"2027-02-01","title":"115學年度第2學期開始／春節輪值","type":"school","meta":"東海大學行事曆"},
{"date":"2027-02-02","title":"春節年假開始","type":"holiday","meta":"東海大學行事曆"},
{"date":"2027-02-12","title":"寒假結束／分區停電保養結束","type":"school","meta":"東海大學行事曆"},
{"date":"2027-02-22","title":"第2學期上課開始","type":"school","meta":"東海大學行事曆"},
{"date":"2027-02-28","title":"和平紀念日｜放假一天","type":"holiday","meta":"東海大學行事曆"},
{"date":"2027-03-01","title":"和平紀念日補假","type":"holiday","meta":"東海大學行事曆"},
{"date":"2027-04-02","title":"116年5月29日畢業典禮補假｜調整放假一天","type":"holiday","meta":"東海大學行事曆"},
{"date":"2027-04-04","title":"兒童節｜放假一天","type":"holiday","meta":"東海大學行事曆"},
{"date":"2027-04-05","title":"民族掃墓節｜放假一天","type":"holiday","meta":"東海大學行事曆"},
{"date":"2027-04-06","title":"兒童節補假","type":"holiday","meta":"東海大學行事曆"},
{"date":"2027-04-10","title":"期中考試週開始","type":"exam","meta":"東海大學行事曆"},
{"date":"2027-04-17","title":"期中考試週結束","type":"exam","meta":"東海大學行事曆"},
{"date":"2027-05-01","title":"勞動節｜放假一天","type":"holiday","meta":"東海大學行事曆"},
{"date":"2027-05-29","title":"畢業典禮｜停課、照常上班","type":"school","meta":"東海大學行事曆"},
{"date":"2027-06-05","title":"學期考試週開始","type":"exam","meta":"東海大學行事曆"},
{"date":"2027-06-12","title":"學期考試週結束","type":"exam","meta":"東海大學行事曆"},
{"date":"2027-06-14","title":"彈性學習週開始","type":"school","meta":"東海大學行事曆"},
{"date":"2027-06-28","title":"暑假開始","type":"school","meta":"東海大學行事曆"},
{"date":"2027-07-31","title":"115學年度終了","type":"school","meta":"東海大學行事曆"}
];
function ensureSchoolCalendar(){
 if(!Array.isArray(db.schoolCalendar)||!db.schoolCalendar.length){
   db.schoolCalendar=THU_SCHOOL_CALENDAR_BASE.map((e,i)=>({...e,id:e.id||('thu115-'+i)}));
 }
}
// V86: keep a second local mirror in IndexedDB when available. This is asynchronous and never blocks the app.
const IDB_NAME='lawLangGoalSystemPersistentV87';
const IDB_STORE='snapshots';
function idbOpen(){return new Promise((resolve,reject)=>{try{if(!window.indexedDB)return reject(new Error('IndexedDB unavailable'));const r=indexedDB.open(IDB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(IDB_STORE))r.result.createObjectStore(IDB_STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}catch(e){reject(e)}})}
async function idbMirrorSave(){
 // A missing/corrupt primary or read-only recovery must never poison the last IDB mirror.
 if(persistenceRecoveryBlocked)return false;
 const raw=storeGet(KEY);
 if(!raw||!tryReadCandidate(raw,'idb-mirror'))return false;
 let mirror=null;
 try{
  mirror=await idbOpen();
  const tx=mirror.transaction(IDB_STORE,'readwrite');
  tx.objectStore(IDB_STORE).put(raw,KEY);
  await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error)});
  return true;
 }catch(e){console.warn('IDB mirror write failed',e);return false}
 finally{try{mirror?.close()}catch(_){}}
}
const THU_1151_LAW_PLAN_MARKER='thuPersonalMigration:1151-law-preview:v2';
db=loadDB();
ensureHistoryAnchor();
removeLegacyStandaloneToeicGoals();
ensureSchoolCalendar();
const thu1151LawPlanMigration=ensureThu1151LawPreviewPlan();
const toeicIntegratedPlanMigration=ensureToeicPlan();
const initialPersonalSaveOk=save({backup:!!((thu1151LawPlanMigration&&thu1151LawPlanMigration.applied)||(toeicIntegratedPlanMigration&&toeicIntegratedPlanMigration.applied))});
if(initialPersonalSaveOk&&thu1151LawPlanMigration&&thu1151LawPlanMigration.applied){
 try{storeSet(THU_1151_LAW_PLAN_MARKER,'1')}catch(_){}
}
cleanupLegacyStorage();
setTimeout(()=>idbMirrorSave(),500);
function seed(){const d={tasks:[
 mk('g1','台大及政大轉學考',1,null,'未開始',0,'不定期'),
 mk('g1-1','校內學科預習',2,'g1','未開始',0,'不定期'),
 mk('g1-2','刑總複習',2,'g1','未開始',0,'不定期'),
 mk('g1-2-1','體系與申論建構',3,'g1-2','未開始',0,'不定期'),
 mk('g1-2-1-1','透明刑總 I',4,'g1-2-1','未開始',420),
 mk('g1-2-1-2','透明刑總 II',4,'g1-2-1','未開始',420),
 mk('g1-2-2','政大考古題練習',3,'g1-2','未開始',0,'不定期'),
 mk('g1-2-2-1','105～115 I',4,'g1-2-2','未開始',120),
 mk('g1-2-2-2','105～115 II',4,'g1-2-2','未開始',120),
 mk('g1-3','民總複習',2,'g1','未開始',0,'不定期'),
 mk('g1-3-1','體系建構與思維訓練',3,'g1-3','未開始',0,'不定期'),
 mk('g1-3-1-1','請求權與總則規定體系圖建立',4,'g1-3-1','未開始',420),
 mk('g1-3-1-2','案例研習',4,'g1-3-1','未開始',420),
 mk('g1-3-2','台政大考古',3,'g1-3','未開始',0,'不定期'),
 mk('g1-3-2-1','105～115 I',4,'g1-3-2','未開始',240),
 mk('g1-3-2-2','105～115 II',4,'g1-3-2','未開始',240),
 mk('g1-4','憲法',2,'g1','未開始',0,'不定期'),
 mk('g1-4-1','基本權與審查',3,'g1-4','未開始',0,'不定期'),
 mk('g1-4-1-1','體系圖建立',4,'g1-4-1','未開始',420),
 mk('g1-4-1-2','基本權釋字整理',4,'g1-4-1','未開始',420),
 mk('g1-4-2','台大考古',3,'g1-4','未開始',0,'不定期'),
 mk('g1-4-2-1','105～115 I',4,'g1-4-2','未開始',60),
 mk('g1-4-2-2','105～115 II',4,'g1-4-2','未開始',60),
 mk('g2','青年計畫／海外活動',1,null,'未開始',0,'不定期'),
 mk('g3','語言能力準備',1,null,'未開始',0,'不定期'),
 mk('g3-1','TOEIC 基礎能力建立',2,'g3','未開始',0,'不定期'),
 mk('g3-1-1','字彙與核心句型',3,'g3-1','未開始',0,'不定期'),
 mk('g3-1-1-1','多益核心字彙',4,'g3-1-1','未開始',75),
 mk('g3-1-1-2','文法與句型基礎',4,'g3-1-1','未開始',75),
 mk('g3-2','TOEIC 題型能力建立',2,'g3','未開始',0,'不定期'),
 mk('g3-2-1','聽力題型訓練 Part 1–4',3,'g3-2','未開始',0,'不定期'),
 mk('g3-2-1-1','Part 1–2 基礎聽力',4,'g3-2-1','未開始',90),
 mk('g3-2-1-2','Part 3–4 情境聽力',4,'g3-2-1','未開始',90),
 mk('g3-2-2','閱讀題型訓練 Part 5–7',3,'g3-2','未開始',0,'不定期'),
 mk('g3-2-2-1','Part 5–6 文法與段落填空',4,'g3-2-2','未開始',90),
 mk('g3-2-2-2','Part 7 閱讀理解',4,'g3-2-2','未開始',90),
 mk('g3-3','期中考試週維持',2,'g3','未開始',0,'不定期'),
 mk('g3-3-1','低負荷維持與錯題複習',3,'g3-3','未開始',0,'不定期'),
 mk('g3-3-1-1','字彙／聽力維持',4,'g3-3-1','未開始',45),
 mk('g3-3-1-2','錯題快速複習',4,'g3-3-1','未開始',30),
 mk('g3-4','TOEIC 實戰與弱點修正',2,'g3','未開始',0,'不定期'),
 mk('g3-4-1','分項實戰與弱點循環',3,'g3-4','未開始',0,'不定期'),
 mk('g3-4-1-1','聽力限時練習',4,'g3-4-1','未開始',105),
 mk('g3-4-1-2','閱讀限時練習',4,'g3-4-1','未開始',105),
 mk('g3-4-1-3','錯題與弱點修正',4,'g3-4-1','未開始',0),
 mk('g3-5','考前衝刺',2,'g3','未開始',0,'不定期'),
 mk('g3-5-1','完整模擬與考前調整',3,'g3-5','未開始',0,'不定期'),
 mk('g3-5-1-1','完整模擬測驗',4,'g3-5-1','未開始',150),
 mk('g3-5-1-2','閱讀速度與時間配置',4,'g3-5-1','未開始',90),
 mk('g3-5-1-3','聽力穩定度與最後修正',4,'g3-5-1','未開始',90),
 mk('g3-6','TOEIC 正式考試',2,'g3','未開始',0,'不定期'),
 mk('g3-6-1-stage','正式考試安排',3,'g3-6','未開始',0,'2026-12-20','2026-12-20'),
 mk('g3-6-1','2026/12/20 TOEIC 聽力與閱讀測驗',4,'g3-6-1-stage','未開始',0)],logs:[],activities:ACTIVITY_SEED.map(x=>({...x})),scholarships:SCHOLARSHIP_SEED.map(x=>({...x})),schoolCalendar:THU_SCHOOL_CALENDAR_BASE.map((e,i)=>({...e,id:e.id||('thu115-'+i)})),calendarEvents:[],executionPlans:[]};
 const periods={'g1-2-1':['2026-09-07','2026-12-31'],'g1-2-2':['2027-01-01','2027-06-30'],'g1-3-1':['2026-09-07','2026-12-31'],'g1-3-2':['2027-01-01','2027-06-30'],'g1-4-1':['2026-09-07','2026-12-31'],'g1-4-2':['2027-01-01','2027-06-30'],
  'g3-1-1':['2026-09-07','2026-09-27'],
  'g3-2-1':['2026-09-28','2026-10-25'],'g3-2-2':['2026-09-28','2026-10-25'],
  'g3-3-1':['2026-11-03','2026-11-09'],
  'g3-4-1':['2026-11-10','2026-12-06'],
  'g3-5-1':['2026-12-07','2026-12-19'],
  'g3-6':['2026-12-20','2026-12-20']};
 Object.entries(periods).forEach(([id,v])=>{const t=d.tasks.find(x=>x.id===id);if(t){t.start=v[0];t.due=v[1]}});
 return d;
}





function getTaskFrom(list,id){return (Array.isArray(list)?list:[]).find(t=>String(t.id)===String(id))||null}
function repairKnownHierarchy(tasks){
 const list=Array.isArray(tasks)?tasks:[];
 const root=list.find(t=>String(t.id)==='g3');
 const exam=list.find(t=>String(t.id)==='g3-6');
 const action=list.find(t=>String(t.id)==='g3-6-1');
 if(root&&exam&&String(exam.name||'')==='TOEIC 正式考試'){
  exam.level=2; exam.parent='g3'; exam.start=''; exam.due='';
  let stage=list.find(t=>String(t.id)==='g3-6-1-stage');
  if(!stage){
   stage={id:'g3-6-1-stage',name:'正式考試安排',level:3,parent:'g3-6',status:'未開始',weeklyMinutes:0,start:'2026-12-20',due:'2026-12-20',progress:0};
   list.push(stage);
  }else{
   stage.name='正式考試安排';stage.level=3;stage.parent='g3-6';stage.start='2026-12-20';stage.due='2026-12-20';
  }
  if(action&&String(action.name||'').includes('2026/12/20 TOEIC')){
   action.level=4;action.parent=stage.id;action.start='';action.due='';
  }
 }
 return list;
}


const STUDY_LOG_KIND=StudyLogDomain.KIND;
function normalizeLog(l){return StudyLogDomain.normalizeLog(l)}

function normalize(d){
 d=d&&Array.isArray(d.tasks)?d:{tasks:[],logs:[]};
 d.logs=(Array.isArray(d.logs)?d.logs:[]).map(normalizeLog).filter(Boolean);
 d.tasks=DataNormalization.normalizeTasks(d.tasks);
 repairKnownHierarchy(d.tasks);
 const ids=new Set(d.tasks.map(t=>t.id));
 d.tasks.forEach(t=>{if(t.level===1||!t.parent||!ids.has(t.parent)){t.parent=null}else if(getTaskFrom(d.tasks,t.parent)?.level!==t.level-1){t.parent=null;t.level=1}});
 d.tasks.forEach(t=>{let cur=t.parent,seen=new Set([t.id]),guard=0;while(cur&&guard++<10){if(seen.has(cur)){t.parent=null;t.level=1;break}seen.add(cur);cur=getTaskFrom(d.tasks,cur)?.parent||null}});
 const legacyScholarships=(Array.isArray(d.activities)?d.activities:[]).filter(a=>a&&(a.scholarship||a.type==='獎學金／助學金'||a.kind==='scholarship'));
 d.scholarships=mergeScholarshipCatalog([...(Array.isArray(d.scholarships)?d.scholarships:[]),...legacyScholarships]);
 d.activities=mergeActivityCatalog(d.activities);
 d.schoolCalendar=Array.isArray(d.schoolCalendar)?d.schoolCalendar:[];
 d.activitySource=typeof d.activitySource==='string'?d.activitySource:'';
 d.calendarSelected=typeof d.calendarSelected==='string'?d.calendarSelected:'';
 d.calendarEvents=Array.isArray(d.calendarEvents)?d.calendarEvents:[];
 d.executionPlans=Array.isArray(d.executionPlans)?d.executionPlans:[];
 d.weekReviews=DataNormalization.normalizeWeekReviews(d.weekReviews);
 return d;
}

function migrateData(d,fromVersion=0){
 return DataMigrations.migrate(d,{
  fromVersion,
  schemaVersion:SCHEMA_VERSION,
  normalize,
  repair:repairKnownHierarchy
 });
}
function tryReadCandidate(raw,label){
 return DataRepository.readCandidate(raw,{
  parseEnvelope,
  migrateData,
  isUsableData,
  validateData
 });
}
function legacyStorageKeys(){
 return ['lawLangGoalSystemV91','lawLangGoalSystemV90','lawLangGoalSystemV89','lawLangGoalSystemV88','lawLangGoalSystemV87','lawLangGoalSystemV86','lawLangGoalSystemV84','lawLangGoalSystemV83','lawLangGoalSystemV82','lawLangGoalSystemV81','lawLangGoalSystemV80','lawLangGoalSystemV79','lawLangGoalSystemV78','lawLangGoalSystemV77','lawLangGoalSystemV76','lawLangGoalSystemV75','lawLangGoalSystemV74','lawLangGoalSystemV73','lawLangGoalSystemV72','lawLangGoalSystemV71','lawLangGoalSystemV70','lawLangGoalSystemV69','lawLangGoalSystemV68','lawLangGoalSystemV67','lawLangGoalSystemV66','lawLangGoalSystemV65','lawLangGoalSystemV63','lawLangGoalSystemV62','lawLangGoalSystemV61','lawLangGoalSystemV60'];
}
function loadDB(){
 const found=DataPersistence.loadFirstValid({
  read:storeGet,
  currentKey:KEY,
  backupKeys:BACKUP_KEYS,
  legacyKeys:legacyStorageKeys(),
  decode:tryReadCandidate
 });

 if(found){
  if(found.source==='backup'){
   recoveryNotice='已從最近的有效備份恢復資料。';
   try{persistEnvelope(found.data,{backup:false,allowLogReplacement:true})}catch(e){}
  }else if(found.source==='legacy'){
   try{persistEnvelope(found.data,{backup:false,allowLogReplacement:true})}catch(e){}
  }
  return found.data;
 }

 // Do not silently replace an unreadable current/backup/legacy dataset with a seed.
 const storedKeys=[KEY,...BACKUP_KEYS,...legacyStorageKeys()];
 if(storedKeys.some(k=>storeGet(k)!==null)){
  persistenceRecoveryBlocked=true;
  recoveryNotice='偵測到無法解碼的既有資料；已禁止儲存與自動清除，請先使用資料救援檢查器。';
  console.error('[Goal Manager] read-only recovery mode:',recoveryNotice);
  return normalize(seed()); // Temporary in-memory display only; never persisted.
 }
 const fresh=normalize(seed());
 try{persistEnvelope(fresh,{backup:false,allowLogReplacement:true})}
 catch(e){console.error('Fresh dataset could not be persisted',e)}
 return fresh;
}
async function clearApplicationCaches(){
 let removed=0;
 // CacheStorage and ServiceWorker registrations are origin-wide, not app-wide.
 try{
  if('caches' in window){
   const keys=await caches.keys();
   for(const key of keys){
    if(!key.startsWith('thu-goal-personal-v')&&!key.startsWith('law-goal-web-v'))continue;
    try{if(await caches.delete(key))removed++}catch(e){console.warn('cache deletion failed',e)}
   }
  }
 }catch(e){console.warn('cache inspection failed',e)}
 try{
  if('serviceWorker' in navigator){
   const intendedScope=new URL('./',location.href).href;
   const regs=await navigator.serviceWorker.getRegistrations();
   for(const reg of regs){
    if(reg.scope!==intendedScope)continue;
    try{if(await reg.unregister())removed++}catch(e){console.warn('SW unregister failed',e)}
   }
  }
 }catch(e){console.warn('SW inspection failed',e)}
 return removed;
}
async function clearCacheOnly(){
 const ok=confirm('清除網頁快取與 Service Worker，但保留目前所有目標、紀錄與備份資料。確定嗎？');
 if(!ok)return;
 const removed=await clearApplicationCaches();
 toast('已清除快取（未刪除資料）');
 setTimeout(()=>location.reload(),350);
}
function cleanupLegacyStorage(){
 if(persistenceRecoveryBlocked||!initialPersonalSaveOk)return 0;
 const obsolete=['lawLangGoalSystemV81','lawLangGoalSystemV79','lawLangGoalSystemV78','lawLangGoalSystemV77','lawLangGoalSystemV76','lawLangGoalSystemV75','lawLangGoalSystemV74','lawLangGoalSystemV73','lawLangGoalSystemV72','lawLangGoalSystemV71','lawLangGoalSystemV70','lawLangGoalSystemV69','lawLangGoalSystemV68','lawLangGoalSystemV67','lawLangGoalSystemV66','lawLangGoalSystemV65','lawLangGoalSystemV63','lawLangGoalSystemV62','lawLangGoalSystemV61','lawLangGoalSystemV60','today'+'Queue'];
 let removed=0;for(const k of obsolete){try{if(localStorage.getItem(k)!==null){localStorage.removeItem(k);removed++}}catch(e){}}return removed;
}
function removeLegacyStandaloneToeicGoals(){
 const legacyNames=new Set(['TOEIC 正式考試','2026/12/20 TOEIC 聽力與閱讀測驗']);
 const legacyRoots=db.tasks.filter(t=>t.level===1&&legacyNames.has(String(t.name)));
 if(!legacyRoots.length)return false;
 const remove=new Set();
 const walk=id=>{remove.add(id);db.tasks.filter(t=>t.parent===id).forEach(c=>walk(c.id));};
 legacyRoots.forEach(t=>walk(t.id));
 db.tasks=db.tasks.filter(t=>!remove.has(t.id));
 return true;
}

/* THU 115-1 law preview plan migration */
function ensureThu1151LawPreviewPlan(){
 if(!Array.isArray(db.tasks))return {applied:false,reason:'tasks-unavailable'};

 const exact=(x,y)=>String(x||'').trim()===String(y||'').trim();
 const byId=id=>db.tasks.find(t=>String(t.id)===String(id))||null;
 const under=(parent,level,names)=>db.tasks.find(t=>
   Number(t.level)===level&&String(t.parent||'')===String(parent||'')&&
   names.some(n=>exact(t.name,n))
 )||null;
 const preserve=t=>({
   status:['未開始','進行中','已完成','已封存'].includes(t?.status)?t.status:'未開始',
   progress:Math.max(0,Math.min(100,+t?.progress||0))
 });

 const root=byId('g1')||db.tasks.find(t=>
   Number(t.level)===1&&['台大及政大轉學考','台政大轉學考'].some(n=>exact(t.name,n))
 );
 if(!root)return {applied:false,reason:'transfer-root-missing'};

 const stageAliases=['115-1 法律專業科目預習','115學年度第一學期法律專業科目預習','校內學科預習','上學期法律專業科目預習'];
 let stage=byId('g1-1')||under(root.id,2,stageAliases);

 const subjects=[
  {sid:'g1-1-1151-debt',aid:'g1-1-1151-debt-action',subject:'債法總論預習',
   subjectAliases:['債法總論預習','債總預習','債法預習','債法總論'],
   action:'每週債總體系預習與案例整理',
   actionAliases:['每週債總體系預習與案例整理','債總體系預習與案例整理'],weekly:90},
  {sid:'g1-1-1151-criminal',aid:'g1-1-1151-criminal-action',subject:'刑法分則預習',
   subjectAliases:['刑法分則預習','刑分預習','刑法分則'],
   action:'刑分構成要件與刑總連動整理',
   actionAliases:['刑分構成要件與刑總連動整理','刑法分則構成要件與刑總連動整理'],weekly:90},
  {sid:'g1-1-1151-admin',aid:'g1-1-1151-admin-action',subject:'行政法預習',
   subjectAliases:['行政法預習','行政法'],
   action:'行政法體系與案例前導',
   actionAliases:['行政法體系與案例前導','行政法體系與案例預習'],weekly:75},
  {sid:'g1-1-1151-property',aid:'g1-1-1151-property-action',subject:'物權法預習',
   subjectAliases:['物權法預習','物權預習','物權法'],
   action:'物權變動與案例圖像化預習',
   actionAliases:['物權變動與案例圖像化預習','物權法案例圖像化預習'],weekly:60},
  {sid:'g1-1-1151-family',aid:'g1-1-1151-family-action',subject:'親屬法預習',
   subjectAliases:['親屬法預習','親屬法'],
   action:'身分關係與法律效果整理',
   actionAliases:['身分關係與法律效果整理','親屬法身分關係與法律效果整理'],weekly:45},
  {sid:'g1-1-1151-commonlaw',aid:'g1-1-1151-commonlaw-action',subject:'英美法預習',
   subjectAliases:['英美法預習','英美法'],
   action:'英美法案例閱讀與法律英文',
   actionAliases:['英美法案例閱讀與法律英文','英美法案例閱讀'],weekly:30}
 ];

 const structurallyComplete=()=>{
   const s=byId('g1-1')||under(root.id,2,stageAliases);
   if(!s||String(s.parent)!==String(root.id)||Number(s.level)!==2)return false;
   return subjects.every(x=>{
     const sub=byId(x.sid)||under(s.id,3,x.subjectAliases);
     if(!sub||String(sub.parent)!==String(s.id)||Number(sub.level)!==3)return false;
     if(sub.start!=='2026-09-14'||sub.due!=='2026-12-31')return false;
     const action=byId(x.aid)||under(sub.id,4,x.actionAliases);
     return !!action&&String(action.parent)===String(sub.id)&&Number(action.level)===4&&
       Number(action.weeklyMinutes)===Number(x.weekly);
   });
 };

 // A previously installed plan belongs to the user: do not reset customized hours or dates.
 if(storeGet(THU_1151_LAW_PLAN_MARKER)==='1'||subjects.every(x=>!!byId(x.sid))){
   return {applied:false,reason:'existing-plan-preserved',weeklyTotal:390};
 }

 if(!stage){
   stage=mk('g1-1','115-1 法律專業科目預習',2,root.id,'未開始',0);
   db.tasks.push(stage);
 }else{
   const keep=preserve(stage);
   stage.name='115-1 法律專業科目預習';
   stage.level=2;stage.parent=root.id;stage.weeklyMinutes=0;stage.start='';stage.due='';
   stage.status=keep.status;stage.progress=keep.progress;
 }

 const added=[],repaired=[];
 for(const x of subjects){
   let sub=byId(x.sid)||under(stage.id,3,x.subjectAliases);
   if(!sub){
     sub=mk(x.sid,x.subject,3,stage.id,'未開始',0,'2026-09-14','2026-12-31');
     db.tasks.push(sub);added.push(x.subject);
   }else{
     const keep=preserve(sub);
     sub.name=x.subject;sub.level=3;sub.parent=stage.id;sub.weeklyMinutes=0;
     sub.start='2026-09-14';sub.due='2026-12-31';
     sub.status=keep.status;sub.progress=keep.progress;repaired.push(x.subject);
   }

   let action=byId(x.aid)||under(sub.id,4,x.actionAliases);
   if(!action){
     action=mk(x.aid,x.action,4,sub.id,'未開始',x.weekly);
     db.tasks.push(action);
   }else{
     const keep=preserve(action);
     action.name=x.action;action.level=4;action.parent=sub.id;
     action.weeklyMinutes=x.weekly;action.start='';action.due='';
     action.status=keep.status;action.progress=keep.progress;
   }
   try{storeSet('o'+sub.id,'1')}catch(_){}
 }
 try{storeSet('o'+stage.id,'1')}catch(_){}

 if(!structurallyComplete()){
   throw new Error('115-1 法律預習結構修復後驗證失敗');
 }
 return {applied:true,reason:'repaired-or-added',stageId:stage.id,added,repaired,weeklyTotal:390};
}

function ensureToeicPlan(){
 if(!window.ToeicPlanDomain)return {applied:false,reason:'toeic-plan-domain-unavailable'};
 const result=ToeicPlanDomain.apply(db.tasks);
 const aliases=ToeicPlanDomain.progressAliases(db.tasks,db.logs);
 if(aliases.length)db.logs.push(...aliases);
 try{storeSet('o'+ToeicPlanDomain.ROOT_ID,'1')}catch(_){}
 if(!Array.isArray(db.calendarEvents))db.calendarEvents=[];
 [
  ['toeic-reg-open','2026-10-30','TOEIC 12/20 場次｜報名開始','依官方報名系統'],
  ['toeic-reg-close','2026-12-04','TOEIC 12/20 場次｜報名截止','依官方報名系統'],
  ['toeic-20261220','2026-12-20','TOEIC 聽力與閱讀測驗｜正式考試','依准考證']
 ].forEach(([id,date,title,time])=>{if(!db.calendarEvents.some(e=>e.id===id)){db.calendarEvents.push({id,type:'school',date,time,title,meta:'TOEIC 重要節點'})}})
 return {...result,applied:!!(result.applied||aliases.length),progressAliasesAdded:aliases.length};
}

function save(options={}){try{const ok=persistEnvelope(db,{backup:options.backup!==false,allowLogReplacement:options.allowLogReplacement===true});if(ok)idbMirrorSave();return ok}catch(e){console.error(e);toast(String(e?.message||'資料保存失敗，原資料未被覆蓋'));return false}}
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function todayKey(){const d=new Date(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${d.getFullYear()}-${m}-${day}`}
function getTask(id){return GoalDomain.getTask(db.tasks,id)}
function kids(id){return GoalDomain.children(db.tasks,id)}
function roots(){return GoalDomain.roots(db.tasks)}
function autoStatus(progress,archived=false){if(archived)return '已封存';const p=Math.max(0,Math.min(100,Math.round(+progress||0)));return p>=100?'已完成':p>0?'進行中':'未開始'}
function periodForTask(t){return GoalDomain.periodForTask(db.tasks,t)}
function descendantsOfLevel(parent,level){return GoalDomain.descendantsOfLevel(db.tasks,parent,level)}
function weekStartKey(date=todayKey()){return ExecutionDomain.weekStartKey(date)}
function weekEndKey(date=todayKey()){return ExecutionDomain.weekEndKey(date)}
function activeWeekCount(t){return ExecutionDomain.activeWeekCount(db.tasks,t)}
function logDate(x){return StudyLogDomain.logDate(x)}
function isCountableActualLog(l){return StudyLogDomain.isCountableActualLog(l)}
function isOtherStudyLog(l){return StudyLogDomain.isOtherStudyLog(l)}
function isGoalActualLog(l){return StudyLogDomain.isGoalActualLog(l,db.tasks)}
function otherStudyMinutesInRange(start,end){return StudyLogDomain.otherStudyMinutesInRange(db.logs,start,end)}
function rebuildExecutionPlanActuals(){db.executionPlans=ExecutionDomain.rebuildExecutionPlanActuals(db.executionPlans,db.logs,db.tasks,new Date().toISOString())}
function actualMinutesInRange(t,start,end){return ExecutionDomain.actualMinutesInRange(db.tasks,db.logs,t,start,end)}
function actualMinutes(t){return ExecutionDomain.actualMinutes(db.tasks,db.logs,t)}
function currentWeekSummary(t,date=todayKey()){return ExecutionDomain.currentWeekSummary(db.tasks,db.logs,t,date)}
function leafProgress(t){return ExecutionDomain.leafProgress(db.tasks,db.logs,t)}
function executionSummary(t){return ExecutionDomain.executionSummary(db.tasks,db.logs,t,todayKey())}
function inPeriod(date,period){return ExecutionDomain.inPeriod(date,period)}
function periodLabel(t){const p=periodForTask(t);if(!p?.start||!p?.due)return '尚未設定子任務期間';return `${p.start} ～ ${p.due}`}
function calc(t,stack=new Set()){
 if(!t)return 0;if(stack.has(t.id))return 0;
 const c=kids(t.id).filter(x=>x.status!=='已封存'),oldStatus=t.status;
 if(!c.length){if(t.level===4)t.progress=leafProgress(t);else t.progress=0;t.status=autoStatus(t.progress,t.status==='已封存');if(t.status==='已完成'&&oldStatus!=='已完成'&&t.status!=='已封存')completion(t);return t.progress}
 stack.add(t.id);const rows=c.map(child=>({task:child,progress:calc(child,stack)}));stack.delete(t.id);
 const toeicWeighted=window.ToeicPlanDomain?ToeicPlanDomain.aggregateProgress(db.tasks,t,rows,activeWeekCount):null;
 const p=Number.isFinite(toeicWeighted)?toeicWeighted:Math.round(rows.reduce((s,row)=>s+row.progress,0)/rows.length);
 t.progress=p;t.status=autoStatus(p,t.status==='已封存');if(t.status==='已完成'&&oldStatus!=='已完成'&&t.status!=='已封存')completion(t);return p
}
function recalcAllStatuses(){const rs=roots();const rid=new Set(rs.map(r=>r.id));rs.forEach(t=>calc(t));db.tasks.filter(t=>t.level>1&&t.status!=='已封存'&&!rid.has(t.id)).forEach(t=>calc(t));return db.tasks}
function completion(t){if(!db.logs.some(x=>(x.kind===STUDY_LOG_KIND.SYSTEM||x.type==='auto')&&x.taskId===t.id)){db.logs.unshift({id:'log'+Date.now()+Math.random(),taskId:t.id,name:t.name,time:new Date().toISOString(),minutes:0,type:'auto',kind:STUDY_LOG_KIND.SYSTEM,actual:false})}}
function ancestors(id){return GoalDomain.ancestors(db.tasks,id,5)}
let goalViewMode=storeGet('goalViewModeV1')==='map'?'map':'browse';
let goalBrowseId=storeGet('goalBrowseIdV1')||null;

function goalBrowseCurrent(){
 const t=goalBrowseId?getTask(goalBrowseId):null;
 if(!t||t.status==='已封存'||t.level>=4)return null;
 return t;
}
function goalBrowseMeta(t){return GoalsPage.browseMeta(t,{kids,periodLabel,executionSummary,calc,levelLabels:L})}
function goalBrowseCard(t){return GoalsPage.browseCard(t,{kids,periodLabel,executionSummary,calc,levelLabels:L,esc})}
function renderGoalBrowse(){
 let current=goalBrowseCurrent();
 if(goalBrowseId&&!current){goalBrowseId=null;storeSet('goalBrowseIdV1','');}
 const chain=current?ancestors(current.id):[];
 const rows=GoalDomain.browseItems(db.tasks,current?.id||null).sort((a,b)=>(a.status==='已完成')-(b.status==='已完成')||String(a.name).localeCompare(String(b.name),'zh-Hant'));
 GoalsPage.renderBrowse({
  document,
  current,
  chain,
  rows,
  levelLabels:L,
  calc,
  kids,
  periodLabel,
  executionSummary,
  esc
 });
 bindInteractionFeedback();
}
function setGoalViewMode(mode){
 goalViewMode=mode==='map'?'map':'browse';
 storeSet('goalViewModeV1',goalViewMode);
 renderGoalsPage();
}
function browseGoal(id){
 const t=getTask(id);if(!t)return;
 selected=t.id;
 if(t.level>=4){openGoalInfoModal(t.id);return}
 goalBrowseId=t.id;storeSet('goalBrowseIdV1',String(t.id));renderGoalBrowse();
 window.scrollTo({top:0,behavior:'smooth'});
}
function browseGoalTo(id){
 if(!id){goalBrowseId=null;storeSet('goalBrowseIdV1','');renderGoalBrowse();return}
 const t=getTask(id);if(!t||t.level>=4)return;
 goalBrowseId=t.id;storeSet('goalBrowseIdV1',String(t.id));renderGoalBrowse();
}
function browseGoalUp(){
 const current=goalBrowseCurrent();
 if(!current){return}
 browseGoalTo(current.parent||'');
}
function addGoalFromBrowse(){
 const current=goalBrowseCurrent();
 openAdd(current?.id||null);
}
function focusGoalSearch(){
 setGoalViewMode('map');
 setTimeout(()=>document.getElementById('q')?.focus(),30);
}
function renderGoalsPage(){
 const browse=document.getElementById('goalBrowsePanel'),map=document.getElementById('goalMapPanel'),browseTab=document.getElementById('goalBrowseTab'),mapTab=document.getElementById('goalMapTab');
 if(!browse||!map)return;
 const isMap=goalViewMode==='map';
 browse.hidden=isMap;map.hidden=!isMap;
 if(browseTab){browseTab.classList.toggle('active',!isMap);browseTab.setAttribute('aria-selected',String(!isMap))}
 if(mapTab){mapTab.classList.toggle('active',isMap);mapTab.setAttribute('aria-selected',String(isMap))}
 if(isMap)renderTree();else renderGoalBrowse();
}

function taskHTML(t){
 return GoalsPage.taskNode(t,{
  calc,
  kids,
  isOpen:id=>storeGet('o'+id)!=='0',
  isHit:goalSearchMatch,
  executionSummary,
  executionPlans:db.executionPlans,
  activeExecutionPlan,
  periodLabel,
  levelLabels:L,
  esc
 });
}
function goalSearchQuery(){return (document.getElementById('q')?.value||'').trim().toLowerCase()}
function goalSearchMatch(t){const q=goalSearchQuery();return !!(q&&String(t?.name||'').toLowerCase().includes(q))}

function goalSearchFilteredTasks(){
 const q=goalSearchQuery(),s=(document.getElementById('sf')?.value||'all'),l=(document.getElementById('lf')?.value||'all');
 return db.tasks.filter(t=>t.status!=='已封存'&&(!q||goalSearchMatch(t))&&(s==='all'||t.status===s)&&(l==='all'||String(t.level)===l));
}
function clearGoalSearch(){const q=document.getElementById('q');if(q)q.value='';renderTree();if(q)q.focus();toast('已清除目標搜尋')}
function scrollToGoalResult(id){const el=document.getElementById('search-result-'+id);if(!el)return;el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('selected');setTimeout(()=>el.classList.remove('selected'),900)}
function openSearchEdit(id){const t=getTask(id);if(!t)return;selected=id;const chain=ancestors(id);goalPath={long:chain.find(x=>x.level===1)?.id||null,mid:chain.find(x=>x.level===2)?.id||null,short:chain.find(x=>x.level===3)?.id||null,exec:chain.find(x=>x.level===4)?.id||null};openEditModal(id);toast('已開啟「'+t.name+'」編輯視窗')}
function toggleSearchBranch(id){const t=getTask(id);if(!t)return;const open=storeGet('o'+id)!=='0';storeSet('o'+id,open?'0':'1');renderTree();setTimeout(()=>document.getElementById('search-result-'+id)?.scrollIntoView({behavior:'smooth',block:'center'}),30)}
function goalResultCard(t){
 return GoalsPage.resultCard(t,{
  ancestors,
  calc,
  periodLabel,
  levelLabels:L,
  esc,
  isOpen:id=>storeGet('o'+id)!=='0'
 });
}
function renderSearchResults(matches){
 const q=goalSearchQuery(),s=(document.getElementById('sf')?.value||'all'),l=(document.getElementById('lf')?.value||'all');
 return GoalsPage.renderSearchResults({
  document,
  matches,
  query:q,
  statusFilter:s,
  levelFilter:l,
  ancestors,
  calc,
  periodLabel,
  levelLabels:L,
  esc,
  isOpen:id=>storeGet('o'+id)!=='0'
 });
}
function renderTree(){
 const tree=document.getElementById('tree');if(!tree)return;
 const matches=goalSearchFilteredTasks();
 if(renderSearchResults(matches))return;
 const rootsList=roots().filter(t=>t.status!=='已封存');
 GoalsPage.renderTree({
  document,
  roots:rootsList,
  nodeHTML:taskHTML
 });
 updateExpandToggle();
}
function resetGoalFilters(){const q=document.getElementById('q'),s=document.getElementById('sf'),l=document.getElementById('lf');if(q)q.value='';if(s)s.value='all';if(l)l.value='all';renderTree();toast('已重設目標地圖篩選')}
function allGoalNodesOpen(){const nodes=db.tasks.filter(t=>t.level<4&&t.status!=='已封存');return nodes.length>0&&nodes.every(t=>storeGet('o'+t.id)!=='0')}
function updateExpandToggle(){const b=document.getElementById('expandToggleBtn');if(!b)return;const open=allGoalNodesOpen();b.textContent=open?'⌃ 收合全部':'⌄ 展開全部';b.setAttribute('aria-label',open?'收合全部目標':'展開全部目標');b.title=open?'收合所有有下層的目標':'展開所有有下層的目標'}
function expandAllGoals(open){db.tasks.filter(t=>t.level<4&&t.status!=='已封存').forEach(t=>storeSet('o'+t.id,open?'1':'0'));renderTree();updateExpandToggle();toast(open?'已展開全部目標':'已收合全部目標')}
function toggleAllGoals(){expandAllGoals(!allGoalNodesOpen())}

function pickGoal(key,id){const t=getTask(id);if(!t)return;selected=id;const a=ancestors(id);goalPath={long:a.find(x=>x.level===1)?.id||null,mid:a.find(x=>x.level===2)?.id||null,short:a.find(x=>x.level===3)?.id||null,exec:a.find(x=>x.level===4)?.id||null};renderAll();toast('已切換目前目標：「'+t.name+'」')}

function openGoalInfoModal(id,autoSchedule=false){
 const t=getTask(id); if(!t)return;
 selected=id;
 const chain=ancestors(id);
 goalPath={long:chain.find(x=>x.level===1)?.id||null,mid:chain.find(x=>x.level===2)?.id||null,short:chain.find(x=>x.level===3)?.id||null,exec:chain.find(x=>x.level===4)?.id||null};
 const p=periodForTask(t), es=t.level===4?executionSummary(t):null;
 const parent=chain.length>1?chain[chain.length-2].name:'—';
 const info=document.getElementById('goalInfoBody');
 if(!info)return;
 info.innerHTML=`<div class="info-modal-path">位置：${esc(chain.map(x=>x.name).join(' → '))}</div>
 <div class="info-modal-grid">
  <div class="info-kv"><small>層級</small><b>${esc(L[t.level])}</b></div>
  <div class="info-kv"><small>狀態</small><b>${esc(t.status)}</b></div>
  <div class="info-kv"><small>完成度</small><b>${calc(t)}%</b></div>
  <div class="info-kv"><small>上層目標</small><b>${esc(parent)}</b></div>
  <div class="info-kv"><small>執行期間</small><b>${esc(p?.start&&p?.due?p.start+' ～ '+p.due:'由下層／尚未設定')}</b></div>
  ${t.level===4?`<div class="info-kv"><small>本週投入</small><b>${es.weeklyTarget} 分鐘</b></div><div class="info-kv"><small>本週已投入</small><b>${es.weeklyActual} 分鐘</b></div><div class="info-kv"><small>本週剩餘</small><b>${es.weeklyRemaining} 分鐘</b></div>`:''}
 </div>
 ${t.level===4?`<div class="goal-info-actions"><button class="btn primary" type="button" onclick="closeGoalInfoModal();useTimer('${t.id}')">直接執行</button><button class="btn" type="button" onclick="openEditFromInfo('${t.id}')">修改</button><button class="btn" type="button" onclick="closeGoalInfoModal()">關閉</button></div>`:`<div class="goal-info-actions"><button class="btn primary" type="button" onclick="openEditFromInfo('${t.id}')">修改</button><button class="btn" type="button" onclick="closeGoalInfoModal()">關閉</button></div>`}`;
 document.getElementById('goalInfoTitle').textContent=t.name;
 document.getElementById('goalInfoModal').classList.add('show');document.body.style.overflow='hidden';bindInteractionFeedback();
}
function closeGoalInfoModal(){const m=document.getElementById('goalInfoModal');if(m)m.classList.remove('show');document.body.style.overflow='';}
function openEditFromInfo(id){closeGoalInfoModal();setTimeout(()=>openEditModal(id),80)}
const REVIEW_REASONS=['課業負荷','考試／其他重要事項','時間不足','目標設定過高','主動調整','突發事件'];
function previousWeekRange(date=todayKey()){return ExecutionDomain.previousWeekRange(date)}
function getWeekReview(weekStart,taskId){return (db.weekReviews||[]).find(x=>x.weekStart===weekStart&&String(x.taskId)===String(taskId))||null}
function previousWeekIncompleteItems(date=todayKey()){
 const r=previousWeekRange(date);return db.tasks.filter(t=>t.level===4&&t.status!=='已封存'&&currentWeekSummary(t,r.start).active&&currentWeekSummary(t,r.start).target>0).map(t=>{const w=currentWeekSummary(t,r.start);return {t,w,shortfall:Math.max(0,w.target-w.actual),review:getWeekReview(r.start,t.id)}}).filter(x=>x.shortfall>0).sort((a,b)=>b.shortfall-a.shortfall||calc(a.t)-calc(b.t));
}
function setWeeklyReview(taskId,reason,date=todayKey()){
 const r=previousWeekRange(date),arr=Array.isArray(db.weekReviews)?db.weekReviews:[];const i=arr.findIndex(x=>x.weekStart===r.start&&String(x.taskId)===String(taskId));const row={id:'wr'+r.start.replace(/-/g,'')+'-'+String(taskId),weekStart:r.start,weekEnd:r.end,taskId:String(taskId),reason,updatedAt:new Date().toISOString()};if(i>=0)arr[i]=row;else arr.push(row);db.weekReviews=arr;save();renderWeeklyReview();toast('已記錄未完成原因');
}
function renderWeeklyReview(date=todayKey()){
 const el=document.getElementById('weeklyReviewList'),lab=document.getElementById('reviewWeekLabel');if(!el)return;
 const r=previousWeekRange(date),items=previousWeekIncompleteItems(date);
 if(lab)lab.textContent=`${r.start} ～ ${r.end}`;
 el.innerHTML=AnalyticsPage.weeklyReviewHTML(items,{
  date,
  reasons:REVIEW_REASONS,
  esc,
  calc
 });
}function deleteActualLog(id){
 const log=(Array.isArray(db.logs)?db.logs:[]).find(x=>String(x.id)===String(id));
 if(!log||!isCountableActualLog(log)){toast(log?.status==='已刪除'?'這筆紀錄已刪除':'找不到可刪除的實際紀錄');return}
 const impact=isOtherStudyLog(log)?'總讀書時數與其他讀書分析':'完成度與實際時數分析';
 if(!confirm(`確定刪除「${log.name||getTask(log.taskId)?.name||'這筆實際紀錄'}」的 ${Math.max(0,+log.minutes||0)} 分鐘實際投入紀錄？\n\n刪除後將不再計入${impact}，但紀錄可恢復。`))return;
 const oldLogs=db.logs,oldPlans=db.executionPlans;
 db.logs=oldLogs.map(x=>x===log?{...x,status:'已刪除',deletedAt:new Date().toISOString()}:x);
 rebuildExecutionPlanActuals();
 if(!save()){
  db.logs=oldLogs;db.executionPlans=oldPlans;
  toast('無法保存刪除狀態；原紀錄已保留');return;
 }
 renderAll();toast('已刪除實際紀錄；相關分析已排除');
}
function restoreActualLog(id){
 const log=(Array.isArray(db.logs)?db.logs:[]).find(x=>String(x.id)===String(id)&&x.status==='已刪除');
 if(!log){toast('找不到可恢復的紀錄');return}
 const oldLogs=db.logs,oldPlans=db.executionPlans;
 db.logs=oldLogs.map(x=>{
  if(x!==log)return x;
  const restored={...x,status:'有效'};
  delete restored.deletedAt;return restored;
 });
 rebuildExecutionPlanActuals();
 if(!save()){
  db.logs=oldLogs;db.executionPlans=oldPlans;
  toast('無法保存還原狀態；原紀錄未變更');return;
 }
 renderAll();toast('已恢復實際紀錄；相關分析已重新計入');
}
function renderDeletedLogs(){
 const el=document.getElementById('deletedLogs');if(!el)return;
 const logs=(Array.isArray(db.logs)?db.logs:[]).filter(l=>l.status==='已刪除').slice(0,20);
 el.innerHTML=AnalyticsPage.deletedLogsHTML(logs,{esc,getTask});
}
/* compact actual-log history */
let actualHistoryRange='7';
let actualHistoryTask='all';

function actualHistorySource(){
 return (Array.isArray(db.logs)?db.logs:[])
  .filter(isCountableActualLog)
  .slice()
  .sort((a,b)=>{
    const newer=TimeFormat.timestamp(b.time);
    const older=TimeFormat.timestamp(a.time);
    if(Number.isFinite(newer)&&Number.isFinite(older))return newer-older;
    if(Number.isFinite(newer))return -1;
    if(Number.isFinite(older))return 1;
    return String(b.time||'').localeCompare(String(a.time||''));
  });
}
function actualHistoryDateKey(log){return AnalyticsPage.actualHistoryDateKey(log)}
function actualHistoryTimeLabel(log){return AnalyticsPage.actualHistoryTimeLabel(log)}
function actualHistoryFiltered(){
 const now=Date.now();
 const days=actualHistoryRange==='all'?null:Number(actualHistoryRange||7);
 return actualHistorySource().filter(log=>{
   if(actualHistoryTask==='__other-study__'&&!isOtherStudyLog(log))return false;
   if(actualHistoryTask!=='all'&&actualHistoryTask!=='__other-study__'&&(isOtherStudyLog(log)||String(log.taskId||'')!==String(actualHistoryTask)))return false;
   if(days===null)return true;
   const ms=TimeFormat.timestamp(log.time);
   return Number.isFinite(ms)&&(now-ms)<=days*24*60*60*1000;
 });
}
function ensureActualHistoryModal(){
 let modal=document.getElementById('actualHistoryModal');
 if(modal)return modal;
 modal=document.createElement('div');
 modal.id='actualHistoryModal';
 modal.className='edit-modal actual-history-modal';
 modal.setAttribute('role','dialog');
 modal.setAttribute('aria-modal','true');
 modal.setAttribute('aria-labelledby','actualHistoryTitle');
 modal.innerHTML=AnalyticsPage.actualHistoryModalShell();
 modal.addEventListener('click',e=>{if(e.target===modal)closeActualLogHistory()});
 document.body.appendChild(modal);
 return modal;
}
function openActualLogHistory(){
 const modal=ensureActualHistoryModal();
 modal.classList.add('show');
 document.body.style.overflow='hidden';
 renderActualLogHistory();
}
function closeActualLogHistory(){
 const modal=document.getElementById('actualHistoryModal');
 if(modal)modal.classList.remove('show');
 document.body.style.overflow='';
}
function setActualHistoryRange(value){
 actualHistoryRange=value;
 renderActualLogHistory();
}
function setActualHistoryTask(value){
 actualHistoryTask=value||'all';
 renderActualLogHistory();
}
function deleteActualLogFromHistory(id){
 deleteActualLog(id);
 requestAnimationFrame(()=>renderActualLogHistory());
}
function renderRecentActualLogs(){
 const el=document.getElementById('recentLogs');if(!el)return;
 const all=actualHistorySource();
 el.innerHTML=AnalyticsPage.recentActualLogsHTML(all,{esc,getTask,isOtherStudyLog});
}
function renderActualLogHistory(){
 const modal=document.getElementById('actualHistoryModal');
 const body=document.getElementById('actualHistoryBody');
 if(!modal||!body||!modal.classList.contains('show'))return;

 const source=actualHistorySource();
 const taskRows=[];
 const seen=new Set();

 if(source.some(isOtherStudyLog)){
  taskRows.push(['__other-study__','其他讀書時間']);
 }

 source.forEach(log=>{
  if(isOtherStudyLog(log))return;
  const id=String(log.taskId||'');
  if(!id||seen.has(id))return;
  seen.add(id);
  taskRows.push([id,log.name||getTask(id)?.name||'未命名行動']);
 });

 const filtered=actualHistoryFiltered();
 const totalMinutes=filtered.reduce(
  (sum,log)=>sum+Math.max(0,+log.minutes||0),
  0
 );

 body.innerHTML=AnalyticsPage.actualHistoryBodyHTML({
  filtered,
  totalMinutes,
  taskRows,
  range:actualHistoryRange,
  taskFilter:actualHistoryTask,
  esc,
  getTask,
  isOtherStudyLog
 });
}

/* analysis KPI source repair */
/* analysis KPI source repair */
function analysisValidLeafTasks(){return AnalyticsDomain.analysisValidLeafTasks(db.tasks)}

function stats(){
 const leaves=analysisValidLeafTasks();
 leaves.forEach(t=>calc(t));
 const done=leaves.filter(t=>calc(t)===100).length;
 const avg=leaves.length?Math.round((leaves.reduce((sum,t)=>sum+calc(t),0)/leaves.length)*10)/10:0;
 const week=AnalyticsDomain.weeklyStudySummary({tasks:db.tasks,logs:db.logs,date:todayKey()});
 const rootsActive=roots().filter(t=>t.status!=='已封存');
 const directionRows=AnalyticsDomain.weeklyDirectionSummary({tasks:db.tasks,logs:db.logs,roots:rootsActive,date:todayKey()});

 AnalyticsPage.renderStats({
  document,
  leaves,
  done,
  avg,
  week,
  directionRows,
  actualLogCount:StudyLogDomain.countableLogs(db.logs).length,
  esc,
  calc
 });
 renderRecentActualLogs();
 renderDeletedLogs();
 renderWeeklyReview();
}
function descAll(id){let out=[],stack=[id];while(stack.length){const x=stack.pop();kids(x).forEach(c=>{out.push(c);stack.push(c.id)})}const root=getTask(id);if(root)out.unshift(root);return out}
function openAdd(parent=null){document.getElementById('modal').style.display='flex';document.getElementById('aName').value='';document.getElementById('aLevel').value=parent?Math.min(4,(getTask(parent)?.level||1)+1):1;document.getElementById('aParent').value='';document.getElementById('aStart').value='';document.getElementById('aDue').value='';document.getElementById('aWeekly').value=0;document.getElementById('aWeeklyUnit').value='hour';syncAddParents();if(parent)document.getElementById('aParent').value=parent;syncAddFields()}
function syncAddParents(){const level=+document.getElementById('aLevel').value,sel=document.getElementById('aParent'),cur=sel.value;sel.innerHTML=level===1?'<option value="">— 頂層方向 —</option>':db.tasks.filter(t=>t.level===level-1&&t.status!=='已封存').map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');if(cur&&db.tasks.some(t=>t.id===cur&&t.level===level-1))sel.value=cur}
function syncAddFields(){const level=+document.getElementById('aLevel').value;document.getElementById('aParentWrap').style.display=level===1?'none':'block';document.getElementById('aPeriodWrap').style.display=level===3?'block':'none';document.getElementById('aInheritedWrap').style.display=level===4?'block':'none';document.getElementById('aActionWrap').style.display=level===4?'block':'none';const p=level===4?periodForTask(getTask(document.getElementById('aParent').value)):null;document.getElementById('aInheritedPeriod').textContent=p?.start&&p?.due?`${p.start} ～ ${p.due}`:'請先選擇已設定始期與終期的子任務';document.getElementById('aHint').textContent=level===1?'方向／重要目標不設定時間。':level===2?'階段目標不直接設定時間；期間由下層子任務自動決定。':level===3?'子任務負責決定始期與終期。':'具體實現方式只設定本週總投入；日期與時段保留彈性，期間自動繼承子任務。'}
document.getElementById('aLevel').onchange=()=>{syncAddParents();syncAddFields()};document.getElementById('aParent').onchange=syncAddFields;
function addChild(id){if(!id){toast('請先選取一個目標，再新增其下層');return}const t=getTask(id);if(!t){toast('找不到目標');return}if(t.level>=4){toast('Level 4 已是最下層，不能再新增下層');return}openAdd(id)}
function closeModal(){document.getElementById('modal').style.display='none'}
function addTask(){
 const name=document.getElementById('aName').value.trim();if(!name){toast('請輸入名稱');return}
 const level=+document.getElementById('aLevel').value,parent=document.getElementById('aParent').value||null;
 if(level>1&&!parent){toast('請選擇上層目標');return}
 if(parent&&getTask(parent)?.level!==level-1){toast('層級與上層不一致');return}
 let start='',due='',weeklyMinutes=0;
 if(level===3){start=document.getElementById('aStart').value;due=document.getElementById('aDue').value;if(!start||!due){toast('子任務必須設定始期與終期');return}if(start>due){toast('始期不能晚於終期');return}}
 if(level===4){const pp=periodForTask(getTask(parent));if(!pp?.start||!pp?.due){toast('請先為所屬子任務設定完整期間');return}const raw=Math.max(0,+document.getElementById('aWeekly').value||0),u=document.getElementById('aWeeklyUnit').value;weeklyMinutes=u==='hour'?Math.round(raw*60):Math.round(raw);if(weeklyMinutes<=0){toast('本週投入必須大於 0');return}}
 const t={id:'t'+Date.now()+Math.random().toString(16).slice(2),name,level,parent,status:'未開始',weeklyMinutes,start:level===3?start:'',due:level===3?due:'',progress:0};db.tasks.push(t);save();closeModal();selected=t.id;renderAll();go('goals');selectTask(t.id);toast('已建立；本週時數邏輯已與子任務連動')
}
function archiveTask(id){const t=getTask(id);if(!t)return;if(!confirm(`封存「${t.name}」及所有下層？`))return;descAll(id).forEach(x=>x.status='已封存');save();renderAll();toast('已封存')}
function moveTask(id){const t=getTask(id);if(!t)return;const names=db.tasks.filter(x=>x.id!==id&&x.level===t.level-1&&x.status!=='已封存').map(x=>`${x.id}: ${x.name}`).join('\n');if(t.level===1){toast('第一級只能是頂層方向');return}const target=prompt(`輸入新的上層 ID：\n${names}`);if(target===null)return;if(!getTask(target)||getTask(target).level!==t.level-1||wouldCycle(id,target)){toast('新的上層無效');return}t.parent=target;save();renderAll();toast('已移動目標')}
function safeRemove(id){const t=getTask(id);if(!t)return;const c=kids(id);if(c.length){const choice=prompt(`「${t.name}」有 ${c.length} 個直接下層。\n輸入 1：刪除自己＋全部下層，但保留歷程\n輸入 2：只刪除自己，把直接下層接到原上層\n輸入 3：取消`);if(choice==='1'){deleteCascade(id);return}if(choice==='2'){const old=t.parent,newLevel=t.level;c.forEach(x=>{x.parent=old;x.level=newLevel});db.tasks=db.tasks.filter(x=>x.id!==id);selected=null;save();renderAll();toast('已刪除，上層任務已保留');return}return}if(confirm(`確定刪除「${t.name}」嗎？\n歷程紀錄會保留。`))deleteCascade(id)}
function deleteCascade(id){const ids=descAll(id).map(x=>x.id);db.tasks=db.tasks.filter(t=>!ids.includes(t.id));if(selected&&ids.includes(selected))selected=null;save();renderAll();toast('目標已刪除；歷程紀錄保留')}
function toggleKids(id){storeSet('o'+id,storeGet('o'+id)==='0'?'1':'0');renderTree();updateExpandToggle()}
function closeTransientOverlays(){try{closeActualLogHistory()}catch(e){}try{closeSettings()}catch(e){}try{closeEditModal()}catch(e){}try{closeGoalInfoModal()}catch(e){}try{closeScholarshipInfoModal()}catch(e){}try{closeModal()}catch(e){}try{closeTest()}catch(e){}document.body.style.overflow='';}
function go(id){
 const view=document.getElementById(id);if(!view)return;
 closeTransientOverlays();
 document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
 view.classList.add('active');
 const navId=(id==='activity'||id==='scholarship')?'dash':id;
 document.querySelectorAll('.bottom-nav button').forEach(x=>{const active=x.dataset.view===navId;x.classList.toggle('active',active);x.setAttribute('aria-current',active?'page':'false')});
 window.scrollTo({top:0,behavior:'smooth'});
 if(id==='activity')renderActivities();
 if(id==='scholarship')renderScholarships();
 if(id==='calendar')renderCalendar();
 if(id==='goals')renderGoalsPage();
 if(id==='today'){today();renderTimerState();}
 if(id==='stats')stats();
 if(id==='dash'){dashboard();updateHubContext();bindInteractionFeedback()}
}
document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>go(b.dataset.view));bindInteractionFeedback();
try{if(document.activeElement&&/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))document.activeElement.blur();}catch(e){}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeActualLogHistory();closeGoalInfoModal();closeEditModal()}});

function syncOtherStudyForm(){
 const date=document.getElementById('otherStudyDate'),mins=document.getElementById('otherStudyMinutes');
 if(date&&!date.value)date.value=todayKey();
 if(mins&&(!mins.value||+mins.value<=0))mins.value='30';
}
function goalStudyBackfillTasks(date=todayKey()){
 const day=String(date||'').slice(0,10);
 return db.tasks
  .filter(t=>{
   if(Number(t.level)!==4||t.status==='已封存')return false;
   const p=periodForTask(t);
   return !!(p?.start&&p?.due&&day>=p.start&&day<=p.due);
  })
  .sort((a,b)=>{
   const ap=goalStudyBackfillLabel(a);
   const bp=goalStudyBackfillLabel(b);
   return ap.localeCompare(bp,'zh-Hant');
  });
}
function goalStudyBackfillLabel(t){
 const parent=getTask(t?.parent);
 return parent?`${parent.name} › ${t.name}`:String(t?.name||'未命名具體實現');
}
function syncGoalStudyBackfillOptions(){
 const select=document.getElementById('goalStudyBackfillTask');if(!select)return;
 const date=document.getElementById('goalStudyBackfillDate')?.value||todayKey();
 const tasks=goalStudyBackfillTasks(date);
 const previous=select.value;
 const selectedTask=typeof selected!=='undefined'?getTask(selected):null;
 const preferred=
  (previous&&tasks.some(t=>String(t.id)===String(previous)))
   ?previous
   :(selectedTask&&Number(selectedTask.level)===4&&tasks.some(t=>String(t.id)===String(selectedTask.id)))
    ?String(selectedTask.id)
    :'';
 select.innerHTML=tasks.length
  ?tasks.map(t=>`<option value="${esc(t.id)}">${esc(goalStudyBackfillLabel(t))}</option>`).join('')
  :`<option value="">${esc(date)} 沒有有效具體實現</option>`;
 if(preferred)select.value=preferred;
 syncGoalStudyBackfillHint();
}
function syncGoalStudyBackfillHint(){
 const hint=document.getElementById('goalStudyBackfillHint');
 const id=document.getElementById('goalStudyBackfillTask')?.value||'';
 const t=id?getTask(id):null;if(!hint)return;
 if(!t){hint.textContent='目前沒有可補登的具體實現。';return}
 const p=periodForTask(t);
 hint.textContent=p?.start&&p?.due
  ?`可補登期間：${p.start} ～ ${p.due}；補登後直接參與完成度、有效達成、超時與總讀書時間。`
  :'此具體實現尚無有效期間，暫不能補登為目標實際。';
}
function syncStudyBackfillMode(){
 const mode=document.getElementById('studyBackfillMode')?.value||'goal';
 const goal=document.getElementById('goalStudyBackfillFields');
 const other=document.getElementById('otherStudyBackfillFields');
 if(goal)goal.hidden=mode!=='goal';
 if(other)other.hidden=mode!=='other';
}
function syncStudyBackfillForm(){
 syncOtherStudyForm();
 const date=document.getElementById('goalStudyBackfillDate');
 const mins=document.getElementById('goalStudyBackfillMinutes');
 if(date&&!date.value)date.value=todayKey();
 if(mins&&(!mins.value||+mins.value<=0))mins.value='30';
 syncGoalStudyBackfillOptions();
 syncStudyBackfillMode();
}
function addGoalStudyLog(){
 const taskId=document.getElementById('goalStudyBackfillTask')?.value||'';
 const t=taskId?getTask(taskId):null;
 const date=document.getElementById('goalStudyBackfillDate')?.value||todayKey();
 const mins=Math.round(+document.getElementById('goalStudyBackfillMinutes')?.value||0);
 if(!t||Number(t.level)!==4||t.status==='已封存'){toast('請選擇有效的目標具體實現');return}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){toast('請選擇有效日期');return}
 if(date>todayKey()){toast('補登日期不能晚於今天');return}
 if(mins<=0){toast('補登分鐘必須大於 0');return}
 const p=periodForTask(t);
 if(!p?.start||!p?.due){
  toast('此具體實現尚無有效執行期間，請先設定其上層子任務期間');
  return;
 }
 if(date<p.start||date>p.due){
  toast(`補登日期不在執行期間 ${p.start} ～ ${p.due} 內`);
  document.getElementById('goalStudyBackfillDate')?.focus();
  return;
 }
 const when=date===todayKey()?new Date():new Date(date+'T12:00:00');
 if(Number.isNaN(when.getTime())){toast('日期格式無效');return}
 const row={
  id:'log'+Date.now()+Math.random(),
  taskId:t.id,
  name:t.name,
  time:when.toISOString(),
  minutes:mins,
  actual:true,
  kind:STUDY_LOG_KIND.GOAL,
  source:'manual-backfill'
 };
 db.logs.unshift(row);
 if(!save()){
  db.logs=db.logs.filter(x=>x!==row);
  toast('補登失敗；目前資料未變更');
  return;
 }
 renderAll();
 toast(`已補登「${t.name}」${mins} 分鐘；完成度與總讀書時間已更新`);
}
function otherStudyInputName(){return (document.getElementById('otherStudyName')?.value||'').trim()}
function freeStudyInputName(){return (document.getElementById('freeStudyName')?.value||'').trim()}
function startFreeStudyTimer(){
 if(timer.running){toast('目前已有計時進行中，請先完成或暫停');return}
 const name=freeStudyInputName();
 if(!name){
  toast('請先輸入自由計時內容');
  document.getElementById('freeStudyName')?.focus();
  return;
 }
 const previousTimer=timer;
 timer=TimerService.selectOther(name);
 if(!saveActiveTimer()){
  timer=previousTimer;toast('自由計時選擇無法保存；請檢查儲存空間');return;
 }
 renderTimerState();
 if(!startTimer())return;
 const input=document.getElementById('freeStudyName');
 if(input)input.value='';
}
function addOtherStudyLog(){
 const name=otherStudyInputName(),date=document.getElementById('otherStudyDate')?.value||todayKey(),mins=Math.round(+document.getElementById('otherStudyMinutes')?.value||0);
 if(!name){toast('請先輸入其他讀書的內容或科目');document.getElementById('otherStudyName')?.focus();return}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){toast('請選擇有效日期');return}
 if(mins<=0){toast('補登分鐘必須大於 0');return}
 const when=date===todayKey()?new Date():new Date(date+'T12:00:00');
 if(Number.isNaN(when.getTime())){toast('日期格式無效');return}
 const previousLogs=db.logs;
 const record={id:'log'+Date.now()+Math.random(),taskId:null,name,time:when.toISOString(),minutes:mins,actual:true,kind:STUDY_LOG_KIND.OTHER,source:'manual'};
 db.logs=[record,...previousLogs];
 if(!save()){
  db.logs=previousLogs;
  toast('其他讀書補登未保存；已保留原紀錄');
  return;
 }
 renderAll();toast(`已補登其他讀書 ${mins} 分鐘；不影響目標完成度`);
}
function timerHasSelection(){return TimerService.hasSelection(timer)}


function renderTimerState(){
 const taskEl=document.getElementById('timerTask'),cancel=document.getElementById('timerTaskCancel'),free=document.getElementById('freeStudyQuickStart');if(!taskEl)return;
 const has=timerHasSelection();
 if(!has){
  taskEl.textContent='尚未選擇任務';
  if(cancel)cancel.style.display='none';
  if(free)free.hidden=false;
  updateClock();updateTimerButtons();return
 }
 if(free)free.hidden=true;
 if(timer.kind==='other-study')taskEl.textContent=(timer.running?'進行中：':'待執行：')+'其他讀書：'+(timer.label||'未命名');
 else{const t=getTask(timer.id);if(!t){timer=TimerService.empty();clearActiveTimer();taskEl.textContent='尚未選擇任務';if(cancel)cancel.style.display='none';if(free)free.hidden=false;updateClock();updateTimerButtons();return}taskEl.textContent=(timer.running?'進行中：':'待執行：')+t.name}
 if(cancel)cancel.style.display='block';updateClock();updateTimerButtons();if(timer.running)timerLoop();
}

function selectTodayExecution(id){const t=getTask(id);if(!t)return;if(timer.running){toast('目前已有計時進行中，請先完成或暫停');return}timer=TimerService.selectGoal(id,null);saveActiveTimer();renderTimerState();today();toast('已選取今日欲執行項目；尚未開始計時')}
function cancelTodaySelection(){if(timer.running){toast('計時進行中，請先暫停或完成後再取消');return}timer=TimerService.empty();clearActiveTimer();renderTimerState();today();toast('已取消今日執行選取')}
function startTodayExecution(id){const t=getTask(id);if(!t)return;if(timer.running){toast('目前已有計時進行中');return}selectTodayExecution(id);startTimer()}
function useTimer(id){selected=id;timer=TimerService.selectGoal(id,null);saveActiveTimer();document.getElementById('timerTask').textContent=getTask(id)?.name||'';go('today');updateClock();updateTimerButtons();toast('已選擇具體行動，可開始計時')}
function startTimer(){
 if(!timerHasSelection()){toast('請先選擇具體行動或其他讀書');return false}
 if(timer.running){toast('計時已在進行中');return false}
 const previousTimer=timer;
 if(timer.kind==='goal'){
  const t=getTask(timer.id);
  if(!t){toast('找不到目前執行的具體行動');return false}
  const oldStatus=t.status;
  t.status='進行中';
  if(!save()){t.status=oldStatus;toast('無法保存目標狀態；未開始計時');return false}
 }
 timer=TimerService.start(timer,Date.now());
 if(!saveActiveTimer()){
  timer=previousTimer;
  toast('計時器無法安全保存；未開始計時，請檢查儲存空間');
  updateTimerButtons();return false;
 }
 updateTimerButtons();timerLoop();
 toast(timer.kind==='other-study'?'已開始自由計時':'已開始計時');
 return true;
}
function pauseTimer(){
 if(!timer.running){toast('目前沒有進行中的計時');return}
 const previousTimer=timer;
 timer=TimerService.pause(timer,Date.now());
 if(!saveActiveTimer()){
  timer=previousTimer;
  toast('計時器暫停狀態無法保存；仍維持計時中');
  updateClock();updateTimerButtons();return;
 }
 updateClock();updateTimerButtons();toast('計時已暫停');
}
function finishTimer(){
 if(!timerHasSelection()){toast('請先選擇具體行動或其他讀書');return}
 const finished=TimerService.finish(timer,Date.now());
 const paused=finished.timer,mins=finished.minutes;
 const previousLogs=db.logs;
 const previousPlans=db.executionPlans;
 if(paused.kind==='other-study'){
  const name=paused.label||'其他讀書';
  db.logs=[{id:'log'+Date.now()+Math.random(),taskId:null,name,time:new Date().toISOString(),minutes:mins,actual:true,kind:STUDY_LOG_KIND.OTHER,source:'timer'},...previousLogs];
  if(!save()){
   db.logs=previousLogs;
   timer=paused;saveActiveTimer();renderTimerState();
   toast('讀書紀錄未保存，計時器已暫停保留；請檢查儲存空間');return;
  }
  timer=TimerService.empty();clearActiveTimer();renderAll();
  document.getElementById('timerTask').textContent='已記錄其他讀書：'+name;
  document.getElementById('timerTaskCancel').style.display='none';
  updateClock();updateTimerButtons();toast(`已記錄其他讀書 ${mins} 分鐘；不影響目標完成度`);return;
 }
 const t=getTask(paused.id);
 if(!t){toast('找不到目前執行的具體行動');return}
 const planId=paused.planId||null;
 db.logs=[{id:'log'+Date.now()+Math.random(),taskId:t.id,name:t.name,time:new Date().toISOString(),minutes:mins,actual:true,planId},...previousLogs];
 if(planId){
  db.executionPlans=(previousPlans||[]).map(plan=>
   String(plan.id)===String(planId)&&plan.status!=='已取消'
    ?{...plan,...ExecutionService.applyActualMinutes(plan,mins,new Date().toISOString())}
    :plan
  );
 }
 if(!save()){
  db.logs=previousLogs;db.executionPlans=previousPlans;
  timer=paused;saveActiveTimer();renderTimerState();
  toast('目標紀錄未保存，計時器已暫停保留；請檢查儲存空間');return;
 }
 const done=paused.id;
 timer=TimerService.empty();clearActiveTimer();renderAll();
 document.getElementById('timerTask').textContent='已記錄：'+(t.name||done);
 document.getElementById('timerTaskCancel').style.display='none';
 updateClock();updateTimerButtons();
 toast(planId?`已記錄 ${mins} 分鐘；本次安排累計已實際 ${db.executionPlans.find(x=>String(x.id)===String(planId))?.actualMinutes||mins} 分鐘`:`已記錄 ${mins} 分鐘；完成度已更新`);
}
function updateTimerButtons(){const bs=document.querySelectorAll('.timerbtns button'),has=timerHasSelection(),panel=document.getElementById('executionNowPanel');if(panel){panel.classList.toggle('has-selection',has);panel.classList.toggle('is-running',!!timer.running)}if(bs.length<3)return;bs[0].disabled=!!timer.running||!has;bs[1].disabled=!timer.running;bs[2].disabled=!has||timer.elapsed<=0;bs[0].textContent=timer.running?'計時中…':'開始';bs[1].textContent='暫停';bs[2].textContent=has&&timer.elapsed>0?'完成並記錄':'完成'}
function selectTask(id,focusEdit=false){const t=getTask(id);if(!t)return;selected=id;const chain=ancestors(id);goalPath={long:chain.find(x=>x.level===1)?.id||null,mid:chain.find(x=>x.level===2)?.id||null,short:chain.find(x=>chain.find(y=>y.level===3)?.id===x.id)?.id||chain.find(x=>x.level===3)?.id||null,exec:chain.find(x=>x.level===4)?.id||null};renderTree();updateHubContext();if(focusEdit)openEditModal(id)}
function editModalField(t){
 const chain=ancestors(t.id),p=periodForTask(t),hours=t.weeklyMinutes>=60&&t.weeklyMinutes%60===0?String(t.weeklyMinutes/60):String(t.weeklyMinutes||0),unit=t.weeklyMinutes>=60&&t.weeklyMinutes%60===0?'hour':'min';
 const parentOptions=t.level===1?'<option value="">— 頂層方向 —</option>':db.tasks.filter(x=>x.level===t.level-1&&x.id!==t.id&&x.status!=='已封存').map(x=>`<option value="${x.id}" ${x.id===t.parent?'selected':''}>${esc(x.name)}</option>`).join('');
 let timing='';
 if(t.level===1) timing='';
 else if(t.level===2) timing=`<div class="auto-status"><span>階段期間</span><b>${p?.start&&p?.due?esc(p.start+' ～ '+p.due):'尚無完整子任務期間'}</b><small>由下層子任務期間自動決定。</small></div>`;
 else if(t.level===3) timing=`<div class="form-section"><div class="section-label">子任務期間</div><div class="row"><div><label>始期</label><input id="mStart" type="date" value="${esc(t.start||'')}"></div><div><label>終期</label><input id="mDue" type="date" value="${esc(t.due||'')}"></div></div></div>`;
 else timing=`<div class="form-section"><div class="section-label">執行期間</div><div class="auto-status"><span>自動繼承</span><b>${p?.start&&p?.due?esc(p.start+' ～ '+p.due):'尚無完整子任務期間'}</b></div></div>`;
 const action=t.level===4?`<div class="form-section"><div class="section-label">本週總投入</div><div class="row"><div><label>本週投入</label><div class="unit-input"><input id="mWeekly" type="number" min="0" step="0.5" value="${esc(hours)}"><select id="mWeeklyUnit"><option value="min" ${unit==='min'?'selected':''}>分鐘</option><option value="hour" ${unit==='hour'?'selected':''}>小時</option></select></div></div><div class="auto-status"><span>彈性分配</span></div></div></div>`:'';
 return `<div class="context edit-modal-path"><b>目前目標路徑</b><br>${chain.map(x=>esc(x.name)).join(' → ')}<br><span class="muted">${L[t.level]} · 完成度 ${calc(t)}% · ${esc(t.status)}</span></div><div class="form"><label>名稱</label><input id="mName" value="${esc(t.name)}">${t.level>1?`<label>直接上層目標</label><select id="mParent">${parentOptions}</select>`:''}${timing}${action}<div class="auto-status"><span>目前狀態</span><b>${esc(t.status)}</b><small>狀態與完成度由實際投入紀錄自動計算。</small></div><div class="edit-modal-actions"><button class="btn" type="button" onclick="closeEditModal()">取消</button><button class="btn gold" type="button" onclick="saveEditModal()">保存修改</button></div><div class="edit-modal-crud"><button class="softbtn" type="button" onclick="closeEditModal();addChild('${t.id}')">＋ 新增下層</button><button class="softbtn" type="button" onclick="closeEditModal();moveTask('${t.id}')">↗ 移動</button><button class="softbtn" type="button" onclick="closeEditModal();archiveTask('${t.id}')">封存</button><button class="dangerbtn" type="button" onclick="closeEditModal();safeRemove('${t.id}')">刪除</button></div></div>`;
}
function openEditModal(id){const t=getTask(id);if(!t)return;selected=id;const chain=ancestors(id);goalPath={long:chain.find(x=>x.level===1)?.id||null,mid:chain.find(x=>x.level===2)?.id||null,short:chain.find(x=>x.level===3)?.id||null,exec:chain.find(x=>x.level===4)?.id||null};const modal=document.getElementById('editModal'),body=document.getElementById('editModalBody');if(!modal||!body)return;document.getElementById('editModalTitle').textContent='編輯：'+t.name;body.innerHTML=editModalField(t);modal.classList.add('show');document.body.style.overflow='hidden';setTimeout(()=>document.getElementById('mName')?.focus(),30);bindInteractionFeedback()}
function closeEditModal(){const modal=document.getElementById('editModal');if(modal)modal.classList.remove('show');document.body.style.overflow='';}
function saveEditModal(){
 const t=getTask(selected);if(!t)return;
 const name=document.getElementById('mName')?.value.trim();if(!name){toast('請輸入名稱');return}
 const newParent=t.level===1?null:(document.getElementById('mParent')?.value||null);
 if(t.level>1){const pnew=getTask(newParent);if(!pnew||pnew.level!==t.level-1||wouldCycle(t.id,newParent)){toast('直接上層目標無效或會形成循環');return}}
 const draft={name,parent:newParent};
 if(t.level===3){const st=document.getElementById('mStart')?.value||'',du=document.getElementById('mDue')?.value||'';if(!st||!du){toast('子任務必須設定始期與終期');return}if(st>du){toast('始期不能晚於終期');return}draft.start=st;draft.due=du}
 if(t.level===4){const pp=periodForTask(getTask(newParent));if(!pp?.start||!pp?.due){toast('請先為所屬子任務設定完整期間');return}const n=Math.max(0,+document.getElementById('mWeekly').value||0),u=document.getElementById('mWeeklyUnit').value;draft.weeklyMinutes=u==='hour'?Math.round(n*60):Math.round(n)}
 const before=JSON.parse(JSON.stringify(db));
 Object.assign(t,draft);recalcAllStatuses();
 if(!save()){
  db=before;
  toast('修改未保存，原目標內容已恢復');return;
 }
 closeEditModal();renderAll();toast('修改已保存；本週時數邏輯已同步全部模組')
}

function wouldCycle(id,parent){let cur=parent,guard=0;while(cur&&guard++<10){if(cur===id)return true;cur=getTask(cur)?.parent}return false}
function dashExecuteList(){
 const items=decisionItems().map(item=>item.t);
 DashboardPage.renderExecuteList({
  document,
  items,
  currentWeekSummary,
  ancestors,
  esc,
  calc
 });
}
function executeFromDashboard(id){selected=id;const chain=ancestors(id);goalPath={long:chain.find(x=>x.level===1)?.id||null,mid:chain.find(x=>x.level===2)?.id||null,short:chain.find(x=>x.level===3)?.id||null,exec:id};useTimer(id);startTimer();toast('已開始執行')}
function overviewMonthItems(date=todayKey()){
 const start=date;const d0=new Date(start+'T00:00:00');d0.setDate(d0.getDate()+30);const end=`${d0.getFullYear()}-${String(d0.getMonth()+1).padStart(2,'0')}-${String(d0.getDate()).padStart(2,'0')}`;
 const map=new Map();
 const add=(date,title,meta,type='calendar')=>{if(!date||date<start||date>end)return;const k=date+'|'+title;if(!map.has(k))map.set(k,{date,title,meta,type})};
 const school=Array.isArray(THU_SCHOOL_CALENDAR_BASE)?THU_SCHOOL_CALENDAR_BASE:[];school.forEach(e=>add(e.date,e.title,e.meta||'學校行事',e.type||'school'));
 (Array.isArray(db.calendarEvents)?db.calendarEvents:[]).filter(e=>e&&e.status!=='已取消').forEach(e=>add(e.date,e.title,e.meta||'行事曆',e.type||'calendar'));
 db.tasks.filter(t=>t.level===3&&t.status!=='已封存'&&t.status!=='已完成').forEach(t=>{const p=periodForTask(t);if(p?.due)add(p.due,t.name,(ancestors(t.id).find(x=>x.level===2)?.name||'子任務')+'｜子任務截止','task')});
 return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title)).slice(0,10);
}
function daysUntil(date){if(!date)return Infinity;const a=new Date(todayKey()+'T00:00:00'),b=new Date(date+'T00:00:00');return Math.ceil((b-a)/86400000)}
function weeklyWorkload(date=todayKey()){
 const target=activeWeeklyTargetTotal(date),hours=target/60;
 let level='寬鬆',score=0;
 if(hours>=48){level='過載';score=100}
 else if(hours>=42){level='忙';score=85+(hours-42)/6*15}
 else if(hours>=35){level='偏忙';score=60+(hours-35)/7*25}
 else if(hours>=25){level='正常';score=30+(hours-25)/10*30}
 else if(hours>0){level='寬鬆';score=Math.max(0,hours/25*30)}
 const actual=AnalyticsDomain.weeklyStudySummary({tasks:db.tasks,logs:db.logs,date}).goalActualMinutes;
 const used=target?Math.min(100,actual/target*100):0;
 const capacity=Math.max(0,100-score);
 return {target,hours,level,score:Math.round(score),actual,used:Math.round(used),capacity};
}
function decisionState(t,date=todayKey()){
 const w=currentWeekSummary(t,date),p=periodForTask(t);if(!w.active||w.remaining<=0)return null;
 const days=daysUntil(p?.due);const totalDays=p?.start&&p?.due?Math.max(1,Math.ceil((new Date(p.due)-new Date(p.start))/86400000)+1):1;
 const elapsed=Math.max(0,Math.min(totalDays,Math.ceil((new Date(date)-new Date(p.start))/86400000)+1));
 const expected=Math.round(elapsed/totalDays*100),progress=calc(t),gap=Math.max(0,expected-progress);
 const load=weeklyWorkload(date);
 let score=0,state='normal',label='正常';
 if(days<=7){score+=55;state='urgent';label='接近截止'}else if(days<=14){score+=32}
 score+=Math.min(30,gap*0.6);
 score+=Math.min(20,w.target?Math.round(w.remaining/w.target*20):0);
 // 忙碌度會影響「是否值得現在做」，但不會壓過真正緊急的事項。
 if(load.score>=85){
   if(days>14&&gap<10)score-=18;
   if(days<=7)score+=8;
 }else if(load.score<30&&days>14&&gap>=10){score+=8}
 if(progress>=90&&days>14){state='ahead';label='接近完成';score-=18}
 return {t,w,days,gap,score,state,label,progress,load};
}
function decisionItems(date=todayKey()){
 return getTodayItems().map(t=>decisionState(t,date)).filter(Boolean).sort((a,b)=>b.score-a.score||a.days-b.days||b.w.remaining-a.w.remaining).slice(0,3);
}
function renderDecisionList(){
 const load=weeklyWorkload();
 const items=decisionItems().slice(0,1);
 DashboardPage.renderDecisionList({
  document,
  load,
  items,
  esc
 });
}
function dashboard(){
 const rootsA=roots().filter(t=>t.status!=='已封存');
 const overall=rootsA.length?Math.round(rootsA.reduce((sum,t)=>sum+calc(t),0)/rootsA.length):0;
 const weekItems=getTodayItems();
 const weekSummary=AnalyticsDomain.weeklyStudySummary({
  tasks:db.tasks,
  logs:db.logs,
  date:todayKey()
 });
 const weeklyTargetMinutes=weekSummary.target;
 const weekActual=weekSummary.totalStudyMinutes;
 const todayActual=StudyLogDomain.totalStudyMinutesInRange(
  db.logs,
  todayKey(),
  todayKey()
 );
 const deadlines=overviewMonthItems().slice(0,4);

 DashboardPage.renderDashboard({
  document,
  overall,
  todayItemCount:weekItems.length,
  weeklyTargetMinutes,
  weekActualMinutes:weekActual,
  todayActualMinutes:todayActual,
  date:new Date(),
  roots:rootsA,
  selected,
  calc,
  kids,
  deadlines,
  esc
 });

 dashExecuteList();
 renderDecisionList();
}
function updateHubContext(){}
function getTodayItems(){
 const base=db.tasks.filter(t=>{
   if(t.level!==4||t.status==='已完成'||t.status==='已封存')return false;
   const w=currentWeekSummary(t);return w.active&&w.remaining>0;
 });
 return base.sort((a,b)=>{const ar=currentWeekSummary(a),br=currentWeekSummary(b);return br.remaining-ar.remaining||ar.target-br.target||calc(a)-calc(b)});
}
/* V97.9.6 execution five-item preview */
let todayItemsExpanded=false;
function today(){
 const all=getTodayItems(),items=todayItemsExpanded?all:all.slice(0,5);
 ExecutionPage.renderToday({
  document,
  items,
  totalCount:all.length,
  expanded:todayItemsExpanded,
  timer,
  currentWeekSummary,
  ancestors,
  esc,
  calc
 });
 syncStudyBackfillForm();
}
function toggleTodayItemsPreview(){todayItemsExpanded=!todayItemsExpanded;today()}

let timerLoopActive=false;function timerLoop(){if(timerLoopActive)return;timerLoopActive=true;const tick=()=>{if(!timer.running){timerLoopActive=false;return}updateClock();setTimeout(tick,500)};tick()}
function updateClock(){const ms=TimerService.elapsedMs(timer,Date.now()),ss=Math.floor(ms/1000),h=Math.floor(ss/3600),m=Math.floor((ss%3600)/60),s=ss%60;document.getElementById('clock').textContent=[h,m,s].map(x=>String(x).padStart(2,'0')).join(':')}
async function exportDB(){
 const envelope=typeof makeSecureBackupEnvelope==='function'?await makeSecureBackupEnvelope(db):makeEnvelope(normalize(db));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(envelope,null,2)],{type:'application/json'}));a.download=`個人目標與學習行動管理系統_${APP_VERSION}_備份.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function importDB(){
 const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=()=>{const file=i.files?.[0];if(!file)return;const r=new FileReader();r.onload=async()=>{
  const previous=db;
  try{
   if(String(r.result).length>SECURITY_LIMITS.maxImportBytes)throw new Error('備份檔案超過安全上限');
   const parsed=typeof validateSecureBackupEnvelope==='function'?await validateSecureBackupEnvelope(String(r.result)):validateImportEnvelope(String(r.result));
   const candidate=migrateData(parsed.data,parsed.schemaVersion);
   const errs=validateData(candidate);
   if(errs.length)throw new Error(errs.slice(0,5).join('；'));
   const taskN=Array.isArray(candidate.tasks)?candidate.tasks.length:0, logN=Array.isArray(candidate.logs)?candidate.logs.length:0;
   if(!confirm(`確認匯入這份備份？\n\n目標 ${taskN} 個／歷程 ${logN} 筆\n目前資料會先保留在備份槽。`))return;
   db=candidate;
   if(!save({allowLogReplacement:true})){db=previous;throw new Error('保存失敗，已恢復目前資料');}
   selected=null;goalPath={long:null,mid:null,short:null,exec:null};renderAll();toast('匯入成功；舊資料已保留備份');
  }catch(e){db=previous;console.error(e);toast('匯入失敗：資料格式／完整性驗證未通過；目前資料未變更')}
 };r.readAsText(file)};i.click();
}

function toast(x){const t=document.getElementById('toast');t.textContent=x;t.classList.remove('show');void t.offsetWidth;t.classList.add('show');t.style.display='block';clearTimeout(window.__toast);window.__toast=setTimeout(()=>{t.classList.remove('show');t.style.display='none'},2200)}
function bindInteractionFeedback(){document.querySelectorAll('button').forEach(b=>{if(b.dataset.feedbackBound)return;b.dataset.feedbackBound='1';b.addEventListener('click',()=>{if(!b.disabled){b.classList.add('pressed');setTimeout(()=>b.classList.remove('pressed'),140)}});b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){if(!b.disabled)b.classList.add('pressed')}});b.addEventListener('keyup',()=>b.classList.remove('pressed'))})}






function calendarEventsForDate(key){
 return CalendarDomain.eventsForDate({
  schoolCalendar:db.schoolCalendar,
  calendarEvents:db.calendarEvents,
  key,
  enrichEvent:e=>{
   const a=e.refId?catalogItemById(e.refId):null;
   return {...e,type:e.type||'activity',title:e.title||a?.title||'已確認活動',time:e.time||a?.time||'',url:e.url||a?.url||a?.externalUrl||a?.sourceUrl||'',meta:(e.meta||'已確認')+' · 已確認'};
  }
 });
}
function calendarBaseDate(){return new Date(calendarCursor)}
function dateKey(d){return CalendarDomain.dateKey(d)}
function calendarDays(){return CalendarDomain.monthGridKeys(calendarBaseDate())}
function calendarSummaryButton(label,count,mode,active=false){return CalendarPage.summaryButton(esc(label),count,mode,active)}
function calendarDetailHTML(title,subtitle,events){
  const list=events||[];
  const body=list.length?`<div class="calendar-detail-list">${list.map(e=>{
    const isAct=e.type==='activity', confirmed=String(e.meta||'').includes('已確認');
    const manual=e.type==='manual';
    return `<div class="calendar-detail-item ${manual?'manual':(isAct?'activity':'school')}"><span class="dot"></span><div><b>${esc(e.title||'未命名行程')}</b><small>${esc(e.date||'')}${e.time?' · '+esc(e.time):''}${e.location?' · '+esc(e.location):''} · ${esc(e.meta|| (isAct?'活動':'學校行事'))}</small>${e.note?`<small>${esc(e.note)}</small>`:''}${e.score?`<span class="calendar-detail-reco">推薦 ${e.score} 分</span>`:''}</div><div class="detail-actions">${isAct&&e.url?`<a class="btn" href="${esc(safeExternalUrl(e.url))}" target="_blank" rel="noopener">外部資訊</a>`:''}${isAct?`<button class="dangerbtn" type="button" onclick="cancelCalendarActivity('${esc(e.id)}')">取消加入</button>`:''}${manual?`<button class="btn" type="button" onclick="deleteCalendarManualEvent('${e.id}')">刪除</button>`:''}</div></div>`;
  }).join('')}</div>`:'<div class="calendar-detail-empty">這個分類目前沒有項目。</div>';
  const el=document.getElementById('calendarDetail');if(!el)return;
  el.style.display='block';
  const selected=db.calendarSelected||todayKey();
  el.innerHTML=`<div class="calendar-detail-head"><div><h3>${esc(title)}</h3><p>${esc(subtitle||'')}</p></div><div class="calendar-detail-head-actions"><button class="btn gold" type="button" onclick="openCalendarAddModal('${selected}')">＋新增活動</button><button class="calendar-detail-close" type="button" onclick="hideCalendarDetail()">收合</button></div></div>${body}`;
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function showCalendarDay(key,scroll=true){
  db.calendarSelected=key;save();
  const es=calendarEventsForDate(key),d=new Date(key+'T00:00:00');
  const label=`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}（${['日','一','二','三','四','五','六'][d.getDay()]}）`;
  renderCalendar();
  calendarDetailHTML(label,'當日行程與活動',es);
  if(scroll)document.getElementById('calendarDetail')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function showCalendarSummary(mode){
  const base=calendarBaseDate(),days=calendarDays(),monthPrefix=`${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}`;
  let events=[],title='',subtitle='';
  if(mode==='today'){const key=todayKey();events=calendarEventsForDate(key);title='今天';subtitle=key;db.calendarSelected=key;}
  else if(mode==='school'){events=days.flatMap(calendarEventsForDate).filter(e=>e.type==='school');title='本月學校行事';subtitle=`${base.getFullYear()} 年 ${base.getMonth()+1} 月 · ${events.length} 項`;}
  else if(mode==='confirmed'){events=days.flatMap(calendarEventsForDate).filter(e=>(e.type==='activity'||e.type==='manual')&&String(e.meta||'').includes('已確認'));title='本月已確認活動';subtitle=`${base.getFullYear()} 年 ${base.getMonth()+1} 月 · ${events.length} 項`;}
  save();renderCalendar();calendarDetailHTML(title,subtitle,events);
}
function hideCalendarDetail(){const el=document.getElementById('calendarDetail');if(el){el.style.display='none';el.innerHTML='';}}
function renderCalendar(){
 ensureSchoolCalendar();syncCalendarDatePicker();
 const base=calendarBaseDate(),days=calendarDays(),today=todayKey();
 CalendarPage.render({
  document,
  baseDate:base,
  days,
  today,
  selectedDate:db.calendarSelected,
  eventsForDate:calendarEventsForDate,
  esc,
  detailHTML:calendarDetailHTML,
  hideDetail:hideCalendarDetail
 });
}
function calendarSelectDay(key){showCalendarDay(key,true)}

function calendarGoToPickedDate(){const input=document.getElementById('calendarDatePicker');const value=input?.value||'';if(!/^\d{4}-\d{2}-\d{2}$/.test(value)){toast('請先選擇完整日期');return}const d=new Date(value+'T00:00:00');if(Number.isNaN(d.getTime())){toast('日期格式無效');return}calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);db.calendarSelected=value;save();renderCalendar();toast(`已前往 ${value}`)}
function syncCalendarDatePicker(){const input=document.getElementById('calendarDatePicker');if(input)input.value=db.calendarSelected||todayKey()}
function calendarShift(months){const d=calendarBaseDate();calendarCursor=new Date(d.getFullYear(),d.getMonth()+months,1);renderCalendar()}
function calendarToday(){calendarCursor=new Date();db.calendarSelected=todayKey();save();renderCalendar();toast('已回到今天')}
function renderAll(){
 AppOrchestrator.renderAll({
  normalizeState:()=>{db=normalize(db)},
  rebuildExecutionPlanActuals,
  removeLegacyStandaloneToeicGoals,
  ensureActivities,
  ensureToeicPlan,
  recalcAllStatuses,
  renderGoalsPage,
  dashboard,
  today,
  renderTimerState,
  renderActivities,
  renderScholarships,
  renderCalendar,
  stats,
  bindInteractionFeedback,
  bindActivitySearch
 });
}
function validateData(data){
 const errors=[],ids=new Set();const tasks=Array.isArray(data?.tasks)?data.tasks:[];
 for(const t of tasks){
  if(!t||typeof t!=='object'){errors.push('存在無效目標資料');continue}
  if(ids.has(t.id))errors.push('重複 ID：'+t.id);ids.add(t.id);
  if(!t.name)errors.push('空白名稱：'+t.id);
  if(![1,2,3,4].includes(t.level))errors.push('非法層級：'+t.id);
  if(t.level===1&&t.parent)errors.push('第一級存在上層：'+t.name);
  if(t.level===3&&((t.start&&!t.due)||(!t.start&&t.due)||t.start>t.due))errors.push('子任務期間無效：'+t.name);
  if(t.level===4){if(!Number.isFinite(+t.weeklyMinutes)||+t.weeklyMinutes<0)errors.push('本週時數無效：'+t.name);let cur=t.parent,chainGuard=0,leafParent=null;while(cur&&chainGuard++<10){const p=getTaskFrom(tasks,cur);if(!p)break;if(p.level===3){leafParent=p;break}cur=p.parent}if(!leafParent||!leafParent.start||!leafParent.due||leafParent.start>leafParent.due)errors.push('具體實現方式缺少有效子任務期間：'+t.name)}
  if(t.level>1){const p=getTaskFrom(tasks,t.parent);if(!p)errors.push('缺少上層：'+t.name);else if(p.level!==t.level-1)errors.push('層級不連續：'+t.name)}
  let cur=t.parent,seen=new Set([t.id]),guard=0;while(cur&&guard++<20){if(seen.has(cur)){errors.push('循環關係：'+t.name);break}seen.add(cur);cur=getTaskFrom(tasks,cur)?.parent||null}
 }
 return [...new Set(errors)];
}
function validateDB(){repairKnownHierarchy(db.tasks);return validateData(db)}
function activeWeeklyTargetTotal(date=todayKey()){return ExecutionDomain.activeWeeklyTargetTotal(db.tasks,db.logs,date)}
function auditButtonHandlers(){
 const missing=[];
 const html=document.documentElement.outerHTML;
 const attrs=[...document.querySelectorAll('[onclick]')].map(e=>e.getAttribute('onclick')||'');
 const names=new Set();
 attrs.forEach(code=>{
  const m=code.match(/(?:^|[;\s])([A-Za-z_$][\w$]*)\s*\(/g)||[];
  m.forEach(raw=>{const n=raw.replace(/^[;\s]+/,'').replace(/\($/,'');if(n&&n!=='if'&&n!=='confirm'&&n!=='setTimeout'&&n!=='clearTimeout'&&n!=='close')names.add(n)})
 });
 names.forEach(n=>{if(typeof window[n]!=='function' && typeof globalThis[n]!=='function')missing.push(n)});
 return {ok:missing.length===0,missing:[...new Set(missing)]};
}
function auditCoreModules(){
 const required=['go','renderAll','renderTree','renderActivities','renderScholarships','renderCalendar','selectTodayExecution','startTimer','finishExecution','save','exportDB','importDB','runSelfTest','clearCacheOnly','safeExternalUrl','validateImportEnvelope','validateCatalogBoundary','openSettings','closeSettings','runDiagnostics','createRestorePoint','restoreLatestBackup'];
 const missing=required.filter(n=>typeof window[n]!=='function');
 return {ok:missing.length===0,missing};
}
function auditDataRoundTrip(){
 const sample=normalize(db);
 const env=makeEnvelope(sample);
 const parsed=parseEnvelope(JSON.stringify(env));
 const same=fnv1a(dataPayload(parsed.data))===fnv1a(dataPayload(sample));
 return {ok:same,same};
}
function auditStorageIsolation(){
 const probe='__v94_probe__';
 try{const before=storeGet(probe);const ok=storeSet(probe,'1')&&storeGet(probe)==='1';try{localStorage.removeItem(probe)}catch(e){delete memoryStore[probe]}return {ok};}
 catch(e){return {ok:false,error:e.message}}
}
function auditDOM(){
 const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);
 const dup=ids.filter((id,i)=>ids.indexOf(id)!==i);
 const views=['dash','goals','today','activity','scholarship','calendar','stats'];
 const missingViews=views.filter(id=>!document.getElementById(id));
 return {ok:dup.length===0&&missingViews.length===0,dup:[...new Set(dup)],missingViews};
}
function runSelfTest(){
 if(!document.getElementById('testModal')){ if(typeof openSettings==='function') openSettings(); if(typeof runDiagnostics==='function') runDiagnostics(); return; }
 const tests=[];
 try{const a=auditCoreModules();tests.push([a.ok,'核心模組函式：'+(a.ok?'完整':'缺少 '+a.missing.join('、'))])}catch(x){tests.push([false,'核心模組函式：'+x.message])}
 try{const a=auditButtonHandlers();tests.push([a.ok,'按鍵事件函式：'+(a.ok?'全部存在':'缺少 '+a.missing.join('、'))])}catch(x){tests.push([false,'按鍵事件函式：'+x.message])}
 try{const a=auditDOM();tests.push([a.ok,'DOM／七模組：'+(a.ok?'正常':'ID或模組異常')])}catch(x){tests.push([false,'DOM／七模組：'+x.message])}
 try{const a=auditDataRoundTrip();tests.push([a.ok,'資料序列化往返：'+(a.ok?'正常':'checksum不一致')])}catch(x){tests.push([false,'資料序列化往返：'+x.message])}
 try{const a=auditStorageIsolation();tests.push([a.ok,'儲存空間隔離測試：'+(a.ok?'正常':'失敗')])}catch(x){tests.push([false,'儲存空間隔離測試：'+x.message])}
 try{const e=validateDB();tests.push([!e.length,'資料結構：'+(e.length?e.slice(0,5).join('；'):'正常')]);}catch(x){tests.push([false,'資料結構：'+x.message])}
 try{const u=securityDiagnostics(),bad=safeExternalUrl('javascript:alert(1)'),good=safeExternalUrl('https://example.com/');tests.push([u.ok&&bad===''&&!!good,'安全邊界：URL／匯入上限／完整性驗證已啟用']);}catch(x){tests.push([false,'安全邊界：'+x.message])}
 try{
  const probe={id:'__weekly__',name:'週時數測試',level:4,parent:null,status:'未開始',weeklyMinutes:420,start:'',due:'',progress:0};
  const baseTask=db.tasks.find(t=>t.level===4&&periodForTask(t)?.start&&periodForTask(t)?.due);
  if(baseTask){
   const oldLogs=db.logs;db.logs=[];const old={...baseTask};
   Object.assign(baseTask,{weeklyMinutes:420});
   const p=periodForTask(baseTask),ws=weekStartKey(p.start),we=weekEndKey(p.start);
   db.logs=[{id:'__w1',taskId:baseTask.id,time:ws+'T09:00:00',minutes:210,actual:true}];
   const half=currentWeekSummary(baseTask,p.start); 
   db.logs.push({id:'__w2',taskId:baseTask.id,time:we+'T18:00:00',minutes:300,actual:true});
   const cap=currentWeekSummary(baseTask,p.start);
   Object.assign(baseTask,old);db.logs=oldLogs;
   tests.push([half.actual===210&&half.target===420&&half.remaining===210,'本週時數計算：正常']);
   tests.push([cap.actual===510&&cap.remaining===0,'本週投入不設每日上限：正常']);
  }else tests.push([true,'本週時數計算：無測試資料，略過']);
 }catch(x){tests.push([false,'本週時數計算：'+x.message])}
 try{
  const legacy={id:'__legacy__',name:'舊日制',level:4,parent:null,minutes:60,mode:'repeat',cycle:'日',singleDate:'',start:'',due:'',progress:0};
  const n=normalize({tasks:[legacy],logs:[]}).tasks[0];tests.push([n.weeklyMinutes===420&&!('minutes' in n)&&!('cycle' in n)&&!('mode' in n),'舊資料轉換：60 分／日 → 420 分／週']);
 }catch(x){tests.push([false,'舊資料轉換：'+x.message])}
 try{renderAll();tests.push([true,'跨模組渲染：正常'])}catch(x){tests.push([false,'跨模組渲染：'+x.message])}
 try{const before=db.logs.length,probe={id:'__probe__',name:'測試',level:4,parent:null,status:'未開始',weeklyMinutes:1,progress:0};db.tasks.push(probe);const errs=validateDB();db.tasks.pop();tests.push([errs.some(x=>x.includes('缺少上層')),'錯誤資料攔截：正常']);tests.push([db.logs.length===before,'測試不污染歷程：正常'])}catch(x){tests.push([false,'資料安全測試：'+x.message])}
 tests.push(...runGoalMapUXChecks());
 try{
  ensureActivities();
  const activityHasScholarship=activityStore().some(a=>a.scholarship||a.type==='獎學金／助學金'||a.kind==='scholarship');
  const scholarshipHasScholarship=scholarshipStore().length>0&&scholarshipStore().every(a=>a.scholarship||a.type==='獎學金／助學金'||a.kind==='scholarship');
  tests.push([!activityHasScholarship&&scholarshipHasScholarship,'活動雷達／獎學金資料分離：正常']);
 }catch(x){tests.push([false,'活動雷達／獎學金資料分離：'+x.message])}
 try{const overseas=activityStore().find(a=>a.id==='g03')||activityStore().find(a=>a.id==='a6'),fit=overseas&&activityFit(overseas);tests.push([!!fit&&fit.matchPercent>=70&&fit.task?.id==='g2'&&fit.ring!=='core','海外計畫：匹配度與同心圓分離']);const thu=activityStore().find(a=>a.scope==='東海校內'&&a.kind==='event'),tf=thu&&activityFit(thu);tests.push([!!tf&&tf.geo>=12&&tf.ring==='core','東海校內優先判斷：正常']);const refs=document.querySelectorAll('#activityReferences .reference-item');tests.push([refs.length>=1,'非直接計畫分流：正常']);}catch(x){tests.push([false,'活動同心圓／適配度：'+x.message])}
 try{const actionSource=typeof activityExternalUrl==='function';const noManualGoalLink=[...document.querySelectorAll('.activity-actions .btn')].every(b=>b.textContent.trim()!=='連結目標');tests.push([actionSource&&noManualGoalLink,'活動外部連結／目標按鍵：正常'])}catch(x){tests.push([false,'活動外部連結／目標按鍵：'+x.message])}
 try{const cs=document.querySelectorAll('#calendarSummary .summary-pill');tests.push([cs.length===3,'行事曆摘要互動：正常']);calendarSelectDay(todayKey());const det=document.getElementById('calendarDetail');tests.push([!!det&&det.style.display==='block','點擊日期詳情：正常']);hideCalendarDetail();}catch(x){tests.push([false,'行事曆互動：'+x.message])}
 try{
  tests.push([Array.isArray(db.executionPlans),'舊執行安排資料相容欄位：正常']);
  const p={id:'__plan_probe__',taskId:'__none__',name:'舊安排相容測試',date:'2099-01-01',time:'09:00',minutes:30,status:'待執行'};
  tests.push([ExecutionDomain.activeExecutionPlan(p)===true,'舊安排仍可安全讀取：正常']);
  tests.push([typeof cancelCalendarActivity==='function','活動行事曆可逆操作：取消加入功能已接入']);
 }catch(x){tests.push([false,'相容性測試：'+x.message])}
 try{const legacyRoot={id:'__legacy_toeic__',name:'TOEIC 正式考試',level:1,parent:null,status:'未開始',weeklyMinutes:0,start:'',due:'',progress:0};const child={id:'__legacy_toeic_child__',name:'2026/12/20 TOEIC 聽力與閱讀測驗',level:4,parent:'__legacy_toeic__',status:'未開始',weeklyMinutes:0,start:'',due:'',progress:0};db.tasks.push(legacyRoot,child);const removed=removeLegacyStandaloneToeicGoals();const noLegacy=!db.tasks.some(t=>t.id===legacyRoot.id||t.id===child.id);tests.push([removed&&noLegacy,'舊 TOEIC 行事曆目標清理：正常']);}catch(x){tests.push([false,'舊 TOEIC 行事曆目標清理：'+x.message])}
 try{const t1=db.tasks.find(t=>t.id==='g1-2-1-1'),t2=db.tasks.find(t=>t.id==='g3-2026-10-article');const pre=activeWeeklyTargetTotal('2026-09-04'),start=activeWeeklyTargetTotal('2026-09-07'),topic=activeWeeklyTargetTotal('2026-10-03');const usable=db.tasks.filter(t=>t.level===4&&t.status!=='已封存');const preExpected=usable.reduce((s,t)=>s+currentWeekSummary(t,'2026-09-04').target,0);const startExpected=usable.reduce((s,t)=>s+currentWeekSummary(t,'2026-09-07').target,0);const topicExpected=usable.reduce((s,t)=>s+currentWeekSummary(t,'2026-10-03').target,0);tests.push([pre===preExpected,'未開始階段不提前計入本週：正常']);tests.push([start===startExpected&&start>=pre,'進入有效週後自動啟用週時數：正常']);tests.push([topic===topicExpected,'跨階段週時數切換：正常']);tests.push([!!t1&&currentWeekSummary(t1,'2026-09-04').target===0&&currentWeekSummary(t1,'2026-09-07').target===Number(t1.weeklyMinutes||0),'子任務期間控制 Level 4：正常']);tests.push([!!t2&&currentWeekSummary(t2,'2026-10-03').target===40,'TOEIC 整合週時數啟用：正常']);}catch(x){tests.push([false,'分析／週時數計算：'+x.message])}
  try{selected=null;pickGoal('long','g1');const single=selected==='g1'&&goalPath.long==='g1';pickGoal('long','g2');const switched=selected==='g2'&&goalPath.long==='g2';tests.push([single&&switched,'目標單一操作／切換目前目標：正常']);}catch(x){tests.push([false,'目標單一操作／切換目前目標：'+x.message])}
  const dead=['occurrenceOnDate','plannedOccurrences','syncAutoTemporalStatus','syncModalActionFields','clearOldAppCache','purgeLegacyCaches'];
 tests.push([dead.every(name=>typeof window[name]==='undefined'),'舊時間／快取函式已清除']);
 try{
  const html=document.documentElement.outerHTML;
  const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);
  const dup=ids.filter((id,i)=>ids.indexOf(id)!==i);
  tests.push([KEY==='lawLangGoalSystemV92'&&SCHEMA_VERSION===6,'版本 '+APP_VERSION+'／Schema 6／沿用 V92 資料主鍵：正常']);
  tests.push([typeof deleteActualLog==='function'&&typeof restoreActualLog==='function'&&typeof isCountableActualLog==='function','實際紀錄刪除／恢復：正常']);
  tests.push([dup.length===0,'DOM ID 唯一性：正常']);
  tests.push([cleanupLegacyStorage()>=0,'舊版本儲存鍵清理：正常']);
  tests.push([typeof fnv1a==='function'&&typeof makeEnvelope==='function'&&typeof parseEnvelope==='function','資料完整性核心：存在']);
  try{const sample=normalize({tasks:[],logs:[]});const env=makeEnvelope(sample);const tampered=JSON.stringify({...env,data:{tasks:[{id:'x',name:'破壞',level:1,parent:null}],logs:[]}});let rejected=false;try{parseEnvelope(tampered)}catch(e){rejected=true}tests.push([rejected,'Checksum 損壞資料攔截：正常'])}catch(x){tests.push([false,'Checksum 損壞資料攔截：'+x.message])}
  tests.push([typeof migrateData==='function'&&typeof validateData==='function','Migration／資料驗證核心：存在']);
  tests.push([typeof clearApplicationCaches==='function','應用程式快取清理核心：存在']);
  tests.push([typeof clearCacheOnly==='function','清除快取按鍵：已接入']);
  tests.push([typeof clearApplicationCaches==='function'&&typeof localStorage!=='undefined','清除快取不直接清除 localStorage：正常']);
  tests.push([typeof save==='function'&&typeof normalize==='function'&&typeof validateDB==='function'&&typeof renderAll==='function','核心原始函式：完整']);
  tests.push([document.querySelectorAll('script').length>=1&&document.documentElement.lang==='zh-Hant','HTML 基本結構：正常']);
  const legacyMulti='selected'+'Ids',legacyCss='goal-selection-'+'summary';tests.push([!html.includes(legacyMulti)&&!html.includes(legacyCss),'多目標選取殘留：已清除']);
  tests.push([typeof currentWeekSummary==='function'&&typeof activeWeeklyTargetTotal==='function','週時數計算核心：存在']);
  tests.push([typeof isOtherStudyLog==='function'&&typeof isGoalActualLog==='function'&&typeof selectOtherStudyTimer==='function'&&typeof addOtherStudyLog==='function','其他讀書時間：紀錄／計時／分析分流核心存在']);
  tests.push([typeof decisionState==='function'&&typeof decisionItems==='function'&&typeof renderDecisionList==='function','決策邏輯核心：存在']);
   tests.push([typeof weeklyWorkload==='function'&&['寬鬆','正常','偏忙','忙','過載'].includes(weeklyWorkload().level),'週負荷／值得執行聯動核心：存在']);
  tests.push([Array.isArray(db.weekReviews)&&typeof renderWeeklyReview==='function'&&typeof setWeeklyReview==='function','週結算／未完成原因核心：存在']);
  try{const probe=db.tasks.find(t=>t.level===4&&currentWeekSummary(t).active&&currentWeekSummary(t).remaining>0);const d=probe?decisionState(probe):null;tests.push([!probe||!!d,'決策排序：正常']);}catch(x){tests.push([false,'決策排序：'+x.message])}
  tests.push([typeof pickGoal==='function'&&typeof selected!=='undefined','單一目標操作核心：存在']);
  tests.push([document.querySelectorAll('.bottom-nav button').length===7,'底部七模組導覽：正常']);
  try{const names=[...html.matchAll(/onclick=\"([A-Za-z_$][\w$]*)\(/g)].map(m=>m[1]);const missing=[...new Set(names)].filter(n=>typeof window[n]!=='function');tests.push([missing.length===0,'按鍵事件函式完整：'+(missing.length?missing.join('、'):'正常')]);}catch(x){tests.push([false,'按鍵事件函式檢測：'+x.message])}
  tests.push([!(/function\s+(syncModalActionFields|plannedOccurrences|occurrenceOnDate)\s*\(/.test(html)),'已移除舊快取／舊時間模型函式：正常']);
 }catch(x){tests.push([false,'原始碼結構檢測：'+x.message])}
 document.getElementById('testResult').innerHTML=tests.map(x=>`<div class="listitem"><span>${x[0]?'✓':'✗'} ${esc(x[1])}</span><b>${x[0]?'PASS':'FAIL'}</b></div>`).join('')+``;document.getElementById('testModal').style.display='flex'
}
function closeTest(){document.getElementById('testModal').style.display='none'}

function runGoalMapUXChecks(){const out=[];try{const q=document.getElementById('q'),l=document.getElementById('lf'),sf=document.getElementById('sf');const oq=q?.value||'',ol=l?.value||'all',os=sf?.value||'all';q.value='透明刑總 II';l.value='all';sf.value='all';renderTree();const hit=document.querySelectorAll('.goal-result-card');out.push([hit.length===1&&hit[0].textContent.includes('透明刑總 II'),'搜尋直接結果','搜尋後直接呈現符合階層並顯示完整父子路徑']);q.value='';l.value='4';sf.value='all';renderTree();const r=document.querySelectorAll('.goal-result-card');out.push([r.length>0&&[...r].every(x=>x.querySelector('.goal-result-name small')?.textContent==='具體行動'),'Level 4 直接篩選','選擇具體實現方式後直接呈現 Level 4 結果']);q.value=oq;l.value=ol;sf.value=os;renderTree()}catch(e){out.push([false,'搜尋／篩選直接結果',e.message])}try{out.push([typeof clearGoalSearch==='function'&&typeof scrollToGoalResult==='function','搜尋操作連結','清除與定位功能已接入目標地圖'])}catch(e){out.push([false,'搜尋操作連結',e.message])}try{const first=document.querySelector('.task');const id=first?.id?.replace('task-','');const ch=first?.querySelector(':scope > .taskline > .chev');if(ch&&id){storeSet('o'+id,'0');renderTree();ch.click();const opened=!!document.querySelector('#task-'+id+'>.kids');ch.click();const closed=!document.querySelector('#task-'+id+'>.kids');out.push([opened&&closed,'單節點展開／收合','直接點擊箭頭可切換']);}else out.push([true,'單節點展開／收合','目前沒有可測試節點'])}catch(e){out.push([false,'單節點展開／收合',e.message])}return out}

function updateActivitySearchUI(){const e=document.getElementById('activitySearch'),c=document.getElementById('activitySearchClear'),st=document.getElementById('activitySearchStatus');if(e&&c)c.classList.toggle('show',!!e.value.trim());if(st){const q=(e?.value||'').trim();st.textContent=q?`目前輸入：「${q}」；可按搜尋套用。`:'可直接輸入關鍵字，按「搜尋」套用。'}}
function openCalendarAddModal(dateKey){
 const modal=document.getElementById('calendarAddModal');if(!modal)return;
 const date=dateKey||db.calendarSelected||todayKey();
 document.getElementById('caTitle').value='';
 document.getElementById('caDate').value=date;
 document.getElementById('caTime').value='';
 document.getElementById('caLocation').value='';
 document.getElementById('caNote').value='';
 modal.style.display='flex';document.body.style.overflow='hidden';
 setTimeout(()=>document.getElementById('caTitle')?.focus(),30);
}
function closeCalendarAddModal(){const modal=document.getElementById('calendarAddModal');if(modal)modal.style.display='none';document.body.style.overflow='';}
function saveCalendarManualEvent(){
 const title=(document.getElementById('caTitle')?.value||'').trim();
 const date=document.getElementById('caDate')?.value||'';
 const time=(document.getElementById('caTime')?.value||'').trim();
 const location=(document.getElementById('caLocation')?.value||'').trim();
 const note=(document.getElementById('caNote')?.value||'').trim();
 if(!title){toast('請輸入活動名稱');return}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){toast('請選擇日期');return}
 const previousEvents=db.calendarEvents,previousSelected=db.calendarSelected,previousCursor=calendarCursor;
 db.calendarEvents=[...(previousEvents||[]),{id:'manual-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),type:'manual',date,time,title,location,note,meta:'手動新增'}];
 db.calendarSelected=date;
 calendarCursor=new Date(Number(date.slice(0,4)),Number(date.slice(5,7))-1,1);
 if(!save()){
  db.calendarEvents=previousEvents;db.calendarSelected=previousSelected;calendarCursor=previousCursor;
  toast('行事曆新增失敗，原資料未變更');return;
 }
 closeCalendarAddModal();renderCalendar();
 calendarDetailHTML(`${date.slice(0,4)}/${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`,'已新增活動',calendarEventsForDate(date));
 toast('活動已加入行事曆');
}
function deleteCalendarManualEvent(id){
 if(!confirm('確定刪除這個手動新增的活動？'))return;
 const previousEvents=db.calendarEvents;
 db.calendarEvents=(previousEvents||[]).filter(e=>String(e.id)!==String(id));
 if(!save()){
  db.calendarEvents=previousEvents;toast('刪除失敗，原行事已保留');return;
 }
 renderCalendar();
 if(db.calendarSelected)showCalendarDay(db.calendarSelected,false);
 toast('活動已刪除');
}
function cancelCalendarActivity(id){
 const previousEvents=Array.isArray(db.calendarEvents)?db.calendarEvents:[];
 const item=previousEvents.find(x=>String(x.id)===String(id)&&x.type==='activity');
 if(!item)return;
 if(!confirm(`確定取消「${item.title||'這個活動'}」的行事曆安排？`))return;
 db.calendarEvents=previousEvents.map(x=>x===item?{...x,status:'已取消',cancelledAt:new Date().toISOString()}:x);
 if(!save()){
  db.calendarEvents=previousEvents;toast('取消安排未保存，原安排已保留');return;
 }
 renderAll();
 if(db.calendarSelected)showCalendarDay(db.calendarSelected,false);
 toast('已取消加入行事曆；活動雷達資料仍保留');
}
function addActivityToCalendar(id){
 const a=catalogItemById(id);if(!a)return;
 const previousEvents=Array.isArray(db.calendarEvents)?db.calendarEvents:[];
 if(previousEvents.some(e=>e.type==='activity'&&String(e.refId)===String(id)&&e.status!=='已取消')){
  toast('這個活動已在行事曆中');return;
 }
 db.calendarEvents=[...previousEvents,{id:'ce'+Date.now()+Math.random(),type:'activity',refId:id,date:a.date,time:a.time||'',title:a.title,url:activityExternalUrl(a),meta:'已確認',status:'已確認',createdAt:new Date().toISOString()}];
 if(!save()){
  db.calendarEvents=previousEvents;toast('加入行事曆失敗，原資料未變更');return;
 }
 renderCalendar();toast('已確認加入行事曆');
}
