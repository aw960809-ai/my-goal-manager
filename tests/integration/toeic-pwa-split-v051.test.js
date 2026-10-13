'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const src=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=src('js/app.js'), runtime=src('js/toeic-sync-runtime.js'),policy=src('js/domain/toeic-sync-policy.js');
const version=src('config/version.js'),sw=src('sw.js');
assert.match(version,/GOAL_MANAGER_VERSION=\'98\.13\.8\'/);
assert.match(version,/GOAL_MANAGER_SCHEMA_VERSION=6/);
assert(!runtime.includes("a.href='/toeic-trainer/';"),'old goal-browser link removed');
assert(src('index.html').includes('id="homeToeicTraining"'),'homepage TOEIC entry retained');
assert(src('js/toeic-embed.js').includes("const TRAINER_PATH='/toeic-trainer/';"),'embed still points to independent project');
assert(!runtime.includes("a.href='./apps/toeic-trainer/';"));
assert(policy.includes("const CONSENT_KEY='toeic-trainer:v051-link-settings';"));
assert(app.includes('let gmToeicLastCommittedRaw=null;'));
assert(app.includes('gmToeicLastCommittedRaw=storeGet(KEY);'));
assert(app.includes('if(gmToeicLastCommittedRaw!==current)'),'ALL writes must guard entire persisted snapshot');
assert(runtime.includes('raw!==gmToeicLastCommittedRaw'),'sync must reject stale database snapshot');
assert(runtime.includes('externalMainChanged=true'),'storage events must hold stale tabs');
assert(sw.includes("GOAL_MANAGER_VERSION||'98.13.8'"));
assert(src('index.html').includes('js/toeic-sync-runtime.js'),'existing v0.5 integration remains loaded');
assert(!app.includes('toeic-trainer-v01:learning-state'),'Goal Manager must not overwrite Trainer history');

// Dynamic simulation: a background tab modified *calendar* but not study logs.
// The v0.5 implementation that only compared logs would erroneously overwrite it.
const vm=require('node:vm');
function runSync({changed=false}={}){
  const initial={schemaVersion:6,data:{tasks:[{id:'g3'}],logs:[],calendarEvents:[{id:'a',title:'original'}],executionPlans:[]}};
  const oldRaw=JSON.stringify(initial);
  const disk=JSON.parse(oldRaw);
  if(changed)disk.data.calendarEvents[0].title='newer other-tab event';
  const entries=new Map([['lawLangGoalSystemV92',JSON.stringify(disk)],['trainer','{}'],['consent','{}']]);
  const localStorage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v)};
  const fakePolicy={TRAINER_KEY:'trainer',CONSENT_KEY:'consent',STATUS_KEY:'status',
    reconcile:()=>({blocked:'',held:[],excluded:[],already:[],eligible:[{log:{id:'toeic-sync-tt-safe',taskId:'vocab',minutes:3,time:'2026-10-12T01:00:00Z'}}]})};
  let saved=0;
  const data=JSON.parse(oldRaw).data;
  const window={GoalToeicSyncPolicy:fakePolicy,addEventListener(){},location:{href:'https://aw960809-ai.github.io/my-goal-manager/'}};
  const document={readyState:'complete',getElementById(){return null},addEventListener(){},hidden:false};
  const sandbox={window,document,db:data,console,localStorage,gmToeicLastCommittedRaw:oldRaw,Date,JSON,
    storeGet:k=>localStorage.getItem(k),parseEnvelope:JSON.parse,renderAll(){},timer:null,
    save(){saved++;return true}};
  vm.runInNewContext(runtime,sandbox,{filename:'toeic-sync-runtime.js'});
  return {saved,sandbox,receipt:JSON.parse(entries.get('status')||'null')};
}
const held=runSync({changed:true});
assert.equal(held.saved,0,'external calendar modification must block sync');
assert.match(held.receipt.blocked,/另一分頁/);
const fresh=runSync({changed:false});
assert.equal(fresh.saved,1,'fresh unmodified dataset can ingest a valid event once');
console.log('PASS: V98.13.8 separate PWA; full-dataset stale-calendar guard; no history loss');
