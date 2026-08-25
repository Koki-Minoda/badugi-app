"""Minimal ONNX-backed opponent for Badugi six-max self-play training."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import torch


class OnnxQNetworkProxy:
    """Expose an ONNX DQN as the q_network interface used by SixMaxBadugiEnv."""

    def __init__(self, onnx_path: Path | str):
        import onnxruntime as ort

        self.onnx_path = Path(onnx_path)
        self.session = ort.InferenceSession(
            str(self.onnx_path),
            providers=["CPUExecutionProvider"],
        )
        input_meta = self.session.get_inputs()[0]
        self.input_name = input_meta.name
        self.input_shape = tuple(input_meta.shape)
        self.output_name = self.session.get_outputs()[0].name

    def __call__(self, tensor: torch.Tensor) -> torch.Tensor:
        array = tensor.detach().cpu().numpy().astype(np.float32, copy=False)
        if array.ndim == 1:
            array = array.reshape(1, -1)
        if array.ndim != 2 or array.shape[1] != 96:
            raise ValueError(f"expected input shape [96] or [N, 96], got {array.shape}")

        outputs = []
        for row in array:
            onnx_input = row if len(self.input_shape) == 1 else row.reshape(1, 96)
            output = self.session.run(
                [self.output_name],
                {self.input_name: onnx_input.astype(np.float32, copy=False)},
            )[0]
            output_array = np.asarray(output, dtype=np.float32)
            outputs.append(output_array.reshape(-1, 6)[0])

        return torch.as_tensor(np.stack(outputs, axis=0), dtype=torch.float32)

    def load_state_dict(self, *_args, **_kwargs):
        return None

    def state_dict(self) -> dict:
        return {}

    def eval(self):
        return self


class OnnxOpponentAgent:
    """Small agent shim with q_network/target_network fields for ONNX opponents."""

    def __init__(self, onnx_path: Path | str, device=None):
        self.onnx_path = Path(onnx_path)
        self.device = device
        self.q_network = OnnxQNetworkProxy(self.onnx_path)
        self.target_network = self.q_network
