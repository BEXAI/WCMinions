/* MINI CUP '26 — game server.
 * Serves the static client and runs a tiny WebSocket signaling service:
 * rooms keyed by 4-letter codes, host+guest, WebRTC signal relay, and a
 * plain message relay used as fallback transport when P2P can't connect. */
'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/** code -> { host: ws|null, guest: ws|null } */
const rooms = new Map();

// No 0/O/1/I so codes read unambiguously over the shoulder.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  } while (rooms.has(code));
  return code;
}

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function peerOf(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return null;
  return room.host === ws ? room.guest : room.guest === ws ? room.host : null;
}

function leaveRoom(ws, notifyPeer = true) {
  const code = ws.roomCode;
  if (!code) return;
  ws.roomCode = null;
  const room = rooms.get(code);
  if (!room) return;
  const other = room.host === ws ? room.guest : room.guest === ws ? room.host : null;
  if (room.host === ws) room.host = null;
  if (room.guest === ws) room.guest = null;
  if (notifyPeer && other) send(other, { t: 'peer-left' });
  // The host owns the room; without one the code is dead.
  if (!room.host) rooms.delete(code);
}

wss.on('error', (e) => console.error('wss error:', e.message));

wss.on('connection', (ws) => {
  ws.alive = true;
  ws.roomCode = null;
  // Without an error listener, a socket error is rethrown by EventEmitter and
  // kills the whole process (every active match).
  ws.on('error', (e) => console.error('ws error:', e.message));
  ws.on('pong', () => { ws.alive = true; });

  ws.on('message', (buf) => {
    let m;
    try { m = JSON.parse(buf); } catch { return; }
    if (!m || typeof m.t !== 'string') return;

    switch (m.t) {
      case 'host': {
        leaveRoom(ws);
        const code = makeCode();
        rooms.set(code, { host: ws, guest: null });
        ws.roomCode = code;
        send(ws, { t: 'hosted', code });
        break;
      }
      case 'join': {
        const code = String(m.code || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room || !room.host) { send(ws, { t: 'err', msg: 'Room not found — check the code.' }); return; }
        // Double-submitted join from the socket already in the room is a no-op,
        // not a "room full" error.
        if (room.guest === ws || room.host === ws) { send(ws, { t: 'joined', code }); return; }
        if (room.guest) { send(ws, { t: 'err', msg: 'That room is already full.' }); return; }
        leaveRoom(ws);
        room.guest = ws;
        ws.roomCode = code;
        send(ws, { t: 'joined', code });
        send(room.host, { t: 'peer-joined' });
        break;
      }
      case 'signal':
      case 'relay': {
        const peer = peerOf(ws);
        if (peer) send(peer, { t: m.t, data: m.data });
        break;
      }
      case 'leave':
        leaveRoom(ws);
        break;
    }
  });

  ws.on('close', () => leaveRoom(ws));
});

// Reap dead connections so rooms free up and peers learn about silent drops
// quickly (worst case = two sweep intervals).
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    try { ws.ping(); } catch { /* closing */ }
  }
}, 12000);

// A lobby/game server should log and survive a stray throw rather than drop
// every active match.
process.on('uncaughtException', (e) => console.error('uncaught:', e));
process.on('unhandledRejection', (e) => console.error('unhandled rejection:', e));

server.listen(PORT, () => {
  console.log("⚽ MINI CUP '26 — server is up!");
  console.log(`   Local:   http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name] || []) {
      if (ni.family === 'IPv4' && !ni.internal) {
        console.log(`   Network: http://${ni.address}:${PORT}   (${name} — share this with your rival)`);
      }
    }
  }
});
