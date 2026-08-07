# Context

We are investigating an automated failure in a $layer test ($test_id, role
$role) against the Bubble application running on $target.

Test purpose: $reason
Related use cases: $use_cases

# Task

Help me diagnose this failure.

# Failing step in the test script

```
$failing_step
```

# Test script

```
$test_script
```

# Test runner and arguments

- single-run test command: `$run_cmd`
- test runner: $runner_version
- test parameters: `$parameters`
- artifacts directory: `$artifacts_dir`
- log files and artifacts:
$log_files

# Environment

- run started: $run_id
- git sha: $git_sha
