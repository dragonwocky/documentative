# styling guide

to add a custom stylesheet, simply append a html
`<link rel="stylesheet" src="custom.css">` to the top of the page.

nice things in the default styles (other than general looks):

- responsive! mobile support is robust, with the sidebar transforming into
  a hamburger-triggered menu
- light/dark mode that matches the user's system mode

## the example block

in order to show raw html in a standout way, use an example block:

````md
```html //example
<button style="background: var(--button); color: var(--text)">click me</button>
```
````

```html //example
<button style="background: var(--button); color: var(--text)">click me</button>
```

## theming - colours

the theme is built with css variables, in order to be easily completely
changed (colour-wise).

to change a colour for the default (aka light theme), define it within the
`:root` wrapper like so:

```css
:root {
  --bg: #b6d2ca;
}
```

to change a colour for the dark theme, define it within the
`@media (prefers-color-scheme: dark)` wrapper like so:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --button: #9d4f83;
  }
}
```

#### variables

| variable                                    | default (light)                                         | default (dark)                 |
| ------------------------------------------- | ------------------------------------------------------- | ------------------------------ |
| `--primary`                                 | defined in [the build/serve options](README.md#options) | -                              |
| `--absolute`                                | `#000`                                                  | `#fff`                         |
| `--contrast`                                | `#fff`                                                  | `#000`                         |
| `--text`                                    | `rgba(0, 0, 0, 0.84)`                                   | `#ddd`                         |
| `--link`                                    | `--primary`                                             | 22.5% lighter than `--primary` |
| `--grey`                                    | `#dedede`                                               | `#36393f`                      |
| `--bg`                                      | `#fbfcfc`                                               | `#0e0f0f`                      |
| `--box`                                     | `#f2f3f4`                                               | `#050505`                      |
| `--code`                                    | `#f7f9f9`                                               | `#000`                         |
| `--button` (for the page navigation arrows) | `#eee`                                                  | `#2d2d2d`                      |
| `--border`                                  | `#e5e7e9`                                               | `#2d2e2f`                      |
| `--shadow`                                  | `#eee`                                                  | `#070707`                      |
| `--glow`                                    | `transparent`                                           | `var(--primary)`               |
| `--scroll`                                  | `#e9e9e9`                                               | `#202225`                      |
| `--hover`                                   | `#dedede`                                               | `#36393f`                      |
| `--code-lang`                               | `#555`                                                  | `#ccc`                         |
| `--hljs-html`                               | `#000080`                                               | `#46db8c`                      |
| `--hljs-attr`                               | `#008080`                                               | `#dd1111`                      |
| `--hljs-obj`                                | `#2c426b`                                               | `#c6cbda`                      |
| `--hljs-string`                             | `#d14`                                                  | `#abcdef`                      |
| `--hljs-builtin`                            | `#0086b3`                                               | `#b8528d`                      |
| `--hljs-keyword`                            | `rgba(0, 0, 0, 0.84)`                                   | `#2d8b59`                      |
| `--hljs-selector`                           | `#900`                                                  | -                              |
| `--hljs-type`                               | `#458`                                                  | -                              |
| `--hljs-regex`                              | `#009926`                                               | -                              |
| `--hljs-symbol`                             | `#990073`                                               | -                              |
| `--hljs-meta`                               | `#999`                                                  | -                              |
| `--hljs-comment`                            | `#707070`                                               | `#a0a0a0`                      |
| `--hljs-deletion`                           | `#e8b9b8`                                               | `#4c232d`                      |
| `--hljs-deletion-text`                      | `#4c232d`                                               | `#e8b9b8`                      |
| `--hljs-addition`                           | `#b9e0d3`                                               | `#1e4839`                      |
| `--hljs-addition-text`                      | `#1e4839`                                               | `#b9e0d3`                      |

## theming - classes

| class                          | connected element/s                                                   |
| ------------------------------ | --------------------------------------------------------------------- |
| `.title`                       | the (container for) the title in the sidebar                          |
| `.icon`                        | the icon in the sidebar title                                         |
| `.active`                      | the currently focused/highlighted sidebar item                        |
| `.level-N` (up to `.level-6` ) | sidebar items related to `## headers` on the page                     |
| `.wrapper`                     | the combined container for the body and the mobile navbar             |
| `.documentative`               | the page content                                                      |
| `.blobk`                       | a section (a header + all content until the next header)              |
| `.example`                     | an [example block](#the-example-block)                                |
| `.prev`                        | the previous page button: ᐊ                                           |
| `.next`                        | the previous page button: ᐅ                                           |
| `.copyright`                   | the footer defined by [the build/serve options](README.md#options)    |
| `.toggle`                      | the mobile nav bar, inc. the hamburger button                         |
| `.mobilemenu`                  | the class toggled on/off the body to open/close the sidebar on mobile |

\+ the highlight.js classes (see [their docs](https://highlightjs.readthedocs.io/en/latest/css-classes-reference.html))
