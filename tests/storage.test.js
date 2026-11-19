import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_STATE } from '../src/model.js';
import { STORAGE_KEY, createDraftState, createPlannerStore } from '../src/storage.js';

function memoryStorage(initial = null) {
  let raw = initial;
  return {
    failRead: false,
    failWrite: false,
    get raw() { return raw; },
    set raw(value) { raw = value; },
    getItem(key) {
      assert.equal(key, STORAGE_KEY);
      if (this.failRead) throw new Error('Read unavailable');
      return raw;
    },
    setItem(key, value) {
      assert.equal(key, STORAGE_KEY);
      if (this.failWrite) throw new Error('Quota exceeded');
      raw = value;
    },
  };
}

const edit = (store, key, value, scenarioId = 'middle') => store.updateField({ scenarioId, key, value });
const valueOf = (result, key, scenarioId = 'middle') => scenarioId === null ? result.state[key]
  : result.state.scenarios.find(scenario => scenario.id === scenarioId)[key];
const serialize = (state, undoState = null) => JSON.stringify({ version: 2, state, undoState });

test('new drafts are independent strings with canonical identities and labels', () => {
  const first = createDraftState();
  assert.equal(first.horizon, '6');
  assert.equal(first.scenarios[0].investment, '0');
  first.scenarios[0].name = 'changed';
  first.scenarios[0].closeRate = 'invalid';
  assert.equal(createDraftState().scenarios[0].name, DEFAULT_STATE.scenarios[0].name);
  assert.equal(DEFAULT_STATE.scenarios[0].closeRate, 20);
  const store = createPlannerStore(() => memoryStorage());
  assert.deepEqual(store.read(), { state: createDraftState(), undoState: null, saved: true, notice: '' });
});

test('version 1 numeric drafts migrate in memory without turning null into zero', () => {
  const state = structuredClone(DEFAULT_STATE);
  state.horizon = null;
  state.scenarios[1].investment = null;
  state.scenarios[2].closeRate = 12.5;
  const storage = memoryStorage(JSON.stringify({ version: 1, state }));
  const store = createPlannerStore(() => storage);
  const loaded = store.read();
  assert.equal(loaded.state.horizon, '');
  assert.equal(loaded.state.scenarios[1].investment, '');
  assert.equal(loaded.state.scenarios[2].closeRate, '12.5');
  assert.equal(loaded.undoState, null);
  assert.equal(JSON.parse(storage.raw).version, 1, 'read does not rewrite storage');
  edit(store, 'horizon', '8', null);
  assert.equal(JSON.parse(storage.raw).version, 2);
  assert.equal(JSON.parse(storage.raw).state.scenarios[1].investment, '');
});

test('version 2 preserves exact comma decimals, blanks, whitespace and incomplete input', () => {
  const storage = memoryStorage();
  const store = createPlannerStore(() => storage);
  edit(store, 'closeRate', '12,50');
  edit(store, 'investment', '');
  edit(store, 'marginPerClient', '-');
  edit(store, 'visits', '  10,0  ');
  edit(store, 'consultations', '1e');
  edit(store, 'horizon', '', null);
  const result = createPlannerStore(() => storage).read();
  assert.equal(result.saved, true);
  for (const [key, value] of Object.entries({ closeRate: '12,50', investment: '', marginPerClient: '-', visits: '  10,0  ', consultations: '1e' })) {
    assert.equal(valueOf(result, key), value);
  }
  assert.equal(result.state.horizon, '');
});

test('corrupt and unsupported payloads preserve the current session and expose a notice', () => {
  for (const raw of ['', '{broken', 'null', '{}', JSON.stringify({ version: 3, state: createDraftState() })]) {
    const storage = memoryStorage();
    const store = createPlannerStore(() => storage);
    edit(store, 'investment', '4321');
    storage.raw = raw;
    const result = store.sync();
    assert.equal(result.saved, false, raw);
    assert.match(result.notice, /formato/);
    assert.equal(valueOf(result, 'investment'), '4321');
    const repaired = edit(store, 'closeRate', '25');
    assert.equal(repaired.saved, true);
    assert.equal(valueOf(createPlannerStore(() => storage).read(), 'investment'), '4321');
  }
});

test('stored scenario labels and unknown metadata never become application labels', () => {
  const state = createDraftState();
  state.scenarios[0].name = '<script>bad()</script>';
  state.scenarios[0].extra = 'untrusted';
  const undo = createDraftState();
  undo.scenarios[2].name = '<img onerror=bad()> ';
  const result = createPlannerStore(() => memoryStorage(serialize(state, undo))).read();
  assert.deepEqual(result.state, createDraftState());
  assert.deepEqual(result.undoState, createDraftState());
});

