// Which YouTube are we talking to? The real one once a key is in Setup,
// otherwise the practice catalog (demo mode). Every screen asks `yt`.
import { real } from './api.js';
import { demo } from './demo.js';
import { S } from './store.js';

export const isDemo = () => !S.apiKey;
export const yt = new Proxy({}, { get: (_, k) => (isDemo() ? demo : real)[k] });
