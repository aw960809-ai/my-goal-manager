/* Timer service: state transitions only; no DOM or storage access. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.TimerService=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function empty(){
    return {
      id:null,
      start:0,
      elapsed:0,
      running:false,
      planId:null,
      kind:'goal',
      label:''
    };
  }

  function normalize(value){
    const src=value&&typeof value==='object'?value:{};
    return {
      id:src.id||null,
      start:Math.max(0,+src.start||0),
      elapsed:Math.max(0,+src.elapsed||0),
      running:!!src.running,
      planId:src.planId||null,
      kind:src.kind==='other-study'?'other-study':'goal',
      label:String(src.label||'')
    };
  }

  function payload(timer){
    return normalize(timer);
  }

  function hasSelection(timer){
    const t=normalize(timer);
    return t.kind==='other-study'?!!t.label:!!t.id;
  }

  function selectGoal(id,planId=null){
    return {
      ...empty(),
      id:id||null,
      planId:planId||null,
      kind:'goal'
    };
  }

  function selectOther(label){
    return {
      ...empty(),
      kind:'other-study',
      label:String(label||'').trim()
    };
  }

  function start(timer,now=Date.now()){
    const t=normalize(timer);
    if(!hasSelection(t)||t.running)return t;
    return {...t,running:true,start:now};
  }

  function pause(timer,now=Date.now()){
    const t=normalize(timer);
    if(!t.running)return t;
    return {
      ...t,
      elapsed:t.elapsed+Math.max(0,now-t.start),
      running:false,
      start:0
    };
  }

  function elapsedMs(timer,now=Date.now()){
    const t=normalize(timer);
    return t.elapsed+(t.running?Math.max(0,now-t.start):0);
  }

  function finish(timer,now=Date.now()){
    const paused=pause(timer,now);
    const ms=elapsedMs(paused,now);
    return {
      timer:paused,
      elapsed:ms,
      minutes:Math.max(1,Math.round(ms/60000))
    };
  }

  return Object.freeze({
    empty,
    normalize,
    payload,
    hasSelection,
    selectGoal,
    selectOther,
    start,
    pause,
    elapsedMs,
    finish
  });
});
