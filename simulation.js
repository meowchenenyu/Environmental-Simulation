(() => {
  const species = [
    { id: 'island-grass', name: '島嶼草叢', kind: 'producer', icon: '🌾', unit: '%', habitat: '草原', role: '生產者', food: ['sunlight', 'water'], capacity: 100 },
    { id: 'coastal-seagrass', name: '海岸海草', kind: 'producer', icon: '🌿', unit: '%', habitat: '濕地・海岸', role: '生產者', food: ['sunlight', 'water'], capacity: 100 },
    { id: 'blue-pigeon', name: '藍冠鴿', kind: 'consumer', icon: '🦜', unit: '隻', habitat: '森林・草原', role: '雜食者', food: ['island-grass', 'nectar'], preferredHabitats: ['forest', 'grass'], base: 24, capacity: 60, growth: 0.075, mortality: 0.025 },
    { id: 'green-turtle', name: '綠蠵龜', kind: 'consumer', icon: '🐢', unit: '隻', habitat: '海岸・濕地', role: '草食者', food: ['coastal-seagrass'], preferredHabitats: ['wetland', 'sand'], base: 18, capacity: 45, growth: 0.05, mortality: 0.018 },
    { id: 'tree-frog', name: '雨林樹蛙', kind: 'consumer', icon: '🐸', unit: '隻', habitat: '森林・濕地', role: '昆蟲食者', food: ['moonlight-butterfly'], preferredHabitats: ['forest', 'wetland'], base: 42, capacity: 65, growth: 0.1, mortality: 0.025 },
    { id: 'moonlight-butterfly', name: '月光鳳蝶', kind: 'consumer', icon: '🦋', unit: '隻', habitat: '林緣・草原', role: '傳粉者', food: ['nectar'], preferredHabitats: ['forest', 'grass'], base: 31, capacity: 65, growth: 0.11, mortality: 0.035 },
    { id: 'reef-crab', name: '潮間帶招潮蟹', kind: 'consumer', icon: '🦀', unit: '隻', habitat: '海岸・濕地', role: '雜食者', food: ['coastal-seagrass', 'water'], preferredHabitats: ['wetland', 'sand'], base: 16, capacity: 50, growth: 0.08, mortality: 0.04 },
    { id: 'island-lizard', name: '斑紋石龍子', kind: 'consumer', icon: '🦎', unit: '隻', habitat: '森林・草原', role: '掠食者', food: ['tree-frog', 'moonlight-butterfly'], preferredHabitats: ['forest', 'grass'], base: 7, capacity: 25, growth: 0.08, mortality: 0.045 }
  ];
  const seasons = [
    { name: '春季', icon: '❀', temperature: 22, rainfall: 72 },
    { name: '夏季', icon: '☀', temperature: 26, rainfall: 55 },
    { name: '秋季', icon: '🍂', temperature: 23, rainfall: 68 },
    { name: '冬季', icon: '❄', temperature: 19, rainfall: 62 }
  ];
  const ecologyProfiles = {
    'island-grass': { temperatureRange: [10, 36], humidityRange: [25, 90], mobility: '固定生長', reproduction: '種子散播', growth: 0.03, mortality: 0.008, preferredHabitats: ['grass'] },
    'coastal-seagrass': { temperatureRange: [18, 34], humidityRange: [65, 100], mobility: '固定生長', reproduction: '地下莖擴展', growth: 0.025, mortality: 0.006, preferredHabitats: ['wetland', 'sand'] },
    'blue-pigeon': { temperatureRange: [12, 35], humidityRange: [30, 90], mobility: '高', reproduction: '築巢產卵' },
    'green-turtle': { temperatureRange: [20, 33], humidityRange: [55, 100], mobility: '中', reproduction: '沙灘產卵' },
    'tree-frog': { temperatureRange: [16, 30], humidityRange: [65, 100], mobility: '低', reproduction: '水邊產卵' },
    'moonlight-butterfly': { temperatureRange: [17, 32], humidityRange: [35, 90], mobility: '高', reproduction: '寄主植物產卵' },
    'reef-crab': { temperatureRange: [18, 34], humidityRange: [65, 100], mobility: '低', reproduction: '水中產卵' },
    'island-lizard': { temperatureRange: [18, 36], humidityRange: [25, 80], mobility: '中', reproduction: '地面產卵' }
  };
  species.forEach((entry) => Object.assign(entry, ecologyProfiles[entry.id]));
  const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
  const round = (value) => Math.round(value);

  function seasonForDay(day) {
    return seasons[Math.floor(((day + 6) % 120) / 30)];
  }

  function calculateWaterCycle(rainfall, temperature, water, habitats) {
    const wetland = habitats?.wetland ?? 0;
    const forest = habitats?.forest ?? 0;
    const rainfallInput = rainfall * 0.008;
    const infiltration = rainfallInput * Math.min(0.96, 0.72 + wetland * 0.002);
    const runoff = rainfallInput * Math.max(0.08, 0.34 - wetland * 0.002);
    const evaporation = (0.12 + Math.max(0, temperature - 18) * 0.012 + water * 0.0012) * Math.max(0.7, 1 - forest * 0.001);
    return {
      infiltration,
      runoff,
      evaporation,
      water: clamp(water + infiltration - runoff - evaporation),
      netChange: infiltration - runoff - evaporation
    };
  }

  function metricsFor(state) {
    const aliveAnimals = species.filter((entry) => entry.kind === 'consumer' && state.populations[entry.id] > 0).length;
    const livingProducers = species.filter((entry) => entry.kind === 'producer' && state.resources[entry.id] > 0).length;
    const richness = aliveAnimals + livingProducers;
    const resourceAverage = (state.resources['island-grass'] + state.resources['coastal-seagrass'] + state.resources.nectar) / 3;
    const habitatSupport = state.habitats
      ? species.filter((entry) => entry.kind === 'consumer').reduce((sum, entry) => sum + entry.preferredHabitats.reduce((share, key) => share + state.habitats[key], 0), 0) / 6
      : 60;
    const stability = clamp(round(32 + resourceAverage * 0.34 + habitatSupport * 0.1 + (richness / species.length) * 20));
    return { richness, stability };
  }

  function defaultHabitat(column, row) {
    const x = (column - 8.5) / 5.3;
    const y = (row - 4.8) / 3.7;
    if (x * x + y * y > 1) return null;
    if ((column <= 4 && row >= 4 && row <= 6) || (column >= 10 && column <= 12 && row >= 5 && row <= 6)) return 'wetland';
    if (row <= 1 || row >= 8 || column <= 4 || column >= 13 || x * x + y * y > 0.78) return 'sand';
    if ((column >= 6 && column <= 11 && row <= 5) || (column >= 9 && column <= 12 && row <= 6)) return 'forest';
    return 'grass';
  }

  function habitatFromTerrain(edits = {}) {
    const counts = { forest: 0, grass: 0, wetland: 0, sand: 0 };
    for (let row = 0; row < 10; row += 1) {
      for (let column = 0; column < 18; column += 1) {
        const baseline = defaultHabitat(column, row);
        if (!baseline) continue;
        const override = edits[`${column}-${row}`];
        const type = counts[override] === undefined ? baseline : override;
        counts[type] += 1;
      }
    }
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0) || 1;
    const habitats = {};
    let assigned = 0;
    Object.entries(counts).forEach(([key, value], index, entries) => {
      const share = index === entries.length - 1 ? 100 - assigned : round(value / total * 100);
      habitats[key] = share;
      assigned += share;
    });
    return habitats;
  }

  function distributePopulation(preferredHabitats, habitats) {
    const total = preferredHabitats.reduce((sum, key) => sum + habitats[key], 0);
    if (total === 0) return { unsuitable: 100 };
    const shares = {};
    let assigned = 0;
    preferredHabitats.forEach((key, index) => {
      const value = index === preferredHabitats.length - 1 ? 100 - assigned : round(habitats[key] / total * 100);
      shares[key] = value;
      assigned += value;
    });
    return shares;
  }

  function migrateDistribution(previous, habitats) {
    const nextDistribution = {};
    let migrationActivity = 0;
    for (const entry of species.filter((candidate) => candidate.kind === 'consumer')) {
      const target = distributePopulation(entry.preferredHabitats, habitats);
      const old = previous.distribution?.[entry.id] || target;
      if (target.unsuitable) {
        migrationActivity += old.unsuitable ? 0 : Object.values(old).reduce((sum, value) => sum + value, 0);
        nextDistribution[entry.id] = { unsuitable: 100 };
        continue;
      }
      const blended = Object.fromEntries(entry.preferredHabitats.map((key) => [key, (old[key] ?? 0) * 0.82 + target[key] * 0.18]));
      const total = Object.values(blended).reduce((sum, value) => sum + value, 0) || 1;
      nextDistribution[entry.id] = {};
      let assigned = 0;
      const keys = Object.keys(blended);
      keys.forEach((key, index) => {
        const value = index === keys.length - 1 ? 100 - assigned : round(blended[key] / total * 100);
        nextDistribution[entry.id][key] = value;
        assigned += value;
      });
      migrationActivity += Object.entries(nextDistribution[entry.id]).reduce((sum, [key, value]) => sum + Math.abs(value - (old[key] ?? value)), 0);
    }
    return { distribution: nextDistribution, migrationActivity };
  }

  function initialEvents(day, resources, populations) {
    return [
      { id: `start-pop-${day}`, day, icon: '🔎', title: '完成島嶼物種盤點', detail: `記錄 ${Object.keys(populations).length + 2} 種島嶼居民` },
      { id: `start-grass-${day}`, day, icon: '🌾', title: '草原植被狀態穩定', detail: `草叢覆蓋約 ${resources['island-grass']}%` },
      { id: `start-water-${day}`, day, icon: '💧', title: '海岸棲地完成基線記錄', detail: `海草覆蓋約 ${resources['coastal-seagrass']}%` }
    ];
  }

  function createInitialState(terrainEdits = {}) {
    const day = 24;
    const populations = Object.fromEntries(species.filter((entry) => entry.kind === 'consumer').map((entry) => [entry.id, entry.base]));
    const resources = { 'island-grass': 62, 'coastal-seagrass': 58, nectar: 65, water: 72 };
    const season = seasonForDay(day);
    const state = {
      day,
      season: season.name,
      environment: {
        temperature: season.temperature,
        rainfall: season.rainfall,
        humidity: 72,
        water: resources.water,
        waterCycle: { infiltration: 0, runoff: 0, evaporation: 0, netChange: 0 }
      },
      resources,
      populations,
      habitats: habitatFromTerrain(terrainEdits),
      distribution: Object.fromEntries(species.filter((entry) => entry.kind === 'consumer').map((entry) => [entry.id, distributePopulation(entry.preferredHabitats, habitatFromTerrain(terrainEdits))])),
      terrainEdits,
      lastFireDay: null,
      lastDiseaseDay: null,
      events: initialEvents(day, resources, populations),
      series: [{ day, richness: 8, stability: 84, population: Object.values(populations).reduce((sum, value) => sum + value, 0), predators: populations['island-lizard'], vegetation: 62 }]
    };
    const metrics = metricsFor(state);
    state.series[0].stability = metrics.stability;
    return state;
  }

  function stepSimulation(previous, terrainEdits = previous.terrainEdits || {}) {
    const day = previous.day + 1;
    const season = seasonForDay(day);
    const rainfall = clamp(season.rainfall + round(Math.sin(day * 0.21) * 17), 15, 100);
    const temperature = season.temperature + round(Math.sin(day * 0.13) * 2);
    const rainFactor = rainfall / 70;
    const resources = { ...previous.resources };
    const populations = { ...previous.populations };
    const previousAnimals = { ...previous.populations };
    const habitats = habitatFromTerrain(terrainEdits);
    const waterAvailability = clamp(previous.resources.water / 60, 0.25, 1);

    // Producers replenish from rain and daylight, then consumers use the available food.
    resources['island-grass'] = clamp(resources['island-grass'] + (0.48 + habitats.grass * 0.016) * rainFactor * waterAvailability - previousAnimals['blue-pigeon'] * 0.022 - previousAnimals['reef-crab'] * 0.014);
    resources['coastal-seagrass'] = clamp(resources['coastal-seagrass'] + (0.48 + habitats.wetland * 0.018) * rainFactor * waterAvailability - previousAnimals['green-turtle'] * 0.025 - previousAnimals['reef-crab'] * 0.015);
    resources.nectar = clamp(resources.nectar + 0.62 * (resources['island-grass'] / 60) + 0.42 * rainFactor - previousAnimals['moonlight-butterfly'] * 0.025);
    const waterCycle = calculateWaterCycle(rainfall, temperature, previous.resources.water, habitats);
    resources.water = waterCycle.water;

    const frogLoss = Math.min(populations['tree-frog'], round(populations['island-lizard'] * 0.04));
    populations['tree-frog'] -= frogLoss;
    const butterflyLoss = Math.min(populations['moonlight-butterfly'], round(populations['tree-frog'] * 0.01));
    populations['moonlight-butterfly'] -= butterflyLoss;

    const foods = {
      'blue-pigeon': (resources['island-grass'] * 0.65 + resources.nectar * 0.35) / 65,
      'green-turtle': resources['coastal-seagrass'] / 60,
      'tree-frog': previousAnimals['moonlight-butterfly'] / 34,
      'moonlight-butterfly': resources.nectar / 60,
      'reef-crab': (resources['coastal-seagrass'] * 0.62 + resources.water * 0.38) / 65,
      'island-lizard': (populations['tree-frog'] * 0.72 + populations['moonlight-butterfly'] * 0.28) / 40
    };
    for (const entry of species.filter((candidate) => candidate.kind === 'consumer')) {
      const count = populations[entry.id];
      const [minTemperature, maxTemperature] = entry.temperatureRange;
      const [minHumidity, maxHumidity] = entry.humidityRange;
      const temperatureFit = temperature < minTemperature
        ? clamp(1 - (minTemperature - temperature) / 15, 0.3, 1)
        : temperature > maxTemperature ? clamp(1 - (temperature - maxTemperature) / 15, 0.3, 1) : 1;
      const humidityFit = nextHumidityFit(environmentHumidity(rainfall, resources.water), minHumidity, maxHumidity);
      const suitableHabitat = entry.preferredHabitats.reduce((sum, key) => sum + habitats[key], 0);
      const habitatFit = clamp(0.45 + suitableHabitat / 100, 0.3, 1.25);
      const food = clamp(foods[entry.id] * temperatureFit * humidityFit * habitatFit, 0, 1.25);
      const density = clamp(1 - count / entry.capacity, 0, 1);
      const stress = Math.max(0, 1 - food) * 0.04;
      const change = round(count * (entry.growth * food * density - entry.mortality - stress));
      populations[entry.id] = Math.max(0, count + change);
    }

    const fireCooldownElapsed = previous.lastFireDay === null || previous.lastFireDay === undefined ||
      (Number.isSafeInteger(previous.lastFireDay) && day - previous.lastFireDay >= 60);
    const wildfire = resources.water <= 50 && temperature >= 26.5 && resources['island-grass'] >= 35 && fireCooldownElapsed;
    if (wildfire) {
      resources['island-grass'] = Math.max(0, resources['island-grass'] - 18);
      resources.nectar = Math.max(0, resources.nectar - 12);
    }
    const diseaseCooldownElapsed = previous.lastDiseaseDay === null || previous.lastDiseaseDay === undefined ||
      (Number.isSafeInteger(previous.lastDiseaseDay) && day - previous.lastDiseaseDay >= 90);
    const diseaseOutbreak = environmentHumidity(rainfall, resources.water) >= 90 && populations['tree-frog'] >= 45 && diseaseCooldownElapsed;
    if (diseaseOutbreak) populations['tree-frog'] = Math.max(0, round(populations['tree-frog'] * 0.8));

    const migration = migrateDistribution(previous, habitats);
    const next = {
      day,
      season: season.name,
      environment: {
        temperature,
        rainfall,
        humidity: clamp(round(51 + resources.water * 0.32 + rainfall * 0.12)),
        water: round(resources.water),
        waterCycle: {
          infiltration: round(waterCycle.infiltration * 10) / 10,
          runoff: round(waterCycle.runoff * 10) / 10,
          evaporation: round(waterCycle.evaporation * 10) / 10,
          netChange: round(waterCycle.netChange * 10) / 10
        }
      },
      resources: Object.fromEntries(Object.entries(resources).map(([key, value]) => [key, key === 'water' ? round(value * 10) / 10 : round(value)])),
      populations,
      habitats,
      distribution: migration.distribution,
      terrainEdits,
      lastFireDay: wildfire ? day : (previous.lastFireDay ?? null),
      lastDiseaseDay: diseaseOutbreak ? day : (previous.lastDiseaseDay ?? null),
      events: [...previous.events],
      series: [...previous.series]
    };

    const events = [];
    if (previous.season !== season.name) events.push({
      icon: season.icon,
      title: `進入${season.name}`,
      detail: `季節氣候基準：溫度 ${season.temperature}°C、降雨 ${season.rainfall}%；實際天氣仍會逐日變動。`,
      day
    });
    if (migration.migrationActivity >= 24) events.push({ icon: '🧭', title: '物種分布隨棲地調整', detail: '部分族群逐步移向較合適的棲地', day });
    if (previous.resources.water > 50 && next.resources.water <= 50) events.push({ icon: '🏜️', title: '淡水進入乾旱警戒', detail: `存量低於 50%，植被生長會受限。本日補注 ${next.environment.waterCycle.infiltration}，逕流 ${next.environment.waterCycle.runoff}，蒸散 ${next.environment.waterCycle.evaporation}；可增加濕地或森林以保水。`, day });
    if (previous.resources.water < 60 && next.resources.water >= 60) events.push({ icon: '💧', title: '淡水存量恢復', detail: '島嶼水量回到較穩定範圍，注意後續降雨與蒸散變化。', day });
    if (wildfire) events.push({ icon: '🔥', title: '乾旱熱浪引發林地火災', detail: '低水量與高溫讓林地燃燒，草叢覆蓋與花蜜資源減少；接下來需留意動物食物是否充足。', day });
    if (diseaseOutbreak) events.push({ icon: '🦠', title: '濕熱環境出現樹蛙疫病', detail: '連續濕熱條件增加疫病壓力，樹蛙族群下降；後續族群仍會依棲地、食物與天氣變化。', day });
    if (previous.resources['island-grass'] > 25 && next.resources['island-grass'] <= 25) events.push({ icon: '⚠', title: '草原食物資源偏低', detail: '草食與雜食物種的食物供應減少', day });
    if (previous.resources['coastal-seagrass'] > 25 && next.resources['coastal-seagrass'] <= 25) events.push({ icon: '⚠', title: '海岸食物資源偏低', detail: '海草下降，海岸草食者面臨壓力', day });
    if (rainfall >= 82) events.push({ icon: '☂', title: '午後降雨滋養島嶼', detail: `降雨 ${rainfall}%，淡水量回升`, day });
    if (next.resources['island-grass'] - previous.resources['island-grass'] >= 2) events.push({ icon: '🌾', title: '草原植被進入繁盛期', detail: `草叢覆蓋升至 ${next.resources['island-grass']}%`, day });
    for (const entry of species.filter((candidate) => candidate.kind === 'consumer')) {
      const change = populations[entry.id] - previousAnimals[entry.id];
      if (Math.abs(change) >= 2 || (populations[entry.id] === 0 && previousAnimals[entry.id] > 0)) {
        events.push({
          icon: entry.icon,
          title: populations[entry.id] === 0 ? `${entry.name}在島上消失` : `${entry.name}族群${change > 0 ? '增加' : '減少'}`,
          detail: change > 0 ? `食物與棲地條件支持繁殖，增加 ${change} 隻` : `食物、天敵與棲地條件造成族群變化，減少 ${Math.abs(change)} 隻`,
          day
        });
      }
    }
    next.events = [...events, ...next.events].slice(0, 20);
    const metrics = metricsFor(next);
    const totalPopulation = Object.values(populations).reduce((sum, value) => sum + value, 0);
    next.series.push({ day, richness: metrics.richness, stability: metrics.stability, population: totalPopulation, predators: populations['island-lizard'], vegetation: round((next.resources['island-grass'] + next.resources['coastal-seagrass']) / 2) });
    next.series = next.series.slice(-30);
    return next;
  }

  function environmentHumidity(rainfall, water) {
    return clamp(round(51 + water * 0.32 + rainfall * 0.12));
  }

  function nextHumidityFit(value, minimum, maximum) {
    if (value < minimum) return clamp(1 - (minimum - value) / 40, 0.3, 1);
    if (value > maximum) return clamp(1 - (value - maximum) / 40, 0.3, 1);
    return 1;
  }

  function syncHabitat(state, terrainEdits = {}) {
    return { ...state, habitats: habitatFromTerrain(terrainEdits), terrainEdits };
  }

  window.EcosystemSimulation = {
    species,
    metricsFor,
    calculateWaterCycle,
    createInitialState,
    stepSimulation,
    syncHabitat
  };
})();
