/* Goal Manager v98.13.10: stale iframe recovery; no user storage access. */
'use strict';
const assert=require('node:assert/strict');
const Embed=require('../../js/toeic-embed.js');
function node(){
  return {hidden:true,dataset:{},inert:false,listeners:{},focus(){this.focused=true},
    addEventListener(type,fn){this.listeners[type]=fn},querySelector(){return null}};
}
const launcher=node(),overlay=node(),frame=node(),back=node(),gear=node(),fallback=node(),fallbackText=node(),app=node();
const classes=new Set(),body={classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}};
const doc={activeElement:launcher,body,documentElement:{classList:{add(){},remove(){}}},
  getElementById(id){return ({homeToeicTraining:launcher,gmToeicImmersive:overlay,
    gmToeicFrame:frame,gmToeicBack:back,gmToeicSettings:gear,
    gmToeicFallback:fallback,gmToeicFallbackText:fallbackText})[id]||null},
  querySelector(selector){return selector==='.app'?app:null}};
let backCount=0,goalSyncs=0,workerUpdates=0;
const win={location:{protocol:'https:',hostname:'aw960809-ai.github.io',
    pathname:'/my-goal-manager/',origin:'https://aw960809-ai.github.io',
    href:'https://aw960809-ai.github.io/my-goal-manager/'},
  navigator:{serviceWorker:{getRegistration(){return Promise.resolve({update(){workerUpdates++;return Promise.resolve()}})}}},
  history:{state:null,pushState(v){this.state=v},back(){backCount++;this.state=null}},
  addEventListener(){},setTimeout(fn){fn()},GoalToeicSyncRuntime:{sync(){goalSyncs++}}};
const controller=Embed.attach({window:win,document:doc});
assert(controller);
launcher.listeners.click();
assert.equal(controller.isOpen(),true);
const initial=new URL(frame.src);
assert.equal(initial.pathname,'/toeic-trainer/');
assert.equal(initial.searchParams.get('gm_rev'),'98.13.10');
const fakeChild=(old,active=false)=>({
  querySelector(selector){
    if(selector==='.main-nav')return {};
    if(selector.includes('data-tab="settings"'))return old?{}:null;
    if(active&&selector.includes('#vocabSession:not([hidden])'))return {};
    return null;
  },head:{appendChild(){}},getElementById(){return null},
  createElement(){return {id:'',textContent:''}},addEventListener(){}});
frame.contentDocument=fakeChild(true);
frame.contentWindow={location:{href:initial.href}};
frame.listeners.load();
assert.notEqual(frame.src,initial.href,'stale 6-tab iframe must not stay visible');
assert(new URL(frame.src).searchParams.get('_fresh'),'only stale frame gets cache-busting URL');
frame.contentDocument=fakeChild(false);
frame.listeners.load();
assert.equal(fallback.hidden,true);
assert.equal(frame.hidden,false);
back.listeners.click();
assert.equal(controller.isOpen(),false);
assert.equal(goalSyncs,1,'existing sync-on-return remains intact');
// A previously loaded old document must be checked again on reopening.
frame.contentDocument=fakeChild(true);
const before=frame.src;
launcher.listeners.click();
assert.notEqual(frame.src,before,'reopening the cached iframe must revalidate');
frame.contentDocument=fakeChild(false);
frame.listeners.load();
back.listeners.click();
// Do not interrupt active old-version attempts: they can first submit or pause.
frame.contentDocument=fakeChild(true,true);
launcher.listeners.click();
const activeURL=frame.src;
frame.listeners.load();
assert.equal(frame.src,activeURL,'never reload an active exam');
assert.equal(frame.hidden,false);
assert.equal(goalSyncs,2,'goal study sync only occurs on explicit return');
const file=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../../js/toeic-embed.js'),'utf8');
assert(!file.includes('localStorage.setItem('));
assert(!file.includes('localStorage.clear('));
assert(!file.includes('indexedDB.deleteDatabase('));
assert(file.includes('FRAME_REV'));
console.log('PASS: stale six-tab iframe refreshed safely; active quizzes, goal logs and stored TOEIC history untouched');
