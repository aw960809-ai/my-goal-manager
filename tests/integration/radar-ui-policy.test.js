const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const html=read('index.html');
const activity=read('js/activity.js');
const health=read('js/autofetch-health.js');
const policy=read('js/domain/radar-policy.js');

assert(
  html.includes('<option value="中部">③ 中部</option>'),
  'activity filter must expose Central Taiwan as circle 3'
);

assert(
  html.includes('<option value="全國">④ 全國</option>'),
  'activity filter must expose Nationwide as circle 4'
);

assert(
  !html.includes('<option value="海外／國際">④ 海外／國際</option>'),
  'international must not be a radar circle'
);

assert(
  html.includes('<b>③ 中部</b>')&&
  html.includes('<b>④ 全國</b>'),
  'radar guide must match RadarPolicy circle labels'
);

assert(
  policy.includes("3:'中部'")&&policy.includes("4:'全國'"),
  'RadarPolicy geographic labels changed unexpectedly'
);

assert(
  activity.includes("RadarPolicy.isInternationalActivity(a)")&&
  activity.includes("'<span class=\"activity-chip\">海外／國際</span>'"),
  'international activities must remain an extra tag'
);

assert(
  activity.includes("box.dataset.remoteState='load-failed'")&&
  health.includes("window.__activityRemoteRetryDone")&&
  health.includes("window.loadRemoteActivities()"),
  'healthy remote sources must trigger one list-load retry'
);


assert(
  activity.includes('function activitySort(a,b)')&&
  activity.includes('(b.fit.score-a.fit.score)')&&
  activity.includes('(a.fit.circleLevel-b.fit.circleLevel)'),
  'activity list comparator must exist: score first, then nearer circle'
);


assert(
  activity.includes('activity-review-disclosure')&&
  activity.includes('暫不列入推薦 · 點擊展開')&&
  !activity.includes('review.slice(0,20)'),
  'source-review rows must be collapsed by default instead of showing a long list'
);

console.log('OK: activity radar UI matches geography policy and remote-source status is coherent');
