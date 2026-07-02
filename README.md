# ⚽ MINI CUP '26 — 5v5 P2P Mascot Soccer

A full-stack, world-cup-themed 5v5 soccer game starring goofy chibi mascots
("the Minis"). Play a rival **peer-to-peer** over your network with a 4-letter
room code, or take on the CPU solo.

- **Server:** Node.js + Express + `ws` — serves the client and runs WebRTC
  signaling (rooms, offer/answer/ICE relay) plus a message-relay fallback.
- **Client:** vanilla JS + HTML5 Canvas. Host-authoritative simulation at
  60 Hz; the guest interpolates 20 Hz snapshots and streams inputs back over an
  `RTCDataChannel` (true P2P). If P2P can't connect, gameplay automatically
  falls back to relaying through the server — a match always starts.
- **Zero build step, zero external assets** — flags, mascots, stadium, crowd
  and all sounds (WebAudio) are generated in code.

## Quick start (macOS)

```bash
# 1) Need Node 18+ (check with: node -v). Get it at https://nodejs.org
cd ~/Desktop/WCMinions
npm install
npm start
```

Open **http://localhost:3000** — done.

## Playing a friend (P2P)

1. The server prints a `Network: http://192.168.x.x:3000` URL at startup —
   your rival opens that on the same Wi-Fi (or use the Render URL from anywhere).
2. You: **HOST MATCH** → share the 4-letter code.
3. Them: **JOIN MATCH** → enter the code. The badge shows 🟢 P2P or 🟠 RELAY.

Same computer? Use two browser windows.

## Controls

| Action | Keyboard | Touch (iPhone/iPad) |
|---|---|---|
| Move | WASD / Arrow keys | Drag anywhere on the left half (floating joystick) |
| Pass | X (or J) | PASS button |
| Shoot | SPACE (or K) | SHOOT button |
| Sprint | SHIFT (hold) | SPRINT button (hold) |
| Mute | M | 🔊 button |
| Rematch (after full-time) | ENTER | REMATCH button |

On phones the game plays in **landscape** (a rotate prompt appears in
portrait). Tip: on iPhone, use Share → *Add to Home Screen* for fullscreen.

You always control the teammate nearest the ball (gold ring + arrow);
switching is automatic. Keepers are AI. Two 2:30 halves; if it's level at
full-time, **golden goal** decides the cup. 12 national squads included.

## Deploy (Render)

Web Service → build `npm install` → start `node server.js`. The server binds
`process.env.PORT` and the client upgrades to `wss://` on HTTPS automatically.
