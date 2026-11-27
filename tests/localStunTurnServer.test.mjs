import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import dgram from 'node:dgram';
import test from 'node:test';
import {
  ULG_LOCAL_STUN_TURN_SCHEMA,
  createLocalStunTurnServer,
  decodeXorAddressAttr,
  encodeXorAddressAttr
} from '../src/services/localStunTurnServer.js';
import { createLocalPeerRelayServer } from '../src/services/localPeerRelayServer.js';
import {
  buildBrowserIceConfiguration,
  fetchRelayIceConfig,
  resolvePeerIceConfigFromSearch
} from '../src/services/peerIceConfig.js';

const MAGIC = 0x2112a442;
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

function packAttr(type, valBuf) {
  const pad = (4 - (valBuf.length % 4)) % 4;
  const out = Buffer.alloc(4 + valBuf.length + pad);
  out.writeUInt16BE(type, 0);
  out.writeUInt16BE(valBuf.length, 2);
  valBuf.copy(out, 4);
  return out;
}

function buildClientStun(msgType, attrs = [], hmacKey = null) {
  const txId = crypto.randomBytes(12);
  const body = Buffer.concat(attrs.map((a) => packAttr(a.type, a.value)));
  const header = Buffer.alloc(20);
  header.writeUInt16BE(msgType, 0);
  header.writeUInt32BE(MAGIC, 4);
  txId.copy(header, 8);
  if (!hmacKey) {
    header.writeUInt16BE(body.length, 2);
    return { txId, packet: Buffer.concat([header, body]) };
  }
  header.writeUInt16BE(body.length + 24, 2);
  const preMi = Buffer.concat([header, body]);
  const digest = crypto.createHmac('sha1', hmacKey).update(preMi).digest();
  const miAttr = packAttr(ATTR_MESSAGE_INTEGRITY, digest);
  return { txId, packet: Buffer.concat([preMi, miAttr]) };
}

function parseServerStun(buf) {
  const msgType = buf.readUInt16BE(0);
  const msgLen = buf.readUInt16BE(2);
  const cookie = buf.readUInt32BE(4);
  assert.equal(cookie, MAGIC);
  const txId = buf.subarray(8, 20);
  const attrs = new Map();
  let off = 20;
  const end = 20 + msgLen;
  while (off + 4 <= end) {
    const type = buf.readUInt16BE(off);
    const len = buf.readUInt16BE(off + 2);
    const val = buf.subarray(off + 4, off + 4 + len);
    attrs.set(type, val);
    off += 4 + len + ((4 - (len % 4)) % 4);
  }
  return { msgType, txId, attrs };
}

async function udpRpc(sock, packet, port, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('UDP STUN/TURN timeout')), 4000);
    const onMsg = (msg) => {
      clearTimeout(timer);
      resolve(msg);
    };
    sock.once('message', onMsg);
    sock.send(packet, port, host, (err) => {
      if (err) {
        clearTimeout(timer);
        sock.off('message', onMsg);
        reject(err);
      }
    });
  });
}

