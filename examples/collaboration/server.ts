import { Server } from '@hocuspocus/server';

const port = 1234 + Number(process.env.VITE_SUPERDOC_EXAMPLE_PORT_OFFSET ?? '0');
const server = Server.configure({ port });
await server.listen();

const stop = async () => {
  await server.destroy();
  process.exit();
};

process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
