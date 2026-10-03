/* Repository boundary: candidate decoding/validation without direct storage access. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.DataRepository=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function readCandidate(raw,{
    parseEnvelope,
    migrateData,
    isUsableData,
    validateData
  }={}){
    try{
      if(typeof parseEnvelope!=='function')throw new Error('parseEnvelope adapter is required');
      if(typeof migrateData!=='function')throw new Error('migrateData adapter is required');
      if(typeof isUsableData!=='function')throw new Error('isUsableData adapter is required');
      if(typeof validateData!=='function')throw new Error('validateData adapter is required');

      const parsed=parseEnvelope(raw);
      const data=migrateData(parsed.data,parsed.schemaVersion);

      if(!isUsableData(data))throw new Error('資料結構不完整');

      const errors=validateData(data);
      if(errors.length)throw new Error(errors.slice(0,3).join('；'));

      return data;
    }catch(_){
      return null;
    }
  }

  return Object.freeze({readCandidate});
});
