/* V97.14.0 Goal domain: pure hierarchy and period helpers. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GoalDomain=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function list(tasks){return Array.isArray(tasks)?tasks:[]}
  function getTask(tasks,id){return list(tasks).find(t=>String(t?.id)===String(id))||null}
  function children(tasks,parentId){return list(tasks).filter(t=>String(t?.parent)===String(parentId))}
  function roots(tasks){return list(tasks).filter(t=>Number(t?.level)===1)}
  function descendantsOfLevel(tasks,parentId,level){
    return list(tasks).filter(t=>String(t?.parent)===String(parentId)&&Number(t?.level)===Number(level));
  }
  function ancestors(tasks,id,maxDepth=5){
    const out=[],seen=new Set();
    let cur=getTask(tasks,id),guard=0;
    while(cur&&guard++<maxDepth&&!seen.has(String(cur.id))){
      seen.add(String(cur.id));
      out.unshift(cur);
      cur=cur.parent?getTask(tasks,cur.parent):null;
    }
    return out;
  }
  function periodForTask(tasks,taskOrId){
    const t=typeof taskOrId==='object'&&taskOrId?taskOrId:getTask(tasks,taskOrId);
    if(!t)return null;
    if(Number(t.level)===1)return null;
    if(Number(t.level)===3)return {start:t.start||'',due:t.due||''};
    if(Number(t.level)===4)return periodForTask(tasks,t.parent);
    if(Number(t.level)===2){
      const subs=descendantsOfLevel(tasks,t.id,3).filter(x=>x.status!=='已封存'&&x.start&&x.due);
      if(!subs.length)return {start:'',due:''};
      return {
        start:subs.map(x=>x.start).sort()[0],
        due:subs.map(x=>x.due).sort().slice(-1)[0]
      };
    }
    return null;
  }
  function path(tasks,id){return ancestors(tasks,id).map(t=>t.name)}
  function browseItems(tasks,parentId){
    const rows=list(tasks).filter(t=>t&&t.status!=='已封存');
    if(!parentId)return rows.filter(t=>Number(t.level)===1);
    return rows.filter(t=>String(t.parent)===String(parentId));
  }

  return Object.freeze({
    getTask,children,roots,descendantsOfLevel,ancestors,periodForTask,path,browseItems
  });
});
