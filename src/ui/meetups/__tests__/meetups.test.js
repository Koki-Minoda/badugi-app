import { it, expect, afterEach } from 'vitest';
import { validateMeetup,saveMeetup,readMeetups,calendarFile,meetupInvite,readMeetupInvite } from '../meetupStore.js';
const meeting={id:'weekend',name:'週末MIX',organizer:'主催者',startsAt:'2026-10-01T18:00:00+09:00',repeat:'weekly',roomCode:'ABC234',results:[{date:'2026-09-01',note:'A won'}]};
afterEach(()=>localStorage.clear());
it('edits an existing plan while preserving its results',()=>{saveMeetup(meeting);saveMeetup({...meeting,roomCode:'DEF567'});expect(readMeetups()).toHaveLength(1);expect(readMeetups()[0]).toMatchObject({roomCode:'DEF567',results:meeting.results});});
it('shares invite data without local results',()=>{const url=meetupInvite(meeting,'https://example.test');expect(decodeURIComponent(url)).not.toContain('A won');expect(readMeetupInvite(new URL(url).hash)).toMatchObject({name:meeting.name,results:[]});});
it('exports recurrence and escapes calendar control characters',()=>{const ics=calendarFile({...meeting,organizer:'Name\r\nATTENDEE:bad;value'});expect(ics).toContain('RRULE:FREQ=WEEKLY\r\n');expect(ics).toContain('DTSTART:20261001T090000Z');expect(ics).not.toContain('\r\nATTENDEE:');expect(ics).toContain('Name\\nATTENDEE:bad\\;value');});
it('rejects invalid dates and room codes',()=>{for(const change of [{startsAt:'never'},{roomCode:'script'},{name:''}])expect(()=>validateMeetup({...meeting,...change})).toThrow();});
