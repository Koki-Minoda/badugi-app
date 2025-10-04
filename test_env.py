import numpy as np
import torch
import gymnasium as gym

print("✅ ライブラリ確認 (gymnasium 版)")
print("numpy:", np.__version__)
print("torch:", torch.__version__)

env = gym.make("CartPole-v1", render_mode=None)  # 簡単な環境
obs, info = env.reset()
print("初期観測:", obs)
env.close()
