import React, { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMixedGame } from '../mixed/useMixedGame.js';
import { useLanguage } from '../preferences/language.js';
import { readSharedMix } from './mixShare.js';
import { getVariantById } from '../../games/config/variantCatalog.js';
import { canLaunchVariant } from '../../games/config/variantAvailability.js';
export default function SharedMixScreen() {
  const { hash } = useLocation(); const navigate = useNavigate(); const { saveProfile } = useMixedGame(); const ja = useLanguage() === 'ja';
  const profile = useMemo(() => { try { return readSharedMix(decodeURIComponent(hash.slice(1))); } catch { return null; } }, [hash]);
  return <main className="min-h-screen bg-slate-950 p-5 text-white"><div className="mx-auto max-w-xl space-y-5"><Link to="/menu">{ja ? 'メニュー' : 'Menu'}</Link><h1 className="text-2xl font-bold">{ja ? '共有されたMIX' : 'Shared MIX'}</h1>{!profile ? <p role="alert">{ja ? 'リンクを読み込めませんでした。送り主にリンクを確認してください。' : 'Could not read this link. Ask the sender to check it.'}</p> : <><h2 className="text-xl">{profile.name}</h2><p>{profile.handsPerGame}{ja ? 'ハンドで切替' : ' hands per game'} · {profile.selectionMode}</p><ol className="space-y-2">{profile.selectedGameIds.map((id, i) => <li key={i}>{i + 1}. {getVariantById(id).name}{!canLaunchVariant(id).canLaunch && <span className="ml-2 text-amber-200">{ja ? '試験公開・開始には確認が必要' : 'Preview — check availability before playing'}</span>}</li>)}</ol><button className="min-h-11 rounded-xl bg-emerald-300 px-4 text-slate-950" onClick={() => { const saved = saveProfile(profile); navigate(`/mixed?preset=${saved.id}`); }}>{ja ? 'MIX設定に取り込む' : 'Open in MIX settings'}</button></>}</div></main>;
}
