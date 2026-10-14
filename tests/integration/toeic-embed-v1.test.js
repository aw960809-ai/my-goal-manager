/* Immersive TOEIC entry must remain UI-only and preserve the separate PWA. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const src=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=src('index.html'),runtime=src('js/toeic-sync-runtime.js');
const policy=src('js/domain/toeic-sync-policy.js'),css=src('css/toeic-embed.css');
const Embed=require('../../js/toeic-embed.js');
assert(html.includes('id="homeToeicTraining"'),'new entrance should live on home');
assert(html.includes('id="gmToeicImmersive"'),'host must be a separate immersive overlay');
assert(html.includes('id="gmToeicBack"'),'back control must be available');
assert(html.includes('src="about:blank"'),'iframe must not load TOEIC before the user opens it');
assert(html.includes('js/toeic-embed.js'));
assert(html.includes('css/toeic-embed.css'));
assert(!runtime.includes("a.href='/toeic-trainer/';"),'old goal-browser training link should be removed');
assert(runtime.includes("const msg=document.createElement('span');"),'sync status remains');
assert(runtime.includes("window.GoalToeicSyncRuntime=Object.freeze({sync,status:()=>lastSummary});"));
assert(policy.includes("const TRAINER_KEY='toeic-trainer-v01:learning-state'"));
assert(/gm-toeic-overlay\[hidden\]/.test(css));
assert(/body\.gm-toeic-immersive \.bottom-nav\{display:none!important\}/.test(css));
assert.equal(Embed.TRAINER_PATH,'/toeic-trainer/');
assert.equal(Embed.isHosted({protocol:'https:',hostname:'aw960809-ai.github.io',pathname:'/my-goal-manager/'}),true);
assert.equal(Embed.isHosted({protocol:'http:',hostname:'127.0.0.1',pathname:'/my-goal-manager/'}),false);
assert.equal(Embed.isHosted({protocol:'https:',hostname:'other.example',pathname:'/my-goal-manager/'}),false);
function element(){return {hidden:true,inert:false,dataset:{},listeners:{},focus(){this.focused=true},addEventListener(type,fn){this.listeners[type]=fn}}}
const launcher=element(),overlay=element(),frame=element(),back=element(),fallback=element(),fallbackText=element(),app=element();
const classes=new Set();
const body={classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)}};
const doc={activeElement:launcher,body,documentElement:{classList:{add:v=>classes.add('html:'+v),remove:v=>classes.delete('html:'+v)}},
 getElementById(id){return ({homeToeicTraining:launcher,gmToeicImmersive:overlay,gmToeicFrame:frame,
 gmToeicBack:back,gmToeicFallback:fallback,gmToeicFallbackText:fallbackText})[id]||null},
 querySelector(sel){return sel==='.app'?app:null}};
let pushed=0,backed=0,synced=0;
const events={};
const win={location:{protocol:'https:',hostname:'aw960809-ai.github.io',pathname:'/my-goal-manager/',origin:'https://aw960809-ai.github.io',href:'https://aw960809-ai.github.io/my-goal-manager/'},
 history:{state:null,pushState(v){pushed++;this.state=v},back(){backed++;this.state=null}},
 addEventListener(type,fn){events[type]=fn},GoalToeicSyncRuntime:{sync(){synced++}}};
const controller=Embed.attach({window:win,document:doc});
assert(controller);
launcher.listeners.click();
assert.equal(controller.isOpen(),true);
assert.equal(overlay.hidden,false);
assert.equal(app.inert,true);
const trainerUrl=new URL(frame.src);
assert.equal(trainerUrl.origin,'https://aw960809-ai.github.io');
assert.equal(trainerUrl.pathname,'/toeic-trainer/');
assert.equal(trainerUrl.searchParams.get('gm_rev'),'98.13.10');
assert.equal(pushed,1);
assert(classes.has('gm-toeic-immersive'));
back.listeners.click();
assert.equal(controller.isOpen(),false);
assert.equal(overlay.hidden,true);
assert.equal(app.inert,false);
assert.equal(backed,1);
assert.equal(synced,1);
launcher.listeners.click();
assert.equal(pushed,2);
events.popstate();
assert.equal(controller.isOpen(),false);
assert.equal(backed,1,'Android back should only dismiss overlay, not navigate twice');
assert.equal(synced,2);
assert.equal(launcher.focused,true);
// Existing Trainer link back to Goal Manager must not nest a second Goal Manager
// inside the iframe (same-origin capture only, no child database access).
let childClick=null;
frame.contentDocument={querySelector:sel=>sel==='.main-nav'?{}:null,
 addEventListener:(type,fn)=>{if(type==='click')childClick=fn}};
frame.contentWindow={location:{href:'https://aw960809-ai.github.io/toeic-trainer/'}};
launcher.listeners.click();
frame.listeners.load();
assert.equal(fallback.hidden,true);
assert.equal(frame.hidden,false);
let prevented=0;
childClick({target:{closest:()=>({href:'https://aw960809-ai.github.io/my-goal-manager/'})},
 preventDefault(){prevented++}});
assert.equal(prevented,1,'child back-link should be handled inside the embedded host');
assert.equal(controller.isOpen(),false);
assert.equal(synced,3,'returning from child link should reconcile newest events');
assert(!html.includes('iframe src="./apps/toeic-trainer/"'),'never use retired embedded copy');
console.log('PASS: immersive TOEIC entry, true full-viewport host, safe back, separate PWA, sync runtime preserved');
