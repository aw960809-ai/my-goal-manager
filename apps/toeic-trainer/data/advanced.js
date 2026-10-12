/* TOEIC Trainer v0.2 — original written English content. Not official ETS material. */
(function(root){
'use strict';
const vocabularyRows=[
 ['acknowledge','v.','確認收到；承認','Please acknowledge receipt of the updated agreement.','acknowledge receipt','office'],
 ['adjustment','n.','調整；修正','The revised invoice includes a small price adjustment.','price adjustment','finance'],
 ['advance','n./adj.','事先；提前的','Please give us advance notice of any cancellation.','in advance','office'],
 ['approval','n.','核准','The purchase requires the director’s approval.','obtain approval','finance'],
 ['assess','v.','評估','The team will assess the impact of the new schedule.','assess the impact','business'],
 ['attach','v.','附上','Please attach the receipt to your expense report.','attach a document','office'],
 ['availability','n.','可用情形；空房狀況','Please check room availability before booking.','check availability','travel'],
 ['circulate','v.','傳閱；分送','The coordinator will circulate the minutes after the meeting.','circulate a report','office'],
 ['comply','v.','遵守','All visitors must comply with building regulations.','comply with regulations','office'],
 ['coordinate','v.','協調','Our office will coordinate the delivery with the supplier.','coordinate a shipment','business'],
 ['defective','adj.','有瑕疵的','Defective products may be returned within thirty days.','defective item','business'],
 ['dispatch','v.','寄送；派遣','The warehouse will dispatch the order on Tuesday.','dispatch an order','business'],
 ['expense','n.','費用','Please record all travel expenses on the claim form.','travel expenses','finance'],
 ['extension','n.','延長；延期','The client requested an extension of the deadline.','request an extension','office'],
 ['fluctuate','v.','波動','Shipping costs may fluctuate during peak season.','prices fluctuate','business'],
 ['inspection','n.','檢查','The equipment passed its annual safety inspection.','safety inspection','office'],
 ['outstanding','adj.','尚未結清的；傑出的','The accounting team will review outstanding invoices.','outstanding balance','finance'],
 ['policy','n.','政策；規定','The travel policy limits meal reimbursement.','company policy','office'],
 ['proceed','v.','繼續；進行','We can proceed with the booking after payment.','proceed with a plan','business'],
 ['quotation','n.','報價單','Please send a quotation before we place an order.','request a quotation','finance'],
 ['recipient','n.','收件人','The recipient should sign for the delivery.','email recipient','office'],
 ['revised','adj.','修訂後的','The revised schedule is attached to this email.','revised schedule','office'],
 ['tentative','adj.','暫定的','The workshop date is tentative until the venue is confirmed.','tentative schedule','travel'],
 ['verify','v.','查證；核實','Verify the billing details before approving payment.','verify information','finance']
];
const cards=vocabularyRows.map(([word,pos,zh,example,collocation,tag],i)=>({id:'v'+String(i+49).padStart(3,'0'),word,pos,zh,example,collocation,tag}));
const grammarLessons=[
 {id:'word-form',title:'詞性與詞形 Word Forms',formula:'adjective + noun / adverb + verb',intro:'選擇形容詞、名詞、副詞時，先看空格修飾的是誰。',ruleEn:'Adjectives describe nouns; adverbs commonly modify verbs, adjectives, or other adverbs.',ruleZh:'形容詞修飾名詞；副詞通常修飾動詞、形容詞或其他副詞。',example:'The report was carefully reviewed before submission.',exampleZh:'報告在提交前經過仔細審查。',pitfall:'reviewed 前需要副詞 carefully，不是形容詞 careful。'},
 {id:'tense',title:'時態與時間線 Tenses',formula:'have / has + past participle; past for finished events',intro:'先找 since、for、yesterday、last month 等時間標記。',ruleEn:'Use the present perfect for a situation connecting the past to the present; use the simple past for a finished time.',ruleZh:'與現在持續相關的狀況常用現在完成式；明確結束的過去時間通常用過去式。',example:'She has managed the branch since 2022.',exampleZh:'她自 2022 年起管理這間分行。',pitfall:'since 2022 可搭配 has managed；yesterday 應用 managed。'},
 {id:'agreement',title:'主詞動詞一致 Agreement',formula:'singular subject + singular verb',intro:'不要被 of 後面的複數名詞誤導，找出真正主詞。',ruleEn:'The verb agrees with the head noun of the subject, not with a noun in a following prepositional phrase.',ruleZh:'動詞應配合主詞核心名詞，而不是主詞後面介系詞片語的名詞。',example:'A list of suppliers is attached.',exampleZh:'供應商名單已隨信附上。',pitfall:'A list of suppliers 的核心主詞是 list（單數）。'},
 {id:'passive',title:'被動語態 Passive Voice',formula:'be + past participle',intro:'判斷主詞是執行動作還是承受動作。',ruleEn:'Use a form of be plus a past participle when the subject receives the action.',ruleZh:'主詞為動作承受者時，使用 be 動詞加過去分詞。',example:'The documents will be distributed tomorrow.',exampleZh:'文件將於明天分發。',pitfall:'will be distributed；不能寫成 will distributed。'},
 {id:'prepositions',title:'介系詞與搭配 Prepositions',formula:'by a deadline / until a time / comply with',intro:'注意 by 與 until 的差別，以及固定介系詞搭配。',ruleEn:'By identifies a latest acceptable time; until shows that a situation continues up to a time.',ruleZh:'by 表「不晚於某期限」；until 表「持續至某時間」。',example:'Please submit the invoice by Friday.',exampleZh:'請最晚於週五提交發票。',pitfall:'by Friday 與 until Friday 並非所有句型都能互換。'},
 {id:'relative',title:'關係子句 Relative Clauses',formula:'who / which / that / whose / where',intro:'看先行詞代表人、物、所有關係還是地點。',ruleEn:'Relative pronouns connect a noun to information that identifies or describes it.',ruleZh:'關係代名詞連結先行詞與描述該先行詞的子句。',example:'The technician who inspected the lift submitted a report.',exampleZh:'檢查電梯的技術員提交了報告。',pitfall:'who 可指人；whose 強調所有關係。'},
 {id:'condition',title:'條件句與除非 Conditions',formula:'If + present, will + verb; unless = if not',intro:'未來條件句的 if 子句通常用現在式。',ruleEn:'For a realistic future condition, use the present tense in the if-clause and often will in the main clause.',ruleZh:'真實可能的未來條件，if 子句通常用現在式，主要子句常用 will。',example:'If the order arrives early, we will notify you.',exampleZh:'若訂單提早抵達，我們會通知你。',pitfall:'If the order will arrive early 通常不是此類條件句的標準寫法。'},
 {id:'comparison',title:'比較級 Comparisons',formula:'more + adjective + than / the most + adjective',intro:'找 than、of all、in the department 判斷比較結構。',ruleEn:'Use a comparative form when contrasting two things; use a superlative for the highest degree within a group.',ruleZh:'比較兩者常用比較級；同群體最高程度用最高級。',example:'This system is more efficient than the previous one.',exampleZh:'這套系統比前一套有效率。',pitfall:'more efficient than；不是 more efficient as。'},
 {id:'infinitive',title:'不定詞與動名詞 Verb Patterns',formula:'ask someone to do / be responsible for doing',intro:'動詞及介系詞後的形式受固定句型制約。',ruleEn:'Some verbs take an infinitive, while a preposition is typically followed by a noun or an -ing form.',ruleZh:'有些動詞後接不定詞；介系詞後通常接名詞或 V-ing。',example:'The manager asked us to verify the figures.',exampleZh:'經理要求我們核實數字。',pitfall:'ask someone to do；responsible for doing。'}
];
const questions=[];
function addGrammar(topic,id,stem,options,answer,reasonEn,reason){
 questions.push({id,part:5,question:stem,options,answer,reasonEn,reason,tag:topic,grammarTopic:topic});
}
addGrammar('word-form','g-wf-01','The company provided a ___ explanation of the revised fees.',['clear','clearly','clarity','clearing'],0,'The blank modifies the noun “explanation,” so an adjective is required. “Clear” is the adjective.','空格修飾 explanation（名詞），故選形容詞 clear。');
addGrammar('word-form','g-wf-02','The new software operates ___ even during busy hours.',['reliable','reliability','reliably','rely'],2,'The blank modifies “operates,” a verb. The adverb “reliably” expresses how the software operates.','修飾動詞 operates 要用副詞 reliably。');
addGrammar('word-form','g-wf-03','Please contact the ___ department for a duplicate receipt.',['account','accounting','accounted','accountably'],1,'“Accounting department” is the established noun phrase for the team handling financial records.','accounting department 為「會計部門」的常見搭配。');
addGrammar('tense','g-tn-01','Our branch ___ three new employees last month.',['has hired','hires','hired','hiring'],2,'“Last month” refers to a completed past time, so use the simple past form “hired.”','last month 是已結束的過去時間，使用過去式 hired。');
addGrammar('tense','g-tn-02','The company ___ this service since 2021.',['offers','has offered','offered','will offer'],1,'“Since 2021” indicates a continuing situation starting in the past, so the present perfect fits.','since 2021 表持續至今的情形，使用 has offered。');
addGrammar('tense','g-tn-03','By the time the guests arrived, the staff ___ the room.',['had prepared','prepares','will prepare','are preparing'],0,'The preparation happened before another past event (“arrived”), so the past perfect is appropriate.','布置房間早於來賓抵達的過去時間，使用過去完成式。');
addGrammar('agreement','g-ag-01','Each of the applicants ___ an identification card.',['need','needs','needing','have needed'],1,'The subject “Each” is singular, even though “applicants” is plural. Use “needs.”','Each 是單數核心主詞，動詞用 needs。');
addGrammar('agreement','g-ag-02','The results of the survey ___ available online.',['is','was','are','has'],2,'The head noun “results” is plural. The prepositional phrase “of the survey” does not change agreement.','results 是複數主詞，使用 are。');
addGrammar('agreement','g-ag-03','Neither of the two proposals ___ been approved.',['have','has','are','were'],1,'The determiner “Neither” is treated as singular in this formal sentence, so “has been approved” fits.','正式句型 Neither of ... 作單數，接 has。');
addGrammar('passive','g-pa-01','All expense reports must ___ by the finance team.',['review','be reviewed','reviewing','reviewed'],1,'Modal “must” plus passive voice takes “be” and the past participle “reviewed.”','must be reviewed：情態動詞＋被動語態。');
addGrammar('passive','g-pa-02','The office windows ___ last weekend.',['cleaned','were cleaned','are cleaning','have cleaning'],1,'The windows received the action and “last weekend” sets a past time. “Were cleaned” is past passive.','窗戶是被清潔，且為過去時間，使用 were cleaned。');
addGrammar('passive','g-pa-03','A new safety policy ___ next Monday.',['will introduce','will be introduced','introduces','introducing'],1,'The policy receives the action in the future, so use “will be introduced.”','新政策將「被實施／推出」，使用將來式被動。');
addGrammar('prepositions','g-pr-01','Please send the final quotation ___ noon tomorrow.',['by','until','during','from'],0,'“By noon” means the quotation must arrive no later than noon. “Until” expresses duration, not this deadline.','by noon 是最遲中午前完成，不是持續到中午。');
addGrammar('prepositions','g-pr-02','The library will remain closed ___ the inspection is complete.',['by','until','toward','with'],1,'“Remain closed until” describes a state continuing up to the moment inspection is finished.','保持關閉直到檢查結束，使用 until。');
addGrammar('prepositions','g-pr-03','Employees must comply ___ all building safety rules.',['to','on','with','for'],2,'“Comply with” is the correct fixed verb-preposition combination.','固定搭配 comply with regulations。');
addGrammar('relative','g-re-01','The representative ___ called you yesterday is waiting outside.',['whose','where','who','which'],2,'The antecedent is a person (“representative”), and the pronoun is the subject of “called.”','先行詞 representative 是人，關係代名詞作主詞用 who。');
addGrammar('relative','g-re-02','This is the branch ___ the training session will take place.',['where','who','whose','which'],0,'“Where” refers to the location at which the training will happen.','此處先行詞是地點 branch，且子句缺地點副詞，用 where。');
addGrammar('relative','g-re-03','The supplier ___ proposal was selected will visit our office.',['which','whose','where','who'],1,'“Whose” expresses the relationship between the supplier and its proposal.','whose 表「該供應商的提案」之所有關係。');
addGrammar('condition','g-co-01','If the shipment ___ by Thursday, we will offer a refund.',['does not arrive','will not arrive','not arrive','did not arriving'],0,'A real future conditional normally uses present tense in the if-clause: “does not arrive.”','未來真實條件句的 if 子句用現在式否定。');
addGrammar('condition','g-co-02','Unless you ___ the form, we cannot process your request.',['complete','will complete','completed','completing'],0,'“Unless” means “if not.” Present tense “complete” expresses the required condition.','unless = if not；條件子句使用現在式 complete。');
addGrammar('condition','g-co-03','You will receive a confirmation once the payment ___ processed.',['will be','is','was being','be'],1,'“Once” introduces a future time clause that normally uses present tense: “is processed.”','once 引導未來時間子句，通常用現在式被動 is processed。');
addGrammar('comparison','g-cm-01','The updated system is ___ than the old version.',['efficient','more efficient','most efficient','efficiently'],1,'“Than” signals a comparison between two systems, requiring “more efficient.”','than 表兩者比較，使用 more efficient。');
addGrammar('comparison','g-cm-02','Of all the proposals, this one is the ___.',['feasible','more feasible','most feasible','feasibly'],2,'“Of all the proposals” sets a whole group, so the superlative “most feasible” is appropriate.','of all 表群體中的最高程度，用 most feasible。');
addGrammar('comparison','g-cm-03','Today’s delivery was ___ than we expected.',['early','earlier','earliest','earliness'],1,'“Than” calls for the comparative form. “Earlier” is the comparative of “early.”','than 引導比較，選 earlier。');
addGrammar('infinitive','g-in-01','The supervisor reminded employees ___ the access cards.',['bring','bringing','to bring','brought'],2,'The pattern is “remind someone to do something,” so “to bring” follows “employees.”','remind someone to do something：提醒某人去做某事。');
addGrammar('infinitive','g-in-02','The team is responsible for ___ the inventory.',['check','checked','to check','checking'],3,'The preposition “for” is followed by a noun or an -ing form, here “checking.”','介系詞 for 後接 V-ing：checking。');
addGrammar('infinitive','g-in-03','We agreed ___ the deadline by two days.',['extend','to extend','extending','extended'],1,'The verb “agree” can take a to-infinitive to describe an agreed action: “agreed to extend.”','agree to do something：同意做某事。');
const readingLessons=[
 {id:'r-email',kind:'商務郵件',title:'Project Update · 專案時程變更',level:'B1–B2',preview:'找出新期限、收件者必須採取的行動。',sentences:[
  {en:'The client has requested a revised schedule for the product launch.',zh:'客戶要求產品上市時程的修訂版。',note:'has requested 是現在完成式，表示要求與目前情況有關。'},
  {en:'Please review the attached timeline and send your comments by Thursday afternoon.',zh:'請檢視附件時間表，最晚週四下午提交意見。',note:'attached 是修飾 timeline 的過去分詞；by 表示期限。'},
  {en:'If no changes are necessary, simply reply to confirm your approval.',zh:'如果不需要修改，只須回覆確認核准。',note:'If + 現在式，主要子句可用祈使句表達指示。'},
  {en:'We will circulate the final version to all departments on Friday.',zh:'我們會在週五將最終版本發送給所有部門。',note:'will circulate 表示未來預定的安排。'}],
  vocab:['v013','v052','v056','v070'],questions:[
   ['What must team members send by Thursday afternoon?',['A payment receipt','Comments on the timeline','A list of new clients','Event tickets'],1,'The email explicitly requests comments on the attached timeline by Thursday afternoon.','要求在週四下午前提交時間表意見。'],
   ['What happens if no changes are necessary?',['The launch is canceled','The team should reply with approval','The client must visit the office','A new department is created'],1,'A simple reply confirming approval is enough if the timeline requires no changes.','無修改時回覆確認核准即可。']]},
 {id:'r-logistics',kind:'物流通知',title:'Shipment Notice · 貨運安排',level:'B1',preview:'閱讀物流延遲、預計到貨與通知義務。',sentences:[
  {en:'Due to severe weather, the shipment originally scheduled for Tuesday has been delayed.',zh:'因天候惡劣，原訂週二的貨運已延誤。',note:'Due to + 名詞片語表原因；has been delayed 是現在完成式被動。'},
  {en:'The warehouse expects to dispatch the order on Thursday morning.',zh:'倉庫預計週四上午出貨。',note:'expect to do 表預期做某事；dispatch 表出貨。'},
  {en:'Customers will be notified as soon as a tracking number becomes available.',zh:'追蹤編號一經確認，即會通知客戶。',note:'as soon as 時間子句通常用現在式；will be notified 是未來被動。'},
  {en:'Please contact customer service if you need to adjust the delivery address.',zh:'若需修改收貨地址，請聯絡客服。',note:'if 引導條件子句；need to adjust 是不定詞結構。'}],
  vocab:['v043','v060','v030'],questions:[
   ['When does the warehouse expect to dispatch the order?',['Tuesday morning','Wednesday evening','Thursday morning','Friday afternoon'],2,'The second sentence states that dispatch is expected on Thursday morning.','第二句說預計在週四上午出貨。'],
   ['What will trigger a customer notification?',['A tracking number becomes available','A customer pays a deposit','The weather forecast changes','A supervisor completes training'],0,'Customers are notified when a tracking number becomes available.','追蹤編號可用時會通知客戶。']]},
 {id:'r-facilities',kind:'公司公告',title:'Facilities Notice · 設備維修',level:'B1–B2',preview:'辨別施工期間、替代入口與條件規範。',sentences:[
  {en:'The north entrance will be closed for inspection from Monday through Wednesday.',zh:'北側入口將於週一至週三因檢查而關閉。',note:'will be closed 是未來式被動；from ... through 表期間涵蓋。'},
  {en:'During this period, all visitors must use the temporary entrance near the parking area.',zh:'在此期間，所有訪客須使用停車區附近的臨時入口。',note:'must use 是義務；temporary 作形容詞修飾 entrance。'},
  {en:'Contractors will complete the safety inspection before normal access resumes.',zh:'承包商會在正常通行恢復前完成安全檢查。',note:'before 引導時間子句，resumes 用現在式。'},
  {en:'We apologize for any inconvenience and appreciate your cooperation.',zh:'造成不便敬請見諒，感謝配合。',note:'apologize for + 名詞；inconvenience 是名詞。'}],
  vocab:['v012','v047','v064'],questions:[
   ['Where should visitors enter the building?',['Through the north entrance','At the loading dock','Near the parking area','Through the lobby elevator'],2,'Visitors must use the temporary entrance near the parking area.','訪客改走停車場附近的臨時入口。'],
   ['Why is the north entrance closed?',['For an inspection','For an awards ceremony','Because of a strike','To hold a job fair'],0,'The first sentence identifies an inspection as the reason for the closure.','第一句明示是因為檢查而關閉。']]},
 {id:'r-finance',kind:'付款通知',title:'Invoice Follow-up · 發票催繳',level:'B2',preview:'分清尚未支付、核對資訊與下一步程序。',sentences:[
  {en:'Our records indicate that Invoice 318 remains outstanding as of October 8.',zh:'依本公司紀錄，截至十月八日第 318 號發票仍未結清。',note:'remains outstanding = 仍未付款；as of 是截至某日。'},
  {en:'If you have already made the payment, please disregard this reminder.',zh:'如已付款，請忽略此提醒。',note:'have already made 使用現在完成式；if + 現在式表示條件。'},
  {en:'Otherwise, please verify the billing details and proceed with the transfer.',zh:'否則請核對帳單資訊並繼續轉帳程序。',note:'otherwise 表「否則」；verify ... and proceed ... 並列祈使動詞。'},
  {en:'For any questions, contact the accounting department before Friday.',zh:'如有疑問，請於週五前聯絡會計部門。',note:'before Friday 為時間前後關係；department 表部門。'}],
  vocab:['v025','v065','v072'],questions:[
   ['What does the notice say about Invoice 318?',['It was canceled','It has not been fully paid','It was refunded','It belongs to another client'],1,'An outstanding invoice is still unpaid; the notice says it remains outstanding.','outstanding 在發票情境表示尚未結清。'],
   ['What should a recipient do if payment has already been made?',['Pay again','Call the bank immediately','Ignore the reminder','Request an extension'],2,'The second sentence asks recipients who already paid to disregard the reminder.','若已付款則忽略提醒。']]},
 {id:'r-recruit',kind:'招聘通知',title:'Training Requirement · 員工資格',level:'B1–B2',preview:'判斷資格門檻、必要訓練和報名方式。',sentences:[
  {en:'Employees who joined the company after July are eligible for the training program.',zh:'七月之後到職的員工符合該培訓計畫資格。',note:'who 引導關係子句，修飾 Employees；be eligible for 是固定搭配。'},
  {en:'Attendance at the first workshop is mandatory for all new team members.',zh:'所有新團隊成員必須參加第一場工作坊。',note:'mandatory 為形容詞；主詞 Attendance 為單數。'},
  {en:'Applicants should submit the registration form through the employee portal.',zh:'申請人應透過員工入口網站提交報名表。',note:'should + 原形動詞；through the portal 表途徑。'},
  {en:'The human resources department will confirm each applicant’s place by email.',zh:'人資部門將透過電子郵件確認各申請者名額。',note:'will confirm 表未來動作；each applicant’s 是所有格。'}],
  vocab:['v003','v017','v028','v044'],questions:[
   ['Who is eligible for the training?',['All former employees','People who joined after July','Only company directors','All customers'],1,'The first sentence limits eligibility to employees who joined after July.','第一句明示七月之後加入公司的員工符合資格。'],
   ['How will participation be confirmed?',['By telephone','In person','By email','By postal mail'],2,'The HR department will confirm each applicant’s place by email.','人資部門透過 email 確認。']]},
 {id:'r-hotel',kind:'旅宿資訊',title:'Conference Stay · 住宿安排',level:'B2',preview:'理解訂房變動、費用包含與取消期限。',sentences:[
  {en:'Conference participants may reserve a room at the discounted rate until November 12.',zh:'會議參與者可在十一月十二日前以優惠價預訂客房。',note:'may reserve 表可以預訂；until 強調優惠受理持續至該期限。'},
  {en:'The rate includes complimentary breakfast but does not cover parking.',zh:'房價包含免費早餐，但不含停車。',note:'includes 與 does not cover 是對比的兩項條件。'},
  {en:'Guests who cancel fewer than forty-eight hours before arrival may be charged a fee.',zh:'入住前不足四十八小時取消的旅客可能被收取費用。',note:'who cancel 修飾 Guests；may be charged 是情態動詞＋被動。'},
  {en:'Please check availability with the venue before confirming your itinerary.',zh:'確認行程前，請向會場確認房況。',note:'before + V-ing 可表示在某動作之前。'}],
  vocab:['v009','v010','v026','v055'],questions:[
   ['Which service is included in the discounted room rate?',['Parking','Airport transportation','Breakfast','Laundry'],2,'The second sentence says the rate includes complimentary breakfast.','房價含免費早餐，不包含停車。'],
   ['When might a cancellation fee apply?',['When canceling more than a week ahead','When canceling less than 48 hours before arrival','Only after check-out','When booking two rooms'],1,'A fee may apply if cancellation occurs fewer than forty-eight hours before arrival.','入住前不足 48 小時取消可能收費。']]}
];
const readingQuestions=[];
for(const lesson of readingLessons){
 const passage=lesson.sentences.map(s=>s.en).join(' ');
 lesson.questions.forEach(([question,options,answer,reasonEn,reason],i)=>{
  readingQuestions.push({id:`${lesson.id}-q${i+1}`,part:7,question,options,answer,reasonEn,reason,
   tag:'reading-detail',passage,readingId:lesson.id});
 });
}
// Both types enter the same question engine, preserving the V0.1 questionStats format.
root.ToeicTrainerAdvanced=Object.freeze({cards,grammarLessons,readingLessons,questions:[...questions,...readingQuestions]});
})(globalThis);
