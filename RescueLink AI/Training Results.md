# Training Results

## Run Configuration
- Dataset: `data/emergency_dataset.csv`
- Backbone: `xlm-roberta-base`
- Train split: `0.8`
- Subsample fraction: `1.0` (full data)
- Eval max batches: `None` (full validation)
- Epoch target: `10`
- Early stopping patience: `3`
- Learning rate: `5e-5`
- Scheduler: `StepLR(step_size=2, gamma=0.5)`
- Threshold sweep range: `0.2` to `0.7` (step `0.05`)

## Seed 42
- Incident F1 (micro): `0.929490`
- Incident hamming loss: `0.047083`
- Severity accuracy: `0.916000`
- Selected threshold: `0.50`
- Best blended score: `0.922745`
- Last epoch F1@0.5: `0.928978`
- Last epoch severity accuracy: `0.915500`
- Epochs completed: `7`
- Total train time: `1700.59s`
- Average epoch time: `242.94s`
- Evaluation time: `7.95s`
- Notes: Auto-updated from notebook
## Seed 123
- Incident F1 (micro): `0.924319`
- Incident hamming loss: `0.041417`
- Severity accuracy: `0.902000`
- Selected threshold: `0.64`
- Best blended score: `0.912877`
- Last epoch F1@0.5: `0.925662`
- Last epoch severity accuracy: `0.899500`
- Epochs completed: `6`
- Total train time: `1960.50s`
- Average epoch time: `326.75s`
- Evaluation time: `16.75s`
- Notes: Auto-updated from notebook
## Seed 999
- Incident F1 (micro): `0.259163`
- Incident hamming loss: `0.411000`
- Severity accuracy: `0.256000`
- Selected threshold: `0.20`
- Best blended score: `0.128000`
- Last epoch F1@0.5: `0.000000`
- Last epoch severity accuracy: `0.254333`
- Epochs completed: `5`
- Total train time: `1479.05s`
- Average epoch time: `295.81s`
- Evaluation time: `8.09s`
- Notes: Auto-updated from notebook

## Seed 128
- Incident F1 (micro): `0.509872`
- Incident hamming loss: `0.657833`
- Severity accuracy: `0.317000`
- Selected threshold: `0.20`
- Best blended score: `0.158500`
- Last epoch F1@0.5: `0.000000`
- Last epoch severity accuracy: `0.317000`
- Epochs completed: `5`
- Total train time: `550.72s`
- Average epoch time: `110.14s`
- Evaluation time: `3.24s`
- Notes: Auto-updated from notebook

## Aggregation (Current Filled Seeds)
- Incident F1 mean: `0.655711`
- Incident F1 std: `0.285318`
- Severity accuracy mean: `0.597750`
- Severity accuracy std: `0.312036`
- Pass/Fail (>= 0.99 on both metrics): `FAIL`

## Interpretation Notes
- `Incident F1 (micro)` and `Severity Accuracy` are the primary acceptance metrics.
- `Selected threshold` is from validation calibration and should be saved with metadata.
- `Last epoch F1@0.5` is the fixed-threshold view from the training loop; it may differ from calibrated-threshold F1.
