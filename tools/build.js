'use strict';
// Builds a clean static bundle in dist/ (no dev tools) for Cloudflare Pages or any static host.
//   node tools/build.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist');
const version = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'js'), { recursive: true });
fs.mkdirSync(path.join(dist, 'icons'), { recursive: true });

const copy = (rel) => fs.copyFileSync(path.join(root, rel), path.join(dist, rel));
['index.html', 'style.css', 'manifest.webmanifest', '_headers'].forEach(copy);
// stamp every script/style URL with the build version so browsers never mix files from two deploys
fs.writeFileSync(path.join(dist, 'index.html'), fs.readFileSync(path.join(dist, 'index.html'), 'utf8').replace(/(src="js\/[\w.]+\.js|href="style\.css)"/g, '$1?v=' + version + '"'));
fs.readdirSync(path.join(root, 'js')).filter((f) => f.endsWith('.js')).forEach((f) => copy('js/' + f));
if (fs.existsSync(path.join(root, 'icons'))) fs.readdirSync(path.join(root, 'icons')).forEach((f) => copy('icons/' + f));
// optional hand-made art: write its manifest and copy the folder
require('./make_manifest')(root);
if (fs.existsSync(path.join(root, 'art'))) fs.cpSync(path.join(root, 'art'), path.join(dist, 'art'), { recursive: true });
fs.writeFileSync(path.join(dist, 'sw.js'), fs.readFileSync(path.join(root, 'sw.js'), 'utf8').replace('__VERSION__', version));

const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`dist/ ready (version ${version}, ${(size(dist) / 1024).toFixed(0)} KB)`);
