# MGX Iron D01 Exclusion Decision

## Decision

Step9 時点でも `D01` は action-value teacher dataset から除外を継続する。

## Reason

- `STABLE_STANDARD_BETTER` bucket が未成立
- isolated sub-bucket では `STABLE_PRO_BETTER` が先に出ている
- `premium27TD late pressure` は `NEEDS_MORE_SAMPLES`
- `strong27TD late pressure` と `medium27TD pressure` は large sample でも `NOISY`

## Interpretation

`D01` は Standard を teacher にする supervised bootstrap には現時点で向かない。  
扱うなら、将来の self-play / policy improvement / Pro-better labeling 側で別設計にする必要がある。

## Step9 Handling

- dry-run variants から `D01` を除外
- exclusion reason を dry-run gate と offline arena metadata に明記
- routing / promotion / modelRegistry mutation は行わない

## Revisit Conditions

- D01 で `STABLE_STANDARD_BETTER` sub-bucket が 1 つ以上成立
- deterministic replay を維持
- invalid replay が増えない
- Standard teacher として sign stability が確認できる
