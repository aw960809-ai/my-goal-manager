/* V96 central policy configuration. Adjust policy here without touching UI rendering. */
window.AppConfig = Object.freeze({
  version: 'V97.9.4.2',
  data: {
    activities: './data/activities.json',
    scholarships: './data/scholarships.json',
    activityArchive: './data/activity-archive.json',
    scholarshipArchive: './data/scholarship-archive.json',
    legacyCombined: './data/events.json'
  },
  activity: {
    weights: { goal: 45, direct: 20, knowledge: 15, proximity: 15, freshness: 5 },
    institutionalBonus: 5,
    rings: { core: { distance: 2, priority: 75 }, near: { distance: 3, priority: 65 }, extended: { priority: 45 } },
    minimumDurationMinutes: 30,
    pageSize: 4
  },
  scholarship: { levels: { high: 80, possible: 60 }, cap: 99 }
});
window.ActivityRules = window.AppConfig.activity;
window.ScholarshipRules = window.AppConfig.scholarship;


/* V97.9.3 visual theme loader */
(() => {
  const id = 'thu-theme-v9793';
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = './css/theme-v9793.css';

  document.head.appendChild(link);
})();

/* V97.9.4 visual system loader */
(() => {
  const id = 'thu-theme-v9794';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = './css/theme-v9794.css';
  document.head.appendChild(link);
})();
