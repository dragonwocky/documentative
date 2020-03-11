#!/usr/bin/env node
const doc = require('./index.js');

doc
  .serve('pages', 3000, {
    title: 'sear',
    icon: 'logo.png',
    copyright: { text: 'lol', url: 'ok' }
  })
  .then(console.log)
  .catch(console.log);
