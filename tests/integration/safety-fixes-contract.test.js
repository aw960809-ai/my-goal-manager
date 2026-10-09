/* Safety hardening regressions. This file uses only synthetic data. */
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
assert.ok(read('config/version.js').includes("GOAL_MANAGER_VERSION='98.13.4'"));

// A storage adapter may keep an emergency memory copy, but may not claim success.
const srcStore=read('js/store.js');
const context={
  localStorage:{
    setItem(){throw new Error('quota exceeded')},
    getItem(){throw new Error('quota exceeded')}
  },
  Date
};
vm.createContext(context);
vm.runInContext(srcStore,context);
assert.strictEqual(vm.runInContext("storeSet('example','payload')",context),false);
assert.strictEqual(vm.runInContext("storeGet('example')",context),'payload');
assert.strictEqual(vm.runInContext('storeWriteStatus().persistent',context),false);

// The app may never seed-overwrite an unreadable primary or other recoverable slot.
const app=read('js/app.js');
assert.match(app,/let persistenceRecoveryBlocked=false/);
assert.match(app,/if\(persistenceRecoveryBlocked\)throw new Error/);
assert.match(app,/storedKeys\.some\(k=>storeGet\(k\)!==null\)/);
assert.match(app,/if\(persistenceRecoveryBlocked\)return false/);
assert.match(app,/if\(persistenceRecoveryBlocked\|\|!initialPersonalSaveOk\)return 0/);
assert.match(app,/reg\.scope!==intendedScope/);
assert.match(app,/key\.startsWith\('thu-goal-personal-v'\)/);
assert.match(app,/db\.logs=previousLogs/);

// A previously configured TOEIC plan must keep its user-defined values on reload.
const toeic=require('../../js/domain/toeic-plan.js');
const tasks=[{id:'g3',name:'語言能力',level:1,parent:null,status:'進行中',weeklyMinutes:0,start:'',due:''}];
assert.strictEqual(toeic.apply(tasks).applied,true);
const action=tasks.find(x=>x.id==='g3-2026-10-article');
assert.ok(action);
action.weeklyMinutes=99;
action.name='我的學習項目';
const second=toeic.apply(tasks);
assert.strictEqual(second.applied,false);
assert.strictEqual(action.weeklyMinutes,99);
assert.strictEqual(action.name,'我的學習項目');

// Publishing must include every root + nested suite icon referenced by SW/manifest.
const pages=read('.github/workflows/pages.yml');
assert.match(pages,/cp -r css js config data assets _site\//);
for(const file of ['suite-icon-release.json','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png']){
 assert.ok(pages.includes(file),`Pages build omitted ${file}`);
}
assert.ok(pages.includes('_site/assets/suite-icons/20261005a/icon-192.png'));
assert.ok(pages.includes('_site/assets/suite-icons/20261005a/icon-maskable-512.png'));

// Coverage is tracked alongside activity and scholarship catalogs.
const auto=read('.github/workflows/autofetch.yml');
assert.ok(auto.includes('git add data/activities.json data/scholarships.json data/activity-archive.json data/scholarship-archive.json data/activity-source-coverage.json'));
assert.ok(auto.includes('if git diff --quiet -- data/activities.json data/scholarships.json data/activity-archive.json data/scholarship-archive.json data/activity-source-coverage.json'));
assert.ok(auto.includes('if ! git diff --quiet; then'));
console.log('OK: protected recovery, storage fallback, user-owned TOEIC, deployment icons, AutoFetch');
