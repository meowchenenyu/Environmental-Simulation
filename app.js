(() => {
  const $ = (selector) => document.querySelector(selector);
  let day = 24;
  let playing = false;
  let speed = 1;
  let timer = null;
  let stability = 78;
  let toastTimer;

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
  $('#observe-map').addEventListener('click', () => toast('觀察模式已開啟，點選物種卡片查看島嶼居民。'));
  $('#edit-island').addEventListener('click', () => toast('島嶼編輯工具即將推出。'));
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
