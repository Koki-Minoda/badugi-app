"""Source/manifest/checkpoint provenance checks without optimization or training."""
import json
from pathlib import Path
import subprocess

import pytest
import torch

from rl.training.source_provenance import (
    capture_training_source, assert_training_source_unchanged,
    write_training_manifest, manifest_checkpoint_reference,
)


def sources(tmp_path):
    path = tmp_path / 'src/rl/env/game.py'
    path.parent.mkdir(parents=True)
    path.write_bytes(b'RULE_VERSION = 1\n')
    return path


def test_unknown_git_is_not_reported_as_clean_and_hash_is_repeatable(tmp_path):
    sources(tmp_path)
    first = capture_training_source(tmp_path)
    assert first == capture_training_source(tmp_path)
    assert first['gitCommit'] is None and first['gitDirty'] is None
    assert list(first['files']) == ['src/rl/env/game.py']


def test_source_edits_fail_checkpoint_guard_and_tests_do_not_change_source_hash(tmp_path):
    path = sources(tmp_path)
    before = capture_training_source(tmp_path)
    test = tmp_path / 'src/rl/__tests__/case.py'
    test.parent.mkdir();test.write_text('pass\n')
    assert_training_source_unchanged(tmp_path, before)
    path.write_bytes(b'RULE_VERSION = 2\n')
    with pytest.raises(RuntimeError, match='sources changed'):
        assert_training_source_unchanged(tmp_path, before)


def test_cross_platform_normalization_keeps_raw_bytes_auditable(tmp_path):
    path = sources(tmp_path)
    unix = capture_training_source(tmp_path)
    path.write_bytes(b'RULE_VERSION = 1\r\n')
    windows = capture_training_source(tmp_path)
    assert unix['sourceTreeSha256'] != windows['sourceTreeSha256']
    assert unix['normalizedSourceTreeSha256'] == windows['normalizedSourceTreeSha256']


def test_git_records_clean_and_dirty_actual_checkout(tmp_path):
    path = sources(tmp_path)
    def git(*args):
        return subprocess.check_output(['git', '-C', str(tmp_path), *args], stderr=subprocess.DEVNULL).decode()
    git('init');git('add', 'src')
    git('-c', 'user.name=Provenance Test', '-c', 'user.email=provenance@example.invalid', 'commit', '-m', 'fixture')
    clean = capture_training_source(tmp_path)
    assert clean['gitDirty'] is False and clean['gitCommit'] == git('rev-parse', 'HEAD').strip()
    path.write_text('RULE_VERSION = 2\n')
    dirty = capture_training_source(tmp_path)
    assert dirty['gitDirty'] is True and dirty['gitCommit'] == clean['gitCommit']
    assert dirty['sourceTreeSha256'] != clean['sourceTreeSha256']
    assert any('src/rl/env/game.py' in item for item in dirty['gitChanges'])


def test_empty_or_external_source_fails_closed(tmp_path):
    with pytest.raises(ValueError, match='No Python'):
        capture_training_source(tmp_path)
    outside = tmp_path.parent / f'{tmp_path.name}-external.py'
    outside.write_text('PRIVATE = True\n')
    path = sources(tmp_path)
    path.unlink();path.symlink_to(outside)
    with pytest.raises(ValueError, match='outside'):
        capture_training_source(tmp_path)


def test_manifests_preserve_prior_runs_and_have_checkpoint_reference(tmp_path):
    sources(tmp_path)
    payload = {'sourceProvenance': capture_training_source(tmp_path)}
    first = write_training_manifest(tmp_path, 'run', payload)
    original = first.read_bytes()
    second = write_training_manifest(tmp_path, 'run', payload)
    assert first != second and first.read_bytes() == original
    assert json.loads((tmp_path / 'run.json').read_text()) == json.loads(second.read_text())
    ref = manifest_checkpoint_reference(first)
    assert ref['manifestId'] == json.loads(original)['runId']
    assert ref['sourceTreeSha256'] == payload['sourceProvenance']['sourceTreeSha256']


@pytest.mark.parametrize('kind', ['badugi', 'draw'])
def test_entrypoint_manifest_and_checkpoint_reference_without_training(tmp_path, monkeypatch, kind):
    sources(tmp_path)
    if kind == 'badugi':
        from rl.training import train_sixmax_selfplay_badugi_dqn as trainer
        from rl.agents.dqn_agent import DQNAgent
        cfg = trainer.SixMaxSelfPlayConfig()
        agent = DQNAgent(obs_dim=96, n_actions=6, hidden_dim=8)
    else:
        from rl.training import train_draw_lowball_sixmax_dqn as trainer
        cfg = trainer.DrawLowballSixMaxConfig()
        agent = trainer._build_agent(device='cpu', hidden_dim=8, learning_rate=1e-4, batch_size=2)
    monkeypatch.setattr(trainer, 'PROJECT_ROOT', tmp_path)
    path = trainer._write_run_manifest(cfg, tmp_path / 'artifacts')
    payload = json.loads(path.read_text())
    assert payload['config']['seed'] == cfg.seed
    assert payload['sourceProvenance']['files']['src/rl/env/game.py']['sha256']
    reference = manifest_checkpoint_reference(path)
    checkpoint = tmp_path / 'fixture.pt'
    if kind == 'badugi':
        agent.save(str(checkpoint), training_state={'run_provenance': reference})
    else:
        agent.run_provenance = reference
        trainer._atomic_save_agent(agent, checkpoint)
    stored = torch.load(checkpoint, map_location='cpu', weights_only=False)
    assert stored['training_state']['run_provenance'] == reference
