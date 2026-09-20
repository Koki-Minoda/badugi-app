const KEY = 'mgx.meetups.v1';
export function validateMeetup(value) {
  if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80 || typeof value.organizer !== 'string' || !value.organizer.trim() || value.organizer.length > 60 || !Number.isFinite(Date.parse(value.startsAt)) || !['once','weekly'].includes(value.repeat) || (value.roomCode && !/^[A-Z2-9]{6}$/.test(value.roomCode))) throw new Error('Invalid meetup');
  const results = Array.isArray(value.results) ? value.results.slice(0,52).map(result => {
    if (!Number.isFinite(Date.parse(result.date)) || typeof result.note !== 'string' || result.note.length > 2000) throw new Error('Invalid results');
    return { date:result.date, note:result.note };
  }) : [];
  return { id:typeof value.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value.id) ? value.id : crypto.randomUUID(), name:value.name.trim(), organizer:value.organizer.trim(), startsAt:new Date(value.startsAt).toISOString(), repeat:value.repeat, roomCode:value.roomCode || '', results };
}
export function readMeetups() { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]').slice(0,50).map(validateMeetup); } catch { return []; } }
export function saveMeetup(value) { const meeting = validateMeetup(value); const all = readMeetups(); const updated = [meeting,...all.filter(m => m.id !== meeting.id)].slice(0,50); localStorage.setItem(KEY,JSON.stringify(updated)); return updated; }
const escapeText = value => value.replace(/\\/g,'\\\\').replace(/\r\n?|\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
export function calendarFile(meeting) {
  const m = validateMeetup(meeting);
  const stamp = value => new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MGX//Meetup//JA','BEGIN:VEVENT',`UID:${m.id}@mgx.local`,`DTSTAMP:${stamp(Date.now())}`,`DTSTART:${stamp(m.startsAt)}`,`SUMMARY:${escapeText(m.name)}`,`DESCRIPTION:${escapeText(m.organizer)}`, ...(m.repeat === 'weekly' ? ['RRULE:FREQ=WEEKLY'] : []),'END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
export function meetupInvite(meeting, origin=window.location.origin) { const {name,organizer,startsAt,repeat,roomCode} = validateMeetup(meeting); return `${origin}/meetups#${encodeURIComponent(JSON.stringify({name,organizer,startsAt,repeat,roomCode}))}`; }
export function readMeetupInvite(hash) { if (!hash) return null; if (hash.length > 4000) throw new Error('Invalid invite'); return validateMeetup(JSON.parse(decodeURIComponent(hash.replace(/^#/,'')))); }
