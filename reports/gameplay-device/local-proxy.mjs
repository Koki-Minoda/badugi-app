import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
const server = http.createServer((req, res) => {
  const url = new URL(req.url, req.url.startsWith('/api/') ? 'http://127.0.0.1:8011' : 'http://127.0.0.1:4178');
  const upstream = http.request(url, { method: req.method, headers: { ...req.headers, host: url.host } }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
  upstream.on('error', () => { res.writeHead(502); res.end('Local QA service unavailable'); }); req.pipe(upstream);
});
const ws = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => ws.handleUpgrade(req, socket, head, downstream => {
  const upstream = new WebSocket('ws://127.0.0.1:8011' + req.url, { headers: { origin: 'http://127.0.0.1:4179' } });
  const queue = [];
  downstream.on('message', (data, binary) => upstream.readyState === WebSocket.OPEN ? upstream.send(data, { binary }) : queue.push([data, binary]));
  upstream.on('open', () => queue.splice(0).forEach(([data, binary]) => upstream.send(data, { binary })));
  upstream.on('message', (data, binary) => downstream.readyState === WebSocket.OPEN && downstream.send(data, { binary }));
  upstream.on('close', () => downstream.close()); downstream.on('close', () => upstream.close());
  upstream.on('error', () => downstream.close());
}));
server.listen(4179, '127.0.0.1', () => console.log('Local QA frontend/API proxy ready on 4179'));
