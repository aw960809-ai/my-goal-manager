'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const Bridge=require('../js/bridge.js'),Core=require('../js/core.js');
const root=path.resolve(__dirname,'..');
const now=new Date('2026-10-11T15:00:00.000Z'); // 23:00 in Taiwan
function session(n,overrides={}){
 const id='tt-test-'+String(n).padStart(9,'0');
 const time=new Date(Date.parse('2026-10-11T10:00:00Z')+n*5*60000).toISOString();
 return {
   appId:Core.APP_ID,schema:1,id,date:'2026-10-11',createdAt:time,
   mode:'grammar',unit:'practice',part:5,seconds:143,minutes:2.38,questionsAnswered:2,
   correct:1,accuracy:50,questionIds:['p5-01','p5-02'],goalSyncEligible:true,
   suggestedGoalTaskId:'g3-2026-10-practice',goalImportStatus:'not-imported',...overrides
 };
}
function goals(logs=[],edits=[]){
 const tasks=[
  {id:'g3',name:'語言能力準備',level:1,parent:null,status:'進行中'},
  {id:'g3-2026-integrated',name:'TOEIC｜10–12 月整合準備',level:2,parent:'g3',status:'進行中'},
  {id:'g3-2026-10',name:'10月學習',level:3,parent:'g3-2026-integrated',status:'進行中',start:'2026-10-01',due:'2026-11-01'},
  {id:'g3-2026-10-practice',name:'題目＋檢討',level:4,parent:'g3-2026-10',status:'進行中',weeklyMinutes:30}
 ];
 for(const [id,values] of edits){Object.assign(tasks.find(t=>t.id===id),values)}
 const data={tasks,logs};const json=Bridge.stableSerialize(data);
 return JSON.stringify({appVersion:'V98.13.5',schemaVersion:6,savedAt:'2026-10-11T12:00:00Z',checksum:Bridge.fnv1a(json),data});
}
(async()=>{
 assert.equal(Bridge.localMinutes(143),2);
 assert.equal(Bridge.localMinutes(119),1);
 assert.equal(Bridge.localMinutes(59),0);
 assert.equal(Bridge.dateKey('2026-10-10T16:00:01Z'),'2026-10-11');
 assert.equal(Bridge.isDate('2026-02-30'),false);
 assert.equal(Bridge.isDate('2026-10-11'),true);
 const prev=Bridge.preview([session(1)],{now});
 assert.equal(prev.counts.review,1);
 assert.equal(prev.snapshotChecked,false);
 const packet=Bridge.buildPacket(prev,new Set([session(1).id]),{exportedAt:'2026-10-11T12:00:00Z'});
 assert.equal(packet.events.length,1);
 assert.equal(packet.events[0].minutes,2.38);
 assert.equal(packet.events[0].creditedMinutes,2);
 assert.equal(packet.goalManagerImportReady,false);
 assert.equal(packet.manualReviewOnly,true);
 assert.equal(packet.snapshotChecked,false);
 assert(!Object.keys(packet).includes('tasks')&&!Object.keys(packet).includes('logs'));
 assert.throws(()=>Bridge.buildPacket(prev,new Set(['tt-missing-event']),{exportedAt:'2026-10-11T12:00:00Z'}));
 assert.deepEqual(Bridge.preview([],{now}).counts,{total:0,review:0,candidate:0,hold:0,excluded:0,selectable:0});
 const snap=await Bridge.readGoalSnapshot(goals());
 assert.equal(snap.taskCount,4);assert.equal(snap.logCount,0);
 const signed=JSON.parse(goals());
 signed.integrity={algorithm:'SHA-256',scope:'dataPayload',digest:createHash('sha256').update(Bridge.stableSerialize(signed.data),'utf8').digest('hex')};
 const signedSnapshot=await Bridge.readGoalSnapshot(JSON.stringify(signed));
 assert.equal(signedSnapshot.taskCount,4,'Valid GM SHA-256 must be accepted');
 assert.equal(Bridge.preview([session(1)],{now,snapshot:snap}).counts.candidate,1);
 assert.equal(Bridge.preview([session(1),session(1)],{now,snapshot:snap}).counts.excluded,2);
 assert.equal(Bridge.preview([session(1,{seconds:0})],{now}).counts.excluded,1);
 assert.equal(Bridge.preview([session(1,{seconds:59})],{now}).counts.excluded,1);
 assert.equal(Bridge.preview([session(1,{seconds:21601})],{now}).counts.excluded,1);
 assert.equal(Bridge.preview([session(1,{unit:'mock'})],{now}).counts.excluded,1);
 assert.equal(Bridge.preview([session(1,{part:2,mode:'listening',questionIds:['p2-01','p2-02']})],{now}).counts.excluded,1);
 assert.equal(Bridge.preview([session(1,{date:'2026-10-12'})],{now}).counts.excluded,1);
 assert.equal(Bridge.preview([session(1,{date:'2026-02-30'})],{now}).counts.excluded,1);
 assert.equal(Bridge.preview([session(1,{createdAt:'2026-10-11T20:00:00Z'})],{now}).counts.excluded,1);
 assert.equal(Bridge.preview([session(1,{correct:999})],{now}).counts.excluded,1);
 assert.equal(Bridge.preview([session(1,{questionIds:[]})],{now}).counts.excluded,1);
 assert.equal(Bridge.preview([session(1,{goalImportStatus:'imported'})],{now}).counts.excluded,1);
 assert.equal(Bridge.preview([session(1),session(1,{id:'tt-different-event',createdAt:session(1).createdAt})],{now}).counts.hold,2);
 const duplicate=await Bridge.readGoalSnapshot(goals([{id:'log-one',sourceEventId:session(1).id,actual:true,kind:'goal-study',minutes:2,taskId:'g3-2026-10-practice',time:'2026-10-11T10:00:00Z'}]));
 assert.match(Bridge.preview([session(1)],{now,snapshot:duplicate}).rows[0].reason,/相同事件/);
 const manual=await Bridge.readGoalSnapshot(goals([{id:'log-two',source:'manual-backfill',actual:true,kind:'goal-study',minutes:3,taskId:'g3-2026-10-practice',time:'2026-10-11T09:00:00Z'}]));
 assert.match(Bridge.preview([session(1)],{now,snapshot:manual}).rows[0].reason,/同一 Level 4/);
 const missing=await Bridge.readGoalSnapshot(goals([], [['g3-2026-10-practice',{status:'已封存'}]]));
 assert.equal(Bridge.preview([session(1)],{now,snapshot:missing}).counts.hold,1);
 const outOfRange=await Bridge.readGoalSnapshot(goals([], [['g3-2026-10',{due:'2026-10-09'}]]));
 assert.equal(Bridge.preview([session(1)],{now,snapshot:outOfRange}).counts.hold,1);
 const wrongLevel=await Bridge.readGoalSnapshot(goals([], [['g3-2026-10-practice',{parent:'g3'}]]));
 assert.equal(Bridge.preview([session(1)],{now,snapshot:wrongLevel}).counts.hold,1);
 const invalid=JSON.parse(goals());invalid.data.logs.push({foo:'changed'});
 await assert.rejects(Bridge.readGoalSnapshot(JSON.stringify(invalid)),/checksum/);
 invalid.checksum=Bridge.fnv1a(Bridge.stableSerialize(invalid.data));invalid.integrity={algorithm:'SHA-256',scope:'dataPayload',digest:'a'.repeat(64)};
 await assert.rejects(Bridge.readGoalSnapshot(JSON.stringify(invalid)),/SHA-256/);
 await assert.rejects(Bridge.readGoalSnapshot(JSON.stringify({appId:Core.APP_ID,schema:1,sessions:[]})),/Goal Manager/);
 await assert.rejects(Bridge.readGoalSnapshot(goals().replace('98.13.5','98.13.5.1').replace('"schemaVersion":6','"schemaVersion":5')),/Schema 6/);
 // 100 distinct session identifiers spread over time but time range restricted to one local day.
 const hundred=Array.from({length:100},(_,i)=>session(i,{createdAt:new Date(Date.parse('2026-10-11T00:00:00Z')+i*8*60000).toISOString()}));
 assert.equal(Bridge.preview(hundred,{now}).counts.review,100);
 const bundle=Bridge.buildPacket(Bridge.preview(hundred,{now}),new Set(hundred.map(x=>x.id)));
 assert.equal(bundle.events.length,100);assert.equal(bundle.events.reduce((n,x)=>n+x.creditedMinutes,0),200);
 assert.equal(Core.KEY,'toeic-trainer-v01:learning-state'); assert.equal(Core.SCHEMA,1);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert(html.includes('id="bridgePanel"')&&html.includes('id="exportBridgeCandidates"'));
 assert(html.includes('src="./js/bridge.js?v=v0.5.0-auto-link-20261012"'));
 assert(app.includes('goalSnapshot=await Bridge.readGoalSnapshot(await file.text())'));
 assert(app.includes('goalSnapshot=null;bridgeSelected.clear()'));
 for(const blocked of ['lawLangGoalSystemV92','indexedDB.deleteDatabase(','localStorage.clear(','fetch(','localStorage.setItem(\'lawLang']){
   assert(!app.includes(blocked));assert(!fs.readFileSync(path.join(root,'js/bridge.js'),'utf8').includes(blocked));
 }
 console.log('PASS: 0 / 1 / 100 events, date/time, version, checksum, duplicates, overlap, period, manual logs, historical compatibility, no GM writes');
})().catch(error=>{console.error(error);process.exitCode=1});
