import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { copyTextToClipboard } from '../utils/copyTextToClipboard.js';
import { useLanguage } from '../preferences/language.js';
export default function ShareLink({ url, title }) {
  const ja = useLanguage() === 'ja';
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    setQr(''); setMessage('');
    if (open && url) QRCode.toDataURL(url, { width: 256, margin: 2, errorCorrectionLevel: 'M' }).then(value => { if (active) setQr(value); }).catch(() => { if (active) setMessage(ja ? 'QRに収まらないためリンクをコピーしてください。' : 'Copy the link; this setup is too large for a QR code.'); });
    return () => { active = false; };
  }, [url, open, ja]);
  if (!url) return null;
  return <div className="space-y-3"><button type="button" className="min-h-11 rounded-xl border border-emerald-300/40 px-4 py-2 text-sm" aria-expanded={open} onClick={() => setOpen(!open)}>{title ?? (ja ? 'リンク・QRで共有' : 'Share link / QR')}</button>{open && <div className="space-y-3 rounded-xl border border-white/20 bg-slate-950 p-3"><p className="break-all select-all text-xs">{url}</p>{qr && <img src={qr} width="256" height="256" className="mx-auto h-auto max-w-full rounded" alt={ja ? '共有リンクのQRコード' : 'QR code for this link'} />}<button type="button" className="min-h-11 rounded-lg bg-emerald-300 px-4 text-slate-950" onClick={async () => setMessage(await copyTextToClipboard(url) ? (ja ? 'コピーしました。' : 'Copied.') : (ja ? 'リンクを長押ししてコピーしてください。' : 'Press and hold the link to copy it.'))}>{ja ? 'リンクをコピー' : 'Copy link'}</button>{message && <p role="status" className="text-sm">{message}</p>}</div>}</div>;
}
