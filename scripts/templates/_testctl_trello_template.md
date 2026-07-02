# (WIP) $test_id [$role]: $reason

## Summary

Automated $layer test `$test_id` (role $role) failed against the Bubble
application on $target. Related use cases: $use_cases.

## Steps to reproduce

1. Start the QA API server: `npm run qa:server`
2. Re-run the failing test: `$run_cmd`
3. Observe the failing step below.

## Expected

The test passes: $reason

## Actual (failing step)

```
$failing_step
```

## Evidence / artifacts

- artifacts directory: `$artifacts_dir`
- log files:
$log_files

## Environment

- test runner: $runner_version
- run parameters: `$parameters`
- run started: $run_id
- git sha: $git_sha

## Severity / labels

- severity: (fill in)
- labels: automated-test, $layer
