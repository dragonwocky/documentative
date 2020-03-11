#!/usr/bin/env node
// const doc = require('../index.js');

// doc
//   .serve('pages', 3000, {
//     title: 'sear',
//     icon: 'logo.png',
//     copyright: { text: 'lol', url: 'ok' }
//   })
//   .then(console.log)
//   .catch(console.log);

require('yargs') // eslint-disable-line
  .command(
    'serve [port]',
    'start the server',
    yargs => {
      yargs.positional('port', {
        describe: 'port to bind on',
        default: 5000
      });
    },
    argv => {
      if (argv.verbose) console.info(`start server on :${argv.port}`);
      console.log(serve);
    }
  )
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging'
  }).argv;
