(() => {
  const simulation = window.EcosystemSimulation;
  const covers = ['🌴', '🌿', '🌊', '🏝️', '🌳'];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function create({ metadata, terrain, state, history = [], redoHistory = [], snapshots = [], challengeStartDay = null }) {
    return {
      format: 'archipelago-observatory-save',
      formatVersion: 2,
      exportedAt: new Date().toISOString(),
      metadata: clone(metadata),
      terrain: clone(terrain),
      simulation: {
        state: clone(state),
        history: clone(history.slice(-30)),
        redoHistory: clone(redoHistory.slice(-30)),
        snapshots: clone(snapshots.slice(0, 10))
      },
      challengeStartDay
    };
  }

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function validTerrain(value) {
    if (!isRecord(value) || Object.keys(value).length > 180) return false;
    return Object.entries(value).every(([cell, type]) => {
      const match = /^(\d+)-(\d+)$/.exec(cell);
      return match && Number(match[1]) < 18 && Number(match[2]) < 10 && ['forest', 'grass', 'wetland', 'sand'].includes(type);
    });
  }

  function validSimulationState(state) {
    if (!isRecord(state) || !Number.isSafeInteger(state.day) || state.day < 1 || state.day > 1000000) return false;
    if (!['春季', '夏季', '秋季', '冬季'].includes(state.season)) return false;
    if (!isRecord(state.environment) || !isRecord(state.resources) || !isRecord(state.populations)) return false;
    const environment = state.environment;
    if (!Number.isFinite(environment.temperature) || environment.temperature < -20 || environment.temperature > 60) return false;
    for (const key of ['rainfall', 'humidity', 'water']) {
      if (!Number.isFinite(environment[key]) || environment[key] < 0 || environment[key] > 100) return false;
    }
    if (environment.waterCycle !== undefined && (!isRecord(environment.waterCycle) ||
      !['infiltration', 'runoff', 'evaporation'].every((key) => Number.isFinite(environment.waterCycle[key]) && environment.waterCycle[key] >= 0 && environment.waterCycle[key] <= 100) ||
      !Number.isFinite(environment.waterCycle.netChange) || environment.waterCycle.netChange < -100 || environment.waterCycle.netChange > 100)) return false;
    for (const profile of simulation.species) {
      const values = profile.kind === 'producer' ? state.resources : state.populations;
      const amount = values[profile.id];
      if (!Number.isFinite(amount) || amount < 0 || amount > (profile.kind === 'producer' ? 100 : 10000) || (profile.kind !== 'producer' && !Number.isSafeInteger(amount))) return false;
    }
    for (const key of ['nectar', 'water']) {
      if (!Number.isFinite(state.resources[key]) || state.resources[key] < 0 || state.resources[key] > 100) return false;
    }
    if (!isRecord(state.distribution)) return false;
    if (state.lastFireDay !== undefined && state.lastFireDay !== null && (!Number.isSafeInteger(state.lastFireDay) || state.lastFireDay < 1 || state.lastFireDay > state.day)) return false;
    if (state.lastDiseaseDay !== undefined && state.lastDiseaseDay !== null && (!Number.isSafeInteger(state.lastDiseaseDay) || state.lastDiseaseDay < 1 || state.lastDiseaseDay > state.day)) return false;
    for (const profile of simulation.species.filter((entry) => entry.kind === 'consumer')) {
      const shares = state.distribution[profile.id];
      if (!isRecord(shares) || !Object.values(shares).every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) return false;
      const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
      if (Math.abs(total - 100) > 1) return false;
    }
    if (!Array.isArray(state.events) || state.events.length > 20 || !state.events.every((event) =>
      isRecord(event) && typeof event.title === 'string' && typeof event.detail === 'string' && typeof event.icon === 'string' && Number.isSafeInteger(event.day))) return false;
    if (!Array.isArray(state.series) || state.series.length < 1 || state.series.length > 30) return false;
    const seriesFields = ['day', 'richness', 'stability', 'population', 'predators', 'vegetation'];
    return state.series.every((point) => isRecord(point) && Number.isSafeInteger(point.day) && point.day > 0 &&
      seriesFields.slice(1).every((field) => Number.isFinite(point[field]) && point[field] >= 0));
  }

  function validate(data) {
    if (!isRecord(data) || data.format !== 'archipelago-observatory-save' || ![1, 2].includes(data.formatVersion)) return '不支援這個存檔格式或版本。';
    if (data.formatVersion === 2 && (!isRecord(data.metadata) || typeof data.metadata.name !== 'string' || !data.metadata.name.trim() || data.metadata.name.length > 80 || typeof data.metadata.description !== 'string' || data.metadata.description.length > 500 || !covers.includes(data.metadata.cover))) return '島嶼名稱、介紹或封面資料有誤。';
    if (!validTerrain(data.terrain)) return '地形資料不完整或包含無效格子。';
    const save = data.simulation;
    if (!isRecord(save) || !validSimulationState(save.state)) return '模擬狀態不完整或數值超出範圍。';
    const validStateList = (states) => Array.isArray(states) && states.length <= 30 && states.every(validSimulationState);
    if (!validStateList(save.history || []) || !validStateList(save.redoHistory || [])) return '模擬回退紀錄格式有誤。';
    const snapshots = save.snapshots || [];
    if (!Array.isArray(snapshots) || snapshots.length > 10 || !snapshots.every((snapshot) =>
      isRecord(snapshot) && typeof snapshot.id === 'string' && Number.isSafeInteger(snapshot.day) && snapshot.day === snapshot.state?.day &&
      validSimulationState(snapshot.state) && validTerrain(snapshot.terrain) && Number.isFinite(Date.parse(snapshot.createdAt)))) return '快照資料格式有誤。';
    if (data.challengeStartDay !== null && (!Number.isSafeInteger(data.challengeStartDay) || data.challengeStartDay < 1 || data.challengeStartDay > 1000000)) return '挑戰進度格式有誤。';
    return '';
  }

  window.ArchipelagoSaveFormat = { covers, create, validate };
})();
