#!/usr/bin/env node
// const doc = require('../index.js');

require('../index.js')
  .build('pages', 'build', {
    copyright: { text: 'lol', url: 'ok' }
  })
  .then(console.log)
  .catch(console.error);
// 'use strict';
// const meow = require('meow');
// const foo = require('.');

// const cli = meow(
//   `
// 	Usage
// 	  $ foo <input>

// 	Options
// 	  --rainbow, -r  Include a rainbow

// 	Examples
// 	  $ foo unicorns --rainbow
// 	  🌈 unicorns 🌈
// `,
//   {
//     flags: {
//       rainbow: {
//         type: 'boolean',
//         alias: 'r'
//       }
//     }
//   }
// );
// /*
// {
// 	input: ['unicorns'],
// 	flags: {rainbow: true},
// 	...
// }
// */

// foo(cli.input[0], cli.flags);
