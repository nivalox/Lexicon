/**
 * Browser-extension glue (Chrome / Firefox, WebExtension message passing).
 *
 * Background / offscreen page:   registerEngineHost(chrome.runtime, engineClientOrCore)
 * Content script / popup:        const c = new ExtensionClient(chrome.runtime); await c.request({type:'analyze', ...})
 *
 * `engine` can be a BrowserEngine (worker-backed) or a core LexiconEngine. MV3 service workers may be
 * suspended during long searches, so host the engine in an offscreen document or a page with a Worker.
 */
import { createJSONHandler } from '../../protocol/json-protocol.js';

export function registerEngineHost(runtime, engine, channel = 'lexicon') {
  const handler = createJSONHandler(engine);
  runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.channel !== channel) return false;
    handler.handle(msg.request).then(sendResponse);
    return true; // keep the message channel open for the async reply
  });
}

export class ExtensionClient {
  constructor(runtime, channel = 'lexicon') { this.runtime = runtime; this.channel = channel; }
  request(request) { return this.runtime.sendMessage({ channel: this.channel, request }); }
}
