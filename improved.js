/*
 * Documentative
 * (c) 2020 dragonwocky <thedragonring.bod@gmail.com>
 * (https://dragonwocky.me/) under the MIT license
 */

module.exports = { build, serve };

const path = require('path'),
  fs = require('fs'),
  fsp = fs.promises,
  klaw = require('klaw'),
  relative = path.relative,
  resourcepath = file => path.join(__dirname, 'resources', file),
  less = require('less'),
  pug = require('pug');

const $ = {
  defaults: {
    title: 'documentative',
    primary: '#712c9c',
    copyright: {
      text: '© copyright 2020, dragonwocky',
      url: 'https://dragonwocky.me/'
    },
    exclude: [],
    overwrite: false,
    empty: false
  },
  resources: new Map(),
  languages: new Set()
};

async function build(inputdir, outputdir, config = {}) {
  if (!inputdir)
    throw Error(`documentative<build>: failed, no input dir provided`);
  if (!fs.lstatSync(inputdir).isDirectory())
    throw Error(`documentative<build>: failed, input dir is not a directory`);
  if (!outputdir)
    throw Error(`documentative<build>: failed, no output dir provided`);
  [inputdir, outputdir] = [relative('.', inputdir), relative('.', outputdir)];

  let icon, nav;
  [config, icon, nav] = parseConfig(config);
  let [pages, assets] = await filelist(inputdir, file =>
    relative(inputdir, outputdir).startsWith('.')
      ? true
      : !file.startsWith(outputdir.slice(inputdir.length + path.sep.length)) &&
        !config.exclude.includes(file)
  );
  nav = parseNav(inputdir, pages);
  console.log(nav);

  // config.nav = await Promise.all(
  //   (await processlist(inputdir, files, config.nav)).map((entry, i) => {
  //     if (entry.type !== 'page') return entry;
  //     entry.index = i;
  //     entry.depth = '../'.repeat(entry.output.split(path.sep).length - 1);
  //     entry.path =
  //       entry.output
  //         .split(path.sep)
  //         .slice(0, -1)
  //         .join('/') + '/';
  //     return parsepage(inputdir, entry);
  //   })
  // );

  if (!fs.existsSync(outputdir)) await fsp.mkdir(outputdir);
  if (!fs.lstatSync(outputdir).isDirectory())
    throw Error(`documentative<build>: failed, output dir is not a directory`);
  if ((await filelist(outputdir)).flat().length && !config.overwrite)
    throw Error(`documentative<build>: outputdir "${outputdir}" is not empty!
        empty the directory and run again, or set the config.overwrite option to true`);

  if (!$.resources.has('template'))
    $.resources.set('template', pug.compileFile(resourcepath('template.pug')));
  await Promise.all([
    async () => {
      if (!$.resources.has('js'))
        $.resources.set(
          'js',
          await fsp.readFile(resourcepath('scrollnav.js'), 'utf8')
        );
      return true;
    },
    async () => {
      if (!$.resources.has('css'))
        $.resources.set(
          'css',
          (
            await less.render(
              (await fsp.readFile(resourcepath('styles.less'), 'utf8')).replace(
                /__primary__/g,
                config.primary
              )
            )
          ).css
        );
      return true;
    },

    ...assets.map(async asset => {
      let dirs = asset.split(path.sep);
      for (let i = 1; i < dirs.length; i++) {
        let dir = path.join(outputdir, dirs.slice(0, i).join(path.sep));
        switch (true) {
          case !fs.lstatSync(dir).isDirectory():
            await fsp.unlink(dir);
          case !fs.existsSync(dir):
            await fsp.mkdir(dir);
        }
      }
      await fsp.writeFile(
        path.join(outputdir, asset),
        await fsp.readFile(path.join(inputdir, asset))
      );
      return true;
    })
    // , ...nav
    //   .filter(entry => entry.type === 'page')
    //   .map(async page => {
    //     await fsp.outputFile(
    //       path.join(outputdir, page.output),
    //       $.resources.get('template')({
    //         ...page,
    //         config,
    //         resources: $.files
    //       }),
    //       'utf8'
    //     );
    //     return true;
    //   })
  ]);

  if ([null, undefined].includes(icon)) {
    if (!$.resources.has('icon'))
      $.resources.set(
        'icon',
        await fsp.readFile(resourcepath('documentative.ico'))
      );
    fsp.writeFile(
      path.join(outputdir, 'documentative.ico'),
      $.resources.get('icon')
    );
  } else {
    if (!assets.includes(relative(inputdir, icon.toString())))
      console.warn('documentative<config>: specified icon does not exist');
  }
  fsp.writeFile(
    path.join(outputdir, 'styles.css'),
    $.resources.get('css') +
      [...$.languages]
        .map(
          lang =>
            `.documentative pre .lang-${lang}::before { content: '${lang.toUpperCase()}'; }`
        )
        .join('\n'),
    'utf8'
  );
  fsp.writeFile(
    path.join(outputdir, 'scrollnav.js'),
    $.resources.get('js'),
    'utf8'
  );
  return true;
}

