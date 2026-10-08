import { createApp } from './app.mjs';

const { app, close } = await createApp();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT must be an integer between 0 and 65535.');
}
const server = app.listen(port, host, error => {
  if (error) return;
  console.log(`Astral listening on port ${server.address().port} (${process.env.NODE_ENV || 'development'})`);
});
server.on('error', async error => {
  console.error(`Server could not start: ${error.message}`);
  await close();
  process.exitCode = 1;
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  const force = setTimeout(() => process.exit(1), 5000).unref();
  server.close(async () => {
    await close();
    clearTimeout(force);
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