test('RFC 5389 STUN + RFC 5766 TURN server: Binding, 401 auth challenge, Allocate, Send/Data relay, ChannelBind/ChannelData, Refresh(0)', async () => {
  const server = await createLocalStunTurnServer({
    host: '127.0.0.1',
    port: 0,
    relayAddress: '127.0.0.1',
    realm: 'ulg.test',
    username: 'alice',
    password: 'secret-turn-password'
  });
  const client = dgram.createSocket('udp4');
  const peer = dgram.createSocket('udp4');

  try {
    assert.equal(server.schema, ULG_LOCAL_STUN_TURN_SCHEMA);
    await Promise.all([
      new Promise((r) => client.bind(0, '127.0.0.1', r)),
      new Promise((r) => peer.bind(0, '127.0.0.1', r))
    ]);
    const clientPort = client.address().port;
    const peerPort = peer.address().port;

    // 1. RFC 5389 STUN Binding Request -> XOR-MAPPED-ADDRESS
    const bindReq = buildClientStun(0x0001);
    const bindResp = parseServerStun(await udpRpc(client, bindReq.packet, server.port));
    assert.equal(bindResp.msgType, 0x0101);
    assert.deepEqual(bindResp.txId, bindReq.txId);
    const mapped = decodeXorAddressAttr(bindResp.attrs.get(ATTR_XOR_MAPPED_ADDRESS));
    assert.equal(mapped.ip, '127.0.0.1');
    assert.equal(mapped.port, clientPort);

    // 2. Unauthenticated TURN Allocate -> 401 with REALM & NONCE
    const udpTransport = Buffer.from([17, 0, 0, 0]);
    const unauthAlloc = buildClientStun(0x0003, [{ type: ATTR_REQUESTED_TRANSPORT, value: udpTransport }]);
    const unauthResp = parseServerStun(await udpRpc(client, unauthAlloc.packet, server.port));
    assert.equal(unauthResp.msgType, 0x0113);
    const errBuf = unauthResp.attrs.get(ATTR_ERROR_CODE);
    assert.equal((errBuf[2] & 0x07) * 100 + errBuf[3], 401);
    const realm = unauthResp.attrs.get(ATTR_REALM).toString('utf8');
    const nonce = unauthResp.attrs.get(ATTR_NONCE).toString('utf8');
    assert.equal(realm, 'ulg.test');
    assert.ok(nonce.length >= 8);

    // 3. Wrong password -> fail-closed 401
    const badKey = crypto.createHash('md5').update(`alice:${realm}:wrong-password`).digest();
    const badAlloc = buildClientStun(0x0003, [
      { type: ATTR_REQUESTED_TRANSPORT, value: udpTransport },
      { type: ATTR_USERNAME, value: Buffer.from('alice', 'utf8') },
      { type: ATTR_REALM, value: Buffer.from(realm, 'utf8') },
      { type: ATTR_NONCE, value: Buffer.from(nonce, 'utf8') }
    ], badKey);
    const badResp = parseServerStun(await udpRpc(client, badAlloc.packet, server.port));
    assert.equal(badResp.msgType, 0x0113);

    // 4. Valid Long-Term Credential Allocate -> XOR-RELAYED-ADDRESS
    const hmacKey = crypto.createHash('md5').update(`alice:${realm}:secret-turn-password`).digest();
    const authAttrs = [
      { type: ATTR_USERNAME, value: Buffer.from('alice', 'utf8') },
      { type: ATTR_REALM, value: Buffer.from(realm, 'utf8') },
      { type: ATTR_NONCE, value: Buffer.from(nonce, 'utf8') }
    ];
    const goodAlloc = buildClientStun(0x0003, [
      { type: ATTR_REQUESTED_TRANSPORT, value: udpTransport },
      ...authAttrs
    ], hmacKey);
    const allocResp = parseServerStun(await udpRpc(client, goodAlloc.packet, server.port));
    assert.equal(allocResp.msgType, 0x0103);
    const relayed = decodeXorAddressAttr(allocResp.attrs.get(ATTR_XOR_RELAYED_ADDRESS));
    assert.equal(relayed.ip, '127.0.0.1');
    assert.ok(relayed.port > 0);
    assert.equal(server.getStats().activeAllocations, 1);

    // 5. CreatePermission for peer IP + Send Indication -> Peer receives -> Peer replies -> Client receives Data Indication
    const permReq = buildClientStun(0x0008, [
      { type: ATTR_XOR_PEER_ADDRESS, value: encodeXorAddressAttr('127.0.0.1', peerPort) },
      ...authAttrs
    ], hmacKey);
    const permResp = parseServerStun(await udpRpc(client, permReq.packet, server.port));
    assert.equal(permResp.msgType, 0x0108);

    const payload1 = Buffer.from('ULG-TURN-SEND-INDICATION-PAYLOAD', 'utf8');
    const peerGot1 = new Promise((resolve) => peer.once('message', (m, ri) => resolve({ m, ri })));
    const sendInd = buildClientStun(0x0016, [
      { type: ATTR_XOR_PEER_ADDRESS, value: encodeXorAddressAttr('127.0.0.1', peerPort) },
      { type: ATTR_DATA, value: payload1 }
    ]);
    client.send(sendInd.packet, server.port, '127.0.0.1');
    const got1 = await peerGot1;
    assert.equal(got1.m.toString('utf8'), 'ULG-TURN-SEND-INDICATION-PAYLOAD');
    assert.equal(got1.ri.port, relayed.port);

    const reply1 = Buffer.from('ULG-PEER-TO-CLIENT-DATA-INDICATION', 'utf8');
    const clientGot1 = new Promise((resolve) => client.once('message', (m) => resolve(parseServerStun(m))));
    peer.send(reply1, relayed.port, relayed.ip);
    const dataInd = await clientGot1;
    assert.equal(dataInd.msgType, 0x0017);
    assert.equal(dataInd.attrs.get(ATTR_DATA).toString('utf8'), 'ULG-PEER-TO-CLIENT-DATA-INDICATION');

    // 6. ChannelBind (0x4000) + bidirectional 4-byte ChannelData framing
    const chBuf = Buffer.alloc(4);
    chBuf.writeUInt16BE(0x4000, 0);
    const bindChReq = buildClientStun(0x0009, [
      { type: ATTR_CHANNEL_NUMBER, value: chBuf },
      { type: ATTR_XOR_PEER_ADDRESS, value: encodeXorAddressAttr('127.0.0.1', peerPort) },
      ...authAttrs
    ], hmacKey);
    const bindChResp = parseServerStun(await udpRpc(client, bindChReq.packet, server.port));
    assert.equal(bindChResp.msgType, 0x0109);

    const chPayloadOut = Buffer.from('CHANNEL-DATA-OUTBOUND-FRAME', 'utf8');
    const chFrameOut = Buffer.alloc(4 + chPayloadOut.length);
    chFrameOut.writeUInt16BE(0x4000, 0);
    chFrameOut.writeUInt16BE(chPayloadOut.length, 2);
    chPayloadOut.copy(chFrameOut, 4);
    const peerGot2 = new Promise((resolve) => peer.once('message', (m) => resolve(m)));
    client.send(chFrameOut, server.port, '127.0.0.1');
    assert.equal((await peerGot2).toString('utf8'), 'CHANNEL-DATA-OUTBOUND-FRAME');

    const chPayloadIn = Buffer.from('CHANNEL-DATA-INBOUND-FRAME', 'utf8');
    const clientGot2 = new Promise((resolve) => client.once('message', (m) => resolve(m)));
    peer.send(chPayloadIn, relayed.port, relayed.ip);
    const chFrameIn = await clientGot2;
    assert.equal(chFrameIn.readUInt16BE(0), 0x4000);
    const inLen = chFrameIn.readUInt16BE(2);
    assert.equal(chFrameIn.subarray(4, 4 + inLen).toString('utf8'), 'CHANNEL-DATA-INBOUND-FRAME');

    const midStats = server.getStats();
    assert.ok(midStats.stunBindingRequests >= 1);
    assert.ok(midStats.turnAllocations >= 1);
    assert.ok(midStats.relayedPackets >= 4);
    assert.ok(midStats.relayedBytes >= payload1.length + reply1.length + chPayloadOut.length + chPayloadIn.length);
    assert.ok(midStats.channelDataFramesIn >= 1);
    assert.ok(midStats.channelDataFramesOut >= 1);

    // 7. Refresh(lifetime = 0) destroys allocation cleanly
    const zeroLt = Buffer.alloc(4);
    zeroLt.writeUInt32BE(0, 0);
    const refReq = buildClientStun(0x0004, [
      { type: ATTR_LIFETIME, value: zeroLt },
      ...authAttrs
    ], hmacKey);
    const refResp = parseServerStun(await udpRpc(client, refReq.packet, server.port));
    assert.equal(refResp.msgType, 0x0104);
    assert.equal(refResp.attrs.get(ATTR_LIFETIME).readUInt32BE(0), 0);
    assert.equal(server.getStats().activeAllocations, 0);
  } finally {
    try { client.close(); } catch { /* ignore */ }
    try { peer.close(); } catch { /* ignore */ }
    await server.close();
  }
});

