# Scoring

A scored check has status PASS, WARNING, or ERROR.

- PASS contributes 2 points times its weight
- WARNING contributes 1
- ERROR contributes 0

The category percentage is `earned * 100 / possible`, truncated toward zero. The overall percentage is the weighted average of categories that have at least one scored check and a non-zero category weight. Truncation is toward zero.

INFO, NOT_APPLICABLE, and UNAVAILABLE do not enter the denominator.

Default category weights: metadata 25, headings 15, technical 15, content 10, images 10, links 10, international 5, accessibility 5, social 5. Structured data and performance are 0 in this version because their results are notes or unavailable measurements.

Title length and description length use editorial ranges, and the check text says so. They are not documented as Google ranking thresholds.

The audit includes a disclaimer that the score is not a Google ranking, index status, or traffic estimate.
