import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

export const ULG_DISTRIBUTED_PEER_RELAY_SCHEMA = 'peercompute.ulg.distributed-peer-relay.v1';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/**
 * Build a validated ICE server configuration for PeerCompute / WebRTC
 * multi-window and cross-machine networking (STUN reflexive discovery +
 * optional TURN relay fallback).
 */
export function buildPeerComputeIceConfig({
  stunUrls = ['stun:stun.l.google.com:19302'],
  turnUrls = [],
  turnUsername = '',
  turnCredential = '',
  iceTransportPolicy = 'all'
} = {}) {
  const iceServers = [];
  const cleanStun = (Array.isArray(stunUrls) ? stunUrls : [stunUrls]).map((u) => String(u || '').trim()).filter(Boolean);
  if (cleanStun.length > 0) {
    iceServers.push(Object.freeze({ urls: Object.freeze(cleanStun) }));
  }
  const cleanTurn = (Array.isArray(turnUrls) ? turnUrls : [turnUrls]).map((u) => String(u || '').trim()).filter(Boolean);
  if (cleanTurn.length > 0) {
    iceServers.push(Object.freeze({
      urls: Object.freeze(cleanTurn),
      username: String(turnUsername || ''),
      credential: String(turnCredential || '')
    }));
  }
  const policy = iceTransportPolicy === 'relay' ? 'relay' : 'all';
  return Object.freeze({
    iceServers: Object.freeze(iceServers),
    iceTransportPolicy: policy,
    turnConfigured: cleanTurn.length > 0,
    stunConfigured: cleanStun.length > 0
  });
}

