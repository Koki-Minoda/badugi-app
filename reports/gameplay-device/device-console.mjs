// Restricted to the dedicated test tab by iphone-client.mjs.
import { createInterface } from 'node:readline';
import { connectDevice } from './iphone-client.mjs';
const client = await connectDevice();
await client.start();
console.log('Device test session ready');
for await (const line of createInterface({ input: process.stdin })) {
  try {
    const { code } = JSON.parse(line);
    const run = new Function('c', `return (async()=>{${code}})()`);
    const result = await run(client);
    console.log(JSON.stringify({ result }));
  } catch (error) { console.log(JSON.stringify({ error: String(error) })); }
}
await client.close();
