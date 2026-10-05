/* UI time formatting boundary: raw study minutes stay precise; presentation is rounded here. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.TimeFormat=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function wholeMinutes(value){
    const n=Number(value);
    if(!Number.isFinite(n)||n<=0)return 0;
    return Math.max(0,Math.round(n));
  }

  function minutes(value){
    return wholeMinutes(value);
  }

  function hoursLabel(value){
    const total=wholeMinutes(value);
    return (total/60).toFixed(1).replace('.0','')+'h';
  }

  function human(value){
    const total=wholeMinutes(value);
    const hours=Math.floor(total/60);
    const mins=total%60;
    if(!hours)return `${mins} 分`;
    return mins?`${hours} 小時 ${mins} 分`:`${hours} 小時`;
  }

  function shortEnglish(value){
    const total=wholeMinutes(value);
    const hours=Math.floor(total/60);
    const mins=total%60;
    return hours?`${hours}h ${mins}m`:`${mins}m`;
  }

  return Object.freeze({
    wholeMinutes,
    minutes,
    hoursLabel,
    human,
    shortEnglish
  });
});
