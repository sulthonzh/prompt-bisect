#!/usr/bin/env node
// prompt-bisect: CLI

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SnapshotStore } from './store';
import { BisectRunner } from './runner';
import { BisectConfig, DEFAULT_CONFIG, OutputFormat, PromptSnapshot, RunResult, BisectResult } from './types';

// --- Minimal arg parser ---
function parseArgs(argv: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  let i = 2; // skip node + script
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        i += 2;
      } else {
        result[key] = true;
        i++;
      }
    } else {
      i++;
    }
  }
  return result;
}

function getConfig(args: Record<string, string | boolean>): BisectConfig {
  return {
    ...DEFAULT_CONFIG,
    threshold: args.threshold ? parseFloat(args.threshold as string) : DEFAULT_CONFIG.threshold,
    method: (args.method as BisectConfig['method']) || DEFAULT_CONFIG.method,
    snapshotsDir: (args.dir as string) || DEFAULT_CONFIG.snapshotsDir,
  };
}

function getFormat(args: Record<string, string | boolean>): OutputFormat {
  if (args.json) return 'json';
  if (args.markdown) return 'markdown';
  return 'text';
}

function generateId(): string {
  return `prompt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// --- Formatters ---

function formatRunText(result: RunResult): string {
  const lines: string[] = [];
  lines.push(`\n  prompt-bisect results`);
  lines.push(`  ${'─'.repeat(40)}`);
  lines.push(`  Total: ${result.total}  Passed: ${result.passed}  Failed: ${result.failed}  Errors: ${result.errors}`);
  lines.push(`  Duration: ${result.durationMs}ms`);
  lines.push('');

  for (const diff of result.diffs) {
    const icon = diff.status === 'match' ? '✓' : diff.status === 'drift' ? '✗' : '!';
    const color = diff.status === 'match' ? '' : diff.status === 'drift' ? '' : '';
    lines.push(`  ${icon} ${diff.promptId} — ${(diff.similarity * 100).toFixed(1)}% [${diff.status}]`);
    if (diff.details) {
      for (const line of diff.details.split('\n')) {
        lines.push(`    ${line}`);
      }
    }
  }

  lines.push('');
  if (result.failed > 0 || result.errors > 0) {
    lines.push(`  ⚠ ${result.failed + result.errors} prompt(s) need attention`);
  } else {
    lines.push(`  All prompts within threshold ✓`);
  }

  return lines.join('\n');
}

function formatRunMarkdown(result: RunResult): string {
  const lines: string[] = [];
  lines.push(`# Prompt Bisect Results`);
  lines.push('');
  lines.push(`- **Total:** ${result.total}`);
  lines.push(`- **Passed:** ${result.passed}`);
  lines.push(`- **Failed:** ${result.failed}`);
  lines.push(`- **Errors:** ${result.errors}`);
  lines.push(`- **Duration:** ${result.durationMs}ms`);
  lines.push('');
  lines.push('| Prompt | Similarity | Status | Details |');
  lines.push('|--------|-----------|--------|---------|');

  for (const diff of result.diffs) {
    const statusIcon = diff.status === 'match' ? '✅' : diff.status === 'drift' ? '❌' : '⚠️';
    lines.push(`| ${diff.promptId} | ${(diff.similarity * 100).toFixed(1)}% | ${statusIcon} ${diff.status} | ${diff.details?.split('\n')[0] || '-'} |`);
  }

  return lines.join('\n');
}

function formatBisectText(result: BisectResult): string {
  const lines: string[] = [];
  lines.push(`\n  Bisect: ${result.promptId}`);
  lines.push(`  ${'─'.repeat(40)}`);
  lines.push('');

  for (const point of result.points) {
    const icon = point.changed ? '✗' : '✓';
    lines.push(`  ${icon} ${point.timestamp} — ${(point.similarity * 100).toFixed(1)}%`);
  }

  if (result.regressionAt) {
    lines.push('');
    lines.push(`  ⚠ First drift detected at: ${result.regressionAt}`);
  } else {
    lines.push('');
    lines.push(`  No drift detected across ${result.points.length} history points ✓`);
  }

  return lines.join('\n');
}

