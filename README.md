# documentative

a tool for precompiling docs from markdown

[![npm](https://badgen.net/npm/v/documentative)](https://npmjs.com/package/documentative)
[![install size](https://badgen.net/packagephobia/install/documentative)](https://packagephobia.now.sh/result?p=documentative)
[![downloads](https://badgen.net/npm/dt/documentative)](https://npmjs.com/package/documentative)
[![license](https://badgen.net/npm/license/documentative)](https://dragonwocky.me/#mit)

## what is this? why use it?

there are a lot of tools out there for publishing websites and for generating documentation.
some are really powerful - even to the extend of processing code and building docs straight from that.
sometimes it's just simpler to write some markdown and publish it as a static site on github pages.

i was doing that a lot: and since i was writing markdown and then also manually building a matching
website, i was spending nearly as much time on that as i was on coding the project itself. i had a
reasonably solid template i was using already, so i did what leads many people to publishing things
like this: i thought to myself "how can i automate this?"

documentative cuts out half the work - you write the markdown; it builds you a responsive, modern website.

## usage

this package is available from the npm package registry.

```bash
npm i -s documentative
```

```js
const docs = require('documentative');
```

#### to build/precompile to a directory

```js
docs.build(inputdir, outputdir, options);
// returns a promise: resolves to true
```

| argument    | type   | value                    |
| ----------- | ------ | ------------------------ |
| `inputdir`  | string | e.g. `"pages"`           |
| `outputdir` | string | e.g. `"build"`           |
| `options`   | object | see [#options](#options) |

if you wish your `inputdir` and `outputdir` to be the same,
that works too - just enable the overwrite option (see [#options](#options)).

```js
docs.build('.', '.', { overwrite: true });
```

#### to serve the directory from a local http server

```js
docs.serve(inputdir, port, options);
// returns a promise: resolves to the started http server
```

| argument   | type   | value                    |
| ---------- | ------ | ------------------------ |
| `inputdir` | string | e.g. `"pages"`           |
| `port`     | number | e.g. `8080`              |
| `options`  | object | see [#options](#options) |

> ❗ not recommended unless for testing purposes
> \- especially if serving a larger directory,
> as it will re-read the entire directory for
> every file serve.

## cli

```
usage:

  > documentative-build <inputdir> <outputdir>
  e.g. documentative-build pages build

  > documentative-serve <inputdir> [--port, -p PORT]
  e.g. documentative-serve pages -p 3000

options:
  --help, -h   show this message
  --port, -p   set the HTTP server port used by documentative-serve
    (default: 8080)

** to configure the process, place configuration options into
   <inputdir>/docs.json
```

> ℹ️ the `<inputdir>/docs.json` file will be added
> to the exclude list (see [#options](#options))

## writing a page

pages are written in github flavoured markdown.

it is recommended to start every page with a `# h1`, as that is what is used
for the sidebar table-of-contents documentative generates.

in order to maintain viability of pages as both markdown and html, any local markdown page
links are changed to match page src -> output. e.g. a link written as `[link](README.md)`
may transformed to `<a href="index.html">link</a>`.

check out [the styling guide](styling-guide.md) for ways to further customise what comes out.

## options

```js
{
  title: string,
    // default: "documentative"
  primary: string,
    // default: "#712c9c"
  icon: string/filepath,
    // default: the documentative icon
  copyright: {
    text: string,
      // default: "© 2020 dragonwocky, under the MIT license"
    url: string/link
      // default: "https://dragonwocky.me/#mit"
  },
  overwrite: boolean,
    // default: false
  exclude: [],
    // default: []
  nav: []
    // (see below)
}
```

> ❗ beware of turning on overwrite, as any files copied
> across from the inputdir will irreversibly overwrite
> files in the outputdir with conflicting names.

> ℹ️ any files within `.git` or `node_modules`
> directories will always be excluded, regardless of
> inclusion in the above list.

if you wish to completely hide the `copyright`,
simply set the following:

```js
copyright: {
  text: '',
}
```

### the nav: default behaviour

1. all markdown files are listed.
2. nav entry names are the first header within the `.md`,
   or the filename.
3. entries are sorted by alphabetical order,
   though the `index.md` file is always first.
4. if there is no `index.md` but there is a `README.md`,
   it becomes the first in the order and is output as `index.html`.
5. entries are categorised by directory (a title is added
   with the name of the directory).

### the nav: custom behaviour

#### defining a title

strict definition:

```js
{
  type: 'title',
  text: string // e.g. 'this is a title'
}
```

shorthand:

```js
string,
// e.g. 'this is a title'
```

#### defining a page

strict definition:

```js
{
  type: 'page',
  output: string/filepath, // e.g. getting-started.html
  src: string/filepath // e.g. tutorial.md
}
```

shorthand:

```js
[output, src],
// e.g. ['getting-started.html', 'tutorial.md']
```

> if the src is not a valid/existing file, it will be assumed to be a link.

#### defining a link

strict definition:

```js
{
  type: 'link',
  text: string, // e.g. github
  url: string/link // e.g. https://github.com/dragonwocky/documentative/
}
```

shorthand:

```js
[text, url],
// e.g. ['github', 'https://github.com/dragonwocky/documentative/']
```

#### example nav

strict definition:

```js
[
  { type: 'page', output: 'getting-started.html', input: 'tutorial.md' },
  { type: 'title', text: 'resources' },
  {
    type: 'link',
    text: 'github',
    url: 'https://github.com/dragonwocky/documentative/'
  }
];
```

shorthand:

```js
[
  ['getting-started.html', 'tutorial.md'],
  'resources',
  ['github', 'https://github.com/dragonwocky/documentative/']
];
```

(these methods can be mixed.)

## output

#### build

1. the output directory is created if it does not already exist.
2. all assets (non-`.md`) files are copied across as they are.
3. all markdown files included in the nav are output.
4. documentative resource files are copied across: `scrollnav.js`,
   `styles.css` and (only if no icon has been specified in the
   build/serve options) `documentative.ico`.

> ❗ note that this means you cannot have any assets with those
> names, as they will be overwritten.

#### serve

a http server is created. whenever a request is received:

1. if `scrollnav.js` or `styles.css` are requested, serve them
   from documentative's resources.
2. if an icon has been specified and is requested, serve it.
   otherwise, the icon shall be served as `documentative.ico`.
3. if the file exists in the asset list (all non-`.md` files),
   serve it.
4. if a nav entry of type page and with an output
   matching the request exists, serve it.
5. if a file has still not been served, return a 404 error.

> ❗ note that this means if you have a `.html` file called (e.g.)
> `getting-started.html` and a `.md` file with its output set to
> `getting-started.md`, the parsed `.md` will override the `.html` file.

## other details

yes, some of the code blocks on this page end with unnecessary commas. my linter enforces it.

i also have an unhealthy habit of avoiding capital letters. nothing enforces this, i just do it.

if you have any questions, check my website for contact details.
