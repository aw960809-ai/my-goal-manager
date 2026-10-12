/* TOEIC Trainer V0.4.3.2 — one-tap reading/grammar/vocab browsing; exam engine, banks and storage unchanged. */
(function(){
'use strict';
const Prefs=window.ToeicTrainerPreferences;
const Core=window.ToeicTrainerCore,Content=window.ToeicTrainerContent,Advanced=window.ToeicTrainerAdvanced,Bridge=window.ToeicTrainerBridge,V04=window.ToeicTrainerV04,V041=window.ToeicTrainerV041,V042=window.ToeicTrainerV042,BankAudit=window.ToeicTrainerBankAudit,LengthPolicy=window.ToeicTrainerLengthPolicy,Exam=window.ToeicTrainerExam,Quality=window.ToeicTrainerQuality,Quality043=window.ToeicTrainerQualityV043;
if(!Prefs||!Core||!Content||!Advanced||!Bridge||!V04||!V041||!V042||!BankAudit||!LengthPolicy||!Exam||!Quality||!Quality043){document.body.textContent='閱讀、單字、文法或題庫資料載入失敗，請重新開啟程式。';return}
const legacyGrammarTopics={deadline:'prepositions','word-form':'word-form',determiner:'word-form',cause:'condition',
  'present-perfect':'tense',comparison:'comparison',collocation:'prepositions',agreement:'agreement',
  infinitive:'infinitive',condition:'condition',passive:'passive'};
const cards=[...Content.cards,...Advanced.cards,...V04.cards];
const questions=[...Content.questions.filter(q=>[5,6,7].includes(q.part)).map(q=>({...q,grammarTopic:legacyGrammarTopics[q.tag]||null})),...Advanced.questions,...V04.questions,...V041.questions,...V042.questions];
const readingLessons=[...Advanced.readingLessons,...V04.readingLessons,...V041.readingLessons],grammarLessons=[...Advanced.grammarLessons,...V04.grammarLessons];
const grammarById=Object.fromEntries(grammarLessons.map(lesson=>[lesson.id,lesson]));
const readingById=Object.fromEntries(readingLessons.map(lesson=>[lesson.id,lesson]));
const fatal=Core.validateBank(cards,questions);
const auditResult=BankAudit.audit({cards,questions,readingLessons,grammarLessons,expected:{cards:800,questions:640,reading:43,grammar:20,part5:368,part6:44,part7:228}});
const lengthAudit=LengthPolicy.audit({readingLessons:V041.readingLessons,questions:V041.questions,existingReadingIds:[...Advanced.readingLessons,...V04.readingLessons].map(l=>l.id),existingQuestionIds:[...Content.questions.filter(q=>q.part>=5),...Advanced.questions,...V04.questions].map(q=>q.id)});
const oldQuestions=questions.filter(q=>!q.id.startsWith('v42-'));
const quality=Quality.check({legacy:oldQuestions,fresh:V042.questions,reading:readingLessons});
const officialMockAudit=Exam.validateMock(questions,V042.mock);
const machineAudit=Quality043.inspect({questions,cards,readingLessons,grammarLessons});
fatal.push(...auditResult.errors,...lengthAudit.errors,...quality.errors,...officialMockAudit.issues,...machineAudit.errors.map(x=>x.id+': '+x.detail));
if(fatal.length){document.body.textContent='題庫檢查失敗：'+fatal.slice(0,6).join('; ');return}
const byId=id=>document.getElementById(id);
const form=$=>document.querySelector($);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const summaryLabel={review:'短時間複習／弱點快速複習',article:'文章整合／文章精讀',practice:'題目＋檢討',mock:'模考／考試適應'};
const names={5:'Incomplete Sentences',6:'Text Completion',7:'Reading Comprehension'};
const defaultState=()=>Core.fresh();
let visualPrefs=Prefs.DEFAULT;try{visualPrefs=Prefs.load(window.localStorage)}catch(_){}
let state=defaultState(),storageBlocked=false,storeReason='',currentTab='home',active=null,quiz=null,vocab=null,readingRun=null,quizTopic=null,toastTimer=null,savedDraft=null,lastCompletedReview=null;
// Goal Manager backup is transient read-only input: never stored, never written back.
let goalSnapshot=null,bridgeReport=null,bridgeSelected=new Set(),readingResultVisible=false;
let vocabView='test',vocabListPage=0,readingListPage=0,grammarListPage=0,grammarCategory='recommended';
const READING_PAGE_SIZE=7,GRAMMAR_PAGE_SIZE=6;
const GRAMMAR_GROUPS=Object.freeze({
  verbs:['tense','agreement','passive','modals','infinitive','gerunds','causatives'],
  words:['word-form','articles','quantifiers','prepositions','comparison','pronouns'],
  clauses:['relative','condition','noun-clauses','adverb-clauses','transitions'],
  advanced:['participles','inversion']
});
const VOCAB_PAGE_SIZE=8;
function syncFocusShell(){
  const result=byId('practiceFinished');
  const readingPage=currentTab==='reading',grammarPage=currentTab==='grammar';
  document.body.classList.toggle('tt-quiz-active',!!quiz&&(readingPage||grammarPage));
  document.body.classList.toggle('tt-quiz-complete',!quiz&&(readingPage||grammarPage)&&!!result&&!result.hidden);
  document.body.classList.toggle('tt-reading-active',!!readingRun&&readingPage);
  document.body.classList.toggle('tt-reading-complete',!readingRun&&readingPage&&readingResultVisible);
}
function revealActiveExam(selector){
  requestAnimationFrame(()=>document.querySelector(selector)?.scrollIntoView({block:'start',behavior:'auto'}));
}
function notify(msg){const t=byId('toast');t.textContent=msg;t.hidden=false;if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,3600)}
function bootStorage(){
  try{
    const raw=localStorage.getItem(Core.KEY);
    if(raw){
      try{state=Core.normalized(JSON.parse(raw));}
      catch(error){
        const backup=localStorage.getItem(Core.BACKUP_KEY);
        if(backup){try{state=Core.normalized(JSON.parse(backup));}catch(_){state=defaultState()}}
        storageBlocked=true;storeReason='發現損壞的本機紀錄：目前唯讀，請先匯出再處理。';
      }
    }
  }catch(error){storageBlocked=true;storeReason='無法讀取本機儲存空間，資料只在這次開啟期間保留。'}
  try{
    const candidate=localStorage.getItem(Exam.DRAFT_KEY);
    if(candidate)savedDraft=Exam.validDraft(candidate,questions).draft;
  }catch(error){console.warn('Previous draft could not be restored:',error);}
  renderStoreStatus();
}
function renderStoreStatus(){
  const out=byId('storageStatus');
  out.textContent=storageBlocked?'儲存異常 · 請匯出備份':'本機獨立紀錄';
  out.title=storeReason;
}
function persist(){
  if(storageBlocked){notify(storeReason||'本機儲存不可用，請先匯出紀錄。');return false}
  try{
    const old=localStorage.getItem(Core.KEY),json=JSON.stringify(state);
    localStorage.setItem(Core.KEY,json);
    if(localStorage.getItem(Core.KEY)!==json)throw new Error('寫入後驗證失敗');
    if(old&&old!==json){try{localStorage.setItem(Core.BACKUP_KEY,old)}catch(_){console.warn('訓練資料備份槽無法更新')}}
    return true;
  }catch(error){
    storageBlocked=true;storeReason='資料未能確認寫入成功，請先下載備份。';
    renderStoreStatus();notify(storeReason);return false;
  }
}
function saveDraft(draft=quiz?.draft||readingRun?.draft){
  if(!draft)return false;
  if(active&&!draft.timed)draft.elapsedSeconds=Math.floor(active.seconds);
  try{
    const serialized=JSON.stringify(draft);
    localStorage.setItem(Exam.DRAFT_KEY,serialized);
    if(localStorage.getItem(Exam.DRAFT_KEY)!==serialized)throw new Error('暫存寫入後驗證失敗');
    savedDraft=draft;renderDraftBanner();return true;
  }catch(error){notify('未能保存作答草稿，請檢查 Chrome 儲存空間');return false;}
}
function deleteDraft(){
  try{localStorage.removeItem(Exam.DRAFT_KEY);savedDraft=null;renderDraftBanner()}catch(error){console.warn('Draft cleanup failed',error)}
}
function renderDraftBanner(){
  const banner=byId('draftBanner');if(!banner)return;
  banner.hidden=!savedDraft||!!quiz||!!readingRun;
  if(!banner.hidden){
    const count=Exam.completed(savedDraft),total=savedDraft.itemIds.length;
    byId('draftLabel').textContent=`未完成試卷：${savedDraft.mode==='official-reading-mock'?'100 題閱讀模考':savedDraft.mode==='guided-reading'?'文章理解題':savedDraft.context==='vocab'?'單字測驗':'閱讀／文法練習'} · ${count}/${total} 題已作答${savedDraft.timed?' · 計時不因暫存而暫停':''}`;
  }
}
function pauseExam(){
  const draft=quiz?.draft||readingRun?.draft;
  if(!draft)return;
  if(!window.confirm(draft.timed?'確定暫存離開？75 分鐘的倒數仍會繼續。':'暫存目前答案並離開？返回後可以繼續作答。'))return;
  if(!saveDraft(draft))return;
  quiz=null;readingRun=null;endClock();
  byId('practiceFinished').hidden=true;
  byId('readingLessonPanel').hidden=true;
  tab(draft.context);renderDraftBanner();notify('已保存本次尚未交卷的試卷');
}
function resumeExam(){
  if(!savedDraft||quiz||readingRun)return;
  let restored;
  try{restored=Exam.validDraft(savedDraft,questions)}catch(e){notify('無法恢復試卷：'+e.message);return}
  const {draft,items}=restored;
  if(draft.mode==='guided-reading'){
    const lesson=readingById[draft.guidedLessonId];
    if(!lesson){notify('文章已不存在，暫存試卷尚未刪除');return}
    readingRun={lesson,draft,answers:draft.responses};
  }else quiz={draft,items,context:draft.context,mode:draft.mode,part:draft.part||'all',topic:draft.topic||null};
  active={kind:readingRun?'reading':'practice',seconds:draft.elapsedSeconds||0,lastTick:performance.now()};
  currentTab=draft.context;tab(draft.context);renderDraftBanner();
  if(draft.timed&&Exam.elapsed(draft)>=draft.durationSeconds)finishQuiz(true);
  else revealActiveExam(readingRun?'#readingLessonPanel':draft.context==='vocab'?'#vocabSession':'#practiceSession');
}
function resetFinishedReview(){lastCompletedReview=null;byId('practiceFinished').hidden=true;}
function syncVisualSettings(){
  Prefs.apply(document.documentElement,visualPrefs);
  for(const [group,field] of [['settingsAppearanceButtons','appearance'],['settingsAccentButtons','accent'],['settingsTextSizeButtons','textSize']]){
    byId(group)?.querySelectorAll('button').forEach(button=>{
      const chosen=button.dataset[field+'Value']===visualPrefs[field];
      button.classList.toggle('active',chosen);
      button.setAttribute('aria-pressed',String(chosen));
    });
  }
}
function updateVisualPreference(field,value){
  try{
    const next=Prefs.save(window.localStorage,{...visualPrefs,[field]:value});
    visualPrefs=next;
    syncVisualSettings();
  }catch(error){
    notify('外觀設定未能永久保存，原有學習紀錄不受影響。');
  }
}
function syncVocabView(){
  const running=!!quiz&&quiz.context==='vocab';
  const library=vocabView==='library'&&!running;
  byId('vocabViewTabs').hidden=running;
  byId('vocabIntro').hidden=running||library;
  byId('vocabLibraryPanel').hidden=!library;
  byId('vocabPageTitle').textContent=library?'單字庫與收藏':'單字記憶測驗';
  byId('vocabPageDescription').textContent=library
    ?'查閱詞義、搭配詞與收藏，獨立於正式測驗的抽題條件。'
    :'整組字彙四選一。交卷前不顯示詞義、答對率或解析；交卷後安排下一次間隔複習。';
  byId('vocabViewTabs').querySelectorAll('[data-vocab-view]').forEach(button=>{
    const chosen=button.dataset.vocabView===vocabView;
    button.classList.toggle('active',chosen);
    button.setAttribute('aria-pressed',String(chosen));
  });
}
function changeVocabView(view){
  if(!['test','library'].includes(view))return;
  if(view==='library'&&quiz?.context==='vocab'){
    notify('單字測驗作答中不可查看單字庫，請先交卷或暫存離開。');return;
  }
  vocabView=view;
  syncVocabView();
  if(view==='library')renderWordLookup();
}
function renderSettings(){
  syncVisualSettings();
  renderBridge();
  const status=byId('settingsStorageHealth');
  if(status)status.textContent=storageBlocked?'學習資料儲存異常：'+(storeReason||'請先下載備份'):'學習紀錄與外觀偏好分開儲存；Goal Manager 維持只讀核對';
}
function tab(id){
  if(id==='analysis')id='mistakes';
  if(!['home','vocab','reading','grammar','mistakes','history','settings'].includes(id))return;
  if(quiz&&id!==quiz.context){notify('試卷進行中，請先交卷或暫存離開。');id=quiz.context;}
  if(readingRun&&id!=='reading'){notify('文章測驗進行中，請先交卷或暫存。');id='reading';}
  if(id!==currentTab&&['reading','grammar'].includes(id))byId('practiceFinished').hidden=true;
  if(id!==currentTab)readingResultVisible=false;
  currentTab=id;
  const panel=['reading','grammar'].includes(id)?'practice':id;
  document.querySelectorAll('.tab-page').forEach(el=>el.hidden=el.id!==`tab-${panel}`);
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    const a=btn.dataset.tab===(['mistakes','history'].includes(id)?'analysis':id);
    btn.classList.toggle('active',a);
    if(a)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');
  });
  if(id==='home')renderHome();
  if(id==='vocab'){renderVocab();if(quiz?.context==='vocab')renderQuiz();}
  if(id==='reading'||id==='grammar'){
    if(!quiz){
      byId('practiceMode').value=id;
      quizTopic=null;
      if(id==='reading'&&byId('practicePart').value==='5')byId('practicePart').value='all';
      if(id==='grammar'&&byId('practicePart').value==='7')byId('practicePart').value='all';
    }
    byId('readingCoach').hidden=id!=='reading';
    byId('officialMockPanel').hidden=id!=='reading';
    byId('grammarCoach').hidden=id!=='grammar';
    byId('practicePageTitle').textContent=id==='grammar'?'文法訓練':'閱讀理解';
    byId('practiceQuestionTitle').textContent=id==='grammar'?'日常文法題組':'日常閱讀題組';
    byId('practiceEyebrow').textContent=id==='grammar'?'GRAMMAR · UNDERSTAND THE PATTERN':'READING · UNDERSTAND THE CONTEXT';
    byId('practicePageDescription').textContent=id==='grammar'
      ?'選擇文法主題，整份交卷後才會公布規則與詳解。':'閱讀原文並完成題組，整份交卷後才解鎖中文、句型與答案。';
    [...byId('practicePart').options].forEach(opt=>{
      opt.hidden=opt.value!=='all'&&(id==='grammar'?opt.value==='7':opt.value==='5');
    });
    syncChoiceButtons();renderPoolHint();renderQuiz();
    if(id==='reading'){renderReadingBrowser();renderReadingLesson()}else{renderGrammarBrowser();renderGrammarLesson()};
  }
  const analysis=byId('analysisSwitcher');
  if(analysis){
    analysis.hidden=!['mistakes','history'].includes(id);
    analysis.querySelectorAll('[data-analysis-tab]').forEach(btn=>{
      const selected=btn.dataset.analysisTab===id;
      btn.classList.toggle('active',selected);
      btn.setAttribute('aria-pressed',String(selected));
    });
  }
  if(id==='mistakes')renderMistakes();
  if(id==='history')renderHistory();
  if(id==='settings')renderSettings();
  if(id!=='vocab')window.speechSynthesis?.cancel();
  window.scrollTo({top:0,behavior:'instant'});
  if(active)active.lastTick=performance.now();
  renderDraftBanner();syncFocusShell();
}
function timeStr(s){const n=Math.max(0,Math.floor(s||0));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
function minutesLabel(seconds){return `${Math.floor((seconds||0)/60)}分${Math.round(seconds||0)%60}秒`}
function totalSeconds(){return state.sessions.reduce((a,s)=>a+Math.max(0,Number(s.seconds)||0),0)}
function totalAnswers(){return questions.reduce((a,q)=>a+(Number(state.questionStats[q.id]?.correct)||0)+(Number(state.questionStats[q.id]?.wrong)||0),0)}
function totalCorrect(){return questions.reduce((a,q)=>a+(Number(state.questionStats[q.id]?.correct)||0),0)}
function countDue(){return cards.filter(c=>Core.reviewIsDue(state.review[c.id])).length}
function mistakeQuestions(){return questions.filter(q=>Core.inMistakePool(state.questionStats[q.id]))}
function statCard(label,value){return `<div class="metric"><b>${esc(value)}</b><span>${esc(label)}</span></div>`}
function renderHome(){
  const ans=totalAnswers(),right=totalCorrect();
  byId('homeMetrics').innerHTML=[
    statCard('已完成訓練',state.sessions.length+' 次'),
    statCard('累計專注時間',Math.round(totalSeconds()/60)+' 分'),
    statCard('練習正確率',ans?Math.round(100*right/ans)+'%':'—'),
    statCard('待學／到期單字',countDue()+' 張')
  ].join('');
}
function vocabMatching(){
  const filter=byId('vocabFilter').value,needle=byId('vocabSearch').value.trim().toLocaleLowerCase();
  return cards.filter(card=>{
    if(filter==='due'&&!Core.reviewIsDue(state.review[card.id]))return false;
    if(filter==='saved'&&!state.savedWordIds.includes(card.id))return false;
    if(!['all','due','saved'].includes(filter)&&card.tag!==filter)return false;
    return !needle||[card.word,card.zh,card.example,card.collocation].some(t=>String(t).toLocaleLowerCase().includes(needle));
  });
}
function renderWordLookup(){
  const available=vocabMatching(),out=byId('vocabLookupList');
  syncVocabFilterButtons();
  byId('wordDictionaryCount').textContent=`${available.length} 張可查詢`;
  if(!available.length){vocabListPage=0;out.innerHTML='<div class="empty">目前沒有符合條件的單字。請更換搜尋字或分類。</div>';return}
  const pages=Math.max(1,Math.ceil(available.length/VOCAB_PAGE_SIZE));
  vocabListPage=Math.min(pages-1,Math.max(0,vocabListPage));
  const first=vocabListPage*VOCAB_PAGE_SIZE;
  out.innerHTML=available.slice(first,first+VOCAB_PAGE_SIZE).map(card=>{
    const saved=state.savedWordIds.includes(card.id);
    return `<div class="word-row"><div><b lang="en">${esc(card.word)}</b><small>${esc(card.pos)} · ${esc(card.zh)}<span> · ${esc(card.collocation)}</span></small></div><button class="btn btn-light" type="button" data-bookmark="${esc(card.id)}" aria-pressed="${saved}">${saved?'已收藏 ✓':'＋ 收藏'}</button></div>`;
  }).join('')+`<nav class="word-pages" aria-label="單字查詢分頁"><button class="btn btn-light" type="button" data-vocab-page="prev" ${vocabListPage===0?'disabled':''}>上一頁</button><span aria-live="polite">${vocabListPage+1} / ${pages} 頁 · ${first+1}–${Math.min(first+VOCAB_PAGE_SIZE,available.length)} 張</span><button class="btn btn-light" type="button" data-vocab-page="next" ${vocabListPage+1===pages?'disabled':''}>下一頁</button></nav>`;
  out.querySelectorAll('[data-bookmark]').forEach(button=>button.onclick=()=>toggleBookmark(button.dataset.bookmark));
  out.querySelectorAll('[data-vocab-page]').forEach(button=>button.onclick=()=>{
    vocabListPage+=button.dataset.vocabPage==='prev'?-1:1;
    renderWordLookup();
    byId('wordDictionary').scrollIntoView({block:'nearest',behavior:'auto'});
  });
}
function toggleBookmark(id){
  if(!cards.some(c=>c.id===id))return;
  const ids=new Set(state.savedWordIds);
  if(ids.has(id))ids.delete(id);else ids.add(id);
  state.savedWordIds=[...ids];persist();
  renderWordLookup();
  if(readingRun)renderReadingLesson();
}
function renderVocab(){
  byId('vocabPoolLabel').textContent=`共 ${cards.length} 張字卡，待學／到期 ${countDue()} 張`;
  syncVocabView();
  if(!quiz||quiz.context!=='vocab'){
    byId('vocabSession').hidden=true;
    if(vocabView==='library')renderWordLookup();
    return;
  }
  byId('vocabSession').hidden=false;
}

function idNew(){
  const id=typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
  return 'tt-'+id.toLowerCase();
}
function startClock(kind){active={kind,seconds:0,lastTick:performance.now()}}
function endClock(){const seconds=active?Math.round(active.seconds):0;active=null;return seconds}
function startVocab(){
  if(quiz||readingRun)return notify('請先結束或暫存目前的試卷');
  if(savedDraft)return notify('已有未完成的試卷，請先繼續或選擇放棄草稿。');
  const count=Number(byId('vocabCount').value)||10;
  // Dictionary filters are browse-only and must never silently constrain formal tests.
  const pool=cards;const due=pool.filter(c=>Core.reviewIsDue(state.review[c.id]));
  const rest=pool.filter(c=>!due.includes(c));
  const randomize=x=>x.map(item=>({item,r:Math.random()})).sort((a,b)=>a.r-b.r).map(x=>x.item);
  const selected=[...randomize(due),...randomize(rest)].slice(0,count);
  if(!selected.length)return notify('目前沒有可用的單字');
  const items=Exam.vocabQuestions(selected.map(c=>c),{random:Math.random});
  const draft=Exam.start(items,{context:'vocab',mode:'vocabulary',type:'vocab'});
  quiz={items,draft,context:'vocab',mode:'vocabulary',part:'all',topic:null};
  vocabView='test';startClock('practice');saveDraft();tab('vocab');renderQuiz();revealActiveExam('#vocabSession');
}
function updateReadingLevelHint(){
  const pick=readingById[byId('readingLessonSelect')?.value];
  const out=byId('readingLevelHint');if(!out)return;
  if(!pick){out.textContent='目前沒有符合難度的文章。';return}
  const n=pick.wordCount||LengthPolicy.words(LengthPolicy.readingText(pick));
  const lvl=LengthPolicy.LEVELS[pick.tier];
  const progress=state.readingProgress[pick.id];
  out.textContent=(lvl?lvl.label:'既有文章（原樣保留）')+' · 約 '+n+' 個英文詞'+(lvl?' · 建議 '+lvl.minutes:'')+
    (progress?.attempts?' · 已練 '+progress.attempts+' 次／最佳 '+progress.best+'%':'');
}
function setPressedGroup(selector,value,key){
  document.querySelectorAll(selector).forEach(button=>{
    const on=button.dataset[key]===value;
    button.classList.toggle('active',on);
    button.setAttribute('aria-pressed',String(on));
  });
}
function renderReadingBrowser(){
  const out=byId('readingArticleList');if(!out)return;
  const tier=byId('readingLevelSelect').value||'foundation';
  const phrase=byId('readingSearch').value.trim().toLocaleLowerCase();
  const matches=LengthPolicy.filterLessons(readingLessons,tier).filter(l=>
    !phrase||[l.title,l.kind,l.level,l.tier].some(s=>String(s||'').toLocaleLowerCase().includes(phrase)));
  const visible=matches.slice(0,(readingListPage+1)*READING_PAGE_SIZE);
  setPressedGroup('#readingLevelTabs [data-reading-level]',tier,'readingLevel');
  byId('readingBrowserCount').textContent=`找到 ${matches.length} 篇 · 目前顯示 ${visible.length} 篇`;
  out.innerHTML=visible.length?visible.map(lesson=>{
    const wc=lesson.wordCount||LengthPolicy.words(LengthPolicy.readingText(lesson));
    const lvl=lesson.tier==='foundation'?'基礎':lesson.tier==='intermediate'?'中階':lesson.tier==='advanced'?'高階':'既有';
    const p=state.readingProgress[lesson.id];
    const progress=p?.attempts?`已練 ${p.attempts} 次 · 最佳 ${p.best}%`:'尚未練習';
    return `<button type="button" class="tt-list-row tt-reading-row" data-reading-id="${esc(lesson.id)}" aria-label="開始 ${esc(lesson.title)} 文章測驗"><span class="tt-list-copy"><b lang="en">${esc(lesson.title)}</b><small>${esc(lvl)} · ${wc} 詞 · ${esc(lesson.kind||'閱讀')}</small></span><span class="tt-list-trailing"><small>${esc(progress)}</small><span aria-hidden="true">›</span></span></button>`;
  }).join(''):'<p class="tt-list-empty">沒有符合條件的文章，請調整難度或關鍵字。</p>';
  byId('readingLoadMore').hidden=visible.length>=matches.length;
  out.querySelectorAll('[data-reading-id]').forEach(button=>button.onclick=()=>{
    const value=button.dataset.readingId;
    byId('readingLessonSelect').value=value;
    updateReadingLevelHint();
    startReadingLesson();
  });
}
function recommendGrammarTopics(){
  return grammarLessons.map((g,i)=>{
    const rows=questions.filter(q=>q.grammarTopic===g.id);
    const seen=rows.reduce((sum,q)=>sum+Number(state.questionStats[q.id]?.correct||0)+Number(state.questionStats[q.id]?.wrong||0),0);
    const wrong=rows.reduce((sum,q)=>sum+Number(state.questionStats[q.id]?.wrong||0),0);
    return {g,i,seen,wrong};
  }).sort((a,b)=>Number(b.wrong>0)-Number(a.wrong>0)||b.wrong-a.wrong||a.seen-b.seen||a.i-b.i)
    .slice(0,5).map(row=>row.g);
}
function renderGrammarBrowser(){
  const out=byId('grammarTopicList');if(!out)return;
  const phrase=byId('grammarSearch').value.trim().toLocaleLowerCase();
  let source=grammarCategory==='recommended'?recommendGrammarTopics():grammarLessons.filter(g=>
    grammarCategory==='all'||(GRAMMAR_GROUPS[grammarCategory]||[]).includes(g.id));
  if(phrase)source=grammarLessons.filter(g=>g.title.toLocaleLowerCase().includes(phrase)||g.id.includes(phrase));
  const visible=source.slice(0,(grammarListPage+1)*GRAMMAR_PAGE_SIZE);
  setPressedGroup('#grammarCategoryTabs [data-grammar-category]',grammarCategory,'grammarCategory');
  byId('grammarBrowserCount').textContent=(phrase?'搜尋結果':'文法主題')+` ${source.length} 個 · 顯示 ${visible.length} 個`;
  out.innerHTML=visible.length?visible.map(g=>{
    const qs=questions.filter(q=>q.grammarTopic===g.id);
    const practiced=qs.reduce((sum,q)=>sum+Number(state.questionStats[q.id]?.correct||0)+Number(state.questionStats[q.id]?.wrong||0),0);
    return `<button type="button" class="tt-list-row tt-grammar-row" data-grammar-topic="${esc(g.id)}" aria-label="開始 ${esc(g.title)} 文法測驗"><span class="tt-list-copy"><b>${esc(g.title)}</b><small>${qs.length} 道題 · ${practiced?'已作答 '+practiced+' 題次':'尚未練習'}</small></span><span class="tt-list-trailing"><span aria-hidden="true">›</span></span></button>`;
  }).join(''):'<p class="tt-list-empty">沒有符合條件的文法主題。</p>';
  byId('grammarLoadMore').hidden=visible.length>=source.length;
  out.querySelectorAll('[data-grammar-topic]').forEach(button=>button.onclick=()=>{
    byId('grammarTopicSelect').value=button.dataset.grammarTopic;
    renderGrammarLesson();
    byId('startTopicPractice').click();
  });
}
function syncVocabFilterButtons(){
  const current=byId('vocabFilter')?.value||'all';
  setPressedGroup('[data-vocab-filter]',current,'vocabFilter');
  byId('vocabCategoryDetails').open=!['all','due','saved'].includes(current);
}
// Keep the original select as the source of truth. The direct buttons only set values
// and dispatch the same change events as before, preserving tested exam logic.
function enhanceChoiceSelect(id,labels){
  const select=byId(id),parent=select?.closest('label.field');
  if(!select||!parent||parent.dataset.ttEnhanced)return;
  const container=document.createElement('div');container.className='field tt-choice-field';
  const legend=document.createElement('span');legend.textContent=parent.querySelector('span')?.textContent||'選擇';
  container.append(legend);select.classList.add('tt-source-select');
  select.setAttribute('aria-label',legend.textContent);container.append(select);
  const row=document.createElement('div');row.className='tt-tabs tt-choice-tabs';row.setAttribute('role','group');row.setAttribute('aria-label',legend.textContent);
  for(const option of select.options){
    const btn=document.createElement('button');btn.type='button';btn.dataset.choiceValue=option.value;
    btn.textContent=labels?.[option.value]||option.textContent;row.append(btn);
    btn.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync()});
  }
  container.append(row);parent.replaceWith(container);
  function sync(){
    row.querySelectorAll('[data-choice-value]').forEach(btn=>{
      const active=btn.dataset.choiceValue===select.value;btn.classList.toggle('active',active);
      btn.setAttribute('aria-pressed',String(active));
      const option=[...select.options].find(o=>o.value===btn.dataset.choiceValue);
      btn.hidden=!!option?.hidden;
    });
  }
  select.addEventListener('change',sync);
  // Programmatic changes by existing code also need to update visible controls.
  select.__syncChoices=sync;
  sync();
}
function syncChoiceButtons(){
  for(const id of ['vocabCount','practicePart','practiceTier','practiceCount'])byId(id)?.__syncChoices?.();
}
function updateReadingLevelOptions(){
  const tier=byId('readingLevelSelect')?.value||'foundation';
  const select=byId('readingLessonSelect');if(!select)return;
  const old=select.value;
  const selected=LengthPolicy.filterLessons(readingLessons,tier);
  select.innerHTML=selected.map(l=>`<option value="${esc(l.id)}">${esc(l.title)} · ${l.wordCount||LengthPolicy.words(LengthPolicy.readingText(l))} 詞</option>`).join('');
  if(selected.some(l=>l.id===old))select.value=old;
  updateReadingLevelHint();renderReadingBrowser();
}
function renderPoolHint(){
  const mode=byId('practiceMode').value,part=byId('practicePart').value,tier=byId('practiceTier')?.value||'all';
  const topic=currentTab==='grammar'?quizTopic:null;
  const accepted=(mode==='grammar'?[5,6]:[6,7]);
  const qs=questions.filter(q=>accepted.includes(q.part)&&(part==='all'||q.part===Number(part))&&(!topic||q.grammarTopic===topic)&&(tier==='all'||(tier==='legacy'?!q.tier:q.tier===tier)));
  byId('practicePoolHint').textContent=`可用 ${qs.length} 道原創題目${topic?' · 本主題':''} · 日常組卷不拆散同篇／跨篇題組，實際題數可能少於指定上限；答案與解析交卷後解鎖。`;
  syncChoiceButtons();
}
function startPractice(modeOverride,topicOverride){
  if(quiz||readingRun)return notify('已有正在進行的測驗，請先交卷或暫存。');
  if(savedDraft)return notify('請先繼續尚未完成的試卷，或放棄舊草稿。');
  if(modeOverride)byId('practiceMode').value=modeOverride;
  const mode=byId('practiceMode').value,partRaw=byId('practicePart').value,part=partRaw==='all'?null:Number(partRaw);
  const topic=topicOverride||((mode==='grammar'&&currentTab==='grammar')?quizTopic:null);
  const tier=mode==='mistakes'?'all':byId('practiceTier')?.value||'all';
  let readingId=null;
  if(mode==='reading'&&LengthPolicy.LEVELS[tier]&&(part===null||part===7)){
    const lesson=LengthPolicy.pickNextArticle(LengthPolicy.filterLessons(V041.readingLessons,tier),state.questionStats,questions);
    readingId=lesson?.id||null;
  }
  // Official-format practice: keep complete Part 6 / Part 7 shared-document groups together.
  const accepted=mode==='mistakes'?[5,6,7]:mode==='grammar'?[5,6]:[6,7];
  const eligible=questions.filter(q=>accepted.includes(q.part)&&(!part||q.part===part)&&
    (!topic||q.grammarTopic===topic)&&(!readingId||q.readingId===readingId)&&
    (tier==='all'||(tier==='legacy'?!q.tier:q.tier===tier))&&
    (mode!=='mistakes'||Core.inMistakePool(state.questionStats[q.id])));
  const items=Exam.pickPractice(eligible,{count:Number(byId('practiceCount').value),stats:state.questionStats});
  if(!items.length)return notify('本範圍暫無符合的完整題組；請調整題型、難度或題數。');
  // Daily exercises select whole context groups; the requested count is a maximum.
  const context=currentTab==='grammar'?'grammar':'reading';
  const draft=Exam.start(items,{context,mode});draft.part=partRaw;draft.topic=topic;draft.tier=tier;
  quiz={items,draft,context,mode,part:partRaw,topic};
  startClock('practice');saveDraft();renderQuiz();revealActiveExam('#practiceSession');
}
function startOfficialMock(){
  if(quiz||readingRun||savedDraft){notify('請先完成或處理舊試卷');return}
  let items;
  try{items=Exam.assembleMock(questions,V042.mock)}catch(e){notify('模考組卷失敗：'+e.message);return}
  const draft=Exam.start(items,{context:'reading',mode:'official-reading-mock',timed:true,durationSeconds:4500});
  quiz={draft,items,context:'reading',mode:'official-reading-mock',part:'all',topic:null};
  startClock('practice');saveDraft();tab('reading');renderQuiz();revealActiveExam('#practiceSession');
}
function speechText(text){return String(text||'').replace(/^\s*(?:Woman|Man):\s*/gim,'').replace(/\n/g,' ')}
function speak(text){
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window))return notify('手機目前沒有可用的英文合成語音，請使用逐字稿學習。');
  try{
    window.speechSynthesis.cancel();
    const utter=new SpeechSynthesisUtterance(speechText(text));
    const english=window.speechSynthesis.getVoices().filter(v=>/^en(-|_)/i.test(v.lang));
    const selected=english.find(v=>/^en-US/i.test(v.lang))||english[0];
    if(selected)utter.voice=selected;
    utter.lang=selected?.lang||'en-US';utter.rate=.95;
    utter.onerror=()=>notify('語音播放失敗，可查看逐字稿繼續學習。');
    window.speechSynthesis.speak(utter);
  }catch(_){notify('無法啟動英文語音，請查看逐字稿。')}
}
function renderQuiz(){
  const pView=byId('practiceSession'),vView=byId('vocabSession');
  if(!quiz){pView.hidden=true;if(!readingRun)byId('practiceSetup').hidden=false;syncFocusShell();return}
  const isVocab=quiz.context==='vocab',view=isVocab?vView:pView;
  if(isVocab){vocabView='test';syncVocabView();vView.hidden=false;byId('vocabIntro').hidden=true;pView.hidden=true}
  else{vView.hidden=true;pView.hidden=false;byId('practiceSetup').hidden=true;byId('practiceFinished').hidden=true}
  const {draft,items}=quiz,q=items[draft.index],choice=draft.responses[q.id];
  if(!q)return;
  const complete=Exam.completed(draft),total=items.length;
  const clockText=draft.timed?`剩餘 ${timeStr(Math.max(0,draft.durationSeconds-Exam.elapsed(draft)))}`:timeStr(active?.seconds);
  let html=`<div class="panel exam-panel"><div class="session-head"><span>第 ${draft.index+1}/${total} 題 · 已答 ${complete} 題</span><div class="timer" id="quizTimer">${clockText}</div></div>`;
  html+=`<div class="progress"><i style="width:${Math.round(100*complete/total)}%"></i></div>`;
  html+=`<div class="exam-banner">正式測驗｜交卷前不顯示答案、正確率與解析</div>`;
  html+=`<div class="question-label">${isVocab?'VOCABULARY':`PART ${q.part} · ${esc(names[q.part])}`} · ${esc(q.tag||'Context')} ${q.docType?' · '+(q.docType==='double'?'雙篇閱讀':'三篇閱讀'):''}</div>`;
  if(q.passage)html+=`<div class="passage" lang="en">${esc(q.passage)}</div>`;
  html+=`<div class="q-stem" lang="en">${esc(q.question)}</div><div class="answers">`;
  q.options.forEach((option,i)=>{
    html+=`<button class="answer${choice===i?' picked':''}" type="button" data-answer="${i}" aria-pressed="${choice===i}"><span class="letter">${String.fromCharCode(65+i)}</span><span>${esc(option)}</span></button>`;
  });
  html+='</div>';
  html+=`<div class="exam-nav"><button id="prevQuestion" class="btn btn-light" type="button" ${draft.index===0?'disabled':''}>← 上一題</button><div class="exam-jump"><label class="field"><span>跳至題目</span><input id="quizJump" type="number" inputmode="numeric" min="1" max="${total}" step="1" value="${draft.index+1}" aria-label="輸入前往的題號"></label><button class="btn btn-light" id="jumpQuestion" type="button">前往</button></div><button id="nextQuestion" class="btn btn-light" type="button" ${draft.index===items.length-1?'disabled':''}>下一題 →</button></div>`;
  html+=`<details class="exam-index"><summary>題號總覽 · 已答 ${complete}/${total}（不顯示正誤）</summary><div class="exam-index-grid">`+
    items.map((item,index)=>`<button type="button" data-exam-index="${index}" class="${draft.responses[item.id]!==undefined?'answered':''} ${draft.index===index?'current':''}" aria-label="第 ${index+1} 題${draft.responses[item.id]!==undefined?'已答':'未答'}" ${draft.index===index?'aria-current="step"':''}>${index+1}</button>`).join('')+
    `</div></details>`;
  html+=`<div class="quiz-bottom"><button class="btn btn-light" type="button" id="pausePractice">暫存離開</button><button class="btn btn-primary" type="button" id="submitPractice">交卷並批改${complete===total?'':'（尚有 '+(total-complete)+' 題）'}</button></div></div>`;
  view.innerHTML=html;syncFocusShell();
  view.querySelectorAll('[data-answer]').forEach(el=>el.onclick=()=>answerQuestion(Number(el.dataset.answer)));
  byId('prevQuestion').onclick=()=>{quiz.draft=Exam.move(quiz.draft,quiz.draft.index-1);saveDraft();renderQuiz()};
  byId('nextQuestion').onclick=()=>{quiz.draft=Exam.move(quiz.draft,quiz.draft.index+1);saveDraft();renderQuiz()};
  byId('jumpQuestion').onclick=()=>{const index=Number(byId('quizJump').value)-1;if(!Number.isInteger(index)||index<0||index>=items.length){notify('請輸入 1 至 '+items.length+' 的題號');return}quiz.draft=Exam.move(quiz.draft,index);saveDraft();renderQuiz()};
  view.querySelectorAll('[data-exam-index]').forEach(btn=>btn.onclick=()=>{
    quiz.draft=Exam.move(quiz.draft,Number(btn.dataset.examIndex));saveDraft();renderQuiz();
  });
  byId('pausePractice').onclick=pauseExam;
  byId('submitPractice').onclick=()=>{
    if(complete!==total){notify('尚有 '+(total-complete)+' 題未答；請全部完成後再交卷');return}
    if(window.confirm('確定正式交卷？交卷後答案不能修改，才會公布正確率與解析。'))finishQuiz(false);
  };
}
function answerQuestion(option){
  if(!quiz)return;
  const q=quiz.items[quiz.draft.index];if(!q||!Number.isInteger(option)||option<0||option>=q.options.length)return;
  quiz.draft=Exam.answer(quiz.draft,q.id,option);
  if(!saveDraft())return;
  renderQuiz();
}
function unitForQuiz(q){
  if(q.mode==='official-reading-mock')return 'mock';
  if(q.mode==='mistakes'||q.context==='vocab')return 'review';
  return q.context==='reading'?'article':'practice';
}
function goalText(e){
  if(!e.suggestedGoalTaskId)return '不在現有 TOEIC 準備期間；請在目標系統自行核對適合的任務。';
  return `${summaryLabel[e.unit]||e.unit}（參考任務 ${e.suggestedGoalTaskId}，須以目標系統實際資料為準）`;
}
function summaryEventHtml(ev){
  const eligible=ev.goalSyncEligible;
  return `<div class="copy-event">目標管理補登建議：<br>日期：${esc(ev.date)}<br>練習類型：${esc(summaryLabel[ev.unit]||ev.unit)}<br>實際專注：${esc(minutesLabel(ev.seconds))}<br>建議任務：${esc(goalText(ev))}<br>${eligible?'符合最低 1 分鐘的匯入候選條件（仍需驗證）':'不足 1 分鐘：保留在訓練紀錄，不列入自動匯入候選'}</div>`;
}
function reviewSection(items,decisions){
  const answers=new Map(decisions.map(d=>[d.id,d]));
  const needReview=decisions.filter(d=>!d.correct).length;
  return `<section class="post-review" data-review-view="all"><h3>交卷後集中檢討</h3><p class="muted">以下答案、原文依據及中英解析僅在交卷後解鎖。</p>`+
    `<div class="review-toolbar"><button class="btn btn-light active" type="button" data-review-filter="all" aria-pressed="true">全部 ${items.length} 題</button><button class="btn btn-light" type="button" data-review-filter="wrong" aria-pressed="false">只看錯題 ${needReview} 題</button></div>`+
    items.map((q,i)=>{
      const d=answers.get(q.id),ok=!!d?.correct,letter=x=>Number.isInteger(x)?String.fromCharCode(65+x):'未作答';
      return `<details class="review-detail${ok?'':' needs-review'}"><summary>第 ${i+1} 題 · ${ok?'✓ 正確':'需要檢討'} · ${esc(q.part===0?'單字':'Part '+q.part)}</summary>`+
        `<div class="review-content"><p class="q-stem">${esc(q.question)}</p>`+
        (q.passage?`<details class="passage-review"><summary>查看題組原文</summary><div class="passage" lang="en">${esc(q.passage)}</div></details>`:'')+
        `<p>你的答案：${letter(d?.choice)} ｜ 正確答案：${letter(q.answer)} · ${esc(q.options[q.answer])}</p>`+
        `<p lang="en">${esc(q.reasonEn)}</p><p class="muted">中文解析：${esc(q.reason)}</p>`+
        (q.grammarTopic&&grammarById[q.grammarTopic]?`<p class="muted">文法考點：${esc(grammarById[q.grammarTopic].title)}</p>`:'')+
        `</div></details>`;
    }).join('')+'</section>';
}
function finishQuiz(timedOut=false){
  if(!quiz)return;
  const source=quiz;
  let score;
  try{score=Exam.score(source.draft,source.items,{timedOut})}catch(e){notify(e.message);return}
  if(!timedOut&&score.unanswered>0){notify('請先完成整份試卷');return}
  const seconds=source.draft.timed?Math.min(source.draft.durationSeconds,Exam.elapsed(source.draft)):Math.round(active?.seconds||0);
  const reviewItems=source.items,old=state;
  const next=Core.normalized(JSON.parse(JSON.stringify(state)));
  for(const decision of score.decisions){
    if(decision.choice===null)continue;
    if(source.context==='vocab')next.review[decision.id]=Core.nextReview(next.review[decision.id],decision.correct?'good':'again');
    else next.questionStats[decision.id]=Core.recordAnswer(next.questionStats[decision.id],decision.correct);
  }
  const event=Core.createSession({id:idNew(),date:Core.dateKey(new Date()),mode:source.mode,unit:unitForQuiz(source),
     part:source.mode==='official-reading-mock'?null:source.part==='all'?null:Number(source.part),seconds,answered:score.total,
     correct:score.correct,questionIds:reviewItems.map(q=>q.id)});
  event.answerReview=score.decisions.map(d=>({id:d.id,choice:d.choice}));
  if(source.context==='vocab')event.vocabReview=reviewItems.map(q=>({id:q.id,options:q.options,answer:q.answer,
    question:q.question,passage:q.passage,reason:q.reason,reasonEn:q.reasonEn,part:0}));
  event.unanswered=score.unanswered;event.timedOut=timedOut;
  next.sessions.push(event);state=next;
  if(!persist()){state=old;notify('無法保存交卷結果，原本試卷及紀錄均已保留');return}
  window.ToeicTrainerAutoSync?.notifyCompleted(event,{window});
  quiz=null;endClock();deleteDraft();window.speechSynthesis?.cancel();
  // A completed examination must have an explicit way home; returning never
  // rescores, reopens the draft or writes a second Session.
  const returnAction=source.context==='vocab'
    ?'<div class="post-exam-return"><button class="btn btn-light" id="backToVocabHome" type="button">← 返回單字首頁</button></div>'
    :'';
  const result=`<div class="panel">${returnAction}<div class="eyebrow">SUBMITTED · ANSWERS UNLOCKED</div><h2 class="result-title">已交卷並完成批改</h2>`+
    `${timedOut?'<p class="muted">75 分鐘已到，未作答題目以錯誤計入正確率。</p>':''}`+
    `<div class="result-summary"><div><b>${score.total}</b><span>試卷總題</span></div><div><b>${event.accuracy}%</b><span>本次正確率</span></div><div><b>${Math.round(seconds/60)} 分</b><span>記錄時間</span></div></div>`+
    `${summaryEventHtml(event)}<div class="button-row"><button id="continuePractice" class="btn btn-primary">再練一次</button><button id="historyAfterPractice" class="btn btn-light">學習紀錄</button></div>`+
    (source.topic&&grammarById[source.topic]?(()=>{const g=grammarById[source.topic];return `<details class="grammar-lesson" open><summary>文法規則與例句 · ${esc(g.title)}</summary><code>${esc(g.formula)}</code><p lang="en">${esc(g.ruleEn)}</p><p>${esc(g.ruleZh)}</p><blockquote lang="en">${esc(g.example)}</blockquote><p>${esc(g.exampleZh)}</p><p>常見錯誤：${esc(g.pitfall)}</p></details>`})():'')+
    reviewSection(reviewItems,score.decisions)+`</div>`;
  const holder=source.context==='vocab'?byId('vocabSession'):byId('practiceFinished');
  if(source.context==='vocab'){vocabView='test';syncVocabView();byId('vocabSession').hidden=false;byId('vocabIntro').hidden=true}
  else{byId('practiceSession').hidden=true;byId('practiceFinished').hidden=false;byId('practiceSetup').hidden=true}
  holder.innerHTML=result;
  byId('backToVocabHome')?.addEventListener('click',(event)=>{
    // Route before removing the clicked result DOM. This prevents a detached
    // touch target from leaking into a neighbouring navigation control.
    event.preventDefault();
    event.stopImmediatePropagation();
    if(quiz||readingRun){notify('請先完成或暫存進行中的試卷。');return}
    vocabView='test';
    tab('vocab');
    // Explicitly enforce the one-screen invariant on mobile after return.
    // Do not touch saved Sessions, review intervals or draft storage.
    const vocabPage=byId('tab-vocab');
    document.querySelectorAll('.tab-page').forEach(page=>{
      page.hidden=page!==vocabPage;
    });
    byId('analysisSwitcher').hidden=true;
    document.querySelectorAll('.nav-btn').forEach(button=>{
      const selected=button.dataset.tab==='vocab';
      button.classList.toggle('active',selected);
      if(selected)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    currentTab='vocab';
    holder.hidden=true;
    syncVocabView();
    window.scrollTo({top:0,behavior:'instant'});
    // The result is no longer visible; dispose it after the click completes.
    requestAnimationFrame(()=>{
      if(!quiz&&!readingRun&&holder.hidden)holder.replaceChildren();
    });
  });
  byId('continuePractice').onclick=()=>{
    if(source.context==='vocab'){
      // Unlike Return, this creates a fresh practice draft (not a Session).
      startVocab();
      return;
    }
    holder.hidden=true;
    byId('practiceSetup').hidden=false;
    renderPoolHint();syncFocusShell();
  };
  byId('historyAfterPractice').onclick=()=>tab('history');
  lastCompletedReview={event,items:reviewItems,score};
  renderHome();syncFocusShell();revealActiveExam(source.context==='vocab'?'#vocabSession':'#practiceFinished');notify('交卷結果已儲存，解析已解鎖');
}
function setupCoaches(){
  updateReadingLevelOptions();
  byId('readingLevelSelect').onchange=()=>{readingListPage=0;updateReadingLevelOptions()};
  byId('readingLessonSelect').onchange=updateReadingLevelHint;
  byId('readingSearch').addEventListener('input',()=>{readingListPage=0;renderReadingBrowser()});
  byId('readingLevelTabs').addEventListener('click',event=>{
    const btn=event.target.closest('[data-reading-level]');if(!btn)return;
    byId('readingLevelSelect').value=btn.dataset.readingLevel;
    byId('readingLevelSelect').dispatchEvent(new Event('change',{bubbles:true}));
  });
  byId('readingLoadMore').onclick=()=>{readingListPage++;renderReadingBrowser()};
  byId('grammarTopicSelect').innerHTML=grammarLessons.map(l=>`<option value="${esc(l.id)}">${esc(l.title)}</option>`).join('');
  byId('grammarSearch').addEventListener('input',()=>{grammarListPage=0;renderGrammarBrowser()});
  byId('grammarCategoryTabs').addEventListener('click',event=>{
    const btn=event.target.closest('[data-grammar-category]');if(!btn)return;
    grammarCategory=btn.dataset.grammarCategory;
    grammarListPage=0;byId('grammarSearch').value='';renderGrammarBrowser();
  });
  byId('grammarLoadMore').onclick=()=>{grammarListPage++;renderGrammarBrowser()};
  byId('vocabQuickFilters').addEventListener('click',onVocabFilterClick);
  byId('vocabCategoryTabs').addEventListener('click',onVocabFilterClick);
  function onVocabFilterClick(event){
    const btn=event.target.closest('[data-vocab-filter]');if(!btn)return;
    byId('vocabFilter').value=btn.dataset.vocabFilter;
    byId('vocabFilter').dispatchEvent(new Event('change',{bubbles:true}));
  }
  renderGrammarBrowser();renderReadingBrowser();
  byId('openReadingLesson').onclick=startReadingLesson;
  byId('grammarTopicSelect').onchange=renderGrammarLesson;
  byId('startTopicPractice').onclick=()=>{
    if(quiz){notify('請先結束目前訓練。');return}
    if(readingRun){notify('請先完成或退出精讀。');return}
    quizTopic=byId('grammarTopicSelect').value;
    byId('practiceMode').value='grammar';
    byId('practicePart').value='all';
    startPractice('grammar',quizTopic);
  };
}
function renderGrammarLesson(){
  const topic=byId('grammarTopicSelect').value||grammarLessons[0].id;
  const lesson=grammarById[topic];if(!lesson)return;
  const node=byId('grammarLessonPanel');
  node.innerHTML=`<div class="exam-banner"><b>${esc(lesson.title)}</b><p>正式測驗模式：先完成這個主題的題目並交卷，文法規則與例句在集中檢討中解鎖。</p></div>`;
  const weak=Core.weakTopics(questions,state.questionStats).find(x=>x.topic===topic&&x.answered>=2);
  byId('weakGrammarPanel').textContent=weak?`歷史錯誤率 ${weak.errorRate}%（${weak.answered} 題次）；尚在考試中不顯示本次成績。`:'尚未累積足夠的歷史作答紀錄。';
}
function startReadingLesson(){
  if(quiz||readingRun){notify('請先完成或暫存進行中的測驗');return}
  if(savedDraft){notify('已有未完成試卷，請先繼續或放棄');return}
  const lesson=readingById[byId('readingLessonSelect').value];if(!lesson)return;
  const items=questions.filter(q=>q.readingId===lesson.id);
  if(!items.length)return notify('此文章尚無可用的理解題');
  const draft=Exam.start(items,{context:'reading',mode:'guided-reading'});draft.guidedLessonId=lesson.id;
  readingResultVisible=false;readingRun={lesson,draft,answers:draft.responses};startClock('reading');saveDraft();renderReadingLesson();revealActiveExam('#readingLessonPanel');
}
function renderReadingDocument(lesson){
  // Reflow the authored sentences into readable paragraphs without altering a single word.
  // The original sentence objects remain untouched for after-submit translation/grammar review.
  const result=[],sentences=Array.isArray(lesson.sentences)?lesson.sentences:[];
  let group=[],words=0;
  const limit=Number(lesson.wordCount)>300?85:Number(lesson.wordCount)>150?70:55;
  const flush=()=>{if(group.length){result.push(group.map(sentence=>esc(sentence.en)).join(' '));group=[];words=0}};
  for(const sentence of sentences){
    const count=LengthPolicy.words(sentence.en);
    if(group.length>=2&&(words+count>limit||group.length>=4))flush();
    group.push(sentence);words+=count;
  }
  flush();
  return `<article class="reading-document" aria-label="英文閱讀原文">${result.map(p=>`<p class="reading-paragraph" lang="en">${p}</p>`).join('')}</article>`;
}
function renderReadingLesson(){
  const view=byId('readingLessonPanel');
  if(!readingRun){readingResultVisible=false;view.hidden=true;view.innerHTML='';return}
  const {lesson,draft}=readingRun,answers=draft.responses,qs=questions.filter(q=>q.readingId===lesson.id),count=Exam.completed(draft);
  view.hidden=false;
  const timer=timeStr(active?.seconds);
  let out=`<div class="reading-study"><div class="session-head"><span>${esc(lesson.kind)} · ${esc(lesson.level)} · ${lesson.wordCount||LengthPolicy.words(LengthPolicy.readingText(lesson))} 詞</span><div class="timer" id="readingTimer">${timer}</div></div>`+
    `<div class="exam-banner">正式測驗：請先讀完英文原文並完成 ${qs.length} 題；中文翻譯、句型、答案與解析在交卷後一次解鎖。</div>`+
    `<h3>${esc(lesson.title)}</h3>${renderReadingDocument(lesson)}`;
  out+='<div class="section-title reading-question-head"><div><small>CHECK UNDERSTANDING</small><h2>理解測驗 · <span id="readingQuizCount">'+count+'</span>/'+qs.length+' 題已答</h2></div></div>';
  qs.forEach((q,qi)=>{
    const choice=answers[q.id];
    out+=`<div class="reading-quiz"><div class="question-label">第 ${qi+1}/${qs.length} 題</div><div class="q-stem" lang="en">${esc(q.question)}</div><div class="answers">`;
    q.options.forEach((option,i)=>{
      out+=`<button class="answer${choice===i?' picked':''}" type="button" data-reading-answer="${qi}-${i}" aria-pressed="${choice===i}"><span class="letter">${String.fromCharCode(65+i)}</span><span>${esc(option)}</span></button>`;
    });
    out+='</div></div>';
  });
  out+=`<div class="quiz-bottom"><button class="btn btn-light" id="quitReading" type="button">暫存離開</button><button class="btn btn-primary" id="finishReading" type="button">正式交卷${count===qs.length?'':'（仍有 '+(qs.length-count)+' 題未答）'}</button></div></div>`;
  view.innerHTML=out;syncFocusShell();
  view.querySelectorAll('[data-reading-answer]').forEach(btn=>btn.onclick=()=>{
    const [qi,i]=btn.dataset.readingAnswer.split('-').map(Number),q=qs[qi];if(!q)return;
    const previous=readingRun.draft;
    readingRun.draft=Exam.answer(readingRun.draft,q.id,i);readingRun.answers=readingRun.draft.responses;
    if(!saveDraft()){readingRun.draft=previous;readingRun.answers=previous.responses;return}
    // Do not redraw a 400-word article after every answer: keep scroll and focus stable.
    const group=btn.closest('.reading-quiz');
    group?.querySelectorAll('[data-reading-answer]').forEach(item=>{
      const selected=Number(item.dataset.readingAnswer.split('-')[1])===i;
      item.classList.toggle('picked',selected);item.setAttribute('aria-pressed',String(selected));
    });
    const answered=Exam.completed(readingRun.draft);
    byId('readingQuizCount').textContent=String(answered);
    byId('finishReading').textContent='正式交卷'+(answered===qs.length?'':'（仍有 '+(qs.length-answered)+' 題未答）');
  });
  byId('quitReading').onclick=pauseExam;
  byId('finishReading').onclick=()=>{
    const answered=Exam.completed(readingRun.draft);
    if(answered!==qs.length){notify('尚有 '+(qs.length-answered)+' 題未答，請全部完成後交卷');return}
    if(window.confirm('確認交卷？交卷後才會公布標準答案、逐句翻譯與文法解析。'))finishReadingLesson();
  };
}
function finishReadingLesson(){
  if(!readingRun)return;
  const {lesson,draft}=readingRun,qs=questions.filter(q=>q.readingId===lesson.id);
  let score;try{score=Exam.score(draft,qs)}catch(e){notify(e.message);return}
  const seconds=Math.round(active?.seconds||0),old=state,next=Core.normalized(JSON.parse(JSON.stringify(state)));
  for(const decision of score.decisions)next.questionStats[decision.id]=Core.recordAnswer(next.questionStats[decision.id],decision.correct);
  const event=Core.createSession({id:idNew(),date:Core.dateKey(new Date()),mode:'guided-reading',unit:'article',part:7,
    seconds,answered:score.total,correct:score.correct,questionIds:qs.map(q=>q.id)});
  event.answerReview=score.decisions.map(d=>({id:d.id,choice:d.choice}));
  next.sessions.push(event);
  const before=next.readingProgress[lesson.id]||{attempts:0,best:0,lastAt:''};
  next.readingProgress[lesson.id]={attempts:before.attempts+1,best:Math.max(before.best,event.accuracy),lastAt:event.createdAt};
  state=next;if(!persist()){state=old;notify('交卷保存失敗，請勿關閉頁面');return}
  window.ToeicTrainerAutoSync?.notifyCompleted(event,{window});
  endClock();readingRun=null;readingResultVisible=true;deleteDraft();byId('practiceSetup').hidden=false;
  let out=`<div class="reading-study"><div class="eyebrow">SUBMITTED · ANSWERS UNLOCKED</div><h2>${esc(lesson.title)} · 測驗完成</h2>`+
   `<div class="result-summary"><div><b>${score.total}</b><span>理解題</span></div><div><b>${event.accuracy}%</b><span>正確率</span></div><div><b>${Math.floor(seconds/60)} 分</b><span>專注時間</span></div></div>${summaryEventHtml(event)}`+
   `<h3>逐句翻譯與句型解析</h3><div class="sentence-list">`;
  lesson.sentences.forEach((sentence,i)=>out+=`<details class="sentence-card"><summary class="sentence-en" lang="en">${esc(sentence.en)}</summary><div class="sentence-notes"><p>${esc(sentence.zh)}</p><p>${esc(sentence.note)}</p></div></details>`);
  out+='</div>'+reviewSection(qs,score.decisions)+
  `${LengthPolicy.nextLevel(lesson.tier)&&event.accuracy>=80?'<p class="progression-next">本篇達 80%，可自主選擇下一難度；原篇可重做。</p>':''}<div class="button-row"><button class="btn btn-primary" id="readAgain">再讀一篇</button><button class="btn btn-light" id="historyAfterReading">學習紀錄</button></div></div>`;
  const view=byId('readingLessonPanel');view.hidden=false;view.innerHTML=out;
  byId('readAgain').onclick=()=>{view.hidden=true;view.innerHTML='';readingResultVisible=false;syncFocusShell();revealActiveExam('#readingCoach')};
  byId('historyAfterReading').onclick=()=>tab('history');
  lastCompletedReview={event,items:qs,score};renderHome();syncFocusShell();revealActiveExam('#readingLessonPanel');notify('已交卷，閱讀原文與解析已解鎖');
}
function renderMistakes(){
  const pool=mistakeQuestions();
  const allWrong=questions.filter(q=>Number(state.questionStats[q.id]?.wrong)>0).length;
  byId('mistakesMetrics').innerHTML=statCard('仍需再練',pool.length+' 題')+statCard('曾經答錯',allWrong+' 題')+statCard('題庫題目',questions.length+' 題')+statCard('已學單字',Object.keys(state.review).length+' 張');
  byId('startMistakes').disabled=!pool.length;
  const weak=Core.weakTopics(questions,state.questionStats).filter(x=>x.answered>=2);
  const weakBox=byId('weaknessOverview');weakBox.hidden=!weak.length;
  if(weak.length){
    weakBox.innerHTML=`<div class="section-title"><div><small>GRAMMAR ANALYTICS</small><h2>文法弱點</h2></div></div>`+
      weak.slice(0,5).map(x=>`<div class="weak-row"><span>${esc(grammarById[x.topic]?.title||x.topic)}</span><b>${x.errorRate}% 錯誤率 · ${x.answered} 題次</b></div>`).join('')+
      '<p class="fineprint">僅依目前訓練紀錄計算，不是正式多益能力分數。</p>';
  }
  const list=byId('mistakesList');
  if(!pool.length){list.innerHTML='<div class="empty">目前沒有待重練的閱讀或文法題。先完成一般練習，再回來檢視。</div>';return}
  list.innerHTML=pool.slice(0,30).map(q=>{
    const stats=state.questionStats[q.id];
    return `<div class="list-row"><div><b>Part ${q.part} · ${esc(q.question)}</b><small>${esc(q.tag)} · 曾錯 ${Number(stats.wrong)||0} 次</small></div><span class="pill warn">待複習</span></div>`;
  }).join('');
}
function downloadJSON(data,filename){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function renderHistory(){
  const list=byId('sessionList');
  if(!state.sessions.length){list.innerHTML='<div class="empty">還沒有完成的訓練紀錄。完成一組單字或題目後就會出現在這裡。</div>';return}
  list.innerHTML='';
  const prelim=Bridge.preview(state.sessions);
  const validIds=new Set(prelim.rows.filter(x=>x.status==='review').map(x=>x.session?.id));
  state.sessions.slice().reverse().slice(0,60).forEach(s=>{
    const row=document.createElement('div');row.className='list-row';
    const l=document.createElement('div');const name=document.createElement('b');name.textContent=`${s.date} · ${summaryLabel[s.unit]||s.unit}`;
    const desc=document.createElement('small');desc.textContent=`${s.mode==='listening'?'舊版歷史 · ':''}${s.questionsAnswered} 題/字卡 · ${s.accuracy}% · ${minutesLabel(s.seconds)}`;
    l.append(name,desc);
    const canReview=validIds.has(s.id);
    const r=document.createElement('span');r.className='pill'+(canReview?'':' warn');r.textContent=canReview?'可供核對':'暫不列入';
    row.append(l,r);
    if(Array.isArray(s.answerReview)&&s.answerReview.length){
      const button=document.createElement('button');button.type='button';button.className='btn btn-light';
      button.textContent='交卷解析';button.onclick=()=>showSavedReview(s);
      row.append(button);
    }
    list.append(row);
  });
}
function showSavedReview(session){
  if(!Array.isArray(session?.answerReview)||!session.answerReview.length)return;
  const lookup=new Map(questions.map(q=>[q.id,q]));
  for(const q of session.vocabReview||[])lookup.set(q.id,q);
  const seen=[];
  for(const row of session.answerReview){const q=lookup.get(row.id);if(q)seen.push(q)}
  if(!seen.length)return notify('這份試卷的題目已不在目前版本，請先保存舊版備份');
  const chosen=new Map(session.answerReview.map(x=>[x.id,x.choice]));
  const decisions=seen.map(q=>({id:q.id,choice:chosen.get(q.id),correct:chosen.get(q.id)===q.answer}));
  const dlg=byId('savedReviewDialog'),body=byId('savedReviewBody');
  body.innerHTML=`<h2>已交卷試卷 · ${esc(session.date)}</h2><p class="muted">${session.questionsAnswered} 題／${session.accuracy}% · 原紀錄不變</p>`+reviewSection(seen,decisions);
  if(typeof dlg.showModal==='function')dlg.showModal();else dlg.hidden=false;
}
function renderBridge(){
  const metrics=byId('bridgeMetrics'),rows=byId('bridgeRows'),status=byId('bridgeSnapshotStatus');
  if(!metrics||!rows||!status)return;
  bridgeReport=Bridge.preview(state.sessions,{snapshot:goalSnapshot});
  const c=bridgeReport.counts;
  status.textContent=goalSnapshot
    ?`已只讀核對 Goal Manager 備份：${goalSnapshot.taskCount} 個目標、${goalSnapshot.logCount} 筆歷程；備份時間 ${goalSnapshot.savedAt||'未標示'}。檔案內容不會保存於訓練系統。`
    :'尚未提供 Goal Manager 備份。仍可檢查訓練事件，但無法確認目標期間、人工補登與既有同步是否重複。';
  metrics.innerHTML=statCard('紀錄總數',c.total+' 筆')+
    statCard('可選待核對',c.selectable+' 筆')+
    statCard('需暫停核對',c.hold+' 筆')+
    statCard('不符條件',c.excluded+' 筆');
  const selectable=new Set(bridgeReport.rows.filter(x=>x.status==='candidate'||x.status==='review').map(x=>x.session?.id));
  bridgeSelected=new Set([...bridgeSelected].filter(id=>selectable.has(id)));
  if(!bridgeReport.rows.length){rows.innerHTML='<div class="empty">尚未有完成的訓練紀錄；先完成閱讀、單字或文法練習。</div>'}
  else rows.innerHTML=bridgeReport.rows.slice().reverse().map(row=>{
    const {session:s,status:code,reason,index,task}=row;
    const can=code==='review'||code==='candidate';
    const title=code==='candidate'?'備份核對未見衝突':code==='review'?'未載入目標備份':code==='hold'?'暫停候選':'不可列入';
    return `<label class="bridge-row ${can?'':'bridge-row-disabled'}">`+
      `<input type="checkbox" class="bridge-check" data-bridge-index="${index}" ${can?'':'disabled'} ${can&&bridgeSelected.has(s.id)?'checked':''} aria-label="選擇事件 ${esc(s.id||'')}"/>`+
      `<div class="bridge-row-body"><b>${esc(String(s.date||'日期未記載'))} · ${esc(summaryLabel[s.unit]||s.unit||'未知')} · ${esc(Bridge.localMinutes(Number(s.seconds)||0))} 分</b>`+
      `<small>${esc(String(s.id||'無 ID'))} · ${esc(String(s.questionsAnswered||0))} 題／字卡 · ${esc(String(s.accuracy??'—'))}%</small>`+
      `<span class="bridge-state">${esc(title)}</span><p>${esc(reason)}</p>`+
      (task?.taskId?`<small>核對目標：${esc(task.taskId)} · ${esc(task.name)}</small>`:'')+
      '</div></label>';
  }).join('');
  rows.querySelectorAll('[data-bridge-index]').forEach(check=>check.onchange=()=>{
    const row=bridgeReport.rows[Number(check.dataset.bridgeIndex)];if(!row||!['candidate','review'].includes(row.status))return;
    if(check.checked)bridgeSelected.add(row.session.id);else bridgeSelected.delete(row.session.id);
    refreshBridgeSelection();
  });
  refreshBridgeSelection();
}
function refreshBridgeSelection(){
  const count=byId('bridgeSelectionCount'),submit=byId('exportBridgeCandidates');
  if(count)count.textContent=`已選取 ${bridgeSelected.size} 筆 · 上限按每個 Session 各自無條件捨去不足一分鐘的秒數（非正式匯入值）`;
  if(submit)submit.disabled=!bridgeSelected.size;
}
function attachBridge(){
  byId('exportEvents').onclick=()=>{
    tab('history');byId('bridgeDisclosure').open=true;byId('bridgeDisclosure').scrollIntoView({block:'start',behavior:'smooth'});
  };
  byId('loadGoalSnapshot').onclick=()=>byId('goalSnapshotInput').click();
  byId('goalSnapshotInput').onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(file.size>2*1024*1024)throw new Error('檔案超過 2MB；此版本僅支援原始 Goal Manager 完整備份。');
      goalSnapshot=await Bridge.readGoalSnapshot(await file.text());
      bridgeSelected.clear();renderBridge();notify('目標備份完成完整性核對；只讀預覽，不會修改任何目標資料。');
    }catch(error){goalSnapshot=null;bridgeSelected.clear();renderBridge();notify(error.message||'目標備份核對失敗');}
    finally{e.target.value=''}
  };
  byId('clearGoalSnapshot').onclick=()=>{
    goalSnapshot=null;bridgeSelected.clear();renderBridge();notify('已從此頁記憶體移除目標備份參考資料');
  };
  byId('selectBridgeCandidates').onclick=()=>{
    if(!bridgeReport)renderBridge();
    bridgeSelected=new Set(bridgeReport.rows.filter(row=>row.status==='candidate'||row.status==='review').map(row=>row.session.id));
    renderBridge();
  };
  byId('clearBridgeCandidates').onclick=()=>{bridgeSelected.clear();renderBridge()};
  byId('exportBridgeCandidates').onclick=()=>{
    try{
      const report=Bridge.preview(state.sessions,{snapshot:goalSnapshot});
      const packet=Bridge.buildPacket(report,bridgeSelected);
      if(!window.confirm(`將下載 ${packet.events.length} 筆「待核對事件」JSON。\n\n注意：檔案不能直接匯入 Goal Manager 的「完整備份還原」。目前不會增加任何目標分鐘數。要繼續嗎？`))return;
      downloadJSON(packet,`TOEIC_Trainer_Review_Events_${Core.dateKey(new Date())}.json`);
      notify('已匯出待核對事件；目標系統資料仍未變更。');
    }catch(error){notify(error.message||'事件未通過匯出驗證')}
  };
}
function goQuick(mode){
  if(mode==='vocab'){tab('vocab');return}
  const target=mode==='grammar'?'grammar':'reading';
  tab(target);
  if(quiz)return;
  byId('practiceMode').value=mode==='mistakes'?'mistakes':target;
  byId('practicePart').value='all';quizTopic=null;renderPoolHint();
}
function startMistakes(){goQuick('mistakes');startPractice('mistakes')}
function attach(){
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-review-filter]');
    if(!btn)return;
    const section=btn.closest('.post-review');if(!section)return;
    section.dataset.reviewView=btn.dataset.reviewFilter==='wrong'?'wrong':'all';
    section.querySelectorAll('[data-review-filter]').forEach(item=>{
      const selected=item.dataset.reviewFilter===section.dataset.reviewView;
      item.classList.toggle('active',selected);item.setAttribute('aria-pressed',String(selected));
    });
  });
  document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>tab(btn.dataset.tab)));
  document.querySelectorAll('[data-analysis-tab]').forEach(btn=>btn.addEventListener('click',()=>tab(btn.dataset.analysisTab)));
  document.querySelectorAll('[data-vocab-view]').forEach(btn=>btn.addEventListener('click',()=>changeVocabView(btn.dataset.vocabView)));
  for(const field of ['appearance','accent','textSize']){
    document.querySelectorAll('[data-'+field.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+'-value]').forEach(btn=>{
      const key=field.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
      btn.addEventListener('click',()=>updateVisualPreference(field,btn.getAttribute('data-'+key+'-value')));
    });
  }
  byId('homeStartPractice').onclick=()=>goQuick('reading');byId('homeStartVocab').onclick=()=>tab('vocab');byId('homeStartGrammar').onclick=()=>goQuick('grammar');
  document.querySelectorAll('[data-quick]').forEach(btn=>btn.onclick=()=>goQuick(btn.dataset.quick));
  byId('startVocab').onclick=startVocab;byId('startPractice').onclick=()=>startPractice();
  byId('startMistakes').onclick=startMistakes;
  byId('startOfficialMock').onclick=startOfficialMock;
  byId('resumeDraft').onclick=resumeExam;
  byId('discardDraft').onclick=()=>{
    if(!savedDraft)return;
    if(window.confirm('放棄尚未交卷的草稿？舊的 Session 和已儲存的成績不受影響。')){
      deleteDraft();notify('僅放棄本次未完成草稿；歷史紀錄未變更');
    }
  };
  byId('closeSavedReview').onclick=()=>{const d=byId('savedReviewDialog');if(typeof d.close==='function')d.close();else d.hidden=true};
  for(const id of ['practicePart','practiceMode','practiceCount'])byId(id).onchange=renderPoolHint;
  byId('practiceTier').onchange=()=>{
    const tier=byId('practiceTier').value;
    if(tier!=='all'&&tier!=='legacy'){
      byId('practicePart').value=currentTab==='grammar'?'5':'7';
      quizTopic=null;
    }
    renderPoolHint();
  };
  for(const id of ['vocabFilter','vocabSearch'])byId(id).addEventListener(id==='vocabSearch'?'input':'change',()=>{vocabListPage=0;renderWordLookup()});
  for(const [id,labels] of Object.entries({vocabCount:{5:'5 張',10:'10 張',20:'20 張'},practicePart:{all:'不限',5:'Part 5',6:'Part 6',7:'Part 7'},practiceTier:{all:'全部',foundation:'基礎',intermediate:'中階',advanced:'高階',legacy:'既有'},practiceCount:{5:'5 題',10:'10 題',20:'20 題'}}))enhanceChoiceSelect(id,labels);
  setupCoaches();
  byId('exportBackup').onclick=()=>downloadJSON(state,`TOEIC_Trainer_Backup_${Core.dateKey(new Date())}.json`);
  // V0.3: direct export is replaced by an explicit per-session read-only preview.
  attachBridge();
  byId('importBackupBtn').onclick=()=>byId('importBackupInput').click();
  byId('importBackupInput').onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(file.size>8_000_000)throw new Error('備份檔過大。');
      const raw=JSON.parse(await file.text());const restored=Core.normalized(raw);
      if(!window.confirm(`確定要用這份訓練備份取代目前紀錄嗎？備份包含 ${restored.sessions.length} 次 Session；建議先下載現在的完整備份。`))return;
      if(storageBlocked)throw new Error('儲存空間目前唯讀，無法安全還原。');
      const original=state;state=restored;
      if(!persist()){state=original;throw new Error('資料寫入驗證失敗，已保留記憶體內原紀錄。')}
      goalSnapshot=null;bridgeSelected.clear();notify('訓練備份還原成功');renderHistory();renderBridge();renderHome();
    }catch(error){notify(error.message||'還原失敗，沒有覆寫原紀錄。')}finally{e.target.value=''}
  };
  document.addEventListener('visibilitychange',()=>{
    if(active){if(document.visibilityState==='visible')active.lastTick=performance.now();else{tick();saveDraft();active.lastTick=performance.now()}}
    window.speechSynthesis?.cancel();
  });
  window.addEventListener('beforeunload',e=>{
    if(quiz||readingRun){saveDraft();e.preventDefault();e.returnValue=''}
  });
  setInterval(tick,1000);
  if(location.protocol==='https:'&&'serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(e=>console.warn('Offline cache unavailable',e));
  }
}
function tick(){
  if(!active)return;
  const now=performance.now();
  const exposed=document.visibilityState==='visible'&&((active.kind==='practice'&&['reading','grammar','vocab'].includes(currentTab))||(active.kind==='reading'&&currentTab==='reading'));
  if(exposed){active.seconds+=Math.min(1.25,Math.max(0,(now-active.lastTick)/1000))}
  active.lastTick=now;
  if(quiz?.draft.timed){
    const remain=Math.max(0,quiz.draft.durationSeconds-Exam.elapsed(quiz.draft));
    const e=byId('quizTimer');if(e)e.textContent='剩餘 '+timeStr(remain);
    if(remain===0){finishQuiz(true);return}
  }else{
    const e=byId(active.kind==='practice'?'quizTimer':'readingTimer');if(e)e.textContent=timeStr(active.seconds);
  }
  if((quiz||readingRun)&&Math.floor(active.seconds)>=15&&Math.floor(active.seconds)%15===0&&active.lastSavedDraftAt!==Math.floor(active.seconds)){active.lastSavedDraftAt=Math.floor(active.seconds);saveDraft();}
}
bootStorage();attach();tab('home');renderDraftBanner();
const qualityLabel=byId('qualityStatus');if(qualityLabel)qualityLabel.textContent=machineAudit.counts.mechanicallyBlocked===0?`640 題結構通過 · ${machineAudit.counts.flaggedForReview} 題優先覆核`:'題庫需安全處理';
const bankInfo=byId('bankQuality');if(bankInfo)bankInfo.textContent=`題庫：${auditResult.counts.words} 張獨立字卡、${auditResult.counts.questions} 道書面題（Part 5：${auditResult.counts.part5}；Part 6：${auditResult.counts.part6}；Part 7：${auditResult.counts.part7}）、${auditResult.counts.reading} 篇精讀及 ${auditResult.counts.grammar} 個文法主題。V0.4.3 已完成 ${machineAudit.counts.questions} 道題的程式化結構審核；${machineAudit.counts.flaggedForReview} 題列為優先人工語意覆核（可能涉及原文依據、解析或干擾選項）。尚未宣稱全部答案經專家驗證；題目均非 ETS 官方試題。`;
})();
