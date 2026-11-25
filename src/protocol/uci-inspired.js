import { ENGINE_NAME, VERSION, MATE, MATE_BOUND } from '../utils/constants.js';
import { listVariants } from '../rules/variants.js';
import { HELP, tokenize, parseGo } from './commands.js';

export function scoreString(score) {
  if (score > MATE_BOUND) return `mate ${Math.ceil((MATE - score) / 2)}`;
  if (score < -MATE_BOUND) return `mate -${Math.ceil((MATE + score) / 2)}`;
  return `cp ${score}`;
}

export function formatInfo(i) {
  return `info depth ${i.depth} seldepth ${i.selDepth} score ${scoreString(i.score)} nodes ${i.nodes} nps ${i.nps} time ${i.time} hashfull ${i.hashfull} pv ${i.pv.join(' ')}`;
}

/** Text protocol, inspired by UCI. Transport-agnostic: give it lines, it calls `write` with lines. */
export class UciProtocol {
  constructor(engine, write = (s) => console.log(s)) {
    this.engine = engine; this.write = write; this.running = null;
  }

  /** Resolves when the current `go` (if any) has finished. */
  async idle() { if (this.running) await this.running; }

  /** @returns false when the session should end ("quit"). */
  async handleLine(line) {
    const t = tokenize(line);
    if (!t.length) return true;
    const cmd = t[0].toLowerCase(), e = this.engine, w = this.write;
    try {
      switch (cmd) {
        case 'uci': case 'lexicon': {
          w(`id name ${ENGINE_NAME} ${VERSION}`);
          w('id author Lexicon contributors');
          w(`option name Variant type combo default ${e.rules.id} ${listVariants().map((v) => `var ${v}`).join(' ')}`);
          w(`option name Hash type spin default ${e.config.search.hashMB} min 1 max 4096`);
          w(`option name StrengthLevel type spin default ${e.config.strength.level} min 1 max 9`);
          const eff = e.strength.resolve(e.config.strength);
          w(`option name MaxDepth type spin default ${eff.maxDepth} min 1 max 128`);
          w(`option name MoveTime type spin default ${eff.timeLimit} min 0 max 3600000`);
          w(`option name Randomness type string default ${e.config.strength.randomness ?? 1}`);
          w(`option name UseBook type check default ${e.config.strength.useOpeningBook}`);
          w(`option name UseTablebases type check default ${e.config.strength.useTablebases}`);
          w(`option name Seed type spin default ${e.config.seed} min 0 max 2147483647`);
          w('uciok');
          break;
        }
        case 'isready': w('readyok'); break;
        case 'ucinewgame': e.newGame(); break;
        case 'position': {
          const mi = t.findIndex((x) => x.toLowerCase() === 'moves');
          const head = mi < 0 ? t.slice(1) : t.slice(1, mi);
          const moves = mi < 0 ? [] : t.slice(mi + 1);
          const spec = head[0] && head[0].toLowerCase() === 'fen' ? head[1] : 'startpos';
          e.setPosition(spec, moves);
          break;
        }
        case 'go': {
          const opts = parseGo(t.slice(1));
          opts.onInfo = (i) => w(formatInfo(i));
          this.running = e.analyze(opts)
            .then((r) => {
              if (r.explanation) for (const reason of r.explanation.reasons) w(`info string ${reason}`);
              w(`bestmove ${r.bestMove ?? '(none)'}`);
            })
            .catch((err) => w(`info string error ${err.message}`));
          break;
        }
        case 'stop': e.stop(); break;
        case 'setoption': {
          const vi = t.findIndex((x) => x.toLowerCase() === 'value');
          const name = t.slice(t[1] && t[1].toLowerCase() === 'name' ? 2 : 1, vi < 0 ? undefined : vi).join(' ');
          const value = vi < 0 ? 'true' : t.slice(vi + 1).join(' ');
          e.setOption(name, value);
          break;
        }
        case 'd':
          w(e.position.ascii({ numbers: true }));
          w(`Fen: ${e.position.fen()}`); w(`Key: ${e.position.key().toString(16)}`); w(`Variant: ${e.rules.id}`);
          break;
        case 'eval': {
          const b = e.getEvaluation();
          for (const [k, v] of Object.entries(b)) w(`  ${k.padEnd(16)} ${v}`);
          break;
        }
        case 'perft': {
          const d = Number(t[1] ?? 1), t0 = Date.now();
          let total = 0;
          for (const r of e.divide(d)) { w(`${r.move}: ${r.nodes}`); total += r.nodes; }
          const ms = Date.now() - t0;
          w(`nodes ${total} time ${ms} nps ${ms ? Math.round((total / ms) * 1000) : 0}`);
          break;
        }
        case 'bench': {
          const t0 = Date.now(), n = e.perft(5), ms = Date.now() - t0;
          w(`perft(5) nodes ${n} time ${ms} nps ${ms ? Math.round((n / ms) * 1000) : 0}`);
          break;
        }
        case 'help': w(HELP); break;
        case 'quit': e.stop(); return false;
        default: w(`info string unknown command "${t[0]}" (try "help")`);
      }
    } catch (err) {
      w(`info string error ${err.message}`);
    }
    return true;
  }
}
