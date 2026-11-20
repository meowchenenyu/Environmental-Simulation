(() => {
  const $ = (selector) => document.querySelector(selector);
  let day = 24;
  let playing = false;
  let speed = 1;
  let timer = null;
  let stability = 78;
  let toastTimer;
  const terrainColors = { forest: '#356f50', grass: '#a7bc6a', wetland: '#48a9a5', sand: '#dfc783' };
  const terrainNames = { forest: '森林', grass: '草原', wetland: '濕地', sand: '沙灘' };
  const storageKey = 'archipelago-observatory:tidal-between:terrain:v1';
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

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function renderDay() {
    $('#day-count').textContent = day;
    $('#timeline-day').textContent = day;
    $('#timeline-progress').style.width = `${Math.min(95, Math.max(3, day))}%`;
    const messages = [
      '島上的生命正穩定成長，繼續觀察吧。',
      '暖流帶來豐富水氣，植物生長加快了。',
      '林間傳來鳥鳴，幾個新巢正在形成。',
      '午後降雨滋養濕地，蛙類活動增加。',
      '海岸潮間帶出現新的覓食痕跡。'
    ];
    $('#sim-message').textContent = messages[day % messages.length];
    if (day % 3 === 0) {
      stability = Math.min(99, stability + 1);
      $('#stability').textContent = stability;
      $('#side-stability').textContent = `${stability}%`;
    }
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
  terrainLayer.addEventListener('pointerup', () => { painting = false; });
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
    timer = setInterval(() => { day += 1; renderDay(); }, 2400 / speed);
  });
  $('#step-forward').addEventListener('click', () => { day += 1; renderDay(); });
  $('#step-back').addEventListener('click', () => { day = Math.max(1, day - 1); renderDay(); });
  $('#speed-button').addEventListener('click', () => {
    speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
    $('#speed-button').innerHTML = `${speed}× <span>⌄</span>`;
    if (playing) { clearInterval(timer); timer = setInterval(() => { day += 1; renderDay(); }, 2400 / speed); }
  });
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
    toast(`正在觀察：${name}。族群狀態穩定。`);
  }));
  document.querySelectorAll('.map-zoom button').forEach((button, index) => button.addEventListener('click', () => {
    const map = $('.island-map');
    const current = Number(map.dataset.zoom || 1);
    map.dataset.zoom = index === 0 ? Math.min(1.25, current + .08) : Math.max(.92, current - .08);
    map.style.transform = `scale(${map.dataset.zoom})`;
  }));
})();
