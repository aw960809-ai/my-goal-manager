/* 100% independently authored practice material; NOT official ETS questions. */
(function(root){
'use strict';
const cards = [
  ['allocate','v.','分配；撥出','The manager will allocate funds for employee training.','allocate a budget','budget'],
  ['agenda','n.','議程','Please review the agenda before the meeting.','meeting agenda','office'],
  ['applicant','n.','申請人；應徵者','Each applicant must submit a résumé.','job applicant','hiring'],
  ['authorize','v.','授權；批准','Only supervisors can authorize a refund.','authorize a payment','finance'],
  ['available','adj.','可用的；有空的','The conference room is available after two.','be available for','office'],
  ['benefit','n.','福利；好處','The company offers competitive employee benefits.','employee benefits','hiring'],
  ['budget','n.','預算','The project is currently under budget.','annual budget','finance'],
  ['candidate','n.','候選人','Three candidates will attend the final interview.','qualified candidate','hiring'],
  ['complimentary','adj.','免費贈送的','Guests receive complimentary breakfast.','complimentary service','travel'],
  ['confirm','v.','確認','Please confirm your reservation by Friday.','confirm a reservation','travel'],
  ['consent','n.','同意','Written consent is required for data collection.','obtain consent','office'],
  ['contractor','n.','承包商','The contractor will repair the elevators tomorrow.','independent contractor','office'],
  ['deadline','n.','截止期限','The deadline for applications is October 25.','meet a deadline','office'],
  ['delay','n./v.','延誤；延遲','The shipment was delayed due to heavy rain.','flight delay','travel'],
  ['department','n.','部門','Contact the accounting department for a receipt.','sales department','office'],
  ['deposit','n.','押金；存款','A small deposit is needed to secure the booking.','refundable deposit','finance'],
  ['eligible','adj.','符合資格的','Employees are eligible for a bonus after six months.','be eligible for','hiring'],
  ['estimate','n./v.','估價；預估','We expect a revised cost estimate tomorrow.','cost estimate','finance'],
  ['extend','v.','延長；擴展','The company agreed to extend the contract.','extend a deadline','office'],
  ['facilitate','v.','促進；協助','The new portal will facilitate online registration.','facilitate communication','office'],
  ['frequently','adv.','頻繁地','The software is frequently updated.','frequently asked questions','office'],
  ['implement','v.','實施','The policy will be implemented next month.','implement a plan','office'],
  ['inquire','v.','詢問','Please inquire at the front desk for more information.','inquire about','travel'],
  ['inventory','n.','存貨；庫存','The store checks its inventory every Friday.','inventory management','business'],
  ['invoice','n.','發票；請款單','The supplier emailed an invoice yesterday.','issue an invoice','finance'],
  ['itinerary','n.','行程表','The travel agent sent an updated itinerary.','travel itinerary','travel'],
  ['maintain','v.','維護；維持','Technicians maintain the equipment regularly.','maintain equipment','office'],
  ['mandatory','adj.','強制的；必須的','Attendance at the safety briefing is mandatory.','mandatory training','office'],
  ['negotiate','v.','協商','We need to negotiate the delivery terms.','negotiate a contract','business'],
  ['notify','v.','通知','Customers will be notified of any schedule changes.','notify someone of','office'],
  ['occasionally','adv.','偶爾','The warehouse occasionally closes for inspections.','occasionally required','office'],
  ['overdue','adj.','逾期的','Payment is overdue by five business days.','overdue payment','finance'],
  ['persuade','v.','說服','The proposal persuaded the committee to act.','persuade a client','business'],
  ['postpone','v.','延後','The workshop has been postponed until Tuesday.','postpone a meeting','office'],
  ['procedure','n.','程序；流程','Please follow the standard safety procedure.','standard procedure','office'],
  ['purchase','v./n.','購買；採購','Purchase orders require managerial approval.','purchase order','finance'],
  ['reimburse','v.','報銷；償還','The company will reimburse your travel expenses.','reimburse expenses','finance'],
  ['reliable','adj.','可靠的','The delivery service has been very reliable.','reliable supplier','business'],
  ['renovation','n.','整修','The lobby is closed for renovation this week.','office renovation','office'],
  ['requirement','n.','條件；要求','The position has several language requirements.','meet a requirement','hiring'],
  ['retain','v.','保留；留住','Please retain a copy of your receipt.','retain a record','office'],
  ['schedule','n./v.','時間表；安排','A technician has been scheduled for Monday.','schedule an appointment','office'],
  ['shipment','n.','運送貨物','The shipment is expected to arrive on Thursday.','track a shipment','business'],
  ['submit','v.','提交','All reports must be submitted by noon.','submit a report','office'],
  ['substitute','n./v.','替代品；代替','We will provide a substitute product at no extra cost.','suitable substitute','business'],
  ['sufficient','adj.','足夠的','We have sufficient supplies for the event.','sufficient time','business'],
  ['temporary','adj.','暫時的','The temporary entrance is located near the parking lot.','temporary closure','office'],
  ['venue','n.','場地','The conference venue is close to the station.','event venue','travel']
].map(([word,pos,zh,example,collocation,tag],i)=>({id:'v'+String(i+1).padStart(3,'0'),word,pos,zh,example,collocation,tag}));
const questions=[];
function add(part,id,question,options,answer,reason,tag,extra={}){
  questions.push({part,id,question,options,answer,reason,tag,...extra});
}
// Part 2 — audio prompt; practice answers printed on screen as an accommodation.
add(2,'p2-01','Choose the best response.',['At the front desk.','About twenty pages.','Yes, I ordered it.'],0,'Where = 地點問句，應回答「在接待櫃檯」。','question-word',{audio:'Where can I pick up my visitor badge?',transcript:'Where can I pick up my visitor badge?'});
add(2,'p2-02','Choose the best response.',['It was held yesterday.','Yes, I have a copy.','About three hours.'],1,'Do you have... 問有沒有副本，Yes, I have a copy 回答最直接。','response',{audio:'Do you have the revised contract?',transcript:'Do you have the revised contract?'});
add(2,'p2-03','Choose the best response.',['Because the printer stopped working.','By the conference room.','For the sales team.'],0,'Why 問原因；because 解釋延誤的原因。','cause',{audio:'Why was the report delayed?',transcript:'Why was the report delayed?'});
add(2,'p2-04','Choose the best response.',['At the airport.','No, it is scheduled for Friday.','The marketing director.'],1,'Is...today? 問日期；以 No + 正確日期回答。','dates',{audio:'Is the orientation session today?',transcript:'Is the orientation session today?'});
add(2,'p2-05','Choose the best response.',['The finance department.','About sixty dollars.','I sent them this morning.'],1,'How much 問價格，應回答金額。','numbers',{audio:'How much is the registration fee?',transcript:'How much is the registration fee?'});
add(2,'p2-06','Choose the best response.',['At least twice a year.','From the office.','It is a new model.'],0,'How often 問頻率；twice a year 是頻率。','frequency',{audio:'How often is the equipment inspected?',transcript:'How often is the equipment inspected?'});
add(2,'p2-07','Choose the best response.',['The restaurant on Pine Street.','No, we do not accept checks.','The supplier called.'],0,'Which restaurant? 要選擇特定地點或對象。','question-word',{audio:'Which restaurant did you book for the team dinner?',transcript:'Which restaurant did you book for the team dinner?'});
add(2,'p2-08','Choose the best response.',['I will send it before lunch.','Yes, it is very crowded.','He works upstairs.'],0,'When 問時間；before lunch 為時間資訊。','dates',{audio:'When will you send the updated itinerary?',transcript:'When will you send the updated itinerary?'});
const conv1='Woman: Good morning, I am calling about the delivery of our new office chairs.\nMan: They were scheduled for today, but the supplier called to report a one-day delay.\nWoman: That is fine. Could you ask the driver to use the rear entrance?\nMan: Certainly. I will add that to the delivery instructions.';
add(3,'p3-01','What are the speakers discussing?',['An office furniture delivery','A job interview','A company banquet'],0,'chairs + supplier + delivery 指向辦公家具的運送。','main-idea',{audio:conv1,transcript:conv1});
add(3,'p3-02','When will the chairs arrive?',['Today','Tomorrow','Next week'],1,'one-day delay = 延遲一天；原訂今天，改為明天。','detail',{audio:conv1,transcript:conv1});
add(3,'p3-03','What does the woman request?',['A payment receipt','A larger vehicle','Use of a rear entrance'],2,'Could you ask the driver to use the rear entrance? 是直接請求。','request',{audio:conv1,transcript:conv1});
const conv2='Man: I noticed the conference registration form is no longer available online.\nWoman: That is because registration closed last night. But there are still some seats for the morning workshop.\nMan: Can I register by telephone?\nWoman: Yes. Call the events office before five this afternoon.';
add(3,'p3-04','Why is the online form unavailable?',['The website is being redesigned','Registration has closed','All workshops were canceled'],1,'registration closed last night 是直接原因。','cause',{audio:conv2,transcript:conv2});
add(3,'p3-05','Which event still has available seats?',['The morning workshop','The evening reception','The keynote speech'],0,'there are still some seats for the morning workshop。','detail',{audio:conv2,transcript:conv2});
add(3,'p3-06','What is the man advised to do?',['Send a letter','Visit a supplier','Call the events office'],2,'Call the events office before five this afternoon。','next-step',{audio:conv2,transcript:conv2});
const talk1='Attention, passengers on Flight 286 to Sydney. Boarding will begin at Gate 12 in approximately ten minutes. Passengers requiring extra assistance may approach the gate staff now. Please have your boarding passes and identification ready.';
add(4,'p4-01','What is the announcement about?',['A flight boarding process','A hotel reservation','A train schedule'],0,'passengers + gate + boarding passes 表示登機廣播。','main-idea',{audio:talk1,transcript:talk1});
add(4,'p4-02','When will boarding begin?',['Immediately','In about ten minutes','In one hour'],1,'in approximately ten minutes = 約十分鐘後。','numbers',{audio:talk1,transcript:talk1});
add(4,'p4-03','Who may approach the staff now?',['People with large bags','All passengers','Passengers needing assistance'],2,'requiring extra assistance 的旅客可先接洽工作人員。','detail',{audio:talk1,transcript:talk1});
const talk2='Hello, everyone. I am pleased to announce that our new employee training portal launches next Monday. Staff members can access short video lessons and download reference materials. Department supervisors will email login instructions by Friday. For technical questions, please contact the IT help desk.';
add(4,'p4-04','What will launch next Monday?',['A training portal','A new branch office','A travel service'],0,'new employee training portal launches next Monday。','main-idea',{audio:talk2,transcript:talk2});
add(4,'p4-05','What will supervisors send?',['Printed handbooks','Login instructions','Expense forms'],1,'Department supervisors will email login instructions。','detail',{audio:talk2,transcript:talk2});
add(4,'p4-06','Whom should staff contact for technical questions?',['The travel agent','Their clients','The IT help desk'],2,'technical questions → IT help desk。','inference',{audio:talk2,transcript:talk2});
// Part 5 — sentence completion; original examples.
add(5,'p5-01','All applications must be submitted ___ Friday.',['on','by','into','during'],1,'by Friday = 最晚星期五前；on Friday = 恰好週五。','preposition');
add(5,'p5-02','The report was ___ reviewed before publication.',['care','careful','carefully','caring'],2,'副詞 carefully 修飾被動動詞 reviewed。','word-form');
add(5,'p5-03','Please contact Ms. Chen if you have ___ questions.',['any','many of','each','every'],0,'肯定條件句 if you have any questions 為常見商用搭配。','determiner');
add(5,'p5-04','The workshop was postponed ___ the speaker was ill.',['although','because','unless','despite'],1,'because 後接完整子句，表示原因。despite 後接名詞或動名詞。','conjunction');
add(5,'p5-05','Our company has opened three new offices ___ 2022.',['for','during','since','until'],2,'現在完成式 has opened + since 2022，表示自某年以來。','tense');
add(5,'p5-06','The new software is more efficient ___ the previous version.',['from','than','that','as'],1,'比較級 more efficient than 是固定搭配。','comparison');
add(5,'p5-07','The maintenance team is responsible ___ inspecting all elevators.',['for','to','with','of'],0,'be responsible for + V-ing。','collocation');
add(5,'p5-08','A list of approved suppliers ___ attached to this email.',['are','have','is','were'],2,'句子主詞是單數的 A list，而非 suppliers，所以用 is。','agreement');
add(5,'p5-09','The manager asked us ___ the figures before the meeting.',['verify','verifying','to verify','verified'],2,'ask someone to do something = 要求某人做某事。','infinitive');
add(5,'p5-10','Customers will receive a refund if their order ___ canceled.',['is','be','has','will'],0,'if 條件子句用現在式被動 is canceled，不使用 will be。','condition');
const p6='To: All Staff\nSubject: Office Renovation\n\nBeginning Monday, the west entrance will be [1] for renovations. Employees should use the east entrance [2] further notice. We apologize for any [3] this change may cause. Please contact Facilities if you require [4] assistance.';
add(6,'p6-01','Which word best fits blank [1]?',['closed','close','closing','closes'],0,'will be closed = 將被關閉；此處須用過去分詞構成被動。','passive',{passage:p6});
add(6,'p6-02','Which word best fits blank [2]?',['into','until','among','toward'],1,'until further notice = 直到另行通知，是固定搭配。','collocation',{passage:p6});
add(6,'p6-03','Which word best fits blank [3]?',['convenient','convenience','inconvenience','inconveniently'],2,'apologize for any inconvenience = 對造成不便致歉。','word-form',{passage:p6});
add(6,'p6-04','Which word best fits blank [4]?',['additional','addition','add','additionally'],0,'形容詞 additional 修飾名詞 assistance。','word-form',{passage:p6});
const p7a='From: Maria Lopez <m.lopez@northbridge.example>\nTo: Project Team\nSubject: Updated Presentation Schedule\n\nHello everyone,\n\nOur client has requested that Thursday’s presentation start thirty minutes earlier than originally planned. The session will now begin at 9:30 a.m. in Conference Room B. Please email your updated slides to me by 4 p.m. on Wednesday so I can compile the final presentation.\n\nThank you,\nMaria';
add(7,'p7-01','What is the main purpose of the email?',['To change a meeting time','To recruit an employee','To request a refund','To announce a holiday'],0,'requested ... start thirty minutes earlier 與 now begin at 9:30 表示通知時間變更。','main-idea',{passage:p7a});
add(7,'p7-02','When is the presentation scheduled to begin?',['9:00 a.m. Thursday','9:30 a.m. Thursday','4:00 p.m. Wednesday','10:30 a.m. Friday'],1,'will now begin at 9:30 a.m.，且原本會議在 Thursday。','detail',{passage:p7a});
add(7,'p7-03','Why does Maria need the slides by Wednesday afternoon?',['To print posters','To send invitations','To combine the final materials','To reserve a room'],2,'so I can compile the final presentation = 整合簡報。','purpose',{passage:p7a});
const p7b='CITY TRANSIT NOTICE\n\nDue to scheduled track maintenance, the Riverside Line will operate a reduced service this Saturday from 6:00 a.m. to 2:00 p.m. Trains will depart every 20 minutes instead of the usual 10 minutes. Riders going to the central business district may also use Bus Route 18 at no additional charge. Full service will resume at 2:00 p.m.';
add(7,'p7-04','Why will trains run less often?',['A staff meeting','Track maintenance','Bad weather','A fare increase'],1,'scheduled track maintenance 是減班原因。','cause',{passage:p7b});
add(7,'p7-05','How often will trains depart during the reduced service?',['Every 10 minutes','Every 15 minutes','Every 20 minutes','Every 30 minutes'],2,'Trains will depart every 20 minutes。','numbers',{passage:p7b});
add(7,'p7-06','Which alternative transportation is mentioned?',['Bus Route 18','Airport shuttle','Bicycle rental','Taxi vouchers'],0,'may also use Bus Route 18 at no additional charge。','detail',{passage:p7b});
// English-first explanations: reading/listening practice is explained in English, with Chinese support.
const explanationEn={
  'p2-01':'The word "Where" asks for a place. "At the front desk" provides a location.',
  'p2-02':'A yes-or-no question about a contract calls for a direct answer about having a copy.',
  'p2-03':'The question begins with "Why". A clause beginning with "Because" explains the delay.',
  'p2-04':'The speaker asks whether the session is today. "No, ... Friday" corrects the date.',
  'p2-05':'"How much" asks about the amount of money, not a person or place.',
  'p2-06':'"How often" asks for frequency. "Twice a year" specifies how frequently.',
  'p2-07':'"Which restaurant" asks the listener to identify a particular restaurant.',
  'p2-08':'"When" asks about time. "Before lunch" provides a deadline.',
  'p3-01':'The speakers discuss chairs, a supplier, and delivery instructions. These details point to office furniture delivery.',
  'p3-02':'The chairs were originally due today, but a one-day delay moves their arrival to tomorrow.',
  'p3-03':'The woman directly asks that the delivery driver use the rear entrance.',
  'p3-04':'The online form is unavailable because registration closed the previous night.',
  'p3-05':'The woman specifically says seats remain for the morning workshop.',
  'p3-06':'The woman instructs the man to call the events office before five.',
  'p4-01':'The references to a gate, boarding passes, and flight number identify an airport boarding announcement.',
  'p4-02':'"Approximately ten minutes" means boarding starts in about ten minutes.',
  'p4-03':'Passengers who need extra assistance are invited to approach the gate staff immediately.',
  'p4-04':'The speaker announces that a new employee training portal will launch on Monday.',
  'p4-05':'Department supervisors will email the instructions employees need to log in.',
  'p4-06':'The IT help desk is the named contact for technical problems.',
  'p5-01':'The preposition "by" indicates a deadline: no later than Friday.',
  'p5-02':'An adverb is needed to modify "reviewed". "Carefully" is the adverb form.',
  'p5-03':'"Any questions" is a natural expression in an open condition: if you have questions of any kind.',
  'p5-04':'"Because" introduces the reason that the workshop was postponed.',
  'p5-05':'The present perfect works with "since" followed by a starting time, such as 2022.',
  'p5-06':'Use "than" after a comparative adjective: more efficient than the previous version.',
  'p5-07':'The correct collocation is "be responsible for" followed by a noun or -ing form.',
  'p5-08':'The head of the subject is the singular noun "list", so the verb is "is".',
  'p5-09':'The pattern is "ask someone to do something": asked us to verify.',
  'p5-10':'A future condition generally takes the present tense in the if-clause: if an order is canceled.',
  'p6-01':'"Will be closed" is the future passive form, describing the entrance being unavailable.',
  'p6-02':'"Until further notice" means the restriction stays in effect until a new announcement.',
  'p6-03':'The sentence needs a noun after "any"; "inconvenience" fits the apology.',
  'p6-04':'The adjective "additional" modifies the noun "assistance".',
  'p7-01':'The main message announces a new start time for the client presentation.',
  'p7-02':'Maria says the meeting will now begin at 9:30 a.m. on Thursday.',
  'p7-03':'Maria needs the slides in advance so she can compile the final presentation.',
  'p7-04':'The notice identifies scheduled track maintenance as the reason for reduced train service.',
  'p7-05':'The trains depart every twenty minutes during the maintenance period.',
  'p7-06':'The notice offers Bus Route 18 as an alternative, with no extra charge.'
};
questions.forEach(q=>{q.reasonEn=explanationEn[q.id]||''});
root.ToeicTrainerContent=Object.freeze({cards:Object.freeze(cards),questions:Object.freeze(questions)});
})(globalThis);