test('wrong IDs, missing fields, wrong types and oversized drafts are rejected as a whole', () => {
  const badStates = [];
  for (const change of [
    state => { state.scenarios[0].id = 'intruder'; },
    state => { state.scenarios.reverse(); },
    state => { state.scenarios.pop(); },
    state => { state.scenarios[1] = null; },
    state => { delete state.scenarios[0].visits; },
    state => { state.scenarios[0].closeRate = 20; },
    state => { state.horizon = null; },
    state => { state.scenarios[0].investment = '1'.repeat(513); },
  ]) {
    const state = createDraftState();
    change(state);
    badStates.push(state);
  }
  for (const state of badStates) {
    const result = createPlannerStore(() => memoryStorage(serialize(state))).read();
    assert.equal(result.saved, false);
    assert.deepEqual(result.state, createDraftState());
    assert.ok(result.notice);
  }
  const badLegacy = structuredClone(DEFAULT_STATE);
  badLegacy.scenarios[0].investment = '123';
  assert.equal(createPlannerStore(() => memoryStorage(JSON.stringify({ version: 1, state: badLegacy }))).read().saved, false);
  const invalidUndo = createDraftState();
  invalidUndo.scenarios[0].id = 'wrong';
  assert.equal(createPlannerStore(() => memoryStorage(serialize(createDraftState(), invalidUndo))).read().saved, false);
});

test('accessing localStorage or reading it may fail while the in-memory draft remains usable', () => {
  let blocked = true;
  const storage = memoryStorage();
  const store = createPlannerStore(() => {
    if (blocked) throw new Error('SecurityError');
    return storage;
  });
  assert.equal(store.read().saved, false);
  const unsaved = edit(store, 'marginPerClient', '-5,5');
  assert.equal(unsaved.saved, false);
  assert.equal(valueOf(unsaved, 'marginPerClient'), '-5,5');
  blocked = false;
  const saved = edit(store, 'closeRate', '22');
  assert.equal(saved.saved, true);
  assert.equal(valueOf(createPlannerStore(() => storage).read(), 'marginPerClient'), '-5,5');

  storage.failRead = true;
  assert.equal(store.sync().saved, false);
  assert.equal(edit(store, 'consultations', '123').saved, false);
  storage.failRead = false;
  assert.equal(edit(store, 'visits', '456').saved, true);
  assert.equal(valueOf(store.read(), 'consultations'), '123');
});

test('failed writes survive read and sync, then retry without losing pending fields', () => {
  const storage = memoryStorage();
  const store = createPlannerStore(() => storage);
  edit(store, 'investment', '3100');
  storage.failWrite = true;
  const failed = edit(store, 'investment', '3900');
  assert.equal(failed.saved, false);
  assert.match(failed.notice, /guardar/);
  assert.equal(valueOf(store.read(), 'investment'), '3900');
  assert.equal(valueOf(store.sync(), 'investment'), '3900');
  assert.equal(store.sync().saved, false);
  edit(store, 'marginPerClient', '-');
  storage.failWrite = false;
  const recovered = edit(store, 'closeRate', '30');
  assert.equal(recovered.saved, true);
  assert.equal(recovered.notice, '');
  const reload = createPlannerStore(() => storage).read();
  assert.equal(valueOf(reload, 'investment'), '3900');
  assert.equal(valueOf(reload, 'marginPerClient'), '-');
  assert.equal(valueOf(reload, 'closeRate'), '30');
});

test('two interleaved stores preserve edits in different fields and sync remote changes', () => {
  const storage = memoryStorage();
  const first = createPlannerStore(() => storage);
  const second = createPlannerStore(() => storage);
  first.read();
  second.read();
  edit(first, 'horizon', '12', null);
  edit(second, 'closeRate', '31');
  edit(first, 'marginPerClient', '100', 'favorable');
  const result = second.sync();
  assert.equal(result.state.horizon, '12');
  assert.equal(valueOf(result, 'closeRate'), '31');
  assert.equal(valueOf(result, 'marginPerClient', 'favorable'), '100');
  edit(second, 'closeRate', '35');
  edit(first, 'closeRate', '40');
  assert.equal(valueOf(second.sync(), 'closeRate'), '40', 'last save of the same field wins');
});

