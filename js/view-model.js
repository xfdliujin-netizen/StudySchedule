import {instances, shiftDate, today} from './repeat-engine.js';

export function dateStripDays(selected, now = today()) {
  return Array.from({length: 29}, (_, index) => {
    const date = shiftDate(selected, index - 14);
    const distance = Math.round((Date.parse(date) - Date.parse(now)) / 86400000);
    const label = ['前天', '昨天', '今天', '明天', '后天'][distance + 2] || '';
    const monthDay = date.slice(5).replace('-', '/');
    return {date, label, monthDay};
  });
}


export function syncTaskNotice(before, after, subject, date) {
  const oldRows = learningView(before, subject, date).rows;
  const newRows = new Set(learningView(after, subject, date).rows.map(item => item.key));
  const removed = oldRows.filter(item => item.date === date && !newRows.has(item.key));
  if (!removed.length) return '';
  const item = removed[0];
  const task = after.tasks[item.id];
  const exception = after.exceptions[item.key];
  let reason = '安排已变更';
  if (task?.deleted || exception?.deleted) reason = '已删除';
  else if (task && !task.enabled) reason = '已暂停';
  else if (task && (exception?.override?.subjectId ?? task.subjectId) !== item.subjectId) reason = '已变更科目';
  return `云端更新：「${item.title}」${reason}${removed.length > 1 ? `，另有 ${removed.length - 1} 条任务移出当前列表` : ''}。`;
}
export function relativeDay(date, now = today()) {
  if (date === now) return '今日';
  if (date === shiftDate(now, -1)) return '昨日';
  if (date === shiftDate(now, -2)) return '前日';
  if (date === shiftDate(now, 1)) return '明日';
  if (date === shiftDate(now, 2)) return '后日';
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`;
}

export function nearbyDays(data, now = today()) {
  const offsets = [
    [-2, '前天'],
    [-1, '昨天'],
    [0, '今天'],
    [1, '明天'],
    [2, '后天']
  ];
  return offsets.map(([diff, label]) => {
    const d = shiftDate(now, diff);
    const all = instances(data, d, d === now, d === now ? now : null);
    const done = all.filter(item => item.done).length;
    return {
      date: d,
      label,
      total: all.length,
      done,
      pending: all.length - done
    };
  });
}

export function learningView(data, subject = 'all', date = today(), now = today()) {
  const allRows = instances(data, date, date === now, date === now ? now : null);
  const rows = subject === 'all'
    ? allRows
    : allRows.filter(item => item.subjectId === subject);
  const total = rows.length;
  const done = rows.filter(item => item.done).length;
  const pending = total - done;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const totalMinutes = rows.reduce((sum, item) => sum + (Number(item.durationMinutes) || 20), 0);
  const doneMinutes = rows.filter(item => item.done).reduce((sum, item) => sum + (Number(item.durationMinutes) || 20), 0);
  return {
    rows,
    total,
    done,
    pending,
    percent,
    totalMinutes,
    doneMinutes
  };
}
