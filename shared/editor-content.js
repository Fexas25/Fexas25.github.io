/* Shared, lossless metadata handling for the writing editor. */
(() => {
  const folders = {blog:'_posts','competitive-programming':'_cp',projects:'_projects','game-jam':'_gamejam',art:'_art'};
  function parse(text, path, sha) {
    const category = Object.keys(folders).find(key => path.startsWith(folders[key] + '/'));
    if (!category || !/\.md$/i.test(path) || path.split('/').some(part => ['.','..',''].includes(part))) throw Error('这不是可编辑的文章文件。');
    const match = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
    if (!match) throw Error('文件缺少 YAML 文章信息，请先在 GitHub 检查格式。');
    const metadata = window.jsyaml.load(match[1], {schema:window.jsyaml.JSON_SCHEMA});
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw Error('文章信息格式不正确。');
    return {path,sha,category,metadata,body:match[2].replace(/^\r?\n/, '')};
  }
  function update(file, record) {
    if (!record) return file;
    if (!record.path.startsWith(file.folder + '/')) throw Error('修改已有文章时不能更换栏目；请另建一篇内容。');
    const next = parse(file.text, record.path, record.sha);
    const metadata = {...record.metadata,...next.metadata};
    if(record.documentId&&!next.metadata.private)delete metadata.private;
    // Retain timestamps/timezones on existing articles when the day is unchanged.
    if (String(record.metadata.date || '').slice(0,10) === next.metadata.date) metadata.date = record.metadata.date;
    if (['projects','game-jam','art'].includes(record.category)) {
      for (const key of ['external_url','description','cover']) if (!(key in next.metadata)) delete metadata[key];
    }
    return {...file, filename:record.path.slice(file.folder.length + 1), text:'---\n' + window.jsyaml.dump(metadata,{schema:window.jsyaml.JSON_SCHEMA,lineWidth:-1,noRefs:true}) + '---\n\n' + next.body};
  }
  function importMarkdown(text, filename, fallbackCategory) {
    text = text.replace(/^\uFEFF/, '').replace(/\r\n/g,'\n');
    let metadata = {}, body = text;
    if (/^---\s*\n/.test(text)) {
      const match = text.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/);
      if (!match) throw Error('文章信息缺少结束的 ---，请检查 Markdown 文件。');
      try { metadata = window.jsyaml.load(match[1],{schema:window.jsyaml.JSON_SCHEMA}) || {}; }
      catch { throw Error('YAML 文章信息格式不正确，请检查缩进和引号。'); }
      if (typeof metadata !== 'object' || Array.isArray(metadata)) throw Error('文章信息应为标题、日期等字段。');
      body = match[2].replace(/^\n/,'');
    }
    const category = metadata.category || fallbackCategory;
    if (!folders[category]) throw Error('无法识别栏目，请将 category 改为 blog、competitive-programming、projects、game-jam 或 art。');
    for (const field of ['title','date','topic','type','external_url','description','cover']) {
      if (metadata[field] !== undefined && typeof metadata[field] !== 'string') throw Error(`文章信息 ${field} 必须是文本。`);
    }
    tags(metadata.tags);
    const date = (metadata.date || filename.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '').slice(0,10);
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date)) throw Error('文章日期不正确，请使用 YYYY-MM-DD。');
    const title = metadata.title || body.match(/^#\s+(.+)$/m)?.[1] || filename.replace(/\.md(?:own)?$|\.markdown$/i,'').replace(/^\d{4}-\d{2}-\d{2}-/,'');
    return {metadata,body,category,title,date};
  }
  function tags(value) {
    if (value == null) return [];
    if (!Array.isArray(value) && typeof value !== 'string') throw Error('标签应为文字列表，或用逗号分隔的文本。');
    const items = Array.isArray(value) ? value : value.split(/[,，]/);
    if (items.some(item => typeof item !== 'string')) throw Error('每个标签都应是文字。');
    return [...new Set(items.map(item => item.trim()).filter(Boolean))];
  }
  function topic(metadata) {
    if (['leetcode','atcoder','algorithm','game-dev','ai','notes'].includes(metadata.topic)) return metadata.topic;
    const oldTags = tags(metadata.tags).map(tag => tag.toLowerCase());
    if (oldTags.includes('atcoder')) return 'atcoder';
    if (oldTags.includes('leetcode')) return 'leetcode';
    return 'notes';
  }
  window.MXContent = {parse,update,folders,importMarkdown,tags,topic};
})();
