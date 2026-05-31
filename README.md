# prompt-bisect

CI regression testing for AI prompts. Snapshot your golden outputs, compare against new runs, bisect to find when drift started.

## The Problem

Model providers update their models constantly. Your carefully crafted prompts that worked yesterday might produce different outputs today. But nobody tests prompts like they test code — you find out days later when users complain.

**prompt-bisect** is the `git bisect` for prompt drift.

## How It Works

1. **Snapshot** your prompts with their expected outputs (the "golden set")
2. **Compare** new outputs against the golden set after model updates
3. **Bisect** through history to pinpoint when output behavior changed
4. **Alert** when similarity drops below your threshold

## Install

```bash
npm install -g prompt-bisect
```

## Quick Start

```bash
# Initialize (creates .prompt-snapshots/golden.json)
prompt-bisect init

# Add a golden snapshot
prompt-bisect add \
  --prompt "Summarize this article in 2 sentences" \
  --output "The article discusses..." \
  --model gpt-4 \
  --id summarize-v1 \
  --tags summarization,core

# After a model update, compare new outputs
prompt-bisect compare --file new-outputs.json

# Find when a prompt's output started drifting
prompt-bisect bisect --id summarize-v1
```

## CLI Commands

### `init`
Create the snapshots directory and golden set file.

```bash
prompt-bisect init [--dir .prompt-snapshots]
```

### `add`
Add a prompt snapshot to the golden set. Both `--prompt` and `--output` accept inline text or file paths.

```bash
prompt-bisect add \
  --prompt "Your prompt text" \
  --output "Expected output" \
  --model gpt-4 \
  --id my-prompt \
  --tags tag1,tag2
```

### `list`
List all snapshots. Filter by tag or model.

```bash
prompt-bisect list [--tag summarization] [--model gpt-4] [--json | --markdown]
```

### `remove`
Remove a snapshot from the golden set.

```bash
prompt-bisect remove --id my-prompt
```

### `compare`
Compare new outputs against the golden set. Input is a JSON file:

```json
[
  { "id": "summarize-v1", "output": "New output from model..." },
  { "id": "translate-v1", "output": "New translation..." }
]
```

```bash
prompt-bisect compare --file outputs.json [--threshold 0.8] [--method string]
```

### `bisect`
Walk through history to find when a prompt's output first drifted from the golden baseline.

```bash
prompt-bisect bisect --id summarize-v1 [--threshold 0.8]
```

### `import` / `export`
Import snapshots from a JSON file or export the golden set.

```bash
prompt-bisect import --file snapshots.json
prompt-bisect export --file backup.json
```

## Comparison Methods

| Method | Best For | How It Works |
|--------|----------|-------------|
| `string` (default) | Free-text outputs | Token overlap (Jaccard similarity) |
| `structured` | JSON/API outputs | Field-by-field comparison with partial credit |

The `string` method uses combined token overlap + Levenshtein distance. The `structured` method parses JSON, flattens all fields, and compares values — giving partial credit for similar (but not identical) field values.

## CI Integration

```yaml
# .github/workflows/prompt-regression.yml
name: Prompt Regression
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday 9am
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g prompt-bisect
      
      - name: Run prompts against latest model
        run: |
          # Your script to call the LLM and save outputs
          node scripts/run-prompts.js > outputs.json
      
      - name: Compare against golden set
        run: |
          prompt-bisect compare --file outputs.json --threshold 0.8 --json > result.json
          # Fail CI if any prompts drifted
          node -e "const r=JSON.parse(require('fs').readFileSync('result.json'));process.exit(r.failed>0?1:0)"
```

## Programmatic API

```typescript
import { SnapshotStore, BisectRunner } from 'prompt-bisect';

const store = new SnapshotStore({ snapshotsDir: '.prompt-snapshots' });
store.init();

// Add golden snapshot
store.add({
  id: 'my-prompt',
  prompt: 'Generate a haiku about code',
  model: 'gpt-4',
  output: 'Functions call and return\nStack frames push and pop with grace\nMemory freed at last',
  timestamp: new Date().toISOString(),
  tags: ['creative'],
});

// Compare new outputs
const runner = new BisectRunner({ threshold: 0.8 });
const result = runner.compare([
  { id: 'my-prompt', output: 'Functions call and return\nVariables scoped with care\nThe program runs smooth' }
]);

console.log(`Passed: ${result.passed}, Failed: ${result.failed}`);

// Bisect through history
const bisectResult = runner.bisect('my-prompt');
if (bisectResult?.regressionAt) {
  console.log(`Drift started at: ${bisectResult.regressionAt}`);
}
```

## Why Not Promptfoo / LangSmith?

- **Promptfoo** is great for evaluation and benchmarking, but it's not designed as a CI regression watchdog that tracks drift over time
- **LangSmith / Helicone** are commercial observability platforms — expensive, and not focused on regression testing
- **prompt-bisect** is zero-dependency, runs locally, stores snapshots in git-friendly JSON, and works in any CI pipeline

## Zero Dependencies

No external runtime dependencies. Just Node.js 18+. The similarity algorithms are built-in — no need for OpenAI embeddings or external APIs for basic drift detection.

## License

MIT
