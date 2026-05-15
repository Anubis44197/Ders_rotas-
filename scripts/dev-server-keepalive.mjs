import { createServer } from 'vite';

const server = await createServer({
  root: process.cwd(),
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
  },
});

await server.listen();
server.printUrls();

setInterval(() => {}, 2147483647);
