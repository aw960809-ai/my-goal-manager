'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const wf=fs.readFileSync(path.join(root,'.github/workflows/safe-ui-auto-merge.yml'),'utf8');
const verify=fs.readFileSync(path.join(root,'.github/workflows/pr-safety-check.yml'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
for(const expected of [
  'workflow_run:', 'pull_request_target:',
  'Goal Manager PR Safety Check','types: [labeled]',
  'pull-requests: write','actions: write','checks: read',
  'persist-credentials: false','safe-ui-policy.cjs',
  'compareCommitsWithBasehead','latest.head.sha!==pr.head.sha',
  "check.conclusion==='success'",'github.rest.pulls.merge',
  'github.rest.actions.createWorkflowDispatch',"workflow_id:'pages.yml'"
])assert(wf.includes(expected),`missing safety gate: ${expected}`);
assert(verify.includes('run: bash scripts/verify.sh'));
assert(sw.includes('networkFirst(request)'),'UI updates should be network first');
console.log('OK: auto-merge workflow checks latest PR, explicitly dispatches Pages');
