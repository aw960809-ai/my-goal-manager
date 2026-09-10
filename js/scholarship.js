/* V96 Scholarship module: independent catalog, fit and UI */
// V93.1 offline scholarship fallback: keeps scholarship data available even when a local HTML file cannot fetch ./data/events.json.
const SCHOLARSHIP_SEED = [{"id":"sch-thu-589","title":"東海大學TEFA黃秋雄玉山獎學金","date":"2026-10-22","time":"","scope":"東海校內","type":"獎學金／助學金","kind":"scholarship","url":"https://tscholarship.thu.edu.tw/wwwstud/frontend/Scholarship.php","keywords":"東海 玉山 獎學金 黃秋雄 100000","direct":true,"team":false,"available":true,"source":"東海大學｜獎助學金查詢","statusText":"東海官方獎學金；申請期限 2026-10-22","government":false,"sourcePriority":"core","scholarship":true},{"id":"sch-thu-115","title":"宗倬章先生獎學金","date":"2026-09-18","time":"","scope":"東海校內","type":"獎學金／助學金","kind":"scholarship","url":"https://tscholarship.thu.edu.tw/wwwstud/frontend/Scholarship.php","keywords":"宗倬章 獎學金 40000","direct":true,"team":false,"available":true,"source":"東海大學｜獎助學金查詢","statusText":"東海官方獎學金；申請期限 2026-09-18","government":false,"sourcePriority":"core","scholarship":true},{"id":"sch-thu-132","title":"羅慧夫顱顏基金會獎助學金","date":"2026-09-11","time":"","scope":"東海校內","type":"獎學金／助學金","kind":"scholarship","url":"https://tscholarship.thu.edu.tw/wwwstud/frontend/Scholarship.php","keywords":"羅慧夫 顱顏 基金會 獎助學金","direct":true,"team":false,"available":true,"source":"東海大學｜獎助學金查詢","statusText":"東海官方獎助學金；申請期限 2026-09-11","government":false,"sourcePriority":"core","scholarship":true},{"id":"sch-thu-133","title":"杜萬全慈善獎學金","date":"2026-09-30","time":"","scope":"東海校內","type":"獎學金／助學金","kind":"scholarship","url":"https://tscholarship.thu.edu.tw/wwwstud/frontend/Scholarship.php","keywords":"杜萬全 慈善 獎學金 10000","direct":true,"team":false,"available":true,"source":"東海大學｜獎助學金查詢","statusText":"東海官方獎學金；申請期限 2026-09-30","government":false,"sourcePriority":"core","scholarship":true},{"id":"sch-thu-158","title":"法治推廣獎學金","date":"2026-10-05","time":"","scope":"東海校內","type":"獎學金／助學金","kind":"scholarship","url":"https://tscholarship.thu.edu.tw/wwwstud/frontend/Scholarship.php","keywords":"法治 推廣 獎學金 10000 法律","direct":true,"team":false,"available":true,"source":"東海大學｜獎助學金查詢","statusText":"東海官方獎學金；申請期限 2026-10-05","government":false,"sourcePriority":"core","scholarship":true},{"id":"sch-moe-115","title":"115學年度獎學金公告資訊網申請","date":"2026-09-30","time":"","scope":"全臺","type":"獎學金／助學金","kind":"scholarship","url":"https://www.edu.tw/scholarshipinfo/Default.aspx","keywords":"教育部 獎學金 115學年度 9月 申請","direct":true,"team":false,"available":true,"source":"教育部｜獎學金公告資訊網","statusText":"教育部獎學金公告；受理至 2026-09-30","government":true,"sourcePriority":"government","scholarship":true},{"id":"sch-gov-portal","title":"大專院校學生政府獎助學金申請整理","date":"","time":"","scope":"全臺","type":"獎學金／助學金","kind":"reference","url":"https://www.gov.tw/News_Content_26_402188","keywords":"我的E政府 大專學生 獎助學金 低收入 中低收入 身心障礙 原住民 特殊境遇","direct":true,"team":false,"available":true,"source":"我的E政府","statusText":"政府獎助學金整理入口","government":true,"sourcePriority":"government","scholarship":true}];


const SCHOLARSHIP_PAGE_SIZE=8;
let scholarshipPage=1,scholarshipLastFilter='';

