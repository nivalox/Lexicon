export const HELP = [
  'Commands:',
  '  uci | lexicon              identify the engine and list options',
  '  isready                    -> readyok',
  '  ucinewgame                 reset for a new game',
  '  position startpos|fen <FEN> [moves m1 m2 ...]',
  '  go [depth N] [movetime MS] [nodes N] [multipv N] [explain] [infinite]',
  '  stop                       stop searching and print bestmove',
  '  setoption name <Name> value <Value>',
  '  d                          print the board, FEN and key',
  '  eval                       print the evaluation breakdown',
  '  perft <N>                  count nodes (with per-move divide)',
  '  bench                      quick speed benchmark',
  '  help | quit',
  'JSON: send a single-line JSON object such as {"type":"analyze","position":"startpos","depth":12}',
].join('\n');

export function tokenize(line) { return line.trim().split(/\s+/).filter(Boolean); }

export function parseGo(tokens) {
  const o = {};
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].toLowerCase();
    if (t === 'depth') o.depth = Number(tokens[++i]);
    else if (t === 'movetime') o.movetime = Number(tokens[++i]);
    else if (t === 'nodes') o.nodes = Number(tokens[++i]);
    else if (t === 'multipv') o.multiPV = Number(tokens[++i]);
    else if (t === 'infinite') o.infinite = true;
    else if (t === 'explain') o.explain = true;
  }
  return o;
}
