import 'dotenv/config';

import http from 'node:http';
import { config } from './config.js';
import { runMigrations } from './infra/db.js';
import { createLogger } from './infra/logger.js';
import { createApp, corsOriginCallback, getLocalIP, type OnlineCountSource } from './app.js';
import { createChatServer } from './socket/index.js';
import { presence } from './socket/handlers/presence.js';

const log = createLogger('server');

runMigrations();

const app = createApp({ onlineUsers: (() => presence.size) as OnlineCountSource });
const server = http.createServer(app);

createChatServer(server, corsOriginCallback);

server.listen(config.port, '0.0.0.0', () => {
  log.info(`Server running on port ${config.port} (LAN IP: ${getLocalIP()})`);
});
