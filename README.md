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

## usage

this package is available from the npm package registry.

```bash
npm i -s documentative
```

```js
const doc = require('documentative');
```

<br>

**to build/precompile to a directory:**

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

<br>

**to serve the directory from a local http server:**

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
> every single file

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
   <inputdir>/config.json - check the docs for info on these options
```

## options

```js
{
  title: string,
    // type: string
    // default: "documentative"
  primary: ,
    // type: string
    // default: "#b20000"
  icon: ,
    // type: string, filepath
    // default: the documentative icon
  copyright: {
    text: ,
      // type: string
      // default: none
    url: ,
      // type: string, link
      // default: none
  }
}
```
