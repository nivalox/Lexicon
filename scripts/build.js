// Builds standalone browser bundles into dist/ using esbuild (a dev-only dependency).
//   npm install && npm run build
// dist/lexicon.browser.js   IIFE exposing window.Lexicon = { LexiconEngine, Position, ... }  (main-thread use, userscripts)
// dist/lexicon.worker.js    IIFE worker script (load via new Worker(blobOrUrl))
let esbuild;
try { esbuild = await import('esbuild'); } catch { console.error('esbuild is not installed. Run `npm install` first.'); process.exit(1); }
const common = { bundle: true, format: 'iife', target: 'es2020', minify: true, sourcemap: false, logLevel: 'info' };
await esbuild.build({ ...common, entryPoints: ['src/index.js'], globalName: 'Lexicon', outfile: 'dist/lexicon.browser.js' });
await esbuild.build({ ...common, entryPoints: ['src/adapters/browser/worker.js'], outfile: 'dist/lexicon.worker.js' });
await esbuild.build({ ...common, entryPoints: ['src/adapters/userscript/adapter.js'], globalName: 'LexiconUserscript', outfile: 'dist/lexicon.userscript-adapter.js' });
