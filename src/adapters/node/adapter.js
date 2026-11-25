import readline from 'node:readline';
import { LexiconEngine } from '../../core/engine.js';
import { UciProtocol } from '../../protocol/uci-inspired.js';
import { createJSONHandler } from '../../protocol/json-protocol.js';

/**
 * stdin/stdout loop. Plain lines are UCI-inspired commands; lines starting with "{" are JSON requests
 * and get one JSON line back (plus {"type":"info"} lines while analysing).
 */
export function runStdio({ input = process.stdin, output = process.stdout, engine = new LexiconEngine() } = {}) {
  const write = (s) => output.write(s + '\n');
  const uci = new UciProtocol(engine, write);
  const json = createJSONHandler(engine);
  const rl = readline.createInterface({ input });
  let chain = Promise.resolve();
  rl.on('line', (line) => {
    const t = line.trim();
    if (t.startsWith('{')) {
      // JSON requests run concurrently so that {"type":"stop"} can interrupt an analysis.
      let req;
      try { req = JSON.parse(t); } catch (e) { write(JSON.stringify({ type: 'error', error: 'invalid JSON' })); return; }
      json.handle(req, (m) => write(JSON.stringify({ id: req.id, ...m }))).then((res) => write(JSON.stringify({ id: req.id, ...res })));
      return;
    }
    chain = chain.then(async () => { if (!(await uci.handleLine(t))) { await uci.idle(); rl.close(); } });
  });
  return new Promise((resolve) => rl.on('close', async () => { await chain; await uci.idle(); resolve(); }));
}
