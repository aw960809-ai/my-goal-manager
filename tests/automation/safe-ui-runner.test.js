'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const root=path.resolve(__dirname,'../..');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/safe-ui-auto-merge.yml'),'utf8');
const marker='          script: |\n';
const index=workflow.indexOf(marker);
assert(index>=0,'github-script step must exist');
const lines=workflow.slice(index+marker.length).split('\n');
const indent=lines.find(x=>x.trim()).match(/^\s*/)[0].length;
const script=lines.map(x=>x.startsWith(' '.repeat(indent))?x.slice(indent):x).join('\n');
const execute=new AsyncFunction('github','context','core','require',script);
process.env.GITHUB_WORKSPACE=root;
const include=request=>require(request);
const SHA='f'.repeat(40);
const basePr={number:4,state:'open',draft:false,user:{login:'aw960809-ai'},base:{ref:'main'},
  head:{sha:SHA,ref:'auto/ui-font',repo:{full_name:'aw960809-ai/my-goal-manager'}},
  labels:[{name:'safe-auto-merge'}]};
const baseRun={event:'pull_request',conclusion:'success',head_sha:SHA,pull_requests:[{number:4}]};
const baseFiles=[{filename:'css/tokens.css',status:'modified',changes:4}];
function harness({event='workflow_run',pr=basePr,run=baseRun,files=baseFiles,behind=0,verified=true,latest=pr}={}){
  const calls=[];
  const core={notice:x=>calls.push(['notice',x]),warning:x=>calls.push(['warning',x])};
  const github={
    paginate:async()=>files,
    rest:{
      pulls:{get:async()=>({data:calls.some(x=>x[0]==='get')?latest:pr, ...(calls.push(['get']),{})}),
        listFiles:()=>{},merge:async(args)=>{calls.push(['merge',args.sha]);return {data:{merged:true}}}},
      checks:{listForRef:async()=>({data:{check_runs:verified?[{name:'verify',status:'completed',conclusion:'success',
        head_sha:SHA,app:{slug:'github-actions'},pull_requests:[{number:4}]}]:[]}})},
      repos:{compareCommitsWithBasehead:async()=>({data:{behind_by:behind}})},
      actions:{createWorkflowDispatch:async(args)=>{calls.push(['dispatch',args.workflow_id]);return {}}}
    }
  };
  const context={eventName:event,payload:event==='workflow_run'?{workflow_run:run}:{pull_request:pr,label:{name:'safe-auto-merge'}},
    repo:{owner:'aw960809-ai',repo:'my-goal-manager'}};
  return {calls,run:()=>execute(github,context,core,include)};
}
(async()=>{
  const ok=harness();await ok.run();assert(ok.calls.some(x=>x[0]==='merge'));assert(ok.calls.some(x=>x[0]==='dispatch'&&x[1]==='pages.yml'));
  for(const cfg of [
    {files:[{filename:'js/data/persistence.js',status:'modified',changes:1}]},
    {pr:{...basePr,labels:[]}},
    {pr:{...basePr,user:{login:'untrusted'}}},
    {run:{...baseRun,conclusion:'failure'}},
    {behind:1},
    {latest:{...basePr,head:{...basePr.head,sha:'b'.repeat(40)}}},
    {event:'pull_request_target',verified:false},
  ]){
    const res=harness(cfg);await res.run();
    assert(!res.calls.some(x=>x[0]==='merge'),`unexpected merge for ${Object.keys(cfg).join(',')}`);
    assert(!res.calls.some(x=>x[0]==='dispatch'));
  }
  const label=harness({event:'pull_request_target'});await label.run();
  assert(label.calls.some(x=>x[0]==='merge'));
  assert(label.calls.some(x=>x[0]==='dispatch'));
  console.log('OK: privileged workflow simulations merge only safe, fully tested latest-head PRs');
})().catch(err=>{console.error(err);process.exit(1)});
