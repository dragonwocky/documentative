/*
 * Documentative
 * (c) 2020 dragonwocky <thedragonring.bod@gmail.com>
 * (https://dragonwocky.me/) under the MIT license
 */

module.exports = { build, serve };

const path = require('path'),
  fs = require('fs-extra'),
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
  files: { css: 'styles.css', js: 'scrollnav.js', icon: 'documentative.ico' },
  resources: new Map(),
  languages: new Set()
};

async function build(inputdir, outputdir, config = {}) {
  if (!inputdir)
    throw Error(`documentative<build>: failed, no input dir provided`);
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

  if (!fs.existsSync(outputdir)) fs.mkdirSync(outputdir);
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
          await fs.readFile(resourcepath($.files.js), 'utf8')
        );
      return true;
    },
    async () => {
      if (!$.resources.has('css'))
        $.resources.set(
          'css',
          (
            await less.render(
              (await fs.readFile(resourcepath('styles.less'), 'utf8')).replace(
                /__primary__/g,
                config.primary
              )
            )
          ).css
        );
      return true;
    },

    ...assets.map(async asset => {
      await fs.outputFile(
        path.join(outputdir, asset),
        await fs.readFile(path.join(inputdir, asset))
      );
      return true;
    })
    // , ...nav
    //   .filter(entry => entry.type === 'page')
    //   .map(async page => {
    //     await fs.outputFile(
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
      $.resources.set('icon', await fs.readFile(resourcepath($.files.icon)));
    fs.outputFile(path.join(outputdir, $.files.icon), $.resources.get('icon'));
  } else {
    if (!assets.includes(relative(inputdir, icon.toString())))
      console.warn('documentative<config>: specified icon does not exist');
  }
  fs.outputFile(
    path.join(outputdir, $.files.css),
    $.resources.get('css') +
      [...$.languages]
        .map(
          lang =>
            `.documentative pre .lang-${lang}::before { content: '${lang.toUpperCase()}'; }`
        )
        .join('\n'),
    'utf8'
  );
  fs.outputFile(
    path.join(outputdir, $.files.js),
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
    .filter(item => item && filter(item))
    .sort()
    .reduce(
      (result, file) => {
        result[
          fs.lstatSync(path.join(dir, file)).isDirectory() ||
          file.endsWith('.md')
            ? 0
            : 1
        ].push(file);
        return result;
      },
      [[], []]
    );
}
