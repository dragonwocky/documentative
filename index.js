/*
 * Documentative
 * (c) 2020 dragonwocky <thedragonring.bod@gmail.com>
 * (https://dragonwocky.me/) under the MIT License
 */

const path = require('path'),
  fs = require('fs-extra'),
  klaw = require('klaw'),
  resourceFilenames = {
    css: 'documentative-styles.css',
    js: 'documentative-scrollnav.js'
  },
  resourceCache = {},
  marked = require('marked'),
  hljs = require('highlight.js'),
  pug = require('pug'),
  less = require('less'),
  http = require('http'),
  mime = require('mime-types'),
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
  if (!inputdir)
    throw Error(`documentative: build failed, no input dir provided`);
  inputdir = path.relative('.', inputdir);
  if (!outputdir)
    throw Error(`documentative: build failed, no output dir provided`);
  outputdir = path.relative('.', outputdir);

  let files = await filelist(inputdir);
  if (!path.relative(inputdir, outputdir).startsWith('.'))
    files = files.filter(
      item => !item.startsWith(outputdir.slice(inputdir.length + 1))
    );
  config = await checkconf(inputdir, config, 'options');
  const nav = await Promise.all(
      (await processlist(inputdir, files, config.nav, 'nav')).map(
        (entry, i) => {
          if (entry.type !== 'page') return entry;
          entry.index = i;
          entry.depth = '../'.repeat(entry.output.split(path.sep).length - 1);
          return parsepage(inputdir, entry);
        }
      )
    ),
    assets = files.filter(
      item =>
        !fs.lstatSync(path.join(inputdir, item)).isDirectory() &&
        !item.endsWith('.md')
    );

  await fs.emptyDir(outputdir);

  if (!resourceCache.template)
    resourceCache.template = pug.compileFile(
      path.join(__dirname, 'resources', 'template.pug')
    );
  if (!resourceCache.scrollnav)
    resourceCache.scrollnav = await fs.readFile(
      path.join(__dirname, 'resources', 'scrollnav.js'),
      'utf8'
    );
  if (!resourceCache.styles)
    resourceCache.styles = (
      await less.render(
        (
          await fs.readFile(
            path.join(__dirname, 'resources', 'styles.less'),
            'utf8'
          )
        ).replace(/__primary__/g, config.primary)
      )
    ).css;

  await Promise.all([
    ...assets.map(async asset => {
      await fs.outputFile(
        path.join(outputdir, asset),
        await fs.readFile(path.join(inputdir, asset))
      );
      return true;
    }),
    ...nav
      .filter(entry => entry.type === 'page')
      .map(async page => {
        await fs.outputFile(
          path.join(outputdir, page.output),
          resourceCache.template({
            ...page,
            config,
            nav,
            resources: {
              css: resourceFilenames.css,
              js: resourceFilenames.js
            }
          }),
          'utf8'
        );
        return true;
      })
  ]);

  fs.outputFile(path.join(outputdir, config.icon.name), config.icon.src);

  fs.outputFile(
    path.join(outputdir, resourceFilenames.css),
    resourceCache.styles +
      [...languages]
        .map(
          lang =>
            `.documentative pre .lang-${lang}::before { content: '${lang.toUpperCase()}'; }`
        )
        .join('\n'),
    'utf8'
  );
  fs.outputFile(
    path.join(outputdir, resourceFilenames.js),
    resourceCache.scrollnav,
    'utf8'
  );
  return true;
}

