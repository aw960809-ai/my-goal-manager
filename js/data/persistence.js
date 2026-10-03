/* Data persistence orchestration through injected storage adapters. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.DataPersistence=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function list(value){return Array.isArray(value)?value:[]}

  function rotateBackups({
    read,
    write,
    backupKeys,
    currentRaw
  }){
    const keys=list(backupKeys);
    if(!currentRaw||!keys.length)return;

    for(let i=keys.length-1;i>0;i--){
      const previous=read(keys[i-1]);
      if(previous)write(keys[i],previous);
    }

    write(keys[0],currentRaw);
  }

  function persist(data,{
    prepare,
    read,
    write,
    writeStatus,
    key,
    backupKeys,
    backup=true,
    guard,
    makeEnvelope,
    parseEnvelope,
    serializePayload,
    checksum
  }={}){
    if(typeof prepare!=='function')throw new Error('prepare adapter is required');
    if(typeof read!=='function'||typeof write!=='function')throw new Error('read/write adapters are required');
    if(typeof makeEnvelope!=='function'||typeof parseEnvelope!=='function')throw new Error('envelope adapters are required');
    if(typeof serializePayload!=='function'||typeof checksum!=='function')throw new Error('integrity adapters are required');

    const normalized=prepare(data);
    const payload=serializePayload(normalized);
    const next=JSON.stringify(makeEnvelope(normalized));
    const old=read(key);

    if(typeof guard==='function'){
      guard({
        oldRaw:old,
        nextRaw:next,
        nextData:normalized
      });
    }

    try{
      const writeOk=write(key,next);
      const state=typeof writeStatus==='function'
        ?writeStatus()
        :{persistent:true};

      if(!writeOk||state.persistent===false){
        throw new Error('無法永久寫入本機儲存空間；已停止保存以避免誤判成功');
      }

      const verify=read(key);
      const parsed=parseEnvelope(verify);

      if(
        !parsed.data||
        checksum(serializePayload(parsed.data))!==checksum(payload)
      ){
        throw new Error('寫入後驗證失敗');
      }

      // Rotate only after the new primary copy has passed integrity checks.
      if(backup&&old&&old!==next){
        rotateBackups({
          read,
          write,
          backupKeys,
          currentRaw:old
        });
      }

      return normalized;
    }catch(error){
      // Best-effort rollback of the primary copy. Backups have not rotated yet.
      if(old&&read(key)!==old){
        try{write(key,old)}catch(_){}
      }
      throw error;
    }
  }

  function loadFirstValid({
    read,
    currentKey,
    backupKeys,
    legacyKeys,
    decode
  }={}){
    if(typeof read!=='function')throw new Error('read adapter is required');
    if(typeof decode!=='function')throw new Error('decode adapter is required');

    const current=read(currentKey);

    if(current){
      const data=decode(current,'current');
      if(data){
        return {
          data,
          source:'current',
          key:currentKey
        };
      }
    }

    for(const key of list(backupKeys)){
      const raw=read(key);
      if(!raw)continue;

      const data=decode(raw,key);
      if(data){
        return {
          data,
          source:'backup',
          key
        };
      }
    }

    for(const key of list(legacyKeys)){
      const raw=read(key);
      if(!raw)continue;

      const data=decode(raw,key);
      if(data){
        return {
          data,
          source:'legacy',
          key
        };
      }
    }

    return null;
  }

  return Object.freeze({
    rotateBackups,
    persist,
    loadFirstValid
  });
});