function encodeWsFrame(opcode, payloadBuffer) {
  const payload = Buffer.isBuffer(payloadBuffer) ? payloadBuffer : Buffer.from(String(payloadBuffer), 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function parseWsFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let payloadLen = b1 & 0x7f;
    let cursor = offset + 2;
    if (payloadLen === 126) {
      if (cursor + 2 > buffer.length) break;
      payloadLen = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (payloadLen === 127) {
      if (cursor + 8 > buffer.length) break;
      payloadLen = Number(buffer.readBigUInt64BE(cursor));
      cursor += 8;
    }
    const maskLen = masked ? 4 : 0;
    if (cursor + maskLen + payloadLen > buffer.length) break;
    const maskKey = masked ? buffer.subarray(cursor, cursor + 4) : null;
    cursor += maskLen;
    const payload = Buffer.alloc(payloadLen);
    for (let i = 0; i < payloadLen; i += 1) {
      payload[i] = masked ? (buffer[cursor + i] ^ maskKey[i & 3]) : buffer[cursor + i];
    }
    frames.push({ opcode, payload });
    offset = cursor + payloadLen;
  }
  return { frames, remainder: buffer.subarray(offset) };
}

/**
 * Self-contained local HTTP/HTTPS + RFC-6455 WebSocket room signaling relay
 * for PeerCompute multi-window & cross-machine testing (`requester`,
 * `responder`, `observer`, `validator` roles).
 *
 * Zero external npm dependencies; broadcasts room envelopes across connected
 * peers and emits immediate `peer-disconnected` / `presence` goodbye notices
 * on socket close so `ERR_CLIENT_PEER_ABSENT` failover triggers cleanly.
 */
export async function createLocalPeerRelayServer({
  host = '127.0.0.1',
  port = 0,
  tls = null,
  iceConfig = buildPeerComputeIceConfig()
} = {}) {
  const clients = new Set(); // { socket, roomId, peerId, role, recvBuf }
  let totalMessagesRelayed = 0;
  let totalConnections = 0;

  const requestHandler = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        schema: ULG_DISTRIBUTED_PEER_RELAY_SCHEMA,
        connectedPeers: clients.size,
        totalConnections,
        totalMessagesRelayed
      }));
      return;
    }
    if (req.url === '/ice-config') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(iceConfig));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not-found' }));
  };

  const server = tls && tls.key && tls.cert
    ? https.createServer({ key: tls.key, cert: tls.cert }, requestHandler)
    : http.createServer(requestHandler);

  function broadcastToRoom(roomId, payloadObj, excludeClient = null) {
    const frame = encodeWsFrame(0x1, JSON.stringify(payloadObj));
    for (const c of clients) {
      if (c === excludeClient) continue;
      if (roomId && c.roomId && c.roomId !== roomId) continue;
      if (c.socket.destroyed) continue;
      try {
        c.socket.write(frame);
        totalMessagesRelayed += 1;
      } catch {
        /* Ignore broken pipe; close handler cleans up. */
      }
    }
  }

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    const accept = crypto.createHash('sha1').update(`${key}${WS_GUID}`).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n'
      + 'Upgrade: websocket\r\n'
      + 'Connection: Upgrade\r\n'
      + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    const parsedUrl = new URL(req.url || '/', 'http://localhost');
    const client = {
      socket,
      roomId: parsedUrl.searchParams.get('room') || null,
      peerId: parsedUrl.searchParams.get('peerId') || null,
      role: parsedUrl.searchParams.get('role') || 'peer',
      recvBuf: Buffer.alloc(0)
    };
    clients.add(client);
    totalConnections += 1;

    socket.on('data', (chunk) => {
      client.recvBuf = Buffer.concat([client.recvBuf, chunk]);
      const { frames, remainder } = parseWsFrames(client.recvBuf);
      client.recvBuf = remainder;
      for (const f of frames) {
        if (f.opcode === 0x8) {
          try { socket.write(encodeWsFrame(0x8, Buffer.alloc(0))); } catch { /* ignore */ }
          socket.end();
          return;
        }
        if (f.opcode === 0x9) {
          try { socket.write(encodeWsFrame(0xA, f.payload)); } catch { /* ignore */ }
          continue;
        }
        if (f.opcode === 0x1) {
          let msg;
          try { msg = JSON.parse(f.payload.toString('utf8')); } catch { continue; }
          if (msg.roomId) client.roomId = String(msg.roomId);
          if (msg.peerId && !client.peerId) client.peerId = String(msg.peerId);
          if (msg.from && !client.peerId) client.peerId = String(msg.from);
          if (msg.role) client.role = String(msg.role);
          if (msg.type === 'join') {
            broadcastToRoom(client.roomId, {
              type: 'peer-joined',
              roomId: client.roomId,
              peerId: client.peerId,
              role: client.role
            }, client);
            continue;
          }
          broadcastToRoom(client.roomId || msg.roomId, msg, client);
        }
      }
    });

    const onDisconnect = () => {
      if (!clients.has(client)) return;
      clients.delete(client);
      if (client.peerId && client.roomId) {
        broadcastToRoom(client.roomId, {
          type: 'presence',
          roomId: client.roomId,
          from: client.peerId,
          peerId: client.peerId,
          alive: false,
          reason: 'socket-disconnected'
        });
      }
    };
    socket.on('close', onDisconnect);
    socket.on('error', onDisconnect);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
  const addr = server.address();
  const scheme = tls && tls.key && tls.cert ? 'wss' : 'ws';
  const httpScheme = tls && tls.key && tls.cert ? 'https' : 'http';
  const url = `${scheme}://${addr.address}:${addr.port}`;
  const healthUrl = `${httpScheme}://${addr.address}:${addr.port}/health`;
  const iceConfigUrl = `${httpScheme}://${addr.address}:${addr.port}/ice-config`;

  return {
    schema: ULG_DISTRIBUTED_PEER_RELAY_SCHEMA,
    url,
    healthUrl,
    iceConfigUrl,
    port: addr.port,
    host: addr.address,
    iceConfig,
    getStats() {
      return Object.freeze({
        connectedPeers: clients.size,
        totalConnections,
        totalMessagesRelayed,
        peers: Object.freeze([...clients].map((c) => ({ peerId: c.peerId, roomId: c.roomId, role: c.role })))
      });
    },
    async close() {
      for (const c of [...clients]) {
        try { c.socket.destroy(); } catch { /* ignore */ }
      }
      clients.clear();
      await new Promise((resolve) => server.close(() => resolve()));
    }
  };
}
