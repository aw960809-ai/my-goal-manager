'use strict';
/* No user storage or network. Verify historical bad record stays hidden. */
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'js/activity.js'),'utf8');
const refinements=fs.readFileSync(path.join(root,'js/refinements.js'),'utf8');
const status=fs.readFileSync(path.join(root,'js/autofetch-status.js'),'utf8');
const scope={window:{},document:{readyState:'loading',addEventListener(){}},
  setTimeout(){},db:{activities:[]},RadarPolicy:require('../../js/domain/radar-policy.js')};
vm.createContext(scope);
// This isolated VM loads activity.js without app.js, which normally supplies
// todayKey(). Supply a deterministic clock for the test; do not change app code.
scope.todayKey=()=> '2026-10-16';
vm.runInContext(source,scope,{filename:'activity.js'});
scope.fixture={id:'auto-thu-2026080007',title:'*注意事項： 1.報名人員不提供午膳'};
assert.strictEqual(vm.runInContext('activityTimeState(fixture).eligible',scope),false);
scope.fixture={id:'auto-thu-2026080007',title:'國科會哲學學門成果發表會',
  date:'2026-11-20',kind:'event',available:true};
assert.strictEqual(vm.runInContext('activityTimeState(fixture).eligible',scope),true);
scope.fixture={id:'g03',title:'法國企業國際實習 VIE',date:'',deadline:'',kind:'plan'};
assert.strictEqual(vm.runInContext('activityTimeState(fixture).eligible',scope),false);
scope.fixture={id:'manual-note',title:'我的個人計畫',date:'',deadline:'',kind:'plan'};
assert.strictEqual(vm.runInContext('activityTimeState(fixture).eligible',scope),true);
assert(refinements.includes("GoalManagerAutoFetchStatus?.status?.()?.activity?.sources"));
assert(refinements.includes("window.addEventListener('goal-manager:autofetch-status-refreshed'"));
assert(status.includes("new window.CustomEvent('goal-manager:autofetch-status-refreshed')"));
console.log('OK: malformed THU cache hidden; undated built-in plan now reference; health badge sync contract');
