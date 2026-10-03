'use strict';

module.exports = {
  anchorDate: '2026-10-01',

  tasks: [
    {
      id: 'root',
      name: '測試方向',
      level: 1,
      parent: null,
      status: '進行中',
      weeklyMinutes: 0,
      start: '',
      due: '',
      progress: 0
    },
    {
      id: 'stage',
      name: '測試階段',
      level: 2,
      parent: 'root',
      status: '進行中',
      weeklyMinutes: 0,
      start: '',
      due: '',
      progress: 0
    },
    {
      id: 'sub',
      name: '測試子任務',
      level: 3,
      parent: 'stage',
      status: '進行中',
      weeklyMinutes: 0,
      start: '2026-09-28',
      due: '2026-10-31',
      progress: 0
    },
    {
      id: 'action',
      name: '測試具體行動',
      level: 4,
      parent: 'sub',
      status: '進行中',
      weeklyMinutes: 420,
      start: '',
      due: '',
      progress: 0
    }
  ],

  logs: [
    {
      id: 'goal-1',
      taskId: 'action',
      kind: 'goal-study',
      actual: true,
      minutes: 60,
      time: '2026-10-01T09:00:00+08:00'
    },
    {
      id: 'goal-2',
      taskId: 'action',
      kind: 'goal-study',
      actual: true,
      minutes: 30,
      time: '2026-10-01T14:00:00+08:00'
    },
    {
      id: 'other-1',
      taskId: null,
      kind: 'other-study',
      actual: true,
      minutes: 40,
      time: '2026-10-01T20:00:00+08:00'
    },
    {
      id: 'system-1',
      taskId: 'action',
      kind: 'system',
      actual: false,
      minutes: 0,
      time: '2026-10-01T21:00:00+08:00'
    }
  ],

  executionPlans: [
    {
      id: 'plan-1',
      taskId: 'action',
      date: '2026-10-01',
      minutes: 120,
      status: 'active'
    }
  ],

  expected: {
    goalActualMinutes: 90,
    otherStudyMinutes: 40,
    totalStudyMinutes: 130,
    systemMinutes: 0,
    weeklyTargetMinutes: 420
  }
};
