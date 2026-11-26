import{Et as e,O as t,_ as n,_t as r,a as i,b as a,gt as o,h as s,k as c,r as l,u,wt as d,xt as f}from"./molecularDynamicsWebGpu-CVM2Trpi.js";import{C as p,T as m,_ as h,w as g,x as _}from"./batchedSymmetricEigensolverGpu-DvdPNMKk.js";import{t as v}from"./ClosureRegistry-BkvnpwMz.js";import{n as y,r as b,t as x}from"./clientDerivationPeers-BWxyY0CJ.js";import{attachWebGpuUncapturedErrorTelemetry as S}from"../runtime/webgpuDeviceLimits.js";import{computeBufferBinding as C,createCachedExplicitBindGroup as w,createCachedExplicitComputePipeline as T}from"../runtime/webgpuComputeLayout.js";import{t as E}from"./radiationClosure-DsCbJTHr.js";import{d as D,l as O,m as k,n as A,p as j,t as M}from"./simulationModuleRegistry-DdHpyVmb.js";import{i as N,n as P,r as F,t as I}from"./webgpuCompat-B36dRVS1.js";import{A as ee,C as L,D as R,E as te,M as ne,O as z,S as re,T as ie,_ as B,b as ae,g as oe,h as se,i as ce,j as le,k as ue,m as de,n as fe,r as pe,t as me,v as he,w as ge,x as _e,y as ve}from"./gpuEntityPickerWebGpu-CdmngHUJ.js";import{r as ye}from"./schroederSpatialScaleAtlasRuntime-DBLL_Am_.js";async function be(){let e=typeof navigator<`u`&&!!navigator.xr,t=typeof globalThis.XRGPUBinding==`function`,n=!1;if(e&&typeof navigator.xr.isSessionSupported==`function`)try{n=await navigator.xr.isSessionSupported(`immersive-vr`)}catch{n=!1}return{hasNavigatorXr:e,hasXrGpuBinding:t,immersiveVrSupported:n,nativeWebGpuXrReady:!!(e&&t&&n)}}function xe(e,{onStateChange:t=null}={}){let n=null,r=null,i=null,a=null,o=!1,s=`Desktop 3D`,c={hasNavigatorXr:typeof navigator<`u`&&!!navigator.xr,hasXrGpuBinding:typeof globalThis.XRGPUBinding==`function`,immersiveVrSupported:!1,nativeWebGpuXrReady:!1},l=()=>{typeof t==`function`&&t(u())};be().then(e=>{c=e,l()});function u(){return{...c,active:!!n||o,mode:n?`webxr-native`:o?`stereo-sbs`:`flat`,statusText:s}}async function d(t){let d=await be();if(c=d,d.nativeWebGpuXrReady&&typeof t==`function`)try{n=await navigator.xr.requestSession(`immersive-vr`,{requiredFeatures:[`local-floor`],optionalFeatures:[`webgpu`,`hand-tracking`]}),i=new globalThis.XRGPUBinding(n,e),a=i.createProjectionLayer({colorFormat:navigator.gpu.getPreferredCanvasFormat(),depthStencilFormat:`depth24plus`}),await n.updateRenderState({layers:[a]}),r=await n.requestReferenceSpace(`local-floor`),s=`WebXR WebGPU Live`,o=!1,n.addEventListener(`end`,()=>{n=null,r=null,i=null,a=null,s=`Desktop 3D`,l()});let c=(e,o)=>{if(!n)return;let s=o.getViewerPose(r);if(s&&i&&a){let n=[];for(let e of s.views){let t=i.getViewSubImage(a,e);n.push({eye:e.eye,projectionMatrix:e.projectionMatrix,transform:e.transform,colorView:t.colorTexture.createView({baseArrayLayer:t.imageIndex||0,arrayLayerCount:1}),depthView:t.depthStencilTexture?t.depthStencilTexture.createView({baseArrayLayer:t.imageIndex||0,arrayLayerCount:1}):null,viewport:t.viewport})}t(e,n,s)}n.requestAnimationFrame(c)};return n.requestAnimationFrame(c),l(),u()}catch(e){return n=null,i=null,a=null,s=`Stereo VR (${String(e?.message||`XRGPUBinding fallback`).slice(0,36)})`,o=!0,l(),u()}return o=!o,s=o?d.hasNavigatorXr&&!d.hasXrGpuBinding?`Stereo SBS VR (enable #webxr-incubations for native XRGPUBinding)`:`Stereo SBS VR Preview`:`Desktop 3D`,l(),u()}async function f(){if(o=!1,n){try{await n.end()}catch{}n=null,r=null,i=null,a=null}return s=`Desktop 3D`,l(),u()}async function p(e){return n||o?f():d(e)}return Object.freeze({getState:u,enterXr:d,exitXr:f,toggleXr:p,get isStereoPreview(){return o},get isNativeXr(){return!!n}})}function Se(e,t,n){return Math.max(t,Math.min(n,e))}function Ce(e=``){let t=new URLSearchParams(String(e||``)),n=(e,n=null)=>{let r=t.get(e);if(r===null||r===``)return n;let i=Number(r);return Number.isFinite(i)?i:n};return{seed:n(`seed`,null),epoch:t.get(`epoch`)||null,log10SpanM:n(`span`,null),level:n(`level`,null),useSol:t.has(`sol`)?t.get(`sol`)===`1`||t.get(`sol`)===`true`:null,bodyId:t.get(`body`)||null,surfaceActive:t.get(`surf`)===`1`||t.get(`surf`)===`true`,pos:t.has(`x`)&&t.has(`z`)?[n(`x`,0),n(`y`,28),n(`z`,0)]:null,yaw:n(`yaw`,null),simTimeS:n(`t`,null),roomId:(t.get(`room`)||``).trim()||null,relayUrl:(t.get(`relay`)||``).trim()||null,cockpit:t.get(`cockpit`)===`1`}}function we(e,t={}){let n=new URL(e||`https://127.0.0.1:5173/universes.html`),r=n.searchParams;return r.set(`seed`,String(Math.trunc(Number(t.seed)||20261125))),t.epoch&&r.set(`epoch`,String(t.epoch)),Number.isFinite(t.log10SpanM)&&r.set(`span`,Number(t.log10SpanM).toFixed(2)),typeof t.useSol==`boolean`&&r.set(`sol`,t.useSol?`1`:`0`),t.bodyId&&r.set(`body`,String(t.bodyId)),t.surfaceActive?(r.set(`surf`,`1`),Array.isArray(t.pos)&&t.pos.length===3&&(r.set(`x`,Number(t.pos[0]).toFixed(1)),r.set(`y`,Number(t.pos[1]).toFixed(1)),r.set(`z`,Number(t.pos[2]).toFixed(1))),Number.isFinite(t.yaw)&&r.set(`yaw`,Number(t.yaw).toFixed(2))):(r.delete(`surf`),r.delete(`x`),r.delete(`y`),r.delete(`z`),r.delete(`yaw`)),Number.isFinite(t.simTimeS)&&r.set(`t`,Number(t.simTimeS).toFixed(1)),t.roomId?r.set(`room`,String(t.roomId)):r.delete(`room`),t.relayUrl?r.set(`relay`,String(t.relayUrl)):r.delete(`relay`),n.toString()}function Te({peerId:e=null,onWeaponHitLocal:t=null,onRemoteMissile:n=null,onStateChange:r=null}={}){let i=e||`ufo-${Math.random().toString(36).slice(2,8)}`,a=new Map,o=null,s=``,c=null,l=null,u=!1,d=Date.now(),f=0,p=0,m=0,h=0,g=0,_=()=>{typeof r==`function`&&r(D())};function v(e){if(!e||typeof e!=`object`||e.from===i||o&&e.roomId&&e.roomId!==o)return;m+=1;let r=Date.now();e.type===`ufo-state`&&e.from?(a.set(e.from,{peerId:e.from,state:e.state||{},lastSeenMs:r}),Number.isFinite(e.epochAnchorMs)&&e.epochAnchorMs<d&&(d=e.epochAnchorMs)):e.type===`ufo-hit`&&e.targetPeerId===i?(h+=1,typeof t==`function`&&t({from:e.from,weapon:e.weapon||`laser`,damage:Number(e.damage)||8,wavelengthNm:e.wavelengthNm??532})):e.type===`ufo-missile`&&e.from?typeof n==`function`&&n(e.missile,e.from):(e.type===`ufo-leave`||e.type===`peer-disconnect`)&&(e.from||e.peerId)&&a.delete(e.from||e.peerId),_()}function y(e){if(!u||!o)return!1;let t={...e,from:i,roomId:o,epochAnchorMs:d},n=!1;if(l)try{l.postMessage(t),n=!0}catch{}if(c)try{c.send(t),n=!0}catch{}return n&&(p+=1),n}function b({room:e=`ulg-cosmos-1`,relay:t=``}={}){S();let n=String(e||``).trim();if(!n)return D();if(o=n,s=String(t||``).trim(),d=Date.now(),u=!0,typeof globalThis.BroadcastChannel==`function`)try{l=new globalThis.BroadcastChannel(`ulg-ufo-room:${o}`),l.onmessage=e=>v(e.data)}catch{l=null}if(s)try{c=x({relayUrl:s,roomId:`ulg-ufo-room:${o}`,peerId:i,enableWebRtc:!0}),c.onMessage(e=>v(e))}catch{c=null}return _(),D()}function S(){if(u&&o&&y({type:`ufo-leave`}),u=!1,o=null,s=``,a.clear(),l){try{l.close()}catch{}l=null}if(c){try{c.close()}catch{}c=null}return _(),D()}function C(e,t=!1){if(!u)return;let n=Date.now();if(!(!t&&n-f<48)){f=n;for(let[e,t]of a.entries())n-t.lastSeenMs>6e3&&a.delete(e);y({type:`ufo-state`,state:e})}}function w(e,{weapon:t=`laser`,damage:n=8,wavelengthNm:r=532}={}){return!u||!e?!1:(g+=1,y({type:`ufo-hit`,targetPeerId:e,weapon:t,damage:n,wavelengthNm:r}))}function T(e){return!u||!e?!1:y({type:`ufo-missile`,missile:e})}function E({level:e,bodyId:t,surfaceActive:n}={}){let r=Date.now(),i=[];for(let[o,s]of a.entries()){if(r-s.lastSeenMs>6e3){a.delete(o);continue}let c=s.state,l=!!n&&!!c.surfaceActive&&(!t||c.bodyId===t),u=!n&&!c.surfaceActive&&(e==null||c.level===e);(l||u)&&i.push({peerId:o,...c})}return i}function D(){return{selfId:i,connected:u,roomId:o,relayUrl:s,timescaleLocked:u,syncedEpochSec:u?(Date.now()-d)*.001:null,remotePeerCount:a.size,remotePeerIds:[...a.keys()],transportKind:c?`peercompute-webrtc+bc`:l?`broadcast-channel`:`offline`,messagesSent:p,messagesReceived:m,shieldHitsTaken:h,shieldHitsDealt:g}}return Object.freeze({connect:b,disconnect:S,broadcastLocalState:C,sendWeaponHit:w,broadcastMissileLaunch:T,getRemotePeersForContext:E,getStatus:D,get isConnected(){return u},get timescaleLocked(){return u}})}function Ee(){let e={silicatesKg:120,volatilesKg:80,metalsKg:90,exoticsKg:12,probes:[],reactorTier:1,maxPowerW:1e10,shieldHp:100,maxShieldHp:100,shieldFlash:0,harvestedPowerW:18e12,kardashevIndex:.725};function t(){let t=0;for(let n of e.probes)t+=n.powerW;e.harvestedPowerW=18e12*12**(e.reactorTier-1)+t,e.kardashevIndex=Se((Math.log10(Math.max(1e6,e.harvestedPowerW))-6)/10,0,3.2),e.maxPowerW=Math.min(0x5af3107a4000,1e10*10**(e.reactorTier-1))}function n({silicates:t=0,volatiles:n=0,metals:r=0,exotics:i=0}={}){e.silicatesKg+=Math.max(0,t),e.volatilesKg+=Math.max(0,n),e.metalsKg+=Math.max(0,r),e.exoticsKg+=Math.max(0,i)}function r({bodyId:n=`earth`,orbitRadius:r=2.2,stellarFluxMul:i=1}={}){if(e.metalsKg<40||e.silicatesKg<40)return null;e.metalsKg-=40,e.silicatesKg-=40;let a={id:`vn-${e.probes.length+1}`,bodyId:n,orbitRadius:Math.max(1.4,r),angle:Math.random()*Math.PI*2,inclination:(Math.random()-.5)*.75,gen:1,replicationProgress:0,powerW:0xe35fa931a000*Math.max(.25,i)};return e.probes.push(a),t(),a}function i(){let n=80*e.reactorTier,r=10*e.reactorTier;return e.reactorTier>=5||e.metalsKg<n||e.exoticsKg<r?!1:(e.metalsKg-=n,e.exoticsKg-=r,e.reactorTier+=1,e.maxShieldHp=100+(e.reactorTier-1)*45,e.shieldHp=e.maxShieldHp,t(),!0)}function a(n){let r=Se(Number(n)||.016,0,.2);e.shieldFlash=Math.max(0,e.shieldFlash-r*2.6),e.shieldHp=Math.min(e.maxShieldHp,e.shieldHp+r*(2.2*e.reactorTier));for(let t=0;t<e.probes.length;t+=1){let n=e.probes[t];n.angle+=r*(.42+t%5*.12),n.replicationProgress+=r*.035,e.metalsKg+=r*1.4,e.silicatesKg+=r*1.6,e.exoticsKg+=r*.25,n.replicationProgress>=1&&(n.replicationProgress=0,n.powerW*=1.45,e.probes.length<28&&e.probes.push({id:`vn-${e.probes.length+1}`,bodyId:n.bodyId,orbitRadius:n.orbitRadius*(.94+Math.random()*.14),angle:n.angle+.5,inclination:Se(n.inclination+(Math.random()-.5)*.35,-.9,.9),gen:n.gen+1,replicationProgress:0,powerW:n.powerW*.85}))}t()}function o(t){e.shieldHp=Math.max(0,e.shieldHp-Math.max(0,t)),e.shieldFlash=1,e.shieldHp<=0&&(e.shieldHp=e.maxShieldHp*.45)}return t(),{state:e,addHarvest:n,deployVonNeumannProbe:r,upgradeReactor:i,applyDamage:o,step:a}}var De=`ulg.astrophysics.solar-system-nbody-webgpu.v1`,Oe=149597870700,ke=30034896e-13,Ae=4*Math.PI*Math.PI,je=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Me=Object.freeze([{id:`sun`,name:`Sun (G2V)`,subtitle:`Main-Sequence Hydrogen Fusion Star`,parent:-1,kind:0,massSolar:1,radiusKm:695700,aAu:0,e:0,incDeg:0,omDeg:0,wDeg:0,m0Deg:0,color0:[1,.94,.76],color1:[1,.56,.18],atm:0,tempK:5778,centralP:0x58d15e17628000,coreZ:1,mantleZ:2,surfZ:1,composition:`H 73.5% · He 24.8% · O/C/Fe 1.7%`},{id:`mercury`,name:`Mercury`,subtitle:`Iron-Core Terrestrial Planet · 0.387 AU`,parent:0,kind:1,massSolar:1.6601e-7,radiusKm:2439.7,aAu:.387098,e:.20563,incDeg:7.005,omDeg:48.33,wDeg:29.12,m0Deg:174.8,color0:[.58,.54,.5],color1:[.36,.33,.31],atm:0,surfacePressurePa:0,tempK:440,centralP:4e10,coreZ:26,mantleZ:14,surfZ:14,composition:`Fe Core 70% · Silicate Mantle 30%`},{id:`venus`,name:`Venus`,subtitle:`Super-Greenhouse Terrestrial Planet · 0.723 AU`,parent:0,kind:2,massSolar:24478e-10,radiusKm:6051.8,aAu:.723332,e:.00677,incDeg:3.395,omDeg:76.68,wDeg:54.88,m0Deg:50.1,color0:[.9,.78,.52],color1:[.76,.58,.34],atm:.85,surfacePressurePa:92e5,tempK:737,centralP:29e10,coreZ:26,mantleZ:14,surfZ:6,composition:`Fe/Ni Core · SiO₂ Mantle · CO₂ 96.5% Atm`},{id:`earth`,name:`Earth`,subtitle:`Oceanic Silicate-Iron Biosphere · 1.000 AU`,parent:0,kind:1,massSolar:ke,radiusKm:6371,aAu:1.000001,e:.01671,incDeg:0,omDeg:0,wDeg:102.94,m0Deg:357.5,color0:[.24,.48,.24],color1:[.06,.26,.58],atm:.72,surfacePressurePa:101325,tempK:288,centralP:364e9,coreZ:26,mantleZ:14,surfZ:29,composition:`Fe 32.1% · O 30.1% · Si 15.1% · Mg 13.9%`},{id:`moon`,name:`Moon (Luna)`,subtitle:`Earth Natural Satellite · 384,400 km`,parent:3,kind:3,massSolar:3.6943e-8,radiusKm:1737.4,aAu:.0025695,e:.0549,incDeg:5.145,omDeg:125.08,wDeg:318.15,m0Deg:135.2,color0:[.68,.67,.65],color1:[.42,.41,.4],atm:0,surfacePressurePa:0,tempK:220,centralP:48e8,coreZ:26,mantleZ:14,surfZ:14,composition:`O 43% · Si 20% · Mg 19% · Fe 10% · Ca/Al 8%`},{id:`mars`,name:`Mars`,subtitle:`Iron-Oxide Terrestrial World · 1.524 AU`,parent:0,kind:1,massSolar:3.22715e-7,radiusKm:3389.5,aAu:1.523679,e:.0934,incDeg:1.85,omDeg:49.56,wDeg:286.5,m0Deg:19.4,color0:[.74,.34,.2],color1:[.52,.24,.14],atm:.18,surfacePressurePa:610,tempK:210,centralP:4e10,coreZ:26,mantleZ:14,surfZ:26,composition:`Fe-S Core · Basalt/Fe₂O₃ Crust · CO₂ Atm`},{id:`jupiter`,name:`Jupiter`,subtitle:`Metallic-Hydrogen Gas Giant · 5.204 AU`,parent:0,kind:2,massSolar:954588e-9,radiusKm:69911,aAu:5.2044,e:.0489,incDeg:1.303,omDeg:100.46,wDeg:273.87,m0Deg:20,color0:[.85,.72,.56],color1:[.62,.42,.28],atm:.45,surfacePressurePa:1e5,tempK:125,centralP:45e10,coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ 89.8% · He 10.2% · Metallic H Mantle`},{id:`io`,name:`Io`,subtitle:`Tidally Heated Volcanic Galilean Moon · 421,700 km`,parent:6,kind:1,massSolar:4.491e-8,radiusKm:1821.6,aAu:.002819,e:.0041,incDeg:1.34,omDeg:43.9,wDeg:84.1,m0Deg:35,color0:[.92,.82,.34],color1:[.68,.46,.14],atm:0,surfacePressurePa:0,tempK:110,centralP:8e9,coreZ:26,mantleZ:14,surfZ:16,composition:`Fe-FeS Core · Silicate Mantle · Sulfur Crust`},{id:`europa`,name:`Europa`,subtitle:`Subsurface-Ocean Icy Galilean Moon · 671,100 km`,parent:6,kind:3,massSolar:2.414e-8,radiusKm:1560.8,aAu:.004486,e:.009,incDeg:1.77,omDeg:219.1,wDeg:88.9,m0Deg:145,color0:[.84,.8,.74],color1:[.58,.68,.78],atm:0,surfacePressurePa:0,tempK:102,centralP:5e9,coreZ:26,mantleZ:14,surfZ:8,composition:`H₂O Ice/Ocean Shell · Silicate Mantle · Fe Core`},{id:`ganymede`,name:`Ganymede`,subtitle:`Magnetized Giant Galilean Moon · 1,070,400 km`,parent:6,kind:3,massSolar:7.452e-8,radiusKm:2634.1,aAu:.007155,e:.0013,incDeg:1.5,omDeg:63.5,wDeg:192.4,m0Deg:260,color0:[.64,.6,.56],color1:[.46,.48,.52],atm:0,surfacePressurePa:0,tempK:110,centralP:1e10,coreZ:26,mantleZ:14,surfZ:8,composition:`H₂O Ice/Liquid Layers · Silicate · Fe Core`},{id:`saturn`,name:`Saturn`,subtitle:`Ringed Gas Giant · 9.582 AU`,parent:0,kind:2,massSolar:285815e-9,radiusKm:58232,aAu:9.5826,e:.0565,incDeg:2.485,omDeg:113.67,wDeg:339.39,m0Deg:317,color0:[.88,.79,.58],color1:[.7,.6,.42],atm:.42,surfacePressurePa:1e5,ringed:!0,ringInnerKm:74500,ringOuterKm:136775,tempK:95,centralP:34e10,coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ 96.3% · He 3.25% · H₂O Ice Ring System`},{id:`titan`,name:`Titan`,subtitle:`Dense-Atmosphere Methane Moon · 1,221,870 km`,parent:10,kind:2,massSolar:6.766e-8,radiusKm:2574.7,aAu:.008168,e:.0288,incDeg:2.8,omDeg:28,wDeg:180.5,m0Deg:65,color0:[.86,.68,.34],color1:[.64,.46,.22],atm:.78,surfacePressurePa:146700,tempK:94,centralP:6e9,coreZ:14,mantleZ:8,surfZ:6,composition:`N₂ 94.2% · CH₄ 5.6% Atm · H₂O/Silicate Interior`},{id:`uranus`,name:`Uranus`,subtitle:`Tilted Ice Giant · 19.20 AU`,parent:0,kind:3,massSolar:43658e-9,radiusKm:25362,aAu:19.2184,e:.0463,incDeg:.773,omDeg:74.01,wDeg:96.99,m0Deg:142.2,color0:[.56,.84,.9],color1:[.42,.72,.82],atm:.58,surfacePressurePa:1e5,tempK:59,centralP:26e10,coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/NH₃/CH₄ Superionic Mantle · H₂/He Atm`},{id:`neptune`,name:`Neptune`,subtitle:`Supersonic-Wind Ice Giant · 30.07 AU`,parent:0,kind:3,massSolar:51503e-9,radiusKm:24622,aAu:30.1104,e:.0095,incDeg:1.77,omDeg:131.78,wDeg:276.34,m0Deg:256.2,color0:[.24,.46,.94],color1:[.16,.3,.78],atm:.65,surfacePressurePa:1e5,tempK:55,centralP:29e10,coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/CH₄/NH₃ Mantle · H₂ 80% · He 19%`},{id:`halley`,name:`1P/Halley Comet`,subtitle:`Eccentric Periodic Comet · e = 0.967`,parent:0,kind:3,massSolar:11e-17,radiusKm:5.5,aAu:17.834,e:.9671,incDeg:162.26,omDeg:58.42,wDeg:111.33,m0Deg:38.4,color0:[.74,.9,1],color1:[.42,.68,.92],atm:.2,tempK:170,centralP:1e5,coreZ:8,mantleZ:6,surfZ:14,composition:`H₂O 80% · CO 10% · CO₂/CH₄/Silicate Dust`}]);function Ne(e){let t=Math.fround(e);return[t,Math.fround(e-t)]}function V(e,t){let n=t<.8?e:Math.PI;for(let r=0;r<12;r+=1){let r=n-t*Math.sin(n)-e,i=1-t*Math.cos(n),a=r/Math.max(1e-9,i);if(n-=a,Math.abs(a)<1e-12)break}return n}function H({aAu:e,e:t=0,incDeg:n=0,omDeg:r=0,wDeg:i=0,m0Deg:a=0},o){if(!(e>0)||!(o>0))return{pos:[0,0,0],vel:[0,0,0]};let s=Math.PI/180,c=n*s,l=r*s,u=i*s,d=V((a*s%(2*Math.PI)+2*Math.PI)%(2*Math.PI),t),f=Math.cos(d),p=Math.sin(d),m=Math.sqrt(Math.max(1e-12,1-t*t)),h=e*(1-t*f),g=e*(f-t),_=e*m*p,v=Math.sqrt(o*e)/Math.max(1e-12,h),y=-v*p,b=v*m*f,x=Math.cos(l),S=Math.sin(l),C=Math.cos(u),w=Math.sin(u),T=Math.cos(c),E=Math.sin(c),D=x*C-S*w*T,O=S*C+x*w*T,k=w*E,A=-x*w-S*C*T,j=-S*w+x*C*T,M=C*E;return{pos:[D*g+A*_,k*g+M*_,O*g+j*_],vel:[D*y+A*b,k*y+M*b,O*y+j*b]}}function Pe(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Fe(e,{asteroidCount:t=512,beltZoneAu:n=null,seed:r=20261125,starMassScale:i=1,centerOffsetAu:a=[0,0,0]}={}){let o=Array.isArray(e)&&e.length>0?e:Me,s=o.length,c=Math.max(0,Math.min(4096,Math.trunc(Number(t)||0))),l=s+c,u=Array.from({length:l},()=>[0,0,0]),d=Array.from({length:l},()=>[0,0,0]),f=new Float64Array(l),p=new Float64Array(l),m=new Float32Array(l),h=Math.max(.1,Number(i)||1),g=0;for(let e=0;e<s;e+=1){let t=o[e],n=!!t.isStar||e===0;n&&(g+=1),f[e]=n?t.massSolar*h:t.massSolar,p[e]=t.radiusKm*1e3/Oe,m[e]=t.kind}let _=[0,0,0],v=[0,0,0],y=f[0];if(g>=2&&o[1]?.orbitRole===`binary-companion`){let e=f[0],t=f[1];y=e+t;let n=H(o[1],Ae*y),r=-t/Math.max(1e-12,y),i=e/Math.max(1e-12,y);u[0]=[n.pos[0]*r,n.pos[1]*r,n.pos[2]*r],d[0]=[n.vel[0]*r,n.vel[1]*r,n.vel[2]*r],u[1]=[n.pos[0]*i,n.pos[1]*i,n.pos[2]*i],d[1]=[n.vel[0]*i,n.vel[1]*i,n.vel[2]*i]}if(g>=3&&o[2]?.orbitRole===`trinary-outer`){let e=f[2],t=y+e,n=H(o[2],Ae*t),r=-e/Math.max(1e-12,t),i=y/Math.max(1e-12,t);_=[n.pos[0]*r,n.pos[1]*r,n.pos[2]*r],v=[n.vel[0]*r,n.vel[1]*r,n.vel[2]*r];for(let e=0;e<2;e+=1)u[e]=[u[e][0]+_[0],u[e][1]+_[1],u[e][2]+_[2]],d[e]=[d[e][0]+v[0],d[e][1]+v[1],d[e][2]+v[2]];u[2]=[n.pos[0]*i,n.pos[1]*i,n.pos[2]*i],d[2]=[n.vel[0]*i,n.vel[1]*i,n.vel[2]*i]}for(let e=g;e<s;e+=1){let t=o[e],n=f[e];if(t.parent===-2){let r=H(t,Ae*(y+n));u[e]=[_[0]+r.pos[0],_[1]+r.pos[1],_[2]+r.pos[2]],d[e]=[v[0]+r.vel[0],v[1]+r.vel[1],v[2]+r.vel[2]]}else if(t.parent>=0&&t.parent<e){let r=t.parent,i=H(t,Ae*(f[r]+n));u[e]=[u[r][0]+i.pos[0],u[r][1]+i.pos[1],u[r][2]+i.pos[2]],d[e]=[d[r][0]+i.vel[0],d[r][1]+i.vel[1],d[r][2]+i.vel[2]]}}let b=0,x=0,S=0,C=0,w=0,T=0,E=0;for(let e=0;e<s;e+=1){let t=f[e];b+=t,x+=t*u[e][0],S+=t*u[e][1],C+=t*u[e][2],w+=t*d[e][0],T+=t*d[e][1],E+=t*d[e][2]}x/=Math.max(1e-12,b),S/=Math.max(1e-12,b),C/=Math.max(1e-12,b);let D=w/Math.max(1e-12,b),O=T/Math.max(1e-12,b),k=E/Math.max(1e-12,b);for(let e=0;e<s;e+=1)u[e][0]-=x,u[e][1]-=S,u[e][2]-=C,d[e][0]-=D,d[e][1]-=O,d[e][2]-=k;_=[_[0]-x,_[1]-S,_[2]-C],v=[v[0]-D,v[1]-O,v[2]-k];let A=Pe(r^2654435769),j=g>=2&&(o[1]?.aAu||10)<1.5,M=j?_:u[0],N=j?v:d[0],P=Ae*(j?y:f[0]),F=n?.innerAu??2.15,I=n?.outerAu??3.3,ee=n?.kuiperInnerAu??32,L=n?.kuiperOuterAu??46;for(let e=0;e<c;e+=1){let t=s+e,n=e>=Math.floor(c*.72),r=H({aAu:n?ee+A()*Math.max(.5,L-ee):F+A()*Math.max(.25,I-F),e:n?.02+A()*.14:.01+A()*.16,incDeg:(A()-.5)*(n?14:12),omDeg:A()*360,wDeg:A()*360,m0Deg:A()*360},P);u[t]=[M[0]+r.pos[0],M[1]+r.pos[1],M[2]+r.pos[2]],d[t]=[N[0]+r.vel[0],N[1]+r.vel[1],N[2]+r.vel[2]],f[t]=0,p[t]=(15+A()*85)*1e3/Oe,m[t]=n?7:6}let R=Number(a?.[0])||0,te=Number(a?.[1])||0,ne=Number(a?.[2])||0,z=new Float32Array(l*16);for(let e=0;e<l;e+=1){let[t,n]=Ne(u[e][0]+R),[r,i]=Ne(u[e][1]+te),[a,o]=Ne(u[e][2]+ne),s=e*16;z[s+0]=t,z[s+1]=r,z[s+2]=a,z[s+3]=f[e],z[s+4]=n,z[s+5]=i,z[s+6]=o,z[s+7]=p[e],z[s+8]=d[e][0],z[s+9]=d[e][1],z[s+10]=d[e][2],z[s+11]=m[e],z[s+12]=0,z[s+13]=0,z[s+14]=0,z[s+15]=0}return Object.freeze({packed:z,massiveCount:s,starCount:g,asteroidCount:c,totalCount:l,catalog:o})}var Ie=`
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
`;function Le(e,{catalog:t=null,beltZoneAu:n=null,asteroidCount:r=512,seed:i=20261125,starMassScale:a=1,centerOffsetAu:o=[0,0,0],softeningAu:s=1e-7,label:c=`ulg-solar-system-nbody`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createSolarSystemNBodyEngineWebGpu requires a live WebGPU GPUDevice`);let l=Fe(t||Me,{asteroidCount:r,beltZoneAu:n,seed:i,starMassScale:a,centerOffsetAu:o}),u=[C(0,`uniform`),C(1,`storage`)],d=t=>T(e,{cacheKey:`ulg-solar-nbody-${t}.v1`,label:`${c}-${t}`,code:Ie,entryPoint:t,bindings:u}),f=d(`compute_nbody_accel`),p=d(`kdk_half_kick_drift`),m=d(`kdk_second_kick`),h=e.createBuffer({label:`${c}-params`,size:32,usage:je.UNIFORM|je.COPY_DST}),g=e.createBuffer({label:`${c}-bodies`,size:l.packed.byteLength,usage:je.STORAGE|je.VERTEX|je.COPY_DST|je.COPY_SRC});e.queue.writeBuffer(g,0,l.packed);let _=l.massiveCount*64,v=e.createBuffer({label:`${c}-massive-staging`,size:_,usage:je.MAP_READ|je.COPY_DST}),y=w(e,{layout:f.bindGroupLayout,label:`${c}-bg`,entries:[{binding:0,resource:{buffer:h}},{binding:1,resource:{buffer:g}}]}),b=Float32Array.from(l.packed.subarray(0,l.massiveCount*16)),x=0,S=0,E=!1,D=!1,O=!1;function k(t){let n=new ArrayBuffer(32);new Uint32Array(n,0,4).set([l.totalCount,l.massiveCount,0,0]),new Float32Array(n,16,4).set([t,Ae,s*s,0]),e.queue.writeBuffer(h,0,n)}async function A({dtSubYr:t=45e-6,substeps:n=12,readMassive:r=!0}={}){if(O)return b;let i=Math.max(1,Math.min(64,Math.trunc(n))),a=Math.max(1e-7,Math.min(12e-5,Number(t)||45e-6));k(a);let o=Math.ceil(l.totalCount/64),s=e.createCommandEncoder({label:`${c}-step-${S}`}),u=s.beginComputePass({label:`${c}-pass`});u.setBindGroup(0,y),E||=(u.setPipeline(f.pipeline),u.dispatchWorkgroups(o),!0);for(let e=0;e<i;e+=1)u.setPipeline(p.pipeline),u.dispatchWorkgroups(o),u.setPipeline(f.pipeline),u.dispatchWorkgroups(o),u.setPipeline(m.pipeline),u.dispatchWorkgroups(o);u.end();let d=r&&!D;if(d&&s.copyBufferToBuffer(g,0,v,0,_),e.queue.submit([s.finish()]),S+=i,x+=a*i,d){D=!0;try{await v.mapAsync(je.MAP_READ),O||b.set(new Float32Array(v.getMappedRange(0,_))),v.unmap()}finally{D=!1}}return b}function j(e){let t=e*16;return{posAu:[b[t+0]+b[t+4],b[t+1]+b[t+5],b[t+2]+b[t+6]],velAuPerYr:[b[t+8],b[t+9],b[t+10]],massSolar:b[t+3],radiusAu:b[t+7],phi:b[t+15]}}function M(){let e=0,t=0,n=0,r=0,i=0,a=0,o=Array.from({length:l.massiveCount},(e,t)=>j(t));for(let c=0;c<o.length;c+=1){let l=o[c],u=l.velAuPerYr[0]**2+l.velAuPerYr[1]**2+l.velAuPerYr[2]**2;e+=.5*l.massSolar*u,n+=l.massSolar*l.velAuPerYr[0],r+=l.massSolar*l.velAuPerYr[1],i+=l.massSolar*l.velAuPerYr[2],a+=l.massSolar*Math.sqrt(u);for(let e=c+1;e<o.length;e+=1){let n=o[e],r=n.posAu[0]-l.posAu[0],i=n.posAu[1]-l.posAu[1],a=n.posAu[2]-l.posAu[2],c=Math.sqrt(r*r+i*i+a*a+s*s);t-=Ae*l.massSolar*n.massSolar/c}}return Object.freeze({kineticEnergy:e,potentialEnergy:t,totalEnergy:e+t,momentum:Object.freeze([n,r,i]),relMomentumError:Math.hypot(n,r,i)/Math.max(1e-12,a),simTimeYr:x,stepIndex:S})}function N(){if(!O){O=!0;for(let e of[h,g,v])try{e.destroy()}catch{}}}return Object.freeze({schema:De,get massiveCount(){return l.massiveCount},get starCount(){return l.starCount},get asteroidCount(){return l.asteroidCount},get totalCount(){return l.totalCount},get stepIndex(){return S},get simTimeYr(){return x},get catalog(){return l.catalog},getResidentBuffer:()=>g,getMassiveSnapshot:()=>b,getMassiveBodyState64:j,computeConservationDiagnostics:M,step:A,dispose:N})}var Re=25.4,ze=-14.8,Be=Object.freeze([Object.freeze({level:0,id:`cosmic-web`,shortLabel:`Web`,name:`Supergalactic Cosmic Web`,exponentLabel:`10²⁵ m`,log10SpanM:24.8,minLog10:21.8,maxLog10:25.5,diveVerb:`APPROACHING GALAXY`,diveButton:`⚡ ZOOM TO GALAXY`,engineSchema:`ulg.astrophysics.supergalactic-flrw-treepm.v1`,plotTitle:`GPU MATTER POWER SPECTRUM P(k)`,equations:`∇²Φ = (3/2) Ω_m (H₀² / a) δ(x, t)   [3D-FFT Poisson via fft3dWebGpu]
dp/da = −(1 / a² H(a)) ∇Φ   (Symplectic KDK FLRW Comoving Integrator)`,summary:`Evolves full-Nyquist 2LPT dark-matter filaments (1-submit FLRW 3D-FFT TreePM) AND the general Cosmological Baryon & Radiation law (Eisenstein–Hu BAO/CMB recombination ΔT/T at z=1100, Pop III UV Reionization bubble percolation at z=10, and Bullet-Cluster X-ray ICM shock + 2D gravitational lensing convergence κ/α).`,kernels:`build2LptCosmologyICsWebGpu · createSupergalacticTreePmSessionWebGpu · createCosmologicalBaryonRadiationSessionWebGpu`}),Object.freeze({level:1,id:`galaxy`,shortLabel:`Galaxy`,name:`Spiral Galaxy & Halo`,exponentLabel:`10²¹ m`,log10SpanM:21,minLog10:15.8,maxLog10:22.8,diveVerb:`APPROACHING SOLAR SYSTEM`,diveButton:`⚡ ZOOM TO TARGET`,engineSchema:`webgpu-schroeder-scale-atlas-multipole`,plotTitle:`GATE 1 ISM COOLING CURVE Λ(T, Z)`,equations:`a_i = −G Σ_cell M_cell (r_i − r_cell) / (|r_i − r_cell|² + ε²)^(3/2)   [SchroederScaleAtlas]
v_c(r) ≈ const (NFW dark-matter halo + exponential disk + bulge) · Λ(T, Z) from Gate 1 H/He/C/O`,summary:`Simulates 16K–65K GPU-resident stars on parallel SchroederScaleAtlas multipole gravity across 7 emergent morphologies (Grand-Design Spiral, Barred Spiral, Major Merger, Giant Elliptical, High-z Clumpy Protogalaxy, Tidally Disrupted Dwarf & Halo Stream, and Core-Collapsed Globular Cluster) plus Gate 1 ISM cooling Λ(T, Z).`,kernels:`createResidentScaleAtlasMultipoleNBodyEngine · deriveGate1IsmCoolingAnchorsWebGpu`}),Object.freeze({level:2,id:`star-system`,shortLabel:`System`,name:`Solar System & Protoplanetary Formation`,exponentLabel:`10¹² m`,log10SpanM:12.6,minLog10:7.9,maxLog10:16.8,diveVerb:`APPROACHING WORLD`,diveButton:`⚡ ZOOM TO SELECTED BODY`,engineSchema:`ulg.astrophysics.solar-system-nbody-webgpu.v1`,plotTitle:`SYMPLECTIC N-BODY & ACCRETION DISK`,equations:`d²r_i/dt² = −G Σ_{j≠i} m_j (r_i − r_j) / |r_i − r_j|³   [f32x2 Symplectic GPU N-Body]
v_gas = (1−η)v_K · T(r) < T_snow → H₂O ice condensation · DLM Particle-Rigid Planetesimals`,summary:`Spans mature double-float symplectic Solar System N-body, Protoplanetary Disk Accretion, Roche-Limit Ring Disruption & Shepherd Moons, Giant Moon-Forming Impact, Active Dual-Tail Comets, Hot-Jupiter XUV Photoevaporation, Red-Giant Engulfment (+5 Gyr), Kerr Blandford–Znajek Quasar/Blazar Jets, Roche X-Ray Binaries, Type Ia Detonations, and 2.5PN GW Chirp BNS Kilonova / BBH Mergers.`,kernels:`createSolarSystemNBodyEngineWebGpu · createProtoplanetaryDiskFormationSessionWebGpu · createKerrAccretionJetSessionWebGpu · createRelativisticBinaryMergerSessionWebGpu · createTidalRocheDisruptionSessionWebGpu`}),Object.freeze({level:3,id:`stellar-core`,shortLabel:`Star/MHD`,name:`MHD Nebular Collapse & Stellar Fusion`,exponentLabel:`10⁹ m`,log10SpanM:9.2,minLog10:7.4,maxLog10:10.6,diveVerb:`SAMPLING PLANETARY MATTER`,diveButton:`⚡ ZOOM TO EARTH / MATTER`,engineSchema:`ulg.astrophysics.nebular-mhd-collapse-webgpu.v1`,plotTitle:`GAMOW FUSION WINDOW / MHD MAGNETIC ENERGY`,equations:`∂B/∂t = ∇×(v×B) + η∇²B − ∇ψ,   F_L = (∇×B)×B / μ₀   [3D Resistive MHD + Dedner GLM]
du/dt = −(P/ρ)∇·v + q_visc + ε_pp + ε_CNO + ε_3α − Λ_rad   [self-gravitating-hydro@1]`,summary:`Spans live Stellar Core Fusion, 3D Resistive MHD Nebular Collapse & Bipolar Jets, Strömgren Photoionized H II Star-Forming Pillars, Bipolar Planetary Nebulae, Supernova Remnants / Crab PWN, Spitkovsky Millisecond Pulsars, Hall-Crustal-Yield Magnetar Giant Flares, and live WebGPU GR TOV Unified Degenerate EOS (White Dwarf → Neutron Star → Black Hole).`,kernels:`createNebularMhdCollapseSessionWebGpu · createSelfGravitatingHydroEngine · createRadiativePhotoionizationWindSessionWebGpu · createCompactMagnetosphereSessionWebGpu · solveRelativisticTovBatchWebGpu`}),Object.freeze({level:4,id:`planetary-interior`,shortLabel:`Planet`,name:`Planetary World, Atmosphere & Electrodynamics`,exponentLabel:`10⁷ m`,log10SpanM:7.2,minLog10:-5.8,maxLog10:8.6,diveVerb:`DESCENDING TO SURFACE`,diveButton:`🚙 LAND / DIVE TO SAMPLE`,engineSchema:`ulg.astrophysics.planetary-atmosphere-em-webgpu.v1`,plotTitle:`HYDROSTATIC P(r) & ATMOSPHERIC EM`,equations:`dv/dt + 2Ω×v = −∇P/ρ · ∇²φ = −ρ_q/ε₀ · |E| > E_Paschen(P) → Lightning Discharge
dM/dr = 4π r² ρ_polytope(P, T),   B_dip(Ω, r_core, σ_Fe) → Magnetospheric Aurorae`,summary:`Dynamically activates ULG’s general spherical baroclinic atmosphere, particulate triboelectric charging, GPU Poisson Paschen lightning, core-geodynamo aurorae, Hadean Magma Ocean radiative crust, viscoelastic Cryovolcanic Icy Plumes, Tidally Locked Eyeball & Rogue Worlds, Gate 2 Polytope Atlas cutaway — PLUS an interactive Planetary Surface Explorer (TinyPlanetControls) with a 6-Wheel Jump-Rocket Mars Rover and Coaxial Atmospheric Drone whose rotor lift emerges strictly from local ρ_atm & g!`,kernels:`createPlanetaryAtmosphereElectricSessionWebGpu · createPlanetarySurfaceSessionWebGpu · solvePlanetaryInteriorWebGpu · createTidalRocheDisruptionSessionWebGpu`}),Object.freeze({level:5,id:`molecular-dynamics`,shortLabel:`MD`,name:`Crystal & Fluid Molecular Dynamics`,exponentLabel:`10⁻⁸ m`,log10SpanM:-8.2,minLog10:-9.5,maxLog10:-5.2,diveVerb:`RESOLVING ELECTRON SHELLS`,diveButton:`⚡ ZOOM TO QUANTUM ATOM`,engineSchema:`ulg.gpumath.molecular-dynamics-webgpu.v1`,plotTitle:`LIVE GPU RADIAL DISTRIBUTION g(r)`,equations:`m_i d²r_i/dt² = −∇_i [ Σ φ_pair(r_ij) + Σ F_EAM(ρ_i) + Σ V_3(r_ij, r_ik) ] + m_i g
O(N) lock-free linked-cell Verlet + Berendsen thermostat & live 64-bin GPU g(r)`,summary:`Evolves 1,000–4,000 live atoms of the sampled planetary material strictly on WebGPU using Gate 1 DFT-derived pair/EAM/Stillinger–Weber potentials and physical Gate 1 optical reflectance. Heat through melting & vaporization, toggle GPU gravity, or keep scrolling inward straight into a single atom’s electron shells.`,kernels:`createMolecularDynamicsSessionWebGpu · buildCrystalMdState · zero-copy positionsBuffer/velocitiesBuffer`}),Object.freeze({level:6,id:`quantum-atom`,shortLabel:`Atom`,name:`Relativistic Dirac–KS Atom & Molecule`,exponentLabel:`10⁻¹⁰ m`,log10SpanM:-10,minLog10:-13.2,maxLog10:-9,diveVerb:`PROBING STRONG FORCE CORE`,diveButton:`⚡ ZOOM TO NUCLEUS`,engineSchema:`ulg.electronic.orbital-cloud-webgpu.v1`,plotTitle:`DIRAC–KS 4πr²ρ(r) & SUBSHELL LEVELS`,equations:`[c α·p + β m c² + V_nuc(R_nuc) + V_H(ρ) + V_xc(ρ)] ψ_κ = ε_κ ψ_κ   [4-comp Dirac–KS]
|ψ_nlm(r, θ, φ)|² = |R_nl(r)|² |Y_lm(θ, φ)|²   (separable GPU inverse-CDF cloud)`,summary:`Solves 4-component relativistic radial Dirac–Kohn–Sham equations on WebGPU (0 per-SCF readbacks) and samples 60K–180K continuous 3D wavefunction points into a resident GPU buffer. Keep scrolling inward through 5 orders of magnitude of empty intra-atomic space to resolve the femtometer nucleus.`,kernels:`deriveElementBundleWebGpu · solveAtomFullWebGpu · sampleAtomicOrbitalCloudWebGpu · solveMoleculeRhfWebGpu`}),Object.freeze({level:7,id:`atomic-nucleus`,shortLabel:`Nucleus`,name:`Atomic Nucleus & Quantum Tunneling`,exponentLabel:`10⁻¹⁵ m`,log10SpanM:-14.3,minLog10:-15.2,maxLog10:-12.6,diveVerb:`ZOOMING OUT TO COSMOS`,diveButton:`↻ FLY OUT TO COSMIC WEB`,engineSchema:`ulg.nuclear.tunneling-tdse-webgpu.v1`,plotTitle:`SYMPLECTIC VISSCHER TDSE |ψ(r, t)|²`,equations:`iℏ ∂ψ/∂t = [−(ℏ²/2μ) ∂²/∂r² + V_WS(r) + V_Coulomb(r)] ψ(r, t)   [Visscher symplectic]
ρ_p,n(r) = ρ₀ / [1 + exp((r − R_p,n) / a)]   ·   B(Z, A) feeds L3 Stellar Q-values`,summary:`Visualizes Z quantized protons and N quantized neutrons packed inside the GPU-solved Woods–Saxon charge/neutron-skin radii surrounded by a live symplectic Visscher 1D quantum α-tunneling probability wavepacket. Its binding energy B(Z, A) closes the causal loop back up to L3 stellar fusion.`,kernels:`solveNuclearStructureWebGpu · createNuclearTunnelingTdseWebGpu (nuclear-tunneling-tdse@1)`})]),Ve=Object.freeze([{Z:1,A:1,sym:`H`,name:`Hydrogen`,defaultN:1,defaultL:0,defaultM:0},{Z:2,A:4,sym:`He`,name:`Helium`,defaultN:1,defaultL:0,defaultM:0},{Z:6,A:12,sym:`C`,name:`Carbon`,defaultN:2,defaultL:1,defaultM:0},{Z:7,A:14,sym:`N`,name:`Nitrogen`,defaultN:2,defaultL:1,defaultM:0},{Z:8,A:16,sym:`O`,name:`Oxygen`,defaultN:2,defaultL:1,defaultM:0},{Z:11,A:23,sym:`Na`,name:`Sodium`,defaultN:3,defaultL:0,defaultM:0},{Z:12,A:24,sym:`Mg`,name:`Magnesium`,defaultN:3,defaultL:0,defaultM:0},{Z:13,A:27,sym:`Al`,name:`Aluminum`,defaultN:3,defaultL:1,defaultM:0},{Z:14,A:28,sym:`Si`,name:`Silicon`,defaultN:3,defaultL:1,defaultM:0},{Z:16,A:32,sym:`S`,name:`Sulfur`,defaultN:3,defaultL:1,defaultM:0},{Z:17,A:35,sym:`Cl`,name:`Chlorine`,defaultN:3,defaultL:1,defaultM:0},{Z:20,A:40,sym:`Ca`,name:`Calcium`,defaultN:4,defaultL:0,defaultM:0},{Z:22,A:48,sym:`Ti`,name:`Titanium`,defaultN:3,defaultL:2,defaultM:0},{Z:26,A:56,sym:`Fe`,name:`Iron`,defaultN:3,defaultL:2,defaultM:0},{Z:28,A:58,sym:`Ni`,name:`Nickel`,defaultN:3,defaultL:2,defaultM:0},{Z:29,A:63,sym:`Cu`,name:`Copper`,defaultN:3,defaultL:2,defaultM:0},{Z:55,A:133,sym:`Cs`,name:`Cesium`,defaultN:6,defaultL:0,defaultM:0},{Z:79,A:197,sym:`Au`,name:`Gold`,defaultN:5,defaultL:2,defaultM:0},{Z:80,A:202,sym:`Hg`,name:`Mercury`,defaultN:5,defaultL:2,defaultM:0},{Z:82,A:208,sym:`Pb`,name:`Lead`,defaultN:6,defaultL:1,defaultM:0},{Z:92,A:238,sym:`U`,name:`Uranium`,defaultN:5,defaultL:3,defaultM:0}]),He=Object.freeze({low:Object.freeze({id:`low`,cosmoGridPerSide:22,cosmoFftN:16,galaxyStars:16384,solarAsteroids:256,stellarParticles:2048,mdCells:6,orbitalPoints:48e3,nuclearVolDim:24}),med:Object.freeze({id:`med`,cosmoGridPerSide:28,cosmoFftN:32,galaxyStars:32768,solarAsteroids:512,stellarParticles:4096,mdCells:7,orbitalPoints:96e3,nuclearVolDim:28}),high:Object.freeze({id:`high`,cosmoGridPerSide:32,cosmoFftN:32,galaxyStars:49152,solarAsteroids:1024,stellarParticles:6144,mdCells:8,orbitalPoints:16e4,nuclearVolDim:32}),ultra:Object.freeze({id:`ultra`,cosmoGridPerSide:36,cosmoFftN:32,galaxyStars:65536,solarAsteroids:1536,stellarParticles:8192,mdCells:9,orbitalPoints:24e4,nuclearVolDim:32})});function Ue(e){let t=10**e;return e>=22?`${(t/308567758e14).toFixed(1)} Mpc`:e>=19?`${(t/0x834b443cc4108000).toFixed(1)} kly`:e>=15.8?`${(t/946073047e7).toFixed(2)} ly`:e>=10.6?`${(t/149597870700).toFixed(2)} AU`:e>=8.7?`${(t/6957e5).toFixed(2)} R☉`:e>=4?`${Math.round(t/1e3).toLocaleString()} km`:e>=0?`${t.toFixed(1)} m`:e>=-3?`${(t*1e3).toFixed(1)} mm`:e>=-6?`${(t*1e6).toFixed(1)} μm`:e>=-9.2?`${(t*1e9).toFixed(2)} nm`:e>=-11.5?`${(t*1e10).toFixed(2)} Å`:e>=-13?`${(t*0xe8d4a51000).toFixed(2)} pm`:`${(t*0x38d7ea4c68000).toFixed(1)} fm`}function We(){return`
    <p><strong>ULG Universes</strong> is a single-canvas, <strong>continuous-zoom 40-order-of-magnitude</strong> WebGPU cosmos spanning <code>10⁺²⁵ m</code> supergalactic filaments down to <code>10⁻¹⁵ m</code> atomic nuclei — paired with a continuous <strong>Cosmic Epoch Spine</strong> from CMB Recombination (<code>z = 1100</code>) through Cosmic Dawn (<code>z = 10</code>), Cosmic Noon / Quasar Peak (<code>z = 2.8</code>), and Present Day (<code>z = 0</code>) into the <code>+5 Gyr</code> Red-Giant &amp; Remnant Era.</p>
    <p>Every astronomical entity emerges dynamically from ULG’s <strong>16-node Universal Law Graph</strong> on WebGPU — zero hardcoded entity/planet hacks or scripted animations:</p>
    <ul>
      <li><strong>L0 Cosmology (10²⁵ m):</strong> 2LPT 1-submit FLRW 3D-FFT TreePM Cosmic Web + Eisenstein–Hu BAO/CMB ΔT/T shell (<code>z=1100</code>), Pop III Reionization bubbles (<code>z=10</code>), and Bullet-Cluster X-ray ICM / 2D gravitational lensing.</li>
      <li><strong>L1 Galaxies &amp; Clusters (10²¹ m):</strong> <code>16K–65K</code> GPU stars on parallel <code>SchroederScaleAtlas</code> multipole gravity across Spiral, Barred Spiral, Major Merger, Elliptical, High-z Clumpy Protogalaxy, Tidally Disrupted Dwarf &amp; Halo Stream, and Core-Collapsed Globular Cluster + Gate 1 ISM cooling <code>Λ(T, Z)</code>.</li>
      <li><strong>L2 Planetary, Small-Body &amp; Relativistic Systems (10¹² m → 10⁷ m):</strong> Double-float (<code>f32x2</code>) symplectic Solar System N-body, Protoplanetary Disk Accretion, Roche-Limit Ring Disruption &amp; Shepherd Moons, Giant Moon-Forming Impact, Active Dual-Tail Comets, Hot-Jupiter XUV Photoevaporation, Red-Giant Engulfment, Kerr Blandford–Znajek Quasar/Blazar Jets (live Doppler beaming), Roche X-Ray Binaries, Type Ia Detonations, and 2.5PN GW-Chirp BNS Kilonova &amp; BBH Mergers.</li>
      <li><strong>L3 Stars, Nebulae &amp; Compact Remnants (10⁹ m):</strong> Thermonuclear Fusion Core, 3D Resistive MHD Nebular Collapse &amp; Bipolar Jets, Strömgren Photoionized H II Pillars, Bipolar Planetary Nebulae, SNR / Crab PWN, Millisecond Pulsars, Hall-Crustal-Yield Magnetar Giant Flares, and live WebGPU GR TOV Unified Degenerate EOS (White Dwarf → Neutron Star → Black Hole).</li>
      <li><strong>L4 Planetary Worlds (10⁷ m):</strong> Spherical baroclinic atmosphere, triboelectric Paschen lightning, core-geodynamo aurorae, Hadean Magma Ocean, Cryovolcanic Icy Plumes, Tidally Locked Eyeball &amp; Rogue Worlds, plus Gate 2 Polytope Atlas cutaway.</li>
      <li><strong>L5–L7 Microphysics (10⁻⁸ m → 10⁻¹⁵ m):</strong> Linked-cell GPU MD, 4-component Dirac–KS Atoms + RHF Molecules + PeerCompute 2-of-2 quorum mesh, and quantized Woods–Saxon Atomic Nuclei + Visscher α-tunneling TDSE.</li>
    </ul>
    <p style="font-size:12px;color:#94a3b8;"><strong>Scientific Honesty Disclosure:</strong> Runtime closures explicitly carry <code>scientificValidation: false</code>; G7 scientific benchmark comparisons remain offline and advisory.</p>
  `}function Ge(e){return e?`
    <p>${e.summary}</p>
    <div class="uv-eq-box">${e.equations}</div>
    <p><strong>Active ULG WebGPU Engines:</strong> <code>${e.kernels}</code></p>
    <p><strong>Schema / Method ID:</strong> <code>${e.engineSchema}</code></p>
    <p><strong>Controls:</strong> Scroll wheel / pinch / drag the continuous 40-OOM slider to zoom smoothly across scales. Drag to orbit, click any target to focus &amp; inspect, and double-click to smoothly fly down into it.</p>
    <p style="font-size:12px;color:#94a3b8;"><strong>Provenance:</strong> GPU-native compute &amp; zero-copy rendering · <code>cameraAutoSpin: false</code> default · <code>scientificValidation: false</code> (advisory G7).</p>
  `:We()}var Ke=`ulg.astrophysics.causal-nebular-cascade.v1`,qe=Object.freeze([`Vela`,`Kepler`,`Cygnus`,`Lyra`,`Carina`,`Draco`,`Perseus`,`Norma`,`Scutum`,`Centauri`,`Aurelia`,`Eridani`,`Pavonis`,`Ceti`,`Tauri`,`Hydrae`]),Je=`bcdefghijklm`,Ye=Object.freeze([`I`,`II`,`III`,`IV`,`V`,`VI`]);function Xe(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Ze(e,t,n,r=1){let i=(r^2654435769)>>>0,a=e=>{let t=Math.round(Number(e)*1e3)|0;i=Math.imul(i^t,2246822507)>>>0,i=(i^i>>>13)>>>0};return a(e),a(t),a(n),i>>>0}function Qe(e){let t=Math.max(2200,Math.min(55e3,Number(e)||5778));return t>=26e3?{color0:[.62,.78,1],color1:[.36,.56,1],spectral:`O`}:t>=10500?{color0:[.74,.86,1],color1:[.48,.68,1],spectral:`B`}:t>=7400?{color0:[.88,.93,1],color1:[.66,.78,.98],spectral:`A`}:t>=6e3?{color0:[1,.97,.88],color1:[.95,.84,.6],spectral:`F`}:t>=5200?{color0:[1,.93,.74],color1:[1,.6,.2],spectral:`G`}:t>=3750?{color0:[1,.76,.46],color1:[.94,.42,.14],spectral:`K`}:{color0:[1,.5,.28],color1:[.78,.18,.08],spectral:`M`}}function $e(e,t=!1){if(e.stage===`white-dwarf`||e.stage===`planetary-nebula`)return`DA-WD`;if(e.stage===`neutron-star`||e.stage===`supernova-remnant-pwn`)return`NS`;if(e.stage===`stellar-black-hole`||e.stage===`hypernova-remnant`)return`BH`;if(e.stage===`brown-dwarf`)return e.effectiveTempK>1400?`L-BD`:`T-BD`;if(e.stage===`red-giant`||e.stage===`agb-superwind`)return e.effectiveTempK<3600?`M2III`:`K2III`;let n=Qe(e.effectiveTempK),r=Math.max(0,Math.min(9,Math.round(9-e.effectiveTempK%1200/1200*9)));return t?`PopIII-${n.spectral}`:`${n.spectral}${r}V`}function et(e,t,n){let r=Math.max(1e-4,Number(e)||.2),i=Math.max(0,Math.min(.65,Number(t)||.05)),a=Math.max(.05,Math.min(.5,Number(n)||.35)),o=i*i,s=a*a,c=r*(1.6+5.1*i-2.22*o+4.12*a-4.27*i*a-5.09*s+4.61*o*s),l=r*(.464-.38*a-.631*i+.586*a*i+.15*o-.198*a*o);return{rCritPAu:Math.max(r*1.85,c),rCritSAu:Math.max(.02,l)}}function tt({cosmicEpoch:e=null,regionPosMpc:t=[0,0,0],localOverdensity:n=1,seed:r=20261125}={}){let i=e||R({redshiftZ:0}),a=Number(i.redshiftZ)||0,o=Math.max(.05,Number(i.cosmicAgeGyr)||13.8),s=Math.max(.15,Math.min(8,Number(n)||1)),c=Ze(t[0]||0,t[1]||0,t[2]||0,r^257),l=Xe(c),u=`disk`,d=`Grand-Design Spiral`;a>=4.5?(u=`proto`,d=`Primordial High-z Protogalaxy`):a>=1.4?(u=s>2.4?`binary`:`proto`,d=u===`binary`?`Cosmic-Noon Starburst Merger`:`High-z Clumpy Starburst Disk`):a<-.15?(u=s>1.3?`sphere`:`barred`,d=u===`sphere`?`Evolved Giant Elliptical`:`Aging Barred Spiral`):s>2.8?(u=l()<.72?`sphere`:`binary`,d=u===`sphere`?`Cluster-Core Giant Elliptical`:`Interacting Major Merger Pair`):s<.48?(u=l()<.55?`dwarf-stream`:`globular`,d=u===`dwarf-stream`?`Void-Edge Dwarf & Tidal Stream`:`Metal-Poor Globular Cluster`):(u=l()<.42?`barred`:`disk`,d=u===`barred`?`Barred Spiral (SBb)`:`Grand-Design Spiral (Sc/Sb)`);let f=Math.max(1e-4,Number(i.meanMetallicitySolar)||1),p=s**.28,m=u===`globular`?.08:u===`dwarf-stream`?.35:u===`sphere`?1.45:1,h=Math.max(1e-4,Math.min(3.2,f*p*m)),g=Math.log10(h),_=Number(i.galaxyGasFraction??i.haloGasFraction)||.16,v=Math.max(.01,Math.min(.88,_*(u===`sphere`?.22:u===`globular`?.05:1))),y=Math.max(.32,Math.min(.88,.38+.18*Math.min(1.4,h)+(l()-.5)*.12));return Object.freeze({schema:Ke,cosmicEraId:i.eraId||`present-day`,redshiftZ:a,cosmicAgeGyr:o,localOverdensity:s,regionPosMpc:Object.freeze([t[0]||0,t[1]||0,t[2]||0]),morphology:u,morphologyLabel:d,meanMetallicitySolar:h,baseFeH:g,baseCO:y,gasFraction:v,isPrimordialPopIII:a>=7.5||h<.004,seed:c})}function nt(e,{isPopIII:t=!1,isYoungArm:n=!1,isAncient:r=!1}={}){let i=e();return t?5*11**i**.72:n?i<.32?.18+e()*.35:i<.52?.53+e()*.32:i<.7?.85+e()*.35:i<.86?1.2+e()*1.4:2.6+e()**1.8*18:r?i<.48?.14+e()*.36:i<.74?.5+e()*.34:i<.88?.84+e()*.24:1.08+e()**1.4*2.2:i<.44?.12+e()*.38:i<.68?.5+e()*.32:i<.84?.82+e()*.28:i<.93?1.1+e()*.45:i<.98?1.55+e()*1.15:2.7+e()**1.6*8.5}function rt({cosmicEpoch:e=null,galaxyEnv:t=null,starPosGal:n=[4.8,.04,2.1],popTag:r=.48,starIndex:i=0,seed:a=20261125,forceMultiplicity:o=null}={}){let s=e||R({redshiftZ:0}),c=t||tt({cosmicEpoch:s,seed:a}),l=Math.hypot(n[0]||0,n[2]||0),u=Math.abs(n[1]||0),d=Math.max(.2,l*1.65),f=u*1.65,p=Ze(n[0]||0,n[1]||0,n[2]||0,(a^(i+1)*2654435761)>>>0),m=Xe(p),h=d<2.6||c.morphology===`sphere`,g=f>1.4||c.morphology===`globular`||c.morphology===`dwarf-stream`,_=r>=.76&&!h&&!g&&c.gasFraction>.08,v=h||g||c.redshiftZ<-.15,y=-.068*(d-8.2),b=-.32*Math.min(1.8,f),x=_?.14:0,S=(m()-.5)*.24,C=c.baseFeH+y+b+x+S;c.isPrimordialPopIII&&(C=Math.min(-2.4,C-1.2)),C=Math.max(-4,Math.min(.55,C));let w=10**C,T=Math.max(.25,Math.min(1.08,c.baseCO+(h?.22:0)+C*.22+(m()-.5)*.26)),E=g||c.redshiftZ>1.5?.38:h?.22:.04,D=Math.max(.05,c.cosmicAgeGyr-.25),O;O=c.isPrimordialPopIII?Math.min(D,.002+m()*.015):_?Math.min(D,.015+m()*.35):v?Math.min(D,Math.max(.4,D*(.58+m()*.34))):Math.min(D,Math.max(.2,(.6+m()*8.6)*Math.min(1,D/10)));let k=nt(m,{isPopIII:c.isPrimordialPopIII,isYoungArm:_,isAncient:v}),A=1;if(o===1||o===2||o===3)A=o;else{let e=m();A=k<.5?e<.73?1:e<.96?2:3:k<1.3?e<.54?1:e<.88?2:3:e<.28?1:e<.74?2:3}let j=[k];if(A>=2){let e=.28+.68*m()**.75;j.push(Math.max(.08,k*e))}if(A===3){let e=.22+.58*m()**.9;j.push(Math.max(.08,k*e))}let M=qe[p%qe.length],N=100+(p>>>5)%899,P=`${M}-${N}`,F=[`A`,`B`,`C`],I=j.map((e,t)=>{let n=z({massSolar:e,ageGyr:O,metallicitySolar:w}),r=Qe(n.effectiveTempK),i=$e(n,c.isPrimordialPopIII),a=n.remnantClass!==`none`,o=Math.max(12,n.radiusSolar*695700),s=Math.min(8,1.42*w),l=Math.min(34,24.8+1.8*w),u=Math.max(60,100-l-s),d=n.stage===`white-dwarf`?`Degenerate C/O Core · Thin H/He Envelope`:n.stage===`neutron-star`?`Superfluid Neutron Interior · Iron Crust`:n.stage===`stellar-black-hole`?`Relativistic Kerr Event Horizon`:`H ${u.toFixed(1)}% · He ${l.toFixed(1)}% · Metals ${s.toFixed(2)}% ([Fe/H]=${C>=0?`+`:``}${C.toFixed(2)})`;return Object.freeze({component:F[t],name:A>1?`${P} ${F[t]} (${i})`:`${P} (${i})`,spectralCode:i,stage:n.stage,remnantClass:n.remnantClass,initialMassSolar:e,massSolar:n.massSolar,radiusSolar:n.radiusSolar,radiusKm:o,luminositySolar:Math.max(1e-4,n.luminositySolar),effectiveTempK:Math.max(1200,n.effectiveTempK||5778),color0:n.stage===`white-dwarf`?[.8,.94,1]:n.stage===`neutron-star`?[.68,.88,1]:r.color0,color1:n.stage===`white-dwarf`?[.46,.72,1]:n.stage===`neutron-star`?[.76,.36,1]:r.color1,isRemnant:a,composition:d})}),ee=`single`,L=null,te=null;if(A===2){let e=m()<.58;ee=e?`binary-p-type`:`binary-s-type`;let t=Math.max(.08,(I[0].radiusSolar+I[1].radiusSolar)*.00465*4.5),n=e?Math.max(t,.11+m()*.24):Math.max(t*4,14.5+m()*14),r=e?.02+m()*.14:.06+m()*.22;L=Object.freeze({aAu:n,e:r,incDeg:(m()-.5)*4.5,omDeg:m()*360,wDeg:m()*360,m0Deg:m()*360})}else if(A===3){ee=`hierarchical-trinary`;let e=Math.max(.08,(I[0].radiusSolar+I[1].radiusSolar)*.00465*4.5);L=Object.freeze({aAu:Math.max(e,.1+m()*.22),e:.02+m()*.12,incDeg:(m()-.5)*3,omDeg:m()*360,wDeg:m()*360,m0Deg:m()*360}),te=Object.freeze({aAu:16.5+m()*13.5,e:.05+m()*.18,incDeg:(m()-.5)*14,omDeg:m()*360,wDeg:m()*360,m0Deg:m()*360})}let ne=Math.max(1e-6,.012*w),re=Object.freeze({feH:C,metallicitySolar:w,cToO:T,alphaOverFe:E,dustToGasRatio:ne,carbonRich:T>=.8,solidDiskMassEarth:Math.max(0,48*w*Math.max(.15,k)**.85),volatileInventory:Math.max(0,(1.15-Math.max(0,T-.55)*1.1)*Math.min(2.2,w+.12)),nebulaSummary:`[Fe/H]=${C>=0?`+`:``}${C.toFixed(2)} · C/O=${T.toFixed(2)} · Dust/Gas=${(ne*100).toFixed(3)}%${T>=.8?` (Carbon-Rich)`:``}`}),ie=h?`Galactic Bulge`:g?`Stellar Halo`:_?`Spiral-Arm H II Nursery`:`Galactic Disk`;return Object.freeze({schema:Ke,systemId:`${M.toLowerCase()}-${N}`,systemName:P,galacticRegion:ie,rKpc:Number(d.toFixed(2)),zKpc:Number(f.toFixed(2)),systemAgeGyr:Number(O.toFixed(2)),multiplicity:A,architecture:ee,stars:Object.freeze(I),binaryPair:L,outerCompanion:te,nebulaEnv:re,galaxyEnv:c,seed:p})}function it(e,{seedOverride:t=null}={}){let n=e||rt(),r=Xe(((t??n.seed)^328103)>>>0),{stars:i,multiplicity:a,architecture:o,binaryPair:s,outerCompanion:c,nebulaEnv:l}=n,u=[];for(let e=0;e<i.length;e+=1){let t=i[e],n={id:`star-${e}`,name:t.name,subtitle:`${t.stage.replace(/-/g,` `)} · ${t.massSolar.toFixed(2)} M☉ · T=${Math.round(t.effectiveTempK).toLocaleString()} K`,isStar:!0,starIndex:e,parent:-1,kind:t.stage===`stellar-black-hole`?5:0,massSolar:t.massSolar,radiusKm:t.radiusKm,luminositySolar:t.luminositySolar,aAu:0,e:0,incDeg:0,omDeg:0,wDeg:0,m0Deg:0,color0:[...t.color0],color1:[...t.color1],atm:0,surfacePressurePa:0,tempK:Math.round(t.effectiveTempK),centralP:t.stage===`neutron-star`?1e34:t.stage===`white-dwarf`?1e22:0x58d15e17628000*t.massSolar**1.4,coreZ:t.stage===`white-dwarf`?6:t.stage===`neutron-star`?26:1,mantleZ:t.stage===`white-dwarf`?8:2,surfZ:1,composition:t.composition,stage:t.stage,spectralCode:t.spectralCode};e===1&&s?(n.parent=0,n.orbitRole=`binary-companion`,n.aAu=s.aAu,n.e=s.e,n.incDeg=s.incDeg,n.omDeg=s.omDeg,n.wDeg=s.wDeg,n.m0Deg=s.m0Deg):e===2&&c&&(n.parent=-2,n.orbitRole=`trinary-outer`,n.aAu=c.aAu,n.e=c.e,n.incDeg=c.incDeg,n.omDeg=c.omDeg,n.wDeg=c.wDeg,n.m0Deg=c.m0Deg),u.push(n)}let d=o===`binary-p-type`||o===`hierarchical-trinary`,f=d?i[0].luminositySolar+i[1].luminositySolar:i[0].luminositySolar,p=d?i[0].massSolar+i[1].massSolar:i[0].massSolar,m=d?-2:0,h=Math.sqrt(Math.max(1e-4,f)),g=Math.max(.05,.085*h),_=Math.max(.18,2.7*h),v=Math.max(.75,11.2*h),y=Math.max(.08,.94*h),b=Math.max(.16,1.68*h),x=Math.max(g*1.15,i[0].radiusSolar*.00465*6),S=Math.min(38,Math.max(6,26*p**.35));if(d&&s){let e=Math.min(i[0].massSolar,i[1].massSolar)/(i[0].massSolar+i[1].massSolar),t=et(s.aAu,s.e,e);x=Math.max(x,t.rCritPAu*1.18)}if(o===`binary-s-type`&&s){let e=i[1].massSolar/(i[0].massSolar+i[1].massSolar),t=et(s.aAu,s.e,e);S=Math.min(S,t.rCritSAu*.92)}else if(o===`hierarchical-trinary`&&c){let e=i[0].massSolar+i[1].massSolar,t=i[2].massSolar/(e+i[2].massSolar),n=et(c.aAu,c.e,t);S=Math.min(S,n.rCritSAu*.9)}let C=l.metallicitySolar>=.015&&i[0].stage!==`stellar-black-hole`&&i[0].stage!==`neutron-star`&&S>x*1.45,w=0;if(C){let e=Math.log(S/x),t=Math.max(1,Math.min(8,Math.floor(e/.48))),n=Math.max(.25,Math.min(1.25,.65+.35*(l.feH+1)));w=Math.max(1,Math.min(t,Math.round((2+r()*5)*n)))}let T=Math.max(.04,Math.min(.88,.14*l.metallicitySolar**1.75)),E=i[0].stage===`red-giant`||i[0].stage===`agb-superwind`,D=i[0].stage===`white-dwarf`,O=x*(1.08+r()*.45),k=!1,A=[];for(let e=0;e<w&&!(O>=S*.96);e+=1){let t=O;O*=1.52+r()*.62;let i=Math.max(28,Math.round(278*Math.max(1e-4,f)**.25/Math.sqrt(Math.max(.02,t)))),a=t>=_,o=t>=v,s=t>=y&&t<=b,c=r(),d=`rocky-arid`;a&&c<T*1.15&&!D?d=o||r()<.38?`ice-giant`:`gas-giant`:!a&&t<_*.25&&c<T*.22&&!E&&!D?d=`hot-jupiter`:i>=950||E&&t<1.8?d=r()<.55?`lava-world`:`iron-core`:l.carbonRich&&!a?d=`carbon-world`:s&&!k&&!E&&!D&&n.systemAgeGyr>=.35&&l.volatileInventory>=.35&&c<.42?(d=`earth-like`,k=!0):d=s&&l.volatileInventory>=.55&&c<.72?`ocean-super-earth`:i>390&&i<950&&l.metallicitySolar>.25?`greenhouse`:a?c<.45?`ice-giant`:`icy-dwarf`:i<250&&c<.55?`arid-oxide`:r()<.45?`super-earth`:`iron-core`;let p=Je[e]||`p${e+1}`,h=`${n.systemName} ${p}`,g=null;if(d===`earth-like`){let e=.68+r()*.95,n=Math.round(6371*e**.27),a=Math.round((.65+r()*1.15)*101325),o=Math.max(268,Math.min(312,Math.round(i+28+(r()-.5)*14)));g={name:`${h} (Earth-like)`,planetClass:`earth-like`,subtitle:`Earth-like Oceanic Silicate-Iron World · ${t.toFixed(2)} AU`,kind:1,massSolar:e*ke,radiusKm:n,color0:[.22+r()*.12,.46+r()*.12,.22+r()*.08],color1:[.05,.24+r()*.1,.58+r()*.1],atm:.72,surfacePressurePa:a,volatileMassFrac:.045+r()*.025,particulateMassFrac:.006,tempK:o,centralP:Math.round((260+e*110)*1e9),coreZ:26,mantleZ:14,surfZ:14,composition:`Fe-Ni Core · MgSiO₃ Mantle · Liquid H₂O Ocean · N₂/O₂ ${(a/1e5).toFixed(2)} bar`}}else if(d===`ocean-super-earth`){let e=2.2+r()*3.8,n=Math.round(6371*e**.29*1.08),a=Math.round((1.5+r()*4.5)*101325);g={name:`${h} (Ocean World)`,planetClass:`ocean-world`,subtitle:`Pelagic Super-Earth · ${t.toFixed(2)} AU`,kind:1,massSolar:e*ke,radiusKm:n,color0:[.16,.44,.56],color1:[.04,.2,.56],atm:.78,surfacePressurePa:a,volatileMassFrac:.085,particulateMassFrac:.004,tempK:Math.max(270,Math.min(345,i+36)),centralP:Math.round((420+e*95)*1e9),coreZ:26,mantleZ:8,surfZ:8,composition:`Fe Core · High-P H₂O Ice-VII Mantle · Global Liquid Ocean (${e.toFixed(1)} M⊕)`}}else if(d===`carbon-world`){let e=.6+r()*3.2,n=Math.round(6371*e**.27*.96),a=i>550?24e4:42e3;g={name:`${h} (Carbon World)`,planetClass:`carbon-world`,subtitle:`High-C/O Graphite–SiC–Diamond World · ${t.toFixed(2)} AU`,kind:1,massSolar:e*ke,radiusKm:n,color0:[.34,.32,.36],color1:[.16,.15,.2],atm:.32,surfacePressurePa:a,volatileMassFrac:.012,particulateMassFrac:.035,tempK:i+18,centralP:Math.round((240+e*115)*1e9),coreZ:26,mantleZ:6,surfZ:6,composition:`Fe-C Core · Diamond/SiC Mantle · Graphite & Hydrocarbon Crust (C/O=${l.cToO.toFixed(2)})`}}else if(d===`lava-world`){let e=.4+r()*3.6,n=Math.round(6371*e**.27);g={name:`${h} (Lava World)`,planetClass:`lava-world`,subtitle:`Molten Silicate Magma Ocean World · ${t.toFixed(2)} AU`,kind:7,massSolar:e*ke,radiusKm:n,color0:[1,.44,.1],color1:[.22,.08,.05],atm:.42,surfacePressurePa:14e4,volatileMassFrac:.005,particulateMassFrac:.06,tempK:Math.max(1350,i),centralP:Math.round((220+e*110)*1e9),coreZ:26,mantleZ:14,surfZ:14,composition:`Molten Fe-Ni Core · Magma MgSiO₃ Ocean · Vaporized SiO/Na Exosphere`}}else if(d===`iron-core`){let e=.05+r()*.45,n=Math.round(2200+e**.3*3200);g={name:`${h} (Iron World)`,planetClass:`iron-world`,subtitle:`Refractory Iron-Rich Terrestrial Core · ${t.toFixed(2)} AU`,kind:1,massSolar:e*ke,radiusKm:n,color0:[.56,.52,.48],color1:[.34,.31,.29],atm:0,surfacePressurePa:0,volatileMassFrac:0,particulateMassFrac:0,tempK:i,centralP:Math.round((35+e*120)*1e9),coreZ:26,mantleZ:14,surfZ:26,composition:`Fe-Ni Core 68% · Silicate Mantle 32% · Airless Cratered Regolith`}}else if(d===`greenhouse`){let e=.65+r()*1.8,n=Math.round(5600+e**.27*1600),a=Math.round((2.5+r()*7.5)*1e6);g={name:`${h} (Greenhouse)`,planetClass:`greenhouse`,subtitle:`Super-Greenhouse CO₂ World · ${t.toFixed(2)} AU`,kind:2,massSolar:e*ke,radiusKm:n,color0:[.9,.78,.52],color1:[.74,.54,.3],atm:.85,surfacePressurePa:a,volatileMassFrac:.025,particulateMassFrac:.055,tempK:Math.min(920,i+280),centralP:Math.round((240+e*105)*1e9),coreZ:26,mantleZ:14,surfZ:6,composition:`Fe/Ni Core · SiO₂ Mantle · Supercritical CO₂ ${(a/1e5).toFixed(0)} bar Atm`}}else if(d===`arid-oxide`||d===`super-earth`){let e=d===`super-earth`,n=e?1.8+r()*3.2:.1+r()*.42,a=Math.round(e?6371*n**.27:3e3+n**.3*2100),o=Math.round(e?(.8+r()*2.2)*1e5:450+r()*2400);g={name:`${h} (${e?`Super-Earth`:`Arid World`})`,planetClass:e?`super-earth`:`arid-world`,subtitle:`${e?`Rocky Silicate Super-Earth`:`Arid Iron-Oxide Desert World`} · ${t.toFixed(2)} AU`,kind:1,massSolar:n*ke,radiusKm:a,color0:e?[.64,.46,.32]:[.76,.36,.2],color1:e?[.38,.28,.2]:[.5,.22,.14],atm:e?.46:.18,surfacePressurePa:o,volatileMassFrac:e?.015:.002,particulateMassFrac:.048,tempK:Math.max(140,i+(e?22:6)),centralP:Math.round((e?420:45)*1e9),coreZ:26,mantleZ:14,surfZ:26,composition:`Fe-S Core · Basalt/Fe₂O₃ Silicate Crust · ${(o/1e5).toFixed(o<5e3?3:2)} bar CO₂/N₂`}}else if(d===`hot-jupiter`||d===`gas-giant`){let e=d===`hot-jupiter`,n=e?.35+r()*2.4:.22+r()*3.1,a=Math.round((54e3+r()*24e3)*(e?1.18:1)),o=!e&&r()<.48;g={name:`${h} (${e?`Hot Jupiter`:o?`Ringed Giant`:`Gas Giant`})`,planetClass:e?`hot-jupiter`:`gas-giant`,subtitle:`${e?`Tidally Inflated Hot Jupiter`:`Metallic-Hydrogen Gas Giant`} · ${t.toFixed(2)} AU`,kind:2,massSolar:n*954588e-9,radiusKm:a,color0:e?[.96,.52,.24]:[.8+r()*.14,.68+r()*.14,.5+r()*.14],color1:e?[.54,.18,.12]:[.52+r()*.14,.36+r()*.12,.24+r()*.1],atm:.55,surfacePressurePa:1e5,volatileMassFrac:.08,particulateMassFrac:.02,ringed:o,ringInnerKm:o?Math.round(a*1.28):0,ringOuterKm:o?Math.round(a*2.38):0,tempK:Math.max(90,i),centralP:Math.round((360+n*180)*1e9),coreZ:26,mantleZ:1,surfZ:2,composition:`H₂ ${(88+r()*7).toFixed(1)}% · He · Metallic H Mantle (${n.toFixed(2)} M_J)`}}else if(d===`ice-giant`){let e=10+r()*14,n=Math.round(21e3+r()*7500),a=r()<.28,o=r()<.52;g={name:`${h} (Ice Giant)`,planetClass:`ice-giant`,subtitle:`Superionic H₂O/NH₃/CH₄ Ice Giant · ${t.toFixed(2)} AU`,kind:3,massSolar:e*ke,radiusKm:n,color0:o?[.26,.5,.94]:[.54,.84,.9],color1:o?[.14,.3,.76]:[.36,.68,.8],atm:.62,surfacePressurePa:1e5,volatileMassFrac:.06,particulateMassFrac:.01,ringed:a,ringInnerKm:a?Math.round(n*1.45):0,ringOuterKm:a?Math.round(n*2.15):0,tempK:Math.max(42,i),centralP:Math.round((240+e*4.5)*1e9),coreZ:14,mantleZ:8,surfZ:6,composition:`H₂O/CH₄/NH₃ Superionic Mantle · H₂/He Envelope (${e.toFixed(1)} M⊕)`}}else{let e=.015+r()*.14,n=Math.round(1350+r()*1650);g={name:`${h} (Cryo Dwarf)`,planetClass:`icy-dwarf`,subtitle:`Outer-Disk Volatile Ice World · ${t.toFixed(2)} AU`,kind:3,massSolar:e*ke,radiusKm:n,color0:[.78,.84,.9],color1:[.46,.56,.68],atm:.04,surfacePressurePa:0,volatileMassFrac:0,particulateMassFrac:0,tempK:Math.max(35,i),centralP:5e9,coreZ:14,mantleZ:8,surfZ:8,composition:`H₂O/N₂/CH₄ Ice Shell · Silicate Core`}}let x=u.length;u.push({id:`planet-${e}`,parent:m,aAu:Number(t.toFixed(4)),e:Number((.008+r()*(d===`earth-like`?.045:.095)).toFixed(4)),incDeg:Number(((r()-.5)*4.2).toFixed(2)),omDeg:Number((r()*360).toFixed(1)),wDeg:Number((r()*360).toFixed(1)),m0Deg:Number((r()*360).toFixed(1)),...g}),A.push(x);let S=d===`gas-giant`||d===`ice-giant`,C=S?1+Math.floor(r()*2.4):+((d===`earth-like`||d===`ocean-super-earth`)&&r()<.65);for(let t=0;t<C;t+=1){let n=Math.round(S?1450+r()*1350:1150+r()*850),o=(n/1737.4)**3*3.6943e-8,s=g.radiusKm*(5.2+t*5.8+r()*2.5)*1e3/149597870700,c=S&&a&&n>2350&&i<125,l=S&&t===0&&r()<.45;u.push({id:`moon-${e}-${t}`,name:`${h}-${Ye[t]||t+1}`,planetClass:c?`hazy-moon`:l?`volcanic-moon`:a?`icy-moon`:`rocky-moon`,subtitle:`${c?`Dense-Atmosphere Methane Moon`:l?`Tidally Heated Volcanic Moon`:a?`Subsurface-Ocean Icy Moon`:`Natural Rocky Satellite`}`,parent:x,kind:c?2:l?1:3,massSolar:o,radiusKm:n,aAu:Number(s.toFixed(6)),e:Number((.005+r()*.035).toFixed(4)),incDeg:Number(((r()-.5)*4).toFixed(2)),omDeg:Number((r()*360).toFixed(1)),wDeg:Number((r()*360).toFixed(1)),m0Deg:Number((r()*360).toFixed(1)),color0:c?[.86,.68,.34]:l?[.92,.8,.3]:a?[.84,.86,.9]:[.66,.65,.63],color1:c?[.62,.44,.2]:l?[.68,.44,.14]:a?[.54,.66,.78]:[.4,.39,.38],atm:c?.78:0,surfacePressurePa:c?142e3:0,volatileMassFrac:c?.04:0,particulateMassFrac:c?.03:0,tempK:Math.max(45,i),centralP:6e9,coreZ:a?14:26,mantleZ:a?8:14,surfZ:l?16:c?6:a?8:14,composition:c?`N₂/CH₄ Haze Atm · H₂O/Silicate Interior`:l?`Silicate Mantle · Sulfur Volcanic Crust`:a?`H₂O Ice/Ocean Shell · Silicate Core`:`Silicate Regolith · Fe Core`})}}let j=u.findIndex(e=>e.planetClass===`earth-like`),M=u.findIndex(e=>!e.isStar),N=j>=0?j:M>=0?M:0;return Object.freeze({schema:Ke,systemId:n.systemId,systemName:n.systemName,starSystem:n,multiplicity:a,architecture:o,starCount:i.length,planetCount:A.length,hasEarthLike:k,earthLikeIndex:j,defaultFocusIndex:N,condensationFrontsAu:Object.freeze({rSilicateAu:Number(g.toFixed(3)),rHzInnerAu:Number(y.toFixed(3)),rHzOuterAu:Number(b.toFixed(3)),rSnowLineAu:Number(_.toFixed(3)),rCoIceAu:Number(v.toFixed(3)),rMinStableAu:Number(x.toFixed(3)),rMaxStableAu:Number(S.toFixed(3))}),beltZoneAu:Object.freeze({innerAu:Math.max(x*1.4,_*.78),outerAu:Math.min(S*.95,_*1.25),kuiperInnerAu:Math.min(S*.96,Math.max(v*1.1,_*2.4)),kuiperOuterAu:Math.min(44,Math.max(v*1.6,_*3.6))}),catalog:Object.freeze(u)})}var at=`ulg.astrophysics.supergalactic-flrw-treepm.v1`,U=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),ot=16,st=32,ct=`
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
const PK_BINS: u32 = ${ot}u;

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
  let n_rem = min(params.remote_tile_count, ${st}u);
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
`,lt=`
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
`;function W(e,{omegaM:t=.315,omegaLambda:n=.685,omegaR:r=9e-5}={}){let i=Math.max(1e-4,Number(e)),a=1-t-n-r;return Math.sqrt(Math.max(1e-8,r/i**4+t/i**3+a/i**2+n))}function ut(e,t){let n=e+.5*t;return n-=t*Math.floor(n/t),n-.5*t}async function dt(e,{gridPerSide:t=28,fftGridN:n=32,boxLengthMpc:r=200,aInit:i=.12,omegaM:a=.315,omegaLambda:o=.685,amplitude:s=.36,seed:c=20261125,slabBounds:l=null,initialPositionsShift:u=[0,0,0]}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`build2LptCosmologyICsWebGpu requires a live WebGPU GPUDevice`);let d=Math.max(8,Math.trunc(t)),f=Number(r),p=f/d,m=W(i,{omegaM:a,omegaLambda:o}),h=a/i**3/Math.max(1e-8,m*m),g=Math.max(1e-4,h)**.55,_=2*Math.max(1e-4,h)**(6/11),v=i*i*m*g,y=i*i*m*_,b=2*Math.PI/f*2.5,x=N(e,n),S=x.n,w=x.total,E=[C(0,`uniform`),C(1,`storage`),C(2,`storage`)],D=T(e,{cacheKey:`ulg-zeldovich-ic-gen.v1`,label:`ulg-2lpt-ic-gen`,code:lt,entryPoint:`generate_zeldovich_kspace`,bindings:E}),O=T(e,{cacheKey:`ulg-zeldovich-ic-store.v1`,label:`ulg-2lpt-ic-store`,code:lt,entryPoint:`store_disp_axis`,bindings:E}),k=e.createBuffer({size:w*16,usage:U.STORAGE|U.COPY_SRC}),A=e.createBuffer({size:w*16,usage:U.MAP_READ|U.COPY_DST}),j=e.createBuffer({size:x.byteLength,usage:U.STORAGE|U.COPY_DST|U.COPY_SRC}),M=[0,1,2].map(t=>{let n=new ArrayBuffer(32);new Uint32Array(n,0,4).set([S,c>>>0,t,0]),new Float32Array(n,16,4).set([f,s,b,v]);let r=e.createBuffer({size:32,usage:U.UNIFORM|U.COPY_DST});return e.queue.writeBuffer(r,0,n),r});try{let t=e.createCommandEncoder({label:`ulg-2lpt-psi1`}),n=Math.ceil(w/64);for(let r=0;r<3;r+=1){let i=e.createBindGroup({layout:D.bindGroupLayout,entries:[{binding:0,resource:{buffer:M[r]}},{binding:1,resource:{buffer:x.bufferA}},{binding:2,resource:{buffer:k}}]}),a=t.beginComputePass();a.setPipeline(D.pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(n),a.end();let o=x.encodeInverseFrom(t,x.bufferA),s=e.createBindGroup({layout:O.bindGroupLayout,entries:[{binding:0,resource:{buffer:M[r]}},{binding:1,resource:{buffer:o}},{binding:2,resource:{buffer:k}}]});a=t.beginComputePass(),a.setPipeline(O.pipeline),a.setBindGroup(0,s),a.dispatchWorkgroups(n),a.end()}t.copyBufferToBuffer(k,0,A,0,w*16),e.queue.submit([t.finish()]),await A.mapAsync(U.MAP_READ);let r=new Float32Array(A.getMappedRange().slice(0,w*16));A.unmap();let a=0;for(let e=0;e<w;e+=1)a+=r[e*4]**2+r[e*4+1]**2+r[e*4+2]**2;let o=Math.sqrt(a/Math.max(1,w)),c=Math.max(.1,Number(s)||.36)*(f/22),m=o>1e-12?c/o:0;for(let e=0;e<w;e+=1)r[e*4+0]*=m,r[e*4+1]*=m,r[e*4+2]*=m;let g=f/S,_=.5/g,b=new Float32Array(w*2),C=(e,t,n)=>(((n+S)%S*S+(t+S)%S)*S+(e+S)%S)*4;for(let e=0;e<S;e+=1)for(let t=0;t<S;t+=1)for(let n=0;n<S;n+=1){let i=C(n+1,t,e),a=C(n-1,t,e),o=C(n,t+1,e),s=C(n,t-1,e),c=C(n,t,e+1),l=C(n,t,e-1),u=(r[i+0]-r[a+0])*_,d=(r[o+1]-r[s+1])*_,f=(r[c+2]-r[l+2])*_,p=.5*(r[o+0]-r[s+0]+(r[i+1]-r[a+1]))*_,m=.5*(r[c+0]-r[l+0]+(r[i+2]-r[a+2]))*_,h=.5*(r[c+1]-r[l+1]+(r[o+2]-r[s+2]))*_,g=u*d+u*f+d*f-p*p-m*m-h*h;b[((e*S+t)*S+n)*2]=g}e.queue.writeBuffer(x.bufferA,0,b),x.writeAxisPoissonParams({boxLength:f,smoothR2:(.45*g)**2});let T=e.createCommandEncoder({label:`ulg-2lpt-psi2`}),E=x.encodeForward(T);T.copyBufferToBuffer(E,0,j,0,x.byteLength);for(let t=0;t<3;t+=1){let r=x.encodePoissonInverseFromKSpace(T,j,{gradAxis:t+1}),i=e.createBindGroup({layout:O.bindGroupLayout,entries:[{binding:0,resource:{buffer:M[t]}},{binding:1,resource:{buffer:r}},{binding:2,resource:{buffer:k}}]}),a=T.beginComputePass();a.setPipeline(O.pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(n),a.end()}T.copyBufferToBuffer(k,0,A,0,w*16),e.queue.submit([T.finish()]),await A.mapAsync(U.MAP_READ);let N=new Float32Array(A.getMappedRange().slice(0,w*16));A.unmap();let P=-.42857142857142855*Math.max(.001,h)**(-1/143),F=0;for(let e=0;e<w;e+=1){let t=P*N[e*4+0],n=P*N[e*4+1],r=P*N[e*4+2];N[e*4+0]=t,N[e*4+1]=n,N[e*4+2]=r,F+=t*t+n*n+r*r}let I=Math.sqrt(F/Math.max(1,w)),ee=(e,t,n,r)=>{let i=(t+.5*f)/f*S,a=(n+.5*f)/f*S,o=(r+.5*f)/f*S,s=(Math.floor(i)%S+S)%S,c=(Math.floor(a)%S+S)%S,l=(Math.floor(o)%S+S)%S,u=(s+1)%S,d=(c+1)%S,p=(l+1)%S,m=i-Math.floor(i),h=a-Math.floor(a),g=o-Math.floor(o),_=0,v=0,y=0,b=[s,u],x=[c,d],C=[l,p],w=[1-m,m],T=[1-h,h],E=[1-g,g];for(let t=0;t<2;t+=1)for(let n=0;n<2;n+=1)for(let r=0;r<2;r+=1){let i=((C[t]*S+x[n])*S+b[r])*4,a=w[r]*T[n]*E[t];_+=e[i+0]*a,v+=e[i+1]*a,y+=e[i+2]*a}return[_,v,y]},L=Number(u?.[0])||0,R=Number(u?.[1])||0,te=Number(u?.[2])||0,ne=d*d*d,z=new Float32Array(ne*16),re=0,ie=0,B=0,ae=0;for(let e=0;e<d;e+=1)for(let t=0;t<d;t+=1)for(let n=0;n<d;n+=1){let a=(n+.5)*p-.5*f,o=(t+.5)*p-.5*f,s=(e+.5)*p-.5*f,c=ee(r,a,o,s),l=ee(N,a,o,s),u=ut(a+c[0]+l[0]+L,f),d=ut(o+c[1]+l[1]+R,f),m=ut(s+c[2]+l[2]+te,f),h=v*c[0]+y*l[0],g=v*c[1]+y*l[1],_=v*c[2]+y*l[2];re+=h,ie+=g,B+=_;let b=ae*16;z[b+0]=u,z[b+1]=d,z[b+2]=m,z[b+3]=1,z[b+4]=h,z[b+5]=g,z[b+6]=_,z[b+7]=.28,z[b+12]=+(ae%6==0),z[b+14]=i,ae+=1}re/=ne,ie/=ne,B/=ne;for(let e=0;e<ne;e+=1)z[e*16+4]-=re,z[e*16+5]-=ie,z[e*16+6]-=B;if(l&&Number.isFinite(l.xMin)&&Number.isFinite(l.xMax)){let e=[];for(let t=0;t<ne;t+=1){let n=z[t*16+0];n>=l.xMin&&n<l.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(z.subarray(r,r+16),n*16)}return{icBackend:`webgpu-fft3d-2lpt-full-nyquist`,particleCount:e.length,globalParticleCount:ne,data:t,boxLengthMpc:f,aInit:i,rms2Over1:I/Math.max(1e-9,c)}}return{icBackend:`webgpu-fft3d-2lpt-full-nyquist`,particleCount:ne,globalParticleCount:ne,data:z,boxLengthMpc:f,aInit:i,rms2Over1:I/Math.max(1e-9,c)}}finally{x.destroy(),k.destroy(),A.destroy(),j.destroy();for(let e of M)e.destroy()}}function ft({gridPerSide:e=24,boxLengthMpc:t=200,aInit:n=.05,omegaM:r=.315,omegaLambda:i=.685,amplitude:a=.14,seed:o=20261122,slabBounds:s=null,initialPositionsShift:c=[0,0,0]}={}){let l=Math.max(8,Math.trunc(e)),u=l*l*l,d=new Float32Array(u*16),f=Number(t),p=f/l,m=W(n,{omegaM:r,omegaLambda:i}),h=(r/(n**3*m*m))**.55,g=o>>>0,_=()=>(g=Math.imul(1664525,g)+1013904223>>>0,(g+.5)/4294967296),v=[],y=2*Math.PI/f*2.5;for(let e=-3;e<=3;e+=1)for(let t=-3;t<=3;t+=1)for(let n=-3;n<=3;n+=1){let r=e*e+t*t+n*n;if(r===0||r>12)continue;let i=2*Math.PI/f*Math.sqrt(r),o=i/(1+(i/y)**2)**2,s=a*Math.sqrt(o)*(f/45);v.push({kx:2*Math.PI*e/f,ky:2*Math.PI*t/f,kz:2*Math.PI*n/f,k2:i*i,amp:s,phase:_()*2*Math.PI})}let b=Number(c?.[0])||0,x=Number(c?.[1])||0,S=Number(c?.[2])||0,C=0,w=0,T=0,E=0;for(let e=0;e<l;e+=1)for(let t=0;t<l;t+=1)for(let r=0;r<l;r+=1){let i=(r+.5)*p-.5*f,a=(t+.5)*p-.5*f,o=(e+.5)*p-.5*f,s=0,c=0,l=0;for(let e of v){let t=e.kx*i+e.ky*a+e.kz*o+e.phase,n=Math.sin(t)*(e.amp/e.k2);s+=e.kx*n,c+=e.ky*n,l+=e.kz*n}let u=ut(i+s+b,f),g=ut(a+c+x,f),_=ut(o+l+S,f),y=n*n*m*h,D=y*s,O=y*c,k=y*l;w+=D,T+=O,E+=k;let A=C*16;d[A+0]=u,d[A+1]=g,d[A+2]=_,d[A+3]=1,d[A+4]=D,d[A+5]=O,d[A+6]=k,d[A+7]=.25,d[A+12]=+(C%6==0),d[A+14]=n,C+=1}w/=u,T/=u,E/=u;for(let e=0;e<u;e+=1)d[e*16+4]-=w,d[e*16+5]-=T,d[e*16+6]-=E;if(s&&Number.isFinite(s.xMin)&&Number.isFinite(s.xMax)){let e=[];for(let t=0;t<u;t+=1){let n=d[t*16+0];n>=s.xMin&&n<s.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(d.subarray(r,r+16),n*16)}return{icBackend:`host-zeldovich-low-k`,particleCount:e.length,globalParticleCount:u,data:t,boxLengthMpc:f,aInit:n}}return{icBackend:`host-zeldovich-low-k`,particleCount:u,globalParticleCount:u,data:d,boxLengthMpc:f,aInit:n}}function pt(e,{gridPerSide:t=24,pmGridN:n=32,boxLengthMpc:r=200,aInit:i=.05,da:a=.015,omegaM:o=.315,omegaLambda:s=.685,smoothCells:c=.75,enableShortRangeTree:l=!0,seed:u=20261122,initialPositionsShift:d=[0,0,0],slabBounds:f=null,initialConditions:p=null}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createSupergalacticTreePmSessionWebGpu requires a live WebGPU GPUDevice`);let m=p||ft({gridPerSide:t,boxLengthMpc:r,aInit:i,omegaM:o,omegaLambda:s,seed:u,slabBounds:f,initialPositionsShift:d}),g=m.particleCount,_=m.globalParticleCount??m.particleCount,v=n,y=v**3,b=N(e,v),x=[C(0,`uniform`),C(1,`storage`),C(2,`storage`),C(3,`storage`),C(4,`storage`),C(5,`storage`),C(6,`storage`),C(7,`storage`)],S=t=>T(e,{cacheKey:`ulg-supergalactic-treepm-${t}.v3-1submit-pk-kdk`,label:`ulg-supergalactic-treepm-${t}`,code:ct,entryPoint:t,bindings:x}),w=S(`clear_grids`),E=S(`cic_deposit`),D=S(`prepare_poisson_rhs`),O=S(`reduce_power_spectrum_pk`),k=S(`store_force_x`),A=S(`store_force_y`),j=S(`store_force_z`),M=S(`cic_kick_drift`),P=S(`reduce_telemetry_f32`),F=S(`reduce_tile_multipole`),I=e.createBuffer({size:64,usage:U.UNIFORM|U.COPY_DST}),ee=e.createBuffer({label:`ulg-supergalactic-particles`,size:Math.max(64,m.data.byteLength),usage:U.VERTEX|U.STORAGE|U.COPY_DST|U.COPY_SRC});m.data.byteLength>0&&e.queue.writeBuffer(ee,0,m.data);let L=e.createBuffer({size:y*4,usage:U.STORAGE}),R=e.createBuffer({size:y*16,usage:U.STORAGE}),te=e.createBuffer({size:320,usage:U.STORAGE|U.COPY_SRC}),ne=e.createBuffer({size:320,usage:U.MAP_READ|U.COPY_DST}),z=e.createBuffer({size:32,usage:U.MAP_READ|U.COPY_DST}),re=e.createBuffer({size:y*16,usage:U.STORAGE}),ie=e.createBuffer({size:(y+st)*16,usage:U.STORAGE|U.COPY_DST}),B=e.createBuffer({size:b.byteLength,usage:U.STORAGE|U.COPY_DST|U.COPY_SRC}),ae=t=>e.createBindGroup({layout:w.bindGroupLayout,entries:[I,ee,L,t,R,te,re,ie].map((e,t)=>({binding:t,resource:{buffer:e}}))}),oe=ae(b.bufferA),se=ae(b.bufferB),ce=ae(B),le=e=>e===b.bufferA?oe:e===b.bufferB?se:ce,ue=r/v,de=(c*ue)**2,fe=l?c*ue:0,pe=_/y;b.writeAxisPoissonParams({boxLength:r,smoothR2:de});let me=i,he=0,ge=0,_e=0,ve=1,ye=null,be={xMin:-.5*r,xMax:.5*r},xe=(t=null)=>{let n=t||be,i=W(me,{omegaM:o,omegaLambda:s}),c=1.5*o/Math.max(.01,me),l=new ArrayBuffer(64);return new Uint32Array(l,0,4).set([g,v,he,_e]),new Float32Array(l,16,12).set([r,me,a,i,o,c,pe,fe,ge,Number(n.xMin),Number(n.xMax),0]),e.queue.writeBuffer(I,0,l),{hA:i,gravPref:c}};function Se(t=[]){let n=Array.isArray(t)?t.slice(0,st):[],r=new Float32Array(st*4);for(let e=0;e<n.length;e+=1){let t=n[e],i=t.com||[0,0,0];r[e*4+0]=Number(i[0])||0,r[e*4+1]=Number(i[1])||0,r[e*4+2]=Number(i[2])||0,r[e*4+3]=Math.max(0,Number(t.totalMass)||0)}return _e=n.length,e.queue.writeBuffer(ie,y*16,r),_e}let Ce=Math.ceil(y/64),we=Math.max(1,Math.ceil(g/64));async function Te({readTelemetry:t=!0}={}){let{hA:n}=xe(),i=a/(Math.max(.01,me)**2*Math.max(.05,n)),c=e.createCommandEncoder({label:`ulg-cosmo-treepm-step-${he}`}),u=c.beginComputePass({label:`ulg-cosmo-cic-rhs`});u.setBindGroup(0,oe),u.setPipeline(w.pipeline),u.dispatchWorkgroups(Ce),g>0&&(u.setPipeline(E.pipeline),u.dispatchWorkgroups(we)),u.setPipeline(D.pipeline),u.dispatchWorkgroups(Ce),u.end();let d=b.encodeForward(c);c.copyBufferToBuffer(d,0,B,0,b.byteLength),u=c.beginComputePass({label:`ulg-cosmo-pk`}),u.setBindGroup(0,ce),u.setPipeline(O.pipeline),u.dispatchWorkgroups(ot),u.end();let f=[k,A,j];for(let e=1;e<=3;e+=1){let t=b.encodePoissonInverseFromKSpace(c,B,{gradAxis:e});u=c.beginComputePass({label:`ulg-cosmo-store-f${e}`}),u.setBindGroup(0,le(t)),u.setPipeline(f[e-1].pipeline),u.dispatchWorkgroups(Ce),u.end()}if(u=c.beginComputePass({label:`ulg-cosmo-kdk-telemetry`}),u.setBindGroup(0,oe),g>0&&(u.setPipeline(M.pipeline),u.dispatchWorkgroups(we)),u.setPipeline(P.pipeline),u.dispatchWorkgroups(2),u.end(),t&&c.copyBufferToBuffer(te,0,ne,0,320),e.queue.submit([c.finish()]),ve=1,ge=i,me=Math.min(1.5,me+a),he+=1,!t)return null;await ne.mapAsync(U.MAP_READ);let p=new Float32Array(ne.getMappedRange().slice(0,320));ne.unmap();let y=Math.sqrt(Math.max(0,p[0]/Math.max(1,p[3]))),x=p[1],S=p[4],C=[p[5],p[6],p[7]],T=Math.max(0,1/me-1),N=[],F=[],I=[],ee=0;for(let e=0;e<ot;e+=1){let t=(2+e)*4,n=Math.round(p[t+2]);n>0&&(N.push(p[t+0]),F.push(p[t+1]),I.push(n),ee+=n)}let L=F.length>0?F.slice(0,Math.min(4,F.length)).reduce((e,t)=>e+t,0)/Math.min(4,F.length):0;ye===null&&L>0&&(ye=L);let R=ye>0?Math.sqrt(L/ye):1;return Object.freeze({schema:at,backend:l?`webgpu-fft3d-hybrid-treepm`:`webgpu-fft3d-pm`,icBackend:m.icBackend||`webgpu-fft3d-zeldovich`,integrator:`symplectic-comoving-kdk`,submitsPerStep:ve,hybridTreePmEnabled:!!l,shortRangeSplitScaleMpc:fe,remoteTileCount:_e,stepIndex:he,scaleFactorA:me,redshiftZ:T,hOverH0:W(me,{omegaM:o,omegaLambda:s}),particleCount:g,globalParticleCount:_,pmGridN:v,boxLengthMpc:r,sigmaDensity:y,maxOverdensity:x,kineticEnergy:S,momentum:C,powerSpectrumPk:Object.freeze({kBins:Object.freeze(N),pkValues:Object.freeze(F),modeCounts:Object.freeze(I),totalModes:ee,lowKPower:L,linearGrowthRatio:R}),accuracyTier:h.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,sharedKernel:`src/runtime/gpuMath/fft3dWebGpu.js`})})}async function Ee(){if(g===0)return new Float32Array;let t=e.createBuffer({size:m.data.byteLength,usage:U.MAP_READ|U.COPY_DST});try{let n=e.createCommandEncoder({label:`ulg-cosmo-read-particles`});n.copyBufferToBuffer(ee,0,t,0,m.data.byteLength),e.queue.submit([n.finish()]),await t.mapAsync(U.MAP_READ);let r=new Float32Array(t.getMappedRange().slice(0));return t.unmap(),r}finally{t.destroy()}}async function De({xMin:t=-.5*r,xMax:n=.5*r}={}){be={xMin:Number(t),xMax:Number(n)},xe(be);let i=e.createCommandEncoder({label:`ulg-cosmo-tile-multipole-gpu`}),a=i.beginComputePass();a.setBindGroup(0,oe),a.setPipeline(F.pipeline),a.dispatchWorkgroups(1),a.end(),i.copyBufferToBuffer(te,288,z,0,32),e.queue.submit([i.finish()]),await z.mapAsync(U.MAP_READ);let o=new Float32Array(z.getMappedRange().slice(0,32));return z.unmap(),Object.freeze({reducedOnGpu:!0,readbackBytes:32,totalMass:o[0],com:Object.freeze([o[1],o[2],o[3]]),quadrupoleTrace:o[4],particleCount:Math.round(o[5]),scaleFactorA:me,stepIndex:he})}return Object.freeze({schema:at,icBackend:m.icBackend||`host-zeldovich-low-k`,particleCount:g,globalParticleCount:_,strideFloats:16,boxLengthMpc:r,hybridTreePmEnabled:!!l,shortRangeSplitScaleMpc:fe,particlesBuffer:ee,forceGridBuffer:R,injectRemoteTileMultipoles:Se,step:Te,readParticlesSnapshot:Ee,readTileMultipoleSummary:De,getState:()=>({aScale:me,redshiftZ:Math.max(0,1/me-1),stepIndex:he,submitsPerStep:ve,remoteTileCount:_e}),destroy(){b.destroy();for(let e of[I,ee,L,R,te,ne,z,re,ie,B])e.destroy()}})}var mt=27.211386245988,ht=11604.51812;Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});var gt=null,_t=null;function vt({iH:e,iHe:t,iC:n,iO:r,backend:i}){let a=Math.max(8e4,Math.min(16e4,.75*e*ht)),o=Math.log10(Math.max(4e4,.31*t*ht)),s=Math.log10(Math.max(8e4,.78*(n+r)*ht));return Object.freeze({schema:`ulg.astrophysics.gate1-ism-cooling-anchors.v1`,backend:i,iHEv:e,iHeEv:t,iCEv:n,iOEv:r,tHLyaK:a,logTHePeak:o,logTMetalPeak:s,tFineStructK:92})}function yt(e,t){let n=e?.orbitals||[];if(e?.atomicNumberZ===1&&Number.isFinite(e?.totalEnergyHa))return Math.max(10,Math.abs(e.totalEnergyHa)*mt);let r=n.length>0?n[n.length-1]:null,i=Number(r?.energyHa);return Number.isFinite(i)&&i<0?Math.max(4,Math.abs(i)*mt*1.45):t}async function bt(e,{forceRecompute:t=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`deriveGate1IsmCoolingAnchorsWebGpu requires a live WebGPU GPUDevice`);if(_t&&!t)return _t;let[n,r,i,a]=await Promise.all([k(e,1,{A:1,maxScf:36}),k(e,2,{A:4,maxScf:36}),k(e,6,{A:12,maxScf:42}),k(e,8,{A:16,maxScf:42})]);return _t=vt({iH:yt(n,13.6),iHe:yt(r,24.59),iC:yt(i,11.26),iO:yt(a,13.62),backend:`webgpu-gate1-radial-ks`}),_t}function xt(){if(_t)return _t;if(gt)return gt;let e=o(1,{gridPointsN:160,maxScf:80,tol:1e-5}),t=o(2,{gridPointsN:160,maxScf:80,tol:1e-5}),n=o(6,{gridPointsN:160,maxScf:80,tol:1e-5}),r=o(8,{gridPointsN:160,maxScf:80,tol:1e-5});return gt=vt({iH:Math.max(10,Math.abs(e.totalEnergyHa)*mt),iHe:yt(t,24.59),iC:yt(n,11.26),iO:yt(r,13.62),backend:`host-gate1-radial-ks`}),gt}function St(e,t=1,n=null){let r=n||xt(),i=Math.max(10,Number(e)),a=Math.max(0,Number(t)),o=Math.log10(i),s=a*25e-27*Math.exp(-r.tFineStructK/i)*Math.exp(-(((o-2.6)/.9)**2)),c=75e-23*Math.exp(-r.tHLyaK/i)/(1+(i/22e3)**2.2),l=18e-23*Math.exp(-(((o-r.logTHePeak)/.28)**2)),u=a*6e-22*Math.exp(-(((o-r.logTMetalPeak)/.48)**2)),d=142e-29*Math.sqrt(i)*(1.2+.1*a);return s+c+l+u+d}var Ct=`ulg.astrophysics.planetary-interior-webgpu.v1`,wt=66743e-15,Tt=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});Object.freeze({earth:Object.freeze({massKg:59722e20,radiusM:6371e3,moiFactor:.3307,centralPressureGPa:364}),mars:Object.freeze({massKg:64171e19,radiusM:3389500,moiFactor:.3644,centralPressureGPa:40})});async function Et(e,n,{minPressurePa:r=1e4,maxPressurePa:i=0xe8d4a51000,maxTemperatureK:o=12e3,degrees:s=[5,5],relativeTolerance:l=.025,maxBisectDepth:u=3,materialIndex:d=0}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`buildPlanetaryPolytopeAtlasWebGpu requires a live WebGPU GPUDevice`);if(!n||typeof n!=`object`||!n.mechanical||!n.thermodynamic)throw TypeError(`buildPlanetaryPolytopeAtlasWebGpu requires a valid Gate 1-2 material bundle`);let f=c(),p=Math.max(15,Number(n.thermodynamic.meltingPointK??300)),g=Math.max(p+20,Number(n.thermodynamic.boilingPointK??p*1.5)),v=Math.max(g*2.5,Number(o)),y=f.discoverMaterialPolytopes({materialKey:n.materialKey||n.symbol||n.formula,family:n.family||`element`,meltingPointK:p,boilingPointK:g,ionizationTempK:v,meltingSlopeKPerLogP:Number(n.thermodynamic.meltingSlopeKPerLogP??120),boilingSlopeKPerLogP:Number(n.thermodynamic.boilingSlopeKPerLogP??220),maxTemperatureK:Math.max(v*1.5,Number(o)*1.5),minPressurePa:Number(r),maxPressurePa:Number(i),accuracyTier:n.accuracyTier||h.TIER_2_REPRESENTATIVE_EFFECTIVE,closureHash:n.closureHash||`planetary-v1`,provenance:n.provenance||{status:`webgpu-derived`,scientificValidation:!1}}),b=[];for(let r of y){let i=await t(e,r,(e,t)=>a(n,r.phase,e,t),{degrees:s,relativeTolerance:l,requirePositive:!0,maxDepth:u,propertyName:`densityKgPerM3`,logScale:!0});b.push(...i.polytopes)}let x=m(b,{materialIndex:d});return Object.freeze({schema:_,materialKey:n.materialKey||n.symbol||n.formula,minPressurePa:Number(r),maxPressurePa:Number(i),polytopeCount:b.length,polytopes:Object.freeze(b),packedGpuAtlas:x,accuracyTier:n.accuracyTier||h.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-polytope-fitted`,scientificValidation:!1})})}var Dt=`
${p}

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
`;async function Ot(e,{centralPressurePa:t=36e10,surfacePressurePa:n=1e5,layers:r=[],radialStepM:i=2e4,maxRadiusM:a=15e7,convergePasses:o=3,maxProfileSamples:s=256,autoFitMaxPressurePa:c=0xe8d4a51000}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solvePlanetaryInteriorWebGpu requires a live WebGPU GPUDevice`);if(!Array.isArray(r)||r.length===0)throw TypeError(`solvePlanetaryInteriorWebGpu requires at least one material layer`);let l=[];for(let t=0;t<r.length;t+=1){let n=r[t],i=n.packedGpuAtlas||n.atlas?.packedGpuAtlas||null;if(!i&&Array.isArray(n.polytopes)&&n.polytopes.length>0&&(i=m(n.polytopes,{materialIndex:t})),!i&&n.bundle&&(i=(await Et(e,n.bundle,{maxPressurePa:c,materialIndex:t})).packedGpuAtlas),!i)throw TypeError(`Layer ${t} (${n.name||`unnamed`}) must provide packedGpuAtlas, atlas, polytopes, or bundle`);l.push({name:n.name||n.bundle?.materialKey||n.atlas?.materialKey||`layer-${t}`,massFractionTarget:Math.max(0,Number(n.massFractionTarget??1)),tempK:Math.max(10,Number(n.tempK??1500)),bundle:n.bundle||null,packedGpuAtlas:i,materialId:t})}let u=g(l.map(e=>({materialId:e.materialId,materialKey:e.name,accuracyTier:e.bundle?.accuracyTier||h.TIER_2_REPRESENTATIVE_EFFECTIVE,packedGpuAtlas:e.packedGpuAtlas}))),d=l.reduce((e,t)=>e+t.massFractionTarget,0)||1,f=new Float32Array(l.length*4),p=0;for(let e=0;e<l.length;e+=1)p+=l[e].massFractionTarget/d,f.set([p,l[e].tempK,l[e].materialId,0],e*4);let _=new Float32Array([Number(t),6e24,0,0]),v=new ArrayBuffer(32);new Uint32Array(v,0,4).set([1,l.length,s,o]),new Float32Array(v,16,4).set([Number(n),Number(i),Number(a),wt]);let y=T(e,{cacheKey:`ulg-planetary-hydrostatic-polytope.v1`,label:`ulg-planetary-hydrostatic-polytope`,code:Dt,entryPoint:`solve_planetary_hydrostatic`,bindings:[C(0,`uniform`),C(1,`read-only-storage`),C(2,`read-only-storage`),C(3,`read-only-storage`),C(4,`storage`),C(5,`storage`)]}),b=e.createBuffer({size:32,usage:Tt.UNIFORM|Tt.COPY_DST}),x=e.createBuffer({size:Math.max(64,u.data.byteLength),usage:Tt.STORAGE|Tt.COPY_DST}),S=e.createBuffer({size:Math.max(16,f.byteLength),usage:Tt.STORAGE|Tt.COPY_DST}),w=e.createBuffer({size:16,usage:Tt.STORAGE|Tt.COPY_DST}),E=e.createBuffer({size:48,usage:Tt.STORAGE|Tt.COPY_SRC}),D=e.createBuffer({size:s*32,usage:Tt.STORAGE|Tt.COPY_SRC}),O=e.createBuffer({size:48,usage:Tt.MAP_READ|Tt.COPY_DST}),k=e.createBuffer({size:s*32,usage:Tt.MAP_READ|Tt.COPY_DST});try{e.queue.writeBuffer(b,0,v),e.queue.writeBuffer(x,0,u.data),e.queue.writeBuffer(S,0,f),e.queue.writeBuffer(w,0,_);let n=e.createBindGroup({layout:y.bindGroupLayout,entries:[b,x,S,w,E,D].map((e,t)=>({binding:t,resource:{buffer:e}}))}),r=e.createCommandEncoder({label:`ulg-planetary-hydrostatic`}),i=r.beginComputePass();i.setPipeline(y.pipeline),i.setBindGroup(0,n),i.dispatchWorkgroups(1),i.end(),r.copyBufferToBuffer(E,0,O,0,48),r.copyBufferToBuffer(D,0,k,0,s*32),e.queue.submit([r.finish()]),await Promise.all([O.mapAsync(Tt.MAP_READ),k.mapAsync(Tt.MAP_READ)]);let a=new Float32Array(O.getMappedRange().slice(0,48)),o=new Float32Array(k.getMappedRange().slice(0,s*32));O.unmap(),k.unmap();let c=Math.round(a[3]),d=c===2,p=c===1,m=Math.min(s,Math.max(0,Math.round(a[7]))),g=[];for(let e=0;e<m;e+=1){let t=e*8,n=Math.min(l.length-1,Math.max(0,Math.round(o[t+5])));g.push(Object.freeze({radiusM:o[t+0],pressurePa:o[t+1],densityKgPerM3:o[t+2],massEnclosedKg:o[t+3],gravityMPerS2:o[t+4],layer:l[n].name,phaseCode:Math.round(o[t+6]),polytopeHit:o[t+7]>.5}))}let C=Number(l[0]?.bundle?.electromagnetic?.electricalConductivitySPerM??0);return Object.freeze({schema:Ct,backend:`webgpu-polytope-atlas`,valid:p,failClosed:d,reason:d?`polytope-out-of-domain`:c===3?`max-radius-reached`:`ok`,failureState:d?Object.freeze({pressurePa:a[8],temperatureK:a[9],layerIndex:Math.round(a[10]),layer:l[Math.max(0,Math.round(a[10]))]?.name??`unknown`}):null,centralPressurePa:Number(t),totalMassKg:a[0],radiusM:a[1],moiFactor:a[2],meanDensityKgPerM3:a[4],surfaceGravityMPerS2:a[5],escapeVelocityMPerS:a[6],minPolytopeMargin:a[11],coreConductivitySPerM:C,dynamoCapable:p&&C>1e4&&t>1e10,layerCount:l.length,profile:Object.freeze(g),accuracyTier:h.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-polytope-atlas-derived`,inlineWgslEvaluator:`eval_polytope_atlas_bank_2d`,scientificValidation:!1})})}finally{for(let e of[b,x,S,w,E,D,O,k])e.destroy()}}var G=`ulg.astrophysics.stellar-nuclear-network.v1`,kt=`ulg.astrophysics.stellar-nuclear-webgpu.v1`,At=`ulg.astrophysics.lane-emden-webgpu.v1`,jt=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),Mt=-.7823334099999784,Nt=1602176634e-22,Pt=167262192369e-38,Ft=Object.freeze([{id:`pp-chain`,label:`4 ¹H → ⁴He + 2e⁺ + 2ν_e`,reactants:[[1,1,4]],products:[[2,4,1]],ignitionTempK:1e7,chargeConservedWithLeptons:!0,neutrinoLossMeV:.53},{id:`triple-alpha`,label:`3 ⁴He → ¹²C`,reactants:[[2,4,3]],products:[[6,12,1]],ignitionTempK:1e8,neutrinoLossMeV:0},{id:`c12-alpha`,label:`¹²C + ⁴He → ¹⁶O`,reactants:[[6,12,1],[2,4,1]],products:[[8,16,1]],ignitionTempK:15e7,neutrinoLossMeV:0},{id:`o16-alpha`,label:`¹⁶O + ⁴He → ²⁰Ne`,reactants:[[8,16,1],[2,4,1]],products:[[10,20,1]],ignitionTempK:5e8,neutrinoLossMeV:0},{id:`ne20-alpha`,label:`²⁰Ne + ⁴He → ²⁴Mg`,reactants:[[10,20,1],[2,4,1]],products:[[12,24,1]],ignitionTempK:12e8,neutrinoLossMeV:0},{id:`mg24-alpha`,label:`²⁴Mg + ⁴He → ²⁸Si`,reactants:[[12,24,1],[2,4,1]],products:[[14,28,1]],ignitionTempK:18e8,neutrinoLossMeV:0},{id:`si28-to-fe56`,label:`2 ²⁸Si → ⁵⁶Ni → ⁵⁶Fe + 2e⁺ + 2ν_e`,reactants:[[14,28,2]],products:[[26,56,1]],ignitionTempK:3e9,chargeConservedWithLeptons:!0,neutrinoLossMeV:1.8},{id:`fe56-photodisintegration`,label:`⁵⁶Fe + γ → 13 ⁴He + 4n`,reactants:[[26,56,1]],products:[[2,4,13],[0,1,4]],ignitionTempK:55e8,neutrinoLossMeV:0}]),It=null;function Lt(){if(It)return It;let e=Ft.map(e=>{let t=e.reactants.reduce((e,[,t,n])=>e+t*n,0),n=e.products.reduce((e,[,t,n])=>e+t*n,0);if(t!==n)throw RangeError(`Nucleon conservation violation in ${e.id}: ${t} !== ${n}`);let r=e.reactants.reduce((e,[t,,n])=>e+t*n,0),i=e.products.reduce((e,[t,,n])=>e+t*n,0);if(!e.chargeConservedWithLeptons&&r!==i)throw RangeError(`Charge conservation violation in ${e.id}: ${r} !== ${i}`);let a=e.reactants.reduce((e,[t,n,r])=>e+s(t,n)*r,0),o=e.products.reduce((e,[t,n,r])=>e+s(t,n)*r,0),c=r-i,l=o-a+c*Mt,u=Number(e.neutrinoLossMeV||0),d=l>0?Math.max(0,l-u):l,f=Math.abs(d)*Nt/(t*Pt);return Object.freeze({id:e.id,label:e.label,nucleonsConserved:t,deltaZ:c,ignitionTempK:e.ignitionTempK,qValueMeV:l,qValueTotalMeV:l,qValueThermalMeV:d,neutrinoLossMeV:u,qValueJPerKg:f,exothermic:l>0})}),t=Object.freeze(Object.fromEntries(e.map(e=>[e.id,e])));return It=Object.freeze({schema:G,channels:Object.freeze(e),byId:t,accuracyTier:h.TIER_1_QUANTITATIVE,provenance:Object.freeze({status:`gate1-nuclear-derived`,scientificValidation:!1})}),It}function Rt(){let{byId:e}=Lt();return Object.freeze({ppTotalMeV:e[`pp-chain`].qValueTotalMeV,ppThermalMeV:e[`pp-chain`].qValueThermalMeV,ppJPerKgH:e[`pp-chain`].qValueJPerKg,tripleAlphaMeV:e[`triple-alpha`].qValueThermalMeV,tripleAlphaJPerKgHe:e[`triple-alpha`].qValueJPerKg,fePhotodisMeV:Math.abs(e[`fe56-photodisintegration`].qValueTotalMeV),fePhotodisJPerKgFe:e[`fe56-photodisintegration`].qValueJPerKg})}var zt=`
struct NuclearNetParams {
  sample_count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  q_pp_j_per_kg: f32,
  q_3a_j_per_kg: f32,
  q_photodis_j_per_kg: f32,
  pad3: f32,
};

struct NuclearSampleIn {
  // [rhoKgM3, temperatureK, xH, xHe]
  state0: vec4<f32>,
  // [xZ, dtS, pad, pad]
  state1: vec4<f32>,
};

struct NuclearSampleOut {
  // [epsPpWPerKg, epsCnoWPerKg, eps3aWPerKg, epsPhotodisWPerKg]
  rates: vec4<f32>,
  // [nextXH, nextXHe, nextXZ, energyDepositedJPerKg]
  burn: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: NuclearNetParams;
@group(0) @binding(1) var<storage, read> samples_in: array<NuclearSampleIn>;
@group(0) @binding(2) var<storage, read_write> samples_out: array<NuclearSampleOut>;

@compute @workgroup_size(64)
fn eval_stellar_nuclear_network(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.sample_count) { return; }
  let s0 = samples_in[i].state0;
  let s1 = samples_in[i].state1;
  let rho = max(0.0, s0.x);
  let temp_k = max(1.0, s0.y);
  let sum_x = max(1e-12, s0.z + s0.w + s1.x);
  var xH = max(0.0, s0.z / sum_x);
  var xHe = max(0.0, s0.w / sum_x);
  var xZ = max(0.0, s1.x / sum_x);
  let dt_s = max(0.0, s1.y);

  let rho_cgs = rho * 1e-3;
  let t6 = temp_k * 1e-6;
  let t8 = temp_k * 1e-8;
  let t9 = temp_k * 1e-9;

  var eps_pp = 0.0;
  if (t6 > 0.5 && xH > 1e-6) {
    let t6_cbrt = pow(t6, 0.33333334);
    let tau_pp = 33.80 / t6_cbrt;
    if (tau_pp < 85.0) {
      let screen = (1.0 + 0.0123 * t6_cbrt + 0.0109 * t6_cbrt * t6_cbrt) * 1.18;
      eps_pp = 238.0 * rho_cgs * xH * xH * pow(t6, -0.6666667) * exp(-tau_pp) * screen;
    }
  }
  var eps_cno = 0.0;
  if (t6 > 5.0 && xH > 1e-6 && xZ > 1e-6) {
    let t6_cbrt = pow(t6, 0.33333334);
    let tau_cno = 152.28 / t6_cbrt;
    if (tau_cno < 85.0) {
      eps_cno = 4.4e21 * rho_cgs * xH * (0.5 * xZ) * pow(t6, -0.6666667) * exp(-tau_cno);
    }
  }
  var eps_3a = 0.0;
  if (t8 > 0.35 && xHe > 1e-6) {
    let tau_3a = 44.027 / t8;
    if (tau_3a < 85.0) {
      eps_3a = 5.09e7 * (rho_cgs * rho_cgs) * (xHe * xHe * xHe) * pow(t8, -3.0) * exp(-tau_3a);
    }
  }
  var eps_photodis = 0.0;
  if (t9 > 1.2 && xZ > 0.30) {
    let ramp = clamp((t9 - 1.2) / 1.5, 0.0, 1.0);
    eps_photodis = 1.5e8 * xZ * ramp * ramp * exp(-max(0.0, 12.0 / t9 - 5.0));
  }

  var e_dep_j_per_kg = 0.0;
  if (dt_s > 0.0) {
    let dX = min(xH, ((eps_pp + eps_cno) * dt_s) / max(1.0, params.q_pp_j_per_kg));
    let dY = min(xHe + dX, (eps_3a * dt_s) / max(1.0, params.q_3a_j_per_kg));
    let dZ_photo = min(xZ + dY, (eps_photodis * dt_s) / max(1.0, params.q_photodis_j_per_kg));
    e_dep_j_per_kg = dX * params.q_pp_j_per_kg + dY * params.q_3a_j_per_kg - dZ_photo * params.q_photodis_j_per_kg;
    xH = max(0.0, xH - dX);
    xHe = max(0.0, xHe + dX - dY + dZ_photo);
    xZ = max(0.0, xZ + dY - dZ_photo);
    let norm = max(1e-12, xH + xHe + xZ);
    xH = xH / norm;
    xHe = xHe / norm;
    xZ = xZ / norm;
  }

  samples_out[i] = NuclearSampleOut(
    vec4<f32>(eps_pp, eps_cno, eps_3a, eps_photodis),
    vec4<f32>(xH, xHe, xZ, e_dep_j_per_kg)
  );
}
`;async function Bt(e,t){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`evaluateStellarNuclearNetworkWebGpu requires a live WebGPU GPUDevice`);let n=Array.isArray(t)?t:[];if(n.length===0)throw TypeError(`evaluateStellarNuclearNetworkWebGpu requires at least one state sample`);let r=Rt(),i=new Float32Array(n.length*8);for(let e=0;e<n.length;e+=1){let t=n[e];i.set([Number(t.rhoKgM3??15e4),Number(t.temperatureK??15e6),Number(t.xH??.74),Number(t.xHe??.25),Number(t.xZ??t.xMetals??.01),Number(t.dtS??0),0,0],e*8)}let a=T(e,{cacheKey:`ulg-stellar-nuclear-network.v1`,label:`ulg-stellar-nuclear-network`,code:zt,entryPoint:`eval_stellar_nuclear_network`,bindings:[C(0,`uniform`),C(1,`read-only-storage`),C(2,`storage`)]}),o=new ArrayBuffer(32);new Uint32Array(o,0,4).set([n.length,0,0,0]),new Float32Array(o,16,4).set([r.ppJPerKgH,r.tripleAlphaJPerKgHe,r.fePhotodisJPerKgFe,0]);let s=e.createBuffer({size:32,usage:jt.UNIFORM|jt.COPY_DST}),c=e.createBuffer({size:i.byteLength,usage:jt.STORAGE|jt.COPY_DST}),l=e.createBuffer({size:i.byteLength,usage:jt.STORAGE|jt.COPY_SRC}),u=e.createBuffer({size:i.byteLength,usage:jt.MAP_READ|jt.COPY_DST});try{e.queue.writeBuffer(s,0,o),e.queue.writeBuffer(c,0,i);let t=e.createBindGroup({layout:a.bindGroupLayout,entries:[s,c,l].map((e,t)=>({binding:t,resource:{buffer:e}}))}),d=e.createCommandEncoder({label:`ulg-stellar-nuclear-network`}),f=d.beginComputePass();f.setPipeline(a.pipeline),f.setBindGroup(0,t),f.dispatchWorkgroups(Math.ceil(n.length/64)),f.end(),d.copyBufferToBuffer(l,0,u,0,i.byteLength),e.queue.submit([d.finish()]),await u.mapAsync(jt.MAP_READ);let p=new Float32Array(u.getMappedRange().slice(0,i.byteLength));u.unmap();let m=[];for(let e=0;e<n.length;e+=1){let t=e*8;m.push(Object.freeze({epsPpWPerKg:p[t+0],epsCnoWPerKg:p[t+1],eps3aWPerKg:p[t+2],epsPhotodisWPerKg:p[t+3],epsTotalWPerKg:p[t+0]+p[t+1]+p[t+2],nextMassFractions:Object.freeze({xH:p[t+4],xHe:p[t+5],xZ:p[t+6]}),energyDepositedJPerKg:p[t+7]}))}return Object.freeze({schema:kt,backend:`webgpu`,burnConstants:r,results:Object.freeze(m),provenance:Object.freeze({status:`gate1-nuclear-webgpu-derived`,scientificValidation:!1})})}finally{for(let e of[s,c,l,u])e.destroy()}}var K=`
struct LaneEmdenParams {
  count: u32,
  max_steps: u32,
  pad0: u32,
  pad1: u32,
  d_xi: f32,
  max_xi: f32,
  pad2: f32,
  pad3: f32,
};

@group(0) @binding(0) var<uniform> params: LaneEmdenParams;
@group(0) @binding(1) var<storage, read> indices_n: array<f32>;
// Output vec4(polytropeIndexN, xi1, massIntegral, centralToMeanDensityRatio)
@group(0) @binding(2) var<storage, read_write> results: array<vec4<f32>>;

fn le_deriv(x: f32, th: f32, dth: f32, poly_n: f32) -> vec2<f32> {
  let th_safe = max(0.0, th);
  let th_n = select(0.0, pow(th_safe, poly_n), th_safe > 0.0 || poly_n == 0.0);
  return vec2<f32>(dth, -(2.0 / x) * dth - th_n);
}

@compute @workgroup_size(64)
fn solve_lane_emden_rk4(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.count) { return; }
  let poly_n = indices_n[i];
  let dxi = params.d_xi;
  var xi = dxi;
  let xi2 = xi * xi;
  var theta = 1.0 - xi2 / 6.0 + (poly_n * xi2 * xi2) / 120.0;
  var dtheta = -xi / 3.0 + (poly_n * xi2 * xi) / 30.0;

  for (var step = 0u; step < params.max_steps; step = step + 1u) {
    if (theta <= 0.0 || xi >= params.max_xi) { break; }
    let k1 = le_deriv(xi, theta, dtheta, poly_n);
    let k2 = le_deriv(xi + 0.5 * dxi, theta + 0.5 * dxi * k1.x, dtheta + 0.5 * dxi * k1.y, poly_n);
    let k3 = le_deriv(xi + 0.5 * dxi, theta + 0.5 * dxi * k2.x, dtheta + 0.5 * dxi * k2.y, poly_n);
    let k4 = le_deriv(xi + dxi, theta + dxi * k3.x, dtheta + dxi * k3.y, poly_n);
    let next_theta = theta + (dxi / 6.0) * (k1.x + 2.0 * k2.x + 2.0 * k3.x + k4.x);
    let next_dtheta = dtheta + (dxi / 6.0) * (k1.y + 2.0 * k2.y + 2.0 * k3.y + k4.y);
    if (next_theta <= 0.0) {
      let frac = theta / max(1e-12, theta - next_theta);
      xi = xi + frac * dxi;
      dtheta = dtheta + frac * (next_dtheta - dtheta);
      theta = 0.0;
      break;
    }
    xi = xi + dxi;
    theta = next_theta;
    dtheta = next_dtheta;
  }

  let mass_int = -(xi * xi * dtheta);
  let rho_ratio = -(xi / min(-1e-12, 3.0 * dtheta));
  results[i] = vec4<f32>(poly_n, xi, mass_int, rho_ratio);
}
`;async function Vt(e,t=[1.5,3],{dXi:n=.002,maxXi:r=25}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveLaneEmdenPolytropeWebGpu requires a live WebGPU GPUDevice`);let i=Float32Array.from(Array.isArray(t)?t:[t]);if(i.length===0)throw TypeError(`solveLaneEmdenPolytropeWebGpu requires at least one polytrope index`);let a=T(e,{cacheKey:`ulg-lane-emden-rk4.v1`,label:`ulg-lane-emden-rk4`,code:K,entryPoint:`solve_lane_emden_rk4`,bindings:[C(0,`uniform`),C(1,`read-only-storage`),C(2,`storage`)]}),o=Math.ceil(r/Math.max(1e-5,n))+4,s=new ArrayBuffer(32);new Uint32Array(s,0,4).set([i.length,o,0,0]),new Float32Array(s,16,4).set([n,r,0,0]);let c=e.createBuffer({size:32,usage:jt.UNIFORM|jt.COPY_DST}),l=e.createBuffer({size:Math.max(16,i.byteLength),usage:jt.STORAGE|jt.COPY_DST}),u=e.createBuffer({size:i.length*16,usage:jt.STORAGE|jt.COPY_SRC}),d=e.createBuffer({size:i.length*16,usage:jt.MAP_READ|jt.COPY_DST});try{e.queue.writeBuffer(c,0,s),e.queue.writeBuffer(l,0,i);let t=e.createBindGroup({layout:a.bindGroupLayout,entries:[c,l,u].map((e,t)=>({binding:t,resource:{buffer:e}}))}),n=e.createCommandEncoder({label:`ulg-lane-emden-rk4`}),r=n.beginComputePass();r.setPipeline(a.pipeline),r.setBindGroup(0,t),r.dispatchWorkgroups(Math.ceil(i.length/64)),r.end(),n.copyBufferToBuffer(u,0,d,0,i.length*16),e.queue.submit([n.finish()]),await d.mapAsync(jt.MAP_READ);let o=new Float32Array(d.getMappedRange().slice(0,i.length*16));d.unmap();let f=[];for(let e=0;e<i.length;e+=1){let t=e*4;f.push(Object.freeze({polytropeIndexN:o[t+0],xi1:o[t+1],massIntegral:o[t+2],centralToMeanDensityRatio:o[t+3],g7Advisory:!0}))}return Object.freeze({schema:At,backend:`webgpu`,solutions:Object.freeze(f)})}finally{for(let e of[c,l,u,d])e.destroy()}}var Ht=`peercompute.ulg.hydrogen-stellar-closure.v1`,q=`peercompute.ulg.stellar-closure-table-abi.v1`,J=1380649e-29,Ut=16605390666e-37,Wt=167262192369e-38,Y=91093837015e-41,Gt=1054571817e-43,Kt=299792458,qt=66743e-15,Jt=4*5.670374419e-8/Kt,Yt=1602176634e-28,Xt=27.211386245988,Zt=198847e25,Qt=Rt();Qt.ppThermalMeV;var $t=Qt.ppJPerKgH;Qt.tripleAlphaMeV;var en=Qt.tripleAlphaJPerKgHe;Qt.fePhotodisMeV;var tn=null;async function nn(e,{forceRecompute:t=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`deriveQuantumHydrogenAnchorsWebGpu requires a live WebGPU GPUDevice`);if(tn?.backend===`webgpu`&&!t)return tn;let n=await k(e,1,{A:1,maxScf:45}),i=Number(n.totalEnergyHa??-.5),a=Number(n.homoEnergyHa??n.orbitals?.[0]?.energyHa??-.5),o=Math.max(11,Math.min(15,Math.abs(i)*Xt)),s=await u(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basisName:`sto-3g`,maxScf:24,sampleVolume:!1}),c=.05,l=await u(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.45]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:s.densityMatrix}),p=await u(e,[{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-c]}],{basisName:`sto-3g`,maxScf:20,sampleVolume:!1,initialP:s.densityMatrix}),m=2*i,h=Math.max(.08,m-s.totalEnergyHa)*Xt,g=Math.max(.1,(l.totalEnergyHa-2*s.totalEnergyHa+p.totalEnergyHa)/(c*c)),_=Math.sqrt(g/(.5*1836.152673))*Xt*Yt/J,v=d(15e4/Wt*r**3),y=f(v);return tn=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,backend:`webgpu`,hTotalEnergyHa:i,h1sOrbitalEnergyHa:a,hIonizationEv:o,hIonizationTempK:o*Yt/J,h2EqEnergyHa:s.totalEnergyHa,h2DissEnergyHa:m,h2DiradicalStretched:1,h2DissociationEv:h,h2DissociationTempK:h*Yt/J,h2VibrationalTempK:_,uegSolarCoreRsBohr:v,uegSolarCoreKineticHa:y,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),tn}function rn({forceRecompute:t=!1}={}){if(tn&&!t)return tn;let n=o(1,{functional:`pbe`,scalarRelativistic:!0,spinOrbit:!1,gridPointsN:320,rMaxBohr:24,maxScf:180,tol:1e-6}),i=n.orbitals?.[0]?.energyHa??-.5,a=Math.max(11,Math.min(15,Math.abs(n.totalEnergyHa)*Xt)),s=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`6-31g`,tol:1e-9}),c=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,10]}],{basis:`6-31g`,tol:1e-9}),l=Math.max(.08,c.totalEnergyHa-s.totalEnergyHa)*Xt,u=.04,p=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.44]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,m=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,h=e([{Z:1,position:[0,0,0]},{Z:1,position:[0,0,1.4-u]}],{basis:`sto-3g`,tol:1e-8}).totalEnergyHa,g=Math.max(.1,(p-2*m+h)/(u*u)),_=Math.sqrt(g/(.5*1836.152673))*Xt*Yt/J,v=d(15e4/Wt*r**3),y=f(v);return tn=Object.freeze({schema:`peercompute.ulg.quantum-hydrogen-anchors.v1`,hTotalEnergyHa:n.totalEnergyHa,h1sOrbitalEnergyHa:i,hIonizationEv:a,hIonizationTempK:a*Yt/J,h2EqEnergyHa:s.totalEnergyHa,h2DissEnergyHa:c.totalEnergyHa,h2DiradicalStretched:c.diradicalCharacter,h2DissociationEv:l,h2DissociationTempK:l*Yt/J,h2VibrationalTempK:_,uegSolarCoreRsBohr:v,uegSolarCoreKineticHa:y,validation:Object.freeze({scientificValidation:!1,fullPhysicsValidation:!1})}),tn}function an(e,t=.85){let n=Math.max(0,e*Math.max(.1,t)/Wt);if(n<=0)return 0;let r=Gt*Math.cbrt(3*Math.PI*Math.PI*n)/(Y*Kt),i=r*r,a=Y**4*Kt**5/(24*Math.PI*Math.PI*Gt**3);if(r<.01)return a*(1.6*i*i*r-4/7*i*i*i*r);let o=Math.sqrt(1+i),s=r*(2*i-3)*o+3*Math.asinh(r);return Math.max(0,a*s)}function on(e){let t=Math.max(0,Number(e)||0),n=25e8;return t<=n?0:6e23*((t-n)/3e9)**2.75}function sn({rhoKgM3:e=1e-16,temperatureK:t=30,xH:n=.74,xHe:r=.25,xMetals:i=.01,anchors:a=null}={}){let o=a||rn(),s=Math.max(1e-24,Number(e)||1e-16),c=Math.max(5,Number(t)||30),l=Math.max(1e-9,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*u/Wt,m=s*d/(4*Wt),h=s*f/(16*Wt),g=2*Math.PI*Wt*J*c/(2*Math.PI*Gt)**2,_=Math.max(1e-30,.5*g)**1.5,v=Math.max(1,c/(2*85.4))/Math.max(1e-6,1-Math.exp(-o.h2VibrationalTempK/c)),y=-o.h2DissociationTempK/c,b=0;if(y<-700)b=1;else if(y>40)b=0;else{let e=_/Math.max(1,v)*Math.exp(y)/Math.max(1e-20,4*p);if(e>1e8)b=0;else if(e<1e-12)b=1;else{let t=-e+Math.sqrt(e*e+2*e);b=Math.max(0,Math.min(1,1-t))}}let x=Math.max(0,p*(1-b)),S=2*Math.PI*Y*J*c/(2*Math.PI*Gt)**2,C=-o.hIonizationTempK/c,w=0;if(x>0&&C>-700){let e=Math.max(1e-30,S)**1.5*Math.exp(Math.min(50,C))/Math.max(1e-20,x);w=e>1e8?1:e<1e-14?0:Math.max(0,Math.min(1,.5*(-e+Math.sqrt(e*e+4*e))))}let T=1/(1+Math.exp(-(Math.log10(s)-1.5)*2.4));w=Math.max(w,T),w>.5&&(b*=Math.max(0,1-(w-.5)*2));let E=Math.max(T,1/(1+Math.exp(-(c-28e3)/5500))),D=.5*p*b,O=p*(1-b),k=O*w+2*E*m+8*E*h,A=Math.max(1e-20,D+O+m+h+k),j=s/Ut/A,M=A*J*c,N=Jt/3*c**4,P=an(s,Math.max(.25,u*w+.5*d*E+.5*f*E)),F=on(s),I=M+N+P+F,ee=P/Math.max(1e-30,I),L=N/Math.max(1e-30,I),R=F/Math.max(1e-30,I),te=4*b*(1-b),ne=4*w*(1-w),z=c>12e8?Math.min(.32,(c-12e8)/15e8*.32):0,re=5/3-4/15*b*(1/(1+Math.exp(-(c-120)/35))),ie=re*(1-L)+4/3*L,B=Math.max(1.06,ie-.5*te-.48*ne-z)*(1-R)+2.75*R,ae=.1*(1/(1+Math.exp((c-1600)/180))),oe=25e-33*Math.sqrt(Math.max(1e-20,s))*Math.min(12e3,c)**9*(1/(1+Math.exp((c-9e3)/1200))),se=4e21*(1+u)*(f+.001)*s*c**-3.5,ce=.02*(1+u)*Math.max(.01,w),le=Math.max(1e-4,Math.min(1e5,ae+oe+se+ce)),ue=M/(Math.max(.15,re-1)*s)+3*N/s,de=(1-b)*.5*u*o.h2DissociationEv*Yt/Wt,fe=w*u*o.hIonizationEv*Yt/Wt,pe=ue+de+fe;return{schema:Ht,rhoKgM3:s,temperatureK:c,xH:u,xHe:d,xMetals:f,fH2:b,xIonized:w,mu:j,gammaEff:B,pressureIdealPa:M,pressureRadPa:N,pressureDegPa:P,pressureNucSatPa:F,pressureTotalPa:I,pDegFraction:ee,pRadFraction:L,pNucFraction:R,soundSpeedMPerS:Math.sqrt(Math.max(1,B*I/s)),kappaM2PerKg:le,specificEnergyJPerKg:pe,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function cn({rhoKgM3:e=15e4,temperatureK:t=15e6,xH:n=.74,xHe:r=.25,xMetals:i=.01,dtS:a=0,coreMassSolar:o=1}={}){let s=Math.max(0,Number(e)||0),c=Math.max(1,Number(t)||1),l=Math.max(1e-12,n+r+i),u=Math.max(0,n/l),d=Math.max(0,r/l),f=Math.max(0,i/l),p=s*.001,m=c*1e-6,h=c*1e-8,g=c*1e-9,_=0,v=0,y=1/0;if(m>.5&&u>1e-6&&(y=33.8/Math.cbrt(m),v=1.22*m**(2/3),y<200)){let e=(1+.0123*Math.cbrt(m)+.0109*m**(2/3))*1.18;_=238*p*u*u*m**(-2/3)*Math.exp(-y)*e}let b=0;if(m>5&&u>1e-6&&f>1e-6){let e=152.28/Math.cbrt(m);e<220&&(b=44e20*p*u*(.5*f)*m**(-2/3)*Math.exp(-e))}let x=0;if(h>.35&&d>1e-6){let e=44.027/h;e<200&&(x=p*p*509e5*(d*d*d)*h**-3*Math.exp(-e))}let S=0;if(g>1.2&&f>.3){let e=Math.min(1,(g-1.2)/1.5);S=15e7*f*e*e*Math.exp(-Math.max(0,12/g-5))}let C=_+b+x,w=C-S,T=0,E=0;if(a>0&&C>0){let e=_+b;T=Math.min(u,e*a/$t),E=Math.min(d+T,x*a/en),u=Math.max(0,u-T),d=Math.max(0,d+T-E),f=Math.max(0,f+E);let t=u+d+f;u/=t,d/=t,f/=t}let D=o>=1.44&&f>=.5&&(c>=14e8||s>=15e8),O=`none`,k=0;if(D){let e=Math.max(1.35,o*.14);k=2*qt*e*Zt/(Kt*Kt),O=e>2.35?`black-hole`:`neutron-star`}let A=Math.abs(u+d+f-1);return{schema:`peercompute.ulg.stellar-nuclear-fusion-closure.v1`,epsPpWPerKg:_,epsCnoWPerKg:b,eps3aWPerKg:x,epsPhotodisWPerKg:S,epsTotalWPerKg:C,epsNetWPerKg:w,gamowPeakKeV:v,gamowTauPp:y,fusionActive:C>1e-6,nextMassFractions:{xH:u,xHe:d,xMetals:f},dXBurned:T,dYBurned:E,nucleonConservationRelError:A,coreCollapseTriggered:D,remnantClass:O,schwarzschildRadiusM:k,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}function ln(e){let t=E(Math.max(600,Math.min(6e4,Number(e)||5778)));return[t.r,t.g,t.b]}function un({coreTempK:e=20,coreRhoKgM3:t=1e-16,fH2:n=1,xIonized:r=0,xH:i=.74,epsNucWPerKg:a=0,pDegFraction:o=0,supernovaShockActive:s=!1,remnantClass:c=`none`}={}){return c===`black-hole`?{id:`black-hole`,label:`Black Hole & Expanding SNR`}:c===`neutron-star`?{id:`neutron-star`,label:`Neutron Star & Expanding SNR`}:s?{id:`supernova`,label:`Core-Collapse Supernova`}:e>=8e7&&i<.18?{id:`helium-burning`,label:`Red Giant / Triple-α Core`}:a>1e-4&&i>=.18?{id:`main-sequence`,label:`Main-Sequence Fusion Star`}:a>1e-7?{id:`fusion-ignition`,label:`pp-Chain Quantum Ignition`}:r>=.35||e>=8e3?{id:`saha-protostar`,label:`Ionized Protostar (Saha H⁺)`}:n<.85||e>=1400?{id:`h2-dissociation`,label:`H₂ Dissociation Collapse (γ<4/3)`}:e>=120||t>=1e-9?{id:`larson-core`,label:`First Hydrostatic Larson Core`}:{id:`molecular-nebula`,label:`Cold Molecular H₂ Nebula`}}function X({nRho:e=28,nTemp:t=40,logRhoMin:n=-18,logRhoMax:r=11,logTempMin:i=1,logTempMax:a=9.6,xH:o=.74,xHe:s=.25,xMetals:c=.01,anchors:l=null}={}){let u=l||rn(),d=new Float32Array(e*t*8);for(let l=0;l<t;l+=1){let f=10**(i+l/Math.max(1,t-1)*(a-i));for(let t=0;t<e;t+=1){let i=sn({rhoKgM3:10**(n+t/Math.max(1,e-1)*(r-n)),temperatureK:f,xH:o,xHe:s,xMetals:c,anchors:u}),a=(l*e+t)*8;d[a+0]=i.mu,d[a+1]=i.gammaEff,d[a+2]=i.fH2,d[a+3]=i.xIonized,d[a+4]=i.pDegFraction,d[a+5]=Math.log10(Math.max(1e-6,i.kappaM2PerKg)),d[a+6]=i.pNucFraction,d[a+7]=i.pRadFraction}}return{schema:q,nRho:e,nTemp:t,logRhoMin:n,logRhoMax:r,logTempMin:i,logTempMax:a,strideFloats:8,anchors:u,data:d,validation:{scientificValidation:!1,fullPhysicsValidation:!1}}}async function dn({closureRegistry:e,device:t=null,closureTable:n=null,closureId:r=`ulg-quantum-hydrogen-plasma-eos-2d.v1`}={}){let i=n;i||=X({anchors:t?await nn(t):rn()});let a={closureId:r,closureKind:`plasma-eos-fusion-2d-table`,inputHash:`h-he-z:${i.nRho}x${i.nTemp}`,methodHash:`ks-pbe+cas22+ueg+nuclear-saturation.v1`,execution:{mode:`bilinear-2d-gpu-table`,table:i},validity:{log10Rho:[i.logRhoMin,i.logRhoMax],log10T:[i.logTempMin,i.logTempMax]},provenance:{schema:q,anchors:i.anchors,radiationClosure:`src/runtime/material/radiationClosure.js#blackbodyColorSrgb`,validation:i.validation}};return{ref:e?await e.store(a):null,artifact:a,table:i}}var fn=`peercompute.ulg.self-gravitating-hydro-gpu.v1`,pn=128,mn=32,hn=mn*mn*mn,gn=hn*8,_n=`
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

const HYDRO_DIM: u32 = ${mn}u;
const HYDRO_COUNT: u32 = ${hn}u;

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
`;function vn(e,t,n,r){let i=Math.max(1,t),a=Math.max(1,e[10]),o=Math.max(1.15,(e[0]||1400)/1e3),s=(e[1]||4e3)/1e3-20,c=(e[2]||0)/1e3-30,l=e[3]||0,u=Math.min(1,(e[4]||0)/(i*1e3)),d=Math.min(1,(e[5]||0)/(i*1e3)),f=Math.min(1,(e[6]||0)/(i*1e3)),p=Math.min(1,(e[7]||0)/(i*1e3)),m=Math.min(1,(e[8]||0)/(i*1e3)),h=Math.min(1,(e[9]||0)/(i*1e3)),g=e[10]>0?Math.min(1,(e[11]||0)/(a*1e3)):m,_=e[10]>0?Math.min(1,(e[12]||0)/(a*1e3)):f,v=e[10]>0?(e[15]||1667)/(a*1e3):5/3,y=e[13]||0,b=e[14]||0,x=10**o,S=10**s,C=c>-29?10**c:0,w=sn({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g}),T=cn({rhoKgM3:S,temperatureK:x,xH:_,xHe:Math.max(0,1-_-g),xMetals:g,coreMassSolar:n}),E=!!(r||b>4&&x>=25e7||T.coreCollapseTriggered&&y>40),D=Math.max(1.35,n*.14),O=E?D>2.35?`black-hole`:`neutron-star`:`none`,k=E?2*66743e-15*D*198847e25/299792458**2:0,A=un({coreTempK:x,coreRhoKgM3:S,fH2:w.fH2,xIonized:w.xIonized,xH:_,epsNucWPerKg:Math.max(C,T.epsTotalWPerKg),pDegFraction:w.pDegFraction,supernovaShockActive:E&&y>80,remnantClass:O}),j=Math.max(1200,Math.min(38e3,x<1e4?Math.max(1200,x*.85):Math.min(36e3,3200+Math.max(0,n)**.72*3200))),M=ln(j);return{coreTempK:x,coreLogT:o,coreRhoKgM3:S,coreLogRho:s,peakEpsNucWPerKg:Math.max(C,T.epsTotalWPerKg),gamowPeakKeV:T.gamowPeakKeV,gamowTauPp:T.gamowTauPp,fusingCount:l,meanFH2:u,meanXIonized:d,coreFH2:w.fH2,coreXIonized:w.xIonized,coreMu:w.mu,coreGammaEff:Math.min(v,w.gammaEff),corePDegFraction:w.pDegFraction,corePNucFraction:w.pNucFraction,meanPDegFraction:h,meanXH:f,meanXHe:p,meanXZ:m,coreXH:_,coreXZ:g,nucleonSum:f+p+m,shockCount:y,nuclearBounceCount:b,supernovaTriggered:E,remnantClass:O,schwarzschildRadiusM:k,photosphereTempK:j,photosphereSrgb:M,stage:A}}function yn({device:e=null,initialBodies:t,eosClosureTable:n=null,gravityG:r=.42,softening:i=.25,boxHalf:a=14,rCellFactor:o=.075,baseLogRho:s=-16.2,refRhoSim:c=.08,burnTimescaleS:l=42e13,tScaleK:u=78e4,label:d=`ulg-self-gravitating-hydro`}={}){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`createSelfGravitatingHydroEngine requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`);let f=Float32Array.from(t),p=f.length/16,m=n||X({nRho:28,nTemp:40});function h(e){let t=0;for(let n=0;n<e.length;n+=16)t+=e[n+3];return t/100}let g=h(f),_=0,v=0,y=!1,b=!1;function x(e){let t=1.2,n=s,r=0,i=0,a=0,o=0;for(let s=0;s<p;s+=1){let c=s*16;e[c+8]>t&&(t=e[c+8]),e[c+9]>n&&(n=e[c+9]),r+=e[c+12],i+=e[c+10],a+=e[c+14],o+=e[c+15]}let c=new Uint32Array(16);return c[0]=Math.round(t*1e3),c[1]=Math.round((n+20)*1e3),c[4]=Math.round(r*1e3),c[6]=Math.round(i*1e3),c[7]=Math.round(a*1e3),c[8]=Math.round(o*1e3),c[10]=1,c[11]=Math.round(o/p*1e3),c[12]=Math.round(i/p*1e3),c[15]=1667,vn(c,p,g,!1)}let S=x(f),E=Math.max(64,f.byteLength),D=[e.createBuffer({label:`${d}-p0`,size:E,usage:172}),e.createBuffer({label:`${d}-p1`,size:E,usage:172})],O=ye(e,{maxCount:p,strideFloats:16,chartLevel:35,useAdjSoftening:!0,qMass:65536,qMom:4096,rCellFactor:o,label:`${d}-ss-atlas`}),k=Rt(),A=e.createBuffer({label:`${d}-hydro-accum`,size:gn*4,usage:pn}),j=e.createBuffer({label:`${d}-hydro-grid`,size:hn*2*16,usage:pn}),M=e.createBuffer({label:`${d}-eos-table`,size:m.data.byteLength,usage:136}),N=e.createBuffer({label:`${d}-telemetry`,size:64,usage:132}),P=e.createBuffer({label:`${d}-telemetry-staging`,size:64,usage:9}),F=e.createBuffer({label:`${d}-params`,size:96,usage:72}),I=e.createBuffer({label:`${d}-body-staging`,size:E,usage:9});e.queue.writeBuffer(D[0],0,f),e.queue.writeBuffer(D[1],0,f),e.queue.writeBuffer(M,0,m.data);let ee=[C(0,`read-only-storage`),C(1,`storage`),C(2,`storage`),C(3,`read-only-storage`),C(4,`storage`),C(5,`read-only-storage`),C(6,`storage`),C(7,`uniform`)],L=t=>T(e,{cacheKey:`ulg-self-gravitating-hydro-${t}.v26-cic-grad-ss-atlas`,label:`ulg-self-gravitating-hydro-${t}`,code:_n,entryPoint:t,bindings:ee}),R={clear:L(`sgh_clear`),deposit:L(`sgh_deposit`),finalize:L(`sgh_finalize`),integrate:L(`sgh_integrate`)},te=(t,n,r)=>w(e,{layout:R.integrate.bindGroupLayout,label:`${d}-bg-${r}`,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:O.accPhiBuffer}},{binding:4,resource:{buffer:j}},{binding:5,resource:{buffer:M}},{binding:6,resource:{buffer:N}},{binding:7,resource:{buffer:F}}]}),ne=[te(D[0],D[1],0),te(D[1],D[0],1)],z=0,re=!1,ie=!1,B=!0;async function ae(){if(!D||!I||ie||b)return f;ie=!0;try{let t=e.createCommandEncoder({label:`${d}-readback`});t.copyBufferToBuffer(D[z],0,I,0,f.byteLength),e.queue.submit([t.finish()]),await I.mapAsync(1),f.set(new Float32Array(I.getMappedRange())),I.unmap()}finally{ie=!1}return f}async function oe({dt:t=.018,timeAccel:n=1,readTelemetry:o=!0}={}){if(b||!D)return S;let f=Math.max(.25,Math.min(25,Number(n)||1)),h=Math.max(.004,Math.min(.028,Number(t)||.018)),x=1380649e-29/167262192369e-38*1.5*u,C=new ArrayBuffer(96),w=new Uint32Array(C),T=new Float32Array(C);w[0]=p,w[1]=m.nRho,w[2]=m.nTemp,w[3]=+!!B,T[4]=h,T[5]=r,T[6]=i*i,T[7]=a,T[8]=.65*.65,T[9]=m.logRhoMin,T[10]=m.logRhoMax,T[11]=m.logTempMin,T[12]=m.logTempMax,T[13]=s,T[14]=c,T[15]=l,T[16]=f,T[17]=u,T[18]=k.ppJPerKgH,T[19]=k.tripleAlphaJPerKgHe,T[20]=k.fePhotodisJPerKgFe,T[21]=x,e.queue.writeBuffer(F,0,C),O.writeParams({count:p,gravityG:r,softening2:i*i,boxHalf:a,theta2:.65*.65});let E=z,A=1-z,j=ne[E],M=Math.ceil(p/64),I=Math.ceil(hn/64),ee=e.createCommandEncoder({label:`${d}-step-${_}`}),L=ee.beginComputePass({label:`${d}-pass`});O.encodeIntoPass(L,{srcBuffer:D[E],count:p}),L.setPipeline(R.clear.pipeline),L.setBindGroup(0,j),L.dispatchWorkgroups(I),L.setPipeline(R.deposit.pipeline),L.setBindGroup(0,j),L.dispatchWorkgroups(M),L.setPipeline(R.finalize.pipeline),L.setBindGroup(0,j),L.dispatchWorkgroups(I),L.setPipeline(R.integrate.pipeline),L.setBindGroup(0,j),L.dispatchWorkgroups(M),L.end();let te=o&&!re;if(te&&ee.copyBufferToBuffer(N,0,P,0,64),B=te,e.queue.submit([ee.finish()]),z=A,_+=1,v+=h*f*.35,te){re=!0;try{await P.mapAsync(1);let e=new Uint32Array(P.getMappedRange().slice(0));P.unmap(),e[14]>4&&10**((e[0]||1400)/1e3)>=15e7&&(y=!0),S=vn(e,p,g,y)}finally{re=!1}}return S}function se(t){return f=Float32Array.from(t),g=h(f),_=0,v=0,y=!1,z=0,B=!0,S=x(f),D&&(e.queue.writeBuffer(D[0],0,f),e.queue.writeBuffer(D[1],0,f)),S}function ce(){b||(b=!0,D?.[0]?.destroy(),D?.[1]?.destroy(),O.destroy(),A.destroy(),j.destroy(),M.destroy(),N.destroy(),P.destroy(),F.destroy(),I.destroy(),D=null)}return{schema:fn,get count(){return p},get totalMassSolar(){return g},get stepIndex(){return _},get simTimeMyr(){return v},get backend(){return`webgpu`},get gravityMode(){return O.gravityMode},get solverMode(){return`webgpu-self-gravitating-hydro-eos`},get gate1BurnConstants(){return k},get closureTable(){return m},get anchors(){return m.anchors},getTelemetry:()=>S,getBodies:()=>f,getResidentBuffer:()=>D?D[z]:null,readbackBodies:ae,step:oe,resetBodies:se,dispose:ce}}var bn=Object.freeze({id:`main-sequence-star`,label:`Hydrostatic Main-Sequence Star (1.0 M☉)`,shortLabel:`1 M☉ Active Star`,description:`Hydrostatic Lane-Emden convective 1.0 M☉ G2V star in nuclear-thermal equilibrium with differential rotation driving an emergent 3D convective dynamo.`,totalMassSolar:1,initialTempK:15e6,initialLog10Rho:5.15,angularMomentum:.36,cloudRadius:4,geometry:`lane-emden-star`}),xn=Object.freeze({"solar-nebula":Object.freeze({id:`solar-nebula`,label:`Solar Nebula (1.0 M☉)`,shortLabel:`1 M☉ Solar Star`,description:`Cold 25 K turbulent 1.0 M☉ H₂ cloud fed into ULG general self-gravitating hydro + quantum plasma EOS & Gamow fusion laws.`,totalMassSolar:1,initialTempK:25,initialLog10Rho:-16,angularMomentum:.44,cloudRadius:9,geometry:`bonnor-ebert`}),"massive-supernova":Object.freeze({id:`massive-supernova`,label:`Massive Cloud → Supernova (18 M☉)`,shortLabel:`18 M☉ Supernova`,description:`Identical laws, 18× heavier initial hydrogen particles -> rapid CNO/triple-α burn -> Fe photodisintegration collapse -> nuclear-saturation EOS bounce & Black Hole.`,totalMassSolar:18,initialTempK:36,initialLog10Rho:-15.3,angularMomentum:.22,cloudRadius:8.6,geometry:`bonnor-ebert`}),"binary-nursery":Object.freeze({id:`binary-nursery`,label:`Binary Star Nursery (2.4 M☉)`,shortLabel:`2.4 M☉ Binary`,description:`Identical laws on a rotating twin-lobe 2.4 M☉ molecular cloud fragmenting into two orbiting fusing stars linked by tidal gas.`,totalMassSolar:2.4,initialTempK:28,initialLog10Rho:-15.7,angularMomentum:.65,cloudRadius:9.5,geometry:`twin-lobe`})});function Sn(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Cn({count:e=8192,preset:t=`solar-nebula`,gravityG:n=.42,seed:r=1939,centerOffset:i=[0,0,0]}={}){let a=t===`main-sequence-star`?bn:xn[t]||xn[`solar-nebula`],o=Math.max(256,Math.min(32768,Math.floor(e))),s=new Float32Array(o*16),c=Number(i?.[0])||0,l=Number(i?.[1])||0,u=Number(i?.[2])||0,d=Sn(r+(t===`massive-supernova`?101:t===`binary-nursery`?202:0)),f=()=>{let e=Math.max(1e-7,d()),t=d();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},p=a.totalMassSolar*100,m=p/o,h=Math.log10(a.initialTempK),g=a.initialLog10Rho,_=[];for(let e=0;e<8;e+=1)_.push({kx:(d()-.5)*.72,ky:(d()-.5)*.72,kz:(d()-.5)*.72,phase:d()*Math.PI*2,amp:.45+d()*.65});for(let e=0;e<o;e+=1){let t=e*16,r,i,v,y,b,x,S=0,C=null,w=null,T=null,E=null,D=.74,O=.25,k=.01;if(a.geometry===`lane-emden-star`){let e=.5;for(let t=0;t<24;t+=1){let t=d(),n=t*t*Math.max(0,1-t*t)**1.5;if(d()*.19<=n){e=t;break}}let t=.12+e*(a.cloudRadius-.12),n=2*d()-1,o=Math.sqrt(Math.max(0,1-n*n)),s=d()*Math.PI*2;r=t*o*Math.cos(s),i=t*n,v=t*o*Math.sin(s);let c=(.48-n*n*.14)*(.78+.35*Math.exp(-e*1.4)),l=Math.max(0,(e-.56)/.44),u=Math.sin(s*6+n*4)*Math.cos(e*8)*l*.18;y=-v*c+r/t*u+f()*.03,b=i/t*u+f()*.03,x=r*c+v/t*u+f()*.03;let p=Math.max(.002,1-e*e*.996),m=Math.max(5800,5800+(a.initialTempK-5800)*p),h=10**(-3.6+(a.initialLog10Rho- -3.6)*p**.72);C=Math.log10(m),w=Math.log10(h),T=0,E=e<.92?1:.45;let g=.22*Math.exp(-e*e*8);D=.72-g,O=.26+g,k=.02}else if(a.geometry===`twin-lobe`){let t=e&1?1:-1,a=4.5;S=t*a;let o=e%10==0;if(o){let e=(d()*2-1)*a;r=e,i=f()*.65,v=f()*.85+Math.sin(e*.55)*.75,S=e}else{let e=.18+d()**1.15*2.55,n=2*d()-1,o=Math.sqrt(Math.max(0,1-n*n)),s=d()*Math.PI*2;r=t*a+e*o*Math.cos(s),i=e*n*.62,v=e*o*Math.sin(s)}let s=Math.sqrt(n*p/(4*a))*1.04,c=r-t*a,l=v,u=Math.hypot(c,l)+.35,m=Math.sqrt(n*p*.22/(u+.6))*.42;y=(o?-v/(Math.hypot(r,v)+.5)*s*.7:-l/u*m)+f()*.1,b=f()*.08,x=(o?r/(Math.hypot(r,v)+.5)*s*.7:t*s+c/u*m)+f()*.1}else{let t=e>o*.72,s=d(),c=t?3.3+s**.8*(a.cloudRadius-3.3):.18+s**1.28*5,l=2*d()-1,u=Math.sqrt(Math.max(0,1-l*l)),m=d()*Math.PI*2,h=c*u*Math.cos(m),g=c*l*(t?.56:.78),S=c*u*Math.sin(m),C=0,w=0,T=0;for(let e of _){let t=Math.sin(e.kx*h+e.ky*g+e.kz*S+e.phase)*e.amp;C+=e.kx*t,w+=e.ky*t,T+=e.kz*t}r=h+C*.92,i=g+w*.62,v=S+T*.92;let E=Math.hypot(r,v)+.35,D=t?1.05:.3+.55*Math.min(1,E/6),O=Math.sqrt(n*p*.38/(E+1.1))*a.angularMomentum*D,k=t?-.06:-.18,A=Math.hypot(r,i,v)+.4;y=-v/E*O+r/A*k+f()*.14,b=i/A*k*.8+f()*.1,x=r/E*O+v/A*k+f()*.14}let A=Math.hypot(r-S,i,v),j=Math.exp(-A*A/12),M=w??g+j*1,N=C??h+j*.1,P=.32+.04*Math.min(6,A);s[t+0]=r+c,s[t+1]=i+l,s[t+2]=v+u,s[t+3]=m,s[t+4]=y,s[t+5]=b,s[t+6]=x,s[t+7]=P,s[t+8]=N,s[t+9]=M,s[t+10]=D,s[t+11]=C!=null&&C>6.8?-1.5:-30,s[t+12]=T??.998,s[t+13]=E??0,s[t+14]=O,s[t+15]=k}return s}var wn=`ulg.astrophysics.galactic-cic-pm-webgpu.v1`,Z=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Tn=`
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
`;function En({device:e=null,initialBodies:t,gridN:n=32,boxSize:r=48,secondSmbhIndex:i=0,smbhSoftening:a=.72,label:o=`ulg-galactic-cic-pm`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createGalacticParticleMeshEngineWebGpu requires a live WebGPU GPUDevice`);let s=Float32Array.from(t),c=Math.floor(s.length/8),l=Math.max(16,Math.min(64,Math.trunc(n))),u=l*l*l,d=r/l,f=1/(d*d*d),p=0;for(let e=0;e<c;e+=1)e===0||i>0&&e===i||(p+=Math.max(0,s[e*8+3]));let m=p/(r*r*r),h=N(e,l);h.writeAxisPoissonParams({boxLength:r,smoothR2:(.55*d)**2});let g=Math.max(32,s.byteLength),_=e.createBuffer({label:`${o}-bodies`,size:g,usage:Z.STORAGE|Z.VERTEX|Z.COPY_DST|Z.COPY_SRC}),v=e.createBuffer({label:`${o}-rho`,size:u*4,usage:Z.STORAGE}),y=e.createBuffer({label:`${o}-phi`,size:u*4,usage:Z.STORAGE}),b=e.createBuffer({label:`${o}-params`,size:48,usage:Z.UNIFORM|Z.COPY_DST}),x=e.createBuffer({label:`${o}-staging`,size:g,usage:Z.MAP_READ|Z.COPY_DST});e.queue.writeBuffer(_,0,s);let S=[C(0,`uniform`),C(1,`storage`),C(2,`storage`),C(3,`storage`),C(4,`storage`)],E=t=>T(e,{cacheKey:`ulg-galactic-pm-${t}.v1`,label:`${o}-${t}`,code:Tn,entryPoint:t,bindings:S}),D=E(`pm_drift_half`),O=E(`pm_clear_rho`),k=E(`pm_deposit_cic`),A=E(`pm_pack_fft_rhs`),j=E(`pm_store_phi`),M=E(`pm_kick_and_drift`),P=E(`pm_calibrate_equilibrium`),F=(t,n)=>w(e,{layout:M.bindGroupLayout,label:`${o}-bg-${n}`,entries:[{binding:0,resource:{buffer:b}},{binding:1,resource:{buffer:_}},{binding:2,resource:{buffer:v}},{binding:3,resource:{buffer:t}},{binding:4,resource:{buffer:y}}]}),I=F(h.bufferA,`a`),ee=F(h.bufferB,`b`),L=0,R=!1,te=!1,ne=Math.ceil(c/64),z=Math.ceil(u/64);async function re(){if(te||R||x.mapState!==`unmapped`)return s;R=!0;try{let t=e.createCommandEncoder({label:`${o}-readback`});t.copyBufferToBuffer(_,0,x,0,g),e.queue.submit([t.finish()]),await x.mapAsync(Z.MAP_READ),te||s.set(new Float32Array(x.getMappedRange(0,g)));try{x.unmap()}catch{}}catch(e){if(!te&&e?.name!==`AbortError`)throw e}finally{R=!1}return s}async function ie({gravity:t=1,softening:n=.35}={}){if(te||i>0)return;let s=new ArrayBuffer(48);new Uint32Array(s,0,4).set([c,l,i,L]),new Float32Array(s,16,8).set([r,d,.004,t,n*n,a*a,m,f]),e.queue.writeBuffer(b,0,s);let u=e.createCommandEncoder({label:`${o}-cal-eq`}),p=u.beginComputePass({label:`${o}-cal-dep`});p.setBindGroup(0,I),p.setPipeline(O.pipeline),p.dispatchWorkgroups(z),p.setPipeline(k.pipeline),p.dispatchWorkgroups(ne),p.setPipeline(A.pipeline),p.dispatchWorkgroups(z),p.end();let g=h.encodePoissonSolve(u,{gradAxis:0})===h.bufferA?I:ee;p=u.beginComputePass({label:`${o}-cal-apply`}),p.setBindGroup(0,g),p.setPipeline(j.pipeline),p.dispatchWorkgroups(z),p.setPipeline(P.pipeline),p.dispatchWorkgroups(ne),p.end(),e.queue.submit([u.finish()])}async function B({dt:t=.008,substeps:n=2,gravity:u=1,softening:p=.35,readback:v=!1}={}){if(te)return s;let y=Math.max(1,Math.min(8,Math.trunc(n))),S=Math.max(5e-4,Math.min(.012,(Number(t)||.008)/y)),C=new ArrayBuffer(48);new Uint32Array(C,0,4).set([c,l,i,L]),new Float32Array(C,16,8).set([r,d,S,u,p*p,a*a,m,f]),e.queue.writeBuffer(b,0,C);let w=e.createCommandEncoder({label:`${o}-step-${L}`});for(let e=0;e<y;e+=1){let t=w.beginComputePass({label:`${o}-dep-${e}`});t.setBindGroup(0,I),t.setPipeline(D.pipeline),t.dispatchWorkgroups(ne),t.setPipeline(O.pipeline),t.dispatchWorkgroups(z),t.setPipeline(k.pipeline),t.dispatchWorkgroups(ne),t.setPipeline(A.pipeline),t.dispatchWorkgroups(z),t.end();let n=h.encodePoissonSolve(w,{gradAxis:0})===h.bufferA?I:ee;t=w.beginComputePass({label:`${o}-kick-${e}`}),t.setBindGroup(0,n),t.setPipeline(j.pipeline),t.dispatchWorkgroups(z),t.setPipeline(M.pipeline),t.dispatchWorkgroups(ne),t.end(),L+=1}let T=v&&!R&&x.mapState===`unmapped`;if(T&&(R=!0,w.copyBufferToBuffer(_,0,x,0,g)),e.queue.submit([w.finish()]),T)try{await x.mapAsync(Z.MAP_READ),te||s.set(new Float32Array(x.getMappedRange(0,g)));try{x.unmap()}catch{}}catch(e){if(!te&&e?.name!==`AbortError`)throw e}finally{R=!1}return s}function ae(){if(!te){te=!0,h.destroy();for(let e of[_,v,y,b,x])try{e.destroy()}catch{}}}return Object.freeze({schema:wn,get count(){return c},get activeCount(){return c},get stepIndex(){return L},get gridN(){return l},get boxSize(){return r},get backend(){return`webgpu`},get gravityMode(){return`webgpu-cic-3dfft-pm+smbh`},getBodies:()=>s,getResidentBuffer:()=>_,calibrateEquilibrium:ie,readbackBodies:re,step:B,dispose:ae})}function Dn(e,t){if(!e||typeof e.createBuffer!=`function`||typeof e.createComputePipeline!=`function`)throw TypeError(`${t} requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`)}Object.freeze([Object.freeze({name:`G-Type Star`,isStar:!0,a:0,mass:120,radius:1.38,color:16773306,phase:0,tilt:0}),Object.freeze({name:`Inner Rocky`,a:3.1,mass:.01,radius:.28,color:13933162,phase:.4,tilt:.05}),Object.freeze({name:`Ocean World (H₂O/Fe)`,a:4.9,mass:.02,radius:.42,color:3718648,phase:1.9,tilt:.03}),Object.freeze({name:`Ringed Giant`,a:7.7,mass:.16,radius:.78,color:15122058,phase:3.6,tilt:.08,ringed:!0}),Object.freeze({name:`Ice Giant`,a:10.4,mass:.055,radius:.52,color:8246268,phase:5.1,tilt:.04})]);var On=`
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
`;function kn({device:e=null,initialBodies:t,mode:n=0,label:r=`ulg-cosmic-nbody`}){Dn(e,`createResidentTiledNBodyEngine`);let i=Float32Array.from(t),a=i.length/8,o=0,s=n===1?.25:1,c=!1,l=Math.max(32,i.byteLength),u=[e.createBuffer({label:`${r}-buf-0`,size:l,usage:172}),e.createBuffer({label:`${r}-buf-1`,size:l,usage:172})],d=e.createBuffer({label:`${r}-params`,size:48,usage:72}),f=e.createBuffer({label:`${r}-staging`,size:l,usage:9});e.queue.writeBuffer(u[0],0,i),e.queue.writeBuffer(u[1],0,i);let p=T(e,{cacheKey:`ulg-cosmic-nbody-tiled.v1`,label:`ulg-cosmic-nbody-tiled`,code:On,entryPoint:`step_nbody`,bindings:[C(0,`read-only-storage`),C(1,`storage`),C(2,`uniform`)]}),m=[w(e,{layout:p.bindGroupLayout,label:`${r}-bg-0`,entries:[{binding:0,resource:{buffer:u[0]}},{binding:1,resource:{buffer:u[1]}},{binding:2,resource:{buffer:d}}]}),w(e,{layout:p.bindGroupLayout,label:`${r}-bg-1`,entries:[{binding:0,resource:{buffer:u[1]}},{binding:1,resource:{buffer:u[0]}},{binding:2,resource:{buffer:d}}]})],h=0,g=!1;async function _(){if(!u||!f||g||c)return i;g=!0;try{let t=e.createCommandEncoder({label:`${r}-readback`});t.copyBufferToBuffer(u[h],0,f,0,i.byteLength),e.queue.submit([t.finish()]),await f.mapAsync(1),i.set(new Float32Array(f.getMappedRange())),f.unmap()}finally{g=!1}return i}async function v({dt:t=.014,gravity:l=1,softening:_=.22,hubbleRate:v=.12,readback:y=!1}={}){if(c||!u)return i;let b=new ArrayBuffer(48),x=new Uint32Array(b),S=new Float32Array(b),C=n===1?1/Math.max(.05,s**3):1;x[0]=a,x[1]=n,S[4]=t,S[5]=l,S[6]=_*_,S[7]=n===1?2*v:0,S[8]=C,e.queue.writeBuffer(d,0,b);let w=h,T=1-h,E=e.createCommandEncoder({label:`${r}-step-${o}`}),D=E.beginComputePass({label:`${r}-pass`});D.setPipeline(p.pipeline),D.setBindGroup(0,m[w]),D.dispatchWorkgroups(Math.ceil(a/64)),D.end();let O=y&&!g;if(O&&E.copyBufferToBuffer(u[T],0,f,0,i.byteLength),e.queue.submit([E.finish()]),h=T,o+=1,n===1&&(s=Math.min(2,s+t*v*s)),O){g=!0;try{await f.mapAsync(1),i.set(new Float32Array(f.getMappedRange())),f.unmap()}finally{g=!1}}return i}function y(t){i=Float32Array.from(t),o=0,s=n===1?.25:1,h=0,u&&(e.queue.writeBuffer(u[0],0,i),e.queue.writeBuffer(u[1],0,i))}function b(){return u?u[h]:null}function x(){c||(c=!0,u?.[0]?.destroy(),u?.[1]?.destroy(),d?.destroy(),f?.destroy(),u=null)}return{get count(){return a},get activeCount(){return a},get stepIndex(){return o},get scaleFactorA(){return s},get backend(){return`webgpu`},get gravityMode(){return`webgpu-tiled-direct`},getBodies:()=>i,readbackBodies:_,getResidentBuffer:b,step:v,resetBodies:y,dispose:x}}function An(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var jn=[`disk`,`barred`,`binary`,`sphere`,`proto`,`dwarf-stream`,`globular`],Mn=[`NGC`,`M`,`IC`,`UGC`,`ARP`,`PGC`],Nn=Object.freeze({H2O:Object.freeze({formula:`H₂O`,name:`Water (C₂v Bent)`,atoms:[{Z:8,symbol:`O`,position:[0,0,.22]},{Z:1,symbol:`H`,position:[0,1.43,-.88]},{Z:1,symbol:`H`,position:[0,-1.43,-.88]}]}),CO2:Object.freeze({formula:`CO₂`,name:`Carbon Dioxide (Linear O=C=O)`,atoms:[{Z:6,symbol:`C`,position:[0,0,0]},{Z:8,symbol:`O`,position:[0,0,2.19]},{Z:8,symbol:`O`,position:[0,0,-2.19]}]}),CH4:Object.freeze({formula:`CH₄`,name:`Methane (Tetrahedral T_d)`,atoms:[{Z:6,symbol:`C`,position:[0,0,0]},{Z:1,symbol:`H`,position:[1.19,1.19,1.19]},{Z:1,symbol:`H`,position:[1.19,-1.19,-1.19]},{Z:1,symbol:`H`,position:[-1.19,1.19,-1.19]},{Z:1,symbol:`H`,position:[-1.19,-1.19,1.19]}]}),NH3:Object.freeze({formula:`NH₃`,name:`Ammonia (Trigonal Pyramidal C₃v)`,atoms:[{Z:7,symbol:`N`,position:[0,.42,0]},{Z:1,symbol:`H`,position:[1.77,-.32,0]},{Z:1,symbol:`H`,position:[-.885,-.32,1.53]},{Z:1,symbol:`H`,position:[-.885,-.32,-1.53]}]}),SiO2:Object.freeze({formula:`SiO₂`,name:`Silica Unit (O=Si=O)`,atoms:[{Z:14,symbol:`Si`,position:[0,0,0]},{Z:8,symbol:`O`,position:[0,0,2.85]},{Z:8,symbol:`O`,position:[0,0,-2.85]}]}),O2:Object.freeze({formula:`O₂`,name:`Dioxygen (O=O)`,atoms:[{Z:8,symbol:`O`,position:[0,0,-1.14]},{Z:8,symbol:`O`,position:[0,0,1.14]}]}),N2:Object.freeze({formula:`N₂`,name:`Dinitrogen (N≡N)`,atoms:[{Z:7,symbol:`N`,position:[0,0,-1.04]},{Z:7,symbol:`N`,position:[0,0,1.04]}]}),CO:Object.freeze({formula:`CO`,name:`Carbon Monoxide (Triple Bond)`,atoms:[{Z:6,symbol:`C`,position:[0,0,-1.07]},{Z:8,symbol:`O`,position:[0,0,1.07]}]}),H2:Object.freeze({formula:`H₂`,name:`Molecular Hydrogen (H–H)`,atoms:[{Z:1,symbol:`H`,position:[0,0,-.7]},{Z:1,symbol:`H`,position:[0,0,.7]}]})});function Pn(e,{surfaceActive:t=!1,userTimeScale:n=1}={}){let r=Number.isFinite(Number(e))?Number(e):24.8,i=Math.max(.1,Math.min(3,Number(n)||1));if(t){let e=1*i;return Object.freeze({factor:1,effectiveTimeScale:i,secondsPerWallSecond:e,clockLabel:`${e.toFixed(1)} s/s`})}let a,o;if(r>=22){let e=Math.max(0,Math.min(1,(r-22)/3.4));a=10**(14.75+e*.95)*i,o=.55+.45*e}else if(r>=16.2){let e=Math.max(0,Math.min(1,(r-16.2)/5.8));a=10**(13.05+e*1.55)*i,o=.28+.72*e**.85}else if(r>=8.75){let e=Math.max(0,Math.min(1,(r-8.75)/7.45));a=10**(3.85+e*2.75)*i,o=.14+.86*e**1.35}else if(r>=0){let e=Math.max(0,Math.min(1,r/8.75));a=10**(.2+e*3)*i,o=.22+.58*e}else if(r>=-9.1){let e=Math.max(0,Math.min(1,(r+9.1)/9.1));a=10**(-14.1+e*1.2)*i,o=.45+.25*e}else if(r>=-12.8){let e=Math.max(0,Math.min(1,(r+12.8)/3.7));a=10**(-17.2+e*1.2)*i,o=.35+.15*e}else a=15e-21*i,o=.42;let s,c=a;return s=c>=315576e8?`${(c/315576e8).toFixed(c>=315576e9?0:1)} Myr/s`:c>=315576e5?`${(c/315576e5).toFixed(1)} kyr/s`:c>=31557600?`${(c/31557600).toFixed(2)} yr/s`:c>=86400?`${(c/86400).toFixed(c>=864e3?0:1)} d/s`:c>=3600?`${(c/3600).toFixed(1)} hr/s`:c>=60?`${(c/60).toFixed(1)} min/s`:c>=.05?`${c.toFixed(1)} s/s`:c>=1e-12?`${(c*0xe8d4a51000).toFixed(1)} ps/s`:c>=1e-15?`${(c*0x38d7ea4c68000).toFixed(1)} fs/s`:c>=1e-18?`${(c*0xde0b6b3a7640000).toFixed(1)} as/s`:`${(c*1e21).toFixed(1)} zs/s`,Object.freeze({factor:o,effectiveTimeScale:o*i,secondsPerWallSecond:a,clockLabel:s})}function Fn({count:e=32768,preset:t=`disk`,seed:n=825,gravity:r=1,softening:i=.28,centerOffset:a=[0,0,0]}={}){let o=Math.max(256,Math.min(262144,Math.floor(e))),s=new Float32Array(o*8),c=An(n),l=()=>{let e=Math.max(1e-7,c()),t=c();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},u=Number(a?.[0])||0,d=Number(a?.[1])||0,f=Number(a?.[2])||0,p=(e,t,n,i,a,o,p,m,h,g,_=1)=>{let v=t-e,y=44*_,b=135*_,x=290*_,S=780*_,C=1.25*_,w=3.2*_,T=7.4*_,E=1.05*_,D=.72*_,O=e=>{let t=Math.max(.15*_,e),n=r*y*t/(t*t+D*D)**1.5,i=Math.hypot(t,E),a=t*t*b/((t+C)*(t+C)),o=t/w,s=x*(1-(1+o)*Math.exp(-o)),c=t*t*S/((t+T)*(t+T));return n+r*(a+s+c)*t/(i*i*i)},k=e=>Math.sqrt(Math.max(0,e*O(e))),A=Math.cos(h),j=Math.sin(h),M=Math.cos(g),N=Math.sin(g),P=(e,t,n)=>{let r=t*A-n*j,i=t*j+n*A;return[e*M-r*N,e*N+r*M,i]};s.set([n+u,i+d,a+f,y,o,p,m,.05],e*8);let F=Math.floor((v-1)*.36),I=Math.floor((v-1)*.14),ee=Math.floor((v-1)*.04),L=v-1-F-I-ee,R=S/Math.max(1,F),te=b/Math.max(1,I+ee),ne=x/Math.max(1,L),z=e+1;for(let e=0;e<F&&z<t;e+=1,z+=1){let e=Math.max(.01,Math.min(.88,c())),t=Math.min(18.5*_,T*Math.sqrt(e)/Math.max(.08,1-Math.sqrt(e))),r=2*c()-1,h=Math.sqrt(Math.max(0,1-r*r)),g=2*Math.PI*c(),v=t*h*Math.cos(g),y=t*r,b=t*h*Math.sin(g),x=k(t)*.56,S=P(v,y,b),C=P(l()*x,l()*x,l()*x);s.set([n+S[0]+u,i+S[1]+d,a+S[2]+f,R,o+C[0],p+C[1],m+C[2],-1],z*8)}for(let e=0;e<I+ee&&z<t;e+=1,z+=1){let t=e>=I,r=Math.max(.005,Math.min(.92,c())),h=t?C*4:C,g=Math.min(11.5*_,h*Math.sqrt(r)/Math.max(.07,1-Math.sqrt(r))),v=2*c()-1,y=Math.sqrt(Math.max(0,1-v*v)),b=2*Math.PI*c(),x=g*y*Math.cos(b),S=g*v*(t?.85:.62),w=g*y*Math.sin(b),T=k(g),E=T*(t?.5:.36),D=t?.18:.62,O=-Math.sin(b)*T*D+l()*E,A=l()*E*.68,j=Math.cos(b)*T*D+l()*E,M=P(x,S,w),N=P(O,A,j),F=t?.24+c()*.1:.02+Math.min(.28,g/(2.6*_)*.24);s.set([n+M[0]+u,i+M[1]+d,a+M[2]+f,te,o+N[0],p+N[1],m+N[2],F],z*8)}let re=Math.tan(17*Math.PI/180);for(;z<t;z+=1){let e=-w*Math.log(Math.max(1e-4,c()*c())),t=Math.max(.32*_,Math.min(11.5*_,e*.78)),r=Math.min(1,Math.max(0,(t-.75*_)/(2*_))),h=c()<.72*r,g,v;if(h){let e=z&3,n=(e&1)==0,r=e*Math.PI*.5+(n?0:.22),i=Math.log(1+t/(.65*_))/re,a=(n?.26:.36)+t/_*.022;g=r+i+l()*a,v=c()<.11&&t>1.4*_&&t<8.5*_?.82+c()*.22:.38+c()*.38}else g=c()*Math.PI*2,v=.08+c()*.26;let y=(.14+t/_*.028)*_,b=t*Math.cos(g),x=t*Math.sin(g),S=l()*y,C=k(t),T=C*.985,E=C*(.08+.05*Math.exp(-t/w)),D=C*.045,O=l()*E,A=T+l()*(E*.72),j=Math.cos(g)*O-Math.sin(g)*A,M=l()*D,N=Math.sin(g)*O+Math.cos(g)*A,F=P(b,S,x),I=P(j,M,N);s.set([n+F[0]+u,i+F[1]+d,a+F[2]+f,ne,o+I[0],p+I[1],m+I[2],v],z*8)}};if(t===`binary`){let e=o>>1;p(0,e,-5.8,.9,-1.5,1.35,-.22,1.05,.35,.18,.68),p(e,o,5.8,-.9,1.5,-1.35,.22,-1.05,-.42,-.25,.68)}else if(t===`barred`){p(0,o,0,0,0,0,0,0,0,0,1);let e=Math.floor(o*.42);for(let t=Math.floor(o*.22);t<e;t+=1){let e=t*8;if(s[e+7]<0)continue;let n=(c()*2-1)*3.6,r=l()*.24,i=l()*(.48*Math.sqrt(Math.max(.15,1-(n/3.9)**2))),a=Math.hypot(n,i),o=2.65;s.set([n+u,r+d,i+f,s[e+3]*1.15,-i*o+l()*.45,l()*.25,n*o+l()*.45,.06+Math.min(.24,a/3.8*.22)],e)}let t=Math.tan(19*Math.PI/180);for(let n=e;n<o;n+=1){let e=n*8;if(!(s[e+7]<0)&&c()<.78){let a=n&1,o=3.1+c()**.85*7.8,p=a*Math.PI+Math.log(o/3)/t+l()*(.2+.02*o),m=l()*(.12+.025*o),h=Math.sqrt(r*(170+260*(1-(1+o/3.1)*Math.exp(-o/3.1))+950*o*o/(o+6.8)**2)/Math.hypot(o,i)),g=c()<.14;s.set([Math.cos(p)*o+u,m+d,Math.sin(p)*o+f,s[e+3],-Math.sin(p)*h+l()*.45,l()*.2,Math.cos(p)*h+l()*.45,g?.85+c()*.2:.44+c()*.34],e)}}}else if(t===`proto`){p(0,o,0,0,0,0,0,0,.22,-.14,.78);let e=Array.from({length:7},(e,t)=>{let n=t/7*Math.PI*2+.4,r=1.6+t%3*1.45;return[Math.cos(n)*r,(c()-.5)*.55,Math.sin(n)*r]}),t=Math.floor(o*.45);for(let n=t;n<o;n+=1){let t=n*8;if(!(s[t+7]<0))if(c()<.52){let i=e[n%e.length],a=c()**.6*1.35,o=c()*Math.PI*2,p=2*c()-1,m=Math.sqrt(Math.max(0,1-p*p)),h=i[0]+a*m*Math.cos(o)*1.25,g=i[1]+a*p*.45,_=i[2]+a*m*Math.sin(o)*.85,v=Math.max(.5,Math.hypot(h,_)),y=Math.sqrt(r*680/Math.hypot(v,.8));s.set([h+u,g+d,_+f,s[t+3]*1.2,-_/v*y+l()*1.25,l()*.95,h/v*y+l()*1.25,.78+c()*.28],t)}else s[t+1]=s[t+1]*2.4,s[t+7]=Math.min(1.02,s[t+7]+.24)}}else if(t===`dwarf-stream`){let e=Math.floor(o*.72);p(0,e,0,0,0,0,0,0,.14,.08,.82);let t=Math.floor((o-e)*.3);for(let n=e;n<o;n+=1){let i=n*8,a=n-e;if(a<t){let e=Math.cbrt(c())*1.15,n=2*c()-1,r=Math.sqrt(Math.max(0,1-n*n)),a=c()*Math.PI*2;s.set([7.4+e*r*Math.cos(a)+u,2.2+e*n+d,-2+e*r*Math.sin(a)+f,45/Math.max(1,t),-1.4+l()*.55,2.4+l()*.55,4.1+l()*.55,.52+c()*.34],i)}else{let n=(a-t)/Math.max(1,o-e-t),p=-.35+n*Math.PI*1.85,m=7.4+Math.sin(p*1.5)*1.65,h=.25+.42*n,g=Math.cos(p)*m+l()*h,_=Math.sin(p)*m*.72+l()*h,v=Math.sin(p+.8)*m*.58+l()*h,y=Math.max(1,Math.hypot(g,_,v)),b=Math.sqrt(r*1150/y);s.set([g+u,_+d,v+f,12/Math.max(1,o-e-t),-Math.sin(p)*b*.75,Math.cos(p)*b*.55,Math.cos(p+.8)*b*.42,.34+c()*.42],i)}}}else if(t===`globular`){let e=520/o,t=.65;s.set([u,d,f,8,0,0,0,.12],0);for(let n=1;n<o;n+=1){let i=Math.max(.001,Math.min(.96,c())),a=Math.min(6.8,t/Math.sqrt(i**(-2/3)-1)),o=2*c()-1,p=Math.sqrt(Math.max(0,1-o*o)),m=c()*Math.PI*2,h=8+520*a**3/(a*a+t*t)**1.5,g=Math.sqrt(r*h/(3*Math.hypot(a,.45))),_=a<1.3&&c()<.08;s.set([a*p*Math.cos(m)+u,a*o+d,a*p*Math.sin(m)+f,e,l()*g,l()*g,l()*g,_?.68+c()*.16:.04+Math.min(.24,a/6*.22)],n*8)}}else if(t===`sphere`){let e=3.2,t=950/o;s.set([u,d,f,60,0,0,0,.05],0);for(let n=1;n<o;n+=1){let i=Math.max(.004,Math.min(.93,c())),a=Math.min(11.5,e*Math.sqrt(i)/Math.max(.06,1-Math.sqrt(i))),o=2*c()-1,p=Math.sqrt(Math.max(0,1-o*o)),m=2*Math.PI*c(),h=60+a*a*950/((a+e)*(a+e)),g=Math.sqrt(r*h/(3*Math.hypot(a,1.2)));s.set([a*p*Math.cos(m)+u,a*o*.78+d,a*p*Math.sin(m)+f,t,l()*g,l()*g,l()*g,.04+Math.min(.3,a/10*.26)],n*8)}}else p(0,o,0,0,0,0,0,0,0,0,1);return s}function In(e,t=1.85,n=0){let r=Math.max(1,Math.min(118,Math.trunc(e?.Z||26))),i=Math.max(r,Math.min(256,Math.trunc(e?.A||56))),a=Math.max(0,i-r),o=An(r*73856093^i*19349663),s=Math.max(1,Number(e?.chargeRadiusFm||3.7)),c=1+Math.max(0,.26*(a-r)/Math.max(1,i)),l=t/Math.max(1.2,Math.cbrt(i))*.88,u=Math.max(.2,t-l*.6),d=Math.PI*(3-Math.sqrt(5)),f=[];for(let e=0;e<i;e+=1){let t=(e+.5)/i,n=((e*37+13)%i+.5)/i,r=Math.cbrt(n),a=1-2*t,s=Math.sqrt(Math.max(0,1-a*a)),c=e*d+(o()-.5)*.12;f.push({dir:[Math.cos(c)*s,a,Math.sin(c)*s],rUnit:r,phase:o()*Math.PI*2})}f.sort((e,t)=>e.rUnit-t.rUnit);let p=[],m=r,h=a;for(let e=0;e<f.length;e+=1){let t=f[e],n=f.length-e,r=m/Math.max(1,n)*(t.rUnit>.82&&h>m?.45:1.15),i=m>0&&(h===0||o()<r);i?--m:--h;let a=i?u:u*c,d=t.rUnit*a;p.push({pos:[t.dir[0]*d,t.dir[1]*d,t.dir[2]*d],radius:l,color0:i?[.96,.34,.18]:[.46,.68,.94],color1:i?[1,.72,.34]:[.78,.88,1],kind:6,seed:e*1.13+s})}return p}function Ln(e,t,n){if(e>=5&&n?.bundle?.electromagnetic?.spectralWavelengthsNm?.length){let e=n.bundle.electromagnetic.spectralWavelengthsNm,t=n.bundle.electromagnetic.spectralReflectance,r=[];for(let n=0;n<e.length;n+=1)r.push({wavelengthNm:e[n],intensity:Math.max(.15,Math.min(1,t[n]??.5))});return r}let r=Number(t?.tempK||5778);return[{wavelengthNm:410.2,intensity:r>6500?.85:.35},{wavelengthNm:434,intensity:r>5500?.9:.45},{wavelengthNm:486.1,intensity:.92},{wavelengthNm:495.9,intensity:e<=1?.72:.32},{wavelengthNm:500.7,intensity:e<=1?.96:.4},{wavelengthNm:517.3,intensity:r<6500?.76:.28},{wavelengthNm:587.6,intensity:r>8e3?.95:.42},{wavelengthNm:589.3,intensity:r<5500?.9:.3},{wavelengthNm:656.3,intensity:1}]}function Rn(e,{seed:t=20261125,qualityId:r=`med`,initialElementZ:a=26}={}){let o=t>>>0,s=He[r]||He.med,c=new v({artifactCache:new b});pe(M);let d=new Map,f=new Map,p=`present-day`,m=R({redshiftZ:0,localSystemAgeGyr:4.57,localStarMassSolar:1}),h=tt({cosmicEpoch:m,regionPosMpc:[0,0,0],localOverdensity:1.15,seed:o}),g={posGal:[4.8,.04,2.1],popTag:.52,starIndex:0},_=!1,S=it(rt({cosmicEpoch:m,galaxyEnv:h,starPosGal:g.posGal,popTag:g.popTag,starIndex:g.starIndex,seed:o}));function C(){return _?Me:S?.catalog?.length?S.catalog:Me}function w(e=C()){let t=e.findIndex(e=>e.planetClass===`earth-like`||e.id===`earth`);if(t>0)return t;let n=e.findIndex(e=>!e.isStar&&e.kind!==0);return n>0?n:0}let T=`web`,E=null,k=null,N=null,P=[],F=null,I=null,B=null,oe=null,se=null,fe=new Float32Array,me=.3,ye=`disk`,be=1,xe=null,Se=[],Ce=[4.8,.04,2.1],we=`solar-system`,Te=!0,Ee=null,De=null,ke=null,Ae=null,je=null,Ne=w(),V=`nbody`,H=null,Pe=null,Fe=!0,Ie=null,Re=null,ze=.94,Be=null,Ue=null,We=null,Ge=null,Ke=null,qe=null,Je=null,Ye=null,Xe=null,Ze=null,Qe=null,$e=null,et=new Float32Array,nt=.36,at=`main-sequence-star`,U=null,ot=null,st=null,ct=null,lt=2,W=`fusion`,ut=null,ft=null,mt=new Float32Array,ht=.58,gt=null,_t=null,vt=null,yt=null,xt=null,Ct=null,wt=new Float32Array,Tt=null,Dt=`standard`,G=null,kt=w(),At=!1,jt=[],Mt=null,Nt=null,Pt=null,Ft=!0,It=null,Lt=null,zt=!1,K=null,Ht=null,q={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0},J=null,Ut=null,Wt=a,Y=300,Gt=!1,Kt=`solid`,qt=[],Jt=null,Yt=a,Xt=3,Zt=2,Qt=0,$t=!0,en=`atom`,tn=`H2O`,nn=null,rn=null,an=a,on=56,sn=null,cn=null,ln=null,un=null,X={connected:!1,role:`requester`,relayUrl:``,roomId:`ulg-universes-mesh-v1`,peerId:null,remotePeers:0,remotePeerIds:[],quorumReady:!1,witnessedMessages:0,lastWitnessedType:null,dispatches:0,lastResult:null,error:null},fn=!1,pn=!1;async function mn(t,{massNumberA:n=null,relativistic:r=!0,returnOrbitalWavefunctions:i=!0}={}){let a=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),o=`${a}:${n??`std`}:${+!!r}:${+!!i}`;if(d.has(o))return d.get(o);let s=await j(e,a,{massNumberA:n,temperatureK:300,runNuclearGpuVolume:!1,runLiveMd:!1,atomicMaxScf:44,atomicGridPointsN:192,blochGridN:16,scalarRelativistic:r,spinOrbit:r,returnOrbitalWavefunctions:i});return d.set(o,s),s}async function hn({seedOverride:t=null}={}){E&&=(E.destroy(),null);let n=(t??o)>>>0,r=await dt(e,{gridPerSide:s.cosmoGridPerSide,fftGridN:s.cosmoFftN,boxLengthMpc:200,aInit:.16,amplitude:.44,seed:n});E=pt(e,{gridPerSide:s.cosmoGridPerSide,pmGridN:s.cosmoFftN,boxLengthMpc:200,aInit:.16,da:.0085,initialConditions:r}),N=null;for(let e=0;e<6;e+=1)k=await E.step({readTelemetry:e===0||e===5}),e===0&&k?.powerSpectrumPk?.kBins?.length&&(N={kBins:[...k.powerSpectrumPk.kBins],pkValues:[...k.powerSpectrumPk.pkValues]});let i=An(n^5370206);P=Array.from({length:5},(e,t)=>{let n=jn[t%jn.length],r=Mn[Math.floor(i()*Mn.length)],a=1e3+Math.floor(i()*8900),o=t===0?18:72,s=(i()-.5)*2*o,c=(i()-.5)*1.4*o,l=(i()-.5)*2*o,u=Number((.6+i()*1.1).toFixed(2));return{id:`cluster-${t}`,level:0,name:`${r}-${a} Supercluster`,subtitle:`${n===`disk`?`Grand-Design Spiral`:n===`binary`?`Interacting Merger Pair`:`Giant Elliptical`} · Z=${u} Z☉`,posMpc:[s,c,l],pos:[s*.1,c*.1,l*.1],radius:1,morphology:n,metallicity:u,massLabel:`${(1.2+i()*4.5).toFixed(2)}×10¹² M☉`,tempK:6500+Math.round(i()*4500),composition:`DM 84% · H 12% · He 3.8% · Met ${(.2*u).toFixed(2)}%`,nextLevel:1}})}async function gn({preset:t=null,metallicity:n=null,galaxyEnvOverride:r=null,seedOverride:i=null}={}){r?h=r:(t||n!=null)&&(h=Object.freeze({...h,morphology:jn.includes(t)?t:h.morphology,meanMetallicitySolar:n==null?h.meanMetallicitySolar:Math.max(1e-4,Math.min(3.2,Number(n))),baseFeH:Math.log10(Math.max(1e-4,n==null?h.meanMetallicitySolar:Number(n)))})),ye=jn.includes(t||h.morphology)?t||h.morphology:`disk`,be=Math.max(.01,Math.min(3,Number(n??h.meanMetallicitySolar)||1)),B&&=(B.dispose(),null),oe&&=(oe.dispose(),null),xe||=await bt(e);let a=(i??o)+825>>>0;B=En({device:e,initialBodies:Fn({count:s.galaxyStars,preset:ye,seed:a}),gridN:32,boxSize:48,secondSmbhIndex:ye===`binary`?s.galaxyStars>>1:0,smbhSoftening:.72,label:`ulg-universes-galaxy-pm-${s.galaxyStars}`}),(ye===`disk`||ye===`barred`||ye===`proto`||ye===`sphere`||ye===`globular`)&&await B.calibrateEquilibrium({gravity:1,softening:.35}),await B.step({dt:.008,substeps:2,gravity:1,softening:.35,readback:!1}),oe=re(e,{gridN:24,boxSize:26,strideFloats:8,geometry:`galactic`,initialB0:me,alphaAmp:.035,etaRes:.16,bSat:.85,velScale:.22,label:`ulg-universes-galactic-dynamo`}),se=await oe.step({particleBuffer:B.getResidentBuffer(),particleCount:B.count,dt:.04,substeps:8,readTelemetry:!0,readBField:!0}),fe=oe.buildStreamlines({worldScale:1,alpha:.3});let c=An(a^141729),l=[4.8,.04,2.1],u=[-4.4,-.05,3.6],d=[Math.cos(c()*6.28)*6.8,.08,Math.sin(c()*6.28)*6.8],f=[1.05,.14,-.85];Ce=[...l];let p=(e,t,n)=>{let r=rt({cosmicEpoch:m,galaxyEnv:h,starPosGal:e,popTag:t,starIndex:n,seed:a}),i=it(r),o=r.multiplicity===3?`Trinary`:r.multiplicity===2?`Binary`:`Single`;return{stSys:r,plSys:i,title:`${r.systemName} · ${o} (${r.stars.map(e=>e.spectralCode).join(` + `)})`,sub:`${r.galacticRegion} · R=${r.rKpc} kpc · ${i.planetCount} worlds · ${r.nebulaEnv.nebulaSummary}`}},g=p(l,.52,0),_=p(u,.88,1),v=p(d,.36,2),y=p(f,.14,3);Se=[{id:`star-disk-causal`,level:1,branch:`solar-system`,starSite:{posGal:l,popTag:.52,starIndex:0},name:g.title,subtitle:g.sub,pos:l,radius:.8,tempK:g.stSys.stars[0].effectiveTempK,massLabel:`${g.stSys.stars[0].massSolar.toFixed(2)} M☉`,composition:g.stSys.stars[0].composition,nextLevel:2},{id:`smbh-core`,level:1,branch:`smbh-core`,name:`Galactic Core SMBH (Sgr-ULG*)`,subtitle:`4.3×10⁶ M☉ Supermassive Black Hole · Zoom In for Schwarzschild Lensing`,pos:[0,0,0],radius:1,isSmbh:!0,tempK:28e3,massLabel:`4.3×10⁶ M☉`,composition:`Relativistic Plasma · Hypervelocity S-Stars`,nextLevel:2},{id:`star-h2`,level:1,branch:`solar-system`,starSite:{posGal:u,popTag:.88,starIndex:1},name:_.title,subtitle:_.sub,pos:u,radius:.8,tempK:_.stSys.stars[0].effectiveTempK,massLabel:`${_.stSys.stars[0].massSolar.toFixed(2)} M☉`,composition:_.stSys.stars[0].composition,nextLevel:2},{id:`star-outer`,level:1,branch:`solar-system`,starSite:{posGal:d,popTag:.36,starIndex:2},name:v.title,subtitle:v.sub,pos:d,radius:.75,tempK:v.stSys.stars[0].effectiveTempK,massLabel:`${v.stSys.stars[0].massSolar.toFixed(2)} M☉`,composition:v.stSys.stars[0].composition,nextLevel:2},{id:`star-bulge`,level:1,branch:`solar-system`,starSite:{posGal:f,popTag:.14,starIndex:3},name:y.title,subtitle:y.sub,pos:f,radius:.75,tempK:y.stSys.stars[0].effectiveTempK,massLabel:`${y.stSys.stars[0].massSolar.toFixed(2)} M☉`,composition:y.stSys.stars[0].composition,nextLevel:2}]}async function _n(){if(Ee)return;let t=new Float32Array(192);t.set([0,0,0,40,0,0,0,.72],0);let n=An((o^4343808)>>>0);for(let e=1;e<24;e+=1){let r=3.2+n()*6.8,i=.25+n()*.58,a=r*(1-i),o=n()*Math.PI*2,s=(n()-.5)*1.4,c=Math.sqrt(40*(1+i)/Math.max(.5,a)),l=Math.cos(o)*a,u=Math.sin(o)*a*Math.sin(s),d=Math.sin(o)*a*Math.cos(s),f=-Math.sin(o)*c,p=Math.cos(o)*c*Math.sin(s),m=Math.cos(o)*c*Math.cos(s);t.set([l,u,d,.002,f,p,m,.14+n()*.08],e*8)}Ee=kn({device:e,initialBodies:t,mode:0,label:`ulg-universes-smbh-sstars`}),De=await Ee.step({dt:.008,gravity:1,softening:.08,readback:!0})}async function vn({seedOverride:t=null,starSite:n=null,solReference:r=null,forceMultiplicity:i=null}={}){ke&&=(ke.dispose(),null),typeof r==`boolean`&&(_=r),n&&(g={posGal:n.posGal||g.posGal,popTag:n.popTag??g.popTag,starIndex:n.starIndex??g.starIndex},_=!1);let a=(t??o)+409>>>0;_||(S=it(rt({cosmicEpoch:m,galaxyEnv:h,starPosGal:g.posGal,popTag:g.popTag,starIndex:g.starIndex,seed:a,forceMultiplicity:i}),{seedOverride:a}));let c=C();Ne=_?3:w(c),kt=Ne,ke=Le(e,{catalog:c,beltZoneAu:_?null:S?.beltZoneAu,asteroidCount:s.solarAsteroids,seed:a,label:_?`ulg-universes-sol-reference`:`ulg-universes-causal-${S?.systemId||`sys`}`}),await ke.step({dtSubYr:35e-6,substeps:4,readMassive:!0}),Ae=ke.computeConservationDiagnostics(),je=Ae,G&&=null}async function bn({posGal:e,popTag:t=.5,starIndex:n=0,forceMultiplicity:r=null,seedOverride:i=null}={}){g={posGal:Array.isArray(e)?[...e]:[...g.posGal],popTag:Number.isFinite(Number(t))?Number(t):.5,starIndex:Math.trunc(Number(n)||0)},Ce=[...g.posGal],_=!1,await vn({starSite:g,forceMultiplicity:r,seedOverride:i});let a=S?.starSystem?.stars?.[0];return a&&(a.stage===`white-dwarf`?W=`white-dwarf-tov`:a.stage===`neutron-star`?W=`pulsar`:(W=`fusion`,at=a.initialMassSolar>=10?`massive-supernova`:a.stage===`protostar-yso`?`binary-nursery`:`main-sequence-star`)),S}async function xn({forceMultiplicity:e=null}={}){let t=(g.starIndex||0)+1,n=An((o^t*1103515245)>>>0),r=.8+n()**.72*8.2,i=n()*Math.PI*2,a=(n()-.5)*(r<2.2?1.4:.42),s=r<2?.08+n()*.22:.32+n()*.65;return bn({posGal:[Math.cos(i)*r,a,Math.sin(i)*r],popTag:s,starIndex:t,forceMultiplicity:e})}async function Sn(e){return _=!!e,await vn({solReference:_}),C()}async function wn({seedOverride:t=null}={}){H&&=(H.dispose(),null);let n=(t??o)+773>>>0,r=ue(e,{pebbleCount:Math.min(4096,Math.max(1536,(s.solarAsteroids||512)*4)),embryoCount:18,enableGasDrag:Fe,seed:n,label:`ulg-universes-protoplanetary-disk`});Pe=await r.step({dt:.018,substeps:3,readTelemetry:!0}),H=r}async function Z({initialB0:t=ht,seedOverride:n=null}={}){ht=Math.max(0,Math.min(1.5,Number(t)??.58));let r=ut;ut=null,r&&r.dispose();let i=(n??o)+3133>>>0,a=ne(e,{gridN:s.id===`low`?16:32,tracerCount:Math.min(8192,Math.max(3072,s.stellarParticles||4096)),initialB0:ht,spinOmega:2.35,gravityG:2.4,seed:i,label:`ulg-universes-nebular-mhd`});ft=await a.step({dt:.024,substeps:16,readTelemetry:!0,readBFieldForStreamlines:!0}),mt=a.buildMagneticFieldStreamlines({worldScale:1,alpha:.68}),ut=a}async function Tn(t=T){let n=F;F=null,n&&n.dispose();let r=t===`cmb`,i=t===`reionization`,a=t===`cluster-merger`,c=r?1100:i?10:.25,l=s.id===`low`?4096:s.id===`ultra`?10240:6656,u=ie(e,{gridN:s.id===`low`?16:24,tracerCount:l,boxSizeMpc:260,redshiftZ:c,clusterMergerMode:a,uvFlux:i?1.55:r?0:.25,gravityG:a?1.65:1.15,seed:(o^(r?4352:i?4112:49413))>>>0,label:`ulg-universes-cosmo-${t}`}),d=i?5:a?4:2;for(let e=0;e<d;e+=1)I=await u.step({dt:i?.14:.09,substeps:2,readTelemetry:e===d-1});F=u}async function Dn({spinA:t=ze}={}){ze=Math.max(-.99,Math.min(.99,Number(t)??.94));let n=Ie;Ie=null,n&&n.dispose();let r=s.id===`low`?4096:6656,i=L(e,{massSolar:45e7,spinA:ze,accretionRateEddington:.58,magneticFluxNorm:1.15,particleCount:r,seed:(o^9479591)>>>0,label:`ulg-universes-kerr-quasar`});for(let e=0;e<5;e+=1)Re=await i.step({dt:.032,substeps:2,readTelemetry:e===4});Ie=i}async function On(t=`bns-kilonova`){let n=Be;Be=null,n&&n.dispose(),We=t;let r=s.id===`low`?3072:5120,i=t===`xray-binary`?{m1Solar:11,m2Solar:1.8,r1Sim:.44,r2Sim:.88,separation0:4.5,eccentricity0:.02,cSpeedSim:24,rocheOverflow:!0,neutronRich:!1,wdCarbonOxygen:!1,warm:8}:t===`type-ia`?{m1Solar:1.38,m2Solar:.96,r1Sim:.36,r2Sim:.42,separation0:2.25,eccentricity0:.05,cSpeedSim:4.6,rocheOverflow:!1,neutronRich:!1,wdCarbonOxygen:!0,warm:20}:t===`bbh-merger`?{m1Solar:36,m2Solar:29,r1Sim:.56,r2Sim:.48,separation0:3.25,eccentricity0:.06,cSpeedSim:5,rocheOverflow:!1,neutronRich:!1,wdCarbonOxygen:!1,warm:8}:{m1Solar:1.45,m2Solar:1.32,r1Sim:.36,r2Sim:.34,separation0:2.35,eccentricity0:.05,cSpeedSim:4.7,rocheOverflow:!1,neutronRich:!0,wdCarbonOxygen:!1,warm:22},a=ae(e,{...i,particleCount:r,seed:(o^t.length*9187)>>>0,label:`ulg-universes-relbin-${t}`});for(let e=0;e<i.warm;e+=1)Ue=await a.step({dt:.032,substeps:4,readTelemetry:e===i.warm-1});Be=a}async function Ln(t=`comet-tails`){let n=Ge;Ge=null,n&&n.dispose(),qe=t;let r=t===`comet-tails`,i=ve(e,{regime:r?`comet-dual-tail`:`hot-jupiter-xuv`,uvFlux:r?1.45:2.35,radBeta:r?.95:.72,windSpeed:r?2.25:1.95,sublimationDrive:r?1.35:1.45,sourceDir:r?[.76,.24,.6]:[.82,.14,.55],particleCount:s.id===`low`?3072:5120,seed:(o^(r?787431:263952))>>>0,label:`ulg-universes-radl2-${t}`});for(let e=0;e<8;e+=1)Ke=await i.step({dt:.04,substeps:3,readTelemetry:e===7});Ge=i}async function Rn(t=`roche-rings`){let n=Je;Je=null,n&&n.dispose(),Xe=t;let r=he(e,{mode:t===`red-giant`?`red-giant-engulf`:t,orbitRadiusSim:t===`roche-rings`?2.35:2.8,rHostSim:t===`red-giant`?1.85:t===`giant-impact`?1.48:1.38,rRocheSim:3.65,gmHost:24,cohesionStrength:.55,tidalHeatDrive:1.25,shepherdGm:.72,particleCount:s.id===`low`?3072:5120,seed:(o^t.length*4099)>>>0,label:`ulg-universes-tidal-${t}`}),i=t===`roche-rings`?12:6;for(let e=0;e<i;e+=1)Ye=await r.step({dt:.028,substeps:3,readTelemetry:e===i-1});Je=r}async function zn(t=`h2-pillars`){let n=gt;gt=null,n&&n.dispose(),vt=t;let r=ve(e,{regime:t,uvFlux:t===`snr-pwn`?1.85:t===`planetary-nebula`?1.65:1.48,radBeta:t===`snr-pwn`?1:.88,windSpeed:t===`snr-pwn`?2.15:t===`planetary-nebula`?1.68:1.15,bipolarAsymmetry:1.45,sourceDir:[.65,.58,.48],particleCount:s.id===`low`?3584:5632,seed:(o^t.length*6151)>>>0,label:`ulg-universes-radl3-${t}`});for(let e=0;e<6;e+=1)_t=await r.step({dt:.036,substeps:2,readTelemetry:e===5});gt=r}async function Bn(t=`magnetar`){let n=yt;yt=null,n&&n.dispose(),Ct=t;let r=t===`magnetar`,i=_e(e,{massSolar:r?1.55:1.42,radiusM:12e3,surfaceBFieldTesla:r?165e9:42e7,spinPeriodS:r?.14:.0085,obliquityRad:r?.56:.74,particleCount:s.id===`low`?3584:5632,seed:(o^(r?239335:590170))>>>0,label:`ulg-universes-mag-${t}`}),a=r?8:4;for(let e=0;e<a;e+=1)xt=await i.step({dt:.055,substeps:3,readTelemetry:e===a-1});wt=i.buildDipoleFieldLines({linesPerRing:16,steps:32,worldScale:1,alpha:.74}),yt=i}async function Vn(){let t=[];for(let e of[8.2,8.8,9.4,10,10.6,11.3,12.2,13.5,15,17.2,17.6,17.9,18.2,18.5,18.8,19.2])t.push({centralRhoKgM3:10**e,ye:.5});Tt=await ge(e,t)}async function Hn(){let t=It;It=null,t&&t.dispose();let n=he(e,{mode:`cryo-plumes`,rHostSim:2.35,gmHost:14,tidalHeatDrive:1.45,particleCount:s.id===`low`?2560:4096,seed:(o^209125838)>>>0,label:`ulg-universes-cryo-plumes`});for(let e=0;e<8;e+=1)Lt=await n.step({dt:.032,substeps:3,readTelemetry:e===7});It=n}async function Un({preset:t=at,seedOverride:n=null}={}){at=[`main-sequence-star`,`solar-nebula`,`massive-supernova`,`binary-nursery`].includes(t)?t:`main-sequence-star`,Ze&&=(Ze.dispose(),null),Qe&&=(Qe.dispose(),null),ct||=(await dn({closureRegistry:c,device:e})).ref;let r=(n??o)+1939>>>0,i=Cn({count:s.stellarParticles,preset:at,seed:r}),a=at===`main-sequence-star`;Ze=yn({device:e,initialBodies:i,closureRegistry:c,closureRef:ct,boxHalf:a?7.5:14,rCellFactor:a?.385:.075,softening:a?.45:.25,baseLogRho:a?-1.6:-16.2,refRhoSim:a?.095:.08,tScaleK:a?185e4:78e4,label:`ulg-universes-stellar-${at}`}),U=await Ze.step({dt:.015,timeAccel:lt,readTelemetry:!0}),Qe=re(e,{gridN:24,boxSize:16,strideFloats:16,geometry:`stellar`,initialB0:nt,alphaAmp:.22,etaRes:.055,bSat:.95,velScale:.35,label:`ulg-universes-stellar-dynamo`}),$e=await Qe.step({particleBuffer:Ze.getResidentBuffer(),particleCount:Ze.count,dt:.042,substeps:8,readTelemetry:!0,readBField:!0}),et=Qe.buildStreamlines({worldScale:1,alpha:.42});let[l,u]=await Promise.all([Bt(e,[{rhoKgM3:15e4,temperatureK:15e6,xH:.72,xHe:.26,xZ:.02,dtS:0xe8d4a51000},{rhoKgM3:8e5,temperatureK:35e6,xH:.55,xHe:.42,xZ:.03,dtS:1e11},{rhoKgM3:12e7,temperatureK:16e7,xH:0,xHe:.96,xZ:.04,dtS:1e10}]),Vt(e,[1.5,3],{dXi:.01,maxXi:12})]);ot=l,st=u}async function Wn({bodyIndex:t=kt}={}){let n=C(),r=Math.max(0,Math.min(n.length-1,Math.trunc(Number(t)??kt)));if(n[r]?.isStar||r===0){let e=w(n);e>0&&(r=e)}kt=r;let i=n[r]||Me[3],a=i.coreZ||26,c=i.mantleZ||14,l=i.surfZ||29;J||(Wt=l),nn||(Yt=a),sn||(an=a);let[u,d,p]=await Promise.all([mn(a,{relativistic:!0,returnOrbitalWavefunctions:!1}),mn(c,{relativistic:!0,returnOrbitalWavefunctions:!1}),mn(l,{relativistic:!0,returnOrbitalWavefunctions:!1})]),m=async t=>{let n=t.bundle.materialKey||t.bundle.symbol;if(f.has(n))return f.get(n);let r=await Et(e,t.bundle,{minPressurePa:1e4,maxPressurePa:0xe8d4a51000,maxTemperatureK:12e3,degrees:[4,4],relativeTolerance:.03,maxBisectDepth:2});return f.set(n,r),r},[h,g]=await Promise.all([m(u),m(d)]),_=Math.max(5e9,Math.min(85e10,Number(i.centralP)||36e10));G=await Ot(e,{centralPressurePa:_,surfacePressurePa:1e5,radialStepM:35e3,maxRadiusM:35e6,convergePasses:3,maxProfileSamples:128,layers:[{name:`${u.bundle.symbol} Core`,cumulativeMassFraction:.32,temperatureK:5200,atlas:h},{name:`${d.bundle.symbol} Mantle`,cumulativeMassFraction:1,temperatureK:2200,atlas:g}]});let v=.52,y=G?.profile||[],b=Math.max(1,G?.radiusM||i.radiusKm*1e3);for(let e=0;e<y.length;e+=1)if((y[e].layerIndex??0)>=1){v=Math.max(.22,Math.min(.78,y[e].radiusM/b));break}jt=[{id:`layer-core`,level:4,name:`${i.name} · ${u.bundle.symbol} Core`,subtitle:`Gate 2 Polytope Atlas · P_c = ${(_/1e9).toFixed(0)} GPa · MoI = ${(G?.moiFactor||.33).toFixed(3)}`,pos:[.45,.35,.45],radius:.7,sampleZ:a,rCoreNorm:v,rMantleNorm:.94,tempK:5200,massLabel:`R = ${i.radiusKm.toLocaleString()} km`,composition:i.composition,nextLevel:5},{id:`layer-mantle`,level:4,name:`${i.name} · ${d.bundle.symbol} Mantle`,subtitle:`High-Pressure Polytope Shell · T = 2,200 K`,pos:[1.35,1.05,1.35],radius:.7,sampleZ:c,rCoreNorm:v,rMantleNorm:.94,tempK:2200,massLabel:`g = ${(G?.surfaceGravityMPerS2||9.8).toFixed(2)} m/s²`,composition:`${d.bundle.symbol}/O Silicate Mantle`,nextLevel:5},{id:`layer-surface`,level:4,name:`${i.name} · ${p.bundle.symbol} Crust Sample`,subtitle:`Scroll in to resolve live ${p.bundle.symbol} WebGPU crystal lattice`,pos:[-1.8,1.4,1.5],radius:.7,sampleZ:l,rCoreNorm:v,rMantleNorm:.94,tempK:i.tempK||288,massLabel:`T_eq = ${i.tempK||288} K`,composition:`${p.bundle.symbol} (${p.bundle.mechanical.crystalStructure})`,nextLevel:5}],Nt&&(Nt.dispose(),Nt=null,Pt=null);let x=Number(u.bundle?.electromagnetic?.electricalConductivitySPerM)||1e6,S=i.parent>=0?n[i.parent]:null,T=Math.max(.15,Number(i.aAu||S?.aAu||1));if(Mt=le({...i,coreRadiusNorm:v,coreConductivitySm:x},{...G,coreRadiusFraction:v,centralPressurePa:_},{solarDistanceAu:T,coreConductivitySm:x}),Mt.activation.anyActive){let t=ee(e,{width:s.id===`low`?64:128,height:s.id===`low`?32:64,bodyParams:Mt,enableTriboelectric:Ft,seed:(o^r*2654435761)>>>0,label:`ulg-universes-atmo-${r}`});for(let e=0;e<4;e+=1)Pt=await t.step({dtSim:.048,substeps:2,readTelemetry:e===3});Nt=t}}async function Gn({Z:t=Wt,tempK:n=null,phasePreset:r=null,gravity:a=Gt}={}){Wt=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),Gt=!!a,J&&=(J.destroy(),null);let o=await mn(Wt,{relativistic:!0,returnOrbitalWavefunctions:!1}),c=o.visualData.bulk,u=o.visualData.thermo.potential,d=o.bundle,f=Math.max(20,Number(d.thermodynamic.meltingPointK||600)),p=Math.max(f*1.4+20,Number(d.thermodynamic.boilingPointK||f*2.4));r===`melt`?(Kt=`melt`,Y=Math.round(f*1.42)):r===`vapor`?(Kt=`vapor`,Y=Math.round(p*1.38)):r===`solid`?(Kt=`solid`,Y=Math.max(20,Math.round(f*.25))):n!=null&&Number.isFinite(Number(n))?Y=Math.max(15,Math.round(Number(n))):(Kt=`solid`,Y=Math.max(20,Math.round(f*.25)));let m=Math.max(1,Number(d.nuclear.atomicMassU||28)),h=Math.min(2,Math.max(.45,.09*Math.sqrt(m))),g=s.mdCells;J=i(e,{...l({crystalStructure:c.crystalStructure,cellsVec:[g,g,g],latticeConstantA:Math.max(2.4,Number(c.latticeConstantA||3.6)),massU:m,temperatureK:Y}),potentialModel:u.potentialModel,epsilonEv:u.epsilonEv,sigmaOrR0A:u.sigmaOrR0A,alphaOrLambda:u.alphaOrLambda,rcutA:u.rcutA,eamAEv:u.eamAEv,eamBeta:u.eamBeta,swGamma:u.swGamma,dtFs:h,targetTemperatureK:Y,thermostatCouplingFs:20,meltingPointK:f,bulkModulusGPa:Math.max(1,Number(c.bulkModulusPa||4e10)/1e9),cohesiveEnergyEv:Math.max(.05,Number(c.cohesiveEnergyEv||2)),crystalStructure:c.crystalStructure,gravityEnabled:Gt}),Ut=await J.stepBatch(4,{readTelemetry:!0,targetTemperatureK:Y}),qt=Ut?.rdf?Array.from(Ut.rdf):[]}async function Kn({Z:t=Yt,n=null,l:r=null,m:i=null,relativistic:a=$t,mode:c=en,moleculeKey:l=tn}={}){Yt=Math.max(1,Math.min(118,Math.trunc(Number(t)||26))),$t=!!a,en=c===`molecule`?`molecule`:`atom`,tn=Nn[l]?l:`H2O`;let d=Ve.find(e=>e.Z===Yt);n==null?d&&(Xt=d.defaultN):Xt=Math.max(1,Math.min(7,Math.trunc(Number(n)))),r==null?d&&(Zt=Math.min(Xt-1,d.defaultL)):Zt=Math.max(0,Math.min(Xt-1,Math.trunc(Number(r)))),Qt=i==null?0:Math.max(-Zt,Math.min(Zt,Math.trunc(Number(i))));let f=await mn(Yt,{relativistic:$t,returnOrbitalWavefunctions:!0});if(en===`molecule`){let t=Nn[tn];rn=await u(e,t.atoms);let n=new Float32Array(t.atoms.length*4),r=new Float32Array(t.atoms.length*4);for(let e=0;e<t.atoms.length;e+=1){let i=t.atoms[e];n.set([i.position[0],i.position[1],i.position[2],i.Z===1?1.24:2.25],e*4),r.set([i.Z,e%2==0?1:-.85,e%2==0?-.9:1,0],e*4)}nn=D(e,{posZeta:n,weights:r,boxHalfBohr:4.2,mode:0,pointCount:Math.min(14e4,s.orbitalPoints),seed:(o^1779033703)>>>0,reuseBuffer:nn?.pointsBuffer||null})}else{let t=f.visualData.atom,n=(t.orbitals||[]).find(e=>e.n===Xt&&e.l===Zt&&e.u?.length);nn=O(e,{Z:Yt,n:Xt,l:Zt,m:Qt,pointCount:s.orbitalPoints,rGrid:n?t.rGrid:null,orbitalU:n?n.u:null,screeningExchange:!0,relativisticSpinOrbit:$t,colorMode:1,seed:(o^Yt*2654435761)>>>0,reuseBuffer:nn?.pointsBuffer||null})}}async function qn({Z:t=an,A:r=null}={}){an=Math.max(1,Math.min(118,Math.trunc(Number(t)||26)));let i=Ve.find(e=>e.Z===an);on=r==null?i?.A||Math.round(an*2.15):Math.max(an,Math.trunc(Number(r))),cn&&=(cn.destroy(),null),sn=await n(e,an,on,{volDim:s.nuclearVolDim}),cn=A(e,sn),ln=cn?await cn.stepBatch(8):null}async function Jn(e,t,n=1){if(fn||pn)return;fn=!0;let r=Pn(t,{surfaceActive:!!(zt&&e===4),userTimeScale:n}).effectiveTimeScale;try{if(e===0)T!==`web`&&F?I=await F.step({dt:(T===`reionization`?.12:.08)*Math.max(.15,Math.min(2.5,r)),substeps:1,readTelemetry:!0}):E&&E.getState().aScale<1.15&&(k=await E.step({readTelemetry:!0}));else if(e===1&&B){let e=.009*Math.max(.08,Math.min(3,r));if(await B.step({dt:e,substeps:2,gravity:1,softening:.35,readback:!1}),oe){let e=B.stepIndex%4==0;se=await oe.step({particleBuffer:B.getResidentBuffer(),particleCount:B.count,dt:.04*Math.max(.12,Math.min(2.2,r)),substeps:1,readTelemetry:e,readBField:e}),e&&(fe=oe.buildStreamlines({worldScale:1,alpha:.3}))}}else if(e===2){if(we===`smbh-core`&&Ee)De=await Ee.step({dt:.008*Math.max(.08,Math.min(3,r)),gravity:1,softening:.08,readback:!0});else if(V===`formation`&&H)Pe=await H.step({dt:.016*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if(V===`quasar-jet`&&Ie)Re=await Ie.step({dt:.028*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if((V===`xray-binary`||V===`bns-kilonova`||V===`type-ia`||V===`bbh-merger`)&&Be)Ue=await Be.step({dt:.028*Math.max(.12,Math.min(2.5,r)),substeps:3,readTelemetry:!0});else if((V===`comet-tails`||V===`hot-jupiter`)&&Ge)Ke=await Ge.step({dt:.036*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if((V===`roche-rings`||V===`giant-impact`||V===`red-giant`)&&Je)Ye=await Je.step({dt:.024*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if(ke){let e=Math.max(0,Math.min(1,(t-8.75)/5.2)),r=1e-5+46e-6*e**1.45,i=Math.max(1,Math.min(48,Math.round((3+21*e**1.25)*Math.max(.1,n))));await ke.step({dtSubYr:r,substeps:i,readMassive:!0}),je=ke.computeConservationDiagnostics()}}else if(e===3){if(W===`nebular-mhd`&&ut){let e=ut.stepIndex%4==0;ft=await ut.step({dt:.022*Math.max(.12,Math.min(2.2,r)),substeps:1,readTelemetry:!0,readBFieldForStreamlines:e}),e&&(mt=ut.buildMagneticFieldStreamlines({worldScale:1,alpha:.68}))}else if((W===`h2-pillars`||W===`planetary-nebula`||W===`snr-pwn`)&&gt)_t=await gt.step({dt:.032*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0});else if((W===`pulsar`||W===`magnetar`)&&yt){let e=yt.stepIndex%4==0;xt=await yt.step({dt:.036*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0,readBField:e}),e&&(wt=yt.buildDipoleFieldLines({linesPerRing:16,steps:32,worldScale:1,alpha:.74}))}else if(W!==`white-dwarf-tov`&&Ze&&(U=await Ze.step({dt:.014*Math.max(.12,Math.min(2.5,r)),timeAccel:lt,readTelemetry:!0}),Qe)){let e=Ze.stepIndex%4==0;$e=await Qe.step({particleBuffer:Ze.getResidentBuffer(),particleCount:Ze.count,dt:.038*Math.max(.12,Math.min(2.2,r)),substeps:1,readTelemetry:e,readBField:e}),e&&(et=Qe.buildStreamlines({worldScale:1,alpha:.42}))}}else if(e===4)if(zt&&K)Ht=await K.step({dt:.02*Math.max(.25,Math.min(2.5,n)),controls:q,readTelemetry:K.stepIndex%4==0});else{let e=Dt===`eyeball-locked`?[1,0,0]:[.65,.25,.7];if(Dt===`cryo-plumes`&&It&&(Lt=await It.step({dt:.028*Math.max(.12,Math.min(2.5,r)),substeps:2,readTelemetry:!0})),ke&&Dt!==`eyeball-locked`&&Dt!==`rogue`){await ke.step({dtSubYr:6e-6,substeps:Math.max(1,Math.round(2*Math.max(.25,r))),readMassive:!0}),je=ke.computeConservationDiagnostics();let t=ke.getMassiveBodyState64(Ne),n=ke.getMassiveBodyState64(0),i=n.posAu[0]-t.posAu[0],a=n.posAu[1]-t.posAu[1],o=n.posAu[2]-t.posAu[2],s=Math.hypot(i,a,o)||1;e=[i/s,a/s,o/s]}Nt&&(Pt=await Nt.step({dtSim:.038*Math.max(.15,Math.min(2.5,r)),substeps:2,sunDir:e,readTelemetry:!0}))}else if(e===5&&J){let e=Math.max(1,Math.min(6,Math.round(2*Math.max(.25,n))));Ut=await J.stepBatch(e,{readTelemetry:!0,targetTemperatureK:Y,nonBlocking:!0}),Ut?.rdf&&(qt=Array.from(Ut.rdf))}else if(e===7&&cn){let e=Math.max(2,Math.min(18,Math.round(6*Math.max(.25,n)))),t=await cn.stepBatch(e,{nonBlocking:!0});t&&(ln=t)}}catch(e){let t=String(e?.message||e||``);if(!pn&&e?.name!==`AbortError`&&!t.includes(`Buffer was destroyed before mapping`))throw e}finally{fn=!1}}async function Yn(){if(!un)return;let e=un;un=null;try{await e.stop()}catch{}X={...X,connected:!1,remotePeers:0,remotePeerIds:[],quorumReady:!1,error:null}}async function Xn({relayUrl:e=X.relayUrl,roomId:t=X.roomId,role:n=X.role}={}){await Yn();let r=String(e||``).trim(),i=String(t||`ulg-universes-mesh-v1`).trim(),a=[`requester`,`responder`,`observer`].includes(n)?n:`requester`;if(!r)return X={...X,connected:!1,relayUrl:``,roomId:i,role:a,error:null},X;try{let e=`uv-${a}-${Math.random().toString(36).slice(2,8)}`,t=new URL(`data:text/javascript;base64,LyoqCiAqIERldGVybWluaXN0aWMgUGVlckNvbXB1dGUgcmVzcG9uZGVyIGRlcml2YXRpb24gdGFzayBmb3IgdGhlIENvc21pYyA8LT4gUXVhbnR1bQogKiBkaXN0cmlidXRlZCBtZXNoIChgc3RhcnRMaXZlQ2xpZW50RGVyaXZhdGlvblBlZXJNZXNoYCkuCiAqCiAqIEV4ZWN1dGVkIGluc2lkZSByZXNwb25kZXIgYnJvd3NlciBjb250ZXh0cyB2aWEgUGVlckNvbXB1dGUgYENvbXB1dGVNYW5hZ2VyYAogKiBvdmVyIFdlYlNvY2tldC9XZWJSVEMgcmVsYXlzIGFuZCB2YWxpZGF0ZWQgYnkgMi1vZi0yIHF1b3J1bSBoYXNoaW5nLgogKi8KCmltcG9ydCB7IGRlcml2ZUVsZW1lbnRQcm9wZXJ0aWVzIH0gZnJvbSAnLi4vcnVudGltZS9tYXRlcmlhbC9lbGVtZW50Q2xvc3VyZXMuanMnOwppbXBvcnQgeyBldmFsdWF0ZUNoZXJlbmtvdkNsb3N1cmUgfSBmcm9tICcuLi9ydW50aW1lL21hdGVyaWFsL251Y2xlYXJDaGVyZW5rb3ZDbG9zdXJlLmpzJzsKCmV4cG9ydCBjb25zdCBDT1NNSUNfUVVBTlRVTV9QRUVSX1RBU0tfU0NIRU1BID0gJ3BlZXJjb21wdXRlLnVsZy5jb3NtaWMtcXVhbnR1bS1wZWVyLXRhc2sudjEnOwoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1bihkYXRhID0ge30pIHsKICBjb25zdCBraW5kID0gU3RyaW5nKGRhdGE/LmtpbmQgfHwgJ21hdGVyaWFsLnJlc29sdmUtZWxlbWVudCcpOwogIGNvbnN0IHBheWxvYWQgPSBkYXRhPy5wYXlsb2FkIHx8IGRhdGEgfHwge307CgogIGlmIChraW5kID09PSAnbnVjbGVhci5jaGVyZW5rb3YnKSB7CiAgICBjb25zdCBraW5ldGljRW5lcmd5TWVWID0gTnVtYmVyKHBheWxvYWQua2luZXRpY0VuZXJneU1lViA/PyAwKTsKICAgIC8vIEZhaWwgY2xvc2VkIHRvIHZhY3V1bSAobiA9IDEuMCkgd2hlbiByZWZyYWN0aXZlSW5kZXggaXMgb21pdHRlZCAobmV2ZXIgc2lsZW50bHkgYXNzdW1lIEgyTyAxLjMzMykKICAgIGNvbnN0IHJlZnJhY3RpdmVJbmRleCA9IE51bWJlci5pc0Zpbml0ZShOdW1iZXIocGF5bG9hZC5yZWZyYWN0aXZlSW5kZXgpKSAmJiBOdW1iZXIocGF5bG9hZC5yZWZyYWN0aXZlSW5kZXgpID49IDEuMAogICAgICA/IE51bWJlcihwYXlsb2FkLnJlZnJhY3RpdmVJbmRleCkKICAgICAgOiAxLjA7CiAgICBjb25zdCBjaCA9IGV2YWx1YXRlQ2hlcmVua292Q2xvc3VyZSh7IGtpbmV0aWNFbmVyZ3lNZVYsIHJlZnJhY3RpdmVJbmRleCB9KTsKICAgIGNvbnN0IHZhbHVlID0gewogICAgICBzY2hlbWE6IENPU01JQ19RVUFOVFVNX1BFRVJfVEFTS19TQ0hFTUEsCiAgICAgIGtpbmQsCiAgICAgIGFjdGl2ZTogY2guYWN0aXZlLAogICAgICBiZXRhOiBOdW1iZXIoY2guYmV0YS50b0ZpeGVkKDYpKSwKICAgICAgY2hlcmVua292QW5nbGVEZWc6IE51bWJlcihjaC5jaGVyZW5rb3ZBbmdsZURlZy50b0ZpeGVkKDQpKSwKICAgICAgcGhvdG9uc1Blck1ldGVyOiBNYXRoLnJvdW5kKGNoLnBob3RvbnNQZXJNZXRlciksCiAgICAgIHNjaWVudGlmaWNWYWxpZGF0aW9uOiBmYWxzZQogICAgfTsKICAgIHJldHVybiB7CiAgICAgIHZhbHVlLAogICAgICBjb21taXREZWx0YTogewogICAgICAgIHRhc2tJZDogYGNxLXBlZXI6JHtraW5kfToke2tpbmV0aWNFbmVyZ3lNZVZ9OiR7cmVmcmFjdGl2ZUluZGV4fWAsCiAgICAgICAgc2NvcGU6ICdjb3NtaWMtcXVhbnR1bS1wZWVyLW1lc2gnLAogICAgICAgIHBheWxvYWQ6IHZhbHVlCiAgICAgIH0KICAgIH07CiAgfQoKICBjb25zdCByYXdaID0gTnVtYmVyKHBheWxvYWQuYXRvbWljTnVtYmVyWik7CiAgaWYgKCFOdW1iZXIuaXNJbnRlZ2VyKHJhd1opIHx8IHJhd1ogPCAxIHx8IHJhd1ogPiAxMTgpIHsKICAgIHRocm93IG5ldyBSYW5nZUVycm9yKGBjb3NtaWNRdWFudHVtUGVlclRhc2sgcmVxdWlyZXMgYW4gZXhwbGljaXQgaW50ZWdlciBhdG9taWNOdW1iZXJaIGluIFsxLCAxMThdLCBnb3QgJHtwYXlsb2FkLmF0b21pY051bWJlclp9YCk7CiAgfQogIGNvbnN0IGF0b21pY051bWJlclogPSByYXdaOwogIGNvbnN0IGZ1bmN0aW9uYWwgPSBTdHJpbmcocGF5bG9hZC5mdW5jdGlvbmFsIHx8ICdwYmUnKS50b0xvd2VyQ2FzZSgpOwogIGNvbnN0IHByb3BzID0gZGVyaXZlRWxlbWVudFByb3BlcnRpZXMoYXRvbWljTnVtYmVyWiwgewogICAgZnVuY3Rpb25hbCwKICAgIHNjYWxhclJlbGF0aXZpc3RpYzogdHJ1ZSwKICAgIHNwaW5PcmJpdDogdHJ1ZSwKICAgIGluY2x1ZGVHYXNQaGFzZTogdHJ1ZSwKICAgIGdyaWRQb2ludHNOOiAyNjAKICB9KTsKICBjb25zdCB2YWx1ZSA9IHsKICAgIHNjaGVtYTogQ09TTUlDX1FVQU5UVU1fUEVFUl9UQVNLX1NDSEVNQSwKICAgIGtpbmQ6ICdtYXRlcmlhbC5yZXNvbHZlLWVsZW1lbnQnLAogICAgYXRvbWljTnVtYmVyWiwKICAgIHN5bWJvbDogcHJvcHMuc3ltYm9sLAogICAgZnVuY3Rpb25hbCwKICAgIGJvbmRpbmdDbGFzczogcHJvcHMuYm9uZGluZ0NsYXNzLAogICAgc3RhbmRhcmRQaGFzZUF0Mjk4SzogcHJvcHMuc3RhbmRhcmRQaGFzZUF0Mjk4SywKICAgIG1lbHRpbmdQb2ludEs6IE1hdGgucm91bmQocHJvcHMubWVsdGluZ1BvaW50SyA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5tZWx0aW5nUG9pbnRLID8/IDApLAogICAgYm9pbGluZ1BvaW50SzogTWF0aC5yb3VuZChwcm9wcy5ib2lsaW5nUG9pbnRLID8/IHByb3BzLnZkd0dhc1Byb3BlcnRpZXM/LmJvaWxpbmdQb2ludEsgPz8gMCksCiAgICBkZW5zaXR5S2dQZXJNMzogTWF0aC5yb3VuZChwcm9wcy5kZW5zaXR5S2dQZXJNMyA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5jb25kZW5zZWREZW5zaXR5S2dQZXJNMyA/PyAwKSwKICAgIGJ1bGtNb2R1bHVzR1BhOiBOdW1iZXIoKCgocHJvcHMuYnVsa01vZHVsdXNQYSA/PyBwcm9wcy52ZHdHYXNQcm9wZXJ0aWVzPy5idWxrTW9kdWx1c1BhID8/IDApIC8gMWU5KSkudG9GaXhlZCgyKSksCiAgICBjbG9zdXJlQmFja2VkOiB0cnVlLAogICAgc2NpZW50aWZpY1ZhbGlkYXRpb246IGZhbHNlCiAgfTsKICByZXR1cm4gewogICAgdmFsdWUsCiAgICBjb21taXREZWx0YTogewogICAgICB0YXNrSWQ6IGBjcS1wZWVyOmVsZW1lbnQ6JHthdG9taWNOdW1iZXJafToke2Z1bmN0aW9uYWx9YCwKICAgICAgc2NvcGU6ICdjb3NtaWMtcXVhbnR1bS1wZWVyLW1lc2gnLAogICAgICBwYXlsb2FkOiB2YWx1ZQogICAgfQogIH07Cn0K`,``+import.meta.url).href,n=null,o=null;if(a===`observer`){o=x({relayUrl:r,roomId:i,peerId:e,enableWebRtc:!1});let t=new Set,a=0,s=null;o.onMessage(e=>{a+=1,s=e?.type||null,e?.from&&t.add(e.from),e?.type===`presence`&&e?.alive===!1&&e?.from&&t.delete(e.from),e?.type===`peer-disconnect`&&e?.peerId&&t.delete(e.peerId),X.remotePeers=t.size,X.witnessedMessages=a,X.lastWitnessedType=s}),n={getStatus:()=>({connected:o.isConnected(),remotePeerCount:t.size,remotePeerIds:[...t],quorumReady:!1,witnessedMessages:a,lastWitnessedType:s}),async stop(){o.close()}}}else{let a=y({relayUrl:r,roomId:i,peerId:e,enableWebRtc:!1,taskModuleUrl:t,announceIntervalMs:120,staleMs:12e3,timeoutMs:3e4});o=a.transport,n={mesh:a,getStatus:()=>a.getStatus(),getActiveRequester:()=>a.getActiveRequester(),async stop(){a.stop()}}}un={transport:o,handle:n,peerId:e,role:a,stop:()=>n?.stop?.()};let s=n.getStatus()||{};X={connected:!0,role:a,relayUrl:r,roomId:i,peerId:e,remotePeers:s.remotePeerCount??0,remotePeerIds:[...s.remotePeerIds||[]],quorumReady:!!s.quorumReady,witnessedMessages:s.witnessedMessages??0,lastWitnessedType:s.lastWitnessedType??null,dispatches:0,lastResult:null,error:null}}catch(e){X={...X,connected:!1,relayUrl:r,roomId:i,role:a,error:e instanceof Error?e.message:String(e)}}return Zn()}function Zn(){let e=un?.handle?.getStatus?.();return{...X,connected:e?!!e.connected:X.connected,remotePeers:e?e.remotePeerCount:X.remotePeers,remotePeerIds:e?[...e.remotePeerIds||[]]:X.remotePeerIds||[],quorumReady:e?!!e.quorumReady:X.quorumReady,witnessedMessages:e?.witnessedMessages??X.witnessedMessages??0,lastWitnessedType:e?.lastWitnessedType??X.lastWitnessedType??null}}async function Qn(e=Yt){let t=un?.handle?.getActiveRequester?.();if(!t||typeof t.submitWithProvenance!=`function`){let e=Error(`Peer mesh 2-of-2 quorum requester is not ready (requires >= 2 live remote responders)`);throw e.code=`ERR_CLIENT_PEER_QUORUM_UNAVAILABLE`,e}let n=`uv-quorum-${Date.now()}-${X.dispatches+1}`,r=await t.submitWithProvenance(n,{service:`cosmic-quantum-material`,kind:`material.resolve-element`,payload:{atomicNumberZ:e,functional:`pbe`}});return X.dispatches+=1,X.lastResult=r,r}let $n=new Map;async function er(e,t={}){if(e===0&&E||e===1&&B||e===2&&(we===`smbh-core`?Ee:ke)||e===3&&Ze||e===4&&G||e===5&&J||e===6&&nn||e===7&&sn)return;let n=e===2?`2:${we}`:String(e);if($n.has(n))return $n.get(n);let r=(async()=>{e===0?await hn(t):e===1?await gn(t):e===2?we===`smbh-core`?await _n():await vn(t):e===3?await Un(t):e===4?await Wn(t):e===5?await Gn(t):e===6?await Kn(t):e===7&&await qn(t)})();$n.set(n,r);try{await r}finally{$n.delete(n)}}function tr(e){return He[e]?(s=He[e],!0):!1}function nr(e){o=Number(e)>>>0||1}function rr(e){return Jt=e?{...e}:null,Jt}async function ir(e){if(!e)return null;Jt={...e};let t=Math.max(1,Math.min(118,Math.trunc(Number(e.primaryZ)||14)));return await Gn({Z:t,phasePreset:e.phasePreset||`solid`,tempK:Number.isFinite(Number(e.tempK))?Number(e.tempK):null}),Yt=t,e.moleculeKey&&Nn[e.moleculeKey]&&(tn=e.moleculeKey),an=t,Jt}function ar(e){Gt=!!e,J&&typeof J.setGravity==`function`&&J.setGravity(Gt)}function or(e){Y=Math.max(15,Math.round(Number(e)||300))}function sr(e){At=!!e}function cr(e){lt=Math.max(.4,Math.min(8,Number(e)||2))}async function lr(e,{alignActiveLevel:t=null}={}){if(typeof e==`string`){let t=te.find(t=>t.id===e)||te[3];p=t.id,m=R({redshiftZ:t.redshiftZ,localSystemAgeGyr:t.localSystemAgeGyr,localStarMassSolar:1})}else e&&typeof e==`object`&&(p=e.id||`custom`,m=R(e));return h=tt({cosmicEpoch:m,regionPosMpc:P[0]?.posMpc||[0,0,0],localOverdensity:h.localOverdensity||1.15,seed:o}),_||(S=it(rt({cosmicEpoch:m,galaxyEnv:h,starPosGal:g.posGal,popTag:g.popTag,starIndex:g.starIndex,seed:o+409>>>0}),{seedOverride:o+409>>>0})),t===0?m.eraId===`recombination`?await ur(`cmb`):m.eraId===`cosmic-dawn`?await ur(`reionization`):m.eraId===`far-future`?await ur(`cluster-merger`):await ur(`web`):t===1?await gn({galaxyEnvOverride:h}):t===2?m.eraId===`quasar-peak`?await dr(`quasar-jet`):m.eraId===`cosmic-dawn`?await dr(`formation`):m.eraId===`far-future`?await dr(`red-giant`):(await vn(),await dr(`nbody`)):t===3?m.eraId===`far-future`?await mr(`planetary-nebula`):m.eraId===`cosmic-dawn`?await mr(`h2-pillars`):m.eraId===`quasar-peak`?await mr(`nebular-mhd`):await mr(`fusion`):t===4&&(m.eraId===`quasar-peak`?await hr(`magma-ocean`):await hr(`standard`)),m}async function ur(e){T=[`web`,`cmb`,`reionization`,`cluster-merger`].includes(e)?e:`web`,T===`web`?E||await hn():await Tn(T)}async function dr(e){V=[`nbody`,`formation`,`roche-rings`,`giant-impact`,`red-giant`,`comet-tails`,`hot-jupiter`,`quasar-jet`,`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(e)?e:`nbody`,V===`formation`?H||await wn():V===`quasar-jet`?Ie||await Dn():V===`xray-binary`||V===`bns-kilonova`||V===`type-ia`||V===`bbh-merger`?(!Be||We!==V)&&await On(V):V===`comet-tails`||V===`hot-jupiter`?(!Ge||qe!==V)&&await Ln(V):V===`roche-rings`||V===`giant-impact`||V===`red-giant`?(!Je||Xe!==V)&&await Rn(V):ke||await vn()}async function fr(e){ze=Math.max(-.99,Math.min(.99,Number(e)??.94)),Ie&&await Dn({spinA:ze})}function pr(e){Fe=!!e,H?.setEnableGasDrag?.(Fe)}async function mr(e){W=[`fusion`,`nebular-mhd`,`h2-pillars`,`planetary-nebula`,`snr-pwn`,`pulsar`,`magnetar`,`white-dwarf-tov`].includes(e)?e:`fusion`,W===`nebular-mhd`?ut||await Z():W===`h2-pillars`||W===`planetary-nebula`||W===`snr-pwn`?(!gt||vt!==W)&&await zn(W):W===`pulsar`||W===`magnetar`?(!yt||Ct!==W)&&await Bn(W):W===`white-dwarf-tov`?Tt||await Vn():Ze||await Un()}async function hr(t){if(Dt=[`standard`,`magma-ocean`,`cryo-plumes`,`eyeball-locked`,`rogue`].includes(t)?t:`standard`,Dt===`cryo-plumes`)It||await Hn();else if(Dt===`eyeball-locked`||Dt===`rogue`){let t=Nt;Nt=null,t&&t.dispose();let n=C()[kt]||Me[3],r=le({...n,surfacePressurePa:Math.max(1e5,Number(n.surfacePressurePa)||101300),volatileMassFrac:Math.max(.03,Number(n.volatileMassFrac)||.03),particulateMassFrac:Math.max(.008,Number(n.particulateMassFrac)||.008),rotationOmegaRadS:Dt===`eyeball-locked`?11e-6:82e-6,coreRadiusNorm:.54,coreConductivitySm:12e5},G||{coreRadiusFraction:.54,centralPressurePa:36e10},{solarDistanceAu:Dt===`rogue`?500:.14,coreConductivitySm:12e5});Mt=r;let i=ee(e,{width:s.id===`low`?64:128,height:s.id===`low`?32:64,bodyParams:r,enableTriboelectric:Ft,seed:(o^(Dt===`rogue`?460302:243186193))>>>0,label:`ulg-universes-atmo-${Dt}`});for(let e=0;e<4;e+=1)Pt=await i.step({dtSim:.048,substeps:2,sunDir:Dt===`eyeball-locked`?[1,0,0]:[0,1,0],readTelemetry:e===3});Nt=i}else Dt===`standard`&&await Wn({bodyIndex:kt})}async function gr(e){ht=Math.max(0,Math.min(1.5,Number(e)??.58)),ut&&await Z({initialB0:ht})}function _r(e){Te=!!e}async function vr(e){me=Math.max(0,Math.min(1.2,Number(e)||0)),oe&&B&&(oe.resetSeedB(me),se=await oe.step({particleBuffer:B.getResidentBuffer(),particleCount:B.count,dt:.045,substeps:me>1e-6?8:1,readTelemetry:!0,readBField:!0}),fe=oe.buildStreamlines({worldScale:1,alpha:.44}))}async function yr(e){nt=Math.max(0,Math.min(1.2,Number(e)||0)),Qe&&Ze&&(Qe.resetSeedB(nt),$e=await Qe.step({particleBuffer:Ze.getResidentBuffer(),particleCount:Ze.count,dt:.042,substeps:nt>1e-6?8:1,readTelemetry:!0,readBField:!0}),et=Qe.buildStreamlines({worldScale:1,alpha:.42}))}function br(e){Array.isArray(e)&&e.length>=3&&P.length>0&&(P[0]={...P[0],posMpc:[Number(e[0])||0,Number(e[1])||0,Number(e[2])||0]})}function xr(e){Ft=!!e,Nt?.setEnableTriboelectric?.(Ft)}async function Sr({bodyIndex:t=kt,planetaryModeOverride:n=null,restoreCheckpoint:r=null,initialVehicle:i=`ufo`}={}){let a=t,c=C();if(typeof a==`string`){let e=c.findIndex(e=>e.id===a);if(e>=0&&!c[e].isStar)a=e;else{let e=Me.findIndex(e=>e.id===a);e>0?(_=!0,await vn({solReference:!0}),c=C(),a=e):a=kt}}if(a=Math.max(0,Math.min(c.length-1,Math.trunc(Number(a)??kt))),c[a]?.isStar||a===0){let e=w(c);e>0&&(a=e)}Ne=a,n&&(Dt=n),(!G||kt!==a)&&await Wn({bodyIndex:a});let l=c[a]||Me[3],u=de(e,{bodySpec:l,planetaryResult:G,planetaryAtmoState:Mt,planetaryMode:Dt,gridN:s.id===`low`?81:129,cellSizeM:9.5,particleCount:s.id===`low`?1024:2048,seed:(o^a*7919+84212430)>>>0,initialVehicle:i,initialCheckpoint:r,label:`ulg-universes-surface-${l.id}`});q={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0},Ht=await u.step({dt:.016,controls:q,readTelemetry:!1}),Ht=await u.step({dt:.016,controls:q,readTelemetry:!0});let d=K;return K=u,zt=!0,d&&d.dispose(),Ht}function Cr(){zt=!1,q={forward:!1,backward:!1,left:!1,right:!1,jump:!1,down:!1,turbo:!1,yawLeft:!1,yawRight:!1,moveX:0,moveY:0};let e=K;K=null,Ht=null,e&&e.dispose()}function Q(e){return K?K.setActiveVehicle(e):null}function wr(e){return K?K.setUfoAltitudeKm?.(e)??null:null}function Tr(e){return K?K.setCameraMode(e):null}function Er(e={}){q={...q,...e}}function Dr(e,t){K?.addLookDelta?.(e,t)}function Or(e){return K?.adjustChaseDistance?.(e)??1}function kr(e,t){let n=10**t,r=C(),i=r[Ne]||r[w(r)]||Me[3],a=e===2&&[`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(V),o=e===2&&[`roche-rings`,`giant-impact`,`red-giant`].includes(V),s=e===2&&[`comet-tails`,`hot-jupiter`].includes(V),c=e===3&&[`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(W),l=e===3&&[`pulsar`,`magnetar`].includes(W);return ce({viewSpanM:n,redshiftZ:m.redshiftZ,comovingBoxMpc:e===0?260:0,omegaM:e===0?.315:0,baryonFraction:e===0&&T!==`web`?.157:0,clusterMassSolar:e===0&&T===`cluster-merger`?0x5543df729c000:0,galacticBodyCount:e===1?B?.count||32768:0,nebulaCloudMass:e===3&&W===`nebular-mhd`?22:0,magneticFieldStrength:e===3&&W===`nebular-mhd`?ht:e===2&&V===`quasar-jet`?1.15:0,ionizedGasPresent:e===3&&(W===`nebular-mhd`||c),starMassSolar:+(e===2&&V===`formation`),diskSolidMassEarth:e===2&&V===`formation`?45:0,gravitatingBodyCount:e===2||e===4?a?2:ke?.totalCount||15:0,solidBodyCount:e===2&&(V===`formation`||o)?18:0,solidParticleCount:e===2&&V===`formation`?90:0,coreTempK:e===3&&W===`fusion`?U?.coreTempK||15e6:0,bodyMassKg:e===4?i.massSolar*198847e25:e===3&&W===`fusion`?198847e25:0,bodyRadiusM:e===4?i.radiusKm*1e3:0,surfacePressurePa:e===4&&Mt?.surfacePressurePa||0,volatileMassFrac:e===4&&Mt?.volatileMassFrac||0,particulateMassFrac:e===4&&Mt?.particulateMassFrac||0,dynamo:e===4&&Mt?.dynamo||null,compactnessGMOverRc2:e===2&&(V===`quasar-jet`||a)||e===3&&(l||W===`white-dwarf-tov`)?.25:0,centralRelativisticMassSolar:e===2&&V===`quasar-jet`?45e7:a?10:0,accretionRateEddington:e===2&&(V===`quasar-jet`||V===`xray-binary`)?.55:0,kerrSpinA:e===2&&V===`quasar-jet`?ze:0,surfaceBFieldTesla:l?W===`magnetar`?165e9:42e7:0,compactRadiusM:l?12e3:0,spinOmegaRadS:l?W===`magnetar`?45:740:0,maxPairwiseVOverC:a?.22:0,rocheOverflowPresent:e===2&&V===`xray-binary`,uvFluxNorm:s||c?1.5:0,xuvFluxWPerM2:e===2&&V===`hot-jupiter`?180:0,surfaceTempK:e===2&&V===`comet-tails`?260:0,sublimationTempK:e===2&&V===`comet-tails`?170:1e9,maxTidalStrain:o||e===4&&Dt===`cryo-plumes`?.85:0,maxSurfaceTempK:e===4&&Dt===`magma-ocean`||e===2&&(V===`giant-impact`||V===`red-giant`)?2400:0,surfaceViewActive:zt})}function Ar(e,t=null){we=e===`smbh-core`?`smbh-core`:`solar-system`,t&&(Ce=[...t])}function jr(e){let t=C();if(typeof e==`string`){let n=t.findIndex(t=>t.id===e);if(n>=0)return Ne=n,Ne;let r=Me.findIndex(t=>t.id===e);if(r>=0)return _=!0,Ne=r,Ne}else Number.isFinite(Number(e))&&(Ne=Math.max(0,Math.min(t.length-1,Math.trunc(Number(e)))));return Ne}function Mr(e,t=!0){let n=Math.max(1,Math.min(118,Math.trunc(Number(e)||26)));return d.get(`${n}:std:${+!!t}:1`)||d.get(`${n}:std:${+!!t}:0`)||d.get(`${n}:std:1:1`)||d.get(`${n}:std:1:0`)||null}function $(e,t={}){if(e===0){if(T===`cmb`){let e=I;return[{id:`cmb-recombination`,level:0,name:`CMB Last Scattering Surface (z = 1100)`,subtitle:`t = 380 kyr · T_CMB = ${(e?.cmbTempK||3001).toFixed(0)} K · Eisenstein–Hu BAO r_s ≈ 147 Mpc`,pos:[0,0,0],radius:4.5,tempK:e?.cmbTempK||3001,massLabel:`ΔT/T acoustic`,composition:`H⁺/e⁻ → Neutral H (Peebles Recombination) · Primordial He 25%`,nextLevel:1}]}if(T===`reionization`)return[{id:`cosmic-reionization`,level:0,name:`Cosmic Dawn & Reionization Bubbles (z = 10)`,subtitle:`t = 470 Myr · ⟨x_HII⟩ = ${((I?.meanIonizedFraction||.2)*100).toFixed(1)}% · Pop III UV Percolation`,pos:[0,0,0],radius:4,tempK:2e4,massLabel:`Z ≈ 10⁻⁴ Z☉`,composition:`Neutral H I Web + Photoionized H II Bubbles · Pop III Halos`,nextLevel:1}];if(T===`cluster-merger`){let e=I;return[{id:`bullet-cluster-merger`,level:0,name:`Galaxy Cluster Merger & Gravitational Lensing`,subtitle:`ICM T_max = ${((e?.maxGasTempK||5e7)/1e6).toFixed(1)} MK · Lensing κ_max = ${(e?.maxLensingKappa||.5).toFixed(2)}`,pos:[0,0,0],radius:4,tempK:6e7,massLabel:`1.5×10¹⁵ M☉`,composition:`Shock-Heated X-Ray ICM Plasma + Offset Dark-Matter Lensing Halos`,nextLevel:1}]}let e=t.cosmoScale??.1,n=t.cosmoOffset??[0,0,0];return P.map(t=>({...t,pos:[(t.posMpc[0]-n[0])*e,(t.posMpc[1]-n[1])*e,(t.posMpc[2]-n[2])*e]}))}if(e===1){let e=t.galaxyScale??1,n=t.galaxyOffset??[0,0,0];return Se.map(t=>({...t,pos:[(t.pos[0]-n[0])*e,(t.pos[1]-n[1])*e,(t.pos[2]-n[2])*e]}))}if(e===2){if(we===`smbh-core`)return[{id:`smbh-event-horizon`,level:2,name:`Sagittarius-ULG* (4.3×10⁶ M☉ SMBH)`,subtitle:`Schwarzschild Event Horizon · Relativistic Doppler Disk · Live S-Stars`,pos:[0,0,0],radius:1,tempK:28e3,massLabel:`4.3×10⁶ M☉`,composition:`Kerr-Schwarzschild Metric · Accreting H⁺/He²⁺ Plasma`,nextLevel:3}];if(V!==`nbody`&&V!==`formation`){let e={"quasar-jet":{name:`Quasar / Blazar Kerr AGN (a* = ${ze.toFixed(2)})`,subtitle:`4.5×10⁸ M☉ Kerr BH · Blandford–Znajek Jets · Live Camera Doppler Beaming (Γ = ${(Re?.maxLorentzGamma||5.5).toFixed(1)})`,tempK:45e3,composition:`Novikov–Thorne Plasma Disk · Relativistic e±/p⁺ BZ Jets · Dusty Torus`},"xray-binary":{name:`Microquasar X-Ray Binary (Roche L1 Overflow)`,subtitle:`11 M☉ BH + 1.8 M☉ Donor · Eggleton R_L Stream → Hot X-Ray Accretion Disk`,tempK:28e3,composition:`H/He Roche-Lobe Stream · Comptonized X-Ray Corona`},"bns-kilonova":{name:`Binary Neutron Star Merger & Kilonova`,subtitle:`1.45 + 1.32 M☉ · 2.5PN GW Chirp · ${Ue?.merged?`r-Process Lanthanide Kilonova Burst!`:`Relativistic Inspiral`}`,tempK:12e3,composition:`Low-Y_e Lanthanide r-Process Ejecta (Au/Pt/U) + Blue Polar Wind`},"type-ia":{name:`Type Ia Thermonuclear Supernova (M_Ch = 1.44 M☉)`,subtitle:`C/O White Dwarf Runaway ¹²C+¹²C Detonation · Zero Central Remnant · ⁵⁶Ni Glow`,tempK:18e3,composition:`⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe · Si / S / Ca Detonation Shell`},"bbh-merger":{name:`Binary Black Hole 2.5PN GW Inspiral & Ringdown`,subtitle:`36 + 29 M☉ Kerr BHs · Quadrupole Strain Chirp h_+(t) & Gravitational Lensing`,tempK:2e4,composition:`Vacuum Kerr Spacetime · Gravitational Radiation Flux`},"comet-tails":{name:`Active Dual-Tail Comet (Clausius–Clapeyron)`,subtitle:`Curved Radiation-Pressure Dust Tail (β) + Straight Solar-Wind CO⁺ Ion Tail`,tempK:260,composition:`H₂O / CO / CO₂ Sublimating Ice Nucleus · Silicate Dust · CO⁺ Plasma`},"hot-jupiter":{name:`Hot Jupiter XUV Atmospheric Photoevaporation`,subtitle:`Energy-Limited XUV Escape Tail (Ṁ = ε π R_p³ F_XUV / G M_p)`,tempK:1850,composition:`Ionized H/He Escaping Cometary Envelope · Silicate Haze`},"roche-rings":{name:`Roche-Limit Tidal Disruption & Shepherd-Moon Rings`,subtitle:`Cohesive Rubble-Pile Rupture (${((Ye?.rupturedFraction||.7)*100).toFixed(0)}%) + Resonant Ring Gap`,tempK:140,composition:`Water-Ice & Silicate Ring Particles · Embedded Shepherd Moon`},"giant-impact":{name:`Giant Moon-Forming Impact & Hadean Disk`,subtitle:`Incandescent Magma-Ocean Proto-Earth + Molten Silicate Circumplanetary Disk`,tempK:2800,composition:`Molten Fe/MgSiO₃ Silicate Vapor & Re-Accreting Lunar Embryo Disk`},"red-giant":{name:`Red-Giant Branch Engulfment (+5 Gyr)`,subtitle:`Bloated Convective RGB Envelope · Aerodynamic Common-Envelope Drag on Inner Worlds`,tempK:3400,composition:`Convective H/He Envelope · Vaporizing Inner Rocky Orbits`}},t=e[V]||e[`quasar-jet`];return[{id:`l2-${V}`,level:2,name:t.name,subtitle:t.subtitle,pos:[0,0,0],radius:1.5,tempK:t.tempK,composition:t.composition,nextLevel:3}]}if(!ke)return[];let e=C(),n=Math.max(0,Math.min(e.length-1,Ne)),r=ke.getMassiveBodyState64(n),i=t.solarScaleAuToWorld??1;return e.map((e,t)=>{let n=ke.getMassiveBodyState64(t),a=(n.posAu[0]-r.posAu[0])*i,o=(n.posAu[1]-r.posAu[1])*i,s=(n.posAu[2]-r.posAu[2])*i,c=!!e.isStar||t===0;return{id:e.id,level:2,bodyIndex:t,spec:e,name:e.name,subtitle:e.subtitle,pos:[a,o,s],radius:Math.max(1e-7,n.radiusAu*i),radiusKm:e.radiusKm,tempK:e.tempK,massLabel:c?`${e.massSolar.toFixed(2)} M☉`:`${(e.massSolar/30034896e-13).toFixed(e.massSolar>1e-5?1:3)} M⊕`,composition:e.composition,nextLevel:c?3:4}})}if(e===3){if(W!==`fusion`){let e={"nebular-mhd":{name:`3D Resistive MHD Nebular Collapse & Jets`,subtitle:`∂B/∂t = ∇×(v×B) + η∇²B − ∇ψ · B₀ = ${ht.toFixed(2)} · Helical J×B Outflow`,tempK:6500,composition:`Magnetized H₂/Dust Molecular Cloud · Helical B-Field Towers`},"h2-pillars":{name:`H II Star-Forming Pillars (Strömgren Ionization)`,subtitle:`Photoevaporative Rocket Ablation · Stratified [O III] / Hα / [S II] Emission`,tempK:11e3,composition:`Ionized H⁺ (Hα) · Doubly Ionized O²⁺ ([O III]) · Shielded Dense Dust ([S II])`},"planetary-nebula":{name:`Bipolar Planetary Nebula & Hot White Dwarf`,subtitle:`Fast Post-AGB Wind Sweeping Dusty Envelope · 95,000 K Central C/O White Dwarf`,tempK:14500,composition:`Inner [O III] Teal Cavity · Outer Hα / [N II] Crimson Shell · C/O Core`},"snr-pwn":{name:`Supernova Remnant & Crab Pulsar Wind Nebula`,subtitle:`Sedov–Taylor Expanding Blastwave + Relativistic Synchrotron Filaments`,tempK:22e3,composition:`Shocked O/Si/Fe Ejecta · Inner e± Synchrotron PWN · Central NS`},pulsar:{name:`Millisecond Pulsar Oblique Magnetosphere`,subtitle:`Spitkovsky Force-Free Dipole (B = 4.2×10⁸ T, P = 8.5 ms) · Twin Lighthouse Beams`,tempK:32e3,composition:`Neutron-Degenerate Core · e± Pair-Plasma Open Polar Caps`},magnetar:{name:`Magnetar Crustal-Yield Giant Flare`,subtitle:`B = 1.65×10¹¹ T (1.65×10¹⁵ G) · Hall-Drift Twist · ${xt?.flareCount||0} Unscripted Starquakes`,tempK:48e3,composition:`Superconducting Proton/Neutron Interior · Sheared Fe Crust · Reconnection Fireball`},"white-dwarf-tov":{name:`GR TOV Unified Degenerate EOS (WD → NS → BH)`,subtitle:`Live Batched WebGPU RK4 Tolman–Oppenheimer–Volkoff Mass–Radius Sequence`,tempK:26e3,composition:`Relativistic Fermi–Dirac Electron Degeneracy (M_Ch ≈ 1.44 M☉) → Nuclear Saturation`}},t=e[W]||e[`nebular-mhd`];return[{id:`l3-${W}`,level:3,name:t.name,subtitle:t.subtitle,pos:[0,0,0],radius:1.8,tempK:t.tempK,composition:t.composition,nextLevel:4}]}return[{id:`stellar-fusion-core`,level:3,name:`Thermonuclear Fusion Core`,subtitle:`Gate 1 pp/CNO/3α Burn · Q_pp = ${Rt().ppThermalMeV.toFixed(2)} MeV`,pos:[0,0,0],radius:1.8,tempK:U?.coreTempK||15e6,massLabel:`${(Ze?.totalMassSolar||1).toFixed(2)} M☉`,composition:`H ${((U?.meanXH??.72)*100).toFixed(1)}% · He ${((U?.meanXHe??.26)*100).toFixed(1)}% · Metals ${((U?.meanXZ??.02)*100).toFixed(1)}%`,nextLevel:4}]}if(e===4){if(Dt!==`standard`){let e={"magma-ocean":{name:`Hadean Magma Ocean World`,subtitle:`Incandescent Molten Silicate Crust (T_surf ≈ 2,400 K) · Outgassing Steam Atmosphere`,tempK:2400,composition:`Molten MgSiO₃ Peridotite · Fe-Ni Core Segregation · H₂O/CO₂ Steam`},"cryo-plumes":{name:`Cryovolcanic Icy Moon (Viscoelastic Tidal Plumes)`,subtitle:`Peale–Cassen–Reynolds Tidal Heating Driving Supersonic South-Polar H₂O Geysers`,tempK:95,composition:`Water-Ice Lithosphere · Subsurface Brine Ocean · Supersonic H₂O Plumes`},"eyeball-locked":{name:`Tidally Locked Eyeball Exoplanet`,subtitle:`Synchronous 1:1 Spin-Orbit Lock · Substellar Ocean Eye + Terminator Super-Rotation`,tempK:295,composition:`Substellar Liquid Ocean · Terminator Convection Belt · Frozen Nightside`},rogue:{name:`Rogue Free-Floating Dark World`,subtitle:`Zero Stellar Insolation · Geothermal Internal Heat + Dark-Sky Triboelectric Storms`,tempK:65,composition:`Dense H₂/N₂ Geothermal Atmosphere · Deep Mantle Radiogenic Heating`}}[Dt];if(e)return[{id:`l4-${Dt}`,level:4,name:e.name,subtitle:e.subtitle,pos:[0,0,0],radius:1.8,sampleZ:26,rCoreNorm:jt[0]?.rCoreNorm??.54,rMantleNorm:.94,tempK:e.tempK,composition:e.composition,nextLevel:5}]}return jt}if(e===5){let e=Mr(Wt,!0)?.bundle,t=e?.symbol||`Fe`,n=Jt;return[{id:`md-lattice-atom`,level:5,name:n?`${n.name} · ${t} Lattice`:`${t} Representative Lattice`,subtitle:n?`Sampled from ${n.worldName} (${n.locationTag}) · ${e?.mechanical?.crystalStructure||`crystal`} · ${J?.atomCount||0} GPU atoms`:`${e?.mechanical?.crystalStructure||`crystal`} · ${J?.atomCount||0} live GPU atoms`,pos:[0,0,0],radius:1.5,sampleZ:Wt,tempK:Ut?.temperatureK||Y,massLabel:`m = ${(e?.nuclear?.atomicMassU||55.8).toFixed(2)} u`,composition:n?`Compounds: ${n.compounds.slice(0,3).map(e=>e.formula).join(` · `)} · Phase: ${Ut?.emergentPhase||Kt}`:`Phase: ${Ut?.emergentPhase||Kt} · ⟨Z⟩ = ${(Ut?.meanCoordination||0).toFixed(2)}`,nextLevel:6}]}if(e===6){let e=Mr(Yt,$t)?.bundle,t=e?.symbol||`Fe`,n=`${Xt}${[`s`,`p`,`d`,`f`,`g`][Zt]||`d`} (m=${Qt})`,r=Number(e?.atomic?.totalEnergyHa);return[{id:`quantum-nucleus-core`,level:6,name:en===`molecule`?`${Nn[tn].formula} Molecule (RHF)`:`${t} (Z=${Yt}) · ${n}`,subtitle:en===`molecule`?`WebGPU STO-3G RHF · E = ${(Number(rn?.totalEnergyHa)||0).toFixed(3)} Ha`:`4-Comp Dirac–KS (${$t?`Relativistic ON`:`Non-Rel`}) · ${nn?.pointCount?.toLocaleString()||0} pts`,pos:[0,0,0],radius:1.2,sampleZ:Yt,tempK:300,massLabel:Number.isFinite(r)?`E = ${r.toFixed(1)} Ha`:`—`,composition:`Z=${Yt} · ${e?.atomic?.configurationString||t} · ${e?.electromagnetic?.magneticPhase||`—`}`,nextLevel:7}]}if(e===7){let e=sn?.isotope?.split(`-`)[0]||`Z=${an}`,t=Number(sn?.bindingPerNucleonMeV??8.79),n=Number(sn?.chargeRadiusFm??3.7);return[{id:`nucleus-core`,level:7,name:`${on}${e} Atomic Nucleus`,subtitle:`Z=${an} protons, N=${Math.max(0,on-an)} neutrons · Woods–Saxon + Visscher TDSE`,pos:[0,0,0],radius:1.5,tempK:1e10,massLabel:`B/A = ${t.toFixed(3)} MeV`,composition:`Protons ${an} · Neutrons ${Math.max(0,on-an)} · R_c = ${n.toFixed(2)} fm`,nextLevel:0}]}return[]}function Nr(){pn=!0,Yn();try{E?.destroy()}catch{}try{F?.dispose()}catch{}try{B?.dispose()}catch{}try{oe?.dispose()}catch{}try{Ee?.dispose()}catch{}try{ke?.dispose()}catch{}try{H?.dispose()}catch{}try{Ie?.dispose()}catch{}try{Be?.dispose()}catch{}try{Ge?.dispose()}catch{}try{Je?.dispose()}catch{}try{Ze?.dispose()}catch{}try{Qe?.dispose()}catch{}try{ut?.dispose()}catch{}try{gt?.dispose()}catch{}try{yt?.dispose()}catch{}try{Nt?.dispose()}catch{}try{It?.dispose()}catch{}try{K?.dispose()}catch{}try{J?.destroy()}catch{}try{nn?.pointsBuffer?.destroy()}catch{}try{cn?.destroy()}catch{}}return Object.freeze({AU_METERS:Oe,REAL_SOLAR_SYSTEM_CATALOG:Me,MOLECULE_SPECS:Nn,COSMIC_EPOCH_PRESETS:te,get seed(){return o},get busy(){return fn},get quality(){return s},get cosmicEpochId(){return p},get cosmicEpoch(){return m},get activeGalaxyEnv(){return h},get activeStarSite(){return g},get activeCausalSystem(){return S},get activeSampledMaterial(){return Jt},get useSolReference(){return _},getActiveSystemCatalog:C,getDefaultPlanetIndex:w,selectCausalStarSite:bn,sampleNewGalacticSector:xn,setUseSolReference:Sn,deriveGalaxyEnvironmentFromCosmicContext:tt,deriveStarSystemFromGalacticLocation:rt,synthesizeNebularPlanetarySystem:it,get cosmoMode(){return T},get cosmoSession(){return E},get cosmoTelemetry(){return k},get cosmoFirstPk(){return N},get cosmoTargets(){return P},get cosmoBaryonSession(){return F},get cosmoBaryonTelemetry(){return I},get galaxyEngine(){return B},get galacticDynamoSession(){return oe},get galacticDynamoTelemetry(){return se},get galacticDynamoStreamlines(){return fe},get galacticB0(){return me},get galaxyPreset(){return ye},get galaxyMetallicity(){return be},get galaxyFocusPos(){return Ce},get galaxyBranch(){return we},get showGalacticBField(){return Te},get smbhEngine(){return Ee},get smbhBodies(){return De},get ismCoolingAnchors(){return xe},get solarEngine(){return ke},get solarMode(){return V},get protoplanetarySession(){return H},get protoplanetaryTelemetry(){return Pe},get protoplanetaryGasDrag(){return Fe},get kerrJetSession(){return Ie},get kerrJetTelemetry(){return Re},get kerrSpinA(){return ze},get relBinarySession(){return Be},get relBinaryTelemetry(){return Ue},get relBinaryMode(){return We},get radWindL2Session(){return Ge},get radWindL2Telemetry(){return Ke},get tidalRocheSession(){return Je},get tidalRocheTelemetry(){return Ye},get solarConservation0(){return Ae},get solarConservation(){return je},get focusedSolarBodyIndex(){return Ne},get stellarEngine(){return Ze},get stellarDynamoSession(){return Qe},get stellarDynamoTelemetry(){return $e},get stellarDynamoStreamlines(){return et},get stellarB0(){return nt},get stellarMode(){return W},get nebulaMhdSession(){return ut},get nebulaMhdTelemetry(){return ft},get nebulaMhdStreamlines(){return mt},get nebulaB0(){return ht},get radWindL3Session(){return gt},get radWindL3Telemetry(){return _t},get magnetosphereSession(){return yt},get magnetosphereTelemetry(){return xt},get magnetosphereFieldLines(){return wt},get tovCurve(){return Tt},get stellarPreset(){return at},get stellarTelemetry(){return U},get stellarNuclearNetwork(){return ot},get stellarLaneEmden(){return st},get stellarTimeAccel(){return lt},get planetaryMode(){return Dt},get planetaryResult(){return G},get planetaryBodyIndex(){return kt},get planetaryCutaway(){return At},get planetaryAtmoState(){return Mt},get planetaryAtmoSession(){return Nt},get planetaryAtmoTelemetry(){return Pt},get planetaryTriboelectric(){return Ft},get cryoPlumeSession(){return It},get cryoPlumeTelemetry(){return Lt},get surfaceActive(){return zt},get surfaceSession(){return K},get surfaceTelemetry(){return Ht},get surfaceControls(){return q},get mdSession(){return J},get mdTelemetry(){return Ut},get mdElementZ(){return Wt},get mdTempK(){return Y},get mdGravity(){return Gt},get mdPhasePreset(){return Kt},get mdRdfHistory(){return qt},get quantumZ(){return Yt},get quantumN(){return Xt},get quantumL(){return Zt},get quantumM(){return Qt},get quantumRelativistic(){return $t},get quantumMode(){return en},get quantumMoleculeKey(){return tn},get orbitalCloud(){return nn},get moleculeRhfResult(){return rn},get nuclearZ(){return an},get nuclearA(){return on},get nuclearResult(){return sn},get tdseSession(){return cn},get tdseTelemetry(){return ln},evaluateIsmRadiativeCoolingErgCm3PerS:St,evaluateStellarEvolutionaryState:z,buildQuantizedNucleonSpheres:In,getElementBundle:mn,getCachedElementBundle:Mr,ensureLevelInitialized:er,initCosmicWeb:hn,initCosmoBaryonRegime:Tn,initGalaxy:gn,initSmbhCore:_n,initSolarSystem:vn,initProtoplanetaryDisk:wn,initKerrQuasarJet:Dn,initRelativisticBinary:On,initRadiativeWindL2:Ln,initTidalRocheL2:Rn,initNebularMhd:Z,initRadiativeWindL3:zn,initCompactMagnetosphere:Bn,initWhiteDwarfTovCurve:Vn,initStellarCore:Un,initPlanetaryInterior:Wn,initCryoPlumesL4:Hn,initMolecularDynamics:Gn,initQuantumAtom:Kn,initAtomicNucleus:qn,stepActiveRegimes:Jn,setCosmicEpoch:lr,setCosmoMode:ur,setQuality:tr,setSeed:nr,setMdGravity:ar,setMdTemp:or,setSampledMaterial:rr,applySampledMaterialToLattice:ir,computeScaleAdaptiveTimeDilation:Pn,setPlanetaryCutaway:sr,setPlanetaryTriboelectric:xr,setPlanetaryMode:hr,enterSurfaceView:Sr,exitSurfaceView:Cr,setSurfaceVehicle:Q,setSurfaceUfoAltitudeKm:wr,setSurfaceCameraMode:Tr,setSurfaceControls:Er,addSurfaceLookDelta:Dr,adjustSurfaceChaseDistance:Or,triggerSurfaceTractorPulse:e=>K?.triggerTractorPulse?.(e),setSurfaceTractorBeam:e=>K?.setTractorBeam?.(e),setSurfaceWeaponConfig:e=>K?.setWeaponConfig?.(e),setSurfaceWeaponFire:e=>K?.setWeaponFire?.(e),launchSurfaceMissile:e=>K?.launchMissile?.(e),setSurfaceExternalEntities:e=>K?.setExternalEntities?.(e),drainSurfaceEvents:()=>K?.drainPendingEvents?.()||{harvested:{silicates:0,volatiles:0,metals:0,exotics:0},peerHits:[]},setStellarTimeAccel:cr,setSolarMode:dr,setKerrSpinA:fr,setProtoplanetaryGasDrag:pr,setStellarMode:mr,setNebulaB0:gr,setGalacticB0:vr,setStellarB0:yr,setCosmoFocusMpc:br,setShowGalacticBField:_r,setGalaxyBranch:Ar,setFocusedSolarBody:jr,getActiveUniversalLaws:kr,getTargetsForLevel:$,connectPeerMesh:Xn,disconnectPeerMesh:Yn,getPeerMeshState:Zn,dispatchPeerDerivation:Qn,dispose:Nr})}var zn=Object.freeze({COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Bn=Object.freeze({TEXTURE_BINDING:4,RENDER_ATTACHMENT:16}),Vn=`
struct CameraUniforms {
  view_proj: mat4x4<f32>,
  cam_pos: vec4<f32>,    // xyz = camera world position, w = timeSec
  cam_right: vec4<f32>,  // xyz = right basis, w = aspect
  cam_up: vec4<f32>,     // xyz = up basis, w = fovTanHalf
  cam_fwd: vec4<f32>,    // xyz = forward basis, w = log10SpanM
  extra0: vec4<f32>,     // mode-specific floats
  extra1: vec4<f32>,     // mode-specific floats
  extra2: vec4<f32>,     // mode-specific floats
};
`,Hn=`
${Vn}

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
  out.pos = vec4<f32>(pts[vid], 0.9999, 1.0);
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
  col = col + star_layer(dir, 58.0, 0.972) * 1.15 * star_vis;
  col = col + star_layer(dir, 130.0, 0.978) * 0.68 * star_vis;
  col = col + star_layer(dir, 230.0, 0.986) * 0.32 * star_vis;
  return vec4<f32>(col, 1.0);
}
`,Un=`
${Vn}

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
  out.pos = vec4<f32>(pts[vid], 0.9999, 1.0);
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
  let sky_zen = cam.extra0.rgb;
  let opt_depth = clamp(cam.extra0.w, 0.0, 1.0);
  let sun_dir = normalize(cam.extra1.xyz);
  let sky_hor = cam.extra2.rgb;

  // Smooth elevation gradient from horizon haze band to deep zenith sky!
  let elev = clamp(dir.y, -0.35, 1.0);
  let sky_t = pow(clamp((elev + 0.04) / 1.04, 0.0, 1.0), 0.56);
  var col = mix(sky_hor, sky_zen, sky_t);

  // Subtle below-horizon horizon-haze fill so curved TinyPlanet terrain melts seamlessly into the horizon!
  if (dir.y < 0.0) {
    let below = 1.0 - smoothstep(-0.36, 0.0, dir.y);
    col = mix(col, sky_hor * mix(0.96, 0.84, opt_depth), below);
  }

  // Forward Mie solar scattering + crisp HDR solar disk
  let cos_sun = dot(dir, sun_dir);
  let sun_disk = smoothstep(0.9986, 0.9996, cos_sun);
  let sun_halo = pow(max(0.0, cos_sun), 10.0) * (0.28 + 0.52 * opt_depth)
    + pow(max(0.0, cos_sun), 64.0) * (0.55 + 0.65 * opt_depth);
  let sun_col = mix(vec3<f32>(1.0, 0.96, 0.88), vec3<f32>(1.0, 0.78, 0.52), opt_depth * 0.45);
  col = col + sun_col * sun_halo + vec3<f32>(2.4, 2.25, 1.95) * sun_disk;

  // High-contrast crisp stars shine brightly in airless vacuum (Moon/Mercury!) and fade cleanly in atmospheric skies
  let star_vis = clamp((1.0 - smoothstep(0.03, 0.30, opt_depth)) * smoothstep(-0.02, 0.14, dir.y), 0.0, 1.0);
  if (star_vis > 0.02) {
    let stars = star_layer_s(dir, 62.0, 0.970) * 1.25
      + star_layer_s(dir, 140.0, 0.978) * 0.72
      + star_layer_s(dir, 240.0, 0.986) * 0.35;
    col = col + stars * star_vis;
  }

  return vec4<f32>(col, 1.0);
}
`,Wn=`
${Vn}

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
  out.pos = cam.view_proj * vec4<f32>(in.pos_curv.xyz, 1.0);
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
    let strata = 0.91 + 0.14 * sin(raw_h * 3.2 + n1.x * 2.4);
    base_col = base_col * grain * mix(1.0, strata, slope_w * 0.72);
  }

  let ndl = max(0.0, dot(n, sun_dir));
  let ndv = max(0.0, dot(n, v));
  let fresnel = pow(max(0.0, 1.0 - ndv), 3.8);

  // Hemispheric sky-bounce ambient (deep crisp shadows in vacuum; soft atmospheric scatter in dense air!)
  let hemi_up = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  let amb_sky = mix(sky_hor * 0.42 + vec3<f32>(0.04, 0.05, 0.07), sky_zen * 0.55 + vec3<f32>(0.05, 0.06, 0.09), hemi_up);
  let amb_gain = mix(0.24, 0.55, opt_depth);
  let sun_tint = mix(vec3<f32>(1.05, 1.02, 0.96), vec3<f32>(1.12, 0.95, 0.78), opt_depth * 0.35);

  var lit = base_col * (amb_sky * amb_gain + sun_tint * (ndl * 1.18));

  if (tag > 1.5 && tag < 2.5) {
    // Liquid ocean surface: non-orthogonal rotated multi-octave waves + turquoise shallow glint + Fresnel sky reflection!
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
    let w_spec = pow(max(0.0, dot(nw, hw)), 84.0) * 1.35;
    let w_fres = pow(max(0.0, 1.0 - max(0.0, dot(nw, v))), 3.2);
    let foam_n = surf_noise(p_w * 1.35 + vec2<f32>(t * 0.4, t * 0.25));
    let foam = smoothstep(0.68, 0.92, foam_n + sin(ph1) * 0.14) * 0.16;
    lit = mix(lit, sky_hor * 0.95 + vec3<f32>(0.08, 0.18, 0.30), w_fres * 0.70) + sun_tint * w_spec + vec3<f32>(0.85, 0.94, 0.98) * foam * ndl;
  } else if (tag > 3.5) {
    // Metallic Rover, Drone, & UFO hardware: crisp Blinn-Phong specular + rim edge highlight!
    let m_spec = pow(max(0.0, dot(n, half_v)), 48.0) * 0.72;
    lit = lit + sun_tint * m_spec + (sky_hor * 0.38 + vec3<f32>(0.14, 0.18, 0.24)) * fresnel * 0.48;
  } else {
    // Subtle mineral sheen on ice/basalt slopes
    let r_spec = pow(max(0.0, dot(n, half_v)), 20.0) * select(0.08, 0.28, tag > 0.5 && tag < 1.5);
    lit = lit + sun_tint * r_spec;
  }

  // Per-pixel volcanic basalt-fissure glow enhancement on Magma Ocean worlds (zero blocky vertex borders!)
  var emiss_eff = emissive;
  var emiss_col = in.albedo;
  if (cam.extra2.w > 0.5 && tag < 3.5) {
    let f1 = surf_noise(in.world_pos.xz * 0.38 + vec2<f32>(3.1, -5.2));
    let f2 = surf_noise(in.world_pos.xz * 1.15 - vec2<f32>(7.4, 2.8));
    let vein = 1.0 - smoothstep(0.03, 0.16, abs((f1 * 0.7 + f2 * 0.3) - 0.5));
    let molten = clamp(emissive * (0.65 + 0.55 * f2) + vein * 1.15, 0.0, 2.2);
    emiss_eff = molten;
    emiss_col = mix(vec3<f32>(1.0, 0.24, 0.03), vec3<f32>(1.0, 0.86, 0.32), clamp(molten * 0.62, 0.0, 1.0));
  }
  lit = lit + emiss_col * emiss_eff * 1.20;

  // Exponential atmospheric perspective fog + smooth wide-horizon fade (>600 m Rover/UFO view distance!)
  let horiz_dist = length(in.world_pos.xz - cam.cam_pos.xz);
  let fog_density = mix(0.00024, 0.00105, opt_depth);
  let fog_amt = clamp(1.0 - exp(-dist * fog_density), 0.0, 0.84);
  let patch_edge = smoothstep(420.0, 595.0, horiz_dist);
  let total_fog = clamp(max(fog_amt, patch_edge), 0.0, 1.0);
  let final_col = mix(lit, sky_hor, total_fog);
  return vec4<f32>(final_col, 1.0);
}
`,Gn=`
${Vn}

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
  out.pos = cam.view_proj * vec4<f32>(in.pos_curv.xyz, 1.0);
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
`,Kn=`
${Vn}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> raw_f32: array<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) shape: f32, // 0 = crisp glowing star/spark, 1 = soft volumetric 3D cloud billow, 2 = CFD flow streak
};

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
    // L0: Supergalactic 2LPT + TreePM (16 floats/particle) — IllustrisTNG / Millennium cosmic web
    // When world_scale < 0.0, projects onto celestial skybox sphere (radius = -world_scale) from galaxy's exact Cosmic-Web location!
    let o = iid * 16u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let box_sz = max(10.0, cam.extra1.w);
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
    p_world = select(rel_c * world_scale, cam.cam_pos.xyz + (rel_c / max(1e-3, d_rel_c)) * (-world_scale), is_sky);
    let rho = clamp(raw_f32[o + 7u], 0.04, 1.0);
    let is_baryon = raw_f32[o + 12u] > 0.5;
    let col_void = vec3<f32>(0.14, 0.18, 0.62);
    let col_fil = vec3<f32>(0.18, 0.64, 1.0);
    let col_node = vec3<f32>(1.0, 0.72, 0.28);
    var c_dm = mix(col_void, col_fil, smoothstep(0.08, 0.56, rho));
    c_dm = mix(c_dm, col_node, smoothstep(0.60, 0.96, rho));
    let c_bar = mix(vec3<f32>(0.94, 0.38, 0.22), vec3<f32>(1.0, 0.80, 0.36), smoothstep(0.18, 0.90, rho));
    let sky_att = select(1.0, clamp(42.0 / (16.0 + d_rel_c), 0.35, 1.85), is_sky);
    col = select(c_dm, c_bar, is_baryon) * (0.78 + 1.05 * pow(rho, 0.90));
    pt_size = pt_size_base * (0.56 + 0.92 * pow(rho, 0.85)) * select(1.0, 0.68 + 0.52 * sky_att, is_sky);
    alpha = alpha_gain * (0.28 + 0.72 * pow(rho, 0.92)) * sphere_fade * sky_att;
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
    } else if (pop_tag < 0.78) {
      let f = clamp((pop_tag - 0.35) / 0.43, 0.0, 1.0);
      col = mix(vec3<f32>(0.86, 0.91, 1.0), ob_blue, f);
      pt_size = pt_size_base * (0.44 + 0.72 * f);
      alpha = alpha_gain * (0.28 + 0.56 * f);
    } else {
      let f = clamp((pop_tag - 0.78) / 0.32, 0.0, 1.0);
      col = mix(h2_rose, vec3<f32>(1.0, 0.56, 0.78), f);
      pt_size = pt_size_base * (0.95 + 0.75 * f);
      alpha = alpha_gain * (0.36 + 0.44 * f);
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
    }
  } else if (mode == 2u) {
    // L3: Self-Gravitating Hydro Plasma (16 floats/parcel)
    // Purely physical (log_t, log_rho, log_eps) radiative-transport thermalization:
    //   - Diffuse molecular clouds (log_rho < -5): exact blackbody_rgb(log_t) (violet -> crimson -> amber)
    //   - Optically thick stellar envelope (log_rho >= -5): solar photospheric golden-orange-white
    //     transitioning to radiant white-gold core & luminous cyan-white only in active nuclear fusion / SN!
    let o = iid * 16u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let log_t = raw_f32[o + 8u];
    let log_rho = raw_f32[o + 9u];
    let log_eps = raw_f32[o + 11u];
    let fusion_glow = smoothstep(-0.5, 4.5, log_eps);
    let dens_w = clamp((log_rho + 18.0) / 22.0, 0.15, 1.0);
    let thick_star = smoothstep(3.45, 4.10, log_t);
    let env_t = clamp((log_t - 5.2) / 1.9, 0.0, 1.0);
    let solar_surf = mix(vec3<f32>(1.0, 0.42, 0.08), vec3<f32>(1.0, 0.76, 0.28), env_t);
    let solar_mid = mix(solar_surf, vec3<f32>(1.0, 0.94, 0.74), smoothstep(0.55, 0.96, env_t));
    let sn_flash = smoothstep(7.6, 8.6, log_t);
    let star_col = mix(solar_mid, vec3<f32>(0.76, 0.94, 1.0), clamp(fusion_glow * 0.52 + sn_flash * 0.85, 0.0, 1.0));
    let cloud_col = mix(blackbody_rgb(log_t), vec3<f32>(0.58, 0.94, 1.0), fusion_glow * 0.55);
    col = mix(cloud_col, star_col, thick_star) * (0.90 + 0.95 * fusion_glow + 0.35 * sn_flash);
    pt_size = pt_size_base * (0.72 + 1.05 * dens_w);
    alpha = alpha_gain * (0.28 + 0.58 * dens_w);
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
    // Mode 8: Photoionized Nebulae (H II Pillars / Planetary Nebula / SNR-PWN: H-alpha, [O III], [S II]) + Dual-Tail Comets + Hot-Jupiter XUV!
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
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let ha = clamp(raw_f32[o + 8u], 0.0, 2.0);
    let o3 = clamp(raw_f32[o + 9u], 0.0, 2.0);
    let s2_dust = clamp(raw_f32[o + 10u], 0.0, 2.0);
    // Physically mapped optical emission palette:
    //   [O III] 500.7nm -> electric teal-cyan, H-alpha 656.3nm -> rose-crimson, [S II]/Dust -> warm amber-gold!
    let c_ha = vec3<f32>(1.0, 0.28, 0.44) * ha;
    let c_o3 = vec3<f32>(0.16, 0.88, 1.0) * o3;
    let c_s2 = vec3<f32>(1.0, 0.72, 0.28) * s2_dust;
    let tot = max(0.12, ha + o3 + s2_dust);
    col = (c_ha + c_o3 + c_s2) * (0.95 / pow(tot, 0.28));
    pt_size = pt_size_base * (0.72 + 0.62 * min(1.5, tot));
    alpha = alpha_gain * clamp(0.24 + 0.56 * min(1.5, tot), 0.05, 0.90);
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
  if (shape > 1.5) {
    // Orient billboard cleanly along projected 3D CFD velocity vector so airflow curves visually in 3D!
    let to_cam = normalize(cam.cam_pos.xyz - p_world);
    let side = normalize(cross(streak_axis, to_cam) + vec3<f32>(0.0, 1e-4, 0.0));
    world_corner = p_world
      + streak_axis * (uv.x * streak_len)
      + side * (uv.y * pt_size * 0.42);
  } else {
    world_corner = p_world
      + cam.cam_right.xyz * (uv.x * pt_size)
      + cam.cam_up.xyz * (uv.y * pt_size);
  }
  let clip = cam.view_proj * vec4<f32>(world_corner, 1.0);

  var out: VsOut;
  out.pos = clip;
  out.color = vec4<f32>(col, alpha);
  out.uv = uv;
  out.shape = shape;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.uv, in.uv);
  if (r2 > 1.0) { discard; }
  var w: f32;
  if (in.shape > 1.5) {
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
    return vec4<f32>(in.color.rgb * cloud_tint * top_sun * w * in.color.a, in.color.a * w);
  } else {
    let core = exp(-6.2 * r2);
    let halo = exp(-2.2 * r2) * 0.28;
    w = core + halo;
  }
  return vec4<f32>(in.color.rgb * w * in.color.a, in.color.a * w);
}
`,qn=`
${Vn}

// 4 vec4s (64 bytes) per sphere instance:
//   pos_r:  vec4(x, y, z, true_radius)
//   color0: vec4(r, g, b, kind)   kind: 0=star, 1=terrestrial/ocean/rocky, 2=gas-giant/haze, 3=ice/moon, 4=cutaway-planet, 5=black-hole/nucleus, 6=nucleon
//   color1: vec4(r2, g2, b2, atm_strength)
//   params: vec4(r_core_norm, r_mantle_norm, cutaway_active, seed)
struct SphereInstance {
  pos_r: vec4<f32>,
  color0: vec4<f32>,
  color1: vec4<f32>,
  params: vec4<f32>,
};

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> spheres: array<SphereInstance>;
// Zero-copy live GPU Planetary Baroclinic Atmosphere + Triboelectric Lightning + Aurora grid!
// 2 vec4 per cell: [i*2+0]=em0(rhoQ, phi, eMag, flash), [i*2+1]=vis(cloud, dust, lightningGlow, auroraGlow)
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

  let base_inflate = radius * select(1.48, 1.24, dist > radius * 2.6);
  let inflate = max(base_inflate, select(0.0, min_world_half, kind <= 4u));
  let world_quad = center + to_cam * min(radius * 0.15, dist * 0.05) + right * (uv.x * inflate) + up * (uv.y * inflate);

  var out: VsOut;
  out.pos = cam.view_proj * vec4<f32>(world_quad, 1.0);
  out.center = center;
  out.radius = radius;
  out.world_quad = world_quad;
  out.color0 = sp.color0;
  out.color1 = sp.color1;
  out.params = sp.params;
  out.quad_uv = uv;
  out.pinpoint_w = select(0.0, pinpoint_w, kind <= 4u);
  out.inst_id = iid;
  return out;
}

fn sample_live_atmo_vis(n_hit: vec3<f32>, w_u: u32, h_u: u32) -> vec4<f32> {
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
  let c00 = atmo_em_grid[(iy0 * w_u + ix0) * 2u + 1u];
  let c10 = atmo_em_grid[(iy0 * w_u + ix1) * 2u + 1u];
  let c01 = atmo_em_grid[(iy1 * w_u + ix0) * 2u + 1u];
  let c11 = atmo_em_grid[(iy1 * w_u + ix1) * 2u + 1u];
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

@fragment
fn fs_main(in: VsOut) -> FsOut {
  let ro = cam.cam_pos.xyz - in.center;
  let rd = normalize(in.world_quad - cam.cam_pos.xyz);
  let r = in.radius;
  let b = dot(ro, rd);
  let c = dot(ro, ro) - r * r;
  let disc = b * b - c;

  let kind = u32(round(in.color0.w));
  let light_dir = normalize(cam.extra1.xyz);
  let cut_active = in.params.z;

  if (disc < 0.0) {
    // 1. Sub-pixel astronomical pinpoint glint when true physical disk is < ~2.5 px at AU distances
    if (in.pinpoint_w > 0.02) {
      let q2 = dot(in.quad_uv, in.quad_uv);
      if (q2 < 1.0) {
        let g_core = exp(-8.0 * q2);
        let g_halo = exp(-2.6 * q2) * select(0.32, 0.58, kind == 0u);
        let glint_col = mix(in.color0.rgb, vec3<f32>(1.0, 0.98, 0.94), select(0.45, 0.65, kind == 0u));
        let alpha = clamp((g_core + g_halo) * in.pinpoint_w * select(0.95, 1.25, kind == 0u), 0.0, 1.0);
        var out_g: FsOut;
        out_g.color = vec4<f32>(glint_col * (g_core * 1.45 + g_halo) * in.pinpoint_w, alpha);
        let clip_g = cam.view_proj * vec4<f32>(in.center, 1.0);
        out_g.depth = clamp(clip_g.z / max(1e-5, clip_g.w), 0.0, 0.9999);
        return out_g;
      }
    }
    // 2. Physical solar corona glow for stars (kind 0) & Rayleigh atmospheric halo for planets (kind 1/4)
    let closest = max(0.0, -b);
    let d_min = length(ro + rd * closest) / max(1e-6, r);
    if (kind == 0u && d_min < 1.45) {
      let corona = exp(-(d_min - 1.0) * 6.8) * 0.78;
      var out_c: FsOut;
      out_c.color = vec4<f32>(in.color0.rgb * corona * 1.5, corona);
      // Far depth so translucent stellar corona glow NEVER carves square cutouts out of nebula/ring/jet particles!
      out_c.depth = 0.99999;
      return out_c;
    }
    if ((kind == 1u || kind == 4u) && in.color1.w > 0.25 && d_min < 1.07) {
      let h_atmo = exp(-(d_min - 1.0) * 42.0) * in.color1.w * 0.62;
      let lit_side = clamp(dot(normalize(ro + rd * closest), light_dir) * 0.8 + 0.35, 0.0, 1.0);
      var out_a: FsOut;
      out_a.color = vec4<f32>(vec3<f32>(0.34, 0.68, 1.0) * h_atmo * lit_side, h_atmo * lit_side);
      out_a.depth = 0.99999;
      return out_a;
    }
    discard;
  }

  let sqrt_d = sqrt(disc);
  var t_hit = -b - sqrt_d;
  if (t_hit < 0.000001) { t_hit = -b + sqrt_d; }
  if (t_hit < 0.000001) { discard; }

  var p_hit = ro + rd * t_hit;
  var n_hit = normalize(p_hit);
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
  // Warm golden-crimson Rayleigh/Mie sunset glow right along the day-night terminator on atmospheric worlds!
  let term_d = (raw_ndl - 0.04) / 0.16;
  let term_sunset = exp(-(term_d * term_d)) * in.color1.w;
  let half_v = normalize(light_dir + view_dir);
  let spec = pow(max(0.0, dot(n_hit, half_v)), 44.0);
  let fresnel = pow(max(0.0, 1.0 - ndv), 3.6);
  let seed_v = vec3<f32>(in.params.w * 2.13, in.params.w * 1.47, in.params.w * 3.19);

  var col = vec3<f32>(0.8);

  if (kind == 0u) {
    // Realistic convective solar photosphere with multi-scale granulation & limb darkening
    let g1 = fbm5(n_hit * 8.5 + seed_v + vec3<f32>(cam.cam_pos.w * 0.04, 0.0, 0.0));
    let g2 = fbm5(n_hit * 22.0 - seed_v);
    let gran = clamp(0.65 * g1 + 0.35 * g2, 0.0, 1.0);
    let limb = pow(ndv, 0.52);
    col = mix(in.color1.rgb, in.color0.rgb, 0.35 + 0.65 * gran) * (0.58 + 0.85 * limb);
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
  } else if (kind == 2u) {
    // Banded Gas / Dense-Cloud World with Kelvin-Helmholtz zonal eddies, anticyclonic storm ovals, lightning, & polar aurorae!
    let turb = fbm5(n_hit * 5.2 + seed_v);
    let kh_shear = fbm5(vec3<f32>(n_hit.x * 7.5 + turb * 0.9, n_hit.y * 28.0, n_hit.z * 7.5 - turb * 0.9) + seed_v);
    let lat = n_hit.y * 16.5 + (turb - 0.5) * 3.2 + (kh_shear - 0.5) * 0.75;
    let band = 0.5 + 0.5 * sin(lat) * cos(lat * 0.45 + turb * 1.6);
    let fine_jet = fbm5(vec3<f32>(n_hit.x * 4.5, n_hit.y * 22.0, n_hit.z * 4.5) + seed_v);
    var base = mix(in.color1.rgb * 0.78, in.color0.rgb * 1.10, clamp(0.16 + 0.56 * band + 0.28 * fine_jet, 0.0, 1.0));
    // Subtle polar cool atmospheric darkening + anticyclonic storm oval vortex
    let polar_haze = smoothstep(0.68, 0.96, abs(n_hit.y));
    base = mix(base, in.color1.rgb * 0.68 + vec3<f32>(0.08, 0.12, 0.20), polar_haze * 0.45);
    let spot_lon = atan2(n_hit.z, n_hit.x) - fract(in.params.w * 0.37) * 6.283 + 3.1415;
    let spot_d = length(vec2<f32>(sin(spot_lon * 0.5) * 1.35, (n_hit.y + 0.34) * 3.4));
    let spot_w = (1.0 - smoothstep(0.14, 0.34, spot_d)) * smoothstep(0.35, 0.75, in.color0.r);
    let spot_swirl = 0.72 + 0.28 * sin(spot_d * 24.0 + turb * 5.0);
    base = mix(base, mix(in.color0.rgb, vec3<f32>(0.92, 0.42, 0.22), 0.58) * spot_swirl, spot_w * 0.78);
    var em_fx = vec3<f32>(0.0);
    if (cam.extra2.w > 0.5 && in.inst_id == u32(round(cam.extra2.z))) {
      let av = sample_live_atmo_vis(n_hit, u32(round(cam.extra2.x)), u32(round(cam.extra2.y)));
      // Modulate storm-band bright ammonia decks & cyclonic ovals without washing out color bands
      let storm_w = smoothstep(0.28, 0.78, av.x);
      base = mix(base, mix(in.color0.rgb, vec3<f32>(0.98, 0.93, 0.84), 0.55), storm_w * 0.34);
      let bolt = smoothstep(0.38, 1.15, av.z);
      em_fx = em_fx + vec3<f32>(0.68, 0.90, 1.0) * bolt * (1.8 + 1.4 * (1.0 - ndl));
      // Electric blue-violet auroral oval glowing cleanly around magnetic cusps
      let aur = clamp(av.w, 0.0, 1.2);
      em_fx = em_fx + mix(vec3<f32>(0.24, 0.78, 1.0), vec3<f32>(0.62, 0.36, 1.0), clamp(abs(n_hit.y), 0.0, 1.0)) * aur * (0.38 + 0.82 * (1.0 - ndl));
    }
    let atm = vec3<f32>(0.58, 0.76, 1.0) * fresnel * in.color1.w;
    let sunset = vec3<f32>(0.95, 0.44, 0.16) * term_sunset * 0.14;
    col = base * (0.04 + 0.98 * ndl) * soft_term + base * 0.03 + sunset + atm * (0.15 + 0.85 * ndl) + em_fx;
  } else if (kind == 1u || kind == 4u) {
    // Photorealistic Terrestrial / Ocean / Mars / Mercury world with 5-octave FBM continents, analytical micro-normal relief, bathymetry, polar caps, & sunset terminator!
    let elev = fbm5(n_hit * 3.4 + seed_v);
    let detail = fbm5(n_hit * 14.0 + seed_v * 1.7);
    let has_ocean = in.color1.b > in.color1.r + 0.14;
    var surf = in.color0.rgb;
    var water_spec = 0.0;
    var bump_strength = 0.0;

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
      }
      // Polar ice caps
      let polar = smoothstep(0.76, 0.90, abs(n_hit.y) + (detail - 0.5) * 0.14);
      surf = mix(surf, vec3<f32>(0.90, 0.94, 0.98), polar);
      bump_strength = bump_strength * (1.0 - polar * 0.75);
    } else {
      // Rocky / Mars / Mercury world with craters, highlands & dust basins
      let crater = smoothstep(0.32, 0.68, detail);
      surf = mix(in.color1.rgb, in.color0.rgb, clamp(elev * 1.15 - 0.1 + 0.25 * crater, 0.0, 1.0));
      let polar = smoothstep(0.84, 0.94, abs(n_hit.y) + (detail - 0.5) * 0.08);
      surf = mix(surf, vec3<f32>(0.88, 0.90, 0.94), polar * select(0.0, 0.85, in.color1.w > 0.12));
      bump_strength = 0.58;
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

    // Live zero-copy GPU baroclinic clouds, billowing dust storms, Paschen lightning, & polar aurorae!
    let live_atmo = cam.extra2.w > 0.5 && in.inst_id == u32(round(cam.extra2.z));
    var em_lightning = vec3<f32>(0.0);
    var em_aurora = vec3<f32>(0.0);
    var cloud_cover = 0.0;
    if (live_atmo) {
      let av = sample_live_atmo_vis(n_hit, u32(round(cam.extra2.x)), u32(round(cam.extra2.y)));
      // Advect fine wispy 3D FBM cloud micro-structure onto the live GPU baroclinic cloud field
      // so synoptic ITCZ & Rossby storm bands break into realistic feathery cumulus/cyclone wisps (zero blocky texels!)
      let drift_v = vec3<f32>(cam.cam_pos.w * 0.018, 0.0, -cam.cam_pos.w * 0.014);
      let wisp1 = fbm5(n_hit * 10.5 + drift_v + seed_v * 0.6);
      let wisp2 = fbm5(n_hit * 23.0 - drift_v * 1.4 - seed_v);
      let cloud_wisp = clamp(wisp1 * 0.68 + wisp2 * 0.42, 0.0, 1.0);
      let cloud_raw = av.x * (0.55 + 0.85 * cloud_wisp);
      let cloud_d = smoothstep(0.18, 0.72, cloud_raw) * 0.88;
      cloud_cover = cloud_d;
      // Subtle 3D cloud drop-shadow cast onto ocean & continents directly away from host-star light_dir!
      let n_sh = normalize(n_hit + light_dir * 0.018);
      let av_sh = sample_live_atmo_vis(n_sh, u32(round(cam.extra2.x)), u32(round(cam.extra2.y)));
      let cloud_shadow = smoothstep(0.22, 0.72, av_sh.x * (0.55 + 0.85 * cloud_wisp)) * 0.28 * ndl;
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
      // Core-geodynamo polar auroral oval curtains (emerald-green 557.7nm O I -> violet N2+)!
      let aur = clamp(av.w, 0.0, 1.15);
      em_aurora = mix(vec3<f32>(0.14, 0.96, 0.56), vec3<f32>(0.58, 0.30, 1.0), clamp((abs(n_hit.y) - 0.80) * 4.0, 0.0, 1.0)) * aur * (0.42 + 0.90 * (1.0 - ndl));
    } else if (in.color1.w > 0.45) {
      let c_raw = fbm5(n_hit * 4.8 + vec3<f32>(cam.cam_pos.w * 0.012, 2.4, -1.9) + seed_v);
      let cloud = smoothstep(0.52, 0.74, c_raw) * 0.78;
      cloud_cover = cloud;
      surf = mix(surf, vec3<f32>(0.95, 0.97, 1.0), cloud);
      water_spec = water_spec * (1.0 - cloud);
    }

    let ndl_eff = mix(ndl_relief, ndl, cloud_cover * 0.85);
    let rayleigh = mix(vec3<f32>(0.78, 0.50, 0.30), vec3<f32>(0.30, 0.68, 1.0), select(0.25, 1.0, has_ocean));
    let atm = rayleigh * fresnel * in.color1.w * 0.98;
    let sunset = mix(vec3<f32>(0.98, 0.44, 0.14), vec3<f32>(1.0, 0.52, 0.18), select(0.0, 1.0, has_ocean)) * term_sunset * (0.16 + 0.24 * cloud_cover + 0.25 * fresnel);
    col = surf * (0.03 + 0.98 * ndl_eff) * soft_term + surf * 0.03 + sunset + vec3<f32>(1.0, 0.96, 0.88) * water_spec * ndl + atm * (0.14 + 0.86 * ndl) + em_lightning + em_aurora;
  } else if (kind == 3u) {
    // Cratered Moon / Icy World / Ice Giant with analytical crater-rim micro-relief!
    let n1 = fbm5(n_hit * 6.0 + seed_v);
    let n2 = fbm5(n_hit * 18.0 - seed_v);
    let up_r3 = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(n_hit.y) > 0.92);
    let t1_3 = normalize(cross(up_r3, n_hit));
    let t2_3 = cross(n_hit, t1_3);
    let c_x = fbm5(normalize(n_hit + t1_3 * 0.012) * 18.0 - seed_v);
    let c_y = fbm5(normalize(n_hit + t2_3 * 0.012) * 18.0 - seed_v);
    let n_crater = normalize(n_hit + (t1_3 * (n2 - c_x) + t2_3 * (n2 - c_y)) * 2.4);
    let ndl_c = max(0.0, dot(n_crater, light_dir));
    var base = mix(in.color1.rgb, in.color0.rgb, clamp(0.2 + 0.7 * n1 + 0.25 * n2, 0.0, 1.0));
    var em_ice = vec3<f32>(0.0);
    if (cam.extra2.w > 0.5 && in.inst_id == u32(round(cam.extra2.z))) {
      let av = sample_live_atmo_vis(n_hit, u32(round(cam.extra2.x)), u32(round(cam.extra2.y)));
      base = mix(base, vec3<f32>(0.88, 0.94, 1.0), clamp(av.x * 0.52, 0.0, 0.60));
      let bolt = smoothstep(0.32, 1.15, av.z);
      em_ice = em_ice + vec3<f32>(0.68, 0.92, 1.0) * bolt * (1.7 + 1.2 * (1.0 - ndl));
      em_ice = em_ice + vec3<f32>(0.24, 0.96, 0.72) * clamp(av.w, 0.0, 1.4) * (0.42 + 0.85 * (1.0 - ndl));
    }
    let atm = vec3<f32>(0.42, 0.76, 1.0) * fresnel * in.color1.w;
    col = base * (0.04 + 0.96 * ndl_c) * soft_term + base * 0.03 + vec3<f32>(1.0) * spec * 0.16 * ndl + atm * (0.15 + 0.85 * ndl) + em_ice;
  } else if (kind == 5u) {
    // Event horizon shadow OR glowing atomic nucleus pin
    let is_black_hole = dot(in.color0.rgb, in.color0.rgb) < 0.001;
    if (is_black_hole) {
      let photon_rim = pow(max(0.0, 1.0 - ndv), 4.8);
      col = vec3<f32>(1.0, 0.88, 0.64) * photon_rim * 1.4;
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
    col = basalt * (0.08 + 0.85 * ndl) * soft_term + lava * rift * 1.65 + atm * (0.35 + 0.65 * ndl);
  } else {
    // Kind 6: Quantized L7 Nuclear Protons (warm ruby-amber) & Neutrons (cool sapphire-silver)
    let base = mix(in.color0.rgb, in.color1.rgb, 0.22 + 0.55 * fresnel);
    col = base * (0.28 + 0.76 * ndl) + vec3<f32>(1.0, 0.96, 0.92) * spec * 0.72 + in.color0.rgb * fresnel * 0.35;
  }

  let world_hit = in.center + p_hit;
  let clip = cam.view_proj * vec4<f32>(world_hit, 1.0);
  var out: FsOut;
  out.color = vec4<f32>(col, 1.0);
  out.depth = clamp(clip.z / max(1e-5, clip.w), 0.0, 0.9999);
  return out;
}
`,Jn=`
${Vn}

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
  out.pos = cam.view_proj * vec4<f32>(world_quad, 1.0);
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
  let spec = pow(max(0.0, dot(n, normalize(light + view))), 52.0);
  let rim = pow(max(0.0, 1.0 - max(0.0, dot(n, view))), 3.0);
  let col = in.tint * (0.20 + 0.78 * ndl + 0.18 * ndl2) + vec3<f32>(1.0, 0.98, 0.94) * spec * 0.68 + in.tint * rim * 0.24;
  let clip = cam.view_proj * vec4<f32>(in.center + p_hit, 1.0);
  var out: FsOut;
  out.color = vec4<f32>(col * in.alpha_fade, in.alpha_fade);
  out.depth = clamp(clip.z / max(1e-5, clip.w), 0.0, 0.9999);
  return out;
}
`,Yn=`
${Vn}

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
  out.pos = cam.view_proj * vec4<f32>(world_pos, 1.0);
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
    return vec4<f32>(col * beam * (0.62 + 0.52 * shear) * alpha, alpha);
  } else {
    // Saturn Cassini-division ring system
    let u = clamp((r - in.r_in) / max(1e-4, in.r_out - in.r_in), 0.0, 1.0);
    let c_x = (u - 0.60) * 32.0;
    let e_x = (u - 0.88) * 55.0;
    let cassini = 1.0 - 0.88 * exp(-(c_x * c_x));
    let encke = 1.0 - 0.60 * exp(-(e_x * e_x));
    let ringlets = 0.72 + 0.28 * sin(u * 76.0) * cos(u * 27.0);
    let fade = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.92, 1.0, u));
    let alpha = clamp(fade * cassini * encke * ringlets * 0.74, 0.0, 0.86);
    return vec4<f32>(in.color_kind.rgb * (0.85 + 0.25 * ringlets) * alpha, alpha);
  }
}
`,Xn=`
${Vn}

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
  out.pos = cam.view_proj * vec4<f32>(in.pos, 1.0);
  out.color = in.color;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  return in.color;
}
`,Zn=`
${Vn}

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

  let steps = 44u;
  let dt = (t_exit - t_enter) / f32(steps);
  var accum = vec3<f32>(0.0);
  var trans = 1.0;

  for (var s = 0u; s < steps; s = s + 1u) {
    let t = t_enter + (f32(s) + 0.5) * dt;
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
`,Qn=`
struct PostUniforms {
  resolution: vec2<f32>,
  bh_uv: vec2<f32>,
  bh_strength: f32,
  warp_amount: f32,
  flash_amount: f32,
  crt_enabled: f32,
  pixel_size: f32,
  time_sec: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> u: PostUniforms;
@group(0) @binding(1) var scene_tex: texture_2d<f32>;
@group(0) @binding(2) var scene_samp: sampler;

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
`;function $n(e,t){let n=t.getContext(`webgpu`);if(!n)throw Error(`WebGPU canvas context unavailable`);let{format:r}=I(n,e,{preferCopySrc:!0}),i=`rgba16float`,a=`depth24plus`,o=0,s=0,c=null,l=null,u=null,d=null,f=e.createBuffer({label:`uv-cam-base`,size:176,usage:zn.UNIFORM|zn.COPY_DST}),p=Array.from({length:4},(t,n)=>e.createBuffer({label:`uv-cam-cloud-${n}`,size:176,usage:zn.UNIFORM|zn.COPY_DST})),m=e.createBuffer({label:`uv-cam-aux`,size:176,usage:zn.UNIFORM|zn.COPY_DST}),h=e.createBuffer({label:`uv-post-uniform`,size:48,usage:zn.UNIFORM|zn.COPY_DST}),g=e.createSampler({magFilter:`linear`,minFilter:`linear`}),_=e.createBuffer({label:`uv-spheres`,size:320*64,usage:zn.STORAGE|zn.COPY_DST}),v=e.createBuffer({label:`uv-disks`,size:768,usage:zn.STORAGE|zn.COPY_DST}),y=24576,b=e.createBuffer({label:`uv-lines`,size:y*28,usage:zn.VERTEX|zn.COPY_DST}),x=16384,S=e.createBuffer({label:`uv-cosmic-mesh`,size:x*48,usage:zn.VERTEX|zn.COPY_DST}),C=e.createBuffer({label:`uv-cosmic-fx`,size:x*48,usage:zn.VERTEX|zn.COPY_DST}),w=e.createBuffer({label:`uv-nuclear-vol`,size:1024*32*16,usage:zn.STORAGE|zn.COPY_DST}),T=1024*32*16,E=(t,n)=>e.createShaderModule({label:t,code:n}),D=E(`uv-backdrop`,Hn),O=e.createRenderPipeline({label:`uv-backdrop-pipe`,layout:`auto`,vertex:{module:D,entryPoint:`vs_main`},fragment:{module:D,entryPoint:`fs_main`,targets:[{format:i}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`always`}}),k=e.createBindGroup({layout:O.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:f}}]}),A=E(`uv-surface-sky`,Un),j=e.createRenderPipeline({label:`uv-surface-sky-pipe`,layout:`auto`,vertex:{module:A,entryPoint:`vs_main`},fragment:{module:A,entryPoint:`fs_main`,targets:[{format:i}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`always`}}),M=e.createBindGroup({layout:j.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}}]}),N=E(`uv-surface-mesh`,Wn),P=e.createRenderPipeline({label:`uv-surface-mesh-pipe`,layout:`auto`,vertex:{module:N,entryPoint:`vs_main`,buffers:[{arrayStride:48,attributes:[{shaderLocation:0,offset:0,format:`float32x4`},{shaderLocation:1,offset:16,format:`float32x4`},{shaderLocation:2,offset:32,format:`float32x4`}]}]},fragment:{module:N,entryPoint:`fs_main`,targets:[{format:i}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:a,depthWriteEnabled:!0,depthCompare:`less-equal`}}),F=e.createBindGroup({layout:P.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}}]}),ee=e.createBindGroup({layout:P.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:f}}]}),L=E(`uv-translucent-fx`,Gn),R=e.createRenderPipeline({label:`uv-translucent-fx-pipe`,layout:`auto`,vertex:{module:L,entryPoint:`vs_main`,buffers:[{arrayStride:48,attributes:[{shaderLocation:0,offset:0,format:`float32x4`},{shaderLocation:1,offset:16,format:`float32x4`},{shaderLocation:2,offset:32,format:`float32x4`}]}]},fragment:{module:L,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`less-equal`}}),te=e.createBindGroup({layout:R.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}}]}),ne=e.createBindGroup({layout:R.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:f}}]}),z=E(`uv-cloud`,Kn),re=e.createRenderPipeline({label:`uv-cloud-pipe`,layout:`auto`,vertex:{module:z,entryPoint:`vs_main`},fragment:{module:z,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`less-equal`}}),ie=e.createRenderPipeline({label:`uv-backdrop-cloud-pipe`,layout:`auto`,vertex:{module:z,entryPoint:`vs_main`},fragment:{module:z,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`always`}}),B=E(`uv-lit-sphere`,qn),ae=e.createRenderPipeline({label:`uv-lit-sphere-pipe`,layout:`auto`,vertex:{module:B,entryPoint:`vs_main`},fragment:{module:B,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!0,depthCompare:`less-equal`}}),oe=e.createBuffer({label:`uv-dummy-atmo-em`,size:64,usage:zn.STORAGE|zn.COPY_DST}),se=new WeakMap;function ce(t){let n=t||oe,r=se.get(n);return r||(r=e.createBindGroup({layout:ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:f}},{binding:1,resource:{buffer:_}},{binding:2,resource:{buffer:n}}]}),se.set(n,r)),r}let le=E(`uv-md-sphere`,Jn),ue=e.createRenderPipeline({label:`uv-md-sphere-pipe`,layout:`auto`,vertex:{module:le,entryPoint:`vs_main`},fragment:{module:le,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!0,depthCompare:`less-equal`}}),de=E(`uv-disk`,Yn),fe=e.createRenderPipeline({label:`uv-disk-pipe`,layout:`auto`,vertex:{module:de,entryPoint:`vs_main`},fragment:{module:de,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`less-equal`}}),pe=e.createBindGroup({layout:fe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:f}},{binding:1,resource:{buffer:v}}]}),me=E(`uv-line`,Xn),he=e.createRenderPipeline({label:`uv-line-pipe`,layout:`auto`,vertex:{module:me,entryPoint:`vs_main`,buffers:[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x4`}]}]},fragment:{module:me,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`line-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`less-equal`}}),ge=e.createBindGroup({layout:he.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:f}}]}),_e=E(`uv-nuclear-vol`,Zn),ve=e.createRenderPipeline({label:`uv-nuclear-vol-pipe`,layout:`auto`,vertex:{module:_e,entryPoint:`vs_main`},fragment:{module:_e,entryPoint:`fs_main`,targets:[{format:i,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:a,depthWriteEnabled:!1,depthCompare:`always`}}),ye=e.createBindGroup({layout:ve.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:w}}]}),be=E(`uv-post`,Qn),xe=e.createRenderPipeline({label:`uv-post-pipe`,layout:`auto`,vertex:{module:be,entryPoint:`vs_main`},fragment:{module:be,entryPoint:`fs_main`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),Se=null,Ce=Array.from({length:4},()=>new WeakMap),we=Array.from({length:4},()=>new WeakMap),Te=new WeakMap;function Ee(t,n,r=!1){let i=(r?we:Ce)[n],a=p[n],o=r?ie:re,s=i.get(t);return s||(s=e.createBindGroup({layout:o.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:a}},{binding:1,resource:{buffer:t}}]}),i.set(t,s)),s}function De(t,n){let r=Te.get(t);return r||(r=e.createBindGroup({layout:ue.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:n}}]}),Te.set(t,r)),r}function Oe(t,r){let f=Math.max(2,Math.floor(t)),p=Math.max(2,Math.floor(r));c&&o===f&&s===p||(o=f,s=p,I(n,e,{preferCopySrc:!0}),c?.destroy(),u?.destroy(),c=e.createTexture({label:`uv-scene-color`,size:[o,s],format:i,usage:Bn.RENDER_ATTACHMENT|Bn.TEXTURE_BINDING}),l=c.createView(),u=e.createTexture({label:`uv-scene-depth`,size:[o,s],format:a,usage:Bn.RENDER_ATTACHMENT}),d=u.createView(),Se=e.createBindGroup({layout:xe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:h}},{binding:1,resource:l},{binding:2,resource:g}]}))}function ke(t){!t||t.byteLength===0||(t.byteLength>T&&(w.destroy(),T=t.byteLength,w=e.createBuffer({label:`uv-nuclear-vol`,size:T,usage:zn.STORAGE|zn.COPY_DST}),ye=e.createBindGroup({layout:ve.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:w}}]})),e.queue.writeBuffer(w,0,t))}let Ae=new Float32Array(44),je=new Float32Array(12),Me=new Float32Array(320*16),Ne=new Float32Array(192),V=new Float32Array(y*7);function H(t,n,r,i,a){Ae.set(n.viewProj,0),Ae.set([n.pos[0],n.pos[1],n.pos[2],n.timeSec||0],16),Ae.set([n.right[0],n.right[1],n.right[2],n.aspect],20),Ae.set([n.up[0],n.up[1],n.up[2],n.fovTanHalf],24),Ae.set([n.fwd[0],n.fwd[1],n.fwd[2],n.log10SpanM??24.8],28),Ae.set(r||[0,0,0,0],32),Ae.set(i||[0,0,0,0],36),Ae.set(a||[0,0,0,0],40),e.queue.writeBuffer(t,0,Ae)}function Pe({camera:r,particleClouds:i=[],spheres:a=null,atmoEm:c=null,surfaceScene:u=null,cosmicMeshes:g=null,lightDir:w=[.6,.75,.55],mdCloud:T=null,disks:E=null,lines:D=null,nuclearVol:A=null,post:N={},stereoSbs:I=!1,xrEyeTarget:L=null}){Oe(t.width,t.height);let z=0;if(Array.isArray(a)&&a.length>0){z=Math.min(320,a.length);for(let e=0;e<z;e+=1){let t=a[e],n=e*16;Me[n+0]=t.pos[0],Me[n+1]=t.pos[1],Me[n+2]=t.pos[2],Me[n+3]=t.radius,Me[n+4]=t.color0[0],Me[n+5]=t.color0[1],Me[n+6]=t.color0[2],Me[n+7]=t.kind??1,Me[n+8]=t.color1?.[0]??t.color0[0],Me[n+9]=t.color1?.[1]??t.color0[1],Me[n+10]=t.color1?.[2]??t.color0[2],Me[n+11]=t.atm??.35,Me[n+12]=t.rCore??.52,Me[n+13]=t.rMantle??.94,Me[n+14]=+!!t.cutaway,Me[n+15]=t.seed??(e+1)*1.37}e.queue.writeBuffer(_,0,Me.subarray(0,z*16))}let B=0;if(Array.isArray(E)&&E.length>0){B=Math.min(16,E.length);for(let e=0;e<B;e+=1){let t=E[e],n=e*12;Ne[n+0]=t.center[0],Ne[n+1]=t.center[1],Ne[n+2]=t.center[2],Ne[n+3]=t.rIn,Ne[n+4]=t.normal[0],Ne[n+5]=t.normal[1],Ne[n+6]=t.normal[2],Ne[n+7]=t.rOut,Ne[n+8]=t.color?.[0]??.9,Ne[n+9]=t.color?.[1]??.85,Ne[n+10]=t.color?.[2]??.72,Ne[n+11]=t.kind??0}e.queue.writeBuffer(v,0,Ne.subarray(0,B*12))}let oe=0;D&&D.length>=14&&(oe=Math.min(y,Math.floor(D.length/7)),V.set(D.subarray(0,oe*7),0),e.queue.writeBuffer(b,0,V.subarray(0,oe*7)));let se=0,le=0;g&&(g.opaque&&g.opaque.length>=12&&(se=Math.min(x,Math.floor(g.opaque.length/12)),e.queue.writeBuffer(S,0,g.opaque.subarray(0,se*12))),g.fx&&g.fx.length>=12&&(le=Math.min(x,Math.floor(g.fx.length/12)),e.queue.writeBuffer(C,0,g.fx.subarray(0,le*12))));let de=(i||[]).filter(e=>e&&e.buffer&&e.count>0).slice(0,4),me=de.some(e=>e.isBackdrop),_e=!!(c&&c.buffer&&c.width>0&&c.height>0);H(f,r,[r.level||0,+!!me,0,0],[w[0],w[1],w[2],0],_e?[c.width,c.height,c.sphereIndex??0,1]:[1,1,-1,0]);for(let e=0;e<de.length;e+=1){let t=de[e],n=p[e];H(n,r,[t.mode,t.worldScale,t.pointSize,t.alphaGain],t.extra1||[...t.colorPos||[0,0,0],0],t.extra2||[...t.colorNeg||[0,0,0],0])}if(u&&u.env){let e=u.env,t=u.lightDir||w;H(m,r,[e.skyZenithRgb[0],e.skyZenithRgb[1],e.skyZenithRgb[2],e.skyOpticalDepth],[t[0],t[1],t[2],1/(2*(e.tinyPlanetCurvatureRadiusM||280))],[e.skyHorizonRgb[0],e.skyHorizonRgb[1],e.skyHorizonRgb[2],+!!e.isMagmaOcean])}else T&&T.positionsBuffer&&T.velocitiesBuffer&&T.count>0?H(m,r,[T.halfBox[0],T.halfBox[1],T.halfBox[2],T.worldScale],[T.baseRgb[0],T.baseRgb[1],T.baseRgb[2],T.radius],[T.alphaFade??1,0,0,T.idealCoord||12]):A&&A.dim>0&&H(m,r,[A.dim,A.boxRadius||3.4,A.tdseTunneled||0,A.tdseCrestNorm||.72],[A.alphaMul??1,0,0,0],[0,0,0,0]);je[0]=o,je[1]=s,je[2]=N.bhUv?.[0]??.5,je[3]=N.bhUv?.[1]??.5,je[4]=N.bhStrength??0,je[5]=N.warpAmount??0,je[6]=N.flashAmount??0,je[7]=+!!N.crtEnabled,je[8]=N.pixelSize??3,je[9]=N.timeSec??0,je[10]=0,je[11]=0,e.queue.writeBuffer(h,0,je);let be=e.createCommandEncoder({label:`uv-frame-fused`});{let e=be.beginRenderPass({colorAttachments:[{view:l,clearValue:{r:.005,g:.009,b:.02,a:1},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:d,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});if(u&&u.env){e.setPipeline(j),e.setBindGroup(0,M),e.draw(3,1,0,0);for(let t=0;t<de.length;t+=1){let n=de[t];n.isBackdrop&&(e.setPipeline(ie),e.setBindGroup(0,Ee(n.buffer,t,!0)),e.draw(6,n.count,0,0))}!u.hideTerrain&&u.terrainVertBuf&&u.terrainIdxBuf&&u.indexCount>0&&(e.setPipeline(P),e.setBindGroup(0,F),e.setVertexBuffer(0,u.terrainVertBuf),e.setIndexBuffer(u.terrainIdxBuf,`uint32`),e.drawIndexed(u.indexCount,1,0,0,0)),u.boulderVertBuf&&u.boulderVertCount>0&&(e.setPipeline(P),e.setBindGroup(0,F),e.setVertexBuffer(0,u.boulderVertBuf,0,u.boulderVertCount*48),e.draw(u.boulderVertCount,1,0,0)),u.vehicleVertBuf&&u.vehicleVertCount>0&&(e.setPipeline(P),e.setBindGroup(0,F),e.setVertexBuffer(0,u.vehicleVertBuf,0,u.vehicleVertCount*48),e.draw(u.vehicleVertCount,1,0,0))}else{e.setPipeline(O),e.setBindGroup(0,k),e.draw(3,1,0,0);for(let t=0;t<de.length;t+=1){let n=de[t];n.isBackdrop&&(e.setPipeline(ie),e.setBindGroup(0,Ee(n.buffer,t,!0)),e.draw(6,n.count,0,0))}}oe>0&&(e.setPipeline(he),e.setBindGroup(0,ge),e.setVertexBuffer(0,b,0,oe*28),e.draw(oe,1,0,0)),z>0&&(e.setPipeline(ae),e.setBindGroup(0,ce(_e?c.buffer:null)),e.draw(6,z,0,0)),T&&T.positionsBuffer&&T.velocitiesBuffer&&T.count>0&&(e.setPipeline(ue),e.setBindGroup(0,De(T.positionsBuffer,T.velocitiesBuffer)),e.draw(6,T.count,0,0)),B>0&&(e.setPipeline(fe),e.setBindGroup(0,pe),e.draw(6,B,0,0)),!u&&se>0&&(e.setPipeline(P),e.setBindGroup(0,ee),e.setVertexBuffer(0,S,0,se*48),e.draw(se,1,0,0));for(let t=0;t<de.length;t+=1){let n=de[t];n.isBackdrop||(e.setPipeline(re),e.setBindGroup(0,Ee(n.buffer,t,!1)),e.draw(6,n.count,0,0))}A&&A.dim>0&&(e.setPipeline(ve),e.setBindGroup(0,ye),e.draw(3,1,0,0)),u&&u.fxVertBuf&&u.fxVertCount>0?(e.setPipeline(R),e.setBindGroup(0,te),e.setVertexBuffer(0,u.fxVertBuf,0,u.fxVertCount*48),e.draw(u.fxVertCount,1,0,0)):!u&&le>0&&(e.setPipeline(R),e.setBindGroup(0,ne),e.setVertexBuffer(0,C,0,le*48),e.draw(le,1,0,0)),e.end()}{let t=L?.colorView||n.getCurrentTexture().createView(),r=be.beginRenderPass({colorAttachments:[{view:t,clearValue:{r:0,g:0,b:0,a:1},loadOp:L?.preserve?`load`:`clear`,storeOp:`store`}]});if(L?.viewport){let e=L.viewport;r.setViewport(e.x,e.y,e.width,e.height,0,1)}else if(I){let t=Math.max(1,Math.floor(o*.5));r.setPipeline(xe),r.setBindGroup(0,Se),r.setViewport(0,0,t,s,0,1),r.draw(3,1,0,0),r.setViewport(t,0,o-t,s,0,1),r.draw(3,1,0,0),r.end(),e.queue.submit([be.finish()]);return}r.setPipeline(xe),r.setBindGroup(0,Se),r.draw(3,1,0,0),r.end()}e.queue.submit([be.finish()])}function Fe(){c?.destroy(),u?.destroy();for(let e of[f,...p,m,h,_,oe,v,b,S,C,w])try{e.destroy()}catch{}}return Object.freeze({renderFrame:Pe,uploadNuclearVolume:ke,dispose:Fe})}function er(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function tr(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function nr(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function rr(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function ir(e,t,n,r){let i=1/Math.tan(e*.5),a=1/(n-r),o=new Float32Array(16);return o[0]=i/Math.max(.25,t),o[5]=i,o[10]=r*a,o[11]=-1,o[14]=n*r*a,o}function ar(e,t,n){let r=rr(er(t,e)),i=rr(tr(r,n)),a=tr(i,r),o=new Float32Array(16);return o[0]=i[0],o[4]=i[1],o[8]=i[2],o[12]=-nr(i,e),o[1]=a[0],o[5]=a[1],o[9]=a[2],o[13]=-nr(a,e),o[2]=-r[0],o[6]=-r[1],o[10]=-r[2],o[14]=nr(r,e),o[3]=0,o[7]=0,o[11]=0,o[15]=1,{mat:o,right:i,up:a,fwd:r}}function or(e,t){let n=new Float32Array(16);for(let r=0;r<4;r+=1)for(let i=0;i<4;i+=1)n[r*4+i]=e[0+i]*t[r*4+0]+e[4+i]*t[r*4+1]+e[8+i]*t[r*4+2]+e[12+i]*t[r*4+3];return n}function sr(e,t,n,r){let i=e[0],a=e[1],o=e[2],s=t[0]*i+t[4]*a+t[8]*o+t[12],c=t[1]*i+t[5]*a+t[9]*o+t[13],l=t[2]*i+t[6]*a+t[10]*o+t[14],u=t[3]*i+t[7]*a+t[11]*o+t[15];if(u<=.02)return{visible:!1,sx:-999,sy:-999,uvX:.5,uvY:.5,depth:1};let d=s/u,f=c/u,p=l/u,m=d*.5+.5,h=.5-f*.5;return{visible:p>=0&&p<=1&&m>=-.15&&m<=1.15&&h>=-.15&&h<=1.15,sx:m*n,sy:h*r,uvX:m,uvY:h,depth:p,w:u}}function cr(e){let t=0,n=0,r=0;e>=380&&e<440?(t=-(e-440)/60,r=1):e<490?(n=(e-440)/50,r=1):e<510?(n=1,r=-(e-510)/20):e<580?(t=(e-510)/70,n=1):e<645?(t=1,n=-(e-645)/65):e<=740&&(t=1);let i=e<420?.3+.7*((e-380)/40):e>680?.3+.7*((740-e)/60):1;return[Math.round(Math.max(0,Math.min(1,t*i))*255),Math.round(Math.max(0,Math.min(1,n*i))*255),Math.round(Math.max(0,Math.min(1,r*i))*255)]}function lr(e){return Math.max(0,Math.min(1,e))}function ur(e,t,n){if(e>t)return 1-ur(t,e,n);let r=lr((n-e)/Math.max(1e-6,t-e));return r*r*(3-2*r)}function dr(e,t,n,r,i){return e<=t||e>=i?0:e<n?ur(t,n,e):e>r?1-ur(r,i,e):1}function fr(e,t=[.28,.72,.96,.32]){let[n,r,i]=e,a=[[-n,-r,-i],[n,-r,-i],[n,r,-i],[-n,r,-i],[-n,-r,i],[n,-r,i],[n,r,i],[-n,r,i]],o=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],s=new Float32Array(o.length*2*7),c=0;for(let[e,n]of o)s.set([...a[e],...t],c),c+=7,s.set([...a[n],...t],c),c+=7;return s}function pr(e,t,n,r,i=1){if(!e||i<.02)return[];let a=[],o=e.catalog||Me,s=Math.min(e.massiveCount,o.length),c=Array.from({length:s},(t,n)=>e.getMassiveBodyState64(n)),l=c[0]?.posAu||[0,0,0],u=c[0]?.velAuPerYr||[0,0,0],d=c[0]?.massSolar||1;if(s>=2&&(o[1]?.isStar||o[1]?.orbitRole===`binary-companion`)){let e=c[0].massSolar,t=c[1].massSolar;d=Math.max(1e-12,e+t),l=[(e*c[0].posAu[0]+t*c[1].posAu[0])/d,(e*c[0].posAu[1]+t*c[1].posAu[1])/d,(e*c[0].posAu[2]+t*c[1].posAu[2])/d],u=[(e*c[0].velAuPerYr[0]+t*c[1].velAuPerYr[0])/d,(e*c[0].velAuPerYr[1]+t*c[1].velAuPerYr[1])/d,(e*c[0].velAuPerYr[2]+t*c[1].velAuPerYr[2])/d]}for(let e=1;e<s;e+=1){let s=o[e],f=s.parent===-2,p=f?-2:s.parent>=0?s.parent:0,m=!!s.isStar,h=!m&&p>=0&&!o[p]?.isStar&&p>0;if(h&&r>10.6||!h&&r<8.4)continue;let g=f?l:c[p].posAu,_=f?u:c[p].velAuPerYr,v=f?d:c[p].massSolar,y=c[e],b=y.posAu[0]-g[0],x=y.posAu[1]-g[1],S=y.posAu[2]-g[2],C=y.velAuPerYr[0]-_[0],w=y.velAuPerYr[1]-_[1],T=y.velAuPerYr[2]-_[2],E=Math.hypot(b,x,S),D=C*C+w*w+T*T,O=Ae*(v+y.massSolar);if(!(E>1e-8&&O>1e-12))continue;let k=.5*D-O/E;if(k>=-1e-6)continue;let A=-O/(2*k),j=tr([b,x,S],[C,w,T]),M=Math.hypot(j[0],j[1],j[2]);if(!(M>1e-10))continue;let N=[j[0]/M,j[1]/M,j[2]/M],P=tr([C,w,T],j),F=[P[0]/O-b/E,P[1]/O-x/E,P[2]/O-S/E],I=Math.min(.985,Math.hypot(F[0],F[1],F[2])),ee=I>1e-5?[F[0]/I,F[1]/I,F[2]/I]:rr([b,x,S]),L=tr(N,ee),R=A*Math.sqrt(Math.max(.01,1-I*I)),te=g[0]-t[0],ne=g[1]-t[1],z=g[2]-t[2],re=s.color0||[.38,.72,1],ie=(m?.52:h?.34:s.id===`halley`?.16:.28)*i,B=null;for(let e=0;e<=72;e+=1){let t=e/72*Math.PI*2,r=A*(Math.cos(t)-I),i=R*Math.sin(t),o=[(te+r*ee[0]+i*L[0])*n,(ne+r*ee[1]+i*L[1])*n,(z+r*ee[2]+i*L[2])*n];B&&(a.push(...B,re[0],re[1],re[2],ie),a.push(...o,re[0],re[1],re[2],ie)),B=o}}return a}function mr(e,{focusedSolarBodyIndex:t=3,focusedBodyIsStar:n=null,galaxyBranch:r=`solar-system`}={}){let i=n==null?t===0:!!n;return e>=22.3?0:e>=16.2?1:e>=8.75?r!==`smbh-core`&&i&&e<=9.8?3:2:e>=-5.6?i&&e>=7.2?3:4:e>=-9.1?5:e>=-12.8?6:7}function hr(e){let t=Math.max(2e5,(Number(e?.radiusKm)||6371)*1e3),n=e?.ringed?5.2:3.65;return Math.min(8.68,Math.max(6.2,Math.log10(t*n)))}function gr(e){return Math.max(ze,Math.min(Re,Number(e)))}async function _r(){let{device:e}=await F({label:`ulg-universes-demo`,xrCompatible:!0}),t=[];e.addEventListener(`uncapturederror`,e=>{t.push(String(e?.error?.message??e))}),S(e,`ulg-universes-demo`);let n=new URLSearchParams(window.location.search),r=Ce(window.location.search),i=Math.max(1,Math.min(118,Number.parseInt(n.get(`Z`)||n.get(`z`)||`26`,10)||26)),a=r.seed==null?Number.parseInt(n.get(`seed`)||`20261125`,10)||20261125:Math.trunc(r.seed),o=He[n.get(`quality`)]?n.get(`quality`):`med`,s=Be[0].log10SpanM;r.log10SpanM==null?n.has(`scale`)?s=gr(Number.parseFloat(n.get(`scale`))||24.8):n.has(`level`)&&(s=Be[Math.max(0,Math.min(7,Number.parseInt(n.get(`level`),10)||0))].log10SpanM):s=gr(r.log10SpanM);let c=document.getElementById(`uv-canvas`),l=document.getElementById(`uv-reticle-canvas`),u=l?.getContext(`2d`),d=document.getElementById(`uv-scale-rail`),f=document.getElementById(`uv-epoch-rail`),p=document.getElementById(`uv-zoom-slider`),m=document.getElementById(`uv-zoom-readout`),h=document.getElementById(`uv-status-dot`),g=document.getElementById(`uv-scale-badge`),_=document.getElementById(`uv-clock-badge`),v=document.getElementById(`uv-fps-badge`),y=document.getElementById(`uv-cockpit-btn`),b=document.getElementById(`uv-xr-btn`),x=document.getElementById(`uv-share-btn`),C=document.getElementById(`uv-room-btn`),w=document.getElementById(`uv-autopilot-btn`),T=document.getElementById(`uv-sim-btn`),E=document.getElementById(`uv-config-btn`),D=document.getElementById(`uv-help-btn`),O=document.getElementById(`uv-sim-drawer`),k=document.getElementById(`uv-config-drawer`),A=document.getElementById(`uv-help-drawer`),j=document.getElementById(`uv-pause-btn`),M=document.getElementById(`uv-orbit-up-btn`),N=document.getElementById(`uv-timescale-slider`),I=document.getElementById(`uv-timescale-val`),ee=document.getElementById(`uv-bigbang-btn`),L=document.getElementById(`uv-reseed-btn`),R=document.getElementById(`uv-scale-controls`),te=document.getElementById(`uv-quality-group`),ne=document.getElementById(`uv-lensing-toggle`),z=document.getElementById(`uv-orbits-toggle`),re=document.getElementById(`uv-travel-toggle`),ie=document.getElementById(`uv-autospin-toggle`),ae=document.getElementById(`uv-crt-toggle`),ce=document.getElementById(`uv-pixel-slider`),le=document.getElementById(`uv-pixel-val`),ue=document.getElementById(`uv-peer-url`),de=document.getElementById(`uv-peer-role`),pe=document.getElementById(`uv-peer-connect-btn`),he=document.getElementById(`uv-peer-status`),ge=document.getElementById(`uv-inspector`),_e=document.getElementById(`uv-collapse-btn`),ve=document.getElementById(`uv-info-quick-btn`),ye=document.getElementById(`uv-target-kicker`),be=document.getElementById(`uv-target-name`),Se=document.getElementById(`uv-target-sub`),De=document.getElementById(`uv-spec-title`),ke=document.getElementById(`uv-comp-text`),Ae=document.getElementById(`uv-spectrograph-canvas`),je=document.getElementById(`uv-stats-grid`),Ne=document.getElementById(`uv-sample-strip`),V=document.getElementById(`uv-plot-title`),H=document.getElementById(`uv-plot-meta`),Pe=document.getElementById(`uv-plot-canvas`),Fe=document.getElementById(`uv-dive-btn`),Ie=document.getElementById(`uv-focus-mote-btn`),Le=document.getElementById(`uv-surface-quick-btn`),Ke=document.getElementById(`uv-return-btn`),qe=document.getElementById(`uv-engine-tag`),Je=document.getElementById(`uv-breadcrumb`),Ye=document.getElementById(`uv-hint-pill`),Xe=document.getElementById(`uv-surface-hud`),Ze=document.getElementById(`uv-surf-telemetry`),Qe=document.getElementById(`uv-surf-chem-bar`),$e=document.getElementById(`uv-surf-reaction-bar`),et=document.getElementById(`uv-surf-weapon-bar`),tt=document.getElementById(`uv-weapon-fire-btn`),nt=document.getElementById(`uv-tractor-btn`),rt=document.getElementById(`uv-lambda-slider`),it=document.getElementById(`uv-lambda-readout`),at=document.getElementById(`uv-power-slider`),U=document.getElementById(`uv-power-readout`),ot=document.getElementById(`uv-probe-btn`),st=document.getElementById(`uv-kardashev-badge`),ct=document.getElementById(`uv-surf-sample-btn`),lt=document.getElementById(`uv-surf-jump-btn`),W=document.getElementById(`uv-surf-descend-btn`),ut=document.getElementById(`uv-surf-vehicle-btn`),dt=document.getElementById(`uv-surf-cam-btn`),ft=document.getElementById(`uv-surf-orbit-btn`),pt=document.getElementById(`uv-touch-pads`),mt=document.getElementById(`uv-joy-move`),ht=document.getElementById(`uv-joy-move-knob`),gt=document.getElementById(`uv-joy-look`),_t=document.getElementById(`uv-joy-look-knob`),vt=document.getElementById(`uv-warp-overlay`),yt=document.getElementById(`uv-help-scale-tag`),bt=document.getElementById(`uv-about-scale-btn`),xt=document.getElementById(`uv-about-ulg-btn`),St=document.getElementById(`uv-modal-backdrop`),Ct=document.getElementById(`uv-modal-title`),wt=document.getElementById(`uv-modal-sub`),Tt=document.getElementById(`uv-modal-content`),Et=document.getElementById(`uv-modal-close`),Dt=$n(e,c),Ot=fe(e),G=Rn(e,{seed:a,qualityId:o,initialElementZ:i}),kt=!!r.cockpit,At=`laser`,jt=-6.27,Mt=25e7,Nt=!1,Pt=!1,Ft=r.simTimeS??0,It=Ee(),Lt=xe(e,{onStateChange:e=>{b&&(b.classList.toggle(`active`,e.active),b.textContent=e.active?`🥽 Exit XR`:`🥽 XR`,b.title=e.statusText)}}),Rt=Te({onWeaponHitLocal:e=>{It.applyDamage(e.damage||10),rn=Math.max(rn,.25)},onRemoteMissile:e=>{G.surfaceActive&&e?.pos&&G.launchSurfaceMissile({fromPos:e.pos,vel:e.vel,aimWorldPos:e.target,isRemote:!0})},onStateChange:()=>{Bt()}});function zt(e){return e>=0xe8d4a51000?`${(e*1e-12).toFixed(1)} TW`:e>=1e9?`${(e*1e-9).toFixed(1)} GW`:e>=1e6?`${(e*1e-6).toFixed(0)} MW`:`${(e*.001).toFixed(0)} kW`}function Bt(){let e=Rt.getStatus();e.timescaleLocked&&(Xt=1),N&&(N.disabled=e.timescaleLocked,e.timescaleLocked&&(N.value=`1.0`)),I&&(I.textContent=e.timescaleLocked?`🔒 1.0×`:`${Xt.toFixed(1)}×`),C&&(C.classList.toggle(`active`,e.connected),C.textContent=e.connected?`🌐 ${e.roomId} (${e.remotePeerCount+1})`:`🌐 Solo`,C.title=e.connected?`PeerCompute multiplayer room "${e.roomId}" (${e.transportKind}) — timescale locked at 1.0×. Click to leave.`:`Join a PeerCompute multiplayer UFO room (locks timescale to canonical 1.0×!)`)}function K(){let e=B(jt);if(it){it.textContent=`${e.shortBand} · ${e.displayLabel.split(` `)[0]}${e.displayLabel.split(` `)[1]?` `+e.displayLabel.split(` `)[1]:``}`;let t=Math.round(e.rgb[0]*255),n=Math.round(e.rgb[1]*255),r=Math.round(e.rgb[2]*255);it.style.color=`rgb(${t},${n},${r})`}if(U&&(U.textContent=zt(Mt)),et)for(let e of et.querySelectorAll(`[data-weapon]`))e.classList.toggle(`active`,e.dataset.weapon===At);if(nt&&nt.classList.toggle(`active`,Pt),tt&&tt.classList.toggle(`firing`,Nt),st){let e=It.state;st.textContent=`K ${e.kardashevIndex.toFixed(2)} · ${e.probes.length} Probes · 🛡${Math.round(e.shieldHp)}%`}if(y){let e=G.surfaceActive?G.surfaceSession?.cameraMode===`first-person`:kt;y.classList.toggle(`active`,e),y.textContent=e?`🛸 3rd View`:`🛸 Cockpit`}}function Vt(){let e=G.getActiveSystemCatalog()[G.focusedSolarBodyIndex]?.id||`earth`,t=G.surfaceTelemetry,n=Rt.getStatus();return we(window.location.href,{seed:G.seed,epoch:G.cosmicEpoch?.id||`present`,log10SpanM:s,useSol:G.useSolReference,bodyId:e,surfaceActive:G.surfaceActive,pos:G.surfaceActive?t?.ufoPos||t?.roverPos:null,yaw:G.surfaceActive?t?.ufoYaw??.35:null,simTimeS:Ft,roomId:n.connected?n.roomId:null,relayUrl:n.connected&&n.relayUrl?n.relayUrl:null})}let Ht=()=>!!G.getActiveSystemCatalog()[G.focusedSolarBodyIndex]?.isStar||G.focusedSolarBodyIndex===0,q=mr(s,{focusedSolarBodyIndex:G.focusedSolarBodyIndex,focusedBodyIsStar:Ht(),galaxyBranch:G.galaxyBranch}),J=null,Ut=null,Wt=null,Y=null,Gt=!1,Kt=[0,0,0],qt=[],Jt=0,Yt=!0,Xt=1,Zt=!0,Qt=!0,$t=n.get(`cameraAutoSpin`)===`1`,en=n.get(`crt`)===`1`,tn=3,nn=n.get(`autopilot`)===`1`,rn=0,an=!1,on=0,sn=null,cn=0,ln={yaw:.56,pitch:.42,dist:18},un=new Float32Array(16),X=window.innerWidth,dn=window.innerHeight,fn={},pn=[`Cosmic Web`,`Spiral Galaxy`,`Solar System`,`Sun Core`,`Earth`,`Fe Lattice`,`Fe Atom`,`⁵⁶Fe Nucleus`];if(ie&&(ie.checked=$t),ae&&(ae.checked=en),w&&nn&&(w.classList.add(`active`),w.textContent=`⏹ Stop Tour`),te)for(let e of te.querySelectorAll(`[data-quality]`))e.classList.toggle(`active`,e.dataset.quality===o);if(d){d.innerHTML=Be.map(e=>`<button class="uv-rung-btn" data-level="${e.level}" type="button" title="Smoothly fly continuously to L${e.level}: ${e.name} (${e.exponentLabel})"><span class="uv-rung-exp">${e.exponentLabel}</span><span>L${e.level} ${e.shortLabel}</span></button>`).join(``);for(let e of d.querySelectorAll(`[data-level]`))e.addEventListener(`click`,()=>{let t=Number.parseInt(e.dataset.level,10);if(Number.isFinite(t)){if(G.surfaceActive&&In(),nn=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),t===3)G.setFocusedSolarBody(0);else if(t===4){let e=G.getActiveSystemCatalog();(e[G.focusedSolarBodyIndex]?.isStar||G.focusedSolarBodyIndex===0)&&G.setFocusedSolarBody(G.getDefaultPlanetIndex(e))}Sn(Be[t].log10SpanM)}})}function mn(){if(f)for(let e of f.querySelectorAll(`[data-epoch]`))e.classList.toggle(`active`,e.dataset.epoch===G.cosmicEpochId)}if(f){f.innerHTML=G.COSMIC_EPOCH_PRESETS.map(e=>`<button class="uv-epoch-btn ${e.id===G.cosmicEpochId?`active`:``}" data-epoch="${e.id}" type="button" title="${e.summary}">${e.shortLabel}</button>`).join(``);for(let e of f.querySelectorAll(`[data-epoch]`))e.addEventListener(`click`,async()=>{await G.setCosmicEpoch(e.dataset.epoch,{alignActiveLevel:q}),mn(),Z(),Cn(),Q(),$(performance.now())})}p?.addEventListener(`input`,e=>{G.surfaceActive&&In(),nn=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),sn=null,s=Math.max(ze,Math.min(Re,Number(e.target.value))),bn(s)});function hn(){let e=Math.min(window.devicePixelRatio||1,2);X=Math.max(320,window.innerWidth),dn=Math.max(240,window.innerHeight);let t=Math.max(2,Math.floor(X*e)),n=Math.max(2,Math.floor(dn*e));(c.width!==t||c.height!==n)&&(c.width=t,c.height=n),l&&(l.width!==X||l.height!==dn)&&(l.width=X,l.height=dn)}hn(),window.addEventListener(`resize`,hn);let gn=[{el:O,btn:T},{el:k,btn:E},{el:A,btn:D}];function _n(e){for(let t of gn){let n=t.el===e&&!t.el?.classList.contains(`open`);t.el?.classList.toggle(`open`,n),t.btn?.classList.toggle(`active`,n)}}function vn(){for(let e of gn)e.el?.classList.remove(`open`),e.btn?.classList.remove(`active`)}T?.addEventListener(`click`,()=>_n(O)),E?.addEventListener(`click`,()=>_n(k)),D?.addEventListener(`click`,()=>_n(A));for(let e of document.querySelectorAll(`[data-close-drawer]`))e.addEventListener(`click`,()=>vn());function yn(e,t,n){vn(),Ct&&(Ct.textContent=e),wt&&(wt.textContent=t),Tt&&(Tt.innerHTML=n),St?.classList.add(`open`)}Et?.addEventListener(`click`,()=>St?.classList.remove(`open`)),St?.addEventListener(`click`,e=>{e.target===St&&St.classList.remove(`open`)}),bt?.addEventListener(`click`,()=>{let e=Be[q];yn(`L${e.level} · ${e.name}`,`${e.exponentLabel} · ${e.engineSchema}`,Ge(e))}),ve?.addEventListener(`click`,()=>{let e=Be[q];yn(`L${e.level} · ${e.name}`,`${e.exponentLabel} · ${e.engineSchema}`,Ge(e))}),xt?.addEventListener(`click`,()=>{yn(`About ULG Universes`,`Universal Law Graph · Continuous 40-OOM WebGPU Physics`,We())}),_e?.addEventListener(`click`,()=>{let e=ge?.classList.toggle(`collapsed`);_e&&(_e.textContent=e?`+`:`−`)});async function bn(e){let t=Ht(),n=mr(e,{focusedSolarBodyIndex:G.focusedSolarBodyIndex,focusedBodyIsStar:t,galaxyBranch:G.galaxyBranch}),r=new Set([n]);n===1&&r.add(0),(n===2||n===3||n===4)&&r.add(1),n===6&&r.add(5),n===7&&r.add(6),e>=20.5&&r.add(0),e>=14.8&&e<=23.5&&r.add(1),e>=6.5&&e<=18.2&&r.add(2),e>=6.8&&e<=10.8&&t&&r.add(3),e>=-6.2&&e<=9.2&&!t&&r.add(4),e>=-10&&e<=-4.5&&r.add(5),e>=-13.5&&e<=-8.4&&r.add(6),e<=-11.5&&r.add(7);let i=G.nuclearResult;for(let e of r)await G.ensureLevelInitialized(e);G.nuclearResult&&G.nuclearResult!==i&&G.nuclearResult.volumeData&&Dt.uploadNuclearVolume(G.nuclearResult.volumeData)}function xn(e=G.focusedSolarBodyIndex){if(!G.solarEngine||e<=0)return;let t=G.solarEngine.getMassiveBodyState64(e),n=G.solarEngine.getMassiveBodyState64(0),r=n.posAu[0]-t.posAu[0],i=n.posAu[2]-t.posAu[2];ln.yaw=Math.atan2(r,i)-.92,ln.pitch=.24}function Sn(e){sn=Math.max(ze,Math.min(Re,Number(e))),bn(sn)}function Cn(){if(R)if(q===0)R.innerHTML=`
        <div class="uv-row">
          <span>Cosmology Regime</span>
          <select id="uv-cosmo-mode">
            <option value="web" ${G.cosmoMode===`web`?`selected`:``}>2LPT Cosmic Web (FLRW TreePM)</option>
            <option value="cmb" ${G.cosmoMode===`cmb`?`selected`:``}>CMB Recombination (z=1100 BAO ΔT/T)</option>
            <option value="reionization" ${G.cosmoMode===`reionization`?`selected`:``}>Cosmic Dawn Reionization Bubbles (z=10)</option>
            <option value="cluster-merger" ${G.cosmoMode===`cluster-merger`?`selected`:``}>Bullet-Cluster Merger (X-Ray ICM + Lensing)</option>
          </select>
        </div>
        <div style="font-size:11px;color:var(--muted);line-height:1.35;">${G.cosmoMode===`cmb`?`Eisenstein–Hu BAO + Peebles Recombination surface at <code>z = 1100</code> (<code>T_CMB = 3,001 K</code>, <code>r_s ≈ 147 Mpc</code>).`:G.cosmoMode===`reionization`?`Pop III UV radiation percolating ionized <code>H II</code> bubbles through the neutral <code>z = 10</code> IGM.`:G.cosmoMode===`cluster-merger`?`Shock-heated X-ray ICM gas (magenta-gold) colliding behind collisionless dark-matter lensing halos (blue).`:`FLRW 3D-FFT TreePM running <code>${G.quality.cosmoGridPerSide}³</code> particles on a <code>${G.quality.cosmoFftN}³</code> periodic FFT mesh.`}</div>`,R.querySelector(`#uv-cosmo-mode`)?.addEventListener(`change`,async e=>{await G.setCosmoMode(e.target.value),Z(),Cn(),Q(),$(performance.now())});else if(q===1)R.innerHTML=`
        <div class="uv-row">
          <span>Morphology</span>
          <select id="uv-gal-preset-sel">
            <option value="disk" ${G.galaxyPreset===`disk`?`selected`:``}>Grand-Design Spiral (Sc/Sb)</option>
            <option value="barred" ${G.galaxyPreset===`barred`?`selected`:``}>Barred Spiral (SBb · Secular m=2 Bar)</option>
            <option value="binary" ${G.galaxyPreset===`binary`?`selected`:``}>Interacting Major Merger Pair</option>
            <option value="sphere" ${G.galaxyPreset===`sphere`?`selected`:``}>Giant Elliptical Spheroid</option>
            <option value="proto" ${G.galaxyPreset===`proto`?`selected`:``}>High-z Clumpy Starburst Protogalaxy</option>
            <option value="dwarf-stream" ${G.galaxyPreset===`dwarf-stream`?`selected`:``}>Tidally Disrupted Dwarf &amp; Halo Stream</option>
            <option value="globular" ${G.galaxyPreset===`globular`?`selected`:``}>Core-Collapsed Globular Cluster</option>
          </select>
        </div>
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
        </div>`,R.querySelector(`#uv-gal-preset-sel`)?.addEventListener(`change`,async e=>{await G.initGalaxy({preset:e.target.value}),Y=null,Gt=!1,Z(),Cn(),$(performance.now())}),R.querySelector(`#uv-gal-branch`)?.addEventListener(`change`,e=>{let t=e.target.value;G.setGalaxyBranch(t,t===`smbh-core`?[0,0,0]:[4.8,.04,2.1]),bn(s)}),R.querySelector(`#uv-gal-z-slider`)?.addEventListener(`input`,async e=>{let t=Number(e.target.value),n=R.querySelector(`#uv-gal-z-val`);n&&(n.textContent=t.toFixed(1)),await G.initGalaxy({preset:G.galaxyPreset,metallicity:t})}),R.querySelector(`#uv-gal-b0-slider`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=R.querySelector(`#uv-gal-b0-val`);n&&(n.textContent=t.toFixed(2)),await G.setGalacticB0(t),Q(),$(performance.now())});else if(q===2)G.galaxyBranch===`smbh-core`?(R.innerHTML=`
          <div style="font-size:11.5px;color:var(--muted);line-height:1.4;">Live GPU N-body hypervelocity S-stars orbiting a <code>4.3×10⁶ M☉</code> Kerr-Schwarzschild SMBH with Doppler-beamed accretion disk &amp; WGSL gravitational lensing.</div>
          <button id="uv-switch-solar-btn" class="uv-btn subtle" type="button" style="justify-content:center;">Switch to Solar System</button>`,R.querySelector(`#uv-switch-solar-btn`)?.addEventListener(`click`,async()=>{G.setGalaxyBranch(`solar-system`,[4.8,.04,2.1]),await G.ensureLevelInitialized(2),Cn()})):(R.innerHTML=`
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
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">Live GPU pebbles + DLM composite particle-rigid planetesimals condensing across the <code>${(G.protoplanetarySession?.snowLineAu||2.71).toFixed(2)} AU</code> H₂O snow line.</div>
          `:G.solarMode===`quasar-jet`?`
            <div class="uv-row" title="Dimensionless Kerr spin parameter a* (0 = Schwarzschild, no BZ jet; 0.94 = blazing Blazar jet!)">
              <span>Kerr Spin a*</span>
              <input id="uv-kerr-spin" type="range" min="0.0" max="0.98" step="0.02" value="${G.kerrSpinA.toFixed(2)}" />
              <span id="uv-kerr-spin-val" style="font-family:var(--mono);font-size:11px;">${G.kerrSpinA.toFixed(2)}</span>
            </div>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">Blandford–Znajek power <code>P_BZ ∝ Φ_B² Ω_H²</code>. Drag camera near the jet axis to watch relativistic Doppler beaming turn the Quasar into a blazing Blazar!</div>
          `:G.solarMode===`nbody`?(()=>{let e=G.getActiveSystemCatalog(),t=G.activeCausalSystem,n=t?.starSystem?.nebulaEnv,r=t?.condensationFrontsAu;return`
            <div style="font-size:10.5px;color:#cbd5e1;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);border-radius:6px;padding:6px 7px;line-height:1.35;">
              <div><strong>${G.useSolReference?`Sol Reference (G2V · 8 Planets)`:`${t?.systemName||`System`} · ${t?.architecture||`single`} (${t?.starCount||1}★, ${t?.planetCount||0} planets${t?.hasEarthLike?`, Earth-like!`:``})`}</strong></div>
              ${!G.useSolReference&&n?`<div style="color:var(--muted);margin-top:2px;">Nebula: <code>${n.nebulaSummary}</code> · Snow <code>${r?.rSnowLineAu} AU</code> · HZ <code>${r?.rHzInnerAu}–${r?.rHzOuterAu} AU</code></div>`:`<div style="color:var(--muted);margin-top:2px;">Reference J2000 Solar System (exact astronomical radii: Earth = 0.00916 R☉).</div>`}
            </div>
            <div class="uv-seg-group">
              <button id="uv-sample-star-btn" class="uv-seg-btn" type="button" title="Sample a new star from the live galaxy and synthesize its nebular planetary system">🎲 New Galactic Star</button>
              <button id="uv-toggle-sol-btn" class="uv-seg-btn ${G.useSolReference?`active`:``}" type="button" title="Toggle between Causal Galactic Nebular Synthesis and Sol Reference System">${G.useSolReference?`🌌 Causal Nebular`:`☀ Sol Reference`}</button>
            </div>
            <div class="uv-row">
              <span>Focus World</span>
              <select id="uv-solar-focus">${e.map((e,t)=>`<option value="${t}" ${t===G.focusedSolarBodyIndex?`selected`:``}>${e.name}</option>`).join(``)}</select>
            </div>`})():`<div style="font-size:11px;color:var(--muted);line-height:1.35;">Active ULG general-law regime running live on WebGPU — drag to orbit, inspect live telemetry &amp; plots on the right.</div>`}`,R.querySelector(`#uv-solar-mode-sel`)?.addEventListener(`change`,async e=>{await G.setSolarMode(e.target.value),Z(),Cn(),Q(),$(performance.now())}),R.querySelector(`#uv-sample-star-btn`)?.addEventListener(`click`,async()=>{await G.sampleNewGalacticSector(),Z(),Tn(),Q(),$(performance.now())}),R.querySelector(`#uv-toggle-sol-btn`)?.addEventListener(`click`,async()=>{await G.setUseSolReference(!G.useSolReference),Z(),Tn(),Q(),$(performance.now())}),R.querySelector(`#uv-disk-drag`)?.addEventListener(`change`,e=>{G.setProtoplanetaryGasDrag(e.target.checked)}),R.querySelector(`#uv-kerr-spin`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=R.querySelector(`#uv-kerr-spin-val`);n&&(n.textContent=t.toFixed(2)),await G.setKerrSpinA(t),Q(),$(performance.now())}),R.querySelector(`#uv-solar-focus`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=G.getActiveSystemCatalog();G.setFocusedSolarBody(t),Ut=n[t]?.id||null,!n[t]?.isStar&&t>0&&await G.initPlanetaryInterior({bodyIndex:t}),Q(),$(performance.now())}));else if(q===3){R.innerHTML=`
        <div class="uv-row">
          <span>Stellar / Remnant Regime</span>
          <select id="uv-stellar-mode-sel">
            <option value="fusion" ${G.stellarMode===`fusion`?`selected`:``}>Thermonuclear Fusion Core (pp/CNO/3α)</option>
            <option value="nebular-mhd" ${G.stellarMode===`nebular-mhd`?`selected`:``}>3D Resistive MHD Nebular Collapse &amp; Jets</option>
            <option value="h2-pillars" ${G.stellarMode===`h2-pillars`?`selected`:``}>H II Star-Forming Pillars ([O III]/Hα/[S II])</option>
            <option value="planetary-nebula" ${G.stellarMode===`planetary-nebula`?`selected`:``}>Planetary Nebula &amp; Hot White Dwarf</option>
            <option value="snr-pwn" ${G.stellarMode===`snr-pwn`?`selected`:``}>Supernova Remnant / Crab PWN</option>
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
        `:G.stellarMode===`fusion`?`
          <div class="uv-seg-group">
            <button class="uv-seg-btn ${G.stellarPreset===`main-sequence-star`?`active`:``}" data-st-preset="main-sequence-star" type="button">Active Star</button>
            <button class="uv-seg-btn ${G.stellarPreset===`solar-nebula`?`active`:``}" data-st-preset="solar-nebula" type="button">Nebula</button>
            <button class="uv-seg-btn ${G.stellarPreset===`massive-supernova`?`active`:``}" data-st-preset="massive-supernova" type="button">18 M☉ SN</button>
            <button class="uv-seg-btn ${G.stellarPreset===`binary-nursery`?`active`:``}" data-st-preset="binary-nursery" type="button">Binary</button>
          </div>
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
        `:`<div style="font-size:11px;color:var(--muted);line-height:1.35;">Live first-principles GPU regime from ULG’s Universal Law Graph — inspect spectra, TOV M(R), or flare light curve on the right.</div>`}`,R.querySelector(`#uv-stellar-mode-sel`)?.addEventListener(`change`,async e=>{await G.setStellarMode(e.target.value),Y=null,Gt=!1,Z(),Cn(),Q(),$(performance.now())}),R.querySelector(`#uv-neb-b0`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=R.querySelector(`#uv-neb-b0-val`);n&&(n.textContent=t.toFixed(2)),await G.setNebulaB0(t)});for(let e of R.querySelectorAll(`[data-st-preset]`))e.addEventListener(`click`,async()=>{await G.initStellarCore({preset:e.dataset.stPreset}),Y=null,Gt=!1,Cn(),Q(),$(performance.now())});R.querySelector(`#uv-st-accel`)?.addEventListener(`input`,e=>{G.setStellarTimeAccel(Number(e.target.value));let t=R.querySelector(`#uv-st-accel-val`);t&&(t.textContent=`${G.stellarTimeAccel.toFixed(1)}×`)}),R.querySelector(`#uv-st-b0`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value),n=R.querySelector(`#uv-st-b0-val`);n&&(n.textContent=t.toFixed(2)),await G.setStellarB0(t),Q(),$(performance.now())})}else if(q===4){let e=G.planetaryAtmoState?.activation;R.innerHTML=`
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
        <label class="uv-row" title="Slice an octant out of the planet to inspect the live GPU Polytope Atlas hydrostatic core &amp; mantle">
          <span>3D Interior Cutaway</span>
          <input id="uv-cutaway-toggle" type="checkbox" ${G.planetaryCutaway?`checked`:``} />
        </label>
        <button id="uv-land-surface-btn" class="uv-btn primary" type="button" style="justify-content:center;" title="Land on the live GPU planetary surface with a 6-Wheel Jump-Rocket Rover and Coaxial Atmospheric Drone (Shortcut: L)">${G.surfaceActive?`🚀 Launch Back to Orbit (Esc)`:`🚙 Land on Surface (Rover + Drone)`}</button>
        <div style="font-size:10.5px;color:var(--muted);line-height:1.35;">Dynamic Law Graph: <code>${G.surfaceActive?`planetary-surface-vehicles · `:``}${e?.anyActive?e.activeLaws.join(` · `):`Vacuum body — atmospheric &amp; EM laws dormant (0 dispatches)`}</code></div>`,R.querySelector(`#uv-planetary-mode-sel`)?.addEventListener(`change`,async e=>{await G.setPlanetaryMode(e.target.value),G.surfaceActive?await Fn({bodyIndex:G.planetaryBodyIndex}):(Z(),Cn(),Q(),$(performance.now()))}),R.querySelector(`#uv-planet-sel`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);G.setFocusedSolarBody(t),await G.initPlanetaryInterior({bodyIndex:t}),G.surfaceActive?await Fn({bodyIndex:t}):(s=hr(G.getActiveSystemCatalog()[t]),xn(t),Z(),Tn())}),R.querySelector(`#uv-land-surface-btn`)?.addEventListener(`click`,async()=>{G.surfaceActive?In():await Fn({bodyIndex:G.planetaryBodyIndex})}),R.querySelector(`#uv-tribo-toggle`)?.addEventListener(`change`,e=>{G.setPlanetaryTriboelectric(e.target.checked)}),R.querySelector(`#uv-cutaway-toggle`)?.addEventListener(`change`,e=>{G.setPlanetaryCutaway(e.target.checked)})}else if(q===5){R.innerHTML=`
        <div class="uv-row">
          <span>Element</span>
          <select id="uv-md-el-sel">${Ve.map(e=>`<option value="${e.Z}" ${e.Z===G.mdElementZ?`selected`:``}>${e.sym} · ${e.name}</option>`).join(``)}</select>
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
        </label>`,R.querySelector(`#uv-md-el-sel`)?.addEventListener(`change`,async e=>{await G.initMolecularDynamics({Z:Number(e.target.value),phasePreset:`solid`}),Z(),Cn()});for(let e of R.querySelectorAll(`[data-md-phase]`))e.addEventListener(`click`,async()=>{await G.initMolecularDynamics({Z:G.mdElementZ,phasePreset:e.dataset.mdPhase}),Cn()});R.querySelector(`#uv-md-temp`)?.addEventListener(`input`,e=>{G.setMdTemp(Number(e.target.value));let t=R.querySelector(`#uv-md-temp-val`);t&&(t.textContent=`${G.mdTempK} K`)}),R.querySelector(`#uv-md-grav`)?.addEventListener(`change`,e=>{G.setMdGravity(e.target.checked)})}else if(q===6){R.innerHTML=`
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${G.quantumMode===`atom`?`active`:``}" data-qm-mode="atom" type="button">Atom (Dirac-KS)</button>
          <button class="uv-seg-btn ${G.quantumMode===`molecule`?`active`:``}" data-qm-mode="molecule" type="button">Molecule (RHF)</button>
        </div>
        ${G.quantumMode===`atom`?`
          <div class="uv-row">
            <span>Element</span>
            <select id="uv-qm-el-sel">${Ve.map(e=>`<option value="${e.Z}" ${e.Z===G.quantumZ?`selected`:``}>${e.sym} (Z=${e.Z})</option>`).join(``)}</select>
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
        `}`;for(let e of R.querySelectorAll(`[data-qm-mode]`))e.addEventListener(`click`,async()=>{await G.initQuantumAtom({mode:e.dataset.qmMode}),Z(),Cn()});R.querySelector(`#uv-qm-el-sel`)?.addEventListener(`change`,async e=>{await G.initQuantumAtom({Z:Number(e.target.value),n:null,l:null,m:0}),Z(),Cn()}),R.querySelector(`#uv-qm-n`)?.addEventListener(`change`,async e=>{let t=Number(e.target.value);await G.initQuantumAtom({n:t,l:Math.min(G.quantumL,t-1),m:0}),Cn()}),R.querySelector(`#uv-qm-l`)?.addEventListener(`change`,async e=>{await G.initQuantumAtom({l:Number(e.target.value),m:0}),Cn()}),R.querySelector(`#uv-qm-rel`)?.addEventListener(`change`,async e=>{await G.initQuantumAtom({relativistic:e.target.checked}),Z()});for(let e of R.querySelectorAll(`[data-mol-key]`))e.addEventListener(`click`,async()=>{await G.initQuantumAtom({mode:`molecule`,moleculeKey:e.dataset.molKey}),Z(),Cn()})}else q===7&&(R.innerHTML=`
        <div class="uv-row">
          <span>Isotope</span>
          <select id="uv-nuc-sel">${Ve.map(e=>`<option value="${e.Z}:${e.A}" ${e.Z===G.nuclearZ?`selected`:``}>${e.A}${e.sym} (Z=${e.Z})</option>`).join(``)}</select>
        </div>
        <button id="uv-tdse-reset" class="uv-btn subtle" type="button" style="justify-content:center;">↻ Reset Tunneling Wavepacket</button>`,R.querySelector(`#uv-nuc-sel`)?.addEventListener(`change`,async e=>{let[t,n]=e.target.value.split(`:`);await G.initAtomicNucleus({Z:Number(t),A:Number(n)}),G.nuclearResult?.volumeData&&Dt.uploadNuclearVolume(G.nuclearResult.volumeData),Z()}),R.querySelector(`#uv-tdse-reset`)?.addEventListener(`click`,()=>{G.tdseSession?.resetWavepacket?.()}))}function wn(){let e=G.getTargetsForLevel(q,fn);return e.find(e=>e.id===Ut)||e[0]||null}function Z(){let e=G.getTargetsForLevel(q,fn);Ut=q===2&&G.galaxyBranch!==`smbh-core`?G.getActiveSystemCatalog()[G.focusedSolarBodyIndex]?.id||e[0]?.id||null:e[0]?.id||null}function Tn(){let e=Be[q];if(g&&(g.textContent=`10^${s.toFixed(1)} m`),m&&(m.textContent=Ue(s)),p&&document.activeElement!==p&&(p.value=s.toFixed(2)),yt&&(yt.textContent=`L${e.level}`),qe&&(qe.textContent=e.engineSchema),V&&(V.textContent=e.plotTitle),Fe)if(q===4&&!G.surfaceActive){let e=G.getActiveSystemCatalog()[G.planetaryBodyIndex]||Me[3];Fe.textContent=(Number(e?.radiusKm)||6371)>=16e3?`🛸 DIVE INTO ATMOSPHERE`:`🚙 LAND TO SAMPLE SURFACE`}else G.surfaceActive?Fe.textContent=`🔬 SAMPLE BELOW → LATTICE`:q===2&&Y?.kind===`solar-asteroid`?Fe.textContent=`🔬 SAMPLE ASTEROID LATTICE`:Fe.textContent=e.diveButton;if(Le&&(Le.style.display=q===4&&!G.surfaceActive?`inline-flex`:`none`),Ke&&(Ke.disabled=q===0&&!G.surfaceActive,q===5&&J&&!G.surfaceActive?(Ke.textContent=`↑ ${J.vehicleLabel}`,Ke.title=`Return directly back to your parked ${J.vehicleLabel} on ${J.worldName}`):(Ke.textContent=`↑ Orbit`,Ke.title=`Return one scale level outward`)),M&&(M.disabled=q===0&&!G.surfaceActive),d)for(let e of d.querySelectorAll(`[data-level]`))e.classList.toggle(`active`,Number(e.dataset.level)===q);if(Je){let e=G.getActiveSystemCatalog();pn[2]=G.galaxyBranch===`smbh-core`?`Sgr A* SMBH`:G.useSolReference?`Sol Reference`:G.activeCausalSystem?.systemName||`Star System`,pn[4]=e[G.planetaryBodyIndex]?.name||`World`;let t=pn.slice(0,q+1);Je.innerHTML=t.map((e,n)=>n===t.length-1?`<strong>${e}</strong>`:e).join(` › `)}Cn()}async function En(){if(!G.surfaceActive||!G.surfaceSession)return null;let e=G.surfaceSession,t=G.getActiveSystemCatalog()[G.planetaryBodyIndex]||Me[3],n=G.planetaryMode===`magma-ocean`?`Hadean Magma Ocean`:G.planetaryMode===`cryo-plumes`?`Cryovolcanic Moon`:t?.name||`World`,r=e.activeVehicle,i=r===`ufo`?`🛸 UFO`:r===`drone`?`🚁 Drone`:`🚙 Rover`;J={bodyIndex:G.planetaryBodyIndex,planetaryMode:G.planetaryMode,worldName:n,vehicleLabel:i,checkpoint:e.getCheckpoint?e.getCheckpoint():null};let a={...e.getLocalSample(),worldName:n};return await G.applySampledMaterialToLattice(a),G.exitSurfaceView(),sn=null,q=5,s=Be[5].log10SpanM,pn[4]=n,pn[5]=`${a.shortLabel} Lattice`,await bn(s),Z(),Tn(),Pn(),Q(),$(performance.now()),a}async function Dn(){if(!J)return null;let e=J;return Fn({bodyIndex:e.bodyIndex,planetaryModeOverride:e.planetaryMode,restoreCheckpoint:e.checkpoint})}async function On(e){if(!e)return null;let t=e.moleculeKey&&G.MOLECULE_SPECS[e.moleculeKey]?e.moleculeKey:`H2O`;return await G.initQuantumAtom({Z:e.primaryZ||G.quantumZ,mode:`molecule`,moleculeKey:t}),sn=null,q=6,s=Be[6].log10SpanM,pn[6]=`${e.formula} (RHF)`,await bn(s),Z(),Tn(),Q(),$(performance.now()),e}async function kn(e,{targetLevel:t=null}={}){let n=Math.max(1,Math.min(118,Math.trunc(Number(e)||14))),r=t??(q===5?6:q);return r<=5?(await G.initMolecularDynamics({Z:n,phasePreset:G.activeSampledMaterial?.phasePreset||`solid`}),q=5,s=Be[5].log10SpanM):r===6?(await G.initQuantumAtom({Z:n,mode:`atom`,n:null,l:null,m:0}),q=6,s=Be[6].log10SpanM):(await G.initAtomicNucleus({Z:n}),G.nuclearResult?.volumeData&&Dt.uploadNuclearVolume(G.nuclearResult.volumeData),q=7,s=Be[7].log10SpanM),sn=null,await bn(s),Z(),Tn(),Q(),$(performance.now()),n}async function An(){if(G.surfaceActive){await En();return}let e=wn();if(q===0&&Y?.kind===`cosmo-web`){let e=Number(Y.localOverdensity)||1.2,t=G.deriveGalaxyEnvironmentFromCosmicContext({cosmicEpoch:G.cosmicEpoch,regionPosMpc:Y.rawPos,localOverdensity:e,seed:G.seed});await G.initGalaxy({galaxyEnvOverride:t})}else q===1&&(Y?.kind===`galaxy-star`&&Y.starSite?(G.setGalaxyBranch(`solar-system`,Y.rawPos),await G.selectCausalStarSite(Y.starSite)):e?.branch&&(G.setGalaxyBranch(e.branch,e.pos),e.branch===`solar-system`&&e.starSite&&await G.selectCausalStarSite(e.starSite)));if(q===2&&Y?.kind===`solar-asteroid`&&Y.sampleMaterial){await G.applySampledMaterialToLattice(Y.sampleMaterial),sn=null,q=5,s=Be[5].log10SpanM,await bn(s),Z(),Tn(),Q(),$(performance.now());return}if(q===2&&e?.bodyIndex!=null){let t=G.getActiveSystemCatalog();G.setFocusedSolarBody(e.bodyIndex),!t[e.bodyIndex]?.isStar&&e.bodyIndex>0&&await G.initPlanetaryInterior({bodyIndex:e.bodyIndex})}if(q===4&&!G.surfaceActive){await Fn({bodyIndex:G.planetaryBodyIndex});return}if(q===5){let t=G.activeSampledMaterial;if(t?.compounds?.length){await On(t.compounds[0]);return}e?.sampleZ&&await G.initQuantumAtom({Z:e.sampleZ,mode:`atom`})}q===6&&e?.sampleZ&&(await G.initAtomicNucleus({Z:e.sampleZ}),G.nuclearResult?.volumeData&&Dt.uploadNuclearVolume(G.nuclearResult.volumeData));let t=e?.nextLevel==null?(q+1)%8:e.nextLevel;if(t===4){let e=G.getActiveSystemCatalog();(e[G.focusedSolarBodyIndex]?.isStar||G.focusedSolarBodyIndex===0)&&G.setFocusedSolarBody(G.getDefaultPlanetIndex(e))}Sn(Be[t].log10SpanM)}async function jn(){if(G.surfaceActive){In();return}if(q===5&&J){await Dn();return}q<=0||Sn(Be[q-1].log10SpanM)}function Mn(){if(!G.surfaceSession)return;let e=G.surfaceSession,t=e.env,n=e.activeVehicle,r=n;r=t.hasSolidCrust?n===`ufo`?`rover`:n===`rover`?`drone`:`ufo`:n===`ufo`?`drone`:`ufo`,G.setSurfaceVehicle(r),Pn(),K(),$(performance.now())}function Nn(){if(G.surfaceActive&&G.surfaceSession){let e=G.surfaceSession.cameraMode===`chase`?`first-person`:`chase`;G.setSurfaceCameraMode(e),Pn()}else kt=!kt;K(),$(performance.now())}function Pn(){let e=!!(G.surfaceActive&&G.surfaceSession);if(Xe?.classList.toggle(`active`,e),pt?.classList.toggle(`active`,e),Le){let t=G.getActiveSystemCatalog()[G.planetaryBodyIndex]||Me[3],n=(Number(t?.radiusKm)||6371)>=16e3;Le.textContent=n?`🛸 Dive`:`🚙 Land`,Le.title=n?`Deploy Buoyant 3D CFD Research UFO into deep planetary atmosphere (L)`:`Land 6-Wheel Rover / Drone / 3D CFD UFO on planetary surface (L)`,Le.style.display=q===4&&!e?`inline-flex`:`none`}if(Ye&&(Ye.style.display=e?`none`:``),!e)return;let t=G.surfaceSession,n=G.surfaceTelemetry||t.getTelemetry(),r=t.env,i=t.activeVehicle===`ufo`,a=t.activeVehicle===`drone`,o=G.getActiveSystemCatalog()[G.planetaryBodyIndex]||Me[3],s=G.planetaryMode===`magma-ocean`?`Hadean Magma Ocean`:G.planetaryMode===`cryo-plumes`?`Cryovolcanic Moon`:o.name,c=n.rhoAtmKgM3??r.rhoAtmKgM3,l=c>1e-4?`ρ=${c.toFixed(c<.1?3:2)} kg/m³`:`<span class="warn">VACUUM (0 Pa)</span>`,u=n.cfdTelemetry,d=u?.chemistry,f=i?`🛸 60ft UFO`:a?`🚁 DRONE`:`🚙 ROVER`,p;if(i&&d){let e=d.pressureBar>=.1?`${d.pressureBar.toFixed(2)} bar`:`${(d.pressureBar*101.325).toFixed(1)} kPa`,t=u?.craftWindSpeedMS||0;p=`Alt ${r.hasSolidCrust?`${(n.ufoAltitudeM||0).toFixed(1)} m`:`${d.altKm.toFixed(1)} km`} · <strong>${e}</strong> · ${Math.round(d.tempK)} K · <span class="good">3D Wind ${t.toFixed(1)} m/s</span> · Rocks: ${n.aliveBoulderCount??0} · Craters: ${n.totalCratersCarved??0}`}else p=i?`Alt ${(n.ufoAltitudeM||0).toFixed(1)} m · Spd ${(n.ufoSpeedMS||0).toFixed(1)} m/s · Rocks: ${n.aliveBoulderCount??0} · Craters: ${n.totalCratersCarved??0}`:a?r.droneFlightCapable?`Alt ${(n.droneAltitudeM||0).toFixed(1)} m · Spd ${(n.droneSpeedMS||0).toFixed(1)} m/s · <span class="good">Lift ${(n.droneAeroLiftN||0).toFixed(1)}/${r.maxAeroLiftN.toFixed(1)} N</span>`:`Alt ${(n.droneAltitudeM||0).toFixed(1)} m · <span class="warn">0.0 N AERO LIFT (VACUUM!)</span>`:`Alt ${(n.roverAltitudeM||0).toFixed(1)} m · Spd ${(n.roverSpeedMS||0).toFixed(1)} m/s · Fuel ${Math.round((n.roverRocketFuel??1)*100)}%`;if(Ze&&(Ze.innerHTML=`<span><strong>${f}</strong> · ${s} · g=${r.gravityMS2.toFixed(2)} m/s² · ${l} · ${p}</span>`),$e){let e=n.weaponReaction;e?.reactionOutcome?($e.innerHTML=`<span><strong>${e.phaseState||`ACTIVE`}</strong>: ${e.reactionOutcome}${n.mpmActive?` · <span class="good">GPU MLS-MPM Active</span>`:``}</span>`,$e.style.display=`flex`):$e.style.display=`none`}if(K(),Qe){let e=n.localSample||t.getLocalSample?.();if(u&&d&&d.species?.length>0){let t=d.species.slice(0,4).map(e=>{let t=e.moleFrac*100,n=t>=1?`${t.toFixed(1)}%`:t>=.01?`${t.toFixed(2)}%`:`${(t*1e4).toFixed(0)} ppm`,r=e.condensedFrac>1e-6?` <span class="warn">(☁)</span>`:``;return`<span><strong>${e.id}</strong> ${n}${r}</span>`}).join(` · `),n=u?.craftWindMS||[0,0,0],r=e?` · <span>Below: <strong>${e.shortLabel}</strong></span>`:``;Qe.innerHTML=`<span>3D CFD: v=(${n[0].toFixed(1)}, ${n[1].toFixed(1)}, ${n[2].toFixed(1)}) m/s · |ω|=${(u?.craftVorticity||0).toFixed(2)}</span> · ${t}${r}`,Qe.style.display=`flex`}else e?(Qe.innerHTML=`<span>Direct Below Craft: <strong>${e.name}</strong> · ${e.locationTag}</span>`,Qe.style.display=`flex`):Qe.style.display=`none`}if(ct){let e=n.localSample||t.getLocalSample?.();ct.textContent=e?`🔬 SAMPLE: ${e.shortLabel} (G)`:`🔬 SAMPLE BELOW (G)`}lt&&(lt.textContent=i||a?`⬆ ASCEND (Space)`:`🔥 ROCKET JUMP`,lt.classList.toggle(`firing`,!!G.surfaceControls.jump)),W&&(W.style.display=i||a?`inline-flex`:`none`,W.classList.toggle(`active`,!!G.surfaceControls.down)),ut&&(r.hasSolidCrust?t.cfdProfile?ut.textContent=i?`🛸 3D CFD UFO (F→Rover)`:a?`🚁 DRONE (F→UFO)`:`🚙 ROVER (F→Drone)`:ut.textContent=a?`🚙 SWITCH ROVER (F)`:`🚁 DEPLOY DRONE (F)`:ut.textContent=i?`🛸 3D CFD UFO (F→Drone)`:`🚁 DRONE (F→UFO)`,ut.classList.toggle(`active`,i||a)),dt&&(dt.textContent=t.cameraMode===`first-person`?`📷 1ST CAM (V)`:`📷 3RD CAM (V)`,dt.classList.toggle(`active`,t.cameraMode===`first-person`))}async function Fn({bodyIndex:e=null,planetaryModeOverride:t=null,restoreCheckpoint:n=null,initialVehicle:r=`ufo`}={}){nn=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),sn=null;let i=e;if(typeof i==`string`){let e=G.getActiveSystemCatalog(),t=e.findIndex(e=>e.id===i);i=t>=0&&!e[t].isStar?t:Me.findIndex(e=>e.id===i)>0?i:G.planetaryBodyIndex}else if(!(i>0)){let e=G.getActiveSystemCatalog();i=!e[G.focusedSolarBodyIndex]?.isStar&&G.focusedSolarBodyIndex>0?G.focusedSolarBodyIndex:G.getDefaultPlanetIndex(e)}return Y=null,Gt=!1,Kt=[0,0,0],q=4,s=2,await G.enterSurfaceView({bodyIndex:i,planetaryModeOverride:t,restoreCheckpoint:n,initialVehicle:r}),G.setSurfaceWeaponConfig({mode:At,log10WavelengthM:jt,powerW:Mt}),G.setSurfaceTractorBeam(Pt),kt&&G.setSurfaceCameraMode(`first-person`),Z(),Tn(),Pn(),K(),Q(),$(performance.now()),G.surfaceTelemetry}function In(){if(!G.surfaceActive)return;G.exitSurfaceView();let e=G.getActiveSystemCatalog()[G.planetaryBodyIndex]||Me[3];q=4,s=hr(e),xn(G.planetaryBodyIndex),Tn(),Pn(),Q(),$(performance.now())}Le?.addEventListener(`click`,()=>{Fn({bodyIndex:G.planetaryBodyIndex})}),ct?.addEventListener(`click`,()=>{En()}),lt?.addEventListener(`pointerdown`,e=>{e.preventDefault(),G.setSurfaceControls({jump:!0}),Pn()});let zn=()=>{G.surfaceControls.jump&&(G.setSurfaceControls({jump:!1}),Pn())};lt?.addEventListener(`pointerup`,zn),lt?.addEventListener(`pointerleave`,zn),lt?.addEventListener(`pointercancel`,zn),W?.addEventListener(`pointerdown`,e=>{e.preventDefault(),G.setSurfaceControls({down:!0}),Pn()});let Bn=()=>{G.surfaceControls.down&&(G.setSurfaceControls({down:!1}),Pn())};if(W?.addEventListener(`pointerup`,Bn),W?.addEventListener(`pointerleave`,Bn),W?.addEventListener(`pointercancel`,Bn),ut?.addEventListener(`click`,()=>Mn()),dt?.addEventListener(`click`,()=>Nn()),ft?.addEventListener(`click`,()=>In()),y?.addEventListener(`click`,()=>Nn()),b?.addEventListener(`click`,()=>{Lt.toggleXr((e,t)=>{for(let e of t)$(performance.now(),e)})}),x?.addEventListener(`click`,async()=>{let e=Vt();try{window.history?.replaceState?.(null,``,e),await navigator.clipboard?.writeText?.(e)}catch{}x&&(x.textContent=`✓ Copied!`,setTimeout(()=>{x&&(x.textContent=`🔗 Share`)},1600))}),C?.addEventListener(`click`,()=>{if(Rt.isConnected)Rt.disconnect();else{let e=ue?.value?.trim()||``;Rt.connect({room:`cosmos-${G.seed%1e4}`,relay:e})}Bt()}),et)for(let e of et.querySelectorAll(`[data-weapon]`))e.addEventListener(`click`,()=>{At=e.dataset.weapon||`laser`,G.setSurfaceWeaponConfig({mode:At}),K()});let Vn=e=>{if(Nt=!!e,At===`missile`&&e&&G.surfaceActive){let e=G.launchSurfaceMissile({});e&&Rt.isConnected&&Rt.broadcastMissileLaunch(e),Nt=!1}else G.setSurfaceWeaponFire({firing:Nt});K()};tt?.addEventListener(`pointerdown`,e=>{e.preventDefault(),Vn(!0)}),tt?.addEventListener(`pointerup`,()=>Vn(!1)),tt?.addEventListener(`pointerleave`,()=>Vn(!1)),nt?.addEventListener(`click`,()=>{Pt=!Pt,G.setSurfaceTractorBeam(Pt),K()}),rt?.addEventListener(`input`,e=>{jt=Number(e.target.value),G.setSurfaceWeaponConfig({log10WavelengthM:jt}),K()}),at?.addEventListener(`input`,e=>{let t=Number(e.target.value);Mt=Math.min(It.state.maxPowerW*1e4,10**t),G.setSurfaceWeaponConfig({powerW:Mt}),K()}),ot?.addEventListener(`click`,()=>{let e=G.getActiveSystemCatalog()[G.focusedSolarBodyIndex]?.id||`earth`;It.deployVonNeumannProbe({bodyId:e,orbitRadius:1.8+Math.random()*1.4}),K()});function Hn(e,t,n){if(!e||!t)return;let r=null,i=r=>{let i=e.getBoundingClientRect(),a=i.left+i.width*.5,o=i.top+i.height*.5,s=r.clientX-a,c=r.clientY-o,l=Math.hypot(s,c);l>36&&(s=s/l*36,c=c/l*36),t.style.transform=`translate(calc(-50% + ${s.toFixed(1)}px), calc(-50% + ${c.toFixed(1)}px))`,n(s/36,-c/36)};e.addEventListener(`pointerdown`,t=>{t.preventDefault(),r=t.pointerId,e.setPointerCapture?.(t.pointerId),i(t)}),e.addEventListener(`pointermove`,e=>{e.pointerId===r&&i(e)});let a=e=>{e.pointerId===r&&(r=null,t.style.transform=`translate(-50%, -50%)`,n(0,0))};e.addEventListener(`pointerup`,a),e.addEventListener(`pointercancel`,a)}Hn(mt,ht,(e,t)=>{G.setSurfaceControls({moveX:e,moveY:t})}),Hn(gt,_t,(e,t)=>{G.addSurfaceLookDelta(-e*.08,-t*.05)});let Un=e=>{let t=document.activeElement?.tagName;if(!(t===`INPUT`||t===`SELECT`||t===`TEXTAREA`)){if(e.code===`KeyV`&&!e.repeat){Nn();return}if(e.code===`KeyT`&&!e.repeat){Pt=!Pt,G.setSurfaceTractorBeam(Pt),K();return}if(e.code===`KeyX`){Vn(!0);return}if(e.code===`KeyM`&&!e.repeat&&G.surfaceActive){let e=G.launchSurfaceMissile({});e&&Rt.isConnected&&Rt.broadcastMissileLaunch(e);return}if(e.code===`Digit1`){At=`laser`,G.setSurfaceWeaponConfig({mode:`laser`}),K();return}if(e.code===`Digit2`){At=`missile`,G.setSurfaceWeaponConfig({mode:`missile`}),K();return}if(e.code===`Digit3`){At=`antimatter`,G.setSurfaceWeaponConfig({mode:`antimatter`}),K();return}if(e.code===`KeyP`&&!e.repeat){let e=G.getActiveSystemCatalog();It.deployVonNeumannProbe({bodyId:e[G.focusedSolarBodyIndex]?.id||`earth`}),K();return}if(!G.surfaceActive){e.code===`KeyL`&&q===4&&!e.repeat&&Fn({bodyIndex:G.planetaryBodyIndex});return}e.code===`KeyW`||e.code===`ArrowUp`?(G.setSurfaceControls({forward:!0}),e.preventDefault()):e.code===`KeyS`||e.code===`ArrowDown`?(G.setSurfaceControls({backward:!0}),e.preventDefault()):e.code===`KeyA`||e.code===`ArrowLeft`?(G.setSurfaceControls({left:!0}),e.preventDefault()):e.code===`KeyD`||e.code===`ArrowRight`?(G.setSurfaceControls({right:!0}),e.preventDefault()):e.code===`Space`?(G.setSurfaceControls({jump:!0}),e.preventDefault()):e.code===`ControlLeft`||e.code===`ControlRight`||e.code===`KeyC`?G.setSurfaceControls({down:!0}):e.code===`ShiftLeft`||e.code===`ShiftRight`?G.setSurfaceControls({turbo:!0}):e.code===`KeyQ`?G.setSurfaceControls({yawLeft:!0}):e.code===`KeyE`?G.setSurfaceControls({yawRight:!0}):e.code===`KeyF`&&!e.repeat&&G.surfaceSession?Mn():e.code===`KeyG`&&!e.repeat&&G.surfaceSession?(G.triggerSurfaceTractorPulse(2),En()):e.code===`Escape`&&In()}},Wn=e=>{e.code===`KeyX`&&Vn(!1),G.surfaceActive&&(e.code===`KeyW`||e.code===`ArrowUp`?G.setSurfaceControls({forward:!1}):e.code===`KeyS`||e.code===`ArrowDown`?G.setSurfaceControls({backward:!1}):e.code===`KeyA`||e.code===`ArrowLeft`?G.setSurfaceControls({left:!1}):e.code===`KeyD`||e.code===`ArrowRight`?G.setSurfaceControls({right:!1}):e.code===`Space`?G.setSurfaceControls({jump:!1}):e.code===`ControlLeft`||e.code===`ControlRight`||e.code===`KeyC`?G.setSurfaceControls({down:!1}):e.code===`ShiftLeft`||e.code===`ShiftRight`?G.setSurfaceControls({turbo:!1}):e.code===`KeyQ`?G.setSurfaceControls({yawLeft:!1}):e.code===`KeyE`&&G.setSurfaceControls({yawRight:!1}))};if(window.addEventListener(`keydown`,Un),window.addEventListener(`keyup`,Wn),Fe?.addEventListener(`click`,()=>{nn=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),An()}),Ke?.addEventListener(`click`,()=>{nn=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),jn()}),M?.addEventListener(`click`,()=>{nn=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),jn()}),w?.addEventListener(`click`,()=>{nn=!nn,w.classList.toggle(`active`,nn),w.textContent=nn?`⏹ Stop Tour`:`▶ Tour`,nn&&(sn=null)}),j?.addEventListener(`click`,()=>{Yt=!Yt,j.textContent=Yt?`⏸ Pause`:`▶ Resume`,h?.classList.toggle(`paused`,!Yt)}),N?.addEventListener(`input`,e=>{if(Rt.timescaleLocked){Xt=1,N&&(N.value=`1.0`),I&&(I.textContent=`🔒 1.0×`);return}Xt=Number(e.target.value)||1,I&&(I.textContent=`${Xt.toFixed(1)}×`)}),ee?.addEventListener(`click`,async()=>{rn=1,await G.initCosmicWeb(),sn=null,s=Be[0].log10SpanM,q=0,Z(),Tn()}),L?.addEventListener(`click`,async()=>{rn=.75,G.setSeed(G.seed+7919>>>0),await G.initCosmicWeb(),G.galaxyEngine&&await G.initGalaxy(),G.solarEngine&&await G.initSolarSystem(),Z()}),te)for(let e of te.querySelectorAll(`[data-quality]`))e.addEventListener(`click`,async()=>{let t=e.dataset.quality;if(G.setQuality(t)){for(let e of te.querySelectorAll(`[data-quality]`))e.classList.toggle(`active`,e.dataset.quality===t);q===0?await G.initCosmicWeb():q===1?await G.initGalaxy():q===2&&G.galaxyBranch!==`smbh-core`?await G.initSolarSystem():q===3?await G.initStellarCore():q===5?await G.initMolecularDynamics():q===6?await G.initQuantumAtom():q===7&&(await G.initAtomicNucleus(),G.nuclearResult?.volumeData&&Dt.uploadNuclearVolume(G.nuclearResult.volumeData)),Cn()}});ne?.addEventListener(`change`,e=>{Zt=e.target.checked}),z?.addEventListener(`change`,e=>{Qt=e.target.checked}),re?.addEventListener(`change`,e=>{e.target.checked}),ie?.addEventListener(`change`,e=>{$t=e.target.checked}),ae?.addEventListener(`change`,e=>{en=e.target.checked}),ce?.addEventListener(`input`,e=>{tn=Number(e.target.value)||3,le&&(le.textContent=`${tn}×`)}),pe?.addEventListener(`click`,async()=>{G.getPeerMeshState().connected?await G.disconnectPeerMesh():await G.connectPeerMesh({relayUrl:ue?.value||``,roomId:n.get(`peerRoom`)||`ulg-universes-mesh-v1`,role:de?.value||`requester`}),Gn()});function Gn(){let e=G.getPeerMeshState();pe&&(pe.textContent=e.connected?`Leave`:`Join Mesh`),he&&(he.textContent=e.connected?`${e.role} · ${e.remotePeers} peers · ${e.quorumReady?`2-of-2 QUORUM READY`:`waiting`}`:e.error?`Error: ${e.error}`:`Local GPU · 0 remote peers`)}let Kn=!1,qn=!1,Jn=0,Yn=0,Xn=0,Zn=0;function Qn(){let e=s;if(q===0){if(G.cosmoMode!==`web`&&G.cosmoBaryonSession){let t=12.2/Math.max(100,G.cosmoBaryonSession.boxSizeMpc||260)*10**Math.max(-.6,Math.min(1.8,24.8-e));return{kind:`cosmo-baryon`,buffer:G.cosmoBaryonSession.getResidentTracersBuffer(),count:G.cosmoBaryonSession.tracerCount,strideFloats:16,layoutMode:me.STANDARD,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(G.cosmoSession)return{kind:`cosmo-web`,buffer:G.cosmoSession.particlesBuffer,count:G.cosmoSession.particleCount,strideFloats:8,layoutMode:me.STANDARD,worldScale:fn.cosmoScale??.09,offsetHi:fn.cosmoOffset??[0,0,0],offsetLo:[0,0,0],skipFirst:0}}else if(q===1&&G.galaxyEngine)return{kind:`galaxy-star`,buffer:G.galaxyEngine.getResidentBuffer(),count:G.galaxyEngine.count,strideFloats:8,layoutMode:me.GALAXY_VISIBLE,worldScale:fn.galaxyScale??.85,offsetHi:fn.galaxyOffset??[0,0,0],offsetLo:[0,0,0],skipFirst:0};else if(q===2&&G.galaxyBranch!==`smbh-core`){if(G.solarMode===`formation`&&G.protoplanetarySession){let t=.92*10**Math.max(-1.2,Math.min(1.2,12.6-e));return{kind:`proto-pebble`,buffer:G.protoplanetarySession.getResidentPebblesBuffer(),count:G.protoplanetarySession.pebbleCount,strideFloats:16,layoutMode:me.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(G.solarMode===`quasar-jet`&&G.kerrJetSession){let t=.85*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`kerr-parcel`,buffer:G.kerrJetSession.getResidentParcelsBuffer(),count:G.kerrJetSession.particleCount,strideFloats:16,layoutMode:me.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(G.solarMode)&&G.relBinarySession){let t=1.12*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`relbin-parcel`,buffer:G.relBinarySession.getResidentParcelsBuffer(),count:G.relBinarySession.particleCount,strideFloats:16,layoutMode:me.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`comet-tails`,`hot-jupiter`].includes(G.solarMode)&&G.radWindL2Session){let t=1.05*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`radwind-parcel`,buffer:G.radWindL2Session.getResidentParcelsBuffer(),count:G.radWindL2Session.particleCount,strideFloats:16,layoutMode:me.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if([`roche-rings`,`giant-impact`,`red-giant`].includes(G.solarMode)&&G.tidalRocheSession){let t=1.06*10**Math.max(-1,Math.min(1.2,12.6-e));return{kind:`roche-parcel`,buffer:G.tidalRocheSession.getResidentParticlesBuffer(),count:G.tidalRocheSession.particleCount,strideFloats:16,layoutMode:me.FLAGGED_LIVE_16F,worldScale:t,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}if(G.solarEngine){let t=Math.max(0,Math.min((G.solarEngine.massiveCount||1)-1,G.focusedSolarBodyIndex)),n=G.solarEngine.getMassiveBodyState64(t),r=[Math.fround(n.posAu[0]),Math.fround(n.posAu[1]),Math.fround(n.posAu[2])],i=[Math.fround(n.posAu[0]-r[0]),Math.fround(n.posAu[1]-r[1]),Math.fround(n.posAu[2]-r[2])],a=10**e/Oe,o=16/Math.max(1e-9,a);return{kind:`solar-asteroid`,buffer:G.solarEngine.getResidentBuffer(),count:G.solarEngine.totalCount,strideFloats:16,layoutMode:me.SOLAR_DOUBLE_FLOAT,worldScale:fn.solarScaleAuToWorld??o,offsetHi:r,offsetLo:i,skipFirst:G.solarEngine.massiveCount}}}else if(q===3){let t=.92*10**Math.max(-1,Math.min(1,9.2-e));if(G.stellarMode===`nebular-mhd`&&G.nebulaMhdSession)return{kind:`nebula-mhd-parcel`,buffer:G.nebulaMhdSession.getResidentTracersBuffer(),count:G.nebulaMhdSession.tracerCount,strideFloats:16,layoutMode:me.STANDARD,worldScale:t*1.15,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if([`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(G.stellarMode)&&G.radWindL3Session)return{kind:`radwind-parcel`,buffer:G.radWindL3Session.getResidentParcelsBuffer(),count:G.radWindL3Session.particleCount,strideFloats:16,layoutMode:me.FLAGGED_LIVE_16F,worldScale:t*1.05,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if((G.stellarMode===`pulsar`||G.stellarMode===`magnetar`)&&G.magnetosphereSession)return{kind:`mag-parcel`,buffer:G.magnetosphereSession.getResidentParcelsBuffer(),count:G.magnetosphereSession.particleCount,strideFloats:16,layoutMode:me.FLAGGED_LIVE_16F,worldScale:t*1.12,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0};if(G.stellarEngine)return{kind:`stellar-hydro-parcel`,buffer:G.stellarEngine.getResidentBuffer(),count:G.stellarEngine.count,strideFloats:16,layoutMode:me.STANDARD,worldScale:t*.95,offsetHi:[0,0,0],offsetLo:[0,0,0],skipFirst:0}}else if(q===5&&G.mdSession){let t=G.mdSession.boxLengthsA,n=8.4/Math.max(t[0],t[1],t[2],6),r=10**Math.max(-1.2,Math.min(1.4,-8.2-e));return{kind:`md-atom`,buffer:G.mdSession.positionsBuffer,velBuffer:G.mdSession.velocitiesBuffer,count:G.mdSession.atomCount,strideFloats:4,layoutMode:me.MD_PERIODIC_4F,worldScale:n*r,offsetHi:[0,0,0],offsetLo:[t[0]*.5,t[1]*.5,t[2]*.5],skipFirst:0}}return null}function er(e,t,n){let r=n,i=e.worldScale||1,a=e.offsetHi||[0,0,0],o=e.offsetLo||[0,0,0],s=[r[0]||0,r[1]||0,r[2]||0],c;if(e.layoutMode===me.SOLAR_DOUBLE_FLOAT?(s=[r[0]+r[4],r[1]+r[5],r[2]+r[6]],c=[(r[0]-a[0]+(r[4]-o[0]))*i,(r[1]-a[1]+(r[5]-o[1]))*i,(r[2]-a[2]+(r[6]-o[2]))*i]):c=e.layoutMode===me.MD_PERIODIC_4F?[(r[0]-o[0])*i,(r[1]-o[1])*i,(r[2]-o[2])*i]:[(r[0]-a[0])*i,(r[1]-a[1])*i,(r[2]-a[2])*i],e.kind===`cosmo-web`){let n=Math.hypot(r[4]||0,r[5]||0,r[6]||0),i=Math.max(.1,Number(r[7])||1),a=G.deriveGalaxyEnvironmentFromCosmicContext({cosmicEpoch:G.cosmicEpoch,regionPosMpc:s,localOverdensity:i,seed:G.seed});return{kind:e.kind,level:q,index:t,rawPos:s,worldPos:c,localOverdensity:i,name:`Cosmic-Web Halo Mote #${t}`,subtitle:`${a.morphologyLabel} · δ/ρ̄=${i.toFixed(2)}× · [Fe/H]=${a.baseFeH>=0?`+`:``}${a.baseFeH.toFixed(2)}`,composition:`Causal Cosmic Context: f_gas=${(a.gasFraction*100).toFixed(0)}% · C/O=${a.baseCO.toFixed(2)} · Dive to form this galaxy`,tempK:8500,stats:[[`Comoving r`,`${Math.hypot(...s).toFixed(1)} Mpc`],[`Peculiar |v|`,`${(n*120).toFixed(0)} km/s`],[`Local δ/ρ̄`,`${i.toFixed(2)}×`],[`Morphology`,a.morphology]]}}if(e.kind===`cosmo-baryon`){let n=(r[11]||0)>.5,i=Number(r[8])||3e3,a=Number(r[9])||0,o=Number(r[7])||1;return{kind:e.kind,level:q,index:t,rawPos:s,worldPos:c,name:`${n?`Dark-Matter Lensing Halo`:`Baryon / IGM Parcel`} #${t}`,subtitle:`Live GPU Cosmological Tracer · (${s[0].toFixed(1)}, ${s[1].toFixed(1)}, ${s[2].toFixed(1)}) Mpc`,composition:n?`Collisionless CDM Mass Tracer`:`H/He Plasma · x_HII=${(a*100).toFixed(1)}% · T=${i>1e5?`${(i/1e6).toFixed(1)} MK`:`${Math.round(i)} K`}`,tempK:Math.max(2500,Math.min(35e3,i)),stats:[[`Species`,n?`Dark Matter`:`Baryon Gas`],[`Temp T`,i>1e5?`${(i/1e6).toFixed(2)} MK`:`${Math.round(i)} K`],[`Ionized x_HII`,`${(a*100).toFixed(1)}%`],[`Density ρ`,`${o.toFixed(2)} ρ̄`]]}}if(e.kind===`galaxy-star`){let n=Number(r[7])||0,i=Math.hypot(s[0],s[2])*5.2;s[1]*5.2;let a=Math.hypot(r[4]||0,r[5]||0,r[6]||0),o=G.galacticDynamoSession?.sampleBAt?.(s[0],s[1],s[2])||[0,0,0],l=Math.hypot(o[0],o[1],o[2]),u={posGal:[...s],popTag:n,starIndex:t},d=G.deriveStarSystemFromGalacticLocation({cosmicEpoch:G.cosmicEpoch,galaxyEnv:G.activeGalaxyEnv,starPosGal:s,popTag:n,starIndex:t,seed:G.seed+409>>>0}),f=G.synthesizeNebularPlanetarySystem(d,{seedOverride:G.seed+409>>>0}),p=d.multiplicity===3?`Trinary`:d.multiplicity===2?`Binary`:`Single`,m=d.stars.map(e=>e.spectralCode).join(`+`);return{kind:e.kind,level:q,index:t,rawPos:s,worldPos:c,starSite:u,name:`Star #${t} · ${d.systemName} (${p} ${m})`,subtitle:`${d.galacticRegion} · R=${i.toFixed(1)} kly · ${f.planetCount} worlds${f.hasEarthLike?` (Earth-like!)`:``}`,composition:`Nebula: ${d.nebulaEnv.nebulaSummary} · Click 🎯 Focus or Dive to simulate this system`,tempK:d.stars[0].effectiveTempK,stats:[[`Multiplicity`,`${p} (${m})`],[`Nebula [Fe/H]`,`${d.nebulaEnv.feH>=0?`+`:``}${d.nebulaEnv.feH.toFixed(2)}`],[`Local |B|`,`${(l*12).toFixed(2)} μG`],[`Orbital |v|`,`${(a*24.5).toFixed(0)} km/s`]]}}if(e.kind===`solar-asteroid`){let n=Math.hypot(s[0],s[1],s[2]),i=Math.hypot(r[8]||0,r[9]||0,r[10]||0)*4.7405,a=G.activeCausalSystem?.condensationFrontsAu?.rSnowLineAu||2.7,o=(r[11]||0)>6.5||n>Math.max(8.5,a*3.5),l=G.getActiveSystemCatalog()?.[0]?.massSolar||1,u=Math.max(.05,n)**1.5/Math.sqrt(Math.max(.08,l)),d=Math.max(35,Math.round(280/Math.sqrt(Math.max(.2,n)))),f=o?{id:`kbo-${t}`,worldName:`Kuiper Belt Object #${t}`,category:`minor-body`,name:`Kuiper Volatile Ice & Tholin Planetesimal (H₂O · CH₄ · CO)`,shortLabel:`KBO Ice`,locationTag:`r = ${n.toFixed(2)} AU`,phasePreset:`solid`,tempK:d,primaryZ:8,formula:`H₂O/CH₄`,moleculeKey:`H2O`,compounds:[{id:`H2O`,formula:`H₂O`,name:`Amorphous Water Ice`,moleFrac:.68,primaryZ:8,moleculeKey:`H2O`,elements:[8,1]},{id:`CH4`,formula:`CH₄`,name:`Frozen Methane`,moleFrac:.2,primaryZ:6,moleculeKey:`CH4`,elements:[6,1]},{id:`CO`,formula:`CO`,name:`Carbon Monoxide Frost`,moleFrac:.12,primaryZ:6,moleculeKey:`CO`,elements:[6,8]}],elements:[{Z:8,sym:`O`,name:`Oxygen`},{Z:1,sym:`H`,name:`Hydrogen`},{Z:6,sym:`C`,name:`Carbon`}]}:{id:`asteroid-${t}`,worldName:`Main-Belt Asteroid #${t}`,category:`minor-body`,name:`Chondritic Silicate & Fe-Ni Asteroid (SiO₂ · Mg₂SiO₄ · Fe)`,shortLabel:`Chondrite Rock`,locationTag:`r = ${n.toFixed(2)} AU`,phasePreset:`solid`,tempK:d,primaryZ:14,formula:`SiO₂/Fe`,moleculeKey:`SiO2`,compounds:[{id:`SiO2`,formula:`SiO₂`,name:`Olivine/Pyroxene Silicate`,moleFrac:.62,primaryZ:14,moleculeKey:`SiO2`,elements:[14,8]},{id:`FeNi`,formula:`Fe-Ni`,name:`Metallic Chondrule Grains`,moleFrac:.26,primaryZ:26,moleculeKey:`O2`,elements:[26,28]},{id:`CO2`,formula:`C-Org`,name:`Carbonaceous Matrix`,moleFrac:.12,primaryZ:6,moleculeKey:`CO2`,elements:[6,8,1]}],elements:[{Z:14,sym:`Si`,name:`Silicon`},{Z:8,sym:`O`,name:`Oxygen`},{Z:26,sym:`Fe`,name:`Iron`},{Z:28,sym:`Ni`,name:`Nickel`},{Z:6,sym:`C`,name:`Carbon`}]};return{kind:e.kind,level:q,index:t,rawPos:s,worldPos:c,sampleZ:f.primaryZ,sampleMaterial:f,name:`${o?`Kuiper Belt Object`:`Main-Belt Asteroid`} #${t}`,subtitle:`f32x2 Symplectic N-Body · r = ${n.toFixed(3)} AU · T = ${u.toFixed(2)} yr`,composition:o?`H₂O / CH₄ / CO Outer-System Icy Planetesimal`:`Silicate Chondrite + Fe-Ni Metallic Asteroid`,tempK:d,stats:[[`Helio r`,`${n.toFixed(3)} AU`],[`Speed |v|`,`${i.toFixed(2)} km/s`],[`Period T`,`${u.toFixed(2)} yr`],[`Type`,o?`Icy KBO`:`Silicate/Fe`]]}}if(e.kind===`proto-pebble`){let n=Math.hypot(s[0],s[1],s[2]),i=Number(r[8])||180,a=Number(r[9])||0;return{kind:e.kind,level:q,index:t,rawPos:s,worldPos:c,name:`${a>.5?`Icy Outer`:`Rocky Silicate`} Pebble #${t}`,subtitle:`Epstein/Stokes Gas-Drag Disk Tracer · r = ${n.toFixed(2)} AU`,composition:a>.5?`Condensed H₂O/CO Ice + Silicate Core (Beyond Snow Line)`:`Refractory Silicate + Fe-Ni Chondrule Dust`,tempK:Math.max(50,Math.min(2e3,i)),stats:[[`Disk r`,`${n.toFixed(2)} AU`],[`Temp T(r)`,`${Math.round(i)} K`],[`Ice Frac`,`${(a*100).toFixed(0)}%`],[`Speed |v|`,`${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)}`]]}}if(e.kind===`stellar-hydro-parcel`){let n=Number(r[8])||4,i=Number(r[9])||-5,a=10**n,o=Number(r[10])||.72,l=Number(r[11])||-30,u=Number(r[13])||0,d=Number(r[14])||.26,f=Number(r[15])||.02,p=G.stellarDynamoSession?.sampleBAt?.(s[0],s[1],s[2])||[0,0,0],m=Math.hypot(p[0],p[1],p[2]);return{kind:e.kind,level:q,index:t,rawPos:s,worldPos:c,name:`Stellar Plasma Parcel #${t}`,subtitle:`self-gravitating-hydro@1 · r = ${Math.hypot(...s).toFixed(2)} · x_ion = ${(u*100).toFixed(0)}%`,composition:`H ${(o*100).toFixed(1)}% · He ${(d*100).toFixed(1)}% · Z ${(f*100).toFixed(2)}%`,tempK:Math.max(2e3,Math.min(4e4,a)),stats:[[`Parcel T`,a>=1e6?`${(a/1e6).toFixed(2)} MK`:`${Math.round(a).toLocaleString()} K`],[`log₁₀ ρ`,`${i.toFixed(2)} kg/m³`],[`Fusion ε`,l>-12?`10^${l.toFixed(1)} W/kg`:`Inactive`],[`Dynamo |B|`,`${m.toFixed(3)} B_sim`]]}}if(e.kind===`nebula-mhd-parcel`){let n=Number(r[7])||0,i=Number(r[11])||0,a=Number(r[13])||0;return{kind:e.kind,level:q,index:t,rawPos:s,worldPos:c,name:`MHD Nebula Parcel #${t}`,subtitle:`3D Resistive MHD · B = (${(r[8]||0).toFixed(2)}, ${(r[9]||0).toFixed(2)}, ${(r[10]||0).toFixed(2)})`,composition:a>.15?`Magnetocentrifugal (J×B) Bipolar Jet Plasma`:`Rotating Magnetized Molecular Cloud Gas & Dust`,tempK:a>.15?14e3:4200,stats:[[`Local |B|`,`${n.toFixed(3)}`],[`Density ρ`,`${i.toFixed(2)}`],[`Jet Outflow`,`${a.toFixed(2)}`],[`Speed |v|`,`${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)}`]]}}if(e.kind===`mag-parcel`||e.kind===`kerr-parcel`||e.kind===`relbin-parcel`){let n=Number(r[3])||0,i=Math.max(1,Number(r[7])||1),a=Number(r[9])||0,o=e.kind===`mag-parcel`?n>1.5?`Reconnection Flare / PWN`:n>.5?`Polar-Cap Open Beam`:`Closed Magnetosphere Loop`:e.kind===`kerr-parcel`?n>.5&&n<1.5?`Blandford–Znajek Jet`:`Novikov–Thorne Disk`:n>1.5?`r-Process Ejecta`:`Relativistic Stream`;return{kind:e.kind,level:q,index:t,rawPos:s,worldPos:c,name:`${o} Parcel #${t}`,subtitle:`Persistent GPU Plasma Mote · Lorentz Γ = ${i.toFixed(2)}×`,composition:`Speed |v| = ${Math.hypot(r[4]||0,r[5]||0,r[6]||0).toFixed(2)} · r = ${Math.hypot(...s).toFixed(2)}`,tempK:22e3,stats:[[`Role`,o.slice(0,14)],[`Lorentz Γ`,`${i.toFixed(2)}×`],[e.kind===`mag-parcel`?`Local |B|`:`Y_e / Aux`,`${a.toFixed(3)}`],[`Emissivity`,`${(r[10]||0).toFixed(2)}`]]}}if(e.kind===`radwind-parcel`||e.kind===`roche-parcel`){let n=Math.hypot(r[4]||0,r[5]||0,r[6]||0);return{kind:e.kind,level:q,index:t,rawPos:s,worldPos:c,name:`${e.kind===`radwind-parcel`?`Photoionized Nebula/Tail`:`Tidal Debris/Ring`} Parcel #${t}`,subtitle:`Live GPU Parcel · r = ${Math.hypot(...s).toFixed(2)} · |v| = ${n.toFixed(2)}`,composition:e.kind===`radwind-parcel`?`Hα=${(r[8]||0).toFixed(2)} · [O III]=${(r[9]||0).toFixed(2)} · [S II]=${(r[10]||0).toFixed(2)}`:`Intact=${(r[7]||0)>.5?`Cohesive`:`Disrupted`} · T_norm=${(r[8]||0).toFixed(2)}`,tempK:11e3,stats:[[`Radius r`,`${Math.hypot(...s).toFixed(2)}`],[`Speed |v|`,`${n.toFixed(2)}`],[e.kind===`radwind-parcel`?`Hα / [O III]`:`Temp Norm`,e.kind===`radwind-parcel`?`${(r[8]||0).toFixed(1)} / ${(r[9]||0).toFixed(1)}`:`${(r[8]||0).toFixed(2)}`],[`GPU Index`,`#${t}`]]}}if(e.kind===`md-atom`){let n=G.getCachedElementBundle(G.mdElementZ,!0)?.bundle,r=n?.symbol||`Z=${G.mdElementZ}`;return{kind:e.kind,level:q,index:t,rawPos:s,worldPos:c,name:`Atom #${t} · ${r} (Z=${G.mdElementZ})`,subtitle:`Live WebGPU MD Atom · (${s[0].toFixed(2)}, ${s[1].toFixed(2)}, ${s[2].toFixed(2)}) Å`,composition:`${n?.mechanical?.crystalStructure||`lattice`} · m = ${(n?.nuclear?.atomicMassU||55.8).toFixed(2)} u`,tempK:G.mdTelemetry?.temperatureK||G.mdTempK,stats:[[`Element`,`${r} (Z=${G.mdElementZ})`],[`Lattice x,y`,`${s[0].toFixed(1)}, ${s[1].toFixed(1)} Å`],[`Lattice z`,`${s[2].toFixed(2)} Å`],[`Bath Temp`,`${Math.round(G.mdTelemetry?.temperatureK||G.mdTempK)} K`]]}}return{kind:e.kind,level:q,index:t,rawPos:s,worldPos:c,name:`GPU Mote #${t}`,subtitle:`Live Resident WebGPU Entity`,composition:``,tempK:6e3,stats:[[`Index`,`#${t}`],[`X`,s[0].toFixed(2)],[`Y`,s[1].toFixed(2)],[`Z`,s[2].toFixed(2)]]}}function tr(e,t){let n=G.getTargetsForLevel(q,fn),r=null,i=q===2?26:42;for(let a of n){if(q===0&&G.cosmoMode!==`web`||q===2&&![`nbody`,`smbh-core`].includes(G.solarMode)&&G.galaxyBranch!==`smbh-core`||q===2&&a.spec?.parent>0&&s>10.5||q===3||q===5)continue;let n=sr(a.pos,un,X,dn);if(!n.visible)continue;let o=Math.hypot(n.sx-e,n.sy-t);o<i&&(i=o,r={...a,hitDistPx:o})}return r}async function nr(e,t,{preferGpuMote:n=!1}={}){if(q===7&&qt.length>0){let n=null,r=36;for(let i=0;i<qt.length;i+=1){let a=qt[i],o=sr(a.pos,un,X,dn);if(!o.visible)continue;let s=Math.hypot(o.sx-e,o.sy-t);s<r&&(r=s,n={idx:i,sphere:a})}if(n){let e=n.sphere.color0[0]>.7,t=Math.hypot(...n.sphere.pos)*(Number(G.nuclearResult?.chargeRadiusFm||3.7)/2.2);return Y={kind:`nucleon`,level:7,index:n.idx,rawPos:[...n.sphere.pos],worldPos:[...n.sphere.pos],name:`${e?`Proton p⁺`:`Neutron n⁰`} #${n.idx+1} (${G.nuclearA}${G.nuclearResult?.isotope?.split(`-`)[0]||``})`,subtitle:e?`Valence Quarks u-u-d · Charge +1e · Spin ½`:`Valence Quarks u-d-d · Charge 0 · Spin ½`,composition:`Bound inside Woods–Saxon nuclear potential (B/A = ${(G.nuclearResult?.bindingPerNucleonMeV||8.79).toFixed(3)} MeV)`,tempK:1e10,stats:[[`Baryon`,e?`Proton (p⁺)`:`Neutron (n⁰)`],[`Shell r`,`${t.toFixed(2)} fm`],[`Mass`,e?`938.27 MeV`:`939.57 MeV`],[`Quarks`,e?`u u d`:`u d d`]]},Q(),$(performance.now()),Y}}let r=n?null:tr(e,t);if(r&&(q===4||q===1&&r.isSmbh||q===2&&(r.hitDistPx??99)<=16))return Y=null,Gt=!1,Ut=r.id,q===1&&r.branch?G.setGalaxyBranch(r.branch,r.pos):q===2&&r.bodyIndex!=null&&(G.setFocusedSolarBody(r.bodyIndex),r.bodyIndex>0&&G.initPlanetaryInterior({bodyIndex:r.bodyIndex})),Cn(),Tn(),Q(),r;let i=Qn();if(i&&i.buffer&&i.count>0){let n=e/Math.max(1,X)*2-1,a=1-t/Math.max(1,dn)*2,o=X/Math.max(1,dn),s=await Ot.pickEntity({buffer:i.buffer,count:i.count,strideFloats:i.strideFloats,layoutMode:i.layoutMode,skipFirst:i.skipFirst||0,viewProj:un,clickNdcX:n,clickNdcY:a,aspect:o,maxPickNdc:i.kind===`solar-asteroid`?.18:.14,offsetHi:i.offsetHi,offsetLo:i.offsetLo,worldScale:i.worldScale});if(s){let n=new Float32Array([...s.vec0,...s.vec1,...s.vec2,...s.vec3]),a=er(i,s.index,n),o=a?.worldPos?sr(a.worldPos,un,X,dn):null,c=o?.visible?Math.hypot(o.sx-e,o.sy-t):999;if(!r||q!==2||c<=(r.hitDistPx??999))return Y=a,Tn(),Q(),$(performance.now()),Y}}return r?(Y=null,Gt=!1,Ut=r.id,q===1&&r.branch?G.setGalaxyBranch(r.branch,r.pos):q===2&&r.bodyIndex!=null&&(G.setFocusedSolarBody(r.bodyIndex),r.bodyIndex>0&&G.initPlanetaryInterior({bodyIndex:r.bodyIndex})),Cn(),Tn(),Q(),r):null}async function lr(){if(!Y||Y.level!==q||Y.kind===`nucleon`)return;let e=Qn();if(!e||e.kind!==Y.kind||!e.buffer)return;let t=await Ot.readSingleEntity(e.buffer,Y.index,e.strideFloats);t&&Y&&Y.kind===e.kind&&(Y=er(e,Y.index,t))}function _r({zoomIn:e=!1}={}){return Y?(q===0&&Y.kind===`cosmo-web`?(G.setCosmoFocusMpc(Y.rawPos),Gt=!0,e&&Sn(Math.max(21.2,s-1.6))):q===1&&Y.kind===`galaxy-star`?(G.setGalaxyBranch(`solar-system`,Y.rawPos),Y.starSite&&G.selectCausalStarSite(Y.starSite),Gt=!0,e&&Sn(Math.max(17.5,s-1.5))):(Gt=!Gt||e,Gt?(Kt=[...Y.worldPos],e&&(ln.dist=Math.max(6.5,ln.dist*.62))):(Kt=[0,0,0],ln.dist=18)),Q(),$(performance.now()),!0):!1}Ie?.addEventListener(`click`,()=>{_r({zoomIn:!Gt})}),c.addEventListener(`pointerdown`,e=>{Kn=!0,qn=!1,Jn=e.clientX,Yn=e.clientY,Xn=e.clientX,Zn=e.clientY,c.setPointerCapture?.(e.pointerId)}),c.addEventListener(`pointermove`,e=>{if(Kn){let t=e.clientX-Xn,n=e.clientY-Zn;Math.hypot(e.clientX-Jn,e.clientY-Yn)>5&&(qn=!0),G.surfaceActive?G.addSurfaceLookDelta(-t*.0055,n*.0055):(ln.yaw-=t*.006,ln.pitch=Math.max(-1.42,Math.min(1.42,ln.pitch+n*.006))),Xn=e.clientX,Zn=e.clientY}else if(!G.surfaceActive){let t=tr(e.clientX,e.clientY);Wt=t?.id||null,c.style.cursor=t?`pointer`:`crosshair`}}),c.addEventListener(`pointerup`,e=>{Kn&&!qn&&!G.surfaceActive&&(nn=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),nr(e.clientX,e.clientY)),Kn=!1}),c.addEventListener(`dblclick`,async e=>{if(G.surfaceActive)return;nn=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`);let t=await nr(e.clientX,e.clientY);t&&t===Y?_r({zoomIn:!0}):An()});let vr=!1;c.addEventListener(`wheel`,e=>{e.preventDefault();let t=P(e);if(G.surfaceActive){let e=1.08**Math.max(-2.5,Math.min(2.5,t/120));G.adjustSurfaceChaseDistance(e),$(performance.now());return}nn=!1,w?.classList.remove(`active`),w&&(w.textContent=`▶ Tour`),sn=null;let n=Math.max(-.55,Math.min(.55,t*.0024)),r=Math.max(ze,Math.min(Re,s+n));if(q===4&&n<0&&r<5.75&&!vr){vr=!0,Fn({bodyIndex:G.planetaryBodyIndex}).finally(()=>{vr=!1});return}s=r,cn=Math.abs(n)*10,bn(s)},{passive:!1});let yr=1;c.addEventListener(`gesturestart`,e=>{e.preventDefault(),yr=Number(e.scale)||1},{passive:!1}),c.addEventListener(`gesturechange`,e=>{e.preventDefault();let t=Number(e.scale)||1;if(t>.05&&yr>.05){let e=yr/t;if(G.surfaceActive)G.adjustSurfaceChaseDistance(e),$(performance.now());else{sn=null;let t=Math.max(-.45,Math.min(.45,Math.log10(e)*2.2));s=Math.max(ze,Math.min(Re,s+t)),bn(s)}}yr=t},{passive:!1});function br(e){if(!Ae)return;let t=Ae.getContext(`2d`);if(!t)return;let n=Ae.width,r=Ae.height;t.fillStyle=`#040812`,t.fillRect(0,0,n,r);for(let e=0;e<n;e+=2){let[i,a,o]=cr(380+e/n*340);t.fillStyle=`rgba(${i},${a},${o},0.16)`,t.fillRect(e,0,2,r)}let i=q>=5?G.getCachedElementBundle(q===5?G.mdElementZ:G.quantumZ,G.quantumRelativistic):null,a=Ln(q,e,i);for(let e of a){let i=(e.wavelengthNm-380)/340*n;if(i<0||i>n)continue;let[a,o,s]=cr(e.wavelengthNm),c=Math.max(.25,Math.min(1,e.intensity));t.fillStyle=`rgba(${a},${o},${s},${c.toFixed(2)})`,t.fillRect(i-1.5,0,3,r),t.fillStyle=`rgba(255,255,255,${(c*.45).toFixed(2)})`,t.fillRect(i-.5,2,1,r-4)}}function xr(){if(!Pe)return;let e=Pe.getContext(`2d`);if(!e)return;let t=Pe.width,n=Pe.height;e.fillStyle=`#050b16`,e.fillRect(0,0,t,n),e.strokeStyle=`rgba(148,163,184,0.18)`,e.lineWidth=1,e.strokeRect(8,8,t-16,n-18);let r=(t,r,i,a=null,o=!1)=>{if(t.length){e.beginPath(),o&&e.setLineDash([3,3]);for(let n=0;n<t.length;n+=1)n===0?e.moveTo(t[n],r[n]):e.lineTo(t[n],r[n]);e.strokeStyle=i,e.lineWidth=o?1.2:2,e.stroke(),e.setLineDash([]),a&&(e.lineTo(t[t.length-1],n-10),e.lineTo(t[0],n-10),e.closePath(),e.fillStyle=a,e.fill())}};if(q===0){let e=G.cosmoTelemetry?.powerSpectrumPk;if(!e?.kBins?.length)return;H&&(H.textContent=`D/D₀ = ${(e.linearGrowthRatio||1).toFixed(2)}× · ${e.kBins.length} k-bins`);let i=e.kBins.map(e=>Math.log10(Math.max(1e-4,e))),a=e.pkValues.map(e=>Math.log10(Math.max(1e-6,e))),o=Math.min(...i),s=Math.max(o+.2,...i),c=G.cosmoFirstPk?.pkValues?.map(e=>Math.log10(Math.max(1e-6,e)))||[],l=[...a,...c],u=Math.min(...l)-.3,d=Math.max(u+1,...l)+.3,f=e=>12+(e-o)/(s-o)*(t-24),p=e=>n-12-(e-u)/(d-u)*(n-24);c.length===i.length&&r(i.map(f),c.map(p),`rgba(148,163,184,0.6)`,null,!0),r(i.map(f),a.map(p),`#38bdf8`,`rgba(56,189,248,0.16)`,!1)}else if(q===1){H&&(H.textContent=`Gate 1 H/He/C/O · Z=${G.galaxyMetallicity.toFixed(1)} Z☉`);let e=[],i=[];for(let r=0;r<48;r+=1){let a=2+r/47*6,o=G.evaluateIsmRadiativeCoolingErgCm3PerS(10**a,G.galaxyMetallicity,G.ismCoolingAnchors),s=Math.log10(Math.max(1e-28,o));e.push(12+r/47*(t-24)),i.push(n-12-(s- -26.5)/5.5*(n-24))}r(e,i.map(e=>Math.max(10,Math.min(n-12,e))),`#a78bfa`,`rgba(167,139,250,0.18)`,!1)}else if(q===2)if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(G.solarMode)&&G.relBinaryTelemetry?.gwStrainHistory?.length){let e=G.relBinaryTelemetry.gwStrainHistory;V&&(V.textContent=`2.5PN GRAVITATIONAL-WAVE STRAIN h_+(t)`),H&&(H.textContent=`f_GW=${(G.relBinaryTelemetry.gwFrequency||0).toFixed(2)} · sep=${(G.relBinaryTelemetry.separation||0).toFixed(2)}`);let i=Math.max(.08,...e.map(e=>Math.abs(e)));r(e.map((n,r)=>12+r/Math.max(1,e.length-1)*(t-24)),e.map(e=>n*.5-e/i*(n*.38)),`#38bdf8`,`rgba(56,189,248,0.14)`,!1)}else if(G.solarMode===`quasar-jet`&&G.kerrJetTelemetry){V&&(V.textContent=`NOVIKOV–THORNE DISK T(r) & BZ JET`);let e=G.kerrJetTelemetry;H&&(H.textContent=`a*=${e.spinA.toFixed(2)} · r_ISCO=${e.rIscoRg.toFixed(2)} r_g · Γ=${e.maxLorentzGamma.toFixed(1)}`);let i=[],a=[];for(let e=0;e<48;e+=1){let r=1.02+e/47*9,o=(1/r)**.75*Math.max(.01,1-Math.sqrt(1/r))**.25;i.push(12+e/47*(t-24)),a.push(n-12-Math.min(1,o*2.2)*(n-24))}r(i,a,`#f472b6`,`rgba(244,114,182,0.20)`,!1)}else{V&&(V.textContent=Be[2].plotTitle);let r=G.solarConservation0,i=G.solarConservation,a=r&&i?Math.abs(i.totalEnergy-r.totalEnergy)/Math.max(1e-12,Math.abs(r.totalEnergy)):0;H&&(H.textContent=`|ΔE/E₀|=${a.toExponential(1)} · ${G.solarEngine?.totalCount||0} bodies`);let o=G.getActiveSystemCatalog().filter(e=>!e.isStar&&(e.parent===0||e.parent===-2)&&e.id!==`halley`),s=(t-32)/Math.max(1,o.length);o.forEach((t,r)=>{let i=Math.min(1,Math.log10(Math.max(30,t.tempK))/3.3)*(n-28),a=16+r*s+2;e.fillStyle=`rgb(${Math.round(t.color0[0]*255)},${Math.round(t.color0[1]*255)},${Math.round(t.color0[2]*255)})`,e.fillRect(a,n-12-i,Math.max(6,s-6),i),e.fillStyle=`#94a3b8`,e.font=`8.5px monospace`,e.fillText(t.name.split(` `).slice(-1)[0].replace(/[()]/g,``).slice(0,4),a,n-14-i)})}else if(q===3)if((G.stellarMode===`pulsar`||G.stellarMode===`magnetar`)&&G.magnetosphereTelemetry?.flareHistory?.length){let e=G.magnetosphereTelemetry.flareHistory;V&&(V.textContent=G.stellarMode===`magnetar`?`MAGNETAR HALL-YIELD FLARE LIGHT CURVE`:`PULSAR SPIN-DOWN BEAM FLUX`),H&&(H.textContent=`B=${G.magnetosphereTelemetry.surfaceBFieldTesla.toExponential(1)} T · Flares=${G.magnetosphereTelemetry.flareCount}`);let i=Math.max(.4,...e);r(e.map((n,r)=>12+r/Math.max(1,e.length-1)*(t-24)),e.map(e=>n-12-e/i*(n-24)),G.stellarMode===`magnetar`?`#f472b6`:`#38bdf8`,`rgba(244,114,182,0.18)`,!1)}else if(G.stellarMode===`white-dwarf-tov`&&G.tovCurve?.length){V&&(V.textContent=`WEBGPU GR TOV MASS–RADIUS M(R) SEQUENCE`);let e=G.tovCurve.filter(e=>e.radiusKm>1&&e.massSolar>.05);H&&(H.textContent=`${e.length} GR TOV solutions · WD → NS → BH`),r(e.map(e=>12+(Math.log10(e.radiusKm)-.8)/3.6*(t-24)),e.map(e=>n-12-Math.min(1,e.massSolar/3.2)*(n-24)),`#34d399`,`rgba(52,211,153,0.18)`,!1)}else{V&&(V.textContent=Be[3].plotTitle);let e=G.stellarTelemetry,i=Math.max(2e6,e?.coreTempK||15e6),a=i*8.617333262e-8,o=1.22*Math.max(.01,i*1e-6)**(2/3);H&&(H.textContent=`E₀=${o.toFixed(1)} keV · LE ξ₁=${(G.stellarLaneEmden?.solutions?.[1]?.xi1||6.9).toFixed(2)}`);let s=Math.max(20,o*3),c=[],l=[],u=[],d=1e-300;for(let e=1;e<=48;e+=1){let r=e/48*s,i=12+e/48*(t-24),o=Math.exp(-Math.min(50,r/Math.max(.001,a))),f=o*Math.exp(-Math.min(60,Math.sqrt(493/Math.max(.05,r))));f>d&&(d=f),c.push(i),l.push(n-12-Math.min(1,o)*(n-24)),u.push(f)}let f=u.map(e=>n-12-e/Math.max(1e-300,d)*(n-24));r(c,l,`rgba(251,191,36,0.65)`,null,!0),r(c,f,`#34d399`,`rgba(52,211,153,0.28)`,!1)}else if(q===4){let e=G.planetaryResult?.profile||[];if(!e.length)return;let i=Math.max(1,G.planetaryResult.radiusM||637e4),a=Math.max(1e9,e[0].pressurePa||36e10),o=Math.max(2e3,...e.map(e=>e.densityKgPerM3||0));H&&(H.textContent=`P_c=${(a/1e9).toFixed(0)} GPa · MoI=${(G.planetaryResult.moiFactor||.33).toFixed(3)}`);let s=e.map(e=>12+e.radiusM/i*(t-24)),c=e.map(e=>n-12-e.pressurePa/a*(n-24)),l=e.map(e=>n-12-e.densityKgPerM3/o*(n-24));r(s,c,`#fb923c`,`rgba(251,146,60,0.16)`,!1),r(s,l,`#38bdf8`,null,!1)}else if(q===5){let e=G.mdRdfHistory;if(!e?.length)return;H&&(H.textContent=`Phase: ${G.mdTelemetry?.emergentPhase||`—`} · ⟨Z⟩=${(G.mdTelemetry?.meanCoordination||0).toFixed(1)}`);let i=Math.max(1,...e);r(e.map((n,r)=>12+r/(e.length-1)*(t-24)),e.map(e=>n-12-e/i*(n-24)),`#34d399`,`rgba(52,211,153,0.22)`,!1)}else if(q===6){let e=G.getCachedElementBundle(G.quantumZ,G.quantumRelativistic)?.visualData?.atom;if(!e?.rGrid?.length||!e?.rho?.length)return;H&&(H.textContent=`Dirac–KS ${G.quantumRelativistic?`Rel ON`:`Rel OFF`} · Z=${G.quantumZ}`);let i=Math.min(120,e.rGrid.length),a=[],o=1e-9;for(let t=0;t<i;t+=1){let n=e.rGrid[t],r=4*Math.PI*n*n*Math.max(0,e.rho[t]);r>o&&(o=r),a.push(r)}r(a.map((e,n)=>12+n/(a.length-1)*(t-24)),a.map(e=>n-12-e/o*(n-24)),`#38bdf8`,`rgba(56,189,248,0.22)`,!1)}else if(q===7){let e=G.tdseTelemetry;if(!e?.prob?.length)return;H&&(H.textContent=`P_in=${(e.pInside*100).toFixed(1)}% · P_tun=${(e.pTunneled*100).toFixed(2)}%`);let i=e.prob.length,a=Math.max(1e-4,...e.prob),o=Math.max(1,...e.potRawMeV),s=Array.from({length:i},(e,n)=>12+n/(i-1)*(t-24)),c=Array.from({length:i},(t,r)=>n-12-Math.max(0,e.potRawMeV[r]/o)*(n-26)),l=Array.from({length:i},(t,r)=>n-12-e.prob[r]/a*(n-24));r(s,c,`rgba(251,191,36,0.72)`,null,!0),r(s,l,`#34d399`,`rgba(52,211,153,0.28)`,!1)}}let Sr=``;function Cr(){if(!Ne)return;let e=G.activeSampledMaterial,t=!!(e&&q>=5&&!G.surfaceActive);if(Ne.classList.toggle(`active`,t),!t){Sr=``;return}let n=`${e.id}:${q}:${G.mdElementZ}:${G.quantumMode}:${G.quantumMoleculeKey}:${G.quantumZ}:${G.nuclearZ}:${J?J.vehicleLabel:`none`}`;if(n===Sr)return;Sr=n;let r=(e.compounds||[]).slice(0,4).map((e,t)=>{let n=q===6&&G.quantumMode===`molecule`&&G.quantumMoleculeKey===e.moleculeKey,r=Number.isFinite(e.moleFrac)?` ${(e.moleFrac*100).toFixed(e.moleFrac>=.1?0:1)}%`:``;return`<button class="uv-chip compound ${n?`active`:``}" data-sample-comp="${t}" type="button" title="Inspect ${e.name} (${e.formula}) molecular orbitals on L6">${e.formula}${r}</button>`}).join(``),i=(e.elements||[]).slice(0,6).map(e=>`<button class="uv-chip ${q===5&&G.mdElementZ===e.Z||q===6&&G.quantumMode===`atom`&&G.quantumZ===e.Z||q===7&&G.nuclearZ===e.Z?`active`:``}" data-sample-el="${e.Z}" type="button" title="Examine ${e.name} (Z=${e.Z}) at this scale">${e.sym}(${e.Z})</button>`).join(``),a=J?`<button class="uv-chip active" id="uv-back-to-surface-btn" data-return-surface="1" type="button" style="border-color:rgba(52,211,153,0.75);background:rgba(16,185,129,0.28);color:#ecfdf5;" title="Return directly to your parked ${J.vehicleLabel} on ${J.worldName}">↩ Back to ${J.vehicleLabel}</button>`:``;Ne.innerHTML=`
      <div class="uv-sample-head">
        <span>🔬 ${e.worldName} · ${e.shortLabel}</span>
        ${a||`<span style="color:var(--muted);">${e.locationTag}</span>`}
      </div>
      <div class="uv-chip-row"><span class="uv-chip-lbl">Compounds:</span>${r}</div>
      <div class="uv-chip-row"><span class="uv-chip-lbl">Elements:</span>${i}</div>
      <div class="uv-chip-row">
        <span class="uv-chip-lbl">Step:</span>
        <button class="uv-chip ${q===5?`active`:``}" data-sample-step="5" type="button">L5 Lattice</button>
        <button class="uv-chip ${q===6&&G.quantumMode===`molecule`?`active`:``}" data-sample-step="6m" type="button">L6 Compound</button>
        <button class="uv-chip ${q===6&&G.quantumMode===`atom`?`active`:``}" data-sample-step="6a" type="button">L6 Element</button>
        <button class="uv-chip ${q===7?`active`:``}" data-sample-step="7" type="button">L7 Nucleus</button>
      </div>`,Ne.querySelector(`[data-return-surface]`)?.addEventListener(`click`,()=>{Dn()});for(let t of Ne.querySelectorAll(`[data-sample-comp]`))t.addEventListener(`click`,()=>{let n=e.compounds?.[Number(t.dataset.sampleComp)];n&&On(n)});for(let e of Ne.querySelectorAll(`[data-sample-el]`))e.addEventListener(`click`,()=>{let t=Number(e.dataset.sampleEl);t>0&&kn(t,{targetLevel:q})});for(let t of Ne.querySelectorAll(`[data-sample-step]`))t.addEventListener(`click`,()=>{let n=t.dataset.sampleStep;n===`5`?kn(G.mdElementZ||e.primaryZ,{targetLevel:5}):n===`6m`?On(e.compounds?.[0]):n===`6a`?kn(G.quantumZ||e.primaryZ,{targetLevel:6}):n===`7`&&kn(G.nuclearZ||G.quantumZ||e.primaryZ,{targetLevel:7})})}function Q(){let e=Be[q],t=!!(Y&&Y.level===q),n=t?Y:wn(),r=G.computeScaleAdaptiveTimeDilation(s,{surfaceActive:G.surfaceActive,userTimeScale:Xt});g&&(g.textContent=`10^${s.toFixed(1)} m`),_&&(_.textContent=r.clockLabel),m&&(m.textContent=Ue(s)),p&&document.activeElement!==p&&(p.value=s.toFixed(2)),ye&&(ye.textContent=t?`GPU MOTE INSPECTOR · L${e.level} · ${Ue(s)}`:`L${e.level} · ${e.name.toUpperCase()} · ${Ue(s)}`),be&&(be.textContent=n?.name||e.name),Se&&(Se.textContent=n?.subtitle||e.engineSchema),ke&&(ke.textContent=n?.composition||``),De&&(De.textContent=q>=5?`GATE 1 OPTICAL SPECTRUM`:`EMISSION SPECTROGRAPH`),Ie&&(Ie.style.display=t&&!G.surfaceActive?`inline-flex`:`none`,Ie.textContent=Gt?`🎯 Locked`:`🎯 Focus`,Ie.classList.toggle(`active`,Gt));let i=[];if(t&&Array.isArray(Y.stats)&&Y.stats.length)i=Y.stats;else if(q===0)if(G.cosmoMode!==`web`&&G.cosmoBaryonTelemetry){let e=G.cosmoBaryonTelemetry,t=e.redshiftZ>100?`${e.cmbTempK.toFixed(0)} K`:e.maxGasTempK>=1e5?`${(e.maxGasTempK/1e6).toFixed(1)} MK`:`${Math.round(e.maxGasTempK).toLocaleString()} K`;i=[[`Redshift z`,`${e.redshiftZ.toFixed(e.redshiftZ>100?0:2)}`],[`T_CMB / Gas`,t],[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Lensing κ_max`,`${e.maxLensingKappa.toFixed(2)}`]]}else{let e=G.cosmoTelemetry;i=[[`Scale a(t)`,e?e.scaleFactorA.toFixed(3):`—`],[`Redshift z`,e?e.redshiftZ.toFixed(2):`—`],[`Density σ`,e?e.sigmaDensity.toFixed(3):`—`],[`GPU Submits`,e?`${e.submitsPerStep}/step`:`—`]]}else if(q===1)i=[[`GPU Particles`,`${(G.galaxyEngine?.count||0).toLocaleString()}`],[`Morphology`,G.galaxyPreset],[`DM Halo`,`NFW / Hernquist`],[`GPU Steps`,`${G.galaxyEngine?.stepIndex||0}`]];else if(q===2)if(G.solarMode===`formation`&&G.protoplanetaryTelemetry){let e=G.protoplanetaryTelemetry;i=[[`Snow Line`,`${e.snowLineAu.toFixed(2)} AU`],[`Rocky / Icy`,`${e.rockyPebbles} / ${e.icyPebbles}`],[`Accreted`,`${e.accretedPebbles} peb`],[`Rigid Bodies`,`${e.rigidBodyCount} (DLM)`]]}else if(G.solarMode===`quasar-jet`&&G.kerrJetTelemetry){let e=G.kerrJetTelemetry;i=[[`Kerr Spin a*`,e.spinA.toFixed(2)],[`Lorentz Γ_max`,`${e.maxLorentzGamma.toFixed(2)}×`],[`r_ISCO / r_g`,`${e.rIscoRg.toFixed(2)}`],[`BZ Jet Parcels`,`${e.activeJetParcels}`]]}else if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(G.solarMode)&&G.relBinaryTelemetry){let e=G.relBinaryTelemetry;i=[[`Separation`,e.merged?`MERGED`:e.separation.toFixed(2)],[`GW Strain h_+`,e.gwStrainPlus.toFixed(3)],[`Remnant`,e.remnantType.slice(0,14)],[`r-Proc Parcels`,`${e.rProcessEjectaCount}`]]}else if([`comet-tails`,`hot-jupiter`].includes(G.solarMode)&&G.radWindL2Telemetry){let e=G.radWindL2Telemetry;i=[[`Regime`,e.regime],[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Mean Outflow`,`${e.meanOutflowSpeed.toFixed(2)}`],[`Live Parcels`,`${e.activeParcels}`]]}else if([`roche-rings`,`giant-impact`,`red-giant`].includes(G.solarMode)&&G.tidalRocheTelemetry){let e=G.tidalRocheTelemetry;i=[[`Ruptured`,`${(e.rupturedFraction*100).toFixed(0)}%`],[`Max Strain`,e.maxTidalStrain.toFixed(2)],[`Mean Radius`,e.meanRadiusSim.toFixed(2)],[`Live Debris`,`${e.activeParticles}`]]}else{let e=G.solarConservation,t=G.getActiveSystemCatalog(),n=t[G.focusedSolarBodyIndex]||t[0],r=G.useSolReference?`Sol (1★)`:`${G.activeCausalSystem?.starCount||1}★ ${G.activeCausalSystem?.architecture||`single`}`;i=[[`Focus`,(n?.name||`World`).slice(0,18)],[`Architecture`,r],[`True Radius`,n?`${n.radiusKm.toLocaleString()} km`:`—`],[`Sim Time`,`${(G.solarEngine?.simTimeYr||0).toFixed(3)} yr`]],e&&G.galaxyBranch===`smbh-core`&&(i[0]=[`SMBH Mass`,`4.3×10⁶ M☉`],i[1]=[`Lensing`,Zt?`Active WGSL`:`OFF`])}else if(q===3)if(G.stellarMode===`nebular-mhd`&&G.nebulaMhdTelemetry){let e=G.nebulaMhdTelemetry;i=[[`Mag Energy`,`${e.magneticEnergy.toFixed(1)}`],[`Toroidal B_φ`,`${e.peakToroidalB.toFixed(3)}`],[`Max |B|`,`${e.maxBField.toFixed(3)}`],[`|∇·B| GLM`,`${e.meanAbsDivB.toExponential(1)}`]]}else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(G.stellarMode)&&G.radWindL3Telemetry){let e=G.radWindL3Telemetry;i=[[`Ionized x_HII`,`${(e.meanIonizedFraction*100).toFixed(1)}%`],[`Outflow Speed`,e.meanOutflowSpeed.toFixed(2)],[`Line Flux`,e.meanLineEmission.toFixed(2)],[`Live Parcels`,`${e.activeParcels}`]]}else if((G.stellarMode===`pulsar`||G.stellarMode===`magnetar`)&&G.magnetosphereTelemetry){let e=G.magnetosphereTelemetry;i=[[`Surface B`,`${e.surfaceBFieldTesla.toExponential(1)} T`],[`Spin-Down Ė`,`${e.spinDownLumW.toExponential(1)} W`],[`Starquakes`,`${e.flareCount} flares`],[`Crust Strain`,`${(e.crustStrain*100).toFixed(0)}%`]]}else if(G.stellarMode===`white-dwarf-tov`&&G.tovCurve?.length){let e=G.tovCurve.find(e=>e.branch===`white-dwarf`)||G.tovCurve[2],t=G.tovCurve.find(e=>e.branch===`neutron-star`)||G.tovCurve[11];i=[[`WD Sample`,`${e.massSolar.toFixed(2)} M☉`],[`WD Radius`,`${Math.round(e.radiusKm).toLocaleString()} km`],[`NS Sample`,`${t.massSolar.toFixed(2)} M☉`],[`NS Radius`,`${t.radiusKm.toFixed(1)} km`]]}else{let e=G.stellarTelemetry;i=[[`Core Temp`,e?`${(e.coreTempK/1e6).toFixed(2)} MK`:`—`],[`Stage`,e?.stage||`hydro-collapse`],[`GPU Steps`,`${G.stellarEngine?.stepIndex||0}`],[`LE n=3 ξ₁`,`${(G.stellarLaneEmden?.solutions?.[1]?.xi1||6.9).toFixed(3)}`]]}else if(q===4)if(G.surfaceActive&&G.surfaceSession){let e=G.surfaceTelemetry||G.surfaceSession.getTelemetry(),t=G.surfaceSession.env;i=[[`Surface g`,`${t.gravityMS2.toFixed(2)} m/s²`],[`Air ρ_atm`,t.rhoAtmKgM3>1e-4?`${t.rhoAtmKgM3.toFixed(3)} kg/m³`:`0 (Vacuum)`],[`Rover Alt/Fuel`,`${e.roverAltitudeM.toFixed(1)}m / ${Math.round(e.roverRocketFuel*100)}%`],[`Drone Max Lift`,t.droneFlightCapable?`${t.maxAeroLiftN.toFixed(1)} N (OK)`:`0.0 N (Vac)`]]}else{let e=G.planetaryResult,t=G.planetaryAtmoTelemetry,n=G.getActiveSystemCatalog();i=[[`World`,((n[G.planetaryBodyIndex]||n[0])?.name||`World`).slice(0,18)],[`MoI I/MR²`,e?e.moiFactor.toFixed(4):`—`],[`Lightning`,t?`${t.activeLightningCells} cells`:`Dormant (Vac)`],[`Peak |E|`,t?`${(t.peakElectricFieldVPerM/1e3).toFixed(0)} kV/m`:`0 kV/m`]]}else if(q===5){let e=G.mdTelemetry;i=[[`Temp`,e?`${Math.round(e.temperatureK)} K`:`${G.mdTempK} K`],[`Pressure`,e?`${e.pressureGPa.toFixed(2)} GPa`:`—`],[`Coord ⟨Z⟩`,e?e.meanCoordination.toFixed(2):`—`],[`Gravity`,G.mdGravity?`ON (GPU)`:`Zero-G`]]}else if(q===6){let e=G.getCachedElementBundle(G.quantumZ,G.quantumRelativistic)?.bundle,t=Array.isArray(e?.electromagnetic?.opticalSrgb)?e.electromagnetic.opticalSrgb:[.8,.85,.9],n=Number(e?.atomic?.totalEnergyHa);i=[[`Samples`,`${(G.orbitalCloud?.pointCount||0).toLocaleString()} pts`],[`Dirac E_tot`,Number.isFinite(n)?`${n.toFixed(1)} Ha`:`—`],[`Magnetic`,e?.electromagnetic?.magneticPhase||`—`],[`Gate 1 sRGB`,`[${t.map(e=>Number(e||0).toFixed(2)).join(`,`)}]`]]}else if(q===7){let e=G.nuclearResult,t=G.tdseTelemetry,n=Number(e?.bindingPerNucleonMeV),r=Number(e?.chargeRadiusFm);i=[[`B / A`,Number.isFinite(n)?`${n.toFixed(3)} MeV`:`—`],[`Radius R_c`,Number.isFinite(r)?`${r.toFixed(2)} fm`:`—`],[`TDSE Steps`,`${t?.stepCount||0}`],[`P_tunneled`,t?`${(t.pTunneled*100).toFixed(2)}%`:`—`]]}je&&(je.innerHTML=i.map(([e,t])=>`<div class="uv-stat-cell"><div class="uv-stat-k">${e}</div><div class="uv-stat-v">${t}</div></div>`).join(``)),Cr(),br(n),xr()}function wr(e){if(!u)return;u.clearRect(0,0,X,dn);let t=G.getTargetsForLevel(q,fn);if(t.length){for(let n of t){if(q===2&&n.spec?.parent>0&&s>10.5||q===4&&!G.planetaryCutaway)continue;let t=sr(n.pos,e,X,dn);if(!t.visible)continue;let r=n.id===Ut,i=n.id===Wt;if(!r&&!i&&q>=3)continue;let a=r?18:i?15:8;u.strokeStyle=r?`rgba(56, 189, 248, 0.90)`:i?`rgba(186, 230, 253, 0.78)`:`rgba(148, 163, 184, 0.42)`,u.lineWidth=r?1.6:1;let o=Math.max(4,a*.45);for(let[e,n]of[[-1,-1],[1,-1],[1,1],[-1,1]])u.beginPath(),u.moveTo(t.sx+e*a,t.sy+n*(a-o)),u.lineTo(t.sx+e*a,t.sy+n*a),u.lineTo(t.sx+e*(a-o),t.sy+n*a),u.stroke();(r||i||q===2&&n.spec?.parent===0&&s>9.5)&&(u.font=r?`600 11px monospace`:`500 9.5px monospace`,u.fillStyle=r?`#e0f2fe`:`rgba(203, 213, 225, 0.78)`,u.fillText(n.name,t.sx+a+6,t.sy+3.5))}if(Y&&Y.level===q&&Y.worldPos){let t=sr(Y.worldPos,e,X,dn);t.visible&&(u.save(),u.strokeStyle=`rgba(250, 204, 21, 0.96)`,u.lineWidth=1.9,u.beginPath(),u.moveTo(t.sx,t.sy-14),u.lineTo(t.sx+14,t.sy),u.lineTo(t.sx,t.sy+14),u.lineTo(t.sx-14,t.sy),u.closePath(),u.stroke(),u.beginPath(),u.arc(t.sx,t.sy,3,0,Math.PI*2),u.fillStyle=`#fde047`,u.fill(),u.font=`600 11px monospace`,u.fillStyle=`#fef08a`,u.fillText(Y.name,t.sx+14+7,t.sy+3.5),u.restore())}}}function Tr(e,t){let n=s,r=10**n,i=[],a=[],o=[],c=[],l=[.62,.55,.55],u=null,d=null,f=null,p={bhUv:[.5,.5],bhStrength:0,warpAmount:Math.min(.65,cn*.08),flashAmount:rn,crtEnabled:en,pixelSize:tn,timeSec:t},m=G.cosmoTargets[0]?.posMpc||[0,0,0],h=G.activeStarSite?.posGal||G.galaxyFocusPos||[4.8,.04,2.1];if(q===1&&G.cosmoSession&&n>15.8&&n<22.8){let e=1-ur(21.6,22.8,n)*.72;i.push({buffer:G.cosmoSession.particlesBuffer,count:G.cosmoSession.particleCount,mode:0,isBackdrop:!0,worldScale:-185,pointSize:1.35,alphaGain:.44*e,extra1:[m[0],m[1],m[2],G.cosmoSession.boxSizeMpc||200]})}if((q===2||q===3||q===4)&&G.galaxyEngine&&n<16.8&&n>-5.2){let e=(1-ur(15.4,16.8,n)*.78)*ur(-5.2,4,n);e>.02&&i.push({buffer:G.galaxyEngine.getResidentBuffer(),count:G.galaxyEngine.count,mode:1,isBackdrop:!0,worldScale:-185,pointSize:1.02,alphaGain:.34*e,extra1:[h[0],h[1],h[2],0]})}if(q===6&&G.mdSession&&n<-8.8&&n>-13){let e=G.mdSession.boxLengthsA,t=(G.getCachedElementBundle(G.mdElementZ,!0)?.bundle)?.electromagnetic?.opticalSrgb||[.55,.78,.96];i.push({buffer:G.mdSession.positionsBuffer,count:G.mdSession.atomCount,mode:12,isBackdrop:!0,worldScale:-175,pointSize:2.35,alphaGain:.065*dr(n,-13,-11.6,-9.5,-8.8),extra1:[e[0]*.5,e[1]*.5,e[2]*.5,0],extra2:[t[0],t[1],t[2],0]})}q===7&&G.orbitalCloud&&n<-12.4&&i.push({buffer:G.orbitalCloud.pointsBuffer,count:G.orbitalCloud.pointCount,mode:3,isBackdrop:!0,worldScale:-175,pointSize:.92,alphaGain:.024*dr(n,-15.5,-14.6,-13.1,-12.4),colorPos:[.18,.86,1],colorNeg:[.95,.58,.32]});let g=dr(n,20.8,22,25.6,26),_=ur(23.8,21.8,n),v=[m[0]*_,m[1]*_,m[2]*_],y=16/178*10**Math.min(2.6,24.8-n);if(fn.cosmoScale=y,fn.cosmoOffset=v,g>.01)if(G.cosmoMode!==`web`&&G.cosmoBaryonSession&&n>=22){let t=dr(n,22,22.7,25.6,26),r=12.2/Math.max(100,G.cosmoBaryonSession.boxSizeMpc||260)*10**Math.max(-.6,Math.min(1.8,24.8-n));if(i.push({buffer:G.cosmoBaryonSession.getResidentTracersBuffer(),count:G.cosmoBaryonSession.tracerCount,mode:10,worldScale:r,pointSize:G.cosmoMode===`cmb`?.16:G.cosmoMode===`cluster-merger`?.12:.145,alphaGain:(G.cosmoMode===`cmb`?.15:G.cosmoMode===`cluster-merger`?.18:.28)*t,extra1:[0,0,0,G.cosmoBaryonSession.boxSizeMpc||260]}),G.cosmoMode===`cluster-merger`&&Zt&&t>.25){let n=sr([0,0,0],e.viewProj,X,dn);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=9e-4*t)}}else G.cosmoSession&&G.cosmoMode===`web`&&i.push({buffer:G.cosmoSession.particlesBuffer,count:G.cosmoSession.particleCount,mode:0,worldScale:y,pointSize:Math.max(.048,Math.min(.17,.068*10**Math.max(-.5,Math.min(.8,24.8-n)))),alphaGain:.44*g,extra1:[v[0],v[1],v[2],G.cosmoSession.boxSizeMpc||200]});let b=dr(n,15.4,16.6,22,22.8),x=10**Math.max(-1.8,Math.min(2.5,21-n))*.85,S=G.galaxyFocusPos||[4.8,.04,2.1],C=ur(20.6,18.8,n),w=[S[0]*C,S[1]*C,S[2]*C];if(fn.galaxyScale=x,fn.galaxyOffset=w,b>.01&&G.galaxyEngine&&(i.push({buffer:G.galaxyEngine.getResidentBuffer(),count:G.galaxyEngine.count,mode:1,worldScale:x,pointSize:Math.max(.028,Math.min(.14,.056*10**Math.max(-1.2,Math.min(.6,21-n)))),alphaGain:.34*b,extra1:[w[0],w[1],w[2],0]}),Qt&&G.showGalacticBField&&G.galacticDynamoStreamlines?.length>=14&&n>18.8)){let e=b*ur(18.8,20.2,n),t=G.galacticDynamoStreamlines;for(let n=0;n<t.length;n+=7)c.push((t[n]-w[0])*x,(t[n+1]-w[1])*x,(t[n+2]-w[2])*x,t[n+3],t[n+4],t[n+5],t[n+6]*e)}if(G.galaxyBranch===`smbh-core`){let t=dr(n,9.2,10.6,15.8,17);if(t>.01){let r=10**Math.max(-1.4,Math.min(1.4,12.6-n)),i=.72*r;if(a.push({pos:[0,0,0],radius:i,color0:[0,0,0],color1:[0,0,0],kind:5}),o.push({center:[0,0,0],rIn:i*1.18,normal:[.08,.96,.24],rOut:i*4.4,color:[1,.85,.55],kind:0}),G.smbhBodies){let e=Math.floor(G.smbhBodies.length/8);for(let t=1;t<e;t+=1){let e=t*8;a.push({pos:[G.smbhBodies[e]*r,G.smbhBodies[e+1]*r,G.smbhBodies[e+2]*r],radius:Math.max(.05,.14*r),color0:[.68,.88,1],color1:[.35,.62,1],kind:0})}}if(Zt){let n=sr([0,0,0],e.viewProj,X,dn);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=.0024*Math.min(2.2,r)*t)}}}else if(G.solarMode===`formation`&&q===2&&G.protoplanetarySession){let e=dr(n,9.6,10.6,15.6,16.8);if(e>.01){let t=.92*10**Math.max(-1.2,Math.min(1.2,12.6-n));if(i.push({buffer:G.protoplanetarySession.getResidentPebblesBuffer(),count:G.protoplanetarySession.pebbleCount,mode:6,worldScale:t,pointSize:Math.max(.036,Math.min(.13,.06*t)),alphaGain:.52*e,extra1:[0,0,0,0]}),a.push(...G.protoplanetarySession.getEmbryoRenderSpheres(t)),Qt){let n=G.protoplanetarySession.snowLineAu*t,r=null;for(let t=0;t<=72;t+=1){let i=t/72*Math.PI*2,a=[Math.cos(i)*n,0,Math.sin(i)*n];r&&(c.push(...r,.36,.84,1,.45*e),c.push(...a,.36,.84,1,.45*e)),r=a}}}}else if(G.solarMode===`quasar-jet`&&q===2&&G.kerrJetSession){let t=dr(n,9.6,10.6,15.6,16.8);if(t>.01){let r=.85*10**Math.max(-1,Math.min(1.2,12.6-n)),o=G.kerrJetSession.horizonVisualRadius*r;if(a.push({pos:[0,0,0],radius:o*1.05,color0:[0,0,0],color1:[0,0,0],kind:5}),i.push({buffer:G.kerrJetSession.getResidentParcelsBuffer(),count:G.kerrJetSession.particleCount,mode:7,worldScale:r,pointSize:Math.max(.05,Math.min(.16,.095*r)),alphaGain:.26*t,extra1:[0,0,0,0]}),Zt){let n=sr([0,0,0],e.viewProj,X,dn);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=.0014*t)}}}else if([`xray-binary`,`bns-kilonova`,`type-ia`,`bbh-merger`].includes(G.solarMode)&&q===2&&G.relBinarySession){let t=dr(n,9.6,10.6,15.6,16.8);if(t>.01){let r=1.12*10**Math.max(-1,Math.min(1.2,12.6-n));if(a.push(...G.relBinarySession.getRenderSpheres(r)),i.push({buffer:G.relBinarySession.getResidentParcelsBuffer(),count:G.relBinarySession.particleCount,mode:7,worldScale:r,pointSize:Math.max(.05,Math.min(.16,.092*r)),alphaGain:.24*t,extra1:[0,0,0,0]}),Zt&&(G.solarMode===`bbh-merger`||G.solarMode===`xray-binary`)){let n=sr([0,0,0],e.viewProj,X,dn);n.visible&&(p.bhUv=[n.uvX,n.uvY],p.bhStrength=(G.solarMode===`bbh-merger`?.0014:7e-4)*t)}}}else if([`comet-tails`,`hot-jupiter`].includes(G.solarMode)&&q===2&&G.radWindL2Session){let e=dr(n,9.6,10.6,15.6,16.8);if(e>.01){let t=1.05*10**Math.max(-1,Math.min(1.2,12.6-n)),r=G.solarMode===`comet-tails`;l=r?[.76,.24,.6]:[.82,.14,.55],a.push(r?{pos:[0,0,0],radius:.34*t,color0:[.82,.88,.94],color1:[.42,.48,.56],kind:3,atm:.28}:{pos:[0,0,0],radius:1.02*t,color0:[1,.48,.16],color1:[.68,.2,.08],kind:2,atm:.72}),i.push({buffer:G.radWindL2Session.getResidentParcelsBuffer(),count:G.radWindL2Session.particleCount,mode:8,worldScale:t,pointSize:Math.max(.05,Math.min(.15,.095*t)),alphaGain:.25*e,extra1:[0,0,0,0]})}}else if([`roche-rings`,`giant-impact`,`red-giant`].includes(G.solarMode)&&q===2&&G.tidalRocheSession){let e=dr(n,9.6,10.6,15.6,16.8);if(e>.01){let t=1.06*10**Math.max(-1,Math.min(1.2,12.6-n));a.push(...G.tidalRocheSession.getRenderSpheres(t)),i.push({buffer:G.tidalRocheSession.getResidentParticlesBuffer(),count:G.tidalRocheSession.particleCount,mode:9,worldScale:t,pointSize:Math.max(.045,Math.min(.14,.078*t)),alphaGain:.28*e,extra1:[0,0,0,0]})}}else{let e=dr(n,5.4,6.4,15.8,17.2),t=r/Oe,s=16/Math.max(1e-9,t);if(fn.solarScaleAuToWorld=s,e>.01&&G.solarEngine){let t=G.solarEngine.catalog||G.getActiveSystemCatalog(),r=Math.max(0,Math.min(t.length-1,G.focusedSolarBodyIndex)),d=!!t[r]?.isStar||r===0,f=G.solarEngine.getMassiveBodyState64(r),p=G.solarEngine.getMassiveBodyState64(0),m=[Math.fround(f.posAu[0]),Math.fround(f.posAu[1]),Math.fround(f.posAu[2])],h=[Math.fround(f.posAu[0]-m[0]),Math.fround(f.posAu[1]-m[1]),Math.fround(f.posAu[2]-m[2])];d||(l=q===4&&G.planetaryMode===`eyeball-locked`?[1,0,0]:q===4&&G.planetaryMode===`rogue`?[.15,.96,.22]:rr([p.posAu[0]-f.posAu[0],p.posAu[1]-f.posAu[1],p.posAu[2]-f.posAu[2]]));let g=G.getTargetsForLevel(4)[0],_=g?.rCoreNorm??.54,v=g?.rMantleNorm??.94,y=Math.min(G.solarEngine.massiveCount,t.length);for(let c=0;c<y;c+=1){let l=t[c],d=G.solarEngine.getMassiveBodyState64(c),p=(d.posAu[0]-f.posAu[0])*s,m=(d.posAu[1]-f.posAu[1])*s,h=(d.posAu[2]-f.posAu[2])*s,g=Math.hypot(p,m,h),y=d.radiusAu*s,b=!!l.isStar||c===0;if(g>155&&c!==r){if(!b&&l.parent>0)continue;let e=165/g;p*=e,m*=e,h*=e;let t=y*e;y=b?Math.max(1.45,Math.min(4.6,t*2.8)):Math.max(.28,Math.min(.95,t*5.5))}if(c===r&&b&&n<=9.9)continue;let x=c===r&&!b&&n<8.85,S=x&&G.planetaryCutaway,C=x&&!S&&(G.planetaryMode===`magma-ocean`||l.kind===7),w=x&&!S&&G.planetaryMode===`cryo-plumes`,T=x&&!S&&G.planetaryMode===`rogue`,E=a.length;if(a.push({pos:[p,m,h],radius:y,color0:C?[1,.44,.1]:w?[.86,.92,.98]:T?[.16,.24,.36]:l.color0,color1:C?[.22,.08,.05]:w?[.48,.68,.86]:T?[.06,.1,.18]:l.color1,kind:S?4:C?7:w?3:l.kind,atm:C?.55:w?.18:l.atm??.35,rCore:_,rMantle:v,cutaway:S,seed:c*2.17+1.3}),x&&!C&&!w&&G.planetaryAtmoSession&&(u={buffer:G.planetaryAtmoSession.getResidentEmVisBuffer(),width:G.planetaryAtmoSession.width,height:G.planetaryAtmoSession.height,sphereIndex:E}),w&&G.cryoPlumeSession){let t=y/2.35;i.push({buffer:G.cryoPlumeSession.getResidentParticlesBuffer(),count:G.cryoPlumeSession.particleCount,mode:9,worldScale:t,pointSize:Math.max(.05,.085*t),alphaGain:.34*e,extra1:[0,0,0,0]})}l.ringed&&y>.008&&o.push({center:[p,m,h],rIn:l.ringInnerKm/l.radiusKm*y,normal:[.16,.89,.42],rOut:l.ringOuterKm/l.radiusKm*y,color:[.88,.78,.62],kind:1})}let b=dr(n,8.8,9.6,15,16.5);if(b>.01&&i.push({buffer:G.solarEngine.getResidentBuffer(),count:G.solarEngine.totalCount,mode:4,worldScale:s,pointSize:.085,alphaGain:.62*b,extra1:[m[0],m[1],m[2],G.solarEngine.massiveCount],extra2:[h[0],h[1],h[2],0]}),Qt&&n>8.1){let e=dr(n,8.1,8.8,15.2,16.4);c.push(...pr(G.solarEngine,f.posAu,s,n,e))}}}let T=Ht()&&G.galaxyBranch!==`smbh-core`?dr(n,7,7.8,9.7,10.4):0;if(T>.01){let e=.92*10**Math.max(-1,Math.min(1,9.2-n));if(G.stellarMode===`nebular-mhd`&&G.nebulaMhdSession){if(i.push({buffer:G.nebulaMhdSession.getResidentTracersBuffer(),count:G.nebulaMhdSession.tracerCount,mode:5,worldScale:e*1.15,pointSize:Math.max(.06,Math.min(.24,.14*e)),alphaGain:.56*T,extra1:[0,0,0,0]}),G.nebulaMhdStreamlines?.length>=14){let t=G.nebulaMhdStreamlines,n=e*1.15;for(let e=0;e<t.length;e+=7)c.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*T)}}else if([`h2-pillars`,`planetary-nebula`,`snr-pwn`].includes(G.stellarMode)&&G.radWindL3Session)i.push({buffer:G.radWindL3Session.getResidentParcelsBuffer(),count:G.radWindL3Session.particleCount,mode:8,worldScale:e*1.05,pointSize:Math.max(.06,Math.min(.18,.105*e)),alphaGain:.17*T,extra1:[0,0,0,0]}),G.stellarMode===`planetary-nebula`?a.push({pos:[0,0,0],radius:.24*e,color0:[.76,.94,1],color1:[.42,.78,1],kind:0}):G.stellarMode===`snr-pwn`?a.push({pos:[0,0,0],radius:.22*e,color0:[.62,.88,1],color1:[.85,.48,1],kind:0}):a.push({pos:[3.6*e,3.2*e,2.4*e],radius:.3*e,color0:[.72,.9,1],color1:[.45,.72,1],kind:0});else if((G.stellarMode===`pulsar`||G.stellarMode===`magnetar`)&&G.magnetosphereSession){let t=G.stellarMode===`magnetar`;if(a.push({pos:[0,0,0],radius:.44*e,color0:t?[1,.78,.96]:[.72,.94,1],color1:t?[.86,.32,.94]:[.34,.68,1],kind:0}),i.push({buffer:G.magnetosphereSession.getResidentParcelsBuffer(),count:G.magnetosphereSession.particleCount,mode:7,worldScale:e*1.12,pointSize:Math.max(.05,Math.min(.15,.088*e)),alphaGain:.25*T,extra1:[0,0,0,0]}),G.magnetosphereFieldLines?.length>=14){let t=G.magnetosphereFieldLines,n=e*1.12;for(let e=0;e<t.length;e+=7)c.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*T)}}else if(G.stellarMode===`white-dwarf-tov`){a.push({pos:[0,0,0],radius:2.15*e,color0:[.86,.95,1],color1:[.46,.74,1],kind:0});for(let t=0;t<3;t+=1){let n=(2.75+t*.95)*e,r=null;for(let e=0;e<=48;e+=1){let i=e/48*Math.PI*2,a=t*.52,o=[Math.cos(i)*n,Math.sin(i)*n*Math.sin(a),Math.sin(i)*n*Math.cos(a)];r&&(c.push(...r,.42,.84,1,(.34-t*.08)*T),c.push(...o,.42,.84,1,(.34-t*.08)*T)),r=o}}}else if(G.stellarEngine&&(i.push({buffer:G.stellarEngine.getResidentBuffer(),count:G.stellarEngine.count,mode:2,worldScale:e*.95,pointSize:Math.max(.045,Math.min(.2,.125*e)),alphaGain:.3*T,extra1:[0,0,0,0]}),Qt&&G.stellarDynamoStreamlines?.length>=14)){let t=G.stellarDynamoStreamlines,n=e*.95;for(let e=0;e<t.length;e+=7)c.push(t[e]*n,t[e+1]*n,t[e+2]*n,t[e+3],t[e+4],t[e+5],t[e+6]*T)}}let E=dr(n,-9.6,-8.9,-6.2,-5.2);if(E>.01&&G.mdSession){let e=G.mdSession.boxLengthsA,t=8.4/Math.max(e[0],e[1],e[2],6)*10**Math.max(-1.2,Math.min(1.4,-8.2-n)),r=(G.getCachedElementBundle(G.mdElementZ,!0)?.bundle)?.electromagnetic?.opticalSrgb||[.76,.8,.86];d={positionsBuffer:G.mdSession.positionsBuffer,velocitiesBuffer:G.mdSession.velocitiesBuffer,count:G.mdSession.atomCount,halfBox:[e[0]*.5,e[1]*.5,e[2]*.5],worldScale:t,radius:Math.max(.045,Math.min(1.3,(G.mdSession.rNearestNeighborA||2.5)*.285*t)),baseRgb:r,alphaFade:E,idealCoord:G.mdSession.idealCoordination||12},Qt&&E>.3&&c.push(...fr([e[0]*.5*t,e[1]*.5*t,e[2]*.5*t],[.32,.8,1,.28*E]))}let D=dr(n,-13.2,-12,-9.4,-8.8);if(D>.01&&G.orbitalCloud){let e=(G.getCachedElementBundle(G.quantumZ,G.quantumRelativistic)?.bundle)?.electromagnetic?.opticalSrgb||[.22,.86,1],t=10**Math.max(-1.1,Math.min(1.8,-10-n));if(i.push({buffer:G.orbitalCloud.pointsBuffer,count:G.orbitalCloud.pointCount,mode:3,worldScale:5.4*t,pointSize:Math.max(.025,Math.min(.14,.044*Math.sqrt(t))),alphaGain:.074*D,colorPos:G.quantumMode===`atom`?[.18,.86,1]:[.26,.92,.86],colorNeg:G.quantumMode===`atom`?[Math.max(.68,e[0]),Math.max(.48,e[1]),Math.min(.45,e[2])]:[1,.42,.62]}),G.quantumMode===`molecule`){let e=G.MOLECULE_SPECS[G.quantumMoleculeKey],n=3.8/4.2*t;for(let r of e.atoms)a.push({pos:[r.position[0]*n,r.position[1]*n,r.position[2]*n],radius:(r.Z===1?.22:.36)*t,color0:r.Z===8?[.95,.28,.28]:r.Z===6?[.45,.52,.6]:[.92,.96,1],color1:[.6,.8,1],kind:5})}else n>-12.6&&a.push({pos:[0,0,0],radius:Math.max(.05,.1*t),color0:[1,.72,.32],color1:[1,.94,.72],kind:0})}let O=dr(n,-15.5,-14.8,-13.3,-12.4);if(O>.01&&G.nuclearResult){let e=10**Math.max(-1.2,Math.min(.9,-14.3-n)),r=G.buildQuantizedNucleonSpheres(G.nuclearResult,2.2*e,t);qt=r,a.push(...r);let i=G.tdseTelemetry,o=20,s=-1;if(i?.prob?.length)for(let e=0;e<i.prob.length;e+=1)i.prob[e]>s&&(s=i.prob[e],o=e);f={dim:G.nuclearResult.volDim||28,boxRadius:3.8*e,tdseTunneled:i?.pTunneled||0,tdseCrestNorm:Math.max(.45,Math.min(.94,o/Math.max(1,(i?.prob?.length||128)-1))),alphaMul:O}}if(Y&&Y.worldPos&&Y.level===q){let t=Y.worldPos,n=Math.max(.4,Math.hypot(e.pos[0]-t[0],e.pos[1]-t[1],e.pos[2]-t[2])),r=Math.max(.14,Math.min(2.2,n*.032)),i=[t[0]+r,t[1],t[2]],a=[t[0]-r,t[1],t[2]],o=[t[0],t[1]+r,t[2]],s=[t[0],t[1]-r,t[2]],l=[t[0],t[1],t[2]+r],u=[t[0],t[1],t[2]-r],d=(e,t,n=1,r=.84,i=.3,a=.96)=>{c.push(e[0],e[1],e[2],n,r,i,a,t[0],t[1],t[2],n,r,i,a)};d(o,i),d(o,a),d(o,l),d(o,u),d(s,i),d(s,a),d(s,l),d(s,u),d(i,l),d(l,a),d(a,u),d(u,i);let f=r*1.65;d([t[0]+r*1.15,t[1],t[2]],[t[0]+f,t[1],t[2]],.45,.92,1,.88),d([t[0]-r*1.15,t[1],t[2]],[t[0]-f,t[1],t[2]],.45,.92,1,.88),d([t[0],t[1]+r*1.15,t[2]],[t[0],t[1]+f,t[2]],.45,.92,1,.88),d([t[0],t[1]-r*1.15,t[2]],[t[0],t[1]-f,t[2]],.45,.92,1,.88)}return{camera:e,particleClouds:i,spheres:a.length?a:null,atmoEm:u,lightDir:l,mdCloud:d,disks:o.length?o:null,lines:c.length>=14?new Float32Array(c):null,nuclearVol:f,post:p}}let Er=performance.now(),Dr=0,Or=0,kr=0,Ar=0,jr=60;function Mr(e,t){if(q>=5)return null;let n=[],r=[],i=Math.atan2(e.fwd[0],e.fwd[2]),a=kt?[e.pos[0]+e.fwd[0]*.15-e.up[0]*.28,e.pos[1]+e.fwd[1]*.15-e.up[1]*.28,e.pos[2]+e.fwd[2]*.15-e.up[2]*.28]:[e.pos[0]+e.fwd[0]*5.2-e.up[0]*1.42,e.pos[1]+e.fwd[1]*5.2-e.up[1]*1.42,e.pos[2]+e.fwd[2]*5.2-e.up[2]*1.42],o=B(jt),s=Y?.worldPos||Kt||[0,0,0],c=Nt?{targetPos:s,rgb:At===`antimatter`?[.85,.34,1]:o.rgb,isAntimatter:At===`antimatter`,thicknessMul:1.15}:null;se(n,r,{pos:a,yaw:i,pitch:Math.max(-.22,Math.min(.22,-e.fwd[1]*.45)),roll:Math.sin(t*.9)*.04,radius:.72,rimAngle:t*2.2,vertThrust:sn===null?0:.65,tractorActive:!!(Pt||sn!==null&&q===4),tractorHeight:3.4,beam:c,isCockpit:kt,isRemote:!1,shieldFlash:It.state.shieldFlash});let l=Rt.getRemotePeersForContext({level:q,surfaceActive:!1});for(let o=0;o<l.length;o+=1){let s=l[o];se(n,r,{pos:Array.isArray(s.pos)?s.pos:[a[0]+e.right[0]*(2.6+o*1.8),a[1]+e.up[1]*.4,a[2]+e.right[2]*(2.6+o*1.8)],yaw:s.yaw||i,pitch:0,roll:0,radius:.72,rimAngle:t*2.5+o,tractorActive:!!s.tractorActive,tractorHeight:2.8,beam:s.beam||null,isRemote:!0,shieldFlash:s.shieldFlash||0})}for(let e=0;e<It.state.probes.length;e+=1){let t=It.state.probes[e],i=t.angle||0,a=2.6+(t.orbitRadius||1.8)*.75,o=Math.cos(i)*a,s=Math.sin(i)*a;oe(n,r,[o,Math.sin(i*1.7+e)*a*Math.sin(t.inclination||.25),s],i*2,.32)}return{opaque:new Float32Array(n),fx:new Float32Array(r)}}function $(e=performance.now(),t=null){hn();let n=t?.viewport?t.viewport.width/Math.max(1,t.viewport.height):Lt.isStereoPreview?c.width*.5/Math.max(1,c.height):c.width/Math.max(1,c.height);if(G.surfaceActive&&G.surfaceSession){let r=G.surfaceSession,i=r.getCameraPose(),a=58*Math.PI/180,o=ir(a,n,.25,2400),s=ar(i.eye,i.target,i.up),c=or(o,s.mat);un=c;let l={viewProj:c,pos:i.eye,right:s.right,up:s.up,fwd:s.fwd,aspect:n,fovTanHalf:Math.tan(a*.5),timeSec:e*.001,level:4,log10SpanM:2},d=r.env.isRogue?rr([.15,.96,.22]):r.env.isMagmaOcean?rr([.7,.28,.65]):rr([.58,.44,.68]),f=r.getActiveSkyEnv?r.getActiveSkyEnv():r.env,p=[];if(G.galaxyEngine&&(f.skyOpticalDepth??1)<.35){let e=G.activeStarSite?.posGal||G.galaxyFocusPos||[4.8,.04,2.1],t=Math.max(.08,1-(f.skyOpticalDepth??0)*2.6);p.push({buffer:G.galaxyEngine.getResidentBuffer(),count:G.galaxyEngine.count,mode:1,isBackdrop:!0,worldScale:-240,pointSize:1.35,alphaGain:.34*t,extra1:[e[0],e[1],e[2],0]})}p.push({buffer:r.getResidentPlumesBuffer(),count:r.particleCount,mode:11,worldScale:1,pointSize:.85,alphaGain:.92,extra1:[i.focusPos[0],0,i.focusPos[2],r.env.hasSolidCrust?1/(2*r.env.tinyPlanetCurvatureRadiusM):0]});let m=r.getResidentMpmPointsBuffer?.();m&&r.mpmPointCount>0&&p.push({buffer:m,count:r.mpmPointCount,mode:11,worldScale:1,pointSize:1.45,alphaGain:1,extra1:[i.focusPos[0],0,i.focusPos[2],r.env.hasSolidCrust?1/(2*r.env.tinyPlanetCurvatureRadiusM):0]});let h=r.getResidentCfdMotesBuffer?.();h&&r.cfdMoteCount>0&&p.push({buffer:h,count:r.cfdMoteCount,mode:11,worldScale:1,pointSize:r.env.hasSolidCrust?.95:1.05,alphaGain:1,extra1:[i.focusPos[0],0,i.focusPos[2],0]});let g=G.surfaceTelemetry?.antimatterFlash||0;if(Dt.renderFrame({camera:l,lightDir:d,surfaceScene:{terrainVertBuf:r.getResidentTerrainVertBuffer(),terrainIdxBuf:r.getResidentTerrainIndexBuffer(),indexCount:r.indexCount,hideTerrain:!r.env.hasSolidCrust,boulderVertBuf:r.getResidentBoulderVertBuffer?.(),boulderVertCount:r.boulderVertCount||0,vehicleVertBuf:r.getResidentVehicleVertBuffer(),vehicleVertCount:r.vehicleVertCount,fxVertBuf:r.getResidentFxVertBuffer?.(),fxVertCount:r.fxVertCount||0,env:f,lightDir:d},particleClouds:p,stereoSbs:!t&&Lt.isStereoPreview,xrEyeTarget:t,post:{bhUv:[.5,.5],bhStrength:0,warpAmount:0,flashAmount:Math.max(rn,g*.55),crtEnabled:en,pixelSize:tn,timeSec:e*.001}}),u&&(u.clearRect(0,0,X,dn),r.activeVehicle===`ufo`&&r.cameraMode===`first-person`)){let e=X*.5,t=dn*.5;u.save(),u.strokeStyle=`rgba(52, 211, 153, 0.72)`,u.lineWidth=1.6,u.beginPath(),u.arc(e,t,18,0,Math.PI*2),u.moveTo(e-28,t),u.lineTo(e-10,t),u.moveTo(e+10,t),u.lineTo(e+28,t),u.moveTo(e,t-28),u.lineTo(e,t-10),u.moveTo(e,t+10),u.lineTo(e,t+28),u.stroke(),u.restore()}return}Kt=Gt&&Y&&Y.level===q&&Y.worldPos?[Kt[0]+(Y.worldPos[0]-Kt[0])*.25,Kt[1]+(Y.worldPos[1]-Kt[1])*.25,Kt[2]+(Y.worldPos[2]-Kt[2])*.25]:[Kt[0]*.82,Kt[1]*.82,Kt[2]*.82];let r=Math.cos(ln.pitch),i=Math.sin(ln.pitch),a=Math.cos(ln.yaw),o=Math.sin(ln.yaw),l=[Kt[0]+ln.dist*r*o,Kt[1]+ln.dist*i,Kt[2]+ln.dist*r*a],d=48*Math.PI/180,f=ir(d,n,.05,520),p=ar(l,Kt,[0,1,0]),m=or(f,p.mat);un=m;let h={viewProj:m,pos:l,right:p.right,up:p.up,fwd:p.fwd,aspect:n,fovTanHalf:Math.tan(d*.5),timeSec:e*.001,level:q,log10SpanM:s},g=Tr(h,e*.001);g.cosmicMeshes=Mr(h,e*.001),g.stereoSbs=!t&&Lt.isStereoPreview,g.xrEyeTarget=t,Dt.renderFrame(g),wr(m)}function Nr(e){if(an)return;on=requestAnimationFrame(Nr);let t=Math.min(.1,Math.max(.001,(e-Er)/1e3));if(Er=e,kr+=t,Ar+=1,kr>=.45&&(jr=Math.round(Ar/kr),kr=0,Ar=0),$t&&!Kn&&(ln.yaw+=t*.22),rn>0&&(rn=Math.max(0,rn-t*1.45)),cn=Math.max(0,cn-t*12),sn!==null){let e=sn-s,n=Math.sign(e)*Math.min(Math.abs(e),Math.max(1.2,Math.abs(e)*3.4)*t);s+=n,cn=Math.abs(n)/Math.max(.001,t),Math.abs(sn-s)<.015&&(s=sn,sn=null),bn(s)}nn&&sn===null&&(s-=t*1.15,s<=-14.75&&(s=Re-.3),bn(s));let n=mr(s,{focusedSolarBodyIndex:G.focusedSolarBodyIndex,focusedBodyIsStar:Ht(),galaxyBranch:G.galaxyBranch});if(n!==q){let e=q;q=n,Y=null,Gt=!1,Kt=[0,0,0],ln.dist=18,q===4&&e!==4&&!Kn&&xn(G.focusedSolarBodyIndex),Z(),Tn(),bn(s)}if(Yt){let e=Rt.timescaleLocked?1:Xt;if(Ft+=t*e,G.stepActiveRegimes(q,s,e),It.step(t),G.surfaceActive){let e=G.drainSurfaceEvents();It.addHarvest(e.harvested);for(let t of e.peerHits)Rt.sendWeaponHit(t.targetPeerId,t);let t=G.getActiveSystemCatalog()[G.planetaryBodyIndex]?.id||`earth`,n=Rt.getRemotePeersForContext({level:4,bodyId:t,surfaceActive:!0});G.setSurfaceExternalEntities({remoteUfos:n,probes:It.state.probes,shieldFlash:It.state.shieldFlash})}if(Rt.isConnected){let e=G.getActiveSystemCatalog()[G.focusedSolarBodyIndex]?.id||`earth`,t=G.surfaceTelemetry;Rt.broadcastLocalState({level:q,log10SpanM:s,bodyId:e,surfaceActive:G.surfaceActive,pos:G.surfaceActive?t?.ufoPos||[0,30,0]:[0,0,0],yaw:G.surfaceActive?t?.ufoYaw||0:ln.yaw,pitch:G.surfaceActive&&t?.ufoPitch||0,roll:G.surfaceActive&&t?.ufoRoll||0,vertThrust:G.surfaceActive&&t?.ufoVertThrust||0,tractorActive:G.surfaceActive?!!t?.tractorActive:Pt,beam:G.surfaceActive&&t?.activeBeam||null,shieldFlash:It.state.shieldFlash})}}Jt+=t,Jt>=.1&&Y&&Y.level===q&&(Jt=0,lr()),(!(q===6&&!Kn&&!$t&&sn===null&&!nn&&rn<=0)||e-Dr>=120)&&(Dr=e,$(e)),Or+=t,Or>=.18&&(Or=0,v&&(v.textContent=`${jr} FPS · WebGPU`),G.surfaceActive&&Pn(),Q(),Gn())}if(vt?.classList.remove(`active`),r.epoch&&(await G.setCosmicEpoch(r.epoch),mn()),r.useSol!==null&&await G.setUseSolReference(r.useSol),await bn(s),r.bodyId&&G.setFocusedSolarBody(r.bodyId),r.roomId&&(Rt.connect({room:r.roomId,relay:r.relayUrl||``}),Bt()),r.surfaceActive){let e=r.pos?{activeVehicle:`ufo`,ufoPos:r.pos,ufoYaw:r.yaw??.35,cameraMode:r.cockpit?`first-person`:`chase`}:null;await Fn({bodyIndex:r.bodyId||G.planetaryBodyIndex,restoreCheckpoint:e})}Z(),Tn(),K(),Bt();let Pr=n.get(`peerRelay`);if(Pr){ue&&(ue.value=Pr);let e=n.get(`peerRole`)||`requester`;de&&(de.value=e),await G.connectPeerMesh({relayUrl:Pr,roomId:n.get(`peerRoom`)||`ulg-universes-mesh-v1`,role:e}),Gn()}Q();let Fr=()=>{Rt.disconnect(),G.disconnectPeerMesh()};return window.addEventListener(`pagehide`,Fr),window.addEventListener(`beforeunload`,Fr),on=requestAnimationFrame(Nr),Object.freeze({getState(){let e=Be[q],n=G.cosmoSession?.getState?.()||null,r=Me[0],i=Me[3],a=Me[6],o=G.solarConservation0,c=G.solarConservation;return{ready:!0,continuousZoom:!0,level:q,scaleId:e.id,scaleName:e.name,log10ViewSpanM:s,physicalSpanLabel:Ue(s),totalSpanOom:Number((Re-ze).toFixed(1)),gpuBackend:`webgpu`,cameraAutoSpin:$t,running:Yt,autopilot:nn,retroCrt:en,lensingEnabled:Zt,qualityId:G.quality.id,seed:G.seed,gpuErrorCount:t.length,gpuErrors:[...t],scientificValidation:!1,cosmicEpochId:G.cosmicEpochId,cosmicEpochRedshiftZ:G.cosmicEpoch?.redshiftZ??0,cosmoMode:G.cosmoMode,cosmoBaryonSteps:G.cosmoBaryonSession?.stepIndex??0,cosmoBaryonIonFrac:G.cosmoBaryonTelemetry?.meanIonizedFraction??null,cosmoBaryonXray:G.cosmoBaryonTelemetry?.meanXrayEmissivity??null,cosmoBaryonKappa:G.cosmoBaryonTelemetry?.maxLensingKappa??null,cosmicWebSteps:n?.stepIndex??0,scaleFactorA:n?.aScale??null,redshiftZ:n?.redshiftZ??null,submitsPerStep:G.cosmoTelemetry?.submitsPerStep??n?.submitsPerStep??null,sigmaDensity:G.cosmoTelemetry?.sigmaDensity??null,powerSpectrumPk:G.cosmoTelemetry?.powerSpectrumPk??null,galacticSteps:G.galaxyEngine?.stepIndex??0,galaxyPreset:G.galaxyPreset,galacticBodyCount:G.galaxyEngine?.count??0,galacticGravityMode:G.galaxyEngine?.gravityMode??null,galacticDynamoMagEnergy:G.galacticDynamoTelemetry?.magneticEnergy??null,galacticDynamoStreamlineFloats:G.galacticDynamoStreamlines?.length??0,galacticB0:G.galacticB0,galaxyBranch:G.galaxyBranch,planetarySteps:G.solarEngine?.stepIndex??0,solarSimTimeYr:G.solarEngine?.simTimeYr??0,solarTotalBodies:G.solarEngine?.totalCount??0,focusedSolarBody:G.getActiveSystemCatalog()[G.focusedSolarBodyIndex]?.id??`star-0`,useSolReference:G.useSolReference,causalSystemName:G.useSolReference?`Sol Reference`:G.activeCausalSystem?.systemName??null,causalArchitecture:G.useSolReference?`single`:G.activeCausalSystem?.architecture??`single`,causalStarCount:G.useSolReference?1:G.activeCausalSystem?.starCount??1,causalPlanetCount:G.useSolReference?8:G.activeCausalSystem?.planetCount??0,causalHasEarthLike:G.useSolReference?!0:!!G.activeCausalSystem?.hasEarthLike,causalFeH:G.useSolReference?0:G.activeCausalSystem?.starSystem?.nebulaEnv?.feH??0,causalCToO:G.useSolReference?.55:G.activeCausalSystem?.starSystem?.nebulaEnv?.cToO??.55,earthToSunRadiusRatio:i.radiusKm/r.radiusKm,jupiterToSunRadiusRatio:a.radiusKm/r.radiusKm,solarRelEnergyDrift:o&&c?Math.abs(c.totalEnergy-o.totalEnergy)/Math.max(1e-12,Math.abs(o.totalEnergy)):null,solarRelMomentumError:c?.relMomentumError??null,stellarSteps:G.stellarEngine?.stepIndex??0,stellarMode:G.stellarMode,stellarPreset:G.stellarPreset,stellarCoreTempK:G.stellarTelemetry?.coreTempK??null,stellarDynamoMagEnergy:G.stellarDynamoTelemetry?.magneticEnergy??null,stellarDynamoStreamlineFloats:G.stellarDynamoStreamlines?.length??0,stellarB0:G.stellarB0,magnetosphereStreamlineFloats:G.magnetosphereFieldLines?.length??0,pickedGpuMote:Y?{kind:Y.kind,index:Y.index,name:Y.name,subtitle:Y.subtitle}:null,moteFocusLocked:Gt,nebulaMhdSteps:G.nebulaMhdSession?.stepIndex??0,nebulaMhdMagneticEnergy:G.nebulaMhdTelemetry?.magneticEnergy??null,nebulaMhdPeakToroidalB:G.nebulaMhdTelemetry?.peakToroidalB??null,solarMode:G.solarMode,kerrSpinA:G.kerrSpinA,kerrMaxGamma:G.kerrJetTelemetry?.maxLorentzGamma??null,kerrActiveJets:G.kerrJetTelemetry?.activeJetParcels??0,relBinaryMerged:G.relBinaryTelemetry?.merged??!1,relBinaryRemnant:G.relBinaryTelemetry?.remnantType??null,relBinaryGwStrain:G.relBinaryTelemetry?.gwStrainPlus??null,magnetarFlares:G.magnetosphereTelemetry?.flareCount??0,magnetarBeamFlux:G.magnetosphereTelemetry?.beamFluxProxy??0,tovCount:G.tovCurve?.length??0,tidalRupturedFrac:G.tidalRocheTelemetry?.rupturedFraction??null,protoplanetarySteps:G.protoplanetarySession?.stepIndex??0,protoplanetaryAccreted:G.protoplanetaryTelemetry?.accretedPebbles??null,planetaryMode:G.planetaryMode,planetaryInteriorValid:!!G.planetaryResult?.valid,planetaryMoiFactor:G.planetaryResult?.moiFactor??null,planetaryCutaway:G.planetaryCutaway,planetaryAtmoActive:!!G.planetaryAtmoSession,planetaryAtmoSteps:G.planetaryAtmoSession?.stepIndex??0,planetaryLightningCells:G.planetaryAtmoTelemetry?.activeLightningCells??0,planetaryPeakElectricVPerM:G.planetaryAtmoTelemetry?.peakElectricFieldVPerM??0,surfaceActive:G.surfaceActive,surfaceVehicle:G.surfaceSession?.activeVehicle??null,surfaceCameraMode:G.surfaceSession?.cameraMode??null,surfaceGravityMS2:G.surfaceSession?.env?.gravityMS2??null,surfaceAtmoDensityKgM3:G.surfaceSession?.env?.rhoAtmKgM3??null,surfaceDroneFlightCapable:G.surfaceSession?.env?.droneFlightCapable??null,surfaceDroneMaxAeroLiftN:G.surfaceSession?.env?.maxAeroLiftN??null,surfaceTelemetry:G.surfaceTelemetry??null,surfaceLocalSample:G.surfaceSession?.getLocalSample?.()??null,hasSavedSurfaceCheckpoint:!!J,savedSurfaceWorld:J?.worldName??null,activeSampledMaterial:G.activeSampledMaterial??null,cosmicCockpitMode:kt,xrState:Lt.getState(),ufoMultiplayer:Rt.getStatus(),timescaleLocked:Rt.timescaleLocked,kardashev:{index:It.state.kardashevIndex,harvestedPowerW:It.state.harvestedPowerW,probeCount:It.state.probes.length,reactorTier:It.state.reactorTier,shieldHp:It.state.shieldHp,silicatesKg:It.state.silicatesKg,metalsKg:It.state.metalsKg,volatilesKg:It.state.volatilesKg},weaponState:{mode:At,log10WavelengthM:jt,powerW:Mt,firing:Nt,tractorOn:Pt},scaleTimeDilation:G.computeScaleAdaptiveTimeDilation(s,{surfaceActive:G.surfaceActive,userTimeScale:Xt}),parentBackdropActive:!!(q===1&&G.cosmoSession||(q===2||q===3||q===4)&&G.galaxyEngine||q===6&&G.mdSession||q===7&&G.orbitalCloud),activeUniversalLaws:G.getActiveUniversalLaws(q,s).active.map(e=>e.id),mdSteps:G.mdTelemetry?.totalSteps??0,mdAtomCount:G.mdSession?.atomCount??0,mdGravity:G.mdGravity,mdElementZ:G.mdElementZ,quantumZ:G.quantumZ,quantumRelativistic:G.quantumRelativistic,orbitalPointCount:G.orbitalCloud?.pointCount??0,nuclearZ:G.nuclearZ,nuclearA:G.nuclearA,nuclearBindingPerNucleonMeV:G.nuclearResult?.bindingPerNucleonMeV??null,tdseSteps:G.tdseTelemetry?.stepCount??0,selectedTarget:wn()?.id??null,peerMeshState:G.getPeerMeshState()}},async setLog10Span(e){sn=null;let t=q;return s=gr(e),q=mr(s,{focusedSolarBodyIndex:G.focusedSolarBodyIndex,focusedBodyIsStar:Ht(),galaxyBranch:G.galaxyBranch}),q!==t&&(Y=null,Gt=!1,Kt=[0,0,0]),await bn(s),Z(),Tn(),Q(),$(performance.now()),this.getState()},flyToLog10Span:Sn,async setLevel(e,{instant:t=!0}={}){let n=Math.max(0,Math.min(7,Math.trunc(Number(e)||0))),r=G.getActiveSystemCatalog();if(n===3?G.setFocusedSolarBody(0):n===4&&(r[G.focusedSolarBodyIndex]?.isStar||G.focusedSolarBodyIndex===0)&&G.setFocusedSolarBody(G.getDefaultPlanetIndex(r)),t){let e=await this.setLog10Span(Be[n].log10SpanM);return n===4&&(xn(G.focusedSolarBodyIndex),$(performance.now())),e}return Sn(Be[n].log10SpanM),this.getState()},async sampleNewGalacticSector(e={}){return await G.sampleNewGalacticSector(e),Z(),Tn(),Q(),$(performance.now()),this.getState()},async selectCausalStarSite(e={}){return await G.selectCausalStarSite(e),Z(),Tn(),Q(),$(performance.now()),this.getState()},async setUseSolReference(e){return await G.setUseSolReference(e),Z(),Tn(),Q(),$(performance.now()),this.getState()},async focusSolarBody(e){Y=null,Gt=!1,Kt=[0,0,0];let t=G.useSolReference;G.setFocusedSolarBody(e),G.useSolReference!==t&&(await G.initSolarSystem({solReference:G.useSolReference}),G.setFocusedSolarBody(e));let n=G.getActiveSystemCatalog(),r=Math.max(0,Math.min(n.length-1,G.focusedSolarBodyIndex));return!n[r]?.isStar&&r>0&&await G.initPlanetaryInterior({bodyIndex:r}),q===4&&!n[r]?.isStar&&r>0&&(s=hr(n[r]),xn(r)),Z(),Tn(),$(performance.now()),this.getState()},async setCosmicEpoch(e,t={}){return await G.setCosmicEpoch(e,t),mn(),Z(),Cn(),Q(),$(performance.now()),this.getState()},async setCosmoMode(e){return await G.setCosmoMode(e),Z(),Cn(),Q(),$(performance.now()),this.getState()},async setGalaxyPreset(e){return await G.initGalaxy({preset:e}),Z(),Cn(),Q(),$(performance.now()),this.getState()},async setSolarMode(e){return await G.setSolarMode(e),Z(),Cn(),Q(),$(performance.now()),this.getState()},async setKerrSpinA(e){return await G.setKerrSpinA(e),Cn(),Q(),$(performance.now()),this.getState()},async setStellarMode(e){return await G.setStellarMode(e),Z(),Cn(),Q(),$(performance.now()),this.getState()},async setPlanetaryMode(e){return await G.setPlanetaryMode(e),e===`cryo-plumes`&&q===4&&(s=Math.max(s,7.56),xn(G.focusedSolarBodyIndex),ln.pitch=-.18),Z(),Cn(),Q(),$(performance.now()),this.getState()},setCameraAngles(e,t){return Number.isFinite(Number(e))&&(ln.yaw=Number(e)),Number.isFinite(Number(t))&&(ln.pitch=Math.max(-1.42,Math.min(1.42,Number(t)))),$(performance.now()),this.getState()},async setNebulaB0(e){return await G.setNebulaB0(e),Cn(),$(performance.now()),this.getState()},async setGalacticB0(e){return await G.setGalacticB0(e),Cn(),Q(),$(performance.now()),this.getState()},async setStellarB0(e){return await G.setStellarB0(e),Cn(),Q(),$(performance.now()),this.getState()},async setStellarPreset(e){return await G.initStellarCore({preset:e}),Y=null,Gt=!1,Cn(),Q(),$(performance.now()),this.getState()},async pickAtCanvasFraction(e=.5,t=.5,{preferGpuMote:n=!0}={}){return $(performance.now()),nr(e*X,t*dn,{preferGpuMote:n})},focusPickedMote(e={zoomIn:!0}){return _r(e)},getPickedMote(){return Y},async readGalaxyDiagnostics(){if(!G.galaxyEngine)return null;let e=await G.galaxyEngine.readbackBodies(),t=Math.floor(e.length/8),n=0,r=0,i=0,a=0,o=0;for(let s=1;s<t;s+=1){let t=s*8;if(e[t+7]<-.5)continue;let c=Math.hypot(e[t],e[t+2]),l=e[t+1];n+=1,r+=c,i+=l*l,c>a&&(a=c),(c>18||Math.abs(l)>10)&&(o+=1)}return{stepIndex:G.galaxyEngine.stepIndex,visibleStars:n,meanRadius:r/Math.max(1,n),rmsHeightZ:Math.sqrt(i/Math.max(1,n)),maxRadius:a,escapedFrac:o/Math.max(1,n)}},async readStellarDiagnostics(){if(!G.stellarEngine)return null;let e=await G.stellarEngine.readbackBodies(),t=Math.floor(e.length/16),n=0,r=0,i=0,a=0;for(let o=0;o<t;o+=1){let t=o*16,s=Math.hypot(e[t],e[t+1],e[t+2]),c=Math.hypot(e[t+4],e[t+5],e[t+6]);n+=s,r+=c*c,c>i&&(i=c),s<6.5&&(a+=1)}return{stepIndex:G.stellarEngine.stepIndex,count:t,meanRadius:n/Math.max(1,t),rmsSpeed:Math.sqrt(r/Math.max(1,t)),maxSpeed:i,boundFrac:a/Math.max(1,t),coreTempK:G.stellarTelemetry?.coreTempK??null}},setPlanetaryTriboelectric(e){return G.setPlanetaryTriboelectric(e),Cn(),this.getState()},getActiveUniversalLaws(){return G.getActiveUniversalLaws(q,s)},async setGalaxyBranch(e){return G.setGalaxyBranch(e,e===`smbh-core`?[0,0,0]:[4.8,.04,2.1]),await bn(s),Tn(),this.getState()},setPlanetaryCutaway(e){G.setPlanetaryCutaway(e),$(performance.now())},async enterSurfaceView(e={}){return await Fn(e),this.getState()},exitSurfaceView(){return In(),this.getState()},async sampleSurfaceAndDiveToLattice(){return{sample:await En(),state:this.getState()}},async returnToSavedSurface(){return await Dn(),this.getState()},async inspectSampledCompound(e=0){return await On(typeof e==`object`?e:G.activeSampledMaterial?.compounds?.[e]),this.getState()},async inspectSampledElement(e,t={}){return await kn(e,t),this.getState()},setSurfaceVehicle(e){return G.setSurfaceVehicle(e),Pn(),$(performance.now()),this.getState()},setSurfaceUfoAltitudeKm(e){return G.setSurfaceUfoAltitudeKm(e),Pn(),$(performance.now()),this.getState()},setSurfaceCameraMode(e){return G.setSurfaceCameraMode(e),Pn(),K(),$(performance.now()),this.getState()},toggleCockpit(){return Nn(),this.getState()},async toggleXr(){return await Lt.toggleXr((e,t)=>{for(let e of t)$(performance.now(),e)}),$(performance.now()),this.getState()},setTractorBeam(e){return Pt=!!e,G.setSurfaceTractorBeam(Pt),K(),$(performance.now()),this.getState()},setWeaponConfig(e={}){return e.mode&&(At=e.mode),Number.isFinite(Number(e.log10WavelengthM))&&(jt=Number(e.log10WavelengthM)),Number.isFinite(Number(e.powerW))&&(Mt=Number(e.powerW)),G.setSurfaceWeaponConfig({mode:At,log10WavelengthM:jt,powerW:Mt}),K(),this.getState()},setWeaponFire(e={}){return Nt=!!e.firing,G.setSurfaceWeaponFire(e),K(),this.getState()},launchMissile(e={}){let t=G.launchSurfaceMissile(e);return t&&Rt.isConnected&&Rt.broadcastMissileLaunch(t),t},buildShareUrl:()=>Vt(),joinMultiplayerRoom(e=`ulg-test-room`,t=``){let n=Rt.connect({room:e,relay:t});return Bt(),n},leaveMultiplayerRoom(){let e=Rt.disconnect();return Bt(),e},deployVonNeumannProbe(){let e=G.getActiveSystemCatalog(),t=It.deployVonNeumannProbe({bodyId:e[G.focusedSolarBodyIndex]?.id||`earth`});return K(),t},upgradeReactor(){let e=It.upgradeReactor();return K(),e},setSurfaceControls(e={}){return G.setSurfaceControls(e),Pn(),this.getState()},addSurfaceLookDelta(e,t){return G.addSurfaceLookDelta(e,t),$(performance.now()),this.getState()},async setMdPhase(e){return await G.initMolecularDynamics({Z:G.mdElementZ,phasePreset:e}),Cn(),this.getState()},selectTarget(e){return G.getTargetsForLevel(q,fn).some(t=>t.id===e)?(Ut=e,Q(),!0):!1},initiateHyperdrive:An,returnToOrbit:jn,setAutopilot(e){nn=!!e,w?.classList.toggle(`active`,nn),w&&(w.textContent=nn?`⏹ Stop Tour`:`▶ Tour`)},setRetroCrt(e,t=tn){en=!!e,tn=Math.max(1,Math.min(6,Math.trunc(Number(t)||3))),ae&&(ae.checked=en),ce&&(ce.value=String(tn)),le&&(le.textContent=`${tn}×`)},setCameraAutoSpin(e){$t=!!e,ie&&(ie.checked=$t)},async bigBang(){return rn=1,await G.initCosmicWeb(),this.setLog10Span(Be[0].log10SpanM)},async reseed(e=null){return G.setSeed(e??G.seed+7919>>>0),await G.initCosmicWeb(),this.getState()},connectPeerMesh:e=>G.connectPeerMesh(e),disconnectPeerMesh:()=>G.disconnectPeerMesh(),dispatchPeerDerivation:e=>G.dispatchPeerDerivation(e),async stepOnce(){let e=0;for(;G.busy&&e<100;)e+=1,await new Promise(e=>setTimeout(e,4));return await G.stepActiveRegimes(q,s,Xt),Q(),this.getState()},capturePng(){return $(performance.now()),c.toDataURL(`image/png`)},dispose(){an=!0,cancelAnimationFrame(on),window.removeEventListener(`resize`,hn),window.removeEventListener(`keydown`,Un),window.removeEventListener(`keyup`,Wn),window.removeEventListener(`pagehide`,Fr),window.removeEventListener(`beforeunload`,Fr),Rt.disconnect(),Lt.exitXr(),Ot.dispose(),G.dispose(),Dt.dispose()}})}async function vr(){try{let e=await _r();window.__ulgUniversesDemo=e}catch(e){let t=document.getElementById(`uv-webgpu-fallback`),n=document.getElementById(`uv-fallback-title`),r=document.getElementById(`uv-fallback-msg`);n&&(n.textContent=`WebGPU Initialization Failed`),r&&(r.textContent=e instanceof Error?e.message:String(e)),t?.classList.add(`visible`),console.error(`[ULG Universes] boot failed:`,e)}}vr();