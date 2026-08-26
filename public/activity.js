export function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function recordActiveDay(progress = {}, date = new Date()) {
  const today = localDayKey(date);
  const currentCount = Number.isInteger(progress.active_day_count) && progress.active_day_count >= 0
    ? Math.min(progress.active_day_count, 100000)
    : 0;

  if (progress.last_active_day === today) {
    return { ...progress, active_day_count: currentCount, last_active_day: today };
  }

  return {
    ...progress,
    active_day_count: currentCount + 1,
    last_active_day: today,
  };
}

export function activeDayLabel(count = 0) {
  const safeCount = Number.isInteger(count) && count >= 0 ? count : 0;
  if (safeCount === 1) return '1 den spolu';
  if (safeCount >= 2 && safeCount <= 4) return `${safeCount} dny spolu`;
  return `${safeCount} dní spolu`;
}
