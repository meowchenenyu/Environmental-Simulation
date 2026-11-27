const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'simulation.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'save-format.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'cloud-sync.js'), 'utf8'), context);
const format = context.window.ArchipelagoSaveFormat;
const metadata = { name: '測試島', description: '雲端同步測試', cover: '🌊' };
const save = format.create({ metadata, terrain: { '0-0': 'forest' }, state: context.window.EcosystemSimulation.createInitialState() });
const islandId = '123e4567-e89b-42d3-a456-426614174000';

function fakeClient({ user = { id: 'user-1' }, error = null } = {}) {
  const calls = [];
  const row = { id: islandId, owner_id: 'user-1', name: metadata.name, description: metadata.description, cover_emoji: metadata.cover, visibility: 'private', save_format_version: 2, save_data: save };
  const client = {
    auth: {
      getUser: async () => ({ data: { user }, error }),
      signUp: async (credentials) => ({ data: credentials, error }),
      signInWithPassword: async (credentials) => ({ data: credentials, error }),
      signOut: async () => ({ data: null, error })
    },
    from(table) {
      calls.push({ table });
      const query = {
        select(columns) { calls.at(-1).select = columns; return query; },
        order(...args) { calls.at(-1).order = args; return Promise.resolve({ data: [row], error }); },
        upsert(value) { calls.at(-1).upsert = value; return query; },
        single() { return Promise.resolve({ data: row, error }); },
        eq(column, value) { calls.at(-1).eq = [column, value]; return query; },
        delete() { calls.at(-1).delete = true; return query; },
        then(resolve, reject) { return Promise.resolve({ data: row, error }).then(resolve, reject); }
      };
      return query;
    }
  };
  return { client, calls, row };
}

test('signs up and signs in through the injected Supabase client', async () => {
  const { client } = fakeClient();
  const sync = context.window.ArchipelagoCloudSync.create(client, format);
  assert.equal(JSON.stringify(await sync.signUp('a@example.com', 'password', 'https://example.com')), JSON.stringify({ email: 'a@example.com', password: 'password', options: { emailRedirectTo: 'https://example.com' } }));
  assert.equal(JSON.stringify(await sync.signIn('a@example.com', 'password')), JSON.stringify({ email: 'a@example.com', password: 'password' }));
  assert.equal((await sync.currentUser()).id, 'user-1');
});

test('saves only a validated private v2 envelope owned by current user', async () => {
  const { client, calls, row } = fakeClient();
  const sync = context.window.ArchipelagoCloudSync.create(client, format);
  assert.equal(await sync.saveIsland({ id: islandId, metadata, save }), row);
  assert.equal(calls.at(-1).upsert.owner_id, 'user-1');
  assert.equal(calls.at(-1).upsert.visibility, 'private');
  assert.equal(calls.at(-1).upsert.save_data, save);
});

test('keeps stable cloud UUIDs in a per-user local mapping', async () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const { client } = fakeClient();
  const sync = context.window.ArchipelagoCloudSync.create(client, format, { storage, createId: () => islandId });
  assert.equal(await sync.cloudIdFor('tidal-between'), islandId);
  assert.equal(await sync.cloudIdFor('tidal-between'), islandId);
  assert.equal(JSON.parse(values.get('archipelago-observatory:cloud-island-ids:user-1:v1'))['tidal-between'], islandId);
});

test('lists, loads, and deletes through owner-protected table queries', async () => {
  const { client, calls, row } = fakeClient();
  const sync = context.window.ArchipelagoCloudSync.create(client, format);
  assert.deepEqual(await sync.listIslands(), [row]);
  assert.equal((await sync.loadIsland(islandId)).id, islandId);
  await sync.deleteIsland(islandId);
  assert.equal(calls.at(-1).eq[1], islandId);
});

test('rejects unauthenticated access and malformed saves before writing', async () => {
  const anonymous = context.window.ArchipelagoCloudSync.create(fakeClient({ user: null }).client, format);
  await assert.rejects(() => anonymous.listIslands(), /請先登入/);
  const { client, calls } = fakeClient();
  const sync = context.window.ArchipelagoCloudSync.create(client, format);
  await assert.rejects(() => sync.saveIsland({ id: islandId, metadata, save: { ...save, terrain: { '99-99': 'forest' } } }), /地形資料/);
  await assert.rejects(() => sync.saveIsland({ id: 'local-slug', metadata, save }), /UUID/);
  assert.equal(calls.some((call) => call.upsert), false);
});

test('propagates Supabase errors', async () => {
  const sync = context.window.ArchipelagoCloudSync.create(fakeClient({ error: new Error('network') }).client, format);
  await assert.rejects(() => sync.signIn('a@example.com', 'password'), /network/);
});
