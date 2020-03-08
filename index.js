/*
 * Documentative
 * (c) 2020 dragonwocky <thedragonring.bod@gmail.com>
 * (https://dragonwocky.me/) under the MIT License
 */

const path = require('path'),
  fs = require('fs-extra'),
  klaw = require('klaw'),
  resourceCache = {},
  marked = require('marked'),
  hljs = require('highlight.js'),
  pug = require('pug'),
  less = require('less'),
  languages = new Set();
marked.setOptions({
  renderer: new marked.Renderer(),
  highlight: (code, language) => {
    language = hljs.getLanguage(language) ? language : 'plaintext';
    languages.add(language);
    return hljs.highlight(language, code).value;
  },
  langPrefix: 'lang-',
  gfm: true
});

async function build(inputdir, outputdir, config = {}) {
  if (!inputdir) throw Error(`documentative: init failed, no input dir provided`);
  inputdir = path.relative('.', inputdir);
  if (!outputdir) throw Error(`documentative: init failed, no output dir provided`);
  outputdir = path.relative('.', outputdir);
  config = await checkconf(inputdir, config, 'options');
  let assets, nav;
  [nav, assets] = await processlist(inputdir, config.nav, 'nav');
  if (!path.relative(inputdir, outputdir).startsWith('.'))
    assets = assets.filter(
      item => !item.startsWith(outputdir.slice(inputdir.length + 1))
    );
  return assets;
}

async function filelist(dir) {
  let files = [];
  for await (const item of klaw(dir)) files.push(item.path);
  files = files.map(item => path.relative('.', item).slice(dir.length + 1));
  // .filter(item => !fs.lstatSync(item).isDirectory())
  return files.sort();
}

async function checkconf(inputdir, obj, confloc) {
  if (typeof obj !== 'object')
    throw Error(`documentative: <${confloc}> should be an object`);
  const err = prop => {
    throw Error(`documentative: invalid ${prop} in <${confloc}>`);
  };
  // "title": "documentative"
  if (obj.title) {
    if (typeof obj.title !== 'string') err('title');
  } else obj.title = 'documentative';
  // "primary": "#b20000"
  if (obj.primary) {
    if (typeof obj.primary !== 'string') err('primary');
  } else obj.primary = '#b20000';
  // "icon": "logo.png"
  if (obj.icon) {
    if (
      typeof obj.icon !== 'string' ||
      !(await fs.pathExists(path.join(inputdir, obj.icon)))
    )
      err('icon');
    obj.icon = {
      name: obj.icon,
      src: await fs.readFile(path.join(inputdir, obj.icon))
    };
  } else {
    if (!resourceCache.icon)
      resourceCache.icon = await fs.readFile(
        path.join(__dirname, 'resources', 'documentative.ico')
      );
    obj.icon = {
      name: 'documentative.ico',
      src: resourceCache.icon
    };
  }
  // "copyright": {
  //   "text": "© copyright 2020, dragonwocky",
  //   "url": "https://dragonwocky.me/"
  // },
  if (
    obj.copyright &&
    (typeof obj.copyright !== 'object' ||
      typeof obj.copyright.text !== 'string' ||
      (obj.copyright.url && typeof obj.copyright.url !== 'string'))
  )
    err('copyright');
  return obj;
}

async function processlist(inputdir, obj, confloc) {
  const files = await filelist(inputdir);
  let list;
  if (obj) {
    if (!Array.isArray(obj))
      throw Error(`documentative: <${confloc}> should be an array`);
    const err = prop => {
      throw Error(`documentative: invalid entry ${prop} in <${confloc}>`);
    };
    list = await Promise.all(
      obj.map(async entry => {
        if (typeof entry === 'string')
          // "title"
          return {
            type: 'title',
            text: entry
          };
        if (Array.isArray(entry)) {
          if (entry.length !== 2) err(entry);
          if (files.includes(entry[1]))
            // ["output", "src"]
            return {
              type: 'page',
              output: entry[0].endsWith('.html') ? entry[0] : entry[0] + '.html',
              src: entry[1]
            };
          // ["text", "url"]
          return {
            type: 'link',
            text: entry[0],
            url: entry[1]
          };
        }
        if (typeof entry === 'object') {
          // {
          //    type: "page" || "link" || "title"
          //    (page) output: output filepath
          //    (page) src: source filepath
          //    (link, title) text: displayed text
          //    (link) url: url
          // }
          switch (entry.type) {
            case 'page':
              if (typeof entry.output !== 'string') err(`output '${entry.output}'`);
              if (!entry.output.endsWith('.html')) entry.output += '.html';
              if (
                typeof entry.src !== 'string' ||
                !(await fs.pathExists(path.join(this.inputdir, entry.src)))
              )
                err(`src '${entry.src}'`);
              return entry;
            case 'link':
              if (typeof entry.text !== 'string') err(`text '${entry.text}'`);
              if (typeof entry.url !== 'string') err(`url '${entry.url}'`);
              return entry;
            case 'title':
              if (typeof entry.text !== 'string') err(`text '${entry.text}'`);
              return entry;
            default:
              err(`type '${entry}'`);
          }
        }
        err(entry);
      })
    );
  } else {
    list = files
      .map(item =>
        fs.lstatSync(path.join(inputdir, item)).isDirectory()
          ? { type: 'title', text: path.basename(item) }
          : item.endsWith('.md')
          ? {
              type: 'page',
              output: item.slice(0, -3) + '.html',
              src: item
            }
          : false
      )
      .reduce(
        (prev, val) =>
          val
            ? val.src === (files.includes('index.md') ? 'index.md' : 'README.md')
              ? [{ type: 'page', output: 'index.html', src: val.src }, ...prev]
              : [...prev, val]
            : prev,
        []
      );
  }
  return [
    list,
    files.filter(
      item =>
        !fs.lstatSync(path.join(inputdir, item)).isDirectory() && !item.endsWith('.md')
    )
  ];
}

module.exports = { build };
