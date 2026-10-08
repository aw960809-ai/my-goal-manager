'use strict';
/* Synthetic regression only. Never reads or changes user browser storage. */
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.join(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const source=read('js/activity.js');
const healthSource=read('js/autofetch-health.js');
const statusSource=read('js/autofetch-status.js');
const policy=require('../../js/domain/radar-policy.js');

async function main(){
  // Simulate the mismatch observed on 2026-10-08: 14 current remote review
  // rows plus 8 retained only on this device. Stored rows must not be mutated.
  const latest=[
    ...Array.from({length:14},(_,i)=>({id:`auto-latest-${i}`,needsReview:true,missCount:2})),
    ...Array.from({length:7},(_,i)=>({id:`auto-good-${i}`,needsReview:false}))
  ];
  const retained=Array.from({length:8},(_,i)=>({id:`auto-retained-${i}`,needsReview:true,missCount:3}));
  const db={activities:[...latest,...retained]};
  const unchanged=JSON.stringify(db);
  const scope={window:{},document:{readyState:'loading',addEventListener(){}},setTimeout(){},db,RadarPolicy:policy};
  vm.createContext(scope);
  vm.runInContext(source,scope,{filename:'activity.js'});
  let before=JSON.parse(vm.runInContext('JSON.stringify(activityReviewSummary())',scope));
  assert.deepStrictEqual(before,{all:22,latest:null,retained:null},'unloaded remote must not imply zero reviewed rows');
  scope.syntheticLatest=latest;
  vm.runInContext('remoteActivityCatalog=syntheticLatest;activityRemoteLoaded=true',scope);
  const after=JSON.parse(vm.runInContext('JSON.stringify(activityReviewSummary())',scope));
  assert.deepStrictEqual(after,{all:22,latest:14,retained:8});
  assert.strictEqual(JSON.stringify(db),unchanged,'render-only summary must leave all stored activities untouched');
  vm.runInContext('activityRemoteLoaded=false',scope);
  assert.strictEqual(vm.runInContext('activityReviewSummary().latest',scope),null);
  assert(source.includes('本輪來源 ${review.latest} · 本機額外保留 ${review.retained}'));
  assert(source.includes('來源健康 ${activityAutoMeta.healthySources'));
  assert(source.includes('項目抓取失敗 ${activityAutoMeta.fetchFailedItems'));

  const time=new Date().toISOString();
  const activities={meta:{updatedAt:time,totalSources:5,healthySources:5,failedSources:0,
      fetchFailedItems:1,failed:1,ok:15,needsReview:14},events:latest};
  const scholarships={meta:{updatedAt:time,categories:5,healthyCategories:5,failedCategories:0,
      eligibilityDetail:{detailVerified:70,detailUnverified:0}},scholarships:[{id:'scholarship-fixture'}]};
  const payload={activities,scholarships};
  function mock(script){
    const host={rendered:''};
    const settingsBody={insertAdjacentHTML(_place,html){host.rendered=html},querySelectorAll(){return []},appendChild(){}};
    const document={readyState:'loading',addEventListener(){},head:{appendChild(){}},createElement(){return {style:{}}},
      getElementById(id){return id==='settingsBody'?settingsBody:null}};
    const window={AppConfig:{version:'V98.11.6',data:{activities:'./data/activities.json',scholarships:'./data/scholarships.json'}},addEventListener(){}};
    const sandbox={document,window,navigator:{onLine:true},setTimeout(){},setInterval(){return 1},clearInterval(){},
      fetch:async url=>({ok:true,json:async()=>url.includes('scholarship')?payload.scholarships:payload.activities}),
      Date,Intl,console};
    vm.createContext(sandbox);
    vm.runInContext(script,sandbox);
    return {window,host};
  }
  const health=mock(healthSource);
  const healthState=await health.window.GoalManagerAutoFetchHealth.refresh();
  assert.strictEqual(healthState.activities.sources,5);
  assert.strictEqual(healthState.activities.healthy,5);
  assert.strictEqual(healthState.activities.failed,0,'item failure must not be called a failed source');
  assert.strictEqual(healthState.activities.itemFailures,1);
  assert.strictEqual(healthState.activities.warning,true);
  assert.strictEqual(healthState.overall,'warning','one item failure should produce a partial warning');

  const status=mock(statusSource);
  const statusState=await status.window.GoalManagerAutoFetchStatus.refresh();
  assert.strictEqual(statusState.activity.sources.failed,0);
  assert.strictEqual(statusState.activity.itemFailures,1);
  assert(status.host.rendered.includes('部分項目抓取失敗'));
  assert(status.host.rendered.includes('個別項目抓取失敗'));
  assert(status.host.rendered.includes('5/5'));
  payload.activities.meta.fetchFailedItems=0;
  payload.activities.meta.failed=0;
  const clean=await health.window.GoalManagerAutoFetchHealth.refresh();
  assert.strictEqual(clean.overall,'healthy');
  const cleanPanel=await status.window.GoalManagerAutoFetchStatus.refresh();
  assert.strictEqual(cleanPanel.activity.itemFailures,0);
  assert(!status.host.rendered.includes('個別項目抓取失敗'));
  assert.strictEqual(JSON.stringify(db),unchanged);
  console.log('OK: source 5/5 != item timeout 1; 14 current + 8 retained = 22; no personal-data mutation');
}
main().catch(e=>{console.error(e);process.exitCode=1});
