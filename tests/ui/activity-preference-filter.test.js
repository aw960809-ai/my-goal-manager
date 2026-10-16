'use strict';
/* Read-only presentation contract. No real browser storage or network. */
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'../../js/activity.js'),'utf8');
const RadarPolicy=require('../../js/domain/radar-policy.js');
const scope={window:{},document:{readyState:'loading',addEventListener(){}},
  setTimeout(){},db:{activities:[]},RadarPolicy};
vm.createContext(scope);vm.runInContext(source,scope,{filename:'activity.js'});
const activity={id:'auto-moc-national-1',sourceId:'moc_national',
  title:'全國法律講座',location:'臺中市'};
function check(a){scope.fixture=a;return vm.runInContext('activityPreferenceExclusion(fixture)',scope)}
assert.strictEqual(check(activity),'');
assert(check({...activity,location:'南投縣埔里鎮'}));
assert(check({...activity,location:'彰化縣員林市'}));
assert.strictEqual(check({...activity,location:'線上直播／彰化縣'}),'');
assert.strictEqual(check({...activity,id:'my-own-calendar',location:'南投縣'}),'');
for(const [id,sid] of [['auto-law-ntu-x','ntu_law'],['auto-law-nccu-y','nccu_law'],
     ['auto-central-ch-x','changhua_government'],['auto-central-nt-y','nantou_culture']]){
   assert(check({...activity,id,sourceId:sid}));
}
scope.fixture={...activity,id:'auto-law-ntu-old',sourceId:'ntu_law'};
assert.strictEqual(vm.runInContext('activityTimeState(fixture).eligible',scope),false);
console.log('OK: auto activities follow feasible geographic preference; manual/online untouched');
