// Zero-Dependency RFC 5389 STUN + RFC 5766 TURN UDP Relay Server (`src/services/localStunTurnServer.js`).
//
// Designed for PeerCompute multi-window & cross-machine WebRTC WAN verification:
//   - RFC 5389 STUN Binding Request (0x0001) -> XOR-MAPPED-ADDRESS (0x0020) + FINGERPRINT
//   - RFC 5766 TURN Allocate (0x0003) with RFC 5389 Long-Term Credential 401 challenge,
//     MD5(user:realm:pass) + HMAC-SHA1 MESSAGE-INTEGRITY (0x0008), per-allocation UDP relay socket,
//     Refresh (0x0004), CreatePermission (0x0008), ChannelBind (0x0009),
//     Send Indication (0x0016), Data Indication (0x0017), and 4-byte ChannelData framing!
//   - Ground-truth `getStats()` packet/byte/allocation counters proving real TURN relay traffic.

import crypto from 'node:crypto';
import dgram from 'node:dgram';

export const ULG_LOCAL_STUN_TURN_SCHEMA = 'peercompute.ulg.local-stun-turn.v1';

const STUN_MAGIC_COOKIE = 0x2112a442;
const FINGERPRINT_XOR = 0x5354554e;

// Message Types
const MSG_BINDING_REQUEST = 0x0001;
const MSG_BINDING_SUCCESS = 0x0101;
const MSG_ALLOCATE_REQUEST = 0x0003;
const MSG_ALLOCATE_SUCCESS = 0x0103;
const MSG_ALLOCATE_ERROR = 0x0113;
const MSG_REFRESH_REQUEST = 0x0004;
const MSG_REFRESH_SUCCESS = 0x0104;
const MSG_REFRESH_ERROR = 0x0114;
const MSG_CREATE_PERM_REQUEST = 0x0008;
const MSG_CREATE_PERM_SUCCESS = 0x0108;
const MSG_CREATE_PERM_ERROR = 0x0118;
const MSG_CHANNEL_BIND_REQUEST = 0x0009;
const MSG_CHANNEL_BIND_SUCCESS = 0x0109;
const MSG_CHANNEL_BIND_ERROR = 0x0119;
const MSG_SEND_INDICATION = 0x0016;
const MSG_DATA_INDICATION = 0x0017;

// Attribute Types
const ATTR_USERNAME = 0x0006;
const ATTR_MESSAGE_INTEGRITY = 0x0008;
const ATTR_ERROR_CODE = 0x0009;
const ATTR_CHANNEL_NUMBER = 0x000c;
const ATTR_LIFETIME = 0x000d;
const ATTR_XOR_PEER_ADDRESS = 0x0012;
const ATTR_DATA = 0x0013;
const ATTR_REALM = 0x0014;
const ATTR_NONCE = 0x0015;
const ATTR_XOR_RELAYED_ADDRESS = 0x0016;
const ATTR_REQUESTED_TRANSPORT = 0x0019;
const ATTR_XOR_MAPPED_ADDRESS = 0x0020;
const ATTR_FINGERPRINT = 0x8028;

// Precomputed IEEE 802.3 CRC-32 table for RFC 5389 FINGERPRINT
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let c = i;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function ipv4ToUint32(ip) {
  const clean = String(ip || '127.0.0.1').replace(/^::ffff:/, '');
  const parts = clean.split('.').map((n) => Number.parseInt(n, 10) & 0xff);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return 0x7f000001; // 127.0.0.1
  }
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

function uint32ToIpv4(val) {
  return `${(val >>> 24) & 0xff}.${(val >>> 16) & 0xff}.${(val >>> 8) & 0xff}.${val & 0xff}`;
}

export function encodeXorAddressAttr(ip, port) {
  const buf = Buffer.alloc(8);
  buf[0] = 0x00;
  buf[1] = 0x01; // IPv4 family
  buf.writeUInt16BE((port ^ (STUN_MAGIC_COOKIE >>> 16)) & 0xffff, 2);
  buf.writeUInt32BE((ipv4ToUint32(ip) ^ STUN_MAGIC_COOKIE) >>> 0, 4);
  return buf;
}

