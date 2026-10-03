const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const source=fs.readFileSync(
  path.join(__dirname,'../../js/bootstrap.js'),
  'utf8'
);

const calls=[];
const window={
  renderAll:()=>calls.push('renderAll'),
  dashboard:()=>{},
  renderGoalsPage:()=>{},
  today:()=>{},
  renderActivities:()=>{},
  renderScholarships:()=>{},
  renderCalendar:()=>{},
  stats:()=>{},
  storeGet:()=>null,
  storeSet:()=>true,
  save:()=>true,
  exportDB:()=>{},
  importDB:()=>{},
  activityStore:()=>[],
  scholarshipStore:()=>[],
  catalogItemById:()=>null,
  validateData:()=>[],
  validateDB:()=>[],
  makeEnvelope:data=>({data}),
  parseEnvelope:raw=>JSON.parse(raw),
  fnv1a:()=> '00000000',
  clearApplicationCaches:()=>{},
  clearCacheOnly:()=>{},
  runSelfTest:()=>{},
  auditButtonHandlers:()=>({ok:true}),
  auditCoreModules:()=>({ok:true}),
  auditDataRoundTrip:()=>({ok:true}),
  auditDOM:()=>({ok:true}),
  PWA:{
    register:()=>calls.push('pwa')
  }
};

const context={
  window,
  navigator:{},
  document:{
    readyState:'complete',
    addEventListener:()=>{}
  },
  setTimeout:fn=>fn()
};

vm.runInNewContext(source,context);

assert.deepStrictEqual(calls,['renderAll','pwa']);
assert.strictEqual(window.__goalManagerBooted,true);
assert(window.AppCore);
assert(window.AppModules);

assert.strictEqual(
  window.AppModules.dashboard.render,
  window.dashboard
);
assert.strictEqual(
  window.AppModules.goals.render,
  window.renderGoalsPage
);
assert.strictEqual(
  window.AppModules.execution.render,
  window.today
);
assert.strictEqual(
  window.AppModules.analytics.render,
  window.stats
);

vm.runInNewContext(source,context);
assert.deepStrictEqual(
  calls,
  ['renderAll','pwa'],
  'bootstrap must run only once'
);

console.log('OK: bootstrap renders once and exposes page-specific modules');
