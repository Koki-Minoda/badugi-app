# MGX Pro Heuristic Limit Decision

## Continue Pro heuristic only if

- fresh corpusで stable bucket が複数出る
- aggregate EV が改善する
- cross-variant risk が低い
- rule が単純

## Stop Pro heuristic if

- stable bucket が少ない
- aggregate が動かない
- noisy bucket が支配的
- S01/S02 が dataset 向き
- 手作業 heuristic では overfit リスクが高い

## Step4-Z Decision

`STOP`

理由:

- Step4-Y fresh corpus では stable bucket が実質 `D02 strongA5 second-pressure` だけ
- Step4-Z でその bucket を最終反映しても aggregate EV は改善しなかった
- `S01` / `S02` は fresh corpus でも stable bucket が出ていない
- weak/trash guard を戻す余地はなく、以後の手修正はリスクが gain を上回る

## Next Phase

`Iron bootstrap / action-value supervised warm start`
