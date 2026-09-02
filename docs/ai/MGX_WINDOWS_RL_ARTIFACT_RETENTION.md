# Windows RL artifact retention

Training remains stopped while the product roadmap is being completed.

Before E12 starts, set `MGX_RL_ARTIFACT_ROOT` to a dedicated directory on a
non-system drive, for example `D:\MGX-RL`. The launcher prefers that setting,
then `D:\MGX-RL` when a D drive exists. It refuses Train/Resume when the target
drive has less than 8 GB free.

Every artifact root contains `.mgx-rl-artifacts`. The retention tool refuses to
operate without this marker and refuses drive roots. Its default is a dry run:

```powershell
.\scripts\windows-badugi-rl-retention.ps1 -ArtifactRoot D:\MGX-RL
```

After reviewing the JSON candidate list, apply it explicitly:

```powershell
.\scripts\windows-badugi-rl-retention.ps1 -ArtifactRoot D:\MGX-RL -Apply
```

Retention keeps checkpoints referenced by JSON evidence, files named winner,
best or promoted, and the two newest checkpoints in every run. It only removes
older unreferenced `.pt` files. Manifests, evaluations, logs, JSON reports and
SHA-256 evidence are never deleted. Copy the promoted winner and evidence to
the repository/archive before deleting a Windows run directory.
