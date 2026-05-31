"use strict";
// prompt-bisect: Tests
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const similarity_1 = require("./similarity");
const store_1 = require("./store");
const runner_1 = require("./runner");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
// --- Similarity tests ---
(0, node_test_1.describe)('stringSimilarity', () => {
    (0, node_test_1.it)('returns 1 for identical strings', () => {
        strict_1.default.equal((0, similarity_1.stringSimilarity)('hello world', 'hello world'), 1);
    });
    (0, node_test_1.it)('returns 0 for completely different strings', () => {
        const sim = (0, similarity_1.stringSimilarity)('aaa bbb', 'xxx yyy');
        strict_1.default.equal(sim, 0);
    });
    (0, node_test_1.it)('returns 1 for two empty strings', () => {
        strict_1.default.equal((0, similarity_1.stringSimilarity)('', ''), 1);
    });
    (0, node_test_1.it)('returns partial for similar strings', () => {
        const sim = (0, similarity_1.stringSimilarity)('the cat sat on the mat', 'the cat sat on a mat');
        strict_1.default.ok(sim > 0.7);
        strict_1.default.ok(sim < 1);
    });
    (0, node_test_1.it)('is case insensitive', () => {
        strict_1.default.equal((0, similarity_1.stringSimilarity)('Hello World', 'hello world'), 1);
    });
    (0, node_test_1.it)('handles one empty string', () => {
        strict_1.default.equal((0, similarity_1.stringSimilarity)('hello', ''), 0);
        strict_1.default.equal((0, similarity_1.stringSimilarity)('', 'hello'), 0);
    });
});
(0, node_test_1.describe)('levenshteinSimilarity', () => {
    (0, node_test_1.it)('returns 1 for identical strings', () => {
        strict_1.default.equal((0, similarity_1.levenshteinSimilarity)('abc', 'abc'), 1);
    });
    (0, node_test_1.it)('returns 0 for completely different single chars', () => {
        strict_1.default.equal((0, similarity_1.levenshteinSimilarity)('a', 'b'), 0);
    });
    (0, node_test_1.it)('returns high similarity for small edits', () => {
        const sim = (0, similarity_1.levenshteinSimilarity)('kitten', 'sitten');
        strict_1.default.ok(sim >= 0.8);
    });
});
(0, node_test_1.describe)('combinedSimilarity', () => {
    (0, node_test_1.it)('averages string and levenshtein similarity', () => {
        const a = 'hello world';
        const b = 'hello world!';
        const combined = (0, similarity_1.combinedSimilarity)(a, b);
        strict_1.default.ok(combined > 0.8);
        strict_1.default.ok(combined <= 1);
    });
});
(0, node_test_1.describe)('structuredSimilarity', () => {
    (0, node_test_1.it)('compares JSON objects field by field', () => {
        const a = JSON.stringify({ name: 'test', count: 5, active: true });
        const b = JSON.stringify({ name: 'test', count: 5, active: true });
        strict_1.default.equal((0, similarity_1.structuredSimilarity)(a, b), 1);
    });
    (0, node_test_1.it)('detects field changes', () => {
        const a = JSON.stringify({ name: 'test', count: 5 });
        const b = JSON.stringify({ name: 'other', count: 5 });
        const sim = (0, similarity_1.structuredSimilarity)(a, b);
        strict_1.default.ok(sim > 0.3);
        strict_1.default.ok(sim < 1);
    });
    (0, node_test_1.it)('falls back to string comparison for non-JSON', () => {
        const sim = (0, similarity_1.structuredSimilarity)('plain text', 'plain text');
        strict_1.default.equal(sim, 1);
    });
    (0, node_test_1.it)('handles nested objects', () => {
        const a = JSON.stringify({ user: { name: 'alice', age: 30 } });
        const b = JSON.stringify({ user: { name: 'alice', age: 31 } });
        const sim = (0, similarity_1.structuredSimilarity)(a, b);
        strict_1.default.ok(sim > 0.5);
        strict_1.default.ok(sim < 1);
    });
    (0, node_test_1.it)('handles arrays', () => {
        const a = JSON.stringify([1, 2, 3]);
        const b = JSON.stringify([1, 2, 3]);
        strict_1.default.equal((0, similarity_1.structuredSimilarity)(a, b), 1);
    });
    (0, node_test_1.it)('gives partial credit for similar values', () => {
        const a = JSON.stringify({ desc: 'This is a long description about something' });
        const b = JSON.stringify({ desc: 'This is a long description about another thing' });
        const sim = (0, similarity_1.structuredSimilarity)(a, b);
        strict_1.default.ok(sim > 0.5);
        strict_1.default.ok(sim < 1);
    });
});
// --- Store tests ---
(0, node_test_1.describe)('SnapshotStore', () => {
    let tmpDir;
    let store;
    function makeSnapshot(overrides) {
        return {
            id: 'test-1',
            prompt: 'Say hello',
            model: 'gpt-4',
            output: 'Hello!',
            timestamp: new Date().toISOString(),
            tags: ['greeting'],
            ...overrides,
        };
    }
    function setup() {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-test-'));
        store = new store_1.SnapshotStore({ snapshotsDir: tmpDir });
        store.init();
    }
    function cleanup() {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    (0, node_test_1.it)('initializes golden set file', () => {
        setup();
        const golden = store.load();
        strict_1.default.equal(golden.version, '1.0.0');
        strict_1.default.equal(golden.prompts.length, 0);
        cleanup();
    });
    (0, node_test_1.it)('adds and retrieves snapshots', () => {
        setup();
        const snap = makeSnapshot();
        store.add(snap);
        const loaded = store.get('test-1');
        strict_1.default.equal(loaded?.prompt, 'Say hello');
        strict_1.default.equal(loaded?.output, 'Hello!');
        cleanup();
    });
    (0, node_test_1.it)('updates existing snapshot by id', () => {
        setup();
        store.add(makeSnapshot({ output: 'Hello!' }));
        store.add(makeSnapshot({ output: 'Hi there!' }));
        const loaded = store.get('test-1');
        strict_1.default.equal(loaded?.output, 'Hi there!');
        strict_1.default.equal(store.list().length, 1);
        cleanup();
    });
    (0, node_test_1.it)('removes snapshots', () => {
        setup();
        store.add(makeSnapshot());
        strict_1.default.equal(store.remove('test-1'), true);
        strict_1.default.equal(store.get('test-1'), undefined);
        strict_1.default.equal(store.remove('nonexistent'), false);
        cleanup();
    });
    (0, node_test_1.it)('filters by tag', () => {
        setup();
        store.add(makeSnapshot({ id: 'a', tags: ['greeting'] }));
        store.add(makeSnapshot({ id: 'b', tags: ['farewell'] }));
        store.add(makeSnapshot({ id: 'c', tags: ['greeting', 'formal'] }));
        strict_1.default.equal(store.list({ tag: 'greeting' }).length, 2);
        strict_1.default.equal(store.list({ tag: 'farewell' }).length, 1);
        cleanup();
    });
    (0, node_test_1.it)('filters by model', () => {
        setup();
        store.add(makeSnapshot({ id: 'a', model: 'gpt-4' }));
        store.add(makeSnapshot({ id: 'b', model: 'claude-3' }));
        strict_1.default.equal(store.list({ model: 'gpt-4' }).length, 1);
        cleanup();
    });
    (0, node_test_1.it)('saves and loads history', () => {
        setup();
        store.add(makeSnapshot());
        store.saveHistory(makeSnapshot({ output: 'Hello v1', timestamp: '2026-01-01T00:00:00Z' }));
        store.saveHistory(makeSnapshot({ output: 'Hello v2', timestamp: '2026-02-01T00:00:00Z' }));
        const history = store.loadHistory('test-1');
        strict_1.default.equal(history.length, 2);
        strict_1.default.equal(history[0].output, 'Hello v1');
        strict_1.default.equal(history[1].output, 'Hello v2');
        cleanup();
    });
    (0, node_test_1.it)('imports from JSON file', () => {
        setup();
        const importFile = path.join(tmpDir, 'import.json');
        const data = [
            { id: 'imp-1', prompt: 'test', output: 'out1', model: 'gpt-4', timestamp: new Date().toISOString() },
            { id: 'imp-2', prompt: 'test2', output: 'out2', model: 'gpt-4', timestamp: new Date().toISOString() },
        ];
        fs.writeFileSync(importFile, JSON.stringify(data));
        const added = store.import(importFile);
        strict_1.default.equal(added, 2);
        strict_1.default.equal(store.list().length, 2);
        cleanup();
    });
    (0, node_test_1.it)('exports golden set', () => {
        setup();
        store.add(makeSnapshot());
        const exportFile = path.join(tmpDir, 'export.json');
        store.export(exportFile);
        const exported = JSON.parse(fs.readFileSync(exportFile, 'utf-8'));
        strict_1.default.equal(exported.prompts.length, 1);
        cleanup();
    });
});
// --- Runner tests ---
(0, node_test_1.describe)('BisectRunner', () => {
    let tmpDir;
    let store;
    let runner;
    function setup() {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-run-'));
        store = new store_1.SnapshotStore({ snapshotsDir: tmpDir });
        store.init();
        runner = new runner_1.BisectRunner({ snapshotsDir: tmpDir, threshold: 0.8 });
    }
    function cleanup() {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    (0, node_test_1.it)('compares outputs against golden set', () => {
        setup();
        store.add({
            id: 'p1',
            prompt: 'Say hi',
            model: 'gpt-4',
            output: 'Hello, world!',
            timestamp: new Date().toISOString(),
        });
        store.add({
            id: 'p2',
            prompt: 'Summarize',
            model: 'gpt-4',
            output: 'A short summary of the text.',
            timestamp: new Date().toISOString(),
        });
        const result = runner.compare([
            { id: 'p1', output: 'Hello, world!' }, // exact match
            { id: 'p2', output: 'A completely different summary about something else entirely.' },
        ]);
        strict_1.default.equal(result.total, 2);
        strict_1.default.equal(result.passed, 1);
        strict_1.default.equal(result.failed, 1);
        strict_1.default.equal(result.diffs[0].status, 'match');
        strict_1.default.equal(result.diffs[1].status, 'drift');
        cleanup();
    });
    (0, node_test_1.it)('reports errors for missing outputs', () => {
        setup();
        store.add({
            id: 'p1',
            prompt: 'test',
            model: 'gpt-4',
            output: 'expected',
            timestamp: new Date().toISOString(),
        });
        const result = runner.compare([]);
        strict_1.default.equal(result.total, 1);
        strict_1.default.equal(result.errors, 1);
        cleanup();
    });
    (0, node_test_1.it)('bisects through history to find regression point', () => {
        setup();
        store.add({
            id: 'p1',
            prompt: 'test',
            model: 'gpt-4',
            output: 'The quick brown fox jumps over the lazy dog',
            timestamp: new Date().toISOString(),
        });
        // Simulate history: first matching, then drifting
        store.saveHistory({
            id: 'p1',
            prompt: 'test',
            model: 'gpt-4',
            output: 'The quick brown fox jumps over the lazy dog',
            timestamp: '2026-01-01T00:00:00Z',
        });
        store.saveHistory({
            id: 'p1',
            prompt: 'test',
            model: 'gpt-4',
            output: 'The quick brown fox jumps over the lazy dog',
            timestamp: '2026-02-01T00:00:00Z',
        });
        store.saveHistory({
            id: 'p1',
            prompt: 'test',
            model: 'gpt-4',
            output: 'Something completely different and unrelated at all',
            timestamp: '2026-03-01T00:00:00Z',
        });
        store.saveHistory({
            id: 'p1',
            prompt: 'test',
            model: 'gpt-4',
            output: 'Yet another completely different output than before',
            timestamp: '2026-04-01T00:00:00Z',
        });
        const result = runner.bisect('p1');
        strict_1.default.ok(result);
        strict_1.default.equal(result.points.length, 4);
        strict_1.default.ok(result.regressionAt);
        strict_1.default.equal(result.regressionAt, '2026-03-01T00:00:00Z');
        strict_1.default.equal(result.points[0].changed, false);
        strict_1.default.equal(result.points[1].changed, false);
        strict_1.default.equal(result.points[2].changed, true);
        cleanup();
    });
    (0, node_test_1.it)('returns null for bisect with no history', () => {
        setup();
        store.add({
            id: 'p1',
            prompt: 'test',
            model: 'gpt-4',
            output: 'expected',
            timestamp: new Date().toISOString(),
        });
        const result = runner.bisect('p1');
        strict_1.default.equal(result, null);
        cleanup();
    });
    (0, node_test_1.it)('uses structured comparison method', () => {
        setup();
        const structuredRunner = new runner_1.BisectRunner({ snapshotsDir: tmpDir, threshold: 0.8, method: 'structured' });
        store.add({
            id: 'p1',
            prompt: 'generate config',
            model: 'gpt-4',
            output: JSON.stringify({ name: 'app', port: 3000, debug: false }),
            timestamp: new Date().toISOString(),
        });
        const result = structuredRunner.compare([
            { id: 'p1', output: JSON.stringify({ name: 'app', port: 3000, debug: true }) },
        ]);
        // One field changed out of 3 — similarity ~0.67, below 0.8 threshold
        strict_1.default.equal(result.failed, 1);
        strict_1.default.ok(result.diffs[0].similarity < 0.8);
        cleanup();
    });
    (0, node_test_1.it)('run method with async fetchOutput', async () => {
        setup();
        store.add({
            id: 'p1',
            prompt: 'test',
            model: 'gpt-4',
            output: 'Hello!',
            timestamp: new Date().toISOString(),
        });
        const result = await runner.run(async (snap) => {
            return 'Hello!'; // exact match
        });
        strict_1.default.equal(result.total, 1);
        strict_1.default.equal(result.passed, 1);
        cleanup();
    });
    (0, node_test_1.it)('run method handles fetch errors', async () => {
        setup();
        store.add({
            id: 'p1',
            prompt: 'test',
            model: 'gpt-4',
            output: 'Hello!',
            timestamp: new Date().toISOString(),
        });
        const result = await runner.run(async () => {
            throw new Error('API timeout');
        });
        strict_1.default.equal(result.total, 1);
        strict_1.default.equal(result.errors, 1);
        strict_1.default.ok(result.diffs[0].details?.includes('API timeout'));
        cleanup();
    });
});
//# sourceMappingURL=index.test.js.map