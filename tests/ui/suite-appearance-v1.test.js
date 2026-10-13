/* Shared suite appearance is presentation-only and separately persisted. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const js=read('js/settings.js'),css=read('css/design-system.css');
assert(js.includes("const SHARED_APPEARANCE_KEY='gm-suite:appearance-v1';"));
assert(js.includes('function sharedAppearancePayload()'));
assert(js.includes('function publishSharedAppearance()'));
assert(js.includes('version:1,appearance:appSettings.appearance'));
assert(js.includes('if(saved)publishSharedAppearance()'));
assert(js.includes("window.addEventListener?.('load',()=>publishSharedAppearance()"));
assert(!js.includes('toeic-trainer-v01:learning-state'));
assert(!js.includes('lawLangGoalSystemV92'));
assert(css.includes('SUITE-SETTINGS-UI-V1'));
assert(css.includes('.settings-hub-number{flex-basis:30px;height:30px'));
assert(read('index.html').includes('id="gmToeicImmersive"'));
console.log('PASS: Goal Manager appearance-only shared settings, unchanged goal data boundaries');
