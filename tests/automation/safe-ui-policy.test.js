'use strict';
const assert=require('assert');
const {eligible,safePath,MAX_CHANGED_LINES}=require('../../scripts/automation/safe-ui-policy.cjs');
const owner='aw960809-ai',repo='my-goal-manager';
const sha='a'.repeat(40);
const pr={number:7,state:'open',draft:false,base:{ref:'main'},user:{login:owner},
  head:{sha,ref:'auto/ui-font-20261008',repo:{full_name:`${owner}/${repo}`}},
  labels:[{name:'safe-auto-merge'}]};
const files=[{filename:'css/design-system.css',status:'modified',changes:32},
  {filename:'js/ui/pages/dashboard-page.js',status:'modified',changes:48},
  {filename:'tests/ui/dashboard-page.test.js',status:'modified',changes:13}];
const run={event:'pull_request',conclusion:'success',head_sha:sha,
  pull_requests:[{number:7}]};
const decision=eligible({pr,files,owner,repo,run});
assert(decision.ok,decision.reason);
for(const filepath of ['js/app.js','js/store.js','js/data/persistence.js','js/domain/study-logs.js',
  'config/version.js','config/system-config.js','index.html','sw.js',
  '.github/workflows/pages.yml','tests/integration/data-boundary.test.js',
  'data/events.json','apps/toeic/app.js','../css/app.css','css/../js/app.js']){
  assert(!safePath(filepath),`should protect ${filepath}`);
  const answer=eligible({pr,owner,repo,run,files:[{filename:filepath,status:'modified',changes:1}]});
  assert(!answer.ok,`must refuse ${filepath}`);
}
for(const fp of ['css/app-ui.css','js/ui/pages/analytics-page.js','assets/suite-icons/a/icon.svg',
  'tests/ui/analytics-page.test.js','docs/ARCHITECTURE.md','README.md']){
  assert(safePath(fp),`expected UI file ${fp}`);
}
const change=(patch)=>eligible({owner,repo,run,pr:{...pr,...patch},files});
assert(!change({draft:true}).ok);
assert(!change({user:{login:'untrusted'}}).ok);
assert(!change({base:{ref:'release'}}).ok);
assert(!change({head:{...pr.head,ref:'fix/time-sync'}}).ok);
assert(!change({head:{...pr.head,repo:{full_name:'untrusted/fork'}}}).ok);
assert(!change({labels:[]}).ok);
assert(!eligible({pr,files,owner,repo,run:{...run,conclusion:'failure'}}).ok);
assert(!eligible({pr,files,owner,repo,run:{...run,head_sha:'b'.repeat(40)}}).ok);
assert(!eligible({pr,files,owner,repo,run:{...run,pull_requests:[]}}).ok);
assert(!eligible({pr,files:[{filename:'css/x.css',status:'removed',changes:1}],owner,repo,run}).ok);
assert(!eligible({pr,files:[{filename:'css/x.css',status:'renamed',changes:1}],owner,repo,run}).ok);
assert(!eligible({pr,files:[{filename:'css/x.css',status:'modified',changes:MAX_CHANGED_LINES+1}],owner,repo,run}).ok);
assert(!eligible({pr,files:Array.from({length:26},(_,i)=>({filename:`css/x${i}.css`,status:'added',changes:1})),owner,repo,run}).ok);
assert(!eligible({pr,files:[],owner,repo,run}).ok);
console.log('OK: safe UI auto-merge policy blocks sensitive changes, untrusted PRs and stale checks');
