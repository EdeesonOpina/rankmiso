# Rust rule-engine performance baseline

Run `cargo bench -p seo-rules --bench analyze` to measure the local Rust rules engine. The benchmark covers synthetic snapshots at three sizes and excludes browser extraction, WASM startup, and network requests.

Baseline recorded 2026-10-24 in the development environment:

| Snapshot | Links | Images | Headings | Text characters | Mean audit time |
| --- | ---: | ---: | ---: | ---: | ---: |
| Small | 20 | 10 | 12 | 5,000 | 0.22 ms |
| Medium | 500 | 100 | 100 | 50,000 | 2.09 ms |
| Large | 2,000 | 500 | 500 | 100,000 | 5.58 ms |

These are local baseline measurements, not performance guarantees. Compare runs on the same machine and toolchain; do not use them to compare browsers or hardware.
