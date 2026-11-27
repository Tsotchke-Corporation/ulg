import"./src-BrKxCx2p.js";import{F as e,I as t,P as n,Qt as r,f as i,i as a,in as o,nn as s}from"./molecularHartreeFockWebGpu-C30-vG4U.js";import{g as c,m as l}from"./webgpuComputeLayout-CHUyeeFd.js";import{i as u}from"./materialPbrOpticsBridge-DkVy-eUQ.js";var d=`ulg.organic.molecular-graph-hybridization-webgpu.v1`,f=Object.freeze({COPY_DST:8,STORAGE:128}),p=Object.freeze({id:`organic-molecular-graph-hybridization`,lawNodeId:`law:organic-molecular-graph-hybridization`,orderConstraint:`after:molecular-rhf`,adapterMode:n.CELL_LOCAL,spatialAuthority:t.CANONICAL_SS_EPOCH,reads:Object.freeze([`atomic-periodic-descriptors`,`molecular-graph-topology`,`dielectric-environment`]),writes:Object.freeze([`molecular-hybridization-state`,`pi-molecular-orbitals`,`qeq-partial-charges`,`chirality-descriptors`]),accumulates:Object.freeze([`electronic-delocalization-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`total-electric-charge`,`pi-electron-count`,`atomic-mass`]),validityDomain:Object.freeze({minAtoms:2,maxAtoms:256,dielectricMin:1}),fallbackPolicy:e.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e-10,1e-8]),fundamentalLaws:Object.freeze([`valence-orbital-hybridization`,`huckel-pi-molecular-orbital-eigenproblem`,`rappe-goddard-qeq-charge-equilibration`,`born-dielectric-solvation`,`cahn-ingold-prelog-3d-chirality`])}),m=Object.freeze({1:Object.freeze({Z:1,sym:`H`,massU:1.008,valence:1,chiEv:4.528,etaEv:13.89,rCovA:.32,rVdwA:1.2,huckelAlpha:0,piLonePair:0,hBondDonor:!0,hBondAcceptor:!1,rgb:[.92,.95,.98]}),5:Object.freeze({Z:5,sym:`B`,massU:10.81,valence:3,chiEv:4.29,etaEv:8.01,rCovA:.84,rVdwA:1.92,huckelAlpha:1,piLonePair:0,hBondDonor:!1,hBondAcceptor:!1,rgb:[.95,.68,.56]}),6:Object.freeze({Z:6,sym:`C`,massU:12.011,valence:4,chiEv:5.343,etaEv:10.126,rCovA:.75,rVdwA:1.7,huckelAlpha:0,piLonePair:0,hBondDonor:!1,hBondAcceptor:!1,rgb:[.3,.34,.4]}),7:Object.freeze({Z:7,sym:`N`,massU:14.007,valence:3,chiEv:6.899,etaEv:11.76,rCovA:.71,rVdwA:1.55,huckelAlpha:-.5,piLonePair:2,hBondDonor:!0,hBondAcceptor:!0,rgb:[.22,.52,.98]}),8:Object.freeze({Z:8,sym:`O`,massU:15.999,valence:2,chiEv:8.741,etaEv:13.364,rCovA:.64,rVdwA:1.52,huckelAlpha:-1,piLonePair:2,hBondDonor:!0,hBondAcceptor:!0,rgb:[.88,.13,.13]}),9:Object.freeze({Z:9,sym:`F`,massU:18.998,valence:1,chiEv:10.874,etaEv:14.948,rCovA:.6,rVdwA:1.47,huckelAlpha:-2,piLonePair:2,hBondDonor:!1,hBondAcceptor:!0,rgb:[.45,.92,.52]}),12:Object.freeze({Z:12,sym:`Mg`,massU:24.305,valence:2,chiEv:3.951,etaEv:7.386,rCovA:1.39,rVdwA:1.73,huckelAlpha:.9,piLonePair:0,hBondDonor:!1,hBondAcceptor:!1,rgb:[.24,.88,.36]}),14:Object.freeze({Z:14,sym:`Si`,massU:28.085,valence:4,chiEv:4.168,etaEv:6.974,rCovA:1.11,rVdwA:2.1,huckelAlpha:.6,piLonePair:0,hBondDonor:!1,hBondAcceptor:!1,rgb:[.84,.72,.54]}),15:Object.freeze({Z:15,sym:`P`,massU:30.974,valence:5,chiEv:5.463,etaEv:8,rCovA:1.07,rVdwA:1.8,huckelAlpha:-.2,piLonePair:0,hBondDonor:!1,hBondAcceptor:!0,rgb:[1,.56,.14]}),16:Object.freeze({Z:16,sym:`S`,massU:32.06,valence:2,chiEv:6.928,etaEv:8.972,rCovA:1.03,rVdwA:1.8,huckelAlpha:-.4,piLonePair:2,hBondDonor:!0,hBondAcceptor:!0,rgb:[.96,.72,.05]}),17:Object.freeze({Z:17,sym:`Cl`,massU:35.45,valence:1,chiEv:8.564,etaEv:9.892,rCovA:.99,rVdwA:1.75,huckelAlpha:-1.6,piLonePair:2,hBondDonor:!1,hBondAcceptor:!0,rgb:[.22,.88,.36]}),26:Object.freeze({Z:26,sym:`Fe`,massU:55.845,valence:3,chiEv:4.058,etaEv:7.45,rCovA:1.25,rVdwA:1.94,huckelAlpha:.7,piLonePair:0,hBondDonor:!1,hBondAcceptor:!1,rgb:[.88,.42,.18]}),35:Object.freeze({Z:35,sym:`Br`,massU:79.904,valence:1,chiEv:7.79,etaEv:8.85,rCovA:1.14,rVdwA:1.85,huckelAlpha:-1.4,piLonePair:2,hBondDonor:!1,hBondAcceptor:!0,rgb:[.68,.2,.16]})}),h=new Map;for(let e of i?.records||[]){let t=Math.trunc(Number(e?.atomicNumber));t>=1&&t<=118&&h.set(t,e)}var g=new Map;function _(e){let t=Math.max(1,Math.min(118,Math.trunc(Number(e))||6));if(m[t])return m[t];if(g.has(t))return g.get(t);let n=o(t),i=s(t),a=Array.isArray(i)?i:i?.subshells||[],c=1,l=0;for(let e of a)e.n>c&&(c=e.n);for(let e of a){let t=Number(e.occupancy??e.electrons??0);(e.n===c||e.n===c-1&&e.l===2&&t<10)&&(l+=t)}let d=t===2||t===10||t===18||t===36||t===54||t===86||t===118,f=t===9||t===17||t===35||t===53||t===85||t===117,p=d?0:f?1:Math.max(1,Math.min(6,l<=4?l:8-Math.min(8,l)||2)),_=h.get(t)||null,v=Number(_?.atomicMassU)||Number(r[t-1])||t*2,y=u(t,{surfaceFinish:`crystal`}),b=Number(Math.max(.32,Math.min(2.45,.44+.25*c-.045*Math.min(8,l))).toFixed(2)),x=Number(Math.max(1.2,Math.min(2.9,b+.78)).toFixed(2)),S=Number(Math.max(2.1,Math.min(10.8,2.8+.52*Math.min(8,l)-.14*(c-2))).toFixed(3)),C=Number(Math.max(4.2,Math.min(14.5,11.4/Math.max(.85,b*1.15))).toFixed(3)),w=Number(Math.max(-2,Math.min(1.5,(5.343-S)*.35)).toFixed(2)),T=[Number(y.albedoSrgb[0].toFixed(3)),Number(y.albedoSrgb[1].toFixed(3)),Number(y.albedoSrgb[2].toFixed(3))],E=Object.freeze({Z:t,sym:n,massU:Number(v.toFixed(3)),valence:p,chiEv:S,etaEv:C,rCovA:b,rVdwA:x,huckelAlpha:w,piLonePair:f?2:0,hBondDonor:!1,hBondAcceptor:S>=6.8,rgb:Object.freeze(T)});return g.set(t,E),E}function v(e={}){let t=Number(e.organicAtomCount)||0,n=Number(e.covalentBondCount)||0,r=!!e.organicChemistryActive||t>=2&&n>=1;return{active:r,reason:r?`covalent-molecular-graph-present`:`no-organic-molecular-graph-dormant`}}function y(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function b(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function x(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function S(e){return Math.hypot(e[0],e[1],e[2])}function C(e){let t=S(e)||1;return[e[0]/t,e[1]/t,e[2]/t]}function w(e,t){let n=t.length,r=Array.from({length:n},(r,i)=>{let a=new Float64Array(n+1);for(let t=0;t<n;t+=1)a[t]=e[i*n+t];return a[n]=t[i],a});for(let e=0;e<n;e+=1){let t=e,i=Math.abs(r[e][e]);for(let a=e+1;a<n;a+=1){let n=Math.abs(r[a][e]);n>i&&(i=n,t=a)}if(i<1e-12)continue;if(t!==e){let n=r[e];r[e]=r[t],r[t]=n}let a=r[e][e];for(let t=e+1;t<n;t+=1){let i=r[t][e]/a;for(let a=e;a<=n;a+=1)r[t][a]-=i*r[e][a]}}let i=new Float64Array(n);for(let e=n-1;e>=0;--e){let t=r[e][n];for(let a=e+1;a<n;a+=1)t-=r[e][a]*i[a];i[e]=Math.abs(r[e][e])>1e-12?t/r[e][e]:0}return i}function T(e,{aromatic:t=!1,chair:n=!1}={}){let r=[],i=[],a=(t?1.4:1.54)/(2*Math.sin(Math.PI/e));for(let t=0;t<e;t+=1){let i=t/e*Math.PI*2,o=n?t%2==0?.25:-.25:0;r.push({Z:6,pos:[Math.cos(i)*a,Math.sin(i)*a,o]})}for(let n=0;n<e;n+=1){let r=(n+1)%e,a=t&&n%2==0?2:1;i.push({a:n,b:r,order:a})}for(let n=0;n<e;n+=1){let e=r[n].pos,a=C([e[0],e[1],0]);if(t)r.push({Z:1,pos:[e[0]+a[0]*1.09,e[1]+a[1]*1.09,0]}),i.push({a:n,b:r.length-1,order:1});else{let t=n%2==0?1:-1;r.push({Z:1,pos:[e[0]+a[0]*.34,e[1]+a[1]*.34,e[2]+t*1.04]}),i.push({a:n,b:r.length-1,order:1}),r.push({Z:1,pos:[e[0]+a[0]*1.03,e[1]+a[1]*1.03,e[2]-t*.36]}),i.push({a:n,b:r.length-1,order:1})}}return{atoms:r,bonds:i}}function E(){let e=1.4,t=e*Math.cos(Math.PI/6),n=e*.5,r=[{Z:6,pos:[0,-.7,0]},{Z:6,pos:[0,n,0]},{Z:6,pos:[t,e,0]},{Z:6,pos:[2*t,n,0]},{Z:6,pos:[2*t,-.7,0]},{Z:6,pos:[t,-1.4,0]},{Z:6,pos:[-t,-1.4,0]},{Z:6,pos:[-2*t,-.7,0]},{Z:6,pos:[-2*t,n,0]},{Z:6,pos:[-t,e,0]}],i=[{a:0,b:1,order:2},{a:1,b:2,order:1},{a:2,b:3,order:2},{a:3,b:4,order:1},{a:4,b:5,order:2},{a:5,b:0,order:1},{a:0,b:6,order:1},{a:6,b:7,order:2},{a:7,b:8,order:1},{a:8,b:9,order:2},{a:9,b:1,order:1}];for(let e of[2,3,4,5,6,7,8,9]){let n=e<=5?t:-t,a=C([r[e].pos[0]-n,r[e].pos[1],0]);r.push({Z:1,pos:[r[e].pos[0]+a[0]*1.09,r[e].pos[1]+a[1]*1.09,0]}),i.push({a:e,b:r.length-1,order:1})}return{atoms:r,bonds:i}}function D(e=!1){let t=e?1:-1;return{atoms:[{Z:6,pos:[0,0,0]},{Z:7,pos:[t*1.18,.85,.15]},{Z:6,pos:[t*-1.24,.65,-.58]},{Z:8,pos:[t*-2.28,.08,-.82]},{Z:8,pos:[t*-1.1,1.96,-.86]},{Z:6,pos:[t*.18,-1.38,-.62]},{Z:1,pos:[t*-.08,-.1,1.08]},{Z:1,pos:[t*1.24,1.48,.94]},{Z:1,pos:[t*2.02,.3,.05]},{Z:1,pos:[t*-1.94,2.34,-1.2]},{Z:1,pos:[t*1.08,-1.82,-.22]},{Z:1,pos:[t*-.68,-2.02,-.42]},{Z:1,pos:[t*.28,-1.28,-1.7]}],bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:5,order:1},{a:0,b:6,order:1},{a:2,b:3,order:2},{a:2,b:4,order:1},{a:4,b:9,order:1},{a:1,b:7,order:1},{a:1,b:8,order:1},{a:5,b:10,order:1},{a:5,b:11,order:1},{a:5,b:12,order:1}]}}function ee(){return{atoms:[{Z:6,pos:[-1.18,-.24,0]},{Z:6,pos:[.32,.02,0]},{Z:8,pos:[1.02,-1.22,0]},{Z:1,pos:[1.96,-1.04,0]},{Z:1,pos:[-1.68,.72,0]},{Z:1,pos:[-1.5,-.8,.89]},{Z:1,pos:[-1.5,-.8,-.89]},{Z:1,pos:[.64,.58,.89]},{Z:1,pos:[.64,.58,-.89]}],bonds:[{a:0,b:1,order:1},{a:1,b:2,order:1},{a:2,b:3,order:1},{a:0,b:4,order:1},{a:0,b:5,order:1},{a:0,b:6,order:1},{a:1,b:7,order:1},{a:1,b:8,order:1}]}}function te(){return{atoms:[{Z:8,pos:[0,.52,0]},{Z:6,pos:[-1.18,-.26,0]},{Z:6,pos:[1.18,-.26,0]},{Z:1,pos:[-2.04,.4,0]},{Z:1,pos:[-1.22,-.88,.89]},{Z:1,pos:[-1.22,-.88,-.89]},{Z:1,pos:[2.04,.4,0]},{Z:1,pos:[1.22,-.88,.89]},{Z:1,pos:[1.22,-.88,-.89]}],bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:1,b:3,order:1},{a:1,b:4,order:1},{a:1,b:5,order:1},{a:2,b:6,order:1},{a:2,b:7,order:1},{a:2,b:8,order:1}]}}function O(){return{atoms:[{Z:6,pos:[-1.92,-.48,0]},{Z:6,pos:[-.74,.48,0]},{Z:6,pos:[.74,-.02,0]},{Z:6,pos:[1.92,.94,0]},{Z:1,pos:[-2.88,.04,0]},{Z:1,pos:[-1.88,-1.12,.89]},{Z:1,pos:[-1.88,-1.12,-.89]},{Z:1,pos:[-.82,1.12,.89]},{Z:1,pos:[-.82,1.12,-.89]},{Z:1,pos:[.82,-.66,.89]},{Z:1,pos:[.82,-.66,-.89]},{Z:1,pos:[2.88,.42,0]},{Z:1,pos:[1.88,1.58,.89]},{Z:1,pos:[1.88,1.58,-.89]}],bonds:[{a:0,b:1,order:1},{a:1,b:2,order:1},{a:2,b:3,order:1},{a:0,b:4,order:1},{a:0,b:5,order:1},{a:0,b:6,order:1},{a:1,b:7,order:1},{a:1,b:8,order:1},{a:2,b:9,order:1},{a:2,b:10,order:1},{a:3,b:11,order:1},{a:3,b:12,order:1},{a:3,b:13,order:1}]}}function k(){return{atoms:[{Z:6,pos:[-1.84,-.58,0]},{Z:6,pos:[-.72,.14,0]},{Z:6,pos:[.72,-.14,0]},{Z:6,pos:[1.84,.58,0]},{Z:1,pos:[-2.82,-.14,0]},{Z:1,pos:[-1.76,-1.66,0]},{Z:1,pos:[-.84,1.22,0]},{Z:1,pos:[.84,-1.22,0]},{Z:1,pos:[2.82,.14,0]},{Z:1,pos:[1.76,1.66,0]}],bonds:[{a:0,b:1,order:2},{a:1,b:2,order:1},{a:2,b:3,order:2},{a:0,b:4,order:1},{a:0,b:5,order:1},{a:1,b:6,order:1},{a:2,b:7,order:1},{a:3,b:8,order:1},{a:3,b:9,order:1}]}}function A(){return{atoms:[{Z:6,pos:[-1.36,0,0]},{Z:6,pos:[.14,.02,0]},{Z:8,pos:[.78,1.08,0]},{Z:8,pos:[.78,-1.16,0]},{Z:1,pos:[1.74,-1.04,0]},{Z:1,pos:[-1.76,1.01,0]},{Z:1,pos:[-1.72,-.52,.89]},{Z:1,pos:[-1.72,-.52,-.89]}],bonds:[{a:0,b:1,order:1},{a:1,b:2,order:2},{a:1,b:3,order:1},{a:3,b:4,order:1},{a:0,b:5,order:1},{a:0,b:6,order:1},{a:0,b:7,order:1}]}}function ne(){return{atoms:[{Z:7,pos:[-1.62,.72,0]},{Z:6,pos:[-1.62,-.62,0]},{Z:7,pos:[-.46,-1.32,0]},{Z:6,pos:[.68,-.62,0]},{Z:6,pos:[.68,.76,0]},{Z:6,pos:[-.48,1.44,0]},{Z:7,pos:[1.96,1.18,0]},{Z:6,pos:[2.72,.06,0]},{Z:7,pos:[1.96,-1.06,0]},{Z:7,pos:[-.48,2.78,0]},{Z:1,pos:[-2.56,-1.14,0]},{Z:1,pos:[3.8,.06,0]},{Z:1,pos:[2.26,-2.02,0]},{Z:1,pos:[-1.34,3.3,0]},{Z:1,pos:[.38,3.3,0]}],bonds:[{a:0,b:1,order:2},{a:1,b:2,order:1},{a:2,b:3,order:2},{a:3,b:4,order:1},{a:4,b:5,order:2},{a:5,b:0,order:1},{a:4,b:6,order:1},{a:6,b:7,order:2},{a:7,b:8,order:1},{a:8,b:3,order:1},{a:5,b:9,order:1},{a:1,b:10,order:1},{a:7,b:11,order:1},{a:8,b:12,order:1},{a:9,b:13,order:1},{a:9,b:14,order:1}]}}function re(){return{atoms:[{Z:6,pos:[0,0,0]},{Z:35,pos:[1.94,0,0]},{Z:17,pos:[-3.1,0,0]},{Z:1,pos:[-.36,1.03,0]},{Z:1,pos:[-.36,-.51,.89]},{Z:1,pos:[-.36,-.51,-.89]}],bonds:[{a:0,b:1,order:1},{a:0,b:3,order:1},{a:0,b:4,order:1},{a:0,b:5,order:1}],totalCharge:-1,reactionMeta:{kind:`sn2`,nucleophileIdx:2,centerIdx:0,leavingIdx:1}}}function ie(){return{atoms:[{Z:6,pos:[-1.15,1.48,0]},{Z:6,pos:[-2.12,.72,0]},{Z:6,pos:[-2.12,-.72,0]},{Z:6,pos:[-1.15,-1.48,0]},{Z:6,pos:[1.65,.67,0]},{Z:6,pos:[1.65,-.67,0]},{Z:1,pos:[-.45,2.28,.25]},{Z:1,pos:[-1.28,1.72,-1.04]},{Z:1,pos:[-3.08,1.22,0]},{Z:1,pos:[-3.08,-1.22,0]},{Z:1,pos:[-.45,-2.28,.25]},{Z:1,pos:[-1.28,-1.72,-1.04]},{Z:1,pos:[2.25,1.24,.68]},{Z:1,pos:[2.25,1.24,-.68]},{Z:1,pos:[2.25,-1.24,.68]},{Z:1,pos:[2.25,-1.24,-.68]}],bonds:[{a:0,b:1,order:2},{a:1,b:2,order:1},{a:2,b:3,order:2},{a:4,b:5,order:2},{a:0,b:6,order:1},{a:0,b:7,order:1},{a:1,b:8,order:1},{a:2,b:9,order:1},{a:3,b:10,order:1},{a:3,b:11,order:1},{a:4,b:12,order:1},{a:4,b:13,order:1},{a:5,b:14,order:1},{a:5,b:15,order:1}],reactionMeta:{kind:`diels-alder`,pairs:[[0,4],[3,5]]}}}function ae(){let e=ee(),t=e.atoms.map(e=>({Z:e.Z,pos:[e.pos[0]-2.1,e.pos[1],e.pos[2]]})),n=e.bonds.map(e=>({...e})),r=t.length;t.push({Z:8,pos:[1.35,-.95,.35]},{Z:1,pos:[1.75,-.1,.55]},{Z:1,pos:[1.85,-1.55,-.18]}),n.push({a:r,b:r+1,order:1},{a:r,b:r+2,order:1});let i=t.length;return t.push({Z:8,pos:[2.45,1.38,.55]},{Z:1,pos:[1.65,1.82,.25]},{Z:1,pos:[3.15,1.9,.12]}),n.push({a:i,b:i+1,order:1},{a:i,b:i+2,order:1}),{atoms:t,bonds:n}}function oe(){let e=[],t=[],n=1.83,r=3.22,i=4.26;for(let t=0;t<8;t+=1){let r=t/8*Math.PI*2;e.push({Z:6,pos:[Math.cos(r)*n,Math.sin(r)*n,0]})}for(let t=0;t<8;t+=1){let n=t/8*Math.PI*2;e.push({Z:6,pos:[Math.cos(n)*r,Math.sin(n)*r,0]})}for(let t=0;t<8;t+=1){let n=(t+.5)/8*Math.PI*2;e.push({Z:16,pos:[Math.cos(n)*i,Math.sin(n)*i,0]})}for(let e=0;e<8;e+=1){let n=(e+1)%8;t.push({a:e,b:n,order:1.5}),t.push({a:e,b:8+e,order:1.5}),t.push({a:8+e,b:16+e,order:1}),t.push({a:8+n,b:16+e,order:1})}let a=Math.PI*2/11,o=6.84,s=7.64,c=8.88,l=9.96,u=8.7,d=8.9*Math.PI/180,f=4.5*Math.PI/180,p=4.6*Math.PI/180,m=[];for(let n=0;n<11;n+=1){let r=n*a,i=e.length;e.push({Z:8,pos:[Math.cos(r)*o,Math.sin(r)*o,0]});let h=e.length;e.push({Z:6,pos:[Math.cos(r-d)*s,Math.sin(r-d)*s,0]});let g=e.length;e.push({Z:6,pos:[Math.cos(r+d)*s,Math.sin(r+d)*s,0]});let _=e.length;e.push({Z:6,pos:[Math.cos(r-f)*c,Math.sin(r-f)*c,0]});let v=e.length;e.push({Z:6,pos:[Math.cos(r+f)*c,Math.sin(r+f)*c,0]});let y=e.length;e.push({Z:1,pos:[Math.cos(r-p)*l,Math.sin(r-p)*l,0]});let b=e.length;e.push({Z:1,pos:[Math.cos(r+p)*l,Math.sin(r+p)*l,0]});let x=r+a*.5,S=e.length;e.push({Z:6,pos:[Math.cos(x)*u,Math.sin(x)*u,0]});let C=e.length;e.push({Z:1,pos:[Math.cos(x)*9.219999999999999,Math.sin(x)*9.219999999999999,.88]});let w=e.length;e.push({Z:1,pos:[Math.cos(x)*9.219999999999999,Math.sin(x)*9.219999999999999,-.88]}),t.push({a:i,b:h,order:1}),t.push({a:i,b:g,order:1}),t.push({a:h,b:_,order:1.5}),t.push({a:_,b:v,order:1.5}),t.push({a:v,b:g,order:1.5}),t.push({a:_,b:y,order:1}),t.push({a:v,b,order:1}),t.push({a:S,b:C,order:1}),t.push({a:S,b:w,order:1}),m.push({iCaL:h,iCaR:g,iCh2:S})}for(let e=0;e<11;e+=1){let n=(e+1)%11;t.push({a:m[e].iCaR,b:m[e].iCh2,order:1}),t.push({a:m[e].iCh2,b:m[n].iCaL,order:1})}return{atoms:e,bonds:t,rotorMeta:Object.freeze({kind:`molecular-bearing`,rotorCount:24,statorStart:24,rotorSymmetry:8,statorSymmetry:11,bearingGapA:Number((o-i).toFixed(2))})}}var j=Object.freeze({"sulflower-bearing":Object.freeze({id:`sulflower-bearing`,name:`Sulflower Molecular Bearing (C₁₆S₈ @ Calix[11]furan)`,formula:`C71H44O11S8`,category:`nanotech`,description:`Superlubric supramolecular nanobearing: planar D₈h octathio[8]circulene "Sulflower" (C₁₆S₈) spinning freely inside a coprime 11-fold Calix[11]furan oxa-macrocycle stator via live GPU S···O Lennard-Jones & QEq forces!`,build:oe}),benzene:Object.freeze({id:`benzene`,name:`Benzene (C₆H₆)`,formula:`C₆H₆`,category:`aromatic`,description:`Planar 6π Hückel (4n+2) aromatic ring with equalized delocalized C–C bonds and deep resonance stabilization.`,build:()=>T(6,{aromatic:!0})}),cyclobutadiene:Object.freeze({id:`cyclobutadiene`,name:`Cyclobutadiene (C₄H₄)`,formula:`C₄H₄`,category:`aromatic`,description:`4π Hückel (4n) anti-aromatic ring exhibiting degenerate non-bonding π MOs and zero aromatic stabilization.`,build:()=>T(4,{aromatic:!0})}),naphthalene:Object.freeze({id:`naphthalene`,name:`Naphthalene (C₁₀H₈)`,formula:`C₁₀H₈`,category:`aromatic`,description:`Fused bicyclic 10π (4n+2) polycyclic aromatic hydrocarbon with narrowed HOMO–LUMO UV-Vis gap.`,build:E}),butadiene:Object.freeze({id:`butadiene`,name:`1,3-Butadiene (C₄H₆)`,formula:`C₄H₆`,category:`aromatic`,description:`Conjugated linear 4π polyene showing partial central C2–C3 π-bond delocalization and s-trans planarity.`,build:k}),adenine:Object.freeze({id:`adenine`,name:`Adenine (C₅H₅N₅)`,formula:`C₅H₅N₅`,category:`aromatic`,description:`Planar 10π heteroaromatic purine nucleobase with strongly polarized H-bond donor/acceptor edges.`,build:ne}),cyclohexane:Object.freeze({id:`cyclohexane`,name:`Cyclohexane (C₆H₁₂)`,formula:`C₆H₁₂`,category:`conformational`,description:`Strain-free sp³ chair conformation with axial/equatorial C–H bonds and live thermal chair–boat flips.`,build:()=>T(6,{aromatic:!1,chair:!0})}),butane:Object.freeze({id:`butane`,name:`n-Butane (C₄H₁₀)`,formula:`C₄H₁₀`,category:`conformational`,description:`Canonical sp³ torsional dihedral rotor displaying anti (180°), gauche (±60°), and eclipsed barriers.`,build:O}),"l-alanine":Object.freeze({id:`l-alanine`,name:`L-Alanine (C₃H₇NO₂)`,formula:`C₃H₇NO₂`,category:`chiral`,description:`Chiral (S)-amino acid with stereogenic sp³ α-carbon, acidic –COOH, and basic –NH₂ groups. Mirror to flip R↔S!`,build:()=>D(!1)}),"d-alanine":Object.freeze({id:`d-alanine`,name:`D-Alanine (C₃H₇NO₂)`,formula:`C₃H₇NO₂`,category:`chiral`,description:`Exact mirror-image (R)-enantiomer of L-Alanine with bit-identical energy and inverted 3D stereocenter sign.`,build:()=>D(!0)}),ethanol:Object.freeze({id:`ethanol`,name:`Ethanol (C₂H₆O)`,formula:`C₂H₆O`,category:`isomer`,description:`Polar protic isomer (strong O–H dipole & H-bonding) — compare directly with constitutional isomer dimethyl ether!`,build:ee}),"dimethyl-ether":Object.freeze({id:`dimethyl-ether`,name:`Dimethyl Ether (C₂H₆O)`,formula:`C₂H₆O`,category:`isomer`,description:`Constitutional isomer of ethanol with identical C₂H₆O formula yet zero O–H H-bond donors.`,build:te}),"acetic-acid":Object.freeze({id:`acetic-acid`,name:`Acetic Acid (CH₃COOH)`,formula:`C₂H₄O₂`,category:`acid-base`,description:`Carboxylic acid whose deprotonated –COO⁻ conjugate base is resonance-stabilized across both oxygens.`,build:A}),"ethanol-water-hbond":Object.freeze({id:`ethanol-water-hbond`,name:`Ethanol–Water H-Bond Cluster`,formula:`C₂H₆O·2H₂O`,category:`isomer`,description:`Live explicit polar hydrogen-bonding network emerging purely from QEq partial charges and D–H···A geometry.`,build:ae}),"sn2-walden":Object.freeze({id:`sn2-walden`,name:`SN2 Backside Attack (Cl⁻ + CH₃Br)`,formula:`CH₃BrCl⁻`,category:`reaction`,description:`Concerted bimolecular nucleophilic substitution driving planar pentacoordinate TS and Walden umbrella inversion!`,build:re}),"diels-alder":Object.freeze({id:`diels-alder`,name:`Diels–Alder [4+2] Cycloaddition`,formula:`C₄H₆+C₂H₄`,category:`reaction`,description:`Concerted pericyclic [4+2] ring closure converting 1,3-butadiene + ethene into cyclohexene via bond-order flow.`,build:ie})});function M(e={}){let t=typeof e==`string`?j[e]?.build()||j.benzene.build():e,n=Array.isArray(t?.atoms)?t.atoms:[],r=Array.isArray(t?.bonds)?t.bonds:[],i=Number(t?.totalCharge)||0,a=n.length,o=Array.from({length:a},()=>[]),s=[];for(let e=0;e<r.length;e+=1){let t=r[e],n=Math.trunc(t.a),i=Math.trunc(t.b),c=Math.max(.5,Math.min(3,Number(t.order)||1));n<0||i<0||n>=a||i>=a||n===i||(s.push({a:n,b:i,order:c}),o[n].push({to:i,order:c,bondIdx:s.length-1}),o[i].push({to:n,order:c,bondIdx:s.length-1}))}let c=0,l=0,u=0,f=0;for(let e=0;e<a;e+=1){let t=n[e].pos||[e*1.4,0,0],r=_(n[e].Z);c+=t[0]*r.massU,l+=t[1]*r.massU,u+=t[2]*r.massU,f+=r.massU}f>0&&(c/=f,l/=f,u/=f);let p=n.map((e,t)=>{let n=_(e.Z),r=e.pos||[t*1.4,0,0],i=o[t],a=i.length,s=1,d=0;for(let e of i)e.order>s&&(s=e.order),e.order>1.25&&(d+=Math.round(e.order-1));let f=`s`;return f=n.Z===1?`s`:s>=2.5||d>=2?`sp`:s>=1.5||d===1?`sp2`:`sp3`,{index:t,Z:n.Z,sym:n.sym,massU:n.massU,chiEv:n.chiEv,etaEv:n.etaEv,rCovA:n.rCovA,rVdwA:n.rVdwA,huckelAlpha:n.huckelAlpha,piLonePair:n.piLonePair,rgb:[...n.rgb],pos:[r[0]-c,r[1]-l,r[2]-u],degree:a,hybridization:f,isPiAtom:f===`sp2`||f===`sp`,piElectrons:0}});for(let e=0;e<a;e+=1){let t=p[e];!t.isPiAtom&&t.piLonePair>0&&t.degree>=2&&o[e].some(e=>p[e.to].isPiAtom)&&(t.hybridization=`sp2`,t.isPiAtom=!0)}for(let e=0;e<a;e+=1){let t=p[e];t.isPiAtom&&(t.piElectrons=!o[e].some(e=>e.order>=1.5)&&t.piLonePair>=2?2:1)}let m=new Uint8Array(a),h=[],g=new Set;for(let e of s){let t=[[e.a]],n=new Set([e.a]);for(;t.length>0;){let r=t.shift(),i=r[r.length-1];if(r.length>7)break;for(let a of o[i])if(!(i===e.a&&a.to===e.b)){if(a.to===e.b&&r.length>=3){let n=[...r,e.b],i=[...n].sort((e,t)=>e-t).join(`,`);if(!g.has(i)){g.add(i),h.push(n);for(let e of n)m[e]=1}t.length=0;break}n.has(a.to)||(n.add(a.to),t.push([...r,a.to]))}}}let v=(e,t)=>{let n=p[e].Z,r=o[e].filter(e=>e.to!==t).map(e=>p[e.to].Z*Math.round(e.order)).sort((e,t)=>t-e),i=[];for(let n of o[e])if(n.to!==t)for(let t of o[n.to])t.to!==e&&i.push(p[t.to].Z);return i.sort((e,t)=>t-e),`${String(n).padStart(3,`0`)}:${r.map(e=>String(e).padStart(3,`0`)).join(`.`)}:${i.map(e=>String(e).padStart(3,`0`)).join(`.`)}`},S=[];for(let e=0;e<a;e+=1){let t=p[e];if(t.hybridization!==`sp3`||o[e].length!==4)continue;let n=o[e].map(t=>({to:t.to,key:v(t.to,e)}));if(n.sort((e,t)=>t.key>e.key?1:t.key<e.key?-1:0),new Set(n.map(e=>e.key)).size<4)continue;let r=t.pos,i=y(p[n[0].to].pos,r),a=y(p[n[1].to].pos,r),s=y(p[n[2].to].pos,r),c=y(p[n[3].to].pos,r),l=b(x(y(i,c),y(a,c)),y(s,c));Math.abs(l)>.05&&S.push({atomIndex:e,sym:t.sym,signedVolumeA3:l,configuration:l>0?`S`:`R`})}let w=[];for(let e=0;e<a;e+=1){let t=o[e],n=p[e].hybridization===`sp`?Math.PI:p[e].hybridization===`sp2`?2*Math.PI/3:1.910633;for(let r=0;r<t.length;r+=1)for(let i=r+1;i<t.length;i+=1){let a=n;if(m[e]&&p[e].hybridization===`sp2`){let n=C(y(p[t[r].to].pos,p[e].pos)),o=C(y(p[t[i].to].pos,p[e].pos)),s=Math.acos(Math.max(-.999,Math.min(.999,b(n,o))));s>1.35&&s<2.65&&(a=s)}w.push({i:t[r].to,j:e,k:t[i].to,eqRad:a,kAngle:p[e].hybridization===`sp2`?5.2:3.4})}}let T=[];for(let e of s){let t=e.a,n=e.b,r=o[t].filter(e=>e.to!==n),i=o[n].filter(e=>e.to!==t);if(!r.length||!i.length)continue;let a=e.order>=1.5||p[t].isPiAtom&&p[n].isPiAtom&&m[t]&&m[n],s=a?1.45:.14,c=a?2:3,l=a?Math.PI:0,u=0;for(let e of r)for(let r of i){if(u>=3)break;T.push({i:e.to,j:t,k:n,l:r.to,barrier:s,periodicity:c,phase:l}),u+=1}}let E=new Map;for(let e of p)E.set(e.sym,(E.get(e.sym)||0)+1);let D=[];E.has(`C`)&&(D.push(`C${E.get(`C`)>1?E.get(`C`):``}`),E.delete(`C`)),E.has(`H`)&&(D.push(`H${E.get(`H`)>1?E.get(`H`):``}`),E.delete(`H`));for(let e of[...E.keys()].sort())D.push(`${e}${E.get(e)>1?E.get(e):``}`);return Object.freeze({schema:d,formula:D.join(``),atomCount:a,bondCount:s.length,totalCharge:i,atoms:p,bonds:s,adj:o,rings:h,inRingAtom:m,chiralCenters:S,angles:w,dihedrals:T,reactionMeta:t?.reactionMeta||null,rotorMeta:t?.rotorMeta||null})}function se(e){return M({atoms:e.atoms.map(e=>({Z:e.Z,pos:[-e.pos[0],e.pos[1],e.pos[2]]})),bonds:e.bonds.map(e=>({a:e.a,b:e.b,order:e.order})),totalCharge:e.totalCharge,reactionMeta:e.reactionMeta,rotorMeta:e.rotorMeta})}function ce(e,{dielectricEr:t=1,totalCharge:n=null}={}){let r=e.atomCount,i=n??e.totalCharge??0,a=Math.max(1,Number(t)||1),o=14.3996/(1+.14*(1-1/a)),s=r+1,c=new Float64Array(s*s),l=new Float64Array(s);for(let t=0;t<r;t+=1){let n=e.atoms[t];c[t*s+t]=n.etaEv,c[t*s+r]=-1,c[r*s+t]=1,l[t]=-n.chiEv;for(let i=t+1;i<r;i+=1){let r=e.atoms[i],a=S(y(n.pos,r.pos)),l=Math.sqrt(Math.max(1e-4,n.etaEv*r.etaEv))/14.3996,u=o/Math.sqrt(a*a+1/Math.max(1e-4,l*l));c[t*s+i]=u,c[i*s+t]=u}}l[r]=i;let u=w(c,l),d=new Float32Array(r),f=0,p=0,m=0,h=0,g=0;for(let t=0;t<r;t+=1){let n=u[t];d[t]=n,Math.abs(n)>g&&(g=Math.abs(n));let r=e.atoms[t].pos;f+=n*r[0],p+=n*r[1],m+=n*r[2];let i=Math.max(.8,e.atoms[t].rVdwA*.92);h+=-.5*14.3996*(1-1/a)*(n*n)/i}let _=Math.hypot(f,p,m)*4.8032;return Object.freeze({charges:d,chemicalPotentialEv:u[r],dipoleVecEA:Object.freeze([f,p,m]),dipoleDebye:_,bornSolvationEv:h,bornSolvationKjMol:h*96.485,maxAbsCharge:g,dielectricEr:a})}function N(e){let t=[],n=new Int32Array(e.atomCount).fill(-1),r=0;for(let i=0;i<e.atomCount;i+=1)e.atoms[i].isPiAtom&&(n[i]=t.length,t.push(i),r+=e.atoms[i].piElectrons);let i=t.length,a=-2.75,o=new Float32Array(Math.max(1,i*i));for(let r=0;r<i;r+=1){let s=t[r],c=e.atoms[s];o[r*i+r]=c.huckelAlpha*2.75;for(let t of e.adj[s]){let s=n[t.to];if(s<0||s===r)continue;let l=S(y(c.pos,e.atoms[t.to].pos)),u=Math.exp(-1.75*Math.max(-.25,l-1.4));o[r*i+s]=a*u}}return{m:i,piIndices:t,atomToPi:n,totalPiElectrons:r,beta0Ev:a,H:o}}function P(e,t,n,r){let{m:i,piIndices:a,totalPiElectrons:o,beta0Ev:s}=t;if(i===0)return Object.freeze({piAtomCount:0,totalPiElectrons:0,piIndices:[],eigenvaluesEv:[],eigenvectors:new Float32Array,homoIndex:-1,lumoIndex:-1,homoLumoGapEv:0,uvVisLambdaMaxNm:0,totalPiEnergyEv:0,resonanceEnergyEv:0,isAromatic4nPlus2:!1,coulsonBondOrders:new Map});let c=new Float64Array(i),l=o,u=0;for(let e=0;e<i&&l>0;e+=1){let t=[e];for(;e+1<i&&Math.abs(n[e+1]-n[t[0]])<.001;)e+=1,t.push(e);let r=Math.min(2,l/t.length);for(let e of t)c[e]=r,r>.01&&(u=e);l=Math.max(0,l-r*t.length)}let d=Math.min(i-1,u+ +(c[u]>=1.99)),f=Math.max(0,n[d]-n[u]),p=f>.05?1239.84/f:0,m=0;for(let e=0;e<i;e+=1)m+=c[e]*n[e];let h=0;for(let t=0;t<i;t+=1){let n=e.atoms[a[t]];h+=n.piElectrons*n.huckelAlpha*Math.abs(s)}let g=Math.floor(o/2),_=h+g*2*s,v=m-_,y=new Map;for(let n of e.bonds){let e=t.atomToPi[n.a],a=t.atomToPi[n.b];if(e>=0&&a>=0){let t=0;for(let n=0;n<i;n+=1)t+=c[n]*r[e*i+n]*r[a*i+n];y.set(`${Math.min(n.a,n.b)}:${Math.max(n.a,n.b)}`,Math.max(0,Math.min(1,t)))}}let b=e.rings.some(t=>t.every(t=>e.atoms[t].isPiAtom))&&v<-.35&&f>.5;return Object.freeze({piAtomCount:i,totalPiElectrons:o,piIndices:a,eigenvaluesEv:Array.from(n.subarray(0,i)),eigenvectors:new Float32Array(r.subarray(0,i*i)),occupancies:Array.from(c),homoIndex:u,lumoIndex:d,homoLumoGapEv:f,uvVisLambdaMaxNm:p,totalPiEnergyEv:m,resonanceEnergyEv:v,isAromatic4nPlus2:b,coulsonBondOrders:y})}async function F(e,t){let n=N(t),r=n.m;if(r===0)return P(t,n,new Float32Array,new Float32Array);if(r===1)return P(t,n,new Float32Array([n.H[0]]),new Float32Array([1]));if(r<=64){let i=await a(e,{matrices:n.H,n:r,batchCount:1,maxSweeps:36,tolerance:1e-6});return P(t,n,i.eigenvalues,i.eigenvectors)}let i=new Uint8Array(r),o=[];for(let e=0;e<r;e+=1){if(i[e])continue;let t=[],a=[e];for(i[e]=1;a.length>0;){let e=a.pop();t.push(e);for(let t=0;t<r;t+=1)!i[t]&&Math.abs(n.H[e*r+t])>1e-7&&(i[t]=1,a.push(t))}t.sort((e,t)=>e-t),o.push(t)}let s=[];for(let t of o){let i=t.length;if(i===1){s.push({val:n.H[t[0]*r+t[0]],comp:t,vec:[1]});continue}let o=new Float32Array(i*i);for(let e=0;e<i;e+=1)for(let a=0;a<i;a+=1)o[e*i+a]=n.H[t[e]*r+t[a]];let c=i<=64?await a(e,{matrices:o,n:i,batchCount:1,maxSweeps:36,tolerance:1e-6}):null;if(c)for(let e=0;e<i;e+=1){let n=new Float32Array(i);for(let t=0;t<i;t+=1)n[t]=c.eigenvectors[t*i+e];s.push({val:c.eigenvalues[e],comp:t,vec:n})}}s.sort((e,t)=>e.val-t.val);let c=new Float32Array(r),l=new Float32Array(r*r);for(let e=0;e<Math.min(r,s.length);e+=1){c[e]=s[e].val;let{comp:t,vec:n}=s[e];for(let i=0;i<t.length;i+=1)l[t[i]*r+e]=n[i]}return P(t,n,c,l)}function I(e,t,n,{moIndex:r=null,pointCount:i=6144,seed:a=1337,reuseBuffer:o=null}={}){let s=n?.piAtomCount||0,c=new Float32Array(i*4);if(s>0){let e=Math.max(0,Math.min(s-1,r??n.homoIndex??0)),o=[],l=0;for(let t=0;t<s;t+=1){let r=n.eigenvectors[t*s+e],i=r*r;o.push({atomIdx:n.piIndices[t],c:r,w:i}),l+=i}let u=0,d=0,f=1;if(s>=3){let e=t.atoms[n.piIndices[0]].pos,r=t.atoms[n.piIndices[1]].pos,i=t.atoms[n.piIndices[2]].pos,a=x(y(r,e),y(i,e));S(a)>.001&&([u,d,f]=C(a))}let p=C(x([u,d,f],Math.abs(u)<.8?[1,0,0]:[0,1,0])),m=C(x([u,d,f],p)),h=a>>>0||1,g=()=>{h=h+1831565813|0;let e=Math.imul(h^h>>>15,1|h);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296};for(let e=0;e<i;e+=1){let n=g()*Math.max(1e-6,l),r=o[0];for(let e of o)if(n-=e.w,n<=0){r=e;break}let i=t.atoms[r.atomIdx].pos,a=Math.max(1e-5,g()),s=Math.max(1e-5,g()),h=-.42*Math.log(a*s)*.72+.16,_=g()<.5?1:-1,v=_*g()**.36,y=Math.sqrt(Math.max(0,1-v*v)),b=g()*Math.PI*2,x=h*v,S=h*y,C=i[0]+u*x+(p[0]*Math.cos(b)+m[0]*Math.sin(b))*S,w=i[1]+d*x+(p[1]*Math.cos(b)+m[1]*Math.sin(b))*S,T=i[2]+f*x+(p[2]*Math.cos(b)+m[2]*Math.sin(b))*S,E=Math.sign(r.c*_)*Math.min(1,Math.abs(r.c)*1.65*Math.exp(-h*.55));c[e*4+0]=C,c[e*4+1]=w,c[e*4+2]=T,c[e*4+3]=E}}let l=o&&o.size>=c.byteLength?o:e.createBuffer({label:`ulg-organic-pi-mo-cloud`,size:c.byteLength,usage:f.STORAGE|f.COPY_DST});return e.queue.writeBuffer(l,0,c),{pointsBuffer:l,pointCount:s>0?i:0}}function L(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`organic-molecular-graph-hybridization@1`)?e.resolveModule(`organic-molecular-graph-hybridization@1`)?.descriptor||null:e.registerModule({method:{model:`organic-molecular-graph-hybridization`,version:1},kernel:{sourceModule:`src/runtime/organic/organicMolecularGraphGpu.js`,entryPoint:`solvePiMolecularOrbitalsWebGpu`,workgroupSize:64},parameterSchema:{dielectricEr:{type:`number`,min:1,max:120,required:!1}},stateLayout:{tensorId:`organic-pi-mo-cloud`,dtype:`f32`,layout:`interleaved`,strideElements:4,strideBytes:16,fields:[`x`,`y`,`z`,`signedPhaseAmp`]},scaleRangeM:[1e-10,1e-8],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=M(r.moleculeId||`benzene`),a=await F(n,i),o=ce(i,{dielectricEr:r.dielectricEr??1});return t({artifactId:`${e.taskId}:organic-graph:${i.formula}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/organic/organicMolecularGraphGpu.js`,entryPoint:`solvePiMolecularOrbitalsWebGpu`,kernelEntryPoint:`jacobi_symmetric_batched`},representation:`organic-molecular-graph-f32`,outputs:{formula:i.formula,homoLumoGapEv:a.homoLumoGapEv,resonanceEnergyEv:a.resonanceEnergyEv,dipoleDebye:o.dipoleDebye},execution:{backend:`webgpu-organic-graph`,placement:`local`},validity:{finite:Number.isFinite(a.homoLumoGapEv)&&Number.isFinite(o.dipoleDebye)},validation:{status:`pass`,validationMode:`gpu-organic-electronic-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var le=`peercompute.ulg.radial-kohn-sham-webgpu.v1`,R=128,ue=1,z=`
struct KsParams {
  n_points: u32,
  use_pbe: u32,
  atomic_z: f32,
  dx: f32,
  mixing: f32,
  orbital_count: u32,
  _pad0: u32,
  _pad1: u32,
};

struct KsSummary {
  integrated_electrons: f32,
  e_hartree_double: f32,
  e_xc_correction: f32,
  scf_l1_delta: f32,
};

struct OrbitalMeta {
  n_quantum: f32,
  l_quantum: f32,
  occupancy: f32,
  energy_ha: f32,
};

struct SpinOrbitOut {
  xi_ha: f32,
  splitting_ha: f32,
  energy_j_minus_ha: f32,
  energy_j_plus_ha: f32,
};

@group(0) @binding(0) var<uniform> params: KsParams;
@group(0) @binding(1) var<storage, read> r_grid: array<f32>;
@group(0) @binding(2) var<storage, read_write> rho_grid: array<f32>;
@group(0) @binding(3) var<storage, read_write> vh_grid: array<f32>;
@group(0) @binding(4) var<storage, read_write> vxc_grid: array<f32>;
@group(0) @binding(5) var<storage, read_write> fxc_grid: array<f32>;
@group(0) @binding(6) var<storage, read_write> velec_grid: array<f32>;

const PI: f32 = 3.14159265358979323846;
const FOUR_PI: f32 = 12.56637061435917295385;
const KF_RS: f32 = 1.919158292677513;
const CHACHIYO_A: f32 = -0.015538303382756456;
const CHACHIYO_B: f32 = 20.4562557;
const PBE_KAPPA: f32 = 0.804;
const PBE_MU: f32 = 0.2195149727645171;
const PBE_GAMMA: f32 = 0.031090690869654895;
const PBE_BETA: f32 = 0.06672455060314922;
const ALPHA_FINE: f32 = 7.2973525693e-3;

var<workgroup> sh_q: array<f32, 256>;
var<workgroup> sh_p: array<f32, 256>;
var<workgroup> sh_rho: array<f32, 256>;
var<workgroup> sh_r: array<f32, 256>;
var<workgroup> sh_r2dfdg: array<f32, 256>;

fn cbrt_pos(x: f32) -> f32 {
  return pow(max(x, 1e-36), 1.0 / 3.0);
}

fn lda_eps_xc(rho: f32) -> f32 {
  if (rho <= 1e-14) { return 0.0; }
  let rs = cbrt_pos(3.0 / (FOUR_PI * rho));
  let eps_x = -(3.0 / FOUR_PI) * (KF_RS / rs);
  let eps_c = CHACHIYO_A * log(1.0 + CHACHIYO_B / rs + CHACHIYO_B / (rs * rs));
  return eps_x + eps_c;
}

fn lda_fxc(rho: f32) -> f32 {
  if (rho <= 1e-14) { return 0.0; }
  return rho * lda_eps_xc(rho);
}

fn lda_vxc(rho: f32) -> f32 {
  if (rho <= 1e-12) { return 0.0; }
  let d = rho * 1e-3 + 1e-13;
  return (lda_fxc(rho + d) - lda_fxc(max(1e-16, rho - d))) / (2.0 * d);
}

fn pbe_fxc(rho: f32, grad_mag: f32) -> f32 {
  if (rho <= 1e-14) { return 0.0; }
  let g = max(0.0, abs(grad_mag));
  let rs = cbrt_pos(3.0 / (FOUR_PI * rho));
  let kf = cbrt_pos(3.0 * PI * PI * rho);
  let s = g / max(2.0 * kf * rho, 1e-30);
  let s2 = s * s;
  let eps_x_lda = -0.75 * cbrt_pos(3.0 / PI) * cbrt_pos(rho);
  let fx = 1.0 + PBE_KAPPA - PBE_KAPPA / (1.0 + (PBE_MU / PBE_KAPPA) * s2);
  let eps_x_pbe = eps_x_lda * fx;
  let eps_c_lda = CHACHIYO_A * log(1.0 + CHACHIYO_B / rs + CHACHIYO_B / (rs * rs));
  let ks = sqrt((4.0 * kf) / PI);
  let t = g / max(2.0 * ks * rho, 1e-30);
  let t2 = t * t;
  let exp_arg = min(80.0, -eps_c_lda / PBE_GAMMA);
  let denom = exp(exp_arg) - 1.0;
  var H: f32 = 0.0;
  if (denom > 1e-20 && t2 > 0.0) {
    let A = (PBE_BETA / PBE_GAMMA) / denom;
    let At2 = min(1e12, A * t2);
    let ratio = (1.0 + At2) / (1.0 + At2 + At2 * At2);
    H = PBE_GAMMA * log(1.0 + (PBE_BETA / PBE_GAMMA) * t2 * ratio);
  }
  return rho * (eps_x_pbe + eps_c_lda + H);
}

@compute @workgroup_size(256, 1, 1)
fn ks_hartree_pbe_xc(@builtin(local_invocation_id) lid: vec3<u32>) {
  let i = lid.x;
  let n = min(params.n_points, 256u);
  let dx = params.dx;

  var ri: f32 = 1.0;
  var rhoi: f32 = 0.0;
  if (i < n) {
    ri = r_grid[i];
    rhoi = max(0.0, rho_grid[i]);
  }
  sh_r[i] = ri;
  sh_rho[i] = rhoi;
  // q_term = rho * r^3 * dx ; p_term = rho * r^2 * dx
  sh_q[i] = select(0.0, rhoi * ri * ri * ri * dx, i < n);
  // Reverse index for suffix sum p(r) = sum_{j>=i} rho_j * r_j^2 * dx
  let rev = select(0u, (n - 1u) - i, i < n);
  sh_p[rev] = select(0.0, rhoi * ri * ri * dx, i < n);
  workgroupBarrier();

  // Hillis-Steele inclusive prefix sum on sh_q and sh_p (N <= 256 -> 8 steps)
  for (var offset: u32 = 1u; offset < 256u; offset = offset << 1u) {
    var q_add: f32 = 0.0;
    var p_add: f32 = 0.0;
    if (i >= offset) {
      q_add = sh_q[i - offset];
      p_add = sh_p[i - offset];
    }
    workgroupBarrier();
    sh_q[i] = sh_q[i] + q_add;
    sh_p[i] = sh_p[i] + p_add;
    workgroupBarrier();
  }

  var vh_val: f32 = 0.0;
  if (i < n) {
    let q_val = sh_q[i];
    let p_val = sh_p[(n - 1u) - i];
    vh_val = FOUR_PI * (q_val / ri + p_val);
    vh_grid[i] = vh_val;
  }

  // Compute radial derivative rho'(r) = (1/r) * d(rho)/dx
  var rho_p: f32 = 0.0;
  if (i > 0u && i + 1u < n) {
    rho_p = (sh_rho[i + 1u] - sh_rho[i - 1u]) / (2.0 * dx * ri);
  }
  workgroupBarrier();
  if (i == 0u && n > 2u) {
    rho_p = (sh_rho[2u] - sh_rho[0u]) / (2.0 * dx * sh_r[1u]);
  } else if (i + 1u == n && n > 2u) {
    rho_p = (sh_rho[n - 1u] - sh_rho[n - 3u]) / (2.0 * dx * sh_r[n - 2u]);
  }

  var fxc_val: f32 = 0.0;
  var df_drho: f32 = 0.0;
  var r2_df_dg: f32 = 0.0;
  if (i < n) {
    if (params.use_pbe != 0u) {
      if (rhoi > 1e-13) {
        let g_abs = abs(rho_p);
        fxc_val = pbe_fxc(rhoi, g_abs);
        let d_rho = rhoi * 1e-3 + 1e-13;
        df_drho = (pbe_fxc(rhoi + d_rho, g_abs) - pbe_fxc(max(1e-16, rhoi - d_rho), g_abs)) / (2.0 * d_rho);
        let d_g = g_abs * 1e-3 + 1e-10;
        let df_dg = (pbe_fxc(rhoi, g_abs + d_g) - pbe_fxc(rhoi, max(0.0, g_abs - d_g))) / (2.0 * d_g);
        let sign_g = select(-1.0, 1.0, rho_p >= 0.0);
        r2_df_dg = ri * ri * df_dg * sign_g;
      }
    } else {
      fxc_val = lda_fxc(rhoi);
      df_drho = lda_vxc(rhoi);
    }
  }
  sh_r2dfdg[i] = r2_df_dg;
  workgroupBarrier();

  if (i < n) {
    if (params.use_pbe == 2u) {
      vh_grid[i] = 0.0;
      fxc_grid[i] = 0.0;
      vxc_grid[i] = 0.0;
      velec_grid[i] = 0.0;
      return;
    }
    var vxc_val: f32 = df_drho;
    if (params.use_pbe == 1u && rhoi > 1e-13) {
      var div_term: f32 = 0.0;
      if (i > 0u && i + 1u < n) {
        div_term = (sh_r2dfdg[i + 1u] - sh_r2dfdg[i - 1u]) / (2.0 * dx * ri);
      } else if (i == 0u && n > 2u) {
        div_term = (sh_r2dfdg[2u] - sh_r2dfdg[0u]) / (2.0 * dx * sh_r[1u]);
      } else if (i + 1u == n && n > 2u) {
        div_term = (sh_r2dfdg[n - 1u] - sh_r2dfdg[n - 3u]) / (2.0 * dx * sh_r[n - 2u]);
      }
      let v_raw = df_drho - div_term / (ri * ri);
      let v_lda = lda_vxc(rhoi);
      // Guard numerical finiteness & extreme edge spikes near r_min
      vxc_val = select(v_lda, v_raw, abs(v_raw) < 1e8);
    }
    fxc_grid[i] = fxc_val;
    vxc_grid[i] = vxc_val;
    velec_grid[i] = vh_val + vxc_val;
  }
}
`,B=`
struct KsParams {
  n_points: u32,
  use_pbe: u32,
  atomic_z: f32,
  dx: f32,
  mixing: f32,
  orbital_count: u32,
  _pad0: u32,
  _pad1: u32,
};

struct KsSummary {
  integrated_electrons: f32,
  e_hartree_double: f32,
  e_xc_correction: f32,
  scf_l1_delta: f32,
};

struct OrbitalMeta {
  n_quantum: f32,
  l_quantum: f32,
  occupancy: f32,
  energy_ha: f32,
};

struct SpinOrbitOut {
  xi_ha: f32,
  splitting_ha: f32,
  energy_j_minus_ha: f32,
  energy_j_plus_ha: f32,
};

@group(0) @binding(0) var<uniform> params: KsParams;
@group(0) @binding(1) var<storage, read> r_grid: array<f32>;
@group(0) @binding(2) var<storage, read> orbitals_u: array<f32>;
@group(0) @binding(3) var<storage, read> orbital_meta: array<OrbitalMeta>;
@group(0) @binding(4) var<storage, read_write> rho_grid: array<f32>;
@group(0) @binding(5) var<storage, read> vh_grid: array<f32>;
@group(0) @binding(6) var<storage, read> vxc_fxc_velec: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> summary_out: array<KsSummary>;

const FOUR_PI: f32 = 12.56637061435917295385;
var<workgroup> sh_ne: array<f32, 256>;
var<workgroup> sh_eh: array<f32, 256>;
var<workgroup> sh_exc: array<f32, 256>;
var<workgroup> sh_delta: array<f32, 256>;

@compute @workgroup_size(256, 1, 1)
fn ks_density_and_observables(@builtin(local_invocation_id) lid: vec3<u32>) {
  let i = lid.x;
  let n = min(params.n_points, 256u);
  let dx = params.dx;
  let orb_count = params.orbital_count;

  var ne_i: f32 = 0.0;
  var eh_i: f32 = 0.0;
  var exc_i: f32 = 0.0;
  var delta_i: f32 = 0.0;

  if (i < n) {
    let ri = r_grid[i];
    let inv_4pi_r2 = 1.0 / (FOUR_PI * ri * ri);
    var rho_new: f32 = 0.0;
    for (var s: u32 = 0u; s < orb_count; s = s + 1u) {
      let occ = orbital_meta[s].occupancy;
      if (occ <= 0.0) { continue; }
      let u_val = orbitals_u[s * n + i];
      rho_new = rho_new + occ * u_val * u_val * inv_4pi_r2;
    }
    let rho_old = rho_grid[i];
    let dV = FOUR_PI * ri * ri * ri * dx;
    delta_i = abs(rho_new - rho_old) * dV;
    let rho_mixed = (1.0 - params.mixing) * rho_old + params.mixing * rho_new;
    rho_grid[i] = rho_mixed;

    let vh = vh_grid[i];
    let aux = vxc_fxc_velec[i]; // x=vxc, y=fxc, z=velec
    ne_i = rho_mixed * dV;
    eh_i = 0.5 * rho_mixed * vh * dV;
    exc_i = (aux.y - aux.x * rho_mixed) * dV;
  }

  sh_ne[i] = ne_i;
  sh_eh[i] = eh_i;
  sh_exc[i] = exc_i;
  sh_delta[i] = delta_i;
  workgroupBarrier();

  for (var stride: u32 = 128u; stride > 0u; stride = stride >> 1u) {
    if (i < stride) {
      sh_ne[i] = sh_ne[i] + sh_ne[i + stride];
      sh_eh[i] = sh_eh[i] + sh_eh[i + stride];
      sh_exc[i] = sh_exc[i] + sh_exc[i + stride];
      sh_delta[i] = sh_delta[i] + sh_delta[i + stride];
    }
    workgroupBarrier();
  }

  if (i == 0u) {
    summary_out[0] = KsSummary(sh_ne[0], sh_eh[0], sh_exc[0], sh_delta[0]);
  }
}
`,V=`
struct KsParams {
  n_points: u32,
  use_pbe: u32,
  atomic_z: f32,
  dx: f32,
  mixing: f32,
  orbital_count: u32,
  _pad0: u32,
  _pad1: u32,
};

struct OrbitalMeta {
  n_quantum: f32,
  l_quantum: f32,
  occupancy: f32,
  energy_ha: f32,
};

struct SpinOrbitOut {
  xi_ha: f32,
  splitting_ha: f32,
  energy_j_minus_ha: f32,
  energy_j_plus_ha: f32,
};

@group(0) @binding(0) var<uniform> params: KsParams;
@group(0) @binding(1) var<storage, read> r_grid: array<f32>;
@group(0) @binding(2) var<storage, read> orbitals_u: array<f32>;
@group(0) @binding(3) var<storage, read> orbital_meta: array<OrbitalMeta>;
@group(0) @binding(4) var<storage, read> velec_grid: array<f32>;
@group(0) @binding(5) var<storage, read_write> so_out: array<SpinOrbitOut>;

const ALPHA_FINE: f32 = 7.2973525693e-3;
var<workgroup> sh_xi: array<f32, 256>;

@compute @workgroup_size(256, 1, 1)
fn ks_spin_orbit_quadrature(
  @builtin(workgroup_id) wg_id: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let s = wg_id.x;
  let i = lid.x;
  let n = min(params.n_points, 256u);
  if (s >= params.orbital_count) { return; }

  let orb_info = orbital_meta[s];
  let l_val = orb_info.l_quantum;
  var contrib: f32 = 0.0;
  if (l_val >= 1.0 && i < n) {
    let ri = r_grid[i];
    let dx = params.dx;
    let velec_i = velec_grid[i];
    var velec_p: f32 = 0.0;
    if (i > 0u && i + 1u < n) {
      velec_p = (velec_grid[i + 1u] - velec_grid[i - 1u]) / (2.0 * dx * ri);
    } else if (i == 0u && n > 2u) {
      velec_p = (velec_grid[2u] - velec_grid[0u]) / (2.0 * dx * r_grid[1u]);
    } else if (i + 1u == n && n > 2u) {
      velec_p = (velec_grid[n - 1u] - velec_grid[n - 3u]) / (2.0 * dx * r_grid[n - 2u]);
    }
    let a2h = 0.5 * ALPHA_FINE * ALPHA_FINE;
    let v_tot = -params.atomic_z / ri + velec_i;
    let v_prime = params.atomic_z / (ri * ri) + velec_p;
    let M = 1.0 + a2h * (orb_info.energy_ha - v_tot);
    let u_val = orbitals_u[s * n + i];
    contrib = a2h * (v_prime / (M * M)) * u_val * u_val * dx;
  }

  sh_xi[i] = contrib;
  workgroupBarrier();
  for (var stride: u32 = 128u; stride > 0u; stride = stride >> 1u) {
    if (i < stride) {
      sh_xi[i] = sh_xi[i] + sh_xi[i + stride];
    }
    workgroupBarrier();
  }

  if (i == 0u) {
    let xi = select(0.0, sh_xi[0], l_val >= 1.0);
    let shift_plus = select(0.0, 0.5 * l_val * xi, l_val >= 1.0);
    let shift_minus = select(0.0, -0.5 * (l_val + 1.0) * xi, l_val >= 1.0);
    so_out[s] = SpinOrbitOut(
      xi,
      select(0.0, (l_val + 0.5) * xi, l_val >= 1.0),
      orb_info.energy_ha + shift_minus,
      orb_info.energy_ha + shift_plus
    );
  }
}
`,H=`
struct KsParams {
  n_points: u32,
  use_pbe: u32,
  atomic_z: f32,
  dx: f32,
  mixing: f32,
  orbital_count: u32,
  use_rel: u32,
  r_nuc_bohr: f32,
};

struct OrbitalMeta {
  n_quantum: f32,
  l_quantum: f32,
  occupancy: f32,
  energy_ha: f32,
};

struct DiracSubshellOut {
  energy_j_minus_ha: f32,
  energy_j_plus_ha: f32,
  splitting_ha: f32,
  small_component_norm_sq: f32,
};

@group(0) @binding(0) var<uniform> params: KsParams;
@group(0) @binding(1) var<storage, read> r_grid: array<f32>;
@group(0) @binding(2) var<storage, read> vxc_grid: array<f32>;
@group(0) @binding(3) var<storage, read> fxc_grid: array<f32>;
@group(0) @binding(4) var<storage, read> velec_grid: array<f32>;
@group(0) @binding(5) var<storage, read_write> vxc_fxc_velec: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> orbitals_u: array<f32>;
@group(0) @binding(7) var<storage, read_write> orbital_meta: array<OrbitalMeta>;
@group(0) @binding(8) var<storage, read_write> dirac_out: array<DiracSubshellOut>;

const C_LIGHT: f32 = 137.035999084;

var<workgroup> sh_diag: array<f32, 256>;
var<workgroup> sh_off: array<f32, 256>;
var<workgroup> sh_cp: array<f32, 256>;
var<workgroup> sh_dp: array<f32, 256>;
var<workgroup> sh_vec: array<f32, 256>;
var<workgroup> sh_u_plus: array<f32, 256>;

// Pack GPU-resident vxc/fxc/velec buffers into aux vec4 buffer with zero CPU readback.
@compute @workgroup_size(256, 1, 1)
fn ks_pack_aux(@builtin(local_invocation_id) lid: vec3<u32>) {
  let i = lid.x;
  if (i < min(params.n_points, 256u)) {
    vxc_fxc_velec[i] = vec4<f32>(vxc_grid[i], fxc_grid[i], velec_grid[i], 0.0);
  }
}

fn sturm_count_below(n: u32, lam: f32) -> u32 {
  var count: u32 = 0u;
  var d: f32 = sh_diag[0] - lam;
  if (d < 0.0) { count = count + 1u; }
  for (var i: u32 = 1u; i < n; i = i + 1u) {
    let off_prev = sh_off[i - 1u];
    let safe_d = select(select(-1e-30, 1e-30, d >= 0.0), d, abs(d) >= 1e-30);
    d = (sh_diag[i] - lam) - (off_prev * off_prev) / safe_d;
    if (d < 0.0) { count = count + 1u; }
  }
  return count;
}

fn eval_v_nuc(ri: f32, z: f32, r_eq: f32) -> f32 {
  return select(
    -z / ri,
    -(z / (2.0 * max(r_eq, 1e-12))) * (3.0 - (ri * ri) / max(r_eq * r_eq, 1e-24)),
    r_eq > 0.0 && ri < r_eq
  );
}

fn eval_dv_nuc_dr(ri: f32, z: f32, r_eq: f32) -> f32 {
  return select(
    z / (ri * ri),
    (z * ri) / max(r_eq * r_eq * r_eq, 1e-30),
    r_eq > 0.0 && ri < r_eq
  );
}

fn eval_dv_elec_dr(i: u32, n: u32, dx: f32) -> f32 {
  if (i > 0u && i + 1u < n) {
    return (velec_grid[i + 1u] - velec_grid[i - 1u]) / (2.0 * dx * r_grid[i]);
  }
  if (i == 0u && n > 2u) {
    return (velec_grid[2u] - velec_grid[0u]) / (2.0 * dx * r_grid[1u]);
  }
  if (i + 1u == n && n > 2u) {
    return (velec_grid[n - 1u] - velec_grid[n - 3u]) / (2.0 * dx * r_grid[n - 2u]);
  }
  return 0.0;
}

// Solve one relativistic kappa channel (kappa_+ = -(l+1) or kappa_- = +l):
// populates sh_vec[0..n-1] with signed sqrt(G^2 + F^2) (normalized 4-component spinor)
// and returns vec2(eigenvalue_ha, small_component_norm_sq).
fn solve_dirac_kappa_channel(
  n: u32,
  n_q: u32,
  l_q: u32,
  target_k: u32,
  kappa: f32,
  e_ref: f32,
  dx: f32,
  inv_dx2: f32,
  l_cent: f32,
  z: f32,
  r_eq: f32,
  inv_2c2: f32,
  use_rel: u32
) -> vec2<f32> {
  let apply_dirac_so = (use_rel == 2u) && (l_q >= 1u);
  var min_diag: f32 = 1e30;
  for (var i: u32 = 0u; i < n; i = i + 1u) {
    let ri = r_grid[i];
    let inv_r2 = 1.0 / (ri * ri);
    let v_eff = eval_v_nuc(ri, z, r_eq) + velec_grid[i];
    let m_rel = select(1.0, max(1.0, 1.0 + max(0.0, e_ref - v_eff) * inv_2c2), use_rel != 0u);
    let inv_m = 1.0 / m_rel;
    var v_so: f32 = 0.0;
    if (apply_dirac_so) {
      let v_prime = eval_dv_nuc_dr(ri, z, r_eq) + eval_dv_elec_dr(i, n, dx);
      // Exact folded 4-component Dirac spin-orbit term: -(kappa + 1) / (4 M^2 c^2 r) * dV/dr
      let v_so_raw = -(kappa + 1.0) * (0.5 * inv_2c2) * (v_prime / (m_rel * m_rel * ri));
      let cent_cap = 0.45 * l_cent * inv_r2 * inv_m;
      v_so = clamp(v_so_raw, -cent_cap, cent_cap);
    }
    let d_val = (inv_dx2 + l_cent) * inv_r2 * inv_m + v_eff + v_so;
    sh_diag[i] = d_val;
    if (d_val < min_diag) { min_diag = d_val; }
    if (i + 1u < n) {
      let r_next = r_grid[i + 1u];
      let v_eff_n = eval_v_nuc(r_next, z, r_eq) + velec_grid[i + 1u];
      let m_rel_n = select(1.0, max(1.0, 1.0 + max(0.0, e_ref - v_eff_n) * inv_2c2), use_rel != 0u);
      let inv_m_mid = 2.0 / (m_rel + m_rel_n);
      sh_off[i] = -0.5 * inv_dx2 * inv_m_mid / (ri * r_next);
    } else {
      sh_off[i] = 0.0;
    }
  }

  // Bracket eigenvalue k strictly via Gershgorin lower bound & positive upper bound.
  var lo: f32 = min(-0.6 * z * z / f32(n_q * n_q) - 4.0, min_diag - 2.0);
  var hi: f32 = 1.0;
  for (var widen: u32 = 0u; widen < 10u; widen = widen + 1u) {
    if (sturm_count_below(n, lo) <= target_k) { break; }
    lo = lo * 2.0 - 1.0;
  }
  for (var widen: u32 = 0u; widen < 10u; widen = widen + 1u) {
    if (sturm_count_below(n, hi) > target_k) { break; }
    hi = hi * 2.0 + 1.0;
  }

  for (var it: u32 = 0u; it < 42u; it = it + 1u) {
    let mid = 0.5 * (lo + hi);
    if (sturm_count_below(n, mid) <= target_k) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  let eig = 0.5 * (lo + hi);

  // Shifted Thomas inverse iteration for radial eigenfunction w(x) = sqrt(r)*G(r)
  let shift = eig - max(abs(eig) * 1e-5, 1e-6);
  for (var i: u32 = 0u; i < n; i = i + 1u) {
    let ri = r_grid[i];
    sh_vec[i] = pow(ri, f32(l_q) + 1.0) * exp(-z * ri / f32(n_q));
  }
  for (var sweep: u32 = 0u; sweep < 5u; sweep = sweep + 1u) {
    var denom = sh_diag[0] - shift;
    if (abs(denom) < 1e-24) { denom = select(-1e-24, 1e-24, denom >= 0.0); }
    sh_cp[0] = sh_off[0] / denom;
    sh_dp[0] = sh_vec[0] / denom;
    for (var i: u32 = 1u; i < n; i = i + 1u) {
      let b_prev = sh_off[i - 1u];
      var m = (sh_diag[i] - shift) - b_prev * sh_cp[i - 1u];
      if (abs(m) < 1e-24) { m = select(-1e-24, 1e-24, m >= 0.0); }
      sh_cp[i] = select(0.0, sh_off[i] / m, i + 1u < n);
      sh_dp[i] = (sh_vec[i] - b_prev * sh_dp[i - 1u]) / m;
    }
    sh_vec[n - 1u] = sh_dp[n - 1u];
    var max_abs: f32 = abs(sh_vec[n - 1u]);
    for (var rev: u32 = 1u; rev < n; rev = rev + 1u) {
      let i = (n - 1u) - rev;
      let val = sh_dp[i] - sh_cp[i] * sh_vec[i + 1u];
      sh_vec[i] = val;
      max_abs = max(max_abs, abs(val));
    }
    let inv_max = 1.0 / max(max_abs, 1e-30);
    for (var i: u32 = 0u; i < n; i = i + 1u) {
      sh_vec[i] = sh_vec[i] * inv_max;
    }
  }

  // Recover large component G(r) = w(x) / sqrt(r) (storing G in sh_dp temporarily)
  for (var i: u32 = 0u; i < n; i = i + 1u) {
    sh_dp[i] = sh_vec[i] / sqrt(r_grid[i]);
  }

  // Reconstruct exact Dirac small component F(r) = (1 / (2 M c)) * (dG/dx + kappa * G) / r
  // and normalize the 4-component Dirac spinor: integral (G^2 + F^2) * r * dx = 1.
  var norm_g_sq: f32 = 0.0;
  var norm_f_sq: f32 = 0.0;
  for (var i: u32 = 0u; i < n; i = i + 1u) {
    let ri = r_grid[i];
    let g_val = sh_dp[i];
    var f_val: f32 = 0.0;
    if (use_rel != 0u) {
      var dg_dx: f32 = 0.0;
      if (i > 0u && i + 1u < n) {
        dg_dx = (sh_dp[i + 1u] - sh_dp[i - 1u]) / (2.0 * dx);
      } else if (i == 0u && n > 1u) {
        dg_dx = (sh_dp[1u] - sh_dp[0u]) / dx;
      } else if (n > 1u) {
        dg_dx = (sh_dp[n - 1u] - sh_dp[n - 2u]) / dx;
      }
      let v_eff = eval_v_nuc(ri, z, r_eq) + velec_grid[i];
      let m_rel = max(1.0, 1.0 + max(0.0, eig - v_eff) * inv_2c2);
      f_val = (dg_dx + kappa * g_val) / (2.0 * m_rel * C_LIGHT * ri);
    }
    let g2 = g_val * g_val;
    let f2 = f_val * f_val;
    norm_g_sq = norm_g_sq + g2 * ri * dx;
    norm_f_sq = norm_f_sq + f2 * ri * dx;
    let mag4 = sqrt(max(0.0, g2 + f2));
    sh_vec[i] = select(-mag4, mag4, g_val >= 0.0);
  }
  let total_norm = max(norm_g_sq + norm_f_sq, 1e-30);
  let inv_norm = 1.0 / sqrt(total_norm);
  for (var i: u32 = 0u; i < n; i = i + 1u) {
    sh_vec[i] = sh_vec[i] * inv_norm;
  }
  let small_norm_sq = clamp(norm_f_sq / total_norm, 0.0, 0.49);
  return vec2<f32>(eig, small_norm_sq);
}

// GPU-native 4-Component Radial Dirac-Kohn-Sham (and scalar KH / Schrodinger)
// Sturm-sequence bisection + shifted Thomas inverse-iteration eigensolver
// (1 workgroup per subshell, zero CPU readback during SCF).
@compute @workgroup_size(1, 1, 1)
fn ks_solve_radial_orbitals(@builtin(workgroup_id) wg_id: vec3<u32>) {
  let s = wg_id.x;
  let n = min(params.n_points, 256u);
  if (s >= params.orbital_count || n < 8u) { return; }

  let orb_info = orbital_meta[s];
  let n_q = max(1u, u32(round(orb_info.n_quantum)));
  let l_q = u32(max(0.0, round(orb_info.l_quantum)));
  let target_k = select(0u, n_q - l_q - 1u, n_q > l_q);
  let dx = params.dx;
  let inv_dx2 = 1.0 / (dx * dx);
  let l_cent = 0.5 * (f32(l_q) + 0.5) * (f32(l_q) + 0.5);
  let z = params.atomic_z;
  let r_eq = sqrt(5.0 / 3.0) * max(0.0, params.r_nuc_bohr);
  let inv_2c2 = 1.0 / (2.0 * C_LIGHT * C_LIGHT);
  let e_ref = clamp(orb_info.energy_ha, -0.75 * z * z, 0.0);

  let kappa_plus = -(f32(l_q) + 1.0);
  let res_plus = solve_dirac_kappa_channel(
    n, n_q, l_q, target_k, kappa_plus, e_ref, dx, inv_dx2, l_cent, z, r_eq, inv_2c2, params.use_rel
  );

  if (params.use_rel == 2u && l_q >= 1u) {
    // Save j = l + 1/2 signed 4-component amplitude before solving j = l - 1/2 (kappa = +l)
    for (var i: u32 = 0u; i < n; i = i + 1u) {
      sh_u_plus[i] = sh_vec[i];
    }
    let kappa_minus = f32(l_q);
    let res_minus = solve_dirac_kappa_channel(
      n, n_q, l_q, target_k, kappa_minus, e_ref, dx, inv_dx2, l_cent, z, r_eq, inv_2c2, params.use_rel
    );
    let lf = f32(l_q);
    let w_plus = (2.0 * lf + 2.0) / (4.0 * lf + 2.0);
    let w_minus = 1.0 - w_plus;
    for (var i: u32 = 0u; i < n; i = i + 1u) {
      let up = sh_u_plus[i];
      let um = sh_vec[i];
      let mag = sqrt(max(0.0, w_plus * up * up + w_minus * um * um));
      orbitals_u[s * n + i] = select(-mag, mag, up >= 0.0);
    }
    let e_avg = w_plus * res_plus.x + w_minus * res_minus.x;
    let sf_avg = w_plus * res_plus.y + w_minus * res_minus.y;
    orbital_meta[s].energy_ha = e_avg;
    dirac_out[s] = DiracSubshellOut(res_minus.x, res_plus.x, res_plus.x - res_minus.x, sf_avg);
  } else {
    for (var i: u32 = 0u; i < n; i = i + 1u) {
      orbitals_u[s * n + i] = sh_vec[i];
    }
    orbital_meta[s].energy_ha = res_plus.x;
    dirac_out[s] = DiracSubshellOut(res_plus.x, res_plus.x, 0.0, res_plus.y);
  }
}
`;function U(e){let t=2166136261,n=2654435769;for(let r=0;r<e.length;r+=1){let i=e.charCodeAt(r);t=Math.imul(t^i,16777619)>>>0,n=Math.imul(n^i+r,2246822507)>>>0}return`wgsl-fnv1a64:${t.toString(16).padStart(8,`0`)}${n.toString(16).padStart(8,`0`)}`}var de=U(`${z}::${B}::${V}::${H}`),W=new WeakMap;function fe(e){let t=W.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-ks-potential-wgsl`,code:z}),r=e.createShaderModule({label:`ulg-ks-observables-wgsl`,code:B}),i=e.createShaderModule({label:`ulg-ks-spinorbit-wgsl`,code:V}),a=e.createShaderModule({label:`ulg-ks-eigensolver-wgsl`,code:H}),o=e.createBindGroupLayout({label:`ulg-ks-pot-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}}]}),s=e.createBindGroupLayout({label:`ulg-ks-obs-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`read-only-storage`}},{binding:6,visibility:4,buffer:{type:`read-only-storage`}},{binding:7,visibility:4,buffer:{type:`storage`}}]}),c=e.createBindGroupLayout({label:`ulg-ks-so-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`read-only-storage`}},{binding:5,visibility:4,buffer:{type:`storage`}}]}),l=e.createBindGroupLayout({label:`ulg-ks-eig-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`read-only-storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}},{binding:7,visibility:4,buffer:{type:`storage`}},{binding:8,visibility:4,buffer:{type:`storage`}}]});return t={potPipeline:e.createComputePipeline({label:`ulg-ks-pot-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[o]}),compute:{module:n,entryPoint:`ks_hartree_pbe_xc`}}),obsPipeline:e.createComputePipeline({label:`ulg-ks-obs-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[s]}),compute:{module:r,entryPoint:`ks_density_and_observables`}}),soPipeline:e.createComputePipeline({label:`ulg-ks-so-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:i,entryPoint:`ks_spin_orbit_quadrature`}}),packAuxPipeline:e.createComputePipeline({label:`ulg-ks-pack-aux-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:a,entryPoint:`ks_pack_aux`}}),eigPipeline:e.createComputePipeline({label:`ulg-ks-eig-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:a,entryPoint:`ks_solve_radial_orbitals`}}),potBgl:o,obsBgl:s,soBgl:c,eigBgl:l},W.set(e,t),t}async function G(e,t,{functional:n=`pbe`,spinOrbit:r=!0,scalarRelativistic:i=!1,nuclearChargeRadiusBohr:a=0,nuclearMassU:c=null,nuclearSpinI:l=0,nuclearMagneticMomentMuN:u=0,configuration:d=null,gridPointsN:f=256,rMinBohr:p=1e-4,rMaxBohr:m=null,mixing:h=.25,maxScf:g=60,returnRadialDensity:_=!0,returnOrbitalWavefunctions:v=!1}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`solveAtomFullWebGpu requires a valid WebGPU GPUDevice.`);let y=Math.min(256,Math.max(64,Math.floor(f))),b=String(n||`pbe`).toLowerCase(),x=b===`bare`?2:+(b===`pbe`),S=i?r?2:1:0,C=Math.max(0,Number(a)||0),w=m??Math.max(20,60/Math.sqrt(t)),T=Math.log(p),E=(Math.log(w)-T)/(y-1),D=new Float64Array(y),ee=new Float32Array(y),te=new Float32Array(y);for(let e=0;e<y;e+=1){let n=Math.exp(T+e*E);D[e]=n,ee[e]=n,te[e]=t*(t**3/Math.PI)*Math.exp(-2*t*n)}let O=d??s(t),k=O.length,A=new Float32Array(Math.max(1,k)*4);for(let e=0;e<k;e+=1)A[e*4+0]=O[e].n,A[e*4+1]=O[e].l,A[e*4+2]=O[e].occupancy,A[e*4+3]=-(t*t)/(2*O[e].n*O[e].n);let{potPipeline:ne,obsPipeline:re,soPipeline:ie,packAuxPipeline:ae,eigPipeline:oe,potBgl:j,obsBgl:M,soBgl:se,eigBgl:ce}=fe(e),N=y*4,P=new ArrayBuffer(32),F=new Uint32Array(P),I=new Float32Array(P);F[0]=y,F[1]=x,I[2]=t,I[3]=E,I[4]=h,F[5]=k,F[6]=S,I[7]=C;let L=e.createBuffer({size:32,usage:72}),z=e.createBuffer({size:N,usage:136}),B=e.createBuffer({size:N,usage:140}),V=e.createBuffer({size:N,usage:R}),H=e.createBuffer({size:N,usage:R}),U=e.createBuffer({size:N,usage:R}),W=e.createBuffer({size:N,usage:R}),G=e.createBuffer({size:N*4,usage:R}),K=e.createBuffer({size:Math.max(1,k)*N,usage:v?132:R}),q=e.createBuffer({size:Math.max(1,k)*16,usage:140}),J=e.createBuffer({size:Math.max(1,k)*16,usage:132}),Y=e.createBuffer({size:16,usage:132}),X=e.createBuffer({size:Math.max(1,k)*16,usage:132}),Z=v?Math.max(1,k)*N:0,pe=Math.max(1,k)*16,Q=16+pe*3+N+Z,$=e.createBuffer({size:Q,usage:9});try{e.queue.writeBuffer(L,0,P),e.queue.writeBuffer(z,0,ee),e.queue.writeBuffer(B,0,te),e.queue.writeBuffer(q,0,A);let n=e.createBindGroup({layout:j,entries:[L,z,B,V,H,U,W].map((e,t)=>({binding:t,resource:{buffer:e}}))}),i=e.createBindGroup({layout:ce,entries:[L,z,H,U,W,G,K,q,J].map((e,t)=>({binding:t,resource:{buffer:e}}))}),a=e.createBindGroup({layout:M,entries:[L,z,K,q,B,V,G,Y].map((e,t)=>({binding:t,resource:{buffer:e}}))}),s=e.createBindGroup({layout:se,entries:[L,z,K,q,W,X].map((e,t)=>({binding:t,resource:{buffer:e}}))}),d=e.createCommandEncoder({label:`ulg-ks-full-webgpu-scf`}),f=d.beginComputePass({label:`ulg-ks-full-webgpu-scf-pass`}),p=Math.max(1,Math.min(120,Math.floor(g)));for(let e=0;e<p;e+=1)f.setPipeline(ne),f.setBindGroup(0,n),f.dispatchWorkgroups(1,1,1),f.setPipeline(ae),f.setBindGroup(0,i),f.dispatchWorkgroups(1,1,1),f.setPipeline(oe),f.setBindGroup(0,i),f.dispatchWorkgroups(Math.max(1,k),1,1),f.setPipeline(re),f.setBindGroup(0,a),f.dispatchWorkgroups(1,1,1);f.setPipeline(ie),f.setBindGroup(0,s),f.dispatchWorkgroups(Math.max(1,k),1,1),f.end();let m=pe;d.copyBufferToBuffer(Y,0,$,0,16),d.copyBufferToBuffer(q,0,$,16,m),d.copyBufferToBuffer(X,0,$,16+m,m),d.copyBufferToBuffer(J,0,$,16+m*2,m),d.copyBufferToBuffer(B,0,$,16+m*3,N),v&&Z>0&&d.copyBufferToBuffer(K,0,$,16+m*3+N,Z),e.queue.submit([d.finish()]),await $.mapAsync(ue);let h=new Float32Array($.getMappedRange().slice(0));$.unmap();let b={integratedElectrons:h[0],eHartreeDouble:h[1],eXcCorrection:h[2],scfL1Delta:h[3]},w=4+k*4,T=4+k*8,F=4+k*12,I=F+y,R=Array.from(h.slice(F,F+y)),fe=v?Array.from({length:k},(e,t)=>h.slice(I+t*y,I+(t+1)*y)):null,Q=0,me=0,he=0,ge=[];for(let e=0;e<k;e+=1){let t=h[4+e*4+3],n=O[e],i=h[T+e*4+0],a=h[T+e*4+1],o=h[T+e*4+2],s=Math.max(0,Number(h[T+e*4+3])||0);Q+=n.occupancy*t,me+=n.occupancy,he+=n.occupancy*s;let c={n:n.n,l:n.l,occupancy:n.occupancy,energyHa:t,kappaPlus:-(n.l+1),...n.l>=1?{kappaMinus:n.l}:{},smallComponentNormSq:s};r&&n.l>=1&&(S===2&&Number.isFinite(i)&&Number.isFinite(a)?(c.energyJMinusHa=i,c.energyJPlusHa=a,c.spinOrbitSplittingHa=o,c.spinOrbitXiHa=o/(n.l+.5)):(c.spinOrbitXiHa=h[w+e*4+0],c.spinOrbitSplittingHa=h[w+e*4+1],c.energyJMinusHa=h[w+e*4+2],c.energyJPlusHa=h[w+e*4+3])),ge.push(c)}let _e=Q-b.eHartreeDouble+b.eXcCorrection,ve=Number(c),ye=Number.isFinite(ve)&&ve>0,be=ye?1/(1+1/(ve*1822.8884862)):1,xe=_e*be,Se=xe-_e,Ce=t/137.035999084,we=S?4/(3*Math.PI)*(1/137.035999084)**3*t**4*Math.max(.5,Math.log(1/Math.max(1e-6,Ce*Ce))-2.3):0,Te=Math.max(0,Number(l)||0),Ee=Number(u)||0,De=Math.max(0,R[0]||0),Oe=0,ke=0;for(let e of ge){let n=2*(2*e.l+1);e.l===0&&e.electrons>0&&e.electrons<n?Oe=Math.max(Oe,1/(Math.max(1,e.n)**3*Math.max(1,t**1.4))):e.l>0&&e.electrons>0&&e.electrons<n&&(ke=Math.max(ke,.002/(Math.max(1,e.n)**3*Math.max(1,t**1.6))))}let Ae=t===1?De:De*Math.max(Oe,ke),je=Te>0&&Math.abs(Ee)>0&&Ae>0?Ae*Math.PI*1420405751*(Math.abs(Ee)/2.792847)*((Te+.5)/1):0;return{schema:le,symbol:o(t),atomicNumberZ:t,configuration:O,functional:x===2?`bare`:x?`pbe`:`lda`,dirac4Component:S===2,totalSmallComponentNormSq:he,relativisticMethod:S===2?`dirac-4comp-gpu+qed`:S===1?`koelling-harmon-gpu+qed`:r?`schrodinger-log-gpu+spin-orbit`:`schrodinger-log-gpu`,finiteNucleusUsed:C>0,nuclearChargeRadiusBohr:C,nuclearMassU:ye?ve:null,reducedMassFactor:be,isotopeMassShiftHa:Se,hyperfineSplittingHz:je,qedRadiativeShiftHa:we,totalEnergyHa:xe+we,orbitals:ge,electronCount:me,integratedElectrons:b.integratedElectrons,scfIterations:p,scfL1Delta:b.scfL1Delta,resolverStatus:`webgpu-derived`,webgpuNativeEigensolver:!0,perScfCpuReadbacks:0,webgpuProgramHash:de,..._?{radialGrid:{r:Array.from(D),rho:R,dx:E}}:{},...v&&fe?{orbitalWavefunctions:fe}:{},validation:Object.freeze({scientificValidation:!1,webgpuParity:!1})}}finally{for(let e of[L,z,B,V,H,U,W,G,K,q,J,Y,X,$])e.destroy()}}var K=`ulg.gpumath.fft3d-webgpu.v1`,q=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),J=`
struct FftParams {
  n: u32,
  log_n: u32,
  axis: u32,      // 0 = X, 1 = Y, 2 = Z
  stage: u32,     // 0 .. log_n - 1
  direction: f32, // -1.0 for forward FFT, +1.0 for inverse IFFT
  scale: f32,     // normalization or box length L
  smooth_r2: f32, // optional Gaussian smoothing r_s^2 (for TreePM split)
  grad_axis: u32, // 0 = phi, 1 = dphi/dx, 2 = dphi/dy, 3 = dphi/dz
};

@group(0) @binding(0) var<uniform> params: FftParams;
@group(0) @binding(1) var<storage, read> src_grid: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> dst_grid: array<vec2<f32>>;

const TWO_PI: f32 = 6.28318530717958647692;

fn bit_reverse(val: u32, bits: u32) -> u32 {
  var x = val;
  var r = 0u;
  for (var i = 0u; i < bits; i = i + 1u) {
    r = (r << 1u) | (x & 1u);
    x = x >> 1u;
  }
  return r;
}

fn c_mul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

fn grid_idx(x: u32, y: u32, z: u32, n: u32) -> u32 {
  return (z * n + y) * n + x;
}

@compute @workgroup_size(64)
fn bitrev_axis(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let total = n * n * n;
  let idx = id.x;
  if (idx >= total) { return; }
  let x = idx % n;
  let y = (idx / n) % n;
  let z = idx / (n * n);
  var sx = x;
  var sy = y;
  var sz = z;
  if (params.axis == 0u) {
    sx = bit_reverse(x, params.log_n);
  } else if (params.axis == 1u) {
    sy = bit_reverse(y, params.log_n);
  } else {
    sz = bit_reverse(z, params.log_n);
  }
  dst_grid[idx] = src_grid[grid_idx(sx, sy, sz, n)];
}

@compute @workgroup_size(64)
fn butterfly_axis(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let half_total = (n * n * n) >> 1u;
  let b_idx = id.x;
  if (b_idx >= half_total) { return; }

  let half_n = n >> 1u;
  let pair_in_line = b_idx % half_n;
  let line_id = b_idx / half_n;
  let line_a = line_id % n;
  let line_b = line_id / n;

  let m = 1u << (params.stage + 1u);
  let half_m = m >> 1u;
  let group = pair_in_line / half_m;
  let j = pair_in_line % half_m;
  let i0 = group * m + j;
  let i1 = i0 + half_m;

  var p0: u32;
  var p1: u32;
  if (params.axis == 0u) {
    p0 = grid_idx(i0, line_a, line_b, n);
    p1 = grid_idx(i1, line_a, line_b, n);
  } else if (params.axis == 1u) {
    p0 = grid_idx(line_a, i0, line_b, n);
    p1 = grid_idx(line_a, i1, line_b, n);
  } else {
    p0 = grid_idx(line_a, line_b, i0, n);
    p1 = grid_idx(line_a, line_b, i1, n);
  }

  let angle = params.direction * TWO_PI * f32(j) / f32(m);
  let twiddle = vec2<f32>(cos(angle), sin(angle));
  let u = src_grid[p0];
  let t = c_mul(twiddle, src_grid[p1]);
  dst_grid[p0] = u + t;
  dst_grid[p1] = u - t;
}

@compute @workgroup_size(64)
fn scale_grid(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let total = n * n * n;
  let idx = id.x;
  if (idx >= total) { return; }
  dst_grid[idx] = src_grid[idx] * params.scale;
}

// Spectral 3D Poisson kernel in k-space for periodic box length L = params.scale:
//   nabla^2 phi = rhs  ==>  phi_hat(k) = -rhs_hat(k) / |k|^2 * exp(-|k|^2 * smooth_r2)
//   grad_axis == 1,2,3 computes d(phi)/d(x_axis) = i * k_axis * phi_hat(k)
@compute @workgroup_size(64)
fn poisson_kspace(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let total = n * n * n;
  let idx = id.x;
  if (idx >= total) { return; }
  let ix = idx % n;
  let iy = (idx / n) % n;
  let iz = idx / (n * n);
  if (ix == 0u && iy == 0u && iz == 0u) {
    dst_grid[idx] = vec2<f32>(0.0, 0.0);
    return;
  }
  let half_n = n >> 1u;
  let nx = select(f32(ix), f32(ix) - f32(n), ix >= half_n);
  let ny = select(f32(iy), f32(iy) - f32(n), iy >= half_n);
  let nz = select(f32(iz), f32(iz) - f32(n), iz >= half_n);
  let dk = TWO_PI / max(params.scale, 1.0e-30);
  let kx = nx * dk;
  let ky = ny * dk;
  let kz = nz * dk;
  let k2 = kx * kx + ky * ky + kz * kz;
  let gauss_win = select(1.0, exp(-k2 * params.smooth_r2), params.smooth_r2 > 0.0);
  let green = -(gauss_win / k2);
  let rhs_k = src_grid[idx];
  let phi_k = rhs_k * green;
  if (params.grad_axis == 0u) {
    dst_grid[idx] = phi_k;
  } else {
    let k_comp = select(select(kz, ky, params.grad_axis == 2u), kx, params.grad_axis == 1u);
    // Multiply by i * k_comp: i*(a + ib) = (-b + ia)
    dst_grid[idx] = vec2<f32>(-phi_k.y * k_comp, phi_k.x * k_comp);
  }
}
`;function Y(e){let t=Math.trunc(Number(e));if(!(t>=4&&t<=128&&!(t&t-1)))throw RangeError(`fft3dWebGpu requires power-of-2 N in [4..128], got ${e}`);return{dim:t,logN:Math.round(Math.log2(t))}}function X(e){let t=[l(0,`uniform`),l(1,`read-only-storage`),l(2,`storage`)];return{bitrev:c(e,{cacheKey:`ulg-gpumath-fft3d-bitrev.v1`,label:`ulg-gpumath-fft3d-bitrev`,code:J,entryPoint:`bitrev_axis`,bindings:t}),butterfly:c(e,{cacheKey:`ulg-gpumath-fft3d-butterfly.v1`,label:`ulg-gpumath-fft3d-butterfly`,code:J,entryPoint:`butterfly_axis`,bindings:t}),scale:c(e,{cacheKey:`ulg-gpumath-fft3d-scale.v1`,label:`ulg-gpumath-fft3d-scale`,code:J,entryPoint:`scale_grid`,bindings:t}),poisson:c(e,{cacheKey:`ulg-gpumath-fft3d-poisson.v1`,label:`ulg-gpumath-fft3d-poisson`,code:J,entryPoint:`poisson_kspace`,bindings:t})}}function Z(e,t){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createFft3dWorkspaceWebGpu requires a live WebGPU GPUDevice`);let{dim:n,logN:r}=Y(t),i=n*n*n,a=i*8,o=X(e),s=o.butterfly.bindGroupLayout,c=e.createBuffer({label:`ulg-fft3d-${n}-a`,size:a,usage:q.STORAGE|q.COPY_DST|q.COPY_SRC}),l=e.createBuffer({label:`ulg-fft3d-${n}-b`,size:a,usage:q.STORAGE|q.COPY_DST|q.COPY_SRC}),u=[],d=(t,i,a,o=1,s=0,c=0)=>{let l=new ArrayBuffer(32);new Uint32Array(l,0,4).set([n,r,t,i]),new Float32Array(l,16,3).set([a,o,s]),new Uint32Array(l,28,1).set([c]);let d=e.createBuffer({size:32,usage:q.UNIFORM|q.COPY_DST});return e.queue.writeBuffer(d,0,l),u.push(d),d},f=(t,n,r)=>e.createBindGroup({layout:s,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:r}}]}),p=(e=>{let t=[],n=c,a=l,s=()=>{let e=n;n=a,a=e};for(let c=0;c<3;c+=1){let l=d(c,0,e);t.push({pipeline:o.bitrev.pipeline,bg:f(l,n,a),wg:Math.ceil(i/64)}),s();for(let l=0;l<r;l+=1){let r=d(c,l,e);t.push({pipeline:o.butterfly.pipeline,bg:f(r,n,a),wg:Math.ceil((i>>1)/64)}),s()}}if(e>0){let e=d(0,0,1,1/i);t.push({pipeline:o.scale.pipeline,bg:f(e,n,a),wg:Math.ceil(i/64)}),s()}return{steps:t,outputBuffer:n,scratchBuffer:a}})(-1),m=(e,t,n)=>{let a=[],s=t,c=n,l=()=>{let e=s;s=c,c=e};for(let t=0;t<3;t+=1){let n=d(t,0,e);a.push({pipeline:o.bitrev.pipeline,bg:f(n,s,c),wg:Math.ceil(i/64)}),l();for(let n=0;n<r;n+=1){let r=d(t,n,e);a.push({pipeline:o.butterfly.pipeline,bg:f(r,s,c),wg:Math.ceil((i>>1)/64)}),l()}}if(e>0){let e=d(0,0,1,1/i);a.push({pipeline:o.scale.pipeline,bg:f(e,s,c),wg:Math.ceil(i/64)}),l()}return{steps:a,outputBuffer:s,scratchBuffer:c}},h=m(1,c,l),g=m(1,l,c),_=e.createBuffer({size:32,usage:q.UNIFORM|q.COPY_DST});u.push(_);let v=f(_,c,l),y=f(_,l,c),b=[0,1,2,3].map(()=>{let t=e.createBuffer({size:32,usage:q.UNIFORM|q.COPY_DST});return u.push(t),t}),x=b.map(e=>f(e,c,l)),S=b.map(e=>f(e,l,c)),C=new WeakMap;function w(e,t){let n=C.get(e);return n||(n=b.map(t=>f(t,e,c)),C.set(e,n)),n[t]}function T(e,t,n){let r=e.beginComputePass({label:n});for(let e of t.steps)r.setPipeline(e.pipeline),r.setBindGroup(0,e.bg),r.dispatchWorkgroups(e.wg);return r.end(),t.outputBuffer}function E(t,{boxLength:i=1,smoothR2:a=0}={}){let o=new ArrayBuffer(32);new Uint32Array(o,0,4).set([n,r,0,0]),new Float32Array(o,16,3).set([-1,Number(i),Number(a)]),new Uint32Array(o,28,1).set([t]),e.queue.writeBuffer(b[t],0,o)}return Object.freeze({schema:K,n,total:i,byteLength:a,inputBuffer:c,bufferA:c,bufferB:l,forwardOutputBuffer:p.outputBuffer,encodeForward(e){return T(e,p,`ulg-fft3d-fwd-${n}`)},encodeInverseFrom(e,t){return T(e,t===c?h:g,`ulg-fft3d-inv-${n}`)},writeAxisPoissonParams({boxLength:e=1,smoothR2:t=0}={}){for(let n=0;n<=3;n+=1)E(n,{boxLength:e,smoothR2:t})},encodePoissonInverseFromKSpace(e,t,{gradAxis:r=0}={}){let a=Math.max(0,Math.min(3,Math.trunc(r))),s,u;t===c?(s=x[a],u=l):t===l?(s=S[a],u=c):(s=w(t,a),u=c);let d=e.beginComputePass({label:`ulg-poisson-kspace-ax${a}-${n}`});return d.setPipeline(o.poisson.pipeline),d.setBindGroup(0,s),d.dispatchWorkgroups(Math.ceil(i/64)),d.end(),T(e,u===c?h:g,`ulg-poisson-inv-ax${a}-${n}`)},encodePoissonSolve(t,{boxLength:a=1,smoothR2:s=0,gradAxis:u=0}={}){let d=new ArrayBuffer(32);new Uint32Array(d,0,4).set([n,r,0,0]),new Float32Array(d,16,3).set([-1,Number(a),Number(s)]),new Uint32Array(d,28,1).set([Math.trunc(u)]),e.queue.writeBuffer(_,0,d);let f=T(t,p,`ulg-poisson-fwd-${n}`),m=t.beginComputePass({label:`ulg-poisson-kspace-${n}`});return m.setPipeline(o.poisson.pipeline),m.setBindGroup(0,f===c?v:y),m.dispatchWorkgroups(Math.ceil(i/64)),m.end(),T(t,(f===c?l:c)===c?h:g,`ulg-poisson-inv-${n}`)},destroy(){c.destroy(),l.destroy();for(let e of u)e.destroy()}})}async function pe(e,{data:t,n,inverse:r=!1}={}){let i=Z(e,n),a=t instanceof Float32Array?t:Float32Array.from(t);if(a.length!==i.total*2)throw i.destroy(),RangeError(`Expected ${i.total*2} complex floats for N=${n}, got ${a.length}`);let o=e.createBuffer({size:i.byteLength,usage:q.MAP_READ|q.COPY_DST});try{e.queue.writeBuffer(i.inputBuffer,0,a);let t=e.createCommandEncoder({label:`ulg-fft3d-oneshot`}),n=r?i.encodeInverseFrom(t,i.inputBuffer):i.encodeForward(t);t.copyBufferToBuffer(n,0,o,0,i.byteLength),e.queue.submit([t.finish()]),await o.mapAsync(q.MAP_READ);let s=new Float32Array(o.getMappedRange().slice(0,i.byteLength));return o.unmap(),Object.freeze({schema:K,backend:`webgpu`,n:i.n,inverse:!!r,data:s})}finally{o.destroy(),i.destroy()}}async function Q({label:e=`ulg-webgpu`,retries:t=6,retryDelayMs:n=200,requiredFeatures:r=[],optionalLimits:i=null,xrCompatible:a=!1}={}){if(typeof navigator>`u`||!navigator.gpu)throw Error(`WebGPU is unavailable in this browser. Use Chrome 121+, Edge 121+, or Safari 18+/26+ with WebGPU enabled over HTTPS.`);let o=null;for(let e=0;e<t&&!o;e+=1){if(a&&navigator.xr!==void 0){try{o=await navigator.gpu.requestAdapter({powerPreference:`high-performance`,xrCompatible:!0})}catch{o=null}if(!o)try{o=await navigator.gpu.requestAdapter({xrCompatible:!0})}catch{o=null}}if(!o)try{o=await navigator.gpu.requestAdapter({powerPreference:`high-performance`})}catch{o=null}if(!o)try{o=await navigator.gpu.requestAdapter()}catch{o=null}!o&&e+1<t&&await new Promise(e=>setTimeout(e,n))}if(!o)throw Error(`No compatible WebGPU GPUAdapter available (${e}).`);let s={label:e};if(Array.isArray(r)&&r.length>0&&o.features){let e=r.filter(e=>o.features.has(e));e.length>0&&(s.requiredFeatures=e)}if(i&&typeof i==`object`&&o.limits){let e={};for(let[t,n]of Object.entries(i)){let r=Number(o.limits[t]),i=Number(n);Number.isFinite(r)&&Number.isFinite(i)&&i>0&&(e[t]=Math.min(r,i))}Object.keys(e).length>0&&(s.requiredLimits=e)}let c=null;try{c=await o.requestDevice(s)}catch{c=await o.requestDevice()}return{adapter:o,device:c}}function $(e,t,{preferCopySrc:n=!1}={}){if(!e)throw Error(`WebGPU canvas context unavailable`);let r=typeof navigator<`u`&&navigator.gpu?.getPreferredCanvasFormat?navigator.gpu.getPreferredCanvasFormat():`bgra8unorm`,i=[];n&&(i.push({device:t,format:r,alphaMode:`opaque`,usage:17}),i.push({device:t,format:r,alphaMode:`premultiplied`,usage:17})),i.push({device:t,format:r,alphaMode:`opaque`}),i.push({device:t,format:r,alphaMode:`premultiplied`});let a=null;for(let t of i)try{return e.configure(t),{format:r,alphaMode:t.alphaMode}}catch(e){a=e}if(a)throw a;return{format:r,alphaMode:`opaque`}}function me(e){let t=Number(e?.deltaY)||0;return e?.deltaMode===1?t*=16:e?.deltaMode===2&&(t*=240),e?.ctrlKey&&(t*=3.2),t}var he=`
const ULG_PI: f32 = 3.14159265359;

fn ulg_srgb_to_linear(c: vec3<f32>) -> vec3<f32> {
  return pow(max(c, vec3<f32>(0.0)), vec3<f32>(2.2));
}

fn ulg_linear_to_srgb(c: vec3<f32>) -> vec3<f32> {
  return pow(max(c, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.2));
}

fn ulg_aces_filmic(x: vec3<f32>) -> vec3<f32> {
  let c = max(x, vec3<f32>(0.0));
  return clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn ulg_complex_f0(n_rgb: vec3<f32>, k_rgb: vec3<f32>) -> vec3<f32> {
  let num = (n_rgb - vec3<f32>(1.0)) * (n_rgb - vec3<f32>(1.0)) + k_rgb * k_rgb;
  let den = (n_rgb + vec3<f32>(1.0)) * (n_rgb + vec3<f32>(1.0)) + k_rgb * k_rgb;
  return clamp(num / max(den, vec3<f32>(1e-5)), vec3<f32>(0.02), vec3<f32>(0.995));
}

fn ulg_dielectric_f0(ior: f32) -> f32 {
  let n = max(1.0, ior);
  let r = (n - 1.0) / (n + 1.0);
  return clamp(r * r, 0.015, 0.35);
}

fn ulg_fresnel_schlick(cos_theta: f32, f0: vec3<f32>) -> vec3<f32> {
  let x = clamp(1.0 - max(0.0, cos_theta), 0.0, 1.0);
  let x2 = x * x;
  return f0 + (vec3<f32>(1.0) - f0) * (x2 * x2 * x);
}

fn ulg_fresnel_schlick_rough(cos_theta: f32, f0: vec3<f32>, roughness: f32) -> vec3<f32> {
  let x = clamp(1.0 - max(0.0, cos_theta), 0.0, 1.0);
  let x2 = x * x;
  let max_f = max(vec3<f32>(1.0 - clamp(roughness, 0.04, 1.0)), f0);
  return f0 + (max_f - f0) * (x2 * x2 * x);
}

fn ulg_d_ggx(ndh: f32, roughness: f32) -> f32 {
  let r = clamp(roughness, 0.04, 1.0);
  let a = r * r;
  let a2 = a * a;
  let d = ndh * ndh * (a2 - 1.0) + 1.0;
  return a2 / max(ULG_PI * d * d, 1e-5);
}

fn ulg_v_smith_ggx(ndv: f32, ndl: f32, roughness: f32) -> f32 {
  let r = clamp(roughness, 0.04, 1.0);
  let a = r * r;
  let a2 = a * a;
  let ggx_v = ndl * sqrt(max(1e-6, ndv * ndv * (1.0 - a2) + a2));
  let ggx_l = ndv * sqrt(max(1e-6, ndl * ndl * (1.0 - a2) + a2));
  return 0.5 / max(ggx_v + ggx_l, 1e-5);
}

// Energy-conserving direct Cook-Torrance GGX + Lambert BRDF in linear light space
fn ulg_pbr_direct(
  n: vec3<f32>,
  v: vec3<f32>,
  l: vec3<f32>,
  albedo_lin: vec3<f32>,
  f0_rgb: vec3<f32>,
  metallic: f32,
  roughness: f32,
  radiance: vec3<f32>
) -> vec3<f32> {
  let ndl = max(0.0, dot(n, l));
  if (ndl <= 0.0) { return vec3<f32>(0.0); }
  let ndv = max(1e-4, dot(n, v));
  let h = normalize(l + v);
  let ndh = max(0.0, dot(n, h));
  let vdh = max(0.0, dot(v, h));

  let F = ulg_fresnel_schlick(vdh, f0_rgb);
  let D = ulg_d_ggx(ndh, roughness);
  let V = ulg_v_smith_ggx(ndv, ndl, roughness);
  let spec = D * V * F;
  let k_d = (vec3<f32>(1.0) - F) * (1.0 - clamp(metallic, 0.0, 1.0));
  let diff = k_d * albedo_lin / ULG_PI;
  return (diff + spec) * radiance * ndl;
}

// Analytic split-sum studio/sky hemisphere IBL (gives true colored conductor reflections & dielectric glazing)
fn ulg_pbr_env_hemi(
  n: vec3<f32>,
  v: vec3<f32>,
  albedo_lin: vec3<f32>,
  f0_rgb: vec3<f32>,
  metallic: f32,
  roughness: f32,
  sky_zen_lin: vec3<f32>,
  sky_hor_lin: vec3<f32>,
  ground_lin: vec3<f32>
) -> vec3<f32> {
  let ndv = max(1e-4, dot(n, v));
  let r_dir = reflect(-v, n);
  let r_up = clamp(r_dir.y, -1.0, 1.0);
  let n_up = clamp(n.y, -1.0, 1.0);

  let env_sharp = select(
    mix(sky_hor_lin, ground_lin, clamp(-r_up * 1.4, 0.0, 1.0)),
    mix(sky_hor_lin, sky_zen_lin, pow(clamp(r_up, 0.0, 1.0), 0.65)),
    r_up >= 0.0
  );
  let env_blur = mix(ground_lin, mix(sky_hor_lin, sky_zen_lin, 0.55), n_up * 0.5 + 0.5);
  let env_spec = mix(env_sharp, env_blur, clamp(roughness * roughness, 0.0, 1.0));

  let F_env = ulg_fresnel_schlick_rough(ndv, f0_rgb, roughness);
  let k_d = (vec3<f32>(1.0) - F_env) * (1.0 - clamp(metallic, 0.0, 1.0));
  let spec_atten = 1.0 - clamp(roughness, 0.04, 1.0) * 0.42;
  return k_d * albedo_lin * env_blur + F_env * env_spec * spec_atten;
}
`;export{Z as a,p as c,I as d,v as f,ce as g,F as h,Q as i,j as l,L as m,$ as n,pe as o,se as p,me as r,G as s,he as t,M as u};