export function decodeXorAddressAttr(buf) {
  if (!buf || buf.length < 8) return null;
  const family = buf[1];
  if (family !== 0x01) return null;
  const port = (buf.readUInt16BE(2) ^ (STUN_MAGIC_COOKIE >>> 16)) & 0xffff;
  const ipNum = (buf.readUInt32BE(4) ^ STUN_MAGIC_COOKIE) >>> 0;
  return { ip: uint32ToIpv4(ipNum), port };
}

function encodeErrorCodeAttr(code, reason) {
  const reasonBuf = Buffer.from(String(reason || 'Error'), 'utf8');
  const buf = Buffer.alloc(4 + reasonBuf.length);
  buf[0] = 0;
  buf[1] = 0;
  buf[2] = Math.floor(code / 100) & 0x07;
  buf[3] = code % 100;
  reasonBuf.copy(buf, 4);
  return buf;
}

function encodeUInt32Attr(v) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(v >>> 0, 0);
  return b;
}

function packAttr(type, valBuf) {
  const len = valBuf.length;
  const pad = (4 - (len % 4)) % 4;
  const out = Buffer.alloc(4 + len + pad);
  out.writeUInt16BE(type, 0);
  out.writeUInt16BE(len, 2);
  valBuf.copy(out, 4);
  return out;
}

export function buildStunMessage(msgType, txId, attrs = [], { hmacKey = null, addFingerprint = true } = {}) {
  const bodyParts = attrs.map(({ type, value }) => packAttr(type, value));
  let body = Buffer.concat(bodyParts);

  const header = Buffer.alloc(20);
  header.writeUInt16BE(msgType & 0x3fff, 0);
  header.writeUInt32BE(STUN_MAGIC_COOKIE, 4);
  txId.copy(header, 8, 0, 12);

  if (hmacKey) {
    // Length in header MUST include MESSAGE-INTEGRITY (24 bytes) before computing HMAC-SHA1
    header.writeUInt16BE(body.length + 24, 2);
    const mac = crypto.createHmac('sha1', hmacKey).update(Buffer.concat([header, body])).digest();
    body = Buffer.concat([body, packAttr(ATTR_MESSAGE_INTEGRITY, mac)]);
  }

  if (addFingerprint) {
    header.writeUInt16BE(body.length + 8, 2);
    const crc = (crc32(Buffer.concat([header, body])) ^ FINGERPRINT_XOR) >>> 0;
    body = Buffer.concat([body, packAttr(ATTR_FINGERPRINT, encodeUInt32Attr(crc))]);
  } else {
    header.writeUInt16BE(body.length, 2);
  }

  return Buffer.concat([header, body]);
}

export function parseStunMessage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 20) return null;
  if ((buf[0] & 0xc0) !== 0x00) return null;
  if (buf.readUInt32BE(4) !== STUN_MAGIC_COOKIE) return null;
  const msgType = buf.readUInt16BE(0);
  const msgLen = buf.readUInt16BE(2);
  if (20 + msgLen > buf.length) return null;
  const txId = Buffer.from(buf.subarray(8, 20));

  const attrs = [];
  let cursor = 20;
  const end = 20 + msgLen;
  while (cursor + 4 <= end) {
    const type = buf.readUInt16BE(cursor);
    const len = buf.readUInt16BE(cursor + 2);
    const valueStart = cursor + 4;
    if (valueStart + len > end) break;
    attrs.push({
      type,
      offset: cursor,
      length: len,
      value: buf.subarray(valueStart, valueStart + len)
    });
    const pad = (4 - (len % 4)) % 4;
    cursor = valueStart + len + pad;
  }
  return { msgType, msgLen, txId, attrs, raw: buf.subarray(0, end) };
}

function computeLongTermKey(username, realm, password) {
  return crypto.createHash('md5').update(`${username}:${realm}:${password}`, 'utf8').digest();
}

