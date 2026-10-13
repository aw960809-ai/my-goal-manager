/* Auto-link history consent and idempotency regression, 2026-10-13. */
'use strict';
const assert = require('node:assert/strict');
const P = require('../js/domain/toeic-sync-policy.js');
const tasks = [
  {id:'toeic-direction-2026',level:1,status:'進行中'},
  {id:'g3-2026-integrated',parent:'toeic-direction-2026',level:2,status:'進行中'},
  {id:'g3-2026-10',parent:'g3-2026-integrated',level:3,start:'2026-10-01',due:'2026-11-01',status:'進行中'},
  {id:'g3-2026-10-article',parent:'g3-2026-10',level:4,weeklyMinutes:60,status:'進行中',name:'文章精讀'}
];
const s = {
  id:'tt-20261012-history-0001',appId:'toeic-trainer-standalone',schema:1,
  date:'2026-10-12',createdAt:'2026-10-12T03:00:00.000Z',seconds:180,
  unit:'article',mode:'reading',part:7,questionsAnswered:2,correct:1,
  questionIds:['p7-history-1','p7-history-2'],suggestedGoalTaskId:'g3-2026-10-article'
};
const trainer = {appId:'toeic-trainer-standalone',schema:1,sessions:[s]};
const consent = {version:1,enabled:true,enabledAt:'2026-10-13T00:00:00.000Z'};
const now = new Date('2026-10-13T04:00:00.000Z');
let r = P.reconcile(trainer,consent,{tasks,logs:[],now});
assert.equal(r.blocked,'');
assert.equal(r.eligible.length,1,'eligible older valid sessions should be offered to Goal Manager');
assert.equal(r.eligible[0].log.minutes,3);
r = P.reconcile(trainer,consent,{tasks,logs:[r.eligible[0].log],now});
assert.equal(r.eligible.length,0,'no repeat credit for an existing event');
assert.equal(r.already.length,1);
// Consent timing must not exclude otherwise valid history, including the
// exact enabledAt boundary. All normal validation checks remain active.
const boundaryConsent = {version:1,enabled:true,enabledAt:s.createdAt};
assert.equal(P.reconcile(trainer,boundaryConsent,{tasks,logs:[],now}).eligible.length,1);
const invalid = {...s, id:'tt-bad-history-00000001', seconds:59};
assert.equal(P.reconcile({...trainer,sessions:[invalid]},consent,{tasks,logs:[],now}).excluded.length,1);
r = P.reconcile(trainer,consent,{tasks,logs:[{
  id:'manual-1',taskId:'g3-2026-10-article',time:s.createdAt,minutes:3,
  actual:true,kind:'goal-study',source:'manual'
}],now});
assert.equal(r.eligible.length,0,'same-day manually credited study must not be credited twice');
assert.equal(r.held.length,1);
r = P.reconcile(trainer,{version:1,enabled:false,enabledAt:consent.enabledAt},{tasks,logs:[],now});
assert.equal(r.eligible.length,0,'disabled consent must block credit');
assert(r.blocked);
console.log('PASS: consented historical TOEIC events, duplicate protection, manual overlap, disabled consent');
