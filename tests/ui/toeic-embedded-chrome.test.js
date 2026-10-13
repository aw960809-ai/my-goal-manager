/* Embedded TOEIC loses duplicate masthead only inside Goal Manager. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const html=read('index.html'),css=read('css/toeic-embed.css'),js=read('js/toeic-embed.js');
assert(html.includes('id="gmToeicBack"'));
assert(html.includes('class="gm-toeic-toolbar-label"'));
assert(js.includes("const skinId='gmToeicEmbeddedChromeV1'"));
assert(js.includes("skin.textContent='.masthead{display:none!important}'"));
assert(js.includes('child.head.appendChild(skin)'));
assert(js.includes("if(!child?.querySelector('.main-nav'))"));
assert(js.includes("window.GoalToeicSyncRuntime?.sync?.('trainer-embedded-return')"));
assert(!js.includes('localStorage.setItem('));
assert(css.includes('EMBEDDED-TOEIC-CHROME-FIX'));
console.log('PASS: embedded TOEIC toolbar is compact and independent PWA untouched');