function formatBisectMarkdown(result: BisectResult): string {
  const lines: string[] = [];
  lines.push(`# Bisect: ${result.promptId}`);
  lines.push('');
  lines.push('| Timestamp | Similarity | Changed |');
  lines.push('|-----------|-----------|---------|');

  for (const point of result.points) {
    lines.push(`| ${point.timestamp} | ${(point.similarity * 100).toFixed(1)}% | ${point.changed ? '❌ Yes' : '✅ No'} |`);
  }

  if (result.regressionAt) {
    lines.push('');
    lines.push(`> ⚠ First drift detected at **${result.regressionAt}**`);
  }

  return lines.join('\n');
}

// --- Commands ---

function cmdInit(store: SnapshotStore, format: OutputFormat): void {
  store.init();
  if (format === 'json') {
    console.log(JSON.stringify({ status: 'initialized', dir: store['config'].snapshotsDir }));
  } else {
    console.log(`Initialized prompt-bisect in ${store['config'].snapshotsDir}/`);
  }
}

function cmdAdd(store: SnapshotStore, args: Record<string, string | boolean>, format: OutputFormat): void {
  const prompt = args.prompt as string;
  const output = args.output as string;
  const model = (args.model as string) || 'unknown';
  const id = (args.id as string) || generateId();
  const tags = args.tags ? (args.tags as string).split(',') : [];

  if (!prompt || !output) {
    console.error('Usage: prompt-bisect add --prompt "..." --output "..." [--model ...] [--id ...] [--tags a,b]');
    process.exit(1);
  }

  // If output is a file path, read it
  let outputText = output;
  if (fs.existsSync(output)) {
    outputText = fs.readFileSync(output, 'utf-8');
  }

  // Same for prompt
  let promptText = prompt;
  if (fs.existsSync(prompt)) {
    promptText = fs.readFileSync(prompt, 'utf-8');
  }

  const snapshot: PromptSnapshot = {
    id,
    prompt: promptText,
    model,
    output: outputText,
    timestamp: new Date().toISOString(),
    tags,
  };

  store.add(snapshot);

  if (format === 'json') {
    console.log(JSON.stringify({ status: 'added', id: snapshot.id }));
  } else {
    console.log(`Added snapshot: ${id}`);
  }
}

function cmdList(store: SnapshotStore, args: Record<string, string | boolean>, format: OutputFormat): void {
  const snapshots = store.list({
    tag: args.tag as string,
    model: args.model as string,
  });

  if (format === 'json') {
    console.log(JSON.stringify(snapshots, null, 2));
    return;
  }

  if (format === 'markdown') {
    console.log('# Prompt Snapshots\n');
    console.log('| ID | Model | Tags | Created |');
    console.log('|----|-------|------|---------|');
    for (const s of snapshots) {
      console.log(`| ${s.id} | ${s.model} | ${s.tags?.join(', ') || '-'} | ${s.timestamp} |`);
    }
    return;
  }

  if (snapshots.length === 0) {
    console.log('No snapshots found.');
    return;
  }

  console.log(`\n  ${snapshots.length} snapshot(s):\n`);
  for (const s of snapshots) {
    console.log(`  ${s.id}`);
    console.log(`    model: ${s.model}`);
    console.log(`    prompt: ${s.prompt.slice(0, 60)}${s.prompt.length > 60 ? '...' : ''}`);
    console.log(`    tags: ${s.tags?.join(', ') || 'none'}`);
    console.log(`    created: ${s.timestamp}`);
    console.log('');
  }
}

function cmdRemove(store: SnapshotStore, args: Record<string, string | boolean>, format: OutputFormat): void {
  const id = args.id as string;
  if (!id) {
    console.error('Usage: prompt-bisect remove --id <snapshot-id>');
    process.exit(1);
  }

  const removed = store.remove(id);
  if (format === 'json') {
    console.log(JSON.stringify({ status: removed ? 'removed' : 'not_found', id }));
  } else {
    console.log(removed ? `Removed ${id}` : `Not found: ${id}`);
  }
}

