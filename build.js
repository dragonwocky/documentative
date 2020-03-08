const doc = require('./index.js');

doc
  .build('pages', 'pages/build')
  .then(console.log)
  .catch(console.log);