function scholarshipNumber(a){
 const explicit=String(a?.scholarshipNumber||'').trim();
 if(explicit)return explicit;
 const id=String(a?.id||'');
 let m=id.match(/^sch-thu-(\d+)$/);if(m)return m[1];
 m=id.match(/^auto-thu-sch-[^-]+-(\d+)$/);if(m)return m[1];
 return '';
}
function scholarshipAcademicParams(a){
 const raw=String(a?.date||a?.deadline||'').trim();
 const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 const d=m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3])):new Date();
 const y=d.getFullYear(),month=d.getMonth()+1;
 const term=(month>=8||month===1)?1:2;
 const academicYear=(month>=8)?y-1911:y-1912;
 return {year:academicYear,term};
}
function scholarshipOfficialUrl(a){
 const detail=String(a?.detailUrl||'').trim();
 if(detail)return detail;
 const raw=String(a?.url||a?.externalUrl||a?.sourceUrl||'').trim();
 const isThu=String(a?.sourceId||'')==='thu_scholarship_official'||/tscholarship\.thu\.edu\.tw/i.test(raw);
 const no=scholarshipNumber(a);
 if(isThu&&no){
  const p=scholarshipAcademicParams(a);
  return `https://tscholarship.thu.edu.tw/wwwstud/frontend/Scholarship_detail.php?schno=${encodeURIComponent(no)}&term=${p.term}&year=${p.year}`;
 }
 return raw;
}
function renderScholarshipPagination(total){
 const el=document.getElementById('scholarshipPagination');if(!el)return;
 const pages=Math.max(1,Math.ceil(total/SCHOLARSHIP_PAGE_SIZE));
 scholarshipPage=Math.min(Math.max(1,scholarshipPage),pages);
 el.innerHTML=total>SCHOLARSHIP_PAGE_SIZE
  ?`<button class="btn" type="button" onclick="scholarshipPrevPage()" ${scholarshipPage===1?'disabled':''}>‹</button><span class="activity-page-info">第 ${scholarshipPage} / ${pages} 頁</span><button class="btn" type="button" onclick="scholarshipNextPage()" ${scholarshipPage===pages?'disabled':''}>›</button>`
  :'';
}
function scholarshipScrollTop(){document.getElementById('scholarshipStats')?.scrollIntoView({behavior:'smooth',block:'start'});}
function scholarshipPrevPage(){if(scholarshipPage>1){scholarshipPage--;renderScholarships();scholarshipScrollTop()}}
function scholarshipNextPage(){scholarshipPage++;renderScholarships();scholarshipScrollTop()}

