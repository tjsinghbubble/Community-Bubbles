export function localToUtc(
  date: string,
  time: string,
  timezone: string,
): { date: string; time: string } {
  const localStr = `${date}T${time}:00`;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const localDate = new Date(localStr);
  const utcGuess = new Date(localStr + 'Z');
  const parts = formatter.formatToParts(utcGuess);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  const utcAsLocal = new Date(
    `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:00Z`
  );
  const offsetMs = utcAsLocal.getTime() - utcGuess.getTime();

  const utcDate = new Date(localDate.getTime() - offsetMs);
  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utcDate.getUTCDate()).padStart(2, '0');
  const hh = String(utcDate.getUTCHours()).padStart(2, '0');
  const mm = String(utcDate.getUTCMinutes()).padStart(2, '0');

  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}

export function formatTime12h(time24: string): string {
  const [hourStr, minute] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${minute} ${ampm}`;
}

export function utcToLocal(
  date: string,
  time: string,
  timezone: string,
): { date: string; time: string } {
  const utcDate = new Date(`${date}T${time}:00Z`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(utcDate);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  let hour = getPart('hour');
  if (hour === '24') hour = '00';

  return {
    date: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
    time: `${hour}:${getPart('minute')}`,
  };
}
