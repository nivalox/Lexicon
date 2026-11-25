// ==UserScript==
// @name         Lexicon helper (template)
// @match        https://example.invalid/*     <-- replace with the site you are allowed to use this on
// @grant        none
// @require      https://YOUR-HOST/lexicon.userscript-adapter.js
// @require      https://YOUR-HOST/lexicon.browser.js
// ==/UserScript==
//
// Build the bundles with `npm install && npm run build` (they land in dist/) and host them yourself.
// This template contains NO site-specific selectors: you implement readBoardFromPage() for your own page.
// Only use it where the site's rules allow engine assistance. Do not use it in rated or competitive play.

(async () => {
  // 1. Read the page into a matrix: top row first, '' | 'b' | 'B' | 'w' | 'W'  (b/w men, B/W kings).
  function readBoardFromPage() {
    throw new Error('implement readBoardFromPage() for your site');
  }
  const sideToMove = 'B';          // 'B' or 'W' as shown by your page
  const flip = false;              // true if your page draws White at the top

  // 2. Start the engine. The bundle exposes window.Lexicon; this runs the core engine on the page thread
  //    (the search yields between iterations). For a non-blocking setup, load dist/lexicon.worker.js as a Worker
  //    (e.g. from a Blob URL built with GM_getResourceText) and use BrowserEngine from src/adapters/browser/.
  const engine = new Lexicon.LexiconEngine({ variant: 'american' });
  await engine.initialize();

  // 3. Translate -> analyse -> get cells to highlight.
  const bridge = new LexiconUserscript.UserscriptBridge(engine, { variant: 'american', flip });
  const suggestion = await bridge.suggest(readBoardFromPage(), sideToMove, { movetime: 1500 });
  console.log('Lexicon suggests', suggestion.bestMove, 'cells', suggestion.cells);
  // suggestion.cells = [{row, col}, ...]  (page coordinates of every square of the move, in order)
})();
