#!/usr/bin/env node

/*
 * Documentative CLI
 * (c) 2020 dragonwocky <thedragonring.bod@gmail.com>
 * (https://dragonwocky.me/) under the MIT license
 */

const argv = require('minimist')(process.argv.slice(2));

if (!argv['_'].length || argv.h || argv.help) {
  const pkg = require('./package.json');
  console.log(`
documentative v${pkg.version}
  by ${pkg.author}
  licensed under the ${pkg.license} license
  for more info, go to ${pkg.homepage}

usage:

  > documentative-build <inputdir> <outputdir>
  e.g. documentative-build pages build

  > documentative-serve <inputdir> [-p PORT]
  e.g. documentative-serve pages -p 3000

options:
  --help, -h   show this message
  --port, -p   set the HTTP server port used by documentative-serve
    (default: 8080)

** to configure the process, place configuration options into
   <inputdir>/config.json - check the docs for info on these options
  `);
} else if (process.argv[1].endsWith('/documentative-build')) {
  const fs = require('fs'),
    path = require('path');
  require('./improved.js')
    .build(argv['_'][0], argv['_'][1], {
      ...(fs.existsSync(path.join(argv['_'][0], 'config.json'))
        ? JSON.parse(
            fs.readFileSync(path.join(argv['_'][0], 'config.json'), 'utf8')
          )
        : {}),
      CLI: true
    })
    .then(success => {
      if (success)
        console.log(
          `documentative: sucessfully built ${argv['_'][0]} to ${argv['_'][1]}`
        );
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
} else if (process.argv[1].endsWith('/documentative-serve')) {
  const fs = require('fs'),
    path = require('path'),
    port = ![null, undefined].includes(argv.p)
      ? argv.p
      : ![null, undefined].includes(argv.port)
      ? argv.port
      : 8080;
  require('./improved.js')
    .serve(argv['_'][0], port, {
      ...(fs.existsSync(path.join(argv['_'][0], 'config.json'))
        ? JSON.parse(
            fs.readFileSync(path.join(argv['_'][0], 'config.json'), 'utf8')
          )
        : {}),
      CLI: true
    })
    .then(server => {
      console.info(
        `Serving HTTP on 0.0.0.0 port ${port} (http://localhost:${port}/)...`
      );
      server.on('request', (req, res) => {
        console.info(
          `- served ${req.url} to ${(req.headers['x-forwarded-for'] || '')
            .split(',')
            .pop() ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress}`
        );
      });
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
