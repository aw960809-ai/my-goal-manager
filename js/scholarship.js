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

function scholarshipFit(a){
 const text=(String(a.title||'')+' '+String(a.keywords||'')+' '+String(a.description||'')).toLowerCase();
 let score=50;
 if(/東海|東海大學/.test(text))score+=25;
 if(/法律|法治|司法|法學/.test(text))score+=15;
 if(/大學|學生|在學/.test(text))score+=5;
 if(/成績|學業|gpa|排名/.test(text))score+=5;
 if(/清寒|低收入|中低收入|原住民|身心障礙|單親|家境|家庭收入|戶籍/.test(text))score-=0;
 return Math.min(99,score);
}
function renderScholarships(){
 const box=document.getElementById('scholarshipList');if(!box)return;ensureActivities();
 const today=todayKey(),filter=document.getElementById('scholarshipFilter')?.value||'全部';
 if(filter!==scholarshipLastFilter){scholarshipPage=1;scholarshipLastFilter=filter}
 let arr=scholarshipStore().map(a=>({...a,score:scholarshipFit(a)}));
 arr=arr.filter(a=>{if(filter==='高度符合')return a.score>=80;if(filter==='可能符合')return a.score>=60&&a.score<80;if(filter==='近期截止')return !!a.date&&a.date>=today&&daysUntil(a.date)<=30;return true});
 arr.sort((a,b)=>(a.date||'9999-12-31').localeCompare(b.date||'9999-12-31')||b.score-a.score);
 const high=arr.filter(a=>a.score>=80).length,pages=Math.max(1,Math.ceil(arr.length/SCHOLARSHIP_PAGE_SIZE));
 scholarshipPage=Math.min(Math.max(1,scholarshipPage),pages);
 const pageItems=arr.slice((scholarshipPage-1)*SCHOLARSHIP_PAGE_SIZE,scholarshipPage*SCHOLARSHIP_PAGE_SIZE);
 const stats=document.getElementById('scholarshipStats');
 if(stats)stats.innerHTML=`目前 <b>${arr.length}</b> 項 · 高度符合 ${high} 項 · 第 ${arr.length?scholarshipPage:0}/${arr.length?pages:0} 頁 · 每頁最多 ${SCHOLARSHIP_PAGE_SIZE} 項`;
 box.innerHTML=pageItems.map(a=>{const level=a.score>=80?'高度符合':a.score>=60?'可能符合':'參考';const cls=level==='高度符合'?'':' '+(level==='可能符合'?'gold':'gray');return `<button class="row scholarship-card scholarship-action-row" type="button" onclick="openScholarshipInfo('${String(a.id).replace(/'/g,"\\'")}')"><span class="main"><span class="title">${esc(a.title)}</span><span class="meta">${a.date?'截止 '+esc(a.date.slice(5).replace('-','/'))+' · ':''}${esc(a.source||a.scope||'官方資訊')}</span></span><span class="badge${cls}">${level}</span><span class="scholarship-chevron" aria-hidden="true">›</span></button>`}).join('')||'<div class="empty">目前沒有符合條件的獎學金資料。</div>';
 renderScholarshipPagination(arr.length);
}
function openScholarshipInfo(id){
 const a=scholarshipStore().find(x=>String(x.id)===String(id));if(!a)return;
 const score=scholarshipFit(a),level=score>=80?'高度符合':score>=60?'可能符合':'參考',official=scholarshipOfficialUrl(a),number=scholarshipNumber(a);
 document.getElementById('scholarshipInfoTitle').textContent=a.title;
 document.getElementById('scholarshipInfoBody').innerHTML=`<div class="info-modal-grid">
 <div class="info-kv"><small>判斷結果</small><b>${level}</b></div>
 <div class="info-kv"><small>適配分數</small><b>${score}%</b></div>
 <div class="info-kv"><small>申請期限</small><b>${esc(a.date||'未標示')}</b></div>
 <div class="info-kv"><small>來源</small><b>${esc(a.source||a.scope||'官方資訊')}</b></div>
 ${number?`<div class="info-kv"><small>獎助學金編號</small><b>${esc(number)}</b></div>`:''}
 <div class="info-kv"><small>家境／收入</small><b>不納入判斷</b></div>
 <div class="info-kv"><small>身分條件</small><b>不納入排序</b></div>
 </div><div class="notice">判斷依學校、科系、年級、成績／專業與公告客觀要求；若公告仍有資格文字未能自動解析，會標示為「可能符合」而不武斷排除。</div>
 <div class="goal-info-actions">${official?`<a class="btn primary" href="${esc(safeExternalUrl(official))}" target="_blank" rel="noopener noreferrer">${number?'開啟官方詳細辦法／申請書':'查看官方資訊'}</a>`:''}${a.date?`<button class="btn dark" type="button" onclick="addActivityToCalendar('${String(a.id).replace(/'/g,"\\'")}');closeScholarshipInfoModal()">加入申請截止日</button>`:''}<button class="btn" type="button" onclick="closeScholarshipInfoModal()">關閉</button></div>`;
 document.getElementById('scholarshipInfoModal').classList.add('show');document.body.style.overflow='hidden';bindInteractionFeedback();
}
function closeScholarshipInfoModal(){const m=document.getElementById('scholarshipInfoModal');if(m)m.classList.remove('show');document.body.style.overflow='';}
