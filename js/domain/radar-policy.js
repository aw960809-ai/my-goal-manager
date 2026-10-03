/* Radar policy: pure activity geography/review and scholarship region rules. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.RadarPolicy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const CIRCLE_LABELS=Object.freeze({
    1:'東海校內',
    2:'台中',
    3:'中部',
    4:'全國'
  });

  function text(value){
    return String(value||'').trim().replace(/臺/g,'台');
  }

  function isInternationalActivity(activity){
    const raw=text(
      activity?.scope||
      activity?.circleLabel||
      activity?.type||
      ''
    );
    const corpus=text(
      `${activity?.title||''} ${activity?.keywords||''} ${raw}`
    );
    return /海外|國際|working holiday|exchange|foreign|international/i.test(corpus);
  }

  function activityCircleInfo(activity){
    const raw=text(activity?.scope||activity?.circleLabel||'');

    let level=0;

    if(/東海|校內/.test(raw)){
      level=1;
    }else if(/西屯|沙鹿|台中/.test(raw)){
      level=2;
    }else if(/中部|苗栗|彰化|南投|雲林/.test(raw)){
      level=3;
    }else if(/全台|全國|海外|國際|線上/.test(raw)){
      level=4;
    }else{
      const explicit=Number(activity?.circleLevel||0);
      level=(explicit>=1&&explicit<=4)?explicit:4;
    }

    return {
      level,
      label:CIRCLE_LABELS[level],
      key:'circle'+level,
      international:isInternationalActivity(activity)
    };
  }

  function circleLabel(level){
    const n=Number(level);
    return ({
      1:'① 東海校內',
      2:'② 台中',
      3:'③ 中部',
      4:'④ 全國'
    })[n]||'④ 全國';
  }

  function activityReviewState(activity){
    const missCount=Math.max(0,Number(activity?.missCount||0));
    const needsReview=
      activity?.needsReview===true||
      missCount>=2;

    if(!needsReview){
      return {
        needsReview:false,
        blocked:false,
        state:'',
        reason:''
      };
    }

    const lastSeen=String(
      activity?.lastSeen||
      activity?.fetchedAt||
      activity?.updatedAt||
      ''
    ).slice(0,10);

    return {
      needsReview:true,
      blocked:true,
      state:'待複核',
      reason:lastSeen
        ?`來源已連續缺失 ${missCount} 次；最後確認 ${lastSeen}，暫不列入推薦`
        :`來源已連續缺失 ${missCount} 次，暫不列入推薦`
    };
  }

  function scholarshipRegionReason(corpus){
    const c=corpus&&typeof corpus==='object'?corpus:{};
    const scope=text([
      c.target,
      c.restrictions,
      c.academic,
      c.documents,
      c.note
    ].join(' '));

    if(!scope)return null;

    const unrestricted=
      /不限地區|不限戶籍|不限設籍|不限縣市|戶籍不限|地區不限|全國皆可|全台皆可|全國大專|全國學生/;

    const places=
      /基隆|台北|新北|桃園|新竹|苗栗|台中|彰化|南投|雲林|嘉義市|嘉義縣|台南|高雄|屏東|宜蘭|花蓮|台東|澎湖|金門|連江|恆春/;

    const regionQualifier=
      /戶籍|設籍|原籍|籍貫|居住|居民|就讀|在學|本縣學生|本市學生|本鄉學生|本鎮學生|本區學生/;

    const mandatory=
      /僅限|限定|限於|必須|須具備|需具備|申請對象|獎助對象|受獎對象|資格條件|申請資格/;

    const clauses=scope
      .split(/[。；;，,\n]/)
      .map(x=>x.trim())
      .filter(Boolean);

    for(const clause of clauses){
      if(unrestricted.test(clause))continue;

      const hasPlace=places.test(clause);
      const hasQualifier=regionQualifier.test(clause);
      const hasMandatory=mandatory.test(clause);

      if(hasPlace&&hasQualifier){
        return '具有地域必要資格；依目前規則所有地域限制均排除';
      }

      if(
        hasPlace&&
        hasMandatory&&
        /本縣|本市|本鄉|本鎮|本區|戶籍|設籍|居住|就讀|在學/.test(clause)
      ){
        return '具有地域必要資格；依目前規則所有地域限制均排除';
      }

      if(
        /本縣|本市|本鄉|本鎮|本區/.test(clause)&&
        (hasQualifier||hasMandatory)
      ){
        return '具有地方性本縣／本市／本鄉鎮區限制';
      }

      if(
        /戶籍謄本|戶籍證明|設籍證明|居住證明/.test(clause)&&
        hasPlace
      ){
        return '申請必備文件要求特定地域證明；依目前規則排除';
      }
    }

    return null;
  }

  return Object.freeze({
    CIRCLE_LABELS,
    isInternationalActivity,
    activityCircleInfo,
    circleLabel,
    activityReviewState,
    scholarshipRegionReason
  });
});
