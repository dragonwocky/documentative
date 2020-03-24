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
  resourcepath = file => path.join(__dirname, 'resources', file),
  http = require('http'),
  mime = require('mime-types'),
  less = require('less'),
  pug = require('pug'),
  marked = require('marked'),
  hljs = require('highlight.js');

const $ = {
  defaults: {
    title: 'documentative',
    primary: '#712c9c',
    copyright: {
      text: '© 2020 dragonwocky, under the MIT license',
      url: 'https://dragonwocky.me/#mit'
    },
    exclude: [],
    overwrite: false
  },
  marked: {
    highlight: (code, lang) => {
      lang = hljs.getLanguage(lang) ? lang : 'plaintext';
      $.languages.add(lang);
      return hljs.highlight(lang, code).value;
    },
    langPrefix: 'lang-',
    gfm: true
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
  [inputdir, outputdir] = [
    path.relative('.', inputdir) || '.',
    path.relative('.', outputdir) || '.'
  ];

  let icon, nav;
  [config, icon, nav] = parseConfig(config);
  let [pages, assets] = await filelist(
    inputdir,
    file =>
      !config.exclude.includes(file) &&
      (path.relative(inputdir, outputdir).startsWith('.') ||
      !path.relative(inputdir, outputdir)
        ? true
        : !file.startsWith(outputdir.slice(inputdir.length + path.sep.length)))
  );
  if (!path.relative(inputdir, outputdir)) assets = [];
  nav = await Promise.all(
    parseNav(inputdir, pages, nav).map((entry, i, nav) =>
      entry.type === 'page' ? parsePage(inputdir, entry, nav) : entry
    )
  );

  if (!fs.existsSync(outputdir)) await fsp.mkdir(outputdir);
  if (!fs.lstatSync(outputdir).isDirectory())
    throw Error(`documentative<build>: failed, output dir is not a directory`);
  if ((await filelist(outputdir)).flat().length && !config.overwrite)
    throw Error(`documentative<build>: outputdir "${outputdir}" is not empty!
       empty the directory and run again, or set the config.overwrite option to true`);

  await Promise.all([
    loadResources(),
    ...assets.map(async asset => {
      await populateDirs(outputdir, asset);
      await fsp.writeFile(
        path.join(outputdir, asset),
        await fsp.readFile(path.join(inputdir, asset))
      );
      return true;
    })
  ]);
  nav
    .filter(entry => entry.type === 'page')
    .forEach(async page => {
      await populateDirs(outputdir, page.output);
      await fsp.writeFile(
        path.join(outputdir, page.output),
        $.resources.get('template')({
          _: page,
          config,
          nav,
          icon
        }),
        'utf8'
      );
    });

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
    if (typeof icon !== 'string')
      throw Error(`documentative<config.icon>: should be a string/filepath`);
    if (!assets.includes(path.relative(inputdir, icon)))
      console.warn('documentative<config.icon>: does not exist');
  }
  fsp.writeFile(
    path.join(outputdir, 'styles.css'),
    (
      await less.render(
        $.resources.get('css').replace(/__primary__/g, config.primary)
      )
    ).css +
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

async function serve(inputdir, port, config = {}) {
  if (!inputdir)
    throw Error(`documentative<serve>: failed, no input dir provided`);
  if (!fs.lstatSync(inputdir).isDirectory())
    throw Error(`documentative<build>: failed, input dir is not a directory`);
  if (typeof port !== 'number')
    throw Error(`documentative<serve>: failed, port must be a number`);
  inputdir = path.relative('.', inputdir);
  let icon, confNav;
  [config, icon, confNav] = parseConfig(config);
  if (![null, undefined].includes(icon) && typeof icon !== 'string')
    throw Error(`documentative<config.icon>: should be a string/filepath`);
  await loadResources();

  return http
    .createServer(async (req, res) => {
      let [pages, assets] = await filelist(
        inputdir,
        file => !config.exclude.includes(file)
      );
      nav = parseNav(inputdir, pages, confNav);
      let content, type;
      switch (req.url) {
        case '/styles.css':
          content =
            (
              await less.render(
                $.resources.get('css').replace(/__primary__/g, config.primary)
              )
            ).css +
            [...$.languages]
              .map(
                lang =>
                  `.documentative pre .lang-${lang}::before { content: '${lang.toUpperCase()}'; }`
              )
              .join('\n');
          type = 'text/css';
          break;
        case '/scrollnav.js':
          content = $.resources.get('js');
          type = 'text/javascript';
          break;
        default:
          if (![null, undefined].includes(icon)) {
            if (!assets.includes(path.relative(inputdir, icon)))
              console.warn('documentative<config.icon>: does not exist');
          } else if (req.url === '/documentative.ico') {
            if (!$.resources.has('icon'))
              $.resources.set(
                'icon',
                await fsp.readFile(resourcepath('documentative.ico'))
              );
            content = $.resources.get('icon');
            type = 'image/x-icon';
            break;
          }
          if (assets.includes(req.url.slice(1))) {
            content = await fs.readFile(path.join(inputdir, req.url.slice(1)));
            type = mime.lookup(req.url);
          } else {
            if (req.url.endsWith('/')) req.url = req.url.slice(0, -1);
            if (
              !req.url ||
              nav.find(
                item =>
                  item.type === 'page' &&
                  item.output
                    .split(path.sep)
                    .slice(0, -1)
                    .join('/') === req.url.slice(1)
              )
            )
              req.url += '/index.html';
            if (nav.find(item => item.output === req.url.slice(1))) {
              nav = await Promise.all(
                nav.map((entry, i, nav) =>
                  entry.type === 'page'
                    ? parsePage(inputdir, entry, nav)
                    : entry
                )
              );
              content = $.resources.get('template')({
                _: nav.find(item => item.output === req.url.slice(1)),
                config,
                nav,
                icon
              });
              type = 'text/html';
            } else {
              res.statusCode = 404;
              res.statusMessage = http.STATUS_CODES['404'];
              res.end();
              return false;
            }
          }
      }
      res.writeHead(200, { 'Content-Type': type });
      res.write(content);
      res.end();
    })
    .listen(port);
}

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
          if (typeof against[key] === 'object' && !Array.isArray(against[key]))
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
    .map(item =>
      path
        .relative('.', item)
        .slice(dir.length && dir !== '.' ? dir.length + 1 : 0)
    )
    .filter(
      item =>
        item &&
        !item.split(path.sep).includes('node_modules') &&
        !item.split(path.sep).includes('.git')
    )
    .filter(
      item => !fs.lstatSync(path.join(dir, item)).isDirectory() && filter(item)
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
async function populateDirs(loc, from) {
  let dirs = from.split(path.sep);
  for (let i = 1; i < dirs.length; i++) {
    let dir = path.join(loc, dirs.slice(0, i).join(path.sep));
    if (!fs.existsSync(dir)) await fsp.mkdir(dir);
    if (!fs.lstatSync(dir).isDirectory()) {
      await fsp.unlink(dir);
      await fsp.mkdir(dir);
    }
  }
  return true;
}
async function loadResources() {
  if (!$.resources.has('template'))
    $.resources.set('template', pug.compileFile(resourcepath('template.pug')));
  if (!$.resources.has('js'))
    $.resources.set(
      'js',
      await fsp.readFile(resourcepath('scrollnav.js'), 'utf8')
    );
  if (!$.resources.has('css'))
    $.resources.set(
      'css',
      await fsp.readFile(resourcepath('styles.less'), 'utf8')
    );
  return true;
}

function parseNav(inputdir, files, arr = []) {
  if (!Array.isArray(arr))
    throw Error(`documentative<config.nav>: should be an array`);
  return (arr.length
    ? arr.map(entry => {
        switch (typeof entry) {
          case 'string':
            // "title"
            return {
              type: 'title',
              text: entry
            };
          case 'object':
            if (Array.isArray(entry)) {
              if (entry.length === 1) entry[1] = entry[0];
              if (
                files.includes(
                  path.relative(inputdir, path.join(inputdir, entry[1]))
                )
              )
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
            // {
            //    type: "page" || "link" || "title"
            //    (page) output: output filepath
            //    (page) src: source filepath
            //    (link, title) text: displayed text
            //    (link) url: url
            // }
            switch (entry.type) {
              case 'page':
                if (
                  typeof entry.output === 'string' &&
                  typeof entry.src === 'string' &&
                  files.includes(
                    path.relative(inputdir, path.join(inputdir, entry.src))
                  )
                ) {
                  if (!entry.output.endsWith('.html')) entry.output += '.html';
                  return entry;
                }
              case 'link':
                if (
                  typeof entry.text === 'string' &&
                  typeof entry.url === 'string'
                )
                  return entry;
              case 'title':
                if (typeof entry.text === 'string') return entry;
            }
          default:
            throw Error(`documentative<config.nav>: invalid entry ${entry}`);
        }
      })
    : Object.entries(
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
            entry[1].find(item =>
              item.src.toLowerCase().endsWith('index.md')
            ) ||
            entry[1].find(item => item.src.toLowerCase().endsWith('readme.md'));
          if (index) {
            entry[1].splice(
              entry[1].findIndex(item => item.src === index.src),
              1
            );
            entry[1].unshift({
              type: 'page',
              output: [
                ...index.src.split(path.sep).slice(0, -1),
                'index.html'
              ].join(path.sep),
              src: index.src
            });
          }
          if (entry[0]) entry[1].unshift({ type: 'title', text: entry[0] });
          return entry[1];
        })
        .flat()
  ).map((entry, i, nav) => {
    if (entry.type === 'page') {
      entry.index = i;
      entry.prev = i - 1;
      while (nav[entry.prev] && nav[entry.prev].type !== 'page') entry.prev--;
      entry.next = i + 1;
      while (nav[entry.next] && nav[entry.next].type !== 'page') entry.next++;
      entry.depth = '../'.repeat(entry.output.split(path.sep).length - 1);
    }
    return entry;
  });
}
async function parsePage(inputdir, page, nav) {
  const IDs = new marked.Slugger(),
    tokens = marked.lexer(
      await fsp.readFile(path.join(inputdir, page.src), 'utf8')
    );
  page.headings = [];
  for (let token of tokens) {
    switch (token.type) {
      case 'heading':
        const ID = IDs.slug(token.text.toLowerCase());
        page.headings.push({
          name: token.text,
          level: token.depth,
          hash: ID
        });
        token.type = 'html';
        token.text = `
          </section>
          <section class="block">
            <h${token.depth} id="${ID}">
              <a href="#${ID}">${token.text}</a>
            </h${token.depth}>
        `;
        break;
      case 'code':
        if (token.lang === 'html //example') {
          token.type = 'html';
          token.text = `
            <div class="example">
              ${token.text}
            </div>
          `;
        }
        break;
    }
  }
  page.title = page.headings.shift() || page.output.slice(0, -5);

  // map src -> output (links)
  nav = Object.fromEntries(
    nav
      .filter(entry => entry.type === 'page')
      .map(entry => [entry.src, entry.output])
  );
  const renderer = new marked.Renderer();
  renderer.ordinaryLink = renderer.link;
  renderer.link = function(href, title, text) {
    if (href.endsWith('.md')) {
      const output =
        nav[
          path.join(
            page.src
              .split(path.sep)
              .slice(0, -1)
              .join(path.sep),
            href
          )
        ];
      if (output) href = [...page.depth.split('/'), output].join('/');
    }
    return this.ordinaryLink(href, title, text);
  };

  page.content = `
    <section class="block">
      ${marked.parser(tokens, { ...$.marked, renderer })}
    </section>`.replace(/<section class="block">\s*<\/section>/g, '');
  return page;
}
