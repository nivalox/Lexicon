export const pool = {
  id: 'pool', name: 'Pool Checkers', size: 8, startRows: 3,
  firstMove: 'black', menCaptureBackward: true, flyingKings: true, mandatoryCapture: true, stopMultiJumpEarly: false,
  majorityCapture: false, promotionDuringCapture: 'continuesAsKing', capturedRemovedAfterSequence: true,
  noProgressPlies: 80, kingsOnlyPlies: 0, repetitionCount: 3, notation: 'numeric', verified: false,
  notes: 'Best-effort profile (backward-capturing men, flying kings, free choice of capture). Verify first mover, promotion-mid-capture and draw rules against a rulebook.',
};
