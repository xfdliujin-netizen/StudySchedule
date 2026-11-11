import {instances, shiftDate, today} from './repeat-engine.js';

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
    const all = instances(data, d, d === now);
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
  const allRows = instances(data, date, date === now);
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
