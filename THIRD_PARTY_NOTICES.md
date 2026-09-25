# Third-party notices

Eigenstate's original code is licensed under MIT. Dependencies and adapted color palettes retain their own licenses and copyright notices.

## Runtime

Vue and its bundled runtime packages are MIT licensed, copyright (c) 2018-present Yuxi (Evan) You. The complete notice is in [docs/licenses/vue.txt](docs/licenses/vue.txt). Source: [vuejs/core](https://github.com/vuejs/core).

## Color palettes

These themes adapt palette colors for Eigenstate's interface and Canvas renderer. They do not include editor extensions, fonts, or artwork.

| Palette | Source | License and copyright |
| --- | --- | --- |
| Tokyo Night | [tokyo-night-vscode-theme](https://github.com/tokyo-night/tokyo-night-vscode-theme) | [MIT](docs/licenses/tokyo.txt), 2018-present Enkia |
| Synthwave '84 | [synthwave-vscode](https://github.com/robb0wen/synthwave-vscode) | [MIT](docs/licenses/synth.txt), 2019 Robb Owen |
| Nord | [nordtheme/nord](https://github.com/nordtheme/nord) | [MIT](docs/licenses/nord.txt), 2016-present Sven Greb |
| Catppuccin Mocha | [catppuccin/catppuccin](https://github.com/catppuccin/catppuccin) | [MIT](docs/licenses/cat.txt), 2021 Catppuccin |

The default Eigenstate and Solarpunk palettes, procedural graphics, icon, and synthesized hum are original work. The colophon and theme shortcut conventions follow Stillpoint.guru, another project by Matthew Williamson. No Stillpoint source code or audio assets are included.

## Development tools

Vite, TypeScript, vue-tsc, Wrangler, and their dependencies are used for development and packaging. Tests use fake-indexeddb under Apache-2.0. They are not shipped as application runtime code. Their license files remain in the installed packages; exact versions are recorded in `package-lock.json`.
