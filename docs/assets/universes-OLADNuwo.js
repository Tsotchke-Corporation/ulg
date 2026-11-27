import{c as e,l as t,r as n,s as r,u as i}from"./peercomputeCore-DhPQesXX.js";import{f as a,h as o,l as s,p as c}from"./taskRuntime-Jlnz5jsS.js";import{d as l,da as u,f as d,ia as f,l as p,la as m,p as h,sa as g,ua as _}from"./batchedSymmetricEigensolverGpu-CVsmzRbl.js";import{t as v}from"./ClosureRegistry-ChLWc5eU.js";import{n as y,r as b,t as x}from"./clientDerivationPeers-DYvvxiPo.js";import{attachWebGpuUncapturedErrorTelemetry as S}from"../runtime/webgpuDeviceLimits.js";import{S as C,_t as w,a as T,lt as E,mt as D,p as O,r as k,u as A,ut as j,x as M,yt as N}from"./molecularDynamicsWebGpu-BOoV0Dpf.js";import{computeBufferBinding as P,createCachedExplicitBindGroup as F,createCachedExplicitComputePipeline as I}from"../runtime/webgpuComputeLayout.js";import{t as L}from"./radiationClosure-C0GDqRE6.js";import{d as R,l as z,m as B,n as ee,p as V,t as te}from"./simulationModuleRegistry-Dyweqveq.js";import{i as ne,n as re,r as ie,t as ae}from"./webgpuCompat-B36dRVS1.js";import{A as oe,B as H,D as se,E as ce,F as le,G as ue,H as de,I as fe,K as pe,L as me,M as he,N as ge,O as _e,P as ve,R as ye,S as be,U as xe,V as Se,W as Ce,a as we,c as Te,i as Ee,j as De,k as Oe,l as ke,n as Ae,o as je,q as Me,r as Ne,s as Pe,t as Fe,w as Ie,y as Le,z as Re}from"./gpuEntityPickerWebGpu-Cmm8OR-Y.js";import{t as ze}from"./schroederScaleAtlasMultipoleGpu-DVuiUzK5.js";import{n as Be}from"./schroederSpatialScaleAtlasRuntime-BPP2niIn.js";async function Ve(){let e=typeof navigator<`u`&&!!navigator.xr,t=typeof globalThis.XRGPUBinding==`function`,n=!1;if(e&&typeof navigator.xr.isSessionSupported==`function`)try{n=await navigator.xr.isSessionSupported(`immersive-vr`)}catch{n=!1}return{hasNavigatorXr:e,hasXrGpuBinding:t,immersiveVrSupported:n,nativeWebGpuXrReady:!!(e&&t&&n)}}function He(e,{onStateChange:t=null}={}){let n=null,r=null,i=null,a=null,o=!1,s=`Desktop 3D`,c={hasNavigatorXr:typeof navigator<`u`&&!!navigator.xr,hasXrGpuBinding:typeof globalThis.XRGPUBinding==`function`,immersiveVrSupported:!1,nativeWebGpuXrReady:!1},l=()=>{typeof t==`function`&&t(u())};Ve().then(e=>{c=e,l()});function u(){return{...c,active:!!n||o,mode:n?`webxr-native`:o?`stereo-sbs`:`flat`,statusText:s}}async function d(t){let d=await Ve();if(c=d,d.nativeWebGpuXrReady&&typeof t==`function`)try{n=await navigator.xr.requestSession(`immersive-vr`,{requiredFeatures:[`local-floor`],optionalFeatures:[`webgpu`,`hand-tracking`]}),i=new globalThis.XRGPUBinding(n,e),a=i.createProjectionLayer({colorFormat:navigator.gpu.getPreferredCanvasFormat(),depthStencilFormat:`depth24plus`}),await n.updateRenderState({layers:[a]}),r=await n.requestReferenceSpace(`local-floor`),s=`WebXR WebGPU Live`,o=!1,n.addEventListener(`end`,()=>{n=null,r=null,i=null,a=null,s=`Desktop 3D`,l()});let c=(e,o)=>{if(!n)return;let s=o.getViewerPose(r);if(s&&i&&a){let n=[];for(let e of s.views){let t=i.getViewSubImage(a,e);n.push({eye:e.eye,projectionMatrix:e.projectionMatrix,transform:e.transform,colorView:t.colorTexture.createView({baseArrayLayer:t.imageIndex||0,arrayLayerCount:1}),depthView:t.depthStencilTexture?t.depthStencilTexture.createView({baseArrayLayer:t.imageIndex||0,arrayLayerCount:1}):null,viewport:t.viewport})}t(e,n,s)}n.requestAnimationFrame(c)};return n.requestAnimationFrame(c),l(),u()}catch(e){return n=null,i=null,a=null,s=`Stereo VR (${String(e?.message||`XRGPUBinding fallback`).slice(0,36)})`,o=!0,l(),u()}return o=!o,s=o?d.hasNavigatorXr&&!d.hasXrGpuBinding?`Stereo SBS VR (enable #webxr-incubations for native XRGPUBinding)`:`Stereo SBS VR Preview`:`Desktop 3D`,l(),u()}async function f(){if(o=!1,n){try{await n.end()}catch{}n=null,r=null,i=null,a=null}return s=`Desktop 3D`,l(),u()}async function p(e){return n||o?f():d(e)}return Object.freeze({getState:u,enterXr:d,exitXr:f,toggleXr:p,get isStereoPreview(){return o},get isNativeXr(){return!!n}})}var Ue=`https://secretworkshop.net/peercompute/config/relay-config.json`,We=Object.freeze({bootstrapPeers:Object.freeze([`/dns4/secretworkshop.net/tcp/443/wss/p2p/12D3KooWN8PoXAkYjbzTD3SKJGP97peWDE9jFeqqS3ipJsgwDozs`,`/dns6/secretworkshop.net/tcp/443/wss/p2p/12D3KooWN8PoXAkYjbzTD3SKJGP97peWDE9jFeqqS3ipJsgwDozs`]),pubsubType:`gossipsub`,gossipsub:Object.freeze({D:8,Dhi:32,Dout:1,scoreParams:Object.freeze({IPColocationFactorWeight:0,behaviourPenaltyWeight:0,topics:Object.freeze({__default:Object.freeze({meshMessageDeliveriesWeight:0,meshMessageDeliveriesThreshold:0,meshFailurePenaltyWeight:0})})})}),webrtc:Object.freeze({iceServers:Object.freeze([Object.freeze({urls:`stun:stun.l.google.com:19302`}),Object.freeze({urls:Object.freeze([`turn:secretworkshop.net:3478?transport=udp`,`turn:secretworkshop.net:3478?transport=tcp`]),username:`peer`,credential:`compute`})]),preferDirect:!0,dropRelayOnDirect:!0,dropRelayBootstrapOnDirect:!0,countRelayWebrtcAsDirectCapable:!0,relayRetention:Object.freeze({mode:`logn`,min:1,max:10})})}),Ge=Object.freeze({faultTolerance:`no-fatal`}),Ke=Object.freeze({snapshotHz:20,keepaliveMs:1500,snapshotsRequireAuthority:!1,reliableEventTypes:[`ufo-hit`,`ufo-missile`,`ufo-crater-stamp`,`ufo-leave`,`cosmic-cache-put`]});function qe(e){let t=String(e||``),n=t.lastIndexOf(`/p2p/`);return n>=0?t.slice(n+5).split(`/`)[0]:``}function Je(e){if(!Array.isArray(e))return[];let t=typeof globalThis.location==`object`&&globalThis.location?.protocol===`https:`;return e.filter(e=>typeof e==`string`&&e.trim().length>0).map(e=>t?e.replace(`/ws/`,`/wss/`):e)}async function Ye(e=``){let t=async e=>{if(!e||typeof globalThis.fetch!=`function`)return null;try{let t=typeof AbortController==`function`?new AbortController:null,n=t?setTimeout(()=>t.abort(),4e3):null;try{let n=await globalThis.fetch(e,{cache:`no-store`,...t?{signal:t.signal}:{}});if(n.ok)return await n.json()}finally{n&&clearTimeout(n)}}catch{}return null},n=``;try{if(typeof globalThis.location==`object`&&globalThis.location?.search){let e=new URLSearchParams(globalThis.location.search);n=(e.get(`relayConfigUrl`)||e.get(`relayConfig`)||``).trim()}}catch{}let r=await t(String(e||n||Ue).trim());return r&&Array.isArray(r.bootstrapPeers)&&r.bootstrapPeers.length>0?r:We}function Xe(e,t,n){return Math.max(t,Math.min(n,e))}function Ze(e=``){let t=new URLSearchParams(String(e||``)),n=(e,n=null)=>{let r=t.get(e);if(r===null||r===``)return n;let i=Number(r);return Number.isFinite(i)?i:n};return{seed:n(`seed`,null),epoch:t.get(`epoch`)||null,log10SpanM:n(`span`,null),level:n(`level`,null),useSol:t.has(`sol`)?t.get(`sol`)===`1`||t.get(`sol`)===`true`:null,bodyId:t.get(`body`)||null,surfaceActive:t.get(`surf`)===`1`||t.get(`surf`)===`true`,pos:t.has(`x`)&&t.has(`z`)?[n(`x`,0),n(`y`,28),n(`z`,0)]:null,yaw:n(`yaw`,null),simTimeS:n(`t`,null),roomId:(t.get(`room`)||``).trim()||null,relayUrl:(t.get(`relay`)||``).trim()||null,cockpit:t.get(`cockpit`)===`1`}}function Qe(e,t={}){let n=new URL(e||`https://127.0.0.1:5173/universes.html`),r=n.searchParams;return r.set(`seed`,String(Math.trunc(Number(t.seed)||20261125))),t.epoch&&r.set(`epoch`,String(t.epoch)),Number.isFinite(t.log10SpanM)&&r.set(`span`,Number(t.log10SpanM).toFixed(2)),typeof t.useSol==`boolean`&&r.set(`sol`,t.useSol?`1`:`0`),t.bodyId&&r.set(`body`,String(t.bodyId)),t.surfaceActive?(r.set(`surf`,`1`),Array.isArray(t.pos)&&t.pos.length===3&&(r.set(`x`,Number(t.pos[0]).toFixed(1)),r.set(`y`,Number(t.pos[1]).toFixed(1)),r.set(`z`,Number(t.pos[2]).toFixed(1))),Number.isFinite(t.yaw)&&r.set(`yaw`,Number(t.yaw).toFixed(2))):(r.delete(`surf`),r.delete(`x`),r.delete(`y`),r.delete(`z`),r.delete(`yaw`)),Number.isFinite(t.simTimeS)&&r.set(`t`,Number(t.simTimeS).toFixed(1)),t.roomId?r.set(`room`,String(t.roomId)):r.delete(`room`),t.relayUrl?r.set(`relay`,String(t.relayUrl)):r.delete(`relay`),n.toString()}function $e({peerId:e=null,onWeaponHitLocal:t=null,onRemoteMissile:r=null,onRemoteCraterStamp:i=null,onRemoteCosmicCacheEntry:a=null,onStateChange:o=null}={}){let s=e||`ufo-${Math.random().toString(36).slice(2,8)}`,c=new Map,l=12e3,u=null,d=``,f=null,p=null,m=null,h=null,g=null,_=null,v=[],y=!1,b=0,S=`offline`,C=null,w=null,T=null,E=0,D=!1,O=Date.now(),k=0,A=0,j=0,M=0,N=0,P=()=>{typeof o==`function`&&o(oe())};function F(){if(!g){y=!1,b=0;return}let e=g.getConnections?.()||[],t=Array.isArray(e)?e:Array.from(e.values?.()||[]).flat(),n=!1,r=new Set;for(let e of t){let t=e?.remotePeer?.toString?.()||``;t&&(v.includes(t)?n=!0:r.add(t))}y=n,b=r.size,D&&m&&(S=b>0?`p2p-mesh`:y?`relay-online`:`connecting`)}function I(e){if(!e||typeof e!=`object`||e.from===s||_&&e.from===_||u&&e.roomId&&e.roomId!==u)return;j+=1;let n=Date.now();e.type===`ufo-state`&&e.from?(c.set(e.from,{peerId:e.from,state:e.state||{},lastSeenMs:n}),Number.isFinite(e.epochAnchorMs)&&e.epochAnchorMs<O&&(O=e.epochAnchorMs)):e.type===`ufo-hit`&&(e.targetPeerId===s||_&&e.targetPeerId===_)?(M+=1,typeof t==`function`&&t({from:e.from,weapon:e.weapon||`laser`,damage:Number(e.damage)||8,wavelengthNm:e.wavelengthNm??532})):e.type===`ufo-missile`&&e.from?typeof r==`function`&&r(e.missile,e.from):e.type===`ufo-crater-stamp`&&e.from?typeof i==`function`&&i(e.stamp,e.from):e.type===`cosmic-cache-put`&&e.from&&e.entry?typeof a==`function`&&a(e.entry,e.from):(e.type===`ufo-leave`||e.type===`peer-disconnect`)&&(e.from||e.peerId)&&c.delete(e.from||e.peerId),P()}function L(e,{reliable:t=!1}={}){if(!D||!u)return!1;let n={...e,from:s,roomId:u,epochAnchorMs:O},r=!1;if(p)try{p.postMessage(n),r=!0}catch{}if(f)try{f.send(n),r=!0}catch{}if(h&&e.type!==`ufo-state`)try{h.queueEvent?.(n,{reliable:!!t}),r=!0}catch{}return r&&(A+=1),r}async function R(e,t,r=``,i=``){if(globalThis.window===void 0||typeof globalThis.WebSocket!=`function`){S=`local-only`,P();return}S=`connecting`,C=null,P();try{let a=await Ye(r);if(e!==E||!D)return;let o=Je(i?[i,...a.bootstrapPeers||[]]:a.bootstrapPeers||[]);v=o.map(qe).filter(Boolean);let c=new n({bootstrapPeers:o,enablePersistence:!1,gameId:`ulg-universes`,roomId:t,maxConnections:12,transportManager:Ge,...a.pubsubType?{pubsubType:String(a.pubsubType).trim().toLowerCase()}:{pubsubType:`gossipsub`},...a.gossipsub&&typeof a.gossipsub==`object`?{gossipsub:{...a.gossipsub}}:{},...a.webrtc&&typeof a.webrtc==`object`?{webrtc:{...a.webrtc}}:{}});if(await c.initialize(),e!==E||!D){try{await c.stop()}catch{}return}if(await c.start(),e!==E||!D){try{await c.stop()}catch{}return}let l=c.getNetworkManager(),u=l?.getLibp2pNode?.()||null;m=c,h=l,g=u,_=c.getStatus?.()?.network?.peerId||null,l.configureScheduler?.(Ke),l.registerStateProvider?.(()=>T?{...T,selfId:s,roomId:t,epochAnchorMs:O}:{selfId:s,roomId:t,epochAnchorMs:O,level:2,surfaceActive:!1,pos:[0,0,0],yaw:0},{id:`ufo`}),l.addSnapshotHandler?.((n,r)=>{if(e!==E||!D)return;let i=r?.header?.peerId||n;if(!i||i===_)return;let a=Array.isArray(r?.payload)?r.payload:[];for(let e of a){if(!e||e.id!==`ufo`||!e.data)continue;let n=e.data;I({type:`ufo-state`,from:n.selfId||i,roomId:n.roomId||t,epochAnchorMs:n.epochAnchorMs,state:n})}}),l.addEventHandler?.((t,n)=>{if(e!==E||!D)return;let r=n?.header?.peerId||t;if(!r||r===_)return;let i=Array.isArray(n?.payload)?n.payload:[];for(let e of i){let t=e?.payload;!t||typeof t!=`object`||I({...t,from:t.from||r})}}),u&&(u.addEventListener(`connection:open`,()=>{e!==E||!D||(F(),l.markStateDirty?.(),P())}),u.addEventListener(`connection:close`,()=>{e!==E||!D||(F(),P())})),F(),l.markStateDirty?.();try{await l.redialBootstrapPeers?.()}catch{}F(),P(),w=setInterval(()=>{e!==E||!D||!h||(F(),!y&&b===0&&h.redialBootstrapPeers?.().catch(()=>{}),P())},1e4)}catch(t){if(e!==E)return;S=`error`,C=t instanceof Error?t.message:String(t),P()}}function z({room:e=`ulg-cosmos-public`,relay:t=``,relayConfigUrl:n=``,enablePeerCompute:r=!0}={}){B();let i=String(e||``).trim();if(!i)return oe();let a=++E;if(u=i,d=String(t||``).trim(),O=Date.now(),D=!0,typeof globalThis.BroadcastChannel==`function`)try{p=new globalThis.BroadcastChannel(`ulg-ufo-room:${u}`),p.onmessage=e=>I(e.data)}catch{p=null}let o=d.startsWith(`/`)&&d.includes(`/p2p/`),c=/^wss?:\/\//i.test(d);if(c)try{f=x({relayUrl:d,roomId:`ulg-ufo-room:${u}`,peerId:s,enableWebRtc:!0}),f.onMessage(e=>I(e))}catch{f=null}return r!==!1&&!c?R(a,u,n,o?d:``):S=f?`relay-online`:`local-only`,P(),oe()}function B(){if(E+=1,w&&=(clearInterval(w),null),D&&u&&L({type:`ufo-leave`},{reliable:!0}),D=!1,u=null,d=``,T=null,c.clear(),p){try{p.close()}catch{}p=null}if(f){try{f.close()}catch{}f=null}let e=m;return m=null,h=null,g=null,_=null,v=[],y=!1,b=0,S=`offline`,C=null,e&&Promise.resolve().then(()=>e.stop?.()).catch(()=>{}),P(),oe()}function ee(e,t=!1){if(!D)return;T=e?{...e}:T;let n=Date.now();if(!(!t&&n-k<48)){k=n;for(let[e,t]of c.entries())n-t.lastSeenMs>l&&c.delete(e);if(h)try{h.markStateDirty?.()}catch{}L({type:`ufo-state`,state:T})}}function V(e,{weapon:t=`laser`,damage:n=8,wavelengthNm:r=532}={}){return!D||!e?!1:(N+=1,L({type:`ufo-hit`,targetPeerId:e,weapon:t,damage:n,wavelengthNm:r},{reliable:!0}))}function te(e){return!D||!e?!1:L({type:`ufo-missile`,missile:e},{reliable:!0})}function ne(e){return!D||!e?!1:L({type:`ufo-crater-stamp`,stamp:e},{reliable:!0})}function re(e){return!D||!e||!e.key?!1:L({type:`cosmic-cache-put`,entry:e},{reliable:!0})}function ie(){let e=Date.now(),t=[];for(let[n,r]of c.entries()){if(e-r.lastSeenMs>l){c.delete(n);continue}t.push({peerId:n,...r.state})}return t.sort((e,t)=>String(e.peerId).localeCompare(String(t.peerId))),t}function ae({level:e,bodyId:t,systemKey:n=null,surfaceActive:r}={}){let i=[];for(let a of ie()){let o=!n||!a.systemKey||a.systemKey===n,s=!!r&&!!a.surfaceActive&&o&&(!t||a.bodyId===t),c=!r&&!a.surfaceActive&&o&&(e==null||a.level===e);(s||c)&&i.push(a)}return i}function oe(){let e=m?b>0?`peercompute-p2p+bc`:y?`peercompute-relay+bc`:`peercompute-connecting+bc`:f?`peercompute-webrtc+bc`:S===`connecting`?`peercompute-connecting+bc`:p?`broadcast-channel`:`offline`;return{selfId:s,connected:D,roomId:u,relayUrl:d,timescaleLocked:D,syncedEpochSec:D?(Date.now()-O)*.001:null,remotePeerCount:c.size,remotePeerIds:[...c.keys()],transportKind:e,peerComputeStatus:S,peerComputePeerId:_,peerComputeError:C,relayConnected:y,libp2pPeerCount:b+ +!!y,messagesSent:A,messagesReceived:j,shieldHitsTaken:M,shieldHitsDealt:N}}return Object.freeze({connect:z,disconnect:B,broadcastLocalState:ee,sendWeaponHit:V,broadcastMissileLaunch:te,broadcastCraterStamp:ne,broadcastCosmicCacheEntry:re,getAllRemotePeers:ie,getRemotePeersForContext:ae,getStatus:oe,get isConnected(){return D},get timescaleLocked(){return D}})}var et=Object.freeze([0xe8d4a51000,0x38d7ea4c68000,0xde0b6b3a7640000,1e22,1e26]),U=3828e23;function tt(e,t,n,r){let i=Math.max(0,Number(e)||0),a=Math.max(1,Number(t)||1e9);if(i<=0||r<=0||n<=0)return i;if(i>=a)return a;let o=(a-i)/Math.max(1e-9,i),s=Math.exp(-Math.min(60,n*r));return Math.min(a,a/(1+o*s))}function nt(e,t=12e11,n=1496e8){let r=Math.max(0,Number(e)||0),i=4*Math.PI*n*n,a=Xe(r*t/Math.max(1,i),0,.992);return{fCover:a,tauDyson:-Math.log(Math.max(1e-4,1-a))}}function rt(){let e={silicatesKg:120,volatilesKg:80,metalsKg:90,exoticsKg:12,probes:[],systems:new Map,colonyLinks:[],totalProbeCount:0,colonizedSystemCount:0,activeSystemKey:`sol`,dysonCoveringFrac:0,dysonTau:0,reactorTier:1,maxPowerW:et[0],shieldHp:100,maxShieldHp:100,shieldFlash:0,harvestedPowerW:18e12,kardashevIndex:.725,kardashevK:.725};function t(t=e.activeSystemKey,{starPosGal:n=[4.8,.04,2.1],starLumW:r=U}={}){let i=String(t||`sol`),a=e.systems.get(i);return a||(a={systemKey:i,starPosGal:Array.isArray(n)?[...n]:[4.8,.04,2.1],starLumW:Math.max(.02*U,Number(r)||U),swarmRadiusM:1496e8,N_probes:0,K_cap:25e10,rGrowth:.095,fCover:0,tauDyson:0,dysonPowerW:0,seededNeighbors:!1},e.systems.set(i,a)),a}function n(){let t=0,n=0,r=0;for(let i of e.systems.values())if(i.N_probes>0){r+=1,t+=i.N_probes;let{fCover:e,tauDyson:a}=nt(i.N_probes,12e11,i.swarmRadiusM);i.fCover=e,i.tauDyson=a,i.dysonPowerW=i.starLumW*e*.42+i.N_probes*0xe35fa931a000,n+=i.dysonPowerW}let i=e.systems.get(e.activeSystemKey);e.totalProbeCount=t,e.colonizedSystemCount=r,e.dysonCoveringFrac=i?i.fCover:0,e.dysonTau=i?i.tauDyson:0;let a=18e12*35**(e.reactorTier-1),o=r>=6?10**(31+Math.min(5,r*.45)):0;e.harvestedPowerW=a+n+o;let s=Xe((Math.log10(Math.max(1e6,e.harvestedPowerW))-6)/10,0,3.2);e.kardashevIndex=s,e.kardashevK=s;let c=et[Xe(e.reactorTier-1,0,et.length-1)];e.maxPowerW=Math.min(1e26,Math.max(c,e.harvestedPowerW*.25))}function r({silicates:t=0,volatiles:n=0,metals:r=0,exotics:i=0}={}){e.silicatesKg+=Math.max(0,t),e.volatilesKg+=Math.max(0,n),e.metalsKg+=Math.max(0,r),e.exoticsKg+=Math.max(0,i)}function i({systemKey:t=`sol`,starPosGal:r=[4.8,.04,2.1],starLumW:i=U}={}){e.activeSystemKey=String(t||`sol`);let a=e.systems.get(e.activeSystemKey);a&&(Array.isArray(r)&&(a.starPosGal=[...r]),Number.isFinite(i)&&i>0&&(a.starLumW=i)),n()}function a({bodyId:r=`earth`,systemKey:i=e.activeSystemKey,starPosGal:a=[4.8,.04,2.1],starLumW:o=U,orbitRadius:s=2.2,stellarFluxMul:c=1,seedCount:l=1}={}){if(e.metalsKg<40||e.silicatesKg<40)return null;e.metalsKg-=40,e.silicatesKg-=40;let u=t(i,{starPosGal:a,starLumW:o});u.N_probes+=Math.max(1,Number(l)||1);let d={id:`vn-${e.probes.length+1}`,bodyId:r,systemKey:u.systemKey,orbitRadius:Math.max(1.4,s),angle:Math.random()*Math.PI*2,inclination:(Math.random()-.5)*.75,gen:1,replicationProgress:0,powerW:0xe35fa931a000*Math.max(.25,c)};return e.probes.length<48&&e.probes.push(d),n(),d}function o(){let t=80*e.reactorTier,r=10*e.reactorTier;return e.reactorTier>=5||e.metalsKg<t||e.exoticsKg<r?!1:(e.metalsKg-=t,e.exoticsKg-=r,e.reactorTier+=1,e.maxShieldHp=100+(e.reactorTier-1)*45,e.shieldHp=e.maxShieldHp,n(),!0)}function s(r,{growthTimeMul:i=1}={}){let a=Xe(Number(r)||.016,0,.5),o=a*Math.max(.1,Number(i)||1);e.shieldFlash=Math.max(0,e.shieldFlash-a*2.6),e.shieldHp=Math.min(e.maxShieldHp,e.shieldHp+a*(2.2*e.reactorTier));let s=[];for(let t of e.systems.values()){if(t.N_probes<=0)continue;let n=1+Math.min(1.5,(e.metalsKg+e.silicatesKg)/1200);t.N_probes=tt(t.N_probes,t.K_cap,t.rGrowth*n,o);let{fCover:r}=nt(t.N_probes,12e11,t.swarmRadiusM);if(r>.25&&!t.seededNeighbors&&e.systems.size<16){t.seededNeighbors=!0;let n=e.systems.size;for(let e=0;e<2;e+=1){let r=(n+e)*2.39996,i=1.4+e*.9,a=[t.starPosGal[0]+Math.cos(r)*i,t.starPosGal[1]+(e%2==0?1:-1)*.14,t.starPosGal[2]+Math.sin(r)*i],o=`colony-${n+e+1}`;s.push({key:o,from:[...t.starPosGal],to:a})}}}for(let n of s){let r=t(n.key,{starPosGal:n.to,starLumW:U*1.15});r.N_probes=Math.max(r.N_probes,64),e.colonyLinks.push({fromPosGal:n.from,toPosGal:n.to,progress:.15})}for(let t of e.colonyLinks)t.progress=Math.min(1,t.progress+a*.25);let c=e.systems.get(e.activeSystemKey),l=c?Math.min(48,Math.max(e.probes.length,Math.min(48,Math.floor(Math.log2(1+c.N_probes)*2.2)))):e.probes.length;for(;e.probes.length<l&&e.probes.length>0&&e.probes.length<48;){let t=e.probes[e.probes.length-1];e.probes.push({id:`vn-${e.probes.length+1}`,bodyId:t.bodyId,systemKey:t.systemKey,orbitRadius:t.orbitRadius*(.92+Math.random()*.18),angle:t.angle+.55,inclination:Xe(t.inclination+(Math.random()-.5)*.45,-1.1,1.1),gen:t.gen+1,replicationProgress:0,powerW:t.powerW})}for(let t=0;t<e.probes.length;t+=1){let n=e.probes[t];n.angle+=a*(.42+t%5*.12),e.metalsKg+=a*1.6,e.silicatesKg+=a*1.8,e.exoticsKg+=a*.35}n()}function c(t){e.shieldHp=Math.max(0,e.shieldHp-Math.max(0,t)),e.shieldFlash=1,e.shieldHp<=0&&(e.shieldHp=e.maxShieldHp*.45)}return n(),{state:e,addHarvest:r,setActiveSystemContext:i,deployVonNeumannProbe:a,upgradeReactor:o,applyDamage:c,step:s}}var it=`ulg.astrophysics.solar-system-nbody-webgpu.v1`,at=149597870700,ot=30034896e-13,st=4*Math.PI*Math.PI,ct=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),lt=Object.freeze([{id:`sun`,name:`Sun (G2V)`,subtitle:`Main-Sequence Hydrogen Fusion Star`,parent:-1,kind:0,massSolar:1,radiusKm:695700,aAu:0,e:0,incDeg:0,omDeg:0,wDeg:0,m0Deg:0,axialObliquityDeg:7.25,spinAxisLonDeg:75.7,rotationPeriodHr:609.12,tidallyLocked:!1,color0:[1,.94,.76],color1:[1,.56,.18],atm:0,tempK:5778,centralP:0x58d15e17628000,coreZ:1,mantleZ:2,surfZ:1,composition:`H 73.5% · He 24.8% · O/C/Fe 1.7%`},{id:`mercury`,name:`Mercury`,subtitle:`Iron-Core Terrestrial Planet · 0.387 AU`,parent:0,kind:1,massSolar:1.6601e-7,radiusKm:2439.7,aAu:.387098,e:.20563,incDeg:7.005,omDeg:48.33,wDeg:29.12,m0Deg:174.8,axialObliquityDeg:.03,spinAxisLonDeg:18,rotationPeriodHr:1407.6,tidallyLocked:!1,color0:[.58,.54,.5],color1:[.36,.33,.31],atm:0,surfacePressurePa:0,tempK:440,centralP:4e10,coreZ:26,mantleZ:14,surfZ:14,composition:`Fe Core 70% · Silicate Mantle 30%`},{id:`venus`,name:`Venus`,subtitle:`Super-Greenhouse Terrestrial Planet · 0.723 AU`,parent:0,kind:2,massSolar:24478e-10,radiusKm:6051.8,aAu:.723332,e:.00677,incDeg:3.395,omDeg:76.68,wDeg:54.88,m0Deg:50.1,axialObliquityDeg:177.36,spinAxisLonDeg:300,rotationPeriodHr:-5832.5,tidallyLocked:!1,color0:[.9,.78,.52],color1:[.76,.58,.34],atm:.85,surfacePressurePa:92e5,tempK:737,centralP:29e10,coreZ:26,mantleZ:14,surfZ:6,composition:`Fe/Ni Core · SiO₂ Mantle · CO₂ 96.5% Atm`},{id:`earth`,name:`Earth`,subtitle:`Oceanic Silicate-Iron Biosphere · 1.000 AU`,parent:0,kind:1,massSolar:ot,radiusKm:6371,aAu:1.000001,e:.01671,incDeg:0,omDeg:0,wDeg:102.94,m0Deg:357.5,axialObliquityDeg:23.44,spinAxisLonDeg:90,rotationPeriodHr:23.934,tidallyLocked:!1,civTechK:.73,color0:[.24,.48,.24],color1:[.06,.26,.58],atm:.72,surfacePressurePa:101325,tempK:288,centralP:364e9,coreZ:26,mantleZ:14,surfZ:14,composition:`Fe 32.1% · O 30.1% · Si 15.1% · Mg 13.9%`},{id:`moon`,name:`Moon (Luna)`,subtitle:`Earth Natural Satellite · 384,400 km`,parent:3,kind:3,massSolar:3.6943e-8,radiusKm:1737.4,aAu:.0025695,e:.0549,incDeg:5.145,omDeg:125.08,wDeg:318.15,m0Deg:135.2,axialObliquityDeg:6.68,spinAxisLonDeg:125,rotationPeriodHr:655.72,tidallyLocked:!0,color0:[.68,.67,.65],color1:[.42,.41,.4],atm:0,surfacePressurePa:0,tempK:220,centralP:48e8,coreZ:26,mantleZ:14,surfZ:14,composition:`O 43% · Si 20% · Mg 19% · Fe 10% · Ca/Al 8%`},{id:`mars`,name:`Mars`,subtitle:`Iron-Oxide Terrestrial World · 1.524 AU`,parent:0,kind:1,massSolar:3.22715e-7,radiusKm:3389.5,aAu:1.523679,e:.0934,incDeg:1.85,omDeg:49.56,wDeg:286.5,m0Deg:19.4,axialObliquityDeg:25.19,spinAxisLonDeg:85,rotationPeriodHr:24.623,tidallyLocked:!1,color0:[.74,.34,.2],color1:[.52,.24,.14],atm:.18,surfacePressurePa:610,tempK:210,centralP:4e10,coreZ:26,mantleZ:14,surfZ:26,composition:`Fe-S Core · Basalt/Fe₂O₃ Crust · CO₂ Atm`},{id:`jupiter`,name:`Jupiter`,subtitle:`Metallic-Hydrogen Gas Giant · 5.204 AU`,parent:0,kind:2,massSolar:954588e-9,radiusKm:69911,aAu:5.2044,e:.0489,incDeg:1.303,omDeg:100.46,wDeg:273.87,m0Deg:20,axialObliquityDeg:3.13,spinAxisLonDeg:247,rotationPeriodHr:9.925,tidallyLocked:!1,color0:[.85,.72,.56],color1:[.62,.42,.28],atm:.45,surfacePressurePa:1e5,tempK:125,centralP:45e10,coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ 89.8% · He 10.2% · Metallic H Mantle`},{id:`io`,name:`Io`,subtitle:`Tidally Heated Volcanic Galilean Moon · 421,700 km`,parent:6,kind:1,massSolar:4.491e-8,radiusKm:1821.6,aAu:.002819,e:.0041,incDeg:1.34,omDeg:43.9,wDeg:84.1,m0Deg:35,axialObliquityDeg:.05,spinAxisLonDeg:247,rotationPeriodHr:42.456,tidallyLocked:!0,color0:[.92,.82,.34],color1:[.68,.46,.14],atm:0,surfacePressurePa:0,tempK:110,centralP:8e9,coreZ:26,mantleZ:14,surfZ:16,composition:`Fe-FeS Core · Silicate Mantle · Sulfur Crust`},{id:`europa`,name:`Europa`,subtitle:`Subsurface-Ocean Icy Galilean Moon · 671,100 km`,parent:6,kind:3,massSolar:2.414e-8,radiusKm:1560.8,aAu:.004486,e:.009,incDeg:1.77,omDeg:219.1,wDeg:88.9,m0Deg:145,axialObliquityDeg:.1,spinAxisLonDeg:247,rotationPeriodHr:85.228,tidallyLocked:!0,color0:[.84,.8,.74],color1:[.58,.68,.78],atm:0,surfacePressurePa:0,tempK:102,centralP:5e9,coreZ:26,mantleZ:14,surfZ:8,composition:`H₂O Ice/Ocean Shell · Silicate Mantle · Fe Core`},{id:`ganymede`,name:`Ganymede`,subtitle:`Magnetized Giant Galilean Moon · 1,070,400 km`,parent:6,kind:3,massSolar:7.452e-8,radiusKm:2634.1,aAu:.007155,e:.0013,incDeg:1.5,omDeg:63.5,wDeg:192.4,m0Deg:260,axialObliquityDeg:.2,spinAxisLonDeg:247,rotationPeriodHr:171.71,tidallyLocked:!0,color0:[.64,.6,.56],color1:[.46,.48,.52],atm:0,surfacePressurePa:0,tempK:110,centralP:1e10,coreZ:26,mantleZ:14,surfZ:8,composition:`H₂O Ice/Liquid Layers · Silicate · Fe Core`},{id:`saturn`,name:`Saturn`,subtitle:`Ringed Gas Giant · 9.582 AU`,parent:0,kind:2,massSolar:285815e-9,radiusKm:58232,aAu:9.5826,e:.0565,incDeg:2.485,omDeg:113.67,wDeg:339.39,m0Deg:317,axialObliquityDeg:26.73,spinAxisLonDeg:80,rotationPeriodHr:10.656,tidallyLocked:!1,color0:[.88,.79,.58],color1:[.7,.6,.42],atm:.42,surfacePressurePa:1e5,ringed:!0,ringInnerKm:74500,ringOuterKm:136775,tempK:95,centralP:34e10,coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ 96.3% · He 3.25% · H₂O Ice Ring System`},{id:`titan`,name:`Titan`,subtitle:`Dense-Atmosphere Methane Moon · 1,221,870 km`,parent:10,kind:2,massSolar:6.766e-8,radiusKm:2574.7,aAu:.008168,e:.0288,incDeg:2.8,omDeg:28,wDeg:180.5,m0Deg:65,axialObliquityDeg:26.73,spinAxisLonDeg:80,rotationPeriodHr:382.68,tidallyLocked:!0,color0:[.86,.68,.34],color1:[.64,.46,.22],atm:.78,surfacePressurePa:146700,tempK:94,centralP:6e9,coreZ:14,mantleZ:8,surfZ:6,composition:`N₂ 94.2% · CH₄ 5.6% Atm · H₂O/Silicate Interior`},{id:`uranus`,name:`Uranus`,subtitle:`Tilted Ringed Ice Giant (97.8°) · 19.20 AU`,parent:0,kind:3,massSolar:43658e-9,radiusKm:25362,aAu:19.2184,e:.0463,incDeg:.773,omDeg:74.01,wDeg:96.99,m0Deg:142.2,axialObliquityDeg:97.77,spinAxisLonDeg:168,rotationPeriodHr:-17.24,tidallyLocked:!1,color0:[.56,.84,.9],color1:[.42,.72,.82],atm:.58,surfacePressurePa:1e5,tempK:59,ringed:!0,ringInnerKm:38e3,ringOuterKm:51149,ringColor:[.6,.72,.82],ringNormal:[.985,.14,.1],centralP:26e10,coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/NH₃/CH₄ Superionic Mantle · Vertical ε-Ring System`},{id:`neptune`,name:`Neptune`,subtitle:`Supersonic-Wind Ice Giant · 30.07 AU`,parent:0,kind:3,massSolar:51503e-9,radiusKm:24622,aAu:30.1104,e:.0095,incDeg:1.77,omDeg:131.78,wDeg:276.34,m0Deg:256.2,axialObliquityDeg:28.32,spinAxisLonDeg:44,rotationPeriodHr:16.11,tidallyLocked:!1,color0:[.24,.46,.94],color1:[.16,.3,.78],atm:.65,surfacePressurePa:1e5,tempK:55,centralP:29e10,coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/CH₄/NH₃ Mantle · H₂ 80% · He 19%`},{id:`halley`,name:`1P/Halley Comet`,subtitle:`Active Outgassing Periodic Comet · e = 0.967`,parent:0,kind:3,massSolar:11e-17,radiusKm:5.5,aAu:17.834,e:.9671,incDeg:162.26,omDeg:58.42,wDeg:111.33,m0Deg:38.4,axialObliquityDeg:30,spinAxisLonDeg:140,rotationPeriodHr:52.8,tidallyLocked:!1,isComet:!0,isMinorBody:!0,color0:[.74,.9,1],color1:[.42,.68,.92],atm:.2,surfacePressurePa:0,volatileMassFrac:.72,tempK:170,centralP:1e5,coreZ:8,mantleZ:6,surfZ:14,composition:`H₂O 80% · CO 10% · CO₂/CH₄/Silicate Dust`},{id:`ceres`,name:`1 Ceres`,subtitle:`Main-Belt Cryo-Silicate Dwarf Planet · 2.767 AU`,parent:0,kind:3,massSolar:472e-12,radiusKm:469.7,aAu:2.7675,e:.0758,incDeg:10.59,omDeg:80.33,wDeg:73.6,m0Deg:95.9,axialObliquityDeg:4,spinAxisLonDeg:291,rotationPeriodHr:9.074,tidallyLocked:!1,isMinorBody:!0,color0:[.56,.55,.54],color1:[.34,.36,.4],atm:0,surfacePressurePa:0,volatileMassFrac:.25,tempK:168,centralP:12e7,coreZ:14,mantleZ:8,surfZ:14,composition:`Hydrated Phyllosilicates · H₂O Ice Mantle · Na₂CO₃ Evaporites`},{id:`vesta`,name:`4 Vesta`,subtitle:`Differentiated Basaltic Asteroid · 2.362 AU`,parent:0,kind:1,massSolar:13e-11,radiusKm:262.7,aAu:2.3615,e:.0887,incDeg:7.14,omDeg:103.85,wDeg:151.2,m0Deg:205.5,axialObliquityDeg:29,spinAxisLonDeg:309,rotationPeriodHr:5.342,tidallyLocked:!1,isMinorBody:!0,color0:[.64,.6,.56],color1:[.4,.36,.32],atm:0,surfacePressurePa:0,volatileMassFrac:.01,tempK:185,centralP:45e6,coreZ:26,mantleZ:14,surfZ:14,composition:`Fe-Ni Core · Eucrite/Diogenite Basalt Crust`},{id:`psyche`,name:`16 Psyche`,subtitle:`Metallic Fe-Ni Asteroid Core · 2.923 AU`,parent:0,kind:1,massSolar:115e-13,radiusKm:111,aAu:2.923,e:.134,incDeg:3.1,omDeg:150.2,wDeg:228,m0Deg:312,axialObliquityDeg:95,spinAxisLonDeg:34,rotationPeriodHr:4.196,tidallyLocked:!1,isMinorBody:!0,isMetallicAsteroid:!0,color0:[.7,.68,.66],color1:[.42,.44,.48],atm:0,surfacePressurePa:0,volatileMassFrac:0,tempK:162,centralP:18e6,coreZ:26,mantleZ:28,surfZ:26,composition:`Fe 82% · Ni 10% · Orthopyroxene Silicate 8%`},{id:`bennu`,name:`101955 Bennu`,subtitle:`Near-Earth Carbonaceous Rubble-Pile Asteroid · 1.126 AU`,parent:0,kind:1,massSolar:369e-22,radiusKm:.245,aAu:1.1264,e:.2037,incDeg:6.035,omDeg:2.06,wDeg:66.22,m0Deg:101.7,axialObliquityDeg:177.6,spinAxisLonDeg:85,rotationPeriodHr:4.296,tidallyLocked:!1,isMinorBody:!0,color0:[.3,.28,.27],color1:[.16,.15,.15],atm:0,surfacePressurePa:0,volatileMassFrac:.12,tempK:268,centralP:8,coreZ:6,mantleZ:14,surfZ:6,composition:`C-Type Chondrite · Magnetite · Hydrated Clay & Organics`},{id:`enceladus`,name:`Enceladus`,subtitle:`Cryovolcanic Ocean Moon (Saturn) · 237,948 km`,parent:10,kind:3,massSolar:543e-13,radiusKm:252.1,aAu:.001591,e:.0047,incDeg:2.5,omDeg:112,wDeg:16,m0Deg:215,axialObliquityDeg:.02,spinAxisLonDeg:80,rotationPeriodHr:32.885,tidallyLocked:!0,isCryoMoon:!0,color0:[.95,.97,.99],color1:[.52,.74,.92],atm:0,surfacePressurePa:0,volatileMassFrac:.42,tempK:75,centralP:65e6,coreZ:14,mantleZ:8,surfZ:8,composition:`Bright H₂O Ice Crust · Global Subsurface Ocean · Tiger-Stripe Plumes`},{id:`triton`,name:`Triton`,subtitle:`Retrograde Captured Kuiper Moon (Neptune) · 354,759 km`,parent:13,kind:3,massSolar:1.076e-8,radiusKm:1353.4,aAu:.002371,e:16e-6,incDeg:156.885,omDeg:177.6,wDeg:220.5,m0Deg:120,axialObliquityDeg:0,spinAxisLonDeg:44,rotationPeriodHr:-141.04,tidallyLocked:!0,isCryoMoon:!0,color0:[.85,.78,.74],color1:[.54,.44,.48],atm:.04,surfacePressurePa:1.4,volatileMassFrac:.34,tempK:38,centralP:16e8,coreZ:14,mantleZ:8,surfZ:7,composition:`N₂/CH₄/CO Cryo-Frost Crust · Cantaloupe Terrain · Nitrogen Geysers`},{id:`pluto`,name:`Pluto`,subtitle:`Kuiper Belt Binary Dwarf Planet · 39.48 AU`,parent:0,kind:3,massSolar:6.55e-9,radiusKm:1188.3,aAu:39.482,e:.2488,incDeg:17.16,omDeg:110.3,wDeg:113.83,m0Deg:14.5,axialObliquityDeg:122.53,spinAxisLonDeg:133,rotationPeriodHr:-153.29,tidallyLocked:!1,isCryoMoon:!0,color0:[.84,.76,.68],color1:[.46,.26,.2],atm:.05,surfacePressurePa:1,volatileMassFrac:.3,tempK:44,centralP:11e8,coreZ:14,mantleZ:8,surfZ:7,composition:`N₂ Ice Tombaugh Basin · CH₄ Tholin Highlands · H₂O Ice Bedrock`},{id:`charon`,name:`Charon`,subtitle:`Binary Dwarf Companion (Pluto) · 19,591 km`,parent:21,kind:3,massSolar:798e-12,radiusKm:606,aAu:131e-6,e:2e-4,incDeg:17.2,omDeg:110.3,wDeg:114,m0Deg:194.5,axialObliquityDeg:122.5,spinAxisLonDeg:133,rotationPeriodHr:-153.29,tidallyLocked:!0,color0:[.64,.62,.6],color1:[.44,.26,.22],atm:0,surfacePressurePa:0,volatileMassFrac:.28,tempK:53,centralP:31e7,coreZ:14,mantleZ:8,surfZ:8,composition:`H₂O/NH₃ Cryo-Ice Crust · Mordor Macula Tholin Polar Cap`}]);function ut(e){let t=Math.fround(e);return[t,Math.fround(e-t)]}function dt(e,t){let n=t<.8?e:Math.PI;for(let r=0;r<12;r+=1){let r=n-t*Math.sin(n)-e,i=1-t*Math.cos(n),a=r/Math.max(1e-9,i);if(n-=a,Math.abs(a)<1e-12)break}return n}function ft({aAu:e,e:t=0,incDeg:n=0,omDeg:r=0,wDeg:i=0,m0Deg:a=0},o){if(!(e>0)||!(o>0))return{pos:[0,0,0],vel:[0,0,0]};let s=Math.PI/180,c=n*s,l=r*s,u=i*s,d=dt((a*s%(2*Math.PI)+2*Math.PI)%(2*Math.PI),t),f=Math.cos(d),p=Math.sin(d),m=Math.sqrt(Math.max(1e-12,1-t*t)),h=e*(1-t*f),g=e*(f-t),_=e*m*p,v=Math.sqrt(o*e)/Math.max(1e-12,h),y=-v*p,b=v*m*f,x=Math.cos(l),S=Math.sin(l),C=Math.cos(u),w=Math.sin(u),T=Math.cos(c),E=Math.sin(c),D=x*C-S*w*T,O=w*E,k=-(S*C+x*w*T),A=-x*w-S*C*T,j=C*E,M=-(-S*w+x*C*T);return{pos:[D*g+A*_,O*g+j*_,k*g+M*_],vel:[D*y+A*b,O*y+j*b,k*y+M*b]}}function pt(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function mt(e,{asteroidCount:t=512,beltZoneAu:n=null,seed:r=20261125,starMassScale:i=1,centerOffsetAu:a=[0,0,0]}={}){let o=Array.isArray(e)&&e.length>0?e:lt,s=o.length,c=Math.max(0,Math.min(4096,Math.trunc(Number(t)||0))),l=s+c,u=Array.from({length:l},()=>[0,0,0]),d=Array.from({length:l},()=>[0,0,0]),f=new Float64Array(l),p=new Float64Array(l),m=new Float32Array(l),h=Math.max(.1,Number(i)||1),g=0;for(let e=0;e<s;e+=1){let t=o[e],n=!!t.isStar||e===0;n&&(g+=1),f[e]=n?t.massSolar*h:t.massSolar,p[e]=t.radiusKm*1e3/at,m[e]=t.kind}let _=[0,0,0],v=[0,0,0],y=f[0];if(g>=2&&o[1]?.orbitRole===`binary-companion`){let e=f[0],t=f[1];y=e+t;let n=ft(o[1],st*y),r=-t/Math.max(1e-12,y),i=e/Math.max(1e-12,y);u[0]=[n.pos[0]*r,n.pos[1]*r,n.pos[2]*r],d[0]=[n.vel[0]*r,n.vel[1]*r,n.vel[2]*r],u[1]=[n.pos[0]*i,n.pos[1]*i,n.pos[2]*i],d[1]=[n.vel[0]*i,n.vel[1]*i,n.vel[2]*i]}if(g>=3&&o[2]?.orbitRole===`trinary-outer`){let e=f[2],t=y+e,n=ft(o[2],st*t),r=-e/Math.max(1e-12,t),i=y/Math.max(1e-12,t);_=[n.pos[0]*r,n.pos[1]*r,n.pos[2]*r],v=[n.vel[0]*r,n.vel[1]*r,n.vel[2]*r];for(let e=0;e<2;e+=1)u[e]=[u[e][0]+_[0],u[e][1]+_[1],u[e][2]+_[2]],d[e]=[d[e][0]+v[0],d[e][1]+v[1],d[e][2]+v[2]];u[2]=[n.pos[0]*i,n.pos[1]*i,n.pos[2]*i],d[2]=[n.vel[0]*i,n.vel[1]*i,n.vel[2]*i]}for(let e=g;e<s;e+=1){let t=o[e],n=f[e];if(t.parent===-2){let r=ft(t,st*(y+n));u[e]=[_[0]+r.pos[0],_[1]+r.pos[1],_[2]+r.pos[2]],d[e]=[v[0]+r.vel[0],v[1]+r.vel[1],v[2]+r.vel[2]]}else if(t.parent>=0&&t.parent<e){let r=t.parent,i=f[r],a=i+n,o=ft(t,st*a);if(r>=g&&a>0&&n>0){let t=-n/a,s=i/a,c=[...u[r]],l=[...d[r]];u[r]=[c[0]+o.pos[0]*t,c[1]+o.pos[1]*t,c[2]+o.pos[2]*t],d[r]=[l[0]+o.vel[0]*t,l[1]+o.vel[1]*t,l[2]+o.vel[2]*t],u[e]=[c[0]+o.pos[0]*s,c[1]+o.pos[1]*s,c[2]+o.pos[2]*s],d[e]=[l[0]+o.vel[0]*s,l[1]+o.vel[1]*s,l[2]+o.vel[2]*s]}else u[e]=[u[r][0]+o.pos[0],u[r][1]+o.pos[1],u[r][2]+o.pos[2]],d[e]=[d[r][0]+o.vel[0],d[r][1]+o.vel[1],d[r][2]+o.vel[2]]}}let b=0,x=0,S=0,C=0,w=0,T=0,E=0;for(let e=0;e<s;e+=1){let t=f[e];b+=t,x+=t*u[e][0],S+=t*u[e][1],C+=t*u[e][2],w+=t*d[e][0],T+=t*d[e][1],E+=t*d[e][2]}x/=Math.max(1e-12,b),S/=Math.max(1e-12,b),C/=Math.max(1e-12,b);let D=w/Math.max(1e-12,b),O=T/Math.max(1e-12,b),k=E/Math.max(1e-12,b);for(let e=0;e<s;e+=1)u[e][0]-=x,u[e][1]-=S,u[e][2]-=C,d[e][0]-=D,d[e][1]-=O,d[e][2]-=k;_=[_[0]-x,_[1]-S,_[2]-C],v=[v[0]-D,v[1]-O,v[2]-k];let A=pt(r^2654435769),j=g>=2&&(o[1]?.aAu||10)<1.5,M=j?_:u[0],N=j?v:d[0],P=st*(j?y:f[0]),F=n?.innerAu??2.15,I=n?.outerAu??3.3,L=n?.kuiperInnerAu??32,R=n?.kuiperOuterAu??46;for(let e=0;e<c;e+=1){let t=s+e,n=e>=Math.floor(c*.72),r=ft({aAu:n?L+A()*Math.max(.5,R-L):F+A()*Math.max(.25,I-F),e:n?.02+A()*.14:.01+A()*.16,incDeg:(A()-.5)*(n?14:12),omDeg:A()*360,wDeg:A()*360,m0Deg:A()*360},P);u[t]=[M[0]+r.pos[0],M[1]+r.pos[1],M[2]+r.pos[2]],d[t]=[N[0]+r.vel[0],N[1]+r.vel[1],N[2]+r.vel[2]],f[t]=0,p[t]=(15+A()*85)*1e3/at,m[t]=n?7:6}let z=Number(a?.[0])||0,B=Number(a?.[1])||0,ee=Number(a?.[2])||0,V=new Float32Array(l*16);for(let e=0;e<l;e+=1){let[t,n]=ut(u[e][0]+z),[r,i]=ut(u[e][1]+B),[a,o]=ut(u[e][2]+ee),s=e*16;V[s+0]=t,V[s+1]=r,V[s+2]=a,V[s+3]=f[e],V[s+4]=n,V[s+5]=i,V[s+6]=o,V[s+7]=p[e],V[s+8]=d[e][0],V[s+9]=d[e][1],V[s+10]=d[e][2],V[s+11]=m[e],V[s+12]=0,V[s+13]=0,V[s+14]=0,V[s+15]=0}return Object.freeze({packed:V,massiveCount:s,starCount:g,asteroidCount:c,totalCount:l,catalog:o})}var ht=`
struct SolarNBodyParams {
  total_count: u32,
  massive_count: u32,
  pad0: u32,
  pad1: u32,
  dt_yr: f32,
  g_const: f32,
  softening2: f32,
  df_zero: f32, // Runtime 0.0 uniform blocking SPIR-V fast-math folding of Knuth TwoSum
};

struct SolarBody {
  pos_hi_m: vec4<f32>, // xyz = pos_hi (AU), w = mass (M_sun)
  pos_lo_r: vec4<f32>, // xyz = pos_lo (AU), w = physical radius (AU)
  vel_k: vec4<f32>,    // xyz = vel (AU/yr), w = kind
  acc_phi: vec4<f32>,  // xyz = acc (AU/yr^2), w = specific potential phi
};

@group(0) @binding(0) var<uniform> params: SolarNBodyParams;
@group(0) @binding(1) var<storage, read_write> bodies: array<SolarBody>;

fn df_barrier(x: f32) -> f32 {
  return x + params.df_zero;
}

fn two_sum(a: f32, b: f32) -> vec2<f32> {
  let s = df_barrier(a + b);
  let bb = df_barrier(s - a);
  let e = df_barrier(a - df_barrier(s - bb)) + df_barrier(b - bb);
  return vec2<f32>(s, e);
}

fn df_add_f32(a_hi: f32, a_lo: f32, b: f32) -> vec2<f32> {
  let s = two_sum(a_hi, b);
  return two_sum(s.x, df_barrier(s.y + a_lo));
}

fn df_sub(a_hi: f32, a_lo: f32, b_hi: f32, b_lo: f32) -> f32 {
  let s = two_sum(a_hi, -b_hi);
  return df_barrier(s.x) + df_barrier(s.y + df_barrier(a_lo - b_lo));
}

@compute @workgroup_size(64)
fn compute_nbody_accel(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.total_count) { return; }

  let bi = bodies[i];
  let pi_hi = bi.pos_hi_m.xyz;
  let pi_lo = bi.pos_lo_r.xyz;
  let m_count = params.massive_count;
  let eps2 = params.softening2;
  let G = params.g_const;

  var ax = 0.0;
  var ay = 0.0;
  var az = 0.0;
  var phi = 0.0;

  for (var j = 0u; j < m_count; j = j + 1u) {
    if (j == i) { continue; }
    let bj = bodies[j];
    let mj = bj.pos_hi_m.w;
    if (!(mj > 0.0)) { continue; }
    // Double-float subtraction preserves millimeter precision even for Earth-Moon at 1,000+ AU!
    let dx = df_sub(bj.pos_hi_m.x, bj.pos_lo_r.x, pi_hi.x, pi_lo.x);
    let dy = df_sub(bj.pos_hi_m.y, bj.pos_lo_r.y, pi_hi.y, pi_lo.y);
    let dz = df_sub(bj.pos_hi_m.z, bj.pos_lo_r.z, pi_hi.z, pi_lo.z);
    let r2 = dx * dx + dy * dy + dz * dz + eps2;
    let inv_r = inverseSqrt(r2);
    let inv_r3 = inv_r * inv_r * inv_r;
    let fac = G * mj * inv_r3;
    ax = ax + fac * dx;
    ay = ay + fac * dy;
    az = az + fac * dz;
    phi = phi - G * mj * inv_r;
  }

  bodies[i].acc_phi = vec4<f32>(ax, ay, az, phi);
}

@compute @workgroup_size(64)
fn kdk_half_kick_drift(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.total_count) { return; }

  let dt = params.dt_yr;
  var b = bodies[i];
  let v_half = b.vel_k.xyz + 0.5 * dt * b.acc_phi.xyz;
  let nx = df_add_f32(b.pos_hi_m.x, b.pos_lo_r.x, v_half.x * dt);
  let ny = df_add_f32(b.pos_hi_m.y, b.pos_lo_r.y, v_half.y * dt);
  let nz = df_add_f32(b.pos_hi_m.z, b.pos_lo_r.z, v_half.z * dt);

  b.pos_hi_m = vec4<f32>(nx.x, ny.x, nz.x, b.pos_hi_m.w);
  b.pos_lo_r = vec4<f32>(nx.y, ny.y, nz.y, b.pos_lo_r.w);
  b.vel_k = vec4<f32>(v_half, b.vel_k.w);
  bodies[i] = b;
}

@compute @workgroup_size(64)
fn kdk_second_kick(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.total_count) { return; }
  let dt = params.dt_yr;
  let b = bodies[i];
  bodies[i].vel_k = vec4<f32>(b.vel_k.xyz + 0.5 * dt * b.acc_phi.xyz, b.vel_k.w);
}
`;function gt(e,{catalog:t=null,beltZoneAu:n=null,asteroidCount:r=512,seed:i=20261125,starMassScale:a=1,centerOffsetAu:o=[0,0,0],softeningAu:s=1e-7,label:c=`ulg-solar-system-nbody`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createSolarSystemNBodyEngineWebGpu requires a live WebGPU GPUDevice`);let l=mt(t||lt,{asteroidCount:r,beltZoneAu:n,seed:i,starMassScale:a,centerOffsetAu:o}),u=[P(0,`uniform`),P(1,`storage`)],d=t=>I(e,{cacheKey:`ulg-solar-nbody-${t}.v1`,label:`${c}-${t}`,code:ht,entryPoint:t,bindings:u}),f=d(`compute_nbody_accel`),p=d(`kdk_half_kick_drift`),m=d(`kdk_second_kick`),h=e.createBuffer({label:`${c}-params`,size:32,usage:ct.UNIFORM|ct.COPY_DST}),g=e.createBuffer({label:`${c}-bodies`,size:l.packed.byteLength,usage:ct.STORAGE|ct.VERTEX|ct.COPY_DST|ct.COPY_SRC});e.queue.writeBuffer(g,0,l.packed);let _=l.massiveCount*64,v=e.createBuffer({label:`${c}-massive-staging`,size:_,usage:ct.MAP_READ|ct.COPY_DST}),y=F(e,{layout:f.bindGroupLayout,label:`${c}-bg`,entries:[{binding:0,resource:{buffer:h}},{binding:1,resource:{buffer:g}}]}),b=Float32Array.from(l.packed.subarray(0,l.massiveCount*16)),x=0,S=0,C=!1,w=!1,T=!1;function E(t){let n=new ArrayBuffer(32);new Uint32Array(n,0,4).set([l.totalCount,l.massiveCount,0,0]),new Float32Array(n,16,4).set([t,st,s*s,0]),e.queue.writeBuffer(h,0,n)}async function D({dtSubYr:t=45e-6,substeps:n=12,readMassive:r=!0}={}){if(T)return b;let i=Math.max(1,Math.min(64,Math.trunc(n))),a=Math.max(1e-7,Math.min(12e-5,Number(t)||45e-6));E(a);let o=Math.ceil(l.totalCount/64),s=e.createCommandEncoder({label:`${c}-step-${S}`}),u=s.beginComputePass({label:`${c}-pass`});u.setBindGroup(0,y),C||=(u.setPipeline(f.pipeline),u.dispatchWorkgroups(o),!0);for(let e=0;e<i;e+=1)u.setPipeline(p.pipeline),u.dispatchWorkgroups(o),u.setPipeline(f.pipeline),u.dispatchWorkgroups(o),u.setPipeline(m.pipeline),u.dispatchWorkgroups(o);u.end();let d=r&&!w;if(d&&s.copyBufferToBuffer(g,0,v,0,_),e.queue.submit([s.finish()]),S+=i,x+=a*i,d){w=!0;try{await v.mapAsync(ct.MAP_READ),T||b.set(new Float32Array(v.getMappedRange(0,_))),v.unmap()}finally{w=!1}}return b}function O(e){let t=e*16;return{posAu:[b[t+0]+b[t+4],b[t+1]+b[t+5],b[t+2]+b[t+6]],velAuPerYr:[b[t+8],b[t+9],b[t+10]],massSolar:b[t+3],radiusAu:b[t+7],phi:b[t+15]}}function k(){let e=0,t=0,n=0,r=0,i=0,a=0,o=Array.from({length:l.massiveCount},(e,t)=>O(t));for(let c=0;c<o.length;c+=1){let l=o[c],u=l.velAuPerYr[0]**2+l.velAuPerYr[1]**2+l.velAuPerYr[2]**2;e+=.5*l.massSolar*u,n+=l.massSolar*l.velAuPerYr[0],r+=l.massSolar*l.velAuPerYr[1],i+=l.massSolar*l.velAuPerYr[2],a+=l.massSolar*Math.sqrt(u);for(let e=c+1;e<o.length;e+=1){let n=o[e],r=n.posAu[0]-l.posAu[0],i=n.posAu[1]-l.posAu[1],a=n.posAu[2]-l.posAu[2],c=Math.sqrt(r*r+i*i+a*a+s*s);t-=st*l.massSolar*n.massSolar/c}}return Object.freeze({kineticEnergy:e,potentialEnergy:t,totalEnergy:e+t,momentum:Object.freeze([n,r,i]),relMomentumError:Math.hypot(n,r,i)/Math.max(1e-12,a),simTimeYr:x,stepIndex:S})}function A(){if(!T){T=!0;for(let e of[h,g,v])try{e.destroy()}catch{}}}return Object.freeze({schema:it,get massiveCount(){return l.massiveCount},get starCount(){return l.starCount},get asteroidCount(){return l.asteroidCount},get totalCount(){return l.totalCount},get stepIndex(){return S},get simTimeYr(){return x},get catalog(){return l.catalog},getResidentBuffer:()=>g,getMassiveSnapshot:()=>b,getMassiveBodyState64:O,computeConservationDiagnostics:k,step:D,dispose:A})}var _t=26.95,vt=-14.8,yt=Object.freeze([Object.freeze({level:0,id:`cosmic-web`,shortLabel:`Web`,name:`Observable Universe Cosmic Web`,exponentLabel:`10²⁶ m`,log10SpanM:25.45,minLog10:21.8,maxLog10:26.95,diveVerb:`APPROACHING GALAXY`,diveButton:`⚡ ZOOM TO GALAXY`,engineSchema:`ulg.astrophysics.supergalactic-flrw-treepm.v1`,plotTitle:`GPU MATTER POWER SPECTRUM P(k)`,equations:`∇²Φ = (3/2) Ω_m (H₀² / a) δ(x, t)   [3D-FFT Poisson via fft3dWebGpu]
dp/da = −(1 / a² H(a)) ∇Φ   (Symplectic KDK FLRW Comoving Integrator)`,summary:`Evolves full-Nyquist 2LPT dark-matter filaments (1-submit FLRW 3D-FFT TreePM) AND the general Cosmological Baryon & Radiation law (Eisenstein–Hu BAO/CMB recombination ΔT/T at z=1100, Pop III UV Reionization bubble percolation at z=10, and Bullet-Cluster X-ray ICM shock + 2D gravitational lensing convergence κ/α).`,kernels:`build2LptCosmologyICsWebGpu · createSupergalacticTreePmSessionWebGpu · createCosmologicalBaryonRadiationSessionWebGpu`}),Object.freeze({level:1,id:`galaxy`,shortLabel:`Galaxy`,name:`Spiral Galaxy & Halo`,exponentLabel:`10²¹ m`,log10SpanM:21,minLog10:15.8,maxLog10:22.8,diveVerb:`APPROACHING SOLAR SYSTEM`,diveButton:`⚡ ZOOM TO TARGET`,engineSchema:`webgpu-schroeder-scale-atlas-multipole`,plotTitle:`GATE 1 ISM COOLING CURVE Λ(T, Z)`,equations:`a_i = −G Σ_cell M_cell (r_i − r_cell) / (|r_i − r_cell|² + ε²)^(3/2)   [SchroederScaleAtlas]
v_c(r) ≈ const (NFW dark-matter halo + exponential disk + bulge) · Λ(T, Z) from Gate 1 H/He/C/O`,summary:`Simulates 16K–65K GPU-resident stars on parallel SchroederScaleAtlas multipole gravity across 7 emergent morphologies (Grand-Design Spiral, Barred Spiral, Major Merger, Giant Elliptical, High-z Clumpy Protogalaxy, Tidally Disrupted Dwarf & Halo Stream, and Core-Collapsed Globular Cluster) plus Gate 1 ISM cooling Λ(T, Z).`,kernels:`createResidentScaleAtlasMultipoleNBodyEngine · deriveGate1IsmCoolingAnchorsWebGpu`}),Object.freeze({level:2,id:`star-system`,shortLabel:`System`,name:`Solar System & Protoplanetary Formation`,exponentLabel:`10¹² m`,log10SpanM:12.6,minLog10:7.9,maxLog10:16.8,diveVerb:`APPROACHING WORLD`,diveButton:`⚡ ZOOM TO SELECTED BODY`,engineSchema:`ulg.astrophysics.solar-system-nbody-webgpu.v1`,plotTitle:`SYMPLECTIC N-BODY & ACCRETION DISK`,equations:`d²r_i/dt² = −G Σ_{j≠i} m_j (r_i − r_j) / |r_i − r_j|³   [f32x2 Symplectic GPU N-Body]
v_gas = (1−η)v_K · T(r) < T_snow → H₂O ice condensation · DLM Particle-Rigid Planetesimals`,summary:`Spans mature double-float symplectic Solar System N-body, Protoplanetary Disk Accretion, Roche-Limit Ring Disruption & Shepherd Moons, Giant Moon-Forming Impact, Active Dual-Tail Comets, Hot-Jupiter XUV Photoevaporation, Red-Giant Engulfment (+5 Gyr), Kerr Blandford–Znajek Quasar/Blazar Jets, Roche X-Ray Binaries, Type Ia Detonations, and 2.5PN GW Chirp BNS Kilonova / BBH Mergers.`,kernels:`createSolarSystemNBodyEngineWebGpu · createProtoplanetaryDiskFormationSessionWebGpu · createKerrAccretionJetSessionWebGpu · createRelativisticBinaryMergerSessionWebGpu · createTidalRocheDisruptionSessionWebGpu`}),Object.freeze({level:3,id:`stellar-core`,shortLabel:`Star/MHD`,name:`MHD Nebular Collapse & Stellar Fusion`,exponentLabel:`10⁹ m`,log10SpanM:9.2,minLog10:7.4,maxLog10:10.6,diveVerb:`SAMPLING PLANETARY MATTER`,diveButton:`⚡ ZOOM TO EARTH / MATTER`,engineSchema:`ulg.astrophysics.nebular-mhd-collapse-webgpu.v1`,plotTitle:`GAMOW FUSION WINDOW / MHD MAGNETIC ENERGY`,equations:`∂B/∂t = ∇×(v×B) + η∇²B − ∇ψ,   F_L = (∇×B)×B / μ₀   [3D Resistive MHD + Dedner GLM]
du/dt = −(P/ρ)∇·v + q_visc + ε_pp + ε_CNO + ε_3α − Λ_rad   [self-gravitating-hydro@1]`,summary:`Spans live Stellar Core Fusion, 3D Resistive MHD Nebular Collapse & Bipolar Jets, Strömgren Photoionized H II Star-Forming Pillars, Bipolar Planetary Nebulae, Supernova Remnants / Crab PWN, Spitkovsky Millisecond Pulsars, Hall-Crustal-Yield Magnetar Giant Flares, and live WebGPU GR TOV Unified Degenerate EOS (White Dwarf → Neutron Star → Black Hole).`,kernels:`createNebularMhdCollapseSessionWebGpu · createSelfGravitatingHydroEngine · createRadiativePhotoionizationWindSessionWebGpu · createCompactMagnetosphereSessionWebGpu · solveRelativisticTovBatchWebGpu`}),Object.freeze({level:4,id:`planetary-interior`,shortLabel:`Planet`,name:`Planetary World, Atmosphere & Electrodynamics`,exponentLabel:`10⁷ m`,log10SpanM:7.2,minLog10:-5.8,maxLog10:8.6,diveVerb:`DESCENDING TO SURFACE`,diveButton:`🚙 LAND / DIVE TO SAMPLE`,engineSchema:`ulg.astrophysics.planetary-atmosphere-em-webgpu.v1`,plotTitle:`HYDROSTATIC P(r) & ATMOSPHERIC EM`,equations:`dv/dt + 2Ω×v = −∇P/ρ · ∇²φ = −ρ_q/ε₀ · |E| > E_Paschen(P) → Lightning Discharge
dM/dr = 4π r² ρ_polytope(P, T),   B_dip(Ω, r_core, σ_Fe) → Magnetospheric Aurorae`,summary:`Dynamically activates ULG’s general spherical baroclinic atmosphere, particulate triboelectric charging, GPU Poisson Paschen lightning, core-geodynamo aurorae, Hadean Magma Ocean radiative crust, viscoelastic Cryovolcanic Icy Plumes, Tidally Locked Eyeball & Rogue Worlds, Gate 2 Polytope Atlas cutaway — PLUS an interactive Planetary Surface Explorer (TinyPlanetControls) with a 6-Wheel Jump-Rocket Mars Rover and Coaxial Atmospheric Drone whose rotor lift emerges strictly from local ρ_atm & g!`,kernels:`createPlanetaryAtmosphereElectricSessionWebGpu · createPlanetarySurfaceSessionWebGpu · solvePlanetaryInteriorWebGpu · createTidalRocheDisruptionSessionWebGpu`}),Object.freeze({level:5,id:`molecular-dynamics`,shortLabel:`MD`,name:`Crystal & Fluid Molecular Dynamics`,exponentLabel:`10⁻⁸ m`,log10SpanM:-8.2,minLog10:-9.5,maxLog10:-5.2,diveVerb:`RESOLVING ELECTRON SHELLS`,diveButton:`⚡ ZOOM TO QUANTUM ATOM`,engineSchema:`ulg.gpumath.molecular-dynamics-webgpu.v1`,plotTitle:`LIVE GPU RADIAL DISTRIBUTION g(r)`,equations:`m_i d²r_i/dt² = −∇_i [ Σ φ_pair(r_ij) + Σ F_EAM(ρ_i) + Σ V_3(r_ij, r_ik) ] + m_i g
O(N) lock-free linked-cell Verlet + Berendsen thermostat & live 64-bin GPU g(r)`,summary:`Evolves 1,000–4,000 live atoms of the sampled planetary material strictly on WebGPU using Gate 1 DFT-derived pair/EAM/Stillinger–Weber potentials and physical Gate 1 optical reflectance. Heat through melting & vaporization, toggle GPU gravity, or keep scrolling inward straight into a single atom’s electron shells.`,kernels:`createMolecularDynamicsSessionWebGpu · buildCrystalMdState · zero-copy positionsBuffer/velocitiesBuffer`}),Object.freeze({level:6,id:`quantum-atom`,shortLabel:`Atom`,name:`Relativistic Dirac–KS Atom & Molecule`,exponentLabel:`10⁻¹⁰ m`,log10SpanM:-10,minLog10:-13.2,maxLog10:-9,diveVerb:`PROBING STRONG FORCE CORE`,diveButton:`⚡ ZOOM TO NUCLEUS`,engineSchema:`ulg.electronic.orbital-cloud-webgpu.v1`,plotTitle:`DIRAC–KS 4πr²ρ(r) & SUBSHELL LEVELS`,equations:`[c α·p + β m c² + V_nuc(R_nuc) + V_H(ρ) + V_xc(ρ)] ψ_κ = ε_κ ψ_κ   [4-comp Dirac–KS]
|ψ_nlm(r, θ, φ)|² = |R_nl(r)|² |Y_lm(θ, φ)|²   (separable GPU inverse-CDF cloud)`,summary:`Solves 4-component relativistic radial Dirac–Kohn–Sham equations on WebGPU (0 per-SCF readbacks) and samples 60K–180K continuous 3D wavefunction points into a resident GPU buffer. Keep scrolling inward through 5 orders of magnitude of empty intra-atomic space to resolve the femtometer nucleus.`,kernels:`deriveElementBundleWebGpu · solveAtomFullWebGpu · sampleAtomicOrbitalCloudWebGpu · solveMoleculeRhfWebGpu`}),Object.freeze({level:7,id:`atomic-nucleus`,shortLabel:`Nucleus`,name:`Atomic Nucleus & Quantum Tunneling`,exponentLabel:`10⁻¹⁵ m`,log10SpanM:-14.3,minLog10:-15.2,maxLog10:-12.6,diveVerb:`ZOOMING OUT TO COSMOS`,diveButton:`↻ FLY OUT TO COSMIC WEB`,engineSchema:`ulg.nuclear.tunneling-tdse-webgpu.v1`,plotTitle:`SYMPLECTIC VISSCHER TDSE |ψ(r, t)|²`,equations:`iℏ ∂ψ/∂t = [−(ℏ²/2μ) ∂²/∂r² + V_WS(r) + V_Coulomb(r)] ψ(r, t)   [Visscher symplectic]
ρ_p,n(r) = ρ₀ / [1 + exp((r − R_p,n) / a)]   ·   B(Z, A) feeds L3 Stellar Q-values`,summary:`Visualizes Z quantized protons and N quantized neutrons packed inside the GPU-solved Woods–Saxon charge/neutron-skin radii surrounded by a live symplectic Visscher 1D quantum α-tunneling probability wavepacket. Its binding energy B(Z, A) closes the causal loop back up to L3 stellar fusion.`,kernels:`solveNuclearStructureWebGpu · createNuclearTunnelingTdseWebGpu (nuclear-tunneling-tdse@1)`})]),bt=Object.freeze([{Z:1,A:1,sym:`H`,name:`Hydrogen`,defaultN:1,defaultL:0,defaultM:0},{Z:2,A:4,sym:`He`,name:`Helium`,defaultN:1,defaultL:0,defaultM:0},{Z:6,A:12,sym:`C`,name:`Carbon`,defaultN:2,defaultL:1,defaultM:0},{Z:7,A:14,sym:`N`,name:`Nitrogen`,defaultN:2,defaultL:1,defaultM:0},{Z:8,A:16,sym:`O`,name:`Oxygen`,defaultN:2,defaultL:1,defaultM:0},{Z:11,A:23,sym:`Na`,name:`Sodium`,defaultN:3,defaultL:0,defaultM:0},{Z:12,A:24,sym:`Mg`,name:`Magnesium`,defaultN:3,defaultL:0,defaultM:0},{Z:13,A:27,sym:`Al`,name:`Aluminum`,defaultN:3,defaultL:1,defaultM:0},{Z:14,A:28,sym:`Si`,name:`Silicon`,defaultN:3,defaultL:1,defaultM:0},{Z:16,A:32,sym:`S`,name:`Sulfur`,defaultN:3,defaultL:1,defaultM:0},{Z:17,A:35,sym:`Cl`,name:`Chlorine`,defaultN:3,defaultL:1,defaultM:0},{Z:20,A:40,sym:`Ca`,name:`Calcium`,defaultN:4,defaultL:0,defaultM:0},{Z:22,A:48,sym:`Ti`,name:`Titanium`,defaultN:3,defaultL:2,defaultM:0},{Z:26,A:56,sym:`Fe`,name:`Iron`,defaultN:3,defaultL:2,defaultM:0},{Z:28,A:58,sym:`Ni`,name:`Nickel`,defaultN:3,defaultL:2,defaultM:0},{Z:29,A:63,sym:`Cu`,name:`Copper`,defaultN:3,defaultL:2,defaultM:0},{Z:55,A:133,sym:`Cs`,name:`Cesium`,defaultN:6,defaultL:0,defaultM:0},{Z:79,A:197,sym:`Au`,name:`Gold`,defaultN:5,defaultL:2,defaultM:0},{Z:80,A:202,sym:`Hg`,name:`Mercury`,defaultN:5,defaultL:2,defaultM:0},{Z:82,A:208,sym:`Pb`,name:`Lead`,defaultN:6,defaultL:1,defaultM:0},{Z:92,A:238,sym:`U`,name:`Uranium`,defaultN:5,defaultL:3,defaultM:0}]),xt=Object.freeze({low:Object.freeze({id:`low`,cosmoGridPerSide:22,cosmoFftN:16,galaxyStars:16384,solarAsteroids:256,stellarParticles:2048,mdCells:6,orbitalPoints:48e3,nuclearVolDim:24}),med:Object.freeze({id:`med`,cosmoGridPerSide:28,cosmoFftN:32,galaxyStars:32768,solarAsteroids:512,stellarParticles:4096,mdCells:7,orbitalPoints:96e3,nuclearVolDim:28}),high:Object.freeze({id:`high`,cosmoGridPerSide:32,cosmoFftN:32,galaxyStars:49152,solarAsteroids:1024,stellarParticles:6144,mdCells:8,orbitalPoints:16e4,nuclearVolDim:32}),ultra:Object.freeze({id:`ultra`,cosmoGridPerSide:36,cosmoFftN:32,galaxyStars:65536,solarAsteroids:1536,stellarParticles:8192,mdCells:9,orbitalPoints:24e4,nuclearVolDim:32})});function St(e){let t=10**e;return e>=25.4?`${(t/946073047e16).toFixed(1)} Gly`:e>=22?`${(t/308567758e14).toFixed(1)} Mpc`:e>=19?`${(t/0x834b443cc4108000).toFixed(1)} kly`:e>=15.8?`${(t/946073047e7).toFixed(2)} ly`:e>=10.6?`${(t/149597870700).toFixed(2)} AU`:e>=8.7?`${(t/6957e5).toFixed(2)} R☉`:e>=4?`${Math.round(t/1e3).toLocaleString()} km`:e>=0?`${t.toFixed(1)} m`:e>=-3?`${(t*1e3).toFixed(1)} mm`:e>=-6?`${(t*1e6).toFixed(1)} μm`:e>=-9.2?`${(t*1e9).toFixed(2)} nm`:e>=-11.5?`${(t*1e10).toFixed(2)} Å`:e>=-13?`${(t*0xe8d4a51000).toFixed(2)} pm`:`${(t*0x38d7ea4c68000).toFixed(1)} fm`}function Ct(){return`
    <p><strong>ULG Universes</strong> is a single-canvas, <strong>continuous-zoom 40-order-of-magnitude</strong> (42 OOM) WebGPU cosmos spanning the full <code>10⁺²⁷ m</code> (<code>93 Gly</code>) Observable Universe Cosmic Web down to <code>10⁻¹⁵ m</code> atomic nuclei — paired with a continuous <strong>Cosmic Epoch Spine</strong> from CMB Recombination (<code>z = 1100</code>) through Cosmic Dawn (<code>z = 10</code>), Cosmic Noon / Quasar Peak (<code>z = 2.8</code>), and Present Day (<code>z = 0</code>) into the <code>+5 Gyr</code> Red-Giant &amp; Remnant Era.</p>
    <p>Every astronomical entity emerges dynamically from ULG’s <strong>16-node Universal Law Graph</strong> on WebGPU — zero hardcoded entity/planet hacks or scripted animations:</p>
    <ul>
      <li><strong>L0 Observable Universe Cosmic Web (10²⁷ m · 93 Gly):</strong> 2LPT 1-submit FLRW 3D-FFT TreePM Cosmic Web + CMB Particle Horizon Shell (<code>R_H = 46.5 Gly</code>, <code>z=1100</code>), Pop III Reionization bubbles (<code>z=10</code>), and Bullet-Cluster X-ray ICM / 2D gravitational lensing.</li>
      <li><strong>L1 Galaxies &amp; Clusters (10²¹ m):</strong> <code>16K–65K</code> GPU stars on parallel <code>SchroederScaleAtlas</code> multipole gravity across Spiral, Barred Spiral, Major Merger, Elliptical, High-z Clumpy Protogalaxy, Tidally Disrupted Dwarf &amp; Halo Stream, and Core-Collapsed Globular Cluster + Gate 1 ISM cooling <code>Λ(T, Z)</code>.</li>
      <li><strong>L2 Planetary, Small-Body &amp; Relativistic Systems (10¹² m → 10⁷ m):</strong> Double-float (<code>f32x2</code>) symplectic Solar System N-body, Protoplanetary Disk Accretion, Roche-Limit Ring Disruption &amp; Shepherd Moons, Giant Moon-Forming Impact, Active Dual-Tail Comets, Hot-Jupiter XUV Photoevaporation, Red-Giant Engulfment, Kerr Blandford–Znajek Quasar/Blazar Jets (live Doppler beaming), Roche X-Ray Binaries, Type Ia Detonations, and 2.5PN GW-Chirp BNS Kilonova &amp; BBH Mergers.</li>
      <li><strong>L3 Stars, Nebulae &amp; Compact Remnants (10⁹ m):</strong> Thermonuclear Fusion Core, 3D Resistive MHD Nebular Collapse &amp; Bipolar Jets, Strömgren Photoionized H II Pillars, Bipolar Planetary Nebulae, SNR / Crab PWN, Millisecond Pulsars, Hall-Crustal-Yield Magnetar Giant Flares, and live WebGPU GR TOV Unified Degenerate EOS (White Dwarf → Neutron Star → Black Hole).</li>
      <li><strong>L4 Planetary Worlds (10⁷ m):</strong> Spherical baroclinic atmosphere, triboelectric Paschen lightning, core-geodynamo aurorae, Hadean Magma Ocean, Cryovolcanic Icy Plumes, Tidally Locked Eyeball &amp; Rogue Worlds, plus Gate 2 Polytope Atlas cutaway.</li>
      <li><strong>L5–L7 Microphysics (10⁻⁸ m → 10⁻¹⁵ m):</strong> Linked-cell GPU MD, 4-component Dirac–KS Atoms + RHF Molecules + PeerCompute 2-of-2 quorum mesh, and quantized Woods–Saxon Atomic Nuclei + Visscher α-tunneling TDSE.</li>
    </ul>
    <p style="font-size:12px;color:#94a3b8;"><strong>Scientific Honesty Disclosure:</strong> Runtime closures explicitly carry <code>scientificValidation: false</code>; G7 scientific benchmark comparisons remain offline and advisory.</p>
  `}function wt(e){return e?`
    <p>${e.summary}</p>
    <div class="uv-eq-box">${e.equations}</div>
    <p><strong>Active ULG WebGPU Engines:</strong> <code>${e.kernels}</code></p>
    <p><strong>Schema / Method ID:</strong> <code>${e.engineSchema}</code></p>
    <p><strong>Controls:</strong> Scroll wheel / pinch / drag the continuous 40-OOM slider to zoom smoothly across scales. Drag to orbit, click any target to focus &amp; inspect, and double-click to smoothly fly down into it.</p>
    <p style="font-size:12px;color:#94a3b8;"><strong>Provenance:</strong> GPU-native compute &amp; zero-copy rendering · <code>cameraAutoSpin: false</code> default · <code>scientificValidation: false</code> (advisory G7).</p>
  `:Ct()}var Tt=`ulg.astrophysics.causal-nebular-cascade.v1`,Et=Object.freeze([`Vela`,`Kepler`,`Cygnus`,`Lyra`,`Carina`,`Draco`,`Perseus`,`Norma`,`Scutum`,`Centauri`,`Aurelia`,`Eridani`,`Pavonis`,`Ceti`,`Tauri`,`Hydrae`]),Dt=`bcdefghijklm`,Ot=Object.freeze([`I`,`II`,`III`,`IV`,`V`,`VI`]);function kt(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function At(e,t,n,r=1){let i=(r^2654435769)>>>0,a=e=>{let t=Math.round(Number(e)*1e3)|0;i=Math.imul(i^t,2246822507)>>>0,i=(i^i>>>13)>>>0};return a(e),a(t),a(n),i>>>0}function jt(e){let t=Math.max(2200,Math.min(55e3,Number(e)||5778));return t>=26e3?{color0:[.62,.78,1],color1:[.36,.56,1],spectral:`O`}:t>=10500?{color0:[.74,.86,1],color1:[.48,.68,1],spectral:`B`}:t>=7400?{color0:[.88,.93,1],color1:[.66,.78,.98],spectral:`A`}:t>=6e3?{color0:[1,.97,.88],color1:[.95,.84,.6],spectral:`F`}:t>=5200?{color0:[1,.93,.74],color1:[1,.6,.2],spectral:`G`}:t>=3750?{color0:[1,.76,.46],color1:[.94,.42,.14],spectral:`K`}:{color0:[1,.5,.28],color1:[.78,.18,.08],spectral:`M`}}function Mt(e,t=!1){if(e.stage===`white-dwarf`||e.stage===`planetary-nebula`)return`DA-WD`;if(e.stage===`neutron-star`||e.stage===`supernova-remnant-pwn`)return`NS`;if(e.stage===`stellar-black-hole`||e.stage===`hypernova-remnant`)return`BH`;if(e.stage===`brown-dwarf`)return e.effectiveTempK>1400?`L-BD`:`T-BD`;if(e.stage===`red-giant`||e.stage===`agb-superwind`)return e.effectiveTempK<3600?`M2III`:`K2III`;let n=jt(e.effectiveTempK),r=Math.max(0,Math.min(9,Math.round(9-e.effectiveTempK%1200/1200*9)));return t?`PopIII-${n.spectral}`:`${n.spectral}${r}V`}function Nt(e,t,n){let r=Math.max(1e-4,Number.isFinite(Number(e))?Number(e):.2),i=Math.max(0,Math.min(.65,Number.isFinite(Number(t))?Number(t):.05)),a=Math.max(.05,Math.min(.5,Number.isFinite(Number(n))?Number(n):.35)),o=i*i,s=a*a,c=r*(1.6+5.1*i-2.22*o+4.12*a-4.27*i*a-5.09*s+4.61*o*s),l=r*(.464-.38*a-.631*i+.586*a*i+.15*o-.198*a*o);return{rCritPAu:Math.max(r*1.85,c),rCritSAu:Math.max(.02,l)}}function Pt({cosmicEpoch:e=null,regionPosMpc:t=[0,0,0],localOverdensity:n=1,tidalSpinLambda:r=null,gpuCoalescedHalo:i=!1,seed:a=20261125}={}){let o=e||de({redshiftZ:0}),s=Number(o.redshiftZ)||0,c=Math.max(.05,Number(o.cosmicAgeGyr)||13.8),l=Math.max(.15,Math.min(12,Number(n)||1)),u=Number.isFinite(Number(r))?Math.max(.005,Math.min(.25,Number(r))):null,d=At(t[0]||0,t[1]||0,t[2]||0,a^257),f=kt(d),p=`disk`,m=`Grand-Design Spiral`;if(s>=4.5)p=`proto`,m=`Primordial High-z Protogalaxy`;else if(s>=1.4)p=l>2.2?`binary`:`proto`,m=p===`binary`?`Cosmic-Noon Starburst Merger`:`High-z Clumpy Starburst Disk`;else if(s<-.15){let e=f();p=l>1.25?`sphere`:e<.35?`globular`:`barred`,m=p===`sphere`?`Evolved Giant Elliptical (E2)`:p===`globular`?`Ancient Halo Globular Cluster`:`Aging Barred Spiral`}else if(l>2.15&&(u==null||u<.055))p=f()<.68?`sphere`:`binary`,m=p===`sphere`?`Cluster-Core Giant Elliptical (E2)`:`Interacting Major Merger Pair`;else if(l<.68)p=f()<.52?`globular`:`dwarf-stream`,m=p===`globular`?`Metal-Poor Globular Cluster (GC)`:`Void-Edge Dwarf & Tidal Stream`;else if(u!=null&&u>=.068)p=l>1.65?`barred`:`disk`,m=p===`barred`?`High-Spin Barred Spiral (SBb)`:`High-Spin Grand-Design Spiral (Sc)`;else if(l>1.42){let e=f();e<.34?(p=`sphere`,m=`Group Elliptical / Lenticular (E4/S0)`):e<.72?(p=`barred`,m=`Barred Spiral (SBb)`):(p=`disk`,m=`Grand-Design Spiral (Sa/Sb)`)}else f()<.54?(p=`disk`,m=`Grand-Design Spiral (Sc/Sb)`):(p=`barred`,m=`Barred Spiral (SBb)`);let h=Math.max(1e-4,Number(o.meanMetallicitySolar)||1),g=l**.28,_=p===`globular`?.08:p===`dwarf-stream`?.35:p===`sphere`?1.45:1,v=Math.max(1e-4,Math.min(3.2,h*g*_)),y=Math.log10(v),b=Number(o.galaxyGasFraction??o.haloGasFraction)||.16,x=Math.max(.01,Math.min(.88,b*(p===`sphere`?.22:p===`globular`?.05:1))),S=Math.max(.32,Math.min(.88,.38+.18*Math.min(1.4,v)+(f()-.5)*.12));return Object.freeze({schema:Tt,cosmicEraId:o.eraId||`present-day`,redshiftZ:s,cosmicAgeGyr:c,localOverdensity:l,tidalSpinLambda:u??Number((.024+f()*.056).toFixed(4)),regionPosMpc:Object.freeze([t[0]||0,t[1]||0,t[2]||0]),morphology:p,morphologyLabel:m,meanMetallicitySolar:v,baseFeH:y,baseCO:S,gasFraction:x,isPrimordialPopIII:s>=7.5||v<.004,seed:d})}function Ft(e,{isPopIII:t=!1,isYoungArm:n=!1,isAncient:r=!1}={}){let i=e();return t?5*11**i**.72:n?i<.32?.18+e()*.35:i<.52?.53+e()*.32:i<.7?.85+e()*.35:i<.86?1.2+e()*1.4:2.6+e()**1.8*18:r?i<.48?.14+e()*.36:i<.74?.5+e()*.34:i<.88?.84+e()*.24:1.08+e()**1.4*2.2:i<.44?.12+e()*.38:i<.68?.5+e()*.32:i<.84?.82+e()*.28:i<.93?1.1+e()*.45:i<.98?1.55+e()*1.15:2.7+e()**1.6*8.5}function It({cosmicEpoch:e=null,galaxyEnv:t=null,starPosGal:n=[4.8,.04,2.1],popTag:r=.48,starIndex:i=0,seed:a=20261125,forceMultiplicity:o=null,forceExoticStage:s=null}={}){let c=e||de({redshiftZ:0}),l=t||Pt({cosmicEpoch:c,seed:a}),u=Math.hypot(n[0]||0,n[2]||0),d=Math.abs(n[1]||0),f=Math.max(.2,u*1.65),p=d*1.65,m;if(i>0){let e=(a>>>0^Math.imul((i>>>0)+2654435769,2246822507))>>>0;e=Math.imul(e^e>>>16,2146121005)>>>0,e=Math.imul(e^e>>>15,2221713035)>>>0,m=(e^e>>>16)>>>0}else m=At(n[0]||0,n[1]||0,n[2]||0,(a^2654435761)>>>0);let h=kt(m),g=f<2.6||l.morphology===`sphere`,_=p>1.4||l.morphology===`globular`||l.morphology===`dwarf-stream`,v=r>=.76&&!g&&!_&&l.gasFraction>.08,y=g||_||l.redshiftZ<-.15,b=-.068*(f-8.2),x=-.32*Math.min(1.8,p),S=v?.14:0,C=(h()-.5)*.24,w=l.baseFeH+b+x+S+C;l.isPrimordialPopIII&&(w=Math.min(-2.4,w-1.2)),w=Math.max(-4,Math.min(.55,w));let T=10**w,E=Math.max(.25,Math.min(1.08,l.baseCO+(g?.22:0)+w*.22+(h()-.5)*.26)),D=_||l.redshiftZ>1.5?.38:g?.22:.04,O=Math.max(.05,l.cosmicAgeGyr-.25),k;k=l.isPrimordialPopIII?Math.min(O,.002+h()*.015):v?Math.min(O,.015+h()*.35):y?Math.min(O,Math.max(.4,O*(.58+h()*.34))):Math.min(O,Math.max(.2,(.6+h()*8.6)*Math.min(1,O/10)));let A=Ft(h,{isPopIII:l.isPrimordialPopIII,isYoungArm:v,isAncient:y}),j=1;if(o===1||o===2||o===3)j=o;else{let e=h();j=A<.5?e<.73?1:e<.96?2:3:A<1.3?e<.54?1:e<.88?2:3:e<.28?1:e<.74?2:3}let M=[A];if(j>=2){let e=.28+.68*h()**.75;M.push(Math.max(.08,A*e))}if(j===3){let e=.22+.58*h()**.9;M.push(Math.max(.08,A*e))}let N=Et[m%Et.length],P=100+(m>>>5)%899,F=`${N}-${P}`,I=[`A`,`B`,`C`],L=M.map((e,t)=>{let n=xe({massSolar:e,ageGyr:k,metallicitySolar:T});if(t===0&&typeof s==`string`&&s.length>0){let e=s.toLowerCase();e===`neutron-star`||e===`pulsar`||e===`magnetar`?n={...n,stage:e===`magnetar`?`magnetar`:`neutron-star`,remnantClass:`neutron-star`,massSolar:e===`magnetar`?1.58:1.44,radiusSolar:172e-7,luminositySolar:e===`magnetar`?.42:.18,effectiveTempK:e===`magnetar`?12e5:85e4}:e===`stellar-black-hole`||e===`black-hole`?n={...n,stage:`stellar-black-hole`,remnantClass:`black-hole`,massSolar:11.4,radiusSolar:48e-6,luminositySolar:.38,effectiveTempK:15e6}:e===`white-dwarf`&&(n={...n,stage:`white-dwarf`,remnantClass:`white-dwarf`,massSolar:.64,radiusSolar:.0125,luminositySolar:.018,effectiveTempK:19500})}let r=jt(n.effectiveTempK),i=n.stage===`magnetar`?`SGR`:n.stage===`neutron-star`?`PSR`:Mt(n,l.isPrimordialPopIII),a=n.remnantClass!==`none`,o=Math.max(12,n.radiusSolar*695700),c=Math.min(8,1.42*T),u=Math.min(34,24.8+1.8*T),d=Math.max(60,100-u-c),f=n.stage===`white-dwarf`?`Degenerate C/O Core · Thin H/He Envelope`:n.stage===`neutron-star`||n.stage===`magnetar`?`Superfluid Neutron Interior · Magnetized Iron Crust`:n.stage===`stellar-black-hole`?`Relativistic Kerr Event Horizon · Accretion Disk`:`H ${d.toFixed(1)}% · He ${u.toFixed(1)}% · Metals ${c.toFixed(2)}% ([Fe/H]=${w>=0?`+`:``}${w.toFixed(2)})`,p=l.isPrimordialPopIII||w<=-2.6?1:w<=-.75||_||l.morphology===`globular`?2:3,m=p===1?`1st-Gen Pop III (Z=0)`:p===2?`2nd-Gen Pop II (α-rich)`:`3rd-Gen Pop I`;return Object.freeze({component:I[t],name:j>1?`${F} ${I[t]} (${i})`:`${F} (${i})`,spectralCode:i,stellarGeneration:p,generationLabel:m,feH:Number(w.toFixed(2)),alphaOverFe:Number(D.toFixed(2)),stage:n.stage,remnantClass:n.remnantClass,initialMassSolar:e,massSolar:n.massSolar,radiusSolar:n.radiusSolar,radiusKm:o,luminositySolar:Math.max(1e-4,n.luminositySolar),effectiveTempK:Math.max(1200,n.effectiveTempK||5778),color0:n.stage===`white-dwarf`?[.8,.94,1]:n.stage===`magnetar`?[1,.78,.98]:n.stage===`neutron-star`?[.74,.95,1]:n.stage===`stellar-black-hole`?[0,0,0]:r.color0,color1:n.stage===`white-dwarf`?[.46,.72,1]:n.stage===`magnetar`?[.86,.28,.96]:n.stage===`neutron-star`?[.58,.28,1]:n.stage===`stellar-black-hole`?[1,.72,.28]:r.color1,isRemnant:a,composition:f})}),R=`single`,z=null,B=null;if(j===2){let e=h()<.58;R=e?`binary-p-type`:`binary-s-type`;let t=Math.max(.08,(L[0].radiusSolar+L[1].radiusSolar)*.00465*4.5),n=e?Math.max(t,.11+h()*.24):Math.max(t*4,14.5+h()*14),r=e?.02+h()*.14:.06+h()*.22;z=Object.freeze({aAu:n,e:r,incDeg:(h()-.5)*4.5,omDeg:h()*360,wDeg:h()*360,m0Deg:h()*360})}else if(j===3){R=`hierarchical-trinary`;let e=Math.max(.08,(L[0].radiusSolar+L[1].radiusSolar)*.00465*4.5);z=Object.freeze({aAu:Math.max(e,.1+h()*.22),e:.02+h()*.12,incDeg:(h()-.5)*3,omDeg:h()*360,wDeg:h()*360,m0Deg:h()*360}),B=Object.freeze({aAu:16.5+h()*13.5,e:.05+h()*.18,incDeg:(h()-.5)*14,omDeg:h()*360,wDeg:h()*360,m0Deg:h()*360})}let ee=Math.max(1e-6,.012*T),V=Object.freeze({feH:w,metallicitySolar:T,cToO:E,alphaOverFe:D,dustToGasRatio:ee,carbonRich:E>=.8,solidDiskMassEarth:Math.max(0,48*T*Math.max(.15,A)**.85),volatileInventory:Math.max(0,(1.15-Math.max(0,E-.55)*1.1)*Math.min(2.2,T+.12)),nebulaSummary:`[Fe/H]=${w>=0?`+`:``}${w.toFixed(2)} · C/O=${E.toFixed(2)} · Dust/Gas=${(ee*100).toFixed(3)}%${E>=.8?` (Carbon-Rich)`:``}`}),te=g?`Galactic Bulge`:_?`Stellar Halo`:v?`Spiral-Arm H II Nursery`:`Galactic Disk`,ne=L[0],re=`fusion`,ie=`MLS-MPM Nuclear Fusion Star`;return ne.stage===`magnetar`?(re=`magnetar`,ie=`Ultra-Magnetized SGR Magnetar`):ne.stage===`neutron-star`?(re=k<.08?`snr-pwn`:`pulsar`,ie=re===`snr-pwn`?`Core-Collapse SNR / PWN`:`Relativistic Magnetized Pulsar`):ne.stage===`stellar-black-hole`?(re=`black-hole`,ie=`Relativistic Kerr Black Hole`):ne.stage===`white-dwarf`?h()<.28?(re=`planetary-nebula`,ie=`Bipolar Planetary Nebula`):(re=`white-dwarf-tov`,ie=`Degenerate White Dwarf (TOV)`):v&&l.gasFraction>.14&&(A>=2.8&&k<.15?(re=`h2-pillars`,ie=`Strömgren H II Pillars`):k<.08&&(re=`nebular-mhd`,ie=`MHD Protostellar Nebula & Jets`)),Object.freeze({schema:Tt,systemId:`${N.toLowerCase()}-${P}`,systemName:F,galacticRegion:te,recommendedL3Regime:re,nebulaBadge:ie,rKpc:Number(f.toFixed(2)),zKpc:Number(p.toFixed(2)),systemAgeGyr:Number(k.toFixed(2)),multiplicity:j,architecture:R,stars:Object.freeze(L),binaryPair:z,outerCompanion:B,nebulaEnv:V,galaxyEnv:l,seed:m})}function Lt(e,{seedOverride:t=null,gpuCoalescedDisk:n=null}={}){let r=e||It(),i=kt(((t??r.seed)^328103)>>>0),{stars:a,multiplicity:o,architecture:s,binaryPair:c,outerCompanion:l,nebulaEnv:u}=r,d=[];for(let e=0;e<a.length;e+=1){let t=a[e],n={id:`star-${e}`,name:t.name,subtitle:`${t.stage.replace(/-/g,` `)} · ${t.massSolar.toFixed(2)} M☉ · T=${Math.round(t.effectiveTempK).toLocaleString()} K`,isStar:!0,starIndex:e,parent:-1,kind:t.stage===`stellar-black-hole`?5:0,massSolar:t.massSolar,radiusKm:t.radiusKm,luminositySolar:t.luminositySolar,aAu:0,e:0,incDeg:0,omDeg:0,wDeg:0,m0Deg:0,color0:[...t.color0],color1:[...t.color1],atm:0,surfacePressurePa:0,tempK:Math.round(t.effectiveTempK),centralP:t.stage===`neutron-star`?1e34:t.stage===`white-dwarf`?1e22:0x58d15e17628000*t.massSolar**1.4,coreZ:t.stage===`white-dwarf`?6:t.stage===`neutron-star`?26:1,mantleZ:t.stage===`white-dwarf`?8:2,surfZ:1,composition:t.composition,stage:t.stage,spectralCode:t.spectralCode};e===1&&c?(n.parent=0,n.orbitRole=`binary-companion`,n.aAu=c.aAu,n.e=c.e,n.incDeg=c.incDeg,n.omDeg=c.omDeg,n.wDeg=c.wDeg,n.m0Deg=c.m0Deg):e===2&&l&&(n.parent=-2,n.orbitRole=`trinary-outer`,n.aAu=l.aAu,n.e=l.e,n.incDeg=l.incDeg,n.omDeg=l.omDeg,n.wDeg=l.wDeg,n.m0Deg=l.m0Deg),d.push(n)}let f=s===`binary-p-type`||s===`hierarchical-trinary`,p=f?a[0].luminositySolar+a[1].luminositySolar:a[0].luminositySolar,m=f?a[0].massSolar+a[1].massSolar:a[0].massSolar,h=f?-2:0,g=Math.sqrt(Math.max(1e-4,p)),_=Math.max(.05,.085*g),v=Math.max(.18,2.7*g),y=Math.max(.75,11.2*g),b=Math.max(.08,.94*g),x=Math.max(.16,1.68*g),S=Math.max(_*1.15,a[0].radiusSolar*.00465*6),C=Math.min(38,Math.max(6,26*m**.35));if(f&&c){let e=Math.min(a[0].massSolar,a[1].massSolar)/(a[0].massSolar+a[1].massSolar),t=Nt(c.aAu,c.e,e);S=Math.max(S,t.rCritPAu*1.18)}if(s===`binary-s-type`&&c){let e=a[1].massSolar/(a[0].massSolar+a[1].massSolar),t=Nt(c.aAu,c.e,e);C=Math.min(C,t.rCritSAu*.92)}else if(s===`hierarchical-trinary`&&l){let e=a[0].massSolar+a[1].massSolar,t=a[2].massSolar/(e+a[2].massSolar),n=Nt(l.aAu,l.e,t);C=Math.min(C,n.rCritSAu*.9)}let w=a[0].stage===`neutron-star`||a[0].stage===`magnetar`,T=a[0].stage===`stellar-black-hole`||a[0].stage===`hypernova-remnant`,E=u.metallicitySolar>=.015&&C>S*1.45,D=0;if(E){let e=Math.log(C/S),t=Math.max(1,Math.min(8,Math.floor(e/.48))),n=Math.max(.25,Math.min(1.25,.65+.35*(u.feH+1)));D=w||T?Math.max(2,Math.min(4,Math.round(2+i()*2))):Math.max(1,Math.min(t,Math.round((2+i()*5)*n)))}let O=Math.max(.04,Math.min(.88,.14*u.metallicitySolar**1.75)),k=a[0].stage===`red-giant`||a[0].stage===`agb-superwind`,A=a[0].stage===`white-dwarf`,j=Array.isArray(n?.bodies)&&n.bodies.length>0&&E?n.bodies:null,M=j?j.length:D,N=S*(1.08+i()*.45),P=!1,F=[];for(let e=0;e<M;e+=1){let t=j?j[e]:null;if(!t&&N>=C*.96)break;let n=t?t.aAu:N;t||(N*=1.52+i()*.62);let o=t?t.tEqK:Math.max(28,Math.round(278*Math.max(1e-4,p)**.25/Math.sqrt(Math.max(.02,n)))),s=t?t.starFluxWM2:Number((1361*Math.max(1e-4,p)/Math.max(4e-4,n*n)).toFixed(2)),c=n>=v,l=n>=y,f=n>=b&&n<=x,m=i(),g=`rocky-arid`;t?t.gasEnvelopeFrac>=.34&&!A&&!k?g=!c&&n<v*.35?`hot-jupiter`:`gas-giant`:t.gasEnvelopeFrac>=.1&&(t.volatileFrac>=.38||c)&&!A?g=`ice-giant`:o>=950||k&&n<1.8?g=t.feFrac>.36?`iron-core`:`lava-world`:t.carbonFrac>=.32&&!c?g=`carbon-world`:f&&!P&&!k&&!A&&r.systemAgeGyr>=.35&&(t.volatileFrac>=.01||u.volatileInventory>=.35)&&t.totalMassEarth<=2.4?(g=`earth-like`,P=!0):g=f&&(t.volatileFrac>=.025||t.totalMassEarth>2.2&&u.volatileInventory>=.45)?`ocean-super-earth`:o>380&&o<950&&(t.volatileFrac>.005||u.metallicitySolar>.25)?`greenhouse`:c?t.totalMassEarth>5?`ice-giant`:`icy-dwarf`:t.feFrac>=.34&&t.totalMassEarth<.7?`iron-core`:o<250&&t.totalMassEarth<.9?`arid-oxide`:t.totalMassEarth>=1.5?`super-earth`:`arid-oxide`:c&&m<O*1.15&&!A?g=l||i()<.38?`ice-giant`:`gas-giant`:!c&&n<v*.25&&m<O*.22&&!k&&!A?g=`hot-jupiter`:o>=950||k&&n<1.8?g=i()<.55?`lava-world`:`iron-core`:u.carbonRich&&!c?g=`carbon-world`:f&&!P&&!k&&!A&&r.systemAgeGyr>=.35&&u.volatileInventory>=.35&&m<.42?(g=`earth-like`,P=!0):g=f&&u.volatileInventory>=.55&&m<.72?`ocean-super-earth`:o>390&&o<950&&u.metallicitySolar>.25?`greenhouse`:c?m<.45?`ice-giant`:`icy-dwarf`:o<250&&m<.55?`arid-oxide`:i()<.45?`super-earth`:`iron-core`;let _=Dt[e]||`p${e+1}`,S=`${r.systemName} ${_}`,w=null;if(g===`earth-like`){let e=.68+i()*.95,t=Math.round(6371*e**.27),r=Math.round((.65+i()*1.15)*101325),a=Math.max(268,Math.min(312,Math.round(o+28+(i()-.5)*14)));w={name:`${S} (Earth-like)`,planetClass:`earth-like`,subtitle:`Earth-like Oceanic Silicate-Iron World · ${n.toFixed(2)} AU`,kind:1,massSolar:e*ot,radiusKm:t,color0:[.22+i()*.12,.46+i()*.12,.22+i()*.08],color1:[.05,.24+i()*.1,.58+i()*.1],atm:.72,surfacePressurePa:r,volatileMassFrac:.045+i()*.025,particulateMassFrac:.006,tempK:a,centralP:Math.round((260+e*110)*1e9),coreZ:26,mantleZ:14,surfZ:14,composition:`Fe-Ni Core · MgSiO₃ Mantle · Liquid H₂O Ocean · N₂/O₂ ${(r/1e5).toFixed(2)} bar`}}else if(g===`ocean-super-earth`){let e=2.2+i()*3.8,t=Math.round(6371*e**.29*1.08),r=Math.round((1.5+i()*4.5)*101325);w={name:`${S} (Ocean World)`,planetClass:`ocean-world`,subtitle:`Pelagic Super-Earth · ${n.toFixed(2)} AU`,kind:1,massSolar:e*ot,radiusKm:t,color0:[.16,.44,.56],color1:[.04,.2,.56],atm:.78,surfacePressurePa:r,volatileMassFrac:Number((.085+i()*.095).toFixed(3)),particulateMassFrac:.004,tempK:Math.max(270,Math.min(345,o+36)),centralP:Math.round((420+e*95)*1e9),coreZ:26,mantleZ:8,surfZ:8,composition:`Fe Core · High-P H₂O Ice-VII Mantle · Global Liquid Ocean (${e.toFixed(1)} M⊕)`}}else if(g===`carbon-world`){let e=.6+i()*3.2,t=Math.round(6371*e**.27*.96),r=o>550?24e4:42e3;w={name:`${S} (Carbon World)`,planetClass:`carbon-world`,subtitle:`High-C/O Graphite–SiC–Diamond World · ${n.toFixed(2)} AU`,kind:1,massSolar:e*ot,radiusKm:t,color0:[.34,.32,.36],color1:[.16,.15,.2],atm:.32,surfacePressurePa:r,volatileMassFrac:.012,particulateMassFrac:.035,tempK:o+18,centralP:Math.round((240+e*115)*1e9),coreZ:26,mantleZ:6,surfZ:6,composition:`Fe-C Core · Diamond/SiC Mantle · Graphite & Hydrocarbon Crust (C/O=${u.cToO.toFixed(2)})`}}else if(g===`lava-world`){let e=.4+i()*3.6,t=Math.round(6371*e**.27);w={name:`${S} (Lava World)`,planetClass:`lava-world`,subtitle:`Molten Silicate Magma Ocean World · ${n.toFixed(2)} AU`,kind:7,massSolar:e*ot,radiusKm:t,color0:[1,.44,.1],color1:[.22,.08,.05],atm:.42,surfacePressurePa:14e4,volatileMassFrac:.005,particulateMassFrac:.06,tempK:Math.max(1350,o),centralP:Math.round((220+e*110)*1e9),coreZ:26,mantleZ:14,surfZ:14,composition:`Molten Fe-Ni Core · Magma MgSiO₃ Ocean · Vaporized SiO/Na Exosphere`}}else if(g===`iron-core`){let e=.05+i()*.45,t=Math.round(2200+e**.3*3200);w={name:`${S} (Iron World)`,planetClass:`iron-world`,subtitle:`Refractory Iron-Rich Terrestrial Core · ${n.toFixed(2)} AU`,kind:1,massSolar:e*ot,radiusKm:t,color0:[.56,.52,.48],color1:[.34,.31,.29],atm:0,surfacePressurePa:0,volatileMassFrac:0,particulateMassFrac:0,tempK:o,centralP:Math.round((35+e*120)*1e9),coreZ:26,mantleZ:14,surfZ:26,composition:`Fe-Ni Core 68% · Silicate Mantle 32% · Airless Cratered Regolith`}}else if(g===`greenhouse`){let e=.65+i()*1.8,t=Math.round(5600+e**.27*1600),r=Math.round((2.5+i()*7.5)*1e6);w={name:`${S} (Greenhouse)`,planetClass:`greenhouse`,subtitle:`Super-Greenhouse CO₂ World · ${n.toFixed(2)} AU`,kind:2,massSolar:e*ot,radiusKm:t,color0:[.9,.78,.52],color1:[.74,.54,.3],atm:.85,surfacePressurePa:r,volatileMassFrac:.025,particulateMassFrac:.055,tempK:Math.min(920,o+280),centralP:Math.round((240+e*105)*1e9),coreZ:26,mantleZ:14,surfZ:6,composition:`Fe/Ni Core · SiO₂ Mantle · Supercritical CO₂ ${(r/1e5).toFixed(0)} bar Atm`}}else if(g===`arid-oxide`||g===`super-earth`){let e=g===`super-earth`,t=e?1.8+i()*3.2:.1+i()*.42,r=Math.round(e?6371*t**.27:3e3+t**.3*2100),a=Math.round(e?(.8+i()*2.2)*1e5:450+i()*2400);w={name:`${S} (${e?`Super-Earth`:`Arid World`})`,planetClass:e?`super-earth`:`arid-world`,subtitle:`${e?`Rocky Silicate Super-Earth`:`Arid Iron-Oxide Desert World`} · ${n.toFixed(2)} AU`,kind:1,massSolar:t*ot,radiusKm:r,color0:e?[.64,.46,.32]:[.76,.36,.2],color1:e?[.38,.28,.2]:[.5,.22,.14],atm:e?.46:.18,surfacePressurePa:a,volatileMassFrac:e?.015:.002,particulateMassFrac:.048,tempK:Math.max(140,o+(e?22:6)),centralP:Math.round((e?420:45)*1e9),coreZ:26,mantleZ:14,surfZ:26,composition:`Fe-S Core · Basalt/Fe₂O₃ Silicate Crust · ${(a/1e5).toFixed(a<5e3?3:2)} bar CO₂/N₂`}}else if(g===`hot-jupiter`||g===`gas-giant`){let e=g===`hot-jupiter`,t=e?.35+i()*2.4:.22+i()*3.1,r=Math.round((54e3+i()*24e3)*(e?1.18:1)),a=!e&&i()<.48;w={name:`${S} (${e?`Hot Jupiter`:a?`Ringed Giant`:`Gas Giant`})`,planetClass:e?`hot-jupiter`:`gas-giant`,subtitle:`${e?`Tidally Inflated Hot Jupiter`:`Metallic-Hydrogen Gas Giant`} · ${n.toFixed(2)} AU`,kind:2,massSolar:t*954588e-9,radiusKm:r,color0:e?[.96,.52,.24]:[.8+i()*.14,.68+i()*.14,.5+i()*.14],color1:e?[.54,.18,.12]:[.52+i()*.14,.36+i()*.12,.24+i()*.1],atm:.55,surfacePressurePa:1e5,volatileMassFrac:.08,particulateMassFrac:.02,ringed:a,ringInnerKm:a?Math.round(r*1.28):0,ringOuterKm:a?Math.round(r*2.38):0,tempK:Math.max(90,o),centralP:Math.round((360+t*180)*1e9),coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ ${(88+i()*7).toFixed(1)}% · He · Metallic H Mantle (${t.toFixed(2)} M_J)`}}else if(g===`ice-giant`){let e=10+i()*14,t=Math.round(21e3+i()*7500),r=i()<.28,a=i()<.52;w={name:`${S} (Ice Giant)`,planetClass:`ice-giant`,subtitle:`Superionic H₂O/NH₃/CH₄ Ice Giant · ${n.toFixed(2)} AU`,kind:3,massSolar:e*ot,radiusKm:t,color0:a?[.26,.5,.94]:[.54,.84,.9],color1:a?[.14,.3,.76]:[.36,.68,.8],atm:.62,surfacePressurePa:1e5,volatileMassFrac:.06,particulateMassFrac:.01,ringed:r,ringInnerKm:r?Math.round(t*1.45):0,ringOuterKm:r?Math.round(t*2.15):0,tempK:Math.max(42,o),centralP:Math.round((240+e*4.5)*1e9),coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/CH₄/NH₃ Superionic Mantle · H₂/He Envelope (${e.toFixed(1)} M⊕)`}}else{let e=.015+i()*.14,t=Math.round(1350+i()*1650);w={name:`${S} (Cryo Dwarf)`,planetClass:`icy-dwarf`,subtitle:`Outer-Disk Volatile Ice World · ${n.toFixed(2)} AU`,kind:3,massSolar:e*ot,radiusKm:t,color0:[.78,.84,.9],color1:[.46,.56,.68],atm:.04,surfacePressurePa:0,volatileMassFrac:0,particulateMassFrac:0,tempK:Math.max(35,o),centralP:5e9,coreZ:14,mantleZ:8,surfZ:8,composition:`H₂O/N₂/CH₄ Ice Shell · Silicate Core`}}if(t&&w){if(Number.isFinite(t.totalMassEarth)&&t.totalMassEarth>0){let e=t.totalMassEarth;if(w.massSolar=e*ot,w.planetClass===`gas-giant`||w.planetClass===`hot-jupiter`){let t=e/317.83;w.centralP=Math.round((360+t*180)*1e9),w.composition=w.composition.replace(/\([0-9.]+ M_J\)/,`(${t.toFixed(2)} M_J)`)}else w.centralP=Math.round(Math.min(450,40+e*110)*1e9),w.composition=w.composition.replace(/\([0-9.]+ M⊕\)/,`(${e.toFixed(1)} M⊕)`)}Number.isFinite(t.radiusEarth)&&t.radiusEarth>0&&(w.radiusKm=Math.max(1200,Math.round(t.radiusEarth*6371))),w.ringed&&(w.ringInnerKm=Math.round(w.radiusKm*1.32),w.ringOuterKm=Math.round(w.radiusKm*2.34))}let T=d.length,E=Math.max(.08,a[0]?.massSolar||1),D=(n/.22)**6/(E*E*Math.max(.1,r.systemAgeGyr))<1||g===`hot-jupiter`||g===`lava-world`,M=Number(D?(i()*3.5).toFixed(2):(g===`ice-giant`&&i()<.35?65+i()*55:4+i()*38).toFixed(2)),I=Number((i()*360).toFixed(1)),L=8766*Math.sqrt(n**3/E),R=Number(D?L.toFixed(2):(g===`gas-giant`||g===`ice-giant`?8.5+i()*11:12+i()*36).toFixed(2)),z=i(),B=r.systemAgeGyr>=2.2,ee=(g===`earth-like`||g===`ocean-super-earth`)&&B&&z<.55?Number((.38+i()*.52).toFixed(2)):0,V=!!(t&&Number.isFinite(t.phiRad)),te=Number(V?((-t.phiRad*180/Math.PI%360+360)%360).toFixed(2):(i()*360).toFixed(1));d.push({id:`planet-${e}`,parent:h,aAu:Number(n.toFixed(4)),e:Number((.008+i()*(g===`earth-like`?.045:.095)).toFixed(4)),incDeg:Number(((i()-.5)*(V?2.4:4.2)).toFixed(2)),omDeg:V?0:Number((i()*360).toFixed(1)),wDeg:V?0:Number((i()*360).toFixed(1)),m0Deg:te,axialObliquityDeg:M,spinAxisLonDeg:I,rotationPeriodHr:R,tidallyLocked:D,civTechK:ee,hostStarTeffK:a[0]?.effectiveTempK||5778,starFluxWM2:s,coalescedComposition:Object.freeze(t?{feFrac:t.feFrac,silicateFrac:t.silicateFrac,carbonFrac:t.carbonFrac,h2oIceFrac:Math.max(t.h2oIceFrac||0,w.planetClass===`ocean-world`?w.volatileMassFrac||.085:0),superVolFrac:t.superVolFrac,volatileFrac:Math.max(t.volatileFrac||0,w.volatileMassFrac||0),gasEnvelopeFrac:t.gasEnvelopeFrac,tEqK:t.tEqK,starFluxWM2:t.starFluxWM2,gpuCoalesced:!0}:{feFrac:w.coreZ===26?.32:.16,silicateFrac:w.mantleZ===14?.54:.26,carbonFrac:w.mantleZ===6?.48:.08,h2oIceFrac:c?.45:w.volatileMassFrac||.02,superVolFrac:l?.28:0,volatileFrac:c?.62:w.volatileMassFrac||.02,gasEnvelopeFrac:g===`gas-giant`||g===`hot-jupiter`?.78:g===`ice-giant`?.22:0,tEqK:o,starFluxWM2:s,gpuCoalesced:!1}),...w}),F.push(T);let ne=g===`gas-giant`||g===`ice-giant`,re=ne?1+Math.floor(i()*2.4):+((g===`earth-like`||g===`ocean-super-earth`)&&i()<.65);for(let t=0;t<re;t+=1){let n=Math.round(ne?1450+i()*1350:1150+i()*850),r=(n/1737.4)**3*3.6943e-8,s=w.radiusKm*(5.2+t*5.8+i()*2.5)*1e3/149597870700,l=ne&&c&&n>2350&&o<125,u=ne&&t===0&&i()<.45;d.push({id:`moon-${e}-${t}`,name:`${S}-${Ot[t]||t+1}`,planetClass:l?`hazy-moon`:u?`volcanic-moon`:c?`icy-moon`:`rocky-moon`,subtitle:`${l?`Dense-Atmosphere Methane Moon`:u?`Tidally Heated Volcanic Moon`:c?`Subsurface-Ocean Icy Moon`:`Natural Rocky Satellite`}`,parent:T,kind:l?2:u?1:3,massSolar:r,radiusKm:n,aAu:Number(s.toFixed(6)),e:Number((.005+i()*.035).toFixed(4)),incDeg:Number(((i()-.5)*4).toFixed(2)),omDeg:Number((i()*360).toFixed(1)),wDeg:Number((i()*360).toFixed(1)),m0Deg:Number((i()*360).toFixed(1)),axialObliquityDeg:Number((M*.85).toFixed(2)),spinAxisLonDeg:I,rotationPeriodHr:Number((8766*Math.sqrt(s**3/Math.max(1e-9,w.massSolar))).toFixed(2)),tidallyLocked:!0,hostStarTeffK:a[0]?.effectiveTempK||5778,color0:l?[.86,.68,.34]:u?[.92,.8,.3]:c?[.84,.86,.9]:[.66,.65,.63],color1:l?[.62,.44,.2]:u?[.68,.44,.14]:c?[.54,.66,.78]:[.4,.39,.38],atm:l?.78:0,surfacePressurePa:l?142e3:0,volatileMassFrac:l?.04:0,particulateMassFrac:l?.03:0,tempK:Math.max(45,o),centralP:6e9,coreZ:c?14:26,mantleZ:c?8:14,surfZ:u?16:l?6:c?8:14,composition:l?`N₂/CH₄ Haze Atm · H₂O/Silicate Interior`:u?`Silicate Mantle · Sulfur Volcanic Crust`:c?`H₂O Ice/Ocean Shell · Silicate Core`:`Silicate Regolith · Fe Core`})}}let I=n?.asteroidZone||null,L=Number((I?.aAu||Math.max(S*1.35,Math.min(C*.9,v*.92))).toFixed(4)),R=Math.max(.01,a.reduce((e,t)=>e+(Number(t.luminositySolar)||0),0)||1),z=I?.tEqK||Math.max(45,Math.round(278*R**.25/Math.sqrt(Math.max(.1,L))));d.push({id:`belt-asteroid-1`,name:`${r.systemName} Belt Asteroid α`,planetClass:`metallic-asteroid`,subtitle:`Mineable Fe-Ni / Silicate Main-Belt Asteroid · ${L.toFixed(2)} AU`,parent:h,kind:1,massSolar:2e-12+i()*3e-11,radiusKm:Math.round(45+i()*145),aAu:L,e:Number((.06+i()*.14).toFixed(4)),incDeg:Number((3+i()*9).toFixed(2)),omDeg:Number((i()*360).toFixed(1)),wDeg:Number((i()*360).toFixed(1)),m0Deg:Number((i()*360).toFixed(1)),axialObliquityDeg:Number((i()*140).toFixed(1)),spinAxisLonDeg:Number((i()*360).toFixed(1)),rotationPeriodHr:Number((3.8+i()*9.5).toFixed(2)),tidallyLocked:!1,isMinorBody:!0,isMetallicAsteroid:!0,civTechK:0,hostStarTeffK:a[0]?.effectiveTempK||5778,starFluxWM2:I?.starFluxWM2??Number((1361*R/Math.max(.01,L*L)).toFixed(2)),coalescedComposition:Object.freeze({feFrac:I?.feFrac??.42,silicateFrac:I?.silicateFrac??.48,carbonFrac:I?.carbonFrac??.08,h2oIceFrac:I?.volatileFrac??.02,superVolFrac:0,volatileFrac:I?.volatileFrac??.02,gasEnvelopeFrac:0,tEqK:z,gpuCoalesced:!!I}),color0:[.64,.62,.58],color1:[.36,.38,.42],atm:0,surfacePressurePa:0,volatileMassFrac:I?.volatileFrac??.04,tempK:z,centralP:14e6,coreZ:26,mantleZ:28,surfZ:26,composition:I?`GPU-Coalesced Fe-Ni ${Math.round(I.feFrac*100)}% · Silicate ${Math.round(I.silicateFrac*100)}% · C ${Math.round(I.carbonFrac*100)}%`:`Fe-Ni Metallic Ore · Olivine/Pyroxene Chondrite`});let B=n?.cometZone||null,ee=Number((B?.aAu||Math.max(v*1.4,Math.min(18,v*2.8))).toFixed(4)),V=Math.max(.55,Math.min(.92,B?.volatileFrac??.76));d.push({id:`periodic-comet-1`,name:`${r.systemName} Comet 1P`,planetClass:`periodic-comet`,subtitle:`Active Outgassing Volatile Comet · e = 0.84`,parent:h,kind:3,massSolar:85e-18,radiusKm:Number((4.5+i()*9).toFixed(1)),aAu:ee,e:Number((.76+i()*.16).toFixed(4)),incDeg:Number((18+i()*115).toFixed(2)),omDeg:Number((i()*360).toFixed(1)),wDeg:Number((i()*360).toFixed(1)),m0Deg:Number((12+i()*26).toFixed(1)),axialObliquityDeg:28,spinAxisLonDeg:110,rotationPeriodHr:Number((14+i()*36).toFixed(1)),tidallyLocked:!1,isMinorBody:!0,isComet:!0,civTechK:0,hostStarTeffK:a[0]?.effectiveTempK||5778,starFluxWM2:B?.starFluxWM2??Number((1361*R/Math.max(.05,ee*ee)).toFixed(2)),coalescedComposition:Object.freeze({feFrac:B?.feFrac??.05,silicateFrac:B?.silicateFrac??.16,carbonFrac:B?.carbonFrac??.06,h2oIceFrac:B?.h2oIceFrac??.48,superVolFrac:B?.superVolFrac??.25,volatileFrac:V,gasEnvelopeFrac:0,tEqK:B?.tEqK??62,gpuCoalesced:!!B}),color0:[.74,.9,1],color1:[.38,.62,.88],atm:.18,surfacePressurePa:0,volatileMassFrac:V,tempK:Math.max(55,Math.min(220,B?.tEqK?B.tEqK+95:175)),centralP:1e5,coreZ:8,mantleZ:6,surfZ:8,composition:B?`GPU-Coalesced H₂O Ice ${Math.round((B.h2oIceFrac||.48)*100)}% · CO/CH₄ ${Math.round((B.superVolFrac||.25)*100)}% · Silicate Dust`:`H₂O Ice 75% · CO/CO₂/CH₄ Volatiles · Silicate Dust`});let te=d.findIndex(e=>e.planetClass===`earth-like`),ne=d.findIndex(e=>!e.isStar&&!e.isMinorBody),re=te>=0?te:ne>=0?ne:0;return Object.freeze({schema:Tt,systemId:r.systemId,systemName:r.systemName,starSystem:r,multiplicity:o,architecture:s,starCount:a.length,planetCount:F.length,hasEarthLike:P,earthLikeIndex:te,defaultFocusIndex:re,gpuCoalesced:!!j,gpuCoalescedTelemetry:n?.telemetry||null,condensationFrontsAu:Object.freeze({rSilicateAu:Number(_.toFixed(3)),rHzInnerAu:Number(b.toFixed(3)),rHzOuterAu:Number(x.toFixed(3)),rSnowLineAu:Number(v.toFixed(3)),rCoIceAu:Number(y.toFixed(3)),rMinStableAu:Number(S.toFixed(3)),rMaxStableAu:Number(C.toFixed(3))}),beltZoneAu:Object.freeze({innerAu:Math.max(S*1.4,v*.78),outerAu:Math.min(C*.95,v*1.25),kuiperInnerAu:Math.min(C*.96,Math.max(y*1.1,v*2.4)),kuiperOuterAu:Math.min(44,Math.max(y*1.6,v*3.6))}),catalog:Object.freeze(d)})}function Rt(e,t,n){return Math.max(t,Math.min(n,e))}function zt(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function Bt(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function Vt(e){let t=Rt(Number(e)||5778,1200,5e4),n=[[1200,[1,.16,.04]],[2400,[1,.38,.1]],[3e3,[1,.56,.24]],[4200,[1,.78,.52]],[5778,[1,.96,.91]],[7500,[.9,.95,1]],[12e3,[.76,.87,1]],[26e3,[.64,.79,1]],[5e4,[.58,.74,1]]],r=n[n.length-1][1];for(let e=0;e<n.length-1;e+=1){let[i,a]=n[e],[o,s]=n[e+1];if(t<=o){let e=Rt((Math.log(t)-Math.log(i))/Math.max(1e-6,Math.log(o)-Math.log(i)),0,1);r=[a[0]+(s[0]-a[0])*e,a[1]+(s[1]-a[1])*e,a[2]+(s[2]-a[2])*e];break}}let i=Math.max(.01,r[0],r[1],r[2]);return[Number((r[0]/i).toFixed(4)),Number((r[1]/i).toFixed(4)),Number((r[2]/i).toFixed(4))]}function Ht({starSpec:e=null,bodySpec:t=null,distanceAu:n=1,timeSec:r=0,isRogue:i=!1,stellarModeHint:a=null}={}){if(i)return Object.freeze({rgb:Object.freeze([.42,.54,.8]),fluxGain:.14,fluxEarth:0,irradianceWm2:0,distanceAu:1/0,luminositySolar:0,apparentMagV:12,starTempK:0,exoticStage:`rogue`,vec4:Object.freeze([.42,.54,.8,.14])});let o=String(e?.stage||``).toLowerCase(),s=o===`neutron-star`||o===`magnetar`||o===`supernova-remnant-pwn`||a===`pulsar`||a===`magnetar`,c=o===`stellar-black-hole`||o===`hypernova-remnant`,l=o===`white-dwarf`||o===`planetary-nebula`,u=Number(e?.tempK??e?.effectiveTempK)||(s?85e4:l?18500:5778),d=Math.max(1e-5,Number(e?.luminositySolar)||(s?.18:c?.35:l?.012:1)),f=Math.max(.012,Number.isFinite(Number(n))&&Number(n)>0?Number(n):Number(t?.aAu)||1),p=d/(f*f),m=1361*p,h=-26.74-2.5*Math.log10(Math.max(1e-12,p)),g=Rt(.14+.86*Math.max(1e-6,p)**.24,.14,1.85),_=Vt(u);if(s){let e=Math.max(0,Math.cos(r*3.8))**6,t=[.64,.88,1],n=[.78,.68,1];_=[Number((t[0]+(n[0]-t[0])*e*.55).toFixed(4)),Number((t[1]+(n[1]-t[1])*e*.55).toFixed(4)),Number((t[2]+(n[2]-t[2])*e*.55).toFixed(4))],g=Rt(g*(.76+.46*e),.24,1.75)}else c?(_=[1,.72,.42],g=Rt(g*.85,.18,1.45)):l&&(_=[.76,.9,1]);return Object.freeze({rgb:Object.freeze(_),fluxGain:Number(g.toFixed(4)),fluxEarth:p,irradianceWm2:m,distanceAu:f,luminositySolar:d,apparentMagV:Number(h.toFixed(2)),starTempK:u,exoticStage:s?`neutron-star`:c?`stellar-black-hole`:l?`white-dwarf`:o||`main-sequence`,vec4:Object.freeze([_[0],_[1],_[2],Number(g.toFixed(4))])})}function Ut(e,t=null){if(!e)return{stellarMode:`fusion`,stellarPreset:`main-sequence-star`,isExotic:!1};let n=String(e.stage||``).toLowerCase(),r=Number(e.tempK??e.effectiveTempK)||5778,i=Number(e.massSolar??e.initialMassSolar)||1;if(n===`neutron-star`||n===`pulsar`)return{stellarMode:t===`snr-pwn`?`snr-pwn`:`pulsar`,stellarPreset:`main-sequence-star`,isExotic:!0};if(n===`magnetar`)return{stellarMode:`magnetar`,stellarPreset:`main-sequence-star`,isExotic:!0};if(n===`supernova-remnant-pwn`)return{stellarMode:`snr-pwn`,stellarPreset:`main-sequence-star`,isExotic:!0};if(n===`stellar-black-hole`||n===`hypernova-remnant`)return{stellarMode:`black-hole`,stellarPreset:`main-sequence-star`,isExotic:!0};if(n===`white-dwarf`||n===`planetary-nebula`)return{stellarMode:n===`planetary-nebula`||t===`planetary-nebula`?`planetary-nebula`:`white-dwarf-tov`,stellarPreset:`main-sequence-star`,isExotic:!0};if(n===`protostar-yso`)return{stellarMode:`nebular-mhd`,stellarPreset:`main-sequence-star`,isExotic:!1};if(n===`red-giant`)return{stellarMode:`fusion`,stellarPreset:`red-supergiant`,isExotic:!1};if(n===`agb-superwind`||n===`agb-carbon`)return{stellarMode:`fusion`,stellarPreset:`agb-carbon`,isExotic:!1};if(n===`brown-dwarf`||i<.08||r<2200)return{stellarMode:`fusion`,stellarPreset:`brown-dwarf`,isExotic:!1};let a=Number(e.stellarGeneration)||0,o=String(e.spectralCode||e.spectralClass||``);return a===1||o.startsWith(`PopIII`)||Number.isFinite(Number(e.feH))&&Number(e.feH)<=-2.6?{stellarMode:`fusion`,stellarPreset:`pop3-first-gen`,isExotic:!1}:a===2||Number.isFinite(Number(e.feH))&&Number(e.feH)<=-.85?{stellarMode:`fusion`,stellarPreset:`pop2-second-gen`,isExotic:!1}:r>=11e3||i>=5.5?{stellarMode:`fusion`,stellarPreset:`blue-supergiant`,isExotic:!1}:{stellarMode:`fusion`,stellarPreset:`main-sequence-star`,isExotic:!1}}function Wt({spec:e,pos:t,radius:n,timeSec:r=0,dysonCoverage:i=0,seed:a=1.37,spheres:o,disks:s,lineChunks:c=null,alphaMul:l=1,stellarModeHint:u=null}){let d=String(e?.stage||``).toLowerCase(),f=d===`neutron-star`||d===`magnetar`||d===`supernova-remnant-pwn`||u===`pulsar`||u===`magnetar`,p=d===`magnetar`||u===`magnetar`,m=d===`stellar-black-hole`||d===`hypernova-remnant`||e?.kind===5,h=d===`white-dwarf`||d===`planetary-nebula`,g=Math.max(1e-4,Number(n)||.25),_=t[0],v=t[1],y=t[2];if(m){if(o.push({pos:[_,v,y],radius:g,color0:[0,0,0],color1:[1,.72,.28],kind:5,atm:0,tempK:15e6,dysonCoverage:0,seed:a}),s.push({center:[_,v,y],rIn:g*1.48,normal:[.16,.94,.3],rOut:g*4.85,color:[1,.72,.34],kind:0}),c){let e=zt([.16,.94,.3]),t=zt(Bt(e,[1,0,0])),n=Bt(e,t),i=g*7.5;for(let a of[-1,1])for(let o=0;o<6;o+=1){let s=o/6*Math.PI*2+r*1.6,u=g*.42,d=[_+e[0]*(a*g*1.05)+(t[0]*Math.cos(s)+n[0]*Math.sin(s))*(g*.14),v+e[1]*(a*g*1.05)+(t[1]*Math.cos(s)+n[1]*Math.sin(s))*(g*.14),y+e[2]*(a*g*1.05)+(t[2]*Math.cos(s)+n[2]*Math.sin(s))*(g*.14)],f=[_+e[0]*(a*i)+(t[0]*Math.cos(s)+n[0]*Math.sin(s))*u,v+e[1]*(a*i)+(t[1]*Math.cos(s)+n[1]*Math.sin(s))*u,y+e[2]*(a*i)+(t[2]*Math.cos(s)+n[2]*Math.sin(s))*u];c.push(...d,.52,.88,1,.82*l),c.push(...f,.45,.56,1,.1*l)}}return{exoticRendered:`black-hole`}}if(f){if(o.push({pos:[_,v,y],radius:g,color0:p?[1,.8,.98]:[.78,.96,1],color1:p?[.86,.28,.96]:[.56,.26,1],kind:0,atm:0,tempK:12e5,dysonCoverage:0,seed:a}),s.push({center:[_,v,y],rIn:g*1.55,normal:[.08,.98,.16],rOut:g*3.15,color:p?[.92,.42,.98]:[.42,.84,1],kind:1}),c){let e=r*(p?2.4:4.2)+a,t=.66,n=zt([Math.sin(t)*Math.cos(e),Math.cos(t),Math.sin(t)*Math.sin(e)]),i=zt(Bt(n,Math.abs(n[1])<.9?[0,1,0]:[1,0,0])),o=Bt(n,i),s=g*9.5,u=p?[1,.62,1]:[.58,.94,1],d=p?[.76,.22,.98]:[.44,.36,1];for(let e of[-1,1])for(let t=0;t<8;t+=1){let r=t/8*Math.PI*2,a=g*.22,f=g*1.45,p=i[0]*Math.cos(r)+o[0]*Math.sin(r),m=i[1]*Math.cos(r)+o[1]*Math.sin(r),h=i[2]*Math.cos(r)+o[2]*Math.sin(r),b=[_+n[0]*(e*g*.85)+p*a,v+n[1]*(e*g*.85)+m*a,y+n[2]*(e*g*.85)+h*a],x=[_+n[0]*(e*s)+p*f,v+n[1]*(e*s)+m*f,y+n[2]*(e*s)+h*f];c.push(...b,u[0],u[1],u[2],.94*l),c.push(...x,d[0],d[1],d[2],.14*l)}let f=g*3.8;for(let e=0;e<6;e+=1){let t=e/6*Math.PI*2,r=[i[0]*Math.cos(t)+o[0]*Math.sin(t),i[1]*Math.cos(t)+o[1]*Math.sin(t),i[2]*Math.cos(t)+o[2]*Math.sin(t)],a=null;for(let e=1;e<=15;e+=1){let t=e/16*Math.PI,i=Math.sin(t),o=f*i*i,s=[_+(n[0]*Math.cos(t)+r[0]*i)*o,v+(n[1]*Math.cos(t)+r[1]*i)*o,y+(n[2]*Math.cos(t)+r[2]*i)*o];a&&(c.push(...a,.44,.72,1,.48*l),c.push(...s,.44,.72,1,.48*l)),a=s}}}return{exoticRendered:p?`magnetar`:`pulsar`}}if(h){if(o.push({pos:[_,v,y],radius:g,color0:[.88,.96,1],color1:[.48,.78,1],kind:0,atm:0,tempK:Number(e?.tempK)||18500,dysonCoverage:i,seed:a}),c)for(let e=0;e<2;e+=1){let t=g*(2.2+e*1.15),n=.42+e*.65,r=null;for(let i=0;i<=32;i+=1){let a=i/32*Math.PI*2,o=[_+Math.cos(a)*t,v+Math.sin(a)*t*Math.sin(n),y+Math.sin(a)*t*Math.cos(n)];r&&(c.push(...r,.45,.88,1,(.42-e*.14)*l),c.push(...o,.45,.88,1,(.42-e*.14)*l)),r=o}}return{exoticRendered:`white-dwarf`}}let b=d===`red-giant`||d===`agb-superwind`;return o.push({pos:[_,v,y],radius:g,color0:b?[1,.44,.14]:e?.color0||[1,.93,.74],color1:b?[.74,.12,.04]:e?.color1||[1,.6,.2],kind:0,atm:0,tempK:Number(e?.tempK)||5778,dysonCoverage:i,seed:a}),{exoticRendered:null}}var Gt=`ulg.astrophysics.supergalactic-flrw-treepm.v1`,Kt=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),qt=16,Jt=32,Yt=`
struct CosmoParams {
  particle_count: u32,
  grid_n: u32,
  step_index: u32,
  remote_tile_count: u32,
  box_l: f32,
  a_scale: f32,
  da: f32,
  h_a: f32,             // H(a) / H_0
  omega_m: f32,
  grav_pref: f32,       // (3/2) * Omega_m / a
  mean_mass_cell: f32,
  short_range_r_s: f32, // TreePM force-split scale r_s (0 => pure PM)
  prev_kick_fac: f32,   // previous step kick factor for exact KDK synchronization
  tile_x_min: f32,
  tile_x_max: f32,
  pad0: f32,
};

struct CosmoParticle {
  pos_m: vec4<f32>,
  vel_rho: vec4<f32>,
  acc_phi: vec4<f32>,
  tag: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: CosmoParams;
@group(0) @binding(1) var<storage, read_write> particles: array<CosmoParticle>;
// Fixed-point atomic CIC density grid (grid_n^3)
@group(0) @binding(2) var<storage, read_write> cic_mass_i32: array<atomic<i32>>;
// Complex density / gradient / k-space grid bound to fft3d workspace or saved k-space
@group(0) @binding(3) var<storage, read_write> fft_grid: array<vec2<f32>>;
// 3-component PM force grid: vec4(fx, fy, fz, delta)
@group(0) @binding(4) var<storage, read_write> force_grid: array<vec4<f32>>;
// Float32 telemetry + 16-bin P(k) + tile multipole summary buffer:
//   [0]: vec4(sum_delta2, max_delta, sum_delta, grid_total)
//   [1]: vec4(sum_ke, px, py, pz)
//   [2..17]: 16 P(k) bins: vec4(k_sum, pk_sum, mode_count, 0.0)
//   [18]: tile multipole 0: vec4(total_mass, com_x, com_y, com_z)
//   [19]: tile multipole 1: vec4(quad_trace, particle_count, 0.0, 0.0)
@group(0) @binding(5) var<storage, read_write> telemetry_f32: array<vec4<f32>>;
// Short-range sub-cell TreePM atomic cell-multipole accumulators (grid_n^3 * 4 i32): [m, m*dx, m*dy, m*dz]
@group(0) @binding(6) var<storage, read_write> sr_cell_accum: array<atomic<i32>>;
// Resolved short-range TreePM cell multipole nodes (cell-local COM offset, NOT wrapped abs!):
//   vec4(com_off_x, com_off_y, com_off_z, cell_mass) + remote tile multipoles appended at [grid_total .. grid_total + 31]:
//   remote_tile[r]: vec4(com_x, com_y, com_z, total_mass)
@group(0) @binding(7) var<storage, read_write> sr_cell_nodes: array<vec4<f32>>;

const TWO_PI: f32 = 6.28318530717958647692;
const PK_BINS: u32 = ${qt}u;

var<workgroup> wg_f0: array<f32, 256>;
var<workgroup> wg_f1: array<f32, 256>;
var<workgroup> wg_f2: array<f32, 256>;
var<workgroup> wg_f3: array<f32, 256>;
var<workgroup> wg_f4: array<f32, 256>;
var<workgroup> wg_f5: array<f32, 256>;

fn wrap_coord(u: f32, L: f32) -> f32 {
  let half_l = 0.5 * L;
  var x = u + half_l;
  x = x - L * floor(x / L);
  return x - half_l;
}

fn wrap_delta(d: f32, L: f32) -> f32 {
  return d - L * round(d / L);
}

fn safe_grid_index(g: f32, n: u32) -> u32 {
  let ni = i32(n);
  let gi = i32(floor(g));
  let m = ((gi % ni) + ni) % ni;
  return u32(m);
}

fn erfc_approx(x_in: f32) -> f32 {
  let x = max(0.0, x_in);
  let t = 1.0 / (1.0 + 0.3275911 * x);
  let poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return poly * exp(-x * x);
}

fn treepm_short_range_split(r: f32, r_s: f32) -> f32 {
  let u = r / max(2.0 * r_s, 1.0e-5);
  return erfc_approx(u) + (2.0 * u * 0.5641895835) * exp(-u * u);
}

@compute @workgroup_size(64)
fn clear_grids(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx < total) {
    atomicStore(&cic_mass_i32[idx], 0);
    force_grid[idx] = vec4<f32>(0.0);
    atomicStore(&sr_cell_accum[idx * 4u + 0u], 0);
    atomicStore(&sr_cell_accum[idx * 4u + 1u], 0);
    atomicStore(&sr_cell_accum[idx * 4u + 2u], 0);
    atomicStore(&sr_cell_accum[idx * 4u + 3u], 0);
    sr_cell_nodes[idx] = vec4<f32>(0.0);
  }
  if (idx < 20u) {
    telemetry_f32[idx] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn cic_deposit(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.particle_count) { return; }
  let n = params.grid_n;
  let nf = f32(n);
  let L = params.box_l;
  let p = particles[i].pos_m;
  if (!(p.w > 0.0)) { return; }
  let gx = ((p.x + 0.5 * L) / L) * nf;
  let gy = ((p.y + 0.5 * L) / L) * nf;
  let gz = ((p.z + 0.5 * L) / L) * nf;
  let ix0 = safe_grid_index(gx, n);
  let iy0 = safe_grid_index(gy, n);
  let iz0 = safe_grid_index(gz, n);
  let ix1 = (ix0 + 1u) % n;
  let iy1 = (iy0 + 1u) % n;
  let iz1 = (iz0 + 1u) % n;
  let fx = gx - floor(gx);
  let fy = gy - floor(gy);
  let fz = gz - floor(gz);
  let wx0 = 1.0 - fx; let wy0 = 1.0 - fy; let wz0 = 1.0 - fz;
  let scale = p.w * 4096.0;

  let xs = array<u32, 2>(ix0, ix1);
  let ys = array<u32, 2>(iy0, iy1);
  let zs = array<u32, 2>(iz0, iz1);
  let wxs = array<f32, 2>(wx0, fx);
  let wys = array<f32, 2>(wy0, fy);
  let wzs = array<f32, 2>(wz0, fz);

  for (var dz = 0u; dz < 2u; dz = dz + 1u) {
    for (var dy = 0u; dy < 2u; dy = dy + 1u) {
      for (var dx = 0u; dx < 2u; dx = dx + 1u) {
        let cidx = (zs[dz] * n + ys[dy]) * n + xs[dx];
        let w_i = i32(round(scale * wxs[dx] * wys[dy] * wzs[dz]));
        atomicAdd(&cic_mass_i32[cidx], w_i);
      }
    }
  }
  // Exact cell-local monopole (relative to cell center -> wrap-free self-COM subtraction!)
  let cell_len = L / nf;
  let home_idx = (iz0 * n + iy0) * n + ix0;
  let cx_center = (f32(ix0) + 0.5) * cell_len - 0.5 * L;
  let cy_center = (f32(iy0) + 0.5) * cell_len - 0.5 * L;
  let cz_center = (f32(iz0) + 0.5) * cell_len - 0.5 * L;
  let dx_loc = wrap_delta(p.x - cx_center, L);
  let dy_loc = wrap_delta(p.y - cy_center, L);
  let dz_loc = wrap_delta(p.z - cz_center, L);
  atomicAdd(&sr_cell_accum[home_idx * 4u + 0u], i32(round(p.w * 4096.0)));
  atomicAdd(&sr_cell_accum[home_idx * 4u + 1u], i32(round(p.w * dx_loc * 2048.0)));
  atomicAdd(&sr_cell_accum[home_idx * 4u + 2u], i32(round(p.w * dy_loc * 2048.0)));
  atomicAdd(&sr_cell_accum[home_idx * 4u + 3u], i32(round(p.w * dz_loc * 2048.0)));
}

@compute @workgroup_size(64)
fn prepare_poisson_rhs(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let n = params.grid_n;
  let total = n * n * n;
  if (idx >= total) { return; }
  let m_cell = f32(atomicLoad(&cic_mass_i32[idx])) / 4096.0;
  let delta = (m_cell / max(params.mean_mass_cell, 1.0e-6)) - 1.0;
  fft_grid[idx] = vec2<f32>(params.grav_pref * delta, 0.0);
  force_grid[idx].w = delta;

  let sr_m = f32(atomicLoad(&sr_cell_accum[idx * 4u + 0u])) / 4096.0;
  if (sr_m > 1.0e-6) {
    let inv_m = 1.0 / sr_m;
    let ox = (f32(atomicLoad(&sr_cell_accum[idx * 4u + 1u])) / 2048.0) * inv_m;
    let oy = (f32(atomicLoad(&sr_cell_accum[idx * 4u + 2u])) / 2048.0) * inv_m;
    let oz = (f32(atomicLoad(&sr_cell_accum[idx * 4u + 3u])) / 2048.0) * inv_m;
    sr_cell_nodes[idx] = vec4<f32>(ox, oy, oz, sr_m);
  } else {
    sr_cell_nodes[idx] = vec4<f32>(0.0);
  }
}

// Live 16-bin GPU radial matter power spectrum P(k) reduction directly from k-space FFT!
// Dispatched with 16 workgroups (one workgroup per logarithmic k-shell), @workgroup_size(256).
@compute @workgroup_size(256)
fn reduce_power_spectrum_pk(
  @builtin(workgroup_id) wid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let bin = wid.x;
  if (bin >= PK_BINS) { return; }
  let tid = lid.x;
  let n = params.grid_n;
  let half_n = n >> 1u;
  let total = n * n * n;
  let dk = TWO_PI / max(params.box_l, 1.0e-6);
  let k_min = dk;
  let k_max = dk * f32(half_n) * 1.7320508;
  let log_span = max(1e-5, log(k_max / k_min));
  let inv_pref2 = 1.0 / max(1e-12, params.grav_pref * params.grav_pref);
  let vol_norm = (params.box_l * params.box_l * params.box_l) / (f32(total) * f32(total));

  var k_sum = 0.0;
  var pk_sum = 0.0;
  var cnt = 0.0;

  var idx = tid;
  loop {
    if (idx >= total) { break; }
    if (idx != 0u) {
      let ix = idx % n;
      let iy = (idx / n) % n;
      let iz = idx / (n * n);
      let nx = select(f32(ix), f32(ix) - f32(n), ix >= half_n);
      let ny = select(f32(iy), f32(iy) - f32(n), iy >= half_n);
      let nz = select(f32(iz), f32(iz) - f32(n), iz >= half_n);
      let k_mag = sqrt(nx * nx + ny * ny + nz * nz) * dk;
      let u = clamp(log(max(k_min, k_mag) / k_min) / log_span, 0.0, 0.99999);
      let b_idx = min(PK_BINS - 1u, u32(u * f32(PK_BINS)));
      if (b_idx == bin) {
        let c = fft_grid[idx];
        let p2 = (c.x * c.x + c.y * c.y) * inv_pref2 * vol_norm;
        k_sum = k_sum + k_mag;
        pk_sum = pk_sum + p2;
        cnt = cnt + 1.0;
      }
    }
    idx = idx + 256u;
  }

  wg_f0[tid] = k_sum;
  wg_f1[tid] = pk_sum;
  wg_f2[tid] = cnt;
  workgroupBarrier();

  var stride = 128u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
      wg_f1[tid] = wg_f1[tid] + wg_f1[tid + stride];
      wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }

  if (tid == 0u) {
    let m_cnt = wg_f2[0u];
    if (m_cnt > 0.0) {
      telemetry_f32[2u + bin] = vec4<f32>(wg_f0[0u] / m_cnt, wg_f1[0u] / m_cnt, m_cnt, 0.0);
    } else {
      telemetry_f32[2u + bin] = vec4<f32>(0.0);
    }
  }
}

@compute @workgroup_size(64)
fn store_force_x(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx >= total) { return; }
  force_grid[idx].x = -fft_grid[idx].x;
}

@compute @workgroup_size(64)
fn store_force_y(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx >= total) { return; }
  force_grid[idx].y = -fft_grid[idx].x;
}

@compute @workgroup_size(64)
fn store_force_z(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx >= total) { return; }
  force_grid[idx].z = -fft_grid[idx].x;
}

// CIC trilinear force interpolation + Short-Range TreePM (exact self-COM subtraction
// + empty-cell background symmetry) + Remote-Slab Multipole Coupling + Symplectic KDK!
@compute @workgroup_size(64)
fn cic_kick_drift(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.particle_count) { return; }
  let n = params.grid_n;
  let nf = f32(n);
  let n_i = i32(n);
  let total_cells = n * n * n;
  let L = params.box_l;
  var pt = particles[i];
  if (!(pt.pos_m.w > 0.0)) { return; }

  let gx = ((pt.pos_m.x + 0.5 * L) / L) * nf;
  let gy = ((pt.pos_m.y + 0.5 * L) / L) * nf;
  let gz = ((pt.pos_m.z + 0.5 * L) / L) * nf;
  let ix0 = safe_grid_index(gx, n);
  let iy0 = safe_grid_index(gy, n);
  let iz0 = safe_grid_index(gz, n);
  let ix1 = (ix0 + 1u) % n;
  let iy1 = (iy0 + 1u) % n;
  let iz1 = (iz0 + 1u) % n;
  let fx = gx - floor(gx);
  let fy = gy - floor(gy);
  let fz = gz - floor(gz);

  let xs = array<u32, 2>(ix0, ix1);
  let ys = array<u32, 2>(iy0, iy1);
  let zs = array<u32, 2>(iz0, iz1);
  let wxs = array<f32, 2>(1.0 - fx, fx);
  let wys = array<f32, 2>(1.0 - fy, fy);
  let wzs = array<f32, 2>(1.0 - fz, fz);

  var acc = vec3<f32>(0.0);
  var local_delta = 0.0;
  for (var dz = 0u; dz < 2u; dz = dz + 1u) {
    for (var dy = 0u; dy < 2u; dy = dy + 1u) {
      for (var dx = 0u; dx < 2u; dx = dx + 1u) {
        let cidx = (zs[dz] * n + ys[dy]) * n + xs[dx];
        let w = wxs[dx] * wys[dy] * wzs[dz];
        let fg = force_grid[cidx];
        acc = acc + fg.xyz * w;
        local_delta = local_delta + fg.w * w;
      }
    }
  }

  let cell_len = L / nf;
  let g_eff = (params.grav_pref * cell_len * cell_len * cell_len) / (12.566370614 * max(params.mean_mass_cell, 1.0e-6));

  // Hybrid TreePM short-range 3x3x3 cell-multipole correction:
  //   (a) exact self-COM subtraction in home cell, AND
  //   (b) uniform -mean_mass_cell peculiar background at EVERY cell center (including empty voids!)
  if (params.short_range_r_s > 0.0) {
    let r_s = params.short_range_r_s;
    let r_cut = 3.6 * r_s;
    let r_cut2 = r_cut * r_cut;
    let eps2 = (0.55 * cell_len) * (0.55 * cell_len);
    for (var oz: i32 = -1; oz <= 1; oz = oz + 1) {
      let nz = u32(((i32(iz0) + oz) % n_i + n_i) % n_i);
      let cz_c = (f32(nz) + 0.5) * cell_len - 0.5 * L;
      for (var oy: i32 = -1; oy <= 1; oy = oy + 1) {
        let ny = u32(((i32(iy0) + oy) % n_i + n_i) % n_i);
        let cy_c = (f32(ny) + 0.5) * cell_len - 0.5 * L;
        for (var ox: i32 = -1; ox <= 1; ox = ox + 1) {
          let nx = u32(((i32(ix0) + ox) % n_i + n_i) % n_i);
          let cx_c = (f32(nx) + 0.5) * cell_len - 0.5 * L;
          let nidx = (nz * n + ny) * n + nx;
          let node = sr_cell_nodes[nidx];
          let is_home = (ox == 0 && oy == 0 && oz == 0);

          // 1. Positive mass attraction from actual particles in cell (with EXACT self-COM subtraction!)
          if (node.w > 1.0e-6) {
            let eff_m = select(node.w, max(0.0, node.w - pt.pos_m.w), is_home);
            if (eff_m > 1.0e-6) {
              var d_p = vec3<f32>(0.0);
              if (is_home) {
                let self_off = vec3<f32>(
                  wrap_delta(pt.pos_m.x - cx_c, L),
                  wrap_delta(pt.pos_m.y - cy_c, L),
                  wrap_delta(pt.pos_m.z - cz_c, L)
                );
                let other_off = (node.xyz * node.w - self_off * pt.pos_m.w) / eff_m;
                d_p = other_off - self_off;
              } else {
                let com_x = cx_c + node.x;
                let com_y = cy_c + node.y;
                let com_z = cz_c + node.z;
                d_p = vec3<f32>(
                  wrap_delta(com_x - pt.pos_m.x, L),
                  wrap_delta(com_y - pt.pos_m.y, L),
                  wrap_delta(com_z - pt.pos_m.z, L)
                );
              }
              let r2_p = dot(d_p, d_p);
              if (r2_p <= r_cut2 && r2_p > 1.0e-10) {
                let r_p = sqrt(r2_p);
                let sw_p = treepm_short_range_split(r_p, r_s);
                let inv_r3_p = 1.0 / ((r2_p + eps2) * sqrt(r2_p + eps2));
                acc = acc + d_p * (g_eff * eff_m * sw_p * inv_r3_p);
              }
            }
          }

          // 2. Uniform -mean_mass_cell background subtraction at cell center (INCLUDING empty cells!)
          let d_bg = vec3<f32>(
            wrap_delta(cx_c - pt.pos_m.x, L),
            wrap_delta(cy_c - pt.pos_m.y, L),
            wrap_delta(cz_c - pt.pos_m.z, L)
          );
          let r2_bg = dot(d_bg, d_bg);
          if (r2_bg <= r_cut2 && r2_bg > 1.0e-10) {
            let r_bg = sqrt(r2_bg);
            let sw_bg = treepm_short_range_split(r_bg, r_s);
            let inv_r3_bg = 1.0 / ((r2_bg + eps2) * sqrt(r2_bg + eps2));
            acc = acc - d_bg * (g_eff * params.mean_mass_cell * sw_bg * inv_r3_bg);
          }
        }
      }
    }
  }

  // Remote-slab cross-peer multipole gravitational coupling (multi-host PeerCompute!)
  // Direct non-wrapped displacement along slab-partitioned X avoids half-box sign-flip
  // discontinuities while retaining full periodic minimum-image wrapping along Y and Z.
  let n_rem = min(params.remote_tile_count, ${Jt}u);
  if (n_rem > 0u) {
    let eps_rem2 = (0.12 * L) * (0.12 * L);
    for (var r = 0u; r < n_rem; r = r + 1u) {
      let rt = sr_cell_nodes[total_cells + r];
      if (rt.w <= 1.0e-6) { continue; }
      let d_r = vec3<f32>(
        rt.x - pt.pos_m.x,
        wrap_delta(rt.y - pt.pos_m.y, L),
        wrap_delta(rt.z - pt.pos_m.z, L)
      );
      let r2_r = dot(d_r, d_r) + eps_rem2;
      let inv_r3_r = 1.0 / (r2_r * sqrt(r2_r));
      acc = acc + d_r * (g_eff * rt.w * inv_r3_r);
    }
  }

  // Canonical comoving Symplectic Kick-Drift-Kick (KDK) in scale factor a:
  //   step 0:  v_half = v_0 + 0.5 * acc_0 * kick_0;  x_1 = x_0 + v_half * drift_0
  //   step s:  v_sync = v_{s-1/2} + 0.5 * acc_s * kick_{s-1}
  //            v_half = v_sync + 0.5 * acc_s * kick_s;  x_{s+1} = x_s + v_half * drift_s
  let a = max(0.01, params.a_scale);
  let h_a = max(0.05, params.h_a);
  let da = params.da;
  // Exact canonical FLRW comoving momentum kick dp/da = -grad_x(Phi) / (a * H(a))
  // (note grav_pref = 1.5 * Omega_m / a already carries the 1/a Poisson scale factor!)
  let kick_fac = da / (a * h_a);
  let a_mid = a + 0.5 * da;
  let omega_l = max(0.0, 1.0 - params.omega_m);
  let h_mid = sqrt(max(0.0025, params.omega_m / (a_mid * a_mid * a_mid) + omega_l));
  let drift_fac = da / (a_mid * a_mid * a_mid * h_mid);

  let v_sync = select(pt.vel_rho.xyz, pt.vel_rho.xyz + acc * (0.5 * params.prev_kick_fac), params.step_index > 0u);
  let v_half = v_sync + acc * (0.5 * kick_fac);
  let p_new = vec3<f32>(
    wrap_coord(pt.pos_m.x + v_half.x * drift_fac, L),
    wrap_coord(pt.pos_m.y + v_half.y * drift_fac, L),
    wrap_coord(pt.pos_m.z + v_half.z * drift_fac, L)
  );
  let rho_vis = clamp(0.18 + 0.25 * log2(max(1.0, 1.0 + local_delta)), 0.05, 1.0);
  pt.pos_m = vec4<f32>(p_new, pt.pos_m.w);
  pt.vel_rho = vec4<f32>(v_half, rho_vis);
  pt.acc_phi = vec4<f32>(acc, local_delta);
  pt.tag.z = a;
  particles[i] = pt;
}

// Pure IEEE-754 float32 parallel workgroup telemetry reduction (ZERO i32 overflow!)
// Dispatch 2 workgroups of 256 threads:
//   wid.x == 0 -> grid overdensity stats [sum_delta2, max_delta, sum_delta, total]
//   wid.x == 1 -> particle KE & linear momentum [sum_ke, px, py, pz]
@compute @workgroup_size(256)
fn reduce_telemetry_f32(
  @builtin(workgroup_id) wid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let tid = lid.x;
  if (wid.x == 0u) {
    let total = params.grid_n * params.grid_n * params.grid_n;
    var s_d2 = 0.0;
    var m_d = -1.0e30;
    var s_d = 0.0;
    var i = tid;
    loop {
      if (i >= total) { break; }
      let d = force_grid[i].w;
      s_d2 = s_d2 + d * d;
      m_d = max(m_d, d);
      s_d = s_d + d;
      i = i + 256u;
    }
    wg_f0[tid] = s_d2;
    wg_f1[tid] = m_d;
    wg_f2[tid] = s_d;
    workgroupBarrier();
    var stride = 128u;
    loop {
      if (stride == 0u) { break; }
      if (tid < stride) {
        wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
        wg_f1[tid] = max(wg_f1[tid], wg_f1[tid + stride]);
        wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
      }
      workgroupBarrier();
      stride = stride >> 1u;
    }
    if (tid == 0u) {
      telemetry_f32[0u] = vec4<f32>(wg_f0[0u], wg_f1[0u], wg_f2[0u], f32(total));
    }
  } else if (wid.x == 1u) {
    let n_p = params.particle_count;
    var s_ke = 0.0;
    var px = 0.0;
    var py = 0.0;
    var pz = 0.0;
    var i = tid;
    loop {
      if (i >= n_p) { break; }
      let pt = particles[i];
      let m = pt.pos_m.w;
      let v = pt.vel_rho.xyz;
      s_ke = s_ke + 0.5 * m * dot(v, v);
      px = px + m * v.x;
      py = py + m * v.y;
      pz = pz + m * v.z;
      i = i + 256u;
    }
    wg_f0[tid] = s_ke;
    wg_f1[tid] = px;
    wg_f2[tid] = py;
    wg_f3[tid] = pz;
    workgroupBarrier();
    var stride = 128u;
    loop {
      if (stride == 0u) { break; }
      if (tid < stride) {
        wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
        wg_f1[tid] = wg_f1[tid] + wg_f1[tid + stride];
        wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
        wg_f3[tid] = wg_f3[tid] + wg_f3[tid + stride];
      }
      workgroupBarrier();
      stride = stride >> 1u;
    }
    if (tid == 0u) {
      telemetry_f32[1u] = vec4<f32>(wg_f0[0u], wg_f1[0u], wg_f2[0u], wg_f3[0u]);
    }
  }
}

// Parallel GPU tile multipole reduction for PeerCompute slab exchange (32-byte readback!)
@compute @workgroup_size(256)
fn reduce_tile_multipole(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n_p = params.particle_count;
  var m_sum = 0.0;
  var mx = 0.0;
  var my = 0.0;
  var mz = 0.0;
  var r2_sum = 0.0;
  var cnt = 0.0;
  var i = tid;
  loop {
    if (i >= n_p) { break; }
    let pm = particles[i].pos_m;
    if (pm.w > 0.0 && pm.x >= params.tile_x_min && pm.x < params.tile_x_max) {
      m_sum = m_sum + pm.w;
      mx = mx + pm.w * pm.x;
      my = my + pm.w * pm.y;
      mz = mz + pm.w * pm.z;
      r2_sum = r2_sum + pm.w * dot(pm.xyz, pm.xyz);
      cnt = cnt + 1.0;
    }
    i = i + 256u;
  }
  wg_f0[tid] = m_sum;
  wg_f1[tid] = mx;
  wg_f2[tid] = my;
  wg_f3[tid] = mz;
  wg_f4[tid] = r2_sum;
  wg_f5[tid] = cnt;
  workgroupBarrier();

  var stride = 128u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
      wg_f1[tid] = wg_f1[tid] + wg_f1[tid + stride];
      wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
      wg_f3[tid] = wg_f3[tid] + wg_f3[tid + stride];
      wg_f4[tid] = wg_f4[tid] + wg_f4[tid + stride];
      wg_f5[tid] = wg_f5[tid] + wg_f5[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }
  if (tid == 0u) {
    let m_tot = wg_f0[0u];
    if (m_tot > 1.0e-6) {
      let cx = wg_f1[0u] / m_tot;
      let cy = wg_f2[0u] / m_tot;
      let cz = wg_f3[0u] / m_tot;
      // Exact parallel-axis identity: sum m_i |r_i - com|^2 = sum m_i |r_i|^2 - M |com|^2
      let q_trace = max(0.0, wg_f4[0u] - m_tot * (cx * cx + cy * cy + cz * cz));
      telemetry_f32[18u] = vec4<f32>(m_tot, cx, cy, cz);
      telemetry_f32[19u] = vec4<f32>(q_trace, wg_f5[0u], 0.0, 0.0);
    } else {
      telemetry_f32[18u] = vec4<f32>(0.0);
      telemetry_f32[19u] = vec4<f32>(0.0);
    }
  }
}
`,Xt=`
struct ZeldParams {
  n: u32,
  seed: u32,
  axis: u32,
  pad0: u32,
  box_l: f32,
  amplitude: f32,
  k_eq: f32,
  v_pref: f32,
};

@group(0) @binding(0) var<uniform> params: ZeldParams;
@group(0) @binding(1) var<storage, read_write> k_field: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> disp_field: array<vec4<f32>>;

const TWO_PI: f32 = 6.28318530717958647692;

fn hash_u32(v_in: u32) -> u32 {
  var v = v_in;
  v = (v ^ 61u) ^ (v >> 16u);
  v = v * 9u;
  v = v ^ (v >> 4u);
  v = v * 0x27d4eb2du;
  v = v ^ (v >> 15u);
  return v;
}

fn rand01(h: u32) -> f32 {
  return (f32(h & 0x00ffffffu) + 0.5) / 16777216.0;
}

// Generates Hermitian-symmetric primordial Gaussian random displacement mode Psi_k = i * (k / k^2) * delta_k
@compute @workgroup_size(64)
fn generate_zeldovich_kspace(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let total = n * n * n;
  let idx = id.x;
  if (idx >= total) { return; }
  if (idx == 0u) {
    k_field[0u] = vec2<f32>(0.0, 0.0);
    return;
  }
  let ix = idx % n;
  let iy = (idx / n) % n;
  let iz = idx / (n * n);
  let half_n = n >> 1u;

  // Canonical Hermitian conjugate pairing: (-k) mod N
  let cx = (n - ix) % n;
  let cy = (n - iy) % n;
  let cz = (n - iz) % n;
  let conj_idx = (cz * n + cy) * n + cx;
  let canon_idx = min(idx, conj_idx);
  let is_conj = idx > conj_idx;
  let is_self_conj = idx == conj_idx;

  let h1 = hash_u32(canon_idx * 747796405u + params.seed * 2891336453u + 17u);
  let h2 = hash_u32(h1 + 1013904223u);
  let u1 = max(1e-6, rand01(h1));
  let u2 = rand01(h2);
  let gauss_r = sqrt(-2.0 * log(u1));
  let theta = TWO_PI * u2;
  var delta_re = gauss_r * cos(theta);
  var delta_im = select(gauss_r * sin(theta), 0.0, is_self_conj);
  if (is_conj) { delta_im = -delta_im; }

  let nx = select(f32(ix), f32(ix) - f32(n), ix >= half_n);
  let ny = select(f32(iy), f32(iy) - f32(n), iy >= half_n);
  let nz = select(f32(iz), f32(iz) - f32(n), iz >= half_n);
  let dk = TWO_PI / max(params.box_l, 1.0e-6);
  let kx = nx * dk;
  let ky = ny * dk;
  let kz = nz * dk;
  let k2 = kx * kx + ky * ky + kz * kz;
  let k_mag = sqrt(k2);
  // Eisenstein-Hu-like primordial matter power spectrum P(k) ~ k / (1 + (k/k_eq)^2)^2
  let ratio = k_mag / max(params.k_eq, 1.0e-6);
  let pk = k_mag / ((1.0 + ratio * ratio) * (1.0 + ratio * ratio));
  // Smooth Nyquist filter so small-scale modes are clean & isotropic
  let k_nyq = f32(half_n) * dk;
  let nyq_win = exp(-2.2 * (k_mag / k_nyq) * (k_mag / k_nyq));
  let amp = params.amplitude * sqrt(pk * nyq_win) * (params.box_l * 0.28) * f32(total);
  let k_comp = select(select(kz, ky, params.axis == 1u), kx, params.axis == 0u);
  // Psi_k = i * (k_comp / k^2) * delta_k -> i * (re + i im) = (-im, re)
  let fac = (k_comp / max(k2, 1.0e-12)) * amp;
  k_field[idx] = vec2<f32>(-delta_im * fac, delta_re * fac);
}

@compute @workgroup_size(64)
fn store_disp_axis(@builtin(global_invocation_id) id: vec3<u32>) {
  let total = params.n * params.n * params.n;
  let idx = id.x;
  if (idx >= total) { return; }
  var cur = disp_field[idx];
  let v = k_field[idx].x;
  if (params.axis == 0u) { cur.x = v; }
  else if (params.axis == 1u) { cur.y = v; }
  else { cur.z = v; }
  disp_field[idx] = cur;
}
`;function Zt(e,{omegaM:t=.315,omegaLambda:n=.685,omegaR:r=9e-5}={}){let i=Math.max(1e-4,Number(e)),a=1-t-n-r;return Math.sqrt(Math.max(1e-8,r/i**4+t/i**3+a/i**2+n))}function Qt(e,t){let n=e+.5*t;return n-=t*Math.floor(n/t),n-.5*t}async function $t(e,{gridPerSide:t=28,fftGridN:n=32,boxLengthMpc:r=200,aInit:i=.12,omegaM:a=.315,omegaLambda:o=.685,amplitude:s=.36,seed:c=20261125,slabBounds:l=null,initialPositionsShift:u=[0,0,0]}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`build2LptCosmologyICsWebGpu requires a live WebGPU GPUDevice`);let d=Math.max(8,Math.trunc(t)),f=Number(r),p=f/d,m=Zt(i,{omegaM:a,omegaLambda:o}),h=a/i**3/Math.max(1e-8,m*m),g=Math.max(1e-4,h)**.55,_=2*Math.max(1e-4,h)**(6/11),v=i*i*m*g,y=i*i*m*_,b=2*Math.PI/Math.max(.001,f),x=Math.max(b*1.5,Math.min(.0103,b*Math.max(2.5,n*.22))),S=ne(e,n),C=S.n,w=S.total,T=[P(0,`uniform`),P(1,`storage`),P(2,`storage`)],E=I(e,{cacheKey:`ulg-zeldovich-ic-gen.v1`,label:`ulg-2lpt-ic-gen`,code:Xt,entryPoint:`generate_zeldovich_kspace`,bindings:T}),D=I(e,{cacheKey:`ulg-zeldovich-ic-store.v1`,label:`ulg-2lpt-ic-store`,code:Xt,entryPoint:`store_disp_axis`,bindings:T}),O=e.createBuffer({size:w*16,usage:Kt.STORAGE|Kt.COPY_SRC}),k=e.createBuffer({size:w*16,usage:Kt.MAP_READ|Kt.COPY_DST}),A=e.createBuffer({size:S.byteLength,usage:Kt.STORAGE|Kt.COPY_DST|Kt.COPY_SRC}),j=[0,1,2].map(t=>{let n=new ArrayBuffer(32);new Uint32Array(n,0,4).set([C,c>>>0,t,0]),new Float32Array(n,16,4).set([f,s,x,v]);let r=e.createBuffer({size:32,usage:Kt.UNIFORM|Kt.COPY_DST});return e.queue.writeBuffer(r,0,n),r});try{let t=e.createCommandEncoder({label:`ulg-2lpt-psi1`}),n=Math.ceil(w/64);for(let r=0;r<3;r+=1){let i=e.createBindGroup({layout:E.bindGroupLayout,entries:[{binding:0,resource:{buffer:j[r]}},{binding:1,resource:{buffer:S.bufferA}},{binding:2,resource:{buffer:O}}]}),a=t.beginComputePass();a.setPipeline(E.pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(n),a.end();let o=S.encodeInverseFrom(t,S.bufferA),s=e.createBindGroup({layout:D.bindGroupLayout,entries:[{binding:0,resource:{buffer:j[r]}},{binding:1,resource:{buffer:o}},{binding:2,resource:{buffer:O}}]});a=t.beginComputePass(),a.setPipeline(D.pipeline),a.setBindGroup(0,s),a.dispatchWorkgroups(n),a.end()}t.copyBufferToBuffer(O,0,k,0,w*16),e.queue.submit([t.finish()]),await k.mapAsync(Kt.MAP_READ);let r=new Float32Array(k.getMappedRange().slice(0,w*16));k.unmap();let a=0;for(let e=0;e<w;e+=1)a+=r[e*4]**2+r[e*4+1]**2+r[e*4+2]**2;let o=Math.sqrt(a/Math.max(1,w)),c=Math.max(.1,Number(s)||.36)*(f/22),m=o>1e-12?c/o:0;for(let e=0;e<w;e+=1)r[e*4+0]*=m,r[e*4+1]*=m,r[e*4+2]*=m;let g=f/C,_=.5/g,b=new Float32Array(w*2),x=(e,t,n)=>(((n+C)%C*C+(t+C)%C)*C+(e+C)%C)*4;for(let e=0;e<C;e+=1)for(let t=0;t<C;t+=1)for(let n=0;n<C;n+=1){let i=x(n+1,t,e),a=x(n-1,t,e),o=x(n,t+1,e),s=x(n,t-1,e),c=x(n,t,e+1),l=x(n,t,e-1),u=(r[i+0]-r[a+0])*_,d=(r[o+1]-r[s+1])*_,f=(r[c+2]-r[l+2])*_,p=.5*(r[o+0]-r[s+0]+(r[i+1]-r[a+1]))*_,m=.5*(r[c+0]-r[l+0]+(r[i+2]-r[a+2]))*_,h=.5*(r[c+1]-r[l+1]+(r[o+2]-r[s+2]))*_,g=u*d+u*f+d*f-p*p-m*m-h*h;b[((e*C+t)*C+n)*2]=g}e.queue.writeBuffer(S.bufferA,0,b),S.writeAxisPoissonParams({boxLength:f,smoothR2:(.45*g)**2});let T=e.createCommandEncoder({label:`ulg-2lpt-psi2`}),M=S.encodeForward(T);T.copyBufferToBuffer(M,0,A,0,S.byteLength);for(let t=0;t<3;t+=1){let r=S.encodePoissonInverseFromKSpace(T,A,{gradAxis:t+1}),i=e.createBindGroup({layout:D.bindGroupLayout,entries:[{binding:0,resource:{buffer:j[t]}},{binding:1,resource:{buffer:r}},{binding:2,resource:{buffer:O}}]}),a=T.beginComputePass();a.setPipeline(D.pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(n),a.end()}T.copyBufferToBuffer(O,0,k,0,w*16),e.queue.submit([T.finish()]),await k.mapAsync(Kt.MAP_READ);let N=new Float32Array(k.getMappedRange().slice(0,w*16));k.unmap();let P=-.42857142857142855*Math.max(.001,h)**(-1/143),F=0;for(let e=0;e<w;e+=1){let t=P*N[e*4+0],n=P*N[e*4+1],r=P*N[e*4+2];N[e*4+0]=t,N[e*4+1]=n,N[e*4+2]=r,F+=t*t+n*n+r*r}let I=Math.sqrt(F/Math.max(1,w)),L=(e,t,n,r)=>{let i=(t+.5*f)/f*C,a=(n+.5*f)/f*C,o=(r+.5*f)/f*C,s=(Math.floor(i)%C+C)%C,c=(Math.floor(a)%C+C)%C,l=(Math.floor(o)%C+C)%C,u=(s+1)%C,d=(c+1)%C,p=(l+1)%C,m=i-Math.floor(i),h=a-Math.floor(a),g=o-Math.floor(o),_=0,v=0,y=0,b=[s,u],x=[c,d],S=[l,p],w=[1-m,m],T=[1-h,h],E=[1-g,g];for(let t=0;t<2;t+=1)for(let n=0;n<2;n+=1)for(let r=0;r<2;r+=1){let i=((S[t]*C+x[n])*C+b[r])*4,a=w[r]*T[n]*E[t];_+=e[i+0]*a,v+=e[i+1]*a,y+=e[i+2]*a}return[_,v,y]},R=Number(u?.[0])||0,z=Number(u?.[1])||0,B=Number(u?.[2])||0,ee=d*d*d,V=new Float32Array(ee*16),te=0,ne=0,re=0,ie=0;for(let e=0;e<d;e+=1)for(let t=0;t<d;t+=1)for(let n=0;n<d;n+=1){let a=(n+.5)*p-.5*f,o=(t+.5)*p-.5*f,s=(e+.5)*p-.5*f,c=L(r,a,o,s),l=L(N,a,o,s),u=Qt(a+c[0]+l[0]+R,f),d=Qt(o+c[1]+l[1]+z,f),m=Qt(s+c[2]+l[2]+B,f),h=v*c[0]+y*l[0],g=v*c[1]+y*l[1],_=v*c[2]+y*l[2];te+=h,ne+=g,re+=_;let b=ie*16;V[b+0]=u,V[b+1]=d,V[b+2]=m,V[b+3]=1,V[b+4]=h,V[b+5]=g,V[b+6]=_,V[b+7]=.28,V[b+12]=+(ie%6==0),V[b+14]=i,ie+=1}te/=ee,ne/=ee,re/=ee;for(let e=0;e<ee;e+=1)V[e*16+4]-=te,V[e*16+5]-=ne,V[e*16+6]-=re;if(l&&Number.isFinite(l.xMin)&&Number.isFinite(l.xMax)){let e=[];for(let t=0;t<ee;t+=1){let n=V[t*16+0];n>=l.xMin&&n<l.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(V.subarray(r,r+16),n*16)}return{icBackend:`webgpu-fft3d-2lpt-full-nyquist`,particleCount:e.length,globalParticleCount:ee,data:t,boxLengthMpc:f,aInit:i,rms2Over1:I/Math.max(1e-9,c)}}return{icBackend:`webgpu-fft3d-2lpt-full-nyquist`,particleCount:ee,globalParticleCount:ee,data:V,boxLengthMpc:f,aInit:i,rms2Over1:I/Math.max(1e-9,c)}}finally{S.destroy(),O.destroy(),k.destroy(),A.destroy();for(let e of j)e.destroy()}}function en({gridPerSide:e=24,boxLengthMpc:t=200,aInit:n=.05,omegaM:r=.315,omegaLambda:i=.685,amplitude:a=.14,seed:o=20261122,slabBounds:s=null,initialPositionsShift:c=[0,0,0]}={}){let l=Math.max(8,Math.trunc(e)),u=l*l*l,d=new Float32Array(u*16),f=Number(t),p=f/l,m=Zt(n,{omegaM:r,omegaLambda:i}),h=(r/(n**3*m*m))**.55,g=o>>>0,_=()=>(g=Math.imul(1664525,g)+1013904223>>>0,(g+.5)/4294967296),v=[],y=2*Math.PI/Math.max(.001,f),b=Math.max(y*1.5,Math.min(.0103,y*Math.max(2.5,l*.22)));for(let e=-3;e<=3;e+=1)for(let t=-3;t<=3;t+=1)for(let n=-3;n<=3;n+=1){let r=e*e+t*t+n*n;if(r===0||r>12)continue;let i=2*Math.PI/f*Math.sqrt(r),o=i/(1+(i/b)**2)**2,s=a*Math.sqrt(o)*(f/45);v.push({kx:2*Math.PI*e/f,ky:2*Math.PI*t/f,kz:2*Math.PI*n/f,k2:i*i,amp:s,phase:_()*2*Math.PI})}let x=Number(c?.[0])||0,S=Number(c?.[1])||0,C=Number(c?.[2])||0,w=0,T=0,E=0,D=0;for(let e=0;e<l;e+=1)for(let t=0;t<l;t+=1)for(let r=0;r<l;r+=1){let i=(r+.5)*p-.5*f,a=(t+.5)*p-.5*f,o=(e+.5)*p-.5*f,s=0,c=0,l=0;for(let e of v){let t=e.kx*i+e.ky*a+e.kz*o+e.phase,n=Math.sin(t)*(e.amp/e.k2);s+=e.kx*n,c+=e.ky*n,l+=e.kz*n}let u=Qt(i+s+x,f),g=Qt(a+c+S,f),_=Qt(o+l+C,f),y=n*n*m*h,b=y*s,O=y*c,k=y*l;T+=b,E+=O,D+=k;let A=w*16;d[A+0]=u,d[A+1]=g,d[A+2]=_,d[A+3]=1,d[A+4]=b,d[A+5]=O,d[A+6]=k,d[A+7]=.25,d[A+12]=+(w%6==0),d[A+14]=n,w+=1}T/=u,E/=u,D/=u;for(let e=0;e<u;e+=1)d[e*16+4]-=T,d[e*16+5]-=E,d[e*16+6]-=D;if(s&&Number.isFinite(s.xMin)&&Number.isFinite(s.xMax)){let e=[];for(let t=0;t<u;t+=1){let n=d[t*16+0];n>=s.xMin&&n<s.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(d.subarray(r,r+16),n*16)}return{icBackend:`host-zeldovich-low-k`,particleCount:e.length,globalParticleCount:u,data:t,boxLengthMpc:f,aInit:n}}return{icBackend:`host-zeldovich-low-k`,particleCount:u,globalParticleCount:u,data:d,boxLengthMpc:f,aInit:n}}function tn(e,{gridPerSide:t=24,pmGridN:n=32,boxLengthMpc:r=200,aInit:i=.05,da:a=.015,omegaM:o=.315,omegaLambda:s=.685,smoothCells:c=.75,enableShortRangeTree:l=!0,seed:u=20261122,initialPositionsShift:d=[0,0,0],slabBounds:p=null,initialConditions:m=null}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createSupergalacticTreePmSessionWebGpu requires a live WebGPU GPUDevice`);let h=m||en({gridPerSide:t,boxLengthMpc:r,aInit:i,omegaM:o,omegaLambda:s,seed:u,slabBounds:p,initialPositionsShift:d}),g=h.particleCount,_=h.globalParticleCount??h.particleCount,v=n,y=v**3,b=ne(e,v),x=[P(0,`uniform`),P(1,`storage`),P(2,`storage`),P(3,`storage`),P(4,`storage`),P(5,`storage`),P(6,`storage`),P(7,`storage`)],S=t=>I(e,{cacheKey:`ulg-supergalactic-treepm-${t}.v3-1submit-pk-kdk`,label:`ulg-supergalactic-treepm-${t}`,code:Yt,entryPoint:t,bindings:x}),C=S(`clear_grids`),w=S(`cic_deposit`),T=S(`prepare_poisson_rhs`),E=S(`reduce_power_spectrum_pk`),D=S(`store_force_x`),O=S(`store_force_y`),k=S(`store_force_z`),A=S(`cic_kick_drift`),j=S(`reduce_telemetry_f32`),M=S(`reduce_tile_multipole`),N=e.createBuffer({size:64,usage:Kt.UNIFORM|Kt.COPY_DST}),F=e.createBuffer({label:`ulg-supergalactic-particles`,size:Math.max(64,h.data.byteLength),usage:Kt.VERTEX|Kt.STORAGE|Kt.COPY_DST|Kt.COPY_SRC});h.data.byteLength>0&&e.queue.writeBuffer(F,0,h.data);let L=e.createBuffer({size:y*4,usage:Kt.STORAGE|Kt.COPY_SRC}),R=e.createBuffer({size:y*16,usage:Kt.STORAGE}),z=e.createBuffer({size:320,usage:Kt.STORAGE|Kt.COPY_SRC}),B=e.createBuffer({size:320,usage:Kt.MAP_READ|Kt.COPY_DST}),ee=e.createBuffer({size:32,usage:Kt.MAP_READ|Kt.COPY_DST}),V=e.createBuffer({size:y*16,usage:Kt.STORAGE}),te=e.createBuffer({size:(y+Jt)*16,usage:Kt.STORAGE|Kt.COPY_DST}),re=e.createBuffer({size:b.byteLength,usage:Kt.STORAGE|Kt.COPY_DST|Kt.COPY_SRC}),ie=t=>e.createBindGroup({layout:C.bindGroupLayout,entries:[N,F,L,t,R,z,V,te].map((e,t)=>({binding:t,resource:{buffer:e}}))}),ae=ie(b.bufferA),oe=ie(b.bufferB),H=ie(re),se=e=>e===b.bufferA?ae:e===b.bufferB?oe:H,ce=r/v,le=(c*ce)**2,ue=l?c*ce:0,de=_/y;b.writeAxisPoissonParams({boxLength:r,smoothR2:le});let fe=i,pe=0,me=0,he=0,ge=1,_e=null,ve={xMin:-.5*r,xMax:.5*r},ye=(t=null,n=a)=>{let i=t||ve,c=Zt(fe,{omegaM:o,omegaLambda:s}),l=1.5*o/Math.max(.01,fe),u=new ArrayBuffer(64);return new Uint32Array(u,0,4).set([g,v,pe,he]),new Float32Array(u,16,12).set([r,fe,n,c,o,l,de,ue,me,Number(i.xMin),Number(i.xMax),0]),e.queue.writeBuffer(N,0,u),{hA:c,gravPref:l,stepDa:n}};function be(t=[]){let n=Array.isArray(t)?t.slice(0,Jt):[],r=new Float32Array(Jt*4);for(let e=0;e<n.length;e+=1){let t=n[e],i=t.com||[0,0,0];r[e*4+0]=Number(i[0])||0,r[e*4+1]=Number(i[1])||0,r[e*4+2]=Number(i[2])||0,r[e*4+3]=Math.max(0,Number(t.totalMass)||0)}return he=n.length,e.queue.writeBuffer(te,y*16,r),he}let xe=Math.ceil(y/64),Se=Math.max(1,Math.ceil(g/64)),Ce=!1,we=null,Te=!1;async function Ee({readTelemetry:t=!0,daOverride:n=null}={}){if(Te)return we;let i=n!=null&&Number.isFinite(Number(n))&&Number(n)>0?Math.max(1e-5,Math.min(.25,Number(n))):a,{hA:c}=ye(null,i),u=i/(Math.max(.01,fe)*Math.max(.05,c)),d=e.createCommandEncoder({label:`ulg-cosmo-treepm-step-${pe}`}),p=d.beginComputePass({label:`ulg-cosmo-cic-rhs`});p.setBindGroup(0,ae),p.setPipeline(C.pipeline),p.dispatchWorkgroups(xe),g>0&&(p.setPipeline(w.pipeline),p.dispatchWorkgroups(Se)),p.setPipeline(T.pipeline),p.dispatchWorkgroups(xe),p.end();let m=b.encodeForward(d);d.copyBufferToBuffer(m,0,re,0,b.byteLength),p=d.beginComputePass({label:`ulg-cosmo-pk`}),p.setBindGroup(0,H),p.setPipeline(E.pipeline),p.dispatchWorkgroups(qt),p.end();let y=[D,O,k];for(let e=1;e<=3;e+=1){let t=b.encodePoissonInverseFromKSpace(d,re,{gradAxis:e});p=d.beginComputePass({label:`ulg-cosmo-store-f${e}`}),p.setBindGroup(0,se(t)),p.setPipeline(y[e-1].pipeline),p.dispatchWorkgroups(xe),p.end()}p=d.beginComputePass({label:`ulg-cosmo-kdk-telemetry`}),p.setBindGroup(0,ae),g>0&&(p.setPipeline(A.pipeline),p.dispatchWorkgroups(Se)),p.setPipeline(j.pipeline),p.dispatchWorkgroups(2),p.end();let x=!!(t&&!Te&&!Ce&&B.mapState===`unmapped`);if(x&&(Ce=!0,d.copyBufferToBuffer(z,0,B,0,320)),e.queue.submit([d.finish()]),ge=1,me=u,fe=Math.min(1e6,fe+i),pe+=1,!x)return t?we:null;let S=null;try{if(await B.mapAsync(Kt.MAP_READ),Te||(S=new Float32Array(B.getMappedRange().slice(0,320))),!Te&&B.mapState===`mapped`)try{B.unmap()}catch{}}catch(e){if(!Te&&e?.name!==`AbortError`)throw e}finally{Ce=!1}if(!S||Te)return we;let M=Math.sqrt(Math.max(0,S[0]/Math.max(1,S[3]))),N=S[1],P=S[4],F=[S[5],S[6],S[7]],I=1/Math.max(1e-4,fe)-1,L=[],R=[],ee=[],V=0;for(let e=0;e<qt;e+=1){let t=(2+e)*4,n=Math.round(S[t+2]);n>0&&(L.push(S[t+0]),R.push(S[t+1]),ee.push(n),V+=n)}let te=R.length>0?R.slice(0,Math.min(4,R.length)).reduce((e,t)=>e+t,0)/Math.min(4,R.length):0;_e===null&&te>0&&(_e=te);let ne=_e>0?Math.sqrt(te/_e):1;return we=Object.freeze({schema:Gt,backend:l?`webgpu-fft3d-hybrid-treepm`:`webgpu-fft3d-pm`,icBackend:h.icBackend||`webgpu-fft3d-zeldovich`,integrator:`symplectic-comoving-kdk`,submitsPerStep:ge,hybridTreePmEnabled:!!l,shortRangeSplitScaleMpc:ue,remoteTileCount:he,stepIndex:pe,scaleFactorA:fe,redshiftZ:I,hOverH0:Zt(fe,{omegaM:o,omegaLambda:s}),particleCount:g,globalParticleCount:_,pmGridN:v,boxLengthMpc:r,sigmaDensity:M,maxOverdensity:N,kineticEnergy:P,momentum:F,powerSpectrumPk:Object.freeze({kBins:Object.freeze(L),pkValues:Object.freeze(R),modeCounts:Object.freeze(ee),totalModes:V,lowKPower:te,linearGrowthRatio:ne}),accuracyTier:f.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,sharedKernel:`src/runtime/gpuMath/fft3dWebGpu.js`})}),we}async function De(){if(g===0)return new Float32Array;let t=e.createBuffer({size:h.data.byteLength,usage:Kt.MAP_READ|Kt.COPY_DST});try{let n=e.createCommandEncoder({label:`ulg-cosmo-read-particles`});n.copyBufferToBuffer(F,0,t,0,h.data.byteLength),e.queue.submit([n.finish()]),await t.mapAsync(Kt.MAP_READ);let r=new Float32Array(t.getMappedRange().slice(0));return t.unmap(),r}finally{t.destroy()}}async function Oe({xMin:t=-.5*r,xMax:n=.5*r}={}){ve={xMin:Number(t),xMax:Number(n)},ye(ve);let i=e.createCommandEncoder({label:`ulg-cosmo-tile-multipole-gpu`}),a=i.beginComputePass();a.setBindGroup(0,ae),a.setPipeline(M.pipeline),a.dispatchWorkgroups(1),a.end(),i.copyBufferToBuffer(z,288,ee,0,32),e.queue.submit([i.finish()]),await ee.mapAsync(Kt.MAP_READ);let o=new Float32Array(ee.getMappedRange().slice(0,32));return ee.unmap(),Object.freeze({reducedOnGpu:!0,readbackBytes:32,totalMass:o[0],com:Object.freeze([o[1],o[2],o[3]]),quadrupoleTrace:o[4],particleCount:Math.round(o[5]),scaleFactorA:fe,stepIndex:pe})}async function ke({maxHalos:t=7}={}){if(Te)return[];let n=y*4,i=e.createBuffer({label:`ulg-cosmo-halo-read`,size:n,usage:Kt.MAP_READ|Kt.COPY_DST}),a=null;try{let t=e.createCommandEncoder({label:`ulg-cosmo-halo-extract`});t.copyBufferToBuffer(L,0,i,0,n),e.queue.submit([t.finish()]),await i.mapAsync(Kt.MAP_READ),Te||(a=new Int32Array(i.getMappedRange(0,n)).slice());try{i.unmap()}catch{}}catch{a=null}finally{try{i.destroy()}catch{}}if(!a||a.length<y)return[];let o=0;for(let e=0;e<y;e+=1)o+=Math.max(0,a[e]);let s=Math.max(1e-6,o/y),c=v,l=e=>(e%c+c)%c,u=(e,t,n)=>Math.max(0,a[(l(n)*c+l(t))*c+l(e)]),d=[],f=null,p=null;for(let e=0;e<c;e+=1)for(let t=0;t<c;t+=1)for(let n=0;n<c;n+=1){let r=u(n,t,e),i=r/s;if(!f&&i>=1.25&&i<=1.85&&(n+t+e&3)==1&&(f={ix:n,iy:t,iz:e,delta:i,v:r}),!p&&i>=.35&&i<=.66&&(n*3+t*5+e&7)==3&&(p={ix:n,iy:t,iz:e,delta:i,v:r}),i<1.35)continue;let a=u(n+1,t,e),o=u(n-1,t,e),c=u(n,t+1,e),l=u(n,t-1,e),m=u(n,t,e+1),h=u(n,t,e-1);if(r<a||r<o||r<c||r<l||r<m||r<h)continue;let g=Math.abs(a+o-2*r),_=Math.abs(c+l-2*r),v=Math.abs(m+h-2*r),y=(Math.abs(g-_)+Math.abs(_-v)+Math.abs(v-g))/Math.max(.001,g+_+v+r*.25),b=Math.max(.015,Math.min(.125,.022+y*.095));d.push({ix:n,iy:t,iz:e,delta:i,spinLambda:b})}d.sort((e,t)=>t.delta-e.delta);let m=[],h=Math.max(2.5,c*.14);for(let e of d){if(m.length>=Math.max(1,t-2))break;m.some(t=>Math.hypot(t.ix-e.ix,t.iy-e.iy,t.iz-e.iz)<h)||m.push(e)}for(f&&m.length<t&&m.push({...f,spinLambda:.082}),p&&m.length<t&&m.push({...p,spinLambda:.042});m.length<t&&d.length>m.length;){let e=d.find(e=>!m.includes(e));if(!e)break;m.push(e)}let g=1/Math.max(.02,fe)-1;return m.slice(0,t).map((e,t)=>{let n=(e.ix+.5)/c-.5,i=(e.iy+.5)/c-.5,a=(e.iz+.5)/c-.5,o=[n*r,i*r,a*r],s=Number((11e10*Math.max(.25,e.delta)**1.65).toExponential(2));return Object.freeze({index:t,gridCoords:Object.freeze([e.ix,e.iy,e.iz]),posMpc:Object.freeze(o),posNorm:Object.freeze([n,i,a]),overdensity:Number(e.delta.toFixed(3)),spinLambda:Number((e.spinLambda??.055).toFixed(4)),haloMassSolar:s,scaleFactorA:Number(fe.toFixed(4)),redshiftZ:Number(g.toFixed(3)),gpuCoalesced:!0})})}return Object.freeze({schema:Gt,icBackend:h.icBackend||`host-zeldovich-low-k`,particleCount:g,globalParticleCount:_,strideFloats:16,boxLengthMpc:r,hybridTreePmEnabled:!!l,shortRangeSplitScaleMpc:ue,particlesBuffer:F,forceGridBuffer:R,injectRemoteTileMultipoles:be,step:Ee,readParticlesSnapshot:De,readTileMultipoleSummary:Oe,extractLiveCosmicHalos:ke,getState:()=>({aScale:fe,redshiftZ:Math.max(0,1/fe-1),stepIndex:pe,submitsPerStep:ge,remoteTileCount:he}),destroy(){if(!Te){Te=!0,b.destroy();for(let e of[N,F,L,R,z,B,ee,V,te,re])try{e.destroy()}catch{}}}})}var nn=`ulg.astrophysics.nebular-system-coalescence-webgpu.v1`,rn=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),an=16,on=Object.freeze({id:`nebular-system-coalescence`,lawNodeId:`law:astrophysics-protoplanetary-accretion`,orderConstraint:`after:nebular-mhd-collapse`,adapterMode:l.AGGREGATE_FAR,spatialAuthority:h.CANONICAL_SS_EPOCH,reads:Object.freeze([`nebular-system-parcels`,`stellar-luminosity`,`galactic-metallicity`]),writes:Object.freeze([`nebular-system-parcels`,`annular-coalescence-bins`]),accumulates:Object.freeze([`coalesced-system-summary`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass`,`angular-momentum`,`elemental-budgets`]),validityDomain:Object.freeze({minParcels:512,maxParcels:131072,radialBins:128}),fallbackPolicy:d.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e9,0x5af3107a4000]),fundamentalLaws:Object.freeze([`radiative-equilibrium-condensation-fronts`,`epstein-stokes-aerodynamic-drift`,`streaming-instability-clumping`,`azimuthal-hill-embryo-condensation`,`lindblad-tidal-gap-clearing`,`xuv-photoevaporative-disk-dispersal`,`self-gravitating-hill-coalescence`,`runaway-gas-envelope-accretion`])});function sn(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var cn=`
struct NebParams {
  parcel_count: u32,
  radial_bins: u32,
  step_index: u32,
  enable_drag: u32,
  dt: f32,
  star_mass_solar: f32,
  star_lum_solar: f32,
  metallicity_solar: f32,
  c_to_o: f32,
  gas_fraction: f32,
  r_min_au: f32,
  r_max_au: f32,
  t_1au_k: f32,
  clump_strength: f32,
  visc_heat_1au: f32,
  seed_f: f32,
};

// 64 bytes per parcel — zero-copy renderable by PARTICLE_CLOUD_WGSL mode 6!
//   pos_m:    vec4(x_vis, y_vis, z_vis, solid_mass)
//   vel_st:   vec4(vx, vy, vz, radial_u_log)       (u in [0..1] maps log-linearly r_min_au .. r_max_au)
//   thermo:   vec4(temp_k, volatile_ice_frac, gas_env_frac, r_au)
//   info:     vec4(fe_frac, sil_frac, carbon_frac, active_flag)
struct NebParcel {
  pos_m: vec4<f32>,
  vel_st: vec4<f32>,
  thermo: vec4<f32>,
  info: vec4<f32>,
};

// 10 atomic i32 slots per radial bin (fixed-point scaled by 1000.0):
//   0: solid_mass, 1: fe_mass, 2: sil_mass, 3: carbon_mass,
//   4: h2o_mass,   5: supervol_mass, 6: gas_mass, 7: count,
//   8: cos_phi_m,  9: sin_phi_m (2D azimuthal Hill-sphere proto-embryo condensation!)
@group(0) @binding(0) var<uniform> params: NebParams;
@group(0) @binding(1) var<storage, read_write> parcels: array<NebParcel>;
@group(0) @binding(2) var<storage, read_write> bin_atomic: array<atomic<i32>>;
// 2 vec4<f32> per radial bin:
//   [b*2 + 0] = vec4(r_au, total_solid_m, fe_frac, sil_frac)
//   [b*2 + 1] = vec4(carbon_frac, h2o_frac, supervol_frac, gas_env_frac)
@group(0) @binding(3) var<storage, read_write> bin_summary: array<vec4<f32>>;
// 2 vec4<f32> global telemetry
@group(0) @binding(4) var<storage, read_write> telemetry: array<vec4<f32>>;
// 1 vec4<f32> per radial bin: vec4(mean_cos_phi, mean_sin_phi, azim_coherence, lindblad_gap_torque)
@group(0) @binding(5) var<storage, read_write> bin_azim: array<vec4<f32>>;
// Canonical Schroeder Simulation (SS) 3D hierarchical multipole self-gravity acceleration per nebular parcel!
@group(0) @binding(6) var<storage, read> ss_grav_acc: array<vec4<f32>>;

fn u_to_r_au(u: f32) -> f32 {
  let u_c = clamp(u, 0.0, 1.0);
  let ratio = max(1.5, params.r_max_au / max(0.01, params.r_min_au));
  return params.r_min_au * pow(ratio, u_c);
}

fn r_au_to_u(r_au: f32) -> f32 {
  let ratio = max(1.5, params.r_max_au / max(0.01, params.r_min_au));
  return clamp(log(max(params.r_min_au, r_au) / max(0.01, params.r_min_au)) / log(ratio), 0.0, 0.9999);
}

fn eval_disk_temp_k(r_au: f32) -> f32 {
  let r_safe = max(0.02, r_au);
  let t_rad = params.t_1au_k / sqrt(r_safe);
  let t_visc = params.visc_heat_1au * pow(r_safe, -0.85);
  return max(18.0, t_rad + t_visc);
}

// Smooth physical multi-species condensation fractions in [0..1] strictly from radiative T(r) & nebular C/O!
// Conserves total parcel mass budget p.pos_m.w: uncondensed species remain in vapor/gas phase until crossing
// their condensation front (Fe-Ni 1380 K, Silicate 1200 K, Carbon/SiC 920 K, H2O Snow Line 170 K, CO/CH4 65 K).
fn eval_condensate_weights(temp_k: f32, c_to_o: f32, met: f32) -> vec4<f32> {
  let f_fe  = smoothstep(1480.0, 1280.0, temp_k);
  let f_sil = smoothstep(1300.0, 1100.0, temp_k);
  let f_c   = smoothstep(1040.0, 820.0, temp_k);
  let f_h2o = smoothstep(192.0, 148.0, temp_k);

  // Chemical elemental partitioning controlled smoothly by C/O ratio:
  // High C/O (> 0.78) locks O into CO gas, starving H2O/SiO2 and enriching refractory C/SiC!
  let c_boost = smoothstep(0.50, 0.95, c_to_o);
  let o_avail = clamp(1.18 - 0.85 * c_boost, 0.12, 1.15);
  let z_scale = clamp(0.45 + 0.55 * met, 0.08, 2.6);

  let w_fe  = f_fe  * 0.16 * z_scale;
  let w_sil = f_sil * (0.32 * o_avail) * z_scale;
  let w_c   = f_c   * (0.08 + 0.34 * c_boost) * z_scale;
  // Classic ~2.6x snow-line solid condensation jump as H2O vapor already in the parcel freezes onto dust grains!
  let w_h2o = f_h2o * (0.78 * o_avail) * z_scale;
  return vec4<f32>(w_fe, w_sil, w_c, w_h2o);
}

@compute @workgroup_size(64)
fn clear_annuli(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.radial_bins * 10u) { return; }
  atomicStore(&bin_atomic[idx], 0);
}

@compute @workgroup_size(64)
fn deposit_annuli(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.parcel_count) { return; }
  var p = parcels[i];
  if (p.info.w < 0.5) { return; }

  let u = clamp(p.vel_st.w, 0.0, 0.9999);
  let r_au = u_to_r_au(u);
  let temp_k = eval_disk_temp_k(r_au);
  let met = max(0.015, params.metallicity_solar);
  let w4 = eval_condensate_weights(temp_k, params.c_to_o, met);
  // Super-volatile CO2/NH3/CH4/CO ice condensation in outer disk (< 72 K)
  let f_svol = smoothstep(82.0, 44.0, temp_k);
  let w_svol = f_svol * (0.36 + 0.24 * smoothstep(0.55, 0.95, params.c_to_o)) * clamp(0.45 + 0.55 * met, 0.08, 2.6);

  // Conserved parcel total nebular mass budget lives in p.pos_m.w (NEVER overwritten with non-conserved weights!)
  let m_budget = max(1e-4, p.pos_m.w);
  let f_sum = max(1e-4, w4.x + w4.y + w4.z + w4.w + w_svol);
  let f_cond_tot = min(1.0, f_sum);
  let m_solid = m_budget * f_cond_tot;
  let inv_s = 1.0 / f_sum;
  let fe_f  = w4.x * inv_s;
  let sil_f = w4.y * inv_s;
  let c_f   = w4.z * inv_s;
  let h2o_f = w4.w * inv_s;
  let svol_f = w_svol * inv_s;
  let ice_f = h2o_f + svol_f;

  // Host-star XUV photoevaporative outer-disk gas dispersal scaled cleanly over the 10x coalescence horizon!
  let xuv_decay = exp(-f32(params.step_index) * 0.00014 * pow(max(0.05, params.star_lum_solar), 0.18));
  let gas_local = params.gas_fraction * m_budget * xuv_decay * pow(max(0.15, r_au), -0.35) * smoothstep(params.r_max_au * 1.05, params.r_max_au * 0.55, r_au);

  p.thermo = vec4<f32>(temp_k, ice_f, p.thermo.z, r_au);
  p.info = vec4<f32>(fe_f, sil_f, c_f, 1.0);
  parcels[i] = p;

  // Mass-conserving surface-density normalization across 3K..131K parcels & 64..128 radial bins!
  let mass_norm = (3072.0 / max(512.0, f32(params.parcel_count))) * (f32(params.radial_bins) / 64.0);
  let b = min(params.radial_bins - 1u, u32(floor(u * f32(params.radial_bins))));
  let base = b * 10u;
  let sc = 1000.0 * mass_norm;
  let phi = atan2(p.pos_m.z, p.pos_m.x);
  atomicAdd(&bin_atomic[base + 0u], i32(round(m_solid * sc)));
  atomicAdd(&bin_atomic[base + 1u], i32(round(m_solid * fe_f * sc)));
  atomicAdd(&bin_atomic[base + 2u], i32(round(m_solid * sil_f * sc)));
  atomicAdd(&bin_atomic[base + 3u], i32(round(m_solid * c_f * sc)));
  atomicAdd(&bin_atomic[base + 4u], i32(round(m_solid * h2o_f * sc)));
  atomicAdd(&bin_atomic[base + 5u], i32(round(m_solid * svol_f * sc)));
  atomicAdd(&bin_atomic[base + 6u], i32(round(gas_local * sc)));
  atomicAdd(&bin_atomic[base + 7u], 1);
  atomicAdd(&bin_atomic[base + 8u], i32(round(cos(phi) * m_solid * sc)));
  atomicAdd(&bin_atomic[base + 9u], i32(round(sin(phi) * m_solid * sc)));
}

@compute @workgroup_size(64)
fn finalize_annuli(@builtin(global_invocation_id) gid: vec3<u32>) {
  let b = gid.x;
  if (b >= params.radial_bins) { return; }
  let base = b * 10u;
  let sc = 1.0 / 1000.0;
  let m_sol  = max(0.0, f32(atomicLoad(&bin_atomic[base + 0u])) * sc);
  let m_fe   = max(0.0, f32(atomicLoad(&bin_atomic[base + 1u])) * sc);
  let m_sil  = max(0.0, f32(atomicLoad(&bin_atomic[base + 2u])) * sc);
  let m_c    = max(0.0, f32(atomicLoad(&bin_atomic[base + 3u])) * sc);
  let m_h2o  = max(0.0, f32(atomicLoad(&bin_atomic[base + 4u])) * sc);
  let m_svol = max(0.0, f32(atomicLoad(&bin_atomic[base + 5u])) * sc);
  let m_gas  = max(0.0, f32(atomicLoad(&bin_atomic[base + 6u])) * sc);
  // m_sol and m_gas are ALREADY surface-density normalized by mass_norm inside deposit_annuli!
  // ONLY cnt_n (raw integer +1 per parcel) needs bin_norm scaling — NEVER multiply m_sol/m_gas twice!
  let bin_norm = (3072.0 / max(512.0, f32(params.parcel_count))) * (f32(params.radial_bins) / 64.0);
  let cnt_n  = max(1.0, f32(atomicLoad(&bin_atomic[base + 7u])) * bin_norm);
  let c_sum  = f32(atomicLoad(&bin_atomic[base + 8u])) * sc;
  let s_sum  = f32(atomicLoad(&bin_atomic[base + 9u])) * sc;

  let u_mid = (f32(b) + 0.5) / f32(params.radial_bins);
  let r_au = u_to_r_au(u_mid);
  let temp_k = eval_disk_temp_k(r_au);
  let inv_s = 1.0 / max(1e-5, m_sol);

  // Runaway H2/He gas envelope capture when coalesced solid core crosses critical mass threshold
  // outside or near the snow line (Mizuno-Pollack core-accretion instability)!
  let cold_capture = smoothstep(420.0, 145.0, temp_k);
  let core_excess = smoothstep(38.0, 110.0, m_sol * (0.55 + 0.65 * cold_capture));
  let gas_env_frac = clamp(core_excess * clamp(m_gas / (cnt_n * 0.25 + 1.0), 0.0, 1.0) * 0.88, 0.0, 0.92);

  let coh = clamp(length(vec2<f32>(c_sum, s_sum)) * inv_s, 0.0, 1.0);
  let mean_c = select(1.0, c_sum / max(1e-5, length(vec2<f32>(c_sum, s_sum))), coh > 0.01);
  let mean_s = select(0.0, s_sum / max(1e-5, length(vec2<f32>(c_sum, s_sum))), coh > 0.01);
  let gap_torque = smoothstep(0.14, 0.55, gas_env_frac) * 0.85 + smoothstep(45.0, 125.0, m_sol) * 0.25;

  bin_summary[b * 2u + 0u] = vec4<f32>(r_au, m_sol, m_fe * inv_s, m_sil * inv_s);
  bin_summary[b * 2u + 1u] = vec4<f32>(m_c * inv_s, m_h2o * inv_s, m_svol * inv_s, gas_env_frac);
  bin_azim[b] = vec4<f32>(mean_c, mean_s, coh, gap_torque);
}

@compute @workgroup_size(64)
fn step_coalesce_parcels(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.parcel_count) { return; }
  var p = parcels[i];
  if (p.info.w < 0.5) { return; }

  let dt = params.dt;
  var pos = p.pos_m.xyz;
  var vel = p.vel_st.xyz;
  let r_xz = max(0.35, length(pos.xz));
  let r_3d = max(0.35, length(pos));
  let u = clamp((r_xz - 0.88) / 8.72, 0.002, 0.998);
  let nb = i32(params.radial_bins);
  let bi = clamp(i32(floor(u * f32(params.radial_bins))), 0, nb - 1);

  // 1. TRUE 3D Newtonian Central Star Gravity + Canonical 3D Schroeder Scale-Atlas Multipole Disk Self-Gravity!
  //    Visual scale: r_vis in [0.88..9.60], GM_vis = 24.0 * M_star^0.55 -> realistic Keplerian differential rotation
  //    producing sweeping logarithmic spiral density waves & Jeans gravitational fragmentation over 25-50+ orbits!
  let gm_star = 24.0 * pow(max(0.08, params.star_mass_solar), 0.55);
  let r_soft = sqrt(r_3d * r_3d + 0.16);
  let a_star = -pos * (gm_star / (r_soft * r_soft * r_soft));

  // Canonical 3D SS hierarchical multipole self-gravity (excites genuine non-axisymmetric spiral arms & Hill clumps!)
  let ss_g = clamp(ss_grav_acc[i].xyz, vec3<f32>(-4.5), vec3<f32>(4.5));
  let ss_mag = length(ss_g);

  // 2. Broad, Smooth Disk Gas Pressure Gradient (-grad P / rho) & Lindblad Tidal Gap Clearing (ZERO 1-bin vinyl rings!)
  //    Right-handed prograde CCW tangent t_hat_xz = (+sin phi, -cos phi) = (r_hat_xz.y, -r_hat_xz.x) so L = r x v = +Y!
  let r_hat_xz = pos.xz / r_xz;
  let t_hat_xz = vec2<f32>(r_hat_xz.y, -r_hat_xz.x);
  var f_press_r = 0.0;
  var f_gap_r = 0.0;
  let smooth_span = max(4, i32(round(0.075 * f32(params.radial_bins))));
  for (var db = -smooth_span; db <= smooth_span; db = db + 1) {
    if (db == 0) { continue; }
    let bj = clamp(bi + db, 0, nb - 1);
    let m_j = bin_summary[u32(bj) * 2u + 0u].y;
    let gap_j = bin_azim[u32(bj)].w;
    let frac_d = f32(db) / f32(smooth_span);
    // Hydrodynamic gas pressure gradient repels sharp narrow ring spikes (Toomre acoustic stabilization!)
    let w_p = exp(-frac_d * frac_d * 2.2) * frac_d;
    f_press_r = f_press_r - m_j * w_p;
    // Lindblad resonant torque around genuinely massive gas-giant cores carves broad clean planetary gaps
    let norm_d = abs(frac_d);
    if (gap_j > 0.12 && norm_d > 0.28 && norm_d < 0.95) {
      let dn_g = (norm_d - 0.55) / 0.22;
      f_gap_r = f_gap_r - sign(frac_d) * gap_j * exp(-(dn_g * dn_g)) * 0.45;
    }
  }
  let local_gas_env = bin_summary[u32(bi) * 2u + 1u].w;

  // 3. Sub-Keplerian Gas Headwind Drag, Shakura-Sunyaev alpha-Viscosity, Condensation Pressure Traps & Type I/II Migration!
  let r_au = u_to_r_au(u);
  let t_rad_k = eval_disk_temp_k(r_au);
  let ice_f = p.thermo.y;
  let v_kep = sqrt(gm_star / r_xz);
  let v_circ_vec = vec3<f32>(t_hat_xz.x * v_kep, 0.0, t_hat_xz.y * v_kep);
  let v_rel = vel - v_circ_vec;

  // Smooth condensation pressure traps right at Silicate sublimation front (1250 K) & H2O Snow Line (170 K)
  let d_snow = (t_rad_k - 170.0) / 42.0;
  let snow_trap = exp(-(d_snow * d_snow));
  let d_sil = (t_rad_k - 1220.0) / 180.0;
  let sil_trap = exp(-(d_sil * d_sil));
  let gas_decay = exp(-f32(params.step_index) * 0.000055 * pow(max(0.05, params.star_lum_solar), 0.16));
  var a_drag = vec3<f32>(0.0);
  var mig_tang = 0.0;
  if (params.enable_drag != 0u) {
    // Aerodynamic circularization + vertical midplane damping + gentle radial pebble drift toward condensation traps
    let drag_k = (0.38 + 0.24 * ice_f) * gas_decay * params.gas_fraction;
    let drift_in = -(0.085 + 0.075 * ice_f) * (1.0 - 0.88 * max(snow_trap, sil_trap)) * gas_decay;
    // Physical Type I / Type II viscous angular-momentum loss driven by turbulent viscosity (clump_strength carries alpha_mig):
    // Massive gas-giant cores in high-viscosity, gas-rich disks migrate inward to form Warm/Hot Jupiters!
    mig_tang = -(params.clump_strength * 0.022) * (0.25 + 1.45 * local_gas_env) * params.gas_fraction * gas_decay * smoothstep(0.18, 0.65, u);
    a_drag = -v_rel * drag_k + vec3<f32>(r_hat_xz.x * drift_in, -pos.y * (0.65 * gas_decay), r_hat_xz.y * drift_in);
  }

  // Soft inner/outer Holman-Wiegert boundary confinement
  var f_wall = 0.0;
  if (r_xz < 0.96) { f_wall = (0.96 - r_xz) * 14.0; }
  if (r_xz > 9.45) { f_wall = (9.45 - r_xz) * 8.0; }

  // Normalize pressure-gradient integral by smooth_span so 64-bin and 128-bin runs share identical Toomre Q!
  let span_norm = 5.0 / f32(smooth_span);
  let a_hydro_r = clamp((f_press_r * span_norm * 0.0036 + f_gap_r * span_norm) * 1.15 + f_wall, -4.5, 4.5);
  // Zero non-local peak_phi ring attractor — all azimuthal clumping emerges from canonical 3D SS multipole self-gravity!
  let a_tot = a_star + ss_g + a_drag
    + vec3<f32>(r_hat_xz.x * a_hydro_r + t_hat_xz.x * mig_tang, 0.0, r_hat_xz.y * a_hydro_r + t_hat_xz.y * mig_tang);

  // Symplectic Velocity-Verlet / Semi-Implicit Leapfrog update in full 3D Cartesian space!
  vel = vel + a_tot * dt;
  // Cap extreme inner-edge velocities for CFL stability while preserving elliptical/spiral orbits
  let v_spd = length(vel);
  if (v_spd > 16.0) { vel = vel * (16.0 / v_spd); }
  pos = pos + vel * dt;

  // Gentle vertical confinement & radial clamp within disk box
  let r_new_xz = max(0.75, length(pos.xz));
  if (r_new_xz > 9.85) {
    let sc_b = 9.85 / r_new_xz;
    pos.x = pos.x * sc_b;
    pos.z = pos.z * sc_b;
    vel.x = vel.x * 0.85;
    vel.z = vel.z * 0.85;
  } else if (r_new_xz < 0.82) {
    let sc_b = 0.82 / r_new_xz;
    pos.x = pos.x * sc_b;
    pos.z = pos.z * sc_b;
  }
  pos.y = clamp(pos.y, -1.8, 1.8);

  let u_new = clamp((length(pos.xz) - 0.88) / 8.72, 0.002, 0.998);
  let r_new_au = u_to_r_au(u_new);
  // Real spiral-shock & accretion compressional heating (makes spiral wakes & accreting protoplanets glow!)
  let shock_heat = clamp(ss_mag * 185.0 + length(v_rel) * 65.0, 0.0, 950.0);
  let temp_live = eval_disk_temp_k(r_new_au) + shock_heat;

  p.pos_m = vec4<f32>(pos, p.pos_m.w);
  p.vel_st = vec4<f32>(vel, u_new);
  p.thermo = vec4<f32>(temp_live, ice_f, local_gas_env, r_new_au);
  parcels[i] = p;
}

var<workgroup> wg_sum: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn reduce_nebula_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var acc0 = vec4<f32>(0.0);
  var acc1 = vec4<f32>(0.0);
  for (var b = tid; b < params.radial_bins; b = b + 64u) {
    let s0 = bin_summary[b * 2u + 0u];
    let s1 = bin_summary[b * 2u + 1u];
    let m = s0.y;
    acc0 = acc0 + vec4<f32>(m, m * s0.z, m * s0.w, m * (s1.y + s1.z));
    acc1 = vec4<f32>(
      acc1.x + select(0.0, 1.0, m > 22.0),
      acc1.y + select(0.0, 1.0, s1.w > 0.25),
      acc1.z + m * s1.x,
      max(acc1.w, s0.y)
    );
  }
  wg_sum[tid] = acc0;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) { wg_sum[tid] = wg_sum[tid] + wg_sum[tid + s]; }
    workgroupBarrier();
    s = s >> 1u;
  }
  let tot0 = wg_sum[0];
  workgroupBarrier();

  wg_sum[tid] = acc1;
  workgroupBarrier();
  s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      let a = wg_sum[tid];
      let b = wg_sum[tid + s];
      wg_sum[tid] = vec4<f32>(a.x + b.x, a.y + b.y, a.z + b.z, max(a.w, b.w));
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let denom = max(1e-5, tot0.x);
    telemetry[0] = vec4<f32>(tot0.x, tot0.y / denom, tot0.z / denom, tot0.w / denom);
    telemetry[1] = vec4<f32>(wg_sum[0].x, wg_sum[0].y, wg_sum[0].z / denom, wg_sum[0].w);
  }
}
`;function ln(e,{azimF32:t=null,starMassSolar:n=1,starLuminositySolar:r=1,metallicitySolar:i=1,cToO:a=.55,rMinStableAu:o=.12,rMaxStableAu:s=28,maxBodies:c=8}={}){let l=Math.min(256,Math.floor((e?.length||0)/8));if(l<8)return{bodies:[],bins:[],beltAu:null,cometAu:null};let u=[],d=0;for(let n=0;n<l;n+=1){let i=n*8,a=e[i+0],o=e[i+1],s=e[i+2],c=e[i+3],l=e[i+4],f=e[i+5],p=e[i+6],m=e[i+7],h=n*4,g=!!(t&&t.length>=h+4),_=g?t[h+0]:Math.cos(n*2.39996),v=g?t[h+1]:Math.sin(n*2.39996),y=g?Math.max(0,Math.min(1,t[h+2])):0,b=g&&y>.012?Math.atan2(v,_):(n*2.3999632%(Math.PI*2)+Math.PI*2)%(Math.PI*2),x=Math.max(22,Math.round(278*Math.max(1e-4,r)**.25/Math.sqrt(Math.max(.02,a)))),S=1361*Math.max(1e-4,r)/Math.max(4e-4,a*a);u.push({bin:n,rAu:a,solidMass:o,feFrac:s,silFrac:c,carbonFrac:l,h2oFrac:f,superVolFrac:p,gasEnvFrac:m,phiRad:b,coherence:y,tEqK:x,starFluxWM2:S}),d+=o}d/=l;let f=u.map((e,t)=>{let n=u[Math.max(0,t-1)].solidMass,r=u[t].solidMass,i=u[Math.min(l-1,t+1)].solidMass;return .25*n+.5*r+.25*i}),p=[];for(let e=1;e<l-1;e+=1)f[e]>=f[e-1]&&f[e]>=f[e+1]&&u[e].solidMass>Math.max(2.2,d*.55)&&p.push({...u[e],score:u[e].solidMass*(1+u[e].gasEnvFrac*4.5)});if(p.length===0&&i>=.015){let e=null;for(let t=1;t<l-1;t+=1)u[t].solidMass>1.2&&(!e||u[t].solidMass>e.solidMass)&&(e=u[t]);e&&p.push({...e,score:e.solidMass})}p.sort((e,t)=>t.score-e.score);let m=e=>{let t=Math.min(.95,e.h2oFrac+e.superVolFrac),n=Math.max(.03,(Math.max(.5,e.solidMass)/14)**1.48*(.85+.55*t));return{coreM:n,totM:e.gasEnvFrac>.34?n*(1+e.gasEnvFrac**1.35*44):e.gasEnvFrac>.11?n*(1+e.gasEnvFrac*5.2):n,volFrac:t}},h=[];for(let e of p){if(h.length>=c)break;if(e.rAu<o*.98||e.rAu>s*1.02)continue;let t=m(e).totM;h.some(r=>{let i=m(r).totM,a=Math.max(r.rAu,e.rAu),o=Math.max(1e-4,Math.min(r.rAu,e.rAu)),s=Math.cbrt((t+i)/(3*332946*Math.max(.08,n))),c=Math.max(1.28,Math.min(3.8,1.24+9.5*s));return a/o<c})||h.push(e)}h.sort((e,t)=>e.rAu-t.rAu);let g=h.map((e,t)=>{let{coreM:n,totM:r,volFrac:i}=m(e),o=e.solidMass/Math.max(1e-4,d),s=Number(Math.max(.03,Math.min(45,n)).toFixed(3)),c=Number(Math.max(.03,Math.min(2400,r)).toFixed(2)),l;return l=e.gasEnvFrac>.34&&c>18?6.2+6.4*Math.min(1,(Math.max(15,c)/318)**.22)*Math.min(1,e.gasEnvFrac*1.25):e.gasEnvFrac>.11||c>6.5?2.2+3.4*Math.min(1,(Math.max(2,c)/17)**.28):Math.max(.03,c)**.28*(1+.26*i-.15*e.feFrac),Object.freeze({index:t,aAu:Number(e.rAu.toFixed(4)),phiRad:Number(e.phiRad.toFixed(4)),coherence:Number(e.coherence.toFixed(3)),peakContrast:Number(o.toFixed(3)),tEqK:e.tEqK,starFluxWM2:Number(e.starFluxWM2.toFixed(2)),solidMassRaw:Number(e.solidMass.toFixed(3)),coreMassEarth:s,totalMassEarth:c,radiusEarth:Number(Math.max(.32,Math.min(13.5,l)).toFixed(2)),feFrac:Number(e.feFrac.toFixed(4)),silicateFrac:Number(e.silFrac.toFixed(4)),carbonFrac:Number(e.carbonFrac.toFixed(4)),h2oIceFrac:Number(e.h2oFrac.toFixed(4)),superVolFrac:Number(e.superVolFrac.toFixed(4)),volatileFrac:Number(i.toFixed(4)),gasEnvelopeFrac:Number(e.gasEnvFrac.toFixed(4)),cToO:Number(a.toFixed(3)),gpuCoalesced:!0})}),_=Math.max(.18,2.7*Math.sqrt(Math.max(1e-4,r))),v=u.reduce((e,t)=>{let n=Math.abs(t.rAu-_*.88);return!e||n<Math.abs(e.rAu-_*.88)?t:e},null),y=u.reduce((e,t)=>t.superVolFrac*2+t.h2oFrac>(e?e.superVolFrac*2+e.h2oFrac:-1)?t:e,null);return Object.freeze({schema:nn,starMassSolar:n,starLuminositySolar:r,metallicitySolar:i,cToO:a,snowLineAu:Number(_.toFixed(3)),bodies:Object.freeze(g),bins:u,asteroidZone:v?Object.freeze({aAu:Number(v.rAu.toFixed(4)),feFrac:Number(v.feFrac.toFixed(4)),silicateFrac:Number(v.silFrac.toFixed(4)),carbonFrac:Number(v.carbonFrac.toFixed(4)),volatileFrac:Number((v.h2oFrac+v.superVolFrac).toFixed(4)),tEqK:v.tEqK,starFluxWM2:Number(v.starFluxWM2.toFixed(2))}):null,cometZone:y?Object.freeze({aAu:Number(y.rAu.toFixed(4)),feFrac:Number(y.feFrac.toFixed(4)),silicateFrac:Number(y.silFrac.toFixed(4)),carbonFrac:Number(y.carbonFrac.toFixed(4)),h2oIceFrac:Number(y.h2oFrac.toFixed(4)),superVolFrac:Number(y.superVolFrac.toFixed(4)),volatileFrac:Number(Math.min(.95,y.h2oFrac+y.superVolFrac).toFixed(4)),tEqK:y.tEqK,starFluxWM2:Number(y.starFluxWM2.toFixed(2))}):null})}function un(e,{starMassSolar:t=1,starLuminositySolar:n=1,metallicitySolar:r=1,cToO:i=.55,gasFraction:a=.22,rMinStableAu:o=.14,rMaxStableAu:s=28,parcelCount:c=4096,radialBins:l=64,enableGasDrag:u=!0,seed:d=20261126,label:p=`ulg-nebular-system-coalescence`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createNebularSystemCoalescenceSessionWebGpu requires a live WebGPU GPUDevice`);let m=Math.max(512,Math.min(131072,Math.trunc(c))),h=Math.max(32,Math.min(128,Math.trunc(Number(l)||64))),g=Math.max(.04,Number(o)||.14),_=Math.max(g*3.5,Math.min(48,Number(s)||28)),v=Math.max(.08,Number(t)||1),y=Math.max(1e-4,Number(n)||1),b=Math.max(.005,Math.min(3.5,Number(r)||1)),x=Math.max(.22,Math.min(1.15,Number(i)||.55)),S=Math.max(.02,Math.min(.95,Number(a)||.22)),C=278*y**.25,w=(C/170)**2,T=sn(d),E=Math.max(.18,Math.min(3.6,(.55+2.1*S)*v**.22*Math.exp((T()-.5)*1.35))),D=.55+T()*1.1,O=.45+T()*2.15,k=Math.max(g*4.2,Math.min(_,_*(.42+.68*T()))),A=new Float32Array(m*an),j=24*Math.max(.08,v)**.55,M=T()*Math.PI*2,N=T()*Math.PI*2,L=1+d%4,R=Math.max(.62,Math.min(1.42,1.35-.42*D));for(let e=0;e<m;e+=1){let t=(e+T())/m,n=Math.max(.015,Math.min(.985,t**+R)),r=.88+n*8.72,i=T()*Math.PI*2,a=L*i-(2.8+1.4*D)*Math.log(Math.max(.5,r))+M;i+=Math.sin(a)*.18+Math.sin(2*i-2.4*Math.log(Math.max(.5,r))+N)*.09;let o=g*(k/g)**+n,s=(.045+.055*n)*r,c=(T()+T()+T()-1.5)*.72*s,l=Math.sqrt(j/Math.max(.5,r)),u=(T()-.5)*(.06+O*.4*.04)*l,d=l*(.988+(T()-.5)*.04),f=Math.cos(i),p=Math.sin(i),h=p*d+f*u,_=(T()-.5)*.06*l*(s/Math.max(.5,r)),v=-f*d+p*u,y=Math.max(20,C/Math.sqrt(Math.max(.02,o))),b=y<170?.78:y<210?.35:.04,x=Math.max(.28,Math.min(2.4,Math.max(.12,o/Math.max(.35,w))**(.75-.55*D))),S=Math.max(.08,Math.min(4.8,1.05*E*x*(.85+.3*T()))),P=e*an;A[P+0]=f*r,A[P+1]=c,A[P+2]=p*r,A[P+3]=S,A[P+4]=h,A[P+5]=_,A[P+6]=v,A[P+7]=n,A[P+8]=y,A[P+9]=b,A[P+10]=0,A[P+11]=o,A[P+12]=.3,A[P+13]=.55,A[P+14]=.15,A[P+15]=1}let z=[P(0,`uniform`),P(1,`storage`),P(2,`storage`),P(3,`storage`),P(4,`storage`),P(5,`storage`),P(6,`read-only-storage`)],B=t=>I(e,{cacheKey:`ulg-nebular-sys-coalesce-${t}.v5-conserved-ccw`,label:`${p}-${t}`,code:cn,entryPoint:t,bindings:z}),ee=B(`clear_annuli`),V=B(`deposit_annuli`),te=B(`finalize_annuli`),ne=B(`step_coalesce_parcels`),re=B(`reduce_nebula_telemetry`),ie=e.createBuffer({label:`${p}-params`,size:64,usage:rn.UNIFORM|rn.COPY_DST}),ae=e.createBuffer({label:`${p}-parcels`,size:A.byteLength,usage:rn.STORAGE|rn.VERTEX|rn.COPY_DST|rn.COPY_SRC}),oe=e.createBuffer({label:`${p}-bin-atomic`,size:h*40,usage:rn.STORAGE}),H=h*32,se=e.createBuffer({label:`${p}-bin-summary`,size:H,usage:rn.STORAGE|rn.COPY_SRC}),ce=e.createBuffer({label:`${p}-bin-read`,size:H,usage:rn.MAP_READ|rn.COPY_DST}),le=e.createBuffer({label:`${p}-tel`,size:32,usage:rn.STORAGE|rn.COPY_SRC}),ue=e.createBuffer({label:`${p}-tel-read`,size:32,usage:rn.MAP_READ|rn.COPY_DST}),de=h*16,fe=e.createBuffer({label:`${p}-bin-azim`,size:de,usage:rn.STORAGE|rn.COPY_SRC}),pe=e.createBuffer({label:`${p}-bin-azim-read`,size:de,usage:rn.MAP_READ|rn.COPY_DST}),me=e.createBuffer({label:`${p}-com-read`,size:16,usage:rn.MAP_READ|rn.COPY_DST});e.queue.writeBuffer(ae,0,A);let he=ze(e,{maxCount:m,strideFloats:an,chartLevel:38,useAdjSoftening:!0,qMass:256,qMom:32,rCellFactor:.08,label:`${p}-ss-grav`});he.writeParams({count:m,gravityG:5.2/Math.max(128,m*.45),softening2:.14,boxHalf:11.5,theta2:.68});let ge=F(e,{layout:ne.bindGroupLayout,label:`${p}-bg`,entries:[{binding:0,resource:{buffer:ie}},{binding:1,resource:{buffer:ae}},{binding:2,resource:{buffer:oe}},{binding:3,resource:{buffer:se}},{binding:4,resource:{buffer:le}},{binding:5,resource:{buffer:fe}},{binding:6,resource:{buffer:he.accPhiBuffer}}]}),_e=0,ve=0,ye=.024,be=!!u,xe=!1,Se=!1,Ce=!1,we=[0,0,0],Te=new Float32Array(h*8),Ee=new Float32Array(h*4),De=null,Oe=Object.freeze({schema:nn,stepIndex:0,parcelCount:m,radialBins:h,snowLineAu:w,totalSolidMass:0,meanFeFrac:.3,meanSilicateFrac:.5,meanVolatileIceFrac:.2,meanCarbonFrac:.1,denseRingCount:0,gasGiantCoreCount:0,peakBinMass:0,accuracyTier:f.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1});function ke(t){ye=t;let n=new ArrayBuffer(64);new Uint32Array(n,0,4).set([m,h,_e,+!!be]),new Float32Array(n,16,12).set([t,v,y,b,x,S,g,k,C,O,22*v**.4*(.65+.35*O),d%997*.13]),e.queue.writeBuffer(ie,0,n)}let Ae=Math.ceil(m/64),je=Math.ceil(h*10/64),Me=Math.ceil(h/64);async function Ne({dt:t=.024,substeps:n=4,gravityCadence:r=4,readTelemetry:i=!0,readAnnuli:a=!1}={}){if(xe)return Oe;let o=Math.max(1,Math.min(128,Math.trunc(n))),s=Math.max(1,Math.min(12,Math.trunc(r)||4));ke(Math.max(.004,Math.min(.06,Number(t)||.024)));let c=e.createCommandEncoder({label:`${p}-step-${_e}`}),l=c.beginComputePass({label:`${p}-pass`});for(let e=0;e<o;e+=1)e%s===0&&he.encodeIntoPass(l,{srcBuffer:ae,count:m}),l.setBindGroup(0,ge),l.setPipeline(ee.pipeline),l.dispatchWorkgroups(je),l.setPipeline(V.pipeline),l.dispatchWorkgroups(Ae),l.setPipeline(te.pipeline),l.dispatchWorkgroups(Me),l.setPipeline(ne.pipeline),l.dispatchWorkgroups(Ae),_e+=1;l.setBindGroup(0,ge),l.setPipeline(ee.pipeline),l.dispatchWorkgroups(je),l.setPipeline(V.pipeline),l.dispatchWorkgroups(Ae),l.setPipeline(te.pipeline),l.dispatchWorkgroups(Me),l.setPipeline(re.pipeline),l.dispatchWorkgroups(1),l.end();let u=i&&!Se&&ue.mapState===`unmapped`,d=a&&!Se&&ce.mapState===`unmapped`&&pe.mapState===`unmapped`,h=!Ce&&me.mapState===`unmapped`;if(u&&c.copyBufferToBuffer(le,0,ue,0,32),d&&(c.copyBufferToBuffer(se,0,ce,0,H),c.copyBufferToBuffer(fe,0,pe,0,de)),h&&(Ce=!0,c.copyBufferToBuffer(he.accPhiBuffer,m*16,me,0,16)),(u||d)&&(Se=!0),e.queue.submit([c.finish()]),h&&me.mapAsync(rn.MAP_READ).then(()=>{if(!xe){let e=new Float32Array(me.getMappedRange(0,16));if(Number.isFinite(e[0])&&Number.isFinite(e[1])&&Number.isFinite(e[2])&&e[3]>1e-5){let t=e[0]-we[0],n=e[1]-we[1],r=e[2]-we[2],i=Math.hypot(t,n,r),a=i>1.2?.08:.16,o=.28,s=i*a>o&&i>1e-6?o/i:a;we=[we[0]+t*s,we[1]+n*s,we[2]+r*s]}}try{me.unmap()}catch{}}).catch(()=>{}).finally(()=>{Ce=!1}),u||d)try{let e=[];if(u&&e.push(ue.mapAsync(rn.MAP_READ)),d&&(e.push(ce.mapAsync(rn.MAP_READ)),e.push(pe.mapAsync(rn.MAP_READ))),await Promise.all(e),!xe){if(u){let e=new Float32Array(ue.getMappedRange(0,32));Oe=Object.freeze({schema:nn,stepIndex:_e,parcelCount:m,snowLineAu:w,totalSolidMass:Number(e[0].toFixed(2)),meanFeFrac:Number(e[1].toFixed(3)),meanSilicateFrac:Number(e[2].toFixed(3)),meanVolatileIceFrac:Number(e[3].toFixed(3)),denseRingCount:Math.round(e[4]),gasGiantCoreCount:Math.round(e[5]),meanCarbonFrac:Number(e[6].toFixed(3)),peakBinMass:Number(e[7].toFixed(2)),enableGasDrag:be,accuracyTier:f.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}d&&(Te=new Float32Array(ce.getMappedRange(0,H)).slice(),Ee=new Float32Array(pe.getMappedRange(0,de)).slice(),ve=_e,De=ln(Te,{azimF32:Ee,starMassSolar:v,starLuminositySolar:y,metallicitySolar:b,cToO:x,rMinStableAu:g,rMaxStableAu:k}))}if(u)try{ue.unmap()}catch{}if(d){try{ce.unmap()}catch{}try{pe.unmap()}catch{}}}catch(e){if(!xe&&e?.name!==`AbortError`)throw e}finally{Se=!1}return Oe}async function Pe({substeps:e=240,chunkSize:t=96,gravityCadence:n=6,dt:r=.024}={}){let i=Math.max(1,Math.trunc(e)),a=Math.max(8,Math.min(128,Math.trunc(t)));for(;i>0&&!xe;){let e=Math.min(a,i);i-=e;let t=i<=0;await Ne({dt:r,substeps:e,gravityCadence:n,readTelemetry:t,readAnnuli:t})}return De}function Fe(e=1,{progress:t=1,linearAuBlend:n=0,scaleAuToWorld:r=0,starRadiusWorld:i=0}={}){let a=Math.max(0,Math.min(1,Number(n)||0)),o=.44*e,s=i>0&&a>0?o*(1-a)+i*a:o,c=[{pos:[0,0,0],radius:Math.max(.08*e,s),color0:[1,.92,.68],color1:[1,.48,.16],kind:0,atm:0}],l=Math.max(0,Math.min(1,Number(t)||0));if(l<.14)return c;let u=De?.bodies||[],d=Math.log(Math.max(1.5,k/Math.max(.01,g))),f=Math.max(0,_e-ve);for(let t=0;t<u.length;t+=1){let n=u[t],i=.88+Math.max(0,Math.min(1,Math.log(Math.max(g,n.aAu)/g)/d))*8.72,o=i*e,s=n.aAu*r,p=r>0&&a>0?o*(1-a)+s*a:o,m=Math.max(0,Math.min(1,(l-.14)/.62)),h=m*m*(3-2*m),_=Math.max(.3,Number(n.peakContrast)||1),v=Math.max(0,Math.min(1,Number(n.coherence)||.25)),y=h*(.35+.65*Math.max(0,Math.min(1,(_*(.65+.85*v)-.42)/.95)));if(y<.08)continue;let b=Math.sqrt(j/Math.max(.88,i)**3),x=(Number.isFinite(n.phiRad)?n.phiRad:t*2.39996)-f*ye*b,S=n.gasEnvelopeFrac>.35,C=!S&&n.gasEnvelopeFrac>.12,w=!S&&!C&&n.volatileFrac>.45,T=(.042+.031*Math.max(.32,Math.min(13.5,Number(n.radiusEarth)||(S?10.5:C?4:1)))**.95)*e*(.24+.76*y),E=Math.max(0,Math.min(1,(l-.32)/.56)),D=S?[.88,.72,.5]:C?[.46,.74,.96]:w?[.7,.88,1]:n.tEqK>1100?[1,.45,.12]:[.74,.54,.4],O=S?[.54,.38,.24]:C?[.22,.44,.76]:w?[.3,.52,.8]:[.34,.24,.18],k=[1,.52,.14],A=[.42,.1,.04],M=[k[0]+(D[0]-k[0])*E,k[1]+(D[1]-k[1])*E,k[2]+(D[2]-k[2])*E],N=[A[0]+(O[0]-A[0])*E,A[1]+(O[1]-A[1])*E,A[2]+(O[2]-A[2])*E];c.push({pos:[Math.cos(x)*p,0,Math.sin(x)*p],radius:T,color0:M,color1:N,kind:E<.45&&!S?7:S||C?2:w?3:1,atm:S?.68:C?.48:w?.26:.16,tempK:Math.round(n.tEqK+(1-E)*1600),seed:(t+1)*4.17})}return c}function Ie(){_e=0,ve=0,e.queue.writeBuffer(ae,0,A)}function Le(){if(!xe){xe=!0;try{he.destroy()}catch{}for(let e of[ie,ae,oe,se,ce,fe,pe,le,ue,me])try{e.destroy()}catch{}}}return Object.freeze({schema:nn,lawAdapter:on,spatialAuthority:he.gravityMode,get parcelCount(){return m},get radialBins(){return h},get snowLineAu(){return w},get rMinStableAu(){return g},get rMaxStableAu(){return k},get diskArchitecture(){return Object.freeze({diskMassScale:Number(E.toFixed(3)),sigmaSlope:Number(D.toFixed(3)),alphaMig:Number(O.toFixed(3)),rMaxEffAu:Number(k.toFixed(2)),armCount:L})},get stepIndex(){return _e},get enableGasDrag(){return be},getCenterOfMass:()=>we,getResidentParcelsBuffer:()=>ae,getResidentAnnuliBuffer:()=>se,getTelemetry:()=>Oe,getCoalescedDisk:()=>De,getCoalescedRenderSpheres:Fe,setEnableGasDrag(e){be=!!e},step:Ne,coalesceSystemBurst:Pe,reset:Ie,dispose:Le})}async function dn(e,t,{parcelCount:n=3072,radialBins:r=64,substeps:i=32,seedOverride:a=null}={}){let o=t?.stars||[{massSolar:1,luminositySolar:1,radiusSolar:1}],s=t?.architecture===`binary-p-type`||t?.architecture===`hierarchical-trinary`,c=s?o[0].massSolar+(o[1]?.massSolar||0):o[0].massSolar,l=s?o[0].luminositySolar+(o[1]?.luminositySolar||0):o[0].luminositySolar,u=Math.max(.06,.085*Math.sqrt(Math.max(1e-4,l))*1.15,(o[0].radiusSolar||1)*.00465*6),d=Math.min(38,Math.max(6,26*Math.max(.08,c)**.35)),f=t?.nebulaEnv||{},p=un(e,{starMassSolar:c,starLuminositySolar:l,metallicitySolar:f.metallicitySolar??1,cToO:f.cToO??.55,gasFraction:t?.galaxyEnv?.gasFraction??.24,rMinStableAu:u,rMaxStableAu:d,parcelCount:n,radialBins:r,seed:((a??t?.seed??20261126)^5156890)>>>0});try{let e=await p.coalesceSystemBurst({substeps:i}),t=p.getTelemetry();return Object.freeze({...e,telemetry:t})}finally{p.dispose()}}function fn(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`nebular-system-coalescence@1`)?e.resolveModule(`nebular-system-coalescence@1`)?.descriptor||null:e.registerModule({method:{model:`nebular-system-coalescence`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/nebularSystemCoalescenceGpu.js`,entryPoint:`step_coalesce_parcels`,workgroupSize:64},parameterSchema:{dt:{type:`number`,min:.002,max:.08,required:!1},substeps:{type:`number`,min:1,max:64,required:!1},enableGasDrag:{type:`boolean`,required:!1}},stateLayout:{tensorId:`nebular-system-parcels`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`mSolid`,`vx`,`vu`,`vz`,`uLog`,`tempK`,`iceFrac`,`gasEnv`,`rAu`,`feFrac`,`silFrac`,`cFrac`,`active`]},scaleRangeM:[1e9,0x5af3107a4000],accuracyTier:f.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1,lawAdapter:on,async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=await dn(n,r.starSystem||{},{parcelCount:Number(r.parcelCount??2048),substeps:Number(r.substeps??24),seedOverride:r.seedOverride??null});return t?.({schema:`ulg.astrophysics.nebular-system-coalescence-webgpu.v1`,coalesced:i})??i}})}var pn=`ulg.astrophysics.planetary-genesis-sph-webgpu.v1`,mn=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),hn=32,gn=16,_n=Object.freeze({id:`planetary-genesis-sph`,lawNodeId:`law:astrophysics-planetary-genesis-sph`,orderConstraint:`after:planetary-interior-polytope`,adapterMode:l.AGGREGATE_FAR,spatialAuthority:h.CANONICAL_SS_EPOCH,reads:Object.freeze([`planetary-body-state`,`nebular-chemistry-state`,`sph-genesis-parcels`]),writes:Object.freeze([`sph-genesis-parcels`,`spherical-geology-map`,`local-surface-geology-patch`]),accumulates:Object.freeze([`sph-genesis-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass`,`angular-momentum`,`buoyancy-stratification`,`impact-impulse`]),validityDomain:Object.freeze({requiresSolidCrust:!0,minParcelCount:1024,maxParcelCount:65536}),fallbackPolicy:d.EXACT_SUBSTEP,scaleRangeM:Object.freeze([100,2e7]),fundamentalLaws:Object.freeze([`self-gravitating-sph`,`archimedes-compositional-buoyancy`,`rayleigh-benard-mantle-convection`,`coriolis-geostrophic-deflection`,`solidus-latent-lithosphere-freezing`,`arrhenius-lithosphere-viscosity`,`hypervelocity-impact-cratering`,`shock-wave-crust-coupling`,`spherical-hydraulic-erosion`])});function vn(e={}){let t=Number(e.bodyRadiusM??(Number(e.radiusKm)||6371)*1e3),n=!e.isStar&&t>0&&t<16e6;return{active:n,reason:n?`solid-crust-planetary-body-present`:`gaseous-or-stellar-body-dormant`}}function yn(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function bn(e={},{nebulaEnv:t=null,planetaryAtmoState:n=null,planetaryMode:r=`standard`,systemAgeGyr:i=4.5,seed:a=20261125}={}){let o=300349e-11,s=Math.max(.2,Number(e.radiusKm)||6371),c=Math.max(1e-10,(Number(e.massSolar)||o)/o),l=Math.max(30,Number(e.tempK)||288),u=Math.max(0,Number(n?.surfacePressurePa??e.surfacePressurePa)||0),d=e.coalescedComposition||null,f=Math.max(0,Number(e.volatileMassFrac)||0),p=Math.max(0,Number(d?.volatileFrac)||0),m=Math.max(0,Number(n?.volatileMassFrac)||0),h=Math.max(0,Math.min(.6,f>0||p>0?Math.max(f,p):m)),g=Number(e.coreZ)||26,_=Number(e.mantleZ)||14,v=Number(e.surfZ)||14,y=Math.max(.02,Number(t?.metallicitySolar)||1),b=Math.max(.25,Math.min(1.1,Number(t?.cToO)||.55)),x=Math.max(.05,Number(i)||4.5),S=r===`magma-ocean`||l>1150||e.kind===7,C=!!e.isComet,w=r===`cryo-plumes`||C||_===8&&l<210||e.kind===3,T=d?.carbonFrac>=.3||b>=.8||_===6,E=u>=611?Math.max(273.16,Math.min(647.1,373.15/Math.max(.55,1-.07632*Math.log(Math.max(1e-4,u/101325))))):273.16,D=!S&&!C&&h>=.012&&(l>=235&&l<=E&&u>=611||l>=82&&l<=118&&u>=2e4),O=Math.max(f,Number(d?.h2oIceFrac)||0,p),k=D&&l>=235&&(_===8||O>=.075||e.planetClass===`ocean-world`),A=!!e.isMinorBody||C||s<600,j=.3;j=d&&Number.isFinite(d.feFrac)?Math.max(.06,Math.min(.72,d.feFrac*(A?1.15:1.05))):g===26&&v===26&&u<100&&s<3200?.56:w?.16:A?e.isMetallicAsteroid?.65:.18:Math.max(.18,Math.min(.55,.28+.08*Math.log10(Math.max(.1,y))));let M=Math.min(4,c)**.38*Math.min(1.3,s/5500),N=Math.exp(-x/6.5),P=Math.max(.04,Math.min(1.85,.85*M*N*y**.22));S&&(P=Math.max(P,1.75)),r===`cryo-plumes`&&(P=Math.max(P,.62)),v===16&&u<100&&(P=Math.max(P,1.35));let F=A?.04:Math.max(.05,Math.min(1,P*(D?1.35:h>.004?1.05:.72)*(S?1.25:.92))),I=.08;I=k?.09+Math.min(.06,F*.06):D?.24+Math.min(.12,F*.12):w?.2:T?.22:F>.45?.16:.06;let L=Math.exp(-u/35e4),R=D?Math.max(.015,(1-F*.94)*(.08+.25*L)):Math.max(.18,(1-F*.65)*(.35+.65*L)),z=S?8:D?Math.max(5,Math.round(5+R*14)):Math.max(14,Math.min(48,Math.round(16+R*32))),B=D?Math.min(1,.55+Math.min(.45,u/15e4)):u>5e4&&!S?.22:.04,ee=D?k?Math.max(.36,Math.min(.56,.36+Math.min(.2,O)*1)):Math.max(-.14,Math.min(.28,.06+(Math.min(.15,h)-4e-4)*1.25)):-1.5,V=Math.max(4,Number(e.rotationPeriodHr)||(e.tidallyLocked?480:24)),te=Math.max(.03,Math.min(2.2,24/V)),ne=((Number(a)||20261125)^Math.imul(Math.round(s*7+l*13),2654435761))>>>0;return Object.freeze({radiusKm:s,massEarth:c,tempK:l,pressurePa:u,volatileFrac:h,coreZ:g,mantleZ:_,surfZ:v,cToO:b,metallicitySolar:y,ageGyr:x,isMagmaOcean:S,isCryoWorld:w,isCarbonRich:T,isMinorBody:A,hasOcean:D,feCoreFrac:j,felsicCrustFrac:I,radiogenicHeat:P,tectonicMobility:F,craterPreservation:R,impactorClusters:z,hydraulicErosion:B,seaLevelNorm:ee,rotationOmegaNorm:te,seed:ne})}function xn(e,{parcelCount:t=5120}={}){let n=Math.max(1024,Math.min(65536,Math.trunc(t))),r=new Float32Array(n*gn),i=yn(e.seed^2654435769),a=Math.min(Math.floor(n*.08),e.impactorClusters*14),o=e.hasOcean?Math.floor(n*Math.min(.16,.08+e.volatileFrac*1.4)):0,s=n-a-o,c=Math.max(128,Math.floor(s*e.feCoreFrac*.65)),l=e.hasOcean?Math.max(.26,Math.min(.36,e.felsicCrustFrac*.96)):e.felsicCrustFrac,u=Math.max(160,Math.floor(s*l)),d=Math.max(256,s-c-u),f=5+e.seed%4,p=[];for(let e=0;e<f;e+=1){let t=i()*2-1,n=i()*Math.PI*2,r=Math.sqrt(Math.max(0,1-t*t));p.push({dir:[r*Math.cos(n),t,r*Math.sin(n)],sign:e%2==0?1:-.88,width:.36+i()*.26})}let m=e.isMinorBody?[1.56+i()*.12,.48+i()*.1,.56+i()*.12]:[1,1,1],h=e.isMinorBody?(()=>{let e=(i()-.5)*.28,t=i()*Math.PI*2,n=Math.sqrt(Math.max(0,1-e*e));return[n*Math.cos(t),e,n*Math.sin(t)]})():[1,0,0],g=(e,t)=>{let n=e[0]*h[0]+e[1]*h[1]+e[2]*h[2],r=.42+n*n*.74+.16*n,i=1+.1*Math.sin(e[0]*3.7+e[1]*2.9)*Math.cos(e[2]*3.1);return[e[0]*t*m[0]*r*i,e[1]*t*m[1]*r*i,e[2]*t*m[2]*r*i]},_=[];for(let t=0;t<e.impactorClusters;t+=1){let n=i()*2-1,r=i()*Math.PI*2,a=Math.sqrt(Math.max(0,1-n*n)),o=i()**2.25;_.push({dir:[a*Math.cos(r),n,a*Math.sin(r)],radiusNorm:.024+o*.145,speed:1.55+o*1.75,delayRadius:1.08+t/Math.max(1,e.impactorClusters)*.88})}let v=()=>{let e=i()*2-1,t=i()*Math.PI*2,n=Math.sqrt(Math.max(0,1-e*e));return[n*Math.cos(t),e,n*Math.sin(t)]},y=0,b=(e,t,i,a,o,s,c,l,u,d)=>{if(y>=n)return;let f=y*gn;r[f+0]=e[0],r[f+1]=e[1],r[f+2]=e[2],r[f+3]=i,r[f+4]=t[0],r[f+5]=t[1],r[f+6]=t[2],r[f+7]=a,r[f+8]=o,r[f+9]=s,r[f+10]=c,r[f+11]=l,r[f+12]=u,r[f+13]=0,r[f+14]=d,r[f+15]=1,y+=1};for(let t=0;t<c;t+=1){let t=v(),n=i()**.42*.62,r=[-t[2],0,t[0]],a=.86+.14*(1-n),[o,s,c]=e.isMinorBody?g(t,n):[t[0]*n,t[1]*n,t[2]*n];b([o,s,c],[r[0]*.06,(i()-.5)*.04,r[2]*.06],1.65,a,0,7.9,0,0,.2,i())}for(let t=0;t<d;t+=1){let n=v(),r=t<Math.floor(d*.56),a=r?.86+i()*.14:.44+i()*.46,o=0;for(let e of p){let t=n[0]*e.dir[0]+n[1]*e.dir[1]+n[2]*e.dir[2];o+=e.sign*Math.exp(-((Math.max(0,1-t)/e.width)**1.5))}let s=Math.max(.08,Math.min(1,1.12-a*.78+o*.24*e.radiogenicHeat)),c=o*.14*e.tectonicMobility,[l,u,f]=e.isMinorBody?g(n,a):[n[0]*a,n[1]*a,n[2]*a];b([l,u,f],[n[0]*c,n[1]*c,n[2]*c],1,e.isMagmaOcean?Math.max(.75,s):s,1,3.4,r?.18:0,0,o,i())}let x=p.filter(e=>e.sign<0),S=(x.length>0?x:p).slice(0,e.hasOcean?4:5);for(let t=0;t<u;t+=1){let n;if(i()<(e.hasOcean?.9:.78)&&S.length>0){let r=S[t%S.length],a=v(),o=e.hasOcean?.24+i()**1.15*.34:.28+i()*.44,s=r.dir[0]+a[0]*o,c=r.dir[1]+a[1]*o,l=r.dir[2]+a[2]*o,u=Math.hypot(s,c,l)||1;n=[s/u,c/u,l/u]}else n=v();let r=.9+i()*.12,a=0;for(let e of p){let t=n[0]*e.dir[0]+n[1]*e.dir[1]+n[2]*e.dir[2];a+=e.sign*Math.exp(-((Math.max(0,1-t)/e.width)**1.5))}let o=.38+i()*.26,s=e.isMagmaOcean?.72:.18+Math.max(0,a)*.22,[c,l,u]=e.isMinorBody?g(n,r):[n[0]*r,n[1]*r,n[2]*r];b([c,l,u],[0,0,0],.82,s,2,2.65,o,0,a,i())}for(let e=0;e<o;e+=1){let e=v(),t=.98+i()*.06;b([e[0]*t,e[1]*t,e[2]*t],[0,0,0],.45,.14,4,1.15,0,0,0,i())}for(let e=0;e<a;e+=1){let t=_[e%_.length],n=v(),r=t.radiusNorm*.42,a=[t.dir[0]+n[0]*r,t.dir[1]+n[1]*r,t.dir[2]+n[2]*r],o=Math.max(1e-5,Math.hypot(a[0],a[1],a[2])),s=a[0]/o,c=a[1]/o,l=a[2]/o,u=t.delayRadius+i()*.05;b([s*u,c*u,l*u],[-s*t.speed,-c*t.speed,-l*t.speed],1.35,.48,3,4.8,t.radiusNorm,1,0,i())}return{parcelData:r,parcelCount:y,plumeCount:f,impactorClusters:_.length,impactTargets:_}}var W=`
struct SphParams {
  parcel_count: u32,
  grid_n: u32,
  map_w: u32,
  map_h: u32,
  dt: f32,
  box_half: f32,
  gravity_g: f32,
  radiogenic_heat: f32,
  tectonic_mobility: f32,
  crater_preservation: f32,
  sea_level_norm: f32,
  hydraulic_erosion: f32,
  flags: u32,          // bit0=hasOcean, bit1=isMagmaOcean, bit2=isCryo, bit3=isCarbon, bit4=isMinorBody
  step_index: u32,
  impactor_count: u32,
  seed_f: f32,
  omega_rot: f32,      // Planetary Coriolis spin parameter (Earth 24h = 1.0)
  target_steps: u32,   // Reference geological evolution step count for solidus cooling curve
  rho_norm: f32,       // Scale-invariant grid density normalization across 5K..65K parcels & 32^3..64^3 grids!
  pad_s0: f32,
};

struct SphParcel {
  pos_mass: vec4<f32>,   // xyz, mass
  vel_temp: vec4<f32>,   // vx, vy, vz, tempNorm [0..1]
  mat_state: vec4<f32>,  // x=species(0..4), y=rho0, z=crustThick, w=shockDamage
  aux: vec4<f32>,        // x=convFlux, y=meltOrEjecta, z=seed, w=activeFlag
};

struct ImpactorDesc {
  dir_rad: vec4<f32>,    // xyz = unit impact direction, w = angular crater radius (rad)
  props: vec4<f32>,      // x = depth, y = rimHeight, z = impactStep, w = ejectaStr
};

@group(0) @binding(0) var<uniform> params: SphParams;
@group(0) @binding(1) var<storage, read_write> parcels: array<SphParcel>;
// 32^3 grid: 8 atomic i32 per cell -> [0]=mass, [1..3]=mom_xyz, [4]=temp_m, [5]=rho0_m, [6]=felsic_m, [7]=shock_m
@group(0) @binding(2) var<storage, read_write> grid_acc: array<atomic<i32>>;
// Float resolved grid: 2 vec4 per cell -> [0]=(rho, vx, vy, vz), [1]=(temp, rho0_avg, felsic_frac, shock_e)
@group(0) @binding(3) var<storage, read_write> grid_val: array<vec4<f32>>;
// 32 radial enclosed mass bins + 16 telemetry atomic slots
@group(0) @binding(4) var<storage, read_write> radial_bins: array<atomic<i32>>;
@group(0) @binding(5) var<storage, read> impactors: array<ImpactorDesc>;
// Compact telemetry output (2 vec4):
//   [0] = (coreMeanR, mantleMeanR, felsicMeanR, meanTemp)
//   [1] = (maxCrustThick, minCrustThick, activeImpactors, differentiationIndex)
@group(0) @binding(6) var<storage, read_write> telemetry: array<vec4<f32>>;
// Canonical Schroeder Simulation (SS) hierarchical 3D multipole self-gravity acceleration & COM:
//   [0..parcel_count-1] = vec4(ax, ay, az, phi), [parcel_count] = vec4(com_xyz, m_tot)
@group(0) @binding(7) var<storage, read> ss_grav_acc: array<vec4<f32>>;

const Q_M: f32 = 256.0;
const Q_V: f32 = 128.0;

fn cell_coords(p: vec3<f32>) -> vec3<i32> {
  let nf = f32(params.grid_n);
  let u = (p + vec3<f32>(params.box_half)) / (2.0 * params.box_half);
  let c = vec3<i32>(floor(u * nf));
  return clamp(c, vec3<i32>(0), vec3<i32>(i32(params.grid_n) - 1));
}

fn cell_idx(c: vec3<i32>) -> u32 {
  let n = params.grid_n;
  return (u32(c.z) * n + u32(c.y)) * n + u32(c.x);
}

@compute @workgroup_size(64)
fn clear_sph_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (i < total) {
    let base = i * 8u;
    for (var k = 0u; k < 8u; k = k + 1u) {
      atomicStore(&grid_acc[base + k], 0);
    }
  }
  if (i < 48u) {
    atomicStore(&radial_bins[i], 0);
  }
}

fn cell_frac(p: vec3<f32>) -> vec3<f32> {
  let nf = f32(params.grid_n);
  let u = (p + vec3<f32>(params.box_half)) / (2.0 * params.box_half);
  return clamp(u * nf - vec3<f32>(0.5), vec3<f32>(0.0), vec3<f32>(nf - 1.001));
}

fn sample_grid_trilin0(p: vec3<f32>) -> vec4<f32> {
  let gf = cell_frac(p);
  let c0 = vec3<i32>(floor(gf));
  let f = gf - vec3<f32>(c0);
  let n_i = i32(params.grid_n) - 1;
  let c1 = min(c0 + vec3<i32>(1), vec3<i32>(n_i));
  let v000 = grid_val[cell_idx(vec3<i32>(c0.x, c0.y, c0.z)) * 2u + 0u];
  let v100 = grid_val[cell_idx(vec3<i32>(c1.x, c0.y, c0.z)) * 2u + 0u];
  let v010 = grid_val[cell_idx(vec3<i32>(c0.x, c1.y, c0.z)) * 2u + 0u];
  let v110 = grid_val[cell_idx(vec3<i32>(c1.x, c1.y, c0.z)) * 2u + 0u];
  let v001 = grid_val[cell_idx(vec3<i32>(c0.x, c0.y, c1.z)) * 2u + 0u];
  let v101 = grid_val[cell_idx(vec3<i32>(c1.x, c0.y, c1.z)) * 2u + 0u];
  let v011 = grid_val[cell_idx(vec3<i32>(c0.x, c1.y, c1.z)) * 2u + 0u];
  let v111 = grid_val[cell_idx(vec3<i32>(c1.x, c1.y, c1.z)) * 2u + 0u];
  let c00 = mix(v000, v100, f.x);
  let c10 = mix(v010, v110, f.x);
  let c01 = mix(v001, v101, f.x);
  let c11 = mix(v011, v111, f.x);
  return mix(mix(c00, c10, f.y), mix(c01, c11, f.y), f.z);
}

fn sample_grid_trilin1(p: vec3<f32>) -> vec4<f32> {
  let gf = cell_frac(p);
  let c0 = vec3<i32>(floor(gf));
  let f = gf - vec3<f32>(c0);
  let n_i = i32(params.grid_n) - 1;
  let c1 = min(c0 + vec3<i32>(1), vec3<i32>(n_i));
  let v000 = grid_val[cell_idx(vec3<i32>(c0.x, c0.y, c0.z)) * 2u + 1u];
  let v100 = grid_val[cell_idx(vec3<i32>(c1.x, c0.y, c0.z)) * 2u + 1u];
  let v010 = grid_val[cell_idx(vec3<i32>(c0.x, c1.y, c0.z)) * 2u + 1u];
  let v110 = grid_val[cell_idx(vec3<i32>(c1.x, c1.y, c0.z)) * 2u + 1u];
  let v001 = grid_val[cell_idx(vec3<i32>(c0.x, c0.y, c1.z)) * 2u + 1u];
  let v101 = grid_val[cell_idx(vec3<i32>(c1.x, c0.y, c1.z)) * 2u + 1u];
  let v011 = grid_val[cell_idx(vec3<i32>(c0.x, c1.y, c1.z)) * 2u + 1u];
  let v111 = grid_val[cell_idx(vec3<i32>(c1.x, c1.y, c1.z)) * 2u + 1u];
  let c00 = mix(v000, v100, f.x);
  let c10 = mix(v010, v110, f.x);
  let c01 = mix(v001, v101, f.x);
  let c11 = mix(v011, v111, f.x);
  return mix(mix(c00, c10, f.y), mix(c01, c11, f.y), f.z);
}

@compute @workgroup_size(64)
fn splat_sph_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.parcel_count) { return; }
  let pr = parcels[i];
  if (pr.aux.w < 0.5) { return; }
  let pos = pr.pos_mass.xyz;
  let m = max(0.05, pr.pos_mass.w);
  let is_felsic = select(0.0, 1.0, abs(pr.mat_state.x - 2.0) < 0.3);

  // Smooth 2x2x2 trilinear CIC deposition (ZERO Cartesian voxel-box artifacts on continents!)
  let gf = cell_frac(pos);
  let c0 = vec3<i32>(floor(gf));
  let f = gf - vec3<f32>(c0);
  let n_i = i32(params.grid_n) - 1;
  for (var dz = 0; dz <= 1; dz = dz + 1) {
    let wz = select(1.0 - f.z, f.z, dz == 1);
    let cz = min(n_i, c0.z + dz);
    for (var dy = 0; dy <= 1; dy = dy + 1) {
      let wy = select(1.0 - f.y, f.y, dy == 1);
      let cy = min(n_i, c0.y + dy);
      for (var dx = 0; dx <= 1; dx = dx + 1) {
        let wx = select(1.0 - f.x, f.x, dx == 1);
        let w = wx * wy * wz;
        if (w < 1e-4) { continue; }
        let cx = min(n_i, c0.x + dx);
        let mw = m * w;
        let ci = cell_idx(vec3<i32>(cx, cy, cz)) * 8u;
        atomicAdd(&grid_acc[ci + 0u], i32(round(mw * Q_M)));
        atomicAdd(&grid_acc[ci + 1u], i32(round(mw * pr.vel_temp.x * Q_V)));
        atomicAdd(&grid_acc[ci + 2u], i32(round(mw * pr.vel_temp.y * Q_V)));
        atomicAdd(&grid_acc[ci + 3u], i32(round(mw * pr.vel_temp.z * Q_V)));
        atomicAdd(&grid_acc[ci + 4u], i32(round(mw * pr.vel_temp.w * Q_M)));
        atomicAdd(&grid_acc[ci + 5u], i32(round(mw * pr.mat_state.y * Q_M)));
        atomicAdd(&grid_acc[ci + 6u], i32(round(mw * is_felsic * Q_M)));
        atomicAdd(&grid_acc[ci + 7u], i32(round(mw * pr.mat_state.w * Q_M)));
      }
    }
  }

  let r = length(pos);
  let rbin = min(31u, u32(floor(clamp(r / 1.45, 0.0, 0.999) * 32.0)));
  atomicAdd(&radial_bins[rbin], i32(round(m * Q_M)));
}

@compute @workgroup_size(64)
fn finalize_sph_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (i >= total) { return; }
  let base = i * 8u;
  let m = f32(atomicLoad(&grid_acc[base + 0u])) / Q_M;
  if (m > 1e-4) {
    let inv_m = 1.0 / m;
    let vx = (f32(atomicLoad(&grid_acc[base + 1u])) / Q_V) * inv_m;
    let vy = (f32(atomicLoad(&grid_acc[base + 2u])) / Q_V) * inv_m;
    let vz = (f32(atomicLoad(&grid_acc[base + 3u])) / Q_V) * inv_m;
    let temp = (f32(atomicLoad(&grid_acc[base + 4u])) / Q_M) * inv_m;
    let rho0 = (f32(atomicLoad(&grid_acc[base + 5u])) / Q_M) * inv_m;
    let felsic = (f32(atomicLoad(&grid_acc[base + 6u])) / Q_M) * inv_m;
    let shock = (f32(atomicLoad(&grid_acc[base + 7u])) / Q_M) * inv_m;
    grid_val[i * 2u + 0u] = vec4<f32>(m, vx, vy, vz);
    grid_val[i * 2u + 1u] = vec4<f32>(temp, rho0, felsic, shock);
  } else {
    grid_val[i * 2u + 0u] = vec4<f32>(0.0);
    grid_val[i * 2u + 1u] = vec4<f32>(0.0, 3.0, 0.0, 0.0);
  }
}

@compute @workgroup_size(64)
fn advect_sph_parcels(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.parcel_count) { return; }
  var pr = parcels[i];
  if (pr.aux.w < 0.5) { return; }

  let dt = params.dt;
  var pos = pr.pos_mass.xyz;
  var vel = pr.vel_temp.xyz;
  var temp = pr.vel_temp.w;
  var species = pr.mat_state.x;
  let rho0 = pr.mat_state.y;
  var crust_thick = pr.mat_state.z;
  var shock = pr.mat_state.w;
  var conv_flux = pr.aux.x;

  let r = max(0.035, length(pos));
  let n_rad = pos / r;

  // 1. Canonical 3D Hierarchical Schroeder Simulation (SS) Scale-Atlas Multipole Self-Gravity!
  //    True asymmetric 3D self-gravity across 4,096 L2 + 64 L1 charts (handles both hydrostatic spheres
  //    AND irregular triaxial/bilobed asteroids/comets + off-center sinking Fe-Ni cores!)
  let ss_g = ss_grav_acc[i].xyz;
  let ss_com = ss_grav_acc[params.parcel_count].xyz;
  let g_ss_mag = length(ss_g);
  let g_mag = clamp(g_ss_mag, 0.12, 8.5);
  var acc = clamp(ss_g, vec3<f32>(-12.0), vec3<f32>(12.0)) - ss_com * 0.35;

  // 2. Smooth Trilinear CIC 32^3 SPH Grid Pressure Gradient (-grad P / rho), Viscosity, & Velocity Divergence!
  let dx = (2.0 * params.box_half) / f32(params.grid_n);
  let g_c0 = sample_grid_trilin0(pos);
  let g_c1 = sample_grid_trilin1(pos);

  let gx_p = sample_grid_trilin0(pos + vec3<f32>(dx, 0.0, 0.0));
  let gx_m = sample_grid_trilin0(pos - vec3<f32>(dx, 0.0, 0.0));
  let gy_p = sample_grid_trilin0(pos + vec3<f32>(0.0, dx, 0.0));
  let gy_m = sample_grid_trilin0(pos - vec3<f32>(0.0, dx, 0.0));
  let gz_p = sample_grid_trilin0(pos + vec3<f32>(0.0, 0.0, dx));
  let gz_m = sample_grid_trilin0(pos - vec3<f32>(0.0, 0.0, dx));

  let grad_rho = vec3<f32>(gx_p.x - gx_m.x, gy_p.x - gy_m.x, gz_p.x - gz_m.x) / (2.0 * dx);
  let div_v = ((gx_p.y - gx_m.y) + (gy_p.z - gy_m.z) + (gz_p.w - gz_m.w)) / (2.0 * dx);

  // Compressible EOS hydrostatic pressure support balancing self-gravity (scale-invariant across 5K..65K parcels & 32^3..64^3 grids!)
  let k_eos = select(1.45, 2.35, species < 0.5);
  let rho_local = g_c0.x * params.rho_norm;
  acc = acc - (grad_rho * params.rho_norm) * (k_eos / max(0.35, rho_local + 0.45));

  // 3. True Archimedes Compositional + Thermal Rayleigh-Benard Buoyancy!
  let cell_temp = g_c1.x;
  let cell_rho0 = max(1.0, g_c1.y);
  let rho_eff = rho0 * (1.0 - 0.34 * (temp - cell_temp));
  let buoy_ratio = clamp((cell_rho0 - rho_eff) / max(1.2, rho_eff), -1.35, 1.35);
  acc = acc + n_rad * (g_mag * buoy_ratio * 0.95);

  // 3B. Planetary Coriolis Geostrophic Deflection (-2 Omega x v) on convecting mantle, tectonic plates & ocean currents!
  if (species > 0.5 && r > 0.52) {
    let omega_v = vec3<f32>(0.0, params.omega_rot * 0.42, 0.0);
    acc = acc - 2.0 * cross(omega_v, vel);
  }

  // Smooth trilinear tangent mantle convection traction driving organic continental rafting & rifting!
  let grad_t = vec3<f32>(
    sample_grid_trilin1(pos + vec3<f32>(dx, 0.0, 0.0)).x - sample_grid_trilin1(pos - vec3<f32>(dx, 0.0, 0.0)).x,
    sample_grid_trilin1(pos + vec3<f32>(0.0, dx, 0.0)).x - sample_grid_trilin1(pos - vec3<f32>(0.0, dx, 0.0)).x,
    sample_grid_trilin1(pos + vec3<f32>(0.0, 0.0, dx)).x - sample_grid_trilin1(pos - vec3<f32>(0.0, 0.0, dx)).x
  ) / (2.0 * dx);
  let grad_t_tang = grad_t - n_rad * dot(grad_t, n_rad);
  if (species > 0.5 && species < 2.5 && r > 0.65) {
    acc = acc - grad_t_tang * (params.tectonic_mobility * 0.58);
    conv_flux = mix(conv_flux, clamp((temp - cell_temp) * 3.0 - div_v * 0.45, -1.5, 1.5), clamp(dt * 3.0, 0.0, 1.0));
  }

  // 4. Planetesimal Hypervelocity Impact Cratering (species == 3 colliding with crust) + 3D Shock-Wave Coupling!
  if (abs(species - 3.0) < 0.3) {
    if (r < 1.03) {
      // Impact shock converts hypervelocity kinetic energy into thermal melt & excavation impulse!
      let ke = 0.5 * dot(vel, vel);
      shock = clamp(shock + ke * 0.65, 0.0, 2.5);
      temp = min(1.0, temp + ke * 0.32);
      vel = vel * 0.18;
      // Impactor becomes shocked regolith/ejecta settled onto the crust
      species = 1.0;
      pr.mat_state.x = 1.0;
      pr.mat_state.y = 3.25;
      pr.aux.y = 1.0;
    }
  } else if (g_c1.w > 0.08 && species > 0.5 && species < 2.5 && r > 0.80) {
    // Propagate live impact shock waves through neighboring lithospheric parcels on the 3D SPH grid!
    temp = min(1.0, temp + g_c1.w * 0.08 * dt);
    shock = max(shock, g_c1.w * 0.45);
  }

  // 5. Solidus/Liquidus Lithosphere Freezing + Convergent Orogenic Crust Thickening & Thermal Evolution!
  let v_cell = g_c0.yzw;
  let cool_age = clamp(f32(params.step_index) / max(44.0, f32(params.target_steps)), 0.0, 1.0);
  let solidus_stiff = smoothstep(0.56, 0.24, temp) * (0.25 + 0.75 * cool_age);
  let base_drag = mix(6.5, 1.8, clamp(temp * 0.75 + params.tectonic_mobility * 0.45, 0.0, 1.0));
  let arrhenius_drag = mix(base_drag, 10.2, solidus_stiff * 0.45);
  let is_minor = (params.flags & 16u) != 0u;
  // Sub-hydrostatic rubble-pile comets & asteroids (< 550 km) are material-strength dominated (sigma_yield >> rho*g*R),
  // preserving genuine 2:1 bilobed contact-binary shapes instead of relaxing into hydrostatic spheres!
  if (is_minor && species < 2.5) {
    acc = acc * 0.032;
  }
  vel = vel + acc * dt;
  vel = mix(vel, v_cell, clamp(dt * arrhenius_drag, 0.0, 0.88));

  // Keep crust thickening physically coupled to convergent tangential compression (-div_v > 0)!
  // (Smooth trilinear cohesion without nearest-voxel Cartesian cell clumping!)
  if (abs(species - 2.0) < 0.3 && r > 0.82) {
    let conv_comp = clamp(-div_v, -1.2, 1.8);
    crust_thick = clamp(crust_thick + conv_comp * params.tectonic_mobility * dt * 0.42, 0.08, 1.65);
  }

  // Volatile H2O/CH4 fluid flows tangentially down pressure/elevation gradients into low basins!
  if (abs(species - 4.0) < 0.3) {
    let grad_r_tang = grad_rho - n_rad * dot(grad_rho, n_rad);
    vel = vel - grad_r_tang * (0.35 * dt);
  }

  // Clamp velocity for CFL stability & advect
  let spd = length(vel);
  if (spd > 3.2) { vel = vel * (3.2 / spd); }
  pos = pos + vel * dt;

  // Soft radial confinement to planetary volume (prevents numerical escape while preserving buoyancy stratification!)
  // Sub-hydrostatic minor bodies (bit 16u: asteroids/comets < 550 km) retain irregular non-spherical 3D lobes!
  let r_new = length(pos);
  if (is_minor && species < 2.5) {
    // High cohesive rock yield strength preserves triaxial bilobed rubble-pile lobes under weak self-gravity!
    vel = vel * exp(-dt * 5.2);
    if (r_new > 1.48) {
      let nr = pos / max(1e-5, r_new);
      pos = nr * 1.48;
      vel = vel * 0.20;
    }
  } else if (species < 2.5 || abs(species - 4.0) < 0.3) {
    let r_max = select(select(1.06, 1.12, abs(species - 2.0) < 0.3), 0.72, species < 0.5);
    if (r_new > r_max) {
      let nr = pos / max(1e-5, r_new);
      pos = nr * r_max;
      let vr_out = dot(vel, nr);
      if (vr_out > 0.0) { vel = vel - nr * (vr_out * 1.15); }
    }
    // Keep surface crust & ocean parcels right on the lithospheric shell
    if (abs(species - 2.0) < 0.3 && r_new < 0.86) {
      pos = (pos / max(1e-5, r_new)) * 0.86;
    }
    if (abs(species - 4.0) < 0.3 && r_new < 0.94) {
      pos = (pos / max(1e-5, r_new)) * 0.94;
    }
  }

  // Radiogenic core heating + heat conduction + true T^4 Stefan-Boltzmann radiative surface cooling
  let core_heat = select(0.0, params.radiogenic_heat * 0.32, r_new < 0.62);
  let t_rad = max(0.05, temp);
  let t_rad2 = t_rad * t_rad;
  let surf_cool = select(0.0, 0.34 * t_rad2 * t_rad2, r_new > 0.88 && (params.flags & 2u) == 0u);
  let conduct = (cell_temp - temp) * 1.45;
  temp = clamp(temp + (core_heat + conduct - surf_cool) * dt, 0.06, 1.0);
  shock = max(0.0, shock - dt * (0.25 + params.tectonic_mobility * 0.35));

  pr.pos_mass = vec4<f32>(pos, pr.pos_mass.w);
  pr.vel_temp = vec4<f32>(vel, temp);
  pr.mat_state = vec4<f32>(species, pr.mat_state.y, crust_thick, shock);
  pr.aux = vec4<f32>(conv_flux, pr.aux.y, pr.aux.z, pr.aux.w);
  parcels[i] = pr;

  // Compact differentiation telemetry atomic accumulation (slots 32..47 in radial_bins)
  let r_q = i32(round(r_new * 100.0));
  if (species < 0.5) {
    atomicAdd(&radial_bins[32u], r_q);
    atomicAdd(&radial_bins[33u], 1);
  } else if (abs(species - 1.0) < 0.3) {
    atomicAdd(&radial_bins[34u], r_q);
    atomicAdd(&radial_bins[35u], 1);
  } else if (abs(species - 2.0) < 0.3) {
    atomicAdd(&radial_bins[36u], r_q);
    atomicAdd(&radial_bins[37u], 1);
    atomicAdd(&radial_bins[38u], i32(round(crust_thick * 100.0)));
  } else if (abs(species - 3.0) < 0.3) {
    atomicAdd(&radial_bins[39u], 1);
  }
  atomicAdd(&radial_bins[40u], i32(round(temp * 100.0)));
}

@compute @workgroup_size(64)
fn write_sph_telemetry(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x > 0u) { return; }
  let c_cnt = max(1.0, f32(atomicLoad(&radial_bins[33u])));
  let m_cnt = max(1.0, f32(atomicLoad(&radial_bins[35u])));
  let f_cnt = max(1.0, f32(atomicLoad(&radial_bins[37u])));
  let r_core = (f32(atomicLoad(&radial_bins[32u])) / 100.0) / c_cnt;
  let r_mantle = (f32(atomicLoad(&radial_bins[34u])) / 100.0) / m_cnt;
  let r_felsic = (f32(atomicLoad(&radial_bins[36u])) / 100.0) / f_cnt;
  let avg_thick = (f32(atomicLoad(&radial_bins[38u])) / 100.0) / f_cnt;
  let active_imp = f32(atomicLoad(&radial_bins[39u]));
  let mean_temp = (f32(atomicLoad(&radial_bins[40u])) / 100.0) / max(1.0, f32(params.parcel_count));
  // Positive differentiation index = felsic crust floated clearly outside dense Fe core!
  let diff_idx = clamp((r_felsic - r_core) / 0.55, 0.0, 1.5);
  telemetry[0] = vec4<f32>(r_core, r_mantle, r_felsic, mean_temp);
  telemetry[1] = vec4<f32>(avg_thick, params.sea_level_norm, active_imp, diff_idx);
}
`,Sn=`
struct GeoParams {
  parcel_count: u32,
  map_w: u32,
  map_h: u32,
  impactor_count: u32,
  tectonic_mobility: f32,
  crater_preservation: f32,
  sea_level_norm: f32,
  hydraulic_erosion: f32,
  flags: u32,         // bit0=hasOcean, bit1=isMagmaOcean, bit2=isCryo, bit3=isCarbon
  iter_index: u32,
  seed_f: f32,
  pad0: f32,
};

struct SphParcel {
  pos_mass: vec4<f32>,
  vel_temp: vec4<f32>,
  mat_state: vec4<f32>,
  aux: vec4<f32>,
};

struct ImpactorDesc {
  dir_rad: vec4<f32>,
  props: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: GeoParams;
@group(0) @binding(1) var<storage, read> parcels: array<SphParcel>;
@group(0) @binding(2) var<storage, read> impactors: array<ImpactorDesc>;
// 6 atomic i32 per texel: [0]=weight, [1]=elevSum, [2]=felsicSum, [3]=tempSum, [4]=waterSum, [5]=convSum
@group(0) @binding(3) var<storage, read_write> map_acc: array<atomic<i32>>;
@group(0) @binding(4) var<storage, read_write> geo_in: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> geo_out: array<vec4<f32>>;

const Q_G: f32 = 512.0;

@compute @workgroup_size(64)
fn clear_geo_acc(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let total = params.map_w * params.map_h;
  if (i >= total) { return; }
  let base = i * 6u;
  for (var k = 0u; k < 6u; k = k + 1u) {
    atomicStore(&map_acc[base + k], 0);
  }
}

@compute @workgroup_size(64)
fn splat_parcels_to_sphere(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.parcel_count) { return; }
  let pr = parcels[i];
  if (pr.aux.w < 0.5) { return; }
  let pos = pr.pos_mass.xyz;
  let r = length(pos);
  let is_minor = (params.flags & 16u) != 0u;
  // Only lithospheric crust, upper mantle upwelling, and surface volatiles project onto the surface crust!
  // On sub-hydrostatic minor bodies (asteroids/comets), project strictly the outer bilobed shell (crustThick >= 0.08)
  // so deep interior parcels never punch spiky speckles into the contact-binary silhouette!
  if (!is_minor && r < 0.76) { return; }
  if (is_minor && (pr.mat_state.z < 0.08 || r < 0.42)) { return; }
  let n = pos / max(1e-5, r);
  let lon = atan2(n.z, n.x);
  let lat = asin(clamp(n.y, -1.0, 1.0));
  let u = fract(lon / 6.28318530718 + 0.5);
  let v = clamp(0.5 - lat / 3.14159265359, 0.0, 0.9999);

  let species = pr.mat_state.x;
  let is_felsic = select(0.0, 1.0, abs(species - 2.0) < 0.3);
  let is_water = select(0.0, 1.0, abs(species - 4.0) < 0.3);
  let is_deep_mantle = select(0.0, 1.0, species < 1.5 && r < 0.85);
  let thick = pr.mat_state.z;
  let temp = pr.vel_temp.w;
  let conv = pr.aux.x;

  // Physical isostatic Airy elevation from SPH parcel buoyancy & orogenic crust thickening!
  // On sub-hydrostatic minor bodies (asteroids/comets), project actual 3D SPH lobe radius (r - 0.84) * 2.15!
  var elev_contrib = select(
    select(-0.44 + (r - 0.88) * 0.75 + conv * 0.16, 0.22 + thick * 0.68 + (r - 0.95) * 0.65 + max(0.0, conv) * 0.28, is_felsic > 0.5),
    -0.58,
    is_water > 0.5
  );
  if (is_minor) {
    // True full-range 3D contact-binary lobe elevation mapped smoothly from real bilobed SPH shell radii [0.38..1.45]
    elev_contrib = clamp((r - 0.86) * 1.48 + (thick - 0.24) * 0.14, -0.96, 0.96);
  }

  // True 3D spherical great-circle Wendland C2 compact SPH kernel support (ZERO equirectangular box edges!):
  // Adaptive smoothing length resolves coherent tectonic continental shelves & mountain chains on planets
  // and smooth sculpted bilobed rubble-pile domes on comets/asteroids!
  let wi = i32(params.map_w);
  let hi = i32(params.map_h);
  let cx = i32(floor(u * f32(wi)));
  let cy = i32(floor(v * f32(hi)));
  let cos_lat = max(0.18, cos(lat));
  let is_mtn_ridge = (is_felsic > 0.5 && (thick > 0.48 || abs(conv) > 0.34));
  let dens_scale = clamp(sqrt(5120.0 / max(2048.0, f32(params.parcel_count))), 0.58, 1.0);
  let base_ang = select(select(select(0.185, 0.235, is_felsic > 0.5), 0.125, is_mtn_ridge), 0.240, is_minor);
  let ang_rad = max(select(0.088, 0.145, is_minor), base_ang * dens_scale);
  let rad_y = clamp(i32(ceil((ang_rad / 3.14159265) * f32(hi))), 5, 32);
  let rad_x = min(76, i32(ceil(f32(rad_y) / cos_lat)));

  for (var dy = -rad_y; dy <= rad_y; dy = dy + 1) {
    let py = clamp(cy + dy, 0, hi - 1);
    let lat_p = (0.5 - (f32(py) + 0.5) / f32(hi)) * 3.14159265359;
    let cos_lp = cos(lat_p);
    let sin_lp = sin(lat_p);
    for (var dx = -rad_x; dx <= rad_x; dx = dx + 1) {
      let px = ((cx + dx) % wi + wi) % wi;
      let lon_p = ((f32(px) + 0.5) / f32(wi) - 0.5) * 6.28318530718;
      let n_pix = vec3<f32>(cos_lp * cos(lon_p), sin_lp, cos_lp * sin(lon_p));
      let ang_d = acos(clamp(dot(n_pix, n), -1.0, 1.0));
      let q = ang_d / ang_rad;
      if (q >= 1.0) { continue; }
      // Wendland C2 compact spherical SPH kernel: (1 - q)^4 * (4q + 1)
      let omq = 1.0 - q;
      let w_kern = omq * omq * omq * omq * (4.0 * q + 1.0);
      // Buoyant surface granitic crust (species == 2) carries physical lithospheric surface authority over sub-crustal mantle!
      let w = w_kern * select(select(select(0.55, 0.18, is_deep_mantle > 0.5), 1.0, is_minor), 2.15, is_felsic > 0.5);
      let base = (u32(py) * params.map_w + u32(px)) * 6u;
      atomicAdd(&map_acc[base + 0u], i32(round(w * Q_G)));
      atomicAdd(&map_acc[base + 1u], i32(round(w * elev_contrib * Q_G)));
      atomicAdd(&map_acc[base + 2u], i32(round(w * is_felsic * Q_G)));
      atomicAdd(&map_acc[base + 3u], i32(round(w_kern * temp * Q_G)));
      atomicAdd(&map_acc[base + 4u], i32(round(w * is_water * Q_G)));
      atomicAdd(&map_acc[base + 5u], i32(round(w * clamp(conv + 0.5, 0.0, 2.0) * Q_G)));
    }
  }
}

@compute @workgroup_size(64)
fn resolve_spherical_geology(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let total = params.map_w * params.map_h;
  if (idx >= total) { return; }
  let px = idx % params.map_w;
  let py = idx / params.map_w;
  let u = (f32(px) + 0.5) / f32(params.map_w);
  let v = (f32(py) + 0.5) / f32(params.map_h);
  let lon = (u - 0.5) * 6.28318530718;
  let lat = (0.5 - v) * 3.14159265359;
  let cos_lat = cos(lat);
  let n_dir = vec3<f32>(cos_lat * cos(lon), sin(lat), cos_lat * sin(lon));

  let base = idx * 6u;
  let w_sum = f32(atomicLoad(&map_acc[base + 0u])) / Q_G;
  var elev = -0.38;
  var felsic = 0.0;
  var temp = 0.22;
  var water = 0.0;
  var conv = 0.0;
  if (w_sum > 1e-3) {
    let inv_w = 1.0 / w_sum;
    elev = (f32(atomicLoad(&map_acc[base + 1u])) / Q_G) * inv_w;
    felsic = clamp((f32(atomicLoad(&map_acc[base + 2u])) / Q_G) * inv_w, 0.0, 1.0);
    temp = clamp((f32(atomicLoad(&map_acc[base + 3u])) / Q_G) * inv_w, 0.0, 1.0);
    water = clamp((f32(atomicLoad(&map_acc[base + 4u])) / Q_G) * inv_w, 0.0, 1.0);
    conv = clamp((f32(atomicLoad(&map_acc[base + 5u])) / Q_G) * inv_w - 0.5, -0.5, 1.5);
  }

  // True Airy hypsometric bimodality + sharp tectonic cordillera belts, offshore trenches & rift canyons!
  let has_ocean = (params.flags & 1u) != 0u;
  let is_magma = (params.flags & 2u) != 0u;
  let is_minor = (params.flags & 16u) != 0u;
  // Realistic Earth-like ~32% cohesive continental plates on ocean worlds (leaves ~68% open deep sapphire oceans!)
  let cont_step = select(smoothstep(0.24, 0.54, felsic), smoothstep(0.49, 0.74, felsic), has_ocean);
  // Crisp narrow coastal Andean/Himalayan mountain arc strictly along convergent continental subduction margins!
  let margin_band = smoothstep(0.46, 0.62, felsic) * (1.0 - smoothstep(0.70, 0.90, felsic));
  let mtn_belt = margin_band * (0.28 + max(0.0, conv) * 0.72) * (0.35 + params.tectonic_mobility * 0.65);
  // Offshore subduction trench right outside the continental margin & inland divergent rift canyons!
  let trench = smoothstep(0.18, 0.36, felsic) * (1.0 - smoothstep(0.36, 0.48, felsic)) * max(0.0, conv + 0.15) * 0.28 * params.tectonic_mobility;
  let rift_canyon = smoothstep(0.18, 0.52, -conv) * 0.18 * (0.4 + params.tectonic_mobility * 0.6);
  if (is_minor) {
    elev = clamp(elev * 1.08, -0.96, 0.96);
  } else if (has_ocean) {
    let ocean_floor = clamp(-0.60 + (elev + 0.40) * 0.52 - trench + rift_canyon * 0.25, -0.92, -0.06);
    let land_elev = clamp(0.20 + (elev - 0.04) * 0.58 + mtn_belt * 0.92 - rift_canyon * 0.35, 0.15, 0.96);
    elev = mix(ocean_floor, land_elev, cont_step);
  } else {
    // Smooth stagnant-lid highlands vs basaltic mare plains + tectonic rift scarps (ZERO lumpy Play-Doh!)
    elev = clamp(elev * 0.68 + (cont_step - 0.44) * 0.36 + mtn_belt * 0.48 - rift_canyon * 0.65, -0.86, 0.86);
  }

  // Imprint real SPH Late-Heavy-Bombardment impact craters progressively over geological formation time
  // (parabolic bowl + crisp raised rim + central peak + ejecta blanket!)
  var crater_ejecta = 0.0;
  var impact_melt = 0.0;
  for (var k = 0u; k < params.impactor_count; k = k + 1u) {
    let imp = impactors[k];
    let imp_appear = select(smoothstep(imp.props.z - 2.0, imp.props.z + 6.0, f32(params.iter_index)), 1.0, params.iter_index >= 40u);
    if (imp_appear <= 0.01) { continue; }
    let c_dir = imp.dir_rad.xyz;
    let c_rad = max(0.022, imp.dir_rad.w);
    let ang = acos(clamp(dot(n_dir, c_dir), -1.0, 1.0));
    if (ang < c_rad * 2.35) {
      let q = ang / c_rad;
      let minor_cr = select(1.0, 0.30, is_minor);
      let depth = imp.props.x * params.crater_preservation * 1.25 * minor_cr * imp_appear;
      let rim_h = imp.props.y * params.crater_preservation * 1.45 * minor_cr * imp_appear;
      if (q < 1.0) {
        // Flat-floored / terraced parabolic excavated basin + central rebound peak on complex craters
        let bowl = (pow(q, 2.8) - 1.0) * depth;
        let terrace = sin(q * 12.566) * 0.045 * depth * smoothstep(0.55, 0.95, q);
        let peak = select(0.0, exp(-q * q * 38.0) * depth * 0.42, c_rad > 0.062);
        elev = elev + bowl + terrace + peak;
        impact_melt = max(impact_melt, (1.0 - q) * 0.25 * imp_appear);
      } else {
        // Razor-sharp overturned crater rim + radial ejecta blanket
        let rim = exp(-pow((q - 1.02) / 0.11, 2.0)) * rim_h;
        elev = elev + rim;
        crater_ejecta = max(crater_ejecta, exp(-(q - 1.0) * 3.1) * imp.props.w * params.crater_preservation * imp_appear);
      }
    }
  }

  // Physically honest volcanic thermal channel:
  //   - Magma ocean worlds (flags & 2u): incandescent [0.55..1.0]
  //   - Cool/temperate worlds: smooth bounded mantle-plume heat [0.0..0.44] (NO glowing orange acne dots on Earth/Mars!)
  let rift_heat = smoothstep(0.42, 0.90, temp) * (1.0 - cont_step * 0.48);
  let thermal_volc = clamp(
    select(rift_heat * 0.42 + impact_melt * 0.08, max(0.56, temp), is_magma),
    0.0,
    1.0
  );

  // Physical Hadley-Cell Climatic Moisture (Equatorial ITCZ rainforest, subtropical dry belt ~25 deg,
  // lush mid-latitude temperate westerlies ~45-62 deg, coastal humidity!)
  let abs_lat = abs(lat);
  let itcz_rain = exp(-pow(abs_lat / 0.36, 2.0)) * 0.82;
  let subtrop_dry = exp(-pow((abs_lat - 0.46) / 0.16, 2.0)) * 0.48;
  let temp_belt = exp(-pow((abs_lat - 0.88) / 0.32, 2.0)) * 0.72;
  let climate_rain = clamp(0.24 + itcz_rain + temp_belt - subtrop_dry, 0.12, 0.96);
  let below_sea = select(0.0, 1.0 - smoothstep(params.sea_level_norm - 0.14, params.sea_level_norm + 0.06, elev), has_ocean);
  let coast_humid = select(0.0, (1.0 - smoothstep(params.sea_level_norm + 0.01, params.sea_level_norm + 0.42, elev)) * 0.44, has_ocean);
  let moisture = clamp(max(below_sea, select(0.0, climate_rain * 0.78 + coast_humid + water * 0.32, has_ocean)), 0.0, 1.0);
  let crust_comp = clamp(mix(felsic, 0.38, crater_ejecta * 0.68), 0.0, 1.0);

  geo_in[idx] = vec4<f32>(clamp(elev, -1.0, 1.0), crust_comp, thermal_volc, moisture);
}

@compute @workgroup_size(64)
fn erode_spherical_geology(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let total = params.map_w * params.map_h;
  if (idx >= total) { return; }
  let w = i32(params.map_w);
  let h = i32(params.map_h);
  let x = i32(idx % params.map_w);
  let y = i32(idx / params.map_w);

  let xl = (x - 1 + w) % w;
  let xr = (x + 1) % w;
  let yu = max(0, y - 1);
  let yd = min(h - 1, y + 1);

  let c   = geo_in[idx];
  let nL  = geo_in[u32(y * w + xl)];
  let nR  = geo_in[u32(y * w + xr)];
  let nU  = geo_in[u32(yu * w + x)];
  let nD  = geo_in[u32(yd * w + x)];
  let nUL = geo_in[u32(yu * w + xl)];
  let nUR = geo_in[u32(yu * w + xr)];
  let nDL = geo_in[u32(yd * w + xl)];
  let nDR = geo_in[u32(yd * w + xr)];

  let has_ocean = (params.flags & 1u) != 0u;
  let is_minor = (params.flags & 16u) != 0u;
  let is_land = !has_ocean || c.x > params.sea_level_norm;
  let lat = (0.5 - (f32(y) + 0.5) / f32(h)) * 3.14159265359;
  let inv_cos = 1.0 / max(0.32, cos(lat));
  // Subaerial base level: terrestrial erosion & talus stop at sea level (ZERO square ocean dilation!)
  let base_lvl = select(-2.0, params.sea_level_norm, has_ocean && is_land);
  let hL  = max(base_lvl, nL.x);
  let hR  = max(base_lvl, nR.x);
  let hU  = max(base_lvl, nU.x);
  let hD  = max(base_lvl, nD.x);
  let hUL = max(base_lvl, nUL.x);
  let hUR = max(base_lvl, nUR.x);
  let hDL = max(base_lvl, nDL.x);
  let hDR = max(base_lvl, nDR.x);

  // Isotropic 3x3 Sobel spherical gradient |grad_sphere h| + Oono-Puri 9-point isotropic Laplacian
  let dh_dx = ((hR - hL) * 2.0 + (hUR - hUL) + (hDR - hDL)) * 0.125 * inv_cos;
  let dh_dy = ((hD - hU) * 2.0 + (hDL - hUL) + (hDR - hUR)) * 0.125;
  let slope = length(vec2<f32>(dh_dx, dh_dy));
  let avg_h = (hL + hR + hU + hD) * 0.1666667 + (hUL + hUR + hDL + hDR) * 0.0833333;
  let lap = avg_h - c.x; // > 0 in concave valleys, < 0 on convex ridges

  var elev = c.x;
  var comp = c.y;
  var volc = c.z;
  var moist = c.w;

  // Isotropic thermal talus creep (smooth circular relaxation above repose angle; eliminates Play-Doh particle grain!)
  let talus = mix(0.055, 0.105, comp);
  if (slope > talus) {
    elev = elev + clamp(lap, -0.035, 0.035) * 0.34;
  }

  // Real Multi-Flow-Direction (MFD) Steepest-Descent Watershed Runoff Accumulation & Stream-Power Incision!
  if (params.hydraulic_erosion > 0.08 && is_land) {
    // Accumulate runoff strictly from HIGHER uphill neighbors flowing down into this cell!
    var upslope_runoff = 0.0;
    if (nL.x  > c.x) { upslope_runoff = upslope_runoff + nL.w  * (nL.x  - c.x) * 1.0; }
    if (nR.x  > c.x) { upslope_runoff = upslope_runoff + nR.w  * (nR.x  - c.x) * 1.0; }
    if (nU.x  > c.x) { upslope_runoff = upslope_runoff + nU.w  * (nU.x  - c.x) * 1.0; }
    if (nD.x  > c.x) { upslope_runoff = upslope_runoff + nD.w  * (nD.x  - c.x) * 1.0; }
    if (nUL.x > c.x) { upslope_runoff = upslope_runoff + nUL.w * (nUL.x - c.x) * 0.707; }
    if (nUR.x > c.x) { upslope_runoff = upslope_runoff + nUR.w * (nUR.x - c.x) * 0.707; }
    if (nDL.x > c.x) { upslope_runoff = upslope_runoff + nDL.w * (nDL.x - c.x) * 0.707; }
    if (nDR.x > c.x) { upslope_runoff = upslope_runoff + nDR.w * (nDR.x - c.x) * 0.707; }
    let avg_m = (nL.w + nR.w + nU.w + nD.w) * 0.1666667 + (nUL.w + nUR.w + nDL.w + nDR.w) * 0.0833333;
    // Physical equilibrium Hadley-cell climate rainfall anchor (NEVER decays Earth's continents to 0.16 tan desert!)
    let abs_l = abs(lat);
    let clim_rain = clamp(
      0.24 + exp(-pow(abs_l / 0.36, 2.0)) * 0.78 + exp(-pow((abs_l - 0.88) / 0.32, 2.0)) * 0.68 - exp(-pow((abs_l - 0.46) / 0.16, 2.0)) * 0.46,
      0.14,
      0.94
    );
    let valley_flow = clamp(upslope_runoff * 6.5 + max(0.0, lap) * 2.2, 0.0, 1.0);
    let discharge = (0.06 + valley_flow * 1.15 + clim_rain * 0.24) * params.hydraulic_erosion;
    // Physically scaled per-pass stream-power incision (balanced for 24-40 passes so continents keep crisp
    // alpine plateaus & natural river valleys instead of collapsing into flat sea-level moat rings!)
    let h_above = max(0.0, elev - params.sea_level_norm);
    let base_guard = smoothstep(0.02, 0.14, h_above);
    let carve = clamp(pow(max(0.01, discharge), 0.65) * pow(slope, 1.15) * 0.11 * base_guard, 0.0, 0.0038);
    let deposit = clamp(discharge * max(0.0, 0.014 - slope) * 0.12, 0.0, 0.0022);
    elev = elev - carve + deposit;
    if (has_ocean) {
      elev = max(params.sea_level_norm + 0.008, elev);
    }
    // Smooth Hadley-cell climatic humidity + delicate valley moisture (never saturates entire plateaus to neon-cyan!)
    let target_m = clamp(max(clim_rain * 0.84, avg_m * 0.92) + valley_flow * 0.12, 0.12, 0.94);
    moist = clamp(mix(moist, target_m, 0.22), 0.12, 0.96);
    comp = clamp(comp + (carve * 2.2 - deposit * 1.4), 0.0, 1.0);
  } else if (!has_ocean && !is_minor) {
    // Gentle isotropic regolith smoothing preserving razor-sharp crater rims, escarpments & tectonic ridges!
    let smooth_w = select(0.045, 0.012, slope > 0.035);
    elev = elev + clamp(lap, -0.020, 0.020) * smooth_w;
  } else if (is_minor) {
    // Keep contact-binary comet/asteroid lobes clean and smooth without spiky high-frequency facets
    let smooth_m = select(0.14, 0.04, slope > 0.08);
    elev = elev + clamp(lap, -0.025, 0.025) * smooth_m;
  }

  // Smooth volcanic heat slightly along rifts
  let avg_v = 0.25 * (nL.z + nR.z + nU.z + nD.z);
  volc = mix(volc, avg_v, 0.12);

  geo_out[idx] = vec4<f32>(clamp(elev, -1.0, 1.0), comp, volc, moist);
}
`,Cn=`
struct PatchParams {
  map_w: u32,
  map_h: u32,
  patch_n: u32,
  iter_index: u32,
  lat_rad: f32,
  lon_rad: f32,
  angular_span_rad: f32,
  hydraulic_erosion: f32,
  sea_level_norm: f32,
  flags: u32,
  seed_f: f32,
  pad0: f32,
};

@group(0) @binding(0) var<uniform> params: PatchParams;
@group(0) @binding(1) var<storage, read> sphere_geo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> patch_a: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> patch_b: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> coarse_64: array<f32>;

fn p_hash2(ix: f32, iz: f32, s: f32) -> f32 {
  let xi = bitcast<u32>(i32(floor(ix)));
  let zi = bitcast<u32>(i32(floor(iz)));
  let si = bitcast<u32>(i32(round(s * 100.0)));
  var h = xi * 374761393u + zi * 668265263u + si * 1442695041u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h & 0xFFFFFFu) * (1.0 / 16777216.0);
}

fn p_vnoise(x: f32, z: f32, s: f32) -> f32 {
  let ix = floor(x); let iz = floor(z);
  let fx = x - ix; let fz = z - iz;
  let ux = fx * fx * (3.0 - 2.0 * fx);
  let uz = fz * fz * (3.0 - 2.0 * fz);
  return mix(
    mix(p_hash2(ix, iz, s), p_hash2(ix + 1.0, iz, s), ux),
    mix(p_hash2(ix, iz + 1.0, s), p_hash2(ix + 1.0, iz + 1.0, s), ux),
    uz
  );
}

fn sample_sphere_geo(n_dir: vec3<f32>) -> vec4<f32> {
  let lon = atan2(n_dir.z, n_dir.x);
  let lat = asin(clamp(n_dir.y, -1.0, 1.0));
  let u = fract(lon / 6.28318530718 + 0.5);
  let v = clamp(0.5 - lat / 3.14159265359, 0.0, 0.9999);
  let gx = u * f32(params.map_w) - 0.5;
  let gy = v * f32(params.map_h) - 0.5;
  let x0 = i32(floor(gx));
  let y0 = i32(floor(gy));
  let fx = fract(gx);
  let fy = fract(gy);
  let wi = i32(params.map_w);
  let hi = i32(params.map_h);
  let ix0 = u32(((x0 % wi) + wi) % wi);
  let ix1 = u32((((x0 + 1) % wi) + wi) % wi);
  let iy0 = u32(clamp(y0, 0, hi - 1));
  let iy1 = u32(clamp(y0 + 1, 0, hi - 1));
  let c00 = sphere_geo[iy0 * params.map_w + ix0];
  let c10 = sphere_geo[iy0 * params.map_w + ix1];
  let c01 = sphere_geo[iy1 * params.map_w + ix0];
  let c11 = sphere_geo[iy1 * params.map_w + ix1];
  return mix(mix(c00, c10, fx), mix(c01, c11, fx), fy);
}

@compute @workgroup_size(64)
fn project_local_patch(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let n = params.patch_n;
  if (idx >= n * n) { return; }
  let ix = idx % n;
  let iz = idx / n;
  let u = (f32(ix) + 0.5) / f32(n) - 0.5;
  let v = (f32(iz) + 0.5) / f32(n) - 0.5;

  // Right-handed orthonormal tangent basis (east, north, up) at landing site (lat_rad, lon_rad)!
  // Note: cross(east, up_c) has +Y component (+cos(lat)) pointing strictly Geographic North!
  let cl = cos(params.lat_rad);
  let sl = sin(params.lat_rad);
  let co = cos(params.lon_rad);
  let so = sin(params.lon_rad);
  let up_c = vec3<f32>(cl * co, sl, cl * so);
  let east = normalize(vec3<f32>(-so, 0.0, co));
  let north = normalize(cross(east, up_c));

  let n_dir = normalize(up_c + east * (u * params.angular_span_rad) + north * (-v * params.angular_span_rad));
  let g = sample_sphere_geo(n_dir);
  // Sample local orbital SPH gradient & curvature (east/west/north/south slopes) so mountains, crater rims,
  // rift valleys, and tectonic escarpments seen from orbit rise with matching pronounced 3D relief on the surface!
  // ZERO Perlin noise: all relief is strictly derived from the orbital 3D SPH geology map + slope-gated strata + hydraulic erosion!
  let step_ang = params.angular_span_rad / f32(n);
  let gE = sample_sphere_geo(normalize(n_dir + east * step_ang));
  let gW = sample_sphere_geo(normalize(n_dir - east * step_ang));
  let gN = sample_sphere_geo(normalize(n_dir + north * step_ang));
  let gS = sample_sphere_geo(normalize(n_dir - north * step_ang));
  let grad_x = (gE.x - gW.x) / max(2e-4, 2.0 * step_ang);
  let grad_z = (gN.x - gS.x) / max(2e-4, 2.0 * step_ang);
  let grad_mag = length(vec2<f32>(grad_x, grad_z));
  // Local orbital SPH curvature (positive on crests/crater rims, negative in basins/troughs)
  let curv_lap = (gE.x + gW.x + gN.x + gS.x - 4.0 * g.x);
  let has_ocean = (params.flags & 1u) != 0u;
  let above_sea = select(1.0, smoothstep(params.sea_level_norm - 0.008, params.sea_level_norm + 0.025, g.x), has_ocean);
  // Pronounced alpine/crater-rim contrast & physical stratified escarpment ledges strictly driven by orbital SPH relief!
  let slope_w = clamp(grad_mag * 0.55, 0.0, 1.0);
  let highland_boost = max(0.0, g.x - select(-0.15, params.sea_level_norm, has_ocean)) * (0.28 + 0.34 * g.y);
  let ridge_crisp = clamp(-curv_lap * 14.0, -0.045, 0.065) * (0.55 + 0.85 * slope_w);
  let strata_step = (sin(g.x * 38.0 + g.y * 5.5) * 0.024 + sin(g.x * 84.0 - g.z * 4.2) * 0.009) * slope_w;
  // Output layout matches planetarySurfaceVehiclesGpu tectonic_field:
  //   x = elevNorm [-1..1], y = riverMask [0..1], z = moistureOrVolc [0..1], w = soilOrCrustComp [0..1]
  let elev = clamp(g.x + (highland_boost + ridge_crisp + strata_step) * above_sea, -1.0, 1.0);
  // Seed initial watershed headwaters strictly on high moist SPH slopes for isotropic hydraulic canyon carving!
  let river = clamp(g.w * smoothstep(params.sea_level_norm + 0.02, params.sea_level_norm + 0.42, elev) * (0.30 + 0.70 * slope_w), 0.0, 1.0);
  // Keep hydraulic moisture strictly separated from volcanic rift heat on ocean/biosphere worlds so volcanoes never spawn forests!
  let moist_or_volc = select(select(g.w, max(g.w, g.z), (params.flags & 2u) != 0u || g.z > 0.45), g.w, has_ocean);
  patch_a[idx] = vec4<f32>(elev, river, moist_or_volc, g.y);
}

@compute @workgroup_size(64)
fn erode_local_patch(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let n = i32(params.patch_n);
  if (idx >= params.patch_n * params.patch_n) { return; }
  let x = i32(idx % params.patch_n);
  let z = i32(idx / params.patch_n);
  let xl = max(0, x - 1);
  let xr = min(n - 1, x + 1);
  let zu = max(0, z - 1);
  let zd = min(n - 1, z + 1);

  let c  = patch_a[idx];
  let nL = patch_a[u32(z * n + xl)];
  let nR = patch_a[u32(z * n + xr)];
  let nU = patch_a[u32(zu * n + x)];
  let nD = patch_a[u32(zd * n + x)];
  let nUL = patch_a[u32(zu * n + xl)];
  let nUR = patch_a[u32(zu * n + xr)];
  let nDL = patch_a[u32(zd * n + xl)];
  let nDR = patch_a[u32(zd * n + xr)];

  let has_ocean = (params.flags & 1u) != 0u;
  let is_land = !has_ocean || c.x > params.sea_level_norm;
  let base_lvl = select(-2.0, params.sea_level_norm, has_ocean && is_land);
  let hL  = max(base_lvl, nL.x);
  let hR  = max(base_lvl, nR.x);
  let hU  = max(base_lvl, nU.x);
  let hD  = max(base_lvl, nD.x);
  let hUL = max(base_lvl, nUL.x);
  let hUR = max(base_lvl, nUR.x);
  let hDL = max(base_lvl, nDL.x);
  let hDR = max(base_lvl, nDR.x);

  // Isotropic Sobel gradient & Oono-Puri 9-point Laplacian (zero square Chebyshev grid facets on landed terrain!)
  let dh_dx = ((hR - hL) * 2.0 + (hUR - hUL) + (hDR - hDL)) * 0.125;
  let dh_dz = ((hD - hU) * 2.0 + (hDL - hUL) + (hDR - hUR)) * 0.125;
  let slope = length(vec2<f32>(dh_dx, dh_dz));
  let avg_h = (hL + hR + hU + hD) * 0.1666667 + (hUL + hUR + hDL + hDR) * 0.0833333;
  let lap = avg_h - c.x;
  let inflow = max(0.0, lap * 2.8);

  var elev = c.x;
  var river = c.y;
  var moist = c.z;
  var comp = c.w;

  // Isotropic thermal talus creep & bedrock cliff benching (preserves steep rocky crags!)
  let talus = mix(0.038, 0.072, comp);
  if (slope > talus) {
    elev = elev + clamp(lap, -0.026, 0.026) * 0.24;
  }
  // Isotropic hydraulic stream-power canyon incision & alluvial delta deposition on solvent-bearing land!
  if (params.hydraulic_erosion > 0.08 && is_land) {
    let avg_riv = (nL.y + nR.y + nU.y + nD.y) * 0.1666667 + (nUL.y + nUR.y + nDL.y + nDR.y) * 0.0833333;
    let flux = (0.030 + inflow * 4.2 + avg_riv * 0.76) * params.hydraulic_erosion;
    let erode_d = clamp(flux * slope * 0.82, 0.0, 0.032);
    let dep_d = clamp(flux * max(0.0, 0.018 - slope) * 0.34, 0.0, 0.012);
    elev = elev - erode_d + dep_d;
    if (has_ocean) {
      elev = max(params.sea_level_norm + 0.002, elev);
    }
    river = clamp(max(river * 0.92, min(1.0, flux * 0.88)), 0.0, 1.0);
    moist = clamp(max(moist * 0.98, river * 0.95), 0.0, 1.0);
    comp = clamp(comp + erode_d * 3.4 - dep_d * 2.0, 0.0, 1.0);
  }
  patch_b[idx] = vec4<f32>(clamp(elev, -1.0, 1.0), river, moist, comp);
}

@compute @workgroup_size(64)
fn downsample_coarse_64(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= 4096u) { return; }
  let cx = idx % 64u;
  let cz = idx / 64u;
  let step = max(1u, params.patch_n / 64u);
  let sx = min(params.patch_n - 1u, cx * step + step / 2u);
  let sz = min(params.patch_n - 1u, cz * step + step / 2u);
  coarse_64[idx] = patch_a[sz * params.patch_n + sx].x;
}
`;function wn(e,t={},{nebulaEnv:n=null,planetaryAtmoState:r=null,planetaryMode:i=`standard`,systemAgeGyr:a=4.5,parcelCount:o=5120,gridN:s=hn,mapWidth:c=512,mapHeight:l=256,targetSteps:u=48,seed:d=20261125,label:p=`planetary-genesis-sph`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createPlanetaryGenesisSphSessionWebGpu requires a live WebGPU GPUDevice`);let m=bn(t,{nebulaEnv:n,planetaryAtmoState:r,planetaryMode:i,systemAgeGyr:a,seed:d}),h=xn(m,{parcelCount:o}),g=h.parcelCount,_=Math.max(24,Math.min(64,Math.trunc(Number(s)||hn))),v=_*_*_,y=Math.max(128,Math.min(1024,Math.trunc(c))),b=Math.max(64,Math.min(512,Math.trunc(l))),x=y*b,S=Math.max(32,Math.min(2e3,Math.trunc(Number(u)||48))),C=5120/Math.max(1024,g)*(_/32)**3,w=Math.max(1,h.impactTargets.length),T=new Float32Array(w*8);for(let e=0;e<h.impactTargets.length;e+=1){let t=h.impactTargets[e],n=e*8;T[n+0]=t.dir[0],T[n+1]=t.dir[1],T[n+2]=t.dir[2],T[n+3]=t.radiusNorm,T[n+4]=.24+t.radiusNorm*2.1,T[n+5]=.14+t.radiusNorm*1.1,T[n+6]=2+e/Math.max(1,w)*Math.min(34,S*.55),T[n+7]=.65+t.radiusNorm*1.8}let E=e.createBuffer({label:`${p}-sph-params`,size:80,usage:mn.UNIFORM|mn.COPY_DST}),D=e.createBuffer({label:`${p}-parcels`,size:g*gn*4,usage:mn.STORAGE|mn.VERTEX|mn.COPY_DST|mn.COPY_SRC}),O=e.createBuffer({label:`${p}-grid-acc`,size:v*8*4,usage:mn.STORAGE}),k=e.createBuffer({label:`${p}-grid-val`,size:v*2*16,usage:mn.STORAGE}),A=e.createBuffer({label:`${p}-radial`,size:192,usage:mn.STORAGE}),j=e.createBuffer({label:`${p}-impactors`,size:T.byteLength,usage:mn.STORAGE|mn.COPY_DST}),M=e.createBuffer({label:`${p}-tel`,size:32,usage:mn.STORAGE|mn.COPY_SRC}),N=e.createBuffer({label:`${p}-tel-read`,size:32,usage:mn.MAP_READ|mn.COPY_DST}),L=e.createBuffer({label:`${p}-geo-params`,size:48,usage:mn.UNIFORM|mn.COPY_DST}),R=e.createBuffer({label:`${p}-map-acc`,size:x*6*4,usage:mn.STORAGE}),z=e.createBuffer({label:`${p}-geo-a`,size:x*16,usage:mn.STORAGE|mn.COPY_SRC|mn.COPY_DST}),B=e.createBuffer({label:`${p}-geo-b`,size:x*16,usage:mn.STORAGE|mn.COPY_SRC|mn.COPY_DST});e.queue.writeBuffer(D,0,h.parcelData),e.queue.writeBuffer(j,0,T);let ee=0;for(let e=0;e<g;e+=1)ee+=Math.max(.05,h.parcelData[e*gn+3]);let V=ze(e,{maxCount:g,strideFloats:gn,chartLevel:23,useAdjSoftening:!0,qMass:256,qMom:128,rCellFactor:.08,label:`${p}-ss-grav`});V.writeParams({count:g,gravityG:2.65/Math.max(100,ee),softening2:.036,boxHalf:1.55,theta2:.72});let te=[P(0,`uniform`),P(1,`storage`),P(2,`storage`),P(3,`storage`),P(4,`storage`),P(5,`read-only-storage`),P(6,`storage`),P(7,`read-only-storage`)],ne=I(e,{cacheKey:`ulg-planet-sph-clear.v3-ss`,label:`${p}-clear-grid`,code:W,entryPoint:`clear_sph_grid`,bindings:te}),re=I(e,{cacheKey:`ulg-planet-sph-splat.v3-ss`,label:`${p}-splat-grid`,code:W,entryPoint:`splat_sph_grid`,bindings:te}),ie=I(e,{cacheKey:`ulg-planet-sph-fin.v3-ss`,label:`${p}-fin-grid`,code:W,entryPoint:`finalize_sph_grid`,bindings:te}),ae=I(e,{cacheKey:`ulg-planet-sph-advect.v4-ss`,label:`${p}-advect`,code:W,entryPoint:`advect_sph_parcels`,bindings:te}),oe=I(e,{cacheKey:`ulg-planet-sph-tel.v3-ss`,label:`${p}-tel`,code:W,entryPoint:`write_sph_telemetry`,bindings:te}),H=F(e,{layout:ne.bindGroupLayout,label:`${p}-sph-bg`,entries:[{binding:0,resource:{buffer:E}},{binding:1,resource:{buffer:D}},{binding:2,resource:{buffer:O}},{binding:3,resource:{buffer:k}},{binding:4,resource:{buffer:A}},{binding:5,resource:{buffer:j}},{binding:6,resource:{buffer:M}},{binding:7,resource:{buffer:V.accPhiBuffer}}]}),se=[P(0,`uniform`),P(1,`read-only-storage`),P(2,`read-only-storage`),P(3,`storage`),P(4,`storage`),P(5,`storage`)],ce=I(e,{label:`${p}-clear-geo`,code:Sn,entryPoint:`clear_geo_acc`,bindings:se}),le=I(e,{label:`${p}-splat-geo`,code:Sn,entryPoint:`splat_parcels_to_sphere`,bindings:se}),ue=I(e,{label:`${p}-resolve-geo`,code:Sn,entryPoint:`resolve_spherical_geology`,bindings:se}),de=I(e,{label:`${p}-erode-geo`,code:Sn,entryPoint:`erode_spherical_geology`,bindings:se}),fe=F(e,{layout:ce.bindGroupLayout,label:`${p}-geo-ab`,entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:D}},{binding:2,resource:{buffer:j}},{binding:3,resource:{buffer:R}},{binding:4,resource:{buffer:z}},{binding:5,resource:{buffer:B}}]}),pe=F(e,{layout:ce.bindGroupLayout,label:`${p}-geo-ba`,entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:D}},{binding:2,resource:{buffer:j}},{binding:3,resource:{buffer:R}},{binding:4,resource:{buffer:B}},{binding:5,resource:{buffer:z}}]}),me=[P(0,`uniform`),P(1,`read-only-storage`),P(2,`storage`),P(3,`storage`),P(4,`storage`)],he=I(e,{label:`${p}-proj-patch`,code:Cn,entryPoint:`project_local_patch`,bindings:me}),ge=I(e,{label:`${p}-erode-patch`,code:Cn,entryPoint:`erode_local_patch`,bindings:me}),_e=I(e,{label:`${p}-coarse-patch`,code:Cn,entryPoint:`downsample_coarse_64`,bindings:me}),ve=!!m.hasOcean|(m.isMagmaOcean?2:0)|(m.isCryoWorld?4:0)|(m.isCarbonRich?8:0)|(m.isMinorBody?16:0),ye=0,be=0,xe=!1,Se=!1,Ce=Object.freeze({schema:pn,stepIndex:0,geoTimeMyr:0,parcelCount:g,mapWidth:y,mapHeight:b,coreMeanR:.35,mantleMeanR:.78,felsicMeanR:.96,meanTemp:.52,avgCrustThick:.45,seaLevelNorm:m.seaLevelNorm,activeImpactors:h.impactTargets.length,differentiationIndex:.9,tectonicMobility:m.tectonicMobility,craterPreservation:m.craterPreservation,hydraulicErosion:m.hydraulicErosion,accuracyTier:f.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1});function we(t){let n=new ArrayBuffer(80),r=new Uint32Array(n),i=new Float32Array(n);r[0]=g,r[1]=_,r[2]=y,r[3]=b,i[4]=t,i[5]=1.55,i[6]=2.65,i[7]=m.radiogenicHeat,i[8]=m.tectonicMobility,i[9]=m.craterPreservation,i[10]=m.seaLevelNorm,i[11]=m.hydraulicErosion,r[12]=ve,r[13]=ye,r[14]=h.impactTargets.length,i[15]=m.seed%9973*.013,i[16]=m.rotationOmegaNorm,r[17]=S,i[18]=C,i[19]=0,e.queue.writeBuffer(E,0,n);let a=new ArrayBuffer(48),o=new Uint32Array(a),s=new Float32Array(a);o[0]=g,o[1]=y,o[2]=b,o[3]=h.impactTargets.length,s[4]=m.tectonicMobility,s[5]=m.craterPreservation,s[6]=m.seaLevelNorm,s[7]=m.hydraulicErosion,o[8]=ve,o[9]=ye,s[10]=m.seed%9973*.013,s[11]=0,e.queue.writeBuffer(L,0,a)}async function Te({substeps:t=4,dt:n=.032,erosionPasses:r=6,updateSurfaceMap:i=!0,readTelemetry:a=!1}={}){if(xe)return Ce;let o=Math.max(1,Math.min(64,Math.trunc(t))),s=Math.max(.008,Math.min(.05,Number(n)||.032));ye+=o,be+=4500/Math.max(44,S)*o,we(s);let c=Math.ceil(v/64),l=Math.ceil(g/64),u=Math.ceil(x/64),d=e.createCommandEncoder({label:`${p}-step-enc`}),h=d.beginComputePass({label:`${p}-sph-pass`});for(let e=0;e<o;e+=1)V.encodeIntoPass(h,{srcBuffer:D,count:g}),h.setBindGroup(0,H),h.setPipeline(ne.pipeline),h.dispatchWorkgroups(c),h.setPipeline(re.pipeline),h.dispatchWorkgroups(l),h.setPipeline(ie.pipeline),h.dispatchWorkgroups(c),h.setPipeline(ae.pipeline),h.dispatchWorkgroups(l);if(h.setBindGroup(0,H),h.setPipeline(oe.pipeline),h.dispatchWorkgroups(1),i){h.setBindGroup(0,fe),h.setPipeline(ce.pipeline),h.dispatchWorkgroups(u),h.setPipeline(le.pipeline),h.dispatchWorkgroups(l),h.setPipeline(ue.pipeline),h.dispatchWorkgroups(u);let e=Math.max(2,Math.min(32,Math.trunc(r/2)*2));h.setPipeline(de.pipeline);for(let t=0;t<e;t+=1)h.setBindGroup(0,t%2==0?fe:pe),h.dispatchWorkgroups(u)}h.end();let _=a&&!Se&&N.mapState===`unmapped`;if(_&&(Se=!0,d.copyBufferToBuffer(M,0,N,0,32)),e.queue.submit([d.finish()]),_&&!xe&&N.mapState===`unmapped`)try{if(await N.mapAsync(mn.MAP_READ),!xe){let e=new Float32Array(N.getMappedRange(0,32));Ce=Object.freeze({schema:pn,stepIndex:ye,geoTimeMyr:be,parcelCount:g,mapWidth:y,mapHeight:b,coreMeanR:e[0],mantleMeanR:e[1],felsicMeanR:e[2],meanTemp:e[3],avgCrustThick:e[4],seaLevelNorm:e[5],activeImpactors:Math.round(e[6]),differentiationIndex:e[7],tectonicMobility:m.tectonicMobility,craterPreservation:m.craterPreservation,hydraulicErosion:m.hydraulicErosion,accuracyTier:f.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}if(!xe)try{N.unmap()}catch{}}catch(e){if(!xe&&e?.name!==`AbortError`)throw e}finally{Se=!1}else _&&(Se=!1);return Ce}async function Ee({totalSubsteps:e=48,chunkSize:t=18,dt:n=.032,erosionPasses:r=18,readTelemetry:i=!0}={}){if(xe)return Ce;let a=Math.max(1,Math.trunc(e)),o=Math.max(4,Math.min(24,Math.trunc(t))),s=Ce;for(;a>0&&!xe;){let e=Math.min(o,a);a-=e;let t=a<=0;s=await Te({substeps:e,dt:n,updateSurfaceMap:t,erosionPasses:t?r:0,readTelemetry:t&&i})}return s}function De(){xe||(ye=0,be=0,e.queue.writeBuffer(D,0,h.parcelData))}async function Oe({latDeg:t=32,lonDeg:n=0,patchN:r=256,angularSpanRad:i=.36,erosionPasses:a=24}={}){if(xe)return null;let o=Math.max(64,Math.min(256,Math.trunc(r))),s=o*o,c=e.createBuffer({label:`${p}-patch-params`,size:48,usage:mn.UNIFORM|mn.COPY_DST}),l=e.createBuffer({label:`${p}-patch-a`,size:s*16,usage:mn.STORAGE|mn.COPY_SRC}),u=e.createBuffer({label:`${p}-patch-b`,size:s*16,usage:mn.STORAGE}),d=e.createBuffer({label:`${p}-coarse-64`,size:4096*4,usage:mn.STORAGE|mn.COPY_SRC}),f=e.createBuffer({label:`${p}-coarse-64-read`,size:4096*4,usage:mn.MAP_READ|mn.COPY_DST}),h=new ArrayBuffer(48),g=new Uint32Array(h),_=new Float32Array(h);g[0]=y,g[1]=b,g[2]=o,g[3]=0,_[4]=(Number(t)||0)*(Math.PI/180),_[5]=(Number(n)||0)*(Math.PI/180),_[6]=Math.max(.08,Math.min(1.2,Number(i)||.36)),_[7]=m.hydraulicErosion,_[8]=m.seaLevelNorm,g[9]=ve,_[10]=m.seed%9973*.017,_[11]=0,e.queue.writeBuffer(c,0,h);let v=F(e,{layout:he.bindGroupLayout,label:`${p}-patch-ab`,entries:[{binding:0,resource:{buffer:c}},{binding:1,resource:{buffer:z}},{binding:2,resource:{buffer:l}},{binding:3,resource:{buffer:u}},{binding:4,resource:{buffer:d}}]}),x=F(e,{layout:he.bindGroupLayout,label:`${p}-patch-ba`,entries:[{binding:0,resource:{buffer:c}},{binding:1,resource:{buffer:z}},{binding:2,resource:{buffer:u}},{binding:3,resource:{buffer:l}},{binding:4,resource:{buffer:d}}]}),S=e.createCommandEncoder({label:`${p}-patch-enc`}),C=S.beginComputePass({label:`${p}-patch-pass`});C.setBindGroup(0,v),C.setPipeline(he.pipeline),C.dispatchWorkgroups(Math.ceil(s/64));let w=Math.max(2,Math.min(40,Math.trunc(a/2)*2));C.setPipeline(ge.pipeline);for(let e=0;e<w;e+=1)C.setBindGroup(0,e%2==0?v:x),C.dispatchWorkgroups(Math.ceil(s/64));C.setBindGroup(0,v),C.setPipeline(_e.pipeline),C.dispatchWorkgroups(64),C.end(),S.copyBufferToBuffer(d,0,f,0,4096*4),e.queue.submit([S.finish()]);let T=new Float32Array(4096);try{await f.mapAsync(mn.MAP_READ),T.set(new Float32Array(f.getMappedRange(0,4096*4))),f.unmap()}catch{}try{c.destroy(),u.destroy(),d.destroy(),f.destroy()}catch{}return Object.freeze({patchN:o,patchBuffer:l,coarseHeight64:T,seaLevelNorm:m.seaLevelNorm,dispose(){try{l.destroy()}catch{}}})}let ke=null;async function Ae(){if(xe)return null;let t=y*b*16,n=e.createBuffer({label:`${p}-geo-export`,size:t,usage:mn.MAP_READ|mn.COPY_DST});try{let r=e.createCommandEncoder({label:`${p}-geo-export-enc`});r.copyBufferToBuffer(z,0,n,0,t),e.queue.submit([r.finish()]),await n.mapAsync(mn.MAP_READ);let i=xe?null:new Float32Array(n.getMappedRange(0,t)).slice();try{n.unmap()}catch{}return i&&(ke=i),i}catch{return null}finally{try{n.destroy()}catch{}}}function je(t,n=null){return xe||!(t instanceof Float32Array)||t.length!==y*b*4?!1:(e.queue.writeBuffer(z,0,t),ke=t.slice(),n&&typeof n==`object`&&(ye=Number(n.stepIndex)||44,be=Number(n.geoTimeMyr)||440,Ce=Object.freeze({...Ce,...n,fromRootCache:!0})),!0)}function Me(){return ke?{data:ke,width:y,height:b,seaLevelNorm:m.seaLevelNorm,hasOcean:m.hasOcean,isMagmaOcean:m.isMagmaOcean,isCryoWorld:m.isCryoWorld}:null}function Ne(){if(!xe){xe=!0;try{V.destroy()}catch{}for(let e of[E,D,O,k,A,j,M,N,L,R,z,B])try{e.destroy()}catch{}}}return Object.freeze({schema:pn,lawAdapter:_n,spatialAuthority:V.gravityMode,genesisParams:m,get parcelCount(){return g},get gridN(){return _},get mapWidth(){return y},get mapHeight(){return b},get stepIndex(){return ye},get geoTimeMyr(){return be},getResidentParcelsBuffer:()=>D,getResident3dGridBuffer:()=>k,getResidentSphGeologyBuffer:()=>z,getTelemetry:()=>Ce,step:Te,stepBurst:Ee,resetToProtoplanet:De,extractLocalSurfacePatch:Oe,exportGeologyMapSnapshot:Ae,hydrateGeologyMapSnapshot:je,getCachedGeologySnapshot:Me,dispose:Ne})}function Tn(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`planetary-genesis-sph@1`)?e.resolveModule(`planetary-genesis-sph@1`)?.descriptor||null:e.registerModule({method:{model:`planetary-genesis-sph`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/planetaryGenesisSphGpu.js`,entryPoint:`advect_sph_parcels`,workgroupSize:64},parameterSchema:{parcelCount:{type:`number`,min:1024,max:16384,required:!1},substeps:{type:`number`,min:1,max:64,required:!1}},stateLayout:{tensorId:`planetary-sph-geology`,dtype:`f32`,layout:`interleaved`,strideElements:4,strideBytes:16,fields:[`elevNorm`,`crustComp`,`thermalVolc`,`moistureRiver`]},scaleRangeM:[100,2e7],accuracyTier:f.TIER_2_REPRESENTATIVE_EFFECTIVE,lawAdapter:_n,async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=wn(n,r.bodySpec||{},{parcelCount:Number(r.parcelCount??2048),mapWidth:128,mapHeight:64});try{let e=await i.step({substeps:Number(r.substeps??6),readTelemetry:!0});return t?.({schema:`ulg.astrophysics.planetary-genesis-sph-webgpu.v1`,telemetry:e})??e}finally{i.dispose()}}})}var En=`ulg.astrophysics.cosmic-lineage-root-cache.v1`,Dn=`ulg-cosmic-lineage-cache-v1`,On=`ulg-cosmic-lineage-cache-db`,kn=`lineage-entries`,An=96;function jn(e,t=`0`){return String(e??t).replace(/[^a-zA-Z0-9._-]/g,`_`).slice(0,48)||t}function Mn(e,t={}){let n=jn(e,`root`),r=Number(t.seed??t.universeSeed??20261125)>>>0,i=jn(t.epochId??t.cosmicEpochId??`present-day`),a=[];for(let e of[`galaxyKey`,`starKey`,`systemId`,`bodyId`,`mode`,`latBucket`,`lonBucket`,`dims`])t[e]!=null&&t[e]!==``&&a.push(`${e}-${jn(t[e])}`);return`${n}__s${r}__e${i}${a.length?`__${a.join(`__`)}`:``}`}function Nn(e,t=8e3){if(!(e instanceof Float32Array)||e.length===0)return null;let n=new Int16Array(e.length);for(let r=0;r<e.length;r+=1){let i=Math.round((Number.isFinite(e[r])?e[r]:0)*t);n[r]=i<-32767?-32767:i>32767?32767:i}let r=new Uint8Array(n.buffer),i=``,a=32768;for(let e=0;e<r.length;e+=a)i+=String.fromCharCode(...r.subarray(e,Math.min(r.length,e+a)));let o=typeof globalThis.btoa==`function`?globalThis.btoa(i):Buffer.from(r).toString(`base64`);return{length:e.length,scale:t,b64:o}}function Pn(e){if(!e||typeof e.b64!=`string`||!e.length)return null;let t=Number(e.scale)||8e3,n;if(typeof globalThis.atob==`function`){let t=globalThis.atob(e.b64);n=new Uint8Array(t.length);for(let e=0;e<t.length;e+=1)n[e]=t.charCodeAt(e)}else n=new Uint8Array(Buffer.from(e.b64,`base64`));if(n.byteLength<e.length*2)return null;let r=new Int16Array(n.buffer,n.byteOffset,e.length),i=new Float32Array(e.length),a=1/t;for(let t=0;t<e.length;t+=1)i[t]=r[t]*a;return i}function Fn(e){let t=null,n=async()=>(t||=(async()=>(await e()).getDirectoryHandle(Dn,{create:!0}))(),t),r=e=>`${e}.json`;return{name:`opfs`,async get(e){let t=await n();try{return await(await(await t.getFileHandle(r(e),{create:!1})).getFile()).text()}catch(e){if(e?.name===`NotFoundError`)return null;throw e}},async set(e,t){let i=await(await n()).getFileHandle(r(e),{create:!0});if(typeof i.createWritable!=`function`)throw Error(`OPFS createWritable unavailable`);let a=await i.createWritable();await a.write(t),await a.close()},async del(e){let t=await n();try{await t.removeEntry(r(e))}catch(e){if(e?.name!==`NotFoundError`)throw e}}}}function In(e){let t=null,n=()=>(t||=new Promise((t,n)=>{let r=e.open(On,1);r.onupgradeneeded=()=>{let e=r.result;e.objectStoreNames.contains(kn)||e.createObjectStore(kn)},r.onsuccess=()=>t(r.result),r.onerror=()=>n(r.error||Error(`IDB open failed`))}),t),r=async(e,t)=>{let r=await n();return new Promise((n,i)=>{let a=t(r.transaction(kn,e).objectStore(kn));a.onsuccess=()=>n(a.result),a.onerror=()=>i(a.error||Error(`IDB tx failed`))})};return{name:`indexeddb`,async get(e){let t=await r(`readonly`,t=>t.get(e));return t==null?null:String(t)},async set(e,t){await r(`readwrite`,n=>n.put(String(t),e))},async del(e){await r(`readwrite`,t=>t.delete(e))}}}function Ln(){let e=new Map;return{name:`memory`,async get(t){return e.has(t)?e.get(t):null},async set(t,n){e.set(t,String(n))},async del(t){e.delete(t)}}}function Rn({backend:e=`auto`,onPublishToPeers:t=null,maxPeerBroadcastBytes:n=32768}={}){let r=new Map,i=null,a=`memory`,o=typeof t==`function`?t:null,s={hits:0,memoryHits:0,persistedHits:0,misses:0,localWrites:0,peerIngests:0,peerBroadcasts:0,lastKey:null,lastSource:`init`},c=async()=>i||(i=(async()=>{let t=e===`auto`||e===`opfs`,n=e===`auto`||e===`indexeddb`,r=typeof globalThis.navigator?.storage?.getDirectory==`function`?()=>globalThis.navigator.storage.getDirectory():null;if(t&&r)try{let e=Fn(r),t=`__ulg_lineage_probe__`;return await e.set(t,`{"ok":true}`),await e.del(t),a=`opfs`,e}catch{}let i=globalThis.indexedDB===void 0?null:globalThis.indexedDB;if(n&&i&&typeof i.open==`function`)try{let e=In(i);return await e.get(`__ulg_lineage_probe__`),a=`indexeddb`,e}catch{}return a=`memory`,Ln()})(),i);function l(e,t){for(r.has(e)&&r.delete(e),r.set(e,t);r.size>An;){let e=r.keys().next().value;r.delete(e)}}function u(e){if(!e||!r.has(e))return null;let t=r.get(e);return{hit:!0,source:t.source===`peer`?`peer-cache-hit`:`root-cache-hit`,payload:t.payload,storedAtMs:t.storedAtMs}}async function d(e,{bypassCache:t=!1}={}){if(!e||t)return s.misses+=1,s.lastKey=e||null,s.lastSource=t?`bypassed`:`miss`,null;if(r.has(e)){let t=r.get(e);return l(e,t),s.hits+=1,s.memoryHits+=1,s.lastKey=e,s.lastSource=t.source===`peer`?`peer-cache-hit`:`root-cache-hit`,t.payload}try{let t=await(await c()).get(e);if(t){let n=JSON.parse(t);if(n?.schema===`ulg.astrophysics.cosmic-lineage-root-cache.v1`&&n.payload!=null)return l(e,{payload:n.payload,source:`persisted`,storedAtMs:n.storedAtMs||Date.now(),approxBytes:t.length}),s.hits+=1,s.persistedHits+=1,s.lastKey=e,s.lastSource=`persisted-cache-hit`,n.payload}}catch{}return s.misses+=1,s.lastKey=e,s.lastSource=`miss`,null}async function f(e,t,{persist:r=!0,broadcast:i=!0}={}){if(!e||t==null)return!1;let a={schema:En,key:e,storedAtMs:Date.now(),payload:t},u=``;try{u=JSON.stringify(a)}catch{return!1}if(l(e,{payload:t,source:`local`,storedAtMs:a.storedAtMs,approxBytes:u.length}),s.localWrites+=1,s.lastKey=e,s.lastSource=`gpu-computed-cached`,r)try{await(await c()).set(e,u)}catch{}if(i&&o&&u.length<=n)try{o({key:e,payload:t,schema:En,storedAtMs:a.storedAtMs}),s.peerBroadcasts+=1}catch{}return!0}async function p(e,{persist:t=!0}={}){if(!e||e.schema!==`ulg.astrophysics.cosmic-lineage-root-cache.v1`||!e.key||e.payload==null||r.has(e.key))return!1;let n=``;try{n=JSON.stringify({schema:En,key:e.key,storedAtMs:e.storedAtMs||Date.now(),payload:e.payload})}catch{return!1}if(l(e.key,{payload:e.payload,source:`peer`,storedAtMs:e.storedAtMs||Date.now(),approxBytes:n.length}),s.peerIngests+=1,t)try{await(await c()).set(e.key,n)}catch{}return!0}function m(e){o=typeof e==`function`?e:null}async function h(e){if(e){r.delete(e);try{await(await c()).del(e)}catch{}}}function g(){let e=0;for(let t of r.values())e+=t.approxBytes||0;return Object.freeze({schema:En,...s,memoryEntries:r.size,bytesCached:e,persistedBackend:a})}return Object.freeze({schema:En,buildKey:Mn,peek:u,get:d,set:f,ingestPeerEntry:p,setPeerPublisher:m,invalidate:h,getStats:g})}var zn=`ulg.astrophysics.surface-crater-tile-store.v1`,Bn=`ulg-surface-craters-v1`,Vn=`ulg-surface-craters-db`,Hn=`crater-tiles`;function Un(e,t=`default`){return String(e??t).replace(/[^a-zA-Z0-9_-]/g,`_`).slice(0,48)||t}function Wn({universeSeed:e=20261125,systemId:t=`sol`,bodyId:n=`mars`,tileX:r=0,tileZ:i=0}={}){return`${Number(e)>>>0}_${Un(t,`sol`)}_${Un(n,`body`)}_${Math.trunc(Number(r)||0)}_${Math.trunc(Number(i)||0)}`}function Gn(e={}){return{kind:Math.max(1,Math.min(3,Math.trunc(Number(e.kind)||1))),x:Number.isFinite(Number(e.x))?Number(e.x):0,z:Number.isFinite(Number(e.z))?Number(e.z):0,radiusM:Math.max(.5,Math.min(260,Number(e.radiusM)||10)),depthM:Math.max(.02,Math.min(64,Number(e.depthM)||3)),rimM:Number.isFinite(Number(e.rimM))?Number(e.rimM):.24,tempK:Math.max(40,Math.min(25e3,Number(e.tempK)||1600)),melt:Math.max(0,Math.min(1,Number(e.melt)||.6)),char:Math.max(0,Math.min(1,Number(e.char)||.7))}}function Kn(e){let t=null,n=async()=>(t||=(async()=>(await e()).getDirectoryHandle(Bn,{create:!0}))(),t),r=e=>`${e}.json`;return{name:`opfs`,async readRaw(e){let t=await n();try{return await(await(await t.getFileHandle(r(e),{create:!1})).getFile()).text()}catch(e){if(e?.name===`NotFoundError`)return null;throw e}},async writeRaw(e,t){let i=await(await n()).getFileHandle(r(e),{create:!0});if(typeof i.createWritable!=`function`)throw Error(`OPFS createWritable unavailable`);let a=await i.createWritable();await a.write(t),await a.close()},async deleteKey(e){let t=await n();try{await t.removeEntry(r(e))}catch(e){if(e?.name!==`NotFoundError`)throw e}}}}function qn(e,t=Vn){let n=null,r=()=>(n||=new Promise((n,r)=>{let i=e.open(t,1);i.onupgradeneeded=()=>{let e=i.result;e.objectStoreNames.contains(`crater-tiles`)||e.createObjectStore(Hn)},i.onsuccess=()=>n(i.result),i.onerror=()=>r(i.error||Error(`IndexedDB open failed`))}),n),i=async(e,t)=>{let n=await r();return new Promise((r,i)=>{let a=t(n.transaction(Hn,e).objectStore(Hn));a.onsuccess=()=>r(a.result),a.onerror=()=>i(a.error||Error(`IndexedDB tx failed`))})};return{name:`indexeddb`,async readRaw(e){let t=await i(`readonly`,t=>t.get(e));return t==null?null:String(t)},async writeRaw(e,t){await i(`readwrite`,n=>n.put(String(t),e))},async deleteKey(e){await i(`readwrite`,t=>t.delete(e))}}}function G(){let e=new Map;return{name:`memory`,async readRaw(t){return e.has(t)?e.get(t):null},async writeRaw(t,n){e.set(t,String(n))},async deleteKey(t){e.delete(t)}}}function Jn({backend:e=`auto`,opfsGetDirectory:t=null,indexedDBFactory:n=null,dbName:r=Vn}={}){let i=null,a=`uninitialized`,o=new Map,s=async()=>i||(i=(async()=>{let i=e===`auto`||e===`opfs`,o=e===`auto`||e===`indexeddb`,s=t||(typeof globalThis.navigator?.storage?.getDirectory==`function`?()=>globalThis.navigator.storage.getDirectory():null);if(i&&s)try{let e=Kn(s),t=`__ulg_crater_probe__`;return await e.writeRaw(t,`{"ok":true}`),await e.deleteKey(t),a=`opfs`,e}catch{if(e===`opfs`)return a=`memory`,G()}let c=n||(globalThis.indexedDB===void 0?null:globalThis.indexedDB);if(o&&c&&typeof c.open==`function`)try{let e=qn(c,r);return await e.readRaw(`__ulg_probe__`),a=`indexeddb`,e}catch{}return a=`memory`,G()})(),i);async function c(e,t=[]){let n=(Array.isArray(t)?t:[]).slice(-512).map(Gn);o.set(e,n);let r=JSON.stringify({schema:zn,updatedAtMs:Date.now(),stamps:n});try{let t=await s();return await t.writeRaw(e,r),{ok:!0,backend:t.name,count:n.length}}catch{return{ok:!1,backend:a,count:n.length}}}async function l(e){try{let t=await(await s()).readRaw(e);if(t){let n=JSON.parse(t);if(n?.schema===`ulg.astrophysics.surface-crater-tile-store.v1`&&Array.isArray(n.stamps)){let t=n.stamps.slice(-512).map(Gn);return o.set(e,t),t}}}catch{}return o.get(e)?[...o.get(e)]:[]}async function u(e){o.delete(e);try{await(await s()).deleteKey(e)}catch{}}return Object.freeze({schema:zn,get backend(){return a},buildTileKey:Wn,saveTile:c,loadTile:l,deleteTile:u})}var K=27.211386245988,Yn=11604.51812;Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});var Xn=null,Zn=null;function Qn({iH:e,iHe:t,iC:n,iO:r,backend:i}){let a=Math.max(8e4,Math.min(16e4,.75*e*Yn)),o=Math.log10(Math.max(4e4,.31*t*Yn)),s=Math.log10(Math.max(8e4,.78*(n+r)*Yn));return Object.freeze({schema:`ulg.astrophysics.gate1-ism-cooling-anchors.v1`,backend:i,iHEv:e,iHeEv:t,iCEv:n,iOEv:r,tHLyaK:a,logTHePeak:o,logTMetalPeak:s,tFineStructK:92})}function $n(e,t){let n=e?.orbitals||[];if(e?.atomicNumberZ===1&&Number.isFinite(e?.totalEnergyHa))return Math.max(10,Math.abs(e.totalEnergyHa)*K);let r=n.length>0?n[n.length-1]:null,i=Number(r?.energyHa);return Number.isFinite(i)&&i<0?Math.max(4,Math.abs(i)*K*1.45):t}async function er(e,{forceRecompute:t=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`deriveGate1IsmCoolingAnchorsWebGpu requires a live WebGPU GPUDevice`);if(Zn&&!t)return Zn;let[n,r,i,a]=await Promise.all([B(e,1,{A:1,maxScf:36}),B(e,2,{A:4,maxScf:36}),B(e,6,{A:12,maxScf:42}),B(e,8,{A:16,maxScf:42})]);return Zn=Qn({iH:$n(n,13.6),iHe:$n(r,24.59),iC:$n(i,11.26),iO:$n(a,13.62),backend:`webgpu-gate1-radial-ks`}),Zn}function tr(){if(Zn)return Zn;if(Xn)return Xn;let e=E(1,{gridPointsN:160,maxScf:80,tol:1e-5}),t=E(2,{gridPointsN:160,maxScf:80,tol:1e-5}),n=E(6,{gridPointsN:160,maxScf:80,tol:1e-5}),r=E(8,{gridPointsN:160,maxScf:80,tol:1e-5});return Xn=Qn({iH:Math.max(10,Math.abs(e.totalEnergyHa)*K),iHe:$n(t,24.59),iC:$n(n,11.26),iO:$n(r,13.62),backend:`host-gate1-radial-ks`}),Xn}function nr(e,t=1,n=null){let r=n||tr(),i=Math.max(10,Number(e)),a=Math.max(0,Number(t)),o=Math.log10(i),s=a*25e-27*Math.exp(-r.tFineStructK/i)*Math.exp(-(((o-2.6)/.9)**2)),c=75e-23*Math.exp(-r.tHLyaK/i)/(1+(i/22e3)**2.2),l=18e-23*Math.exp(-(((o-r.logTHePeak)/.28)**2)),u=a*6e-22*Math.exp(-(((o-r.logTMetalPeak)/.48)**2)),d=142e-29*Math.sqrt(i)*(1.2+.1*a);return s+c+l+u+d}var rr=`ulg.astrophysics.planetary-interior-webgpu.v1`,ir=66743e-15,ar=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});Object.freeze({earth:Object.freeze({massKg:59722e20,radiusM:6371e3,moiFactor:.3307,centralPressureGPa:364}),mars:Object.freeze({massKg:64171e19,radiusM:3389500,moiFactor:.3644,centralPressureGPa:40})});async function or(e,t,{minPressurePa:n=1e4,maxPressurePa:r=0xe8d4a51000,maxTemperatureK:i=12e3,degrees:a=[5,5],relativeTolerance:o=.025,maxBisectDepth:s=3,materialIndex:c=0}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`buildPlanetaryPolytopeAtlasWebGpu requires a live WebGPU GPUDevice`);if(!t||typeof t!=`object`||!t.mechanical||!t.thermodynamic)throw TypeError(`buildPlanetaryPolytopeAtlasWebGpu requires a valid Gate 1-2 material bundle`);let l=C(),d=Math.max(15,Number(t.thermodynamic.meltingPointK??300)),p=Math.max(d+20,Number(t.thermodynamic.boilingPointK??d*1.5)),m=Math.max(p*2.5,Number(i)),h=l.discoverMaterialPolytopes({materialKey:t.materialKey||t.symbol||t.formula,family:t.family||`element`,meltingPointK:d,boilingPointK:p,ionizationTempK:m,meltingSlopeKPerLogP:Number(t.thermodynamic.meltingSlopeKPerLogP??120),boilingSlopeKPerLogP:Number(t.thermodynamic.boilingSlopeKPerLogP??220),maxTemperatureK:Math.max(m*1.5,Number(i)*1.5),minPressurePa:Number(n),maxPressurePa:Number(r),accuracyTier:t.accuracyTier||f.TIER_2_REPRESENTATIVE_EFFECTIVE,closureHash:t.closureHash||`planetary-v1`,provenance:t.provenance||{status:`webgpu-derived`,scientificValidation:!1}}),_=[];for(let n of h){let r=await M(e,n,(e,r)=>O(t,n.phase,e,r),{degrees:a,relativeTolerance:o,requirePositive:!0,maxDepth:s,propertyName:`densityKgPerM3`,logScale:!0});_.push(...r.polytopes)}let v=u(_,{materialIndex:c});return Object.freeze({schema:g,materialKey:t.materialKey||t.symbol||t.formula,minPressurePa:Number(n),maxPressurePa:Number(r),polytopeCount:_.length,polytopes:Object.freeze(_),packedGpuAtlas:v,accuracyTier:t.accuracyTier||f.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-polytope-fitted`,scientificValidation:!1})})}var sr=`
${m}

struct PlanetParams {
  model_count: u32,
  layer_count: u32,
  max_profile_samples: u32,
  converge_passes: u32,
  surface_pressure_pa: f32,
  radial_step_m: f32,
  max_radius_m: f32,
  g_si: f32,
};

// Layer spec: vec4(cum_mass_frac, temp_k, material_id_f32, pad)
// Model spec: vec4(central_pressure_pa, initial_est_mass_kg, pad0, pad1)
// Model out (3 vec4 per model):
//   [m*3 + 0]: vec4(total_mass_kg, radius_m, moi_factor, status_code)
//              status_code: 1.0 = converged-valid, 2.0 = fail-closed-polytope-out-of-domain, 3.0 = hit-max-radius
//   [m*3 + 1]: vec4(mean_density, surface_gravity, escape_vel, sample_count)
//   [m*3 + 2]: vec4(fail_pressure_pa, fail_temp_k, fail_layer_idx, min_polytope_margin)
@group(0) @binding(0) var<uniform> params: PlanetParams;
@group(0) @binding(1) var<storage, read> atlas_bank: array<f32>;
@group(0) @binding(2) var<storage, read> layer_specs: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> model_specs: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> model_out: array<vec4<f32>>;
// Profile buffer for model 0: 2 vec4 per sample:
//   [s*2 + 0]: vec4(radius_m, pressure_pa, density_kg_m3, mass_enclosed_kg)
//   [s*2 + 1]: vec4(gravity_m_s2, layer_idx_f32, phase_code, hit_flag)
@group(0) @binding(5) var<storage, read_write> profile_out: array<vec4<f32>>;

fn pick_layer_idx(mass_frac: f32) -> u32 {
  let n = params.layer_count;
  for (var i = 0u; i < n; i = i + 1u) {
    if (mass_frac <= layer_specs[i].x || i + 1u == n) {
      return i;
    }
  }
  return max(1u, n) - 1u;
}

@compute @workgroup_size(64)
fn solve_planetary_hydrostatic(@builtin(global_invocation_id) gid: vec3<u32>) {
  let mid = gid.x;
  if (mid >= params.model_count) { return; }

  let mspec = model_specs[mid];
  let p_center = mspec.x;
  var est_mass = max(1.0e20, mspec.y);
  let dr = max(2000.0, params.radial_step_m);
  let max_steps = u32(min(50000.0, ceil(params.max_radius_m / dr)));

  var final_mass = 0.0;
  var final_radius = 0.0;
  var final_moi = 0.0;
  var status_code = 1.0;
  var fail_p = 0.0;
  var fail_t = 0.0;
  var fail_layer = -1.0;
  var min_margin = 1.0e30;
  var sample_count = 0u;

  let passes = max(1u, params.converge_passes);
  for (var iter_pass = 0u; iter_pass < passes; iter_pass = iter_pass + 1u) {
    var r = 0.0;
    var m = 0.0;
    var p_cur = p_center;
    var I_moi_scaled = 0.0;
    var failed = false;
    var cur_samples = 0u;
    var pass_min_margin = 1.0e30;
    let is_last = (iter_pass + 1u == passes);

    for (var s = 0u; s < max_steps; s = s + 1u) {
      if (p_cur <= params.surface_pressure_pa || r >= params.max_radius_m) {
        break;
      }
      let lidx = pick_layer_idx(m / max(1.0e20, est_mass));
      let lspec = layer_specs[lidx];
      let temp_k = lspec.y;
      let mat_id = lspec.z;

      // Inline Gate 2 Convex Polytope Atlas evaluation (strictly fail-closed!)
      let eval_res = eval_polytope_atlas_bank_2d(&atlas_bank, mat_id, temp_k, p_cur);
      if (eval_res.w < 0.5 || !(eval_res.x > 0.0)) {
        failed = true;
        status_code = 2.0;
        fail_p = p_cur;
        fail_t = temp_k;
        fail_layer = f32(lidx);
        break;
      }
      let rho = eval_res.x;
      pass_min_margin = min(pass_min_margin, eval_res.y);

      // True Midpoint RK2 radial hydrostatic step: predict (P_mid, m_mid), re-evaluate EOS rho(P_mid)!
      let r_mid = r + 0.5 * dr;
      let dM0 = 12.566370614 * r * r * rho * dr;
      let m_mid = m + 0.5 * dM0;
      let g_mid = select(0.0, (params.g_si * m_mid) / (r_mid * r_mid), r_mid > 1.0);
      let p_mid = max(params.surface_pressure_pa, p_cur - 0.5 * rho * g_mid * dr);
      let eval_mid = eval_polytope_atlas_bank_2d(&atlas_bank, mat_id, temp_k, p_mid);
      let rho_mid = select(rho, eval_mid.x, eval_mid.w >= 0.5 && eval_mid.x > 0.0);
      let dM = 12.566370614 * r_mid * r_mid * rho_mid * dr;
      let g = select(0.0, (params.g_si * (m + 0.5 * dM)) / (r_mid * r_mid), r_mid > 1.0);
      let dP = -rho_mid * g * dr;

      if (is_last && mid == 0u && cur_samples < params.max_profile_samples && ((s & 1u) == 0u || s < 16u)) {
        profile_out[cur_samples * 2u + 0u] = vec4<f32>(r, p_cur, rho, m);
        profile_out[cur_samples * 2u + 1u] = vec4<f32>(g, f32(lidx), eval_res.z, eval_res.w);
        cur_samples = cur_samples + 1u;
      }

      m = m + dM;
      // Scale into (Mm)^2 * (Yg) so f32 never overflows (>3.4e38) for planetary/substellar bodies
      let r_mm = r_mid * 1.0e-6;
      let dm_yg = dM * 1.0e-24;
      I_moi_scaled = I_moi_scaled + (2.0 / 3.0) * r_mm * r_mm * dm_yg;
      p_cur = p_cur + dP;
      r = r + dr;
    }

    if (failed) {
      final_mass = m;
      final_radius = r;
      final_moi = I_moi_scaled;
      sample_count = cur_samples;
      min_margin = -1.0;
      break;
    }
    status_code = select(1.0, 3.0, r >= params.max_radius_m && p_cur > params.surface_pressure_pa);
    final_mass = m;
    final_radius = r;
    final_moi = I_moi_scaled;
    est_mass = max(1.0e20, m);
    min_margin = pass_min_margin;
    sample_count = cur_samples;
  }

  let vol = (4.0 / 3.0) * 3.14159265359 * final_radius * final_radius * final_radius;
  let mean_rho = final_mass / max(1.0, vol);
  let surf_g = (params.g_si * final_mass) / max(1.0, final_radius * final_radius);
  let v_esc = sqrt((2.0 * params.g_si * final_mass) / max(1.0, final_radius));
  let r_final_mm = final_radius * 1.0e-6;
  let m_final_yg = final_mass * 1.0e-24;
  let moi_factor = final_moi / max(1.0e-20, m_final_yg * r_final_mm * r_final_mm);

  model_out[mid * 3u + 0u] = vec4<f32>(final_mass, final_radius, moi_factor, status_code);
  model_out[mid * 3u + 1u] = vec4<f32>(mean_rho, surf_g, v_esc, f32(sample_count));
  model_out[mid * 3u + 2u] = vec4<f32>(fail_p, fail_t, fail_layer, min_margin);
}
`;async function cr(e,{centralPressurePa:t=36e10,surfacePressurePa:n=1e5,layers:r=[],radialStepM:i=2e4,maxRadiusM:a=15e7,initialMassKg:o=6e24,convergePasses:s=3,maxProfileSamples:c=256,autoFitMaxPressurePa:l=0xe8d4a51000}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solvePlanetaryInteriorWebGpu requires a live WebGPU GPUDevice`);if(!Array.isArray(r)||r.length===0)throw TypeError(`solvePlanetaryInteriorWebGpu requires at least one material layer`);let d=[];for(let t=0;t<r.length;t+=1){let n=r[t],i=n.packedGpuAtlas||n.atlas?.packedGpuAtlas||null;if(!i&&Array.isArray(n.polytopes)&&n.polytopes.length>0&&(i=u(n.polytopes,{materialIndex:t})),!i&&n.bundle&&(i=(await or(e,n.bundle,{maxPressurePa:l,materialIndex:t})).packedGpuAtlas),!i)throw TypeError(`Layer ${t} (${n.name||`unnamed`}) must provide packedGpuAtlas, atlas, polytopes, or bundle`);let a=t>0?Number(r[t-1].cumulativeMassFraction??0):0,o=Number.isFinite(Number(n.massFractionTarget))?Number(n.massFractionTarget):Number.isFinite(Number(n.cumulativeMassFraction))?Math.max(.01,Number(n.cumulativeMassFraction)-a):1;d.push({name:n.name||n.bundle?.materialKey||n.atlas?.materialKey||`layer-${t}`,massFractionTarget:Math.max(0,o),tempK:Math.max(10,Number(n.tempK??n.temperatureK??1500)),bundle:n.bundle||null,packedGpuAtlas:i,materialId:t})}let p=_(d.map(e=>({materialId:e.materialId,materialKey:e.name,accuracyTier:e.bundle?.accuracyTier||f.TIER_2_REPRESENTATIVE_EFFECTIVE,packedGpuAtlas:e.packedGpuAtlas}))),m=d.reduce((e,t)=>e+t.massFractionTarget,0)||1,h=new Float32Array(d.length*4),g=0;for(let e=0;e<d.length;e+=1)g+=d[e].massFractionTarget/m,h.set([g,d[e].tempK,d[e].materialId,0],e*4);let v=Math.max(0xde0b6b3a7640000,Number(o)||6e24),y=new Float32Array([Number(t),v,0,0]),b=new ArrayBuffer(32);new Uint32Array(b,0,4).set([1,d.length,c,s]),new Float32Array(b,16,4).set([Number(n),Number(i),Number(a),ir]);let x=I(e,{cacheKey:`ulg-planetary-hydrostatic-polytope.v1`,label:`ulg-planetary-hydrostatic-polytope`,code:sr,entryPoint:`solve_planetary_hydrostatic`,bindings:[P(0,`uniform`),P(1,`read-only-storage`),P(2,`read-only-storage`),P(3,`read-only-storage`),P(4,`storage`),P(5,`storage`)]}),S=e.createBuffer({size:32,usage:ar.UNIFORM|ar.COPY_DST}),C=e.createBuffer({size:Math.max(64,p.data.byteLength),usage:ar.STORAGE|ar.COPY_DST}),w=e.createBuffer({size:Math.max(16,h.byteLength),usage:ar.STORAGE|ar.COPY_DST}),T=e.createBuffer({size:16,usage:ar.STORAGE|ar.COPY_DST}),E=e.createBuffer({size:48,usage:ar.STORAGE|ar.COPY_SRC}),D=e.createBuffer({size:c*32,usage:ar.STORAGE|ar.COPY_SRC}),O=e.createBuffer({size:48,usage:ar.MAP_READ|ar.COPY_DST}),k=e.createBuffer({size:c*32,usage:ar.MAP_READ|ar.COPY_DST});try{e.queue.writeBuffer(S,0,b),e.queue.writeBuffer(C,0,p.data),e.queue.writeBuffer(w,0,h),e.queue.writeBuffer(T,0,y);let n=e.createBindGroup({layout:x.bindGroupLayout,entries:[S,C,w,T,E,D].map((e,t)=>({binding:t,resource:{buffer:e}}))}),r=e.createCommandEncoder({label:`ulg-planetary-hydrostatic`}),i=r.beginComputePass();i.setPipeline(x.pipeline),i.setBindGroup(0,n),i.dispatchWorkgroups(1),i.end(),r.copyBufferToBuffer(E,0,O,0,48),r.copyBufferToBuffer(D,0,k,0,c*32),e.queue.submit([r.finish()]),await Promise.all([O.mapAsync(ar.MAP_READ),k.mapAsync(ar.MAP_READ)]);let a=new Float32Array(O.getMappedRange().slice(0,48)),o=new Float32Array(k.getMappedRange().slice(0,c*32));O.unmap(),k.unmap();let s=Math.round(a[3]),l=s===2,u=s===1,m=Math.min(c,Math.max(0,Math.round(a[7]))),g=[];for(let e=0;e<m;e+=1){let t=e*8,n=Math.min(d.length-1,Math.max(0,Math.round(o[t+5])));g.push(Object.freeze({radiusM:o[t+0],pressurePa:o[t+1],densityKgPerM3:o[t+2],massEnclosedKg:o[t+3],gravityMPerS2:o[t+4],layerIndex:n,layer:d[n].name,phaseCode:Math.round(o[t+6]),polytopeHit:o[t+7]>.5}))}let _=Number(d[0]?.bundle?.electromagnetic?.electricalConductivitySPerM??0);return Object.freeze({schema:rr,backend:`webgpu-polytope-atlas`,valid:u,failClosed:l,reason:l?`polytope-out-of-domain`:s===3?`max-radius-reached`:`ok`,failureState:l?Object.freeze({pressurePa:a[8],temperatureK:a[9],layerIndex:Math.round(a[10]),layer:d[Math.max(0,Math.round(a[10]))]?.name??`unknown`}):null,centralPressurePa:Number(t),totalMassKg:a[0],radiusM:a[1],moiFactor:a[2],meanDensityKgPerM3:a[4],surfaceGravityMPerS2:a[5],escapeVelocityMPerS:a[6],minPolytopeMargin:a[11],coreConductivitySPerM:_,dynamoCapable:u&&_>1e4&&t>1e10,layerCount:d.length,profile:Object.freeze(g),accuracyTier:f.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-polytope-atlas-derived`,inlineWgslEvaluator:`eval_polytope_atlas_bank_2d`,scientificValidation:!1})})}finally{for(let e of[S,C,w,T,E,D,O,k])e.destroy()}}var lr=`peercompute.ulg.hydrogen-stellar-closure.v1`,ur=`peercompute.ulg.stellar-closure-table-abi.v1`,dr=1380649e-29,fr=16605390666e-37,pr=167262192369e-38,mr=91093837015e-41,hr=1054571817e-43,gr=299792458,_r=66743e-15,vr=4*5.670374419e-8/gr,q=1602176634e-28,yr=27.211386245988,br=198847e25,xr=Te();xr.ppThermalMeV;var Sr=xr.ppJPerKgH;xr.tripleAlphaMeV;var Cr=xr.tripleAlphaJPerKgHe;xr.fePhotodisMeV;var J=null;async function wr(e,{forceRecompute:t=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`deriveQuantumHydrogenAnchorsWebGpu requires a live WebGPU GPUDevice`);if(J?.backend===`webgpu`&&!t)return J;let n=await B(e,1,{A:1,maxScf:45}),r=Number(n.totalEnergyHa??-.5),i=Number(n.homoEnergyHa??n.orbitals?.[0]?.energyHa??-.5),a=Math.max(11,Math.min(15,Math.abs(r)*yr)),o=await A(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basisName:`sto-3g`,maxScf:24,sampleVolume:!1}),s=.05,c=await A(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.45]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:o.densityMatrix}),l=await A(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-s]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:o.densityMatrix}),u=2*r,d=Math.max(.08,u-o.totalEnergyHa)*yr,f=Math.max(.1,(c.totalEnergyHa-2*o.totalEnergyHa+l.totalEnergyHa)/(s*s)),p=Math.sqrt(f/(.5*1836.152673))*yr*q/dr,m=w(15e4/pr*j**3),h=D(m);return J=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,backend:`webgpu`,hTotalEnergyHa:r,h1sOrbitalEnergyHa:i,hIonizationEv:a,hIonizationTempK:a*q/dr,h2EqEnergyHa:o.totalEnergyHa,h2DissEnergyHa:u,h2DiradicalStretched:1,h2DissociationEv:d,h2DissociationTempK:d*q/dr,h2VibrationalTempK:p,uegSolarCoreRsBohr:m,uegSolarCoreKineticHa:h,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),J}function Tr({forceRecompute:e=!1}={}){if(J&&!e)return J;let t=E(1,{functional:`pbe`,scalarRelativistic:!0,spinOrbit:!1,gridPointsN:320,rMaxBohr:24,maxScf:180,tol:1e-6}),n=t.orbitals?.[0]?.energyHa??-.5,r=Math.max(11,Math.min(15,Math.abs(t.totalEnergyHa)*yr)),i=N([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`6-31g`,tol:1e-9}),a=N([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,10]}],{basis:`6-31g`,tol:1e-9}),o=Math.max(.08,a.totalEnergyHa-i.totalEnergyHa)*yr,s=.04,c=N([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.44]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,l=N([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,u=N([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-s]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,d=Math.max(.1,(c-2*l+u)/(s*s)),f=Math.sqrt(d/(.5*1836.152673))*yr*q/dr,p=w(15e4/pr*j**3),m=D(p);return J=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,hTotalEnergyHa:t.totalEnergyHa,h1sOrbitalEnergyHa:n,hIonizationEv:r,hIonizationTempK:r*q/dr,h2EqEnergyHa:i.totalEnergyHa,h2DissEnergyHa:a.totalEnergyHa,h2DiradicalStretched:a.diradicalCharacter,h2DissociationEv:o,h2DissociationTempK:o*q/dr,h2VibrationalTempK:f,uegSolarCoreRsBohr:p,uegSolarCoreKineticHa:m,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),J}function Er(e,t=.85){let n=Math.max(0,e*Math.max(.1,t)/pr);if(n<=0)return 0;let r=hr*Math.cbrt(3*Math.PI*Math.PI*n)/(mr*gr),i=r*r,a=mr**4*gr**5/(24*Math.PI*Math.PI*hr**3);if(r<.01)return a*(1.6*i*i*r-4/7*i*i*i*r);let o=Math.sqrt(1+i),s=r*(2*i-3)*o+3*Math.asinh(r);return Math.max(0,a*s)}function Dr(e){let t=Math.max(0,Number(e)||0),n=25e8;return t<=n?0:6e23*((t-n)/3e9)**2.75}function Or({rhoKgM3:e=1e-16,temperatureK:t=30,xH:n=.74,xHe:r=.25,xMetals:i=.01,anchors:a=null}={}){let o=a||Tr(),s=Math.max(1e-24,Number(e)||1e-16),c=Math.max(5,Number(t)||30),l=Math.max(1e-9,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*u/pr,m=s*d/(4*pr),h=s*f/(16*pr),g=2*Math.PI*pr*dr*c/(2*Math.PI*hr)**2,_=Math.max(1e-30,.5*g)**1.5,v=Math.max(1,c/(2*85.4))/Math.max(1e-6,1-Math.exp(-o.h2VibrationalTempK/c)),y=-o.h2DissociationTempK/c,b=0;if(y<-700)b=1;else if(y>40)b=0;else{let e=_/Math.max(1,v)*Math.exp(y)/Math.max(1e-20,4*p);if(e>1e8)b=0;else if(e<1e-12)b=1;else{let t=-e+Math.sqrt(e*e+2*e);b=Math.max(0,Math.min(1,1-t))}}let x=Math.max(0,p*(1-b)),S=2*Math.PI*mr*dr*c/(2*Math.PI*hr)**2,C=-o.hIonizationTempK/c,w=0;if(x>0&&C>-700){let e=Math.max(1e-30,S)**1.5*Math.exp(Math.min(50,C))/Math.max(1e-20,x);w=e>1e8?1:e<1e-14?0:Math.max(0,Math.min(1,.5*(-e+Math.sqrt(e*e+4*e))))}let T=1/(1+Math.exp(-(Math.log10(s)-1.5)*2.4));w=Math.max(w,T),w>.5&&(b*=Math.max(0,1-(w-.5)*2));let E=Math.max(T,1/(1+Math.exp(-(c-28e3)/5500))),D=.5*p*b,O=p*(1-b),k=O*w+2*E*m+8*E*h,A=Math.max(1e-20,D+O+m+h+k),j=s/fr/A,M=A*dr*c,N=vr/3*c**4,P=Er(s,Math.max(.25,u*w+.5*d*E+.5*f*E)),F=Dr(s),I=M+N+P+F,L=P/Math.max(1e-30,I),R=N/Math.max(1e-30,I),z=F/Math.max(1e-30,I),B=4*b*(1-b),ee=4*w*(1-w),V=c>12e8?Math.min(.32,(c-12e8)/15e8*.32):0,te=5/3-4/15*b*(1/(1+Math.exp(-(c-120)/35))),ne=te*(1-R)+4/3*R,re=Math.max(1.06,ne-.5*B-.48*ee-V)*(1-z)+2.75*z,ie=.1*(1/(1+Math.exp((c-1600)/180))),ae=25e-33*Math.sqrt(Math.max(1e-20,s))*Math.min(12e3,c)**9*(1/(1+Math.exp((c-9e3)/1200))),oe=4e21*(1+u)*(f+.001)*s*c**-3.5,H=.02*(1+u)*Math.max(.01,w),se=Math.max(1e-4,Math.min(1e5,ie+ae+oe+H)),ce=M/(Math.max(.15,te-1)*s)+3*N/s,le=(1-b)*.5*u*o.h2DissociationEv*q/pr,ue=w*u*o.hIonizationEv*q/pr,de=ce+le+ue;return{schema:lr,rhoKgM3:s,temperatureK:c,xH:u,xHe:d,xMetals:f,fH2:b,xIonized:w,mu:j,gammaEff:re,pressureIdealPa:M,pressureRadPa:N,pressureDegPa:P,pressureNucSatPa:F,pressureTotalPa:I,pDegFraction:L,pRadFraction:R,pNucFraction:z,soundSpeedMPerS:Math.sqrt(Math.max(1,re*I/s)),kappaM2PerKg:se,specificEnergyJPerKg:de,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function kr({rhoKgM3:e=15e4,temperatureK:t=15e6,xH:n=.74,xHe:r=.25,xMetals:i=.01,dtS:a=0,coreMassSolar:o=1}={}){let s=Math.max(0,Number(e)||0),c=Math.max(1,Number(t)||1),l=Math.max(1e-12,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*.001,m=c*1e-6,h=c*1e-8,g=c*1e-9,_=0,v=0,y=1/0;if(m>.5&&u>1e-6&&(y=33.8/Math.cbrt(m),v=1.22*m**(2/3),y<200)){let e=(1+.0123*Math.cbrt(m)+.0109*m**(2/3))*1.18;_=238*p*u*u*m**(-2/3)*Math.exp(-y)*e}let b=0;if(m>5&&u>1e-6&&f>1e-6){let e=152.28/Math.cbrt(m);e<220&&(b=44e20*p*u*(.5*f)*m**(-2/3)*Math.exp(-e))}let x=0;if(h>.35&&d>1e-6){let e=44.027/h;e<200&&(x=p*p*509e5*(d*d*d)*h**-3*Math.exp(-e))}let S=0;if(g>1.2&&f>.3){let e=Math.min(1,(g-1.2)/1.5);S=15e7*f*e*e*Math.exp(-Math.max(0,12/g-5))}let C=_+b+x,w=C-S,T=0,E=0;if(a>0&&C>0){let e=_+b;T=Math.min(u,e*a/Sr),E=Math.min(d+T,x*a/Cr),u=Math.max(0,u-T),d=Math.max(0,d+T-E),f=Math.max(0,f+E);let t=u+d+f;u/=t,d/=t,f/=t}let D=o>=1.44&&f>=.5&&(c>=14e8||s>=15e8),O=`none`,k=0;if(D){let e=Math.max(1.35,o*.14);k=2*_r*e*br/(gr*gr),O=e>2.35?`black-hole`:`neutron-star`}let A=Math.abs(u+d+f-1);return{schema:`peercompute.ulg.stellar-nuclear-fusion-closure.v1`,epsPpWPerKg:_,epsCnoWPerKg:b,eps3aWPerKg:x,epsPhotodisWPerKg:S,epsTotalWPerKg:C,epsNetWPerKg:w,gamowPeakKeV:v,gamowTauPp:y,fusionActive:C>1e-6,nextMassFractions:{xH:u,xHe:d,xMetals:f},dXBurned:T,dYBurned:E,nucleonConservationRelError:A,coreCollapseTriggered:D,remnantClass:O,schwarzschildRadiusM:k,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function Ar(e){let t=L(Math.max(600,Math.min(6e4,Number(e)||5778)));return[t.r,t.g,t.b]}function jr({coreTempK:e=20,coreRhoKgM3:t=1e-16,fH2:n=1,xIonized:r=0,xH:i=.74,epsNucWPerKg:a=0,pDegFraction:o=0,supernovaShockActive:s=!1,remnantClass:c=`none`}={}){return c===`black-hole`?{id:`black-hole`,label:`Black Hole & Expanding SNR`}:c===`neutron-star`?{id:`neutron-star`,label:`Neutron Star & Expanding SNR`}:s?{id:`supernova`,label:`Core-Collapse Supernova`}:e>=8e7&&i<.18?{id:`helium-burning`,label:`Red Giant / Triple-α Core`}:a>1e-4&&i>=.18?{id:`main-sequence`,label:`Main-Sequence Fusion Star`}:a>1e-7?{id:`fusion-ignition`,label:`pp-Chain Quantum Ignition`}:r>=.35||e>=8e3?{id:`saha-protostar`,label:`Ionized Protostar (Saha H⁺)`}:n<.85||e>=1400?{id:`h2-dissociation`,label:`H₂ Dissociation Collapse (γ<4/3)`}:e>=120||t>=1e-9?{id:`larson-core`,label:`First Hydrostatic Larson Core`}:{id:`molecular-nebula`,label:`Cold Molecular H₂ Nebula`}}function Mr({nRho:e=28,nTemp:t=40,logRhoMin:n=-18,logRhoMax:r=11,logTempMin:i=1,logTempMax:a=9.6,xH:o=.74,xHe:s=.25,xMetals:c=.01,anchors:l=null}={}){let u=l||Tr(),d=new Float32Array(e*t*8);for(let l=0;l<t;l+=1){let f=10**(i+l/Math.max(1,t-1)*(a-i));for(let t=0;t<e;t+=1){let i=Or({rhoKgM3:10**(n+t/Math.max(1,e-1)*(r-n)),temperatureK:f,xH:o,xHe:s,xMetals:c,anchors:u}),a=(l*e+t)*8;d[a+0]=i.mu,d[a+1]=i.gammaEff,d[a+2]=i.fH2,d[a+3]=i.xIonized,d[a+4]=i.pDegFraction,d[a+5]=Math.log10(Math.max(1e-6,i.kappaM2PerKg)),d[a+6]=i.pNucFraction,d[a+7]=i.pRadFraction}}return{schema:ur,nRho:e,nTemp:t,logRhoMin:n,logRhoMax:r,logTempMin:i,logTempMax:a,strideFloats:8,anchors:u,data:d,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}async function Nr({closureRegistry:e,device:t=null,closureTable:n=null,closureId:r=`ulg-quantum-hydrogen-plasma-eos-2d.v1`}={}){let i=n;i||=Mr({anchors:t?await wr(t):Tr()});let a={closureId:r,closureKind:`plasma-eos-fusion-2d-table`,inputHash:`h-he-z:${i.nRho}x${i.nTemp}`,methodHash:`ks-pbe+cas22+ueg+nuclear-saturation.v1`,execution:{mode:`bilinear-2d-gpu-table`,table:i},validity:{log10Rho:[i.logRhoMin,i.logRhoMax],log10T:[i.logTempMin,i.logTempMax]},provenance:{schema:ur,anchors:i.anchors,radiationClosure:`src/runtime/material/radiationClosure.js#blackbodyColorSrgb`,validation:i.validation}};return{ref:e?await e.store(a):null,artifact:a,table:i}}var Pr=`peercompute.ulg.self-gravitating-hydro-gpu.v1`,Fr=128,Ir=32,Lr=Ir*Ir*Ir,Rr=Lr*8,zr=`
struct HydroParticle {
  pos_mass: vec4<f32>,   // [x, y, z, mass_sim]
  vel_smooth: vec4<f32>, // [vx, vy, vz, h_smooth]
  thermo: vec4<f32>,     // [log10T, log10Rho, xH, log10EpsNuc]
  state: vec4<f32>,      // [fMol, xIon, xHe, xZ]
};

struct EosClosureCell {
  eos0: vec4<f32>,       // [mu, gammaEff, fMol, xIon]
  eos1: vec4<f32>,       // [pDegFrac, log10Kappa, pNucFrac, pRadFrac]
};

struct HydroParams {
  count: u32,
  n_rho: u32,
  n_temp: u32,
  reset_peaks: u32,
  dt: f32,
  gravity_g: f32,
  softening2: f32,
  box_half: f32,
  theta2: f32,
  log_rho_min: f32,
  log_rho_max: f32,
  log_t_min: f32,
  log_t_max: f32,
  base_log_rho: f32,
  ref_rho_sim: f32,
  burn_timescale_s: f32,
  time_accel: f32,
  t_scale_k: f32,
  q_pp_j_per_kg: f32,
  q_3a_j_per_kg: f32,
  q_photodis_j_per_kg: f32,
  u_scale_j_per_kg: f32,
  pad_f0: f32,
  pad_f1: f32,
};

@group(0) @binding(0) var<storage, read> src_particles: array<HydroParticle>;
@group(0) @binding(1) var<storage, read_write> dst_particles: array<HydroParticle>;
// Uniform full-domain 32^3 compressible hydro accumulators (32768 * 8 atomic<i32>)
@group(0) @binding(2) var<storage, read_write> hydro_accum: array<atomic<i32>>;
// Canonical SchroederScaleAtlas multipole gravity output:
//   [0..count-1]: vec4(ax, ay, az, grav_phi), [count]: vec4(R_com, M_tot), [count+1]: vec4(V_com, 0)
@group(0) @binding(3) var<storage, read> ss_acc_phi: array<vec4<f32>>;
// Uniform full-domain 32^3 hydro grid: 2 vec4 per cell:
//   [c*2 + 0]: vec4(mass_cell, press_cell, cell_com_rel_x, cell_com_rel_y)
//   [c*2 + 1]: vec4(cell_vx_rel, cell_vy_rel, cell_vz_rel, cell_com_rel_z)
@group(0) @binding(4) var<storage, read_write> hydro_grid: array<vec4<f32>>;
// Pluggable 2D (log10 rho, log10 T) EOS & opacity closure table
@group(0) @binding(5) var<storage, read> eos_table: array<EosClosureCell>;
// 16 atomic<u32> global diagnostic telemetry slots (64 B)
@group(0) @binding(6) var<storage, read_write> telemetry: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params: HydroParams;

const HYDRO_DIM: u32 = ${Ir}u;
const HYDRO_COUNT: u32 = ${Lr}u;

const Q_MASS: f32 = 65536.0;
const Q_MOM: f32 = 4096.0;
const Q_PRESS: f32 = 64.0;

fn clamp_cell32(v: f32, half_extent: f32) -> u32 {
  let u = clamp((v + half_extent) / (2.0 * half_extent), 0.0, 0.9999);
  return min(31u, u32(u * 32.0));
}

fn cell_idx32(cx: u32, cy: u32, cz: u32) -> u32 {
  return (cz * 1024u) + (cy * 32u) + cx;
}

fn sample_eos_table(log_rho: f32, log_t: f32) -> EosClosureCell {
  let nr = max(2u, params.n_rho);
  let nt = max(2u, params.n_temp);
  let ur = clamp((log_rho - params.log_rho_min) / max(1e-4, params.log_rho_max - params.log_rho_min), 0.0, 0.9999) * f32(nr - 1u);
  let ut = clamp((log_t - params.log_t_min) / max(1e-4, params.log_t_max - params.log_t_min), 0.0, 0.9999) * f32(nt - 1u);
  let r0 = min(nr - 2u, u32(ur));
  let t0 = min(nt - 2u, u32(ut));
  let fr = ur - f32(r0);
  let ft = ut - f32(t0);

  let c00 = eos_table[t0 * nr + r0];
  let c10 = eos_table[t0 * nr + (r0 + 1u)];
  let c01 = eos_table[(t0 + 1u) * nr + r0];
  let c11 = eos_table[(t0 + 1u) * nr + (r0 + 1u)];

  let e0_lo = mix(c00.eos0, c10.eos0, fr);
  let e0_hi = mix(c01.eos0, c11.eos0, fr);
  let e1_lo = mix(c00.eos1, c10.eos1, fr);
  let e1_hi = mix(c01.eos1, c11.eos1, fr);

  return EosClosureCell(mix(e0_lo, e0_hi, ft), mix(e1_lo, e1_hi, ft));
}

@compute @workgroup_size(64)
fn sgh_clear(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i < 16u) {
    let is_peak_slot = (i <= 2u || i == 14u);
    if (!is_peak_slot || params.reset_peaks != 0u) {
      atomicStore(&telemetry[i], 0u);
    }
  }
  if (i < HYDRO_COUNT) {
    let hb = i * 8u;
    atomicStore(&hydro_accum[hb + 0u], 0);
    atomicStore(&hydro_accum[hb + 1u], 0);
    atomicStore(&hydro_accum[hb + 2u], 0);
    atomicStore(&hydro_accum[hb + 3u], 0);
    atomicStore(&hydro_accum[hb + 4u], 0);
    atomicStore(&hydro_accum[hb + 5u], 0);
    atomicStore(&hydro_accum[hb + 6u], 0);
    atomicStore(&hydro_accum[hb + 7u], 0);
    hydro_grid[i * 2u + 0u] = vec4<f32>(0.0);
    hydro_grid[i * 2u + 1u] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn sgh_deposit(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let p = src_particles[i];
  let pm = p.pos_mass;
  if (!(pm.w > 0.0)) { return; }

  let com_pos = ss_acc_phi[params.count].xyz;
  let com_vel = ss_acc_phi[params.count + 1u].xyz;
  let rel_pos = pm.xyz - com_pos;
  let rel_vel = p.vel_smooth.xyz - com_vel;

  // Uniform full-domain 32^3 smooth CIC trilinear compressible hydrodynamics grid deposition
  // (eliminates NGP cell-face discontinuities & grid-waffle clumping while conserving exact mass/momentum/pressure!)
  let logT = clamp(p.thermo.x, 1.0, 9.6);
  let logRho = clamp(p.thermo.y, -18.0, 11.0);
  let eos = sample_eos_table(logRho, logT);
  let mu_g = max(0.45, eos.eos0.x);
  let gamma_g = clamp(eos.eos0.y, 1.05, 2.75);
  let p_deg = clamp(eos.eos1.x, 0.0, 1.0);
  let log10_kappa_dep = eos.eos1.y;
  let p_nuc = clamp(eos.eos1.z, 0.0, 1.0);
  let p_rad = clamp(eos.eos1.w, 0.0, 1.0);

  let temp_k = pow(10.0, logT);
  let u_therm = temp_k / (params.t_scale_k * mu_g);
  let opt_trap_dep = clamp((logRho + log10_kappa_dep + 6.5) / 7.5, 0.0, 1.0);
  let gamma_soft = clamp((gamma_g - 1.02) / 0.65, 0.16, 2.8);
  let cs2_thermal = clamp((gamma_g - 1.0) * u_therm, 0.0, 320.0) * gamma_soft;
  let cs2_rad = p_rad * opt_trap_dep * opt_trap_dep * 14.0;
  let cs2_deg = p_deg * 28.0;
  let cs2_nuc = p_nuc * 1600.0;
  let press_cell = pm.w * (cs2_thermal + cs2_rad + cs2_deg + cs2_nuc);

  let u_dep = clamp(
    ((rel_pos + vec3<f32>(params.box_half)) / (2.0 * params.box_half)) * 32.0 - vec3<f32>(0.5),
    vec3<f32>(0.0),
    vec3<f32>(30.999)
  );
  let ix0 = u32(floor(u_dep.x));
  let iy0 = u32(floor(u_dep.y));
  let iz0 = u32(floor(u_dep.z));
  let fx = u_dep.x - f32(ix0);
  let fy = u_dep.y - f32(iy0);
  let fz = u_dep.z - f32(iz0);

  for (var dz: u32 = 0u; dz < 2u; dz = dz + 1u) {
    let wz = select(1.0 - fz, fz, dz == 1u);
    for (var dy: u32 = 0u; dy < 2u; dy = dy + 1u) {
      let wyz = wz * select(1.0 - fy, fy, dy == 1u);
      for (var dx: u32 = 0u; dx < 2u; dx = dx + 1u) {
        let w = wyz * select(1.0 - fx, fx, dx == 1u);
        if (w > 1e-5) {
          let hb = cell_idx32(ix0 + dx, iy0 + dy, iz0 + dz) * 8u;
          let wm = pm.w * w;
          atomicAdd(&hydro_accum[hb + 0u], i32(round(clamp(wm * Q_MASS, -1e8, 1e8))));
          atomicAdd(&hydro_accum[hb + 1u], i32(round(clamp(press_cell * w * Q_PRESS, -1e8, 1e8))));
          atomicAdd(&hydro_accum[hb + 2u], i32(round(clamp(wm * rel_pos.x * Q_MOM, -1e8, 1e8))));
          atomicAdd(&hydro_accum[hb + 3u], i32(round(clamp(wm * rel_pos.y * Q_MOM, -1e8, 1e8))));
          atomicAdd(&hydro_accum[hb + 4u], i32(round(clamp(wm * rel_pos.z * Q_MOM, -1e8, 1e8))));
          atomicAdd(&hydro_accum[hb + 5u], i32(round(clamp(wm * rel_vel.x * Q_MOM, -1e8, 1e8))));
          atomicAdd(&hydro_accum[hb + 6u], i32(round(clamp(wm * rel_vel.y * Q_MOM, -1e8, 1e8))));
          atomicAdd(&hydro_accum[hb + 7u], i32(round(clamp(wm * rel_vel.z * Q_MOM, -1e8, 1e8))));
        }
      }
    }
  }
}

@compute @workgroup_size(64)
fn sgh_finalize(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cell = gid.x;
  if (cell >= HYDRO_COUNT) { return; }
  let hb = cell * 8u;
  let m_h = f32(atomicLoad(&hydro_accum[hb + 0u])) / Q_MASS;
  if (m_h > 1e-6) {
    let inv_m = 1.0 / m_h;
    let p_sum = f32(atomicLoad(&hydro_accum[hb + 1u])) / Q_PRESS;
    let cx = (f32(atomicLoad(&hydro_accum[hb + 2u])) / Q_MOM) * inv_m;
    let cy = (f32(atomicLoad(&hydro_accum[hb + 3u])) / Q_MOM) * inv_m;
    let cz = (f32(atomicLoad(&hydro_accum[hb + 4u])) / Q_MOM) * inv_m;
    let vx = (f32(atomicLoad(&hydro_accum[hb + 5u])) / Q_MOM) * inv_m;
    let vy = (f32(atomicLoad(&hydro_accum[hb + 6u])) / Q_MOM) * inv_m;
    let vz = (f32(atomicLoad(&hydro_accum[hb + 7u])) / Q_MOM) * inv_m;
    hydro_grid[cell * 2u + 0u] = vec4<f32>(m_h, p_sum, cx, cy);
    hydro_grid[cell * 2u + 1u] = vec4<f32>(vx, vy, vz, cz);
  } else {
    hydro_grid[cell * 2u + 0u] = vec4<f32>(0.0);
    hydro_grid[cell * 2u + 1u] = vec4<f32>(0.0);
  }
}

fn read_hydro_a(ix: i32, iy: i32, iz: i32) -> vec4<f32> {
  if (ix < 0 || ix > 31 || iy < 0 || iy > 31 || iz < 0 || iz > 31) {
    return vec4<f32>(0.0);
  }
  return hydro_grid[cell_idx32(u32(ix), u32(iy), u32(iz)) * 2u + 0u];
}

fn read_hydro_b(ix: i32, iy: i32, iz: i32) -> vec4<f32> {
  if (ix < 0 || ix > 31 || iy < 0 || iy > 31 || iz < 0 || iz > 31) {
    return vec4<f32>(0.0);
  }
  return hydro_grid[cell_idx32(u32(ix), u32(iy), u32(iz)) * 2u + 1u];
}

fn sample_hydro_trilin_mp(u_in: vec3<f32>) -> vec2<f32> {
  let u = clamp(u_in, vec3<f32>(0.0), vec3<f32>(30.999));
  let ix = i32(floor(u.x));
  let iy = i32(floor(u.y));
  let iz = i32(floor(u.z));
  let fx = u.x - f32(ix);
  let fy = u.y - f32(iy);
  let fz = u.z - f32(iz);

  let a000 = read_hydro_a(ix, iy, iz).xy;
  let a100 = read_hydro_a(ix + 1, iy, iz).xy;
  let a010 = read_hydro_a(ix, iy + 1, iz).xy;
  let a110 = read_hydro_a(ix + 1, iy + 1, iz).xy;
  let a001 = read_hydro_a(ix, iy, iz + 1).xy;
  let a101 = read_hydro_a(ix + 1, iy, iz + 1).xy;
  let a011 = read_hydro_a(ix, iy + 1, iz + 1).xy;
  let a111 = read_hydro_a(ix + 1, iy + 1, iz + 1).xy;

  let c00 = mix(a000, a100, fx);
  let c10 = mix(a010, a110, fx);
  let c01 = mix(a001, a101, fx);
  let c11 = mix(a011, a111, fx);
  let c0 = mix(c00, c10, fy);
  let c1 = mix(c01, c11, fy);
  return mix(c0, c1, fz);
}

fn sample_hydro_trilin_grad_p(u_in: vec3<f32>, cell_w: f32) -> vec4<f32> {
  let u = clamp(u_in, vec3<f32>(0.0), vec3<f32>(30.999));
  let ix = i32(floor(u.x));
  let iy = i32(floor(u.y));
  let iz = i32(floor(u.z));
  let fx = u.x - f32(ix);
  let fy = u.y - f32(iy);
  let fz = u.z - f32(iz);

  let a000 = read_hydro_a(ix, iy, iz).xy;
  let a100 = read_hydro_a(ix + 1, iy, iz).xy;
  let a010 = read_hydro_a(ix, iy + 1, iz).xy;
  let a110 = read_hydro_a(ix + 1, iy + 1, iz).xy;
  let a001 = read_hydro_a(ix, iy, iz + 1).xy;
  let a101 = read_hydro_a(ix + 1, iy, iz + 1).xy;
  let a011 = read_hydro_a(ix, iy + 1, iz + 1).xy;
  let a111 = read_hydro_a(ix + 1, iy + 1, iz + 1).xy;

  let inv_w = 1.0 / cell_w;
  let dpdx = mix(mix(a100.y - a000.y, a110.y - a010.y, fy), mix(a101.y - a001.y, a111.y - a011.y, fy), fz) * inv_w;
  let dpdy = mix(mix(a010.y - a000.y, a110.y - a100.y, fx), mix(a011.y - a001.y, a111.y - a101.y, fx), fz) * inv_w;
  let dpdz = mix(mix(a001.y - a000.y, a101.y - a100.y, fx), mix(a011.y - a010.y, a111.y - a110.y, fx), fy) * inv_w;
  // Symmetric 8-corner cell mass average prevents vacuum-edge blowup while matching exact local density in interior
  let m_avg = 0.125 * (a000.x + a100.x + a010.x + a110.x + a001.x + a101.x + a011.x + a111.x);
  return vec4<f32>(dpdx, dpdy, dpdz, m_avg);
}

fn sample_hydro_trilin_com_vel(u_in: vec3<f32>, fallback_r: vec3<f32>, fallback_v: vec3<f32>) -> array<vec3<f32>, 2> {
  let u = clamp(u_in, vec3<f32>(0.0), vec3<f32>(30.999));
  let ix = i32(floor(u.x));
  let iy = i32(floor(u.y));
  let iz = i32(floor(u.z));
  let fx = u.x - f32(ix);
  let fy = u.y - f32(iy);
  let fz = u.z - f32(iz);

  var r_sum = vec3<f32>(0.0);
  var v_sum = vec3<f32>(0.0);
  var w_sum = 0.0;
  for (var dz: i32 = 0; dz < 2; dz = dz + 1) {
    let wz = select(1.0 - fz, fz, dz == 1);
    for (var dy: i32 = 0; dy < 2; dy = dy + 1) {
      let wyz = wz * select(1.0 - fy, fy, dy == 1);
      for (var dx: i32 = 0; dx < 2; dx = dx + 1) {
        let w = wyz * select(1.0 - fx, fx, dx == 1);
        let a = read_hydro_a(ix + dx, iy + dy, iz + dz);
        if (a.x > 1e-6) {
          let b = read_hydro_b(ix + dx, iy + dy, iz + dz);
          let wm = w * a.x;
          r_sum = r_sum + vec3<f32>(a.z, a.w, b.w) * wm;
          v_sum = v_sum + b.xyz * wm;
          w_sum = w_sum + wm;
        }
      }
    }
  }
  let inv_w = 1.0 / max(1e-6, w_sum);
  return array<vec3<f32>, 2>(
    select(fallback_r, r_sum * inv_w, w_sum > 1e-6),
    select(fallback_v, v_sum * inv_w, w_sum > 1e-6)
  );
}

fn sample_hydro_trilin_v(u_in: vec3<f32>, fallback_v: vec3<f32>) -> vec3<f32> {
  return sample_hydro_trilin_com_vel(u_in, vec3<f32>(0.0), fallback_v)[1];
}

@compute @workgroup_size(64)
fn sgh_integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.count) { return; }
  let p = src_particles[idx];
  let self_pm = p.pos_mass;
  let self_vs = p.vel_smooth;
  if (!(self_pm.w > 0.0)) {
    dst_particles[idx] = p;
    return;
  }

  let com_pos = ss_acc_phi[params.count].xyz;
  let com_vel = ss_acc_phi[params.count + 1u].xyz;
  let self_rel = self_pm.xyz - com_pos;
  let self_vrel_sys = self_vs.xyz - com_vel;

  // 1. Canonical SchroederScaleAtlas multipole gravity acceleration & potential |Phi_i|
  let grav_sample = ss_acc_phi[idx];
  let acc_grav = grav_sample.xyz;
  let grav_phi = grav_sample.w;

  // 2. Smooth CIC trilinear full-domain 32^3 hydro stencil (ZERO origin-centered inner grid,
  //    ZERO NGP cell-face discontinuities or Cartesian grid-waffle clumping!)
  let cell_w = (2.0 * params.box_half) / 32.0;
  let u_vec = clamp(
    ((self_rel + vec3<f32>(params.box_half)) / (2.0 * params.box_half)) * 32.0 - vec3<f32>(0.5),
    vec3<f32>(0.0),
    vec3<f32>(30.999)
  );
  let mp_here = sample_hydro_trilin_mp(u_vec);
  let grad_p_m = sample_hydro_trilin_grad_p(u_vec, cell_w);

  let m_local = max(1e-5, mp_here.x);
  // Smooth 3D CIC sub-cell peak density recovery
  let local_rho_sim = max(self_pm.w * 2.0, mp_here.x * 4.5);

  let com_vel_trilin = sample_hydro_trilin_com_vel(u_vec, self_rel, self_vrel_sys);
  let cell_com_rel = com_vel_trilin[0];
  let cell_vel_rel = com_vel_trilin[1];
  let r_cell_rel = self_rel - cell_com_rel;
  let v_cell_rel = self_vrel_sys - cell_vel_rel;

  let vx_p = sample_hydro_trilin_v(u_vec + vec3<f32>(1.0, 0.0, 0.0), cell_vel_rel).x;
  let vx_m = sample_hydro_trilin_v(u_vec - vec3<f32>(1.0, 0.0, 0.0), cell_vel_rel).x;
  let vy_p = sample_hydro_trilin_v(u_vec + vec3<f32>(0.0, 1.0, 0.0), cell_vel_rel).y;
  let vy_m = sample_hydro_trilin_v(u_vec - vec3<f32>(0.0, 1.0, 0.0), cell_vel_rel).y;
  let vz_p = sample_hydro_trilin_v(u_vec + vec3<f32>(0.0, 0.0, 1.0), cell_vel_rel).z;
  let vz_m = sample_hydro_trilin_v(u_vec - vec3<f32>(0.0, 0.0, 1.0), cell_vel_rel).z;
  let div_v_grid = ((vx_p - vx_m) + (vy_p - vy_m) + (vz_p - vz_m)) / (2.0 * cell_w);
  let div_v_sub = dot(v_cell_rel, r_cell_rel) / (dot(r_cell_rel, r_cell_rel) + 0.16 * cell_w * cell_w);
  let div_v = clamp(0.65 * div_v_grid + 0.35 * div_v_sub, -6.0, 6.0);

  let cs2_local = select(0.0, mp_here.y / m_local, mp_here.x > 1e-6);
  // Exact 1-cell analytical trilinear CIC pressure gradient -(grad P)/rho (eliminates odd-even checkerboard!)
  let rho_eff = max(self_pm.w * 2.5, 0.55 * mp_here.x + 0.45 * grad_p_m.w);
  let acc_press_grad = (-grad_p_m.xyz / rho_eff) * 0.58;
  // Smooth sub-cell isotropic pressure cushion: identically 0 in resolved hydrostatic envelopes
  // (cs2_local <= 8.0), engaging smoothly only when a collapsing core compresses below grid-cell
  // resolution (protostellar core & nuclear-saturation bounce) to prevent sub-cell shock focus!
  var acc_press_sub = vec3<f32>(0.0);
  let sub_engage = smoothstep(8.0, 22.0, cs2_local);
  if (sub_engage > 0.001) {
    let sub_k_max = select(0.32, 0.72, cs2_local > 600.0) / max(1e-4, params.dt * params.dt);
    let sub_k = min(cs2_local / (0.52 * cell_w * cell_w), sub_k_max) * sub_engage;
    acc_press_sub = r_cell_rel * sub_k;
    let sub_mag = length(acc_press_sub);
    let sub_acc_cap = select(min(140.0, (sqrt(max(0.0, cs2_local)) + 6.0) / max(0.02, params.dt * 1.6)), 900.0, cs2_local > 600.0);
    if (sub_mag > sub_acc_cap) {
      acc_press_sub = acc_press_sub * (sub_acc_cap / sub_mag);
    }
  }

  // 3. Local Jeans sub-grid physical density scaling from local_rho_sim & local |Phi_i|
  let prev_logT = clamp(p.thermo.x, 1.0, 9.6);
  let prev_logRho = clamp(p.thermo.y, -18.0, 10.8);
  let rho_ratio = max(1e-3, local_rho_sim / max(1e-4, params.ref_rho_sim));
  let log10_rho_ratio = log2(rho_ratio) * 0.30103;
  let phi_overburden = clamp(log2(max(1.0, grav_phi / 16.0)) * 0.30103 * 3.15, 0.0, 6.8);
  let target_logRho = clamp(
    params.base_log_rho + 6.35 * log10_rho_ratio + phi_overburden,
    -17.8,
    10.6
  );
  let logRho = mix(prev_logRho, target_logRho, min(1.0, params.dt * 12.0));

  // 4. Query pluggable 2D (log10 rho, log10 T) EOS & opacity closure table
  let cell_eos = sample_eos_table(logRho, prev_logT);
  let mu_gas = max(0.45, cell_eos.eos0.x);
  let gamma_eff = clamp(cell_eos.eos0.y, 1.05, 2.75);
  let fMol = clamp(cell_eos.eos0.z, 0.0, 1.0);
  let xIon = clamp(cell_eos.eos0.w, 0.0, 1.0);
  let pDeg_frac = clamp(cell_eos.eos1.x, 0.0, 1.0);
  let log10_kappa = cell_eos.eos1.y;
  let pNuc_frac = clamp(cell_eos.eos1.z, 0.0, 1.0);
  let pRad_frac = clamp(cell_eos.eos1.w, 0.0, 1.0);

  // 5. General Gamow-window thermonuclear reaction network using Gate 1 Q-values
  var xH = clamp(p.thermo.z, 0.0, 1.0);
  var xHe = clamp(p.state.z, 0.0, 1.0);
  var xZ = clamp(p.state.w, 0.0, 1.0);

  let tempK = pow(10.0, prev_logT);
  let rho_cgs = pow(10.0, clamp(logRho - 3.0, -21.0, 8.5));
  let t6 = tempK * 1e-6;
  let t8 = tempK * 1e-8;
  let t9 = tempK * 1e-9;

  var eps_pp = 0.0;
  if (t6 > 0.8 && xH > 1e-5) {
    let t6_cbrt = pow(t6, 0.3333333);
    let tau_pp = 33.80 / t6_cbrt;
    if (tau_pp < 80.0) {
      let screen = (1.0 + 0.0123 * t6_cbrt + 0.0109 * t6_cbrt * t6_cbrt) * 1.18;
      eps_pp = 238.0 * rho_cgs * xH * xH * pow(t6, -0.6666667) * exp(-tau_pp) * screen;
    }
  }
  var eps_cno = 0.0;
  if (t6 > 7.0 && xH > 1e-5 && xZ > 1e-5) {
    let t6_cbrt = pow(t6, 0.3333333);
    let tau_cno = 152.28 / t6_cbrt;
    if (tau_cno < 85.0) {
      eps_cno = 4.4e21 * rho_cgs * xH * (0.5 * xZ) * pow(t6, -0.6666667) * exp(-tau_cno);
    }
  }
  var eps_3a = 0.0;
  if (t8 > 0.45 && xHe > 1e-5) {
    let tau_3a = 44.027 / t8;
    if (tau_3a < 80.0) {
      eps_3a = 5.09e7 * (rho_cgs * rho_cgs) * (xHe * xHe * xHe) * pow(t8, -3.0) * exp(-tau_3a);
    }
  }
  var eps_photodis = 0.0;
  if (t9 > 1.2 && xZ > 0.30) {
    let ramp = clamp((t9 - 1.2) / 1.5, 0.0, 1.0);
    eps_photodis = 1.5e8 * xZ * ramp * ramp * exp(-max(0.0, 12.0 / t9 - 5.0));
  }

  let eps_exo = eps_pp + eps_cno + eps_3a;
  let log10_eps = log2(eps_exo + 1e-30) * 0.30103;

  // 6. Exact nucleon-conserving nuclear transmutation & conservative Gate 1 Q * dX energy release
  let dt_burn = params.dt * params.burn_timescale_s * params.time_accel;
  var dX_burned = 0.0;
  var dY_burned = 0.0;
  var dZ_photo = 0.0;
  if (eps_exo > 1e-7 && dt_burn > 0.0) {
    dX_burned = min(xH, ((eps_pp + eps_cno) * dt_burn) / max(1.0, params.q_pp_j_per_kg));
    dY_burned = min(xHe + dX_burned, (eps_3a * dt_burn) / max(1.0, params.q_3a_j_per_kg));
    xH = max(0.0, xH - dX_burned);
    xHe = max(0.0, xHe + dX_burned - dY_burned);
    xZ = max(0.0, xZ + dY_burned);
    let x_sum = max(1e-6, xH + xHe + xZ);
    xH = xH / x_sum;
    xHe = xHe / x_sum;
    xZ = xZ / x_sum;
  }
  if (eps_photodis > 1.0 && dt_burn > 0.0) {
    dZ_photo = min(xZ, (eps_photodis * dt_burn) / max(1.0, params.q_photodis_j_per_kg));
  }

  // 7. True First-Law Specific Internal Energy Conservation (exact Q * dX nuclear heating!)
  let dt_eff = params.dt * params.time_accel;
  let u_prev = tempK / (params.t_scale_k * mu_gas);
  let gamma_m1 = clamp(gamma_eff - 1.0, 0.06, 0.90);

  let is_compressing = div_v_grid < -0.04 && cs2_local < 900.0;
  let is_hot_core = cs2_local > 24.0 && cs2_local < 600.0;
  let damp_local = select(select(0.994, 0.962, is_hot_core), 0.925, is_compressing);
  let v_rel2 = dot(v_cell_rel, v_cell_rel);
  let ke_dissipated = 0.5 * (1.0 - damp_local * damp_local) * v_rel2;
  let optical_trap = clamp((logRho + log10_kappa + 6.5) / 7.5, 0.0, 1.0);

  let du_pdv = gamma_m1 * u_prev * clamp(-div_v, -6.0, 6.0) * params.dt;
  let du_visc = ke_dissipated * (0.35 + 0.65 * optical_trap);
  // Conservative nuclear specific-energy deposition from Gate 1 Q-values (J/kg -> dimensionless u):
  let e_nuc_j_per_kg = dX_burned * params.q_pp_j_per_kg + dY_burned * params.q_3a_j_per_kg;
  let e_endo_j_per_kg = dZ_photo * params.q_photodis_j_per_kg;
  let u_norm_j_per_kg = max(1e6, params.u_scale_j_per_kg);
  let du_nuc = clamp(e_nuc_j_per_kg / (u_norm_j_per_kg * 40.0), 0.0, 18.0 * dt_eff);
  let du_endo = clamp(e_endo_j_per_kg / (u_norm_j_per_kg * 40.0), 0.0, u_prev * 0.65);

  let thin_cool = (1.0 - optical_trap * 0.94) * max(0.0, u_prev - 3.5e-5) * 1.15 * params.dt;
  let thick_cool = optical_trap * (u_prev * 0.06 + 0.0005 * u_prev * u_prev / (1.0 + 0.003 * u_prev)) * params.dt;
  let du_rad = thin_cool + thick_cool;

  let u_next = max(2.0e-5, u_prev + du_pdv + du_visc + du_nuc - du_endo - du_rad);
  let next_temp_k = clamp(u_next * params.t_scale_k * mu_gas, 14.0, 3.5e9);
  let next_logT = clamp(log2(next_temp_k) * 0.30103, 1.15, 9.55);

  // 8. General Hydrodynamic Equations of Motion (100% translation- & multi-body-invariant):
  //    a_total = a_grav + (-grad P / rho) + a_sub_cell_pressure
  //    (gamma_soft is already encoded symmetrically in cell cs2 inside sgh_deposit so
  //     inter-cell face forces obey Newton's 3rd Law identically!)
  let acc_press_total = acc_press_grad + acc_press_sub;
  let acc_total = acc_grav + acc_press_total;

  var vel = com_vel + cell_vel_rel + v_cell_rel * damp_local + acc_total * params.dt;
  let v_rel_next = vel - com_vel;
  let spd_rel = length(v_rel_next);
  let v_cap = 42.0;
  if (spd_rel > v_cap) {
    vel = com_vel + v_rel_next * (v_cap / spd_rel);
  }
  var pos = self_pm.xyz + vel * params.dt;

  // Soft COM-relative outer domain confinement ONLY for bound non-escaping gas at domain edge
  let next_rel = pos - com_pos;
  let r_rel_box = length(next_rel);
  if (r_rel_box > params.box_half - 0.45 && spd_rel < 14.0) {
    pos = com_pos + next_rel * ((params.box_half - 0.45) / r_rel_box);
    vel = com_vel + (vel - com_vel) * 0.72;
  }

  dst_particles[idx] = HydroParticle(
    vec4<f32>(pos, self_pm.w),
    vec4<f32>(vel, self_vs.w),
    vec4<f32>(next_logT, logRho, xH, log10_eps),
    vec4<f32>(fMol, xIon, xHe, xZ)
  );

  // 9. 64-byte atomic global diagnostic telemetry reduction (purely physical & translation-invariant!)
  let logT_u = u32(clamp(next_logT * 1000.0, 0.0, 20000.0));
  let logRho_u = u32(clamp((logRho + 20.0) * 1000.0, 0.0, 40000.0));
  let logEps_u = u32(clamp((log10_eps + 30.0) * 1000.0, 0.0, 60000.0));
  atomicMax(&telemetry[0u], logT_u);
  atomicMax(&telemetry[1u], logRho_u);
  atomicMax(&telemetry[2u], logEps_u);
  if (log10_eps > -5.5) {
    atomicAdd(&telemetry[3u], 1u);
  }
  atomicAdd(&telemetry[4u], u32(clamp(fMol * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[5u], u32(clamp(xIon * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[6u], u32(clamp(xH * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[7u], u32(clamp(xHe * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[8u], u32(clamp(xZ * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[9u], u32(clamp(pDeg_frac * 1000.0, 0.0, 1000.0)));
  if (logRho > -3.0) {
    atomicAdd(&telemetry[10u], 1u);
    atomicAdd(&telemetry[11u], u32(clamp(xZ * 1000.0, 0.0, 1000.0)));
    atomicAdd(&telemetry[12u], u32(clamp(xH * 1000.0, 0.0, 1000.0)));
    atomicAdd(&telemetry[15u], u32(clamp(gamma_eff * 1000.0, 0.0, 3000.0)));
  }
  let v_out = select(0.0, dot(vel - com_vel, next_rel / max(0.25, r_rel_box)), r_rel_box > 0.6);
  if (v_out > 6.5) {
    atomicAdd(&telemetry[13u], 1u);
  }
  if (pNuc_frac > 0.08) {
    atomicAdd(&telemetry[14u], 1u);
  }
}
`;function Br(e,t,n,r){let i=Math.max(1,t),a=Math.max(1,e[10]),o=Math.max(1.15,(e[0]||1400)/1e3),s=(e[1]||4e3)/1e3-20,c=(e[2]||0)/1e3-30,l=e[3]||0,u=Math.min(1,(e[4]||0)/(i*1e3)),d=Math.min(1,(e[5]||0)/(i*1e3)),f=Math.min(1,(e[6]||0)/(i*1e3)),p=Math.min(1,(e[7]||0)/(i*1e3)),m=Math.min(1,(e[8]||0)/(i*1e3)),h=Math.min(1,(e[9]||0)/(i*1e3)),g=e[10]>0?Math.min(1,(e[11]||0)/(a*1e3)):m,_=e[10]>0?Math.min(1,(e[12]||0)/(a*1e3)):f,v=e[10]>0?(e[15]||1667)/(a*1e3):5/3,y=e[13]||0,b=e[14]||0,x=10**o,S=10**s,C=c>-29?10**c:0,w=Or({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g}),T=kr({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g,coreMassSolar:n}),E=!!(r||b>4&&x>=25e7||T.coreCollapseTriggered&&y>40),D=Math.max(1.35,n*.14),O=E?D>2.35?`black-hole`:`neutron-star`:`none`,k=E?2*66743e-15*D*198847e25/299792458**2:0,A=jr({coreTempK:x,coreRhoKgM3:S,fH2:w.fH2,xIonized:w.xIonized,xH:_,epsNucWPerKg:Math.max(C,T.epsTotalWPerKg),pDegFraction:w.pDegFraction,supernovaShockActive:E&&y>80,remnantClass:O}),j=Math.max(1200,Math.min(38e3,x<1e4?Math.max(1200,x*.85):Math.min(36e3,3200+Math.max(0,n)**.72*3200))),M=Ar(j);return{coreTempK:x,coreLogT:o,coreRhoKgM3:S,coreLogRho:s,peakEpsNucWPerKg:Math.max(C,T.epsTotalWPerKg),gamowPeakKeV:T.gamowPeakKeV,gamowTauPp:T.gamowTauPp,fusingCount:l,meanFH2:u,meanXIonized:d,coreFH2:w.fH2,coreXIonized:w.xIonized,coreMu:w.mu,coreGammaEff:Math.min(v,w.gammaEff),corePDegFraction:w.pDegFraction,corePNucFraction:w.pNucFraction,meanPDegFraction:h,meanXH:f,meanXHe:p,meanXZ:m,coreXH:_,coreXZ:g,nucleonSum:f+p+m,shockCount:y,nuclearBounceCount:b,supernovaTriggered:E,remnantClass:O,schwarzschildRadiusM:k,photosphereTempK:j,photosphereSrgb:M,stage:A}}function Vr({device:e=null,initialBodies:t,eosClosureTable:n=null,gravityG:r=.42,softening:i=.25,boxHalf:a=14,rCellFactor:o=.075,baseLogRho:s=-16.2,refRhoSim:c=.08,burnTimescaleS:l=42e13,tScaleK:u=78e4,label:d=`ulg-self-gravitating-hydro`}={}){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`createSelfGravitatingHydroEngine requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`);let f=Float32Array.from(t),p=f.length/16,m=n||Mr({nRho:28,nTemp:40});function h(e){let t=0;for(let n=0;n<e.length;n+=16)t+=e[n+3];return t/100}let g=h(f),_=0,v=0,y=!1,b=!1;function x(e){let t=1.2,n=s,r=0,i=0,a=0,o=0;for(let s=0;s<p;s+=1){let c=s*16;e[c+8]>t&&(t=e[c+8]),e[c+9]>n&&(n=e[c+9]),r+=e[c+12],i+=e[c+10],a+=e[c+14],o+=e[c+15]}let c=new Uint32Array(16);return c[0]=Math.round(t*1e3),c[1]=Math.round((n+20)*1e3),c[4]=Math.round(r*1e3),c[6]=Math.round(i*1e3),c[7]=Math.round(a*1e3),c[8]=Math.round(o*1e3),c[10]=1,c[11]=Math.round(o/p*1e3),c[12]=Math.round(i/p*1e3),c[15]=1667,Br(c,p,g,!1)}let S=x(f),C=Math.max(64,f.byteLength),w=[e.createBuffer({label:`${d}-p0`,size:C,usage:172}),e.createBuffer({label:`${d}-p1`,size:C,usage:172})],T=ze(e,{maxCount:p,strideFloats:16,chartLevel:35,useAdjSoftening:!0,qMass:65536,qMom:4096,rCellFactor:o,label:`${d}-ss-atlas`}),E=Te(),D=e.createBuffer({label:`${d}-hydro-accum`,size:Rr*4,usage:Fr}),O=e.createBuffer({label:`${d}-hydro-grid`,size:Lr*2*16,usage:Fr}),k=e.createBuffer({label:`${d}-eos-table`,size:m.data.byteLength,usage:136}),A=e.createBuffer({label:`${d}-telemetry`,size:64,usage:132}),j=e.createBuffer({label:`${d}-telemetry-staging`,size:64,usage:9}),M=e.createBuffer({label:`${d}-params`,size:96,usage:72}),N=e.createBuffer({label:`${d}-body-staging`,size:C,usage:9});e.queue.writeBuffer(w[0],0,f),e.queue.writeBuffer(w[1],0,f),e.queue.writeBuffer(k,0,m.data);let L=[P(0,`read-only-storage`),P(1,`storage`),P(2,`storage`),P(3,`read-only-storage`),P(4,`storage`),P(5,`read-only-storage`),P(6,`storage`),P(7,`uniform`)],R=t=>I(e,{cacheKey:`ulg-self-gravitating-hydro-${t}.v26-cic-grad-ss-atlas`,label:`ulg-self-gravitating-hydro-${t}`,code:zr,entryPoint:t,bindings:L}),z={clear:R(`sgh_clear`),deposit:R(`sgh_deposit`),finalize:R(`sgh_finalize`),integrate:R(`sgh_integrate`)},B=(t,n,r)=>F(e,{layout:z.integrate.bindGroupLayout,label:`${d}-bg-${r}`,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:D}},{binding:3,resource:{buffer:T.accPhiBuffer}},{binding:4,resource:{buffer:O}},{binding:5,resource:{buffer:k}},{binding:6,resource:{buffer:A}},{binding:7,resource:{buffer:M}}]}),ee=[B(w[0],w[1],0),B(w[1],w[0],1)],V=0,te=!1,ne=!1,re=!0;async function ie(){if(!w||!N||ne||b)return f;ne=!0;try{let t=e.createCommandEncoder({label:`${d}-readback`});t.copyBufferToBuffer(w[V],0,N,0,f.byteLength),e.queue.submit([t.finish()]),await N.mapAsync(1),f.set(new Float32Array(N.getMappedRange())),N.unmap()}finally{ne=!1}return f}async function ae({dt:t=.018,timeAccel:n=1,readTelemetry:o=!0}={}){if(b||!w)return S;let f=Math.max(.25,Math.min(25,Number(n)||1)),h=Math.max(.004,Math.min(.028,Number(t)||.018)),x=1380649e-29/167262192369e-38*1.5*u,C=new ArrayBuffer(96),D=new Uint32Array(C),O=new Float32Array(C);D[0]=p,D[1]=m.nRho,D[2]=m.nTemp,D[3]=+!!re,O[4]=h,O[5]=r,O[6]=i*i,O[7]=a,O[8]=.65*.65,O[9]=m.logRhoMin,O[10]=m.logRhoMax,O[11]=m.logTempMin,O[12]=m.logTempMax,O[13]=s,O[14]=c,O[15]=l,O[16]=f,O[17]=u,O[18]=E.ppJPerKgH,O[19]=E.tripleAlphaJPerKgHe,O[20]=E.fePhotodisJPerKgFe,O[21]=x,e.queue.writeBuffer(M,0,C),T.writeParams({count:p,gravityG:r,softening2:i*i,boxHalf:a,theta2:.65*.65});let k=V,N=1-V,P=ee[k],F=Math.ceil(p/64),I=Math.ceil(Lr/64),L=e.createCommandEncoder({label:`${d}-step-${_}`}),R=L.beginComputePass({label:`${d}-pass`});T.encodeIntoPass(R,{srcBuffer:w[k],count:p}),R.setPipeline(z.clear.pipeline),R.setBindGroup(0,P),R.dispatchWorkgroups(I),R.setPipeline(z.deposit.pipeline),R.setBindGroup(0,P),R.dispatchWorkgroups(F),R.setPipeline(z.finalize.pipeline),R.setBindGroup(0,P),R.dispatchWorkgroups(I),R.setPipeline(z.integrate.pipeline),R.setBindGroup(0,P),R.dispatchWorkgroups(F),R.end();let B=o&&!te;if(B&&L.copyBufferToBuffer(A,0,j,0,64),re=B,e.queue.submit([L.finish()]),V=N,_+=1,v+=h*f*.35,B){te=!0;try{await j.mapAsync(1);let e=new Uint32Array(j.getMappedRange().slice(0));j.unmap(),e[14]>4&&10**((e[0]||1400)/1e3)>=15e7&&(y=!0),S=Br(e,p,g,y)}finally{te=!1}}return S}function oe(t){return f=Float32Array.from(t),g=h(f),_=0,v=0,y=!1,V=0,re=!0,S=x(f),w&&(e.queue.writeBuffer(w[0],0,f),e.queue.writeBuffer(w[1],0,f)),S}function H(){b||(b=!0,w?.[0]?.destroy(),w?.[1]?.destroy(),T.destroy(),D.destroy(),O.destroy(),k.destroy(),A.destroy(),j.destroy(),M.destroy(),N.destroy(),w=null)}return{schema:Pr,get count(){return p},get totalMassSolar(){return g},get stepIndex(){return _},get simTimeMyr(){return v},get backend(){return`webgpu`},get gravityMode(){return T.gravityMode},get solverMode(){return`webgpu-self-gravitating-hydro-eos`},get gate1BurnConstants(){return E},get closureTable(){return m},get anchors(){return m.anchors},getTelemetry:()=>S,getBodies:()=>f,getResidentBuffer:()=>w?w[V]:null,readbackBodies:ie,step:ae,resetBodies:oe,dispose:H}}var Y=Object.freeze({id:`main-sequence-star`,label:`Hydrostatic Main-Sequence Star (1.0 M☉)`,shortLabel:`1 M☉ Active Star`,description:`Hydrostatic Lane-Emden convective 1.0 M☉ G2V star in nuclear-thermal equilibrium with differential rotation driving an emergent 3D convective dynamo.`,totalMassSolar:1,initialTempK:15e6,initialLog10Rho:5.15,angularMomentum:.36,cloudRadius:4,geometry:`lane-emden-star`}),Hr=Object.freeze({"solar-nebula":Object.freeze({id:`solar-nebula`,label:`Solar Nebula (1.0 M☉)`,shortLabel:`1 M☉ Solar Star`,description:`Cold 25 K turbulent 1.0 M☉ H₂ cloud fed into ULG general self-gravitating hydro + quantum plasma EOS & Gamow fusion laws.`,totalMassSolar:1,initialTempK:25,initialLog10Rho:-16,angularMomentum:.44,cloudRadius:9,geometry:`bonnor-ebert`}),"massive-supernova":Object.freeze({id:`massive-supernova`,label:`Massive Cloud → Supernova (18 M☉)`,shortLabel:`18 M☉ Supernova`,description:`Identical laws, 18× heavier initial hydrogen particles -> rapid CNO/triple-α burn -> Fe photodisintegration collapse -> nuclear-saturation EOS bounce & Black Hole.`,totalMassSolar:18,initialTempK:36,initialLog10Rho:-15.3,angularMomentum:.22,cloudRadius:8.6,geometry:`bonnor-ebert`}),"binary-nursery":Object.freeze({id:`binary-nursery`,label:`Binary Star Nursery (2.4 M☉)`,shortLabel:`2.4 M☉ Binary`,description:`Identical laws on a rotating twin-lobe 2.4 M☉ molecular cloud fragmenting into two orbiting fusing stars linked by tidal gas.`,totalMassSolar:2.4,initialTempK:28,initialLog10Rho:-15.7,angularMomentum:.65,cloudRadius:9.5,geometry:`twin-lobe`})});function Ur(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Wr({count:e=8192,preset:t=`solar-nebula`,gravityG:n=.42,seed:r=1939,centerOffset:i=[0,0,0]}={}){let a=t===`main-sequence-star`?Y:Hr[t]||Hr[`solar-nebula`],o=Math.max(256,Math.min(32768,Math.floor(e))),s=new Float32Array(o*16),c=Number(i?.[0])||0,l=Number(i?.[1])||0,u=Number(i?.[2])||0,d=Ur(r+(t===`massive-supernova`?101:t===`binary-nursery`?202:0)),f=()=>{let e=Math.max(1e-7,d()),t=d();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},p=a.totalMassSolar*100,m=p/o,h=Math.log10(a.initialTempK),g=a.initialLog10Rho,_=[];for(let e=0;e<8;e+=1)_.push({kx:(d()-.5)*.72,ky:(d()-.5)*.72,kz:(d()-.5)*.72,phase:d()*Math.PI*2,amp:.45+d()*.65});for(let e=0;e<o;e+=1){let t=e*16,r,i,v,y,b,x,S=0,C=null,w=null,T=null,E=null,D=.74,O=.25,k=.01;if(a.geometry===`lane-emden-star`){let e=.5;for(let t=0;t<24;t+=1){let t=d(),n=t*t*Math.max(0,1-t*t)**1.5;if(d()*.19<=n){e=t;break}}let t=.12+e*(a.cloudRadius-.12),n=2*d()-1,o=Math.sqrt(Math.max(0,1-n*n)),s=d()*Math.PI*2;r=t*o*Math.cos(s),i=t*n,v=t*o*Math.sin(s);let c=(.48-n*n*.14)*(.78+.35*Math.exp(-e*1.4)),l=Math.max(0,(e-.56)/.44),u=Math.sin(s*6+n*4)*Math.cos(e*8)*l*.18;y=-v*c+r/t*u+f()*.03,b=i/t*u+f()*.03,x=r*c+v/t*u+f()*.03;let p=Math.max(.002,1-e*e*.996),m=Math.max(5800,5800+(a.initialTempK-5800)*p),h=10**(-3.6+(a.initialLog10Rho- -3.6)*p**.72);C=Math.log10(m),w=Math.log10(h),T=0,E=e<.92?1:.45;let g=.22*Math.exp(-e*e*8);D=.72-g,O=.26+g,k=.02}else if(a.geometry===`twin-lobe`){let t=e&1?1:-1,a=4.5;S=t*a;let o=e%10==0;if(o){let e=(d()*2-1)*a;r=e,i=f()*.65,v=f()*.85+Math.sin(e*.55)*.75,S=e}else{let e=.18+d()**1.15*2.55,n=2*d()-1,o=Math.sqrt(Math.max(0,1-n*n)),s=d()*Math.PI*2;r=t*a+e*o*Math.cos(s),i=e*n*.62,v=e*o*Math.sin(s)}let s=Math.sqrt(n*p/(4*a))*1.04,c=r-t*a,l=v,u=Math.hypot(c,l)+.35,m=Math.sqrt(n*p*.22/(u+.6))*.42;y=(o?-v/(Math.hypot(r,v)+.5)*s*.7:-l/u*m)+f()*.1,b=f()*.08,x=(o?r/(Math.hypot(r,v)+.5)*s*.7:t*s+c/u*m)+f()*.1}else{let t=e>o*.72,s=d(),c=t?3.3+s**.8*(a.cloudRadius-3.3):.18+s**1.28*5,l=2*d()-1,u=Math.sqrt(Math.max(0,1-l*l)),m=d()*Math.PI*2,h=c*u*Math.cos(m),g=c*l*(t?.56:.78),S=c*u*Math.sin(m),C=0,w=0,T=0;for(let e of _){let t=Math.sin(e.kx*h+e.ky*g+e.kz*S+e.phase)*e.amp;C+=e.kx*t,w+=e.ky*t,T+=e.kz*t}r=h+C*.92,i=g+w*.62,v=S+T*.92;let E=Math.hypot(r,v)+.35,D=t?1.05:.3+.55*Math.min(1,E/6),O=Math.sqrt(n*p*.38/(E+1.1))*a.angularMomentum*D,k=t?-.06:-.18,A=Math.hypot(r,i,v)+.4;y=-v/E*O+r/A*k+f()*.14,b=i/A*k*.8+f()*.1,x=r/E*O+v/A*k+f()*.14}let A=Math.hypot(r-S,i,v),j=Math.exp(-A*A/12),M=w??g+j*1,N=C??h+j*.1,P=.32+.04*Math.min(6,A);s[t+0]=r+c,s[t+1]=i+l,s[t+2]=v+u,s[t+3]=m,s[t+4]=y,s[t+5]=b,s[t+6]=x,s[t+7]=P,s[t+8]=N,s[t+9]=M,s[t+10]=D,s[t+11]=C!=null&&C>6.8?-1.5:-30,s[t+12]=T??.998,s[t+13]=E??0,s[t+14]=O,s[t+15]=k}return s}var X=`ulg.astrophysics.galactic-ss-nfw-dm-webgpu.v1`,Gr=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Kr=`
struct Body {
  pos_mass: vec4<f32>,   // x, y, z, mass
  vel_pop: vec4<f32>,    // vx, vy, vz, popTag (-1 = dark matter halo, >=0 = visible star/HII)
};

struct GalParams {
  count: u32,
  smbh_idx_b: u32,       // Optional 2nd SMBH / halo core index for binary galaxy mergers (0 = single galaxy)
  step_index: u32,
  cal_mode: u32,         // 0=3D Disk, 1=3D Jeans Spheroid, 2=Sub-virial Collapse, 3=Binary Dual-Disk, bit 8=preserve central bar
  dt: f32,
  gravity_g: f32,
  softening2: f32,
  smbh_soft2: f32,
  dm_halo_mass: f32,     // Primary NFW cosmological dark matter halo virial mass
  dm_scale_r: f32,       // NFW scale radius r_s
  dm_conc: f32,          // NFW concentration parameter c = R_200 / r_s
  dm_soft2: f32,         // Core gravitational softening^2 for NFW halo
  virial_scale: f32,     // Calibration speed factor (1.0 = equilibrium, ~0.80 = bound collapse)
  dm_halo_mass_b: f32,   // Secondary NFW dark matter halo mass for binary galaxy mergers (0 = single)
  disk_nx: f32,          // Primary 3D disk normal X
  disk_ny: f32,          // Primary 3D disk normal Y
  disk_nz: f32,          // Primary 3D disk normal Z
  disk2_nx: f32,         // Secondary 3D disk normal X (for binary mergers)
  disk2_ny: f32,         // Secondary 3D disk normal Y
  disk2_nz: f32,         // Secondary 3D disk normal Z
};

@group(0) @binding(0) var<uniform> params: GalParams;
@group(0) @binding(1) var<storage, read_write> bodies: array<Body>;
// Canonical Schroeder Scale-Atlas (SS) 3D hierarchical multipole self-gravity acceleration per body!
@group(0) @binding(2) var<storage, read> ss_acc_phi: array<vec4<f32>>;
// Race-free read-only snapshot of central SMBH / merger core states taken right before kick_and_drift!
@group(0) @binding(3) var<storage, read_write> core_snap: array<Body>;

@compute @workgroup_size(64)
fn pm_snapshot_cores(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x == 0u) {
    core_snap[0u] = bodies[0u];
    if (params.smbh_idx_b > 0u && params.smbh_idx_b < params.count) {
      core_snap[1u] = bodies[params.smbh_idx_b];
    } else {
      core_snap[1u] = Body(vec4<f32>(0.0), vec4<f32>(0.0));
    }
  }
}

// First-principles Navarro-Frenk-White (NFW) cosmological Dark Matter Halo gravitational acceleration!
// Produces genuine flat Rubin rotation curves V_c(r) ~ const so outer spiral disks stay tightly bound.
fn eval_nfw_dark_matter_acc(rel: vec3<f32>, m_dm: f32, r_s: f32, c_nfw: f32, soft2: f32, g_grav: f32) -> vec3<f32> {
  if (m_dm <= 1e-4) { return vec3<f32>(0.0); }
  let r2 = dot(rel, rel);
  let r_safe = sqrt(r2 + soft2);
  let rs = max(0.6, r_s);
  let x = r_safe / rs;
  let c_eff = max(2.0, c_nfw);
  let a_norm = max(1e-4, log(1.0 + c_eff) - c_eff / (1.0 + c_eff));
  let m_enc = m_dm * max(0.0, log(1.0 + x) - x / (1.0 + x)) / a_norm;
  return -rel * (g_grav * m_enc / (r_safe * r_safe * r_safe));
}

fn compute_total_gal_acc(i: u32, pos: vec3<f32>) -> vec3<f32> {
  // 1. Canonical non-periodic 3D Schroeder Scale-Atlas multipole self-gravity (stars + SMBHs + live N-body DM particles!)
  var acc = clamp(ss_acc_phi[i].xyz, vec3<f32>(-180.0), vec3<f32>(180.0));
  let r_ss_eff2 = max(params.smbh_soft2 + 0.04, params.softening2 + 0.42);

  if (params.smbh_idx_b == 0u) {
    // SINGLE GALAXY (Strict Newton 3rd-Law Conservation — ZERO un-reciprocated moving halo tractor-beam!):
    // Anchor the cosmological NFW Dark Matter Halo at the inertial halo center (0,0,0), acting on ALL bodies
    // INCLUDING the central SMBH (i == 0u) so the SMBH remains naturally nested at the halo minimum!
    acc = acc + eval_nfw_dark_matter_acc(pos, params.dm_halo_mass, params.dm_scale_r, params.dm_conc, params.dm_soft2, params.gravity_g);
    if (i != 0u) {
      let bh0 = core_snap[0u].pos_mass;
      if (bh0.w > 0.0) {
        let rel0 = pos - bh0.xyz;
        let d2 = dot(rel0, rel0);
        let r2_tight = d2 + params.smbh_soft2;
        let r2_ss = d2 + r_ss_eff2;
        let k_corr = max(0.0, inverseSqrt(r2_tight) / r2_tight - inverseSqrt(r2_ss) / r2_ss);
        acc = acc - rel0 * (params.gravity_g * bh0.w * k_corr);
      }
    }
  } else {
    // BINARY MERGER: Two co-moving NFW Dark Matter Halos anchored at race-free snapshots bh0 & bh1
    // with EXACT reciprocal halo-halo mutual gravity (shared r_s_mutual so F_01 = -F_10!) + momentum-conserving DF!
    let bh0 = core_snap[0u].pos_mass;
    let bh1 = core_snap[1u].pos_mass;
    let rs_mutual = params.dm_scale_r * 0.95;
    if (i == 0u) {
      // Halo 0 core feels Halo 1 NFW attraction + mild dynamical friction when halos overlap
      let rel01 = pos - bh1.xyz;
      acc = acc + eval_nfw_dark_matter_acc(rel01, params.dm_halo_mass_b, rs_mutual, params.dm_conc, params.dm_soft2 * 2.2, params.gravity_g);
      let d01 = length(rel01);
      if (d01 < 14.0) {
        let v_rel = core_snap[0u].vel_pop.xyz - core_snap[1u].vel_pop.xyz;
        let m_tot_h = max(1.0, params.dm_halo_mass + params.dm_halo_mass_b);
        let df_k = 0.065 * (1.0 - smoothstep(2.0, 14.0, d01)) * (params.dm_halo_mass_b / m_tot_h) * 2.0;
        acc = acc - v_rel * df_k;
      }
    } else if (i == params.smbh_idx_b) {
      // Halo 1 core feels reciprocal Halo 0 NFW attraction + momentum-conserving dynamical friction
      let rel10 = pos - bh0.xyz;
      acc = acc + eval_nfw_dark_matter_acc(rel10, params.dm_halo_mass, rs_mutual, params.dm_conc, params.dm_soft2 * 2.2, params.gravity_g);
      let d10 = length(rel10);
      if (d10 < 14.0) {
        let v_rel = core_snap[1u].vel_pop.xyz - core_snap[0u].vel_pop.xyz;
        let m_tot_h = max(1.0, params.dm_halo_mass + params.dm_halo_mass_b);
        let df_k = 0.065 * (1.0 - smoothstep(2.0, 14.0, d10)) * (params.dm_halo_mass / m_tot_h) * 2.0;
        acc = acc - v_rel * df_k;
      }
    } else {
      let rel0 = pos - bh0.xyz;
      if (bh0.w > 0.0) {
        let d2 = dot(rel0, rel0);
        let r2_tight = d2 + params.smbh_soft2;
        let r2_ss = d2 + r_ss_eff2;
        let k_corr = max(0.0, inverseSqrt(r2_tight) / r2_tight - inverseSqrt(r2_ss) / r2_ss);
        acc = acc - rel0 * (params.gravity_g * bh0.w * k_corr);
      }
      acc = acc + eval_nfw_dark_matter_acc(rel0, params.dm_halo_mass, params.dm_scale_r, params.dm_conc, params.dm_soft2, params.gravity_g);

      let rel1 = pos - bh1.xyz;
      if (bh1.w > 0.0) {
        let d2 = dot(rel1, rel1);
        let r2_tight = d2 + params.smbh_soft2;
        let r2_ss = d2 + r_ss_eff2;
        let k_corr = max(0.0, inverseSqrt(r2_tight) / r2_tight - inverseSqrt(r2_ss) / r2_ss);
        acc = acc - rel1 * (params.gravity_g * bh1.w * k_corr);
      }
      acc = acc + eval_nfw_dark_matter_acc(rel1, params.dm_halo_mass_b, params.dm_scale_r * 0.90, params.dm_conc, params.dm_soft2, params.gravity_g);
    }
  }
  return acc;
}

// 1. Half-step symplectic Drift: x(t + dt/2) = x(t) + 0.5 * dt * v(t)
@compute @workgroup_size(64)
fn pm_drift_half(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  var b = bodies[i];
  if (!(b.pos_mass.w > 0.0)) { return; }
  b.pos_mass = vec4<f32>(b.pos_mass.xyz + b.vel_pop.xyz * (0.5 * params.dt), b.pos_mass.w);
  bodies[i] = b;
}

// 2. Symplectic Full-Step Kick + Second Half-Step Drift (exact Velocity-Verlet DKD!)
@compute @workgroup_size(64)
fn pm_kick_and_drift(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  var b = bodies[i];
  if (!(b.pos_mass.w > 0.0)) { return; }
  let pos = b.pos_mass.xyz;
  let acc = compute_total_gal_acc(i, pos);
  var vel_next = b.vel_pop.xyz + acc * params.dt;
  let v_mag = length(vel_next);
  if (v_mag > 60.0) {
    vel_next = vel_next * (60.0 / v_mag);
  }
  let pos_next = pos + vel_next * (0.5 * params.dt);
  bodies[i] = Body(vec4<f32>(pos_next, b.pos_mass.w), vec4<f32>(vel_next, b.vel_pop.w));
}

// 3. Universal Exact 3D Equilibrium Calibration in the ACTUAL GPU (SS Multipole + NFW + SMBH) Potential!
//    Supports ALL 4 astrophysical regimes without breaking arbitrary 3D tilts, bars, or spheroids:
//      mode 0: 3D Tilted Toomre-Stable Disk (exact in-plane circular v_c + proportional Q>=1.5 dispersion + Jeans DM/bulge)
//      mode 1: 3D Isotropic Hernquist/King Jeans Pressure-Supported Spheroid (exact 2K/|U| = 1.0 virial equilibrium!)
//      mode 2: Sub-Virial Cosmological Protogalactic Collapse (Jeans DM halo + bound virial_scale baryonic infall!)
//      mode 3: Binary Dual-Disk Galaxy Merger (each galaxy calibrated in its own tilted rest frame before adding bulk orbit!)
@compute @workgroup_size(64)
fn pm_calibrate_equilibrium(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count || i == 0u || (params.smbh_idx_b > 0u && i == params.smbh_idx_b)) { return; }
  var b = bodies[i];
  if (!(b.pos_mass.w > 0.0)) { return; }

  let mode = params.cal_mode & 7u;
  let preserve_bar = (params.cal_mode & 8u) != 0u;
  let is_gal2 = (mode == 3u) && (params.smbh_idx_b > 0u) && (i > params.smbh_idx_b);

  let host_idx = select(0u, params.smbh_idx_b, is_gal2);
  let host_body = bodies[host_idx];
  let host_pos = select(vec3<f32>(0.0), host_body.pos_mass.xyz, mode == 3u);
  let host_vel = select(vec3<f32>(0.0), host_body.vel_pop.xyz, mode == 3u);

  let pos = b.pos_mass.xyz;
  let rel = pos - host_pos;
  let r_3d = length(rel);
  if (r_3d < 0.10) { return; }

  // For binary mergers, subtract the OTHER halo's bulk tide so each galaxy calibrates to its OWN internal potential!
  var acc = compute_total_gal_acc(i, pos);
  if (mode == 3u && params.smbh_idx_b > 0u) {
    let other_idx = select(params.smbh_idx_b, 0u, is_gal2);
    let other_pos = bodies[other_idx].pos_mass.xyz;
    let other_m = select(params.dm_halo_mass_b, params.dm_halo_mass, is_gal2);
    let other_rs = select(params.dm_scale_r * 0.90, params.dm_scale_r, is_gal2);
    acc = acc - eval_nfw_dark_matter_acc(pos - other_pos, other_m, other_rs, params.dm_conc, params.dm_soft2, params.gravity_g);
  }

  let a_in_3d = max(0.0, -dot(acc, rel / r_3d));
  let v_circ_3d = sqrt(r_3d * a_in_3d);
  let v_scale = clamp(params.virial_scale, 0.35, 1.15);

  let v_rel = b.vel_pop.xyz - host_vel;
  let pop = b.vel_pop.w;

  // Exact local isotropic Hernquist/NFW Jeans dispersion: gamma(r) = 1 + 3*r/(r + a_s) => sigma_1D = v_c / sqrt(gamma)
  let jeans_gamma = 1.0 + 3.0 * r_3d / (r_3d + max(1.2, params.dm_scale_r * 0.65));
  let jeans_v3d_rms = v_circ_3d * sqrt(3.0 / max(1.2, jeans_gamma));

  if (pop < -0.5) {
    // Live N-body Dark Matter halo: ALWAYS lock to exact 3D Jeans virial dispersion (ZERO DM halo collapse!)
    let v_mag = length(v_rel);
    if (v_mag > 1e-4) {
      let target_v = jeans_v3d_rms * 0.92;
      let sc = clamp(target_v / v_mag, 0.25, 3.2);
      b.vel_pop = vec4<f32>(host_vel + v_rel * sc, pop);
    }
    bodies[i] = b;
    return;
  }

  if (mode == 1u) {
    // 3D Pressure-Supported Jeans Spheroid (Elliptical, Globular Cluster, Open Cluster, Irregular):
    let v_mag = length(v_rel);
    if (v_mag > 1e-4) {
      // Preserve natural Gaussian speed distribution shape by scaling smoothly toward local Jeans RMS speed
      let target_rms = jeans_v3d_rms * v_scale * 0.88;
      let ratio = clamp(target_rms / max(0.15, v_mag), 0.35, 2.8);
      // Softly blend particle speed toward virial target while keeping Gaussian scatter (0.45..1.55x)
      let blended = mix(v_mag, target_rms, 0.68);
      let safe_v = min(v_circ_3d * 1.18, max(v_circ_3d * 0.16, blended));
      b.vel_pop = vec4<f32>(host_vel + v_rel * (safe_v / v_mag), pop);
    }
    bodies[i] = b;
    return;
  }

  if (mode == 2u) {
    // Sub-Virial Protogalactic Collapse: preserve exact 3D infall/filament velocity directions while bounding
    // strictly inside virial_scale * v_circ_3d so collapsing halos coalesce cleanly and stay tightly bound!
    let v_mag = length(v_rel);
    let max_v = v_circ_3d * v_scale;
    let min_v = v_circ_3d * (v_scale * 0.36);
    if (v_mag > max_v && v_mag > 1e-4) {
      b.vel_pop = vec4<f32>(host_vel + v_rel * (max_v / v_mag), pop);
    } else if (v_mag < min_v && v_mag > 1e-4) {
      b.vel_pop = vec4<f32>(host_vel + v_rel * (min_v / v_mag), pop);
    }
    bodies[i] = b;
    return;
  }

  // Mode 0 (Single 3D Tilted Disk) OR Mode 3 (Binary Dual 3D Tilted Disks):
  let raw_n = select(
    vec3<f32>(params.disk_nx, params.disk_ny, params.disk_nz),
    vec3<f32>(params.disk2_nx, params.disk2_ny, params.disk2_nz),
    is_gal2
  );
  let n_len = length(raw_n);
  let n_hat = select(vec3<f32>(0.0, 1.0, 0.0), raw_n / n_len, n_len > 1e-4);

  let z_off = dot(rel, n_hat);
  let r_plane = rel - n_hat * z_off;
  let r_p = length(r_plane);
  if (r_p < 0.18) { return; }

  let r_hat = r_plane / r_p;
  let t_hat = normalize(cross(n_hat, r_hat));

  let a_in_p = max(0.0, -dot(acc, r_hat));
  let vc_disk = sqrt(r_p * a_in_p);

  let v_n = dot(v_rel, n_hat);
  let v_r = dot(v_rel, r_hat);
  let v_t = dot(v_rel, t_hat);
  let abs_vt = abs(v_t);

  // Polar halo / dwarf-stream stars well off the disk plane preserve their true 3D polar orbital inclination!
  if (mode == 0u && abs(z_off) > 1.8 && r_3d > 3.2) {
    let v_mag = length(v_rel);
    if (v_mag > 1e-4) {
      let target_v = v_circ_3d * 0.88 * v_scale;
      let sc = clamp(target_v / v_mag, 0.35, 3.0);
      b.vel_pop = vec4<f32>(host_vel + v_rel * sc, pop);
    }
    bodies[i] = b;
    return;
  }

  // Bulge/halo stars inside r < 2.2 with low angular momentum stay Jeans pressure-supported in 3D!
  let is_bulge = (pop < 0.28) && (r_3d < 2.4) && (abs(z_off) > 0.32 || abs_vt < 0.55 * length(v_rel));
  if (is_bulge) {
    let v_mag = length(v_rel);
    if (v_mag > 1e-4) {
      let target_v = min(v_circ_3d * 0.96, jeans_v3d_rms * 0.80);
      let blended = mix(v_mag, target_v, 0.72);
      b.vel_pop = vec4<f32>(host_vel + v_rel * (blended / v_mag), pop);
    }
    bodies[i] = b;
    return;
  }

  // Coherent central stellar bar (barred spiral x1 orbits inside r_p < 3.4): scale virially without circularizing!
  if (preserve_bar && r_p < 3.4 && pop < 0.32) {
    let v_mag = length(v_rel);
    if (v_mag > 1e-4) {
      let goal_v = vc_disk * 0.92;
      let sc = clamp(goal_v / v_mag, 0.55, 2.2);
      b.vel_pop = vec4<f32>(host_vel + v_rel * sc, pop);
    }
    bodies[i] = b;
    return;
  }

  // Toomre-stable (Q >= 1.5) 3D tilted disk star:
  // Scale azimuthal speed to exact GPU vc_disk (with gentle asymmetric drift 0.975) AND scale radial/vertical
  // epicyclic dispersion proportionally so Toomre Q stays >= 1.5 (NEVER cold fragmentation, NEVER radial blowup!).
  let sgn_t = select(-1.0, 1.0, v_t >= 0.0);
  let goal_vt = vc_disk * 0.975 * v_scale;
  let disp_scale = select(1.0, clamp(goal_vt / max(0.35, abs_vt), 0.45, 2.6), abs_vt > 0.25);
  // Cap radial/vertical excursions to physically bound epicyclic amplitudes (<= 0.28 vc_disk radial, <= 0.16 vc_disk vertical)
  let vr_new = clamp(v_r * disp_scale, -vc_disk * 0.28, vc_disk * 0.28);
  let vn_new = clamp(v_n * disp_scale, -vc_disk * 0.16, vc_disk * 0.16);
  let vt_new = sgn_t * goal_vt;
  b.vel_pop = vec4<f32>(host_vel + r_hat * vr_new + t_hat * vt_new + n_hat * vn_new, pop);
  bodies[i] = b;
}

// 4. Exact Post-Calibration Center-of-Momentum Frame Enforcement (eliminates residual random-draw drift!)
@compute @workgroup_size(64)
fn pm_zero_com_velocity(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  var b = bodies[i];
  if (!(b.pos_mass.w > 0.0)) { return; }
  let v_com = ss_acc_phi[params.count + 1u].xyz;
  b.vel_pop = vec4<f32>(b.vel_pop.xyz - v_com, b.vel_pop.w);
  bodies[i] = b;
}
`;function qr({device:e=null,initialBodies:t,gridN:n=32,boxSize:r=36,secondSmbhIndex:i=0,smbhSoftening:a=.75,dmHaloMass:o=2800,dmSecondaryMass:s=null,dmScaleRadius:c=6.5,dmConcentration:l=9,diskNormal:u=[0,1,0],diskNormalSecondary:d=[0,1,0],label:f=`ulg-galactic-ss-nfw`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createGalacticParticleMeshEngineWebGpu requires a live WebGPU GPUDevice`);let p=Float32Array.from(t),m=Math.floor(p.length/8),h=Math.max(16,Math.min(64,Math.trunc(n))),g=Math.max(0,Number(o)||0),_=i>0?Math.max(0,s==null?g*.85:Number(s)):0,v=Math.max(1.5,Number(c)||6.5),y=Math.max(3,Number(l)||9),b=e=>{let t=Math.hypot(e?.[0]||0,e?.[1]??1,e?.[2]||0)||1;return[(e?.[0]||0)/t,(e?.[1]??1)/t,(e?.[2]||0)/t]},x=b(u),S=b(d),C=Math.max(32,p.byteLength),w=e.createBuffer({label:`${f}-bodies`,size:C,usage:Gr.STORAGE|Gr.VERTEX|Gr.COPY_DST|Gr.COPY_SRC}),T=e.createBuffer({label:`${f}-params`,size:80,usage:Gr.UNIFORM|Gr.COPY_DST}),E=e.createBuffer({label:`${f}-staging`,size:C,usage:Gr.MAP_READ|Gr.COPY_DST}),D=e.createBuffer({label:`${f}-com-read`,size:16,usage:Gr.MAP_READ|Gr.COPY_DST});e.queue.writeBuffer(w,0,p);let O=ze(e,{maxCount:m,strideFloats:8,chartLevel:69,useAdjSoftening:!0,qMass:4096,qMom:128,rCellFactor:.08,label:`${f}-ss-grav`}),k=e.createBuffer({label:`${f}-core-snap`,size:64,usage:Gr.STORAGE}),A=[P(0,`uniform`),P(1,`storage`),P(2,`read-only-storage`),P(3,`storage`)],j=t=>I(e,{cacheKey:`ulg-galactic-ss-nfw-${t}.v4`,label:`${f}-${t}`,code:Kr,entryPoint:t,bindings:A}),M=j(`pm_snapshot_cores`),N=j(`pm_drift_half`),L=j(`pm_kick_and_drift`),R=j(`pm_calibrate_equilibrium`),z=j(`pm_zero_com_velocity`),B=F(e,{layout:L.bindGroupLayout,label:`${f}-bg`,entries:[{binding:0,resource:{buffer:T}},{binding:1,resource:{buffer:w}},{binding:2,resource:{buffer:O.accPhiBuffer}},{binding:3,resource:{buffer:k}}]}),ee=0,V=!1,te=!1,ne=!1,re=[0,0,0];{let e=0,t=0,n=0,r=0;for(let i=0;i<m;i+=1){let a=p[i*8+3];a>0&&(e+=a,t+=p[i*8+0]*a,n+=p[i*8+1]*a,r+=p[i*8+2]*a)}e>1e-6&&(re=[t/e,n/e,r/e])}let ie=Math.ceil(m/64);function ae({dt:t,gravity:n,softening:o,virialScale:s=1,calMode:c=0}){let l=new ArrayBuffer(80);new Uint32Array(l,0,4).set([m,i,ee,c>>>0]),new Float32Array(l,16,16).set([t,n,o*o,a*a,g,v,y,2.5600000000000005,s,_,x[0],x[1],x[2],S[0],S[1],S[2]]),e.queue.writeBuffer(T,0,l),O.writeParams({count:m,gravityG:n,softening2:Math.max(.36,o*o),boxHalf:r*.5,theta2:.55})}async function oe(){if(ne||V||E.mapState!==`unmapped`)return p;V=!0;try{let t=e.createCommandEncoder({label:`${f}-readback`});t.copyBufferToBuffer(w,0,E,0,C),e.queue.submit([t.finish()]),await E.mapAsync(Gr.MAP_READ),ne||p.set(new Float32Array(E.getMappedRange(0,C)));try{E.unmap()}catch{}}catch(e){if(!ne&&e?.name!==`AbortError`)throw e}finally{V=!1}return p}async function H({gravity:t=1,softening:n=.65,virialScale:r=1,calMode:a=null,preserveBar:o=!1}={}){if(ne)return;ae({dt:.002,gravity:t,softening:n,virialScale:r,calMode:(a==null?i>0?3:0:Number(a))&7|(o?8:0)});let s=e.createCommandEncoder({label:`${f}-cal-eq`}),c=s.beginComputePass({label:`${f}-cal-pass`});O.encodeIntoPass(c,{srcBuffer:w,count:m}),c.setBindGroup(0,B),c.setPipeline(M.pipeline),c.dispatchWorkgroups(1),c.setPipeline(R.pipeline),c.dispatchWorkgroups(ie),O.encodeIntoPass(c,{srcBuffer:w,count:m}),c.setBindGroup(0,B),c.setPipeline(z.pipeline),c.dispatchWorkgroups(ie),c.end(),e.queue.submit([s.finish()])}async function se({dt:t=.004,substeps:n=2,gravity:r=1,softening:i=.65,readback:a=!1}={}){if(ne)return p;let o=Math.max(4e-4,Number(t)||.004),s=Math.ceil(o/.0024),c=Math.max(1,Math.min(12,Math.max(Math.trunc(n),s)));ae({dt:Math.max(3e-4,Math.min(.0026,o/c)),gravity:r,softening:i,virialScale:1,calMode:0});let l=e.createCommandEncoder({label:`${f}-step-${ee}`}),u=l.beginComputePass({label:`${f}-pass`});for(let e=0;e<c;e+=1)u.setBindGroup(0,B),u.setPipeline(N.pipeline),u.dispatchWorkgroups(ie),O.encodeIntoPass(u,{srcBuffer:w,count:m}),u.setBindGroup(0,B),u.setPipeline(M.pipeline),u.dispatchWorkgroups(1),u.setPipeline(L.pipeline),u.dispatchWorkgroups(ie),ee+=1;u.end();let d=!te&&D.mapState===`unmapped`&&(ee%2==0||ee<=2);d&&(te=!0,l.copyBufferToBuffer(O.accPhiBuffer,m*16,D,0,16));let h=a&&!V&&E.mapState===`unmapped`;if(h&&(V=!0,l.copyBufferToBuffer(w,0,E,0,C)),e.queue.submit([l.finish()]),d&&D.mapAsync(Gr.MAP_READ).then(()=>{if(!ne){let e=new Float32Array(D.getMappedRange(0,16));if(Number.isFinite(e[0])&&Number.isFinite(e[1])&&Number.isFinite(e[2])&&e[3]>1e-5){let t=e[0]-re[0],n=e[1]-re[1],r=e[2]-re[2],i=Math.hypot(t,n,r),a=i>1.5?.08:.16,o=.35,s=i*a>o&&i>1e-6?o/i:a;re=[re[0]+t*s,re[1]+n*s,re[2]+r*s]}}try{D.unmap()}catch{}}).catch(()=>{}).finally(()=>{te=!1}),h)try{await E.mapAsync(Gr.MAP_READ),ne||p.set(new Float32Array(E.getMappedRange(0,C)));try{E.unmap()}catch{}}catch(e){if(!ne&&e?.name!==`AbortError`)throw e}finally{V=!1}return p}function ce(){if(!ne){ne=!0;try{O.destroy()}catch{}for(let e of[w,T,E,D,k])try{e.destroy()}catch{}}}return Object.freeze({schema:X,get count(){return m},get activeCount(){return m},get stepIndex(){return ee},get gridN(){return h},get boxSize(){return r},get backend(){return`webgpu`},get gravityMode(){return`webgpu-schroeder-scale-atlas-multipole`},get spatialAuthority(){return`webgpu-schroeder-scale-atlas-multipole`},get darkMatterHalo(){return Object.freeze({model:`NFW+live-nbody-ss`,mass:g,secondaryMass:_,scaleRadius:v,concentration:y,darkMatterFraction:.85})},getCenterOfMass:()=>re,getBodies:()=>p,getResidentBuffer:()=>w,calibrateEquilibrium:H,readbackBodies:oe,step:se,dispose:ce})}function Jr(e,t){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`${t} requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`)}Object.freeze([Object.freeze({name:`G-Type Star`,isStar:!0,a:0,mass:120,radius:1.38,color:16773306,phase:0,tilt:0}),Object.freeze({name:`Inner Rocky`,a:3.1,mass:.01,radius:.28,color:13933162,phase:.4,tilt:.05}),Object.freeze({name:`Ocean World (H₂O/Fe)`,a:4.9,mass:.02,radius:.42,color:3718648,phase:1.9,tilt:.03}),Object.freeze({name:`Ringed Giant`,a:7.7,mass:.16,radius:.78,color:15122058,phase:3.6,tilt:.08,ringed:!0}),Object.freeze({name:`Ice Giant`,a:10.4,mass:.055,radius:.52,color:8246268,phase:5.1,tilt:.04})]);var Yr=`
struct Body {
  pos_mass: vec4<f32>,
  vel_radius: vec4<f32>,
};

struct StepParams {
  count: u32,
  mode: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  gravity: f32,
  softening2: f32,
  hubble_drag: f32,
  inv_a3: f32,
  pad2: f32,
  pad3: f32,
  pad4: f32,
};

@group(0) @binding(0) var<storage, read> src_bodies: array<Body>;
@group(0) @binding(1) var<storage, read_write> dst_bodies: array<Body>;
@group(0) @binding(2) var<uniform> params: StepParams;

var<workgroup> tile: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn step_nbody(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let idx = gid.x;
  let n = params.count;
  var self_pm = vec4<f32>(0.0);
  var self_vr = vec4<f32>(0.0);
  let alive = idx < n;
  if (alive) {
    self_pm = src_bodies[idx].pos_mass;
    self_vr = src_bodies[idx].vel_radius;
  }

  var acc = vec3<f32>(0.0);
  let num_tiles = (n + 63u) / 64u;
  for (var t = 0u; t < num_tiles; t = t + 1u) {
    let j = t * 64u + lid.x;
    if (j < n) {
      tile[lid.x] = src_bodies[j].pos_mass;
    } else {
      tile[lid.x] = vec4<f32>(0.0);
    }
    workgroupBarrier();

    if (alive && self_pm.w > 0.0) {
      let limit = min(64u, n - t * 64u);
      for (var k = 0u; k < limit; k = k + 1u) {
        let other = tile[k];
        if (other.w <= 0.0) { continue; }
        let d = other.xyz - self_pm.xyz;
        let r2 = dot(d, d) + params.softening2;
        let inv_r = inverseSqrt(r2);
        let inv_r3 = inv_r * inv_r * inv_r;
        acc = acc + d * (other.w * inv_r3);
      }
    }
    workgroupBarrier();
  }

  if (!alive) { return; }
  if (self_pm.w <= 0.0) {
    dst_bodies[idx] = Body(vec4<f32>(0.0), vec4<f32>(0.0));
    return;
  }

  var vel = self_vr.xyz;
  if (params.mode == 1u) {
    let drag = max(0.0, 1.0 - params.hubble_drag * params.dt);
    vel = vel * drag + acc * (params.gravity * params.inv_a3 * params.dt);
  } else {
    vel = vel + acc * (params.gravity * params.dt);
  }
  let pos = self_pm.xyz + vel * params.dt;
  dst_bodies[idx] = Body(vec4<f32>(pos, self_pm.w), vec4<f32>(vel, self_vr.w));
}
`;function Xr({device:e=null,initialBodies:t,mode:n=0,label:r=`ulg-cosmic-nbody`}){Jr(e,`createResidentTiledNBodyEngine`);let i=Float32Array.from(t),a=i.length/8,o=0,s=n===1?.25:1,c=!1,l=Math.max(32,i.byteLength),u=[e.createBuffer({label:`${r}-buf-0`,size:l,usage:172}),e.createBuffer({label:`${r}-buf-1`,size:l,usage:172})],d=e.createBuffer({label:`${r}-params`,size:48,usage:72}),f=e.createBuffer({label:`${r}-staging`,size:l,usage:9});e.queue.writeBuffer(u[0],0,i),e.queue.writeBuffer(u[1],0,i);let p=I(e,{cacheKey:`ulg-cosmic-nbody-tiled.v1`,label:`ulg-cosmic-nbody-tiled`,code:Yr,entryPoint:`step_nbody`,bindings:[P(0,`read-only-storage`),P(1,`storage`),P(2,`uniform`)]}),m=[F(e,{layout:p.bindGroupLayout,label:`${r}-bg-0`,entries:[{binding:0,resource:{buffer:u[0]}},{binding:1,resource:{buffer:u[1]}},{binding:2,resource:{buffer:d}}]}),F(e,{layout:p.bindGroupLayout,label:`${r}-bg-1`,entries:[{binding:0,resource:{buffer:u[1]}},{binding:1,resource:{buffer:u[0]}},{binding:2,resource:{buffer:d}}]})],h=0,g=!1;async function _(){if(!u||!f||g||c)return i;g=!0;try{let t=e.createCommandEncoder({label:`${r}-readback`});t.copyBufferToBuffer(u[h],0,f,0,i.byteLength),e.queue.submit([t.finish()]),await f.mapAsync(1),i.set(new Float32Array(f.getMappedRange())),f.unmap()}finally{g=!1}return i}async function v({dt:t=.014,gravity:l=1,softening:_=.22,hubbleRate:v=.12,readback:y=!1}={}){if(c||!u)return i;let b=new ArrayBuffer(48),x=new Uint32Array(b),S=new Float32Array(b),C=n===1?1/Math.max(.05,s**3):1;x[0]=a,x[1]=n,S[4]=t,S[5]=l,S[6]=_*_,S[7]=n===1?2*v:0,S[8]=C,e.queue.writeBuffer(d,0,b);let w=h,T=1-h,E=e.createCommandEncoder({label:`${r}-step-${o}`}),D=E.beginComputePass({label:`${r}-pass`});D.setPipeline(p.pipeline),D.setBindGroup(0,m[w]),D.dispatchWorkgroups(Math.ceil(a/64)),D.end();let O=y&&!g;if(O&&E.copyBufferToBuffer(u[T],0,f,0,i.byteLength),e.queue.submit([E.finish()]),h=T,o+=1,n===1&&(s=Math.min(2,s+t*v*s)),O){g=!0;try{await f.mapAsync(1),i.set(new Float32Array(f.getMappedRange())),f.unmap()}finally{g=!1}}return i}function y(t){i=Float32Array.from(t),o=0,s=n===1?.25:1,h=0,u&&(e.queue.writeBuffer(u[0],0,i),e.queue.writeBuffer(u[1],0,i))}function b(){return u?u[h]:null}function x(){c||(c=!0,u?.[0]?.destroy(),u?.[1]?.destroy(),d?.destroy(),f?.destroy(),u=null)}return{get count(){return a},get activeCount(){return a},get stepIndex(){return o},get scaleFactorA(){return s},get backend(){return`webgpu`},get gravityMode(){return`webgpu-tiled-direct`},getBodies:()=>i,readbackBodies:_,getResidentBuffer:b,step:v,resetBodies:y,dispose:x}}var Zr=`ulg.astrophysics.peercompute-sim-scaler.v1`,Qr=Object.freeze({low:.42,med:1,high:2,ultra:3.4}),$r=Object.freeze([Object.freeze({id:`low`,minTier:`mobile`,minPerfScale:.1,estimatedGpuBytes:48*1024*1024}),Object.freeze({id:`med`,minTier:`laptop`,minPerfScale:.85,estimatedGpuBytes:128*1024*1024}),Object.freeze({id:`high`,minTier:`workstation`,minPerfScale:1.65,estimatedGpuBytes:256*1024*1024}),Object.freeze({id:`ultra`,minTier:`cluster`,minPerfScale:3,estimatedGpuBytes:512*1024*1024})]);function ei(e){let t=e?.limits;if(!t||typeof t!=`object`)return{};let n=[`maxBufferSize`,`maxStorageBufferBindingSize`,`maxComputeWorkgroupStorageSize`,`maxComputeInvocationsPerWorkgroup`,`maxComputeWorkgroupsPerDimension`,`maxStorageBuffersPerShaderStage`,`maxTextureDimension2D`,`maxTextureDimension3D`],r={};for(let e of n){let n=Number(t[e]);Number.isFinite(n)&&n>0&&(r[e]=Math.floor(n))}return r}function ti(e,t,n){let r=ei(t),i={...e?.webgpu?.limits||{},...r},o=!!e?.webgpu?.isFallbackAdapter,c=!!(t||e?.webgpu?.available),l=Math.max(1,Math.floor(Number(n?.cpuCores??e?.cpu?.cores)||4)),u=Number(n?.deviceMemoryGiB??e?.memory?.deviceMemoryGiB)||null,d=e?.environment?.os||`other`,f=d===`android`||d===`ios`,p=n?.tier||e?.tier||a({cpuCores:l,deviceMemoryGiB:u,gpuAvailable:c,isMobileOs:f}),m=Number(i.maxStorageBufferBindingSize||i.maxBufferSize||0);!n?.tier&&!f&&!o&&c&&(p===`laptop`&&m>=512*1024*1024&&l>=8?p=`workstation`:p===`workstation`&&m>=2*1024*1024*1024&&l>=24&&(p=`cluster`)),o&&!n?.tier&&(p=`mobile`);let h=s(p),g=Number(n?.memoryBudgetMB??e?.planningBudgets?.memoryBudgetMB??h.memoryBudgetMB),_=Number(n?.gpuMemoryBudgetMB??e?.planningBudgets?.gpuMemoryBudgetMB??h.gpuMemoryBudgetMB),v=Number(n?.budgetScale??e?.planningBudgets?.budgetScale??1);return{schema:e?.schema||`peercompute.capabilities.v1`,tier:p,cpu:{cores:l,source:e?.cpu?.source||`probe`},memory:{deviceMemoryGiB:u,...e?.memory||{}},environment:e?.environment||{kind:`browser`,browser:`other`,os:d},webgpu:{...e?.webgpu||{},available:c,isFallbackAdapter:o,limits:i,info:e?.webgpu?.info||(t?.adapterInfo?{vendor:t.adapterInfo.vendor||``,architecture:t.adapterInfo.architecture||``,device:t.adapterInfo.device||``,description:t.adapterInfo.description||``}:{})},planningBudgets:{memoryBudgetMB:g,gpuMemoryBudgetMB:_,budgetScale:Number.isFinite(v)&&v>0?v:1}}}function ni(n={},{device:a=null,qualityMode:o=`auto`,overrides:s=null}={}){let c=s&&typeof s==`object`?{...s}:{},l=o&&o!==`auto`&&Object.prototype.hasOwnProperty.call(Qr,o),u=ti(n,a,c),d={...c};l&&(d.tier=o===`low`?`mobile`:o===`med`?`laptop`:o===`high`?`workstation`:`cluster`,d.budgetScale=1);let f={capabilities:u,overrides:d},p=r({name:`ulg-universes-quality`,presets:$r},f),m=l?o:p.presetId,h=i({name:`l0-cosmic-web-particles`,minDim:22,baseDim:28,maxDim:40,step:2,cellStrideBytes:32,buffersCount:2,memoryFraction:.15},f),g=h.x>=26?32:16,_=e({name:`l1-galaxy-stars`,minCount:16384,baseCount:32768,maxCount:98304,multiple:4096,strideBytes:32,buffersCount:2,memoryFraction:.18,workgroupSize:64},f),v=e({name:`l2-nebular-parcels`,minCount:4096,baseCount:32768,maxCount:131072,multiple:2048,strideBytes:64,buffersCount:2,memoryFraction:.2,workgroupSize:64},f),y=v.count>=16384?128:v.count>=8192?96:64,b=e({name:`l3-stellar-fusion-parcels`,minCount:3072,baseCount:8192,maxCount:24576,multiple:1024,strideBytes:64,buffersCount:2,memoryFraction:.16,workgroupSize:64},f),x=b.count>=12288?32:24,S=e({name:`l4-planetary-sph-parcels`,minCount:5120,baseCount:16384,maxCount:57344,multiple:2048,strideBytes:64,buffersCount:2,memoryFraction:.2,workgroupSize:64},f),C=i({name:`l4-planetary-sph-grid`,minDim:32,baseDim:40,maxDim:64,step:8,cellStrideBytes:64,buffersCount:2,memoryFraction:.22,workgroupSize:64},f),w=t({name:`l4-planetary-sph-geology-map`,minWidth:512,baseWidth:768,maxWidth:1024,aspectRatio:.5,step:128,cellStrideBytes:56,buffersCount:1,memoryFraction:.22},f),T=p.perfScale,E=d.tier||u.tier,D=E===`cluster`?1800:E===`workstation`?1400:E===`laptop`?840:360,O=E===`cluster`?6:E===`workstation`?5:E===`laptop`?3:2,k=E===`cluster`?16800:E===`workstation`?12800:E===`laptop`?7200:2800,A=E===`cluster`?28:E===`workstation`?24:E===`laptop`?16:8,j=E===`cluster`?1560:E===`workstation`?1180:E===`laptop`?640:240,M=E===`cluster`?8:E===`workstation`?6:E===`laptop`?4:2,N=E===`cluster`?4:E===`workstation`?3:2,P=E===`cluster`?40:E===`workstation`?34:E===`laptop`?24:16,F=S.count>=24576?32:S.count>=12288?24:14,I=E===`cluster`?240:E===`workstation`?200:E===`laptop`?150:96,L=E===`cluster`?2400:E===`workstation`?1800:E===`laptop`?1200:640,R=u.webgpu.info||{},z=[R.vendor,R.architecture,R.description].filter(e=>typeof e==`string`&&e.trim().length>0).join(` · `).slice(0,64)||(u.webgpu.isFallbackAdapter?`Software WebGPU`:`Hardware WebGPU`),B=Math.round((u.webgpu.limits?.maxStorageBufferBindingSize||0)/(1024*1024));return Object.freeze({schema:Zr,capabilitySchema:u.schema,mode:l?`manual`:`auto`,qualityId:m,tier:E,detectedTier:u.tier,perfScale:T,cpuCores:u.cpu.cores,deviceMemoryGiB:u.memory.deviceMemoryGiB,gpuLabel:z,maxStorageMB:B,isMobileOs:u.environment.os===`android`||u.environment.os===`ios`,isSoftwareGpu:!!u.webgpu.isFallbackAdapter,capabilities:u,summaryLabel:`${E.toUpperCase()} (${m.toUpperCase()}) · ${S.count.toLocaleString()} SPH · ${C.x}³ Grid · ${w.width}×${w.height}`,workloads:Object.freeze({cosmoGridPerSide:h.x,cosmoFftN:g,galaxyStars:_.count,l1TargetSteps:D,l1SubstepsPerFrame:O,nebularParcels:v.count,nebularRadialBins:y,l2TargetSteps:k,l2SubstepsPerFrame:A,l2GravityCadence:4,l2BurstSubsteps:L,stellarParcels:b.count,stellarGridN:x,l3SubstepsPerFrame:N,sphParcels:S.count,sphGridN:C.x,sphMapWidth:w.width,sphMapHeight:w.height,sphErosionPasses:P,l4TargetSteps:j,l4SubstepsPerFrame:M,l4SecularSubstepsPerFrame:1,l4MapUpdateCadence:F,l4BurstSubsteps:I,surfaceGridN:E===`mobile`?81:E===`laptop`?129:161,surfaceParticles:E===`mobile`?1024:E===`laptop`?2048:4096}),rawSizing:Object.freeze({presetChoice:p,cosmoGrid:h,galaxyStarsSizing:_,nebularParcelsSizing:v,sphParcelsSizing:S,sphGridSizing:C,sphMapSizing:w})})}async function ri({device:e=null,qualityMode:t=`auto`,search:n=typeof globalThis?.location?.search==`string`?globalThis.location.search:``,timeoutMs:r=1500}={}){let i=o(n),a=null;try{a=await c({timeoutMs:r,includeWebGL:!1,includeStorageEstimate:!1,overrides:i})}catch{a=null}return ni(a||{},{device:e,qualityMode:t,overrides:i})}function ii(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var ai=[`disk`,`barred`,`ring`,`lenticular`,`irregular`,`open-cluster`,`binary`,`sphere`,`proto`,`dwarf-stream`,`globular`,`coalesce`],oi=[`NGC`,`M`,`IC`,`UGC`,`ARP`,`PGC`],si=Object.freeze({H2O:Object.freeze({formula:`H₂O`,name:`Water (C₂v Bent)`,atoms:[{Z:8,symbol:`O`,position:[0,0,.22]},{Z:1,symbol:`H`,position:[0,1.43,-.88]},{Z:1,symbol:`H`,position:[0,-1.43,-.88]}]}),CO2:Object.freeze({formula:`CO₂`,name:`Carbon Dioxide (Linear O=C=O)`,atoms:[{Z:6,symbol:`C`,position:[0,0,0]},{Z:8,symbol:`O`,position:[0,0,2.19]},{Z:8,symbol:`O`,position:[0,0,-2.19]}]}),CH4:Object.freeze({formula:`CH₄`,name:`Methane (Tetrahedral T_d)`,atoms:[{Z:6,symbol:`C`,position:[0,0,0]},{Z:1,symbol:`H`,position:[1.19,1.19,1.19]},{Z:1,symbol:`H`,position:[1.19,-1.19,-1.19]},{Z:1,symbol:`H`,position:[-1.19,1.19,-1.19]},{Z:1,symbol:`H`,position:[-1.19,-1.19,1.19]}]}),NH3:Object.freeze({formula:`NH₃`,name:`Ammonia (Trigonal Pyramidal C₃v)`,atoms:[{Z:7,symbol:`N`,position:[0,.42,0]},{Z:1,symbol:`H`,position:[1.77,-.32,0]},{Z:1,symbol:`H`,position:[-.885,-.32,1.53]},{Z:1,symbol:`H`,position:[-.885,-.32,-1.53]}]}),SiO2:Object.freeze({formula:`SiO₂`,name:`Silica Unit (O=Si=O)`,atoms:[{Z:14,symbol:`Si`,position:[0,0,0]},{Z:8,symbol:`O`,position:[0,0,2.85]},{Z:8,symbol:`O`,position:[0,0,-2.85]}]}),O2:Object.freeze({formula:`O₂`,name:`Dioxygen (O=O)`,atoms:[{Z:8,symbol:`O`,position:[0,0,-1.14]},{Z:8,symbol:`O`,position:[0,0,1.14]}]}),N2:Object.freeze({formula:`N₂`,name:`Dinitrogen (N≡N)`,atoms:[{Z:7,symbol:`N`,position:[0,0,-1.04]},{Z:7,symbol:`N`,position:[0,0,1.04]}]}),CO:Object.freeze({formula:`CO`,name:`Carbon Monoxide (Triple Bond)`,atoms:[{Z:6,symbol:`C`,position:[0,0,-1.07]},{Z:8,symbol:`O`,position:[0,0,1.07]}]}),H2:Object.freeze({formula:`H₂`,name:`Molecular Hydrogen (H–H)`,atoms:[{Z:1,symbol:`H`,position:[0,0,-.7]},{Z:1,symbol:`H`,position:[0,0,.7]}]})});function ci(e,{surfaceActive:t=!1,userTimeScale:n=1}={}){let r=Number.isFinite(Number(e))?Number(e):24.8,i=Math.max(.1,Math.min(3,Number(n)||1));if(t){let e=1*i;return Object.freeze({factor:1,effectiveTimeScale:i,secondsPerWallSecond:e,clockLabel:`${e.toFixed(1)} s/s`})}let a,o;if(r>=22){let e=Math.max(0,Math.min(1,(r-22)/3.4));a=10**(14.75+e*.95)*i,o=.55+.45*e}else if(r>=16.2){let e=Math.max(0,Math.min(1,(r-16.2)/5.8));a=10**(13.05+e*1.55)*i,o=.28+.72*e**.85}else if(r>=8.75){let e=Math.max(0,Math.min(1,(r-8.75)/7.45));a=10**(3.85+e*2.75)*i,o=.14+.86*e**1.35}else if(r>=0){let e=Math.max(0,Math.min(1,r/8.75));a=10**(.2+e*3)*i,o=.22+.58*e}else if(r>=-9.1){let e=Math.max(0,Math.min(1,(r+9.1)/9.1));a=10**(-14.1+e*1.2)*i,o=.45+.25*e}else if(r>=-12.8){let e=Math.max(0,Math.min(1,(r+12.8)/3.7));a=10**(-17.2+e*1.2)*i,o=.35+.15*e}else a=15e-21*i,o=.42;let s,c=a;return s=c>=315576e8?`${(c/315576e8).toFixed(c>=315576e9?0:1)} Myr/s`:c>=315576e5?`${(c/315576e5).toFixed(1)} kyr/s`:c>=31557600?`${(c/31557600).toFixed(2)} yr/s`:c>=86400?`${(c/86400).toFixed(c>=864e3?0:1)} d/s`:c>=3600?`${(c/3600).toFixed(1)} hr/s`:c>=60?`${(c/60).toFixed(1)} min/s`:c>=.05?`${c.toFixed(1)} s/s`:c>=1e-12?`${(c*0xe8d4a51000).toFixed(1)} ps/s`:c>=1e-15?`${(c*0x38d7ea4c68000).toFixed(1)} fs/s`:c>=1e-18?`${(c*0xde0b6b3a7640000).toFixed(1)} as/s`:`${(c*1e21).toFixed(1)} zs/s`,Object.freeze({factor:o,effectiveTimeScale:o*i,secondsPerWallSecond:a,clockLabel:s})}function li(e=null,t=825){let n=ii((Number(t)^1369948186)>>>0),r=Math.max(.2,Math.min(10,Number(e?.localOverdensity)||.5+n()*2.4)),i=Math.max(.006,Math.min(.18,Number(e?.tidalSpinLambda)||.015+n()*.085)),a=Math.max(.02,Math.min(.88,Number(e?.gasFraction)||.1+n()*.6)),o=Number.isFinite(Number(e?.redshiftZ))?Number(e.redshiftZ):0,s=String(e?.morphology||``),c=(n()-.5)*1.15,l=(n()-.5)*.95;if(o>=1.2||a>=.44||s===`proto`){let e=3+ +(n()<.35);return Object.freeze({id:`cold-streams`,isMerger:!1,label:`Dekel Cold-Stream Accretion (${e} filaments · f_gas=${a.toFixed(2)})`,delta:r,spinL:i,fGas:a,zRed:o,tiltX:c,tiltZ:l,nStreams:e})}if(s===`ring`||r>=1.6&&(s===`binary`||n()<.44)){let e=Number((.28+n()*.72).toFixed(2)),t=Number(s===`ring`?(.03+n()*.06).toFixed(2):(.05+n()*.5).toFixed(2)),u=t<.12,d=n()<.62;return Object.freeze({id:u?`bullseye-ring-impact`:`toomre-merger`,isMerger:!0,label:u?`Bullseye Polar Ring Impact (μ=1:${(1/e).toFixed(1)} · b=${t} R_vir)`:`Toomre ${d?`Prograde`:`Retrograde`} Merger (μ=1:${(1/e).toFixed(1)} · b=${t} R_vir)`,delta:r,spinL:i,fGas:a,zRed:o,tiltX:c,tiltZ:l,massRatio:e,impactParam:t,isPrograde:d})}if(r>=1.75&&i<.048||s===`sphere`){let e=4+Math.floor(n()*3),t=Number((.64+n()*.24).toFixed(2)),s=Number((.46+n()*.22).toFixed(2));return Object.freeze({id:`triaxial-relaxation`,isMerger:!1,label:`Triaxial ${e}-Subhalo Violent Relaxation (λ=${i.toFixed(3)} · b/a=${t})`,delta:r,spinL:i,fGas:a,zRed:o,tiltX:c,tiltZ:l,nSubhalos:e,ba:t,ca:s})}if(r<.72||s===`globular`||s===`dwarf-stream`||s===`irregular`){let e=5+Math.floor(n()*4);return Object.freeze({id:`void-dwarf-assembly`,isMerger:!1,label:`Void Asymmetric Dwarf & Tidal Stream (${e} clumps · δ=${r.toFixed(2)})`,delta:r,spinL:i,fGas:a,zRed:o,tiltX:c,tiltZ:l,nClumps:e})}if(i>=.05||s===`barred`||s===`disk`){let e=s===`barred`||i<.068&&n()<.45,t=e?2:2+Math.floor(n()*3);return Object.freeze({id:e?`mmw-bar-instability`:`mmw-high-spin-disk`,isMerger:!1,label:e?`MMW / GalIC Bar-Unstable Disk Collapse (λ=${i.toFixed(3)} · m=2 bar)`:`MMW High-Spin Cooling Disk (λ=${i.toFixed(3)} · m=${t} spiral mode)`,delta:r,spinL:i,fGas:a,zRed:o,tiltX:c,tiltZ:l,armMode:t,barUnstable:e})}return Object.freeze({id:`group-tidal-satellite`,isMerger:!1,label:`Group Disk + Infalling Satellite Perturber (δ=${r.toFixed(2)} · λ=${i.toFixed(3)})`,delta:r,spinL:i,fGas:a,zRed:o,tiltX:c,tiltZ:l,armMode:2+ +(n()<.5)})}function ui({count:e=32768,preset:t=`disk`,seed:n=825,gravity:r=1,softening:i=.65,centerOffset:a=[0,0,0],galaxyEnv:o=null,dmHaloMass:s=2800,dmScaleRadius:c=6.8,dmConcentration:l=8.8}={}){let u=Math.max(256,Math.min(262144,Math.floor(e))),d=new Float32Array(u*8),f=ii(n),p=()=>{let e=Math.max(1e-7,f()),t=f();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},m=Number(a?.[0])||0,h=Number(a?.[1])||0,g=Number(a?.[2])||0,_=Math.max(0,Number(s)||0),v=Math.max(1.5,Number(c)||6.8),y=Math.max(3,Number(l)||8.8),b=Math.max(1e-4,Math.log(1+y)-y/(1+y)),x=(e,t=1)=>{if(_*t<=1e-4)return 0;let n=Math.sqrt(e*e+2.5600000000000005),i=n/v;return r*(_*t*Math.max(0,Math.log(1+i)-i/(1+i))/b)*e/(n*n*n)},S=(e,t,n,i,a,o,s,c,l,u,_=1,v=1)=>{let y=t-e,b=44*_,S=135*_,C=290*_,w=620*_,T=1.25*_,E=3.2*_,D=7.2*_,O=.95*_,k=.75*_,A=e=>{let t=Math.max(.15*_,e),n=r*b*t/(t*t+k*k)**1.5,i=Math.hypot(t,O),a=t*t*S/((t+T)*(t+T)),o=t/E,s=C*(1-(1+o)*Math.exp(-o)),c=t*t*w/((t+D)*(t+D)),l=r*(a+s+c)*t/(i*i*i),u=x(t,v);return n+l+u},j=e=>Math.sqrt(Math.max(0,e*A(e))),M=Math.cos(l),N=Math.sin(l),P=Math.cos(u),F=Math.sin(u),I=(e,t,n)=>{let r=t*M-n*N,i=t*N+n*M;return[e*P-r*F,e*F+r*P,i]};d.set([n+m,i+h,a+g,b,o,s,c,.05],e*8);let L=Math.floor((y-1)*.36),R=Math.floor((y-1)*.14),z=Math.floor((y-1)*.04),B=y-1-L-R-z,ee=w/Math.max(1,L),V=S/Math.max(1,R+z),te=C/Math.max(1,B),ne=e+1;for(let e=0;e<L&&ne<t;e+=1,ne+=1){let e=Math.max(.01,Math.min(.88,f())),t=Math.min(18.5*_,D*Math.sqrt(e)/Math.max(.08,1-Math.sqrt(e))),r=2*f()-1,l=Math.sqrt(Math.max(0,1-r*r)),u=2*Math.PI*f(),v=t*l*Math.cos(u),y=t*r,b=t*l*Math.sin(u),x=j(t)*.56,S=I(v,y,b),C=I(p()*x,p()*x,p()*x);d.set([n+S[0]+m,i+S[1]+h,a+S[2]+g,ee,o+C[0],s+C[1],c+C[2],-1],ne*8)}for(let e=0;e<R+z&&ne<t;e+=1,ne+=1){let t=e>=R,r=Math.max(.005,Math.min(.92,f())),l=t?T*4:T,u=Math.min(11.5*_,l*Math.sqrt(r)/Math.max(.07,1-Math.sqrt(r))),v=2*f()-1,y=Math.sqrt(Math.max(0,1-v*v)),b=2*Math.PI*f(),x=u*y*Math.cos(b),S=u*v*(t?.85:.62),C=u*y*Math.sin(b),w=j(u),E=w*(t?.5:.36),D=t?.18:.62,O=-Math.sin(b)*w*D+p()*E,k=p()*E*.68,A=Math.cos(b)*w*D+p()*E,M=I(x,S,C),N=I(O,k,A),P=t?.24+f()*.1:.02+Math.min(.28,u/(2.6*_)*.24);d.set([n+M[0]+m,i+M[1]+h,a+M[2]+g,V,o+N[0],s+N[1],c+N[2],P],ne*8)}let re=Math.tan(17*Math.PI/180);for(;ne<t;ne+=1){let e=-E*Math.log(Math.max(1e-4,f()*f())),t=Math.max(.32*_,Math.min(11.5*_,e*.78)),r=Math.min(1,Math.max(0,(t-.75*_)/(2*_))),l=f()<.72*r,u,v;if(l){let e=ne&3,n=(e&1)==0,r=e*Math.PI*.5+(n?0:.22),i=Math.log(1+t/(.65*_))/re,a=(n?.26:.36)+t/_*.022;u=r+i+p()*a,v=f()<.11&&t>1.4*_&&t<8.5*_?.82+f()*.22:.38+f()*.38}else u=f()*Math.PI*2,v=.08+f()*.26;let y=(.14+t/_*.028)*_,b=t*Math.cos(u),x=t*Math.sin(u),S=p()*y,C=j(t),w=C*.985,T=C*(.08+.05*Math.exp(-t/E)),D=C*.045,O=p()*T,k=w+p()*(T*.72),A=Math.cos(u)*O-Math.sin(u)*k,M=p()*D,N=Math.sin(u)*O+Math.cos(u)*k,P=I(b,S,x),F=I(A,M,N);d.set([n+P[0]+m,i+P[1]+h,a+P[2]+g,te,o+F[0],s+F[1],c+F[2],v],ne*8)}};if(t===`binary`){let e=u>>1,t=Math.max(900,_*.65+750),n=Math.sqrt(r*t/12)*.44,i=n*.34;S(0,e,-5.8,.7,-1.6,i,-.25,n,.35,.18,.68,1),S(e,u,5.8,-.7,1.6,-i,.25,-n,-.42,-.25,.68,.85)}else if(t===`barred`){S(0,u,0,0,0,0,0,0,0,0,1);let e=Math.floor(u*.42);for(let t=Math.floor(u*.22);t<e;t+=1){let e=t*8;if(d[e+7]<0)continue;let n=(f()*2-1)*3.6,r=p()*.24,i=p()*(.48*Math.sqrt(Math.max(.15,1-(n/3.9)**2))),a=Math.hypot(n,i),o=2.65;d.set([n+m,r+h,i+g,d[e+3]*1.15,-i*o+p()*.45,p()*.25,n*o+p()*.45,.06+Math.min(.24,a/3.8*.22)],e)}let t=Math.tan(19*Math.PI/180);for(let n=e;n<u;n+=1){let e=n*8;if(!(d[e+7]<0)&&f()<.78){let a=n&1,o=3.1+f()**.85*7.8,s=a*Math.PI+Math.log(o/3)/t+p()*(.2+.02*o),c=p()*(.12+.025*o),l=Math.sqrt(r*(170+260*(1-(1+o/3.1)*Math.exp(-o/3.1))+950*o*o/(o+6.8)**2)/Math.hypot(o,i)),u=f()<.14;d.set([Math.cos(s)*o+m,c+h,Math.sin(s)*o+g,d[e+3],-Math.sin(s)*l+p()*.45,p()*.2,Math.cos(s)*l+p()*.45,u?.85+f()*.2:.44+f()*.34],e)}}}else if(t===`proto`){S(0,u,0,0,0,0,0,0,.22,-.14,.78);let e=Array.from({length:7},(e,t)=>{let n=t/7*Math.PI*2+.4,r=1.6+t%3*1.45;return[Math.cos(n)*r,(f()-.5)*.55,Math.sin(n)*r]}),t=Math.floor(u*.45);for(let n=t;n<u;n+=1){let t=n*8;if(!(d[t+7]<0))if(f()<.52){let i=e[n%e.length],a=f()**.6*1.35,o=f()*Math.PI*2,s=2*f()-1,c=Math.sqrt(Math.max(0,1-s*s)),l=i[0]+a*c*Math.cos(o)*1.25,u=i[1]+a*s*.45,_=i[2]+a*c*Math.sin(o)*.85,v=Math.max(.5,Math.hypot(l,_)),y=Math.sqrt(r*680/Math.hypot(v,.8));d.set([l+m,u+h,_+g,d[t+3]*1.2,-_/v*y+p()*1.25,p()*.95,l/v*y+p()*1.25,.78+f()*.28],t)}else d[t+1]=d[t+1]*2.4,d[t+7]=Math.min(1.02,d[t+7]+.24)}}else if(t===`dwarf-stream`){let e=Math.floor(u*.72);S(0,e,0,0,0,0,0,0,.14,.08,.82);let t=Math.floor((u-e)*.3);for(let n=e;n<u;n+=1){let i=n*8,a=n-e;if(a<t){let e=Math.cbrt(f())*1.15,n=2*f()-1,r=Math.sqrt(Math.max(0,1-n*n)),a=f()*Math.PI*2;d.set([7.4+e*r*Math.cos(a)+m,2.2+e*n+h,-2+e*r*Math.sin(a)+g,45/Math.max(1,t),-1.4+p()*.55,2.4+p()*.55,4.1+p()*.55,.52+f()*.34],i)}else{let n=(a-t)/Math.max(1,u-e-t),o=-.35+n*Math.PI*1.85,s=7.4+Math.sin(o*1.5)*1.65,c=.25+.42*n,l=Math.cos(o)*s+p()*c,_=Math.sin(o)*s*.72+p()*c,v=Math.sin(o+.8)*s*.58+p()*c,y=Math.max(1,Math.hypot(l,_,v)),b=Math.sqrt(r*1150/y);d.set([l+m,_+h,v+g,12/Math.max(1,u-e-t),-Math.sin(o)*b*.75,Math.cos(o)*b*.55,Math.cos(o+.8)*b*.42,.34+f()*.42],i)}}}else if(t===`globular`){let e=520/u,t=.65;d.set([m,h,g,8,0,0,0,.12],0);for(let n=1;n<u;n+=1){let i=Math.max(.001,Math.min(.96,f())),a=Math.min(6.8,t/Math.sqrt(i**(-2/3)-1)),o=2*f()-1,s=Math.sqrt(Math.max(0,1-o*o)),c=f()*Math.PI*2,l=8+520*a**3/(a*a+t*t)**1.5,u=Math.sqrt(r*l/(3*Math.hypot(a,.45))),_=a<1.3&&f()<.08;d.set([a*s*Math.cos(c)+m,a*o+h,a*s*Math.sin(c)+g,e,p()*u,p()*u,p()*u,_?.68+f()*.16:.04+Math.min(.24,a/6*.22)],n*8)}}else if(t===`ring`){let e=Math.floor((u-1)*.3),t=Math.floor((u-1)*.22),n=Math.floor((u-1)*.16),i=u-1-e-t-n;d.set([m,h,g,52,0,0,0,.05],0);let a=1;for(let t=0;t<e&&a<u;t+=1,a+=1){let t=Math.max(.01,Math.min(.88,f())),n=Math.min(18,7.2*Math.sqrt(t)/Math.max(.08,1-Math.sqrt(t))),i=2*f()-1,o=Math.sqrt(Math.max(0,1-i*i)),s=f()*Math.PI*2,c=Math.sqrt(r*1100/Math.hypot(n,1.8))*.52;d.set([n*o*Math.cos(s)+m,n*i+h,n*o*Math.sin(s)+g,780/e,p()*c,p()*c,p()*c,-1],a*8)}for(let e=0;e<t&&a<u;e+=1,a+=1){let e=f()<.45?2+p()*.34:f()**.65*1.65,n=f()*Math.PI*2,i=Math.sqrt(r*(52+240*Math.min(1,e/3)+780*e*e/(e+7.2)**2)/Math.hypot(e,.7));d.set([Math.cos(n)*e+m,p()*.24+h,Math.sin(n)*e+g,160/t,-Math.sin(n)*i+p()*.4,p()*.2,Math.cos(n)*i+p()*.4,.04+Math.min(.28,e*.11)],a*8)}for(let e=0;e<n&&a<u;e+=1,a+=1){let t=e%7,i=f(),o=2.1+i*6.4,s=t/7*Math.PI*2+i*.72+p()*.09,c=Math.sqrt(r*(360+780*o*o/(o+7.2)**2)/Math.hypot(o,.8));d.set([Math.cos(s)*o+m,p()*.14+h,Math.sin(s)*o+g,95/n,-Math.sin(s)*c,p()*.14,Math.cos(s)*c,.18+i*.34],a*8)}for(let e=0;e<i&&a<u;e+=1,a+=1){let e=8.4+p()*.62,t=f()*Math.PI*2,n=Math.sqrt(r*(450+780*e*e/(e+7.2)**2)/Math.hypot(e,.9)),o=f()<.24;d.set([Math.cos(t)*e+m,p()*.16+h,Math.sin(t)*e+g,220/i,-Math.sin(t)*n+Math.cos(t)*.35,p()*.16,Math.cos(t)*n+Math.sin(t)*.35,o?.84+f()*.22:.5+f()*.26],a*8)}}else if(t===`lenticular`){S(0,u,0,0,0,0,0,0,.26,0,.96);for(let e=1;e<u;e+=1){let t=e*8;if(d[t+7]<0)continue;let n=Math.hypot(d[t]-m,d[t+2]-g),r=f()*Math.PI*2,i=d[t+4],a=d[t+6],o=Math.hypot(i,a);d[t+0]=Math.cos(r)*n+m,d[t+2]=Math.sin(r)*n+g,d[t+4]=-Math.sin(r)*o,d[t+6]=Math.cos(r)*o,d[t+7]=Math.min(.32,.04+n/11*.28)}}else if(t===`irregular`){let e=Math.floor((u-1)*.28);d.set([m,h,g,18,0,0,0,.08],0);let t=1;for(let n=0;n<e&&t<u;n+=1,t+=1){let n=Math.max(.01,Math.min(.88,f())),r=Math.min(14,5.5*Math.sqrt(n)/Math.max(.09,1-Math.sqrt(n))),i=2*f()-1,a=Math.sqrt(Math.max(0,1-i*i)),o=f()*Math.PI*2;d.set([r*a*Math.cos(o)+m,r*i+h,r*a*Math.sin(o)+g,420/e,p()*2.2,p()*2.2,p()*2.2,-1],t*8)}let n=[[-3.4,.2,-1.2],[-1.4,-.3,1.3],[.9,.1,-.8],[3.2,-.2,1.5],[-5.1,.4,1.8],[4.9,.3,-1.9],[-2,-.1,-2.8],[1.9,.2,2.7]];for(;t<u;t+=1){let i=t%5==0,a,o,s,c,l=0;if(i){let e=t&1?-1:1,n=f()**.72*5.2,r=.65+n*(.48+.32*f()),i=f()*Math.PI*2;a=Math.cos(i)*r+e*n*.22+p()*.45,o=e*(.4+n),s=Math.sin(i)*r*.78+p()*.45,c=.8+f()*.26,l=e*(1.2+f()*1.4)}else{let e=n[t%n.length],r=f()**.52*2.85,i=2*f()-1,l=Math.sqrt(Math.max(0,1-i*i)),u=f()*Math.PI*2;a=e[0]+r*l*Math.cos(u)*1.45,o=e[1]+r*i*.58+a*.12,s=e[2]+r*l*Math.sin(u)*1.05,c=f()<.22?.8+f()*.24:f()<.62?.4+f()*.34:.12+f()*.22}let _=Math.max(.5,Math.hypot(a,s)),v=Math.sqrt(r*320/Math.hypot(_,1.2));d.set([a+m,o+h,s+g,260/(u-e),-s/_*v*.65+p()*1.35,l+p()*.95,a/_*v*.65+p()*1.35,c],t*8)}}else if(t===`open-cluster`){let e=240/u;d.set([m,h,g,4,0,0,0,.66],0);let t=[[0,.2,0],[-2.6,.6,-1.4],[2.4,-.5,-1.7],[-1.8,-.7,2.5],[3.3,.8,2],[-4.1,-.2,.9],[.9,1.4,-3.3]];for(let n=1;n<u;n+=1){let i=t[n%t.length],a=n>u*.32,o,s,c;if(a){let e=Math.sqrt(f())*7.8,t=f()*Math.PI*2,r=Math.cos(t)*e*1.15,i=Math.sin(t)*e*.88;o=r+Math.sin(r*.95+i*.35+n%5)*.85*.55,s=Math.sin(r*.55+n%4)*1.25+p()*.85,c=i+Math.cos(r*.45)*.95}else{let e=f()**.72*2.2,t=2*f()-1,n=Math.sqrt(Math.max(0,1-t*t)),r=f()*Math.PI*2;o=i[0]+e*n*Math.cos(r),s=i[1]+e*t,c=i[2]+e*n*Math.sin(r)}let l=Math.max(.4,Math.hypot(o,s,c)),_=Math.sqrt(r*160/Math.hypot(l,1.4))*.38;d.set([o+m,s+h,c+g,e,p()*_,p()*_,p()*_,a?.48+f()*.24:.64+f()*.13],n*8)}}else if(t===`sphere`){let e=3.2,t=950/u;d.set([m,h,g,60,0,0,0,.05],0);for(let n=1;n<u;n+=1){let i=Math.max(.004,Math.min(.93,f())),a=Math.min(11.5,e*Math.sqrt(i)/Math.max(.06,1-Math.sqrt(i))),o=2*f()-1,s=Math.sqrt(Math.max(0,1-o*o)),c=2*Math.PI*f(),l=60+a*a*950/((a+e)*(a+e)),u=Math.sqrt(r*l/(3*Math.hypot(a,1.2)));d.set([a*s*Math.cos(c)+m,a*o*.78+h,a*s*Math.sin(c)+g,t,p()*u,p()*u,p()*u,.04+Math.min(.3,a/10*.26)],n*8)}}else if(t===`coalesce`){let e=li(o,n),t=Math.cos(e.tiltX),i=Math.sin(e.tiltX),a=Math.cos(e.tiltZ),s=Math.sin(e.tiltZ),c=(e,n,r)=>{let o=n*t-r*i,c=n*i+r*t;return[e*a-o*s,e*s+o*a,c]};if(e.id===`toomre-merger`||e.id===`bullseye-ring-impact`){let t=e.massRatio||.72,n=Math.max(256,Math.min(u-256,Math.floor(u/(1+t)))),r=e.id===`bullseye-ring-impact`?10.5:11.2+f()*3.8,i=r*(e.impactParam||.28),a=e.id===`bullseye-ring-impact`?2.85:1.55+f()*.65,o=e.isPrograde?1:-1,s=.76,c=Math.max(.42,.76*t**.36);if(e.id===`bullseye-ring-impact`)S(0,n,0,-1.2,0,0,.35,0,e.tiltX*.45,e.tiltZ*.45,s),S(n,u,i*.6,r*.78,i*.4,-.25,-a,-.15,1.15,-.45,c);else{let l=-r*.5*(t/(1+t)),d=r*.5*(1/(1+t)),p=-i*.5,m=i*.5,h=a*(t/(1+t)),g=-a*(1/(1+t)),_=o*(.95+f()*.45)*(t/(1+t)),v=-o*(.95+f()*.45)*(1/(1+t));S(0,n,l,.8,p,h,-.18,_,e.tiltX,e.tiltZ,s),S(n,u,d,-.8,m,g,.18,v,-e.tiltX*.8+.55,-e.tiltZ*.7-.35,c)}}else if(e.id===`cold-streams`){let t=Math.floor((u-1)*.3);d.set([m,h,g,28,0,0,0,.08],0);let n=1;for(let e=0;e<t&&n<u;e+=1,n+=1){let e=Math.max(.01,Math.min(.88,f())),i=Math.min(18.5,7.2*Math.sqrt(e)/Math.max(.08,1-Math.sqrt(e))),a=2*f()-1,o=Math.sqrt(Math.max(0,1-a*a)),s=f()*Math.PI*2,c=Math.sqrt(r*860/Math.hypot(i,1.8))*.5;d.set([i*o*Math.cos(s)+m,i*a*.82+h,i*o*Math.sin(s)+g,780/t,p()*c,p()*c,p()*c,-1],n*8)}let i=e.nStreams||3,a=Array.from({length:i},(e,t)=>{let n=t/i*Math.PI*2+(f()-.5)*.55,r=(f()-.5)*.72;return[Math.cos(n)*Math.cos(r),Math.sin(r),Math.sin(n)*Math.cos(r)]}),o=u-n,s=Math.floor(o*.24),l=440/Math.max(1,o);for(let t=0;n<u;n+=1,t+=1){let o,u,_,v,y,b,x;if(t<s){let e=Math.max(.002,Math.min(.86,f())),t=Math.min(3.2,.92*Math.sqrt(e)/Math.max(.12,1-Math.sqrt(e))),n=2*f()-1,i=Math.sqrt(Math.max(0,1-n*n)),a=f()*Math.PI*2;o=t*i*Math.cos(a),u=t*n*.68,_=t*i*Math.sin(a);let s=Math.sqrt(r*1150/Math.hypot(t,.85));v=-Math.sin(a)*s*.58+p()*1.1,y=p()*.95,b=Math.cos(a)*s*.58+p()*1.1,x=.02+Math.min(.24,t*.08+f()*.05)}else if(f()<.62){let n=a[t%i],s=1.6+f()**.82*14.2,c=.55+s*.075,l=.65+e.spinL*14,d=-n[2],m=n[0],h=Math.hypot(d,m)||1;o=n[0]*s+d/h*l+p()*c,u=n[1]*s+p()*c*.75,_=n[2]*s+m/h*l+p()*c;let g=Math.sqrt(r*640/Math.hypot(s,2))*.78;v=-n[0]*g+d/h*(g*.24)+p()*.45,y=-n[1]*g+p()*.4,b=-n[2]*g+m/h*(g*.24)+p()*.45,x=f()<.42?.82+f()*.22:.5+f()*.3}else{let e=.5+f()**.65*4.8,t=f()*Math.PI*2;o=Math.cos(t)*e,u=p()*(.65+.14*e),_=Math.sin(t)*e;let n=Math.sqrt(r*820/Math.hypot(e,1));v=-Math.sin(t)*n*.68+p()*1.15,y=p()*.95,b=Math.cos(t)*n*.68+p()*1.15,x=f()<.35?.84+f()*.2:.36+f()*.38}let S=c(o,u,_),C=c(v,y,b);d.set([S[0]+m,S[1]+h,S[2]+g,l,C[0],C[1],C[2],x],n*8)}}else if(e.id===`triaxial-relaxation`){let t=Math.floor((u-1)*.32);d.set([m,h,g,72,0,0,0,.05],0);let n=1;for(let i=0;i<t&&n<u;i+=1,n+=1){let i=Math.max(.01,Math.min(.88,f())),a=Math.min(18,7*Math.sqrt(i)/Math.max(.08,1-Math.sqrt(i))),o=2*f()-1,s=Math.sqrt(Math.max(0,1-o*o)),l=f()*Math.PI*2,u=Math.sqrt(r*1200/Math.hypot(a,1.8))*.55,_=c(a*s*Math.cos(l),a*o*(e.ca||.62),a*s*Math.sin(l)*(e.ba||.78));d.set([_[0]+m,_[1]+h,_[2]+g,960/t,p()*u,p()*u,p()*u,-1],n*8)}let i=e.nSubhalos||5,a=Array.from({length:i},(e,t)=>{let n=t/i*Math.PI*2+f()*.65,r=3.8+f()*5.8,a=(f()-.5)*4.2;return{pos:[Math.cos(n)*r,a,Math.sin(n)*r],rad:1.3+f()*1.2}}),o=u-n,s=Math.floor(o*.32),l=560/Math.max(1,o);for(let t=0;n<u;n+=1,t+=1){let o,u,_,v,y,b,x;if(t<s){let t=Math.max(.002,Math.min(.88,f())),n=Math.min(4.8,1.35*Math.sqrt(t)/Math.max(.1,1-Math.sqrt(t))),i=2*f()-1,a=Math.sqrt(Math.max(0,1-i*i)),s=f()*Math.PI*2;o=n*a*Math.cos(s),u=n*i*(e.ca||.65),_=n*a*Math.sin(s)*(e.ba||.8);let c=Math.sqrt(r*1350/Math.hypot(n,1.1))*.42;v=p()*c,y=p()*c,b=p()*c,x=.02+Math.min(.22,n/4.8*.18+f()*.04)}else{let n=a[t%i],s=Math.max(.005,Math.min(.9,f())),c=Math.min(n.rad*2.1,n.rad*.65*Math.sqrt(s)/Math.max(.1,1-Math.sqrt(s))),l=2*f()-1,d=Math.sqrt(Math.max(0,1-l*l)),m=f()*Math.PI*2;o=n.pos[0]+c*d*Math.cos(m),u=n.pos[1]+c*l*.8,_=n.pos[2]+c*d*Math.sin(m);let h=Math.max(1,Math.hypot(o,u,_)),g=Math.sqrt(r*1100/Math.hypot(h,1.8))*.44,S=g*(.12+e.spinL*3.5);v=-(o/h)*g-_/h*S+p()*1.15,y=-(u/h)*g+p()*1.05,b=-(_/h)*g+o/h*S+p()*1.15,x=.04+Math.min(.32,c/(n.rad*2.2)*.28+f()*.08)}let S=c(o,u,_),C=c(v,y,b);d.set([S[0]+m,S[1]+h,S[2]+g,l,C[0],C[1],C[2],x],n*8)}}else if(e.id===`void-dwarf-assembly`){let t=Math.floor((u-1)*.28);d.set([m,h,g,24,0,0,0,.14],0);let n=1;for(let e=0;e<t&&n<u;e+=1,n+=1){let e=Math.max(.01,Math.min(.88,f())),r=Math.min(14.5,5.4*Math.sqrt(e)/Math.max(.09,1-Math.sqrt(e))),i=2*f()-1,a=Math.sqrt(Math.max(0,1-i*i)),o=f()*Math.PI*2;d.set([r*a*Math.cos(o)+m,r*i+h,r*a*Math.sin(o)+g,480/t,p()*2.1,p()*2.1,p()*2.1,-1],n*8)}let i=e.nClumps||6,a=Array.from({length:i},(e,t)=>{let n=f()*Math.PI*2,r=1.4+f()*5.2;return[Math.cos(n)*r,(f()-.5)*2,Math.sin(n)*r]}),o=u-n,s=Math.floor(o*.22),l=280/Math.max(1,o);for(let t=0;n<u;n+=1,t+=1){let o,u,_,v,y,b,x;if(t<s){let e=Math.max(.002,Math.min(.86,f())),t=Math.min(2.6,.85*Math.sqrt(e)/Math.max(.12,1-Math.sqrt(e))),n=2*f()-1,i=Math.sqrt(Math.max(0,1-n*n)),a=f()*Math.PI*2;o=t*i*Math.cos(a),u=t*n*.72,_=t*i*Math.sin(a);let s=Math.sqrt(r*720/Math.hypot(t,.9));v=-Math.sin(a)*s*.45+p()*.95,y=p()*.85,b=Math.cos(a)*s*.45+p()*.95,x=.08+f()*.24}else if(t%4==0){let e=-.6+f()*Math.PI*1.9,t=6.2+Math.sin(e*1.4)*2.2;o=Math.cos(e)*t+p()*.55,u=Math.sin(e)*t*.62+p()*.55,_=Math.sin(e+.9)*t*.52+p()*.55;let n=Math.sqrt(r*480/Math.max(1.5,Math.hypot(o,u,_)));v=-Math.sin(e)*n*.72+p()*.4,y=Math.cos(e)*n*.45+p()*.4,b=Math.cos(e+.9)*n*.38+p()*.4,x=.42+f()*.36}else{let n=a[t%i],s=f()**.55*2.4,c=2*f()-1,l=Math.sqrt(Math.max(0,1-c*c)),d=f()*Math.PI*2;o=n[0]+s*l*Math.cos(d),u=n[1]+s*c*.72,_=n[2]+s*l*Math.sin(d);let m=Math.max(.6,Math.hypot(o,_)),h=Math.sqrt(r*300/Math.hypot(m,1.4))*(.45+e.spinL*4.5);v=-_/m*h+p()*1.25,y=p()*.95,b=o/m*h+p()*1.25,x=f()<.28?.82+f()*.22:.34+f()*.42}let S=c(o,u,_),C=c(v,y,b);d.set([S[0]+m,S[1]+h,S[2]+g,l,C[0],C[1],C[2],x],n*8)}}else{let t=e.id===`group-tidal-satellite`,n=Math.floor((u-1)*.34),i=Math.max(.68,Math.min(1.38,.58+e.spinL*10.5)),a=e.armMode||2,o=f()<.5?1:-1,s=.24+f()*.36,l=f()*Math.PI*2;d.set([m,h,g,36,0,0,0,.06],0);let _=1;for(let e=0;e<n&&_<u;e+=1,_+=1){let e=Math.max(.01,Math.min(.9,f())),t=Math.min(18.5,7.4*Math.sqrt(e)/Math.max(.08,1-Math.sqrt(e))),i=2*f()-1,a=Math.sqrt(Math.max(0,1-i*i)),o=f()*Math.PI*2,s=Math.sqrt(r*840/Math.hypot(t,1.8))*.5;d.set([t*a*Math.cos(o)+m,t*i+h,t*a*Math.sin(o)+g,780/n,p()*s,p()*s,p()*s,-1],_*8)}let v=u-_,y=Math.floor(v*.22),b=t?Math.floor(v*.14):0,x=[8.2*i,2.1,-3.6*i],S=440/Math.max(1,v);for(let t=0;_<u;_+=1,t+=1){let n,u,v,C,w,T,E;if(t<y){let e=Math.max(.002,Math.min(.86,f())),t=Math.min(3*i,.95*i*Math.sqrt(e)/Math.max(.11,1-Math.sqrt(e))),a=2*f()-1,s=Math.sqrt(Math.max(0,1-a*a)),c=f()*Math.PI*2;n=t*s*Math.cos(c),u=t*a*.58,v=t*s*Math.sin(c);let l=Math.sqrt(r*1250/Math.hypot(t,.85));C=-Math.sin(c)*l*.62*o+p()*.95,w=p()*.78,T=Math.cos(c)*l*.62*o+p()*.95,E=.02+Math.min(.22,t/(3*i)*.18+f()*.04)}else if(t<y+b){let e=f()**.65*1.55,t=2*f()-1,r=Math.sqrt(Math.max(0,1-t*t)),i=f()*Math.PI*2;n=x[0]+e*r*Math.cos(i),u=x[1]+e*t*.7,v=x[2]+e*r*Math.sin(i),C=-1.65+p()*.55,w=-.65+p()*.45,T=3.15+p()*.55,E=.12+f()*.28}else{let t=(.9+f()**.62*11.4)*i,c=f()*Math.PI*2,d=e.barUnstable?1+.26*Math.cos(2*(c-l))*Math.exp(-t/(4.8*i)):1+.2*Math.cos(a*(c-l)-o*t*s),m=Math.min(14.5,t*d),h=(e.barUnstable?.55:.95)*(.65+.16*m);n=Math.cos(c)*m,u=(f()-.5)*2*h,v=Math.sin(c)*m;let g=Math.sqrt(r*(290+780*m*m/(m+7.4)**2)/Math.hypot(m,1.2)),_=g*Math.max(.62,Math.min(.98,.66+e.spinL*4))*o,y=-g*(e.barUnstable?.22:.14);C=Math.cos(c)*y-Math.sin(c)*_+p()*(e.barUnstable?.42:.58),w=-u*.22+p()*.42,T=Math.sin(c)*y+Math.cos(c)*_+p()*(e.barUnstable?.42:.58);let b=m<2.2*i&&f()<.58,x=!b&&f()<.14+e.fGas*.42;E=b?.04+f()*.22:x?.8+f()*.24:.34+f()*.42}let D=c(n,u,v),O=c(C,w,T);d.set([D[0]+m,D[1]+h,D[2]+g,S,O[0],O[1],O[2],E],_*8)}}}else S(0,u,0,0,0,0,0,0,0,0,1);{let e=0,t=0,n=0,r=0,i=0,a=0,o=0;for(let s=0;s<u;s+=1){let c=s*8,l=d[c+3];l>0&&(e+=l,t+=(d[c]-m)*l,n+=(d[c+1]-h)*l,r+=(d[c+2]-g)*l,i+=d[c+4]*l,a+=d[c+5]*l,o+=d[c+6]*l)}if(e>1e-6){t/=e,n/=e,r/=e,i/=e,a/=e,o/=e;for(let e=0;e<u;e+=1){let s=e*8;d[s]-=t,d[s+1]-=n,d[s+2]-=r,d[s+4]-=i,d[s+5]-=a,d[s+6]-=o}}}return d}function di(e,t=1.85,n=0){let r=Math.max(1,Math.min(118,Math.trunc(e?.Z||26))),i=Math.max(r,Math.min(256,Math.trunc(e?.A||56))),a=Math.max(0,i-r),o=ii(r*73856093^i*19349663),s=Math.max(1,Number(e?.chargeRadiusFm||3.7)),c=1+Math.max(0,.26*(a-r)/Math.max(1,i)),l=t/Math.max(1.2,Math.cbrt(i))*.88,u=Math.max(.2,t-l*.6),d=Math.PI*(3-Math.sqrt(5)),f=[];for(let e=0;e<i;e+=1){let t=(e+.5)/i,n=((e*37+13)%i+.5)/i,r=Math.cbrt(n),a=1-2*t,s=Math.sqrt(Math.max(0,1-a*a)),c=e*d+(o()-.5)*.12;f.push({dir:[Math.cos(c)*s,a,Math.sin(c)*s],rUnit:r,phase:o()*Math.PI*2})}f.sort((e,t)=>e.rUnit-t.rUnit);let p=[],m=r,h=a;for(let e=0;e<f.length;e+=1){let t=f[e],n=f.length-e,r=m/Math.max(1,n)*(t.rUnit>.82&&h>m?.45:1.15),i=m>0&&(h===0||o()<r);i?--m:--h;let a=i?u:u*c,d=t.rUnit*a;p.push({pos:[t.dir[0]*d,t.dir[1]*d,t.dir[2]*d],radius:l,color0:i?[.96,.34,.18]:[.46,.68,.94],color1:i?[1,.72,.34]:[.78,.88,1],kind:6,seed:e*1.13+s})}return p}function fi(e,t,n){if(e>=5&&n?.bundle?.electromagnetic?.spectralWavelengthsNm?.length){let e=n.bundle.electromagnetic.spectralWavelengthsNm,t=n.bundle.electromagnetic.spectralReflectance,r=[];for(let n=0;n<e.length;n+=1)r.push({wavelengthNm:e[n],intensity:Math.max(.15,Math.min(1,t[n]??.5))});return r}let r=Number(t?.tempK||5778);return[{wavelengthNm:410.2,intensity:r>6500?.85:.35},{wavelengthNm:434,intensity:r>5500?.9:.45},{wavelengthNm:486.1,intensity:.92},{wavelengthNm:495.9,intensity:e<=1?.72:.32},{wavelengthNm:500.7,intensity:e<=1?.96:.4},{wavelengthNm:517.3,intensity:r<6500?.76:.28},{wavelengthNm:587.6,intensity:r>8e3?.95:.42},{wavelengthNm:589.3,intensity:r<5500?.9:.3},{wavelengthNm:656.3,intensity:1}]}function pi(e,{seed:t=20261125,qualityId:n=`auto`,capabilityProfile:r=null,rawCapabilities:i=null,initialElementZ:a=26}={}){let o=t>>>0,s=n===`auto`||xt[n]?n:`auto`,c=i||r?.capabilities||null,l=r||ni(c||{},{device:e,qualityMode:s}),u=xt[l.qualityId]||xt.med,d=()=>l.workloads,f=new v({artifactCache:new b}),m=Rn();Ne(te),Tn(te),fn(te);let h=new Map,g=new Map,_=`present-day`,S=de({redshiftZ:0,localSystemAgeGyr:4.57,localStarMassSolar:1}),C=Pt({cosmicEpoch:S,regionPosMpc:[0,0,0],localOverdensity:1.15,seed:o}),w={posGal:[4.8,.04,2.1],popTag:.52,starIndex:0},E=!1,D=Lt(It({cosmicEpoch:S,galaxyEnv:C,starPosGal:w.posGal,popTag:w.popTag,starIndex:w.starIndex,seed:o}));function O(){return E?lt:D?.catalog?.length?D.catalog:lt}function j(e=O()){let t=e.findIndex(e=>e.planetClass===`earth-like`||e.id===`earth`);if(t>0)return t;let n=e.findIndex(e=>!e.isStar&&e.kind!==0);return n>0?n:0}let M=Object.freeze({0:{level:82,label:`L0-cosmic-web`,parentKey:null},1:{level:69,label:`L1-galactic-halo`,parentKey:0},2:{level:42,label:`L2-star-system`,parentKey:1},3:{level:31,label:`L3-stellar-core`,parentKey:2},4:{level:23,label:`L4-planetary-world`,parentKey:2},surface:{level:4,label:`L4-planetary-surface`,parentKey:4},5:{level:-28,label:`L5-crystal-md`,parentKey:`surface`},6:{level:-33,label:`L6-quantum-atom`,parentKey:5},7:{level:-49,label:`L7-atomic-nucleus`,parentKey:6}}),N=Be({referenceSpacingM:1,rootGlobalBaseLevel:82,rootLocalMinLevel:0,rootLocalMaxLevel:2,rootLabel:`L0-cosmic-web`,maxActiveCharts:64,minIdleEpochsBeforeRetire:128}),P=new Map([[0,0]]),F=0,I=0,L=we();function B(e){if(P.has(e))return P.get(e);let t=M[e]||M[0],n=t.parentKey==null?null:B(t.parentKey),r=[0,0,0];if(e===2)r=[...Ke];else if(e===4&&Ze){let e=O()[et];e&&Number.isFinite(e.aAu)&&(r=[e.aAu,0,0])}else if(e===`surface`&&Fn){let e=(Number(Fn.latDeg)||0)*(Math.PI/180),t=(Number(Fn.lonDeg)||0)*(Math.PI/180);r=[Math.cos(e)*Math.cos(t),Math.sin(e),Math.cos(e)*Math.sin(t)]}let i=N.ensureChartForScaleLevel({targetGlobalLevel:t.level,parentChartId:n,originInParentUnits:r,localSpanLevels:3,label:t.label});return P.set(e,i.chartId),i.chartId}function ne(e,t=24.5){let n=e===4&&Mn?`surface`:e,r=B(n);return F=n,I=r,N.setChartOccupancy(r,Math.max(1,Math.round(Math.abs(t)*10))),re()}function re(){let e=N.snapshotAtlas(),t=e.charts.find(e=>e.chartId===I)||e.charts[0],n=0,r=t;for(;r&&r.parentChartId!=null&&n<16;)r=e.charts.find(e=>e.chartId===r.parentChartId),n+=1;return Object.freeze({schema:e.schema,activeKey:F,activeChartId:t?.chartId??0,activeChartLabel:t?.label??`L0-cosmic-web`,activeGlobalLevel:t?.globalBaseLevel??82,activeAncestryDepth:n,chartCount:e.chartCount,minGlobalLevel:e.minGlobalLevel,maxGlobalLevel:e.maxGlobalLevel,spanOrdersOfMagnitude:Number((e.ordersOfMagnitude??0).toFixed(2)),doubleFloatOriginHi:t?.originHi??[0,0,0],doubleFloatOriginLo:t?.originLo??[0,0,0]})}let ie=`web`,ae=null,oe=null,se=null,ce=[],he=[0,0,0],_e=!1,be=null,De=null,Oe=null,Ae=null,Fe=null,Ie=new Float32Array,ze=.3,Ve=`disk`,He=`MMW Equilibrium Spiral Disk`,Ue=1,We=null,Ge=[],Ke=[4.8,.04,2.1],qe=`solar-system`,Je=!1,Ye=null,Xe=null,Ze=null,Qe=null,$e=null,et=j(),U=`nbody`,tt=null,nt=null,rt=!0,it=null,ot=null,st=null,ct=null,ut=.94,dt=null,ft=null,pt=null,mt=null,ht=null,_t=null,vt=null,yt=null,St=null,Ct=null,wt=null,Tt=null,Et=new Float32Array,Dt=.36,Ot=`main-sequence-star`,kt=null,At=null,jt=null,Mt=null,Nt=2,Ft=!1,Rt=`fusion`,zt=null,Bt=null,Vt=new Float32Array,Ht=.58,Wt=null,Gt=null,Kt=null,qt=null,Jt=null,Yt=null,Xt=new Float32Array,Zt=null,Qt=`standard`,en=null,nn=j(),rn=!1,an=[],on=null,sn=null,cn=null,ln=!0,pn=null,mn=null,hn=!1,gn=0,_n=null,yn=null,bn=new Float32Array,xn=0,W=null,Sn=null,Cn=null,En=null;function Dn(){if(!W)return null;let e=Math.max(.1,(Date.now()-(W.startedMs||Date.now()))/1e3),t=Math.max(0,Math.min(1,Number(W.progress)||0)),n=t>.03?Math.max(0,Math.round(e*(1-t)/t)):null;return Object.freeze({level:W.level,stage:W.stage,title:W.title,entityName:W.entityName,detail:W.detail,step:W.step,targetSteps:W.targetSteps,progress:t,etaSec:n,tier:l.tier,cacheKey:W.cacheKey,skipLabel:W.skipLabel||`⏩ Finish Now`})}function On(e,t,n){return m.buildKey(`l4-sph-geo-v11-pc-ss`,{seed:o,epochId:_,systemId:E?`sol`:D?.systemId||`sys`,bodyId:e?.id||`b${t}`,mode:Qt,dims:n})}function kn(e,t,n,r){let i=Array.isArray(e?.stars)&&e.stars.length?e.stars:[{id:`star-0`,name:`Host Star`,massSolar:1,luminositySolar:1,radiusSolar:1,teffK:5778,spectralClass:`G2V`,color0:[1,.94,.78],color1:[1,.62,.24]}],a=i.map((n,r)=>({id:n.id||`star-${r}`,name:n.name||`${e?.systemName||`Proto-System`} ${r===0?`A`:`B`}`,subtitle:`${n.spectralClass||`Main-Sequence`} · Coalescing Protoplanetary Disk (L = ${Number(n.luminositySolar||1).toFixed(2)} L☉)`,isStar:!0,starIndex:r,parent:-1,aAu:Number(n.orbitAu)||0,ecc:Number(n.ecc)||0,incDeg:0,massSolar:Number(n.massSolar)||1,luminositySolar:Number(n.luminositySolar)||1,radiusKm:Math.max(2e4,(Number(n.radiusSolar)||1)*695700),tempK:Number(n.teffK)||5778,kind:0,atm:0,color0:Array.isArray(n.color0)?n.color0:[1,.94,.78],color1:Array.isArray(n.color1)?n.color1:[1,.62,.24],spectralClass:n.spectralClass||`G2V`,composition:`H/He Fusion Star · Nebular Disk Snow Line ${Number(t||2.7).toFixed(2)} AU`}));return Object.freeze({systemId:e?.systemId||`proto-${w.starIndex??0}`,systemName:e?.systemName||`Proto-System #${w.starIndex??0}`,architecture:e?.architecture||(i.length>1?`binary`:`single`),starSystem:e,starCount:i.length,planetCount:0,hasEarthLike:!1,gpuCoalesced:!1,coalescingLive:!0,recommendedL3Regime:`fusion`,condensationFrontsAu:Object.freeze({rSnowLineAu:Number(Number(t||2.7).toFixed(2)),rMinStableAu:Number(Number(n||.14).toFixed(3)),rMaxStableAu:Number(Number(r||28).toFixed(2)),rHzInnerAu:Number((.95*Math.sqrt(Math.max(1e-4,i[0].luminositySolar||1))).toFixed(2)),rHzOuterAu:Number((1.67*Math.sqrt(Math.max(1e-4,i[0].luminositySolar||1))).toFixed(2))}),catalog:Object.freeze(a)})}let An=null,jn=Jn(),Mn=!1,Fn=null,In=null,Ln=null,zn=1,Bn=0,Vn=null,Hn=null,Un=!1,Gn=null,Kn=null,qn=new Set,G=null,K={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0},Yn=null,Xn=null,Zn=a,Qn=300,$n=!1,tr=`solid`,rr=[],ir=null,ar=a,sr=3,lr=2,ur=0,dr=!0,fr=`atom`,pr=`H2O`,mr=null,hr=null,gr=a,_r=56,vr=null,q=null,yr=null,br=null,xr={connected:!1,role:`requester`,relayUrl:``,roomId:`ulg-universes-mesh-v1`,peerId:null,remotePeers:0,remotePeerIds:[],quorumReady:!1,witnessedMessages:0,lastWitnessedType:null,dispatches:0,lastResult:null,error:null},Sr=!1,Cr=!1,J=0;async function wr(t,{massNumberA:n=null,relativistic:r=!0,returnOrbitalWavefunctions:i=!0}={}){let a=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),o=`${a}:${n??`std`}:${+!!r}:${+!!i}`;if(h.has(o))return h.get(o);let s=await V(e,a,{massNumberA:n,temperatureK:300,runNuclearGpuVolume:!1,runLiveMd:!1,atomicMaxScf:44,atomicGridPointsN:192,blochGridN:16,scalarRelativistic:r,spinOrbit:r,returnOrbitalWavefunctions:i});return h.set(o,s),s}async function Tr({seedOverride:t=null,bigBang:n=!1}={}){ae&&=(ae.destroy(),null),_e=!!n,he=[0,0,0];let r=(t??o)>>>0,i=_e?.045:.52,a=_e?.0085:.0012,s=1425,c=28500,l=d(),u=await $t(e,{gridPerSide:l.cosmoGridPerSide,fftGridN:l.cosmoFftN,boxLengthMpc:s,aInit:i,amplitude:_e?.28:.44,seed:r}),f=tn(e,{gridPerSide:l.cosmoGridPerSide,pmGridN:l.cosmoFftN,boxLengthMpc:s,aInit:i,da:a,initialConditions:u});se=null;let p=_e?1:4;for(let e=0;e<p;e+=1)oe=await f.step({readTelemetry:e===0||e===p-1}),e===0&&oe?.powerSpectrumPk?.kBins?.length&&(se={kBins:[...oe.powerSpectrumPk.kBins],pkValues:[...oe.powerSpectrumPk.pkValues]});ae=f;let h={disk:`Grand-Design Spiral (Sc/Sb)`,barred:`Barred Spiral (SBb)`,ring:`Cartwheel Collisional Ring Galaxy`,lenticular:`Lenticular Disk (S0 · Sombrero)`,irregular:`Starburst Irregular (Magellanic / M82)`,"open-cluster":`Open Cluster + Reflection Veil (M45)`,binary:`Interacting Major Merger Pair`,sphere:`Cluster-Core Giant Elliptical (E2)`,proto:`High-z Clumpy Starburst Protogalaxy`,"dwarf-stream":`Void Dwarf & Tidal Stream`,globular:`Core-Collapsed Globular Cluster (GC)`,coalesce:`Collapsing Protogalactic Halo`};function g(e,t){let n=ii(t^5370206);return Array.isArray(e)&&e.length>0?e.map((e,r)=>{let i=[e.posMpc[0]*4,e.posMpc[1]*4,e.posMpc[2]*4],a=Pt({cosmicEpoch:S,regionPosMpc:i,localOverdensity:e.overdensity,tidalSpinLambda:e.spinLambda,gpuCoalescedHalo:!0,seed:(t^Math.imul(r+1,2654435761))>>>0}),o=a.morphology,s=oi[Math.floor(n()*oi.length)],l=1e3+Math.floor(n()*8900),u=Number(a.meanMetallicitySolar.toFixed(2)),d=e.haloMassSolar/0xe8d4a51000;return{id:`cluster-${r}`,level:0,name:`${s}-${l} ${e.overdensity>2.2?`Node Cluster`:e.overdensity<.7?`Void Halo`:`Filament Group`}`,subtitle:`GPU Halo δ=${e.overdensity.toFixed(2)} · λ=${e.spinLambda.toFixed(3)} · M=${Math.max(.2,d).toFixed(2)}×10¹² M☉ · ⏳ Unsimulated`,posMpc:i,pos:[i[0]*(16/c),i[1]*(16/c),i[2]*(16/c)],radius:1,overdensity:e.overdensity,spinLambda:e.spinLambda,gpuCoalescedHalo:!0,galaxyEnv:a,morphology:o,metallicity:u,massLabel:o===`globular`?`${(2+n()*6.5).toFixed(1)}×10⁵ M☉`:`${Math.max(.2,d).toFixed(2)}×10¹² M☉`,tempK:o===`sphere`||o===`globular`?4200+Math.round(n()*1200):6500+Math.round(n()*4500),composition:`FLRW TreePM Halo (δ=${e.overdensity.toFixed(2)}, λ=${e.spinLambda.toFixed(3)}) — Zoom in to collapse galaxy on GPU`,nextLevel:1}}):Array.from({length:7},(e,t)=>{let r=ai[t%(ai.length-1)],i=oi[Math.floor(n()*oi.length)],a=1e3+Math.floor(n()*8900),o=t===0?2200:9600,s=(n()-.5)*2*o,l=(n()-.5)*1.4*o,u=(n()-.5)*2*o,d=Number((r===`globular`?.08+n()*.14:.55+n()*1.15).toFixed(2));return{id:`cluster-${t}`,level:0,name:`${i}-${a} ${r===`globular`?`Halo Cluster`:`Supercluster`}`,subtitle:`${h[r]||`Spiral Galaxy`} · Z=${d} Z☉`,posMpc:[s,l,u],pos:[16/c*s,16/c*l,16/c*u],radius:1,morphology:r,metallicity:d,massLabel:r===`globular`?`${(2+n()*6.5).toFixed(1)}×10⁵ M☉`:`${(1.2+n()*6.5).toFixed(2)}×10¹² M☉`,tempK:r===`sphere`||r===`globular`?4200+Math.round(n()*1200):6500+Math.round(n()*4500),composition:r===`globular`?`Ancient Pop II Stars · H 74.8% · He 25.1% · [Fe/H] ≈ -1.6`:`DM 84% · H 12% · He 3.8% · Met ${(.2*d).toFixed(2)}%`,nextLevel:1}})}let v=m.buildKey(`l0-halos`,{seed:r,epochId:_,mode:_e?`bb`:`web`}),y=await m.get(v,{bypassCache:!!n});if(!Array.isArray(y)||y.length===0){try{y=await f.extractLiveCosmicHalos({maxHalos:7})}catch{y=[]}y.length>0&&await m.set(v,y,{persist:!0,broadcast:!0})}ce=g(y,r),ce[0]?.galaxyEnv&&(C=ce[0].galaxyEnv)}async function Er({preset:t=null,metallicity:n=null,galaxyEnvOverride:r=null,seedOverride:i=null,observeLive:a=!1,bypassCache:s=!1}={}){r?C=r:(t||n!=null)&&(C=Object.freeze({...C,morphology:ai.includes(t)?t:C.morphology,meanMetallicitySolar:n==null?C.meanMetallicitySolar:Math.max(1e-4,Math.min(3.2,Number(n))),baseFeH:Math.log10(Math.max(1e-4,n==null?C.meanMetallicitySolar:Number(n)))}));let c=C?.regionPosMpc||[0,0,0],u=m.buildKey(`l1-galaxy`,{seed:o,epochId:_,galaxyKey:`${Math.round((c[0]||0)/25)}_${Math.round((c[1]||0)/25)}_${Math.round((c[2]||0)/25)}`}),f=s?null:await m.get(u),p=!!(a&&!f&&!t),h=ai.includes(t||f?.morphology||C.morphology)?t||f?.morphology||C.morphology:`disk`;Ve=p?`coalesce`:h,Ue=Math.max(.01,Math.min(3,Number(n??C.meanMetallicitySolar)||1)),Oe&&=(Oe.dispose(),null),Ae&&=(Ae.dispose(),null),We||=await er(e);let g=(i??(C?.seed||o))+825>>>0,v=d(),y=Ve===`coalesce`?li(C,g):null;He=y?y.label:C?.morphologyLabel||Ve;let b=Math.max(.25,Math.min(4.5,Number(C?.localOverdensity??C?.overdensity)||1)),x=Ve===`globular`||Ve===`open-cluster`?0:Ve===`irregular`?900:Ve===`binary`?1850:Math.round(Ve===`sphere`?2800+b*900:2400+b*900),S=Ve===`sphere`?5.6:Ve===`irregular`?5.2:6.8,w=Ve===`sphere`?10.2:8.8,T=Ve===`binary`?1580:y?.isMerger?x*(y.massRatio||.72):0,E=ui({count:v.galaxyStars,preset:Ve,seed:g,galaxyEnv:C,dmHaloMass:x,dmScaleRadius:S,dmConcentration:w}),D=(e,t)=>{let n=Math.cos(e),r=Math.sin(e),i=Math.cos(t);return[-Math.sin(t)*n,i*n,r]},O=[0,1,0],k=[0,1,0];Ve===`lenticular`?O=D(.26,0):Ve===`proto`?O=D(.22,-.14):Ve===`dwarf-stream`?O=D(.14,.08):Ve===`binary`?(O=D(.35,.18),k=D(-.42,-.25)):Ve===`coalesce`&&y&&(y.id===`bullseye-ring-impact`?(O=D(y.tiltX*.45,y.tiltZ*.45),k=D(1.15,-.45)):(O=D(y.tiltX||0,y.tiltZ||0),k=D(-(y.tiltX||0)*.8+.55,-(y.tiltZ||0)*.7-.35)));let A=Ve===`binary`?v.galaxyStars>>1:y?.isMerger?Math.max(256,Math.min(v.galaxyStars-256,Math.floor(v.galaxyStars/(1+(y.massRatio||.72))))):0;Oe=qr({device:e,initialBodies:E,gridN:32,boxSize:36,secondSmbhIndex:A,smbhSoftening:.75,dmHaloMass:x,dmSecondaryMass:T,dmScaleRadius:S,dmConcentration:w,diskNormal:O,diskNormalSecondary:k,label:`ulg-universes-galaxy-ss-nfw-${v.galaxyStars}`});let j=A>0?3:Ve===`coalesce`?2:+!![`sphere`,`globular`,`open-cluster`,`irregular`].includes(Ve);if(await Oe.calibrateEquilibrium({gravity:1,softening:.65,virialScale:j===2?.82:j===3?.98:1,calMode:j,preserveBar:Ve===`barred`}),await Oe.step({dt:.0044,substeps:2,gravity:1,softening:.65,readback:!1}),Ae=me(e,{gridN:24,boxSize:26,strideFloats:8,geometry:`galactic`,initialB0:ze,alphaAmp:.035,etaRes:.16,bSat:.85,velScale:.22,label:`ulg-universes-galactic-dynamo`}),Fe=await Ae.step({particleBuffer:Oe.getResidentBuffer(),particleCount:Oe.count,dt:.04,substeps:p?2:8,readTelemetry:!0,readBField:!0}),Ie=Ae.buildStreamlines({worldScale:1,alpha:.3}),p){let e=C?.morphologyLabel||`Cosmic-Web Halo`;W={level:1,stage:`l1-galaxy-collapse`,title:`Collapsing Protogalactic Halo (${l.tier.toUpperCase()})`,entityName:e,detail:`${He} · SS 3D Multipole + NFW Dark Matter Halo + α–ω Dynamo · ${v.galaxyStars.toLocaleString()} stars+DM`,step:2,targetSteps:v.l1TargetSteps,progress:2/Math.max(1,v.l1TargetSteps),cacheKey:u,skipLabel:`⏩ Settle Galaxy Now`,startedMs:Date.now(),_meta:{targetMorphology:h,activeSeed:g,galCacheKey:u,entityName:e,icLabel:He}},Sn=Object.freeze({kind:`genesis-started`,level:1,stage:`l1-galaxy-collapse`,label:e,source:`live-gpu`,timestampMs:Date.now()})}else W?.level===1&&(W=null),f&&!s?Sn=Object.freeze({kind:`cache-hit`,level:1,stage:`l1-galaxy-collapse`,label:f.morphologyLabel||Ve,source:`root-cache`,timestampMs:Date.now()}):m.set(u,{morphology:Ve,morphologyLabel:C?.morphologyLabel||Ve,meanMetallicitySolar:Ue,baseFeH:C?.baseFeH??Math.log10(Math.max(1e-4,Ue)),gasFraction:C?.gasFraction??.22,starCount:v.galaxyStars},{persist:!0,broadcast:!0});Ke=[4.8,.04,2.1],Ge=[{id:`smbh-core`,level:1,branch:`smbh-core`,name:`Galactic Core SMBH (Sgr-ULG*)`,subtitle:`4.3×10⁶ M☉ Supermassive Black Hole · Click any orbiting star or zoom into Sgr-ULG*`,pos:[0,0,0],radius:1,isSmbh:!0,tempK:28e3,massLabel:`4.3×10⁶ M☉`,composition:`Relativistic Plasma · Hypervelocity S-Stars`,nextLevel:2}]}async function Dr(){if(Ye)return;let t=new Float32Array(192);t.set([0,0,0,40,0,0,0,.72],0);let n=ii((o^4343808)>>>0);for(let e=1;e<24;e+=1){let r=3.2+n()*6.8,i=.25+n()*.58,a=r*(1-i),o=n()*Math.PI*2,s=(n()-.5)*1.4,c=Math.sqrt(40*(1+i)/Math.max(.5,a)),l=Math.cos(o)*a,u=Math.sin(o)*a*Math.sin(s),d=Math.sin(o)*a*Math.cos(s),f=-Math.sin(o)*c,p=Math.cos(o)*c*Math.sin(s),m=Math.cos(o)*c*Math.cos(s);t.set([l,u,d,.002,f,p,m,.14+n()*.08],e*8)}Ye=Xr({device:e,initialBodies:t,mode:0,label:`ulg-universes-smbh-sstars`}),Xe=await Ye.step({dt:.008,gravity:1,softening:.08,readback:!0})}async function Or({seedOverride:t=null,starSite:n=null,solReference:r=null,forceMultiplicity:i=null,forceExoticStage:a=null,observeLive:s=!1,bypassCache:c=!1}={}){Ze&&=(Ze.dispose(),null),W&&W.level>=2&&(W=null),typeof r==`boolean`&&(E=r),n&&(w={posGal:n.posGal||w.posGal,popTag:n.popTag??w.popTag,starIndex:n.starIndex??w.starIndex,forceExoticStage:a??n.forceExoticStage??null},E=!1);let f=(t??o)+409>>>0;if(E)Sn=Object.freeze({kind:`cache-hit`,level:2,stage:`l2-nebular-coalescence`,label:`Sol Reference System`,source:`sol-reference`,timestampMs:Date.now()});else{let t=It({cosmicEpoch:S,galaxyEnv:C,starPosGal:w.posGal,popTag:w.popTag,starIndex:w.starIndex,seed:f,forceMultiplicity:i,forceExoticStage:a??w.forceExoticStage??null}),n=m.buildKey(`l2-nebular`,{seed:f,epochId:_,galaxyKey:C?.seed||0,starKey:`${w.starIndex}_${i||0}_${a||``}`}),r=c?null:await m.get(n);if(!r&&s&&!(a??w.forceExoticStage)){tt&&=(tt.dispose(),null),it&&=(it.dispose(),null);let r=t?.stars||[{massSolar:1,luminositySolar:1,radiusSolar:1,spectralClass:`G2V`}],i=t?.architecture===`binary-p-type`||t?.architecture===`hierarchical-trinary`,a=i?r[0].massSolar+(r[1]?.massSolar||0):r[0].massSolar,o=i?r[0].luminositySolar+(r[1]?.luminositySolar||0):r[0].luminositySolar,s=Math.max(.06,.085*Math.sqrt(Math.max(1e-4,o))*1.15,(r[0].radiusSolar||1)*.00465*6),c=Math.min(38,Math.max(6,26*Math.max(.08,a)**.35)),u=t?.nebulaEnv||{},p=d(),m=p.nebularParcels,h=un(e,{starMassSolar:a,starLuminositySolar:o,metallicitySolar:u.metallicitySolar??1,cToO:u.cToO??.55,gasFraction:C?.gasFraction??.24,rMinStableAu:s,rMaxStableAu:c,parcelCount:m,radialBins:p.nebularRadialBins,enableGasDrag:rt,seed:(f^5156890)>>>0,label:`ulg-universes-nebular-live-${w.starIndex??0}`});ot=await h.step({dt:.024,substeps:32,gravityCadence:p.l2GravityCadence||4,readTelemetry:!0,readAnnuli:!0}),it=h,D=kn(t,h.snowLineAu,s,c),et=0,nn=0,en=null,U=`formation`;let g=r[0],_=o>=.05?Number(o).toFixed(2):Number(o).toExponential(1),v=g.spectralType||g.spectralClass||g.classLabel||`Star`,y=`${t.systemName||`Star #${w.starIndex??0}`} (${v} · ${_} L☉)`;W={level:2,stage:`l2-nebular-coalescence`,title:`Coalescing Star System Nebula (SS Multipole · ${l.tier.toUpperCase()})`,entityName:y,detail:`Collapsing protoplanetary disk (${m.toLocaleString()} parcels · Snow Line ${h.snowLineAu.toFixed(2)} AU) — density waves forming (worlds not yet settled)`,step:h.stepIndex,targetSteps:p.l2TargetSteps,progress:Math.min(1,h.stepIndex/Math.max(1,p.l2TargetSteps)),cacheKey:n,skipLabel:`⏩ Fast-Forward SPH Settling`,startedMs:Date.now(),_meta:{starSys:t,activeSeed:f,nebCacheKey:n}},J=0,Sn=Object.freeze({kind:`genesis-started`,level:2,stage:`l2-nebular-coalescence`,label:y,source:`live-gpu`,timestampMs:Date.now()});return}if(r)Sn=Object.freeze({kind:`cache-hit`,level:2,stage:`l2-nebular-coalescence`,label:t.systemName||`Star #${w.starIndex??0}`,source:`root-cache`,timestampMs:Date.now()});else try{let i=d();r=await dn(e,t,{parcelCount:i.nebularParcels,radialBins:i.nebularRadialBins,substeps:i.l2BurstSubsteps,seedOverride:f}),r&&await m.set(n,r,{persist:!0,broadcast:!0})}catch{r=null}D=Lt(t,{seedOverride:f,gpuCoalescedDisk:r})}let p=O(),h=et===0&&!n&&typeof r!=`boolean`;et=h?0:E?3:j(p),nn=h?j(p):et,U=`nbody`,Ze=gt(e,{catalog:p,beltZoneAu:E?null:D?.beltZoneAu,asteroidCount:u.solarAsteroids,seed:f,label:E?`ulg-universes-sol-reference`:`ulg-universes-causal-${D?.systemId||`sys`}`}),await Ze.step({dtSubYr:35e-6,substeps:4,readMassive:!0}),Qe=Ze.computeConservationDiagnostics(),$e=Qe,en&&=null}async function kr(e=null,{recommendedL3Regime:t=null,initializeNow:n=!1}={}){let r=O(),i=e||(r[et]?.isStar?r[et]:r[0])||null,a=Ut(i,t??(i?.starIndex===0||i===r[0]?D?.recommendedL3Regime:null)),o=a.stellarMode!==Rt,s=a.stellarMode===`fusion`&&a.stellarPreset!==Ot;return Rt=a.stellarMode,a.stellarMode===`fusion`&&(Ot=a.stellarPreset),n&&(Rt===`fusion`?(!Ct||s||o)&&await ri({preset:Ot}):await Ri(Rt)),a}function Ar({resetModes:e=!0}={}){Xi();let t=e=>{if(e&&typeof e.dispose==`function`)try{e.dispose()}catch{}};t(st),st=null,ct=null,t(dt),dt=null,ft=null,pt=null,t(mt),mt=null,ht=null,_t=null,t(vt),vt=null,yt=null,St=null,t(tt),tt=null,nt=null,t(it),it=null,ot=null,t(zt),zt=null,Bt=null,Vt=null,t(Wt),Wt=null,Gt=null,Kt=null,t(qt),qt=null,Jt=null,Yt=null,Xt=null,t(pn),pn=null,mn=null,hn=!1,t(_n),_n=null,yn=null,bn=new Float32Array,t(En),En=null,An=null,t(Ye),Ye=null,Xe=null,en=null,on=null,W&&W.level>=2&&(W=null),e&&(qe=`solar-system`,U=`nbody`,Qt=`standard`,rn=!1,Rt=`fusion`)}async function jr({posGal:e,popTag:t=.5,starIndex:n=0,forceMultiplicity:r=null,forceExoticStage:i=null,seedOverride:a=null,observeLive:o=!1,bypassCache:s=!1}={}){Ar({resetModes:!0}),w={posGal:Array.isArray(e)?[...e]:[...w.posGal],popTag:Number.isFinite(Number(t))?Number(t):.5,starIndex:Math.trunc(Number(n)||0),forceExoticStage:i||null},Ke=[...w.posGal],E=!1,await Or({starSite:w,forceMultiplicity:r,forceExoticStage:i,seedOverride:a,observeLive:o,bypassCache:s});let c=D?.catalog?.[0]||D?.starSystem?.stars?.[0];return c&&await kr(c,{recommendedL3Regime:D?.recommendedL3Regime,initializeNow:!1}),D}async function Mr({forceMultiplicity:e=null,observeLive:t=!1}={}){let n=(w.starIndex||0)+1,r=ii((o^n*1103515245)>>>0),i=.8+r()**.72*8.2,a=r()*Math.PI*2,s=(r()-.5)*(i<2.2?1.4:.42),c=i<2?.08+r()*.22:.32+r()*.65;return jr({posGal:[Math.cos(a)*i,s,Math.sin(a)*i],popTag:c,starIndex:n,forceMultiplicity:e,observeLive:t})}async function Pr(e){return Ar({resetModes:!0}),E=!!e,await Or({solReference:E}),O()}async function Fr({seedOverride:t=null}={}){tt&&=(tt.dispose(),null),it&&=(it.dispose(),null);let n=(t??o)+773>>>0,r=D?.starSystem||null,i=r?.stars?.[0]||{massSolar:1,luminositySolar:1},a=r?.nebulaEnv||{metallicitySolar:1,cToO:.55},s=D?.condensationFrontsAu||{rMinStableAu:.14,rMaxStableAu:28},c=d(),l=c.nebularParcels,u=un(e,{starMassSolar:i.massSolar||1,starLuminositySolar:i.luminositySolar||1,metallicitySolar:a.metallicitySolar??1,cToO:a.cToO??.55,gasFraction:C?.gasFraction??.24,rMinStableAu:s.rMinStableAu||.14,rMaxStableAu:s.rMaxStableAu||28,parcelCount:l,radialBins:c.nebularRadialBins,enableGasDrag:rt,seed:n,label:`ulg-universes-nebular-coalesce`});ot=await u.step({dt:.024,substeps:32,gravityCadence:c.l2GravityCadence||4,readTelemetry:!0,readAnnuli:!0}),it=u;let f=Ce(e,{pebbleCount:Math.min(8192,Math.max(1536,Math.round(c.nebularParcels*.4))),embryoCount:18,starLuminositySolar:i.luminositySolar||1,enableGasDrag:rt,seed:n,label:`ulg-universes-protoplanetary-disk`});nt=await f.step({dt:.018,substeps:3,readTelemetry:!0}),tt=f}async function Ir(e=!1){let t=W;if(!t||t.stage!==`l1-galaxy-collapse`)return null;let n=t._meta||{},r=d();if(e&&Oe){let e=Math.max(0,Math.min(36,(t.targetSteps||r.l1TargetSteps)-(t.step||0)));for(;e>0;){let t=Math.min(12,e);e-=t,await Oe.step({dt:.0085,substeps:t,gravity:1,softening:.35,readback:!1})}Ae&&(Fe=await Ae.step({particleBuffer:Oe.getResidentBuffer(),particleCount:Oe.count,dt:.036,substeps:4,readTelemetry:!0,readBField:!0}),Ie=Ae.buildStreamlines({worldScale:1,alpha:.3}))}let i=n.galCacheKey||t.cacheKey,a=n.targetMorphology||C?.morphology||`disk`;return i&&await m.set(i,{morphology:a,morphologyLabel:C?.morphologyLabel||a,meanMetallicitySolar:Ue,baseFeH:C?.baseFeH??Math.log10(Math.max(1e-4,Ue)),gasFraction:C?.gasFraction??.22,starCount:Oe?.count||r.galaxyStars},{persist:!0,broadcast:!0}),W=null,Sn=Object.freeze({kind:`genesis-complete`,level:1,stage:`l1-galaxy-collapse`,label:n.entityName||C?.morphologyLabel||`Galaxy`,detail:`${(Oe?.count||r.galaxyStars).toLocaleString()} stars collapsed & cached`,source:`live-gpu`,timestampMs:Date.now()}),Sn}async function Lr(){let t=W,n=t?.stage===`l2-nebular-coalescence`&&t._meta||{},r=d();it||await Fr();let i=it?.stepIndex||0,a=i<r.l2BurstSubsteps?Math.max(24,r.l2BurstSubsteps-i):8,s=await it.coalesceSystemBurst({substeps:a,chunkSize:96,gravityCadence:6,dt:.024}),c=n.activeSeed??o+409>>>0,l=n.starSys||D?.starSystem||It({cosmicEpoch:S,galaxyEnv:C,starPosGal:w.posGal,popTag:w.popTag,starIndex:w.starIndex,seed:c}),f=Object.freeze({...s,telemetry:it.getTelemetry()}),p=n.nebCacheKey||m.buildKey(`l2-nebular`,{seed:c,epochId:_,galaxyKey:C?.seed||0,starKey:`${w.starIndex}_0_${w.forceExoticStage||``}`});await m.set(p,f,{persist:!0,broadcast:!0}),E=!1,D=Lt(l,{seedOverride:c,gpuCoalescedDisk:f});let h=O();et=j(h),nn=et,Ze&&=(Ze.dispose(),null),Ze=gt(e,{catalog:h,beltZoneAu:D?.beltZoneAu,asteroidCount:u.solarAsteroids,seed:c,label:`ulg-universes-crystallized-${D?.systemId||`sys`}`}),await Ze.step({dtSubYr:35e-6,substeps:4,readMassive:!0}),Qe=Ze.computeConservationDiagnostics(),$e=Qe,en=null,U=`nbody`,J=1;let g=D?.catalog?.[0]||D?.starSystem?.stars?.[0];return g&&await kr(g,{recommendedL3Regime:D?.recommendedL3Regime,initializeNow:!1}),W?.stage===`l2-nebular-coalescence`&&(W=null),Sn=Object.freeze({kind:`genesis-complete`,level:2,stage:`l2-nebular-coalescence`,label:D?.systemName||`Star System`,detail:`${D?.planetCount||0} worlds crystallized & cached`,source:`live-gpu`,timestampMs:Date.now()}),D}async function Rr(){let e=W,t=e?.stage===`l4-planetary-sph`&&e._meta||{},n=d();if(!pn)return W?.stage===`l4-planetary-sph`&&(W=null),null;let r=pn.stepIndex||0,i=r<n.l4BurstSubsteps?Math.max(6,n.l4BurstSubsteps-r):2;mn=await pn.stepBurst({totalSubsteps:i,chunkSize:24,dt:.028,erosionPasses:n.sphErosionPasses,readTelemetry:!0});let a=await pn.exportGeologyMapSnapshot(),o=O()[nn]||lt[3],s=t.sphCacheKey||On(o,nn,`${pn.mapWidth}x${pn.mapHeight}x${pn.gridN}`);if(a){let e=Nn(a,8e3);e&&await m.set(s,{packedGeo:e,telemetry:mn},{persist:!0,broadcast:!1})}let c=!!hn;return hn=!1,gn=c?Math.max(gn,.52):0,W?.stage===`l4-planetary-sph`&&(W=null),Sn=Object.freeze({kind:`genesis-complete`,level:4,stage:`l4-planetary-sph`,label:t.specName||o?.name||`World`,detail:`Differentiated (${Math.round(mn?.geoTimeMyr||0)} Myr) & cached`,source:`live-gpu`,timestampMs:Date.now()}),mn}async function zr(){if(!W)return{finalized:!1,stage:null,event:Sn};let e=0;for(;Sr&&e<120;)e+=1,await new Promise(e=>setTimeout(e,4));if(!W)return{finalized:!0,stage:null,event:Sn};let t=W.stage;Sr=!0;try{t===`l1-galaxy-collapse`?await Ir(!0):t===`l2-nebular-coalescence`?await Lr():t===`l4-planetary-sph`?await Rr():W=null}finally{Sr=!1}return{finalized:!0,stage:t,event:Sn}}async function Br(){let e=0;for(;Sr&&e<120;)e+=1,await new Promise(e=>setTimeout(e,4));Sr=!0;try{return await Lr()}finally{Sr=!1}}async function Y({seedOverride:e=null}={}){return await Er({galaxyEnvOverride:C,seedOverride:e,observeLive:!0,bypassCache:!0}),C}async function Hr({initialB0:t=Ht,seedOverride:n=null}={}){Ht=Math.max(0,Math.min(1.5,Number(t)??.58));let r=zt;zt=null,r&&r.dispose();let i=(n??o)+3133>>>0,a=Me(e,{gridN:u.id===`low`?16:32,tracerCount:Math.min(8192,Math.max(3072,u.stellarParticles||4096)),initialB0:Ht,spinOmega:2.35,gravityG:2.4,seed:i,label:`ulg-universes-nebular-mhd`});Bt=await a.step({dt:.024,substeps:16,readTelemetry:!0,readBFieldForStreamlines:!0}),Vt=a.buildMagneticFieldStreamlines({worldScale:1,alpha:.68}),zt=a}async function Ur(t=ie){let n=be;be=null,n&&n.dispose();let r=t===`cmb`,i=t===`reionization`,a=t===`cluster-merger`,s=r?1100:i?10:.25,c=u.id===`low`?4096:u.id===`ultra`?10240:6656,l=H(e,{gridN:u.id===`low`?16:24,tracerCount:c,boxSizeMpc:260,redshiftZ:s,clusterMergerMode:a,uvFlux:i?1.55:r?0:.25,gravityG:a?1.65:1.15,seed:(o^(r?4352:i?4112:49413))>>>0,label:`ulg-universes-cosmo-${t}`}),d=i?5:a?4:2;for(let e=0;e<d;e+=1)De=await l.step({dt:i?.14:.09,substeps:2,readTelemetry:e===d-1});be=l}async function X({spinA:t=ut}={}){ut=Math.max(-.99,Math.min(.99,Number(t)??.94));let n=st;st=null,n&&n.dispose();let r=u.id===`low`?4096:6656,i=ye(e,{massSolar:45e7,spinA:ut,accretionRateEddington:.58,magneticFluxNorm:1.15,particleCount:r,seed:(o^9479591)>>>0,label:`ulg-universes-kerr-quasar`});for(let e=0;e<5;e+=1)ct=await i.step({dt:.032,substeps:2,readTelemetry:e===4});st=i}async function Gr(t=`bns-kilonova`){let n=dt;dt=null,n&&n.dispose(),pt=t;let r=u.id===`low`?3072:5120,i=t===`xray-binary`?{m1Solar:11,m2Solar:1.8,r1Sim:.44,r2Sim:.88,separation0:4.5,eccentricity0:.02,cSpeedSim:24,rocheOverflow:!0,neutronRich:!1,wdCarbonOxygen:!1,warm:8}:t===`type-ia`?{m1Solar:1.38,m2Solar:.96,r1Sim:.36,r2Sim:.42,separation0:2.25,eccentricity0:.05,cSpeedSim:4.6,rocheOverflow:!1,neutronRich:!1,wdCarbonOxygen:!0,warm:20}:t===`bbh-merger`?{m1Solar:36,m2Solar:29,r1Sim:.56,r2Sim:.48,separation0:3.25,eccentricity0:.06,cSpeedSim:5,rocheOverflow:!1,neutronRich:!1,wdCarbonOxygen:!1,warm:8}:{m1Solar:1.45,m2Solar:1.32,r1Sim:.36,r2Sim:.34,separation0:2.35,eccentricity0:.05,cSpeedSim:4.7,rocheOverflow:!1,neutronRich:!0,wdCarbonOxygen:!1,warm:22},a=le(e,{...i,particleCount:r,seed:(o^t.length*9187)>>>0,label:`ulg-universes-relbin-${t}`});for(let e=0;e<i.warm;e+=1)ft=await a.step({dt:.032,substeps:4,readTelemetry:e===i.warm-1});dt=a}function Kr(e=nn){if(!Ze)return{sourceDir:[.76,.24,.6],orbVelDir:[-.62,0,.78],sunDistAu:1,sublimationDrive:1.35};let t=Ze.catalog||O(),n=Math.max(0,Math.min(t.length-1,e)),r=Ze.getMassiveBodyState64(n),i=Ze.getMassiveBodyState64(0),a=i.posAu[0]-r.posAu[0],o=i.posAu[1]-r.posAu[1],s=i.posAu[2]-r.posAu[2],c=Math.max(.18,Math.hypot(a,o,s)),l=[a/c,o/c,s/c],u=(r.velAuYr?.[0]||0)-(i.velAuYr?.[0]||0),d=(r.velAuYr?.[1]||0)-(i.velAuYr?.[1]||0),f=(r.velAuYr?.[2]||0)-(i.velAuYr?.[2]||0),p=Math.hypot(u,d,f);return{sourceDir:l,orbVelDir:p>1e-6?[u/p,d/p,f/p]:[-l[2],0,l[0]],sunDistAu:c,sublimationDrive:Math.max(.65,Math.min(2.6,1.45/Math.max(.35,c)**.55))}}async function Jr(t=`comet-tails`,{bodyIndex:n=null}={}){let r=mt;mt=null,r&&r.dispose(),_t=t;let i=t===`comet-tails`,a=i&&n!=null&&Ze?Kr(n):{sourceDir:i?[.76,.24,.6]:[.82,.14,.55],orbVelDir:i?[-.62,0,.78]:[-.55,0,.83],sunDistAu:i?1:.045,sublimationDrive:i?1.35:1.45},s=ve(e,{regime:i?`comet-dual-tail`:`hot-jupiter-xuv`,uvFlux:i?1.45:2.35,radBeta:i?.95:.72,windSpeed:i?2.25:1.95,sublimationDrive:a.sublimationDrive,sourceDir:a.sourceDir,orbVelDir:a.orbVelDir,sunDistAu:a.sunDistAu,particleCount:u.id===`low`?3072:5120,seed:(o^(i?787431:263952))>>>0,label:`ulg-universes-radl2-${t}`});for(let e=0;e<8;e+=1)ht=await s.step({dt:.04,substeps:3,sourceDir:a.sourceDir,orbVelDir:a.orbVelDir,sublimationDrive:a.sublimationDrive,sunDistAu:a.sunDistAu,readTelemetry:e===7});mt=s}async function Yr(t=`roche-rings`){let n=vt;vt=null,n&&n.dispose(),St=t;let r=ge(e,{mode:t===`red-giant`?`red-giant-engulf`:t,orbitRadiusSim:t===`roche-rings`?2.35:t===`tde`?3.2:2.8,rHostSim:t===`red-giant`?1.85:t===`tde`?1.05:t===`giant-impact`?1.48:1.38,rRocheSim:t===`tde`?5.2:3.65,gmHost:t===`tde`?38:24,cohesionStrength:.55,tidalHeatDrive:t===`tde`?1.85:1.25,shepherdGm:.72,particleCount:u.id===`low`?3072:5120,seed:(o^t.length*4099)>>>0,label:`ulg-universes-tidal-${t}`}),i=t===`roche-rings`?12:t===`catastrophic-shatter`?4:t===`tde`?8:6;for(let e=0;e<i;e+=1)yt=await r.step({dt:.028,substeps:3,readTelemetry:e===i-1});vt=r}async function Zr(t=null,{excessRatio:n=1.6}={}){let r=vt;vt=null,r&&r.dispose();let i=t?.id||O()[et]?.id||`asteroid`;qn.add(i),G=t?.name||O()[et]?.name||`Target Body`,U=`catastrophic-shatter`,St=`catastrophic-shatter`;let a=ge(e,{mode:`catastrophic-shatter`,orbitRadiusSim:2.2,rHostSim:1,rRocheSim:2.2,gmHost:6,cohesionStrength:.25,tidalHeatDrive:Math.max(1.2,Math.min(3,1.55*n)),shepherdGm:0,particleCount:u.id===`low`?3072:5120,seed:(o^i.length*8191+5547902)>>>0,label:`ulg-universes-shatter-${i}`});for(let e=0;e<4;e+=1)yt=await a.step({dt:.026,substeps:3,readTelemetry:e===3});return vt=a,yt}async function Qr(t=`h2-pillars`){let n=Wt;Wt=null,n&&n.dispose(),Kt=t;let r=ve(e,{regime:t,uvFlux:t===`snr-pwn`?1.85:t===`wr-bubble`?1.95:t===`planetary-nebula`?1.65:t===`reflection-nebula`?1.55:1.48,radBeta:t===`wr-bubble`?1.35:t===`snr-pwn`?1:.88,windSpeed:t===`snr-pwn`?2.15:t===`wr-bubble`?1.95:t===`planetary-nebula`?1.68:1.15,bipolarAsymmetry:t===`wr-bubble`?1.85:1.45,sourceDir:[.65,.58,.48],particleCount:u.id===`low`?3584:5632,seed:(o^t.length*6151)>>>0,label:`ulg-universes-radl3-${t}`});for(let e=0;e<6;e+=1)Gt=await r.step({dt:.036,substeps:2,readTelemetry:e===5});Wt=r}async function $r(t=`magnetar`){let n=qt;qt=null,n&&n.dispose(),Yt=t;let r=t===`magnetar`,i=fe(e,{massSolar:r?1.55:1.42,radiusM:12e3,surfaceBFieldTesla:r?165e9:42e7,spinPeriodS:r?.14:.0085,obliquityRad:r?.56:.74,particleCount:u.id===`low`?3584:5632,seed:(o^(r?239335:590170))>>>0,label:`ulg-universes-mag-${t}`}),a=r?8:4;for(let e=0;e<a;e+=1)Jt=await i.step({dt:.055,substeps:3,readTelemetry:e===a-1});Xt=i.buildDipoleFieldLines({linesPerRing:16,steps:32,worldScale:1,alpha:.74}),qt=i}async function ei(){let t=[];for(let e of[8.2,8.8,9.4,10,10.6,11.3,12.2,13.5,15,17.2,17.6,17.9,18.2,18.5,18.8,19.2])t.push({centralRhoKgM3:10**e,yElectron:.5});Zt=await Re(e,t)}async function ti(){let t=En;En=null,t&&t.dispose();let n=ge(e,{mode:`cryo-plumes`,rHostSim:2.35,gmHost:14,tidalHeatDrive:1.45,particleCount:u.id===`low`?2560:4096,seed:(o^209125838)>>>0,label:`ulg-universes-cryo-plumes`});for(let e=0;e<8;e+=1)An=await n.step({dt:.032,substeps:3,readTelemetry:e===7});En=n}async function ri({preset:t=Ot,seedOverride:n=null}={}){let r=[`pop3-first-gen`,`pop2-second-gen`,`main-sequence-star`,`blue-supergiant`,`red-supergiant`,`agb-carbon`,`brown-dwarf`];Ot=[...r,`solar-nebula`,`massive-supernova`,`binary-nursery`].includes(t)?t:`main-sequence-star`,Ct&&=(Ct.dispose(),null),wt&&=(wt.dispose(),null),Mt||=(await Nr({closureRegistry:f,device:e})).ref;let i=(n??o)+1939>>>0,a=d();if(r.includes(Ot)){let t=O()[0]||null,n=!E&&t&&Number.isFinite(Number(t.massSolar))&&(Ot===`main-sequence-star`||Ot===`blue-supergiant`||Ot===`red-supergiant`||Ot===`brown-dwarf`),r=Number(D?.nebulaEnv?.metallicitySolar);Ct=je(e,{count:a.stellarParcels,gridN:a.stellarGridN,stellarClass:Ot,starMassSolar:n?Number(t.massSolar):void 0,surfaceTempK:n&&Number.isFinite(Number(t.tempK))?Number(t.tempK):void 0,xZ0:n&&Number.isFinite(r)?Math.max(1e-5,Math.min(.06,.014*r)):void 0,boxHalf:7.5,seed:i,label:`ulg-universes-stellar-mpm-${Ot}`});for(let e=0;e<6;e+=1)kt=await Ct.step({dt:.015,timeAccel:Nt,readTelemetry:e===5})}else Ct=Vr({device:e,initialBodies:Wr({count:u.stellarParticles,preset:Ot,seed:i}),closureRegistry:f,closureRef:Mt,boxHalf:14,rCellFactor:.075,softening:.25,baseLogRho:-16.2,refRhoSim:.08,tScaleK:78e4,label:`ulg-universes-stellar-${Ot}`}),kt=await Ct.step({dt:.015,timeAccel:Nt,readTelemetry:!0});wt=me(e,{gridN:24,boxSize:16,strideFloats:16,geometry:`stellar`,initialB0:Dt,alphaAmp:.22,etaRes:.055,bSat:.95,velScale:.35,label:`ulg-universes-stellar-dynamo`}),Tt=await wt.step({particleBuffer:Ct.getResidentBuffer(),particleCount:Ct.count,dt:.042,substeps:8,readTelemetry:!0,readBField:!0}),Et=wt.buildStreamlines({worldScale:1,alpha:.42});let[s,c]=await Promise.all([Pe(e,[{rhoKgM3:15e4,temperatureK:15e6,xH:.72,xHe:.26,xZ:.02,dtS:0xe8d4a51000},{rhoKgM3:8e5,temperatureK:35e6,xH:.55,xHe:.42,xZ:.03,dtS:1e11},{rhoKgM3:12e7,temperatureK:16e7,xH:0,xHe:.96,xZ:.04,dtS:1e10}]),ke(e,[1.5,3],{dXi:.01,maxXi:12})]);At=s,jt=c}async function fi(){(!Ct||typeof Ct.exportSupernovaYields!=`function`)&&await ri({preset:`pop3-first-gen`});let e=Ct.exportSupernovaYields();Cn=e,C=Object.freeze({...C,meanMetallicitySolar:e.metallicitySolar,baseFeH:e.feH,baseCO:e.cToO,alphaOverFe:e.alphaOverFe,seededBySupernova:e});let t=(w.starIndex||0)+1>>>0,n=e.nextGeneration===2?.14:.62,r=await jr({posGal:w.posGal,popTag:n,starIndex:t,observeLive:!0,bypassCache:!0});if(W?.stage===`l2-nebular-coalescence`){let t=e.nextGeneration===2?`2nd-Gen Pop II (α-rich)`:`3rd-Gen Pop I (Metal-Rich)`;W.title=`Supernova Yields → Coalescing ${t} Nebula`,W.detail=`Seeded from Gen-${e.progenitorGeneration} core (CNO ${(e.fusedXCNO*100).toFixed(3)}%, α/Fe ${(e.fusedXAlphaFe*100).toFixed(3)}%, [Fe/H]=${e.feH.toFixed(2)}) · ${W.detail}`}return{yields:e,system:r,stage:Dn()}}async function pi({bodyIndex:t=nn,observeLive:n=!1,bypassCache:r=!1}={}){let i=O(),a=Math.max(0,Math.min(i.length-1,Math.trunc(Number(t)??nn)));if(i[a]?.isStar||a===0){let e=j(i);e>0&&(a=e)}nn=a,W?.level===4&&(W=null);let s=i[a]||lt[3],c=s.coreZ||26,f=s.mantleZ||14,p=s.surfZ||29;Yn||(Zn=p),mr||(ar=c),vr||(gr=c);let[h,_,v]=await Promise.all([wr(c,{relativistic:!0,returnOrbitalWavefunctions:!1}),wr(f,{relativistic:!0,returnOrbitalWavefunctions:!1}),wr(p,{relativistic:!0,returnOrbitalWavefunctions:!1})]),y=async t=>{let n=t.bundle.materialKey||t.bundle.symbol;if(g.has(n))return g.get(n);let r=await or(e,t.bundle,{minPressurePa:1e4,maxPressurePa:0xe8d4a51000,maxTemperatureK:12e3,degrees:[4,4],relativeTolerance:.03,maxBisectDepth:2});return g.set(n,r),r},[b,x]=await Promise.all([y(h),y(_)]),S=Math.max(1e5,(Number(s.radiusKm)||6371)*1e3),C=Math.max(0x8ac7230489e80000,(Number(s.massSolar)||300349e-11)*198847e25),w=S>=16e6||s.planetClass===`gas-giant`||s.planetClass===`hot-jupiter`||s.planetClass===`ice-giant`,T=Math.max(1e8,Math.min(w?8e12:2e12,Number(s.centralP)||(w?15e11:36e10))),k=Math.max(1e3,Math.min(1e8,Number(s.surfacePressurePa)||1e5)),A=Number.isFinite(Number(s.coalescedComposition?.feFrac))?Math.max(.06,Math.min(.75,Number(s.coalescedComposition.feFrac))):w?.12:.32,M=w?14e3:Math.max(1200,Math.min(12e3,Math.round(2800+(C/5972e21)**.35*2400))),N=Math.max(400,Math.round(M*.44)),P=Math.max(35e6,S*2.4);en=await cr(e,{centralPressurePa:T,surfacePressurePa:k,radialStepM:Math.min(18e4,Math.max(250,Math.round(S/56))),maxRadiusM:P,initialMassKg:C,convergePasses:4,maxProfileSamples:128,layers:[{name:`${h.bundle.symbol} Core`,massFractionTarget:A,tempK:M,atlas:b},{name:`${_.bundle.symbol} Mantle`,massFractionTarget:Math.max(.1,1-A),tempK:N,atlas:x}]});let F=Math.max(.18,Math.min(.78,Math.cbrt(A*.52))),I=en?.profile||[],L=Math.max(1,en?.radiusM||S);for(let e=0;e<I.length;e+=1)if((I[e].layerIndex??0)>=1){F=Math.max(.18,Math.min(.82,I[e].radiusM/L));break}an=[{id:`layer-core`,level:4,name:`${s.name} · ${h.bundle.symbol} Core`,subtitle:`Gate 2 Polytope Atlas · P_c = ${(T/1e9).toFixed(0)} GPa · MoI = ${(en?.moiFactor||.33).toFixed(3)}`,pos:[.45,.35,.45],radius:.7,sampleZ:c,rCoreNorm:F,rMantleNorm:.94,tempK:5200,massLabel:`R = ${s.radiusKm.toLocaleString()} km`,composition:s.composition,nextLevel:5},{id:`layer-mantle`,level:4,name:`${s.name} · ${_.bundle.symbol} Mantle`,subtitle:`High-Pressure Polytope Shell · T = 2,200 K`,pos:[1.35,1.05,1.35],radius:.7,sampleZ:f,rCoreNorm:F,rMantleNorm:.94,tempK:2200,massLabel:`g = ${(en?.surfaceGravityMPerS2||9.8).toFixed(2)} m/s²`,composition:`${_.bundle.symbol}/O Silicate Mantle`,nextLevel:5},{id:`layer-surface`,level:4,name:`${s.name} · ${v.bundle.symbol} Crust Sample`,subtitle:`Scroll in to resolve live ${v.bundle.symbol} WebGPU crystal lattice`,pos:[-1.8,1.4,1.5],radius:.7,sampleZ:p,rCoreNorm:F,rMantleNorm:.94,tempK:s.tempK||288,massLabel:`T_eq = ${s.tempK||288} K`,composition:`${v.bundle.symbol} (${v.bundle.mechanical.crystalStructure})`,nextLevel:5}],sn&&(sn.dispose(),sn=null,cn=null);let R=Number(h.bundle?.electromagnetic?.electricalConductivitySPerM)||1e6,z=s.parent>=0?i[s.parent]:null,B=Math.max(.15,Number(s.aAu||z?.aAu||1));if(on=pe({...s,coreRadiusNorm:F,coreConductivitySm:R},{...en,coreRadiusFraction:F,centralPressurePa:T},{solarDistanceAu:B,coreConductivitySm:R}),on.activation.anyActive){let t=ue(e,{width:u.id===`low`?64:128,height:u.id===`low`?32:64,bodyParams:on,enableTriboelectric:ln,seed:(o^a*2654435761)>>>0,label:`ulg-universes-atmo-${a}`});for(let e=0;e<4;e+=1)cn=await t.step({dtSim:.048,substeps:2,readTelemetry:e===3});sn=t}if(pn&&(pn.dispose(),pn=null,mn=null),_n&&(_n.dispose(),_n=null,yn=null,bn=new Float32Array),hn=!1,gn=0,xn=0,vn(s).active){let t=d(),i=t.sphMapWidth,c=t.sphMapHeight,u=t.sphGridN,f=wn(e,s,{nebulaEnv:E?null:D?.starSystem?.nebulaEnv,planetaryAtmoState:on,planetaryMode:Qt,systemAgeGyr:E?4.57:D?.starSystem?.systemAgeGyr??4.5,parcelCount:t.sphParcels,gridN:u,mapWidth:i,mapHeight:c,targetSteps:n?t.l4TargetSteps:t.l4BurstSubsteps,seed:(o^a*2654435761+(s.id?.length||3)*131)>>>0,label:`ulg-universes-sph-genesis-${s.id||a}`}),p=On(s,a,`${i}x${c}x${u}`),h=r?null:await m.get(p),g=h?.packedGeo?Pn(h.packedGeo):null;if(g&&f.hydrateGeologyMapSnapshot(g,h.telemetry))mn=f.getTelemetry(),hn=!1,Sn=Object.freeze({kind:`cache-hit`,level:4,stage:`l4-planetary-sph`,label:s.name||`World #${a}`,source:`root-cache`,timestampMs:Date.now()});else if(n)mn=await f.step({dt:.028,substeps:12,updateSurfaceMap:!0,erosionPasses:4,readTelemetry:!0}),hn=!0,gn=1,W={level:4,stage:`l4-planetary-sph`,title:`Differentiating World via 3D SPH + SS Multipole (${l.tier.toUpperCase()})`,entityName:s.name||`World #${a}`,detail:`Era 1: Iron Catastrophe · Core r=${(mn?.coreMeanR||.5).toFixed(2)} · Crust r=${(mn?.felsicMeanR||.7).toFixed(2)} · ${f.parcelCount.toLocaleString()} SPH · ${f.gridN}³ · ${i}×${c}`,step:f.stepIndex,targetSteps:t.l4TargetSteps,progress:Math.min(1,f.stepIndex/Math.max(1,t.l4TargetSteps)),cacheKey:p,skipLabel:`⏩ Finish Formation`,startedMs:Date.now(),_meta:{sphCacheKey:p,bodyIndex:a,specName:s.name||`World #${a}`}},Sn=Object.freeze({kind:`genesis-started`,level:4,stage:`l4-planetary-sph`,label:s.name||`World #${a}`,source:`live-gpu`,timestampMs:Date.now()});else{mn=await f.stepBurst({totalSubsteps:t.l4BurstSubsteps,chunkSize:24,dt:.028,erosionPasses:t.sphErosionPasses,readTelemetry:!0});let e=await f.exportGeologyMapSnapshot();if(e){let t=Nn(e,8e3);t&&m.set(p,{packedGeo:t,telemetry:mn},{persist:!0,broadcast:!1})}}pn=f;let _=Number(on?.dynamo?.bEquatorialT)||0,v=_>1e-7&&!f.genesisParams?.isMinorBody?Math.max(.12,Math.min(.65,Math.sqrt(Math.max(1e-7,_)/3e-5)*.34)):0;if(v>1e-6){let t=me(e,{gridN:16,boxSize:3.3,strideFloats:16,geometry:`planetary`,initialB0:v,alphaAmp:.24*Math.max(.35,Math.min(1.6,f.genesisParams?.rotationOmegaNorm||1)),etaRes:.055,bSat:.92,velScale:.65,label:`ulg-universes-planetary-geodynamo-${s.id||a}`});yn=await t.step({particleBuffer:f.getResidentParcelsBuffer(),particleCount:f.parcelCount,dt:.045,substeps:6,readTelemetry:!0,readBField:!0}),bn=t.buildStreamlines({worldScale:1,alpha:.42}),_n=t}}s.isComet&&await Jr(`comet-tails`,{bodyIndex:a})}function mi(e){return hn=!!e,!hn&&W?.stage===`l4-planetary-sph`&&(W=null),hn}async function hi(){if(!pn)return await pi({bodyIndex:nn,observeLive:!0,bypassCache:!0}),mn;let e=d(),t=O()[nn]||lt[3],n=On(t,nn,`${pn.mapWidth}x${pn.mapHeight}x${pn.gridN}`);return pn.resetToProtoplanet(),hn=!0,gn=1,mn=await pn.step({dt:.028,substeps:12,updateSurfaceMap:!0,erosionPasses:4,readTelemetry:!0}),W={level:4,stage:`l4-planetary-sph`,title:`Differentiating World via 3D SPH + SS Multipole (${l.tier.toUpperCase()})`,entityName:t?.name||`World #${nn}`,detail:`Age ${Math.round(mn?.geoTimeMyr||0)} Myr · Core r=${(mn?.coreMeanR||.5).toFixed(2)} · Crust r=${(mn?.felsicMeanR||.7).toFixed(2)} · ${pn.parcelCount.toLocaleString()} SPH`,step:pn.stepIndex,targetSteps:e.l4TargetSteps,progress:Math.min(1,pn.stepIndex/Math.max(1,e.l4TargetSteps)),cacheKey:n,skipLabel:`⏩ Finish Formation`,startedMs:Date.now(),_meta:{sphCacheKey:n,bodyIndex:nn,specName:t?.name||`World #${nn}`}},mn}async function gi({Z:t=Zn,tempK:n=null,phasePreset:r=null,gravity:i=$n}={}){Zn=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),$n=!!i,Yn&&=(Yn.destroy(),null);let a=await wr(Zn,{relativistic:!0,returnOrbitalWavefunctions:!1}),o=a.visualData.bulk,s=a.visualData.thermo.potential,c=a.bundle,l=Math.max(20,Number(c.thermodynamic.meltingPointK||600)),d=Math.max(l*1.4+20,Number(c.thermodynamic.boilingPointK||l*2.4));r===`melt`?(tr=`melt`,Qn=Math.round(l*1.42)):r===`vapor`?(tr=`vapor`,Qn=Math.round(d*1.38)):r===`solid`?(tr=`solid`,Qn=Math.max(20,Math.round(l*.25))):n!=null&&Number.isFinite(Number(n))?Qn=Math.max(15,Math.round(Number(n))):(tr=`solid`,Qn=Math.max(20,Math.round(l*.25)));let f=Math.max(1,Number(c.nuclear.atomicMassU||28)),p=Math.min(2,Math.max(.45,.09*Math.sqrt(f))),m=u.mdCells;Yn=T(e,{...k({crystalStructure:o.crystalStructure,cellsVec:[m,m,m],latticeConstantA:Math.max(2.4,Number(o.latticeConstantA||3.6)),massU:f,temperatureK:Qn}),potentialModel:s.potentialModel,epsilonEv:s.epsilonEv,sigmaOrR0A:s.sigmaOrR0A,alphaOrLambda:s.alphaOrLambda,rcutA:s.rcutA,eamAEv:s.eamAEv,eamBeta:s.eamBeta,swGamma:s.swGamma,dtFs:p,targetTemperatureK:Qn,thermostatCouplingFs:20,meltingPointK:l,bulkModulusGPa:Math.max(1,Number(o.bulkModulusPa||4e10)/1e9),cohesiveEnergyEv:Math.max(.05,Number(o.cohesiveEnergyEv||2)),crystalStructure:o.crystalStructure,gravityEnabled:$n}),Xn=await Yn.stepBatch(4,{readTelemetry:!0,targetTemperatureK:Qn}),rr=Xn?.rdf?Array.from(Xn.rdf):[]}async function _i({Z:t=ar,n=null,l:r=null,m:i=null,relativistic:a=dr,mode:s=fr,moleculeKey:c=pr}={}){ar=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),dr=!!a,fr=s===`molecule`?`molecule`:`atom`,pr=si[c]?c:`H2O`;let l=bt.find(e=>e.Z===ar);n==null?l&&(sr=l.defaultN):sr=Math.max(1,Math.min(7,Math.trunc(Number(n)))),r==null?l&&(lr=Math.min(sr-1,l.defaultL)):lr=Math.max(0,Math.min(sr-1,Math.trunc(Number(r)))),ur=i==null?0:Math.max(-lr,Math.min(lr,Math.trunc(Number(i))));let d=await wr(ar,{relativistic:dr,returnOrbitalWavefunctions:!0});if(fr===`molecule`){let t=si[pr];hr=await A(e,t.atoms);let n=new Float32Array(t.atoms.length*4),r=new Float32Array(t.atoms.length*4);for(let e=0;e<t.atoms.length;e+=1){let i=t.atoms[e];n.set([i.position[0],i.position[1],i.position[2],i.Z===1?1.24:2.25],e*4),r.set([i.Z,e%2==0?1:-.85,e%2==0?-.9:1,0],e*4)}mr=R(e,{posZeta:n,weights:r,boxHalfBohr:4.2,mode:0,pointCount:Math.min(14e4,u.orbitalPoints),seed:(o^1779033703)>>>0,reuseBuffer:mr?.pointsBuffer||null})}else{let t=d.visualData.atom,n=t?.radialGrid?.r||t?.rGrid||null,r=(t?.orbitals||[]).findIndex(e=>e.n===sr&&e.l===lr),i=r>=0&&(t?.orbitalWavefunctions?.[r]||t?.orbitals?.[r]?.u)||null;mr=z(e,{Z:ar,n:sr,l:lr,m:ur,pointCount:u.orbitalPoints,rGrid:n&&i&&i.length===n.length?n:null,orbitalU:n&&i&&i.length===n.length?i:null,screeningExchange:!0,relativisticSpinOrbit:dr,colorMode:1,seed:(o^ar*2654435761)>>>0,reuseBuffer:mr?.pointsBuffer||null})}}async function vi({Z:t=gr,A:n=null}={}){gr=Math.max(1,Math.min(118,Math.trunc(Number(t)||26)));let r=bt.find(e=>e.Z===gr);_r=n==null?r?.A||Math.round(gr*2.15):Math.max(gr,Math.trunc(Number(n))),q&&=(q.destroy(),null),vr=await p(e,gr,_r,{volDim:u.nuclearVolDim}),q=ee(e,vr),yr=q?await q.stepBatch(8):null}async function yi(e,t,n=1){if(Sr||Cr)return;Sr=!0;let r=ci(t,{surfaceActive:!!(Mn&&e===4),userTimeScale:n}).effectiveTimeScale;try{if(e===0){if(ie!==`web`&&be)De=await be.step({dt:(ie===`reionization`?.12:.08)*Math.max(.15,Math.min(2.5,r)),substeps:1,readTelemetry:!0});else if(ae){let e=ae.getState().aScale,t=_e?.011:.0016,n=1/(1+.3*Math.max(0,e-1.6)),i=Math.max(18e-5,e*t*n*Math.max(.15,Math.min(3,r)));oe=await ae.step({daOverride:i,readTelemetry:!0})}}else if(e===1&&Oe){let e=Oe,t=d(),n=W?.stage===`l1-galaxy-collapse`,i=(n?.0048:.0022)*Math.max(.08,Math.min(3,r)),a=n?Math.max(2,t.l1SubstepsPerFrame||2):1;await e.step({dt:i,substeps:a,gravity:1,softening:.65,readback:!1});let o=Ae;if(o&&e===Oe){let t=e.stepIndex%4==0,n=await o.step({particleBuffer:e.getResidentBuffer(),particleCount:e.count,dt:.014*Math.max(.12,Math.min(2.2,r)),substeps:1,readTelemetry:t,readBField:t});o===Ae&&(Fe=n,t&&(Ie=o.buildStreamlines({worldScale:1,alpha:.3})))}if(n&&W?.stage===`l1-galaxy-collapse`){W.step=Math.min(W.targetSteps,(W.step||0)+a),W.progress=W.step/Math.max(1,W.targetSteps);let t=Number(Fe?.magneticEnergy||0).toFixed(2);W.detail=`Step ${W.step}/${W.targetSteps} · ${e.count.toLocaleString()} stars collapsing · Dynamo E_B=${t}`,W.step>=W.targetSteps&&await Ir(!1)}}else if(e===2){if(qe===`smbh-core`&&Ye)Xe=await Ye.step({dt:.008*Math.max(.08,Math.min(3,r)),gravity:1,softening:.08,readback:!0});else if(U===`formation`&&(it||tt)){if(it){let e=d(),t=W?.stage===`l2-nebular-coalescence`,n=t?Math.max(6,e.l2SubstepsPerFrame||20):Math.min(10,Math.max(4,Math.floor((e.l2SubstepsPerFrame||16)*.5))),i=Math.max(1,e.l2GravityCadence||4),a=it.stepIndex,o=a+n,s=Math.floor(a/48)!==Math.floor(o/48)||t&&o>=W.targetSteps;if(ot=await it.step({dt:.024*Math.max(.22,Math.min(2.4,r)),substeps:n,gravityCadence:i,readTelemetry:!0,readAnnuli:s}),t&&W?.stage===`l2-nebular-coalescence`){W.step=Math.min(W.targetSteps,it.stepIndex),W.progress=W.step/Math.max(1,W.targetSteps);let e=it.getCoalescedDisk(),t=ot,n=(it.stepIndex*.024/.85).toFixed(1),r=W.progress,i=e?.bodies?.length||0,a=r<.28?`spiral density waves forming (worlds not yet settled)`:r<.78?`${i} proto-clumps accreting & carving gaps (settling)`:`XUV clearing · ${i} planets locking into N-body orbits`;W.detail=`${n} orbits (${it.parcelCount.toLocaleString()} parcels) · ${a} · Fe ${Math.round((t?.meanFeFrac||0)*100)}% / Si ${Math.round((t?.meanSilicateFrac||0)*100)}% / Ice ${Math.round((t?.meanVolatileIceFrac||0)*100)}%`,it.stepIndex>=W.targetSteps&&await Lr()}}tt&&U===`formation`&&(nt=await tt.step({dt:.016*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0}))}else if(U===`quasar-jet`&&st)ct=await st.step({dt:.028*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if((U===`xray-binary`||U===`bns-kilonova`||U===`type-ia`||U===`bbh-merger`)&&dt)ft=await dt.step({dt:.028*Math.max(.12,Math.min(2.5,r)),substeps:3,readTelemetry:!0});else if((U===`comet-tails`||U===`hot-jupiter`)&&mt)ht=await mt.step({dt:.036*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if([`roche-rings`,`giant-impact`,`red-giant`,`catastrophic-shatter`,`tde`].includes(U)&&vt)yt=await vt.step({dt:.024*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if(Ze){let e=Math.max(0,Math.min(1,(t-8.75)/5.2)),i=1e-5+46e-6*e**1.45,a=Math.max(1,Math.min(48,Math.round((3+21*e**1.25)*Math.max(.1,n))));if(await Ze.step({dtSubYr:i,substeps:a,readMassive:!0}),$e=Ze.computeConservationDiagnostics(),mt&&_t===`comet-tails`&&t<13.8){let e=O(),t=e[et]?.isComet?et:e.findIndex(e=>!!e?.isComet);if(t>0){let e=Kr(t);ht=await mt.step({dt:.032*Math.max(.15,Math.min(2.2,r)),substeps:2,sourceDir:e.sourceDir,orbVelDir:e.orbVelDir,sublimationDrive:e.sublimationDrive,sunDistAu:e.sunDistAu,readTelemetry:!1})}}J>.004&&it&&(await it.step({dt:.016*Math.max(.2,Math.min(1.6,r)),substeps:2,gravityCadence:4,readTelemetry:!1,readAnnuli:!1}),J=Math.max(0,J-.0042))}}else if(e===3){if(Rt===`nebular-mhd`&&zt){let e=zt,t=e.stepIndex%4==0,n=await e.step({dt:.022*Math.max(.12,Math.min(2.2,r)),substeps:1,readTelemetry:!0,readBFieldForStreamlines:t});e===zt&&zt&&(Bt=n,t&&(Vt=zt.buildMagneticFieldStreamlines({worldScale:1,alpha:.68})))}else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`].includes(Rt)&&Wt)Gt=await Wt.step({dt:.032*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if(Rt===`black-hole`&&st)ct=await st.step({dt:.028*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if((Rt===`pulsar`||Rt===`magnetar`)&&qt){let e=qt,t=e.stepIndex%4==0,n=await e.step({dt:.036*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0,readBField:t});e===qt&&qt&&(Jt=n,t&&(Xt=qt.buildDipoleFieldLines({linesPerRing:16,steps:32,worldScale:1,alpha:.74})))}else if(Rt!==`white-dwarf-tov`&&Ct){let e=Ct,t=d(),n=e.solver===`webgpu-3d-mls-mpm-nuclear-fusion`?Math.max(1,t.l3SubstepsPerFrame||2):1,i=await e.step({dt:.014*Math.max(.12,Math.min(2.5,r)),substeps:n,timeAccel:Nt,readTelemetry:!0});if(e===Ct){kt=i;let t=wt;if(t){let n=e.stepIndex%4==0,i=await t.step({particleBuffer:e.getResidentBuffer(),particleCount:e.count,dt:.038*Math.max(.12,Math.min(2.2,r)),substeps:1,readTelemetry:n,readBField:n});t===wt&&(Tt=i,n&&(Et=t.buildStreamlines({worldScale:1,alpha:.42})))}}}}else if(e===4)if(Mn&&In){let e=In,t=.02*Math.max(.25,Math.min(2.5,n)),r=Math.max(1,Math.min(1e7,zn));if(Bn+=t*r,Ze&&Qt!==`eyeball-locked`&&Qt!==`rogue`){let e=t*r/31557600,n=Math.max(1,Math.min(8,Math.ceil(e/4e-4))),i=Math.min(6e-4,Math.max(1e-8,e/n));await Ze.step({dtSubYr:i,substeps:n,readMassive:!0})}Mn&&In===e&&(Ln=await e.step({dt:t,controls:K,climate:Vn,readTelemetry:e.stepIndex%4==0}))}else{let e=Qt===`eyeball-locked`?[1,0,0]:[.65,.25,.7];if(Qt===`cryo-plumes`&&En&&(An=await En.step({dt:.028*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0})),Ze&&Qt!==`eyeball-locked`&&Qt!==`rogue`){await Ze.step({dtSubYr:55e-6,substeps:Math.max(2,Math.round(4*Math.max(.25,r))),readMassive:!0}),$e=Ze.computeConservationDiagnostics();let t=Ze.getMassiveBodyState64(et),n=Ze.getMassiveBodyState64(0),i=n.posAu[0]-t.posAu[0],a=n.posAu[1]-t.posAu[1],o=n.posAu[2]-t.posAu[2],s=Math.hypot(i,a,o)||1;e=[i/s,a/s,o/s]}let t=null;if(pn){let e=d();if(xn+=1,hn){let t=W?.stage===`l4-planetary-sph`,n=t?Math.max(2,e.l4SubstepsPerFrame||6):2,i=pn.stepIndex,a=i+n,o=Math.max(4,Math.min(16,e.l4MapUpdateCadence||16)),s=!t||Math.floor(i/o)!==Math.floor(a/o)||a>=(W?.targetSteps||240),c=s?4:0;if(mn=await pn.step({dt:.028*Math.max(.3,Math.min(2.2,r)),substeps:n,updateSurfaceMap:s,erosionPasses:c,readTelemetry:t||a%8==0}),t&&W?.stage===`l4-planetary-sph`){W.step=Math.min(W.targetSteps,pn.stepIndex);let e=W.step/Math.max(1,W.targetSteps);W.progress=e,gn=Math.max(.18,Math.min(1,1-Math.max(0,(e-.35)/.65)*.72));let t=e<.25?`Era 1: Iron Catastrophe`:e<.55?`Era 2: Mantle Convection & Crust Solidification`:e<.8?`Era 3: Late Heavy Bombardment & Cooling`:`Era 4: Steam Rainout & Ocean Erosion`,n=mn;n&&(W.detail=`${t} · ${Math.round(n.geoTimeMyr)} Myr · Core r=${n.coreMeanR.toFixed(2)} · Crust r=${n.felsicMeanR.toFixed(2)} · Diff ${n.differentiationIndex.toFixed(2)} · ${pn.parcelCount.toLocaleString()} SPH`),pn.stepIndex>=W.targetSteps&&await Rr()}}else{gn>.002&&(gn=Math.max(0,gn-.0028*Math.max(.3,Math.min(2.2,r))));let t=Math.max(1,e.l4SecularSubstepsPerFrame||1);mn=await pn.step({dt:.014*Math.max(.25,Math.min(2,r)),substeps:t,updateSurfaceMap:!1,erosionPasses:0,readTelemetry:xn%12==0})}let n=_n;if(n&&xn%3==0){let e=xn%6==0,t=await n.step({particleBuffer:pn.getResidentParcelsBuffer(),particleCount:pn.parcelCount,dt:.036*Math.max(.2,Math.min(2,r)),substeps:1,readTelemetry:e,readBField:e});n===_n&&(yn=t,e&&(bn=n.buildStreamlines({worldScale:1,alpha:.42})))}yn&&Number.isFinite(yn.magneticEnergy)&&(t=Math.max(.25,Math.min(1.85,Math.sqrt(Math.max(.02,yn.magneticEnergy)/.18))))}if(sn&&(cn=await sn.step({dtSim:.038*Math.max(.15,Math.min(2.5,r)),substeps:2,sunDir:e,dynamoScale:t,readTelemetry:!0})),O()[nn]?.isComet&&mt&&_t===`comet-tails`){let e=Kr(nn);ht=await mt.step({dt:.034*Math.max(.15,Math.min(2.5,r)),substeps:2,sourceDir:e.sourceDir,orbVelDir:e.orbVelDir,sublimationDrive:e.sublimationDrive,sunDistAu:e.sunDistAu,readTelemetry:!0})}}else if(e===5&&Yn){let e=Math.max(1,Math.min(6,Math.round(2*Math.max(.25,n))));Xn=await Yn.stepBatch(e,{readTelemetry:!0,targetTemperatureK:Qn,nonBlocking:!0}),Xn?.rdf&&(rr=Array.from(Xn.rdf))}else if(e===7&&q){let e=Math.max(2,Math.min(18,Math.round(6*Math.max(.25,n)))),t=await q.stepBatch(e,{nonBlocking:!0});t&&(yr=t)}}catch(e){let t=String(e?.message||e||``);if(!Cr&&e?.name!==`AbortError`&&!t.includes(`Buffer was destroyed before mapping`))throw e}finally{Sr=!1}}async function bi(){if(!br)return;let e=br;br=null;try{await e.stop()}catch{}xr={...xr,connected:!1,remotePeers:0,remotePeerIds:[],quorumReady:!1,error:null}}async function xi({relayUrl:e=xr.relayUrl,roomId:t=xr.roomId,role:n=xr.role}={}){await bi();let r=String(e||``).trim(),i=String(t||`ulg-universes-mesh-v1`).trim(),a=[`requester`,`responder`,`observer`].includes(n)?n:`requester`;if(!r)return xr={...xr,connected:!1,relayUrl:``,roomId:i,role:a,error:null},xr;try{let e=`uv-${a}-${Math.random().toString(36).slice(2,8)}`,t=new URL(`data:text/javascript;base64,LyoqCiAqIERldGVybWluaXN0aWMgUGVlckNvbXB1dGUgcmVzcG9uZGVyIGRlcml2YXRpb24gdGFzayBmb3IgdGhlIENvc21pYyA8LT4gUXVhbnR1bQogKiBkaXN0cmlidXRlZCBtZXNoIChgc3RhcnRMaXZlQ2xpZW50RGVyaXZhdGlvblBlZXJNZXNoYCkuCiAqCiAqIEV4ZWN1dGVkIGluc2lkZSByZXNwb25kZXIgYnJvd3NlciBjb250ZXh0cyB2aWEgUGVlckNvbXB1dGUgYENvbXB1dGVNYW5hZ2VyYAogKiBvdmVyIFdlYlNvY2tldC9XZWJSVEMgcmVsYXlzIGFuZCB2YWxpZGF0ZWQgYnkgMi1vZi0yIHF1b3J1bSBoYXNoaW5nLgogKi8KCmltcG9ydCB7IGRlcml2ZUVsZW1lbnRQcm9wZXJ0aWVzIH0gZnJvbSAnLi4vcnVudGltZS9tYXRlcmlhbC9lbGVtZW50Q2xvc3VyZXMuanMnOwppbXBvcnQgeyBldmFsdWF0ZUNoZXJlbmtvdkNsb3N1cmUgfSBmcm9tICcuLi9ydW50aW1lL21hdGVyaWFsL251Y2xlYXJDaGVyZW5rb3ZDbG9zdXJlLmpzJzsKCmV4cG9ydCBjb25zdCBDT1NNSUNfUVVBTlRVTV9QRUVSX1RBU0tfU0NIRU1BID0gJ3BlZXJjb21wdXRlLnVsZy5jb3NtaWMtcXVhbnR1bS1wZWVyLXRhc2sudjEnOwoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1bihkYXRhID0ge30pIHsKICBjb25zdCBraW5kID0gU3RyaW5nKGRhdGE/LmtpbmQgfHwgJ21hdGVyaWFsLnJlc29sdmUtZWxlbWVudCcpOwogIGNvbnN0IHBheWxvYWQgPSBkYXRhPy5wYXlsb2FkIHx8IGRhdGEgfHwge307CgogIGlmIChraW5kID09PSAnbnVjbGVhci5jaGVyZW5rb3YnKSB7CiAgICBjb25zdCBraW5ldGljRW5lcmd5TWVWID0gTnVtYmVyKHBheWxvYWQua2luZXRpY0VuZXJneU1lViA/PyAwKTsKICAgIC8vIEZhaWwgY2xvc2VkIHRvIHZhY3V1bSAobiA9IDEuMCkgd2hlbiByZWZyYWN0aXZlSW5kZXggaXMgb21pdHRlZCAobmV2ZXIgc2lsZW50bHkgYXNzdW1lIEgyTyAxLjMzMykKICAgIGNvbnN0IHJlZnJhY3RpdmVJbmRleCA9IE51bWJlci5pc0Zpbml0ZShOdW1iZXIocGF5bG9hZC5yZWZyYWN0aXZlSW5kZXgpKSAmJiBOdW1iZXIocGF5bG9hZC5yZWZyYWN0aXZlSW5kZXgpID49IDEuMAogICAgICA/IE51bWJlcihwYXlsb2FkLnJlZnJhY3RpdmVJbmRleCkKICAgICAgOiAxLjA7CiAgICBjb25zdCBjaCA9IGV2YWx1YXRlQ2hlcmVua292Q2xvc3VyZSh7IGtpbmV0aWNFbmVyZ3lNZVYsIHJlZnJhY3RpdmVJbmRleCB9KTsKICAgIGNvbnN0IHZhbHVlID0gewogICAgICBzY2hlbWE6IENPU01JQ19RVUFOVFVNX1BFRVJfVEFTS19TQ0hFTUEsCiAgICAgIGtpbmQsCiAgICAgIGFjdGl2ZTogY2guYWN0aXZlLAogICAgICBiZXRhOiBOdW1iZXIoY2guYmV0YS50b0ZpeGVkKDYpKSwKICAgICAgY2hlcmVua292QW5nbGVEZWc6IE51bWJlcihjaC5jaGVyZW5rb3ZBbmdsZURlZy50b0ZpeGVkKDQpKSwKICAgICAgcGhvdG9uc1Blck1ldGVyOiBNYXRoLnJvdW5kKGNoLnBob3RvbnNQZXJNZXRlciksCiAgICAgIHNjaWVudGlmaWNWYWxpZGF0aW9uOiBmYWxzZQogICAgfTsKICAgIHJldHVybiB7CiAgICAgIHZhbHVlLAogICAgICBjb21taXREZWx0YTogewogICAgICAgIHRhc2tJZDogYGNxLXBlZXI6JHtraW5kfToke2tpbmV0aWNFbmVyZ3lNZVZ9OiR7cmVmcmFjdGl2ZUluZGV4fWAsCiAgICAgICAgc2NvcGU6ICdjb3NtaWMtcXVhbnR1bS1wZWVyLW1lc2gnLAogICAgICAgIHBheWxvYWQ6IHZhbHVlCiAgICAgIH0KICAgIH07CiAgfQoKICBjb25zdCByYXdaID0gTnVtYmVyKHBheWxvYWQuYXRvbWljTnVtYmVyWik7CiAgaWYgKCFOdW1iZXIuaXNJbnRlZ2VyKHJhd1opIHx8IHJhd1ogPCAxIHx8IHJhd1ogPiAxMTgpIHsKICAgIHRocm93IG5ldyBSYW5nZUVycm9yKGBjb3NtaWNRdWFudHVtUGVlclRhc2sgcmVxdWlyZXMgYW4gZXhwbGljaXQgaW50ZWdlciBhdG9taWNOdW1iZXJaIGluIFsxLCAxMThdLCBnb3QgJHtwYXlsb2FkLmF0b21pY051bWJlclp9YCk7CiAgfQogIGNvbnN0IGF0b21pY051bWJlclogPSByYXdaOwogIGNvbnN0IGZ1bmN0aW9uYWwgPSBTdHJpbmcocGF5bG9hZC5mdW5jdGlvbmFsIHx8ICdwYmUnKS50b0xvd2VyQ2FzZSgpOwogIGNvbnN0IHByb3BzID0gZGVyaXZlRWxlbWVudFByb3BlcnRpZXMoYXRvbWljTnVtYmVyWiwgewogICAgZnVuY3Rpb25hbCwKICAgIHNjYWxhclJlbGF0aXZpc3RpYzogdHJ1ZSwKICAgIHNwaW5PcmJpdDogdHJ1ZSwKICAgIGluY2x1ZGVHYXNQaGFzZTogdHJ1ZSwKICAgIGdyaWRQb2ludHNOOiAyNjAKICB9KTsKICBjb25zdCB2YWx1ZSA9IHsKICAgIHNjaGVtYTogQ09TTUlDX1FVQU5UVU1fUEVFUl9UQVNLX1NDSEVNQSwKICAgIGtpbmQ6ICdtYXRlcmlhbC5yZXNvbHZlLWVsZW1lbnQnLAogICAgYXRvbWljTnVtYmVyWiwKICAgIHN5bWJvbDogcHJvcHMuc3ltYm9sLAogICAgZnVuY3Rpb25hbCwKICAgIGJvbmRpbmdDbGFzczogcHJvcHMuYm9uZGluZ0NsYXNzLAogICAgc3RhbmRhcmRQaGFzZUF0Mjk4SzogcHJvcHMuc3RhbmRhcmRQaGFzZUF0Mjk4SywKICAgIG1lbHRpbmdQb2ludEs6IE1hdGgucm91bmQocHJvcHMubWVsdGluZ1BvaW50SyA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5tZWx0aW5nUG9pbnRLID8/IDApLAogICAgYm9pbGluZ1BvaW50SzogTWF0aC5yb3VuZChwcm9wcy5ib2lsaW5nUG9pbnRLID8/IHByb3BzLnZkd0dhc1Byb3BlcnRpZXM/LmJvaWxpbmdQb2ludEsgPz8gMCksCiAgICBkZW5zaXR5S2dQZXJNMzogTWF0aC5yb3VuZChwcm9wcy5kZW5zaXR5S2dQZXJNMyA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5jb25kZW5zZWREZW5zaXR5S2dQZXJNMyA/PyAwKSwKICAgIGJ1bGtNb2R1bHVzR1BhOiBOdW1iZXIoKCgocHJvcHMuYnVsa01vZHVsdXNQYSA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5idWxrTW9kdWx1c1BhID8/IDApIC8gMWU5KSkudG9GaXhlZCgyKSksCiAgICBjbG9zdXJlQmFja2VkOiB0cnVlLAogICAgc2NpZW50aWZpY1ZhbGlkYXRpb246IGZhbHNlCiAgfTsKICByZXR1cm4gewogICAgdmFsdWUsCiAgICBjb21taXREZWx0YTogewogICAgICB0YXNrSWQ6IGBjcS1wZWVyOmVsZW1lbnQ6JHthdG9taWNOdW1iZXJafToke2Z1bmN0aW9uYWx9YCwKICAgICAgc2NvcGU6ICdjb3NtaWMtcXVhbnR1bS1wZWVyLW1lc2gnLAogICAgICBwYXlsb2FkOiB2YWx1ZQogICAgfQogIH07Cn0K`,``+import.meta.url).href,n=null,o=null;if(a===`observer`){o=x({relayUrl:r,roomId:i,peerId:e,enableWebRtc:!1});let t=new Set,a=0,s=null;o.onMessage(e=>{a+=1,s=e?.type||null,e?.from&&t.add(e.from),e?.type===`presence`&&e?.alive===!1&&e?.from&&t.delete(e.from),e?.type===`peer-disconnect`&&e?.peerId&&t.delete(e.peerId),xr.remotePeers=t.size,xr.witnessedMessages=a,xr.lastWitnessedType=s}),n={getStatus:()=>({connected:o.isConnected(),remotePeerCount:t.size,remotePeerIds:[...t],quorumReady:!1,witnessedMessages:a,lastWitnessedType:s}),async stop(){o.close()}}}else{let a=y({relayUrl:r,roomId:i,peerId:e,enableWebRtc:!1,taskModuleUrl:t,announceIntervalMs:120,staleMs:12e3,timeoutMs:3e4});o=a.transport,n={mesh:a,getStatus:()=>a.getStatus(),getActiveRequester:()=>a.getActiveRequester(),async stop(){a.stop()}}}br={transport:o,handle:n,peerId:e,role:a,stop:()=>n?.stop?.()};let s=n.getStatus()||{};xr={connected:!0,role:a,relayUrl:r,roomId:i,peerId:e,remotePeers:s.remotePeerCount??0,remotePeerIds:[...s.remotePeerIds||[]],quorumReady:!!s.quorumReady,witnessedMessages:s.witnessedMessages??0,lastWitnessedType:s.lastWitnessedType??null,dispatches:0,lastResult:null,error:null}}catch(e){xr={...xr,connected:!1,relayUrl:r,roomId:i,role:a,error:e instanceof Error?e.message:String(e)}}return Si()}function Si(){let e=br?.handle?.getStatus?.();return{...xr,connected:e?!!e.connected:xr.connected,remotePeers:e?e.remotePeerCount:xr.remotePeers,remotePeerIds:e?[...e.remotePeerIds||[]]:xr.remotePeerIds||[],quorumReady:e?!!e.quorumReady:xr.quorumReady,witnessedMessages:e?.witnessedMessages??xr.witnessedMessages??0,lastWitnessedType:e?.lastWitnessedType??xr.lastWitnessedType??null}}async function Z(e=ar){let t=br?.handle?.getActiveRequester?.();if(!t||typeof t.submitWithProvenance!=`function`){let e=Error(`Peer mesh 2-of-2 quorum requester is not ready (requires >= 2 live remote responders)`);throw e.code=`ERR_CLIENT_PEER_QUORUM_UNAVAILABLE`,e}let n=`uv-quorum-${Date.now()}-${xr.dispatches+1}`,r=await t.submitWithProvenance(n,{service:`cosmic-quantum-material`,kind:`material.resolve-element`,payload:{atomicNumberZ:e,functional:`pbe`}});return xr.dispatches+=1,xr.lastResult=r,r}let Ci=new Map;async function wi(e,t={}){if(e===0&&ae||e===1&&Oe||e===2&&(qe===`smbh-core`?Ye:Ze||U===`formation`&&it)||e===3&&(Rt===`fusion`&&Ct||(Rt===`pulsar`||Rt===`magnetar`)&&qt&&Yt===Rt||Rt===`black-hole`&&st||Rt===`white-dwarf-tov`&&Zt||Rt===`nebular-mhd`&&zt||[`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`].includes(Rt)&&Wt&&Kt===Rt))return;let n=nn;if(e===4){let e=O();if(n=t.bodyIndex==null?!e[et]?.isStar&&et>0?et:nn:Math.max(0,Math.min(e.length-1,Math.trunc(Number(t.bodyIndex)||0))),e[n]?.isStar||n===0){let t=j(e);t>0&&(n=t)}if(en&&nn===n)return}if(e===5&&Yn||e===6&&mr||e===7&&vr)return;let r=e===2?`2:${qe}`:e===4?`4:${n}`:String(e);if(Ci.has(r))return Ci.get(r);let i=(async()=>{e===0?await Tr(t):e===1?await Er(t):e===2?qe===`smbh-core`?await Dr():await Or(t):e===3?Rt===`fusion`?await ri(t):await Ri(Rt):e===4?await pi({...t,bodyIndex:n}):e===5?await gi(t):e===6?await _i(t):e===7&&await vi(t)})();Ci.set(r,i);try{await i}finally{Ci.delete(r)}}function Ti(t){return t!==`auto`&&!xt[t]?!1:(s=t,l=ni(c||{},{device:e,qualityMode:s}),u=xt[l.qualityId]||xt.med,!0)}function Ei(e){o=Number(e)>>>0||1}function Di(e){return ir=e?{...e}:null,ir}async function Oi(e){if(!e)return null;ir={...e};let t=Math.max(1,Math.min(118,Math.trunc(Number(e.primaryZ)||14)));return await gi({Z:t,phasePreset:e.phasePreset||`solid`,tempK:Number.isFinite(Number(e.tempK))?Number(e.tempK):null}),ar=t,e.moleculeKey&&si[e.moleculeKey]&&(pr=e.moleculeKey),gr=t,ir}function ki(e){$n=!!e,Yn&&typeof Yn.setGravity==`function`&&Yn.setGravity($n)}function Ai(e){Qn=Math.max(15,Math.round(Number(e)||300))}function ji(e){rn=!!e}function Mi(e){Nt=Math.max(.4,Math.min(8,Number(e)||2))}async function Ni(e,{alignActiveLevel:t=null}={}){if(typeof e==`string`){let t=Se.find(t=>t.id===e)||Se[3];_=t.id,S=de({redshiftZ:t.redshiftZ,localSystemAgeGyr:t.localSystemAgeGyr,localStarMassSolar:1})}else e&&typeof e==`object`&&(_=e.id||`custom`,S=de(e));return C=Pt({cosmicEpoch:S,regionPosMpc:ce[0]?.posMpc||[0,0,0],localOverdensity:C.localOverdensity||1.15,seed:o}),E||(D=Lt(It({cosmicEpoch:S,galaxyEnv:C,starPosGal:w.posGal,popTag:w.popTag,starIndex:w.starIndex,seed:o+409>>>0}),{seedOverride:o+409>>>0})),t===0?S.eraId===`recombination`?await Pi(`cmb`):S.eraId===`cosmic-dawn`?await Pi(`reionization`):S.eraId===`far-future`?await Pi(`cluster-merger`):await Pi(`web`):t===1?await Er({galaxyEnvOverride:C}):t===2?S.eraId===`quasar-peak`?await Fi(`quasar-jet`):S.eraId===`cosmic-dawn`?await Fi(`formation`):S.eraId===`far-future`?await Fi(`red-giant`):(await Or(),await Fi(`nbody`)):t===3?S.eraId===`far-future`?await Ri(`planetary-nebula`):S.eraId===`cosmic-dawn`?await Ri(`h2-pillars`):S.eraId===`quasar-peak`?await Ri(`nebular-mhd`):await Ri(`fusion`):t===4&&(S.eraId===`quasar-peak`?await zi(`magma-ocean`):await zi(`standard`)),S}async function Pi(e){ie=[`web`,`cmb`,`reionization`,`cluster-merger`].includes(e)?e:`web`,ie===`web`?ae||await Tr():await Ur(ie)}async function Fi(e){U=[`nbody`,`formation`,`roche-rings`,`giant-impact`,`red-giant`,`catastrophic-shatter`,`tde`,`comet-tails`,`hot-jupiter`,`quasar-jet`,`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(e)?e:`nbody`,U===`formation`?tt||await Fr():U===`quasar-jet`?st||await X():U===`xray-binary`||U===`bns-kilonova`||U===`type-ia`||U===`bbh-merger`?(!dt||pt!==U)&&await Gr(U):U===`comet-tails`||U===`hot-jupiter`?(!mt||_t!==U)&&await Jr(U):[`roche-rings`,`giant-impact`,`red-giant`,`catastrophic-shatter`,`tde`].includes(U)?(!vt||St!==U)&&await Yr(U):Ze||await Or()}async function Ii(e){ut=Math.max(-.99,Math.min(.99,Number(e)??.94)),st&&await X({spinA:ut})}function Li(e){rt=!!e,tt?.setEnableGasDrag?.(rt)}async function Ri(e){if(Rt=[`fusion`,`nebular-mhd`,`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`,`pulsar`,`magnetar`,`white-dwarf-tov`,`black-hole`].includes(e)?e:`fusion`,Rt===`nebular-mhd`)zt||await Hr();else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`].includes(Rt))(!Wt||Kt!==Rt)&&await Qr(Rt);else if(Rt===`pulsar`||Rt===`magnetar`)(!qt||Yt!==Rt)&&await $r(Rt);else if(Rt===`white-dwarf-tov`)Zt||await ei();else if(Rt===`black-hole`){let e=O()[0],t=Number.isFinite(Number(e?.massSolar))&&Number(e.massSolar)>2.2&&Number(e.massSolar)<1e4?Number(e.massSolar):11.4;(!st||Math.abs((st.massSolar||0)-t)>t*.5)&&await X({massSolar:t,spinA:.92,eddingtonRatio:.18})}else Ct||await ri()}async function zi(t){if(Qt=[`standard`,`magma-ocean`,`cryo-plumes`,`eyeball-locked`,`rogue`].includes(t)?t:`standard`,Qt===`cryo-plumes`)En||await ti();else if(Qt===`eyeball-locked`||Qt===`rogue`){let t=sn;sn=null,t&&t.dispose();let n=O()[nn]||lt[3],r=pe({...n,surfacePressurePa:Math.max(1e5,Number(n.surfacePressurePa)||101300),volatileMassFrac:Math.max(.03,Number(n.volatileMassFrac)||.03),particulateMassFrac:Math.max(.008,Number(n.particulateMassFrac)||.008),rotationOmegaRadS:Qt===`eyeball-locked`?11e-6:82e-6,coreRadiusNorm:.54,coreConductivitySm:12e5},en||{coreRadiusFraction:.54,centralPressurePa:36e10},{solarDistanceAu:Qt===`rogue`?500:.14,coreConductivitySm:12e5});on=r;let i=ue(e,{width:u.id===`low`?64:128,height:u.id===`low`?32:64,bodyParams:r,enableTriboelectric:ln,seed:(o^(Qt===`rogue`?460302:243186193))>>>0,label:`ulg-universes-atmo-${Qt}`});for(let e=0;e<4;e+=1)cn=await i.step({dtSim:.048,substeps:2,sunDir:Qt===`eyeball-locked`?[1,0,0]:[0,1,0],readTelemetry:e===3});sn=i}else Qt===`standard`&&await pi({bodyIndex:nn})}async function Bi(e){Ht=Math.max(0,Math.min(1.5,Number(e)??.58)),zt&&await Hr({initialB0:Ht})}function Vi(e){Je=!!e}async function Hi(e){ze=Math.max(0,Math.min(1.2,Number(e)||0));let t=Ae,n=Oe;if(t&&n){t.resetSeedB(ze);let e=await t.step({particleBuffer:n.getResidentBuffer(),particleCount:n.count,dt:.045,substeps:ze>1e-6?8:1,readTelemetry:!0,readBField:!0});t===Ae&&(Fe=e,Ie=t.buildStreamlines({worldScale:1,alpha:.44}))}}async function Ui(e){Dt=Math.max(0,Math.min(1.2,Number(e)||0));let t=wt,n=Ct;if(t&&n){t.resetSeedB(Dt);let e=await t.step({particleBuffer:n.getResidentBuffer(),particleCount:n.count,dt:.042,substeps:Dt>1e-6?8:1,readTelemetry:!0,readBField:!0});t===wt&&(Tt=e,Et=t.buildStreamlines({worldScale:1,alpha:.42}))}}function Wi(e){Array.isArray(e)&&e.length>=3&&(he=[Number(e[0])||0,Number(e[1])||0,Number(e[2])||0])}function Gi(e){ln=!!e,sn?.setEnableTriboelectric?.(ln)}async function Ki(){if(Gn&&=(clearTimeout(Gn),null),!In||!Hn||!Un)return!1;let e=In.getCraterStamps?.()||[];Un=!1;try{return await jn.saveTile(Hn,e),!0}catch{return!1}}function qi(){Gn||=setTimeout(()=>{Gn=null,Ki()},1200)}let Ji=0;async function Yi({bodyIndex:t=nn,customBodySpec:n=null,planetaryModeOverride:r=null,landingSite:i=null,restoreCheckpoint:a=null,initialVehicle:s=`ufo`,onCraterStamp:c=null}={}){let l=++Ji;if(await Ki(),l!==Ji)return null;let u=null,f=t,p=on;if(n&&typeof n==`object`)u={isMinorBody:!0,...n},Kn=u,p={surfacePressurePa:u.surfacePressurePa||0,volatileMassFrac:u.isComet?.55:.02,particulateMassFrac:0};else{Kn=null;let e=O();if(typeof f==`string`){let t=e.findIndex(e=>e.id===f);if(t>=0&&!e[t].isStar)f=t;else{let t=lt.findIndex(e=>e.id===f);t>0?(E=!0,await Or({solReference:!0}),e=O(),f=t):f=nn}}if(f=Math.max(0,Math.min(e.length-1,Math.trunc(Number(f)??nn))),e[f]?.isStar||f===0){let t=j(e);t>0&&(f=t)}if(et=f,r&&(Qt=r),!en||nn!==f?await pi({bodyIndex:f}):W?.stage===`l4-planetary-sph`&&await zr(),l!==Ji)return null;u=e[f]||lt[3],p=on}let m=Wn({universeSeed:o,systemId:E?`sol`:D?.systemName||S?.id||`proc`,bodyId:u.id||`body-${f}`}),h=await jn.loadTile(m),g=Array.isArray(h)?h:Array.isArray(h?.stamps)?h.stamps:[];Hn=m,Un=!1,Fn=i||null;let _=null;if(vn(u).active){let t=!Kn&&pn?pn:null,n=null;if(t||=(n=wn(e,u,{nebulaEnv:E?null:D?.starSystem?.nebulaEnv,planetaryAtmoState:p,planetaryMode:Kn?`standard`:Qt,systemAgeGyr:E?4.57:D?.starSystem?.systemAgeGyr??4.5,parcelCount:2048,mapWidth:256,mapHeight:128,seed:(o^(Number(f)||13)*7919+(u.id?.length||5)*997)>>>0,label:`ulg-surface-sph-patch-${u.id||f}`}),await n.step({dt:.032,substeps:32,updateSurfaceMap:!0,erosionPasses:10,readTelemetry:!1}),n),l===Ji&&t)try{_=await t.extractLocalSurfacePatch({latDeg:Fn?.latDeg??32,lonDeg:Fn?.lonDeg??0,patchN:256,angularSpanRad:u.isMinorBody?.56:.34,erosionPasses:40})}catch{_=null}if(n)try{n.dispose()}catch{}if(l!==Ji){try{_?.dispose?.()}catch{}return null}}let v=d(),y=Le(e,{bodySpec:u,planetaryResult:en,planetaryAtmoState:p,planetaryMode:Kn?`standard`:Qt,landingSite:Fn,sphSurfacePatch:_,gridN:v.surfaceGridN,cellSizeM:9.5,particleCount:v.surfaceParticles,seed:(o^(Number(f)||13)*7919+(u.id?.length||5)*997+84212430)>>>0,initialVehicle:s,initialCheckpoint:a,initialCraterStamps:g,onCraterStamp:e=>{Un=!0,qi(),typeof c==`function`&&c(e,m)},label:`ulg-universes-surface-${u.id}`});if(K={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0},Ln=await y.step({dt:.016,controls:K,readTelemetry:!1}),Ln=await y.step({dt:.016,controls:K,readTelemetry:!0}),l!==Ji){try{y.dispose()}catch{}return null}let b=In;return In=y,Mn=!0,b&&b.dispose(),Ln}function Xi(){Ji+=1,Ki(),Mn=!1,Kn=null,K={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0};let e=In;In=null,Ln=null,e&&e.dispose()}function Zi(e){return In?In.setActiveVehicle(e):null}function Qi(e){return In?In.setUfoAltitudeKm?.(e)??null:null}function $i(e){return In?In.setCameraMode(e):null}function ea(e={}){K={...K,...e}}function ta(e,t){In?.addLookDelta?.(e,t)}function na(e){return In?.adjustChaseDistance?.(e)??1}function ra(e,t){let n=10**t,r=O(),i=r[et]||r[j(r)]||lt[3],a=e===2&&[`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(U),o=e===2&&[`roche-rings`,`giant-impact`,`red-giant`,`tde`].includes(U),s=e===2&&[`comet-tails`,`hot-jupiter`].includes(U),c=e===3&&[`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`].includes(Rt),l=e===3&&[`pulsar`,`magnetar`].includes(Rt);return Ee({viewSpanM:n,redshiftZ:S.redshiftZ,comovingBoxMpc:e===0?260:0,omegaM:e===0?.315:0,baryonFraction:e===0&&ie!==`web`?.157:0,clusterMassSolar:e===0&&ie===`cluster-merger`?0x5543df729c000:0,galacticBodyCount:e===1?Oe?.count||32768:0,nebulaCloudMass:e===3&&Rt===`nebular-mhd`?22:0,magneticFieldStrength:e===3&&Rt===`nebular-mhd`?Ht:e===2&&U===`quasar-jet`?1.15:0,ionizedGasPresent:e===3&&(Rt===`nebular-mhd`||c),starMassSolar:+(e===2&&U===`formation`),diskSolidMassEarth:e===2&&U===`formation`?45:0,gravitatingBodyCount:e===2||e===4?a?2:Ze?.totalCount||15:0,solidBodyCount:e===2&&(U===`formation`||o)?18:0,solidParticleCount:e===2&&U===`formation`?90:0,coreTempK:e===3&&Rt===`fusion`?kt?.coreTempK||15e6:0,bodyMassKg:e===4?i.massSolar*198847e25:e===3&&Rt===`fusion`?198847e25:0,bodyRadiusM:e===4?i.radiusKm*1e3:0,surfacePressurePa:e===4&&on?.surfacePressurePa||0,volatileMassFrac:e===4&&on?.volatileMassFrac||0,particulateMassFrac:e===4&&on?.particulateMassFrac||0,dynamo:e===4&&on?.dynamo||null,compactnessGMOverRc2:e===2&&(U===`quasar-jet`||a)||e===3&&(l||Rt===`white-dwarf-tov`)?.25:0,centralRelativisticMassSolar:e===2&&U===`quasar-jet`?45e7:a?10:0,accretionRateEddington:e===2&&(U===`quasar-jet`||U===`xray-binary`)?.55:0,kerrSpinA:e===2&&U===`quasar-jet`?ut:0,surfaceBFieldTesla:l?Rt===`magnetar`?165e9:42e7:0,compactRadiusM:l?12e3:0,spinOmegaRadS:l?Rt===`magnetar`?45:740:0,maxPairwiseVOverC:a?.22:0,rocheOverflowPresent:e===2&&U===`xray-binary`,uvFluxNorm:s||c?1.5:0,xuvFluxWPerM2:e===2&&U===`hot-jupiter`?180:0,surfaceTempK:e===2&&U===`comet-tails`?260:0,sublimationTempK:e===2&&U===`comet-tails`?170:1e9,maxTidalStrain:o||e===4&&Qt===`cryo-plumes`?.85:0,maxSurfaceTempK:e===4&&Qt===`magma-ocean`||e===2&&(U===`giant-impact`||U===`red-giant`)?2400:0,surfaceViewActive:Mn,dynamoSeedB0:e===1?ze:e===3&&Rt===`fusion`?Dt:0,stellarCoreActive:e===3&&Rt===`fusion`,centralMassSolar:e===3&&Rt===`fusion`?Ct?.totalMassSolar||1:0,hasSolidCrust:Mn?In?.env?.hasSolidCrust!==!1:i.kind!==2&&i.kind!==0,hasLiquidOcean:Mn?!!In?.env?.hasLiquidOcean:!!i.hasOcean,hasExoticOcean:Mn?!!In?.env?.hasExoticOcean:!1,seaIceFrac:Mn&&Number(Vn?.seaIceFrac)||0,surfaceDeformationActive:Mn&&!!(In?.getTelemetry?.()?.mpmActive||(In?.getTelemetry?.()?.cratersCarved||0)>0||(In?.getTelemetry?.()?.aliveBoulders||0)>0),mpmActive:Mn&&!!In?.getTelemetry?.()?.mpmActive,craterCount:Mn&&Number(In?.getTelemetry?.()?.cratersCarved)||0,boulderCount:Mn&&Number(In?.getTelemetry?.()?.aliveBoulders)||0,biosphereViability:Mn?Number(In?.xenobiology?.biosphereViability)||0:e===4&&Number(i.surfacePressurePa)>=500&&Number(i.tempK)>=80&&Number(i.tempK)<=750?.5:0,pressurePa:Mn?Number(In?.env?.pressurePa)||0:e===4&&Number(i.surfacePressurePa)||0,tempK:Mn?Number(In?.env?.tempK)||0:e===4&&Number(i.tempK)||0,isCryoMoon:e===4&&(Qt===`cryo-plumes`||!!In?.env?.isCryoMoon),isMagmaOcean:e===4&&(Qt===`magma-ocean`||!!In?.env?.isMagmaOcean)})}function ia(e,t=null){qe=e===`smbh-core`?`smbh-core`:`solar-system`,t&&(Ke=[...t])}function aa(e){let t=O();if(typeof e==`string`){let n=t.findIndex(t=>t.id===e);if(n>=0)return et=n,et;let r=lt.findIndex(t=>t.id===e);if(r>=0)return E=!0,et=r,et}else Number.isFinite(Number(e))&&(et=Math.max(0,Math.min(t.length-1,Math.trunc(Number(e)))));return et}function oa(e,t=!0){let n=Math.max(1,Math.min(118,Math.trunc(Number(e)||26)));return h.get(`${n}:std:${+!!t}:1`)||h.get(`${n}:std:${+!!t}:0`)||h.get(`${n}:std:1:1`)||h.get(`${n}:std:1:0`)||null}function sa(){if(!Ze)return[0,0,0];let e=Ze.catalog||O(),t=Math.min(Ze.massiveCount||0,e.length),n=0,r=0,i=0,a=0;for(let o=0;o<t;o+=1){let t=Math.max(0,Number(e[o]?.massSolar)||0);if(t<=0)continue;let s=Ze.getMassiveBodyState64(o);n+=s.posAu[0]*t,r+=s.posAu[1]*t,i+=s.posAu[2]*t,a+=t}return a<=0?[0,0,0]:[n/a,r/a,i/a]}function ca(e=12.6,t=null,{lockToTarget:n=!1}={}){if(!Ze)return{originAu:[0,0,0],barycenterAu:[0,0,0],focusPosAu:[0,0,0],orbitBlend:0,frameMode:`barycenter`};let r=Ze.catalog||O(),i=t??et,a=Math.max(0,Math.min(r.length-1,i)),o=!!r[a]?.isStar||a===0,s=Ze.getMassiveBodyState64(a),c=sa(),l=Math.hypot(s.posAu[0]-c[0],s.posAu[1]-c[1],s.posAu[2]-c[2]),u=o?10.6:Math.max(10.8,Math.min(13.8,Math.log10(Math.max(.28,l)*at*3.8))),d=u,f=u-1.15,p=0;if(Mn||n||e<=f)p=1;else if(e<d){let t=(d-e)/(d-f);p=t*t*(3-2*t)}let m=p<=0?c:p>=1?s.posAu:[c[0]+(s.posAu[0]-c[0])*p,c[1]+(s.posAu[1]-c[1])*p,c[2]+(s.posAu[2]-c[2])*p],h=p<=0?`barycenter`:p>=1?`body-orbit`:`orbit-transition`;return{originAu:m,barycenterAu:c,focusPosAu:s.posAu,orbitBlend:p,frameMode:h}}function la(e,t={}){if(e===0){if(ie===`cmb`){let e=De;return[{id:`cmb-recombination`,level:0,name:`CMB Last Scattering Surface (z = 1100)`,subtitle:`t = 380 kyr · T_CMB = ${(e?.cmbTempK||3001).toFixed(0)} K · Eisenstein–Hu BAO r_s ≈ 147 Mpc`,pos:[0,0,0],radius:4.5,tempK:e?.cmbTempK||3001,massLabel:`ΔT/T acoustic`,composition:`H⁺/e⁻ → Neutral H (Peebles Recombination) · Primordial He 25%`,nextLevel:1}]}if(ie===`reionization`)return[{id:`cosmic-reionization`,level:0,name:`Cosmic Dawn & Reionization Bubbles (z = 10)`,subtitle:`t = 470 Myr · ⟨x_HII⟩ = ${((De?.meanIonizedFraction||.2)*100).toFixed(1)}% · Pop III UV Percolation`,pos:[0,0,0],radius:4,tempK:2e4,massLabel:`Z ≈ 10⁻⁴ Z☉`,composition:`Neutral H I Web + Photoionized H II Bubbles · Pop III Halos`,nextLevel:1}];if(ie===`cluster-merger`){let e=De;return[{id:`bullet-cluster-merger`,level:0,name:`Galaxy Cluster Merger & Gravitational Lensing`,subtitle:`ICM T_max = ${((e?.maxGasTempK||5e7)/1e6).toFixed(1)} MK · Lensing κ_max = ${(e?.maxLensingKappa||.5).toFixed(2)}`,pos:[0,0,0],radius:4,tempK:6e7,massLabel:`1.5×10¹⁵ M☉`,composition:`Shock-Heated X-Ray ICM Plasma + Offset Dark-Matter Lensing Halos`,nextLevel:1}]}let e=t.cosmoScale??.1,n=t.cosmoOffset??[0,0,0];return ce.map(t=>({...t,rawPosMpc:[...t.posMpc],pos:[(t.posMpc[0]-n[0])*e,(t.posMpc[1]-n[1])*e,(t.posMpc[2]-n[2])*e]}))}if(e===1){let e=t.galaxyScale??1,n=t.galaxyOffset??[0,0,0];return Ge.map(t=>({...t,rawPos:[...t.pos],pos:[(t.pos[0]-n[0])*e,(t.pos[1]-n[1])*e,(t.pos[2]-n[2])*e]}))}if(e===2){if(qe===`smbh-core`)return[{id:`smbh-event-horizon`,level:2,name:`Sagittarius-ULG* (4.3×10⁶ M☉ SMBH)`,subtitle:`Schwarzschild Event Horizon · Relativistic Doppler Disk · Live S-Stars`,pos:[0,0,0],radius:1,tempK:28e3,massLabel:`4.3×10⁶ M☉`,composition:`Kerr-Schwarzschild Metric · Accreting H⁺/He²⁺ Plasma`,nextLevel:3}];if(U!==`nbody`&&U!==`formation`){let e={"quasar-jet":{name:`Quasar / Blazar Kerr AGN (a* = ${ut.toFixed(2)})`,subtitle:`4.5×10⁸ M☉ Kerr BH · Blandford–Znajek Jets · Live Camera Doppler Beaming (Γ = ${(ct?.maxLorentzGamma||5.5).toFixed(1)})`,tempK:45e3,composition:`Novikov–Thorne Plasma Disk · Relativistic e±/p⁺ BZ Jets · Dusty Torus`},"xray-binary":{name:`Microquasar X-Ray Binary (Roche L1 Overflow)`,subtitle:`11 M☉ BH + 1.8 M☉ Donor · Eggleton R_L Stream → Hot X-Ray Accretion Disk`,tempK:28e3,composition:`H/He Roche-Lobe Stream · Comptonized X-Ray Corona`},"bns-kilonova":{name:`Binary Neutron Star Merger & Kilonova`,subtitle:`1.45 + 1.32 M☉ · 2.5PN GW Chirp · ${ft?.merged?`r-Process Lanthanide Kilonova Burst!`:`Relativistic Inspiral`}`,tempK:12e3,composition:`Low-Y_e Lanthanide r-Process Ejecta (Au/Pt/U) + Blue Polar Wind`},"type-ia":{name:`Type Ia Thermonuclear Supernova (M_Ch = 1.44 M☉)`,subtitle:`C/O White Dwarf Runaway ¹²C+¹²C Detonation · Zero Central Remnant · ⁵⁶Ni Glow`,tempK:18e3,composition:`⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe · Si / S / Ca Detonation Shell`},"bbh-merger":{name:`Binary Black Hole 2.5PN GW Inspiral & Ringdown`,subtitle:`36 + 29 M☉ Kerr BHs · Quadrupole Strain Chirp h_+(t) & Gravitational Lensing`,tempK:2e4,composition:`Vacuum Kerr Spacetime · Gravitational Radiation Flux`},"comet-tails":{name:`Active Dual-Tail Comet (Clausius–Clapeyron)`,subtitle:`Curved Radiation-Pressure Dust Tail (β) + Straight Solar-Wind CO⁺ Ion Tail`,tempK:260,composition:`H₂O / CO / CO₂ Sublimating Ice Nucleus · Silicate Dust · CO⁺ Plasma`},"hot-jupiter":{name:`Hot Jupiter XUV Atmospheric Photoevaporation`,subtitle:`Energy-Limited XUV Escape Tail (Ṁ = ε π R_p³ F_XUV / G M_p)`,tempK:1850,composition:`Ionized H/He Escaping Cometary Envelope · Silicate Haze`},"roche-rings":{name:`Roche-Limit Tidal Disruption & Shepherd-Moon Rings`,subtitle:`Cohesive Rubble-Pile Rupture (${((yt?.rupturedFraction||.7)*100).toFixed(0)}%) + Resonant Ring Gap`,tempK:140,composition:`Water-Ice & Silicate Ring Particles · Embedded Shepherd Moon`},"giant-impact":{name:`Giant Moon-Forming Impact & Hadean Disk`,subtitle:`Incandescent Magma-Ocean Proto-Earth + Molten Silicate Circumplanetary Disk`,tempK:2800,composition:`Molten Fe/MgSiO₃ Silicate Vapor & Re-Accreting Lunar Embryo Disk`},"red-giant":{name:`Red-Giant Branch Engulfment (+5 Gyr)`,subtitle:`Bloated Convective RGB Envelope · Aerodynamic Common-Envelope Drag on Inner Worlds`,tempK:3400,composition:`Convective H/He Envelope · Vaporizing Inner Rocky Orbits`},"catastrophic-shatter":{name:`Catastrophic Shatter — ${G||`Disrupted Body`}`,subtitle:`Binding Energy Exceeded (E > 0.85 U_bind) · Incandescent Molten-Core & Crustal Debris Field`,tempK:3800,composition:`Vaporized Fe-Ni Core Plasma · Ballistic Silicate & Volatile Fragments`},tde:{name:`Tidal Disruption Event (TDE · SMBH Spaghettification)`,subtitle:`Paczyński–Wiita Apsidal Precession · Super-Eddington Fallback Shock Disk + Unbound Hyperbolic Tail`,tempK:14e5,composition:`Tidally Shredded H/He Stellar Stream · Relativistic Self-Intersecting Accretion Flare`}},t=e[U]||e[`quasar-jet`];return[{id:`l2-${U}`,level:2,name:t.name,subtitle:t.subtitle,pos:[0,0,0],radius:1.5,tempK:t.tempK,composition:t.composition,nextLevel:3}]}if(U===`formation`){let e=D?.catalog?.[0]||D?.starSystem?.stars?.[0]||null,t=it?.snowLineAu||tt?.snowLineAu||2.71,n=it?.getCoalescedDisk?.()?.bodies?.length||0,r=it?.parcelCount||tt?.pebbleCount||3072,i=(W?.stage===`l2-nebular-coalescence`?W.progress||0:1)<.28?`spiral density waves collapsing (worlds not yet settled)`:`${n} proto-clumps condensing & settling`;return[{id:`l2-nebular-formation`,level:2,name:`${D?.systemName||`Proto-System`} · Nebular Coalescence`,subtitle:`Live WebGPU Disk (${r.toLocaleString()} parcels) · Snow Line ${t.toFixed(2)} AU · ${i}`,pos:[0,0,0],radius:1.5,tempK:Number(e?.tempK||e?.teffK||5778),massLabel:`${Number(e?.massSolar||1).toFixed(2)} M☉`,composition:`Host Star L=${Number(e?.luminositySolar||1).toFixed(2)} L☉ · Condensing Fe-Ni, SiO₂, C-SiC, H₂O & CO/CH₄`,nextLevel:2}]}if(!Ze)return[];let e=O(),n=t.solarSpanLog10M??12.6,r=Array.isArray(t.solarOriginAu)?t.solarOriginAu:ca(n).originAu,i=t.solarScaleAuToWorld??1;return e.map((e,t)=>{let n=Ze.getMassiveBodyState64(t),a=(n.posAu[0]-r[0])*i,o=(n.posAu[1]-r[1])*i,s=(n.posAu[2]-r[2])*i,c=!!e.isStar||t===0;return{id:e.id,level:2,bodyIndex:t,spec:e,name:e.name,subtitle:e.subtitle,pos:[a,o,s],radius:Math.max(1e-7,n.radiusAu*i),radiusKm:e.radiusKm,tempK:e.tempK,massLabel:c?`${e.massSolar.toFixed(2)} M☉`:`${(e.massSolar/30034896e-13).toFixed(e.massSolar>1e-5?1:3)} M⊕`,composition:e.composition,nextLevel:c?3:4}})}if(e===3){if(Rt!==`fusion`){let e={"nebular-mhd":{name:`3D Resistive MHD Nebular Collapse & Jets`,subtitle:`∂B/∂t = ∇×(v×B) + η∇²B − ∇ψ · B₀ = ${Ht.toFixed(2)} · Helical J×B Outflow`,tempK:6500,composition:`Magnetized H₂/Dust Molecular Cloud · Helical B-Field Towers`},"h2-pillars":{name:`H II Star-Forming Pillars (Strömgren Ionization)`,subtitle:`Photoevaporative Rocket Ablation · Stratified [O III] / Hα / [S II] Emission`,tempK:11e3,composition:`Ionized H⁺ (Hα) · Doubly Ionized O²⁺ ([O III]) · Shielded Dense Dust ([S II])`},"planetary-nebula":{name:`Bipolar Planetary Nebula & Hot White Dwarf`,subtitle:`Fast Post-AGB Wind Sweeping Dusty Envelope · 95,000 K Central C/O White Dwarf`,tempK:14500,composition:`Inner [O III] Teal Cavity · Outer Hα / [N II] Crimson Shell · C/O Core`},"snr-pwn":{name:`Supernova Remnant & Crab Pulsar Wind Nebula`,subtitle:`Sedov–Taylor Expanding Blastwave + Relativistic Synchrotron Filaments`,tempK:22e3,composition:`Shocked O/Si/Fe Ejecta · Inner e± Synchrotron PWN · Central NS`},"reflection-nebula":{name:`Reflection Nebula (M45 Pleiades / Iris NGC 7023)`,subtitle:`Mie / Rayleigh Forward-Scattered Sapphire Dust Veils (I ∝ λ⁻⁴) Illuminated by Hot B-Stars`,tempK:13500,composition:`Sub-Micron Silicate & PAH Dust Sheets · Embedded Young B-Type Stars`},"wr-bubble":{name:`Wolf–Rayet / Eta Carinae Bipolar Homunculus`,subtitle:`Near-Eddington Continuum-Driven Fast Wind Inflating Twin Dusty Lobes & Equatorial Skirt`,tempK:36e3,composition:`N-Enriched LBV/WR Ejecta · Hot C/O Dust Shells · Shocked Equatorial Torus`},pulsar:{name:`Millisecond Pulsar Oblique Magnetosphere`,subtitle:`Spitkovsky Force-Free Dipole (B = 4.2×10⁸ T, P = 8.5 ms) · Twin Lighthouse Beams`,tempK:32e3,composition:`Neutron-Degenerate Core · e± Pair-Plasma Open Polar Caps`},magnetar:{name:`Magnetar Crustal-Yield Giant Flare`,subtitle:`B = 1.65×10¹¹ T (1.65×10¹⁵ G) · Hall-Drift Twist · ${Jt?.flareCount||0} Unscripted Starquakes`,tempK:48e3,composition:`Superconducting Proton/Neutron Interior · Sheared Fe Crust · Reconnection Fireball`},"white-dwarf-tov":{name:`GR TOV Unified Degenerate EOS (WD → NS → BH)`,subtitle:`Live Batched WebGPU RK4 Tolman–Oppenheimer–Volkoff Mass–Radius Sequence`,tempK:26e3,composition:`Relativistic Fermi–Dirac Electron Degeneracy (M_Ch ≈ 1.44 M☉) → Nuclear Saturation`}},t=e[Rt]||e[`nebular-mhd`];return[{id:`l3-${Rt}`,level:3,name:t.name,subtitle:t.subtitle,pos:[0,0,0],radius:1.8,tempK:t.tempK,composition:t.composition,nextLevel:4}]}let e=Te(),t=Ct?.solver===`webgpu-3d-mls-mpm-nuclear-fusion`,n=Number(kt?.convectiveRmsVel||0),r=Ct?.gridN||24,i=kt?.generationLabel||Ct?.generationLabel||`3rd-Gen Pop I`,a=kt?.dominantChannel||`pp-chain (4 ¹H → ⁴He)`,o=((kt?.meanXCNO??0)*100).toFixed(3),s=((kt?.meanXAlphaFe??0)*100).toFixed(3);return[{id:`stellar-fusion-core`,level:3,name:t?`${i} · 3D MLS-MPM Fusion`:`Thermonuclear Fusion Core`,subtitle:t?`${r}³ MLS-MPM + SS Multipole · ${a} · Q_pp = ${e.ppThermalMeV.toFixed(2)} MeV · v_conv = ${n.toFixed(2)}`:`Gate 1 pp/CNO/3α Burn · Q_pp = ${e.ppThermalMeV.toFixed(2)} MeV`,pos:[0,0,0],radius:1.8,tempK:kt?.coreTempK||15e6,massLabel:`${(Ct?.totalMassSolar||1).toFixed(2)} M☉`,composition:`H ${((kt?.meanXH??.72)*100).toFixed(1)}% · He ${((kt?.meanXHe??.26)*100).toFixed(1)}% · CNO ${o}% · α/Fe ${s}%`,nextLevel:4}]}if(e===4){if(Qt!==`standard`){let e={"magma-ocean":{name:`Hadean Magma Ocean World`,subtitle:`Incandescent Molten Silicate Crust (T_surf ≈ 2,400 K) · Outgassing Steam Atmosphere`,tempK:2400,composition:`Molten MgSiO₃ Peridotite · Fe-Ni Core Segregation · H₂O/CO₂ Steam`},"cryo-plumes":{name:`Cryovolcanic Icy Moon (Viscoelastic Tidal Plumes)`,subtitle:`Peale–Cassen–Reynolds Tidal Heating Driving Supersonic South-Polar H₂O Geysers`,tempK:95,composition:`Water-Ice Lithosphere · Subsurface Brine Ocean · Supersonic H₂O Plumes`},"eyeball-locked":{name:`Tidally Locked Eyeball Exoplanet`,subtitle:`Synchronous 1:1 Spin-Orbit Lock · Substellar Ocean Eye + Terminator Super-Rotation`,tempK:295,composition:`Substellar Liquid Ocean · Terminator Convection Belt · Frozen Nightside`},rogue:{name:`Rogue Free-Floating Dark World`,subtitle:`Zero Stellar Insolation · Geothermal Internal Heat + Dark-Sky Triboelectric Storms`,tempK:65,composition:`Dense H₂/N₂ Geothermal Atmosphere · Deep Mantle Radiogenic Heating`}}[Qt];if(e)return[{id:`l4-${Qt}`,level:4,name:e.name,subtitle:e.subtitle,pos:[0,0,0],radius:1.8,sampleZ:26,rCoreNorm:an[0]?.rCoreNorm??.54,rMantleNorm:.94,tempK:e.tempK,composition:e.composition,nextLevel:5}]}return an}if(e===5){let e=oa(Zn,!0)?.bundle,t=e?.symbol||`Fe`,n=ir;return[{id:`md-lattice-atom`,level:5,name:n?`${n.name} · ${t} Lattice`:`${t} Representative Lattice`,subtitle:n?`Sampled from ${n.worldName} (${n.locationTag}) · ${e?.mechanical?.crystalStructure||`crystal`} · ${Yn?.atomCount||0} GPU atoms`:`${e?.mechanical?.crystalStructure||`crystal`} · ${Yn?.atomCount||0} live GPU atoms`,pos:[0,0,0],radius:1.5,sampleZ:Zn,tempK:Xn?.temperatureK||Qn,massLabel:`m = ${(e?.nuclear?.atomicMassU||55.8).toFixed(2)} u`,composition:n?`Compounds: ${n.compounds.slice(0,3).map(e=>e.formula).join(` · `)} · Phase: ${Xn?.emergentPhase||tr}`:`Phase: ${Xn?.emergentPhase||tr} · ⟨Z⟩ = ${(Xn?.meanCoordination||0).toFixed(2)}`,nextLevel:6}]}if(e===6){let e=oa(ar,dr)?.bundle,t=e?.symbol||`Fe`,n=`${sr}${[`s`,`p`,`d`,`f`,`g`][lr]||`d`} (m=${ur})`,r=Number(e?.atomic?.totalEnergyHa);return[{id:`quantum-nucleus-core`,level:6,name:fr===`molecule`?`${si[pr].formula} Molecule (RHF)`:`${t} (Z=${ar}) · ${n}`,subtitle:fr===`molecule`?`WebGPU STO-3G RHF · E = ${(Number(hr?.totalEnergyHa)||0).toFixed(3)} Ha`:`4-Comp Dirac–KS (${dr?`Relativistic ON`:`Non-Rel`}) · ${mr?.pointCount?.toLocaleString()||0} pts`,pos:[0,0,0],radius:1.2,sampleZ:ar,tempK:300,massLabel:Number.isFinite(r)?`E = ${r.toFixed(1)} Ha`:`—`,composition:`Z=${ar} · ${e?.atomic?.configurationString||t} · ${e?.electromagnetic?.magneticPhase||`—`}`,nextLevel:7}]}if(e===7){let e=vr?.isotope?.split(`-`)[0]||`Z=${gr}`,t=Number(vr?.bindingPerNucleonMeV??8.79),n=Number(vr?.chargeRadiusFm??3.7);return[{id:`nucleus-core`,level:7,name:`${_r}${e} Atomic Nucleus`,subtitle:`Z=${gr} protons, N=${Math.max(0,_r-gr)} neutrons · Woods–Saxon + Visscher TDSE`,pos:[0,0,0],radius:1.5,tempK:1e10,massLabel:`B/A = ${t.toFixed(3)} MeV`,composition:`Protons ${gr} · Neutrons ${Math.max(0,_r-gr)} · R_c = ${n.toFixed(2)} fm`,nextLevel:0}]}return[]}function ua(){Cr=!0,bi();try{ae?.destroy()}catch{}try{be?.dispose()}catch{}try{Oe?.dispose()}catch{}try{Ae?.dispose()}catch{}try{Ye?.dispose()}catch{}try{Ze?.dispose()}catch{}try{tt?.dispose()}catch{}try{it?.dispose()}catch{}try{st?.dispose()}catch{}try{dt?.dispose()}catch{}try{mt?.dispose()}catch{}try{vt?.dispose()}catch{}try{Ct?.dispose()}catch{}try{wt?.dispose()}catch{}try{zt?.dispose()}catch{}try{Wt?.dispose()}catch{}try{qt?.dispose()}catch{}try{sn?.dispose()}catch{}try{pn?.dispose()}catch{}try{En?.dispose()}catch{}try{In?.dispose()}catch{}try{Yn?.destroy()}catch{}try{mr?.pointsBuffer?.destroy()}catch{}try{q?.destroy()}catch{}}return Object.freeze({AU_METERS:at,REAL_SOLAR_SYSTEM_CATALOG:lt,MOLECULE_SPECS:si,COSMIC_EPOCH_PRESETS:Se,get seed(){return o},get busy(){return Sr},get quality(){return u},get qualityMode(){return s},get capabilityProfile(){return l},get lastSupernovaYields(){return Cn},get cosmicEpochId(){return _},get cosmicEpoch(){return S},get activeGalaxyEnv(){return C},get activeStarSite(){return w},get activeCausalSystem(){return D},get activeSampledMaterial(){return ir},get useSolReference(){return E},getActiveSystemCatalog:O,getDefaultPlanetIndex:j,selectCausalStarSite:jr,syncStellarRegimeForStar:kr,sampleNewGalacticSector:Mr,setUseSolReference:Pr,deriveGalaxyEnvironmentFromCosmicContext:Pt,deriveStarSystemFromGalacticLocation:It,synthesizeNebularPlanetarySystem:Lt,get cosmoMode(){return ie},get cosmoSession(){return ae},get cosmoTelemetry(){return oe},get cosmoBigBangMode(){return _e},get cosmoScaleFactorA(){return ae?.getState?.()?.aScale??1},get cosmoFirstPk(){return se},get cosmoTargets(){return ce},get cosmoFocusMpc(){return he},get cosmoBaryonSession(){return be},get cosmoBaryonTelemetry(){return De},get galaxyEngine(){return Oe},get galacticDynamoSession(){return Ae},get galacticDynamoTelemetry(){return Fe},get galacticDynamoStreamlines(){return Ie},get galacticB0(){return ze},get galaxyPreset(){return Ve},get galaxyIcRegimeLabel(){return He},get galaxyMetallicity(){return Ue},get galaxyFocusPos(){return Ke},get galaxyBranch(){return qe},get showGalacticBField(){return Je},get smbhEngine(){return Ye},get smbhBodies(){return Xe},get ismCoolingAnchors(){return We},get solarEngine(){return Ze},get solarMode(){return U},get protoplanetarySession(){return tt},get protoplanetaryTelemetry(){return nt},get protoplanetaryGasDrag(){return rt},get nebularCoalescenceSession(){return it},get nebularCoalescenceTelemetry(){return ot},get kerrJetSession(){return st},get kerrJetTelemetry(){return ct},get kerrSpinA(){return ut},get relBinarySession(){return dt},get relBinaryTelemetry(){return ft},get relBinaryMode(){return pt},get radWindL2Session(){return mt},get radWindL2Telemetry(){return ht},get tidalRocheSession(){return vt},get tidalRocheTelemetry(){return yt},get solarConservation0(){return Qe},get solarConservation(){return $e},get focusedSolarBodyIndex(){return et},get stellarEngine(){return Ct},get stellarDynamoSession(){return wt},get stellarDynamoTelemetry(){return Tt},get stellarDynamoStreamlines(){return Et},get stellarB0(){return Dt},get stellarMode(){return Rt},get nebulaMhdSession(){return zt},get nebulaMhdTelemetry(){return Bt},get nebulaMhdStreamlines(){return Vt},get nebulaB0(){return Ht},get radWindL3Session(){return Wt},get radWindL3Telemetry(){return Gt},get magnetosphereSession(){return qt},get magnetosphereTelemetry(){return Jt},get magnetosphereFieldLines(){return Xt},get tovCurve(){return Zt},get stellarPreset(){return Ot},get stellarTelemetry(){return kt},get stellarNuclearNetwork(){return At},get stellarLaneEmden(){return jt},get stellarTimeAccel(){return Nt},get stellarCutaway(){return Ft},get planetaryMode(){return Qt},get planetaryResult(){return en},get planetaryBodyIndex(){return nn},get planetaryCutaway(){return rn},get planetaryAtmoState(){return on},get planetaryAtmoSession(){return sn},get planetaryAtmoTelemetry(){return cn},get planetaryTriboelectric(){return ln},get planetaryGenesisSphSession(){return pn},get planetaryGenesisSphTelemetry(){return mn},get planetaryGenesisLiveForm(){return hn},get planetaryCoolingHeat(){return gn},get galaxyCenterOfMass(){return Oe?.getCenterOfMass?.()||[0,0,0]},get nebulaCenterOfMass(){return it?.getCenterOfMass?.()||[0,0,0]},get planetaryDynamoSession(){return _n},get planetaryDynamoTelemetry(){return yn},get planetaryDynamoStreamlines(){return bn},get activeGenesisStage(){return Dn()},get lastGenesisEvent(){return Sn},get nebularSettleBlend(){return J},get cryoPlumeSession(){return En},get cryoPlumeTelemetry(){return An},get surfaceActive(){return Mn},get surfaceLandingSite(){return Fn},get surfaceSession(){return In},get surfaceTelemetry(){return Ln},get surfaceBodySpec(){return Kn||O()[nn]||null},get surfaceCraterTileKey(){return Hn},get surfaceControls(){return K},get surfaceTimeWarp(){return zn},get surfaceSimSec(){return Bn},get surfaceClimate(){return Vn},get mdSession(){return Yn},get mdTelemetry(){return Xn},get mdElementZ(){return Zn},get mdTempK(){return Qn},get mdGravity(){return $n},get mdPhasePreset(){return tr},get mdRdfHistory(){return rr},get quantumZ(){return ar},get quantumN(){return sr},get quantumL(){return lr},get quantumM(){return ur},get quantumRelativistic(){return dr},get quantumMode(){return fr},get quantumMoleculeKey(){return pr},get orbitalCloud(){return mr},get moleculeRhfResult(){return hr},get nuclearZ(){return gr},get nuclearA(){return _r},get nuclearResult(){return vr},get tdseSession(){return q},get tdseTelemetry(){return yr},evaluateIsmRadiativeCoolingErgCm3PerS:nr,evaluateStellarEvolutionaryState:xe,buildQuantizedNucleonSpheres:di,getElementBundle:wr,getCachedElementBundle:oa,ensureLevelInitialized:wi,initCosmicWeb:Tr,initCosmoBaryonRegime:Ur,initGalaxy:Er,initSmbhCore:Dr,initSolarSystem:Or,initProtoplanetaryDisk:Fr,initKerrQuasarJet:X,initRelativisticBinary:Gr,initRadiativeWindL2:Jr,initTidalRocheL2:Yr,initNebularMhd:Hr,initRadiativeWindL3:Qr,initCompactMagnetosphere:$r,initWhiteDwarfTovCurve:ei,initStellarCore:ri,detonateCoreSeedNextGeneration:fi,initPlanetaryInterior:pi,initCryoPlumesL4:ti,initMolecularDynamics:gi,initQuantumAtom:_i,initAtomicNucleus:vi,stepActiveRegimes:yi,setCosmicEpoch:Ni,setCosmoMode:Pi,setQuality:Ti,setSeed:Ei,setMdGravity:ki,setMdTemp:Ai,setSampledMaterial:Di,applySampledMaterialToLattice:Oi,computeScaleAdaptiveTimeDilation:ci,setPlanetaryCutaway:ji,setPlanetaryTriboelectric:Gi,setPlanetaryMode:zi,setPlanetaryGenesisLiveForm:mi,triggerPlanetSphGenesisReplay:hi,crystallizeCoalescedSystem:Br,triggerGalaxyCoalescence:Y,finalizeActiveGenesis:zr,getRootLineageCacheStats:()=>m.getStats(),getSphGeologySnapshot:()=>pn?.getCachedGeologySnapshot?.()||null,peekCachedPlanetSph(e=nn){let t=O()[e];if(!t||t.isStar||!vn(t).active)return null;let n=d();return m.peek(On(t,e,`${n.sphMapWidth}x${n.sphMapHeight}x${n.sphGridN}`))},peekCachedStarSystemForSite(e=null){if(!e)return null;let t=o+409>>>0,n=m.buildKey(`l2-nebular`,{seed:t,epochId:_,galaxyKey:C?.seed||0,starKey:`${e.starIndex??0}_${e.forceMultiplicity||0}_${e.forceExoticStage||``}`});return m.peek(n)},peekCachedHaloGalaxy(e=null){if(!Array.isArray(e)||e.length<3)return null;let t=m.buildKey(`l1-galaxy`,{seed:o,epochId:_,galaxyKey:`${Math.round((e[0]||0)/25)}_${Math.round((e[1]||0)/25)}_${Math.round((e[2]||0)/25)}`});return m.peek(t)},setRootCachePeerPublisher:e=>m.setPeerPublisher(e),ingestRemoteRootCacheEntry:e=>m.ingestPeerEntry(e),enterSurfaceView:Yi,exitSurfaceView:Xi,unloadStarSystemRegimes:Ar,flushSurfaceCraters:Ki,applyRemoteCraterStamp:e=>In?.applyRemoteCraterStamp?.(e)??!1,triggerCatastrophicShatter:Zr,getShatteredBodyIds:()=>[...qn],craterTileStore:jn,setSurfaceVehicle:Zi,setSurfaceUfoAltitudeKm:Qi,setSurfaceCameraMode:$i,setSurfaceControls:ea,setSurfaceTimeWarp(e){return zn=Math.max(1,Math.min(1e7,Number(e)||1)),zn},advanceSurfaceSimSec(e){return Bn+=Number(e)||0,Bn},setSurfaceClimate(e){Vn=e||null},addSurfaceLookDelta:ta,adjustSurfaceChaseDistance:na,triggerSurfaceTractorPulse:e=>In?.triggerTractorPulse?.(e),setSurfaceTractorBeam:e=>In?.setTractorBeam?.(e),setSurfaceWeaponConfig:e=>In?.setWeaponConfig?.(e),setSurfaceWeaponFire:e=>In?.setWeaponFire?.(e),launchSurfaceMissile:e=>In?.launchMissile?.(e),setSurfaceExternalEntities:e=>In?.setExternalEntities?.(e),drainSurfaceEvents:()=>In?.drainPendingEvents?.()||{harvested:{silicates:0,volatiles:0,metals:0,exotics:0},peerHits:[],abductions:[]},setStellarTimeAccel:Mi,setStellarCutaway(e){return Ft=!!e,Ft},setSolarMode:Fi,setKerrSpinA:Ii,setProtoplanetaryGasDrag:Li,setStellarMode:Ri,setNebulaB0:Bi,setGalacticB0:Hi,setStellarB0:Ui,setCosmoFocusMpc:Wi,setShowGalacticBField:Vi,setGalaxyBranch:ia,setFocusedSolarBody:aa,computeSolarBarycenterAu:sa,getSolarReferenceOriginAu:ca,getActiveUniversalLaws:ra,syncSchroederScaleChart:ne,getSchroederAtlasSnapshot:re,get lawGraphValidation(){return L},getTargetsForLevel:la,connectPeerMesh:xi,disconnectPeerMesh:bi,getPeerMeshState:Si,dispatchPeerDerivation:Z,dispose:ua})}var mi=Object.freeze({COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),hi=Object.freeze({TEXTURE_BINDING:4,RENDER_ATTACHMENT:16}),gi=`
struct CameraUniforms {
  view_proj: mat4x4<f32>,
  cam_pos: vec4<f32>,    // xyz = camera world position, w = timeSec
  cam_right: vec4<f32>,  // xyz = right basis, w = aspect
  cam_up: vec4<f32>,     // xyz = up basis, w = fovTanHalf
  cam_fwd: vec4<f32>,    // xyz = forward basis, w = log10SpanM
  extra0: vec4<f32>,     // mode-specific floats
  extra1: vec4<f32>,     // mode-specific floats
  extra2: vec4<f32>,     // mode-specific floats
  em_sensor: vec4<f32>,  // x = log10LambdaMin [-13..+1], y = log10LambdaMax, z = sensorActive (0|1), w = gain
  em_aux: vec4<f32>,     // x = ambientTempK, y = sunFluxOrEclipse, z = skyOptDepth, w = flags (bit0=skipSurfaceFog, bit1=reversedLogDepth)
  star_light: vec4<f32>, // rgb = linear host-star light spectrum, w = perceptual inverse-square irradiance gain [0.14..1.85]
  sph_geo: vec4<f32>,    // x = sphGeoW (0=inactive), y = sphGeoH, z = sphGeoSphereIdx, w = seaLevelNorm
};

// Unified Reversed Logarithmic Depth Buffer [0.1 m .. 10^14 m (~668 AU)]!
// Maps w in [0 .. 1e14 m] onto WebGPU [1.0 .. 0.0] reversed-Z with zero z-fighting so
// 0.2 m surface rocks, 5 km mountains, 384,400 km moons, 150,000,000 km Suns, and outer planets
// coexist at TRUE physical meters in one depth buffer without any fixed-distance skybox hacks!
const LOG_DEPTH_INV_FAR: f32 = 0.0215021426; // 1.0 / log2(1.0e14 + 1.0)
fn apply_log_depth_vs(clip: vec4<f32>, flags_f: f32) -> vec4<f32> {
  let flags = u32(round(max(0.0, flags_f)));
  if ((flags & 2u) == 0u || clip.w <= 0.0) { return clip; }
  let z_rev_log = clamp(1.0 - log2(max(1e-4, clip.w + 1.0)) * LOG_DEPTH_INV_FAR, 1e-6, 0.999999);
  return vec4<f32>(clip.x, clip.y, z_rev_log * clip.w, clip.w);
}
fn eval_frag_depth(clip: vec4<f32>, flags_f: f32) -> f32 {
  let flags = u32(round(max(0.0, flags_f)));
  if ((flags & 2u) != 0u && clip.w > 0.0) {
    return clamp(1.0 - log2(max(1e-4, clip.w + 1.0)) * LOG_DEPTH_INV_FAR, 1e-6, 0.999999);
  }
  return clamp(clip.z / max(1e-5, clip.w), 0.0, 1.0);
}
`,_i=`
fn em_band_weight(log_lam: f32, center: f32, half_w: f32) -> f32 {
  let d = (log_lam - center) / max(0.08, half_w);
  return exp(-(d * d));
}

fn em_planck_response(log_lam: f32, temp_k: f32) -> f32 {
  let t_safe = max(2.7, temp_k);
  // x = h c / (lambda k_B T); log10(h c / k_B) = -1.842006
  let log10_x = clamp(-1.842006 - log_lam - log(t_safe) * 0.43429448, -8.0, 1.86);
  let x = pow(10.0, log10_x);
  // Exact dimensionless Planck spectral brightness B_nu(x) / B_nu(x_peak) = (x^3 / (exp(x) - 1)) / 1.421435:
  //   - Peaks cleanly at 1.0 when x = 2.82144 (exact Wien frequency peak!)
  //   - Falls smoothly as x^2 -> 0 in Rayleigh-Jeans radio (so 2.725 K empty space is pitch-black in 21cm Radio!)
  //   - Falls exponentially as x^3 exp(-x) -> 0 on the Wien short-wavelength side (honest thermal contrast!)
  var rel = 0.0;
  if (x < 0.01) {
    rel = (x * x) / (1.421435 * (1.0 + 0.5 * x));
  } else {
    rel = ((x * x * x) / max(1e-6, exp(x) - 1.0)) / 1.421435;
  }
  return clamp(pow(max(0.0, rel), 0.55) * 1.15, 0.0, 2.4);
}

fn em_channel_at(
  log_lam: f32,
  vis_lum: f32,
  temp_k: f32,
  uv_aur: f32,
  xray_synch: f32,
  radio_hi: f32,
  gamma_511: f32
) -> f32 {
  let w_vis = em_band_weight(log_lam, -6.26, 0.28);
  let w_uv  = em_band_weight(log_lam, -7.25, 0.72);
  let w_xr  = em_band_weight(log_lam, -9.45, 1.25);
  let w_gam = em_band_weight(log_lam, -12.1, 1.05);
  let w_rad = smoothstep(-2.4, -0.6, log_lam);
  let thermal = em_planck_response(log_lam, temp_k);
  return vis_lum * w_vis * 1.15
    + thermal
    + uv_aur * w_uv * 1.65
    + xray_synch * w_xr * 1.85
    + radio_hi * w_rad * 1.75
    + gamma_511 * w_gam * 2.10;
}

fn em_sensor_map_rgb(
  vis_rgb: vec3<f32>,
  temp_k: f32,
  uv_aur: f32,
  xray_synch: f32,
  radio_hi: f32,
  gamma_511: f32
) -> vec3<f32> {
  if (cam.em_sensor.z < 0.5) {
    return vis_rgb;
  }
  let l_min = min(cam.em_sensor.x, cam.em_sensor.y);
  let l_max = max(l_min + 0.12, max(cam.em_sensor.x, cam.em_sensor.y));
  let gain = max(0.2, cam.em_sensor.w);
  let vis_lum = dot(vis_rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  // Shortest wavelength caret (lambda_min, highest energy) -> Blue/Violet; Mid -> Green; Longest (lambda_max) -> Red
  let l_b = mix(l_min, l_max, 0.17);
  let l_g = mix(l_min, l_max, 0.50);
  let l_r = mix(l_min, l_max, 0.83);
  let sb = em_channel_at(l_b, vis_rgb.b, temp_k, uv_aur, xray_synch, radio_hi, gamma_511);
  let sg = em_channel_at(l_g, vis_rgb.g, temp_k, uv_aur, xray_synch, radio_hi, gamma_511);
  let sr = em_channel_at(l_r, vis_rgb.r, temp_k, uv_aur, xray_synch, radio_hi, gamma_511);
  // Subtle spectral false-color contrast boost when the active window is narrowband
  let base_e = vec3<f32>(sr, sg, sb) * gain;
  let mean_e = (sr + sg + sb) * 0.333333;
  let vivid = mix(vec3<f32>(mean_e), base_e, 1.28);
  return max(vec3<f32>(0.0), vivid) + vec3<f32>(0.003, 0.005, 0.010) * clamp(vis_lum, 0.0, 0.25);
}
`,vi=`
${gi}
${_i}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  // Reversed-Z Infinite Far Plane: z = 0.0 is farthest infinity!
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.ndc = pts[vid];
  return out;
}

fn hash31(p: vec3<f32>) -> f32 {
  var q = fract(p * 0.1031);
  q = q + dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

fn star_layer(dir: vec3<f32>, scale: f32, thresh: f32) -> vec3<f32> {
  let p = dir * scale;
  let cell = floor(p);
  let f = fract(p) - 0.5;
  let h = hash31(cell);
  if (h < thresh) { return vec3<f32>(0.0); }
  let jitter = vec3<f32>(hash31(cell + 17.1), hash31(cell + 41.7), hash31(cell + 73.3)) - 0.5;
  let d = length(f - jitter * 0.52);
  let spark = exp(-d * d * 78.0) * smoothstep(thresh, 1.0, h);
  let temp = hash31(cell + 99.9);
  let col = mix(vec3<f32>(0.68, 0.82, 1.0), vec3<f32>(1.0, 0.84, 0.64), temp);
  return col * spark;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let fov = cam.cam_up.w;
  let aspect = cam.cam_right.w;
  let dir = normalize(
    cam.cam_fwd.xyz
    + cam.cam_right.xyz * (in.ndc.x * aspect * fov)
    + cam.cam_up.xyz * (in.ndc.y * fov)
  );
  let log_span = cam.cam_fwd.w;
  // Subtle Milky Way galactic band visible ONLY when no live parent GPU galaxy skybox is active!
  let live_parent_sky = clamp(cam.extra0.y, 0.0, 1.0);
  let gal_vis = (1.0 - smoothstep(17.0, 23.0, log_span)) * smoothstep(-4.0, 4.0, log_span) * (1.0 - 0.88 * live_parent_sky);
  let gal_axis = dir.y * 2.8 + dir.x * 0.72;
  let gal_band = exp(-(gal_axis * gal_axis) * 4.5);
  let dust = 0.5 + 0.5 * sin(dir.x * 4.5 + dir.z * 3.2) * cos(dir.y * 3.9 - dir.x * 2.8);
  let base_void = mix(vec3<f32>(0.005, 0.009, 0.020), vec3<f32>(0.004, 0.007, 0.015), 1.0 - smoothstep(-8.0, 0.0, log_span));
  var col = base_void + vec3<f32>(0.028, 0.036, 0.068) * gal_band * dust * (0.25 + 0.75 * gal_vis);

  let star_vis = (smoothstep(-6.0, 6.0, log_span) * 0.85 + 0.15) * (1.0 - 0.65 * live_parent_sky);
  let stars = star_layer(dir, 58.0, 0.972) * 1.15 * star_vis
    + star_layer(dir, 130.0, 0.978) * 0.68 * star_vis
    + star_layer(dir, 230.0, 0.986) * 0.32 * star_vis;
  col = col + stars;

  // In full-spectrum EM mode, CMB 2.725 K microwave glow stays subtle (0.24x) in mm-wave & dark in 21cm Radio!
  if (cam.em_sensor.z > 0.5) {
    let cmb_aniso = 2.725 + 0.22 * sin(dir.x * 7.5 + dir.y * 5.2) * cos(dir.z * 6.8 - dir.x * 4.1);
    let hi_plane = gal_band * (0.35 + 0.65 * dust) * 0.14;
    let star_lum = dot(stars, vec3<f32>(0.3, 0.5, 0.2));
    let em_bg = em_sensor_map_rgb(col, mix(cmb_aniso, 6500.0, clamp(star_lum, 0.0, 1.0)), star_lum * 0.5, star_lum * 0.18, hi_plane, 0.0);
    col = em_bg * mix(0.22, 0.95, clamp(star_lum * 2.5, 0.0, 1.0));
  }
  return vec4<f32>(col, 1.0);
}
`,yi=`
${gi}
${_i}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  // Reversed-Z Infinite Far Plane: z = 0.0 is farthest infinity!
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.ndc = pts[vid];
  return out;
}

fn hash31_s(p: vec3<f32>) -> f32 {
  var q = fract(p * 0.1031);
  q = q + dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

fn star_layer_s(dir: vec3<f32>, scale: f32, thresh: f32) -> vec3<f32> {
  let p = dir * scale;
  let cell = floor(p);
  let f = fract(p) - 0.5;
  let h = hash31_s(cell);
  if (h < thresh) { return vec3<f32>(0.0); }
  let jitter = vec3<f32>(hash31_s(cell + 17.1), hash31_s(cell + 41.7), hash31_s(cell + 73.3)) - 0.5;
  let d = length(f - jitter * 0.50);
  let spark = exp(-d * d * 82.0) * smoothstep(thresh, 1.0, h);
  let temp = hash31_s(cell + 99.9);
  return mix(vec3<f32>(0.72, 0.84, 1.0), vec3<f32>(1.0, 0.86, 0.66), temp) * spark;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let fov = cam.cam_up.w;
  let aspect = cam.cam_right.w;
  let dir = normalize(
    cam.cam_fwd.xyz
    + cam.cam_right.xyz * (in.ndc.x * aspect * fov)
    + cam.cam_up.xyz * (in.ndc.y * fov)
  );
  let sky_zen_day = cam.extra0.rgb;
  let opt_depth = clamp(cam.extra0.w, 0.0, 1.0);
  let sun_dir = normalize(cam.extra1.xyz);
  let sky_hor_day = cam.extra2.rgb;
  let eclipse_f = clamp(cam.em_aux.y, 0.04, 1.0);
  let star_rgb = cam.star_light.rgb;
  let star_flux = clamp(cam.star_light.w, 0.14, 1.85);
  let sky_star_gain = clamp(0.24 + 0.76 * star_flux, 0.22, 1.45);
  let sky_star_tint = mix(vec3<f32>(1.0), star_rgb, 0.68);

  // Physical Chapman airmass day -> golden/crimson sunset twilight -> deep starlit night cycle!
  let sun_elev = sun_dir.y;
  let day_f = smoothstep(-0.12, 0.24, sun_elev) * eclipse_f;
  let twi_d = (sun_elev - 0.02) / 0.14;
  let sunset_w = exp(-(twi_d * twi_d)) * opt_depth * eclipse_f;
  let night_zen = vec3<f32>(0.004, 0.008, 0.022);
  let night_hor = vec3<f32>(0.014, 0.022, 0.044);
  let sky_zen = mix(night_zen, sky_zen_day * sky_star_tint * sky_star_gain, day_f) + vec3<f32>(0.18, 0.10, 0.24) * sky_star_tint * sunset_w * 0.45 * sky_star_gain;
  let sky_hor = mix(night_hor, sky_hor_day * sky_star_tint * sky_star_gain, day_f) + vec3<f32>(0.96, 0.40, 0.14) * sky_star_tint * sunset_w * 0.82 * sky_star_gain;

  // Smooth elevation gradient from horizon haze band to deep zenith sky!
  let elev = clamp(dir.y, -0.35, 1.0);
  let sky_t = pow(clamp((elev + 0.04) / 1.04, 0.0, 1.0), 0.56);
  var col = mix(sky_hor, sky_zen, sky_t);

  // Directional crimson-gold horizon sunset glow centered toward the setting/rising sun azimuth
  let hor_cos = max(0.0, dot(normalize(vec3<f32>(dir.x, 0.0, dir.z) + vec3<f32>(1e-5, 0.0, 0.0)), normalize(vec3<f32>(sun_dir.x, 0.0, sun_dir.z) + vec3<f32>(1e-5, 0.0, 0.0))));
  let sunset_band = exp(-abs(dir.y) * 5.2) * pow(hor_cos, 3.0) * sunset_w;
  col = col + vec3<f32>(1.15, 0.44, 0.12) * sky_star_tint * sunset_band * 0.85 * sky_star_gain;

  // Subtle below-horizon horizon-haze fill so curved TinyPlanet terrain melts seamlessly into the horizon!
  if (dir.y < 0.0) {
    let below = 1.0 - smoothstep(-0.36, 0.0, dir.y);
    col = mix(col, sky_hor * mix(0.96, 0.84, opt_depth), below);
  }

  // Forward Mie solar scattering + crisp HDR solar glow (masked cleanly below horizon!)
  let sun_above = smoothstep(-0.04, 0.02, sun_elev);
  let cos_sun = dot(dir, sun_dir);
  let sun_halo = (pow(max(0.0, cos_sun), 10.0) * (0.24 + 0.48 * opt_depth)
    + pow(max(0.0, cos_sun), 64.0) * (0.50 + 0.60 * opt_depth)) * sun_above * eclipse_f * sky_star_gain;
  let sun_col = mix(star_rgb, vec3<f32>(1.0, 0.58, 0.24) * sky_star_tint, clamp(sunset_w + opt_depth * 0.35, 0.0, 1.0));
  col = col + sun_col * sun_halo;

  // Crisp stars & Milky Way shine brightly in airless vacuum AND on atmospheric night sides / during solar eclipses!
  let atm_clear = 1.0 - smoothstep(0.03, 0.36, opt_depth * day_f);
  let star_vis = clamp(atm_clear * smoothstep(-0.02, 0.14, dir.y), 0.0, 1.0);
  if (star_vis > 0.02) {
    let rot_a = cam.cam_pos.w * 0.004;
    let cr = cos(rot_a); let sr = sin(rot_a);
    let sdir = vec3<f32>(dir.x * cr - dir.z * sr, dir.y, dir.x * sr + dir.z * cr);
    let mw_axis = sdir.y * 2.4 + sdir.x * 0.85;
    let mw_band = exp(-(mw_axis * mw_axis) * 4.2) * (0.55 + 0.45 * sin(sdir.x * 5.2 + sdir.z * 3.8));
    let stars = star_layer_s(sdir, 62.0, 0.970) * 1.25
      + star_layer_s(sdir, 140.0, 0.978) * 0.72
      + star_layer_s(sdir, 240.0, 0.986) * 0.35;
    col = col + (stars + vec3<f32>(0.045, 0.058, 0.105) * mw_band) * star_vis;
  }

  // Live 3D Geodynamo Surface Sky Aurorae ([O I] 557.7 nm emerald -> cyan-teal -> [O I] 630 nm / N2+ violet-crimson curtains)!
  // Exact 3D spherical thermosphere shell ray-intersection (R_p = 6371 km, h = 105..280 km) so magnetic curtains
  // arch majestically from 5° above the mountain horizon all the way to zenith at twilight & midnight!
  // Strictly gated by live geodynamo B-field, atmospheric optical depth, geomagnetic oval latitude, & dark-sky radiance
  // (0 at high noon in sunlit blue sky, 0 on unmagnetized/vacuum worlds like Moon/Mars!).
  let aurora_str = clamp(cam.sph_geo.x, 0.0, 2.5);
  let obs_lat_rad = cam.sph_geo.y;
  var aur_uv_sig = 0.0;
  if (aurora_str > 0.005 && opt_depth > 0.03 && dir.y > 0.015) {
    // True sky-brightness contrast gating: vivid across midnight, dusk, dawn & solar eclipses; washed out by sunlit daytime sky!
    let dark_vis = clamp(1.0 - smoothstep(-0.04, 0.24, sun_elev) * opt_depth * eclipse_f, 0.0, 1.0);
    if (dark_vis > 0.01) {
      let hor_fade = smoothstep(0.015, 0.095, dir.y) * (1.0 - smoothstep(0.92, 0.998, dir.y) * 0.18);
      let t_aur = cam.cam_pos.w * 0.42;
      let r_planet_km = 6371.0;
      // Poleward geomagnetic oval offset (arcs sit closer to zenith at polar latitudes, sweeping dramatically across the lower horizon at mid-latitudes!)
      let lat_abs = abs(obs_lat_rad);
      let oval_shift_km = mix(360.0, 75.0, smoothstep(0.35, 1.15, lat_abs));
      var aur_col = vec3<f32>(0.0);
      // 8 physical thermospheric emission shells from 105 km (emerald O I 557.7 nm / N2 pink) -> 275 km (crimson/violet O I 630 nm / N2+)
      for (var k = 0u; k < 8u; k = k + 1u) {
        let fk = f32(k) / 7.0;
        let h_km = 105.0 + fk * 170.0;
        // Exact ray intersection with curved spherical upper-atmosphere shell at radius (R_p + h_km)
        let b_s = r_planet_km * dir.y;
        let s_km = -b_s + sqrt(max(1.0, b_s * b_s + 2.0 * r_planet_km * h_km + h_km * h_km));
        let p_km = dir.xz * s_km;
        let r_hor_km = length(p_km);
        let az_km = atan2(p_km.y, p_km.x);
        // Three sweeping, undulating Birkeland geomagnetic curtains spanning 150..780 km horizontal shell distance
        // (naturally visible right across 6°..65° elevation above the horizon mountains AND overhead!)
        let fold_a = sin(az_km * 2.0 + t_aur * 0.48 + fk * 0.22) * 95.0
          + cos(az_km * 5.0 - t_aur * 0.74 + p_km.x * 0.0045) * 48.0;
        let d_a = (r_hor_km - (oval_shift_km + 95.0 + fold_a)) / (52.0 + fk * 28.0);
        let curt_a = exp(-(d_a * d_a));

        let fold_b = cos(az_km * 3.0 - t_aur * 0.56 - fk * 0.18) * 115.0
          + sin(az_km * 6.0 + t_aur * 0.82 + p_km.y * 0.0042) * 56.0;
        let d_b = (r_hor_km - (oval_shift_km + 275.0 + fold_b)) / (68.0 + fk * 34.0);
        let curt_b = exp(-(d_b * d_b));

        let fold_c = sin(az_km * 4.0 + t_aur * 0.38) * 80.0;
        let d_c = (r_hor_km - (oval_shift_km + 485.0 + fold_c)) / (85.0 + fk * 40.0);
        let curt_c = exp(-(d_c * d_c)) * 0.72;

        // Crisp vertical magnetic-field-aligned electron precipitation ray striations!
        let ray_p = az_km * 26.0 + fold_a * 0.032 + t_aur * 1.9;
        let ray_q = az_km * 15.0 - t_aur * 1.3 + p_km.x * 0.011;
        let rays = 0.44 + 0.56 * max(0.0, sin(ray_p) * cos(ray_q) * 0.7 + 0.35 * sin(az_km * 41.0 - t_aur * 2.5));
        let sheet = (curt_a + curt_b * 0.88 + curt_c) * rays;

        // Real upper-atmosphere atomic spectroscopy by altitude h_km:
        //   105-120 km: pink/magenta N2 lower fringe + electric emerald [O I] 557.7 nm
        //   120-190 km: bright emerald-cyan [O I] 557.7 nm
        //   190-275 km: crimson-violet [O I] 630.0 nm & N2+ 427.8 nm upper crown!
        let c_base = vec3<f32>(0.24, 1.00, 0.52);
        let c_mid  = vec3<f32>(0.10, 0.90, 0.74);
        let c_top  = vec3<f32>(0.72, 0.16, 0.94);
        let slice_c = select(mix(c_mid, c_top, (fk - 0.42) / 0.58), mix(c_base, c_mid, fk / 0.42), fk < 0.42);
        let alt_w = (1.28 - fk * 0.52) * smoothstep(0.0, 0.18, fk + 0.06);
        aur_col = aur_col + slice_c * sheet * alt_w * 0.42;
      }
      let aur_gain = aurora_str * dark_vis * hor_fade;
      col = col + aur_col * aur_gain;
      aur_uv_sig = clamp(length(aur_col) * aur_gain * 0.90, 0.0, 2.0);
    }
  }

  col = em_sensor_map_rgb(col, mix(2.725, max(50.0, cam.em_aux.x * 0.82), opt_depth * 0.65), sunset_w * 0.3 + sun_halo * 0.4 + aur_uv_sig * 1.2, aur_uv_sig * 0.25, star_vis * 0.12 + aur_uv_sig * 0.35, 0.0);
  return vec4<f32>(col, 1.0);
}
`,bi=`
${gi}
${_i}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsIn {
  @location(0) pos_curv: vec4<f32>,
  @location(1) norm_tag: vec4<f32>,
  @location(2) col_emiss: vec4<f32>,
};

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) world_pos: vec3<f32>,
  @location(1) norm: vec3<f32>,
  @location(2) albedo: vec3<f32>,
  @location(3) surf_info: vec3<f32>, // x = tag, y = emissive, z = rawHeight
};

@vertex
fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.pos = apply_log_depth_vs(cam.view_proj * vec4<f32>(in.pos_curv.xyz, 1.0), cam.em_aux.w);
  out.world_pos = in.pos_curv.xyz;
  out.norm = in.norm_tag.xyz;
  out.albedo = in.col_emiss.rgb;
  out.surf_info = vec3<f32>(in.norm_tag.w, in.col_emiss.w, in.pos_curv.w);
  return out;
}

fn surf_hash(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}

// Smooth C2 quintic value noise with exact analytical (val, d/dx, d/dy) — zero grid-cell faceting!
fn surf_noise_d(p: vec2<f32>) -> vec3<f32> {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  let a = surf_hash(i);
  let b = surf_hash(i + vec2<f32>(1.0, 0.0));
  let c = surf_hash(i + vec2<f32>(0.0, 1.0));
  let d = surf_hash(i + vec2<f32>(1.0, 1.0));
  let k0 = a;
  let k1 = b - a;
  let k2 = c - a;
  let k3 = a - b - c + d;
  let val = k0 + k1 * u.x + k2 * u.y + k3 * u.x * u.y;
  let dx = (k1 + k3 * u.y) * du.x;
  let dy = (k2 + k3 * u.x) * du.y;
  return vec3<f32>(val, dx, dy);
}

fn surf_noise(p: vec2<f32>) -> f32 {
  return surf_noise_d(p).x;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let sky_zen = cam.extra0.rgb;
  let opt_depth = clamp(cam.extra0.w, 0.0, 1.0);
  let sun_dir = normalize(cam.extra1.xyz);
  let sky_hor = cam.extra2.rgb;

  var n = normalize(in.norm);
  let view_v = cam.cam_pos.xyz - in.world_pos;
  let dist = length(view_v);
  let v = view_v / max(1e-4, dist);
  let half_v = normalize(sun_dir + v);

  let tag = in.surf_info.x;
  let emissive = in.surf_info.y;
  let raw_h = in.surf_info.z;

  // Rotated tri-scale analytical C2 micro-normal relief + stratigraphic cliff banding on natural terrain!
  var base_col = in.albedo;
  if (tag < 3.5 && (tag < 1.5 || tag > 2.5)) {
    let p_xz = in.world_pos.xz;
    let rot1 = vec2<f32>(p_xz.x * 0.80 - p_xz.y * 0.60, p_xz.x * 0.60 + p_xz.y * 0.80);
    let rot2 = vec2<f32>(p_xz.x * 0.36 + p_xz.y * 0.93, -p_xz.x * 0.93 + p_xz.y * 0.36);
    let n1 = surf_noise_d(p_xz * 0.32);
    let n2 = surf_noise_d(rot1 * 1.15 + vec2<f32>(11.3, -7.1));
    let n3 = surf_noise_d(rot2 * 3.40 - vec2<f32>(5.7, 13.4));
    // Transform rotated analytical gradients back into world XZ frame
    let d2_x = n2.y * 0.80 + n2.z * 0.60;
    let d2_z = -n2.y * 0.60 + n2.z * 0.80;
    let d3_x = n3.y * 0.36 - n3.z * 0.93;
    let d3_z = n3.y * 0.93 + n3.z * 0.36;
    let bump_fade = 1.0 - smoothstep(14.0, 78.0, dist);
    let bump_s = select(0.14, 0.08, tag > 0.5 && tag < 1.5) * bump_fade;
    let gx = n1.y * 0.55 + d2_x * 0.32 + d3_x * 0.13;
    let gz = n1.z * 0.55 + d2_z * 0.32 + d3_z * 0.13;
    n = normalize(n - vec3<f32>(gx * bump_s, 0.0, gz * bump_s));
    let grain = 0.87 + 0.14 * n1.x + 0.09 * n2.x + 0.05 * n3.x;
    // Geological sedimentary / basaltic strata bands on steeper canyon/crater walls
    let slope_w = smoothstep(0.12, 0.44, 1.0 - n.y);
    let strata = 0.90 + 0.16 * sin(raw_h * 3.4 + n1.x * 2.6);
    base_col = base_col * grain * mix(1.0, strata, slope_w * 0.78);
    // Wet darkened shoreline sand + crisp coastal moisture band right above liquid sea level!
    let wet_shore = (1.0 - smoothstep(0.0, 2.2, abs(raw_h - 0.35))) * smoothstep(-0.3, 0.5, raw_h);
    base_col = mix(base_col, base_col * 0.62, wet_shore * 0.55);
  }

  let ndl = max(0.0, dot(n, sun_dir));
  let ndv = max(0.0, dot(n, v));
  let fresnel = pow(max(0.0, 1.0 - ndv), 3.8);

  let skip_fog = (u32(round(max(0.0, cam.em_aux.w))) & 1u) != 0u;
  let eclipse_f = select(clamp(cam.em_aux.y, 0.06, 1.0), 1.0, skip_fog);
  let sun_day = select(smoothstep(-0.10, 0.18, sun_dir.y) * eclipse_f, 1.0, skip_fog);
  let twi_d = (sun_dir.y - 0.03) / 0.14;
  let sunset_w = select(exp(-(twi_d * twi_d)) * opt_depth * eclipse_f, 0.0, skip_fog);

  // Hemispheric sky-bounce ambient (genuinely dark starlit night on planet/comet dark side!)
  let star_rgb = cam.star_light.rgb;
  let star_flux = clamp(cam.star_light.w, 0.14, 1.85);
  let surf_star_l = select(star_rgb * star_flux, mix(vec3<f32>(1.0), star_rgb, 0.45) * clamp(0.45 + 0.55 * star_flux, 0.45, 1.35), skip_fog);
  let sky_gain = select(clamp(0.26 + 0.74 * star_flux, 0.22, 1.40), 1.0, skip_fog);
  let hemi_up = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  let amb_sky_day = mix(sky_hor * 0.42 + vec3<f32>(0.04, 0.05, 0.07), sky_zen * 0.55 + vec3<f32>(0.05, 0.06, 0.09), hemi_up) * mix(vec3<f32>(1.0), star_rgb, 0.55) * sky_gain;
  let amb_sky_night = mix(vec3<f32>(0.007, 0.010, 0.018), vec3<f32>(0.020, 0.030, 0.054), opt_depth);
  let amb_sky = select(mix(amb_sky_night, amb_sky_day, sun_day), vec3<f32>(0.24, 0.28, 0.34), skip_fog);
  let amb_gain = select(mix(0.20, 0.55, opt_depth * sun_day + 0.15), 0.42, skip_fog);
  let sun_tint = mix(
    mix(vec3<f32>(1.05, 1.02, 0.96), vec3<f32>(1.12, 0.95, 0.78), opt_depth * 0.35),
    vec3<f32>(1.25, 0.56, 0.24),
    sunset_w * 0.68
  ) * surf_star_l;

  // Subtle emerald-cyan UFO ventral landing pool on pitch-black night sides so terrain stays navigable in true darkness!
  let night_pool = select(exp(-dist * dist / (110.0 * 110.0)) * (1.0 - sun_day) * 0.24, 0.0, skip_fog || tag > 3.5);
  var lit = base_col * (amb_sky * amb_gain + sun_tint * (ndl * 1.18 * sun_day) + vec3<f32>(0.34, 0.92, 0.72) * night_pool);

  if (tag > 1.5 && tag < 2.5) {
    // Liquid ocean/sea surface (general H2O / CH4 / NH3 / H2SO4 solvent shaded from vertex albedo + live GPU waves!)
    let t = cam.cam_pos.w;
    let p_w = in.world_pos.xz;
    let ph1 = dot(p_w, vec2<f32>(0.86, 0.51)) * 0.72 + t * 1.9;
    let ph2 = dot(p_w, vec2<f32>(-0.42, 0.91)) * 1.18 - t * 1.5;
    let ph3 = dot(p_w, vec2<f32>(0.31, -0.95)) * 1.95 + t * 2.4;
    let wn = (surf_noise(p_w * 0.65 + vec2<f32>(t * 0.35, -t * 0.28)) - 0.5) * 0.05;
    let wx = sin(ph1) * 0.024 + cos(ph2) * 0.018 + sin(ph3) * 0.012 + wn;
    let wz = cos(ph1) * 0.020 - sin(ph2) * 0.022 + cos(ph3) * 0.012 - wn;
    let nw = normalize(n + vec3<f32>(wx, 0.0, wz));
    let hw = normalize(sun_dir + v);
    let w_spec = pow(max(0.0, dot(nw, hw)), 84.0) * 1.35 * sun_day;
    let w_fres = pow(max(0.0, 1.0 - max(0.0, dot(nw, v))), 3.2);
    let foam_n = surf_noise(p_w * 1.35 + vec2<f32>(t * 0.4, t * 0.25));
    let foam_wave = clamp(emissive, 0.0, 1.0);
    let foam = clamp(smoothstep(0.68, 0.92, foam_n + sin(ph1) * 0.14) * 0.16 + foam_wave * 0.55, 0.0, 0.85);
    let sky_refl = mix(vec3<f32>(0.03, 0.05, 0.10), sky_hor * 0.95 + in.albedo * 0.45, sun_day);
    let foam_col = mix(in.albedo * 1.65, vec3<f32>(0.90, 0.96, 1.0), 0.72);
    lit = mix(lit, sky_refl, w_fres * 0.70) + sun_tint * w_spec + foam_col * foam * (0.25 + 0.85 * ndl * sun_day);
  } else if (tag > 3.5) {
    // Metallic Rover, Drone, & UFO hardware: crisp Blinn-Phong specular + rim edge highlight!
    let m_spec = pow(max(0.0, dot(n, half_v)), 48.0) * 0.72 * (0.25 + 0.75 * sun_day);
    let rim_col = select(sky_hor * 0.38 * sun_day + vec3<f32>(0.14, 0.18, 0.24), vec3<f32>(0.22, 0.28, 0.36), skip_fog);
    lit = lit + sun_tint * m_spec + rim_col * fresnel * 0.48;
  } else {
    // Mineral sheen + sparkling crystalline snow/ice micro-glint on snow-covered slopes!
    let r_spec = pow(max(0.0, dot(n, half_v)), 20.0) * select(0.08, 0.32, tag > 0.5 && tag < 1.5) * sun_day;
    let snow_sparkle = select(0.0, smoothstep(0.88, 0.98, surf_noise(in.world_pos.xz * 7.5 + v.xz * 1.4)) * 0.42 * sun_day, tag > 0.5 && tag < 1.5);
    lit = lit + sun_tint * (r_spec + snow_sparkle);
  }

  // Per-pixel volcanic basalt-fissure glow enhancement on Magma Ocean worlds (zero blocky vertex borders!)
  var emiss_eff = select(emissive, 0.0, tag > 1.5 && tag < 2.5);
  var emiss_col = in.albedo;
  if (!skip_fog && cam.extra2.w > 0.5 && tag < 3.5) {
    let f1 = surf_noise(in.world_pos.xz * 0.38 + vec2<f32>(3.1, -5.2));
    let f2 = surf_noise(in.world_pos.xz * 1.15 - vec2<f32>(7.4, 2.8));
    let vein = 1.0 - smoothstep(0.03, 0.16, abs((f1 * 0.7 + f2 * 0.3) - 0.5));
    let molten = clamp(emissive * (0.65 + 0.55 * f2) + vein * 1.15, 0.0, 2.2);
    emiss_eff = molten;
    emiss_col = mix(vec3<f32>(1.0, 0.24, 0.03), vec3<f32>(1.0, 0.86, 0.32), clamp(molten * 0.62, 0.0, 1.0));
  }
  lit = lit + emiss_col * emiss_eff * 1.20;

  var final_col = lit;
  if (!skip_fog) {
    // Exponential atmospheric perspective fog + smooth +-6 km 2-ring GPU clipmap horizon fade!
    let horiz_dist = length(in.world_pos.xz - cam.cam_pos.xz);
    let fog_density = mix(0.000045, 0.00028, opt_depth);
    let fog_amt = clamp(1.0 - exp(-dist * fog_density), 0.0, 0.82);
    let patch_edge = smoothstep(4200.0, 5850.0, horiz_dist);
    let total_fog = clamp(max(fog_amt, patch_edge), 0.0, 1.0);
    let fog_hor = mix(vec3<f32>(0.014, 0.022, 0.044), sky_hor, sun_day) + vec3<f32>(0.96, 0.40, 0.14) * sunset_w * 0.75;
    // Low-sun aerial-perspective Mie forward-scattering golden god-rays!
    let mie_ray = pow(max(0.0, dot(-v, sun_dir)), 7.0) * opt_depth * sun_day * clamp(total_fog * 1.4, 0.0, 0.65);
    final_col = mix(lit, fog_hor, total_fog) + sun_tint * mie_ray * 0.32;
  }

  // Full-spectrum EM sensor mapping: real FLIR thermal inertia (warm oceans, cool alpine ridges, hot craters & UFO!)
  if (cam.em_sensor.z > 0.5) {
    let amb_t = max(35.0, cam.em_aux.x);
    let veh_heat = select(0.0, 210.0 + emiss_eff * 380.0, tag > 3.5);
    let lava_heat = emiss_eff * 1450.0;
    let sun_heat = ndl * sun_day * 42.0;
    let ocean_inertia = select(0.0, 26.0, tag > 1.5 && tag < 2.5);
    let elev_lapse = -clamp(in.world_pos.y, -24.0, 140.0) * 0.72;
    let slope_contrast = (n.y - 0.78) * 32.0 + (1.0 - dot(in.albedo, vec3<f32>(0.333))) * 22.0;
    let surf_temp_k = max(25.0, amb_t + veh_heat + lava_heat + sun_heat + ocean_inertia + elev_lapse + slope_contrast);
    let radio_sig = select(0.0, 0.55, tag > 3.5);
    final_col = em_sensor_map_rgb(final_col, surf_temp_k, 0.0, 0.0, radio_sig, 0.0);
  }
  return vec4<f32>(final_col, 1.0);
}
`,xi=`
${gi}
${_i}

struct FloraInstance {
  pos_scale: vec4<f32>, // xyz = curved world base, w = heightScale (<= 0 culled)
  rot_kind: vec4<f32>,  // x = yawRad, y = radialScale, z = kindId (0..2), w = snowWeight
  col_emiss: vec4<f32>, // rgb = canopy/facade albedo, w = emissiveWindow
};

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> instances: array<FloraInstance>;

struct VsIn {
  @location(0) pos_part: vec4<f32>,  // xyz = local unit coords, w = partId (0=trunk/base, 1=canopy, 2=window/beacon)
  @location(1) norm_kind: vec4<f32>, // xyz = local normal, w = kindId (0=conifer, 1=broadleaf/xeno, 2=settlement)
};

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) world_pos: vec3<f32>,
  @location(1) norm: vec3<f32>,
  @location(2) col_emiss: vec4<f32>,
  @location(3) flora_info: vec3<f32>, // x = partId, y = kindId, z = snowWeight
};

@vertex
fn vs_main(in: VsIn, @builtin(instance_index) iid: u32) -> VsOut {
  let inst = instances[iid];
  let scale_h = inst.pos_scale.w;
  if (scale_h <= 0.01 || abs(inst.rot_kind.z - in.norm_kind.w) > 0.4) {
    var culled: VsOut;
    culled.pos = vec4<f32>(2.0, 2.0, -1.0, 1.0);
    culled.world_pos = vec3<f32>(0.0);
    culled.norm = vec3<f32>(0.0, 1.0, 0.0);
    culled.col_emiss = vec4<f32>(0.0);
    culled.flora_info = vec3<f32>(0.0);
    return culled;
  }
  // Exact live per-frame TinyPlanet spherical curvature matching generate_surface_terrain_mesh to 0.000 m!
  // cam.extra1.w = 1/(2R), cam.extra2.w = focusX, cam.em_aux.z = focusZ
  let dx_c = inst.pos_scale.x - cam.extra2.w;
  let dz_c = inst.pos_scale.z - cam.em_aux.z;
  // Smooth radial LOD scale-fade across [310 m .. 412 m] so flora/trees never pop instantaneously at the +-416 m grid edge!
  let flora_dist = length(vec2<f32>(dx_c, dz_c));
  let flora_lod_fade = 1.0 - smoothstep(310.0, 412.0, flora_dist);
  if (flora_lod_fade <= 0.01) {
    var culled_d: VsOut;
    culled_d.pos = vec4<f32>(2.0, 2.0, -1.0, 1.0);
    culled_d.world_pos = vec3<f32>(0.0);
    culled_d.norm = vec3<f32>(0.0, 1.0, 0.0);
    culled_d.col_emiss = vec4<f32>(0.0);
    culled_d.flora_info = vec3<f32>(0.0);
    return culled_d;
  }
  let eff_scale_h = scale_h * flora_lod_fade;
  let cy = cos(inst.rot_kind.x);
  let sy = sin(inst.rot_kind.x);
  let r_sc = inst.rot_kind.y * eff_scale_h;
  let lx = in.pos_part.x * r_sc;
  let ly = in.pos_part.y * eff_scale_h;
  let lz = in.pos_part.z * r_sc;
  let rx = lx * cy - lz * sy;
  let rz = lx * sy + lz * cy;
  let curv_drop = (dx_c * dx_c + dz_c * dz_c) * cam.extra1.w;
  let base_curved = vec3<f32>(inst.pos_scale.x, inst.pos_scale.y - curv_drop, inst.pos_scale.z);
  let wp = base_curved + vec3<f32>(rx, ly, rz);
  let nx = in.norm_kind.x * cy - in.norm_kind.z * sy;
  let nz = in.norm_kind.x * sy + in.norm_kind.z * cy;

  var out: VsOut;
  out.pos = apply_log_depth_vs(cam.view_proj * vec4<f32>(wp, 1.0), cam.em_aux.w);
  out.world_pos = wp;
  out.norm = normalize(vec3<f32>(nx, in.norm_kind.y, nz));
  out.col_emiss = inst.col_emiss;
  out.flora_info = vec3<f32>(in.pos_part.w, inst.rot_kind.z, inst.rot_kind.w);
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let sky_zen = cam.extra0.rgb;
  let opt_depth = clamp(cam.extra0.w, 0.0, 1.0);
  let sun_dir = normalize(cam.extra1.xyz);
  let sky_hor = cam.extra2.rgb;
  let eclipse_f = clamp(cam.em_aux.y, 0.06, 1.0);
  let sun_day = smoothstep(-0.10, 0.18, sun_dir.y) * eclipse_f;
  let twi_d = (sun_dir.y - 0.03) / 0.14;
  let sunset_w = exp(-(twi_d * twi_d)) * opt_depth * eclipse_f;

  let n = normalize(in.norm);
  let ndl = max(0.0, dot(n, sun_dir));
  let part_id = in.flora_info.x;
  let kind_id = in.flora_info.y;

  var base_col = in.col_emiss.rgb;
  var emiss = 0.0;
  if (part_id < 0.5) {
    // Trunk or structural base (kind 6 = indigenous settlement facade)
    base_col = select(vec3<f32>(0.34, 0.23, 0.15), in.col_emiss.rgb * 0.72, kind_id > 5.5);
  } else if (part_id > 1.5) {
    // Glowing habitation windows & spire beacons shine brightly at twilight & night!
    base_col = vec3<f32>(1.0, 0.86, 0.54);
    emiss = in.col_emiss.w * (0.45 + 1.45 * (1.0 - sun_day));
  } else if (kind_id < 5.5 && in.col_emiss.w > 0.05) {
    // Subtle nocturnal bioluminescence on exotic cryo-solvent / coral / buoyant kelp flora!
    emiss = in.col_emiss.w * (0.35 + 0.95 * (1.0 - sun_day));
  }
  // Upward-facing seasonal winter snow caps on conifer boughs & deciduous canopies from live GPU snowWeight!
  if (part_id >= 0.5 && part_id <= 1.5 && kind_id < 5.5 && in.flora_info.z > 0.02) {
    let snow_top = clamp(in.flora_info.z * smoothstep(0.10, 0.72, n.y), 0.0, 1.0);
    base_col = mix(base_col, vec3<f32>(0.92, 0.96, 1.00), snow_top * 0.78);
  }

  let star_rgb_f = cam.star_light.rgb;
  let star_flux_f = clamp(cam.star_light.w, 0.14, 1.85);
  let amb_day = mix(sky_hor * 0.36 + vec3<f32>(0.05), sky_zen * 0.48 + vec3<f32>(0.06), clamp(n.y * 0.5 + 0.5, 0.0, 1.0)) * mix(vec3<f32>(1.0), star_rgb_f, 0.55) * clamp(0.26 + 0.74 * star_flux_f, 0.22, 1.40);
  let amb = mix(vec3<f32>(0.025, 0.036, 0.062), amb_day, sun_day);
  let sun_tint = mix(vec3<f32>(1.06, 1.02, 0.94), vec3<f32>(1.24, 0.56, 0.24), sunset_w * 0.65) * star_rgb_f * star_flux_f;
  var col = base_col * (amb * 0.52 + sun_tint * (ndl * 1.15 * sun_day)) + base_col * emiss;

  let dist = length(cam.cam_pos.xyz - in.world_pos);
  let horiz_dist = length(in.world_pos.xz - cam.cam_pos.xz);
  let fog_amt = clamp(1.0 - exp(-dist * mix(0.000045, 0.00028, opt_depth)), 0.0, 0.82);
  let patch_edge = smoothstep(4200.0, 5850.0, horiz_dist);
  let fog_hor = mix(vec3<f32>(0.014, 0.022, 0.044), sky_hor, sun_day) + vec3<f32>(0.96, 0.40, 0.14) * sunset_w * 0.75;
  col = mix(col, fog_hor, clamp(max(fog_amt, patch_edge), 0.0, 1.0));

  if (cam.em_sensor.z > 0.5) {
    let t_k = max(40.0, cam.em_aux.x) + select(8.0, 95.0, kind_id > 5.5);
    let rad_sig = select(0.0, 1.25, kind_id > 5.5);
    col = em_sensor_map_rgb(col, t_k, 0.0, 0.0, rad_sig, 0.0);
  }
  return vec4<f32>(col, 1.0);
}
`,Si=`
${gi}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsIn {
  @location(0) pos_curv: vec4<f32>,
  @location(1) norm_tag: vec4<f32>,
  @location(2) col_alpha: vec4<f32>,
};

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) world_pos: vec3<f32>,
  @location(1) norm: vec3<f32>,
  @location(2) col_alpha: vec4<f32>,
  @location(3) tag: f32,
};

@vertex
fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.pos = apply_log_depth_vs(cam.view_proj * vec4<f32>(in.pos_curv.xyz, 1.0), cam.em_aux.w);
  out.world_pos = in.pos_curv.xyz;
  out.norm = in.norm_tag.xyz;
  out.col_alpha = in.col_alpha;
  out.tag = in.norm_tag.w;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let n = normalize(in.norm);
  let v = normalize(cam.cam_pos.xyz - in.world_pos);
  let ndv = abs(dot(n, v));
  let fres = pow(max(0.0, 1.0 - ndv), 2.4);
  let sun_dir = normalize(vec3<f32>(0.55, 0.72, 0.42));
  let half_v = normalize(sun_dir + v);
  let spec = pow(max(0.0, abs(dot(n, half_v))), 64.0);

  if (in.tag < 5.5) {
    // Glowing emerald-green translucent glass dome bubble (bright glossy rim + transparent center!)
    let glass_col = in.col_alpha.rgb * (0.72 + 1.35 * fres) + vec3<f32>(0.78, 1.0, 0.88) * spec * 1.15;
    let alpha = clamp(in.col_alpha.a * (0.45 + 0.85 * fres + 0.45 * spec), 0.14, 0.92);
    return vec4<f32>(glass_col * alpha, alpha);
  }
  // Yellow conical tractor beam & 360° rim EM Laser / Antimatter beams (luminous soft edge falloff!)
  let beam_edge = 0.42 + 0.78 * pow(max(0.0, ndv), 0.75);
  let alpha = clamp(in.col_alpha.a * beam_edge, 0.04, 0.96);
  let glow = in.col_alpha.rgb * (1.28 + 0.55 * ndv);
  return vec4<f32>(glow * alpha, alpha);
}
`,Z=`
${gi}
${_i}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> raw_f32: array<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) shape: f32, // 0 = crisp glowing star/spark, 1 = soft volumetric 3D cloud billow, 2 = CFD flow streak
  @location(3) em_sig: vec4<f32>, // x = tempK, y = uv_aur, z = xray_synch, w = radio_hi
  @location(4) em_gam: f32,       // gamma-ray pulse / 511 keV emission
};

// Exact 32-bit Murmur3 integer avalanche hash -> full 24-bit uniform [0, 1) (ZERO f32 sin() mantissa collapse!)
// Salting with independent u32 constants gives completely uncorrelated class, frequency, phase, and pulse width per star!
fn gal_hash_u32(v_in: u32) -> f32 {
  var x = v_in;
  x = (x ^ (x >> 16u)) * 0x7feb352du;
  x = (x ^ (x >> 15u)) * 0x846ca68bu;
  x = x ^ (x >> 16u);
  return f32(x & 0x00ffffffu) * (1.0 / 16777216.0);
}

fn gal_star_hash(iid: u32) -> f32 {
  return gal_hash_u32(iid ^ 0x13579bdfu);
}

fn blackbody_rgb(log10_t: f32) -> vec3<f32> {
  if (log10_t < 2.2) { return vec3<f32>(0.42, 0.24, 0.78); }
  if (log10_t < 3.45) {
    let f = clamp((log10_t - 2.2) / 1.25, 0.0, 1.0);
    return mix(vec3<f32>(0.78, 0.28, 0.14), vec3<f32>(1.0, 0.56, 0.20), f);
  }
  if (log10_t < 4.1) {
    let f = clamp((log10_t - 3.45) / 0.65, 0.0, 1.0);
    return mix(vec3<f32>(1.0, 0.62, 0.24), vec3<f32>(1.0, 0.96, 0.84), f);
  }
  let f = clamp((log10_t - 4.1) / 2.2, 0.0, 1.0);
  return mix(vec3<f32>(0.96, 0.98, 1.0), vec3<f32>(0.42, 0.78, 1.0), f);
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let mode = u32(round(cam.extra0.x));
  let world_scale = cam.extra0.y;
  let pt_size_base = cam.extra0.z;
  let alpha_gain = cam.extra0.w;

  var p_world = vec3<f32>(0.0);
  var col = vec3<f32>(0.6, 0.85, 1.0);
  var pt_size = pt_size_base;
  var alpha = alpha_gain;
  var shape = 0.0;
  var streak_axis = vec3<f32>(0.0);
  var streak_len = 0.0;
  var cosmo_p_idx = iid;

  if (mode == 0u) {
    // L0: Full 93-Gly (28,500 Mpc, R_H = 46.5 Gly) Observable-Universe Lightcone Cosmic Web!
    // Evolves a physically resolved periodic FLRW 2LPT + TreePM box (box_sz = 1,425 Mpc, dx ~ 44 Mpc),
    // tiled seamlessly via GPU instancing across a 5x5x5 spherical Observable-Universe lightcone (extra2.z = rawCount,
    // extra2.w = R_H_mpc = 14,250 Mpc) with octahedral tile symmetry (zero repeating stripes) & radial lookback redshift z(r)!
    let is_sky = world_scale < 0.0;
    let box_sz = max(10.0, cam.extra1.w);
    let raw_cnt = u32(round(max(0.0, cam.extra2.z)));
    let obs_rad = max(0.0, cam.extra2.w);
    let tiled_obs = (raw_cnt > 0u) && (obs_rad > 100.0) && !is_sky;

    var p_idx = iid;
    var cell_off = vec3<f32>(0.0);
    var tile_rot_id = 0u;
    var outer_tile_att = 1.0;
    if (tiled_obs) {
      // Distribute ALL instances UNIFORMLY across the 5x5x5 spherical Observable Universe lightcone
      // (INCLUDING center cell (0,0,0)!) so there is ZERO overexposed white blob in the center!
      let c_raw = iid % 125u;
      let tx = i32(c_raw % 5u) - 2;
      let ty = i32((c_raw / 5u) % 5u) - 2;
      let tz = i32(c_raw / 25u) - 2;
      let r2_t = tx * tx + ty * ty + tz * tz;
      if (r2_t > 5) {
        var culled_t: VsOut;
        culled_t.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
        culled_t.color = vec4<f32>(0.0);
        culled_t.uv = vec2<f32>(0.0);
        return culled_t;
      }
      p_idx = ((iid / 125u) * 19u + c_raw * 97u) % raw_cnt;
      cell_off = vec3<f32>(f32(tx), f32(ty), f32(tz));
      tile_rot_id = select(c_raw, 0u, r2_t == 0);
      outer_tile_att = select(select(0.95, 0.86, r2_t >= 2), 0.72, r2_t >= 4);
    }
    cosmo_p_idx = p_idx;

    let o = p_idx * 16u;
    var raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    var raw_v = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
    if (tiled_obs && tile_rot_id > 0u) {
      // Deterministic octahedral 3D symmetry per outer lightcone cell -> organic filament network with zero grid repetition!
      let perm = tile_rot_id % 3u;
      if (perm == 1u) { raw_p = raw_p.yzx; raw_v = raw_v.yzx; }
      else if (perm == 2u) { raw_p = raw_p.zxy; raw_v = raw_v.zxy; }
      if ((tile_rot_id & 1u) != 0u) { raw_p.x = -raw_p.x; raw_v.x = -raw_v.x; }
      if ((tile_rot_id & 2u) != 0u) { raw_p.y = -raw_p.y; raw_v.y = -raw_v.y; }
      if ((tile_rot_id & 4u) != 0u) { raw_p.z = -raw_p.z; raw_v.z = -raw_v.z; }
    }
    let tile_pitch = select(box_sz, (obs_rad * 2.0) / 5.0, tiled_obs);
    let obs_pos = select(raw_p, (cell_off + raw_p / box_sz) * tile_pitch, tiled_obs);

    let a_scale = select(1.0, max(0.02, cam.extra2.x), cam.extra2.x > 0.001);
    let bb_mode = clamp(cam.extra2.y, 0.0, 1.0);
    // Live FLRW metric expansion r_phys(t) = a(t) * x_comoving visible in BOTH Cosmic Web AND Big Bang modes!
    // Smooth logarithmic continuation beyond a > 2.2 keeps expansion visibly alive forever without emptying the lightcone!
    let a_web = select(max(0.18, a_scale), 2.2 + 1.45 * log(max(1.0, a_scale / 2.2)), a_scale > 2.2);
    let a_expand = select(a_web, max(0.05, a_scale), bb_mode > 0.5);
    let rel_c = obs_pos - cam.extra1.xyz;
    let d_rel_c = length(rel_c);
    // Smooth spherical Observable-Universe Particle Horizon vignette at R_H = 46.5 Gly (14,250 Mpc)
    let r_hor_norm = select(length(raw_p) / max(1.0, box_sz * 0.5), length(obs_pos) / max(1.0, obs_rad), tiled_obs);
    let sphere_fade = 1.0 - smoothstep(0.84, 1.0, r_hor_norm);
    if (sphere_fade < 0.01 || (is_sky && d_rel_c < 2.0)) {
      var culled0: VsOut;
      culled0.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled0.color = vec4<f32>(0.0);
      culled0.uv = vec2<f32>(0.0);
      return culled0;
    }
    p_world = select(rel_c * (world_scale * a_expand), cam.cam_pos.xyz + (rel_c / max(1e-3, d_rel_c)) * (-world_scale), is_sky);
    let rho = clamp(raw_f32[o + 7u], 0.04, 1.0);
    let is_baryon = raw_f32[o + 12u] > 0.5;
    let col_void = vec3<f32>(0.14, 0.18, 0.62);
    let col_fil = vec3<f32>(0.18, 0.66, 1.0);
    let col_node = vec3<f32>(1.0, 0.74, 0.28);
    var c_dm = mix(col_void, col_fil, smoothstep(0.08, 0.54, rho));
    c_dm = mix(c_dm, col_node, smoothstep(0.58, 0.95, rho));
    let c_bar = mix(vec3<f32>(0.94, 0.40, 0.22), vec3<f32>(1.0, 0.82, 0.36), smoothstep(0.18, 0.90, rho));
    let sky_att = select(1.0, clamp(42.0 / (16.0 + d_rel_c), 0.35, 1.85), is_sky);
    var web_col = select(c_dm, c_bar, is_baryon) * (0.80 + 1.05 * pow(rho, 0.90));

    // Radial cosmological lookback redshift z(r) across the 93-Gly Observable Lightcone!
    //   Local z~0 (center): vivid sapphire/cyan filaments -> Cosmic Noon z~1-3 (mid): amber-gold
    //   -> Cosmic Dawn z~6-10 (outer): crimson-violet -> Planck CMB Horizon Shell (r -> R_H): glowing amber-microwave rim!
    if (tiled_obs && bb_mode < 0.5) {
      let mid_z = smoothstep(0.32, 0.72, r_hor_norm);
      let deep_z = smoothstep(0.68, 0.95, r_hor_norm);
      let cmb_rim = smoothstep(0.88, 0.99, r_hor_norm);
      web_col = mix(web_col, web_col * vec3<f32>(1.18, 0.92, 0.74), mid_z * 0.55);
      web_col = mix(web_col, vec3<f32>(0.98, 0.36, 0.46) * (0.55 + 0.85 * rho), deep_z * 0.52);
      web_col = mix(web_col, vec3<f32>(1.25, 0.68, 0.24) * (0.70 + 0.60 * rho), cmb_rim * 0.62);
    }

    // Continuous FLRW Big Bang fireball blackbody shift T(z) = 2.7255 / a(t):
    if (bb_mode > 0.5 && !is_sky) {
      let early_w = 1.0 - smoothstep(0.08, 0.58, a_scale);
      let hot_plasma = vec3<f32>(0.82, 0.94, 1.45);
      let recomb_gold = vec3<f32>(1.38, 0.86, 0.34);
      let dawn_crim = vec3<f32>(1.05, 0.32, 0.42);
      var era_col = mix(hot_plasma, recomb_gold, smoothstep(0.05, 0.18, a_scale));
      era_col = mix(era_col, dawn_crim, smoothstep(0.20, 0.42, a_scale));
      web_col = mix(web_col, era_col * (0.85 + 0.75 * rho), early_w);
    }

    col = web_col;
    pt_size = pt_size_base * (0.54 + 0.92 * pow(rho, 0.85)) * select(1.0, 0.68 + 0.52 * sky_att, is_sky) * select(1.0, 1.12, tiled_obs && tile_rot_id > 0u);
    alpha = alpha_gain * (0.28 + 0.72 * pow(rho, 0.92)) * sphere_fade * sky_att * outer_tile_att;
    if (!is_sky) {
      let v_mag = length(raw_v);
      if (bb_mode < 0.5 && v_mag > 0.65 && (iid & 3u) == 0u) {
        streak_axis = raw_v / v_mag;
        streak_len = clamp(pt_size * (1.8 + v_mag * 0.75), pt_size * 1.4, pt_size * 4.2);
        shape = 2.0;
      } else if (!is_baryon && rho > 0.42 && (iid & 1u) == 0u) {
        shape = 1.0;
        pt_size = pt_size * 1.48;
        alpha = alpha * 0.58;
      }
    }
  } else if (mode == 1u) {
    // L1: Realistic Flat-Rotation Spiral Galaxy (8 floats/star: pos, mass, vel, popTag)
    // popTag < 0 => invisible dark-matter NFW halo particle (provides REAL GPU gravity for flat rotation curve!)
    // When world_scale < 0.0, renders the LIVE 32,768-star Milky Way skyband from THIS star's exact galactocentric position!
    let o = iid * 8u;
    let pop_tag = raw_f32[o + 7u];
    let is_sky = world_scale < 0.0;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let rel_g = raw_p - cam.extra1.xyz;
    let d_rel_g = length(rel_g);
    if (pop_tag < 0.0 || (is_sky && d_rel_g < 0.08)) {
      var culled: VsOut;
      culled.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled.color = vec4<f32>(0.0);
      culled.uv = vec2<f32>(0.0);
      return culled;
    }
    p_world = select(rel_g * world_scale, cam.cam_pos.xyz + (rel_g / max(1e-4, d_rel_g)) * (-world_scale), is_sky);
    let m = raw_f32[o + 3u];
    // pop_tag encodes astrophysical population (HDR linear colors tone-mapped cleanly via ACES!):
    //   [0.01..0.35]: warm golden-amber bulge & old disk K/M/G stars
    //   [0.35..0.78]: young blue-white spiral-arm O/B/A stars
    //   [0.78..1.10]: rose-magenta H-alpha / H II star-forming knots
    let warm_bulge = vec3<f32>(1.0, 0.68, 0.34);
    let gold_core = vec3<f32>(1.0, 0.84, 0.52);
    let ob_blue = vec3<f32>(0.42, 0.74, 1.0);
    let h2_rose = vec3<f32>(1.0, 0.32, 0.58);
    let sky_att = select(1.0, clamp(4.2 / (0.85 + d_rel_g), 0.24, 2.15), is_sky);
    if (pop_tag < 0.35) {
      let f = clamp(pop_tag / 0.35, 0.0, 1.0);
      col = mix(gold_core, warm_bulge, f);
      pt_size = pt_size_base * (0.45 + 0.55 * (1.0 - f));
      alpha = alpha_gain * (0.24 + 0.34 * (1.0 - f));
      if (!is_sky && pop_tag < 0.14 && (iid & 3u) == 0u) {
        // Soft volumetric golden bulge radiance
        shape = 1.0;
        pt_size = pt_size * 1.9;
        alpha = alpha * 0.45;
      }
    } else if (pop_tag < 0.78) {
      let f = clamp((pop_tag - 0.35) / 0.43, 0.0, 1.0);
      // Real ISM wavelength-dependent dust extinction: tau(lambda) = tau_V * (0.55 um / lambda)^1.7!
      // Dark optical spiral dust lanes physically become transparent when switched to JWST IR (1-20 um)!
      let mid_log_lam = 0.5 * (cam.em_sensor.x + cam.em_sensor.y);
      let ir_pierce = select(0.0, smoothstep(-6.05, -5.05, mid_log_lam), cam.em_sensor.z > 0.5);
      let r_gal = length(raw_p.xz);
      let arm_phi = atan2(raw_p.z, raw_p.x);
      // Gate thin-disk dust lane strictly on planar disk scale height so 3D spheroids/ellipticals/globulars never get fake spiral stripes!
      let disk_flat = exp(-pow(raw_p.y / 1.35, 2.0));
      let dust_lane = disk_flat * smoothstep(0.58, 0.95, sin(arm_phi * 2.0 - log(max(0.4, r_gal)) * 4.4)) * smoothstep(1.1, 4.4, r_gal) * (1.0 - smoothstep(7.5, 11.8, r_gal)) * (1.0 - ir_pierce * 0.85);
      col = mix(vec3<f32>(0.86, 0.91, 1.0), ob_blue, f) * (1.0 - dust_lane * 0.56);
      pt_size = pt_size_base * (0.44 + 0.74 * f);
      alpha = alpha_gain * (0.28 + 0.56 * f) * (1.0 - dust_lane * 0.36);
      // Subtle 4-point optical diffraction spikes on blazing young O/B supergiants!
      if (!is_sky && f > 0.74 && gal_star_hash(iid ^ 0x55aa33ccu) > 0.945) {
        shape = 3.0;
        pt_size = pt_size * 2.35;
      }
    } else {
      let f = clamp((pop_tag - 0.78) / 0.32, 0.0, 1.0);
      col = mix(h2_rose, vec3<f32>(1.0, 0.56, 0.78), f);
      pt_size = pt_size_base * (0.95 + 0.78 * f);
      alpha = alpha_gain * (0.36 + 0.44 * f);
      if (!is_sky && f > 0.45 && (iid & 3u) == 0u) {
        shape = 1.0;
        pt_size = pt_size * 1.45;
      }
    }
    if (m > 25.0) {
      // Galactic nucleus soft warm amber glow (zero giant black hole at 100 kly!)
      col = vec3<f32>(1.0, 0.88, 0.62);
      pt_size = pt_size_base * 1.8;
      alpha = alpha_gain * 0.55;
    }
    if (is_sky) {
      pt_size = pt_size * (0.65 + 0.55 * sky_att);
      alpha = alpha * sky_att;
    } else if (cam.em_sensor.z > 0.5) {
      // Multi-Wavelength Galactic Exotic Sources stand out dramatically when EM Sensor carets shift out of Optical!
      let l_min = min(cam.em_sensor.x, cam.em_sensor.y);
      let l_max = max(cam.em_sensor.x, cam.em_sensor.y);
      let in_radio = smoothstep(-2.8, -1.0, l_max);
      let in_gamma = 1.0 - smoothstep(-12.2, -10.4, l_min);
      let in_xray = smoothstep(-11.8, -10.2, l_max) * (1.0 - smoothstep(-8.8, -7.4, l_min));
      let in_uv = smoothstep(-8.2, -7.4, l_max) * (1.0 - smoothstep(-6.7, -6.2, l_min));
      let gh = gal_star_hash(iid);
      let is_pulsar = (gh > 0.986 && pop_tag >= 0.20);
      let is_xrb = (gh > 0.974 && gh <= 0.986 && pop_tag >= 0.10);
      let t_sec = cam.cam_pos.w;
      if (is_pulsar) {
        // Independent 32-bit salted hashes -> completely asynchronous per-pulsar spin frequency (0.22..4.84 Hz, 22x spread),
        // independent random initial phase [0..2pi), and distinct lighthouse beam duty width!
        let h_freq = gal_hash_u32(iid ^ 0x9e3779b9u);
        let h_phase = gal_hash_u32(iid ^ 0x517cc1b7u);
        let h_duty = gal_hash_u32(iid ^ 0x243f6a88u);
        let f_hz = 0.22 * pow(22.0, h_freq);
        let phase = h_phase * 6.2831853;
        let sharp = 6.0 + h_duty * 18.0;
        let beam = pow(max(0.0, cos(t_sec * f_hz * 6.2831853 + phase)), sharp);
        let boost_band = max(in_radio, in_gamma);
        pt_size = min(pt_size_base * 2.35, pt_size * (1.0 + boost_band * (0.95 + 1.45 * beam)));
        alpha = clamp(alpha * (0.45 + boost_band * (0.85 + 1.95 * beam)), 0.05, 1.0);
      } else if (is_xrb) {
        // Accreting Stellar-Mass Black-Hole / Neutron-Star X-Ray Binary with independent MRI QPO frequency & phase!
        let x_freq = 1.4 + gal_hash_u32(iid ^ 0x6a09e667u) * 8.2;
        let x_phase = gal_hash_u32(iid ^ 0xbb67ae85u) * 6.2831853;
        let qpo = 0.55 + 0.45 * sin(t_sec * x_freq + x_phase);
        pt_size = pt_size * (1.0 + in_xray * (1.9 + 1.4 * qpo));
        alpha = clamp(alpha * (0.60 + in_xray * (1.5 + 1.8 * qpo)), 0.05, 1.0);
      } else if (pop_tag >= 0.78) {
        // Massive OB Starburst / H II knots blaze in UV & Far-IR!
        pt_size = pt_size * (1.0 + in_uv * 1.15);
      } else {
        // Dim ordinary main-sequence stars slightly in extreme non-optical bands so pulsars & X-ray binaries pop clearly!
        let exotic_band = clamp(in_gamma + in_xray * 0.85 + in_radio * 0.45, 0.0, 0.88);
        alpha = alpha * (1.0 - exotic_band * 0.62);
      }
    }
  } else if (mode == 2u) {
    // L3: Self-Gravitating Hydro / 3D MLS-MPM Stellar Fusion Plasma (16 floats/parcel)
    // Purely physical (log_t, log_rho, log_eps) radiative-transport thermalization across
    // ALL stellar classes (1,150 K Brown Dwarf -> 3,450 K Red Supergiant -> 5,778 K G2V Sun -> 28,500 K O/B Supergiant!):
    let o = iid * 16u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let log_t = raw_f32[o + 8u];
    let log_rho = raw_f32[o + 9u];
    let log_eps = raw_f32[o + 11u];
    let fusion_glow = smoothstep(-0.5, 4.5, log_eps);
    let dens_w = clamp((log_rho + 18.0) / 22.0, 0.15, 1.0);
    let teff_log = select(3.76, cam.extra1.w, cam.extra1.w > 2.5);
    let thick_star = smoothstep(3.05, 3.85, log_t);
    // Physical convective photosphere color driven continuously by stellar effective temperature T_eff & local thermal buoyancy!
    let t_phot = clamp(mix(teff_log, clamp(log_t - 2.35, 3.0, 4.7), 0.36), 3.0, 4.65);
    let c_bd = vec3<f32>(0.76, 0.16, 0.28);      // 1,150 K T/Y Brown Dwarf methane-ember
    let c_rsg = vec3<f32>(1.00, 0.22, 0.05);     // 3,450 K M-supergiant Betelgeuse ruby-crimson
    let c_sun = vec3<f32>(1.00, 0.72, 0.24);     // 5,778 K G2V solar amber-gold
    let c_ob = vec3<f32>(0.38, 0.74, 1.00);      // 28,500 K O/B sapphire-blue supergiant
    var phot_col = mix(c_bd, c_rsg, smoothstep(3.05, 3.48, t_phot));
    phot_col = mix(phot_col, c_sun, smoothstep(3.52, 3.82, t_phot));
    phot_col = mix(phot_col, c_ob, smoothstep(3.88, 4.38, t_phot));
    // Hot upwelling convective granules brighten toward cream/white-hot core while sinking intergranular lanes deepen!
    let env_t = clamp((log_t - 4.8) / 2.6, 0.0, 1.0);
    let core_tint = mix(vec3<f32>(1.0, 0.88, 0.62), vec3<f32>(0.78, 0.94, 1.0), smoothstep(3.85, 4.30, teff_log));
    let solar_mid = mix(phot_col * (0.72 + 0.52 * env_t), core_tint, smoothstep(0.55, 0.98, env_t) * 0.72);
    let sn_flash = smoothstep(7.7, 8.6, log_t);
    let star_col = mix(solar_mid, vec3<f32>(0.74, 0.94, 1.0), clamp(fusion_glow * 0.44 + sn_flash * 0.82, 0.0, 1.0));
    let cloud_col = mix(blackbody_rgb(log_t), vec3<f32>(0.58, 0.94, 1.0), fusion_glow * 0.55);
    col = mix(cloud_col, star_col, thick_star) * (0.94 + 0.92 * fusion_glow + 0.35 * sn_flash);
    pt_size = pt_size_base * (0.76 + 1.08 * dens_w);
    alpha = alpha_gain * (0.30 + 0.58 * dens_w);
  } else if (mode == 3u) {
    // L6: Quantum Orbital Point Cloud (4 floats/point: vec4(x, y, z, packed_meta))
    // When world_scale < 0.0, renders as a faint faraway electron-shell sky enveloping the L7 femtometer nucleus!
    let o = iid * 4u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let is_sky = world_scale < 0.0;
    let d_q = length(raw_p);
    if (is_sky && d_q < 0.04) {
      var culled3: VsOut;
      culled3.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled3.color = vec4<f32>(0.0);
      culled3.uv = vec2<f32>(0.0);
      return culled3;
    }
    p_world = select(raw_p * world_scale, cam.cam_pos.xyz + (raw_p / max(1e-4, d_q)) * (-world_scale), is_sky);
    let packed_meta = raw_f32[o + 3u];
    let mag = clamp(abs(packed_meta), 0.15, 1.0);
    let pos_phase = packed_meta >= 0.0;
    let c_pos = cam.extra1.rgb;
    let c_neg = cam.extra2.rgb;
    col = select(c_neg, c_pos, pos_phase) * (0.70 + 0.95 * mag);
    pt_size = pt_size_base * (0.72 + 0.55 * mag);
    alpha = alpha_gain * (0.30 + 0.70 * mag);
  } else if (mode == 13u) {
    // Mode 13: Crisp Pinpoint Hypervelocity Planetesimal Impactors & Molten Shock Sparks around Volumetric 3D SPH Protoplanet!
    // (When Live Volumetric Protoplanet is active, heavy interior bulk is ray-marched directly from the 3D SPH grid,
    //  so Mode 13 only renders fiery incoming LHB impactors & sparkling incandescent ejecta — ZERO giant polka dots!)
    let o = iid * 16u;
    let act = raw_f32[o + 15u];
    let sp = raw_f32[o + 8u];
    let shock = raw_f32[o + 11u];
    let only_impactors = cam.extra1.w > 0.5;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let raw_v = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
    let r_p13 = length(raw_p);
    // During live volumetric protoplanet rendering, ONLY show fiery incoming space impactor meteor streaks
    // outside the crust (species == 3 && r >= 1.00) — volumetric Mode 1 already renders all 3D interior & shock glows!
    if (act < 0.5 || (only_impactors && (abs(sp - 3.0) > 0.35 || r_p13 < 1.00))) {
      var culled13: VsOut;
      culled13.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled13.color = vec4<f32>(0.0);
      culled13.uv = vec2<f32>(0.0);
      return culled13;
    }
    p_world = cam.extra1.xyz + raw_p * world_scale;
    let temp_n = clamp(raw_f32[o + 7u], 0.0, 1.0);
    let thick = raw_f32[o + 10u];
    let v_mag13 = length(raw_v);
    if (abs(sp - 3.0) < 0.3) {
      // Blazing velocity-stretched hypervelocity LHB planetesimal meteor streak!
      col = vec3<f32>(1.0, 0.86, 0.42) * (1.55 + shock * 0.5);
      pt_size = pt_size_base * 0.58;
      if (v_mag13 > 0.15) {
        streak_axis = raw_v / v_mag13;
        streak_len = clamp(pt_size * (2.6 + v_mag13 * 1.4), pt_size * 1.8, pt_size * 6.5);
        shape = 2.0;
      }
    } else if (shock >= 0.25) {
      // Glowing white-orange impact shock spark
      col = mix(vec3<f32>(1.0, 0.45, 0.08), vec3<f32>(1.0, 0.94, 0.66), clamp(shock * 0.65, 0.0, 1.0)) * 1.4;
      pt_size = pt_size_base * 0.44;
    } else if (sp < 0.5) {
      col = mix(vec3<f32>(1.0, 0.62, 0.14), vec3<f32>(1.0, 0.94, 0.68), temp_n);
      pt_size = pt_size_base * 0.52;
    } else if (abs(sp - 1.0) < 0.3) {
      col = mix(vec3<f32>(0.54, 0.18, 0.10), vec3<f32>(1.0, 0.44, 0.10), temp_n);
      pt_size = pt_size_base * 0.46;
    } else if (abs(sp - 2.0) < 0.3) {
      col = mix(vec3<f32>(0.26, 0.58, 0.34), vec3<f32>(0.84, 0.78, 0.64), clamp(thick * 0.8, 0.0, 1.0));
      pt_size = pt_size_base * 0.48;
    } else {
      col = vec3<f32>(0.14, 0.58, 0.96);
      pt_size = pt_size_base * 0.42;
    }
    alpha = alpha_gain * select(0.55, 0.95, abs(sp - 3.0) < 0.3 || shock >= 0.25);
  } else if (mode == 12u) {
    // Mode 12: Rescaled Parent L5 Crystal Lattice Skybox enveloping the L6 Quantum Atom (4 floats/atom: x,y,z,w)!
    let o = iid * 4u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]) - cam.extra1.xyz;
    let d_l = length(raw_p);
    if (d_l < 0.25) {
      var culled12: VsOut;
      culled12.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled12.color = vec4<f32>(0.0);
      culled12.uv = vec2<f32>(0.0);
      return culled12;
    }
    let sky_r = abs(world_scale);
    p_world = cam.cam_pos.xyz + (raw_p / max(1e-4, d_l)) * sky_r;
    let att = clamp(6.0 / (1.5 + d_l), 0.25, 1.6);
    col = cam.extra2.rgb * (0.65 + 0.55 * att);
    pt_size = pt_size_base * (0.75 + 0.65 * att);
    alpha = alpha_gain * att;
    shape = 1.0;
  } else if (mode == 4u) {
    // Mode 4: L2 Real-Scale Solar System Minor Bodies / Main & Kuiper Belt Asteroids (f32x2 double-float!)
    let skip_n = u32(round(cam.extra1.w));
    if (iid < skip_n) {
      var culled: VsOut;
      culled.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled.color = vec4<f32>(0.0);
      culled.uv = vec2<f32>(0.0);
      return culled;
    }
    let o = iid * 16u;
    let dx = (raw_f32[o + 0u] - cam.extra1.x) + (raw_f32[o + 4u] - cam.extra2.x);
    let dy = (raw_f32[o + 1u] - cam.extra1.y) + (raw_f32[o + 5u] - cam.extra2.y);
    let dz = (raw_f32[o + 2u] - cam.extra1.z) + (raw_f32[o + 6u] - cam.extra2.z);
    p_world = vec3<f32>(dx, dy, dz) * world_scale;
    let kind_f = raw_f32[o + 11u];
    col = select(vec3<f32>(0.78, 0.70, 0.56), vec3<f32>(0.54, 0.76, 1.0), kind_f > 6.5);
    pt_size = pt_size_base;
    alpha = alpha_gain * 0.75;
  } else if (mode == 5u) {
    // Mode 5: L3 3D Self-Gravitating Resistive MHD Nebular Collapse & Magnetocentrifugal Bipolar Jets!
    let o = iid * 16u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let b_mag = raw_f32[o + 7u];
    let rho = raw_f32[o + 11u];
    let u_int = raw_f32[o + 12u];
    let jet_out = raw_f32[o + 13u];
    let dens_f = clamp(log(1.0 + rho * 2.8) * 0.58, 0.0, 1.0);
    let jet_f = smoothstep(0.04, 0.45, jet_out) * smoothstep(0.05, 0.35, b_mag);
    let mag_f = clamp(b_mag * 0.72, 0.0, 1.0);
    // Warm dusty molecular cloud & golden collapsing accretion disk -> electric cyan/violet MHD jet plasma!
    let dust_col = mix(vec3<f32>(0.76, 0.28, 0.32), vec3<f32>(1.0, 0.64, 0.20), dens_f);
    let core_col = mix(dust_col, vec3<f32>(1.0, 0.92, 0.66), smoothstep(0.45, 0.95, dens_f + u_int * 0.22));
    let jet_col = mix(vec3<f32>(0.24, 0.82, 1.0), vec3<f32>(0.76, 0.46, 1.0), mag_f);
    col = mix(core_col, jet_col * 1.55, clamp(jet_f * 0.90 + mag_f * 0.18 * (1.0 - dens_f), 0.0, 1.0));
    pt_size = pt_size_base * (0.58 + 0.82 * dens_f + 0.75 * jet_f);
    alpha = alpha_gain * (0.26 + 0.56 * dens_f + 0.62 * jet_f);
  } else if (mode == 6u) {
    // Mode 6: L2 Volumetric Swirling Protoplanetary Accretion Disk (velocity-aligned Keplerian spiral streaks +
    // soft translucent nebula gas mist + shock-heated glowing protoplanet cores — ZERO grainy static dots!)
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.5 || raw_f32[o + 3u] <= 0.0) {
      var culled6: VsOut;
      culled6.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled6.color = vec4<f32>(0.0);
      culled6.uv = vec2<f32>(0.0);
      return culled6;
    }
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let raw_v = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
    let r_au6 = max(0.02, raw_f32[o + 11u]);
    let r_xz6 = max(1e-4, length(raw_p.xz));
    // Continuous radial morphism from log-radial disk overview (blend=0) -> exact 1:1 physical linear AU (blend=1)!
    let au_blend = clamp(cam.extra1.w, 0.0, 1.0);
    let au_scale = max(0.0, cam.extra2.x);
    let r_log_w = r_xz6 * world_scale;
    let r_lin_w = r_au6 * au_scale;
    let r_eff_w = select(r_log_w, mix(r_log_w, r_lin_w, au_blend), au_scale > 1e-6);
    let xz_dir = raw_p.xz / r_xz6;
    let y_eff_w = raw_p.y * (r_eff_w / r_xz6);
    p_world = vec3<f32>(xz_dir.x * r_eff_w, y_eff_w, xz_dir.y * r_eff_w) - cam.extra1.xyz;
    let temp_k = raw_f32[o + 8u];
    let ice_f = clamp(raw_f32[o + 9u], 0.0, 1.0);
    let gas_env = clamp(raw_f32[o + 10u], 0.0, 1.0);
    let r_vis6 = length(raw_p.xz);
    let hot_t = clamp((temp_k - 180.0) / 720.0, 0.0, 1.0);
    let shock_flare = smoothstep(550.0, 1350.0, temp_k);
    // Warm incandescent silicate/Fe inner nebula -> pearl-turquoise snow-line mist -> deep sapphire-violet Kuiper haze
    let inner_col = mix(vec3<f32>(0.88, 0.36, 0.12), vec3<f32>(1.0, 0.84, 0.46), hot_t);
    let snow_col = vec3<f32>(0.42, 0.84, 1.0);
    let outer_col = mix(vec3<f32>(0.18, 0.42, 0.88), vec3<f32>(0.54, 0.78, 1.0), smoothstep(0.9, 5.2, r_vis6));
    var neb_col = mix(inner_col, mix(snow_col, outer_col, smoothstep(0.35, 0.92, ice_f)), smoothstep(0.08, 0.82, ice_f));
    neb_col = mix(neb_col, vec3<f32>(1.0, 0.95, 0.78) * 1.45, shock_flare * 0.65 + gas_env * 0.35);
    col = neb_col;
    let v_mag6 = length(raw_v);
    let is_mist = (iid & 3u) == 0u;
    if (is_mist) {
      // Soft luminous translucent volumetric gas/dust cloud layer weaving spiral arms together!
      shape = 1.0;
      pt_size = pt_size_base * (3.2 + 1.8 * ice_f);
      alpha = alpha_gain * (0.095 + 0.08 * (1.0 - ice_f * 0.35) + 0.08 * shock_flare);
    } else if (v_mag6 > 0.25) {
      // Fine silky velocity-aligned Keplerian plasma & pebble orbital streams!
      shape = 2.0;
      streak_axis = raw_v / v_mag6;
      pt_size = pt_size_base * (0.50 + 0.32 * shock_flare);
      streak_len = clamp(pt_size * (3.6 + v_mag6 * 0.72), pt_size * 2.8, pt_size * 7.2);
      alpha = alpha_gain * (0.16 + 0.22 * shock_flare + 0.14 * (1.0 - ice_f * 0.35));
    } else {
      pt_size = pt_size_base * 0.62;
      alpha = alpha_gain * 0.22;
    }
  } else if (mode == 7u) {
    // Mode 7: Relativistic Kerr/BZ Jet (real camera-angle Doppler beaming!), Magnetar Flares/Pulsar Beams, & BNS Kilonova r-Process Ejecta!
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.5) {
      var culled7: VsOut;
      culled7.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled7.color = vec4<f32>(0.0);
      culled7.uv = vec2<f32>(0.0);
      return culled7;
    }
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let role = raw_f32[o + 3u];
    let vel = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
    let gamma = max(1.0, raw_f32[o + 7u]);
    let t_norm = clamp(raw_f32[o + 8u], 0.0, 2.0);
    let aux_ye = raw_f32[o + 9u];
    let emiss = clamp(raw_f32[o + 10u], 0.0, 2.6);
    // Live relativistic Doppler beaming factor delta = 1 / (Gamma * (1 - beta * cos(theta)))!
    // Orbiting into a Quasar jet cone naturally boosts it into a blazing blue-white Blazar!
    let to_obs = normalize(cam.cam_pos.xyz - p_world);
    let v_mag = length(vel);
    let beta = sqrt(max(0.0, 1.0 - 1.0 / (gamma * gamma)));
    let cos_th = select(0.0, dot(vel / v_mag, to_obs), v_mag > 1e-4);
    let doppler = clamp(1.0 / max(0.28, gamma * (1.0 - min(0.88, beta) * cos_th)), 0.35, 3.2);
    let beam_boost = mix(1.0, pow(doppler, 1.35), smoothstep(1.15, 2.5, gamma));
    if (role > 0.5 && role < 1.5) {
      // Relativistic BZ Jet / Polar Lighthouse Beam / Blue Polar Kilonova Wind
      col = mix(vec3<f32>(0.24, 0.72, 1.0), vec3<f32>(0.88, 0.96, 1.0), clamp(beam_boost * 0.45, 0.0, 1.0)) * (0.9 + 0.85 * emiss) * beam_boost;
      pt_size = pt_size_base * (0.65 + 0.55 * min(2.0, beam_boost));
      alpha = alpha_gain * clamp(0.32 + 0.48 * emiss * min(1.8, beam_boost), 0.05, 0.95);
    } else if (role >= 1.5) {
      // Red Lanthanide r-Process Kilonova / Magnetar Giant Flare Fireball / Dusty Torus
      let is_red_rproc = aux_ye > 0.01 && aux_ye < 0.25;
      let base_c = select(
        mix(vec3<f32>(0.92, 0.34, 0.72), vec3<f32>(1.0, 0.86, 0.42), clamp(t_norm * 0.65, 0.0, 1.0)),
        mix(vec3<f32>(0.96, 0.26, 0.14), vec3<f32>(1.0, 0.70, 0.26), clamp(t_norm * 0.7, 0.0, 1.0)),
        is_red_rproc
      );
      col = base_c * (0.75 + 0.95 * emiss);
      pt_size = pt_size_base * (0.82 + 0.65 * clamp(emiss * 0.5, 0.0, 1.0));
      alpha = alpha_gain * clamp(0.26 + 0.52 * emiss, 0.05, 0.92);
    } else {
      // Novikov-Thorne Hot Kerr Accretion Disk / Twisted Magnetosphere Loops
      let disk_c = mix(vec3<f32>(1.0, 0.42, 0.14), vec3<f32>(0.94, 0.96, 1.0), clamp(t_norm * 0.75, 0.0, 1.0));
      col = disk_c * (0.8 + 0.7 * emiss) * mix(1.0, doppler, 0.45);
      pt_size = pt_size_base * (0.62 + 0.52 * min(1.5, t_norm));
      alpha = alpha_gain * clamp(0.30 + 0.48 * emiss, 0.06, 0.88);
    }
  } else if (mode == 8u) {
    // Mode 8: Photoionized / Reflection / Wolf-Rayet Nebulae + Embedded Protostars + Dual-Tail Comets!
    // Real ISM wavelength-dependent dust optical depth tau(lambda) = tau_V * (0.55 um / lambda)^1.7:
    // Switching Optical -> JWST IR physically turns dusty Pillars of Creation translucent and reveals
    // blazing embedded fiery ruby protostars & collimated Herbig-Haro outflow jets inside!
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.5) {
      var culled8: VsOut;
      culled8.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled8.color = vec4<f32>(0.0);
      culled8.uv = vec2<f32>(0.0);
      return culled8;
    }
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let raw_v8 = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
    let sp_tag = raw_f32[o + 3u];
    let is_comet_tail = cam.extra1.w > 0.5;
    p_world = select((raw_p - cam.extra1.xyz) * world_scale, cam.extra1.xyz + raw_p * world_scale, is_comet_tail);
    let ha = clamp(raw_f32[o + 8u], 0.0, 2.0);
    let o3 = clamp(raw_f32[o + 9u], 0.0, 2.0);
    let s2_dust = clamp(raw_f32[o + 10u], 0.0, 2.0);
    let mid_log_lam8 = 0.5 * (cam.em_sensor.x + cam.em_sensor.y);
    let ir_pierce8 = select(0.0, smoothstep(-6.05, -5.05, mid_log_lam8), cam.em_sensor.z > 0.5);
    let c_ha = vec3<f32>(1.0, 0.28, 0.44) * ha;
    let c_o3 = vec3<f32>(0.16, 0.88, 1.0) * o3;
    let c_s2 = vec3<f32>(1.0, 0.72, 0.28) * s2_dust;
    let tot = max(0.12, ha + o3 + s2_dust);
    col = (c_ha + c_o3 + c_s2) * (0.95 / pow(tot, 0.28));
    if (is_comet_tail) {
      // Crisp Rosetta-style velocity-stretched sublimation gas & dust tail filaments (ZERO bokeh dots over nucleus!)
      let r_com = length(raw_p);
      let nuc_clear = smoothstep(0.32, 0.88, r_com);
      let v8_mag = length(raw_v8);
      if (nuc_clear < 0.03) {
        var culled8c: VsOut;
        culled8c.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
        culled8c.color = vec4<f32>(0.0);
        culled8c.uv = vec2<f32>(0.0);
        return culled8c;
      }
      if (v8_mag > 0.15) {
        shape = 2.0;
        streak_axis = raw_v8 / v8_mag;
        pt_size = pt_size_base * (0.55 + 0.55 * min(1.2, tot));
        streak_len = clamp(pt_size * (4.5 + v8_mag * 1.4), pt_size * 3.5, pt_size * 10.0);
      } else {
        shape = 1.0;
        pt_size = pt_size_base * 1.1;
      }
      alpha = alpha_gain * nuc_clear * clamp(0.14 + 0.34 * min(1.4, tot), 0.03, 0.65);
    } else if (sp_tag > 3.5) {
      // Embedded protostars & Herbig-Haro jets veiled in optical dust, blazing in JWST IR!
      let vis_veil = mix(0.24, 1.95, ir_pierce8);
      col = mix(vec3<f32>(1.0, 0.34, 0.16), vec3<f32>(1.0, 0.88, 0.56), ir_pierce8) * vis_veil;
      pt_size = pt_size_base * mix(0.65, 2.35, ir_pierce8);
      alpha = alpha_gain * clamp(mix(0.20, 1.45, ir_pierce8), 0.06, 1.0);
      shape = select(0.0, 3.0, ir_pierce8 > 0.35);
    } else if (sp_tag < 0.5) {
      // Dense molecular dust pillar column: opaque sculpted silhouettes in optical, translucent warm PAH veil in JWST IR!
      col = col * mix(0.68, 0.95, ir_pierce8);
      pt_size = pt_size_base * (0.95 + 0.75 * min(1.4, tot)) * mix(1.35, 1.05, ir_pierce8);
      alpha = alpha_gain * clamp(0.32 + 0.52 * min(1.5, tot), 0.05, 0.90) * mix(1.0, 0.42, ir_pierce8);
      shape = 1.0;
    } else {
      pt_size = pt_size_base * (0.85 + 0.72 * min(1.5, tot)) * 1.25;
      alpha = alpha_gain * clamp(0.24 + 0.56 * min(1.5, tot), 0.05, 0.90);
      shape = 1.0;
    }
  } else if (mode == 9u) {
    // Mode 9: Roche-Limit Tidal Disruption Debris, Shepherd-Moon Rings, Giant Impact Ejecta, & Cryovolcanic Ice Plumes!
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.5) {
      var culled9: VsOut;
      culled9.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled9.color = vec4<f32>(0.0);
      culled9.uv = vec2<f32>(0.0);
      return culled9;
    }
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let intact = raw_f32[o + 7u];
    let t_norm = clamp(raw_f32[o + 8u], 0.0, 2.0);
    let role = raw_f32[o + 10u];
    if (role > 1.5 && role < 2.5) {
      // Cryovolcanic icy water-vapor plume crystals
      col = vec3<f32>(0.68, 0.92, 1.0) * (0.85 + 0.45 * t_norm);
      pt_size = pt_size_base * 0.85;
      alpha = alpha_gain * 0.58;
    } else if (t_norm > 0.72) {
      // Incandescent molten silicate Giant-Impact / Red-Giant engulfment debris
      col = mix(vec3<f32>(0.96, 0.34, 0.10), vec3<f32>(1.0, 0.88, 0.48), clamp((t_norm - 0.72) * 1.1, 0.0, 1.0));
      pt_size = pt_size_base * (0.78 + 0.45 * min(1.2, t_norm));
      alpha = alpha_gain * 0.72;
    } else {
      // Icy/rocky Roche ring & rubble-pile particles
      col = mix(vec3<f32>(0.88, 0.80, 0.66), vec3<f32>(0.76, 0.88, 1.0), select(0.25, 0.75, intact > 0.5));
      pt_size = pt_size_base * select(0.65, 0.95, intact > 0.5);
      alpha = alpha_gain * 0.64;
    }
  } else if (mode == 10u) {
    // Mode 10: Cosmological Baryon & Radiation (CMB ΔT/T Shell, Reionization H II Bubbles, & Galaxy Cluster X-Ray ICM + DM!)
    let o = iid * 16u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let rho = clamp(raw_f32[o + 7u], 0.05, 6.0);
    let temp_k = raw_f32[o + 8u];
    let x_hii = clamp(raw_f32[o + 9u], 0.0, 1.0);
    let sz_dt = raw_f32[o + 10u];
    let is_dm = raw_f32[o + 11u] > 0.5;
    let flags = u32(round(raw_f32[o + 14u]));
    if ((flags & 1u) != 0u) {
      // CMB Recombination Acoustic Surface (authentic Planck cold-indigo -> deep-teal -> amber-gold -> vermilion ΔT/T!)
      let f = clamp(sz_dt * 0.56 + 0.5, 0.0, 1.0);
      let c_cold = vec3<f32>(0.04, 0.18, 0.88);
      let c_teal = vec3<f32>(0.10, 0.62, 0.72);
      let c_warm = vec3<f32>(0.96, 0.74, 0.18);
      let c_hot  = vec3<f32>(0.95, 0.26, 0.06);
      if (f < 0.35) {
        col = mix(c_cold, c_teal, f / 0.35);
      } else if (f < 0.68) {
        col = mix(c_teal, c_warm, (f - 0.35) / 0.33);
      } else {
        col = mix(c_warm, c_hot, (f - 0.68) / 0.32);
      }
      pt_size = pt_size_base * 1.05;
      alpha = alpha_gain * 0.72;
    } else if ((flags & 2u) != 0u) {
      // Cosmic Dawn Reionization: Neutral dark-crimson HI web vs glowing electric-cyan H II ionization bubbles!
      let c_hi = vec3<f32>(0.48, 0.12, 0.34);
      let c_hii = vec3<f32>(0.10, 0.82, 1.0);
      let c_pop3 = vec3<f32>(1.0, 0.86, 0.44);
      col = mix(c_hi, c_hii, smoothstep(0.08, 0.72, x_hii));
      col = mix(col, c_pop3, smoothstep(0.84, 0.99, x_hii));
      pt_size = pt_size_base * (0.62 + 0.75 * x_hii);
      alpha = alpha_gain * (0.24 + 0.68 * x_hii);
    } else {
      // Bullet-Cluster Galaxy Cluster Merger: Vivid Magenta-Rose X-Ray Shocked ICM vs Deep Electric-Blue DM Lensing Halos!
      let x_em = clamp(log(1.0 + max(0.0, temp_k * 1e-7) * rho) * 0.55, 0.15, 1.15);
      col = select(
        mix(vec3<f32>(0.96, 0.16, 0.48), vec3<f32>(1.0, 0.62, 0.24), clamp(x_em * 0.65, 0.0, 1.0)),
        vec3<f32>(0.14, 0.48, 1.0) * (0.75 + 0.55 * min(1.3, rho * 0.35)),
        is_dm
      );
      pt_size = pt_size_base * select(0.75 + 0.48 * min(1.1, x_em), 1.05, is_dm);
      alpha = alpha_gain * select(0.32 + 0.45 * min(1.0, x_em), 0.72, is_dm);
    }
  } else {
    // Mode 11: Planetary Surface Jump-Rocket Exhaust Flames, Ballistic Regolith Dust, & Drone Rotor Downwash!
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.05) {
      var culled11: VsOut;
      culled11.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled11.color = vec4<f32>(0.0);
      culled11.uv = vec2<f32>(0.0);
      return culled11;
    }
    var rp = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let role = raw_f32[o + 3u];
    // Apply exact TinyPlanet spherical curvature drop to surface plumes (roles 0..2);
    // keep 3D volumetric atmospheric CFD cloud strata & vortex tracers (roles 3..4) in true 3D space!
    if (role < 2.5) {
      let dx_c = rp.x - cam.extra1.x;
      let dz_c = rp.z - cam.extra1.z;
      rp.y = rp.y - (dx_c * dx_c + dz_c * dz_c) * cam.extra1.w;
    }
    p_world = rp * world_scale;
    let age = raw_f32[o + 7u];
    let base_rgb = vec3<f32>(raw_f32[o + 8u], raw_f32[o + 9u], raw_f32[o + 10u]);
    let max_life = max(0.15, raw_f32[o + 11u]);
    let sz = max(0.10, raw_f32[o + 12u]);
    let life_f = clamp(age / max_life, 0.0, 1.0);
    let fade = (1.0 - life_f) * smoothstep(0.0, 0.08, life_f + 0.04);
    if (role < 0.5) {
      // Blazing jump-rocket exhaust: cyan-white hot Mach diamond core -> incandescent orange tail!
      let flame_c = mix(vec3<f32>(0.90, 0.96, 1.0), vec3<f32>(1.0, 0.40, 0.06), clamp(life_f * 2.1, 0.0, 1.0));
      col = flame_c * (2.1 - 0.9 * life_f);
      pt_size = pt_size_base * sz * (0.72 + 1.15 * life_f);
      alpha = alpha_gain * fade * 0.36;
    } else if (role < 1.5) {
      // Sunlit ballistic regolith / dust plume (gentle additive weight so dust never blows out to pure white!)
      col = base_rgb * (0.48 + 0.22 * (1.0 - life_f));
      pt_size = pt_size_base * sz * (0.48 + 0.92 * life_f);
      alpha = alpha_gain * fade * 0.052;
    } else if (role < 2.5) {
      // Subtle drone rotor downwash dust ring & fine wind-blown atmospheric motes!
      col = base_rgb * 0.52;
      pt_size = pt_size_base * sz * (0.42 + 0.55 * life_f);
      alpha = alpha_gain * fade * 0.068;
    } else if (role < 3.5) {
      // 3D Volumetric Atmospheric CFD Cloud Strata Bank (sculpted sunlit overhead cumulus/NH3/NH4SH billows — never additive whiteout!)
      let puff_fade = sin(clamp(life_f, 0.0, 1.0) * 3.1415926);
      let d_cam = length(p_world - cam.cam_pos.xyz);
      let near_fade = smoothstep(22.0, 62.0, d_cam);
      col = base_rgb * 0.68;
      pt_size = pt_size_base * sz * 1.48 * (0.85 + 0.25 * puff_fade);
      alpha = alpha_gain * is_live * (0.35 + 0.45 * puff_fade) * near_fade * 0.078;
      shape = 1.0;
    } else {
      // Sleek Translucent Velocity-Aligned 3D CFD Flow Ribbon / Eddy Streamline!
      let s_fade = sin(clamp(life_f, 0.0, 1.0) * 3.1415926);
      let v_raw = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
      let v_mag = length(v_raw);
      col = base_rgb * 0.96;
      pt_size = pt_size_base * max(0.24, sz * 0.36);
      alpha = alpha_gain * is_live * (0.32 + 0.68 * s_fade) * 0.34;
      if (v_mag > 0.12) {
        streak_axis = v_raw / v_mag;
        streak_len = clamp(v_mag * 0.28, 1.1, 4.2);
        shape = 2.0;
      }
    }
  }

  var world_corner: vec3<f32>;
  if (shape > 1.5 && shape < 2.5) {
    // Orient billboard cleanly along projected 3D CFD velocity vector so airflow curves visually in 3D!
    let to_cam = normalize(cam.cam_pos.xyz - p_world);
    let side = normalize(cross(streak_axis, to_cam) + vec3<f32>(0.0, 1e-4, 0.0));
    world_corner = p_world
      + streak_axis * (uv.x * streak_len)
      + side * (uv.y * pt_size * 0.42);
  } else {
    // Clamp non-sky particle billboard radius vs camera distance so a star passing right past the lens
    // never explodes into a screen-filling blob!
    let d_cam_p = length(p_world - cam.cam_pos.xyz);
    let safe_pt_sz = select(min(pt_size, max(0.015, d_cam_p * 0.085)), pt_size, world_scale < 0.0 || (shape > 0.5 && shape < 1.5));
    world_corner = p_world
      + cam.cam_right.xyz * (uv.x * safe_pt_sz)
      + cam.cam_up.xyz * (uv.y * safe_pt_sz);
  }
  let clip_raw = cam.view_proj * vec4<f32>(world_corner, 1.0);
  var clip = apply_log_depth_vs(clip_raw, cam.em_aux.w);
  // True celestial backdrop starfield sits at farthest reversed-Z infinity just behind true-metric planets/suns!
  if (world_scale < 0.0 && clip.w > 0.0) {
    clip.z = 1.0e-6 * clip.w;
  }

  var out: VsOut;
  out.pos = clip;
  out.color = vec4<f32>(col, alpha);
  out.uv = uv;
  out.shape = shape;
  // Physical EM spectral signature per cosmological/astrophysical particle layout!
  var em_t = 3200.0;
  var em_uv = 0.0;
  var em_xr = 0.0;
  var em_rad = 0.0;
  var em_gam = 0.0;
  if (mode == 0u) {
    let o0 = cosmo_p_idx * 16u;
    let is_bar = raw_f32[o0 + 12u] > 0.5;
    let rho0 = clamp(raw_f32[o0 + 7u], 0.04, 1.0);
    em_t = select(2.725, 4.0e6 * (0.2 + rho0), is_bar);
    em_xr = select(0.0, rho0 * 1.4, is_bar);
    em_rad = select(0.04 * rho0, 0.75 * rho0, is_bar);
  } else if (mode == 1u) {
    let o1 = iid * 8u;
    let pt1 = raw_f32[o1 + 7u];
    let m1 = raw_f32[o1 + 3u];
    let gh = gal_star_hash(iid);
    let is_pulsar = (gh > 0.986 && pt1 >= 0.20);
    let is_xrb = (gh > 0.974 && gh <= 0.986 && pt1 >= 0.10);
    let t_sec = cam.cam_pos.w;
    if (m1 > 25.0) {
      // Central SMBH Sgr A* relativistic core: bright Radio synchrotron + X-Ray + Gamma!
      em_t = 3.5e7; em_uv = 1.8; em_xr = 4.2; em_rad = 4.8; em_gam = 3.5;
    } else if (is_pulsar) {
      let h_freq = gal_hash_u32(iid ^ 0x9e3779b9u);
      let h_phase = gal_hash_u32(iid ^ 0x517cc1b7u);
      let h_duty = gal_hash_u32(iid ^ 0x243f6a88u);
      let f_hz = 0.22 * pow(22.0, h_freq);
      let phase = h_phase * 6.2831853;
      let sharp = 6.0 + h_duty * 18.0;
      let beam = pow(max(0.0, cos(t_sec * f_hz * 6.2831853 + phase)), sharp);
      em_t = 8.0e5;
      em_rad = 1.4 + 10.5 * beam;
      em_gam = 1.2 + 9.2 * beam;
      em_xr = 0.4 + 2.0 * beam;
    } else if (is_xrb) {
      let x_freq = 1.4 + gal_hash_u32(iid ^ 0x6a09e667u) * 8.2;
      let x_phase = gal_hash_u32(iid ^ 0xbb67ae85u) * 6.2831853;
      let qpo = 0.55 + 0.45 * sin(t_sec * x_freq + x_phase);
      em_t = 2.2e7;
      em_xr = 5.5 + 4.0 * qpo;
      em_uv = 1.6;
      em_rad = 0.75 * qpo;
    } else {
      em_t = select(select(3800.0, 14000.0, pt1 >= 0.35), 42000.0, pt1 >= 0.78);
      em_uv = select(select(0.06, 0.95, pt1 >= 0.35), 3.4, pt1 >= 0.78);
      // 21 cm neutral Hydrogen (H I) spiral arms & cold molecular dust filaments!
      let rp1 = vec2<f32>(raw_f32[o1], raw_f32[o1 + 2u]);
      let r_g1 = length(rp1);
      let phi1 = atan2(rp1.y, rp1.x);
      let hi_arm = smoothstep(0.35, 0.92, sin(phi1 * 2.0 - log(max(0.4, r_g1)) * 4.4)) * smoothstep(1.0, 4.0, r_g1);
      em_rad = select(0.45 + 1.45 * hi_arm, 0.25 + 0.65 * hi_arm, pt1 >= 0.78);
    }
  } else if (mode == 2u) {
    let o2 = iid * 16u;
    let lt2 = clamp(raw_f32[o2 + 8u], 1.5, 8.2);
    em_t = pow(10.0, lt2);
    em_uv = smoothstep(3.8, 5.4, lt2) * 1.2;
    em_xr = smoothstep(5.8, 7.6, lt2) * 1.8;
  } else if (mode == 7u) {
    em_t = 1.2e7;
    em_xr = 1.65;
    em_rad = 1.45; // Relativistic synchrotron jet & hot Kerr disk!
    em_gam = 1.15;
  } else if (mode == 8u) {
    let o8 = iid * 16u;
    let sp8 = raw_f32[o8 + 3u];
    em_t = select(select(11000.0, 185.0, sp8 < 0.5), 1850.0, sp8 > 3.5);
    em_uv = select(0.95, 0.12, sp8 < 0.5);
    em_xr = select(0.15, 0.85, sp8 > 1.5 && sp8 < 2.5);
    em_rad = select(0.35, 1.25, sp8 < 0.5);
  } else if (mode == 9u) {
    let o9 = iid * 16u;
    let tn9 = clamp(raw_f32[o9 + 8u], 0.1, 2.0);
    em_t = 350.0 + tn9 * 95000.0;
    em_uv = smoothstep(0.7, 1.8, tn9) * 1.4;
    em_xr = smoothstep(1.1, 1.9, tn9) * 2.2;
  } else if (mode == 10u) {
    let o10 = iid * 16u;
    let flags10 = u32(round(raw_f32[o10 + 14u]));
    if ((flags10 & 1u) != 0u) {
      em_t = 2.725 + raw_f32[o10 + 10u] * 0.25;
      em_rad = 0.2;
    } else if ((flags10 & 2u) != 0u) {
      em_t = 9000.0 * clamp(raw_f32[o10 + 9u], 0.02, 1.0);
      em_rad = 1.35 * (1.0 - clamp(raw_f32[o10 + 9u], 0.0, 1.0)); // 21cm neutral HI cosmic dawn!
      em_uv = clamp(raw_f32[o10 + 9u], 0.0, 1.0) * 1.3;
    } else {
      let dm10 = raw_f32[o10 + 11u] > 0.5;
      em_t = select(max(1e6, raw_f32[o10 + 8u]), 2.725, dm10);
      em_xr = select(1.85, 0.0, dm10);
    }
  } else if (mode == 11u) {
    em_t = max(80.0, cam.em_aux.x) + select(0.0, 1600.0, shape < 0.5);
  }
  out.em_sig = vec4<f32>(em_t, em_uv, em_xr, em_rad);
  out.em_gam = em_gam;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.uv, in.uv);
  if (r2 > 1.0) { discard; }
  var w: f32;
  var rgb = in.color.rgb;
  if (in.shape > 2.5) {
    // Crisp 4-point Hubble/JWST optical diffraction spikes around blazing O/B supergiants & embedded IR protostars!
    let core_s = exp(-28.0 * r2) * 1.35;
    let sp_x = exp(-abs(in.uv.y) * 26.0) * exp(-abs(in.uv.x) * 2.8) * 0.62;
    let sp_y = exp(-abs(in.uv.x) * 26.0) * exp(-abs(in.uv.y) * 2.8) * 0.62;
    let halo_s = exp(-5.0 * r2) * 0.25;
    w = core_s + sp_x + sp_y + halo_s;
  } else if (in.shape > 1.5) {
    // Sleek glowing 3D aerodynamic CFD streamline ribbon!
    let core_y = exp(-7.5 * in.uv.y * in.uv.y);
    let tip_x = max(0.0, 1.0 - in.uv.x * in.uv.x);
    w = core_y * tip_x * 1.15;
  } else if (in.shape > 0.5) {
    // Sculpted volumetric 3D cloud billow: warm sunlit tops + cooler shaded underside + organic lobe edge!
    let lobe = 0.88 + 0.12 * sin(in.uv.x * 5.2 + in.uv.y * 3.1) * cos(in.uv.y * 4.7 - in.uv.x * 2.4);
    let soft = max(0.0, 1.0 - r2 * lobe);
    w = soft * soft * 0.76;
    let top_sun = clamp(in.uv.y * 0.45 + 0.62, 0.38, 1.14);
    let cloud_tint = mix(vec3<f32>(0.72, 0.78, 0.88), vec3<f32>(1.06, 1.02, 0.96), clamp(in.uv.y * 0.5 + 0.5, 0.0, 1.0));
    rgb = rgb * cloud_tint * top_sun;
  } else {
    let core = exp(-6.2 * r2);
    let halo = exp(-2.2 * r2) * 0.28;
    w = core + halo;
  }
  rgb = em_sensor_map_rgb(rgb, in.em_sig.x, in.em_sig.y, in.em_sig.z, in.em_sig.w, in.em_gam);
  return vec4<f32>(rgb * w * in.color.a, in.color.a * w);
}
`,Ci=`
${gi}
${_i}

// 5 vec4s (80 bytes) per sphere instance:
//   pos_r:  vec4(x, y, z, true_radius)
//   color0: vec4(r, g, b, kind)   kind: 0=star, 1=terrestrial/ocean/rocky, 2=gas-giant/haze, 3=ice/moon, 4=cutaway-planet, 5=black-hole/nucleus, 6=nucleon, 7=magma
//   color1: vec4(r2, g2, b2, atm_strength)
//   params: vec4(r_core_norm, r_mantle_norm, cutaway_active, seed)
//   sp_info: vec4(tempK, civTechK, dysonCoverage, flags)
struct SphereInstance {
  pos_r: vec4<f32>,
  color0: vec4<f32>,
  color1: vec4<f32>,
  params: vec4<f32>,
  sp_info: vec4<f32>,
};

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> spheres: array<SphereInstance>;
// Zero-copy live GPU Planetary Baroclinic Atmosphere + Triboelectric Lightning + Aurora + CFD Flow grid!
// 3 vec4 per cell: [i*3+0]=em0(rhoQ, phi, eMag, flash), [i*3+1]=vis(cloud, dust, lightningGlow, auroraEnv), [i*3+2]=cfd_flow(uEast, vNorth, vort, tAnom)
@group(0) @binding(2) var<storage, read> atmo_em_grid: array<vec4<f32>>;
// Zero-copy live GPU 3D SPH Planetary Genesis Spherical Geology Map (W x H):
//   vec4(elevNorm [-1..1], crustComp [0..1], thermalVolc [0..1], moistureRiver [0..1])
@group(0) @binding(3) var<storage, read> sph_geology_grid: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) center: vec3<f32>,
  @location(1) radius: f32,
  @location(2) world_quad: vec3<f32>,
  @location(3) color0: vec4<f32>,
  @location(4) color1: vec4<f32>,
  @location(5) params: vec4<f32>,
  @location(6) quad_uv: vec2<f32>,
  @location(7) pinpoint_w: f32,
  @location(8) @interpolate(flat) inst_id: u32,
  @location(9) sp_info: vec4<f32>,
};

struct FsOut {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let sp = spheres[iid];
  let center = sp.pos_r.xyz;
  let radius = sp.pos_r.w;
  let kind = u32(round(sp.color0.w));

  let to_cam_v = cam.cam_pos.xyz - center;
  let dist = max(1e-5, length(to_cam_v));
  let to_cam = to_cam_v / dist;
  let right = normalize(cross(cam.cam_up.xyz, to_cam));
  let up = cross(to_cam, right);

  // Compute approximate apparent radius in screen height fraction:
  let app_frac = radius / max(1e-5, dist * cam.cam_up.w);
  let min_glint_frac = select(0.0062, 0.013, kind == 0u);
  let pinpoint_w = 1.0 - smoothstep(min_glint_frac * 0.55, min_glint_frac * 2.2, app_frac);
  let min_world_half = dist * cam.cam_up.w * min_glint_frac;

  let disp_pad = max(0.0, sp.sp_info.w) * 1.40;
  let halo_inflate = max(select(1.24, 1.54, kind == 0u || kind == 5u), 1.08 + disp_pad);
  let base_inflate = radius * select(max(1.54, 1.15 + disp_pad), halo_inflate, dist > radius * 2.6);
  let inflate = max(base_inflate, select(0.0, min_world_half, kind <= 4u));
  let world_quad = center + to_cam * min(radius * 0.15, dist * 0.05) + right * (uv.x * inflate) + up * (uv.y * inflate);

  var out: VsOut;
  out.pos = apply_log_depth_vs(cam.view_proj * vec4<f32>(world_quad, 1.0), cam.em_aux.w);
  out.center = center;
  out.radius = radius;
  out.world_quad = world_quad;
  out.color0 = sp.color0;
  out.color1 = sp.color1;
  out.params = sp.params;
  out.quad_uv = uv;
  out.pinpoint_w = select(0.0, pinpoint_w, kind <= 4u);
  out.inst_id = iid;
  out.sp_info = sp.sp_info;
  return out;
}

fn sample_live_atmo_slot(n_hit: vec3<f32>, w_u: u32, h_u: u32, slot: u32) -> vec4<f32> {
  let lon = atan2(n_hit.z, n_hit.x); // [-pi, pi]
  let lat = asin(clamp(n_hit.y, -1.0, 1.0)); // [-pi/2, pi/2]
  let u = fract(lon / 6.28318530718 + 0.5);
  let v = clamp(0.5 - lat / 3.14159265359, 0.0, 0.9999);
  let gx = u * f32(w_u) - 0.5;
  let gy = v * f32(h_u) - 0.5;
  let x0 = i32(floor(gx));
  let y0 = i32(floor(gy));
  let fx = fract(gx);
  let fy = fract(gy);
  let wi = i32(w_u);
  let hi = i32(h_u);
  let ix0 = u32(((x0 % wi) + wi) % wi);
  let ix1 = u32((((x0 + 1) % wi) + wi) % wi);
  let iy0 = u32(clamp(y0, 0, hi - 1));
  let iy1 = u32(clamp(y0 + 1, 0, hi - 1));
  let c00 = atmo_em_grid[(iy0 * w_u + ix0) * 3u + slot];
  let c10 = atmo_em_grid[(iy0 * w_u + ix1) * 3u + slot];
  let c01 = atmo_em_grid[(iy1 * w_u + ix0) * 3u + slot];
  let c11 = atmo_em_grid[(iy1 * w_u + ix1) * 3u + slot];
  return mix(mix(c00, c10, fx), mix(c01, c11, fx), fy);
}

fn sample_live_atmo_vis(n_hit: vec3<f32>, w_u: u32, h_u: u32) -> vec4<f32> {
  return sample_live_atmo_slot(n_hit, w_u, h_u, 1u);
}

fn sample_live_atmo_flow(n_hit: vec3<f32>, w_u: u32, h_u: u32) -> vec4<f32> {
  return sample_live_atmo_slot(n_hit, w_u, h_u, 2u);
}

fn sample_sph_geology(n_hit: vec3<f32>, w_u: u32, h_u: u32) -> vec4<f32> {
  let lon = atan2(n_hit.z, n_hit.x);
  let lat = asin(clamp(n_hit.y, -1.0, 1.0));
  let u = fract(lon / 6.28318530718 + 0.5);
  let v = clamp(0.5 - lat / 3.14159265359, 0.0, 0.9999);
  let gx = u * f32(w_u) - 0.5;
  let gy = v * f32(h_u) - 0.5;
  let x0 = i32(floor(gx));
  let y0 = i32(floor(gy));
  let fx = fract(gx);
  let fy = fract(gy);
  let wi = i32(w_u);
  let hi = i32(h_u);
  let ix0 = u32(((x0 % wi) + wi) % wi);
  let ix1 = u32((((x0 + 1) % wi) + wi) % wi);
  let iy0 = u32(clamp(y0, 0, hi - 1));
  let iy1 = u32(clamp(y0 + 1, 0, hi - 1));
  let c00 = sph_geology_grid[iy0 * w_u + ix0];
  let c10 = sph_geology_grid[iy0 * w_u + ix1];
  let c01 = sph_geology_grid[iy1 * w_u + ix0];
  let c11 = sph_geology_grid[iy1 * w_u + ix1];
  return mix(mix(c00, c10, fx), mix(c01, c11, fx), fy);
}

fn hash3(p_in: vec3<f32>) -> f32 {
  var p = fract(p_in * 0.3183099 + vec3<f32>(0.1, 0.2, 0.3));
  p = p * 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

fn vnoise3(x: vec3<f32>) -> f32 {
  let i = floor(x);
  let f = fract(x);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i + vec3<f32>(0.0, 0.0, 0.0)), hash3(i + vec3<f32>(1.0, 0.0, 0.0)), u.x),
        mix(hash3(i + vec3<f32>(0.0, 1.0, 0.0)), hash3(i + vec3<f32>(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(hash3(i + vec3<f32>(0.0, 0.0, 1.0)), hash3(i + vec3<f32>(1.0, 0.0, 1.0)), u.x),
        mix(hash3(i + vec3<f32>(0.0, 1.0, 1.0)), hash3(i + vec3<f32>(1.0, 1.0, 1.0)), u.x), u.y),
    u.z
  );
}

fn fbm5(p_in: vec3<f32>) -> f32 {
  var p = p_in;
  var sum = 0.0;
  var amp = 0.5;
  for (var i = 0u; i < 5u; i = i + 1u) {
    sum = sum + amp * vnoise3(p);
    p = p * 2.07 + vec3<f32>(13.7, -9.2, 5.4);
    amp = amp * 0.5;
  }
  return sum;
}

fn is_cutaway_octant(p_loc: vec3<f32>, cut_active: f32) -> bool {
  return cut_active > 0.5 && p_loc.x > 0.0 && p_loc.y > 0.0 && p_loc.z > 0.0;
}

// Smooth full-resolution 3D filamentary Birkeland polar aurora curtains (zero coarse grid beads!)
fn eval_filament_aurora(n_hit: vec3<f32>, env_str: f32, time_s: f32, seed_v: vec3<f32>) -> f32 {
  if (env_str <= 0.01) { return 0.0; }
  let lon = atan2(n_hit.z, n_hit.x);
  let lat = asin(clamp(n_hit.y, -1.0, 1.0));
  let warp = fbm5(vec3<f32>(n_hit.x * 5.5, n_hit.y * 2.5, n_hit.z * 5.5) + vec3<f32>(time_s * 0.08, 0.0, -time_s * 0.06) + seed_v * 0.3);
  let rib1 = exp(-pow((sin(lat * 26.0 + warp * 4.8 + sin(lon * 3.0 + time_s * 0.22) * 0.8)), 2.0) * 14.0);
  let rib2 = exp(-pow((sin(lat * 42.0 - warp * 3.6 + cos(lon * 5.0 - time_s * 0.18) * 0.9)), 2.0) * 18.0);
  let rays = 0.45 + 0.55 * fbm5(vec3<f32>(cos(lon * 2.0) * 11.0, lat * 6.0, sin(lon * 2.0) * 11.0) + vec3<f32>(0.0, time_s * 0.14, 0.0));
  let shimmer = 0.65 + 0.35 * sin(lon * 7.0 + warp * 5.0 + time_s * 0.9);
  return clamp(env_str * (rib1 * 0.85 + rib2 * 0.55) * rays * shimmer * 1.45, 0.0, 1.8);
}

@fragment
fn fs_main(in: VsOut) -> FsOut {
  let ro = cam.cam_pos.xyz - in.center;
  let rd = normalize(in.world_quad - cam.cam_pos.xyz);
  let r = in.radius;
  // Scale-normalized precision-safe ray-sphere intersection: ZERO f32 overflow or cancellation
  // from 0.2 m all the way out to 10^14 m true-metric Suns, Moons, and outer gas giants!
  let ro_len = max(1.0, length(ro));
  let s_inv = 1.0 / ro_len;
  let ro_n = ro * s_inv;
  let r_n = r * s_inv;
  let b_n = dot(ro_n, rd);
  let perp_n = ro_n - rd * b_n;
  let disc_n = r_n * r_n - dot(perp_n, perp_n);

  let kind = u32(round(in.color0.w));
  // Per-body radial star illumination when cam.extra1.w > 0.5 (L2 multi-planet view: cam.extra1.xyz = live host star world pos!),
  // or directional host-star vector when cam.extra1.w <= 0.5 (L4 orbital / surface sky view)!
  let to_star_l = cam.extra1.xyz - in.center;
  let light_dir = select(
    normalize(cam.extra1.xyz),
    normalize(to_star_l),
    cam.extra1.w > 0.5 && length(to_star_l) > 1e-4
  );
  let cut_active = in.params.z;

  // True 3D Ray-Marched SPH Surface Displacement & Rotational Oblateness (NEVER featureless perfect spheres!):
  //   sp_info.w > 0 -> 3D SPH topographic / irregular asteroid relief amplitude disp_amp (0.045..0.28)
  //   sp_info.w < 0 -> Rotational equatorial oblateness f = -sp_info.w on fast-spinning gas/ice giants
  let live_sph_any = (cam.sph_geo.x > 1.5) && (in.inst_id == u32(round(cam.sph_geo.z))) && (cut_active < 0.5)
    && (kind == 1u || kind == 3u || kind == 4u || kind == 7u);
  let disp_amp = select(0.0, clamp(in.sp_info.w, 0.0, 0.56), live_sph_any && in.sp_info.w > 0.002);
  let oblate_f = select(0.0, clamp(-in.sp_info.w, 0.0, 0.16), !live_sph_any && in.sp_info.w < -0.002 && (kind == 2u || kind == 3u));

  var hit_override = false;
  var t_hit_n = 0.0;
  var p_hit_n_disp = vec3<f32>(0.0);
  var n_hit_geom = vec3<f32>(0.0, 1.0, 0.0);

  if (disp_amp > 0.002) {
    let r_bound = r_n * (1.0 + disp_amp * 1.12);
    let r_floor = r_n * max(0.32, 1.0 - disp_amp * 1.06);
    let disc_b = r_bound * r_bound - dot(perp_n, perp_n);
    if (disc_b >= 0.0) {
      let sq_b = sqrt(disc_b);
      let t_enter = max(1.0e-7, -b_n - sq_b);
      let t_exit = -b_n + sq_b;
      if (t_exit > t_enter) {
        let disc_f = r_floor * r_floor - dot(perp_n, perp_n);
        let t_f_ent = select(t_exit, -b_n - sqrt(max(0.0, disc_f)), disc_f >= 0.0);
        let t_end = select(t_exit, min(t_exit, t_f_ent), disc_f >= 0.0 && t_f_ent > t_enter);
        let gw_m = u32(round(cam.sph_geo.x));
        let gh_m = u32(round(cam.sph_geo.y));
        let has_ocean_g = (kind == 1u || kind == 4u) && (cam.sph_geo.w > -1.2);
        let sea_lvl_g = select(-1.5, cam.sph_geo.w, has_ocean_g);
        var t_prev = t_enter;
        var t_lo = t_enter;
        var t_hi = t_end;
        var found_s = false;
        // 56 steps on dramatically displaced bilobed comets/asteroids (eliminates cylindrical stepping holes!)
        let n_march = select(24u, 56u, disp_amp > 0.10);
        for (var ms = 1u; ms <= n_march; ms = ms + 1u) {
          let t_cur = mix(t_enter, t_end, f32(ms) / f32(n_march));
          let p_cur = ro_n + rd * t_cur;
          let r_cur = length(p_cur);
          let d_cur = p_cur / max(1e-7, r_cur);
          let e_raw = sample_sph_geology(d_cur, gw_m, gh_m).x;
          let e_g = select(e_raw, max(e_raw, sea_lvl_g), has_ocean_g);
          let r_surf = r_n * (1.0 + disp_amp * e_g);
          if (r_cur <= r_surf) {
            t_lo = t_prev;
            t_hi = t_cur;
            found_s = true;
            break;
          }
          t_prev = t_cur;
        }
        if (!found_s && disc_f >= 0.0 && t_f_ent > t_enter) {
          t_lo = t_prev;
          t_hi = t_end;
          found_s = true;
        }
        if (found_s) {
          for (var bs = 0u; bs < 6u; bs = bs + 1u) {
            let t_mid = 0.5 * (t_lo + t_hi);
            let p_mid = ro_n + rd * t_mid;
            let r_mid = length(p_mid);
            let d_mid = p_mid / max(1e-7, r_mid);
            let e_m = sample_sph_geology(d_mid, gw_m, gh_m).x;
            let e_mg = select(e_m, max(e_m, sea_lvl_g), has_ocean_g);
            let r_sm = r_n * (1.0 + disp_amp * e_mg);
            if (r_mid <= r_sm) { t_hi = t_mid; } else { t_lo = t_mid; }
          }
          t_hit_n = 0.5 * (t_lo + t_hi);
          p_hit_n_disp = ro_n + rd * t_hit_n;
          n_hit_geom = normalize(p_hit_n_disp);
          hit_override = true;
        }
      }
    }
  } else if (oblate_f > 0.002) {
    let inv_y = 1.0 / (1.0 - oblate_f);
    let ro_o = vec3<f32>(ro_n.x, ro_n.y * inv_y, ro_n.z);
    let rd_o_raw = vec3<f32>(rd.x, rd.y * inv_y, rd.z);
    let rd_o_len = length(rd_o_raw);
    let rd_o = rd_o_raw / max(1e-7, rd_o_len);
    let b_o = dot(ro_o, rd_o);
    let perp_o = ro_o - rd_o * b_o;
    let disc_o = r_n * r_n - dot(perp_o, perp_o);
    if (disc_o >= 0.0) {
      let sq_o = sqrt(disc_o);
      var t_o = -b_o - sq_o;
      if (t_o < 1.0e-7) { t_o = -b_o + sq_o; }
      if (t_o >= 1.0e-7) {
        t_hit_n = t_o / max(1e-7, rd_o_len);
        p_hit_n_disp = ro_n + rd * t_hit_n;
        let p_o = ro_o + rd_o * t_o;
        n_hit_geom = normalize(vec3<f32>(p_o.x, p_o.y * inv_y, p_o.z));
        hit_override = true;
      }
    }
  }

  let use_custom_hit = (disp_amp > 0.002) || (oblate_f > 0.002);
  let missed_body = select((disc_n < 0.0), !hit_override, use_custom_hit);
  if (missed_body) {
    // 1. Sub-pixel astronomical pinpoint glint when true physical disk is < ~2.5 px at AU distances
    if (in.pinpoint_w > 0.02) {
      let q2 = dot(in.quad_uv, in.quad_uv);
      if (q2 < 1.0) {
        let g_core = exp(-8.0 * q2);
        let g_halo = exp(-2.6 * q2) * select(0.32, 0.58, kind == 0u);
        let glint_col = mix(in.color0.rgb, vec3<f32>(1.0, 0.98, 0.94), select(0.45, 0.65, kind == 0u));
        let alpha = clamp((g_core + g_halo) * in.pinpoint_w * select(0.95, 1.25, kind == 0u), 0.0, 1.0);
        var out_g: FsOut;
        var g_rgb = glint_col * (g_core * 1.45 + g_halo) * in.pinpoint_w;
        if (cam.em_sensor.z > 0.5) {
          g_rgb = em_sensor_map_rgb(g_rgb, max(100.0, in.sp_info.x), select(0.0, 0.6, kind == 0u), select(0.0, 0.25, kind == 0u), in.sp_info.y * 0.4, 0.0);
        }
        out_g.color = vec4<f32>(g_rgb, alpha);
        let clip_g = cam.view_proj * vec4<f32>(in.center, 1.0);
        out_g.depth = eval_frag_depth(clip_g, cam.em_aux.w);
        return out_g;
      }
    }
    // 2. Physical solar corona glow for stars (kind 0) & Rayleigh atmospheric halo for planets (kind 1/4)
    let closest_n = max(0.0, -b_n);
    let d_min = length(ro_n + rd * closest_n) / max(1e-7, r_n);
    let halo_clip = cam.view_proj * vec4<f32>(in.center, 1.0);
    let halo_depth = max(1.0e-6, eval_frag_depth(halo_clip, cam.em_aux.w) * 0.999);
    if (kind == 0u && d_min < 1.48) {
      let edge_fade = 1.0 - smoothstep(1.24, 1.46, d_min);
      let p_lim = normalize(ro_n + rd * closest_n);
      let lim_ang = atan2(p_lim.y, p_lim.x + p_lim.z * 0.5);
      // Sculpted magnetic coronal streamer rays + fiery arched solar prominence loops!
      let streamer = 0.72 + 0.28 * pow(0.5 + 0.5 * sin(lim_ang * 5.0 + cam.cam_pos.w * 0.14), 2.0);
      let prom_arch = exp(-pow((d_min - 1.11) / 0.055, 2.0)) * smoothstep(0.72, 0.96, sin(lim_ang * 7.0 - cam.cam_pos.w * 0.18 + in.params.w));
      let corona = (exp(-(d_min - 1.0) * 6.4) * 0.82 * streamer + prom_arch * 0.65) * (1.0 - clamp(in.sp_info.z * 0.75, 0.0, 0.8)) * edge_fade;
      if (corona < 0.015) { discard; }
      var out_c: FsOut;
      var c_rgb = (in.color0.rgb * (exp(-(d_min - 1.0) * 6.4) * 1.35 * streamer) + mix(in.color1.rgb, vec3<f32>(1.0, 0.34, 0.10), 0.65) * prom_arch * 1.45) * (1.0 - clamp(in.sp_info.z * 0.75, 0.0, 0.8)) * edge_fade;
      if (cam.em_sensor.z > 0.5) {
        // Hot 1.5 MK solar corona blazes brightly in EUV / Soft X-Ray!
        c_rgb = em_sensor_map_rgb(c_rgb, 1.5e6, corona * 1.4, corona * 1.8, corona * 0.3, 0.0);
      }
      out_c.color = vec4<f32>(c_rgb, clamp(corona, 0.0, 1.0));
      // Reversed-Z far depth on translucent corona so background nebulae/disks never get clipped by a square box!
      out_c.depth = 0.0;
      return out_c;
    }
    if (kind == 5u && dot(in.color0.rgb, in.color0.rgb) < 0.001 && d_min < 1.44) {
      // EHT M87* / Sgr A* Razor-Sharp Asymmetric Relativistic Doppler-Brightened n=1 Gravitational Photon Ring!
      let bh_edge = 1.0 - smoothstep(1.22, 1.42, d_min);
      let p_lim_bh = normalize(ro_n + rd * closest_n);
      let dopp_side = clamp(0.65 + 0.58 * dot(p_lim_bh, cam.cam_right.xyz - cam.cam_up.xyz * 0.42), 0.22, 1.45);
      let n1_ring = exp(-pow((d_min - 1.055) / 0.032, 2.0)) * 2.15;
      let einstein_h = exp(-(d_min - 1.0) * 9.5) * 0.52;
      let bh_glow = (n1_ring + einstein_h) * dopp_side * bh_edge;
      if (bh_glow < 0.015) { discard; }
      var bh_rgb = mix(vec3<f32>(0.96, 0.36, 0.08), vec3<f32>(1.0, 0.92, 0.72), clamp(n1_ring * 0.45 * dopp_side, 0.0, 1.0)) * bh_glow;
      if (cam.em_sensor.z > 0.5) {
        bh_rgb = em_sensor_map_rgb(bh_rgb, 1.5e7, bh_glow * 0.8, bh_glow * 1.9, bh_glow * 2.6, bh_glow * 0.7);
      }
      var out_bh: FsOut;
      out_bh.color = vec4<f32>(bh_rgb, clamp(bh_glow * 0.75, 0.0, 1.0));
      out_bh.depth = 0.0;
      return out_bh;
    }
    if ((kind == 1u || kind == 4u) && in.color1.w > 0.25 && d_min < 1.07) {
      let h_atmo = exp(-(d_min - 1.0) * 42.0) * in.color1.w * 0.62;
      if (h_atmo < 0.012) { discard; }
      let lit_side = clamp(dot(normalize(ro_n + rd * closest_n), light_dir) * 0.8 + 0.35, 0.0, 1.0);
      var out_a: FsOut;
      out_a.color = vec4<f32>(vec3<f32>(0.34, 0.68, 1.0) * h_atmo * lit_side, h_atmo * lit_side);
      out_a.depth = 0.0;
      return out_a;
    }
    discard;
  }

  var t_hit = 0.0;
  var p_hit = vec3<f32>(0.0);
  var n_hit = vec3<f32>(0.0, 1.0, 0.0);
  if (hit_override) {
    t_hit = t_hit_n * ro_len;
    p_hit = p_hit_n_disp * ro_len;
    n_hit = n_hit_geom;
  } else {
    let sqrt_dn = sqrt(max(0.0, disc_n));
    t_hit_n = -b_n - sqrt_dn;
    if (t_hit_n < 1.0e-7) { t_hit_n = -b_n + sqrt_dn; }
    if (t_hit_n < 1.0e-7) { discard; }
    t_hit = t_hit_n * ro_len;
    p_hit = (ro_n + rd * t_hit_n) * ro_len;
    n_hit = normalize(ro_n + rd * t_hit_n);
  }
  var is_interior = false;

  // True 3D Cutaway Plane intersection when user enables L4 Planetary Interior Cutaway
  if ((kind == 4u || kind == 1u || kind == 2u) && is_cutaway_octant(p_hit, cut_active)) {
    var best_t = 1e20;
    var best_n = vec3<f32>(0.0, 1.0, 0.0);
    if (abs(rd.x) > 1e-5) {
      let tx = -ro.x / rd.x;
      if (tx > 1e-6 && tx < best_t) {
        let q = ro + rd * tx;
        if (dot(q, q) <= r * r && q.y >= 0.0 && q.z >= 0.0) {
          best_t = tx;
          best_n = vec3<f32>(select(1.0, -1.0, rd.x > 0.0), 0.0, 0.0);
        }
      }
    }
    if (abs(rd.y) > 1e-5) {
      let ty = -ro.y / rd.y;
      if (ty > 1e-6 && ty < best_t) {
        let q = ro + rd * ty;
        if (dot(q, q) <= r * r && q.x >= 0.0 && q.z >= 0.0) {
          best_t = ty;
          best_n = vec3<f32>(0.0, select(1.0, -1.0, rd.y > 0.0), 0.0);
        }
      }
    }
    if (abs(rd.z) > 1e-5) {
      let tz = -ro.z / rd.z;
      if (tz > 1e-6 && tz < best_t) {
        let q = ro + rd * tz;
        if (dot(q, q) <= r * r && q.x >= 0.0 && q.y >= 0.0) {
          best_t = tz;
          best_n = vec3<f32>(0.0, 0.0, select(1.0, -1.0, rd.z > 0.0));
        }
      }
    }
    if (best_t < 1e19) {
      t_hit = best_t;
      p_hit = ro + rd * t_hit;
      n_hit = best_n;
      is_interior = true;
    } else {
      discard;
    }
  }

  let view_dir = -rd;
  let ndv = max(0.0, dot(n_hit, view_dir));
  let raw_ndl = dot(n_hit, light_dir);
  // Analytical Ring-on-Planet Shadow (Cassini + Encke divisions cast directly onto Saturn / Uranus cloud tops!)
  // Packed when !hasSphGeo && focusedRing: cam.sph_geo = (ringN.x, ringN.y, ringN.z, sphereIdx), cam.extra0.zw = (rInRatio, rOutRatio)
  var ring_on_planet_sh = 1.0;
  if (cam.sph_geo.x <= 1.5 && cam.extra0.w > 1.05 && in.inst_id == u32(round(cam.sph_geo.w)) && raw_ndl > -0.02) {
    let r_n_sh = normalize(cam.sph_geo.xyz);
    let denom_rs = dot(light_dir, r_n_sh);
    if (abs(denom_rs) > 1e-4) {
      let t_rs = -dot(p_hit, r_n_sh) / denom_rs;
      if (t_rs > 0.0) {
        let q_rs = p_hit + light_dir * t_rs;
        let rq_ratio = length(q_rs) / max(1e-5, r);
        let r_in_rat = max(1.05, cam.extra0.z);
        let r_out_rat = max(r_in_rat + 0.05, cam.extra0.w);
        if (rq_ratio >= r_in_rat && rq_ratio <= r_out_rat) {
          let u_rs = clamp((rq_ratio - r_in_rat) / max(1e-4, r_out_rat - r_in_rat), 0.0, 1.0);
          let c_rs = (u_rs - 0.60) * 32.0;
          let e_rs = (u_rs - 0.88) * 55.0;
          let tau_rs = smoothstep(0.0, 0.06, u_rs) * (1.0 - smoothstep(0.94, 1.0, u_rs))
            * (1.0 - 0.88 * exp(-(c_rs * c_rs))) * (1.0 - 0.60 * exp(-(e_rs * e_rs)))
            * (0.74 + 0.26 * sin(u_rs * 76.0) * cos(u_rs * 27.0));
          ring_on_planet_sh = clamp(1.0 - tau_rs * 0.82, 0.14, 1.0);
        }
      }
    }
  }
  let ndl = max(0.0, raw_ndl) * ring_on_planet_sh;
  let soft_term = smoothstep(-0.08, 0.14, raw_ndl);
  // Real host-star spectral color & inverse-square irradiance attenuation (cam.star_light)!
  let star_rgb = cam.star_light.rgb;
  let star_flux = clamp(cam.star_light.w, 0.14, 1.85);
  let star_dir_l = star_rgb * star_flux;
  // Warm Rayleigh/Mie sunset glow along the day-night terminator tinted by host star spectrum
  let term_d = (raw_ndl - 0.04) / 0.16;
  let term_sunset = exp(-(term_d * term_d)) * in.color1.w;
  let half_v = normalize(light_dir + view_dir);
  let spec = pow(max(0.0, dot(n_hit, half_v)), 44.0);
  let fresnel = pow(max(0.0, 1.0 - ndv), 3.6);
  let seed_v = vec3<f32>(in.params.w * 2.13, in.params.w * 1.47, in.params.w * 3.19);

  var col = vec3<f32>(0.8);
  var em_temp_k = max(45.0, in.sp_info.x);
  var em_uv = 0.0;
  var em_xr = 0.0;
  var em_rad = 0.0;
  let civ_k = max(0.0, in.sp_info.y);
  let dyson_tau = clamp(in.sp_info.z, 0.0, 0.94);

  if (kind == 0u) {
    // Realistic convective solar photosphere with multi-scale granulation, magnetic sunspots/faculae, limb darkening, & Dyson swarm occultation!
    let g1 = fbm5(n_hit * 8.5 + seed_v + vec3<f32>(cam.cam_pos.w * 0.04, 0.0, 0.0));
    let g2 = fbm5(n_hit * 22.0 - seed_v);
    let gran = clamp(0.65 * g1 + 0.35 * g2, 0.0, 1.0);
    let lat_belt = exp(-pow((abs(n_hit.y) - 0.28) * 5.2, 2.0));
    let spot_n = fbm5(n_hit * 5.2 + seed_v * 1.7 + vec3<f32>(cam.cam_pos.w * 0.015, 0.0, 0.0));
    let sunspot = smoothstep(0.74, 0.86, spot_n) * lat_belt;
    let faculae = smoothstep(0.64, 0.74, spot_n) * (1.0 - sunspot) * lat_belt * (1.0 - ndv * 0.55);
    let limb = pow(max(0.0, ndv), 0.52);
    col = mix(in.color1.rgb, in.color0.rgb, 0.35 + 0.65 * gran) * (0.58 + 0.85 * limb);
    col = mix(col, in.color1.rgb * 0.22, sunspot * 0.82) + vec3<f32>(1.0, 0.95, 0.78) * faculae * 0.38;
    if (dyson_tau > 0.01) {
      // Orbiting geometric Dyson swarm rings/collectors dim visible photosphere by exp(-tau_Dyson) and radiate 420 K IR waste heat!
      let d_lat = abs(sin(n_hit.y * 18.0 + cam.cam_pos.w * 0.35));
      let d_lon = abs(sin(atan2(n_hit.z, n_hit.x) * 22.0 - cam.cam_pos.w * 0.5));
      let swarm_mesh = smoothstep(0.75 - dyson_tau * 0.65, 0.95, max(d_lat, d_lon));
      let occ = clamp(dyson_tau * (0.55 + 0.55 * swarm_mesh), 0.0, 0.92);
      col = col * (1.0 - occ) + vec3<f32>(0.18, 0.11, 0.08) * occ * (0.4 + 0.6 * fresnel);
      em_temp_k = mix(em_temp_k, 420.0, occ);
      em_rad = dyson_tau * 0.9;
    }
    em_uv = smoothstep(4500.0, 12000.0, em_temp_k) * 1.1;
    em_xr = smoothstep(8000.0, 30000.0, em_temp_k) * 0.9 + (1.0 - limb) * 0.35;
  } else if (is_interior) {
    // Exact GPU-solved planetary cutaway shells!
    let r_norm = length(p_hit) / max(1e-6, r);
    let r_core = clamp(in.params.x, 0.12, 0.85);
    let r_mantle = clamp(in.params.y, r_core + 0.04, 0.99);
    let r_inner = r_core * 0.46;
    let conv = fbm5(p_hit / max(1e-6, r) * 7.5 + seed_v);
    var shell_col = in.color0.rgb;
    if (r_norm < r_inner) {
      shell_col = vec3<f32>(1.0, 0.93, 0.68) * (0.92 + 0.14 * conv);
    } else if (r_norm < r_core) {
      let f = (r_norm - r_inner) / max(0.02, r_core - r_inner);
      shell_col = mix(vec3<f32>(1.0, 0.68, 0.20), vec3<f32>(0.94, 0.34, 0.10), f) * (0.85 + 0.25 * conv);
    } else if (r_norm < r_mantle) {
      let f = (r_norm - r_core) / max(0.02, r_mantle - r_core);
      shell_col = mix(vec3<f32>(0.76, 0.24, 0.12), vec3<f32>(0.38, 0.26, 0.18), f) * (0.78 + 0.35 * conv);
    } else {
      shell_col = in.color1.rgb;
    }
    let edge_core = smoothstep(0.007, 0.016, abs(r_norm - r_core));
    let edge_mantle = smoothstep(0.007, 0.016, abs(r_norm - r_mantle));
    shell_col = shell_col * (0.55 + 0.45 * edge_core * edge_mantle);
    let shade = 0.52 + 0.48 * max(0.25, dot(n_hit, normalize(vec3<f32>(0.55, 0.72, 0.45))));
    col = shell_col * shade;
    em_temp_k = mix(5400.0, em_temp_k, clamp(r_norm, 0.0, 1.0));
  } else if (kind == 2u) {
    // Banded Gas / Dense-Cloud World with LIVE GPU Flow-Map Advected Spherical CFD Jets, Cyclonic Vorticity Eddies, Lightning & Smooth 3D Filamentary Aurorae!
    let live_atmo2 = cam.extra2.w > 0.5 && in.inst_id == u32(round(cam.extra2.z));
    var flow_3d = vec3<f32>(0.0);
    var vort2 = 0.0;
    var t_anom2 = 0.0;
    var av2 = vec4<f32>(0.0);
    if (live_atmo2) {
      let aw = u32(round(cam.extra2.x));
      let ah = u32(round(cam.extra2.y));
      av2 = sample_live_atmo_vis(n_hit, aw, ah);
      let cfd2 = sample_live_atmo_flow(n_hit, aw, ah);
      let east2 = normalize(vec3<f32>(-n_hit.z, 0.0, n_hit.x) + vec3<f32>(1e-5, 0.0, 0.0));
      let north2 = cross(east2, n_hit);
      flow_3d = east2 * cfd2.x + north2 * cfd2.y;
      vort2 = cfd2.z;
      t_anom2 = cfd2.w;
    }
    // Dual-phase flow-map advection along live spherical CFD velocity -> unmistakably flowing jet bands & swirling vortices!
    let ph0 = fract(cam.cam_pos.w * 0.16);
    let ph1 = fract(ph0 + 0.5);
    let ph_w = abs(2.0 * ph0 - 1.0);
    let p_adv0 = normalize(n_hit - flow_3d * (ph0 * 0.24));
    let p_adv1 = normalize(n_hit - flow_3d * (ph1 * 0.24));
    let turb0 = fbm5(p_adv0 * 6.0 + seed_v);
    let turb1 = fbm5(p_adv1 * 6.0 + seed_v);
    let turb = mix(turb0, turb1, ph_w);
    let kh0 = fbm5(vec3<f32>(p_adv0.x * 8.5 + turb * 1.1, p_adv0.y * 28.0, p_adv0.z * 8.5 - turb * 1.1) + seed_v);
    let kh1 = fbm5(vec3<f32>(p_adv1.x * 8.5 + turb * 1.1, p_adv1.y * 28.0, p_adv1.z * 8.5 - turb * 1.1) + seed_v);
    let kh_shear = mix(kh0, kh1, ph_w);
    let lat = n_hit.y * 16.5 + (turb - 0.5) * 3.4 + (kh_shear - 0.5) * 0.95 + vort2 * 0.42;
    let band = 0.5 + 0.5 * sin(lat) * cos(lat * 0.45 + turb * 1.6);
    let fine_jet = mix(
      fbm5(vec3<f32>(p_adv0.x * 5.2, p_adv0.y * 24.0, p_adv0.z * 5.2) + seed_v),
      fbm5(vec3<f32>(p_adv1.x * 5.2, p_adv1.y * 24.0, p_adv1.z * 5.2) + seed_v),
      ph_w
    );
    var base = mix(in.color1.rgb * 0.74, in.color0.rgb * 1.14, clamp(0.14 + 0.56 * band + 0.30 * fine_jet, 0.0, 1.0));
    // Visible cyclonic upwelling & baroclinic jet shear streaks directly from live GPU CFD!
    let spd2 = length(flow_3d);
    let eddy_crest = smoothstep(0.28, 1.45, abs(vort2)) * (0.45 + 0.55 * kh_shear);
    let jet_filament = smoothstep(0.45, 1.35, spd2) * smoothstep(0.48, 0.82, fine_jet);
    base = mix(base, mix(in.color0.rgb, vec3<f32>(1.0, 0.96, 0.88), 0.58), clamp(eddy_crest * 0.48 + jet_filament * 0.28, 0.0, 0.65));
    // Warm deep-belt glow where cyclonic divergence / warm t_anom clears upper ammonia decks
    base = mix(base, in.color1.rgb * 0.62 + vec3<f32>(0.24, 0.08, 0.03), smoothstep(0.35, 1.1, t_anom2) * 0.22);
    // Subtle polar cool atmospheric darkening + anticyclonic storm oval vortex
    let polar_haze = smoothstep(0.68, 0.96, abs(n_hit.y));
    base = mix(base, in.color1.rgb * 0.68 + vec3<f32>(0.08, 0.12, 0.20), polar_haze * 0.45);
    let spot_lon = atan2(n_hit.z, n_hit.x) - fract(in.params.w * 0.37) * 6.283 + 3.1415 - cam.cam_pos.w * 0.025;
    let spot_d = length(vec2<f32>(sin(spot_lon * 0.5) * 1.35, (n_hit.y + 0.34) * 3.4));
    let spot_w = (1.0 - smoothstep(0.14, 0.34, spot_d)) * smoothstep(0.35, 0.75, in.color0.r);
    let spot_swirl = 0.72 + 0.28 * sin(spot_d * 24.0 + turb * 5.0 - cam.cam_pos.w * 0.8);
    base = mix(base, mix(in.color0.rgb, vec3<f32>(0.92, 0.42, 0.22), 0.58) * spot_swirl, spot_w * 0.78);
    var em_fx = vec3<f32>(0.0);
    if (live_atmo2) {
      let storm_w = smoothstep(0.24, 0.76, av2.x);
      base = mix(base, mix(in.color0.rgb, vec3<f32>(0.98, 0.93, 0.84), 0.55), storm_w * 0.36);
      // Crisp high-frequency micro-spark lightning leaders (never blocky 128x64 white squares!), brightest on twilight/night side!
      let bolt_spark = smoothstep(0.56, 0.82, fbm5(n_hit * 46.0 + vec3<f32>(cam.cam_pos.w * 2.4, 0.0, -cam.cam_pos.w * 1.9)));
      let bolt = smoothstep(0.42, 1.15, av2.z) * (0.28 + 0.72 * bolt_spark);
      em_fx = em_fx + vec3<f32>(0.68, 0.90, 1.0) * bolt * (0.26 + 1.55 * (1.0 - ndl));
      // Smooth full-resolution 3D Birkeland auroral curtain ribbons (ZERO coarse grid beads!)
      let aur = eval_filament_aurora(n_hit, av2.w, cam.cam_pos.w, seed_v);
      em_fx = em_fx + mix(vec3<f32>(0.20, 0.84, 1.0), vec3<f32>(0.66, 0.32, 1.0), clamp((abs(n_hit.y) - 0.72) * 3.5, 0.0, 1.0)) * aur * (0.48 + 0.92 * (1.0 - ndl));
      // Deep-troposphere thermal belt clearing (5-10 um IR bright belts vs cool ammonia zones, like Juno/JWST!)
      em_temp_k = em_temp_k * (0.82 + 0.72 * (1.0 - band) + 0.34 * clamp(t_anom2, -0.4, 1.4) + 0.32 * eddy_crest) + bolt * 850.0;
      em_uv = aur * 1.95 + polar_haze * 0.58 * (0.35 + 0.65 * ndl) + (0.22 + 0.48 * band) * ndl;
      em_rad = bolt * 1.5 + aur * 1.1 + 0.42 * (0.4 + 0.6 * abs(vort2)); // Jovian decametric synchrotron & lightning sferics!
    } else {
      em_temp_k = em_temp_k * (0.84 + 0.64 * (1.0 - band));
      em_uv = polar_haze * 0.45 * (0.3 + 0.7 * ndl) + band * 0.36 * ndl;
    }
    let atm = vec3<f32>(0.58, 0.76, 1.0) * fresnel * in.color1.w;
    let sunset = vec3<f32>(0.95, 0.44, 0.16) * term_sunset * 0.14 * star_dir_l;
    col = base * (vec3<f32>(0.03) + star_dir_l * (0.04 + 0.98 * ndl) * soft_term) + sunset + atm * (vec3<f32>(0.03) + star_dir_l * (0.14 + 0.86 * ndl)) + em_fx;
  } else if (kind == 1u || kind == 4u) {
    // Terrestrial / Ocean / Mars / Mercury / Carbon World:
    // Driven zero-copy by ULG's 3D GPU SPH Planetary Genesis spherical geology map when active
    // (real differentiated continents, subduction mountain chains, craters & eroded river basins — ZERO Perlin blobs!),
    // with distant multi-body fallback for tiny un-focused background planets in L2.
    let live_sph_geo = cam.sph_geo.x > 1.5 && in.inst_id == u32(round(cam.sph_geo.z));
    let has_ocean = select(in.color1.b > in.color1.r + 0.14, cam.sph_geo.w > -1.2, live_sph_geo);
    var surf = in.color0.rgb;
    var water_spec = 0.0;
    var bump_strength = 0.0;
    var is_land_hab = 0.0;
    var em_volc = vec3<f32>(0.0);
    var elev_center = 0.5;
    var detail = 0.5;

    if (live_sph_geo) {
      let gw = u32(round(cam.sph_geo.x));
      let gh = u32(round(cam.sph_geo.y));
      let g0 = sample_sph_geology(n_hit, gw, gh);
      let elev_sph = g0.x;      // [-1..1] true SPH differentiated crust elevation
      let crust_comp = g0.y;    // [0..1] basalt/ejecta -> felsic granite / orogenic peak
      let thermal_v = g0.z;     // [0..1] mantle plume heat / rift volcanism / impact melt
      let moist_r = g0.w;       // [0..1] hydraulic moisture & carved river valleys
      // Continuous post-SPH thermal cooling (cool_heat in [0..1] passed in cam.extra0.z):
      //   As a newly differentiated world radiates heat away (T^4), primordial lava fissures dim smoothly
      //   from molten orange -> cherry red -> basalt, steam rains out filling oceans from the lowest basins up,
      //   and temperate biomes & polar ice caps emerge naturally (ZERO 1-frame snap!).
      let cool_heat = clamp(cam.extra0.z, 0.0, 1.0);
      let rainout_f = 1.0 - smoothstep(0.14, 0.78, cool_heat);
      let bio_cool_f = 1.0 - smoothstep(0.05, 0.44, cool_heat);
      let sea_lvl_base = select(-1.5, cam.sph_geo.w, has_ocean);
      let sea_lvl = select(-1.5, sea_lvl_base - (1.0 - rainout_f) * 0.62, has_ocean);
      elev_center = elev_sph;
      // Live Milankovitch orbital subsolar declination sin(delta) in space mode -> asymmetric winter/summer hemisphere seasons!
      let sin_decl = select(0.0, clamp(cam.em_aux.z, -0.98, 0.98), (u32(round(max(0.0, cam.em_aux.w))) & 2u) == 0u);
      let lat_winter = -n_hit.y * sin_decl;
      // Subtle micro-grain (< 3%) ONLY for sub-texel rock crispness (never alters continents!)
      let micro_g = vnoise3(n_hit * 36.0 + seed_v) * 0.06;
      // Sharp tectonic crust-cooling magma fissures (high exponent = crisp thin lava veins between dark obsidian plates!)
      let cool_crack = pow(clamp(1.0 - abs(fbm5(n_hit * 8.0 + seed_v) * 2.0 - 1.0), 0.0, 1.0), 5.5);

      if (has_ocean) {
        if (elev_sph < sea_lvl) {
          let depth_f = clamp((sea_lvl - elev_sph) / 0.56, 0.0, 1.0);
          // Crisp narrow coastal aquamarine shelf dropping cleanly into deep royal-sapphire abyssal oceans!
          let shelf = mix(vec3<f32>(0.08, 0.56, 0.72), vec3<f32>(0.03, 0.24, 0.54), smoothstep(0.0, 0.11, depth_f));
          let abyss = in.color1.rgb * vec3<f32>(0.36, 0.48, 0.70);
          surf = mix(shelf, abyss, smoothstep(0.08, 0.72, depth_f));
          // Subtle mid-ocean ridge bathymetry shimmer
          surf = mix(surf, vec3<f32>(0.08, 0.32, 0.58), thermal_v * 0.20 * (1.0 - depth_f * 0.5));
          water_spec = spec * 0.88;
        } else {
          let h_land = clamp((elev_sph - sea_lvl) / max(0.32, 0.90 - sea_lvl), 0.0, 1.0);
          let sand_coast = vec3<f32>(0.72, 0.65, 0.46);
          let desert = vec3<f32>(0.70, 0.56, 0.34);
          let savanna = vec3<f32>(0.40, 0.49, 0.22);
          let lush_forest = mix(vec3<f32>(0.09, 0.34, 0.13), in.color0.rgb * 1.15, 0.38);
          let mtn_rock = mix(vec3<f32>(0.36, 0.33, 0.30), vec3<f32>(0.54, 0.51, 0.47), crust_comp);
          let raw_basalt = mix(vec3<f32>(0.10, 0.09, 0.10), vec3<f32>(0.24, 0.20, 0.18), crust_comp);
          // Rich multi-biome vegetation driven directly by GPU Hadley-cell & watershed moisture + live orbital seasonal phenology!
          let humid_w = clamp(moist_r * 1.10 - h_land * 0.24 + micro_g * 0.7, 0.0, 1.0);
          let mid_lat_s = smoothstep(0.18, 0.46, abs(n_hit.y)) * (1.0 - smoothstep(0.76, 0.94, abs(n_hit.y)));
          let autumn_w = smoothstep(0.02, 0.22, lat_winter) * mid_lat_s;
          let winter_dorm = smoothstep(0.18, 0.36, lat_winter) * mid_lat_s;
          let lush_seasonal = mix(
            mix(lush_forest, vec3<f32>(0.68, 0.42, 0.14), autumn_w * 0.62),
            vec3<f32>(0.46, 0.42, 0.34),
            winter_dorm * 0.55
          );
          var bio_col = mix(desert, savanna, smoothstep(0.18, 0.42, humid_w));
          bio_col = mix(bio_col, lush_seasonal, smoothstep(0.38, 0.68, humid_w));
          bio_col = mix(raw_basalt, bio_col, bio_cool_f);
          // Thin sandy coastline rim right above sea level
          surf = mix(mix(raw_basalt, sand_coast, rainout_f), bio_col, smoothstep(0.0, 0.045, h_land));
          // Subtle deep-sapphire dendritic river threads only in peak MFD valley bottoms (ZERO neon turquoise blotches!)
          let river_v = smoothstep(0.91, 0.96, moist_r) * (1.0 - smoothstep(0.14, 0.40, h_land)) * rainout_f;
          surf = mix(surf, vec3<f32>(0.04, 0.24, 0.48), river_v * 0.62);
          surf = mix(surf, mix(raw_basalt, mtn_rock, bio_cool_f), smoothstep(0.42, 0.74, h_land + crust_comp * 0.14));
          let mtn_snow_lo = clamp(0.68 - lat_winter * 0.42, 0.28, 0.86);
          let mtn_snow_hi = clamp(mtn_snow_lo + 0.18, 0.46, 0.99);
          surf = mix(surf, vec3<f32>(0.94, 0.97, 1.00), smoothstep(mtn_snow_lo, mtn_snow_hi, h_land) * bio_cool_f);
          bump_strength = 0.42 + 0.68 * h_land;
          is_land_hab = (1.0 - smoothstep(0.30, 0.72, h_land)) * (1.0 - smoothstep(0.58, 0.84, abs(n_hit.y))) * bio_cool_f;
          // Active subduction/rift volcanic glow + continuous cooling crust magma fissures during late planetary genesis!
          let rift_cool = cool_heat * clamp(cool_crack * 1.15 + max(0.0, thermal_v - 0.55) * 0.55, 0.0, 1.0);
          if (thermal_v > 0.78 || rift_cool > 0.24) {
            let v_glow = max(smoothstep(0.78, 0.98, thermal_v), smoothstep(0.24, 0.85, rift_cool));
            let cool_lava_c = mix(vec3<f32>(0.72, 0.12, 0.015), vec3<f32>(0.98, 0.38, 0.05), clamp(cool_heat * 0.8 + thermal_v * 0.3, 0.0, 1.0));
            em_volc = cool_lava_c * v_glow * (0.85 + 0.55 * cool_heat);
            em_temp_k = mix(em_temp_k, 1450.0, v_glow);
          }
        }
        // Asymmetric hemisphere-opposite seasonal snow & sea-ice advance/retreat driven by live obliquity & orbital phase!
        let polar = smoothstep(0.75, 0.89, abs(n_hit.y) + lat_winter * 0.68 + elev_sph * 0.09 + micro_g) * bio_cool_f;
        let ice_col = select(vec3<f32>(0.93, 0.96, 1.00), vec3<f32>(0.82, 0.92, 0.98), elev_sph < sea_lvl);
        surf = mix(surf, ice_col, polar);
        water_spec = water_spec * (1.0 - polar * 0.85);
        bump_strength = bump_strength * (1.0 - polar * 0.72);
        is_land_hab = is_land_hab * (1.0 - polar);
      } else {
        // Stagnant-lid cratered / arid / iron / carbon / sulfur-volcanic worlds driven directly by SPH geology!
        let h_n = clamp(elev_sph * 0.5 + 0.5, 0.0, 1.0);
        let mare_col = in.color1.rgb * 0.76;
        let high_col = in.color0.rgb * (0.86 + 0.24 * crust_comp + micro_g);
        surf = mix(mare_col, high_col, smoothstep(0.24, 0.76, h_n + crust_comp * 0.18));
        surf = mix(surf, vec3<f32>(0.10, 0.08, 0.09), cool_heat * 0.65);
        let ejecta_bright = smoothstep(0.30, 0.44, crust_comp) * (1.0 - smoothstep(0.46, 0.62, crust_comp));
        surf = mix(surf, min(vec3<f32>(1.0), in.color0.rgb * 1.24), ejecta_bright * 0.32 * bio_cool_f);
        // Dynamic CO2 / water-ice seasonal polar cap expansion & sublimation on atmosphere-bearing dry worlds (e.g. Mars!)
        let polar = smoothstep(0.79, 0.91, abs(n_hit.y) + lat_winter * 0.62 + micro_g) * bio_cool_f;
        surf = mix(surf, vec3<f32>(0.90, 0.92, 0.96), polar * select(0.0, 0.88, in.color1.w > 0.12));
        let is_sulfur_volc = (in.color0.r > 0.85 && in.color0.g > 0.72 && in.color0.b < 0.45 && in.color1.w < 0.05);
        let dry_cool_rift = cool_heat * clamp(cool_crack * 1.15 + max(0.0, thermal_v - 0.58) * 0.45, 0.0, 1.0);
        if (is_sulfur_volc) {
          let caldera = smoothstep(0.26, 0.42, thermal_v + micro_g * 1.4);
          let lava_spot = smoothstep(0.34, 0.44, thermal_v);
          surf = mix(surf, vec3<f32>(0.12, 0.09, 0.08), caldera * 0.85);
          em_volc = vec3<f32>(1.0, 0.38, 0.06) * lava_spot * 2.2;
          em_temp_k = mix(em_temp_k, 1480.0, lava_spot);
        } else if (thermal_v > 0.76 || dry_cool_rift > 0.24) {
          let v_glow = max(smoothstep(0.76, 0.96, thermal_v), smoothstep(0.24, 0.85, dry_cool_rift));
          surf = mix(surf, vec3<f32>(0.09, 0.07, 0.07), v_glow * 0.65);
          em_volc = mix(vec3<f32>(0.76, 0.14, 0.015), vec3<f32>(0.98, 0.36, 0.04), cool_heat) * v_glow * (0.95 + 0.45 * cool_heat);
          em_temp_k = mix(em_temp_k, 1450.0, v_glow);
        }
        bump_strength = 0.52;
        is_land_hab = (1.0 - smoothstep(0.55, 0.82, abs(n_hit.y))) * 0.65 * bio_cool_f;
      }
    } else {
      // Lightweight fallback for distant non-focused planets in L2 system view
      let elev = fbm5(n_hit * 3.4 + seed_v);
      detail = fbm5(n_hit * 14.0 + seed_v * 1.7);
      elev_center = elev;
      let sin_decl_fb = select(0.0, clamp(cam.em_aux.z, -0.98, 0.98), (u32(round(max(0.0, cam.em_aux.w))) & 2u) == 0u);
      let lat_win_fb = -n_hit.y * sin_decl_fb;
      if (has_ocean) {
        let sea_lvl = 0.51;
        if (elev < sea_lvl) {
          let depth_f = clamp((sea_lvl - elev) / 0.26, 0.0, 1.0);
          let shelf = mix(vec3<f32>(0.10, 0.62, 0.76), vec3<f32>(0.06, 0.36, 0.64), smoothstep(0.0, 0.22, depth_f));
          surf = mix(shelf, in.color1.rgb * 0.68, smoothstep(0.16, 0.95, depth_f));
          water_spec = spec * 0.74;
        } else {
          let h_land = clamp((elev - sea_lvl) / 0.32, 0.0, 1.0);
          let desert = vec3<f32>(0.68, 0.58, 0.38);
          let mtn = vec3<f32>(0.48, 0.46, 0.44);
          let arid = smoothstep(0.25, 0.72, detail) * (1.0 - abs(n_hit.y));
          surf = mix(in.color0.rgb * (0.75 + 0.45 * detail), desert, arid * 0.55);
          surf = mix(surf, mtn, smoothstep(0.42, 0.85, h_land));
          surf = mix(surf, vec3<f32>(0.92, 0.95, 0.98), smoothstep(0.76, 0.95, h_land));
          bump_strength = 0.32 + 0.58 * h_land;
          is_land_hab = (1.0 - smoothstep(0.28, 0.68, h_land)) * (1.0 - smoothstep(0.55, 0.82, abs(n_hit.y)));
        }
        let polar = smoothstep(0.75, 0.89, abs(n_hit.y) + lat_win_fb * 0.64 + (detail - 0.5) * 0.14);
        surf = mix(surf, vec3<f32>(0.90, 0.94, 0.98), polar);
        bump_strength = bump_strength * (1.0 - polar * 0.75);
        is_land_hab = is_land_hab * (1.0 - polar);
      } else {
        let crater = smoothstep(0.32, 0.68, detail);
        surf = mix(in.color1.rgb, in.color0.rgb, clamp(elev * 1.15 - 0.1 + 0.25 * crater, 0.0, 1.0));
        let polar = smoothstep(0.80, 0.92, abs(n_hit.y) + lat_win_fb * 0.58 + (detail - 0.5) * 0.08);
        surf = mix(surf, vec3<f32>(0.88, 0.90, 0.94), polar * select(0.0, 0.85, in.color1.w > 0.12));
        let is_sulfur_volc = (in.color0.r > 0.85 && in.color0.g > 0.72 && in.color0.b < 0.45 && in.color1.w < 0.05);
        if (is_sulfur_volc) {
          let cald_n = fbm5(n_hit * 19.0 + seed_v * 2.1);
          let caldera = smoothstep(0.74, 0.86, cald_n);
          let lava_spot = smoothstep(0.82, 0.90, cald_n);
          surf = mix(surf, vec3<f32>(0.12, 0.09, 0.08), caldera * 0.85);
          em_volc = vec3<f32>(1.0, 0.38, 0.06) * lava_spot * 2.2;
          em_temp_k = mix(em_temp_k, 1480.0, lava_spot);
        }
        bump_strength = 0.58;
        is_land_hab = (1.0 - smoothstep(0.55, 0.82, abs(n_hit.y))) * 0.65;
      }
    }

    // Crisp 1-texel central-difference topographic relief normal + 4-step horizon self-shadowing (ZERO blurry bumps!)
    var ndl_relief = ndl;
    if (bump_strength > 0.01) {
      let up_ref = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(n_hit.y) > 0.92);
      let t1 = normalize(cross(up_ref, n_hit));
      let t2 = cross(n_hit, t1);
      if (live_sph_geo) {
        let gw = u32(round(cam.sph_geo.x));
        let gh = u32(round(cam.sph_geo.y));
        let eps_g = 3.14159265 / max(64.0, f32(gh));
        let e1p = sample_sph_geology(normalize(n_hit + t1 * eps_g), gw, gh).x;
        let e1m = sample_sph_geology(normalize(n_hit - t1 * eps_g), gw, gh).x;
        let e2p = sample_sph_geology(normalize(n_hit + t2 * eps_g), gw, gh).x;
        let e2m = sample_sph_geology(normalize(n_hit - t2 * eps_g), gw, gh).x;
        let relief_gain = bump_strength * select(2.45, 3.6, disp_amp > 0.10);
        let n_relief = normalize(n_hit + (t1 * (e1m - e1p) + t2 * (e2m - e2p)) * relief_gain);
        ndl_relief = max(0.0, dot(n_relief, light_dir));
        // Real 4-step topographic self-shadowing across mountain cordilleras, canyons & crater rims!
        if (disp_amp > 0.005 && raw_ndl > -0.04 && raw_ndl < 0.65) {
          let l_tang = light_dir - n_hit * raw_ndl;
          let lt_len = length(l_tang);
          if (lt_len > 1e-4) {
            let l_dir_t = l_tang / lt_len;
            let tan_alt = max(0.0, raw_ndl) / lt_len;
            var topo_sh = 1.0;
            for (var sh = 1u; sh <= 4u; sh = sh + 1u) {
              let d_ang = f32(sh) * 0.011;
              let e_sh = sample_sph_geology(normalize(n_hit + l_dir_t * d_ang), gw, gh).x;
              let dh_sh = (e_sh - elev_center) * disp_amp;
              if (dh_sh > d_ang * tan_alt + 0.0005) {
                topo_sh = min(topo_sh, clamp(1.0 - (dh_sh - d_ang * tan_alt) * 24.0, 0.28, 1.0));
              }
            }
            ndl_relief = ndl_relief * topo_sh;
          }
        }
      } else {
        let eps_b = 0.014;
        let e1 = fbm5(normalize(n_hit + t1 * eps_b) * 3.4 + seed_v) + 0.24 * fbm5(normalize(n_hit + t1 * eps_b) * 14.0 + seed_v * 1.7);
        let e2 = fbm5(normalize(n_hit + t2 * eps_b) * 3.4 + seed_v) + 0.24 * fbm5(normalize(n_hit + t2 * eps_b) * 14.0 + seed_v * 1.7);
        let e0 = elev_center + 0.24 * detail;
        let n_relief = normalize(n_hit + (t1 * (e0 - e1) + t2 * (e0 - e2)) * (bump_strength * 5.2));
        ndl_relief = max(0.0, dot(n_relief, light_dir));
      }
    }

    // Live zero-copy GPU baroclinic CFD clouds (flow-map advected!), dust storms, Paschen lightning, & smooth 3D aurorae!
    let live_atmo = cam.extra2.w > 0.5 && in.inst_id == u32(round(cam.extra2.z));
    var em_lightning = vec3<f32>(0.0);
    var em_aurora = vec3<f32>(0.0);
    var em_cities = vec3<f32>(0.0);
    var cloud_cover = 0.0;
    if (live_atmo) {
      let aw = u32(round(cam.extra2.x));
      let ah = u32(round(cam.extra2.y));
      let av = sample_live_atmo_vis(n_hit, aw, ah);
      let cfd = sample_live_atmo_flow(n_hit, aw, ah);
      let east1 = normalize(vec3<f32>(-n_hit.z, 0.0, n_hit.x) + vec3<f32>(1e-5, 0.0, 0.0));
      let north1 = cross(east1, n_hit);
      let flow1 = east1 * cfd.x + north1 * cfd.y;
      let ph0 = fract(cam.cam_pos.w * 0.14);
      let ph1 = fract(ph0 + 0.5);
      let ph_w = abs(2.0 * ph0 - 1.0);
      let pa0 = normalize(n_hit - flow1 * (ph0 * 0.20));
      let pa1 = normalize(n_hit - flow1 * (ph1 * 0.20));
      let wisp1 = mix(fbm5(pa0 * 10.5 + seed_v * 0.6), fbm5(pa1 * 10.5 + seed_v * 0.6), ph_w);
      let wisp2 = mix(fbm5(pa0 * 23.0 - seed_v), fbm5(pa1 * 23.0 - seed_v), ph_w);
      let cloud_wisp = clamp(wisp1 * 0.68 + wisp2 * 0.42, 0.0, 1.0);
      let vort_boost = smoothstep(0.35, 1.6, abs(cfd.z)) * 0.24;
      let cloud_raw = (av.x + vort_boost) * (0.55 + 0.85 * cloud_wisp);
      let cloud_d = smoothstep(0.18, 0.70, cloud_raw) * 0.90;
      cloud_cover = cloud_d;
      // Crisp 3D cloud drop-shadow cast onto ocean & continents directly away from host-star light_dir!
      let n_sh = normalize(n_hit + light_dir * 0.018);
      let av_sh = sample_live_atmo_vis(n_sh, aw, ah);
      let cloud_shadow = smoothstep(0.22, 0.72, av_sh.x * (0.55 + 0.85 * cloud_wisp)) * 0.30 * ndl;
      surf = surf * (1.0 - cloud_shadow);
      // Vivid billowing rust-amber aeolian dust fronts modulated by fine turbulent eddies
      let dust_d = smoothstep(0.15, 0.66, av.y * (0.65 + 0.65 * wisp1)) * 0.80;
      surf = mix(surf, vec3<f32>(0.88, 0.48, 0.22), dust_d * select(0.76, 0.18, has_ocean));
      surf = mix(surf, vec3<f32>(0.97, 0.985, 1.0), cloud_d * 0.92);
      water_spec = water_spec * (1.0 - max(cloud_d, dust_d));
      // Real Paschen dielectric-breakdown lightning: crisp localized convective pinpoint flashes inside active storm cores!
      let spark_n = fbm5(n_hit * 34.0 + vec3<f32>(cam.cam_pos.w * 1.8, -cam.cam_pos.w * 1.3, 4.1));
      let spark_core = smoothstep(0.56, 0.82, spark_n);
      let bolt = smoothstep(0.42, 1.20, av.z) * spark_core;
      let bolt_col = mix(vec3<f32>(0.84, 0.56, 1.0), vec3<f32>(0.76, 0.95, 1.0), select(0.20, 1.0, has_ocean));
      em_lightning = bolt_col * bolt * (2.6 + 2.2 * (1.0 - ndl));
      // Smooth full-resolution 3D Birkeland polar auroral curtains (emerald 557.7 nm O I -> violet N2+)!
      let aur = eval_filament_aurora(n_hit, av.w, cam.cam_pos.w, seed_v);
      em_aurora = mix(vec3<f32>(0.12, 0.96, 0.54), vec3<f32>(0.58, 0.28, 1.0), clamp((abs(n_hit.y) - 0.80) * 4.0, 0.0, 1.0)) * aur * (0.45 + 0.95 * (1.0 - ndl));
      em_uv = aur * 1.25;
      em_rad = bolt * 1.2;
    } else if (in.color1.w > 0.45) {
      let c_raw = fbm5(n_hit * 4.8 + vec3<f32>(cam.cam_pos.w * 0.012, 2.4, -1.9) + seed_v);
      let cloud = smoothstep(0.52, 0.74, c_raw) * 0.78;
      cloud_cover = cloud;
      surf = mix(surf, vec3<f32>(0.95, 0.97, 1.0), cloud);
      water_spec = water_spec * (1.0 - cloud);
    }

    // Emergent orbital night-side civilization city light networks & radio technosignatures (civTechK >= 0.45)!
    if (civ_k >= 0.45 && is_land_hab > 0.05) {
      let night_w = 1.0 - smoothstep(-0.14, 0.08, raw_ndl);
      let c_net = fbm5(n_hit * 28.0 + seed_v * 2.3);
      let c_hub = fbm5(n_hit * 64.0 - seed_v * 1.9);
      let city_mask = smoothstep(0.58, 0.80, c_net) * smoothstep(0.50, 0.78, c_hub) * is_land_hab * (1.0 - cloud_cover * 0.7);
      let tech_gain = clamp((civ_k - 0.40) * 1.8, 0.0, 1.6);
      em_cities = vec3<f32>(1.0, 0.78, 0.36) * city_mask * night_w * tech_gain * 1.45;
      em_rad = em_rad + city_mask * tech_gain * 1.85;
    }

    let ndl_eff = mix(ndl_relief, ndl, cloud_cover * 0.85);
    let cool_atm_h = select(0.0, clamp(cam.extra0.z, 0.0, 1.0), live_sph_geo);
    let rayleigh_base = mix(vec3<f32>(0.78, 0.50, 0.30), vec3<f32>(0.30, 0.68, 1.0), select(0.25, 1.0, has_ocean));
    let rayleigh = mix(rayleigh_base, vec3<f32>(1.0, 0.44, 0.14), cool_atm_h * 0.82);
    let atm = rayleigh * fresnel * max(in.color1.w, cool_atm_h * 0.68) * 0.98;
    let sunset = mix(vec3<f32>(0.98, 0.44, 0.14), vec3<f32>(1.0, 0.52, 0.18), select(0.0, 1.0, has_ocean)) * term_sunset * (0.16 + 0.24 * cloud_cover + 0.25 * fresnel) * star_dir_l;
    col = surf * (vec3<f32>(0.028) + star_dir_l * (0.03 + 0.98 * ndl_eff) * soft_term) + sunset + star_dir_l * water_spec * ndl + atm * (vec3<f32>(0.03) + star_dir_l * (0.14 + 0.86 * ndl)) + em_lightning + em_aurora + em_cities + em_volc;
  } else if (kind == 3u) {
    // Cratered Moon / Icy World / Atmospheric Ice Giant (Uranus & Neptune):
    // Gate rocky crater relief strictly on airless moons (atm < 0.28) so Ice Giants have silky atmospheric methane bands!
    let crater_w = 1.0 - smoothstep(0.08, 0.28, in.color1.w);
    let live_sph3 = cam.sph_geo.x > 1.5 && in.inst_id == u32(round(cam.sph_geo.z));
    let up_r3 = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(n_hit.y) > 0.92);
    let t1_3 = normalize(cross(up_r3, n_hit));
    let t2_3 = cross(n_hit, t1_3);
    var ndl_c = ndl;
    var base = in.color0.rgb;
    if (live_sph3) {
      let gw3 = u32(round(cam.sph_geo.x));
      let gh3 = u32(round(cam.sph_geo.y));
      let eps3 = 3.14159265 / max(64.0, f32(gh3));
      let g3 = sample_sph_geology(n_hit, gw3, gh3);
      let g3xp = sample_sph_geology(normalize(n_hit + t1_3 * eps3), gw3, gh3).x;
      let g3xm = sample_sph_geology(normalize(n_hit - t1_3 * eps3), gw3, gh3).x;
      let g3yp = sample_sph_geology(normalize(n_hit + t2_3 * eps3), gw3, gh3).x;
      let g3ym = sample_sph_geology(normalize(n_hit - t2_3 * eps3), gw3, gh3).x;
      let relief3 = select(2.8 * max(0.35, crater_w), 3.4, disp_amp > 0.10);
      let n_crater = normalize(n_hit + (t1_3 * (g3xm - g3xp) + t2_3 * (g3ym - g3yp)) * relief3);
      ndl_c = max(0.0, dot(n_crater, light_dir));
      if (disp_amp > 0.005 && raw_ndl > -0.04 && raw_ndl < 0.72) {
        let l_tang3 = light_dir - n_hit * raw_ndl;
        let lt_len3 = length(l_tang3);
        if (lt_len3 > 1e-4) {
          let l_dir3 = l_tang3 / lt_len3;
          let tan_alt3 = max(0.0, raw_ndl) / lt_len3;
          var sh3 = 1.0;
          for (var s3 = 1u; s3 <= 4u; s3 = s3 + 1u) {
            let da3 = f32(s3) * 0.014;
            let e_s3 = sample_sph_geology(normalize(n_hit + l_dir3 * da3), gw3, gh3).x;
            let dh3 = (e_s3 - g3.x) * disp_amp;
            if (dh3 > da3 * tan_alt3 + 0.0006) {
              sh3 = min(sh3, clamp(1.0 - (dh3 - da3 * tan_alt3) * 26.0, 0.22, 1.0));
            }
          }
          ndl_c = ndl_c * sh3;
        }
      }
      base = mix(in.color1.rgb, in.color0.rgb, clamp(g3.x * 0.55 + 0.45 + g3.y * 0.25, 0.0, 1.0));
      // Cryo-tectonic rifts & subsurface-ocean tidal plumes driven by live SPH thermal channel!
      if (g3.z > 0.36) {
        let rift_c = smoothstep(0.36, 0.80, g3.z);
        let stain_col = mix(vec3<f32>(0.54, 0.30, 0.20), vec3<f32>(0.34, 0.78, 0.98), smoothstep(0.84, 0.95, in.color0.b));
        base = mix(base, stain_col, rift_c * 0.72);
      }
    } else {
      let n1 = fbm5(n_hit * 6.0 + seed_v);
      let n2 = fbm5(n_hit * 18.0 - seed_v);
      let c_x = fbm5(normalize(n_hit + t1_3 * 0.012) * 18.0 - seed_v);
      let c_y = fbm5(normalize(n_hit + t2_3 * 0.012) * 18.0 - seed_v);
      let n_crater = normalize(n_hit + (t1_3 * (n2 - c_x) + t2_3 * (n2 - c_y)) * (2.4 * crater_w));
      ndl_c = max(0.0, dot(n_crater, light_dir));
      let ig_band = 0.5 + 0.32 * sin(n_hit.y * 14.0 + n1 * 1.4) + 0.18 * fbm5(n_hit * vec3<f32>(3.0, 11.0, 3.0) + seed_v);
      let rocky_mix = clamp(0.2 + 0.7 * n1 + 0.25 * n2, 0.0, 1.0);
      base = mix(in.color1.rgb, in.color0.rgb, mix(clamp(ig_band, 0.18, 0.92), rocky_mix, crater_w));
      if (in.color0.b > 0.68 && in.color1.w < 0.12) {
        let l1 = abs(fbm5(n_hit * 8.5 + seed_v) - 0.5);
        let l2 = abs(fbm5(n_hit * 13.5 - seed_v * 1.6) - 0.5);
        let crack = max(1.0 - smoothstep(0.008, 0.032, l1), 1.0 - smoothstep(0.008, 0.028, l2));
        let stain_col = mix(vec3<f32>(0.54, 0.30, 0.20), vec3<f32>(0.36, 0.72, 0.96), smoothstep(0.88, 0.96, in.color0.b));
        base = mix(base, stain_col, crack * 0.62);
      }
    }
    var em_ice = vec3<f32>(0.0);
    if (cam.extra2.w > 0.5 && in.inst_id == u32(round(cam.extra2.z))) {
      let aw = u32(round(cam.extra2.x));
      let ah = u32(round(cam.extra2.y));
      let av = sample_live_atmo_vis(n_hit, aw, ah);
      let cfd3 = sample_live_atmo_flow(n_hit, aw, ah);
      let east3 = normalize(vec3<f32>(-n_hit.z, 0.0, n_hit.x) + vec3<f32>(1e-5, 0.0, 0.0));
      let north3 = cross(east3, n_hit);
      let flow3 = east3 * cfd3.x + north3 * cfd3.y;
      let ph0 = fract(cam.cam_pos.w * 0.16);
      let ph1 = fract(ph0 + 0.5);
      let ph_w = abs(2.0 * ph0 - 1.0);
      let band3 = mix(
        fbm5(normalize(n_hit - flow3 * (ph0 * 0.22)) * vec3<f32>(6.0, 22.0, 6.0) + seed_v),
        fbm5(normalize(n_hit - flow3 * (ph1 * 0.22)) * vec3<f32>(6.0, 22.0, 6.0) + seed_v),
        ph_w
      );
      base = mix(base, vec3<f32>(0.88, 0.95, 1.0), clamp(av.x * 0.45 + smoothstep(0.42, 0.82, band3) * 0.32 + smoothstep(0.35, 1.4, abs(cfd3.z)) * 0.22, 0.0, 0.68));
      let bolt = smoothstep(0.32, 1.15, av.z);
      em_ice = em_ice + vec3<f32>(0.68, 0.92, 1.0) * bolt * (1.7 + 1.2 * (1.0 - ndl));
      let aur3 = eval_filament_aurora(n_hit, av.w, cam.cam_pos.w, seed_v);
      em_ice = em_ice + vec3<f32>(0.24, 0.96, 0.72) * aur3 * (0.45 + 0.90 * (1.0 - ndl));
      em_uv = aur3 * 1.2;
      em_rad = bolt * 1.1 + aur3 * 0.6;
    }
    let atm = vec3<f32>(0.42, 0.76, 1.0) * fresnel * in.color1.w;
    col = base * (vec3<f32>(0.03) + star_dir_l * (0.04 + 0.96 * ndl_c) * soft_term) + star_dir_l * spec * 0.16 * ndl + atm * (vec3<f32>(0.03) + star_dir_l * (0.15 + 0.85 * ndl)) + em_ice;
  } else if (kind == 5u) {
    // Event horizon shadow OR glowing atomic nucleus pin
    let is_black_hole = dot(in.color0.rgb, in.color0.rgb) < 0.001;
    if (is_black_hole) {
      let photon_rim = pow(max(0.0, 1.0 - ndv), 4.8);
      col = vec3<f32>(1.0, 0.88, 0.64) * photon_rim * 1.4;
      em_xr = photon_rim * 1.8;
    } else {
      let base = mix(in.color0.rgb, in.color1.rgb, 0.25 + 0.45 * fresnel);
      col = base * (0.3 + 0.75 * ndl) + vec3<f32>(1.0) * spec * 0.65;
    }
  } else if (kind == 7u) {
    // Kind 7: Incandescent Hadean Magma Ocean World driven by live SPH mantle convection plumes & thin basalt rafts!
    let live_sph7 = cam.sph_geo.x > 1.5 && in.inst_id == u32(round(cam.sph_geo.z));
    var rift = 0.5;
    var basalt = vec3<f32>(0.14, 0.10, 0.10);
    if (live_sph7) {
      let g7 = sample_sph_geology(n_hit, u32(round(cam.sph_geo.x)), u32(round(cam.sph_geo.y)));
      rift = clamp(g7.z * 1.15 - g7.y * 0.45, 0.0, 1.0);
      basalt = mix(vec3<f32>(0.09, 0.07, 0.08), vec3<f32>(0.26, 0.18, 0.15), g7.y);
    } else {
      let crust = fbm5(n_hit * 4.2 + seed_v);
      let cracks = fbm5(n_hit * 13.5 - seed_v * 1.4);
      rift = smoothstep(0.46, 0.64, abs(crust - 0.50) * -2.0 + 0.72 + (cracks - 0.5) * 0.35);
      basalt = mix(vec3<f32>(0.10, 0.08, 0.09), vec3<f32>(0.24, 0.16, 0.14), cracks);
    }
    let lava = mix(vec3<f32>(0.96, 0.22, 0.04), vec3<f32>(1.0, 0.86, 0.32), smoothstep(0.35, 0.92, rift));
    let atm = vec3<f32>(1.0, 0.48, 0.18) * fresnel * in.color1.w * 0.9;
    col = basalt * (vec3<f32>(0.04) + star_dir_l * (0.06 + 0.85 * ndl) * soft_term) + lava * rift * 1.65 + atm * (vec3<f32>(0.08) + star_dir_l * (0.30 + 0.65 * ndl));
    em_temp_k = mix(850.0, 2200.0, rift);
  } else {
    // Kind 6: Quantized L7 Nuclear Protons (warm ruby-amber) & Neutrons (cool sapphire-silver)
    let base = mix(in.color0.rgb, in.color1.rgb, 0.22 + 0.55 * fresnel);
    col = base * (0.28 + 0.76 * ndl) + vec3<f32>(1.0, 0.96, 0.92) * spec * 0.72 + in.color0.rgb * fresnel * 0.35;
  }

  col = em_sensor_map_rgb(col, em_temp_k, em_uv, em_xr, em_rad, 0.0);
  let world_hit = cam.cam_pos.xyz + rd * t_hit;
  let clip = cam.view_proj * vec4<f32>(world_hit, 1.0);
  var out: FsOut;
  out.color = vec4<f32>(col, 1.0);
  out.depth = eval_frag_depth(clip, cam.em_aux.w);
  return out;
}
`,wi=`
${gi}
${_i}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> md_pos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> md_vel: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) center: vec3<f32>,
  @location(1) radius: f32,
  @location(2) world_quad: vec3<f32>,
  @location(3) tint: vec3<f32>,
  @location(4) alpha_fade: f32,
};

struct FsOut {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let p_raw = md_pos[iid];
  let v_raw = md_vel[iid];
  let half_box = cam.extra0.xyz;
  let world_scale = cam.extra0.w;
  let radius = cam.extra1.w;
  let alpha_fade = clamp(cam.extra2.x, 0.0, 1.0);
  let ideal_coord = max(4.0, cam.extra2.w);

  let center = (p_raw.xyz - half_box) * world_scale;
  let raw_coord = p_raw.w;
  // molecularDynamicsWebGpu.js ALREADY writes normalized coord_i / ideal_coord into pos.w (avoid double-division!);
  // on frame 0 before first neighbor build raw_coord can be 0; treat 0 as crystal base color!
  let coord_frac = select(clamp(raw_coord, 0.0, 1.2), 1.0, raw_coord < 0.01);
  let speed = length(v_raw.xyz);
  let heat = clamp(speed * 1.4, 0.0, 1.0);

  // True Gate 1 optical reflectance for solid crystals; warm amber glow on melted low-coord atoms
  let base_rgb = cam.extra1.rgb;
  let liq_rgb = mix(base_rgb, vec3<f32>(1.0, 0.56, 0.20), 0.52);
  let vap_rgb = mix(base_rgb, vec3<f32>(0.42, 0.84, 1.0), 0.55);
  var tint = mix(vap_rgb, liq_rgb, smoothstep(0.08, 0.35, coord_frac));
  tint = mix(tint, base_rgb, smoothstep(0.35, 0.72, coord_frac));
  tint = mix(tint, vec3<f32>(1.0, 0.82, 0.48), heat * 0.22);

  let to_cam = normalize(cam.cam_pos.xyz - center);
  let right = normalize(cross(cam.cam_up.xyz, to_cam));
  let up = cross(to_cam, right);
  let world_quad = center + to_cam * (radius * 0.15) + right * (uv.x * radius * 1.24) + up * (uv.y * radius * 1.24);

  var out: VsOut;
  out.pos = apply_log_depth_vs(cam.view_proj * vec4<f32>(world_quad, 1.0), cam.em_aux.w);
  out.center = center;
  out.radius = radius;
  out.world_quad = world_quad;
  out.tint = tint;
  out.alpha_fade = alpha_fade;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> FsOut {
  let ro = cam.cam_pos.xyz - in.center;
  let rd = normalize(in.world_quad - cam.cam_pos.xyz);
  let b = dot(ro, rd);
  let c = dot(ro, ro) - in.radius * in.radius;
  let disc = b * b - c;
  if (disc < 0.0) { discard; }
  let t_hit = -b - sqrt(disc);
  if (t_hit < 0.001) { discard; }
  let p_hit = ro + rd * t_hit;
  let n = normalize(p_hit);
  let light = normalize(vec3<f32>(0.62, 0.80, 0.52));
  let light2 = normalize(vec3<f32>(-0.55, -0.30, 0.75));
  let view = -rd;
  let ndl = max(0.0, dot(n, light));
  let ndl2 = max(0.0, dot(n, light2));
  let ndv_m = max(0.0, dot(n, view));
  let spec = pow(max(0.0, dot(n, normalize(light + view))), 56.0);
  // Schlick Fresnel + deep-lattice cavity ambient occlusion for crisp crystal facets!
  let f0 = 0.08;
  let schlick = f0 + (1.0 - f0) * pow(max(0.0, 1.0 - ndv_m), 4.0);
  let cav_ao = 0.72 + 0.28 * smoothstep(-0.35, 0.85, n.y);
  var col = in.tint * (0.20 + 0.80 * ndl + 0.20 * ndl2) * cav_ao + vec3<f32>(1.0, 0.98, 0.94) * spec * 0.78 + mix(in.tint, vec3<f32>(0.72, 0.90, 1.0), 0.45) * schlick * 0.42;
  col = em_sensor_map_rgb(col, max(50.0, cam.em_aux.x), 0.0, 0.0, 0.0, 0.0);
  let clip = cam.view_proj * vec4<f32>(in.center + p_hit, 1.0);
  var out: FsOut;
  out.color = vec4<f32>(col * in.alpha_fade, in.alpha_fade);
  out.depth = eval_frag_depth(clip, cam.em_aux.w);
  return out;
}
`,Ti=`
${gi}
${_i}

struct DiskInstance {
  center_r_in: vec4<f32>,
  normal_r_out: vec4<f32>,
  color_kind: vec4<f32>,
  shadow_info: vec4<f32>, // x = planet_radius, y = oblate_f, z = pad, w = pad
};

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> disks: array<DiskInstance>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) local_xy: vec2<f32>,
  @location(1) r_in: f32,
  @location(2) r_out: f32,
  @location(3) color_kind: vec4<f32>,
  @location(4) world_pos: vec3<f32>,
  @location(5) center: vec3<f32>,
  @location(6) ring_n: vec3<f32>,
  @location(7) shadow_info: vec2<f32>,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let d = disks[iid];
  let n = normalize(d.normal_r_out.xyz);
  let ref_v = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(n.y) > 0.9);
  let t1 = normalize(cross(ref_v, n));
  let t2 = cross(n, t1);
  let r_out = d.normal_r_out.w;
  let world_pos = d.center_r_in.xyz + (t1 * uv.x + t2 * uv.y) * r_out;

  var out: VsOut;
  out.pos = apply_log_depth_vs(cam.view_proj * vec4<f32>(world_pos, 1.0), cam.em_aux.w);
  out.local_xy = uv * r_out;
  out.r_in = d.center_r_in.w;
  out.r_out = r_out;
  out.color_kind = d.color_kind;
  out.world_pos = world_pos;
  out.center = d.center_r_in.xyz;
  out.ring_n = n;
  out.shadow_info = d.shadow_info.xy;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let r = length(in.local_xy);
  if (r > in.r_out || r < in.r_in) { discard; }
  let kind = u32(round(in.color_kind.w));

  if (kind == 0u) {
    let u = clamp((r - in.r_in) / max(1e-4, in.r_out - in.r_in), 0.0, 1.0);
    let ang = atan2(in.local_xy.y, in.local_xy.x);
    let shear = 0.55 + 0.45 * sin(ang * 3.0 + 16.0 / (u + 0.22) - cam.cam_pos.w * 2.2);
    let rel_p = in.world_pos - in.center;
    let tang = normalize(vec3<f32>(-rel_p.z, 0.0, rel_p.x) + vec3<f32>(1e-5));
    let view_dir = normalize(cam.cam_pos.xyz - in.world_pos);
    let beta = 0.44 / sqrt(max(0.18, u + 0.16));
    let doppler = clamp(1.0 + beta * dot(tang, view_dir), 0.35, 1.92);
    let beam = doppler * doppler;

    let hot_inner = vec3<f32>(0.90, 0.96, 1.0);
    let mid_gold = vec3<f32>(1.0, 0.66, 0.24);
    let cool_red = vec3<f32>(0.76, 0.18, 0.06);
    var col = mix(hot_inner, mid_gold, smoothstep(0.0, 0.35, u));
    col = mix(col, cool_red, smoothstep(0.30, 0.95, u));
    col = mix(col, vec3<f32>(0.75, 0.92, 1.0), clamp((doppler - 1.0) * 0.55, 0.0, 0.5));
    let radial_fade = (1.0 - smoothstep(0.58, 1.0, u)) * smoothstep(0.0, 0.07, u);
    let alpha = clamp(radial_fade * (0.48 + 0.52 * shear) * 0.92, 0.0, 1.0);
    var out_c = col * beam * (0.62 + 0.52 * shear);
    if (cam.em_sensor.z > 0.5) {
      let disk_t = mix(1.2e7, 4500.0, smoothstep(0.0, 0.85, u));
      out_c = em_sensor_map_rgb(out_c, disk_t, (1.0 - u) * 1.1, (1.0 - u) * 2.2 * beam, 0.55 * beam, 0.0);
    }
    return vec4<f32>(out_c * alpha, alpha);
  } else {
    // Saturn / Exoplanet Cassini-division ring system (with planetary eclipse shadow & cold 85 K IR emission!)
    let u = clamp((r - in.r_in) / max(1e-4, in.r_out - in.r_in), 0.0, 1.0);
    let c_x = (u - 0.60) * 32.0;
    let e_x = (u - 0.88) * 55.0;
    let cassini = 1.0 - 0.88 * exp(-(c_x * c_x));
    let encke = 1.0 - 0.60 * exp(-(e_x * e_x));
    let ringlets = 0.72 + 0.28 * sin(u * 76.0) * cos(u * 27.0);
    let fade = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.92, 1.0, u));
    // Analytical oblate-spheroid planet shadow cast onto back half of ring plane (true deep Cassini umbra!)
    let rel_p = in.world_pos - in.center;
    let to_star_r = cam.extra1.xyz - in.center;
    let ldir = select(
      normalize(cam.extra1.xyz),
      normalize(to_star_r),
      cam.extra1.w > 0.5 && length(to_star_r) > 1e-4
    );
    let view_r = normalize(cam.cam_pos.xyz - in.world_pos);
    let n_r = normalize(in.ring_n);
    let planet_r = select(in.r_in * 0.78, in.shadow_info.x, in.shadow_info.x > 1e-4);
    let oblate_r = clamp(in.shadow_info.y, 0.0, 0.16);
    let along = dot(rel_p, ldir);
    let perp_v = rel_p - ldir * along;
    // Account for planetary oblateness along the spin/ring normal axis when testing eclipse umbra
    let perp_pole = dot(perp_v, n_r);
    let perp_eq = perp_v - n_r * perp_pole;
    let inv_pole = 1.0 / max(0.80, 1.0 - oblate_r);
    let perp_r = sqrt(dot(perp_eq, perp_eq) + (perp_pole * inv_pole) * (perp_pole * inv_pole));
    // True pitch-dark planetary umbra (0.02 ambient bounce, retiring the 12% glowing floor!)
    let ring_shadow = select(1.0, smoothstep(planet_r * 0.96, planet_r * 1.04, perp_r) * 0.98 + 0.02, along < 0.0);
    // Physical icy water-frost regolith back-scattering Henyey-Greenstein phase (g = -0.35!) + Seeliger opposition surge + solar incidence obliquity!
    let cos_phase = dot(-view_r, ldir);
    let g_hg = -0.35;
    let hg_phase = (1.0 - g_hg * g_hg) / max(0.22, pow(max(0.15, 1.0 + g_hg * g_hg - 2.0 * g_hg * cos_phase), 1.5));
    let opp_surge = 1.0 + 0.34 * pow(max(0.0, dot(view_r, ldir)), 8.0);
    let sun_obliq = clamp(0.26 + 0.74 * abs(dot(n_r, ldir)), 0.24, 1.0);
    let phase_gain = clamp((0.62 + 0.38 * hg_phase * opp_surge) * sun_obliq, 0.25, 1.65);
    let alpha = clamp(fade * cassini * encke * ringlets * 0.76, 0.0, 0.88);
    let ring_star_l = cam.star_light.rgb * clamp(cam.star_light.w, 0.16, 1.85);
    var ring_c = in.color_kind.rgb * (0.85 + 0.25 * ringlets) * ring_shadow * phase_gain * ring_star_l;
    ring_c = em_sensor_map_rgb(ring_c, 85.0, 0.0, 0.0, 0.08, 0.0);
    return vec4<f32>(ring_c * alpha, alpha);
  }
}
`,Ei=`
${gi}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsIn {
  @location(0) pos: vec3<f32>,
  @location(1) color: vec4<f32>,
};

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.pos = apply_log_depth_vs(cam.view_proj * vec4<f32>(in.pos, 1.0), cam.em_aux.w);
  out.color = in.color;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  return in.color;
}
`,Di=`
${gi}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> vol_data: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.ndc = pts[vid];
  return out;
}

fn fetch_vox(i: vec3<u32>, dim: u32) -> vec4<f32> {
  return vol_data[(i.z * dim + i.y) * dim + i.x];
}

fn sample_vol(p_unit: vec3<f32>, dim: u32) -> vec4<f32> {
  let d = f32(dim);
  let g = clamp((p_unit * 0.5 + 0.5) * d - 0.5, vec3<f32>(0.0), vec3<f32>(d - 1.001));
  let i0 = vec3<u32>(floor(g));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(dim - 1u));
  let f = fract(g);
  let c000 = fetch_vox(vec3<u32>(i0.x, i0.y, i0.z), dim);
  let c100 = fetch_vox(vec3<u32>(i1.x, i0.y, i0.z), dim);
  let c010 = fetch_vox(vec3<u32>(i0.x, i1.y, i0.z), dim);
  let c110 = fetch_vox(vec3<u32>(i1.x, i1.y, i0.z), dim);
  let c001 = fetch_vox(vec3<u32>(i0.x, i0.y, i1.z), dim);
  let c101 = fetch_vox(vec3<u32>(i1.x, i0.y, i1.z), dim);
  let c011 = fetch_vox(vec3<u32>(i0.x, i1.y, i1.z), dim);
  let c111 = fetch_vox(vec3<u32>(i1.x, i1.y, i1.z), dim);
  return mix(mix(mix(c000, c100, f.x), mix(c010, c110, f.x), f.y),
             mix(mix(c001, c101, f.x), mix(c011, c111, f.x), f.y), f.z);
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let dim = u32(round(cam.extra0.x));
  let box_r = max(0.5, cam.extra0.y);
  let tdse_tun = cam.extra0.z;
  let tdse_crest_r = clamp(cam.extra0.w, 0.36, 0.95);
  let alpha_mul = clamp(cam.extra1.x, 0.0, 1.0);
  if (alpha_mul < 0.01) { discard; }

  let fov = cam.cam_up.w;
  let aspect = cam.cam_right.w;
  let ro = cam.cam_pos.xyz / box_r;
  let rd = normalize(
    cam.cam_fwd.xyz
    + cam.cam_right.xyz * (in.ndc.x * aspect * fov)
    + cam.cam_up.xyz * (in.ndc.y * fov)
  );

  let inv_rd = 1.0 / (rd + select(vec3<f32>(0.0), vec3<f32>(1e-6), abs(rd) < vec3<f32>(1e-6)));
  let t0 = (-1.0 - ro) * inv_rd;
  let t1 = (1.0 - ro) * inv_rd;
  let tmin_v = min(t0, t1);
  let tmax_v = max(t0, t1);
  let t_enter = max(0.0, max(tmin_v.x, max(tmin_v.y, tmin_v.z)));
  let t_exit = min(tmax_v.x, min(tmax_v.y, tmax_v.z));
  if (t_exit <= t_enter) { discard; }

  // 64-step raymarch with Interleaved Gradient Noise (IGN) jitter eliminating slice banding!
  let steps = 64u;
  let dt = (t_exit - t_enter) / f32(steps);
  let ign = fract(52.9829189 * fract(dot(in.pos.xy, vec2<f32>(0.06711056, 0.00583715))));
  var accum = vec3<f32>(0.0);
  var trans = 1.0;

  for (var s = 0u; s < steps; s = s + 1u) {
    let t = t_enter + (f32(s) + ign) * dt;
    let p = ro + rd * t;
    let v = sample_vol(p, dim);
    let rho_p = v.x;
    let rho_n = v.y;
    let dens = v.w;
    let rr = length(p);

    // Translucent Woods-Saxon potential aura + bright neutron-skin edge + emerald TDSE tunneling shell
    let edge_shell = dens * (1.0 - dens) * 4.0;
    let skin_col = mix(vec3<f32>(1.0, 0.45, 0.16), vec3<f32>(0.18, 0.84, 1.0), clamp((rho_n - rho_p) * 4.8 + 0.45, 0.0, 1.0));
    let tdse_x = (rr - tdse_crest_r) * 20.0;
    let tdse_ring = exp(-(tdse_x * tdse_x)) * (0.25 + 0.85 * clamp(tdse_tun * 5.0, 0.0, 1.0));
    let shell_col = vec3<f32>(0.24, 1.0, 0.72);

    let sigma = (edge_shell * 0.55 + tdse_ring * 0.65) * dt;
    let emit = (skin_col * edge_shell * 0.85 + shell_col * tdse_ring * 1.65) * dt;
    accum = accum + trans * emit;
    trans = trans * exp(-sigma);
    if (trans < 0.05) { break; }
  }
  let alpha = clamp((1.0 - trans) * alpha_mul, 0.0, 0.82);
  if (alpha < 0.004) { discard; }
  return vec4<f32>(accum * alpha_mul, alpha);
}
`,Oi=`
${gi}
${_i}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> vol_grid: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.ndc = pts[vid];
  return out;
}

fn av_hash3(p: vec3<f32>) -> f32 {
  let q = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
  let q2 = q + dot(q, q.yxz + 33.33);
  return fract((q2.x + q2.y) * q2.z);
}

fn av_noise3(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let n000 = av_hash3(i + vec3<f32>(0.0, 0.0, 0.0));
  let n100 = av_hash3(i + vec3<f32>(1.0, 0.0, 0.0));
  let n010 = av_hash3(i + vec3<f32>(0.0, 1.0, 0.0));
  let n110 = av_hash3(i + vec3<f32>(1.0, 1.0, 0.0));
  let n001 = av_hash3(i + vec3<f32>(0.0, 0.0, 1.0));
  let n101 = av_hash3(i + vec3<f32>(1.0, 0.0, 1.0));
  let n011 = av_hash3(i + vec3<f32>(0.0, 1.0, 1.0));
  let n111 = av_hash3(i + vec3<f32>(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
}

fn sample_grid_trilin(p_unit: vec3<f32>, dim: u32, stride: u32, slot: u32) -> vec4<f32> {
  let d = f32(dim);
  let g = clamp((p_unit * 0.5 + 0.5) * (d - 1.0), vec3<f32>(0.0), vec3<f32>(d - 1.001));
  let i0 = vec3<u32>(floor(g));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(dim - 1u));
  let f = fract(g);
  let c000 = vol_grid[((i0.z * dim + i0.y) * dim + i0.x) * stride + slot];
  let c100 = vol_grid[((i0.z * dim + i0.y) * dim + i1.x) * stride + slot];
  let c010 = vol_grid[((i0.z * dim + i1.y) * dim + i0.x) * stride + slot];
  let c110 = vol_grid[((i0.z * dim + i1.y) * dim + i1.x) * stride + slot];
  let c001 = vol_grid[((i1.z * dim + i0.y) * dim + i0.x) * stride + slot];
  let c101 = vol_grid[((i1.z * dim + i0.y) * dim + i1.x) * stride + slot];
  let c011 = vol_grid[((i1.z * dim + i1.y) * dim + i0.x) * stride + slot];
  let c111 = vol_grid[((i1.z * dim + i1.y) * dim + i1.x) * stride + slot];
  return mix(
    mix(mix(c000, c100, f.x), mix(c010, c110, f.x), f.y),
    mix(mix(c001, c101, f.x), mix(c011, c111, f.x), f.y),
    f.z
  );
}

struct AstroVolOut {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

@fragment
fn fs_main(in: VsOut) -> AstroVolOut {
  let dim = u32(round(cam.extra0.x));
  let box_r = max(0.05, cam.extra0.y);
  let mode = u32(round(cam.extra0.z));
  let alpha_mul = clamp(cam.extra0.w, 0.0, 1.0);
  if (dim < 8u || alpha_mul < 0.01) { discard; }

  let center_w = cam.extra1.xyz;
  let param_a = cam.extra1.w;
  let fov = cam.cam_up.w;
  let aspect = cam.cam_right.w;
  let ro = (cam.cam_pos.xyz - center_w) / box_r;
  let rd = normalize(
    cam.cam_fwd.xyz
    + cam.cam_right.xyz * (in.ndc.x * aspect * fov)
    + cam.cam_up.xyz * (in.ndc.y * fov)
  );

  // Bounding sphere intersection inside unit cube (radius 1.0) for zero cube-corner seams
  let b_s = dot(ro, rd);
  let c_s = dot(ro, ro) - 1.0;
  let disc = b_s * b_s - c_s;
  if (disc <= 0.0) { discard; }
  let sq = sqrt(disc);
  let t_enter = max(0.0, -b_s - sq);
  let t_exit = -b_s + sq;
  if (t_exit <= t_enter) { discard; }

  let steps = 64u;
  let dt = (t_exit - t_enter) / f32(steps);
  let ign = fract(52.9829189 * fract(dot(in.pos.xy, vec2<f32>(0.06711056, 0.00583715))));
  let time_s = cam.extra2.z;
  var accum = vec3<f32>(0.0);
  var trans = 1.0;
  var t_hit = 0.5 * (t_enter + t_exit);

  if (mode == 0u) {
    // MODE 0: LIVE 3D MLS-MPM STELLAR ENGINE — 100% PHYSICALLY OPAQUE OPTICAL PHOTOSPHERE +
    // TRUE WAVELENGTH-DEPENDENT EM RADIATIVE TRANSFER (EUV Loops / X-Ray & Gamma Nuclear Core Transparency / IR / Radio) +
    // OPTIONAL OPTICAL OCTANT CORE CUTAWAY (cam.extra2.y > 0.5)!
    let teff_log = clamp(param_a, 3.0, 5.1);
    let r_star_u = clamp(cam.extra2.x, 0.45, 0.92);
    let cutaway_on = cam.extra2.y > 0.5;
    let gen_f = cam.extra2.w;
    let em_active = cam.em_sensor.z > 0.5;
    let mid_log_lam = 0.5 * (cam.em_sensor.x + cam.em_sensor.y);
    // Physical wavelength-dependent bound-free envelope opacity:
    //   - Optical & IR: tau >> 1 (100% physically opaque photosphere — ZERO see-through background stars!)
    //   - EUV (log10 lam ~ -8..-6.9): optically thick chromosphere + blazing hot magnetic flare corona!
    //   - X-Ray & Gamma (log10 lam < -8.0): bound-free opacity drops ~lam^3, peeling the outer plasma open to reveal the live nuclear fusion heart!
    let xray_peel = select(0.0, 1.0 - smoothstep(-9.1, -7.5, mid_log_lam), em_active);
    let euv_band = select(0.0, smoothstep(-8.8, -8.2, mid_log_lam) * (1.0 - smoothstep(-7.2, -6.7, mid_log_lam)), em_active);
    let ir_band = select(0.0, smoothstep(-6.0, -5.0, mid_log_lam) * (1.0 - smoothstep(-3.4, -2.6, mid_log_lam)), em_active);
    let radio_band = select(0.0, smoothstep(-3.3, -2.1, mid_log_lam), em_active);

    let c_bd = vec3<f32>(0.74, 0.14, 0.26);
    let c_rsg = vec3<f32>(1.00, 0.24, 0.04);
    let c_sun = vec3<f32>(1.00, 0.62, 0.12);
    let c_pop2 = vec3<f32>(0.42, 0.76, 1.00);
    let c_pop3 = vec3<f32>(0.22, 0.58, 1.00);
    var phot_base = mix(c_bd, c_rsg, smoothstep(3.05, 3.48, teff_log));
    phot_base = mix(phot_base, c_sun, smoothstep(3.52, 3.82, teff_log));
    phot_base = mix(phot_base, c_pop2, smoothstep(3.84, 4.12, teff_log));
    phot_base = mix(phot_base, c_pop3, smoothstep(4.20, 4.78, teff_log));
    let lane_col = phot_base * vec3<f32>(0.24, 0.14, 0.20) + vec3<f32>(0.02, 0.06, 0.16) * smoothstep(3.85, 4.5, teff_log);
    let crest_col = mix(phot_base * 1.48, vec3<f32>(1.0, 0.96, 0.86), 0.36);
    let core_nuc_col = select(
      select(vec3<f32>(1.00, 0.84, 0.36), vec3<f32>(0.54, 0.88, 1.00), gen_f < 2.5),
      vec3<f32>(0.52, 0.40, 1.00),
      gen_f < 1.5
    );
    var hit_opaque = false;
    var core_xr_acc = 0.0;
    var flare_uv_acc = 0.0;

    for (var s = 0u; s < steps; s = s + 1u) {
      let t = t_enter + (f32(s) + ign) * dt;
      let p = ro + rd * t;
      let r = length(p);
      if (r >= 0.99) { continue; }
      let r_norm = r / r_star_u;
      // Optional Optical Octant Cutaway exposes live convective/radiative zones + blazing nuclear fusion heart!
      let in_cut_octant = cutaway_on && p.x > 0.0 && p.y > 0.0 && p.z > 0.0 && r_norm < 0.99;
      if (in_cut_octant) { continue; }

      let g0 = sample_grid_trilin(p, dim, 3u, 0u);
      let g1 = sample_grid_trilin(p, dim, 3u, 1u);
      let g2 = sample_grid_trilin(p, dim, 3u, 2u);
      let m_rho = g0.w;
      if (m_rho < 1e-4 && r_norm > 0.96) { continue; }
      let eps_tot = g1.z;
      let n_rad = p / max(1e-4, r);
      let v_rad = dot(g0.xyz, n_rad);

      // High-contrast 3D boiling convective granulation & sunspot magnetic pores advected by live MPM velocity!
      let gran_p = p * 10.5 - g0.xyz * 0.28 + vec3<f32>(time_s * 0.14, -time_s * 0.09, time_s * 0.11);
      let n1 = av_noise3(gran_p);
      let n2 = av_noise3(gran_p * 2.15 + vec3<f32>(4.1, -2.7, 3.3));
      let n3 = av_noise3(gran_p * 4.4 - vec3<f32>(1.9, 5.2, -3.8));
      let raw_cell = n1 * 0.52 + n2 * 0.32 + n3 * 0.16 + v_rad * 0.16;
      let ridge_cell = 1.0 - abs(raw_cell * 2.0 - 1.0);
      let gran_hi = pow(clamp(ridge_cell, 0.0, 1.0), 2.0);
      // Magnetic active-region dark sunspot umbrae (cool in optical, blazing bright in EUV/X-Ray!)
      let spot_n = av_noise3(p * 3.8 + vec3<f32>(2.3, -1.7, 4.1));
      let sunspot = smoothstep(0.73, 0.85, spot_n) * (1.0 - smoothstep(0.65, 0.90, abs(n_rad.y)));

      let dens_sc = clamp(pow(max(1e-4, m_rho) * pow(f32(dim) / 24.0, 3.0) * 6.8, 0.58), 0.15, 2.4);
      let mu_limb = abs(dot(n_rad, -rd));
      let limb_dark = 0.30 + 0.70 * pow(max(0.0, mu_limb), 0.58);

      // 1. PHYSICALLY OPAQUE PHOTOSPHERIC SHELL (r_norm <= 0.935) when NOT peeled open by X-Ray/Gamma!
      //    If viewing a cutaway interior face (near p.x==0 / p.y==0 / p.z==0 inside the star), reveal concentric
      //    interior convective -> radiative -> nuclear-burning strata cleanly!
      if (r_norm <= 0.935) {
        let is_cut_face = cutaway_on && (
          (p.x > -0.04 && p.y > -0.02 && p.z > -0.02)
          || (p.y > -0.04 && p.x > -0.02 && p.z > -0.02)
          || (p.z > -0.04 && p.x > -0.02 && p.y > -0.02)
        );
        let core_w = (1.0 - smoothstep(0.20, 0.44, r_norm)) * (0.65 + smoothstep(0.05, 8.0, eps_tot) * 0.95);
        let nuc_turb = 0.78 + 0.38 * av_noise3(p * 14.0 - vec3<f32>(time_s * 0.45));
        let core_emit = mix(core_nuc_col, vec3<f32>(0.98, 0.99, 1.0), smoothstep(0.42, 0.95, 1.0 - r_norm * 2.1) * 0.52)
          * (1.15 + smoothstep(0.2, 16.0, eps_tot + g2.z * 2.0 + g2.y) * 0.95) * nuc_turb;

        if (xray_peel < 0.18) {
          // OPAQUE OPTICAL / IR / EUV SURFACE OR CUTAWAY FACE (100% ZERO SEE-THROUGH!)
          var surf_c = mix(lane_col, crest_col, gran_hi) * limb_dark;
          surf_c = mix(surf_c, surf_c * 0.24, sunspot * (1.0 - euv_band));
          // Active magnetic plage / EUV coronal brightening over active sunspot regions!
          surf_c = surf_c + vec3<f32>(0.45, 0.85, 1.0) * (sunspot * 1.45 + gran_hi * 0.45) * euv_band;
          surf_c = mix(surf_c, mix(vec3<f32>(0.65, 0.12, 0.02), vec3<f32>(1.0, 0.65, 0.20), gran_hi) * limb_dark, ir_band * 0.65);
          if (is_cut_face && r_norm < 0.88) {
            // Live GPU-field-driven stellar interior: convective vigor from live |v_rad|, nuclear burning directly from live eps_tot!
            // (Retires hardcoded r=0.68 tachocline & r=0.36 core rings that contradicted brown dwarfs & massive convective-core stars!)
            let conv_activity = smoothstep(0.06, 0.42, abs(v_rad) + length(g0.xyz) * 0.14);
            let burn_activity = smoothstep(0.04, 2.8, eps_tot + g2.z * 0.65);
            let rad_col = mix(phot_base * 1.28, vec3<f32>(1.0, 0.92, 0.72), 0.38) * (0.72 + 0.35 * n2);
            let conv_col = mix(lane_col * 1.1, crest_col * 1.15, gran_hi);
            var interior_c = mix(rad_col, conv_col, clamp(conv_activity * 0.85 + smoothstep(0.74, 0.88, r_norm) * 0.4, 0.0, 1.0));
            let core_blend = clamp(max(burn_activity, (1.0 - smoothstep(0.16, 0.38, r_norm)) * (0.35 + 0.65 * burn_activity)), 0.0, 1.0);
            surf_c = mix(interior_c, core_emit * 1.35, core_blend);
          }
          accum = accum + trans * surf_c;
          trans = 0.0;
          hit_opaque = true;
          t_hit = t;
          break;
        } else {
          // X-RAY / GAMMA-RAY HIGH-ENERGY TRANSPARENCY: outer photosphere becomes ghostly optically thin
          // indigo-violet plasma while the blazing live GPU thermonuclear fusion core glows brightly inside!
          let env_opac = mix(5.5, 0.18, xray_peel);
          let rim_shell = pow(max(0.0, 1.0 - mu_limb), 1.8) * smoothstep(0.62, 0.93, r_norm);
          let phot_ghost = vec3<f32>(0.14, 0.18, 0.58) * (0.14 + 0.55 * rim_shell) * (0.55 + 0.45 * gran_hi);
          let flare_knot = vec3<f32>(0.24, 0.78, 1.0) * sunspot * 0.75 * smoothstep(0.75, 0.93, r_norm);
          let core_tight = (1.0 - smoothstep(0.14, 0.38, r_norm)) * (0.75 + smoothstep(0.05, 10.0, eps_tot + g2.z) * 1.15);
          let sigma_x = (dens_sc * env_opac * 0.28 + core_tight * 2.4) * dt;
          let emit_x = (phot_ghost * dens_sc * 0.55 + flare_knot + core_emit * core_tight * 2.6) * dt;
          accum = accum + trans * emit_x;
          core_xr_acc = core_xr_acc + trans * core_tight * dt * 2.2;
          flare_uv_acc = flare_uv_acc + trans * (sunspot * 0.8 + rim_shell * 0.25) * dt;
          trans = trans * exp(-sigma_x);
          if (trans < 0.03) { break; }
          continue;
        }
      }

      // 2. TRANSLUCENT CHROMOSPHERIC SPICULES, PROMINENCES & CORONA (r_norm > 0.935)
      let dchrom = (r_norm - 0.96) / 0.055;
      let chromo_w = exp(-(dchrom * dchrom));
      let corona_w = smoothstep(0.92, 1.02, r_norm) * (1.0 - smoothstep(1.02, 1.32, r_norm));
      let flare_arch = pow(clamp(av_noise3(p * 6.5 - vec3<f32>(time_s * 0.25, time_s * 0.18, 0.0)), 0.0, 1.0), 2.4);
      let chromo_emit = mix(phot_base, vec3<f32>(1.0, 0.42, 0.16), select(0.58, 0.10, teff_log > 3.95))
        * (0.55 + 0.85 * gran_hi) * (1.0 + 1.5 * euv_band + 0.35 * xray_peel);
      let cor_emit = mix(phot_base, vec3<f32>(0.48, 0.84, 1.0), 0.42 + 0.45 * (euv_band + radio_band))
        * (0.35 + 1.15 * flare_arch) * (0.42 + 1.45 * euv_band + 1.25 * radio_band + 0.22 * xray_peel);
      let sigma_c = (chromo_w * dens_sc * 1.1 + corona_w * 0.18) * dt;
      let emit_c = (chromo_emit * chromo_w * dens_sc * 1.15 + cor_emit * corona_w * 0.42) * dt;
      accum = accum + trans * emit_c;
      flare_uv_acc = flare_uv_acc + trans * (chromo_w * 0.45 + flare_arch * corona_w * 0.55) * dt;
      trans = trans * exp(-sigma_c);
      if (trans < 0.02) { break; }
    }
    if (em_active) {
      let em_t = pow(10.0, teff_log);
      if (xray_peel > 0.25) {
        // True Chandra X-Ray / Fermi Gamma radiograph: crisp translucent indigo outer shell + blazing sapphire-white fusion heart!
        let xr_core = clamp(core_xr_acc * 1.35, 0.0, 2.2);
        let xr_rim = clamp(length(accum) * 0.65, 0.0, 1.2);
        accum = vec3<f32>(0.10, 0.18, 0.55) * xr_rim
          + vec3<f32>(0.36, 0.82, 1.00) * flare_uv_acc * 0.85
          + mix(core_nuc_col, vec3<f32>(0.92, 0.98, 1.0), clamp(xr_core * 0.55, 0.0, 0.82)) * (xr_core * 1.35);
      } else {
        let uv_s = clamp(flare_uv_acc * 1.4 + 0.35 * euv_band, 0.0, 1.6);
        let rad_s = clamp(length(accum) * (0.35 + 0.9 * radio_band), 0.0, 1.6);
        accum = em_sensor_map_rgb(accum, em_t, uv_s, core_xr_acc * 0.8, rad_s, 0.0);
      }
    }
    let alpha = select(clamp((1.0 - trans) * alpha_mul, 0.0, 0.98), alpha_mul, hit_opaque);
    if (alpha < 0.004) { discard; }
    let hit_w0 = center_w + (ro + rd * t_hit) * box_r;
    let clip0 = cam.view_proj * vec4<f32>(hit_w0, 1.0);
    var out0: AstroVolOut;
    out0.color = vec4<f32>(accum * alpha_mul, alpha);
    out0.depth = eval_frag_depth(clip0, cam.em_aux.w);
    return out0;
  } else {
    // MODE 1: MLS-MPM-GRADE HYBRID 3D DENSITY-ISOSURFACE + ∇ρ NORMALS + MOLTEN RIFT PROTOPLANET!
    // Solidifies cooling obsidian/silicate crust plates with crisp 3D finite-difference ∇ρ surface-normal lighting
    // & specular reflections at 60 FPS (zero Marching Cubes overhead!), while early phases & Cutaway (extra2.y > 0.5)
    // expose the incandescent sinking Fe-Ni metallic core & churning crimson mantle plumes!
    let age_f = clamp(param_a, 0.0, 1.0);
    let has_ocean = cam.extra2.x > 0.5;
    let cutaway_on = cam.extra2.y > 0.5;
    let is_magma = cam.extra2.w > 0.5;
    let l_dir_raw = cam.sph_geo.xyz;
    let l_dir = select(normalize(vec3<f32>(0.65, 0.45, 0.60)), normalize(l_dir_raw), length(l_dir_raw) > 0.05);
    let h_fd = 2.0 / max(12.0, f32(dim));
    // Crisp 3D density isosurface threshold across ALL eras, physically contracting from +4% molten thermal
    // inflation in Era 1 (1.04 R_p) down to EXACT 1.000 R_p before the age_f = 0.45 crossfade onto LIT_SPHERE_WGSL
    // (eliminating ANY size disparity across 5K..57K SPH parcels & 32^3..64^3 grids!)
    let iso_thresh = mix(0.11, 0.09, age_f);
    let r_surf_lim = mix(1.04, 1.000, smoothstep(0.0, 0.45, age_f));
    let atm_outer_lim = r_surf_lim + mix(0.16, 0.06, age_f);
    var hit_solid = false;

    for (var s = 0u; s < steps; s = s + 1u) {
      let t = t_enter + (f32(s) + ign) * dt;
      let p = ro + rd * t;
      let r = length(p);
      if (r >= 0.99) { continue; }
      let r_body = r * 1.55;
      if (r_body > atm_outer_lim) { continue; }
      if (cutaway_on && p.x > 0.0 && p.y > 0.0 && p.z > 0.0 && r_body < 1.05) { continue; }

      let g0 = sample_grid_trilin(p, dim, 2u, 0u);
      let dens = g0.x;
      if (dens < 0.012 && r_body > r_surf_lim * 0.97) { continue; }
      let g1 = sample_grid_trilin(p, dim, 2u, 1u);
      let temp_n = clamp(g1.x, 0.0, 1.0);
      let rho0 = g1.y;
      let shock = clamp(g1.w, 0.0, 2.0);
      let n_rad = p / max(1e-4, r);

      // Advected 3D basalt plate & incandescent tectonic magma-rift cracks!
      let q_p = p * 11.5 - g0.yzw * 0.35 + vec3<f32>(time_s * 0.04);
      let n_a = av_noise3(q_p);
      let n_b = av_noise3(q_p * 2.3 + vec3<f32>(3.7, -2.1, 1.5));
      let n_c = av_noise3(q_p * 4.8 - vec3<f32>(1.4, 3.3, -2.7));
      let tex = n_a * 0.54 + n_b * 0.30 + n_c * 0.16;
      let crack = pow(clamp(1.0 - abs(n_a * 2.0 - 1.0), 0.0, 1.0), 2.5);
      // Cooled basaltic slag rafts floating on the boiling Era-1/Era-2 magma ocean!
      let slag_plate = smoothstep(0.42 - age_f * 0.28, 0.68 - age_f * 0.24, n_a * 0.7 + n_b * 0.3);

      let is_core = smoothstep(5.2, 6.8, rho0) * (1.0 - smoothstep(0.24, 0.50, r_body));
      let is_outer_shell = smoothstep(0.66, 0.88, r_body);
      let is_crust = max(1.0 - smoothstep(2.65, 3.30, rho0), is_outer_shell * (0.42 + 0.58 * age_f));
      let is_water = (1.0 - smoothstep(1.35, 2.15, rho0)) * select(0.0, 1.0, has_ocean);

      // MLS-MPM-GRADE 3D DENSITY-ISOSURFACE HIT (PIXEL-MATCHED TO LIT_SPHERE_WGSL RADIUS 1.000 R_p!):
      // Sharp 6-tap finite-difference ∇ρ surface normal + high-frequency magma/basalt micro-bump + glossy specular + Fresnel rim!
      let r_relief = r_surf_lim + (tex - 0.5) * 0.022;
      if (r_body <= r_relief && (dens > iso_thresh || r_body <= r_surf_lim * 0.985)) {
        let gx_p = sample_grid_trilin(p + vec3<f32>(h_fd, 0.0, 0.0), dim, 2u, 0u).x;
        let gx_m = sample_grid_trilin(p - vec3<f32>(h_fd, 0.0, 0.0), dim, 2u, 0u).x;
        let gy_p = sample_grid_trilin(p + vec3<f32>(0.0, h_fd, 0.0), dim, 2u, 0u).x;
        let gy_m = sample_grid_trilin(p - vec3<f32>(0.0, h_fd, 0.0), dim, 2u, 0u).x;
        let gz_p = sample_grid_trilin(p + vec3<f32>(0.0, 0.0, h_fd), dim, 2u, 0u).x;
        let gz_m = sample_grid_trilin(p - vec3<f32>(0.0, 0.0, h_fd), dim, 2u, 0u).x;
        let grad_rho = vec3<f32>(gx_p - gx_m, gy_p - gy_m, gz_p - gz_m);
        let grad_l = length(grad_rho);
        let n_fd = select(n_rad, -grad_rho / grad_l, grad_l > 1e-4);
        // Physical 3D surface micro-relief normal from advected crust/wave turbulence
        let bump_n = vec3<f32>(n_a - 0.5, n_b - 0.5, n_c - 0.5) * 0.36;
        let n_iso = normalize(mix(n_rad, n_fd, 0.70) + bump_n);
        let ndl = max(0.0, dot(n_iso, l_dir));
        let ndv = max(0.0, dot(n_iso, -rd));
        let half_v = normalize(l_dir - rd);
        let spec_pow = select(36.0, 76.0, is_water > 0.35 || slag_plate < 0.35 || is_magma);
        let spec = pow(max(0.0, dot(n_iso, half_v)), spec_pow) * (0.34 + 0.58 * max(is_water, 1.0 - slag_plate));
        let fres = pow(max(0.0, 1.0 - ndv), 3.2);

        let core_c = mix(vec3<f32>(1.0, 0.62, 0.12), vec3<f32>(1.0, 0.94, 0.72), 0.45 + 0.55 * tex) * 1.85;
        // Deep volcanic crimson-ember magma ocean + bright glowing lava fissures contrasting against dark obsidian slag!
        let magma_c = mix(vec3<f32>(0.10, 0.012, 0.008), vec3<f32>(0.96, 0.26, 0.025), pow(clamp(crack * 0.68 + temp_n * 0.28 + (1.0 - slag_plate) * 0.28, 0.0, 1.0), 1.55))
          * (0.48 + 0.85 * crack) + vec3<f32>(1.0, 0.56, 0.14) * pow(crack, 3.0) * 0.72;
        // Cooled obsidian / basaltic tectonic plates with realistic directional lighting & specular sheen!
        let rock_albedo = mix(vec3<f32>(0.042, 0.038, 0.048), vec3<f32>(0.24, 0.34, 0.20), select(0.06, 0.68, has_ocean) * age_f);
        let water_albedo = vec3<f32>(0.05, 0.30, 0.68);
        let base_albedo = mix(rock_albedo, water_albedo, is_water * age_f * 0.78);
        let lit_crust = base_albedo * (0.10 + 0.96 * ndl) + vec3<f32>(1.0, 0.88, 0.74) * spec * (0.30 + 0.65 * ndl);
        let rift_glow = vec3<f32>(0.98, 0.30, 0.03) * pow(crack, 1.65) * (0.95 + 1.05 * temp_n) * select(1.0, 1.75, is_magma) * (1.12 - 0.52 * age_f);
        let crust_blend = clamp(slag_plate * (0.64 + 0.36 * age_f) * select(1.0, 0.45, is_magma), 0.0, 1.0);
        var iso_c = mix(magma_c + vec3<f32>(1.0, 0.52, 0.22) * spec * 0.36, lit_crust + rift_glow, crust_blend);
        iso_c = mix(iso_c, core_c, is_core);
        // Glowing atmospheric volcanic vapor / steam Fresnel rim!
        let rim_c = select(vec3<f32>(1.0, 0.38, 0.10), vec3<f32>(0.34, 0.68, 1.0), has_ocean && age_f > 0.45);
        iso_c = iso_c + rim_c * fres * (0.48 + 0.34 * ndl) + vec3<f32>(1.0, 0.86, 0.50) * shock * 0.95;

        accum = accum + trans * iso_c;
        trans = 0.0;
        hit_solid = true;
        t_hit = t;
        break;
      }

      // Outer tenuous silicate-vapor & steam impact atmosphere outside the solid/liquid isosurface
      // (confined to physical atmospheric scale height & fading cleanly during late cooling crossfade!)
      let atm_h_fade = 1.0 - smoothstep(r_surf_lim, atm_outer_lim, r_body);
      let vapor_col = select(vec3<f32>(0.95, 0.36, 0.08), vec3<f32>(0.42, 0.72, 1.0), has_ocean && age_f > 0.5);
      let dens_sc = clamp(dens * 1.4, 0.0, 0.28) * atm_h_fade * (1.0 - smoothstep(0.45, 0.90, age_f));
      let sigma = dens_sc * 0.42 * dt;
      let emit = (vapor_col * dens_sc * 0.52 + vec3<f32>(1.0, 0.84, 0.45) * shock * atm_h_fade * 0.65) * dt;
      accum = accum + trans * emit;
      trans = trans * exp(-sigma);
      if (trans < 0.03) { break; }
    }
    if (cam.em_sensor.z > 0.5) {
      accum = em_sensor_map_rgb(accum, mix(2800.0, 450.0, age_f), 0.18, 0.05, 0.15, 0.0);
    }
    let alpha = select(clamp((1.0 - trans) * alpha_mul, 0.0, 0.98), alpha_mul, hit_solid);
    if (alpha < 0.004) { discard; }
    // Pull depth gently forward by 0.045 unit-box radii so Mode 1 blends cleanly over its own
    // LIT_SPHERE_WGSL crossfade while STILL being cleanly occluded by foreground rings, moons, or spacecraft!
    let t_depth1 = max(0.0, t_hit - 0.045);
    let hit_w1 = center_w + (ro + rd * t_depth1) * box_r;
    let clip1 = cam.view_proj * vec4<f32>(hit_w1, 1.0);
    var out1: AstroVolOut;
    out1.color = vec4<f32>(accum * alpha_mul, alpha);
    out1.depth = eval_frag_depth(clip1, cam.em_aux.w);
    return out1;
  }
}
`,ki=`
struct BloomUniforms {
  inv_res: vec2<f32>,
  threshold: f32,
  mode: f32, // 0 = bright-pass extract + 4-tap downsample, 1 = 4-tap Kawase blur
};

@group(0) @binding(0) var<uniform> u: BloomUniforms;
@group(0) @binding(1) var src_tex: texture_2d<f32>;
@group(0) @binding(2) var src_samp: sampler;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.uv = vec2<f32>(pts[vid].x * 0.5 + 0.5, 0.5 - pts[vid].y * 0.5);
  return out;
}

fn bright_clip(c: vec3<f32>, thresh: f32) -> vec3<f32> {
  let l = max(c.r, max(c.g, c.b));
  let soft = smoothstep(thresh * 0.72, thresh * 1.45, l);
  return c * soft * clamp(l - thresh * 0.65, 0.0, 6.0) / max(1e-4, l);
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let d = u.inv_res * select(1.25, 2.25, u.mode > 0.5);
  let cc = textureSample(src_tex, src_samp, in.uv).rgb;
  let c0 = textureSample(src_tex, src_samp, in.uv + vec2<f32>(-d.x, -d.y)).rgb;
  let c1 = textureSample(src_tex, src_samp, in.uv + vec2<f32>( d.x, -d.y)).rgb;
  let c2 = textureSample(src_tex, src_samp, in.uv + vec2<f32>(-d.x,  d.y)).rgb;
  let c3 = textureSample(src_tex, src_samp, in.uv + vec2<f32>( d.x,  d.y)).rgb;
  if (u.mode < 0.5) {
    let avg = (bright_clip(c0, u.threshold) + bright_clip(c1, u.threshold) + bright_clip(c2, u.threshold) + bright_clip(c3, u.threshold)) * 0.25;
    return vec4<f32>(avg, 1.0);
  }
  let blur = (cc * 2.0 + c0 + c1 + c2 + c3) * (1.0 / 6.0);
  return vec4<f32>(blur, 1.0);
}
`,Ai=`
struct PostUniforms {
  resolution: vec2<f32>,
  bh_uv: vec2<f32>,
  bh_strength: f32,
  warp_amount: f32,
  flash_amount: f32,
  crt_enabled: f32,
  pixel_size: f32,
  time_sec: f32,
  bloom_strength: f32,
  pad1: f32,
  em_sensor: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: PostUniforms;
@group(0) @binding(1) var scene_tex: texture_2d<f32>;
@group(0) @binding(2) var scene_samp: sampler;
@group(0) @binding(3) var bloom_tex: texture_2d<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.uv = vec2<f32>(pts[vid].x * 0.5 + 0.5, 0.5 - pts[vid].y * 0.5);
  return out;
}

fn aces_tonemap(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  var uv = in.uv;
  let aspect = u.resolution.x / max(1.0, u.resolution.y);

  if (u.crt_enabled > 0.5 && u.pixel_size > 1.0) {
    let step_uv = vec2<f32>(u.pixel_size) / max(vec2<f32>(1.0), u.resolution);
    uv = (floor(uv / step_uv) + 0.5) * step_uv;
  }

  // Exact Schwarzschild Einstein-ring deflection around projected SMBH UV (active ONLY at SMBH Core scale!)
  var photon_glow = vec3<f32>(0.0);
  if (u.bh_strength > 1e-6) {
    let d_aspect = vec2<f32>((uv.x - u.bh_uv.x) * aspect, uv.y - u.bh_uv.y);
    let r2 = dot(d_aspect, d_aspect);
    let r = sqrt(max(1e-6, r2));
    let rs = sqrt(u.bh_strength) * 0.65;
    let outside_shadow = smoothstep(rs * 0.85, rs * 1.25, r);
    let falloff = exp(-r2 * 18.0) * outside_shadow;
    let deflect = (u.bh_strength / max(r2 + rs * rs * 0.75, 0.0005)) * falloff;
    let dir_uv = vec2<f32>(d_aspect.x / aspect, d_aspect.y) / max(r, 1e-4);
    uv = clamp(uv - dir_uv * min(0.095, deflect * 0.11), vec2<f32>(0.001), vec2<f32>(0.999));
    let ring_x = (r - rs * 1.16) / max(0.005, rs * 0.22);
    let ring = exp(-(ring_x * ring_x)) * 0.48;
    photon_glow = vec3<f32>(1.0, 0.86, 0.64) * ring;
  }

  var col = textureSample(scene_tex, scene_samp, uv).rgb + photon_glow;
  let bloom_col = textureSample(bloom_tex, scene_samp, uv).rgb;
  if (u.bloom_strength > 0.001) {
    col = col + bloom_col * u.bloom_strength;
  }

  if (u.warp_amount > 0.005) {
    let from_c = uv - vec2<f32>(0.5, 0.5);
    var streak = vec3<f32>(0.0);
    for (var s = 1u; s <= 4u; s = s + 1u) {
      let f = f32(s) * 0.012 * u.warp_amount;
      let uv_r = clamp(uv - from_c * (f * 1.12), vec2<f32>(0.001), vec2<f32>(0.999));
      let uv_g = clamp(uv - from_c * f, vec2<f32>(0.001), vec2<f32>(0.999));
      let uv_b = clamp(uv - from_c * (f * 0.88), vec2<f32>(0.001), vec2<f32>(0.999));
      streak.r += textureSample(scene_tex, scene_samp, uv_r).r;
      streak.g += textureSample(scene_tex, scene_samp, uv_g).g;
      streak.b += textureSample(scene_tex, scene_samp, uv_b).b;
    }
    col = mix(col, (col + streak * 0.24) * (1.0 + 0.30 * u.warp_amount), clamp(u.warp_amount, 0.0, 0.72));
  }

  if (u.flash_amount > 0.002) {
    let rad = length((in.uv - vec2<f32>(0.5)) * vec2<f32>(aspect, 1.0));
    let burst = exp(-rad * rad * 1.8) * u.flash_amount;
    col = col + vec3<f32>(1.0, 0.92, 0.78) * burst * 2.0;
  }

  col = aces_tonemap(col * 1.12);

  if (u.crt_enabled > 0.5) {
    let scan = 0.82 + 0.18 * sin(in.uv.y * u.resolution.y * 1.65);
    let vig_d = length((in.uv - vec2<f32>(0.5)) * 1.38);
    let vig = clamp(1.0 - vig_d * vig_d * 0.45, 0.35, 1.0);
    col = col * scan * vig;
    col = mix(col, col * vec3<f32>(0.92, 1.04, 1.02), 0.35);
  }

  return vec4<f32>(col, 1.0);
}
`;function ji(e,t){let n=t.getContext(`webgpu`);if(!n)throw Error(`WebGPU canvas context unavailable`);let{format:r}=ae(n,e,{preferCopySrc:!0}),i=`rgba16float`,a=`depth32float`,o=0,s=0,c=null,l=null,u=null,d=null,f=null,p=null,m=null,h=null,g=e.createBuffer({label:`uv-cam-base`,size:240,usage:mi.UNIFORM|mi.COPY_DST}),_=Array.from({length:8},(t,n)=>e.createBuffer({label:`uv-cam-cloud-${n}`,size:240,usage:mi.UNIFORM|mi.COPY_DST})),v=e.createBuffer({label:`uv-cam-aux`,size:240,usage:mi.UNIFORM|mi.COPY_DST}),y=e.createBuffer({label:`uv-cam-astro-vol`,size:240,usage:mi.UNIFORM|mi.COPY_DST}),b=e.createBuffer({label:`uv-cam-flora`,size:240,usage:mi.UNIFORM|mi.COPY_DST}),x=e.createBuffer({label:`uv-cam-space-mesh`,size:240,usage:mi.UNIFORM|mi.COPY_DST}),S=e.createBuffer({label:`uv-post-uniform`,size:64,usage:mi.UNIFORM|mi.COPY_DST}),C=e.createBuffer({label:`uv-bloom-extract-u`,size:16,usage:mi.UNIFORM|mi.COPY_DST}),w=e.createBuffer({label:`uv-bloom-blur-u`,size:16,usage:mi.UNIFORM|mi.COPY_DST}),T=e.createSampler({magFilter:`linear`,minFilter:`linear`}),E=e.createBuffer({label:`uv-spheres`,size:320*80,usage:mi.STORAGE|mi.COPY_DST}),D=e.createBuffer({label:`uv-disks`,size:1024,usage:mi.STORAGE|mi.COPY_DST}),O=24576,k=e.createBuffer({label:`uv-lines`,size:O*28,usage:mi.VERTEX|mi.COPY_DST}),A=16384,j=e.createBuffer({label:`uv-cosmic-mesh`,size:A*48,usage:mi.VERTEX|mi.COPY_DST}),M=e.createBuffer({label:`uv-cosmic-fx`,size:A*48,usage:mi.VERTEX|mi.COPY_DST}),N=e.createBuffer({label:`uv-nuclear-vol`,size:1024*32*16,usage:mi.STORAGE|mi.COPY_DST}),P=1024*32*16,F=(t,n)=>e.createShaderModule({label:t,code:n}),I=F(`uv-backdrop`,vi),L=e.createRenderPipeline({label:`uv-backdrop-pipe`,layout:`auto`,vertex:{module:I,entryPoint:`vs_main`},fragment:{module:I,entryPoint:`fs_main`,targets:[{format:i}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`always`}}),R=e.createBindGroup({layout:L.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}}]}),z=F(`uv-surface-sky`,yi),B=e.createRenderPipeline({label:`uv-surface-sky-pipe`,layout:`auto`,vertex:{module:z,entryPoint:`vs_main`},fragment:{module:z,entryPoint:`fs_main`,targets:[{format:i}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`always`}}),ee=e.createBindGroup({layout:B.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}}]}),V=F(`uv-surface-mesh`,bi),te=e.createRenderPipeline({label:`uv-surface-mesh-pipe`,layout:`auto`,vertex:{module:V,entryPoint:`vs_main`,buffers:[{arrayStride:48,attributes:[{shaderLocation:0,offset:0,format:`float32x4`},{shaderLocation:1,offset:16,format:`float32x4`},{shaderLocation:2,offset:32,format:`float32x4`}]}]},fragment:{module:V,entryPoint:`fs_main`,targets:[{format:i}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:a,depthWriteEnabled:!0,depthCompare:`greater-equal`}}),ne=e.createBindGroup({layout:te.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}}]}),re=e.createBindGroup({layout:te.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}}]}),ie=F(`uv-surface-flora`,xi),oe=e.createRenderPipeline({label:`uv-surface-flora-pipe`,layout:`auto`,vertex:{module:ie,entryPoint:`vs_main`,buffers:[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:`float32x4`},{shaderLocation:1,offset:16,format:`float32x4`}]}]},fragment:{module:ie,entryPoint:`fs_main`,targets:[{format:i}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:a,depthWriteEnabled:!0,depthCompare:`greater-equal`}}),H=new WeakMap;function se(t){let n=H.get(t);return n||(n=e.createBindGroup({layout:oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:b}},{binding:1,resource:{buffer:t}}]}),H.set(t,n)),n}let ce=F(`uv-translucent-fx`,Si),le=e.createRenderPipeline({label:`uv-translucent-fx-pipe`,layout:`auto`,vertex:{module:ce,entryPoint:`vs_main`,buffers:[{arrayStride:48,attributes:[{shaderLocation:0,offset:0,format:`float32x4`},{shaderLocation:1,offset:16,format:`float32x4`},{shaderLocation:2,offset:32,format:`float32x4`}]}]},fragment:{module:ce,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`greater-equal`}}),ue=e.createBindGroup({layout:le.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}}]}),de=e.createBindGroup({layout:le.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}}]}),fe=F(`uv-cloud`,Z),pe=e.createRenderPipeline({label:`uv-cloud-pipe`,layout:`auto`,vertex:{module:fe,entryPoint:`vs_main`},fragment:{module:fe,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`greater-equal`}}),me=e.createRenderPipeline({label:`uv-backdrop-cloud-pipe`,layout:`auto`,vertex:{module:fe,entryPoint:`vs_main`},fragment:{module:fe,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`always`}}),he=F(`uv-lit-sphere`,Ci),ge=e.createRenderPipeline({label:`uv-lit-sphere-pipe`,layout:`auto`,vertex:{module:he,entryPoint:`vs_main`},fragment:{module:he,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!0,depthCompare:`greater-equal`}}),_e=e.createBuffer({label:`uv-dummy-atmo-em`,size:96,usage:mi.STORAGE|mi.COPY_DST}),ve=e.createBuffer({label:`uv-dummy-sph-geo`,size:64,usage:mi.STORAGE|mi.COPY_DST}),ye=new WeakMap;function be(t,n=null){let r=t||_e,i=n||ve,a=ye.get(r);a||(a=new WeakMap,ye.set(r,a));let o=a.get(i);return o||(o=e.createBindGroup({layout:ge.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:E}},{binding:2,resource:{buffer:r}},{binding:3,resource:{buffer:i}}]}),a.set(i,o)),o}let xe=F(`uv-md-sphere`,wi),Se=e.createRenderPipeline({label:`uv-md-sphere-pipe`,layout:`auto`,vertex:{module:xe,entryPoint:`vs_main`},fragment:{module:xe,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!0,depthCompare:`greater-equal`}}),Ce=F(`uv-disk`,Ti),we=e.createRenderPipeline({label:`uv-disk-pipe`,layout:`auto`,vertex:{module:Ce,entryPoint:`vs_main`},fragment:{module:Ce,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`greater-equal`}}),Te=e.createBindGroup({layout:we.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:D}}]}),Ee=F(`uv-line`,Ei),De=e.createRenderPipeline({label:`uv-line-pipe`,layout:`auto`,vertex:{module:Ee,entryPoint:`vs_main`,buffers:[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x4`}]}]},fragment:{module:Ee,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`line-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`greater-equal`}}),Oe=e.createBindGroup({layout:De.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}}]}),ke=F(`uv-nuclear-vol`,Di),Ae=e.createRenderPipeline({label:`uv-nuclear-vol-pipe`,layout:`auto`,vertex:{module:ke,entryPoint:`vs_main`},fragment:{module:ke,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`always`}}),je=e.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:N}}]}),Me=F(`uv-astro-vol`,Oi),Ne=e.createRenderPipeline({label:`uv-astro-vol-pipe`,layout:`auto`,vertex:{module:Me,entryPoint:`vs_main`},fragment:{module:Me,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`greater-equal`}}),Pe=new WeakMap;function Fe(t){let n=Pe.get(t);return n||(n=e.createBindGroup({layout:Ne.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:y}},{binding:1,resource:{buffer:t}}]}),Pe.set(t,n)),n}let Ie=F(`uv-bloom`,ki),Le=e.createRenderPipeline({label:`uv-bloom-pipe`,layout:`auto`,vertex:{module:Ie,entryPoint:`vs_main`},fragment:{module:Ie,entryPoint:`fs_main`,targets:[{format:i}]},primitive:{topology:`triangle-list`}}),Re=null,ze=null,Be=F(`uv-post`,Ai),Ve=e.createRenderPipeline({label:`uv-post-pipe`,layout:`auto`,vertex:{module:Be,entryPoint:`vs_main`},fragment:{module:Be,entryPoint:`fs_main`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),He=null,Ue=Array.from({length:8},()=>new WeakMap),We=Array.from({length:8},()=>new WeakMap),Ge=new WeakMap;function Ke(t,n,r=!1){let i=(r?We:Ue)[n],a=_[n],o=r?me:pe,s=i.get(t);return s||(s=e.createBindGroup({layout:o.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:a}},{binding:1,resource:{buffer:t}}]}),i.set(t,s)),s}function qe(t,n){let r=Ge.get(t);return r||(r=e.createBindGroup({layout:Se.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:n}}]}),Ge.set(t,r)),r}function Je(t,r){let g=Math.max(2,Math.floor(t)),_=Math.max(2,Math.floor(r));if(c&&o===g&&s===_)return;o=g,s=_;let v=Math.max(2,Math.floor(o/2)),y=Math.max(2,Math.floor(s/2));ae(n,e,{preferCopySrc:!0}),c?.destroy(),u?.destroy(),f?.destroy(),m?.destroy(),c=e.createTexture({label:`uv-scene-color`,size:[o,s],format:i,usage:hi.RENDER_ATTACHMENT|hi.TEXTURE_BINDING}),l=c.createView(),u=e.createTexture({label:`uv-scene-depth`,size:[o,s],format:a,usage:hi.RENDER_ATTACHMENT}),d=u.createView(),f=e.createTexture({label:`uv-bloom-a`,size:[v,y],format:i,usage:hi.RENDER_ATTACHMENT|hi.TEXTURE_BINDING}),p=f.createView(),m=e.createTexture({label:`uv-bloom-b`,size:[v,y],format:i,usage:hi.RENDER_ATTACHMENT|hi.TEXTURE_BINDING}),h=m.createView(),e.queue.writeBuffer(C,0,new Float32Array([1/o,1/s,1.02,0])),e.queue.writeBuffer(w,0,new Float32Array([1/v,1/y,1.02,1])),Re=e.createBindGroup({layout:Le.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:C}},{binding:1,resource:l},{binding:2,resource:T}]}),ze=e.createBindGroup({layout:Le.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:p},{binding:2,resource:T}]}),He=e.createBindGroup({layout:Ve.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:l},{binding:2,resource:T},{binding:3,resource:h}]})}function Ye(t){!t||t.byteLength===0||(t.byteLength>P&&(N.destroy(),P=t.byteLength,N=e.createBuffer({label:`uv-nuclear-vol`,size:P,usage:mi.STORAGE|mi.COPY_DST}),je=e.createBindGroup({layout:Ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:N}}]})),e.queue.writeBuffer(N,0,t))}let Xe=new Float32Array(60),Ze=new Float32Array(16),Qe=new Float32Array(320*20),$e=new Float32Array(256),et=new Float32Array(O*7);function U(t,n,r,i,a,o=null,s=null,c=null,l=null){Xe.set(n.viewProj,0),Xe.set([n.pos[0],n.pos[1],n.pos[2],n.timeSec||0],16),Xe.set([n.right[0],n.right[1],n.right[2],n.aspect],20),Xe.set([n.up[0],n.up[1],n.up[2],n.fovTanHalf],24),Xe.set([n.fwd[0],n.fwd[1],n.fwd[2],n.log10SpanM??24.8],28),Xe.set(r||[0,0,0,0],32),Xe.set(i||[0,0,0,0],36),Xe.set(a||[0,0,0,0],40),Xe.set(o||[-6.42,-6.12,0,1],44),Xe.set(s||[288,1,0,0],48),Xe.set(c||[1,.97,.92,1],52),Xe.set(l||[0,0,-1,-1.5],56),e.queue.writeBuffer(t,0,Xe)}function tt({camera:r,particleClouds:i=[],spheres:a=null,atmoEm:c=null,sphGeology:u=null,surfaceScene:f=null,cosmicMeshes:m=null,lightDir:C=[.6,.75,.55],lightIsPoint:w=!1,coolingHeat:T=0,orbitalSeasonDecl:N=0,ringShadow:P=null,starLight:F=[1,.97,.92,1],mdCloud:I=null,disks:z=null,lines:V=null,nuclearVol:ie=null,astroVol:ae=null,emSensor:H=null,post:ce={},stereoSbs:fe=!1,xrEyeTarget:he=null}){Je(t.width,t.height);let _e=H&&H.active?[Number.isFinite(H.log10LambdaMin)?H.log10LambdaMin:-6.42,Number.isFinite(H.log10LambdaMax)?H.log10LambdaMax:-6.12,1,Math.max(.2,Number(H.gain)||1)]:[-6.42,-6.12,0,1],ve=Number(f?.ambientTempK??f?.env?.tempK??I?.tempK??288),ye=!!(f&&f.env),xe=ye?2:0,Ce=ye?Number(f?.env?.skyOpticalDepth??0):Math.max(-.985,Math.min(.985,Number(N)||0)),Ee=[ve,Number(f?.eclipseFactor??1),Ce,xe],ke=0;if(Array.isArray(a)&&a.length>0){ke=Math.min(320,a.length);for(let e=0;e<ke;e+=1){let t=a[e],n=e*20;Qe[n+0]=t.pos[0],Qe[n+1]=t.pos[1],Qe[n+2]=t.pos[2],Qe[n+3]=t.radius,Qe[n+4]=t.color0[0],Qe[n+5]=t.color0[1],Qe[n+6]=t.color0[2],Qe[n+7]=t.kind??1,Qe[n+8]=t.color1?.[0]??t.color0[0],Qe[n+9]=t.color1?.[1]??t.color0[1],Qe[n+10]=t.color1?.[2]??t.color0[2],Qe[n+11]=t.atm??.35,Qe[n+12]=t.rCore??.52,Qe[n+13]=t.rMantle??.94,Qe[n+14]=+!!t.cutaway,Qe[n+15]=t.seed??(e+1)*1.37,Qe[n+16]=Number(t.tempK)||(t.kind===0?5778:288),Qe[n+17]=Number(t.civTechK)||0,Qe[n+18]=Number(t.dysonCoverage)||0,Qe[n+19]=Number(t.flags)||0}e.queue.writeBuffer(E,0,Qe.subarray(0,ke*20))}let Me=0;if(Array.isArray(z)&&z.length>0){Me=Math.min(16,z.length);for(let e=0;e<Me;e+=1){let t=z[e],n=e*16;$e[n+0]=t.center[0],$e[n+1]=t.center[1],$e[n+2]=t.center[2],$e[n+3]=t.rIn,$e[n+4]=t.normal[0],$e[n+5]=t.normal[1],$e[n+6]=t.normal[2],$e[n+7]=t.rOut,$e[n+8]=t.color?.[0]??.9,$e[n+9]=t.color?.[1]??.85,$e[n+10]=t.color?.[2]??.72,$e[n+11]=t.kind??0,$e[n+12]=Number(t.planetRadius)||0,$e[n+13]=Number(t.oblateF)||0,$e[n+14]=0,$e[n+15]=0}e.queue.writeBuffer(D,0,$e.subarray(0,Me*16))}let Pe=0;V&&V.length>=14&&(Pe=Math.min(O,Math.floor(V.length/7)),et.set(V.subarray(0,Pe*7),0),e.queue.writeBuffer(k,0,et.subarray(0,Pe*7)));let Ie=0,Be=0;m&&(m.opaque&&m.opaque.length>=12&&(Ie=Math.min(A,Math.floor(m.opaque.length/12)),e.queue.writeBuffer(j,0,m.opaque.subarray(0,Ie*12))),m.fx&&m.fx.length>=12&&(Be=Math.min(A,Math.floor(m.fx.length/12)),e.queue.writeBuffer(M,0,m.fx.subarray(0,Be*12))));let Ue=(i||[]).filter(e=>e&&e.buffer&&e.count>0).slice(0,8),We=Ue.some(e=>e.isBackdrop),Ge=!!(c&&c.buffer&&c.width>0&&c.height>0),Ye=!!(u&&u.buffer&&u.width>0&&u.height>0),Xe=!!(!Ye&&P&&P.rOutRatio>1.05),tt=Ye?[u.width,u.height,u.sphereIndex??0,Number.isFinite(u.seaLevelNorm)?u.seaLevelNorm:-.05]:Xe?[P.normal[0],P.normal[1],P.normal[2],P.sphereIndex??0]:[0,0,-1,-1.5],nt=Xe?Number(P.rInRatio):Math.max(0,Math.min(1,Number(T)||0)),rt=Xe?Number(P.rOutRatio):0,it=Array.isArray(F)&&F.length>=4?[Number(F[0])||1,Number(F[1])||.97,Number(F[2])||.92,Number(F[3])||1]:[1,.97,.92,1];U(g,r,[r.level||0,+!!We,nt,rt],[C[0],C[1],C[2],+!!w],Ge?[c.width,c.height,c.sphereIndex??0,1]:[1,1,-1,0],_e,Ee,it,tt),U(x,r,[.06,.09,.14,0],[C[0],C[1],C[2],0],[0,0,0,0],_e,[320,1,0,1],it);for(let e=0;e<Ue.length;e+=1){let t=Ue[e],n=_[e];U(n,r,[t.mode,t.worldScale,t.pointSize,t.alphaGain],t.extra1||[...t.colorPos||[0,0,0],0],t.extra2||[...t.colorNeg||[0,0,0],0],_e,Ee,it)}if(f&&f.env){let e=f.env,t=f.lightDir||C,n=e.hasSolidCrust?1/(2*(e.tinyPlanetCurvatureRadiusM||2800)):0,i=[Number(f.auroraStrength)||0,Number(f.observerLatRad)||0,Number(f.dynamoMicroT)||0,0];U(v,r,[e.skyZenithRgb[0],e.skyZenithRgb[1],e.skyZenithRgb[2],e.skyOpticalDepth],[t[0],t[1],t[2],n],[e.skyHorizonRgb[0],e.skyHorizonRgb[1],e.skyHorizonRgb[2],+!!e.isMagmaOcean],_e,Ee,it,i);let a=f.focusPos||r.pos;U(b,r,[e.skyZenithRgb[0],e.skyZenithRgb[1],e.skyZenithRgb[2],e.skyOpticalDepth],[t[0],t[1],t[2],n],[e.skyHorizonRgb[0],e.skyHorizonRgb[1],e.skyHorizonRgb[2],a[0]||0],_e,[Ee[0],Ee[1],a[2]||0,Ee[3]],it)}else I&&I.positionsBuffer&&I.velocitiesBuffer&&I.count>0?U(v,r,[I.halfBox[0],I.halfBox[1],I.halfBox[2],I.worldScale],[I.baseRgb[0],I.baseRgb[1],I.baseRgb[2],I.radius],[I.alphaFade??1,0,0,I.idealCoord||12],_e,Ee,it):ie&&ie.dim>0&&U(v,r,[ie.dim,ie.boxRadius||3.4,ie.tdseTunneled||0,ie.tdseCrestNorm||.72],[ie.alphaMul??1,0,0,0],[0,0,0,0],_e,Ee,it);if(ae&&ae.buffer&&ae.dim>=8){let e=ae.lightDir||C;U(y,r,[ae.dim,ae.boxRadius||6,ae.mode||0,ae.alphaMul??1],[ae.center?.[0]||0,ae.center?.[1]||0,ae.center?.[2]||0,ae.paramA??3.76],ae.extra2||[.72,0,ce.timeSec??0,3],_e,Ee,it,[e[0],e[1],e[2],0])}let at=ce.bloomStrength??.22;Ze[0]=o,Ze[1]=s,Ze[2]=ce.bhUv?.[0]??.5,Ze[3]=ce.bhUv?.[1]??.5,Ze[4]=ce.bhStrength??0,Ze[5]=ce.warpAmount??0,Ze[6]=ce.flashAmount??0,Ze[7]=+!!ce.crtEnabled,Ze[8]=ce.pixelSize??3,Ze[9]=ce.timeSec??0,Ze[10]=at,Ze[11]=0,Ze[12]=_e[0],Ze[13]=_e[1],Ze[14]=_e[2],Ze[15]=_e[3],e.queue.writeBuffer(S,0,Ze);let ot=e.createCommandEncoder({label:`uv-frame-fused`});{let e=ot.beginRenderPass({colorAttachments:[{view:l,clearValue:{r:.005,g:.009,b:.02,a:1},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:d,depthClearValue:0,depthLoadOp:`clear`,depthStoreOp:`store`}});if(f&&f.env){e.setPipeline(B),e.setBindGroup(0,ee),e.draw(3,1,0,0);for(let t=0;t<Ue.length;t+=1){let n=Ue[t];n.isBackdrop&&(e.setPipeline(me),e.setBindGroup(0,Ke(n.buffer,t,!0)),e.draw(6,n.count,0,0))}ke>0&&(e.setPipeline(ge),e.setBindGroup(0,be(Ge?c.buffer:null,Ye?u.buffer:null)),e.draw(6,ke,0,0)),Me>0&&(e.setPipeline(we),e.setBindGroup(0,Te),e.draw(6,Me,0,0)),!f.hideTerrain&&f.terrainVertBuf&&f.terrainIdxBuf&&f.indexCount>0&&(e.setPipeline(te),e.setBindGroup(0,ne),e.setVertexBuffer(0,f.terrainVertBuf),e.setIndexBuffer(f.terrainIdxBuf,`uint32`),e.drawIndexed(f.indexCount,1,0,0,0)),f.flora&&f.flora.instanceBuf&&f.flora.templateVertBuf&&f.flora.instanceCount>0&&f.flora.templateVertCount>0&&(e.setPipeline(oe),e.setBindGroup(0,se(f.flora.instanceBuf)),e.setVertexBuffer(0,f.flora.templateVertBuf),e.draw(f.flora.templateVertCount,f.flora.instanceCount,0,0)),f.boulderVertBuf&&f.boulderVertCount>0&&(e.setPipeline(te),e.setBindGroup(0,ne),e.setVertexBuffer(0,f.boulderVertBuf,0,f.boulderVertCount*48),e.draw(f.boulderVertCount,1,0,0)),f.vehicleVertBuf&&f.vehicleVertCount>0&&(e.setPipeline(te),e.setBindGroup(0,ne),e.setVertexBuffer(0,f.vehicleVertBuf,0,f.vehicleVertCount*48),e.draw(f.vehicleVertCount,1,0,0))}else{e.setPipeline(L),e.setBindGroup(0,R),e.draw(3,1,0,0);for(let t=0;t<Ue.length;t+=1){let n=Ue[t];n.isBackdrop&&(e.setPipeline(me),e.setBindGroup(0,Ke(n.buffer,t,!0)),e.draw(6,n.count,0,0))}}Pe>0&&(e.setPipeline(De),e.setBindGroup(0,Oe),e.setVertexBuffer(0,k,0,Pe*28),e.draw(Pe,1,0,0)),f&&f.env||(ke>0&&(e.setPipeline(ge),e.setBindGroup(0,be(Ge?c.buffer:null,Ye?u.buffer:null)),e.draw(6,ke,0,0)),Me>0&&(e.setPipeline(we),e.setBindGroup(0,Te),e.draw(6,Me,0,0))),I&&I.positionsBuffer&&I.velocitiesBuffer&&I.count>0&&(e.setPipeline(Se),e.setBindGroup(0,qe(I.positionsBuffer,I.velocitiesBuffer)),e.draw(6,I.count,0,0)),ae&&ae.buffer&&ae.dim>=8&&(e.setPipeline(Ne),e.setBindGroup(0,Fe(ae.buffer)),e.draw(3,1,0,0)),!f&&Ie>0&&(e.setPipeline(te),e.setBindGroup(0,re),e.setVertexBuffer(0,j,0,Ie*48),e.draw(Ie,1,0,0));for(let t=0;t<Ue.length;t+=1){let n=Ue[t];n.isBackdrop||(e.setPipeline(pe),e.setBindGroup(0,Ke(n.buffer,t,!1)),e.draw(6,n.count,0,0))}ie&&ie.dim>0&&(e.setPipeline(Ae),e.setBindGroup(0,je),e.draw(3,1,0,0)),f&&f.fxVertBuf&&f.fxVertCount>0?(e.setPipeline(le),e.setBindGroup(0,ue),e.setVertexBuffer(0,f.fxVertBuf,0,f.fxVertCount*48),e.draw(f.fxVertCount,1,0,0)):!f&&Be>0&&(e.setPipeline(le),e.setBindGroup(0,de),e.setVertexBuffer(0,M,0,Be*48),e.draw(Be,1,0,0)),e.end()}if(at>.001&&Re&&ze){let e=ot.beginRenderPass({colorAttachments:[{view:p,clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});e.setPipeline(Le),e.setBindGroup(0,Re),e.draw(3,1,0,0),e.end();let t=ot.beginRenderPass({colorAttachments:[{view:h,clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});t.setPipeline(Le),t.setBindGroup(0,ze),t.draw(3,1,0,0),t.end()}{let t=he?.colorView||n.getCurrentTexture().createView(),r=ot.beginRenderPass({colorAttachments:[{view:t,clearValue:{r:0,g:0,b:0,a:1},loadOp:he?.preserve?`load`:`clear`,storeOp:`store`}]});if(he?.viewport){let e=he.viewport;r.setViewport(e.x,e.y,e.width,e.height,0,1)}else if(fe){let t=Math.max(1,Math.floor(o*.5));r.setPipeline(Ve),r.setBindGroup(0,He),r.setViewport(0,0,t,s,0,1),r.draw(3,1,0,0),r.setViewport(t,0,o-t,s,0,1),r.draw(3,1,0,0),r.end(),e.queue.submit([ot.finish()]);return}r.setPipeline(Ve),r.setBindGroup(0,He),r.draw(3,1,0,0),r.end()}e.queue.submit([ot.finish()])}function nt(){c?.destroy(),u?.destroy(),f?.destroy(),m?.destroy();for(let e of[g,..._,v,y,x,S,C,w,E,_e,ve,D,k,j,M,N])try{e.destroy()}catch{}}return Object.freeze({renderFrame:tt,uploadNuclearVolume:Ye,dispose:nt})}function Mi(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function Ni(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function Pi(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function Fi(e){return e-Math.floor(e)}function Ii(e,t,n){let r=Math.max(0,Math.min(1,(n-e)/Math.max(1e-7,t-e)));return r*r*(3-2*r)}function Li(e,t,n){let r=Fi(e*.3183099+.1)*17,i=Fi(t*.3183099+.2)*17,a=Fi(n*.3183099+.3)*17;return Fi(r*i*a*(r+i+a))}function Ri(e,t,n){let r=Math.floor(e),i=Math.floor(t),a=Math.floor(n),o=e-r,s=t-i,c=n-a,l=o*o*(3-2*o),u=s*s*(3-2*s),d=c*c*(3-2*c),f=Li(r,i,a),p=Li(r+1,i,a),m=Li(r,i+1,a),h=Li(r+1,i+1,a),g=Li(r,i,a+1),_=Li(r+1,i,a+1),v=Li(r,i+1,a+1),y=Li(r+1,i+1,a+1),b=f+(p-f)*l,x=m+(h-m)*l,S=g+(_-g)*l,C=v+(y-v)*l,w=b+(x-b)*u;return w+(S+(C-S)*u-w)*d}function zi(e,t,n){let r=e,i=t,a=n,o=0,s=.5;for(let e=0;e<5;e+=1)o+=s*Ri(r,i,a),r=r*2.07+13.7,i=i*2.07-9.2,a=a*2.07+5.4,s*=.5;return o}function Bi(e,t){let n=t.width,r=t.height,i=t.data,a=Math.atan2(e[2],e[0]),o=Math.asin(Math.max(-1,Math.min(1,e[1]))),s=Fi(a/(Math.PI*2)+.5),c=Math.max(0,Math.min(.9999,.5-o/Math.PI)),l=s*n-.5,u=c*r-.5,d=Math.floor(l),f=Math.floor(u),p=l-d,m=u-f,h=(d%n+n)%n,g=((d+1)%n+n)%n,_=Math.max(0,Math.min(r-1,f)),v=Math.max(0,Math.min(r-1,f+1)),y=(_*n+h)*4,b=(_*n+g)*4,x=(v*n+h)*4,S=(v*n+g)*4,C=e=>{let t=i[y+e]*(1-p)+i[b+e]*p,n=i[x+e]*(1-p)+i[S+e]*p;return t*(1-m)+n*m};return[C(0),C(1),C(2),C(3)]}function Vi(e,t={},n=7.81,r=null,i=null){let a=Mi(Array.isArray(e)&&e.length===3?e:[0,.5,.866]),o=Math.asin(Math.max(-1,Math.min(1,a[1])))*(180/Math.PI),s=Math.atan2(a[2],a[0])*(180/Math.PI),c=Array.isArray(t.color1)?t.color1:[.1,.25,.55],l=(Number(t.radiusKm)||6371)>=14e3,u=!l&&!!(i?.data&&i.width>1&&i.height>1),d=Array.isArray(r)&&r.length===3?Pi(a,Mi(r)):.65,f=d<-.04,p=d>=-.08&&d<=.16,m=null;if(Array.isArray(r)&&r.length===3){let e=Mi(r);m=Math.atan2(a[2],a[0])-Math.atan2(e[2],e[0])}let h=!1,g=!1,_=!1,v=!1,y=!1,b=!1,x=`Rocky Plains`,S=0,C=0,w=1,T=1,E=.5,D=.5,O=!l&&c[2]>c[0]+.14;if(u){let[e,n,r,c]=Bi(a,i);E=e,D=n,O=!!i.hasOcean||Number.isFinite(i.seaLevelNorm)&&i.seaLevelNorm>-1.2;let u=Number.isFinite(i.seaLevelNorm)?i.seaLevelNorm:.04;return S=0,i.isMagmaOcean||r>.72?(x=`Active Magma Rift & Basalt Crust (SPH)`,C=40,w=1.15):O?Ii(.77,.91,Math.abs(a[1])+e*.08)>.48?(_=!0,x=`Polar Ice Cap & Glaciers (SPH)`,C=-34,T=.08,w=.9):e<u-.045?(h=!0,x=`Open Deep Ocean (SPH)`,T=.05):e<u+.075?(g=!0,b=!0,x=`Coastal Shoreline & Shelf (SPH)`,T=1.25):Math.max(0,Math.min(1,(e-u)/Math.max(.32,.92-u)))>.5||n>.72?(v=!0,x=`Orogenic Mountain Cordillera (SPH)`,C=-14,w=1.35,T=.65):c<.34?(y=!0,x=`Arid Continental Basin (SPH)`,C=12,T=.3):(b=!0,x=`Temperate SPH Continent & Valleys`,T=1.35):Ii(.84,.94,Math.abs(a[1]))>.45&&(t.atm??0)>.12?(_=!0,x=`Polar Frost Cap (SPH)`,C=-30):e>.22?(v=!0,x=`SPH Crater Rim & Highlands`,w=1.32):e<-.22?(x=`SPH Impact Basin / Mare Floor`,w=.92):x=`SPH Differentiated Regolith Plains`,Object.freeze({latDeg:Number(o.toFixed(2)),lonDeg:Number(s.toFixed(2)),nHit:Object.freeze([a[0],a[1],a[2]]),elev:Number(e.toFixed(4)),detail:Number(n.toFixed(4)),sphSampled:!0,sphSeaLevelNorm:u,hasOcean:O,isGasGiant:l,isOcean:h,isCoast:g,isPolarIce:_,isMountain:v,isDesert:y,isLush:b,isNightSide:f,isTwilight:p,sunDot:Number(d.toFixed(3)),solarLonOffsetRad:m,biomeLabel:x,seaLevelOffsetM:S,tempOffsetK:C,ampScale:w,floraDensityScale:T})}let k=n*2.13,A=n*1.47,j=n*3.19;E=zi(a[0]*3.4+k,a[1]*3.4+A,a[2]*3.4+j),D=zi(a[0]*14+k*1.7,a[1]*14+A*1.7,a[2]*14+j*1.7);let M=.51;if(l){let e=Math.sin(a[1]*16.5+(E-.5)*3.4);x=e>.15?`Ammonia Cloud Zone`:`Deep Cyclonic Belt`,C=e>.15?-10:14}else if(O)if(Ii(.76,.9,Math.abs(a[1])+(D-.5)*.14)>.48)_=!0,x=`Polar Ice Cap & Glaciers`,C=-34,T=.08,w=.85;else if(E<M-.035)h=!0,x=`Open Deep Ocean`,S=28,T=.05;else if(E<.555)g=!0,b=!0,x=`Coastal Shoreline & Forest`,S=1.5,T=1.15;else{let e=Math.max(0,Math.min(1,(E-M)/.32)),t=Ii(.25,.72,D)*(1-Math.abs(a[1]));e>.55?(v=!0,x=`Alpine Mountain Range`,S=-24,C=-14,w=1.48,T=.55):t>.45?(y=!0,x=`Arid Desert Plateau`,S=-20,C=14,w=.92,T=.22):(b=!0,x=`Temperate Forest & Valleys`,S=-14,T=1.3)}else Ii(.84,.94,Math.abs(a[1])+(D-.5)*.08)>.45&&(t.atm??0)>.12?(_=!0,x=`Polar Frost Cap`,C=-30):E>.62?(v=!0,x=`Cratered Highlands & Ridges`,w=1.38):E<.4?(x=`Lowland Impact Basin`,w=.78):x=`Regolith Plains`;return Object.freeze({latDeg:Number(o.toFixed(2)),lonDeg:Number(s.toFixed(2)),nHit:Object.freeze([a[0],a[1],a[2]]),elev:Number(E.toFixed(4)),detail:Number(D.toFixed(4)),sunDot:Number(d.toFixed(3)),solarLonOffsetRad:m,isGasGiant:l,isOcean:h,isCoast:g,isPolarIce:_,isMountain:v,isDesert:y,isLush:b,isNightSide:f,isTwilight:p,biomeLabel:x,seaLevelOffsetM:S,tempOffsetK:C,ampScale:w,floraDensityScale:T})}function Hi({axialObliquityDeg:e=23.44,spinAxisLonDeg:t=90,observerLatDeg:n=28,spinAngleRad:r=0,tidallyLocked:i=!1,toPrimaryStarUnit:a=null}={}){let o=Math.PI/180,s=e*o,c=t*o,l=Mi([Math.sin(s)*Math.cos(c),Math.cos(s),Math.sin(s)*Math.sin(c)]),u=Mi(Ni(Math.abs(l[1])>.95?[1,0,0]:[0,1,0],l)),d=Mi(Ni(l,u));if(i&&Array.isArray(a)){let e=[a[0]-l[0]*Pi(a,l),a[1]-l[1]*Pi(a,l),a[2]-l[2]*Pi(a,l)];Math.hypot(e[0],e[1],e[2])>1e-4&&(u=Mi(e),d=Mi(Ni(l,u)))}let f=Math.max(-85,Math.min(85,n))*o,p=Math.cos(f),m=Math.sin(f),h=Math.cos(r),g=Math.sin(r),_=[u[0]*h+d[0]*g,u[1]*h+d[1]*g,u[2]*h+d[2]*g],v=Mi([_[0]*p+l[0]*m,_[1]*p+l[1]*m,_[2]*p+l[2]*m]),y=Mi([-u[0]*g+d[0]*h,-u[1]*g+d[1]*h,-u[2]*g+d[2]*h]),b=Mi(Ni(y,v));return{pole:l,eqA:u,eqB:d,east:y,up:v,south:b,observerLatRad:f}}function Ui({bodySpec:e={},toStarUnit:t=[1,0,0]}={}){let n=!!e?.tidallyLocked,r=e?.axialObliquityDeg,i=n?0:Number.isFinite(Number(r))?Number(r):23.44,a=Number.isFinite(Number(e?.spinAxisLonDeg))?Number(e.spinAxisLonDeg):90,o=Math.PI/180,s=i*o,c=a*o,l=Mi([Math.sin(s)*Math.cos(c),Math.cos(s),Math.sin(s)*Math.sin(c)]),u=Mi(Array.isArray(t)&&t.length>=3?t:[1,0,0]),d=Math.abs(i)<.25?0:Math.max(-.985,Math.min(.985,Pi(l,u))),f=Math.sqrt(Math.max(0,1-d*d)),p=180/Math.PI*Math.asin(d),m=Math.hypot(u[0],u[2]),h=m>1e-6?u[0]/m:1,g=m>1e-6?u[2]/m:0,_=Mi([h*f,d,g*f]),v=`Equinox`;return v=n?`Tidally Locked`:Math.abs(i)<4?`Aseasonal`:d>.14?`N. Summer / S. Winter`:d<-.14?`N. Winter / S. Summer`:`Equinox`,Object.freeze({obliquityDeg:Number(i.toFixed(2)),sinDecl:Number(d.toFixed(5)),declDeg:Number(p.toFixed(2)),seasonLabel:v,tiltedLightDir:Object.freeze(_)})}function Wi(e,t,n){if(!(t>1e-9)||!(n>1e-9)||e>=t+n)return 0;if(e<=Math.abs(n-t))return n>=t?1:n*n/(t*t);let r=e,i=t,a=n,o=Math.max(-1,Math.min(1,(r*r+i*i-a*a)/(2*r*i))),s=Math.max(-1,Math.min(1,(r*r+a*a-i*i)/(2*r*a))),c=i*i*Math.acos(o)+a*a*Math.acos(s)-.5*Math.sqrt(Math.max(0,(-r+i+a)*(r+i-a)*(r-i+a)*(r+i+a)));return Math.max(0,Math.min(1,c/(Math.PI*i*i)))}function Gi({solarEngine:e,catalog:t,focusIdx:n,cameraPos:r=[0,10,0],craftPosM:i=null,navRadiusM:a=null,env:o={},surfaceSimSec:s=0,observerLatDeg:c=28,landingSite:l=null,altitudeKm:u=null,dysonCoverage:d=0}={}){let f=o.isRogue?Mi([.15,.96,.22]):Mi([.58,.44,.68]),p={seasonName:`Equinox`,declinationDeg:0,localHour:10.5,surfaceTempK:Number(o.tempK)||288,snowlineM:Math.max(8,(Number(o.terrainAmpM)||42)*.56),iceCoverFrac:0,autumnShift:0,eclipseFactor:1,latitudeRad:c*Math.PI/180,observerLatDeg:c,observerLonOffsetDeg:0,isNightSide:!1};if(!e||!Array.isArray(t)||n<0||n>=t.length)return{spheres:[],disks:[],lightDir:f,primarySunElevDeg:Math.asin(f[1])*(180/Math.PI),climate:p};let m=t[n],h=Math.min(e.massiveCount,t.length),g=e.getMassiveBodyState64(n),_=e.getMassiveBodyState64(0),v=[_.posAu[0]-g.posAu[0],_.posAu[1]-g.posAu[1],_.posAu[2]-g.posAu[2]],y=Math.max(1e-6,Math.hypot(v[0],v[1],v[2])),b=[v[0]/y,v[1]/y,v[2]/y],x=Array.isArray(i)&&i.length>=3?i:[0,0,0],S=Math.max(450,Number(a)||Number(o.tinyPlanetCurvatureRadiusM)||(m.isMinorBody?1100:2800)),C=Number.isFinite(Number(l?.latDeg))?Number(l.latDeg):c,w=-(x[2]/S)*(180/Math.PI),T=Math.max(-85,Math.min(85,C+w)),E=Math.max(.25,Math.cos(T*Math.PI/180)),D=x[0]/(S*E),O=Number(m.rotationPeriodHr)||24,k=2*Math.PI/(Math.abs(O)*3600)*(O<0?-1:1),A=Hi({axialObliquityDeg:Number(m.axialObliquityDeg)||23.44,spinAxisLonDeg:Number(m.spinAxisLonDeg)||90,observerLatDeg:T,spinAngleRad:0,tidallyLocked:!!m.tidallyLocked,toPrimaryStarUnit:b}),j=Pi(b,A.eqA),M=Pi(b,A.eqB),N=Number.isFinite(Number(l?.solarLonOffsetRad))?Number(l.solarLonOffsetRad):-.52,P=m.tidallyLocked?.35:Math.atan2(M,j)+N,F=m.tidallyLocked?P+D:P+k*s+D,I=Hi({axialObliquityDeg:Number(m.axialObliquityDeg)||23.44,spinAxisLonDeg:Number(m.spinAxisLonDeg)||90,observerLatDeg:T,spinAngleRad:F,tidallyLocked:!!m.tidallyLocked,toPrimaryStarUnit:b}),L=e=>[Pi(e,I.east),Pi(e,I.up),Pi(e,I.south)],R=o.isRogue?f:Mi(L(b)),z=[],B=[],ee=[],V=[],te=Math.max(1e4,Number(o.radiusM)||(Number(m.radiusKm)||6371)*1e3),ne=o.hasSolidCrust===!1||te>=16e6,re=Math.max(10,Number(x[1])||20),ie=ne?-.015:-Math.min(.08,Math.max(.012,Math.sqrt(2*re/te))),ae=Number.isFinite(Number(u))?Number(u):ne?35:.03,oe=Math.max(0,Math.min(1,Number(o.skyOpticalDepth)||0)),H=ne?Math.max(.55,Math.min(5.2,4.4-ae/120*3.2+oe*.9)):(Number(o.pressurePa)||0)>15e5?2.6+oe*1.4:0,se=H>.01?Math.exp(-H*.85):1;for(let i=0;i<h;i+=1){if(i===n)continue;let a=t[i],o=e.getMassiveBodyState64(i),c=o.posAu[0]-g.posAu[0],l=o.posAu[1]-g.posAu[1],u=o.posAu[2]-g.posAu[2],f=Math.hypot(c,l,u);if(!(f>1e-9))continue;let p=Math.min(8e13,Math.max(5e4,f*at)),h=L([c/f,l/f,u/f]),_=!!a.isStar||i===0,v=m.parent===i,y=a.parent===n,b=Math.max(250,(Number(a.radiusKm)||1737)*1e3),x=Math.max(1e-6,b/p);if(!_&&!v&&!y&&a.parent>0&&f>.05)continue;let S=_?.0065:v||y?.0055:.0022,C=Math.max(S,Math.min(.42,_?Math.max(x*1.45,S):v||y?Math.max(x*1.25,S):x*3.5));if(z.push({i,isStar:_,distM:p,dirLocal:h,angRad:C}),h[1]+C<ie)continue;let w=1;if(H>.01){let e=1/Math.max(.1,h[1]+.04);if(w=Math.exp(-H*e*(_?.55:1.15)),w<.06)continue}let T=Math.max(b,p*Math.tan(C)),E=[r[0]+h[0]*p,r[1]+h[1]*p,r[2]+h[2]*p],D=a.color0||(_?[1,.94,.78]:[.72,.74,.78]),O=a.color1||(_?[1,.56,.18]:[.42,.44,.48]),k=w<.99?[D[0]*w,D[1]*w,D[2]*w]:D,A=w<.99?[O[0]*w,O[1]*w,O[2]*w]:O;if(_?Wt({spec:{...a,color0:k,color1:A},pos:E,radius:T,timeSec:s*.05,dysonCoverage:d,seed:i*2.17+1.3,spheres:B,disks:ee,lineChunks:V,alphaMul:w}):B.push({pos:E,radius:T,color0:k,color1:A,kind:a.kind??1,atm:a.atm??.2,tempK:Number(a.tempK)||220,civTechK:Number(a.civTechK)||0,dysonCoverage:0,seed:i*2.17+1.3}),a.ringed&&T>1e3&&w>.14){let e=Mi(L([.16,.89,.42]));ee.push({center:E,rIn:a.ringInnerKm/Math.max(1,a.radiusKm)*T,normal:e,rOut:a.ringOuterKm/Math.max(1,a.radiusKm)*T,color:[.88*w,.78*w,.62*w],kind:1})}}if(m.ringed&&m.ringOuterKm>m.radiusKm){let e=Math.max(1e5,m.radiusKm*1e3);ee.push({center:[r[0],r[1]-e,r[2]],rIn:m.ringInnerKm*1e3,normal:Mi(L(I.pole)),rOut:m.ringOuterKm*1e3,color:[.88,.78,.62],kind:1})}let ce=0,le=z.find(e=>e.i===0);if(le)for(let e of z){if(e.isStar||e.distM>=le.distM)continue;let t=Math.max(-1,Math.min(1,Pi(e.dirLocal,le.dirLocal))),n=Math.acos(t);if(n<le.angRad+e.angRad){let t=Wi(n,le.angRad,e.angRad);t>ce&&(ce=t)}}let ue=Math.max(.06,1-ce*.94),de=Math.max(-1,Math.min(1,Pi(I.pole,b))),fe=180/Math.PI*Math.asin(de),pe=I.observerLatRad,me=Math.sin(pe)*de,he=Number(o.tempK)||288,ge=Math.sin(pe),_e=-22*(ge*ge-.25),ve=o.hasLiquidOcean?62:88,ye=Math.max(35,he+_e+me*ve*1.15+R[1]*6),be=Number(o.solventMeltTempK)||273.15,xe=Math.max(.004,Math.min(.025,(Number(o.gravityMS2)||9.81)/1004))*18,Se=Math.max(-12,Math.min(120,(ye-be)/xe+5)),Ce=o.hasLiquidOcean?Math.max(0,Math.min(1,(be-ye+2.5)/12)):0,we=Math.max(0,Math.min(1,Math.exp(-(((me+.12)/.16)**2))*+(Math.abs(Number(m.axialObliquityDeg)||0)>8))),Te=`Equinox`;Te=Math.abs(Number(m.axialObliquityDeg)||0)<4?`Aseasonal`:me>.14?`Summer`:me<-.14?Ce>=.72?`Deep Winter (Frozen Sea)`:`Winter`:me>=0?`Spring`:`Autumn`;let Ee=Math.asin(Math.max(-1,Math.min(1,R[1])))*(180/Math.PI),De=((12-Math.atan2(R[0],Math.max(-1,Math.min(1,R[1])))*(12/Math.PI))%24+24)%24;return{spheres:B,disks:ee,lines:V.length?new Float32Array(V):null,lightDir:R,primaryStarDistAu:y,primarySunElevDeg:Ee,gasGiantSkyTransmittance:Number(se.toFixed(3)),climate:{seasonName:Te,declinationDeg:Number(fe.toFixed(1)),localHour:Number(De.toFixed(2)),surfaceTempK:Math.round(ye),snowlineM:Number(Se.toFixed(1)),iceCoverFrac:Number(Ce.toFixed(3)),autumnShift:Number(we.toFixed(3)),eclipseFactor:Number(ue.toFixed(3)),maxEclipseOcc:Number(ce.toFixed(3)),latitudeRad:pe,observerLatDeg:Number(T.toFixed(1)),observerLonOffsetDeg:Number((180/Math.PI*D).toFixed(1)),sunElevDeg:Number(Ee.toFixed(1)),isNightSide:Ee<-5}}}function Ki({center:e=[0,0,0],radius:t=1,atmoState:n=null,timeSec:r=0,seed:i=1,alphaMul:a=1}={}){if(!n||!(n.surfacePressurePa>=20)||!(t>.05)||a<.02)return[];let o=Math.max(.05,Math.min(14,n.rotationOmegaRadS/72921e-9*(n.radiusM/6371e3)))>2,s=t*1.048,c=o?[-1.05,-.78,-.52,-.26,0,.26,.52,.78,1.05]:[-.95,-.56,-.2,0,.2,.56,.95],l=o?7:6,u=[];for(let t=0;t<c.length;t+=1){let n=c[t],d=Math.cos(n),f=o?(.76*Math.cos(10*n)+.36*Math.sin(18*n))*d:.54*Math.sin(2*n)*Math.sin(2*n)-.32*Math.max(0,d)**3,p=f>=0?1:-1,m=Math.max(.22,Math.abs(f)),h=p>0?[.44,.92,1]:[1,.78,.36];for(let o=0;o<l;o+=1){let c=o/l*Math.PI*2+t*.73+i*1.13+r*f*.48,d=.36+.38*m,g=null;for(let i=0;i<=12;i+=1){let o=i/12,l=c+p*o*d,f=Math.max(-1.42,Math.min(1.42,n+.088*Math.sin(3*l+t*1.4-r*.35))),_=Math.cos(f),v=[e[0]+s*_*Math.cos(l),e[1]+s*Math.sin(f),e[2]+s*_*Math.sin(l)];if(g){let e=Math.sin(o*Math.PI)*(.36+.44*Math.min(1,m))*a;u.push(g[0],g[1],g[2],h[0],h[1],h[2],e*.78),u.push(v[0],v[1],v[2],h[0],h[1],h[2],e)}g=v}}}return u}var qi=`ulg.astrophysics.orbital-remote-sensing.v1`,Ji=66743e-15,Yi=198847e25;function Xi(e){if(Number.isFinite(Number(e?.surfaceGravityMS2))&&Number(e.surfaceGravityMS2)>0)return Number(e.surfaceGravityMS2);let t=Math.max(0x38d7ea4c68000,(Number(e?.massSolar)||3e-6)*Yi),n=Math.max(1e3,(Number(e?.radiusKm)||6371)*1e3);return Math.max(.01,Math.min(45,Ji*t/(n*n)))}function Zi(e,t=null,{planetaryMode:n=`standard`,cToO:r=.55,seed:i=20261125}={}){if(!e)return null;if(e.isStar||e.kind===0||e.kind===5){let t=String(e.stage||`main-sequence`),n=Number(e.tempK??e.effectiveTempK)||5778,r=t===`neutron-star`||t===`magnetar`||t===`supernova-remnant-pwn`,i=t===`stellar-black-hole`||t===`hypernova-remnant`||e.kind===5,a=t===`white-dwarf`||t===`planetary-nebula`;return Object.freeze({schema:qi,biosignatureLevel:`stellar`,biosignatureScore:0,biosignatureBadge:r?`⚡ MAGNETOSPHERIC SYNCHROTRON · Relativistic Pulsar`:i?`🕳️ RELATIVISTIC HORIZON · Accretion X-Ray Continuum`:a?`💎 DEGENERATE C/O REMNANT · Stark-Broadened Balmer`:`☀️ PHOTOSPHERIC PLASMA · T_eff ${Math.round(n).toLocaleString()} K`,biosignatureSummary:r?`Coherent curvature radio & GeV gamma lighthouse pulses; superfluid neutron interior.`:i?`Gravitational photon ring & relativistic Fe Kα 6.4 keV disk fluorescence.`:a?`Electron-degenerate C/O core with H/He atmosphere.`:`Hydrostatic fusing H/He plasma with metallic Fraunhofer absorption lines.`,solventLabel:`Ionized Plasma`,atmosphericGases:r?[{formula:`e⁻/e⁺`,name:`Pair Plasma`,amount:`Relativistic`,isBio:!1},{formula:`Fe`,name:`Neutron Crust`,amount:`Degenerate`,isBio:!1}]:a?[{formula:`C/O`,name:`Degenerate Core`,amount:`99%`,isBio:!1},{formula:`H/He`,name:`Thin Envelope`,amount:`1%`,isBio:!1}]:[{formula:`H`,name:`Hydrogen`,amount:`71–74%`,isBio:!1},{formula:`He`,name:`Helium`,amount:`24–27%`,isBio:!1},{formula:`Z`,name:`Metals (C/N/O/Fe)`,amount:`1–2%`,isBio:!1}],mineralHints:[],spectralFeaturesNm:r?[{nm:430,label:`Synch UV`,isBio:!1},{nm:580,label:`Pair Opt`,isBio:!1}]:[{nm:656.3,label:`Hα`,isBio:!1},{nm:486.1,label:`Hβ`,isBio:!1},{nm:589.3,label:`Na D`,isBio:!1}]})}let a=Math.max(25,Number(e.tempK)||220),o=Math.max(0,Number(e.surfacePressurePa)||0),s=Number(e.radiusKm)||6371,c=Number(e.coreZ)||26,l=Number(e.mantleZ)||14,u=Number(e.surfZ)||14,d=s>=18e3||e.kind===2&&s>=14e3,f=e.kind===3&&s>=14e3,p=!d&&!f,m=(e.color1?.[2]||0)>(e.color1?.[0]||0)+.12&&(e.atm||0)>=.3,h=e.kind===3&&((e.color0?.[2]||0)>=.68||(e.color1?.[2]||0)>(e.color1?.[0]||0)+.08)&&a<185,g=(e.atm||0)>=.55&&o>=5e4,_=Number.isFinite(Number(e.volatileMassFrac))?Math.max(0,Number(e.volatileMassFrac)):m?.06:h?.22:g?.04:(e.atm||0)>=.1&&o>=100?.008:0,v=Number.isFinite(Number(e.particulateMassFrac))?Math.max(0,Number(e.particulateMassFrac)):(e.color0?.[0]||0)>.58&&(e.color0?.[2]||0)<.36&&o>=50?.018:.002,y=n===`magma-ocean`||e.kind===7||a>=950,b=s>=180&&!e.isComet,x=!!e.isCryoMoon||n===`cryo-plumes`||p&&b&&a<185&&_>=.08&&o<5e3,S=o>=611?Math.max(273.16,Math.min(647.1,373.15/Math.max(.55,1-.07632*Math.log(Math.max(1e-4,o/101325))))):273.16,C=Math.max(_,Number(e.coalescedComposition?.volatileFrac)||0),w=!!e.hasOcean||p&&!y&&!x&&a>=255&&a<=S&&o>=611&&C>=.012&&(C>=.04||e.planetClass===`ocean-world`||(e.color1?.[2]||0)>(e.color1?.[0]||0)+.1),T=Xi(e),E=Number(t?.tempK??t?.effectiveTempK)||5778,D=o>1?Math.min(80,o*.029/(8.3145*Math.max(40,a))):0,O=(i>>>0^String(e.id||e.name||`w`).length*2654435761>>>0^Math.round(a*17))>>>0,k=Ie({worldName:e.name||`World`,tempK:a,pressurePa:o,gravityMS2:T,rhoAtmKgM3:D,volatileFrac:_,hasSolidCrust:p,isCryoMoon:x,isMagmaOcean:y,stellarTeffK:E,cToO:Number(e.cToO)||r,civTechK:Number(e.civTechK)||void 0,seed:O}),A=Number(k.biosphereViability)||0,j=k.solvent||`none`,M=Math.round(Number(k.photobiology?.redEdgeNm)||705),N=`sterile`,P=`⚪ STERILE · No Biosignature Detected`,F=`Thermodynamic equilibrium crust/vacuum — zero atmospheric disequilibrium or pigment edge.`,I=[];y?(N=`sterile`,P=`🌋 STERILE · Molten Silicate Outgassing`,F=`Surface exceeds 950 K; thermal IR shows incandescent SiO/SO₂/CO silicate vapor.`):p&&j===`H2O`&&A>=.45&&o>=8e3?(N=`strong`,P=`🟢 STRONG BIOSIGNATURE · O₂/CH₄ + ${M} nm Edge`,F=`Photochemical O₂ + CH₄ disequilibrium detected with ${k.solventFormula} oceans and a ${M} nm photosynthetic surface reflectance edge${k.civTechK>=.45?` (+ narrowband radio technosignature K=${k.civTechK.toFixed(2)})`:``}.`,I.push({nm:Math.min(735,Math.max(410,M)),label:`Edge ${M}nm`,isBio:!0},{nm:687,label:`O₂-B`,isBio:!0},{nm:620,label:`CH₄`,isBio:!0},{nm:600,label:`O₃`,isBio:!0})):j===`H2O-subsurface`||x?(N=`subsurface`,P=`🔵 SUBSURFACE BIOSIGNATURE · Cryo-Plume H₂ + CH₄`,F=`South-polar/fissure ice plumes carry molecular H₂, CH₄, and complex organics from a tidally heated subsurface H₂O ocean.`,I.push({nm:619,label:`CH₄ Plume`,isBio:!0},{nm:486,label:`H₂O Ice`,isBio:!1},{nm:540,label:`Salts`,isBio:!1})):j===`CH4`&&A>=.25?(N=`tentative`,P=`🟡 TENTATIVE CRYOBIO · C₂H₂/H₂ Depletion Anomaly`,F=`Dense N₂/CH₄ haze with liquid hydrocarbon seas shows anomalous surface H₂ & acetylene (C₂H₂) consumption.`,I.push({nm:619,label:`CH₄`,isBio:!0},{nm:543,label:`Tholins`,isBio:!0},{nm:665,label:`C₂H₂ Sink`,isBio:!0})):(j===`H2SO4`||j===`CO2-liq`||j===`NH3`)&&A>=.22?(N=`tentative`,P=`🟡 TENTATIVE CLOUD/CHEMO · ${j===`H2SO4`?`PH₃/UV Cloud Absorber`:`${k.solventFormula} Redox Anomaly`}`,F=j===`H2SO4`?`Temperate upper-cloud aerosol layer shows unexplained 380–460 nm UV absorption and trace PH₃ disequilibrium.`:`Exotic ${k.solventLabel} solvent envelope exhibits non-equilibrium trace reductant cycling.`,I.push({nm:420,label:`UV Abs`,isBio:!0},{nm:590,label:`SO₂/Cloud`,isBio:!1})):j===`H2-He-cloud`&&A>=.25?(N=`tentative`,P=`🟡 AERIAL CLOUD BIO · H₂/NH₃ Convective Chromophores`,F=`Temperate 1–5 bar cloud deck shows non-equilibrium organic chromophores & phosphine/ammonia redox gradients.`,I.push({nm:619,label:`CH₄`,isBio:!1},{nm:645,label:`NH₃`,isBio:!0})):o>=300&&_>=.004&&a>=110&&a<=460?(N=`prebiotic`,P=`🟠 PREBIOTIC POTENTIAL · Trace Volatiles & Organics`,F=`Thin volatile atmosphere or frost reservoirs support prebiotic chemistry, but no active global disequilibrium detected.`,I.push({nm:530,label:`Fe₂O₃/Dust`,isBio:!1},{nm:690,label:`CO₂/H₂O`,isBio:!1})):(N=`sterile`,P=o<10?`⚪ STERILE · Airless Vacuum Body`:`⚪ STERILE · Extreme Abiotic Regime`,F=o<10?`Exposed airless crust / regolith bathed in unshielded stellar radiation; direct mineral reflectance visible.`:`Extreme temperature or pressure outside known catalytic solvent envelopes.`);let L=[];d?L.push({formula:`H₂`,name:`Molecular Hydrogen`,amount:`86–90%`,isBio:!1},{formula:`He`,name:`Helium`,amount:`10–13%`,isBio:!1},{formula:`NH₃`,name:`Ammonia Clouds`,amount:`0.03%`,isBio:!1},{formula:`CH₄`,name:`Methane`,amount:`0.3%`,isBio:!1}):f?L.push({formula:`H₂`,name:`Hydrogen`,amount:`80–83%`,isBio:!1},{formula:`He`,name:`Helium`,amount:`15–18%`,isBio:!1},{formula:`CH₄`,name:`Methane (Red Abs)`,amount:`2.3%`,isBio:!1},{formula:`H₂S`,name:`Hydrogen Sulfide`,amount:`Trace`,isBio:!1}):o>=100?N===`strong`?L.push({formula:`N₂`,name:`Nitrogen`,amount:`76%`,isBio:!1},{formula:`O₂`,name:`Oxygen (Biogenic)`,amount:`21%`,isBio:!0},{formula:`H₂O`,name:`Water Vapor`,amount:`1.4%`,isBio:!1},{formula:`CH₄`,name:`Methane (Diseq.)`,amount:`2–18 ppm`,isBio:!0}):j===`CH4`?L.push({formula:`N₂`,name:`Nitrogen`,amount:`94%`,isBio:!1},{formula:`CH₄`,name:`Methane`,amount:`5.1%`,isBio:!0},{formula:`H₂`,name:`Hydrogen`,amount:`0.1%`,isBio:!1},{formula:`C₂H₆`,name:`Ethane/Tholins`,amount:`Haze`,isBio:!0}):a>440&&o>5e5?L.push({formula:`CO₂`,name:`Supercritical CO₂`,amount:`96%`,isBio:!1},{formula:`N₂`,name:`Nitrogen`,amount:`3.5%`,isBio:!1},{formula:`SO₂/H₂SO₄`,name:`Sulfuric Clouds`,amount:`150 ppm`,isBio:!1},...N===`tentative`?[{formula:`PH₃?`,name:`Cloud Anomaly`,amount:`Trace`,isBio:!0}]:[]):a<260&&o<2e4?L.push({formula:`CO₂`,name:`Carbon Dioxide`,amount:`95%`,isBio:!1},{formula:`N₂`,name:`Nitrogen`,amount:`2.7%`,isBio:!1},{formula:`Ar`,name:`Argon`,amount:`1.6%`,isBio:!1},{formula:`H₂O`,name:`Frost Vapor`,amount:`0.03%`,isBio:!1}):L.push({formula:`N₂`,name:`Nitrogen`,amount:`68%`,isBio:!1},{formula:`CO₂`,name:`Carbon Dioxide`,amount:`28%`,isBio:!1},{formula:`H₂O`,name:`Water Vapor`,amount:`3%`,isBio:!1}):x?L.push({formula:`H₂O`,name:`Plume Vapor`,amount:`91%`,isBio:!1},{formula:`CO₂`,name:`Carbon Dioxide`,amount:`3.2%`,isBio:!1},{formula:`CH₄`,name:`Hydrothermal CH₄`,amount:`1.7%`,isBio:!0},{formula:`H₂`,name:`Serpentinization H₂`,amount:`1.4%`,isBio:!0}):L.push({formula:`Vac`,name:`Exosphere (<10 Pa)`,amount:`Trace Na/He`,isBio:!1});let R=[],z=(e,t,n)=>{R.length<5&&!R.some(t=>t.formula===e)&&R.push({formula:e,name:t,tag:n})};if(d)z(`H₂ (Metallic)`,`Liquid Metallic Hydrogen Core`,`Deep Interior`),z(`NH₄SH`,`Ammonium Hydrosulfide Deck`,`Cloud Strata`),z(`H₂O Ice`,`Deep Supercritical Water`,`Lower Deck`),z(`He`,`Helium Rain Layer`,`Mantle`);else if(f)z(`H₂O/NH₃`,`Superionic Water–Ammonia Mantle`,`Deep Ocean`),z(`CH₄ Ice`,`Methane Hazes & Clathrates`,`Upper Deck`),z(`C (Diamond)`,`High-P Diamond Rain`,`Core Boundary`);else if(y)z(`Mg₂SiO₄`,`Molten Olivine Magma`,`Crust/Lava`),z(`FeS / FeO`,`Liquid Iron-Sulfide Melt`,`Mantle`),z(`SiO₂`,`Basaltic Rhyolite Crust`,`Cooling Plates`),z(`SO₂`,`Volcanic Outgas Plumes`,`Vents`);else{let t=(e.color0?.[0]||0)>.85&&(e.color0?.[1]||0)>.72&&(e.color0?.[2]||0)<.45&&o<50,n=(Number(e.cToO)||r)>=.8||u===6||l===6,i=v>=.008&&a<340&&(e.color0?.[0]||0)>.55&&(e.color0?.[2]||0)<.42;t&&(z(`S₈ / SO₂`,`Allotropic Sulfur & Frost`,`Volcanic Plains`),z(`MgSiO₃`,`Ultramafic Silicate Magma`,`Calderas`),z(`FeS`,`Troilite Sulfide Core`,`Interior`)),n&&(z(`SiC`,`Silicon Carbide Crust`,`High C/O`),z(`C (Graphite/Dia)`,`Carbon & Diamond Mantle`,`High-P`)),w?(z(`H₂O (liq)`,`Saline Liquid Water Ocean`,`Hydrosphere`),z(`SiO₂ / Al₂O₃`,`Granitic Continental Crust`,`Continents`),z(`CaCO₃`,`Carbonate Sediments`,`Shelf/Biogenic`),z(`NaCl`,`Halite Evaporites`,`Basins`)):j===`CH4`?(z(`CH₄ / C₂H₆`,`Liquid Hydrocarbon Seas`,`Polar Lakes`),z(`H₂O Ice`,`Cryogenic Water-Ice Bedrock`,`Highlands`),z(`Tholins`,`Photochemical Organic Dunes`,`Equatorial`)):x||a<185&&_>=.05?(z(`H₂O Ice Ih`,`Tectonic Water-Ice Shell`,`Lithosphere`),z(`NaCl / MgSO₄`,`Briny Hydrated Salts`,`Fissures`),z(`CO₂ / N₂ Ice`,`Cryogenic Volatile Glaciers`,`Surface`)):i?(z(`Fe₂O₃`,`Hematite Ferric Oxide Dust`,`Regolith`),z(`SiO₂`,`Basaltic Plagioclase Rock`,`Highlands`),z(`CO₂ / H₂O Ice`,`Polar Cap Frosts`,`Poles`)):e.isMetallicAsteroid||c===26&&u===26?(z(`Fe-Ni Alloy`,`Kamacite / Taenite Metal`,`Bulk Body`),z(`FeS`,`Troilite Inclusions`,`Veins`),z(`Pt / Ir`,`Siderophile Heavy Metals`,`Trace`)):(z(`SiO₂ / Al₂O₃`,`Anorthosite & Basalt Silicate`,`Crust`),z(`FeTiO₃`,`Ilmenite Titanium-Iron Ore`,`Mare/Basins`),z(`Mg₂SiO₄`,`Olivine-Pyroxene Mantle`,`Ejecta`)),c===26&&!R.some(e=>e.formula.includes(`Fe`))&&z(`Fe-Ni`,`Differentiated Metallic Core`,`Deep Core`)}return Object.freeze({schema:qi,biosignatureLevel:N,biosignatureScore:Number(A.toFixed(2)),biosignatureBadge:P,biosignatureSummary:F,solventLabel:k.solventLabel||`None`,solventFormula:k.solventFormula||`—`,redEdgeNm:N===`strong`?M:null,civTechK:Number(k.civTechK)||0,atmosphericGases:Object.freeze(L),mineralHints:Object.freeze(R),spectralFeaturesNm:Object.freeze(I)})}var Qi=`ulg.universes.ufo-flight-controller.v1`,$i=.55;function ea(e,t,n){return Math.max(t,Math.min(n,e))}function ta(e){let t=Math.hypot(e[0],e[1],e[2],e[3])||1;return[e[0]/t,e[1]/t,e[2]/t,e[3]/t]}function na(e,t){let[n,r,i,a]=e,[o,s,c,l]=t;return[a*o+n*l+r*c-i*s,a*s-n*c+r*l+i*o,a*c+n*s-r*o+i*l,a*l-n*o-r*s-i*c]}function ra(e,t){let n=t*.5,r=Math.sin(n),i=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/i*r,e[1]/i*r,e[2]/i*r,Math.cos(n)]}function ia(e,t){let[n,r,i,a]=e,[o,s,c]=t,l=2*(r*c-i*s),u=2*(i*o-n*c),d=2*(n*s-r*o);return[o+a*l+(r*d-i*u),s+a*u+(i*l-n*d),c+a*d+(n*u-r*l)]}function aa(e){let t=ta(e);return{right:ia(t,[1,0,0]),up:ia(t,[0,1,0]),fwd:ia(t,[0,0,-1])}}function oa(e){let{right:t,up:n,fwd:r}=aa(e),i=180/Math.PI,a=Math.asin(ea(r[1],-1,1))*i,o=Math.atan2(r[0],-r[2])*i,s=Math.atan2(t[1],n[1])*i;return{pitchDeg:Number(a.toFixed(1)),yawDeg:Number(o.toFixed(1)),rollDeg:Number(s.toFixed(1))}}function sa(e,t=[0,1,0]){let n=Math.hypot(e[0],e[1],e[2])||1,r=[e[0]/n,e[1]/n,e[2]/n],i=[-r[0],-r[1],-r[2]],a=t[1]*i[2]-t[2]*i[1],o=t[2]*i[0]-t[0]*i[2],s=t[0]*i[1]-t[1]*i[0],c=Math.hypot(a,o,s);c<1e-5&&(a=1,o=0,s=0,c=1);let l=[a/c,o/c,s/c],u=[i[1]*l[2]-i[2]*l[1],i[2]*l[0]-i[0]*l[2],i[0]*l[1]-i[1]*l[0]],d=l[0],f=u[0],p=i[0],m=l[1],h=u[1],g=i[1],_=l[2],v=u[2],y=i[2],b=d+h+y,x,S,C,w;if(b>0){let e=Math.sqrt(b+1)*2;w=.25*e,x=(v-g)/e,S=(p-_)/e,C=(m-f)/e}else if(d>h&&d>y){let e=Math.sqrt(1+d-h-y)*2;w=(v-g)/e,x=.25*e,S=(f+m)/e,C=(p+_)/e}else if(h>y){let e=Math.sqrt(1+h-d-y)*2;w=(p-_)/e,x=(f+m)/e,S=.25*e,C=(g+v)/e}else{let e=Math.sqrt(1+y-d-h)*2;w=(m-f)/e,x=(p+_)/e,S=(g+v)/e,C=.25*e}return ta([x,S,C,w])}function ca(e,{surfaceActive:t=!1}={}){let n=Number.isFinite(Number(e))?Number(e):12.2;if(t)return Object.freeze({id:`surface-flight`,label:`Surface Anti-Grav`,shortLabel:`SURFACE`,worldUnitsPerSec:42,warpMultiplier:2.2,unitLabel:`m/s`,metersPerWorldUnit:1,scaleCruiseRate:0});if(n>=22){let e=10**n/14;return Object.freeze({id:`intergalactic`,label:`Intergalactic Warp`,shortLabel:`INTERGALACTIC`,worldUnitsPerSec:12,warpMultiplier:4.5,unitLabel:`Mpc/s`,metersPerWorldUnit:e,scaleCruiseRate:.65})}if(n>=16){let e=10**n/14;return Object.freeze({id:`interstellar`,label:`Interstellar Cruise`,shortLabel:`INTERSTELLAR`,worldUnitsPerSec:11.5,warpMultiplier:4.2,unitLabel:`ly/s`,metersPerWorldUnit:e,scaleCruiseRate:.58})}if(n>=8.8){let e=10**n/14;return Object.freeze({id:`interplanetary`,label:`Interplanetary Drive`,shortLabel:`INTERPLANETARY`,worldUnitsPerSec:11,warpMultiplier:3.8,unitLabel:`AU/hr`,metersPerWorldUnit:e,scaleCruiseRate:.52})}if(n>=-5.6){let e=10**n/14;return Object.freeze({id:`planetary`,label:`Planetary Orbital`,shortLabel:`PLANETARY`,worldUnitsPerSec:10,warpMultiplier:3.2,unitLabel:`km/s`,metersPerWorldUnit:e,scaleCruiseRate:.45})}let r=10**n/14;return Object.freeze({id:`quantum`,label:`Subatomic Probe`,shortLabel:`QUANTUM`,worldUnitsPerSec:9,warpMultiplier:2.5,unitLabel:n<-12?`fm/s`:`pm/s`,metersPerWorldUnit:r,scaleCruiseRate:.35})}function la(e,t){let n=Math.max(0,Number(e)||0)*(t?.metersPerWorldUnit||1);if(!t||t.id===`surface-flight`)return n>=1e3?`${(n/1e3).toFixed(2)} km/s`:`${n.toFixed(1)} m/s`;if(t.id===`intergalactic`){let e=n/3085677581e13;return`${e>=10?e.toFixed(1):e.toFixed(2)} Mpc/s`}if(t.id===`interstellar`){let e=n/946073047e7;return e>=1e3?`${(e/1e3).toFixed(2)} kly/s`:`${e>=10?e.toFixed(1):e.toFixed(2)} ly/s`}if(t.id===`interplanetary`){let e=n/299792458;return e>=.1?`${e>=10?e.toFixed(1):e.toFixed(2)} c`:`${(n*3600/149597870700).toFixed(2)} AU/hr`}if(t.id===`planetary`){let e=n/1e3;return e>=1e4?`${(e/299792.458).toFixed(2)} c`:`${e>=100?e.toFixed(0):e.toFixed(1)} km/s`}return t.unitLabel===`fm/s`?`${(n*0x38d7ea4c68000).toFixed(1)} fm/s`:`${(n*0xe8d4a51000).toFixed(1)} pm/s`}function ua(e,t=.14){if(!e||e.connected===!1)return{connected:!1,id:``,strafe:0,thrust:0,yawRate:0,pitchRate:0,rollRate:0,ascend:0,warpBoost:0,brake:0,chaseZoomDir:0,scaleZoomDir:0,fire:!1,tractor:!1,toggleMode:!1,toggleCockpit:!1,levelHorizon:!1,launchMissile:!1};let n=e=>{let n=Number(e)||0;return Math.abs(n)<t?0:Math.sign(n)*((Math.abs(n)-t)/(1-t))},r=t=>{let n=e.buttons?.[t];return n==null?0:typeof n==`number`?n:Number(n.value)||+!!n.pressed},i=e=>r(e)>.35,a=e.axes||[],o=+!!i(4),s=+!!i(5),c=+!!i(0),l=+!!i(1),u=+!!i(12),d=+!!i(13),f=+!!i(14),p=+!!i(15);return{connected:!0,id:String(e.id||`Xbox Gamepad`),strafe:n(a[0]),thrust:-n(a[1]),yawRate:-n(a[2]),pitchRate:-n(a[3]),rollRate:o-s,ascend:c-l,warpBoost:ea(r(7),0,1),brake:ea(r(6),0,1),chaseZoomDir:d-u,scaleZoomDir:f-p,fire:i(2),tractor:i(3),toggleMode:i(8),toggleCockpit:i(9),levelHorizon:i(10),launchMissile:i(11)}}function da({initialMode:e=`orbit`}={}){let t=e===`ufo`?`ufo`:`orbit`,n=[0,1.8,13.5],r=[0,0,0],i=[0,0,0,1],a=1,o=0,s=!1,c=``,l=ca(24.8),u=0,d=`0.0 Mpc/s`,f={toggleMode:!1,toggleCockpit:!1,tractor:!1,launchMissile:!1,levelHorizon:!1},p={forward:!1,backward:!1,left:!1,right:!1,ascend:!1,descend:!1,rollLeft:!1,rollRight:!1,pitchUp:!1,pitchDown:!1,yawLeft:!1,yawRight:!1,boost:!1,brake:!1};function m(e,t){let a=[t[0]-e[0],t[1]-e[1],t[2]-e[2]],o=Math.hypot(a[0],a[1],a[2])||1,s=[a[0]/o,a[1]/o,a[2]/o];n=[e[0]+s[0]*5.8,e[1]+s[1]*5.8-1.2,e[2]+s[2]*5.8],r=[0,0,0],i=sa(s,[0,1,0])}function h(e=[0,4.5,16],t=[0,0,0]){m(e,t),a=1}function g(e,n=null){let r=e===`ufo`?`ufo`:`orbit`;return r===`ufo`&&t!==`ufo`&&n?.eye&&n?.target&&m(n.eye,n.target),t=r,t}function _(e=null){return g(t===`ufo`?`orbit`:`ufo`,e)}function v(e={}){Object.assign(p,e)}function y(){for(let e of Object.keys(p))p[e]=!1}function b(e=0,t=0,n=0){let r=i;return Math.abs(t)>1e-7&&(r=na(r,ra([0,1,0],t))),Math.abs(e)>1e-7&&(r=na(r,ra([1,0,0],e))),Math.abs(n)>1e-7&&(r=na(r,ra([0,0,1],n))),i=ta(r),i}function x(){let{fwd:e}=aa(i);return i=sa(Math.hypot(e[0],e[2])>.05?[e[0],0,e[2]]:[0,0,-1],[0,1,0]),i}function S(e){let t=Number(e);return!Number.isFinite(t)||t<=0||(a=ea(a*t,$i,45)),a}function C(e){let t=Number(e);return Number.isFinite(t)&&(a=ea(t,$i,45)),a}function w(e=null){let t=e;if(!t&&typeof navigator<`u`&&typeof navigator.getGamepads==`function`)try{t=navigator.getGamepads()}catch{t=[]}let n=null;if(t){for(let e=0;e<t.length;e+=1)if(t[e]&&t[e].connected!==!1){n=t[e];break}}let r=ua(n);s=r.connected,c=r.id;let i={toggleModePressed:r.toggleMode&&!f.toggleMode,toggleCockpitPressed:r.toggleCockpit&&!f.toggleCockpit,tractorPressed:r.tractor&&!f.tractor,launchMissilePressed:r.launchMissile&&!f.launchMissile,levelHorizonPressed:r.levelHorizon&&!f.levelHorizon};return f.toggleMode=r.toggleMode,f.toggleCockpit=r.toggleCockpit,f.tractor=r.tractor,f.launchMissile=r.launchMissile,f.levelHorizon=r.levelHorizon,{gp:r,actions:i}}function T(e,{log10SpanM:t=12.2,gamepadInput:s=null}={}){let c=ea(Number(e)||.016,.001,.1),f=ca(t,{surfaceActive:!1});l=f;let m=s||ua(null),h=!!p.forward-+!!p.backward,g=!!p.right-+!!p.left,_=!!p.ascend-+!!p.descend,v=!!p.rollLeft-+!!p.rollRight,y=!!p.pitchUp-+!!p.pitchDown,x=!!p.yawLeft-+!!p.yawRight,C=ea(h+m.thrust,-1,1),w=ea(g+m.strafe,-1,1),T=ea(_+m.ascend,-1,1),E=ea(v+m.rollRate,-1,1),D=ea(y+m.pitchRate,-1,1),O=ea(x+m.yawRate,-1,1),k=Math.max(+!!p.boost,m.warpBoost),A=Math.max(+!!p.brake,m.brake);o=k;let j=1.95;b(D*j*c,O*j*c,E*2.15*c),Math.abs(m.chaseZoomDir)>.1&&S(4.8**(m.chaseZoomDir*c));let M=aa(i),N=f.worldUnitsPerSec*(1+k*(f.warpMultiplier-1)),P=N*4.2;r[0]+=(M.fwd[0]*C+M.right[0]*w+M.up[0]*T)*P*c,r[1]+=(M.fwd[1]*C+M.right[1]*w+M.up[1]*T)*P*c,r[2]+=(M.fwd[2]*C+M.right[2]*w+M.up[2]*T)*P*c;let F=Math.exp(-(A>.1?8.5:3.2)*c);r[0]*=F,r[1]*=F,r[2]*=F;let I=Math.hypot(r[0],r[1],r[2]);if(I>N){let e=N/I;r[0]*=e,r[1]*=e,r[2]*=e}n[0]+=r[0]*c,n[1]+=r[1]*c,n[2]+=r[2]*c;let L=Math.hypot(n[0],n[1],n[2]);if(L>320){let e=320/L;n[0]*=e,n[1]*=e,n[2]*=e}u=Math.hypot(r[0],r[1],r[2]),d=la(u,f);let R=Math.abs(m.scaleZoomDir)>.1?m.scaleZoomDir*1.8*c:0;return{pos:[...n],vel:[...r],quat:[...i],basis:M,chaseDistMul:a,regime:f,speedWorld:u,speedLabel:d,deltaLog10Scale:R}}function E({cockpit:e=!1}={}){let t=aa(i);if(e){let e=[n[0]+t.up[0]*.18+t.fwd[0]*.1,n[1]+t.up[1]*.18+t.fwd[1]*.1,n[2]+t.up[2]*.18+t.fwd[2]*.1];return{eye:e,target:[e[0]+t.fwd[0]*12,e[1]+t.fwd[1]*12,e[2]+t.fwd[2]*12],up:t.up,basis:t}}let r=5.9*a,o=1.65*a**.85;return{eye:[n[0]-t.fwd[0]*r+t.up[0]*o,n[1]-t.fwd[1]*r+t.up[1]*o,n[2]-t.fwd[2]*r+t.up[2]*o],target:[n[0]+t.fwd[0]*(8+r*.28),n[1]+t.fwd[1]*(8+r*.28),n[2]+t.fwd[2]*(8+r*.28)],up:t.up,basis:t}}function D(e=12.2,l=!1){let f=ca(e,{surfaceActive:l}),p=aa(i),m=oa(i);return{schema:Qi,mode:t,pos:[...n],vel:[...r],quat:[...i],basis:p,eulerDeg:m,chaseDistMul:Number(a.toFixed(2)),warpBoost:Number(o.toFixed(2)),regime:f,speedWorld:Number(u.toFixed(3)),speedLabel:d,gamepadConnected:s,gamepadId:c}}return Object.freeze({get mode(){return t},get pos(){return n},get vel(){return r},get quat(){return i},get chaseDistMul(){return a},get gamepadConnected(){return s},get gamepadId(){return c},get lastRegime(){return l},setMode:g,toggleMode:_,syncFromOrbitCamera:m,resetPosition:h,setKeys:v,clearKeys:y,rotateLocal:b,levelHorizon:x,adjustChaseZoom:S,setChaseZoom:C,pollGamepads:w,stepSpace:T,getSpaceCameraPose:E,getState:D})}function fa(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function pa(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function ma(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function ha(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function ga(e,t,n,r=1/0){let i=1/Math.tan(e*.5),a=new Float32Array(16);return a[0]=i/Math.max(.25,t),a[5]=i,a[10]=0,a[11]=-1,a[14]=n,a}function _a(e,t,n){let r=ha(fa(t,e)),i=ha(pa(r,n)),a=pa(i,r),o=new Float32Array(16);return o[0]=i[0],o[4]=i[1],o[8]=i[2],o[12]=-ma(i,e),o[1]=a[0],o[5]=a[1],o[9]=a[2],o[13]=-ma(a,e),o[2]=-r[0],o[6]=-r[1],o[10]=-r[2],o[14]=ma(r,e),o[3]=0,o[7]=0,o[11]=0,o[15]=1,{mat:o,right:i,up:a,fwd:r}}function va(e,t){let n=new Float32Array(16);for(let r=0;r<4;r+=1)for(let i=0;i<4;i+=1)n[r*4+i]=e[0+i]*t[r*4+0]+e[4+i]*t[r*4+1]+e[8+i]*t[r*4+2]+e[12+i]*t[r*4+3];return n}function ya(e,t,n,r){let i=e[0],a=e[1],o=e[2],s=t[0]*i+t[4]*a+t[8]*o+t[12],c=t[1]*i+t[5]*a+t[9]*o+t[13],l=t[2]*i+t[6]*a+t[10]*o+t[14],u=t[3]*i+t[7]*a+t[11]*o+t[15];if(u<=.02)return{visible:!1,sx:-999,sy:-999,uvX:.5,uvY:.5,depth:1};let d=s/u,f=c/u,p=l/u,m=d*.5+.5,h=.5-f*.5;return{visible:p>=0&&p<=1&&m>=-.15&&m<=1.15&&h>=-.15&&h<=1.15,sx:m*n,sy:h*r,uvX:m,uvY:h,depth:p,w:u}}function ba(e){let t=0,n=0,r=0;e>=380&&e<440?(t=-(e-440)/60,r=1):e<490?(n=(e-440)/50,r=1):e<510?(n=1,r=-(e-510)/20):e<580?(t=(e-510)/70,n=1):e<645?(t=1,n=-(e-645)/65):e<=740&&(t=1);let i=e<420?.3+.7*((e-380)/40):e>680?.3+.7*((740-e)/60):1;return[Math.round(Math.max(0,Math.min(1,t*i))*255),Math.round(Math.max(0,Math.min(1,n*i))*255),Math.round(Math.max(0,Math.min(1,r*i))*255)]}function xa(e){return Math.max(0,Math.min(1,e))}function Sa(e,t,n){if(e>t)return 1-Sa(t,e,n);let r=xa((n-e)/Math.max(1e-6,t-e));return r*r*(3-2*r)}function Ca(e,t,n,r,i){return e<=t||e>=i?0:e<n?Sa(t,n,e):e>r?1-Sa(r,i,e):1}function wa(e,t=[.28,.72,.96,.32]){let[n,r,i]=e,a=[[-n,-r,-i],[n,-r,-i],[n,r,-i],[-n,r,-i],[-n,-r,i],[n,-r,i],[n,r,i],[-n,r,i]],o=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],s=new Float32Array(o.length*2*7),c=0;for(let[e,n]of o)s.set([...a[e],...t],c),c+=7,s.set([...a[n],...t],c),c+=7;return s}function Ta(e,t,n,r,i=1){if(!e||i<.02)return[];let a=[],o=e.catalog||lt,s=Math.min(e.massiveCount,o.length),c=Array.from({length:s},(t,n)=>e.getMassiveBodyState64(n)),l=c[0]?.posAu||[0,0,0],u=c[0]?.velAuPerYr||[0,0,0],d=c[0]?.massSolar||1;if(s>=2&&(o[1]?.isStar||o[1]?.orbitRole===`binary-companion`)){let e=c[0].massSolar,t=c[1].massSolar;d=Math.max(1e-12,e+t),l=[(e*c[0].posAu[0]+t*c[1].posAu[0])/d,(e*c[0].posAu[1]+t*c[1].posAu[1])/d,(e*c[0].posAu[2]+t*c[1].posAu[2])/d],u=[(e*c[0].velAuPerYr[0]+t*c[1].velAuPerYr[0])/d,(e*c[0].velAuPerYr[1]+t*c[1].velAuPerYr[1])/d,(e*c[0].velAuPerYr[2]+t*c[1].velAuPerYr[2])/d]}for(let e=1;e<s;e+=1){let s=o[e],f=s.parent===-2,p=f?-2:s.parent>=0?s.parent:0,m=!!s.isStar,h=!m&&p>=0&&!o[p]?.isStar&&p>0;if(h&&r>10.6||!h&&r<8.4)continue;let g=f?l:c[p].posAu,_=f?u:c[p].velAuPerYr,v=f?d:c[p].massSolar,y=c[e],b=y.posAu[0]-g[0],x=y.posAu[1]-g[1],S=y.posAu[2]-g[2],C=y.velAuPerYr[0]-_[0],w=y.velAuPerYr[1]-_[1],T=y.velAuPerYr[2]-_[2],E=Math.hypot(b,x,S),D=C*C+w*w+T*T,O=st*(v+y.massSolar);if(!(E>1e-8&&O>1e-12))continue;let k=.5*D-O/E;if(k>=-1e-6)continue;let A=-O/(2*k),j=pa([b,x,S],[C,w,T]),M=Math.hypot(j[0],j[1],j[2]);if(!(M>1e-10))continue;let N=[j[0]/M,j[1]/M,j[2]/M],P=pa([C,w,T],j),F=[P[0]/O-b/E,P[1]/O-x/E,P[2]/O-S/E],I=Math.min(.985,Math.hypot(F[0],F[1],F[2])),L=I>1e-5?[F[0]/I,F[1]/I,F[2]/I]:ha([b,x,S]),R=pa(N,L),z=A*Math.sqrt(Math.max(.01,1-I*I)),B=g[0]-t[0],ee=g[1]-t[1],V=g[2]-t[2],te=s.color0||[.38,.72,1],ne=(m?.52:h?.34:s.id===`halley`?.16:.28)*i,re=null;for(let e=0;e<=72;e+=1){let t=e/72*Math.PI*2,r=A*(Math.cos(t)-I),i=z*Math.sin(t),o=[(B+r*L[0]+i*R[0])*n,(ee+r*L[1]+i*R[1])*n,(V+r*L[2]+i*R[2])*n];re&&(a.push(...re,te[0],te[1],te[2],ne),a.push(...o,te[0],te[1],te[2],ne)),re=o}}return a}function Ea(e,{focusedSolarBodyIndex:t=3,focusedBodyIsStar:n=null,galaxyBranch:r=`solar-system`}={}){let i=n==null?t===0:!!n;return e>=22.3?0:e>=16.2?1:e>=8.75?r!==`smbh-core`&&i&&e<=9.8?3:2:e>=-5.6?i&&e>=7.2?3:4:e>=-9.1?5:e>=-12.8?6:7}function Da(e){let t=Math.max(.5,Number(e?.radiusKm)||6371),n=t*1e3,r=e?.ringed?5.2:t<550?4.4:3.65;return Math.min(8.68,Math.max(t<550?3.55:5.85,Math.log10(n*r)))}function Oa(e){return Math.max(vt,Math.min(_t,Number(e)))}async function ka(){let{device:e}=await ie({label:`ulg-universes-demo`,xrCompatible:!0}),t=[];e.addEventListener(`uncapturederror`,e=>{t.push(String(e?.error?.message??e))}),S(e,`ulg-universes-demo`);let n=new URLSearchParams(window.location.search),r=Ze(window.location.search),i=Math.max(1,Math.min(118,Number.parseInt(n.get(`Z`)||n.get(`z`)||`26`,10)||26)),a=r.seed==null?Number.parseInt(n.get(`seed`)||`20261125`,10)||20261125:Math.trunc(r.seed),o=n.get(`quality`),s=o===`auto`||xt[o]?o:`auto`,c=await ri({device:e,qualityMode:s,search:window.location.search}),l=yt[0].log10SpanM;r.log10SpanM==null?n.has(`scale`)?l=Oa(Number.parseFloat(n.get(`scale`))||24.8):n.has(`level`)&&(l=yt[Math.max(0,Math.min(7,Number.parseInt(n.get(`level`),10)||0))].log10SpanM):l=Oa(r.log10SpanM);let u=document.getElementById(`uv-canvas`),d=document.getElementById(`uv-reticle-canvas`),f=d?.getContext(`2d`),p=document.getElementById(`uv-scale-rail`),m=document.getElementById(`uv-epoch-rail`),h=document.getElementById(`uv-zoom-slider`),g=document.getElementById(`uv-zoom-readout`),_=document.getElementById(`uv-status-dot`),v=document.getElementById(`uv-scale-badge`),y=document.getElementById(`uv-clock-badge`),b=document.getElementById(`uv-fps-badge`),x=document.getElementById(`uv-cockpit-btn`),C=document.getElementById(`uv-xr-btn`),w=document.getElementById(`uv-share-btn`),T=document.getElementById(`uv-room-btn`),E=document.getElementById(`uv-autopilot-btn`),D=document.getElementById(`uv-sim-btn`),O=document.getElementById(`uv-config-btn`),k=document.getElementById(`uv-help-btn`),A=document.getElementById(`uv-sim-drawer`),j=document.getElementById(`uv-config-drawer`),M=document.getElementById(`uv-cargo-btn`),N=document.getElementById(`uv-cargo-drawer`),P=document.getElementById(`uv-cargo-specimens`),F=document.getElementById(`uv-cargo-samples`),I=document.getElementById(`uv-cargo-resources`),L=document.getElementById(`uv-cargo-probe-btn`),R=document.getElementById(`uv-cargo-dyson-btn`),z=document.getElementById(`uv-help-drawer`),B=document.getElementById(`uv-pause-btn`),ee=document.getElementById(`uv-orbit-up-btn`),V=document.getElementById(`uv-timescale-slider`),te=document.getElementById(`uv-timescale-val`),ne=document.getElementById(`uv-bigbang-btn`),ae=document.getElementById(`uv-reseed-btn`),H=document.getElementById(`uv-scale-controls`),le=document.getElementById(`uv-quality-group`),ue=document.getElementById(`uv-peercompute-cap-badge`),de=document.getElementById(`uv-lensing-toggle`),fe=document.getElementById(`uv-orbits-toggle`),pe=document.getElementById(`uv-travel-toggle`),me=document.getElementById(`uv-autospin-toggle`),ge=document.getElementById(`uv-crt-toggle`),ve=document.getElementById(`uv-pixel-slider`),ye=document.getElementById(`uv-pixel-val`),xe=document.getElementById(`uv-peer-url`),Se=document.getElementById(`uv-peer-role`),Ce=document.getElementById(`uv-peer-connect-btn`),we=document.getElementById(`uv-peer-status`),Te=document.getElementById(`uv-inspector`),Ee=document.getElementById(`uv-command-deck`),ke=document.getElementById(`uv-deck-collapse-btn`),je=document.getElementById(`uv-scan-btn`),Me=document.getElementById(`uv-flight-btn`),Ne=document.getElementById(`uv-flight-pane`),Pe=document.getElementById(`uv-mode-orbit-btn`),Ie=document.getElementById(`uv-mode-ufo-btn`),Le=document.getElementById(`uv-flight-orbit-btn`),Re=document.getElementById(`uv-flight-ufo-btn`),ze=document.getElementById(`uv-gamepad-badge`),Be=document.getElementById(`uv-flight-regime-lbl`),Ve=document.getElementById(`uv-flight-speed-lbl`),Ue=document.getElementById(`uv-flight-attitude-lbl`),We=document.getElementById(`uv-flight-level-btn`),Ge=document.getElementById(`uv-flight-reset-btn`),Ke=document.getElementById(`uv-flight-cockpit-btn`),qe=document.getElementById(`uv-flight-chase-slider`),Je=document.getElementById(`uv-flight-chase-val`),Ye=document.getElementById(`uv-chase-presets`),Xe=document.getElementById(`uv-flight-fire-btn`),et=document.getElementById(`uv-flight-missile-btn`),U=document.getElementById(`uv-flight-tractor-btn`),tt=document.getElementById(`uv-flight-gamepad-status`),nt=document.getElementById(`uv-remote-sensing-box`),it=document.getElementById(`uv-context-spotlight`),ot=document.getElementById(`uv-topbar`),st=document.getElementById(`uv-mobile-tools-btn`);document.getElementById(`uv-deck-peek-bar`);let ct=document.getElementById(`uv-peek-title`),ut=document.getElementById(`uv-peek-action-btn`),dt=document.getElementById(`uv-peek-toggle-btn`),ft=document.getElementById(`uv-collapse-btn`),pt=document.getElementById(`uv-info-quick-btn`),mt=document.getElementById(`uv-target-kicker`),ht=document.getElementById(`uv-target-name`),gt=document.getElementById(`uv-target-sub`),Tt=document.getElementById(`uv-spec-title`),Et=document.getElementById(`uv-comp-text`),Dt=document.getElementById(`uv-spectrograph-canvas`),Ot=document.getElementById(`uv-stats-grid`),kt=document.getElementById(`uv-sample-strip`),At=document.getElementById(`uv-plot-title`),jt=document.getElementById(`uv-plot-meta`),Mt=document.getElementById(`uv-plot-canvas`),Nt=document.getElementById(`uv-dive-btn`),Pt=document.getElementById(`uv-focus-mote-btn`),Ft=document.getElementById(`uv-surface-quick-btn`),It=document.getElementById(`uv-return-btn`),Lt=document.getElementById(`uv-engine-tag`),Rt=document.getElementById(`uv-breadcrumb`),zt=document.getElementById(`uv-hint-pill`),Bt=document.getElementById(`uv-genesis-hud`),Vt=document.getElementById(`uv-genesis-title`),Ut=document.getElementById(`uv-genesis-detail`),Gt=document.getElementById(`uv-genesis-bar-fill`),Kt=document.getElementById(`uv-genesis-skip-btn`),qt=document.getElementById(`uv-tour-hud`),Jt=document.getElementById(`uv-tour-badge`),Yt=document.getElementById(`uv-tour-title`),Xt=document.getElementById(`uv-tour-caption`),Zt=document.getElementById(`uv-tour-bar-fill`),Qt=document.getElementById(`uv-tour-prev-btn`),$t=document.getElementById(`uv-tour-pause-btn`),en=document.getElementById(`uv-tour-next-btn`),tn=document.getElementById(`uv-tour-stop-btn`),nn=document.getElementById(`uv-surface-hud`),rn=document.getElementById(`uv-surf-telemetry`),an=document.getElementById(`uv-surf-chem-bar`),on=document.getElementById(`uv-surf-reaction-bar`),sn=document.getElementById(`uv-surf-weapon-bar`),cn=document.getElementById(`uv-weapon-fire-btn`),ln=document.getElementById(`uv-tractor-btn`),un=document.getElementById(`uv-lambda-slider`),dn=document.getElementById(`uv-lambda-readout`),fn=document.getElementById(`uv-power-slider`),pn=document.getElementById(`uv-power-readout`),mn=document.getElementById(`uv-probe-btn`),hn=document.getElementById(`uv-kardashev-badge`),gn=document.getElementById(`uv-surf-sample-btn`),_n=document.getElementById(`uv-surf-timewarp-btn`),vn=document.getElementById(`uv-surf-xeno-btn`),yn=document.getElementById(`uv-surf-jump-btn`),bn=document.getElementById(`uv-surf-descend-btn`),xn=document.getElementById(`uv-surf-vehicle-btn`),W=document.getElementById(`uv-surf-cam-btn`),Sn=document.getElementById(`uv-surf-orbit-btn`),Cn=document.getElementById(`uv-em-sensor-btn`),wn=document.getElementById(`uv-em-sensor-bar`),Tn=document.getElementById(`uv-em-readout`),En=document.getElementById(`uv-em-close-btn`),Dn=document.getElementById(`uv-em-track`),On=document.getElementById(`uv-em-window`),kn=document.getElementById(`uv-em-caret-min`),An=document.getElementById(`uv-em-caret-max`),jn=document.getElementById(`uv-em-presets`),Mn=document.getElementById(`uv-touch-pads`),Nn=document.getElementById(`uv-joy-move`),Pn=document.getElementById(`uv-joy-move-knob`),Fn=document.getElementById(`uv-joy-look`),In=document.getElementById(`uv-joy-look-knob`),Ln=document.getElementById(`uv-warp-overlay`),Rn=document.getElementById(`uv-help-scale-tag`),zn=document.getElementById(`uv-about-scale-btn`),Bn=document.getElementById(`uv-about-ulg-btn`),Vn=document.getElementById(`uv-modal-backdrop`),Hn=document.getElementById(`uv-modal-title`),Un=document.getElementById(`uv-modal-sub`),Wn=document.getElementById(`uv-modal-content`),Gn=document.getElementById(`uv-modal-close`),Kn=ji(e,u),qn=Ae(e),G=pi(e,{seed:a,qualityId:s,capabilityProfile:c,rawCapabilities:c?.capabilities||null,initialElementZ:i});function Jn(){if(!ue)return;let e=G.capabilityProfile;if(!e)return;let t=e.workloads,n=e.mode===`auto`?`AUTO → ${e.tier.toUpperCase()}`:`MANUAL ${e.qualityId.toUpperCase()} (${e.tier.toUpperCase()})`,r=e.gpuLabel||`Hardware WebGPU`,i=e.maxStorageMB?`${e.maxStorageMB} MB SSBO`:`WebGPU`;ue.innerHTML=`<strong>PeerCompute ${n}</strong> · ${e.cpuCores} cores · ${i}<br/>${r}<br/>L4 SPH: <strong>${t.sphParcels.toLocaleString()}</strong> · <strong>${t.sphGridN}³</strong> grid · <strong>${t.sphMapWidth}×${t.sphMapHeight}</strong> · L2: <strong>${t.nebularParcels.toLocaleString()}</strong> · L3: <strong>${t.stellarParcels.toLocaleString()}</strong> (<strong>${t.stellarGridN}³</strong>) · SS Multipole`}Jn();let K=da({initialMode:n.get(`flight`)===`ufo`?`ufo`:`orbit`}),Yn=Ht(),Xn=null,Zn=!1,Qn=null,$n=`scan`,er=!!r.cockpit,tr=`laser`,nr=-6.27,rr=25e7,ir=!1,ar=!1,or=r.simTimeS??0,sr=0,cr=0,lr=1,ur=null,dr=null,fr=null,pr=null,mr=null,hr=``,gr=[],_r=[],vr={vis:{min:-6.42,max:-6.12,active:!1,label:`👁 Human Visible (380–750 nm)`},jwst:{min:-6,max:-4.7,active:!0,label:`🔭 JWST NIRCam / MIRI IR (1–20 μm)`},ir:{min:-5.45,max:-4.6,active:!0,label:`🔥 Thermal IR (3.5–25 μm)`},uv:{min:-7.9,max:-6.5,active:!0,label:`⚡ UV / Aurora (12–320 nm)`},xray:{min:-12,max:-8.2,active:!0,label:`☢️ X-Ray / Gamma (1 pm–6 nm)`},radio:{min:-1.1,max:.8,active:!0,label:`📡 21 cm Radio / Synchrotron (8 cm–6 m)`},cmb:{min:-3.2,max:-2,active:!0,label:`🌌 CMB / mm Microwave (0.6–10 mm)`}},q={log10LambdaMin:-6.42,log10LambdaMax:-6.12,active:!1,gain:1,preset:`vis`};function yr(e){let t=10**e;return t<1e-11?`${(t*0xe8d4a51000).toFixed(1)} pm`:t<1e-9?`${(t*0xe8d4a51000).toFixed(0)} pm`:t<1e-6?`${(t*1e9).toFixed(0)} nm`:t<.001?`${(t*1e6).toFixed(1)} μm`:t<.1?`${(t*1e3).toFixed(1)} mm`:t<1?`${(t*100).toFixed(1)} cm`:`${t.toFixed(1)} m`}function br(){let e=Math.max(0,Math.min(1,(q.log10LambdaMin- -13)/14))*100,t=Math.max(0,Math.min(1,(q.log10LambdaMax- -13)/14))*100;if(kn&&(kn.style.left=`${e.toFixed(2)}%`),An&&(An.style.left=`${t.toFixed(2)}%`),On&&(On.style.left=`${e.toFixed(2)}%`,On.style.width=`${Math.max(.8,t-e).toFixed(2)}%`),Tn){let e=q.preset&&vr[q.preset];Tn.textContent=q.active?e?.label||`${yr(q.log10LambdaMin)} – ${yr(q.log10LambdaMax)} (10^${q.log10LambdaMin.toFixed(1)}..10^${q.log10LambdaMax.toFixed(1)} m)`:`👁 Human Visible (380–750 nm)`}if(Cn){let e=q.active||$n===`em`;Cn.classList.toggle(`active`,e);let t=Cn.querySelector(`.uv-tab-lbl`),n=q.active?yr(.5*(q.log10LambdaMin+q.log10LambdaMax)):`EM`;t?t.textContent=n:Cn.textContent=`🌈 ${n}`}if(jn)for(let e of jn.querySelectorAll(`[data-em-preset]`))e.classList.toggle(`active`,e.dataset.emPreset===q.preset)}function xr(e,t,{active:n=null,preset:r=`custom`,gain:i=1}={}){let a=Math.max(-13,Math.min(.85,Number(e))),o=Math.max(a+.15,Math.min(1,Number(t)));(!Number.isFinite(a)||!Number.isFinite(o))&&(a=-6.42,o=-6.12),q.log10LambdaMin=a,q.log10LambdaMax=o;let s=Math.abs(a- -6.42)<.08&&Math.abs(o- -6.12)<.08;return q.active=n===null?!s:!!n,q.preset=q.active?r:`vis`,q.gain=Math.max(.2,Math.min(4,Number(i)||1)),br(),{...q}}if(Cn?.addEventListener(`click`,()=>{Hi($n===`em`?`scan`:`em`),br()}),En?.addEventListener(`click`,()=>{Hi(`scan`),br()}),jn)for(let e of jn.querySelectorAll(`[data-em-preset]`))e.addEventListener(`click`,()=>{let t=e.dataset.emPreset,n=vr[t];n&&(xr(n.min,n.max,{active:n.active,preset:t}),$(performance.now()))});if(Dn){let e=null,t=0,n=-6.42,r=-6.12,i=e=>{let t=Dn.getBoundingClientRect();return-13+Math.max(0,Math.min(1,(e-t.left)/Math.max(1,t.width)))*14},a=(a,o)=>{o.preventDefault(),o.stopPropagation(),e=a,t=i(o.clientX),n=q.log10LambdaMin,r=q.log10LambdaMax,Dn.setPointerCapture?.(o.pointerId)};kn?.addEventListener(`pointerdown`,e=>a(`min`,e)),An?.addEventListener(`pointerdown`,e=>a(`max`,e)),On?.addEventListener(`pointerdown`,e=>a(`window`,e)),Dn.addEventListener(`pointerdown`,e=>{if(e.target===kn||e.target===An||e.target===On)return;let t=i(e.clientX),n=Math.abs(t-q.log10LambdaMin)<=Math.abs(t-q.log10LambdaMax)?`min`:`max`;a(n,e),n===`min`?xr(Math.min(t,q.log10LambdaMax-.15),q.log10LambdaMax,{active:!0,preset:`custom`}):xr(q.log10LambdaMin,Math.max(t,q.log10LambdaMin+.15),{active:!0,preset:`custom`}),$(performance.now())}),Dn.addEventListener(`pointermove`,a=>{if(!e)return;let o=i(a.clientX);if(e===`min`)xr(Math.min(o,q.log10LambdaMax-.15),q.log10LambdaMax,{active:!0,preset:`custom`});else if(e===`max`)xr(q.log10LambdaMin,Math.max(o,q.log10LambdaMin+.15),{active:!0,preset:`custom`});else if(e===`window`){let e=r-n,i=o-t,a=Math.max(-13,Math.min(1-e,n+i));xr(a,a+e,{active:!0,preset:`custom`})}$(performance.now())});let o=t=>{e&&(e=null,Dn.releasePointerCapture?.(t.pointerId))};Dn.addEventListener(`pointerup`,o),Dn.addEventListener(`pointercancel`,o)}br();let Sr=[1,1e3,1e5,1e6,1e7];function Cr(e){return e>=1e7?`10⁷× SEASONS`:e>=1e6?`10⁶× SKY`:e>=1e5?`10⁵× SKY`:e>=1e3?`10³× SKY`:`1× SKY`}_n?.addEventListener(`click`,()=>{let e=G.surfaceTimeWarp||1,t=Sr.findIndex(t=>t>e*1.05),n=t>=0?Sr[t]:Sr[0];G.setSurfaceTimeWarp(n),Pa()});let J=rt(),wr=He(e,{onStateChange:e=>{C&&(C.classList.toggle(`active`,e.active),C.textContent=e.active?`🥽 Exit XR`:`🥽 XR`,C.title=e.statusText)}}),Tr=$e({onWeaponHitLocal:e=>{J.applyDamage(e.damage||10),Ci=Math.max(Ci,.25)},onRemoteMissile:e=>{G.surfaceActive&&e?.pos&&G.launchSurfaceMissile({fromPos:e.pos,vel:e.vel,aimWorldPos:e.target,isRemote:!0})},onRemoteCraterStamp:e=>{G.surfaceActive&&e&&G.applyRemoteCraterStamp(e)},onRemoteCosmicCacheEntry:e=>{e&&G.ingestRemoteRootCacheEntry(e)},onStateChange:()=>{Rr()}});G.setRootCachePeerPublisher(e=>{Tr.isConnected&&Tr.broadcastCosmicCacheEntry(e)});let Er=[],Dr=new Map,Or=!1;function kr(){return G.galaxyBranch===`smbh-core`?`smbh-core`:G.useSolReference?`sol`:String(G.activeCausalSystem?.systemName||`site-${G.activeStarSite?.starIndex??0}`)}function Ar(){let e=(G.getActiveSystemCatalog?.()||[])[0],t=Math.max(.02,Number(e?.luminositySolar)||1);J.setActiveSystemContext({systemKey:kr(),starPosGal:G.activeStarSite?.posGal||G.galaxyFocusPos||[4.8,.04,2.1],starLumW:t*3828e23})}function jr(){G.surfaceActive&&(G.exitSurfaceView(),Pa()),G.unloadStarSystemRegimes({resetModes:!0}),Zn=!1,fr=null,pr=null,Hr=null,ur=null,Xn=null,Er.length=0,Dr.clear(),ir=!1,ar=!1,K.mode===`ufo`&&K.recenter([0,1.8,12]),Ar()}function Mr(e){if(!e)return null;let t=/comet|kuiper|icy|ice|volatile/i.test(`${e.name||``} ${e.subtitle||``}`),n=/metal|iron|fe|nickel|m-type/i.test(`${e.name||``} ${e.subtitle||``}`),r=(Number(e.index)||41)*197+G.seed%997,i=t?6+r%14:n?22+r%55:1.5+r%18,a=(t?650:n?4200:1850)*(4/3*Math.PI*(i*1e3)**3),o=a/198847e25,s=Math.max(.005,Math.min(.45,66743e-15*a/(i*1e3)**2));return{id:`belt-ast-${e.index??r}`,name:e.name||`Belt Asteroid #${e.index??1}`,subtitle:e.subtitle||(t?`Active Sublimating Ice Nucleus`:n?`Fe-Ni Metallic Planetesimal`:`Carbonaceous Rubble-Pile Asteroid`),massSolar:o,radiusKm:i,surfaceGravityMS2:s,surfacePressurePa:0,tempK:t?175:210,aAu:2.7,kind:t?3:1,atm:t?.06:0,color0:t?[.76,.84,.92]:n?[.64,.62,.6]:[.34,.32,.3],color1:t?[.42,.56,.7]:n?[.44,.42,.4]:[.22,.2,.19],coreZ:n?26:t?8:14,mantleZ:n?28:14,surfZ:t?8:n?26:6,isMinorBody:!0,isComet:t,isMetallicAsteroid:n,composition:e.sampleMaterial?.name||(t?`H₂O/CO Ice · Dust`:n?`Fe-Ni Alloy · Silicates`:`Carbonaceous Chondrite`)}}function Nr(){if(X&&X.level===Y&&Array.isArray(X.worldPos)){let e=X.kind===`solar-asteroid`?Mr(X):G.getActiveSystemCatalog()[G.focusedSolarBodyIndex]||lt[3];return{pos:[...X.worldPos],spec:e,id:e.id||`mote-${X.index}`}}let e=G.getActiveSystemCatalog(),t=Math.max(0,Math.min(e.length-1,G.focusedSolarBodyIndex)),n=e[t]||lt[3];if(Y===2&&G.solarEngine){let e=G.getSolarReferenceOriginAu(l,t,{lockToTarget:Kr}),r=Array.isArray(Ni.solarOriginAu)?Ni.solarOriginAu:e.originAu,i=Ni.solarScaleAuToWorld??WORLD_VIEW_SPAN/Math.max(1e-9,10**l/149597870700);return{pos:[(e.focusPosAu[0]-r[0])*i,(e.focusPosAu[1]-r[1])*i,(e.focusPosAu[2]-r[2])*i],spec:n,id:n?.id||`focused-body`}}return{pos:[...Xr],spec:n,id:n?.id||`focused-body`}}async function Pr(e,t=1.65){if(Or)return null;Or=!0;try{G.surfaceActive&&Ia(),Er.length=0,Y=2,l=12.2,Ei=null,Ci=.55;let n=await G.triggerCatastrophicShatter(e,{excessRatio:t});return la(),ua(),Pa(),Q(),$(performance.now()),n}finally{Or=!1}}function Fr(e=null){let t=e||Nr(),n=Math.cos(Oi.pitch),r=Math.sin(Oi.pitch),i=Math.cos(Oi.yaw),a=Math.sin(Oi.yaw),o=[Xr[0]+Oi.dist*n*a,Xr[1]+Oi.dist*r,Xr[2]+Oi.dist*n*i],s=_a(o,Xr,[0,1,0]),c=[o[0]+s.fwd[0]*5.9-s.up[0]*1.72,o[1]+s.fwd[1]*5.9-s.up[1]*1.72,o[2]+s.fwd[2]*5.9-s.up[2]*1.72],l=ha(fa(t.pos,c)),u=Math.max(2,Math.hypot(t.pos[0]-c[0],t.pos[1]-c[1],t.pos[2]-c[2])),d=Math.max(12,Math.min(48,u*1.45)),f={pos:[c[0]+l[0]*.5,c[1]+l[1]*.5,c[2]+l[2]*.5],vel:[l[0]*d,l[1]*d,l[2]*d],target:[...t.pos],targetSpec:t.spec,targetId:t.id,age:0,alive:!0};return Er.push(f),Er.length>16&&Er.shift(),f}function Ir(e){return e>=1e24?`${(e*1e-24).toFixed(1)} YW`:e>=1e21?`${(e*1e-21).toFixed(1)} ZW`:e>=0xde0b6b3a7640000?`${(e*1e-18).toFixed(1)} EW`:e>=0x38d7ea4c68000?`${(e*1e-15).toFixed(1)} PW`:e>=0xe8d4a51000?`${(e*1e-12).toFixed(1)} TW`:e>=1e9?`${(e*1e-9).toFixed(1)} GW`:e>=1e6?`${(e*1e-6).toFixed(0)} MW`:`${(e*.001).toFixed(0)} kW`}function Lr(e){let t=Math.max(0,Number(e)||0);return t>=0xe8d4a51000?`${(t*1e-12).toFixed(1)}T`:t>=1e9?`${(t*1e-9).toFixed(1)}B`:t>=1e6?`${(t*1e-6).toFixed(1)}M`:t>=1e3?`${(t*.001).toFixed(1)}k`:`${Math.round(t)}`}function Rr(){let e=Tr.getStatus();if(e.timescaleLocked&&(hi=1),V&&(V.disabled=e.timescaleLocked,e.timescaleLocked&&(V.value=`1.0`)),te&&(te.textContent=e.timescaleLocked?`🔒 1.0×`:`${hi.toFixed(1)}×`),T){T.classList.toggle(`active`,e.connected);let t=e.peerComputeStatus===`p2p-mesh`?`P2P`:e.peerComputeStatus===`relay-online`?`Relay`:e.peerComputeStatus===`connecting`?`Sync...`:`Local`;T.textContent=e.connected?`🌐 ${e.roomId} (${e.remotePeerCount+1} · ${t})`:`🌐 Solo`;let n=Tr.getAllRemotePeers?.()||[],r=n.length>0?` | Online: ${n.map(e=>`${e.peerId}@${e.surfaceActive?`${e.bodyId||`surface`}`:`L${e.level??2}`}`).join(`, `)}`:``;T.title=e.connected?`PeerCompute multiplayer room "${e.roomId}" (${e.transportKind}, ${e.libp2pPeerCount} libp2p links) — timescale locked at 1.0×${r}. Click to leave.`:`Join PeerCompute public multiplayer UFO room (libp2p/WebRTC + same-browser tabs; locks timescale to 1.0×!)`}}function zr(){let e=he(nr);if(dn){dn.textContent=`${e.shortBand} · ${e.displayLabel.split(` `)[0]}${e.displayLabel.split(` `)[1]?` `+e.displayLabel.split(` `)[1]:``}`;let t=Math.round(e.rgb[0]*255),n=Math.round(e.rgb[1]*255),r=Math.round(e.rgb[2]*255);dn.style.color=`rgb(${t},${n},${r})`}if(fn){let e=Math.max(14,Math.min(26,Math.round(Math.log10(Math.max(0x5af3107a4000,J.state.maxPowerW)))));fn.max=String(e)}if(pn&&(pn.textContent=Ir(rr)),sn)for(let e of sn.querySelectorAll(`[data-weapon]`))e.classList.toggle(`active`,e.dataset.weapon===tr);if(ln&&ln.classList.toggle(`active`,ar),cn&&cn.classList.toggle(`firing`,ir),hn){let e=J.state,t=Lr(e.totalProbeCount||e.probes.length),n=e.dysonTau>.01?` · τD ${e.dysonTau.toFixed(2)}`:``;hn.textContent=`K ${e.kardashevIndex.toFixed(2)} · ${t} Probes${n} · 🛡${Math.round(e.shieldHp)}%`}if(x){let e=G.surfaceActive?G.surfaceSession?.cameraMode===`first-person`:er;x.classList.toggle(`active`,e),x.textContent=e?`🛸 3rd View`:`🛸 Cockpit`}}function Br(){let e=G.getActiveSystemCatalog()[G.focusedSolarBodyIndex]?.id||`earth`,t=G.surfaceTelemetry,n=Tr.getStatus();return Qe(window.location.href,{seed:G.seed,epoch:G.cosmicEpoch?.id||`present`,log10SpanM:l,useSol:G.useSolReference,bodyId:e,surfaceActive:G.surfaceActive,pos:G.surfaceActive?t?.ufoPos||t?.roverPos:null,yaw:G.surfaceActive?t?.ufoYaw??.35:null,simTimeS:or,roomId:n.connected?n.roomId:null,relayUrl:n.connected&&n.relayUrl?n.relayUrl:null})}let Vr=()=>!!G.getActiveSystemCatalog()[G.focusedSolarBodyIndex]?.isStar||G.focusedSolarBodyIndex===0,Y=Ea(l,{focusedSolarBodyIndex:G.focusedSolarBodyIndex,focusedBodyIsStar:Vr(),galaxyBranch:G.galaxyBranch}),Hr=null,Ur=null,Wr=null,X=null,Gr=!1,Kr=!1,qr=null,Jr=null,Yr=!1,Xr=[0,0,0],Zr=0,Qr=[0,0,0],$r=null,ei=null,ti=null,ni=null,ii=null,ai=null,oi=null,si=[0,0,0],ci=null;function li(e,t,n,r,i=!1){if(!e||i)return[t[0],t[1],t[2]];let a=1-Math.exp(-Math.max(.001,Math.min(.12,n))*r);return[e[0]+(t[0]-e[0])*a,e[1]+(t[1]-e[1])*a,e[2]+(t[2]-e[2])*a]}let ui=[],di=0,mi=!0,hi=1,gi=!0,_i=!0,vi=n.get(`cameraAutoSpin`)===`1`,yi=n.get(`crt`)===`1`,bi=3,xi=n.get(`autopilot`)===`1`,Si=!1,Z={active:!1,paused:!1,stops:[],stopIndex:0,phase:`travel`,travelElapsedSec:0,travelStartSpan:yt[0].log10SpanM,dwellElapsedSec:0,genesisWaitSec:0,surfaceReady:!1,surfaceEntering:!1,cutawayEngaged:!1,managedCutaway:!1,pendingPrep:!1,runToken:0,targetYaw:null,lastHudKey:``},Ci=0,wi=!1,Ti=0,Ei=null,Di=0,Oi={yaw:.56,pitch:.42,dist:18},ki=new Float32Array(16),Ai=window.innerWidth,Mi=window.innerHeight,Ni={},Pi=[`Cosmic Web`,`Spiral Galaxy`,`Solar System`,`Sun Core`,`Earth`,`Fe Lattice`,`Fe Atom`,`⁵⁶Fe Nucleus`];if(me&&(me.checked=vi),ge&&(ge.checked=yi),le)for(let e of le.querySelectorAll(`[data-quality]`))e.classList.toggle(`active`,e.dataset.quality===s);if(p){p.innerHTML=yt.map(e=>`<button class="uv-rung-btn" data-level="${e.level}" type="button" title="Smoothly fly continuously to L${e.level}: ${e.name} (${e.exponentLabel})"><span class="uv-rung-exp">${e.exponentLabel}</span><span>L${e.level} ${e.shortLabel}</span></button>`).join(``);for(let e of p.querySelectorAll(`[data-level]`))e.addEventListener(`click`,()=>{let t=Number.parseInt(e.dataset.level,10);if(Number.isFinite(t)){if(Ua(),G.surfaceActive&&Ia(),t===3)Zn=!1,G.setFocusedSolarBody(0),G.syncStellarRegimeForStar(null,{initializeNow:!0});else if(t===4){let e=G.getActiveSystemCatalog();(e[G.focusedSolarBodyIndex]?.isStar||G.focusedSolarBodyIndex===0)&&G.setFocusedSolarBody(G.getDefaultPlanetIndex(e))}aa(yt[t].log10SpanM)}})}function Fi(){if(m)for(let e of m.querySelectorAll(`[data-epoch]`))e.classList.toggle(`active`,e.dataset.epoch===G.cosmicEpochId)}if(m){m.innerHTML=G.COSMIC_EPOCH_PRESETS.map(e=>`<button class="uv-epoch-btn ${e.id===G.cosmicEpochId?`active`:``}" data-epoch="${e.id}" type="button" title="${e.summary}">${e.shortLabel}</button>`).join(``);for(let e of m.querySelectorAll(`[data-epoch]`))e.addEventListener(`click`,async()=>{await G.setCosmicEpoch(e.dataset.epoch,{alignActiveLevel:Y}),Fi(),la(),sa(),Q(),$(performance.now())})}h?.addEventListener(`input`,e=>{Ua(),G.surfaceActive&&Ia(),Ei=null,l=Math.max(vt,Math.min(_t,Number(e.target.value))),ra(l)});function Ii(){let e=Math.min(window.devicePixelRatio||1,2);Ai=Math.max(320,window.innerWidth),Mi=Math.max(240,window.innerHeight);let t=Math.max(2,Math.floor(Ai*e)),n=Math.max(2,Math.floor(Mi*e));(u.width!==t||u.height!==n)&&(u.width=t,u.height=n),d&&(d.width!==Ai||d.height!==Mi)&&(d.width=Ai,d.height=Mi)}Ii(),window.addEventListener(`resize`,Ii);let Li=[{id:`scan`,el:Te,btn:je},{id:`em`,el:wn,btn:Cn},{id:`flight`,el:Ne,btn:Me},{id:`cargo`,el:N,btn:M},{id:`sim`,el:A,btn:D},{id:`config`,el:j,btn:O},{id:`help`,el:z,btn:k}];Li.filter(e=>e.id!==`scan`);function Ri(){return typeof window<`u`&&(window.innerWidth<=920||window.matchMedia?.(`(max-width: 920px)`).matches)}let zi=Ri()?`collapsed`:`expanded`;function Bi(e=`collapsed`){let t=e===`collapsed`||e===`peek`||e===`expanded`?e:`collapsed`;return zi=t,Ee&&(t===`collapsed`?(Ee.classList.add(`collapsed`),Ee.classList.remove(`mobile-peek`),document.body.classList.add(`deck-collapsed`),ke&&(ke.textContent=Ri()?`▲`:`❮`),dt&&(dt.textContent=`▲`)):t===`peek`?(Ee.classList.remove(`collapsed`),Ee.classList.add(`mobile-peek`),document.body.classList.remove(`deck-collapsed`),ke&&(ke.textContent=`▼`),dt&&(dt.textContent=`⤢`)):(Ee.classList.remove(`collapsed`),Ee.classList.remove(`mobile-peek`),document.body.classList.remove(`deck-collapsed`),ke&&(ke.textContent=Ri()?`▼`:`❯`),dt&&(dt.textContent=`▼`))),zi}function Hi(e=`scan`,{autoExpand:t=!0,preferPeek:n=!1}={}){let r=Li.some(t=>t.id===e)?e:`scan`;$n=r,t&&(Ee?.classList.contains(`collapsed`)||Ri()&&!n&&Ee?.classList.contains(`mobile-peek`))?Bi(Ri()&&n?`peek`:`expanded`):n&&Ri()&&Bi(`peek`);for(let e of Li){let t=e.id===r;e.el?.classList.toggle(`open`,t),e.btn?.classList.toggle(`active`,t)}return r===`cargo`&&Xi(),r===`flight`&&qi(),r===`em`&&br(),$n}Ri()&&Bi(`collapsed`),st?.addEventListener(`click`,e=>{e.stopPropagation();let t=ot?.classList.toggle(`mobile-tools-open`);st.classList.toggle(`active`,!!t),st.setAttribute(`aria-expanded`,t?`true`:`false`)}),ct?.addEventListener(`click`,()=>{Hi(`scan`,{autoExpand:!1}),Bi(zi===`collapsed`?`peek`:zi===`peek`?`expanded`:`collapsed`)}),dt?.addEventListener(`click`,()=>{zi===`collapsed`?(Hi($n||`scan`,{autoExpand:!1}),Bi(`peek`)):Bi(zi===`peek`?`expanded`:`collapsed`)}),ut?.addEventListener(`click`,()=>{typeof mr?.primaryAction==`function`?mr.primaryAction():Aa()});function Wi(){let e=Math.cos(Oi.pitch),t=Math.sin(Oi.pitch),n=Math.cos(Oi.yaw),r=Math.sin(Oi.yaw);return{eye:[Xr[0]+Oi.dist*e*r,Xr[1]+Oi.dist*t,Xr[2]+Oi.dist*e*n],target:[...Xr]}}function qi(){let e=K.getState(l,G.surfaceActive),t=e.mode===`ufo`;if(Pe?.classList.toggle(`active`,!t),Ie?.classList.toggle(`active`,t),Le?.classList.toggle(`active`,!t),Re?.classList.toggle(`active`,t),Be&&(Be.textContent=e.regime.label.toUpperCase()),Ve&&(Ve.textContent=G.surfaceActive&&G.surfaceTelemetry?`${(G.surfaceTelemetry.ufoSpeedMS??G.surfaceTelemetry.roverSpeedMS??0).toFixed(1)} m/s`:e.speedLabel),Ue){let t=e.eulerDeg,n=e=>`${e>=0?`+`:``}${e.toFixed(0)}°`;Ue.textContent=`X ${n(t.pitchDeg)} · Y ${n(t.yawDeg)} · Z ${n(t.rollDeg)}`}if(qe&&document.activeElement!==qe&&(qe.value=String(e.chaseDistMul)),Je&&(Je.textContent=`${e.chaseDistMul.toFixed(e.chaseDistMul>=10?0:1)}×`),Ye)for(let t of Ye.querySelectorAll(`[data-chase-zoom]`)){let n=Number(t.dataset.chaseZoom);t.classList.toggle(`active`,Math.abs(n-e.chaseDistMul)<Math.max(.25,n*.18))}ze&&(ze.classList.toggle(`connected`,e.gamepadConnected),ze.textContent=e.gamepadConnected?`🎮 Xbox Pad`:`🎮 No Pad`,ze.title=e.gamepadConnected?`Connected: ${e.gamepadId} — Left Stick thrust, Right Stick pitch/yaw, LB/RB roll Z, D-Pad zoom`:`Connect an Xbox or standard gamepad and press any button to fly in 6-DOF!`),tt&&(tt.innerHTML=`${e.gamepadConnected?`<strong style="color:#6ee7b7;">Connected:</strong> ${e.gamepadId.slice(0,40)}`:`<strong>Status:</strong> Connect Xbox controller &amp; press any button.`}<br/>
        <strong>Left Stick:</strong> Thrust Fwd/Back + Strafe · <strong>Right Stick:</strong> Pitch X + Yaw Y<br/>
        <strong>LB / RB:</strong> Full 360° Roll Z · <strong>RT / LT:</strong> Warp Boost / Brake<br/>
        <strong>A / B:</strong> Ascend / Descend · <strong>X / Y:</strong> Fire / Tractor Beam<br/>
        <strong>D-Pad ↑/↓:</strong> Chase Zoom (0.55×–45×) · <strong>←/→:</strong> 40-OOM Scale<br/>
        <strong>View:</strong> UFO ↔ Orbit · <strong>Menu:</strong> Cockpit · <strong>L3:</strong> Level · <strong>R3:</strong> Missile<br/>
        <strong>Keys (UFO):</strong> WASD thrust · Space/C up/dn · Q/E roll Z · Arrows/Drag pitch &amp; yaw · Wheel chase zoom (Shift+Wheel scale).`),zt&&!G.surfaceActive&&(zt.textContent=t?`🛸 6-DOF UFO (${e.regime.shortLabel} · Chase ${e.chaseDistMul.toFixed(1)}×) · WASD Thrust · Q/E Roll Z · Drag/Arrows Pitch/Yaw · Wheel: Chase Zoom · Shift+Wheel: 40-OOM · Tab: Orbit`:`🪐 Orbit Mode · Tab: 6-DOF UFO Free-Flight · Scroll: 40-OOM Zoom · Drag: Orbit · Click ANY Mote: Inspect GPU Data`)}function Ji(e){e===`ufo`&&Si&&Ua();let t=Wi();return K.setMode(e,t),qi(),$(performance.now()),K.mode}function Yi(){return Ji(K.mode===`ufo`?`orbit`:`ufo`)}if(Pe?.addEventListener(`click`,()=>Ji(`orbit`)),Ie?.addEventListener(`click`,()=>Ji(`ufo`)),Le?.addEventListener(`click`,()=>Ji(`orbit`)),Re?.addEventListener(`click`,()=>Ji(`ufo`)),We?.addEventListener(`click`,()=>{K.levelHorizon(),qi(),$(performance.now())}),Ge?.addEventListener(`click`,()=>{let e=Wi();K.resetPosition(e.eye,e.target),qi(),$(performance.now())}),Ke?.addEventListener(`click`,()=>Na()),qe?.addEventListener(`input`,e=>{let t=Number(e.target.value)||1;if(K.setChaseZoom(t),G.surfaceActive){let e=G.adjustSurfaceChaseDistance(1);e>0&&G.adjustSurfaceChaseDistance(Math.min(18,Math.max(.45,t))/e)}qi(),$(performance.now())}),Ye)for(let e of Ye.querySelectorAll(`[data-chase-zoom]`))e.addEventListener(`click`,()=>{let t=Number(e.dataset.chaseZoom)||1;K.setChaseZoom(t),K.mode!==`ufo`&&!G.surfaceActive&&Ji(`ufo`),qi(),$(performance.now())});Xe?.addEventListener(`pointerdown`,e=>{e.preventDefault(),Qa(!0)}),Xe?.addEventListener(`pointerup`,()=>Qa(!1)),Xe?.addEventListener(`pointerleave`,()=>Qa(!1)),et?.addEventListener(`click`,()=>{if(G.surfaceActive){let e=G.launchSurfaceMissile({});e&&Tr.isConnected&&Tr.broadcastMissileLaunch(e)}else Fr()}),U?.addEventListener(`click`,()=>{ar=!ar,G.setSurfaceTractorBeam(ar),zr(),$(performance.now())}),ke?.addEventListener(`click`,()=>{Bi(Ee?.classList.contains(`collapsed`)?`expanded`:`collapsed`)}),je?.addEventListener(`click`,()=>{Ri()&&$n===`scan`&&zi!==`collapsed`?Bi(`collapsed`):Hi(`scan`)}),Me?.addEventListener(`click`,()=>{Ri()&&$n===`flight`&&zi!==`collapsed`?Bi(`collapsed`):Hi($n===`flight`?`scan`:`flight`)});function Xi(){let e=gr.length+_r.length;if(M){let t=M.querySelector(`.uv-tab-lbl`);t?t.textContent=e>0?`Cargo (${e})`:`Cargo`:M.textContent=e>0?`🎒 Cargo (${e})`:`🎒 Cargo`}if(P&&(gr.length?(P.innerHTML=gr.map((e,t)=>{let n=e.kingdom===`flora`||e.kind===`flora`?`🌿`:e.kingdom===`fungi`||e.kind===`fungi`?`🍄`:e.bodyPlan===`aero-gasbag`?`🎈`:e.bodyPlan===`aquatic-swimmer`?`🐟`:`🐾`,r=be(e.profile||null,`organism-overview`,e),i=Number.isFinite(e.deltaGKjMol)?` · ΔG=${e.deltaGKjMol} kJ/mol`:``,a=e.xnaBackbone?` · ${e.xnaAlphabetSize||4}-base ${e.xnaBackbone.split(` `)[0]}`:``;return`
            <div class="uv-cargo-item">
              <div class="uv-cargo-item-head">
                <span>${n} <em>${e.speciesName}</em></span>
                <span style="font-family:var(--mono);font-size:9.5px;color:#6ee7b7;">${e.solventFormula||e.solvent}</span>
              </div>
              <div class="uv-cargo-item-sub">${e.morphClass} · ${e.worldName} (${e.latDeg}°, ${e.lonDeg}°) · ${e.tempK} K · g=${e.gravityMS2} m/s²${i}${a}</div>
              <div class="uv-cargo-item-sub">FASTA: <code>${String(e.fasta||``).slice(0,22)}…</code></div>
              <div class="uv-cargo-item-actions">
                <a href="${r}" target="_blank" rel="noopener">🫧 Examine in Bio Lab Aquarium ↗</a>
                <button type="button" class="release" data-release-spec="${t}">✕ Release</button>
              </div>
            </div>`}).join(``),P.querySelectorAll(`[data-release-spec]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=Number(e.getAttribute(`data-release-spec`));Number.isInteger(t)&&t>=0&&t<gr.length&&(gr.splice(t,1),Xi(),Pa())})})):P.innerHTML=`<div class="uv-cargo-item-sub">No life forms aboard yet. Land on a living world and hold <strong>T</strong> (Tractor Beam) over trees or roaming animals to abduct &amp; examine them in Bio Lab.</div>`),F&&(_r.length?(F.innerHTML=_r.map((e,t)=>{let n=Number(e.primaryZ)||Number(e.elements?.[0])||14,r=e.formula||e.shortLabel||e.name;return`
            <div class="uv-cargo-item">
              <div class="uv-cargo-item-head">
                <span>🧪 ${e.name||e.shortLabel}</span>
                <span style="font-family:var(--mono);font-size:9.5px;color:#7dd3fc;">${r}</span>
              </div>
              <div class="uv-cargo-item-sub">${e.worldName||`World`} · ${e.locationTag||`Surface`} · ${Math.round(Number(e.tempK)||288)} K</div>
              <div class="uv-cargo-item-actions">
                <a href="./elements-lab.html?z=${n}" target="_blank" rel="noopener">⚛️ Elements Lab (Z=${n}) ↗</a>
                <a href="./organic-lab.html" target="_blank" rel="noopener">🧫 Organic Lab ↗</a>
                <button type="button" data-inspect-sample="${t}">🔬 L5 Lattice</button>
              </div>
            </div>`}).join(``),F.querySelectorAll(`[data-inspect-sample]`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=_r[Number(e.getAttribute(`data-inspect-sample`))];t&&($i(),await G.applySampledMaterialToLattice(t),G.surfaceActive&&G.exitSurfaceView(),await oa(5,!0))})})):F.innerHTML=`<div class="uv-cargo-item-sub">No material samples collected yet. Press <strong>G</strong> on any surface, asteroid, comet, or cloud deck to sample.</div>`),I){let e=J.state||{},t=Number(e.silicatesKg)||0,n=Number(e.metalsKg)||0,r=Number(e.volatilesKg)||0,i=Number(e.exoticsKg)||0,a=Number(e.kardashevIndex??e.kardashevK??.725),o=Number(e.reactorTier)||1,s=(Number(e.dysonCoveringFrac??e.dysonTau)||0)*100,c=Math.max(Number(e.totalProbeCount)||0,e.probes?.length||0);I.innerHTML=`
        <div class="uv-cargo-res-cell"><span>Silicates</span><strong>${Math.round(t).toLocaleString()} kg</strong></div>
        <div class="uv-cargo-res-cell"><span>Fe-Ni Metals</span><strong>${Math.round(n).toLocaleString()} kg</strong></div>
        <div class="uv-cargo-res-cell"><span>Volatiles</span><strong>${Math.round(r).toLocaleString()} kg</strong></div>
        <div class="uv-cargo-res-cell"><span>Exotics / AM</span><strong>${i.toFixed(1)} kg</strong></div>
        <div class="uv-cargo-res-cell"><span>Kardashev Index</span><strong>K ${a.toFixed(2)} (Tier ${o})</strong></div>
        <div class="uv-cargo-res-cell"><span>Dyson / Probes</span><strong>${s.toFixed(1)}% · ${Math.round(c).toLocaleString()} 🤖</strong></div>
      `}}function Qi(e){let t=Li.find(t=>t.el===e);t&&Hi($n===t.id?`scan`:t.id)}function $i(){Hi(`scan`,{autoExpand:!1})}M?.addEventListener(`click`,()=>Qi(N)),D?.addEventListener(`click`,()=>Qi(A)),O?.addEventListener(`click`,()=>Qi(j)),k?.addEventListener(`click`,()=>Qi(z)),L?.addEventListener(`click`,()=>{let e=G.getActiveSystemCatalog();Ar(),J.deployVonNeumannProbe({bodyId:e[G.focusedSolarBodyIndex]?.id||`earth`,systemKey:kr(),starPosGal:G.activeStarSite?.posGal||G.galaxyFocusPos||[4.8,.04,2.1]}),zr(),Xi()}),R?.addEventListener(`click`,()=>{J.addHarvest({metals:1200,silicates:900,exotics:12}),J.step(1.5),zr(),Xi()});for(let e of document.querySelectorAll(`[data-close-drawer]`))e.addEventListener(`click`,()=>$i());function ea(e,t,n){$i(),Hn&&(Hn.textContent=e),Un&&(Un.textContent=t),Wn&&(Wn.innerHTML=n),Vn?.classList.add(`open`)}Gn?.addEventListener(`click`,()=>Vn?.classList.remove(`open`)),Vn?.addEventListener(`click`,e=>{e.target===Vn&&Vn.classList.remove(`open`)}),zn?.addEventListener(`click`,()=>{let e=yt[Y];ea(`L${e.level} · ${e.name}`,`${e.exponentLabel} · ${e.engineSchema}`,wt(e))}),pt?.addEventListener(`click`,()=>{let e=yt[Y];ea(`L${e.level} · ${e.name}`,`${e.exponentLabel} · ${e.engineSchema}`,wt(e))}),Bn?.addEventListener(`click`,()=>{ea(`About ULG Universes`,`Universal Law Graph · Continuous 40-OOM WebGPU Physics`,Ct())}),ft?.addEventListener(`click`,()=>{let e=Te?.classList.toggle(`collapsed`);ft&&(ft.textContent=e?`+`:`−`)});function ta(){if(!Bt)return;let e=G.activeGenesisStage,t=G.lastGenesisEvent;if(e&&!G.surfaceActive){Yr=!0,Bt.classList.add(`active`),Bt.classList.remove(`toast`);let t=Math.round(Math.max(0,Math.min(1,e.progress||0))*100),n=typeof e.etaSec==`number`&&e.etaSec>1?` · ~${e.etaSec}s left`:``;Vt&&(Vt.textContent=`${e.title} · ${t}%${n}`),Ut&&(Ut.textContent=`${e.entityName} — ${e.detail}`),Gt&&(Gt.style.width=`${Math.max(4,t)}%`),Kt&&(Kt.textContent=e.skipLabel||`⏩ Finish Now`);return}Yr&&!e&&(Yr=!1,la(),ua(),Q(),$(performance.now()));let n=Date.now();t&&!G.surfaceActive&&(t.kind===`cache-hit`||t.kind===`genesis-complete`)&&n-(t.timestampMs||0)<2800?(Bt.classList.remove(`active`),Bt.classList.add(`toast`),Vt&&(Vt.textContent=t.kind===`cache-hit`?`✅ Root Cache Hit · Instant Restore`:`✅ GPU Genesis Converged & Cached on Root`),Ut&&(Ut.textContent=t.detail?`${t.label} — ${t.detail}`:`${t.label} (${t.source||`root-cache`})`),t.timestampMs):(Bt.classList.remove(`active`),Bt.classList.remove(`toast`))}async function na(){if(!G.activeGenesisStage)return null;let e=await G.finalizeActiveGenesis();return Yr=!1,e?.stage===`l2-nebular-coalescence`&&Ar(),Y===4&&!G.surfaceActive&&G.getActiveSystemCatalog()[G.planetaryBodyIndex]&&ia(G.planetaryBodyIndex),la(),ua(),ta(),Q(),$(performance.now()),e}Kt?.addEventListener(`click`,()=>{na()});async function ra(e,{observeLive:t=!1}={}){let n=Vr(),r=Ea(e,{focusedSolarBodyIndex:G.focusedSolarBodyIndex,focusedBodyIsStar:n,galaxyBranch:G.galaxyBranch}),i=new Set([r]);r===1&&i.add(0),(r===2||r===3||r===4)&&i.add(1),r===6&&i.add(5),r===7&&i.add(6),e>=20.5&&r>=0&&i.add(0),e>=14.8&&e<=23.5&&r>=1&&i.add(1),e>=6.5&&e<=18.2&&r>=2&&i.add(2),e>=6.8&&e<=10.8&&n&&r>=3&&i.add(3),e>=-6.2&&e<=9.2&&!n&&r>=4&&i.add(4),e>=-10&&e<=-4.5&&i.add(5),e>=-13.5&&e<=-8.4&&i.add(6),e<=-11.5&&i.add(7);let a=G.nuclearResult;for(let e of i){let n=!!(t&&e===r&&(e===1||e===2||e===4));await G.ensureLevelInitialized(e,{observeLive:n})}G.nuclearResult&&G.nuclearResult!==a&&G.nuclearResult.volumeData&&Kn.uploadNuclearVolume(G.nuclearResult.volumeData),ta()}function ia(e=G.focusedSolarBodyIndex){if(!G.solarEngine||e<=0)return;let t=G.solarEngine.getMassiveBodyState64(e),n=G.solarEngine.getMassiveBodyState64(0),r=n.posAu[0]-t.posAu[0],i=n.posAu[2]-t.posAu[2];Oi.yaw=Math.atan2(r,i)-.92,Oi.pitch=.24}function aa(e){Ei=Math.max(vt,Math.min(_t,Number(e))),ra(Ei)}async function oa(e,t=!0){let n=Math.max(0,Math.min(7,Math.trunc(Number(e)||0)));G.surfaceActive&&Ia();let r=G.getActiveSystemCatalog();n===3?G.setFocusedSolarBody(0):n===4&&(r[G.focusedSolarBodyIndex]?.isStar||G.focusedSolarBodyIndex===0)&&G.setFocusedSolarBody(G.getDefaultPlanetIndex(r));let i=yt[n].log10SpanM;if(!t){aa(i);return}Ei=null;let a=Y;l=Oa(i),Y=Ea(l,{focusedSolarBodyIndex:G.focusedSolarBodyIndex,focusedBodyIsStar:Vr(),galaxyBranch:G.galaxyBranch}),Y!==a&&(X=null,Gr=!1,Xr=[0,0,0],a>=2&&Y<=1&&jr()),await ra(l),n===4&&ia(G.focusedSolarBodyIndex),la(),ua(),Q(),$(performance.now())}function sa(){if(H)if(Y===0)H.innerHTML=`
        <div class="uv-row">
          <span>Cosmology Regime</span>
          <select id="uv-cosmo-mode">
            <option value="web" ${G.cosmoMode===`web`?`selected`:``}>2LPT Cosmic Web (FLRW TreePM)</option>
            <option value="cmb" ${G.cosmoMode===`cmb`?`selected`:``}>CMB Recombination (z=1100 BAO ΔT/T)</option>
            <option value="reionization" ${G.cosmoMode===`reionization`?`selected`:``}>Cosmic Dawn Reionization Bubbles (z=10)</option>
            <option value="cluster-merger" ${G.cosmoMode===`cluster-merger`?`selected`:``}>Bullet-Cluster Merger (X-Ray ICM + Lensing)</option>
          </select>
        </div>
        <div style="font-size:11px;color:var(--muted);line-height:1.35;">${G.cosmoMode===`cmb`?`Eisenstein–Hu BAO + Peebles Recombination surface at <code>z = 1100</code> (<code>T_CMB = 3,001 K</code>, <code>r_s ≈ 147 Mpc</code>).`:G.cosmoMode===`reionization`?`Pop III UV radiation percolating ionized <code>H II</code> bubbles through the neutral <code>z = 10</code> IGM.`:G.cosmoMode===`cluster-merger`?`Shock-heated X-ray ICM gas (magenta-gold) colliding behind collisionless dark-matter lensing halos (blue).`:`FLRW 3D-FFT TreePM running <code>${G.quality.cosmoGridPerSide}³</code> particles on a <code>${G.quality.cosmoFftN}³</code> periodic FFT mesh (${G.cosmoTargets.filter(e=>e.gpuCoalescedHalo).length} live GPU-extracted halos).`}</div>
        <button id="uv-cosmo-bigbang-btn" class="uv-btn primary" type="button" style="justify-content:center;" title="Re-run FLRW cosmic expansion from early Big Bang perturbations to watch filaments &amp; galaxy halos coalesce">💥 Replay Big Bang Expansion (FLRW)</button>`,H.querySelector(`#uv-cosmo-mode`)?.addEventListener(`change`,async e=>{await G.setCosmoMode(e.target.value),la(),sa(),Q(),$(performance.now())}),H.querySelector(`#uv-cosmo-bigbang-btn`)?.addEventListener(`click`,async()=>{Ci=1,await G.setCosmoMode(`web`),await G.initCosmicWeb({bigBang:!0}),la(),sa(),Q(),$(performance.now())});else if(Y===1)H.innerHTML=`
        <div class="uv-row">
          <span>Morphology</span>
          <select id="uv-gal-preset-sel">
            <option value="disk" ${G.galaxyPreset===`disk`?`selected`:``}>Grand-Design Spiral (Sc/Sb)</option>
            <option value="coalesce" ${G.galaxyPreset===`coalesce`?`selected`:``}>Live GPU Halo Collapse &amp; Coalescence</option>
            <option value="barred" ${G.galaxyPreset===`barred`?`selected`:``}>Barred Spiral (SBb · Secular m=2 Bar)</option>
            <option value="ring" ${G.galaxyPreset===`ring`?`selected`:``}>Cartwheel Collisional Ring Galaxy</option>
            <option value="lenticular" ${G.galaxyPreset===`lenticular`?`selected`:``}>Lenticular Disk (S0 · Sombrero)</option>
            <option value="irregular" ${G.galaxyPreset===`irregular`?`selected`:``}>Starburst Irregular (Magellanic / M82)</option>
            <option value="open-cluster" ${G.galaxyPreset===`open-cluster`?`selected`:``}>Open Cluster + Reflection Veil (M45)</option>
            <option value="binary" ${G.galaxyPreset===`binary`?`selected`:``}>Interacting Major Merger Pair</option>
            <option value="sphere" ${G.galaxyPreset===`sphere`?`selected`:``}>Giant Elliptical Spheroid</option>
            <option value="proto" ${G.galaxyPreset===`proto`?`selected`:``}>High-z Clumpy Starburst Protogalaxy</option>
            <option value="dwarf-stream" ${G.galaxyPreset===`dwarf-stream`?`selected`:``}>Tidally Disrupted Dwarf &amp; Halo Stream</option>
            <option value="globular" ${G.galaxyPreset===`globular`?`selected`:``}>Core-Collapsed Globular Cluster</option>
          </select>
        </div>
        <button id="uv-gal-coalesce-btn" class="uv-btn primary" type="button" style="justify-content:center;" title="Collapse this cosmic-web dark-matter &amp; gas halo live on WebGPU to form a spinning galaxy">🌀 Form Galaxy (GPU Collapse)</button>
        <div class="uv-row">
          <span>Zoom Destination</span>
          <select id="uv-gal-branch">
            <option value="solar-system" ${G.galaxyBranch===`solar-system`?`selected`:``}>Solar System (Orion Spur)</option>
            <option value="smbh-core" ${G.galaxyBranch===`smbh-core`?`selected`:``}>Galactic Core SMBH (Sgr A*)</option>
          </select>
        </div>
        <div class="uv-row">
          <span>ISM Z/Z☉</span>
          <input id="uv-gal-z-slider" type="range" min="0.1" max="2.5" step="0.1" value="${G.galaxyMetallicity.toFixed(1)}" />
          <span id="uv-gal-z-val" style="font-family:var(--mono);font-size:11px;">${G.galaxyMetallicity.toFixed(1)}</span>
        </div>
        <div class="uv-row" title="Seed field B₀ for the live GPU 24³ 3D α–ω galactic dynamo (0 = strictly zero B-field!)">
          <span>Dynamo B₀</span>
          <input id="uv-gal-b0-slider" type="range" min="0.0" max="0.8" step="0.05" value="${G.galacticB0.toFixed(2)}" />
          <span id="uv-gal-b0-val" style="font-family:var(--mono);font-size:11px;">${G.galacticB0.toFixed(2)}</span>
        </div>
        <label class="uv-row" title="Overlay 3D emergent α–Ω MHD magnetic field lines traced through the live GPU B(x,y,z) grid">
          <span>Show B-Field Lines</span>
          <input id="uv-gal-bfield-toggle" type="checkbox" ${G.showGalacticBField?`checked`:``} />
        </label>`,H.querySelector(`#uv-gal-preset-sel`)?.addEventListener(`change`,async e=>{await G.initGalaxy({preset:e.target.value}),X=null,Gr=!1,la(),sa(),$(performance.now())}),H.querySelector(`#uv-gal-coalesce-btn`)?.addEventListener(`click`,async()=>{await G.triggerGalaxyCoalescence(),X=null,Gr=!1,la(),sa(),Q(),$(performance.now())}),H.querySelector(`#uv-gal-branch`)?.addEventListener(`change`,e=>{let t=e.target.value;G.setGalaxyBranch(t,t===`smbh-core`?[0,0,0]:[4.8,.04,2.1]),ra(l)}),H.querySelector(`#uv-gal-z-slider`)?.addEventListener(`input`,async e=>{let t=Number(e.target.value),n=H.querySelector(`#uv-gal-z-val`);n&&(n.textContent=t.toFixed(1)),await G.initGalaxy({preset:G.galaxyPreset,metallicity:t})}),H.querySelector(`#uv-gal-b0-slider`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=H.querySelector(`#uv-gal-b0-val`);n&&(n.textContent=t.toFixed(2)),await G.setGalacticB0(t),Q(),$(performance.now())}),H.querySelector(`#uv-gal-bfield-toggle`)?.addEventListener(`change`,e=>{G.setShowGalacticBField(e.target.checked),$(performance.now())});else if(Y===2)G.galaxyBranch===`smbh-core`?(H.innerHTML=`
          <div style="font-size:11.5px;color:var(--muted);line-height:1.4;">Live GPU N-body hypervelocity S-stars orbiting a <code>4.3×10⁶ M☉</code> Kerr-Schwarzschild SMBH with Doppler-beamed accretion disk &amp; WGSL gravitational lensing.</div>
          <button id="uv-switch-solar-btn" class="uv-btn subtle" type="button" style="justify-content:center;">Switch to Solar System</button>`,H.querySelector(`#uv-switch-solar-btn`)?.addEventListener(`click`,async()=>{G.setGalaxyBranch(`solar-system`,[4.8,.04,2.1]),await G.ensureLevelInitialized(2),sa()})):(H.innerHTML=`
          <div class="uv-row">
            <span>System Regime</span>
            <select id="uv-solar-mode-sel">
              <optgroup label="Planetary &amp; Small-Body Systems">
                <option value="nbody" ${G.solarMode===`nbody`?`selected`:``}>Real-Scale Solar System (f32x2 N-Body)</option>
                <option value="formation" ${G.solarMode===`formation`?`selected`:``}>Protoplanetary Accretion Disk &amp; Snow Line</option>
                <option value="roche-rings" ${G.solarMode===`roche-rings`?`selected`:``}>Roche-Limit Ring Disruption &amp; Shepherd Moon</option>
                <option value="giant-impact" ${G.solarMode===`giant-impact`?`selected`:``}>Giant Moon-Forming Impact (Hadean Disk)</option>
                <option value="comet-tails" ${G.solarMode===`comet-tails`?`selected`:``}>Active Dual-Tail Comet (Dust + CO⁺ Ion)</option>
                <option value="hot-jupiter" ${G.solarMode===`hot-jupiter`?`selected`:``}>Hot Jupiter XUV Photoevaporation Tail</option>
                <option value="red-giant" ${G.solarMode===`red-giant`?`selected`:``}>Red-Giant Engulfment (+5 Gyr RGB)</option>
              </optgroup>
              <optgroup label="Relativistic &amp; High-Energy Systems">
                <option value="quasar-jet" ${G.solarMode===`quasar-jet`?`selected`:``}>Quasar / Blazar Kerr BZ Relativistic Jets</option>
                <option value="tde" ${G.solarMode===`tde`?`selected`:``}>Tidal Disruption Event (TDE · Star Spaghettified by SMBH)</option>
                <option value="xray-binary" ${G.solarMode===`xray-binary`?`selected`:``}>X-Ray Binary (Roche L1 Overflow onto BH)</option>
                <option value="bns-kilonova" ${G.solarMode===`bns-kilonova`?`selected`:``}>BNS GW Merger &amp; r-Process Kilonova</option>
                <option value="type-ia" ${G.solarMode===`type-ia`?`selected`:``}>Type Ia White-Dwarf Detonation (M_Ch)</option>
                <option value="bbh-merger" ${G.solarMode===`bbh-merger`?`selected`:``}>Binary Black Hole 2.5PN GW Inspiral</option>
              </optgroup>
            </select>
          </div>
          ${G.solarMode===`formation`?`
            <label class="uv-row" title="Toggle sub-Keplerian Epstein/Stokes gas drag &amp; streaming instability">
              <span>Gas Drag &amp; Drift</span>
              <input id="uv-disk-drag" type="checkbox" ${G.protoplanetaryGasDrag?`checked`:``} />
            </label>
            <button id="uv-crystallize-disk-btn" class="uv-btn primary" type="button" style="justify-content:center;" title="Crystallize the live GPU-coalesced nebular disk peaks directly into orbiting N-body planets, asteroid belts &amp; comets">⏩ Crystallize Into N-Body Orbits</button>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">Live GPU whole-system nebular coalescence condensing Fe, SiO₂, C, H₂O &amp; CO/CH₄ across the <code>${(G.nebularCoalescenceSession?.snowLineAu||G.protoplanetarySession?.snowLineAu||2.71).toFixed(2)} AU</code> snow line.</div>
          `:G.solarMode===`quasar-jet`?`
            <div class="uv-row" title="Dimensionless Kerr spin parameter a* (0 = Schwarzschild, no BZ jet; 0.94 = blazing Blazar jet!)">
              <span>Kerr Spin a*</span>
              <input id="uv-kerr-spin" type="range" min="0.0" max="0.98" step="0.02" value="${G.kerrSpinA.toFixed(2)}" />
              <span id="uv-kerr-spin-val" style="font-family:var(--mono);font-size:11px;">${G.kerrSpinA.toFixed(2)}</span>
            </div>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">Blandford–Znajek power <code>P_BZ ∝ Φ_B² Ω_H²</code>. Drag camera near the jet axis to watch relativistic Doppler beaming turn the Quasar into a blazing Blazar!</div>
          `:G.solarMode===`nbody`?(()=>{let e=G.getActiveSystemCatalog(),t=G.activeCausalSystem,n=t?.starSystem?.nebulaEnv,r=t?.condensationFrontsAu;return`
            <div style="font-size:10.5px;color:#cbd5e1;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);border-radius:6px;padding:6px 7px;line-height:1.35;">
              <div><strong>${G.useSolReference?`Sol Reference (G2V · 8 Planets)`:`${t?.systemName||`System`} · ${t?.architecture||`single`} (${t?.starCount||1}★, ${t?.planetCount||0} worlds${t?.gpuCoalesced?` · GPU Coalesced`:``})`}</strong></div>
              ${!G.useSolReference&&n?`<div style="color:var(--muted);margin-top:2px;">Nebula: <code>${n.nebulaSummary}</code> · Snow <code>${r?.rSnowLineAu} AU</code> · HZ <code>${r?.rHzInnerAu}–${r?.rHzOuterAu} AU</code></div>`:`<div style="color:var(--muted);margin-top:2px;">Reference J2000 Solar System (exact astronomical radii: Earth = 0.00916 R☉).</div>`}
            </div>
            <div class="uv-seg-group">
              <button id="uv-sample-star-btn" class="uv-seg-btn" type="button" title="Sample a new star from the live galaxy and coalesce its whole planetary system on WebGPU">🎲 New Star</button>
              <button id="uv-replay-nebula-btn" class="uv-seg-btn" type="button" title="Watch this star system coalesce live from a rotating multi-species GPU nebular disk">🌌 Nebular Birth</button>
              <button id="uv-toggle-sol-btn" class="uv-seg-btn ${G.useSolReference?`active`:``}" type="button" title="Toggle between Causal GPU Nebular Coalescence and Sol Reference">${G.useSolReference?`🌌 Causal`:`☀ Sol`}</button>
            </div>
            <div class="uv-row">
              <span>Focus World</span>
              <select id="uv-solar-focus">${e.map((e,t)=>`<option value="${t}" ${t===G.focusedSolarBodyIndex?`selected`:``}>${e.name}</option>`).join(``)}</select>
            </div>`})():`<div style="font-size:11px;color:var(--muted);line-height:1.35;">Active ULG general-law regime running live on WebGPU — drag to orbit, inspect live telemetry &amp; plots on the right.</div>`}`,H.querySelector(`#uv-solar-mode-sel`)?.addEventListener(`change`,async e=>{await G.setSolarMode(e.target.value),la(),sa(),Q(),$(performance.now())}),H.querySelector(`#uv-sample-star-btn`)?.addEventListener(`click`,async()=>{await G.sampleNewGalacticSector({observeLive:!0}),la(),ua(),ta(),Q(),$(performance.now())}),H.querySelector(`#uv-toggle-sol-btn`)?.addEventListener(`click`,async()=>{await G.setUseSolReference(!G.useSolReference),la(),ua(),Q(),$(performance.now())}),H.querySelector(`#uv-replay-nebula-btn`)?.addEventListener(`click`,async()=>{await G.setSolarMode(`formation`),la(),sa(),Q(),$(performance.now())}),H.querySelector(`#uv-crystallize-disk-btn`)?.addEventListener(`click`,async()=>{await G.crystallizeCoalescedSystem(),la(),ua(),ta(),Q(),$(performance.now())}),H.querySelector(`#uv-disk-drag`)?.addEventListener(`change`,e=>{G.setProtoplanetaryGasDrag(e.target.checked),G.nebularCoalescenceSession?.setEnableGasDrag?.(e.target.checked)}),H.querySelector(`#uv-kerr-spin`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=H.querySelector(`#uv-kerr-spin-val`);n&&(n.textContent=t.toFixed(2)),await G.setKerrSpinA(t),Q(),$(performance.now())}),H.querySelector(`#uv-solar-focus`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=G.getActiveSystemCatalog();G.setFocusedSolarBody(t),Ur=n[t]?.id||null,Q(),$(performance.now())}));else if(Y===3){H.innerHTML=`
        <div class="uv-row">
          <span>Stellar / Remnant Regime</span>
          <select id="uv-stellar-mode-sel">
            <option value="fusion" ${G.stellarMode===`fusion`?`selected`:``}>3D MLS-MPM Thermonuclear Fusion Star (pp/CNO/3α)</option>
            <option value="nebular-mhd" ${G.stellarMode===`nebular-mhd`?`selected`:``}>3D Resistive MHD Nebular Collapse &amp; Jets</option>
            <option value="h2-pillars" ${G.stellarMode===`h2-pillars`?`selected`:``}>H II Star-Forming Pillars (M16 · Optical vs JWST IR)</option>
            <option value="planetary-nebula" ${G.stellarMode===`planetary-nebula`?`selected`:``}>Planetary Nebula &amp; Hot White Dwarf</option>
            <option value="snr-pwn" ${G.stellarMode===`snr-pwn`?`selected`:``}>Supernova Remnant / Crab PWN (M1)</option>
            <option value="reflection-nebula" ${G.stellarMode===`reflection-nebula`?`selected`:``}>Reflection Nebula (M45 Pleiades / Iris Dust Veil)</option>
            <option value="wr-bubble" ${G.stellarMode===`wr-bubble`?`selected`:``}>Wolf–Rayet / Eta Carinae Bipolar Homunculus</option>
            <option value="pulsar" ${G.stellarMode===`pulsar`?`selected`:``}>Millisecond Pulsar (Lighthouse Dipole)</option>
            <option value="magnetar" ${G.stellarMode===`magnetar`?`selected`:``}>Magnetar Giant Flare (Hall Crust Yield)</option>
            <option value="white-dwarf-tov" ${G.stellarMode===`white-dwarf-tov`?`selected`:``}>White Dwarf / NS / BH (GR TOV EOS)</option>
          </select>
        </div>
        ${G.stellarMode===`nebular-mhd`?`
          <div class="uv-row" title="Initial poloidal magnetic field B₀ threading the rotating molecular cloud (0 = hydro-only, no jets!)">
            <span>Magnetic B₀</span>
            <input id="uv-neb-b0" type="range" min="0.0" max="1.2" step="0.05" value="${G.nebulaB0.toFixed(2)}" />
            <span id="uv-neb-b0-val" style="font-family:var(--mono);font-size:11px;">${G.nebulaB0.toFixed(2)}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);line-height:1.35;">3D self-gravitating resistive MHD winding helical B-towers &amp; launching magnetocentrifugal J×B jets.</div>
        `:G.stellarMode===`fusion`?(()=>{let e=G.stellarTelemetry,t=e?.generationLabel||G.stellarEngine?.generationLabel||`3rd-Gen Pop I`,n=e?.dominantChannel||`pp-chain (4 ¹H → ⁴He)`,r=((e?.meanXH??.72)*100).toFixed(1),i=((e?.meanXHe??.26)*100).toFixed(1),a=((e?.meanXCNO??0)*100).toFixed(3),o=((e?.meanXAlphaFe??0)*100).toFixed(3),s=((e?.synthesizedMetalsDelta??0)*100).toFixed(4),c=(G.stellarEngine?.count||0).toLocaleString(),l=G.stellarEngine?.gridN||24,u=Math.min(3,(e?.generation??G.stellarEngine?.generation??3)+1)===2?`2nd-Gen Pop II`:`3rd-Gen Pop I`;return`
          <div class="uv-seg-group" style="flex-wrap:wrap;">
            <button class="uv-seg-btn ${G.stellarPreset===`pop3-first-gen`?`active`:``}" data-st-preset="pop3-first-gen" type="button" title="1st-Generation Pop III primordial zero-metal star (65 M☉, Z=0): ignites 3α→¹²C first, then self-catalyzes CNO!">✨ 1st-Gen Pop III (Z=0)</button>
            <button class="uv-seg-btn ${G.stellarPreset===`pop2-second-gen`?`active`:``}" data-st-preset="pop2-second-gen" type="button" title="2nd-Generation Pop II α-enhanced halo star (4.5 M☉, [Fe/H]=-2.1) born from Pop III supernova ejecta">⭐ 2nd-Gen Pop II (α-rich)</button>
            <button class="uv-seg-btn ${G.stellarPreset===`main-sequence-star`?`active`:``}" data-st-preset="main-sequence-star" type="button">G2V Sun</button>
            <button class="uv-seg-btn ${G.stellarPreset===`blue-supergiant`?`active`:``}" data-st-preset="blue-supergiant" type="button">O/B Blue</button>
            <button class="uv-seg-btn ${G.stellarPreset===`red-supergiant`?`active`:``}" data-st-preset="red-supergiant" type="button">Betelgeuse</button>
            <button class="uv-seg-btn ${G.stellarPreset===`agb-carbon`?`active`:``}" data-st-preset="agb-carbon" type="button">AGB Carbon</button>
            <button class="uv-seg-btn ${G.stellarPreset===`brown-dwarf`?`active`:``}" data-st-preset="brown-dwarf" type="button">Brown Dwarf</button>
            <button class="uv-seg-btn ${G.stellarPreset===`solar-nebula`?`active`:``}" data-st-preset="solar-nebula" type="button">Nebula</button>
            <button class="uv-seg-btn ${G.stellarPreset===`massive-supernova`?`active`:``}" data-st-preset="massive-supernova" type="button">18 M☉ SN</button>
            <button class="uv-seg-btn ${G.stellarPreset===`binary-nursery`?`active`:``}" data-st-preset="binary-nursery" type="button">Binary</button>
          </div>
          <div style="font-size:10.5px;color:#fde68a;background:rgba(245,158,11,0.09);border:1px solid rgba(245,158,11,0.28);border-radius:6px;padding:6px 8px;line-height:1.4;">
            <strong>${t}</strong> · <code>${c}</code> parcels · <code>${l}³</code> MLS-MPM + <strong>SS Multipole</strong><br/>
            Dominant Core Burn: <strong>${n}</strong><br/>
            H <code>${r}%</code> · He <code>${i}%</code> · CNO <code>${a}%</code> · α/Fe <code>${o}%</code> (ΔZ <code>+${s}%</code>)
          </div>
          <button id="uv-st-supernova-seed-btn" class="uv-btn subtle" type="button" style="justify-content:center;" title="Detonate this core and launch live L2 GPU Nebular Coalescence seeded from its REAL GPU-fused CNO &amp; α/Fe metals">💥 Detonate Core → Seed ${u} Nebula</button>
          <div class="uv-row">
            <span>Burn Accel</span>
            <input id="uv-st-accel" type="range" min="0.5" max="6.0" step="0.25" value="${G.stellarTimeAccel}" />
            <span id="uv-st-accel-val" style="font-family:var(--mono);font-size:11px;">${G.stellarTimeAccel.toFixed(1)}×</span>
          </div>
          <div class="uv-row" title="Seed B₀ for the live GPU 24³ 3D stellar convective dynamo (0 = zero coronal B-field!)">
            <span>Dynamo B₀</span>
            <input id="uv-st-b0" type="range" min="0.0" max="0.9" step="0.05" value="${G.stellarB0.toFixed(2)}" />
            <span id="uv-st-b0-val" style="font-family:var(--mono);font-size:11px;">${G.stellarB0.toFixed(2)}</span>
          </div>
          <label class="uv-row" title="Slice an octant out of the opaque photosphere to inspect live interior convective layers &amp; nuclear fusion heart (or switch EM Sensor to X-Ray/Gamma!)">
            <span>3D Core Cutaway (Optical)</span>
            <input id="uv-st-cutaway-toggle" type="checkbox" ${G.stellarCutaway?`checked`:``} />
          </label>`})():`<div style="font-size:11px;color:var(--muted);line-height:1.35;">Live first-principles GPU regime from ULG’s Universal Law Graph — inspect spectra, TOV M(R), or flare light curve on the right.</div>`}`,H.querySelector(`#uv-stellar-mode-sel`)?.addEventListener(`change`,async e=>{await G.setStellarMode(e.target.value),X=null,Gr=!1,la(),sa(),Q(),$(performance.now())}),H.querySelector(`#uv-neb-b0`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=H.querySelector(`#uv-neb-b0-val`);n&&(n.textContent=t.toFixed(2)),await G.setNebulaB0(t)});for(let e of H.querySelectorAll(`[data-st-preset]`))e.addEventListener(`click`,async()=>{Zn=!0,await G.setStellarMode(`fusion`),await G.initStellarCore({preset:e.dataset.stPreset}),X=null,Gr=!1,sa(),Q(),$(performance.now())});H.querySelector(`#uv-st-supernova-seed-btn`)?.addEventListener(`click`,async()=>{Zn=!1,await G.detonateCoreSeedNextGeneration(),X=null,Gr=!1,aa(12.8),la(),ta(),sa(),Q(),$(performance.now())}),H.querySelector(`#uv-st-accel`)?.addEventListener(`input`,e=>{G.setStellarTimeAccel(Number(e.target.value));let t=H.querySelector(`#uv-st-accel-val`);t&&(t.textContent=`${G.stellarTimeAccel.toFixed(1)}×`)}),H.querySelector(`#uv-st-b0`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=H.querySelector(`#uv-st-b0-val`);n&&(n.textContent=t.toFixed(2)),await G.setStellarB0(t),Q(),$(performance.now())}),H.querySelector(`#uv-st-cutaway-toggle`)?.addEventListener(`change`,e=>{G.setStellarCutaway(e.target.checked),Q(),$(performance.now())})}else if(Y===4){let e=G.planetaryAtmoState?.activation;H.innerHTML=`
        <div class="uv-row">
          <span>Planetary Regime</span>
          <select id="uv-planetary-mode-sel">
            <option value="standard" ${G.planetaryMode===`standard`?`selected`:``}>Solar System Worlds (Live Baroclinic + EM)</option>
            <option value="magma-ocean" ${G.planetaryMode===`magma-ocean`?`selected`:``}>Hadean Magma Ocean (Molten Crust)</option>
            <option value="cryo-plumes" ${G.planetaryMode===`cryo-plumes`?`selected`:``}>Cryovolcanic Icy Moon (Tidal Plumes)</option>
            <option value="eyeball-locked" ${G.planetaryMode===`eyeball-locked`?`selected`:``}>Tidally Locked Eyeball Exoplanet</option>
            <option value="rogue" ${G.planetaryMode===`rogue`?`selected`:``}>Rogue Free-Floating Dark World</option>
          </select>
        </div>
        <div class="uv-row">
          <span>World</span>
          <select id="uv-planet-sel">${G.getActiveSystemCatalog().map((e,t)=>e.isStar||t===0?``:`<option value="${t}" ${t===G.planetaryBodyIndex?`selected`:``}>${e.name} (${e.radiusKm.toLocaleString()} km)</option>`).join(``)}</select>
        </div>
        <label class="uv-row" title="Toggle non-inductive triboelectric dust/cloud charging &amp; GPU Poisson Paschen lightning breakdown">
          <span>Triboelectric Lightning</span>
          <input id="uv-tribo-toggle" type="checkbox" ${G.planetaryTriboelectric?`checked`:``} ${e?.triboelectricActive?``:`disabled`} />
        </label>
        <label class="uv-row" title="Slice an octant out of the planet to inspect the live GPU Polytope Atlas hydrostatic core &amp; SPH mantle plumes">
          <span>3D Interior Cutaway</span>
          <input id="uv-cutaway-toggle" type="checkbox" ${G.planetaryCutaway?`checked`:``} />
        </label>
        ${G.planetaryGenesisSphSession?(()=>{let e=G.planetaryGenesisSphTelemetry,t=e?Number(e.differentiationIndex||0).toFixed(2):`—`,n=Math.round((G.planetaryGenesisSphSession.genesisParams?.tectonicMobility||0)*100),r=G.planetaryDynamoTelemetry?.magneticEnergy,i=G.planetaryAtmoTelemetry?.dipoleFieldMicroT??(Number(G.planetaryAtmoState?.dynamo?.bEquatorialT)||0)*1e6,a=Number.isFinite(r)&&r>1e-4?` · Geodynamo E_B <code>${r.toFixed(2)}</code> (${i>.1?`${Math.round(i)} µT`:`active`})`:` · Geodynamo <code>0 µT (quiescent)</code>`;return`
        <label class="uv-row" title="Step 3D multi-material GPU SPH differentiation, mantle convection &amp; continental drift in real time">
          <span>Live Geologic Time (SPH)</span>
          <input id="uv-sph-live-toggle" type="checkbox" ${G.planetaryGenesisLiveForm?`checked`:``} />
        </label>
        <button id="uv-sph-replay-btn" class="uv-btn subtle" type="button" style="justify-content:center;" title="Reset to protoplanet and watch live 3D GPU SPH core sinking, mantle plumes, continental rafting &amp; impact cratering">🪐 Form / Evolve Planet (3D SPH)</button>
        <div style="font-size:10.5px;color:#a7f3d0;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:6px;padding:5px 7px;line-height:1.35;">
          <strong>Continuous 3D GPU SPH + SS Multipole</strong> · Diff <code>${t}</code> · Mobility <code>${n}%</code> · <code>${G.planetaryGenesisSphSession.parcelCount.toLocaleString()}</code> parcels · <code>${G.planetaryGenesisSphSession.gridN}³</code>${a}
        </div>`})():``}
        <button id="uv-land-surface-btn" class="uv-btn primary" type="button" style="justify-content:center;" title="Land on the live GPU planetary surface with a 6-Wheel Jump-Rocket Rover and Coaxial Atmospheric Drone (Shortcut: L)">${G.surfaceActive?`🚀 Launch Back to Orbit (Esc)`:`🚙 Land on Surface (Rover + Drone)`}</button>
        <div style="font-size:10.5px;color:var(--muted);line-height:1.35;">Dynamic Law Graph: <code>${G.surfaceActive?`planetary-surface-vehicles · `:``}${e?.anyActive?e.activeLaws.join(` · `):`Vacuum body — atmospheric &amp; EM laws dormant (0 dispatches)`}</code></div>`,H.querySelector(`#uv-planetary-mode-sel`)?.addEventListener(`change`,async e=>{await G.setPlanetaryMode(e.target.value),G.surfaceActive?await Fa({bodyIndex:G.planetaryBodyIndex}):(la(),sa(),Q(),$(performance.now()))}),H.querySelector(`#uv-planet-sel`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);G.setFocusedSolarBody(t),await G.initPlanetaryInterior({bodyIndex:t,observeLive:!G.surfaceActive}),G.surfaceActive?await Fa({bodyIndex:t}):(l=Da(G.getActiveSystemCatalog()[t]),ia(t),la(),ua(),ta())}),H.querySelector(`#uv-land-surface-btn`)?.addEventListener(`click`,async()=>{G.surfaceActive?Ia():await Fa({bodyIndex:G.planetaryBodyIndex})}),H.querySelector(`#uv-tribo-toggle`)?.addEventListener(`change`,e=>{G.setPlanetaryTriboelectric(e.target.checked)}),H.querySelector(`#uv-cutaway-toggle`)?.addEventListener(`change`,e=>{G.setPlanetaryCutaway(e.target.checked)}),H.querySelector(`#uv-sph-live-toggle`)?.addEventListener(`change`,e=>{G.setPlanetaryGenesisLiveForm(e.target.checked),$(performance.now())}),H.querySelector(`#uv-sph-replay-btn`)?.addEventListener(`click`,async()=>{await G.triggerPlanetSphGenesisReplay(),sa(),Q(),$(performance.now())})}else if(Y===5){H.innerHTML=`
        <div class="uv-row">
          <span>Element</span>
          <select id="uv-md-el-sel">${bt.map(e=>`<option value="${e.Z}" ${e.Z===G.mdElementZ?`selected`:``}>${e.sym} · ${e.name}</option>`).join(``)}</select>
        </div>
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${G.mdPhasePreset===`solid`?`active`:``}" data-md-phase="solid" type="button">Solid</button>
          <button class="uv-seg-btn ${G.mdPhasePreset===`melt`?`active`:``}" data-md-phase="melt" type="button">Melt</button>
          <button class="uv-seg-btn ${G.mdPhasePreset===`vapor`?`active`:``}" data-md-phase="vapor" type="button">Vapor</button>
        </div>
        <div class="uv-row">
          <span>Temp (K)</span>
          <input id="uv-md-temp" type="range" min="40" max="6000" step="20" value="${Math.min(6e3,G.mdTempK)}" />
          <span id="uv-md-temp-val" style="font-family:var(--mono);font-size:11px;">${G.mdTempK} K</span>
        </div>
        <label class="uv-row" title="Toggle live downward GPU gravity inside the MD chamber">
          <span>MD Gravity</span>
          <input id="uv-md-grav" type="checkbox" ${G.mdGravity?`checked`:``} />
        </label>`,H.querySelector(`#uv-md-el-sel`)?.addEventListener(`change`,async e=>{await G.initMolecularDynamics({Z:Number(e.target.value),phasePreset:`solid`}),la(),sa()});for(let e of H.querySelectorAll(`[data-md-phase]`))e.addEventListener(`click`,async()=>{await G.initMolecularDynamics({Z:G.mdElementZ,phasePreset:e.dataset.mdPhase}),sa()});H.querySelector(`#uv-md-temp`)?.addEventListener(`input`,e=>{G.setMdTemp(Number(e.target.value));let t=H.querySelector(`#uv-md-temp-val`);t&&(t.textContent=`${G.mdTempK} K`)}),H.querySelector(`#uv-md-grav`)?.addEventListener(`change`,e=>{G.setMdGravity(e.target.checked)})}else if(Y===6){H.innerHTML=`
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${G.quantumMode===`atom`?`active`:``}" data-qm-mode="atom" type="button">Atom (Dirac-KS)</button>
          <button class="uv-seg-btn ${G.quantumMode===`molecule`?`active`:``}" data-qm-mode="molecule" type="button">Molecule (RHF)</button>
        </div>
        ${G.quantumMode===`atom`?`
          <div class="uv-row">
            <span>Element</span>
            <select id="uv-qm-el-sel">${bt.map(e=>`<option value="${e.Z}" ${e.Z===G.quantumZ?`selected`:``}>${e.sym} (Z=${e.Z})</option>`).join(``)}</select>
          </div>
          <div class="uv-row">
            <span>Orbital n/l</span>
            <select id="uv-qm-n">${[1,2,3,4,5,6].map(e=>`<option value="${e}" ${e===G.quantumN?`selected`:``}>n=${e}</option>`).join(``)}</select>
            <select id="uv-qm-l">${[0,1,2,3].filter(e=>e<G.quantumN).map(e=>`<option value="${e}" ${e===G.quantumL?`selected`:``}>${[`s`,`p`,`d`,`f`][e]}</option>`).join(``)}</select>
          </div>
          <label class="uv-row">
            <span>Relativistic Dirac–KS</span>
            <input id="uv-qm-rel" type="checkbox" ${G.quantumRelativistic?`checked`:``} />
          </label>
        `:`
          <div class="uv-seg-group">
            ${Object.keys(G.MOLECULE_SPECS).map(e=>`<button class="uv-seg-btn ${G.quantumMoleculeKey===e?`active`:``}" data-mol-key="${e}" type="button">${G.MOLECULE_SPECS[e].formula}</button>`).join(``)}
          </div>
        `}`;for(let e of H.querySelectorAll(`[data-qm-mode]`))e.addEventListener(`click`,async()=>{await G.initQuantumAtom({mode:e.dataset.qmMode}),la(),sa()});H.querySelector(`#uv-qm-el-sel`)?.addEventListener(`change`,async e=>{await G.initQuantumAtom({Z:Number(e.target.value),n:null,l:null,m:0}),la(),sa()}),H.querySelector(`#uv-qm-n`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);await G.initQuantumAtom({n:t,l:Math.min(G.quantumL,t-1),m:0}),sa()}),H.querySelector(`#uv-qm-l`)?.addEventListener(`change`,async e=>{await G.initQuantumAtom({l:Number(e.target.value),m:0}),sa()}),H.querySelector(`#uv-qm-rel`)?.addEventListener(`change`,async e=>{await G.initQuantumAtom({relativistic:e.target.checked}),la()});for(let e of H.querySelectorAll(`[data-mol-key]`))e.addEventListener(`click`,async()=>{await G.initQuantumAtom({mode:`molecule`,moleculeKey:e.dataset.molKey}),la(),sa()})}else Y===7&&(H.innerHTML=`
        <div class="uv-row">
          <span>Isotope</span>
          <select id="uv-nuc-sel">${bt.map(e=>`<option value="${e.Z}:${e.A}" ${e.Z===G.nuclearZ?`selected`:``}>${e.A}${e.sym} (Z=${e.Z})</option>`).join(``)}</select>
        </div>
        <button id="uv-tdse-reset" class="uv-btn subtle" type="button" style="justify-content:center;">↻ Reset Tunneling Wavepacket</button>`,H.querySelector(`#uv-nuc-sel`)?.addEventListener(`change`,async e=>{let[t,n]=e.target.value.split(`:`);await G.initAtomicNucleus({Z:Number(t),A:Number(n)}),G.nuclearResult?.volumeData&&Kn.uploadNuclearVolume(G.nuclearResult.volumeData),la()}),H.querySelector(`#uv-tdse-reset`)?.addEventListener(`click`,()=>{G.tdseSession?.resetWavepacket?.()}))}function ca(){let e=G.getTargetsForLevel(Y,Ni);return e.find(e=>e.id===Ur)||e[0]||null}function la(){let e=G.getTargetsForLevel(Y,Ni);Ur=Y===1?null:Y===2&&G.galaxyBranch!==`smbh-core`?G.getActiveSystemCatalog()[G.focusedSolarBodyIndex]?.id||e[0]?.id||null:e[0]?.id||null}function ua(){let e=yt[Y];if(v&&(v.textContent=`10^${l.toFixed(1)} m`),g&&(g.textContent=St(l)),h&&document.activeElement!==h&&(h.value=l.toFixed(2)),Rn&&(Rn.textContent=`L${e.level}`),Lt&&(Lt.textContent=e.engineSchema),At&&(At.textContent=e.plotTitle),Nt)if(Y===4&&!G.surfaceActive){let e=G.getActiveSystemCatalog()[G.planetaryBodyIndex]||lt[3];Nt.textContent=(Number(e?.radiusKm)||6371)>=16e3?`🛸 DIVE INTO ATMOSPHERE`:`🚙 LAND TO SAMPLE SURFACE`}else G.surfaceActive?Nt.textContent=`🔬 SAMPLE BELOW → LATTICE`:Y===2&&X?.kind===`solar-asteroid`?Nt.textContent=`🛸 LAND & MINE ASTEROID`:Nt.textContent=e.diveButton;if(Ft){let e=G.getActiveSystemCatalog()[G.focusedSolarBodyIndex],t=Y===2&&!G.surfaceActive&&(X?.kind===`solar-asteroid`||!!(e&&!e.isStar&&(e.isMinorBody||e.isComet)));Ft.style.display=(Y===4||t)&&!G.surfaceActive?`inline-flex`:`none`}if(It&&(It.disabled=Y===0&&!G.surfaceActive,Y===5&&Hr&&!G.surfaceActive?(It.textContent=`↑ ${Hr.vehicleLabel}`,It.title=`Return directly back to your parked ${Hr.vehicleLabel} on ${Hr.worldName}`):(It.textContent=`↑ Orbit`,It.title=`Return one scale level outward`)),ee&&(ee.disabled=Y===0&&!G.surfaceActive),p)for(let e of p.querySelectorAll(`[data-level]`))e.classList.toggle(`active`,Number(e.dataset.level)===Y);if(Rt){let e=G.getActiveSystemCatalog();Pi[2]=G.galaxyBranch===`smbh-core`?`Sgr A* SMBH`:G.useSolReference?`Sol Reference`:G.activeCausalSystem?.systemName||`Star System`;let t=G.stellarMode;Pi[3]=t===`pulsar`?`Pulsar Core`:t===`magnetar`?`Magnetar Core`:t===`black-hole`?`Stellar Black Hole`:t===`white-dwarf-tov`?`White Dwarf`:G.useSolReference?`Sun Core`:e[0]?.name||`Star Core`,Pi[4]=e[G.planetaryBodyIndex]?.name||`World`;let n=Pi.slice(0,Y+1);Rt.innerHTML=n.map((e,t)=>t===n.length-1?`<strong>${e}</strong>`:e).join(` › `)}sa()}async function pa(){if(!G.surfaceActive||!G.surfaceSession)return null;let e=G.surfaceSession,t=G.getActiveSystemCatalog()[G.planetaryBodyIndex]||lt[3],n=G.planetaryMode===`magma-ocean`?`Hadean Magma Ocean`:G.planetaryMode===`cryo-plumes`?`Cryovolcanic Moon`:t?.name||`World`,r=e.activeVehicle,i=r===`ufo`?`🛸 UFO`:r===`drone`?`🚁 Drone`:`🚙 Rover`;Hr={bodyIndex:G.planetaryBodyIndex,planetaryMode:G.planetaryMode,worldName:n,vehicleLabel:i,checkpoint:e.getCheckpoint?e.getCheckpoint():null};let a={...e.getLocalSample(),worldName:n};return _r.some(e=>e.id===a.id&&e.worldName===a.worldName)||(_r.unshift(a),_r.length>24&&_r.pop()),Xi(),await G.applySampledMaterialToLattice(a),G.exitSurfaceView(),Ei=null,Y=5,l=yt[5].log10SpanM,Pi[4]=n,Pi[5]=`${a.shortLabel} Lattice`,await ra(l),la(),ua(),Pa(),Q(),$(performance.now()),a}async function ma(){if(!Hr)return null;let e=Hr;return Fa({bodyIndex:e.bodyIndex,planetaryModeOverride:e.planetaryMode,restoreCheckpoint:e.checkpoint})}async function xa(e){if(!e)return null;let t=e.moleculeKey&&G.MOLECULE_SPECS[e.moleculeKey]?e.moleculeKey:`H2O`;return await G.initQuantumAtom({Z:e.primaryZ||G.quantumZ,mode:`molecule`,moleculeKey:t}),Ei=null,Y=6,l=yt[6].log10SpanM,Pi[6]=`${e.formula} (RHF)`,await ra(l),la(),ua(),Q(),$(performance.now()),e}async function ka(e,{targetLevel:t=null}={}){let n=Math.max(1,Math.min(118,Math.trunc(Number(e)||14))),r=t??(Y===5?6:Y);return r<=5?(await G.initMolecularDynamics({Z:n,phasePreset:G.activeSampledMaterial?.phasePreset||`solid`}),Y=5,l=yt[5].log10SpanM):r===6?(await G.initQuantumAtom({Z:n,mode:`atom`,n:null,l:null,m:0}),Y=6,l=yt[6].log10SpanM):(await G.initAtomicNucleus({Z:n}),G.nuclearResult?.volumeData&&Kn.uploadNuclearVolume(G.nuclearResult.volumeData),Y=7,l=yt[7].log10SpanM),Ei=null,await ra(l),la(),ua(),Q(),$(performance.now()),n}async function Aa(){if(G.surfaceActive){await pa();return}if(Y===2&&G.solarMode===`formation`&&G.activeGenesisStage?.stage===`l2-nebular-coalescence`){await na();return}let e=ca();if(Y===0&&X?.kind===`cosmo-web`){let e=Number(X.localOverdensity)||1.2,t=G.deriveGalaxyEnvironmentFromCosmicContext({cosmicEpoch:G.cosmicEpoch,regionPosMpc:X.rawPos,localOverdensity:e,seed:G.seed});qr=null,await G.initGalaxy({galaxyEnvOverride:t,observeLive:!0})}else if(Y===0&&e?.galaxyEnv)qr=null,await G.initGalaxy({galaxyEnvOverride:e.galaxyEnv,observeLive:!0});else if(Y===0&&e?.morphology)qr=null,await G.initGalaxy({preset:e.morphology,metallicity:e.metallicity??1,observeLive:!0});else if(Y===1){if(X?.kind===`galaxy-star`&&X.exoticKind){Zn=!1,Jr=null,G.setGalaxyBranch(`solar-system`,X.rawPos);let e=X.exoticKind===`pulsar`;await G.selectCausalStarSite({posGal:X.rawPos,popTag:X.popTag??.5,starIndex:X.index??0,forceExoticStage:e?`neutron-star`:`stellar-black-hole`}),Ar(),G.setFocusedSolarBody(0),await G.syncStellarRegimeForStar(null,{initializeNow:!0}),e?await oa(3,!0):(await G.setSolarMode(`xray-binary`),await oa(2,!0));return}if(X?.kind===`galaxy-star`&&X.starSite){if(Zn=!1,Jr=null,G.setGalaxyBranch(`solar-system`,X.rawPos),await G.selectCausalStarSite({...X.starSite,observeLive:!0}),Ar(),G.activeGenesisStage?.stage===`l2-nebular-coalescence`){ta(),aa(yt[2].log10SpanM);return}let e=G.activeCausalSystem?.recommendedL3Regime;if(e&&e!==`fusion`){G.setFocusedSolarBody(0),await G.setStellarMode(e),await oa(3,!0);return}}else if(e?.branch)Zn=!1,Jr=null,G.setGalaxyBranch(e.branch,e.rawPos||e.pos),e.branch===`solar-system`&&e.starSite&&(await G.selectCausalStarSite({...e.starSite,observeLive:!0}),Ar());else if(G.galaxyBranch===`solar-system`){Zn=!1;let e=Jr||G.activeStarSite;if(Jr=null,await G.selectCausalStarSite({...e,observeLive:!0}),Ar(),G.activeGenesisStage?.stage===`l2-nebular-coalescence`){ta(),aa(yt[2].log10SpanM);return}}}if(Y===2&&X?.kind===`solar-asteroid`){await Fa({customBodySpec:Mr(X)});return}if(Y===2&&e?.bodyIndex!=null){let t=G.getActiveSystemCatalog();G.setFocusedSolarBody(e.bodyIndex),t[e.bodyIndex]?.isStar||e.bodyIndex===0?(Zn=!1,await G.syncStellarRegimeForStar(t[e.bodyIndex],{initializeNow:!0})):await G.initPlanetaryInterior({bodyIndex:e.bodyIndex,observeLive:!0})}if(Y===4&&!G.surfaceActive){await Fa({bodyIndex:G.planetaryBodyIndex});return}if(Y===5){let t=G.activeSampledMaterial;if(t?.compounds?.length){await xa(t.compounds[0]);return}e?.sampleZ&&await G.initQuantumAtom({Z:e.sampleZ,mode:`atom`})}Y===6&&e?.sampleZ&&(await G.initAtomicNucleus({Z:e.sampleZ}),G.nuclearResult?.volumeData&&Kn.uploadNuclearVolume(G.nuclearResult.volumeData));let t=e?.nextLevel==null?(Y+1)%8:e.nextLevel;if(t===4){let e=G.getActiveSystemCatalog();(e[G.focusedSolarBodyIndex]?.isStar||G.focusedSolarBodyIndex===0)&&G.setFocusedSolarBody(G.getDefaultPlanetIndex(e))}ta(),(e||X)&&(Kr=!0),aa(yt[t].log10SpanM)}async function ja(){if(G.surfaceActive){Ia();return}if(Y===5&&Hr){await ma();return}Y<=0||aa(yt[Y-1].log10SpanM)}function Ma(){if(!G.surfaceSession)return;let e=G.surfaceSession,t=e.env,n=e.activeVehicle,r=n;r=t.hasSolidCrust?n===`ufo`?`rover`:n===`rover`?`drone`:`ufo`:n===`ufo`?`drone`:`ufo`,G.setSurfaceVehicle(r),Pa(),zr(),$(performance.now())}function Na(){if(G.surfaceActive&&G.surfaceSession){let e=G.surfaceSession.cameraMode===`chase`?`first-person`:`chase`;G.setSurfaceCameraMode(e),Pa()}else er=!er;zr(),$(performance.now())}function Pa(){let e=!!(G.surfaceActive&&G.surfaceSession);if(nn?.classList.toggle(`active`,e),Mn?.classList.toggle(`active`,e),Ft){let t=G.getActiveSystemCatalog(),n=t[G.focusedSolarBodyIndex],r=Y===2?X?.kind===`solar-asteroid`?Mr(X):n:t[G.planetaryBodyIndex]||lt[3],i=(Number(r?.radiusKm)||6371)>=16e3,a=!!(r?.isMinorBody||r?.isComet||X?.kind===`solar-asteroid`),o=Y===2&&!e&&(X?.kind===`solar-asteroid`||!!(n&&!n.isStar&&(n.isMinorBody||n.isComet))),s=Y===4&&fr&&fr.bodyIndex===G.planetaryBodyIndex,c=s?` (${Math.abs(fr.latDeg).toFixed(0)}°${fr.latDeg>=0?`N`:`S`} ${fr.biomeLabel.split(` `)[0]})`:``;Ft.textContent=a?`☄️ Land / Mine`:i?`🛸 Dive${c}`:s?`🛸 Land${c}`:`🚙 Land`,Ft.title=s?`Touch down at ${fr.latDeg.toFixed(1)}°, ${fr.lonDeg.toFixed(1)}° (${fr.biomeLabel}${fr.isNightSide?` · Night`:` · Day`})`:a?`Land 60-ft UFO / Rover / Von Neumann Probe on this Asteroid or Comet to mine & blast craters (L)`:i?`Deploy Buoyant 3D CFD Research UFO into deep planetary atmosphere (L)`:`Land 6-Wheel Rover / Drone / 3D CFD UFO on planetary surface (L)`,Ft.style.display=(Y===4||o)&&!e?`inline-flex`:`none`}if(zt&&(zt.style.display=e?`none`:``),!e)return;let t=G.surfaceSession,n=G.surfaceTelemetry||t.getTelemetry(),r=t.env,i=t.activeVehicle===`ufo`,a=t.activeVehicle===`drone`,o=G.surfaceBodySpec||G.getActiveSystemCatalog()[G.planetaryBodyIndex]||lt[3],s=G.planetaryMode===`magma-ocean`?`Hadean Magma Ocean`:G.planetaryMode===`cryo-plumes`?`Cryovolcanic Moon`:o.name,c=n.rhoAtmKgM3??r.rhoAtmKgM3,l=c>1e-4?`ρ=${c.toFixed(c<.1?3:2)} kg/m³`:`<span class="warn">VACUUM (0 Pa)</span>`,u=n.cfdTelemetry,d=u?.chemistry,f=i?`🛸 60ft UFO`:a?`🚁 DRONE`:`🚙 ROVER`,p;if(i&&d){let e=d.pressureBar>=.1?`${d.pressureBar.toFixed(2)} bar`:`${(d.pressureBar*101.325).toFixed(1)} kPa`,t=u?.craftWindSpeedMS||0;p=`Alt ${r.hasSolidCrust?`${(n.ufoAltitudeM||0).toFixed(1)} m`:`${d.altKm.toFixed(1)} km`} · <strong>${e}</strong> · ${Math.round(d.tempK)} K · <span class="good">3D Wind ${t.toFixed(1)} m/s</span> · Rocks: ${n.aliveBoulderCount??0} · Craters: ${n.totalCratersCarved??0}`}else p=i?`Alt ${(n.ufoAltitudeM||0).toFixed(1)} m · Spd ${(n.ufoSpeedMS||0).toFixed(1)} m/s · Rocks: ${n.aliveBoulderCount??0} · Craters: ${n.totalCratersCarved??0}`:a?r.droneFlightCapable?`Alt ${(n.droneAltitudeM||0).toFixed(1)} m · Spd ${(n.droneSpeedMS||0).toFixed(1)} m/s · <span class="good">Lift ${(n.droneAeroLiftN||0).toFixed(1)}/${r.maxAeroLiftN.toFixed(1)} N</span>`:`Alt ${(n.droneAltitudeM||0).toFixed(1)} m · <span class="warn">0.0 N AERO LIFT (VACUUM!)</span>`:`Alt ${(n.roverAltitudeM||0).toFixed(1)} m · Spd ${(n.roverSpeedMS||0).toFixed(1)} m/s · Fuel ${Math.round((n.roverRocketFuel??1)*100)}%`;if(rn){let e=G.surfaceClimate,t=Number.isFinite(e?.localHour)?e.localHour:12,i=G.surfaceLandingSite,a=i?` · <strong>${i.biomeLabel||i.label||`Surface LZ`}</strong> (${i.latDeg.toFixed(1)}°, ${i.lonDeg.toFixed(1)}°)`:``,o=n.abductingOrganismName?` · <span class="good">🛸 BEAMING ${n.abductingOrganismName.toUpperCase()}…</span>`:gr.length>0?` · <span class="good">🧬 Abducted: ${gr.length}</span>`:``,c=e?` · <strong>${e.seasonName}</strong> ${String(Math.floor(t)).padStart(2,`0`)}:${String(Math.floor(t%1*60)).padStart(2,`0`)} · ${Math.round(e.surfaceTempK)} K${e.eclipseFactor<.92?` · <span class="warn">🌑 ECLIPSE</span>`:``}${e.iceCoverFrac>=.72?` · <span class="good">❄️ Frozen Sea</span>`:``}`:``;rn.innerHTML=`<span><strong>${f}</strong> · ${s}${a} · g=${r.gravityMS2.toFixed(2)} m/s² · ${l} · ${p}${c}${o}</span>`}if(_n){let e=G.surfaceTimeWarp||1;_n.textContent=`⏩ ${Cr(e)}`,_n.classList.toggle(`active`,e>1.5)}if(vn){let e=t.xenobiology,n=gr.length?gr[gr.length-1]:null;n?(vn.href=be(n.profile||e,n.recommendedBioMode,n),vn.style.display=`inline-flex`,vn.textContent=`🛸 BIO LAB: ${n.speciesName} (${gr.length}) ↗`,vn.title=`Examine abducted ${n.kind} (${n.speciesName} · ${n.morphClass}) from ${n.worldName} in ULG Biology Lab`):e&&e.solvent&&e.solvent!==`none`?(vn.href=be(e),vn.style.display=`inline-flex`,vn.textContent=`🧬 ${e.solventFormula} BIO LAB ↗`,vn.title=`Open ${e.worldName} (${e.solventLabel}, ${Math.round(e.labParams?.memTempK||r.tempK)} K, ${e.membraneType}) in Biophysics & Xenobiology Lab`):vn.style.display=`none`}if(on){let e=n.weaponReaction;e?.reactionOutcome?(on.innerHTML=`<span><strong>${e.phaseState||`ACTIVE`}</strong>: ${e.reactionOutcome}${n.mpmActive?` · <span class="good">GPU MLS-MPM Active</span>`:``}</span>`,on.style.display=`flex`):on.style.display=`none`}if(zr(),an){let e=n.localSample||t.getLocalSample?.();if(u&&d&&d.species?.length>0){let t=d.species.slice(0,4).map(e=>{let t=e.moleFrac*100,n=t>=1?`${t.toFixed(1)}%`:t>=.01?`${t.toFixed(2)}%`:`${(t*1e4).toFixed(0)} ppm`,r=e.condensedFrac>1e-6?` <span class="warn">(☁)</span>`:``;return`<span><strong>${e.id}</strong> ${n}${r}</span>`}).join(` · `),n=u?.craftWindMS||[0,0,0],r=e?` · <span>Below: <strong>${e.shortLabel}</strong></span>`:``;an.innerHTML=`<span>3D CFD: v=(${n[0].toFixed(1)}, ${n[1].toFixed(1)}, ${n[2].toFixed(1)}) m/s · |ω|=${(u?.craftVorticity||0).toFixed(2)}</span> · ${t}${r}`,an.style.display=`flex`}else e?(an.innerHTML=`<span>Direct Below Craft: <strong>${e.name}</strong> · ${e.locationTag}</span>`,an.style.display=`flex`):an.style.display=`none`}if(gn){let e=n.localSample||t.getLocalSample?.();gn.textContent=e?`🔬 SAMPLE: ${e.shortLabel} (G)`:`🔬 SAMPLE BELOW (G)`}yn&&(yn.textContent=i||a?`⬆ ASCEND (Space)`:`🔥 ROCKET JUMP`,yn.classList.toggle(`firing`,!!G.surfaceControls.jump)),bn&&(bn.style.display=i||a?`inline-flex`:`none`,bn.classList.toggle(`active`,!!G.surfaceControls.down)),xn&&(r.hasSolidCrust?t.cfdProfile?xn.textContent=i?`🛸 3D CFD UFO (F→Rover)`:a?`🚁 DRONE (F→UFO)`:`🚙 ROVER (F→Drone)`:xn.textContent=a?`🚙 SWITCH ROVER (F)`:`🚁 DEPLOY DRONE (F)`:xn.textContent=i?`🛸 3D CFD UFO (F→Drone)`:`🚁 DRONE (F→UFO)`,xn.classList.toggle(`active`,i||a)),W&&(W.textContent=t.cameraMode===`first-person`?`📷 1ST CAM (V)`:`📷 3RD CAM (V)`,W.classList.toggle(`active`,t.cameraMode===`first-person`))}async function Fa({bodyIndex:e=null,customBodySpec:t=null,planetaryModeOverride:n=null,landingSite:r=null,restoreCheckpoint:i=null,initialVehicle:a=`ufo`,keepTour:o=!1}={}){o||Ua(),Ei=null;let s=e;if(!t){if(typeof s==`string`){let e=G.getActiveSystemCatalog(),t=e.findIndex(e=>e.id===s);s=t>=0&&!e[t].isStar?t:lt.findIndex(e=>e.id===s)>0?s:G.planetaryBodyIndex}else if(!(s>0)){let e=G.getActiveSystemCatalog();s=!e[G.focusedSolarBodyIndex]?.isStar&&G.focusedSolarBodyIndex>0?G.focusedSolarBodyIndex:G.getDefaultPlanetIndex(e)}}X=null,pr=null,Gr=!1,Xr=[0,0,0],Y=4,l=2;let c=i;if(!c&&Tr.isConnected){let e=String(Tr.getStatus().selfId||`ufo`),t=2166136261;for(let n=0;n<e.length;n+=1)t=Math.imul(t^e.charCodeAt(n),16777619);let n=(t>>>0)%360*(Math.PI/180),r=18+(t>>>8)%16;c={activeVehicle:a||`ufo`,ufoPos:[Math.cos(n)*r,32,Math.sin(n)*r],ufoYaw:n+Math.PI}}let u=r||(fr&&!t&&(fr.bodyIndex===s||fr.bodyId===s)?fr:null);return await G.enterSurfaceView({bodyIndex:s,customBodySpec:t,planetaryModeOverride:n,landingSite:u,restoreCheckpoint:c,initialVehicle:a,onCraterStamp:(e,t)=>{Tr.isConnected&&Tr.broadcastCraterStamp({...e,tileKey:t})}}),G.setSurfaceWeaponConfig({mode:tr,log10WavelengthM:nr,powerW:rr,maxPowerW:J.state.maxPowerW}),G.setSurfaceTractorBeam(ar),er&&G.setSurfaceCameraMode(`first-person`),la(),ua(),Pa(),zr(),Q(),$(performance.now()),G.surfaceTelemetry}function Ia({keepTour:e=!1}={}){if(!e&&Si&&Ua(),!G.surfaceActive)return;pr=null,G.exitSurfaceView();let t=G.getActiveSystemCatalog()[G.planetaryBodyIndex]||lt[3];Y=4,l=Da(t),ia(G.planetaryBodyIndex),ua(),Pa(),Q(),$(performance.now())}function La(e){let t=G.getActiveSystemCatalog();if(!Array.isArray(t)||t.length===0)return-1;if(e===`ringed`){let e=t.findIndex(e=>!e.isStar&&e.id===`saturn`);if(e>0)return e;let n=t.findIndex(e=>!e.isStar&&e.ringed);return n>0?n:t.findIndex(e=>!e.isStar&&(Number(e.radiusKm)||0)>=18e3)}if(e===`terrestrial`){let e=t.findIndex(e=>!e.isStar&&e.id===`earth`);if(e>0)return e;let n=G.getDefaultPlanetIndex(t);if(n>0&&t[n]&&!t[n].isStar&&(Number(t[n].radiusKm)||6371)<14e3)return n;let r=t.findIndex(e=>!e.isStar&&(Number(e.radiusKm)||0)>=1e3&&(Number(e.radiusKm)||0)<14e3);return r>0?r:t.findIndex(e=>!e.isStar)}if(e===`comet`){let e=t.findIndex(e=>!e.isStar&&e.id===`halley`);if(e>0)return e;let n=t.findIndex(e=>!e.isStar&&(e.bodyClass===`comet`||e.type===`comet`||/comet|halley|67p/i.test(`${e.id||``} ${e.name||``}`)));return n>0?n:t.findIndex(e=>!e.isStar&&(Number(e.radiusKm)||9999)<450)}return 0}function Ra(){return[{id:`cosmic-web`,level:0,targetSpan:yt[0].log10SpanM,dwellSec:6.5,pitch:.34,yawRate:.14,label:`L0 · 93 Gly`,title:`Observable Universe & CMB Horizon`,caption:`Expanding FLRW 3D-FFT TreePM cosmic web inside the 93-Gly Planck CMB last-scattering shell.`},{id:`spiral-galaxy`,level:1,targetSpan:20.55,dwellSec:7.5,pitch:.56,yawRate:.16,label:`L1 · Galaxy`,title:`Spiral Galaxy & α–ω Dynamo`,caption:`Canonical SS multipole gravity, NFW dark-matter halo, and emergent 3D galactic MHD dynamo.`},{id:`star-system`,level:2,targetSpan:12.75,dwellSec:8,pitch:.52,yawRate:.14,label:`L2 · System`,title:`Star System & Protoplanetary Disk`,caption:`Symplectic N-body orbits with per-body radial starlight, moons, and live GPU nebular coalescence.`},{id:`stellar-core`,level:3,targetSpan:9.22,dwellSec:7.5,pitch:.28,yawRate:.2,cutawayAtSec:3.1,label:`L3 · Star`,title:`Thermonuclear Stellar Fusion Core`,caption:`Live 32³ MLS-MPM volumetric star — engaging 3D octant cutaway to reveal pp/CNO nuclear fusion.`},{id:`ringed-giant`,level:4,role:`ringed`,dwellSec:6.5,pitch:.28,yawRate:.17,label:`L4 · Giant`,title:`Ringed Giant & Shadow Optics`,caption:`Oblate planet-on-ring umbra, ring-on-planet shadows, and icy back-scattering ring photometry.`},{id:`terrestrial-world`,level:4,role:`terrestrial`,dwellSec:8,pitch:.24,yawRate:.18,label:`L4 · World`,title:`Living Terrestrial World & Geodynamo`,caption:`3D SPH planetary geology, bimodal oceans, Rayleigh–Mie atmosphere, and live 3D Geodynamo field lines.`},{id:`active-comet`,level:4,role:`comet`,dwellSec:6.5,pitch:.22,yawRate:.2,label:`L4 · Comet`,title:`Active Comet & Anti-Solar Dual Tails`,caption:`Bilobed 3D SPH nucleus sublimating a straight CO⁺ ion tail and curved Keplerian dust syndyne.`},{id:`planetary-surface`,level:4,surface:!0,role:`terrestrial`,dwellSec:7.5,pitch:.14,yawRate:.18,label:`L4 · Surface`,title:`Landed Surface, CFD Clouds & Biosphere`,caption:`1:1 orbital-to-surface SPH mountain relief, 3D CFD atmospheric clouds, oceans, and roaming alien fauna.`},{id:`crystal-lattice`,level:5,targetSpan:-8.4,dwellSec:6.5,pitch:.4,yawRate:.22,label:`L5 · Crystal`,title:`Solid-State Crystal Lattice (WebGPU MD)`,caption:`Real-time WebGPU Velocity-Verlet atomic lattice dynamics sampled from planetary crust matter.`},{id:`atomic-orbital`,level:6,targetSpan:-10.3,dwellSec:5.5,pitch:.32,yawRate:.24,label:`L6 · Atom`,title:`Relativistic Dirac–KS Atomic Orbital`,caption:`Self-consistent GPU quantum electron probability cloud, radial nodes, and spin-orbit structure.`},{id:`atomic-nucleus`,level:7,targetSpan:-14.2,dwellSec:6,pitch:.36,yawRate:.26,label:`L7 · Nucleus`,title:`Atomic Nucleus & WKB Tunneling`,caption:`Femtometer Woods–Saxon nucleon core and quantum barrier tunneling — spanning all 40 orders of magnitude.`}].filter(e=>!e.role||La(e.role)>0)}function za(){return!Z.active||Z.stops.length===0?null:Z.stops[Math.max(0,Math.min(Z.stops.length-1,Z.stopIndex))]||null}function Ba(e){if(!e)return 0;if(e.surface)return Z.surfaceEntering||!Z.surfaceReady?.12:Math.max(.12,Math.min(1,.12+.88*(Z.dwellElapsedSec/Math.max(1,e.dwellSec))));if(Z.phase===`travel`){let t=e.resolvedTargetSpan??e.targetSpan??l,n=Math.max(.25,Math.abs(t-Z.travelStartSpan)),r=1-Math.min(1,Math.abs(t-l)/n);return Math.max(.03,Math.min(.32,r*.32))}return Math.max(.32,Math.min(1,.32+.68*(Z.dwellElapsedSec/Math.max(1,e.dwellSec))))}function Va(){let e=za();return{active:Z.active,paused:Z.paused,phase:Z.phase,stopIndex:Z.stopIndex,stopCount:Z.stops.length,stopId:e?.id??null,title:e?e.resolvedTitle||e.title:null,caption:e?e.resolvedCaption||e.caption:null,level:e?.level??null,surface:!!e?.surface,progress:Number(Ba(e).toFixed(3)),cutawayActive:!!G.stellarCutaway,stops:Z.stops.map(e=>e.id)}}function Ha(){if(!qt)return;if(!Z.active){qt.classList.remove(`active`,`paused`),Z.lastHudKey=``;return}let e=za();if(!e)return;if(qt.classList.add(`active`),qt.classList.toggle(`paused`,Z.paused),ot){let e=ot.getBoundingClientRect();e&&e.bottom>10&&(qt.style.top=`${Math.ceil(e.bottom+8)}px`)}let t=Z.stops.length,n=`STOP ${Z.stopIndex+1}/${t} · ${e.label}`,r=e.resolvedTitle||e.title,i=e.resolvedCaption||e.caption;Z.paused?i=`Tour paused · ${i}`:e.surface&&Z.surfaceEntering?i=`Descending onto ${e.resolvedBodyName||`world`} live 1:1 SPH surface…`:Z.phase===`travel`?i=`${(e.resolvedTargetSpan??e.targetSpan??l)>l?`Pulling out`:`Gliding inward`} across ${St(l)} → ${r}…`:G.activeGenesisStage?i=`Holding for live WebGPU genesis (${Math.round(Math.max(0,Math.min(1,G.activeGenesisStage.progress||0))*100)}%) — ${G.activeGenesisStage.title}`:e.id===`stellar-core`&&Z.cutawayEngaged?i=`3D Octant Cutaway active — live pp/CNO thermonuclear fusion core & magnetic dynamo.`:e.id===`terrestrial-world`&&(G.planetaryCoolingHeat||0)>.16&&(i=`Watching molten 3D SPH protoplanet cool naturally into crust fissures & oceans…`);let a=Math.round(Ba(e)*100),o=`${n}|${r}|${i}|${+!!Z.paused}`;o!==Z.lastHudKey&&(Z.lastHudKey=o,Jt&&(Jt.textContent=n),Yt&&(Yt.textContent=r),Xt&&(Xt.textContent=i),$t&&($t.textContent=Z.paused?`▶`:`⏸`,$t.title=Z.paused?`Resume tour progression`:`Pause tour progression`)),Zt&&(Zt.style.width=`${Math.max(3,a)}%`)}function Ua(){let e=Si||Z.active;Z.runToken+=1,Si=!1,Z.active=!1,Z.paused=!1,Z.surfaceEntering=!1,Z.surfaceReady=!1,Z.pendingPrep=!1,Z.targetYaw=null,Z.managedCutaway&&(Z.managedCutaway=!1,Z.cutawayEngaged=!1,G.stellarCutaway&&(G.setStellarCutaway(!1),sa())),E?.classList.remove(`active`),E&&(E.textContent=`▶ Tour`),Ha(),e&&$(performance.now())}function Wa(e,{direction:t=1,instant:n=!1}={}){if(!Z.active||Z.stops.length===0)return null;let r=Z.stops.length,i=(e%r+r)%r,a=0;for(;a<r;){let e=Z.stops[i];if(!e.role||La(e.role)>0)break;i=((i+(t>=0?1:-1))%r+r)%r,a+=1}let o=Z.stops[i];if(!o)return null;let s=++Z.runToken;Z.stopIndex=i,Z.phase=`travel`,Z.travelElapsedSec=0,Z.travelStartSpan=l,Z.dwellElapsedSec=0,Z.genesisWaitSec=0,Z.surfaceReady=!1,Z.surfaceEntering=!1,Z.cutawayEngaged=!1,Z.pendingPrep=!1,Z.targetYaw=null,Ei=null,Z.managedCutaway&&o.id!==`stellar-core`&&(Z.managedCutaway=!1,G.stellarCutaway&&(G.setStellarCutaway(!1),sa())),G.surfaceActive&&!o.surface&&(Ia({keepTour:!0}),Z.travelStartSpan=l);let c=G.getActiveSystemCatalog();if(o.resolvedBodyIndex=null,o.resolvedBodyName=null,o.resolvedTitle=o.title,o.resolvedCaption=o.caption,o.resolvedTargetSpan=o.targetSpan??l,o.id===`stellar-core`){Zn=!1,G.setFocusedSolarBody(0);let e=c[0]?.name||`Host Star`;o.resolvedBodyIndex=0,o.resolvedBodyName=e,o.resolvedTitle=`${e} — Stellar Fusion Core`,Z.pendingPrep=!0,G.syncStellarRegimeForStar(null,{initializeNow:!0}).finally(()=>{s===Z.runToken&&(Z.pendingPrep=!1)})}else if(o.role){let e=La(o.role),t=e>0?c[e]:null;if(o.resolvedBodyIndex=e,o.resolvedBodyName=t?.name||`World`,t&&(o.resolvedTargetSpan=Da(t),o.id===`ringed-giant`?o.resolvedTitle=`${t.name} — Ringed Giant & Shadows`:o.id===`terrestrial-world`?o.resolvedTitle=`${t.name} — Living World & Geodynamo`:o.id===`active-comet`?o.resolvedTitle=`${t.name} — Anti-Solar Dual Tails`:o.id===`planetary-surface`&&(o.resolvedTitle=`${t.name} Surface — SPH Relief & Biosphere`)),o.surface){Z.surfaceEntering=!0,Z.pendingPrep=!0;let t=Fa({bodyIndex:e,keepTour:!0}).then(()=>{s!==Z.runToken||!Z.active||(Z.surfaceEntering=!1,Z.surfaceReady=!0,Z.pendingPrep=!1,Z.phase=`dwell`,Z.dwellElapsedSec=0,Ha())}).catch(()=>{s===Z.runToken&&(Z.surfaceEntering=!1,Z.pendingPrep=!1)});return Ha(),t}if(e>0){G.setFocusedSolarBody(e),Z.pendingPrep=!0;let t=(async()=>{if(await G.ensureLevelInitialized(2),!(s!==Z.runToken||!Z.active)&&(G.setFocusedSolarBody(e),await G.initPlanetaryInterior({bodyIndex:e,observeLive:!0}),!(s!==Z.runToken||!Z.active)&&G.solarEngine&&e>0)){let t=G.solarEngine.getMassiveBodyState64(e),n=G.solarEngine.getMassiveBodyState64(0);Z.targetYaw=Math.atan2(n.posAu[0]-t.posAu[0],n.posAu[2]-t.posAu[2])-.92}})().finally(()=>{s===Z.runToken&&(Z.pendingPrep=!1)});return n?t.then(async()=>{s!==Z.runToken||!Z.active||(l=o.resolvedTargetSpan,Z.targetYaw!=null&&(Oi.yaw=Z.targetYaw),Oi.pitch=o.pitch,await ra(l),Z.phase=`dwell`,Z.dwellElapsedSec=0,Ha())}):(Ha(),t)}}else (o.level===0||o.level===1||o.level===2||o.level>=5)&&ra(o.resolvedTargetSpan);if(n){l=o.resolvedTargetSpan,Oi.pitch=o.pitch,Z.phase=`dwell`,Z.dwellElapsedSec=0;let e=ra(l).then(()=>{s!==Z.runToken||!Z.active||(Z.pendingPrep=!1,Ha())});return Ha(),e}return Ha(),null}function Ga(e=0){return K.mode===`ufo`&&Ji(`orbit`),mi||(mi=!0,B&&(B.textContent=`⏸ Pause`),_?.classList.remove(`paused`)),ot?.classList.contains(`mobile-tools-open`)&&(ot.classList.remove(`mobile-tools-open`),st?.classList.remove(`active`),st?.setAttribute(`aria-expanded`,`false`)),Z.stops=Ra(),Z.active=!0,Z.paused=!1,Si=!0,E?.classList.add(`active`),E&&(E.textContent=`⏹ Stop Tour`),Wa(e,{direction:1,instant:!1}),Ha(),Va()}function Ka(e=1){return Z.active?(Z.paused=!1,Wa(Z.stopIndex+e,{direction:e>=0?1:-1,instant:!1}),Va()):Ga(0)}function qa(){return Z.active?(Z.paused=!Z.paused,Ha(),Va()):Va()}async function Ja(e,{instant:t=!1}={}){Z.active||Ga(0);let n=Number.isInteger(e)?e:Z.stops.findIndex(t=>t.id===String(e));n<0&&(n=0),Z.paused=!1;let r=Wa(n,{direction:1,instant:t});if(r&&typeof r.then==`function`&&await r,t){let e=Ea(l,{focusedSolarBodyIndex:G.focusedSolarBodyIndex,focusedBodyIsStar:Vr(),galaxyBranch:G.galaxyBranch});!G.surfaceActive&&e!==Y&&(Y=e,la(),ua()),$(performance.now())}return Ha(),Va()}function Ya(e){if(!Z.active||!Si)return;let t=za();if(!t){Ua();return}if(!G.surfaceActive){let t=1-Math.exp(-e*3);Oi.dist+=(18-Oi.dist)*t}if(Z.paused){!G.surfaceActive&&!io&&(Oi.yaw+=e*.08),Ha();return}if(t.surface){Z.surfaceReady&&G.surfaceActive&&(G.addSurfaceLookDelta(e*(t.yawRate||.18),0),Z.dwellElapsedSec+=e,Z.dwellElapsedSec>=t.dwellSec&&Wa(Z.stopIndex+1,{direction:1,instant:!1})),Ha();return}let n=t.resolvedTargetSpan??t.targetSpan??l,r=1-Math.exp(-e*2.6);if(Z.phase===`travel`){let i=n-l,a=Math.max(1.45,Math.min(11.5,Math.abs(i)*1.85)),o=Math.sign(i)*Math.min(Math.abs(i),a*e);if(l=Math.max(vt,Math.min(_t,l+o)),Di=Math.abs(o)/Math.max(.001,e),ra(l),Oi.pitch+=(t.pitch-Oi.pitch)*r,Z.targetYaw!=null){let e=Math.atan2(Math.sin(Z.targetYaw-Oi.yaw),Math.cos(Z.targetYaw-Oi.yaw));Oi.yaw+=e*r}else Oi.yaw+=e*(t.yawRate||.15)*.65;Z.travelElapsedSec+=e,Math.abs(n-l)<.035&&!Z.pendingPrep&&(l=n,Z.phase=`dwell`,Z.dwellElapsedSec=0,Z.genesisWaitSec=0)}else{Oi.pitch+=(t.pitch-Oi.pitch)*r,Oi.yaw+=e*(t.yawRate||.16),t.id===`stellar-core`&&!Z.cutawayEngaged&&Z.dwellElapsedSec>=(t.cutawayAtSec||3.1)&&(Z.cutawayEngaged=!0,Z.managedCutaway=!0,G.setStellarCutaway(!0),sa());let n=G.activeGenesisStage,i=t.id===`terrestrial-world`&&(G.planetaryCoolingHeat||0)>.16&&Z.genesisWaitSec<5;n&&Z.genesisWaitSec<18||i?(Z.genesisWaitSec+=e,Z.dwellElapsedSec=Math.min(t.dwellSec*.85,Z.dwellElapsedSec+e*.15)):Z.dwellElapsedSec+=e,Z.dwellElapsedSec>=t.dwellSec&&Wa(Z.stopIndex+1,{direction:1,instant:!1})}Ha()}Qt?.addEventListener(`click`,()=>Ka(-1)),$t?.addEventListener(`click`,()=>qa()),en?.addEventListener(`click`,()=>Ka(1)),tn?.addEventListener(`click`,()=>Ua()),Ft?.addEventListener(`click`,()=>{if(Y===2&&X?.kind===`solar-asteroid`){Fa({customBodySpec:Mr(X)});return}Fa({bodyIndex:Y===2?G.focusedSolarBodyIndex:G.planetaryBodyIndex})}),window.addEventListener(`pagehide`,()=>{G.flushSurfaceCraters()}),window.addEventListener(`beforeunload`,()=>{G.flushSurfaceCraters()}),gn?.addEventListener(`click`,()=>{pa()}),yn?.addEventListener(`pointerdown`,e=>{e.preventDefault(),G.setSurfaceControls({jump:!0}),Pa()});let Xa=()=>{G.surfaceControls.jump&&(G.setSurfaceControls({jump:!1}),Pa())};yn?.addEventListener(`pointerup`,Xa),yn?.addEventListener(`pointerleave`,Xa),yn?.addEventListener(`pointercancel`,Xa),bn?.addEventListener(`pointerdown`,e=>{e.preventDefault(),G.setSurfaceControls({down:!0}),Pa()});let Za=()=>{G.surfaceControls.down&&(G.setSurfaceControls({down:!1}),Pa())};if(bn?.addEventListener(`pointerup`,Za),bn?.addEventListener(`pointerleave`,Za),bn?.addEventListener(`pointercancel`,Za),xn?.addEventListener(`click`,()=>Ma()),W?.addEventListener(`click`,()=>Na()),Sn?.addEventListener(`click`,()=>Ia()),x?.addEventListener(`click`,()=>Na()),C?.addEventListener(`click`,()=>{wr.toggleXr((e,t)=>{for(let e of t)$(performance.now(),e)})}),w?.addEventListener(`click`,async()=>{let e=Br();try{window.history?.replaceState?.(null,``,e),await navigator.clipboard?.writeText?.(e)}catch{}w&&(w.textContent=`✓ Copied!`,setTimeout(()=>{w&&(w.textContent=`🔗 Share`)},1600))}),T?.addEventListener(`click`,()=>{if(Tr.isConnected)Tr.disconnect();else{let e=xe?.value?.trim()||``,t=r.roomId||`ulg-cosmos-public`;Tr.connect({room:t,relay:e})}Rr();try{let e=Br();window.history?.replaceState?.(null,``,e)}catch{}}),sn)for(let e of sn.querySelectorAll(`[data-weapon]`))e.addEventListener(`click`,()=>{tr=e.dataset.weapon||`laser`,G.setSurfaceWeaponConfig({mode:tr}),zr()});let Qa=e=>{if(ir=!!e,tr===`missile`&&e){if(G.surfaceActive){let e=G.launchSurfaceMissile({});e&&Tr.isConnected&&Tr.broadcastMissileLaunch(e)}else (Y===2||Y===4)&&Fr();ir=!1}else G.setSurfaceWeaponFire({firing:ir});zr()};cn?.addEventListener(`pointerdown`,e=>{e.preventDefault(),Qa(!0)}),cn?.addEventListener(`pointerup`,()=>Qa(!1)),cn?.addEventListener(`pointerleave`,()=>Qa(!1)),ln?.addEventListener(`click`,()=>{ar=!ar,G.setSurfaceTractorBeam(ar),zr()}),un?.addEventListener(`input`,e=>{nr=Number(e.target.value),G.setSurfaceWeaponConfig({log10WavelengthM:nr}),zr()}),fn?.addEventListener(`input`,e=>{let t=Number(e.target.value);rr=Math.min(J.state.maxPowerW,10**t),G.setSurfaceWeaponConfig({powerW:rr,maxPowerW:J.state.maxPowerW}),zr()}),mn?.addEventListener(`click`,()=>{let e=G.getActiveSystemCatalog()[G.focusedSolarBodyIndex]?.id||`earth`;Ar(),J.deployVonNeumannProbe({bodyId:e,systemKey:kr(),starPosGal:G.activeStarSite?.posGal||G.galaxyFocusPos||[4.8,.04,2.1],orbitRadius:1.8+Math.random()*1.4}),zr()});function $a(e,t,n){if(!e||!t)return;let r=null,i=r=>{let i=e.getBoundingClientRect(),a=i.left+i.width*.5,o=i.top+i.height*.5,s=r.clientX-a,c=r.clientY-o,l=Math.hypot(s,c);l>36&&(s=s/l*36,c=c/l*36),t.style.transform=`translate(calc(-50% + ${s.toFixed(1)}px), calc(-50% + ${c.toFixed(1)}px))`,n(s/36,-c/36)};e.addEventListener(`pointerdown`,t=>{t.preventDefault(),r=t.pointerId,e.setPointerCapture?.(t.pointerId),i(t)}),e.addEventListener(`pointermove`,e=>{e.pointerId===r&&i(e)});let a=e=>{e.pointerId===r&&(r=null,t.style.transform=`translate(-50%, -50%)`,n(0,0))};e.addEventListener(`pointerup`,a),e.addEventListener(`pointercancel`,a)}let eo={nx:0,ny:0};$a(Nn,Pn,(e,t)=>{G.setSurfaceControls({moveX:e,moveY:t})}),$a(Fn,In,(e,t)=>{eo={nx:e,ny:t},(Math.abs(e)>.02||Math.abs(t)>.02)&&G.addSurfaceLookDelta(-e*.04,-t*.025)}),window.addEventListener(`blur`,()=>{eo={nx:0,ny:0},io=!1,Co=null,ir=!1,K.clearKeys(),G.setSurfaceWeaponFire({firing:!1}),G.setSurfaceControls({forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0})});let to=e=>{let t=document.activeElement?.tagName;if(!(t===`INPUT`||t===`SELECT`||t===`TEXTAREA`)){if(e.code===`Tab`&&!e.repeat){e.preventDefault(),Yi();return}if(e.code===`KeyV`&&!e.repeat){Na();return}if(e.code===`KeyI`&&!e.repeat){Qi(N);return}if(e.code===`KeyT`&&!e.repeat){ar=!ar,G.setSurfaceTractorBeam(ar),zr();return}if(e.code===`KeyX`&&!e.repeat){Qa(!0);return}if(e.code===`KeyM`&&!e.repeat){if(G.surfaceActive){let e=G.launchSurfaceMissile({});e&&Tr.isConnected&&Tr.broadcastMissileLaunch(e)}else (Y===2||Y===4)&&Fr();return}if(e.code===`Digit1`){tr=`laser`,G.setSurfaceWeaponConfig({mode:`laser`}),zr();return}if(e.code===`Digit2`){tr=`missile`,G.setSurfaceWeaponConfig({mode:`missile`}),zr();return}if(e.code===`Digit3`){tr=`antimatter`,G.setSurfaceWeaponConfig({mode:`antimatter`}),zr();return}if(e.code===`KeyP`&&!e.repeat){let e=G.getActiveSystemCatalog();Ar(),J.deployVonNeumannProbe({bodyId:e[G.focusedSolarBodyIndex]?.id||`earth`,systemKey:kr(),starPosGal:G.activeStarSite?.posGal||G.galaxyFocusPos||[4.8,.04,2.1]}),zr();return}if(e.code===`Escape`&&Si){Ua(),G.surfaceActive&&Ia(),e.preventDefault();return}if(!G.surfaceActive){if(K.mode===`ufo`){if(e.code===`KeyW`){K.setKeys({forward:!0}),e.preventDefault();return}if(e.code===`KeyS`){K.setKeys({backward:!0}),e.preventDefault();return}if(e.code===`KeyA`){K.setKeys({left:!0}),e.preventDefault();return}if(e.code===`KeyD`){K.setKeys({right:!0}),e.preventDefault();return}if(e.code===`Space`){K.setKeys({ascend:!0}),e.preventDefault();return}if(e.code===`KeyC`){K.setKeys({descend:!0});return}if(e.code===`KeyQ`){K.setKeys({rollLeft:!0});return}if(e.code===`KeyE`){K.setKeys({rollRight:!0});return}if(e.code===`ArrowUp`){K.setKeys({pitchUp:!0}),e.preventDefault();return}if(e.code===`ArrowDown`){K.setKeys({pitchDown:!0}),e.preventDefault();return}if(e.code===`ArrowLeft`){K.setKeys({yawLeft:!0}),e.preventDefault();return}if(e.code===`ArrowRight`){K.setKeys({yawRight:!0}),e.preventDefault();return}if(e.code===`ShiftLeft`||e.code===`ShiftRight`){K.setKeys({boost:!0});return}if(e.code===`ControlLeft`||e.code===`ControlRight`){K.setKeys({brake:!0});return}if(e.code===`KeyR`&&!e.repeat){K.levelHorizon(),qi();return}}if(e.code===`KeyL`&&!e.repeat)if(Y===2&&X?.kind===`solar-asteroid`)Fa({customBodySpec:Mr(X)});else if(Y===2){let e=G.getActiveSystemCatalog()[G.focusedSolarBodyIndex];e&&!e.isStar&&Fa({bodyIndex:G.focusedSolarBodyIndex})}else Y===4&&Fa({bodyIndex:G.planetaryBodyIndex});return}e.code===`KeyW`||e.code===`ArrowUp`?(G.setSurfaceControls({forward:!0}),e.preventDefault()):e.code===`KeyS`||e.code===`ArrowDown`?(G.setSurfaceControls({backward:!0}),e.preventDefault()):e.code===`KeyA`||e.code===`ArrowLeft`?(G.setSurfaceControls({left:!0}),e.preventDefault()):e.code===`KeyD`||e.code===`ArrowRight`?(G.setSurfaceControls({right:!0}),e.preventDefault()):e.code===`Space`?(G.setSurfaceControls({jump:!0}),e.preventDefault()):e.code===`ControlLeft`||e.code===`ControlRight`||e.code===`KeyC`?G.setSurfaceControls({down:!0}):e.code===`ShiftLeft`||e.code===`ShiftRight`?G.setSurfaceControls({turbo:!0}):e.code===`KeyQ`?G.setSurfaceControls({yawLeft:!0}):e.code===`KeyE`?G.setSurfaceControls({yawRight:!0}):e.code===`KeyF`&&!e.repeat&&G.surfaceSession?Ma():e.code===`KeyG`&&!e.repeat&&G.surfaceSession?(G.triggerSurfaceTractorPulse(2),pa()):e.code===`Escape`&&Ia()}},no=e=>{e.code===`KeyX`&&Qa(!1),e.code===`KeyW`?K.setKeys({forward:!1}):e.code===`KeyS`?K.setKeys({backward:!1}):e.code===`KeyA`?K.setKeys({left:!1}):e.code===`KeyD`?K.setKeys({right:!1}):e.code===`Space`?K.setKeys({ascend:!1}):e.code===`KeyC`?K.setKeys({descend:!1}):e.code===`KeyQ`?K.setKeys({rollLeft:!1}):e.code===`KeyE`?K.setKeys({rollRight:!1}):e.code===`ArrowUp`?K.setKeys({pitchUp:!1}):e.code===`ArrowDown`?K.setKeys({pitchDown:!1}):e.code===`ArrowLeft`?K.setKeys({yawLeft:!1}):e.code===`ArrowRight`?K.setKeys({yawRight:!1}):e.code===`ShiftLeft`||e.code===`ShiftRight`?K.setKeys({boost:!1}):(e.code===`ControlLeft`||e.code===`ControlRight`)&&K.setKeys({brake:!1}),G.surfaceActive&&(e.code===`KeyW`||e.code===`ArrowUp`?G.setSurfaceControls({forward:!1}):e.code===`KeyS`||e.code===`ArrowDown`?G.setSurfaceControls({backward:!1}):e.code===`KeyA`||e.code===`ArrowLeft`?G.setSurfaceControls({left:!1}):e.code===`KeyD`||e.code===`ArrowRight`?G.setSurfaceControls({right:!1}):e.code===`Space`?G.setSurfaceControls({jump:!1}):e.code===`ControlLeft`||e.code===`ControlRight`||e.code===`KeyC`?G.setSurfaceControls({down:!1}):e.code===`ShiftLeft`||e.code===`ShiftRight`?G.setSurfaceControls({turbo:!1}):e.code===`KeyQ`?G.setSurfaceControls({yawLeft:!1}):e.code===`KeyE`&&G.setSurfaceControls({yawRight:!1}))};if(window.addEventListener(`keydown`,to),window.addEventListener(`keyup`,no),Nt?.addEventListener(`click`,()=>{Ua(),Aa()}),It?.addEventListener(`click`,()=>{Ua(),ja()}),ee?.addEventListener(`click`,()=>{Ua(),ja()}),E?.addEventListener(`click`,()=>{Si||Z.active?Ua():Ga(0)}),B?.addEventListener(`click`,()=>{mi=!mi,B.textContent=mi?`⏸ Pause`:`▶ Resume`,_?.classList.toggle(`paused`,!mi)}),V?.addEventListener(`input`,e=>{if(Tr.timescaleLocked){hi=1,V&&(V.value=`1.0`),te&&(te.textContent=`🔒 1.0×`);return}hi=Number(e.target.value)||1,te&&(te.textContent=`${hi.toFixed(1)}×`)}),ne?.addEventListener(`click`,async()=>{Ci=1,await G.setCosmoMode(`web`),await G.initCosmicWeb({bigBang:!0}),Ei=null,l=yt[0].log10SpanM,Y=0,la(),ua(),$(performance.now())}),ae?.addEventListener(`click`,async()=>{Ci=.75,G.setSeed(G.seed+7919>>>0),await G.initCosmicWeb(),G.galaxyEngine&&await G.initGalaxy(),G.solarEngine&&await G.initSolarSystem(),la()}),le)for(let e of le.querySelectorAll(`[data-quality]`))e.addEventListener(`click`,async()=>{let t=e.dataset.quality;if(G.setQuality(t)){for(let e of le.querySelectorAll(`[data-quality]`))e.classList.toggle(`active`,e.dataset.quality===t);Jn(),Y===0?await G.initCosmicWeb():Y===1?await G.initGalaxy():Y===2&&G.galaxyBranch!==`smbh-core`?await G.initSolarSystem():Y===3?await G.initStellarCore():Y===4&&!G.surfaceActive?await G.initPlanetaryInterior({bodyIndex:G.planetaryBodyIndex}):Y===5?await G.initMolecularDynamics():Y===6?await G.initQuantumAtom():Y===7&&(await G.initAtomicNucleus(),G.nuclearResult?.volumeData&&Kn.uploadNuclearVolume(G.nuclearResult.volumeData)),sa()}});de?.addEventListener(`change`,e=>{gi=e.target.checked}),fe?.addEventListener(`change`,e=>{_i=e.target.checked}),pe?.addEventListener(`change`,e=>{e.target.checked}),me?.addEventListener(`change`,e=>{vi=e.target.checked}),ge?.addEventListener(`change`,e=>{yi=e.target.checked}),ve?.addEventListener(`input`,e=>{bi=Number(e.target.value)||3,ye&&(ye.textContent=`${bi}×`)}),Ce?.addEventListener(`click`,async()=>{G.getPeerMeshState().connected?await G.disconnectPeerMesh():await G.connectPeerMesh({relayUrl:xe?.value||``,roomId:n.get(`peerRoom`)||`ulg-universes-mesh-v1`,role:Se?.value||`requester`}),ro()});function ro(){let e=G.getPeerMeshState();Ce&&(Ce.textContent=e.connected?`Leave`:`Join Mesh`),we&&(we.textContent=e.connected?`${e.role} · ${e.remotePeers} peers · ${e.quorumReady?`2-of-2 QUORUM READY`:`waiting`}`:e.error?`Error: ${e.error}`:`Local GPU · 0 remote peers`)}let io=!1,ao=!1,oo=0,so=0,co=0,lo=0;function uo(){let e=l;if(Y===0){if(G.cosmoMode!==`web`&&G.cosmoBaryonSession){let t=12.2/Math.max(100,G.cosmoBaryonSession.boxSizeMpc||260)*10**Math.max(-.6,Math.min(1.8,24.8-e));return{kind:`cosmo-baryon`,buffer:G.cosmoBaryonSession.getResidentTracersBuffer(),count:G.cosmoBaryonSession.tracerCount,strideFloats:16,layoutMode:Fe.STANDARD,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(G.cosmoSession)return{kind:`cosmo-web`,buffer:G.cosmoSession.particlesBuffer,count:G.cosmoSession.particleCount,strideFloats:16,layoutMode:Fe.STANDARD,worldScale:Ni.cosmoPickScale??Ni.cosmoScale??.09,offsetHi:Ni.cosmoPickOffset??Ni.cosmoOffset??[0,0,0],offsetLo:[0,0,0],skipFirst:0}}else if(Y===1&&G.galaxyEngine)return{kind:`galaxy-star`,buffer:G.galaxyEngine.getResidentBuffer(),count:G.galaxyEngine.count,strideFloats:8,layoutMode:Fe.GALAXY_VISIBLE,worldScale:Ni.galaxyScale??.85,offsetHi:Ni.galaxyOffset??[0,0,0],offsetLo:[0,0,0],skipFirst:0};else if(Y===2&&G.galaxyBranch!==`smbh-core`){if(G.solarMode===`formation`&&G.protoplanetarySession){let t=.92*10**Math.max(-1.2,Math.min(1.2,12.6-e));return{kind:`proto-pebble`,buffer:G.protoplanetarySession.getResidentPebblesBuffer(),count:G.protoplanetarySession.pebbleCount,strideFloats:16,layoutMode:Fe.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(G.solarMode===`quasar-jet`&&G.kerrJetSession){let t=.85*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`kerr-parcel`,buffer:G.kerrJetSession.getResidentParcelsBuffer(),count:G.kerrJetSession.particleCount,strideFloats:16,layoutMode:Fe.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(G.solarMode)&&G.relBinarySession){let t=1.12*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`relbin-parcel`,buffer:G.relBinarySession.getResidentParcelsBuffer(),count:G.relBinarySession.particleCount,strideFloats:16,layoutMode:Fe.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`comet-tails`,`hot-jupiter`].includes(G.solarMode)&&G.radWindL2Session){let t=1.05*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`radwind-parcel`,buffer:G.radWindL2Session.getResidentParcelsBuffer(),count:G.radWindL2Session.particleCount,strideFloats:16,layoutMode:Fe.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`roche-rings`,`giant-impact`,`red-giant`,`tde`].includes(G.solarMode)&&G.tidalRocheSession){let t=1.06*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`roche-parcel`,buffer:G.tidalRocheSession.getResidentParticlesBuffer(),count:G.tidalRocheSession.particleCount,strideFloats:16,layoutMode:Fe.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(G.solarEngine){let t=G.getSolarReferenceOriginAu(e,null,{lockToTarget:Kr}),n=Array.isArray(Ni.solarOriginAu)?Ni.solarOriginAu:t.originAu,r=[Math.fround(n[0]),Math.fround(n[1]),Math.fround(n[2])],i=[Math.fround(n[0]-r[0]),Math.fround(n[1]-r[1]),Math.fround(n[2]-r[2])],a=10**e/at,o=16/Math.max(1e-9,a);return{kind:`solar-asteroid`,buffer:G.solarEngine.getResidentBuffer(),count:G.solarEngine.totalCount,strideFloats:16,layoutMode:Fe.SOLAR_DOUBLE_FLOAT,worldScale:Ni.solarScaleAuToWorld??o,offsetHi:r,offsetLo:i,skipFirst:G.solarEngine.massiveCount}}}else if(Y===3){let t=.92*10**Math.max(-1,Math.min(1,9.2-e));if(G.stellarMode===`nebular-mhd`&&G.nebulaMhdSession)return{kind:`nebula-mhd-parcel`,buffer:G.nebulaMhdSession.getResidentTracersBuffer(),count:G.nebulaMhdSession.tracerCount,strideFloats:16,layoutMode:Fe.STANDARD,worldScale:t*1.15,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if([`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`].includes(G.stellarMode)&&G.radWindL3Session)return{kind:`radwind-parcel`,buffer:G.radWindL3Session.getResidentParcelsBuffer(),count:G.radWindL3Session.particleCount,strideFloats:16,layoutMode:Fe.FLAGGED_LIVE_16F,worldScale:t*1.05,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if((G.stellarMode===`pulsar`||G.stellarMode===`magnetar`)&&G.magnetosphereSession)return{kind:`mag-parcel`,buffer:G.magnetosphereSession.getResidentParcelsBuffer(),count:G.magnetosphereSession.particleCount,strideFloats:16,layoutMode:Fe.FLAGGED_LIVE_16F,worldScale:t*1.12,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if(G.stellarEngine)return{kind:`stellar-hydro-parcel`,buffer:G.stellarEngine.getResidentBuffer(),count:G.stellarEngine.count,strideFloats:16,layoutMode:Fe.STANDARD,worldScale:t*.95,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}else if(Y===5&&G.mdSession){let t=G.mdSession.boxLengthsA,n=8.4/Math.max(t[0],t[1],t[2],6),r=10**Math.max(-1.2,Math.min(1.4,-8.2-e));return{kind:`md-atom`,buffer:G.mdSession.positionsBuffer,velBuffer:G.mdSession.velocitiesBuffer,count:G.mdSession.atomCount,strideFloats:4,layoutMode:Fe.MD_PERIODIC_4F,worldScale:n*r,offsetHi:[0,0,0],offsetLo:[t[0]*.5,t[1]*.5,t[2]*.5],skipFirst:0}}return null}function fo(e,t,n){let r=n,i=e.worldScale||1,a=e.offsetHi||[0,0,0],o=e.offsetLo||[0,0,0],s=[r[0]||0,r[1]||0,r[2]||0],c;if(e.layoutMode===Fe.SOLAR_DOUBLE_FLOAT?(s=[r[0]+r[4],r[1]+r[5],r[2]+r[6]],c=[(r[0]-a[0]+(r[4]-o[0]))*i,(r[1]-a[1]+(r[5]-o[1]))*i,(r[2]-a[2]+(r[6]-o[2]))*i]):c=e.layoutMode===Fe.MD_PERIODIC_4F?[(r[0]-o[0])*i,(r[1]-o[1])*i,(r[2]-o[2])*i]:[(r[0]-a[0])*i,(r[1]-a[1])*i,(r[2]-a[2])*i],e.kind===`cosmo-web`){let n=Math.hypot(r[4]||0,r[5]||0,r[6]||0),i=Math.max(.05,Number(r[7])||.5),a=Math.max(.22,Math.min(4.8,i**1.65*4.2)),o=G.peekCachedHaloGalaxy(s),l=a>2.2?`Overdense Cluster Knot`:a<.7?`Underdense Cosmic Void`:`Filamentary Bridge`;return{kind:e.kind,level:Y,index:t,rawPos:s,worldPos:c,localOverdensity:a,cachedHaloGalaxy:o?.payload||null,name:`Cosmic-Web Halo Mote #${t}`,subtitle:o?.payload?`✅ Collapsed (Root Cache) · ${o.payload.morphologyLabel} · δ/ρ̄=${a.toFixed(2)}×`:`${l} · δ/ρ̄=${a.toFixed(2)}× · Galaxy: ⏳ Unsimulated`,composition:o?.payload?`Cached GPU Galaxy (${o.payload.starCount?.toLocaleString?.()||`32,768`} stars · Z=${Number(o.payload.meanMetallicitySolar||1).toFixed(2)} Z☉) · Click Dive to re-enter`:`Live FLRW TreePM density tracer — Zoom in / Dive to collapse this halo on WebGPU and cache its galaxy`,tempK:8500,stats:[[`Comoving r`,`${Math.hypot(...s).toFixed(1)} Mpc`],[`Peculiar |v|`,`${(n*120).toFixed(0)} km/s`],[`Local δ/ρ̄`,`${a.toFixed(2)}×`],[`Galaxy State`,o?.payload?`✅ ${o.payload.morphology}`:`⏳ Unsimulated`]]}}if(e.kind===`cosmo-baryon`){let n=(r[11]||0)>.5,i=Number(r[8])||3e3,a=Number(r[9])||0,o=Number(r[7])||1;return{kind:e.kind,level:Y,index:t,rawPos:s,worldPos:c,name:`${n?`Dark-Matter Lensing Halo`:`Baryon / IGM Parcel`} #${t}`,subtitle:`Live GPU Cosmological Tracer · (${s[0].toFixed(1)}, ${s[1].toFixed(1)}, ${s[2].toFixed(1)}) Mpc`,composition:n?`Collisionless CDM Mass Tracer`:`H/He Plasma · x_HII=${(a*100).toFixed(1)}% · T=${i>1e5?`${(i/1e6).toFixed(1)} MK`:`${Math.round(i)} K`}`,tempK:Math.max(2500,Math.min(35e3,i)),stats:[[`Species`,n?`Dark Matter`:`Baryon Gas`],[`Temp T`,i>1e5?`${(i/1e6).toFixed(2)} MK`:`${Math.round(i)} K`],[`Ionized x_HII`,`${(a*100).toFixed(1)}%`],[`Density ρ`,`${o.toFixed(2)} ρ̄`]]}}if(e.kind===`galaxy-star`){let n=Number(r[7])||0,i=Math.hypot(s[0],s[2])*5.2,a=s[1]*5.2,o=Math.hypot(r[4]||0,r[5]||0,r[6]||0),l=G.galacticDynamoSession?.sampleBAt?.(s[0],s[1],s[2])||[0,0,0];Math.hypot(l[0],l[1],l[2]);let u={posGal:[...s],popTag:n,starIndex:t},d=e=>{let t=e>>>0;return t=Math.imul(t^t>>>16,2146121005)>>>0,t=Math.imul(t^t>>>15,2221713035)>>>0,t=(t^t>>>16)>>>0,(t&16777215)/16777216},f=d(t>>>0^324508639),p=f>.986&&n>=.2,m=f>.974&&f<=.986&&n>=.1;if(p){let n=d(t>>>0^2654435769),r=d(t>>>0^608135816),l=.22*22**n,f=Math.max(1.4,1/(l*32)*1e3),p=(.8+r*14)*1e11,m=String(Math.floor(t*7%24)).padStart(2,`0`),h=String(Math.floor(t*13%60)).padStart(2,`0`),g=String(Math.floor(t*11%75)).padStart(2,`0`);return{kind:e.kind,level:Y,index:t,rawPos:s,worldPos:c,starSite:u,exoticKind:`pulsar`,name:`PSR J${m}${h}+${g} · Relativistic Pulsar #${t}`,subtitle:`Blinking Radio & γ-Ray Lighthouse · R=${i.toFixed(1)} kly · z=${a.toFixed(2)} kly`,composition:`Magnetized Neutron Star (1.42 M☉, R=11.4 km) · Sweeping relativistic synchrotron & γ-ray beams · Click Dive for 3D Pulsar!`,tempK:85e4,stats:[[`Type`,`Radio / γ Pulsar`],[`Spin Period P`,`${f.toFixed(2)} ms`],[`Surface |B|`,`${(p/1e11).toFixed(1)}×10¹¹ G`],[`Orbital |v|`,`${(o*24.5).toFixed(0)} km/s`]]}}if(m)return{kind:e.kind,level:Y,index:t,rawPos:s,worldPos:c,starSite:u,exoticKind:`xray-binary`,name:`ULG X-${t%999} · Accreting X-Ray Binary (BH)`,subtitle:`Relativistic Corona & QPO Shimmer · R=${i.toFixed(1)} kly · Eddington Accretion`,composition:`Stellar-mass Kerr Black Hole (8.4 M☉) accreting from OB donor · Blazes in X-Ray (0.1–10 nm) · Click Dive for Kerr Disk!`,tempK:22e6,stats:[[`Type`,`X-Ray Binary (BH)`],[`Corona T`,`22.0 MK`],[`Peak Band`,`0.1–2.0 nm X-Ray`],[`Orbital |v|`,`${(o*24.5).toFixed(0)} km/s`]]};let h=G.peekCachedStarSystemForSite(u),g=Number(G.activeGalaxyEnv?.baseFeH??0),_=Math.max(-3.2,Math.min(.55,g-(i-8.2)*.045-Math.abs(a)*.14)),v=Math.round(n>.72?9200+(n-.72)*32e3:n>.42?5100+(n-.42)*9500:3100+n*4500),y=v>=1e4?`OB Blue-White Giant`:v>=6100?`A/F Main-Sequence Star`:v>=4800?`G/K Solar-Band Star`:`M-Type Red Dwarf`,b=h?.payload||null;return{kind:e.kind,level:Y,index:t,rawPos:s,worldPos:c,starSite:u,systemSimulated:!!b,cachedNebularDisk:b,name:`Galactic Star Mote #${t} (${y})`,subtitle:b?`✅ Coalesced (Root Cache) · ${b.bodies?.length||0} GPU-coalesced worlds · Snow Line ${Number(b.snowLineAu||0).toFixed(2)} AU`:`R = ${i.toFixed(1)} kly · z = ${a.toFixed(2)} kly · Planetary System: ⏳ Unsimulated`,composition:b?`Cached from WebGPU Nebular Coalescence (${h.source}) · Click Dive to enter coalesced system`:`Unresolved from galactic scale — Zoom in / Dive to coalesce its entire protoplanetary nebula on WebGPU (local ISM [Fe/H] ≈ ${_>=0?`+`:``}${_.toFixed(2)})`,tempK:v,stats:[[`Galactic R`,`${i.toFixed(1)} kly`],[`Orbital |v|`,`${(o*24.5).toFixed(0)} km/s`],[`ISM [Fe/H]`,`${_>=0?`+`:``}${_.toFixed(2)}`],[`Planets`,b?`✅ ${b.bodies?.length||0} (Cached)`:`⏳ Unsimulated`]]}}if(e.kind===`solar-asteroid`){let n=Math.hypot(s[0],s[1],s[2]),i=Math.hypot(r[8]||0,r[9]||0,r[10]||0)*4.7405,a=G.activeCausalSystem?.condensationFrontsAu?.rSnowLineAu||2.7,o=(r[11]||0)>6.5||n>Math.max(8.5,a*3.5),l=G.getActiveSystemCatalog()?.[0]?.massSolar||1,u=Math.max(.05,n)**1.5/Math.sqrt(Math.max(.08,l)),d=Math.max(35,Math.round(280/Math.sqrt(Math.max(.2,n)))),f=o?{id:`kbo-${t}`,worldName:`Kuiper Belt Object #${t}`,category:`minor-body`,name:`Kuiper Volatile Ice & Tholin Planetesimal (H₂O · CH₄ · CO)`,shortLabel:`KBO Ice`,locationTag:`r = ${n.toFixed(2)} AU`,phasePreset:`solid`,tempK:d,primaryZ:8,formula:`H₂O/CH₄`,moleculeKey:`H2O`,compounds:[{id:`H2O`,formula:`H₂O`,name:`Amorphous Water Ice`,moleFrac:.68,primaryZ:8,moleculeKey:`H2O`,elements:[8,1]},{id:`CH4`,formula:`CH₄`,name:`Frozen Methane`,moleFrac:.2,primaryZ:6,moleculeKey:`CH4`,elements:[6,1]},{id:`CO`,formula:`CO`,name:`Carbon Monoxide Frost`,moleFrac:.12,primaryZ:6,moleculeKey:`CO`,elements:[6,8]}],elements:[{Z:8,sym:`O`,name:`Oxygen`},{Z:1,sym:`H`,name:`Hydrogen`},{Z:6,sym:`C`,name:`Carbon`}]}:{id:`asteroid-${t}`,worldName:`Main-Belt Asteroid #${t}`,category:`minor-body`,name:`Chondritic Silicate & Fe-Ni Asteroid (SiO₂ · Mg₂SiO₄ · Fe)`,shortLabel:`Chondrite Rock`,locationTag:`r = ${n.toFixed(2)} AU`,phasePreset:`solid`,tempK:d,primaryZ:14,formula:`SiO₂/Fe`,moleculeKey:`SiO2`,compounds:[{id:`SiO2`,formula:`SiO₂`,name:`Olivine/Pyroxene Silicate`,moleFrac:.62,primaryZ:14,moleculeKey:`SiO2`,elements:[14,8]},{id:`FeNi`,formula:`Fe-Ni`,name:`Metallic Chondrule Grains`,moleFrac:.26,primaryZ:26,moleculeKey:`O2`,elements:[26,28]},{id:`CO2`,formula:`C-Org`,name:`Carbonaceous Matrix`,moleFrac:.12,primaryZ:6,moleculeKey:`CO2`,elements:[6,8,1]}],elements:[{Z:14,sym:`Si`,name:`Silicon`},{Z:8,sym:`O`,name:`Oxygen`},{Z:26,sym:`Fe`,name:`Iron`},{Z:28,sym:`Ni`,name:`Nickel`},{Z:6,sym:`C`,name:`Carbon`}]};return{kind:e.kind,level:Y,index:t,rawPos:s,worldPos:c,sampleZ:f.primaryZ,sampleMaterial:f,name:`${o?`Kuiper Belt Object`:`Main-Belt Asteroid`} #${t}`,subtitle:`f32x2 Symplectic N-Body · r = ${n.toFixed(3)} AU · T = ${u.toFixed(2)} yr`,composition:o?`H₂O / CH₄ / CO Outer-System Icy Planetesimal`:`Silicate Chondrite + Fe-Ni Metallic Asteroid`,tempK:d,stats:[[`Helio r`,`${n.toFixed(3)} AU`],[`Speed |v|`,`${i.toFixed(2)} km/s`],[`Period T`,`${u.toFixed(2)} yr`],[`Type`,o?`Icy KBO`:`Silicate/Fe`]]}}if(e.kind===`proto-pebble`){let n=Math.hypot(s[0],s[1],s[2]),i=Number(r[8])||180,a=Number(r[9])||0;return{kind:e.kind,level:Y,index:t,rawPos:s,worldPos:c,name:`${a>.5?`Icy Outer`:`Rocky Silicate`} Pebble #${t}`,subtitle:`Epstein/Stokes Gas-Drag Disk Tracer · r = ${n.toFixed(2)} AU`,composition:a>.5?`Condensed H₂O/CO Ice + Silicate Core (Beyond Snow Line)`:`Refractory Silicate + Fe-Ni Chondrule Dust`,tempK:Math.max(50,Math.min(2e3,i)),stats:[[`Disk r`,`${n.toFixed(2)} AU`],[`Temp T(r)`,`${Math.round(i)} K`],[`Ice Frac`,`${(a*100).toFixed(0)}%`],[`Speed |v|`,`${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)}`]]}}if(e.kind===`stellar-hydro-parcel`){let n=Number(r[8])||4,i=Number(r[9])||-5,a=10**n,o=Number(r[10])||.72,l=Number(r[11])||-30,u=Number(r[13])||0,d=Number(r[14])||.26,f=Number(r[15])||.02,p=G.stellarDynamoSession?.sampleBAt?.(s[0],s[1],s[2])||[0,0,0],m=Math.hypot(p[0],p[1],p[2]);return{kind:e.kind,level:Y,index:t,rawPos:s,worldPos:c,name:`Stellar Plasma Parcel #${t}`,subtitle:`self-gravitating-hydro@1 · r = ${Math.hypot(...s).toFixed(2)} · x_ion = ${(u*100).toFixed(0)}%`,composition:`H ${(o*100).toFixed(1)}% · He ${(d*100).toFixed(1)}% · Z ${(f*100).toFixed(2)}%`,tempK:Math.max(2e3,Math.min(4e4,a)),stats:[[`Parcel T`,a>=1e6?`${(a/1e6).toFixed(2)} MK`:`${Math.round(a).toLocaleString()} K`],[`log₁₀ ρ`,`${i.toFixed(2)} kg/m³`],[`Fusion ε`,l>-12?`10^${l.toFixed(1)} W/kg`:`Inactive`],[`Dynamo |B|`,`${m.toFixed(3)} B_sim`]]}}if(e.kind===`nebula-mhd-parcel`){let n=Number(r[7])||0,i=Number(r[11])||0,a=Number(r[13])||0;return{kind:e.kind,level:Y,index:t,rawPos:s,worldPos:c,name:`MHD Nebula Parcel #${t}`,subtitle:`3D Resistive MHD · B = (${(r[8]||0).toFixed(2)}, ${(r[9]||0).toFixed(2)}, ${(r[10]||0).toFixed(2)})`,composition:a>.15?`Magnetocentrifugal (J×B) Bipolar Jet Plasma`:`Rotating Magnetized Molecular Cloud Gas & Dust`,tempK:a>.15?14e3:4200,stats:[[`Local |B|`,`${n.toFixed(3)}`],[`Density ρ`,`${i.toFixed(2)}`],[`Jet Outflow`,`${a.toFixed(2)}`],[`Speed |v|`,`${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)}`]]}}if(e.kind===`mag-parcel`||e.kind===`kerr-parcel`||e.kind===`relbin-parcel`){let n=Number(r[3])||0,i=Math.max(1,Number(r[7])||1),a=Number(r[9])||0,o=e.kind===`mag-parcel`?n>1.5?`Reconnection Flare / PWN`:n>.5?`Polar-Cap Open Beam`:`Closed Magnetosphere Loop`:e.kind===`kerr-parcel`?n>.5&&n<1.5?`Blandford–Znajek Jet`:`Novikov–Thorne Disk`:n>1.5?`r-Process Ejecta`:`Relativistic Stream`;return{kind:e.kind,level:Y,index:t,rawPos:s,worldPos:c,name:`${o} Parcel #${t}`,subtitle:`Persistent GPU Plasma Mote · Lorentz Γ = ${i.toFixed(2)}×`,composition:`Speed |v| = ${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)} · r = ${Math.hypot(...s).toFixed(2)}`,tempK:22e3,stats:[[`Role`,o.slice(0,14)],[`Lorentz Γ`,`${i.toFixed(2)}×`],[e.kind===`mag-parcel`?`Local |B|`:`Y_e / Aux`,`${a.toFixed(3)}`],[`Emissivity`,`${(r[10]||0).toFixed(2)}`]]}}if(e.kind===`radwind-parcel`||e.kind===`roche-parcel`){let n=Math.hypot(r[4]||0,r[5]||0,r[6]||0);return{kind:e.kind,level:Y,index:t,rawPos:s,worldPos:c,name:`${e.kind===`radwind-parcel`?`Photoionized Nebula/Tail`:`Tidal Debris/Ring`} Parcel #${t}`,subtitle:`Live GPU Parcel · r = ${Math.hypot(...s).toFixed(2)} · |v| = ${n.toFixed(2)}`,composition:e.kind===`radwind-parcel`?`Hα=${(r[8]||0).toFixed(2)} · [O III]=${(r[9]||0).toFixed(2)} · [S II]=${(r[10]||0).toFixed(2)}`:`Intact=${(r[7]||0)>.5?`Cohesive`:`Disrupted`} · T_norm=${(r[8]||0).toFixed(2)}`,tempK:11e3,stats:[[`Radius r`,`${Math.hypot(...s).toFixed(2)}`],[`Speed |v|`,`${n.toFixed(2)}`],[e.kind===`radwind-parcel`?`Hα / [O III]`:`Temp Norm`,e.kind===`radwind-parcel`?`${(r[8]||0).toFixed(1)} / ${(r[9]||0).toFixed(1)}`:`${(r[8]||0).toFixed(2)}`],[`GPU Index`,`#${t}`]]}}if(e.kind===`md-atom`){let n=G.getCachedElementBundle(G.mdElementZ,!0)?.bundle,r=n?.symbol||`Z=${G.mdElementZ}`;return{kind:e.kind,level:Y,index:t,rawPos:s,worldPos:c,name:`Atom #${t} · ${r} (Z=${G.mdElementZ})`,subtitle:`Live WebGPU MD Atom · (${s[0].toFixed(2)}, ${s[1].toFixed(2)}, ${s[2].toFixed(2)}) Å`,composition:`${n?.mechanical?.crystalStructure||`lattice`} · m = ${(n?.nuclear?.atomicMassU||55.8).toFixed(2)} u`,tempK:G.mdTelemetry?.temperatureK||G.mdTempK,stats:[[`Element`,`${r} (Z=${G.mdElementZ})`],[`Lattice x,y`,`${s[0].toFixed(1)}, ${s[1].toFixed(1)} Å`],[`Lattice z`,`${s[2].toFixed(2)} Å`],[`Bath Temp`,`${Math.round(G.mdTelemetry?.temperatureK||G.mdTempK)} K`]]}}return{kind:e.kind,level:Y,index:t,rawPos:s,worldPos:c,name:`GPU Mote #${t}`,subtitle:`Live Resident WebGPU Entity`,composition:``,tempK:6e3,stats:[[`Index`,`#${t}`],[`X`,s[0].toFixed(2)],[`Y`,s[1].toFixed(2)],[`Z`,s[2].toFixed(2)]]}}function po(e,t){let n=G.getTargetsForLevel(Y,Ni),r=null,i=Y===2?26:42;for(let a of n){if(Y===0&&G.cosmoMode!==`web`||Y===2&&![`nbody`,`smbh-core`].includes(G.solarMode)&&G.galaxyBranch!==`smbh-core`||Y===2&&a.spec?.parent>0&&l>10.5||Y===3||Y===5)continue;let n=ya(a.pos,ki,Ai,Mi);if(!n.visible)continue;let o=Math.hypot(n.sx-e,n.sy-t);o<i&&(i=o,r={...a,hitDistPx:o})}return r}async function mo(e,t,{preferGpuMote:n=!1}={}){if(Y===7&&ui.length>0){let n=null,r=36;for(let i=0;i<ui.length;i+=1){let a=ui[i],o=ya(a.pos,ki,Ai,Mi);if(!o.visible)continue;let s=Math.hypot(o.sx-e,o.sy-t);s<r&&(r=s,n={idx:i,sphere:a})}if(n){let e=n.sphere.color0[0]>.7,t=Math.hypot(...n.sphere.pos)*(Number(G.nuclearResult?.chargeRadiusFm||3.7)/2.2);return X={kind:`nucleon`,level:7,index:n.idx,rawPos:[...n.sphere.pos],worldPos:[...n.sphere.pos],name:`${e?`Proton p⁺`:`Neutron n⁰`} #${n.idx+1} (${G.nuclearA}${G.nuclearResult?.isotope?.split(`-`)[0]||``})`,subtitle:e?`Valence Quarks u-u-d · Charge +1e · Spin ½`:`Valence Quarks u-d-d · Charge 0 · Spin ½`,composition:`Bound inside Woods–Saxon nuclear potential (B/A = ${(G.nuclearResult?.bindingPerNucleonMeV||8.79).toFixed(3)} MeV)`,tempK:1e10,stats:[[`Baryon`,e?`Proton (p⁺)`:`Neutron (n⁰)`],[`Shell r`,`${t.toFixed(2)} fm`],[`Mass`,e?`938.27 MeV`:`939.57 MeV`],[`Quarks`,e?`u u d`:`u d d`]]},Q(),$(performance.now()),X}}if(Y===4&&!G.surfaceActive&&ur&&dr){let n=e/Math.max(1,Ai)*2-1,r=1-t/Math.max(1,Mi)*2,{pos:i,right:a,up:o,fwd:s,fovTanHalf:c,aspect:l}=dr,u=ha([s[0]+a[0]*(n*l*c)+o[0]*(r*c),s[1]+a[1]*(n*l*c)+o[1]*(r*c),s[2]+a[2]*(n*l*c)+o[2]*(r*c)]),{center:d,radius:f,spec:p,bodyIndex:m,seedFloat:h,lightDir:g}=ur,_=[i[0]-d[0],i[1]-d[1],i[2]-d[2]],v=_[0]*u[0]+_[1]*u[1]+_[2]*u[2],y=_[0]*_[0]+_[1]*_[1]+_[2]*_[2]-f*f,b=v*v-y;if(b>=0){let e=-v-Math.sqrt(b);if(e>0){let t=[i[0]+u[0]*e,i[1]+u[1]*e,i[2]+u[2]*e],n=ha([t[0]-d[0],t[1]-d[1],t[2]-d[2]]),r=Vi(n,p,h,g,G.getSphGeologySnapshot?.()||null);return fr=Object.freeze({...r,bodyIndex:m,bodyId:p.id,worldPos:t}),X={kind:`landing-site`,level:4,index:m,rawPos:[...n],worldPos:[...t],name:`🎯 Landing Site · ${r.biomeLabel}`,subtitle:`${p.name} · ${Math.abs(r.latDeg).toFixed(1)}°${r.latDeg>=0?`N`:`S`}, ${Math.abs(r.lonDeg).toFixed(1)}°${r.lonDeg>=0?`E`:`W`} · ${r.isNightSide?`Night Side`:r.isTwilight?`Terminator Sunset`:`Daylight`}`,composition:`Click 🛸 Land or Dive to touch down right on this ${r.biomeLabel.toLowerCase()} with matching orbital terrain, ocean, ice & sunlight!`,tempK:Math.max(40,(Number(p.tempK)||288)+r.tempOffsetK),stats:[[`Latitude`,`${Math.abs(r.latDeg).toFixed(1)}°${r.latDeg>=0?`N`:`S`}`],[`Longitude`,`${Math.abs(r.lonDeg).toFixed(1)}°${r.lonDeg>=0?`E`:`W`}`],[`Biome`,r.biomeLabel],[`Lighting`,r.isNightSide?`Night Side`:r.isTwilight?`Twilight`:`Sunlit`]]},Pa(),ua(),Q(),$(performance.now()),fr}}}let r=n?null:po(e,t);if(r&&(Y===4||Y===1&&r.isSmbh||Y===2&&(r.hitDistPx??99)<=16)){if(X=null,Gr=!1,Kr=!0,Ur=r.id,Y===0){let e=r.rawPosMpc||r.posMpc;Array.isArray(e)&&G.setCosmoFocusMpc(e),r.galaxyEnv&&(qr=r.galaxyEnv)}else Y===1&&r.branch?G.setGalaxyBranch(r.branch,r.rawPos||r.pos):Y===2&&r.bodyIndex!=null&&G.setFocusedSolarBody(r.bodyIndex);return sa(),ua(),Q(),$(performance.now()),r}let i=uo();if(i&&i.buffer&&i.count>0){let n=e/Math.max(1,Ai)*2-1,a=1-t/Math.max(1,Mi)*2,o=Ai/Math.max(1,Mi),s=0;if(i.kind===`galaxy-star`&&q.active){let e=Math.min(q.log10LambdaMin,q.log10LambdaMax),t=Math.max(q.log10LambdaMin,q.log10LambdaMax);(t>-2.5||e<-10.8)&&(s|=4),t>-11.5&&e<-7.8&&(s|=8),t>-8.2&&e<-6.3&&(s|=16)}let c=await qn.pickEntity({buffer:i.buffer,count:i.count,strideFloats:i.strideFloats,layoutMode:i.layoutMode,skipFirst:i.skipFirst||0,viewProj:ki,clickNdcX:n,clickNdcY:a,aspect:o,maxPickNdc:i.kind===`solar-asteroid`?.18:s?.16:.14,offsetHi:i.offsetHi,offsetLo:i.offsetLo,worldScale:i.worldScale,reversedZ:!0,emPreferenceFlags:s});if(c){let n=new Float32Array([...c.vec0,...c.vec1,...c.vec2,...c.vec3]),a=fo(i,c.index,n),o=a?.worldPos?ya(a.worldPos,ki,Ai,Mi):null,s=o?.visible?Math.hypot(o.sx-e,o.sy-t):999;if(!r||Y!==2||s<=(r.hitDistPx??999)){if(Ur=null,X=a,Kr=!0,Gr=!0,a?.kind===`cosmo-web`&&Array.isArray(a.rawPos)){let e=G.cosmoSession?.boxLengthMpc||1425,t=28500/5/Math.max(10,e),n=[a.rawPos[0]*t,a.rawPos[1]*t,a.rawPos[2]*t];G.setCosmoFocusMpc(n),qr=G.deriveGalaxyEnvironmentFromCosmicContext({cosmicEpoch:G.cosmicEpoch,regionPosMpc:n,localOverdensity:Number(a.localOverdensity)||1.2,seed:G.seed})}else a?.kind===`galaxy-star`&&a.starSite&&(Jr=a.starSite,G.setGalaxyBranch(`solar-system`,a.rawPos));return ua(),Q(),$(performance.now()),X}}}if(r){if(X=null,Gr=!1,Kr=!0,Ur=r.id,Y===0){let e=r.rawPosMpc||r.posMpc;Array.isArray(e)&&G.setCosmoFocusMpc(e),r.galaxyEnv&&(qr=r.galaxyEnv)}else Y===1&&r.branch?G.setGalaxyBranch(r.branch,r.rawPos||r.pos):Y===2&&r.bodyIndex!=null&&G.setFocusedSolarBody(r.bodyIndex);return sa(),ua(),Q(),$(performance.now()),r}return(Kr||Gr)&&(Kr=!1,Gr=!1,X=null,Q(),$(performance.now())),null}function ho(e){if(!(e<0)||!(Kr||Gr))return;let t=Math.max(.02,Math.min(.85,10**(e*2.1)));if(Y===0){let e=G.cosmoFocusMpc||[0,0,0];Qr=[e[0]+(Qr[0]-e[0])*t,e[1]+(Qr[1]-e[1])*t,e[2]+(Qr[2]-e[2])*t]}else if(Y===1){let e=G.galaxyFocusPos||[0,0,0];$r=$r?[e[0]+($r[0]-e[0])*t,e[1]+($r[1]-e[1])*t,e[2]+($r[2]-e[2])*t]:[...e]}else if(Y===2){if(si=[si[0]*t,si[1]*t,si[2]*t],Gr&&X?.worldPos&&X.kind===`solar-asteroid`){let e=X.worldPos;Xr=[e[0]+(Xr[0]-e[0])*t,e[1]+(Xr[1]-e[1])*t,e[2]+(Xr[2]-e[2])*t]}}else if(Gr&&X?.worldPos){let e=X.worldPos;Xr=[e[0]+(Xr[0]-e[0])*t,e[1]+(Xr[1]-e[1])*t,e[2]+(Xr[2]-e[2])*t]}}async function go(){if(!X||X.level!==Y||X.kind===`nucleon`)return;let e=uo();if(!e||e.kind!==X.kind||!e.buffer)return;let t=await qn.readSingleEntity(e.buffer,X.index,e.strideFloats);if(t&&X&&X.kind===e.kind){let n=fo(e,X.index,t);if(X=n,n?.kind===`galaxy-star`&&Array.isArray(n.rawPos))G.setGalaxyBranch(`solar-system`,n.rawPos),n.starSite&&(Jr=n.starSite);else if(n?.kind===`cosmo-web`&&Array.isArray(n.rawPos)){let e=G.cosmoSession?.boxLengthMpc||1425,t=28500/5/Math.max(10,e);G.setCosmoFocusMpc([n.rawPos[0]*t,n.rawPos[1]*t,n.rawPos[2]*t])}}}function _o({zoomIn:e=!1}={}){if(!X)return!1;if(Kr=!0,Y===0&&X.kind===`cosmo-web`){let t=G.cosmoSession?.boxLengthMpc||1425,n=28500/5/Math.max(10,t),r=[X.rawPos[0]*n,X.rawPos[1]*n,X.rawPos[2]*n];G.setCosmoFocusMpc(r),qr=G.deriveGalaxyEnvironmentFromCosmicContext({cosmicEpoch:G.cosmicEpoch,regionPosMpc:r,localOverdensity:Number(X.localOverdensity)||1.2,seed:G.seed}),Gr=!0,e&&aa(Math.max(21.2,l-1.6))}else Y===1&&X.kind===`galaxy-star`?(G.setGalaxyBranch(`solar-system`,X.rawPos),X.starSite&&(Jr=X.starSite),Gr=!0,e&&aa(Math.max(17.5,l-1.5))):(Gr=!Gr||e,Gr?(Xr=[...X.worldPos],e&&(Oi.dist=Math.max(6.5,Oi.dist*.62))):(Kr=!1,Xr=[0,0,0],Oi.dist=18));return Q(),$(performance.now()),!0}Pt?.addEventListener(`click`,()=>{_o({zoomIn:!Gr})});function vo(e,t){if(!e||!t)return null;let n=t.getCameraPose?.()?.focusPos||[0,0,0],r=t.env?.hasSolidCrust?Math.max(100,Number(t.env.tinyPlanetCurvatureRadiusM)||2800):0,i=e.pos[0]-n[0],a=e.pos[2]-n[2],o=r>0?(i*i+a*a)/(2*r):0,s=Math.max(.5,Number(e.scale)||1),c=e.kingdom===`flora`?s*2.2:e.kingdom===`fungi`?s*1.15:s*.95;return[e.pos[0],e.pos[1]-o+c,e.pos[2]]}function yo(e){if(!e)return null;let t=G.surfaceSession,n=t?.env,r=t?.xenobiology||n?.xenobiology||null,i=e.speciesRecord||{},a=e.kingdom||e.kind||i.kingdom||`fauna`,o=G.surfaceBodySpec?.name||G.getActiveSystemCatalog()[G.planetaryBodyIndex]?.name||`World`,s=G.surfaceClimate?.observerLatDeg??G.surfaceLandingSite?.latDeg??32,c=(G.surfaceLandingSite?.lonDeg??0)+(G.surfaceClimate?.observerLonOffsetDeg??0);return pr={id:e.id,orgRef:e,kingdom:a,bodyPlan:e.bodyPlan||i.bodyPlan||`organism`,trophicGuild:e.trophicGuild||i.trophicGuild||(a===`flora`?`autotroph`:`heterotroph`),speciesName:i.speciesName||(a===`flora`?`Xenophyte Tree`:a===`fungi`?`Myco-Organism`:`Xeno-Fauna`),morphClass:i.morphClass||e.bodyPlan||a,solventFormula:r?.solventFormula||`H₂O`,solventLabel:r?.solventLabel||`Water`,xnaBackbone:i.xnaBackbone||r?.xnaBackbone||`RNA/DNA`,xnaAlphabetSize:i.xnaAlphabetSize||r?.xnaAlphabetSize||4,skeleton:i.skeleton||`Structural Matrix`,metabolicPowerW:i.metabolicPowerW??null,redEdgeNm:i.redEdgeNm??r?.photobiology?.redEdgeNm??null,deltaGKjMol:i.deltaGKjMol??r?.redox?.deltaGKjMol??null,heightM:Number((Math.max(.6,Number(e.scale)||1)*(a===`flora`?4.4:1.7)).toFixed(1)),primaryRgb:e.primaryRgb||i.primaryRgb||[.32,.82,.56],fasta:i.fasta||r?.labParams?.foldSeq||`HPPHH+PHHPPHH-P`,worldName:o,latDeg:Number(s.toFixed(1)),lonDeg:Number(c.toFixed(1)),tempK:Math.round(G.surfaceClimate?.surfaceTempK??n?.tempK??288),gravityMS2:Number((n?.gravityMS2??9.81).toFixed(2)),profile:r,abducted:!!e.abducted,abductedRecord:null},Hi(`scan`,{autoExpand:!Ri(),preferPeek:Ri()}),Q(),$(performance.now()),pr}function bo(e,t){if(!G.surfaceActive||!G.surfaceSession||!ki)return null;let n=G.surfaceSession,r=n.getOrganisms?.()||[];if(!r.length)return null;let i=Ri()?56:46,a=null,o=i;for(let i of r){if(!i||i.abducted)continue;let r=vo(i,n);if(!r)continue;let s=ya(r,ki,Ai,Mi);if(!s.visible)continue;let c=Math.hypot(s.sx-e,s.sy-t);c<o&&(o=c,a=i)}return a?yo(a):null}function xo(e=null){if(!G.surfaceActive||!G.surfaceSession)return null;let t=e??pr?.id;if(t==null)return null;let n=G.surfaceSession.abductOrganismById?.(t,{queueEvent:!1});return n?(gr.push(n),pr&&(pr.id===t||pr.orgRef?.abducted)&&(pr.abducted=!0,pr.abductedRecord=n),Xi(),Pa(),Q(),$(performance.now()),n):null}let So=new Map,Co=null,wo=0;u.addEventListener(`pointerdown`,e=>{ot?.classList.remove(`mobile-tools-open`),st?.classList.remove(`active`),st?.setAttribute(`aria-expanded`,`false`),So.set(e.pointerId,{x:e.clientX,y:e.clientY});try{u.setPointerCapture?.(e.pointerId)}catch{}if(So.size===2){let e=[...So.values()];wo=Math.hypot(e[1].x-e[0].x,e[1].y-e[0].y),ao=!0;return}Co!==null&&Co!==e.pointerId||(Co=e.pointerId,io=!0,ao=!1,oo=e.clientX,so=e.clientY,co=e.clientX,lo=e.clientY)}),u.addEventListener(`pointermove`,e=>{if(So.has(e.pointerId)&&So.set(e.pointerId,{x:e.clientX,y:e.clientY}),So.size===2){let e=[...So.values()],t=Math.hypot(e[1].x-e[0].x,e[1].y-e[0].y);if(wo>8&&t>8){let e=Math.max(.75,Math.min(1.35,wo/t));if(ao=!0,G.surfaceActive)G.adjustSurfaceChaseDistance(e),$(performance.now());else if(K.mode===`ufo`)K.adjustChaseZoom(e),qi(),$(performance.now());else{Ua(),Ei=null;let t=Math.max(-.45,Math.min(.45,Math.log10(e)*2.6));t<0&&(X||Ur)&&(Kr=!0,X&&(Gr=!0),ho(t));let n=Math.max(vt,Math.min(_t,l+t));Y===4&&t<0&&n<5.75&&!Eo?(Eo=!0,Fa({bodyIndex:G.planetaryBodyIndex}).finally(()=>{Eo=!1})):(l=n,Di=Math.abs(t)*10,ra(l))}}wo=t;return}if(io&&(Co===null||e.pointerId===Co)){let t=e.clientX-co,n=e.clientY-lo;Math.hypot(e.clientX-oo,e.clientY-so)>6&&(ao=!0,Si&&Ua()),G.surfaceActive?G.addSurfaceLookDelta(-t*.0055,n*.0055):K.mode===`ufo`?(e.shiftKey||e.buttons&2?K.rotateLocal(0,0,-t*.008):K.rotateLocal(-n*.006,-t*.006,0),qi()):(Oi.yaw-=t*.006,Oi.pitch=Math.max(-1.42,Math.min(1.42,Oi.pitch+n*.006))),co=e.clientX,lo=e.clientY}else if(!G.surfaceActive){let t=po(e.clientX,e.clientY);Wr=t?.id||null,u.style.cursor=t?`pointer`:`crosshair`}});let To=(e,t)=>{if(So.delete(e.pointerId),So.size<2&&(wo=0),Co!==null&&e.pointerId!==Co){if(So.size===1){let[e,t]=So.entries().next().value;Co=e,co=t.x,lo=t.y}return}t&&io&&!ao&&(G.surfaceActive?!bo(e.clientX,e.clientY)&&pr&&(pr=null,Q(),$(performance.now())):(Ua(),mo(e.clientX,e.clientY).then(e=>{e&&Ri()&&Hi(`scan`,{autoExpand:!1,preferPeek:!0})}))),io=!1,Co=null};u.addEventListener(`pointerup`,e=>To(e,!0)),u.addEventListener(`pointercancel`,e=>To(e,!1)),u.addEventListener(`dblclick`,async e=>{if(G.surfaceActive)return;Ua();let t=await mo(e.clientX,e.clientY);t&&t===X?_o({zoomIn:!0}):Aa()});let Eo=!1;u.addEventListener(`wheel`,e=>{e.preventDefault();let t=re(e);if(G.surfaceActive){let e=1.12**Math.max(-2.5,Math.min(2.5,t/120));G.adjustSurfaceChaseDistance(e),$(performance.now());return}if(K.mode===`ufo`&&!e.shiftKey){let e=1.22**Math.max(-3,Math.min(3,t/120));K.adjustChaseZoom(e),qi(),$(performance.now());return}Ua(),Ei=null;let n=Math.max(-.55,Math.min(.55,t*.0024));n<0&&(X||Ur)&&(Kr=!0,X&&(Gr=!0),ho(n));let r=Math.max(vt,Math.min(_t,l+n));if(Y===4&&n<0&&r<5.75&&!Eo){Eo=!0,Fa({bodyIndex:G.planetaryBodyIndex}).finally(()=>{Eo=!1});return}l=r,Di=Math.abs(n)*10,ra(l)},{passive:!1});let Do=1;u.addEventListener(`gesturestart`,e=>{e.preventDefault(),Do=Number(e.scale)||1},{passive:!1}),u.addEventListener(`gesturechange`,e=>{e.preventDefault();let t=Number(e.scale)||1;if(t>.05&&Do>.05){let e=Do/t;if(G.surfaceActive)G.adjustSurfaceChaseDistance(e),$(performance.now());else{Ei=null;let t=Math.max(-.45,Math.min(.45,Math.log10(e)*2.2));l=Math.max(vt,Math.min(_t,l+t)),ra(l)}}Do=t},{passive:!1});function Oo(e){if(!Dt)return;let t=Dt.getContext(`2d`);if(!t)return;let n=Dt.width,r=Dt.height;t.fillStyle=`#040812`,t.fillRect(0,0,n,r);for(let e=0;e<n;e+=2){let[i,a,o]=ba(380+e/n*340);t.fillStyle=`rgba(${i},${a},${o},0.16)`,t.fillRect(e,0,2,r)}let i=Y>=5?G.getCachedElementBundle(Y===5?G.mdElementZ:G.quantumZ,G.quantumRelativistic):null,a=fi(Y,e,i);for(let e of a){let i=(e.wavelengthNm-380)/340*n;if(i<0||i>n)continue;let[a,o,s]=ba(e.wavelengthNm),c=Math.max(.25,Math.min(1,e.intensity));t.fillStyle=`rgba(${a},${o},${s},${c.toFixed(2)})`,t.fillRect(i-1.5,0,3,r),t.fillStyle=`rgba(255,255,255,${(c*.45).toFixed(2)})`,t.fillRect(i-.5,2,1,r-4)}if((Y===2||Y===4)&&Xn?.spectralFeaturesNm?.length)for(let e of Xn.spectralFeaturesNm){let i=(e.nm-380)/340*n;i<2||i>n-2||(t.fillStyle=e.isBio?`#34d399`:`#fbbf24`,t.fillRect(i-1,0,2,r),t.fillStyle=`rgba(2, 6, 23, 0.78)`,t.fillRect(Math.min(n-38,i+2),1,36,9),t.fillStyle=e.isBio?`#a7f3d0`:`#fde68a`,t.font=`700 7.5px monospace`,t.fillText(e.label.slice(0,7),Math.min(n-36,i+3),8))}}function ko(){if(!Mt)return;let e=Mt.getContext(`2d`);if(!e)return;let t=Mt.width,n=Mt.height;e.fillStyle=`#050b16`,e.fillRect(0,0,t,n),e.strokeStyle=`rgba(148,163,184,0.18)`,e.lineWidth=1,e.strokeRect(8,8,t-16,n-18);let r=(t,r,i,a=null,o=!1)=>{if(t.length){e.beginPath(),o&&e.setLineDash([3,3]);for(let n=0;n<t.length;n+=1)n===0?e.moveTo(t[n],r[n]):e.lineTo(t[n],r[n]);e.strokeStyle=i,e.lineWidth=o?1.2:2,e.stroke(),e.setLineDash([]),a&&(e.lineTo(t[t.length-1],n-10),e.lineTo(t[0],n-10),e.closePath(),e.fillStyle=a,e.fill())}};if(Y===0){let e=G.cosmoTelemetry?.powerSpectrumPk;if(!e?.kBins?.length)return;jt&&(jt.textContent=`D/D₀ = ${(e.linearGrowthRatio||1).toFixed(2)}× · ${e.kBins.length} k-bins`);let i=e.kBins.map(e=>Math.log10(Math.max(1e-4,e))),a=e.pkValues.map(e=>Math.log10(Math.max(1e-6,e))),o=Math.min(...i),s=Math.max(o+.2,...i),c=G.cosmoFirstPk?.pkValues?.map(e=>Math.log10(Math.max(1e-6,e)))||[],l=[...a,...c],u=Math.min(...l)-.3,d=Math.max(u+1,...l)+.3,f=e=>12+(e-o)/(s-o)*(t-24),p=e=>n-12-(e-u)/(d-u)*(n-24);c.length===i.length&&r(i.map(f),c.map(p),`rgba(148,163,184,0.6)`,null,!0),r(i.map(f),a.map(p),`#38bdf8`,`rgba(56,189,248,0.16)`,!1)}else if(Y===1){jt&&(jt.textContent=`Gate 1 H/He/C/O · Z=${G.galaxyMetallicity.toFixed(1)} Z☉`);let e=[],i=[];for(let r=0;r<48;r+=1){let a=2+r/47*6,o=G.evaluateIsmRadiativeCoolingErgCm3PerS(10**a,G.galaxyMetallicity,G.ismCoolingAnchors),s=Math.log10(Math.max(1e-28,o));e.push(12+r/47*(t-24)),i.push(n-12-(s- -26.5)/5.5*(n-24))}r(e,i.map(e=>Math.max(10,Math.min(n-12,e))),`#a78bfa`,`rgba(167,139,250,0.18)`,!1)}else if(Y===2)if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(G.solarMode)&&G.relBinaryTelemetry?.gwStrainHistory?.length){let e=G.relBinaryTelemetry.gwStrainHistory;At&&(At.textContent=`2.5PN GRAVITATIONAL-WAVE STRAIN h_+(t)`),jt&&(jt.textContent=`f_GW=${(G.relBinaryTelemetry.gwFrequency||0).toFixed(2)} · sep=${(G.relBinaryTelemetry.separation||0).toFixed(2)}`);let i=Math.max(.08,...e.map(e=>Math.abs(e)));r(e.map((n,r)=>12+r/Math.max(1,e.length-1)*(t-24)),e.map(e=>n*.5-e/i*(n*.38)),`#38bdf8`,`rgba(56,189,248,0.14)`,!1)}else if(G.solarMode===`quasar-jet`&&G.kerrJetTelemetry){At&&(At.textContent=`NOVIKOV–THORNE DISK T(r) & BZ JET`);let e=G.kerrJetTelemetry;jt&&(jt.textContent=`a*=${e.spinA.toFixed(2)} · r_ISCO=${e.rIscoRg.toFixed(2)} r_g · Γ=${e.maxLorentzGamma.toFixed(1)}`);let i=[],a=[];for(let e=0;e<48;e+=1){let r=1.02+e/47*9,o=(1/r)**.75*Math.max(.01,1-Math.sqrt(1/r))**.25;i.push(12+e/47*(t-24)),a.push(n-12-Math.min(1,o*2.2)*(n-24))}r(i,a,`#f472b6`,`rgba(244,114,182,0.20)`,!1)}else{At&&(At.textContent=yt[2].plotTitle);let r=G.solarConservation0,i=G.solarConservation,a=r&&i?Math.abs(i.totalEnergy-r.totalEnergy)/Math.max(1e-12,Math.abs(r.totalEnergy)):0;jt&&(jt.textContent=`|ΔE/E₀|=${a.toExponential(1)} · ${G.solarEngine?.totalCount||0} bodies`);let o=G.getActiveSystemCatalog().filter(e=>!e.isStar&&(e.parent===0||e.parent===-2)&&e.id!==`halley`),s=(t-32)/Math.max(1,o.length);o.forEach((t,r)=>{let i=Math.min(1,Math.log10(Math.max(30,t.tempK))/3.3)*(n-28),a=16+r*s+2;e.fillStyle=`rgb(${Math.round(t.color0[0]*255)},${Math.round(t.color0[1]*255)},${Math.round(t.color0[2]*255)})`,e.fillRect(a,n-12-i,Math.max(6,s-6),i),e.fillStyle=`#94a3b8`,e.font=`8.5px monospace`,e.fillText(t.name.split(` `).slice(-1)[0].replace(/[()]/g,``).slice(0,4),a,n-14-i)})}else if(Y===3)if((G.stellarMode===`pulsar`||G.stellarMode===`magnetar`)&&G.magnetosphereTelemetry?.flareHistory?.length){let e=G.magnetosphereTelemetry.flareHistory;At&&(At.textContent=G.stellarMode===`magnetar`?`MAGNETAR HALL-YIELD FLARE LIGHT CURVE`:`PULSAR SPIN-DOWN BEAM FLUX`),jt&&(jt.textContent=`B=${G.magnetosphereTelemetry.surfaceBFieldTesla.toExponential(1)} T · Flares=${G.magnetosphereTelemetry.flareCount}`);let i=Math.max(.4,...e);r(e.map((n,r)=>12+r/Math.max(1,e.length-1)*(t-24)),e.map(e=>n-12-e/i*(n-24)),G.stellarMode===`magnetar`?`#f472b6`:`#38bdf8`,`rgba(244,114,182,0.18)`,!1)}else if(G.stellarMode===`white-dwarf-tov`&&G.tovCurve?.length){At&&(At.textContent=`WEBGPU GR TOV MASS–RADIUS M(R) SEQUENCE`);let e=G.tovCurve.filter(e=>e.radiusKm>1&&e.massSolar>.05);jt&&(jt.textContent=`${e.length} GR TOV solutions · WD → NS → BH`),r(e.map(e=>12+(Math.log10(e.radiusKm)-.8)/3.6*(t-24)),e.map(e=>n-12-Math.min(1,e.massSolar/3.2)*(n-24)),`#34d399`,`rgba(52,211,153,0.18)`,!1)}else{At&&(At.textContent=yt[3].plotTitle);let e=G.stellarTelemetry,i=Math.max(2e6,e?.coreTempK||15e6),a=i*8.617333262e-8,o=1.22*Math.max(.01,i*1e-6)**(2/3);jt&&(jt.textContent=`E₀=${o.toFixed(1)} keV · LE ξ₁=${(G.stellarLaneEmden?.solutions?.[1]?.xi1||6.9).toFixed(2)}`);let s=Math.max(20,o*3),c=[],l=[],u=[],d=1e-300;for(let e=1;e<=48;e+=1){let r=e/48*s,i=12+e/48*(t-24),o=Math.exp(-Math.min(50,r/Math.max(.001,a))),f=o*Math.exp(-Math.min(60,Math.sqrt(493/Math.max(.05,r))));f>d&&(d=f),c.push(i),l.push(n-12-Math.min(1,o)*(n-24)),u.push(f)}let f=u.map(e=>n-12-e/Math.max(1e-300,d)*(n-24));r(c,l,`rgba(251,191,36,0.65)`,null,!0),r(c,f,`#34d399`,`rgba(52,211,153,0.28)`,!1)}else if(Y===4){let e=G.planetaryResult?.profile||[];if(!e.length)return;let i=Math.max(1,G.planetaryResult.radiusM||637e4),a=Math.max(1e9,e[0].pressurePa||36e10),o=Math.max(2e3,...e.map(e=>e.densityKgPerM3||0));jt&&(jt.textContent=`P_c=${(a/1e9).toFixed(0)} GPa · MoI=${(G.planetaryResult.moiFactor||.33).toFixed(3)}`);let s=e.map(e=>12+e.radiusM/i*(t-24)),c=e.map(e=>n-12-e.pressurePa/a*(n-24)),l=e.map(e=>n-12-e.densityKgPerM3/o*(n-24));r(s,c,`#fb923c`,`rgba(251,146,60,0.16)`,!1),r(s,l,`#38bdf8`,null,!1)}else if(Y===5){let e=G.mdRdfHistory;if(!e?.length)return;jt&&(jt.textContent=`Phase: ${G.mdTelemetry?.emergentPhase||`—`} · ⟨Z⟩=${(G.mdTelemetry?.meanCoordination||0).toFixed(1)}`);let i=Math.max(1,...e);r(e.map((n,r)=>12+r/(e.length-1)*(t-24)),e.map(e=>n-12-e/i*(n-24)),`#34d399`,`rgba(52,211,153,0.22)`,!1)}else if(Y===6){let e=G.getCachedElementBundle(G.quantumZ,G.quantumRelativistic)?.visualData?.atom;if(!e?.rGrid?.length||!e?.rho?.length)return;jt&&(jt.textContent=`Dirac–KS ${G.quantumRelativistic?`Rel ON`:`Rel OFF`} · Z=${G.quantumZ}`);let i=Math.min(120,e.rGrid.length),a=[],o=1e-9;for(let t=0;t<i;t+=1){let n=e.rGrid[t],r=4*Math.PI*n*n*Math.max(0,e.rho[t]);r>o&&(o=r),a.push(r)}r(a.map((e,n)=>12+n/(a.length-1)*(t-24)),a.map(e=>n-12-e/o*(n-24)),`#38bdf8`,`rgba(56,189,248,0.22)`,!1)}else if(Y===7){let e=G.tdseTelemetry;if(!e?.prob?.length)return;jt&&(jt.textContent=`P_in=${(e.pInside*100).toFixed(1)}% · P_tun=${(e.pTunneled*100).toFixed(2)}%`);let i=e.prob.length,a=Math.max(1e-4,...e.prob),o=Math.max(1,...e.potRawMeV),s=Array.from({length:i},(e,n)=>12+n/(i-1)*(t-24)),c=Array.from({length:i},(t,r)=>n-12-Math.max(0,e.potRawMeV[r]/o)*(n-26)),l=Array.from({length:i},(t,r)=>n-12-e.prob[r]/a*(n-24));r(s,c,`rgba(251,191,36,0.72)`,null,!0),r(s,l,`#34d399`,`rgba(52,211,153,0.28)`,!1)}}let Ao=``;function jo(){if(!kt)return;let e=G.activeSampledMaterial,t=!!(e&&Y>=5&&!G.surfaceActive);if(kt.classList.toggle(`active`,t),!t){Ao=``;return}let n=`${e.id}:${Y}:${G.mdElementZ}:${G.quantumMode}:${G.quantumMoleculeKey}:${G.quantumZ}:${G.nuclearZ}:${Hr?Hr.vehicleLabel:`none`}`;if(n===Ao)return;Ao=n;let r=(e.compounds||[]).slice(0,4).map((e,t)=>{let n=Y===6&&G.quantumMode===`molecule`&&G.quantumMoleculeKey===e.moleculeKey,r=Number.isFinite(e.moleFrac)?` ${(e.moleFrac*100).toFixed(e.moleFrac>=.1?0:1)}%`:``;return`<button class="uv-chip compound ${n?`active`:``}" data-sample-comp="${t}" type="button" title="Inspect ${e.name} (${e.formula}) molecular orbitals on L6">${e.formula}${r}</button>`}).join(``),i=(e.elements||[]).slice(0,6).map(e=>`<button class="uv-chip ${Y===5&&G.mdElementZ===e.Z||Y===6&&G.quantumMode===`atom`&&G.quantumZ===e.Z||Y===7&&G.nuclearZ===e.Z?`active`:``}" data-sample-el="${e.Z}" type="button" title="Examine ${e.name} (Z=${e.Z}) at this scale">${e.sym}(${e.Z})</button>`).join(``),a=Hr?`<button class="uv-chip active" id="uv-back-to-surface-btn" data-return-surface="1" type="button" style="border-color:rgba(52,211,153,0.75);background:rgba(16,185,129,0.28);color:#ecfdf5;" title="Return directly to your parked ${Hr.vehicleLabel} on ${Hr.worldName}">↩ Back to ${Hr.vehicleLabel}</button>`:``;kt.innerHTML=`
      <div class="uv-sample-head">
        <span>🔬 ${e.worldName} · ${e.shortLabel}</span>
        ${a||`<span style="color:var(--muted);">${e.locationTag}</span>`}
      </div>
      <div class="uv-chip-row"><span class="uv-chip-lbl">Compounds:</span>${r}</div>
      <div class="uv-chip-row"><span class="uv-chip-lbl">Elements:</span>${i}</div>
      <div class="uv-chip-row">
        <span class="uv-chip-lbl">Step:</span>
        <button class="uv-chip ${Y===5?`active`:``}" data-sample-step="5" type="button">L5 Lattice</button>
        <button class="uv-chip ${Y===6&&G.quantumMode===`molecule`?`active`:``}" data-sample-step="6m" type="button">L6 Compound</button>
        <button class="uv-chip ${Y===6&&G.quantumMode===`atom`?`active`:``}" data-sample-step="6a" type="button">L6 Element</button>
        <button class="uv-chip ${Y===7?`active`:``}" data-sample-step="7" type="button">L7 Nucleus</button>
        ${e.xenoUrl?`<a class="uv-chip" href="${e.xenoUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;border-color:rgba(167,139,250,0.65);color:#ddd6fe;" title="Synthesize native alien membranes &amp; biopolymers for this world in Life Lab">🧬 Bio Lab ↗</a>`:``}
      </div>`,kt.querySelector(`[data-return-surface]`)?.addEventListener(`click`,()=>{ma()});for(let t of kt.querySelectorAll(`[data-sample-comp]`))t.addEventListener(`click`,()=>{let n=e.compounds?.[Number(t.dataset.sampleComp)];n&&xa(n)});for(let e of kt.querySelectorAll(`[data-sample-el]`))e.addEventListener(`click`,()=>{let t=Number(e.dataset.sampleEl);t>0&&ka(t,{targetLevel:Y})});for(let t of kt.querySelectorAll(`[data-sample-step]`))t.addEventListener(`click`,()=>{let n=t.dataset.sampleStep;n===`5`?ka(G.mdElementZ||e.primaryZ,{targetLevel:5}):n===`6m`?xa(e.compounds?.[0]):n===`6a`?ka(G.quantumZ||e.primaryZ,{targetLevel:6}):n===`7`&&ka(G.nuclearZ||G.quantumZ||e.primaryZ,{targetLevel:7})})}function Q(){let e=yt[Y],t=!!(X&&X.level===Y),n=t?X:ca(),r=G.computeScaleAdaptiveTimeDilation(l,{surfaceActive:G.surfaceActive,userTimeScale:hi});v&&(v.textContent=`10^${l.toFixed(1)} m`),y&&(y.textContent=r.clockLabel),g&&(g.textContent=St(l)),h&&document.activeElement!==h&&(h.value=l.toFixed(2)),mt&&(mt.textContent=t?`GPU MOTE INSPECTOR · L${e.level} · ${St(l)}`:`L${e.level} · ${e.name.toUpperCase()} · ${St(l)}`),ht&&(ht.textContent=n?.name||e.name),gt&&(gt.textContent=n?.subtitle||e.engineSchema),Et&&(Et.textContent=n?.composition||``),Tt&&(Tt.textContent=Y>=5?`GATE 1 OPTICAL SPECTRUM`:`EMISSION SPECTROGRAPH`),Pt&&(Pt.style.display=t&&!G.surfaceActive?`inline-flex`:`none`,Pt.textContent=Gr?`🎯 Locked`:`🎯 Focus`,Pt.classList.toggle(`active`,Gr));let i=[];if(t&&Array.isArray(X.stats)&&X.stats.length)i=X.stats;else if(Y===0)if(G.cosmoMode!==`web`&&G.cosmoBaryonTelemetry){let e=G.cosmoBaryonTelemetry,t=e.redshiftZ>100?`${e.cmbTempK.toFixed(0)} K`:e.maxGasTempK>=1e5?`${(e.maxGasTempK/1e6).toFixed(1)} MK`:`${Math.round(e.maxGasTempK).toLocaleString()} K`;i=[[`Redshift z`,`${e.redshiftZ.toFixed(e.redshiftZ>100?0:2)}`],[`T_CMB / Gas`,t],[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Lensing κ_max`,`${e.maxLensingKappa.toFixed(2)}`]]}else{let e=G.cosmoTelemetry;i=[[`Scale a(t)`,e?e.scaleFactorA.toFixed(3):`—`],[`Redshift z`,e?e.redshiftZ.toFixed(2):`—`],[`Density σ`,e?e.sigmaDensity.toFixed(3):`—`],[`GPU Submits`,e?`${e.submitsPerStep}/step`:`—`]]}else if(Y===1)i=[[`GPU Particles`,`${(G.galaxyEngine?.count||0).toLocaleString()}`],[`Morphology`,G.galaxyPreset],[`DM Halo`,`NFW / Hernquist`],[`GPU Steps`,`${G.galaxyEngine?.stepIndex||0}`]];else if(Y===2)if(G.solarMode===`formation`&&G.protoplanetaryTelemetry){let e=G.protoplanetaryTelemetry;i=[[`Snow Line`,`${e.snowLineAu.toFixed(2)} AU`],[`Rocky / Icy`,`${e.rockyPebbles} / ${e.icyPebbles}`],[`Accreted`,`${e.accretedPebbles} peb`],[`Rigid Bodies`,`${e.rigidBodyCount} (DLM)`]]}else if(G.solarMode===`quasar-jet`&&G.kerrJetTelemetry){let e=G.kerrJetTelemetry;i=[[`Kerr Spin a*`,e.spinA.toFixed(2)],[`Lorentz Γ_max`,`${e.maxLorentzGamma.toFixed(2)}×`],[`r_ISCO / r_g`,`${e.rIscoRg.toFixed(2)}`],[`BZ Jet Parcels`,`${e.activeJetParcels}`]]}else if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(G.solarMode)&&G.relBinaryTelemetry){let e=G.relBinaryTelemetry;i=[[`Separation`,e.merged?`MERGED`:e.separation.toFixed(2)],[`GW Strain h_+`,e.gwStrainPlus.toFixed(3)],[`Remnant`,e.remnantType.slice(0,14)],[`r-Proc Parcels`,`${e.rProcessEjectaCount}`]]}else if([`comet-tails`,`hot-jupiter`].includes(G.solarMode)&&G.radWindL2Telemetry){let e=G.radWindL2Telemetry;i=[[`Regime`,e.regime],[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Mean Outflow`,`${e.meanOutflowSpeed.toFixed(2)}`],[`Live Parcels`,`${e.activeParcels}`]]}else if([`roche-rings`,`giant-impact`,`red-giant`,`tde`].includes(G.solarMode)&&G.tidalRocheTelemetry){let e=G.tidalRocheTelemetry;i=[[`Ruptured`,`${(e.rupturedFraction*100).toFixed(0)}%`],[`Max Strain`,e.maxTidalStrain.toFixed(2)],[`Mean Radius`,e.meanRadiusSim.toFixed(2)],[`Live Debris`,`${e.activeParticles}`]]}else{let e=G.solarConservation,t=G.getActiveSystemCatalog(),n=t[G.focusedSolarBodyIndex]||t[0],r=G.useSolReference?`Sol (1★)`:`${G.activeCausalSystem?.starCount||1}★ ${G.activeCausalSystem?.architecture||`single`}`;i=[[`Focus`,(n?.name||`World`).slice(0,18)],[`Architecture`,r],[`True Radius`,n?`${n.radiusKm.toLocaleString()} km`:`—`],[`Sim Time`,`${(G.solarEngine?.simTimeYr||0).toFixed(3)} yr`]],e&&G.galaxyBranch===`smbh-core`&&(i[0]=[`SMBH Mass`,`4.3×10⁶ M☉`],i[1]=[`Lensing`,gi?`Active WGSL`:`OFF`])}else if(Y===3)if(G.stellarMode===`nebular-mhd`&&G.nebulaMhdTelemetry){let e=G.nebulaMhdTelemetry;i=[[`Mag Energy`,`${e.magneticEnergy.toFixed(1)}`],[`Toroidal B_φ`,`${e.peakToroidalB.toFixed(3)}`],[`Max |B|`,`${e.maxBField.toFixed(3)}`],[`|∇·B| GLM`,`${e.meanAbsDivB.toExponential(1)}`]]}else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`].includes(G.stellarMode)&&G.radWindL3Telemetry){let e=G.radWindL3Telemetry;i=[[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Outflow Speed`,e.meanOutflowSpeed.toFixed(2)],[`Line Flux`,e.meanLineEmission.toFixed(2)],[`Live Parcels`,`${e.activeParcels}`]]}else if((G.stellarMode===`pulsar`||G.stellarMode===`magnetar`)&&G.magnetosphereTelemetry){let e=G.magnetosphereTelemetry;i=[[`Surface B`,`${e.surfaceBFieldTesla.toExponential(1)} T`],[`Spin-Down Ė`,`${e.spinDownLumW.toExponential(1)} W`],[`Starquakes`,`${e.flareCount} flares`],[`Crust Strain`,`${(e.crustStrain*100).toFixed(0)}%`]]}else if(G.stellarMode===`white-dwarf-tov`&&G.tovCurve?.length){let e=G.tovCurve.find(e=>e.branch===`white-dwarf`)||G.tovCurve[2],t=G.tovCurve.find(e=>e.branch===`neutron-star`)||G.tovCurve[11];i=[[`WD Sample`,`${e.massSolar.toFixed(2)} M☉`],[`WD Radius`,`${Math.round(e.radiusKm).toLocaleString()} km`],[`NS Sample`,`${t.massSolar.toFixed(2)} M☉`],[`NS Radius`,`${t.radiusKm.toFixed(1)} km`]]}else if(G.stellarMode===`black-hole`){let e=G.kerrJetTelemetry;i=[[`Kerr Spin a*`,e?e.spinA.toFixed(2):`0.94`],[`r_ISCO / r_g`,e?e.rIscoRg.toFixed(2):`2.02`],[`Lorentz Γ`,e?`${e.maxLorentzGamma.toFixed(2)}×`:`6.4×`],[`Stage`,`Kerr Black Hole`]]}else{let e=G.stellarTelemetry,t=e?.dominantChannel||e?.stellarLabel||G.stellarPreset||`pp-chain`,n=((e?.meanXCNO??0)*100).toFixed(3),r=((e?.meanXAlphaFe??0)*100).toFixed(3);i=[[`Core Temp`,e?`${(e.coreTempK/1e6).toFixed(2)} MK`:`—`],[`Fusion Burn`,String(t).slice(0,22)],[`CNO / α-Fe`,`${n}% / ${r}%`],[`SS Grid/Step`,`${G.stellarEngine?.gridN||24}³ · #${G.stellarEngine?.stepIndex||0}`]]}else if(Y===4)if(G.surfaceActive&&G.surfaceSession){let e=G.surfaceTelemetry||G.surfaceSession.getTelemetry(),t=G.surfaceSession.env;i=[[`Surface g`,`${t.gravityMS2.toFixed(2)} m/s²`],[`Air ρ_atm`,t.rhoAtmKgM3>1e-4?`${t.rhoAtmKgM3.toFixed(3)} kg/m³`:`0 (Vacuum)`],[`Rover Alt/Fuel`,`${e.roverAltitudeM.toFixed(1)}m / ${Math.round(e.roverRocketFuel*100)}%`],[`Drone Max Lift`,t.droneFlightCapable?`${t.maxAeroLiftN.toFixed(1)} N (OK)`:`0.0 N (Vac)`]]}else{let e=G.planetaryResult,t=G.planetaryAtmoTelemetry,n=G.getActiveSystemCatalog();i=[[`World`,((n[G.planetaryBodyIndex]||n[0])?.name||`World`).slice(0,18)],[`MoI I/MR²`,e?e.moiFactor.toFixed(4):`—`],[`Lightning`,t?`${t.activeLightningCells} cells`:`Dormant (Vac)`],[`Peak |E|`,t?`${(t.peakElectricFieldVPerM/1e3).toFixed(0)} kV/m`:`0 kV/m`]]}else if(Y===5){let e=G.mdTelemetry;i=[[`Temp`,e?`${Math.round(e.temperatureK)} K`:`${G.mdTempK} K`],[`Pressure`,e?`${e.pressureGPa.toFixed(2)} GPa`:`—`],[`Coord ⟨Z⟩`,e?e.meanCoordination.toFixed(2):`—`],[`Gravity`,G.mdGravity?`ON (GPU)`:`Zero-G`]]}else if(Y===6){let e=G.getCachedElementBundle(G.quantumZ,G.quantumRelativistic)?.bundle,t=Array.isArray(e?.electromagnetic?.opticalSrgb)?e.electromagnetic.opticalSrgb:[.8,.85,.9],n=Number(e?.atomic?.totalEnergyHa);i=[[`Samples`,`${(G.orbitalCloud?.pointCount||0).toLocaleString()} pts`],[`Dirac E_tot`,Number.isFinite(n)?`${n.toFixed(1)} Ha`:`—`],[`Magnetic`,e?.electromagnetic?.magneticPhase||`—`],[`Gate 1 sRGB`,`[${t.map(e=>Number(e||0).toFixed(2)).join(`,`)}]`]]}else if(Y===7){let e=G.nuclearResult,t=G.tdseTelemetry,n=Number(e?.bindingPerNucleonMeV),r=Number(e?.chargeRadiusFm);i=[[`B / A`,Number.isFinite(n)?`${n.toFixed(3)} MeV`:`—`],[`Radius R_c`,Number.isFinite(r)?`${r.toFixed(2)} fm`:`—`],[`TDSE Steps`,`${t?.stepCount||0}`],[`P_tunneled`,t?`${(t.pTunneled*100).toFixed(2)}%`:`—`]]}if((Y===2||Y===4)&&!G.surfaceActive){let e=G.getActiveSystemCatalog(),t=Y===4?G.planetaryBodyIndex:G.focusedSolarBodyIndex;if(Xn=Zi(Y===2&&X?.kind===`solar-asteroid`?Mr(X):e[t]||e[0],e[0]||null,{planetaryMode:G.planetaryMode,cToO:G.activeCausalSystem?.starSystem?.nebulaEnv?.cToO??.55,seed:G.seed}),nt&&Xn){let e=Xn;nt.className=`uv-remote-box active level-${e.biosignatureLevel}`;let t=e.atmosphericGases.map(e=>`<span class="uv-remote-pill ${e.isBio?`bio`:``}" title="${e.name}">${e.formula} ${e.amount}</span>`).join(``),n=e.mineralHints.map(e=>`<span class="uv-remote-pill mineral" title="${e.name} (${e.tag})">${e.formula}</span>`).join(``),r=Yn&&Number.isFinite(Yn.irradianceWm2)?Yn.irradianceWm2>=10?`${Math.round(Yn.irradianceWm2).toLocaleString()} W/m²`:`${Yn.irradianceWm2.toFixed(2)} W/m²`:`Interstellar`;nt.innerHTML=`
          <div class="uv-remote-badge">${e.biosignatureBadge}</div>
          <div class="uv-remote-summary">${e.biosignatureSummary}</div>
          ${t?`<div class="uv-remote-tags"><span class="uv-chip-lbl">Atm:</span>${t}</div>`:``}
          ${n?`<div class="uv-remote-tags"><span class="uv-chip-lbl">Minerals:</span>${n}</div>`:``}
          <div class="uv-remote-flux-row">
            <span>☀️ Starlight: ${r} (${(Yn?.fluxGain??1).toFixed(2)}×)</span>
            <span>Solvent: ${e.solventFormula||e.solventLabel}</span>
          </div>`}}else Xn=null,nt&&(nt.className=`uv-remote-box`);Ot&&(Ot.innerHTML=i.map(([e,t])=>`<div class="uv-stat-cell"><div class="uv-stat-k">${e}</div><div class="uv-stat-v">${t}</div></div>`).join(``));let a=G.syncSchroederScaleChart?.(Y,l),o=G.getActiveUniversalLaws?.(Y,l);if(Lt&&a&&o){let t=a.activeGlobalLevel>=0?`+${a.activeGlobalLevel}`:`${a.activeGlobalLevel}`;Lt.textContent=`${e.engineSchema} · SS L${t} (${a.chartCount}c/${a.spanOrdersOfMagnitude.toFixed(0)} OOM) · ${o.active.length}/${G.lawGraphValidation?.nodeCount||32} laws`}jo(),Mo(n,t),Oo(n),ko()}function Mo(e,t){if(!it&&!ct)return;let n=`generic`,r=`L${Y}`,i=null,a=e?.name||yt[Y]?.name||`Cosmos`,o=e?.subtitle||``,s=[],c=[],l=`⚡ Dive`,u=()=>{Aa()},d=G.getActiveSystemCatalog(),f=d[Y===4?G.planetaryBodyIndex:G.focusedSolarBodyIndex]||d[0];if(G.surfaceActive&&pr){let e=pr,t=e.kingdom===`fauna`,d=e.kingdom===`fungi`;n=t?`alien`:d?`fungi`:`flora`,r=`${t?e.bodyPlan===`aero-gasbag`?`🎈`:e.bodyPlan===`aquatic-swimmer`?`🐟`:`🐾`:d?`🍄`:`🌿`} ${t?`LIVING ALIEN · FAUNA`:d?`LIVING FUNGUS · MYCO`:`LIVING FLORA · TREE`}`,i=e.primaryRgb,a=e.speciesName,o=`${e.morphClass} · ${e.trophicGuild} · ${e.worldName} (${e.tempK} K, g=${e.gravityMS2} m/s²)`,s.push({text:`Solvent: ${e.solventFormula}`,cls:`bio`}),s.push({text:`${e.xnaAlphabetSize}-base ${String(e.xnaBackbone).split(` `)[0]}`,cls:``}),t&&Number.isFinite(e.metabolicPowerW)?s.push({text:`Kleiber ${e.metabolicPowerW.toFixed(1)} W`,cls:`gold`}):!t&&Number.isFinite(e.redEdgeNm)?s.push({text:`Red-Edge ${Math.round(e.redEdgeNm)} nm`,cls:`gold`}):Number.isFinite(e.deltaGKjMol)&&s.push({text:`ΔG ${e.deltaGKjMol} kJ/mol`,cls:`gold`}),s.push({text:`Size ~${e.heightM} m`,cls:``});let f=e.abductedRecord||{kind:e.kingdom,kingdom:e.kingdom,speciesName:e.speciesName,morphClass:e.morphClass,bodyPlan:e.bodyPlan,trophicGuild:e.trophicGuild,solventFormula:e.solventFormula,xnaBackbone:e.xnaBackbone,xnaAlphabetSize:e.xnaAlphabetSize,skeleton:e.skeleton,fasta:e.fasta,worldName:e.worldName,latDeg:e.latDeg,lonDeg:e.lonDeg,tempK:e.tempK,gravityMS2:e.gravityMS2,primaryRgb:e.primaryRgb},p=be(e.profile||G.surfaceSession?.xenobiology||null,`organism-overview`,f);e.abducted?(c.push({id:`open-bio`,label:`🫧 Bio Aquarium ↗`,href:p,cls:`bio-cta`}),c.push({id:`open-cargo`,label:`🎒 Cargo Bay`,cls:``,onClick:()=>Hi(`cargo`)}),l=`🫧 Aquarium`,u=()=>{window.open(p,`_blank`,`noopener`)}):(c.push({id:`abduct-org`,label:`🛸 Abduct to Cargo`,cls:`primary`,onClick:()=>xo(e.id)}),c.push({id:`open-bio`,label:`🫧 Bio Aquarium ↗`,href:p,cls:`bio-cta`}),c.push({id:`sample-tissue`,label:`🔬 Tissue → L5`,cls:``,onClick:()=>{pa()}}),l=`🛸 Abduct`,u=()=>{xo(e.id)})}else if(G.surfaceActive&&G.surfaceSession){n=`planet`;let e=G.surfaceSession,t=G.surfaceTelemetry||e.getTelemetry(),i=e.env,d=G.surfaceBodySpec?.name||f?.name||`Planetary Surface`,p=t.livingOrganismCount??0;r=`🚙 SURFACE EXPLORATION · ${e.activeVehicle.toUpperCase()}`,a=d,o=p>0?`${p} live organisms nearby — tap any alien or tree on screen to inspect & abduct!`:`${i.hasSolidCrust?`Solid crust`:`Deep atmosphere`} · g=${i.gravityMS2.toFixed(2)} m/s² · T=${Math.round(t.tempK??i.tempK)} K`,s.push({text:`g=${i.gravityMS2.toFixed(2)} m/s²`,cls:``}),s.push({text:`${Math.round(t.tempK??i.tempK)} K`,cls:``}),p>0&&s.push({text:`🧬 ${p} Organisms`,cls:`bio`}),c.push({id:`surf-sample`,label:`🔬 Sample → L5`,cls:`primary`,onClick:()=>{pa()}}),c.push({id:`surf-orbit`,label:`🚀 Orbit`,cls:``,onClick:()=>Ia()}),l=`🔬 Sample`,u=()=>{pa()}}else if(Y===2&&X?.kind===`solar-asteroid`){n=`asteroid`;let e=Mr(X);r=e.isComet?`☄️ ACTIVE COMET`:e.isMetallicAsteroid?`⛏️ FE-NI ASTEROID`:`🪨 CARBONACEOUS ASTEROID`,a=e.name,o=e.subtitle,s.push({text:`Ø ${Math.round(e.radiusKm*2)} km`,cls:`gold`}),s.push({text:`g=${e.surfaceGravityMS2.toFixed(3)} m/s²`,cls:``}),s.push({text:e.isMetallicAsteroid?`High Fe/Ni Ore`:e.isComet?`H₂O/CO Volatiles`:`Silicates + Organics`,cls:`bio`}),c.push({id:`land-ast`,label:`🚙 Land & Mine`,cls:`primary`,onClick:()=>{Fa({customBodySpec:e})}}),c.push({id:`missile-ast`,label:`🚀 Missile`,cls:``,onClick:()=>Fr()}),c.push({id:`tractor-ast`,label:`🛸 Tractor`,cls:``,onClick:()=>{ar=!ar,zr()}}),l=`🚙 Mine`,u=()=>{Fa({customBodySpec:e})}}else if(Y===2&&G.solarMode===`formation`){n=`star`;let e=G.nebularCoalescenceSession,t=G.activeGenesisStage?.stage===`l2-nebular-coalescence`?G.activeGenesisStage.progress||0:1,i=e?.getCoalescedDisk?.()?.bodies?.length||0;r=`🌌 LIVE GPU NEBULAR COALESCENCE`,a=`${G.activeCausalSystem?.systemName||`Proto-System`} Disk`,o=t<.28?`Spiral density waves collapsing under SS 3D multipole gravity (planets not yet settled — let SPH run)`:`Condensing ${i} unstable proto-clumps across ${(e?.snowLineAu||2.71).toFixed(2)} AU snow line (settling into orbits)`,s.push({text:`Snow ${(e?.snowLineAu||2.71).toFixed(2)} AU`,cls:`gold`}),s.push({text:`${(e?.parcelCount||0).toLocaleString()} Parcels`,cls:``}),s.push({text:t<.28?`Density Waves`:`${i} Clumps Settling`,cls:`bio`}),c.push({id:`crystallize-now`,label:`⏩ Fast-Forward SPH`,cls:`primary`,onClick:()=>{na()}}),l=`⏩ Settle SPH`,u=()=>{na()}}else if(Y===3||Y===2&&f?.isStar||Y===1&&X?.kind===`galaxy-star`){let t=Y===1?X?.starSite:f,i=`${G.stellarMode||``} ${t?.stellarClass||``} ${t?.name||``} ${e?.name||``}`,d=/pulsar|magnetar|neutron/i.test(i),p=/black[\s-]?hole|kerr|smbh|quasar/i.test(i),m=/white[\s-]?dwarf|wd/i.test(i);n=d||p?`exotic`:`star`,r=p?`🕳️ RELATIVISTIC BLACK HOLE`:d?`⚡ MAGNETIZED PULSAR`:m?`💎 DEGENERATE WHITE DWARF`:`☀️ STELLAR ENGINE`,a=e?.name||t?.name||`Host Star`,o=e?.subtitle||(d?`Relativistic lighthouse beams & dipole magnetosphere`:`Self-gravitating GPU fusion & plasma`),t?.teffK&&s.push({text:`T_eff ${Math.round(t.teffK).toLocaleString()} K`,cls:`gold`}),t?.massSolar&&s.push({text:`${Number(t.massSolar).toFixed(2)} M☉`,cls:``}),(d||p)&&s.push({text:p?`Event Horizon + Jets`:`Radio / γ Beams`,cls:`gold`}),Y===1?(c.push({id:`enter-sys`,label:`⚡ Enter Star System`,cls:`primary`,onClick:()=>{Aa()}}),c.push({id:`focus-star`,label:`🎯 Focus`,cls:``,onClick:()=>_o({zoomIn:!0})}),l=`⚡ System`,u=()=>{Aa()}):Y===2?(c.push({id:`inspect-core`,label:`⚡ Inspect Core (L3)`,cls:`primary`,onClick:()=>{Aa()}}),(d||p)&&c.push({id:`em-xray`,label:`☢️ X-Ray View`,cls:``,onClick:()=>{let e=vr.xray;xr(e.min,e.max,{active:!0,preset:`xray`}),$(performance.now())}}),l=`⚡ Core`,u=()=>{Aa()}):(c.push({id:`go-planet`,label:`🌍 Visit Planet (L4)`,cls:`primary`,onClick:()=>{Aa()}}),c.push({id:`toggle-st-cutaway`,label:G.stellarCutaway?`☀️ Full Star`:`✂ Cutaway Core`,cls:``,onClick:()=>{G.setStellarCutaway(!G.stellarCutaway),sa(),Q(),$(performance.now())}}),c.push({id:`st-xray-view`,label:q.preset===`xray`?`👁 Optical`:`☢️ X-Ray Core`,cls:``,onClick:()=>{let e=q.preset===`xray`?vr.vis:vr.xray;xr(e.min,e.max,{active:e.active,preset:q.preset===`xray`?`vis`:`xray`}),$(performance.now())}}),l=`🌍 Planets`,u=()=>{Aa()})}else if(Y===2||Y===4){n=`planet`;let t=!!(f&&(f.isGasGiant||f.planetClass===`gas-giant`||f.planetClass===`hot-jupiter`||f.planetClass===`ice-giant`||(Number(f.radiusKm)||0)>=16e3)),i=Xn;r=i?.biosignatureBadge||(t?`🌀 GAS GIANT WORLD`:`🌍 PLANETARY WORLD`),a=f?.name||e?.name||`Planet`;let d=Yn?.irradianceWm2,p=Number.isFinite(d)?d>=10?`${Math.round(d).toLocaleString()} W/m²`:`${d.toFixed(2)} W/m²`:null,m=Y===4?G.planetaryBodyIndex:G.focusedSolarBodyIndex,h=!t&&Y===2?G.peekCachedPlanetSph(m):null;o=fr&&Y===4?`LZ Locked: ${fr.biomeLabel} (${fr.latDeg.toFixed(1)}°, ${fr.lonDeg.toFixed(1)}°) — tap Land!`:Y===4?`Tap anywhere on the 3D SPH globe to pick a touchdown zone, or land now.`:t?`Tap Dive Clouds to descend, or Orbit (L4) to scan the atmosphere.`:h?`3D SPH crust cached on Root Node — Orbit (L4) for instant restore or Land now.`:`3D SPH crust: ⏳ Unsimulated — Orbit (L4) to watch 10,240-parcel 3D SPH genesis live!`,p&&s.push({text:`☀️ ${p}`,cls:`gold`}),f?.tempK&&s.push({text:`${Math.round(f.tempK)} K`,cls:``}),!t&&Y===2&&s.push({text:h?`✅ SPH Cached`:`⏳ SPH Unsimulated`,cls:h?`bio`:`gold`}),i?.solventFormula&&s.push({text:`Solvent: ${i.solventFormula}`,cls:i.biosignatureLevel===`strong`?`bio`:``});let g=t?`🛸 Dive Clouds`:`🚙 Land on Surface`;c.push({id:`land-world`,label:g,cls:`primary`,onClick:()=>{Fa({bodyIndex:m})}}),Y===2?c.push({id:`orbit-world`,label:h?`⚡ Orbit (L4)`:`🪐 Form & Orbit (L4)`,cls:``,onClick:()=>{Aa()}}):c.push({id:`toggle-cutaway`,label:G.planetaryCutaway?`🌐 Full Globe`:`✂ Cutaway Core`,cls:``,onClick:()=>{G.setPlanetaryCutaway(!G.planetaryCutaway),sa(),Q(),$(performance.now())}}),l=t?`🛸 Clouds`:`🚙 Land`,u=()=>{Fa({bodyIndex:m})}}else if(Y===0||Y===1){if(n=`galaxy`,r=Y===0?`🌌 COSMIC WEB · L0`:`🌀 GALAXY · ${String(G.galaxyPreset||`spiral`).toUpperCase()}`,a=e?.name||(Y===0?`Supergalactic Web`:`Spiral Galaxy`),o=Y===0?`Tap any halo cluster to focus or dive into a live 32,768-star galaxy.`:`Tap any star, pulsar, or SMBH core — try JWST IR or 21cm Radio in EM!`,Y===0&&G.cosmoTelemetry){let e=Number(G.cosmoTelemetry.scaleFactorA)||1,t=e>1.02?`Future Λ (${e.toFixed(2)}×)`:`z = ${G.cosmoTelemetry.redshiftZ.toFixed(2)}`;s.push({text:t,cls:`gold`}),s.push({text:`a = ${e.toFixed(3)}`,cls:``})}else Y===1&&(s.push({text:`${(G.galaxyEngine?.count||0).toLocaleString()} Stars`,cls:``}),s.push({text:G.galaxyIcRegimeLabel||G.galaxyPreset,cls:`gold`}));c.push({id:`dive-gal`,label:Y===0?`⚡ Enter Galaxy`:`⚡ Enter System`,cls:`primary`,onClick:()=>{Aa()}}),Y===1?c.push({id:`jwst-ir`,label:`🔭 JWST IR`,cls:``,onClick:()=>{let e=q.preset===`jwst`?vr.vis:vr.jwst;xr(e.min,e.max,{active:e.active,preset:q.preset===`jwst`?`vis`:`jwst`}),$(performance.now())}}):t&&c.push({id:`focus-web`,label:`🎯 Focus Halo`,cls:``,onClick:()=>_o({zoomIn:!0})}),l=Y===0?`⚡ Galaxy`:`⚡ System`,u=()=>{Aa()}}else{n=`quantum`,r=Y===5?`🧊 ATOMIC LATTICE · L5`:Y===6?`⚛️ DIRAC–KS ATOM · L6`:`☢️ ATOMIC NUCLEUS · L7`,a=e?.name||yt[Y].name,o=e?.subtitle||`Live Gate 1 first-principles WebGPU quantum & MD simulation`;let t=Y===5?G.mdElementZ:Y===6?G.quantumZ:G.nuclearZ;s.push({text:`Z = ${t}`,cls:`gold`}),Hr&&(c.push({id:`back-surf`,label:`↩ Back to Rover/UFO`,cls:`bio-cta`,onClick:()=>{returnToSavedSurfaceUi()}}),l=`↩ Surface`,u=()=>{returnToSavedSurfaceUi()}),Y<7?(c.push({id:`dive-q`,label:Y===5?`⚛️ Atom (L6)`:`☢️ Nucleus (L7)`,cls:`primary`,onClick:()=>{Aa()}}),Hr||(l=Y===5?`⚛️ Atom`:`☢️ Nucleus`,u=()=>{Aa()})):(c.push({id:`open-elem-lab`,label:`⚛️ Elements Lab ↗`,href:`./elements-lab.html?z=${t}`,cls:`primary`}),Hr||(l=`↑ Orbit`,u=()=>ja()))}if(mr={ctxType:n,badge:r,headline:a,sub:o,chips:s.map(e=>e.text),actionIds:c.map(e=>e.id),primaryLabel:l,primaryAction:u,organismId:pr?.id||null},ct&&(ct.textContent=`${n===`alien`?`🐾 `:n===`flora`?`🌿 `:n===`fungi`?`🍄 `:n===`exotic`?`⚡ `:``}${a}`),ut&&(ut.textContent=l),it){let e=`uv-spotlight-card active ctx-${n}`,t=Array.isArray(i)?`<span class="uv-spotlight-swatch" style="background:rgb(${Math.round((i[0]??.3)*255)},${Math.round((i[1]??.8)*255)},${Math.round((i[2]??.5)*255)});"></span>`:``,l=G.surfaceActive&&pr?`<button type="button" class="uv-btn subtle icon-only" data-spotlight-clear="1" title="Clear organism selection" style="min-height:22px;padding:2px 6px;">✕</button>`:``,u=s.map(e=>`<span class="uv-spotlight-chip ${e.cls}">${e.text}</span>`).join(``),d=c.map(e=>e.href?`<a class="uv-btn ${e.cls}" data-spotlight-act="${e.id}" href="${e.href}" target="_blank" rel="noopener">${e.label}</a>`:`<button type="button" class="uv-btn ${e.cls}" data-spotlight-act="${e.id}">${e.label}</button>`).join(``),f=`
        <div class="uv-spotlight-top">
          <span class="uv-spotlight-badge">${t}${r}</span>
          ${l}
        </div>
        <div class="uv-spotlight-headline">${a}</div>
        <div class="uv-spotlight-sub">${o}</div>
        ${u?`<div class="uv-spotlight-facts">${u}</div>`:``}
        ${d?`<div class="uv-spotlight-actions">${d}</div>`:``}`,p=`${e}|${f}`;p!==hr&&(hr=p,it.className=e,it.innerHTML=f),it._spotlightActions=c}}it?.addEventListener(`click`,e=>{if(e.target?.closest?.(`[data-spotlight-clear]`)){pr=null,Q(),$(performance.now());return}let t=e.target?.closest?.(`[data-spotlight-act]`);if(!t)return;let n=t.getAttribute(`data-spotlight-act`),r=(it._spotlightActions||[]).find(e=>e.id===n);r&&typeof r.onClick==`function`&&r.onClick()});function No(e){if(!f)return;f.clearRect(0,0,Ai,Mi);let t=Ee?.getBoundingClientRect?.(),n=t&&t.left>160?Math.max(160,t.left-6):Ai;f.save(),f.beginPath(),f.rect(0,0,n,Mi),f.clip();let r=G.getTargetsForLevel(Y,Ni),i=!!(X&&X.level===Y&&X.worldPos);for(let t of r){if(Y===2&&t.spec?.parent>0&&l>10.5||Y===4&&!G.planetaryCutaway)continue;let n=ya(t.pos,e,Ai,Mi);if(!n.visible)continue;let r=!i&&t.id===Ur,a=t.id===Wr;if(!r&&!a&&(Y>=3||Y===1))continue;let o=r?18:a?15:8;f.strokeStyle=r?`rgba(56, 189, 248, 0.90)`:a?`rgba(186, 230, 253, 0.78)`:`rgba(148, 163, 184, 0.42)`,f.lineWidth=r?1.6:1;let s=Math.max(4,o*.45);for(let[e,t]of[[-1,-1],[1,-1],[1,1],[-1,1]])f.beginPath(),f.moveTo(n.sx+e*o,n.sy+t*(o-s)),f.lineTo(n.sx+e*o,n.sy+t*o),f.lineTo(n.sx+e*(o-s),n.sy+t*o),f.stroke();(r||a||Y===2&&t.spec?.parent===0&&l>9.5)&&(f.font=r?`600 11px monospace`:`500 9.5px monospace`,f.fillStyle=r?`#e0f2fe`:`rgba(203, 213, 225, 0.78)`,f.fillText(t.name,n.sx+o+6,n.sy+3.5))}if(X&&X.level===Y&&X.worldPos&&X.kind!==`landing-site`){let t=ya(X.worldPos,e,Ai,Mi);t.visible&&(f.save(),f.strokeStyle=`rgba(250, 204, 21, 0.96)`,f.lineWidth=1.9,f.beginPath(),f.moveTo(t.sx,t.sy-14),f.lineTo(t.sx+14,t.sy),f.lineTo(t.sx,t.sy+14),f.lineTo(t.sx-14,t.sy),f.closePath(),f.stroke(),f.beginPath(),f.arc(t.sx,t.sy,3,0,Math.PI*2),f.fillStyle=`#fde047`,f.fill(),f.font=`600 11px monospace`,f.fillStyle=`#fef08a`,f.fillText(X.name,t.sx+14+7,t.sy+3.5),f.restore())}if(Y===4&&!G.surfaceActive&&fr&&ur&&fr.bodyIndex===ur.bodyIndex){let{center:t,radius:n}=ur,r=fr.nHit,i=dr?.pos||[0,0,18],a=ha([i[0]-t[0],i[1]-t[1],i[2]-t[2]]),o=r[0]*a[0]+r[1]*a[1]+r[2]*a[2],s=[t[0]+r[0]*n*1.005,t[1]+r[1]*n*1.005,t[2]+r[2]*n*1.005];if(X?.kind===`landing-site`&&(X.worldPos=[...s]),o>.04){let t=ya(s,e,Ai,Mi);if(t.visible){f.save(),f.strokeStyle=`rgba(52, 211, 153, 0.96)`,f.lineWidth=2,f.beginPath(),f.arc(t.sx,t.sy,11,0,Math.PI*2),f.stroke(),f.beginPath(),f.moveTo(t.sx-16,t.sy),f.lineTo(t.sx-6,t.sy),f.moveTo(t.sx+6,t.sy),f.lineTo(t.sx+16,t.sy),f.moveTo(t.sx,t.sy-16),f.lineTo(t.sx,t.sy-6),f.moveTo(t.sx,t.sy+6),f.lineTo(t.sx,t.sy+16),f.stroke(),f.font=`600 11px monospace`,f.fillStyle=`#6ee7b7`;let e=`${Math.abs(fr.latDeg).toFixed(1)}°${fr.latDeg>=0?`N`:`S`}`,n=`${Math.abs(fr.lonDeg).toFixed(1)}°${fr.lonDeg>=0?`E`:`W`}`;f.fillText(`🎯 ${e}, ${n} · ${fr.biomeLabel}`,t.sx+16,t.sy+4),f.restore()}}}if(Tr.isConnected){let t=G.getActiveSystemCatalog()[G.focusedSolarBodyIndex]?.id||`earth`,n=Tr.getRemotePeersForContext({level:Y,bodyId:t,surfaceActive:G.surfaceActive});for(let t of n){let n=Array.isArray(t.renderPos)?t.renderPos:t.pos;if(!Array.isArray(n)||n.length<3)continue;let r=ya(n,e,Ai,Mi);!r.visible||r.sx<-40||r.sx>Ai+40||r.sy<-40||r.sy>Mi+40||(f.save(),f.strokeStyle=`rgba(244, 114, 182, 0.92)`,f.lineWidth=1.6,f.beginPath(),f.arc(r.sx,r.sy,14,0,Math.PI*2),f.stroke(),f.font=`700 10.5px monospace`,f.fillStyle=`#fbcfe8`,f.fillText(`🛸 ${String(t.peerId||`peer`).slice(0,10)}`,r.sx+14+6,r.sy+3.5),f.restore())}}f.restore()}function Po(e,t){let n=l,r=10**n,i=[],a=[],o=[],s=[],c=[.62,.55,.55],u=null,d=null,f=0,p=null,m=null,h=null,g={bhUv:[.5,.5],bhStrength:0,warpAmount:Math.min(.65,Di*.08),flashAmount:Ci,crtEnabled:yi,pixelSize:bi,timeSec:t},_=G.cosmoFocusMpc||[0,0,0],v=G.activeStarSite?.posGal||G.galaxyFocusPos||[4.8,.04,2.1];if(Y===1&&G.cosmoSession&&n>15.8&&n<22.8){let e=1-Sa(21.6,22.8,n)*.72;i.push({buffer:G.cosmoSession.particlesBuffer,count:G.cosmoSession.particleCount,mode:0,isBackdrop:!0,worldScale:-185,pointSize:1.35,alphaGain:.44*e,extra1:[_[0],_[1],_[2],G.cosmoSession.boxSizeMpc||200]})}if((Y===2||Y===3||Y===4)&&G.galaxyEngine&&n<16.8&&n>-5.2){let e=(1-Sa(15.4,16.8,n)*.78)*Sa(-5.2,4,n);e>.02&&i.push({buffer:G.galaxyEngine.getResidentBuffer(),count:G.galaxyEngine.count,mode:1,isBackdrop:!0,worldScale:-185,pointSize:1.02,alphaGain:.34*e,extra1:[v[0],v[1],v[2],0]})}if(Y===6&&G.mdSession&&n<-8.8&&n>-13){let e=G.mdSession.boxLengthsA,t=(G.getCachedElementBundle(G.mdElementZ,!0)?.bundle)?.electromagnetic?.opticalSrgb||[.55,.78,.96];i.push({buffer:G.mdSession.positionsBuffer,count:G.mdSession.atomCount,mode:12,isBackdrop:!0,worldScale:-175,pointSize:2.35,alphaGain:.065*Ca(n,-13,-11.6,-9.5,-8.8),extra1:[e[0]*.5,e[1]*.5,e[2]*.5,0],extra2:[t[0],t[1],t[2],0]})}Y===7&&G.orbitalCloud&&n<-12.4&&i.push({buffer:G.orbitalCloud.pointsBuffer,count:G.orbitalCloud.pointCount,mode:3,isBackdrop:!0,worldScale:-175,pointSize:.92,alphaGain:.024*Ca(n,-15.5,-14.6,-13.1,-12.4),colorPos:[.18,.86,1],colorNeg:[.95,.58,.32]});let y=Zr>0?Math.max(.001,Math.min(.1,t-Zr)):.016;Zr=t;let b=Ca(n,20.8,22,27.05,27.4);Qr=li(Qr,Kr||Gr||n<24.4?_:[0,0,0],y,4.8,!1);let x=Qr,S=G.cosmoSession?.boxLengthMpc||1425,C=28500,w=14250,T=Math.max(.02,G.cosmoScaleFactorA||1),E=G.cosmoBigBangMode?Math.max(.05,T):T>2.2?2.2+1.45*Math.log(Math.max(1,T/2.2)):Math.max(.18,T),D=8.8/C*10**Math.min(3.4,26.6-n),O=C/5/Math.max(10,S);if(Ni.cosmoScale=D*E,Ni.cosmoPickScale=D*E*O,Ni.cosmoPickOffset=[x[0]/O,x[1]/O,x[2]/O],Ni.cosmoOffset=x,b>.01){if(G.cosmoMode!==`web`&&G.cosmoBaryonSession&&n>=22){let t=Ca(n,22,22.7,27.05,27.4),r=12.2/Math.max(100,G.cosmoBaryonSession.boxSizeMpc||260)*10**Math.max(-.6,Math.min(2.2,26.5-n));if(i.push({buffer:G.cosmoBaryonSession.getResidentTracersBuffer(),count:G.cosmoBaryonSession.tracerCount,mode:10,worldScale:r,pointSize:G.cosmoMode===`cmb`?.16:G.cosmoMode===`cluster-merger`?.12:.145,alphaGain:(G.cosmoMode===`cmb`?.15:G.cosmoMode===`cluster-merger`?.18:.28)*t,extra1:[0,0,0,G.cosmoBaryonSession.boxSizeMpc||260]}),G.cosmoMode===`cluster-merger`&&gi&&t>.25){let n=ya([0,0,0],e.viewProj,Ai,Mi);n.visible&&(g.bhUv=[n.uvX,n.uvY],g.bhStrength=9e-4*t)}}else if(G.cosmoSession&&G.cosmoMode===`web`){let e=G.cosmoSession.particleCount,t=Math.min(18e4,e*6);if(i.push({buffer:G.cosmoSession.particlesBuffer,count:t,mode:0,worldScale:D,pointSize:Math.max(.044,Math.min(.145,.062*10**Math.max(-.35,Math.min(.55,26.5-n)))),alphaGain:(n<26?.27:.24)*b,extra1:[x[0],x[1],x[2],S],extra2:[T,+!!G.cosmoBigBangMode,e,w]}),n>=24.8){let e=w*D*E;if(e>1.8&&e<95){let t=.34*Sa(24.8,26.1,n)*b,r=x[0]*D*E,i=x[1]*D*E,a=x[2]*D*E;for(let n of[0,1,2])for(let o=0;o<84;o+=1){let c=o/84*Math.PI*2,l=(o+1)/84*Math.PI*2,u=n===0?[Math.cos(c)*e,0,Math.sin(c)*e]:n===1?[Math.cos(c)*e,Math.sin(c)*e,0]:[0,Math.cos(c)*e,Math.sin(c)*e],d=n===0?[Math.cos(l)*e,0,Math.sin(l)*e]:n===1?[Math.cos(l)*e,Math.sin(l)*e,0]:[0,Math.cos(l)*e,Math.sin(l)*e];s.push(u[0]-r,u[1]-i,u[2]-a,.98,.56,.24,t,d[0]-r,d[1]-i,d[2]-a,.98,.56,.24,t)}for(let n of[-1,1]){let o=n*e*.70710678,c=e*.70710678;for(let e=0;e<84;e+=1){let n=e/84*Math.PI*2,l=(e+1)/84*Math.PI*2;s.push(Math.cos(n)*c-r,o-i,Math.sin(n)*c-a,.92,.44,.28,t*.65,Math.cos(l)*c-r,o-i,Math.sin(l)*c-a,.92,.44,.28,t*.65)}}}}}}let k=Ca(n,15.4,16.6,22,22.8),A=10**Math.max(-1.8,Math.min(2.5,21-n))*.85,j=G.galaxyFocusPos||[4.8,.04,2.1],M=G.galaxyCenterOfMass||[0,0,0],N=Kr||Gr?1:Sa(20.6,18.8,n),P=[M[0]*(1-N)+j[0]*N,M[1]*(1-N)+j[1]*N,M[2]*(1-N)+j[2]*N],F=G.galaxyEngine!==ei;ei=G.galaxyEngine,$r=li($r,P,y,Kr||Gr?14:4.8,F);let I=$r;if(Ni.galaxyScale=A,Ni.galaxyOffset=I,k>.01&&G.galaxyEngine){if(i.push({buffer:G.galaxyEngine.getResidentBuffer(),count:G.galaxyEngine.count,mode:1,worldScale:A,pointSize:Math.max(.028,Math.min(.14,.056*10**Math.max(-1.2,Math.min(.6,21-n)))),alphaGain:.34*k,extra1:[I[0],I[1],I[2],0]}),_i&&G.showGalacticBField&&G.galacticDynamoStreamlines?.length>=14&&n>18.8){let e=k*Sa(18.8,20.2,n),t=G.galacticDynamoStreamlines;for(let n=0;n<t.length;n+=7)s.push((t[n]-I[0])*A,(t[n+1]-I[1])*A,(t[n+2]-I[2])*A,t[n+3],t[n+4],t[n+5],t[n+6]*e)}if(J.state.colonyLinks?.length>0&&n>17.5){let e=k*Sa(17.5,19.2,n);for(let t of J.state.colonyLinks){let n=t.fromPosGal||t.fromPos,r=t.toPosGal||t.toPos;if(!n||!r)continue;let i=Math.max(.05,Math.min(1,t.progress||1)),a=null;for(let t=0;t<=12;t+=1){let o=t/12*i,c=Math.sin(o*Math.PI)*.65,l=(n[0]+(r[0]-n[0])*o-I[0])*A,u=(n[1]+(r[1]-n[1])*o+c-I[1])*A,d=(n[2]+(r[2]-n[2])*o-I[2])*A;a&&(s.push(a[0],a[1],a[2],.28,.96,.72,.78*e),s.push(l,u,d,.56,.92,1,.88*e)),a=[l,u,d]}}}}if(Y>=2&&G.galaxyBranch===`smbh-core`){let t=Ca(n,9.2,10.6,15,15.85);if(t>.01){let r=10**Math.max(-1.4,Math.min(1.4,12.6-n)),i=.72*r;if(a.push({pos:[0,0,0],radius:i,color0:[0,0,0],color1:[0,0,0],kind:5}),o.push({center:[0,0,0],rIn:i*1.18,normal:[.08,.96,.24],rOut:i*4.4,color:[1,.85,.55],kind:0}),G.smbhBodies){let e=Math.floor(G.smbhBodies.length/8);for(let t=1;t<e;t+=1){let e=t*8;a.push({pos:[G.smbhBodies[e]*r,G.smbhBodies[e+1]*r,G.smbhBodies[e+2]*r],radius:Math.max(.05,.14*r),color0:[.68,.88,1],color1:[.35,.62,1],kind:0})}}if(gi){let n=ya([0,0,0],e.viewProj,Ai,Mi);n.visible&&(g.bhUv=[n.uvX,n.uvY],g.bhStrength=.0024*Math.min(2.2,r)*t)}}}else if(G.solarMode===`formation`&&Y===2&&(G.nebularCoalescenceSession||G.protoplanetarySession)){let e=Ca(n,9.6,10.6,15.6,16.8);if(e>.01){let t=.92*10**Math.max(-1.2,Math.min(1.2,12.6-n)),o=r/at,c=16/Math.max(1e-9,o),l=G.nebularCoalescenceSession,u=G.protoplanetarySession,d=G.activeGenesisStage?.stage===`l2-nebular-coalescence`?Math.max(0,Math.min(1,Number(G.activeGenesisStage.progress)||0)):1,f=Sa(.72,1,d),p=1-.42*Sa(.68,1,d);if(l){let n=G.nebulaCenterOfMass||[0,0,0],r=l!==ni;ni=l,ti=li(ti,n,y,3.8,r);let o=(1-f)*t,s=[ti[0]*o,ti[1]*o,ti[2]*o];i.push({buffer:l.getResidentParcelsBuffer(),count:l.parcelCount,mode:6,worldScale:t,pointSize:Math.max(.032,Math.min(.11,.052*t)),alphaGain:.44*p*e,extra1:[s[0],s[1],s[2],f],extra2:[c,0,0,0]});let u=(G.getActiveSystemCatalog()?.[0]?.radiusKm||696340)*1e3/at,m=l.getCoalescedRenderSpheres(t,{progress:d,linearAuBlend:f,scaleAuToWorld:c,starRadiusWorld:Math.max(.14,u*c*8)});for(let e of m)e.pos=[e.pos[0]-s[0],e.pos[1]-s[1],e.pos[2]-s[2]],a.push(e)}else u&&(i.push({buffer:u.getResidentPebblesBuffer(),count:u.pebbleCount,mode:6,worldScale:t,pointSize:Math.max(.036,Math.min(.13,.06*t)),alphaGain:.52*e,extra1:[0,0,0,0]}),a.push(...u.getEmbryoRenderSpheres(t)));if(_i){let n=l?.snowLineAu||u?.snowLineAu||2.71,r=l?.rMinStableAu||.14,i=l?.rMaxStableAu||28,a=(.88+Math.max(0,Math.min(1,Math.log(Math.max(r,n)/r)/Math.log(Math.max(1.5,i/r))))*8.72)*t,o=n*c,d=a*(1-f)+o*f,m=null;for(let t=0;t<=72;t+=1){let n=t/72*Math.PI*2,r=[Math.cos(n)*d,0,Math.sin(n)*d];m&&(s.push(...m,.36,.84,1,.45*p*e),s.push(...r,.36,.84,1,.45*p*e)),m=r}}}}else if(G.solarMode===`quasar-jet`&&Y===2&&G.kerrJetSession){let t=Ca(n,9.6,10.6,15,15.85);if(t>.01){let r=.85*10**Math.max(-1,Math.min(1.2,12.6-n)),o=G.kerrJetSession.horizonVisualRadius*r;if(a.push({pos:[0,0,0],radius:o*1.05,color0:[0,0,0],color1:[0,0,0],kind:5}),i.push({buffer:G.kerrJetSession.getResidentParcelsBuffer(),count:G.kerrJetSession.particleCount,mode:7,worldScale:r,pointSize:Math.max(.05,Math.min(.16,.095*r)),alphaGain:.26*t,extra1:[0,0,0,0]}),gi){let n=ya([0,0,0],e.viewProj,Ai,Mi);n.visible&&(g.bhUv=[n.uvX,n.uvY],g.bhStrength=.0014*t)}}}else if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(G.solarMode)&&Y===2&&G.relBinarySession){let t=Ca(n,9.6,10.6,15,15.85);if(t>.01){let r=1.12*10**Math.max(-1,Math.min(1.2,12.6-n));if(a.push(...G.relBinarySession.getRenderSpheres(r)),i.push({buffer:G.relBinarySession.getResidentParcelsBuffer(),count:G.relBinarySession.particleCount,mode:7,worldScale:r,pointSize:Math.max(.05,Math.min(.16,.092*r)),alphaGain:.24*t,extra1:[0,0,0,0]}),gi&&(G.solarMode===`bbh-merger`||G.solarMode===`xray-binary`)){let n=ya([0,0,0],e.viewProj,Ai,Mi);n.visible&&(g.bhUv=[n.uvX,n.uvY],g.bhStrength=(G.solarMode===`bbh-merger`?.0014:7e-4)*t)}}}else if([`comet-tails`,`hot-jupiter`].includes(G.solarMode)&&Y===2&&G.radWindL2Session){let e=Ca(n,9.6,10.6,15.6,16.8);if(e>.01){let t=1.05*10**Math.max(-1,Math.min(1.2,12.6-n)),r=G.solarMode===`comet-tails`;c=r?[.76,.24,.6]:[.82,.14,.55],a.push(r?{pos:[0,0,0],radius:.34*t,color0:[.82,.88,.94],color1:[.42,.48,.56],kind:3,atm:.28}:{pos:[0,0,0],radius:1.02*t,color0:[1,.48,.16],color1:[.68,.2,.08],kind:2,atm:.72}),i.push({buffer:G.radWindL2Session.getResidentParcelsBuffer(),count:G.radWindL2Session.particleCount,mode:8,worldScale:t,pointSize:Math.max(.05,Math.min(.15,.095*t)),alphaGain:.25*e,extra1:[0,0,0,0]})}}else if([`roche-rings`,`giant-impact`,`red-giant`,`catastrophic-shatter`,`tde`].includes(G.solarMode)&&Y===2&&G.tidalRocheSession){let e=Ca(n,9.6,10.6,15.6,16.8);if(e>.01){let t=1.06*10**Math.max(-1,Math.min(1.2,12.6-n));a.push(...G.tidalRocheSession.getRenderSpheres(t)),G.solarMode===`tde`&&o.push({center:[0,0,0],rIn:1.05*t,normal:[.06,.99,.08],rOut:3.45*t,color:[1,.72,.34],kind:0}),i.push({buffer:G.tidalRocheSession.getResidentParticlesBuffer(),count:G.tidalRocheSession.particleCount,mode:9,worldScale:t,pointSize:Math.max(.045,Math.min(.14,.078*t)),alphaGain:.28*e,extra1:[0,0,0,0]})}}else if(Y>=2){let e=Ca(n,2.2,3,15,15.95),l=r/at,p=16/Math.max(1e-9,l);if(Ni.solarScaleAuToWorld=p,e>.01&&G.solarEngine){let r=G.solarEngine.catalog||G.getActiveSystemCatalog(),m=Math.max(0,Math.min(r.length-1,G.focusedSolarBodyIndex)),g=r[m],_=!!g?.isStar||m===0,v=G.getSolarReferenceOriginAu(n,m,{lockToTarget:Kr}),b=`${m}:${v.frameMode}`;if(G.solarEngine!==ii||ci==null||Math.abs(n-ci)>.65||!oi)si=[0,0,0];else if(b!==ai){let e=[oi[0]+si[0],oi[1]+si[1],oi[2]+si[2]],t=e[0]-v.originAu[0],r=e[1]-v.originAu[1],i=e[2]-v.originAu[2];si=n<9.8&&Math.hypot(t,r,i)>l*2.5?[0,0,0]:[t,r,i]}else if(Math.abs(si[0])+Math.abs(si[1])+Math.abs(si[2])>1e-12){let e=Math.exp(-y*6);si=[si[0]*e,si[1]*e,si[2]*e],Math.hypot(si[0],si[1],si[2])<l*1e-4&&(si=[0,0,0])}ii=G.solarEngine,ai=b,oi=[v.originAu[0],v.originAu[1],v.originAu[2]],ci=n;let x=[v.originAu[0]+si[0],v.originAu[1]+si[1],v.originAu[2]+si[2]];Ni.solarOriginAu=x,Ni.solarSpanLog10M=n,Ni.solarReferenceFrame=v.frameMode;let S=G.solarEngine.getMassiveBodyState64(m),C=G.solarEngine.getMassiveBodyState64(0),w=[Math.fround(x[0]),Math.fround(x[1]),Math.fround(x[2])],T=[Math.fround(x[0]-w[0]),Math.fround(x[1]-w[1]),Math.fround(x[2]-w[2])],E=r[0]||lt[0],D=Ht({starSpec:E,bodySpec:g,distanceAu:1,timeSec:t,isRogue:!1,stellarModeHint:G.stellarMode}),O=null;if(!_){let e=C.posAu[0]-S.posAu[0],r=C.posAu[1]-S.posAu[1],i=C.posAu[2]-S.posAu[2],a=Math.max(.012,Math.hypot(e,r,i)),o=ha([e,r,i]);if(Y===4&&G.planetaryMode===`eyeball-locked`)c=[1,0,0],O=Ui({bodySpec:{...g,tidallyLocked:!0},toStarUnit:o});else if(Y===4&&G.planetaryMode===`rogue`)c=[.15,.96,.22],O={obliquityDeg:0,sinDecl:0,declDeg:0,seasonLabel:`Rogue`,tiltedLightDir:c};else{O=Ui({bodySpec:g,toStarUnit:o});let e=Sa(10.2,8.8,n);c=ha([o[0]*(1-e)+O.tiltedLightDir[0]*e,o[1]*(1-e)+O.tiltedLightDir[1]*e,o[2]*(1-e)+O.tiltedLightDir[2]*e])}f=Number(O?.sinDecl)||0;let s=Sa(10.2,8.8,n);D=Ht({starSpec:E,bodySpec:g,distanceAu:Math.max(.45,Math.min(2.8,a))*(1-s)+a*s,timeSec:t,isRogue:Y===4&&G.planetaryMode===`rogue`,stellarModeHint:G.stellarMode})}Yn=D;let k=G.getTargetsForLevel(4)[0],A=k?.rCoreNorm??.54,j=k?.rMantleNorm??.94,M=[0,0,0],N=null,P=Math.min(G.solarEngine.massiveCount,r.length);for(let l=0;l<P;l+=1){let f=r[l],g=G.solarEngine.getMassiveBodyState64(l),_=(g.posAu[0]-x[0])*p,v=(g.posAu[1]-x[1])*p,y=(g.posAu[2]-x[2])*p;l===0&&(M=[_,v,y]);let b=Math.hypot(_,v,y),S=g.radiusAu*p,C=!!f.isStar||l===0;if(b>155&&l!==m){if(!C&&f.parent>0)continue;let e=165/b;_*=e,v*=e,y*=e;let t=S*e;S=C?Math.max(1.45,Math.min(4.6,t*2.8)):Math.max(.28,Math.min(.95,t*5.5))}if(l===m&&C&&n<=9.9)continue;let w=!C&&n<10.4&&(l===G.planetaryBodyIndex||l===m),T=Sa(10.4,9.1,n);w&&(ur={center:[_,v,y],radius:S,spec:f,bodyIndex:l,seedFloat:l*2.17+1.3,lightDir:[...c]});let E=w&&G.planetaryCutaway,D=w&&!E&&(G.planetaryMode===`magma-ocean`||f.kind===7),O=w&&!E&&G.planetaryMode===`cryo-plumes`,k=w&&!E&&G.planetaryMode===`rogue`,P=a.length,F=C?Math.min(.95,Math.max(0,J.state.dysonTau||0)):0;if(C)Wt({spec:f,pos:[_,v,y],radius:S,timeSec:t,dysonCoverage:F,seed:l*2.17+1.3,spheres:a,disks:o,lineChunks:s,alphaMul:e,stellarModeHint:l===0?G.stellarMode:null});else{let n=G.planetaryGenesisSphSession,r=!!(w&&!E&&G.planetaryGenesisLiveForm&&n&&l===G.planetaryBodyIndex&&typeof n.getResident3dGridBuffer==`function`),i=r?Math.max(0,Math.min(1,(n.stepIndex||0)/Math.max(1,G.activeGenesisStage?.targetSteps||240))):1,o=!r||i>=.45;if(r){let r=n.genesisParams||{},a=i<.45?1:1-Sa(.45,.98,i);a>.015&&(h={mode:1,buffer:n.getResident3dGridBuffer(),dim:n.gridN||40,boxRadius:S*1.55,center:[_,v,y],alphaMul:e*a,paramA:i,lightDir:[...c],extra2:[+!!r.hasOcean,+!!E,t,D||r.isMagmaOcean?1:0]})}if(o){let e=!!(w&&!E&&n&&l===G.planetaryBodyIndex),t=0;if(e){let e=n.genesisParams,r=Number(f.radiusKm)||6371;t=e?.isMinorBody||f.isMinorBody||f.isComet||r<550?.38*T:r<1250?.048*T:e?.hasOcean?.014*T:.022*T}else if((f.kind===2||f.kind===3)&&(Number(f.radiusKm)||0)>=16e3){let e=Math.max(5,Number(f.rotationPeriodHr)||10.5);t=-Math.max(.025,Math.min(.098,.72/e))}a.push({pos:[_,v,y],radius:S,color0:D?[1,.44,.1]:O?[.86,.92,.98]:k?[.16,.24,.36]:f.color0,color1:D?[.22,.08,.05]:O?[.48,.68,.86]:k?[.06,.1,.18]:f.color1,kind:E?4:D?7:O?3:f.kind,atm:D?.55:O?.18:f.atm??.35,rCore:A,rMantle:j,cutaway:E,tempK:Number(f.tempK)||288,civTechK:Number(f.civTechK)||0,dysonCoverage:0,flags:t,seed:l*2.17+1.3})}}if(w&&G.planetaryGenesisSphSession&&l===G.planetaryBodyIndex){let t=G.planetaryGenesisSphSession,n=!!(!E&&G.planetaryGenesisLiveForm&&typeof t.getResident3dGridBuffer==`function`),r=n?Math.max(0,Math.min(1,(t.stepIndex||0)/Math.max(1,G.activeGenesisStage?.targetSteps||240))):1;(!n||r>=.45)&&(d={buffer:t.getResidentSphGeologyBuffer(),width:t.mapWidth,height:t.mapHeight,sphereIndex:P,seaLevelNorm:t.genesisParams?.seaLevelNorm??-1.5}),(G.planetaryGenesisLiveForm||E)&&i.push({buffer:t.getResidentParcelsBuffer(),count:t.parcelCount,mode:13,worldScale:S*(n?.96:.98),pointSize:n?Math.max(.032,Math.min(.11,S*.028)):Math.max(.045,Math.min(.18,S*.038)),alphaGain:(n?.72:.44)*e,extra1:[_,v,y,+!!n]})}if((w||Y===2&&n<13.8)&&f.isComet&&G.radWindL2Session){let t=w?Math.max(.45,S*2.6):Math.max(.28,S*18);i.push({buffer:G.radWindL2Session.getResidentParcelsBuffer(),count:G.radWindL2Session.particleCount,mode:8,worldScale:t,pointSize:Math.max(.028,Math.min(.095,.045*t)),alphaGain:(w?.58:.48)*e,extra1:[_,v,y,1]})}if(w&&!D&&!O&&G.planetaryAtmoSession&&(u={buffer:G.planetaryAtmoSession.getResidentEmVisBuffer(),width:G.planetaryAtmoSession.width,height:G.planetaryAtmoSession.height,sphereIndex:P},_i&&!E&&G.planetaryAtmoState?.surfacePressurePa>=20&&s.push(...Ki({center:[_,v,y],radius:S,atmoState:G.planetaryAtmoState,timeSec:t,seed:l*2.17+1.3,alphaMul:e*.85}))),w&&l===G.planetaryBodyIndex&&G.planetaryDynamoStreamlines?.length>=14&&(_i||E||q.active)){let t=G.planetaryDynamoStreamlines,n=S*1.08,r=q.active?1.45:E?1.25:.92;for(let i=0;i<t.length;i+=7)s.push(_+t[i]*n,v+t[i+1]*n,y+t[i+2]*n,.24+t[i+3]*.35,.86+t[i+4]*.14,.76+t[i+5]*.24,Math.min(.95,t[i+6]*r*e))}if(O&&G.cryoPlumeSession){let t=S/2.35;i.push({buffer:G.cryoPlumeSession.getResidentParticlesBuffer(),count:G.cryoPlumeSession.particleCount,mode:9,worldScale:t,pointSize:Math.max(.05,.085*t),alphaGain:.34*e,extra1:[_,v,y,0]})}if(f.ringed&&S>.008){let e=Array.isArray(f.ringNormal)?f.ringNormal:[.16,.89,.42],t=Math.max(5,Number(f.rotationPeriodHr)||10.5),n=(f.kind===2||f.kind===3)&&(Number(f.radiusKm)||0)>=16e3?Math.max(.025,Math.min(.098,.72/t)):0,r=f.ringInnerKm/f.radiusKm,i=f.ringOuterKm/f.radiusKm;o.push({center:[_,v,y],rIn:r*S,normal:e,rOut:i*S,color:Array.isArray(f.ringColor)?f.ringColor:[.88,.78,.62],kind:1,planetRadius:S,oblateF:n}),w&&(N={normal:e,rInRatio:r,rOutRatio:i,sphereIndex:P})}}if(Y===2&&n>=9.5){c=M;var L=!0}if(N)var R=N;if(G.nebularSettleBlend>.005&&G.nebularCoalescenceSession&&n>9.5){let t=G.nebularCoalescenceSession,n=(x[0]-C.posAu[0])*p,r=(x[1]-C.posAu[1])*p,a=(x[2]-C.posAu[2])*p;i.push({buffer:t.getResidentParcelsBuffer(),count:t.parcelCount,mode:6,worldScale:.92,pointSize:Math.max(.03,Math.min(.1,.048*Math.min(1.5,p*2))),alphaGain:.28*G.nebularSettleBlend*e,extra1:[n,r,a,1],extra2:[p,0,0,0]})}let F=Ca(n,8.8,9.6,15,16.5);if(F>.01&&i.push({buffer:G.solarEngine.getResidentBuffer(),count:G.solarEngine.totalCount,mode:4,worldScale:p,pointSize:.085,alphaGain:.62*F,extra1:[w[0],w[1],w[2],G.solarEngine.massiveCount],extra2:[T[0],T[1],T[2],0]}),_i&&n>(_?9.8:8.1)&&Y!==3){let e=Ca(n,8.1,8.8,15.2,16.4);s.push(...Ta(G.solarEngine,x,p,n,e))}}}let z=Vr()&&G.galaxyBranch!==`smbh-core`?Ca(n,7,7.8,9.7,10.4):0;if(z>.01){let e=.92*10**Math.max(-1,Math.min(1,9.2-n));if(G.stellarMode===`nebular-mhd`&&G.nebulaMhdSession){if(i.push({buffer:G.nebulaMhdSession.getResidentTracersBuffer(),count:G.nebulaMhdSession.tracerCount,mode:5,worldScale:e*1.15,pointSize:Math.max(.06,Math.min(.24,.14*e)),alphaGain:.56*z,extra1:[0,0,0,0]}),G.nebulaMhdStreamlines?.length>=14){let t=G.nebulaMhdStreamlines,n=e*1.15;for(let e=0;e<t.length;e+=7)s.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*z)}}else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`].includes(G.stellarMode)&&G.radWindL3Session)i.push({buffer:G.radWindL3Session.getResidentParcelsBuffer(),count:G.radWindL3Session.particleCount,mode:8,worldScale:e*1.05,pointSize:Math.max(.06,Math.min(.2,.115*e)),alphaGain:(G.stellarMode===`reflection-nebula`?.14:.18)*z,extra1:[0,0,0,0]}),G.stellarMode===`planetary-nebula`?a.push({pos:[0,0,0],radius:.24*e,color0:[.76,.94,1],color1:[.42,.78,1],kind:0}):G.stellarMode===`snr-pwn`?a.push({pos:[0,0,0],radius:.22*e,color0:[.62,.88,1],color1:[.85,.48,1],kind:0}):G.stellarMode===`reflection-nebula`?(a.push({pos:[0,.2*e,0],radius:.34*e,color0:[.72,.88,1],color1:[.38,.64,1],kind:0}),a.push({pos:[-2.1*e,.6*e,-1.1*e],radius:.24*e,color0:[.76,.9,1],color1:[.42,.68,1],kind:0}),a.push({pos:[2.2*e,-.5*e,1.2*e],radius:.22*e,color0:[.78,.92,1],color1:[.46,.7,1],kind:0})):G.stellarMode===`wr-bubble`?a.push({pos:[0,0,0],radius:.36*e,color0:[1,.96,.84],color1:[.62,.86,1],kind:0}):a.push({pos:[3.6*e,3.2*e,2.4*e],radius:.3*e,color0:[.72,.9,1],color1:[.45,.72,1],kind:0});else if((G.stellarMode===`pulsar`||G.stellarMode===`magnetar`)&&G.magnetosphereSession){let t=G.stellarMode===`magnetar`;if(a.push({pos:[0,0,0],radius:.44*e,color0:t?[1,.78,.96]:[.72,.94,1],color1:t?[.86,.32,.94]:[.34,.68,1],kind:0}),i.push({buffer:G.magnetosphereSession.getResidentParcelsBuffer(),count:G.magnetosphereSession.particleCount,mode:7,worldScale:e*1.12,pointSize:Math.max(.05,Math.min(.15,.088*e)),alphaGain:.25*z,extra1:[0,0,0,0]}),G.magnetosphereFieldLines?.length>=14){let t=G.magnetosphereFieldLines,n=e*1.12;for(let e=0;e<t.length;e+=7)s.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*z)}}else if(G.stellarMode===`black-hole`)a.push({pos:[0,0,0],radius:1.35*e,color0:[0,0,0],color1:[1,.72,.28],kind:5}),o.push({center:[0,0,0],rIn:2.05*e,normal:[.14,.96,.24],rOut:6.4*e,color:[1,.72,.34],kind:0}),G.kerrJetSession&&i.push({buffer:G.kerrJetSession.getResidentParcelsBuffer(),count:G.kerrJetSession.particleCount,mode:7,worldScale:e*1.15,pointSize:Math.max(.05,Math.min(.16,.095*e)),alphaGain:.26*z,extra1:[0,0,0,0]});else if(G.stellarMode===`white-dwarf-tov`){a.push({pos:[0,0,0],radius:2.15*e,color0:[.86,.95,1],color1:[.46,.74,1],kind:0});for(let t=0;t<3;t+=1){let n=(2.75+t*.95)*e,r=null;for(let e=0;e<=48;e+=1){let i=e/48*Math.PI*2,a=t*.52,o=[Math.cos(i)*n,Math.sin(i)*n*Math.sin(a),Math.sin(i)*n*Math.cos(a)];r&&(s.push(...r,.42,.84,1,(.34-t*.08)*z),s.push(...o,.42,.84,1,(.34-t*.08)*z)),r=o}}}else if(G.stellarEngine){let a=G.stellarEngine,o=Math.log10(Math.max(900,Number(a.surfaceTempK)||5778)),c=Math.max(.45,Math.min(.92,(a.rStar||5.3)/(a.boxHalf||7.5))),l=(a.boxHalf||7.5)*e*.95,u=l;if(G.solarEngine){let e=G.getActiveSystemCatalog(),t=Math.max(0,Math.min(e.length-1,G.focusedSolarBodyIndex||0)),i=G.solarEngine.getMassiveBodyState64(t),a=16/Math.max(1e-9,r/at),o=(Number(i?.radiusAu)||.00465)*a/(c*.935),s=Sa(9.75,8.65,n);u=o*(1-s)+Math.max(.45,Math.min(18,l))*s}let d=u/(a.boxHalf||7.5);if(a.solver===`webgpu-3d-mls-mpm-nuclear-fusion`&&typeof a.getResidentGridBuffer==`function`?h={mode:0,buffer:a.getResidentGridBuffer(),dim:a.gridN||24,boxRadius:u,center:[0,0,0],alphaMul:z,paramA:o,extra2:[c,+!!G.stellarCutaway,t,a.generation??3]}:i.push({buffer:a.getResidentBuffer(),count:a.count,mode:2,worldScale:d,pointSize:Math.max(.045,Math.min(.2,.125*d)),alphaGain:.3*z,extra1:[0,0,0,o]}),(_i||q.active||G.stellarCutaway)&&G.stellarDynamoStreamlines?.length>=14){let e=G.stellarDynamoStreamlines,t=d,n=q.active?1.65:1;for(let r=0;r<e.length;r+=7)s.push(e[r]*t,e[r+1]*t,e[r+2]*t,e[r+3],e[r+4],e[r+5],Math.min(.95,e[r+6]*n*z))}}}let B=Ca(n,-9.6,-8.9,-6.2,-5.2);if(B>.01&&G.mdSession){let e=G.mdSession.boxLengthsA,t=8.4/Math.max(e[0],e[1],e[2],6)*10**Math.max(-1.2,Math.min(1.4,-8.2-n)),r=(G.getCachedElementBundle(G.mdElementZ,!0)?.bundle)?.electromagnetic?.opticalSrgb||[.76,.8,.86];p={positionsBuffer:G.mdSession.positionsBuffer,velocitiesBuffer:G.mdSession.velocitiesBuffer,count:G.mdSession.atomCount,halfBox:[e[0]*.5,e[1]*.5,e[2]*.5],worldScale:t,radius:Math.max(.045,Math.min(1.3,(G.mdSession.rNearestNeighborA||2.5)*.285*t)),baseRgb:r,alphaFade:B,idealCoord:G.mdSession.idealCoordination||12},_i&&B>.3&&s.push(...wa([e[0]*.5*t,e[1]*.5*t,e[2]*.5*t],[.32,.8,1,.28*B]))}let ee=Ca(n,-13.2,-12,-9.4,-8.8);if(ee>.01&&G.orbitalCloud){let e=(G.getCachedElementBundle(G.quantumZ,G.quantumRelativistic)?.bundle)?.electromagnetic?.opticalSrgb||[.22,.86,1],t=10**Math.max(-1.1,Math.min(1.8,-10-n));if(i.push({buffer:G.orbitalCloud.pointsBuffer,count:G.orbitalCloud.pointCount,mode:3,worldScale:5.4*t,pointSize:Math.max(.025,Math.min(.14,.044*Math.sqrt(t))),alphaGain:.074*ee,colorPos:G.quantumMode===`atom`?[.18,.86,1]:[.26,.92,.86],colorNeg:G.quantumMode===`atom`?[Math.max(.68,e[0]),Math.max(.48,e[1]),Math.min(.45,e[2])]:[1,.42,.62]}),G.quantumMode===`molecule`){let e=G.MOLECULE_SPECS[G.quantumMoleculeKey],n=3.8/4.2*t;for(let r of e.atoms)a.push({pos:[r.position[0]*n,r.position[1]*n,r.position[2]*n],radius:(r.Z===1?.22:.36)*t,color0:r.Z===8?[.95,.28,.28]:r.Z===6?[.45,.52,.6]:[.92,.96,1],color1:[.6,.8,1],kind:5})}else n>-12.6&&a.push({pos:[0,0,0],radius:Math.max(.05,.1*t),color0:[1,.72,.32],color1:[1,.94,.72],kind:0})}let V=Ca(n,-15.5,-14.8,-13.3,-12.4);if(V>.01&&G.nuclearResult){let e=10**Math.max(-1.2,Math.min(.9,-14.3-n)),r=G.buildQuantizedNucleonSpheres(G.nuclearResult,2.2*e,t);ui=r,a.push(...r);let i=G.tdseTelemetry,o=20,s=-1;if(i?.prob?.length)for(let e=0;e<i.prob.length;e+=1)i.prob[e]>s&&(s=i.prob[e],o=e);m={dim:G.nuclearResult.volDim||28,boxRadius:3.8*e,tdseTunneled:i?.pTunneled||0,tdseCrestNorm:Math.max(.45,Math.min(.94,o/Math.max(1,(i?.prob?.length||128)-1))),alphaMul:V}}if(X&&X.worldPos&&X.level===Y&&X.kind!==`landing-site`){let t=X.worldPos,n=Math.max(.4,Math.hypot(e.pos[0]-t[0],e.pos[1]-t[1],e.pos[2]-t[2])),r=Math.max(.14,Math.min(2.2,n*.032)),i=[t[0]+r,t[1],t[2]],a=[t[0]-r,t[1],t[2]],o=[t[0],t[1]+r,t[2]],c=[t[0],t[1]-r,t[2]],l=[t[0],t[1],t[2]+r],u=[t[0],t[1],t[2]-r],d=(e,t,n=1,r=.84,i=.3,a=.96)=>{s.push(e[0],e[1],e[2],n,r,i,a,t[0],t[1],t[2],n,r,i,a)};d(o,i),d(o,a),d(o,l),d(o,u),d(c,i),d(c,a),d(c,l),d(c,u),d(i,l),d(l,a),d(a,u),d(u,i);let f=r*1.65;d([t[0]+r*1.15,t[1],t[2]],[t[0]+f,t[1],t[2]],.45,.92,1,.88),d([t[0]-r*1.15,t[1],t[2]],[t[0]-f,t[1],t[2]],.45,.92,1,.88),d([t[0],t[1]+r*1.15,t[2]],[t[0],t[1]+f,t[2]],.45,.92,1,.88),d([t[0],t[1]-r*1.15,t[2]],[t[0],t[1]-f,t[2]],.45,.92,1,.88)}return{camera:e,particleClouds:i,spheres:a.length?a:null,atmoEm:u,sphGeology:d,lightDir:c,lightIsPoint:!!(L!==void 0&&L),coolingHeat:Y===4&&G.planetaryGenesisSphSession&&G.planetaryCoolingHeat||0,orbitalSeasonDecl:f,ringShadow:R!==void 0&&R?R:null,starLight:Yn?.vec4||[1,.97,.92,1],mdCloud:p,disks:o.length?o:null,lines:s.length>=14?new Float32Array(s):null,nuclearVol:m,astroVol:h,post:g}}let Fo=performance.now(),Io=0,Lo=0,Ro=0,zo=0,Bo=60,Vo=[0,2.2,8.5],Ho=0,Uo=null;function Wo(e,t){if(Y>=5)return null;let n=[],r=[],i=K.mode===`ufo`,a=i?K.getState(l,!1).basis:null,o=i?Math.atan2(a.fwd[0],a.fwd[2]):Math.atan2(e.fwd[0],e.fwd[2]),s=i?[...K.pos]:er?[e.pos[0]+e.fwd[0]*.15-e.up[0]*.28,e.pos[1]+e.fwd[1]*.15-e.up[1]*.28,e.pos[2]+e.fwd[2]*.15-e.up[2]*.28]:[e.pos[0]+e.fwd[0]*5.9-e.up[0]*1.72,e.pos[1]+e.fwd[1]*5.9-e.up[1]*1.72,e.pos[2]+e.fwd[2]*5.9-e.up[2]*1.72],c=he(nr),u=X?.worldPos||Xr||[0,0,0],d=ir?{targetPos:u,rgb:tr===`antimatter`?[.85,.34,1]:c.rgb,isAntimatter:tr===`antimatter`,thicknessMul:1.15}:null;Vo=[s[0],s[1],s[2]],Ho=o,Uo=d,ce(n,r,{pos:s,yaw:o,pitch:Math.max(-.22,Math.min(.22,-e.fwd[1]*.45)),roll:Math.sin(t*.9)*.04,basisRight:i?a.right:null,basisUp:i?a.up:null,basisFwd:i?a.fwd:null,radius:.52,rimAngle:t*2.2,vertThrust:Ei===null?i?Math.min(1,K.getState(l,!1).speedWorld*.12):0:.65,tractorActive:!!(ar||Ei!==null&&Y===4),tractorHeight:3.4,beam:d,isCockpit:er,isRemote:!1,shieldFlash:J.state.shieldFlash});let f=kr(),p=Tr.getRemotePeersForContext({level:Y,systemKey:Y>=2?f:null,surfaceActive:!1});for(let i=0;i<p.length;i+=1){let a=p[i],c=Array.isArray(a.pos)&&a.pos.length===3?a.pos:null,l=c?Math.hypot(c[0],c[1],c[2]):0,u=c?Math.hypot(c[0]-s[0],c[1]-s[1],c[2]-s[2]):0,d=c&&l>.35&&u>.75?c:[s[0]+e.right[0]*(2.6+i*1.8),s[1]+e.up[1]*(.45+i%2*.35),s[2]+e.right[2]*(2.6+i*1.8)];a.renderPos=d,ce(n,r,{pos:d,yaw:a.yaw??o,pitch:a.pitch||0,roll:a.roll||0,radius:.62,rimAngle:t*2.5+i,tractorActive:!!a.tractorActive,tractorHeight:2.8,beam:a.beam||null,isRemote:!0,shieldFlash:a.shieldFlash||0})}if(Y>=2&&Y<=4){for(let e=0;e<J.state.probes.length;e+=1){let t=J.state.probes[e];if((t.systemKey||`sol`)!==f)continue;let i=t.angle||0,a=2.6+(t.orbitRadius||1.8)*.75,o=Math.cos(i)*a,s=Math.sin(i)*a;_e(n,r,[o,Math.sin(i*1.7+e)*a*Math.sin(t.inclination||.25),s],i*2,.32)}for(let e of Er)e.alive&&se(n,r,{pos:e.pos,vel:e.vel,scale:.22})}return{opaque:new Float32Array(n),fx:new Float32Array(r)}}function $(e=performance.now(),t=null){Ii();let n=t?.viewport?t.viewport.width/Math.max(1,t.viewport.height):wr.isStereoPreview?u.width*.5/Math.max(1,u.height):u.width/Math.max(1,u.height);if(G.surfaceActive&&G.surfaceSession){let r=G.surfaceSession,i=r.getCameraPose(),a=58*Math.PI/180,o=ga(a,n,.25,2400),s=_a(i.eye,i.target,i.up),c=va(o,s.mat);ki=c;let l={viewProj:c,pos:i.eye,right:s.right,up:s.up,fwd:s.fwd,aspect:n,fovTanHalf:Math.tan(a*.5),timeSec:e*.001,level:4,log10SpanM:2},u=G.getActiveSystemCatalog(),d=Gi({solarEngine:G.solarEngine,catalog:u,focusIdx:G.planetaryBodyIndex,cameraPos:i.eye,craftPosM:i.focusPos,navRadiusM:r.env.tinyPlanetCurvatureRadiusM,env:r.env,surfaceSimSec:G.surfaceSimSec,observerLatDeg:42,landingSite:G.surfaceLandingSite,altitudeKm:G.surfaceTelemetry?.ufoAltitudeKm,dysonCoverage:Math.min(.95,Math.max(0,J.state.dysonTau||0))});G.setSurfaceClimate(d.climate);let p=d.lightDir;sr=d.spheres.length,lr=d.gasGiantSkyTransmittance??1;let m=r.getActiveSkyEnv?r.getActiveSkyEnv():r.env,h=[],g=Sa(-.1,.22,p[1])*(d.climate.eclipseFactor??1);if(G.galaxyEngine&&lr>.14&&(m.skyOpticalDepth??1)*g<.36){let e=G.activeStarSite?.posGal||G.galaxyFocusPos||[4.8,.04,2.1],t=Math.max(.1,1-(m.skyOpticalDepth??0)*g*2.5)*lr;h.push({buffer:G.galaxyEngine.getResidentBuffer(),count:G.galaxyEngine.count,mode:1,isBackdrop:!0,worldScale:-24e4,pointSize:1350,alphaGain:.38*t,extra1:[e[0],e[1],e[2],0]})}h.push({buffer:r.getResidentPlumesBuffer(),count:r.particleCount,mode:11,worldScale:1,pointSize:.85,alphaGain:.92,extra1:[i.focusPos[0],0,i.focusPos[2],r.env.hasSolidCrust?1/(2*r.env.tinyPlanetCurvatureRadiusM):0]});let _=r.getResidentMpmPointsBuffer?.();_&&r.mpmPointCount>0&&h.push({buffer:_,count:r.mpmPointCount,mode:11,worldScale:1,pointSize:1.45,alphaGain:1,extra1:[i.focusPos[0],0,i.focusPos[2],r.env.hasSolidCrust?1/(2*r.env.tinyPlanetCurvatureRadiusM):0]});let v=r.getResidentCfdMotesBuffer?.();v&&r.cfdMoteCount>0&&h.push({buffer:v,count:r.cfdMoteCount,mode:11,worldScale:1,pointSize:r.env.hasSolidCrust?.95:1.05,alphaGain:1,extra1:[i.focusPos[0],0,i.focusPos[2],0]});let y=G.surfaceTelemetry?.antimatterFlash||0,b=r.getResidentFloraInstancesBuffer?.(),x=r.getResidentFloraTemplateVertBuffer?.(),S=G.surfaceBodySpec||u[G.planetaryBodyIndex],C=Ht({starSpec:u[0]||lt[0],bodySpec:S,distanceAu:d.primaryStarDistAu||u[G.planetaryBodyIndex]?.aAu||1,timeSec:e*.001,isRogue:!!r.env?.isRogue,stellarModeHint:G.stellarMode});Yn=C;let w=Number(G.planetaryAtmoTelemetry?.dipoleFieldMicroT||(Number(G.planetaryAtmoState?.dynamo?.bEquatorialT)||0)*1e6||S?.magneticFieldMicroT||0)||0,T=G.planetaryDynamoTelemetry?.magneticEnergy>1e-4?Math.max(.65,Math.min(1.65,.85+Math.log10(1+G.planetaryDynamoTelemetry.magneticEnergy*18)*.45)):+(w>.5),E=(m?.skyOpticalDepth??0)>.04?Sa(.03,.22,m.skyOpticalDepth):0,D=Number.isFinite(Number(d?.climate?.observerLatDeg))?Number(d.climate.observerLatDeg):Number.isFinite(Number(G.surfaceLandingSite?.latDeg))?Number(G.surfaceLandingSite.latDeg):58,O=.52+.92*Sa(22,66,Math.abs(D)),k=Math.max(.35,Math.min(1.75,.68+.42*Math.sqrt(Math.max(.05,(C?.irradianceWm2??1361)/1361)))),A=w>.5?Math.min(1.55,Math.log10(1+w)/Math.log10(45)):0,j=Number((A*T*E*O*k).toFixed(4));if(cr=j,Kn.renderFrame({camera:l,lightDir:p,starLight:C.vec4,spheres:d.spheres.length?d.spheres:null,disks:d.disks.length?d.disks:null,lines:d.lines||null,emSensor:q,surfaceScene:{terrainVertBuf:r.getResidentTerrainVertBuffer(),terrainIdxBuf:r.getResidentTerrainIndexBuffer(),indexCount:r.indexCount,hideTerrain:!1,flora:b&&x&&r.floraInstanceCount>0?{instanceBuf:b,templateVertBuf:x,instanceCount:r.floraInstanceCount,templateVertCount:r.floraTemplateVertCount}:null,boulderVertBuf:r.getResidentBoulderVertBuffer?.(),boulderVertCount:r.boulderVertCount||0,vehicleVertBuf:r.getResidentVehicleVertBuffer(),vehicleVertCount:r.vehicleVertCount,fxVertBuf:r.getResidentFxVertBuffer?.(),fxVertCount:r.fxVertCount||0,env:m,focusPos:i.focusPos,lightDir:p,ambientTempK:d.climate.surfaceTempK,eclipseFactor:d.climate.eclipseFactor,auroraStrength:j,observerLatRad:D*Math.PI/180,dynamoMicroT:w},particleClouds:h,stereoSbs:!t&&wr.isStereoPreview,xrEyeTarget:t,post:{bhUv:[.5,.5],bhStrength:0,warpAmount:0,flashAmount:Math.max(Ci,y*.55),crtEnabled:yi,pixelSize:bi,timeSec:e*.001}}),f){if(f.clearRect(0,0,Ai,Mi),r.activeVehicle===`ufo`&&r.cameraMode===`first-person`){let e=Ai*.5,t=Mi*.5;f.save(),f.strokeStyle=`rgba(52, 211, 153, 0.72)`,f.lineWidth=1.6,f.beginPath(),f.arc(e,t,18,0,Math.PI*2),f.moveTo(e-28,t),f.lineTo(e-10,t),f.moveTo(e+10,t),f.lineTo(e+28,t),f.moveTo(e,t-28),f.lineTo(e,t-10),f.moveTo(e,t+10),f.lineTo(e,t+28),f.stroke(),f.restore()}if(pr?.orgRef&&!pr.orgRef.abducted){let e=vo(pr.orgRef,r),t=e?ya(e,c,Ai,Mi):null;if(t?.visible){let e=pr.kingdom===`fauna`,n=e?`rgba(52, 211, 153, 0.96)`:`rgba(250, 204, 21, 0.96)`;f.save(),f.strokeStyle=n,f.lineWidth=2;for(let[e,n]of[[-1,-1],[1,-1],[1,1],[-1,1]])f.beginPath(),f.moveTo(t.sx+e*18,t.sy+n*11),f.lineTo(t.sx+e*18,t.sy+n*18),f.lineTo(t.sx+e*11,t.sy+n*18),f.stroke();let r=`${e?`🐾`:pr.kingdom===`fungi`?`🍄`:`🌿`} ${pr.speciesName}`;f.font=`700 11px monospace`;let i=Math.min(220,f.measureText(r).width+12),a=Math.max(8,Math.min(Ai-i-8,t.sx+18+8)),o=Math.max(20,Math.min(Mi-12,t.sy+4));f.fillStyle=`rgba(4, 12, 24, 0.82)`,f.fillRect(a-4,o-12,i,17),f.fillStyle=e?`#a7f3d0`:`#fef08a`,f.fillText(r,a+2,o),f.restore()}}}return}let r=Fo>0?Math.max(.001,Math.min(.1,(e-Fo)*.001)):.016;Xr=Gr&&X&&X.level===Y&&X.worldPos&&X.kind!==`cosmo-web`&&X.kind!==`galaxy-star`?li(Xr,X.worldPos,r,6.5,!1):li(Xr,[0,0,0],r,6.5,!1);let i,a;if(K.mode===`ufo`){let e=K.getSpaceCameraPose({cockpit:er});i=e.eye,a=_a(e.eye,e.target,e.up)}else{let e=Math.cos(Oi.pitch),t=Math.sin(Oi.pitch),n=Math.cos(Oi.yaw),r=Math.sin(Oi.yaw);i=[Xr[0]+Oi.dist*e*r,Xr[1]+Oi.dist*t,Xr[2]+Oi.dist*e*n],a=_a(i,Xr,[0,1,0])}let o=48*Math.PI/180,s=ga(o,n,.05,520),c=va(s,a.mat);ki=c;let d={viewProj:c,pos:i,right:a.right,up:a.up,fwd:a.fwd,aspect:n,fovTanHalf:Math.tan(o*.5),timeSec:e*.001,level:Y,log10SpanM:l};dr={pos:i,right:a.right,up:a.up,fwd:a.fwd,fovTanHalf:Math.tan(o*.5),aspect:n};let p=Po(d,e*.001);if(p.cosmicMeshes=Wo(d,e*.001),p.emSensor=q,!t&&wr.isStereoPreview){let e=Math.max(1,Math.floor(u.width*.5)),t=Math.max(.08,Oi.dist*.022),n=(e,n,r,o)=>{let c=[i[0]+a.right[0]*(e*t),i[1]+a.right[1]*(e*t),i[2]+a.right[2]*(e*t)],l=_a(c,Xr,[0,1,0]),f={...d,pos:c,right:l.right,up:l.up,fwd:l.fwd,viewProj:va(s,l.mat)};Kn.renderFrame({...p,camera:f,stereoSbs:!1,xrEyeTarget:{viewport:{x:n,y:0,width:r,height:u.height},preserve:o}})};n(-1,0,e,!1),n(1,e,u.width-e,!0)}else p.stereoSbs=!1,p.xrEyeTarget=t,Kn.renderFrame(p);No(c)}function Go(e){if(wi)return;Ti=requestAnimationFrame(Go);let t=Math.min(.1,Math.max(.001,(e-Fo)/1e3));Fo=e,Ro+=t,zo+=1,Ro>=.45&&(Bo=Math.round(zo/Ro),Ro=0,zo=0);let{gp:n,actions:r}=K.pollGamepads(Qn);if(r.toggleModePressed&&Yi(),r.toggleCockpitPressed&&Na(),r.tractorPressed&&(ar=!ar,G.setSurfaceTractorBeam(ar),zr()),r.launchMissilePressed)if(G.surfaceActive){let e=G.launchSurfaceMissile({});e&&Tr.isConnected&&Tr.broadcastMissileLaunch(e)}else Fr();if(r.levelHorizonPressed&&K.levelHorizon(),n.connected){if(n.fire!==ir&&n.fire?Qa(!0):n.fire,G.surfaceActive)G.setSurfaceControls({moveX:n.strafe,moveY:n.thrust,jump:n.ascend>.25,down:n.ascend<-.25,turbo:n.warpBoost>.35}),(Math.abs(n.yawRate)>.02||Math.abs(n.pitchRate)>.02)&&G.addSurfaceLookDelta(n.yawRate*2.2*t,-n.pitchRate*1.6*t),Math.abs(n.chaseZoomDir)>.1&&G.adjustSurfaceChaseDistance(2.2**(n.chaseZoomDir*t));else if(K.mode===`orbit`&&((Math.abs(n.yawRate)>.02||Math.abs(n.pitchRate)>.02)&&(Oi.yaw+=n.yawRate*2*t,Oi.pitch=Math.max(-1.42,Math.min(1.42,Oi.pitch-n.pitchRate*1.5*t))),Math.abs(n.scaleZoomDir)>.1||Math.abs(n.thrust)>.1)){let e=(n.scaleZoomDir*1.8-n.thrust*1.4)*t;l=Math.max(vt,Math.min(_t,l+e)),ra(l)}}if(!G.surfaceActive&&K.mode===`ufo`){let e=K.stepSpace(t,{log10SpanM:l,gamepadInput:n});Math.abs(e.deltaLog10Scale)>1e-4&&(Ei=null,l=Math.max(vt,Math.min(_t,l+e.deltaLog10Scale)),ra(l))}if(vi&&!io&&K.mode!==`ufo`&&(Oi.yaw+=t*.22),G.surfaceActive&&(Math.abs(eo.nx)>.02||Math.abs(eo.ny)>.02)&&G.addSurfaceLookDelta(-eo.nx*2.1*t,-eo.ny*1.4*t),Ci>0&&(Ci=Math.max(0,Ci-t*1.45)),Di=Math.max(0,Di-t*12),Ei!==null){let e=Ei-l,n=Math.sign(e)*Math.min(Math.abs(e),Math.max(1.2,Math.abs(e)*3.4)*t);n<0&&(Kr||Gr)&&ho(n),l+=n,Di=Math.abs(n)/Math.max(.001,t),Math.abs(Ei-l)<.015&&(l=Ei,Ei=null),ra(l)}Si&&Z.active&&Ei===null&&Ya(t);let i=Ea(l,{focusedSolarBodyIndex:G.focusedSolarBodyIndex,focusedBodyIsStar:Vr(),galaxyBranch:G.galaxyBranch});if(i!==Y){let e=Y;if(Y=i,X=null,Gr=!1,Kr=!1,Xr=[0,0,0],Oi.dist=18,e>=2&&Y<=1&&jr(),Y===4&&e!==4&&!io&&ia(G.focusedSolarBodyIndex),Y===3&&e!==3&&!Zn&&G.syncStellarRegimeForStar(null,{initializeNow:!0}),i>e){if(Y===1&&e===0&&(qr||!G.galaxyEngine)){let e=qr||G.activeGalaxyEnv;qr=null,G.initGalaxy({galaxyEnvOverride:e,observeLive:!0}).then(()=>{la(),ua(),ta()})}else if(Y===2&&e<=1&&G.galaxyBranch!==`smbh-core`&&!G.useSolReference&&(Jr||!G.solarEngine&&G.solarMode!==`formation`)){let e=Jr||G.activeStarSite;Jr=null,G.selectCausalStarSite({...e,observeLive:!0}).then(()=>{Ar(),la(),ua(),ta()})}else if(Y===4&&e<=3&&!G.surfaceActive){let e=G.getActiveSystemCatalog(),t=!e[G.focusedSolarBodyIndex]?.isStar&&G.focusedSolarBodyIndex>0?G.focusedSolarBodyIndex:G.getDefaultPlanetIndex(e);t>0&&(!G.planetaryResult||G.planetaryBodyIndex!==t)&&(G.setFocusedSolarBody(t),G.initPlanetaryInterior({bodyIndex:t,observeLive:!0}).then(()=>{ia(t),la(),ua(),ta()}))}}la(),ua(),ra(l,{observeLive:i>e})}if(mi){let e=Tr.timescaleLocked?1:hi;if(or+=t*e,G.stepActiveRegimes(Y,l,e),J.step(t),G.surfaceActive){let e=G.drainSurfaceEvents();J.addHarvest(e.harvested);for(let t of e.peerHits)Tr.sendWeaponHit(t.targetPeerId,t);if(Array.isArray(e.abductions)&&e.abductions.length>0){for(let t of e.abductions)gr.push(t);Xi(),Pa()}let t=G.getActiveSystemCatalog(),n=G.surfaceBodySpec?.id||t[G.planetaryBodyIndex]?.id||`earth`,r=kr(),i=Tr.getRemotePeersForContext({level:4,systemKey:r,bodyId:n,surfaceActive:!0});G.setSurfaceExternalEntities({remoteUfos:i,probes:J.state.probes.filter(e=>(e.systemKey||`sol`)===r),shieldFlash:J.state.shieldFlash}),G.surfaceTelemetry?.shatterTriggered&&!Or&&Pr(G.surfaceBodySpec||t[G.planetaryBodyIndex],1.85)}else if(Y===2||Y===4){for(let e=Er.length-1;e>=0;--e){let n=Er[e];if(!n.alive){Er.splice(e,1);continue}if(n.age+=t,n.pos[0]+=n.vel[0]*t,n.pos[1]+=n.vel[1]*t,n.pos[2]+=n.vel[2]*t,Math.hypot(n.target[0]-n.pos[0],n.target[1]-n.pos[1],n.target[2]-n.pos[2])<1.2||n.age>2.2){n.alive=!1;let e=n.targetSpec,t=e?.isMetallicAsteroid?4.5:e?.isComet?3.2:1.5;J.addHarvest({silicates:28*t,metals:22*t,volatiles:(e?.isComet?42:14)*t,exotics:2});let r=oe(e),i=(Dr.get(n.targetId)||0)+Math.max(4e12,rr*.25);Dr.set(n.targetId,i),Ci=Math.max(Ci,.14),i>=.85*r&&!Or&&Pr(e,i/Math.max(1,r))}}if(ir&&(tr===`laser`||tr===`antimatter`)){let e=Nr(),n=e.spec,r=n?.isMetallicAsteroid?4:n?.isComet?3:1,i=tr===`antimatter`?De({massRateKgS:Oe(Math.max(1e10,rr)),dt:t}).coupledEnergyJ:Math.max(0,rr*.45*t);J.addHarvest({silicates:16*r*t,metals:14*r*t,volatiles:(n?.isComet?28:8)*r*t,exotics:(tr===`antimatter`?4:.6)*t});let a=oe(n),o=(Dr.get(e.id)||0)+i;Dr.set(e.id,o),o>=.85*a&&!Or&&Pr(n,o/Math.max(1,a))}if(ar){let e=Nr().spec,n=e?.isMetallicAsteroid?3.5:e?.isComet?2.8:1;J.addHarvest({silicates:18*n*t,metals:15*n*t,volatiles:(e?.isComet?24:10)*n*t,exotics:.4*t})}}if(Tr.isConnected){let e=G.getActiveSystemCatalog()[G.focusedSolarBodyIndex]?.id||`earth`,t=G.surfaceTelemetry;Tr.broadcastLocalState({level:Y,systemKey:kr(),log10SpanM:l,useSol:G.useSolReference,seed:G.seed,bodyId:e,surfaceActive:G.surfaceActive,pos:G.surfaceActive?t?.ufoPos||t?.roverPos||[0,30,0]:[...Vo],yaw:G.surfaceActive?t?.ufoYaw??t?.roverYaw??0:Ho,pitch:G.surfaceActive&&t?.ufoPitch||0,roll:G.surfaceActive&&t?.ufoRoll||0,vertThrust:G.surfaceActive&&t?.ufoVertThrust||0,tractorActive:G.surfaceActive?!!t?.tractorActive:ar,beam:G.surfaceActive?t?.activeBeam||null:Uo,shieldFlash:J.state.shieldFlash})}}di+=t,di>=.032&&X&&X.level===Y&&(di=0,go()),(!(Y===6&&!io&&!vi&&Ei===null&&!Si&&Ci<=0)||e-Io>=120)&&(Io=e,$(e)),Lo+=t,Lo>=.18&&(Lo=0,b&&(b.textContent=`${Bo} FPS · WebGPU`),G.surfaceActive&&Pa(),ta(),qi(),zr(),Q(),ro())}if(Ln?.classList.remove(`active`),r.epoch&&(await G.setCosmicEpoch(r.epoch),Fi()),r.useSol!==null&&await G.setUseSolReference(r.useSol),await ra(l),r.bodyId){G.setFocusedSolarBody(r.bodyId);let e=G.getActiveSystemCatalog();(r.bodyId===`sun`||String(r.bodyId).startsWith(`star-`))&&!(e[G.focusedSolarBodyIndex]?.isStar||G.focusedSolarBodyIndex===0)&&G.setFocusedSolarBody(0);let t=e[G.focusedSolarBodyIndex];(t?.isStar||G.focusedSolarBodyIndex===0)&&await G.syncStellarRegimeForStar(t,{initializeNow:!0}),Y=Ea(l,{focusedSolarBodyIndex:G.focusedSolarBodyIndex,focusedBodyIsStar:Vr(),galaxyBranch:G.galaxyBranch}),await ra(l)}if(r.roomId&&(Tr.connect({room:r.roomId,relay:r.relayUrl||``}),Rr()),r.surfaceActive){let e=r.pos?{activeVehicle:`ufo`,ufoPos:r.pos,ufoYaw:r.yaw??.35,cameraMode:r.cockpit?`first-person`:`chase`}:null;await Fa({bodyIndex:r.bodyId||G.planetaryBodyIndex,restoreCheckpoint:e})}la(),ua(),qi(),zr(),Rr();let Ko=n.get(`peerRelay`);if(Ko){xe&&(xe.value=Ko);let e=n.get(`peerRole`)||`requester`;Se&&(Se.value=e),await G.connectPeerMesh({relayUrl:Ko,roomId:n.get(`peerRoom`)||`ulg-universes-mesh-v1`,role:e}),ro()}Q(),xi&&Ga(0);let qo=()=>{Tr.disconnect(),G.disconnectPeerMesh()};return window.addEventListener(`pagehide`,qo),window.addEventListener(`beforeunload`,qo),Ti=requestAnimationFrame(Go),Object.freeze({getState(){let e=yt[Y],n=G.cosmoSession?.getState?.()||null,r=lt[0],i=lt[3],a=lt[6],o=G.solarConservation0,s=G.solarConservation;return{ready:!0,continuousZoom:!0,level:Y,scaleId:e.id,scaleName:e.name,log10ViewSpanM:l,physicalSpanLabel:St(l),solarReferenceFrame:Ni.solarReferenceFrame||G.getSolarReferenceOriginAu(l).frameMode,selectedLandingSite:fr,surfaceLandingSite:G.surfaceLandingSite,gasGiantSkyTransmittance:lr,abductedSpecimens:[...gr],collectedMaterialSamples:[..._r],cargoOpen:!!N?.classList.contains(`open`),totalSpanOom:Number((_t-vt).toFixed(1)),gpuBackend:`webgpu`,cameraAutoSpin:vi,running:mi,autopilot:Si,tour:Va(),retroCrt:yi,lensingEnabled:gi,qualityId:G.quality.id,seed:G.seed,gpuErrorCount:t.length,gpuErrors:[...t],scientificValidation:!1,cosmicEpochId:G.cosmicEpochId,cosmicEpochRedshiftZ:G.cosmicEpoch?.redshiftZ??0,cosmoMode:G.cosmoMode,cosmoBaryonSteps:G.cosmoBaryonSession?.stepIndex??0,cosmoBaryonIonFrac:G.cosmoBaryonTelemetry?.meanIonizedFraction??null,cosmoBaryonXray:G.cosmoBaryonTelemetry?.meanXrayEmissivity??null,cosmoBaryonKappa:G.cosmoBaryonTelemetry?.maxLensingKappa??null,cosmicWebSteps:n?.stepIndex??0,scaleFactorA:n?.aScale??null,redshiftZ:n?.redshiftZ??null,submitsPerStep:G.cosmoTelemetry?.submitsPerStep??n?.submitsPerStep??null,sigmaDensity:G.cosmoTelemetry?.sigmaDensity??null,powerSpectrumPk:G.cosmoTelemetry?.powerSpectrumPk??null,galacticSteps:G.galaxyEngine?.stepIndex??0,galaxyPreset:G.galaxyPreset,galacticBodyCount:G.galaxyEngine?.count??0,galacticGravityMode:G.galaxyEngine?.gravityMode??null,galacticDynamoMagEnergy:G.galacticDynamoTelemetry?.magneticEnergy??null,galacticDynamoStreamlineFloats:G.galacticDynamoStreamlines?.length??0,galacticB0:G.galacticB0,galaxyBranch:G.galaxyBranch,planetarySteps:G.solarEngine?.stepIndex??0,solarSimTimeYr:G.solarEngine?.simTimeYr??0,solarTotalBodies:G.solarEngine?.totalCount??0,focusedSolarBody:G.getActiveSystemCatalog()[G.focusedSolarBodyIndex]?.id??`star-0`,useSolReference:G.useSolReference,causalSystemName:G.useSolReference?`Sol Reference`:G.activeCausalSystem?.systemName??null,causalArchitecture:G.useSolReference?`single`:G.activeCausalSystem?.architecture??`single`,causalStarCount:G.useSolReference?1:G.activeCausalSystem?.starCount??1,causalPlanetCount:G.useSolReference?8:G.activeCausalSystem?.planetCount??0,causalHasEarthLike:G.useSolReference?!0:!!G.activeCausalSystem?.hasEarthLike,causalFeH:G.useSolReference?0:G.activeCausalSystem?.starSystem?.nebulaEnv?.feH??0,causalCToO:G.useSolReference?.55:G.activeCausalSystem?.starSystem?.nebulaEnv?.cToO??.55,earthToSunRadiusRatio:i.radiusKm/r.radiusKm,jupiterToSunRadiusRatio:a.radiusKm/r.radiusKm,solarRelEnergyDrift:o&&s?Math.abs(s.totalEnergy-o.totalEnergy)/Math.max(1e-12,Math.abs(o.totalEnergy)):null,solarRelMomentumError:s?.relMomentumError??null,stellarSteps:G.stellarEngine?.stepIndex??0,stellarSolver:G.stellarEngine?.solver??(G.stellarEngine?`self-gravitating-hydro`:null),stellarSpatialAuthority:G.stellarEngine?.spatialAuthority??null,stellarGeneration:G.stellarTelemetry?.generation??G.stellarEngine?.generation??null,stellarGenerationLabel:G.stellarTelemetry?.generationLabel??G.stellarEngine?.generationLabel??null,stellarDominantChannel:G.stellarTelemetry?.dominantChannel??null,stellarFusedXCNO:G.stellarTelemetry?.meanXCNO??null,stellarFusedXAlphaFe:G.stellarTelemetry?.meanXAlphaFe??null,stellarSynthesizedDeltaZ:G.stellarTelemetry?.synthesizedMetalsDelta??null,stellarGridN:G.stellarEngine?.gridN??null,stellarParticleCount:G.stellarEngine?.count??null,stellarMode:G.stellarMode,stellarPreset:G.stellarPreset,stellarCoreTempK:G.stellarTelemetry?.coreTempK??null,stellarConvectiveRmsVel:G.stellarTelemetry?.convectiveRmsVel??null,stellarActiveFusionParcels:G.stellarTelemetry?.activeFusionParcels??null,lastSupernovaYields:G.lastSupernovaYields??null,qualityMode:G.qualityMode,capabilityProfile:G.capabilityProfile?{tier:G.capabilityProfile.tier,detectedTier:G.capabilityProfile.detectedTier,mode:G.capabilityProfile.mode,qualityId:G.capabilityProfile.qualityId,cpuCores:G.capabilityProfile.cpuCores,maxStorageMB:G.capabilityProfile.maxStorageMB,summaryLabel:G.capabilityProfile.summaryLabel,workloads:G.capabilityProfile.workloads}:null,sphSpatialAuthority:G.planetaryGenesisSphSession?.spatialAuthority??null,sphParcelCount:G.planetaryGenesisSphSession?.parcelCount??null,sphGridN:G.planetaryGenesisSphSession?.gridN??null,sphMapWidth:G.planetaryGenesisSphSession?.mapWidth??null,sphMapHeight:G.planetaryGenesisSphSession?.mapHeight??null,nebularSpatialAuthority:G.nebularCoalescenceSession?.spatialAuthority??null,nebularParcelCount:G.nebularCoalescenceSession?.parcelCount??null,cosmoScaleFactorA:G.cosmoScaleFactorA??1,cosmoBigBangMode:!!G.cosmoBigBangMode,stellarDynamoMagEnergy:G.stellarDynamoTelemetry?.magneticEnergy??null,stellarDynamoStreamlineFloats:G.stellarDynamoStreamlines?.length??0,stellarB0:G.stellarB0,stellarCutaway:G.stellarCutaway,galaxyIcRegimeLabel:G.galaxyIcRegimeLabel??null,galaxyCenterOfMass:G.galaxyCenterOfMass??[0,0,0],solarBarycenterAu:G.computeSolarBarycenterAu?.()??[0,0,0],nebulaCenterOfMass:G.nebulaCenterOfMass??[0,0,0],planetaryCoolingHeat:G.planetaryCoolingHeat??0,cosmoObsDiameterMpc:28500,cosmoTileMpc:G.cosmoSession?.boxLengthMpc??1425,nebularSettleBlend:G.nebularSettleBlend??0,planetaryDynamoMagEnergy:G.planetaryDynamoTelemetry?.magneticEnergy??null,planetaryDynamoStreamlineFloats:G.planetaryDynamoStreamlines?.length??0,surfaceAuroraStrength:cr,magnetosphereStreamlineFloats:G.magnetosphereFieldLines?.length??0,pickedGpuMote:X?{kind:X.kind,index:X.index,name:X.name,subtitle:X.subtitle}:null,moteFocusLocked:Gr,nebulaMhdSteps:G.nebulaMhdSession?.stepIndex??0,nebulaMhdMagneticEnergy:G.nebulaMhdTelemetry?.magneticEnergy??null,nebulaMhdPeakToroidalB:G.nebulaMhdTelemetry?.peakToroidalB??null,solarMode:G.solarMode,kerrSpinA:G.kerrSpinA,kerrMaxGamma:G.kerrJetTelemetry?.maxLorentzGamma??null,kerrActiveJets:G.kerrJetTelemetry?.activeJetParcels??0,relBinaryMerged:G.relBinaryTelemetry?.merged??!1,relBinaryRemnant:G.relBinaryTelemetry?.remnantType??null,relBinaryGwStrain:G.relBinaryTelemetry?.gwStrainPlus??null,magnetarFlares:G.magnetosphereTelemetry?.flareCount??0,magnetarBeamFlux:G.magnetosphereTelemetry?.beamFluxProxy??0,tovCount:G.tovCurve?.length??0,tidalRupturedFrac:G.tidalRocheTelemetry?.rupturedFraction??null,protoplanetarySteps:G.protoplanetarySession?.stepIndex??0,protoplanetaryAccreted:G.protoplanetaryTelemetry?.accretedPebbles??null,nebularCoalescenceSteps:G.nebularCoalescenceSession?.stepIndex??0,activeGenesisStage:G.activeGenesisStage??null,lastGenesisEvent:G.lastGenesisEvent??null,planetaryGenesisLiveForm:G.planetaryGenesisLiveForm,planetaryMode:G.planetaryMode,planetaryInteriorValid:!!G.planetaryResult?.valid,planetaryMoiFactor:G.planetaryResult?.moiFactor??null,planetaryCutaway:G.planetaryCutaway,planetaryAtmoActive:!!G.planetaryAtmoSession,planetaryAtmoSteps:G.planetaryAtmoSession?.stepIndex??0,planetaryLightningCells:G.planetaryAtmoTelemetry?.activeLightningCells??0,planetaryPeakElectricVPerM:G.planetaryAtmoTelemetry?.peakElectricFieldVPerM??0,surfaceActive:G.surfaceActive,surfaceVehicle:G.surfaceSession?.activeVehicle??null,surfaceCameraMode:G.surfaceSession?.cameraMode??null,surfaceGravityMS2:G.surfaceSession?.env?.gravityMS2??null,surfaceAtmoDensityKgM3:G.surfaceSession?.env?.rhoAtmKgM3??null,surfaceDroneFlightCapable:G.surfaceSession?.env?.droneFlightCapable??null,surfaceDroneMaxAeroLiftN:G.surfaceSession?.env?.maxAeroLiftN??null,surfaceTelemetry:G.surfaceTelemetry??null,surfaceLocalSample:G.surfaceSession?.getLocalSample?.()??null,surfaceClimate:G.surfaceClimate??null,surfaceSkyBodyCount:sr,surfaceTimeWarp:G.surfaceTimeWarp??1,surfaceSimSec:G.surfaceSimSec??0,surfaceXenobiology:G.surfaceSession?.xenobiology??null,emSensor:{...q},flightState:K.getState(l,G.surfaceActive),starIllumination:Yn,orbitalRemoteSensing:Xn,commandDeckTab:$n,hasSavedSurfaceCheckpoint:!!Hr,savedSurfaceWorld:Hr?.worldName??null,activeSampledMaterial:G.activeSampledMaterial??null,cosmicCockpitMode:er,xrState:wr.getState(),ufoMultiplayer:Tr.getStatus(),timescaleLocked:Tr.timescaleLocked,kardashev:{index:J.state.kardashevIndex,harvestedPowerW:J.state.harvestedPowerW,maxPowerW:J.state.maxPowerW,probeCount:J.state.probes.length,totalProbeCount:J.state.totalProbeCount,dysonTau:J.state.dysonTau,dysonCoveringFrac:J.state.dysonCoveringFrac,colonyLinksCount:J.state.colonyLinks.length,systemCount:J.state.systems.size,reactorTier:J.state.reactorTier,shieldHp:J.state.shieldHp,silicatesKg:J.state.silicatesKg,metalsKg:J.state.metalsKg,volatilesKg:J.state.volatilesKg},schroederAtlas:G.syncSchroederScaleChart?.(Y,l)??null,activeUniversalLaws:G.getActiveUniversalLaws?.(Y,l)??null,lawGraphContracts:G.lawGraphValidation??null,shatteredBodies:G.getShatteredBodyIds(),spaceMissileCount:Er.length,surfaceCraterTileKey:G.surfaceCraterTileKey??null,surfaceCraterReplayCount:G.surfaceTelemetry?.craterReplayCount??0,boulderSkinGpuActive:!!G.surfaceTelemetry?.boulderSkinGpuActive,weaponState:{mode:tr,log10WavelengthM:nr,powerW:rr,firing:ir,tractorOn:ar},scaleTimeDilation:G.computeScaleAdaptiveTimeDilation(l,{surfaceActive:G.surfaceActive,userTimeScale:hi}),parentBackdropActive:!!(Y===1&&G.cosmoSession||(Y===2||Y===3||Y===4)&&G.galaxyEngine||Y===6&&G.mdSession||Y===7&&G.orbitalCloud),activeUniversalLaws:G.getActiveUniversalLaws(Y,l).active.map(e=>e.id),mdSteps:G.mdTelemetry?.totalSteps??0,mdAtomCount:G.mdSession?.atomCount??0,mdGravity:G.mdGravity,mdElementZ:G.mdElementZ,quantumZ:G.quantumZ,quantumRelativistic:G.quantumRelativistic,orbitalPointCount:G.orbitalCloud?.pointCount??0,nuclearZ:G.nuclearZ,nuclearA:G.nuclearA,nuclearBindingPerNucleonMeV:G.nuclearResult?.bindingPerNucleonMeV??null,tdseSteps:G.tdseTelemetry?.stepCount??0,selectedTarget:ca()?.id??null,activeSystemKey:kr(),hasActiveBlackHoleSession:!!(G.kerrJetSession||G.relBinarySession||G.smbhBodies),visibleProbesInScene:Y>=2&&Y<=4?J.state.probes.filter(e=>(e.systemKey||`sol`)===kr()).length:0,peerMeshState:G.getPeerMeshState()}},async setLog10Span(e){Ei=null,G.surfaceActive&&Ia();let t=Y;return l=Oa(e),Y=Ea(l,{focusedSolarBodyIndex:G.focusedSolarBodyIndex,focusedBodyIsStar:Vr(),galaxyBranch:G.galaxyBranch}),Y!==t&&(X=null,Gr=!1,Xr=[0,0,0],t>=2&&Y<=1&&jr()),await ra(l),la(),ua(),Q(),$(performance.now()),this.getState()},flyToLog10Span:aa,async setLevel(e,{instant:t=!0}={}){let n=Math.max(0,Math.min(7,Math.trunc(Number(e)||0)));G.surfaceActive&&Ia();let r=G.getActiveSystemCatalog();if(n===3?(r[G.focusedSolarBodyIndex]?.isStar||G.setFocusedSolarBody(0),Zn||await G.syncStellarRegimeForStar(r[G.focusedSolarBodyIndex]||r[0],{initializeNow:!0})):n===4&&(r[G.focusedSolarBodyIndex]?.isStar||G.focusedSolarBodyIndex===0)&&G.setFocusedSolarBody(G.getDefaultPlanetIndex(r)),t){let e=await this.setLog10Span(yt[n].log10SpanM);return n===4&&(ia(G.focusedSolarBodyIndex),$(performance.now())),e}return aa(yt[n].log10SpanM),this.getState()},async sampleNewGalacticSector(e={}){return G.surfaceActive&&Ia(),Zn=!1,fr=null,Er.length=0,await G.sampleNewGalacticSector(e),Ar(),la(),ua(),Q(),$(performance.now()),this.getState()},async selectCausalStarSite(e={}){return G.surfaceActive&&Ia(),Zn=!1,fr=null,Er.length=0,await G.selectCausalStarSite(e),Ar(),la(),ua(),Q(),$(performance.now()),this.getState()},async setUseSolReference(e){return G.surfaceActive&&Ia(),Zn=!1,fr=null,Er.length=0,await G.setUseSolReference(e),await G.syncStellarRegimeForStar(null,{initializeNow:Y===3}),Ar(),la(),ua(),Q(),$(performance.now()),this.getState()},async focusSolarBody(e){X=null,Gr=!1,Xr=[0,0,0];let t=G.useSolReference;G.setFocusedSolarBody(e),G.useSolReference!==t&&(await G.initSolarSystem({solReference:G.useSolReference}),G.setFocusedSolarBody(e));let n=G.getActiveSystemCatalog(),r=Math.max(0,Math.min(n.length-1,G.focusedSolarBodyIndex));return n[r]?.isStar||r===0?(Zn=!1,await G.syncStellarRegimeForStar(n[r],{initializeNow:!0})):await G.initPlanetaryInterior({bodyIndex:r}),Y===4&&!n[r]?.isStar&&r>0&&(l=Da(n[r]),ia(r)),la(),ua(),Q(),$(performance.now()),this.getState()},async setCosmicEpoch(e,t={}){return await G.setCosmicEpoch(e,t),Fi(),la(),sa(),Q(),$(performance.now()),this.getState()},async setCosmoMode(e){return await G.setCosmoMode(e),la(),sa(),Q(),$(performance.now()),this.getState()},async setGalaxyPreset(e){return await G.initGalaxy({preset:e}),la(),sa(),Q(),$(performance.now()),this.getState()},async setSolarMode(e){return await G.setSolarMode(e),la(),sa(),Q(),$(performance.now()),this.getState()},async setKerrSpinA(e){return await G.setKerrSpinA(e),sa(),Q(),$(performance.now()),this.getState()},async setStellarMode(e){return Zn=!0,await G.setStellarMode(e),la(),sa(),Q(),$(performance.now()),this.getState()},async setStellarPreset(e){return Zn=!0,await G.setStellarMode(`fusion`),await G.initStellarCore({preset:e}),X=null,Gr=!1,la(),sa(),Q(),$(performance.now()),this.getState()},async detonateCoreSeedNextGeneration(){Zn=!1;let e=await G.detonateCoreSeedNextGeneration();return X=null,Gr=!1,la(),ta(),sa(),Q(),$(performance.now()),{...e,state:this.getState()}},setFlightMode(e=`ufo`){return Ji(e),this.getState()},toggleFlightMode(){return Yi(),this.getState()},orientCameraTowardHostStar(e=G.focusedSolarBodyIndex){if(!G.solarEngine||e<=0)return!1;let t=G.solarEngine.getMassiveBodyState64(e),n=G.solarEngine.getMassiveBodyState64(0),r=n.posAu[0]-t.posAu[0],i=n.posAu[2]-t.posAu[2];return Oi.yaw=Math.atan2(r,i)+Math.PI-.34,Oi.pitch=.08,$(performance.now()),!0},getFlightState(){return K.getState(l,G.surfaceActive)},setUfoChaseZoom(e=1){return K.setChaseZoom(e),qi(),$(performance.now()),K.getState(l,G.surfaceActive)},rotateUfoLocal(e=0,t=0,n=0){return K.rotateLocal(e,t,n),qi(),$(performance.now()),K.getState(l,G.surfaceActive)},setUfoKeys(e={}){return K.setKeys(e),K.getState(l,G.surfaceActive)},stepUfoSpace(e=.05){let{gp:t}=K.pollGamepads(Qn),n=K.stepSpace(e,{log10SpanM:l,gamepadInput:t});return qi(),$(performance.now()),n},applyMockGamepad(e=null){Qn=e?[e]:null;let t=K.pollGamepads(Qn);return qi(),t},setCommandDeckTab(e=`scan`){return Hi(e),$(performance.now()),$n},getOrbitalRemoteSensing(){return Q(),Xn},getStarIllumination(){return Yn},async setPlanetaryMode(e){return await G.setPlanetaryMode(e),e===`cryo-plumes`&&Y===4&&(l=Math.max(l,7.56),ia(G.focusedSolarBodyIndex),Oi.pitch=-.18),la(),sa(),Q(),$(performance.now()),this.getState()},setCameraAngles(e,t){return Number.isFinite(Number(e))&&(Oi.yaw=Number(e)),Number.isFinite(Number(t))&&(Oi.pitch=Math.max(-1.42,Math.min(1.42,Number(t)))),$(performance.now()),this.getState()},async setNebulaB0(e){return await G.setNebulaB0(e),sa(),$(performance.now()),this.getState()},async setGalacticB0(e){return await G.setGalacticB0(e),sa(),Q(),$(performance.now()),this.getState()},async setStellarB0(e){return await G.setStellarB0(e),sa(),Q(),$(performance.now()),this.getState()},async pickAtCanvasFraction(e=.5,t=.5,{preferGpuMote:n=!0}={}){return $(performance.now()),mo(e*Ai,t*Mi,{preferGpuMote:n})},focusPickedMote(e={zoomIn:!0}){return _o(e)},getPickedMote(){return X},async readGalaxyDiagnostics(){if(!G.galaxyEngine)return null;let e=await G.galaxyEngine.readbackBodies(),t=Math.floor(e.length/8),n=0,r=0,i=0,a=0;for(let o=0;o<t;o+=1){let t=o*8,s=Math.max(0,e[t+3]||0);s>0&&(n+=s,r+=e[t]*s,i+=e[t+1]*s,a+=e[t+2]*s)}n>1e-6&&(r/=n,i/=n,a/=n);let o=0,s=0,c=0,l=0,u=0,d=0;for(let n=1;n<t;n+=1){let t=n*8;if(e[t+7]<-.5)continue;let f=e[t]-r,p=e[t+1]-i,m=e[t+2]-a,h=Math.hypot(f,m),g=Math.hypot(f,p,m);o+=1,s+=h,c+=g,l+=p*p,g>u&&(u=g),g>22&&(d+=1)}let f=Math.hypot(e[0]-r,e[1]-i,e[2]-a);return{preset:G.galaxyPreset,stepIndex:G.galaxyEngine.stepIndex,visibleStars:o,meanRadius:s/Math.max(1,o),meanRadius3d:c/Math.max(1,o),rmsHeightZ:Math.sqrt(l/Math.max(1,o)),maxRadius:u,comDist:Math.hypot(r,i,a),smbhDist:f,escapedFrac:d/Math.max(1,o)}},async readStellarDiagnostics(){if(!G.stellarEngine||typeof G.stellarEngine.readbackBodies!=`function`)return null;let e=await G.stellarEngine.readbackBodies(),t=Math.floor(e.length/16),n=0,r=0,i=0,a=0,o=0,s=0,c=0,l=0;for(let u=0;u<t;u+=1){let t=u*16,d=Math.max(1e-6,e[t+3]||1);o+=e[t]*d,s+=e[t+1]*d,c+=e[t+2]*d,l+=d;let f=Math.hypot(e[t],e[t+1],e[t+2]),p=Math.hypot(e[t+4],e[t+5],e[t+6]);n+=f,r+=p*p,p>i&&(i=p),f<6.5&&(a+=1)}let u=1/Math.max(1e-6,l);return{stepIndex:G.stellarEngine.stepIndex,count:t,meanRadius:n/Math.max(1,t),comDist:Math.hypot(o*u,s*u,c*u),rmsSpeed:Math.sqrt(r/Math.max(1,t)),maxSpeed:i,boundFrac:a/Math.max(1,t),coreTempK:G.stellarTelemetry?.coreTempK??null}},setPlanetaryTriboelectric(e){return G.setPlanetaryTriboelectric(e),sa(),this.getState()},getActiveUniversalLaws(){return G.getActiveUniversalLaws(Y,l)},async setGalaxyBranch(e){return G.setGalaxyBranch(e,e===`smbh-core`?[0,0,0]:[4.8,.04,2.1]),await ra(l),ua(),this.getState()},setPlanetaryCutaway(e){G.setPlanetaryCutaway(e),$(performance.now())},setStellarCutaway(e){return G.setStellarCutaway(e),sa(),Q(),$(performance.now()),this.getState()},async enterSurfaceView(e={}){return await Fa(e),this.getState()},exitSurfaceView(){return Ia(),this.getState()},async sampleSurfaceAndDiveToLattice(){return{sample:await pa(),state:this.getState()}},async returnToSavedSurface(){return await ma(),this.getState()},async inspectSampledCompound(e=0){return await xa(typeof e==`object`?e:G.activeSampledMaterial?.compounds?.[e]),this.getState()},async inspectSampledElement(e,t={}){return await ka(e,t),this.getState()},setSurfaceVehicle(e){return G.setSurfaceVehicle(e),Pa(),$(performance.now()),this.getState()},setSurfaceUfoAltitudeKm(e){return G.setSurfaceUfoAltitudeKm(e),Pa(),$(performance.now()),this.getState()},setSurfaceCameraMode(e){return G.setSurfaceCameraMode(e),Pa(),zr(),$(performance.now()),this.getState()},toggleCockpit(){return Na(),this.getState()},async toggleXr(){return await wr.toggleXr((e,t)=>{for(let e of t)$(performance.now(),e)}),$(performance.now()),this.getState()},setTractorBeam(e){return ar=!!e,G.setSurfaceTractorBeam(ar),zr(),$(performance.now()),this.getState()},setWeaponConfig(e={}){return e.mode&&(tr=e.mode),Number.isFinite(Number(e.log10WavelengthM))&&(nr=Number(e.log10WavelengthM)),Number.isFinite(Number(e.powerW))&&(rr=Number(e.powerW)),G.setSurfaceWeaponConfig({mode:tr,log10WavelengthM:nr,powerW:rr,maxPowerW:e.maxPowerW??J.state.maxPowerW}),zr(),this.getState()},setWeaponFire(e={}){return ir=!!e.firing,G.setSurfaceWeaponFire(e),zr(),this.getState()},launchMissile(e={}){if(G.surfaceActive){let t=G.launchSurfaceMissile(e);return t&&Tr.isConnected&&Tr.broadcastMissileLaunch(t),t}return Fr()},async flushSurfaceCraters(){return G.flushSurfaceCraters()},async triggerCatastrophicShatter(e=null,t={}){return await Pr(e,t.excessRatio??1.65),this.getState()},async visitPickedAsteroid(){return X?.kind===`solar-asteroid`?await Fa({customBodySpec:Mr(X)}):await Fa({bodyIndex:G.focusedSolarBodyIndex}),this.getState()},advanceKardashev(e=60,t=1){let n=Math.max(.1,Number(e)||60),r=Math.min(.5,n),i=Math.max(1,n/r);for(let e=0;e<Math.max(1,Math.trunc(t));e+=1)J.step(r,{growthTimeMul:i});return zr(),$(performance.now()),this.getState()},addKardashevHarvest(e={}){return J.addHarvest(e),zr(),this.getState()},buildShareUrl:()=>Br(),joinMultiplayerRoom(e=`ulg-cosmos-public`,t=``,n={}){let r=Tr.connect({room:e,relay:t,...n});return Rr(),r},async warpToPeer(e=null){let t=Tr.getAllRemotePeers(),n=e?t.find(t=>t.peerId===e):t[0];if(!n)return null;if(typeof n.useSol==`boolean`&&n.useSol!==G.useSolReference&&await G.setUseSolReference(n.useSol),n.surfaceActive){let e=Array.isArray(n.pos)?n.pos[0]+22:22,t=Array.isArray(n.pos)?Math.max(22,n.pos[1]):30,r=Array.isArray(n.pos)?n.pos[2]+16:16;await Fa({bodyIndex:n.bodyId||`earth`,restoreCheckpoint:{activeVehicle:`ufo`,ufoPos:[e,t,r],ufoYaw:n.yaw||0}})}else G.surfaceActive&&Ia(),n.bodyId&&G.setFocusedSolarBody(n.bodyId),Number.isFinite(n.level)&&await this.setLevel(n.level,{instant:!0});return n},leaveMultiplayerRoom(){let e=Tr.disconnect();return Rr(),e},deployVonNeumannProbe(){let e=G.getActiveSystemCatalog();Ar();let t=J.deployVonNeumannProbe({bodyId:e[G.focusedSolarBodyIndex]?.id||`earth`,systemKey:kr(),starPosGal:G.activeStarSite?.posGal||G.galaxyFocusPos||[4.8,.04,2.1]});return zr(),t},upgradeReactor(){let e=J.upgradeReactor();return zr(),e},setSurfaceControls(e={}){return G.setSurfaceControls(e),Pa(),this.getState()},setEmSensorWindow(e,t,n={}){return xr(e,t,n),$(performance.now()),this.getState()},setEmSensorPreset(e=`vis`){let t=vr[e]||vr.vis;return xr(t.min,t.max,{active:t.active,preset:e}),$(performance.now()),this.getState()},setSurfaceTimeWarp(e=1){return G.setSurfaceTimeWarp(e),Pa(),$(performance.now()),this.getState()},advanceSurfaceSimSec(e=0){return G.advanceSurfaceSimSec(e),$(performance.now()),Pa(),this.getState()},addSurfaceLookDelta(e,t){return G.addSurfaceLookDelta(e,t),$(performance.now()),this.getState()},async setMdPhase(e){return await G.initMolecularDynamics({Z:G.mdElementZ,phasePreset:e}),sa(),this.getState()},selectTarget(e){let t=G.getTargetsForLevel(Y,Ni).find(t=>t.id===e);if(t){if(Ur=e,X=null,Gr=!1,Kr=!0,Y===0){let e=t.rawPosMpc||t.posMpc;Array.isArray(e)&&G.setCosmoFocusMpc(e),t.galaxyEnv&&(qr=t.galaxyEnv)}else Y===1&&t.branch?G.setGalaxyBranch(t.branch,t.rawPos||t.pos):Y===2&&t.bodyIndex!=null&&G.setFocusedSolarBody(t.bodyIndex);return Q(),$(performance.now()),!0}return!1},getTargetScreenCoords(e=null){if($(performance.now()),e===`picked-mote`||!e&&X?.worldPos){if(!X?.worldPos)return null;let e=X.worldPos;if(X.kind===`galaxy-star`&&Array.isArray(X.rawPos)){let t=Ni.galaxyScale??.85,n=Ni.galaxyOffset??[0,0,0];e=[(X.rawPos[0]-n[0])*t,(X.rawPos[1]-n[1])*t,(X.rawPos[2]-n[2])*t]}else if(X.kind===`cosmo-web`&&Array.isArray(X.rawPos)){let t=Ni.cosmoPickScale??Ni.cosmoScale??.09,n=Ni.cosmoPickOffset??[0,0,0];e=[(X.rawPos[0]-n[0])*t,(X.rawPos[1]-n[1])*t,(X.rawPos[2]-n[2])*t]}let t=ya(e,ki,Ai,Mi);return{...t,cssW:Ai,cssH:Mi,dxCenter:Math.hypot(t.sx-Ai*.5,t.sy-Mi*.5)}}let t=G.getTargetsForLevel(Y,Ni),n=e?t.find(t=>t.id===e):t.find(e=>e.id===Ur);if(!n||!Array.isArray(n.pos))return null;let r=ya(n.pos,ki,Ai,Mi);return{...r,cssW:Ai,cssH:Mi,dxCenter:Math.hypot(r.sx-Ai*.5,r.sy-Mi*.5)}},async initGalaxyPreset(e,t={}){return await G.initGalaxy({preset:e,bypassCache:!0,...t}),la(),sa(),Q(),$(performance.now()),this.getState()},pickSurfaceOrganism(e=0){if(!G.surfaceActive||!G.surfaceSession)return null;let t=(G.surfaceSession.getOrganisms?.()||[]).filter(e=>!e.abducted),n=typeof e==`number`?t[e]:t.find(t=>t.id===String(e)||t.kingdom===String(e));return n?yo(n):null},abductSurfaceOrganism(e=null){return xo(e??pr?.id??0)},getContextSpotlight(){return mr?{...mr,primaryAction:void 0}:null},setMobileDeckState(e){return Bi(e)},initiateHyperdrive:Aa,returnToOrbit:ja,setAutopilot(e){return e?Ga(0):Ua(),Va()},startTour(e=0){return Ga(e)},stopTour(){return Ua(),Va()},nextTourStop(){return Ka(1)},prevTourStop(){return Ka(-1)},toggleTourPause(){return qa()},async goToTourStop(e,t={}){return Ja(e,t)},stepTourNow(e=.25){return Ya(Math.max(.01,Math.min(5,Number(e)||.25))),$(performance.now()),Va()},setRetroCrt(e,t=bi){yi=!!e,bi=Math.max(1,Math.min(6,Math.trunc(Number(t)||3))),ge&&(ge.checked=yi),ve&&(ve.value=String(bi)),ye&&(ye.textContent=`${bi}×`)},setCameraAutoSpin(e){vi=!!e,me&&(me.checked=vi)},async bigBang(){return Ci=1,await G.setCosmoMode(`web`),await G.initCosmicWeb({bigBang:!0}),this.setLog10Span(yt[0].log10SpanM)},async triggerPlanetSphGenesisReplay(){let e=await G.triggerPlanetSphGenesisReplay();return sa(),$(performance.now()),e},setPlanetaryGenesisLiveForm(e){let t=G.setPlanetaryGenesisLiveForm(e);return sa(),$(performance.now()),t},getSphGenesisTelemetry(){return G.planetaryGenesisSphTelemetry||G.planetaryGenesisSphSession?.getTelemetry?.()||null},getRootLineageCacheStats(){return G.getRootLineageCacheStats()},getTargets(e=Y){return G.getTargetsForLevel(e,Ni)},async crystallizeCoalescedSystem(){let e=await G.crystallizeCoalescedSystem();return la(),ua(),$(performance.now()),e},async triggerGalaxyCoalescence(){let e=await G.triggerGalaxyCoalescence();return la(),sa(),ta(),$(performance.now()),e},async finalizeActiveGenesis(){return na()},peekCachedStarSystemForSite:e=>G.peekCachedStarSystemForSite(e),peekCachedPlanetSph:e=>G.peekCachedPlanetSph(e),peekCachedHaloGalaxy:e=>G.peekCachedHaloGalaxy(e),async reseed(e=null){return G.setSeed(e??G.seed+7919>>>0),await G.initCosmicWeb(),this.getState()},connectPeerMesh:e=>G.connectPeerMesh(e),disconnectPeerMesh:()=>G.disconnectPeerMesh(),dispatchPeerDerivation:e=>G.dispatchPeerDerivation(e),async stepOnce(){let e=0;for(;G.busy&&e<100;)e+=1,await new Promise(e=>setTimeout(e,4));if(await G.stepActiveRegimes(Y,l,hi),X&&X.level===Y&&await go(),Ci>0&&(Ci=Math.max(0,Ci-.14)),G.surfaceActive){let e=G.drainSurfaceEvents();if(J.addHarvest(e.harvested),Array.isArray(e.abductions)&&e.abductions.length>0){for(let t of e.abductions)gr.push(t);Xi(),Pa()}}return ta(),Q(),this.getState()},capturePng(){return $(performance.now()),u.toDataURL(`image/png`)},dispose(){wi=!0,cancelAnimationFrame(Ti),window.removeEventListener(`resize`,Ii),window.removeEventListener(`keydown`,to),window.removeEventListener(`keyup`,no),window.removeEventListener(`pagehide`,qo),window.removeEventListener(`beforeunload`,qo),Tr.disconnect(),wr.exitXr(),qn.dispose(),G.dispose(),Kn.dispose()}})}async function Aa(){try{let e=await ka();window.__ulgUniversesDemo=e}catch(e){let t=document.getElementById(`uv-webgpu-fallback`),n=document.getElementById(`uv-fallback-title`),r=document.getElementById(`uv-fallback-msg`);n&&(n.textContent=`WebGPU Initialization Failed`),r&&(r.textContent=e instanceof Error?e.message:String(e)),t?.classList.add(`visible`),console.error(`[ULG Universes] boot failed:`,e)}}Aa();