/* Taiwan civil time for study-log presentation and date accounting.
 * Source timestamps are read-only; ISO strings with Z or offsets are instants.
 * Historical date-only / offset-free values are Taiwan wall time.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.TaiwanTime=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const zone='Asia/Taipei';
  const formatter=new Intl.DateTimeFormat('en-GB',{
    timeZone:zone,
    year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  });
  const bareDate=/^\d{4}-\d{2}-\d{2}$/;
  const wallTime=/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

  function readParts(date){
    const obj={};
    formatter.formatToParts(date).forEach(item=>{
      if(['year','month','day','hour','minute'].includes(item.type)){
        obj[item.type]=item.value;
      }
    });
    return obj;
  }

  function instant(value){
    if(value===null||value===undefined)return null;
    let input=value,wallDate='';
    if(typeof value==='string'){
      const raw=value.trim();
      if(!raw)return null;
      if(bareDate.test(raw)){
        wallDate=raw;
        input=raw+'T00:00:00+08:00';
      }else if(wallTime.test(raw)){
        wallDate=raw.slice(0,10);
        input=raw.replace(' ','T')+'+08:00';
      }else{
        input=raw;
      }
    }
    const date=value instanceof Date?value:new Date(input);
    if(!Number.isFinite(date.getTime()))return null;
    if(wallDate){
      const p=readParts(date);
      const actual=`${p.year}-${p.month}-${p.day}`;
      if(actual!==wallDate)return null;
    }
    return date;
  }

  function parts(value){
    const date=instant(value);
    return date?readParts(date):null;
  }

  function timestamp(value){
    const date=instant(value);
    return date?date.getTime():NaN;
  }

  function dateKey(value){
    const p=parts(value);
    return p?`${p.year}-${p.month}-${p.day}`:'';
  }

  function clock(value){
    const p=parts(value);
    return p?`${p.hour}:${p.minute}`:'';
  }

  function dateTimeLabel(value){
    const day=dateKey(value);
    if(!day)return '';
    if(typeof value==='string'&&bareDate.test(value.trim()))return day;
    return `${day} · ${clock(value)}`;
  }

  return Object.freeze({zone,parts,timestamp,dateKey,clock,dateTimeLabel});
});
