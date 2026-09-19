import { readFile, writeFile } from 'node:fs/promises';
import { VARIANT_AVAILABILITY } from '../../src/games/config/variantAvailability.js';
const root = new URL('./', import.meta.url);
export async function readProgress() {
  try { return JSON.parse(await readFile(new URL('progress.json', root), 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  return {
    updated: new Date().toISOString(),
    scope: '37種目（公開24・検証中12・未実装1）、学習、通常対局、トーナメント、MIX、履歴／リプレイ、通信、端末操作',
    games: Object.entries(VARIANT_AVAILABILITY).map(([id, v]) => ({ id, name: v.label, availability: v.availability, cashDesktop: '未確認', cashIphone: '未確認', tournament: '未確認', portrait: '未確認', landscape: '未確認', replay: '未確認', bugs: [] })),
    features: [
      { name: '学習：クイズ・3種目練習・復習・英語', status: 'iPhone実機で6グループ合格（9/19）', evidence: '../learning-entry/IPHONE-PHYSICAL-QA.md' },
      { name: 'ゲーム進行・既知不具合・種目公開設定の回帰', status: '今回111件合格（4ファイル）', evidence: 'artifacts/engine-regression.log' },
      ...['トーナメント開始・中断・再開・敗退・優勝', 'MIXの種目交代', '履歴・リプレイ・復習への保存', 'ログイン・登録・ログアウト', '友達対戦・通信復帰', 'PWAインストール・再起動', '実キーボード・タッチ操作', '実機の縦横回転・セーフエリア'].map(name => ({ name, status: '未確認', evidence: '' })),
    ],
    bugs: [],
    notes: ['判定は実施した範囲に限る。起動だけ・1ハンドだけの確認を、全機能合格とは記載しない。', '未実装OFCと検証中12種目は公開中種目と分ける。', '専用ローカルAPI／DBと検査用ブラウザを使用。本番配信・本番成績は変更しない。', '物理iPhone、ブラウザでの端末再現、ユニットテストを区別する。'],
  };
}
export async function updateProgress(change) {
  const p = await readProgress(); await change(p); p.updated = new Date().toISOString();
  await writeFile(new URL('progress.json', root), JSON.stringify(p, null, 2) + '\n');
  const cell = x => String(x ?? '').replaceAll('|', '／').replaceAll('\n', ' ');
  const availability = { alpha_playable: '公開中', preview_only: '検証中', coming_soon: '未実装' };
  let md = '# MGX 全体確認・プレイ不具合一覧\n\n更新（UTC）: '+p.updated+'\n\n'+p.scope+'。\n\n'+(p.summary || '検査中。')+'\n\n';
  md += p.notes.map(x=>'- '+x).join('\n')+'\n\n## 種目別\n\n| 種目 | 提供状態 | PC通常対局 | iPhone通常対局 | トーナメント | 縦画面 | 横画面 | リプレイ | 不具合 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
  md += p.games.map(g=>'| '+[g.name,availability[g.availability],g.cashDesktop,g.cashIphone,g.tournament,g.portrait,g.landscape,g.replay,g.bugs.join(', ')||'未検出／未確認'].map(cell).join(' | ')+' |').join('\n');
  md+='\n\n## 機能別\n\n| 機能 | 状態 | 証拠 |\n| --- | --- | --- |\n'+p.features.map(f=>'| '+cell(f.name)+' | '+cell(f.status)+' | '+(f.evidence?'['+cell(f.evidence)+']('+f.evidence+')':'—')+' |').join('\n');
  md+='\n\n## 不具合・制約\n\n';
  md+=p.bugs.length ? p.bugs.map(b=>'### '+b.id+' '+b.title+'\n\n- 状態: '+b.status+'\n- 環境: '+b.environment+'\n- 再現: '+b.steps+'\n- 実際: '+b.actual+'\n- 期待: '+b.expected+'\n- 証拠: '+b.evidence+'\n').join('\n') : '調査中。未確認項目に不具合がないと判定した意味ではない。\n';
  await writeFile(new URL('STATUS.md', root), md);
}
if (process.argv[1] && new URL('file://'+process.argv[1]).href === import.meta.url) await updateProgress(()=>{});
