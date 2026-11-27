(() => {
  const $ = (selector) => document.querySelector(selector);
  let playing = false;
  let speed = 1;
  let timer = null;
  let toastTimer;
  let activeChart = 'richness';
  const EcosystemSimulation = window.EcosystemSimulation;
  const simulationStorageKey = 'archipelago-observatory:tidal-between:simulation:v1';
  let simulationState = EcosystemSimulation.createInitialState();
  let simulationHistory = [];
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
    }
  } catch {
    simulationState = EcosystemSimulation.createInitialState();
    simulationHistory = [];
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
  }

  function saveSimulation() {
    try {
      localStorage.setItem(simulationStorageKey, JSON.stringify({ state: simulationState, history: simulationHistory.slice(-30) }));
    } catch {
      toast('瀏覽器儲存空間不足，模擬進度未能保存。');
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
    } catch {
      $('#editor-save-state').textContent = '無法儲存';
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
    if (value) terrain[cellId] = value;
    else delete terrain[cellId];
    const cell = document.querySelector(`#terrain-layer [data-cell="${cellId}"]`);
    if (cell) {
      cell.setAttribute('fill', terrainColors[value] || 'transparent');
      cell.dataset.terrain = value || '';
    }
    renderSelectedCell();
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
    const previous = simulationHistory.pop();
    if (!previous) return toast('目前已到這次模擬的最早紀錄。');
    simulationState = EcosystemSimulation.syncHabitat(previous, terrain);
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
