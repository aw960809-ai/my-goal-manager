'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const app=read('js/app.js');
const before=app.indexOf("byId('backToVocabHome')?.addEventListener('click'");
const after=app.indexOf("byId('continuePractice').onclick=",before);
assert(before>=0&&after>before);
const handler=app.slice(before,after);
for(const signal of ["event.preventDefault()",'event.stopImmediatePropagation()',"tab('vocab')",
 "page.hidden=page!==vocabPage", "byId('analysisSwitcher').hidden=true",
 "button.dataset.tab==='vocab'", "currentTab='vocab'", 'holder.hidden=true',
 'syncVocabView()', "window.scrollTo({top:0", 'requestAnimationFrame(()=>'])
 assert(handler.includes(signal), 'Missing explicit return guard: '+signal);
const routeBeforeRemoval=handler.indexOf("tab('vocab')")<handler.indexOf('holder.replaceChildren()');
assert(routeBeforeRemoval,'Must navigate before disposing result DOM');
for(const forbidden of ['persist(', 'next.sessions.push(', 'state.sessions=', 'deleteDraft()', 'startVocab()',
 'localStorage.setItem(', 'localStorage.removeItem(', "tab('analysis')", "tab('mistakes')", "tab('history')"])
 assert(!handler.includes(forbidden),'Return must not mutate study data or route to analysis: '+forbidden);
const history=app.slice(app.indexOf("byId('historyAfterPractice').onclick="),app.indexOf('lastCompletedReview=',app.indexOf("byId('historyAfterPractice').onclick=")));
assert(history.includes("tab('history')"),'Learning record must navigate to History, not Mistakes');
const retry=app.slice(app.indexOf("byId('continuePractice').onclick="),app.indexOf("byId('historyAfterPractice').onclick="));
assert(retry.includes('startVocab()'),'Retake starts a new draft, not a replayed completed review');
assert(read('js/core.js').includes("const VERSION='0.5.0'"));
assert(read('sw.js').includes("const VERSION='toeic-trainer-v0.5.0'"));
assert(read('index.html').includes('v0.5.0-auto-link-20261012'));
for(const f of ['data/content.js','data/advanced.js','data/v04_bank.js','data/v041_progression.js','data/v042_official.js','js/exam.js','js/bridge.js']){
 const digest=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
 const original={
  'data/content.js':'c57f758c1e978e817397fbb76f54bbb2f8dd55f8d3600974ed0140af5d78cd4d',
  'data/advanced.js':'dd421a186fca24ec6eff3553e25401fa16f31aa0ca51b73da5dc8fb1e5781a6f',
  'data/v04_bank.js':'56a77021c51b31450e0722c0599a5406e54c0d887feecda3b73ba329020440f5',
  'data/v041_progression.js':'2d0958ac4cd3b618ce460b58e6627dc6ec9280433dd671eae6cf39482e211ba5',
  'data/v042_official.js':'f47e870da1fb1b43c5e76664a9bfadf805cd53c28bf6a981c723ff0a83822ea4',
  'js/exam.js':'2d1ac55e1a1d41680a103babd99333e0d3144760b29bf56fe3c4530003f5ebc6',
  'js/bridge.js':'9ccfd3781ebcb585e23168bbbbe13d7cd72fd6489f8c35ce3c0dd7b7e5dcfc6d'
 }[f];
 assert.equal(digest,original,'Immutable: '+f);
}
console.log('PASS: submitted vocab return enforces only vocab active, analysis hidden, independent history/retake and unchanged bank.');
