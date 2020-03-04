module.exports = async function(dir) {
  const path = require('path'),
    fs = require('fs-extra'),
    marked = require('marked'),
    hljs = require('highlight.js'),
    pug = require('pug');

  if (!dir) throw Error(`documentative build failed: no dir provided`);
  await fs.promises.access(dir);

  let conf;
  try {
    conf = await fs.readFile(path.join(dir, 'conf.json'), 'utf8');
    try {
      conf = JSON.parse(conf);
    } catch (err) {
      throw Error('documentative: invalid <conf.json> contents');
    }
  } catch {
    conf = {};
  }
  conf.title = conf.title || 'Documentative';
  conf.primary = typeof conf.primary === 'object' ? conf.primary : {};
  conf.primary.light = conf.primary.light || '#b20000';
  conf.primary.dark = conf.primary.dark || '#f33';
  try {
    if (!conf.icon) throw Error;
    conf.icon = {
      name: conf.icon,
      src: await fs.readFile(path.join(dir, conf.icon))
    };
  } catch {
    conf.icon = {
      name: 'documentative.ico',
      src: await fs.readFile(
        path.join(__dirname, 'resources', 'documentative.ico'),
        'utf8'
      )
    };
  }

  const files = (await fs.readdir(dir)).filter(file => file.endsWith('.md')).sort();
  if (Array.isArray(conf.nav)) {
    conf.nav = conf.nav.map(link => {
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
    conf.nav = files;
    if (conf.nav.includes('index.md'))
      conf.nav.splice(0, 0, conf.nav.splice(conf.nav.indexOf('index.md'), 1)[0]);
  }

  const renderer = new marked.Renderer();
  marked.setOptions({
    renderer: renderer,
    highlight: (code, language) =>
      hljs.highlight(hljs.getLanguage(language) ? language : 'plaintext', code).value,
    langPrefix: 'lang-',
    gfm: true
  });

  const pages = [],
    IDs = [];
  for (file of conf.nav) {
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
      if (tokens[i].type === 'code' && tokens[i].lang === 'example') {
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
        conf
      }),
      'utf8'
    );
  }
  fs.outputFile(path.join(dir, 'build', conf.icon.name), conf.icon.src, 'utf8');
  fs.outputFile(
    path.join(dir, 'build', 'styles.css'),
    (await fs.readFile(path.join(__dirname, 'resources', 'styles.css'), 'utf8'))
      .replace(/__light__/g, conf.primary.light)
      .replace(/__dark__/g, conf.primary.dark),
    'utf8'
  );
  fs.outputFile(
    path.join(dir, 'build', 'scrollnav.js'),
    await fs.readFile(path.join(__dirname, 'resources', 'scrollnav.js'), 'utf8'),
    'utf8'
  );
};
