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
- Incident F1 (micro): `0.999614`
- Incident hamming loss: `0.000167`
- Severity accuracy: `1.000000`
- Selected threshold: `0.30`
- Best blended score: `0.999807`
- Last epoch F1@0.5: `0.999486`
- Last epoch severity accuracy: `1.000000`
- Epochs completed: `8`
- Total train time: `2356.60s`
- Average epoch time: `294.57s`
- Evaluation time: `8.40s`
- Notes: Auto-updated from notebook

## Seed 123
- Incident F1 (micro): `0.999743`
- Incident hamming loss: `0.000111`
- Severity accuracy: `1.000000`
- Selected threshold: `0.55`
- Best blended score: `0.999807`
- Last epoch F1@0.5: `0.999485`
- Last epoch severity accuracy: `1.000000`
- Epochs completed: `10`
- Total train time: `2863.84s`
- Average epoch time: `286.38s`
- Evaluation time: `8.76s`
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
## Aggregation (Current Filled Seeds)
- Incident F1 mean: `0.752840`
- Incident F1 std: `0.349082`
- Severity accuracy mean: `0.752000`
- Severity accuracy std: `0.350725`
- Pass/Fail (>= 0.99 on both metrics): `FAIL`

## Interpretation Notes
- `Incident F1 (micro)` and `Severity Accuracy` are the primary acceptance metrics.
- `Selected threshold` is from validation calibration and should be saved with metadata.
- `Last epoch F1@0.5` is the fixed-threshold view from the training loop; it may differ from calibrated-threshold F1.
