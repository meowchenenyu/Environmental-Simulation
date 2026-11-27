const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'simulation.js'), 'utf8'), context);
const simulation = context.window.EcosystemSimulation;

test('wetlands retain more rain and reduce runoff', () => {
  const dry = simulation.calculateWaterCycle(60, 25, 50, { wetland: 0, forest: 0 });
  const wetland = simulation.calculateWaterCycle(60, 25, 50, { wetland: 30, forest: 0 });
  assert.ok(wetland.infiltration > dry.infiltration);
  assert.ok(wetland.runoff < dry.runoff);
  assert.ok(wetland.water > dry.water);
});

test('warmer air increases evaporation and lowers stored water', () => {
  const cool = simulation.calculateWaterCycle(55, 20, 50, { wetland: 10, forest: 20 });
  const warm = simulation.calculateWaterCycle(55, 32, 50, { wetland: 10, forest: 20 });
  assert.ok(warm.evaporation > cool.evaporation);
  assert.ok(warm.water < cool.water);
});

test('low stored water limits plant growth under the same weather and habitat', () => {
  const dry = simulation.createInitialState();
  const wet = simulation.createInitialState();
  dry.resources.water = 12;
  wet.resources.water = 72;
  const dryNext = simulation.stepSimulation(dry, {});
  const wetNext = simulation.stepSimulation(wet, {});
  assert.ok(dryNext.resources['island-grass'] < wetNext.resources['island-grass']);
  assert.ok(dryNext.resources['coastal-seagrass'] < wetNext.resources['coastal-seagrass']);
});

test('water balance clamps storage and reports a reproducible budget', () => {
  const dry = simulation.calculateWaterCycle(0, 42, 0, { wetland: 0, forest: 0 });
  const storm = simulation.calculateWaterCycle(100, 15, 99.9, { wetland: 60, forest: 30 });
  assert.equal(dry.water, 0);
  assert.equal(storm.water, 100);
  assert.equal(Math.round((storm.infiltration - storm.runoff - storm.evaporation) * 10) / 10, Math.round(storm.netChange * 10) / 10);
});

test('daily simulation records seasonal water budget and drought warning', () => {
  const state = simulation.createInitialState();
  state.day = 52;
  state.resources.water = 50.05;
  const next = simulation.stepSimulation(state, {});
  assert.ok(next.environment.waterCycle);
  assert.ok(next.events.some((event) => event.title === '淡水進入乾旱警戒'));
});

test('low-retention terrain triggers a drought warning over multiple seasons', () => {
  let state = simulation.createInitialState();
  const dryTerrain = Object.fromEntries(Array.from({ length: 180 }, (_, index) => [`${index % 18}-${Math.floor(index / 18)}`, 'sand']));
  let droughtDay = null;
  let wildfireDay = null;
  for (let day = 0; day < 480; day += 1) {
    state = simulation.stepSimulation(state, dryTerrain);
    if (!droughtDay && state.events.some((event) => event.title === '淡水進入乾旱警戒' && event.day === state.day)) droughtDay = state.day;
    if (!wildfireDay && state.events.some((event) => event.title === '乾旱熱浪引發林地火災' && event.day === state.day)) wildfireDay = state.day;
  }
  assert.ok(droughtDay, 'dry terrain should cross the warning threshold within four simulated years');
  assert.ok(wildfireDay, 'dry terrain should trigger a hot-season wildfire within four simulated years');
});

test('dry hot conditions trigger a wildfire that consumes vegetation', () => {
  const state = simulation.createInitialState();
  state.day = 52;
  state.resources.water = 30;
  state.resources['island-grass'] = 70;
  state.resources.nectar = 60;
  const next = simulation.stepSimulation(state, {});
  assert.ok(next.events.some((event) => event.title === '乾旱熱浪引發林地火災'));
  assert.ok(next.resources['island-grass'] <= 53);
  assert.ok(next.resources.nectar <= 48);
  assert.equal(next.lastFireDay, next.day);
});

test('wildfire cooldown prevents repeated burns within 60 days', () => {
  let state = simulation.createInitialState();
  state.day = 60;
  state.resources.water = 30;
  let fires = 0;
  for (let step = 0; step < 60; step += 1) {
    state = simulation.stepSimulation({ ...state, resources: { ...state.resources, water: 30 } }, {});
    fires += state.events.filter((event) => event.title === '乾旱熱浪引發林地火災' && event.day === state.day).length;
  }
  assert.ok(fires <= 1);
});

test('default island water does not become stuck at a storage limit across four years', () => {
  let state = simulation.createInitialState();
  const waterLevels = [];
  for (let day = 0; day < 480; day += 1) {
    state = simulation.stepSimulation(state, {});
    waterLevels.push(state.resources.water);
  }
  assert.ok(Math.min(...waterLevels) > 0);
  assert.ok(Math.max(...waterLevels) < 100);
  assert.ok(Math.max(...waterLevels) - Math.min(...waterLevels) > 5);
});
