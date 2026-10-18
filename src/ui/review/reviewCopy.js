export function reviewError(error, ja) {
  const code = typeof error === 'string' ? error : error?.message;
  const messages = {
    tags: ['タグは8個まで、各24文字以内で入力してください。', 'Use up to eight tags, each at most 24 characters.'],
    note: ['メモは2,000文字以内で入力してください。', 'Notes can contain up to 2,000 characters.'],
    limit: ['保存は200件までです。不要な復習を解除してから保存してください。', 'The 200-hand limit is reached. Remove an unneeded review before saving.'],
    missing: ['ハンドの記録を取得できません。履歴から保存してください。', 'The hand record is unavailable. Save it from history.'],
    unreadable: ['保存データを読み込めません。既存データは変更していません。', 'Saved reviews could not be read. Existing data has not been changed.'],
    storage: ['端末に保存できませんでした。空き容量やブラウザの保存設定を確認してください。', 'Could not save on this device. Check available space and browser storage settings.'],
  };
  return (messages[code] ?? messages.storage)[ja ? 0 : 1];
}
