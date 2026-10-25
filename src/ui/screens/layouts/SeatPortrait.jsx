import React, {useState} from 'react';
import {getCpuCharacterById, getCpuCharacterByName} from '../../../ai/cpuRoster.js';

export default function SeatPortrait({seat}) {
 const explicit = [seat.avatarUrl, seat.avatar].find(value => value && !['default', 'default_avatar'].includes(value));
 const character = seat.isCPU || seat.cpuStyle || seat.cpuCharacterId
  ? getCpuCharacterById(seat.cpuCharacterId) ?? getCpuCharacterByName(seat.name)
  : null;
 const source = explicit ?? character?.avatarUrl;
 const base = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
 const src = source?.startsWith('/characters/') ? `${base}${source.slice(1)}` : source;
 // A new occupant must retry their own image even if the previous image failed.
 return <PortraitImage key={src ?? 'placeholder'} src={src}/>;
}

function PortraitImage({src}) {
 const [failed, setFailed] = useState(false);
 const [loaded, setLoaded] = useState(false);
 const placeholder = <svg viewBox="0 0 32 32"><circle cx="16" cy="11" r="6"/><path d="M4 31v-3a12 12 0 0 1 24 0v3"/></svg>;
 if (src && !failed && /^(\/|https?:|data:image\/|blob:)/.test(src)) {
  return <>{placeholder}<img src={src} alt="" draggable={false} loading="eager" decoding="async" className={loaded ? 'is-loaded' : ''} onLoad={() => setLoaded(true)} onError={() => setFailed(true)}/></>;
 }
 return placeholder;
}
