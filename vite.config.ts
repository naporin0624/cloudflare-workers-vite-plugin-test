import { Plugin, defineConfig } from 'vite';
import { MiniflareCore } from '@miniflare/core';

import { CachePlugin } from '@miniflare/cache';
import { BindingsPlugin, CorePlugin } from '@miniflare/core';
import { D1Plugin } from '@miniflare/d1';
import { DurableObjectsPlugin } from '@miniflare/durable-objects';
import { HTMLRewriterPlugin } from '@miniflare/html-rewriter';
import { KVPlugin } from '@miniflare/kv';
import { QueuesPlugin } from '@miniflare/queues';
import { R2Plugin } from '@miniflare/r2';
import { SitesPlugin } from '@miniflare/sites';
import { WebSocketPlugin } from '@miniflare/web-sockets';
import { NoOpLog } from '@miniflare/shared';
import { StackedMemoryStorageFactory } from '@miniflare/shared-test-environment';
import { QueueBroker } from '@miniflare/queues';
import { VMScriptRunner } from '@miniflare/runner-vm';
import { getRequestListener } from '@hono/node-server';

export const PLUGINS = {
	CorePlugin,
	KVPlugin,
	D1Plugin,
	R2Plugin,
	DurableObjectsPlugin,
	CachePlugin,
	SitesPlugin,
	QueuesPlugin,
	HTMLRewriterPlugin,
	WebSocketPlugin,
	BindingsPlugin,
};

const log = new NoOpLog();
const storageFactory = new StackedMemoryStorageFactory();
const scriptRunner = new VMScriptRunner();
const queueBroker = new QueueBroker();

type Fetch = (request: Request, env: {}, executionContext: ExecutionContext) => Promise<Response>;

const plugins = (entry: string): Plugin => {
	const mf = new MiniflareCore(
		PLUGINS,
		{
			log,
			storageFactory,
			scriptRunner,
			queueBroker,
			scriptRunForModuleExports: true,
		},
		{
			wranglerConfigPath: true,
			packagePath: true,
		},
	);

	return {
		name: 'vite-dev-server',
		configureServer: async (server) => {
			server.middlewares.use(async (req, res) => {
				const appModule = await server.ssrLoadModule(entry);
				const app = appModule['default'] as { fetch: Fetch };
				getRequestListener(async (request) => {
					let bindings = {};
					if (mf) {
						bindings = await mf.getBindings();
					}

					const response = await app.fetch(request, bindings, {
						waitUntil: async (fn) => fn,
						passThroughOnException: () => {
							throw new Error('`passThroughOnException` is not supported');
						},
					});
					return response;
				})(req, res);
			});
		},
	};
};

export default defineConfig({
	plugins: [
		plugins('src/index.ts'),
	],
});