test('peerIceConfig query parsing and relay /ice-config HTTP auto-discovery', async () => {
  const stunTurn = await createLocalStunTurnServer({
    host: '127.0.0.1',
    port: 0,
    relayAddress: '127.0.0.1',
    username: 'ulg-user',
    password: 'ulg-pass'
  });
  const relay = await createLocalPeerRelayServer({
    host: '127.0.0.1',
    port: 0,
    iceConfig: buildBrowserIceConfiguration({ iceServers: stunTurn.getIceServers(), iceTransportPolicy: 'all' })
  });
  try {
    const parsed = resolvePeerIceConfigFromSearch(
      `?peerStun=${encodeURIComponent(stunTurn.stunUrl)}&peerTurn=${encodeURIComponent(stunTurn.turnUrl)}&peerTurnUser=ulg-user&peerTurnCred=ulg-pass&icePolicy=relay`
    );
    assert.equal(parsed.iceTransportPolicy, 'relay');
    assert.equal(parsed.stunConfigured, true);
    assert.equal(parsed.turnConfigured, true);
    assert.equal(parsed.iceServers.length, 2);

    const fetched = await fetchRelayIceConfig(relay.url);
    assert.ok(fetched);
    assert.equal(fetched.stunConfigured, true);
    assert.equal(fetched.turnConfigured, true);
    assert.equal(fetched.iceServers.length, 2);
  } finally {
    await relay.close();
    await stunTurn.close();
  }
});
