import {key, shiftDate} from './repeat-engine.js';

export function uid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID(); } catch (e) {}
  }
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export const stamp = () => ({ rev: uid(), updatedAt: new Date().toISOString() });

export function saveTask(data, values, original, date, scope = 'future') {
  const now = new Date().toISOString();
  if (!original) {
    const id = uid();
    data.tasks[id] = { ...values, id, createdAt: now, ...stamp() };
    return;
  }
  if (scope === 'day') {
    data.exceptions[key(original.id, date)] = { override: values, ...stamp() };
    return;
  }
  const prior = data.tasks[original.id];
  if (date > prior.startDate) {
    data.tasks[prior.id] = { ...prior, endDate: shiftDate(date, -1), ...stamp() };
    const id = uid();
    data.tasks[id] = {
      ...values,
      id,
      startDate: values.startDate < date ? date : values.startDate,
      createdAt: now,
      ...stamp()
    };
  } else {
    data.tasks[prior.id] = { ...prior, ...values, ...stamp() };
  }
}

export function deleteTask(data, id, date, scope) {
  const t = data.tasks[id];
  if (scope === 'day') data.exceptions[key(id, date)] = { deleted: true, ...stamp() };
  else if (scope === 'future') data.tasks[id] = { ...t, endDate: shiftDate(date, -1), ...stamp() };
  else data.tasks[id] = { ...t, deleted: true, ...stamp() };
}

export function complete(data, task) {
  data.completions[task.key] = {
    completionId: task.key,
    taskId: task.id,
    occurrenceDate: task.date,
    status: !task.done,
    completedAt: task.done ? null : new Date().toISOString(),
    ...stamp()
  };
}
