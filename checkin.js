(() => {
'use strict';
    const STORAGE_KEY = "daily-checkin";
    const fortuneLevelMap = {
      best: {
        levels: ["MIAO!", "QWQ", "OVO"],
        text: "今天的气场直接拉满，去大胆实现吧！",
        color: "#10b981"
      },
      good: {
        levels: ["大吉", "上吉"],
        text: "运气在线，适合推进重要目标。",
        color: "#22c55e"
      },
      medium: {
        levels: ["中吉", "末吉"],
        text: "平稳过渡的一天，专注细节会更顺利。",
        color: "#84cc16"
      },
      notGood: {
        levels: ["下吉"],
        text: "注意节奏，先稳住再出击。",
        color: "#f97316"
      },
      terrible: {
        levels: ["明天再来吧"],
        text: "今天先休息一下，明天会更好。",
        color: "#ef4444"
      }
    };
    const fortuneImagesByCategory = {
      terrible: [
        "../picture/每日占卜/很差的/2c00d9f3c73f5abae505298f2a75cc7e.jpg",
        "../picture/每日占卜/很差的/306875a46af5d9cacdb8bafebd3bfe1e.jpg",
        "../picture/每日占卜/很差的/44dcb17a685a50d50051ad22f8fd4d0a.jpg",
        "../picture/每日占卜/很差的/673c4091811628035ba635439436b672.jpg",
        "../picture/每日占卜/很差的/6c542bb48dad33ba1967b6f61104f17a.jpg",
        "../picture/每日占卜/很差的/a191ab7bf7da374caaea3a4b962b8975.jpg",
        "../picture/每日占卜/很差的/b7422d4d99942b932656d060ed4c1aba.jpg",
        "../picture/每日占卜/很差的/d068368e42809357eff24d4f79d767f1.jpg",
        "../picture/每日占卜/很差的/dd77c4c8ac0df15fb2376f2704f80821.jpg",
        "../picture/每日占卜/很差的/f0c6f9cd6c8d66d35d45b75a0ea26f64.jpg"
      ],
      notGood: [
        "../picture/每日占卜/不太好的/1ff251e5ba9b2d1440cf08a2192d25fc.jpg",
        "../picture/每日占卜/不太好的/475047cfad632e994ef9f6fbaf051835.jpg",
        "../picture/每日占卜/不太好的/4acd6c70b986b56f9859172902fe98da.jpg",
        "../picture/每日占卜/不太好的/5ff88bfe92007274cee9320d9780c63e.jpg",
        "../picture/每日占卜/不太好的/623c3edefdc68f1f1cb34313e26ade13.jpg",
        "../picture/每日占卜/不太好的/6446943c85bf0603f1211c5af0c425fb.jpg",
        "../picture/每日占卜/不太好的/6b711bc1313c8a7a6fcd26e57b07bfb5.jpg",
        "../picture/每日占卜/不太好的/8301cf9ab00dc2c01ed1d8076149287a.jpg",
        "../picture/每日占卜/不太好的/8a73e6b7d21cff21e3b6079aa0950ce4.jpg",
        "../picture/每日占卜/不太好的/913a80d2005cd7571c4270c73d9fb539.jpg",
        "../picture/每日占卜/不太好的/92d25edb047dca914a7db3cb2447d068.jpg",
        "../picture/每日占卜/不太好的/a1ce2749f0675f30d92b5e3fc6f38bfc.jpg",
        "../picture/每日占卜/不太好的/a5c73c230ea4e8dd810d088ff0a06e8b.jpg",
        "../picture/每日占卜/不太好的/abafd16349e4814e45b66e389e3f9a54.jpg",
        "../picture/每日占卜/不太好的/e66d110f11d1bb1579c9bcfcfbe9375c.jpg",
        "../picture/每日占卜/不太好的/eb66b46f47b6f1afa62b4c74510863ef.jpg"
      ],
      medium: [
        "../picture/每日占卜/中等的/203cb4aa41cfec3b83ff2a1d3a207d35.jpg",
        "../picture/每日占卜/中等的/3a4abdbf7aa7a2acf09d868c6cff36c8.jpg",
        "../picture/每日占卜/中等的/460d1ca2c379add2532f4136bfc2ec9f.jpg",
        "../picture/每日占卜/中等的/58e7234f2fa8ae5bd3e62b1f9e8d36bf.jpg",
        "../picture/每日占卜/中等的/751153204a3aba12ef28f5512b1f7753.jpg",
        "../picture/每日占卜/中等的/77b095e9daee6716c2c8ac39036dfd83.jpg",
        "../picture/每日占卜/中等的/77eb39a0f56938759cb34f11d90b14f4.jpg",
        "../picture/每日占卜/中等的/79d8b92073fd26cf38e8ec312c26a942.jpg",
        "../picture/每日占卜/中等的/7b0be8b5f83024f573a93bc8c49c5877.jpg",
        "../picture/每日占卜/中等的/8d58c16227bb548bc744a4f68fdf4316.jpg",
        "../picture/每日占卜/中等的/957bf2717128af1b106cf0796010dc0b.jpg",
        "../picture/每日占卜/中等的/97f265d755d0d31f3287fa5fb12e0080.jpg",
        "../picture/每日占卜/中等的/a0850f3ec7a157439f94788a8a4797ea.jpg",
        "../picture/每日占卜/中等的/a75d607c89af672500a4cae24056dd8f.jpg",
        "../picture/每日占卜/中等的/b3c935f8efbabf6330ba4567a5ec6b0b.jpg",
        "../picture/每日占卜/中等的/d3c3bf96ebf9c67c449abce84b182973.jpg",
        "../picture/每日占卜/中等的/f0282fef06663d9ed02d4234fc58e565.jpg"
      ],
      good: [
        "../picture/每日占卜/好的/0e66ee35aa72d34e6365a7a306e21d5a.jpg",
        "../picture/每日占卜/好的/1ca66a21616ad85fa666606ffb9de51a.jpg",
        "../picture/每日占卜/好的/2a1acdf7b1222405e069cabc1382df92.jpg",
        "../picture/每日占卜/好的/43dd8bf28258f08ce509198b612ec49f.jpg",
        "../picture/每日占卜/好的/485f6dd38e7aefe0ccfc29dca0ff2fa4.jpg",
        "../picture/每日占卜/好的/504adc61c0298b8e710bc6c638effb37.jpg",
        "../picture/每日占卜/好的/55df0a438fa39908fa7ba1ecb726abb6.jpg",
        "../picture/每日占卜/好的/5f029140ac21eabf2f0519db0dd6e718.jpg",
        "../picture/每日占卜/好的/65bcaf1d6b075e61e9d8d0ad8b59bf8f.jpg",
        "../picture/每日占卜/好的/6d5f83c8f13bbb40c1903d9d1dc7e8f4.jpg",
        "../picture/每日占卜/好的/751dee8d598bb1aa1d2f1cca511a83c0.jpg",
        "../picture/每日占卜/好的/752a6a642e31a09b2480d814b32954e1.jpg",
        "../picture/每日占卜/好的/818ae1d2d75ba4bceade46735dbbf735.jpg",
        "../picture/每日占卜/好的/8d3d9bfa004c0962ccdd5bee3e7ac122.jpg",
        "../picture/每日占卜/好的/8fca51f1dd9bbe341d0ea346dc375a51.jpg",
        "../picture/每日占卜/好的/99c13e98c9d566f3082a008ed94302f2.jpg"
      ],
      best: [
        "../picture/每日占卜/最好的/02f2ae0ff84432b533d089e8de196031.jpg",
        "../picture/每日占卜/最好的/08855457a8c7fccedf821019ce60d1f5.jpg",
        "../picture/每日占卜/最好的/17ce35b7fba1fb2d1b36b72cb885213c.jpg",
        "../picture/每日占卜/最好的/19f6a058f64c143131d45a21ad773ac6.jpg",
        "../picture/每日占卜/最好的/23b7032b7b25888597c56f2dc856442f.jpg",
        "../picture/每日占卜/最好的/32a85bdd302bc5debf135ec37335c697.jpg",
        "../picture/每日占卜/最好的/68528bf9f270fa198993c07304472ecd.jpg",
        "../picture/每日占卜/最好的/89b22f134433df28f48ee4a44a307d1b.jpg",
        "../picture/每日占卜/最好的/911105d15e434d3926dd41bf359f84c8.jpg",
        "../picture/每日占卜/最好的/9c0c2cb34cb3bea53bfb44fe2b1eda25.jpg",
        "../picture/每日占卜/最好的/be54de76baa67be65de3f31234576026.jpg",
        "../picture/每日占卜/最好的/c2dd0967fe887deaa18773bd60b14e95.jpg"
      ]
    };
    const auspiciousList = ["写作", "学习", "运动", "整理房间", "分享心情", "看电影", "早睡", "散步", "喝热饮", "做计划", "画画", "听音乐"];
    const inauspiciousList = ["熬夜", "冲动购物", "拖延", "暴饮暴食", "争执", "重度社交", "临时变更计划", "久坐", "过度思考", "迟到", "长时间游戏", "情绪化决定"];
    const luckyColors = ["薄荷绿", "樱花粉", "天空蓝", "柠檬黄", "薰衣草紫", "奶油白", "石墨灰", "雾霾蓝", "珊瑚橙", "茶棕色", "青柠绿", "玫瑰金"];

    function hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
      }
      return hash;
    }

    function pickFromList(dateStr, key, list) {
      if (!list.length) return "";
      const seed = hashString(`${dateStr}:${key}`);
      const index = seed % list.length;
      return list[index];
    }

    function pickFortune(dateStr) {
      const categories = Object.keys(fortuneLevelMap);
      const category = pickFromList(dateStr, "category", categories);
      const levels = fortuneLevelMap[category].levels;
      const level = pickFromList(dateStr, "level", levels);
      return {
        category,
        level,
        text: fortuneLevelMap[category].text,
        color: fortuneLevelMap[category].color
      };
    }

    function pickFortuneImage(dateStr, category) {
      const list = fortuneImagesByCategory[category] || [];
      return pickFromList(dateStr, "image", list);
    }

    function pickAuspicious(dateStr) {
      return pickFromList(dateStr, "yi", auspiciousList);
    }

    function pickInauspicious(dateStr) {
      return pickFromList(dateStr, "ji", inauspiciousList);
    }

    function pickLuckyNumber(dateStr) {
      const seed = hashString(`${dateStr}:number`);
      return String((seed % 99) + 1);
    }

    function pickLuckyColor(dateStr) {
      return pickFromList(dateStr, "color", luckyColors);
    }

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
  const fortune = pickFortune(today);
  const newItem = {
    date: today, level: fortune.level, text: fortune.text, color: fortune.color,
    image: pickFortuneImage(today, fortune.category),
    auspicious: pickAuspicious(today), inauspicious: pickInauspicious(today),
    luckyNumber: pickLuckyNumber(today), luckyColor: pickLuckyColor(today)
  };
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
  $('checkin-btn').addEventListener('click', doCheckin);
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
  setInterval(refreshDate, 1000);
  document.addEventListener('visibilitychange', refreshDate);
  render();
});
})();
