# 10-Game F04 Windows readiness — 2026-10-28

The 10-Game training environment is **not ready for a long run**. This audit is based on repository files and the last read-only Windows snapshot from 2026-10-27; no Windows training, checkpoint restore, or new host measurement was performed here.

The existing `windows-badugi-rl.ps1` launcher is specific to six-max Badugi. It checks only 8 GiB of free artifact-drive space for Train/Resume and falls back to a repository path on the system drive when no D: drive is available. That fallback does not meet the documented dedicated non-system artifact destination rule. The latest paired host snapshot exposed only C: (81,822,978,048 bytes free) and 1,094,924 KiB available physical memory out of 8,265,096 KiB total. Those facts alone block a safe one-job probe under the provisional 20 GiB free / 4 GiB available-memory defaults below.

The current training scripts also have different restore capabilities:

| 10-Game variants | Trainer | Current checkpoint continuation |
| --- | --- | --- |
| B01/B02/B05/B06 | `train_board_dqn.py` | `--resume-checkpoint` loads model weights but calls `DQNAgent.load` without `restore_training_state=True`; optimizer, train-step and RNG state are not restored, and episode/epsilon restart at 1. |
| ST1/ST2/ST3 | `train_stud_dqn.py` | Same weight-only restart behavior. |
| D01/S01 | `train_draw_dqn.py` | Saves checkpoints but has no resume argument. |
| D03 | `train_sixmax_selfplay_badugi_dqn.py` | Has a separate continuation path and tests, but no save/restore probe has been run on the present Windows host. |

The new read-only `windows-10game-f04-preflight.ps1` requires an existing artifact folder and `.mgx-rl-artifacts` marker on a non-system drive, the RL Python environment and dependencies, sufficient free disk and available RAM, and no concurrent RL trainer. It calls a small Python gate and prints JSON. It requires an explicit 10-Game variant ID. Only D03 can currently pass the **bounded checkpoint probe** gate because it has a continuation path with local tests; B01/B02/B05/B06, ST1/ST2/ST3, D01, and S01 remain blocked even on an otherwise healthy host. A D03 pass is only permission to consider a small save/restore test, not evidence of Windows restore or gameplay strength; `longRunReady` remains false. The PowerShell wrapper has not been executed on Windows yet. Its pure gate was tested locally with the observed blocked host values, a healthy dedicated-drive fixture, a missing marker, a concurrent-job fixture, and all nine blocked trainer variants.

Run the read-only preflight only after provisioning a dedicated non-system artifact directory and setting `MGX_RL_ARTIFACT_ROOT` to it:

```powershell
.\scripts\windows-10game-f04-preflight.ps1 -VariantId D03
```

Before any long run, run **one D03** bounded training probe that writes to that directory, record checkpoint SHA-256 and peak process memory, restore the exact checkpoint into a separate output directory, and verify optimizer/counter continuity and a single-job stop budget. Board/Stud/Draw restore code must first be corrected and tested before their variant gates can open. F03 live observation parity and independent model evaluation remain separate requirements; neither this preflight nor a checkpoint file establishes gameplay strength or model use.
