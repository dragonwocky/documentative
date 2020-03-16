# documentative

a tool for precompiling docs from markdown

`// add badges`

## what is this? why use it?

there are a lot of tools out there for publishing websites and for generating documentation.
some are really powerful. sometimes too powerful, or too complicated - they'll process commented source code
to build an API documentation, or will on-the-fly process markdown into your website, requiring a server
to run. sometimes it's simpler to just build something yourself and serve it from github pages.

i was doing that a lot: and it was taking me nearly as long to build/update the documentation each time
as it was to actually build/update the project itself. this is, essentially, a node tool that will precompile
documentation from markdown docs. though I could have used Sphinx or MkDocs, I already had a fairly capable
template I had put a decent amount of work into. so, I just built a parser/generator for it.

documentative may not make writing documentation easier, but it sure does make help when it comes to
publishing and maintaining it.

## usage

this package is available from the npm package registry.

```bash
npm i -s documentative
```

```js
const doc = require('documentative');
```

#### to build/precompile to a directory

```js
doc.build(inputdir, outputdir, options);
// returns a promise: resolves to true
```

| argument    | type   | value                    |
| ----------- | ------ | ------------------------ |
| `inputdir`  | string | e.g. `"pages"`           |
| `outputdir` | string | e.g. `"build"`           |
| `options`   | object | see [#options](#options) |

> ❗ ensure the output directory is safely empty! all files within it will be deleted.

#### to serve the directory from a local http server

```js
doc.serve(inputdir, port, options);
// returns a promise: resolves to the started http server
```

| argument   | type   | value                    |
| ---------- | ------ | ------------------------ |
| `inputdir` | string | e.g. `"pages"`           |
| `port`     | number | e.g. `8080`              |
| `options`  | object | see [#options](#options) |

> ❗ not recommended unless for testing purposes
> \- especially if serving a larger directory,
> as it will re-read the entire directory to serve
> every single file.

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
   <inputdir>/config.json
```

## writing a page

pages are written in github flavoured markdown.

it is recommended to start every page with a `# h1`, as that is what is used
for the sidebar table-of-contents documentative generates.

in order to maintain viability of pages as both markdown and html, any local (same hostname)
links ending in `.md` are changed to `.html`. in order words: to link to other pages, write
your links as `[link](page.md)` and they will come out as `<a href="page.html">link</a>`.

check out [the styling guide](styling-guide.md) for ways to further customise what comes out.

# options

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
    url: string/link
  }, // default: none
  nav: [] // (see below)
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
string;
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
[output, src];
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
[text, url];
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

1. the output directory is emptied or created.
2. all markdown files included in the nav are output.
3. all assets (non-`.md`) files are copied across as they are
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
> `getting-started.md`, the `.html` asset will override the parsed
> `.md`.

## potential future features

- single-file compile
- exclude list