/* V97.4.9 scholarship eligibility + specialty priority */
function scholarshipPolicyText(a){
 return [a?.title,a?.keywords,a?.description,a?.statusText,a?.category,a?.amount,a?.eligibility,a?.audience,a?.target,a?.eligibilityTarget]
  .map(x=>String(x||'')).join(' ').replace(/\s+/g,' ').trim();
}
function scholarshipSpecialtyKind(a){
 const explicit=String(a?.specialtyKind||'').toLowerCase();
 if(explicit==='professional')return '專業考照';
 if(explicit==='language')return '外語能力';
 const text=scholarshipPolicyText(a).toLowerCase();
 if(/專業證照|證照獎勵|證照補助|專門職業|專技高考|專業考照|技術士|國家考試|考照|ipas|證券|金融證照|會計證照|資訊證照/.test(text))return '專業考照';
 if(/外語能力|外語檢定|英語檢定|日語檢定|語言檢定|語言證照|toeic|toefl|ielts|gept|jlpt|delf|goethe|topik|cefr|linguaskill|bestep/.test(text))return '外語能力';
 return '一般獎學金';
}
/* V97.4.9.4 detail-level scholarship eligibility enforcement */
function scholarshipEligibility(a){
 const text=scholarshipPolicyText(a)+' '+String(a?.restrictions||'');
 const title=String(a?.title||'').replace(/\s+/g,' ').trim();
 const explicitTarget=String(a?.eligibilityTarget||a?.scholarshipTarget||a?.audience||'').replace(/\s+/g,' ').trim();
 const specialty=scholarshipSpecialtyKind(a);

 const poverty=/(?:清寒家庭|清寒學生|清寒|家境清寒|低收入戶|中低收入戶|經濟弱勢|弱勢家庭|弱勢學生|家庭經濟困難)/;
 const militaryPublic=/(?:軍公教|軍警消|現役軍人|軍人子女|軍人遺族|軍眷|公務人員|公務員子女|公教人員|教職員子女|榮民|榮眷|遺族)/;
 const awardWords=/(?:獎學金|助學金|獎助學金|獎助|補助)/;
 const optionalWords=/(?:另|另外|額外|加發|加碼|得另申請|可另申請|另可申請|報名費補助|考試費補助|費用補助|補助報名費|補助考試費)/;

 // V97.4.9.6: the scholarship title itself is a high-confidence target signal.
 // "清寒優秀學生獎學金" / "軍公教子女獎學金" are inherently restricted schemes.
 const titlePovertyTarget=poverty.test(title)&&awardWords.test(title)&&!optionalWords.test(title);
 const titleMilitaryTarget=militaryPublic.test(title)&&awardWords.test(title)&&!optionalWords.test(title);

 if(titlePovertyTarget){
   return {eligible:false,excluded:true,reason:'獎助名稱已明確限定清寒／低收入／經濟弱勢對象',specialty};
 }
 if(titleMilitaryTarget){
   return {eligible:false,excluded:true,reason:'獎助名稱已明確限定軍公教／軍警消等特定身分',specialty};
 }

 // Highest-confidence structured field from the official detail page.
 if(explicitTarget){
   if(poverty.test(explicitTarget)){
     return {eligible:false,excluded:true,reason:'官方「獎助對象」明列清寒／低收入／經濟弱勢身分',specialty};
   }
   if(militaryPublic.test(explicitTarget)){
     return {eligible:false,excluded:true,reason:'官方「獎助對象」明列軍公教／軍警消等特定身分',specialty};
   }
 }

 if(a?.eligibilityVerified===false){
   return {eligible:false,excluded:true,reason:'官方詳細資格尚未成功驗證，暫不列入推薦',specialty};
 }

 const targetText=[
   a?.eligibility,a?.audience,a?.target,a?.eligibilityTarget,
   a?.description,a?.statusText,title,a?.restrictions
 ].map(x=>String(x||'')).join(' ').replace(/\s+/g,' ').trim();

 const mandatoryLead=/(?:僅限|限|限定|必須|須具備|申請資格|申請對象|補助對象|獎助對象|受獎對象|資格條件|專供|提供予|發給)/;
 const optionalLead=optionalWords;

 const povertyMandatory=
   new RegExp(mandatoryLead.source+'[^。；\\n]{0,90}'+poverty.source).test(targetText) ||
   new RegExp(poverty.source+'[^。；\\n]{0,45}(?:始得申請|方可申請|才可申請|為必要條件|為申請資格|為受獎資格)').test(targetText);

 const militaryMandatory=
   new RegExp(mandatoryLead.source+'[^。；\\n]{0,90}'+militaryPublic.source).test(targetText) ||
   new RegExp(militaryPublic.source+'[^。；\\n]{0,45}(?:始得申請|方可申請|才可申請|為必要條件|為申請資格|為受獎資格)').test(targetText);

 const povertyOptional=
   new RegExp(optionalLead.source+'[^。；\\n]{0,100}'+poverty.source).test(targetText) ||
   new RegExp(poverty.source+'[^。；\\n]{0,100}'+optionalLead.source).test(targetText);

 const militaryOptional=
   new RegExp(optionalLead.source+'[^。；\\n]{0,100}'+militaryPublic.source).test(targetText) ||
   new RegExp(militaryPublic.source+'[^。；\\n]{0,100}'+optionalLead.source).test(targetText);

 if(povertyMandatory&&!povertyOptional){
   return {eligible:false,excluded:true,reason:'清寒／低收入／經濟弱勢身分為必要申請或受獎條件',specialty};
 }
 if(militaryMandatory&&!militaryOptional){
   return {eligible:false,excluded:true,reason:'軍公教／軍警消等身分為必要申請或受獎條件',specialty};
 }
 if((povertyMandatory&&povertyOptional)||(militaryMandatory&&militaryOptional)){
   return {eligible:true,excluded:false,reason:'特定身分僅屬額外補助條件，不是基本申請必要條件',specialty};
 }
 return {eligible:true,excluded:false,reason:'可列入個人判斷',specialty};
}
function scholarshipAssessment(a){
 const eligibility=scholarshipEligibility(a),text=scholarshipPolicyText(a).toLowerCase();
 let score=45;if(!eligibility.eligible)return {...eligibility,score:0,priority:-1};
 if(/東海|東海大學|tunghai/.test(text))score+=20;
 if(/法律|法治|司法|法學|律師|司法官|專門職業及技術人員/.test(text))score+=15;
 if(/大學|學生|在學|學士班|碩士班|博士班/.test(text))score+=5;
 if(/成績|學業|gpa|排名|優良|優秀/.test(text))score+=5;
 let priority=0;
 if(eligibility.specialty==='專業考照'){score+=28;priority=2}
 if(eligibility.specialty==='外語能力'){score+=30;priority=2}
 if(eligibility.specialty==='專業考照'&&/法律|司法|律師|專技|國家考試/.test(text)){score+=5;priority=3}
 return {...eligibility,score:Math.min(99,Math.max(0,score)),priority};
}
function scholarshipFit(a){return scholarshipAssessment(a).score}
function renderScholarships(){
 const box=document.getElementById('scholarshipList');if(!box)return;ensureActivities();
 const today=todayKey(),filter=document.getElementById('scholarshipFilter')?.value||'全部';
 if(typeof scholarshipLastFilter!=='undefined'&&filter!==scholarshipLastFilter){
   if(typeof scholarshipPage!=='undefined')scholarshipPage=1;scholarshipLastFilter=filter;
 }
 const assessedAll=scholarshipStore().map(a=>{
   const assessment=scholarshipAssessment(a);
   const life=typeof scholarshipTimeState==='function'?scholarshipTimeState(a,today):{keep:true,state:''};
   return {...a,score:assessment.score,assessment,life};
 });
 const excluded=assessedAll.filter(a=>a.life.keep&&!a.assessment.eligible).length;
 let arr=assessedAll.filter(a=>a.life.keep&&a.assessment.eligible);
 arr=arr.filter(a=>{
   if(filter==='高度符合')return a.score>=80;
   if(filter==='可能符合')return a.score>=60&&a.score<80;
   if(filter==='近期截止')return !!a.date&&a.date>=today&&daysUntil(a.date)<=30;
   if(filter==='專業考照')return a.assessment.specialty==='專業考照';
   if(filter==='外語能力')return a.assessment.specialty==='外語能力';
   return true;
 });
 arr.sort((a,b)=>(b.assessment.priority-a.assessment.priority)||((a.date||'9999-12-31').localeCompare(b.date||'9999-12-31'))||(b.score-a.score));
 const high=arr.filter(a=>a.score>=80&&a.kind!=='reference').length;
 const professional=arr.filter(a=>a.assessment.specialty==='專業考照').length;
 const language=arr.filter(a=>a.assessment.specialty==='外語能力').length;
 const lifecycle=(typeof scholarshipLifecycleMeta!=='undefined'&&scholarshipLifecycleMeta)||{};
 const pruned=(lifecycle.expiredPruned||0)+(lifecycle.unknownPruned||0)+(lifecycle.disabledPruned||0);
 const stats=document.getElementById('scholarshipStats');
 if(stats)stats.innerHTML=`目前 <b>${arr.length}</b> 項 · 高度符合 ${high} · 專業考照 ${professional} · 外語能力 ${language} · 資格排除 ${excluded}${pruned?' · 自動汰除 '+pruned:''}`;
 let pageItems=arr;
 if(typeof SCHOLARSHIP_PAGE_SIZE==='number'&&SCHOLARSHIP_PAGE_SIZE>0&&typeof scholarshipPage!=='undefined'){
   const pages=Math.max(1,Math.ceil(arr.length/SCHOLARSHIP_PAGE_SIZE));scholarshipPage=Math.min(Math.max(1,scholarshipPage),pages);
   const start=(scholarshipPage-1)*SCHOLARSHIP_PAGE_SIZE;pageItems=arr.slice(start,start+SCHOLARSHIP_PAGE_SIZE);
 }
 box.innerHTML=pageItems.map(a=>{
   const level=a.kind==='reference'?'參考':a.score>=80?'高度符合':a.score>=60?'可能符合':'參考';
   const cls=level==='高度符合'?'':' '+(level==='可能符合'?'gold':'gray');
   const specialty=a.assessment.specialty==='一般獎學金'?'':a.assessment.specialty+' · ';
   const lifeLabel=a.life?.state?esc(a.life.state)+' · ':'';
   return `<button class="row scholarship-card scholarship-action-row" type="button" onclick="openScholarshipInfo('${a.id}')"><span class="main"><span class="title">${esc(a.title)}</span><span class="meta">${specialty}${a.date?'截止 '+esc(a.date.slice(5).replace('-','/'))+' · ':''}${lifeLabel}${esc(a.source||a.scope||'官方資訊')}</span></span><span class="badge${cls}">${level}</span><span class="scholarship-chevron" aria-hidden="true">›</span></button>`;
 }).join('')||'<div class="empty">目前沒有符合個人資格判斷的獎學金資料。</div>';
 if(typeof renderScholarshipPagination==='function')renderScholarshipPagination(arr.length);
}
function openScholarshipInfo(id){
 const a=scholarshipStore().find(x=>String(x.id)===String(id));if(!a)return;
 const assessment=scholarshipAssessment(a),score=assessment.score;
 const level=!assessment.eligible?'已排除':score>=80?'高度符合':score>=60?'可能符合':'參考';
 const official=typeof scholarshipOfficialUrl==='function'?scholarshipOfficialUrl(a):String(a?.detailUrl||a?.url||a?.externalUrl||a?.sourceUrl||'').trim();
 const number=typeof scholarshipNumber==='function'?scholarshipNumber(a):'';
 const life=typeof scholarshipTimeState==='function'?scholarshipTimeState(a,todayKey()):null;
 document.getElementById('scholarshipInfoTitle').textContent=a.title;
 document.getElementById('scholarshipInfoBody').innerHTML=`<div class="info-modal-grid">
  <div class="info-kv"><small>判斷結果</small><b>${esc(level)}</b></div>
  <div class="info-kv"><small>適配分數</small><b>${assessment.eligible?score+'%':'—'}</b></div>
  <div class="info-kv"><small>類型</small><b>${esc(assessment.specialty)}</b></div>
  <div class="info-kv"><small>資格判斷</small><b>${esc(assessment.reason)}</b></div>
  <div class="info-kv"><small>申請期限</small><b>${esc(a.date||a.deadline||'未標示')}</b></div>
  <div class="info-kv"><small>來源</small><b>${esc(a.source||a.scope||'官方資訊')}</b></div>
  ${number?`<div class="info-kv"><small>獎助學金編號</small><b>${esc(number)}</b></div>`:''}
  ${life?.state?`<div class="info-kv"><small>期限狀態</small><b>${esc(life.state)}</b></div>`:''}
 </div><div class="notice">${assessment.eligible
 ?'只有在清寒／低收入／經濟弱勢或軍公教／軍警消等身分是基本申請或受獎必要條件時才排除；若只是額外補助、加發或報名費補助而一般學生仍可申請基本獎勵，則保留。專業考照與外語能力獎勵仍提高排序。'
 :'此項因公告呈現明確的特定資格限制而不列入個人推薦；最終資格仍以官方簡章為準。'
 }</div><div class="goal-info-actions">${official?`<a class="btn primary" href="${esc(safeExternalUrl(official))}" target="_blank" rel="noopener noreferrer">${number?'開啟官方詳細辦法／申請書':'查看官方資訊'}</a>`:''}${assessment.eligible&&(a.date||a.deadline)?`<button class="btn dark" type="button" onclick="addActivityToCalendar('${String(a.id).replace(/'/g,"\\'")}');closeScholarshipInfoModal()">加入申請截止日</button>`:''}<button class="btn" type="button" onclick="closeScholarshipInfoModal()">關閉</button></div>`;
 document.getElementById('scholarshipInfoModal').classList.add('show');document.body.style.overflow='hidden';bindInteractionFeedback();
}
function closeScholarshipInfoModal(){const m=document.getElementById('scholarshipInfoModal');if(m)m.classList.remove('show');document.body.style.overflow='';}
