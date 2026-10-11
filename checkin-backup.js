/* Backup helpers do not write storage. Import is committed only after validation. */
(() => {
  'use strict';
  const FORMAT = 'mx-daily-checkin';
  function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
  }
  function validate(data, today) {
    if (!data || data.format !== FORMAT || data.version !== 1 || !data.state || typeof data.state !== 'object') throw Error('这不是受支持的 MX 签到备份文件。');
    const state = data.state;
    if (!Array.isArray(state.history) || state.history.length > 20000) throw Error('备份记录列表不正确或过大。');
    for (const key of ['totalDays','streakDays']) if (!Number.isSafeInteger(state[key]) || state[key] < 0) throw Error('备份的累计或连续签到天数不正确。');
    if (state.lastDate !== '' && (!validDate(state.lastDate) || state.lastDate > today)) throw Error('备份的最近签到日期不正确，或晚于当前日期。');
    const seen = new Set();
    const history = state.history.map(item => {
      if (!item || !validDate(item.date) || item.date > today || seen.has(item.date)) throw Error('备份含无效、未来或重复的签到日期。');
      seen.add(item.date);
      const clean = {date:item.date};
      for (const key of ['level','text','color','image','auspicious','inauspicious','luckyNumber','luckyColor']) {
        if (item[key] !== undefined && (typeof item[key] !== 'string' || item[key].length > 4000)) throw Error('备份的签文内容格式不正确。');
        if (item[key] !== undefined) clean[key] = item[key];
      }
      if (!clean.level || !clean.text) throw Error('备份中有记录缺少签文。');
      if (clean.image && (!/^(?:\.\.\/|\/)picture\/每日占卜\/[^?#\\]+\.jpg$/i.test(clean.image) || clean.image.slice(3).includes('..'))) throw Error('备份中的图片路径不受支持。');
      return clean;
    }).sort((a,b)=>b.date.localeCompare(a.date));
    if (history.length && (!state.lastDate || state.lastDate < history[0].date)) throw Error('备份中的最近签到日期与记录不一致。');
    if (state.totalDays < history.length || state.streakDays > state.totalDays || (state.lastDate && !state.totalDays) || (!state.lastDate && (state.totalDays || state.streakDays))) throw Error('备份统计与签到记录不一致。');
    return {totalDays:state.totalDays,streakDays:state.streakDays,lastDate:state.lastDate,history};
  }
  function merge(current, incoming) {
    const byDate = new Map(incoming.history.map(item=>[item.date,item]));
    current.history.forEach(item=>byDate.set(item.date,item)); // Keep this browser's sign on matching dates.
    const history = [...byDate.values()].sort((a,b)=>b.date.localeCompare(a.date));
    const lastDate = [current.lastDate,incoming.lastDate,history[0]?.date || ''].sort().at(-1);
    let streakDays = 0;
    if (lastDate) {
      let day = Date.parse(lastDate+'T00:00:00Z');
      while (byDate.has(new Date(day).toISOString().slice(0,10))) { streakDays++; day -= 86400000; }
      for (const state of [current,incoming]) if (state.lastDate === lastDate) streakDays = Math.max(streakDays,state.streakDays);
    }
    return {...current,history,lastDate,streakDays,totalDays:Math.max(current.totalDays,incoming.totalDays,history.length)};
  }
  function serialize(state) { return JSON.stringify({format:FORMAT,version:1,exportedAt:new Date().toISOString(),state},null,2); }
  window.MXCheckinBackup = {validate,merge,serialize};
})();