async function serve(inputdir, port, config = {}) {
  if (!inputdir)
    throw Error(`documentative: serve failed, no input dir provided`);
  if (typeof port !== 'number')
    throw Error(`documentative: serve failed, port must be a number`);
  inputdir = path.relative('.', inputdir);
  config = await checkconf(inputdir, config, 'options');

  if (!resourceCache.template)
    resourceCache.template = pug.compileFile(
      path.join(__dirname, 'resources', 'template.pug')
    );
  if (!resourceCache.scrollnav)
    resourceCache.scrollnav = await fs.readFile(
      path.join(__dirname, 'resources', 'scrollnav.js'),
      'utf8'
    );
  if (!resourceCache.styles)
    resourceCache.styles = (
      await less.render(
        (
          await fs.readFile(
            path.join(__dirname, 'resources', 'styles.less'),
            'utf8'
          )
        ).replace(/__primary__/g, config.primary)
      )
    ).css;

  return http
    .createServer(async (req, res) => {
      const files = await filelist(inputdir),
        assets = files.filter(
          item =>
            !fs.lstatSync(path.join(inputdir, item)).isDirectory() &&
            !item.endsWith('.md')
        );
      let content, type;
      switch (req.url) {
        case '/' + resourceFilenames.css:
          content =
            resourceCache.styles +
            [...languages]
              .map(
                lang =>
                  `.documentative pre .lang-${lang}::before { content: '${lang.toUpperCase()}'; }`
              )
              .join('\n');
          type = 'text/css';
          break;
        case '/' + resourceFilenames.js:
          content = resourceCache.scrollnav;
          type = 'text/javascript';
          break;
        default:
          if (assets.includes(req.url.slice(1))) {
            content = await fs.readFile(path.join(inputdir, req.url.slice(1)));
            type = mime.lookup(req.url.slice(1));
          } else {
            if (req.url.endsWith('/')) req.url = req.url.slice(0, -1);
            if (
              !req.url ||
              files
                .filter(item =>
                  fs.lstatSync(path.join(inputdir, item)).isDirectory()
                )
                .includes(req.url.slice(1))
            )
              req.url += '/index.html';
            let nav = await processlist(inputdir, files, config.nav, 'nav');
            const page = nav.find(item => item.output === req.url.slice(1));
            if (page) {
              nav = await Promise.all(
                nav.map((entry, i) => {
                  if (entry.type !== 'page') return entry;
                  entry.index = i;
                  entry.depth = '../'.repeat(
                    entry.output.split(path.sep).length - 1
                  );
                  return parsepage(inputdir, entry);
                })
              );
              content = resourceCache.template({
                ...page,
                config,
                nav,
                resourcesFilenames
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

async function filelist(dir) {
  let files = [];
  for await (const item of klaw(dir)) files.push(item.path);
  files = files
    .map(item => path.relative('.', item).slice(dir.length + 1))
    .filter(item => item);
  return files.sort();
}

async function checkconf(inputdir, obj, objloc) {
  if (typeof obj !== 'object')
    throw Error(`documentative: <${objloc}> should be an object`);
  const err = prop => {
    throw Error(`documentative: invalid ${prop} in <${objloc}>`);
  };
  if ([null, undefined].includes(obj.icon) && !resourceCache.icon)
    resourceCache.icon = await fs.readFile(
      path.join(__dirname, 'resources', 'documentative.ico')
    );
  return {
    // "title": "documentative"
    title: [null, undefined].includes(obj.title)
      ? 'documentative'
      : typeof obj.title === 'string'
      ? obj.title
      : err('title'),
    // "primary": "#b20000"
    primary: [null, undefined].includes(obj.primary)
      ? '#b20000'
      : typeof obj.primary === 'string'
      ? obj.primary
      : err('primary'),
    // "icon": "logo.png"
    icon: [null, undefined].includes(obj.icon)
      ? {
          name: 'documentative.ico',
          src: resourceCache.icon
        }
      : typeof obj.icon === 'string' &&
        (await fs.pathExists(path.join(inputdir, obj.icon)))
      ? {
          name: obj.icon,
          src: await fs.readFile(path.join(inputdir, obj.icon))
        }
      : err('icon'),
    // "copyright": {
    //   "text": "© copyright 2020, dragonwocky",
    //   "url": "https://dragonwocky.me/"
    // }
    copyright: !(
      [null, undefined].includes(obj.copyright) ||
      typeof obj.copyright !== 'object' ||
      typeof obj.copyright.text !== 'string' ||
      (![null, undefined].includes(obj.copyright.url) &&
        typeof obj.copyright.url !== 'string')
    )
      ? obj.copyright
      : err('copyright')
  };
}

async function processlist(inputdir, files, obj, objloc) {
  let list;
  if (obj) {
    if (!Array.isArray(obj))
      throw Error(`documentative: <${objloc}> should be an array`);
    const err = prop => {
      throw Error(`documentative: invalid entry ${prop} in <${objloc}>`);
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
  } else {
    list = files
      .map(item =>
        fs.lstatSync(path.join(inputdir, item)).isDirectory()
          ? files.reduce(
              (prev, val) =>
                val.startsWith(item + '/') && val.endsWith('.md')
                  ? [...prev, val]
                  : prev,
              []
            ).length
            ? { type: 'title', text: item }
            : false
          : item.endsWith('.md')
          ? {
              type: 'page',
              output: item.slice(0, -3) + '.html',
              src: item
            }
          : false
      )
      // routes index.html to README.md
      .reduce(
        (prev, val) =>
          val
            ? val.src ===
              (files.includes('index.md') ? 'index.md' : 'README.md')
              ? [{ type: 'page', output: 'index.html', src: val.src }, ...prev]
              : [...prev, val]
            : prev,
        []
      );
  }
  return list;
}

async function parsepage(inputdir, page) {
  const IDs = [],
    tokens = marked.lexer(
      await fs.readFile(path.join(inputdir, page.src), 'utf8')
    );
  page.headings = [];
  for (let token of tokens) {
    if (token.type === 'heading') {
      const escaped = token.text.toLowerCase().replace(/[^\w]+/g, '-');
      let ID = escaped;
      for (let i = 0; IDs.includes(ID); i++) {
        ID = escaped + '-' + i;
      }
      IDs.push(ID);
      page.headings.push({
        name: token.text,
        depth: token.depth,
        hash: ID
      });
      token.type = 'html';
      token.text = `</section>
      <section class="block">
        <h${token.depth} id="${ID}">
          <a href="#${ID}">${token.text}</a>
        </h${token.depth}>
    `;
      delete token.depth;
    }
    if (token.type === 'code' && token.lang === 'html //example') {
      token.type = 'html';
      delete token.lang;
      token.text = `
      <div class="example">
        ${token.text}
      </div>
    `;
    }
  }
  if (!page.headings.length) page.headings.push(src.slice(0, -3));
  page.title = page.headings.shift();
  page.content = `<section class="block">
                  ${marked.parser(tokens)}
                </section>`.replace(
    new RegExp(`<section class="block">\\s*</section>`, 'g'),
    ''
  );
  return page;
}

module.exports = { build, serve };
