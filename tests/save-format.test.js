const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(projectRoot, 'simulation.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(projectRoot, 'save-format.js'), 'utf8'), context);

const simulation = context.window.EcosystemSimulation;
const saveFormat = context.window.ArchipelagoSaveFormat;
const defaultState = simulation.createInitialState();
const metadata = { name: '測試島', description: '存檔格式測試', cover: '🌊' };

function validSave() {
  return saveFormat.create({
    metadata,
    terrain: { '0-0': 'forest', '17-9': 'wetland' },
    state: defaultState,
    history: [],
    redoHistory: [],
    snapshots: [],
    challengeStartDay: null
  });
}

test('creates a v2 envelope and accepts it', () => {
  const save = validSave();
  assert.equal(save.formatVersion, 2);
  assert.equal(saveFormat.validate(save), '');
});

test('accepts legacy v1 envelopes without metadata', () => {
  const save = validSave();
  save.formatVersion = 1;
  delete save.metadata;
  assert.equal(saveFormat.validate(save), '');
});

test('bounds history and snapshot counts when creating an export', () => {
  const states = Array.from({ length: 35 }, () => defaultState);
  const snapshots = Array.from({ length: 12 }, (_, index) => ({
    id: String(index), day: defaultState.day, createdAt: new Date().toISOString(),
    state: defaultState, terrain: {}
  }));
  const save = saveFormat.create({ metadata, terrain: {}, state: defaultState, history: states, redoHistory: states, snapshots });
  assert.equal(save.simulation.history.length, 30);
  assert.equal(save.simulation.redoHistory.length, 30);
  assert.equal(save.simulation.snapshots.length, 10);
});

test('rejects out-of-map terrain cells', () => {
  const save = validSave();
  save.terrain = { '18-0': 'forest' };
  assert.match(saveFormat.validate(save), /地形資料/);
});

test('rejects invalid island metadata', () => {
  const save = validSave();
  save.metadata.name = ' ';
  assert.match(saveFormat.validate(save), /島嶼名稱/);
});

test('rejects negative populations', () => {
  const save = validSave();
  save.simulation.state.populations['blue-pigeon'] = -1;
  assert.match(saveFormat.validate(save), /模擬狀態/);
});

test('rejects snapshots whose label day differs from saved state', () => {
  const save = validSave();
  save.simulation.snapshots = [{
    id: 'snapshot-1', day: defaultState.day + 1, createdAt: new Date().toISOString(), state: defaultState, terrain: {}
  }];
  assert.match(saveFormat.validate(save), /快照資料/);
});
