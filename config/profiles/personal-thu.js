/* V97 Personal Profile
 *
 * Configuration for the existing personal deployment.
 * This file must NEVER contain:
 * - goal progress
 * - execution history
 * - private calendar records
 * - credentials
 */
window.GOAL_MANAGER_RUNTIME_PROFILE = Object.freeze({
  id: 'personal-thu',
  kind: 'personal',

  institution: Object.freeze({
    id: 'thu',
    name: '東海大學',
  }),

  allowPersonalBootstrap: true,

  features: Object.freeze({
    schoolCalendar: true,
    scholarships: true,
    activities: true,
    activityRadar: true,
  }),
});
