(() => {
'use strict';
    const STORAGE_KEY = "daily-checkin";
    function parseDate(dateStr) {
      if (!dateStr) return null;
      return new Date(`${dateStr}T00:00:00`);
    }

    function diffDays(fromStr, toStr) {
      const from = parseDate(fromStr);
      const to = parseDate(toStr);
      if (!from || !to) return null;
      const diff = to.getTime() - from.getTime();
      return Math.round(diff / 86400000);
    }


const $ = id => document.getElementById(id);
const emptyState = () => ({totalDays: 0, streakDays: 0, lastDate: '', history: []});
let temporaryState = emptyState();
let storageAvailable = true;
let showAllHistory = false;
function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyState();
    return temporaryState = {...parsed,
      totalDays: Number.isInteger(parsed.totalDays) && parsed.totalDays >= 0 ? parsed.totalDays : 0,
      streakDays: Number.isInteger(parsed.streakDays) && parsed.streakDays >= 0 ? parsed.streakDays : 0,
      lastDate: typeof parsed.lastDate === 'string' ? parsed.lastDate : '',
      history: Array.isArray(parsed.history) ? parsed.history.filter(item => item && typeof item.date === 'string') : []
    };
  } catch (error) {
    if (error instanceof SyntaxError) return emptyState();
    storageAvailable = false;
    return temporaryState;
  }
}
function saveState(state) {
  temporaryState = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
}
function renderHistory(history) {
  const list = $('history-list');
  list.replaceChildren();
  $('history-count').textContent = `${history.length} 次记录`;
  $('history-toggle').hidden = history.length <= 7;
  $('history-toggle').setAttribute('aria-expanded', String(showAllHistory));
  $('history-toggle').textContent = showAllHistory ? '收起记录 ↑' : `展开全部（${history.length}）↓`;
  if (!history.length) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = '第一支签，还在等你来抽。';
    list.appendChild(empty);
    return;
  }
  (showAllHistory ? history : history.slice(0,7)).forEach(item => {
    const li = document.createElement('li');
    li.className = 'checkin-history-item';
    const date = document.createElement('time');
    date.dateTime = item.date;
    date.textContent = item.date.replaceAll('-', '.');
    const copy = document.createElement('div');
    const level = document.createElement('strong');
    level.textContent = item.level || '今日签';
    const text = document.createElement('p');
    text.textContent = item.text || '';
    copy.append(level, text);
    li.append(date, copy);
    list.appendChild(li);
  });
}
function render() {
  const today = getToday();
  const state = storageAvailable ? loadState() : temporaryState;
  const fortuneToday = state.history.find(item => item.date === today);
  const checkedInToday = state.lastDate === today || !!fortuneToday;
  const gap = diffDays(state.lastDate, today);
  $('total-days').textContent = state.totalDays;
  $('streak-days').textContent = gap !== null && gap > 1 ? 0 : state.streakDays;
  $('checkin-btn').disabled = checkedInToday;
  $('draw-label').textContent = checkedInToday ? '今日已签到' : '签到 · 抽一支签';
  $('draw-caption').textContent = checkedInToday ? '明天再来，继续积攒小幸运。' : '每天一次，看看今天的小惊喜。';
  $('fortune-date').textContent = today.replaceAll('-', '.');
  $('fortune-date').dateTime = today;
  $('fortune-level').textContent = fortuneToday?.level || '签筒里藏着小惊喜';
  $('fortune-text').textContent = fortuneToday?.text || '点点旁边的抽签盒，让今天也有一点期待。';
  const image = $('fortune-image');
  image.hidden = !fortuneToday?.image;
  if (fortuneToday?.image && image.getAttribute('src') !== fortuneToday.image) image.src = fortuneToday.image;
  $('fortune-placeholder').hidden = !!fortuneToday?.image;
  $('fortune-details').hidden = !fortuneToday;
  $('fortune-yi').textContent = fortuneToday?.auspicious || '—';
  $('fortune-ji').textContent = fortuneToday?.inauspicious || '—';
  $('fortune-number').textContent = fortuneToday?.luckyNumber || '—';
  $('fortune-color').textContent = fortuneToday?.luckyColor || '—';
  $('storage-message').hidden = storageAvailable;
  renderHistory(state.history);
}
function doCheckin() {
  const today = getToday();
  const state = storageAvailable ? loadState() : temporaryState;
  if (state.lastDate === today || state.history.some(item => item.date === today)) { render(); return; }
  const newItem = window.MXFortune.createItem(today);
  const gapDays = diffDays(state.lastDate, today);
  state.streakDays = gapDays === 1 || state.lastDate === '' ? state.streakDays + 1 : 1;
  state.totalDays += 1;
  state.lastDate = today;
  state.history = [newItem, ...state.history.filter(item => item.date !== today)];
  saveState(state);
  render();
  $('fortune-announcement').textContent = `今日签到完成，${newItem.level}：${newItem.text}`;
}
document.addEventListener('DOMContentLoaded', () => {
  $('backup-export').addEventListener('click', () => {
    try {
      const state = storageAvailable ? loadState() : temporaryState;
      const blob = new Blob([window.MXCheckinBackup.serialize(state)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mx-checkin-${getToday()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      $('backup-status').textContent = '已生成备份，请妥善保存下载的 JSON 文件。';
    } catch { $('backup-status').textContent = '备份生成失败，请稍后重试。'; }
  });
  $('backup-import').addEventListener('click', () => $('backup-file').click());
  $('backup-file').addEventListener('change', async () => {
    const file = $('backup-file').files[0];
    if (!file) return;
    $('backup-import').disabled = true;
    try {
      if (file.size > 2 * 1024 * 1024) throw Error('文件过大，请选择小于 2 MB 的签到备份。');
      let data;
      try { data = JSON.parse(await file.text()); }
      catch { throw Error('无法读取此文件，请选择导出的 JSON 备份。'); }
      const incoming = window.MXCheckinBackup.validate(data, getToday());
      const current = loadState();
      const merged = window.MXCheckinBackup.merge(current, incoming);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); }
      catch { throw Error('浏览器无法保存备份，原记录未更改。请检查存储设置后重试。'); }
      temporaryState = merged;
      storageAvailable = true;
      render();
      $('backup-status').textContent = `导入完成，新增 ${merged.history.length - current.history.length} 条记录。同一天的原签文已保留。`;
    } catch (error) { $('backup-status').textContent = error.message; }
    finally {
      $('backup-import').disabled = false;
      $('backup-file').value = '';
    }
  });
  $('checkin-btn').addEventListener('click', () => {
    const finish = () => { doCheckin(); document.querySelector('.checkin-result')?.classList.add('sign-revealed'); };
    if (window.MXMotion) window.MXMotion.draw($('checkin-btn'),finish);
    else finish();
  });
  $('history-toggle').addEventListener('click', () => { showAllHistory = !showAllHistory; render(); });
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === null) { storageAvailable = true; render(); }
  });
  window.addEventListener('pageshow', render);
  let renderedDate = getToday();
  const refreshDate = () => {
    const date = getToday();
    if (date !== renderedDate) { renderedDate = date; render(); }
  };
  setInterval(() => { if (!document.hidden) refreshDate(); }, 60000);
  document.addEventListener('visibilitychange', refreshDate);
  render();
});
})();
