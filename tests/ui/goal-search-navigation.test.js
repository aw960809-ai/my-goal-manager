'use strict';
/* Android search disclosure & existing hierarchical back-button UI contract. */
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html');
const js=read('js/refinements.js');
const css=read('css/refinements.css');
const app=read('js/app.js');
const sw=read('sw.js');
const version=read('config/version.js');

// The original button/handler are reused; no new persistent UI navigation state.
assert(html.includes('id="goalBrowseUp"'));
assert(html.includes('onclick="browseGoalUp()"'));
assert(js.includes("const up=byId('goalBrowseUp');"));
assert(js.includes("locationMeta.append(up,count);"));
assert(js.includes('location.append(breadcrumbs,locationMeta);'));
assert(js.includes('up.hidden=isRoot;'));
assert(js.includes('toolbar.replaceChildren(location,add);'));
assert(app.includes('function browseGoalUp(){'));
assert(app.includes("browseGoalTo(current.parent||'')"));
assert(css.includes('#goals .gm-goal-location-meta{'));
assert(css.includes('#goals .gm-goal-toolbar #goalBrowseUp{'));
assert(css.includes('#goals .gm-goal-toolbar #goalBrowseUp[hidden]{display:none!important}'));

// All four existing Android disclosure guards now include goal search.
const start=css.indexOf('/* GM-V98.13.4: prevent Android native blue touch highlight');
assert(start!==-1);
const hotfix=css.slice(start);
assert.strictEqual(hotfix.split('#goals .gm-goal-search > summary').length-1,4);
assert(hotfix.includes('-webkit-tap-highlight-color: transparent !important;'));
assert(hotfix.includes('-webkit-user-select: none !important;'));
assert(hotfix.includes('touch-action: manipulation;'));
assert(hotfix.includes(':focus:not(:focus-visible)'));
assert(hotfix.includes(':focus-visible'));
assert(hotfix.includes('var(--gm-focus'));
assert(!hotfix.includes('999px'));
assert(!hotfix.includes('localStorage'));
assert(!hotfix.includes('db.logs'));
assert(version.includes("GOAL_MANAGER_VERSION='98.13.9'"));
assert(version.includes('GOAL_MANAGER_SCHEMA_VERSION=6'));
assert(sw.includes("'./css/refinements.css'"));
assert(sw.includes("'./js/refinements.js'"));
console.log('OK: goal search Android tap feedback, hierarchy back navigation and unchanged data boundary');
