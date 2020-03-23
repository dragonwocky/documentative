/*
 * Documentative
 * (c) 2020 dragonwocky <thedragonring.bod@gmail.com>
 * (https://dragonwocky.me/) under the MIT License
 */

const path = require('path'),
  fs = require('fs-extra'),
  klaw = require('klaw'),
  marked = require('marked'),
  hljs = require('highlight.js'),
  pug = require('pug'),
  less = require('less'),
  resourceCache = {},
  renderer = new marked.Renderer(),
  languages = new Set();
marked.setOptions({
  renderer: renderer,
  highlight: (code, language) => {
    language = hljs.getLanguage(language) ? language : 'plaintext';
    languages.add(language);
    return hljs.highlight(language, code).value;
  },
  langPrefix: 'lang-',
  gfm: true
});

module.exports = class Documentative {
  constructor(inputdir, config) {
    if (!inputdir) throw Error(`documentative: init failed, no input dir provided`);
    this.inputdir = inputdir;
    if (!config) config = {};
    config.title = typeof config.title === 'string' ? config.title : 'documentative';
    config.primary = typeof config.primary === 'string' ? config.primary : '#b20000';
    this.config = config;
    return { build: this.build.bind(this), serve: this.serve.bind(this) };
  }
  async build(outputdir) {
    if (!outputdir) throw Error(`documentative: build failed, no output dir provided`);
    await this.files();
    const iterationDATA = await this.data();
    iterationDATA.menu = await Promise.all(
      iterationDATA.menu.map((entry, i) => {
        if (entry.type !== 'page') return entry;
        entry.index = i;
        entry.depth = '../'.repeat(path.dirname(entry.output).length);
        return this.parse(entry);
      })
    );

    if (!resourceCache.template)
      resourceCache.template = pug.compileFile(
        path.join(__dirname, 'resources', 'template.pug')
      );
    await fs.emptyDir(outputdir);
    iterationDATA.menu
      .filter(entry => entry.type === 'page')
      .forEach(page => {
        fs.outputFile(
          path.join(outputdir, page.output),
          resourceCache.template({
            ...page,
            data: iterationDATA
          }),
          'utf8'
        );
      });

    fs.outputFile(path.join(outputdir, iterationDATA.icon.name), iterationDATA.icon.src);

    if (!resourceCache.styles)
      resourceCache.styles = (
        await less.render(
          (
            await fs.readFile(path.join(__dirname, 'resources', 'styles.less'), 'utf8')
          ).replace(/__primary__/g, iterationDATA.primary)
        )
      ).css;
    fs.outputFile(
      path.join(outputdir, 'styles.css'),
      resourceCache.styles +
        [...languages]
          .map(
            lang =>
              `.documentative pre .lang-${lang}::before { content: '${lang.toUpperCase()}'; }`
          )
          .join('\n'),
      'utf8'
    );

    if (!resourceCache.scrollnav)
      resourceCache.scrollnav = await fs.readFile(
        path.join(__dirname, 'resources', 'scrollnav.js'),
        'utf8'
      );
    fs.outputFile(path.join(outputdir, 'scrollnav.js'), resourceCache.scrollnav, 'utf8');
    return iterationDATA;
  }
  serve() {}
  async parse(page) {
    const IDs = [],
      tokens = marked.lexer(
        await fs.readFile(path.join(this.inputdir, page.src), 'utf8')
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

  async data() {
    const err = prop => {
      throw Error(`documentative: invalid ${prop} in <config.json>`);
    };
    let iterationCONF;
    if (await fs.pathExists(path.join(this.inputdir, 'config.json'))) {
      try {
        iterationCONF = JSON.parse(
          await fs.readFile(path.join(this.inputdir, 'config.json'), 'utf8')
        );
      } catch (err) {
        throw Error('documentative: invalid <config.json> contents');
      }
    } else iterationCONF = {};
    // "title": "documentative"
    if (iterationCONF.title) {
      if (typeof iterationCONF.title !== 'string') err('title');
    } else iterationCONF.title = this.config.title;
    // "primary": "#b20000"
    if (iterationCONF.primary) {
      if (typeof iterationCONF.primary !== 'string') err('primary');
    } else iterationCONF.primary = this.config.primary;
    // "icon": "logo.png"
    if (iterationCONF.icon) {
      if (
        typeof iterationCONF.icon !== 'string' ||
        !(await fs.pathExists(path.join(this.inputdir, iterationCONF.icon)))
      )
        err('icon');
      iterationCONF.icon = {
        name: iterationCONF.icon,
        src: await fs.readFile(path.join(this.inputdir, iterationCONF.icon))
      };
    } else {
      if (!resourceCache.icon)
        resourceCache.icon = await fs.readFile(
          path.join(__dirname, 'resources', 'documentative.ico')
        );
      iterationCONF.icon = {
        name: 'documentative.ico',
        src: resourceCache.icon
      };
    }
    // "copyright": {
    //   "text": "© copyright 2020, dragonwocky",
    //   "url": "https://dragonwocky.me/"
    // },
    if (
      iterationCONF.copyright &&
      (typeof iterationCONF.copyright !== 'object' ||
        typeof iterationCONF.copyright.text !== 'string' ||
        (iterationCONF.copyright.url && typeof iterationCONF.copyright.url !== 'string'))
    )
      err('copyright');
    iterationCONF.menu = await this.menu(iterationCONF.menu);
    return iterationCONF;
  }
  async menu(config) {
    await this.filelist();
    let menu;
    if (config) {
      const err = prop => {
        throw Error(`documentative: invalid menu entry ${prop} in <config.json>`);
      };
      if (!Array.isArray(config))
        throw Error('documentative: invalid menu in <config.json>');
      menu = Promise.all(
        config.map(async entry => {
          if (typeof entry === 'string')
            // "title"
            return {
              type: 'title',
              text: entry
            };
          if (Array.isArray(entry)) {
            if (entry.length !== 2) err(`format '${entry}'`);
            if (this.files.includes(entry[1]))
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
            //    (link + title) text: displayed text
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
          err(`format '${entry}'`);
        })
      );
    } else {
      menu = this.files.filter(file => file.endsWith('.md'));
      const potentialIndex = menu.includes('index.md') ? 'index.md' : 'README.md';
      menu = menu
        .map(file => ({
          type: 'page',
          output: file.slice(0, -3) + '.html',
          src: file
        }))
        .reduce(
          (prev, val) =>
            val.src === potentialIndex
              ? [{ type: 'page', output: 'index.html', src: val.src }, ...prev]
              : [...prev, val],
          []
        );
    }

    return menu;
    // throw Error('documentative: invalid <config.json> menu list');

    // NEEDS REBUILDING
    //   config = config.map(link => {
    //     if (files.includes(link)) return link;
    //     if (Array.isArray(link))
    //       return {
    //         type: 'link',
    //         name: link[0],
    //         url: link[1]
    //       };
    //     return {
    //       type: 'link',
    //       name: link,
    //       url: link
    //     };
    //   });
    // } else {
    //   config = files;
    //   if (config.menu.includes('index.md')) {
    //     config.menu.splice(
    //       0,
    //       0,
    //       config.menu.splice(config.menu.indexOf('index.md'), 1)[0]
    //     );
    //   } else if (config.menu.includes('README.md'))
    //     config.menu.splice(
    //       0,
    //       0,
    //       config.menu.splice(config.menu.indexOf('README.md'), 1)[0]
    //     );
    // }
    // return { files, menu: config };
  }

  async filelist() {
    if (!this.files) {
      this.files = [];
      for await (const item of klaw(this.inputdir)) this.files.push(item.path);
      this.files = this.files
        .filter(item => !fs.lstatSync(item).isDirectory())
        .map(item => path.relative('.', item).slice(this.inputdir.length + 1));
      // for links - don't forget page depth!
    }
    return true;
  }
  clear() {
    this.files = null;
  }
};
