/* Immutable study-history guard for ordinary persistence writes. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.HistoryGuard=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function list(value){return Array.isArray(value)?value:[]}

  function coreSignature(log){
    const x=log&&typeof log==='object'?log:{};
    return JSON.stringify([
      String(x.id??''),
      x.taskId===null||x.taskId===undefined?null:String(x.taskId),
      String(x.name??''),
      String(x.time??''),
      Math.max(0,Number.isFinite(+x.minutes)?+x.minutes:0),
      String(x.kind??''),
      String(x.type??''),
      x.actual===false?false:true
    ]);
  }

  function identity(log,index){
    const id=String(log?.id??'').trim();
    return id?`id:${id}`:`legacy:${index}:${coreSignature(log)}`;
  }

  function isCountable(log){
    return !!log&&
      log.actual!==false&&
      log.status!=='已刪除'&&
      log.kind!=='system'&&
      log.type!=='auto';
  }

  function metrics(data){
    const logs=list(data?.logs);
    const countable=logs.filter(isCountable);
    return {
      logCount:logs.length,
      countableCount:countable.length,
      totalMinutes:countable.reduce(
        (sum,log)=>sum+Math.max(0,+log?.minutes||0),
        0
      ),
      otherMinutes:countable
        .filter(log=>log?.kind==='other-study')
        .reduce((sum,log)=>sum+Math.max(0,+log?.minutes||0),0)
    };
  }

  function assertPreserved(previousData,nextData,{
    allowReplacement=false
  }={}){
    if(allowReplacement)return true;

    const previous=list(previousData?.logs);
    const next=list(nextData?.logs);

    if(!previous.length)return true;

    if(next.length<previous.length){
      throw new Error(
        `歷程保護：拒絕將 ${previous.length} 筆紀錄縮減為 ${next.length} 筆`
      );
    }

    const nextById=new Map();
    next.forEach((log,index)=>{
      nextById.set(identity(log,index),coreSignature(log));
    });

    const missing=[];
    const changed=[];

    previous.forEach((log,index)=>{
      const key=identity(log,index);
      if(!nextById.has(key)){
        missing.push(String(log?.id||log?.name||index));
        return;
      }
      if(nextById.get(key)!==coreSignature(log)){
        changed.push(String(log?.id||log?.name||index));
      }
    });

    if(missing.length){
      throw new Error(
        `歷程保護：偵測到 ${missing.length} 筆既有紀錄消失`
      );
    }

    if(changed.length){
      throw new Error(
        `歷程保護：偵測到 ${changed.length} 筆既有紀錄核心內容被改寫`
      );
    }

    return true;
  }

  return Object.freeze({
    metrics,
    assertPreserved
  });
});
