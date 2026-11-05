"""Resumable, no-gradient scale runner for the real-controller opening audit."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import time
from pathlib import Path

from rl.training.audit_badugi_controller_v2_opening_outcomes import run


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main(plan_path: Path, check_only: bool = False) -> None:
    plan = json.loads(plan_path.read_text())
    if plan.get('status') != 'FROZEN_EXPLORATORY_DIAGNOSTIC' or plan.get('noGradient') is not True:
        raise ValueError('opening audit requires a frozen no-gradient plan')
    root = Path(__file__).resolve().parents[3]
    code_sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root,
                                       text=True).strip()
    if code_sha != plan['codeGitSha']:
        raise ValueError('audit code SHA differs from frozen plan')
    output = Path(plan['outputDirectory'])
    chunk_hands = plan['chunkHands']
    total_per_arm = plan['handsPerArm']
    if chunk_hands != 5000 or total_per_arm != 1_000_000:
        raise ValueError('this run is fixed at 5k chunks and 1M hands per arm')
    if not isinstance(plan['arms'], dict) or set(plan['arms']) != {'standard', 'pro'}:
        raise ValueError('plan must contain exactly Standard and Pro arms')
    for arm, config in plan['arms'].items():
        model = Path(config['modelPath'])
        if not model.is_file() or sha256(model) != config['modelSha256']:
            raise ValueError(f'{arm} model differs from frozen plan')
        if config['seedBase'] < 0 or config['seedBase'] + total_per_arm >= 2**32:
            raise ValueError(f'{arm} seeds exceed 32-bit controller RNG')
    if check_only:
        print(json.dumps({'status': 'READY_NO_GRADIENT', 'codeGitSha': code_sha,
                          'handsPerArm': total_per_arm, 'chunkHands': chunk_hands}))
        return
    output.mkdir(parents=True, exist_ok=True)
    progress_path = output / 'progress.json'
    chunks = total_per_arm // chunk_hands
    for index in range(chunks):
        for arm in ('standard', 'pro'):
            config = plan['arms'][arm]
            directory = output / arm / f'chunk-{index:04d}'
            summary_path = directory / 'summary.json'
            if summary_path.exists():
                summary = json.loads(summary_path.read_text())
                if (summary.get('hands') != chunk_hands or
                        summary.get('zeroSumHands') != chunk_hands or
                        summary.get('modelSha256') != config['modelSha256'] or
                        summary.get('seedBase') != config['seedBase'] + index * chunk_hands or
                        not (directory / 'hands.jsonl').exists()):
                    raise ValueError(f'{arm} chunk {index} is incomplete or inconsistent')
            else:
                if directory.exists():
                    raise ValueError(f'{arm} chunk {index} exists without verified summary')
                if shutil.disk_usage(output).free < 20 * 1024**3:
                    raise RuntimeError('less than 20 GiB free: stop before next diagnostic chunk')
                start = time.monotonic()
                summary = run(chunk_hands, config['seedBase'] + index * chunk_hands,
                              Path(config['modelPath']), directory)
                print(json.dumps({'arm': arm, 'chunk': index, 'hands': summary['hands'],
                                  'elapsedSeconds': round(time.monotonic() - start, 2)}), flush=True)
            completed = {name: sum((output / name / f'chunk-{i:04d}' / 'summary.json').exists()
                                   for i in range(chunks)) for name in ('standard', 'pro')}
            payload = {'status': 'COMPLETE' if all(v == chunks for v in completed.values()) else 'RUNNING',
                       'codeGitSha': code_sha, 'chunkHands': chunk_hands,
                       'completedChunks': completed,
                       'completedHands': {name: value * chunk_hands for name, value in completed.items()},
                       'updatedAtUnix': time.time()}
            temporary = progress_path.with_suffix('.tmp')
            temporary.write_text(json.dumps(payload, indent=2) + '\n')
            temporary.replace(progress_path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    main(args.plan, args.check_only)