function cmdCompare(store: SnapshotStore, config: BisectConfig, args: Record<string, string | boolean>, format: OutputFormat): void {
  const file = args.file as string;
  if (!file) {
    console.error('Usage: prompt-bisect compare --file <outputs.json>');
    process.exit(1);
  }

  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const outputs: { id: string; output: string }[] = Array.isArray(data) ? data : data.outputs;

  if (!outputs || !Array.isArray(outputs)) {
    console.error('Expected JSON array of { id, output }');
    process.exit(1);
  }

  const runner = new BisectRunner(config);
  const result = runner.compare(outputs);

  outputResult(result, format, 'run');
}

function cmdBisect(store: SnapshotStore, config: BisectConfig, args: Record<string, string | boolean>, format: OutputFormat): void {
  const promptId = args.id as string;
  if (!promptId) {
    console.error('Usage: prompt-bisect bisect --id <prompt-id>');
    process.exit(1);
  }

  const runner = new BisectRunner(config);
  const result = runner.bisect(promptId);

  if (!result) {
    console.error('No history found for this prompt.');
    process.exit(1);
  }

  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else if (format === 'markdown') {
    console.log(formatBisectMarkdown(result));
  } else {
    console.log(formatBisectText(result));
  }
}

function cmdImport(store: SnapshotStore, args: Record<string, string | boolean>, format: OutputFormat): void {
  const file = args.file as string;
  if (!file) {
    console.error('Usage: prompt-bisect import --file <snapshots.json>');
    process.exit(1);
  }

  const added = store.import(file);
  if (format === 'json') {
    console.log(JSON.stringify({ status: 'imported', added }));
  } else {
    console.log(`Imported ${added} new snapshot(s)`);
  }
}

function cmdExport(store: SnapshotStore, args: Record<string, string | boolean>, format: OutputFormat): void {
  const file = (args.file as string) || 'golden-export.json';
  store.export(file);
  if (format === 'json') {
    console.log(JSON.stringify({ status: 'exported', file }));
  } else {
    console.log(`Exported golden set to ${file}`);
  }
}

function outputResult(result: RunResult, format: OutputFormat, type: 'run' | 'bisect'): void {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else if (format === 'markdown') {
    console.log(formatRunMarkdown(result));
  } else {
    console.log(formatRunText(result));
  }
}

// --- Main ---

function main(): void {
  const args = parseArgs(process.argv);
  const command = process.argv[2];

  if (!command || command.startsWith('--')) {
    console.log(`
  prompt-bisect — CI regression testing for AI prompts

  Usage:
    prompt-bisect init [--dir .prompt-snapshots]
    prompt-bisect add --prompt "..." --output "..." [--model ...] [--id ...] [--tags a,b]
    prompt-bisect list [--tag ...] [--model ...] [--json | --markdown]
    prompt-bisect remove --id <id>
    prompt-bisect compare --file <outputs.json> [--threshold 0.8] [--method string|structured]
    prompt-bisect bisect --id <prompt-id> [--threshold 0.8]
    prompt-bisect import --file <snapshots.json>
    prompt-bisect export [--file output.json]

  Options:
    --threshold <float>   Similarity threshold (default: 0.8)
    --method <type>       Comparison method: string, structured (default: string)
    --dir <path>          Snapshots directory (default: .prompt-snapshots)
    --json                Output as JSON
    --markdown            Output as Markdown
`);
    process.exit(0);
  }

  const config = getConfig(args);
  const store = new SnapshotStore(config);
  const format = getFormat(args);

  switch (command) {
    case 'init':
      cmdInit(store, format);
      break;
    case 'add':
      cmdAdd(store, args, format);
      break;
    case 'list':
      cmdList(store, args, format);
      break;
    case 'remove':
      cmdRemove(store, args, format);
      break;
    case 'compare':
      cmdCompare(store, config, args, format);
      break;
    case 'bisect':
      cmdBisect(store, config, args, format);
      break;
    case 'import':
      cmdImport(store, args, format);
      break;
    case 'export':
      cmdExport(store, args, format);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main();
