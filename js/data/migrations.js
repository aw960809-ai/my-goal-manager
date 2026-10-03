/* Data migration runner: orchestration only, schema-neutral by default. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.DataMigrations=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function migrate(data,{
    fromVersion=0,
    schemaVersion,
    normalize,
    repair
  }={}){
    if(typeof normalize!=='function')throw new Error('normalize adapter is required');

    let out=data;
    out=normalize(out);

    if(typeof repair==='function'){
      repair(out.tasks,fromVersion);
    }

    out=normalize(out);
    out.schemaVersion=Number(schemaVersion||0);
    return out;
  }

  return Object.freeze({migrate});
});
