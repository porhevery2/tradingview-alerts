// server.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(morgan('dev'));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.text({ type: ['text/plain'], limit: '1mb' }));

const PORT = process.env.PORT || 3000;
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || '';

/** 메모리 저장소 */
const alerts = []; // { exchange, symbol, timeframe, message, receivedAt }

/** 웹훅 엔드포인트 */
app.post("/webhook", (req, res) => {
  console.log("--- 새 웹훅 도착 ---");
  console.log("Body 원본:", req.body);

  let parsedBody;
  if (typeof req.body === 'string') {
    try {
      parsedBody = JSON.parse(req.body);
    } catch {
      return res.status(400).json({ ok: false, error: "bad json format" });
    }
  } else {
    parsedBody = req.body;
  }

  const token = req.get("x-webhook-token") || parsedBody?.token;
  if (!WEBHOOK_TOKEN || token !== WEBHOOK_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  // ✅ price 제거한 새 포맷
  const payload = {
    exchange: parsedBody.exchange || "Upbit",
    symbol: parsedBody.symbol || "UNKNOWN",
    timeframe: parsedBody.timeframe || "1m",
    message: parsedBody.message || "",
    receivedAt: new Date().toISOString()
  };

  alerts.push(payload);
  if (alerts.length > 200) alerts.shift();

  broadcast({ type: "alert", data: payload });
  res.json({ ok: true });
});

/** 최근 알람 가져오기 */
app.get('/alerts', (_req, res) => {
  res.json({ count: alerts.length, items: alerts });
});

/** 헬스체크 */
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/** 서버 + 웹소켓 준비 */
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });


function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(data);
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'bootstrap', data: alerts }));
});

server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
/** 헬스체크 */
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

