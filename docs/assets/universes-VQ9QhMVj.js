import{r as e}from"./peercomputeCore-v5yaNOi5.js";import{S as t,_t as n,a as r,lt as i,mt as a,p as o,r as s,u as c,ut as l,x as u,yt as d}from"./molecularDynamicsWebGpu-Dxf8sAil.js";import{B as f,H as p,P as m,R as h,V as g,l as _}from"./batchedSymmetricEigensolverGpu-D3UXeliY.js";import{t as v}from"./ClosureRegistry-w0f8_ofY.js";import{n as y,r as b,t as x}from"./clientDerivationPeers-Bftf54kn.js";import{attachWebGpuUncapturedErrorTelemetry as S}from"../runtime/webgpuDeviceLimits.js";import{computeBufferBinding as C,createCachedExplicitBindGroup as w,createCachedExplicitComputePipeline as T}from"../runtime/webgpuComputeLayout.js";import{t as E}from"./radiationClosure-DdtG4V5X.js";import{d as D,l as O,m as k,n as A,p as j,t as M}from"./simulationModuleRegistry-Cad76McI.js";import{i as N,n as P,r as F,t as I}from"./webgpuCompat-B36dRVS1.js";import{A as L,B as R,C as z,D as ee,E as B,F as V,G as te,H as ne,I as re,K as ie,L as ae,M as oe,N as H,O as se,P as ce,R as le,S as ue,T as de,U as fe,V as pe,W as me,a as he,c as ge,i as _e,j as ve,k as ye,l as be,n as xe,o as Se,r as Ce,s as we,t as Te,y as Ee,z as De}from"./gpuEntityPickerWebGpu-BRJoHq9g.js";import{i as Oe,t as ke}from"./schroederScaleAtlasMultipoleGpu-B2rvRPwQ.js";async function Ae(){let e=typeof navigator<`u`&&!!navigator.xr,t=typeof globalThis.XRGPUBinding==`function`,n=!1;if(e&&typeof navigator.xr.isSessionSupported==`function`)try{n=await navigator.xr.isSessionSupported(`immersive-vr`)}catch{n=!1}return{hasNavigatorXr:e,hasXrGpuBinding:t,immersiveVrSupported:n,nativeWebGpuXrReady:!!(e&&t&&n)}}function je(e,{onStateChange:t=null}={}){let n=null,r=null,i=null,a=null,o=!1,s=`Desktop 3D`,c={hasNavigatorXr:typeof navigator<`u`&&!!navigator.xr,hasXrGpuBinding:typeof globalThis.XRGPUBinding==`function`,immersiveVrSupported:!1,nativeWebGpuXrReady:!1},l=()=>{typeof t==`function`&&t(u())};Ae().then(e=>{c=e,l()});function u(){return{...c,active:!!n||o,mode:n?`webxr-native`:o?`stereo-sbs`:`flat`,statusText:s}}async function d(t){let d=await Ae();if(c=d,d.nativeWebGpuXrReady&&typeof t==`function`)try{n=await navigator.xr.requestSession(`immersive-vr`,{requiredFeatures:[`local-floor`],optionalFeatures:[`webgpu`,`hand-tracking`]}),i=new globalThis.XRGPUBinding(n,e),a=i.createProjectionLayer({colorFormat:navigator.gpu.getPreferredCanvasFormat(),depthStencilFormat:`depth24plus`}),await n.updateRenderState({layers:[a]}),r=await n.requestReferenceSpace(`local-floor`),s=`WebXR WebGPU Live`,o=!1,n.addEventListener(`end`,()=>{n=null,r=null,i=null,a=null,s=`Desktop 3D`,l()});let c=(e,o)=>{if(!n)return;let s=o.getViewerPose(r);if(s&&i&&a){let n=[];for(let e of s.views){let t=i.getViewSubImage(a,e);n.push({eye:e.eye,projectionMatrix:e.projectionMatrix,transform:e.transform,colorView:t.colorTexture.createView({baseArrayLayer:t.imageIndex||0,arrayLayerCount:1}),depthView:t.depthStencilTexture?t.depthStencilTexture.createView({baseArrayLayer:t.imageIndex||0,arrayLayerCount:1}):null,viewport:t.viewport})}t(e,n,s)}n.requestAnimationFrame(c)};return n.requestAnimationFrame(c),l(),u()}catch(e){return n=null,i=null,a=null,s=`Stereo VR (${String(e?.message||`XRGPUBinding fallback`).slice(0,36)})`,o=!0,l(),u()}return o=!o,s=o?d.hasNavigatorXr&&!d.hasXrGpuBinding?`Stereo SBS VR (enable #webxr-incubations for native XRGPUBinding)`:`Stereo SBS VR Preview`:`Desktop 3D`,l(),u()}async function f(){if(o=!1,n){try{await n.end()}catch{}n=null,r=null,i=null,a=null}return s=`Desktop 3D`,l(),u()}async function p(e){return n||o?f():d(e)}return Object.freeze({getState:u,enterXr:d,exitXr:f,toggleXr:p,get isStereoPreview(){return o},get isNativeXr(){return!!n}})}var Me=`https://secretworkshop.net/peercompute/config/relay-config.json`,Ne=Object.freeze({bootstrapPeers:Object.freeze([`/dns4/secretworkshop.net/tcp/443/wss/p2p/12D3KooWN8PoXAkYjbzTD3SKJGP97peWDE9jFeqqS3ipJsgwDozs`,`/dns6/secretworkshop.net/tcp/443/wss/p2p/12D3KooWN8PoXAkYjbzTD3SKJGP97peWDE9jFeqqS3ipJsgwDozs`]),pubsubType:`gossipsub`,gossipsub:Object.freeze({D:8,Dhi:32,Dout:1,scoreParams:Object.freeze({IPColocationFactorWeight:0,behaviourPenaltyWeight:0,topics:Object.freeze({__default:Object.freeze({meshMessageDeliveriesWeight:0,meshMessageDeliveriesThreshold:0,meshFailurePenaltyWeight:0})})})}),webrtc:Object.freeze({iceServers:Object.freeze([Object.freeze({urls:`stun:stun.l.google.com:19302`}),Object.freeze({urls:Object.freeze([`turn:secretworkshop.net:3478?transport=udp`,`turn:secretworkshop.net:3478?transport=tcp`]),username:`peer`,credential:`compute`})]),preferDirect:!0,dropRelayOnDirect:!0,dropRelayBootstrapOnDirect:!0,countRelayWebrtcAsDirectCapable:!0,relayRetention:Object.freeze({mode:`logn`,min:1,max:10})})}),Pe=Object.freeze({faultTolerance:`no-fatal`}),Fe=Object.freeze({snapshotHz:20,keepaliveMs:1500,snapshotsRequireAuthority:!1,reliableEventTypes:[`ufo-hit`,`ufo-missile`,`ufo-crater-stamp`,`ufo-leave`]});function Ie(e){let t=String(e||``),n=t.lastIndexOf(`/p2p/`);return n>=0?t.slice(n+5).split(`/`)[0]:``}function Le(e){if(!Array.isArray(e))return[];let t=typeof globalThis.location==`object`&&globalThis.location?.protocol===`https:`;return e.filter(e=>typeof e==`string`&&e.trim().length>0).map(e=>t?e.replace(`/ws/`,`/wss/`):e)}async function Re(e=``){let t=async e=>{if(!e||typeof globalThis.fetch!=`function`)return null;try{let t=typeof AbortController==`function`?new AbortController:null,n=t?setTimeout(()=>t.abort(),4e3):null;try{let n=await globalThis.fetch(e,{cache:`no-store`,...t?{signal:t.signal}:{}});if(n.ok)return await n.json()}finally{n&&clearTimeout(n)}}catch{}return null},n=``;try{if(typeof globalThis.location==`object`&&globalThis.location?.search){let e=new URLSearchParams(globalThis.location.search);n=(e.get(`relayConfigUrl`)||e.get(`relayConfig`)||``).trim()}}catch{}let r=await t(String(e||n||Me).trim());return r&&Array.isArray(r.bootstrapPeers)&&r.bootstrapPeers.length>0?r:Ne}function ze(e,t,n){return Math.max(t,Math.min(n,e))}function Be(e=``){let t=new URLSearchParams(String(e||``)),n=(e,n=null)=>{let r=t.get(e);if(r===null||r===``)return n;let i=Number(r);return Number.isFinite(i)?i:n};return{seed:n(`seed`,null),epoch:t.get(`epoch`)||null,log10SpanM:n(`span`,null),level:n(`level`,null),useSol:t.has(`sol`)?t.get(`sol`)===`1`||t.get(`sol`)===`true`:null,bodyId:t.get(`body`)||null,surfaceActive:t.get(`surf`)===`1`||t.get(`surf`)===`true`,pos:t.has(`x`)&&t.has(`z`)?[n(`x`,0),n(`y`,28),n(`z`,0)]:null,yaw:n(`yaw`,null),simTimeS:n(`t`,null),roomId:(t.get(`room`)||``).trim()||null,relayUrl:(t.get(`relay`)||``).trim()||null,cockpit:t.get(`cockpit`)===`1`}}function Ve(e,t={}){let n=new URL(e||`https://127.0.0.1:5173/universes.html`),r=n.searchParams;return r.set(`seed`,String(Math.trunc(Number(t.seed)||20261125))),t.epoch&&r.set(`epoch`,String(t.epoch)),Number.isFinite(t.log10SpanM)&&r.set(`span`,Number(t.log10SpanM).toFixed(2)),typeof t.useSol==`boolean`&&r.set(`sol`,t.useSol?`1`:`0`),t.bodyId&&r.set(`body`,String(t.bodyId)),t.surfaceActive?(r.set(`surf`,`1`),Array.isArray(t.pos)&&t.pos.length===3&&(r.set(`x`,Number(t.pos[0]).toFixed(1)),r.set(`y`,Number(t.pos[1]).toFixed(1)),r.set(`z`,Number(t.pos[2]).toFixed(1))),Number.isFinite(t.yaw)&&r.set(`yaw`,Number(t.yaw).toFixed(2))):(r.delete(`surf`),r.delete(`x`),r.delete(`y`),r.delete(`z`),r.delete(`yaw`)),Number.isFinite(t.simTimeS)&&r.set(`t`,Number(t.simTimeS).toFixed(1)),t.roomId?r.set(`room`,String(t.roomId)):r.delete(`room`),t.relayUrl?r.set(`relay`,String(t.relayUrl)):r.delete(`relay`),n.toString()}function He({peerId:t=null,onWeaponHitLocal:n=null,onRemoteMissile:r=null,onRemoteCraterStamp:i=null,onStateChange:a=null}={}){let o=t||`ufo-${Math.random().toString(36).slice(2,8)}`,s=new Map,c=12e3,l=null,u=``,d=null,f=null,p=null,m=null,h=null,g=null,_=[],v=!1,y=0,b=`offline`,S=null,C=null,w=null,T=0,E=!1,D=Date.now(),O=0,k=0,A=0,j=0,M=0,N=()=>{typeof a==`function`&&a(ie())};function P(){if(!h){v=!1,y=0;return}let e=h.getConnections?.()||[],t=Array.isArray(e)?e:Array.from(e.values?.()||[]).flat(),n=!1,r=new Set;for(let e of t){let t=e?.remotePeer?.toString?.()||``;t&&(_.includes(t)?n=!0:r.add(t))}v=n,y=r.size,E&&p&&(b=y>0?`p2p-mesh`:v?`relay-online`:`connecting`)}function F(e){if(!e||typeof e!=`object`||e.from===o||g&&e.from===g||l&&e.roomId&&e.roomId!==l)return;A+=1;let t=Date.now();e.type===`ufo-state`&&e.from?(s.set(e.from,{peerId:e.from,state:e.state||{},lastSeenMs:t}),Number.isFinite(e.epochAnchorMs)&&e.epochAnchorMs<D&&(D=e.epochAnchorMs)):e.type===`ufo-hit`&&(e.targetPeerId===o||g&&e.targetPeerId===g)?(j+=1,typeof n==`function`&&n({from:e.from,weapon:e.weapon||`laser`,damage:Number(e.damage)||8,wavelengthNm:e.wavelengthNm??532})):e.type===`ufo-missile`&&e.from?typeof r==`function`&&r(e.missile,e.from):e.type===`ufo-crater-stamp`&&e.from?typeof i==`function`&&i(e.stamp,e.from):(e.type===`ufo-leave`||e.type===`peer-disconnect`)&&(e.from||e.peerId)&&s.delete(e.from||e.peerId),N()}function I(e,{reliable:t=!1}={}){if(!E||!l)return!1;let n={...e,from:o,roomId:l,epochAnchorMs:D},r=!1;if(f)try{f.postMessage(n),r=!0}catch{}if(d)try{d.send(n),r=!0}catch{}if(m&&e.type!==`ufo-state`)try{m.queueEvent?.(n,{reliable:!!t}),r=!0}catch{}return r&&(k+=1),r}async function L(t,n,r=``,i=``){if(globalThis.window===void 0||typeof globalThis.WebSocket!=`function`){b=`local-only`,N();return}b=`connecting`,S=null,N();try{let a=await Re(r);if(t!==T||!E)return;let s=Le(i?[i,...a.bootstrapPeers||[]]:a.bootstrapPeers||[]);_=s.map(Ie).filter(Boolean);let c=new e({bootstrapPeers:s,enablePersistence:!1,gameId:`ulg-universes`,roomId:n,maxConnections:12,transportManager:Pe,...a.pubsubType?{pubsubType:String(a.pubsubType).trim().toLowerCase()}:{pubsubType:`gossipsub`},...a.gossipsub&&typeof a.gossipsub==`object`?{gossipsub:{...a.gossipsub}}:{},...a.webrtc&&typeof a.webrtc==`object`?{webrtc:{...a.webrtc}}:{}});if(await c.initialize(),t!==T||!E){try{await c.stop()}catch{}return}if(await c.start(),t!==T||!E){try{await c.stop()}catch{}return}let l=c.getNetworkManager(),u=l?.getLibp2pNode?.()||null;p=c,m=l,h=u,g=c.getStatus?.()?.network?.peerId||null,l.configureScheduler?.(Fe),l.registerStateProvider?.(()=>w?{...w,selfId:o,roomId:n,epochAnchorMs:D}:{selfId:o,roomId:n,epochAnchorMs:D,level:2,surfaceActive:!1,pos:[0,0,0],yaw:0},{id:`ufo`}),l.addSnapshotHandler?.((e,r)=>{if(t!==T||!E)return;let i=r?.header?.peerId||e;if(!i||i===g)return;let a=Array.isArray(r?.payload)?r.payload:[];for(let e of a){if(!e||e.id!==`ufo`||!e.data)continue;let t=e.data;F({type:`ufo-state`,from:t.selfId||i,roomId:t.roomId||n,epochAnchorMs:t.epochAnchorMs,state:t})}}),l.addEventHandler?.((e,n)=>{if(t!==T||!E)return;let r=n?.header?.peerId||e;if(!r||r===g)return;let i=Array.isArray(n?.payload)?n.payload:[];for(let e of i){let t=e?.payload;!t||typeof t!=`object`||F({...t,from:t.from||r})}}),u&&(u.addEventListener(`connection:open`,()=>{t!==T||!E||(P(),l.markStateDirty?.(),N())}),u.addEventListener(`connection:close`,()=>{t!==T||!E||(P(),N())})),P(),l.markStateDirty?.();try{await l.redialBootstrapPeers?.()}catch{}P(),N(),C=setInterval(()=>{t!==T||!E||!m||(P(),!v&&y===0&&m.redialBootstrapPeers?.().catch(()=>{}),N())},1e4)}catch(e){if(t!==T)return;b=`error`,S=e instanceof Error?e.message:String(e),N()}}function R({room:e=`ulg-cosmos-public`,relay:t=``,relayConfigUrl:n=``,enablePeerCompute:r=!0}={}){z();let i=String(e||``).trim();if(!i)return ie();let a=++T;if(l=i,u=String(t||``).trim(),D=Date.now(),E=!0,typeof globalThis.BroadcastChannel==`function`)try{f=new globalThis.BroadcastChannel(`ulg-ufo-room:${l}`),f.onmessage=e=>F(e.data)}catch{f=null}let s=u.startsWith(`/`)&&u.includes(`/p2p/`),c=/^wss?:\/\//i.test(u);if(c)try{d=x({relayUrl:u,roomId:`ulg-ufo-room:${l}`,peerId:o,enableWebRtc:!0}),d.onMessage(e=>F(e))}catch{d=null}return r!==!1&&!c?L(a,l,n,s?u:``):b=d?`relay-online`:`local-only`,N(),ie()}function z(){if(T+=1,C&&=(clearInterval(C),null),E&&l&&I({type:`ufo-leave`},{reliable:!0}),E=!1,l=null,u=``,w=null,s.clear(),f){try{f.close()}catch{}f=null}if(d){try{d.close()}catch{}d=null}let e=p;return p=null,m=null,h=null,g=null,_=[],v=!1,y=0,b=`offline`,S=null,e&&Promise.resolve().then(()=>e.stop?.()).catch(()=>{}),N(),ie()}function ee(e,t=!1){if(!E)return;w=e?{...e}:w;let n=Date.now();if(!(!t&&n-O<48)){O=n;for(let[e,t]of s.entries())n-t.lastSeenMs>c&&s.delete(e);if(m)try{m.markStateDirty?.()}catch{}I({type:`ufo-state`,state:w})}}function B(e,{weapon:t=`laser`,damage:n=8,wavelengthNm:r=532}={}){return!E||!e?!1:(M+=1,I({type:`ufo-hit`,targetPeerId:e,weapon:t,damage:n,wavelengthNm:r},{reliable:!0}))}function V(e){return!E||!e?!1:I({type:`ufo-missile`,missile:e},{reliable:!0})}function te(e){return!E||!e?!1:I({type:`ufo-crater-stamp`,stamp:e},{reliable:!0})}function ne(){let e=Date.now(),t=[];for(let[n,r]of s.entries()){if(e-r.lastSeenMs>c){s.delete(n);continue}t.push({peerId:n,...r.state})}return t.sort((e,t)=>String(e.peerId).localeCompare(String(t.peerId))),t}function re({level:e,bodyId:t,systemKey:n=null,surfaceActive:r}={}){let i=[];for(let a of ne()){let o=!n||!a.systemKey||a.systemKey===n,s=!!r&&!!a.surfaceActive&&o&&(!t||a.bodyId===t),c=!r&&!a.surfaceActive&&o&&(e==null||a.level===e);(s||c)&&i.push(a)}return i}function ie(){let e=p?y>0?`peercompute-p2p+bc`:v?`peercompute-relay+bc`:`peercompute-connecting+bc`:d?`peercompute-webrtc+bc`:b===`connecting`?`peercompute-connecting+bc`:f?`broadcast-channel`:`offline`;return{selfId:o,connected:E,roomId:l,relayUrl:u,timescaleLocked:E,syncedEpochSec:E?(Date.now()-D)*.001:null,remotePeerCount:s.size,remotePeerIds:[...s.keys()],transportKind:e,peerComputeStatus:b,peerComputePeerId:g,peerComputeError:S,relayConnected:v,libp2pPeerCount:y+ +!!v,messagesSent:k,messagesReceived:A,shieldHitsTaken:j,shieldHitsDealt:M}}return Object.freeze({connect:R,disconnect:z,broadcastLocalState:ee,sendWeaponHit:B,broadcastMissileLaunch:V,broadcastCraterStamp:te,getAllRemotePeers:ne,getRemotePeersForContext:re,getStatus:ie,get isConnected(){return E},get timescaleLocked(){return E}})}var Ue=Object.freeze([0xe8d4a51000,0x38d7ea4c68000,0xde0b6b3a7640000,1e22,1e26]),We=3828e23;function Ge(e,t,n,r){let i=Math.max(0,Number(e)||0),a=Math.max(1,Number(t)||1e9);if(i<=0||r<=0||n<=0)return i;if(i>=a)return a;let o=(a-i)/Math.max(1e-9,i),s=Math.exp(-Math.min(60,n*r));return Math.min(a,a/(1+o*s))}function U(e,t=12e11,n=1496e8){let r=Math.max(0,Number(e)||0),i=4*Math.PI*n*n,a=ze(r*t/Math.max(1,i),0,.992);return{fCover:a,tauDyson:-Math.log(Math.max(1e-4,1-a))}}function Ke(){let e={silicatesKg:120,volatilesKg:80,metalsKg:90,exoticsKg:12,probes:[],systems:new Map,colonyLinks:[],totalProbeCount:0,colonizedSystemCount:0,activeSystemKey:`sol`,dysonCoveringFrac:0,dysonTau:0,reactorTier:1,maxPowerW:Ue[0],shieldHp:100,maxShieldHp:100,shieldFlash:0,harvestedPowerW:18e12,kardashevIndex:.725,kardashevK:.725};function t(t=e.activeSystemKey,{starPosGal:n=[4.8,.04,2.1],starLumW:r=We}={}){let i=String(t||`sol`),a=e.systems.get(i);return a||(a={systemKey:i,starPosGal:Array.isArray(n)?[...n]:[4.8,.04,2.1],starLumW:Math.max(.02*We,Number(r)||We),swarmRadiusM:1496e8,N_probes:0,K_cap:25e10,rGrowth:.095,fCover:0,tauDyson:0,dysonPowerW:0,seededNeighbors:!1},e.systems.set(i,a)),a}function n(){let t=0,n=0,r=0;for(let i of e.systems.values())if(i.N_probes>0){r+=1,t+=i.N_probes;let{fCover:e,tauDyson:a}=U(i.N_probes,12e11,i.swarmRadiusM);i.fCover=e,i.tauDyson=a,i.dysonPowerW=i.starLumW*e*.42+i.N_probes*0xe35fa931a000,n+=i.dysonPowerW}let i=e.systems.get(e.activeSystemKey);e.totalProbeCount=t,e.colonizedSystemCount=r,e.dysonCoveringFrac=i?i.fCover:0,e.dysonTau=i?i.tauDyson:0;let a=18e12*35**(e.reactorTier-1),o=r>=6?10**(31+Math.min(5,r*.45)):0;e.harvestedPowerW=a+n+o;let s=ze((Math.log10(Math.max(1e6,e.harvestedPowerW))-6)/10,0,3.2);e.kardashevIndex=s,e.kardashevK=s;let c=Ue[ze(e.reactorTier-1,0,Ue.length-1)];e.maxPowerW=Math.min(1e26,Math.max(c,e.harvestedPowerW*.25))}function r({silicates:t=0,volatiles:n=0,metals:r=0,exotics:i=0}={}){e.silicatesKg+=Math.max(0,t),e.volatilesKg+=Math.max(0,n),e.metalsKg+=Math.max(0,r),e.exoticsKg+=Math.max(0,i)}function i({systemKey:t=`sol`,starPosGal:r=[4.8,.04,2.1],starLumW:i=We}={}){e.activeSystemKey=String(t||`sol`);let a=e.systems.get(e.activeSystemKey);a&&(Array.isArray(r)&&(a.starPosGal=[...r]),Number.isFinite(i)&&i>0&&(a.starLumW=i)),n()}function a({bodyId:r=`earth`,systemKey:i=e.activeSystemKey,starPosGal:a=[4.8,.04,2.1],starLumW:o=We,orbitRadius:s=2.2,stellarFluxMul:c=1,seedCount:l=1}={}){if(e.metalsKg<40||e.silicatesKg<40)return null;e.metalsKg-=40,e.silicatesKg-=40;let u=t(i,{starPosGal:a,starLumW:o});u.N_probes+=Math.max(1,Number(l)||1);let d={id:`vn-${e.probes.length+1}`,bodyId:r,systemKey:u.systemKey,orbitRadius:Math.max(1.4,s),angle:Math.random()*Math.PI*2,inclination:(Math.random()-.5)*.75,gen:1,replicationProgress:0,powerW:0xe35fa931a000*Math.max(.25,c)};return e.probes.length<48&&e.probes.push(d),n(),d}function o(){let t=80*e.reactorTier,r=10*e.reactorTier;return e.reactorTier>=5||e.metalsKg<t||e.exoticsKg<r?!1:(e.metalsKg-=t,e.exoticsKg-=r,e.reactorTier+=1,e.maxShieldHp=100+(e.reactorTier-1)*45,e.shieldHp=e.maxShieldHp,n(),!0)}function s(r,{growthTimeMul:i=1}={}){let a=ze(Number(r)||.016,0,.5),o=a*Math.max(.1,Number(i)||1);e.shieldFlash=Math.max(0,e.shieldFlash-a*2.6),e.shieldHp=Math.min(e.maxShieldHp,e.shieldHp+a*(2.2*e.reactorTier));let s=[];for(let t of e.systems.values()){if(t.N_probes<=0)continue;let n=1+Math.min(1.5,(e.metalsKg+e.silicatesKg)/1200);t.N_probes=Ge(t.N_probes,t.K_cap,t.rGrowth*n,o);let{fCover:r}=U(t.N_probes,12e11,t.swarmRadiusM);if(r>.25&&!t.seededNeighbors&&e.systems.size<16){t.seededNeighbors=!0;let n=e.systems.size;for(let e=0;e<2;e+=1){let r=(n+e)*2.39996,i=1.4+e*.9,a=[t.starPosGal[0]+Math.cos(r)*i,t.starPosGal[1]+(e%2==0?1:-1)*.14,t.starPosGal[2]+Math.sin(r)*i],o=`colony-${n+e+1}`;s.push({key:o,from:[...t.starPosGal],to:a})}}}for(let n of s){let r=t(n.key,{starPosGal:n.to,starLumW:We*1.15});r.N_probes=Math.max(r.N_probes,64),e.colonyLinks.push({fromPosGal:n.from,toPosGal:n.to,progress:.15})}for(let t of e.colonyLinks)t.progress=Math.min(1,t.progress+a*.25);let c=e.systems.get(e.activeSystemKey),l=c?Math.min(48,Math.max(e.probes.length,Math.min(48,Math.floor(Math.log2(1+c.N_probes)*2.2)))):e.probes.length;for(;e.probes.length<l&&e.probes.length>0&&e.probes.length<48;){let t=e.probes[e.probes.length-1];e.probes.push({id:`vn-${e.probes.length+1}`,bodyId:t.bodyId,systemKey:t.systemKey,orbitRadius:t.orbitRadius*(.92+Math.random()*.18),angle:t.angle+.55,inclination:ze(t.inclination+(Math.random()-.5)*.45,-1.1,1.1),gen:t.gen+1,replicationProgress:0,powerW:t.powerW})}for(let t=0;t<e.probes.length;t+=1){let n=e.probes[t];n.angle+=a*(.42+t%5*.12),e.metalsKg+=a*1.6,e.silicatesKg+=a*1.8,e.exoticsKg+=a*.35}n()}function c(t){e.shieldHp=Math.max(0,e.shieldHp-Math.max(0,t)),e.shieldFlash=1,e.shieldHp<=0&&(e.shieldHp=e.maxShieldHp*.45)}return n(),{state:e,addHarvest:r,setActiveSystemContext:i,deployVonNeumannProbe:a,upgradeReactor:o,applyDamage:c,step:s}}var qe=`ulg.astrophysics.solar-system-nbody-webgpu.v1`,Je=149597870700,Ye=30034896e-13,Xe=4*Math.PI*Math.PI,Ze=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Qe=Object.freeze([{id:`sun`,name:`Sun (G2V)`,subtitle:`Main-Sequence Hydrogen Fusion Star`,parent:-1,kind:0,massSolar:1,radiusKm:695700,aAu:0,e:0,incDeg:0,omDeg:0,wDeg:0,m0Deg:0,axialObliquityDeg:7.25,spinAxisLonDeg:75.7,rotationPeriodHr:609.12,tidallyLocked:!1,color0:[1,.94,.76],color1:[1,.56,.18],atm:0,tempK:5778,centralP:0x58d15e17628000,coreZ:1,mantleZ:2,surfZ:1,composition:`H 73.5% · He 24.8% · O/C/Fe 1.7%`},{id:`mercury`,name:`Mercury`,subtitle:`Iron-Core Terrestrial Planet · 0.387 AU`,parent:0,kind:1,massSolar:1.6601e-7,radiusKm:2439.7,aAu:.387098,e:.20563,incDeg:7.005,omDeg:48.33,wDeg:29.12,m0Deg:174.8,axialObliquityDeg:.03,spinAxisLonDeg:18,rotationPeriodHr:1407.6,tidallyLocked:!1,color0:[.58,.54,.5],color1:[.36,.33,.31],atm:0,surfacePressurePa:0,tempK:440,centralP:4e10,coreZ:26,mantleZ:14,surfZ:14,composition:`Fe Core 70% · Silicate Mantle 30%`},{id:`venus`,name:`Venus`,subtitle:`Super-Greenhouse Terrestrial Planet · 0.723 AU`,parent:0,kind:2,massSolar:24478e-10,radiusKm:6051.8,aAu:.723332,e:.00677,incDeg:3.395,omDeg:76.68,wDeg:54.88,m0Deg:50.1,axialObliquityDeg:177.36,spinAxisLonDeg:300,rotationPeriodHr:-5832.5,tidallyLocked:!1,color0:[.9,.78,.52],color1:[.76,.58,.34],atm:.85,surfacePressurePa:92e5,tempK:737,centralP:29e10,coreZ:26,mantleZ:14,surfZ:6,composition:`Fe/Ni Core · SiO₂ Mantle · CO₂ 96.5% Atm`},{id:`earth`,name:`Earth`,subtitle:`Oceanic Silicate-Iron Biosphere · 1.000 AU`,parent:0,kind:1,massSolar:Ye,radiusKm:6371,aAu:1.000001,e:.01671,incDeg:0,omDeg:0,wDeg:102.94,m0Deg:357.5,axialObliquityDeg:23.44,spinAxisLonDeg:90,rotationPeriodHr:23.934,tidallyLocked:!1,civTechK:.73,color0:[.24,.48,.24],color1:[.06,.26,.58],atm:.72,surfacePressurePa:101325,tempK:288,centralP:364e9,coreZ:26,mantleZ:14,surfZ:29,composition:`Fe 32.1% · O 30.1% · Si 15.1% · Mg 13.9%`},{id:`moon`,name:`Moon (Luna)`,subtitle:`Earth Natural Satellite · 384,400 km`,parent:3,kind:3,massSolar:3.6943e-8,radiusKm:1737.4,aAu:.0025695,e:.0549,incDeg:5.145,omDeg:125.08,wDeg:318.15,m0Deg:135.2,axialObliquityDeg:6.68,spinAxisLonDeg:125,rotationPeriodHr:655.72,tidallyLocked:!0,color0:[.68,.67,.65],color1:[.42,.41,.4],atm:0,surfacePressurePa:0,tempK:220,centralP:48e8,coreZ:26,mantleZ:14,surfZ:14,composition:`O 43% · Si 20% · Mg 19% · Fe 10% · Ca/Al 8%`},{id:`mars`,name:`Mars`,subtitle:`Iron-Oxide Terrestrial World · 1.524 AU`,parent:0,kind:1,massSolar:3.22715e-7,radiusKm:3389.5,aAu:1.523679,e:.0934,incDeg:1.85,omDeg:49.56,wDeg:286.5,m0Deg:19.4,axialObliquityDeg:25.19,spinAxisLonDeg:85,rotationPeriodHr:24.623,tidallyLocked:!1,color0:[.74,.34,.2],color1:[.52,.24,.14],atm:.18,surfacePressurePa:610,tempK:210,centralP:4e10,coreZ:26,mantleZ:14,surfZ:26,composition:`Fe-S Core · Basalt/Fe₂O₃ Crust · CO₂ Atm`},{id:`jupiter`,name:`Jupiter`,subtitle:`Metallic-Hydrogen Gas Giant · 5.204 AU`,parent:0,kind:2,massSolar:954588e-9,radiusKm:69911,aAu:5.2044,e:.0489,incDeg:1.303,omDeg:100.46,wDeg:273.87,m0Deg:20,axialObliquityDeg:3.13,spinAxisLonDeg:247,rotationPeriodHr:9.925,tidallyLocked:!1,color0:[.85,.72,.56],color1:[.62,.42,.28],atm:.45,surfacePressurePa:1e5,tempK:125,centralP:45e10,coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ 89.8% · He 10.2% · Metallic H Mantle`},{id:`io`,name:`Io`,subtitle:`Tidally Heated Volcanic Galilean Moon · 421,700 km`,parent:6,kind:1,massSolar:4.491e-8,radiusKm:1821.6,aAu:.002819,e:.0041,incDeg:1.34,omDeg:43.9,wDeg:84.1,m0Deg:35,axialObliquityDeg:.05,spinAxisLonDeg:247,rotationPeriodHr:42.456,tidallyLocked:!0,color0:[.92,.82,.34],color1:[.68,.46,.14],atm:0,surfacePressurePa:0,tempK:110,centralP:8e9,coreZ:26,mantleZ:14,surfZ:16,composition:`Fe-FeS Core · Silicate Mantle · Sulfur Crust`},{id:`europa`,name:`Europa`,subtitle:`Subsurface-Ocean Icy Galilean Moon · 671,100 km`,parent:6,kind:3,massSolar:2.414e-8,radiusKm:1560.8,aAu:.004486,e:.009,incDeg:1.77,omDeg:219.1,wDeg:88.9,m0Deg:145,axialObliquityDeg:.1,spinAxisLonDeg:247,rotationPeriodHr:85.228,tidallyLocked:!0,color0:[.84,.8,.74],color1:[.58,.68,.78],atm:0,surfacePressurePa:0,tempK:102,centralP:5e9,coreZ:26,mantleZ:14,surfZ:8,composition:`H₂O Ice/Ocean Shell · Silicate Mantle · Fe Core`},{id:`ganymede`,name:`Ganymede`,subtitle:`Magnetized Giant Galilean Moon · 1,070,400 km`,parent:6,kind:3,massSolar:7.452e-8,radiusKm:2634.1,aAu:.007155,e:.0013,incDeg:1.5,omDeg:63.5,wDeg:192.4,m0Deg:260,axialObliquityDeg:.2,spinAxisLonDeg:247,rotationPeriodHr:171.71,tidallyLocked:!0,color0:[.64,.6,.56],color1:[.46,.48,.52],atm:0,surfacePressurePa:0,tempK:110,centralP:1e10,coreZ:26,mantleZ:14,surfZ:8,composition:`H₂O Ice/Liquid Layers · Silicate · Fe Core`},{id:`saturn`,name:`Saturn`,subtitle:`Ringed Gas Giant · 9.582 AU`,parent:0,kind:2,massSolar:285815e-9,radiusKm:58232,aAu:9.5826,e:.0565,incDeg:2.485,omDeg:113.67,wDeg:339.39,m0Deg:317,axialObliquityDeg:26.73,spinAxisLonDeg:80,rotationPeriodHr:10.656,tidallyLocked:!1,color0:[.88,.79,.58],color1:[.7,.6,.42],atm:.42,surfacePressurePa:1e5,ringed:!0,ringInnerKm:74500,ringOuterKm:136775,tempK:95,centralP:34e10,coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ 96.3% · He 3.25% · H₂O Ice Ring System`},{id:`titan`,name:`Titan`,subtitle:`Dense-Atmosphere Methane Moon · 1,221,870 km`,parent:10,kind:2,massSolar:6.766e-8,radiusKm:2574.7,aAu:.008168,e:.0288,incDeg:2.8,omDeg:28,wDeg:180.5,m0Deg:65,axialObliquityDeg:26.73,spinAxisLonDeg:80,rotationPeriodHr:382.68,tidallyLocked:!0,color0:[.86,.68,.34],color1:[.64,.46,.22],atm:.78,surfacePressurePa:146700,tempK:94,centralP:6e9,coreZ:14,mantleZ:8,surfZ:6,composition:`N₂ 94.2% · CH₄ 5.6% Atm · H₂O/Silicate Interior`},{id:`uranus`,name:`Uranus`,subtitle:`Tilted Ringed Ice Giant (97.8°) · 19.20 AU`,parent:0,kind:3,massSolar:43658e-9,radiusKm:25362,aAu:19.2184,e:.0463,incDeg:.773,omDeg:74.01,wDeg:96.99,m0Deg:142.2,axialObliquityDeg:97.77,spinAxisLonDeg:168,rotationPeriodHr:-17.24,tidallyLocked:!1,color0:[.56,.84,.9],color1:[.42,.72,.82],atm:.58,surfacePressurePa:1e5,tempK:59,ringed:!0,ringInnerKm:38e3,ringOuterKm:51149,ringColor:[.6,.72,.82],ringNormal:[.985,.14,.1],centralP:26e10,coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/NH₃/CH₄ Superionic Mantle · Vertical ε-Ring System`},{id:`neptune`,name:`Neptune`,subtitle:`Supersonic-Wind Ice Giant · 30.07 AU`,parent:0,kind:3,massSolar:51503e-9,radiusKm:24622,aAu:30.1104,e:.0095,incDeg:1.77,omDeg:131.78,wDeg:276.34,m0Deg:256.2,axialObliquityDeg:28.32,spinAxisLonDeg:44,rotationPeriodHr:16.11,tidallyLocked:!1,color0:[.24,.46,.94],color1:[.16,.3,.78],atm:.65,surfacePressurePa:1e5,tempK:55,centralP:29e10,coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/CH₄/NH₃ Mantle · H₂ 80% · He 19%`},{id:`halley`,name:`1P/Halley Comet`,subtitle:`Active Outgassing Periodic Comet · e = 0.967`,parent:0,kind:3,massSolar:11e-17,radiusKm:5.5,aAu:17.834,e:.9671,incDeg:162.26,omDeg:58.42,wDeg:111.33,m0Deg:38.4,axialObliquityDeg:30,spinAxisLonDeg:140,rotationPeriodHr:52.8,tidallyLocked:!1,isComet:!0,isMinorBody:!0,color0:[.74,.9,1],color1:[.42,.68,.92],atm:.2,surfacePressurePa:0,volatileMassFrac:.72,tempK:170,centralP:1e5,coreZ:8,mantleZ:6,surfZ:14,composition:`H₂O 80% · CO 10% · CO₂/CH₄/Silicate Dust`},{id:`ceres`,name:`1 Ceres`,subtitle:`Main-Belt Cryo-Silicate Dwarf Planet · 2.767 AU`,parent:0,kind:3,massSolar:472e-12,radiusKm:469.7,aAu:2.7675,e:.0758,incDeg:10.59,omDeg:80.33,wDeg:73.6,m0Deg:95.9,axialObliquityDeg:4,spinAxisLonDeg:291,rotationPeriodHr:9.074,tidallyLocked:!1,isMinorBody:!0,color0:[.56,.55,.54],color1:[.34,.36,.4],atm:0,surfacePressurePa:0,volatileMassFrac:.25,tempK:168,centralP:12e7,coreZ:14,mantleZ:8,surfZ:14,composition:`Hydrated Phyllosilicates · H₂O Ice Mantle · Na₂CO₃ Evaporites`},{id:`vesta`,name:`4 Vesta`,subtitle:`Differentiated Basaltic Asteroid · 2.362 AU`,parent:0,kind:1,massSolar:13e-11,radiusKm:262.7,aAu:2.3615,e:.0887,incDeg:7.14,omDeg:103.85,wDeg:151.2,m0Deg:205.5,axialObliquityDeg:29,spinAxisLonDeg:309,rotationPeriodHr:5.342,tidallyLocked:!1,isMinorBody:!0,color0:[.64,.6,.56],color1:[.4,.36,.32],atm:0,surfacePressurePa:0,volatileMassFrac:.01,tempK:185,centralP:45e6,coreZ:26,mantleZ:14,surfZ:14,composition:`Fe-Ni Core · Eucrite/Diogenite Basalt Crust`},{id:`psyche`,name:`16 Psyche`,subtitle:`Metallic Fe-Ni Asteroid Core · 2.923 AU`,parent:0,kind:1,massSolar:115e-13,radiusKm:111,aAu:2.923,e:.134,incDeg:3.1,omDeg:150.2,wDeg:228,m0Deg:312,axialObliquityDeg:95,spinAxisLonDeg:34,rotationPeriodHr:4.196,tidallyLocked:!1,isMinorBody:!0,isMetallicAsteroid:!0,color0:[.7,.68,.66],color1:[.42,.44,.48],atm:0,surfacePressurePa:0,volatileMassFrac:0,tempK:162,centralP:18e6,coreZ:26,mantleZ:28,surfZ:26,composition:`Fe 82% · Ni 10% · Orthopyroxene Silicate 8%`},{id:`bennu`,name:`101955 Bennu`,subtitle:`Near-Earth Carbonaceous Rubble-Pile Asteroid · 1.126 AU`,parent:0,kind:1,massSolar:369e-22,radiusKm:.245,aAu:1.1264,e:.2037,incDeg:6.035,omDeg:2.06,wDeg:66.22,m0Deg:101.7,axialObliquityDeg:177.6,spinAxisLonDeg:85,rotationPeriodHr:4.296,tidallyLocked:!1,isMinorBody:!0,color0:[.3,.28,.27],color1:[.16,.15,.15],atm:0,surfacePressurePa:0,volatileMassFrac:.12,tempK:268,centralP:8,coreZ:6,mantleZ:14,surfZ:6,composition:`C-Type Chondrite · Magnetite · Hydrated Clay & Organics`},{id:`enceladus`,name:`Enceladus`,subtitle:`Cryovolcanic Ocean Moon (Saturn) · 237,948 km`,parent:10,kind:3,massSolar:543e-13,radiusKm:252.1,aAu:.001591,e:.0047,incDeg:2.5,omDeg:112,wDeg:16,m0Deg:215,axialObliquityDeg:.02,spinAxisLonDeg:80,rotationPeriodHr:32.885,tidallyLocked:!0,isCryoMoon:!0,color0:[.95,.97,.99],color1:[.52,.74,.92],atm:0,surfacePressurePa:0,volatileMassFrac:.42,tempK:75,centralP:65e6,coreZ:14,mantleZ:8,surfZ:8,composition:`Bright H₂O Ice Crust · Global Subsurface Ocean · Tiger-Stripe Plumes`},{id:`triton`,name:`Triton`,subtitle:`Retrograde Captured Kuiper Moon (Neptune) · 354,759 km`,parent:13,kind:3,massSolar:1.076e-8,radiusKm:1353.4,aAu:.002371,e:16e-6,incDeg:156.885,omDeg:177.6,wDeg:220.5,m0Deg:120,axialObliquityDeg:0,spinAxisLonDeg:44,rotationPeriodHr:-141.04,tidallyLocked:!0,isCryoMoon:!0,color0:[.85,.78,.74],color1:[.54,.44,.48],atm:.04,surfacePressurePa:1.4,volatileMassFrac:.34,tempK:38,centralP:16e8,coreZ:14,mantleZ:8,surfZ:7,composition:`N₂/CH₄/CO Cryo-Frost Crust · Cantaloupe Terrain · Nitrogen Geysers`},{id:`pluto`,name:`Pluto`,subtitle:`Kuiper Belt Binary Dwarf Planet · 39.48 AU`,parent:0,kind:3,massSolar:6.55e-9,radiusKm:1188.3,aAu:39.482,e:.2488,incDeg:17.16,omDeg:110.3,wDeg:113.83,m0Deg:14.5,axialObliquityDeg:122.53,spinAxisLonDeg:133,rotationPeriodHr:-153.29,tidallyLocked:!1,isCryoMoon:!0,color0:[.84,.76,.68],color1:[.46,.26,.2],atm:.05,surfacePressurePa:1,volatileMassFrac:.3,tempK:44,centralP:11e8,coreZ:14,mantleZ:8,surfZ:7,composition:`N₂ Ice Tombaugh Basin · CH₄ Tholin Highlands · H₂O Ice Bedrock`},{id:`charon`,name:`Charon`,subtitle:`Binary Dwarf Companion (Pluto) · 19,591 km`,parent:21,kind:3,massSolar:798e-12,radiusKm:606,aAu:131e-6,e:2e-4,incDeg:17.2,omDeg:110.3,wDeg:114,m0Deg:194.5,axialObliquityDeg:122.5,spinAxisLonDeg:133,rotationPeriodHr:-153.29,tidallyLocked:!0,color0:[.64,.62,.6],color1:[.44,.26,.22],atm:0,surfacePressurePa:0,volatileMassFrac:.28,tempK:53,centralP:31e7,coreZ:14,mantleZ:8,surfZ:8,composition:`H₂O/NH₃ Cryo-Ice Crust · Mordor Macula Tholin Polar Cap`}]);function $e(e){let t=Math.fround(e);return[t,Math.fround(e-t)]}function et(e,t){let n=t<.8?e:Math.PI;for(let r=0;r<12;r+=1){let r=n-t*Math.sin(n)-e,i=1-t*Math.cos(n),a=r/Math.max(1e-9,i);if(n-=a,Math.abs(a)<1e-12)break}return n}function tt({aAu:e,e:t=0,incDeg:n=0,omDeg:r=0,wDeg:i=0,m0Deg:a=0},o){if(!(e>0)||!(o>0))return{pos:[0,0,0],vel:[0,0,0]};let s=Math.PI/180,c=n*s,l=r*s,u=i*s,d=et((a*s%(2*Math.PI)+2*Math.PI)%(2*Math.PI),t),f=Math.cos(d),p=Math.sin(d),m=Math.sqrt(Math.max(1e-12,1-t*t)),h=e*(1-t*f),g=e*(f-t),_=e*m*p,v=Math.sqrt(o*e)/Math.max(1e-12,h),y=-v*p,b=v*m*f,x=Math.cos(l),S=Math.sin(l),C=Math.cos(u),w=Math.sin(u),T=Math.cos(c),E=Math.sin(c),D=x*C-S*w*T,O=S*C+x*w*T,k=w*E,A=-x*w-S*C*T,j=-S*w+x*C*T,M=C*E;return{pos:[D*g+A*_,k*g+M*_,O*g+j*_],vel:[D*y+A*b,k*y+M*b,O*y+j*b]}}function nt(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function rt(e,{asteroidCount:t=512,beltZoneAu:n=null,seed:r=20261125,starMassScale:i=1,centerOffsetAu:a=[0,0,0]}={}){let o=Array.isArray(e)&&e.length>0?e:Qe,s=o.length,c=Math.max(0,Math.min(4096,Math.trunc(Number(t)||0))),l=s+c,u=Array.from({length:l},()=>[0,0,0]),d=Array.from({length:l},()=>[0,0,0]),f=new Float64Array(l),p=new Float64Array(l),m=new Float32Array(l),h=Math.max(.1,Number(i)||1),g=0;for(let e=0;e<s;e+=1){let t=o[e],n=!!t.isStar||e===0;n&&(g+=1),f[e]=n?t.massSolar*h:t.massSolar,p[e]=t.radiusKm*1e3/Je,m[e]=t.kind}let _=[0,0,0],v=[0,0,0],y=f[0];if(g>=2&&o[1]?.orbitRole===`binary-companion`){let e=f[0],t=f[1];y=e+t;let n=tt(o[1],Xe*y),r=-t/Math.max(1e-12,y),i=e/Math.max(1e-12,y);u[0]=[n.pos[0]*r,n.pos[1]*r,n.pos[2]*r],d[0]=[n.vel[0]*r,n.vel[1]*r,n.vel[2]*r],u[1]=[n.pos[0]*i,n.pos[1]*i,n.pos[2]*i],d[1]=[n.vel[0]*i,n.vel[1]*i,n.vel[2]*i]}if(g>=3&&o[2]?.orbitRole===`trinary-outer`){let e=f[2],t=y+e,n=tt(o[2],Xe*t),r=-e/Math.max(1e-12,t),i=y/Math.max(1e-12,t);_=[n.pos[0]*r,n.pos[1]*r,n.pos[2]*r],v=[n.vel[0]*r,n.vel[1]*r,n.vel[2]*r];for(let e=0;e<2;e+=1)u[e]=[u[e][0]+_[0],u[e][1]+_[1],u[e][2]+_[2]],d[e]=[d[e][0]+v[0],d[e][1]+v[1],d[e][2]+v[2]];u[2]=[n.pos[0]*i,n.pos[1]*i,n.pos[2]*i],d[2]=[n.vel[0]*i,n.vel[1]*i,n.vel[2]*i]}for(let e=g;e<s;e+=1){let t=o[e],n=f[e];if(t.parent===-2){let r=tt(t,Xe*(y+n));u[e]=[_[0]+r.pos[0],_[1]+r.pos[1],_[2]+r.pos[2]],d[e]=[v[0]+r.vel[0],v[1]+r.vel[1],v[2]+r.vel[2]]}else if(t.parent>=0&&t.parent<e){let r=t.parent,i=tt(t,Xe*(f[r]+n));u[e]=[u[r][0]+i.pos[0],u[r][1]+i.pos[1],u[r][2]+i.pos[2]],d[e]=[d[r][0]+i.vel[0],d[r][1]+i.vel[1],d[r][2]+i.vel[2]]}}let b=0,x=0,S=0,C=0,w=0,T=0,E=0;for(let e=0;e<s;e+=1){let t=f[e];b+=t,x+=t*u[e][0],S+=t*u[e][1],C+=t*u[e][2],w+=t*d[e][0],T+=t*d[e][1],E+=t*d[e][2]}x/=Math.max(1e-12,b),S/=Math.max(1e-12,b),C/=Math.max(1e-12,b);let D=w/Math.max(1e-12,b),O=T/Math.max(1e-12,b),k=E/Math.max(1e-12,b);for(let e=0;e<s;e+=1)u[e][0]-=x,u[e][1]-=S,u[e][2]-=C,d[e][0]-=D,d[e][1]-=O,d[e][2]-=k;_=[_[0]-x,_[1]-S,_[2]-C],v=[v[0]-D,v[1]-O,v[2]-k];let A=nt(r^2654435769),j=g>=2&&(o[1]?.aAu||10)<1.5,M=j?_:u[0],N=j?v:d[0],P=Xe*(j?y:f[0]),F=n?.innerAu??2.15,I=n?.outerAu??3.3,L=n?.kuiperInnerAu??32,R=n?.kuiperOuterAu??46;for(let e=0;e<c;e+=1){let t=s+e,n=e>=Math.floor(c*.72),r=tt({aAu:n?L+A()*Math.max(.5,R-L):F+A()*Math.max(.25,I-F),e:n?.02+A()*.14:.01+A()*.16,incDeg:(A()-.5)*(n?14:12),omDeg:A()*360,wDeg:A()*360,m0Deg:A()*360},P);u[t]=[M[0]+r.pos[0],M[1]+r.pos[1],M[2]+r.pos[2]],d[t]=[N[0]+r.vel[0],N[1]+r.vel[1],N[2]+r.vel[2]],f[t]=0,p[t]=(15+A()*85)*1e3/Je,m[t]=n?7:6}let z=Number(a?.[0])||0,ee=Number(a?.[1])||0,B=Number(a?.[2])||0,V=new Float32Array(l*16);for(let e=0;e<l;e+=1){let[t,n]=$e(u[e][0]+z),[r,i]=$e(u[e][1]+ee),[a,o]=$e(u[e][2]+B),s=e*16;V[s+0]=t,V[s+1]=r,V[s+2]=a,V[s+3]=f[e],V[s+4]=n,V[s+5]=i,V[s+6]=o,V[s+7]=p[e],V[s+8]=d[e][0],V[s+9]=d[e][1],V[s+10]=d[e][2],V[s+11]=m[e],V[s+12]=0,V[s+13]=0,V[s+14]=0,V[s+15]=0}return Object.freeze({packed:V,massiveCount:s,starCount:g,asteroidCount:c,totalCount:l,catalog:o})}var it=`
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
`;function at(e,{catalog:t=null,beltZoneAu:n=null,asteroidCount:r=512,seed:i=20261125,starMassScale:a=1,centerOffsetAu:o=[0,0,0],softeningAu:s=1e-7,label:c=`ulg-solar-system-nbody`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createSolarSystemNBodyEngineWebGpu requires a live WebGPU GPUDevice`);let l=rt(t||Qe,{asteroidCount:r,beltZoneAu:n,seed:i,starMassScale:a,centerOffsetAu:o}),u=[C(0,`uniform`),C(1,`storage`)],d=t=>T(e,{cacheKey:`ulg-solar-nbody-${t}.v1`,label:`${c}-${t}`,code:it,entryPoint:t,bindings:u}),f=d(`compute_nbody_accel`),p=d(`kdk_half_kick_drift`),m=d(`kdk_second_kick`),h=e.createBuffer({label:`${c}-params`,size:32,usage:Ze.UNIFORM|Ze.COPY_DST}),g=e.createBuffer({label:`${c}-bodies`,size:l.packed.byteLength,usage:Ze.STORAGE|Ze.VERTEX|Ze.COPY_DST|Ze.COPY_SRC});e.queue.writeBuffer(g,0,l.packed);let _=l.massiveCount*64,v=e.createBuffer({label:`${c}-massive-staging`,size:_,usage:Ze.MAP_READ|Ze.COPY_DST}),y=w(e,{layout:f.bindGroupLayout,label:`${c}-bg`,entries:[{binding:0,resource:{buffer:h}},{binding:1,resource:{buffer:g}}]}),b=Float32Array.from(l.packed.subarray(0,l.massiveCount*16)),x=0,S=0,E=!1,D=!1,O=!1;function k(t){let n=new ArrayBuffer(32);new Uint32Array(n,0,4).set([l.totalCount,l.massiveCount,0,0]),new Float32Array(n,16,4).set([t,Xe,s*s,0]),e.queue.writeBuffer(h,0,n)}async function A({dtSubYr:t=45e-6,substeps:n=12,readMassive:r=!0}={}){if(O)return b;let i=Math.max(1,Math.min(64,Math.trunc(n))),a=Math.max(1e-7,Math.min(12e-5,Number(t)||45e-6));k(a);let o=Math.ceil(l.totalCount/64),s=e.createCommandEncoder({label:`${c}-step-${S}`}),u=s.beginComputePass({label:`${c}-pass`});u.setBindGroup(0,y),E||=(u.setPipeline(f.pipeline),u.dispatchWorkgroups(o),!0);for(let e=0;e<i;e+=1)u.setPipeline(p.pipeline),u.dispatchWorkgroups(o),u.setPipeline(f.pipeline),u.dispatchWorkgroups(o),u.setPipeline(m.pipeline),u.dispatchWorkgroups(o);u.end();let d=r&&!D;if(d&&s.copyBufferToBuffer(g,0,v,0,_),e.queue.submit([s.finish()]),S+=i,x+=a*i,d){D=!0;try{await v.mapAsync(Ze.MAP_READ),O||b.set(new Float32Array(v.getMappedRange(0,_))),v.unmap()}finally{D=!1}}return b}function j(e){let t=e*16;return{posAu:[b[t+0]+b[t+4],b[t+1]+b[t+5],b[t+2]+b[t+6]],velAuPerYr:[b[t+8],b[t+9],b[t+10]],massSolar:b[t+3],radiusAu:b[t+7],phi:b[t+15]}}function M(){let e=0,t=0,n=0,r=0,i=0,a=0,o=Array.from({length:l.massiveCount},(e,t)=>j(t));for(let c=0;c<o.length;c+=1){let l=o[c],u=l.velAuPerYr[0]**2+l.velAuPerYr[1]**2+l.velAuPerYr[2]**2;e+=.5*l.massSolar*u,n+=l.massSolar*l.velAuPerYr[0],r+=l.massSolar*l.velAuPerYr[1],i+=l.massSolar*l.velAuPerYr[2],a+=l.massSolar*Math.sqrt(u);for(let e=c+1;e<o.length;e+=1){let n=o[e],r=n.posAu[0]-l.posAu[0],i=n.posAu[1]-l.posAu[1],a=n.posAu[2]-l.posAu[2],c=Math.sqrt(r*r+i*i+a*a+s*s);t-=Xe*l.massSolar*n.massSolar/c}}return Object.freeze({kineticEnergy:e,potentialEnergy:t,totalEnergy:e+t,momentum:Object.freeze([n,r,i]),relMomentumError:Math.hypot(n,r,i)/Math.max(1e-12,a),simTimeYr:x,stepIndex:S})}function N(){if(!O){O=!0;for(let e of[h,g,v])try{e.destroy()}catch{}}}return Object.freeze({schema:qe,get massiveCount(){return l.massiveCount},get starCount(){return l.starCount},get asteroidCount(){return l.asteroidCount},get totalCount(){return l.totalCount},get stepIndex(){return S},get simTimeYr(){return x},get catalog(){return l.catalog},getResidentBuffer:()=>g,getMassiveSnapshot:()=>b,getMassiveBodyState64:j,computeConservationDiagnostics:M,step:A,dispose:N})}var ot=26.95,st=-14.8,ct=Object.freeze([Object.freeze({level:0,id:`cosmic-web`,shortLabel:`Web`,name:`Observable Universe Cosmic Web`,exponentLabel:`10²⁷ m`,log10SpanM:26.6,minLog10:21.8,maxLog10:26.95,diveVerb:`APPROACHING GALAXY`,diveButton:`⚡ ZOOM TO GALAXY`,engineSchema:`ulg.astrophysics.supergalactic-flrw-treepm.v1`,plotTitle:`GPU MATTER POWER SPECTRUM P(k)`,equations:`∇²Φ = (3/2) Ω_m (H₀² / a) δ(x, t)   [3D-FFT Poisson via fft3dWebGpu]
dp/da = −(1 / a² H(a)) ∇Φ   (Symplectic KDK FLRW Comoving Integrator)`,summary:`Evolves full-Nyquist 2LPT dark-matter filaments (1-submit FLRW 3D-FFT TreePM) AND the general Cosmological Baryon & Radiation law (Eisenstein–Hu BAO/CMB recombination ΔT/T at z=1100, Pop III UV Reionization bubble percolation at z=10, and Bullet-Cluster X-ray ICM shock + 2D gravitational lensing convergence κ/α).`,kernels:`build2LptCosmologyICsWebGpu · createSupergalacticTreePmSessionWebGpu · createCosmologicalBaryonRadiationSessionWebGpu`}),Object.freeze({level:1,id:`galaxy`,shortLabel:`Galaxy`,name:`Spiral Galaxy & Halo`,exponentLabel:`10²¹ m`,log10SpanM:21,minLog10:15.8,maxLog10:22.8,diveVerb:`APPROACHING SOLAR SYSTEM`,diveButton:`⚡ ZOOM TO TARGET`,engineSchema:`webgpu-schroeder-scale-atlas-multipole`,plotTitle:`GATE 1 ISM COOLING CURVE Λ(T, Z)`,equations:`a_i = −G Σ_cell M_cell (r_i − r_cell) / (|r_i − r_cell|² + ε²)^(3/2)   [SchroederScaleAtlas]
v_c(r) ≈ const (NFW dark-matter halo + exponential disk + bulge) · Λ(T, Z) from Gate 1 H/He/C/O`,summary:`Simulates 16K–65K GPU-resident stars on parallel SchroederScaleAtlas multipole gravity across 7 emergent morphologies (Grand-Design Spiral, Barred Spiral, Major Merger, Giant Elliptical, High-z Clumpy Protogalaxy, Tidally Disrupted Dwarf & Halo Stream, and Core-Collapsed Globular Cluster) plus Gate 1 ISM cooling Λ(T, Z).`,kernels:`createResidentScaleAtlasMultipoleNBodyEngine · deriveGate1IsmCoolingAnchorsWebGpu`}),Object.freeze({level:2,id:`star-system`,shortLabel:`System`,name:`Solar System & Protoplanetary Formation`,exponentLabel:`10¹² m`,log10SpanM:12.6,minLog10:7.9,maxLog10:16.8,diveVerb:`APPROACHING WORLD`,diveButton:`⚡ ZOOM TO SELECTED BODY`,engineSchema:`ulg.astrophysics.solar-system-nbody-webgpu.v1`,plotTitle:`SYMPLECTIC N-BODY & ACCRETION DISK`,equations:`d²r_i/dt² = −G Σ_{j≠i} m_j (r_i − r_j) / |r_i − r_j|³   [f32x2 Symplectic GPU N-Body]
v_gas = (1−η)v_K · T(r) < T_snow → H₂O ice condensation · DLM Particle-Rigid Planetesimals`,summary:`Spans mature double-float symplectic Solar System N-body, Protoplanetary Disk Accretion, Roche-Limit Ring Disruption & Shepherd Moons, Giant Moon-Forming Impact, Active Dual-Tail Comets, Hot-Jupiter XUV Photoevaporation, Red-Giant Engulfment (+5 Gyr), Kerr Blandford–Znajek Quasar/Blazar Jets, Roche X-Ray Binaries, Type Ia Detonations, and 2.5PN GW Chirp BNS Kilonova / BBH Mergers.`,kernels:`createSolarSystemNBodyEngineWebGpu · createProtoplanetaryDiskFormationSessionWebGpu · createKerrAccretionJetSessionWebGpu · createRelativisticBinaryMergerSessionWebGpu · createTidalRocheDisruptionSessionWebGpu`}),Object.freeze({level:3,id:`stellar-core`,shortLabel:`Star/MHD`,name:`MHD Nebular Collapse & Stellar Fusion`,exponentLabel:`10⁹ m`,log10SpanM:9.2,minLog10:7.4,maxLog10:10.6,diveVerb:`SAMPLING PLANETARY MATTER`,diveButton:`⚡ ZOOM TO EARTH / MATTER`,engineSchema:`ulg.astrophysics.nebular-mhd-collapse-webgpu.v1`,plotTitle:`GAMOW FUSION WINDOW / MHD MAGNETIC ENERGY`,equations:`∂B/∂t = ∇×(v×B) + η∇²B − ∇ψ,   F_L = (∇×B)×B / μ₀   [3D Resistive MHD + Dedner GLM]
du/dt = −(P/ρ)∇·v + q_visc + ε_pp + ε_CNO + ε_3α − Λ_rad   [self-gravitating-hydro@1]`,summary:`Spans live Stellar Core Fusion, 3D Resistive MHD Nebular Collapse & Bipolar Jets, Strömgren Photoionized H II Star-Forming Pillars, Bipolar Planetary Nebulae, Supernova Remnants / Crab PWN, Spitkovsky Millisecond Pulsars, Hall-Crustal-Yield Magnetar Giant Flares, and live WebGPU GR TOV Unified Degenerate EOS (White Dwarf → Neutron Star → Black Hole).`,kernels:`createNebularMhdCollapseSessionWebGpu · createSelfGravitatingHydroEngine · createRadiativePhotoionizationWindSessionWebGpu · createCompactMagnetosphereSessionWebGpu · solveRelativisticTovBatchWebGpu`}),Object.freeze({level:4,id:`planetary-interior`,shortLabel:`Planet`,name:`Planetary World, Atmosphere & Electrodynamics`,exponentLabel:`10⁷ m`,log10SpanM:7.2,minLog10:-5.8,maxLog10:8.6,diveVerb:`DESCENDING TO SURFACE`,diveButton:`🚙 LAND / DIVE TO SAMPLE`,engineSchema:`ulg.astrophysics.planetary-atmosphere-em-webgpu.v1`,plotTitle:`HYDROSTATIC P(r) & ATMOSPHERIC EM`,equations:`dv/dt + 2Ω×v = −∇P/ρ · ∇²φ = −ρ_q/ε₀ · |E| > E_Paschen(P) → Lightning Discharge
dM/dr = 4π r² ρ_polytope(P, T),   B_dip(Ω, r_core, σ_Fe) → Magnetospheric Aurorae`,summary:`Dynamically activates ULG’s general spherical baroclinic atmosphere, particulate triboelectric charging, GPU Poisson Paschen lightning, core-geodynamo aurorae, Hadean Magma Ocean radiative crust, viscoelastic Cryovolcanic Icy Plumes, Tidally Locked Eyeball & Rogue Worlds, Gate 2 Polytope Atlas cutaway — PLUS an interactive Planetary Surface Explorer (TinyPlanetControls) with a 6-Wheel Jump-Rocket Mars Rover and Coaxial Atmospheric Drone whose rotor lift emerges strictly from local ρ_atm & g!`,kernels:`createPlanetaryAtmosphereElectricSessionWebGpu · createPlanetarySurfaceSessionWebGpu · solvePlanetaryInteriorWebGpu · createTidalRocheDisruptionSessionWebGpu`}),Object.freeze({level:5,id:`molecular-dynamics`,shortLabel:`MD`,name:`Crystal & Fluid Molecular Dynamics`,exponentLabel:`10⁻⁸ m`,log10SpanM:-8.2,minLog10:-9.5,maxLog10:-5.2,diveVerb:`RESOLVING ELECTRON SHELLS`,diveButton:`⚡ ZOOM TO QUANTUM ATOM`,engineSchema:`ulg.gpumath.molecular-dynamics-webgpu.v1`,plotTitle:`LIVE GPU RADIAL DISTRIBUTION g(r)`,equations:`m_i d²r_i/dt² = −∇_i [ Σ φ_pair(r_ij) + Σ F_EAM(ρ_i) + Σ V_3(r_ij, r_ik) ] + m_i g
O(N) lock-free linked-cell Verlet + Berendsen thermostat & live 64-bin GPU g(r)`,summary:`Evolves 1,000–4,000 live atoms of the sampled planetary material strictly on WebGPU using Gate 1 DFT-derived pair/EAM/Stillinger–Weber potentials and physical Gate 1 optical reflectance. Heat through melting & vaporization, toggle GPU gravity, or keep scrolling inward straight into a single atom’s electron shells.`,kernels:`createMolecularDynamicsSessionWebGpu · buildCrystalMdState · zero-copy positionsBuffer/velocitiesBuffer`}),Object.freeze({level:6,id:`quantum-atom`,shortLabel:`Atom`,name:`Relativistic Dirac–KS Atom & Molecule`,exponentLabel:`10⁻¹⁰ m`,log10SpanM:-10,minLog10:-13.2,maxLog10:-9,diveVerb:`PROBING STRONG FORCE CORE`,diveButton:`⚡ ZOOM TO NUCLEUS`,engineSchema:`ulg.electronic.orbital-cloud-webgpu.v1`,plotTitle:`DIRAC–KS 4πr²ρ(r) & SUBSHELL LEVELS`,equations:`[c α·p + β m c² + V_nuc(R_nuc) + V_H(ρ) + V_xc(ρ)] ψ_κ = ε_κ ψ_κ   [4-comp Dirac–KS]
|ψ_nlm(r, θ, φ)|² = |R_nl(r)|² |Y_lm(θ, φ)|²   (separable GPU inverse-CDF cloud)`,summary:`Solves 4-component relativistic radial Dirac–Kohn–Sham equations on WebGPU (0 per-SCF readbacks) and samples 60K–180K continuous 3D wavefunction points into a resident GPU buffer. Keep scrolling inward through 5 orders of magnitude of empty intra-atomic space to resolve the femtometer nucleus.`,kernels:`deriveElementBundleWebGpu · solveAtomFullWebGpu · sampleAtomicOrbitalCloudWebGpu · solveMoleculeRhfWebGpu`}),Object.freeze({level:7,id:`atomic-nucleus`,shortLabel:`Nucleus`,name:`Atomic Nucleus & Quantum Tunneling`,exponentLabel:`10⁻¹⁵ m`,log10SpanM:-14.3,minLog10:-15.2,maxLog10:-12.6,diveVerb:`ZOOMING OUT TO COSMOS`,diveButton:`↻ FLY OUT TO COSMIC WEB`,engineSchema:`ulg.nuclear.tunneling-tdse-webgpu.v1`,plotTitle:`SYMPLECTIC VISSCHER TDSE |ψ(r, t)|²`,equations:`iℏ ∂ψ/∂t = [−(ℏ²/2μ) ∂²/∂r² + V_WS(r) + V_Coulomb(r)] ψ(r, t)   [Visscher symplectic]
ρ_p,n(r) = ρ₀ / [1 + exp((r − R_p,n) / a)]   ·   B(Z, A) feeds L3 Stellar Q-values`,summary:`Visualizes Z quantized protons and N quantized neutrons packed inside the GPU-solved Woods–Saxon charge/neutron-skin radii surrounded by a live symplectic Visscher 1D quantum α-tunneling probability wavepacket. Its binding energy B(Z, A) closes the causal loop back up to L3 stellar fusion.`,kernels:`solveNuclearStructureWebGpu · createNuclearTunnelingTdseWebGpu (nuclear-tunneling-tdse@1)`})]),lt=Object.freeze([{Z:1,A:1,sym:`H`,name:`Hydrogen`,defaultN:1,defaultL:0,defaultM:0},{Z:2,A:4,sym:`He`,name:`Helium`,defaultN:1,defaultL:0,defaultM:0},{Z:6,A:12,sym:`C`,name:`Carbon`,defaultN:2,defaultL:1,defaultM:0},{Z:7,A:14,sym:`N`,name:`Nitrogen`,defaultN:2,defaultL:1,defaultM:0},{Z:8,A:16,sym:`O`,name:`Oxygen`,defaultN:2,defaultL:1,defaultM:0},{Z:11,A:23,sym:`Na`,name:`Sodium`,defaultN:3,defaultL:0,defaultM:0},{Z:12,A:24,sym:`Mg`,name:`Magnesium`,defaultN:3,defaultL:0,defaultM:0},{Z:13,A:27,sym:`Al`,name:`Aluminum`,defaultN:3,defaultL:1,defaultM:0},{Z:14,A:28,sym:`Si`,name:`Silicon`,defaultN:3,defaultL:1,defaultM:0},{Z:16,A:32,sym:`S`,name:`Sulfur`,defaultN:3,defaultL:1,defaultM:0},{Z:17,A:35,sym:`Cl`,name:`Chlorine`,defaultN:3,defaultL:1,defaultM:0},{Z:20,A:40,sym:`Ca`,name:`Calcium`,defaultN:4,defaultL:0,defaultM:0},{Z:22,A:48,sym:`Ti`,name:`Titanium`,defaultN:3,defaultL:2,defaultM:0},{Z:26,A:56,sym:`Fe`,name:`Iron`,defaultN:3,defaultL:2,defaultM:0},{Z:28,A:58,sym:`Ni`,name:`Nickel`,defaultN:3,defaultL:2,defaultM:0},{Z:29,A:63,sym:`Cu`,name:`Copper`,defaultN:3,defaultL:2,defaultM:0},{Z:55,A:133,sym:`Cs`,name:`Cesium`,defaultN:6,defaultL:0,defaultM:0},{Z:79,A:197,sym:`Au`,name:`Gold`,defaultN:5,defaultL:2,defaultM:0},{Z:80,A:202,sym:`Hg`,name:`Mercury`,defaultN:5,defaultL:2,defaultM:0},{Z:82,A:208,sym:`Pb`,name:`Lead`,defaultN:6,defaultL:1,defaultM:0},{Z:92,A:238,sym:`U`,name:`Uranium`,defaultN:5,defaultL:3,defaultM:0}]),ut=Object.freeze({low:Object.freeze({id:`low`,cosmoGridPerSide:22,cosmoFftN:16,galaxyStars:16384,solarAsteroids:256,stellarParticles:2048,mdCells:6,orbitalPoints:48e3,nuclearVolDim:24}),med:Object.freeze({id:`med`,cosmoGridPerSide:28,cosmoFftN:32,galaxyStars:32768,solarAsteroids:512,stellarParticles:4096,mdCells:7,orbitalPoints:96e3,nuclearVolDim:28}),high:Object.freeze({id:`high`,cosmoGridPerSide:32,cosmoFftN:32,galaxyStars:49152,solarAsteroids:1024,stellarParticles:6144,mdCells:8,orbitalPoints:16e4,nuclearVolDim:32}),ultra:Object.freeze({id:`ultra`,cosmoGridPerSide:36,cosmoFftN:32,galaxyStars:65536,solarAsteroids:1536,stellarParticles:8192,mdCells:9,orbitalPoints:24e4,nuclearVolDim:32})});function dt(e){let t=10**e;return e>=25.4?`${(t/946073047e16).toFixed(1)} Gly`:e>=22?`${(t/308567758e14).toFixed(1)} Mpc`:e>=19?`${(t/0x834b443cc4108000).toFixed(1)} kly`:e>=15.8?`${(t/946073047e7).toFixed(2)} ly`:e>=10.6?`${(t/149597870700).toFixed(2)} AU`:e>=8.7?`${(t/6957e5).toFixed(2)} R☉`:e>=4?`${Math.round(t/1e3).toLocaleString()} km`:e>=0?`${t.toFixed(1)} m`:e>=-3?`${(t*1e3).toFixed(1)} mm`:e>=-6?`${(t*1e6).toFixed(1)} μm`:e>=-9.2?`${(t*1e9).toFixed(2)} nm`:e>=-11.5?`${(t*1e10).toFixed(2)} Å`:e>=-13?`${(t*0xe8d4a51000).toFixed(2)} pm`:`${(t*0x38d7ea4c68000).toFixed(1)} fm`}function ft(){return`
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
  `}function pt(e){return e?`
    <p>${e.summary}</p>
    <div class="uv-eq-box">${e.equations}</div>
    <p><strong>Active ULG WebGPU Engines:</strong> <code>${e.kernels}</code></p>
    <p><strong>Schema / Method ID:</strong> <code>${e.engineSchema}</code></p>
    <p><strong>Controls:</strong> Scroll wheel / pinch / drag the continuous 40-OOM slider to zoom smoothly across scales. Drag to orbit, click any target to focus &amp; inspect, and double-click to smoothly fly down into it.</p>
    <p style="font-size:12px;color:#94a3b8;"><strong>Provenance:</strong> GPU-native compute &amp; zero-copy rendering · <code>cameraAutoSpin: false</code> default · <code>scientificValidation: false</code> (advisory G7).</p>
  `:ft()}var mt=`ulg.astrophysics.causal-nebular-cascade.v1`,ht=Object.freeze([`Vela`,`Kepler`,`Cygnus`,`Lyra`,`Carina`,`Draco`,`Perseus`,`Norma`,`Scutum`,`Centauri`,`Aurelia`,`Eridani`,`Pavonis`,`Ceti`,`Tauri`,`Hydrae`]),gt=`bcdefghijklm`,_t=Object.freeze([`I`,`II`,`III`,`IV`,`V`,`VI`]);function vt(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function yt(e,t,n,r=1){let i=(r^2654435769)>>>0,a=e=>{let t=Math.round(Number(e)*1e3)|0;i=Math.imul(i^t,2246822507)>>>0,i=(i^i>>>13)>>>0};return a(e),a(t),a(n),i>>>0}function bt(e){let t=Math.max(2200,Math.min(55e3,Number(e)||5778));return t>=26e3?{color0:[.62,.78,1],color1:[.36,.56,1],spectral:`O`}:t>=10500?{color0:[.74,.86,1],color1:[.48,.68,1],spectral:`B`}:t>=7400?{color0:[.88,.93,1],color1:[.66,.78,.98],spectral:`A`}:t>=6e3?{color0:[1,.97,.88],color1:[.95,.84,.6],spectral:`F`}:t>=5200?{color0:[1,.93,.74],color1:[1,.6,.2],spectral:`G`}:t>=3750?{color0:[1,.76,.46],color1:[.94,.42,.14],spectral:`K`}:{color0:[1,.5,.28],color1:[.78,.18,.08],spectral:`M`}}function xt(e,t=!1){if(e.stage===`white-dwarf`||e.stage===`planetary-nebula`)return`DA-WD`;if(e.stage===`neutron-star`||e.stage===`supernova-remnant-pwn`)return`NS`;if(e.stage===`stellar-black-hole`||e.stage===`hypernova-remnant`)return`BH`;if(e.stage===`brown-dwarf`)return e.effectiveTempK>1400?`L-BD`:`T-BD`;if(e.stage===`red-giant`||e.stage===`agb-superwind`)return e.effectiveTempK<3600?`M2III`:`K2III`;let n=bt(e.effectiveTempK),r=Math.max(0,Math.min(9,Math.round(9-e.effectiveTempK%1200/1200*9)));return t?`PopIII-${n.spectral}`:`${n.spectral}${r}V`}function St(e,t,n){let r=Math.max(1e-4,Number.isFinite(Number(e))?Number(e):.2),i=Math.max(0,Math.min(.65,Number.isFinite(Number(t))?Number(t):.05)),a=Math.max(.05,Math.min(.5,Number.isFinite(Number(n))?Number(n):.35)),o=i*i,s=a*a,c=r*(1.6+5.1*i-2.22*o+4.12*a-4.27*i*a-5.09*s+4.61*o*s),l=r*(.464-.38*a-.631*i+.586*a*i+.15*o-.198*a*o);return{rCritPAu:Math.max(r*1.85,c),rCritSAu:Math.max(.02,l)}}function Ct({cosmicEpoch:e=null,regionPosMpc:t=[0,0,0],localOverdensity:n=1,seed:r=20261125}={}){let i=e||pe({redshiftZ:0}),a=Number(i.redshiftZ)||0,o=Math.max(.05,Number(i.cosmicAgeGyr)||13.8),s=Math.max(.15,Math.min(8,Number(n)||1)),c=yt(t[0]||0,t[1]||0,t[2]||0,r^257),l=vt(c),u=`disk`,d=`Grand-Design Spiral`;if(a>=4.5)u=`proto`,d=`Primordial High-z Protogalaxy`;else if(a>=1.4)u=s>2.2?`binary`:`proto`,d=u===`binary`?`Cosmic-Noon Starburst Merger`:`High-z Clumpy Starburst Disk`;else if(a<-.15){let e=l();u=s>1.25?`sphere`:e<.35?`globular`:`barred`,d=u===`sphere`?`Evolved Giant Elliptical (E2)`:u===`globular`?`Ancient Halo Globular Cluster`:`Aging Barred Spiral`}else if(s>2.15)u=l()<.68?`sphere`:`binary`,d=u===`sphere`?`Cluster-Core Giant Elliptical (E2)`:`Interacting Major Merger Pair`;else if(s<.68)u=l()<.52?`globular`:`dwarf-stream`,d=u===`globular`?`Metal-Poor Globular Cluster (GC)`:`Void-Edge Dwarf & Tidal Stream`;else if(s>1.42){let e=l();e<.34?(u=`sphere`,d=`Group Elliptical / Lenticular (E4/S0)`):e<.72?(u=`barred`,d=`Barred Spiral (SBb)`):(u=`disk`,d=`Grand-Design Spiral (Sa/Sb)`)}else l()<.54?(u=`disk`,d=`Grand-Design Spiral (Sc/Sb)`):(u=`barred`,d=`Barred Spiral (SBb)`);let f=Math.max(1e-4,Number(i.meanMetallicitySolar)||1),p=s**.28,m=u===`globular`?.08:u===`dwarf-stream`?.35:u===`sphere`?1.45:1,h=Math.max(1e-4,Math.min(3.2,f*p*m)),g=Math.log10(h),_=Number(i.galaxyGasFraction??i.haloGasFraction)||.16,v=Math.max(.01,Math.min(.88,_*(u===`sphere`?.22:u===`globular`?.05:1))),y=Math.max(.32,Math.min(.88,.38+.18*Math.min(1.4,h)+(l()-.5)*.12));return Object.freeze({schema:mt,cosmicEraId:i.eraId||`present-day`,redshiftZ:a,cosmicAgeGyr:o,localOverdensity:s,regionPosMpc:Object.freeze([t[0]||0,t[1]||0,t[2]||0]),morphology:u,morphologyLabel:d,meanMetallicitySolar:h,baseFeH:g,baseCO:y,gasFraction:v,isPrimordialPopIII:a>=7.5||h<.004,seed:c})}function W(e,{isPopIII:t=!1,isYoungArm:n=!1,isAncient:r=!1}={}){let i=e();return t?5*11**i**.72:n?i<.32?.18+e()*.35:i<.52?.53+e()*.32:i<.7?.85+e()*.35:i<.86?1.2+e()*1.4:2.6+e()**1.8*18:r?i<.48?.14+e()*.36:i<.74?.5+e()*.34:i<.88?.84+e()*.24:1.08+e()**1.4*2.2:i<.44?.12+e()*.38:i<.68?.5+e()*.32:i<.84?.82+e()*.28:i<.93?1.1+e()*.45:i<.98?1.55+e()*1.15:2.7+e()**1.6*8.5}function wt({cosmicEpoch:e=null,galaxyEnv:t=null,starPosGal:n=[4.8,.04,2.1],popTag:r=.48,starIndex:i=0,seed:a=20261125,forceMultiplicity:o=null,forceExoticStage:s=null}={}){let c=e||pe({redshiftZ:0}),l=t||Ct({cosmicEpoch:c,seed:a}),u=Math.hypot(n[0]||0,n[2]||0),d=Math.abs(n[1]||0),f=Math.max(.2,u*1.65),p=d*1.65,m;if(i>0){let e=(a>>>0^Math.imul((i>>>0)+2654435769,2246822507))>>>0;e=Math.imul(e^e>>>16,2146121005)>>>0,e=Math.imul(e^e>>>15,2221713035)>>>0,m=(e^e>>>16)>>>0}else m=yt(n[0]||0,n[1]||0,n[2]||0,(a^2654435761)>>>0);let h=vt(m),g=f<2.6||l.morphology===`sphere`,_=p>1.4||l.morphology===`globular`||l.morphology===`dwarf-stream`,v=r>=.76&&!g&&!_&&l.gasFraction>.08,y=g||_||l.redshiftZ<-.15,b=-.068*(f-8.2),x=-.32*Math.min(1.8,p),S=v?.14:0,C=(h()-.5)*.24,w=l.baseFeH+b+x+S+C;l.isPrimordialPopIII&&(w=Math.min(-2.4,w-1.2)),w=Math.max(-4,Math.min(.55,w));let T=10**w,E=Math.max(.25,Math.min(1.08,l.baseCO+(g?.22:0)+w*.22+(h()-.5)*.26)),D=_||l.redshiftZ>1.5?.38:g?.22:.04,O=Math.max(.05,l.cosmicAgeGyr-.25),k;k=l.isPrimordialPopIII?Math.min(O,.002+h()*.015):v?Math.min(O,.015+h()*.35):y?Math.min(O,Math.max(.4,O*(.58+h()*.34))):Math.min(O,Math.max(.2,(.6+h()*8.6)*Math.min(1,O/10)));let A=W(h,{isPopIII:l.isPrimordialPopIII,isYoungArm:v,isAncient:y}),j=1;if(o===1||o===2||o===3)j=o;else{let e=h();j=A<.5?e<.73?1:e<.96?2:3:A<1.3?e<.54?1:e<.88?2:3:e<.28?1:e<.74?2:3}let M=[A];if(j>=2){let e=.28+.68*h()**.75;M.push(Math.max(.08,A*e))}if(j===3){let e=.22+.58*h()**.9;M.push(Math.max(.08,A*e))}let N=ht[m%ht.length],P=100+(m>>>5)%899,F=`${N}-${P}`,I=[`A`,`B`,`C`],L=M.map((e,t)=>{let n=ne({massSolar:e,ageGyr:k,metallicitySolar:T});if(t===0&&typeof s==`string`&&s.length>0){let e=s.toLowerCase();e===`neutron-star`||e===`pulsar`||e===`magnetar`?n={...n,stage:e===`magnetar`?`magnetar`:`neutron-star`,remnantClass:`neutron-star`,massSolar:e===`magnetar`?1.58:1.44,radiusSolar:172e-7,luminositySolar:e===`magnetar`?.42:.18,effectiveTempK:e===`magnetar`?12e5:85e4}:e===`stellar-black-hole`||e===`black-hole`?n={...n,stage:`stellar-black-hole`,remnantClass:`black-hole`,massSolar:11.4,radiusSolar:48e-6,luminositySolar:.38,effectiveTempK:15e6}:e===`white-dwarf`&&(n={...n,stage:`white-dwarf`,remnantClass:`white-dwarf`,massSolar:.64,radiusSolar:.0125,luminositySolar:.018,effectiveTempK:19500})}let r=bt(n.effectiveTempK),i=n.stage===`magnetar`?`SGR`:n.stage===`neutron-star`?`PSR`:xt(n,l.isPrimordialPopIII),a=n.remnantClass!==`none`,o=Math.max(12,n.radiusSolar*695700),c=Math.min(8,1.42*T),u=Math.min(34,24.8+1.8*T),d=Math.max(60,100-u-c),f=n.stage===`white-dwarf`?`Degenerate C/O Core · Thin H/He Envelope`:n.stage===`neutron-star`||n.stage===`magnetar`?`Superfluid Neutron Interior · Magnetized Iron Crust`:n.stage===`stellar-black-hole`?`Relativistic Kerr Event Horizon · Accretion Disk`:`H ${d.toFixed(1)}% · He ${u.toFixed(1)}% · Metals ${c.toFixed(2)}% ([Fe/H]=${w>=0?`+`:``}${w.toFixed(2)})`;return Object.freeze({component:I[t],name:j>1?`${F} ${I[t]} (${i})`:`${F} (${i})`,spectralCode:i,stage:n.stage,remnantClass:n.remnantClass,initialMassSolar:e,massSolar:n.massSolar,radiusSolar:n.radiusSolar,radiusKm:o,luminositySolar:Math.max(1e-4,n.luminositySolar),effectiveTempK:Math.max(1200,n.effectiveTempK||5778),color0:n.stage===`white-dwarf`?[.8,.94,1]:n.stage===`magnetar`?[1,.78,.98]:n.stage===`neutron-star`?[.74,.95,1]:n.stage===`stellar-black-hole`?[0,0,0]:r.color0,color1:n.stage===`white-dwarf`?[.46,.72,1]:n.stage===`magnetar`?[.86,.28,.96]:n.stage===`neutron-star`?[.58,.28,1]:n.stage===`stellar-black-hole`?[1,.72,.28]:r.color1,isRemnant:a,composition:f})}),R=`single`,z=null,ee=null;if(j===2){let e=h()<.58;R=e?`binary-p-type`:`binary-s-type`;let t=Math.max(.08,(L[0].radiusSolar+L[1].radiusSolar)*.00465*4.5),n=e?Math.max(t,.11+h()*.24):Math.max(t*4,14.5+h()*14),r=e?.02+h()*.14:.06+h()*.22;z=Object.freeze({aAu:n,e:r,incDeg:(h()-.5)*4.5,omDeg:h()*360,wDeg:h()*360,m0Deg:h()*360})}else if(j===3){R=`hierarchical-trinary`;let e=Math.max(.08,(L[0].radiusSolar+L[1].radiusSolar)*.00465*4.5);z=Object.freeze({aAu:Math.max(e,.1+h()*.22),e:.02+h()*.12,incDeg:(h()-.5)*3,omDeg:h()*360,wDeg:h()*360,m0Deg:h()*360}),ee=Object.freeze({aAu:16.5+h()*13.5,e:.05+h()*.18,incDeg:(h()-.5)*14,omDeg:h()*360,wDeg:h()*360,m0Deg:h()*360})}let B=Math.max(1e-6,.012*T),V=Object.freeze({feH:w,metallicitySolar:T,cToO:E,alphaOverFe:D,dustToGasRatio:B,carbonRich:E>=.8,solidDiskMassEarth:Math.max(0,48*T*Math.max(.15,A)**.85),volatileInventory:Math.max(0,(1.15-Math.max(0,E-.55)*1.1)*Math.min(2.2,T+.12)),nebulaSummary:`[Fe/H]=${w>=0?`+`:``}${w.toFixed(2)} · C/O=${E.toFixed(2)} · Dust/Gas=${(B*100).toFixed(3)}%${E>=.8?` (Carbon-Rich)`:``}`}),te=g?`Galactic Bulge`:_?`Stellar Halo`:v?`Spiral-Arm H II Nursery`:`Galactic Disk`,re=L[0],ie=`fusion`,ae=`MLS-MPM Nuclear Fusion Star`;return re.stage===`magnetar`?(ie=`magnetar`,ae=`Ultra-Magnetized SGR Magnetar`):re.stage===`neutron-star`?(ie=k<.08?`snr-pwn`:`pulsar`,ae=ie===`snr-pwn`?`Core-Collapse SNR / PWN`:`Relativistic Magnetized Pulsar`):re.stage===`stellar-black-hole`?(ie=`black-hole`,ae=`Relativistic Kerr Black Hole`):re.stage===`white-dwarf`?h()<.28?(ie=`planetary-nebula`,ae=`Bipolar Planetary Nebula`):(ie=`white-dwarf-tov`,ae=`Degenerate White Dwarf (TOV)`):v&&l.gasFraction>.14&&(A>=2.8&&k<.15?(ie=`h2-pillars`,ae=`Strömgren H II Pillars`):k<.08&&(ie=`nebular-mhd`,ae=`MHD Protostellar Nebula & Jets`)),Object.freeze({schema:mt,systemId:`${N.toLowerCase()}-${P}`,systemName:F,galacticRegion:te,recommendedL3Regime:ie,nebulaBadge:ae,rKpc:Number(f.toFixed(2)),zKpc:Number(p.toFixed(2)),systemAgeGyr:Number(k.toFixed(2)),multiplicity:j,architecture:R,stars:Object.freeze(L),binaryPair:z,outerCompanion:ee,nebulaEnv:V,galaxyEnv:l,seed:m})}function Tt(e,{seedOverride:t=null}={}){let n=e||wt(),r=vt(((t??n.seed)^328103)>>>0),{stars:i,multiplicity:a,architecture:o,binaryPair:s,outerCompanion:c,nebulaEnv:l}=n,u=[];for(let e=0;e<i.length;e+=1){let t=i[e],n={id:`star-${e}`,name:t.name,subtitle:`${t.stage.replace(/-/g,` `)} · ${t.massSolar.toFixed(2)} M☉ · T=${Math.round(t.effectiveTempK).toLocaleString()} K`,isStar:!0,starIndex:e,parent:-1,kind:t.stage===`stellar-black-hole`?5:0,massSolar:t.massSolar,radiusKm:t.radiusKm,luminositySolar:t.luminositySolar,aAu:0,e:0,incDeg:0,omDeg:0,wDeg:0,m0Deg:0,color0:[...t.color0],color1:[...t.color1],atm:0,surfacePressurePa:0,tempK:Math.round(t.effectiveTempK),centralP:t.stage===`neutron-star`?1e34:t.stage===`white-dwarf`?1e22:0x58d15e17628000*t.massSolar**1.4,coreZ:t.stage===`white-dwarf`?6:t.stage===`neutron-star`?26:1,mantleZ:t.stage===`white-dwarf`?8:2,surfZ:1,composition:t.composition,stage:t.stage,spectralCode:t.spectralCode};e===1&&s?(n.parent=0,n.orbitRole=`binary-companion`,n.aAu=s.aAu,n.e=s.e,n.incDeg=s.incDeg,n.omDeg=s.omDeg,n.wDeg=s.wDeg,n.m0Deg=s.m0Deg):e===2&&c&&(n.parent=-2,n.orbitRole=`trinary-outer`,n.aAu=c.aAu,n.e=c.e,n.incDeg=c.incDeg,n.omDeg=c.omDeg,n.wDeg=c.wDeg,n.m0Deg=c.m0Deg),u.push(n)}let d=o===`binary-p-type`||o===`hierarchical-trinary`,f=d?i[0].luminositySolar+i[1].luminositySolar:i[0].luminositySolar,p=d?i[0].massSolar+i[1].massSolar:i[0].massSolar,m=d?-2:0,h=Math.sqrt(Math.max(1e-4,f)),g=Math.max(.05,.085*h),_=Math.max(.18,2.7*h),v=Math.max(.75,11.2*h),y=Math.max(.08,.94*h),b=Math.max(.16,1.68*h),x=Math.max(g*1.15,i[0].radiusSolar*.00465*6),S=Math.min(38,Math.max(6,26*p**.35));if(d&&s){let e=Math.min(i[0].massSolar,i[1].massSolar)/(i[0].massSolar+i[1].massSolar),t=St(s.aAu,s.e,e);x=Math.max(x,t.rCritPAu*1.18)}if(o===`binary-s-type`&&s){let e=i[1].massSolar/(i[0].massSolar+i[1].massSolar),t=St(s.aAu,s.e,e);S=Math.min(S,t.rCritSAu*.92)}else if(o===`hierarchical-trinary`&&c){let e=i[0].massSolar+i[1].massSolar,t=i[2].massSolar/(e+i[2].massSolar),n=St(c.aAu,c.e,t);S=Math.min(S,n.rCritSAu*.9)}let C=i[0].stage===`neutron-star`||i[0].stage===`magnetar`,w=i[0].stage===`stellar-black-hole`||i[0].stage===`hypernova-remnant`,T=l.metallicitySolar>=.015&&S>x*1.45,E=0;if(T){let e=Math.log(S/x),t=Math.max(1,Math.min(8,Math.floor(e/.48))),n=Math.max(.25,Math.min(1.25,.65+.35*(l.feH+1)));E=C||w?Math.max(2,Math.min(4,Math.round(2+r()*2))):Math.max(1,Math.min(t,Math.round((2+r()*5)*n)))}let D=Math.max(.04,Math.min(.88,.14*l.metallicitySolar**1.75)),O=i[0].stage===`red-giant`||i[0].stage===`agb-superwind`,k=i[0].stage===`white-dwarf`,A=x*(1.08+r()*.45),j=!1,M=[];for(let e=0;e<E&&!(A>=S*.96);e+=1){let t=A;A*=1.52+r()*.62;let a=Math.max(28,Math.round(278*Math.max(1e-4,f)**.25/Math.sqrt(Math.max(.02,t)))),o=t>=_,s=t>=v,c=t>=y&&t<=b,d=r(),p=`rocky-arid`;o&&d<D*1.15&&!k?p=s||r()<.38?`ice-giant`:`gas-giant`:!o&&t<_*.25&&d<D*.22&&!O&&!k?p=`hot-jupiter`:a>=950||O&&t<1.8?p=r()<.55?`lava-world`:`iron-core`:l.carbonRich&&!o?p=`carbon-world`:c&&!j&&!O&&!k&&n.systemAgeGyr>=.35&&l.volatileInventory>=.35&&d<.42?(p=`earth-like`,j=!0):p=c&&l.volatileInventory>=.55&&d<.72?`ocean-super-earth`:a>390&&a<950&&l.metallicitySolar>.25?`greenhouse`:o?d<.45?`ice-giant`:`icy-dwarf`:a<250&&d<.55?`arid-oxide`:r()<.45?`super-earth`:`iron-core`;let h=gt[e]||`p${e+1}`,g=`${n.systemName} ${h}`,x=null;if(p===`earth-like`){let e=.68+r()*.95,n=Math.round(6371*e**.27),i=Math.round((.65+r()*1.15)*101325),o=Math.max(268,Math.min(312,Math.round(a+28+(r()-.5)*14)));x={name:`${g} (Earth-like)`,planetClass:`earth-like`,subtitle:`Earth-like Oceanic Silicate-Iron World · ${t.toFixed(2)} AU`,kind:1,massSolar:e*Ye,radiusKm:n,color0:[.22+r()*.12,.46+r()*.12,.22+r()*.08],color1:[.05,.24+r()*.1,.58+r()*.1],atm:.72,surfacePressurePa:i,volatileMassFrac:.045+r()*.025,particulateMassFrac:.006,tempK:o,centralP:Math.round((260+e*110)*1e9),coreZ:26,mantleZ:14,surfZ:14,composition:`Fe-Ni Core · MgSiO₃ Mantle · Liquid H₂O Ocean · N₂/O₂ ${(i/1e5).toFixed(2)} bar`}}else if(p===`ocean-super-earth`){let e=2.2+r()*3.8,n=Math.round(6371*e**.29*1.08),i=Math.round((1.5+r()*4.5)*101325);x={name:`${g} (Ocean World)`,planetClass:`ocean-world`,subtitle:`Pelagic Super-Earth · ${t.toFixed(2)} AU`,kind:1,massSolar:e*Ye,radiusKm:n,color0:[.16,.44,.56],color1:[.04,.2,.56],atm:.78,surfacePressurePa:i,volatileMassFrac:.085,particulateMassFrac:.004,tempK:Math.max(270,Math.min(345,a+36)),centralP:Math.round((420+e*95)*1e9),coreZ:26,mantleZ:8,surfZ:8,composition:`Fe Core · High-P H₂O Ice-VII Mantle · Global Liquid Ocean (${e.toFixed(1)} M⊕)`}}else if(p===`carbon-world`){let e=.6+r()*3.2,n=Math.round(6371*e**.27*.96),i=a>550?24e4:42e3;x={name:`${g} (Carbon World)`,planetClass:`carbon-world`,subtitle:`High-C/O Graphite–SiC–Diamond World · ${t.toFixed(2)} AU`,kind:1,massSolar:e*Ye,radiusKm:n,color0:[.34,.32,.36],color1:[.16,.15,.2],atm:.32,surfacePressurePa:i,volatileMassFrac:.012,particulateMassFrac:.035,tempK:a+18,centralP:Math.round((240+e*115)*1e9),coreZ:26,mantleZ:6,surfZ:6,composition:`Fe-C Core · Diamond/SiC Mantle · Graphite & Hydrocarbon Crust (C/O=${l.cToO.toFixed(2)})`}}else if(p===`lava-world`){let e=.4+r()*3.6,n=Math.round(6371*e**.27);x={name:`${g} (Lava World)`,planetClass:`lava-world`,subtitle:`Molten Silicate Magma Ocean World · ${t.toFixed(2)} AU`,kind:7,massSolar:e*Ye,radiusKm:n,color0:[1,.44,.1],color1:[.22,.08,.05],atm:.42,surfacePressurePa:14e4,volatileMassFrac:.005,particulateMassFrac:.06,tempK:Math.max(1350,a),centralP:Math.round((220+e*110)*1e9),coreZ:26,mantleZ:14,surfZ:14,composition:`Molten Fe-Ni Core · Magma MgSiO₃ Ocean · Vaporized SiO/Na Exosphere`}}else if(p===`iron-core`){let e=.05+r()*.45,n=Math.round(2200+e**.3*3200);x={name:`${g} (Iron World)`,planetClass:`iron-world`,subtitle:`Refractory Iron-Rich Terrestrial Core · ${t.toFixed(2)} AU`,kind:1,massSolar:e*Ye,radiusKm:n,color0:[.56,.52,.48],color1:[.34,.31,.29],atm:0,surfacePressurePa:0,volatileMassFrac:0,particulateMassFrac:0,tempK:a,centralP:Math.round((35+e*120)*1e9),coreZ:26,mantleZ:14,surfZ:26,composition:`Fe-Ni Core 68% · Silicate Mantle 32% · Airless Cratered Regolith`}}else if(p===`greenhouse`){let e=.65+r()*1.8,n=Math.round(5600+e**.27*1600),i=Math.round((2.5+r()*7.5)*1e6);x={name:`${g} (Greenhouse)`,planetClass:`greenhouse`,subtitle:`Super-Greenhouse CO₂ World · ${t.toFixed(2)} AU`,kind:2,massSolar:e*Ye,radiusKm:n,color0:[.9,.78,.52],color1:[.74,.54,.3],atm:.85,surfacePressurePa:i,volatileMassFrac:.025,particulateMassFrac:.055,tempK:Math.min(920,a+280),centralP:Math.round((240+e*105)*1e9),coreZ:26,mantleZ:14,surfZ:6,composition:`Fe/Ni Core · SiO₂ Mantle · Supercritical CO₂ ${(i/1e5).toFixed(0)} bar Atm`}}else if(p===`arid-oxide`||p===`super-earth`){let e=p===`super-earth`,n=e?1.8+r()*3.2:.1+r()*.42,i=Math.round(e?6371*n**.27:3e3+n**.3*2100),o=Math.round(e?(.8+r()*2.2)*1e5:450+r()*2400);x={name:`${g} (${e?`Super-Earth`:`Arid World`})`,planetClass:e?`super-earth`:`arid-world`,subtitle:`${e?`Rocky Silicate Super-Earth`:`Arid Iron-Oxide Desert World`} · ${t.toFixed(2)} AU`,kind:1,massSolar:n*Ye,radiusKm:i,color0:e?[.64,.46,.32]:[.76,.36,.2],color1:e?[.38,.28,.2]:[.5,.22,.14],atm:e?.46:.18,surfacePressurePa:o,volatileMassFrac:e?.015:.002,particulateMassFrac:.048,tempK:Math.max(140,a+(e?22:6)),centralP:Math.round((e?420:45)*1e9),coreZ:26,mantleZ:14,surfZ:26,composition:`Fe-S Core · Basalt/Fe₂O₃ Silicate Crust · ${(o/1e5).toFixed(o<5e3?3:2)} bar CO₂/N₂`}}else if(p===`hot-jupiter`||p===`gas-giant`){let e=p===`hot-jupiter`,n=e?.35+r()*2.4:.22+r()*3.1,i=Math.round((54e3+r()*24e3)*(e?1.18:1)),o=!e&&r()<.48;x={name:`${g} (${e?`Hot Jupiter`:o?`Ringed Giant`:`Gas Giant`})`,planetClass:e?`hot-jupiter`:`gas-giant`,subtitle:`${e?`Tidally Inflated Hot Jupiter`:`Metallic-Hydrogen Gas Giant`} · ${t.toFixed(2)} AU`,kind:2,massSolar:n*954588e-9,radiusKm:i,color0:e?[.96,.52,.24]:[.8+r()*.14,.68+r()*.14,.5+r()*.14],color1:e?[.54,.18,.12]:[.52+r()*.14,.36+r()*.12,.24+r()*.1],atm:.55,surfacePressurePa:1e5,volatileMassFrac:.08,particulateMassFrac:.02,ringed:o,ringInnerKm:o?Math.round(i*1.28):0,ringOuterKm:o?Math.round(i*2.38):0,tempK:Math.max(90,a),centralP:Math.round((360+n*180)*1e9),coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ ${(88+r()*7).toFixed(1)}% · He · Metallic H Mantle (${n.toFixed(2)} M_J)`}}else if(p===`ice-giant`){let e=10+r()*14,n=Math.round(21e3+r()*7500),i=r()<.28,o=r()<.52;x={name:`${g} (Ice Giant)`,planetClass:`ice-giant`,subtitle:`Superionic H₂O/NH₃/CH₄ Ice Giant · ${t.toFixed(2)} AU`,kind:3,massSolar:e*Ye,radiusKm:n,color0:o?[.26,.5,.94]:[.54,.84,.9],color1:o?[.14,.3,.76]:[.36,.68,.8],atm:.62,surfacePressurePa:1e5,volatileMassFrac:.06,particulateMassFrac:.01,ringed:i,ringInnerKm:i?Math.round(n*1.45):0,ringOuterKm:i?Math.round(n*2.15):0,tempK:Math.max(42,a),centralP:Math.round((240+e*4.5)*1e9),coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/CH₄/NH₃ Superionic Mantle · H₂/He Envelope (${e.toFixed(1)} M⊕)`}}else{let e=.015+r()*.14,n=Math.round(1350+r()*1650);x={name:`${g} (Cryo Dwarf)`,planetClass:`icy-dwarf`,subtitle:`Outer-Disk Volatile Ice World · ${t.toFixed(2)} AU`,kind:3,massSolar:e*Ye,radiusKm:n,color0:[.78,.84,.9],color1:[.46,.56,.68],atm:.04,surfacePressurePa:0,volatileMassFrac:0,particulateMassFrac:0,tempK:Math.max(35,a),centralP:5e9,coreZ:14,mantleZ:8,surfZ:8,composition:`H₂O/N₂/CH₄ Ice Shell · Silicate Core`}}let S=u.length,C=Math.max(.08,i[0]?.massSolar||1),w=(t/.22)**6/(C*C*Math.max(.1,n.systemAgeGyr))<1||p===`hot-jupiter`||p===`lava-world`,T=Number(w?(r()*3.5).toFixed(2):(p===`ice-giant`&&r()<.35?65+r()*55:4+r()*38).toFixed(2)),E=Number((r()*360).toFixed(1)),N=8766*Math.sqrt(t**3/C),P=Number(w?N.toFixed(2):(p===`gas-giant`||p===`ice-giant`?8.5+r()*11:12+r()*36).toFixed(2)),F=r(),I=n.systemAgeGyr>=2.2,L=(p===`earth-like`||p===`ocean-super-earth`)&&I&&F<.55?Number((.38+r()*.52).toFixed(2)):0;u.push({id:`planet-${e}`,parent:m,aAu:Number(t.toFixed(4)),e:Number((.008+r()*(p===`earth-like`?.045:.095)).toFixed(4)),incDeg:Number(((r()-.5)*4.2).toFixed(2)),omDeg:Number((r()*360).toFixed(1)),wDeg:Number((r()*360).toFixed(1)),m0Deg:Number((r()*360).toFixed(1)),axialObliquityDeg:T,spinAxisLonDeg:E,rotationPeriodHr:P,tidallyLocked:w,civTechK:L,hostStarTeffK:i[0]?.effectiveTempK||5778,...x}),M.push(S);let R=p===`gas-giant`||p===`ice-giant`,z=R?1+Math.floor(r()*2.4):+((p===`earth-like`||p===`ocean-super-earth`)&&r()<.65);for(let t=0;t<z;t+=1){let n=Math.round(R?1450+r()*1350:1150+r()*850),s=(n/1737.4)**3*3.6943e-8,c=x.radiusKm*(5.2+t*5.8+r()*2.5)*1e3/149597870700,l=R&&o&&n>2350&&a<125,d=R&&t===0&&r()<.45;u.push({id:`moon-${e}-${t}`,name:`${g}-${_t[t]||t+1}`,planetClass:l?`hazy-moon`:d?`volcanic-moon`:o?`icy-moon`:`rocky-moon`,subtitle:`${l?`Dense-Atmosphere Methane Moon`:d?`Tidally Heated Volcanic Moon`:o?`Subsurface-Ocean Icy Moon`:`Natural Rocky Satellite`}`,parent:S,kind:l?2:d?1:3,massSolar:s,radiusKm:n,aAu:Number(c.toFixed(6)),e:Number((.005+r()*.035).toFixed(4)),incDeg:Number(((r()-.5)*4).toFixed(2)),omDeg:Number((r()*360).toFixed(1)),wDeg:Number((r()*360).toFixed(1)),m0Deg:Number((r()*360).toFixed(1)),axialObliquityDeg:Number((T*.85).toFixed(2)),spinAxisLonDeg:E,rotationPeriodHr:Number((8766*Math.sqrt(c**3/Math.max(1e-9,x.massSolar))).toFixed(2)),tidallyLocked:!0,hostStarTeffK:i[0]?.effectiveTempK||5778,color0:l?[.86,.68,.34]:d?[.92,.8,.3]:o?[.84,.86,.9]:[.66,.65,.63],color1:l?[.62,.44,.2]:d?[.68,.44,.14]:o?[.54,.66,.78]:[.4,.39,.38],atm:l?.78:0,surfacePressurePa:l?142e3:0,volatileMassFrac:l?.04:0,particulateMassFrac:l?.03:0,tempK:Math.max(45,a),centralP:6e9,coreZ:o?14:26,mantleZ:o?8:14,surfZ:d?16:l?6:o?8:14,composition:l?`N₂/CH₄ Haze Atm · H₂O/Silicate Interior`:d?`Silicate Mantle · Sulfur Volcanic Crust`:o?`H₂O Ice/Ocean Shell · Silicate Core`:`Silicate Regolith · Fe Core`})}}let N=Number(Math.max(x*1.35,Math.min(S*.9,_*.92)).toFixed(4)),P=Math.max(.01,i.reduce((e,t)=>e+(Number(t.luminositySolar)||0),0)||1),F=Math.max(45,Math.round(278*P**.25/Math.sqrt(Math.max(.1,N))));u.push({id:`belt-asteroid-1`,name:`${n.systemName} Belt Asteroid α`,planetClass:`metallic-asteroid`,subtitle:`Mineable Fe-Ni / Silicate Main-Belt Asteroid · ${N.toFixed(2)} AU`,parent:m,kind:1,massSolar:2e-12+r()*3e-11,radiusKm:Math.round(45+r()*145),aAu:N,e:Number((.06+r()*.14).toFixed(4)),incDeg:Number((3+r()*9).toFixed(2)),omDeg:Number((r()*360).toFixed(1)),wDeg:Number((r()*360).toFixed(1)),m0Deg:Number((r()*360).toFixed(1)),axialObliquityDeg:Number((r()*140).toFixed(1)),spinAxisLonDeg:Number((r()*360).toFixed(1)),rotationPeriodHr:Number((3.8+r()*9.5).toFixed(2)),tidallyLocked:!1,isMinorBody:!0,isMetallicAsteroid:!0,civTechK:0,hostStarTeffK:i[0]?.effectiveTempK||5778,color0:[.64,.62,.58],color1:[.36,.38,.42],atm:0,surfacePressurePa:0,volatileMassFrac:.04,tempK:F,centralP:14e6,coreZ:26,mantleZ:28,surfZ:26,composition:`Fe-Ni Metallic Ore · Olivine/Pyroxene Chondrite`});let I=Number(Math.max(_*1.4,Math.min(18,_*2.8)).toFixed(4));u.push({id:`periodic-comet-1`,name:`${n.systemName} Comet 1P`,planetClass:`periodic-comet`,subtitle:`Active Outgassing Volatile Comet · e = 0.84`,parent:m,kind:3,massSolar:85e-18,radiusKm:Number((4.5+r()*9).toFixed(1)),aAu:I,e:Number((.76+r()*.16).toFixed(4)),incDeg:Number((18+r()*115).toFixed(2)),omDeg:Number((r()*360).toFixed(1)),wDeg:Number((r()*360).toFixed(1)),m0Deg:Number((12+r()*26).toFixed(1)),axialObliquityDeg:28,spinAxisLonDeg:110,rotationPeriodHr:Number((14+r()*36).toFixed(1)),tidallyLocked:!1,isMinorBody:!0,isComet:!0,civTechK:0,hostStarTeffK:i[0]?.effectiveTempK||5778,color0:[.74,.9,1],color1:[.38,.62,.88],atm:.18,surfacePressurePa:0,volatileMassFrac:.76,tempK:175,centralP:1e5,coreZ:8,mantleZ:6,surfZ:8,composition:`H₂O Ice 75% · CO/CO₂/CH₄ Volatiles · Silicate Dust`});let L=u.findIndex(e=>e.planetClass===`earth-like`),R=u.findIndex(e=>!e.isStar&&!e.isMinorBody),z=L>=0?L:R>=0?R:0;return Object.freeze({schema:mt,systemId:n.systemId,systemName:n.systemName,starSystem:n,multiplicity:a,architecture:o,starCount:i.length,planetCount:M.length,hasEarthLike:j,earthLikeIndex:L,defaultFocusIndex:z,condensationFrontsAu:Object.freeze({rSilicateAu:Number(g.toFixed(3)),rHzInnerAu:Number(y.toFixed(3)),rHzOuterAu:Number(b.toFixed(3)),rSnowLineAu:Number(_.toFixed(3)),rCoIceAu:Number(v.toFixed(3)),rMinStableAu:Number(x.toFixed(3)),rMaxStableAu:Number(S.toFixed(3))}),beltZoneAu:Object.freeze({innerAu:Math.max(x*1.4,_*.78),outerAu:Math.min(S*.95,_*1.25),kuiperInnerAu:Math.min(S*.96,Math.max(v*1.1,_*2.4)),kuiperOuterAu:Math.min(44,Math.max(v*1.6,_*3.6))}),catalog:Object.freeze(u)})}function Et(e,t,n){return Math.max(t,Math.min(n,e))}function Dt(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function Ot(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function kt(e){let t=Et(Number(e)||5778,1200,5e4),n=[[1200,[1,.16,.04]],[2400,[1,.38,.1]],[3e3,[1,.56,.24]],[4200,[1,.78,.52]],[5778,[1,.96,.91]],[7500,[.9,.95,1]],[12e3,[.76,.87,1]],[26e3,[.64,.79,1]],[5e4,[.58,.74,1]]],r=n[n.length-1][1];for(let e=0;e<n.length-1;e+=1){let[i,a]=n[e],[o,s]=n[e+1];if(t<=o){let e=Et((Math.log(t)-Math.log(i))/Math.max(1e-6,Math.log(o)-Math.log(i)),0,1);r=[a[0]+(s[0]-a[0])*e,a[1]+(s[1]-a[1])*e,a[2]+(s[2]-a[2])*e];break}}let i=Math.max(.01,r[0],r[1],r[2]);return[Number((r[0]/i).toFixed(4)),Number((r[1]/i).toFixed(4)),Number((r[2]/i).toFixed(4))]}function At({starSpec:e=null,bodySpec:t=null,distanceAu:n=1,timeSec:r=0,isRogue:i=!1,stellarModeHint:a=null}={}){if(i)return Object.freeze({rgb:Object.freeze([.42,.54,.8]),fluxGain:.14,fluxEarth:0,irradianceWm2:0,distanceAu:1/0,luminositySolar:0,apparentMagV:12,starTempK:0,exoticStage:`rogue`,vec4:Object.freeze([.42,.54,.8,.14])});let o=String(e?.stage||``).toLowerCase(),s=o===`neutron-star`||o===`magnetar`||o===`supernova-remnant-pwn`||a===`pulsar`||a===`magnetar`,c=o===`stellar-black-hole`||o===`hypernova-remnant`,l=o===`white-dwarf`||o===`planetary-nebula`,u=Number(e?.tempK??e?.effectiveTempK)||(s?85e4:l?18500:5778),d=Math.max(1e-5,Number(e?.luminositySolar)||(s?.18:c?.35:l?.012:1)),f=Math.max(.012,Number.isFinite(Number(n))&&Number(n)>0?Number(n):Number(t?.aAu)||1),p=d/(f*f),m=1361*p,h=-26.74-2.5*Math.log10(Math.max(1e-12,p)),g=Et(.14+.86*Math.max(1e-6,p)**.24,.14,1.85),_=kt(u);if(s){let e=Math.max(0,Math.cos(r*3.8))**6,t=[.64,.88,1],n=[.78,.68,1];_=[Number((t[0]+(n[0]-t[0])*e*.55).toFixed(4)),Number((t[1]+(n[1]-t[1])*e*.55).toFixed(4)),Number((t[2]+(n[2]-t[2])*e*.55).toFixed(4))],g=Et(g*(.76+.46*e),.24,1.75)}else c?(_=[1,.72,.42],g=Et(g*.85,.18,1.45)):l&&(_=[.76,.9,1]);return Object.freeze({rgb:Object.freeze(_),fluxGain:Number(g.toFixed(4)),fluxEarth:p,irradianceWm2:m,distanceAu:f,luminositySolar:d,apparentMagV:Number(h.toFixed(2)),starTempK:u,exoticStage:s?`neutron-star`:c?`stellar-black-hole`:l?`white-dwarf`:o||`main-sequence`,vec4:Object.freeze([_[0],_[1],_[2],Number(g.toFixed(4))])})}function jt(e,t=null){if(!e)return{stellarMode:`fusion`,stellarPreset:`main-sequence-star`,isExotic:!1};let n=String(e.stage||``).toLowerCase(),r=Number(e.tempK??e.effectiveTempK)||5778,i=Number(e.massSolar??e.initialMassSolar)||1;return n===`neutron-star`||n===`pulsar`?{stellarMode:t===`snr-pwn`?`snr-pwn`:`pulsar`,stellarPreset:`main-sequence-star`,isExotic:!0}:n===`magnetar`?{stellarMode:`magnetar`,stellarPreset:`main-sequence-star`,isExotic:!0}:n===`supernova-remnant-pwn`?{stellarMode:`snr-pwn`,stellarPreset:`main-sequence-star`,isExotic:!0}:n===`stellar-black-hole`||n===`hypernova-remnant`?{stellarMode:`black-hole`,stellarPreset:`main-sequence-star`,isExotic:!0}:n===`white-dwarf`||n===`planetary-nebula`?{stellarMode:n===`planetary-nebula`||t===`planetary-nebula`?`planetary-nebula`:`white-dwarf-tov`,stellarPreset:`main-sequence-star`,isExotic:!0}:n===`protostar-yso`?{stellarMode:`nebular-mhd`,stellarPreset:`main-sequence-star`,isExotic:!1}:n===`red-giant`?{stellarMode:`fusion`,stellarPreset:`red-supergiant`,isExotic:!1}:n===`agb-superwind`||n===`agb-carbon`?{stellarMode:`fusion`,stellarPreset:`agb-carbon`,isExotic:!1}:n===`brown-dwarf`||i<.08||r<2200?{stellarMode:`fusion`,stellarPreset:`brown-dwarf`,isExotic:!1}:r>=11e3||i>=5.5?{stellarMode:`fusion`,stellarPreset:`blue-supergiant`,isExotic:!1}:{stellarMode:`fusion`,stellarPreset:`main-sequence-star`,isExotic:!1}}function Mt({spec:e,pos:t,radius:n,timeSec:r=0,dysonCoverage:i=0,seed:a=1.37,spheres:o,disks:s,lineChunks:c=null,alphaMul:l=1,stellarModeHint:u=null}){let d=String(e?.stage||``).toLowerCase(),f=d===`neutron-star`||d===`magnetar`||d===`supernova-remnant-pwn`||u===`pulsar`||u===`magnetar`,p=d===`magnetar`||u===`magnetar`,m=d===`stellar-black-hole`||d===`hypernova-remnant`||e?.kind===5,h=d===`white-dwarf`||d===`planetary-nebula`,g=Math.max(1e-4,Number(n)||.25),_=t[0],v=t[1],y=t[2];if(m){if(o.push({pos:[_,v,y],radius:g,color0:[0,0,0],color1:[1,.72,.28],kind:5,atm:0,tempK:15e6,dysonCoverage:0,seed:a}),s.push({center:[_,v,y],rIn:g*1.48,normal:[.16,.94,.3],rOut:g*4.85,color:[1,.72,.34],kind:0}),c){let e=Dt([.16,.94,.3]),t=Dt(Ot(e,[1,0,0])),n=Ot(e,t),i=g*7.5;for(let a of[-1,1])for(let o=0;o<6;o+=1){let s=o/6*Math.PI*2+r*1.6,u=g*.42,d=[_+e[0]*(a*g*1.05)+(t[0]*Math.cos(s)+n[0]*Math.sin(s))*(g*.14),v+e[1]*(a*g*1.05)+(t[1]*Math.cos(s)+n[1]*Math.sin(s))*(g*.14),y+e[2]*(a*g*1.05)+(t[2]*Math.cos(s)+n[2]*Math.sin(s))*(g*.14)],f=[_+e[0]*(a*i)+(t[0]*Math.cos(s)+n[0]*Math.sin(s))*u,v+e[1]*(a*i)+(t[1]*Math.cos(s)+n[1]*Math.sin(s))*u,y+e[2]*(a*i)+(t[2]*Math.cos(s)+n[2]*Math.sin(s))*u];c.push(...d,.52,.88,1,.82*l),c.push(...f,.45,.56,1,.1*l)}}return{exoticRendered:`black-hole`}}if(f){if(o.push({pos:[_,v,y],radius:g,color0:p?[1,.8,.98]:[.78,.96,1],color1:p?[.86,.28,.96]:[.56,.26,1],kind:0,atm:0,tempK:12e5,dysonCoverage:0,seed:a}),s.push({center:[_,v,y],rIn:g*1.55,normal:[.08,.98,.16],rOut:g*3.15,color:p?[.92,.42,.98]:[.42,.84,1],kind:1}),c){let e=r*(p?2.4:4.2)+a,t=.66,n=Dt([Math.sin(t)*Math.cos(e),Math.cos(t),Math.sin(t)*Math.sin(e)]),i=Dt(Ot(n,Math.abs(n[1])<.9?[0,1,0]:[1,0,0])),o=Ot(n,i),s=g*9.5,u=p?[1,.62,1]:[.58,.94,1],d=p?[.76,.22,.98]:[.44,.36,1];for(let e of[-1,1])for(let t=0;t<8;t+=1){let r=t/8*Math.PI*2,a=g*.22,f=g*1.45,p=i[0]*Math.cos(r)+o[0]*Math.sin(r),m=i[1]*Math.cos(r)+o[1]*Math.sin(r),h=i[2]*Math.cos(r)+o[2]*Math.sin(r),b=[_+n[0]*(e*g*.85)+p*a,v+n[1]*(e*g*.85)+m*a,y+n[2]*(e*g*.85)+h*a],x=[_+n[0]*(e*s)+p*f,v+n[1]*(e*s)+m*f,y+n[2]*(e*s)+h*f];c.push(...b,u[0],u[1],u[2],.94*l),c.push(...x,d[0],d[1],d[2],.14*l)}let f=g*3.8;for(let e=0;e<6;e+=1){let t=e/6*Math.PI*2,r=[i[0]*Math.cos(t)+o[0]*Math.sin(t),i[1]*Math.cos(t)+o[1]*Math.sin(t),i[2]*Math.cos(t)+o[2]*Math.sin(t)],a=null;for(let e=1;e<=15;e+=1){let t=e/16*Math.PI,i=Math.sin(t),o=f*i*i,s=[_+(n[0]*Math.cos(t)+r[0]*i)*o,v+(n[1]*Math.cos(t)+r[1]*i)*o,y+(n[2]*Math.cos(t)+r[2]*i)*o];a&&(c.push(...a,.44,.72,1,.48*l),c.push(...s,.44,.72,1,.48*l)),a=s}}}return{exoticRendered:p?`magnetar`:`pulsar`}}if(h){if(o.push({pos:[_,v,y],radius:g,color0:[.88,.96,1],color1:[.48,.78,1],kind:0,atm:0,tempK:Number(e?.tempK)||18500,dysonCoverage:i,seed:a}),c)for(let e=0;e<2;e+=1){let t=g*(2.2+e*1.15),n=.42+e*.65,r=null;for(let i=0;i<=32;i+=1){let a=i/32*Math.PI*2,o=[_+Math.cos(a)*t,v+Math.sin(a)*t*Math.sin(n),y+Math.sin(a)*t*Math.cos(n)];r&&(c.push(...r,.45,.88,1,(.42-e*.14)*l),c.push(...o,.45,.88,1,(.42-e*.14)*l)),r=o}}return{exoticRendered:`white-dwarf`}}let b=d===`red-giant`||d===`agb-superwind`;return o.push({pos:[_,v,y],radius:g,color0:b?[1,.44,.14]:e?.color0||[1,.93,.74],color1:b?[.74,.12,.04]:e?.color1||[1,.6,.2],kind:0,atm:0,tempK:Number(e?.tempK)||5778,dysonCoverage:i,seed:a}),{exoticRendered:null}}var Nt=`ulg.astrophysics.supergalactic-flrw-treepm.v1`,G=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Pt=16,Ft=32,It=`
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
const PK_BINS: u32 = ${Pt}u;

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
    let r_cut = 2.0 * r_s;
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
  let n_rem = min(params.remote_tile_count, ${Ft}u);
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
  let kick_fac = da / (a * a * h_a);
  let a_mid = a + 0.5 * da;
  let drift_fac = da / (a_mid * a_mid * a_mid * h_a);

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
`,Lt=`
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
`;function Rt(e,{omegaM:t=.315,omegaLambda:n=.685,omegaR:r=9e-5}={}){let i=Math.max(1e-4,Number(e)),a=1-t-n-r;return Math.sqrt(Math.max(1e-8,r/i**4+t/i**3+a/i**2+n))}function zt(e,t){let n=e+.5*t;return n-=t*Math.floor(n/t),n-.5*t}async function Bt(e,{gridPerSide:t=28,fftGridN:n=32,boxLengthMpc:r=200,aInit:i=.12,omegaM:a=.315,omegaLambda:o=.685,amplitude:s=.36,seed:c=20261125,slabBounds:l=null,initialPositionsShift:u=[0,0,0]}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`build2LptCosmologyICsWebGpu requires a live WebGPU GPUDevice`);let d=Math.max(8,Math.trunc(t)),f=Number(r),p=f/d,m=Rt(i,{omegaM:a,omegaLambda:o}),h=a/i**3/Math.max(1e-8,m*m),g=Math.max(1e-4,h)**.55,_=2*Math.max(1e-4,h)**(6/11),v=i*i*m*g,y=i*i*m*_,b=2*Math.PI/f*2.5,x=N(e,n),S=x.n,w=x.total,E=[C(0,`uniform`),C(1,`storage`),C(2,`storage`)],D=T(e,{cacheKey:`ulg-zeldovich-ic-gen.v1`,label:`ulg-2lpt-ic-gen`,code:Lt,entryPoint:`generate_zeldovich_kspace`,bindings:E}),O=T(e,{cacheKey:`ulg-zeldovich-ic-store.v1`,label:`ulg-2lpt-ic-store`,code:Lt,entryPoint:`store_disp_axis`,bindings:E}),k=e.createBuffer({size:w*16,usage:G.STORAGE|G.COPY_SRC}),A=e.createBuffer({size:w*16,usage:G.MAP_READ|G.COPY_DST}),j=e.createBuffer({size:x.byteLength,usage:G.STORAGE|G.COPY_DST|G.COPY_SRC}),M=[0,1,2].map(t=>{let n=new ArrayBuffer(32);new Uint32Array(n,0,4).set([S,c>>>0,t,0]),new Float32Array(n,16,4).set([f,s,b,v]);let r=e.createBuffer({size:32,usage:G.UNIFORM|G.COPY_DST});return e.queue.writeBuffer(r,0,n),r});try{let t=e.createCommandEncoder({label:`ulg-2lpt-psi1`}),n=Math.ceil(w/64);for(let r=0;r<3;r+=1){let i=e.createBindGroup({layout:D.bindGroupLayout,entries:[{binding:0,resource:{buffer:M[r]}},{binding:1,resource:{buffer:x.bufferA}},{binding:2,resource:{buffer:k}}]}),a=t.beginComputePass();a.setPipeline(D.pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(n),a.end();let o=x.encodeInverseFrom(t,x.bufferA),s=e.createBindGroup({layout:O.bindGroupLayout,entries:[{binding:0,resource:{buffer:M[r]}},{binding:1,resource:{buffer:o}},{binding:2,resource:{buffer:k}}]});a=t.beginComputePass(),a.setPipeline(O.pipeline),a.setBindGroup(0,s),a.dispatchWorkgroups(n),a.end()}t.copyBufferToBuffer(k,0,A,0,w*16),e.queue.submit([t.finish()]),await A.mapAsync(G.MAP_READ);let r=new Float32Array(A.getMappedRange().slice(0,w*16));A.unmap();let a=0;for(let e=0;e<w;e+=1)a+=r[e*4]**2+r[e*4+1]**2+r[e*4+2]**2;let o=Math.sqrt(a/Math.max(1,w)),c=Math.max(.1,Number(s)||.36)*(f/22),m=o>1e-12?c/o:0;for(let e=0;e<w;e+=1)r[e*4+0]*=m,r[e*4+1]*=m,r[e*4+2]*=m;let g=f/S,_=.5/g,b=new Float32Array(w*2),C=(e,t,n)=>(((n+S)%S*S+(t+S)%S)*S+(e+S)%S)*4;for(let e=0;e<S;e+=1)for(let t=0;t<S;t+=1)for(let n=0;n<S;n+=1){let i=C(n+1,t,e),a=C(n-1,t,e),o=C(n,t+1,e),s=C(n,t-1,e),c=C(n,t,e+1),l=C(n,t,e-1),u=(r[i+0]-r[a+0])*_,d=(r[o+1]-r[s+1])*_,f=(r[c+2]-r[l+2])*_,p=.5*(r[o+0]-r[s+0]+(r[i+1]-r[a+1]))*_,m=.5*(r[c+0]-r[l+0]+(r[i+2]-r[a+2]))*_,h=.5*(r[c+1]-r[l+1]+(r[o+2]-r[s+2]))*_,g=u*d+u*f+d*f-p*p-m*m-h*h;b[((e*S+t)*S+n)*2]=g}e.queue.writeBuffer(x.bufferA,0,b),x.writeAxisPoissonParams({boxLength:f,smoothR2:(.45*g)**2});let T=e.createCommandEncoder({label:`ulg-2lpt-psi2`}),E=x.encodeForward(T);T.copyBufferToBuffer(E,0,j,0,x.byteLength);for(let t=0;t<3;t+=1){let r=x.encodePoissonInverseFromKSpace(T,j,{gradAxis:t+1}),i=e.createBindGroup({layout:O.bindGroupLayout,entries:[{binding:0,resource:{buffer:M[t]}},{binding:1,resource:{buffer:r}},{binding:2,resource:{buffer:k}}]}),a=T.beginComputePass();a.setPipeline(O.pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(n),a.end()}T.copyBufferToBuffer(k,0,A,0,w*16),e.queue.submit([T.finish()]),await A.mapAsync(G.MAP_READ);let N=new Float32Array(A.getMappedRange().slice(0,w*16));A.unmap();let P=-.42857142857142855*Math.max(.001,h)**(-1/143),F=0;for(let e=0;e<w;e+=1){let t=P*N[e*4+0],n=P*N[e*4+1],r=P*N[e*4+2];N[e*4+0]=t,N[e*4+1]=n,N[e*4+2]=r,F+=t*t+n*n+r*r}let I=Math.sqrt(F/Math.max(1,w)),L=(e,t,n,r)=>{let i=(t+.5*f)/f*S,a=(n+.5*f)/f*S,o=(r+.5*f)/f*S,s=(Math.floor(i)%S+S)%S,c=(Math.floor(a)%S+S)%S,l=(Math.floor(o)%S+S)%S,u=(s+1)%S,d=(c+1)%S,p=(l+1)%S,m=i-Math.floor(i),h=a-Math.floor(a),g=o-Math.floor(o),_=0,v=0,y=0,b=[s,u],x=[c,d],C=[l,p],w=[1-m,m],T=[1-h,h],E=[1-g,g];for(let t=0;t<2;t+=1)for(let n=0;n<2;n+=1)for(let r=0;r<2;r+=1){let i=((C[t]*S+x[n])*S+b[r])*4,a=w[r]*T[n]*E[t];_+=e[i+0]*a,v+=e[i+1]*a,y+=e[i+2]*a}return[_,v,y]},R=Number(u?.[0])||0,z=Number(u?.[1])||0,ee=Number(u?.[2])||0,B=d*d*d,V=new Float32Array(B*16),te=0,ne=0,re=0,ie=0;for(let e=0;e<d;e+=1)for(let t=0;t<d;t+=1)for(let n=0;n<d;n+=1){let a=(n+.5)*p-.5*f,o=(t+.5)*p-.5*f,s=(e+.5)*p-.5*f,c=L(r,a,o,s),l=L(N,a,o,s),u=zt(a+c[0]+l[0]+R,f),d=zt(o+c[1]+l[1]+z,f),m=zt(s+c[2]+l[2]+ee,f),h=v*c[0]+y*l[0],g=v*c[1]+y*l[1],_=v*c[2]+y*l[2];te+=h,ne+=g,re+=_;let b=ie*16;V[b+0]=u,V[b+1]=d,V[b+2]=m,V[b+3]=1,V[b+4]=h,V[b+5]=g,V[b+6]=_,V[b+7]=.28,V[b+12]=+(ie%6==0),V[b+14]=i,ie+=1}te/=B,ne/=B,re/=B;for(let e=0;e<B;e+=1)V[e*16+4]-=te,V[e*16+5]-=ne,V[e*16+6]-=re;if(l&&Number.isFinite(l.xMin)&&Number.isFinite(l.xMax)){let e=[];for(let t=0;t<B;t+=1){let n=V[t*16+0];n>=l.xMin&&n<l.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(V.subarray(r,r+16),n*16)}return{icBackend:`webgpu-fft3d-2lpt-full-nyquist`,particleCount:e.length,globalParticleCount:B,data:t,boxLengthMpc:f,aInit:i,rms2Over1:I/Math.max(1e-9,c)}}return{icBackend:`webgpu-fft3d-2lpt-full-nyquist`,particleCount:B,globalParticleCount:B,data:V,boxLengthMpc:f,aInit:i,rms2Over1:I/Math.max(1e-9,c)}}finally{x.destroy(),k.destroy(),A.destroy(),j.destroy();for(let e of M)e.destroy()}}function Vt({gridPerSide:e=24,boxLengthMpc:t=200,aInit:n=.05,omegaM:r=.315,omegaLambda:i=.685,amplitude:a=.14,seed:o=20261122,slabBounds:s=null,initialPositionsShift:c=[0,0,0]}={}){let l=Math.max(8,Math.trunc(e)),u=l*l*l,d=new Float32Array(u*16),f=Number(t),p=f/l,m=Rt(n,{omegaM:r,omegaLambda:i}),h=(r/(n**3*m*m))**.55,g=o>>>0,_=()=>(g=Math.imul(1664525,g)+1013904223>>>0,(g+.5)/4294967296),v=[],y=2*Math.PI/f*2.5;for(let e=-3;e<=3;e+=1)for(let t=-3;t<=3;t+=1)for(let n=-3;n<=3;n+=1){let r=e*e+t*t+n*n;if(r===0||r>12)continue;let i=2*Math.PI/f*Math.sqrt(r),o=i/(1+(i/y)**2)**2,s=a*Math.sqrt(o)*(f/45);v.push({kx:2*Math.PI*e/f,ky:2*Math.PI*t/f,kz:2*Math.PI*n/f,k2:i*i,amp:s,phase:_()*2*Math.PI})}let b=Number(c?.[0])||0,x=Number(c?.[1])||0,S=Number(c?.[2])||0,C=0,w=0,T=0,E=0;for(let e=0;e<l;e+=1)for(let t=0;t<l;t+=1)for(let r=0;r<l;r+=1){let i=(r+.5)*p-.5*f,a=(t+.5)*p-.5*f,o=(e+.5)*p-.5*f,s=0,c=0,l=0;for(let e of v){let t=e.kx*i+e.ky*a+e.kz*o+e.phase,n=Math.sin(t)*(e.amp/e.k2);s+=e.kx*n,c+=e.ky*n,l+=e.kz*n}let u=zt(i+s+b,f),g=zt(a+c+x,f),_=zt(o+l+S,f),y=n*n*m*h,D=y*s,O=y*c,k=y*l;w+=D,T+=O,E+=k;let A=C*16;d[A+0]=u,d[A+1]=g,d[A+2]=_,d[A+3]=1,d[A+4]=D,d[A+5]=O,d[A+6]=k,d[A+7]=.25,d[A+12]=+(C%6==0),d[A+14]=n,C+=1}w/=u,T/=u,E/=u;for(let e=0;e<u;e+=1)d[e*16+4]-=w,d[e*16+5]-=T,d[e*16+6]-=E;if(s&&Number.isFinite(s.xMin)&&Number.isFinite(s.xMax)){let e=[];for(let t=0;t<u;t+=1){let n=d[t*16+0];n>=s.xMin&&n<s.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(d.subarray(r,r+16),n*16)}return{icBackend:`host-zeldovich-low-k`,particleCount:e.length,globalParticleCount:u,data:t,boxLengthMpc:f,aInit:n}}return{icBackend:`host-zeldovich-low-k`,particleCount:u,globalParticleCount:u,data:d,boxLengthMpc:f,aInit:n}}function Ht(e,{gridPerSide:t=24,pmGridN:n=32,boxLengthMpc:r=200,aInit:i=.05,da:a=.015,omegaM:o=.315,omegaLambda:s=.685,smoothCells:c=.75,enableShortRangeTree:l=!0,seed:u=20261122,initialPositionsShift:d=[0,0,0],slabBounds:f=null,initialConditions:p=null}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createSupergalacticTreePmSessionWebGpu requires a live WebGPU GPUDevice`);let h=p||Vt({gridPerSide:t,boxLengthMpc:r,aInit:i,omegaM:o,omegaLambda:s,seed:u,slabBounds:f,initialPositionsShift:d}),g=h.particleCount,_=h.globalParticleCount??h.particleCount,v=n,y=v**3,b=N(e,v),x=[C(0,`uniform`),C(1,`storage`),C(2,`storage`),C(3,`storage`),C(4,`storage`),C(5,`storage`),C(6,`storage`),C(7,`storage`)],S=t=>T(e,{cacheKey:`ulg-supergalactic-treepm-${t}.v3-1submit-pk-kdk`,label:`ulg-supergalactic-treepm-${t}`,code:It,entryPoint:t,bindings:x}),w=S(`clear_grids`),E=S(`cic_deposit`),D=S(`prepare_poisson_rhs`),O=S(`reduce_power_spectrum_pk`),k=S(`store_force_x`),A=S(`store_force_y`),j=S(`store_force_z`),M=S(`cic_kick_drift`),P=S(`reduce_telemetry_f32`),F=S(`reduce_tile_multipole`),I=e.createBuffer({size:64,usage:G.UNIFORM|G.COPY_DST}),L=e.createBuffer({label:`ulg-supergalactic-particles`,size:Math.max(64,h.data.byteLength),usage:G.VERTEX|G.STORAGE|G.COPY_DST|G.COPY_SRC});h.data.byteLength>0&&e.queue.writeBuffer(L,0,h.data);let R=e.createBuffer({size:y*4,usage:G.STORAGE}),z=e.createBuffer({size:y*16,usage:G.STORAGE}),ee=e.createBuffer({size:320,usage:G.STORAGE|G.COPY_SRC}),B=e.createBuffer({size:320,usage:G.MAP_READ|G.COPY_DST}),V=e.createBuffer({size:32,usage:G.MAP_READ|G.COPY_DST}),te=e.createBuffer({size:y*16,usage:G.STORAGE}),ne=e.createBuffer({size:(y+Ft)*16,usage:G.STORAGE|G.COPY_DST}),re=e.createBuffer({size:b.byteLength,usage:G.STORAGE|G.COPY_DST|G.COPY_SRC}),ie=t=>e.createBindGroup({layout:w.bindGroupLayout,entries:[I,L,R,t,z,ee,te,ne].map((e,t)=>({binding:t,resource:{buffer:e}}))}),ae=ie(b.bufferA),oe=ie(b.bufferB),H=ie(re),se=e=>e===b.bufferA?ae:e===b.bufferB?oe:H,ce=r/v,le=(c*ce)**2,ue=l?c*ce:0,de=_/y;b.writeAxisPoissonParams({boxLength:r,smoothR2:le});let fe=i,pe=0,me=0,he=0,ge=1,_e=null,ve={xMin:-.5*r,xMax:.5*r},ye=(t=null)=>{let n=t||ve,i=Rt(fe,{omegaM:o,omegaLambda:s}),c=1.5*o/Math.max(.01,fe),l=new ArrayBuffer(64);return new Uint32Array(l,0,4).set([g,v,pe,he]),new Float32Array(l,16,12).set([r,fe,a,i,o,c,de,ue,me,Number(n.xMin),Number(n.xMax),0]),e.queue.writeBuffer(I,0,l),{hA:i,gravPref:c}};function be(t=[]){let n=Array.isArray(t)?t.slice(0,Ft):[],r=new Float32Array(Ft*4);for(let e=0;e<n.length;e+=1){let t=n[e],i=t.com||[0,0,0];r[e*4+0]=Number(i[0])||0,r[e*4+1]=Number(i[1])||0,r[e*4+2]=Number(i[2])||0,r[e*4+3]=Math.max(0,Number(t.totalMass)||0)}return he=n.length,e.queue.writeBuffer(ne,y*16,r),he}let xe=Math.ceil(y/64),Se=Math.max(1,Math.ceil(g/64)),Ce=!1,we=null,Te=!1;async function Ee({readTelemetry:t=!0}={}){if(Te)return we;let{hA:n}=ye(),i=a/(Math.max(.01,fe)**2*Math.max(.05,n)),c=e.createCommandEncoder({label:`ulg-cosmo-treepm-step-${pe}`}),u=c.beginComputePass({label:`ulg-cosmo-cic-rhs`});u.setBindGroup(0,ae),u.setPipeline(w.pipeline),u.dispatchWorkgroups(xe),g>0&&(u.setPipeline(E.pipeline),u.dispatchWorkgroups(Se)),u.setPipeline(D.pipeline),u.dispatchWorkgroups(xe),u.end();let d=b.encodeForward(c);c.copyBufferToBuffer(d,0,re,0,b.byteLength),u=c.beginComputePass({label:`ulg-cosmo-pk`}),u.setBindGroup(0,H),u.setPipeline(O.pipeline),u.dispatchWorkgroups(Pt),u.end();let f=[k,A,j];for(let e=1;e<=3;e+=1){let t=b.encodePoissonInverseFromKSpace(c,re,{gradAxis:e});u=c.beginComputePass({label:`ulg-cosmo-store-f${e}`}),u.setBindGroup(0,se(t)),u.setPipeline(f[e-1].pipeline),u.dispatchWorkgroups(xe),u.end()}u=c.beginComputePass({label:`ulg-cosmo-kdk-telemetry`}),u.setBindGroup(0,ae),g>0&&(u.setPipeline(M.pipeline),u.dispatchWorkgroups(Se)),u.setPipeline(P.pipeline),u.dispatchWorkgroups(2),u.end();let p=!!(t&&!Te&&!Ce&&B.mapState===`unmapped`);if(p&&(Ce=!0,c.copyBufferToBuffer(ee,0,B,0,320)),e.queue.submit([c.finish()]),ge=1,me=i,fe=Math.min(1.5,fe+a),pe+=1,!p)return t?we:null;let y=null;try{if(await B.mapAsync(G.MAP_READ),Te||(y=new Float32Array(B.getMappedRange().slice(0,320))),!Te&&B.mapState===`mapped`)try{B.unmap()}catch{}}catch(e){if(!Te&&e?.name!==`AbortError`)throw e}finally{Ce=!1}if(!y||Te)return we;let x=Math.sqrt(Math.max(0,y[0]/Math.max(1,y[3]))),S=y[1],C=y[4],T=[y[5],y[6],y[7]],N=Math.max(0,1/fe-1),F=[],I=[],L=[],R=0;for(let e=0;e<Pt;e+=1){let t=(2+e)*4,n=Math.round(y[t+2]);n>0&&(F.push(y[t+0]),I.push(y[t+1]),L.push(n),R+=n)}let z=I.length>0?I.slice(0,Math.min(4,I.length)).reduce((e,t)=>e+t,0)/Math.min(4,I.length):0;_e===null&&z>0&&(_e=z);let V=_e>0?Math.sqrt(z/_e):1;return we=Object.freeze({schema:Nt,backend:l?`webgpu-fft3d-hybrid-treepm`:`webgpu-fft3d-pm`,icBackend:h.icBackend||`webgpu-fft3d-zeldovich`,integrator:`symplectic-comoving-kdk`,submitsPerStep:ge,hybridTreePmEnabled:!!l,shortRangeSplitScaleMpc:ue,remoteTileCount:he,stepIndex:pe,scaleFactorA:fe,redshiftZ:N,hOverH0:Rt(fe,{omegaM:o,omegaLambda:s}),particleCount:g,globalParticleCount:_,pmGridN:v,boxLengthMpc:r,sigmaDensity:x,maxOverdensity:S,kineticEnergy:C,momentum:T,powerSpectrumPk:Object.freeze({kBins:Object.freeze(F),pkValues:Object.freeze(I),modeCounts:Object.freeze(L),totalModes:R,lowKPower:z,linearGrowthRatio:V}),accuracyTier:m.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,sharedKernel:`src/runtime/gpuMath/fft3dWebGpu.js`})}),we}async function De(){if(g===0)return new Float32Array;let t=e.createBuffer({size:h.data.byteLength,usage:G.MAP_READ|G.COPY_DST});try{let n=e.createCommandEncoder({label:`ulg-cosmo-read-particles`});n.copyBufferToBuffer(L,0,t,0,h.data.byteLength),e.queue.submit([n.finish()]),await t.mapAsync(G.MAP_READ);let r=new Float32Array(t.getMappedRange().slice(0));return t.unmap(),r}finally{t.destroy()}}async function Oe({xMin:t=-.5*r,xMax:n=.5*r}={}){ve={xMin:Number(t),xMax:Number(n)},ye(ve);let i=e.createCommandEncoder({label:`ulg-cosmo-tile-multipole-gpu`}),a=i.beginComputePass();a.setBindGroup(0,ae),a.setPipeline(F.pipeline),a.dispatchWorkgroups(1),a.end(),i.copyBufferToBuffer(ee,288,V,0,32),e.queue.submit([i.finish()]),await V.mapAsync(G.MAP_READ);let o=new Float32Array(V.getMappedRange().slice(0,32));return V.unmap(),Object.freeze({reducedOnGpu:!0,readbackBytes:32,totalMass:o[0],com:Object.freeze([o[1],o[2],o[3]]),quadrupoleTrace:o[4],particleCount:Math.round(o[5]),scaleFactorA:fe,stepIndex:pe})}return Object.freeze({schema:Nt,icBackend:h.icBackend||`host-zeldovich-low-k`,particleCount:g,globalParticleCount:_,strideFloats:16,boxLengthMpc:r,hybridTreePmEnabled:!!l,shortRangeSplitScaleMpc:ue,particlesBuffer:L,forceGridBuffer:z,injectRemoteTileMultipoles:be,step:Ee,readParticlesSnapshot:De,readTileMultipoleSummary:Oe,getState:()=>({aScale:fe,redshiftZ:Math.max(0,1/fe-1),stepIndex:pe,submitsPerStep:ge,remoteTileCount:he}),destroy(){if(!Te){Te=!0,b.destroy();for(let e of[I,L,R,z,ee,B,V,te,ne,re])try{e.destroy()}catch{}}}})}var Ut=`ulg.astrophysics.surface-crater-tile-store.v1`,Wt=`ulg-surface-craters-v1`,Gt=`ulg-surface-craters-db`,Kt=`crater-tiles`;function qt(e,t=`default`){return String(e??t).replace(/[^a-zA-Z0-9_-]/g,`_`).slice(0,48)||t}function Jt({universeSeed:e=20261125,systemId:t=`sol`,bodyId:n=`mars`,tileX:r=0,tileZ:i=0}={}){return`${Number(e)>>>0}_${qt(t,`sol`)}_${qt(n,`body`)}_${Math.trunc(Number(r)||0)}_${Math.trunc(Number(i)||0)}`}function Yt(e={}){return{kind:Math.max(1,Math.min(3,Math.trunc(Number(e.kind)||1))),x:Number.isFinite(Number(e.x))?Number(e.x):0,z:Number.isFinite(Number(e.z))?Number(e.z):0,radiusM:Math.max(.5,Math.min(260,Number(e.radiusM)||10)),depthM:Math.max(.02,Math.min(64,Number(e.depthM)||3)),rimM:Number.isFinite(Number(e.rimM))?Number(e.rimM):.24,tempK:Math.max(40,Math.min(25e3,Number(e.tempK)||1600)),melt:Math.max(0,Math.min(1,Number(e.melt)||.6)),char:Math.max(0,Math.min(1,Number(e.char)||.7))}}function Xt(e){let t=null,n=async()=>(t||=(async()=>(await e()).getDirectoryHandle(Wt,{create:!0}))(),t),r=e=>`${e}.json`;return{name:`opfs`,async readRaw(e){let t=await n();try{return await(await(await t.getFileHandle(r(e),{create:!1})).getFile()).text()}catch(e){if(e?.name===`NotFoundError`)return null;throw e}},async writeRaw(e,t){let i=await(await n()).getFileHandle(r(e),{create:!0});if(typeof i.createWritable!=`function`)throw Error(`OPFS createWritable unavailable`);let a=await i.createWritable();await a.write(t),await a.close()},async deleteKey(e){let t=await n();try{await t.removeEntry(r(e))}catch(e){if(e?.name!==`NotFoundError`)throw e}}}}function Zt(e,t=Gt){let n=null,r=()=>(n||=new Promise((n,r)=>{let i=e.open(t,1);i.onupgradeneeded=()=>{let e=i.result;e.objectStoreNames.contains(`crater-tiles`)||e.createObjectStore(Kt)},i.onsuccess=()=>n(i.result),i.onerror=()=>r(i.error||Error(`IndexedDB open failed`))}),n),i=async(e,t)=>{let n=await r();return new Promise((r,i)=>{let a=t(n.transaction(Kt,e).objectStore(Kt));a.onsuccess=()=>r(a.result),a.onerror=()=>i(a.error||Error(`IndexedDB tx failed`))})};return{name:`indexeddb`,async readRaw(e){let t=await i(`readonly`,t=>t.get(e));return t==null?null:String(t)},async writeRaw(e,t){await i(`readwrite`,n=>n.put(String(t),e))},async deleteKey(e){await i(`readwrite`,t=>t.delete(e))}}}function Qt(){let e=new Map;return{name:`memory`,async readRaw(t){return e.has(t)?e.get(t):null},async writeRaw(t,n){e.set(t,String(n))},async deleteKey(t){e.delete(t)}}}function $t({backend:e=`auto`,opfsGetDirectory:t=null,indexedDBFactory:n=null,dbName:r=Gt}={}){let i=null,a=`uninitialized`,o=new Map,s=async()=>i||(i=(async()=>{let i=e===`auto`||e===`opfs`,o=e===`auto`||e===`indexeddb`,s=t||(typeof globalThis.navigator?.storage?.getDirectory==`function`?()=>globalThis.navigator.storage.getDirectory():null);if(i&&s)try{let e=Xt(s),t=`__ulg_crater_probe__`;return await e.writeRaw(t,`{"ok":true}`),await e.deleteKey(t),a=`opfs`,e}catch{if(e===`opfs`)return a=`memory`,Qt()}let c=n||(globalThis.indexedDB===void 0?null:globalThis.indexedDB);if(o&&c&&typeof c.open==`function`)try{let e=Zt(c,r);return await e.readRaw(`__ulg_probe__`),a=`indexeddb`,e}catch{}return a=`memory`,Qt()})(),i);async function c(e,t=[]){let n=(Array.isArray(t)?t:[]).slice(-512).map(Yt);o.set(e,n);let r=JSON.stringify({schema:Ut,updatedAtMs:Date.now(),stamps:n});try{let t=await s();return await t.writeRaw(e,r),{ok:!0,backend:t.name,count:n.length}}catch{return{ok:!1,backend:a,count:n.length}}}async function l(e){try{let t=await(await s()).readRaw(e);if(t){let n=JSON.parse(t);if(n?.schema===`ulg.astrophysics.surface-crater-tile-store.v1`&&Array.isArray(n.stamps)){let t=n.stamps.slice(-512).map(Yt);return o.set(e,t),t}}}catch{}return o.get(e)?[...o.get(e)]:[]}async function u(e){o.delete(e);try{await(await s()).deleteKey(e)}catch{}}return Object.freeze({schema:Ut,get backend(){return a},buildTileKey:Jt,saveTile:c,loadTile:l,deleteTile:u})}var en=27.211386245988,tn=11604.51812;Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});var K=null,nn=null;function rn({iH:e,iHe:t,iC:n,iO:r,backend:i}){let a=Math.max(8e4,Math.min(16e4,.75*e*tn)),o=Math.log10(Math.max(4e4,.31*t*tn)),s=Math.log10(Math.max(8e4,.78*(n+r)*tn));return Object.freeze({schema:`ulg.astrophysics.gate1-ism-cooling-anchors.v1`,backend:i,iHEv:e,iHeEv:t,iCEv:n,iOEv:r,tHLyaK:a,logTHePeak:o,logTMetalPeak:s,tFineStructK:92})}function an(e,t){let n=e?.orbitals||[];if(e?.atomicNumberZ===1&&Number.isFinite(e?.totalEnergyHa))return Math.max(10,Math.abs(e.totalEnergyHa)*en);let r=n.length>0?n[n.length-1]:null,i=Number(r?.energyHa);return Number.isFinite(i)&&i<0?Math.max(4,Math.abs(i)*en*1.45):t}async function on(e,{forceRecompute:t=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`deriveGate1IsmCoolingAnchorsWebGpu requires a live WebGPU GPUDevice`);if(nn&&!t)return nn;let[n,r,i,a]=await Promise.all([k(e,1,{A:1,maxScf:36}),k(e,2,{A:4,maxScf:36}),k(e,6,{A:12,maxScf:42}),k(e,8,{A:16,maxScf:42})]);return nn=rn({iH:an(n,13.6),iHe:an(r,24.59),iC:an(i,11.26),iO:an(a,13.62),backend:`webgpu-gate1-radial-ks`}),nn}function sn(){if(nn)return nn;if(K)return K;let e=i(1,{gridPointsN:160,maxScf:80,tol:1e-5}),t=i(2,{gridPointsN:160,maxScf:80,tol:1e-5}),n=i(6,{gridPointsN:160,maxScf:80,tol:1e-5}),r=i(8,{gridPointsN:160,maxScf:80,tol:1e-5});return K=rn({iH:Math.max(10,Math.abs(e.totalEnergyHa)*en),iHe:an(t,24.59),iC:an(n,11.26),iO:an(r,13.62),backend:`host-gate1-radial-ks`}),K}function cn(e,t=1,n=null){let r=n||sn(),i=Math.max(10,Number(e)),a=Math.max(0,Number(t)),o=Math.log10(i),s=a*25e-27*Math.exp(-r.tFineStructK/i)*Math.exp(-(((o-2.6)/.9)**2)),c=75e-23*Math.exp(-r.tHLyaK/i)/(1+(i/22e3)**2.2),l=18e-23*Math.exp(-(((o-r.logTHePeak)/.28)**2)),u=a*6e-22*Math.exp(-(((o-r.logTMetalPeak)/.48)**2)),d=142e-29*Math.sqrt(i)*(1.2+.1*a);return s+c+l+u+d}var ln=`ulg.astrophysics.planetary-interior-webgpu.v1`,un=66743e-15,dn=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});Object.freeze({earth:Object.freeze({massKg:59722e20,radiusM:6371e3,moiFactor:.3307,centralPressureGPa:364}),mars:Object.freeze({massKg:64171e19,radiusM:3389500,moiFactor:.3644,centralPressureGPa:40})});async function fn(e,n,{minPressurePa:r=1e4,maxPressurePa:i=0xe8d4a51000,maxTemperatureK:a=12e3,degrees:s=[5,5],relativeTolerance:c=.025,maxBisectDepth:l=3,materialIndex:d=0}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`buildPlanetaryPolytopeAtlasWebGpu requires a live WebGPU GPUDevice`);if(!n||typeof n!=`object`||!n.mechanical||!n.thermodynamic)throw TypeError(`buildPlanetaryPolytopeAtlasWebGpu requires a valid Gate 1-2 material bundle`);let f=t(),g=Math.max(15,Number(n.thermodynamic.meltingPointK??300)),_=Math.max(g+20,Number(n.thermodynamic.boilingPointK??g*1.5)),v=Math.max(_*2.5,Number(a)),y=f.discoverMaterialPolytopes({materialKey:n.materialKey||n.symbol||n.formula,family:n.family||`element`,meltingPointK:g,boilingPointK:_,ionizationTempK:v,meltingSlopeKPerLogP:Number(n.thermodynamic.meltingSlopeKPerLogP??120),boilingSlopeKPerLogP:Number(n.thermodynamic.boilingSlopeKPerLogP??220),maxTemperatureK:Math.max(v*1.5,Number(a)*1.5),minPressurePa:Number(r),maxPressurePa:Number(i),accuracyTier:n.accuracyTier||m.TIER_2_REPRESENTATIVE_EFFECTIVE,closureHash:n.closureHash||`planetary-v1`,provenance:n.provenance||{status:`webgpu-derived`,scientificValidation:!1}}),b=[];for(let t of y){let r=await u(e,t,(e,r)=>o(n,t.phase,e,r),{degrees:s,relativeTolerance:c,requirePositive:!0,maxDepth:l,propertyName:`densityKgPerM3`,logScale:!0});b.push(...r.polytopes)}let x=p(b,{materialIndex:d});return Object.freeze({schema:h,materialKey:n.materialKey||n.symbol||n.formula,minPressurePa:Number(r),maxPressurePa:Number(i),polytopeCount:b.length,polytopes:Object.freeze(b),packedGpuAtlas:x,accuracyTier:n.accuracyTier||m.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-polytope-fitted`,scientificValidation:!1})})}var pn=`
${f}

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

      // Midpoint RK2 radial hydrostatic step
      let r_mid = r + 0.5 * dr;
      let dM = 12.566370614 * r_mid * r_mid * rho * dr;
      let m_mid = m + 0.5 * dM;
      let g = select(0.0, (params.g_si * m_mid) / (r_mid * r_mid), r_mid > 1.0);
      let dP = -rho * g * dr;

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
`;async function mn(e,{centralPressurePa:t=36e10,surfacePressurePa:n=1e5,layers:r=[],radialStepM:i=2e4,maxRadiusM:a=15e7,convergePasses:o=3,maxProfileSamples:s=256,autoFitMaxPressurePa:c=0xe8d4a51000}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solvePlanetaryInteriorWebGpu requires a live WebGPU GPUDevice`);if(!Array.isArray(r)||r.length===0)throw TypeError(`solvePlanetaryInteriorWebGpu requires at least one material layer`);let l=[];for(let t=0;t<r.length;t+=1){let n=r[t],i=n.packedGpuAtlas||n.atlas?.packedGpuAtlas||null;if(!i&&Array.isArray(n.polytopes)&&n.polytopes.length>0&&(i=p(n.polytopes,{materialIndex:t})),!i&&n.bundle&&(i=(await fn(e,n.bundle,{maxPressurePa:c,materialIndex:t})).packedGpuAtlas),!i)throw TypeError(`Layer ${t} (${n.name||`unnamed`}) must provide packedGpuAtlas, atlas, polytopes, or bundle`);l.push({name:n.name||n.bundle?.materialKey||n.atlas?.materialKey||`layer-${t}`,massFractionTarget:Math.max(0,Number(n.massFractionTarget??1)),tempK:Math.max(10,Number(n.tempK??1500)),bundle:n.bundle||null,packedGpuAtlas:i,materialId:t})}let u=g(l.map(e=>({materialId:e.materialId,materialKey:e.name,accuracyTier:e.bundle?.accuracyTier||m.TIER_2_REPRESENTATIVE_EFFECTIVE,packedGpuAtlas:e.packedGpuAtlas}))),d=l.reduce((e,t)=>e+t.massFractionTarget,0)||1,f=new Float32Array(l.length*4),h=0;for(let e=0;e<l.length;e+=1)h+=l[e].massFractionTarget/d,f.set([h,l[e].tempK,l[e].materialId,0],e*4);let _=new Float32Array([Number(t),6e24,0,0]),v=new ArrayBuffer(32);new Uint32Array(v,0,4).set([1,l.length,s,o]),new Float32Array(v,16,4).set([Number(n),Number(i),Number(a),un]);let y=T(e,{cacheKey:`ulg-planetary-hydrostatic-polytope.v1`,label:`ulg-planetary-hydrostatic-polytope`,code:pn,entryPoint:`solve_planetary_hydrostatic`,bindings:[C(0,`uniform`),C(1,`read-only-storage`),C(2,`read-only-storage`),C(3,`read-only-storage`),C(4,`storage`),C(5,`storage`)]}),b=e.createBuffer({size:32,usage:dn.UNIFORM|dn.COPY_DST}),x=e.createBuffer({size:Math.max(64,u.data.byteLength),usage:dn.STORAGE|dn.COPY_DST}),S=e.createBuffer({size:Math.max(16,f.byteLength),usage:dn.STORAGE|dn.COPY_DST}),w=e.createBuffer({size:16,usage:dn.STORAGE|dn.COPY_DST}),E=e.createBuffer({size:48,usage:dn.STORAGE|dn.COPY_SRC}),D=e.createBuffer({size:s*32,usage:dn.STORAGE|dn.COPY_SRC}),O=e.createBuffer({size:48,usage:dn.MAP_READ|dn.COPY_DST}),k=e.createBuffer({size:s*32,usage:dn.MAP_READ|dn.COPY_DST});try{e.queue.writeBuffer(b,0,v),e.queue.writeBuffer(x,0,u.data),e.queue.writeBuffer(S,0,f),e.queue.writeBuffer(w,0,_);let n=e.createBindGroup({layout:y.bindGroupLayout,entries:[b,x,S,w,E,D].map((e,t)=>({binding:t,resource:{buffer:e}}))}),r=e.createCommandEncoder({label:`ulg-planetary-hydrostatic`}),i=r.beginComputePass();i.setPipeline(y.pipeline),i.setBindGroup(0,n),i.dispatchWorkgroups(1),i.end(),r.copyBufferToBuffer(E,0,O,0,48),r.copyBufferToBuffer(D,0,k,0,s*32),e.queue.submit([r.finish()]),await Promise.all([O.mapAsync(dn.MAP_READ),k.mapAsync(dn.MAP_READ)]);let a=new Float32Array(O.getMappedRange().slice(0,48)),o=new Float32Array(k.getMappedRange().slice(0,s*32));O.unmap(),k.unmap();let c=Math.round(a[3]),d=c===2,p=c===1,h=Math.min(s,Math.max(0,Math.round(a[7]))),g=[];for(let e=0;e<h;e+=1){let t=e*8,n=Math.min(l.length-1,Math.max(0,Math.round(o[t+5])));g.push(Object.freeze({radiusM:o[t+0],pressurePa:o[t+1],densityKgPerM3:o[t+2],massEnclosedKg:o[t+3],gravityMPerS2:o[t+4],layer:l[n].name,phaseCode:Math.round(o[t+6]),polytopeHit:o[t+7]>.5}))}let C=Number(l[0]?.bundle?.electromagnetic?.electricalConductivitySPerM??0);return Object.freeze({schema:ln,backend:`webgpu-polytope-atlas`,valid:p,failClosed:d,reason:d?`polytope-out-of-domain`:c===3?`max-radius-reached`:`ok`,failureState:d?Object.freeze({pressurePa:a[8],temperatureK:a[9],layerIndex:Math.round(a[10]),layer:l[Math.max(0,Math.round(a[10]))]?.name??`unknown`}):null,centralPressurePa:Number(t),totalMassKg:a[0],radiusM:a[1],moiFactor:a[2],meanDensityKgPerM3:a[4],surfaceGravityMPerS2:a[5],escapeVelocityMPerS:a[6],minPolytopeMargin:a[11],coreConductivitySPerM:C,dynamoCapable:p&&C>1e4&&t>1e10,layerCount:l.length,profile:Object.freeze(g),accuracyTier:m.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-polytope-atlas-derived`,inlineWgslEvaluator:`eval_polytope_atlas_bank_2d`,scientificValidation:!1})})}finally{for(let e of[b,x,S,w,E,D,O,k])e.destroy()}}var hn=`peercompute.ulg.hydrogen-stellar-closure.v1`,gn=`peercompute.ulg.stellar-closure-table-abi.v1`,_n=1380649e-29,vn=16605390666e-37,yn=167262192369e-38,bn=91093837015e-41,xn=1054571817e-43,Sn=299792458,q=66743e-15,J=4*5.670374419e-8/Sn,Cn=1602176634e-28,wn=27.211386245988,Tn=198847e25,En=ge();En.ppThermalMeV;var Dn=En.ppJPerKgH;En.tripleAlphaMeV;var On=En.tripleAlphaJPerKgHe;En.fePhotodisMeV;var kn=null;async function An(e,{forceRecompute:t=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`deriveQuantumHydrogenAnchorsWebGpu requires a live WebGPU GPUDevice`);if(kn?.backend===`webgpu`&&!t)return kn;let r=await k(e,1,{A:1,maxScf:45}),i=Number(r.totalEnergyHa??-.5),o=Number(r.homoEnergyHa??r.orbitals?.[0]?.energyHa??-.5),s=Math.max(11,Math.min(15,Math.abs(i)*wn)),u=await c(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basisName:`sto-3g`,maxScf:24,sampleVolume:!1}),d=.05,f=await c(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.45]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:u.densityMatrix}),p=await c(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-d]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:u.densityMatrix}),m=2*i,h=Math.max(.08,m-u.totalEnergyHa)*wn,g=Math.max(.1,(f.totalEnergyHa-2*u.totalEnergyHa+p.totalEnergyHa)/(d*d)),_=Math.sqrt(g/(.5*1836.152673))*wn*Cn/_n,v=n(15e4/yn*l**3),y=a(v);return kn=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,backend:`webgpu`,hTotalEnergyHa:i,h1sOrbitalEnergyHa:o,hIonizationEv:s,hIonizationTempK:s*Cn/_n,h2EqEnergyHa:u.totalEnergyHa,h2DissEnergyHa:m,h2DiradicalStretched:1,h2DissociationEv:h,h2DissociationTempK:h*Cn/_n,h2VibrationalTempK:_,uegSolarCoreRsBohr:v,uegSolarCoreKineticHa:y,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),kn}function jn({forceRecompute:e=!1}={}){if(kn&&!e)return kn;let t=i(1,{functional:`pbe`,scalarRelativistic:!0,spinOrbit:!1,gridPointsN:320,rMaxBohr:24,maxScf:180,tol:1e-6}),r=t.orbitals?.[0]?.energyHa??-.5,o=Math.max(11,Math.min(15,Math.abs(t.totalEnergyHa)*wn)),s=d([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`6-31g`,tol:1e-9}),c=d([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,10]}],{basis:`6-31g`,tol:1e-9}),u=Math.max(.08,c.totalEnergyHa-s.totalEnergyHa)*wn,f=.04,p=d([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.44]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,m=d([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,h=d([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-f]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,g=Math.max(.1,(p-2*m+h)/(f*f)),_=Math.sqrt(g/(.5*1836.152673))*wn*Cn/_n,v=n(15e4/yn*l**3),y=a(v);return kn=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,hTotalEnergyHa:t.totalEnergyHa,h1sOrbitalEnergyHa:r,hIonizationEv:o,hIonizationTempK:o*Cn/_n,h2EqEnergyHa:s.totalEnergyHa,h2DissEnergyHa:c.totalEnergyHa,h2DiradicalStretched:c.diradicalCharacter,h2DissociationEv:u,h2DissociationTempK:u*Cn/_n,h2VibrationalTempK:_,uegSolarCoreRsBohr:v,uegSolarCoreKineticHa:y,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),kn}function Mn(e,t=.85){let n=Math.max(0,e*Math.max(.1,t)/yn);if(n<=0)return 0;let r=xn*Math.cbrt(3*Math.PI*Math.PI*n)/(bn*Sn),i=r*r,a=bn**4*Sn**5/(24*Math.PI*Math.PI*xn**3);if(r<.01)return a*(1.6*i*i*r-4/7*i*i*i*r);let o=Math.sqrt(1+i),s=r*(2*i-3)*o+3*Math.asinh(r);return Math.max(0,a*s)}function Nn(e){let t=Math.max(0,Number(e)||0),n=25e8;return t<=n?0:6e23*((t-n)/3e9)**2.75}function Pn({rhoKgM3:e=1e-16,temperatureK:t=30,xH:n=.74,xHe:r=.25,xMetals:i=.01,anchors:a=null}={}){let o=a||jn(),s=Math.max(1e-24,Number(e)||1e-16),c=Math.max(5,Number(t)||30),l=Math.max(1e-9,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*u/yn,m=s*d/(4*yn),h=s*f/(16*yn),g=2*Math.PI*yn*_n*c/(2*Math.PI*xn)**2,_=Math.max(1e-30,.5*g)**1.5,v=Math.max(1,c/(2*85.4))/Math.max(1e-6,1-Math.exp(-o.h2VibrationalTempK/c)),y=-o.h2DissociationTempK/c,b=0;if(y<-700)b=1;else if(y>40)b=0;else{let e=_/Math.max(1,v)*Math.exp(y)/Math.max(1e-20,4*p);if(e>1e8)b=0;else if(e<1e-12)b=1;else{let t=-e+Math.sqrt(e*e+2*e);b=Math.max(0,Math.min(1,1-t))}}let x=Math.max(0,p*(1-b)),S=2*Math.PI*bn*_n*c/(2*Math.PI*xn)**2,C=-o.hIonizationTempK/c,w=0;if(x>0&&C>-700){let e=Math.max(1e-30,S)**1.5*Math.exp(Math.min(50,C))/Math.max(1e-20,x);w=e>1e8?1:e<1e-14?0:Math.max(0,Math.min(1,.5*(-e+Math.sqrt(e*e+4*e))))}let T=1/(1+Math.exp(-(Math.log10(s)-1.5)*2.4));w=Math.max(w,T),w>.5&&(b*=Math.max(0,1-(w-.5)*2));let E=Math.max(T,1/(1+Math.exp(-(c-28e3)/5500))),D=.5*p*b,O=p*(1-b),k=O*w+2*E*m+8*E*h,A=Math.max(1e-20,D+O+m+h+k),j=s/vn/A,M=A*_n*c,N=J/3*c**4,P=Mn(s,Math.max(.25,u*w+.5*d*E+.5*f*E)),F=Nn(s),I=M+N+P+F,L=P/Math.max(1e-30,I),R=N/Math.max(1e-30,I),z=F/Math.max(1e-30,I),ee=4*b*(1-b),B=4*w*(1-w),V=c>12e8?Math.min(.32,(c-12e8)/15e8*.32):0,te=5/3-4/15*b*(1/(1+Math.exp(-(c-120)/35))),ne=te*(1-R)+4/3*R,re=Math.max(1.06,ne-.5*ee-.48*B-V)*(1-z)+2.75*z,ie=.1*(1/(1+Math.exp((c-1600)/180))),ae=25e-33*Math.sqrt(Math.max(1e-20,s))*Math.min(12e3,c)**9*(1/(1+Math.exp((c-9e3)/1200))),oe=4e21*(1+u)*(f+.001)*s*c**-3.5,H=.02*(1+u)*Math.max(.01,w),se=Math.max(1e-4,Math.min(1e5,ie+ae+oe+H)),ce=M/(Math.max(.15,te-1)*s)+3*N/s,le=(1-b)*.5*u*o.h2DissociationEv*Cn/yn,ue=w*u*o.hIonizationEv*Cn/yn,de=ce+le+ue;return{schema:hn,rhoKgM3:s,temperatureK:c,xH:u,xHe:d,xMetals:f,fH2:b,xIonized:w,mu:j,gammaEff:re,pressureIdealPa:M,pressureRadPa:N,pressureDegPa:P,pressureNucSatPa:F,pressureTotalPa:I,pDegFraction:L,pRadFraction:R,pNucFraction:z,soundSpeedMPerS:Math.sqrt(Math.max(1,re*I/s)),kappaM2PerKg:se,specificEnergyJPerKg:de,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function Fn({rhoKgM3:e=15e4,temperatureK:t=15e6,xH:n=.74,xHe:r=.25,xMetals:i=.01,dtS:a=0,coreMassSolar:o=1}={}){let s=Math.max(0,Number(e)||0),c=Math.max(1,Number(t)||1),l=Math.max(1e-12,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*.001,m=c*1e-6,h=c*1e-8,g=c*1e-9,_=0,v=0,y=1/0;if(m>.5&&u>1e-6&&(y=33.8/Math.cbrt(m),v=1.22*m**(2/3),y<200)){let e=(1+.0123*Math.cbrt(m)+.0109*m**(2/3))*1.18;_=238*p*u*u*m**(-2/3)*Math.exp(-y)*e}let b=0;if(m>5&&u>1e-6&&f>1e-6){let e=152.28/Math.cbrt(m);e<220&&(b=44e20*p*u*(.5*f)*m**(-2/3)*Math.exp(-e))}let x=0;if(h>.35&&d>1e-6){let e=44.027/h;e<200&&(x=p*p*509e5*(d*d*d)*h**-3*Math.exp(-e))}let S=0;if(g>1.2&&f>.3){let e=Math.min(1,(g-1.2)/1.5);S=15e7*f*e*e*Math.exp(-Math.max(0,12/g-5))}let C=_+b+x,w=C-S,T=0,E=0;if(a>0&&C>0){let e=_+b;T=Math.min(u,e*a/Dn),E=Math.min(d+T,x*a/On),u=Math.max(0,u-T),d=Math.max(0,d+T-E),f=Math.max(0,f+E);let t=u+d+f;u/=t,d/=t,f/=t}let D=o>=1.44&&f>=.5&&(c>=14e8||s>=15e8),O=`none`,k=0;if(D){let e=Math.max(1.35,o*.14);k=2*q*e*Tn/(Sn*Sn),O=e>2.35?`black-hole`:`neutron-star`}let A=Math.abs(u+d+f-1);return{schema:`peercompute.ulg.stellar-nuclear-fusion-closure.v1`,epsPpWPerKg:_,epsCnoWPerKg:b,eps3aWPerKg:x,epsPhotodisWPerKg:S,epsTotalWPerKg:C,epsNetWPerKg:w,gamowPeakKeV:v,gamowTauPp:y,fusionActive:C>1e-6,nextMassFractions:{xH:u,xHe:d,xMetals:f},dXBurned:T,dYBurned:E,nucleonConservationRelError:A,coreCollapseTriggered:D,remnantClass:O,schwarzschildRadiusM:k,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function In(e){let t=E(Math.max(600,Math.min(6e4,Number(e)||5778)));return[t.r,t.g,t.b]}function Ln({coreTempK:e=20,coreRhoKgM3:t=1e-16,fH2:n=1,xIonized:r=0,xH:i=.74,epsNucWPerKg:a=0,pDegFraction:o=0,supernovaShockActive:s=!1,remnantClass:c=`none`}={}){return c===`black-hole`?{id:`black-hole`,label:`Black Hole & Expanding SNR`}:c===`neutron-star`?{id:`neutron-star`,label:`Neutron Star & Expanding SNR`}:s?{id:`supernova`,label:`Core-Collapse Supernova`}:e>=8e7&&i<.18?{id:`helium-burning`,label:`Red Giant / Triple-α Core`}:a>1e-4&&i>=.18?{id:`main-sequence`,label:`Main-Sequence Fusion Star`}:a>1e-7?{id:`fusion-ignition`,label:`pp-Chain Quantum Ignition`}:r>=.35||e>=8e3?{id:`saha-protostar`,label:`Ionized Protostar (Saha H⁺)`}:n<.85||e>=1400?{id:`h2-dissociation`,label:`H₂ Dissociation Collapse (γ<4/3)`}:e>=120||t>=1e-9?{id:`larson-core`,label:`First Hydrostatic Larson Core`}:{id:`molecular-nebula`,label:`Cold Molecular H₂ Nebula`}}function Rn({nRho:e=28,nTemp:t=40,logRhoMin:n=-18,logRhoMax:r=11,logTempMin:i=1,logTempMax:a=9.6,xH:o=.74,xHe:s=.25,xMetals:c=.01,anchors:l=null}={}){let u=l||jn(),d=new Float32Array(e*t*8);for(let l=0;l<t;l+=1){let f=10**(i+l/Math.max(1,t-1)*(a-i));for(let t=0;t<e;t+=1){let i=Pn({rhoKgM3:10**(n+t/Math.max(1,e-1)*(r-n)),temperatureK:f,xH:o,xHe:s,xMetals:c,anchors:u}),a=(l*e+t)*8;d[a+0]=i.mu,d[a+1]=i.gammaEff,d[a+2]=i.fH2,d[a+3]=i.xIonized,d[a+4]=i.pDegFraction,d[a+5]=Math.log10(Math.max(1e-6,i.kappaM2PerKg)),d[a+6]=i.pNucFraction,d[a+7]=i.pRadFraction}}return{schema:gn,nRho:e,nTemp:t,logRhoMin:n,logRhoMax:r,logTempMin:i,logTempMax:a,strideFloats:8,anchors:u,data:d,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}async function zn({closureRegistry:e,device:t=null,closureTable:n=null,closureId:r=`ulg-quantum-hydrogen-plasma-eos-2d.v1`}={}){let i=n;i||=Rn({anchors:t?await An(t):jn()});let a={closureId:r,closureKind:`plasma-eos-fusion-2d-table`,inputHash:`h-he-z:${i.nRho}x${i.nTemp}`,methodHash:`ks-pbe+cas22+ueg+nuclear-saturation.v1`,execution:{mode:`bilinear-2d-gpu-table`,table:i},validity:{log10Rho:[i.logRhoMin,i.logRhoMax],log10T:[i.logTempMin,i.logTempMax]},provenance:{schema:gn,anchors:i.anchors,radiationClosure:`src/runtime/material/radiationClosure.js#blackbodyColorSrgb`,validation:i.validation}};return{ref:e?await e.store(a):null,artifact:a,table:i}}var Bn=`peercompute.ulg.self-gravitating-hydro-gpu.v1`,Vn=128,Hn=32,Y=Hn*Hn*Hn,Un=Y*8,Wn=`
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

const HYDRO_DIM: u32 = ${Hn}u;
const HYDRO_COUNT: u32 = ${Y}u;

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
`;function Gn(e,t,n,r){let i=Math.max(1,t),a=Math.max(1,e[10]),o=Math.max(1.15,(e[0]||1400)/1e3),s=(e[1]||4e3)/1e3-20,c=(e[2]||0)/1e3-30,l=e[3]||0,u=Math.min(1,(e[4]||0)/(i*1e3)),d=Math.min(1,(e[5]||0)/(i*1e3)),f=Math.min(1,(e[6]||0)/(i*1e3)),p=Math.min(1,(e[7]||0)/(i*1e3)),m=Math.min(1,(e[8]||0)/(i*1e3)),h=Math.min(1,(e[9]||0)/(i*1e3)),g=e[10]>0?Math.min(1,(e[11]||0)/(a*1e3)):m,_=e[10]>0?Math.min(1,(e[12]||0)/(a*1e3)):f,v=e[10]>0?(e[15]||1667)/(a*1e3):5/3,y=e[13]||0,b=e[14]||0,x=10**o,S=10**s,C=c>-29?10**c:0,w=Pn({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g}),T=Fn({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g,coreMassSolar:n}),E=!!(r||b>4&&x>=25e7||T.coreCollapseTriggered&&y>40),D=Math.max(1.35,n*.14),O=E?D>2.35?`black-hole`:`neutron-star`:`none`,k=E?2*66743e-15*D*198847e25/299792458**2:0,A=Ln({coreTempK:x,coreRhoKgM3:S,fH2:w.fH2,xIonized:w.xIonized,xH:_,epsNucWPerKg:Math.max(C,T.epsTotalWPerKg),pDegFraction:w.pDegFraction,supernovaShockActive:E&&y>80,remnantClass:O}),j=Math.max(1200,Math.min(38e3,x<1e4?Math.max(1200,x*.85):Math.min(36e3,3200+Math.max(0,n)**.72*3200))),M=In(j);return{coreTempK:x,coreLogT:o,coreRhoKgM3:S,coreLogRho:s,peakEpsNucWPerKg:Math.max(C,T.epsTotalWPerKg),gamowPeakKeV:T.gamowPeakKeV,gamowTauPp:T.gamowTauPp,fusingCount:l,meanFH2:u,meanXIonized:d,coreFH2:w.fH2,coreXIonized:w.xIonized,coreMu:w.mu,coreGammaEff:Math.min(v,w.gammaEff),corePDegFraction:w.pDegFraction,corePNucFraction:w.pNucFraction,meanPDegFraction:h,meanXH:f,meanXHe:p,meanXZ:m,coreXH:_,coreXZ:g,nucleonSum:f+p+m,shockCount:y,nuclearBounceCount:b,supernovaTriggered:E,remnantClass:O,schwarzschildRadiusM:k,photosphereTempK:j,photosphereSrgb:M,stage:A}}function Kn({device:e=null,initialBodies:t,eosClosureTable:n=null,gravityG:r=.42,softening:i=.25,boxHalf:a=14,rCellFactor:o=.075,baseLogRho:s=-16.2,refRhoSim:c=.08,burnTimescaleS:l=42e13,tScaleK:u=78e4,label:d=`ulg-self-gravitating-hydro`}={}){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`createSelfGravitatingHydroEngine requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`);let f=Float32Array.from(t),p=f.length/16,m=n||Rn({nRho:28,nTemp:40});function h(e){let t=0;for(let n=0;n<e.length;n+=16)t+=e[n+3];return t/100}let g=h(f),_=0,v=0,y=!1,b=!1;function x(e){let t=1.2,n=s,r=0,i=0,a=0,o=0;for(let s=0;s<p;s+=1){let c=s*16;e[c+8]>t&&(t=e[c+8]),e[c+9]>n&&(n=e[c+9]),r+=e[c+12],i+=e[c+10],a+=e[c+14],o+=e[c+15]}let c=new Uint32Array(16);return c[0]=Math.round(t*1e3),c[1]=Math.round((n+20)*1e3),c[4]=Math.round(r*1e3),c[6]=Math.round(i*1e3),c[7]=Math.round(a*1e3),c[8]=Math.round(o*1e3),c[10]=1,c[11]=Math.round(o/p*1e3),c[12]=Math.round(i/p*1e3),c[15]=1667,Gn(c,p,g,!1)}let S=x(f),E=Math.max(64,f.byteLength),D=[e.createBuffer({label:`${d}-p0`,size:E,usage:172}),e.createBuffer({label:`${d}-p1`,size:E,usage:172})],O=ke(e,{maxCount:p,strideFloats:16,chartLevel:35,useAdjSoftening:!0,qMass:65536,qMom:4096,rCellFactor:o,label:`${d}-ss-atlas`}),k=ge(),A=e.createBuffer({label:`${d}-hydro-accum`,size:Un*4,usage:Vn}),j=e.createBuffer({label:`${d}-hydro-grid`,size:Y*2*16,usage:Vn}),M=e.createBuffer({label:`${d}-eos-table`,size:m.data.byteLength,usage:136}),N=e.createBuffer({label:`${d}-telemetry`,size:64,usage:132}),P=e.createBuffer({label:`${d}-telemetry-staging`,size:64,usage:9}),F=e.createBuffer({label:`${d}-params`,size:96,usage:72}),I=e.createBuffer({label:`${d}-body-staging`,size:E,usage:9});e.queue.writeBuffer(D[0],0,f),e.queue.writeBuffer(D[1],0,f),e.queue.writeBuffer(M,0,m.data);let L=[C(0,`read-only-storage`),C(1,`storage`),C(2,`storage`),C(3,`read-only-storage`),C(4,`storage`),C(5,`read-only-storage`),C(6,`storage`),C(7,`uniform`)],R=t=>T(e,{cacheKey:`ulg-self-gravitating-hydro-${t}.v26-cic-grad-ss-atlas`,label:`ulg-self-gravitating-hydro-${t}`,code:Wn,entryPoint:t,bindings:L}),z={clear:R(`sgh_clear`),deposit:R(`sgh_deposit`),finalize:R(`sgh_finalize`),integrate:R(`sgh_integrate`)},ee=(t,n,r)=>w(e,{layout:z.integrate.bindGroupLayout,label:`${d}-bg-${r}`,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:O.accPhiBuffer}},{binding:4,resource:{buffer:j}},{binding:5,resource:{buffer:M}},{binding:6,resource:{buffer:N}},{binding:7,resource:{buffer:F}}]}),B=[ee(D[0],D[1],0),ee(D[1],D[0],1)],V=0,te=!1,ne=!1,re=!0;async function ie(){if(!D||!I||ne||b)return f;ne=!0;try{let t=e.createCommandEncoder({label:`${d}-readback`});t.copyBufferToBuffer(D[V],0,I,0,f.byteLength),e.queue.submit([t.finish()]),await I.mapAsync(1),f.set(new Float32Array(I.getMappedRange())),I.unmap()}finally{ne=!1}return f}async function ae({dt:t=.018,timeAccel:n=1,readTelemetry:o=!0}={}){if(b||!D)return S;let f=Math.max(.25,Math.min(25,Number(n)||1)),h=Math.max(.004,Math.min(.028,Number(t)||.018)),x=1380649e-29/167262192369e-38*1.5*u,C=new ArrayBuffer(96),w=new Uint32Array(C),T=new Float32Array(C);w[0]=p,w[1]=m.nRho,w[2]=m.nTemp,w[3]=+!!re,T[4]=h,T[5]=r,T[6]=i*i,T[7]=a,T[8]=.65*.65,T[9]=m.logRhoMin,T[10]=m.logRhoMax,T[11]=m.logTempMin,T[12]=m.logTempMax,T[13]=s,T[14]=c,T[15]=l,T[16]=f,T[17]=u,T[18]=k.ppJPerKgH,T[19]=k.tripleAlphaJPerKgHe,T[20]=k.fePhotodisJPerKgFe,T[21]=x,e.queue.writeBuffer(F,0,C),O.writeParams({count:p,gravityG:r,softening2:i*i,boxHalf:a,theta2:.65*.65});let E=V,A=1-V,j=B[E],M=Math.ceil(p/64),I=Math.ceil(Y/64),L=e.createCommandEncoder({label:`${d}-step-${_}`}),R=L.beginComputePass({label:`${d}-pass`});O.encodeIntoPass(R,{srcBuffer:D[E],count:p}),R.setPipeline(z.clear.pipeline),R.setBindGroup(0,j),R.dispatchWorkgroups(I),R.setPipeline(z.deposit.pipeline),R.setBindGroup(0,j),R.dispatchWorkgroups(M),R.setPipeline(z.finalize.pipeline),R.setBindGroup(0,j),R.dispatchWorkgroups(I),R.setPipeline(z.integrate.pipeline),R.setBindGroup(0,j),R.dispatchWorkgroups(M),R.end();let ee=o&&!te;if(ee&&L.copyBufferToBuffer(N,0,P,0,64),re=ee,e.queue.submit([L.finish()]),V=A,_+=1,v+=h*f*.35,ee){te=!0;try{await P.mapAsync(1);let e=new Uint32Array(P.getMappedRange().slice(0));P.unmap(),e[14]>4&&10**((e[0]||1400)/1e3)>=15e7&&(y=!0),S=Gn(e,p,g,y)}finally{te=!1}}return S}function oe(t){return f=Float32Array.from(t),g=h(f),_=0,v=0,y=!1,V=0,re=!0,S=x(f),D&&(e.queue.writeBuffer(D[0],0,f),e.queue.writeBuffer(D[1],0,f)),S}function H(){b||(b=!0,D?.[0]?.destroy(),D?.[1]?.destroy(),O.destroy(),A.destroy(),j.destroy(),M.destroy(),N.destroy(),P.destroy(),F.destroy(),I.destroy(),D=null)}return{schema:Bn,get count(){return p},get totalMassSolar(){return g},get stepIndex(){return _},get simTimeMyr(){return v},get backend(){return`webgpu`},get gravityMode(){return O.gravityMode},get solverMode(){return`webgpu-self-gravitating-hydro-eos`},get gate1BurnConstants(){return k},get closureTable(){return m},get anchors(){return m.anchors},getTelemetry:()=>S,getBodies:()=>f,getResidentBuffer:()=>D?D[V]:null,readbackBodies:ie,step:ae,resetBodies:oe,dispose:H}}var qn=Object.freeze({id:`main-sequence-star`,label:`Hydrostatic Main-Sequence Star (1.0 M☉)`,shortLabel:`1 M☉ Active Star`,description:`Hydrostatic Lane-Emden convective 1.0 M☉ G2V star in nuclear-thermal equilibrium with differential rotation driving an emergent 3D convective dynamo.`,totalMassSolar:1,initialTempK:15e6,initialLog10Rho:5.15,angularMomentum:.36,cloudRadius:4,geometry:`lane-emden-star`}),X=Object.freeze({"solar-nebula":Object.freeze({id:`solar-nebula`,label:`Solar Nebula (1.0 M☉)`,shortLabel:`1 M☉ Solar Star`,description:`Cold 25 K turbulent 1.0 M☉ H₂ cloud fed into ULG general self-gravitating hydro + quantum plasma EOS & Gamow fusion laws.`,totalMassSolar:1,initialTempK:25,initialLog10Rho:-16,angularMomentum:.44,cloudRadius:9,geometry:`bonnor-ebert`}),"massive-supernova":Object.freeze({id:`massive-supernova`,label:`Massive Cloud → Supernova (18 M☉)`,shortLabel:`18 M☉ Supernova`,description:`Identical laws, 18× heavier initial hydrogen particles -> rapid CNO/triple-α burn -> Fe photodisintegration collapse -> nuclear-saturation EOS bounce & Black Hole.`,totalMassSolar:18,initialTempK:36,initialLog10Rho:-15.3,angularMomentum:.22,cloudRadius:8.6,geometry:`bonnor-ebert`}),"binary-nursery":Object.freeze({id:`binary-nursery`,label:`Binary Star Nursery (2.4 M☉)`,shortLabel:`2.4 M☉ Binary`,description:`Identical laws on a rotating twin-lobe 2.4 M☉ molecular cloud fragmenting into two orbiting fusing stars linked by tidal gas.`,totalMassSolar:2.4,initialTempK:28,initialLog10Rho:-15.7,angularMomentum:.65,cloudRadius:9.5,geometry:`twin-lobe`})});function Jn(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Yn({count:e=8192,preset:t=`solar-nebula`,gravityG:n=.42,seed:r=1939,centerOffset:i=[0,0,0]}={}){let a=t===`main-sequence-star`?qn:X[t]||X[`solar-nebula`],o=Math.max(256,Math.min(32768,Math.floor(e))),s=new Float32Array(o*16),c=Number(i?.[0])||0,l=Number(i?.[1])||0,u=Number(i?.[2])||0,d=Jn(r+(t===`massive-supernova`?101:t===`binary-nursery`?202:0)),f=()=>{let e=Math.max(1e-7,d()),t=d();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},p=a.totalMassSolar*100,m=p/o,h=Math.log10(a.initialTempK),g=a.initialLog10Rho,_=[];for(let e=0;e<8;e+=1)_.push({kx:(d()-.5)*.72,ky:(d()-.5)*.72,kz:(d()-.5)*.72,phase:d()*Math.PI*2,amp:.45+d()*.65});for(let e=0;e<o;e+=1){let t=e*16,r,i,v,y,b,x,S=0,C=null,w=null,T=null,E=null,D=.74,O=.25,k=.01;if(a.geometry===`lane-emden-star`){let e=.5;for(let t=0;t<24;t+=1){let t=d(),n=t*t*Math.max(0,1-t*t)**1.5;if(d()*.19<=n){e=t;break}}let t=.12+e*(a.cloudRadius-.12),n=2*d()-1,o=Math.sqrt(Math.max(0,1-n*n)),s=d()*Math.PI*2;r=t*o*Math.cos(s),i=t*n,v=t*o*Math.sin(s);let c=(.48-n*n*.14)*(.78+.35*Math.exp(-e*1.4)),l=Math.max(0,(e-.56)/.44),u=Math.sin(s*6+n*4)*Math.cos(e*8)*l*.18;y=-v*c+r/t*u+f()*.03,b=i/t*u+f()*.03,x=r*c+v/t*u+f()*.03;let p=Math.max(.002,1-e*e*.996),m=Math.max(5800,5800+(a.initialTempK-5800)*p),h=10**(-3.6+(a.initialLog10Rho- -3.6)*p**.72);C=Math.log10(m),w=Math.log10(h),T=0,E=e<.92?1:.45;let g=.22*Math.exp(-e*e*8);D=.72-g,O=.26+g,k=.02}else if(a.geometry===`twin-lobe`){let t=e&1?1:-1,a=4.5;S=t*a;let o=e%10==0;if(o){let e=(d()*2-1)*a;r=e,i=f()*.65,v=f()*.85+Math.sin(e*.55)*.75,S=e}else{let e=.18+d()**1.15*2.55,n=2*d()-1,o=Math.sqrt(Math.max(0,1-n*n)),s=d()*Math.PI*2;r=t*a+e*o*Math.cos(s),i=e*n*.62,v=e*o*Math.sin(s)}let s=Math.sqrt(n*p/(4*a))*1.04,c=r-t*a,l=v,u=Math.hypot(c,l)+.35,m=Math.sqrt(n*p*.22/(u+.6))*.42;y=(o?-v/(Math.hypot(r,v)+.5)*s*.7:-l/u*m)+f()*.1,b=f()*.08,x=(o?r/(Math.hypot(r,v)+.5)*s*.7:t*s+c/u*m)+f()*.1}else{let t=e>o*.72,s=d(),c=t?3.3+s**.8*(a.cloudRadius-3.3):.18+s**1.28*5,l=2*d()-1,u=Math.sqrt(Math.max(0,1-l*l)),m=d()*Math.PI*2,h=c*u*Math.cos(m),g=c*l*(t?.56:.78),S=c*u*Math.sin(m),C=0,w=0,T=0;for(let e of _){let t=Math.sin(e.kx*h+e.ky*g+e.kz*S+e.phase)*e.amp;C+=e.kx*t,w+=e.ky*t,T+=e.kz*t}r=h+C*.92,i=g+w*.62,v=S+T*.92;let E=Math.hypot(r,v)+.35,D=t?1.05:.3+.55*Math.min(1,E/6),O=Math.sqrt(n*p*.38/(E+1.1))*a.angularMomentum*D,k=t?-.06:-.18,A=Math.hypot(r,i,v)+.4;y=-v/E*O+r/A*k+f()*.14,b=i/A*k*.8+f()*.1,x=r/E*O+v/A*k+f()*.14}let A=Math.hypot(r-S,i,v),j=Math.exp(-A*A/12),M=w??g+j*1,N=C??h+j*.1,P=.32+.04*Math.min(6,A);s[t+0]=r+c,s[t+1]=i+l,s[t+2]=v+u,s[t+3]=m,s[t+4]=y,s[t+5]=b,s[t+6]=x,s[t+7]=P,s[t+8]=N,s[t+9]=M,s[t+10]=D,s[t+11]=C!=null&&C>6.8?-1.5:-30,s[t+12]=T??.998,s[t+13]=E??0,s[t+14]=O,s[t+15]=k}return s}var Xn=`ulg.astrophysics.galactic-cic-pm-webgpu.v1`,Zn=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Qn=`
struct Body {
  pos_mass: vec4<f32>,   // x, y, z, mass
  vel_pop: vec4<f32>,    // vx, vy, vz, popTag (-1 = dark matter halo, >=0 = visible star/HII)
};

struct PmParams {
  count: u32,
  grid_n: u32,
  smbh_idx_b: u32,       // Optional 2nd SMBH index for binary galaxy mergers (0 = single galaxy)
  step_index: u32,
  box_size: f32,
  dx: f32,
  dt: f32,
  gravity_g: f32,
  softening2: f32,
  smbh_soft2: f32,
  mean_rho: f32,
  inv_dv: f32,
};

@group(0) @binding(0) var<uniform> params: PmParams;
@group(0) @binding(1) var<storage, read_write> bodies: array<Body>;
@group(0) @binding(2) var<storage, read_write> rho_accum: array<atomic<i32>>;
@group(0) @binding(3) var<storage, read_write> fft_grid: array<vec2<f32>>;
// Stored gravitational potential Phi(x, y, z) copied from FFT output for trilinear -grad(Phi)!
@group(0) @binding(4) var<storage, read_write> phi_grid: array<f32>;

const Q_RHO: f32 = 16384.0;

fn wrap_cell(c: i32, n: i32) -> u32 {
  return u32(((c % n) + n) % n);
}

fn cidx(x: i32, y: i32, z: i32, n: i32) -> u32 {
  let wx = wrap_cell(x, n);
  let wy = wrap_cell(y, n);
  let wz = wrap_cell(z, n);
  return (wz * u32(n) + wy) * u32(n) + wx;
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

// 2. Clear quantized density accumulator
@compute @workgroup_size(64)
fn pm_clear_rho(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = params.grid_n * params.grid_n * params.grid_n;
  let i = gid.x;
  if (i >= total) { return; }
  atomicStore(&rho_accum[i], 0);
}

// 3. Smooth Trilinear Cloud-in-Cell (CIC) Mass Deposition (skips point-mass SMBH anchors
//    whose exact softened 1/r^2 gravity is evaluated directly without mesh blurring!)
@compute @workgroup_size(64)
fn pm_deposit_cic(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  if (i == 0u || (params.smbh_idx_b > 0u && i == params.smbh_idx_b)) { return; }
  let pm = bodies[i].pos_mass;
  if (!(pm.w > 0.0)) { return; }

  let half = params.box_size * 0.5;
  let n = i32(params.grid_n);
  let g = ((pm.xyz + vec3<f32>(half)) / params.dx) - vec3<f32>(0.5);
  // Ignore rare escaped outliers far outside the oversized box
  if (abs(pm.x) > half * 0.94 || abs(pm.y) > half * 0.94 || abs(pm.z) > half * 0.94) { return; }
  let i0 = vec3<i32>(floor(g));
  let f = fract(g);
  let w0 = vec3<f32>(1.0) - f;
  let m_q = pm.w * Q_RHO;

  atomicAdd(&rho_accum[cidx(i0.x,     i0.y,     i0.z,     n)], i32(round(m_q * w0.x * w0.y * w0.z)));
  atomicAdd(&rho_accum[cidx(i0.x + 1, i0.y,     i0.z,     n)], i32(round(m_q * f.x  * w0.y * w0.z)));
  atomicAdd(&rho_accum[cidx(i0.x,     i0.y + 1, i0.z,     n)], i32(round(m_q * w0.x * f.y  * w0.z)));
  atomicAdd(&rho_accum[cidx(i0.x + 1, i0.y + 1, i0.z,     n)], i32(round(m_q * f.x  * f.y  * w0.z)));
  atomicAdd(&rho_accum[cidx(i0.x,     i0.y,     i0.z + 1, n)], i32(round(m_q * w0.x * w0.y * f.z)));
  atomicAdd(&rho_accum[cidx(i0.x + 1, i0.y,     i0.z + 1, n)], i32(round(m_q * f.x  * w0.y * f.z)));
  atomicAdd(&rho_accum[cidx(i0.x,     i0.y + 1, i0.z + 1, n)], i32(round(m_q * w0.x * f.y  * f.z)));
  atomicAdd(&rho_accum[cidx(i0.x + 1, i0.y + 1, i0.z + 1, n)], i32(round(m_q * f.x  * f.y  * f.z)));
}

// 4. Pack 4*pi*G*(rho - rho_bar) into Gate 0B 3D-FFT complex buffer
@compute @workgroup_size(64)
fn pm_pack_fft_rhs(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = params.grid_n * params.grid_n * params.grid_n;
  let i = gid.x;
  if (i >= total) { return; }
  let mass_cell = f32(atomicLoad(&rho_accum[i])) / Q_RHO;
  let rho = mass_cell * params.inv_dv;
  let rhs = 12.566370614359172 * params.gravity_g * (rho - params.mean_rho);
  fft_grid[i] = vec2<f32>(rhs, 0.0);
}

// 5. Copy solved real gravitational potential Phi(x) into phi_grid
@compute @workgroup_size(64)
fn pm_store_phi(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = params.grid_n * params.grid_n * params.grid_n;
  let i = gid.x;
  if (i >= total) { return; }
  phi_grid[i] = fft_grid[i].x;
}

fn sample_neg_grad_phi(ix: i32, iy: i32, iz: i32, n: i32, inv2dx: f32) -> vec3<f32> {
  let gx = (phi_grid[cidx(ix + 1, iy, iz, n)] - phi_grid[cidx(ix - 1, iy, iz, n)]) * inv2dx;
  let gy = (phi_grid[cidx(ix, iy + 1, iz, n)] - phi_grid[cidx(ix, iy - 1, iz, n)]) * inv2dx;
  let gz = (phi_grid[cidx(ix, iy, iz + 1, n)] - phi_grid[cidx(ix, iy, iz - 1, n)]) * inv2dx;
  return vec3<f32>(-gx, -gy, -gz);
}

// 6. Symplectic Full-Step Kick + Second Half-Step Drift (exact Velocity-Verlet DKD!)
@compute @workgroup_size(64)
fn pm_kick_and_drift(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  var b = bodies[i];
  if (!(b.pos_mass.w > 0.0)) { return; }

  let pos = b.pos_mass.xyz;
  let half = params.box_size * 0.5;
  let n = i32(params.grid_n);
  let inv2dx = 0.5 / params.dx;

  var acc = vec3<f32>(0.0);

  // Smooth trilinear CIC interpolation of mesh gravity -grad(Phi)
  if (abs(pos.x) < half * 0.90 && abs(pos.y) < half * 0.90 && abs(pos.z) < half * 0.90) {
    let g = ((pos + vec3<f32>(half)) / params.dx) - vec3<f32>(0.5);
    let i0 = vec3<i32>(floor(g));
    let f = fract(g);
    let a000 = sample_neg_grad_phi(i0.x,     i0.y,     i0.z,     n, inv2dx);
    let a100 = sample_neg_grad_phi(i0.x + 1, i0.y,     i0.z,     n, inv2dx);
    let a010 = sample_neg_grad_phi(i0.x,     i0.y + 1, i0.z,     n, inv2dx);
    let a110 = sample_neg_grad_phi(i0.x + 1, i0.y + 1, i0.z,     n, inv2dx);
    let a001 = sample_neg_grad_phi(i0.x,     i0.y,     i0.z + 1, n, inv2dx);
    let a101 = sample_neg_grad_phi(i0.x + 1, i0.y,     i0.z + 1, n, inv2dx);
    let a011 = sample_neg_grad_phi(i0.x,     i0.y + 1, i0.z + 1, n, inv2dx);
    let a111 = sample_neg_grad_phi(i0.x + 1, i0.y + 1, i0.z + 1, n, inv2dx);
    acc = mix(
      mix(mix(a000, a100, f.x), mix(a010, a110, f.x), f.y),
      mix(mix(a001, a101, f.x), mix(a011, a111, f.x), f.y),
      f.z
    );
  } else {
    // Smooth distant monopole fallback outside box edge
    let r2 = dot(pos, pos) + params.softening2;
    let inv_r3 = 1.0 / (r2 * sqrt(r2));
    acc = -pos * (params.gravity_g * params.mean_rho * (params.box_size * params.box_size * params.box_size) * inv_r3);
  }

  // Exact direct softened gravity from central SMBH anchor(s) (eliminates inner mesh blurring!)
  if (i != 0u) {
    let bh0 = bodies[0u].pos_mass;
    if (bh0.w > 0.0) {
      let d0 = bh0.xyz - pos;
      let r2 = dot(d0, d0) + params.smbh_soft2;
      acc = acc + d0 * (params.gravity_g * bh0.w / (r2 * sqrt(r2)));
    }
  }
  if (params.smbh_idx_b > 0u && i != params.smbh_idx_b) {
    let bh1 = bodies[params.smbh_idx_b].pos_mass;
    if (bh1.w > 0.0) {
      let d1 = bh1.xyz - pos;
      let r2 = dot(d1, d1) + params.smbh_soft2;
      acc = acc + d1 * (params.gravity_g * bh1.w / (r2 * sqrt(r2)));
    }
  }

  let vel_next = b.vel_pop.xyz + acc * params.dt;
  let pos_next = pos + vel_next * (0.5 * params.dt);
  bodies[i] = Body(vec4<f32>(pos_next, b.pos_mass.w), vec4<f32>(vel_next, b.vel_pop.w));
}

// 7. Exact Initial Circular/Virial Equilibrium Calibration in the ACTUAL GPU CIC-PM + SMBH Potential!
//    Measures the exact live GPU centripetal acceleration at every particle's position on step 0
//    and rescales azimuthal/virial speed so rotating disks match the finite-grid + SMBH potential
//    with 100% precision (zero spurious radial expansion or collapse!).
@compute @workgroup_size(64)
fn pm_calibrate_equilibrium(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count || i == 0u || (params.smbh_idx_b > 0u && i == params.smbh_idx_b)) { return; }
  var b = bodies[i];
  if (!(b.pos_mass.w > 0.0)) { return; }

  let bh0 = bodies[0u].pos_mass;
  let pos = b.pos_mass.xyz;
  let rel = pos - bh0.xyz;
  let half = params.box_size * 0.5;
  let n = i32(params.grid_n);
  let inv2dx = 0.5 / params.dx;

  var acc = vec3<f32>(0.0);
  if (abs(pos.x) < half * 0.90 && abs(pos.y) < half * 0.90 && abs(pos.z) < half * 0.90) {
    let g = ((pos + vec3<f32>(half)) / params.dx) - vec3<f32>(0.5);
    let i0 = vec3<i32>(floor(g));
    let f = fract(g);
    let a000 = sample_neg_grad_phi(i0.x,     i0.y,     i0.z,     n, inv2dx);
    let a100 = sample_neg_grad_phi(i0.x + 1, i0.y,     i0.z,     n, inv2dx);
    let a010 = sample_neg_grad_phi(i0.x,     i0.y + 1, i0.z,     n, inv2dx);
    let a110 = sample_neg_grad_phi(i0.x + 1, i0.y + 1, i0.z,     n, inv2dx);
    let a001 = sample_neg_grad_phi(i0.x,     i0.y,     i0.z + 1, n, inv2dx);
    let a101 = sample_neg_grad_phi(i0.x + 1, i0.y,     i0.z + 1, n, inv2dx);
    let a011 = sample_neg_grad_phi(i0.x,     i0.y + 1, i0.z + 1, n, inv2dx);
    let a111 = sample_neg_grad_phi(i0.x + 1, i0.y + 1, i0.z + 1, n, inv2dx);
    acc = mix(
      mix(mix(a000, a100, f.x), mix(a010, a110, f.x), f.y),
      mix(mix(a001, a101, f.x), mix(a011, a111, f.x), f.y),
      f.z
    );
  }
  if (bh0.w > 0.0) {
    let d0 = bh0.xyz - pos;
    let r2 = dot(d0, d0) + params.smbh_soft2;
    acc = acc + d0 * (params.gravity_g * bh0.w / (r2 * sqrt(r2)));
  }

  let r_xz = length(rel.xz);
  let r_3d = length(rel);
  if (r_3d < 0.15) { return; }
  let a_in_3d = max(0.0, -dot(acc, rel / r_3d));
  let v_circ_exact = sqrt(r_3d * a_in_3d);

  let v = b.vel_pop.xyz;
  let pop = b.vel_pop.w;
  if (pop < -0.5) {
    // Dark-matter halo: rescale isotropic velocity to actual GPU virial speed
    let v_mag = length(v);
    if (v_mag > 1e-4) {
      let target_scale = clamp((v_circ_exact * 0.58) / max(0.4, v_mag * 0.72), 0.45, 1.15);
      b.vel_pop = vec4<f32>(v * target_scale, pop);
    }
  } else if (r_xz > 0.25) {
    // Visible disk & bulge stars: decompose into azimuthal + radial + vertical relative to disk plane
    let r_hat = vec2<f32>(rel.x / r_xz, rel.z / r_xz);
    let t_hat = vec2<f32>(-r_hat.y, r_hat.x);
    let a_in_xz = max(0.0, -(acc.x * r_hat.x + acc.z * r_hat.y));
    let vc_disk = sqrt(r_xz * a_in_xz);
    let v_tan = v.x * t_hat.x + v.z * t_hat.y;
    let v_rad = v.x * r_hat.x + v.z * r_hat.y;
    let abs_vt = abs(v_tan);
    if (abs_vt > 0.2) {
      let sgn_t = select(-1.0, 1.0, v_tan >= 0.0);
      // Preserve fractional spin (bulge slower than disk) while locking disk stars strictly to vc_disk!
      let is_bulge = pop < 0.28 && r_xz < 2.2;
      let goal_vt = select(vc_disk * 0.985, min(abs_vt, vc_disk * 0.68), is_bulge);
      let ratio = clamp(goal_vt / abs_vt, 0.35, 1.15);
      let new_vt = sgn_t * goal_vt;
      let new_vr = v_rad * min(1.0, ratio);
      let new_vy = v.y * min(1.0, ratio);
      b.vel_pop = vec4<f32>(
        r_hat.x * new_vr + t_hat.x * new_vt,
        new_vy,
        r_hat.y * new_vr + t_hat.y * new_vt,
        pop
      );
    }
  }
  bodies[i] = b;
}
`;function $n({device:e=null,initialBodies:t,gridN:n=32,boxSize:r=48,secondSmbhIndex:i=0,smbhSoftening:a=.72,label:o=`ulg-galactic-cic-pm`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createGalacticParticleMeshEngineWebGpu requires a live WebGPU GPUDevice`);let s=Float32Array.from(t),c=Math.floor(s.length/8),l=Math.max(16,Math.min(64,Math.trunc(n))),u=l*l*l,d=r/l,f=1/(d*d*d),p=0;for(let e=0;e<c;e+=1)e===0||i>0&&e===i||(p+=Math.max(0,s[e*8+3]));let m=p/(r*r*r),h=N(e,l);h.writeAxisPoissonParams({boxLength:r,smoothR2:(.55*d)**2});let g=Math.max(32,s.byteLength),_=e.createBuffer({label:`${o}-bodies`,size:g,usage:Zn.STORAGE|Zn.VERTEX|Zn.COPY_DST|Zn.COPY_SRC}),v=e.createBuffer({label:`${o}-rho`,size:u*4,usage:Zn.STORAGE}),y=e.createBuffer({label:`${o}-phi`,size:u*4,usage:Zn.STORAGE}),b=e.createBuffer({label:`${o}-params`,size:48,usage:Zn.UNIFORM|Zn.COPY_DST}),x=e.createBuffer({label:`${o}-staging`,size:g,usage:Zn.MAP_READ|Zn.COPY_DST});e.queue.writeBuffer(_,0,s);let S=[C(0,`uniform`),C(1,`storage`),C(2,`storage`),C(3,`storage`),C(4,`storage`)],E=t=>T(e,{cacheKey:`ulg-galactic-pm-${t}.v1`,label:`${o}-${t}`,code:Qn,entryPoint:t,bindings:S}),D=E(`pm_drift_half`),O=E(`pm_clear_rho`),k=E(`pm_deposit_cic`),A=E(`pm_pack_fft_rhs`),j=E(`pm_store_phi`),M=E(`pm_kick_and_drift`),P=E(`pm_calibrate_equilibrium`),F=(t,n)=>w(e,{layout:M.bindGroupLayout,label:`${o}-bg-${n}`,entries:[{binding:0,resource:{buffer:b}},{binding:1,resource:{buffer:_}},{binding:2,resource:{buffer:v}},{binding:3,resource:{buffer:t}},{binding:4,resource:{buffer:y}}]}),I=F(h.bufferA,`a`),L=F(h.bufferB,`b`),R=0,z=!1,ee=!1,B=Math.ceil(c/64),V=Math.ceil(u/64);async function te(){if(ee||z||x.mapState!==`unmapped`)return s;z=!0;try{let t=e.createCommandEncoder({label:`${o}-readback`});t.copyBufferToBuffer(_,0,x,0,g),e.queue.submit([t.finish()]),await x.mapAsync(Zn.MAP_READ),ee||s.set(new Float32Array(x.getMappedRange(0,g)));try{x.unmap()}catch{}}catch(e){if(!ee&&e?.name!==`AbortError`)throw e}finally{z=!1}return s}async function ne({gravity:t=1,softening:n=.35}={}){if(ee||i>0)return;let s=new ArrayBuffer(48);new Uint32Array(s,0,4).set([c,l,i,R]),new Float32Array(s,16,8).set([r,d,.004,t,n*n,a*a,m,f]),e.queue.writeBuffer(b,0,s);let u=e.createCommandEncoder({label:`${o}-cal-eq`}),p=u.beginComputePass({label:`${o}-cal-dep`});p.setBindGroup(0,I),p.setPipeline(O.pipeline),p.dispatchWorkgroups(V),p.setPipeline(k.pipeline),p.dispatchWorkgroups(B),p.setPipeline(A.pipeline),p.dispatchWorkgroups(V),p.end();let g=h.encodePoissonSolve(u,{gradAxis:0})===h.bufferA?I:L;p=u.beginComputePass({label:`${o}-cal-apply`}),p.setBindGroup(0,g),p.setPipeline(j.pipeline),p.dispatchWorkgroups(V),p.setPipeline(P.pipeline),p.dispatchWorkgroups(B),p.end(),e.queue.submit([u.finish()])}async function re({dt:t=.008,substeps:n=2,gravity:u=1,softening:p=.35,readback:v=!1}={}){if(ee)return s;let y=Math.max(1,Math.min(8,Math.trunc(n))),S=Math.max(5e-4,Math.min(.012,(Number(t)||.008)/y)),C=new ArrayBuffer(48);new Uint32Array(C,0,4).set([c,l,i,R]),new Float32Array(C,16,8).set([r,d,S,u,p*p,a*a,m,f]),e.queue.writeBuffer(b,0,C);let w=e.createCommandEncoder({label:`${o}-step-${R}`});for(let e=0;e<y;e+=1){let t=w.beginComputePass({label:`${o}-dep-${e}`});t.setBindGroup(0,I),t.setPipeline(D.pipeline),t.dispatchWorkgroups(B),t.setPipeline(O.pipeline),t.dispatchWorkgroups(V),t.setPipeline(k.pipeline),t.dispatchWorkgroups(B),t.setPipeline(A.pipeline),t.dispatchWorkgroups(V),t.end();let n=h.encodePoissonSolve(w,{gradAxis:0})===h.bufferA?I:L;t=w.beginComputePass({label:`${o}-kick-${e}`}),t.setBindGroup(0,n),t.setPipeline(j.pipeline),t.dispatchWorkgroups(V),t.setPipeline(M.pipeline),t.dispatchWorkgroups(B),t.end(),R+=1}let T=v&&!z&&x.mapState===`unmapped`;if(T&&(z=!0,w.copyBufferToBuffer(_,0,x,0,g)),e.queue.submit([w.finish()]),T)try{await x.mapAsync(Zn.MAP_READ),ee||s.set(new Float32Array(x.getMappedRange(0,g)));try{x.unmap()}catch{}}catch(e){if(!ee&&e?.name!==`AbortError`)throw e}finally{z=!1}return s}function ie(){if(!ee){ee=!0,h.destroy();for(let e of[_,v,y,b,x])try{e.destroy()}catch{}}}return Object.freeze({schema:Xn,get count(){return c},get activeCount(){return c},get stepIndex(){return R},get gridN(){return l},get boxSize(){return r},get backend(){return`webgpu`},get gravityMode(){return`webgpu-cic-3dfft-pm+smbh`},getBodies:()=>s,getResidentBuffer:()=>_,calibrateEquilibrium:ne,readbackBodies:te,step:re,dispose:ie})}function er(e,t){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`${t} requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`)}Object.freeze([Object.freeze({name:`G-Type Star`,isStar:!0,a:0,mass:120,radius:1.38,color:16773306,phase:0,tilt:0}),Object.freeze({name:`Inner Rocky`,a:3.1,mass:.01,radius:.28,color:13933162,phase:.4,tilt:.05}),Object.freeze({name:`Ocean World (H₂O/Fe)`,a:4.9,mass:.02,radius:.42,color:3718648,phase:1.9,tilt:.03}),Object.freeze({name:`Ringed Giant`,a:7.7,mass:.16,radius:.78,color:15122058,phase:3.6,tilt:.08,ringed:!0}),Object.freeze({name:`Ice Giant`,a:10.4,mass:.055,radius:.52,color:8246268,phase:5.1,tilt:.04})]);var tr=`
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
`;function nr({device:e=null,initialBodies:t,mode:n=0,label:r=`ulg-cosmic-nbody`}){er(e,`createResidentTiledNBodyEngine`);let i=Float32Array.from(t),a=i.length/8,o=0,s=n===1?.25:1,c=!1,l=Math.max(32,i.byteLength),u=[e.createBuffer({label:`${r}-buf-0`,size:l,usage:172}),e.createBuffer({label:`${r}-buf-1`,size:l,usage:172})],d=e.createBuffer({label:`${r}-params`,size:48,usage:72}),f=e.createBuffer({label:`${r}-staging`,size:l,usage:9});e.queue.writeBuffer(u[0],0,i),e.queue.writeBuffer(u[1],0,i);let p=T(e,{cacheKey:`ulg-cosmic-nbody-tiled.v1`,label:`ulg-cosmic-nbody-tiled`,code:tr,entryPoint:`step_nbody`,bindings:[C(0,`read-only-storage`),C(1,`storage`),C(2,`uniform`)]}),m=[w(e,{layout:p.bindGroupLayout,label:`${r}-bg-0`,entries:[{binding:0,resource:{buffer:u[0]}},{binding:1,resource:{buffer:u[1]}},{binding:2,resource:{buffer:d}}]}),w(e,{layout:p.bindGroupLayout,label:`${r}-bg-1`,entries:[{binding:0,resource:{buffer:u[1]}},{binding:1,resource:{buffer:u[0]}},{binding:2,resource:{buffer:d}}]})],h=0,g=!1;async function _(){if(!u||!f||g||c)return i;g=!0;try{let t=e.createCommandEncoder({label:`${r}-readback`});t.copyBufferToBuffer(u[h],0,f,0,i.byteLength),e.queue.submit([t.finish()]),await f.mapAsync(1),i.set(new Float32Array(f.getMappedRange())),f.unmap()}finally{g=!1}return i}async function v({dt:t=.014,gravity:l=1,softening:_=.22,hubbleRate:v=.12,readback:y=!1}={}){if(c||!u)return i;let b=new ArrayBuffer(48),x=new Uint32Array(b),S=new Float32Array(b),C=n===1?1/Math.max(.05,s**3):1;x[0]=a,x[1]=n,S[4]=t,S[5]=l,S[6]=_*_,S[7]=n===1?2*v:0,S[8]=C,e.queue.writeBuffer(d,0,b);let w=h,T=1-h,E=e.createCommandEncoder({label:`${r}-step-${o}`}),D=E.beginComputePass({label:`${r}-pass`});D.setPipeline(p.pipeline),D.setBindGroup(0,m[w]),D.dispatchWorkgroups(Math.ceil(a/64)),D.end();let O=y&&!g;if(O&&E.copyBufferToBuffer(u[T],0,f,0,i.byteLength),e.queue.submit([E.finish()]),h=T,o+=1,n===1&&(s=Math.min(2,s+t*v*s)),O){g=!0;try{await f.mapAsync(1),i.set(new Float32Array(f.getMappedRange())),f.unmap()}finally{g=!1}}return i}function y(t){i=Float32Array.from(t),o=0,s=n===1?.25:1,h=0,u&&(e.queue.writeBuffer(u[0],0,i),e.queue.writeBuffer(u[1],0,i))}function b(){return u?u[h]:null}function x(){c||(c=!0,u?.[0]?.destroy(),u?.[1]?.destroy(),d?.destroy(),f?.destroy(),u=null)}return{get count(){return a},get activeCount(){return a},get stepIndex(){return o},get scaleFactorA(){return s},get backend(){return`webgpu`},get gravityMode(){return`webgpu-tiled-direct`},getBodies:()=>i,readbackBodies:_,getResidentBuffer:b,step:v,resetBodies:y,dispose:x}}function rr(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var ir=[`disk`,`barred`,`ring`,`lenticular`,`irregular`,`open-cluster`,`binary`,`sphere`,`proto`,`dwarf-stream`,`globular`],ar=[`NGC`,`M`,`IC`,`UGC`,`ARP`,`PGC`],or=Object.freeze({H2O:Object.freeze({formula:`H₂O`,name:`Water (C₂v Bent)`,atoms:[{Z:8,symbol:`O`,position:[0,0,.22]},{Z:1,symbol:`H`,position:[0,1.43,-.88]},{Z:1,symbol:`H`,position:[0,-1.43,-.88]}]}),CO2:Object.freeze({formula:`CO₂`,name:`Carbon Dioxide (Linear O=C=O)`,atoms:[{Z:6,symbol:`C`,position:[0,0,0]},{Z:8,symbol:`O`,position:[0,0,2.19]},{Z:8,symbol:`O`,position:[0,0,-2.19]}]}),CH4:Object.freeze({formula:`CH₄`,name:`Methane (Tetrahedral T_d)`,atoms:[{Z:6,symbol:`C`,position:[0,0,0]},{Z:1,symbol:`H`,position:[1.19,1.19,1.19]},{Z:1,symbol:`H`,position:[1.19,-1.19,-1.19]},{Z:1,symbol:`H`,position:[-1.19,1.19,-1.19]},{Z:1,symbol:`H`,position:[-1.19,-1.19,1.19]}]}),NH3:Object.freeze({formula:`NH₃`,name:`Ammonia (Trigonal Pyramidal C₃v)`,atoms:[{Z:7,symbol:`N`,position:[0,.42,0]},{Z:1,symbol:`H`,position:[1.77,-.32,0]},{Z:1,symbol:`H`,position:[-.885,-.32,1.53]},{Z:1,symbol:`H`,position:[-.885,-.32,-1.53]}]}),SiO2:Object.freeze({formula:`SiO₂`,name:`Silica Unit (O=Si=O)`,atoms:[{Z:14,symbol:`Si`,position:[0,0,0]},{Z:8,symbol:`O`,position:[0,0,2.85]},{Z:8,symbol:`O`,position:[0,0,-2.85]}]}),O2:Object.freeze({formula:`O₂`,name:`Dioxygen (O=O)`,atoms:[{Z:8,symbol:`O`,position:[0,0,-1.14]},{Z:8,symbol:`O`,position:[0,0,1.14]}]}),N2:Object.freeze({formula:`N₂`,name:`Dinitrogen (N≡N)`,atoms:[{Z:7,symbol:`N`,position:[0,0,-1.04]},{Z:7,symbol:`N`,position:[0,0,1.04]}]}),CO:Object.freeze({formula:`CO`,name:`Carbon Monoxide (Triple Bond)`,atoms:[{Z:6,symbol:`C`,position:[0,0,-1.07]},{Z:8,symbol:`O`,position:[0,0,1.07]}]}),H2:Object.freeze({formula:`H₂`,name:`Molecular Hydrogen (H–H)`,atoms:[{Z:1,symbol:`H`,position:[0,0,-.7]},{Z:1,symbol:`H`,position:[0,0,.7]}]})});function sr(e,{surfaceActive:t=!1,userTimeScale:n=1}={}){let r=Number.isFinite(Number(e))?Number(e):24.8,i=Math.max(.1,Math.min(3,Number(n)||1));if(t){let e=1*i;return Object.freeze({factor:1,effectiveTimeScale:i,secondsPerWallSecond:e,clockLabel:`${e.toFixed(1)} s/s`})}let a,o;if(r>=22){let e=Math.max(0,Math.min(1,(r-22)/3.4));a=10**(14.75+e*.95)*i,o=.55+.45*e}else if(r>=16.2){let e=Math.max(0,Math.min(1,(r-16.2)/5.8));a=10**(13.05+e*1.55)*i,o=.28+.72*e**.85}else if(r>=8.75){let e=Math.max(0,Math.min(1,(r-8.75)/7.45));a=10**(3.85+e*2.75)*i,o=.14+.86*e**1.35}else if(r>=0){let e=Math.max(0,Math.min(1,r/8.75));a=10**(.2+e*3)*i,o=.22+.58*e}else if(r>=-9.1){let e=Math.max(0,Math.min(1,(r+9.1)/9.1));a=10**(-14.1+e*1.2)*i,o=.45+.25*e}else if(r>=-12.8){let e=Math.max(0,Math.min(1,(r+12.8)/3.7));a=10**(-17.2+e*1.2)*i,o=.35+.15*e}else a=15e-21*i,o=.42;let s,c=a;return s=c>=315576e8?`${(c/315576e8).toFixed(c>=315576e9?0:1)} Myr/s`:c>=315576e5?`${(c/315576e5).toFixed(1)} kyr/s`:c>=31557600?`${(c/31557600).toFixed(2)} yr/s`:c>=86400?`${(c/86400).toFixed(c>=864e3?0:1)} d/s`:c>=3600?`${(c/3600).toFixed(1)} hr/s`:c>=60?`${(c/60).toFixed(1)} min/s`:c>=.05?`${c.toFixed(1)} s/s`:c>=1e-12?`${(c*0xe8d4a51000).toFixed(1)} ps/s`:c>=1e-15?`${(c*0x38d7ea4c68000).toFixed(1)} fs/s`:c>=1e-18?`${(c*0xde0b6b3a7640000).toFixed(1)} as/s`:`${(c*1e21).toFixed(1)} zs/s`,Object.freeze({factor:o,effectiveTimeScale:o*i,secondsPerWallSecond:a,clockLabel:s})}function cr({count:e=32768,preset:t=`disk`,seed:n=825,gravity:r=1,softening:i=.28,centerOffset:a=[0,0,0]}={}){let o=Math.max(256,Math.min(262144,Math.floor(e))),s=new Float32Array(o*8),c=rr(n),l=()=>{let e=Math.max(1e-7,c()),t=c();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},u=Number(a?.[0])||0,d=Number(a?.[1])||0,f=Number(a?.[2])||0,p=(e,t,n,i,a,o,p,m,h,g,_=1)=>{let v=t-e,y=44*_,b=135*_,x=290*_,S=780*_,C=1.25*_,w=3.2*_,T=7.4*_,E=1.05*_,D=.72*_,O=e=>{let t=Math.max(.15*_,e),n=r*y*t/(t*t+D*D)**1.5,i=Math.hypot(t,E),a=t*t*b/((t+C)*(t+C)),o=t/w,s=x*(1-(1+o)*Math.exp(-o)),c=t*t*S/((t+T)*(t+T));return n+r*(a+s+c)*t/(i*i*i)},k=e=>Math.sqrt(Math.max(0,e*O(e))),A=Math.cos(h),j=Math.sin(h),M=Math.cos(g),N=Math.sin(g),P=(e,t,n)=>{let r=t*A-n*j,i=t*j+n*A;return[e*M-r*N,e*N+r*M,i]};s.set([n+u,i+d,a+f,y,o,p,m,.05],e*8);let F=Math.floor((v-1)*.36),I=Math.floor((v-1)*.14),L=Math.floor((v-1)*.04),R=v-1-F-I-L,z=S/Math.max(1,F),ee=b/Math.max(1,I+L),B=x/Math.max(1,R),V=e+1;for(let e=0;e<F&&V<t;e+=1,V+=1){let e=Math.max(.01,Math.min(.88,c())),t=Math.min(18.5*_,T*Math.sqrt(e)/Math.max(.08,1-Math.sqrt(e))),r=2*c()-1,h=Math.sqrt(Math.max(0,1-r*r)),g=2*Math.PI*c(),v=t*h*Math.cos(g),y=t*r,b=t*h*Math.sin(g),x=k(t)*.56,S=P(v,y,b),C=P(l()*x,l()*x,l()*x);s.set([n+S[0]+u,i+S[1]+d,a+S[2]+f,z,o+C[0],p+C[1],m+C[2],-1],V*8)}for(let e=0;e<I+L&&V<t;e+=1,V+=1){let t=e>=I,r=Math.max(.005,Math.min(.92,c())),h=t?C*4:C,g=Math.min(11.5*_,h*Math.sqrt(r)/Math.max(.07,1-Math.sqrt(r))),v=2*c()-1,y=Math.sqrt(Math.max(0,1-v*v)),b=2*Math.PI*c(),x=g*y*Math.cos(b),S=g*v*(t?.85:.62),w=g*y*Math.sin(b),T=k(g),E=T*(t?.5:.36),D=t?.18:.62,O=-Math.sin(b)*T*D+l()*E,A=l()*E*.68,j=Math.cos(b)*T*D+l()*E,M=P(x,S,w),N=P(O,A,j),F=t?.24+c()*.1:.02+Math.min(.28,g/(2.6*_)*.24);s.set([n+M[0]+u,i+M[1]+d,a+M[2]+f,ee,o+N[0],p+N[1],m+N[2],F],V*8)}let te=Math.tan(17*Math.PI/180);for(;V<t;V+=1){let e=-w*Math.log(Math.max(1e-4,c()*c())),t=Math.max(.32*_,Math.min(11.5*_,e*.78)),r=Math.min(1,Math.max(0,(t-.75*_)/(2*_))),h=c()<.72*r,g,v;if(h){let e=V&3,n=(e&1)==0,r=e*Math.PI*.5+(n?0:.22),i=Math.log(1+t/(.65*_))/te,a=(n?.26:.36)+t/_*.022;g=r+i+l()*a,v=c()<.11&&t>1.4*_&&t<8.5*_?.82+c()*.22:.38+c()*.38}else g=c()*Math.PI*2,v=.08+c()*.26;let y=(.14+t/_*.028)*_,b=t*Math.cos(g),x=t*Math.sin(g),S=l()*y,C=k(t),T=C*.985,E=C*(.08+.05*Math.exp(-t/w)),D=C*.045,O=l()*E,A=T+l()*(E*.72),j=Math.cos(g)*O-Math.sin(g)*A,M=l()*D,N=Math.sin(g)*O+Math.cos(g)*A,F=P(b,S,x),I=P(j,M,N);s.set([n+F[0]+u,i+F[1]+d,a+F[2]+f,B,o+I[0],p+I[1],m+I[2],v],V*8)}};if(t===`binary`){let e=o>>1;p(0,e,-5.8,.9,-1.5,1.35,-.22,1.05,.35,.18,.68),p(e,o,5.8,-.9,1.5,-1.35,.22,-1.05,-.42,-.25,.68)}else if(t===`barred`){p(0,o,0,0,0,0,0,0,0,0,1);let e=Math.floor(o*.42);for(let t=Math.floor(o*.22);t<e;t+=1){let e=t*8;if(s[e+7]<0)continue;let n=(c()*2-1)*3.6,r=l()*.24,i=l()*(.48*Math.sqrt(Math.max(.15,1-(n/3.9)**2))),a=Math.hypot(n,i),o=2.65;s.set([n+u,r+d,i+f,s[e+3]*1.15,-i*o+l()*.45,l()*.25,n*o+l()*.45,.06+Math.min(.24,a/3.8*.22)],e)}let t=Math.tan(19*Math.PI/180);for(let n=e;n<o;n+=1){let e=n*8;if(!(s[e+7]<0)&&c()<.78){let a=n&1,o=3.1+c()**.85*7.8,p=a*Math.PI+Math.log(o/3)/t+l()*(.2+.02*o),m=l()*(.12+.025*o),h=Math.sqrt(r*(170+260*(1-(1+o/3.1)*Math.exp(-o/3.1))+950*o*o/(o+6.8)**2)/Math.hypot(o,i)),g=c()<.14;s.set([Math.cos(p)*o+u,m+d,Math.sin(p)*o+f,s[e+3],-Math.sin(p)*h+l()*.45,l()*.2,Math.cos(p)*h+l()*.45,g?.85+c()*.2:.44+c()*.34],e)}}}else if(t===`proto`){p(0,o,0,0,0,0,0,0,.22,-.14,.78);let e=Array.from({length:7},(e,t)=>{let n=t/7*Math.PI*2+.4,r=1.6+t%3*1.45;return[Math.cos(n)*r,(c()-.5)*.55,Math.sin(n)*r]}),t=Math.floor(o*.45);for(let n=t;n<o;n+=1){let t=n*8;if(!(s[t+7]<0))if(c()<.52){let i=e[n%e.length],a=c()**.6*1.35,o=c()*Math.PI*2,p=2*c()-1,m=Math.sqrt(Math.max(0,1-p*p)),h=i[0]+a*m*Math.cos(o)*1.25,g=i[1]+a*p*.45,_=i[2]+a*m*Math.sin(o)*.85,v=Math.max(.5,Math.hypot(h,_)),y=Math.sqrt(r*680/Math.hypot(v,.8));s.set([h+u,g+d,_+f,s[t+3]*1.2,-_/v*y+l()*1.25,l()*.95,h/v*y+l()*1.25,.78+c()*.28],t)}else s[t+1]=s[t+1]*2.4,s[t+7]=Math.min(1.02,s[t+7]+.24)}}else if(t===`dwarf-stream`){let e=Math.floor(o*.72);p(0,e,0,0,0,0,0,0,.14,.08,.82);let t=Math.floor((o-e)*.3);for(let n=e;n<o;n+=1){let i=n*8,a=n-e;if(a<t){let e=Math.cbrt(c())*1.15,n=2*c()-1,r=Math.sqrt(Math.max(0,1-n*n)),a=c()*Math.PI*2;s.set([7.4+e*r*Math.cos(a)+u,2.2+e*n+d,-2+e*r*Math.sin(a)+f,45/Math.max(1,t),-1.4+l()*.55,2.4+l()*.55,4.1+l()*.55,.52+c()*.34],i)}else{let n=(a-t)/Math.max(1,o-e-t),p=-.35+n*Math.PI*1.85,m=7.4+Math.sin(p*1.5)*1.65,h=.25+.42*n,g=Math.cos(p)*m+l()*h,_=Math.sin(p)*m*.72+l()*h,v=Math.sin(p+.8)*m*.58+l()*h,y=Math.max(1,Math.hypot(g,_,v)),b=Math.sqrt(r*1150/y);s.set([g+u,_+d,v+f,12/Math.max(1,o-e-t),-Math.sin(p)*b*.75,Math.cos(p)*b*.55,Math.cos(p+.8)*b*.42,.34+c()*.42],i)}}}else if(t===`globular`){let e=520/o,t=.65;s.set([u,d,f,8,0,0,0,.12],0);for(let n=1;n<o;n+=1){let i=Math.max(.001,Math.min(.96,c())),a=Math.min(6.8,t/Math.sqrt(i**(-2/3)-1)),o=2*c()-1,p=Math.sqrt(Math.max(0,1-o*o)),m=c()*Math.PI*2,h=8+520*a**3/(a*a+t*t)**1.5,g=Math.sqrt(r*h/(3*Math.hypot(a,.45))),_=a<1.3&&c()<.08;s.set([a*p*Math.cos(m)+u,a*o+d,a*p*Math.sin(m)+f,e,l()*g,l()*g,l()*g,_?.68+c()*.16:.04+Math.min(.24,a/6*.22)],n*8)}}else if(t===`ring`){let e=Math.floor((o-1)*.3),t=Math.floor((o-1)*.22),n=Math.floor((o-1)*.16),i=o-1-e-t-n;s.set([u,d,f,52,0,0,0,.05],0);let a=1;for(let t=0;t<e&&a<o;t+=1,a+=1){let t=Math.max(.01,Math.min(.88,c())),n=Math.min(18,7.2*Math.sqrt(t)/Math.max(.08,1-Math.sqrt(t))),i=2*c()-1,o=Math.sqrt(Math.max(0,1-i*i)),p=c()*Math.PI*2,m=Math.sqrt(r*1100/Math.hypot(n,1.8))*.52;s.set([n*o*Math.cos(p)+u,n*i+d,n*o*Math.sin(p)+f,780/e,l()*m,l()*m,l()*m,-1],a*8)}for(let e=0;e<t&&a<o;e+=1,a+=1){let e=c()<.45?2+l()*.34:c()**.65*1.65,n=c()*Math.PI*2,i=Math.sqrt(r*(52+240*Math.min(1,e/3)+780*e*e/(e+7.2)**2)/Math.hypot(e,.7));s.set([Math.cos(n)*e+u,l()*.24+d,Math.sin(n)*e+f,160/t,-Math.sin(n)*i+l()*.4,l()*.2,Math.cos(n)*i+l()*.4,.04+Math.min(.28,e*.11)],a*8)}for(let e=0;e<n&&a<o;e+=1,a+=1){let t=e%7,i=c(),o=2.1+i*6.4,p=t/7*Math.PI*2+i*.72+l()*.09,m=Math.sqrt(r*(360+780*o*o/(o+7.2)**2)/Math.hypot(o,.8));s.set([Math.cos(p)*o+u,l()*.14+d,Math.sin(p)*o+f,95/n,-Math.sin(p)*m,l()*.14,Math.cos(p)*m,.18+i*.34],a*8)}for(let e=0;e<i&&a<o;e+=1,a+=1){let e=8.4+l()*.62,t=c()*Math.PI*2,n=Math.sqrt(r*(450+780*e*e/(e+7.2)**2)/Math.hypot(e,.9)),o=c()<.24;s.set([Math.cos(t)*e+u,l()*.16+d,Math.sin(t)*e+f,220/i,-Math.sin(t)*n+Math.cos(t)*.35,l()*.16,Math.cos(t)*n+Math.sin(t)*.35,o?.84+c()*.22:.5+c()*.26],a*8)}}else if(t===`lenticular`){p(0,o,0,0,0,0,0,0,.26,0,.96);for(let e=1;e<o;e+=1){let t=e*8;if(s[t+7]<0)continue;let n=Math.hypot(s[t]-u,s[t+2]-f),r=c()*Math.PI*2,i=s[t+4],a=s[t+6],o=Math.hypot(i,a);s[t+0]=Math.cos(r)*n+u,s[t+2]=Math.sin(r)*n+f,s[t+4]=-Math.sin(r)*o,s[t+6]=Math.cos(r)*o,s[t+7]=Math.min(.32,.04+n/11*.28)}}else if(t===`irregular`){let e=Math.floor((o-1)*.28);s.set([u,d,f,18,0,0,0,.08],0);let t=1;for(let n=0;n<e&&t<o;n+=1,t+=1){let n=Math.max(.01,Math.min(.88,c())),r=Math.min(14,5.5*Math.sqrt(n)/Math.max(.09,1-Math.sqrt(n))),i=2*c()-1,a=Math.sqrt(Math.max(0,1-i*i)),o=c()*Math.PI*2;s.set([r*a*Math.cos(o)+u,r*i+d,r*a*Math.sin(o)+f,420/e,l()*2.2,l()*2.2,l()*2.2,-1],t*8)}let n=[[-3.4,.2,-1.2],[-1.4,-.3,1.3],[.9,.1,-.8],[3.2,-.2,1.5],[-5.1,.4,1.8],[4.9,.3,-1.9],[-2,-.1,-2.8],[1.9,.2,2.7]];for(;t<o;t+=1){let i=t%5==0,a,p,m,h,g=0;if(i){let e=t&1?-1:1,n=c()**.72*5.2,r=.65+n*(.48+.32*c()),i=c()*Math.PI*2;a=Math.cos(i)*r+e*n*.22+l()*.45,p=e*(.4+n),m=Math.sin(i)*r*.78+l()*.45,h=.8+c()*.26,g=e*(1.2+c()*1.4)}else{let e=n[t%n.length],r=c()**.52*2.85,i=2*c()-1,o=Math.sqrt(Math.max(0,1-i*i)),s=c()*Math.PI*2;a=e[0]+r*o*Math.cos(s)*1.45,p=e[1]+r*i*.58+a*.12,m=e[2]+r*o*Math.sin(s)*1.05,h=c()<.22?.8+c()*.24:c()<.62?.4+c()*.34:.12+c()*.22}let _=Math.max(.5,Math.hypot(a,m)),v=Math.sqrt(r*320/Math.hypot(_,1.2));s.set([a+u,p+d,m+f,260/(o-e),-m/_*v*.65+l()*1.35,g+l()*.95,a/_*v*.65+l()*1.35,h],t*8)}}else if(t===`open-cluster`){let e=240/o;s.set([u,d,f,4,0,0,0,.66],0);let t=[[0,.2,0],[-2.6,.6,-1.4],[2.4,-.5,-1.7],[-1.8,-.7,2.5],[3.3,.8,2],[-4.1,-.2,.9],[.9,1.4,-3.3]];for(let n=1;n<o;n+=1){let i=t[n%t.length],a=n>o*.32,p,m,h;if(a){let e=Math.sqrt(c())*7.8,t=c()*Math.PI*2,r=Math.cos(t)*e*1.15,i=Math.sin(t)*e*.88;p=r+Math.sin(r*.95+i*.35+n%5)*.85*.55,m=Math.sin(r*.55+n%4)*1.25+l()*.85,h=i+Math.cos(r*.45)*.95}else{let e=c()**.72*2.2,t=2*c()-1,n=Math.sqrt(Math.max(0,1-t*t)),r=c()*Math.PI*2;p=i[0]+e*n*Math.cos(r),m=i[1]+e*t,h=i[2]+e*n*Math.sin(r)}let g=Math.max(.4,Math.hypot(p,m,h)),_=Math.sqrt(r*160/Math.hypot(g,1.4))*.38;s.set([p+u,m+d,h+f,e,l()*_,l()*_,l()*_,a?.48+c()*.24:.64+c()*.13],n*8)}}else if(t===`sphere`){let e=3.2,t=950/o;s.set([u,d,f,60,0,0,0,.05],0);for(let n=1;n<o;n+=1){let i=Math.max(.004,Math.min(.93,c())),a=Math.min(11.5,e*Math.sqrt(i)/Math.max(.06,1-Math.sqrt(i))),o=2*c()-1,p=Math.sqrt(Math.max(0,1-o*o)),m=2*Math.PI*c(),h=60+a*a*950/((a+e)*(a+e)),g=Math.sqrt(r*h/(3*Math.hypot(a,1.2)));s.set([a*p*Math.cos(m)+u,a*o*.78+d,a*p*Math.sin(m)+f,t,l()*g,l()*g,l()*g,.04+Math.min(.3,a/10*.26)],n*8)}}else p(0,o,0,0,0,0,0,0,0,0,1);return s}function lr(e,t=1.85,n=0){let r=Math.max(1,Math.min(118,Math.trunc(e?.Z||26))),i=Math.max(r,Math.min(256,Math.trunc(e?.A||56))),a=Math.max(0,i-r),o=rr(r*73856093^i*19349663),s=Math.max(1,Number(e?.chargeRadiusFm||3.7)),c=1+Math.max(0,.26*(a-r)/Math.max(1,i)),l=t/Math.max(1.2,Math.cbrt(i))*.88,u=Math.max(.2,t-l*.6),d=Math.PI*(3-Math.sqrt(5)),f=[];for(let e=0;e<i;e+=1){let t=(e+.5)/i,n=((e*37+13)%i+.5)/i,r=Math.cbrt(n),a=1-2*t,s=Math.sqrt(Math.max(0,1-a*a)),c=e*d+(o()-.5)*.12;f.push({dir:[Math.cos(c)*s,a,Math.sin(c)*s],rUnit:r,phase:o()*Math.PI*2})}f.sort((e,t)=>e.rUnit-t.rUnit);let p=[],m=r,h=a;for(let e=0;e<f.length;e+=1){let t=f[e],n=f.length-e,r=m/Math.max(1,n)*(t.rUnit>.82&&h>m?.45:1.15),i=m>0&&(h===0||o()<r);i?--m:--h;let a=i?u:u*c,d=t.rUnit*a;p.push({pos:[t.dir[0]*d,t.dir[1]*d,t.dir[2]*d],radius:l,color0:i?[.96,.34,.18]:[.46,.68,.94],color1:i?[1,.72,.34]:[.78,.88,1],kind:6,seed:e*1.13+s})}return p}function ur(e,t,n){if(e>=5&&n?.bundle?.electromagnetic?.spectralWavelengthsNm?.length){let e=n.bundle.electromagnetic.spectralWavelengthsNm,t=n.bundle.electromagnetic.spectralReflectance,r=[];for(let n=0;n<e.length;n+=1)r.push({wavelengthNm:e[n],intensity:Math.max(.15,Math.min(1,t[n]??.5))});return r}let r=Number(t?.tempK||5778);return[{wavelengthNm:410.2,intensity:r>6500?.85:.35},{wavelengthNm:434,intensity:r>5500?.9:.45},{wavelengthNm:486.1,intensity:.92},{wavelengthNm:495.9,intensity:e<=1?.72:.32},{wavelengthNm:500.7,intensity:e<=1?.96:.4},{wavelengthNm:517.3,intensity:r<6500?.76:.28},{wavelengthNm:587.6,intensity:r>8e3?.95:.42},{wavelengthNm:589.3,intensity:r<5500?.9:.3},{wavelengthNm:656.3,intensity:1}]}function dr(e,{seed:t=20261125,qualityId:n=`med`,initialElementZ:i=26}={}){let a=t>>>0,o=ut[n]||ut.med,l=new v({artifactCache:new b});Ce(M);let u=new Map,d=new Map,f=`present-day`,p=pe({redshiftZ:0,localSystemAgeGyr:4.57,localStarMassSolar:1}),m=Ct({cosmicEpoch:p,regionPosMpc:[0,0,0],localOverdensity:1.15,seed:a}),h={posGal:[4.8,.04,2.1],popTag:.52,starIndex:0},g=!1,S=Tt(wt({cosmicEpoch:p,galaxyEnv:m,starPosGal:h.posGal,popTag:h.popTag,starIndex:h.starIndex,seed:a}));function C(){return g?Qe:S?.catalog?.length?S.catalog:Qe}function w(e=C()){let t=e.findIndex(e=>e.planetClass===`earth-like`||e.id===`earth`);if(t>0)return t;let n=e.findIndex(e=>!e.isStar&&e.kind!==0);return n>0?n:0}let T=Object.freeze({0:{level:82,label:`L0-cosmic-web`,parentKey:null},1:{level:69,label:`L1-galactic-halo`,parentKey:0},2:{level:42,label:`L2-star-system`,parentKey:1},3:{level:31,label:`L3-stellar-core`,parentKey:2},4:{level:23,label:`L4-planetary-world`,parentKey:2},surface:{level:4,label:`L4-planetary-surface`,parentKey:4},5:{level:-28,label:`L5-crystal-md`,parentKey:`surface`},6:{level:-33,label:`L6-quantum-atom`,parentKey:5},7:{level:-49,label:`L7-atomic-nucleus`,parentKey:6}}),E=Oe({referenceSpacingM:1,rootGlobalBaseLevel:82,rootLocalMinLevel:0,rootLocalMaxLevel:2,rootLabel:`L0-cosmic-web`,maxActiveCharts:64,minIdleEpochsBeforeRetire:128}),k=new Map([[0,0]]),N=0,P=0,F=he();function I(e){if(k.has(e))return k.get(e);let t=T[e]||T[0],n=t.parentKey==null?null:I(t.parentKey),r=[0,0,0];if(e===2)r=[...Le];else if(e===4&&He){let e=C()[Ge];e&&Number.isFinite(e.aAu)&&(r=[e.aAu,0,0])}else if(e===`surface`&&tn){let e=(Number(tn.latDeg)||0)*(Math.PI/180),t=(Number(tn.lonDeg)||0)*(Math.PI/180);r=[Math.cos(e)*Math.cos(t),Math.sin(e),Math.cos(e)*Math.sin(t)]}let i=E.ensureChartForScaleLevel({targetGlobalLevel:t.level,parentChartId:n,originInParentUnits:r,localSpanLevels:3,label:t.label});return k.set(e,i.chartId),i.chartId}function L(e,t=24.5){let n=e===4&&en?`surface`:e,r=I(n);return N=n,P=r,E.setChartOccupancy(r,Math.max(1,Math.round(Math.abs(t)*10))),z()}function z(){let e=E.snapshotAtlas(),t=e.charts.find(e=>e.chartId===P)||e.charts[0],n=0,r=t;for(;r&&r.parentChartId!=null&&n<16;)r=e.charts.find(e=>e.chartId===r.parentChartId),n+=1;return Object.freeze({schema:e.schema,activeKey:N,activeChartId:t?.chartId??0,activeChartLabel:t?.label??`L0-cosmic-web`,activeGlobalLevel:t?.globalBaseLevel??82,activeAncestryDepth:n,chartCount:e.chartCount,minGlobalLevel:e.minGlobalLevel,maxGlobalLevel:e.maxGlobalLevel,spanOrdersOfMagnitude:Number((e.ordersOfMagnitude??0).toFixed(2)),doubleFloatOriginHi:t?.originHi??[0,0,0],doubleFloatOriginLo:t?.originLo??[0,0,0]})}let ee=`web`,B=null,se=null,ue=null,de=[],ve=!1,ye=null,xe=null,Te=null,ke=null,Ae=null,je=new Float32Array,Me=.3,Ne=`disk`,Pe=1,Fe=null,Ie=[],Le=[4.8,.04,2.1],Re=`solar-system`,ze=!1,Be=null,Ve=null,He=null,Ue=null,We=null,Ge=w(),U=`nbody`,Ke=null,qe=null,Ye=!0,Xe=null,Ze=null,$e=.94,et=null,tt=null,nt=null,rt=null,it=null,ot=null,st=null,ct=null,dt=null,ft=null,pt=null,mt=null,ht=new Float32Array,gt=.36,_t=`main-sequence-star`,vt=null,yt=null,bt=null,xt=null,St=2,W=`fusion`,Et=null,Dt=null,Ot=new Float32Array,kt=.58,At=null,Mt=null,Nt=null,G=null,Pt=null,Ft=null,It=new Float32Array,Lt=null,Rt=`standard`,zt=null,Vt=w(),Ut=!1,Wt=[],Gt=null,Kt=null,qt=null,Yt=!0,Xt=null,Zt=null,Qt=$t(),en=!1,tn=null,K=null,nn=null,rn=1,an=0,sn=null,ln=null,un=!1,dn=null,pn=null,hn=new Set,gn=null,_n={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0},vn=null,yn=null,bn=i,xn=300,Sn=!1,q=`solid`,J=[],Cn=null,wn=i,Tn=3,En=2,Dn=0,On=!0,kn=`atom`,An=`H2O`,jn=null,Mn=null,Nn=i,Pn=56,Fn=null,In=null,Ln=null,Rn=null,Bn={connected:!1,role:`requester`,relayUrl:``,roomId:`ulg-universes-mesh-v1`,peerId:null,remotePeers:0,remotePeerIds:[],quorumReady:!1,witnessedMessages:0,lastWitnessedType:null,dispatches:0,lastResult:null,error:null},Vn=!1,Hn=!1;async function Y(t,{massNumberA:n=null,relativistic:r=!0,returnOrbitalWavefunctions:i=!0}={}){let a=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),o=`${a}:${n??`std`}:${+!!r}:${+!!i}`;if(u.has(o))return u.get(o);let s=await j(e,a,{massNumberA:n,temperatureK:300,runNuclearGpuVolume:!1,runLiveMd:!1,atomicMaxScf:44,atomicGridPointsN:192,blochGridN:16,scalarRelativistic:r,spinOrbit:r,returnOrbitalWavefunctions:i});return u.set(o,s),s}async function Un({seedOverride:t=null,bigBang:n=!1}={}){B&&=(B.destroy(),null),ve=!!n;let r=(t??a)>>>0,i=ve?.045:.16,s=ve?.011:.0085,c=28500,l=await Bt(e,{gridPerSide:o.cosmoGridPerSide,fftGridN:o.cosmoFftN,boxLengthMpc:c,aInit:i,amplitude:ve?.28:.44,seed:r}),u=Ht(e,{gridPerSide:o.cosmoGridPerSide,pmGridN:o.cosmoFftN,boxLengthMpc:c,aInit:i,da:s,initialConditions:l});ue=null;let d=ve?1:6;for(let e=0;e<d;e+=1)se=await u.step({readTelemetry:e===0||e===d-1}),e===0&&se?.powerSpectrumPk?.kBins?.length&&(ue={kBins:[...se.powerSpectrumPk.kBins],pkValues:[...se.powerSpectrumPk.pkValues]});B=u;let f={disk:`Grand-Design Spiral (Sc/Sb)`,barred:`Barred Spiral (SBb)`,ring:`Cartwheel Collisional Ring Galaxy`,lenticular:`Lenticular Disk (S0 · Sombrero)`,irregular:`Starburst Irregular (Magellanic / M82)`,"open-cluster":`Open Cluster + Reflection Veil (M45)`,binary:`Interacting Major Merger Pair`,sphere:`Cluster-Core Giant Elliptical (E2)`,proto:`High-z Clumpy Starburst Protogalaxy`,"dwarf-stream":`Void Dwarf & Tidal Stream`,globular:`Core-Collapsed Globular Cluster (GC)`},p=rr(r^5370206);de=Array.from({length:7},(e,t)=>{let n=ir[t%ir.length],r=ar[Math.floor(p()*ar.length)],i=1e3+Math.floor(p()*8900),a=t===0?2200:9600,o=(p()-.5)*2*a,s=(p()-.5)*1.4*a,l=(p()-.5)*2*a,u=Number((n===`globular`?.08+p()*.14:.55+p()*1.15).toFixed(2));return{id:`cluster-${t}`,level:0,name:`${r}-${i} ${n===`globular`?`Halo Cluster`:`Supercluster`}`,subtitle:`${f[n]||`Spiral Galaxy`} · Z=${u} Z☉`,posMpc:[o,s,l],pos:[16/c*o,16/c*s,16/c*l],radius:1,morphology:n,metallicity:u,massLabel:n===`globular`?`${(2+p()*6.5).toFixed(1)}×10⁵ M☉`:`${(1.2+p()*6.5).toFixed(2)}×10¹² M☉`,tempK:n===`sphere`||n===`globular`?4200+Math.round(p()*1200):6500+Math.round(p()*4500),composition:n===`globular`?`Ancient Pop II Stars · H 74.8% · He 25.1% · [Fe/H] ≈ -1.6`:`DM 84% · H 12% · He 3.8% · Met ${(.2*u).toFixed(2)}%`,nextLevel:1}})}async function Wn({preset:t=null,metallicity:n=null,galaxyEnvOverride:r=null,seedOverride:i=null}={}){r?m=r:(t||n!=null)&&(m=Object.freeze({...m,morphology:ir.includes(t)?t:m.morphology,meanMetallicitySolar:n==null?m.meanMetallicitySolar:Math.max(1e-4,Math.min(3.2,Number(n))),baseFeH:Math.log10(Math.max(1e-4,n==null?m.meanMetallicitySolar:Number(n)))})),Ne=ir.includes(t||m.morphology)?t||m.morphology:`disk`,Pe=Math.max(.01,Math.min(3,Number(n??m.meanMetallicitySolar)||1)),Te&&=(Te.dispose(),null),ke&&=(ke.dispose(),null),Fe||=await on(e);let s=(i??a)+825>>>0;Te=$n({device:e,initialBodies:cr({count:o.galaxyStars,preset:Ne,seed:s}),gridN:32,boxSize:48,secondSmbhIndex:Ne===`binary`?o.galaxyStars>>1:0,smbhSoftening:.72,label:`ulg-universes-galaxy-pm-${o.galaxyStars}`}),[`disk`,`barred`,`ring`,`lenticular`,`proto`,`sphere`,`globular`].includes(Ne)&&await Te.calibrateEquilibrium({gravity:1,softening:.35}),await Te.step({dt:.008,substeps:2,gravity:1,softening:.35,readback:!1}),ke=re(e,{gridN:24,boxSize:26,strideFloats:8,geometry:`galactic`,initialB0:Me,alphaAmp:.035,etaRes:.16,bSat:.85,velScale:.22,label:`ulg-universes-galactic-dynamo`}),Ae=await ke.step({particleBuffer:Te.getResidentBuffer(),particleCount:Te.count,dt:.04,substeps:8,readTelemetry:!0,readBField:!0}),je=ke.buildStreamlines({worldScale:1,alpha:.3}),Le=[4.8,.04,2.1],Ie=[{id:`smbh-core`,level:1,branch:`smbh-core`,name:`Galactic Core SMBH (Sgr-ULG*)`,subtitle:`4.3×10⁶ M☉ Supermassive Black Hole · Click any orbiting star or zoom into Sgr-ULG*`,pos:[0,0,0],radius:1,isSmbh:!0,tempK:28e3,massLabel:`4.3×10⁶ M☉`,composition:`Relativistic Plasma · Hypervelocity S-Stars`,nextLevel:2}]}async function Gn(){if(Be)return;let t=new Float32Array(192);t.set([0,0,0,40,0,0,0,.72],0);let n=rr((a^4343808)>>>0);for(let e=1;e<24;e+=1){let r=3.2+n()*6.8,i=.25+n()*.58,a=r*(1-i),o=n()*Math.PI*2,s=(n()-.5)*1.4,c=Math.sqrt(40*(1+i)/Math.max(.5,a)),l=Math.cos(o)*a,u=Math.sin(o)*a*Math.sin(s),d=Math.sin(o)*a*Math.cos(s),f=-Math.sin(o)*c,p=Math.cos(o)*c*Math.sin(s),m=Math.cos(o)*c*Math.cos(s);t.set([l,u,d,.002,f,p,m,.14+n()*.08],e*8)}Be=nr({device:e,initialBodies:t,mode:0,label:`ulg-universes-smbh-sstars`}),Ve=await Be.step({dt:.008,gravity:1,softening:.08,readback:!0})}async function qn({seedOverride:t=null,starSite:n=null,solReference:r=null,forceMultiplicity:i=null,forceExoticStage:s=null}={}){He&&=(He.dispose(),null),typeof r==`boolean`&&(g=r),n&&(h={posGal:n.posGal||h.posGal,popTag:n.popTag??h.popTag,starIndex:n.starIndex??h.starIndex,forceExoticStage:s??n.forceExoticStage??null},g=!1);let c=(t??a)+409>>>0;g||(S=Tt(wt({cosmicEpoch:p,galaxyEnv:m,starPosGal:h.posGal,popTag:h.popTag,starIndex:h.starIndex,seed:c,forceMultiplicity:i,forceExoticStage:s??h.forceExoticStage??null}),{seedOverride:c}));let l=C(),u=Ge===0&&!n&&typeof r!=`boolean`;Ge=u?0:g?3:w(l),Vt=u?w(l):Ge,He=at(e,{catalog:l,beltZoneAu:g?null:S?.beltZoneAu,asteroidCount:o.solarAsteroids,seed:c,label:g?`ulg-universes-sol-reference`:`ulg-universes-causal-${S?.systemId||`sys`}`}),await He.step({dtSubYr:35e-6,substeps:4,readMassive:!0}),Ue=He.computeConservationDiagnostics(),We=Ue,zt&&=null}async function X(e=null,{recommendedL3Regime:t=null,initializeNow:n=!1}={}){let r=C(),i=e||(r[Ge]?.isStar?r[Ge]:r[0])||null,a=jt(i,t??(i?.starIndex===0||i===r[0]?S?.recommendedL3Regime:null)),o=a.stellarMode!==W,s=a.stellarMode===`fusion`&&a.stellarPreset!==_t;return W=a.stellarMode,a.stellarMode===`fusion`&&(_t=a.stellarPreset),n&&(W===`fusion`?(!ft||s||o)&&await vr({preset:_t}):await Ur(W)),a}function Jn({resetModes:e=!0}={}){ti();let t=e=>{if(e&&typeof e.dispose==`function`)try{e.dispose()}catch{}};t(Xe),Xe=null,Ze=null,t(et),et=null,tt=null,nt=null,t(rt),rt=null,it=null,ot=null,t(st),st=null,ct=null,dt=null,t(Ke),Ke=null,qe=null,t(Et),Et=null,Dt=null,Ot=null,t(At),At=null,Mt=null,Nt=null,t(G),G=null,Pt=null,Ft=null,It=null,t(Xt),Xt=null,Zt=null,t(Be),Be=null,Ve=null,zt=null,Gt=null,e&&(Re=`solar-system`,U=`nbody`,Rt=`standard`,Ut=!1,W=`fusion`)}async function Xn({posGal:e,popTag:t=.5,starIndex:n=0,forceMultiplicity:r=null,forceExoticStage:i=null,seedOverride:a=null}={}){Jn({resetModes:!0}),h={posGal:Array.isArray(e)?[...e]:[...h.posGal],popTag:Number.isFinite(Number(t))?Number(t):.5,starIndex:Math.trunc(Number(n)||0),forceExoticStage:i||null},Le=[...h.posGal],g=!1,await qn({starSite:h,forceMultiplicity:r,forceExoticStage:i,seedOverride:a});let o=S?.catalog?.[0]||S?.starSystem?.stars?.[0];return o&&await X(o,{recommendedL3Regime:S?.recommendedL3Regime,initializeNow:!1}),S}async function Zn({forceMultiplicity:e=null}={}){let t=(h.starIndex||0)+1,n=rr((a^t*1103515245)>>>0),r=.8+n()**.72*8.2,i=n()*Math.PI*2,o=(n()-.5)*(r<2.2?1.4:.42),s=r<2?.08+n()*.22:.32+n()*.65;return Xn({posGal:[Math.cos(i)*r,o,Math.sin(i)*r],popTag:s,starIndex:t,forceMultiplicity:e})}async function Qn(e){return Jn({resetModes:!0}),g=!!e,await qn({solReference:g}),C()}async function er({seedOverride:t=null}={}){Ke&&=(Ke.dispose(),null);let n=(t??a)+773>>>0,r=fe(e,{pebbleCount:Math.min(4096,Math.max(1536,(o.solarAsteroids||512)*4)),embryoCount:18,enableGasDrag:Ye,seed:n,label:`ulg-universes-protoplanetary-disk`});qe=await r.step({dt:.018,substeps:3,readTelemetry:!0}),Ke=r}async function tr({initialB0:t=kt,seedOverride:n=null}={}){kt=Math.max(0,Math.min(1.5,Number(t)??.58));let r=Et;Et=null,r&&r.dispose();let i=(n??a)+3133>>>0,s=ie(e,{gridN:o.id===`low`?16:32,tracerCount:Math.min(8192,Math.max(3072,o.stellarParticles||4096)),initialB0:kt,spinOmega:2.35,gravityG:2.4,seed:i,label:`ulg-universes-nebular-mhd`});Dt=await s.step({dt:.024,substeps:16,readTelemetry:!0,readBFieldForStreamlines:!0}),Ot=s.buildMagneticFieldStreamlines({worldScale:1,alpha:.68}),Et=s}async function ur(t=ee){let n=ye;ye=null,n&&n.dispose();let r=t===`cmb`,i=t===`reionization`,s=t===`cluster-merger`,c=r?1100:i?10:.25,l=o.id===`low`?4096:o.id===`ultra`?10240:6656,u=De(e,{gridN:o.id===`low`?16:24,tracerCount:l,boxSizeMpc:260,redshiftZ:c,clusterMergerMode:s,uvFlux:i?1.55:r?0:.25,gravityG:s?1.65:1.15,seed:(a^(r?4352:i?4112:49413))>>>0,label:`ulg-universes-cosmo-${t}`}),d=i?5:s?4:2;for(let e=0;e<d;e+=1)xe=await u.step({dt:i?.14:.09,substeps:2,readTelemetry:e===d-1});ye=u}async function dr({spinA:t=$e}={}){$e=Math.max(-.99,Math.min(.99,Number(t)??.94));let n=Xe;Xe=null,n&&n.dispose();let r=o.id===`low`?4096:6656,i=ae(e,{massSolar:45e7,spinA:$e,accretionRateEddington:.58,magneticFluxNorm:1.15,particleCount:r,seed:(a^9479591)>>>0,label:`ulg-universes-kerr-quasar`});for(let e=0;e<5;e+=1)Ze=await i.step({dt:.032,substeps:2,readTelemetry:e===4});Xe=i}async function fr(t=`bns-kilonova`){let n=et;et=null,n&&n.dispose(),nt=t;let r=o.id===`low`?3072:5120,i=t===`xray-binary`?{m1Solar:11,m2Solar:1.8,r1Sim:.44,r2Sim:.88,separation0:4.5,eccentricity0:.02,cSpeedSim:24,rocheOverflow:!0,neutronRich:!1,wdCarbonOxygen:!1,warm:8}:t===`type-ia`?{m1Solar:1.38,m2Solar:.96,r1Sim:.36,r2Sim:.42,separation0:2.25,eccentricity0:.05,cSpeedSim:4.6,rocheOverflow:!1,neutronRich:!1,wdCarbonOxygen:!0,warm:20}:t===`bbh-merger`?{m1Solar:36,m2Solar:29,r1Sim:.56,r2Sim:.48,separation0:3.25,eccentricity0:.06,cSpeedSim:5,rocheOverflow:!1,neutronRich:!1,wdCarbonOxygen:!1,warm:8}:{m1Solar:1.45,m2Solar:1.32,r1Sim:.36,r2Sim:.34,separation0:2.35,eccentricity0:.05,cSpeedSim:4.7,rocheOverflow:!1,neutronRich:!0,wdCarbonOxygen:!1,warm:22},s=ce(e,{...i,particleCount:r,seed:(a^t.length*9187)>>>0,label:`ulg-universes-relbin-${t}`});for(let e=0;e<i.warm;e+=1)tt=await s.step({dt:.032,substeps:4,readTelemetry:e===i.warm-1});et=s}async function pr(t=`comet-tails`){let n=rt;rt=null,n&&n.dispose(),ot=t;let r=t===`comet-tails`,i=H(e,{regime:r?`comet-dual-tail`:`hot-jupiter-xuv`,uvFlux:r?1.45:2.35,radBeta:r?.95:.72,windSpeed:r?2.25:1.95,sublimationDrive:r?1.35:1.45,sourceDir:r?[.76,.24,.6]:[.82,.14,.55],particleCount:o.id===`low`?3072:5120,seed:(a^(r?787431:263952))>>>0,label:`ulg-universes-radl2-${t}`});for(let e=0;e<8;e+=1)it=await i.step({dt:.04,substeps:3,readTelemetry:e===7});rt=i}async function Z(t=`roche-rings`){let n=st;st=null,n&&n.dispose(),dt=t;let r=oe(e,{mode:t===`red-giant`?`red-giant-engulf`:t,orbitRadiusSim:t===`roche-rings`?2.35:t===`tde`?3.2:2.8,rHostSim:t===`red-giant`?1.85:t===`tde`?1.05:t===`giant-impact`?1.48:1.38,rRocheSim:t===`tde`?5.2:3.65,gmHost:t===`tde`?38:24,cohesionStrength:.55,tidalHeatDrive:t===`tde`?1.85:1.25,shepherdGm:.72,particleCount:o.id===`low`?3072:5120,seed:(a^t.length*4099)>>>0,label:`ulg-universes-tidal-${t}`}),i=t===`roche-rings`?12:t===`catastrophic-shatter`?4:t===`tde`?8:6;for(let e=0;e<i;e+=1)ct=await r.step({dt:.028,substeps:3,readTelemetry:e===i-1});st=r}async function mr(t=null,{excessRatio:n=1.6}={}){let r=st;st=null,r&&r.dispose();let i=t?.id||C()[Ge]?.id||`asteroid`;hn.add(i),gn=t?.name||C()[Ge]?.name||`Target Body`,U=`catastrophic-shatter`,dt=`catastrophic-shatter`;let s=oe(e,{mode:`catastrophic-shatter`,orbitRadiusSim:2.2,rHostSim:1,rRocheSim:2.2,gmHost:6,cohesionStrength:.25,tidalHeatDrive:Math.max(1.2,Math.min(3,1.55*n)),shepherdGm:0,particleCount:o.id===`low`?3072:5120,seed:(a^i.length*8191+5547902)>>>0,label:`ulg-universes-shatter-${i}`});for(let e=0;e<4;e+=1)ct=await s.step({dt:.026,substeps:3,readTelemetry:e===3});return st=s,ct}async function hr(t=`h2-pillars`){let n=At;At=null,n&&n.dispose(),Nt=t;let r=H(e,{regime:t,uvFlux:t===`snr-pwn`?1.85:t===`wr-bubble`?1.95:t===`planetary-nebula`?1.65:t===`reflection-nebula`?1.55:1.48,radBeta:t===`wr-bubble`?1.35:t===`snr-pwn`?1:.88,windSpeed:t===`snr-pwn`?2.15:t===`wr-bubble`?1.95:t===`planetary-nebula`?1.68:1.15,bipolarAsymmetry:t===`wr-bubble`?1.85:1.45,sourceDir:[.65,.58,.48],particleCount:o.id===`low`?3584:5632,seed:(a^t.length*6151)>>>0,label:`ulg-universes-radl3-${t}`});for(let e=0;e<6;e+=1)Mt=await r.step({dt:.036,substeps:2,readTelemetry:e===5});At=r}async function gr(t=`magnetar`){let n=G;G=null,n&&n.dispose(),Ft=t;let r=t===`magnetar`,i=V(e,{massSolar:r?1.55:1.42,radiusM:12e3,surfaceBFieldTesla:r?165e9:42e7,spinPeriodS:r?.14:.0085,obliquityRad:r?.56:.74,particleCount:o.id===`low`?3584:5632,seed:(a^(r?239335:590170))>>>0,label:`ulg-universes-mag-${t}`}),s=r?8:4;for(let e=0;e<s;e+=1)Pt=await i.step({dt:.055,substeps:3,readTelemetry:e===s-1});It=i.buildDipoleFieldLines({linesPerRing:16,steps:32,worldScale:1,alpha:.74}),G=i}async function Q(){let t=[];for(let e of[8.2,8.8,9.4,10,10.6,11.3,12.2,13.5,15,17.2,17.6,17.9,18.2,18.5,18.8,19.2])t.push({centralRhoKgM3:10**e,ye:.5});Lt=await le(e,t)}async function _r(){let t=Xt;Xt=null,t&&t.dispose();let n=oe(e,{mode:`cryo-plumes`,rHostSim:2.35,gmHost:14,tidalHeatDrive:1.45,particleCount:o.id===`low`?2560:4096,seed:(a^209125838)>>>0,label:`ulg-universes-cryo-plumes`});for(let e=0;e<8;e+=1)Zt=await n.step({dt:.032,substeps:3,readTelemetry:e===7});Xt=n}async function vr({preset:t=_t,seedOverride:n=null}={}){let r=[`main-sequence-star`,`blue-supergiant`,`red-supergiant`,`agb-carbon`,`brown-dwarf`];_t=[...r,`solar-nebula`,`massive-supernova`,`binary-nursery`].includes(t)?t:`main-sequence-star`,ft&&=(ft.dispose(),null),pt&&=(pt.dispose(),null),xt||=(await zn({closureRegistry:l,device:e})).ref;let i=(n??a)+1939>>>0;if(r.includes(_t)){ft=Se(e,{count:Math.min(8192,Math.max(2048,o.stellarParticles)),stellarClass:_t,boxHalf:7.5,seed:i,label:`ulg-universes-stellar-mpm-${_t}`});for(let e=0;e<4;e+=1)vt=await ft.step({dt:.015,timeAccel:St,readTelemetry:e===3})}else ft=Kn({device:e,initialBodies:Yn({count:o.stellarParticles,preset:_t,seed:i}),closureRegistry:l,closureRef:xt,boxHalf:14,rCellFactor:.075,softening:.25,baseLogRho:-16.2,refRhoSim:.08,tScaleK:78e4,label:`ulg-universes-stellar-${_t}`}),vt=await ft.step({dt:.015,timeAccel:St,readTelemetry:!0});pt=re(e,{gridN:24,boxSize:16,strideFloats:16,geometry:`stellar`,initialB0:gt,alphaAmp:.22,etaRes:.055,bSat:.95,velScale:.35,label:`ulg-universes-stellar-dynamo`}),mt=await pt.step({particleBuffer:ft.getResidentBuffer(),particleCount:ft.count,dt:.042,substeps:8,readTelemetry:!0,readBField:!0}),ht=pt.buildStreamlines({worldScale:1,alpha:.42});let[s,c]=await Promise.all([we(e,[{rhoKgM3:15e4,temperatureK:15e6,xH:.72,xHe:.26,xZ:.02,dtS:0xe8d4a51000},{rhoKgM3:8e5,temperatureK:35e6,xH:.55,xHe:.42,xZ:.03,dtS:1e11},{rhoKgM3:12e7,temperatureK:16e7,xH:0,xHe:.96,xZ:.04,dtS:1e10}]),be(e,[1.5,3],{dXi:.01,maxXi:12})]);yt=s,bt=c}async function yr({bodyIndex:t=Vt}={}){let n=C(),r=Math.max(0,Math.min(n.length-1,Math.trunc(Number(t)??Vt)));if(n[r]?.isStar||r===0){let e=w(n);e>0&&(r=e)}Vt=r;let i=n[r]||Qe[3],s=i.coreZ||26,c=i.mantleZ||14,l=i.surfZ||29;vn||(bn=l),jn||(wn=s),Fn||(Nn=s);let[u,f,p]=await Promise.all([Y(s,{relativistic:!0,returnOrbitalWavefunctions:!1}),Y(c,{relativistic:!0,returnOrbitalWavefunctions:!1}),Y(l,{relativistic:!0,returnOrbitalWavefunctions:!1})]),m=async t=>{let n=t.bundle.materialKey||t.bundle.symbol;if(d.has(n))return d.get(n);let r=await fn(e,t.bundle,{minPressurePa:1e4,maxPressurePa:0xe8d4a51000,maxTemperatureK:12e3,degrees:[4,4],relativeTolerance:.03,maxBisectDepth:2});return d.set(n,r),r},[h,g]=await Promise.all([m(u),m(f)]),_=Math.max(5e9,Math.min(85e10,Number(i.centralP)||36e10));zt=await mn(e,{centralPressurePa:_,surfacePressurePa:1e5,radialStepM:35e3,maxRadiusM:35e6,convergePasses:3,maxProfileSamples:128,layers:[{name:`${u.bundle.symbol} Core`,cumulativeMassFraction:.32,temperatureK:5200,atlas:h},{name:`${f.bundle.symbol} Mantle`,cumulativeMassFraction:1,temperatureK:2200,atlas:g}]});let v=.52,y=zt?.profile||[],b=Math.max(1,zt?.radiusM||i.radiusKm*1e3);for(let e=0;e<y.length;e+=1)if((y[e].layerIndex??0)>=1){v=Math.max(.22,Math.min(.78,y[e].radiusM/b));break}Wt=[{id:`layer-core`,level:4,name:`${i.name} · ${u.bundle.symbol} Core`,subtitle:`Gate 2 Polytope Atlas · P_c = ${(_/1e9).toFixed(0)} GPa · MoI = ${(zt?.moiFactor||.33).toFixed(3)}`,pos:[.45,.35,.45],radius:.7,sampleZ:s,rCoreNorm:v,rMantleNorm:.94,tempK:5200,massLabel:`R = ${i.radiusKm.toLocaleString()} km`,composition:i.composition,nextLevel:5},{id:`layer-mantle`,level:4,name:`${i.name} · ${f.bundle.symbol} Mantle`,subtitle:`High-Pressure Polytope Shell · T = 2,200 K`,pos:[1.35,1.05,1.35],radius:.7,sampleZ:c,rCoreNorm:v,rMantleNorm:.94,tempK:2200,massLabel:`g = ${(zt?.surfaceGravityMPerS2||9.8).toFixed(2)} m/s²`,composition:`${f.bundle.symbol}/O Silicate Mantle`,nextLevel:5},{id:`layer-surface`,level:4,name:`${i.name} · ${p.bundle.symbol} Crust Sample`,subtitle:`Scroll in to resolve live ${p.bundle.symbol} WebGPU crystal lattice`,pos:[-1.8,1.4,1.5],radius:.7,sampleZ:l,rCoreNorm:v,rMantleNorm:.94,tempK:i.tempK||288,massLabel:`T_eq = ${i.tempK||288} K`,composition:`${p.bundle.symbol} (${p.bundle.mechanical.crystalStructure})`,nextLevel:5}],Kt&&(Kt.dispose(),Kt=null,qt=null);let x=Number(u.bundle?.electromagnetic?.electricalConductivitySPerM)||1e6,S=i.parent>=0?n[i.parent]:null,T=Math.max(.15,Number(i.aAu||S?.aAu||1));if(Gt=te({...i,coreRadiusNorm:v,coreConductivitySm:x},{...zt,coreRadiusFraction:v,centralPressurePa:_},{solarDistanceAu:T,coreConductivitySm:x}),Gt.activation.anyActive){let t=me(e,{width:o.id===`low`?64:128,height:o.id===`low`?32:64,bodyParams:Gt,enableTriboelectric:Yt,seed:(a^r*2654435761)>>>0,label:`ulg-universes-atmo-${r}`});for(let e=0;e<4;e+=1)qt=await t.step({dtSim:.048,substeps:2,readTelemetry:e===3});Kt=t}}async function br({Z:t=bn,tempK:n=null,phasePreset:i=null,gravity:a=Sn}={}){bn=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),Sn=!!a,vn&&=(vn.destroy(),null);let c=await Y(bn,{relativistic:!0,returnOrbitalWavefunctions:!1}),l=c.visualData.bulk,u=c.visualData.thermo.potential,d=c.bundle,f=Math.max(20,Number(d.thermodynamic.meltingPointK||600)),p=Math.max(f*1.4+20,Number(d.thermodynamic.boilingPointK||f*2.4));i===`melt`?(q=`melt`,xn=Math.round(f*1.42)):i===`vapor`?(q=`vapor`,xn=Math.round(p*1.38)):i===`solid`?(q=`solid`,xn=Math.max(20,Math.round(f*.25))):n!=null&&Number.isFinite(Number(n))?xn=Math.max(15,Math.round(Number(n))):(q=`solid`,xn=Math.max(20,Math.round(f*.25)));let m=Math.max(1,Number(d.nuclear.atomicMassU||28)),h=Math.min(2,Math.max(.45,.09*Math.sqrt(m))),g=o.mdCells;vn=r(e,{...s({crystalStructure:l.crystalStructure,cellsVec:[g,g,g],latticeConstantA:Math.max(2.4,Number(l.latticeConstantA||3.6)),massU:m,temperatureK:xn}),potentialModel:u.potentialModel,epsilonEv:u.epsilonEv,sigmaOrR0A:u.sigmaOrR0A,alphaOrLambda:u.alphaOrLambda,rcutA:u.rcutA,eamAEv:u.eamAEv,eamBeta:u.eamBeta,swGamma:u.swGamma,dtFs:h,targetTemperatureK:xn,thermostatCouplingFs:20,meltingPointK:f,bulkModulusGPa:Math.max(1,Number(l.bulkModulusPa||4e10)/1e9),cohesiveEnergyEv:Math.max(.05,Number(l.cohesiveEnergyEv||2)),crystalStructure:l.crystalStructure,gravityEnabled:Sn}),yn=await vn.stepBatch(4,{readTelemetry:!0,targetTemperatureK:xn}),J=yn?.rdf?Array.from(yn.rdf):[]}async function xr({Z:t=wn,n=null,l:r=null,m:i=null,relativistic:s=On,mode:l=kn,moleculeKey:u=An}={}){wn=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),On=!!s,kn=l===`molecule`?`molecule`:`atom`,An=or[u]?u:`H2O`;let d=lt.find(e=>e.Z===wn);n==null?d&&(Tn=d.defaultN):Tn=Math.max(1,Math.min(7,Math.trunc(Number(n)))),r==null?d&&(En=Math.min(Tn-1,d.defaultL)):En=Math.max(0,Math.min(Tn-1,Math.trunc(Number(r)))),Dn=i==null?0:Math.max(-En,Math.min(En,Math.trunc(Number(i))));let f=await Y(wn,{relativistic:On,returnOrbitalWavefunctions:!0});if(kn===`molecule`){let t=or[An];Mn=await c(e,t.atoms);let n=new Float32Array(t.atoms.length*4),r=new Float32Array(t.atoms.length*4);for(let e=0;e<t.atoms.length;e+=1){let i=t.atoms[e];n.set([i.position[0],i.position[1],i.position[2],i.Z===1?1.24:2.25],e*4),r.set([i.Z,e%2==0?1:-.85,e%2==0?-.9:1,0],e*4)}jn=D(e,{posZeta:n,weights:r,boxHalfBohr:4.2,mode:0,pointCount:Math.min(14e4,o.orbitalPoints),seed:(a^1779033703)>>>0,reuseBuffer:jn?.pointsBuffer||null})}else{let t=f.visualData.atom,n=(t.orbitals||[]).find(e=>e.n===Tn&&e.l===En&&e.u?.length);jn=O(e,{Z:wn,n:Tn,l:En,m:Dn,pointCount:o.orbitalPoints,rGrid:n?t.rGrid:null,orbitalU:n?n.u:null,screeningExchange:!0,relativisticSpinOrbit:On,colorMode:1,seed:(a^wn*2654435761)>>>0,reuseBuffer:jn?.pointsBuffer||null})}}async function Sr({Z:t=Nn,A:n=null}={}){Nn=Math.max(1,Math.min(118,Math.trunc(Number(t)||26)));let r=lt.find(e=>e.Z===Nn);Pn=n==null?r?.A||Math.round(Nn*2.15):Math.max(Nn,Math.trunc(Number(n))),In&&=(In.destroy(),null),Fn=await _(e,Nn,Pn,{volDim:o.nuclearVolDim}),In=A(e,Fn),Ln=In?await In.stepBatch(8):null}async function Cr(e,t,n=1){if(Vn||Hn)return;Vn=!0;let r=sr(t,{surfaceActive:!!(en&&e===4),userTimeScale:n}).effectiveTimeScale;try{if(e===0)ee!==`web`&&ye?xe=await ye.step({dt:(ee===`reionization`?.12:.08)*Math.max(.15,Math.min(2.5,r)),substeps:1,readTelemetry:!0}):B&&B.getState().aScale<1.15&&(se=await B.step({readTelemetry:!0}));else if(e===1&&Te){let e=Te,t=.0018*Math.max(.08,Math.min(3,r));await e.step({dt:t,substeps:1,gravity:1,softening:.35,readback:!1});let n=ke;if(n&&e===Te){let t=e.stepIndex%4==0,i=await n.step({particleBuffer:e.getResidentBuffer(),particleCount:e.count,dt:.014*Math.max(.12,Math.min(2.2,r)),substeps:1,readTelemetry:t,readBField:t});n===ke&&(Ae=i,t&&(je=n.buildStreamlines({worldScale:1,alpha:.3})))}}else if(e===2){if(Re===`smbh-core`&&Be)Ve=await Be.step({dt:.008*Math.max(.08,Math.min(3,r)),gravity:1,softening:.08,readback:!0});else if(U===`formation`&&Ke)qe=await Ke.step({dt:.016*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if(U===`quasar-jet`&&Xe)Ze=await Xe.step({dt:.028*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if((U===`xray-binary`||U===`bns-kilonova`||U===`type-ia`||U===`bbh-merger`)&&et)tt=await et.step({dt:.028*Math.max(.12,Math.min(2.5,r)),substeps:3,readTelemetry:!0});else if((U===`comet-tails`||U===`hot-jupiter`)&&rt)it=await rt.step({dt:.036*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if([`roche-rings`,`giant-impact`,`red-giant`,`catastrophic-shatter`,`tde`].includes(U)&&st)ct=await st.step({dt:.024*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if(He){let e=Math.max(0,Math.min(1,(t-8.75)/5.2)),r=1e-5+46e-6*e**1.45,i=Math.max(1,Math.min(48,Math.round((3+21*e**1.25)*Math.max(.1,n))));await He.step({dtSubYr:r,substeps:i,readMassive:!0}),We=He.computeConservationDiagnostics()}}else if(e===3){if(W===`nebular-mhd`&&Et){let e=Et.stepIndex%4==0;Dt=await Et.step({dt:.022*Math.max(.12,Math.min(2.2,r)),substeps:1,readTelemetry:!0,readBFieldForStreamlines:e}),e&&(Ot=Et.buildMagneticFieldStreamlines({worldScale:1,alpha:.68}))}else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`].includes(W)&&At)Mt=await At.step({dt:.032*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if(W===`black-hole`&&Xe)Ze=await Xe.step({dt:.028*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if((W===`pulsar`||W===`magnetar`)&&G){let e=G.stepIndex%4==0;Pt=await G.step({dt:.036*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0,readBField:e}),e&&(It=G.buildDipoleFieldLines({linesPerRing:16,steps:32,worldScale:1,alpha:.74}))}else if(W!==`white-dwarf-tov`&&ft){let e=ft,t=await e.step({dt:.014*Math.max(.12,Math.min(2.5,r)),timeAccel:St,readTelemetry:!0});if(e===ft){vt=t;let n=pt;if(n){let t=e.stepIndex%4==0,i=await n.step({particleBuffer:e.getResidentBuffer(),particleCount:e.count,dt:.038*Math.max(.12,Math.min(2.2,r)),substeps:1,readTelemetry:t,readBField:t});n===pt&&(mt=i,t&&(ht=n.buildStreamlines({worldScale:1,alpha:.42})))}}}}else if(e===4)if(en&&K){let e=K,t=.02*Math.max(.25,Math.min(2.5,n)),r=Math.max(1,Math.min(1e7,rn));if(an+=t*r,He&&Rt!==`eyeball-locked`&&Rt!==`rogue`){let e=t*r/31557600,n=Math.max(1,Math.min(8,Math.ceil(e/4e-4))),i=Math.min(6e-4,Math.max(1e-8,e/n));await He.step({dtSubYr:i,substeps:n,readMassive:!0})}en&&K===e&&(nn=await e.step({dt:t,controls:_n,climate:sn,readTelemetry:e.stepIndex%4==0}))}else{let e=Rt===`eyeball-locked`?[1,0,0]:[.65,.25,.7];if(Rt===`cryo-plumes`&&Xt&&(Zt=await Xt.step({dt:.028*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0})),He&&Rt!==`eyeball-locked`&&Rt!==`rogue`){await He.step({dtSubYr:6e-6,substeps:Math.max(1,Math.round(2*Math.max(.25,r))),readMassive:!0}),We=He.computeConservationDiagnostics();let t=He.getMassiveBodyState64(Ge),n=He.getMassiveBodyState64(0),i=n.posAu[0]-t.posAu[0],a=n.posAu[1]-t.posAu[1],o=n.posAu[2]-t.posAu[2],s=Math.hypot(i,a,o)||1;e=[i/s,a/s,o/s]}Kt&&(qt=await Kt.step({dtSim:.038*Math.max(.15,Math.min(2.5,r)),substeps:2,sunDir:e,readTelemetry:!0}))}else if(e===5&&vn){let e=Math.max(1,Math.min(6,Math.round(2*Math.max(.25,n))));yn=await vn.stepBatch(e,{readTelemetry:!0,targetTemperatureK:xn,nonBlocking:!0}),yn?.rdf&&(J=Array.from(yn.rdf))}else if(e===7&&In){let e=Math.max(2,Math.min(18,Math.round(6*Math.max(.25,n)))),t=await In.stepBatch(e,{nonBlocking:!0});t&&(Ln=t)}}catch(e){let t=String(e?.message||e||``);if(!Hn&&e?.name!==`AbortError`&&!t.includes(`Buffer was destroyed before mapping`))throw e}finally{Vn=!1}}async function wr(){if(!Rn)return;let e=Rn;Rn=null;try{await e.stop()}catch{}Bn={...Bn,connected:!1,remotePeers:0,remotePeerIds:[],quorumReady:!1,error:null}}async function Tr({relayUrl:e=Bn.relayUrl,roomId:t=Bn.roomId,role:n=Bn.role}={}){await wr();let r=String(e||``).trim(),i=String(t||`ulg-universes-mesh-v1`).trim(),a=[`requester`,`responder`,`observer`].includes(n)?n:`requester`;if(!r)return Bn={...Bn,connected:!1,relayUrl:``,roomId:i,role:a,error:null},Bn;try{let e=`uv-${a}-${Math.random().toString(36).slice(2,8)}`,t=new URL(`data:text/javascript;base64,LyoqCiAqIERldGVybWluaXN0aWMgUGVlckNvbXB1dGUgcmVzcG9uZGVyIGRlcml2YXRpb24gdGFzayBmb3IgdGhlIENvc21pYyA8LT4gUXVhbnR1bQogKiBkaXN0cmlidXRlZCBtZXNoIChgc3RhcnRMaXZlQ2xpZW50RGVyaXZhdGlvblBlZXJNZXNoYCkuCiAqCiAqIEV4ZWN1dGVkIGluc2lkZSByZXNwb25kZXIgYnJvd3NlciBjb250ZXh0cyB2aWEgUGVlckNvbXB1dGUgYENvbXB1dGVNYW5hZ2VyYAogKiBvdmVyIFdlYlNvY2tldC9XZWJSVEMgcmVsYXlzIGFuZCB2YWxpZGF0ZWQgYnkgMi1vZi0yIHF1b3J1bSBoYXNoaW5nLgogKi8KCmltcG9ydCB7IGRlcml2ZUVsZW1lbnRQcm9wZXJ0aWVzIH0gZnJvbSAnLi4vcnVudGltZS9tYXRlcmlhbC9lbGVtZW50Q2xvc3VyZXMuanMnOwppbXBvcnQgeyBldmFsdWF0ZUNoZXJlbmtvdkNsb3N1cmUgfSBmcm9tICcuLi9ydW50aW1lL21hdGVyaWFsL251Y2xlYXJDaGVyZW5rb3ZDbG9zdXJlLmpzJzsKCmV4cG9ydCBjb25zdCBDT1NNSUNfUVVBTlRVTV9QRUVSX1RBU0tfU0NIRU1BID0gJ3BlZXJjb21wdXRlLnVsZy5jb3NtaWMtcXVhbnR1bS1wZWVyLXRhc2sudjEnOwoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1bihkYXRhID0ge30pIHsKICBjb25zdCBraW5kID0gU3RyaW5nKGRhdGE/LmtpbmQgfHwgJ21hdGVyaWFsLnJlc29sdmUtZWxlbWVudCcpOwogIGNvbnN0IHBheWxvYWQgPSBkYXRhPy5wYXlsb2FkIHx8IGRhdGEgfHwge307CgogIGlmIChraW5kID09PSAnbnVjbGVhci5jaGVyZW5rb3YnKSB7CiAgICBjb25zdCBraW5ldGljRW5lcmd5TWVWID0gTnVtYmVyKHBheWxvYWQua2luZXRpY0VuZXJneU1lViA/PyAwKTsKICAgIC8vIEZhaWwgY2xvc2VkIHRvIHZhY3V1bSAobiA9IDEuMCkgd2hlbiByZWZyYWN0aXZlSW5kZXggaXMgb21pdHRlZCAobmV2ZXIgc2lsZW50bHkgYXNzdW1lIEgyTyAxLjMzMykKICAgIGNvbnN0IHJlZnJhY3RpdmVJbmRleCA9IE51bWJlci5pc0Zpbml0ZShOdW1iZXIocGF5bG9hZC5yZWZyYWN0aXZlSW5kZXgpKSAmJiBOdW1iZXIocGF5bG9hZC5yZWZyYWN0aXZlSW5kZXgpID49IDEuMAogICAgICA/IE51bWJlcihwYXlsb2FkLnJlZnJhY3RpdmVJbmRleCkKICAgICAgOiAxLjA7CiAgICBjb25zdCBjaCA9IGV2YWx1YXRlQ2hlcmVua292Q2xvc3VyZSh7IGtpbmV0aWNFbmVyZ3lNZVYsIHJlZnJhY3RpdmVJbmRleCB9KTsKICAgIGNvbnN0IHZhbHVlID0gewogICAgICBzY2hlbWE6IENPU01JQ19RVUFOVFVNX1BFRVJfVEFTS19TQ0hFTUEsCiAgICAgIGtpbmQsCiAgICAgIGFjdGl2ZTogY2guYWN0aXZlLAogICAgICBiZXRhOiBOdW1iZXIoY2guYmV0YS50b0ZpeGVkKDYpKSwKICAgICAgY2hlcmVua292QW5nbGVEZWc6IE51bWJlcihjaC5jaGVyZW5rb3ZBbmdsZURlZy50b0ZpeGVkKDQpKSwKICAgICAgcGhvdG9uc1Blck1ldGVyOiBNYXRoLnJvdW5kKGNoLnBob3RvbnNQZXJNZXRlciksCiAgICAgIHNjaWVudGlmaWNWYWxpZGF0aW9uOiBmYWxzZQogICAgfTsKICAgIHJldHVybiB7CiAgICAgIHZhbHVlLAogICAgICBjb21taXREZWx0YTogewogICAgICAgIHRhc2tJZDogYGNxLXBlZXI6JHtraW5kfToke2tpbmV0aWNFbmVyZ3lNZVZ9OiR7cmVmcmFjdGl2ZUluZGV4fWAsCiAgICAgICAgc2NvcGU6ICdjb3NtaWMtcXVhbnR1bS1wZWVyLW1lc2gnLAogICAgICAgIHBheWxvYWQ6IHZhbHVlCiAgICAgIH0KICAgIH07CiAgfQoKICBjb25zdCByYXdaID0gTnVtYmVyKHBheWxvYWQuYXRvbWljTnVtYmVyWik7CiAgaWYgKCFOdW1iZXIuaXNJbnRlZ2VyKHJhd1opIHx8IHJhd1ogPCAxIHx8IHJhd1ogPiAxMTgpIHsKICAgIHRocm93IG5ldyBSYW5nZUVycm9yKGBjb3NtaWNRdWFudHVtUGVlclRhc2sgcmVxdWlyZXMgYW4gZXhwbGljaXQgaW50ZWdlciBhdG9taWNOdW1iZXJaIGluIFsxLCAxMThdLCBnb3QgJHtwYXlsb2FkLmF0b21pY051bWJlclp9YCk7CiAgfQogIGNvbnN0IGF0b21pY051bWJlclogPSByYXdaOwogIGNvbnN0IGZ1bmN0aW9uYWwgPSBTdHJpbmcocGF5bG9hZC5mdW5jdGlvbmFsIHx8ICdwYmUnKS50b0xvd2VyQ2FzZSgpOwogIGNvbnN0IHByb3BzID0gZGVyaXZlRWxlbWVudFByb3BlcnRpZXMoYXRvbWljTnVtYmVyWiwgewogICAgZnVuY3Rpb25hbCwKICAgIHNjYWxhclJlbGF0aXZpc3RpYzogdHJ1ZSwKICAgIHNwaW5PcmJpdDogdHJ1ZSwKICAgIGluY2x1ZGVHYXNQaGFzZTogdHJ1ZSwKICAgIGdyaWRQb2ludHNOOiAyNjAKICB9KTsKICBjb25zdCB2YWx1ZSA9IHsKICAgIHNjaGVtYTogQ09TTUlDX1FVQU5UVU1fUEVFUl9UQVNLX1NDSEVNQSwKICAgIGtpbmQ6ICdtYXRlcmlhbC5yZXNvbHZlLWVsZW1lbnQnLAogICAgYXRvbWljTnVtYmVyWiwKICAgIHN5bWJvbDogcHJvcHMuc3ltYm9sLAogICAgZnVuY3Rpb25hbCwKICAgIGJvbmRpbmdDbGFzczogcHJvcHMuYm9uZGluZ0NsYXNzLAogICAgc3RhbmRhcmRQaGFzZUF0Mjk4SzogcHJvcHMuc3RhbmRhcmRQaGFzZUF0Mjk4SywKICAgIG1lbHRpbmdQb2ludEs6IE1hdGgucm91bmQocHJvcHMubWVsdGluZ1BvaW50SyA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5tZWx0aW5nUG9pbnRLID8/IDApLAogICAgYm9pbGluZ1BvaW50SzogTWF0aC5yb3VuZChwcm9wcy5ib2lsaW5nUG9pbnRLID8/IHByb3BzLnZkd0dhc1Byb3BlcnRpZXM/LmJvaWxpbmdQb2ludEsgPz8gMCksCiAgICBkZW5zaXR5S2dQZXJNMzogTWF0aC5yb3VuZChwcm9wcy5kZW5zaXR5S2dQZXJNMyA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5jb25kZW5zZWREZW5zaXR5S2dQZXJNMyA/PyAwKSwKICAgIGJ1bGtNb2R1bHVzR1BhOiBOdW1iZXIoKCgocHJvcHMuYnVsa01vZHVsdXNQYSA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5idWxrTW9kdWx1c1BhID8/IDApIC8gMWU5KSkudG9GaXhlZCgyKSksCiAgICBjbG9zdXJlQmFja2VkOiB0cnVlLAogICAgc2NpZW50aWZpY1ZhbGlkYXRpb246IGZhbHNlCiAgfTsKICByZXR1cm4gewogICAgdmFsdWUsCiAgICBjb21taXREZWx0YTogewogICAgICB0YXNrSWQ6IGBjcS1wZWVyOmVsZW1lbnQ6JHthdG9taWNOdW1iZXJafToke2Z1bmN0aW9uYWx9YCwKICAgICAgc2NvcGU6ICdjb3NtaWMtcXVhbnR1bS1wZWVyLW1lc2gnLAogICAgICBwYXlsb2FkOiB2YWx1ZQogICAgfQogIH07Cn0K`,``+import.meta.url).href,n=null,o=null;if(a===`observer`){o=x({relayUrl:r,roomId:i,peerId:e,enableWebRtc:!1});let t=new Set,a=0,s=null;o.onMessage(e=>{a+=1,s=e?.type||null,e?.from&&t.add(e.from),e?.type===`presence`&&e?.alive===!1&&e?.from&&t.delete(e.from),e?.type===`peer-disconnect`&&e?.peerId&&t.delete(e.peerId),Bn.remotePeers=t.size,Bn.witnessedMessages=a,Bn.lastWitnessedType=s}),n={getStatus:()=>({connected:o.isConnected(),remotePeerCount:t.size,remotePeerIds:[...t],quorumReady:!1,witnessedMessages:a,lastWitnessedType:s}),async stop(){o.close()}}}else{let a=y({relayUrl:r,roomId:i,peerId:e,enableWebRtc:!1,taskModuleUrl:t,announceIntervalMs:120,staleMs:12e3,timeoutMs:3e4});o=a.transport,n={mesh:a,getStatus:()=>a.getStatus(),getActiveRequester:()=>a.getActiveRequester(),async stop(){a.stop()}}}Rn={transport:o,handle:n,peerId:e,role:a,stop:()=>n?.stop?.()};let s=n.getStatus()||{};Bn={connected:!0,role:a,relayUrl:r,roomId:i,peerId:e,remotePeers:s.remotePeerCount??0,remotePeerIds:[...s.remotePeerIds||[]],quorumReady:!!s.quorumReady,witnessedMessages:s.witnessedMessages??0,lastWitnessedType:s.lastWitnessedType??null,dispatches:0,lastResult:null,error:null}}catch(e){Bn={...Bn,connected:!1,relayUrl:r,roomId:i,role:a,error:e instanceof Error?e.message:String(e)}}return Er()}function Er(){let e=Rn?.handle?.getStatus?.();return{...Bn,connected:e?!!e.connected:Bn.connected,remotePeers:e?e.remotePeerCount:Bn.remotePeers,remotePeerIds:e?[...e.remotePeerIds||[]]:Bn.remotePeerIds||[],quorumReady:e?!!e.quorumReady:Bn.quorumReady,witnessedMessages:e?.witnessedMessages??Bn.witnessedMessages??0,lastWitnessedType:e?.lastWitnessedType??Bn.lastWitnessedType??null}}async function Dr(e=wn){let t=Rn?.handle?.getActiveRequester?.();if(!t||typeof t.submitWithProvenance!=`function`){let e=Error(`Peer mesh 2-of-2 quorum requester is not ready (requires >= 2 live remote responders)`);throw e.code=`ERR_CLIENT_PEER_QUORUM_UNAVAILABLE`,e}let n=`uv-quorum-${Date.now()}-${Bn.dispatches+1}`,r=await t.submitWithProvenance(n,{service:`cosmic-quantum-material`,kind:`material.resolve-element`,payload:{atomicNumberZ:e,functional:`pbe`}});return Bn.dispatches+=1,Bn.lastResult=r,r}let Or=new Map;async function kr(e,t={}){if(e===0&&B||e===1&&Te||e===2&&(Re===`smbh-core`?Be:He)||e===3&&(W===`fusion`&&ft||(W===`pulsar`||W===`magnetar`)&&G&&Ft===W||W===`black-hole`&&Xe||W===`white-dwarf-tov`&&Lt||W===`nebular-mhd`&&Et||[`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`].includes(W)&&At&&Nt===W)||e===4&&zt||e===5&&vn||e===6&&jn||e===7&&Fn)return;let n=e===2?`2:${Re}`:String(e);if(Or.has(n))return Or.get(n);let r=(async()=>{e===0?await Un(t):e===1?await Wn(t):e===2?Re===`smbh-core`?await Gn():await qn(t):e===3?W===`fusion`?await vr(t):await Ur(W):e===4?await yr(t):e===5?await br(t):e===6?await xr(t):e===7&&await Sr(t)})();Or.set(n,r);try{await r}finally{Or.delete(n)}}function Ar(e){return ut[e]?(o=ut[e],!0):!1}function jr(e){a=Number(e)>>>0||1}function Mr(e){return Cn=e?{...e}:null,Cn}async function Nr(e){if(!e)return null;Cn={...e};let t=Math.max(1,Math.min(118,Math.trunc(Number(e.primaryZ)||14)));return await br({Z:t,phasePreset:e.phasePreset||`solid`,tempK:Number.isFinite(Number(e.tempK))?Number(e.tempK):null}),wn=t,e.moleculeKey&&or[e.moleculeKey]&&(An=e.moleculeKey),Nn=t,Cn}function Pr(e){Sn=!!e,vn&&typeof vn.setGravity==`function`&&vn.setGravity(Sn)}function Fr(e){xn=Math.max(15,Math.round(Number(e)||300))}function Ir(e){Ut=!!e}function Lr(e){St=Math.max(.4,Math.min(8,Number(e)||2))}async function Rr(e,{alignActiveLevel:t=null}={}){if(typeof e==`string`){let t=R.find(t=>t.id===e)||R[3];f=t.id,p=pe({redshiftZ:t.redshiftZ,localSystemAgeGyr:t.localSystemAgeGyr,localStarMassSolar:1})}else e&&typeof e==`object`&&(f=e.id||`custom`,p=pe(e));return m=Ct({cosmicEpoch:p,regionPosMpc:de[0]?.posMpc||[0,0,0],localOverdensity:m.localOverdensity||1.15,seed:a}),g||(S=Tt(wt({cosmicEpoch:p,galaxyEnv:m,starPosGal:h.posGal,popTag:h.popTag,starIndex:h.starIndex,seed:a+409>>>0}),{seedOverride:a+409>>>0})),t===0?p.eraId===`recombination`?await zr(`cmb`):p.eraId===`cosmic-dawn`?await zr(`reionization`):p.eraId===`far-future`?await zr(`cluster-merger`):await zr(`web`):t===1?await Wn({galaxyEnvOverride:m}):t===2?p.eraId===`quasar-peak`?await Br(`quasar-jet`):p.eraId===`cosmic-dawn`?await Br(`formation`):p.eraId===`far-future`?await Br(`red-giant`):(await qn(),await Br(`nbody`)):t===3?p.eraId===`far-future`?await Ur(`planetary-nebula`):p.eraId===`cosmic-dawn`?await Ur(`h2-pillars`):p.eraId===`quasar-peak`?await Ur(`nebular-mhd`):await Ur(`fusion`):t===4&&(p.eraId===`quasar-peak`?await Wr(`magma-ocean`):await Wr(`standard`)),p}async function zr(e){ee=[`web`,`cmb`,`reionization`,`cluster-merger`].includes(e)?e:`web`,ee===`web`?B||await Un():await ur(ee)}async function Br(e){U=[`nbody`,`formation`,`roche-rings`,`giant-impact`,`red-giant`,`catastrophic-shatter`,`tde`,`comet-tails`,`hot-jupiter`,`quasar-jet`,`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(e)?e:`nbody`,U===`formation`?Ke||await er():U===`quasar-jet`?Xe||await dr():U===`xray-binary`||U===`bns-kilonova`||U===`type-ia`||U===`bbh-merger`?(!et||nt!==U)&&await fr(U):U===`comet-tails`||U===`hot-jupiter`?(!rt||ot!==U)&&await pr(U):[`roche-rings`,`giant-impact`,`red-giant`,`catastrophic-shatter`,`tde`].includes(U)?(!st||dt!==U)&&await Z(U):He||await qn()}async function Vr(e){$e=Math.max(-.99,Math.min(.99,Number(e)??.94)),Xe&&await dr({spinA:$e})}function Hr(e){Ye=!!e,Ke?.setEnableGasDrag?.(Ye)}async function Ur(e){W=[`fusion`,`nebular-mhd`,`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`,`pulsar`,`magnetar`,`white-dwarf-tov`,`black-hole`].includes(e)?e:`fusion`,W===`nebular-mhd`?Et||await tr():[`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`].includes(W)?(!At||Nt!==W)&&await hr(W):W===`pulsar`||W===`magnetar`?(!G||Ft!==W)&&await gr(W):W===`white-dwarf-tov`?Lt||await Q():W===`black-hole`?Xe||await dr({spinA:.94}):ft||await vr()}async function Wr(t){if(Rt=[`standard`,`magma-ocean`,`cryo-plumes`,`eyeball-locked`,`rogue`].includes(t)?t:`standard`,Rt===`cryo-plumes`)Xt||await _r();else if(Rt===`eyeball-locked`||Rt===`rogue`){let t=Kt;Kt=null,t&&t.dispose();let n=C()[Vt]||Qe[3],r=te({...n,surfacePressurePa:Math.max(1e5,Number(n.surfacePressurePa)||101300),volatileMassFrac:Math.max(.03,Number(n.volatileMassFrac)||.03),particulateMassFrac:Math.max(.008,Number(n.particulateMassFrac)||.008),rotationOmegaRadS:Rt===`eyeball-locked`?11e-6:82e-6,coreRadiusNorm:.54,coreConductivitySm:12e5},zt||{coreRadiusFraction:.54,centralPressurePa:36e10},{solarDistanceAu:Rt===`rogue`?500:.14,coreConductivitySm:12e5});Gt=r;let i=me(e,{width:o.id===`low`?64:128,height:o.id===`low`?32:64,bodyParams:r,enableTriboelectric:Yt,seed:(a^(Rt===`rogue`?460302:243186193))>>>0,label:`ulg-universes-atmo-${Rt}`});for(let e=0;e<4;e+=1)qt=await i.step({dtSim:.048,substeps:2,sunDir:Rt===`eyeball-locked`?[1,0,0]:[0,1,0],readTelemetry:e===3});Kt=i}else Rt===`standard`&&await yr({bodyIndex:Vt})}async function Gr(e){kt=Math.max(0,Math.min(1.5,Number(e)??.58)),Et&&await tr({initialB0:kt})}function Kr(e){ze=!!e}async function qr(e){Me=Math.max(0,Math.min(1.2,Number(e)||0));let t=ke,n=Te;if(t&&n){t.resetSeedB(Me);let e=await t.step({particleBuffer:n.getResidentBuffer(),particleCount:n.count,dt:.045,substeps:Me>1e-6?8:1,readTelemetry:!0,readBField:!0});t===ke&&(Ae=e,je=t.buildStreamlines({worldScale:1,alpha:.44}))}}async function Jr(e){gt=Math.max(0,Math.min(1.2,Number(e)||0));let t=pt,n=ft;if(t&&n){t.resetSeedB(gt);let e=await t.step({particleBuffer:n.getResidentBuffer(),particleCount:n.count,dt:.042,substeps:gt>1e-6?8:1,readTelemetry:!0,readBField:!0});t===pt&&(mt=e,ht=t.buildStreamlines({worldScale:1,alpha:.42}))}}function Yr(e){Array.isArray(e)&&e.length>=3&&de.length>0&&(de[0]={...de[0],posMpc:[Number(e[0])||0,Number(e[1])||0,Number(e[2])||0]})}function Xr(e){Yt=!!e,Kt?.setEnableTriboelectric?.(Yt)}async function Zr(){if(dn&&=(clearTimeout(dn),null),!K||!ln||!un)return!1;let e=K.getCraterStamps?.()||[];un=!1;try{return await Qt.saveTile(ln,e),!0}catch{return!1}}function Qr(){dn||=setTimeout(()=>{dn=null,Zr()},1200)}let $r=0;async function ei({bodyIndex:t=Vt,customBodySpec:n=null,planetaryModeOverride:r=null,landingSite:i=null,restoreCheckpoint:s=null,initialVehicle:c=`ufo`,onCraterStamp:l=null}={}){let u=++$r;if(await Zr(),u!==$r)return null;let d=null,f=t,m=Gt;if(n&&typeof n==`object`)d={isMinorBody:!0,...n},pn=d,m={surfacePressurePa:d.surfacePressurePa||0,volatileMassFrac:d.isComet?.55:.02,particulateMassFrac:0};else{pn=null;let e=C();if(typeof f==`string`){let t=e.findIndex(e=>e.id===f);if(t>=0&&!e[t].isStar)f=t;else{let t=Qe.findIndex(e=>e.id===f);t>0?(g=!0,await qn({solReference:!0}),e=C(),f=t):f=Vt}}if(f=Math.max(0,Math.min(e.length-1,Math.trunc(Number(f)??Vt))),e[f]?.isStar||f===0){let t=w(e);t>0&&(f=t)}Ge=f,r&&(Rt=r),(!zt||Vt!==f)&&await yr({bodyIndex:f}),d=e[f]||Qe[3],m=Gt}let h=Jt({universeSeed:a,systemId:g?`sol`:S?.systemName||p?.id||`proc`,bodyId:d.id||`body-${f}`}),_=await Qt.loadTile(h),v=Array.isArray(_)?_:Array.isArray(_?.stamps)?_.stamps:[];ln=h,un=!1,tn=i||null;let y=Ee(e,{bodySpec:d,planetaryResult:zt,planetaryAtmoState:m,planetaryMode:pn?`standard`:Rt,landingSite:tn,gridN:o.id===`low`?81:129,cellSizeM:9.5,particleCount:o.id===`low`?1024:2048,seed:(a^(Number(f)||13)*7919+(d.id?.length||5)*997+84212430)>>>0,initialVehicle:c,initialCheckpoint:s,initialCraterStamps:v,onCraterStamp:e=>{un=!0,Qr(),typeof l==`function`&&l(e,h)},label:`ulg-universes-surface-${d.id}`});if(_n={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0},nn=await y.step({dt:.016,controls:_n,readTelemetry:!1}),nn=await y.step({dt:.016,controls:_n,readTelemetry:!0}),u!==$r){try{y.dispose()}catch{}return null}let b=K;return K=y,en=!0,b&&b.dispose(),nn}function ti(){$r+=1,Zr(),en=!1,pn=null,_n={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0};let e=K;K=null,nn=null,e&&e.dispose()}function ni(e){return K?K.setActiveVehicle(e):null}function ri(e){return K?K.setUfoAltitudeKm?.(e)??null:null}function ii(e){return K?K.setCameraMode(e):null}function ai(e={}){_n={..._n,...e}}function oi(e,t){K?.addLookDelta?.(e,t)}function si(e){return K?.adjustChaseDistance?.(e)??1}function ci(e,t){let n=10**t,r=C(),i=r[Ge]||r[w(r)]||Qe[3],a=e===2&&[`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(U),o=e===2&&[`roche-rings`,`giant-impact`,`red-giant`,`tde`].includes(U),s=e===2&&[`comet-tails`,`hot-jupiter`].includes(U),c=e===3&&[`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`].includes(W),l=e===3&&[`pulsar`,`magnetar`].includes(W);return _e({viewSpanM:n,redshiftZ:p.redshiftZ,comovingBoxMpc:e===0?260:0,omegaM:e===0?.315:0,baryonFraction:e===0&&ee!==`web`?.157:0,clusterMassSolar:e===0&&ee===`cluster-merger`?0x5543df729c000:0,galacticBodyCount:e===1?Te?.count||32768:0,nebulaCloudMass:e===3&&W===`nebular-mhd`?22:0,magneticFieldStrength:e===3&&W===`nebular-mhd`?kt:e===2&&U===`quasar-jet`?1.15:0,ionizedGasPresent:e===3&&(W===`nebular-mhd`||c),starMassSolar:+(e===2&&U===`formation`),diskSolidMassEarth:e===2&&U===`formation`?45:0,gravitatingBodyCount:e===2||e===4?a?2:He?.totalCount||15:0,solidBodyCount:e===2&&(U===`formation`||o)?18:0,solidParticleCount:e===2&&U===`formation`?90:0,coreTempK:e===3&&W===`fusion`?vt?.coreTempK||15e6:0,bodyMassKg:e===4?i.massSolar*198847e25:e===3&&W===`fusion`?198847e25:0,bodyRadiusM:e===4?i.radiusKm*1e3:0,surfacePressurePa:e===4&&Gt?.surfacePressurePa||0,volatileMassFrac:e===4&&Gt?.volatileMassFrac||0,particulateMassFrac:e===4&&Gt?.particulateMassFrac||0,dynamo:e===4&&Gt?.dynamo||null,compactnessGMOverRc2:e===2&&(U===`quasar-jet`||a)||e===3&&(l||W===`white-dwarf-tov`)?.25:0,centralRelativisticMassSolar:e===2&&U===`quasar-jet`?45e7:a?10:0,accretionRateEddington:e===2&&(U===`quasar-jet`||U===`xray-binary`)?.55:0,kerrSpinA:e===2&&U===`quasar-jet`?$e:0,surfaceBFieldTesla:l?W===`magnetar`?165e9:42e7:0,compactRadiusM:l?12e3:0,spinOmegaRadS:l?W===`magnetar`?45:740:0,maxPairwiseVOverC:a?.22:0,rocheOverflowPresent:e===2&&U===`xray-binary`,uvFluxNorm:s||c?1.5:0,xuvFluxWPerM2:e===2&&U===`hot-jupiter`?180:0,surfaceTempK:e===2&&U===`comet-tails`?260:0,sublimationTempK:e===2&&U===`comet-tails`?170:1e9,maxTidalStrain:o||e===4&&Rt===`cryo-plumes`?.85:0,maxSurfaceTempK:e===4&&Rt===`magma-ocean`||e===2&&(U===`giant-impact`||U===`red-giant`)?2400:0,surfaceViewActive:en,dynamoSeedB0:e===1?Me:e===3&&W===`fusion`?gt:0,stellarCoreActive:e===3&&W===`fusion`,centralMassSolar:e===3&&W===`fusion`?ft?.totalMassSolar||1:0,hasSolidCrust:en?K?.env?.hasSolidCrust!==!1:i.kind!==2&&i.kind!==0,hasLiquidOcean:en?!!K?.env?.hasLiquidOcean:!!i.hasOcean,hasExoticOcean:en?!!K?.env?.hasExoticOcean:!1,seaIceFrac:en&&Number(sn?.seaIceFrac)||0,surfaceDeformationActive:en&&!!(K?.getTelemetry?.()?.mpmActive||(K?.getTelemetry?.()?.cratersCarved||0)>0||(K?.getTelemetry?.()?.aliveBoulders||0)>0),mpmActive:en&&!!K?.getTelemetry?.()?.mpmActive,craterCount:en&&Number(K?.getTelemetry?.()?.cratersCarved)||0,boulderCount:en&&Number(K?.getTelemetry?.()?.aliveBoulders)||0,biosphereViability:en?Number(K?.xenobiology?.biosphereViability)||0:e===4&&Number(i.surfacePressurePa)>=500&&Number(i.tempK)>=80&&Number(i.tempK)<=750?.5:0,pressurePa:en?Number(K?.env?.pressurePa)||0:e===4&&Number(i.surfacePressurePa)||0,tempK:en?Number(K?.env?.tempK)||0:e===4&&Number(i.tempK)||0,isCryoMoon:e===4&&(Rt===`cryo-plumes`||!!K?.env?.isCryoMoon),isMagmaOcean:e===4&&(Rt===`magma-ocean`||!!K?.env?.isMagmaOcean)})}function li(e,t=null){Re=e===`smbh-core`?`smbh-core`:`solar-system`,t&&(Le=[...t])}function ui(e){let t=C();if(typeof e==`string`){let n=t.findIndex(t=>t.id===e);if(n>=0)return Ge=n,Ge;let r=Qe.findIndex(t=>t.id===e);if(r>=0)return g=!0,Ge=r,Ge}else Number.isFinite(Number(e))&&(Ge=Math.max(0,Math.min(t.length-1,Math.trunc(Number(e)))));return Ge}function di(e,t=!0){let n=Math.max(1,Math.min(118,Math.trunc(Number(e)||26)));return u.get(`${n}:std:${+!!t}:1`)||u.get(`${n}:std:${+!!t}:0`)||u.get(`${n}:std:1:1`)||u.get(`${n}:std:1:0`)||null}function fi(){if(!He)return[0,0,0];let e=He.catalog||C(),t=Math.min(He.massiveCount||0,e.length),n=0,r=0,i=0,a=0;for(let o=0;o<t;o+=1){let t=Math.max(0,Number(e[o]?.massSolar)||0);if(t<=0)continue;let s=He.getMassiveBodyState64(o);n+=s.posAu[0]*t,r+=s.posAu[1]*t,i+=s.posAu[2]*t,a+=t}return a<=0?[0,0,0]:[n/a,r/a,i/a]}function pi(e=12.6,t=null){if(!He)return{originAu:[0,0,0],barycenterAu:[0,0,0],focusPosAu:[0,0,0],orbitBlend:0,frameMode:`barycenter`};let n=He.catalog||C(),r=t??Ge,i=Math.max(0,Math.min(n.length-1,r)),a=!!n[i]?.isStar||i===0,o=He.getMassiveBodyState64(i),s=fi(),c=a?10.1:9.45,l=a?9.4:8.65,u=0;if(en||e<=l)u=1;else if(e<c){let t=(c-e)/(c-l);u=t*t*(3-2*t)}let d=u<=0?s:u>=1?o.posAu:[s[0]+(o.posAu[0]-s[0])*u,s[1]+(o.posAu[1]-s[1])*u,s[2]+(o.posAu[2]-s[2])*u],f=u<=0?`barycenter`:u>=1?`body-orbit`:`orbit-transition`;return{originAu:d,barycenterAu:s,focusPosAu:o.posAu,orbitBlend:u,frameMode:f}}function mi(e,t={}){if(e===0){if(ee===`cmb`){let e=xe;return[{id:`cmb-recombination`,level:0,name:`CMB Last Scattering Surface (z = 1100)`,subtitle:`t = 380 kyr · T_CMB = ${(e?.cmbTempK||3001).toFixed(0)} K · Eisenstein–Hu BAO r_s ≈ 147 Mpc`,pos:[0,0,0],radius:4.5,tempK:e?.cmbTempK||3001,massLabel:`ΔT/T acoustic`,composition:`H⁺/e⁻ → Neutral H (Peebles Recombination) · Primordial He 25%`,nextLevel:1}]}if(ee===`reionization`)return[{id:`cosmic-reionization`,level:0,name:`Cosmic Dawn & Reionization Bubbles (z = 10)`,subtitle:`t = 470 Myr · ⟨x_HII⟩ = ${((xe?.meanIonizedFraction||.2)*100).toFixed(1)}% · Pop III UV Percolation`,pos:[0,0,0],radius:4,tempK:2e4,massLabel:`Z ≈ 10⁻⁴ Z☉`,composition:`Neutral H I Web + Photoionized H II Bubbles · Pop III Halos`,nextLevel:1}];if(ee===`cluster-merger`){let e=xe;return[{id:`bullet-cluster-merger`,level:0,name:`Galaxy Cluster Merger & Gravitational Lensing`,subtitle:`ICM T_max = ${((e?.maxGasTempK||5e7)/1e6).toFixed(1)} MK · Lensing κ_max = ${(e?.maxLensingKappa||.5).toFixed(2)}`,pos:[0,0,0],radius:4,tempK:6e7,massLabel:`1.5×10¹⁵ M☉`,composition:`Shock-Heated X-Ray ICM Plasma + Offset Dark-Matter Lensing Halos`,nextLevel:1}]}let e=t.cosmoScale??.1,n=t.cosmoOffset??[0,0,0];return de.map(t=>({...t,pos:[(t.posMpc[0]-n[0])*e,(t.posMpc[1]-n[1])*e,(t.posMpc[2]-n[2])*e]}))}if(e===1){let e=t.galaxyScale??1,n=t.galaxyOffset??[0,0,0];return Ie.map(t=>({...t,pos:[(t.pos[0]-n[0])*e,(t.pos[1]-n[1])*e,(t.pos[2]-n[2])*e]}))}if(e===2){if(Re===`smbh-core`)return[{id:`smbh-event-horizon`,level:2,name:`Sagittarius-ULG* (4.3×10⁶ M☉ SMBH)`,subtitle:`Schwarzschild Event Horizon · Relativistic Doppler Disk · Live S-Stars`,pos:[0,0,0],radius:1,tempK:28e3,massLabel:`4.3×10⁶ M☉`,composition:`Kerr-Schwarzschild Metric · Accreting H⁺/He²⁺ Plasma`,nextLevel:3}];if(U!==`nbody`&&U!==`formation`){let e={"quasar-jet":{name:`Quasar / Blazar Kerr AGN (a* = ${$e.toFixed(2)})`,subtitle:`4.5×10⁸ M☉ Kerr BH · Blandford–Znajek Jets · Live Camera Doppler Beaming (Γ = ${(Ze?.maxLorentzGamma||5.5).toFixed(1)})`,tempK:45e3,composition:`Novikov–Thorne Plasma Disk · Relativistic e±/p⁺ BZ Jets · Dusty Torus`},"xray-binary":{name:`Microquasar X-Ray Binary (Roche L1 Overflow)`,subtitle:`11 M☉ BH + 1.8 M☉ Donor · Eggleton R_L Stream → Hot X-Ray Accretion Disk`,tempK:28e3,composition:`H/He Roche-Lobe Stream · Comptonized X-Ray Corona`},"bns-kilonova":{name:`Binary Neutron Star Merger & Kilonova`,subtitle:`1.45 + 1.32 M☉ · 2.5PN GW Chirp · ${tt?.merged?`r-Process Lanthanide Kilonova Burst!`:`Relativistic Inspiral`}`,tempK:12e3,composition:`Low-Y_e Lanthanide r-Process Ejecta (Au/Pt/U) + Blue Polar Wind`},"type-ia":{name:`Type Ia Thermonuclear Supernova (M_Ch = 1.44 M☉)`,subtitle:`C/O White Dwarf Runaway ¹²C+¹²C Detonation · Zero Central Remnant · ⁵⁶Ni Glow`,tempK:18e3,composition:`⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe · Si / S / Ca Detonation Shell`},"bbh-merger":{name:`Binary Black Hole 2.5PN GW Inspiral & Ringdown`,subtitle:`36 + 29 M☉ Kerr BHs · Quadrupole Strain Chirp h_+(t) & Gravitational Lensing`,tempK:2e4,composition:`Vacuum Kerr Spacetime · Gravitational Radiation Flux`},"comet-tails":{name:`Active Dual-Tail Comet (Clausius–Clapeyron)`,subtitle:`Curved Radiation-Pressure Dust Tail (β) + Straight Solar-Wind CO⁺ Ion Tail`,tempK:260,composition:`H₂O / CO / CO₂ Sublimating Ice Nucleus · Silicate Dust · CO⁺ Plasma`},"hot-jupiter":{name:`Hot Jupiter XUV Atmospheric Photoevaporation`,subtitle:`Energy-Limited XUV Escape Tail (Ṁ = ε π R_p³ F_XUV / G M_p)`,tempK:1850,composition:`Ionized H/He Escaping Cometary Envelope · Silicate Haze`},"roche-rings":{name:`Roche-Limit Tidal Disruption & Shepherd-Moon Rings`,subtitle:`Cohesive Rubble-Pile Rupture (${((ct?.rupturedFraction||.7)*100).toFixed(0)}%) + Resonant Ring Gap`,tempK:140,composition:`Water-Ice & Silicate Ring Particles · Embedded Shepherd Moon`},"giant-impact":{name:`Giant Moon-Forming Impact & Hadean Disk`,subtitle:`Incandescent Magma-Ocean Proto-Earth + Molten Silicate Circumplanetary Disk`,tempK:2800,composition:`Molten Fe/MgSiO₃ Silicate Vapor & Re-Accreting Lunar Embryo Disk`},"red-giant":{name:`Red-Giant Branch Engulfment (+5 Gyr)`,subtitle:`Bloated Convective RGB Envelope · Aerodynamic Common-Envelope Drag on Inner Worlds`,tempK:3400,composition:`Convective H/He Envelope · Vaporizing Inner Rocky Orbits`},"catastrophic-shatter":{name:`Catastrophic Shatter — ${gn||`Disrupted Body`}`,subtitle:`Binding Energy Exceeded (E > 0.85 U_bind) · Incandescent Molten-Core & Crustal Debris Field`,tempK:3800,composition:`Vaporized Fe-Ni Core Plasma · Ballistic Silicate & Volatile Fragments`},tde:{name:`Tidal Disruption Event (TDE · SMBH Spaghettification)`,subtitle:`Paczyński–Wiita Apsidal Precession · Super-Eddington Fallback Shock Disk + Unbound Hyperbolic Tail`,tempK:14e5,composition:`Tidally Shredded H/He Stellar Stream · Relativistic Self-Intersecting Accretion Flare`}},t=e[U]||e[`quasar-jet`];return[{id:`l2-${U}`,level:2,name:t.name,subtitle:t.subtitle,pos:[0,0,0],radius:1.5,tempK:t.tempK,composition:t.composition,nextLevel:3}]}if(!He)return[];let e=C(),n=pi(t.solarSpanLog10M??12.6),r=t.solarScaleAuToWorld??1;return e.map((e,t)=>{let i=He.getMassiveBodyState64(t),a=(i.posAu[0]-n.originAu[0])*r,o=(i.posAu[1]-n.originAu[1])*r,s=(i.posAu[2]-n.originAu[2])*r,c=!!e.isStar||t===0;return{id:e.id,level:2,bodyIndex:t,spec:e,name:e.name,subtitle:e.subtitle,pos:[a,o,s],radius:Math.max(1e-7,i.radiusAu*r),radiusKm:e.radiusKm,tempK:e.tempK,massLabel:c?`${e.massSolar.toFixed(2)} M☉`:`${(e.massSolar/30034896e-13).toFixed(e.massSolar>1e-5?1:3)} M⊕`,composition:e.composition,nextLevel:c?3:4}})}if(e===3){if(W!==`fusion`){let e={"nebular-mhd":{name:`3D Resistive MHD Nebular Collapse & Jets`,subtitle:`∂B/∂t = ∇×(v×B) + η∇²B − ∇ψ · B₀ = ${kt.toFixed(2)} · Helical J×B Outflow`,tempK:6500,composition:`Magnetized H₂/Dust Molecular Cloud · Helical B-Field Towers`},"h2-pillars":{name:`H II Star-Forming Pillars (Strömgren Ionization)`,subtitle:`Photoevaporative Rocket Ablation · Stratified [O III] / Hα / [S II] Emission`,tempK:11e3,composition:`Ionized H⁺ (Hα) · Doubly Ionized O²⁺ ([O III]) · Shielded Dense Dust ([S II])`},"planetary-nebula":{name:`Bipolar Planetary Nebula & Hot White Dwarf`,subtitle:`Fast Post-AGB Wind Sweeping Dusty Envelope · 95,000 K Central C/O White Dwarf`,tempK:14500,composition:`Inner [O III] Teal Cavity · Outer Hα / [N II] Crimson Shell · C/O Core`},"snr-pwn":{name:`Supernova Remnant & Crab Pulsar Wind Nebula`,subtitle:`Sedov–Taylor Expanding Blastwave + Relativistic Synchrotron Filaments`,tempK:22e3,composition:`Shocked O/Si/Fe Ejecta · Inner e± Synchrotron PWN · Central NS`},"reflection-nebula":{name:`Reflection Nebula (M45 Pleiades / Iris NGC 7023)`,subtitle:`Mie / Rayleigh Forward-Scattered Sapphire Dust Veils (I ∝ λ⁻⁴) Illuminated by Hot B-Stars`,tempK:13500,composition:`Sub-Micron Silicate & PAH Dust Sheets · Embedded Young B-Type Stars`},"wr-bubble":{name:`Wolf–Rayet / Eta Carinae Bipolar Homunculus`,subtitle:`Near-Eddington Continuum-Driven Fast Wind Inflating Twin Dusty Lobes & Equatorial Skirt`,tempK:36e3,composition:`N-Enriched LBV/WR Ejecta · Hot C/O Dust Shells · Shocked Equatorial Torus`},pulsar:{name:`Millisecond Pulsar Oblique Magnetosphere`,subtitle:`Spitkovsky Force-Free Dipole (B = 4.2×10⁸ T, P = 8.5 ms) · Twin Lighthouse Beams`,tempK:32e3,composition:`Neutron-Degenerate Core · e± Pair-Plasma Open Polar Caps`},magnetar:{name:`Magnetar Crustal-Yield Giant Flare`,subtitle:`B = 1.65×10¹¹ T (1.65×10¹⁵ G) · Hall-Drift Twist · ${Pt?.flareCount||0} Unscripted Starquakes`,tempK:48e3,composition:`Superconducting Proton/Neutron Interior · Sheared Fe Crust · Reconnection Fireball`},"white-dwarf-tov":{name:`GR TOV Unified Degenerate EOS (WD → NS → BH)`,subtitle:`Live Batched WebGPU RK4 Tolman–Oppenheimer–Volkoff Mass–Radius Sequence`,tempK:26e3,composition:`Relativistic Fermi–Dirac Electron Degeneracy (M_Ch ≈ 1.44 M☉) → Nuclear Saturation`}},t=e[W]||e[`nebular-mhd`];return[{id:`l3-${W}`,level:3,name:t.name,subtitle:t.subtitle,pos:[0,0,0],radius:1.8,tempK:t.tempK,composition:t.composition,nextLevel:4}]}let e=ge(),t=ft?.solver===`webgpu-3d-mls-mpm-nuclear-fusion`,n=Number(vt?.convectiveRmsVel||0);return[{id:`stellar-fusion-core`,level:3,name:t?`3D GPU MLS-MPM Fusion Star`:`Thermonuclear Fusion Core`,subtitle:t?`24³ MLS-MPM Plasma + Gate 1 pp/CNO/3α · Q_pp = ${e.ppThermalMeV.toFixed(2)} MeV · v_conv = ${n.toFixed(2)}`:`Gate 1 pp/CNO/3α Burn · Q_pp = ${e.ppThermalMeV.toFixed(2)} MeV`,pos:[0,0,0],radius:1.8,tempK:vt?.coreTempK||15e6,massLabel:`${(ft?.totalMassSolar||1).toFixed(2)} M☉`,composition:`H ${((vt?.meanXH??.72)*100).toFixed(1)}% · He ${((vt?.meanXHe??.26)*100).toFixed(1)}% · Metals ${((vt?.meanXZ??.02)*100).toFixed(1)}%`,nextLevel:4}]}if(e===4){if(Rt!==`standard`){let e={"magma-ocean":{name:`Hadean Magma Ocean World`,subtitle:`Incandescent Molten Silicate Crust (T_surf ≈ 2,400 K) · Outgassing Steam Atmosphere`,tempK:2400,composition:`Molten MgSiO₃ Peridotite · Fe-Ni Core Segregation · H₂O/CO₂ Steam`},"cryo-plumes":{name:`Cryovolcanic Icy Moon (Viscoelastic Tidal Plumes)`,subtitle:`Peale–Cassen–Reynolds Tidal Heating Driving Supersonic South-Polar H₂O Geysers`,tempK:95,composition:`Water-Ice Lithosphere · Subsurface Brine Ocean · Supersonic H₂O Plumes`},"eyeball-locked":{name:`Tidally Locked Eyeball Exoplanet`,subtitle:`Synchronous 1:1 Spin-Orbit Lock · Substellar Ocean Eye + Terminator Super-Rotation`,tempK:295,composition:`Substellar Liquid Ocean · Terminator Convection Belt · Frozen Nightside`},rogue:{name:`Rogue Free-Floating Dark World`,subtitle:`Zero Stellar Insolation · Geothermal Internal Heat + Dark-Sky Triboelectric Storms`,tempK:65,composition:`Dense H₂/N₂ Geothermal Atmosphere · Deep Mantle Radiogenic Heating`}}[Rt];if(e)return[{id:`l4-${Rt}`,level:4,name:e.name,subtitle:e.subtitle,pos:[0,0,0],radius:1.8,sampleZ:26,rCoreNorm:Wt[0]?.rCoreNorm??.54,rMantleNorm:.94,tempK:e.tempK,composition:e.composition,nextLevel:5}]}return Wt}if(e===5){let e=di(bn,!0)?.bundle,t=e?.symbol||`Fe`,n=Cn;return[{id:`md-lattice-atom`,level:5,name:n?`${n.name} · ${t} Lattice`:`${t} Representative Lattice`,subtitle:n?`Sampled from ${n.worldName} (${n.locationTag}) · ${e?.mechanical?.crystalStructure||`crystal`} · ${vn?.atomCount||0} GPU atoms`:`${e?.mechanical?.crystalStructure||`crystal`} · ${vn?.atomCount||0} live GPU atoms`,pos:[0,0,0],radius:1.5,sampleZ:bn,tempK:yn?.temperatureK||xn,massLabel:`m = ${(e?.nuclear?.atomicMassU||55.8).toFixed(2)} u`,composition:n?`Compounds: ${n.compounds.slice(0,3).map(e=>e.formula).join(` · `)} · Phase: ${yn?.emergentPhase||q}`:`Phase: ${yn?.emergentPhase||q} · ⟨Z⟩ = ${(yn?.meanCoordination||0).toFixed(2)}`,nextLevel:6}]}if(e===6){let e=di(wn,On)?.bundle,t=e?.symbol||`Fe`,n=`${Tn}${[`s`,`p`,`d`,`f`,`g`][En]||`d`} (m=${Dn})`,r=Number(e?.atomic?.totalEnergyHa);return[{id:`quantum-nucleus-core`,level:6,name:kn===`molecule`?`${or[An].formula} Molecule (RHF)`:`${t} (Z=${wn}) · ${n}`,subtitle:kn===`molecule`?`WebGPU STO-3G RHF · E = ${(Number(Mn?.totalEnergyHa)||0).toFixed(3)} Ha`:`4-Comp Dirac–KS (${On?`Relativistic ON`:`Non-Rel`}) · ${jn?.pointCount?.toLocaleString()||0} pts`,pos:[0,0,0],radius:1.2,sampleZ:wn,tempK:300,massLabel:Number.isFinite(r)?`E = ${r.toFixed(1)} Ha`:`—`,composition:`Z=${wn} · ${e?.atomic?.configurationString||t} · ${e?.electromagnetic?.magneticPhase||`—`}`,nextLevel:7}]}if(e===7){let e=Fn?.isotope?.split(`-`)[0]||`Z=${Nn}`,t=Number(Fn?.bindingPerNucleonMeV??8.79),n=Number(Fn?.chargeRadiusFm??3.7);return[{id:`nucleus-core`,level:7,name:`${Pn}${e} Atomic Nucleus`,subtitle:`Z=${Nn} protons, N=${Math.max(0,Pn-Nn)} neutrons · Woods–Saxon + Visscher TDSE`,pos:[0,0,0],radius:1.5,tempK:1e10,massLabel:`B/A = ${t.toFixed(3)} MeV`,composition:`Protons ${Nn} · Neutrons ${Math.max(0,Pn-Nn)} · R_c = ${n.toFixed(2)} fm`,nextLevel:0}]}return[]}function hi(){Hn=!0,wr();try{B?.destroy()}catch{}try{ye?.dispose()}catch{}try{Te?.dispose()}catch{}try{ke?.dispose()}catch{}try{Be?.dispose()}catch{}try{He?.dispose()}catch{}try{Ke?.dispose()}catch{}try{Xe?.dispose()}catch{}try{et?.dispose()}catch{}try{rt?.dispose()}catch{}try{st?.dispose()}catch{}try{ft?.dispose()}catch{}try{pt?.dispose()}catch{}try{Et?.dispose()}catch{}try{At?.dispose()}catch{}try{G?.dispose()}catch{}try{Kt?.dispose()}catch{}try{Xt?.dispose()}catch{}try{K?.dispose()}catch{}try{vn?.destroy()}catch{}try{jn?.pointsBuffer?.destroy()}catch{}try{In?.destroy()}catch{}}return Object.freeze({AU_METERS:Je,REAL_SOLAR_SYSTEM_CATALOG:Qe,MOLECULE_SPECS:or,COSMIC_EPOCH_PRESETS:R,get seed(){return a},get busy(){return Vn},get quality(){return o},get cosmicEpochId(){return f},get cosmicEpoch(){return p},get activeGalaxyEnv(){return m},get activeStarSite(){return h},get activeCausalSystem(){return S},get activeSampledMaterial(){return Cn},get useSolReference(){return g},getActiveSystemCatalog:C,getDefaultPlanetIndex:w,selectCausalStarSite:Xn,syncStellarRegimeForStar:X,sampleNewGalacticSector:Zn,setUseSolReference:Qn,deriveGalaxyEnvironmentFromCosmicContext:Ct,deriveStarSystemFromGalacticLocation:wt,synthesizeNebularPlanetarySystem:Tt,get cosmoMode(){return ee},get cosmoSession(){return B},get cosmoTelemetry(){return se},get cosmoBigBangMode(){return ve},get cosmoScaleFactorA(){return B?.getState?.()?.aScale??1},get cosmoFirstPk(){return ue},get cosmoTargets(){return de},get cosmoBaryonSession(){return ye},get cosmoBaryonTelemetry(){return xe},get galaxyEngine(){return Te},get galacticDynamoSession(){return ke},get galacticDynamoTelemetry(){return Ae},get galacticDynamoStreamlines(){return je},get galacticB0(){return Me},get galaxyPreset(){return Ne},get galaxyMetallicity(){return Pe},get galaxyFocusPos(){return Le},get galaxyBranch(){return Re},get showGalacticBField(){return ze},get smbhEngine(){return Be},get smbhBodies(){return Ve},get ismCoolingAnchors(){return Fe},get solarEngine(){return He},get solarMode(){return U},get protoplanetarySession(){return Ke},get protoplanetaryTelemetry(){return qe},get protoplanetaryGasDrag(){return Ye},get kerrJetSession(){return Xe},get kerrJetTelemetry(){return Ze},get kerrSpinA(){return $e},get relBinarySession(){return et},get relBinaryTelemetry(){return tt},get relBinaryMode(){return nt},get radWindL2Session(){return rt},get radWindL2Telemetry(){return it},get tidalRocheSession(){return st},get tidalRocheTelemetry(){return ct},get solarConservation0(){return Ue},get solarConservation(){return We},get focusedSolarBodyIndex(){return Ge},get stellarEngine(){return ft},get stellarDynamoSession(){return pt},get stellarDynamoTelemetry(){return mt},get stellarDynamoStreamlines(){return ht},get stellarB0(){return gt},get stellarMode(){return W},get nebulaMhdSession(){return Et},get nebulaMhdTelemetry(){return Dt},get nebulaMhdStreamlines(){return Ot},get nebulaB0(){return kt},get radWindL3Session(){return At},get radWindL3Telemetry(){return Mt},get magnetosphereSession(){return G},get magnetosphereTelemetry(){return Pt},get magnetosphereFieldLines(){return It},get tovCurve(){return Lt},get stellarPreset(){return _t},get stellarTelemetry(){return vt},get stellarNuclearNetwork(){return yt},get stellarLaneEmden(){return bt},get stellarTimeAccel(){return St},get planetaryMode(){return Rt},get planetaryResult(){return zt},get planetaryBodyIndex(){return Vt},get planetaryCutaway(){return Ut},get planetaryAtmoState(){return Gt},get planetaryAtmoSession(){return Kt},get planetaryAtmoTelemetry(){return qt},get planetaryTriboelectric(){return Yt},get cryoPlumeSession(){return Xt},get cryoPlumeTelemetry(){return Zt},get surfaceActive(){return en},get surfaceLandingSite(){return tn},get surfaceSession(){return K},get surfaceTelemetry(){return nn},get surfaceBodySpec(){return pn||C()[Vt]||null},get surfaceCraterTileKey(){return ln},get surfaceControls(){return _n},get surfaceTimeWarp(){return rn},get surfaceSimSec(){return an},get surfaceClimate(){return sn},get mdSession(){return vn},get mdTelemetry(){return yn},get mdElementZ(){return bn},get mdTempK(){return xn},get mdGravity(){return Sn},get mdPhasePreset(){return q},get mdRdfHistory(){return J},get quantumZ(){return wn},get quantumN(){return Tn},get quantumL(){return En},get quantumM(){return Dn},get quantumRelativistic(){return On},get quantumMode(){return kn},get quantumMoleculeKey(){return An},get orbitalCloud(){return jn},get moleculeRhfResult(){return Mn},get nuclearZ(){return Nn},get nuclearA(){return Pn},get nuclearResult(){return Fn},get tdseSession(){return In},get tdseTelemetry(){return Ln},evaluateIsmRadiativeCoolingErgCm3PerS:cn,evaluateStellarEvolutionaryState:ne,buildQuantizedNucleonSpheres:lr,getElementBundle:Y,getCachedElementBundle:di,ensureLevelInitialized:kr,initCosmicWeb:Un,initCosmoBaryonRegime:ur,initGalaxy:Wn,initSmbhCore:Gn,initSolarSystem:qn,initProtoplanetaryDisk:er,initKerrQuasarJet:dr,initRelativisticBinary:fr,initRadiativeWindL2:pr,initTidalRocheL2:Z,initNebularMhd:tr,initRadiativeWindL3:hr,initCompactMagnetosphere:gr,initWhiteDwarfTovCurve:Q,initStellarCore:vr,initPlanetaryInterior:yr,initCryoPlumesL4:_r,initMolecularDynamics:br,initQuantumAtom:xr,initAtomicNucleus:Sr,stepActiveRegimes:Cr,setCosmicEpoch:Rr,setCosmoMode:zr,setQuality:Ar,setSeed:jr,setMdGravity:Pr,setMdTemp:Fr,setSampledMaterial:Mr,applySampledMaterialToLattice:Nr,computeScaleAdaptiveTimeDilation:sr,setPlanetaryCutaway:Ir,setPlanetaryTriboelectric:Xr,setPlanetaryMode:Wr,enterSurfaceView:ei,exitSurfaceView:ti,unloadStarSystemRegimes:Jn,flushSurfaceCraters:Zr,applyRemoteCraterStamp:e=>K?.applyRemoteCraterStamp?.(e)??!1,triggerCatastrophicShatter:mr,getShatteredBodyIds:()=>[...hn],craterTileStore:Qt,setSurfaceVehicle:ni,setSurfaceUfoAltitudeKm:ri,setSurfaceCameraMode:ii,setSurfaceControls:ai,setSurfaceTimeWarp(e){return rn=Math.max(1,Math.min(1e7,Number(e)||1)),rn},advanceSurfaceSimSec(e){return an+=Number(e)||0,an},setSurfaceClimate(e){sn=e||null},addSurfaceLookDelta:oi,adjustSurfaceChaseDistance:si,triggerSurfaceTractorPulse:e=>K?.triggerTractorPulse?.(e),setSurfaceTractorBeam:e=>K?.setTractorBeam?.(e),setSurfaceWeaponConfig:e=>K?.setWeaponConfig?.(e),setSurfaceWeaponFire:e=>K?.setWeaponFire?.(e),launchSurfaceMissile:e=>K?.launchMissile?.(e),setSurfaceExternalEntities:e=>K?.setExternalEntities?.(e),drainSurfaceEvents:()=>K?.drainPendingEvents?.()||{harvested:{silicates:0,volatiles:0,metals:0,exotics:0},peerHits:[],abductions:[]},setStellarTimeAccel:Lr,setSolarMode:Br,setKerrSpinA:Vr,setProtoplanetaryGasDrag:Hr,setStellarMode:Ur,setNebulaB0:Gr,setGalacticB0:qr,setStellarB0:Jr,setCosmoFocusMpc:Yr,setShowGalacticBField:Kr,setGalaxyBranch:li,setFocusedSolarBody:ui,computeSolarBarycenterAu:fi,getSolarReferenceOriginAu:pi,getActiveUniversalLaws:ci,syncSchroederScaleChart:L,getSchroederAtlasSnapshot:z,get lawGraphValidation(){return F},getTargetsForLevel:mi,connectPeerMesh:Tr,disconnectPeerMesh:wr,getPeerMeshState:Er,dispatchPeerDerivation:Dr,dispose:hi})}var fr=Object.freeze({COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),pr=Object.freeze({TEXTURE_BINDING:4,RENDER_ATTACHMENT:16}),Z=`
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
`,mr=`
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
`,hr=`
${Z}
${mr}

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
`,gr=`
${Z}
${mr}

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

  col = em_sensor_map_rgb(col, mix(2.725, max(50.0, cam.em_aux.x * 0.82), opt_depth * 0.65), sunset_w * 0.3 + sun_halo * 0.4, 0.0, star_vis * 0.12, 0.0);
  return vec4<f32>(col, 1.0);
}
`,Q=`
${Z}
${mr}

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
`,_r=`
${Z}
${mr}

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
  let cy = cos(inst.rot_kind.x);
  let sy = sin(inst.rot_kind.x);
  let r_sc = inst.rot_kind.y * scale_h;
  let lx = in.pos_part.x * r_sc;
  let ly = in.pos_part.y * scale_h;
  let lz = in.pos_part.z * r_sc;
  let rx = lx * cy - lz * sy;
  let rz = lx * sy + lz * cy;
  // Exact live per-frame TinyPlanet spherical curvature matching generate_surface_terrain_mesh to 0.000 m!
  // cam.extra1.w = 1/(2R), cam.extra2.w = focusX, cam.em_aux.z = focusZ
  let dx_c = inst.pos_scale.x - cam.extra2.w;
  let dz_c = inst.pos_scale.z - cam.em_aux.z;
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
`,vr=`
${Z}

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
`,yr=`
${Z}
${mr}

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

  if (mode == 0u) {
    // L0: Physical Expanding FLRW 2LPT + TreePM Cosmic Web (16 floats/particle)
    // extra2.x = FLRW scale factor a(t) in [0.04..1.15]; extra2.y = Big Bang physical expansion flag (0 or 1)!
    let o = iid * 16u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let raw_v = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
    let box_sz = max(10.0, cam.extra1.w);
    let a_scale = select(1.0, max(0.02, cam.extra2.x), cam.extra2.x > 0.001);
    let bb_mode = clamp(cam.extra2.y, 0.0, 1.0);
    // Physical metric expansion: r_phys(t) = a(t) * x_comoving expands visibly from compact fireball to full Cosmic Web!
    let a_expand = mix(1.0, clamp(pow(a_scale, 0.72), 0.11, 1.08), bb_mode);
    let is_sky = world_scale < 0.0;
    let rel_c = raw_p - cam.extra1.xyz;
    let d_rel_c = length(rel_c);
    // Smooth observable-horizon spherical survey vignette (eliminates harsh periodic box wall edges!)
    let r_box = length(raw_p) / box_sz;
    let sphere_fade = 1.0 - smoothstep(0.32, 0.495, r_box);
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
    let col_fil = vec3<f32>(0.18, 0.64, 1.0);
    let col_node = vec3<f32>(1.0, 0.72, 0.28);
    var c_dm = mix(col_void, col_fil, smoothstep(0.08, 0.56, rho));
    c_dm = mix(c_dm, col_node, smoothstep(0.60, 0.96, rho));
    let c_bar = mix(vec3<f32>(0.94, 0.38, 0.22), vec3<f32>(1.0, 0.80, 0.36), smoothstep(0.18, 0.90, rho));
    let sky_att = select(1.0, clamp(42.0 / (16.0 + d_rel_c), 0.35, 1.85), is_sky);
    var web_col = select(c_dm, c_bar, is_baryon) * (0.78 + 1.05 * pow(rho, 0.90));

    // Continuous FLRW Big Bang fireball blackbody shift T(z) = 2.7255 / a(t):
    //   a < 0.10: blinding blue-white primordial plasma -> a ~ 0.18: golden recombination -> a ~ 0.38: crimson cosmic dawn -> present web!
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
    pt_size = pt_size_base * (0.56 + 0.92 * pow(rho, 0.85)) * select(1.0, 0.68 + 0.52 * sky_att, is_sky);
    alpha = alpha_gain * (0.28 + 0.72 * pow(rho, 0.92)) * sphere_fade * sky_att;
    // Pass 2 L0 Visual LOD: soft volumetric DM filament clouds + velocity-aligned infall streaks!
    if (!is_sky) {
      let v_mag = length(raw_v);
      if (bb_mode < 0.5 && v_mag > 0.65 && (iid & 3u) == 0u) {
        streak_axis = raw_v / v_mag;
        streak_len = clamp(pt_size * (1.8 + v_mag * 0.75), pt_size * 1.4, pt_size * 4.2);
        shape = 2.0;
      } else if (!is_baryon && rho > 0.42 && (iid & 1u) == 0u) {
        shape = 1.0;
        pt_size = pt_size * 1.55;
        alpha = alpha * 0.62;
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
      let dust_lane = smoothstep(0.58, 0.95, sin(arm_phi * 2.0 - log(max(0.4, r_gal)) * 4.4)) * smoothstep(1.1, 4.4, r_gal) * (1.0 - smoothstep(7.5, 11.8, r_gal)) * (1.0 - ir_pierce * 0.85);
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
    // Mode 6: L2 Protoplanetary Accretion Disk Pebbles (warm silicate dust inside snow line, icy sapphire outside!)
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
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let temp_k = raw_f32[o + 8u];
    let ice_f = clamp(raw_f32[o + 9u], 0.0, 1.0);
    let hot_inner = mix(vec3<f32>(0.92, 0.52, 0.24), vec3<f32>(1.0, 0.82, 0.48), clamp((temp_k - 220.0) / 360.0, 0.0, 1.0));
    let icy_outer = vec3<f32>(0.48, 0.80, 1.0);
    col = mix(hot_inner, icy_outer, ice_f);
    pt_size = pt_size_base * (0.78 + 0.45 * ice_f);
    alpha = alpha_gain * (0.48 + 0.36 * (1.0 - ice_f * 0.35));
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
    let sp_tag = raw_f32[o + 3u];
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
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
    if (sp_tag > 3.5) {
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
    let o0 = iid * 16u;
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
`,br=`
${Z}
${mr}

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

  let halo_inflate = select(1.24, 1.54, kind == 0u || kind == 5u);
  let base_inflate = radius * select(1.54, halo_inflate, dist > radius * 2.6);
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
  let light_dir = normalize(cam.extra1.xyz);
  let cut_active = in.params.z;

  if (disc_n < 0.0) {
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

  let sqrt_dn = sqrt(disc_n);
  var t_hit_n = -b_n - sqrt_dn;
  if (t_hit_n < 1.0e-7) { t_hit_n = -b_n + sqrt_dn; }
  if (t_hit_n < 1.0e-7) { discard; }
  var t_hit = t_hit_n * ro_len;

  var p_hit = (ro_n + rd * t_hit_n) * ro_len;
  var n_hit = normalize(ro_n + rd * t_hit_n);
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
  let ndl = max(0.0, raw_ndl);
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
      let north2 = cross(n_hit, east2);
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
    // Photorealistic Terrestrial / Ocean / Mars / Mercury world with 5-octave FBM continents, analytical micro-normal relief, bathymetry, polar caps, night-side city lights & live CFD clouds!
    let elev = fbm5(n_hit * 3.4 + seed_v);
    let detail = fbm5(n_hit * 14.0 + seed_v * 1.7);
    let has_ocean = in.color1.b > in.color1.r + 0.14;
    var surf = in.color0.rgb;
    var water_spec = 0.0;
    var bump_strength = 0.0;
    var is_land_hab = 0.0;

    if (has_ocean) {
      let sea_lvl = 0.51;
      if (elev < sea_lvl) {
        let depth_f = clamp((sea_lvl - elev) / 0.26, 0.0, 1.0);
        // Turquoise shallow continental shelf transitioning smoothly into deep sapphire abyss!
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
      // Polar ice caps
      let polar = smoothstep(0.76, 0.90, abs(n_hit.y) + (detail - 0.5) * 0.14);
      surf = mix(surf, vec3<f32>(0.90, 0.94, 0.98), polar);
      bump_strength = bump_strength * (1.0 - polar * 0.75);
      is_land_hab = is_land_hab * (1.0 - polar);
    } else {
      // Rocky / Mars / Mercury / Sulfur-Volcanic Io world with craters, highlands & tidal volcanic calderas!
      let crater = smoothstep(0.32, 0.68, detail);
      surf = mix(in.color1.rgb, in.color0.rgb, clamp(elev * 1.15 - 0.1 + 0.25 * crater, 0.0, 1.0));
      let polar = smoothstep(0.84, 0.94, abs(n_hit.y) + (detail - 0.5) * 0.08);
      surf = mix(surf, vec3<f32>(0.88, 0.90, 0.94), polar * select(0.0, 0.85, in.color1.w > 0.12));
      // Tidally heated sulfur-crust volcanic calderas (driven strictly by sulfur reflectance & vacuum, zero body names!)
      let is_sulfur_volc = (in.color0.r > 0.85 && in.color0.g > 0.72 && in.color0.b < 0.45 && in.color1.w < 0.05);
      if (is_sulfur_volc) {
        let cald_n = fbm5(n_hit * 19.0 + seed_v * 2.1);
        let caldera = smoothstep(0.74, 0.86, cald_n);
        let lava_spot = smoothstep(0.82, 0.90, cald_n);
        surf = mix(surf, vec3<f32>(0.12, 0.09, 0.08), caldera * 0.85);
        surf = surf + vec3<f32>(1.0, 0.38, 0.06) * lava_spot * 2.2;
        em_temp_k = mix(em_temp_k, 1480.0, lava_spot);
      }
      bump_strength = 0.58;
      is_land_hab = (1.0 - smoothstep(0.55, 0.82, abs(n_hit.y))) * 0.65;
    }

    // Analytical tangent-space FBM topographic relief normal for crisp sunlit mountain/crater shading!
    var ndl_relief = ndl;
    if (bump_strength > 0.01) {
      let up_ref = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(n_hit.y) > 0.92);
      let t1 = normalize(cross(up_ref, n_hit));
      let t2 = cross(n_hit, t1);
      let eps_b = 0.014;
      let e1 = fbm5(normalize(n_hit + t1 * eps_b) * 3.4 + seed_v) + 0.24 * fbm5(normalize(n_hit + t1 * eps_b) * 14.0 + seed_v * 1.7);
      let e2 = fbm5(normalize(n_hit + t2 * eps_b) * 3.4 + seed_v) + 0.24 * fbm5(normalize(n_hit + t2 * eps_b) * 14.0 + seed_v * 1.7);
      let e0 = elev + 0.24 * detail;
      let n_relief = normalize(n_hit + (t1 * (e0 - e1) + t2 * (e0 - e2)) * (bump_strength * 5.2));
      ndl_relief = max(0.0, dot(n_relief, light_dir));
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
      let north1 = cross(n_hit, east1);
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
    let rayleigh = mix(vec3<f32>(0.78, 0.50, 0.30), vec3<f32>(0.30, 0.68, 1.0), select(0.25, 1.0, has_ocean));
    let atm = rayleigh * fresnel * in.color1.w * 0.98;
    let sunset = mix(vec3<f32>(0.98, 0.44, 0.14), vec3<f32>(1.0, 0.52, 0.18), select(0.0, 1.0, has_ocean)) * term_sunset * (0.16 + 0.24 * cloud_cover + 0.25 * fresnel) * star_dir_l;
    col = surf * (vec3<f32>(0.028) + star_dir_l * (0.03 + 0.98 * ndl_eff) * soft_term) + sunset + star_dir_l * water_spec * ndl + atm * (vec3<f32>(0.03) + star_dir_l * (0.14 + 0.86 * ndl)) + em_lightning + em_aurora + em_cities;
  } else if (kind == 3u) {
    // Cratered Moon / Icy World / Atmospheric Ice Giant (Uranus & Neptune):
    // Gate rocky crater relief strictly on airless moons (atm < 0.28) so Ice Giants have silky atmospheric methane bands!
    let crater_w = 1.0 - smoothstep(0.08, 0.28, in.color1.w);
    let n1 = fbm5(n_hit * 6.0 + seed_v);
    let n2 = fbm5(n_hit * 18.0 - seed_v);
    let up_r3 = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(n_hit.y) > 0.92);
    let t1_3 = normalize(cross(up_r3, n_hit));
    let t2_3 = cross(n_hit, t1_3);
    let c_x = fbm5(normalize(n_hit + t1_3 * 0.012) * 18.0 - seed_v);
    let c_y = fbm5(normalize(n_hit + t2_3 * 0.012) * 18.0 - seed_v);
    let n_crater = normalize(n_hit + (t1_3 * (n2 - c_x) + t2_3 * (n2 - c_y)) * (2.4 * crater_w));
    let ndl_c = max(0.0, dot(n_crater, light_dir));
    // Smooth methane zonal bands for atmospheric Ice Giants vs cratered terrain contrast for airless moons
    let ig_band = 0.5 + 0.32 * sin(n_hit.y * 14.0 + n1 * 1.4) + 0.18 * fbm5(n_hit * vec3<f32>(3.0, 11.0, 3.0) + seed_v);
    let rocky_mix = clamp(0.2 + 0.7 * n1 + 0.25 * n2, 0.0, 1.0);
    var base = mix(in.color1.rgb, in.color0.rgb, mix(clamp(ig_band, 0.18, 0.92), rocky_mix, crater_w));
    // Cryogenic tidal-flexure tectonic lineae / tiger-stripe ice fractures on bright airless icy moons!
    if (in.color0.b > 0.68 && in.color1.w < 0.12) {
      let l1 = abs(fbm5(n_hit * 8.5 + seed_v) - 0.5);
      let l2 = abs(fbm5(n_hit * 13.5 - seed_v * 1.6) - 0.5);
      let crack = max(1.0 - smoothstep(0.008, 0.032, l1), 1.0 - smoothstep(0.008, 0.028, l2));
      let stain_col = mix(vec3<f32>(0.54, 0.30, 0.20), vec3<f32>(0.36, 0.72, 0.96), smoothstep(0.88, 0.96, in.color0.b));
      base = mix(base, stain_col, crack * 0.62);
    }
    var em_ice = vec3<f32>(0.0);
    if (cam.extra2.w > 0.5 && in.inst_id == u32(round(cam.extra2.z))) {
      let aw = u32(round(cam.extra2.x));
      let ah = u32(round(cam.extra2.y));
      let av = sample_live_atmo_vis(n_hit, aw, ah);
      let cfd3 = sample_live_atmo_flow(n_hit, aw, ah);
      let east3 = normalize(vec3<f32>(-n_hit.z, 0.0, n_hit.x) + vec3<f32>(1e-5, 0.0, 0.0));
      let north3 = cross(n_hit, east3);
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
    // Kind 7: Incandescent Hadean Magma Ocean World (dark cooled basalt plates rifted by glowing molten lava cracks!)
    let crust = fbm5(n_hit * 4.2 + seed_v);
    let cracks = fbm5(n_hit * 13.5 - seed_v * 1.4);
    let rift = smoothstep(0.46, 0.64, abs(crust - 0.50) * -2.0 + 0.72 + (cracks - 0.5) * 0.35);
    let basalt = mix(vec3<f32>(0.10, 0.08, 0.09), vec3<f32>(0.24, 0.16, 0.14), cracks);
    let lava = mix(vec3<f32>(0.96, 0.22, 0.04), vec3<f32>(1.0, 0.86, 0.32), smoothstep(0.45, 0.95, rift));
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
`,xr=`
${Z}
${mr}

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
  // On frame 0 before first neighbor build raw_coord can be 0; treat 0 as crystal base color!
  let coord_frac = select(clamp(raw_coord / ideal_coord, 0.0, 1.2), 1.0, raw_coord < 0.01);
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
`,Sr=`
${Z}
${mr}

struct DiskInstance {
  center_r_in: vec4<f32>,
  normal_r_out: vec4<f32>,
  color_kind: vec4<f32>,
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
    // Analytical planet cylinder shadow cast onto back half of ring plane!
    let rel_p = in.world_pos - in.center;
    let ldir = normalize(cam.extra1.xyz);
    let view_r = normalize(cam.cam_pos.xyz - in.world_pos);
    let along = dot(rel_p, ldir);
    let perp_r = length(rel_p - ldir * along);
    let planet_r = in.r_in * 0.76;
    let ring_shadow = select(1.0, smoothstep(planet_r * 0.92, planet_r * 1.08, perp_r) * 0.88 + 0.12, along < 0.0);
    // Physical Henyey-Greenstein forward/back phase scattering for icy ring particles (g = 0.42)!
    let cos_phase = dot(-view_r, ldir);
    let g_hg = 0.42;
    let hg_phase = (1.0 - g_hg * g_hg) / max(0.22, pow(max(0.15, 1.0 + g_hg * g_hg - 2.0 * g_hg * cos_phase), 1.5));
    let opp_surge = 1.0 + 0.28 * pow(max(0.0, dot(view_r, ldir)), 8.0);
    let phase_gain = clamp(0.68 + 0.34 * hg_phase * opp_surge, 0.55, 1.55);
    let alpha = clamp(fade * cassini * encke * ringlets * 0.76, 0.0, 0.88);
    let ring_star_l = cam.star_light.rgb * clamp(cam.star_light.w, 0.16, 1.85);
    var ring_c = in.color_kind.rgb * (0.85 + 0.25 * ringlets) * ring_shadow * phase_gain * ring_star_l;
    ring_c = em_sensor_map_rgb(ring_c, 85.0, 0.0, 0.0, 0.08, 0.0);
    return vec4<f32>(ring_c * alpha, alpha);
  }
}
`,Cr=`
${Z}

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
`,wr=`
${Z}

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
`,Tr=`
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
`,Er=`
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
`;function Dr(e,t){let n=t.getContext(`webgpu`);if(!n)throw Error(`WebGPU canvas context unavailable`);let{format:r}=I(n,e,{preferCopySrc:!0}),i=`rgba16float`,a=`depth32float`,o=0,s=0,c=null,l=null,u=null,d=null,f=null,p=null,m=null,h=null,g=e.createBuffer({label:`uv-cam-base`,size:224,usage:fr.UNIFORM|fr.COPY_DST}),_=Array.from({length:4},(t,n)=>e.createBuffer({label:`uv-cam-cloud-${n}`,size:224,usage:fr.UNIFORM|fr.COPY_DST})),v=e.createBuffer({label:`uv-cam-aux`,size:224,usage:fr.UNIFORM|fr.COPY_DST}),y=e.createBuffer({label:`uv-cam-flora`,size:224,usage:fr.UNIFORM|fr.COPY_DST}),b=e.createBuffer({label:`uv-cam-space-mesh`,size:224,usage:fr.UNIFORM|fr.COPY_DST}),x=e.createBuffer({label:`uv-post-uniform`,size:64,usage:fr.UNIFORM|fr.COPY_DST}),S=e.createBuffer({label:`uv-bloom-extract-u`,size:16,usage:fr.UNIFORM|fr.COPY_DST}),C=e.createBuffer({label:`uv-bloom-blur-u`,size:16,usage:fr.UNIFORM|fr.COPY_DST}),w=e.createSampler({magFilter:`linear`,minFilter:`linear`}),T=e.createBuffer({label:`uv-spheres`,size:320*80,usage:fr.STORAGE|fr.COPY_DST}),E=e.createBuffer({label:`uv-disks`,size:768,usage:fr.STORAGE|fr.COPY_DST}),D=24576,O=e.createBuffer({label:`uv-lines`,size:D*28,usage:fr.VERTEX|fr.COPY_DST}),k=16384,A=e.createBuffer({label:`uv-cosmic-mesh`,size:k*48,usage:fr.VERTEX|fr.COPY_DST}),j=e.createBuffer({label:`uv-cosmic-fx`,size:k*48,usage:fr.VERTEX|fr.COPY_DST}),M=e.createBuffer({label:`uv-nuclear-vol`,size:1024*32*16,usage:fr.STORAGE|fr.COPY_DST}),N=1024*32*16,P=(t,n)=>e.createShaderModule({label:t,code:n}),F=P(`uv-backdrop`,hr),L=e.createRenderPipeline({label:`uv-backdrop-pipe`,layout:`auto`,vertex:{module:F,entryPoint:`vs_main`},fragment:{module:F,entryPoint:`fs_main`,targets:[{format:i}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`always`}}),R=e.createBindGroup({layout:L.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}}]}),z=P(`uv-surface-sky`,gr),ee=e.createRenderPipeline({label:`uv-surface-sky-pipe`,layout:`auto`,vertex:{module:z,entryPoint:`vs_main`},fragment:{module:z,entryPoint:`fs_main`,targets:[{format:i}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`always`}}),B=e.createBindGroup({layout:ee.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}}]}),V=P(`uv-surface-mesh`,Q),te=e.createRenderPipeline({label:`uv-surface-mesh-pipe`,layout:`auto`,vertex:{module:V,entryPoint:`vs_main`,buffers:[{arrayStride:48,attributes:[{shaderLocation:0,offset:0,format:`float32x4`},{shaderLocation:1,offset:16,format:`float32x4`},{shaderLocation:2,offset:32,format:`float32x4`}]}]},fragment:{module:V,entryPoint:`fs_main`,targets:[{format:i}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:a,depthWriteEnabled:!0,depthCompare:`greater-equal`}}),ne=e.createBindGroup({layout:te.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}}]}),re=e.createBindGroup({layout:te.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:b}}]}),ie=P(`uv-surface-flora`,_r),ae=e.createRenderPipeline({label:`uv-surface-flora-pipe`,layout:`auto`,vertex:{module:ie,entryPoint:`vs_main`,buffers:[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:`float32x4`},{shaderLocation:1,offset:16,format:`float32x4`}]}]},fragment:{module:ie,entryPoint:`fs_main`,targets:[{format:i}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:a,depthWriteEnabled:!0,depthCompare:`greater-equal`}}),oe=new WeakMap;function H(t){let n=oe.get(t);return n||(n=e.createBindGroup({layout:ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:y}},{binding:1,resource:{buffer:t}}]}),oe.set(t,n)),n}let se=P(`uv-translucent-fx`,vr),ce=e.createRenderPipeline({label:`uv-translucent-fx-pipe`,layout:`auto`,vertex:{module:se,entryPoint:`vs_main`,buffers:[{arrayStride:48,attributes:[{shaderLocation:0,offset:0,format:`float32x4`},{shaderLocation:1,offset:16,format:`float32x4`},{shaderLocation:2,offset:32,format:`float32x4`}]}]},fragment:{module:se,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`greater-equal`}}),le=e.createBindGroup({layout:ce.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}}]}),ue=e.createBindGroup({layout:ce.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:b}}]}),de=P(`uv-cloud`,yr),fe=e.createRenderPipeline({label:`uv-cloud-pipe`,layout:`auto`,vertex:{module:de,entryPoint:`vs_main`},fragment:{module:de,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`greater-equal`}}),pe=e.createRenderPipeline({label:`uv-backdrop-cloud-pipe`,layout:`auto`,vertex:{module:de,entryPoint:`vs_main`},fragment:{module:de,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`always`}}),me=P(`uv-lit-sphere`,br),he=e.createRenderPipeline({label:`uv-lit-sphere-pipe`,layout:`auto`,vertex:{module:me,entryPoint:`vs_main`},fragment:{module:me,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!0,depthCompare:`greater-equal`}}),ge=e.createBuffer({label:`uv-dummy-atmo-em`,size:96,usage:fr.STORAGE|fr.COPY_DST}),_e=new WeakMap;function ve(t){let n=t||ge,r=_e.get(n);return r||(r=e.createBindGroup({layout:he.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:T}},{binding:2,resource:{buffer:n}}]}),_e.set(n,r)),r}let ye=P(`uv-md-sphere`,xr),be=e.createRenderPipeline({label:`uv-md-sphere-pipe`,layout:`auto`,vertex:{module:ye,entryPoint:`vs_main`},fragment:{module:ye,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!0,depthCompare:`greater-equal`}}),xe=P(`uv-disk`,Sr),Se=e.createRenderPipeline({label:`uv-disk-pipe`,layout:`auto`,vertex:{module:xe,entryPoint:`vs_main`},fragment:{module:xe,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`greater-equal`}}),Ce=e.createBindGroup({layout:Se.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:E}}]}),we=P(`uv-line`,Cr),Te=e.createRenderPipeline({label:`uv-line-pipe`,layout:`auto`,vertex:{module:we,entryPoint:`vs_main`,buffers:[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x4`}]}]},fragment:{module:we,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`line-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`greater-equal`}}),Ee=e.createBindGroup({layout:Te.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}}]}),De=P(`uv-nuclear-vol`,wr),Oe=e.createRenderPipeline({label:`uv-nuclear-vol-pipe`,layout:`auto`,vertex:{module:De,entryPoint:`vs_main`},fragment:{module:De,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`always`}}),ke=e.createBindGroup({layout:Oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:M}}]}),Ae=P(`uv-bloom`,Tr),je=e.createRenderPipeline({label:`uv-bloom-pipe`,layout:`auto`,vertex:{module:Ae,entryPoint:`vs_main`},fragment:{module:Ae,entryPoint:`fs_main`,targets:[{format:i}]},primitive:{topology:`triangle-list`}}),Me=null,Ne=null,Pe=P(`uv-post`,Er),Fe=e.createRenderPipeline({label:`uv-post-pipe`,layout:`auto`,vertex:{module:Pe,entryPoint:`vs_main`},fragment:{module:Pe,entryPoint:`fs_main`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),Ie=null,Le=Array.from({length:4},()=>new WeakMap),Re=Array.from({length:4},()=>new WeakMap),ze=new WeakMap;function Be(t,n,r=!1){let i=(r?Re:Le)[n],a=_[n],o=r?pe:fe,s=i.get(t);return s||(s=e.createBindGroup({layout:o.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:a}},{binding:1,resource:{buffer:t}}]}),i.set(t,s)),s}function Ve(t,n){let r=ze.get(t);return r||(r=e.createBindGroup({layout:be.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:n}}]}),ze.set(t,r)),r}function He(t,r){let g=Math.max(2,Math.floor(t)),_=Math.max(2,Math.floor(r));if(c&&o===g&&s===_)return;o=g,s=_;let v=Math.max(2,Math.floor(o/2)),y=Math.max(2,Math.floor(s/2));I(n,e,{preferCopySrc:!0}),c?.destroy(),u?.destroy(),f?.destroy(),m?.destroy(),c=e.createTexture({label:`uv-scene-color`,size:[o,s],format:i,usage:pr.RENDER_ATTACHMENT|pr.TEXTURE_BINDING}),l=c.createView(),u=e.createTexture({label:`uv-scene-depth`,size:[o,s],format:a,usage:pr.RENDER_ATTACHMENT}),d=u.createView(),f=e.createTexture({label:`uv-bloom-a`,size:[v,y],format:i,usage:pr.RENDER_ATTACHMENT|pr.TEXTURE_BINDING}),p=f.createView(),m=e.createTexture({label:`uv-bloom-b`,size:[v,y],format:i,usage:pr.RENDER_ATTACHMENT|pr.TEXTURE_BINDING}),h=m.createView(),e.queue.writeBuffer(S,0,new Float32Array([1/o,1/s,1.02,0])),e.queue.writeBuffer(C,0,new Float32Array([1/v,1/y,1.02,1])),Me=e.createBindGroup({layout:je.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:l},{binding:2,resource:w}]}),Ne=e.createBindGroup({layout:je.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:C}},{binding:1,resource:p},{binding:2,resource:w}]}),Ie=e.createBindGroup({layout:Fe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}},{binding:1,resource:l},{binding:2,resource:w},{binding:3,resource:h}]})}function Ue(t){!t||t.byteLength===0||(t.byteLength>N&&(M.destroy(),N=t.byteLength,M=e.createBuffer({label:`uv-nuclear-vol`,size:N,usage:fr.STORAGE|fr.COPY_DST}),ke=e.createBindGroup({layout:Oe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:M}}]})),e.queue.writeBuffer(M,0,t))}let We=new Float32Array(56),Ge=new Float32Array(16),U=new Float32Array(320*20),Ke=new Float32Array(192),qe=new Float32Array(D*7);function Je(t,n,r,i,a,o=null,s=null,c=null){We.set(n.viewProj,0),We.set([n.pos[0],n.pos[1],n.pos[2],n.timeSec||0],16),We.set([n.right[0],n.right[1],n.right[2],n.aspect],20),We.set([n.up[0],n.up[1],n.up[2],n.fovTanHalf],24),We.set([n.fwd[0],n.fwd[1],n.fwd[2],n.log10SpanM??24.8],28),We.set(r||[0,0,0,0],32),We.set(i||[0,0,0,0],36),We.set(a||[0,0,0,0],40),We.set(o||[-6.42,-6.12,0,1],44),We.set(s||[288,1,0,0],48),We.set(c||[1,.97,.92,1],52),e.queue.writeBuffer(t,0,We)}function Ye({camera:r,particleClouds:i=[],spheres:a=null,atmoEm:c=null,surfaceScene:u=null,cosmicMeshes:f=null,lightDir:m=[.6,.75,.55],starLight:S=[1,.97,.92,1],mdCloud:C=null,disks:w=null,lines:M=null,nuclearVol:N=null,emSensor:P=null,post:F={},stereoSbs:I=!1,xrEyeTarget:z=null}){He(t.width,t.height);let V=P&&P.active?[Number.isFinite(P.log10LambdaMin)?P.log10LambdaMin:-6.42,Number.isFinite(P.log10LambdaMax)?P.log10LambdaMax:-6.12,1,Math.max(.2,Number(P.gain)||1)]:[-6.42,-6.12,0,1],ie=Number(u?.ambientTempK??u?.env?.tempK??C?.tempK??288),oe=u&&u.env?2:0,se=[ie,Number(u?.eclipseFactor??1),Number(u?.env?.skyOpticalDepth??0),oe],de=0;if(Array.isArray(a)&&a.length>0){de=Math.min(320,a.length);for(let e=0;e<de;e+=1){let t=a[e],n=e*20;U[n+0]=t.pos[0],U[n+1]=t.pos[1],U[n+2]=t.pos[2],U[n+3]=t.radius,U[n+4]=t.color0[0],U[n+5]=t.color0[1],U[n+6]=t.color0[2],U[n+7]=t.kind??1,U[n+8]=t.color1?.[0]??t.color0[0],U[n+9]=t.color1?.[1]??t.color0[1],U[n+10]=t.color1?.[2]??t.color0[2],U[n+11]=t.atm??.35,U[n+12]=t.rCore??.52,U[n+13]=t.rMantle??.94,U[n+14]=+!!t.cutaway,U[n+15]=t.seed??(e+1)*1.37,U[n+16]=Number(t.tempK)||(t.kind===0?5778:288),U[n+17]=Number(t.civTechK)||0,U[n+18]=Number(t.dysonCoverage)||0,U[n+19]=Number(t.flags)||0}e.queue.writeBuffer(T,0,U.subarray(0,de*20))}let me=0;if(Array.isArray(w)&&w.length>0){me=Math.min(16,w.length);for(let e=0;e<me;e+=1){let t=w[e],n=e*12;Ke[n+0]=t.center[0],Ke[n+1]=t.center[1],Ke[n+2]=t.center[2],Ke[n+3]=t.rIn,Ke[n+4]=t.normal[0],Ke[n+5]=t.normal[1],Ke[n+6]=t.normal[2],Ke[n+7]=t.rOut,Ke[n+8]=t.color?.[0]??.9,Ke[n+9]=t.color?.[1]??.85,Ke[n+10]=t.color?.[2]??.72,Ke[n+11]=t.kind??0}e.queue.writeBuffer(E,0,Ke.subarray(0,me*12))}let ge=0;M&&M.length>=14&&(ge=Math.min(D,Math.floor(M.length/7)),qe.set(M.subarray(0,ge*7),0),e.queue.writeBuffer(O,0,qe.subarray(0,ge*7)));let _e=0,ye=0;f&&(f.opaque&&f.opaque.length>=12&&(_e=Math.min(k,Math.floor(f.opaque.length/12)),e.queue.writeBuffer(A,0,f.opaque.subarray(0,_e*12))),f.fx&&f.fx.length>=12&&(ye=Math.min(k,Math.floor(f.fx.length/12)),e.queue.writeBuffer(j,0,f.fx.subarray(0,ye*12))));let xe=(i||[]).filter(e=>e&&e.buffer&&e.count>0).slice(0,4),we=xe.some(e=>e.isBackdrop),De=!!(c&&c.buffer&&c.width>0&&c.height>0),Ae=Array.isArray(S)&&S.length>=4?[Number(S[0])||1,Number(S[1])||.97,Number(S[2])||.92,Number(S[3])||1]:[1,.97,.92,1];Je(g,r,[r.level||0,+!!we,0,0],[m[0],m[1],m[2],0],De?[c.width,c.height,c.sphereIndex??0,1]:[1,1,-1,0],V,se,Ae),Je(b,r,[.06,.09,.14,0],[m[0],m[1],m[2],0],[0,0,0,0],V,[320,1,0,1],Ae);for(let e=0;e<xe.length;e+=1){let t=xe[e],n=_[e];Je(n,r,[t.mode,t.worldScale,t.pointSize,t.alphaGain],t.extra1||[...t.colorPos||[0,0,0],0],t.extra2||[...t.colorNeg||[0,0,0],0],V,se,Ae)}if(u&&u.env){let e=u.env,t=u.lightDir||m,n=e.hasSolidCrust?1/(2*(e.tinyPlanetCurvatureRadiusM||2800)):0;Je(v,r,[e.skyZenithRgb[0],e.skyZenithRgb[1],e.skyZenithRgb[2],e.skyOpticalDepth],[t[0],t[1],t[2],n],[e.skyHorizonRgb[0],e.skyHorizonRgb[1],e.skyHorizonRgb[2],+!!e.isMagmaOcean],V,se,Ae);let i=u.focusPos||r.pos;Je(y,r,[e.skyZenithRgb[0],e.skyZenithRgb[1],e.skyZenithRgb[2],e.skyOpticalDepth],[t[0],t[1],t[2],n],[e.skyHorizonRgb[0],e.skyHorizonRgb[1],e.skyHorizonRgb[2],i[0]||0],V,[se[0],se[1],i[2]||0,se[3]],Ae)}else C&&C.positionsBuffer&&C.velocitiesBuffer&&C.count>0?Je(v,r,[C.halfBox[0],C.halfBox[1],C.halfBox[2],C.worldScale],[C.baseRgb[0],C.baseRgb[1],C.baseRgb[2],C.radius],[C.alphaFade??1,0,0,C.idealCoord||12],V,se,Ae):N&&N.dim>0&&Je(v,r,[N.dim,N.boxRadius||3.4,N.tdseTunneled||0,N.tdseCrestNorm||.72],[N.alphaMul??1,0,0,0],[0,0,0,0],V,se,Ae);let Pe=F.bloomStrength??.22;Ge[0]=o,Ge[1]=s,Ge[2]=F.bhUv?.[0]??.5,Ge[3]=F.bhUv?.[1]??.5,Ge[4]=F.bhStrength??0,Ge[5]=F.warpAmount??0,Ge[6]=F.flashAmount??0,Ge[7]=+!!F.crtEnabled,Ge[8]=F.pixelSize??3,Ge[9]=F.timeSec??0,Ge[10]=Pe,Ge[11]=0,Ge[12]=V[0],Ge[13]=V[1],Ge[14]=V[2],Ge[15]=V[3],e.queue.writeBuffer(x,0,Ge);let Le=e.createCommandEncoder({label:`uv-frame-fused`});{let e=Le.beginRenderPass({colorAttachments:[{view:l,clearValue:{r:.005,g:.009,b:.02,a:1},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:d,depthClearValue:0,depthLoadOp:`clear`,depthStoreOp:`store`}});if(u&&u.env){e.setPipeline(ee),e.setBindGroup(0,B),e.draw(3,1,0,0);for(let t=0;t<xe.length;t+=1){let n=xe[t];n.isBackdrop&&(e.setPipeline(pe),e.setBindGroup(0,Be(n.buffer,t,!0)),e.draw(6,n.count,0,0))}de>0&&(e.setPipeline(he),e.setBindGroup(0,ve(De?c.buffer:null)),e.draw(6,de,0,0)),me>0&&(e.setPipeline(Se),e.setBindGroup(0,Ce),e.draw(6,me,0,0)),!u.hideTerrain&&u.terrainVertBuf&&u.terrainIdxBuf&&u.indexCount>0&&(e.setPipeline(te),e.setBindGroup(0,ne),e.setVertexBuffer(0,u.terrainVertBuf),e.setIndexBuffer(u.terrainIdxBuf,`uint32`),e.drawIndexed(u.indexCount,1,0,0,0)),u.flora&&u.flora.instanceBuf&&u.flora.templateVertBuf&&u.flora.instanceCount>0&&u.flora.templateVertCount>0&&(e.setPipeline(ae),e.setBindGroup(0,H(u.flora.instanceBuf)),e.setVertexBuffer(0,u.flora.templateVertBuf),e.draw(u.flora.templateVertCount,u.flora.instanceCount,0,0)),u.boulderVertBuf&&u.boulderVertCount>0&&(e.setPipeline(te),e.setBindGroup(0,ne),e.setVertexBuffer(0,u.boulderVertBuf,0,u.boulderVertCount*48),e.draw(u.boulderVertCount,1,0,0)),u.vehicleVertBuf&&u.vehicleVertCount>0&&(e.setPipeline(te),e.setBindGroup(0,ne),e.setVertexBuffer(0,u.vehicleVertBuf,0,u.vehicleVertCount*48),e.draw(u.vehicleVertCount,1,0,0))}else{e.setPipeline(L),e.setBindGroup(0,R),e.draw(3,1,0,0);for(let t=0;t<xe.length;t+=1){let n=xe[t];n.isBackdrop&&(e.setPipeline(pe),e.setBindGroup(0,Be(n.buffer,t,!0)),e.draw(6,n.count,0,0))}}ge>0&&(e.setPipeline(Te),e.setBindGroup(0,Ee),e.setVertexBuffer(0,O,0,ge*28),e.draw(ge,1,0,0)),u&&u.env||(de>0&&(e.setPipeline(he),e.setBindGroup(0,ve(De?c.buffer:null)),e.draw(6,de,0,0)),me>0&&(e.setPipeline(Se),e.setBindGroup(0,Ce),e.draw(6,me,0,0))),C&&C.positionsBuffer&&C.velocitiesBuffer&&C.count>0&&(e.setPipeline(be),e.setBindGroup(0,Ve(C.positionsBuffer,C.velocitiesBuffer)),e.draw(6,C.count,0,0)),!u&&_e>0&&(e.setPipeline(te),e.setBindGroup(0,re),e.setVertexBuffer(0,A,0,_e*48),e.draw(_e,1,0,0));for(let t=0;t<xe.length;t+=1){let n=xe[t];n.isBackdrop||(e.setPipeline(fe),e.setBindGroup(0,Be(n.buffer,t,!1)),e.draw(6,n.count,0,0))}N&&N.dim>0&&(e.setPipeline(Oe),e.setBindGroup(0,ke),e.draw(3,1,0,0)),u&&u.fxVertBuf&&u.fxVertCount>0?(e.setPipeline(ce),e.setBindGroup(0,le),e.setVertexBuffer(0,u.fxVertBuf,0,u.fxVertCount*48),e.draw(u.fxVertCount,1,0,0)):!u&&ye>0&&(e.setPipeline(ce),e.setBindGroup(0,ue),e.setVertexBuffer(0,j,0,ye*48),e.draw(ye,1,0,0)),e.end()}if(Pe>.001&&Me&&Ne){let e=Le.beginRenderPass({colorAttachments:[{view:p,clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});e.setPipeline(je),e.setBindGroup(0,Me),e.draw(3,1,0,0),e.end();let t=Le.beginRenderPass({colorAttachments:[{view:h,clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});t.setPipeline(je),t.setBindGroup(0,Ne),t.draw(3,1,0,0),t.end()}{let t=z?.colorView||n.getCurrentTexture().createView(),r=Le.beginRenderPass({colorAttachments:[{view:t,clearValue:{r:0,g:0,b:0,a:1},loadOp:z?.preserve?`load`:`clear`,storeOp:`store`}]});if(z?.viewport){let e=z.viewport;r.setViewport(e.x,e.y,e.width,e.height,0,1)}else if(I){let t=Math.max(1,Math.floor(o*.5));r.setPipeline(Fe),r.setBindGroup(0,Ie),r.setViewport(0,0,t,s,0,1),r.draw(3,1,0,0),r.setViewport(t,0,o-t,s,0,1),r.draw(3,1,0,0),r.end(),e.queue.submit([Le.finish()]);return}r.setPipeline(Fe),r.setBindGroup(0,Ie),r.draw(3,1,0,0),r.end()}e.queue.submit([Le.finish()])}function Xe(){c?.destroy(),u?.destroy(),f?.destroy(),m?.destroy();for(let e of[g,..._,v,b,x,S,C,T,ge,E,O,A,j,M])try{e.destroy()}catch{}}return Object.freeze({renderFrame:Ye,uploadNuclearVolume:Ue,dispose:Xe})}function Or(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function kr(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function Ar(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function jr(e){return e-Math.floor(e)}function Mr(e,t,n){let r=Math.max(0,Math.min(1,(n-e)/Math.max(1e-7,t-e)));return r*r*(3-2*r)}function Nr(e,t,n){let r=jr(e*.3183099+.1)*17,i=jr(t*.3183099+.2)*17,a=jr(n*.3183099+.3)*17;return jr(r*i*a*(r+i+a))}function Pr(e,t,n){let r=Math.floor(e),i=Math.floor(t),a=Math.floor(n),o=e-r,s=t-i,c=n-a,l=o*o*(3-2*o),u=s*s*(3-2*s),d=c*c*(3-2*c),f=Nr(r,i,a),p=Nr(r+1,i,a),m=Nr(r,i+1,a),h=Nr(r+1,i+1,a),g=Nr(r,i,a+1),_=Nr(r+1,i,a+1),v=Nr(r,i+1,a+1),y=Nr(r+1,i+1,a+1),b=f+(p-f)*l,x=m+(h-m)*l,S=g+(_-g)*l,C=v+(y-v)*l,w=b+(x-b)*u;return w+(S+(C-S)*u-w)*d}function Fr(e,t,n){let r=e,i=t,a=n,o=0,s=.5;for(let e=0;e<5;e+=1)o+=s*Pr(r,i,a),r=r*2.07+13.7,i=i*2.07-9.2,a=a*2.07+5.4,s*=.5;return o}function Ir(e,t={},n=7.81,r=null){let i=Or(Array.isArray(e)&&e.length===3?e:[0,.5,.866]),a=Math.asin(Math.max(-1,Math.min(1,i[1])))*(180/Math.PI),o=Math.atan2(i[2],i[0])*(180/Math.PI),s=n*2.13,c=n*1.47,l=n*3.19,u=Fr(i[0]*3.4+s,i[1]*3.4+c,i[2]*3.4+l),d=Fr(i[0]*14+s*1.7,i[1]*14+c*1.7,i[2]*14+l*1.7),f=Array.isArray(t.color1)?t.color1:[.1,.25,.55],p=(Number(t.radiusKm)||6371)>=16e3||t.kind===2,m=!p&&f[2]>f[0]+.14,h=.51,g=Array.isArray(r)&&r.length===3?Ar(i,Or(r)):.65,_=g<-.04,v=g>=-.08&&g<=.16,y=null;if(Array.isArray(r)&&r.length===3){let e=Or(r);y=Math.atan2(i[2],i[0])-Math.atan2(e[2],e[0])}let b=!1,x=!1,S=!1,C=!1,w=!1,T=!1,E=`Rocky Plains`,D=0,O=0,k=1,A=1;if(p){let e=Math.sin(i[1]*16.5+(u-.5)*3.4);E=e>.15?`Ammonia Cloud Zone`:`Deep Cyclonic Belt`,O=e>.15?-10:14}else if(m)if(Mr(.76,.9,Math.abs(i[1])+(d-.5)*.14)>.48)S=!0,E=`Polar Ice Cap & Glaciers`,O=-34,A=.08,k=.85;else if(u<h-.035)b=!0,E=`Open Deep Ocean`,D=28,A=.05;else if(u<.555)x=!0,T=!0,E=`Coastal Shoreline & Forest`,D=1.5,A=1.15;else{let e=Math.max(0,Math.min(1,(u-h)/.32)),t=Mr(.25,.72,d)*(1-Math.abs(i[1]));e>.55?(C=!0,E=`Alpine Mountain Range`,D=-24,O=-14,k=1.48,A=.55):t>.45?(w=!0,E=`Arid Desert Plateau`,D=-20,O=14,k=.92,A=.22):(T=!0,E=`Temperate Forest & Valleys`,D=-14,A=1.3)}else Mr(.84,.94,Math.abs(i[1])+(d-.5)*.08)>.45&&(t.atm??0)>.12?(S=!0,E=`Polar Frost Cap`,O=-30):u>.62?(C=!0,E=`Cratered Highlands & Ridges`,k=1.38):u<.4?(E=`Lowland Impact Basin`,k=.78):E=`Regolith Plains`;return Object.freeze({latDeg:Number(a.toFixed(2)),lonDeg:Number(o.toFixed(2)),nHit:Object.freeze([i[0],i[1],i[2]]),elev:Number(u.toFixed(4)),detail:Number(d.toFixed(4)),sunDot:Number(g.toFixed(3)),solarLonOffsetRad:y,isGasGiant:p,isOcean:b,isCoast:x,isPolarIce:S,isMountain:C,isDesert:w,isLush:T,isNightSide:_,isTwilight:v,biomeLabel:E,seaLevelOffsetM:D,tempOffsetK:O,ampScale:k,floraDensityScale:A})}function Lr({axialObliquityDeg:e=23.44,spinAxisLonDeg:t=90,observerLatDeg:n=28,spinAngleRad:r=0,tidallyLocked:i=!1,toPrimaryStarUnit:a=null}={}){let o=Math.PI/180,s=e*o,c=t*o,l=Or([Math.sin(s)*Math.cos(c),Math.cos(s),Math.sin(s)*Math.sin(c)]),u=Or(kr(Math.abs(l[1])>.95?[1,0,0]:[0,1,0],l)),d=Or(kr(l,u));if(i&&Array.isArray(a)){let e=[a[0]-l[0]*Ar(a,l),a[1]-l[1]*Ar(a,l),a[2]-l[2]*Ar(a,l)];Math.hypot(e[0],e[1],e[2])>1e-4&&(u=Or(e),d=Or(kr(l,u)))}let f=Math.max(-85,Math.min(85,n))*o,p=Math.cos(f),m=Math.sin(f),h=Math.cos(r),g=Math.sin(r),_=[u[0]*h+d[0]*g,u[1]*h+d[1]*g,u[2]*h+d[2]*g],v=Or([_[0]*p+l[0]*m,_[1]*p+l[1]*m,_[2]*p+l[2]*m]),y=Or([-u[0]*g+d[0]*h,-u[1]*g+d[1]*h,-u[2]*g+d[2]*h]),b=Or(kr(y,v));return{pole:l,eqA:u,eqB:d,east:y,up:v,south:b,observerLatRad:f}}function Rr(e,t,n){if(!(t>1e-9)||!(n>1e-9)||e>=t+n)return 0;if(e<=Math.abs(n-t))return n>=t?1:n*n/(t*t);let r=e,i=t,a=n,o=Math.max(-1,Math.min(1,(r*r+i*i-a*a)/(2*r*i))),s=Math.max(-1,Math.min(1,(r*r+a*a-i*i)/(2*r*a))),c=i*i*Math.acos(o)+a*a*Math.acos(s)-.5*Math.sqrt(Math.max(0,(-r+i+a)*(r+i-a)*(r-i+a)*(r+i+a)));return Math.max(0,Math.min(1,c/(Math.PI*i*i)))}function zr({solarEngine:e,catalog:t,focusIdx:n,cameraPos:r=[0,10,0],craftPosM:i=null,navRadiusM:a=null,env:o={},surfaceSimSec:s=0,observerLatDeg:c=28,landingSite:l=null,altitudeKm:u=null,dysonCoverage:d=0}={}){let f=o.isRogue?Or([.15,.96,.22]):Or([.58,.44,.68]),p={seasonName:`Equinox`,declinationDeg:0,localHour:10.5,surfaceTempK:Number(o.tempK)||288,snowlineM:Math.max(8,(Number(o.terrainAmpM)||42)*.56),iceCoverFrac:0,autumnShift:0,eclipseFactor:1,latitudeRad:c*Math.PI/180,observerLatDeg:c,observerLonOffsetDeg:0,isNightSide:!1};if(!e||!Array.isArray(t)||n<0||n>=t.length)return{spheres:[],disks:[],lightDir:f,primarySunElevDeg:Math.asin(f[1])*(180/Math.PI),climate:p};let m=t[n],h=Math.min(e.massiveCount,t.length),g=e.getMassiveBodyState64(n),_=e.getMassiveBodyState64(0),v=[_.posAu[0]-g.posAu[0],_.posAu[1]-g.posAu[1],_.posAu[2]-g.posAu[2]],y=Math.max(1e-6,Math.hypot(v[0],v[1],v[2])),b=[v[0]/y,v[1]/y,v[2]/y],x=Array.isArray(i)&&i.length>=3?i:[0,0,0],S=Math.max(450,Number(a)||Number(o.tinyPlanetCurvatureRadiusM)||(m.isMinorBody?1100:2800)),C=Number.isFinite(Number(l?.latDeg))?Number(l.latDeg):c,w=-(x[2]/S)*(180/Math.PI),T=Math.max(-85,Math.min(85,C+w)),E=Math.max(.25,Math.cos(T*Math.PI/180)),D=x[0]/(S*E),O=Number(m.rotationPeriodHr)||24,k=2*Math.PI/(Math.abs(O)*3600)*(O<0?-1:1),A=Lr({axialObliquityDeg:Number(m.axialObliquityDeg)||23.44,spinAxisLonDeg:Number(m.spinAxisLonDeg)||90,observerLatDeg:T,spinAngleRad:0,tidallyLocked:!!m.tidallyLocked,toPrimaryStarUnit:b}),j=Ar(b,A.eqA),M=Ar(b,A.eqB),N=Number.isFinite(Number(l?.solarLonOffsetRad))?Number(l.solarLonOffsetRad):-.52,P=m.tidallyLocked?.35:Math.atan2(M,j)+N,F=m.tidallyLocked?P+D:P+k*s+D,I=Lr({axialObliquityDeg:Number(m.axialObliquityDeg)||23.44,spinAxisLonDeg:Number(m.spinAxisLonDeg)||90,observerLatDeg:T,spinAngleRad:F,tidallyLocked:!!m.tidallyLocked,toPrimaryStarUnit:b}),L=e=>[Ar(e,I.east),Ar(e,I.up),Ar(e,I.south)],R=o.isRogue?f:Or(L(b)),z=[],ee=[],B=[],V=[],te=Math.max(1e4,Number(o.radiusM)||(Number(m.radiusKm)||6371)*1e3),ne=o.hasSolidCrust===!1||te>=16e6,re=Math.max(10,Number(x[1])||20),ie=ne?-.015:-Math.min(.08,Math.max(.012,Math.sqrt(2*re/te))),ae=Number.isFinite(Number(u))?Number(u):ne?35:.03,oe=Math.max(0,Math.min(1,Number(o.skyOpticalDepth)||0)),H=ne?Math.max(.55,Math.min(5.2,4.4-ae/120*3.2+oe*.9)):(Number(o.pressurePa)||0)>15e5?2.6+oe*1.4:0,se=H>.01?Math.exp(-H*.85):1;for(let i=0;i<h;i+=1){if(i===n)continue;let a=t[i],o=e.getMassiveBodyState64(i),c=o.posAu[0]-g.posAu[0],l=o.posAu[1]-g.posAu[1],u=o.posAu[2]-g.posAu[2],f=Math.hypot(c,l,u);if(!(f>1e-9))continue;let p=Math.min(8e13,Math.max(5e4,f*Je)),h=L([c/f,l/f,u/f]),_=!!a.isStar||i===0,v=m.parent===i,y=a.parent===n,b=Math.max(250,(Number(a.radiusKm)||1737)*1e3),x=Math.max(1e-6,b/p);if(!_&&!v&&!y&&a.parent>0&&f>.05)continue;let S=_?.0065:v||y?.0055:.0022,C=Math.max(S,Math.min(.42,_?Math.max(x*1.45,S):v||y?Math.max(x*1.25,S):x*3.5));if(z.push({i,isStar:_,distM:p,dirLocal:h,angRad:C}),h[1]+C<ie)continue;let w=1;if(H>.01){let e=1/Math.max(.1,h[1]+.04);if(w=Math.exp(-H*e*(_?.55:1.15)),w<.06)continue}let T=Math.max(b,p*Math.tan(C)),E=[r[0]+h[0]*p,r[1]+h[1]*p,r[2]+h[2]*p],D=a.color0||(_?[1,.94,.78]:[.72,.74,.78]),O=a.color1||(_?[1,.56,.18]:[.42,.44,.48]),k=w<.99?[D[0]*w,D[1]*w,D[2]*w]:D,A=w<.99?[O[0]*w,O[1]*w,O[2]*w]:O;if(_?Mt({spec:{...a,color0:k,color1:A},pos:E,radius:T,timeSec:s*.05,dysonCoverage:d,seed:i*2.17+1.3,spheres:ee,disks:B,lineChunks:V,alphaMul:w}):ee.push({pos:E,radius:T,color0:k,color1:A,kind:a.kind??1,atm:a.atm??.2,tempK:Number(a.tempK)||220,civTechK:Number(a.civTechK)||0,dysonCoverage:0,seed:i*2.17+1.3}),a.ringed&&T>1e3&&w>.14){let e=Or(L([.16,.89,.42]));B.push({center:E,rIn:a.ringInnerKm/Math.max(1,a.radiusKm)*T,normal:e,rOut:a.ringOuterKm/Math.max(1,a.radiusKm)*T,color:[.88*w,.78*w,.62*w],kind:1})}}if(m.ringed&&m.ringOuterKm>m.radiusKm){let e=Math.max(1e5,m.radiusKm*1e3);B.push({center:[r[0],r[1]-e,r[2]],rIn:m.ringInnerKm*1e3,normal:Or(L(I.pole)),rOut:m.ringOuterKm*1e3,color:[.88,.78,.62],kind:1})}let ce=0,le=z.find(e=>e.i===0);if(le)for(let e of z){if(e.isStar||e.distM>=le.distM)continue;let t=Math.max(-1,Math.min(1,Ar(e.dirLocal,le.dirLocal))),n=Math.acos(t);if(n<le.angRad+e.angRad){let t=Rr(n,le.angRad,e.angRad);t>ce&&(ce=t)}}let ue=Math.max(.06,1-ce*.94),de=Math.max(-1,Math.min(1,Ar(I.pole,b))),fe=180/Math.PI*Math.asin(de),pe=I.observerLatRad,me=Math.sin(pe)*de,he=Number(o.tempK)||288,ge=o.hasLiquidOcean?34:48,_e=Math.max(35,he+me*ge*1.18+R[1]*6),ve=Number(o.solventMeltTempK)||273.15,ye=Math.max(.004,Math.min(.025,(Number(o.gravityMS2)||9.81)/1004))*18,be=Math.max(-12,Math.min(120,(_e-ve)/ye+6)),xe=o.hasLiquidOcean?Math.max(0,Math.min(1,(ve-_e+2.5)/14)):0,Se=Math.max(0,Math.min(1,Math.exp(-(((me+.14)/.18)**2))*(Math.abs(Number(m.axialObliquityDeg)||0)>8?1:.2))),Ce=`Equinox`;Ce=Math.abs(Number(m.axialObliquityDeg)||0)<4?`Aseasonal`:me>.14?`Summer`:me<-.14?xe>=.72?`Deep Winter (Frozen Sea)`:`Winter`:me>=0?`Spring`:`Autumn`;let we=Math.asin(Math.max(-1,Math.min(1,R[1])))*(180/Math.PI),Te=((12-Math.atan2(R[0],Math.max(-1,Math.min(1,R[1])))*(12/Math.PI))%24+24)%24;return{spheres:ee,disks:B,lines:V.length?new Float32Array(V):null,lightDir:R,primaryStarDistAu:y,primarySunElevDeg:we,gasGiantSkyTransmittance:Number(se.toFixed(3)),climate:{seasonName:Ce,declinationDeg:Number(fe.toFixed(1)),localHour:Number(Te.toFixed(2)),surfaceTempK:Math.round(_e),snowlineM:Number(be.toFixed(1)),iceCoverFrac:Number(xe.toFixed(3)),autumnShift:Number(Se.toFixed(3)),eclipseFactor:Number(ue.toFixed(3)),maxEclipseOcc:Number(ce.toFixed(3)),latitudeRad:pe,observerLatDeg:Number(T.toFixed(1)),observerLonOffsetDeg:Number((180/Math.PI*D).toFixed(1)),sunElevDeg:Number(we.toFixed(1)),isNightSide:we<-5}}}function Br({center:e=[0,0,0],radius:t=1,atmoState:n=null,timeSec:r=0,seed:i=1,alphaMul:a=1}={}){if(!n||!(n.surfacePressurePa>=20)||!(t>.05)||a<.02)return[];let o=Math.max(.05,Math.min(14,n.rotationOmegaRadS/72921e-9*(n.radiusM/6371e3)))>2,s=t*1.048,c=o?[-1.05,-.78,-.52,-.26,0,.26,.52,.78,1.05]:[-.95,-.56,-.2,0,.2,.56,.95],l=o?7:6,u=[];for(let t=0;t<c.length;t+=1){let n=c[t],d=Math.cos(n),f=o?(.76*Math.cos(10*n)+.36*Math.sin(18*n))*d:.54*Math.sin(2*n)*Math.sin(2*n)-.32*Math.max(0,d)**3,p=f>=0?1:-1,m=Math.max(.22,Math.abs(f)),h=p>0?[.44,.92,1]:[1,.78,.36];for(let o=0;o<l;o+=1){let c=o/l*Math.PI*2+t*.73+i*1.13+r*f*.48,d=.36+.38*m,g=null;for(let i=0;i<=12;i+=1){let o=i/12,l=c+p*o*d,f=Math.max(-1.42,Math.min(1.42,n+.088*Math.sin(3*l+t*1.4-r*.35))),_=Math.cos(f),v=[e[0]+s*_*Math.cos(l),e[1]+s*Math.sin(f),e[2]+s*_*Math.sin(l)];if(g){let e=Math.sin(o*Math.PI)*(.36+.44*Math.min(1,m))*a;u.push(g[0],g[1],g[2],h[0],h[1],h[2],e*.78),u.push(v[0],v[1],v[2],h[0],h[1],h[2],e)}g=v}}}return u}var Vr=`ulg.astrophysics.orbital-remote-sensing.v1`,Hr=66743e-15,Ur=198847e25;function Wr(e){if(Number.isFinite(Number(e?.surfaceGravityMS2))&&Number(e.surfaceGravityMS2)>0)return Number(e.surfaceGravityMS2);let t=Math.max(0x38d7ea4c68000,(Number(e?.massSolar)||3e-6)*Ur),n=Math.max(1e3,(Number(e?.radiusKm)||6371)*1e3);return Math.max(.01,Math.min(45,Hr*t/(n*n)))}function Gr(e,t=null,{planetaryMode:n=`standard`,cToO:r=.55,seed:i=20261125}={}){if(!e)return null;if(e.isStar||e.kind===0||e.kind===5){let t=String(e.stage||`main-sequence`),n=Number(e.tempK??e.effectiveTempK)||5778,r=t===`neutron-star`||t===`magnetar`||t===`supernova-remnant-pwn`,i=t===`stellar-black-hole`||t===`hypernova-remnant`||e.kind===5,a=t===`white-dwarf`||t===`planetary-nebula`;return Object.freeze({schema:Vr,biosignatureLevel:`stellar`,biosignatureScore:0,biosignatureBadge:r?`⚡ MAGNETOSPHERIC SYNCHROTRON · Relativistic Pulsar`:i?`🕳️ RELATIVISTIC HORIZON · Accretion X-Ray Continuum`:a?`💎 DEGENERATE C/O REMNANT · Stark-Broadened Balmer`:`☀️ PHOTOSPHERIC PLASMA · T_eff ${Math.round(n).toLocaleString()} K`,biosignatureSummary:r?`Coherent curvature radio & GeV gamma lighthouse pulses; superfluid neutron interior.`:i?`Gravitational photon ring & relativistic Fe Kα 6.4 keV disk fluorescence.`:a?`Electron-degenerate C/O core with H/He atmosphere.`:`Hydrostatic fusing H/He plasma with metallic Fraunhofer absorption lines.`,solventLabel:`Ionized Plasma`,atmosphericGases:r?[{formula:`e⁻/e⁺`,name:`Pair Plasma`,amount:`Relativistic`,isBio:!1},{formula:`Fe`,name:`Neutron Crust`,amount:`Degenerate`,isBio:!1}]:a?[{formula:`C/O`,name:`Degenerate Core`,amount:`99%`,isBio:!1},{formula:`H/He`,name:`Thin Envelope`,amount:`1%`,isBio:!1}]:[{formula:`H`,name:`Hydrogen`,amount:`71–74%`,isBio:!1},{formula:`He`,name:`Helium`,amount:`24–27%`,isBio:!1},{formula:`Z`,name:`Metals (C/N/O/Fe)`,amount:`1–2%`,isBio:!1}],mineralHints:[],spectralFeaturesNm:r?[{nm:430,label:`Synch UV`,isBio:!1},{nm:580,label:`Pair Opt`,isBio:!1}]:[{nm:656.3,label:`Hα`,isBio:!1},{nm:486.1,label:`Hβ`,isBio:!1},{nm:589.3,label:`Na D`,isBio:!1}]})}let a=Math.max(25,Number(e.tempK)||220),o=Math.max(0,Number(e.surfacePressurePa)||0),s=Number(e.radiusKm)||6371,c=Number(e.coreZ)||26,l=Number(e.mantleZ)||14,u=Number(e.surfZ)||14,d=s>=18e3||e.kind===2&&s>=14e3,f=e.kind===3&&s>=14e3,p=!d&&!f,m=(e.color1?.[2]||0)>(e.color1?.[0]||0)+.12&&(e.atm||0)>=.3,h=e.kind===3&&((e.color0?.[2]||0)>=.68||(e.color1?.[2]||0)>(e.color1?.[0]||0)+.08)&&a<185,g=(e.atm||0)>=.55&&o>=5e4,_=Number.isFinite(Number(e.volatileMassFrac))?Math.max(0,Number(e.volatileMassFrac)):m?.06:h?.22:g?.04:(e.atm||0)>=.1&&o>=100?.008:0,v=Number.isFinite(Number(e.particulateMassFrac))?Math.max(0,Number(e.particulateMassFrac)):(e.color0?.[0]||0)>.58&&(e.color0?.[2]||0)<.36&&o>=50?.018:.002,y=n===`magma-ocean`||e.kind===7||a>=950,b=s>=180&&!e.isComet,x=!!e.isCryoMoon||n===`cryo-plumes`||p&&b&&a<185&&_>=.08&&o<5e3,S=!!e.hasOcean||p&&a>=255&&a<=380&&o>=4e3&&_>=.008&&(e.color1?.[2]||0)>(e.color1?.[0]||0)+.1,C=Wr(e),w=Number(t?.tempK??t?.effectiveTempK)||5778,T=o>1?Math.min(80,o*.029/(8.3145*Math.max(40,a))):0,E=(i>>>0^String(e.id||e.name||`w`).length*2654435761>>>0^Math.round(a*17))>>>0,D=z({worldName:e.name||`World`,tempK:a,pressurePa:o,gravityMS2:C,rhoAtmKgM3:T,volatileFrac:_,hasSolidCrust:p,isCryoMoon:x,isMagmaOcean:y,stellarTeffK:w,cToO:Number(e.cToO)||r,civTechK:Number(e.civTechK)||void 0,seed:E}),O=Number(D.biosphereViability)||0,k=D.solvent||`none`,A=Math.round(Number(D.photobiology?.redEdgeNm)||705),j=`sterile`,M=`⚪ STERILE · No Biosignature Detected`,N=`Thermodynamic equilibrium crust/vacuum — zero atmospheric disequilibrium or pigment edge.`,P=[];y?(j=`sterile`,M=`🌋 STERILE · Molten Silicate Outgassing`,N=`Surface exceeds 950 K; thermal IR shows incandescent SiO/SO₂/CO silicate vapor.`):p&&k===`H2O`&&O>=.45&&o>=8e3?(j=`strong`,M=`🟢 STRONG BIOSIGNATURE · O₂/CH₄ + ${A} nm Edge`,N=`Photochemical O₂ + CH₄ disequilibrium detected with ${D.solventFormula} oceans and a ${A} nm photosynthetic surface reflectance edge${D.civTechK>=.45?` (+ narrowband radio technosignature K=${D.civTechK.toFixed(2)})`:``}.`,P.push({nm:Math.min(735,Math.max(410,A)),label:`Edge ${A}nm`,isBio:!0},{nm:687,label:`O₂-B`,isBio:!0},{nm:620,label:`CH₄`,isBio:!0},{nm:600,label:`O₃`,isBio:!0})):k===`H2O-subsurface`||x?(j=`subsurface`,M=`🔵 SUBSURFACE BIOSIGNATURE · Cryo-Plume H₂ + CH₄`,N=`South-polar/fissure ice plumes carry molecular H₂, CH₄, and complex organics from a tidally heated subsurface H₂O ocean.`,P.push({nm:619,label:`CH₄ Plume`,isBio:!0},{nm:486,label:`H₂O Ice`,isBio:!1},{nm:540,label:`Salts`,isBio:!1})):k===`CH4`&&O>=.25?(j=`tentative`,M=`🟡 TENTATIVE CRYOBIO · C₂H₂/H₂ Depletion Anomaly`,N=`Dense N₂/CH₄ haze with liquid hydrocarbon seas shows anomalous surface H₂ & acetylene (C₂H₂) consumption.`,P.push({nm:619,label:`CH₄`,isBio:!0},{nm:543,label:`Tholins`,isBio:!0},{nm:665,label:`C₂H₂ Sink`,isBio:!0})):(k===`H2SO4`||k===`CO2-liq`||k===`NH3`)&&O>=.22?(j=`tentative`,M=`🟡 TENTATIVE CLOUD/CHEMO · ${k===`H2SO4`?`PH₃/UV Cloud Absorber`:`${D.solventFormula} Redox Anomaly`}`,N=k===`H2SO4`?`Temperate upper-cloud aerosol layer shows unexplained 380–460 nm UV absorption and trace PH₃ disequilibrium.`:`Exotic ${D.solventLabel} solvent envelope exhibits non-equilibrium trace reductant cycling.`,P.push({nm:420,label:`UV Abs`,isBio:!0},{nm:590,label:`SO₂/Cloud`,isBio:!1})):k===`H2-He-cloud`&&O>=.25?(j=`tentative`,M=`🟡 AERIAL CLOUD BIO · H₂/NH₃ Convective Chromophores`,N=`Temperate 1–5 bar cloud deck shows non-equilibrium organic chromophores & phosphine/ammonia redox gradients.`,P.push({nm:619,label:`CH₄`,isBio:!1},{nm:645,label:`NH₃`,isBio:!0})):o>=300&&_>=.004&&a>=110&&a<=460?(j=`prebiotic`,M=`🟠 PREBIOTIC POTENTIAL · Trace Volatiles & Organics`,N=`Thin volatile atmosphere or frost reservoirs support prebiotic chemistry, but no active global disequilibrium detected.`,P.push({nm:530,label:`Fe₂O₃/Dust`,isBio:!1},{nm:690,label:`CO₂/H₂O`,isBio:!1})):(j=`sterile`,M=o<10?`⚪ STERILE · Airless Vacuum Body`:`⚪ STERILE · Extreme Abiotic Regime`,N=o<10?`Exposed airless crust / regolith bathed in unshielded stellar radiation; direct mineral reflectance visible.`:`Extreme temperature or pressure outside known catalytic solvent envelopes.`);let F=[];d?F.push({formula:`H₂`,name:`Molecular Hydrogen`,amount:`86–90%`,isBio:!1},{formula:`He`,name:`Helium`,amount:`10–13%`,isBio:!1},{formula:`NH₃`,name:`Ammonia Clouds`,amount:`0.03%`,isBio:!1},{formula:`CH₄`,name:`Methane`,amount:`0.3%`,isBio:!1}):f?F.push({formula:`H₂`,name:`Hydrogen`,amount:`80–83%`,isBio:!1},{formula:`He`,name:`Helium`,amount:`15–18%`,isBio:!1},{formula:`CH₄`,name:`Methane (Red Abs)`,amount:`2.3%`,isBio:!1},{formula:`H₂S`,name:`Hydrogen Sulfide`,amount:`Trace`,isBio:!1}):o>=100?j===`strong`?F.push({formula:`N₂`,name:`Nitrogen`,amount:`76%`,isBio:!1},{formula:`O₂`,name:`Oxygen (Biogenic)`,amount:`21%`,isBio:!0},{formula:`H₂O`,name:`Water Vapor`,amount:`1.4%`,isBio:!1},{formula:`CH₄`,name:`Methane (Diseq.)`,amount:`2–18 ppm`,isBio:!0}):k===`CH4`?F.push({formula:`N₂`,name:`Nitrogen`,amount:`94%`,isBio:!1},{formula:`CH₄`,name:`Methane`,amount:`5.1%`,isBio:!0},{formula:`H₂`,name:`Hydrogen`,amount:`0.1%`,isBio:!1},{formula:`C₂H₆`,name:`Ethane/Tholins`,amount:`Haze`,isBio:!0}):a>440&&o>5e5?F.push({formula:`CO₂`,name:`Supercritical CO₂`,amount:`96%`,isBio:!1},{formula:`N₂`,name:`Nitrogen`,amount:`3.5%`,isBio:!1},{formula:`SO₂/H₂SO₄`,name:`Sulfuric Clouds`,amount:`150 ppm`,isBio:!1},...j===`tentative`?[{formula:`PH₃?`,name:`Cloud Anomaly`,amount:`Trace`,isBio:!0}]:[]):a<260&&o<2e4?F.push({formula:`CO₂`,name:`Carbon Dioxide`,amount:`95%`,isBio:!1},{formula:`N₂`,name:`Nitrogen`,amount:`2.7%`,isBio:!1},{formula:`Ar`,name:`Argon`,amount:`1.6%`,isBio:!1},{formula:`H₂O`,name:`Frost Vapor`,amount:`0.03%`,isBio:!1}):F.push({formula:`N₂`,name:`Nitrogen`,amount:`68%`,isBio:!1},{formula:`CO₂`,name:`Carbon Dioxide`,amount:`28%`,isBio:!1},{formula:`H₂O`,name:`Water Vapor`,amount:`3%`,isBio:!1}):x?F.push({formula:`H₂O`,name:`Plume Vapor`,amount:`91%`,isBio:!1},{formula:`CO₂`,name:`Carbon Dioxide`,amount:`3.2%`,isBio:!1},{formula:`CH₄`,name:`Hydrothermal CH₄`,amount:`1.7%`,isBio:!0},{formula:`H₂`,name:`Serpentinization H₂`,amount:`1.4%`,isBio:!0}):F.push({formula:`Vac`,name:`Exosphere (<10 Pa)`,amount:`Trace Na/He`,isBio:!1});let I=[],L=(e,t,n)=>{I.length<5&&!I.some(t=>t.formula===e)&&I.push({formula:e,name:t,tag:n})};if(d)L(`H₂ (Metallic)`,`Liquid Metallic Hydrogen Core`,`Deep Interior`),L(`NH₄SH`,`Ammonium Hydrosulfide Deck`,`Cloud Strata`),L(`H₂O Ice`,`Deep Supercritical Water`,`Lower Deck`),L(`He`,`Helium Rain Layer`,`Mantle`);else if(f)L(`H₂O/NH₃`,`Superionic Water–Ammonia Mantle`,`Deep Ocean`),L(`CH₄ Ice`,`Methane Hazes & Clathrates`,`Upper Deck`),L(`C (Diamond)`,`High-P Diamond Rain`,`Core Boundary`);else if(y)L(`Mg₂SiO₄`,`Molten Olivine Magma`,`Crust/Lava`),L(`FeS / FeO`,`Liquid Iron-Sulfide Melt`,`Mantle`),L(`SiO₂`,`Basaltic Rhyolite Crust`,`Cooling Plates`),L(`SO₂`,`Volcanic Outgas Plumes`,`Vents`);else{let t=(e.color0?.[0]||0)>.85&&(e.color0?.[1]||0)>.72&&(e.color0?.[2]||0)<.45&&o<50,n=(Number(e.cToO)||r)>=.8||u===6||l===6,i=v>=.008&&a<340&&(e.color0?.[0]||0)>.55&&(e.color0?.[2]||0)<.42;t&&(L(`S₈ / SO₂`,`Allotropic Sulfur & Frost`,`Volcanic Plains`),L(`MgSiO₃`,`Ultramafic Silicate Magma`,`Calderas`),L(`FeS`,`Troilite Sulfide Core`,`Interior`)),n&&(L(`SiC`,`Silicon Carbide Crust`,`High C/O`),L(`C (Graphite/Dia)`,`Carbon & Diamond Mantle`,`High-P`)),S?(L(`H₂O (liq)`,`Saline Liquid Water Ocean`,`Hydrosphere`),L(`SiO₂ / Al₂O₃`,`Granitic Continental Crust`,`Continents`),L(`CaCO₃`,`Carbonate Sediments`,`Shelf/Biogenic`),L(`NaCl`,`Halite Evaporites`,`Basins`)):k===`CH4`?(L(`CH₄ / C₂H₆`,`Liquid Hydrocarbon Seas`,`Polar Lakes`),L(`H₂O Ice`,`Cryogenic Water-Ice Bedrock`,`Highlands`),L(`Tholins`,`Photochemical Organic Dunes`,`Equatorial`)):x||a<185&&_>=.05?(L(`H₂O Ice Ih`,`Tectonic Water-Ice Shell`,`Lithosphere`),L(`NaCl / MgSO₄`,`Briny Hydrated Salts`,`Fissures`),L(`CO₂ / N₂ Ice`,`Cryogenic Volatile Glaciers`,`Surface`)):i?(L(`Fe₂O₃`,`Hematite Ferric Oxide Dust`,`Regolith`),L(`SiO₂`,`Basaltic Plagioclase Rock`,`Highlands`),L(`CO₂ / H₂O Ice`,`Polar Cap Frosts`,`Poles`)):e.isMetallicAsteroid||c===26&&u===26?(L(`Fe-Ni Alloy`,`Kamacite / Taenite Metal`,`Bulk Body`),L(`FeS`,`Troilite Inclusions`,`Veins`),L(`Pt / Ir`,`Siderophile Heavy Metals`,`Trace`)):(L(`SiO₂ / Al₂O₃`,`Anorthosite & Basalt Silicate`,`Crust`),L(`FeTiO₃`,`Ilmenite Titanium-Iron Ore`,`Mare/Basins`),L(`Mg₂SiO₄`,`Olivine-Pyroxene Mantle`,`Ejecta`)),c===26&&!I.some(e=>e.formula.includes(`Fe`))&&L(`Fe-Ni`,`Differentiated Metallic Core`,`Deep Core`)}return Object.freeze({schema:Vr,biosignatureLevel:j,biosignatureScore:Number(O.toFixed(2)),biosignatureBadge:M,biosignatureSummary:N,solventLabel:D.solventLabel||`None`,solventFormula:D.solventFormula||`—`,redEdgeNm:j===`strong`?A:null,civTechK:Number(D.civTechK)||0,atmosphericGases:Object.freeze(F),mineralHints:Object.freeze(I),spectralFeaturesNm:Object.freeze(P)})}var Kr=`ulg.universes.ufo-flight-controller.v1`,qr=.55;function Jr(e,t,n){return Math.max(t,Math.min(n,e))}function Yr(e){let t=Math.hypot(e[0],e[1],e[2],e[3])||1;return[e[0]/t,e[1]/t,e[2]/t,e[3]/t]}function Xr(e,t){let[n,r,i,a]=e,[o,s,c,l]=t;return[a*o+n*l+r*c-i*s,a*s-n*c+r*l+i*o,a*c+n*s-r*o+i*l,a*l-n*o-r*s-i*c]}function Zr(e,t){let n=t*.5,r=Math.sin(n),i=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/i*r,e[1]/i*r,e[2]/i*r,Math.cos(n)]}function Qr(e,t){let[n,r,i,a]=e,[o,s,c]=t,l=2*(r*c-i*s),u=2*(i*o-n*c),d=2*(n*s-r*o);return[o+a*l+(r*d-i*u),s+a*u+(i*l-n*d),c+a*d+(n*u-r*l)]}function $r(e){let t=Yr(e);return{right:Qr(t,[1,0,0]),up:Qr(t,[0,1,0]),fwd:Qr(t,[0,0,-1])}}function ei(e){let{right:t,up:n,fwd:r}=$r(e),i=180/Math.PI,a=Math.asin(Jr(r[1],-1,1))*i,o=Math.atan2(r[0],-r[2])*i,s=Math.atan2(t[1],n[1])*i;return{pitchDeg:Number(a.toFixed(1)),yawDeg:Number(o.toFixed(1)),rollDeg:Number(s.toFixed(1))}}function ti(e,t=[0,1,0]){let n=Math.hypot(e[0],e[1],e[2])||1,r=[e[0]/n,e[1]/n,e[2]/n],i=[-r[0],-r[1],-r[2]],a=t[1]*i[2]-t[2]*i[1],o=t[2]*i[0]-t[0]*i[2],s=t[0]*i[1]-t[1]*i[0],c=Math.hypot(a,o,s);c<1e-5&&(a=1,o=0,s=0,c=1);let l=[a/c,o/c,s/c],u=[i[1]*l[2]-i[2]*l[1],i[2]*l[0]-i[0]*l[2],i[0]*l[1]-i[1]*l[0]],d=l[0],f=u[0],p=i[0],m=l[1],h=u[1],g=i[1],_=l[2],v=u[2],y=i[2],b=d+h+y,x,S,C,w;if(b>0){let e=Math.sqrt(b+1)*2;w=.25*e,x=(v-g)/e,S=(p-_)/e,C=(m-f)/e}else if(d>h&&d>y){let e=Math.sqrt(1+d-h-y)*2;w=(v-g)/e,x=.25*e,S=(f+m)/e,C=(p+_)/e}else if(h>y){let e=Math.sqrt(1+h-d-y)*2;w=(p-_)/e,x=(f+m)/e,S=.25*e,C=(g+v)/e}else{let e=Math.sqrt(1+y-d-h)*2;w=(m-f)/e,x=(p+_)/e,S=(g+v)/e,C=.25*e}return Yr([x,S,C,w])}function ni(e,{surfaceActive:t=!1}={}){let n=Number.isFinite(Number(e))?Number(e):12.2;if(t)return Object.freeze({id:`surface-flight`,label:`Surface Anti-Grav`,shortLabel:`SURFACE`,worldUnitsPerSec:42,warpMultiplier:2.2,unitLabel:`m/s`,metersPerWorldUnit:1,scaleCruiseRate:0});if(n>=22){let e=10**n/14;return Object.freeze({id:`intergalactic`,label:`Intergalactic Warp`,shortLabel:`INTERGALACTIC`,worldUnitsPerSec:12,warpMultiplier:4.5,unitLabel:`Mpc/s`,metersPerWorldUnit:e,scaleCruiseRate:.65})}if(n>=16){let e=10**n/14;return Object.freeze({id:`interstellar`,label:`Interstellar Cruise`,shortLabel:`INTERSTELLAR`,worldUnitsPerSec:11.5,warpMultiplier:4.2,unitLabel:`ly/s`,metersPerWorldUnit:e,scaleCruiseRate:.58})}if(n>=8.8){let e=10**n/14;return Object.freeze({id:`interplanetary`,label:`Interplanetary Drive`,shortLabel:`INTERPLANETARY`,worldUnitsPerSec:11,warpMultiplier:3.8,unitLabel:`AU/hr`,metersPerWorldUnit:e,scaleCruiseRate:.52})}if(n>=-5.6){let e=10**n/14;return Object.freeze({id:`planetary`,label:`Planetary Orbital`,shortLabel:`PLANETARY`,worldUnitsPerSec:10,warpMultiplier:3.2,unitLabel:`km/s`,metersPerWorldUnit:e,scaleCruiseRate:.45})}let r=10**n/14;return Object.freeze({id:`quantum`,label:`Subatomic Probe`,shortLabel:`QUANTUM`,worldUnitsPerSec:9,warpMultiplier:2.5,unitLabel:n<-12?`fm/s`:`pm/s`,metersPerWorldUnit:r,scaleCruiseRate:.35})}function ri(e,t){let n=Math.max(0,Number(e)||0)*(t?.metersPerWorldUnit||1);if(!t||t.id===`surface-flight`)return n>=1e3?`${(n/1e3).toFixed(2)} km/s`:`${n.toFixed(1)} m/s`;if(t.id===`intergalactic`){let e=n/3085677581e13;return`${e>=10?e.toFixed(1):e.toFixed(2)} Mpc/s`}if(t.id===`interstellar`){let e=n/946073047e7;return e>=1e3?`${(e/1e3).toFixed(2)} kly/s`:`${e>=10?e.toFixed(1):e.toFixed(2)} ly/s`}if(t.id===`interplanetary`){let e=n/299792458;return e>=.1?`${e>=10?e.toFixed(1):e.toFixed(2)} c`:`${(n*3600/149597870700).toFixed(2)} AU/hr`}if(t.id===`planetary`){let e=n/1e3;return e>=1e4?`${(e/299792.458).toFixed(2)} c`:`${e>=100?e.toFixed(0):e.toFixed(1)} km/s`}return t.unitLabel===`fm/s`?`${(n*0x38d7ea4c68000).toFixed(1)} fm/s`:`${(n*0xe8d4a51000).toFixed(1)} pm/s`}function ii(e,t=.14){if(!e||e.connected===!1)return{connected:!1,id:``,strafe:0,thrust:0,yawRate:0,pitchRate:0,rollRate:0,ascend:0,warpBoost:0,brake:0,chaseZoomDir:0,scaleZoomDir:0,fire:!1,tractor:!1,toggleMode:!1,toggleCockpit:!1,levelHorizon:!1,launchMissile:!1};let n=e=>{let n=Number(e)||0;return Math.abs(n)<t?0:Math.sign(n)*((Math.abs(n)-t)/(1-t))},r=t=>{let n=e.buttons?.[t];return n==null?0:typeof n==`number`?n:Number(n.value)||+!!n.pressed},i=e=>r(e)>.35,a=e.axes||[],o=+!!i(4),s=+!!i(5),c=+!!i(0),l=+!!i(1),u=+!!i(12),d=+!!i(13),f=+!!i(14),p=+!!i(15);return{connected:!0,id:String(e.id||`Xbox Gamepad`),strafe:n(a[0]),thrust:-n(a[1]),yawRate:-n(a[2]),pitchRate:-n(a[3]),rollRate:o-s,ascend:c-l,warpBoost:Jr(r(7),0,1),brake:Jr(r(6),0,1),chaseZoomDir:d-u,scaleZoomDir:f-p,fire:i(2),tractor:i(3),toggleMode:i(8),toggleCockpit:i(9),levelHorizon:i(10),launchMissile:i(11)}}function ai({initialMode:e=`orbit`}={}){let t=e===`ufo`?`ufo`:`orbit`,n=[0,1.8,13.5],r=[0,0,0],i=[0,0,0,1],a=1,o=0,s=!1,c=``,l=ni(24.8),u=0,d=`0.0 Mpc/s`,f={toggleMode:!1,toggleCockpit:!1,tractor:!1,launchMissile:!1,levelHorizon:!1},p={forward:!1,backward:!1,left:!1,right:!1,ascend:!1,descend:!1,rollLeft:!1,rollRight:!1,pitchUp:!1,pitchDown:!1,yawLeft:!1,yawRight:!1,boost:!1,brake:!1};function m(e,t){let a=[t[0]-e[0],t[1]-e[1],t[2]-e[2]],o=Math.hypot(a[0],a[1],a[2])||1,s=[a[0]/o,a[1]/o,a[2]/o];n=[e[0]+s[0]*5.8,e[1]+s[1]*5.8-1.2,e[2]+s[2]*5.8],r=[0,0,0],i=ti(s,[0,1,0])}function h(e=[0,4.5,16],t=[0,0,0]){m(e,t),a=1}function g(e,n=null){let r=e===`ufo`?`ufo`:`orbit`;return r===`ufo`&&t!==`ufo`&&n?.eye&&n?.target&&m(n.eye,n.target),t=r,t}function _(e=null){return g(t===`ufo`?`orbit`:`ufo`,e)}function v(e={}){Object.assign(p,e)}function y(){for(let e of Object.keys(p))p[e]=!1}function b(e=0,t=0,n=0){let r=i;return Math.abs(t)>1e-7&&(r=Xr(r,Zr([0,1,0],t))),Math.abs(e)>1e-7&&(r=Xr(r,Zr([1,0,0],e))),Math.abs(n)>1e-7&&(r=Xr(r,Zr([0,0,1],n))),i=Yr(r),i}function x(){let{fwd:e}=$r(i);return i=ti(Math.hypot(e[0],e[2])>.05?[e[0],0,e[2]]:[0,0,-1],[0,1,0]),i}function S(e){let t=Number(e);return!Number.isFinite(t)||t<=0||(a=Jr(a*t,qr,45)),a}function C(e){let t=Number(e);return Number.isFinite(t)&&(a=Jr(t,qr,45)),a}function w(e=null){let t=e;if(!t&&typeof navigator<`u`&&typeof navigator.getGamepads==`function`)try{t=navigator.getGamepads()}catch{t=[]}let n=null;if(t){for(let e=0;e<t.length;e+=1)if(t[e]&&t[e].connected!==!1){n=t[e];break}}let r=ii(n);s=r.connected,c=r.id;let i={toggleModePressed:r.toggleMode&&!f.toggleMode,toggleCockpitPressed:r.toggleCockpit&&!f.toggleCockpit,tractorPressed:r.tractor&&!f.tractor,launchMissilePressed:r.launchMissile&&!f.launchMissile,levelHorizonPressed:r.levelHorizon&&!f.levelHorizon};return f.toggleMode=r.toggleMode,f.toggleCockpit=r.toggleCockpit,f.tractor=r.tractor,f.launchMissile=r.launchMissile,f.levelHorizon=r.levelHorizon,{gp:r,actions:i}}function T(e,{log10SpanM:t=12.2,gamepadInput:s=null}={}){let c=Jr(Number(e)||.016,.001,.1),f=ni(t,{surfaceActive:!1});l=f;let m=s||ii(null),h=!!p.forward-+!!p.backward,g=!!p.right-+!!p.left,_=!!p.ascend-+!!p.descend,v=!!p.rollLeft-+!!p.rollRight,y=!!p.pitchUp-+!!p.pitchDown,x=!!p.yawLeft-+!!p.yawRight,C=Jr(h+m.thrust,-1,1),w=Jr(g+m.strafe,-1,1),T=Jr(_+m.ascend,-1,1),E=Jr(v+m.rollRate,-1,1),D=Jr(y+m.pitchRate,-1,1),O=Jr(x+m.yawRate,-1,1),k=Math.max(+!!p.boost,m.warpBoost),A=Math.max(+!!p.brake,m.brake);o=k;let j=1.95;b(D*j*c,O*j*c,E*2.15*c),Math.abs(m.chaseZoomDir)>.1&&S(4.8**(m.chaseZoomDir*c));let M=$r(i),N=f.worldUnitsPerSec*(1+k*(f.warpMultiplier-1)),P=N*4.2;r[0]+=(M.fwd[0]*C+M.right[0]*w+M.up[0]*T)*P*c,r[1]+=(M.fwd[1]*C+M.right[1]*w+M.up[1]*T)*P*c,r[2]+=(M.fwd[2]*C+M.right[2]*w+M.up[2]*T)*P*c;let F=Math.exp(-(A>.1?8.5:3.2)*c);r[0]*=F,r[1]*=F,r[2]*=F;let I=Math.hypot(r[0],r[1],r[2]);if(I>N){let e=N/I;r[0]*=e,r[1]*=e,r[2]*=e}n[0]+=r[0]*c,n[1]+=r[1]*c,n[2]+=r[2]*c;let L=Math.hypot(n[0],n[1],n[2]);if(L>320){let e=320/L;n[0]*=e,n[1]*=e,n[2]*=e}u=Math.hypot(r[0],r[1],r[2]),d=ri(u,f);let R=Math.abs(m.scaleZoomDir)>.1?m.scaleZoomDir*1.8*c:0;return{pos:[...n],vel:[...r],quat:[...i],basis:M,chaseDistMul:a,regime:f,speedWorld:u,speedLabel:d,deltaLog10Scale:R}}function E({cockpit:e=!1}={}){let t=$r(i);if(e){let e=[n[0]+t.up[0]*.18+t.fwd[0]*.1,n[1]+t.up[1]*.18+t.fwd[1]*.1,n[2]+t.up[2]*.18+t.fwd[2]*.1];return{eye:e,target:[e[0]+t.fwd[0]*12,e[1]+t.fwd[1]*12,e[2]+t.fwd[2]*12],up:t.up,basis:t}}let r=5.9*a,o=1.65*a**.85;return{eye:[n[0]-t.fwd[0]*r+t.up[0]*o,n[1]-t.fwd[1]*r+t.up[1]*o,n[2]-t.fwd[2]*r+t.up[2]*o],target:[n[0]+t.fwd[0]*(8+r*.28),n[1]+t.fwd[1]*(8+r*.28),n[2]+t.fwd[2]*(8+r*.28)],up:t.up,basis:t}}function D(e=12.2,l=!1){let f=ni(e,{surfaceActive:l}),p=$r(i),m=ei(i);return{schema:Kr,mode:t,pos:[...n],vel:[...r],quat:[...i],basis:p,eulerDeg:m,chaseDistMul:Number(a.toFixed(2)),warpBoost:Number(o.toFixed(2)),regime:f,speedWorld:Number(u.toFixed(3)),speedLabel:d,gamepadConnected:s,gamepadId:c}}return Object.freeze({get mode(){return t},get pos(){return n},get vel(){return r},get quat(){return i},get chaseDistMul(){return a},get gamepadConnected(){return s},get gamepadId(){return c},get lastRegime(){return l},setMode:g,toggleMode:_,syncFromOrbitCamera:m,resetPosition:h,setKeys:v,clearKeys:y,rotateLocal:b,levelHorizon:x,adjustChaseZoom:S,setChaseZoom:C,pollGamepads:w,stepSpace:T,getSpaceCameraPose:E,getState:D})}function oi(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function si(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function ci(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function li(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function ui(e,t,n,r=1/0){let i=1/Math.tan(e*.5),a=new Float32Array(16);return a[0]=i/Math.max(.25,t),a[5]=i,a[10]=0,a[11]=-1,a[14]=n,a}function di(e,t,n){let r=li(oi(t,e)),i=li(si(r,n)),a=si(i,r),o=new Float32Array(16);return o[0]=i[0],o[4]=i[1],o[8]=i[2],o[12]=-ci(i,e),o[1]=a[0],o[5]=a[1],o[9]=a[2],o[13]=-ci(a,e),o[2]=-r[0],o[6]=-r[1],o[10]=-r[2],o[14]=ci(r,e),o[3]=0,o[7]=0,o[11]=0,o[15]=1,{mat:o,right:i,up:a,fwd:r}}function fi(e,t){let n=new Float32Array(16);for(let r=0;r<4;r+=1)for(let i=0;i<4;i+=1)n[r*4+i]=e[0+i]*t[r*4+0]+e[4+i]*t[r*4+1]+e[8+i]*t[r*4+2]+e[12+i]*t[r*4+3];return n}function pi(e,t,n,r){let i=e[0],a=e[1],o=e[2],s=t[0]*i+t[4]*a+t[8]*o+t[12],c=t[1]*i+t[5]*a+t[9]*o+t[13],l=t[2]*i+t[6]*a+t[10]*o+t[14],u=t[3]*i+t[7]*a+t[11]*o+t[15];if(u<=.02)return{visible:!1,sx:-999,sy:-999,uvX:.5,uvY:.5,depth:1};let d=s/u,f=c/u,p=l/u,m=d*.5+.5,h=.5-f*.5;return{visible:p>=0&&p<=1&&m>=-.15&&m<=1.15&&h>=-.15&&h<=1.15,sx:m*n,sy:h*r,uvX:m,uvY:h,depth:p,w:u}}function mi(e){let t=0,n=0,r=0;e>=380&&e<440?(t=-(e-440)/60,r=1):e<490?(n=(e-440)/50,r=1):e<510?(n=1,r=-(e-510)/20):e<580?(t=(e-510)/70,n=1):e<645?(t=1,n=-(e-645)/65):e<=740&&(t=1);let i=e<420?.3+.7*((e-380)/40):e>680?.3+.7*((740-e)/60):1;return[Math.round(Math.max(0,Math.min(1,t*i))*255),Math.round(Math.max(0,Math.min(1,n*i))*255),Math.round(Math.max(0,Math.min(1,r*i))*255)]}function hi(e){return Math.max(0,Math.min(1,e))}function gi(e,t,n){if(e>t)return 1-gi(t,e,n);let r=hi((n-e)/Math.max(1e-6,t-e));return r*r*(3-2*r)}function _i(e,t,n,r,i){return e<=t||e>=i?0:e<n?gi(t,n,e):e>r?1-gi(r,i,e):1}function vi(e,t=[.28,.72,.96,.32]){let[n,r,i]=e,a=[[-n,-r,-i],[n,-r,-i],[n,r,-i],[-n,r,-i],[-n,-r,i],[n,-r,i],[n,r,i],[-n,r,i]],o=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],s=new Float32Array(o.length*2*7),c=0;for(let[e,n]of o)s.set([...a[e],...t],c),c+=7,s.set([...a[n],...t],c),c+=7;return s}function yi(e,t,n,r,i=1){if(!e||i<.02)return[];let a=[],o=e.catalog||Qe,s=Math.min(e.massiveCount,o.length),c=Array.from({length:s},(t,n)=>e.getMassiveBodyState64(n)),l=c[0]?.posAu||[0,0,0],u=c[0]?.velAuPerYr||[0,0,0],d=c[0]?.massSolar||1;if(s>=2&&(o[1]?.isStar||o[1]?.orbitRole===`binary-companion`)){let e=c[0].massSolar,t=c[1].massSolar;d=Math.max(1e-12,e+t),l=[(e*c[0].posAu[0]+t*c[1].posAu[0])/d,(e*c[0].posAu[1]+t*c[1].posAu[1])/d,(e*c[0].posAu[2]+t*c[1].posAu[2])/d],u=[(e*c[0].velAuPerYr[0]+t*c[1].velAuPerYr[0])/d,(e*c[0].velAuPerYr[1]+t*c[1].velAuPerYr[1])/d,(e*c[0].velAuPerYr[2]+t*c[1].velAuPerYr[2])/d]}for(let e=1;e<s;e+=1){let s=o[e],f=s.parent===-2,p=f?-2:s.parent>=0?s.parent:0,m=!!s.isStar,h=!m&&p>=0&&!o[p]?.isStar&&p>0;if(h&&r>10.6||!h&&r<8.4)continue;let g=f?l:c[p].posAu,_=f?u:c[p].velAuPerYr,v=f?d:c[p].massSolar,y=c[e],b=y.posAu[0]-g[0],x=y.posAu[1]-g[1],S=y.posAu[2]-g[2],C=y.velAuPerYr[0]-_[0],w=y.velAuPerYr[1]-_[1],T=y.velAuPerYr[2]-_[2],E=Math.hypot(b,x,S),D=C*C+w*w+T*T,O=Xe*(v+y.massSolar);if(!(E>1e-8&&O>1e-12))continue;let k=.5*D-O/E;if(k>=-1e-6)continue;let A=-O/(2*k),j=si([b,x,S],[C,w,T]),M=Math.hypot(j[0],j[1],j[2]);if(!(M>1e-10))continue;let N=[j[0]/M,j[1]/M,j[2]/M],P=si([C,w,T],j),F=[P[0]/O-b/E,P[1]/O-x/E,P[2]/O-S/E],I=Math.min(.985,Math.hypot(F[0],F[1],F[2])),L=I>1e-5?[F[0]/I,F[1]/I,F[2]/I]:li([b,x,S]),R=si(N,L),z=A*Math.sqrt(Math.max(.01,1-I*I)),ee=g[0]-t[0],B=g[1]-t[1],V=g[2]-t[2],te=s.color0||[.38,.72,1],ne=(m?.52:h?.34:s.id===`halley`?.16:.28)*i,re=null;for(let e=0;e<=72;e+=1){let t=e/72*Math.PI*2,r=A*(Math.cos(t)-I),i=z*Math.sin(t),o=[(ee+r*L[0]+i*R[0])*n,(B+r*L[1]+i*R[1])*n,(V+r*L[2]+i*R[2])*n];re&&(a.push(...re,te[0],te[1],te[2],ne),a.push(...o,te[0],te[1],te[2],ne)),re=o}}return a}function bi(e,{focusedSolarBodyIndex:t=3,focusedBodyIsStar:n=null,galaxyBranch:r=`solar-system`}={}){let i=n==null?t===0:!!n;return e>=22.3?0:e>=16.2?1:e>=8.75?r!==`smbh-core`&&i&&e<=9.8?3:2:e>=-5.6?i&&e>=7.2?3:4:e>=-9.1?5:e>=-12.8?6:7}function xi(e){let t=Math.max(2e5,(Number(e?.radiusKm)||6371)*1e3),n=e?.ringed?5.2:3.65;return Math.min(8.68,Math.max(6.2,Math.log10(t*n)))}function Si(e){return Math.max(st,Math.min(ot,Number(e)))}async function Ci(){let{device:e}=await F({label:`ulg-universes-demo`,xrCompatible:!0}),t=[];e.addEventListener(`uncapturederror`,e=>{t.push(String(e?.error?.message??e))}),S(e,`ulg-universes-demo`);let n=new URLSearchParams(window.location.search),r=Be(window.location.search),i=Math.max(1,Math.min(118,Number.parseInt(n.get(`Z`)||n.get(`z`)||`26`,10)||26)),a=r.seed==null?Number.parseInt(n.get(`seed`)||`20261125`,10)||20261125:Math.trunc(r.seed),o=ut[n.get(`quality`)]?n.get(`quality`):`med`,s=ct[0].log10SpanM;r.log10SpanM==null?n.has(`scale`)?s=Si(Number.parseFloat(n.get(`scale`))||24.8):n.has(`level`)&&(s=ct[Math.max(0,Math.min(7,Number.parseInt(n.get(`level`),10)||0))].log10SpanM):s=Si(r.log10SpanM);let c=document.getElementById(`uv-canvas`),l=document.getElementById(`uv-reticle-canvas`),u=l?.getContext(`2d`),d=document.getElementById(`uv-scale-rail`),f=document.getElementById(`uv-epoch-rail`),p=document.getElementById(`uv-zoom-slider`),m=document.getElementById(`uv-zoom-readout`),h=document.getElementById(`uv-status-dot`),g=document.getElementById(`uv-scale-badge`),_=document.getElementById(`uv-clock-badge`),v=document.getElementById(`uv-fps-badge`),y=document.getElementById(`uv-cockpit-btn`),b=document.getElementById(`uv-xr-btn`),x=document.getElementById(`uv-share-btn`),C=document.getElementById(`uv-room-btn`),w=document.getElementById(`uv-autopilot-btn`),T=document.getElementById(`uv-sim-btn`),E=document.getElementById(`uv-config-btn`),D=document.getElementById(`uv-help-btn`),O=document.getElementById(`uv-sim-drawer`),k=document.getElementById(`uv-config-drawer`),A=document.getElementById(`uv-cargo-btn`),j=document.getElementById(`uv-cargo-drawer`),M=document.getElementById(`uv-cargo-specimens`),N=document.getElementById(`uv-cargo-samples`),I=document.getElementById(`uv-cargo-resources`),R=document.getElementById(`uv-cargo-probe-btn`),z=document.getElementById(`uv-cargo-dyson-btn`),V=document.getElementById(`uv-help-drawer`),te=document.getElementById(`uv-pause-btn`),ne=document.getElementById(`uv-orbit-up-btn`),re=document.getElementById(`uv-timescale-slider`),ie=document.getElementById(`uv-timescale-val`),ae=document.getElementById(`uv-bigbang-btn`),oe=document.getElementById(`uv-reseed-btn`),H=document.getElementById(`uv-scale-controls`),ce=document.getElementById(`uv-quality-group`),le=document.getElementById(`uv-lensing-toggle`),fe=document.getElementById(`uv-orbits-toggle`),pe=document.getElementById(`uv-travel-toggle`),me=document.getElementById(`uv-autospin-toggle`),he=document.getElementById(`uv-crt-toggle`),ge=document.getElementById(`uv-pixel-slider`),_e=document.getElementById(`uv-pixel-val`),be=document.getElementById(`uv-peer-url`),Se=document.getElementById(`uv-peer-role`),Ce=document.getElementById(`uv-peer-connect-btn`),we=document.getElementById(`uv-peer-status`),Ee=document.getElementById(`uv-inspector`),De=document.getElementById(`uv-command-deck`),Oe=document.getElementById(`uv-deck-collapse-btn`),ke=document.getElementById(`uv-scan-btn`),Ae=document.getElementById(`uv-flight-btn`),Me=document.getElementById(`uv-flight-pane`),Ne=document.getElementById(`uv-mode-orbit-btn`),Pe=document.getElementById(`uv-mode-ufo-btn`),Fe=document.getElementById(`uv-flight-orbit-btn`),Ie=document.getElementById(`uv-flight-ufo-btn`),Le=document.getElementById(`uv-gamepad-badge`),Re=document.getElementById(`uv-flight-regime-lbl`),ze=document.getElementById(`uv-flight-speed-lbl`),Ue=document.getElementById(`uv-flight-attitude-lbl`),We=document.getElementById(`uv-flight-level-btn`),Ge=document.getElementById(`uv-flight-reset-btn`),U=document.getElementById(`uv-flight-cockpit-btn`),qe=document.getElementById(`uv-flight-chase-slider`),Ye=document.getElementById(`uv-flight-chase-val`),Xe=document.getElementById(`uv-chase-presets`),Ze=document.getElementById(`uv-flight-fire-btn`),$e=document.getElementById(`uv-flight-missile-btn`),et=document.getElementById(`uv-flight-tractor-btn`),tt=document.getElementById(`uv-flight-gamepad-status`),nt=document.getElementById(`uv-remote-sensing-box`),rt=document.getElementById(`uv-collapse-btn`),it=document.getElementById(`uv-info-quick-btn`),at=document.getElementById(`uv-target-kicker`),mt=document.getElementById(`uv-target-name`),ht=document.getElementById(`uv-target-sub`),gt=document.getElementById(`uv-spec-title`),_t=document.getElementById(`uv-comp-text`),vt=document.getElementById(`uv-spectrograph-canvas`),yt=document.getElementById(`uv-stats-grid`),bt=document.getElementById(`uv-sample-strip`),xt=document.getElementById(`uv-plot-title`),St=document.getElementById(`uv-plot-meta`),Ct=document.getElementById(`uv-plot-canvas`),W=document.getElementById(`uv-dive-btn`),wt=document.getElementById(`uv-focus-mote-btn`),Tt=document.getElementById(`uv-surface-quick-btn`),Et=document.getElementById(`uv-return-btn`),Dt=document.getElementById(`uv-engine-tag`),Ot=document.getElementById(`uv-breadcrumb`),kt=document.getElementById(`uv-hint-pill`),jt=document.getElementById(`uv-surface-hud`),Nt=document.getElementById(`uv-surf-telemetry`),G=document.getElementById(`uv-surf-chem-bar`),Pt=document.getElementById(`uv-surf-reaction-bar`),Ft=document.getElementById(`uv-surf-weapon-bar`),It=document.getElementById(`uv-weapon-fire-btn`),Lt=document.getElementById(`uv-tractor-btn`),Rt=document.getElementById(`uv-lambda-slider`),zt=document.getElementById(`uv-lambda-readout`),Bt=document.getElementById(`uv-power-slider`),Vt=document.getElementById(`uv-power-readout`),Ht=document.getElementById(`uv-probe-btn`),Ut=document.getElementById(`uv-kardashev-badge`),Wt=document.getElementById(`uv-surf-sample-btn`),Gt=document.getElementById(`uv-surf-timewarp-btn`),Kt=document.getElementById(`uv-surf-xeno-btn`),qt=document.getElementById(`uv-surf-jump-btn`),Jt=document.getElementById(`uv-surf-descend-btn`),Yt=document.getElementById(`uv-surf-vehicle-btn`),Xt=document.getElementById(`uv-surf-cam-btn`),Zt=document.getElementById(`uv-surf-orbit-btn`),Qt=document.getElementById(`uv-em-sensor-btn`),$t=document.getElementById(`uv-em-sensor-bar`),en=document.getElementById(`uv-em-readout`),tn=document.getElementById(`uv-em-close-btn`),K=document.getElementById(`uv-em-track`),nn=document.getElementById(`uv-em-window`),rn=document.getElementById(`uv-em-caret-min`),an=document.getElementById(`uv-em-caret-max`),on=document.getElementById(`uv-em-presets`),sn=document.getElementById(`uv-touch-pads`),cn=document.getElementById(`uv-joy-move`),ln=document.getElementById(`uv-joy-move-knob`),un=document.getElementById(`uv-joy-look`),dn=document.getElementById(`uv-joy-look-knob`),fn=document.getElementById(`uv-warp-overlay`),pn=document.getElementById(`uv-help-scale-tag`),mn=document.getElementById(`uv-about-scale-btn`),hn=document.getElementById(`uv-about-ulg-btn`),gn=document.getElementById(`uv-modal-backdrop`),_n=document.getElementById(`uv-modal-title`),vn=document.getElementById(`uv-modal-sub`),yn=document.getElementById(`uv-modal-content`),bn=document.getElementById(`uv-modal-close`),xn=Dr(e,c),Sn=xe(e),q=dr(e,{seed:a,qualityId:o,initialElementZ:i}),J=ai({initialMode:n.get(`flight`)===`ufo`?`ufo`:`orbit`}),Cn=At(),wn=null,Tn=!1,En=null,Dn=`scan`,On=!!r.cockpit,kn=`laser`,An=-6.27,jn=25e7,Mn=!1,Nn=!1,Pn=r.simTimeS??0,Fn=0,In=1,Ln=null,Rn=null,zn=null,Bn=[],Vn=[],Hn={vis:{min:-6.42,max:-6.12,active:!1,label:`👁 Human Visible (380–750 nm)`},jwst:{min:-6,max:-4.7,active:!0,label:`🔭 JWST NIRCam / MIRI IR (1–20 μm)`},ir:{min:-5.45,max:-4.6,active:!0,label:`🔥 Thermal IR (3.5–25 μm)`},uv:{min:-7.9,max:-6.5,active:!0,label:`⚡ UV / Aurora (12–320 nm)`},xray:{min:-12,max:-8.2,active:!0,label:`☢️ X-Ray / Gamma (1 pm–6 nm)`},radio:{min:-1.1,max:.8,active:!0,label:`📡 21 cm Radio / Synchrotron (8 cm–6 m)`},cmb:{min:-3.2,max:-2,active:!0,label:`🌌 CMB / mm Microwave (0.6–10 mm)`}},Y={log10LambdaMin:-6.42,log10LambdaMax:-6.12,active:!1,gain:1,preset:`vis`};function Un(e){let t=10**e;return t<1e-11?`${(t*0xe8d4a51000).toFixed(1)} pm`:t<1e-9?`${(t*0xe8d4a51000).toFixed(0)} pm`:t<1e-6?`${(t*1e9).toFixed(0)} nm`:t<.001?`${(t*1e6).toFixed(1)} μm`:t<.1?`${(t*1e3).toFixed(1)} mm`:t<1?`${(t*100).toFixed(1)} cm`:`${t.toFixed(1)} m`}function Wn(){let e=Math.max(0,Math.min(1,(Y.log10LambdaMin- -13)/14))*100,t=Math.max(0,Math.min(1,(Y.log10LambdaMax- -13)/14))*100;if(rn&&(rn.style.left=`${e.toFixed(2)}%`),an&&(an.style.left=`${t.toFixed(2)}%`),nn&&(nn.style.left=`${e.toFixed(2)}%`,nn.style.width=`${Math.max(.8,t-e).toFixed(2)}%`),en){let e=Y.preset&&Hn[Y.preset];en.textContent=Y.active?e?.label||`${Un(Y.log10LambdaMin)} – ${Un(Y.log10LambdaMax)} (10^${Y.log10LambdaMin.toFixed(1)}..10^${Y.log10LambdaMax.toFixed(1)} m)`:`👁 Human Visible (380–750 nm)`}if(Qt){let e=Y.active||Dn===`em`;Qt.classList.toggle(`active`,e);let t=Qt.querySelector(`.uv-tab-lbl`),n=Y.active?Un(.5*(Y.log10LambdaMin+Y.log10LambdaMax)):`EM`;t?t.textContent=n:Qt.textContent=`🌈 ${n}`}if(on)for(let e of on.querySelectorAll(`[data-em-preset]`))e.classList.toggle(`active`,e.dataset.emPreset===Y.preset)}function Gn(e,t,{active:n=null,preset:r=`custom`,gain:i=1}={}){let a=Math.max(-13,Math.min(.85,Number(e))),o=Math.max(a+.15,Math.min(1,Number(t)));(!Number.isFinite(a)||!Number.isFinite(o))&&(a=-6.42,o=-6.12),Y.log10LambdaMin=a,Y.log10LambdaMax=o;let s=Math.abs(a- -6.42)<.08&&Math.abs(o- -6.12)<.08;return Y.active=n===null?!s:!!n,Y.preset=Y.active?r:`vis`,Y.gain=Math.max(.2,Math.min(4,Number(i)||1)),Wn(),{...Y}}if(Qt?.addEventListener(`click`,()=>{Jr(Dn===`em`?`scan`:`em`),Wn()}),tn?.addEventListener(`click`,()=>{Jr(`scan`),Wn()}),on)for(let e of on.querySelectorAll(`[data-em-preset]`))e.addEventListener(`click`,()=>{let t=e.dataset.emPreset,n=Hn[t];n&&(Gn(n.min,n.max,{active:n.active,preset:t}),$(performance.now()))});if(K){let e=null,t=0,n=-6.42,r=-6.12,i=e=>{let t=K.getBoundingClientRect();return-13+Math.max(0,Math.min(1,(e-t.left)/Math.max(1,t.width)))*14},a=(a,o)=>{o.preventDefault(),o.stopPropagation(),e=a,t=i(o.clientX),n=Y.log10LambdaMin,r=Y.log10LambdaMax,K.setPointerCapture?.(o.pointerId)};rn?.addEventListener(`pointerdown`,e=>a(`min`,e)),an?.addEventListener(`pointerdown`,e=>a(`max`,e)),nn?.addEventListener(`pointerdown`,e=>a(`window`,e)),K.addEventListener(`pointerdown`,e=>{if(e.target===rn||e.target===an||e.target===nn)return;let t=i(e.clientX),n=Math.abs(t-Y.log10LambdaMin)<=Math.abs(t-Y.log10LambdaMax)?`min`:`max`;a(n,e),n===`min`?Gn(Math.min(t,Y.log10LambdaMax-.15),Y.log10LambdaMax,{active:!0,preset:`custom`}):Gn(Y.log10LambdaMin,Math.max(t,Y.log10LambdaMin+.15),{active:!0,preset:`custom`}),$(performance.now())}),K.addEventListener(`pointermove`,a=>{if(!e)return;let o=i(a.clientX);if(e===`min`)Gn(Math.min(o,Y.log10LambdaMax-.15),Y.log10LambdaMax,{active:!0,preset:`custom`});else if(e===`max`)Gn(Y.log10LambdaMin,Math.max(o,Y.log10LambdaMin+.15),{active:!0,preset:`custom`});else if(e===`window`){let e=r-n,i=o-t,a=Math.max(-13,Math.min(1-e,n+i));Gn(a,a+e,{active:!0,preset:`custom`})}$(performance.now())});let o=t=>{e&&(e=null,K.releasePointerCapture?.(t.pointerId))};K.addEventListener(`pointerup`,o),K.addEventListener(`pointercancel`,o)}Wn();let Kn=[1,1e3,1e5,1e6];function qn(e){return e>=1e6?`10⁶× SKY`:e>=1e5?`10⁵× SKY`:e>=1e3?`10³× SKY`:`1× SKY`}Gt?.addEventListener(`click`,()=>{let e=q.surfaceTimeWarp||1,t=Kn.findIndex(t=>t>e*1.05),n=t>=0?Kn[t]:Kn[0];q.setSurfaceTimeWarp(n),Pi()});let X=Ke(),Jn=je(e,{onStateChange:e=>{b&&(b.classList.toggle(`active`,e.active),b.textContent=e.active?`🥽 Exit XR`:`🥽 XR`,b.title=e.statusText)}}),Yn=He({onWeaponHitLocal:e=>{X.applyDamage(e.damage||10),Ar=Math.max(Ar,.25)},onRemoteMissile:e=>{q.surfaceActive&&e?.pos&&q.launchSurfaceMissile({fromPos:e.pos,vel:e.vel,aimWorldPos:e.target,isRemote:!0})},onRemoteCraterStamp:e=>{q.surfaceActive&&e&&q.applyRemoteCraterStamp(e)},onStateChange:()=>{cr()}}),Xn=[],Zn=new Map,Qn=!1;function $n(){return q.galaxyBranch===`smbh-core`?`smbh-core`:q.useSolReference?`sol`:String(q.activeCausalSystem?.systemName||`site-${q.activeStarSite?.starIndex??0}`)}function er(){let e=(q.getActiveSystemCatalog?.()||[])[0],t=Math.max(.02,Number(e?.luminositySolar)||1);X.setActiveSystemContext({systemKey:$n(),starPosGal:q.activeStarSite?.posGal||q.galaxyFocusPos||[4.8,.04,2.1],starLumW:t*3828e23})}function tr(){q.surfaceActive&&(q.exitSurfaceView(),Pi()),q.unloadStarSystemRegimes({resetModes:!0}),Tn=!1,zn=null,mr=null,Ln=null,wn=null,Xn.length=0,Zn.clear(),Mn=!1,Nn=!1,J.mode===`ufo`&&J.recenter([0,1.8,12]),er()}function nr(e){if(!e)return null;let t=/comet|kuiper|icy|ice|volatile/i.test(`${e.name||``} ${e.subtitle||``}`),n=/metal|iron|fe|nickel|m-type/i.test(`${e.name||``} ${e.subtitle||``}`),r=(Number(e.index)||41)*197+q.seed%997,i=t?6+r%14:n?22+r%55:1.5+r%18,a=(t?650:n?4200:1850)*(4/3*Math.PI*(i*1e3)**3),o=a/198847e25,s=Math.max(.005,Math.min(.45,66743e-15*a/(i*1e3)**2));return{id:`belt-ast-${e.index??r}`,name:e.name||`Belt Asteroid #${e.index??1}`,subtitle:e.subtitle||(t?`Active Sublimating Ice Nucleus`:n?`Fe-Ni Metallic Planetesimal`:`Carbonaceous Rubble-Pile Asteroid`),massSolar:o,radiusKm:i,surfaceGravityMS2:s,surfacePressurePa:0,tempK:t?175:210,aAu:2.7,kind:t?3:1,atm:t?.06:0,color0:t?[.76,.84,.92]:n?[.64,.62,.6]:[.34,.32,.3],color1:t?[.42,.56,.7]:n?[.44,.42,.4]:[.22,.2,.19],coreZ:n?26:t?8:14,mantleZ:n?28:14,surfZ:t?8:n?26:6,isMinorBody:!0,isComet:t,isMetallicAsteroid:n,composition:e.sampleMaterial?.name||(t?`H₂O/CO Ice · Dust`:n?`Fe-Ni Alloy · Silicates`:`Carbonaceous Chondrite`)}}function rr(){if(Q&&Q.level===Z&&Array.isArray(Q.worldPos)){let e=Q.kind===`solar-asteroid`?nr(Q):q.getActiveSystemCatalog()[q.focusedSolarBodyIndex]||Qe[3];return{pos:[...Q.worldPos],spec:e,id:e.id||`mote-${Q.index}`}}let e=q.getActiveSystemCatalog(),t=Math.max(0,Math.min(e.length-1,q.focusedSolarBodyIndex)),n=e[t]||Qe[3];if(Z===2&&q.solarEngine){let e=q.getSolarReferenceOriginAu(s,t),r=Hr.solarScaleAuToWorld??WORLD_VIEW_SPAN/Math.max(1e-9,10**s/149597870700);return{pos:[(e.focusPosAu[0]-e.originAu[0])*r,(e.focusPosAu[1]-e.originAu[1])*r,(e.focusPosAu[2]-e.originAu[2])*r],spec:n,id:n?.id||`focused-body`}}return{pos:[...vr],spec:n,id:n?.id||`focused-body`}}async function ir(e,t=1.65){if(Qn)return null;Qn=!0;try{q.surfaceActive&&Ii(),Xn.length=0,Z=2,s=12.2,Nr=null,Ar=.55;let n=await q.triggerCatastrophicShatter(e,{excessRatio:t});return wi(),Ti(),Pi(),da(),$(performance.now()),n}finally{Qn=!1}}function ar(e=null){let t=e||rr(),n=Math.cos(Fr.pitch),r=Math.sin(Fr.pitch),i=Math.cos(Fr.yaw),a=Math.sin(Fr.yaw),o=[vr[0]+Fr.dist*n*a,vr[1]+Fr.dist*r,vr[2]+Fr.dist*n*i],s=di(o,vr,[0,1,0]),c=[o[0]+s.fwd[0]*5.9-s.up[0]*1.72,o[1]+s.fwd[1]*5.9-s.up[1]*1.72,o[2]+s.fwd[2]*5.9-s.up[2]*1.72],l=li(oi(t.pos,c)),u=Math.max(2,Math.hypot(t.pos[0]-c[0],t.pos[1]-c[1],t.pos[2]-c[2])),d=Math.max(12,Math.min(48,u*1.45)),f={pos:[c[0]+l[0]*.5,c[1]+l[1]*.5,c[2]+l[2]*.5],vel:[l[0]*d,l[1]*d,l[2]*d],target:[...t.pos],targetSpec:t.spec,targetId:t.id,age:0,alive:!0};return Xn.push(f),Xn.length>16&&Xn.shift(),f}function or(e){return e>=1e24?`${(e*1e-24).toFixed(1)} YW`:e>=1e21?`${(e*1e-21).toFixed(1)} ZW`:e>=0xde0b6b3a7640000?`${(e*1e-18).toFixed(1)} EW`:e>=0x38d7ea4c68000?`${(e*1e-15).toFixed(1)} PW`:e>=0xe8d4a51000?`${(e*1e-12).toFixed(1)} TW`:e>=1e9?`${(e*1e-9).toFixed(1)} GW`:e>=1e6?`${(e*1e-6).toFixed(0)} MW`:`${(e*.001).toFixed(0)} kW`}function sr(e){let t=Math.max(0,Number(e)||0);return t>=0xe8d4a51000?`${(t*1e-12).toFixed(1)}T`:t>=1e9?`${(t*1e-9).toFixed(1)}B`:t>=1e6?`${(t*1e-6).toFixed(1)}M`:t>=1e3?`${(t*.001).toFixed(1)}k`:`${Math.round(t)}`}function cr(){let e=Yn.getStatus();if(e.timescaleLocked&&(Sr=1),re&&(re.disabled=e.timescaleLocked,e.timescaleLocked&&(re.value=`1.0`)),ie&&(ie.textContent=e.timescaleLocked?`🔒 1.0×`:`${Sr.toFixed(1)}×`),C){C.classList.toggle(`active`,e.connected);let t=e.peerComputeStatus===`p2p-mesh`?`P2P`:e.peerComputeStatus===`relay-online`?`Relay`:e.peerComputeStatus===`connecting`?`Sync...`:`Local`;C.textContent=e.connected?`🌐 ${e.roomId} (${e.remotePeerCount+1} · ${t})`:`🌐 Solo`;let n=Yn.getAllRemotePeers?.()||[],r=n.length>0?` | Online: ${n.map(e=>`${e.peerId}@${e.surfaceActive?`${e.bodyId||`surface`}`:`L${e.level??2}`}`).join(`, `)}`:``;C.title=e.connected?`PeerCompute multiplayer room "${e.roomId}" (${e.transportKind}, ${e.libp2pPeerCount} libp2p links) — timescale locked at 1.0×${r}. Click to leave.`:`Join PeerCompute public multiplayer UFO room (libp2p/WebRTC + same-browser tabs; locks timescale to 1.0×!)`}}function lr(){let e=ve(An);if(zt){zt.textContent=`${e.shortBand} · ${e.displayLabel.split(` `)[0]}${e.displayLabel.split(` `)[1]?` `+e.displayLabel.split(` `)[1]:``}`;let t=Math.round(e.rgb[0]*255),n=Math.round(e.rgb[1]*255),r=Math.round(e.rgb[2]*255);zt.style.color=`rgb(${t},${n},${r})`}if(Bt){let e=Math.max(14,Math.min(26,Math.round(Math.log10(Math.max(0x5af3107a4000,X.state.maxPowerW)))));Bt.max=String(e)}if(Vt&&(Vt.textContent=or(jn)),Ft)for(let e of Ft.querySelectorAll(`[data-weapon]`))e.classList.toggle(`active`,e.dataset.weapon===kn);if(Lt&&Lt.classList.toggle(`active`,Nn),It&&It.classList.toggle(`firing`,Mn),Ut){let e=X.state,t=sr(e.totalProbeCount||e.probes.length),n=e.dysonTau>.01?` · τD ${e.dysonTau.toFixed(2)}`:``;Ut.textContent=`K ${e.kardashevIndex.toFixed(2)} · ${t} Probes${n} · 🛡${Math.round(e.shieldHp)}%`}if(y){let e=q.surfaceActive?q.surfaceSession?.cameraMode===`first-person`:On;y.classList.toggle(`active`,e),y.textContent=e?`🛸 3rd View`:`🛸 Cockpit`}}function fr(){let e=q.getActiveSystemCatalog()[q.focusedSolarBodyIndex]?.id||`earth`,t=q.surfaceTelemetry,n=Yn.getStatus();return Ve(window.location.href,{seed:q.seed,epoch:q.cosmicEpoch?.id||`present`,log10SpanM:s,useSol:q.useSolReference,bodyId:e,surfaceActive:q.surfaceActive,pos:q.surfaceActive?t?.ufoPos||t?.roverPos:null,yaw:q.surfaceActive?t?.ufoYaw??.35:null,simTimeS:Pn,roomId:n.connected?n.roomId:null,relayUrl:n.connected&&n.relayUrl?n.relayUrl:null})}let pr=()=>!!q.getActiveSystemCatalog()[q.focusedSolarBodyIndex]?.isStar||q.focusedSolarBodyIndex===0,Z=bi(s,{focusedSolarBodyIndex:q.focusedSolarBodyIndex,focusedBodyIsStar:pr(),galaxyBranch:q.galaxyBranch}),mr=null,hr=null,gr=null,Q=null,_r=!1,vr=[0,0,0],yr=[],br=0,xr=!0,Sr=1,Cr=!0,wr=!0,Tr=n.get(`cameraAutoSpin`)===`1`,Er=n.get(`crt`)===`1`,Or=3,kr=n.get(`autopilot`)===`1`,Ar=0,jr=!1,Mr=0,Nr=null,Pr=0,Fr={yaw:.56,pitch:.42,dist:18},Lr=new Float32Array(16),Rr=window.innerWidth,Vr=window.innerHeight,Hr={},Ur=[`Cosmic Web`,`Spiral Galaxy`,`Solar System`,`Sun Core`,`Earth`,`Fe Lattice`,`Fe Atom`,`⁵⁶Fe Nucleus`];if(me&&(me.checked=Tr),he&&(he.checked=Er),w&&kr&&(w.classList.add(`active`),w.textContent=`⏹ Stop Tour`),ce)for(let e of ce.querySelectorAll(`[data-quality]`))e.classList.toggle(`active`,e.dataset.quality===o);if(d){d.innerHTML=ct.map(e=>`<button class="uv-rung-btn" data-level="${e.level}" type="button" title="Smoothly fly continuously to L${e.level}: ${e.name} (${e.exponentLabel})"><span class="uv-rung-exp">${e.exponentLabel}</span><span>L${e.level} ${e.shortLabel}</span></button>`).join(``);for(let e of d.querySelectorAll(`[data-level]`))e.addEventListener(`click`,()=>{let t=Number.parseInt(e.dataset.level,10);if(Number.isFinite(t)){if(q.surfaceActive&&Ii(),kr=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),t===3)Tn=!1,q.setFocusedSolarBody(0),q.syncStellarRegimeForStar(null,{initializeNow:!0});else if(t===4){let e=q.getActiveSystemCatalog();(e[q.focusedSolarBodyIndex]?.isStar||q.focusedSolarBodyIndex===0)&&q.setFocusedSolarBody(q.getDefaultPlanetIndex(e))}si(ct[t].log10SpanM)}})}function Wr(){if(f)for(let e of f.querySelectorAll(`[data-epoch]`))e.classList.toggle(`active`,e.dataset.epoch===q.cosmicEpochId)}if(f){f.innerHTML=q.COSMIC_EPOCH_PRESETS.map(e=>`<button class="uv-epoch-btn ${e.id===q.cosmicEpochId?`active`:``}" data-epoch="${e.id}" type="button" title="${e.summary}">${e.shortLabel}</button>`).join(``);for(let e of f.querySelectorAll(`[data-epoch]`))e.addEventListener(`click`,async()=>{await q.setCosmicEpoch(e.dataset.epoch,{alignActiveLevel:Z}),Wr(),wi(),hi(),da(),$(performance.now())})}p?.addEventListener(`input`,e=>{q.surfaceActive&&Ii(),kr=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),Nr=null,s=Math.max(st,Math.min(ot,Number(e.target.value))),ri(s)});function Kr(){let e=Math.min(window.devicePixelRatio||1,2);Rr=Math.max(320,window.innerWidth),Vr=Math.max(240,window.innerHeight);let t=Math.max(2,Math.floor(Rr*e)),n=Math.max(2,Math.floor(Vr*e));(c.width!==t||c.height!==n)&&(c.width=t,c.height=n),l&&(l.width!==Rr||l.height!==Vr)&&(l.width=Rr,l.height=Vr)}Kr(),window.addEventListener(`resize`,Kr);let qr=[{id:`scan`,el:Ee,btn:ke},{id:`em`,el:$t,btn:Qt},{id:`flight`,el:Me,btn:Ae},{id:`cargo`,el:j,btn:A},{id:`sim`,el:O,btn:T},{id:`config`,el:k,btn:E},{id:`help`,el:V,btn:D}];qr.filter(e=>e.id!==`scan`);function Jr(e=`scan`,{autoExpand:t=!0}={}){let n=qr.some(t=>t.id===e)?e:`scan`;Dn=n,t&&De?.classList.contains(`collapsed`)&&(De.classList.remove(`collapsed`),document.body.classList.remove(`deck-collapsed`),Oe&&(Oe.textContent=`❯`));for(let e of qr){let t=e.id===n;e.el?.classList.toggle(`open`,t),e.btn?.classList.toggle(`active`,t)}return n===`cargo`&&$r(),n===`flight`&&Xr(),n===`em`&&Wn(),Dn}function Yr(){let e=Math.cos(Fr.pitch),t=Math.sin(Fr.pitch),n=Math.cos(Fr.yaw),r=Math.sin(Fr.yaw);return{eye:[vr[0]+Fr.dist*e*r,vr[1]+Fr.dist*t,vr[2]+Fr.dist*e*n],target:[...vr]}}function Xr(){let e=J.getState(s,q.surfaceActive),t=e.mode===`ufo`;if(Ne?.classList.toggle(`active`,!t),Pe?.classList.toggle(`active`,t),Fe?.classList.toggle(`active`,!t),Ie?.classList.toggle(`active`,t),Re&&(Re.textContent=e.regime.label.toUpperCase()),ze&&(ze.textContent=q.surfaceActive&&q.surfaceTelemetry?`${(q.surfaceTelemetry.ufoSpeedMS??q.surfaceTelemetry.roverSpeedMS??0).toFixed(1)} m/s`:e.speedLabel),Ue){let t=e.eulerDeg,n=e=>`${e>=0?`+`:``}${e.toFixed(0)}°`;Ue.textContent=`X ${n(t.pitchDeg)} · Y ${n(t.yawDeg)} · Z ${n(t.rollDeg)}`}if(qe&&document.activeElement!==qe&&(qe.value=String(e.chaseDistMul)),Ye&&(Ye.textContent=`${e.chaseDistMul.toFixed(e.chaseDistMul>=10?0:1)}×`),Xe)for(let t of Xe.querySelectorAll(`[data-chase-zoom]`)){let n=Number(t.dataset.chaseZoom);t.classList.toggle(`active`,Math.abs(n-e.chaseDistMul)<Math.max(.25,n*.18))}Le&&(Le.classList.toggle(`connected`,e.gamepadConnected),Le.textContent=e.gamepadConnected?`🎮 Xbox Pad`:`🎮 No Pad`,Le.title=e.gamepadConnected?`Connected: ${e.gamepadId} — Left Stick thrust, Right Stick pitch/yaw, LB/RB roll Z, D-Pad zoom`:`Connect an Xbox or standard gamepad and press any button to fly in 6-DOF!`),tt&&(tt.innerHTML=`${e.gamepadConnected?`<strong style="color:#6ee7b7;">Connected:</strong> ${e.gamepadId.slice(0,40)}`:`<strong>Status:</strong> Connect Xbox controller &amp; press any button.`}<br/>
        <strong>Left Stick:</strong> Thrust Fwd/Back + Strafe · <strong>Right Stick:</strong> Pitch X + Yaw Y<br/>
        <strong>LB / RB:</strong> Full 360° Roll Z · <strong>RT / LT:</strong> Warp Boost / Brake<br/>
        <strong>A / B:</strong> Ascend / Descend · <strong>X / Y:</strong> Fire / Tractor Beam<br/>
        <strong>D-Pad ↑/↓:</strong> Chase Zoom (0.55×–45×) · <strong>←/→:</strong> 40-OOM Scale<br/>
        <strong>View:</strong> UFO ↔ Orbit · <strong>Menu:</strong> Cockpit · <strong>L3:</strong> Level · <strong>R3:</strong> Missile<br/>
        <strong>Keys (UFO):</strong> WASD thrust · Space/C up/dn · Q/E roll Z · Arrows/Drag pitch &amp; yaw · Wheel chase zoom (Shift+Wheel scale).`),kt&&!q.surfaceActive&&(kt.textContent=t?`🛸 6-DOF UFO (${e.regime.shortLabel} · Chase ${e.chaseDistMul.toFixed(1)}×) · WASD Thrust · Q/E Roll Z · Drag/Arrows Pitch/Yaw · Wheel: Chase Zoom · Shift+Wheel: 40-OOM · Tab: Orbit`:`🪐 Orbit Mode · Tab: 6-DOF UFO Free-Flight · Scroll: 40-OOM Zoom · Drag: Orbit · Click ANY Mote: Inspect GPU Data`)}function Zr(e){let t=Yr();return J.setMode(e,t),Xr(),$(performance.now()),J.mode}function Qr(){return Zr(J.mode===`ufo`?`orbit`:`ufo`)}if(Ne?.addEventListener(`click`,()=>Zr(`orbit`)),Pe?.addEventListener(`click`,()=>Zr(`ufo`)),Fe?.addEventListener(`click`,()=>Zr(`orbit`)),Ie?.addEventListener(`click`,()=>Zr(`ufo`)),We?.addEventListener(`click`,()=>{J.levelHorizon(),Xr(),$(performance.now())}),Ge?.addEventListener(`click`,()=>{let e=Yr();J.resetPosition(e.eye,e.target),Xr(),$(performance.now())}),U?.addEventListener(`click`,()=>Ni()),qe?.addEventListener(`input`,e=>{let t=Number(e.target.value)||1;if(J.setChaseZoom(t),q.surfaceActive){let e=q.adjustSurfaceChaseDistance(1);e>0&&q.adjustSurfaceChaseDistance(Math.min(18,Math.max(.45,t))/e)}Xr(),$(performance.now())}),Xe)for(let e of Xe.querySelectorAll(`[data-chase-zoom]`))e.addEventListener(`click`,()=>{let t=Number(e.dataset.chaseZoom)||1;J.setChaseZoom(t),J.mode!==`ufo`&&!q.surfaceActive&&Zr(`ufo`),Xr(),$(performance.now())});Ze?.addEventListener(`pointerdown`,e=>{e.preventDefault(),zi(!0)}),Ze?.addEventListener(`pointerup`,()=>zi(!1)),Ze?.addEventListener(`pointerleave`,()=>zi(!1)),$e?.addEventListener(`click`,()=>{if(q.surfaceActive){let e=q.launchSurfaceMissile({});e&&Yn.isConnected&&Yn.broadcastMissileLaunch(e)}else ar()}),et?.addEventListener(`click`,()=>{Nn=!Nn,q.setSurfaceTractorBeam(Nn),lr(),$(performance.now())}),Oe?.addEventListener(`click`,()=>{let e=De?.classList.toggle(`collapsed`);document.body.classList.toggle(`deck-collapsed`,!!e),Oe&&(Oe.textContent=e?`❮`:`❯`)}),ke?.addEventListener(`click`,()=>Jr(`scan`)),Ae?.addEventListener(`click`,()=>Jr(Dn===`flight`?`scan`:`flight`));function $r(){let e=Bn.length+Vn.length;if(A){let t=A.querySelector(`.uv-tab-lbl`);t?t.textContent=e>0?`Cargo (${e})`:`Cargo`:A.textContent=e>0?`🎒 Cargo (${e})`:`🎒 Cargo`}if(M&&(Bn.length?(M.innerHTML=Bn.map((e,t)=>{let n=e.kingdom===`flora`||e.kind===`flora`?`🌿`:e.kingdom===`fungi`||e.kind===`fungi`?`🍄`:e.bodyPlan===`aero-gasbag`?`🎈`:e.bodyPlan===`aquatic-swimmer`?`🐟`:`🐾`,r=ue(e.profile||null,`organism-overview`,e),i=Number.isFinite(e.deltaGKjMol)?` · ΔG=${e.deltaGKjMol} kJ/mol`:``,a=e.xnaBackbone?` · ${e.xnaAlphabetSize||4}-base ${e.xnaBackbone.split(` `)[0]}`:``;return`
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
            </div>`}).join(``),M.querySelectorAll(`[data-release-spec]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=Number(e.getAttribute(`data-release-spec`));Number.isInteger(t)&&t>=0&&t<Bn.length&&(Bn.splice(t,1),$r(),Pi())})})):M.innerHTML=`<div class="uv-cargo-item-sub">No life forms aboard yet. Land on a living world and hold <strong>T</strong> (Tractor Beam) over trees or roaming animals to abduct &amp; examine them in Bio Lab.</div>`),N&&(Vn.length?(N.innerHTML=Vn.map((e,t)=>{let n=Number(e.primaryZ)||Number(e.elements?.[0])||14,r=e.formula||e.shortLabel||e.name;return`
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
            </div>`}).join(``),N.querySelectorAll(`[data-inspect-sample]`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=Vn[Number(e.getAttribute(`data-inspect-sample`))];t&&(ti(),await q.applySampledMaterialToLattice(t),q.surfaceActive&&q.exitSurfaceView(),await ci(5,!0))})})):N.innerHTML=`<div class="uv-cargo-item-sub">No material samples collected yet. Press <strong>G</strong> on any surface, asteroid, comet, or cloud deck to sample.</div>`),I){let e=X.state||{},t=Number(e.silicatesKg)||0,n=Number(e.metalsKg)||0,r=Number(e.volatilesKg)||0,i=Number(e.exoticsKg)||0,a=Number(e.kardashevIndex??e.kardashevK??.725),o=Number(e.reactorTier)||1,s=(Number(e.dysonCoveringFrac??e.dysonTau)||0)*100,c=Math.max(Number(e.totalProbeCount)||0,e.probes?.length||0);I.innerHTML=`
        <div class="uv-cargo-res-cell"><span>Silicates</span><strong>${Math.round(t).toLocaleString()} kg</strong></div>
        <div class="uv-cargo-res-cell"><span>Fe-Ni Metals</span><strong>${Math.round(n).toLocaleString()} kg</strong></div>
        <div class="uv-cargo-res-cell"><span>Volatiles</span><strong>${Math.round(r).toLocaleString()} kg</strong></div>
        <div class="uv-cargo-res-cell"><span>Exotics / AM</span><strong>${i.toFixed(1)} kg</strong></div>
        <div class="uv-cargo-res-cell"><span>Kardashev Index</span><strong>K ${a.toFixed(2)} (Tier ${o})</strong></div>
        <div class="uv-cargo-res-cell"><span>Dyson / Probes</span><strong>${s.toFixed(1)}% · ${Math.round(c).toLocaleString()} 🤖</strong></div>
      `}}function ei(e){let t=qr.find(t=>t.el===e);t&&Jr(Dn===t.id?`scan`:t.id)}function ti(){Jr(`scan`,{autoExpand:!1})}A?.addEventListener(`click`,()=>ei(j)),T?.addEventListener(`click`,()=>ei(O)),E?.addEventListener(`click`,()=>ei(k)),D?.addEventListener(`click`,()=>ei(V)),R?.addEventListener(`click`,()=>{let e=q.getActiveSystemCatalog();er(),X.deployVonNeumannProbe({bodyId:e[q.focusedSolarBodyIndex]?.id||`earth`,systemKey:$n(),starPosGal:q.activeStarSite?.posGal||q.galaxyFocusPos||[4.8,.04,2.1]}),lr(),$r()}),z?.addEventListener(`click`,()=>{X.addHarvest({metals:1200,silicates:900,exotics:12}),X.step(1.5),lr(),$r()});for(let e of document.querySelectorAll(`[data-close-drawer]`))e.addEventListener(`click`,()=>ti());function ni(e,t,n){ti(),_n&&(_n.textContent=e),vn&&(vn.textContent=t),yn&&(yn.innerHTML=n),gn?.classList.add(`open`)}bn?.addEventListener(`click`,()=>gn?.classList.remove(`open`)),gn?.addEventListener(`click`,e=>{e.target===gn&&gn.classList.remove(`open`)}),mn?.addEventListener(`click`,()=>{let e=ct[Z];ni(`L${e.level} · ${e.name}`,`${e.exponentLabel} · ${e.engineSchema}`,pt(e))}),it?.addEventListener(`click`,()=>{let e=ct[Z];ni(`L${e.level} · ${e.name}`,`${e.exponentLabel} · ${e.engineSchema}`,pt(e))}),hn?.addEventListener(`click`,()=>{ni(`About ULG Universes`,`Universal Law Graph · Continuous 40-OOM WebGPU Physics`,ft())}),rt?.addEventListener(`click`,()=>{let e=Ee?.classList.toggle(`collapsed`);rt&&(rt.textContent=e?`+`:`−`)});async function ri(e){let t=pr(),n=bi(e,{focusedSolarBodyIndex:q.focusedSolarBodyIndex,focusedBodyIsStar:t,galaxyBranch:q.galaxyBranch}),r=new Set([n]);n===1&&r.add(0),(n===2||n===3||n===4)&&r.add(1),n===6&&r.add(5),n===7&&r.add(6),e>=20.5&&r.add(0),e>=14.8&&e<=23.5&&r.add(1),e>=6.5&&e<=18.2&&r.add(2),e>=6.8&&e<=10.8&&t&&r.add(3),e>=-6.2&&e<=9.2&&!t&&r.add(4),e>=-10&&e<=-4.5&&r.add(5),e>=-13.5&&e<=-8.4&&r.add(6),e<=-11.5&&r.add(7);let i=q.nuclearResult;for(let e of r)await q.ensureLevelInitialized(e);q.nuclearResult&&q.nuclearResult!==i&&q.nuclearResult.volumeData&&xn.uploadNuclearVolume(q.nuclearResult.volumeData)}function ii(e=q.focusedSolarBodyIndex){if(!q.solarEngine||e<=0)return;let t=q.solarEngine.getMassiveBodyState64(e),n=q.solarEngine.getMassiveBodyState64(0),r=n.posAu[0]-t.posAu[0],i=n.posAu[2]-t.posAu[2];Fr.yaw=Math.atan2(r,i)-.92,Fr.pitch=.24}function si(e){Nr=Math.max(st,Math.min(ot,Number(e))),ri(Nr)}async function ci(e,t=!0){let n=Math.max(0,Math.min(7,Math.trunc(Number(e)||0)));q.surfaceActive&&Ii();let r=q.getActiveSystemCatalog();n===3?q.setFocusedSolarBody(0):n===4&&(r[q.focusedSolarBodyIndex]?.isStar||q.focusedSolarBodyIndex===0)&&q.setFocusedSolarBody(q.getDefaultPlanetIndex(r));let i=ct[n].log10SpanM;if(!t){si(i);return}Nr=null;let a=Z;s=Si(i),Z=bi(s,{focusedSolarBodyIndex:q.focusedSolarBodyIndex,focusedBodyIsStar:pr(),galaxyBranch:q.galaxyBranch}),Z!==a&&(Q=null,_r=!1,vr=[0,0,0],a>=2&&Z<=1&&tr()),await ri(s),n===4&&ii(q.focusedSolarBodyIndex),wi(),Ti(),da(),$(performance.now())}function hi(){if(H)if(Z===0)H.innerHTML=`
        <div class="uv-row">
          <span>Cosmology Regime</span>
          <select id="uv-cosmo-mode">
            <option value="web" ${q.cosmoMode===`web`?`selected`:``}>2LPT Cosmic Web (FLRW TreePM)</option>
            <option value="cmb" ${q.cosmoMode===`cmb`?`selected`:``}>CMB Recombination (z=1100 BAO ΔT/T)</option>
            <option value="reionization" ${q.cosmoMode===`reionization`?`selected`:``}>Cosmic Dawn Reionization Bubbles (z=10)</option>
            <option value="cluster-merger" ${q.cosmoMode===`cluster-merger`?`selected`:``}>Bullet-Cluster Merger (X-Ray ICM + Lensing)</option>
          </select>
        </div>
        <div style="font-size:11px;color:var(--muted);line-height:1.35;">${q.cosmoMode===`cmb`?`Eisenstein–Hu BAO + Peebles Recombination surface at <code>z = 1100</code> (<code>T_CMB = 3,001 K</code>, <code>r_s ≈ 147 Mpc</code>).`:q.cosmoMode===`reionization`?`Pop III UV radiation percolating ionized <code>H II</code> bubbles through the neutral <code>z = 10</code> IGM.`:q.cosmoMode===`cluster-merger`?`Shock-heated X-ray ICM gas (magenta-gold) colliding behind collisionless dark-matter lensing halos (blue).`:`FLRW 3D-FFT TreePM running <code>${q.quality.cosmoGridPerSide}³</code> particles on a <code>${q.quality.cosmoFftN}³</code> periodic FFT mesh.`}</div>`,H.querySelector(`#uv-cosmo-mode`)?.addEventListener(`change`,async e=>{await q.setCosmoMode(e.target.value),wi(),hi(),da(),$(performance.now())});else if(Z===1)H.innerHTML=`
        <div class="uv-row">
          <span>Morphology</span>
          <select id="uv-gal-preset-sel">
            <option value="disk" ${q.galaxyPreset===`disk`?`selected`:``}>Grand-Design Spiral (Sc/Sb)</option>
            <option value="barred" ${q.galaxyPreset===`barred`?`selected`:``}>Barred Spiral (SBb · Secular m=2 Bar)</option>
            <option value="ring" ${q.galaxyPreset===`ring`?`selected`:``}>Cartwheel Collisional Ring Galaxy</option>
            <option value="lenticular" ${q.galaxyPreset===`lenticular`?`selected`:``}>Lenticular Disk (S0 · Sombrero)</option>
            <option value="irregular" ${q.galaxyPreset===`irregular`?`selected`:``}>Starburst Irregular (Magellanic / M82)</option>
            <option value="open-cluster" ${q.galaxyPreset===`open-cluster`?`selected`:``}>Open Cluster + Reflection Veil (M45)</option>
            <option value="binary" ${q.galaxyPreset===`binary`?`selected`:``}>Interacting Major Merger Pair</option>
            <option value="sphere" ${q.galaxyPreset===`sphere`?`selected`:``}>Giant Elliptical Spheroid</option>
            <option value="proto" ${q.galaxyPreset===`proto`?`selected`:``}>High-z Clumpy Starburst Protogalaxy</option>
            <option value="dwarf-stream" ${q.galaxyPreset===`dwarf-stream`?`selected`:``}>Tidally Disrupted Dwarf &amp; Halo Stream</option>
            <option value="globular" ${q.galaxyPreset===`globular`?`selected`:``}>Core-Collapsed Globular Cluster</option>
          </select>
        </div>
        <div class="uv-row">
          <span>Zoom Destination</span>
          <select id="uv-gal-branch">
            <option value="solar-system" ${q.galaxyBranch===`solar-system`?`selected`:``}>Solar System (Orion Spur)</option>
            <option value="smbh-core" ${q.galaxyBranch===`smbh-core`?`selected`:``}>Galactic Core SMBH (Sgr A*)</option>
          </select>
        </div>
        <div class="uv-row">
          <span>ISM Z/Z☉</span>
          <input id="uv-gal-z-slider" type="range" min="0.1" max="2.5" step="0.1" value="${q.galaxyMetallicity.toFixed(1)}" />
          <span id="uv-gal-z-val" style="font-family:var(--mono);font-size:11px;">${q.galaxyMetallicity.toFixed(1)}</span>
        </div>
        <div class="uv-row" title="Seed field B₀ for the live GPU 24³ 3D α–ω galactic dynamo (0 = strictly zero B-field!)">
          <span>Dynamo B₀</span>
          <input id="uv-gal-b0-slider" type="range" min="0.0" max="0.8" step="0.05" value="${q.galacticB0.toFixed(2)}" />
          <span id="uv-gal-b0-val" style="font-family:var(--mono);font-size:11px;">${q.galacticB0.toFixed(2)}</span>
        </div>
        <label class="uv-row" title="Overlay 3D emergent α–Ω MHD magnetic field lines traced through the live GPU B(x,y,z) grid">
          <span>Show B-Field Lines</span>
          <input id="uv-gal-bfield-toggle" type="checkbox" ${q.showGalacticBField?`checked`:``} />
        </label>`,H.querySelector(`#uv-gal-preset-sel`)?.addEventListener(`change`,async e=>{await q.initGalaxy({preset:e.target.value}),Q=null,_r=!1,wi(),hi(),$(performance.now())}),H.querySelector(`#uv-gal-branch`)?.addEventListener(`change`,e=>{let t=e.target.value;q.setGalaxyBranch(t,t===`smbh-core`?[0,0,0]:[4.8,.04,2.1]),ri(s)}),H.querySelector(`#uv-gal-z-slider`)?.addEventListener(`input`,async e=>{let t=Number(e.target.value),n=H.querySelector(`#uv-gal-z-val`);n&&(n.textContent=t.toFixed(1)),await q.initGalaxy({preset:q.galaxyPreset,metallicity:t})}),H.querySelector(`#uv-gal-b0-slider`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=H.querySelector(`#uv-gal-b0-val`);n&&(n.textContent=t.toFixed(2)),await q.setGalacticB0(t),da(),$(performance.now())}),H.querySelector(`#uv-gal-bfield-toggle`)?.addEventListener(`change`,e=>{q.setShowGalacticBField(e.target.checked),$(performance.now())});else if(Z===2)q.galaxyBranch===`smbh-core`?(H.innerHTML=`
          <div style="font-size:11.5px;color:var(--muted);line-height:1.4;">Live GPU N-body hypervelocity S-stars orbiting a <code>4.3×10⁶ M☉</code> Kerr-Schwarzschild SMBH with Doppler-beamed accretion disk &amp; WGSL gravitational lensing.</div>
          <button id="uv-switch-solar-btn" class="uv-btn subtle" type="button" style="justify-content:center;">Switch to Solar System</button>`,H.querySelector(`#uv-switch-solar-btn`)?.addEventListener(`click`,async()=>{q.setGalaxyBranch(`solar-system`,[4.8,.04,2.1]),await q.ensureLevelInitialized(2),hi()})):(H.innerHTML=`
          <div class="uv-row">
            <span>System Regime</span>
            <select id="uv-solar-mode-sel">
              <optgroup label="Planetary &amp; Small-Body Systems">
                <option value="nbody" ${q.solarMode===`nbody`?`selected`:``}>Real-Scale Solar System (f32x2 N-Body)</option>
                <option value="formation" ${q.solarMode===`formation`?`selected`:``}>Protoplanetary Accretion Disk &amp; Snow Line</option>
                <option value="roche-rings" ${q.solarMode===`roche-rings`?`selected`:``}>Roche-Limit Ring Disruption &amp; Shepherd Moon</option>
                <option value="giant-impact" ${q.solarMode===`giant-impact`?`selected`:``}>Giant Moon-Forming Impact (Hadean Disk)</option>
                <option value="comet-tails" ${q.solarMode===`comet-tails`?`selected`:``}>Active Dual-Tail Comet (Dust + CO⁺ Ion)</option>
                <option value="hot-jupiter" ${q.solarMode===`hot-jupiter`?`selected`:``}>Hot Jupiter XUV Photoevaporation Tail</option>
                <option value="red-giant" ${q.solarMode===`red-giant`?`selected`:``}>Red-Giant Engulfment (+5 Gyr RGB)</option>
              </optgroup>
              <optgroup label="Relativistic &amp; High-Energy Systems">
                <option value="quasar-jet" ${q.solarMode===`quasar-jet`?`selected`:``}>Quasar / Blazar Kerr BZ Relativistic Jets</option>
                <option value="tde" ${q.solarMode===`tde`?`selected`:``}>Tidal Disruption Event (TDE · Star Spaghettified by SMBH)</option>
                <option value="xray-binary" ${q.solarMode===`xray-binary`?`selected`:``}>X-Ray Binary (Roche L1 Overflow onto BH)</option>
                <option value="bns-kilonova" ${q.solarMode===`bns-kilonova`?`selected`:``}>BNS GW Merger &amp; r-Process Kilonova</option>
                <option value="type-ia" ${q.solarMode===`type-ia`?`selected`:``}>Type Ia White-Dwarf Detonation (M_Ch)</option>
                <option value="bbh-merger" ${q.solarMode===`bbh-merger`?`selected`:``}>Binary Black Hole 2.5PN GW Inspiral</option>
              </optgroup>
            </select>
          </div>
          ${q.solarMode===`formation`?`
            <label class="uv-row" title="Toggle sub-Keplerian Epstein/Stokes gas drag &amp; streaming instability">
              <span>Gas Drag &amp; Drift</span>
              <input id="uv-disk-drag" type="checkbox" ${q.protoplanetaryGasDrag?`checked`:``} />
            </label>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">Live GPU pebbles + DLM composite particle-rigid planetesimals condensing across the <code>${(q.protoplanetarySession?.snowLineAu||2.71).toFixed(2)} AU</code> H₂O snow line.</div>
          `:q.solarMode===`quasar-jet`?`
            <div class="uv-row" title="Dimensionless Kerr spin parameter a* (0 = Schwarzschild, no BZ jet; 0.94 = blazing Blazar jet!)">
              <span>Kerr Spin a*</span>
              <input id="uv-kerr-spin" type="range" min="0.0" max="0.98" step="0.02" value="${q.kerrSpinA.toFixed(2)}" />
              <span id="uv-kerr-spin-val" style="font-family:var(--mono);font-size:11px;">${q.kerrSpinA.toFixed(2)}</span>
            </div>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">Blandford–Znajek power <code>P_BZ ∝ Φ_B² Ω_H²</code>. Drag camera near the jet axis to watch relativistic Doppler beaming turn the Quasar into a blazing Blazar!</div>
          `:q.solarMode===`nbody`?(()=>{let e=q.getActiveSystemCatalog(),t=q.activeCausalSystem,n=t?.starSystem?.nebulaEnv,r=t?.condensationFrontsAu;return`
            <div style="font-size:10.5px;color:#cbd5e1;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);border-radius:6px;padding:6px 7px;line-height:1.35;">
              <div><strong>${q.useSolReference?`Sol Reference (G2V · 8 Planets)`:`${t?.systemName||`System`} · ${t?.architecture||`single`} (${t?.starCount||1}★, ${t?.planetCount||0} planets${t?.hasEarthLike?`, Earth-like!`:``})`}</strong></div>
              ${!q.useSolReference&&n?`<div style="color:var(--muted);margin-top:2px;">Nebula: <code>${n.nebulaSummary}</code> · Snow <code>${r?.rSnowLineAu} AU</code> · HZ <code>${r?.rHzInnerAu}–${r?.rHzOuterAu} AU</code></div>`:`<div style="color:var(--muted);margin-top:2px;">Reference J2000 Solar System (exact astronomical radii: Earth = 0.00916 R☉).</div>`}
            </div>
            <div class="uv-seg-group">
              <button id="uv-sample-star-btn" class="uv-seg-btn" type="button" title="Sample a new star from the live galaxy and synthesize its nebular planetary system">🎲 New Galactic Star</button>
              <button id="uv-toggle-sol-btn" class="uv-seg-btn ${q.useSolReference?`active`:``}" type="button" title="Toggle between Causal Galactic Nebular Synthesis and Sol Reference System">${q.useSolReference?`🌌 Causal Nebular`:`☀ Sol Reference`}</button>
            </div>
            <div class="uv-row">
              <span>Focus World</span>
              <select id="uv-solar-focus">${e.map((e,t)=>`<option value="${t}" ${t===q.focusedSolarBodyIndex?`selected`:``}>${e.name}</option>`).join(``)}</select>
            </div>`})():`<div style="font-size:11px;color:var(--muted);line-height:1.35;">Active ULG general-law regime running live on WebGPU — drag to orbit, inspect live telemetry &amp; plots on the right.</div>`}`,H.querySelector(`#uv-solar-mode-sel`)?.addEventListener(`change`,async e=>{await q.setSolarMode(e.target.value),wi(),hi(),da(),$(performance.now())}),H.querySelector(`#uv-sample-star-btn`)?.addEventListener(`click`,async()=>{await q.sampleNewGalacticSector(),wi(),Ti(),da(),$(performance.now())}),H.querySelector(`#uv-toggle-sol-btn`)?.addEventListener(`click`,async()=>{await q.setUseSolReference(!q.useSolReference),wi(),Ti(),da(),$(performance.now())}),H.querySelector(`#uv-disk-drag`)?.addEventListener(`change`,e=>{q.setProtoplanetaryGasDrag(e.target.checked)}),H.querySelector(`#uv-kerr-spin`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=H.querySelector(`#uv-kerr-spin-val`);n&&(n.textContent=t.toFixed(2)),await q.setKerrSpinA(t),da(),$(performance.now())}),H.querySelector(`#uv-solar-focus`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=q.getActiveSystemCatalog();q.setFocusedSolarBody(t),hr=n[t]?.id||null,!n[t]?.isStar&&t>0&&await q.initPlanetaryInterior({bodyIndex:t}),da(),$(performance.now())}));else if(Z===3){H.innerHTML=`
        <div class="uv-row">
          <span>Stellar / Remnant Regime</span>
          <select id="uv-stellar-mode-sel">
            <option value="fusion" ${q.stellarMode===`fusion`?`selected`:``}>3D MLS-MPM Thermonuclear Fusion Star (pp/CNO/3α)</option>
            <option value="nebular-mhd" ${q.stellarMode===`nebular-mhd`?`selected`:``}>3D Resistive MHD Nebular Collapse &amp; Jets</option>
            <option value="h2-pillars" ${q.stellarMode===`h2-pillars`?`selected`:``}>H II Star-Forming Pillars (M16 · Optical vs JWST IR)</option>
            <option value="planetary-nebula" ${q.stellarMode===`planetary-nebula`?`selected`:``}>Planetary Nebula &amp; Hot White Dwarf</option>
            <option value="snr-pwn" ${q.stellarMode===`snr-pwn`?`selected`:``}>Supernova Remnant / Crab PWN (M1)</option>
            <option value="reflection-nebula" ${q.stellarMode===`reflection-nebula`?`selected`:``}>Reflection Nebula (M45 Pleiades / Iris Dust Veil)</option>
            <option value="wr-bubble" ${q.stellarMode===`wr-bubble`?`selected`:``}>Wolf–Rayet / Eta Carinae Bipolar Homunculus</option>
            <option value="pulsar" ${q.stellarMode===`pulsar`?`selected`:``}>Millisecond Pulsar (Lighthouse Dipole)</option>
            <option value="magnetar" ${q.stellarMode===`magnetar`?`selected`:``}>Magnetar Giant Flare (Hall Crust Yield)</option>
            <option value="white-dwarf-tov" ${q.stellarMode===`white-dwarf-tov`?`selected`:``}>White Dwarf / NS / BH (GR TOV EOS)</option>
          </select>
        </div>
        ${q.stellarMode===`nebular-mhd`?`
          <div class="uv-row" title="Initial poloidal magnetic field B₀ threading the rotating molecular cloud (0 = hydro-only, no jets!)">
            <span>Magnetic B₀</span>
            <input id="uv-neb-b0" type="range" min="0.0" max="1.2" step="0.05" value="${q.nebulaB0.toFixed(2)}" />
            <span id="uv-neb-b0-val" style="font-family:var(--mono);font-size:11px;">${q.nebulaB0.toFixed(2)}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);line-height:1.35;">3D self-gravitating resistive MHD winding helical B-towers &amp; launching magnetocentrifugal J×B jets.</div>
        `:q.stellarMode===`fusion`?`
          <div class="uv-seg-group" style="flex-wrap:wrap;">
            <button class="uv-seg-btn ${q.stellarPreset===`main-sequence-star`?`active`:``}" data-st-preset="main-sequence-star" type="button">G2V Sun</button>
            <button class="uv-seg-btn ${q.stellarPreset===`blue-supergiant`?`active`:``}" data-st-preset="blue-supergiant" type="button">O/B Blue</button>
            <button class="uv-seg-btn ${q.stellarPreset===`red-supergiant`?`active`:``}" data-st-preset="red-supergiant" type="button">Betelgeuse</button>
            <button class="uv-seg-btn ${q.stellarPreset===`agb-carbon`?`active`:``}" data-st-preset="agb-carbon" type="button">AGB Carbon</button>
            <button class="uv-seg-btn ${q.stellarPreset===`brown-dwarf`?`active`:``}" data-st-preset="brown-dwarf" type="button">Brown Dwarf</button>
            <button class="uv-seg-btn ${q.stellarPreset===`solar-nebula`?`active`:``}" data-st-preset="solar-nebula" type="button">Nebula</button>
            <button class="uv-seg-btn ${q.stellarPreset===`massive-supernova`?`active`:``}" data-st-preset="massive-supernova" type="button">18 M☉ SN</button>
            <button class="uv-seg-btn ${q.stellarPreset===`binary-nursery`?`active`:``}" data-st-preset="binary-nursery" type="button">Binary</button>
          </div>
          <div class="uv-row">
            <span>Burn Accel</span>
            <input id="uv-st-accel" type="range" min="0.5" max="6.0" step="0.25" value="${q.stellarTimeAccel}" />
            <span id="uv-st-accel-val" style="font-family:var(--mono);font-size:11px;">${q.stellarTimeAccel.toFixed(1)}×</span>
          </div>
          <div class="uv-row" title="Seed B₀ for the live GPU 24³ 3D stellar convective dynamo (0 = zero coronal B-field!)">
            <span>Dynamo B₀</span>
            <input id="uv-st-b0" type="range" min="0.0" max="0.9" step="0.05" value="${q.stellarB0.toFixed(2)}" />
            <span id="uv-st-b0-val" style="font-family:var(--mono);font-size:11px;">${q.stellarB0.toFixed(2)}</span>
          </div>
        `:`<div style="font-size:11px;color:var(--muted);line-height:1.35;">Live first-principles GPU regime from ULG’s Universal Law Graph — inspect spectra, TOV M(R), or flare light curve on the right.</div>`}`,H.querySelector(`#uv-stellar-mode-sel`)?.addEventListener(`change`,async e=>{await q.setStellarMode(e.target.value),Q=null,_r=!1,wi(),hi(),da(),$(performance.now())}),H.querySelector(`#uv-neb-b0`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=H.querySelector(`#uv-neb-b0-val`);n&&(n.textContent=t.toFixed(2)),await q.setNebulaB0(t)});for(let e of H.querySelectorAll(`[data-st-preset]`))e.addEventListener(`click`,async()=>{await q.setStellarMode(`fusion`),await q.initStellarCore({preset:e.dataset.stPreset}),Q=null,_r=!1,hi(),da(),$(performance.now())});H.querySelector(`#uv-st-accel`)?.addEventListener(`input`,e=>{q.setStellarTimeAccel(Number(e.target.value));let t=H.querySelector(`#uv-st-accel-val`);t&&(t.textContent=`${q.stellarTimeAccel.toFixed(1)}×`)}),H.querySelector(`#uv-st-b0`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=H.querySelector(`#uv-st-b0-val`);n&&(n.textContent=t.toFixed(2)),await q.setStellarB0(t),da(),$(performance.now())})}else if(Z===4){let e=q.planetaryAtmoState?.activation;H.innerHTML=`
        <div class="uv-row">
          <span>Planetary Regime</span>
          <select id="uv-planetary-mode-sel">
            <option value="standard" ${q.planetaryMode===`standard`?`selected`:``}>Solar System Worlds (Live Baroclinic + EM)</option>
            <option value="magma-ocean" ${q.planetaryMode===`magma-ocean`?`selected`:``}>Hadean Magma Ocean (Molten Crust)</option>
            <option value="cryo-plumes" ${q.planetaryMode===`cryo-plumes`?`selected`:``}>Cryovolcanic Icy Moon (Tidal Plumes)</option>
            <option value="eyeball-locked" ${q.planetaryMode===`eyeball-locked`?`selected`:``}>Tidally Locked Eyeball Exoplanet</option>
            <option value="rogue" ${q.planetaryMode===`rogue`?`selected`:``}>Rogue Free-Floating Dark World</option>
          </select>
        </div>
        <div class="uv-row">
          <span>World</span>
          <select id="uv-planet-sel">${q.getActiveSystemCatalog().map((e,t)=>e.isStar||t===0?``:`<option value="${t}" ${t===q.planetaryBodyIndex?`selected`:``}>${e.name} (${e.radiusKm.toLocaleString()} km)</option>`).join(``)}</select>
        </div>
        <label class="uv-row" title="Toggle non-inductive triboelectric dust/cloud charging &amp; GPU Poisson Paschen lightning breakdown">
          <span>Triboelectric Lightning</span>
          <input id="uv-tribo-toggle" type="checkbox" ${q.planetaryTriboelectric?`checked`:``} ${e?.triboelectricActive?``:`disabled`} />
        </label>
        <label class="uv-row" title="Slice an octant out of the planet to inspect the live GPU Polytope Atlas hydrostatic core &amp; mantle">
          <span>3D Interior Cutaway</span>
          <input id="uv-cutaway-toggle" type="checkbox" ${q.planetaryCutaway?`checked`:``} />
        </label>
        <button id="uv-land-surface-btn" class="uv-btn primary" type="button" style="justify-content:center;" title="Land on the live GPU planetary surface with a 6-Wheel Jump-Rocket Rover and Coaxial Atmospheric Drone (Shortcut: L)">${q.surfaceActive?`🚀 Launch Back to Orbit (Esc)`:`🚙 Land on Surface (Rover + Drone)`}</button>
        <div style="font-size:10.5px;color:var(--muted);line-height:1.35;">Dynamic Law Graph: <code>${q.surfaceActive?`planetary-surface-vehicles · `:``}${e?.anyActive?e.activeLaws.join(` · `):`Vacuum body — atmospheric &amp; EM laws dormant (0 dispatches)`}</code></div>`,H.querySelector(`#uv-planetary-mode-sel`)?.addEventListener(`change`,async e=>{await q.setPlanetaryMode(e.target.value),q.surfaceActive?await Fi({bodyIndex:q.planetaryBodyIndex}):(wi(),hi(),da(),$(performance.now()))}),H.querySelector(`#uv-planet-sel`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);q.setFocusedSolarBody(t),await q.initPlanetaryInterior({bodyIndex:t}),q.surfaceActive?await Fi({bodyIndex:t}):(s=xi(q.getActiveSystemCatalog()[t]),ii(t),wi(),Ti())}),H.querySelector(`#uv-land-surface-btn`)?.addEventListener(`click`,async()=>{q.surfaceActive?Ii():await Fi({bodyIndex:q.planetaryBodyIndex})}),H.querySelector(`#uv-tribo-toggle`)?.addEventListener(`change`,e=>{q.setPlanetaryTriboelectric(e.target.checked)}),H.querySelector(`#uv-cutaway-toggle`)?.addEventListener(`change`,e=>{q.setPlanetaryCutaway(e.target.checked)})}else if(Z===5){H.innerHTML=`
        <div class="uv-row">
          <span>Element</span>
          <select id="uv-md-el-sel">${lt.map(e=>`<option value="${e.Z}" ${e.Z===q.mdElementZ?`selected`:``}>${e.sym} · ${e.name}</option>`).join(``)}</select>
        </div>
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${q.mdPhasePreset===`solid`?`active`:``}" data-md-phase="solid" type="button">Solid</button>
          <button class="uv-seg-btn ${q.mdPhasePreset===`melt`?`active`:``}" data-md-phase="melt" type="button">Melt</button>
          <button class="uv-seg-btn ${q.mdPhasePreset===`vapor`?`active`:``}" data-md-phase="vapor" type="button">Vapor</button>
        </div>
        <div class="uv-row">
          <span>Temp (K)</span>
          <input id="uv-md-temp" type="range" min="40" max="6000" step="20" value="${Math.min(6e3,q.mdTempK)}" />
          <span id="uv-md-temp-val" style="font-family:var(--mono);font-size:11px;">${q.mdTempK} K</span>
        </div>
        <label class="uv-row" title="Toggle live downward GPU gravity inside the MD chamber">
          <span>MD Gravity</span>
          <input id="uv-md-grav" type="checkbox" ${q.mdGravity?`checked`:``} />
        </label>`,H.querySelector(`#uv-md-el-sel`)?.addEventListener(`change`,async e=>{await q.initMolecularDynamics({Z:Number(e.target.value),phasePreset:`solid`}),wi(),hi()});for(let e of H.querySelectorAll(`[data-md-phase]`))e.addEventListener(`click`,async()=>{await q.initMolecularDynamics({Z:q.mdElementZ,phasePreset:e.dataset.mdPhase}),hi()});H.querySelector(`#uv-md-temp`)?.addEventListener(`input`,e=>{q.setMdTemp(Number(e.target.value));let t=H.querySelector(`#uv-md-temp-val`);t&&(t.textContent=`${q.mdTempK} K`)}),H.querySelector(`#uv-md-grav`)?.addEventListener(`change`,e=>{q.setMdGravity(e.target.checked)})}else if(Z===6){H.innerHTML=`
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${q.quantumMode===`atom`?`active`:``}" data-qm-mode="atom" type="button">Atom (Dirac-KS)</button>
          <button class="uv-seg-btn ${q.quantumMode===`molecule`?`active`:``}" data-qm-mode="molecule" type="button">Molecule (RHF)</button>
        </div>
        ${q.quantumMode===`atom`?`
          <div class="uv-row">
            <span>Element</span>
            <select id="uv-qm-el-sel">${lt.map(e=>`<option value="${e.Z}" ${e.Z===q.quantumZ?`selected`:``}>${e.sym} (Z=${e.Z})</option>`).join(``)}</select>
          </div>
          <div class="uv-row">
            <span>Orbital n/l</span>
            <select id="uv-qm-n">${[1,2,3,4,5,6].map(e=>`<option value="${e}" ${e===q.quantumN?`selected`:``}>n=${e}</option>`).join(``)}</select>
            <select id="uv-qm-l">${[0,1,2,3].filter(e=>e<q.quantumN).map(e=>`<option value="${e}" ${e===q.quantumL?`selected`:``}>${[`s`,`p`,`d`,`f`][e]}</option>`).join(``)}</select>
          </div>
          <label class="uv-row">
            <span>Relativistic Dirac–KS</span>
            <input id="uv-qm-rel" type="checkbox" ${q.quantumRelativistic?`checked`:``} />
          </label>
        `:`
          <div class="uv-seg-group">
            ${Object.keys(q.MOLECULE_SPECS).map(e=>`<button class="uv-seg-btn ${q.quantumMoleculeKey===e?`active`:``}" data-mol-key="${e}" type="button">${q.MOLECULE_SPECS[e].formula}</button>`).join(``)}
          </div>
        `}`;for(let e of H.querySelectorAll(`[data-qm-mode]`))e.addEventListener(`click`,async()=>{await q.initQuantumAtom({mode:e.dataset.qmMode}),wi(),hi()});H.querySelector(`#uv-qm-el-sel`)?.addEventListener(`change`,async e=>{await q.initQuantumAtom({Z:Number(e.target.value),n:null,l:null,m:0}),wi(),hi()}),H.querySelector(`#uv-qm-n`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);await q.initQuantumAtom({n:t,l:Math.min(q.quantumL,t-1),m:0}),hi()}),H.querySelector(`#uv-qm-l`)?.addEventListener(`change`,async e=>{await q.initQuantumAtom({l:Number(e.target.value),m:0}),hi()}),H.querySelector(`#uv-qm-rel`)?.addEventListener(`change`,async e=>{await q.initQuantumAtom({relativistic:e.target.checked}),wi()});for(let e of H.querySelectorAll(`[data-mol-key]`))e.addEventListener(`click`,async()=>{await q.initQuantumAtom({mode:`molecule`,moleculeKey:e.dataset.molKey}),wi(),hi()})}else Z===7&&(H.innerHTML=`
        <div class="uv-row">
          <span>Isotope</span>
          <select id="uv-nuc-sel">${lt.map(e=>`<option value="${e.Z}:${e.A}" ${e.Z===q.nuclearZ?`selected`:``}>${e.A}${e.sym} (Z=${e.Z})</option>`).join(``)}</select>
        </div>
        <button id="uv-tdse-reset" class="uv-btn subtle" type="button" style="justify-content:center;">↻ Reset Tunneling Wavepacket</button>`,H.querySelector(`#uv-nuc-sel`)?.addEventListener(`change`,async e=>{let[t,n]=e.target.value.split(`:`);await q.initAtomicNucleus({Z:Number(t),A:Number(n)}),q.nuclearResult?.volumeData&&xn.uploadNuclearVolume(q.nuclearResult.volumeData),wi()}),H.querySelector(`#uv-tdse-reset`)?.addEventListener(`click`,()=>{q.tdseSession?.resetWavepacket?.()}))}function Ci(){let e=q.getTargetsForLevel(Z,Hr);return e.find(e=>e.id===hr)||e[0]||null}function wi(){let e=q.getTargetsForLevel(Z,Hr);hr=Z===1?null:Z===2&&q.galaxyBranch!==`smbh-core`?q.getActiveSystemCatalog()[q.focusedSolarBodyIndex]?.id||e[0]?.id||null:e[0]?.id||null}function Ti(){let e=ct[Z];if(g&&(g.textContent=`10^${s.toFixed(1)} m`),m&&(m.textContent=dt(s)),p&&document.activeElement!==p&&(p.value=s.toFixed(2)),pn&&(pn.textContent=`L${e.level}`),Dt&&(Dt.textContent=e.engineSchema),xt&&(xt.textContent=e.plotTitle),W)if(Z===4&&!q.surfaceActive){let e=q.getActiveSystemCatalog()[q.planetaryBodyIndex]||Qe[3];W.textContent=(Number(e?.radiusKm)||6371)>=16e3?`🛸 DIVE INTO ATMOSPHERE`:`🚙 LAND TO SAMPLE SURFACE`}else q.surfaceActive?W.textContent=`🔬 SAMPLE BELOW → LATTICE`:Z===2&&Q?.kind===`solar-asteroid`?W.textContent=`🛸 LAND & MINE ASTEROID`:W.textContent=e.diveButton;if(Tt){let e=q.getActiveSystemCatalog()[q.focusedSolarBodyIndex],t=Z===2&&!q.surfaceActive&&(Q?.kind===`solar-asteroid`||!!(e&&!e.isStar&&(e.isMinorBody||e.isComet)));Tt.style.display=(Z===4||t)&&!q.surfaceActive?`inline-flex`:`none`}if(Et&&(Et.disabled=Z===0&&!q.surfaceActive,Z===5&&mr&&!q.surfaceActive?(Et.textContent=`↑ ${mr.vehicleLabel}`,Et.title=`Return directly back to your parked ${mr.vehicleLabel} on ${mr.worldName}`):(Et.textContent=`↑ Orbit`,Et.title=`Return one scale level outward`)),ne&&(ne.disabled=Z===0&&!q.surfaceActive),d)for(let e of d.querySelectorAll(`[data-level]`))e.classList.toggle(`active`,Number(e.dataset.level)===Z);if(Ot){let e=q.getActiveSystemCatalog();Ur[2]=q.galaxyBranch===`smbh-core`?`Sgr A* SMBH`:q.useSolReference?`Sol Reference`:q.activeCausalSystem?.systemName||`Star System`;let t=q.stellarMode;Ur[3]=t===`pulsar`?`Pulsar Core`:t===`magnetar`?`Magnetar Core`:t===`black-hole`?`Stellar Black Hole`:t===`white-dwarf-tov`?`White Dwarf`:q.useSolReference?`Sun Core`:e[0]?.name||`Star Core`,Ur[4]=e[q.planetaryBodyIndex]?.name||`World`;let n=Ur.slice(0,Z+1);Ot.innerHTML=n.map((e,t)=>t===n.length-1?`<strong>${e}</strong>`:e).join(` › `)}hi()}async function Ei(){if(!q.surfaceActive||!q.surfaceSession)return null;let e=q.surfaceSession,t=q.getActiveSystemCatalog()[q.planetaryBodyIndex]||Qe[3],n=q.planetaryMode===`magma-ocean`?`Hadean Magma Ocean`:q.planetaryMode===`cryo-plumes`?`Cryovolcanic Moon`:t?.name||`World`,r=e.activeVehicle,i=r===`ufo`?`🛸 UFO`:r===`drone`?`🚁 Drone`:`🚙 Rover`;mr={bodyIndex:q.planetaryBodyIndex,planetaryMode:q.planetaryMode,worldName:n,vehicleLabel:i,checkpoint:e.getCheckpoint?e.getCheckpoint():null};let a={...e.getLocalSample(),worldName:n};return Vn.some(e=>e.id===a.id&&e.worldName===a.worldName)||(Vn.unshift(a),Vn.length>24&&Vn.pop()),$r(),await q.applySampledMaterialToLattice(a),q.exitSurfaceView(),Nr=null,Z=5,s=ct[5].log10SpanM,Ur[4]=n,Ur[5]=`${a.shortLabel} Lattice`,await ri(s),wi(),Ti(),Pi(),da(),$(performance.now()),a}async function Di(){if(!mr)return null;let e=mr;return Fi({bodyIndex:e.bodyIndex,planetaryModeOverride:e.planetaryMode,restoreCheckpoint:e.checkpoint})}async function Oi(e){if(!e)return null;let t=e.moleculeKey&&q.MOLECULE_SPECS[e.moleculeKey]?e.moleculeKey:`H2O`;return await q.initQuantumAtom({Z:e.primaryZ||q.quantumZ,mode:`molecule`,moleculeKey:t}),Nr=null,Z=6,s=ct[6].log10SpanM,Ur[6]=`${e.formula} (RHF)`,await ri(s),wi(),Ti(),da(),$(performance.now()),e}async function ki(e,{targetLevel:t=null}={}){let n=Math.max(1,Math.min(118,Math.trunc(Number(e)||14))),r=t??(Z===5?6:Z);return r<=5?(await q.initMolecularDynamics({Z:n,phasePreset:q.activeSampledMaterial?.phasePreset||`solid`}),Z=5,s=ct[5].log10SpanM):r===6?(await q.initQuantumAtom({Z:n,mode:`atom`,n:null,l:null,m:0}),Z=6,s=ct[6].log10SpanM):(await q.initAtomicNucleus({Z:n}),q.nuclearResult?.volumeData&&xn.uploadNuclearVolume(q.nuclearResult.volumeData),Z=7,s=ct[7].log10SpanM),Nr=null,await ri(s),wi(),Ti(),da(),$(performance.now()),n}async function Ai(){if(q.surfaceActive){await Ei();return}let e=Ci();if(Z===0&&Q?.kind===`cosmo-web`){let e=Number(Q.localOverdensity)||1.2,t=q.deriveGalaxyEnvironmentFromCosmicContext({cosmicEpoch:q.cosmicEpoch,regionPosMpc:Q.rawPos,localOverdensity:e,seed:q.seed});await q.initGalaxy({galaxyEnvOverride:t})}else if(Z===0&&e?.morphology)await q.initGalaxy({preset:e.morphology,metallicity:e.metallicity??1});else if(Z===1){if(Q?.kind===`galaxy-star`&&Q.exoticKind){Tn=!1,q.setGalaxyBranch(`solar-system`,Q.rawPos);let e=Q.exoticKind===`pulsar`;await q.selectCausalStarSite({posGal:Q.rawPos,popTag:Q.popTag??.5,starIndex:Q.index??0,forceExoticStage:e?`neutron-star`:`stellar-black-hole`}),er(),q.setFocusedSolarBody(0),await q.syncStellarRegimeForStar(null,{initializeNow:!0}),e?await ci(3,!0):(await q.setSolarMode(`xray-binary`),await ci(2,!0));return}if(Q?.kind===`galaxy-star`&&Q.starSite){Tn=!1,q.setGalaxyBranch(`solar-system`,Q.rawPos),await q.selectCausalStarSite(Q.starSite),er();let e=q.activeCausalSystem?.recommendedL3Regime;if(e&&e!==`fusion`){q.setFocusedSolarBody(0),await q.setStellarMode(e),await ci(3,!0);return}}else e?.branch&&(Tn=!1,q.setGalaxyBranch(e.branch,e.pos),e.branch===`solar-system`&&e.starSite&&(await q.selectCausalStarSite(e.starSite),er()))}if(Z===2&&Q?.kind===`solar-asteroid`){await Fi({customBodySpec:nr(Q)});return}if(Z===2&&e?.bodyIndex!=null){let t=q.getActiveSystemCatalog();q.setFocusedSolarBody(e.bodyIndex),t[e.bodyIndex]?.isStar||e.bodyIndex===0?(Tn=!1,await q.syncStellarRegimeForStar(t[e.bodyIndex],{initializeNow:!0})):await q.initPlanetaryInterior({bodyIndex:e.bodyIndex})}if(Z===4&&!q.surfaceActive){await Fi({bodyIndex:q.planetaryBodyIndex});return}if(Z===5){let t=q.activeSampledMaterial;if(t?.compounds?.length){await Oi(t.compounds[0]);return}e?.sampleZ&&await q.initQuantumAtom({Z:e.sampleZ,mode:`atom`})}Z===6&&e?.sampleZ&&(await q.initAtomicNucleus({Z:e.sampleZ}),q.nuclearResult?.volumeData&&xn.uploadNuclearVolume(q.nuclearResult.volumeData));let t=e?.nextLevel==null?(Z+1)%8:e.nextLevel;if(t===4){let e=q.getActiveSystemCatalog();(e[q.focusedSolarBodyIndex]?.isStar||q.focusedSolarBodyIndex===0)&&q.setFocusedSolarBody(q.getDefaultPlanetIndex(e))}si(ct[t].log10SpanM)}async function ji(){if(q.surfaceActive){Ii();return}if(Z===5&&mr){await Di();return}Z<=0||si(ct[Z-1].log10SpanM)}function Mi(){if(!q.surfaceSession)return;let e=q.surfaceSession,t=e.env,n=e.activeVehicle,r=n;r=t.hasSolidCrust?n===`ufo`?`rover`:n===`rover`?`drone`:`ufo`:n===`ufo`?`drone`:`ufo`,q.setSurfaceVehicle(r),Pi(),lr(),$(performance.now())}function Ni(){if(q.surfaceActive&&q.surfaceSession){let e=q.surfaceSession.cameraMode===`chase`?`first-person`:`chase`;q.setSurfaceCameraMode(e),Pi()}else On=!On;lr(),$(performance.now())}function Pi(){let e=!!(q.surfaceActive&&q.surfaceSession);if(jt?.classList.toggle(`active`,e),sn?.classList.toggle(`active`,e),Tt){let t=q.getActiveSystemCatalog(),n=t[q.focusedSolarBodyIndex],r=Z===2?Q?.kind===`solar-asteroid`?nr(Q):n:t[q.planetaryBodyIndex]||Qe[3],i=(Number(r?.radiusKm)||6371)>=16e3,a=!!(r?.isMinorBody||r?.isComet||Q?.kind===`solar-asteroid`),o=Z===2&&!e&&(Q?.kind===`solar-asteroid`||!!(n&&!n.isStar&&(n.isMinorBody||n.isComet))),s=Z===4&&zn&&zn.bodyIndex===q.planetaryBodyIndex,c=s?` (${Math.abs(zn.latDeg).toFixed(0)}°${zn.latDeg>=0?`N`:`S`} ${zn.biomeLabel.split(` `)[0]})`:``;Tt.textContent=a?`☄️ Land / Mine`:i?`🛸 Dive${c}`:s?`🛸 Land${c}`:`🚙 Land`,Tt.title=s?`Touch down at ${zn.latDeg.toFixed(1)}°, ${zn.lonDeg.toFixed(1)}° (${zn.biomeLabel}${zn.isNightSide?` · Night`:` · Day`})`:a?`Land 60-ft UFO / Rover / Von Neumann Probe on this Asteroid or Comet to mine & blast craters (L)`:i?`Deploy Buoyant 3D CFD Research UFO into deep planetary atmosphere (L)`:`Land 6-Wheel Rover / Drone / 3D CFD UFO on planetary surface (L)`,Tt.style.display=(Z===4||o)&&!e?`inline-flex`:`none`}if(kt&&(kt.style.display=e?`none`:``),!e)return;let t=q.surfaceSession,n=q.surfaceTelemetry||t.getTelemetry(),r=t.env,i=t.activeVehicle===`ufo`,a=t.activeVehicle===`drone`,o=q.surfaceBodySpec||q.getActiveSystemCatalog()[q.planetaryBodyIndex]||Qe[3],s=q.planetaryMode===`magma-ocean`?`Hadean Magma Ocean`:q.planetaryMode===`cryo-plumes`?`Cryovolcanic Moon`:o.name,c=n.rhoAtmKgM3??r.rhoAtmKgM3,l=c>1e-4?`ρ=${c.toFixed(c<.1?3:2)} kg/m³`:`<span class="warn">VACUUM (0 Pa)</span>`,u=n.cfdTelemetry,d=u?.chemistry,f=i?`🛸 60ft UFO`:a?`🚁 DRONE`:`🚙 ROVER`,p;if(i&&d){let e=d.pressureBar>=.1?`${d.pressureBar.toFixed(2)} bar`:`${(d.pressureBar*101.325).toFixed(1)} kPa`,t=u?.craftWindSpeedMS||0;p=`Alt ${r.hasSolidCrust?`${(n.ufoAltitudeM||0).toFixed(1)} m`:`${d.altKm.toFixed(1)} km`} · <strong>${e}</strong> · ${Math.round(d.tempK)} K · <span class="good">3D Wind ${t.toFixed(1)} m/s</span> · Rocks: ${n.aliveBoulderCount??0} · Craters: ${n.totalCratersCarved??0}`}else p=i?`Alt ${(n.ufoAltitudeM||0).toFixed(1)} m · Spd ${(n.ufoSpeedMS||0).toFixed(1)} m/s · Rocks: ${n.aliveBoulderCount??0} · Craters: ${n.totalCratersCarved??0}`:a?r.droneFlightCapable?`Alt ${(n.droneAltitudeM||0).toFixed(1)} m · Spd ${(n.droneSpeedMS||0).toFixed(1)} m/s · <span class="good">Lift ${(n.droneAeroLiftN||0).toFixed(1)}/${r.maxAeroLiftN.toFixed(1)} N</span>`:`Alt ${(n.droneAltitudeM||0).toFixed(1)} m · <span class="warn">0.0 N AERO LIFT (VACUUM!)</span>`:`Alt ${(n.roverAltitudeM||0).toFixed(1)} m · Spd ${(n.roverSpeedMS||0).toFixed(1)} m/s · Fuel ${Math.round((n.roverRocketFuel??1)*100)}%`;if(Nt){let e=q.surfaceClimate,t=Number.isFinite(e?.localHour)?e.localHour:12,i=q.surfaceLandingSite,a=i?` · <strong>${i.biomeLabel}</strong> (${i.latDeg.toFixed(1)}°, ${i.lonDeg.toFixed(1)}°)`:``,o=n.abductingOrganismName?` · <span class="good">🛸 BEAMING ${n.abductingOrganismName.toUpperCase()}…</span>`:Bn.length>0?` · <span class="good">🧬 Abducted: ${Bn.length}</span>`:``,c=e?` · <strong>${e.seasonName}</strong> ${String(Math.floor(t)).padStart(2,`0`)}:${String(Math.floor(t%1*60)).padStart(2,`0`)} · ${Math.round(e.surfaceTempK)} K${e.eclipseFactor<.92?` · <span class="warn">🌑 ECLIPSE</span>`:``}${e.iceCoverFrac>=.72?` · <span class="good">❄️ Frozen Sea</span>`:``}`:``;Nt.innerHTML=`<span><strong>${f}</strong> · ${s}${a} · g=${r.gravityMS2.toFixed(2)} m/s² · ${l} · ${p}${c}${o}</span>`}if(Gt){let e=q.surfaceTimeWarp||1;Gt.textContent=`⏩ ${qn(e)}`,Gt.classList.toggle(`active`,e>1.5)}if(Kt){let e=t.xenobiology,n=Bn.length?Bn[Bn.length-1]:null;n?(Kt.href=ue(n.profile||e,n.recommendedBioMode,n),Kt.style.display=`inline-flex`,Kt.textContent=`🛸 BIO LAB: ${n.speciesName} (${Bn.length}) ↗`,Kt.title=`Examine abducted ${n.kind} (${n.speciesName} · ${n.morphClass}) from ${n.worldName} in ULG Biology Lab`):e&&e.solvent&&e.solvent!==`none`?(Kt.href=ue(e),Kt.style.display=`inline-flex`,Kt.textContent=`🧬 ${e.solventFormula} BIO LAB ↗`,Kt.title=`Open ${e.worldName} (${e.solventLabel}, ${Math.round(e.labParams?.memTempK||r.tempK)} K, ${e.membraneType}) in Biophysics & Xenobiology Lab`):Kt.style.display=`none`}if(Pt){let e=n.weaponReaction;e?.reactionOutcome?(Pt.innerHTML=`<span><strong>${e.phaseState||`ACTIVE`}</strong>: ${e.reactionOutcome}${n.mpmActive?` · <span class="good">GPU MLS-MPM Active</span>`:``}</span>`,Pt.style.display=`flex`):Pt.style.display=`none`}if(lr(),G){let e=n.localSample||t.getLocalSample?.();if(u&&d&&d.species?.length>0){let t=d.species.slice(0,4).map(e=>{let t=e.moleFrac*100,n=t>=1?`${t.toFixed(1)}%`:t>=.01?`${t.toFixed(2)}%`:`${(t*1e4).toFixed(0)} ppm`,r=e.condensedFrac>1e-6?` <span class="warn">(☁)</span>`:``;return`<span><strong>${e.id}</strong> ${n}${r}</span>`}).join(` · `),n=u?.craftWindMS||[0,0,0],r=e?` · <span>Below: <strong>${e.shortLabel}</strong></span>`:``;G.innerHTML=`<span>3D CFD: v=(${n[0].toFixed(1)}, ${n[1].toFixed(1)}, ${n[2].toFixed(1)}) m/s · |ω|=${(u?.craftVorticity||0).toFixed(2)}</span> · ${t}${r}`,G.style.display=`flex`}else e?(G.innerHTML=`<span>Direct Below Craft: <strong>${e.name}</strong> · ${e.locationTag}</span>`,G.style.display=`flex`):G.style.display=`none`}if(Wt){let e=n.localSample||t.getLocalSample?.();Wt.textContent=e?`🔬 SAMPLE: ${e.shortLabel} (G)`:`🔬 SAMPLE BELOW (G)`}qt&&(qt.textContent=i||a?`⬆ ASCEND (Space)`:`🔥 ROCKET JUMP`,qt.classList.toggle(`firing`,!!q.surfaceControls.jump)),Jt&&(Jt.style.display=i||a?`inline-flex`:`none`,Jt.classList.toggle(`active`,!!q.surfaceControls.down)),Yt&&(r.hasSolidCrust?t.cfdProfile?Yt.textContent=i?`🛸 3D CFD UFO (F→Rover)`:a?`🚁 DRONE (F→UFO)`:`🚙 ROVER (F→Drone)`:Yt.textContent=a?`🚙 SWITCH ROVER (F)`:`🚁 DEPLOY DRONE (F)`:Yt.textContent=i?`🛸 3D CFD UFO (F→Drone)`:`🚁 DRONE (F→UFO)`,Yt.classList.toggle(`active`,i||a)),Xt&&(Xt.textContent=t.cameraMode===`first-person`?`📷 1ST CAM (V)`:`📷 3RD CAM (V)`,Xt.classList.toggle(`active`,t.cameraMode===`first-person`))}async function Fi({bodyIndex:e=null,customBodySpec:t=null,planetaryModeOverride:n=null,landingSite:r=null,restoreCheckpoint:i=null,initialVehicle:a=`ufo`}={}){kr=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),Nr=null;let o=e;if(!t){if(typeof o==`string`){let e=q.getActiveSystemCatalog(),t=e.findIndex(e=>e.id===o);o=t>=0&&!e[t].isStar?t:Qe.findIndex(e=>e.id===o)>0?o:q.planetaryBodyIndex}else if(!(o>0)){let e=q.getActiveSystemCatalog();o=!e[q.focusedSolarBodyIndex]?.isStar&&q.focusedSolarBodyIndex>0?q.focusedSolarBodyIndex:q.getDefaultPlanetIndex(e)}}Q=null,_r=!1,vr=[0,0,0],Z=4,s=2;let c=i;if(!c&&Yn.isConnected){let e=String(Yn.getStatus().selfId||`ufo`),t=2166136261;for(let n=0;n<e.length;n+=1)t=Math.imul(t^e.charCodeAt(n),16777619);let n=(t>>>0)%360*(Math.PI/180),r=18+(t>>>8)%16;c={activeVehicle:a||`ufo`,ufoPos:[Math.cos(n)*r,32,Math.sin(n)*r],ufoYaw:n+Math.PI}}let l=r||(zn&&!t&&(zn.bodyIndex===o||zn.bodyId===o)?zn:null);return await q.enterSurfaceView({bodyIndex:o,customBodySpec:t,planetaryModeOverride:n,landingSite:l,restoreCheckpoint:c,initialVehicle:a,onCraterStamp:(e,t)=>{Yn.isConnected&&Yn.broadcastCraterStamp({...e,tileKey:t})}}),q.setSurfaceWeaponConfig({mode:kn,log10WavelengthM:An,powerW:jn,maxPowerW:X.state.maxPowerW}),q.setSurfaceTractorBeam(Nn),On&&q.setSurfaceCameraMode(`first-person`),wi(),Ti(),Pi(),lr(),da(),$(performance.now()),q.surfaceTelemetry}function Ii(){if(!q.surfaceActive)return;q.exitSurfaceView();let e=q.getActiveSystemCatalog()[q.planetaryBodyIndex]||Qe[3];Z=4,s=xi(e),ii(q.planetaryBodyIndex),Ti(),Pi(),da(),$(performance.now())}Tt?.addEventListener(`click`,()=>{if(Z===2&&Q?.kind===`solar-asteroid`){Fi({customBodySpec:nr(Q)});return}Fi({bodyIndex:Z===2?q.focusedSolarBodyIndex:q.planetaryBodyIndex})}),window.addEventListener(`pagehide`,()=>{q.flushSurfaceCraters()}),window.addEventListener(`beforeunload`,()=>{q.flushSurfaceCraters()}),Wt?.addEventListener(`click`,()=>{Ei()}),qt?.addEventListener(`pointerdown`,e=>{e.preventDefault(),q.setSurfaceControls({jump:!0}),Pi()});let Li=()=>{q.surfaceControls.jump&&(q.setSurfaceControls({jump:!1}),Pi())};qt?.addEventListener(`pointerup`,Li),qt?.addEventListener(`pointerleave`,Li),qt?.addEventListener(`pointercancel`,Li),Jt?.addEventListener(`pointerdown`,e=>{e.preventDefault(),q.setSurfaceControls({down:!0}),Pi()});let Ri=()=>{q.surfaceControls.down&&(q.setSurfaceControls({down:!1}),Pi())};if(Jt?.addEventListener(`pointerup`,Ri),Jt?.addEventListener(`pointerleave`,Ri),Jt?.addEventListener(`pointercancel`,Ri),Yt?.addEventListener(`click`,()=>Mi()),Xt?.addEventListener(`click`,()=>Ni()),Zt?.addEventListener(`click`,()=>Ii()),y?.addEventListener(`click`,()=>Ni()),b?.addEventListener(`click`,()=>{Jn.toggleXr((e,t)=>{for(let e of t)$(performance.now(),e)})}),x?.addEventListener(`click`,async()=>{let e=fr();try{window.history?.replaceState?.(null,``,e),await navigator.clipboard?.writeText?.(e)}catch{}x&&(x.textContent=`✓ Copied!`,setTimeout(()=>{x&&(x.textContent=`🔗 Share`)},1600))}),C?.addEventListener(`click`,()=>{if(Yn.isConnected)Yn.disconnect();else{let e=be?.value?.trim()||``,t=r.roomId||`ulg-cosmos-public`;Yn.connect({room:t,relay:e})}cr();try{let e=fr();window.history?.replaceState?.(null,``,e)}catch{}}),Ft)for(let e of Ft.querySelectorAll(`[data-weapon]`))e.addEventListener(`click`,()=>{kn=e.dataset.weapon||`laser`,q.setSurfaceWeaponConfig({mode:kn}),lr()});let zi=e=>{if(Mn=!!e,kn===`missile`&&e){if(q.surfaceActive){let e=q.launchSurfaceMissile({});e&&Yn.isConnected&&Yn.broadcastMissileLaunch(e)}else (Z===2||Z===4)&&ar();Mn=!1}else q.setSurfaceWeaponFire({firing:Mn});lr()};It?.addEventListener(`pointerdown`,e=>{e.preventDefault(),zi(!0)}),It?.addEventListener(`pointerup`,()=>zi(!1)),It?.addEventListener(`pointerleave`,()=>zi(!1)),Lt?.addEventListener(`click`,()=>{Nn=!Nn,q.setSurfaceTractorBeam(Nn),lr()}),Rt?.addEventListener(`input`,e=>{An=Number(e.target.value),q.setSurfaceWeaponConfig({log10WavelengthM:An}),lr()}),Bt?.addEventListener(`input`,e=>{let t=Number(e.target.value);jn=Math.min(X.state.maxPowerW,10**t),q.setSurfaceWeaponConfig({powerW:jn,maxPowerW:X.state.maxPowerW}),lr()}),Ht?.addEventListener(`click`,()=>{let e=q.getActiveSystemCatalog()[q.focusedSolarBodyIndex]?.id||`earth`;er(),X.deployVonNeumannProbe({bodyId:e,systemKey:$n(),starPosGal:q.activeStarSite?.posGal||q.galaxyFocusPos||[4.8,.04,2.1],orbitRadius:1.8+Math.random()*1.4}),lr()});function Bi(e,t,n){if(!e||!t)return;let r=null,i=r=>{let i=e.getBoundingClientRect(),a=i.left+i.width*.5,o=i.top+i.height*.5,s=r.clientX-a,c=r.clientY-o,l=Math.hypot(s,c);l>36&&(s=s/l*36,c=c/l*36),t.style.transform=`translate(calc(-50% + ${s.toFixed(1)}px), calc(-50% + ${c.toFixed(1)}px))`,n(s/36,-c/36)};e.addEventListener(`pointerdown`,t=>{t.preventDefault(),r=t.pointerId,e.setPointerCapture?.(t.pointerId),i(t)}),e.addEventListener(`pointermove`,e=>{e.pointerId===r&&i(e)});let a=e=>{e.pointerId===r&&(r=null,t.style.transform=`translate(-50%, -50%)`,n(0,0))};e.addEventListener(`pointerup`,a),e.addEventListener(`pointercancel`,a)}let Vi={nx:0,ny:0};Bi(cn,ln,(e,t)=>{q.setSurfaceControls({moveX:e,moveY:t})}),Bi(un,dn,(e,t)=>{Vi={nx:e,ny:t},(Math.abs(e)>.02||Math.abs(t)>.02)&&q.addSurfaceLookDelta(-e*.04,-t*.025)}),window.addEventListener(`blur`,()=>{Vi={nx:0,ny:0},Gi=!1,ra=null,Mn=!1,J.clearKeys(),q.setSurfaceWeaponFire({firing:!1}),q.setSurfaceControls({forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0})});let Hi=e=>{let t=document.activeElement?.tagName;if(!(t===`INPUT`||t===`SELECT`||t===`TEXTAREA`)){if(e.code===`Tab`&&!e.repeat){e.preventDefault(),Qr();return}if(e.code===`KeyV`&&!e.repeat){Ni();return}if(e.code===`KeyI`&&!e.repeat){ei(j);return}if(e.code===`KeyT`&&!e.repeat){Nn=!Nn,q.setSurfaceTractorBeam(Nn),lr();return}if(e.code===`KeyX`&&!e.repeat){zi(!0);return}if(e.code===`KeyM`&&!e.repeat){if(q.surfaceActive){let e=q.launchSurfaceMissile({});e&&Yn.isConnected&&Yn.broadcastMissileLaunch(e)}else (Z===2||Z===4)&&ar();return}if(e.code===`Digit1`){kn=`laser`,q.setSurfaceWeaponConfig({mode:`laser`}),lr();return}if(e.code===`Digit2`){kn=`missile`,q.setSurfaceWeaponConfig({mode:`missile`}),lr();return}if(e.code===`Digit3`){kn=`antimatter`,q.setSurfaceWeaponConfig({mode:`antimatter`}),lr();return}if(e.code===`KeyP`&&!e.repeat){let e=q.getActiveSystemCatalog();er(),X.deployVonNeumannProbe({bodyId:e[q.focusedSolarBodyIndex]?.id||`earth`,systemKey:$n(),starPosGal:q.activeStarSite?.posGal||q.galaxyFocusPos||[4.8,.04,2.1]}),lr();return}if(!q.surfaceActive){if(J.mode===`ufo`){if(e.code===`KeyW`){J.setKeys({forward:!0}),e.preventDefault();return}if(e.code===`KeyS`){J.setKeys({backward:!0}),e.preventDefault();return}if(e.code===`KeyA`){J.setKeys({left:!0}),e.preventDefault();return}if(e.code===`KeyD`){J.setKeys({right:!0}),e.preventDefault();return}if(e.code===`Space`){J.setKeys({ascend:!0}),e.preventDefault();return}if(e.code===`KeyC`){J.setKeys({descend:!0});return}if(e.code===`KeyQ`){J.setKeys({rollLeft:!0});return}if(e.code===`KeyE`){J.setKeys({rollRight:!0});return}if(e.code===`ArrowUp`){J.setKeys({pitchUp:!0}),e.preventDefault();return}if(e.code===`ArrowDown`){J.setKeys({pitchDown:!0}),e.preventDefault();return}if(e.code===`ArrowLeft`){J.setKeys({yawLeft:!0}),e.preventDefault();return}if(e.code===`ArrowRight`){J.setKeys({yawRight:!0}),e.preventDefault();return}if(e.code===`ShiftLeft`||e.code===`ShiftRight`){J.setKeys({boost:!0});return}if(e.code===`ControlLeft`||e.code===`ControlRight`){J.setKeys({brake:!0});return}if(e.code===`KeyR`&&!e.repeat){J.levelHorizon(),Xr();return}}if(e.code===`KeyL`&&!e.repeat)if(Z===2&&Q?.kind===`solar-asteroid`)Fi({customBodySpec:nr(Q)});else if(Z===2){let e=q.getActiveSystemCatalog()[q.focusedSolarBodyIndex];e&&!e.isStar&&Fi({bodyIndex:q.focusedSolarBodyIndex})}else Z===4&&Fi({bodyIndex:q.planetaryBodyIndex});return}e.code===`KeyW`||e.code===`ArrowUp`?(q.setSurfaceControls({forward:!0}),e.preventDefault()):e.code===`KeyS`||e.code===`ArrowDown`?(q.setSurfaceControls({backward:!0}),e.preventDefault()):e.code===`KeyA`||e.code===`ArrowLeft`?(q.setSurfaceControls({left:!0}),e.preventDefault()):e.code===`KeyD`||e.code===`ArrowRight`?(q.setSurfaceControls({right:!0}),e.preventDefault()):e.code===`Space`?(q.setSurfaceControls({jump:!0}),e.preventDefault()):e.code===`ControlLeft`||e.code===`ControlRight`||e.code===`KeyC`?q.setSurfaceControls({down:!0}):e.code===`ShiftLeft`||e.code===`ShiftRight`?q.setSurfaceControls({turbo:!0}):e.code===`KeyQ`?q.setSurfaceControls({yawLeft:!0}):e.code===`KeyE`?q.setSurfaceControls({yawRight:!0}):e.code===`KeyF`&&!e.repeat&&q.surfaceSession?Mi():e.code===`KeyG`&&!e.repeat&&q.surfaceSession?(q.triggerSurfaceTractorPulse(2),Ei()):e.code===`Escape`&&Ii()}},Ui=e=>{e.code===`KeyX`&&zi(!1),e.code===`KeyW`?J.setKeys({forward:!1}):e.code===`KeyS`?J.setKeys({backward:!1}):e.code===`KeyA`?J.setKeys({left:!1}):e.code===`KeyD`?J.setKeys({right:!1}):e.code===`Space`?J.setKeys({ascend:!1}):e.code===`KeyC`?J.setKeys({descend:!1}):e.code===`KeyQ`?J.setKeys({rollLeft:!1}):e.code===`KeyE`?J.setKeys({rollRight:!1}):e.code===`ArrowUp`?J.setKeys({pitchUp:!1}):e.code===`ArrowDown`?J.setKeys({pitchDown:!1}):e.code===`ArrowLeft`?J.setKeys({yawLeft:!1}):e.code===`ArrowRight`?J.setKeys({yawRight:!1}):e.code===`ShiftLeft`||e.code===`ShiftRight`?J.setKeys({boost:!1}):(e.code===`ControlLeft`||e.code===`ControlRight`)&&J.setKeys({brake:!1}),q.surfaceActive&&(e.code===`KeyW`||e.code===`ArrowUp`?q.setSurfaceControls({forward:!1}):e.code===`KeyS`||e.code===`ArrowDown`?q.setSurfaceControls({backward:!1}):e.code===`KeyA`||e.code===`ArrowLeft`?q.setSurfaceControls({left:!1}):e.code===`KeyD`||e.code===`ArrowRight`?q.setSurfaceControls({right:!1}):e.code===`Space`?q.setSurfaceControls({jump:!1}):e.code===`ControlLeft`||e.code===`ControlRight`||e.code===`KeyC`?q.setSurfaceControls({down:!1}):e.code===`ShiftLeft`||e.code===`ShiftRight`?q.setSurfaceControls({turbo:!1}):e.code===`KeyQ`?q.setSurfaceControls({yawLeft:!1}):e.code===`KeyE`&&q.setSurfaceControls({yawRight:!1}))};if(window.addEventListener(`keydown`,Hi),window.addEventListener(`keyup`,Ui),W?.addEventListener(`click`,()=>{kr=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),Ai()}),Et?.addEventListener(`click`,()=>{kr=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),ji()}),ne?.addEventListener(`click`,()=>{kr=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),ji()}),w?.addEventListener(`click`,()=>{kr=!kr,w.classList.toggle(`active`,kr),w.textContent=kr?`⏹ Stop Tour`:`▶ Tour`,kr&&(Nr=null)}),te?.addEventListener(`click`,()=>{xr=!xr,te.textContent=xr?`⏸ Pause`:`▶ Resume`,h?.classList.toggle(`paused`,!xr)}),re?.addEventListener(`input`,e=>{if(Yn.timescaleLocked){Sr=1,re&&(re.value=`1.0`),ie&&(ie.textContent=`🔒 1.0×`);return}Sr=Number(e.target.value)||1,ie&&(ie.textContent=`${Sr.toFixed(1)}×`)}),ae?.addEventListener(`click`,async()=>{Ar=1,await q.setCosmoMode(`web`),await q.initCosmicWeb({bigBang:!0}),Nr=null,s=ct[0].log10SpanM,Z=0,wi(),Ti(),$(performance.now())}),oe?.addEventListener(`click`,async()=>{Ar=.75,q.setSeed(q.seed+7919>>>0),await q.initCosmicWeb(),q.galaxyEngine&&await q.initGalaxy(),q.solarEngine&&await q.initSolarSystem(),wi()}),ce)for(let e of ce.querySelectorAll(`[data-quality]`))e.addEventListener(`click`,async()=>{let t=e.dataset.quality;if(q.setQuality(t)){for(let e of ce.querySelectorAll(`[data-quality]`))e.classList.toggle(`active`,e.dataset.quality===t);Z===0?await q.initCosmicWeb():Z===1?await q.initGalaxy():Z===2&&q.galaxyBranch!==`smbh-core`?await q.initSolarSystem():Z===3?await q.initStellarCore():Z===5?await q.initMolecularDynamics():Z===6?await q.initQuantumAtom():Z===7&&(await q.initAtomicNucleus(),q.nuclearResult?.volumeData&&xn.uploadNuclearVolume(q.nuclearResult.volumeData)),hi()}});le?.addEventListener(`change`,e=>{Cr=e.target.checked}),fe?.addEventListener(`change`,e=>{wr=e.target.checked}),pe?.addEventListener(`change`,e=>{e.target.checked}),me?.addEventListener(`change`,e=>{Tr=e.target.checked}),he?.addEventListener(`change`,e=>{Er=e.target.checked}),ge?.addEventListener(`input`,e=>{Or=Number(e.target.value)||3,_e&&(_e.textContent=`${Or}×`)}),Ce?.addEventListener(`click`,async()=>{q.getPeerMeshState().connected?await q.disconnectPeerMesh():await q.connectPeerMesh({relayUrl:be?.value||``,roomId:n.get(`peerRoom`)||`ulg-universes-mesh-v1`,role:Se?.value||`requester`}),Wi()});function Wi(){let e=q.getPeerMeshState();Ce&&(Ce.textContent=e.connected?`Leave`:`Join Mesh`),we&&(we.textContent=e.connected?`${e.role} · ${e.remotePeers} peers · ${e.quorumReady?`2-of-2 QUORUM READY`:`waiting`}`:e.error?`Error: ${e.error}`:`Local GPU · 0 remote peers`)}let Gi=!1,Ki=!1,qi=0,Ji=0,Yi=0,Xi=0;function Zi(){let e=s;if(Z===0){if(q.cosmoMode!==`web`&&q.cosmoBaryonSession){let t=12.2/Math.max(100,q.cosmoBaryonSession.boxSizeMpc||260)*10**Math.max(-.6,Math.min(1.8,24.8-e));return{kind:`cosmo-baryon`,buffer:q.cosmoBaryonSession.getResidentTracersBuffer(),count:q.cosmoBaryonSession.tracerCount,strideFloats:16,layoutMode:Te.STANDARD,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(q.cosmoSession)return{kind:`cosmo-web`,buffer:q.cosmoSession.particlesBuffer,count:q.cosmoSession.particleCount,strideFloats:8,layoutMode:Te.STANDARD,worldScale:Hr.cosmoScale??.09,offsetHi:Hr.cosmoOffset??[0,0,0],offsetLo:[0,0,0],skipFirst:0}}else if(Z===1&&q.galaxyEngine)return{kind:`galaxy-star`,buffer:q.galaxyEngine.getResidentBuffer(),count:q.galaxyEngine.count,strideFloats:8,layoutMode:Te.GALAXY_VISIBLE,worldScale:Hr.galaxyScale??.85,offsetHi:Hr.galaxyOffset??[0,0,0],offsetLo:[0,0,0],skipFirst:0};else if(Z===2&&q.galaxyBranch!==`smbh-core`){if(q.solarMode===`formation`&&q.protoplanetarySession){let t=.92*10**Math.max(-1.2,Math.min(1.2,12.6-e));return{kind:`proto-pebble`,buffer:q.protoplanetarySession.getResidentPebblesBuffer(),count:q.protoplanetarySession.pebbleCount,strideFloats:16,layoutMode:Te.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(q.solarMode===`quasar-jet`&&q.kerrJetSession){let t=.85*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`kerr-parcel`,buffer:q.kerrJetSession.getResidentParcelsBuffer(),count:q.kerrJetSession.particleCount,strideFloats:16,layoutMode:Te.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(q.solarMode)&&q.relBinarySession){let t=1.12*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`relbin-parcel`,buffer:q.relBinarySession.getResidentParcelsBuffer(),count:q.relBinarySession.particleCount,strideFloats:16,layoutMode:Te.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`comet-tails`,`hot-jupiter`].includes(q.solarMode)&&q.radWindL2Session){let t=1.05*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`radwind-parcel`,buffer:q.radWindL2Session.getResidentParcelsBuffer(),count:q.radWindL2Session.particleCount,strideFloats:16,layoutMode:Te.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`roche-rings`,`giant-impact`,`red-giant`,`tde`].includes(q.solarMode)&&q.tidalRocheSession){let t=1.06*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`roche-parcel`,buffer:q.tidalRocheSession.getResidentParticlesBuffer(),count:q.tidalRocheSession.particleCount,strideFloats:16,layoutMode:Te.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(q.solarEngine){let t=q.getSolarReferenceOriginAu(e).originAu,n=[Math.fround(t[0]),Math.fround(t[1]),Math.fround(t[2])],r=[Math.fround(t[0]-n[0]),Math.fround(t[1]-n[1]),Math.fround(t[2]-n[2])],i=10**e/Je,a=16/Math.max(1e-9,i);return{kind:`solar-asteroid`,buffer:q.solarEngine.getResidentBuffer(),count:q.solarEngine.totalCount,strideFloats:16,layoutMode:Te.SOLAR_DOUBLE_FLOAT,worldScale:Hr.solarScaleAuToWorld??a,offsetHi:n,offsetLo:r,skipFirst:q.solarEngine.massiveCount}}}else if(Z===3){let t=.92*10**Math.max(-1,Math.min(1,9.2-e));if(q.stellarMode===`nebular-mhd`&&q.nebulaMhdSession)return{kind:`nebula-mhd-parcel`,buffer:q.nebulaMhdSession.getResidentTracersBuffer(),count:q.nebulaMhdSession.tracerCount,strideFloats:16,layoutMode:Te.STANDARD,worldScale:t*1.15,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if([`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`].includes(q.stellarMode)&&q.radWindL3Session)return{kind:`radwind-parcel`,buffer:q.radWindL3Session.getResidentParcelsBuffer(),count:q.radWindL3Session.particleCount,strideFloats:16,layoutMode:Te.FLAGGED_LIVE_16F,worldScale:t*1.05,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if((q.stellarMode===`pulsar`||q.stellarMode===`magnetar`)&&q.magnetosphereSession)return{kind:`mag-parcel`,buffer:q.magnetosphereSession.getResidentParcelsBuffer(),count:q.magnetosphereSession.particleCount,strideFloats:16,layoutMode:Te.FLAGGED_LIVE_16F,worldScale:t*1.12,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if(q.stellarEngine)return{kind:`stellar-hydro-parcel`,buffer:q.stellarEngine.getResidentBuffer(),count:q.stellarEngine.count,strideFloats:16,layoutMode:Te.STANDARD,worldScale:t*.95,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}else if(Z===5&&q.mdSession){let t=q.mdSession.boxLengthsA,n=8.4/Math.max(t[0],t[1],t[2],6),r=10**Math.max(-1.2,Math.min(1.4,-8.2-e));return{kind:`md-atom`,buffer:q.mdSession.positionsBuffer,velBuffer:q.mdSession.velocitiesBuffer,count:q.mdSession.atomCount,strideFloats:4,layoutMode:Te.MD_PERIODIC_4F,worldScale:n*r,offsetHi:[0,0,0],offsetLo:[t[0]*.5,t[1]*.5,t[2]*.5],skipFirst:0}}return null}function Qi(e,t,n){let r=n,i=e.worldScale||1,a=e.offsetHi||[0,0,0],o=e.offsetLo||[0,0,0],s=[r[0]||0,r[1]||0,r[2]||0],c;if(e.layoutMode===Te.SOLAR_DOUBLE_FLOAT?(s=[r[0]+r[4],r[1]+r[5],r[2]+r[6]],c=[(r[0]-a[0]+(r[4]-o[0]))*i,(r[1]-a[1]+(r[5]-o[1]))*i,(r[2]-a[2]+(r[6]-o[2]))*i]):c=e.layoutMode===Te.MD_PERIODIC_4F?[(r[0]-o[0])*i,(r[1]-o[1])*i,(r[2]-o[2])*i]:[(r[0]-a[0])*i,(r[1]-a[1])*i,(r[2]-a[2])*i],e.kind===`cosmo-web`){let n=Math.hypot(r[4]||0,r[5]||0,r[6]||0),i=Math.max(.05,Number(r[7])||.5),a=Math.max(.22,Math.min(4.8,i**1.65*4.2)),o=q.deriveGalaxyEnvironmentFromCosmicContext({cosmicEpoch:q.cosmicEpoch,regionPosMpc:s,localOverdensity:a,seed:q.seed});return{kind:e.kind,level:Z,index:t,rawPos:s,worldPos:c,localOverdensity:a,name:`Cosmic-Web Halo Mote #${t}`,subtitle:`${o.morphologyLabel} · δ/ρ̄=${a.toFixed(2)}× · [Fe/H]=${o.baseFeH>=0?`+`:``}${o.baseFeH.toFixed(2)}`,composition:`Causal Cosmic Context: f_gas=${(o.gasFraction*100).toFixed(0)}% · C/O=${o.baseCO.toFixed(2)} · Dive to form this galaxy`,tempK:8500,stats:[[`Comoving r`,`${Math.hypot(...s).toFixed(1)} Mpc`],[`Peculiar |v|`,`${(n*120).toFixed(0)} km/s`],[`Local δ/ρ̄`,`${a.toFixed(2)}×`],[`Morphology`,o.morphology]]}}if(e.kind===`cosmo-baryon`){let n=(r[11]||0)>.5,i=Number(r[8])||3e3,a=Number(r[9])||0,o=Number(r[7])||1;return{kind:e.kind,level:Z,index:t,rawPos:s,worldPos:c,name:`${n?`Dark-Matter Lensing Halo`:`Baryon / IGM Parcel`} #${t}`,subtitle:`Live GPU Cosmological Tracer · (${s[0].toFixed(1)}, ${s[1].toFixed(1)}, ${s[2].toFixed(1)}) Mpc`,composition:n?`Collisionless CDM Mass Tracer`:`H/He Plasma · x_HII=${(a*100).toFixed(1)}% · T=${i>1e5?`${(i/1e6).toFixed(1)} MK`:`${Math.round(i)} K`}`,tempK:Math.max(2500,Math.min(35e3,i)),stats:[[`Species`,n?`Dark Matter`:`Baryon Gas`],[`Temp T`,i>1e5?`${(i/1e6).toFixed(2)} MK`:`${Math.round(i)} K`],[`Ionized x_HII`,`${(a*100).toFixed(1)}%`],[`Density ρ`,`${o.toFixed(2)} ρ̄`]]}}if(e.kind===`galaxy-star`){let n=Number(r[7])||0,i=Math.hypot(s[0],s[2])*5.2,a=s[1]*5.2,o=Math.hypot(r[4]||0,r[5]||0,r[6]||0),l=q.galacticDynamoSession?.sampleBAt?.(s[0],s[1],s[2])||[0,0,0],u=Math.hypot(l[0],l[1],l[2]),d={posGal:[...s],popTag:n,starIndex:t},f=e=>{let t=e>>>0;return t=Math.imul(t^t>>>16,2146121005)>>>0,t=Math.imul(t^t>>>15,2221713035)>>>0,t=(t^t>>>16)>>>0,(t&16777215)/16777216},p=f(t>>>0^324508639),m=p>.986&&n>=.2,h=p>.974&&p<=.986&&n>=.1;if(m){let n=f(t>>>0^2654435769),r=f(t>>>0^608135816),l=.22*22**n,u=Math.max(1.4,1/(l*32)*1e3),p=(.8+r*14)*1e11,m=String(Math.floor(t*7%24)).padStart(2,`0`),h=String(Math.floor(t*13%60)).padStart(2,`0`),g=String(Math.floor(t*11%75)).padStart(2,`0`);return{kind:e.kind,level:Z,index:t,rawPos:s,worldPos:c,starSite:d,exoticKind:`pulsar`,name:`PSR J${m}${h}+${g} · Relativistic Pulsar #${t}`,subtitle:`Blinking Radio & γ-Ray Lighthouse · R=${i.toFixed(1)} kly · z=${a.toFixed(2)} kly`,composition:`Magnetized Neutron Star (1.42 M☉, R=11.4 km) · Sweeping relativistic synchrotron & γ-ray beams · Click Dive for 3D Pulsar!`,tempK:85e4,stats:[[`Type`,`Radio / γ Pulsar`],[`Spin Period P`,`${u.toFixed(2)} ms`],[`Surface |B|`,`${(p/1e11).toFixed(1)}×10¹¹ G`],[`Orbital |v|`,`${(o*24.5).toFixed(0)} km/s`]]}}if(h)return{kind:e.kind,level:Z,index:t,rawPos:s,worldPos:c,starSite:d,exoticKind:`xray-binary`,name:`ULG X-${t%999} · Accreting X-Ray Binary (BH)`,subtitle:`Relativistic Corona & QPO Shimmer · R=${i.toFixed(1)} kly · Eddington Accretion`,composition:`Stellar-mass Kerr Black Hole (8.4 M☉) accreting from OB donor · Blazes in X-Ray (0.1–10 nm) · Click Dive for Kerr Disk!`,tempK:22e6,stats:[[`Type`,`X-Ray Binary (BH)`],[`Corona T`,`22.0 MK`],[`Peak Band`,`0.1–2.0 nm X-Ray`],[`Orbital |v|`,`${(o*24.5).toFixed(0)} km/s`]]};let g=q.deriveStarSystemFromGalacticLocation({cosmicEpoch:q.cosmicEpoch,galaxyEnv:q.activeGalaxyEnv,starPosGal:s,popTag:n,starIndex:t,seed:q.seed+409>>>0}),_=q.synthesizeNebularPlanetarySystem(g,{seedOverride:q.seed+409>>>0}),v=g.multiplicity===3?`Trinary`:g.multiplicity===2?`Binary`:`Single`,y=g.stars.map(e=>e.spectralCode).join(`+`);return{kind:e.kind,level:Z,index:t,rawPos:s,worldPos:c,starSite:d,name:`Star #${t} · ${g.systemName} (${v} ${y})`,subtitle:`${g.galacticRegion} · ${g.nebulaBadge||`Main Sequence`} · ${_.planetCount} worlds${_.hasEarthLike?` (Earth-like!)`:``}`,composition:`Nebula: ${g.nebulaEnv.nebulaSummary} · Click 🎯 Focus or Dive to simulate this system`,tempK:g.stars[0].effectiveTempK,stats:[[`Multiplicity`,`${v} (${y})`],[`L3 Regime`,g.nebulaBadge||`Fusion Star`],[`Nebula [Fe/H]`,`${g.nebulaEnv.feH>=0?`+`:``}${g.nebulaEnv.feH.toFixed(2)}`],[`Local |B|`,`${(u*12).toFixed(2)} μG`]]}}if(e.kind===`solar-asteroid`){let n=Math.hypot(s[0],s[1],s[2]),i=Math.hypot(r[8]||0,r[9]||0,r[10]||0)*4.7405,a=q.activeCausalSystem?.condensationFrontsAu?.rSnowLineAu||2.7,o=(r[11]||0)>6.5||n>Math.max(8.5,a*3.5),l=q.getActiveSystemCatalog()?.[0]?.massSolar||1,u=Math.max(.05,n)**1.5/Math.sqrt(Math.max(.08,l)),d=Math.max(35,Math.round(280/Math.sqrt(Math.max(.2,n)))),f=o?{id:`kbo-${t}`,worldName:`Kuiper Belt Object #${t}`,category:`minor-body`,name:`Kuiper Volatile Ice & Tholin Planetesimal (H₂O · CH₄ · CO)`,shortLabel:`KBO Ice`,locationTag:`r = ${n.toFixed(2)} AU`,phasePreset:`solid`,tempK:d,primaryZ:8,formula:`H₂O/CH₄`,moleculeKey:`H2O`,compounds:[{id:`H2O`,formula:`H₂O`,name:`Amorphous Water Ice`,moleFrac:.68,primaryZ:8,moleculeKey:`H2O`,elements:[8,1]},{id:`CH4`,formula:`CH₄`,name:`Frozen Methane`,moleFrac:.2,primaryZ:6,moleculeKey:`CH4`,elements:[6,1]},{id:`CO`,formula:`CO`,name:`Carbon Monoxide Frost`,moleFrac:.12,primaryZ:6,moleculeKey:`CO`,elements:[6,8]}],elements:[{Z:8,sym:`O`,name:`Oxygen`},{Z:1,sym:`H`,name:`Hydrogen`},{Z:6,sym:`C`,name:`Carbon`}]}:{id:`asteroid-${t}`,worldName:`Main-Belt Asteroid #${t}`,category:`minor-body`,name:`Chondritic Silicate & Fe-Ni Asteroid (SiO₂ · Mg₂SiO₄ · Fe)`,shortLabel:`Chondrite Rock`,locationTag:`r = ${n.toFixed(2)} AU`,phasePreset:`solid`,tempK:d,primaryZ:14,formula:`SiO₂/Fe`,moleculeKey:`SiO2`,compounds:[{id:`SiO2`,formula:`SiO₂`,name:`Olivine/Pyroxene Silicate`,moleFrac:.62,primaryZ:14,moleculeKey:`SiO2`,elements:[14,8]},{id:`FeNi`,formula:`Fe-Ni`,name:`Metallic Chondrule Grains`,moleFrac:.26,primaryZ:26,moleculeKey:`O2`,elements:[26,28]},{id:`CO2`,formula:`C-Org`,name:`Carbonaceous Matrix`,moleFrac:.12,primaryZ:6,moleculeKey:`CO2`,elements:[6,8,1]}],elements:[{Z:14,sym:`Si`,name:`Silicon`},{Z:8,sym:`O`,name:`Oxygen`},{Z:26,sym:`Fe`,name:`Iron`},{Z:28,sym:`Ni`,name:`Nickel`},{Z:6,sym:`C`,name:`Carbon`}]};return{kind:e.kind,level:Z,index:t,rawPos:s,worldPos:c,sampleZ:f.primaryZ,sampleMaterial:f,name:`${o?`Kuiper Belt Object`:`Main-Belt Asteroid`} #${t}`,subtitle:`f32x2 Symplectic N-Body · r = ${n.toFixed(3)} AU · T = ${u.toFixed(2)} yr`,composition:o?`H₂O / CH₄ / CO Outer-System Icy Planetesimal`:`Silicate Chondrite + Fe-Ni Metallic Asteroid`,tempK:d,stats:[[`Helio r`,`${n.toFixed(3)} AU`],[`Speed |v|`,`${i.toFixed(2)} km/s`],[`Period T`,`${u.toFixed(2)} yr`],[`Type`,o?`Icy KBO`:`Silicate/Fe`]]}}if(e.kind===`proto-pebble`){let n=Math.hypot(s[0],s[1],s[2]),i=Number(r[8])||180,a=Number(r[9])||0;return{kind:e.kind,level:Z,index:t,rawPos:s,worldPos:c,name:`${a>.5?`Icy Outer`:`Rocky Silicate`} Pebble #${t}`,subtitle:`Epstein/Stokes Gas-Drag Disk Tracer · r = ${n.toFixed(2)} AU`,composition:a>.5?`Condensed H₂O/CO Ice + Silicate Core (Beyond Snow Line)`:`Refractory Silicate + Fe-Ni Chondrule Dust`,tempK:Math.max(50,Math.min(2e3,i)),stats:[[`Disk r`,`${n.toFixed(2)} AU`],[`Temp T(r)`,`${Math.round(i)} K`],[`Ice Frac`,`${(a*100).toFixed(0)}%`],[`Speed |v|`,`${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)}`]]}}if(e.kind===`stellar-hydro-parcel`){let n=Number(r[8])||4,i=Number(r[9])||-5,a=10**n,o=Number(r[10])||.72,l=Number(r[11])||-30,u=Number(r[13])||0,d=Number(r[14])||.26,f=Number(r[15])||.02,p=q.stellarDynamoSession?.sampleBAt?.(s[0],s[1],s[2])||[0,0,0],m=Math.hypot(p[0],p[1],p[2]);return{kind:e.kind,level:Z,index:t,rawPos:s,worldPos:c,name:`Stellar Plasma Parcel #${t}`,subtitle:`self-gravitating-hydro@1 · r = ${Math.hypot(...s).toFixed(2)} · x_ion = ${(u*100).toFixed(0)}%`,composition:`H ${(o*100).toFixed(1)}% · He ${(d*100).toFixed(1)}% · Z ${(f*100).toFixed(2)}%`,tempK:Math.max(2e3,Math.min(4e4,a)),stats:[[`Parcel T`,a>=1e6?`${(a/1e6).toFixed(2)} MK`:`${Math.round(a).toLocaleString()} K`],[`log₁₀ ρ`,`${i.toFixed(2)} kg/m³`],[`Fusion ε`,l>-12?`10^${l.toFixed(1)} W/kg`:`Inactive`],[`Dynamo |B|`,`${m.toFixed(3)} B_sim`]]}}if(e.kind===`nebula-mhd-parcel`){let n=Number(r[7])||0,i=Number(r[11])||0,a=Number(r[13])||0;return{kind:e.kind,level:Z,index:t,rawPos:s,worldPos:c,name:`MHD Nebula Parcel #${t}`,subtitle:`3D Resistive MHD · B = (${(r[8]||0).toFixed(2)}, ${(r[9]||0).toFixed(2)}, ${(r[10]||0).toFixed(2)})`,composition:a>.15?`Magnetocentrifugal (J×B) Bipolar Jet Plasma`:`Rotating Magnetized Molecular Cloud Gas & Dust`,tempK:a>.15?14e3:4200,stats:[[`Local |B|`,`${n.toFixed(3)}`],[`Density ρ`,`${i.toFixed(2)}`],[`Jet Outflow`,`${a.toFixed(2)}`],[`Speed |v|`,`${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)}`]]}}if(e.kind===`mag-parcel`||e.kind===`kerr-parcel`||e.kind===`relbin-parcel`){let n=Number(r[3])||0,i=Math.max(1,Number(r[7])||1),a=Number(r[9])||0,o=e.kind===`mag-parcel`?n>1.5?`Reconnection Flare / PWN`:n>.5?`Polar-Cap Open Beam`:`Closed Magnetosphere Loop`:e.kind===`kerr-parcel`?n>.5&&n<1.5?`Blandford–Znajek Jet`:`Novikov–Thorne Disk`:n>1.5?`r-Process Ejecta`:`Relativistic Stream`;return{kind:e.kind,level:Z,index:t,rawPos:s,worldPos:c,name:`${o} Parcel #${t}`,subtitle:`Persistent GPU Plasma Mote · Lorentz Γ = ${i.toFixed(2)}×`,composition:`Speed |v| = ${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)} · r = ${Math.hypot(...s).toFixed(2)}`,tempK:22e3,stats:[[`Role`,o.slice(0,14)],[`Lorentz Γ`,`${i.toFixed(2)}×`],[e.kind===`mag-parcel`?`Local |B|`:`Y_e / Aux`,`${a.toFixed(3)}`],[`Emissivity`,`${(r[10]||0).toFixed(2)}`]]}}if(e.kind===`radwind-parcel`||e.kind===`roche-parcel`){let n=Math.hypot(r[4]||0,r[5]||0,r[6]||0);return{kind:e.kind,level:Z,index:t,rawPos:s,worldPos:c,name:`${e.kind===`radwind-parcel`?`Photoionized Nebula/Tail`:`Tidal Debris/Ring`} Parcel #${t}`,subtitle:`Live GPU Parcel · r = ${Math.hypot(...s).toFixed(2)} · |v| = ${n.toFixed(2)}`,composition:e.kind===`radwind-parcel`?`Hα=${(r[8]||0).toFixed(2)} · [O III]=${(r[9]||0).toFixed(2)} · [S II]=${(r[10]||0).toFixed(2)}`:`Intact=${(r[7]||0)>.5?`Cohesive`:`Disrupted`} · T_norm=${(r[8]||0).toFixed(2)}`,tempK:11e3,stats:[[`Radius r`,`${Math.hypot(...s).toFixed(2)}`],[`Speed |v|`,`${n.toFixed(2)}`],[e.kind===`radwind-parcel`?`Hα / [O III]`:`Temp Norm`,e.kind===`radwind-parcel`?`${(r[8]||0).toFixed(1)} / ${(r[9]||0).toFixed(1)}`:`${(r[8]||0).toFixed(2)}`],[`GPU Index`,`#${t}`]]}}if(e.kind===`md-atom`){let n=q.getCachedElementBundle(q.mdElementZ,!0)?.bundle,r=n?.symbol||`Z=${q.mdElementZ}`;return{kind:e.kind,level:Z,index:t,rawPos:s,worldPos:c,name:`Atom #${t} · ${r} (Z=${q.mdElementZ})`,subtitle:`Live WebGPU MD Atom · (${s[0].toFixed(2)}, ${s[1].toFixed(2)}, ${s[2].toFixed(2)}) Å`,composition:`${n?.mechanical?.crystalStructure||`lattice`} · m = ${(n?.nuclear?.atomicMassU||55.8).toFixed(2)} u`,tempK:q.mdTelemetry?.temperatureK||q.mdTempK,stats:[[`Element`,`${r} (Z=${q.mdElementZ})`],[`Lattice x,y`,`${s[0].toFixed(1)}, ${s[1].toFixed(1)} Å`],[`Lattice z`,`${s[2].toFixed(2)} Å`],[`Bath Temp`,`${Math.round(q.mdTelemetry?.temperatureK||q.mdTempK)} K`]]}}return{kind:e.kind,level:Z,index:t,rawPos:s,worldPos:c,name:`GPU Mote #${t}`,subtitle:`Live Resident WebGPU Entity`,composition:``,tempK:6e3,stats:[[`Index`,`#${t}`],[`X`,s[0].toFixed(2)],[`Y`,s[1].toFixed(2)],[`Z`,s[2].toFixed(2)]]}}function $i(e,t){let n=q.getTargetsForLevel(Z,Hr),r=null,i=Z===2?26:42;for(let a of n){if(Z===0&&q.cosmoMode!==`web`||Z===2&&![`nbody`,`smbh-core`].includes(q.solarMode)&&q.galaxyBranch!==`smbh-core`||Z===2&&a.spec?.parent>0&&s>10.5||Z===3||Z===5)continue;let n=pi(a.pos,Lr,Rr,Vr);if(!n.visible)continue;let o=Math.hypot(n.sx-e,n.sy-t);o<i&&(i=o,r={...a,hitDistPx:o})}return r}async function ea(e,t,{preferGpuMote:n=!1}={}){if(Z===7&&yr.length>0){let n=null,r=36;for(let i=0;i<yr.length;i+=1){let a=yr[i],o=pi(a.pos,Lr,Rr,Vr);if(!o.visible)continue;let s=Math.hypot(o.sx-e,o.sy-t);s<r&&(r=s,n={idx:i,sphere:a})}if(n){let e=n.sphere.color0[0]>.7,t=Math.hypot(...n.sphere.pos)*(Number(q.nuclearResult?.chargeRadiusFm||3.7)/2.2);return Q={kind:`nucleon`,level:7,index:n.idx,rawPos:[...n.sphere.pos],worldPos:[...n.sphere.pos],name:`${e?`Proton p⁺`:`Neutron n⁰`} #${n.idx+1} (${q.nuclearA}${q.nuclearResult?.isotope?.split(`-`)[0]||``})`,subtitle:e?`Valence Quarks u-u-d · Charge +1e · Spin ½`:`Valence Quarks u-d-d · Charge 0 · Spin ½`,composition:`Bound inside Woods–Saxon nuclear potential (B/A = ${(q.nuclearResult?.bindingPerNucleonMeV||8.79).toFixed(3)} MeV)`,tempK:1e10,stats:[[`Baryon`,e?`Proton (p⁺)`:`Neutron (n⁰)`],[`Shell r`,`${t.toFixed(2)} fm`],[`Mass`,e?`938.27 MeV`:`939.57 MeV`],[`Quarks`,e?`u u d`:`u d d`]]},da(),$(performance.now()),Q}}if(Z===4&&!q.surfaceActive&&Ln&&Rn){let n=e/Math.max(1,Rr)*2-1,r=1-t/Math.max(1,Vr)*2,{pos:i,right:a,up:o,fwd:s,fovTanHalf:c,aspect:l}=Rn,u=li([s[0]+a[0]*(n*l*c)+o[0]*(r*c),s[1]+a[1]*(n*l*c)+o[1]*(r*c),s[2]+a[2]*(n*l*c)+o[2]*(r*c)]),{center:d,radius:f,spec:p,bodyIndex:m,seedFloat:h,lightDir:g}=Ln,_=[i[0]-d[0],i[1]-d[1],i[2]-d[2]],v=_[0]*u[0]+_[1]*u[1]+_[2]*u[2],y=_[0]*_[0]+_[1]*_[1]+_[2]*_[2]-f*f,b=v*v-y;if(b>=0){let e=-v-Math.sqrt(b);if(e>0){let t=[i[0]+u[0]*e,i[1]+u[1]*e,i[2]+u[2]*e],n=li([t[0]-d[0],t[1]-d[1],t[2]-d[2]]),r=Ir(n,p,h,g);return zn=Object.freeze({...r,bodyIndex:m,bodyId:p.id,worldPos:t}),Q={kind:`landing-site`,level:4,index:m,rawPos:[...n],worldPos:[...t],name:`🎯 Landing Site · ${r.biomeLabel}`,subtitle:`${p.name} · ${Math.abs(r.latDeg).toFixed(1)}°${r.latDeg>=0?`N`:`S`}, ${Math.abs(r.lonDeg).toFixed(1)}°${r.lonDeg>=0?`E`:`W`} · ${r.isNightSide?`Night Side`:r.isTwilight?`Terminator Sunset`:`Daylight`}`,composition:`Click 🛸 Land or Dive to touch down right on this ${r.biomeLabel.toLowerCase()} with matching orbital terrain, ocean, ice & sunlight!`,tempK:Math.max(40,(Number(p.tempK)||288)+r.tempOffsetK),stats:[[`Latitude`,`${Math.abs(r.latDeg).toFixed(1)}°${r.latDeg>=0?`N`:`S`}`],[`Longitude`,`${Math.abs(r.lonDeg).toFixed(1)}°${r.lonDeg>=0?`E`:`W`}`],[`Biome`,r.biomeLabel],[`Lighting`,r.isNightSide?`Night Side`:r.isTwilight?`Twilight`:`Sunlit`]]},Pi(),Ti(),da(),$(performance.now()),zn}}}let r=n?null:$i(e,t);if(r&&(Z===4||Z===1&&r.isSmbh||Z===2&&(r.hitDistPx??99)<=16))return Q=null,_r=!1,hr=r.id,Z===1&&r.branch?q.setGalaxyBranch(r.branch,r.pos):Z===2&&r.bodyIndex!=null&&(q.setFocusedSolarBody(r.bodyIndex),r.bodyIndex>0&&q.initPlanetaryInterior({bodyIndex:r.bodyIndex})),hi(),Ti(),da(),r;let i=Zi();if(i&&i.buffer&&i.count>0){let n=e/Math.max(1,Rr)*2-1,a=1-t/Math.max(1,Vr)*2,o=Rr/Math.max(1,Vr),s=0;if(i.kind===`galaxy-star`&&Y.active){let e=Math.min(Y.log10LambdaMin,Y.log10LambdaMax),t=Math.max(Y.log10LambdaMin,Y.log10LambdaMax);(t>-2.5||e<-10.8)&&(s|=4),t>-11.5&&e<-7.8&&(s|=8),t>-8.2&&e<-6.3&&(s|=16)}let c=await Sn.pickEntity({buffer:i.buffer,count:i.count,strideFloats:i.strideFloats,layoutMode:i.layoutMode,skipFirst:i.skipFirst||0,viewProj:Lr,clickNdcX:n,clickNdcY:a,aspect:o,maxPickNdc:i.kind===`solar-asteroid`?.18:s?.16:.14,offsetHi:i.offsetHi,offsetLo:i.offsetLo,worldScale:i.worldScale,reversedZ:!0,emPreferenceFlags:s});if(c){let n=new Float32Array([...c.vec0,...c.vec1,...c.vec2,...c.vec3]),a=Qi(i,c.index,n),o=a?.worldPos?pi(a.worldPos,Lr,Rr,Vr):null,s=o?.visible?Math.hypot(o.sx-e,o.sy-t):999;if(!r||Z!==2||s<=(r.hitDistPx??999))return hr=null,Q=a,Ti(),da(),$(performance.now()),Q}}return r?(Q=null,_r=!1,hr=r.id,Z===1&&r.branch?q.setGalaxyBranch(r.branch,r.pos):Z===2&&r.bodyIndex!=null&&(q.setFocusedSolarBody(r.bodyIndex),r.bodyIndex>0&&q.initPlanetaryInterior({bodyIndex:r.bodyIndex})),hi(),Ti(),da(),r):null}async function ta(){if(!Q||Q.level!==Z||Q.kind===`nucleon`)return;let e=Zi();if(!e||e.kind!==Q.kind||!e.buffer)return;let t=await Sn.readSingleEntity(e.buffer,Q.index,e.strideFloats);t&&Q&&Q.kind===e.kind&&(Q=Qi(e,Q.index,t))}function na({zoomIn:e=!1}={}){return Q?(Z===0&&Q.kind===`cosmo-web`?(q.setCosmoFocusMpc(Q.rawPos),_r=!0,e&&si(Math.max(21.2,s-1.6))):Z===1&&Q.kind===`galaxy-star`?(q.setGalaxyBranch(`solar-system`,Q.rawPos),Q.starSite&&q.selectCausalStarSite(Q.starSite),_r=!0,e&&si(Math.max(17.5,s-1.5))):(_r=!_r||e,_r?(vr=[...Q.worldPos],e&&(Fr.dist=Math.max(6.5,Fr.dist*.62))):(vr=[0,0,0],Fr.dist=18)),da(),$(performance.now()),!0):!1}wt?.addEventListener(`click`,()=>{na({zoomIn:!_r})});let ra=null;c.addEventListener(`pointerdown`,e=>{ra!==null&&ra!==e.pointerId||(ra=e.pointerId,Gi=!0,Ki=!1,qi=e.clientX,Ji=e.clientY,Yi=e.clientX,Xi=e.clientY,c.setPointerCapture?.(e.pointerId))}),c.addEventListener(`pointermove`,e=>{if(Gi&&(ra===null||e.pointerId===ra)){let t=e.clientX-Yi,n=e.clientY-Xi;Math.hypot(e.clientX-qi,e.clientY-Ji)>5&&(Ki=!0),q.surfaceActive?q.addSurfaceLookDelta(-t*.0055,n*.0055):J.mode===`ufo`?(e.shiftKey||e.buttons&2?J.rotateLocal(0,0,-t*.008):J.rotateLocal(-n*.006,-t*.006,0),Xr()):(Fr.yaw-=t*.006,Fr.pitch=Math.max(-1.42,Math.min(1.42,Fr.pitch+n*.006))),Yi=e.clientX,Xi=e.clientY}else if(!q.surfaceActive){let t=$i(e.clientX,e.clientY);gr=t?.id||null,c.style.cursor=t?`pointer`:`crosshair`}});let ia=(e,t)=>{ra!==null&&e.pointerId!==ra||(t&&Gi&&!Ki&&!q.surfaceActive&&(kr=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),ea(e.clientX,e.clientY)),Gi=!1,ra=null)};c.addEventListener(`pointerup`,e=>ia(e,!0)),c.addEventListener(`pointercancel`,e=>ia(e,!1)),c.addEventListener(`dblclick`,async e=>{if(q.surfaceActive)return;kr=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`);let t=await ea(e.clientX,e.clientY);t&&t===Q?na({zoomIn:!0}):Ai()});let aa=!1;c.addEventListener(`wheel`,e=>{e.preventDefault();let t=P(e);if(q.surfaceActive){let e=1.12**Math.max(-2.5,Math.min(2.5,t/120));q.adjustSurfaceChaseDistance(e),$(performance.now());return}if(J.mode===`ufo`&&!e.shiftKey){let e=1.22**Math.max(-3,Math.min(3,t/120));J.adjustChaseZoom(e),Xr(),$(performance.now());return}kr=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),Nr=null;let n=Math.max(-.55,Math.min(.55,t*.0024)),r=Math.max(st,Math.min(ot,s+n));if(Z===4&&n<0&&r<5.75&&!aa){aa=!0,Fi({bodyIndex:q.planetaryBodyIndex}).finally(()=>{aa=!1});return}s=r,Pr=Math.abs(n)*10,ri(s)},{passive:!1});let oa=1;c.addEventListener(`gesturestart`,e=>{e.preventDefault(),oa=Number(e.scale)||1},{passive:!1}),c.addEventListener(`gesturechange`,e=>{e.preventDefault();let t=Number(e.scale)||1;if(t>.05&&oa>.05){let e=oa/t;if(q.surfaceActive)q.adjustSurfaceChaseDistance(e),$(performance.now());else{Nr=null;let t=Math.max(-.45,Math.min(.45,Math.log10(e)*2.2));s=Math.max(st,Math.min(ot,s+t)),ri(s)}}oa=t},{passive:!1});function sa(e){if(!vt)return;let t=vt.getContext(`2d`);if(!t)return;let n=vt.width,r=vt.height;t.fillStyle=`#040812`,t.fillRect(0,0,n,r);for(let e=0;e<n;e+=2){let[i,a,o]=mi(380+e/n*340);t.fillStyle=`rgba(${i},${a},${o},0.16)`,t.fillRect(e,0,2,r)}let i=Z>=5?q.getCachedElementBundle(Z===5?q.mdElementZ:q.quantumZ,q.quantumRelativistic):null,a=ur(Z,e,i);for(let e of a){let i=(e.wavelengthNm-380)/340*n;if(i<0||i>n)continue;let[a,o,s]=mi(e.wavelengthNm),c=Math.max(.25,Math.min(1,e.intensity));t.fillStyle=`rgba(${a},${o},${s},${c.toFixed(2)})`,t.fillRect(i-1.5,0,3,r),t.fillStyle=`rgba(255,255,255,${(c*.45).toFixed(2)})`,t.fillRect(i-.5,2,1,r-4)}if((Z===2||Z===4)&&wn?.spectralFeaturesNm?.length)for(let e of wn.spectralFeaturesNm){let i=(e.nm-380)/340*n;i<2||i>n-2||(t.fillStyle=e.isBio?`#34d399`:`#fbbf24`,t.fillRect(i-1,0,2,r),t.fillStyle=`rgba(2, 6, 23, 0.78)`,t.fillRect(Math.min(n-38,i+2),1,36,9),t.fillStyle=e.isBio?`#a7f3d0`:`#fde68a`,t.font=`700 7.5px monospace`,t.fillText(e.label.slice(0,7),Math.min(n-36,i+3),8))}}function ca(){if(!Ct)return;let e=Ct.getContext(`2d`);if(!e)return;let t=Ct.width,n=Ct.height;e.fillStyle=`#050b16`,e.fillRect(0,0,t,n),e.strokeStyle=`rgba(148,163,184,0.18)`,e.lineWidth=1,e.strokeRect(8,8,t-16,n-18);let r=(t,r,i,a=null,o=!1)=>{if(t.length){e.beginPath(),o&&e.setLineDash([3,3]);for(let n=0;n<t.length;n+=1)n===0?e.moveTo(t[n],r[n]):e.lineTo(t[n],r[n]);e.strokeStyle=i,e.lineWidth=o?1.2:2,e.stroke(),e.setLineDash([]),a&&(e.lineTo(t[t.length-1],n-10),e.lineTo(t[0],n-10),e.closePath(),e.fillStyle=a,e.fill())}};if(Z===0){let e=q.cosmoTelemetry?.powerSpectrumPk;if(!e?.kBins?.length)return;St&&(St.textContent=`D/D₀ = ${(e.linearGrowthRatio||1).toFixed(2)}× · ${e.kBins.length} k-bins`);let i=e.kBins.map(e=>Math.log10(Math.max(1e-4,e))),a=e.pkValues.map(e=>Math.log10(Math.max(1e-6,e))),o=Math.min(...i),s=Math.max(o+.2,...i),c=q.cosmoFirstPk?.pkValues?.map(e=>Math.log10(Math.max(1e-6,e)))||[],l=[...a,...c],u=Math.min(...l)-.3,d=Math.max(u+1,...l)+.3,f=e=>12+(e-o)/(s-o)*(t-24),p=e=>n-12-(e-u)/(d-u)*(n-24);c.length===i.length&&r(i.map(f),c.map(p),`rgba(148,163,184,0.6)`,null,!0),r(i.map(f),a.map(p),`#38bdf8`,`rgba(56,189,248,0.16)`,!1)}else if(Z===1){St&&(St.textContent=`Gate 1 H/He/C/O · Z=${q.galaxyMetallicity.toFixed(1)} Z☉`);let e=[],i=[];for(let r=0;r<48;r+=1){let a=2+r/47*6,o=q.evaluateIsmRadiativeCoolingErgCm3PerS(10**a,q.galaxyMetallicity,q.ismCoolingAnchors),s=Math.log10(Math.max(1e-28,o));e.push(12+r/47*(t-24)),i.push(n-12-(s- -26.5)/5.5*(n-24))}r(e,i.map(e=>Math.max(10,Math.min(n-12,e))),`#a78bfa`,`rgba(167,139,250,0.18)`,!1)}else if(Z===2)if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(q.solarMode)&&q.relBinaryTelemetry?.gwStrainHistory?.length){let e=q.relBinaryTelemetry.gwStrainHistory;xt&&(xt.textContent=`2.5PN GRAVITATIONAL-WAVE STRAIN h_+(t)`),St&&(St.textContent=`f_GW=${(q.relBinaryTelemetry.gwFrequency||0).toFixed(2)} · sep=${(q.relBinaryTelemetry.separation||0).toFixed(2)}`);let i=Math.max(.08,...e.map(e=>Math.abs(e)));r(e.map((n,r)=>12+r/Math.max(1,e.length-1)*(t-24)),e.map(e=>n*.5-e/i*(n*.38)),`#38bdf8`,`rgba(56,189,248,0.14)`,!1)}else if(q.solarMode===`quasar-jet`&&q.kerrJetTelemetry){xt&&(xt.textContent=`NOVIKOV–THORNE DISK T(r) & BZ JET`);let e=q.kerrJetTelemetry;St&&(St.textContent=`a*=${e.spinA.toFixed(2)} · r_ISCO=${e.rIscoRg.toFixed(2)} r_g · Γ=${e.maxLorentzGamma.toFixed(1)}`);let i=[],a=[];for(let e=0;e<48;e+=1){let r=1.02+e/47*9,o=(1/r)**.75*Math.max(.01,1-Math.sqrt(1/r))**.25;i.push(12+e/47*(t-24)),a.push(n-12-Math.min(1,o*2.2)*(n-24))}r(i,a,`#f472b6`,`rgba(244,114,182,0.20)`,!1)}else{xt&&(xt.textContent=ct[2].plotTitle);let r=q.solarConservation0,i=q.solarConservation,a=r&&i?Math.abs(i.totalEnergy-r.totalEnergy)/Math.max(1e-12,Math.abs(r.totalEnergy)):0;St&&(St.textContent=`|ΔE/E₀|=${a.toExponential(1)} · ${q.solarEngine?.totalCount||0} bodies`);let o=q.getActiveSystemCatalog().filter(e=>!e.isStar&&(e.parent===0||e.parent===-2)&&e.id!==`halley`),s=(t-32)/Math.max(1,o.length);o.forEach((t,r)=>{let i=Math.min(1,Math.log10(Math.max(30,t.tempK))/3.3)*(n-28),a=16+r*s+2;e.fillStyle=`rgb(${Math.round(t.color0[0]*255)},${Math.round(t.color0[1]*255)},${Math.round(t.color0[2]*255)})`,e.fillRect(a,n-12-i,Math.max(6,s-6),i),e.fillStyle=`#94a3b8`,e.font=`8.5px monospace`,e.fillText(t.name.split(` `).slice(-1)[0].replace(/[()]/g,``).slice(0,4),a,n-14-i)})}else if(Z===3)if((q.stellarMode===`pulsar`||q.stellarMode===`magnetar`)&&q.magnetosphereTelemetry?.flareHistory?.length){let e=q.magnetosphereTelemetry.flareHistory;xt&&(xt.textContent=q.stellarMode===`magnetar`?`MAGNETAR HALL-YIELD FLARE LIGHT CURVE`:`PULSAR SPIN-DOWN BEAM FLUX`),St&&(St.textContent=`B=${q.magnetosphereTelemetry.surfaceBFieldTesla.toExponential(1)} T · Flares=${q.magnetosphereTelemetry.flareCount}`);let i=Math.max(.4,...e);r(e.map((n,r)=>12+r/Math.max(1,e.length-1)*(t-24)),e.map(e=>n-12-e/i*(n-24)),q.stellarMode===`magnetar`?`#f472b6`:`#38bdf8`,`rgba(244,114,182,0.18)`,!1)}else if(q.stellarMode===`white-dwarf-tov`&&q.tovCurve?.length){xt&&(xt.textContent=`WEBGPU GR TOV MASS–RADIUS M(R) SEQUENCE`);let e=q.tovCurve.filter(e=>e.radiusKm>1&&e.massSolar>.05);St&&(St.textContent=`${e.length} GR TOV solutions · WD → NS → BH`),r(e.map(e=>12+(Math.log10(e.radiusKm)-.8)/3.6*(t-24)),e.map(e=>n-12-Math.min(1,e.massSolar/3.2)*(n-24)),`#34d399`,`rgba(52,211,153,0.18)`,!1)}else{xt&&(xt.textContent=ct[3].plotTitle);let e=q.stellarTelemetry,i=Math.max(2e6,e?.coreTempK||15e6),a=i*8.617333262e-8,o=1.22*Math.max(.01,i*1e-6)**(2/3);St&&(St.textContent=`E₀=${o.toFixed(1)} keV · LE ξ₁=${(q.stellarLaneEmden?.solutions?.[1]?.xi1||6.9).toFixed(2)}`);let s=Math.max(20,o*3),c=[],l=[],u=[],d=1e-300;for(let e=1;e<=48;e+=1){let r=e/48*s,i=12+e/48*(t-24),o=Math.exp(-Math.min(50,r/Math.max(.001,a))),f=o*Math.exp(-Math.min(60,Math.sqrt(493/Math.max(.05,r))));f>d&&(d=f),c.push(i),l.push(n-12-Math.min(1,o)*(n-24)),u.push(f)}let f=u.map(e=>n-12-e/Math.max(1e-300,d)*(n-24));r(c,l,`rgba(251,191,36,0.65)`,null,!0),r(c,f,`#34d399`,`rgba(52,211,153,0.28)`,!1)}else if(Z===4){let e=q.planetaryResult?.profile||[];if(!e.length)return;let i=Math.max(1,q.planetaryResult.radiusM||637e4),a=Math.max(1e9,e[0].pressurePa||36e10),o=Math.max(2e3,...e.map(e=>e.densityKgPerM3||0));St&&(St.textContent=`P_c=${(a/1e9).toFixed(0)} GPa · MoI=${(q.planetaryResult.moiFactor||.33).toFixed(3)}`);let s=e.map(e=>12+e.radiusM/i*(t-24)),c=e.map(e=>n-12-e.pressurePa/a*(n-24)),l=e.map(e=>n-12-e.densityKgPerM3/o*(n-24));r(s,c,`#fb923c`,`rgba(251,146,60,0.16)`,!1),r(s,l,`#38bdf8`,null,!1)}else if(Z===5){let e=q.mdRdfHistory;if(!e?.length)return;St&&(St.textContent=`Phase: ${q.mdTelemetry?.emergentPhase||`—`} · ⟨Z⟩=${(q.mdTelemetry?.meanCoordination||0).toFixed(1)}`);let i=Math.max(1,...e);r(e.map((n,r)=>12+r/(e.length-1)*(t-24)),e.map(e=>n-12-e/i*(n-24)),`#34d399`,`rgba(52,211,153,0.22)`,!1)}else if(Z===6){let e=q.getCachedElementBundle(q.quantumZ,q.quantumRelativistic)?.visualData?.atom;if(!e?.rGrid?.length||!e?.rho?.length)return;St&&(St.textContent=`Dirac–KS ${q.quantumRelativistic?`Rel ON`:`Rel OFF`} · Z=${q.quantumZ}`);let i=Math.min(120,e.rGrid.length),a=[],o=1e-9;for(let t=0;t<i;t+=1){let n=e.rGrid[t],r=4*Math.PI*n*n*Math.max(0,e.rho[t]);r>o&&(o=r),a.push(r)}r(a.map((e,n)=>12+n/(a.length-1)*(t-24)),a.map(e=>n-12-e/o*(n-24)),`#38bdf8`,`rgba(56,189,248,0.22)`,!1)}else if(Z===7){let e=q.tdseTelemetry;if(!e?.prob?.length)return;St&&(St.textContent=`P_in=${(e.pInside*100).toFixed(1)}% · P_tun=${(e.pTunneled*100).toFixed(2)}%`);let i=e.prob.length,a=Math.max(1e-4,...e.prob),o=Math.max(1,...e.potRawMeV),s=Array.from({length:i},(e,n)=>12+n/(i-1)*(t-24)),c=Array.from({length:i},(t,r)=>n-12-Math.max(0,e.potRawMeV[r]/o)*(n-26)),l=Array.from({length:i},(t,r)=>n-12-e.prob[r]/a*(n-24));r(s,c,`rgba(251,191,36,0.72)`,null,!0),r(s,l,`#34d399`,`rgba(52,211,153,0.28)`,!1)}}let la=``;function ua(){if(!bt)return;let e=q.activeSampledMaterial,t=!!(e&&Z>=5&&!q.surfaceActive);if(bt.classList.toggle(`active`,t),!t){la=``;return}let n=`${e.id}:${Z}:${q.mdElementZ}:${q.quantumMode}:${q.quantumMoleculeKey}:${q.quantumZ}:${q.nuclearZ}:${mr?mr.vehicleLabel:`none`}`;if(n===la)return;la=n;let r=(e.compounds||[]).slice(0,4).map((e,t)=>{let n=Z===6&&q.quantumMode===`molecule`&&q.quantumMoleculeKey===e.moleculeKey,r=Number.isFinite(e.moleFrac)?` ${(e.moleFrac*100).toFixed(e.moleFrac>=.1?0:1)}%`:``;return`<button class="uv-chip compound ${n?`active`:``}" data-sample-comp="${t}" type="button" title="Inspect ${e.name} (${e.formula}) molecular orbitals on L6">${e.formula}${r}</button>`}).join(``),i=(e.elements||[]).slice(0,6).map(e=>`<button class="uv-chip ${Z===5&&q.mdElementZ===e.Z||Z===6&&q.quantumMode===`atom`&&q.quantumZ===e.Z||Z===7&&q.nuclearZ===e.Z?`active`:``}" data-sample-el="${e.Z}" type="button" title="Examine ${e.name} (Z=${e.Z}) at this scale">${e.sym}(${e.Z})</button>`).join(``),a=mr?`<button class="uv-chip active" id="uv-back-to-surface-btn" data-return-surface="1" type="button" style="border-color:rgba(52,211,153,0.75);background:rgba(16,185,129,0.28);color:#ecfdf5;" title="Return directly to your parked ${mr.vehicleLabel} on ${mr.worldName}">↩ Back to ${mr.vehicleLabel}</button>`:``;bt.innerHTML=`
      <div class="uv-sample-head">
        <span>🔬 ${e.worldName} · ${e.shortLabel}</span>
        ${a||`<span style="color:var(--muted);">${e.locationTag}</span>`}
      </div>
      <div class="uv-chip-row"><span class="uv-chip-lbl">Compounds:</span>${r}</div>
      <div class="uv-chip-row"><span class="uv-chip-lbl">Elements:</span>${i}</div>
      <div class="uv-chip-row">
        <span class="uv-chip-lbl">Step:</span>
        <button class="uv-chip ${Z===5?`active`:``}" data-sample-step="5" type="button">L5 Lattice</button>
        <button class="uv-chip ${Z===6&&q.quantumMode===`molecule`?`active`:``}" data-sample-step="6m" type="button">L6 Compound</button>
        <button class="uv-chip ${Z===6&&q.quantumMode===`atom`?`active`:``}" data-sample-step="6a" type="button">L6 Element</button>
        <button class="uv-chip ${Z===7?`active`:``}" data-sample-step="7" type="button">L7 Nucleus</button>
        ${e.xenoUrl?`<a class="uv-chip" href="${e.xenoUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;border-color:rgba(167,139,250,0.65);color:#ddd6fe;" title="Synthesize native alien membranes &amp; biopolymers for this world in Life Lab">🧬 Bio Lab ↗</a>`:``}
      </div>`,bt.querySelector(`[data-return-surface]`)?.addEventListener(`click`,()=>{Di()});for(let t of bt.querySelectorAll(`[data-sample-comp]`))t.addEventListener(`click`,()=>{let n=e.compounds?.[Number(t.dataset.sampleComp)];n&&Oi(n)});for(let e of bt.querySelectorAll(`[data-sample-el]`))e.addEventListener(`click`,()=>{let t=Number(e.dataset.sampleEl);t>0&&ki(t,{targetLevel:Z})});for(let t of bt.querySelectorAll(`[data-sample-step]`))t.addEventListener(`click`,()=>{let n=t.dataset.sampleStep;n===`5`?ki(q.mdElementZ||e.primaryZ,{targetLevel:5}):n===`6m`?Oi(e.compounds?.[0]):n===`6a`?ki(q.quantumZ||e.primaryZ,{targetLevel:6}):n===`7`&&ki(q.nuclearZ||q.quantumZ||e.primaryZ,{targetLevel:7})})}function da(){let e=ct[Z],t=!!(Q&&Q.level===Z),n=t?Q:Ci(),r=q.computeScaleAdaptiveTimeDilation(s,{surfaceActive:q.surfaceActive,userTimeScale:Sr});g&&(g.textContent=`10^${s.toFixed(1)} m`),_&&(_.textContent=r.clockLabel),m&&(m.textContent=dt(s)),p&&document.activeElement!==p&&(p.value=s.toFixed(2)),at&&(at.textContent=t?`GPU MOTE INSPECTOR · L${e.level} · ${dt(s)}`:`L${e.level} · ${e.name.toUpperCase()} · ${dt(s)}`),mt&&(mt.textContent=n?.name||e.name),ht&&(ht.textContent=n?.subtitle||e.engineSchema),_t&&(_t.textContent=n?.composition||``),gt&&(gt.textContent=Z>=5?`GATE 1 OPTICAL SPECTRUM`:`EMISSION SPECTROGRAPH`),wt&&(wt.style.display=t&&!q.surfaceActive?`inline-flex`:`none`,wt.textContent=_r?`🎯 Locked`:`🎯 Focus`,wt.classList.toggle(`active`,_r));let i=[];if(t&&Array.isArray(Q.stats)&&Q.stats.length)i=Q.stats;else if(Z===0)if(q.cosmoMode!==`web`&&q.cosmoBaryonTelemetry){let e=q.cosmoBaryonTelemetry,t=e.redshiftZ>100?`${e.cmbTempK.toFixed(0)} K`:e.maxGasTempK>=1e5?`${(e.maxGasTempK/1e6).toFixed(1)} MK`:`${Math.round(e.maxGasTempK).toLocaleString()} K`;i=[[`Redshift z`,`${e.redshiftZ.toFixed(e.redshiftZ>100?0:2)}`],[`T_CMB / Gas`,t],[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Lensing κ_max`,`${e.maxLensingKappa.toFixed(2)}`]]}else{let e=q.cosmoTelemetry;i=[[`Scale a(t)`,e?e.scaleFactorA.toFixed(3):`—`],[`Redshift z`,e?e.redshiftZ.toFixed(2):`—`],[`Density σ`,e?e.sigmaDensity.toFixed(3):`—`],[`GPU Submits`,e?`${e.submitsPerStep}/step`:`—`]]}else if(Z===1)i=[[`GPU Particles`,`${(q.galaxyEngine?.count||0).toLocaleString()}`],[`Morphology`,q.galaxyPreset],[`DM Halo`,`NFW / Hernquist`],[`GPU Steps`,`${q.galaxyEngine?.stepIndex||0}`]];else if(Z===2)if(q.solarMode===`formation`&&q.protoplanetaryTelemetry){let e=q.protoplanetaryTelemetry;i=[[`Snow Line`,`${e.snowLineAu.toFixed(2)} AU`],[`Rocky / Icy`,`${e.rockyPebbles} / ${e.icyPebbles}`],[`Accreted`,`${e.accretedPebbles} peb`],[`Rigid Bodies`,`${e.rigidBodyCount} (DLM)`]]}else if(q.solarMode===`quasar-jet`&&q.kerrJetTelemetry){let e=q.kerrJetTelemetry;i=[[`Kerr Spin a*`,e.spinA.toFixed(2)],[`Lorentz Γ_max`,`${e.maxLorentzGamma.toFixed(2)}×`],[`r_ISCO / r_g`,`${e.rIscoRg.toFixed(2)}`],[`BZ Jet Parcels`,`${e.activeJetParcels}`]]}else if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(q.solarMode)&&q.relBinaryTelemetry){let e=q.relBinaryTelemetry;i=[[`Separation`,e.merged?`MERGED`:e.separation.toFixed(2)],[`GW Strain h_+`,e.gwStrainPlus.toFixed(3)],[`Remnant`,e.remnantType.slice(0,14)],[`r-Proc Parcels`,`${e.rProcessEjectaCount}`]]}else if([`comet-tails`,`hot-jupiter`].includes(q.solarMode)&&q.radWindL2Telemetry){let e=q.radWindL2Telemetry;i=[[`Regime`,e.regime],[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Mean Outflow`,`${e.meanOutflowSpeed.toFixed(2)}`],[`Live Parcels`,`${e.activeParcels}`]]}else if([`roche-rings`,`giant-impact`,`red-giant`,`tde`].includes(q.solarMode)&&q.tidalRocheTelemetry){let e=q.tidalRocheTelemetry;i=[[`Ruptured`,`${(e.rupturedFraction*100).toFixed(0)}%`],[`Max Strain`,e.maxTidalStrain.toFixed(2)],[`Mean Radius`,e.meanRadiusSim.toFixed(2)],[`Live Debris`,`${e.activeParticles}`]]}else{let e=q.solarConservation,t=q.getActiveSystemCatalog(),n=t[q.focusedSolarBodyIndex]||t[0],r=q.useSolReference?`Sol (1★)`:`${q.activeCausalSystem?.starCount||1}★ ${q.activeCausalSystem?.architecture||`single`}`;i=[[`Focus`,(n?.name||`World`).slice(0,18)],[`Architecture`,r],[`True Radius`,n?`${n.radiusKm.toLocaleString()} km`:`—`],[`Sim Time`,`${(q.solarEngine?.simTimeYr||0).toFixed(3)} yr`]],e&&q.galaxyBranch===`smbh-core`&&(i[0]=[`SMBH Mass`,`4.3×10⁶ M☉`],i[1]=[`Lensing`,Cr?`Active WGSL`:`OFF`])}else if(Z===3)if(q.stellarMode===`nebular-mhd`&&q.nebulaMhdTelemetry){let e=q.nebulaMhdTelemetry;i=[[`Mag Energy`,`${e.magneticEnergy.toFixed(1)}`],[`Toroidal B_φ`,`${e.peakToroidalB.toFixed(3)}`],[`Max |B|`,`${e.maxBField.toFixed(3)}`],[`|∇·B| GLM`,`${e.meanAbsDivB.toExponential(1)}`]]}else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`].includes(q.stellarMode)&&q.radWindL3Telemetry){let e=q.radWindL3Telemetry;i=[[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Outflow Speed`,e.meanOutflowSpeed.toFixed(2)],[`Line Flux`,e.meanLineEmission.toFixed(2)],[`Live Parcels`,`${e.activeParcels}`]]}else if((q.stellarMode===`pulsar`||q.stellarMode===`magnetar`)&&q.magnetosphereTelemetry){let e=q.magnetosphereTelemetry;i=[[`Surface B`,`${e.surfaceBFieldTesla.toExponential(1)} T`],[`Spin-Down Ė`,`${e.spinDownLumW.toExponential(1)} W`],[`Starquakes`,`${e.flareCount} flares`],[`Crust Strain`,`${(e.crustStrain*100).toFixed(0)}%`]]}else if(q.stellarMode===`white-dwarf-tov`&&q.tovCurve?.length){let e=q.tovCurve.find(e=>e.branch===`white-dwarf`)||q.tovCurve[2],t=q.tovCurve.find(e=>e.branch===`neutron-star`)||q.tovCurve[11];i=[[`WD Sample`,`${e.massSolar.toFixed(2)} M☉`],[`WD Radius`,`${Math.round(e.radiusKm).toLocaleString()} km`],[`NS Sample`,`${t.massSolar.toFixed(2)} M☉`],[`NS Radius`,`${t.radiusKm.toFixed(1)} km`]]}else if(q.stellarMode===`black-hole`){let e=q.kerrJetTelemetry;i=[[`Kerr Spin a*`,e?e.spinA.toFixed(2):`0.94`],[`r_ISCO / r_g`,e?e.rIscoRg.toFixed(2):`2.02`],[`Lorentz Γ`,e?`${e.maxLorentzGamma.toFixed(2)}×`:`6.4×`],[`Stage`,`Kerr Black Hole`]]}else{let e=q.stellarTelemetry,t=typeof e?.stage==`string`?e.stage:e?.stage?.label||e?.stage?.id||e?.stellarLabel||e?.stellarClass||q.stellarPreset||`convective-fusion`;i=[[`Core Temp`,e?`${(e.coreTempK/1e6).toFixed(2)} MK`:`—`],[`Stage`,String(t).slice(0,22)],[`GPU Steps`,`${q.stellarEngine?.stepIndex||0}`],[`LE n=3 ξ₁`,`${(q.stellarLaneEmden?.solutions?.[1]?.xi1||6.9).toFixed(3)}`]]}else if(Z===4)if(q.surfaceActive&&q.surfaceSession){let e=q.surfaceTelemetry||q.surfaceSession.getTelemetry(),t=q.surfaceSession.env;i=[[`Surface g`,`${t.gravityMS2.toFixed(2)} m/s²`],[`Air ρ_atm`,t.rhoAtmKgM3>1e-4?`${t.rhoAtmKgM3.toFixed(3)} kg/m³`:`0 (Vacuum)`],[`Rover Alt/Fuel`,`${e.roverAltitudeM.toFixed(1)}m / ${Math.round(e.roverRocketFuel*100)}%`],[`Drone Max Lift`,t.droneFlightCapable?`${t.maxAeroLiftN.toFixed(1)} N (OK)`:`0.0 N (Vac)`]]}else{let e=q.planetaryResult,t=q.planetaryAtmoTelemetry,n=q.getActiveSystemCatalog();i=[[`World`,((n[q.planetaryBodyIndex]||n[0])?.name||`World`).slice(0,18)],[`MoI I/MR²`,e?e.moiFactor.toFixed(4):`—`],[`Lightning`,t?`${t.activeLightningCells} cells`:`Dormant (Vac)`],[`Peak |E|`,t?`${(t.peakElectricFieldVPerM/1e3).toFixed(0)} kV/m`:`0 kV/m`]]}else if(Z===5){let e=q.mdTelemetry;i=[[`Temp`,e?`${Math.round(e.temperatureK)} K`:`${q.mdTempK} K`],[`Pressure`,e?`${e.pressureGPa.toFixed(2)} GPa`:`—`],[`Coord ⟨Z⟩`,e?e.meanCoordination.toFixed(2):`—`],[`Gravity`,q.mdGravity?`ON (GPU)`:`Zero-G`]]}else if(Z===6){let e=q.getCachedElementBundle(q.quantumZ,q.quantumRelativistic)?.bundle,t=Array.isArray(e?.electromagnetic?.opticalSrgb)?e.electromagnetic.opticalSrgb:[.8,.85,.9],n=Number(e?.atomic?.totalEnergyHa);i=[[`Samples`,`${(q.orbitalCloud?.pointCount||0).toLocaleString()} pts`],[`Dirac E_tot`,Number.isFinite(n)?`${n.toFixed(1)} Ha`:`—`],[`Magnetic`,e?.electromagnetic?.magneticPhase||`—`],[`Gate 1 sRGB`,`[${t.map(e=>Number(e||0).toFixed(2)).join(`,`)}]`]]}else if(Z===7){let e=q.nuclearResult,t=q.tdseTelemetry,n=Number(e?.bindingPerNucleonMeV),r=Number(e?.chargeRadiusFm);i=[[`B / A`,Number.isFinite(n)?`${n.toFixed(3)} MeV`:`—`],[`Radius R_c`,Number.isFinite(r)?`${r.toFixed(2)} fm`:`—`],[`TDSE Steps`,`${t?.stepCount||0}`],[`P_tunneled`,t?`${(t.pTunneled*100).toFixed(2)}%`:`—`]]}if((Z===2||Z===4)&&!q.surfaceActive){let e=q.getActiveSystemCatalog(),t=Z===4?q.planetaryBodyIndex:q.focusedSolarBodyIndex;if(wn=Gr(Z===2&&Q?.kind===`solar-asteroid`?nr(Q):e[t]||e[0],e[0]||null,{planetaryMode:q.planetaryMode,cToO:q.activeCausalSystem?.starSystem?.nebulaEnv?.cToO??.55,seed:q.seed}),nt&&wn){let e=wn;nt.className=`uv-remote-box active level-${e.biosignatureLevel}`;let t=e.atmosphericGases.map(e=>`<span class="uv-remote-pill ${e.isBio?`bio`:``}" title="${e.name}">${e.formula} ${e.amount}</span>`).join(``),n=e.mineralHints.map(e=>`<span class="uv-remote-pill mineral" title="${e.name} (${e.tag})">${e.formula}</span>`).join(``),r=Cn&&Number.isFinite(Cn.irradianceWm2)?Cn.irradianceWm2>=10?`${Math.round(Cn.irradianceWm2).toLocaleString()} W/m²`:`${Cn.irradianceWm2.toFixed(2)} W/m²`:`Interstellar`;nt.innerHTML=`
          <div class="uv-remote-badge">${e.biosignatureBadge}</div>
          <div class="uv-remote-summary">${e.biosignatureSummary}</div>
          ${t?`<div class="uv-remote-tags"><span class="uv-chip-lbl">Atm:</span>${t}</div>`:``}
          ${n?`<div class="uv-remote-tags"><span class="uv-chip-lbl">Minerals:</span>${n}</div>`:``}
          <div class="uv-remote-flux-row">
            <span>☀️ Starlight: ${r} (${(Cn?.fluxGain??1).toFixed(2)}×)</span>
            <span>Solvent: ${e.solventFormula||e.solventLabel}</span>
          </div>`}}else wn=null,nt&&(nt.className=`uv-remote-box`);yt&&(yt.innerHTML=i.map(([e,t])=>`<div class="uv-stat-cell"><div class="uv-stat-k">${e}</div><div class="uv-stat-v">${t}</div></div>`).join(``));let a=q.syncSchroederScaleChart?.(Z,s),o=q.getActiveUniversalLaws?.(Z,s);if(Dt&&a&&o){let t=a.activeGlobalLevel>=0?`+${a.activeGlobalLevel}`:`${a.activeGlobalLevel}`;Dt.textContent=`${e.engineSchema} · SS L${t} (${a.chartCount}c/${a.spanOrdersOfMagnitude.toFixed(0)} OOM) · ${o.active.length}/${q.lawGraphValidation?.nodeCount||32} laws`}ua(),sa(n),ca()}function fa(e){if(!u)return;u.clearRect(0,0,Rr,Vr);let t=De?.getBoundingClientRect?.(),n=t&&t.left>160?Math.max(160,t.left-6):Rr;u.save(),u.beginPath(),u.rect(0,0,n,Vr),u.clip();let r=q.getTargetsForLevel(Z,Hr),i=!!(Q&&Q.level===Z&&Q.worldPos);for(let t of r){if(Z===2&&t.spec?.parent>0&&s>10.5||Z===4&&!q.planetaryCutaway)continue;let n=pi(t.pos,e,Rr,Vr);if(!n.visible)continue;let r=!i&&t.id===hr,a=t.id===gr;if(!r&&!a&&(Z>=3||Z===1))continue;let o=r?18:a?15:8;u.strokeStyle=r?`rgba(56, 189, 248, 0.90)`:a?`rgba(186, 230, 253, 0.78)`:`rgba(148, 163, 184, 0.42)`,u.lineWidth=r?1.6:1;let c=Math.max(4,o*.45);for(let[e,t]of[[-1,-1],[1,-1],[1,1],[-1,1]])u.beginPath(),u.moveTo(n.sx+e*o,n.sy+t*(o-c)),u.lineTo(n.sx+e*o,n.sy+t*o),u.lineTo(n.sx+e*(o-c),n.sy+t*o),u.stroke();(r||a||Z===2&&t.spec?.parent===0&&s>9.5)&&(u.font=r?`600 11px monospace`:`500 9.5px monospace`,u.fillStyle=r?`#e0f2fe`:`rgba(203, 213, 225, 0.78)`,u.fillText(t.name,n.sx+o+6,n.sy+3.5))}if(Q&&Q.level===Z&&Q.worldPos&&Q.kind!==`landing-site`){let t=pi(Q.worldPos,e,Rr,Vr);t.visible&&(u.save(),u.strokeStyle=`rgba(250, 204, 21, 0.96)`,u.lineWidth=1.9,u.beginPath(),u.moveTo(t.sx,t.sy-14),u.lineTo(t.sx+14,t.sy),u.lineTo(t.sx,t.sy+14),u.lineTo(t.sx-14,t.sy),u.closePath(),u.stroke(),u.beginPath(),u.arc(t.sx,t.sy,3,0,Math.PI*2),u.fillStyle=`#fde047`,u.fill(),u.font=`600 11px monospace`,u.fillStyle=`#fef08a`,u.fillText(Q.name,t.sx+14+7,t.sy+3.5),u.restore())}if(Z===4&&!q.surfaceActive&&zn&&Ln&&zn.bodyIndex===Ln.bodyIndex){let{center:t,radius:n}=Ln,r=zn.nHit,i=Rn?.pos||[0,0,18],a=li([i[0]-t[0],i[1]-t[1],i[2]-t[2]]),o=r[0]*a[0]+r[1]*a[1]+r[2]*a[2],s=[t[0]+r[0]*n*1.005,t[1]+r[1]*n*1.005,t[2]+r[2]*n*1.005];if(Q?.kind===`landing-site`&&(Q.worldPos=[...s]),o>.04){let t=pi(s,e,Rr,Vr);if(t.visible){u.save(),u.strokeStyle=`rgba(52, 211, 153, 0.96)`,u.lineWidth=2,u.beginPath(),u.arc(t.sx,t.sy,11,0,Math.PI*2),u.stroke(),u.beginPath(),u.moveTo(t.sx-16,t.sy),u.lineTo(t.sx-6,t.sy),u.moveTo(t.sx+6,t.sy),u.lineTo(t.sx+16,t.sy),u.moveTo(t.sx,t.sy-16),u.lineTo(t.sx,t.sy-6),u.moveTo(t.sx,t.sy+6),u.lineTo(t.sx,t.sy+16),u.stroke(),u.font=`600 11px monospace`,u.fillStyle=`#6ee7b7`;let e=`${Math.abs(zn.latDeg).toFixed(1)}°${zn.latDeg>=0?`N`:`S`}`,n=`${Math.abs(zn.lonDeg).toFixed(1)}°${zn.lonDeg>=0?`E`:`W`}`;u.fillText(`🎯 ${e}, ${n} · ${zn.biomeLabel}`,t.sx+16,t.sy+4),u.restore()}}}if(Yn.isConnected){let t=q.getActiveSystemCatalog()[q.focusedSolarBodyIndex]?.id||`earth`,n=Yn.getRemotePeersForContext({level:Z,bodyId:t,surfaceActive:q.surfaceActive});for(let t of n){let n=Array.isArray(t.renderPos)?t.renderPos:t.pos;if(!Array.isArray(n)||n.length<3)continue;let r=pi(n,e,Rr,Vr);!r.visible||r.sx<-40||r.sx>Rr+40||r.sy<-40||r.sy>Vr+40||(u.save(),u.strokeStyle=`rgba(244, 114, 182, 0.92)`,u.lineWidth=1.6,u.beginPath(),u.arc(r.sx,r.sy,14,0,Math.PI*2),u.stroke(),u.font=`700 10.5px monospace`,u.fillStyle=`#fbcfe8`,u.fillText(`🛸 ${String(t.peerId||`peer`).slice(0,10)}`,r.sx+14+6,r.sy+3.5),u.restore())}}u.restore()}function pa(e,t){let n=s,r=10**n,i=[],a=[],o=[],c=[],l=[.62,.55,.55],u=null,d=null,f=null,p={bhUv:[.5,.5],bhStrength:0,warpAmount:Math.min(.65,Pr*.08),flashAmount:Ar,crtEnabled:Er,pixelSize:Or,timeSec:t},m=q.cosmoTargets[0]?.posMpc||[0,0,0],h=q.activeStarSite?.posGal||q.galaxyFocusPos||[4.8,.04,2.1];if(Z===1&&q.cosmoSession&&n>15.8&&n<22.8){let e=1-gi(21.6,22.8,n)*.72;i.push({buffer:q.cosmoSession.particlesBuffer,count:q.cosmoSession.particleCount,mode:0,isBackdrop:!0,worldScale:-185,pointSize:1.35,alphaGain:.44*e,extra1:[m[0],m[1],m[2],q.cosmoSession.boxSizeMpc||200]})}if((Z===2||Z===3||Z===4)&&q.galaxyEngine&&n<16.8&&n>-5.2){let e=(1-gi(15.4,16.8,n)*.78)*gi(-5.2,4,n);e>.02&&i.push({buffer:q.galaxyEngine.getResidentBuffer(),count:q.galaxyEngine.count,mode:1,isBackdrop:!0,worldScale:-185,pointSize:1.02,alphaGain:.34*e,extra1:[h[0],h[1],h[2],0]})}if(Z===6&&q.mdSession&&n<-8.8&&n>-13){let e=q.mdSession.boxLengthsA,t=(q.getCachedElementBundle(q.mdElementZ,!0)?.bundle)?.electromagnetic?.opticalSrgb||[.55,.78,.96];i.push({buffer:q.mdSession.positionsBuffer,count:q.mdSession.atomCount,mode:12,isBackdrop:!0,worldScale:-175,pointSize:2.35,alphaGain:.065*_i(n,-13,-11.6,-9.5,-8.8),extra1:[e[0]*.5,e[1]*.5,e[2]*.5,0],extra2:[t[0],t[1],t[2],0]})}Z===7&&q.orbitalCloud&&n<-12.4&&i.push({buffer:q.orbitalCloud.pointsBuffer,count:q.orbitalCloud.pointCount,mode:3,isBackdrop:!0,worldScale:-175,pointSize:.92,alphaGain:.024*_i(n,-15.5,-14.6,-13.1,-12.4),colorPos:[.18,.86,1],colorNeg:[.95,.58,.32]});let g=_i(n,20.8,22,27.05,27.4),_=gi(24.4,21.8,n),v=[m[0]*_,m[1]*_,m[2]*_],y=q.cosmoSession?.boxSizeMpc||28500,b=16/(y*.92)*10**Math.min(3.4,26.75-n);if(Hr.cosmoScale=b,Hr.cosmoOffset=v,g>.01){if(q.cosmoMode!==`web`&&q.cosmoBaryonSession&&n>=22){let t=_i(n,22,22.7,27.05,27.4),r=12.2/Math.max(100,q.cosmoBaryonSession.boxSizeMpc||260)*10**Math.max(-.6,Math.min(2.2,26.5-n));if(i.push({buffer:q.cosmoBaryonSession.getResidentTracersBuffer(),count:q.cosmoBaryonSession.tracerCount,mode:10,worldScale:r,pointSize:q.cosmoMode===`cmb`?.16:q.cosmoMode===`cluster-merger`?.12:.145,alphaGain:(q.cosmoMode===`cmb`?.15:q.cosmoMode===`cluster-merger`?.18:.28)*t,extra1:[0,0,0,q.cosmoBaryonSession.boxSizeMpc||260]}),q.cosmoMode===`cluster-merger`&&Cr&&t>.25){let n=pi([0,0,0],e.viewProj,Rr,Vr);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=9e-4*t)}}else if(q.cosmoSession&&q.cosmoMode===`web`&&(i.push({buffer:q.cosmoSession.particlesBuffer,count:q.cosmoSession.particleCount,mode:0,worldScale:b,pointSize:Math.max(.052,Math.min(.18,.072*10**Math.max(-.4,Math.min(.8,26.6-n)))),alphaGain:.46*g,extra1:[v[0],v[1],v[2],y],extra2:[q.cosmoScaleFactorA||1,+!!q.cosmoBigBangMode,0,0]}),n>=25&&!q.cosmoBigBangMode)){let e=y*.5*b;if(e>2&&e<42){let t=.28*gi(25,26.2,n)*g,r=[];for(let n of[0,1,2])for(let i=0;i<72;i+=1){let a=i/72*Math.PI*2,o=(i+1)/72*Math.PI*2,s=n===0?[Math.cos(a)*e,0,Math.sin(a)*e]:n===1?[Math.cos(a)*e,Math.sin(a)*e,0]:[0,Math.cos(a)*e,Math.sin(a)*e],c=n===0?[Math.cos(o)*e,0,Math.sin(o)*e]:n===1?[Math.cos(o)*e,Math.sin(o)*e,0]:[0,Math.cos(o)*e,Math.sin(o)*e];r.push(s[0],s[1],s[2],.96,.54,.22,t,c[0],c[1],c[2],.96,.54,.22,t)}c.push(new Float32Array(r))}}}let x=_i(n,15.4,16.6,22,22.8),S=10**Math.max(-1.8,Math.min(2.5,21-n))*.85,C=q.galaxyFocusPos||[4.8,.04,2.1],w=gi(20.6,18.8,n),T=[C[0]*w,C[1]*w,C[2]*w];if(Hr.galaxyScale=S,Hr.galaxyOffset=T,x>.01&&q.galaxyEngine){if(i.push({buffer:q.galaxyEngine.getResidentBuffer(),count:q.galaxyEngine.count,mode:1,worldScale:S,pointSize:Math.max(.028,Math.min(.14,.056*10**Math.max(-1.2,Math.min(.6,21-n)))),alphaGain:.34*x,extra1:[T[0],T[1],T[2],0]}),wr&&q.showGalacticBField&&q.galacticDynamoStreamlines?.length>=14&&n>18.8){let e=x*gi(18.8,20.2,n),t=q.galacticDynamoStreamlines;for(let n=0;n<t.length;n+=7)c.push((t[n]-T[0])*S,(t[n+1]-T[1])*S,(t[n+2]-T[2])*S,t[n+3],t[n+4],t[n+5],t[n+6]*e)}if(X.state.colonyLinks?.length>0&&n>17.5){let e=x*gi(17.5,19.2,n);for(let t of X.state.colonyLinks){let n=t.fromPosGal||t.fromPos,r=t.toPosGal||t.toPos;if(!n||!r)continue;let i=Math.max(.05,Math.min(1,t.progress||1)),a=null;for(let t=0;t<=12;t+=1){let o=t/12*i,s=Math.sin(o*Math.PI)*.65,l=(n[0]+(r[0]-n[0])*o-T[0])*S,u=(n[1]+(r[1]-n[1])*o+s-T[1])*S,d=(n[2]+(r[2]-n[2])*o-T[2])*S;a&&(c.push(a[0],a[1],a[2],.28,.96,.72,.78*e),c.push(l,u,d,.56,.92,1,.88*e)),a=[l,u,d]}}}}if(Z>=2&&q.galaxyBranch===`smbh-core`){let t=_i(n,9.2,10.6,15,15.85);if(t>.01){let r=10**Math.max(-1.4,Math.min(1.4,12.6-n)),i=.72*r;if(a.push({pos:[0,0,0],radius:i,color0:[0,0,0],color1:[0,0,0],kind:5}),o.push({center:[0,0,0],rIn:i*1.18,normal:[.08,.96,.24],rOut:i*4.4,color:[1,.85,.55],kind:0}),q.smbhBodies){let e=Math.floor(q.smbhBodies.length/8);for(let t=1;t<e;t+=1){let e=t*8;a.push({pos:[q.smbhBodies[e]*r,q.smbhBodies[e+1]*r,q.smbhBodies[e+2]*r],radius:Math.max(.05,.14*r),color0:[.68,.88,1],color1:[.35,.62,1],kind:0})}}if(Cr){let n=pi([0,0,0],e.viewProj,Rr,Vr);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=.0024*Math.min(2.2,r)*t)}}}else if(q.solarMode===`formation`&&Z===2&&q.protoplanetarySession){let e=_i(n,9.6,10.6,15.6,16.8);if(e>.01){let t=.92*10**Math.max(-1.2,Math.min(1.2,12.6-n));if(i.push({buffer:q.protoplanetarySession.getResidentPebblesBuffer(),count:q.protoplanetarySession.pebbleCount,mode:6,worldScale:t,pointSize:Math.max(.036,Math.min(.13,.06*t)),alphaGain:.52*e,extra1:[0,0,0,0]}),a.push(...q.protoplanetarySession.getEmbryoRenderSpheres(t)),wr){let n=q.protoplanetarySession.snowLineAu*t,r=null;for(let t=0;t<=72;t+=1){let i=t/72*Math.PI*2,a=[Math.cos(i)*n,0,Math.sin(i)*n];r&&(c.push(...r,.36,.84,1,.45*e),c.push(...a,.36,.84,1,.45*e)),r=a}}}}else if(q.solarMode===`quasar-jet`&&Z===2&&q.kerrJetSession){let t=_i(n,9.6,10.6,15,15.85);if(t>.01){let r=.85*10**Math.max(-1,Math.min(1.2,12.6-n)),o=q.kerrJetSession.horizonVisualRadius*r;if(a.push({pos:[0,0,0],radius:o*1.05,color0:[0,0,0],color1:[0,0,0],kind:5}),i.push({buffer:q.kerrJetSession.getResidentParcelsBuffer(),count:q.kerrJetSession.particleCount,mode:7,worldScale:r,pointSize:Math.max(.05,Math.min(.16,.095*r)),alphaGain:.26*t,extra1:[0,0,0,0]}),Cr){let n=pi([0,0,0],e.viewProj,Rr,Vr);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=.0014*t)}}}else if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(q.solarMode)&&Z===2&&q.relBinarySession){let t=_i(n,9.6,10.6,15,15.85);if(t>.01){let r=1.12*10**Math.max(-1,Math.min(1.2,12.6-n));if(a.push(...q.relBinarySession.getRenderSpheres(r)),i.push({buffer:q.relBinarySession.getResidentParcelsBuffer(),count:q.relBinarySession.particleCount,mode:7,worldScale:r,pointSize:Math.max(.05,Math.min(.16,.092*r)),alphaGain:.24*t,extra1:[0,0,0,0]}),Cr&&(q.solarMode===`bbh-merger`||q.solarMode===`xray-binary`)){let n=pi([0,0,0],e.viewProj,Rr,Vr);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=(q.solarMode===`bbh-merger`?.0014:7e-4)*t)}}}else if([`comet-tails`,`hot-jupiter`].includes(q.solarMode)&&Z===2&&q.radWindL2Session){let e=_i(n,9.6,10.6,15.6,16.8);if(e>.01){let t=1.05*10**Math.max(-1,Math.min(1.2,12.6-n)),r=q.solarMode===`comet-tails`;l=r?[.76,.24,.6]:[.82,.14,.55],a.push(r?{pos:[0,0,0],radius:.34*t,color0:[.82,.88,.94],color1:[.42,.48,.56],kind:3,atm:.28}:{pos:[0,0,0],radius:1.02*t,color0:[1,.48,.16],color1:[.68,.2,.08],kind:2,atm:.72}),i.push({buffer:q.radWindL2Session.getResidentParcelsBuffer(),count:q.radWindL2Session.particleCount,mode:8,worldScale:t,pointSize:Math.max(.05,Math.min(.15,.095*t)),alphaGain:.25*e,extra1:[0,0,0,0]})}}else if([`roche-rings`,`giant-impact`,`red-giant`,`catastrophic-shatter`,`tde`].includes(q.solarMode)&&Z===2&&q.tidalRocheSession){let e=_i(n,9.6,10.6,15.6,16.8);if(e>.01){let t=1.06*10**Math.max(-1,Math.min(1.2,12.6-n));a.push(...q.tidalRocheSession.getRenderSpheres(t)),q.solarMode===`tde`&&o.push({center:[0,0,0],rIn:1.05*t,normal:[.06,.99,.08],rOut:3.45*t,color:[1,.72,.34],kind:0}),i.push({buffer:q.tidalRocheSession.getResidentParticlesBuffer(),count:q.tidalRocheSession.particleCount,mode:9,worldScale:t,pointSize:Math.max(.045,Math.min(.14,.078*t)),alphaGain:.28*e,extra1:[0,0,0,0]})}}else if(Z>=2){let e=_i(n,5.4,6.4,15,15.95),s=r/Je,d=16/Math.max(1e-9,s);if(Hr.solarScaleAuToWorld=d,e>.01&&q.solarEngine){let r=q.solarEngine.catalog||q.getActiveSystemCatalog(),s=Math.max(0,Math.min(r.length-1,q.focusedSolarBodyIndex)),f=r[s],p=!!f?.isStar||s===0,m=q.getSolarReferenceOriginAu(n,s),h=m.originAu;Hr.solarSpanLog10M=n,Hr.solarReferenceFrame=m.frameMode;let g=q.solarEngine.getMassiveBodyState64(s),_=q.solarEngine.getMassiveBodyState64(0),v=[Math.fround(h[0]),Math.fround(h[1]),Math.fround(h[2])],y=[Math.fround(h[0]-v[0]),Math.fround(h[1]-v[1]),Math.fround(h[2]-v[2])],b=r[0]||Qe[0],x=At({starSpec:b,bodySpec:f,distanceAu:1,timeSec:t,isRogue:!1,stellarModeHint:q.stellarMode});if(!p){let e=_.posAu[0]-g.posAu[0],r=_.posAu[1]-g.posAu[1],i=_.posAu[2]-g.posAu[2],a=Math.max(.012,Math.hypot(e,r,i));l=Z===4&&q.planetaryMode===`eyeball-locked`?[1,0,0]:Z===4&&q.planetaryMode===`rogue`?[.15,.96,.22]:li([e,r,i]),x=At({starSpec:b,bodySpec:f,distanceAu:n<9.2?a:Math.max(.45,Math.min(2.8,a)),timeSec:t,isRogue:Z===4&&q.planetaryMode===`rogue`,stellarModeHint:q.stellarMode})}Cn=x;let S=q.getTargetsForLevel(4)[0],C=S?.rCoreNorm??.54,w=S?.rMantleNorm??.94,T=Math.min(q.solarEngine.massiveCount,r.length);for(let f=0;f<T;f+=1){let p=r[f],m=q.solarEngine.getMassiveBodyState64(f),g=(m.posAu[0]-h[0])*d,_=(m.posAu[1]-h[1])*d,v=(m.posAu[2]-h[2])*d,y=Math.hypot(g,_,v),b=m.radiusAu*d,x=!!p.isStar||f===0;if(y>155&&f!==s){if(!x&&p.parent>0)continue;let e=165/y;g*=e,_*=e,v*=e;let t=b*e;b=x?Math.max(1.45,Math.min(4.6,t*2.8)):Math.max(.28,Math.min(.95,t*5.5))}if(f===s&&x&&n<=9.9)continue;let S=f===s&&!x&&n<8.85;S&&(Ln={center:[g,_,v],radius:b,spec:p,bodyIndex:f,seedFloat:f*2.17+1.3,lightDir:[...l]});let T=S&&q.planetaryCutaway,E=S&&!T&&(q.planetaryMode===`magma-ocean`||p.kind===7),D=S&&!T&&q.planetaryMode===`cryo-plumes`,O=S&&!T&&q.planetaryMode===`rogue`,k=a.length,A=x?Math.min(.95,Math.max(0,X.state.dysonTau||0)):0;if(x?Mt({spec:p,pos:[g,_,v],radius:b,timeSec:t,dysonCoverage:A,seed:f*2.17+1.3,spheres:a,disks:o,lineChunks:c,alphaMul:e,stellarModeHint:f===0?q.stellarMode:null}):a.push({pos:[g,_,v],radius:b,color0:E?[1,.44,.1]:D?[.86,.92,.98]:O?[.16,.24,.36]:p.color0,color1:E?[.22,.08,.05]:D?[.48,.68,.86]:O?[.06,.1,.18]:p.color1,kind:T?4:E?7:D?3:p.kind,atm:E?.55:D?.18:p.atm??.35,rCore:C,rMantle:w,cutaway:T,tempK:Number(p.tempK)||288,civTechK:Number(p.civTechK)||0,dysonCoverage:0,seed:f*2.17+1.3}),S&&!E&&!D&&q.planetaryAtmoSession&&(u={buffer:q.planetaryAtmoSession.getResidentEmVisBuffer(),width:q.planetaryAtmoSession.width,height:q.planetaryAtmoSession.height,sphereIndex:k},wr&&!T&&q.planetaryAtmoState?.surfacePressurePa>=20&&c.push(...Br({center:[g,_,v],radius:b,atmoState:q.planetaryAtmoState,timeSec:t,seed:f*2.17+1.3,alphaMul:e*.85}))),D&&q.cryoPlumeSession){let t=b/2.35;i.push({buffer:q.cryoPlumeSession.getResidentParticlesBuffer(),count:q.cryoPlumeSession.particleCount,mode:9,worldScale:t,pointSize:Math.max(.05,.085*t),alphaGain:.34*e,extra1:[0,0,0,0]})}p.ringed&&b>.008&&o.push({center:[g,_,v],rIn:p.ringInnerKm/p.radiusKm*b,normal:Array.isArray(p.ringNormal)?p.ringNormal:[.16,.89,.42],rOut:p.ringOuterKm/p.radiusKm*b,color:Array.isArray(p.ringColor)?p.ringColor:[.88,.78,.62],kind:1})}let E=_i(n,8.8,9.6,15,16.5);if(E>.01&&i.push({buffer:q.solarEngine.getResidentBuffer(),count:q.solarEngine.totalCount,mode:4,worldScale:d,pointSize:.085,alphaGain:.62*E,extra1:[v[0],v[1],v[2],q.solarEngine.massiveCount],extra2:[y[0],y[1],y[2],0]}),wr&&n>8.1&&!(Z===3&&q.stellarMode!==`fusion`)){let e=_i(n,8.1,8.8,15.2,16.4);c.push(...yi(q.solarEngine,h,d,n,e))}}}let E=pr()&&q.galaxyBranch!==`smbh-core`?_i(n,7,7.8,9.7,10.4):0;if(E>.01){let e=.92*10**Math.max(-1,Math.min(1,9.2-n));if(q.stellarMode===`nebular-mhd`&&q.nebulaMhdSession){if(i.push({buffer:q.nebulaMhdSession.getResidentTracersBuffer(),count:q.nebulaMhdSession.tracerCount,mode:5,worldScale:e*1.15,pointSize:Math.max(.06,Math.min(.24,.14*e)),alphaGain:.56*E,extra1:[0,0,0,0]}),q.nebulaMhdStreamlines?.length>=14){let t=q.nebulaMhdStreamlines,n=e*1.15;for(let e=0;e<t.length;e+=7)c.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*E)}}else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`,`reflection-nebula`,`wr-bubble`].includes(q.stellarMode)&&q.radWindL3Session)i.push({buffer:q.radWindL3Session.getResidentParcelsBuffer(),count:q.radWindL3Session.particleCount,mode:8,worldScale:e*1.05,pointSize:Math.max(.06,Math.min(.2,.115*e)),alphaGain:(q.stellarMode===`reflection-nebula`?.14:.18)*E,extra1:[0,0,0,0]}),q.stellarMode===`planetary-nebula`?a.push({pos:[0,0,0],radius:.24*e,color0:[.76,.94,1],color1:[.42,.78,1],kind:0}):q.stellarMode===`snr-pwn`?a.push({pos:[0,0,0],radius:.22*e,color0:[.62,.88,1],color1:[.85,.48,1],kind:0}):q.stellarMode===`reflection-nebula`?(a.push({pos:[0,.2*e,0],radius:.34*e,color0:[.72,.88,1],color1:[.38,.64,1],kind:0}),a.push({pos:[-2.1*e,.6*e,-1.1*e],radius:.24*e,color0:[.76,.9,1],color1:[.42,.68,1],kind:0}),a.push({pos:[2.2*e,-.5*e,1.2*e],radius:.22*e,color0:[.78,.92,1],color1:[.46,.7,1],kind:0})):q.stellarMode===`wr-bubble`?a.push({pos:[0,0,0],radius:.36*e,color0:[1,.96,.84],color1:[.62,.86,1],kind:0}):a.push({pos:[3.6*e,3.2*e,2.4*e],radius:.3*e,color0:[.72,.9,1],color1:[.45,.72,1],kind:0});else if((q.stellarMode===`pulsar`||q.stellarMode===`magnetar`)&&q.magnetosphereSession){let t=q.stellarMode===`magnetar`;if(a.push({pos:[0,0,0],radius:.44*e,color0:t?[1,.78,.96]:[.72,.94,1],color1:t?[.86,.32,.94]:[.34,.68,1],kind:0}),i.push({buffer:q.magnetosphereSession.getResidentParcelsBuffer(),count:q.magnetosphereSession.particleCount,mode:7,worldScale:e*1.12,pointSize:Math.max(.05,Math.min(.15,.088*e)),alphaGain:.25*E,extra1:[0,0,0,0]}),q.magnetosphereFieldLines?.length>=14){let t=q.magnetosphereFieldLines,n=e*1.12;for(let e=0;e<t.length;e+=7)c.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*E)}}else if(q.stellarMode===`black-hole`)a.push({pos:[0,0,0],radius:1.35*e,color0:[0,0,0],color1:[1,.72,.28],kind:5}),o.push({center:[0,0,0],rIn:2.05*e,normal:[.14,.96,.24],rOut:6.4*e,color:[1,.72,.34],kind:0}),q.kerrJetSession&&i.push({buffer:q.kerrJetSession.getResidentParcelsBuffer(),count:q.kerrJetSession.particleCount,mode:7,worldScale:e*1.15,pointSize:Math.max(.05,Math.min(.16,.095*e)),alphaGain:.26*E,extra1:[0,0,0,0]});else if(q.stellarMode===`white-dwarf-tov`){a.push({pos:[0,0,0],radius:2.15*e,color0:[.86,.95,1],color1:[.46,.74,1],kind:0});for(let t=0;t<3;t+=1){let n=(2.75+t*.95)*e,r=null;for(let e=0;e<=48;e+=1){let i=e/48*Math.PI*2,a=t*.52,o=[Math.cos(i)*n,Math.sin(i)*n*Math.sin(a),Math.sin(i)*n*Math.cos(a)];r&&(c.push(...r,.42,.84,1,(.34-t*.08)*E),c.push(...o,.42,.84,1,(.34-t*.08)*E)),r=o}}}else if(q.stellarEngine){let t=Math.log10(Math.max(900,Number(q.stellarEngine.surfaceTempK)||5778));if(i.push({buffer:q.stellarEngine.getResidentBuffer(),count:q.stellarEngine.count,mode:2,worldScale:e*.95,pointSize:Math.max(.045,Math.min(.2,.125*e)),alphaGain:.3*E,extra1:[0,0,0,t]}),wr&&q.stellarDynamoStreamlines?.length>=14){let t=q.stellarDynamoStreamlines,n=e*.95;for(let e=0;e<t.length;e+=7)c.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*E)}}}let D=_i(n,-9.6,-8.9,-6.2,-5.2);if(D>.01&&q.mdSession){let e=q.mdSession.boxLengthsA,t=8.4/Math.max(e[0],e[1],e[2],6)*10**Math.max(-1.2,Math.min(1.4,-8.2-n)),r=(q.getCachedElementBundle(q.mdElementZ,!0)?.bundle)?.electromagnetic?.opticalSrgb||[.76,.8,.86];d={positionsBuffer:q.mdSession.positionsBuffer,velocitiesBuffer:q.mdSession.velocitiesBuffer,count:q.mdSession.atomCount,halfBox:[e[0]*.5,e[1]*.5,e[2]*.5],worldScale:t,radius:Math.max(.045,Math.min(1.3,(q.mdSession.rNearestNeighborA||2.5)*.285*t)),baseRgb:r,alphaFade:D,idealCoord:q.mdSession.idealCoordination||12},wr&&D>.3&&c.push(...vi([e[0]*.5*t,e[1]*.5*t,e[2]*.5*t],[.32,.8,1,.28*D]))}let O=_i(n,-13.2,-12,-9.4,-8.8);if(O>.01&&q.orbitalCloud){let e=(q.getCachedElementBundle(q.quantumZ,q.quantumRelativistic)?.bundle)?.electromagnetic?.opticalSrgb||[.22,.86,1],t=10**Math.max(-1.1,Math.min(1.8,-10-n));if(i.push({buffer:q.orbitalCloud.pointsBuffer,count:q.orbitalCloud.pointCount,mode:3,worldScale:5.4*t,pointSize:Math.max(.025,Math.min(.14,.044*Math.sqrt(t))),alphaGain:.074*O,colorPos:q.quantumMode===`atom`?[.18,.86,1]:[.26,.92,.86],colorNeg:q.quantumMode===`atom`?[Math.max(.68,e[0]),Math.max(.48,e[1]),Math.min(.45,e[2])]:[1,.42,.62]}),q.quantumMode===`molecule`){let e=q.MOLECULE_SPECS[q.quantumMoleculeKey],n=3.8/4.2*t;for(let r of e.atoms)a.push({pos:[r.position[0]*n,r.position[1]*n,r.position[2]*n],radius:(r.Z===1?.22:.36)*t,color0:r.Z===8?[.95,.28,.28]:r.Z===6?[.45,.52,.6]:[.92,.96,1],color1:[.6,.8,1],kind:5})}else n>-12.6&&a.push({pos:[0,0,0],radius:Math.max(.05,.1*t),color0:[1,.72,.32],color1:[1,.94,.72],kind:0})}let k=_i(n,-15.5,-14.8,-13.3,-12.4);if(k>.01&&q.nuclearResult){let e=10**Math.max(-1.2,Math.min(.9,-14.3-n)),r=q.buildQuantizedNucleonSpheres(q.nuclearResult,2.2*e,t);yr=r,a.push(...r);let i=q.tdseTelemetry,o=20,s=-1;if(i?.prob?.length)for(let e=0;e<i.prob.length;e+=1)i.prob[e]>s&&(s=i.prob[e],o=e);f={dim:q.nuclearResult.volDim||28,boxRadius:3.8*e,tdseTunneled:i?.pTunneled||0,tdseCrestNorm:Math.max(.45,Math.min(.94,o/Math.max(1,(i?.prob?.length||128)-1))),alphaMul:k}}if(Q&&Q.worldPos&&Q.level===Z&&Q.kind!==`landing-site`){let t=Q.worldPos,n=Math.max(.4,Math.hypot(e.pos[0]-t[0],e.pos[1]-t[1],e.pos[2]-t[2])),r=Math.max(.14,Math.min(2.2,n*.032)),i=[t[0]+r,t[1],t[2]],a=[t[0]-r,t[1],t[2]],o=[t[0],t[1]+r,t[2]],s=[t[0],t[1]-r,t[2]],l=[t[0],t[1],t[2]+r],u=[t[0],t[1],t[2]-r],d=(e,t,n=1,r=.84,i=.3,a=.96)=>{c.push(e[0],e[1],e[2],n,r,i,a,t[0],t[1],t[2],n,r,i,a)};d(o,i),d(o,a),d(o,l),d(o,u),d(s,i),d(s,a),d(s,l),d(s,u),d(i,l),d(l,a),d(a,u),d(u,i);let f=r*1.65;d([t[0]+r*1.15,t[1],t[2]],[t[0]+f,t[1],t[2]],.45,.92,1,.88),d([t[0]-r*1.15,t[1],t[2]],[t[0]-f,t[1],t[2]],.45,.92,1,.88),d([t[0],t[1]+r*1.15,t[2]],[t[0],t[1]+f,t[2]],.45,.92,1,.88),d([t[0],t[1]-r*1.15,t[2]],[t[0],t[1]-f,t[2]],.45,.92,1,.88)}return{camera:e,particleClouds:i,spheres:a.length?a:null,atmoEm:u,lightDir:l,starLight:Cn?.vec4||[1,.97,.92,1],mdCloud:d,disks:o.length?o:null,lines:c.length>=14?new Float32Array(c):null,nuclearVol:f,post:p}}let ma=performance.now(),ha=0,ga=0,_a=0,va=0,ya=60,ba=[0,2.2,8.5],xa=0,Sa=null;function Ca(e,t){if(Z>=5)return null;let n=[],r=[],i=J.mode===`ufo`,a=i?J.getState(s,!1).basis:null,o=i?Math.atan2(a.fwd[0],a.fwd[2]):Math.atan2(e.fwd[0],e.fwd[2]),c=i?[...J.pos]:On?[e.pos[0]+e.fwd[0]*.15-e.up[0]*.28,e.pos[1]+e.fwd[1]*.15-e.up[1]*.28,e.pos[2]+e.fwd[2]*.15-e.up[2]*.28]:[e.pos[0]+e.fwd[0]*5.9-e.up[0]*1.72,e.pos[1]+e.fwd[1]*5.9-e.up[1]*1.72,e.pos[2]+e.fwd[2]*5.9-e.up[2]*1.72],l=ve(An),u=Q?.worldPos||vr||[0,0,0],d=Mn?{targetPos:u,rgb:kn===`antimatter`?[.85,.34,1]:l.rgb,isAntimatter:kn===`antimatter`,thicknessMul:1.15}:null;ba=[c[0],c[1],c[2]],xa=o,Sa=d,de(n,r,{pos:c,yaw:o,pitch:Math.max(-.22,Math.min(.22,-e.fwd[1]*.45)),roll:Math.sin(t*.9)*.04,basisRight:i?a.right:null,basisUp:i?a.up:null,basisFwd:i?a.fwd:null,radius:.52,rimAngle:t*2.2,vertThrust:Nr===null?i?Math.min(1,J.getState(s,!1).speedWorld*.12):0:.65,tractorActive:!!(Nn||Nr!==null&&Z===4),tractorHeight:3.4,beam:d,isCockpit:On,isRemote:!1,shieldFlash:X.state.shieldFlash});let f=$n(),p=Yn.getRemotePeersForContext({level:Z,systemKey:Z>=2?f:null,surfaceActive:!1});for(let i=0;i<p.length;i+=1){let a=p[i],s=Array.isArray(a.pos)&&a.pos.length===3?a.pos:null,l=s?Math.hypot(s[0],s[1],s[2]):0,u=s?Math.hypot(s[0]-c[0],s[1]-c[1],s[2]-c[2]):0,d=s&&l>.35&&u>.75?s:[c[0]+e.right[0]*(2.6+i*1.8),c[1]+e.up[1]*(.45+i%2*.35),c[2]+e.right[2]*(2.6+i*1.8)];a.renderPos=d,de(n,r,{pos:d,yaw:a.yaw??o,pitch:a.pitch||0,roll:a.roll||0,radius:.62,rimAngle:t*2.5+i,tractorActive:!!a.tractorActive,tractorHeight:2.8,beam:a.beam||null,isRemote:!0,shieldFlash:a.shieldFlash||0})}if(Z>=2&&Z<=4){for(let e=0;e<X.state.probes.length;e+=1){let t=X.state.probes[e];if((t.systemKey||`sol`)!==f)continue;let i=t.angle||0,a=2.6+(t.orbitRadius||1.8)*.75,o=Math.cos(i)*a,s=Math.sin(i)*a;ee(n,r,[o,Math.sin(i*1.7+e)*a*Math.sin(t.inclination||.25),s],i*2,.32)}for(let e of Xn)e.alive&&B(n,r,{pos:e.pos,vel:e.vel,scale:.22})}return{opaque:new Float32Array(n),fx:new Float32Array(r)}}function $(e=performance.now(),t=null){Kr();let n=t?.viewport?t.viewport.width/Math.max(1,t.viewport.height):Jn.isStereoPreview?c.width*.5/Math.max(1,c.height):c.width/Math.max(1,c.height);if(q.surfaceActive&&q.surfaceSession){let r=q.surfaceSession,i=r.getCameraPose(),a=58*Math.PI/180,o=ui(a,n,.25,2400),s=di(i.eye,i.target,i.up),c=fi(o,s.mat);Lr=c;let l={viewProj:c,pos:i.eye,right:s.right,up:s.up,fwd:s.fwd,aspect:n,fovTanHalf:Math.tan(a*.5),timeSec:e*.001,level:4,log10SpanM:2},d=q.getActiveSystemCatalog(),f=zr({solarEngine:q.solarEngine,catalog:d,focusIdx:q.planetaryBodyIndex,cameraPos:i.eye,craftPosM:i.focusPos,navRadiusM:r.env.tinyPlanetCurvatureRadiusM,env:r.env,surfaceSimSec:q.surfaceSimSec,observerLatDeg:32,landingSite:q.surfaceLandingSite,altitudeKm:q.surfaceTelemetry?.ufoAltitudeKm,dysonCoverage:Math.min(.95,Math.max(0,X.state.dysonTau||0))});q.setSurfaceClimate(f.climate);let p=f.lightDir;Fn=f.spheres.length,In=f.gasGiantSkyTransmittance??1;let m=r.getActiveSkyEnv?r.getActiveSkyEnv():r.env,h=[],g=gi(-.1,.22,p[1])*(f.climate.eclipseFactor??1);if(q.galaxyEngine&&In>.14&&(m.skyOpticalDepth??1)*g<.36){let e=q.activeStarSite?.posGal||q.galaxyFocusPos||[4.8,.04,2.1],t=Math.max(.1,1-(m.skyOpticalDepth??0)*g*2.5)*In;h.push({buffer:q.galaxyEngine.getResidentBuffer(),count:q.galaxyEngine.count,mode:1,isBackdrop:!0,worldScale:-24e4,pointSize:1350,alphaGain:.38*t,extra1:[e[0],e[1],e[2],0]})}h.push({buffer:r.getResidentPlumesBuffer(),count:r.particleCount,mode:11,worldScale:1,pointSize:.85,alphaGain:.92,extra1:[i.focusPos[0],0,i.focusPos[2],r.env.hasSolidCrust?1/(2*r.env.tinyPlanetCurvatureRadiusM):0]});let _=r.getResidentMpmPointsBuffer?.();_&&r.mpmPointCount>0&&h.push({buffer:_,count:r.mpmPointCount,mode:11,worldScale:1,pointSize:1.45,alphaGain:1,extra1:[i.focusPos[0],0,i.focusPos[2],r.env.hasSolidCrust?1/(2*r.env.tinyPlanetCurvatureRadiusM):0]});let v=r.getResidentCfdMotesBuffer?.();v&&r.cfdMoteCount>0&&h.push({buffer:v,count:r.cfdMoteCount,mode:11,worldScale:1,pointSize:r.env.hasSolidCrust?.95:1.05,alphaGain:1,extra1:[i.focusPos[0],0,i.focusPos[2],0]});let y=q.surfaceTelemetry?.antimatterFlash||0,b=r.getResidentFloraInstancesBuffer?.(),x=r.getResidentFloraTemplateVertBuffer?.(),S=At({starSpec:d[0]||Qe[0],bodySpec:q.surfaceBodySpec||d[q.planetaryBodyIndex],distanceAu:f.primaryStarDistAu||d[q.planetaryBodyIndex]?.aAu||1,timeSec:e*.001,isRogue:!!r.env?.isRogue,stellarModeHint:q.stellarMode});if(Cn=S,xn.renderFrame({camera:l,lightDir:p,starLight:S.vec4,spheres:f.spheres.length?f.spheres:null,disks:f.disks.length?f.disks:null,lines:f.lines||null,emSensor:Y,surfaceScene:{terrainVertBuf:r.getResidentTerrainVertBuffer(),terrainIdxBuf:r.getResidentTerrainIndexBuffer(),indexCount:r.indexCount,hideTerrain:!1,flora:b&&x&&r.floraInstanceCount>0?{instanceBuf:b,templateVertBuf:x,instanceCount:r.floraInstanceCount,templateVertCount:r.floraTemplateVertCount}:null,boulderVertBuf:r.getResidentBoulderVertBuffer?.(),boulderVertCount:r.boulderVertCount||0,vehicleVertBuf:r.getResidentVehicleVertBuffer(),vehicleVertCount:r.vehicleVertCount,fxVertBuf:r.getResidentFxVertBuffer?.(),fxVertCount:r.fxVertCount||0,env:m,focusPos:i.focusPos,lightDir:p,ambientTempK:f.climate.surfaceTempK,eclipseFactor:f.climate.eclipseFactor},particleClouds:h,stereoSbs:!t&&Jn.isStereoPreview,xrEyeTarget:t,post:{bhUv:[.5,.5],bhStrength:0,warpAmount:0,flashAmount:Math.max(Ar,y*.55),crtEnabled:Er,pixelSize:Or,timeSec:e*.001}}),u&&(u.clearRect(0,0,Rr,Vr),r.activeVehicle===`ufo`&&r.cameraMode===`first-person`)){let e=Rr*.5,t=Vr*.5;u.save(),u.strokeStyle=`rgba(52, 211, 153, 0.72)`,u.lineWidth=1.6,u.beginPath(),u.arc(e,t,18,0,Math.PI*2),u.moveTo(e-28,t),u.lineTo(e-10,t),u.moveTo(e+10,t),u.lineTo(e+28,t),u.moveTo(e,t-28),u.lineTo(e,t-10),u.moveTo(e,t+10),u.lineTo(e,t+28),u.stroke(),u.restore()}return}vr=_r&&Q&&Q.level===Z&&Q.worldPos?[vr[0]+(Q.worldPos[0]-vr[0])*.25,vr[1]+(Q.worldPos[1]-vr[1])*.25,vr[2]+(Q.worldPos[2]-vr[2])*.25]:[vr[0]*.82,vr[1]*.82,vr[2]*.82];let r,i;if(J.mode===`ufo`){let e=J.getSpaceCameraPose({cockpit:On});r=e.eye,i=di(e.eye,e.target,e.up)}else{let e=Math.cos(Fr.pitch),t=Math.sin(Fr.pitch),n=Math.cos(Fr.yaw),a=Math.sin(Fr.yaw);r=[vr[0]+Fr.dist*e*a,vr[1]+Fr.dist*t,vr[2]+Fr.dist*e*n],i=di(r,vr,[0,1,0])}let a=48*Math.PI/180,o=ui(a,n,.05,520),l=fi(o,i.mat);Lr=l;let d={viewProj:l,pos:r,right:i.right,up:i.up,fwd:i.fwd,aspect:n,fovTanHalf:Math.tan(a*.5),timeSec:e*.001,level:Z,log10SpanM:s};Rn={pos:r,right:i.right,up:i.up,fwd:i.fwd,fovTanHalf:Math.tan(a*.5),aspect:n};let f=pa(d,e*.001);if(f.cosmicMeshes=Ca(d,e*.001),f.emSensor=Y,!t&&Jn.isStereoPreview){let e=Math.max(1,Math.floor(c.width*.5)),t=Math.max(.08,Fr.dist*.022),n=(e,n,a,s)=>{let l=[r[0]+i.right[0]*(e*t),r[1]+i.right[1]*(e*t),r[2]+i.right[2]*(e*t)],u=di(l,vr,[0,1,0]),p={...d,pos:l,right:u.right,up:u.up,fwd:u.fwd,viewProj:fi(o,u.mat)};xn.renderFrame({...f,camera:p,stereoSbs:!1,xrEyeTarget:{viewport:{x:n,y:0,width:a,height:c.height},preserve:s}})};n(-1,0,e,!1),n(1,e,c.width-e,!0)}else f.stereoSbs=!1,f.xrEyeTarget=t,xn.renderFrame(f);fa(l)}function wa(e){if(jr)return;Mr=requestAnimationFrame(wa);let t=Math.min(.1,Math.max(.001,(e-ma)/1e3));ma=e,_a+=t,va+=1,_a>=.45&&(ya=Math.round(va/_a),_a=0,va=0);let{gp:n,actions:r}=J.pollGamepads(En);if(r.toggleModePressed&&Qr(),r.toggleCockpitPressed&&Ni(),r.tractorPressed&&(Nn=!Nn,q.setSurfaceTractorBeam(Nn),lr()),r.launchMissilePressed)if(q.surfaceActive){let e=q.launchSurfaceMissile({});e&&Yn.isConnected&&Yn.broadcastMissileLaunch(e)}else ar();if(r.levelHorizonPressed&&J.levelHorizon(),n.connected){if(n.fire!==Mn&&n.fire?zi(!0):n.fire,q.surfaceActive)q.setSurfaceControls({moveX:n.strafe,moveY:n.thrust,jump:n.ascend>.25,down:n.ascend<-.25,turbo:n.warpBoost>.35}),(Math.abs(n.yawRate)>.02||Math.abs(n.pitchRate)>.02)&&q.addSurfaceLookDelta(n.yawRate*2.2*t,-n.pitchRate*1.6*t),Math.abs(n.chaseZoomDir)>.1&&q.adjustSurfaceChaseDistance(2.2**(n.chaseZoomDir*t));else if(J.mode===`orbit`&&((Math.abs(n.yawRate)>.02||Math.abs(n.pitchRate)>.02)&&(Fr.yaw+=n.yawRate*2*t,Fr.pitch=Math.max(-1.42,Math.min(1.42,Fr.pitch-n.pitchRate*1.5*t))),Math.abs(n.scaleZoomDir)>.1||Math.abs(n.thrust)>.1)){let e=(n.scaleZoomDir*1.8-n.thrust*1.4)*t;s=Math.max(st,Math.min(ot,s+e)),ri(s)}}if(!q.surfaceActive&&J.mode===`ufo`){let e=J.stepSpace(t,{log10SpanM:s,gamepadInput:n});Math.abs(e.deltaLog10Scale)>1e-4&&(Nr=null,s=Math.max(st,Math.min(ot,s+e.deltaLog10Scale)),ri(s))}if(Tr&&!Gi&&J.mode!==`ufo`&&(Fr.yaw+=t*.22),q.surfaceActive&&(Math.abs(Vi.nx)>.02||Math.abs(Vi.ny)>.02)&&q.addSurfaceLookDelta(-Vi.nx*2.1*t,-Vi.ny*1.4*t),Ar>0&&(Ar=Math.max(0,Ar-t*1.45)),Pr=Math.max(0,Pr-t*12),Nr!==null){let e=Nr-s,n=Math.sign(e)*Math.min(Math.abs(e),Math.max(1.2,Math.abs(e)*3.4)*t);s+=n,Pr=Math.abs(n)/Math.max(.001,t),Math.abs(Nr-s)<.015&&(s=Nr,Nr=null),ri(s)}kr&&Nr===null&&(s-=t*1.15,s<=-14.75&&(s=ot-.3),ri(s));let i=bi(s,{focusedSolarBodyIndex:q.focusedSolarBodyIndex,focusedBodyIsStar:pr(),galaxyBranch:q.galaxyBranch});if(i!==Z){let e=Z;Z=i,Q=null,_r=!1,vr=[0,0,0],Fr.dist=18,e>=2&&Z<=1&&tr(),Z===4&&e!==4&&!Gi&&ii(q.focusedSolarBodyIndex),Z===3&&e!==3&&!Tn&&q.syncStellarRegimeForStar(null,{initializeNow:!0}),wi(),Ti(),ri(s)}if(xr){let e=Yn.timescaleLocked?1:Sr;if(Pn+=t*e,q.stepActiveRegimes(Z,s,e),X.step(t),q.surfaceActive){let e=q.drainSurfaceEvents();X.addHarvest(e.harvested);for(let t of e.peerHits)Yn.sendWeaponHit(t.targetPeerId,t);if(Array.isArray(e.abductions)&&e.abductions.length>0){for(let t of e.abductions)Bn.push(t);$r(),Pi()}let t=q.getActiveSystemCatalog(),n=q.surfaceBodySpec?.id||t[q.planetaryBodyIndex]?.id||`earth`,r=$n(),i=Yn.getRemotePeersForContext({level:4,systemKey:r,bodyId:n,surfaceActive:!0});q.setSurfaceExternalEntities({remoteUfos:i,probes:X.state.probes.filter(e=>(e.systemKey||`sol`)===r),shieldFlash:X.state.shieldFlash}),q.surfaceTelemetry?.shatterTriggered&&!Qn&&ir(q.surfaceBodySpec||t[q.planetaryBodyIndex],1.85)}else if(Z===2||Z===4){for(let e=Xn.length-1;e>=0;--e){let n=Xn[e];if(!n.alive){Xn.splice(e,1);continue}if(n.age+=t,n.pos[0]+=n.vel[0]*t,n.pos[1]+=n.vel[1]*t,n.pos[2]+=n.vel[2]*t,Math.hypot(n.target[0]-n.pos[0],n.target[1]-n.pos[1],n.target[2]-n.pos[2])<1.2||n.age>2.2){n.alive=!1;let e=n.targetSpec,t=e?.isMetallicAsteroid?4.5:e?.isComet?3.2:1.5;X.addHarvest({silicates:28*t,metals:22*t,volatiles:(e?.isComet?42:14)*t,exotics:2});let r=ye(e),i=(Zn.get(n.targetId)||0)+Math.max(4e12,jn*.25);Zn.set(n.targetId,i),Ar=Math.max(Ar,.14),i>=.85*r&&!Qn&&ir(e,i/Math.max(1,r))}}if(Mn&&(kn===`laser`||kn===`antimatter`)){let e=rr(),n=e.spec,r=n?.isMetallicAsteroid?4:n?.isComet?3:1,i=kn===`antimatter`?L({massRateKgS:se(Math.max(1e10,jn)),dt:t}).coupledEnergyJ:Math.max(0,jn*.45*t);X.addHarvest({silicates:16*r*t,metals:14*r*t,volatiles:(n?.isComet?28:8)*r*t,exotics:(kn===`antimatter`?4:.6)*t});let a=ye(n),o=(Zn.get(e.id)||0)+i;Zn.set(e.id,o),o>=.85*a&&!Qn&&ir(n,o/Math.max(1,a))}if(Nn){let e=rr().spec,n=e?.isMetallicAsteroid?3.5:e?.isComet?2.8:1;X.addHarvest({silicates:18*n*t,metals:15*n*t,volatiles:(e?.isComet?24:10)*n*t,exotics:.4*t})}}if(Yn.isConnected){let e=q.getActiveSystemCatalog()[q.focusedSolarBodyIndex]?.id||`earth`,t=q.surfaceTelemetry;Yn.broadcastLocalState({level:Z,systemKey:$n(),log10SpanM:s,useSol:q.useSolReference,seed:q.seed,bodyId:e,surfaceActive:q.surfaceActive,pos:q.surfaceActive?t?.ufoPos||t?.roverPos||[0,30,0]:[...ba],yaw:q.surfaceActive?t?.ufoYaw??t?.roverYaw??0:xa,pitch:q.surfaceActive&&t?.ufoPitch||0,roll:q.surfaceActive&&t?.ufoRoll||0,vertThrust:q.surfaceActive&&t?.ufoVertThrust||0,tractorActive:q.surfaceActive?!!t?.tractorActive:Nn,beam:q.surfaceActive?t?.activeBeam||null:Sa,shieldFlash:X.state.shieldFlash})}}br+=t,br>=.1&&Q&&Q.level===Z&&(br=0,ta()),(!(Z===6&&!Gi&&!Tr&&Nr===null&&!kr&&Ar<=0)||e-ha>=120)&&(ha=e,$(e)),ga+=t,ga>=.18&&(ga=0,v&&(v.textContent=`${ya} FPS · WebGPU`),q.surfaceActive&&Pi(),Xr(),lr(),da(),Wi())}if(fn?.classList.remove(`active`),r.epoch&&(await q.setCosmicEpoch(r.epoch),Wr()),r.useSol!==null&&await q.setUseSolReference(r.useSol),await ri(s),r.bodyId){q.setFocusedSolarBody(r.bodyId);let e=q.getActiveSystemCatalog();(r.bodyId===`sun`||String(r.bodyId).startsWith(`star-`))&&!(e[q.focusedSolarBodyIndex]?.isStar||q.focusedSolarBodyIndex===0)&&q.setFocusedSolarBody(0);let t=e[q.focusedSolarBodyIndex];(t?.isStar||q.focusedSolarBodyIndex===0)&&await q.syncStellarRegimeForStar(t,{initializeNow:!0}),Z=bi(s,{focusedSolarBodyIndex:q.focusedSolarBodyIndex,focusedBodyIsStar:pr(),galaxyBranch:q.galaxyBranch}),await ri(s)}if(r.roomId&&(Yn.connect({room:r.roomId,relay:r.relayUrl||``}),cr()),r.surfaceActive){let e=r.pos?{activeVehicle:`ufo`,ufoPos:r.pos,ufoYaw:r.yaw??.35,cameraMode:r.cockpit?`first-person`:`chase`}:null;await Fi({bodyIndex:r.bodyId||q.planetaryBodyIndex,restoreCheckpoint:e})}wi(),Ti(),Xr(),lr(),cr();let Ta=n.get(`peerRelay`);if(Ta){be&&(be.value=Ta);let e=n.get(`peerRole`)||`requester`;Se&&(Se.value=e),await q.connectPeerMesh({relayUrl:Ta,roomId:n.get(`peerRoom`)||`ulg-universes-mesh-v1`,role:e}),Wi()}da();let Ea=()=>{Yn.disconnect(),q.disconnectPeerMesh()};return window.addEventListener(`pagehide`,Ea),window.addEventListener(`beforeunload`,Ea),Mr=requestAnimationFrame(wa),Object.freeze({getState(){let e=ct[Z],n=q.cosmoSession?.getState?.()||null,r=Qe[0],i=Qe[3],a=Qe[6],o=q.solarConservation0,c=q.solarConservation;return{ready:!0,continuousZoom:!0,level:Z,scaleId:e.id,scaleName:e.name,log10ViewSpanM:s,physicalSpanLabel:dt(s),solarReferenceFrame:Hr.solarReferenceFrame||q.getSolarReferenceOriginAu(s).frameMode,selectedLandingSite:zn,surfaceLandingSite:q.surfaceLandingSite,gasGiantSkyTransmittance:In,abductedSpecimens:[...Bn],collectedMaterialSamples:[...Vn],cargoOpen:!!j?.classList.contains(`open`),totalSpanOom:Number((ot-st).toFixed(1)),gpuBackend:`webgpu`,cameraAutoSpin:Tr,running:xr,autopilot:kr,retroCrt:Er,lensingEnabled:Cr,qualityId:q.quality.id,seed:q.seed,gpuErrorCount:t.length,gpuErrors:[...t],scientificValidation:!1,cosmicEpochId:q.cosmicEpochId,cosmicEpochRedshiftZ:q.cosmicEpoch?.redshiftZ??0,cosmoMode:q.cosmoMode,cosmoBaryonSteps:q.cosmoBaryonSession?.stepIndex??0,cosmoBaryonIonFrac:q.cosmoBaryonTelemetry?.meanIonizedFraction??null,cosmoBaryonXray:q.cosmoBaryonTelemetry?.meanXrayEmissivity??null,cosmoBaryonKappa:q.cosmoBaryonTelemetry?.maxLensingKappa??null,cosmicWebSteps:n?.stepIndex??0,scaleFactorA:n?.aScale??null,redshiftZ:n?.redshiftZ??null,submitsPerStep:q.cosmoTelemetry?.submitsPerStep??n?.submitsPerStep??null,sigmaDensity:q.cosmoTelemetry?.sigmaDensity??null,powerSpectrumPk:q.cosmoTelemetry?.powerSpectrumPk??null,galacticSteps:q.galaxyEngine?.stepIndex??0,galaxyPreset:q.galaxyPreset,galacticBodyCount:q.galaxyEngine?.count??0,galacticGravityMode:q.galaxyEngine?.gravityMode??null,galacticDynamoMagEnergy:q.galacticDynamoTelemetry?.magneticEnergy??null,galacticDynamoStreamlineFloats:q.galacticDynamoStreamlines?.length??0,galacticB0:q.galacticB0,galaxyBranch:q.galaxyBranch,planetarySteps:q.solarEngine?.stepIndex??0,solarSimTimeYr:q.solarEngine?.simTimeYr??0,solarTotalBodies:q.solarEngine?.totalCount??0,focusedSolarBody:q.getActiveSystemCatalog()[q.focusedSolarBodyIndex]?.id??`star-0`,useSolReference:q.useSolReference,causalSystemName:q.useSolReference?`Sol Reference`:q.activeCausalSystem?.systemName??null,causalArchitecture:q.useSolReference?`single`:q.activeCausalSystem?.architecture??`single`,causalStarCount:q.useSolReference?1:q.activeCausalSystem?.starCount??1,causalPlanetCount:q.useSolReference?8:q.activeCausalSystem?.planetCount??0,causalHasEarthLike:q.useSolReference?!0:!!q.activeCausalSystem?.hasEarthLike,causalFeH:q.useSolReference?0:q.activeCausalSystem?.starSystem?.nebulaEnv?.feH??0,causalCToO:q.useSolReference?.55:q.activeCausalSystem?.starSystem?.nebulaEnv?.cToO??.55,earthToSunRadiusRatio:i.radiusKm/r.radiusKm,jupiterToSunRadiusRatio:a.radiusKm/r.radiusKm,solarRelEnergyDrift:o&&c?Math.abs(c.totalEnergy-o.totalEnergy)/Math.max(1e-12,Math.abs(o.totalEnergy)):null,solarRelMomentumError:c?.relMomentumError??null,stellarSteps:q.stellarEngine?.stepIndex??0,stellarSolver:q.stellarEngine?.solver??(q.stellarEngine?`self-gravitating-hydro`:null),stellarMode:q.stellarMode,stellarPreset:q.stellarPreset,stellarCoreTempK:q.stellarTelemetry?.coreTempK??null,stellarConvectiveRmsVel:q.stellarTelemetry?.convectiveRmsVel??null,stellarActiveFusionParcels:q.stellarTelemetry?.activeFusionParcels??null,cosmoScaleFactorA:q.cosmoScaleFactorA??1,cosmoBigBangMode:!!q.cosmoBigBangMode,stellarDynamoMagEnergy:q.stellarDynamoTelemetry?.magneticEnergy??null,stellarDynamoStreamlineFloats:q.stellarDynamoStreamlines?.length??0,stellarB0:q.stellarB0,magnetosphereStreamlineFloats:q.magnetosphereFieldLines?.length??0,pickedGpuMote:Q?{kind:Q.kind,index:Q.index,name:Q.name,subtitle:Q.subtitle}:null,moteFocusLocked:_r,nebulaMhdSteps:q.nebulaMhdSession?.stepIndex??0,nebulaMhdMagneticEnergy:q.nebulaMhdTelemetry?.magneticEnergy??null,nebulaMhdPeakToroidalB:q.nebulaMhdTelemetry?.peakToroidalB??null,solarMode:q.solarMode,kerrSpinA:q.kerrSpinA,kerrMaxGamma:q.kerrJetTelemetry?.maxLorentzGamma??null,kerrActiveJets:q.kerrJetTelemetry?.activeJetParcels??0,relBinaryMerged:q.relBinaryTelemetry?.merged??!1,relBinaryRemnant:q.relBinaryTelemetry?.remnantType??null,relBinaryGwStrain:q.relBinaryTelemetry?.gwStrainPlus??null,magnetarFlares:q.magnetosphereTelemetry?.flareCount??0,magnetarBeamFlux:q.magnetosphereTelemetry?.beamFluxProxy??0,tovCount:q.tovCurve?.length??0,tidalRupturedFrac:q.tidalRocheTelemetry?.rupturedFraction??null,protoplanetarySteps:q.protoplanetarySession?.stepIndex??0,protoplanetaryAccreted:q.protoplanetaryTelemetry?.accretedPebbles??null,planetaryMode:q.planetaryMode,planetaryInteriorValid:!!q.planetaryResult?.valid,planetaryMoiFactor:q.planetaryResult?.moiFactor??null,planetaryCutaway:q.planetaryCutaway,planetaryAtmoActive:!!q.planetaryAtmoSession,planetaryAtmoSteps:q.planetaryAtmoSession?.stepIndex??0,planetaryLightningCells:q.planetaryAtmoTelemetry?.activeLightningCells??0,planetaryPeakElectricVPerM:q.planetaryAtmoTelemetry?.peakElectricFieldVPerM??0,surfaceActive:q.surfaceActive,surfaceVehicle:q.surfaceSession?.activeVehicle??null,surfaceCameraMode:q.surfaceSession?.cameraMode??null,surfaceGravityMS2:q.surfaceSession?.env?.gravityMS2??null,surfaceAtmoDensityKgM3:q.surfaceSession?.env?.rhoAtmKgM3??null,surfaceDroneFlightCapable:q.surfaceSession?.env?.droneFlightCapable??null,surfaceDroneMaxAeroLiftN:q.surfaceSession?.env?.maxAeroLiftN??null,surfaceTelemetry:q.surfaceTelemetry??null,surfaceLocalSample:q.surfaceSession?.getLocalSample?.()??null,surfaceClimate:q.surfaceClimate??null,surfaceSkyBodyCount:Fn,surfaceTimeWarp:q.surfaceTimeWarp??1,surfaceSimSec:q.surfaceSimSec??0,surfaceXenobiology:q.surfaceSession?.xenobiology??null,emSensor:{...Y},flightState:J.getState(s,q.surfaceActive),starIllumination:Cn,orbitalRemoteSensing:wn,commandDeckTab:Dn,hasSavedSurfaceCheckpoint:!!mr,savedSurfaceWorld:mr?.worldName??null,activeSampledMaterial:q.activeSampledMaterial??null,cosmicCockpitMode:On,xrState:Jn.getState(),ufoMultiplayer:Yn.getStatus(),timescaleLocked:Yn.timescaleLocked,kardashev:{index:X.state.kardashevIndex,harvestedPowerW:X.state.harvestedPowerW,maxPowerW:X.state.maxPowerW,probeCount:X.state.probes.length,totalProbeCount:X.state.totalProbeCount,dysonTau:X.state.dysonTau,dysonCoveringFrac:X.state.dysonCoveringFrac,colonyLinksCount:X.state.colonyLinks.length,systemCount:X.state.systems.size,reactorTier:X.state.reactorTier,shieldHp:X.state.shieldHp,silicatesKg:X.state.silicatesKg,metalsKg:X.state.metalsKg,volatilesKg:X.state.volatilesKg},schroederAtlas:q.syncSchroederScaleChart?.(Z,s)??null,activeUniversalLaws:q.getActiveUniversalLaws?.(Z,s)??null,lawGraphContracts:q.lawGraphValidation??null,shatteredBodies:q.getShatteredBodyIds(),spaceMissileCount:Xn.length,surfaceCraterTileKey:q.surfaceCraterTileKey??null,surfaceCraterReplayCount:q.surfaceTelemetry?.craterReplayCount??0,boulderSkinGpuActive:!!q.surfaceTelemetry?.boulderSkinGpuActive,weaponState:{mode:kn,log10WavelengthM:An,powerW:jn,firing:Mn,tractorOn:Nn},scaleTimeDilation:q.computeScaleAdaptiveTimeDilation(s,{surfaceActive:q.surfaceActive,userTimeScale:Sr}),parentBackdropActive:!!(Z===1&&q.cosmoSession||(Z===2||Z===3||Z===4)&&q.galaxyEngine||Z===6&&q.mdSession||Z===7&&q.orbitalCloud),activeUniversalLaws:q.getActiveUniversalLaws(Z,s).active.map(e=>e.id),mdSteps:q.mdTelemetry?.totalSteps??0,mdAtomCount:q.mdSession?.atomCount??0,mdGravity:q.mdGravity,mdElementZ:q.mdElementZ,quantumZ:q.quantumZ,quantumRelativistic:q.quantumRelativistic,orbitalPointCount:q.orbitalCloud?.pointCount??0,nuclearZ:q.nuclearZ,nuclearA:q.nuclearA,nuclearBindingPerNucleonMeV:q.nuclearResult?.bindingPerNucleonMeV??null,tdseSteps:q.tdseTelemetry?.stepCount??0,selectedTarget:Ci()?.id??null,activeSystemKey:$n(),hasActiveBlackHoleSession:!!(q.kerrJetSession||q.relBinarySession||q.smbhBodies),visibleProbesInScene:Z>=2&&Z<=4?X.state.probes.filter(e=>(e.systemKey||`sol`)===$n()).length:0,peerMeshState:q.getPeerMeshState()}},async setLog10Span(e){Nr=null,q.surfaceActive&&Ii();let t=Z;return s=Si(e),Z=bi(s,{focusedSolarBodyIndex:q.focusedSolarBodyIndex,focusedBodyIsStar:pr(),galaxyBranch:q.galaxyBranch}),Z!==t&&(Q=null,_r=!1,vr=[0,0,0],t>=2&&Z<=1&&tr()),await ri(s),wi(),Ti(),da(),$(performance.now()),this.getState()},flyToLog10Span:si,async setLevel(e,{instant:t=!0}={}){let n=Math.max(0,Math.min(7,Math.trunc(Number(e)||0)));q.surfaceActive&&Ii();let r=q.getActiveSystemCatalog();if(n===3?(r[q.focusedSolarBodyIndex]?.isStar||q.setFocusedSolarBody(0),Tn||await q.syncStellarRegimeForStar(r[q.focusedSolarBodyIndex]||r[0],{initializeNow:!0})):n===4&&(r[q.focusedSolarBodyIndex]?.isStar||q.focusedSolarBodyIndex===0)&&q.setFocusedSolarBody(q.getDefaultPlanetIndex(r)),t){let e=await this.setLog10Span(ct[n].log10SpanM);return n===4&&(ii(q.focusedSolarBodyIndex),$(performance.now())),e}return si(ct[n].log10SpanM),this.getState()},async sampleNewGalacticSector(e={}){return q.surfaceActive&&Ii(),Tn=!1,zn=null,Xn.length=0,await q.sampleNewGalacticSector(e),er(),wi(),Ti(),da(),$(performance.now()),this.getState()},async selectCausalStarSite(e={}){return q.surfaceActive&&Ii(),Tn=!1,zn=null,Xn.length=0,await q.selectCausalStarSite(e),er(),wi(),Ti(),da(),$(performance.now()),this.getState()},async setUseSolReference(e){return q.surfaceActive&&Ii(),Tn=!1,zn=null,Xn.length=0,await q.setUseSolReference(e),await q.syncStellarRegimeForStar(null,{initializeNow:Z===3}),er(),wi(),Ti(),da(),$(performance.now()),this.getState()},async focusSolarBody(e){Q=null,_r=!1,vr=[0,0,0];let t=q.useSolReference;q.setFocusedSolarBody(e),q.useSolReference!==t&&(await q.initSolarSystem({solReference:q.useSolReference}),q.setFocusedSolarBody(e));let n=q.getActiveSystemCatalog(),r=Math.max(0,Math.min(n.length-1,q.focusedSolarBodyIndex));return n[r]?.isStar||r===0?(Tn=!1,await q.syncStellarRegimeForStar(n[r],{initializeNow:!0})):await q.initPlanetaryInterior({bodyIndex:r}),Z===4&&!n[r]?.isStar&&r>0&&(s=xi(n[r]),ii(r)),wi(),Ti(),da(),$(performance.now()),this.getState()},async setCosmicEpoch(e,t={}){return await q.setCosmicEpoch(e,t),Wr(),wi(),hi(),da(),$(performance.now()),this.getState()},async setCosmoMode(e){return await q.setCosmoMode(e),wi(),hi(),da(),$(performance.now()),this.getState()},async setGalaxyPreset(e){return await q.initGalaxy({preset:e}),wi(),hi(),da(),$(performance.now()),this.getState()},async setSolarMode(e){return await q.setSolarMode(e),wi(),hi(),da(),$(performance.now()),this.getState()},async setKerrSpinA(e){return await q.setKerrSpinA(e),hi(),da(),$(performance.now()),this.getState()},async setStellarMode(e){return Tn=!0,await q.setStellarMode(e),wi(),hi(),da(),$(performance.now()),this.getState()},async setStellarPreset(e){return Tn=!0,await q.setStellarMode(`fusion`),await q.initStellarCore({preset:e}),Q=null,_r=!1,wi(),hi(),da(),$(performance.now()),this.getState()},setFlightMode(e=`ufo`){return Zr(e),this.getState()},toggleFlightMode(){return Qr(),this.getState()},orientCameraTowardHostStar(e=q.focusedSolarBodyIndex){if(!q.solarEngine||e<=0)return!1;let t=q.solarEngine.getMassiveBodyState64(e),n=q.solarEngine.getMassiveBodyState64(0),r=n.posAu[0]-t.posAu[0],i=n.posAu[2]-t.posAu[2];return Fr.yaw=Math.atan2(r,i)+Math.PI-.34,Fr.pitch=.08,$(performance.now()),!0},getFlightState(){return J.getState(s,q.surfaceActive)},setUfoChaseZoom(e=1){return J.setChaseZoom(e),Xr(),$(performance.now()),J.getState(s,q.surfaceActive)},rotateUfoLocal(e=0,t=0,n=0){return J.rotateLocal(e,t,n),Xr(),$(performance.now()),J.getState(s,q.surfaceActive)},setUfoKeys(e={}){return J.setKeys(e),J.getState(s,q.surfaceActive)},stepUfoSpace(e=.05){let{gp:t}=J.pollGamepads(En),n=J.stepSpace(e,{log10SpanM:s,gamepadInput:t});return Xr(),$(performance.now()),n},applyMockGamepad(e=null){En=e?[e]:null;let t=J.pollGamepads(En);return Xr(),t},setCommandDeckTab(e=`scan`){return Jr(e),$(performance.now()),Dn},getOrbitalRemoteSensing(){return da(),wn},getStarIllumination(){return Cn},async setPlanetaryMode(e){return await q.setPlanetaryMode(e),e===`cryo-plumes`&&Z===4&&(s=Math.max(s,7.56),ii(q.focusedSolarBodyIndex),Fr.pitch=-.18),wi(),hi(),da(),$(performance.now()),this.getState()},setCameraAngles(e,t){return Number.isFinite(Number(e))&&(Fr.yaw=Number(e)),Number.isFinite(Number(t))&&(Fr.pitch=Math.max(-1.42,Math.min(1.42,Number(t)))),$(performance.now()),this.getState()},async setNebulaB0(e){return await q.setNebulaB0(e),hi(),$(performance.now()),this.getState()},async setGalacticB0(e){return await q.setGalacticB0(e),hi(),da(),$(performance.now()),this.getState()},async setStellarB0(e){return await q.setStellarB0(e),hi(),da(),$(performance.now()),this.getState()},async pickAtCanvasFraction(e=.5,t=.5,{preferGpuMote:n=!0}={}){return $(performance.now()),ea(e*Rr,t*Vr,{preferGpuMote:n})},focusPickedMote(e={zoomIn:!0}){return na(e)},getPickedMote(){return Q},async readGalaxyDiagnostics(){if(!q.galaxyEngine)return null;let e=await q.galaxyEngine.readbackBodies(),t=Math.floor(e.length/8),n=0,r=0,i=0,a=0,o=0;for(let s=1;s<t;s+=1){let t=s*8;if(e[t+7]<-.5)continue;let c=Math.hypot(e[t],e[t+2]),l=e[t+1];n+=1,r+=c,i+=l*l,c>a&&(a=c),(c>18||Math.abs(l)>10)&&(o+=1)}return{stepIndex:q.galaxyEngine.stepIndex,visibleStars:n,meanRadius:r/Math.max(1,n),rmsHeightZ:Math.sqrt(i/Math.max(1,n)),maxRadius:a,escapedFrac:o/Math.max(1,n)}},async readStellarDiagnostics(){if(!q.stellarEngine||typeof q.stellarEngine.readbackBodies!=`function`)return null;let e=await q.stellarEngine.readbackBodies(),t=Math.floor(e.length/16),n=0,r=0,i=0,a=0,o=0,s=0,c=0,l=0;for(let u=0;u<t;u+=1){let t=u*16,d=Math.max(1e-6,e[t+3]||1);o+=e[t]*d,s+=e[t+1]*d,c+=e[t+2]*d,l+=d;let f=Math.hypot(e[t],e[t+1],e[t+2]),p=Math.hypot(e[t+4],e[t+5],e[t+6]);n+=f,r+=p*p,p>i&&(i=p),f<6.5&&(a+=1)}let u=1/Math.max(1e-6,l);return{stepIndex:q.stellarEngine.stepIndex,count:t,meanRadius:n/Math.max(1,t),comDist:Math.hypot(o*u,s*u,c*u),rmsSpeed:Math.sqrt(r/Math.max(1,t)),maxSpeed:i,boundFrac:a/Math.max(1,t),coreTempK:q.stellarTelemetry?.coreTempK??null}},setPlanetaryTriboelectric(e){return q.setPlanetaryTriboelectric(e),hi(),this.getState()},getActiveUniversalLaws(){return q.getActiveUniversalLaws(Z,s)},async setGalaxyBranch(e){return q.setGalaxyBranch(e,e===`smbh-core`?[0,0,0]:[4.8,.04,2.1]),await ri(s),Ti(),this.getState()},setPlanetaryCutaway(e){q.setPlanetaryCutaway(e),$(performance.now())},async enterSurfaceView(e={}){return await Fi(e),this.getState()},exitSurfaceView(){return Ii(),this.getState()},async sampleSurfaceAndDiveToLattice(){return{sample:await Ei(),state:this.getState()}},async returnToSavedSurface(){return await Di(),this.getState()},async inspectSampledCompound(e=0){return await Oi(typeof e==`object`?e:q.activeSampledMaterial?.compounds?.[e]),this.getState()},async inspectSampledElement(e,t={}){return await ki(e,t),this.getState()},setSurfaceVehicle(e){return q.setSurfaceVehicle(e),Pi(),$(performance.now()),this.getState()},setSurfaceUfoAltitudeKm(e){return q.setSurfaceUfoAltitudeKm(e),Pi(),$(performance.now()),this.getState()},setSurfaceCameraMode(e){return q.setSurfaceCameraMode(e),Pi(),lr(),$(performance.now()),this.getState()},toggleCockpit(){return Ni(),this.getState()},async toggleXr(){return await Jn.toggleXr((e,t)=>{for(let e of t)$(performance.now(),e)}),$(performance.now()),this.getState()},setTractorBeam(e){return Nn=!!e,q.setSurfaceTractorBeam(Nn),lr(),$(performance.now()),this.getState()},setWeaponConfig(e={}){return e.mode&&(kn=e.mode),Number.isFinite(Number(e.log10WavelengthM))&&(An=Number(e.log10WavelengthM)),Number.isFinite(Number(e.powerW))&&(jn=Number(e.powerW)),q.setSurfaceWeaponConfig({mode:kn,log10WavelengthM:An,powerW:jn,maxPowerW:e.maxPowerW??X.state.maxPowerW}),lr(),this.getState()},setWeaponFire(e={}){return Mn=!!e.firing,q.setSurfaceWeaponFire(e),lr(),this.getState()},launchMissile(e={}){if(q.surfaceActive){let t=q.launchSurfaceMissile(e);return t&&Yn.isConnected&&Yn.broadcastMissileLaunch(t),t}return ar()},async flushSurfaceCraters(){return q.flushSurfaceCraters()},async triggerCatastrophicShatter(e=null,t={}){return await ir(e,t.excessRatio??1.65),this.getState()},async visitPickedAsteroid(){return Q?.kind===`solar-asteroid`?await Fi({customBodySpec:nr(Q)}):await Fi({bodyIndex:q.focusedSolarBodyIndex}),this.getState()},advanceKardashev(e=60,t=1){let n=Math.max(.1,Number(e)||60),r=Math.min(.5,n),i=Math.max(1,n/r);for(let e=0;e<Math.max(1,Math.trunc(t));e+=1)X.step(r,{growthTimeMul:i});return lr(),$(performance.now()),this.getState()},addKardashevHarvest(e={}){return X.addHarvest(e),lr(),this.getState()},buildShareUrl:()=>fr(),joinMultiplayerRoom(e=`ulg-cosmos-public`,t=``,n={}){let r=Yn.connect({room:e,relay:t,...n});return cr(),r},async warpToPeer(e=null){let t=Yn.getAllRemotePeers(),n=e?t.find(t=>t.peerId===e):t[0];if(!n)return null;if(typeof n.useSol==`boolean`&&n.useSol!==q.useSolReference&&await q.setUseSolReference(n.useSol),n.surfaceActive){let e=Array.isArray(n.pos)?n.pos[0]+22:22,t=Array.isArray(n.pos)?Math.max(22,n.pos[1]):30,r=Array.isArray(n.pos)?n.pos[2]+16:16;await Fi({bodyIndex:n.bodyId||`earth`,restoreCheckpoint:{activeVehicle:`ufo`,ufoPos:[e,t,r],ufoYaw:n.yaw||0}})}else q.surfaceActive&&Ii(),n.bodyId&&q.setFocusedSolarBody(n.bodyId),Number.isFinite(n.level)&&await this.setLevel(n.level,{instant:!0});return n},leaveMultiplayerRoom(){let e=Yn.disconnect();return cr(),e},deployVonNeumannProbe(){let e=q.getActiveSystemCatalog();er();let t=X.deployVonNeumannProbe({bodyId:e[q.focusedSolarBodyIndex]?.id||`earth`,systemKey:$n(),starPosGal:q.activeStarSite?.posGal||q.galaxyFocusPos||[4.8,.04,2.1]});return lr(),t},upgradeReactor(){let e=X.upgradeReactor();return lr(),e},setSurfaceControls(e={}){return q.setSurfaceControls(e),Pi(),this.getState()},setEmSensorWindow(e,t,n={}){return Gn(e,t,n),$(performance.now()),this.getState()},setEmSensorPreset(e=`vis`){let t=Hn[e]||Hn.vis;return Gn(t.min,t.max,{active:t.active,preset:e}),$(performance.now()),this.getState()},setSurfaceTimeWarp(e=1){return q.setSurfaceTimeWarp(e),Pi(),$(performance.now()),this.getState()},advanceSurfaceSimSec(e=0){return q.advanceSurfaceSimSec(e),$(performance.now()),Pi(),this.getState()},addSurfaceLookDelta(e,t){return q.addSurfaceLookDelta(e,t),$(performance.now()),this.getState()},async setMdPhase(e){return await q.initMolecularDynamics({Z:q.mdElementZ,phasePreset:e}),hi(),this.getState()},selectTarget(e){return q.getTargetsForLevel(Z,Hr).some(t=>t.id===e)?(hr=e,da(),!0):!1},initiateHyperdrive:Ai,returnToOrbit:ji,setAutopilot(e){kr=!!e,w?.classList.toggle(`active`,kr),w&&(w.textContent=kr?`⏹ Stop Tour`:`▶ Tour`)},setRetroCrt(e,t=Or){Er=!!e,Or=Math.max(1,Math.min(6,Math.trunc(Number(t)||3))),he&&(he.checked=Er),ge&&(ge.value=String(Or)),_e&&(_e.textContent=`${Or}×`)},setCameraAutoSpin(e){Tr=!!e,me&&(me.checked=Tr)},async bigBang(){return Ar=1,await q.setCosmoMode(`web`),await q.initCosmicWeb({bigBang:!0}),this.setLog10Span(ct[0].log10SpanM)},async reseed(e=null){return q.setSeed(e??q.seed+7919>>>0),await q.initCosmicWeb(),this.getState()},connectPeerMesh:e=>q.connectPeerMesh(e),disconnectPeerMesh:()=>q.disconnectPeerMesh(),dispatchPeerDerivation:e=>q.dispatchPeerDerivation(e),async stepOnce(){let e=0;for(;q.busy&&e<100;)e+=1,await new Promise(e=>setTimeout(e,4));if(await q.stepActiveRegimes(Z,s,Sr),Ar>0&&(Ar=Math.max(0,Ar-.14)),q.surfaceActive){let e=q.drainSurfaceEvents();if(X.addHarvest(e.harvested),Array.isArray(e.abductions)&&e.abductions.length>0){for(let t of e.abductions)Bn.push(t);$r(),Pi()}}return da(),this.getState()},capturePng(){return $(performance.now()),c.toDataURL(`image/png`)},dispose(){jr=!0,cancelAnimationFrame(Mr),window.removeEventListener(`resize`,Kr),window.removeEventListener(`keydown`,Hi),window.removeEventListener(`keyup`,Ui),window.removeEventListener(`pagehide`,Ea),window.removeEventListener(`beforeunload`,Ea),Yn.disconnect(),Jn.exitXr(),Sn.dispose(),q.dispose(),xn.dispose()}})}async function wi(){try{let e=await Ci();window.__ulgUniversesDemo=e}catch(e){let t=document.getElementById(`uv-webgpu-fallback`),n=document.getElementById(`uv-fallback-title`),r=document.getElementById(`uv-fallback-msg`);n&&(n.textContent=`WebGPU Initialization Failed`),r&&(r.textContent=e instanceof Error?e.message:String(e)),t?.classList.add(`visible`),console.error(`[ULG Universes] boot failed:`,e)}}wi();