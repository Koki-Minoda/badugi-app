"""Record exact training sources even when the checkout has uncommitted edits."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
from uuid import uuid4


def _digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def capture_training_source(root: Path) -> dict:
    root = Path(root).resolve()
    files = {}
    for path in sorted((root / 'src' / 'rl').rglob('*.py')):
        if '__tests__' in path.parts or '__pycache__' in path.parts:
            continue
        if not path.resolve().is_relative_to(root):
            raise ValueError('Training source resolves outside the project')
        data = path.read_bytes()
        files[path.relative_to(root).as_posix()] = {
            'sha256': _digest(data),
            'normalizedSha256': _digest(data.replace(b'\r\n', b'\n')),
            'bytes': len(data),
        }
    if not files:
        raise ValueError('No Python training sources found')
    def tree_hash(key):
        return _digest(json.dumps({p: v[key] for p, v in files.items()}, sort_keys=True, separators=(',', ':')).encode())
    try:
        git = lambda args: subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.DEVNULL).decode('utf8')
        head = git(['rev-parse', 'HEAD']).strip()
        changes = [entry for entry in git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', 'src/rl']).split('\0') if entry]
        dirty = bool(changes)
    except (OSError, subprocess.CalledProcessError, UnicodeDecodeError):
        head, changes, dirty = None, None, None
    return {'schemaVersion': 'mgx-training-source-v1', 'gitCommit': head,
            'gitDirty': dirty, 'gitChanges': changes, 'files': files,
            'sourceTreeSha256': tree_hash('sha256'),
            'normalizedSourceTreeSha256': tree_hash('normalizedSha256')}


def assert_training_source_unchanged(root: Path, provenance: dict) -> None:
    if capture_training_source(root)['sourceTreeSha256'] != provenance['sourceTreeSha256']:
        raise RuntimeError('Training sources changed during the run; refusing mislabeled checkpoint')


def write_training_manifest(output_dir: Path, stem: str, payload: dict) -> Path:
    """Keep every run, and update the backwards-compatible latest manifest."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    run_id = uuid4().hex
    document = {**payload, 'runId': run_id}
    content = json.dumps(document, indent=2) + '\n'
    path = output_dir / f'{stem}.{run_id}.json'
    with path.open('x', encoding='utf8') as stream:
        stream.write(content)
    latest = output_dir / f'{stem}.json'
    temporary = output_dir / f'.{stem}.{run_id}.tmp'
    try:
        temporary.write_text(content, encoding='utf8')
        os.replace(temporary, latest)
    finally:
        temporary.unlink(missing_ok=True)
    return path


def manifest_checkpoint_reference(path: Path) -> dict:
    payload = json.loads(Path(path).read_text(encoding='utf8'))
    return {'manifestId': payload['runId'], 'manifestPath': str(path),
            'sourceTreeSha256': payload['sourceProvenance']['sourceTreeSha256']}