test('a retry merges unsaved local fields with newer edits from another store', () => {
  const storage = memoryStorage();
  const local = createPlannerStore(() => storage);
  const remote = createPlannerStore(() => storage);
  storage.failWrite = true;
  edit(local, 'investment', '9000');
  storage.failWrite = false;
  edit(remote, 'horizon', '18', null);
  edit(remote, 'investment', '5000');
  assert.equal(valueOf(local.sync(), 'investment'), '9000');
  assert.equal(local.sync().state.horizon, '6', 'sync leaves the whole dirty draft visible');
  const result = edit(local, 'closeRate', '17');
  assert.equal(result.saved, true);
  assert.equal(result.state.horizon, '18');
  assert.equal(valueOf(result, 'investment'), '9000');
  assert.equal(valueOf(remote.sync(), 'investment'), '9000');
});

test('restore preserves a complete invalid draft, survives reload and can be undone once', () => {
  const storage = memoryStorage();
  const store = createPlannerStore(() => storage);
  edit(store, 'horizon', '', null);
  edit(store, 'investment', '9100');
  edit(store, 'closeRate', '10,5');
  edit(store, 'marginPerClient', '-');
  const before = store.read().state;
  const restored = store.restoreExample();
  assert.deepEqual(restored.state, createDraftState());
  assert.deepEqual(restored.undoState, before);
  assert.deepEqual(store.restoreExample().undoState, before, 'repeated reset keeps its original backup');
  const reloaded = createPlannerStore(() => storage);
  assert.deepEqual(reloaded.read().undoState, before);
  const undone = reloaded.undoRestore();
  assert.deepEqual(undone.state, before);
  assert.equal(undone.undoState, null);
  assert.deepEqual(reloaded.undoRestore().state, before);
  assert.equal(createPlannerStore(() => storage).read().undoState, null);
});

test('a new edit followed by restore replaces the previous undo snapshot', () => {
  const storage = memoryStorage();
  const store = createPlannerStore(() => storage);
  assert.equal(store.restoreExample().undoState, null, 'unchanged example needs no undo');
  edit(store, 'investment', '7000');
  store.restoreExample();
  edit(store, 'visits', '4444');
  const before = store.read().state;
  assert.deepEqual(store.restoreExample().undoState, before);
  assert.deepEqual(store.undoRestore().state, before);
});

test('failed restoration and undo retain the working draft and backup for retry', () => {
  const storage = memoryStorage();
  const store = createPlannerStore(() => storage);
  edit(store, 'investment', '8000');
  storage.failWrite = true;
  const reset = store.restoreExample();
  assert.equal(reset.saved, false);
  assert.equal(valueOf(reset, 'investment'), '3000');
  assert.equal(reset.undoState.scenarios[2].investment, '8000');
  assert.deepEqual(store.sync().state, createDraftState());
  storage.failWrite = false;
  assert.equal(store.restoreExample().saved, true);
  storage.failWrite = true;
  const undone = store.undoRestore();
  assert.equal(undone.saved, false);
  assert.equal(valueOf(undone, 'investment'), '8000');
  assert.equal(undone.undoState, null);
  storage.failWrite = false;
  edit(store, 'closeRate', '30');
  const reloaded = createPlannerStore(() => storage).read();
  assert.equal(valueOf(reloaded, 'investment'), '8000');
  assert.equal(reloaded.undoState, null);
});

test('invalid update targets and oversized values never mutate or write the draft', () => {
  const storage = memoryStorage();
  const store = createPlannerStore(() => storage);
  for (const change of [
    { scenarioId: null, key: 'visits', value: '1' },
    { scenarioId: 'unknown', key: 'visits', value: '1' },
    { scenarioId: 'initial', key: 'name', value: 'changed' },
    { scenarioId: 'initial', key: 'visits', value: 1 },
    { scenarioId: 'initial', key: 'visits', value: '1'.repeat(513) },
  ]) assert.throws(() => store.updateField(change), TypeError);
  assert.deepEqual(store.read().state, createDraftState());
  assert.equal(storage.raw, null);
  assert.equal(edit(store, 'visits', '1'.repeat(512)).saved, true);
});

test('returned snapshots cannot mutate internal state or the stored undo backup', () => {
  const storage = memoryStorage();
  const store = createPlannerStore(() => storage);
  edit(store, 'investment', '7000');
  const result = store.restoreExample();
  result.state.horizon = '99';
  result.undoState.scenarios[2].investment = '9999';
  const reread = store.read();
  assert.equal(reread.state.horizon, '6');
  assert.equal(reread.undoState.scenarios[2].investment, '7000');
});
