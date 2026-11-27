(() => {
  function create(client, saveFormat, { storage = window.localStorage, createId = () => crypto.randomUUID() } = {}) {
    if (!client?.auth || typeof client.from !== 'function') throw new TypeError('需要有效的 Supabase client。');
    if (!saveFormat || typeof saveFormat.validate !== 'function') throw new TypeError('需要存檔格式驗證器。');

    async function resultOf(promise) {
      const result = await promise;
      if (result.error) throw result.error;
      return result.data;
    }

    async function currentUser() {
      const data = await resultOf(client.auth.getUser());
      return data?.user || null;
    }

    async function cloudIdFor(localIslandId) {
      const user = await currentUser();
      if (!user) throw new Error('請先登入再建立雲端島嶼對應。');
      if (typeof localIslandId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(localIslandId)) throw new TypeError('本機島嶼 ID 格式有誤。');
      const key = `archipelago-observatory:cloud-island-ids:${user.id}:v1`;
      let mapping = {};
      try {
        const parsed = JSON.parse(storage.getItem(key) || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) mapping = parsed;
      } catch { mapping = {}; }
      const isUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      if (isUuid(mapping[localIslandId])) return mapping[localIslandId];
      const id = createId();
      if (!isUuid(id)) throw new TypeError('雲端島嶼 ID 產生器必須回傳 UUID。');
      mapping[localIslandId] = id;
      storage.setItem(key, JSON.stringify(mapping));
      return id;
    }

    return {
      currentUser,
      cloudIdFor,
      signUp(email, password, emailRedirectTo) {
        const options = emailRedirectTo ? { options: { emailRedirectTo } } : {};
        return resultOf(client.auth.signUp({ email, password, ...options }));
      },
      signIn(email, password) {
        return resultOf(client.auth.signInWithPassword({ email, password }));
      },
      signOut() {
        return resultOf(client.auth.signOut());
      },
      async listIslands() {
        const user = await currentUser();
        if (!user) throw new Error('請先登入再讀取雲端島嶼。');
        return resultOf(client.from('islands').select('id,name,description,cover_emoji,visibility,save_format_version,created_at,updated_at').order('updated_at', { ascending: false }));
      },
      async saveIsland({ id, metadata, save }) {
        const user = await currentUser();
        if (!user) throw new Error('請先登入再保存雲端島嶼。');
        const validationMessage = saveFormat.validate(save);
        if (validationMessage) throw new Error(validationMessage);
        if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
          throw new TypeError('雲端島嶼需要 UUID。');
        }
        if (!metadata || metadata.name !== save.metadata?.name || metadata.description !== save.metadata?.description || metadata.cover !== save.metadata?.cover) {
          throw new TypeError('島嶼資料必須與已驗證的存檔一致。');
        }
        const row = {
          id,
          owner_id: user.id,
          name: metadata.name,
          description: metadata.description,
          cover_emoji: metadata.cover,
          visibility: 'private',
          save_format_version: save.formatVersion,
          save_data: save
        };
        return resultOf(client.from('islands').upsert(row).select().single());
      },
      async loadIsland(id) {
        const user = await currentUser();
        if (!user) throw new Error('請先登入再讀取雲端島嶼。');
        const row = await resultOf(client.from('islands').select('id,owner_id,name,description,cover_emoji,visibility,save_format_version,save_data,created_at,updated_at').eq('id', id).single());
        const validationMessage = saveFormat.validate(row.save_data);
        if (validationMessage) throw new Error(`雲端存檔無效：${validationMessage}`);
        return row;
      },
      async deleteIsland(id) {
        const user = await currentUser();
        if (!user) throw new Error('請先登入再刪除雲端島嶼。');
        return resultOf(client.from('islands').delete().eq('id', id));
      }
    };
  }

  window.ArchipelagoCloudSync = { create };
})();
