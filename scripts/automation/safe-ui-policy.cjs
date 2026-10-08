'use strict';
/*
 * Low-risk PR auto-merge allowlist for the THU personal Goal Manager.
 * This is a merge eligibility check, not a security review of UI code.
 * Unlisted paths ALWAYS require manual review. No persisted data is read.
 */
const LABEL='safe-auto-merge';
const MAX_FILES=25;
const MAX_CHANGED_LINES=600;

const SAFE_PATHS=[
  /^css\/[a-zA-Z0-9_./-]+\.css$/,
  /^js\/ui\/pages\/[a-zA-Z0-9_-]+\.js$/,
  /^js\/navigation\.js$/,
  /^js\/ui-feedback\.js$/,
  /^tests\/ui\/[a-zA-Z0-9_./-]+\.test\.js$/,
  /^docs\/[a-zA-Z0-9_./-]+\.md$/,
  /^assets\/[a-zA-Z0-9_./-]+\.(?:svg|png|webp)$/,
  /^README\.md$/
];
function safePath(path){
  return typeof path==='string' &&
    !path.includes('..') &&
    SAFE_PATHS.some(rule=>rule.test(path));
}
function eligible({pr,files,owner,repo,run=null}){
  if(!pr||!owner||!repo)return {ok:false,reason:'missing PR/repository metadata'};
  if(pr.state!=='open'||pr.draft)return {ok:false,reason:'PR is closed or draft'};
  if(pr.base?.ref!=='main')return {ok:false,reason:'target is not main'};
  if(pr.user?.login?.toLowerCase()!==owner.toLowerCase())return {ok:false,reason:'PR author is not repo owner'};
  if(pr.head?.repo?.full_name?.toLowerCase()!==`${owner}/${repo}`.toLowerCase())return {ok:false,reason:'fork PR is not eligible'};
  if(!/^auto\/ui-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(pr.head?.ref||''))return {ok:false,reason:'branch does not have the safe UI prefix'};
  if(!pr.labels?.some(x=>x.name===LABEL))return {ok:false,reason:'explicit opt-in label is missing'};
  if(!/^[0-9a-f]{40}$/i.test(pr.head?.sha||''))return {ok:false,reason:'head commit SHA invalid'};
  if(run){
    if(run.event!=='pull_request'||run.conclusion!=='success'||run.head_sha!==pr.head.sha){
      return {ok:false,reason:'safety check did not succeed on the latest head'};
    }
    if(!run.pull_requests?.some(x=>Number(x.number)===Number(pr.number))){
      return {ok:false,reason:'workflow run is not associated with this PR'};
    }
  }
  if(!Array.isArray(files)||files.length===0||files.length>MAX_FILES)return {ok:false,reason:'unexpected changed file count'};
  let changes=0;
  for(const file of files){
    if(!safePath(file.filename))return {ok:false,reason:`sensitive or unsupported file: ${file.filename}`};
    if(!['added','modified'].includes(file.status))return {ok:false,reason:`deletion/rename not auto-merged: ${file.filename}`};
    if(!Number.isSafeInteger(file.changes)||file.changes<0)return {ok:false,reason:`invalid diff size: ${file.filename}`};
    changes+=file.changes;
  }
  if(changes>MAX_CHANGED_LINES)return {ok:false,reason:`too many changed lines: ${changes}`};
  return {ok:true,reason:`owner-authored labeled UI PR: ${files.length} files, ${changes} changed lines`};
}
module.exports=Object.freeze({LABEL,MAX_FILES,MAX_CHANGED_LINES,safePath,eligible});
