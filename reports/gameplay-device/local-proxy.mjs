import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
const apiOrigin = `http://127.0.0.1:${Number(process.env.MGX_QA_API_PORT || 8011)}`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, req.url.startsWith('/api/') ? apiOrigin : 'http://127.0.0.1:4178');
  const upstream = http.request(url, { method: req.method, headers: { ...req.headers, host: url.host } }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
  upstream.on('error', () => { res.writeHead(502); res.end('Local QA service unavailable'); }); req.pipe(upstream);
});
const ws = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => ws.handleUpgrade(req, socket, head, downstream => {
  const protocols = String(req.headers['sec-websocket-protocol'] || '').split(',').map(p => p.trim()).filter(Boolean);
  const upstream = new WebSocket(apiOrigin.replace('http:', 'ws:') + req.url, protocols, { headers: { origin: 'http://127.0.0.1:4179' } });
  const queue = [];
  downstream.on('message', (data, binary) => upstream.readyState === WebSocket.OPEN ? upstream.send(data, { binary }) : queue.push([data, binary]));
  upstream.on('open', () => queue.splice(0).forEach(([data, binary]) => upstream.send(data, { binary })));
  upstream.on('message', (data, binary) => downstream.readyState === WebSocket.OPEN && downstream.send(data, { binary }));
  upstream.on('close', (code, reason) => downstream.close([1005, 1006, 1015].includes(code) ? 1011 : code, reason));
  downstream.on('close', (code, reason) => upstream.close([1005, 1006, 1015].includes(code) ? 1011 : code, reason));
  upstream.on('error', () => downstream.close());
}));
const port = Number(process.env.MGX_QA_PROXY_PORT || 4179);
const host = process.env.MGX_QA_PROXY_HOST || '127.0.0.1';
server.listen(port, host, () => console.log(`Local QA frontend/API proxy ready on ${host}:${port}`));
