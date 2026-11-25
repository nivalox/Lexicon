// Web Worker entry. Load with: new Worker(url, { type: 'module' })
import { LexiconEngine } from '../../core/engine.js';
import { createJSONHandler } from '../../protocol/json-protocol.js';

let engine = new LexiconEngine();
let handler = createJSONHandler(engine);

self.onmessage = async (e) => {
  const req = e.data || {};
  const id = req.id;
  if (req.type === 'configure') {          // {type:'configure', options:{variant, config}}
    engine = new LexiconEngine(req.options || {});
    handler = createJSONHandler(engine);
    self.postMessage({ id, type: 'result', result: { type: 'configured', ...engine.info() } });
    return;
  }
  const result = await handler.handle(req, (info) => self.postMessage({ id, type: 'info', info }));
  // Search yields between iterations, so a "stop" message is delivered while analyze is still pending.
  self.postMessage({ id, type: result.type === 'error' ? 'error' : 'result', result, error: result.error });
};
