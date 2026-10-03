'use strict';

const assert = require('assert');
const fixture = require('../fixtures/canonical-db.js');

const goalActual = fixture.logs
  .filter(x => x.kind === 'goal-study' && x.actual === true)
  .reduce((sum, x) => sum + Number(x.minutes || 0), 0);

const otherStudy = fixture.logs
  .filter(x => x.kind === 'other-study' && x.actual === true)
  .reduce((sum, x) => sum + Number(x.minutes || 0), 0);

const systemMinutes = fixture.logs
  .filter(x => x.kind === 'system')
  .reduce((sum, x) => sum + Number(x.minutes || 0), 0);

const totalStudy = goalActual + otherStudy;

assert.strictEqual(goalActual, fixture.expected.goalActualMinutes);
assert.strictEqual(otherStudy, fixture.expected.otherStudyMinutes);
assert.strictEqual(totalStudy, fixture.expected.totalStudyMinutes);
assert.strictEqual(systemMinutes, fixture.expected.systemMinutes);

const action = fixture.tasks.find(x => x.id === 'action');

assert(action);
assert.strictEqual(
  action.weeklyMinutes,
  fixture.expected.weeklyTargetMinutes
);

assert.strictEqual(
  goalActual,
  90,
  'other-study must not be included in goal progress'
);

console.log('OK: architecture foundation canonical behavior');