function verifyMessageIntegrity(parsed, hmacKey) {
  const mi = parsed.attrs.find((a) => a.type === ATTR_MESSAGE_INTEGRITY);
  if (!mi || mi.length !== 20) return false;
  // RFC 5389 §15.4: length field covers up through MESSAGE-INTEGRITY attribute (mi.offset + 24 - 20)
  const signedLen = mi.offset - 20 + 24;
  const prefix = Buffer.from(parsed.raw.subarray(0, mi.offset));
  prefix.writeUInt16BE(signedLen, 2);
  const expected = crypto.createHmac('sha1', hmacKey).update(prefix).digest();
  return crypto.timingSafeEqual(expected, mi.value);
}

/**
 * Create and start a local RFC 5389 STUN + RFC 5766 TURN UDP relay server.
 */
export async function createLocalStunTurnServer({
  host = '127.0.0.1',
  relayAddress = null,
  port = 0,
  realm = 'ulg.local',
  username = 'ulg-peer',
  password = 'ulg-local-turn-secret',
  defaultLifetimeSec = 600
} = {}) {
  const socket = dgram.createSocket('udp4');
  const resolvedRelayAddr = String(relayAddress || (host === '0.0.0.0' ? '127.0.0.1' : host));
  const nonce = crypto.randomBytes(12).toString('hex');
  const hmacKey = computeLongTermKey(username, realm, password);

  // clientKey ("ip:port") -> allocation record
  const allocations = new Map();
  let closed = false;

  const stats = {
    stunBindingRequests: 0,
    turnAllocations: 0,
    turnRefreshes: 0,
    permissionsCreated: 0,
    channelBinds: 0,
    sendIndications: 0,
    dataIndications: 0,
    channelDataFramesIn: 0,
    channelDataFramesOut: 0,
    relayedPackets: 0,
    relayedBytes: 0,
    authChallenges: 0,
    authFailures: 0
  };

  function clientKey(rinfo) {
    return `${String(rinfo.address).replace(/^::ffff:/, '')}:${rinfo.port}`;
  }

  function destroyAllocation(key) {
    const alloc = allocations.get(key);
    if (!alloc) return;
    allocations.delete(key);
    if (alloc.timer) clearTimeout(alloc.timer);
    try { alloc.relaySocket.close(); } catch { /* ignore */ }
  }

  function refreshAllocationTimer(key, alloc, lifetimeSec) {
    if (alloc.timer) clearTimeout(alloc.timer);
    const sec = Math.max(0, Math.min(3600, Math.trunc(Number(lifetimeSec) || 0)));
    if (sec === 0) {
      destroyAllocation(key);
      return 0;
    }
    alloc.expiresAt = Date.now() + sec * 1000;
    alloc.timer = setTimeout(() => destroyAllocation(key), sec * 1000);
    alloc.timer.unref?.();
    return sec;
  }

  async function createAllocation(rinfo, lifetimeSec) {
    const key = clientKey(rinfo);
    const existing = allocations.get(key);
    if (existing) {
      const lt = refreshAllocationTimer(key, existing, lifetimeSec || defaultLifetimeSec);
      return { alloc: existing, lifetimeSec: lt, created: false };
    }
    const relaySocket = dgram.createSocket('udp4');
    await new Promise((resolve, reject) => {
      relaySocket.once('error', reject);
      relaySocket.bind(0, host, () => resolve());
    });
    const rAddr = relaySocket.address();
    const alloc = {
      key,
      clientIp: String(rinfo.address).replace(/^::ffff:/, ''),
      clientPort: rinfo.port,
      relayIp: resolvedRelayAddr,
      relayPort: rAddr.port,
      relaySocket,
      permissions: new Set(),          // peerIp strings
      channelsByNum: new Map(),        // chNum -> { ip, port }
      channelsByPeer: new Map(),       // "ip:port" -> chNum
      expiresAt: 0,
      timer: null
    };
    const lt = refreshAllocationTimer(key, alloc, lifetimeSec || defaultLifetimeSec);
    allocations.set(key, alloc);
    stats.turnAllocations += 1;

    relaySocket.on('message', (data, peerInfo) => {
      if (closed || !allocations.has(key)) return;
      const peerIp = String(peerInfo.address).replace(/^::ffff:/, '');
      const peerPort = peerInfo.port;
      if (!alloc.permissions.has(peerIp)) return; // RFC 5766 §10.3: drop unpermitted peer packets

      const peerKey = `${peerIp}:${peerPort}`;
      const chNum = alloc.channelsByPeer.get(peerKey);
      stats.relayedPackets += 1;
      stats.relayedBytes += data.length;

      if (chNum !== undefined) {
        // RFC 5766 §11.4 ChannelData message (4-byte header + payload; padded to 4 bytes on TCP, unpadded ok on UDP)
        const frame = Buffer.alloc(4 + data.length);
        frame.writeUInt16BE(chNum, 0);
        frame.writeUInt16BE(data.length, 2);
        data.copy(frame, 4);
        stats.channelDataFramesOut += 1;
        socket.send(frame, alloc.clientPort, alloc.clientIp);
      } else {
        // RFC 5766 §10.3 Data Indication (0x0017)
        const txId = crypto.randomBytes(12);
        const msg = buildStunMessage(MSG_DATA_INDICATION, txId, [
          { type: ATTR_XOR_PEER_ADDRESS, value: encodeXorAddressAttr(peerIp, peerPort) },
          { type: ATTR_DATA, value: data }
        ], { hmacKey: null, addFingerprint: false });
        stats.dataIndications += 1;
        socket.send(msg, alloc.clientPort, alloc.clientIp);
      }
    });

    return { alloc, lifetimeSec: lt, created: true };
  }

  function sendAuthChallenge(errorType, txId, rinfo) {
    stats.authChallenges += 1;
    const reply = buildStunMessage(errorType, txId, [
      { type: ATTR_ERROR_CODE, value: encodeErrorCodeAttr(401, 'Unauthorized') },
      { type: ATTR_REALM, value: Buffer.from(realm, 'utf8') },
      { type: ATTR_NONCE, value: Buffer.from(nonce, 'utf8') }
    ], { hmacKey: null, addFingerprint: true });
    socket.send(reply, rinfo.port, rinfo.address);
  }

  function checkTurnAuth(parsed, errorType, rinfo) {
    const userAttr = parsed.attrs.find((a) => a.type === ATTR_USERNAME);
    const miAttr = parsed.attrs.find((a) => a.type === ATTR_MESSAGE_INTEGRITY);
    if (!userAttr || !miAttr) {
      sendAuthChallenge(errorType, parsed.txId, rinfo);
      return false;
    }
    const reqUser = userAttr.value.toString('utf8');
    if (reqUser !== username || !verifyMessageIntegrity(parsed, hmacKey)) {
      stats.authFailures += 1;
      sendAuthChallenge(errorType, parsed.txId, rinfo);
      return false;
    }
    return true;
  }

  socket.on('message', async (msg, rinfo) => {
    if (closed || !msg || msg.length < 4) return;

    // 1. Check RFC 5766 ChannelData (bits 15..14 == 01 => 0x4000..0x7FFF)
    if ((msg[0] & 0xc0) === 0x40) {
      const chNum = msg.readUInt16BE(0);
      const dataLen = msg.readUInt16BE(2);
      if (4 + dataLen > msg.length) return;
      const alloc = allocations.get(clientKey(rinfo));
      if (!alloc) return;
      const target = alloc.channelsByNum.get(chNum);
      if (!target) return;
      const payload = msg.subarray(4, 4 + dataLen);
      stats.channelDataFramesIn += 1;
      stats.relayedPackets += 1;
      stats.relayedBytes += payload.length;
      alloc.relaySocket.send(payload, target.port, target.ip);
      return;
    }

    // 2. Parse STUN/TURN Message
    const parsed = parseStunMessage(msg);
    if (!parsed) return;
    const srcIp = String(rinfo.address).replace(/^::ffff:/, '');

    if (parsed.msgType === MSG_BINDING_REQUEST) {
      stats.stunBindingRequests += 1;
      const reply = buildStunMessage(MSG_BINDING_SUCCESS, parsed.txId, [
        { type: ATTR_XOR_MAPPED_ADDRESS, value: encodeXorAddressAttr(srcIp, rinfo.port) }
      ], { hmacKey: null, addFingerprint: true });
      socket.send(reply, rinfo.port, rinfo.address);
      return;
    }

    if (parsed.msgType === MSG_ALLOCATE_REQUEST) {
      if (!checkTurnAuth(parsed, MSG_ALLOCATE_ERROR, rinfo)) return;
      const reqTrans = parsed.attrs.find((a) => a.type === ATTR_REQUESTED_TRANSPORT);
      if (reqTrans && reqTrans.length >= 1 && reqTrans.value[0] !== 17) {
        const errReply = buildStunMessage(MSG_ALLOCATE_ERROR, parsed.txId, [
          { type: ATTR_ERROR_CODE, value: encodeErrorCodeAttr(442, 'Unsupported Transport Protocol') }
        ], { hmacKey, addFingerprint: true });
        socket.send(errReply, rinfo.port, rinfo.address);
        return;
      }
      const ltAttr = parsed.attrs.find((a) => a.type === ATTR_LIFETIME);
      const reqLt = ltAttr && ltAttr.length >= 4 ? ltAttr.value.readUInt32BE(0) : defaultLifetimeSec;
      const { alloc, lifetimeSec } = await createAllocation(rinfo, reqLt || defaultLifetimeSec);
      const reply = buildStunMessage(MSG_ALLOCATE_SUCCESS, parsed.txId, [
        { type: ATTR_XOR_RELAYED_ADDRESS, value: encodeXorAddressAttr(alloc.relayIp, alloc.relayPort) },
        { type: ATTR_LIFETIME, value: encodeUInt32Attr(lifetimeSec) },
        { type: ATTR_XOR_MAPPED_ADDRESS, value: encodeXorAddressAttr(srcIp, rinfo.port) }
      ], { hmacKey, addFingerprint: true });
      socket.send(reply, rinfo.port, rinfo.address);
      return;
    }

    if (parsed.msgType === MSG_REFRESH_REQUEST) {
      if (!checkTurnAuth(parsed, MSG_REFRESH_ERROR, rinfo)) return;
      const key = clientKey(rinfo);
      const alloc = allocations.get(key);
      if (!alloc) {
        const errReply = buildStunMessage(MSG_REFRESH_ERROR, parsed.txId, [
          { type: ATTR_ERROR_CODE, value: encodeErrorCodeAttr(437, 'Allocation Mismatch') }
        ], { hmacKey, addFingerprint: true });
        socket.send(errReply, rinfo.port, rinfo.address);
        return;
      }
      stats.turnRefreshes += 1;
      const ltAttr = parsed.attrs.find((a) => a.type === ATTR_LIFETIME);
      const reqLt = ltAttr && ltAttr.length >= 4 ? ltAttr.value.readUInt32BE(0) : defaultLifetimeSec;
      const lt = refreshAllocationTimer(key, alloc, reqLt);
      const reply = buildStunMessage(MSG_REFRESH_SUCCESS, parsed.txId, [
        { type: ATTR_LIFETIME, value: encodeUInt32Attr(lt) }
      ], { hmacKey, addFingerprint: true });
      socket.send(reply, rinfo.port, rinfo.address);
      return;
    }

    if (parsed.msgType === MSG_CREATE_PERM_REQUEST) {
      if (!checkTurnAuth(parsed, MSG_CREATE_PERM_ERROR, rinfo)) return;
      const alloc = allocations.get(clientKey(rinfo));
      if (!alloc) {
        const errReply = buildStunMessage(MSG_CREATE_PERM_ERROR, parsed.txId, [
          { type: ATTR_ERROR_CODE, value: encodeErrorCodeAttr(437, 'Allocation Mismatch') }
        ], { hmacKey, addFingerprint: true });
        socket.send(errReply, rinfo.port, rinfo.address);
        return;
      }
      for (const a of parsed.attrs) {
        if (a.type === ATTR_XOR_PEER_ADDRESS) {
          const decoded = decodeXorAddressAttr(a.value);
          if (decoded) {
            alloc.permissions.add(decoded.ip);
            stats.permissionsCreated += 1;
          }
        }
      }
      const reply = buildStunMessage(MSG_CREATE_PERM_SUCCESS, parsed.txId, [], { hmacKey, addFingerprint: true });
      socket.send(reply, rinfo.port, rinfo.address);
      return;
    }

    if (parsed.msgType === MSG_CHANNEL_BIND_REQUEST) {
      if (!checkTurnAuth(parsed, MSG_CHANNEL_BIND_ERROR, rinfo)) return;
      const alloc = allocations.get(clientKey(rinfo));
      const chAttr = parsed.attrs.find((a) => a.type === ATTR_CHANNEL_NUMBER);
      const peerAttr = parsed.attrs.find((a) => a.type === ATTR_XOR_PEER_ADDRESS);
      const peer = peerAttr ? decodeXorAddressAttr(peerAttr.value) : null;
      const chNum = chAttr && chAttr.length >= 2 ? chAttr.value.readUInt16BE(0) : 0;
      if (!alloc || !peer || chNum < 0x4000 || chNum > 0x7fff) {
        const errReply = buildStunMessage(MSG_CHANNEL_BIND_ERROR, parsed.txId, [
          { type: ATTR_ERROR_CODE, value: encodeErrorCodeAttr(400, 'Bad Request') }
        ], { hmacKey, addFingerprint: true });
        socket.send(errReply, rinfo.port, rinfo.address);
        return;
      }
      alloc.permissions.add(peer.ip);
      alloc.channelsByNum.set(chNum, peer);
      alloc.channelsByPeer.set(`${peer.ip}:${peer.port}`, chNum);
      stats.channelBinds += 1;
      const reply = buildStunMessage(MSG_CHANNEL_BIND_SUCCESS, parsed.txId, [], { hmacKey, addFingerprint: true });
      socket.send(reply, rinfo.port, rinfo.address);
      return;
    }

    if (parsed.msgType === MSG_SEND_INDICATION) {
      const alloc = allocations.get(clientKey(rinfo));
      if (!alloc) return;
      const peerAttr = parsed.attrs.find((a) => a.type === ATTR_XOR_PEER_ADDRESS);
      const dataAttr = parsed.attrs.find((a) => a.type === ATTR_DATA);
      const peer = peerAttr ? decodeXorAddressAttr(peerAttr.value) : null;
      if (!peer || !dataAttr) return;
      if (!alloc.permissions.has(peer.ip)) return;
      stats.sendIndications += 1;
      stats.relayedPackets += 1;
      stats.relayedBytes += dataAttr.value.length;
      alloc.relaySocket.send(dataAttr.value, peer.port, peer.ip);
    }
  });

  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(port, host, () => resolve());
  });
  const addr = socket.address();
  const bindIp = resolvedRelayAddr;
  const stunUrl = `stun:${bindIp}:${addr.port}`;
  const turnUrl = `turn:${bindIp}:${addr.port}?transport=udp`;

  return Object.freeze({
    schema: ULG_LOCAL_STUN_TURN_SCHEMA,
    host: bindIp,
    port: addr.port,
    realm,
    username,
    password,
    stunUrl,
    turnUrl,
    getIceServers() {
      return Object.freeze([
        Object.freeze({ urls: [stunUrl] }),
        Object.freeze({ urls: [turnUrl], username, credential: password })
      ]);
    },
    getStats() {
      return Object.freeze({
        ...stats,
        activeAllocations: allocations.size
      });
    },
    async close() {
      if (closed) return;
      closed = true;
      for (const k of [...allocations.keys()]) {
        destroyAllocation(k);
      }
      await new Promise((resolve) => {
        try { socket.close(() => resolve()); } catch { resolve(); }
      });
    }
  });
}
