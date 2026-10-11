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
    // Retain timestamps/timezones on existing articles when the day is unchanged.
    if (String(record.metadata.date || '').slice(0,10) === next.metadata.date) metadata.date = record.metadata.date;
    if (['projects','game-jam','art'].includes(record.category)) {
      for (const key of ['external_url','description','cover']) if (!(key in next.metadata)) delete metadata[key];
    }
    return {...file, filename:record.path.slice(file.folder.length + 1), text:'---\n' + window.jsyaml.dump(metadata,{schema:window.jsyaml.JSON_SCHEMA,lineWidth:-1,noRefs:true}) + '---\n\n' + next.body};
  }
  window.MXContent = {parse,update,folders};
})();
