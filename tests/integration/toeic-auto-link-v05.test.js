'use strict';
/* Synthetic-only acceptance: no actual Goal Manager data or network writes. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const P=require('../../js/domain/toeic-sync-policy.js');
const NOW=new Date('2026-10-12T08:00:00Z');
const CONSENT={version:1,enabled:true,enabledAt:'2026-10-12T00:00:00Z'};
function goals(){return [
 {id:'toeic-direction-2026',name:'TOEIC 多益英文能力準備',level:1,parent:null,status:'進行中'},
 {id:'g3-2026-integrated',name:'TOEIC｜10–12 月整合準備',level:2,parent:'toeic-direction-2026',status:'進行中'},
 {id:'g3-2026-10',name:'10月低負擔整合學習',level:3,parent:'g3-2026-integrated',status:'進行中',start:'2026-10-01',due:'2026-11-01'},
 {id:'g3-2026-10-article',name:'文章整合',level:4,parent:'g3-2026-10',status:'進行中',weeklyMinutes:40},
 {id:'g3-2026-10-practice',name:'題目＋檢討',level:4,parent:'g3-2026-10',status:'進行中',weeklyMinutes:30}
]}
function session(n=1,override={}){
 return {appId:P.TRAINER_APP,schema:1,id:'tt-test-'+String(n).padStart(12,'0'),
  createdAt:new Date(Date.parse('2026-10-12T02:00:00Z')+n*8*60000).toISOString(),date:'2026-10-12',
  mode:'grammar',unit:'practice',part:5,seconds:125,questionsAnswered:2,correct:1,
  questionIds:['v04-p5-001','v04-p5-002'],suggestedGoalTaskId:'g3-2026-10-practice',goalImportStatus:'not-imported',...override};
}
function bundle(ss){return {appId:P.TRAINER_APP,schema:1,sessions:ss}}
function rec(ss,logs=[],consent=CONSENT,customTasks=goals()){return P.reconcile(bundle(ss),consent,{tasks:customTasks,logs,now:NOW})}
assert.equal(P.dateKey('2026-10-11T16:00:00Z'),'2026-10-12');
assert.equal(rec([session()]).eligible.length,1);
assert.equal(rec([session()]).eligible[0].log.minutes,2);
assert.equal(rec([session()]).eligible[0].log.kind,'goal-study');
assert.equal(rec([session()]).eligible[0].log.sourceEventId,session().id);
assert.equal(rec([session()]).eligible[0].log.source,'toeic-trainer-v05');
assert.equal(rec([session()]).eligible[0].log.sourceCorrect,1);
assert.equal(rec([session()],[],{...CONSENT,enabled:false}).eligible.length,0);
assert.equal(rec([session()],[],{...CONSENT,enabled:false}).blocked,'尚未由訓練端啟用自動連動');
assert.equal(rec([session(2),session(2)]).excluded.length,2);
assert.equal(rec([session(1,{seconds:59})]).excluded.length,1);
assert.equal(rec([session(1,{date:'2026-10-13'})]).excluded.length,1);
assert.equal(rec([session(1,{part:2})]).excluded.length,1);
assert.equal(rec([session(1,{mode:'listening'})]).excluded.length,1);
assert.equal(rec([session(1,{questionIds:['p2-01','p2-02']})]).excluded.length,1);
assert.equal(rec([session(1,{createdAt:'2026-10-12T20:00:00Z'})]).excluded.length,1);
assert.equal(rec([session(1,{createdAt:'2026-10-12T00:00:00Z'})]).excluded.length,1);
assert.equal(rec([session(1,{seconds:3600*7})]).excluded.length,1);
assert.equal(rec([session(1,{goalImportStatus:'imported'})]).excluded.length,1);
assert.equal(rec([session(1,{suggestedGoalTaskId:'g3-2026-10-article'})]).held.length,1);
const old=rec([session()]).eligible[0].log;
assert.equal(rec([session()],[old]).already.length,1,'Never count same event twice');
const manual={id:'manual-1',kind:'goal-study',actual:true,time:'2026-10-12T02:15:00Z',taskId:'g3-2026-10-practice',minutes:15,source:'manual-backfill'};
assert.equal(rec([session()],[manual]).held.length,1,'Do not double-count manual records on same day');
const tasks=goals();tasks.at(-1).status='已封存';
assert.equal(rec([session()],[],CONSENT,tasks).held.length,1);
const twice=[session(1),session(2)];assert.equal(rec(twice).eligible.length,2);
const first=rec(twice).eligible[0].log;
assert.equal(rec([session(2)],[first]).eligible.length,1,'Distinct nonoverlapping sessions same day can sync');
const colliding=[session(1),session(2,{createdAt:new Date(Date.parse(session(1).createdAt)+30000).toISOString()})];
assert.equal(rec(colliding).held.length,2,'Both overlapping sessions must be held');
const older=rec([session(1)],[],{version:1,enabled:true,enabledAt:'2026-10-12T07:00:00Z'});
assert.equal(older.excluded.length,1,'No automatic historical backfill');
assert.equal(P.reconcile(bundle([session()]),{...CONSENT},{tasks:goals(),logs:[],now:NOW}).total,1);
assert.equal(P.reconcile({appId:'fake',schema:1,sessions:[session()]},CONSENT,{tasks:goals(),logs:[],now:NOW}).eligible.length,0);
// A hundred distinct valid future-only sessions, spaced at least four minutes,
// remain individually traceable and are never inflated into more than 100 logs.
const hundred=Array.from({length:100},(_,i)=>session(i+1,{
  createdAt:new Date(Date.parse('2026-10-11T16:15:00Z')+i*4*60000).toISOString(),seconds:125
}));
const bulk=P.reconcile(bundle(hundred),{version:1,enabled:true,enabledAt:'2026-10-11T16:00:00Z'},
 {tasks:goals(),logs:[],now:NOW});
assert.equal(bulk.eligible.length,100);
assert.equal(bulk.eligible.reduce((total,x)=>total+x.log.minutes,0),200);
const twiceBulk=P.reconcile(bundle(hundred),{version:1,enabled:true,enabledAt:'2026-10-11T16:00:00Z'},
 {tasks:goals(),logs:bulk.eligible.map(x=>x.log),now:NOW});
assert.equal(twiceBulk.eligible.length,0);
assert.equal(twiceBulk.already.length,100);
// In December, official mock events must resolve to the existing mock leaf,
// while the same unit in October falls back to the integrated practice leaf.
const decGoals=goals();decGoals.push({id:'g3-2026-12',name:'十二月',level:3,parent:'g3-2026-integrated',status:'進行中',start:'2026-11-30',due:'2026-12-19'},
 {id:'g3-2026-12-mock',name:'模考',level:4,parent:'g3-2026-12',status:'進行中',weeklyMinutes:60});
const dec=session(1,{date:'2026-12-05',createdAt:'2026-12-05T03:00:00Z',mode:'official-reading-mock',unit:'mock',part:null,
 suggestedGoalTaskId:'g3-2026-12-mock'});
assert.equal(P.reconcile(bundle([dec]),{version:1,enabled:true,enabledAt:'2026-12-01T00:00:00Z'},
 {tasks:decGoals,logs:[],now:new Date('2026-12-05T12:00:00Z')}).eligible.length,1);
// A Goal Manager manual backfill must refuse to duplicate a same-day auto-linked goal log.
const gmAppPath=path.join(root,'js/app.js');
if(fs.existsSync(gmAppPath)){
 const app=fs.readFileSync(gmAppPath,'utf8');
 assert(app.includes("log.source==='toeic-trainer-v05'&&String(log.taskId)===String(taskId)&&logDate(log.time)===date"));
}
// Main-side integration: a correct save adds one log; reopening does not duplicate,
// and storage failures preserve previous logs without touching existing records.
function simulatedRuntime(saveOkay){
 const map=new Map([[P.TRAINER_KEY,JSON.stringify(bundle([session()]))],[P.CONSENT_KEY,JSON.stringify(CONSENT)]]);
 const store={getItem:k=>map.get(k)||null,setItem(k,v){map.set(k,v)}};
 const oldLog={id:'past',taskId:'unrelated',time:'2026-10-11T02:00:00Z',minutes:4,kind:'goal-study',actual:true};
 const db={tasks:goals(),logs:[oldLog]};
 function wrapDb(){return JSON.stringify({schemaVersion:6,data:JSON.parse(JSON.stringify(db))})}
 map.set('lawLangGoalSystemV92',wrapDb());
 let saved=0;
 const window={GoalToeicSyncPolicy:P,addEventListener(){},location:{href:'https://example.com/my-goal-manager/'}};
 const document={readyState:'complete',getElementById(){return null},addEventListener(){}};
 const ctx={window,document,db,localStorage:store,console,persistenceRecoveryBlocked:false,
   gmToeicLastCommittedRaw:map.get('lawLangGoalSystemV92'),
   storeGet:k=>store.getItem(k),parseEnvelope:raw=>JSON.parse(raw),
   save:()=>{saved++;if(saveOkay){map.set('lawLangGoalSystemV92',wrapDb());ctx.gmToeicLastCommittedRaw=map.get('lawLangGoalSystemV92')}return saveOkay},renderAll(){}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'js/toeic-sync-runtime.js'),'utf8'),ctx,{filename:'toeic-sync-runtime.js'});
 return {ctx,map,saved:()=>saved,oldLog};
}
const ok=simulatedRuntime(true);
assert.equal(ok.saved(),1);
assert.equal(ok.ctx.db.logs.length,2);
assert.equal(ok.ctx.db.logs.at(-1).id,'past');
ok.ctx.window.GoalToeicSyncRuntime.sync();
assert.equal(ok.saved(),1,'Repeated sync must be idempotent');
assert.equal(ok.ctx.db.logs.length,2);
const failed=simulatedRuntime(false);
assert.equal(failed.ctx.db.logs.length,1,'Failed persistence must restore old history');
assert.equal(failed.ctx.db.logs[0].id,'past');
const status=JSON.parse(ok.map.get(P.STATUS_KEY));
assert.equal(status.blocked,'');
console.log('PASS: TOEIC v0.5 consent, exact dates, no listening, overlap, manual hold, idempotent GM save, rollback');
