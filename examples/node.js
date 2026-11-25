// node examples/node.js
import { LexiconEngine } from '../src/index.js';

const engine = new LexiconEngine({ variant: 'american' });
await engine.initialize();
engine.setOption('StrengthLevel', 6);          // 1 (beginner) .. 9 (maximum)

engine.newGame();
for (let ply = 0; ply < 12 && !engine.getState().status.over; ply++) {
  const r = await engine.analyze({ depth: 8, diagnostics: false });
  console.log(`${String(ply + 1).padStart(2)}. ${r.bestMove.padEnd(8)} score ${String(r.score).padStart(4)}  depth ${r.depth}  nodes ${r.nodes}  pv ${r.principalVariation.slice(0, 4).join(' ')}`);
  engine.makeMove(r.bestMove);
}
console.log(engine.position.ascii());
console.log('Evaluation breakdown:', engine.getEvaluation());
