(() => {
  const $ = (selector) => document.querySelector(selector);
  let playing = false;
  let speed = 1;
  let timer = null;
  let toastTimer;
  let activeChart = 'richness';
  const EcosystemSimulation = window.EcosystemSimulation;
  const simulationStorageKey = 'archipelago-observatory:tidal-between:simulation:v1';
  const challengeStorageKey = 'archipelago-observatory:tidal-between:challenge:v1';
  let challengeStartDay = null;
  try {
    const savedChallengeDay = Number(localStorage.getItem(challengeStorageKey));
    if (Number.isInteger(savedChallengeDay) && savedChallengeDay > 0) challengeStartDay = savedChallengeDay;
  } catch { /* 挑戰狀態僅作為可選的本機進度 */ }
  let simulationState = EcosystemSimulation.createInitialState();
  let simulationHistory = [];
  let simulationRedoHistory = [];
  let simulationSnapshots = [];
  const terrainColors = { forest: '#356f50', grass: '#a7bc6a', wetland: '#48a9a5', sand: '#dfc783' };
  const terrainNames = { forest: '森林', grass: '草原', wetland: '濕地', sand: '沙灘', unsuitable: '無適宜棲地' };
  const storageKey = 'archipelago-observatory:tidal-between:terrain:v1';
  const tutorialStorageKey = 'archipelago-observatory:tidal-between:tutorial:v1';
  let selectedTerrain = 'forest';
  let selectedCell = null;
  let painting = false;
  let undoStack = [];
  let redoStack = [];
  let terrain = {};

  try {
    terrain = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (!terrain || Array.isArray(terrain) || typeof terrain !== 'object') terrain = {};
  } catch {
    terrain = {};
  }

  try {
    const savedSimulation = JSON.parse(localStorage.getItem(simulationStorageKey) || 'null');
    if (savedSimulation?.state?.populations && Array.isArray(savedSimulation.state.events)) {
      simulationState = savedSimulation.state;
      simulationHistory = Array.isArray(savedSimulation.history) ? savedSimulation.history.slice(-30) : [];
      simulationRedoHistory = Array.isArray(savedSimulation.redoHistory) ? savedSimulation.redoHistory.slice(-30) : [];
      simulationSnapshots = Array.isArray(savedSimulation.snapshots)
        ? savedSimulation.snapshots.filter((snapshot) => snapshot?.id && snapshot.state?.populations && snapshot.terrain && typeof snapshot.terrain === 'object').slice(0, 10)
        : [];
    }
  } catch {
    simulationState = EcosystemSimulation.createInitialState();
    simulationHistory = [];
    simulationRedoHistory = [];
    simulationSnapshots = [];
  }
  simulationState = EcosystemSimulation.syncHabitat(simulationState, terrain);

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function renderDay() {
    const { day, environment, resources, populations, events } = simulationState;
    const metrics = EcosystemSimulation.metricsFor(simulationState);
    $('#day-count').textContent = day;
    $('#timeline-day').textContent = day;
    $('#timeline-progress').style.width = `${Math.min(95, Math.max(3, day % 100))}%`;
    $('#stability').textContent = metrics.stability;
    $('#side-stability').textContent = `${metrics.stability}%`;
    $('#side-progress').style.width = `${metrics.stability}%`;
    $('#sidebar-day').textContent = `熱帶島嶼・第 ${day} 天`;
    $('#species-count').textContent = metrics.richness;
    $('#species-status').textContent = metrics.richness === EcosystemSimulation.species.length ? '生產者與消費者皆有族群' : '有物種族群已消失';
    $('#stability-caption').textContent = metrics.stability >= 75 ? '資源供應良好' : metrics.stability >= 55 ? '部分資源偏低' : '生態系承受壓力';
    $('#temperature').textContent = `${environment.temperature}°`;
    $('#humidity').textContent = environment.humidity;
    $('#rainfall').textContent = environment.rainfall;
    $('#weather-icon').textContent = environment.rainfall >= 82 ? '☂' : '☀';
    $('#weather-summary').textContent = environment.rainfall >= 82 ? '降雨・水氣充足' : '晴朗・微風';
    const seasonIcons = { 春季: '❀', 夏季: '☀', 秋季: '🍂', 冬季: '❄' };
    $('#season-tag').textContent = `${seasonIcons[simulationState.season]} ${simulationState.season}`;
    const strongestChange = events[0];
    $('#sim-message').textContent = strongestChange
      ? `${strongestChange.title}：${strongestChange.detail}`
      : `草叢 ${resources['island-grass']}%・海草 ${resources['coastal-seagrass']}%；生態系持續運作。`;

    const previous = simulationHistory.at(-1);
    document.querySelectorAll('.species-card').forEach((card) => {
      const id = card.dataset.species;
      const profile = EcosystemSimulation.species.find((entry) => entry.id === id);
      const producer = profile?.kind === 'producer';
      const count = producer ? resources[id] : (populations[id] ?? 0);
      card.querySelector('.species-pop b').textContent = count;
      card.querySelector('.species-pop [data-unit]').textContent = profile.unit;
      const oldCount = producer ? previous?.resources[id] : previous?.populations[id];
      const delta = oldCount === undefined ? 0 : count - oldCount;
      const change = card.querySelector('.species-change');
      change.textContent = delta > 0 ? `↗ ${delta}` : delta < 0 ? `↘ ${Math.abs(delta)}` : '—';
      change.classList.toggle('positive', delta > 0);
      change.classList.toggle('negative', delta < 0);
      change.classList.toggle('neutral', delta === 0);
    });
    renderEvents();
    renderTrendChart();
    renderChallenge();
    $('#step-back').disabled = simulationHistory.length === 0;
    $('#redo-day').disabled = simulationRedoHistory.length === 0;
    $('#snapshot-count').textContent = simulationSnapshots.length;
  }

  function renderChallenge() {
    const panel = $('#challenge-panel');
    if (panel.hidden) return;
    const status = $('#challenge-status');
    const description = $('#challenge-description');
    const button = $('#challenge-action');
    const progress = $('#challenge-progress-fill');
    if (challengeStartDay === null) {
      status.textContent = '自由探索・可選任務';
      description.textContent = '從現在起推進 7 天，在最後一天讓至少 6 種物種仍有族群。自由探索隨時可繼續。';
      button.textContent = '接受挑戰';
      progress.style.width = '0%';
      return;
    }
    const elapsed = Math.max(0, simulationState.day - challengeStartDay);
    const fraction = Math.min(1, elapsed / 7);
    progress.style.width = `${fraction * 100}%`;
    if (elapsed < 7) {
      status.textContent = '初階挑戰・進行中';
      description.textContent = `已觀察 ${elapsed} / 7 天；目前有 ${EcosystemSimulation.metricsFor(simulationState).richness} 種物種。再推進 ${7 - elapsed} 天，並在終點保有至少 6 種。`;
      button.textContent = '回到自由探索';
      return;
    }
    const success = EcosystemSimulation.metricsFor(simulationState).richness >= 6;
    status.textContent = success ? '初階挑戰・完成' : '初階挑戰・再試一次';
    description.textContent = success
      ? `觀察滿 7 天，終點仍有 ${EcosystemSimulation.metricsFor(simulationState).richness} 種物種。可以繼續自由探索，或再挑戰一次。`
      : `觀察滿 7 天，但終點只有 ${EcosystemSimulation.metricsFor(simulationState).richness} 種物種。調整棲地後可以重新挑戰。`;
    button.textContent = '再玩一次';
  }

  function saveSimulation() {
    try {
      localStorage.setItem(simulationStorageKey, JSON.stringify({
        state: simulationState,
        history: simulationHistory.slice(-30),
        redoHistory: simulationRedoHistory.slice(-30),
        snapshots: simulationSnapshots.slice(0, 10)
      }));
      return true;
    } catch {
      toast('瀏覽器儲存空間不足，模擬進度未能保存。');
      return false;
    }
  }

  function renderEvents() {
    const list = $('#event-list');
    list.replaceChildren();
    simulationState.events.slice(0, 3).forEach((event) => {
      const row = document.createElement('div');
      row.className = 'event-item';
      const badge = document.createElement('span');
      badge.className = 'event-badge';
      badge.textContent = event.icon;
      const body = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = event.title;
      const detail = document.createElement('p');
      detail.textContent = event.detail;
      body.append(title, detail);
      const time = document.createElement('time');
      time.textContent = `第 ${event.day} 天`;
      row.append(badge, body, time);
      list.appendChild(row);
    });
  }

  function renderTrendChart() {
    const history = simulationState.series.slice(-7);
    if (!history.length) return;

    const settings = {
      richness: {
        primary: '物種多樣性', secondary: '生態穩定度',
        first: (point) => point.richness / EcosystemSimulation.species.length * 100,
        second: (point) => point.stability,
        current: `${EcosystemSimulation.metricsFor(simulationState).richness} / ${EcosystemSimulation.species.length} 種`
      },
      population: {
        primary: '動物族群總數', secondary: '掠食者數量',
        first: (point) => point.population / 310 * 100,
        second: (point) => point.predators / 25 * 100,
        current: `${pointPopulation(simulationState)} 隻動物`
      },
      vegetation: {
        primary: '平均植被覆蓋', secondary: '花蜜資源',
        first: (point) => point.vegetation,
        second: () => simulationState.resources.nectar,
        current: `${Math.round((simulationState.resources['island-grass'] + simulationState.resources['coastal-seagrass']) / 2)}% 平均覆蓋`
      }
    }[activeChart];
    const line = (values) => values.map((value, index) => `${index ? 'L' : 'M'} ${(index * 450 / Math.max(1, values.length - 1)).toFixed(1)} ${(131 - Math.max(0, Math.min(100, value)) * 1.1).toFixed(1)}`).join(' ');
    const primaryValues = history.map(settings.first);
    const secondaryValues = history.map(settings.second);
    const primaryPath = line(primaryValues);
    const secondaryPath = line(secondaryValues);
    $('#chart-primary').setAttribute('d', primaryPath);
    $('#chart-secondary').setAttribute('d', secondaryPath);
    $('#chart-area').setAttribute('d', history.length > 1 ? `${primaryPath} L450 150 L0 150Z` : 'M0 150Z');
    const point = $('#chart-point');
    if (history.length === 1) {
      point.setAttribute('cx', 450);
      point.setAttribute('cy', 131 - Math.max(0, Math.min(100, primaryValues[0])) * 1.1);
      point.setAttribute('visibility', 'visible');
    } else {
      point.setAttribute('visibility', 'hidden');
    }
    $('#legend-primary').textContent = settings.primary;
    $('#legend-secondary').textContent = settings.secondary;
    $('#chart-current-value').textContent = settings.current;
    const positions = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round((history.length - 1) * fraction));
    document.querySelectorAll('[data-chart-day]').forEach((label, index) => {
      label.textContent = `第 ${history[positions[index]].day} 天`;
    });
    const first = history[0];
    const last = history[history.length - 1];
    const delta = last.richness - first.richness;
    $('#insight-text').textContent = activeChart === 'richness'
      ? `近 7 日觀察到 ${delta === 0 ? '物種數量維持穩定' : `物種數量${delta > 0 ? '增加' : '減少'} ${Math.abs(delta)} 種`}；圖表會隨模擬推進更新。`
      : activeChart === 'population'
        ? `目前掠食者 ${simulationState.populations['island-lizard']} 隻；族群會受食物供應與天敵關係影響。`
        : `草原覆蓋 ${simulationState.resources['island-grass']}%，海草覆蓋 ${simulationState.resources['coastal-seagrass']}%。`;
  }

  function pointPopulation(state) {
    return Object.values(state.populations).reduce((sum, count) => sum + count, 0);
  }

  function advanceDay() {
    simulationHistory.push(JSON.parse(JSON.stringify(simulationState)));
    simulationHistory = simulationHistory.slice(-30);
    simulationRedoHistory = [];
    simulationState = EcosystemSimulation.stepSimulation(simulationState, terrain);
    saveSimulation();
    renderDay();
  }

  function pause() {
    playing = false;
    clearInterval(timer);
    $('#play-simulation').textContent = '▶';
    $('#play-simulation').classList.remove('playing');
    $('#play-simulation').setAttribute('aria-label', '播放模擬');
  }

  function updateHistoryButtons() {
    $('#undo-terrain').disabled = undoStack.length === 0;
    $('#redo-terrain').disabled = redoStack.length === 0;
  }

  function saveTerrain() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(terrain));
      $('#editor-save-state').textContent = '已儲存於此裝置';
      return true;
    } catch {
      $('#editor-save-state').textContent = '無法儲存';
      return false;
    }
  }

  function renderTerrain() {
    document.querySelectorAll('#terrain-layer [data-cell]').forEach((cell) => {
      const value = terrain[cell.dataset.cell];
      cell.setAttribute('fill', terrainColors[value] || 'transparent');
      cell.dataset.terrain = value || '';
    });
  }

  function renderSelectedCell() {
    const outline = $('#selected-cell');
    if (!selectedCell) {
      outline.setAttribute('visibility', 'hidden');
      return;
    }
    const [column, row] = selectedCell.split('-').map(Number);
    outline.setAttribute('x', column * 40);
    outline.setAttribute('y', row * 39);
    outline.setAttribute('visibility', 'visible');
    const tileName = terrainNames[terrain[selectedCell]] || '原始地貌';
    $('#map-hint').textContent = `已選取地塊 ${column + 1} · ${row + 1} · ${tileName}`;
  }

  function updateTerrainCell(cellId, value) {
    if (terrain[cellId] === value) return false;
    const hadSimulationRedo = simulationRedoHistory.length > 0;
    simulationRedoHistory = [];
    if (value) terrain[cellId] = value;
    else delete terrain[cellId];
    const cell = document.querySelector(`#terrain-layer [data-cell="${cellId}"]`);
    if (cell) {
      cell.setAttribute('fill', terrainColors[value] || 'transparent');
      cell.dataset.terrain = value || '';
    }
    renderSelectedCell();
    if (hadSimulationRedo) saveSimulation();
    return true;
  }

  function chooseCell(cellId) {
    selectedCell = cellId;
    renderSelectedCell();
  }

  function paintCell(cellId) {
    const previous = terrain[cellId] || '';
    if (previous === selectedTerrain) return;
    undoStack.push({ cellId, previous, next: selectedTerrain });
    redoStack = [];
    simulationRedoHistory = [];
    updateTerrainCell(cellId, selectedTerrain);
    chooseCell(cellId);
    saveTerrain();
    updateHistoryButtons();
  }

  function setEditing(enabled) {
    if (enabled && playing) pause();
    const mapPanel = $('.map-panel');
    mapPanel.classList.toggle('editing', enabled);
    $('#editor-toolbar').hidden = !enabled;
    $('#edit-island').setAttribute('aria-pressed', String(enabled));
    $('#edit-island').querySelector('span').textContent = enabled ? '完成編輯' : '編輯島嶼';
    $('#observe-map').innerHTML = enabled ? '完成編輯 <span>✓</span>' : '開始觀察 <span>→</span>';
    $('#map-hint').textContent = enabled
      ? '選擇地形筆刷，再點擊或拖曳地圖繪製；Ctrl+Z 可復原'
      : '📍 點選地圖上的生物，查看棲地觀察';
    toast(enabled ? '編輯模式已開啟' : '島嶼地形已儲存');
  }

  const terrainLayer = $('#terrain-layer');
  for (let row = 0; row < 10; row += 1) {
    for (let column = 0; column < 18; column += 1) {
      const cell = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      cell.setAttribute('x', column * 40);
      cell.setAttribute('y', row * 39);
      cell.setAttribute('width', 40);
      cell.setAttribute('height', 39);
      cell.setAttribute('fill', 'transparent');
      cell.setAttribute('fill-opacity', '.55');
      cell.dataset.cell = `${column}-${row}`;
      terrainLayer.appendChild(cell);
    }
  }
  renderTerrain();

  document.querySelectorAll('.terrain-tool').forEach((button) => button.addEventListener('click', () => {
    selectedTerrain = button.dataset.terrain;
    document.querySelectorAll('.terrain-tool').forEach((tool) => {
      const selected = tool === button;
      tool.classList.toggle('selected', selected);
      tool.setAttribute('aria-pressed', String(selected));
    });
    $('#map-hint').textContent = `目前筆刷：${terrainNames[selectedTerrain]}；點擊或拖曳地圖繪製`;
  }));

  terrainLayer.addEventListener('pointerdown', (event) => {
    const cell = event.target.closest('[data-cell]');
    if (!cell || !$('.map-panel').classList.contains('editing')) return;
    event.preventDefault();
    painting = true;
    chooseCell(cell.dataset.cell);
    paintCell(cell.dataset.cell);
    event.target.setPointerCapture?.(event.pointerId);
  });
  terrainLayer.addEventListener('pointermove', (event) => {
    if (!painting) return;
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('#terrain-layer [data-cell]');
    if (cell) paintCell(cell.dataset.cell);
  });
  terrainLayer.addEventListener('pointerup', () => {
    if (!painting) return;
    painting = false;
    simulationState = EcosystemSimulation.syncHabitat(simulationState, terrain);
    saveSimulation();
    renderDay();
  });
  terrainLayer.addEventListener('pointercancel', () => { painting = false; });

  $('#undo-terrain').addEventListener('click', () => {
    const edit = undoStack.pop();
    if (!edit) return;
    updateTerrainCell(edit.cellId, edit.previous);
    redoStack.push(edit);
    saveTerrain();
    updateHistoryButtons();
  });
  $('#redo-terrain').addEventListener('click', () => {
    const edit = redoStack.pop();
    if (!edit) return;
    updateTerrainCell(edit.cellId, edit.next);
    undoStack.push(edit);
    saveTerrain();
    updateHistoryButtons();
  });
  document.addEventListener('keydown', (event) => {
    if (!$('.map-panel').classList.contains('editing') || !(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 'z') {
      event.preventDefault();
      (event.shiftKey ? $('#redo-terrain') : $('#undo-terrain')).click();
    } else if (event.key.toLowerCase() === 'y') {
      event.preventDefault();
      $('#redo-terrain').click();
    }
  });

  $('#play-simulation').addEventListener('click', () => {
    if (playing) return pause();
    playing = true;
    $('#play-simulation').textContent = 'Ⅱ';
    $('#play-simulation').classList.add('playing');
    $('#play-simulation').setAttribute('aria-label', '暫停模擬');
    timer = setInterval(advanceDay, 2400 / speed);
  });
  $('#step-forward').addEventListener('click', advanceDay);
  $('#step-back').addEventListener('click', () => {
    if (playing) pause();
    const previous = simulationHistory.pop();
    if (!previous) return toast('目前已到這次模擬的最早紀錄。');
    simulationRedoHistory.push(JSON.parse(JSON.stringify(simulationState)));
    simulationRedoHistory = simulationRedoHistory.slice(-30);
    simulationState = EcosystemSimulation.syncHabitat(previous, terrain);
    saveSimulation();
    renderDay();
  });
  $('#redo-day').addEventListener('click', () => {
    if (playing) pause();
    const next = simulationRedoHistory.pop();
    if (!next) return toast('目前沒有可重做的模擬日。');
    simulationHistory.push(JSON.parse(JSON.stringify(simulationState)));
    simulationHistory = simulationHistory.slice(-30);
    simulationState = EcosystemSimulation.syncHabitat(next, terrain);
    saveSimulation();
    renderDay();
  });
  $('#speed-button').addEventListener('click', () => {
    speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
    $('#speed-button').innerHTML = `${speed}× <span>⌄</span>`;
    if (playing) { clearInterval(timer); timer = setInterval(advanceDay, 2400 / speed); }
  });
  document.querySelectorAll('.chart-mode').forEach((button) => button.addEventListener('click', () => {
    activeChart = button.dataset.chart;
    document.querySelectorAll('.chart-mode').forEach((mode) => {
      const selected = mode === button;
      mode.classList.toggle('selected', selected);
      mode.setAttribute('aria-pressed', String(selected));
    });
    renderTrendChart();
  }));
  $('#layer-button').addEventListener('click', () => {
    const label = $('#layer-label');
    label.textContent = label.textContent === '地形圖層' ? '物種分布' : '地形圖層';
    document.querySelector('.map-creatures').style.opacity = label.textContent === '物種分布' ? '1' : '.72';
    toast(`已切換至${label.textContent}`);
  });
  $('#expand-map').addEventListener('click', () => $('.map-panel').classList.toggle('map-expanded'));
  $('#observe-map').addEventListener('click', () => setEditing(!$('.map-panel').classList.contains('editing')));
  $('#edit-island').addEventListener('click', () => setEditing(!$('.map-panel').classList.contains('editing')));
  $('#all-events').addEventListener('click', () => toast('目前顯示最近 3 則島嶼紀錄。'));
  $('#open-species').addEventListener('click', () => toast('物種圖鑑正在整理中，先看看今日觀察吧。'));
  document.querySelectorAll('.species-card').forEach((card) => card.addEventListener('click', () => {
    const name = card.querySelector('strong').textContent;
    const id = card.dataset.species;
    const profile = EcosystemSimulation.species.find((entry) => entry.id === id);
    const shares = simulationState.distribution[id] || {};
    const habitats = Object.entries(shares).sort((left, right) => right[1] - left[1]).map(([habitat, value]) => `${terrainNames[habitat] || habitat} ${value}%`).join('、');
    toast(`${name}・${profile.role}・${profile.kind === 'producer' ? '棲地覆蓋 ' + simulationState.resources[id] + '%' : '族群 ' + simulationState.populations[id] + ' 隻'}・偏好棲地：${habitats || profile.habitat}`);
  }));
  document.querySelectorAll('.map-zoom button').forEach((button, index) => button.addEventListener('click', () => {
    const map = $('.island-map');
    const current = Number(map.dataset.zoom || 1);
    map.dataset.zoom = index === 0 ? Math.min(1.25, current + .08) : Math.max(.92, current - .08);
    map.style.transform = `scale(${map.dataset.zoom})`;
  }));

  const tutorialDialog = $('#tutorial-dialog');
  const tutorialSteps = [
    ['先認識你的島', '這座範例島已有森林、濕地與海岸，也住著 8 種生產者和動物。地圖、物種卡和環境指標會一起呈現目前狀態。'],
    ['試著改變棲地', '選「編輯島嶼」，再挑一種地形筆刷，點擊或拖曳地圖來繪製。地形變更會影響模擬中的棲地比例；完成後可按復原或重做。'],
    ['讓時間往前走', '用播放按鈕連續觀察，或按右側箭頭一次推進一天。模擬會更新氣候、資源和族群；倒退按鈕可回到最近的紀錄。'],
    ['閱讀生態變化', '查看島嶼日誌了解事件原因，在下方切換多樣性、動物族群和植被趨勢。點選物種卡，可查看牠的族群與偏好棲地。']
  ];
  let tutorialStep = 0;
  function completeTutorial() {
    try { localStorage.setItem(tutorialStorageKey, 'completed'); } catch { /* 仍可關閉教學 */ }
    tutorialDialog.close();
  }
  function renderTutorialStep() {
    const [title, copy] = tutorialSteps[tutorialStep];
    $('#tutorial-step-label').textContent = `第 ${tutorialStep + 1} 步，共 ${tutorialSteps.length} 步`;
    $('#tutorial-progress-fill').style.width = `${((tutorialStep + 1) / tutorialSteps.length) * 100}%`;
    $('#tutorial-title').textContent = title;
    $('#tutorial-copy').textContent = copy;
    $('#tutorial-next').textContent = tutorialStep === tutorialSteps.length - 1 ? '開始探索 ✓' : '下一步 →';
  }
  function openTutorial() {
    tutorialStep = 0;
    renderTutorialStep();
    if (!tutorialDialog.open) tutorialDialog.showModal();
  }
  $('#open-tutorial').addEventListener('click', openTutorial);
  $('#open-challenge').addEventListener('click', () => {
    $('#challenge-panel').hidden = false;
    renderChallenge();
    $('#challenge-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $('#challenge-action').addEventListener('click', () => {
    const elapsed = challengeStartDay === null ? null : simulationState.day - challengeStartDay;
    if (elapsed !== null && elapsed < 7) {
      challengeStartDay = null;
      try { localStorage.removeItem(challengeStorageKey); } catch { /* 當次可繼續自由探索 */ }
      toast('已回到自由探索，模擬進度保留。');
    } else {
      challengeStartDay = simulationState.day;
      try { localStorage.setItem(challengeStorageKey, String(challengeStartDay)); } catch { /* 當次挑戰仍可進行 */ }
      toast('初階挑戰開始：觀察接下來 7 天。');
    }
    renderChallenge();
  });
  const snapshotsDialog = $('#snapshots-dialog');
  const snapshotList = $('#snapshot-list');
  let snapshotSequence = 0;
  function renderSnapshots() {
    snapshotList.replaceChildren();
    if (!simulationSnapshots.length) {
      const empty = document.createElement('p');
      empty.className = 'storage-note';
      empty.textContent = '還沒有快照。推進到想保留的模擬時間點後，按「建立快照」。';
      snapshotList.appendChild(empty);
      return;
    }
    simulationSnapshots.forEach((snapshot) => {
      const row = document.createElement('div');
      row.className = 'snapshot-row';
      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = `第 ${snapshot.day} 天`;
      const created = document.createElement('small');
      created.textContent = new Date(snapshot.createdAt).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' });
      info.append(title, created);
      const actions = document.createElement('div');
      actions.className = 'snapshot-actions';
      const restore = document.createElement('button');
      restore.className = 'challenge-action';
      restore.textContent = '載入';
      restore.dataset.snapshotAction = 'restore';
      restore.dataset.snapshotId = snapshot.id;
      const remove = document.createElement('button');
      remove.className = 'challenge-action destructive-action';
      remove.textContent = '刪除';
      remove.dataset.snapshotAction = 'delete';
      remove.dataset.snapshotId = snapshot.id;
      actions.append(restore, remove);
      row.append(info, actions);
      snapshotList.appendChild(row);
    });
  }
  function createSnapshot() {
    if (simulationSnapshots.length >= 10) {
      toast('快照已達 10 份上限，請先刪除一份再建立。');
      return;
    }
    const snapshot = {
      id: `${Date.now()}-${snapshotSequence++}`,
      day: simulationState.day,
      createdAt: new Date().toISOString(),
      state: JSON.parse(JSON.stringify(simulationState)),
      terrain: JSON.parse(JSON.stringify(terrain))
    };
    simulationSnapshots.unshift(snapshot);
    if (!saveSimulation()) {
      simulationSnapshots.shift();
      return;
    }
    renderDay();
    renderSnapshots();
    toast(`已保存第 ${snapshot.day} 天快照。`);
  }
  $('#create-snapshot').addEventListener('click', createSnapshot);
  $('#manage-snapshots').addEventListener('click', () => {
    renderSnapshots();
    snapshotsDialog.showModal();
  });
  $('#close-snapshots').addEventListener('click', () => snapshotsDialog.close());
  snapshotList.addEventListener('click', (event) => {
    const action = event.target.closest('[data-snapshot-action]');
    if (!action) return;
    const index = simulationSnapshots.findIndex((snapshot) => snapshot.id === action.dataset.snapshotId);
    if (index < 0) return;
    if (action.dataset.snapshotAction === 'delete') {
      if (!window.confirm(`刪除第 ${simulationSnapshots[index].day} 天的快照？此操作無法復原。`)) return;
      const [removed] = simulationSnapshots.splice(index, 1);
      if (!saveSimulation()) simulationSnapshots.splice(index, 0, removed);
      renderSnapshots();
      renderDay();
      return;
    }
    const snapshot = simulationSnapshots[index];
    if (!window.confirm(`載入第 ${snapshot.day} 天的快照？目前的模擬與地形會被替換。`)) return;
    pause();
    simulationState = JSON.parse(JSON.stringify(snapshot.state));
    terrain = JSON.parse(JSON.stringify(snapshot.terrain));
    simulationHistory = [];
    simulationRedoHistory = [];
    undoStack = [];
    redoStack = [];
    renderTerrain();
    const terrainSaved = saveTerrain();
    const simulationSaved = saveSimulation();
    updateHistoryButtons();
    snapshotsDialog.close();
    renderDay();
    toast(terrainSaved && simulationSaved ? `已載入第 ${snapshot.day} 天快照。` : '快照已載入目前畫面，但部分資料未能保存。');
  });
  const storageDialog = $('#storage-dialog');
  const resetDialog = $('#reset-dialog');
  let pendingReset = null;
  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function validTerrainData(value) {
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
    for (const profile of EcosystemSimulation.species) {
      const values = profile.kind === 'producer' ? state.resources : state.populations;
      const amount = values[profile.id];
      if (!Number.isFinite(amount) || amount < 0 || amount > (profile.kind === 'producer' ? 100 : 10000) || (profile.kind !== 'producer' && !Number.isSafeInteger(amount))) return false;
    }
    for (const key of ['nectar', 'water']) {
      if (!Number.isFinite(state.resources[key]) || state.resources[key] < 0 || state.resources[key] > 100) return false;
    }
    if (!isRecord(state.distribution)) return false;
    for (const profile of EcosystemSimulation.species.filter((entry) => entry.kind === 'consumer')) {
      const shares = state.distribution[profile.id];
      if (!isRecord(shares) || !Object.values(shares).every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) return false;
      const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
      if (Math.abs(total - 100) > 1) return false;
    }
    if (!Array.isArray(state.events) || state.events.length > 20 || !state.events.every((event) => isRecord(event) && typeof event.title === 'string' && typeof event.detail === 'string' && typeof event.icon === 'string' && Number.isSafeInteger(event.day))) return false;
    if (!Array.isArray(state.series) || state.series.length < 1 || state.series.length > 30) return false;
    const seriesFields = ['day', 'richness', 'stability', 'population', 'predators', 'vegetation'];
    return state.series.every((point) => isRecord(point) && Number.isSafeInteger(point.day) && point.day > 0 && seriesFields.slice(1).every((field) => Number.isFinite(point[field]) && point[field] >= 0));
  }
  function validateSaveFile(data) {
    if (!isRecord(data) || data.format !== 'archipelago-observatory-save' || data.formatVersion !== 1) return '不支援這個存檔格式或版本。';
    if (!validTerrainData(data.terrain)) return '地形資料不完整或包含無效格子。';
    const sim = data.simulation;
    if (!isRecord(sim) || !validSimulationState(sim.state)) return '模擬狀態不完整或數值超出範圍。';
    const validStateList = (states) => Array.isArray(states) && states.length <= 30 && states.every(validSimulationState);
    if (!validStateList(sim.history || []) || !validStateList(sim.redoHistory || [])) return '模擬回退紀錄格式有誤。';
    if (!Array.isArray(sim.snapshots || []) || sim.snapshots.length > 10 || !(sim.snapshots || []).every((snapshot) =>
      isRecord(snapshot) && typeof snapshot.id === 'string' && Number.isSafeInteger(snapshot.day) && snapshot.day === snapshot.state?.day && validSimulationState(snapshot.state) && validTerrainData(snapshot.terrain) && Number.isFinite(Date.parse(snapshot.createdAt)))) return '快照資料格式有誤。';
    if (data.challengeStartDay !== null && (!Number.isSafeInteger(data.challengeStartDay) || data.challengeStartDay < 1 || data.challengeStartDay > 1000000)) return '挑戰進度格式有誤。';
    return '';
  }
  function renderStorageSummary() {
    $('#storage-summary').textContent = `模擬進度：第 ${simulationState.day} 天；自訂地形：${Object.keys(terrain).length} 格。資料會自動保存在目前瀏覽器的本機儲存空間。`;
  }
  function requestReset(kind) {
    pendingReset = kind;
    $('#reset-copy').textContent = kind === 'simulation'
      ? '這會把模擬日數、族群、資源和趨勢恢復為範例起始狀態，但會保留你畫過的地形。此操作無法復原。'
      : '這會清除所有自訂地形筆刷，恢復範例島外觀；目前模擬進度會保留並依範例地形重新計算。此操作無法復原。';
    resetDialog.showModal();
  }
  $('#open-storage').addEventListener('click', () => {
    renderStorageSummary();
    storageDialog.showModal();
  });
  $('#close-storage').addEventListener('click', () => storageDialog.close());
  $('#save-now').addEventListener('click', () => {
    const terrainSaved = saveTerrain();
    const simulationSaved = saveSimulation();
    renderStorageSummary();
    toast(terrainSaved && simulationSaved ? '已保存目前的地形與模擬進度。' : '部分資料未能保存，請檢查瀏覽器儲存空間。');
  });
  $('#export-save').addEventListener('click', () => {
    const exportData = {
      format: 'archipelago-observatory-save',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      terrain: JSON.parse(JSON.stringify(terrain)),
      simulation: {
        state: JSON.parse(JSON.stringify(simulationState)),
        history: JSON.parse(JSON.stringify(simulationHistory.slice(-30))),
        redoHistory: JSON.parse(JSON.stringify(simulationRedoHistory.slice(-30))),
        snapshots: JSON.parse(JSON.stringify(simulationSnapshots.slice(0, 10)))
      },
      challengeStartDay
    };
    const file = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `archipelago-save-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已匯出島嶼 JSON 存檔。');
  });
  const importFile = $('#import-file');
  $('#import-save').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    importFile.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast('存檔超過 8 MB，無法匯入。');
    let imported;
    try { imported = JSON.parse(await file.text()); }
    catch { return toast('無法讀取 JSON 存檔，請檢查檔案內容。'); }
    const validationMessage = validateSaveFile(imported);
    if (validationMessage) return toast(validationMessage);
    if (!window.confirm('匯入會取代目前瀏覽器的地形、模擬、快照與挑戰進度。建議先匯出備份。要繼續嗎？')) return;

    const importedTerrain = Object.fromEntries(Object.entries(imported.terrain));
    const importedState = EcosystemSimulation.syncHabitat(imported.simulation.state, importedTerrain);
    const importedSnapshots = (imported.simulation.snapshots || []).map((snapshot) => ({
      ...snapshot,
      state: EcosystemSimulation.syncHabitat(snapshot.state, snapshot.terrain)
    }));
    const importedRecord = {
      state: importedState,
      history: (imported.simulation.history || []).slice(-30),
      redoHistory: (imported.simulation.redoHistory || []).slice(-30),
      snapshots: importedSnapshots.slice(0, 10)
    };
    const previousValues = {};
    try {
      previousValues.terrain = localStorage.getItem(storageKey);
      previousValues.simulation = localStorage.getItem(simulationStorageKey);
      previousValues.challenge = localStorage.getItem(challengeStorageKey);
    } catch {
      return toast('無法存取瀏覽器本機儲存空間，未匯入存檔。');
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(importedTerrain));
      localStorage.setItem(simulationStorageKey, JSON.stringify(importedRecord));
      if (imported.challengeStartDay === null) localStorage.removeItem(challengeStorageKey);
      else localStorage.setItem(challengeStorageKey, String(imported.challengeStartDay));
    } catch {
      try {
        for (const [key, value] of [[storageKey, previousValues.terrain], [simulationStorageKey, previousValues.simulation], [challengeStorageKey, previousValues.challenge]]) {
          if (value === null || value === undefined) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        }
      } catch { /* best-effort rollback when browser storage is unavailable */ }
      return toast('匯入未完成，原本存檔未能安全替換。');
    }

    pause();
    terrain = importedTerrain;
    simulationState = importedState;
    simulationHistory = importedRecord.history;
    simulationRedoHistory = importedRecord.redoHistory;
    simulationSnapshots = importedSnapshots;
    challengeStartDay = imported.challengeStartDay;
    undoStack = [];
    redoStack = [];
    selectedCell = null;
    $('#selected-cell').setAttribute('visibility', 'hidden');
    renderTerrain();
    updateHistoryButtons();
    storageDialog.close();
    renderDay();
    toast('島嶼存檔已匯入。');
  });
  $('#restart-simulation').addEventListener('click', () => requestReset('simulation'));
  $('#restore-terrain').addEventListener('click', () => requestReset('terrain'));
  $('#cancel-reset').addEventListener('click', () => { pendingReset = null; resetDialog.close(); });
  $('#confirm-reset').addEventListener('click', () => {
    if (pendingReset === 'simulation') {
      pause();
      simulationState = EcosystemSimulation.syncHabitat(EcosystemSimulation.createInitialState(), terrain);
      simulationHistory = [];
      simulationRedoHistory = [];
      challengeStartDay = null;
      try { localStorage.removeItem(challengeStorageKey); } catch { /* 模擬仍可重設 */ }
      saveSimulation();
      toast('模擬已重新開始，自訂地形已保留。');
    } else if (pendingReset === 'terrain') {
      terrain = {};
      undoStack = [];
      redoStack = [];
      simulationRedoHistory = [];
      selectedCell = null;
      $('#selected-cell').setAttribute('visibility', 'hidden');
      renderTerrain();
      saveTerrain();
      updateHistoryButtons();
      simulationState = EcosystemSimulation.syncHabitat(simulationState, terrain);
      saveSimulation();
      toast('自訂地形已清除，已恢復範例島。');
    }
    pendingReset = null;
    resetDialog.close();
    storageDialog.close();
    renderDay();
  });
  $('#skip-tutorial').addEventListener('click', completeTutorial);
  $('#tutorial-next').addEventListener('click', () => {
    if (tutorialStep === tutorialSteps.length - 1) return completeTutorial();
    tutorialStep += 1;
    renderTutorialStep();
  });
  tutorialDialog.addEventListener('cancel', () => {
    try { localStorage.setItem(tutorialStorageKey, 'completed'); } catch { /* 仍可關閉教學 */ }
  });
  try {
    if (localStorage.getItem(tutorialStorageKey) !== 'completed') openTutorial();
  } catch { openTutorial(); }

  renderDay();
})();
