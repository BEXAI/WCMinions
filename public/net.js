/* Networking layer for MINI CUP '26.
 * WebSocket to the server for rooms + WebRTC signaling; game traffic runs
 * P2P over an RTCDataChannel. If the datachannel can't open within a few
 * seconds (strict NAT etc.) we fall back to relaying game messages through
 * the server WebSocket, so a match always starts. */
'use strict';

class Net {
  constructor() {
    this.ws = null;
    this.pc = null;
    this.dc = null;
    this.role = null;       // 'host' | 'guest'
    this.code = null;
    this.ready = false;     // a usable game channel exists
    this.transport = null;  // 'p2p' | 'relay'
    this.fallbackTimer = null;
    this._pendIce = [];

    // Callbacks the game wires up.
    this.onHosted = null;   // (code)
    this.onJoined = null;   // ()
    this.onPeer = null;     // () host: a guest arrived
    this.onReady = null;    // (transport)
    this.onMsg = null;      // (obj) game message from peer
    this.onPeerLeft = null; // (msg?)
    this.onErr = null;      // (msg)
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === 1) { resolve(); return; }
      const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
      const ws = new WebSocket(proto + location.host);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('Cannot reach the game server'));
      ws.onclose = () => { if (this.role) this._peerGone('Lost connection to the server'); };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        this._onWs(m);
      };
    });
  }

  host() { this._wsSend({ t: 'host' }); }
  join(code) { this._wsSend({ t: 'join', code }); }

  /** Send a game message to the peer over whichever channel is live. */
  send(obj) {
    if (this.transport === 'p2p' && this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(obj));
    } else {
      this._wsSend({ t: 'relay', data: obj });
    }
  }

  leave() {
    this.role = null;
    this.code = null;
    this.ready = false;
    this.transport = null;
    this._pendIce = [];
    clearTimeout(this.fallbackTimer);
    if (this.dc) { try { this.dc.close(); } catch { } this.dc = null; }
    if (this.pc) { try { this.pc.close(); } catch { } this.pc = null; }
    this._wsSend({ t: 'leave' });
  }

  /* ---------- internals ---------- */

  _wsSend(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  _onWs(m) {
    switch (m.t) {
      case 'hosted':
        this.role = 'host';
        this.code = m.code;
        if (this.onHosted) this.onHosted(m.code);
        break;
      case 'joined':
        this.role = 'guest';
        this.code = m.code;
        this._armFallback();
        if (this.onJoined) this.onJoined();
        break;
      case 'peer-joined': // host side: start the WebRTC offer
        if (this.onPeer) this.onPeer();
        this._startPeer();
        this._armFallback();
        break;
      case 'signal':
        this._onSignal(m.data);
        break;
      case 'relay':
        if (this.onMsg) this.onMsg(m.data);
        break;
      case 'peer-left':
        this._peerGone();
        break;
      case 'err':
        if (this.onErr) this.onErr(m.msg);
        break;
    }
  }

  _newPc() {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.pc = pc;
    pc.onicecandidate = (e) => { if (e.candidate) this._sig({ ice: e.candidate }); };
    pc.ondatachannel = (e) => { this.dc = e.channel; this._wireDc(this.dc); };
    return pc;
  }

  async _startPeer() {
    try {
      const pc = this._newPc();
      this.dc = pc.createDataChannel('game', { ordered: true });
      this._wireDc(this.dc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this._sig({ sdp: pc.localDescription });
    } catch (e) {
      console.warn('WebRTC offer failed, relay will take over', e);
    }
  }

  async _onSignal(d) {
    try {
      if (!this.pc) this._newPc(); // guest lazily creates on first signal
      const pc = this.pc;
      if (d.sdp) {
        await pc.setRemoteDescription(d.sdp);
        if (d.sdp.type === 'offer') {
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          this._sig({ sdp: pc.localDescription });
        }
        for (const c of this._pendIce) { try { await pc.addIceCandidate(c); } catch { } }
        this._pendIce = [];
      } else if (d.ice) {
        if (pc.remoteDescription) { try { await pc.addIceCandidate(d.ice); } catch { } }
        else this._pendIce.push(d.ice);
      }
    } catch (e) {
      console.warn('signal handling failed, relay will take over', e);
    }
  }

  _wireDc(dc) {
    dc.onopen = () => this._channelUp('p2p');
    dc.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (this.onMsg) this.onMsg(m);
    };
    // Peer disappearance is reported via the server's peer-left.
  }

  _armFallback() {
    clearTimeout(this.fallbackTimer);
    this.fallbackTimer = setTimeout(() => {
      if (!this.ready) this._channelUp('relay');
    }, 3500);
  }

  // Note: if one side falls back to relay just before the datachannel opens on
  // the other, the two ends may send on different transports. Both receive
  // paths stay wired, so messages still flow either way.
  _channelUp(transport) {
    if (this.ready) return;
    this.ready = true;
    this.transport = transport;
    clearTimeout(this.fallbackTimer);
    if (this.onReady) this.onReady(transport);
  }

  _sig(data) { this._wsSend({ t: 'signal', data }); }

  _peerGone(msg) {
    const wasActive = this.role !== null;
    this.leave();
    if (wasActive && this.onPeerLeft) this.onPeerLeft(msg);
  }
}

window.Net = Net;
