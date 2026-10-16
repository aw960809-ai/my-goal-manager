'use strict';
/* Entirely synthetic, no browser storage or production data mutation. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'../..');
const code=fs.readFileSync(path.join(root,'js/autofetch-status.js'),'utf8');
const activity=fs.readFileSync(path.join(root,'js/activity.js'),'utf8');
const now=new Date().toISOString();
const a={meta:{updatedAt:now,totalSources:8,healthySources:8,failedSources:0,
  nationalExpansionSources:2,nationalExpansionHealthy:2,nationalExpansionActive:3,
  nationalExpansionFreshEligible:3,nationalExpansionDiscovered:89},events:[]};
const s={meta:{updatedAt:now,categories:5,healthyCategories:5,failedCategories:0},scholarships:[]};
let output='';
const body={insertAdjacentHTML(_mode,html){output=html},querySelectorAll(){return []},appendChild(){}};
const document={readyState:'loading',addEventListener(){},head:{appendChild(){}},createElement(){return {}},
 getElementById(id){return id==='settingsBody'?body:null}};
const window={AppConfig:{data:{activities:'./data/activities.json',scholarships:'./data/scholarships.json'}},addEventListener(){}};
const context={window,document,Date,Intl,console,setTimeout(){},setInterval(){return 1},
 fetch:async url=>({ok:true,json:async()=>url.includes('scholarship')?s:a})};
vm.createContext(context);vm.runInContext(code,context);
(async()=>{
 const state=await window.GoalManagerAutoFetchStatus.refresh();
 assert.equal(state.activity.sources.total,8);
 assert.equal(state.activity.nationalExpansion.active,3);
 assert.equal(state.activity.nationalExpansion.healthy,2);
 assert(output.includes('全國新來源（線上徵件／競賽）'));
 assert(output.includes('本輪 3 筆 · 來源 2/2'));
 assert(activity.includes("a.dateKind==='application_deadline'?'徵件截止 ':''"));
 console.log('OK: nationwide metadata + deadline semantics, no user data change');
})().catch(e=>{console.error(e);process.exitCode=1});
