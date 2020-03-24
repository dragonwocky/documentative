const marked = require('marked');

const md = `
  # he[a](d)ing

  oh ok then [link](page.md)

`;

const tokens = marked.lexer(md);

console.log('---');

const rend = new marked.Renderer();

rend.ordinaryLink = rend.link;
rend.link = function(href, title, text) {
  return this.ordinaryLink(href, title, text);
};

const html = marked.parser(tokens, { renderer: rend });
console.log(html);
console.log('---');

console.log(tokens);