async function serve(inputdir, port, config = {}) {}

function parseConfig(obj = {}) {
  if (typeof obj !== 'object')
    throw Error(`documentative<config>: should be an object`);
  return [validateObj(obj, $.defaults), obj.icon, obj.nav];
}
function validateObj(obj, against) {
  return Object.fromEntries(
    Object.entries(against).map(entry => {
      let [key, val] = [entry[0], obj[entry[0]]];
      switch (true) {
        case [val, against[key]].some(potential =>
          [null, undefined].includes(potential)
        ):
          return [key, against[key]];
        case typeof val !== typeof against[key]:
        case Array.isArray(val) !== Array.isArray(against[key]):
          throw Error(
            `documentative<config>: ${key} should be of type ${
              Array.isArray(against[key]) ? 'array' : typeof against[key]
            }`
          );
        case typeof val === 'object':
          if (typeof against[key] === 'object')
            val = validateObj(val, against[key]);
        default:
          return [key, val];
      }
    })
  );
}

async function filelist(dir, filter = () => true) {
  let files = [];
  for await (const item of klaw(dir))
    if (!(item.path in files)) files.push(item.path);
  // [pages, assets]
  return files
    .map(item => relative('.', item).slice(dir.length ? dir.length + 1 : 0))
    .filter(
      item =>
        item &&
        !fs.lstatSync(path.join(dir, item)).isDirectory() &&
        filter(item)
    )
    .sort()
    .reduce(
      (result, item) => {
        result[item.endsWith('.md') ? 0 : 1].push(item);
        return result;
      },
      [[], []]
    );
}

async function parseNav(inputdir, files, arr = []) {
  if (!Array.isArray(arr))
    throw Error(`documentative<config.nav>: should be an array`);
  if (!arr.length) {
    return Object.entries(
      files.reduce((prev, val) => {
        const dir = val
          .split(path.sep)
          .slice(0, -1)
          .join(path.sep);
        if (!prev[dir]) prev[dir] = [];
        prev[dir].push({
          type: 'page',
          output: val.slice(0, -3) + '.html',
          src: val
        });
        return prev;
      }, {})
    )
      .map(entry => {
        const index =
          entry[1].find(item => item.src.toLowerCase().endsWith('index.md')) ||
          entry[1].find(item => item.src.toLowerCase().endsWith('readme.md'));
        if (index) {
          entry[1].splice(
            entry[1].findIndex(item => item.src === index.src),
            1
          );
          entry[1].unshift({
            type: 'page',
            output: [index.src.split(path.sep).slice(0, -1), 'index.html'].join(
              path.sep
            ),
            src: index.src
          });
        }
        if (entry[0]) entry[1].unshift({ type: 'title', text: entry[0] });
        return entry[1];
      })
      .flat();
  } else
    return await Promise.all(
      arr.map(async entry => {
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
              output: entry[0].endsWith('.html')
                ? entry[0]
                : entry[0] + '.html',
              src: entry[1]
            };
          // ["text", "url"]
          return {
            type: 'link',
            text: entry[0],
            url: entry[1]
          };
        }
        if (typeof entry !== 'object') err(entry);
        // {
        //    type: "page" || "link" || "title"
        //    (page) output: output filepath
        //    (page) src: source filepath
        //    (link, title) text: displayed text
        //    (link) url: url
        // }
        switch (entry.type) {
          case 'page':
            if (typeof entry.output !== 'string')
              err(`output '${entry.output}'`);
            if (!entry.output.endsWith('.html')) entry.output += '.html';
            if (
              typeof entry.src !== 'string' ||
              // ************* check files.includes??
              !(await fs.pathExists(path.join(inputdir, entry.src)))
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
      })
    );
}
