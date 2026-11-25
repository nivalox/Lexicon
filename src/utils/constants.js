export const ENGINE_NAME = 'Lexicon';
export const VERSION = '0.1.0';

export const BLACK = 1;   // Black men/kings are +1/+2. Black starts on the top rows and moves "down".
export const WHITE = -1;  // White men/kings are -1/-2. White starts on the bottom rows and moves "up".

export const INF = 1_000_000_000;
export const MATE = 100_000;
export const MATE_BOUND = MATE - 512;   // |score| above this is a forced win/loss
export const MAX_PLY = 200;
export const CAPTURED = 99;             // temporary marker used inside the move generator
