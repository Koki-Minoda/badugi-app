from pathlib import Path

import pytest
import torch

from rl.agents.dqn_agent import DQNAgent, DQNHyperParams
from rl.training.onnx_opponent_agent import OnnxOpponentAgent, OnnxQNetworkProxy
from rl.training.train_sixmax_selfplay_badugi_dqn import (
    SixMaxSelfPlayConfig,
    _load_initial_opponent_agent,
)


ONNX_PATH = Path("public/models/badugi_pro_v1.onnx")


def _require_onnx_opponent():
    if not ONNX_PATH.exists():
        pytest.skip(f"{ONNX_PATH} is not available")
    pytest.importorskip("onnxruntime")


def test_proxy_call_returns_correct_shape():
    _require_onnx_opponent()
    proxy = OnnxQNetworkProxy(ONNX_PATH)

    single = proxy(torch.zeros((1, 96), dtype=torch.float32))
    batch = proxy(torch.zeros((3, 96), dtype=torch.float32))

    assert tuple(single.shape) == (1, 6)
    assert tuple(batch.shape) == (3, 6)
    assert single.dtype == torch.float32
    assert batch.dtype == torch.float32


def test_load_state_dict_is_noop():
    _require_onnx_opponent()
    proxy = OnnxQNetworkProxy(ONNX_PATH)

    proxy.load_state_dict({})

    assert isinstance(proxy.state_dict(), dict)


def test_load_initial_opponent_selects_onnx_for_onnx_path(
    capsys: pytest.CaptureFixture[str],
):
    _require_onnx_opponent()
    hero = DQNAgent(
        obs_dim=96,
        n_actions=6,
        hidden_dim=8,
        hyperparams=DQNHyperParams(batch_size=2),
    )
    cfg = SixMaxSelfPlayConfig(pretrained_opponent=str(ONNX_PATH), batch_size=2)

    opponent = _load_initial_opponent_agent(cfg, hero, device="cpu")
    captured = capsys.readouterr().out

    assert isinstance(opponent, OnnxOpponentAgent)
    assert "[6max-SelfPlay] ONNX opponent:" in captured
    assert "using hero copy" not in captured
