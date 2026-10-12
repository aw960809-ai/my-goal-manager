/* TOEIC Trainer V0.4.3.3 — presentation-only preferences (not study history). */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ToeicTrainerPreferences=api;
  if(root?.document?.documentElement){
    let store=null;try{store=root.localStorage}catch(_){}
    api.apply(root.document.documentElement,api.load(store));
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='toeic-trainer:ui-preferences-v1';
  const DEFAULT=Object.freeze({appearance:'system',accent:'slate',textSize:'normal'});
  const ALLOWED=Object.freeze({
    appearance:['system','light','dark'],
    accent:['slate','indigo','graphite','teal'],
    textSize:['normal','large']
  });
  function normalize(row){
    const out={...DEFAULT};
    if(row&&typeof row==='object'&&!Array.isArray(row)){
      for(const name of Object.keys(DEFAULT))if(ALLOWED[name].includes(row[name]))out[name]=row[name];
    }
    return out;
  }
  function load(storage){
    try{
      if(!storage||typeof storage.getItem!=='function')return normalize(null);
      const raw=storage.getItem(KEY);
      return normalize(raw?JSON.parse(raw):null);
    }catch(_){return normalize(null)}
  }
  function save(storage,settings){
    const next=normalize(settings);
    if(!storage||typeof storage.setItem!=='function'||typeof storage.getItem!=='function')throw new Error('偏好儲存不可用');
    const value=JSON.stringify(next);
    storage.setItem(KEY,value);
    if(storage.getItem(KEY)!==value)throw new Error('偏好儲存驗證失敗');
    return next;
  }
  function apply(root,settings){
    const next=normalize(settings);
    if(root&&root.dataset){root.dataset.appearance=next.appearance;root.dataset.accent=next.accent;root.dataset.textSize=next.textSize}
    return next;
  }
  return Object.freeze({KEY,DEFAULT,ALLOWED,normalize,load,save,apply});
});
