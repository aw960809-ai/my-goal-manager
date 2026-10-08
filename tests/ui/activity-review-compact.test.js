'use strict';
/* UI-only source-review journal tests with synthetic catalog records.
   Does NOT touch browser persistence, real accounts, or remote sources. */
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const source=read('js/activity.js');
const css=read('css/design-system.css');
const policy=require('../../js/domain/radar-policy.js');
const base=JSON.stringify;

const latest=[
  ...Array.from({length:14},(_,i)=>({
    id:`auto-review-${i}`,title:i===0?'<img src=x onerror="steal()"> 京元電子實習':'活動 '+i,
    kind:'event',needsReview:true,missCount:i===0?2:3,
    lastSeen:'2026-10-01T04:00:00Z',source:'東海大學活動報名系統',
    url:'https://activity.thu.edu.tw/example/'+i
  })),
  ...Array.from({length:2},(_,i)=>({id:'active-'+i,title:'可推薦活動',kind:'event'}))
];
const retained=Array.from({length:8},(_,i)=>({
  id:'retained-'+i,title:'保留歷史來源 '+i,kind:'event',needsReview:true,missCount:4,
  lastSeen:'2026-09-29T04:00:00Z',source:'東海',url:i===0?'':'https://activity.thu.edu.tw/history/'+i
}));
const reference={id:'official-directory',title:'官方活動入口',kind:'reference',url:'https://activity.thu.edu.tw/',source:'THU'};
const db={activities:[...latest,...retained,reference]};
const original=JSON.stringify(db);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const box={html:'',details:null,
  get innerHTML(){return this.html},
  set innerHTML(next){this.html=next;this.details=next.includes('<details class="activity-review-disclosure">')?{open:false}:null},
  querySelector(selector){return selector==='.activity-review-disclosure'?this.details:null}
};
const doc={readyState:'loading',addEventListener(){},
  getElementById(id){return id==='activityReferences'?box:null}
};
const scope={document:doc,window:{},db,RadarPolicy:policy,esc,
  safeExternalUrl:url=>/^https:\/\//.test(url)?url:'#',setTimeout(){}};
vm.createContext(scope);
vm.runInContext(source,scope,{filename:'js/activity.js'});

assert(!source.includes('ensureActivityReviewDisclosureStyle'), 'remove the old runtime CSS injection');
assert(css.includes('GM-REVIEW-COMPACT-20261008'),'new review styles must be canonical');
assert(css.trim().endsWith('/* GM-VISUAL-PHASE3-20261008-END */'),'do not add another stylesheet layer');
assert(source.includes('<details class="activity-review-disclosure">'),'keep original disclosure structure');
assert(source.includes('暫不列入推薦 · 點擊展開'),'retain original safety and UI contract');

const rows=()=>box.html.match(/<div class="activity-review-compact-row">/g)||[];
const summary=()=>JSON.parse(vm.runInContext('JSON.stringify(activityReviewSummary())',scope));

// Before remote loaded, a user must see pending verification rather than a false zero.
vm.runInContext('renderActivityReferences()',scope);
assert.strictEqual(rows().length,5,'only the first five review records may be rendered');
assert(box.html.includes('遠端尚未核對'));
assert(box.html.includes('已顯示 5/22 項'));
assert(box.html.includes('再顯示 5 項'));
assert(box.html.includes('官方活動入口'),'public reference links must remain');
assert(box.html.includes('最後確認 2026-10-01'));
assert(box.html.includes('缺失 2 次'));
assert(box.html.includes('複核原因'),'full reason remains accessible per item');
assert(box.html.includes('target="_blank" rel="noopener noreferrer"'));
assert(box.html.includes('&lt;img src=x onerror=&quot;steal()&quot;&gt;'));
assert(!box.html.includes('<img src=x onerror='),'untrusted activity title must be escaped');
assert.strictEqual(box.details.open,false,'details must be collapsed by default');

// Load remote and switch the presentation of origin counts, never modifying db.
scope.syntheticLatest=latest;
vm.runInContext('remoteActivityCatalog=syntheticLatest;activityRemoteLoaded=true',scope);
vm.runInContext('renderActivityReferences()',scope);
assert.deepStrictEqual(summary(),{all:22,latest:14,retained:8});
assert(box.html.includes('本輪來源 14 · 本機額外保留 8'));
assert.strictEqual(rows().length,5);

// Expand and progressively load more while preserving the open state.
box.details.open=true;
for(const expected of [10,15,20,22]){
  vm.runInContext('activityShowMoreReviews()',scope);
  assert.strictEqual(rows().length,expected,`batch should grow to ${expected}`);
  assert.strictEqual(box.details.open,true,'must preserve open disclosure during updates');
  assert(box.html.includes(`已顯示 ${expected}/22 項`));
}
assert(!box.html.includes('id="activityReviewMore"'),'more button should disappear at final row');
assert(box.html.includes('無來源連結'),'rows lacking sources must be represented safely');
// Re-rendering due to changing an unrelated radar filter should not reset the journal.
vm.runInContext('renderActivityReferences()',scope);
assert.strictEqual(rows().length,22);
assert.strictEqual(box.details.open,true);
assert.strictEqual(JSON.stringify(db),original,'no activity record may be mutated or deleted');
console.log('OK: compact read-only review journal 5/10/15/20/22, XSS escaping, metadata, accessible source, disclosure state');
