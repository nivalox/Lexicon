#!/usr/bin/env node
import { runStdio } from '../src/adapters/node/adapter.js';
import { LexiconEngine } from '../src/core/engine.js';

const args = process.argv.slice(2);
const engine = new LexiconEngine({ variant: args.includes('--variant') ? args[args.indexOf('--variant') + 1] : undefined });
await runStdio({ engine });
