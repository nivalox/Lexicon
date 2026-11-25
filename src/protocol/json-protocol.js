/**
 * JSON request/response protocol. One handler serves node stdio, Web Workers and extension messaging.
 *   {"type":"analyze","position":"startpos","depth":20,"timeLimit":3000}
 *   -> {"type":"analysis","bestMove":"9-13","score":145,"depth":12,"nodes":450000,"principalVariation":[...], ...}
 */
export function createJSONHandler(engine) {
  return {
    /** @param emit optional callback for streaming {type:'info', ...} messages */
    async handle(req, emit) {
      try {
        switch (req.type) {
          case 'ping': return { type: 'pong', ...engine.info() };
          case 'analyze': {
            const { type, ...opts } = req;
            if (emit) opts.onInfo = (info) => emit({ type: 'info', ...info });
            return await engine.analyze(opts);
          }
          case 'setPosition': return { type: 'position', ...engine.setPosition(req.position, req.moves || []) };
          case 'legalMoves': return { type: 'legalMoves', moves: engine.getLegalMoves() };
          case 'makeMove': return { type: 'move', ...engine.makeMove(req.move) };
          case 'undoMove': return { type: 'undo', result: engine.undoMove() };
          case 'newGame': return { type: 'position', ...engine.newGame() };
          case 'setOption': return { type: 'option', ...engine.setOption(req.name, req.value) };
          case 'evaluate': return { type: 'evaluation', evaluation: engine.getEvaluation() };
          case 'pv': return { type: 'pv', principalVariation: engine.getPrincipalVariation() };
          case 'perft': return { type: 'perft', depth: req.depth, nodes: engine.perft(req.depth) };
          case 'stop': engine.stop(); return { type: 'stopped' };
          default: return { type: 'error', error: `Unknown request type "${req.type}"` };
        }
      } catch (err) {
        return { type: 'error', error: err.message };
      }
    },
  };
}
