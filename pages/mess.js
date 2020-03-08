/*
 * Documentative
 * (c) 2020 dragonwocky <thedragonring.bod@gmail.com>
 * (https://dragonwocky.me/) under the MIT License
 */

module.exports = async function(dir) {
  const path = require('path'),
    fs = require('fs-extra'),
    marked = require('marked'),
    hljs = require('highlight.js'),
    pug = require('pug'),
    less = require('less');

  if (!dir) throw Error(`documentative build failed: no dir provided`);
  await fs.promises.access(dir);

  let config;
  try {
    config = await fs.readFile(path.join(dir, 'config.json'), 'utf8');
    try {
      config = JSON.parse(config);
    } catch (err) {
      throw Error('documentative: invalid <config.json> contents');
    }
  } catch {
    config = {};
  }
  config.title = config.title || 'Documentative';
  config.primary = config.primary || '#b20000';
  try {
    if (!config.icon) throw Error;
    config.icon = {
      name: config.icon,
      src: await fs.readFile(path.join(dir, config.icon))
    };
  } catch {
    config.icon = {
      name: 'documentative.ico',
      src: await fs.readFile(path.join(__dirname, 'resources', 'documentative.ico'))
    };
  }

  const files = (await fs.readdir(dir)).filter(file => file.endsWith('.md')).sort();
  if (Array.isArray(config.menu)) {
    config.menu = config.menu.map(link => {
      if (files.includes(link)) return link;
      if (Array.isArray(link))
        return {
          type: 'link',
          name: link[0],
          url: link[1]
        };
      return {
        type: 'link',
        name: link,
        url: link
      };
    });
  } else {
    config.menu = files;
    if (config.menu.includes('index.md'))
      config.menu.splice(0, 0, config.menu.splice(config.menu.indexOf('index.md'), 1)[0]);
  }

  const renderer = new marked.Renderer(),
    languages = [];
  marked.setOptions({
    renderer: renderer,
    highlight: (code, language) => {
      language = hljs.getLanguage(language) ? language : 'plaintext';
      languages.push(language);
      return hljs.highlight(language, code).value;
    },
    langPrefix: 'lang-',
    gfm: true
  });

  const pages = [],
    IDs = [];
  for (file of config.menu) {
    if (file.type === 'link') {
      pages.push(file);
      continue;
    }
    const tokens = marked.lexer(await fs.readFile(path.join(dir, file), 'utf8')),
      headings = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === 'heading') {
        const escaped = tokens[i].text.toLowerCase().replace(/[^\w]+/g, '-');
        let ID = escaped,
          duplicates = 1;
        while (IDs.includes(ID)) {
          duplicates++;
          ID = escaped + '-' + duplicates;
        }
        IDs.push(ID);

        headings.push({
          name: tokens[i].text,
          depth: tokens[i].depth,
          hash: ID
        });
        tokens[i].type = 'html';
        tokens[i].text = `
          </section>
          <section class="block">
            <h${tokens[i].depth} id="${ID}">
              <a href="#${ID}">${tokens[i].text}</a>
            </h${tokens[i].depth}>
        `;
        delete tokens[i].depth;
      }
      if (tokens[i].type === 'code' && tokens[i].lang === 'html //example') {
        tokens[i].type = 'html';
        delete tokens[i].lang;
        tokens[i].text = `
          <div class="example">
            ${tokens[i].text}
          </div>
        `;
      }
    }
    file = file
      .split('.')
      .slice(0, -1)
      .join('.');
    if (!headings.length) headings.push(file);
    pages.push({
      type: 'page',
      file: `${file}.html`,
      url: file === 'index' ? './' : `${file}.html`,
      title: headings[0],
      headings: headings.slice(1),
      content: `<section class="block">
                  ${marked.parser(tokens)}
                </section>`.replace(
        new RegExp(`<section class="block">\\s*</section>`, 'g'),
        ''
      )
    });
  }

  await fs.emptyDir(path.join(dir, 'build'));
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].type === 'link') continue;
    pages[i].pages = pages;
    pages[i].index = i;
    fs.outputFile(
      path.join(dir, 'build', pages[i].file),
      pug.renderFile(path.join(__dirname, 'resources', 'template.pug'), {
        ...pages[i],
        config
      }),
      'utf8'
    );
  }
  fs.outputFile(path.join(dir, 'build', config.icon.name), config.icon.src, 'utf8');
  fs.outputFile(
    path.join(dir, 'build', 'styles.css'),
    (
      await less.render(
        (
          await fs.readFile(path.join(__dirname, 'resources', 'styles.less'), 'utf8')
        ).replace(/__primary__/g, config.primary)
      )
    ).css +
      languages
        .reduce((prev, val) => {
          if (!Array.isArray(prev)) return [prev];
          if (prev.includes(val)) return prev;
          return [...prev, val];
        })
        .map(
          lang =>
            `.documentative pre .lang-${lang}::before { content: '${lang.toUpperCase()}'; }`
        )
        .join('\n'),
    'utf8'
  );
  fs.outputFile(
    path.join(dir, 'build', 'scrollnav.js'),
    await fs.readFile(path.join(__dirname, 'resources', 'scrollnav.js'), 'utf8'),
    'utf8'
  );
};
