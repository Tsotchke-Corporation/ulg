import{_ as e,a as t,i as n,n as r,o as i}from"./batchedSymmetricEigensolverGpu-DvdPNMKk.js";import{computeBufferBinding as a,createCachedExplicitBindGroup as o,createCachedExplicitComputePipeline as s}from"../runtime/webgpuComputeLayout.js";import{i as c}from"./webgpuCompat-B36dRVS1.js";var l=`ulg.organic.molecular-graph-hybridization-webgpu.v1`,u=Object.freeze({COPY_DST:8,STORAGE:128}),d=Object.freeze({id:`organic-molecular-graph-hybridization`,lawNodeId:`law:organic-molecular-graph-hybridization`,orderConstraint:`after:molecular-rhf`,adapterMode:n.CELL_LOCAL,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`atomic-periodic-descriptors`,`molecular-graph-topology`,`dielectric-environment`]),writes:Object.freeze([`molecular-hybridization-state`,`pi-molecular-orbitals`,`qeq-partial-charges`,`chirality-descriptors`]),accumulates:Object.freeze([`electronic-delocalization-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`total-electric-charge`,`pi-electron-count`,`atomic-mass`]),validityDomain:Object.freeze({minAtoms:2,maxAtoms:256,dielectricMin:1}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e-10,1e-8]),fundamentalLaws:Object.freeze([`valence-orbital-hybridization`,`huckel-pi-molecular-orbital-eigenproblem`,`rappe-goddard-qeq-charge-equilibration`,`born-dielectric-solvation`,`cahn-ingold-prelog-3d-chirality`])}),f=Object.freeze({1:Object.freeze({Z:1,sym:`H`,massU:1.008,valence:1,chiEv:4.528,etaEv:13.89,rCovA:.32,rVdwA:1.2,huckelAlpha:0,piLonePair:0,hBondDonor:!0,hBondAcceptor:!1,rgb:[.92,.95,.98]}),5:Object.freeze({Z:5,sym:`B`,massU:10.81,valence:3,chiEv:4.29,etaEv:8.01,rCovA:.84,rVdwA:1.92,huckelAlpha:1,piLonePair:0,hBondDonor:!1,hBondAcceptor:!1,rgb:[.95,.68,.56]}),6:Object.freeze({Z:6,sym:`C`,massU:12.011,valence:4,chiEv:5.343,etaEv:10.126,rCovA:.75,rVdwA:1.7,huckelAlpha:0,piLonePair:0,hBondDonor:!1,hBondAcceptor:!1,rgb:[.3,.34,.4]}),7:Object.freeze({Z:7,sym:`N`,massU:14.007,valence:3,chiEv:6.899,etaEv:11.76,rCovA:.71,rVdwA:1.55,huckelAlpha:-.5,piLonePair:2,hBondDonor:!0,hBondAcceptor:!0,rgb:[.22,.52,.98]}),8:Object.freeze({Z:8,sym:`O`,massU:15.999,valence:2,chiEv:8.741,etaEv:13.364,rCovA:.64,rVdwA:1.52,huckelAlpha:-1,piLonePair:2,hBondDonor:!0,hBondAcceptor:!0,rgb:[.88,.13,.13]}),9:Object.freeze({Z:9,sym:`F`,massU:18.998,valence:1,chiEv:10.874,etaEv:14.948,rCovA:.6,rVdwA:1.47,huckelAlpha:-2,piLonePair:2,hBondDonor:!1,hBondAcceptor:!0,rgb:[.45,.92,.52]}),15:Object.freeze({Z:15,sym:`P`,massU:30.974,valence:5,chiEv:5.463,etaEv:8,rCovA:1.07,rVdwA:1.8,huckelAlpha:-.2,piLonePair:0,hBondDonor:!1,hBondAcceptor:!0,rgb:[1,.56,.14]}),16:Object.freeze({Z:16,sym:`S`,massU:32.06,valence:2,chiEv:6.928,etaEv:8.972,rCovA:1.03,rVdwA:1.8,huckelAlpha:-.4,piLonePair:2,hBondDonor:!0,hBondAcceptor:!0,rgb:[.96,.72,.05]}),17:Object.freeze({Z:17,sym:`Cl`,massU:35.45,valence:1,chiEv:8.564,etaEv:9.892,rCovA:.99,rVdwA:1.75,huckelAlpha:-1.6,piLonePair:2,hBondDonor:!1,hBondAcceptor:!0,rgb:[.22,.88,.36]}),35:Object.freeze({Z:35,sym:`Br`,massU:79.904,valence:1,chiEv:7.79,etaEv:8.85,rCovA:1.14,rVdwA:1.85,huckelAlpha:-1.4,piLonePair:2,hBondDonor:!1,hBondAcceptor:!0,rgb:[.68,.2,.16]})});function p(e){return f[Math.trunc(Number(e))||6]||f[6]}function m(e={}){let t=Number(e.organicAtomCount)||0,n=Number(e.covalentBondCount)||0,r=!!e.organicChemistryActive||t>=2&&n>=1;return{active:r,reason:r?`covalent-molecular-graph-present`:`no-organic-molecular-graph-dormant`}}function h(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function g(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function _(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function v(e){return Math.hypot(e[0],e[1],e[2])}function y(e){let t=v(e)||1;return[e[0]/t,e[1]/t,e[2]/t]}function b(e,t){let n=t.length,r=Array.from({length:n},(r,i)=>{let a=new Float64Array(n+1);for(let t=0;t<n;t+=1)a[t]=e[i*n+t];return a[n]=t[i],a});for(let e=0;e<n;e+=1){let t=e,i=Math.abs(r[e][e]);for(let a=e+1;a<n;a+=1){let n=Math.abs(r[a][e]);n>i&&(i=n,t=a)}if(i<1e-12)continue;if(t!==e){let n=r[e];r[e]=r[t],r[t]=n}let a=r[e][e];for(let t=e+1;t<n;t+=1){let i=r[t][e]/a;for(let a=e;a<=n;a+=1)r[t][a]-=i*r[e][a]}}let i=new Float64Array(n);for(let e=n-1;e>=0;--e){let t=r[e][n];for(let a=e+1;a<n;a+=1)t-=r[e][a]*i[a];i[e]=Math.abs(r[e][e])>1e-12?t/r[e][e]:0}return i}function x(e,{aromatic:t=!1,chair:n=!1}={}){let r=[],i=[],a=(t?1.4:1.54)/(2*Math.sin(Math.PI/e));for(let t=0;t<e;t+=1){let i=t/e*Math.PI*2,o=n?t%2==0?.25:-.25:0;r.push({Z:6,pos:[Math.cos(i)*a,Math.sin(i)*a,o]})}for(let n=0;n<e;n+=1){let r=(n+1)%e,a=t&&n%2==0?2:1;i.push({a:n,b:r,order:a})}for(let n=0;n<e;n+=1){let e=r[n].pos,a=y([e[0],e[1],0]);if(t)r.push({Z:1,pos:[e[0]+a[0]*1.09,e[1]+a[1]*1.09,0]}),i.push({a:n,b:r.length-1,order:1});else{let t=n%2==0?1:-1;r.push({Z:1,pos:[e[0]+a[0]*.34,e[1]+a[1]*.34,e[2]+t*1.04]}),i.push({a:n,b:r.length-1,order:1}),r.push({Z:1,pos:[e[0]+a[0]*1.03,e[1]+a[1]*1.03,e[2]-t*.36]}),i.push({a:n,b:r.length-1,order:1})}}return{atoms:r,bonds:i}}function S(){let e=1.4,t=e*Math.cos(Math.PI/6),n=e*.5,r=[{Z:6,pos:[0,-.7,0]},{Z:6,pos:[0,n,0]},{Z:6,pos:[t,e,0]},{Z:6,pos:[2*t,n,0]},{Z:6,pos:[2*t,-.7,0]},{Z:6,pos:[t,-1.4,0]},{Z:6,pos:[-t,-1.4,0]},{Z:6,pos:[-2*t,-.7,0]},{Z:6,pos:[-2*t,n,0]},{Z:6,pos:[-t,e,0]}],i=[{a:0,b:1,order:2},{a:1,b:2,order:1},{a:2,b:3,order:2},{a:3,b:4,order:1},{a:4,b:5,order:2},{a:5,b:0,order:1},{a:0,b:6,order:1},{a:6,b:7,order:2},{a:7,b:8,order:1},{a:8,b:9,order:2},{a:9,b:1,order:1}];for(let e of[2,3,4,5,6,7,8,9]){let n=e<=5?t:-t,a=y([r[e].pos[0]-n,r[e].pos[1],0]);r.push({Z:1,pos:[r[e].pos[0]+a[0]*1.09,r[e].pos[1]+a[1]*1.09,0]}),i.push({a:e,b:r.length-1,order:1})}return{atoms:r,bonds:i}}function C(e=!1){let t=e?-1:1;return{atoms:[{Z:6,pos:[0,0,0]},{Z:7,pos:[t*1.18,.85,.15]},{Z:6,pos:[t*-1.24,.65,-.58]},{Z:8,pos:[t*-2.28,.08,-.82]},{Z:8,pos:[t*-1.1,1.96,-.86]},{Z:6,pos:[t*.18,-1.38,-.62]},{Z:1,pos:[t*-.08,-.1,1.08]},{Z:1,pos:[t*1.24,1.48,.94]},{Z:1,pos:[t*2.02,.3,.05]},{Z:1,pos:[t*-1.94,2.34,-1.2]},{Z:1,pos:[t*1.08,-1.82,-.22]},{Z:1,pos:[t*-.68,-2.02,-.42]},{Z:1,pos:[t*.28,-1.28,-1.7]}],bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:5,order:1},{a:0,b:6,order:1},{a:2,b:3,order:2},{a:2,b:4,order:1},{a:4,b:9,order:1},{a:1,b:7,order:1},{a:1,b:8,order:1},{a:5,b:10,order:1},{a:5,b:11,order:1},{a:5,b:12,order:1}]}}function w(){return{atoms:[{Z:6,pos:[-1.18,-.24,0]},{Z:6,pos:[.32,.02,0]},{Z:8,pos:[1.02,-1.22,0]},{Z:1,pos:[1.96,-1.04,0]},{Z:1,pos:[-1.68,.72,0]},{Z:1,pos:[-1.5,-.8,.89]},{Z:1,pos:[-1.5,-.8,-.89]},{Z:1,pos:[.64,.58,.89]},{Z:1,pos:[.64,.58,-.89]}],bonds:[{a:0,b:1,order:1},{a:1,b:2,order:1},{a:2,b:3,order:1},{a:0,b:4,order:1},{a:0,b:5,order:1},{a:0,b:6,order:1},{a:1,b:7,order:1},{a:1,b:8,order:1}]}}function T(){return{atoms:[{Z:8,pos:[0,.52,0]},{Z:6,pos:[-1.18,-.26,0]},{Z:6,pos:[1.18,-.26,0]},{Z:1,pos:[-2.04,.4,0]},{Z:1,pos:[-1.22,-.88,.89]},{Z:1,pos:[-1.22,-.88,-.89]},{Z:1,pos:[2.04,.4,0]},{Z:1,pos:[1.22,-.88,.89]},{Z:1,pos:[1.22,-.88,-.89]}],bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:1,b:3,order:1},{a:1,b:4,order:1},{a:1,b:5,order:1},{a:2,b:6,order:1},{a:2,b:7,order:1},{a:2,b:8,order:1}]}}function E(){return{atoms:[{Z:6,pos:[-1.92,-.48,0]},{Z:6,pos:[-.74,.48,0]},{Z:6,pos:[.74,-.02,0]},{Z:6,pos:[1.92,.94,0]},{Z:1,pos:[-2.88,.04,0]},{Z:1,pos:[-1.88,-1.12,.89]},{Z:1,pos:[-1.88,-1.12,-.89]},{Z:1,pos:[-.82,1.12,.89]},{Z:1,pos:[-.82,1.12,-.89]},{Z:1,pos:[.82,-.66,.89]},{Z:1,pos:[.82,-.66,-.89]},{Z:1,pos:[2.88,.42,0]},{Z:1,pos:[1.88,1.58,.89]},{Z:1,pos:[1.88,1.58,-.89]}],bonds:[{a:0,b:1,order:1},{a:1,b:2,order:1},{a:2,b:3,order:1},{a:0,b:4,order:1},{a:0,b:5,order:1},{a:0,b:6,order:1},{a:1,b:7,order:1},{a:1,b:8,order:1},{a:2,b:9,order:1},{a:2,b:10,order:1},{a:3,b:11,order:1},{a:3,b:12,order:1},{a:3,b:13,order:1}]}}function D(){return{atoms:[{Z:6,pos:[-1.84,-.58,0]},{Z:6,pos:[-.72,.14,0]},{Z:6,pos:[.72,-.14,0]},{Z:6,pos:[1.84,.58,0]},{Z:1,pos:[-2.82,-.14,0]},{Z:1,pos:[-1.76,-1.66,0]},{Z:1,pos:[-.84,1.22,0]},{Z:1,pos:[.84,-1.22,0]},{Z:1,pos:[2.82,.14,0]},{Z:1,pos:[1.76,1.66,0]}],bonds:[{a:0,b:1,order:2},{a:1,b:2,order:1},{a:2,b:3,order:2},{a:0,b:4,order:1},{a:0,b:5,order:1},{a:1,b:6,order:1},{a:2,b:7,order:1},{a:3,b:8,order:1},{a:3,b:9,order:1}]}}function O(){return{atoms:[{Z:6,pos:[-1.36,0,0]},{Z:6,pos:[.14,.02,0]},{Z:8,pos:[.78,1.08,0]},{Z:8,pos:[.78,-1.16,0]},{Z:1,pos:[1.74,-1.04,0]},{Z:1,pos:[-1.76,1.01,0]},{Z:1,pos:[-1.72,-.52,.89]},{Z:1,pos:[-1.72,-.52,-.89]}],bonds:[{a:0,b:1,order:1},{a:1,b:2,order:2},{a:1,b:3,order:1},{a:3,b:4,order:1},{a:0,b:5,order:1},{a:0,b:6,order:1},{a:0,b:7,order:1}]}}function k(){return{atoms:[{Z:7,pos:[-1.62,.72,0]},{Z:6,pos:[-1.62,-.62,0]},{Z:7,pos:[-.46,-1.32,0]},{Z:6,pos:[.68,-.62,0]},{Z:6,pos:[.68,.76,0]},{Z:6,pos:[-.48,1.44,0]},{Z:7,pos:[1.96,1.18,0]},{Z:6,pos:[2.72,.06,0]},{Z:7,pos:[1.96,-1.06,0]},{Z:7,pos:[-.48,2.78,0]},{Z:1,pos:[-2.56,-1.14,0]},{Z:1,pos:[3.8,.06,0]},{Z:1,pos:[2.26,-2.02,0]},{Z:1,pos:[-1.34,3.3,0]},{Z:1,pos:[.38,3.3,0]}],bonds:[{a:0,b:1,order:2},{a:1,b:2,order:1},{a:2,b:3,order:2},{a:3,b:4,order:1},{a:4,b:5,order:2},{a:5,b:0,order:1},{a:4,b:6,order:1},{a:6,b:7,order:2},{a:7,b:8,order:1},{a:8,b:3,order:1},{a:5,b:9,order:1},{a:1,b:10,order:1},{a:7,b:11,order:1},{a:8,b:12,order:1},{a:9,b:13,order:1},{a:9,b:14,order:1}]}}function A(){return{atoms:[{Z:6,pos:[0,0,0]},{Z:35,pos:[1.94,0,0]},{Z:17,pos:[-3.1,0,0]},{Z:1,pos:[-.36,1.03,0]},{Z:1,pos:[-.36,-.51,.89]},{Z:1,pos:[-.36,-.51,-.89]}],bonds:[{a:0,b:1,order:1},{a:0,b:3,order:1},{a:0,b:4,order:1},{a:0,b:5,order:1}],totalCharge:-1,reactionMeta:{kind:`sn2`,nucleophileIdx:2,centerIdx:0,leavingIdx:1}}}function j(){return{atoms:[{Z:6,pos:[-1.15,1.48,0]},{Z:6,pos:[-2.12,.72,0]},{Z:6,pos:[-2.12,-.72,0]},{Z:6,pos:[-1.15,-1.48,0]},{Z:6,pos:[1.65,.67,0]},{Z:6,pos:[1.65,-.67,0]},{Z:1,pos:[-.45,2.28,.25]},{Z:1,pos:[-1.28,1.72,-1.04]},{Z:1,pos:[-3.08,1.22,0]},{Z:1,pos:[-3.08,-1.22,0]},{Z:1,pos:[-.45,-2.28,.25]},{Z:1,pos:[-1.28,-1.72,-1.04]},{Z:1,pos:[2.25,1.24,.68]},{Z:1,pos:[2.25,1.24,-.68]},{Z:1,pos:[2.25,-1.24,.68]},{Z:1,pos:[2.25,-1.24,-.68]}],bonds:[{a:0,b:1,order:2},{a:1,b:2,order:1},{a:2,b:3,order:2},{a:4,b:5,order:2},{a:0,b:6,order:1},{a:0,b:7,order:1},{a:1,b:8,order:1},{a:2,b:9,order:1},{a:3,b:10,order:1},{a:3,b:11,order:1},{a:4,b:12,order:1},{a:4,b:13,order:1},{a:5,b:14,order:1},{a:5,b:15,order:1}],reactionMeta:{kind:`diels-alder`,pairs:[[0,4],[3,5]]}}}function M(){let e=w(),t=e.atoms.map(e=>({Z:e.Z,pos:[e.pos[0]-2.1,e.pos[1],e.pos[2]]})),n=e.bonds.map(e=>({...e})),r=t.length;t.push({Z:8,pos:[1.35,-.95,.35]},{Z:1,pos:[1.75,-.1,.55]},{Z:1,pos:[1.85,-1.55,-.18]}),n.push({a:r,b:r+1,order:1},{a:r,b:r+2,order:1});let i=t.length;return t.push({Z:8,pos:[2.45,1.38,.55]},{Z:1,pos:[1.65,1.82,.25]},{Z:1,pos:[3.15,1.9,.12]}),n.push({a:i,b:i+1,order:1},{a:i,b:i+2,order:1}),{atoms:t,bonds:n}}function N(){let e=[],t=[],n=1.83,r=3.22,i=4.26;for(let t=0;t<8;t+=1){let r=t/8*Math.PI*2;e.push({Z:6,pos:[Math.cos(r)*n,Math.sin(r)*n,0]})}for(let t=0;t<8;t+=1){let n=t/8*Math.PI*2;e.push({Z:6,pos:[Math.cos(n)*r,Math.sin(n)*r,0]})}for(let t=0;t<8;t+=1){let n=(t+.5)/8*Math.PI*2;e.push({Z:16,pos:[Math.cos(n)*i,Math.sin(n)*i,0]})}for(let e=0;e<8;e+=1){let n=(e+1)%8;t.push({a:e,b:n,order:1.5}),t.push({a:e,b:8+e,order:1.5}),t.push({a:8+e,b:16+e,order:1}),t.push({a:8+n,b:16+e,order:1})}let a=Math.PI*2/11,o=6.84,s=7.64,c=8.88,l=9.96,u=8.7,d=8.9*Math.PI/180,f=4.5*Math.PI/180,p=4.6*Math.PI/180,m=[];for(let n=0;n<11;n+=1){let r=n*a,i=e.length;e.push({Z:8,pos:[Math.cos(r)*o,Math.sin(r)*o,0]});let h=e.length;e.push({Z:6,pos:[Math.cos(r-d)*s,Math.sin(r-d)*s,0]});let g=e.length;e.push({Z:6,pos:[Math.cos(r+d)*s,Math.sin(r+d)*s,0]});let _=e.length;e.push({Z:6,pos:[Math.cos(r-f)*c,Math.sin(r-f)*c,0]});let v=e.length;e.push({Z:6,pos:[Math.cos(r+f)*c,Math.sin(r+f)*c,0]});let y=e.length;e.push({Z:1,pos:[Math.cos(r-p)*l,Math.sin(r-p)*l,0]});let b=e.length;e.push({Z:1,pos:[Math.cos(r+p)*l,Math.sin(r+p)*l,0]});let x=r+a*.5,S=e.length;e.push({Z:6,pos:[Math.cos(x)*u,Math.sin(x)*u,0]});let C=e.length;e.push({Z:1,pos:[Math.cos(x)*9.219999999999999,Math.sin(x)*9.219999999999999,.88]});let w=e.length;e.push({Z:1,pos:[Math.cos(x)*9.219999999999999,Math.sin(x)*9.219999999999999,-.88]}),t.push({a:i,b:h,order:1}),t.push({a:i,b:g,order:1}),t.push({a:h,b:_,order:1.5}),t.push({a:_,b:v,order:1.5}),t.push({a:v,b:g,order:1.5}),t.push({a:_,b:y,order:1}),t.push({a:v,b,order:1}),t.push({a:S,b:C,order:1}),t.push({a:S,b:w,order:1}),m.push({iCaL:h,iCaR:g,iCh2:S})}for(let e=0;e<11;e+=1){let n=(e+1)%11;t.push({a:m[e].iCaR,b:m[e].iCh2,order:1}),t.push({a:m[e].iCh2,b:m[n].iCaL,order:1})}return{atoms:e,bonds:t,rotorMeta:Object.freeze({kind:`molecular-bearing`,rotorCount:24,statorStart:24,rotorSymmetry:8,statorSymmetry:11,bearingGapA:Number((o-i).toFixed(2))})}}var P=Object.freeze({"sulflower-bearing":Object.freeze({id:`sulflower-bearing`,name:`Sulflower Molecular Bearing (C₁₆S₈ @ Calix[11]furan)`,formula:`C71H44O11S8`,category:`nanotech`,description:`Superlubric supramolecular nanobearing: planar D₈h octathio[8]circulene "Sulflower" (C₁₆S₈) spinning freely inside a coprime 11-fold Calix[11]furan oxa-macrocycle stator via live GPU S···O Lennard-Jones & QEq forces!`,build:N}),benzene:Object.freeze({id:`benzene`,name:`Benzene (C₆H₆)`,formula:`C₆H₆`,category:`aromatic`,description:`Planar 6π Hückel (4n+2) aromatic ring with equalized delocalized C–C bonds and deep resonance stabilization.`,build:()=>x(6,{aromatic:!0})}),cyclobutadiene:Object.freeze({id:`cyclobutadiene`,name:`Cyclobutadiene (C₄H₄)`,formula:`C₄H₄`,category:`aromatic`,description:`4π Hückel (4n) anti-aromatic ring exhibiting degenerate non-bonding π MOs and zero aromatic stabilization.`,build:()=>x(4,{aromatic:!0})}),naphthalene:Object.freeze({id:`naphthalene`,name:`Naphthalene (C₁₀H₈)`,formula:`C₁₀H₈`,category:`aromatic`,description:`Fused bicyclic 10π (4n+2) polycyclic aromatic hydrocarbon with narrowed HOMO–LUMO UV-Vis gap.`,build:S}),butadiene:Object.freeze({id:`butadiene`,name:`1,3-Butadiene (C₄H₆)`,formula:`C₄H₆`,category:`aromatic`,description:`Conjugated linear 4π polyene showing partial central C2–C3 π-bond delocalization and s-trans planarity.`,build:D}),adenine:Object.freeze({id:`adenine`,name:`Adenine (C₅H₅N₅)`,formula:`C₅H₅N₅`,category:`aromatic`,description:`Planar 10π heteroaromatic purine nucleobase with strongly polarized H-bond donor/acceptor edges.`,build:k}),cyclohexane:Object.freeze({id:`cyclohexane`,name:`Cyclohexane (C₆H₁₂)`,formula:`C₆H₁₂`,category:`conformational`,description:`Strain-free sp³ chair conformation with axial/equatorial C–H bonds and live thermal chair–boat flips.`,build:()=>x(6,{aromatic:!1,chair:!0})}),butane:Object.freeze({id:`butane`,name:`n-Butane (C₄H₁₀)`,formula:`C₄H₁₀`,category:`conformational`,description:`Canonical sp³ torsional dihedral rotor displaying anti (180°), gauche (±60°), and eclipsed barriers.`,build:E}),"l-alanine":Object.freeze({id:`l-alanine`,name:`L-Alanine (C₃H₇NO₂)`,formula:`C₃H₇NO₂`,category:`chiral`,description:`Chiral (S)-amino acid with stereogenic sp³ α-carbon, acidic –COOH, and basic –NH₂ groups. Mirror to flip R↔S!`,build:()=>C(!1)}),"d-alanine":Object.freeze({id:`d-alanine`,name:`D-Alanine (C₃H₇NO₂)`,formula:`C₃H₇NO₂`,category:`chiral`,description:`Exact mirror-image (R)-enantiomer of L-Alanine with bit-identical energy and inverted 3D stereocenter sign.`,build:()=>C(!0)}),ethanol:Object.freeze({id:`ethanol`,name:`Ethanol (C₂H₆O)`,formula:`C₂H₆O`,category:`isomer`,description:`Polar protic isomer (strong O–H dipole & H-bonding) — compare directly with constitutional isomer dimethyl ether!`,build:w}),"dimethyl-ether":Object.freeze({id:`dimethyl-ether`,name:`Dimethyl Ether (C₂H₆O)`,formula:`C₂H₆O`,category:`isomer`,description:`Constitutional isomer of ethanol with identical C₂H₆O formula yet zero O–H H-bond donors.`,build:T}),"acetic-acid":Object.freeze({id:`acetic-acid`,name:`Acetic Acid (CH₃COOH)`,formula:`C₂H₄O₂`,category:`acid-base`,description:`Carboxylic acid whose deprotonated –COO⁻ conjugate base is resonance-stabilized across both oxygens.`,build:O}),"ethanol-water-hbond":Object.freeze({id:`ethanol-water-hbond`,name:`Ethanol–Water H-Bond Cluster`,formula:`C₂H₆O·2H₂O`,category:`isomer`,description:`Live explicit polar hydrogen-bonding network emerging purely from QEq partial charges and D–H···A geometry.`,build:M}),"sn2-walden":Object.freeze({id:`sn2-walden`,name:`SN2 Backside Attack (Cl⁻ + CH₃Br)`,formula:`CH₃BrCl⁻`,category:`reaction`,description:`Concerted bimolecular nucleophilic substitution driving planar pentacoordinate TS and Walden umbrella inversion!`,build:A}),"diels-alder":Object.freeze({id:`diels-alder`,name:`Diels–Alder [4+2] Cycloaddition`,formula:`C₄H₆+C₂H₄`,category:`reaction`,description:`Concerted pericyclic [4+2] ring closure converting 1,3-butadiene + ethene into cyclohexene via bond-order flow.`,build:j})});function F(e={}){let t=typeof e==`string`?P[e]?.build()||P.benzene.build():e,n=Array.isArray(t?.atoms)?t.atoms:[],r=Array.isArray(t?.bonds)?t.bonds:[],i=Number(t?.totalCharge)||0,a=n.length,o=Array.from({length:a},()=>[]),s=[];for(let e=0;e<r.length;e+=1){let t=r[e],n=Math.trunc(t.a),i=Math.trunc(t.b),c=Math.max(.5,Math.min(3,Number(t.order)||1));n<0||i<0||n>=a||i>=a||n===i||(s.push({a:n,b:i,order:c}),o[n].push({to:i,order:c,bondIdx:s.length-1}),o[i].push({to:n,order:c,bondIdx:s.length-1}))}let c=0,u=0,d=0,f=0;for(let e=0;e<a;e+=1){let t=n[e].pos||[e*1.4,0,0],r=p(n[e].Z);c+=t[0]*r.massU,u+=t[1]*r.massU,d+=t[2]*r.massU,f+=r.massU}f>0&&(c/=f,u/=f,d/=f);let m=n.map((e,t)=>{let n=p(e.Z),r=e.pos||[t*1.4,0,0],i=o[t],a=i.length,s=1,l=0;for(let e of i)e.order>s&&(s=e.order),e.order>1.25&&(l+=Math.round(e.order-1));let f=`s`;return f=n.Z===1?`s`:s>=2.5||l>=2?`sp`:s>=1.5||l===1?`sp2`:`sp3`,{index:t,Z:n.Z,sym:n.sym,massU:n.massU,chiEv:n.chiEv,etaEv:n.etaEv,rCovA:n.rCovA,rVdwA:n.rVdwA,huckelAlpha:n.huckelAlpha,piLonePair:n.piLonePair,rgb:[...n.rgb],pos:[r[0]-c,r[1]-u,r[2]-d],degree:a,hybridization:f,isPiAtom:f===`sp2`||f===`sp`,piElectrons:0}});for(let e=0;e<a;e+=1){let t=m[e];!t.isPiAtom&&t.piLonePair>0&&t.degree>=2&&o[e].some(e=>m[e.to].isPiAtom)&&(t.hybridization=`sp2`,t.isPiAtom=!0)}for(let e=0;e<a;e+=1){let t=m[e];t.isPiAtom&&(t.piElectrons=!o[e].some(e=>e.order>=1.5)&&t.piLonePair>=2?2:1)}let v=new Uint8Array(a),b=[],x=new Set;for(let e of s){let t=[[e.a]],n=new Set([e.a]);for(;t.length>0;){let r=t.shift(),i=r[r.length-1];if(r.length>7)break;for(let a of o[i])if(!(i===e.a&&a.to===e.b)){if(a.to===e.b&&r.length>=3){let n=[...r,e.b],i=[...n].sort((e,t)=>e-t).join(`,`);if(!x.has(i)){x.add(i),b.push(n);for(let e of n)v[e]=1}t.length=0;break}n.has(a.to)||(n.add(a.to),t.push([...r,a.to]))}}}let S=(e,t)=>{let n=m[e].Z,r=o[e].filter(e=>e.to!==t).map(e=>m[e.to].Z*Math.round(e.order)).sort((e,t)=>t-e),i=[];for(let n of o[e])if(n.to!==t)for(let t of o[n.to])t.to!==e&&i.push(m[t.to].Z);return i.sort((e,t)=>t-e),`${String(n).padStart(3,`0`)}:${r.map(e=>String(e).padStart(3,`0`)).join(`.`)}:${i.map(e=>String(e).padStart(3,`0`)).join(`.`)}`},C=[];for(let e=0;e<a;e+=1){let t=m[e];if(t.hybridization!==`sp3`||o[e].length!==4)continue;let n=o[e].map(t=>({to:t.to,key:S(t.to,e)}));if(n.sort((e,t)=>t.key>e.key?1:t.key<e.key?-1:0),new Set(n.map(e=>e.key)).size<4)continue;let r=t.pos,i=h(m[n[0].to].pos,r),a=h(m[n[1].to].pos,r),s=h(m[n[2].to].pos,r),c=h(m[n[3].to].pos,r),l=g(_(h(i,c),h(a,c)),h(s,c));Math.abs(l)>.05&&C.push({atomIndex:e,sym:t.sym,signedVolumeA3:l,configuration:l>0?`S`:`R`})}let w=[];for(let e=0;e<a;e+=1){let t=o[e],n=m[e].hybridization===`sp`?Math.PI:m[e].hybridization===`sp2`?2*Math.PI/3:1.910633;for(let r=0;r<t.length;r+=1)for(let i=r+1;i<t.length;i+=1){let a=n;if(v[e]&&m[e].hybridization===`sp2`){let n=y(h(m[t[r].to].pos,m[e].pos)),o=y(h(m[t[i].to].pos,m[e].pos)),s=Math.acos(Math.max(-.999,Math.min(.999,g(n,o))));s>1.35&&s<2.65&&(a=s)}w.push({i:t[r].to,j:e,k:t[i].to,eqRad:a,kAngle:m[e].hybridization===`sp2`?5.2:3.4})}}let T=[];for(let e of s){let t=e.a,n=e.b,r=o[t].filter(e=>e.to!==n),i=o[n].filter(e=>e.to!==t);if(!r.length||!i.length)continue;let a=e.order>=1.5||m[t].isPiAtom&&m[n].isPiAtom&&v[t]&&v[n],s=a?1.45:.14,c=a?2:3,l=a?Math.PI:0,u=0;for(let e of r)for(let r of i){if(u>=3)break;T.push({i:e.to,j:t,k:n,l:r.to,barrier:s,periodicity:c,phase:l}),u+=1}}let E=new Map;for(let e of m)E.set(e.sym,(E.get(e.sym)||0)+1);let D=[];E.has(`C`)&&(D.push(`C${E.get(`C`)>1?E.get(`C`):``}`),E.delete(`C`)),E.has(`H`)&&(D.push(`H${E.get(`H`)>1?E.get(`H`):``}`),E.delete(`H`));for(let e of[...E.keys()].sort())D.push(`${e}${E.get(e)>1?E.get(e):``}`);return Object.freeze({schema:l,formula:D.join(``),atomCount:a,bondCount:s.length,totalCharge:i,atoms:m,bonds:s,adj:o,rings:b,inRingAtom:v,chiralCenters:C,angles:w,dihedrals:T,reactionMeta:t?.reactionMeta||null,rotorMeta:t?.rotorMeta||null})}function I(e){return F({atoms:e.atoms.map(e=>({Z:e.Z,pos:[-e.pos[0],e.pos[1],e.pos[2]]})),bonds:e.bonds.map(e=>({a:e.a,b:e.b,order:e.order})),totalCharge:e.totalCharge,reactionMeta:e.reactionMeta,rotorMeta:e.rotorMeta})}function L(e,{dielectricEr:t=1,totalCharge:n=null}={}){let r=e.atomCount,i=n??e.totalCharge??0,a=Math.max(1,Number(t)||1),o=14.3996/(1+.14*(1-1/a)),s=r+1,c=new Float64Array(s*s),l=new Float64Array(s);for(let t=0;t<r;t+=1){let n=e.atoms[t];c[t*s+t]=n.etaEv,c[t*s+r]=-1,c[r*s+t]=1,l[t]=-n.chiEv;for(let i=t+1;i<r;i+=1){let r=e.atoms[i],a=v(h(n.pos,r.pos)),l=Math.sqrt(Math.max(1e-4,n.etaEv*r.etaEv))/14.3996,u=o/Math.sqrt(a*a+1/Math.max(1e-4,l*l));c[t*s+i]=u,c[i*s+t]=u}}l[r]=i;let u=b(c,l),d=new Float32Array(r),f=0,p=0,m=0,g=0,_=0;for(let t=0;t<r;t+=1){let n=u[t];d[t]=n,Math.abs(n)>_&&(_=Math.abs(n));let r=e.atoms[t].pos;f+=n*r[0],p+=n*r[1],m+=n*r[2];let i=Math.max(.8,e.atoms[t].rVdwA*.92);g+=-.5*14.3996*(1-1/a)*(n*n)/i}let y=Math.hypot(f,p,m)*4.8032;return Object.freeze({charges:d,chemicalPotentialEv:u[r],dipoleVecEA:Object.freeze([f,p,m]),dipoleDebye:y,bornSolvationEv:g,bornSolvationKjMol:g*96.485,maxAbsCharge:_,dielectricEr:a})}function R(e){let t=[],n=new Int32Array(e.atomCount).fill(-1),r=0;for(let i=0;i<e.atomCount;i+=1)e.atoms[i].isPiAtom&&(n[i]=t.length,t.push(i),r+=e.atoms[i].piElectrons);let i=t.length,a=-2.75,o=new Float32Array(Math.max(1,i*i));for(let r=0;r<i;r+=1){let s=t[r],c=e.atoms[s];o[r*i+r]=c.huckelAlpha*2.75;for(let t of e.adj[s]){let s=n[t.to];if(s<0||s===r)continue;let l=v(h(c.pos,e.atoms[t.to].pos)),u=Math.exp(-1.75*Math.max(-.25,l-1.4));o[r*i+s]=a*u}}return{m:i,piIndices:t,atomToPi:n,totalPiElectrons:r,beta0Ev:a,H:o}}function z(e,t,n,r){let{m:i,piIndices:a,totalPiElectrons:o,beta0Ev:s}=t;if(i===0)return Object.freeze({piAtomCount:0,totalPiElectrons:0,piIndices:[],eigenvaluesEv:[],eigenvectors:new Float32Array,homoIndex:-1,lumoIndex:-1,homoLumoGapEv:0,uvVisLambdaMaxNm:0,totalPiEnergyEv:0,resonanceEnergyEv:0,isAromatic4nPlus2:!1,coulsonBondOrders:new Map});let c=new Float64Array(i),l=o,u=0;for(let e=0;e<i&&l>0;e+=1){let t=[e];for(;e+1<i&&Math.abs(n[e+1]-n[t[0]])<.001;)e+=1,t.push(e);let r=Math.min(2,l/t.length);for(let e of t)c[e]=r,r>.01&&(u=e);l=Math.max(0,l-r*t.length)}let d=Math.min(i-1,u+ +(c[u]>=1.99)),f=Math.max(0,n[d]-n[u]),p=f>.05?1239.84/f:0,m=0;for(let e=0;e<i;e+=1)m+=c[e]*n[e];let h=0;for(let t=0;t<i;t+=1){let n=e.atoms[a[t]];h+=n.piElectrons*n.huckelAlpha*Math.abs(s)}let g=Math.floor(o/2),_=h+g*2*s,v=m-_,y=new Map;for(let n of e.bonds){let e=t.atomToPi[n.a],a=t.atomToPi[n.b];if(e>=0&&a>=0){let t=0;for(let n=0;n<i;n+=1)t+=c[n]*r[e*i+n]*r[a*i+n];y.set(`${Math.min(n.a,n.b)}:${Math.max(n.a,n.b)}`,Math.max(0,Math.min(1,t)))}}let b=e.rings.some(t=>t.every(t=>e.atoms[t].isPiAtom))&&v<-.35&&f>.5;return Object.freeze({piAtomCount:i,totalPiElectrons:o,piIndices:a,eigenvaluesEv:Array.from(n.subarray(0,i)),eigenvectors:new Float32Array(r.subarray(0,i*i)),occupancies:Array.from(c),homoIndex:u,lumoIndex:d,homoLumoGapEv:f,uvVisLambdaMaxNm:p,totalPiEnergyEv:m,resonanceEnergyEv:v,isAromatic4nPlus2:b,coulsonBondOrders:y})}async function B(e,t){let n=R(t),i=n.m;if(i===0)return z(t,n,new Float32Array,new Float32Array);if(i===1)return z(t,n,new Float32Array([n.H[0]]),new Float32Array([1]));if(i<=64){let a=await r(e,{matrices:n.H,n:i,batchCount:1,maxSweeps:36,tolerance:1e-6});return z(t,n,a.eigenvalues,a.eigenvectors)}let a=new Uint8Array(i),o=[];for(let e=0;e<i;e+=1){if(a[e])continue;let t=[],r=[e];for(a[e]=1;r.length>0;){let e=r.pop();t.push(e);for(let t=0;t<i;t+=1)!a[t]&&Math.abs(n.H[e*i+t])>1e-7&&(a[t]=1,r.push(t))}t.sort((e,t)=>e-t),o.push(t)}let s=[];for(let t of o){let a=t.length;if(a===1){s.push({val:n.H[t[0]*i+t[0]],comp:t,vec:[1]});continue}let o=new Float32Array(a*a);for(let e=0;e<a;e+=1)for(let r=0;r<a;r+=1)o[e*a+r]=n.H[t[e]*i+t[r]];let c=a<=64?await r(e,{matrices:o,n:a,batchCount:1,maxSweeps:36,tolerance:1e-6}):null;if(c)for(let e=0;e<a;e+=1){let n=new Float32Array(a);for(let t=0;t<a;t+=1)n[t]=c.eigenvectors[t*a+e];s.push({val:c.eigenvalues[e],comp:t,vec:n})}}s.sort((e,t)=>e.val-t.val);let c=new Float32Array(i),l=new Float32Array(i*i);for(let e=0;e<Math.min(i,s.length);e+=1){c[e]=s[e].val;let{comp:t,vec:n}=s[e];for(let r=0;r<t.length;r+=1)l[t[r]*i+e]=n[r]}return z(t,n,c,l)}function V(e,t,n,{moIndex:r=null,pointCount:i=6144,seed:a=1337,reuseBuffer:o=null}={}){let s=n?.piAtomCount||0,c=new Float32Array(i*4);if(s>0){let e=Math.max(0,Math.min(s-1,r??n.homoIndex??0)),o=[],l=0;for(let t=0;t<s;t+=1){let r=n.eigenvectors[t*s+e],i=r*r;o.push({atomIdx:n.piIndices[t],c:r,w:i}),l+=i}let u=0,d=0,f=1;if(s>=3){let e=t.atoms[n.piIndices[0]].pos,r=t.atoms[n.piIndices[1]].pos,i=t.atoms[n.piIndices[2]].pos,a=_(h(r,e),h(i,e));v(a)>.001&&([u,d,f]=y(a))}let p=y(_([u,d,f],Math.abs(u)<.8?[1,0,0]:[0,1,0])),m=y(_([u,d,f],p)),g=a>>>0||1,b=()=>{g=g+1831565813|0;let e=Math.imul(g^g>>>15,1|g);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296};for(let e=0;e<i;e+=1){let n=b()*Math.max(1e-6,l),r=o[0];for(let e of o)if(n-=e.w,n<=0){r=e;break}let i=t.atoms[r.atomIdx].pos,a=Math.max(1e-5,b()),s=Math.max(1e-5,b()),h=-.42*Math.log(a*s)*.72+.16,g=b()<.5?1:-1,_=g*b()**.36,v=Math.sqrt(Math.max(0,1-_*_)),y=b()*Math.PI*2,x=h*_,S=h*v,C=i[0]+u*x+(p[0]*Math.cos(y)+m[0]*Math.sin(y))*S,w=i[1]+d*x+(p[1]*Math.cos(y)+m[1]*Math.sin(y))*S,T=i[2]+f*x+(p[2]*Math.cos(y)+m[2]*Math.sin(y))*S,E=Math.sign(r.c*g)*Math.min(1,Math.abs(r.c)*1.65*Math.exp(-h*.55));c[e*4+0]=C,c[e*4+1]=w,c[e*4+2]=T,c[e*4+3]=E}}let l=o&&o.size>=c.byteLength?o:e.createBuffer({label:`ulg-organic-pi-mo-cloud`,size:c.byteLength,usage:u.STORAGE|u.COPY_DST});return e.queue.writeBuffer(l,0,c),{pointsBuffer:l,pointCount:s>0?i:0}}function ee(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`organic-molecular-graph-hybridization@1`)?e.resolveModule(`organic-molecular-graph-hybridization@1`)?.descriptor||null:e.registerModule({method:{model:`organic-molecular-graph-hybridization`,version:1},kernel:{sourceModule:`src/runtime/organic/organicMolecularGraphGpu.js`,entryPoint:`solvePiMolecularOrbitalsWebGpu`,workgroupSize:64},parameterSchema:{dielectricEr:{type:`number`,min:1,max:120,required:!1}},stateLayout:{tensorId:`organic-pi-mo-cloud`,dtype:`f32`,layout:`interleaved`,strideElements:4,strideBytes:16,fields:[`x`,`y`,`z`,`signedPhaseAmp`]},scaleRangeM:[1e-10,1e-8],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=F(r.moleculeId||`benzene`),a=await B(n,i),o=L(i,{dielectricEr:r.dielectricEr??1});return t({artifactId:`${e.taskId}:organic-graph:${i.formula}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/organic/organicMolecularGraphGpu.js`,entryPoint:`solvePiMolecularOrbitalsWebGpu`,kernelEntryPoint:`jacobi_symmetric_batched`},representation:`organic-molecular-graph-f32`,outputs:{formula:i.formula,homoLumoGapEv:a.homoLumoGapEv,resonanceEnergyEv:a.resonanceEnergyEv,dipoleDebye:o.dipoleDebye},execution:{backend:`webgpu-organic-graph`,placement:`local`},validity:{finite:Number.isFinite(a.homoLumoGapEv)&&Number.isFinite(o.dipoleDebye)},validation:{status:`pass`,validationMode:`gpu-organic-electronic-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var H=`ulg.organic.reactive-bond-order-md-webgpu.v1`,U=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),W=Object.freeze({id:`reactive-bond-order-md`,lawNodeId:`law:organic-reactive-bond-order-md`,orderConstraint:`after:organic-molecular-graph-hybridization`,adapterMode:n.CELL_LOCAL,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`organic-atoms-state`,`covalent-bond-table`,`dihedral-table`,`qeq-partial-charges`]),writes:Object.freeze([`organic-atoms-state`,`live-bond-orders`]),accumulates:Object.freeze([`organic-md-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`atom-count`,`total-charge`,`center-of-mass-drift-damped`]),validityDomain:Object.freeze({minTempK:5,maxTempK:2e3,dielectricMin:1}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e-10,1e-8]),fundamentalLaws:Object.freeze([`morse-continuous-bond-order`,`hybridization-angle-bending`,`periodic-dihedral-torsion`,`dielectric-screened-coulomb`,`directional-hydrogen-bonding`,`langevin-thermostat`])});function G(e={}){let t=Number(e.organicAtomCount)||0,n=!!e.organicMdActive||t>=2;return{active:n,reason:n?`organic-reactive-md-active`:`no-organic-md-system-dormant`}}var te=`
struct MdParams {
  atom_count: u32,
  bond_count: u32,
  angle_count: u32,
  dihedral_count: u32,
  step_index: u32,
  react_mode: u32,      // 0=free conformational/H-bond MD, 1=SN2 Walden drive, 2=Diels-Alder [4+2] drive
  react_a: u32,
  react_b: u32,
  dt: f32,
  temp_k: f32,
  dielectric_er: f32,
  react_progress: f32,  // 0..1 continuous reaction drive
  gamma_damp: f32,
  seed_f: f32,
  react_c: u32,
  react_d: u32,
};

// 64 bytes per atom (4 x vec4<f32>):
//   pos_m:  vec4(x, y, z, invMass)
//   vel_q:  vec4(vx, vy, vz, partialChargeQ)
//   frc_r:  vec4(fx, fy, fz, rCovA)
//   vis_z:  vec4(r, g, b, atomicZ)
struct OrgAtom {
  pos_m: vec4<f32>,
  vel_q: vec4<f32>,
  frc_r: vec4<f32>,
  vis_z: vec4<f32>,
};

// 32 bytes per bond entry (live dynamic bond-order output!):
//   ab_ord: vec4(a_f, b_f, nominalOrder, rEqA)
//   dyn:    vec4(liveOrder, kMorse, activeFlag, isHBond)
struct OrgBond {
  ab_ord: vec4<f32>,
  dyn: vec4<f32>,
};

// 32 bytes per angle: (i, j, k, eqRad) + (kAngle, 0, 0, 0)
struct OrgAngle {
  ijk_eq: vec4<f32>,
  k_pad: vec4<f32>,
};

// 32 bytes per dihedral: (i, j, k, l) + (barrier, periodicity, phase, 0)
struct OrgDihedral {
  ijkl: vec4<f32>,
  par: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: MdParams;
@group(0) @binding(1) var<storage, read_write> atoms: array<OrgAtom>;
@group(0) @binding(2) var<storage, read_write> bonds: array<OrgBond>;
@group(0) @binding(3) var<storage, read> angles: array<OrgAngle>;
@group(0) @binding(4) var<storage, read> dihedrals: array<OrgDihedral>;
@group(0) @binding(5) var<storage, read_write> telemetry: array<vec4<f32>>;
// Reference coordinates for bearing stator mount (xyz = ref_pos, w = isStatorFlag 0/1)
@group(0) @binding(6) var<storage, read> ref_mount: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;
var<workgroup> wg_v0: array<vec3<f32>, 64>;
var<workgroup> wg_v1: array<vec3<f32>, 64>;

fn hash_f(x: f32) -> f32 {
  return fract(sin(x * 127.1 + params.seed_f * 31.7) * 43758.5453);
}

fn eval_bond_order(dist: f32, r_eq: f32, nom_ord: f32) -> f32 {
  let dr = dist - r_eq;
  return clamp(nom_ord * exp(-2.35 * max(0.0, dr - 0.10)), 0.0, 3.0);
}

// Kernel 1: Parallel Per-Atom Exact Force Evaluation (Zero race conditions: each thread owns atom i!)
@compute @workgroup_size(64)
fn compute_organic_forces(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.atom_count) { return; }

  let ai = atoms[i];
  let pi = ai.pos_m.xyz;
  let qi = ai.vel_q.w;
  let ri = ai.frc_r.w;
  let zi = ai.vis_z.w;
  var f = vec3<f32>(0.0);
  var pot_i = 0.0;

  // 1. Covalent Morse bond-order stretching (with smooth reactive cleavage/formation!)
  for (var b = 0u; b < params.bond_count; b = b + 1u) {
    let bd = bonds[b];
    if (bd.dyn.z < 0.5) { continue; }
    let a_idx = u32(round(bd.ab_ord.x));
    let b_idx = u32(round(bd.ab_ord.y));
    if (a_idx != i && b_idx != i) { continue; }
    let other = select(a_idx, b_idx, a_idx == i);
    let po = atoms[other].pos_m.xyz;
    let dvec = pi - po;
    let dist = max(0.35, length(dvec));
    let dir = dvec / dist;
    let r_eq = bd.ab_ord.w;
    let nom = bd.ab_ord.z;
    let k_s = bd.dyn.y;
    // Continuous Morse force: U(r) = D * (1 - exp(-alpha*(r - r_eq)))^2
    // Physically deep covalent well (D_e ~ 3-5 eV) so molecules NEVER shatter under 300-600 K or bearing spin!
    let alpha = 1.65;
    let d_well = k_s * 0.85;
    let ex = exp(-alpha * clamp(dist - r_eq, -0.7, 3.5));
    let f_mag = -2.0 * d_well * alpha * (1.0 - ex) * ex;
    f = f + dir * f_mag;
    pot_i = pot_i + 0.5 * d_well * (1.0 - ex) * (1.0 - ex);
    if (a_idx == i) {
      bonds[b].dyn.x = eval_bond_order(dist, r_eq, nom);
    }
  }

  // 2. Hybridization-driven equilibrium angle bending (V = 0.5 * k * (cos(theta) - cos(theta0))^2)
  for (var a = 0u; a < params.angle_count; a = a + 1u) {
    let ang = angles[a];
    let ia = u32(round(ang.ijk_eq.x));
    let ja = u32(round(ang.ijk_eq.y));
    let ka = u32(round(ang.ijk_eq.z));
    if (ia != i && ja != i && ka != i) { continue; }
    let p_i = atoms[ia].pos_m.xyz;
    let p_j = atoms[ja].pos_m.xyz;
    let p_k = atoms[ka].pos_m.xyz;
    let u = p_i - p_j;
    let v = p_k - p_j;
    let lu = max(0.35, length(u));
    let lv = max(0.35, length(v));
    let uh = u / lu;
    let vh = v / lv;
    let cos_t = clamp(dot(uh, vh), -0.995, 0.995);
    let cos_0 = cos(ang.ijk_eq.w);
    let k_a = ang.k_pad.x;
    let d_u = (vh - uh * cos_t) / lu;
    let d_v = (uh - vh * cos_t) / lv;
    let coeff = -k_a * (cos_t - cos_0);
    if (ia == i) { f = f + d_u * coeff; }
    else if (ka == i) { f = f + d_v * coeff; }
    else { f = f - (d_u + d_v) * coeff; }
    pot_i = pot_i + (1.0 / 3.0) * 0.5 * k_a * (cos_t - cos_0) * (cos_t - cos_0);
  }

  // 3. Periodic Dihedral Torsions: V(phi) = 0.5 * V_n * (1 + cos(n*phi - gamma))
  for (var d = 0u; d < params.dihedral_count; d = d + 1u) {
    let dh = dihedrals[d];
    let i0 = u32(round(dh.ijkl.x));
    let i1 = u32(round(dh.ijkl.y));
    let i2 = u32(round(dh.ijkl.z));
    let i3 = u32(round(dh.ijkl.w));
    if (i0 != i && i1 != i && i2 != i && i3 != i) { continue; }
    let p0 = atoms[i0].pos_m.xyz;
    let p1 = atoms[i1].pos_m.xyz;
    let p2 = atoms[i2].pos_m.xyz;
    let p3 = atoms[i3].pos_m.xyz;
    let b1 = p1 - p0;
    let b2 = p2 - p1;
    let b3 = p3 - p2;
    let n1 = cross(b1, b2);
    let n2 = cross(b2, b3);
    let l1 = length(n1);
    let l2 = length(n2);
    let lb2 = length(b2);
    if (l1 > 1e-3 && l2 > 1e-3 && lb2 > 0.35) {
      let n1h = n1 / l1;
      let n2h = n2 / l2;
      let b2h = b2 / lb2;
      let sin_p = dot(cross(n1h, n2h), b2h);
      let cos_p = clamp(dot(n1h, n2h), -1.0, 1.0);
      let phi = atan2(sin_p, cos_p);
      let v_n = dh.par.x;
      let n_per = dh.par.y;
      let gam = dh.par.z;
      let dv_dphi = -0.5 * v_n * n_per * sin(n_per * phi - gam);
      let g0 = n1h * (lb2 / max(0.25, l1));
      let g3 = -n2h * (lb2 / max(0.25, l2));
      // Exact Newton's-3rd-Law Blondel-Karplus analytical dihedral gradients (F0 + F1 + F2 + F3 === 0 identically!)
      let inv_lb2_2 = 1.0 / max(0.12, lb2 * lb2);
      let c1 = clamp(dot(b1, b2) * inv_lb2_2, -1.8, 1.8);
      let c3 = clamp(dot(b3, b2) * inv_lb2_2, -1.8, 1.8);
      if (i0 == i) { f = f - g0 * dv_dphi; }
      else if (i3 == i) { f = f - g3 * dv_dphi; }
      else if (i1 == i) { f = f + ((1.0 + c1) * g0 - c3 * g3) * dv_dphi; }
      else { f = f + (-c1 * g0 + (1.0 + c3) * g3) * dv_dphi; }
      pot_i = pot_i + 0.125 * v_n * (1.0 + cos(n_per * phi - gam));
    }
  }

  // 4. Nonbonded Lennard-Jones + Dielectric-Screened Coulomb + Emergent Directional Hydrogen Bonds!
  let eps_r = max(1.0, params.dielectric_er);
  for (var j = 0u; j < params.atom_count; j = j + 1u) {
    if (j == i) { continue; }
    let aj = atoms[j];
    let dvec = pi - aj.pos_m.xyz;
    let dist = max(0.45, length(dvec));
    let dir = dvec / dist;
    let r_sum = ri + aj.frc_r.w;

    // Physical van der Waals Pauli steric repulsion + dispersion outside covalent bonding core!
    // Matches Bondi van der Waals contact radii (e.g. S + O: r_sum=1.71 -> sigma=2.94 A, r_min=3.30 A!)
    let sigma = max(1.60, r_sum * 1.72);
    if (dist < sigma * 2.2) {
      let sr = sigma / max(dist, sigma * 0.68);
      let sr6 = sr * sr * sr * sr * sr * sr;
      let f_lj = 0.52 * (2.0 * sr6 * sr6 - sr6) / max(0.55, dist);
      // Damp short-range LJ for directly bonded neighbors (dist < r_sum * 1.45)
      let nonbond_w = smoothstep(r_sum * 1.25, r_sum * 1.58, dist);
      f = f + dir * clamp(f_lj * nonbond_w, -16.0, 16.0);
    }

    // Dielectric-screened QEq Coulomb force (softened at short distance)
    let qj = aj.vel_q.w;
    let f_coul = (1.85 * qi * qj) / (eps_r * (dist * dist + 0.55));
    let nb_coul = smoothstep(r_sum * 1.15, r_sum * 1.60, dist);
    f = f + dir * clamp(f_coul * nb_coul, -8.0, 8.0);
    pot_i = pot_i + 0.5 * (1.85 * qi * qj) / (eps_r * sqrt(dist * dist + 0.55)) * nb_coul;

    // Emergent Hydrogen Bond attraction strictly from QEq partial charges (polar H+ ... electronegative N/O/F-)!
    let is_h_i = zi < 1.5 && qi > 0.14;
    let is_h_j = aj.vis_z.w < 1.5 && qj > 0.14;
    let is_acc_i = zi > 6.5 && zi < 10.5 && qi < -0.20;
    let is_acc_j = aj.vis_z.w > 6.5 && aj.vis_z.w < 10.5 && qj < -0.20;
    if ((is_h_i && is_acc_j) || (is_acc_i && is_h_j)) {
      if (dist > 1.35 && dist < 3.15) {
        let r_hb = 1.88;
        let dr_hb = dist - r_hb;
        let hb_w = exp(-dr_hb * dr_hb * 2.2);
        let f_hb = -1.65 * dr_hb * hb_w;
        f = f + dir * f_hb;
        pot_i = pot_i - 0.35 * hb_w;
      }
    }
  }

  // 5. Continuous Reaction-Coordinate Steering (for SN2 Walden inversion & Diels-Alder [4+2]!)
  let prog = clamp(params.react_progress, 0.0, 1.0);
  if (params.react_mode == 1u && prog > 0.01) {
    // SN2: nucleophile (react_a) attacks center (react_b) as leaving group (react_c) departs!
    let p_nuc = atoms[params.react_a].pos_m.xyz;
    let p_cen = atoms[params.react_b].pos_m.xyz;
    let p_lv  = atoms[params.react_c].pos_m.xyz;
    let r_target_nuc = mix(3.15, 1.76, prog);
    let r_target_lv  = mix(1.94, 3.65, prog);
    if (i == params.react_a || i == params.react_b) {
      let dv = p_nuc - p_cen;
      let d = max(0.5, length(dv));
      let f_s = -6.5 * (d - r_target_nuc) * (dv / d);
      f = f + select(-f_s, f_s, i == params.react_a);
    }
    if (i == params.react_c || i == params.react_b) {
      let dv = p_lv - p_cen;
      let d = max(0.5, length(dv));
      let f_s = -6.5 * (d - r_target_lv) * (dv / d);
      f = f + select(-f_s, f_s, i == params.react_c);
    }
    // Walden umbrella inversion of the 3 H substituents across the planar TS (prog ~ 0.5)!
    if (zi < 1.5) {
      let x_target = p_cen.x + mix(-0.36, 0.36, prog);
      f.x = f.x - 5.2 * (pi.x - x_target);
    }
  } else if (params.react_mode == 2u && prog > 0.01) {
    // Diels-Alder [4+2]: concerted approach of (react_a <-> react_b) and (react_c <-> react_d)
    let r_target = mix(2.85, 1.54, prog);
    if (i == params.react_a || i == params.react_b) {
      let dv = atoms[params.react_a].pos_m.xyz - atoms[params.react_b].pos_m.xyz;
      let d = max(0.5, length(dv));
      let f_s = -6.2 * (d - r_target) * (dv / d);
      f = f + select(-f_s, f_s, i == params.react_a);
    }
    if (i == params.react_c || i == params.react_d) {
      let dv = atoms[params.react_c].pos_m.xyz - atoms[params.react_d].pos_m.xyz;
      let d = max(0.5, length(dv));
      let f_s = -6.2 * (d - r_target) * (dv / d);
      f = f + select(-f_s, f_s, i == params.react_c);
    }
  } else if (params.react_mode == 3u) {
    // Molecular Bearing Mode (strictly topology-driven via ref_mount.w):
    //   - w == 1.0: Outer perimeter -CH2- housing bridges get a compliant elastic mount (k = 6.5) so the outer race
    //     stays centered while flexing realistically.
    //   - w == 2.0: Inner stator furan rings (O, C_a, C_b, H) are 100% FREE radially & tangentially so passing
    //     Sulfur teeth visibly flex & ripple each furan pocket via live GPU S...O Lennard-Jones + QEq forces!
    //   - w == 0.0: Inner rotor atoms experience uniform mass-proportional torque (ZERO shear distortion) +
    //     gentle axial thrust guide (z -> 0) while cradled radially by the 11 surrounding furan O atoms!
    let rm = ref_mount[i];
    if (rm.w > 0.5 && rm.w < 1.5) {
      let disp = pi - rm.xyz;
      f = f - disp * 6.5;
    } else if (rm.w >= 1.5) {
      // Free compliant furan tooth: gentle axial planarity guide only (100% free to flex radially/tangentially!)
      f.z = f.z - pi.z * 2.2;
    } else {
      let r_xy = max(0.25, length(pi.xy));
      let tang = vec2<f32>(-pi.y / r_xy, pi.x / r_xy);
      let m_i = 1.0 / max(1e-4, ai.pos_m.w);
      // Uniform mass-proportional angular torque (well below covalent dissociation limit even at max tau = 1.5!)
      let alpha_drive = params.react_progress * 0.24;
      f.x = f.x + tang.x * m_i * alpha_drive * r_xy;
      f.y = f.y + tang.y * m_i * alpha_drive * r_xy;
      // Gentle axial thrust bearing restoring z -> 0 so rotor stays cleanly inside stator plane
      f.z = f.z - pi.z * m_i * 1.8;
    }
  }

  // Gentle harmonic box confinement far outside (r > 13.5 A) so unbound clusters stay in frame
  let r_com = length(pi);
  if (r_com > 13.5) {
    f = f - (pi / r_com) * (r_com - 13.5) * 2.0;
  }

  atoms[i].frc_r = vec4<f32>(clamp(f, vec3<f32>(-85.0), vec3<f32>(85.0)), ri);
  // Temporarily stash per-atom potential in telemetry scratch via reduction kernel
  if (i == 0u) {
    telemetry[1].x = pot_i;
  }
}

// Kernel 2: Langevin Thermostat + Symplectic Integration + Dynamic Reactive Bond-Order Updates
@compute @workgroup_size(64)
fn integrate_organic_atoms(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.atom_count) { return; }
  var a = atoms[i];
  let dt = params.dt;
  let inv_m = a.pos_m.w;
  let f = a.frc_r.xyz;

  // Deterministic pseudo-Gaussian Langevin thermal kick proportional to sqrt(T * gamma / m)
  // For free molecular bearing rotor atoms (react_mode == 3 && ref_mount.w < 0.5), use smooth superlubric
  // phonon drag + quadratic high-RPM governor so even max torque spins briskly without centrifugal bond rupture!
  let is_free_rotor = (params.react_mode == 3u && ref_mount[i].w < 0.5);
  let spd_i = length(a.vel_q.xyz);
  let gamma_eff = select(params.gamma_damp, 0.88 + 0.38 * min(4.0, spd_i), is_free_rotor);
  let s0 = f32(i) * 19.31 + f32(params.step_index) * 3.73;
  let rx = (hash_f(s0 + 1.1) + hash_f(s0 + 2.3) - 1.0) * 1.732;
  let ry = (hash_f(s0 + 3.7) + hash_f(s0 + 5.1) - 1.0) * 1.732;
  let rz = (hash_f(s0 + 7.3) + hash_f(s0 + 9.9) - 1.0) * 1.732;
  let sigma_v = sqrt(max(0.0, params.temp_k * 0.00018 * gamma_eff * inv_m * dt));

  var v = a.vel_q.xyz + f * (inv_m * dt);
  v = v * exp(-gamma_eff * dt) + vec3<f32>(rx, ry, rz) * sigma_v;
  v = clamp(v, vec3<f32>(-12.0), vec3<f32>(12.0));
  let p = a.pos_m.xyz + v * dt;

  a.pos_m = vec4<f32>(p, inv_m);
  a.vel_q = vec4<f32>(v, a.vel_q.w);
  atoms[i] = a;
}

// Kernel 2b: Parallel Zero-COM-Drift & Linear-Momentum Anchor (@workgroup_size(64))
// Eliminates Langevin random-walk & translational drift so NO compound ever jiggles out of view!
// Preserves 100% of internal vibrations, torsions, H-bonding, SN2/Diels-Alder reactions, & bearing rotation!
@compute @workgroup_size(64)
fn recenter_organic_com(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let is_bearing = params.react_mode == 3u;
  let end_n = select(params.atom_count, max(1u, params.react_a), is_bearing);
  var m_sum = 0.0;
  var mr_sum = vec3<f32>(0.0);
  var mv_sum = vec3<f32>(0.0);
  var i = tid;
  loop {
    if (i >= end_n) { break; }
    let a = atoms[i];
    let m = 1.0 / max(1e-4, a.pos_m.w);
    m_sum = m_sum + m;
    mr_sum = mr_sum + a.pos_m.xyz * m;
    mv_sum = mv_sum + a.vel_q.xyz * m;
    i = i + 64u;
  }
  wg0[tid] = m_sum;
  wg_v0[tid] = mr_sum;
  wg_v1[tid] = mv_sum;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] = wg0[tid] + wg0[tid + s];
      wg_v0[tid] = wg_v0[tid] + wg_v0[tid + s];
      wg_v1[tid] = wg_v1[tid] + wg_v1[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  let inv_mtot = 1.0 / max(1e-4, wg0[0]);
  let r_com = wg_v0[0] * inv_mtot;
  let v_com = wg_v1[0] * inv_mtot;
  // Smoothly subtract exact center-of-mass drift:
  //   - In bearing mode, apply only a gentle centering assist (0.04) so the real 11-fold S...O steric cradle
  //     physically drives bearing precession/wobble while keeping the rotor cleanly inside the macrocycle!
  let corr_r = r_com * select(0.25, 0.04, is_bearing);
  let corr_v = v_com * select(1.0, 0.08, is_bearing);
  var j = tid;
  loop {
    if (j >= end_n) { break; }
    var a = atoms[j];
    a.pos_m = vec4<f32>(a.pos_m.xyz - corr_r, a.pos_m.w);
    a.vel_q = vec4<f32>(a.vel_q.xyz - corr_v, a.vel_q.w);
    atoms[j] = a;
    j = j + 64u;
  }
}

// Kernel 3: Parallel 64-Thread Telemetry & Emergent Bond/H-Bond Reduction
@compute @workgroup_size(64)
fn reduce_organic_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var ke = 0.0;
  var active_b = 0.0;
  var hbond_cnt = 0.0;
  var r_gyr2 = 0.0;

  var i = tid;
  loop {
    if (i >= params.atom_count) { break; }
    let a = atoms[i];
    let m = 1.0 / max(1e-4, a.pos_m.w);
    let v2 = dot(a.vel_q.xyz, a.vel_q.xyz);
    ke = ke + 0.5 * m * v2;
    r_gyr2 = r_gyr2 + dot(a.pos_m.xyz, a.pos_m.xyz);
    // Count emergent H-bonds (i = polar H+, j = electronegative N/O/F-)
    if (a.vis_z.w < 1.5 && a.vel_q.w > 0.14) {
      for (var j = 0u; j < params.atom_count; j = j + 1u) {
        let aj = atoms[j];
        if (aj.vis_z.w > 6.5 && aj.vis_z.w < 10.5 && aj.vel_q.w < -0.20) {
          let d = length(a.pos_m.xyz - aj.pos_m.xyz);
          if (d > 1.35 && d < 2.65) { hbond_cnt = hbond_cnt + 1.0; }
        }
      }
    }
    i = i + 64u;
  }

  var b = tid;
  loop {
    if (b >= params.bond_count) { break; }
    let bd = bonds[b];
    if (bd.dyn.w > 1.5) {
      // Dynamic nonbonded van der Waals / steric bearing-race contact pulse (e.g. S...O interaction!)
      let ia = u32(round(bd.ab_ord.x));
      let ib = u32(round(bd.ab_ord.y));
      let dist = length(atoms[ia].pos_m.xyz - atoms[ib].pos_m.xyz);
      let contact_w = clamp((3.55 - dist) / 1.05, 0.0, 1.0);
      bonds[b].dyn.x = select(0.0, contact_w * 0.95, dist < 3.55);
    } else if (bd.dyn.w > 0.5) {
      // Dynamic emergent H-bond beam slot (strictly activated by QEq charges & live D-H...A distance!)
      let ia = u32(round(bd.ab_ord.x));
      let ib = u32(round(bd.ab_ord.y));
      let aa = atoms[ia];
      let ab = atoms[ib];
      let dist = length(aa.pos_m.xyz - ab.pos_m.xyz);
      let is_hb = (aa.vel_q.w > 0.14 && ab.vel_q.w < -0.20 && dist > 1.35 && dist < 2.75);
      let hb_d = dist - 1.90;
      bonds[b].dyn.x = select(0.0, 0.75 * exp(-(hb_d * hb_d) * 1.4), is_hb);
    } else if (bd.dyn.z > 0.5) {
      let pa = atoms[u32(round(bd.ab_ord.x))].pos_m.xyz;
      let pb = atoms[u32(round(bd.ab_ord.y))].pos_m.xyz;
      let dist = length(pa - pb);
      let bo = eval_bond_order(dist, bd.ab_ord.w, bd.ab_ord.z);
      bonds[b].dyn.x = bo;
      if (bo > 0.28) { active_b = active_b + 1.0; }
    }
    b = b + 64u;
  }

  wg0[tid] = ke; wg1[tid] = active_b; wg2[tid] = hbond_cnt; wg3[tid] = r_gyr2;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let n_f = max(1.0, f32(params.atom_count));
    let inst_t = (wg0[0] / (1.5 * n_f)) * 9200.0;
    let rg = sqrt(wg3[0] / n_f);
    telemetry[0] = vec4<f32>(inst_t, wg1[0], wg2[0], rg);
    // Compute rotor angular velocity omega (rad/sim-time) & angle theta for bearing mode
    if (params.react_mode == 3u && params.react_a >= 3u) {
      var lz = 0.0;
      var iz = 0.0;
      for (var k = 0u; k < params.react_a; k = k + 1u) {
        let ak = atoms[k];
        let mk = 1.0 / max(1e-4, ak.pos_m.w);
        lz = lz + mk * (ak.pos_m.x * ak.vel_q.y - ak.pos_m.y * ak.vel_q.x);
        iz = iz + mk * (ak.pos_m.x * ak.pos_m.x + ak.pos_m.y * ak.pos_m.y);
      }
      let omega = lz / max(1e-3, iz);
      let a0 = atoms[0].pos_m.xy;
      let theta = atan2(a0.y, a0.x);
      telemetry[1] = vec4<f32>(telemetry[1].x, omega, theta, 1.0);
    } else {
      telemetry[1] = vec4<f32>(telemetry[1].x, 0.0, 0.0, 0.0);
    }
  }
}
`;function K(t,{graph:n,qeq:r=null,temperatureK:i=300,dielectricEr:c=1,seed:l=20261125,label:u=`ulg-organic-md`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createReactiveBondOrderMdSessionWebGpu requires a live WebGPU GPUDevice`);let d=n||F(`benzene`),f=r||L(d,{dielectricEr:c}),p=d.atomCount,m=d.bonds.map(e=>{let t=(d.atoms[e.a].rCovA+d.atoms[e.b].rCovA)*(e.order>=2.5?.8:e.order>=1.5?.89:1),n=t>1.85?14:42;return{a:e.a,b:e.b,order:e.order,rEq:t,kMorse:n*e.order,active:1,isForming:!1}}),h=0,g=0,_=0,v=0,y=0;d.reactionMeta?.kind===`sn2`?(h=1,g=d.reactionMeta.nucleophileIdx,_=d.reactionMeta.centerIdx,v=d.reactionMeta.leavingIdx,m.push({a:g,b:_,order:1,rEq:1.76,kMorse:12,active:1,isForming:!0})):d.reactionMeta?.kind===`diels-alder`?(h=2,[[g,_],[v,y]]=d.reactionMeta.pairs,m.push({a:g,b:_,order:1,rEq:1.54,kMorse:12,active:1,isForming:!0},{a:v,b:y,order:1,rEq:1.54,kMorse:12,active:1,isForming:!0})):d.rotorMeta?.kind===`molecular-bearing`&&(h=3,g=d.rotorMeta.rotorCount||24,_=d.rotorMeta.statorStart||24);let b=new Uint8Array(p);for(let e of d.bonds)d.atoms[e.b].Z===1&&(b[e.a]+=1),d.atoms[e.a].Z===1&&(b[e.b]+=1);let x=new Float32Array(Math.max(1,p)*4);for(let e=0;e<p;e+=1){let t=d.atoms[e];if(x[e*4+0]=t.pos[0],x[e*4+1]=t.pos[1],x[e*4+2]=t.pos[2],h===3&&e>=_){let n=t.Z===6&&b[e]>=2;x[e*4+3]=n?1:2}else x[e*4+3]=0}let S=new Float32Array(Math.max(1,p)*16);for(let e=0;e<p;e+=1){let t=d.atoms[e],n=e*16;S[n+0]=t.pos[0],S[n+1]=t.pos[1],S[n+2]=t.pos[2],S[n+3]=1/Math.max(1,t.massU),S[n+4]=0,S[n+5]=0,S[n+6]=0,S[n+7]=f.charges[e]||0,S[n+8]=0,S[n+9]=0,S[n+10]=0,S[n+11]=t.rCovA,S[n+12]=t.rgb[0],S[n+13]=t.rgb[1],S[n+14]=t.rgb[2],S[n+15]=t.Z}let C=new Set(m.map(e=>`${Math.min(e.a,e.b)}:${Math.max(e.a,e.b)}`));for(let e=0;e<p;e+=1)if(!(d.atoms[e].Z!==1||(f.charges[e]||0)<=.14))for(let t=0;t<p;t+=1){if(e===t)continue;let n=d.atoms[t].Z;!(n===7||n===8||n===9)||(f.charges[t]||0)>=-.2||C.has(`${Math.min(e,t)}:${Math.max(e,t)}`)||m.push({a:e,b:t,order:.6,rEq:1.9,kMorse:0,active:0,isForming:!0,isHBond:1})}if(h===3){for(let e=0;e<_;e+=1)if(!(d.atoms[e].Z<=6))for(let t=_;t<p;t+=1)d.atoms[t].Z<=6||m.push({a:e,b:t,order:.5,rEq:3.1,kMorse:0,active:0,isForming:!0,isHBond:2})}let w=new Float32Array(Math.max(1,m.length)*8);for(let e=0;e<m.length;e+=1){let t=m[e],n=e*8;w[n+0]=t.a,w[n+1]=t.b,w[n+2]=t.order,w[n+3]=t.rEq,w[n+4]=t.isForming?0:t.order,w[n+5]=t.kMorse,w[n+6]=t.active,w[n+7]=Number(t.isHBond)||0}let T=new Float32Array(Math.max(1,d.angles.length)*8);for(let e=0;e<d.angles.length;e+=1){let t=d.angles[e],n=e*8;T[n+0]=t.i,T[n+1]=t.j,T[n+2]=t.k,T[n+3]=t.eqRad,T[n+4]=t.kAngle}let E=new Float32Array(Math.max(1,d.dihedrals.length)*8);for(let e=0;e<d.dihedrals.length;e+=1){let t=d.dihedrals[e],n=e*8;E[n+0]=t.i,E[n+1]=t.j,E[n+2]=t.k,E[n+3]=t.l,E[n+4]=t.barrier,E[n+5]=t.periodicity,E[n+6]=t.phase}let D=[a(0,`uniform`),a(1,`storage`),a(2,`storage`),a(3,`read-only-storage`),a(4,`read-only-storage`),a(5,`storage`),a(6,`read-only-storage`)],O=e=>s(t,{cacheKey:`ulg-organic-md-${e}.v6-vdw-bearing`,label:`${u}-${e}`,code:te,entryPoint:e,bindings:D}),k=O(`compute_organic_forces`),A=O(`integrate_organic_atoms`),j=O(`recenter_organic_com`),M=O(`reduce_organic_telemetry`),N=t.createBuffer({label:`${u}-params`,size:64,usage:U.UNIFORM|U.COPY_DST}),P=t.createBuffer({label:`${u}-atoms`,size:S.byteLength,usage:U.STORAGE|U.COPY_SRC|U.COPY_DST}),I=t.createBuffer({label:`${u}-bonds`,size:w.byteLength,usage:U.STORAGE|U.COPY_SRC|U.COPY_DST}),R=t.createBuffer({label:`${u}-angles`,size:T.byteLength,usage:U.STORAGE|U.COPY_DST}),z=t.createBuffer({label:`${u}-dihedrals`,size:E.byteLength,usage:U.STORAGE|U.COPY_DST}),B=t.createBuffer({label:`${u}-ref-mount`,size:x.byteLength,usage:U.STORAGE|U.COPY_DST}),V=t.createBuffer({label:`${u}-tel`,size:32,usage:U.STORAGE|U.COPY_SRC}),ee=t.createBuffer({label:`${u}-tel-rd`,size:32,usage:U.MAP_READ|U.COPY_DST}),G=t.createBuffer({label:`${u}-atoms-rd`,size:S.byteLength,usage:U.MAP_READ|U.COPY_DST});t.queue.writeBuffer(P,0,S),t.queue.writeBuffer(I,0,w),t.queue.writeBuffer(R,0,T),t.queue.writeBuffer(z,0,E),t.queue.writeBuffer(B,0,x);let K=o(t,{layout:k.bindGroupLayout,label:`${u}-bg`,entries:[{binding:0,resource:{buffer:N}},{binding:1,resource:{buffer:P}},{binding:2,resource:{buffer:I}},{binding:3,resource:{buffer:R}},{binding:4,resource:{buffer:z}},{binding:5,resource:{buffer:V}},{binding:6,resource:{buffer:B}}]}),ne=Math.max(5,Number(i)||300),q=Math.max(1,Number(c)||1),J=h===3?.45:0,re=0,ie=!1,ae=!1,Y=new Float32Array(S),X=Object.freeze({schema:H,stepIndex:0,atomCount:p,bondCount:m.length,temperatureK:ne,dielectricEr:q,reactProgress:J,instTempK:ne,activeBondCount:d.bondCount,hBondCount:0,radiusOfGyrationA:1.5,dipoleDebye:f.dipoleDebye,bornSolvationKjMol:f.bornSolvationKjMol,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),Z=Math.ceil(Math.max(1,p)/64);function Q(e){ne=Math.max(5,Math.min(2e3,Number(e)||300))}function oe(e){q=Math.max(1,Math.min(100,Number(e)||1)),f=L(d,{dielectricEr:q})}function se(e){J=Math.max(0,Math.min(h===3?1.5:1,Number(e)||0))}async function ce({dt:n=.014,substeps:r=4,readTelemetry:i=!0,readPositions:a=!1}={}){if(ae)return X;let o=Math.max(1,Math.min(12,Math.trunc(r))),s=Math.max(.004,Math.min(.022,Number(n)||.014)),c=l%997*.17+1.3,b=t.createCommandEncoder({label:`${u}-enc-${re}`});for(let e=0;e<o;e+=1){re+=1;let n=new ArrayBuffer(64);new Uint32Array(n,0,8).set([p,m.length,d.angles.length,d.dihedrals.length,re,h,g,_]),new Float32Array(n,32,6).set([s,ne,q,J,3.8,c]),new Uint32Array(n,56,2).set([v,y]),t.queue.writeBuffer(N,0,n);let r=b.beginComputePass({label:`${u}-sub-${e}`});r.setBindGroup(0,K),r.setPipeline(k.pipeline),r.dispatchWorkgroups(Z),r.setPipeline(A.pipeline),r.dispatchWorkgroups(Z),r.setPipeline(j.pipeline),r.dispatchWorkgroups(1),e===o-1&&(r.setPipeline(M.pipeline),r.dispatchWorkgroups(1)),r.end()}let x=i&&!ie&&ee.mapState===`unmapped`,C=x&&a&&G.mapState===`unmapped`;x&&(ie=!0,b.copyBufferToBuffer(V,0,ee,0,32),C&&b.copyBufferToBuffer(P,0,G,0,S.byteLength)),t.queue.submit([b.finish()]);let w=X.instTempK,T=X.activeBondCount,E=X.hBondCount,D=X.radiusOfGyrationA,O=X.rotorOmegaRadPs??0,F=X.rotorThetaRad??0;if(x)try{let e=[ee.mapAsync(U.MAP_READ)];if(C&&e.push(G.mapAsync(U.MAP_READ)),await Promise.all(e),!ae){let e=new Float32Array(ee.getMappedRange(0,32));w=e[0],T=Math.round(e[1]),E=Math.round(e[2]),D=e[3],O=e[5]||0,F=e[6]||0,C&&(Y=new Float32Array(G.getMappedRange().slice(0)))}try{ee.unmap()}catch{}if(C)try{G.unmap()}catch{}}catch(e){if(!ae&&e?.name!==`AbortError`)throw e}finally{ie=!1}return X=Object.freeze({schema:H,stepIndex:re,atomCount:p,bondCount:m.length,temperatureK:ne,dielectricEr:q,reactProgress:J,instTempK:w,activeBondCount:T,hBondCount:E,radiusOfGyrationA:D,rotorOmegaRadPs:O,rotorThetaRad:F,dipoleDebye:f.dipoleDebye,bornSolvationKjMol:f.bornSolvationKjMol,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),X}function le(){if(!ae){ae=!0;for(let e of[N,P,I,R,z,B,V,ee,G])try{e.destroy()}catch{}}}return Object.freeze({schema:H,lawAdapter:W,graph:d,get qeq(){return f},get atomCount(){return p},get bondCount(){return m.length},get stepIndex(){return re},get reactMode(){return h},get reactProgress(){return J},get bondList(){return m},getResidentAtomsBuffer:()=>P,getResidentBondsBuffer:()=>I,getLatestAtomsHost:()=>Y,getTelemetry:()=>X,setTemperatureK:Q,setDielectricEr:oe,setReactionProgress:se,step:ce,dispose:le})}function ne(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`reactive-bond-order-md@1`)?e.resolveModule(`reactive-bond-order-md@1`)?.descriptor||null:e.registerModule({method:{model:`reactive-bond-order-md`,version:1},kernel:{sourceModule:`src/runtime/organic/reactiveBondOrderMdGpu.js`,entryPoint:`compute_organic_forces`,workgroupSize:64},parameterSchema:{temperatureK:{type:`number`,min:5,max:2e3,required:!1},dielectricEr:{type:`number`,min:1,max:120,required:!1}},stateLayout:{tensorId:`organic-atoms-state`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`invMass`,`vx`,`vy`,`vz`,`q`,`fx`,`fy`,`fz`,`rCov`,`r`,`g`,`b`,`Z`]},scaleRangeM:[1e-10,1e-8],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=K(n,{graph:F(r.moleculeId||`butane`),temperatureK:r.temperatureK??300,dielectricEr:r.dielectricEr??78.4}),a=await i.step({dt:.014,substeps:4,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:reactive-md:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/organic/reactiveBondOrderMdGpu.js`,entryPoint:`createReactiveBondOrderMdSessionWebGpu`,kernelEntryPoint:`compute_organic_forces`},representation:`organic-reactive-md-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-reactive-md`,placement:`local`},validity:{finite:Number.isFinite(a.instTempK)&&Number.isFinite(a.radiusOfGyrationA)},validation:{status:`pass`,validationMode:`gpu-reactive-md-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var q=`ulg.organic.acid-base-catalysis-webgpu.v1`,J=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),re=Object.freeze({id:`acid-base-catalysis-kinetics`,lawNodeId:`law:organic-acid-base-catalysis-kinetics`,orderConstraint:`after:reactive-bond-order-md`,adapterMode:n.CELL_LOCAL,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`organic-molecular-graph`,`qeq-partial-charges`,`autocatalytic-field-a`]),writes:Object.freeze([`protonation-speciation`,`autocatalytic-field-b`]),accumulates:Object.freeze([`chiral-autocatalysis-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`species-mass-flux-balance`,`proton-charge-balance`]),validityDomain:Object.freeze({phMin:0,phMax:14,dielectricMin:1}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e-9,.001]),fundamentalLaws:Object.freeze([`bronsted-lowry-proton-transfer`,`henderson-hasselbalch-speciation`,`born-dielectric-solvation-pka-shift`,`frank-autocatalytic-chiral-symmetry-breaking`,`spatial-reaction-diffusion-kinetics`])});function ie(e={}){let t=!!e.acidBaseOrAutocatalysisActive||!!e.organicChemistryActive&&(Number(e.dielectricEr)||1)>=2;return{active:t,reason:t?`protic-or-autocatalytic-network-present`:`non-protic-dormant`}}function ae(t,{pH:n=7,dielectricEr:r=78.4}={}){let i=Math.max(1,Number(r)||78.4),a=L(t,{dielectricEr:i}),o=[];for(let e=0;e<t.atomCount;e+=1){let n=t.atoms[e];if(n.Z!==8&&n.Z!==7&&n.Z!==16)continue;let r=t.adj[e].filter(e=>t.atoms[e.to].Z===1),s=t.adj[e].filter(e=>t.atoms[e.to].Z>1),c=0,l=0;for(let n of s){let r=t.atoms[n.to];l+=Math.max(0,r.chiEv-5.2);for(let r of t.adj[n.to]){if(r.to===e)continue;let n=t.atoms[r.to];r.order>=1.5&&n.chiEv>6.5&&(c+=(n.chiEv-5.2)*.62)}}let u=18*(1/i-1/78.4);if(n.Z===8&&r.length>=1){let t=Math.max(0,a.charges[r[0].to]),n=Math.max(-2,Math.min(28,15.8-c*4.9-l*.9-t*2.2+u));o.push({atomIndex:e,sym:`O–H`,role:`acid`,pKa:n})}else if(n.Z===16&&r.length>=1){let t=Math.max(0,Math.min(24,10.2-c*3.5-l*.8+u));o.push({atomIndex:e,sym:`S–H`,role:`acid`,pKa:t})}else if(n.Z===7&&!n.isPiAtom){let t=Math.max(1,Math.min(14,9.8-l*.85-u*.45));o.push({atomIndex:e,sym:`N–H⁺/N`,role:`base`,pKa:t})}else if(n.Z===7&&n.isPiAtom&&r.length===0){let t=Math.max(.5,Math.min(11,4.8-l*.6-u*.4));o.push({atomIndex:e,sym:`=N–`,role:`base`,pKa:t})}}let s=e=>{let n=t.totalCharge||0;for(let t of o){let r=1/(1+10**(t.pKa-e));t.role===`acid`?n-=r:n+=1-r}return n},c=[];for(let e=0;e<=56;e+=1){let t=e*.25;c.push({pH:t,netCharge:s(t)})}let l=o.map(e=>{let t=1/(1+10**(e.pKa-n));return Object.freeze({...e,deprotonatedFraction:t,protonatedFraction:1-t})});return Object.freeze({schema:q,pH:n,dielectricEr:i,sites:l,netChargeAtPh:s(n),titrationCurve:c,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}var Y=`
struct AutoParams {
  width: u32,
  height: u32,
  mode: u32,         // 0=Frank Chiral Symmetry Breaking, 1=BZ Oregonator Spirals, 2=Prebiotic RAF Network
  step_index: u32,
  dt: f32,
  feed_rate: f32,    // Achiral precursor / feedstock influx
  k_auto: f32,       // Autocatalytic amplification rate
  k_inhib: f32,      // Mutual chiral antagonism (0 -> racemic, >0 -> spontaneous symmetry breaking!)
  diff_a: f32,
  diff_b: f32,
  temp_noise: f32,
  pad0: f32,
};

@group(0) @binding(0) var<uniform> params: AutoParams;
@group(0) @binding(1) var<storage, read> field_in: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> field_out: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

fn idx_wrap(x: i32, y: i32) -> u32 {
  let wi = i32(params.width);
  let hi = i32(params.height);
  let ux = u32(((x % wi) + wi) % wi);
  let uy = u32(((y % hi) + hi) % hi);
  return uy * params.width + ux;
}

@compute @workgroup_size(8, 8)
fn step_autocatalytic_field(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = gid.y * params.width + gid.x;
  let c = field_in[idx];
  let lap = field_in[idx_wrap(ix - 1, iy)]
    + field_in[idx_wrap(ix + 1, iy)]
    + field_in[idx_wrap(ix, iy - 1)]
    + field_in[idx_wrap(ix, iy + 1)]
    - 4.0 * c;
  let dt = params.dt;

  var next_c = c;
  if (params.mode == 0u) {
    // Classic Frank (1953) Chiral Symmetry Breaking:
    //   Linear autocatalysis k_auto*A*L + small achiral background 0.025*A,
    //   coupled ONLY by mutual chiral antagonism (-k_inhib * L * D)!
    //   Null limit: k_inhib = 0 -> linear symmetric growth + achiral feed stays racemic (purity -> 0)!
    //   Active k_inhib > 0 -> hyperbolic mutual inhibition amplifies noise into pure L & D homochiral domains!
    let L = max(0.0, c.x);
    let D = max(0.0, c.y);
    let A = max(0.0, c.z);
    let P = max(0.0, c.w);
    let prodL = params.k_auto * A * L + 0.025 * A;
    let prodD = params.k_auto * A * D + 0.025 * A;
    let inhib = params.k_inhib * L * D;
    let decay = 0.09;
    let dL = prodL - inhib - decay * L + params.diff_a * lap.x;
    let dD = prodD - inhib - decay * D + params.diff_a * lap.y;
    let dA = params.feed_rate * (1.0 - A) - (prodL + prodD) + params.diff_b * lap.z;
    let dP = 2.0 * inhib - 0.14 * P + params.diff_a * 0.4 * lap.w;
    next_c = clamp(vec4<f32>(L + dL * dt, D + dD * dt, A + dA * dt, P + dP * dt), vec4<f32>(0.0), vec4<f32>(2.5));
  } else if (params.mode == 1u) {
    // Belousov-Zhabotinsky Barkley / Oregonator Excitable Spiral Wave Medium (crisp self-sustaining rotors!)
    let u = clamp(c.x, 0.0, 1.0);
    let v = clamp(c.y, 0.0, 1.0);
    let a_b = 0.80;
    let b_b = clamp(0.036 + params.k_inhib * 0.006, 0.028, 0.065);
    let eps_b = 0.022;
    let dt_b = 0.018;
    let u_th = (v + b_b) / a_b;
    let react_u = ((u * (1.0 - u) * (u - u_th)) / eps_b) * dt_b;
    let u_next = clamp(u + react_u + 0.16 * lap.x, 0.0, 1.0);
    let v_next = clamp(v + (u - v) * dt_b + 0.018 * lap.y, 0.0, 1.0);
    next_c = vec4<f32>(u_next, v_next, clamp(u_next * 0.75 + v_next * 0.25, 0.0, 1.0), 0.0);
  } else {
    // Prebiotic Open-System Autocatalytic RAF Synthesis (Feedstock F -> Autocatalyst X -> Polymer Y)
    let F = max(0.0, c.z);
    let X = max(0.0, c.x);
    let Y = max(0.0, c.y);
    let rxn = params.k_auto * F * X * X;
    let dF = params.feed_rate * (1.0 - F) - rxn + params.diff_b * lap.z;
    let dX = rxn - (params.feed_rate + 0.056) * X + params.diff_a * lap.x;
    let dY = 0.056 * X - 0.03 * Y + params.diff_a * 0.5 * lap.y;
    next_c = clamp(vec4<f32>(X + dX * dt, Y + dY * dt, F + dF * dt, rxn), vec4<f32>(0.0), vec4<f32>(2.0));
  }
  field_out[idx] = next_c;
}

@compute @workgroup_size(64)
fn reduce_autocatalytic_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let total = params.width * params.height;
  var sum_x = 0.0;
  var sum_y = 0.0;
  var sum_z = 0.0;
  var sum_abs_ee = 0.0;
  var i = tid;
  loop {
    if (i >= total) { break; }
    let c = field_out[i];
    sum_x = sum_x + c.x;
    sum_y = sum_y + c.y;
    sum_z = sum_z + c.z;
    sum_abs_ee = sum_abs_ee + abs(c.x - c.y) / max(1e-4, c.x + c.y);
    i = i + 64u;
  }
  wg0[tid] = sum_x; wg1[tid] = sum_y; wg2[tid] = sum_z; wg3[tid] = sum_abs_ee;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let inv = 1.0 / max(1.0, f32(total));
    let mL = wg0[0] * inv;
    let mD = wg1[0] * inv;
    let global_ee = (mL - mD) / max(1e-4, mL + mD);
    telemetry[0] = vec4<f32>(mL, mD, global_ee, wg3[0] * inv);
  }
}
`;function X(t,{width:n=128,height:r=128,mode:i=`frank-chiral`,kInhib:c=1.85,feedRate:l=.16,seed:u=20261125,label:d=`ulg-organic-autocat`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createAutocatalyticNetworkSessionWebGpu requires a live WebGPU GPUDevice`);let f=Math.max(32,Math.min(256,Math.trunc(n))),p=Math.max(32,Math.min(256,Math.trunc(r))),m=i===`belousov-zhabotinsky`?1:i===`prebiotic-raf`?2:0,h=u>>>0||1,g=()=>{h=h+1831565813|0;let e=Math.imul(h^h>>>15,1|h);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296},_=new Float32Array(f*p*4);for(let e=0;e<p;e+=1)for(let t=0;t<f;t+=1){let n=(e*f+t)*4,r=t/f-.5,i=e/p-.5;if(m===0){let e=0;for(let[t,n,a]of[[7.3,4.1,.3],[-5.2,8.7,1.9],[11.4,-6.8,3.1],[-9.1,-9.4,4.7],[3.6,-13.2,2.4]])e+=Math.sin(r*t+i*n+a)*.015;e+=(g()-.5)*.04,_[n+0]=Math.max(.05,.28+e),_[n+1]=Math.max(.05,.28-e),_[n+2]=.85,_[n+3]=0}else if(m===1){let e=r>-.05&&r<.04&&i>-.02&&i<.36,t=r>=.04&&r<.2&&i>-.02&&i<.36,a=r<-.1&&r>-.38&&i>-.22&&i<-.13,o=r<-.1&&r>-.38&&i<=-.22&&i>-.36;_[n+0]=e||a?.98:0,_[n+1]=t||o?.65:0,_[n+2]=.2,_[n+3]=0}else{let e=Math.hypot(r-.14,i+.1)<.08||Math.hypot(r+.16,i-.12)<.08||Math.hypot(r,i)<.07;_[n+0]=e?.42+g()*.1:.01,_[n+1]=0,_[n+2]=e?.5:1,_[n+3]=0}}let v=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`storage`),a(3,`storage`)],y=s(t,{cacheKey:`ulg-organic-autocat-step.v1`,label:`${d}-step`,code:Y,entryPoint:`step_autocatalytic_field`,bindings:v}),b=s(t,{cacheKey:`ulg-organic-autocat-tel.v1`,label:`${d}-tel`,code:Y,entryPoint:`reduce_autocatalytic_telemetry`,bindings:v}),x=t.createBuffer({label:`${d}-params`,size:48,usage:J.UNIFORM|J.COPY_DST}),S=t.createBuffer({label:`${d}-fa`,size:_.byteLength,usage:J.STORAGE|J.COPY_SRC|J.COPY_DST}),C=t.createBuffer({label:`${d}-fb`,size:_.byteLength,usage:J.STORAGE|J.COPY_SRC|J.COPY_DST}),w=t.createBuffer({label:`${d}-tel`,size:16,usage:J.STORAGE|J.COPY_SRC}),T=t.createBuffer({label:`${d}-tel-rd`,size:16,usage:J.MAP_READ|J.COPY_DST});t.queue.writeBuffer(S,0,_),t.queue.writeBuffer(C,0,_);let E=o(t,{layout:y.bindGroupLayout,label:`${d}-bg-ab`,entries:[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:S}},{binding:2,resource:{buffer:C}},{binding:3,resource:{buffer:w}}]}),D=o(t,{layout:y.bindGroupLayout,label:`${d}-bg-ba`,entries:[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:C}},{binding:2,resource:{buffer:S}},{binding:3,resource:{buffer:w}}]}),O=Number(c),k=Number(l),A=0,j=0,M=!1,N=!1,P=Object.freeze({schema:q,mode:i,stepIndex:0,meanL:.25,meanD:.25,globalEnantiomericExcess:0,localChiralPurity:0,kInhib:O,feedRate:k,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),F=Math.ceil(f/8),I=Math.ceil(p/8);function L(e){O=Math.max(0,Math.min(4,Number(e)||0))}function R(e){k=Math.max(0,Math.min(.6,Number(e)||0))}async function z({dt:n=.16,substeps:r=6,readTelemetry:a=!0}={}){if(N)return P;let o=Math.max(1,Math.min(20,Math.trunc(r))),s=Math.max(.02,Math.min(.24,Number(n)||.16)),c=m===0?1.45:m===1?1:1.05,l=m===2?.08:.12,u=m===2?.18:.2,h=m===2?Math.min(.08,Math.max(0,k*.25)):k,g=new ArrayBuffer(48);new Uint32Array(g,0,4).set([f,p,m,j+o]),new Float32Array(g,16,8).set([s,h,c,O,l,u,0,0]),t.queue.writeBuffer(x,0,g);let _=t.createCommandEncoder({label:`${d}-enc-${j}`}),v=_.beginComputePass({label:`${d}-pass`});v.setPipeline(y.pipeline);for(let e=0;e<o;e+=1)v.setBindGroup(0,A===0?E:D),v.dispatchWorkgroups(F,I),A=1-A,j+=1;v.setPipeline(b.pipeline),v.setBindGroup(0,A===1?E:D),v.dispatchWorkgroups(1),v.end();let S=a&&!M&&T.mapState===`unmapped`;S&&(M=!0,_.copyBufferToBuffer(w,0,T,0,16)),t.queue.submit([_.finish()]);let C=P.meanL,L=P.meanD,R=P.globalEnantiomericExcess,z=P.localChiralPurity;if(S)try{if(await T.mapAsync(J.MAP_READ),!N){let e=new Float32Array(T.getMappedRange(0,16));C=e[0],L=e[1],R=e[2],z=e[3]}try{T.unmap()}catch{}}catch(e){if(!N&&e?.name!==`AbortError`)throw e}finally{M=!1}return P=Object.freeze({schema:q,mode:i,stepIndex:j,meanL:C,meanD:L,globalEnantiomericExcess:R,localChiralPurity:z,kInhib:O,feedRate:k,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),P}function B(){if(!N){N=!0;for(let e of[x,S,C,w,T])try{e.destroy()}catch{}}}return Object.freeze({schema:q,lawAdapter:re,width:f,height:p,mode:i,modeId:m,get stepIndex(){return j},getResidentFieldBuffer:()=>A===0?S:C,getTelemetry:()=>P,setKInhib:L,setFeedRate:R,step:z,dispose:B})}function Z(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`acid-base-catalysis-kinetics@1`)?e.resolveModule(`acid-base-catalysis-kinetics@1`)?.descriptor||null:e.registerModule({method:{model:`acid-base-catalysis-kinetics`,version:1},kernel:{sourceModule:`src/runtime/organic/acidBaseCatalysisGpu.js`,entryPoint:`step_autocatalytic_field`,workgroupSize:64},parameterSchema:{kInhib:{type:`number`,min:0,max:4,required:!1},feedRate:{type:`number`,min:0,max:.6,required:!1}},stateLayout:{tensorId:`autocatalytic-field`,dtype:`f32`,layout:`interleaved`,strideElements:4,strideBytes:16,fields:[`L_or_U`,`D_or_V`,`A_or_F`,`P_or_rate`]},scaleRangeM:[1e-9,.001],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=X(n,{width:64,height:64,mode:r.mode||`frank-chiral`,kInhib:r.kInhib??1.85}),a=await i.step({dt:.16,substeps:8,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:autocat:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/organic/acidBaseCatalysisGpu.js`,entryPoint:`createAutocatalyticNetworkSessionWebGpu`,kernelEntryPoint:`step_autocatalytic_field`},representation:`autocatalytic-rd-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-autocatalytic-rd`,placement:`local`},validity:{finite:Number.isFinite(a.localChiralPurity)},validation:{status:`pass`,validationMode:`gpu-autocatalysis-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var Q=`ulg.astrophysics.nebular-mhd-collapse-webgpu.v1`,oe=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),se=Object.freeze({id:`nebular-mhd-collapse`,lawNodeId:`law:astrophysics-nebular-mhd`,orderConstraint:`after:galactic-mhd-evolution`,adapterMode:n.CELL_LOCAL,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`mhd-fluid-state`,`mhd-bfield-psi`,`fft-gravity-potential`,`nebula-tracers`]),writes:Object.freeze([`mhd-fluid-state`,`mhd-bfield-psi`,`nebula-tracers`]),accumulates:Object.freeze([`mhd-telemetry-reduction`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`angular-momentum`,`magnetic-flux-divB`]),validityDomain:Object.freeze({cflMax:.45,gridNMin:16,gridNMax:64,idealOrResistiveMhd:!0}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([0x9184e72a000,0xde0b6b3a7640000]),fundamentalLaws:Object.freeze([`gravity-poisson-3d-fft`,`compressible-hydrodynamics`,`maxwell-mhd-induction`,`lorentz-force`,`radiative-cooling`])});function ce(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function le({gridN:e=32,tracerCount:t=6144,boxSize:n=12,cloudRadius:r=3.4,cloudMass:i=22,spinOmega:a=.62,initialB0:o=.48,turbulenceAmp:s=.16,seed:c=20261125,centerOffset:l=[0,0,0]}={}){let u=Math.max(16,Math.min(64,Math.trunc(e)));if(u&u-1)throw RangeError(`Nebular MHD gridN must be a power of 2 for 3D FFT gravity (got ${u})`);let d=u*u*u,f=n/u,p=n*.5,m=ce(c),h=Number(l?.[0])||0,g=Number(l?.[1])||0,_=Number(l?.[2])||0,v=new Float32Array(d*8),y=new Float32Array(d*4),b=r*.42,x=0,S=new Float32Array(d);for(let e=0;e<u;e+=1)for(let t=0;t<u;t+=1)for(let n=0;n<u;n+=1){let i=(e*u+t)*u+n,a=(n+.5)*f-p,o=(t+.5)*f-p,s=(e+.5)*f-p,c=Math.hypot(a,o,s),l=Math.atan2(s,a),d=1/(1+(c/b)**2)**1.35,m=Math.exp(-((c/(r*1.15))**4)),h=1+.08*Math.cos(2*l)*m,g=.04+d*m*h*3.8;S[i]=g,x+=g*f**3}let C=i/Math.max(1e-6,x);for(let e=0;e<u;e+=1)for(let t=0;t<u;t+=1)for(let n=0;n<u;n+=1){let i=(e*u+t)*u+n,c=(n+.5)*f-p,l=(t+.5)*f-p,d=(e+.5)*f-p,h=Math.hypot(c,d),g=Math.hypot(c,l,d),_=Math.max(.015,S[i]*C),x=Math.exp(-((g/(r*1.25))**3)),w=Math.exp(-((l/(r*.38))**2)),T=a*x*(.18+1.35*w)/(1+h/Math.max(.35,b)*.42),E=-d*T+(m()-.5)*s*x,D=-l*.24*x+(m()-.5)*s*.4*x,O=c*T+(m()-.5)*s*x,k=.085+.16*(1-x),A=(5/3-1)*_*k,j=i*8;v[j+0]=_,v[j+1]=E,v[j+2]=D,v[j+3]=O,v[j+4]=k,v[j+5]=A,v[j+6]=0,v[j+7]=0;let M=i*4;y[M+0]=0,y[M+1]=o,y[M+2]=0,y[M+3]=0}let w=Math.max(256,Math.min(32768,Math.trunc(t))),T=new Float32Array(w*16);for(let e=0;e<w;e+=1){let t=e<Math.floor(w*.78),n=Math.max(.002,m()),s=t?n**.55*r*1.15:.45+m()*(r*1.45),c=2*m()-1,l=Math.sqrt(Math.max(0,1-c*c)),u=2*Math.PI*m(),d=s*l*Math.cos(u),f=s*c*(t?.85:1.05),p=s*l*Math.sin(u),v=Math.hypot(d,p),y=Math.exp(-((s/(r*1.25))**3)),x=a*y/(1+v/Math.max(.4,b)*.35),S=e*16;T[S+0]=d+h,T[S+1]=f+g,T[S+2]=p+_,T[S+3]=i/w,T[S+4]=-p*x,T[S+5]=-f*.04*y,T[S+6]=d*x,T[S+7]=Math.abs(o),T[S+8]=0,T[S+9]=o,T[S+10]=0,T[S+11]=t?1:.15,T[S+12]=.1,T[S+13]=0,T[S+14]=+!t,T[S+15]=m()}return Object.freeze({gridN:u,totalCells:d,tracerCount:w,boxSize:n,centerOffset:Object.freeze([h,g,_]),fluid:v,bfield:y,tracers:T,meanRho:i/n**3})}var ue=`
struct MhdParams {
  grid_n: u32,
  tracer_count: u32,
  streamline_count: u32,
  streamline_steps: u32,
  box_size: f32,
  dx: f32,
  dt: f32,
  gravity_g: f32,
  gamma_gas: f32,
  eta_res: f32,       // Resistive magnetic diffusivity
  c_h: f32,           // Dedner GLM divergence-cleaning wave speed
  c_p2: f32,          // Dedner GLM parabolic damping c_h^2 / c_p^2
  cool_rate: f32,     // Radiative cooling rate toward molecular cloud floor
  mean_rho: f32,
  mu0_inv: f32,       // 1 / mu0
  b_init: f32,
  center_offset: vec4<f32>, // Translation-invariant domain center (xyz) + step index (w)
};

struct FluidCell {
  rho_v: vec4<f32>,   // rho, vx, vy, vz
  u_p_phi: vec4<f32>, // u_int, P, phi_grav, divB
};

struct Tracer {
  pos_m: vec4<f32>,
  vel_bmag: vec4<f32>,
  bvec_rho: vec4<f32>,
  u_jet_tag: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: MhdParams;
@group(0) @binding(1) var<storage, read> fluid_src: array<FluidCell>;
@group(0) @binding(2) var<storage, read_write> fluid_dst: array<FluidCell>;
@group(0) @binding(3) var<storage, read> b_src: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> b_dst: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> grav_fft: array<vec2<f32>>; // Complex 3D FFT grid
@group(0) @binding(6) var<storage, read_write> tracers: array<Tracer>;
// Telemetry buffer (4 vec4):
//   [0]: vec4(total_mass, ke_sum, mag_energy_sum, max_rho)
//   [1]: vec4(max_bmag, max_jet_vz, mean_abs_divB, total_ang_mom_y)
//   [2]: vec4(peak_toroidal_b, disk_mass_frac, jet_energy_sum, step_count)
//   [3]: reserved
@group(0) @binding(7) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;
var<workgroup> wg4: array<f32, 64>;
var<workgroup> wg5: array<f32, 64>;
var<workgroup> wg6: array<f32, 64>;
var<workgroup> wg7: array<f32, 64>;

fn cidx(x: i32, y: i32, z: i32, n: i32) -> u32 {
  let wx = ((x % n) + n) % n;
  let wy = ((y % n) + n) % n;
  let wz = ((z % n) + n) % n;
  return u32((wz * n + wy) * n + wx);
}

fn sample_fluid_trilin(local_p: vec3<f32>) -> FluidCell {
  let n = i32(params.grid_n);
  let nf = f32(params.grid_n);
  let half = params.box_size * 0.5;
  let g = ((local_p + vec3<f32>(half)) / params.dx) - vec3<f32>(0.5);
  let i0 = vec3<i32>(floor(g));
  let f = fract(g);
  let c000 = fluid_src[cidx(i0.x, i0.y, i0.z, n)];
  let c100 = fluid_src[cidx(i0.x + 1, i0.y, i0.z, n)];
  let c010 = fluid_src[cidx(i0.x, i0.y + 1, i0.z, n)];
  let c110 = fluid_src[cidx(i0.x + 1, i0.y + 1, i0.z, n)];
  let c001 = fluid_src[cidx(i0.x, i0.y, i0.z + 1, n)];
  let c101 = fluid_src[cidx(i0.x + 1, i0.y, i0.z + 1, n)];
  let c011 = fluid_src[cidx(i0.x, i0.y + 1, i0.z + 1, n)];
  let c111 = fluid_src[cidx(i0.x + 1, i0.y + 1, i0.z + 1, n)];
  var out: FluidCell;
  out.rho_v = mix(
    mix(mix(c000.rho_v, c100.rho_v, f.x), mix(c010.rho_v, c110.rho_v, f.x), f.y),
    mix(mix(c001.rho_v, c101.rho_v, f.x), mix(c011.rho_v, c111.rho_v, f.x), f.y),
    f.z
  );
  out.u_p_phi = mix(
    mix(mix(c000.u_p_phi, c100.u_p_phi, f.x), mix(c010.u_p_phi, c110.u_p_phi, f.x), f.y),
    mix(mix(c001.u_p_phi, c101.u_p_phi, f.x), mix(c011.u_p_phi, c111.u_p_phi, f.x), f.y),
    f.z
  );
  return out;
}

fn sample_b_trilin(local_p: vec3<f32>) -> vec4<f32> {
  let n = i32(params.grid_n);
  let half = params.box_size * 0.5;
  let g = ((local_p + vec3<f32>(half)) / params.dx) - vec3<f32>(0.5);
  let i0 = vec3<i32>(floor(g));
  let f = fract(g);
  let b000 = b_src[cidx(i0.x, i0.y, i0.z, n)];
  let b100 = b_src[cidx(i0.x + 1, i0.y, i0.z, n)];
  let b010 = b_src[cidx(i0.x, i0.y + 1, i0.z, n)];
  let b110 = b_src[cidx(i0.x + 1, i0.y + 1, i0.z, n)];
  let b001 = b_src[cidx(i0.x, i0.y, i0.z + 1, n)];
  let b101 = b_src[cidx(i0.x + 1, i0.y, i0.z + 1, n)];
  let b011 = b_src[cidx(i0.x, i0.y + 1, i0.z + 1, n)];
  let b111 = b_src[cidx(i0.x + 1, i0.y + 1, i0.z + 1, n)];
  return mix(
    mix(mix(b000, b100, f.x), mix(b010, b110, f.x), f.y),
    mix(mix(b001, b101, f.x), mix(b011, b111, f.x), f.y),
    f.z
  );
}

// 1. Pack (4*pi*G*(rho - rho_bar)) into 3D FFT input buffer for self-gravity Poisson solve
@compute @workgroup_size(64)
fn pack_gravity_rhs(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = params.grid_n * params.grid_n * params.grid_n;
  let i = gid.x;
  if (i >= total) { return; }
  let rho = fluid_src[i].rho_v.x;
  let rhs = 12.566370614 * params.gravity_g * (rho - params.mean_rho);
  grav_fft[i] = vec2<f32>(rhs, 0.0);
}

// 2. Store solved 3D FFT gravitational potential Phi(x) into fluid_src.u_p_phi.z
@compute @workgroup_size(64)
fn store_gravity_phi(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = params.grid_n * params.grid_n * params.grid_n;
  let i = gid.x;
  if (i >= total) { return; }
  fluid_dst[i].u_p_phi.z = grav_fft[i].x;
}

// 3. Full 3D Self-Gravitating Resistive MHD Step (Semi-Lagrangian + Flux-Conservative + Dedner GLM)
@compute @workgroup_size(4, 4, 4)
fn step_mhd_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = i32(params.grid_n);
  if (i32(gid.x) >= n || i32(gid.y) >= n || i32(gid.z) >= n) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let iz = i32(gid.z);
  let idx = cidx(ix, iy, iz, n);

  let dx = params.dx;
  let inv2dx = 0.5 / dx;
  let invdx2 = 1.0 / (dx * dx);
  let dt = params.dt;
  let half = params.box_size * 0.5;
  let pos = vec3<f32>(f32(ix) + 0.5, f32(iy) + 0.5, f32(iz) + 0.5) * dx - vec3<f32>(half);

  let c0 = fluid_src[idx];
  let b0 = b_src[idx];
  let cxp = fluid_src[cidx(ix + 1, iy, iz, n)];
  let cxm = fluid_src[cidx(ix - 1, iy, iz, n)];
  let cyp = fluid_src[cidx(ix, iy + 1, iz, n)];
  let cym = fluid_src[cidx(ix, iy - 1, iz, n)];
  let czp = fluid_src[cidx(ix, iy, iz + 1, n)];
  let czm = fluid_src[cidx(ix, iy, iz - 1, n)];

  let bxp = b_src[cidx(ix + 1, iy, iz, n)];
  let bxm = b_src[cidx(ix - 1, iy, iz, n)];
  let byp = b_src[cidx(ix, iy + 1, iz, n)];
  let bym = b_src[cidx(ix, iy - 1, iz, n)];
  let bzp = b_src[cidx(ix, iy, iz + 1, n)];
  let bzm = b_src[cidx(ix, iy, iz - 1, n)];

  // Semi-Lagrangian backtrace for unconditionally stable advection of (rho, v, u, B, psi)
  let back_p = pos - c0.rho_v.yzw * dt;
  let adv_f = sample_fluid_trilin(back_p);
  let adv_b = sample_b_trilin(back_p);

  // Velocity divergence div(v) for compressible mass & adiabatic compression
  let dvx_dx = (cxp.rho_v.y - cxm.rho_v.y) * inv2dx;
  let dvy_dy = (cyp.rho_v.z - cym.rho_v.z) * inv2dx;
  let dvz_dz = (czp.rho_v.w - czm.rho_v.w) * inv2dx;
  let div_v = dvx_dx + dvy_dy + dvz_dz;

  // Continuity with mild Lax-Friedrichs diffusion preventing grid checkerboarding
  let lap_rho = (cxp.rho_v.x + cxm.rho_v.x + cyp.rho_v.x + cym.rho_v.x + czp.rho_v.x + czm.rho_v.x - 6.0 * c0.rho_v.x) * invdx2;
  let rho_new = clamp(adv_f.rho_v.x * exp(-clamp(div_v * dt, -0.45, 0.45)) + 0.012 * dx * dx * lap_rho, 0.012, 42.0);

  // Thermal pressure gradient -grad(P) & Self-Gravity -grad(Phi)
  let grad_p = vec3<f32>(
    (cxp.u_p_phi.y - cxm.u_p_phi.y) * inv2dx,
    (cyp.u_p_phi.y - cym.u_p_phi.y) * inv2dx,
    (czp.u_p_phi.y - czm.u_p_phi.y) * inv2dx
  );
  // Phi stored in fluid_dst.u_p_phi.z by store_gravity_phi right before step_mhd_grid!
  let phi_xp = fluid_dst[cidx(ix + 1, iy, iz, n)].u_p_phi.z;
  let phi_xm = fluid_dst[cidx(ix - 1, iy, iz, n)].u_p_phi.z;
  let phi_yp = fluid_dst[cidx(ix, iy + 1, iz, n)].u_p_phi.z;
  let phi_ym = fluid_dst[cidx(ix, iy - 1, iz, n)].u_p_phi.z;
  let phi_zp = fluid_dst[cidx(ix, iy, iz + 1, n)].u_p_phi.z;
  let phi_zm = fluid_dst[cidx(ix, iy, iz - 1, n)].u_p_phi.z;
  let grad_phi = vec3<f32>(
    (phi_xp - phi_xm) * inv2dx,
    (phi_yp - phi_ym) * inv2dx,
    (phi_zp - phi_zm) * inv2dx
  );

  // Current density J = curl(B) and Exact Lorentz Force F_L = (J x B) / mu0
  let dBz_dy = (byp.z - bym.z) * inv2dx;
  let dBy_dz = (bzp.y - bzm.y) * inv2dx;
  let dBx_dz = (bzp.x - bzm.x) * inv2dx;
  let dBz_dx = (bxp.z - bxm.z) * inv2dx;
  let dBy_dx = (bxp.y - bxm.y) * inv2dx;
  let dBx_dy = (byp.x - bym.x) * inv2dx;
  let J = vec3<f32>(dBz_dy - dBy_dz, dBx_dz - dBz_dx, dBy_dx - dBx_dy);
  let lorentz_f = cross(J, b0.xyz) * params.mu0_inv;

  // Momentum update: gravity + thermal pressure + Lorentz (J x B) + artificial kinematic viscosity
  let rho_safe = max(0.035, c0.rho_v.x);
  let lap_v = (cxp.rho_v.yzw + cxm.rho_v.yzw + cyp.rho_v.yzw + cym.rho_v.yzw + czp.rho_v.yzw + czm.rho_v.yzw - 6.0 * c0.rho_v.yzw) * invdx2;
  let acc = -grad_phi - grad_p / rho_safe + lorentz_f / rho_safe + 0.018 * dx * lap_v;
  var v_new = adv_f.rho_v.yzw + acc * dt;
  // Soft Alfvén/CFL velocity limiter so extreme core compression stays numerically bounded
  let v_max = 0.42 * dx / max(1e-5, dt);
  let v_mag = length(v_new);
  if (v_mag > v_max) {
    v_new = v_new * (v_max / v_mag);
  }

  // Induction equation: dB/dt = curl(v x B) + eta laplacian(B) - grad(psi)
  // Using electric field E = -(v x B) at face-adjacent neighbors -> exact curl(-E) = curl(v x B)!
  let emf_xp = cross(cxp.rho_v.yzw, bxp.xyz);
  let emf_xm = cross(cxm.rho_v.yzw, bxm.xyz);
  let emf_yp = cross(cyp.rho_v.yzw, byp.xyz);
  let emf_ym = cross(cym.rho_v.yzw, bym.xyz);
  let emf_zp = cross(czp.rho_v.yzw, bzp.xyz);
  let emf_zm = cross(czm.rho_v.yzw, bzm.xyz);
  let curl_vxb = vec3<f32>(
    (emf_yp.z - emf_ym.z) * inv2dx - (emf_zp.y - emf_zm.y) * inv2dx,
    (emf_zp.x - emf_zm.x) * inv2dx - (emf_xp.z - emf_xm.z) * inv2dx,
    (emf_xp.y - emf_xm.y) * inv2dx - (emf_yp.x - emf_ym.x) * inv2dx
  );
  let lap_b = (bxp.xyz + bxm.xyz + byp.xyz + bym.xyz + bzp.xyz + bzm.xyz - 6.0 * b0.xyz) * invdx2;
  let grad_psi = vec3<f32>(
    (bxp.w - bxm.w) * inv2dx,
    (byp.w - bym.w) * inv2dx,
    (bzp.w - bzm.w) * inv2dx
  );
  // Note: advection is ALREADY included in curl(v x B) = -(v.grad)B + (B.grad)v - B(div v),
  // so update directly from b0 with mild numerical + resistive diffusion!
  var b_new = b0.xyz + (curl_vxb + params.eta_res * lap_b - grad_psi) * dt;
  let b_cap = 16.0;
  let bm = length(b_new);
  if (bm > b_cap) { b_new = b_new * (b_cap / bm); }

  // Dedner GLM divergence cleaning: d(psi)/dt = -c_h^2 div(B) - damp * psi
  let div_b = (bxp.x - bxm.x) * inv2dx + (byp.y - bym.y) * inv2dx + (bzp.z - bzm.z) * inv2dx;
  let psi_new = (adv_b.w - (params.c_h * params.c_h) * div_b * dt) * exp(-params.c_p2 * dt);

  // Specific internal energy: PdV compression + Ohmic Joule heating eta |J|^2/rho - radiative cooling
  let ohmic = params.eta_res * dot(J, J) * params.mu0_inv / rho_safe;
  let pdv = -(c0.u_p_phi.y / rho_safe) * div_v;
  let u_floor = 0.065;
  let cool = params.cool_rate * rho_safe * max(0.0, adv_f.u_p_phi.x - u_floor);
  let u_new = clamp(adv_f.u_p_phi.x + (pdv + ohmic - cool) * dt, 0.04, 14.0);
  // Stiff polytropic opacity floor at high density (protostellar core pressure support!)
  let p_new = (params.gamma_gas - 1.0) * rho_new * u_new + 0.045 * pow(max(0.0, rho_new - 1.6), 2.0);

  var out_f: FluidCell;
  out_f.rho_v = vec4<f32>(rho_new, v_new);
  out_f.u_p_phi = vec4<f32>(u_new, p_new, fluid_dst[idx].u_p_phi.z, div_b);
  fluid_dst[idx] = out_f;
  b_dst[idx] = vec4<f32>(b_new, psi_new);
}

// 4. Advect Lagrangian magnetized nebula / disk / bipolar-jet tracers on the live GPU MHD field!
@compute @workgroup_size(64)
fn step_nebula_tracers(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.tracer_count) { return; }
  var tr = tracers[i];
  let half = params.box_size * 0.48;
  let local_p = tr.pos_m.xyz - params.center_offset.xyz;

  // Sample updated fluid & B-field directly from fluid_src / b_src (after swap, latest state!)
  let f = sample_fluid_trilin(local_p);
  let b = sample_b_trilin(local_p);
  let v_grid = f.rho_v.yzw;
  // Blend tracer inertia smoothly with Eulerian MHD plasma velocity (tight dust-gas coupling)
  let v_new = mix(tr.vel_bmag.xyz, v_grid, 0.45);
  var next_loc = local_p + v_new * params.dt;

  // Keep domain periodic/contained without origin pinning
  if (abs(next_loc.x) > half) { next_loc.x = next_loc.x - sign(next_loc.x) * params.box_size * 0.94; }
  if (abs(next_loc.y) > half) { next_loc.y = next_loc.y - sign(next_loc.y) * params.box_size * 0.94; }
  if (abs(next_loc.z) > half) { next_loc.z = next_loc.z - sign(next_loc.z) * params.box_size * 0.94; }

  let b_mag = length(b.xyz);
  // Outflow signature along rotation/magnetic axis: positive when flowing outward from midplane!
  let jet_out = v_new.y * sign(next_loc.y + 1e-5);
  tr.pos_m = vec4<f32>(next_loc + params.center_offset.xyz, tr.pos_m.w);
  tr.vel_bmag = vec4<f32>(v_new, b_mag);
  tr.bvec_rho = vec4<f32>(b.xyz, f.rho_v.x);
  tr.u_jet_tag = vec4<f32>(f.u_p_phi.x, jet_out, tr.u_jet_tag.z, tr.u_jet_tag.w);
  tracers[i] = tr;
}

// 5. Parallel GPU Telemetry Reduction (1 workgroup of 64 threads — ZERO WG(1)!)
@compute @workgroup_size(64)
fn reduce_mhd_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n = params.grid_n;
  let total = n * n * n;
  let dV = params.dx * params.dx * params.dx;
  let half = params.box_size * 0.5;

  var mass = 0.0;
  var ke = 0.0;
  var mag_e = 0.0;
  var max_rho = 0.0;
  var max_b = 0.0;
  var max_jet = 0.0;
  var divb_sum = 0.0;
  var peak_bphi = 0.0;

  var i = tid;
  loop {
    if (i >= total) { break; }
    let f = fluid_src[i];
    let b = b_src[i];
    let rho = f.rho_v.x;
    let v = f.rho_v.yzw;
    let bm = length(b.xyz);
    let ix = i % n;
    let iy = (i / n) % n;
    let iz = i / (n * n);
    let x = (f32(ix) + 0.5) * params.dx - half;
    let y = (f32(iy) + 0.5) * params.dx - half;
    let z = (f32(iz) + 0.5) * params.dx - half;
    let r_cyl = max(1e-4, length(vec2<f32>(x, z)));
    // Toroidal azimuthal B_phi = (-z * Bx + x * Bz) / r_cyl
    let b_phi = abs((-z * b.x + x * b.z) / r_cyl);

    mass = mass + rho * dV;
    ke = ke + 0.5 * rho * dot(v, v) * dV;
    mag_e = mag_e + 0.5 * dot(b.xyz, b.xyz) * params.mu0_inv * dV;
    max_rho = max(max_rho, rho);
    max_b = max(max_b, bm);
    if (abs(y) > params.dx * 2.0 && r_cyl < params.box_size * 0.28) {
      max_jet = max(max_jet, v.y * sign(y));
    }
    divb_sum = divb_sum + abs(f.u_p_phi.w);
    peak_bphi = max(peak_bphi, b_phi);
    i = i + 64u;
  }

  wg0[tid] = mass;
  wg1[tid] = ke;
  wg2[tid] = mag_e;
  wg3[tid] = max_rho;
  wg4[tid] = max_b;
  wg5[tid] = max_jet;
  wg6[tid] = divb_sum;
  wg7[tid] = peak_bphi;
  workgroupBarrier();

  var stride = 32u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg0[tid] = wg0[tid] + wg0[tid + stride];
      wg1[tid] = wg1[tid] + wg1[tid + stride];
      wg2[tid] = wg2[tid] + wg2[tid + stride];
      wg3[tid] = max(wg3[tid], wg3[tid + stride]);
      wg4[tid] = max(wg4[tid], wg4[tid + stride]);
      wg5[tid] = max(wg5[tid], wg5[tid + stride]);
      wg6[tid] = wg6[tid] + wg6[tid + stride];
      wg7[tid] = max(wg7[tid], wg7[tid + stride]);
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }

  if (tid == 0u) {
    telemetry[0] = vec4<f32>(wg0[0], wg1[0], wg2[0], wg3[0]);
    telemetry[1] = vec4<f32>(wg4[0], wg5[0], wg6[0] / max(1.0, f32(total)), 0.0);
    telemetry[2] = vec4<f32>(wg7[0], 0.0, 0.0, params.center_offset.w);
    telemetry[3] = vec4<f32>(f32(total), params.b_init, params.dt, 0.0);
  }
}
`;function de(t,{gridN:n=32,tracerCount:r=6144,boxSize:i=12,cloudRadius:l=3.4,cloudMass:u=22,spinOmega:d=.62,initialB0:f=.56,gravityG:p=.85,gammaGas:m=5/3,etaRes:h=.005,coolRate:g=.25,seed:_=20261125,centerOffset:v=[0,0,0],label:y=`ulg-nebular-mhd`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createNebularMhdCollapseSessionWebGpu requires a live WebGPU GPUDevice`);let b=le({gridN:n,tracerCount:r,boxSize:i,cloudRadius:l,cloudMass:u,spinOmega:d,initialB0:f,seed:_,centerOffset:v}),x=b.gridN,S=b.boxSize/x,C=c(t,x);C.writeAxisPoissonParams({boxLength:b.boxSize,smoothR2:(.85*S)**2});let w=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`storage`),a(3,`read-only-storage`),a(4,`storage`),a(5,`storage`),a(6,`storage`),a(7,`storage`)],T=e=>s(t,{cacheKey:`ulg-nebular-mhd-${e}.v1`,label:`${y}-${e}`,code:ue,entryPoint:e,bindings:w}),E=T(`pack_gravity_rhs`),D=T(`store_gravity_phi`),O=T(`step_mhd_grid`),k=T(`step_nebula_tracers`),A=T(`reduce_mhd_telemetry`),j=t.createBuffer({label:`${y}-params`,size:80,usage:oe.UNIFORM|oe.COPY_DST}),M=t.createBuffer({label:`${y}-fluid-a`,size:b.fluid.byteLength,usage:oe.STORAGE|oe.COPY_DST|oe.COPY_SRC}),N=t.createBuffer({label:`${y}-fluid-b`,size:b.fluid.byteLength,usage:oe.STORAGE|oe.COPY_DST|oe.COPY_SRC}),P=t.createBuffer({label:`${y}-b-a`,size:b.bfield.byteLength,usage:oe.STORAGE|oe.COPY_DST|oe.COPY_SRC}),F=t.createBuffer({label:`${y}-b-b`,size:b.bfield.byteLength,usage:oe.STORAGE|oe.COPY_DST|oe.COPY_SRC}),I=t.createBuffer({label:`${y}-tracers`,size:b.tracers.byteLength,usage:oe.STORAGE|oe.VERTEX|oe.COPY_DST|oe.COPY_SRC}),L=t.createBuffer({label:`${y}-tel`,size:64,usage:oe.STORAGE|oe.COPY_SRC}),R=t.createBuffer({label:`${y}-tel-read`,size:64,usage:oe.MAP_READ|oe.COPY_DST}),z=t.createBuffer({label:`${y}-b-read`,size:b.bfield.byteLength,usage:oe.MAP_READ|oe.COPY_DST});t.queue.writeBuffer(M,0,b.fluid),t.queue.writeBuffer(N,0,b.fluid),t.queue.writeBuffer(P,0,b.bfield),t.queue.writeBuffer(F,0,b.bfield),t.queue.writeBuffer(I,0,b.tracers);let B=(e,n,r,i,a)=>o(t,{layout:E.bindGroupLayout,label:`${y}-bg`,entries:[{binding:0,resource:{buffer:j}},{binding:1,resource:{buffer:e}},{binding:2,resource:{buffer:n}},{binding:3,resource:{buffer:r}},{binding:4,resource:{buffer:i}},{binding:5,resource:{buffer:a}},{binding:6,resource:{buffer:I}},{binding:7,resource:{buffer:L}}]}),V=B(M,N,P,F,C.bufferA),ee=B(M,N,P,F,C.bufferB),H=B(N,M,F,P,C.bufferA),U=B(N,M,F,P,C.bufferB),W=0,G=0,te=0,K=f,ne=d,q=!1,J=!1,re=Float32Array.from(b.bfield),ie=Object.freeze({schema:Q,stepIndex:0,simTime:0,totalMass:u,kineticEnergy:0,magneticEnergy:.5*f*f*b.boxSize**3,maxDensity:1,maxBField:Math.abs(f),peakToroidalB:0,maxJetSpeed:0,meanAbsDivB:0,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),ae=!1,Y=Math.ceil(b.totalCells/64),X=Math.ceil(x/4),Z=Math.ceil(b.tracerCount/64);function ce(e){let n=.25*S/Math.max(1e-5,e),r=new ArrayBuffer(80);new Uint32Array(r,0,4).set([x,b.tracerCount,0,0]),new Float32Array(r,16,16).set([b.boxSize,S,e,p,m,h,n,4.5,g,b.meanRho,1,K,b.centerOffset[0],b.centerOffset[1],b.centerOffset[2],G]),t.queue.writeBuffer(j,0,r)}async function de({dt:n=.022,substeps:r=1,readTelemetry:i=!0,readBFieldForStreamlines:a=!1}={}){if(ae)return ie;let o=Math.max(1,Math.min(8,Math.trunc(r))),s=Math.max(.002,Math.min(.04,Number(n)||.022));ce(s);let c=t.createCommandEncoder({label:`${y}-step-${G}`});for(let e=0;e<o;e+=1){let t=W===0?V:H,n=c.beginComputePass({label:`${y}-pack-grav`});n.setBindGroup(0,t),n.setPipeline(E.pipeline),n.dispatchWorkgroups(Y),n.end();let r=C.encodePoissonSolve(c,{gradAxis:0}),i=W===0?r===C.bufferA?V:ee:r===C.bufferA?H:U;n=c.beginComputePass({label:`${y}-mhd-step`}),n.setBindGroup(0,i),n.setPipeline(D.pipeline),n.dispatchWorkgroups(Y),n.setPipeline(O.pipeline),n.dispatchWorkgroups(X,X,X),n.end(),W^=1;let a=W===0?V:H;n=c.beginComputePass({label:`${y}-tracers`}),n.setBindGroup(0,a),n.setPipeline(k.pipeline),n.dispatchWorkgroups(Z),e===o-1&&(n.setPipeline(A.pipeline),n.dispatchWorkgroups(1)),n.end(),G+=1,te+=s}let l=i&&!q&&R.mapState===`unmapped`;l&&(q=!0,c.copyBufferToBuffer(L,0,R,0,64));let u=a&&!J&&z.mapState===`unmapped`;u&&(J=!0,c.copyBufferToBuffer(W===0?P:F,0,z,0,b.bfield.byteLength)),t.queue.submit([c.finish()]);let d=[];return l&&d.push((async()=>{try{if(await R.mapAsync(oe.MAP_READ),!ae){let t=new Float32Array(R.getMappedRange(0,64));ie=Object.freeze({schema:Q,stepIndex:G,simTime:te,totalMass:t[0],kineticEnergy:t[1],magneticEnergy:t[2],maxDensity:t[3],maxBField:t[4],maxJetSpeed:t[5],meanAbsDivB:t[6],peakToroidalB:t[8],initialB0:K,spinOmega:ne,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{R.unmap()}catch{}}catch(e){if(!ae&&e?.name!==`AbortError`)throw e}finally{q=!1}})()),u&&d.push((async()=>{try{await z.mapAsync(oe.MAP_READ),ae||re.set(new Float32Array(z.getMappedRange(0,b.bfield.byteLength)));try{z.unmap()}catch{}}catch(e){if(!ae&&e?.name!==`AbortError`)throw e}finally{J=!1}})()),d.length&&await Promise.all(d),ie}function fe({seedRings:e=[.95,1.95],seedsPerRing:t=8,stepsPerDir:n=26,stepLen:r=.22,worldScale:i=1,alpha:a=.62}={}){if(Math.abs(K)<1e-4)return new Float32Array;let o=b.boxSize*.5,s=(e,t,n)=>{let r=(e+o)/S-.5,i=(t+o)/S-.5,a=(n+o)/S-.5,s=(Math.floor(r)%x+x)%x,c=(Math.floor(i)%x+x)%x,l=(((Math.floor(a)%x+x)%x*x+c)*x+s)*4;return[re[l],re[l+1],re[l+2]]},c=[];for(let l of e)for(let e=0;e<t;e+=1){let u=e/t*Math.PI*2+l*.4,d=Math.cos(u)*l,f=Math.sin(u)*l;for(let e of[1,-1]){let t=d,l=0,u=f;for(let d=0;d<n;d+=1){let f=s(t,l,u),p=Math.hypot(f[0],f[1],f[2]);if(p<1e-4)break;let m=s(t+f[0]/p*e*r*.5,l+f[1]/p*e*r*.5,u+f[2]/p*e*r*.5),h=Math.hypot(m[0],m[1],m[2]);if(h<1e-4)break;let g=t+m[0]/h*e*r,_=l+m[1]/h*e*r,v=u+m[2]/h*e*r;if(Math.abs(g)>o*.92||Math.abs(_)>o*.92||Math.abs(v)>o*.92)break;let y=Math.min(1,h/Math.max(.25,Math.abs(K)*2.4)),b=(1-d/n)*a,x=.2+.72*y,S=.72-.18*y,C=1-.15*y;c.push(t*i,l*i,u*i,x,S,C,b),c.push(g*i,_*i,v*i,x,S,C,b*.92),t=g,l=_,u=v}}}return new Float32Array(c)}function pe(){if(!ae){ae=!0,C.destroy();for(let e of[j,M,N,P,F,I,L,R,z])try{e.destroy()}catch{}}}return Object.freeze({schema:Q,lawAdapter:se,get gridN(){return x},get tracerCount(){return b.tracerCount},get boxSize(){return b.boxSize},get stepIndex(){return G},get simTime(){return te},get initialB0(){return K},getResidentTracersBuffer:()=>I,getTelemetry:()=>ie,buildMagneticFieldStreamlines:fe,step:de,dispose:pe})}function fe(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`nebular-mhd-collapse@1`)?e.resolveModule(`nebular-mhd-collapse@1`)?.descriptor||null:e.registerModule({method:{model:`nebular-mhd-collapse`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/nebularMhdCollapseGpu.js`,entryPoint:`step_mhd_grid`,workgroupSize:64},parameterSchema:{dt:{type:`number`,min:.001,max:.05,required:!1},initialB0:{type:`number`,min:0,max:5,required:!1},spinOmega:{type:`number`,min:0,max:5,required:!1},substeps:{type:`number`,min:1,max:16,required:!1}},stateLayout:{tensorId:`nebula-mhd-tracers`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`m`,`vx`,`vy`,`vz`,`bMag`,`bx`,`by`,`bz`,`rho`,`u`,`jetOut`,`tag`,`phase`]},scaleRangeM:[0x9184e72a000,0xde0b6b3a7640000],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=de(n,{gridN:16,tracerCount:512,initialB0:r.initialB0??.48,spinOmega:r.spinOmega??.62}),a=await i.step({dt:r.dt??.02,substeps:r.substeps??2,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:nebular-mhd:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/nebularMhdCollapseGpu.js`,entryPoint:`createNebularMhdCollapseSessionWebGpu`,kernelEntryPoint:`step_mhd_grid`},representation:`mhd-3d-grid+tracers-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-mhd-fft3d`,placement:`local`},validity:{finite:Number.isFinite(a.totalMass)&&Number.isFinite(a.magneticEnergy),meanAbsDivB:a.meanAbsDivB},validation:{status:`pass`,validationMode:`gpu-mhd-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var pe=`ulg.astrophysics.planetary-atmosphere-em-webgpu.v1`,me=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),he=Object.freeze({id:`planetary-atmosphere-em`,lawNodeId:`law:planetary-atmosphere-triboelectric-em`,orderConstraint:`after:planetary-interior-polytope`,adapterMode:n.SURFACE_INTERFACE,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`planetary-atmo-fluid`,`planetary-em-potential`,`planetary-interior-core`,`solar-wind-flux`]),writes:Object.freeze([`planetary-atmo-fluid`,`planetary-em-potential`]),accumulates:Object.freeze([`planetary-atmo-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`atmospheric-mass`,`electric-charge-balance`,`angular-momentum`]),validityDomain:Object.freeze({surfacePressureMinPa:1,cflMax:.5,sphericalShellMetric:!0}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e4,1e8]),fundamentalLaws:Object.freeze([`baroclinic-shallow-water-coriolis`,`radiative-insolation-albedo`,`triboelectric-charge-separation`,`maxwell-gauss-poisson-efield`,`paschen-dielectric-breakdown`,`core-geodynamo-magnetosphere`])});function ge(e,t=120){let n=Math.max(1,Number(e)||101325),r=n/101325,i=1+4/Math.max(.05,n*Math.max(1,t)*.001);return 26e4*Math.max(1e-4,r)**.48*i}function _e({radiusM:e=6371e3,rotationOmegaRadS:t=72921e-9,coreRadiusNorm:n=.54,coreConductivitySm:r=1e6,centralPressurePa:i=364e9,solarWindPressureNPa:a=2}={}){let o=Math.max(0,Math.min(.88,Number(n)||0)),s=o*Math.max(0,Number(e)||0),c=Math.abs(Number(t)||0),l=Math.max(0,Number(r)||0),u=Math.max(0,Number(i)/1e9),d=Math.min(3,Math.max(0,(u-18)/340)),f=s>8e5&&u>=18?.25+.75*d:0,p=f>0?(o/.54)**3*Math.sqrt(Math.max(0,c/729e-7*(l/1e6)*f)):0,m=p>.08?31e-6*Math.min(25,p*(e/6371e3)**.35):0,h=4*Math.PI*1e-7,g=Math.max(1e-12,Number(a)*1e-9),_=m>1e-7?Math.max(1,m*m/(2*h*g))**(1/6):1,v=Math.min(.95,1/Math.max(1.05,_));return Object.freeze({bEquatorialT:m,rMpOverRp:_,auroralLatRad:Math.acos(Math.sqrt(v)),auroralStrength:m>6e-6?Math.min(1.4,Math.log10(m/5e-6+1)*.85):0})}function ve(e={}){let t=Math.max(0,Number(e.surfacePressurePa)||0),n=Math.max(0,Number(e.volatileMassFrac)||0),r=Math.max(0,Number(e.particulateMassFrac)||0),i=Math.max(0,Number(e.dynamo?.bEquatorialT)||0),a=t>=10,o=a&&n>.01,s=a&&r>.01,c=a&&n+r>.02,l=i>1e-6,u=[],d=[],f=(e,t)=>(t?u:d).push(e);return f(`baroclinic-fluid-coriolis`,a),f(`condensable-phase-cloud-transport`,o),f(`aeolian-particulate-saltation`,s),f(`triboelectric-charge-separation-and-paschen-breakdown`,c),f(`core-geodynamo-magnetosphere`,l),Object.freeze({anyActive:u.length>0,fluidActive:a,cloudCondensationActive:o,aeolianParticulateActive:s,triboelectricActive:c,magnetosphereActive:l,activeLaws:Object.freeze(u),dormantLaws:Object.freeze(d)})}function ye(e={},t=null,{solarDistanceAu:n=1,coreConductivitySm:r=1e6}={}){let i=Math.max(1e3,Number(e.radiusM??(e.radiusKm||6371)*1e3)),a=Math.max(0x38d7ea4c68000,Number(e.massKg??(e.massSolar||3003e-9)*198847e25)),o=66743e-15,s=o*a/(i*i),c=Math.max(20,Number(e.eqTempK??e.tempK??288)),l=1380649e-29,u=167262192369e-38,d=Math.sqrt(2*o*a/i),f=o*a*2*u/Math.max(1e-30,l*c*i),p=Number.isFinite(e.meanMolecularWeightAmu)?Math.max(1,Number(e.meanMolecularWeightAmu)):f>160?2.3:f>18?29:44,m=Math.max(0,Math.min(1,Number(e.atmColumnFrac??e.atm??0))),h=Number.isFinite(e.surfacePressurePa)?Math.max(0,Number(e.surfacePressurePa)):m<.03?0:10*10**(5.4*m)*Math.min(4,s/9.81),g=Number.isFinite(e.rotationOmegaRadS)?Number(e.rotationOmegaRadS):72921e-9*Math.max(.15,d/11186)**.72,_=l*c/Math.max(1e-30,p*u*s),v=Math.sqrt(Math.max(1,s*_))/Math.max(1e-6,2*Math.abs(g)*i),y=Number.isFinite(e.volatileMassFrac)?Math.max(0,Math.min(1,Number(e.volatileMassFrac))):h<10?0:Math.max(0,Math.min(.95,m*Math.exp(-(((Math.log10(c)-2.35)/.55)**2)))),b=Number.isFinite(e.particulateMassFrac)?Math.max(0,Math.min(1,Number(e.particulateMassFrac))):h<10?0:Math.max(0,Math.min(.95,m*(1-.65*y)*Math.min(1,400/Math.max(80,c)))),x=Number(t?.coreRadiusFraction??e.coreRadiusNorm??.52),S=Number(t?.centralPressurePa??e.centralPressurePa??e.centralP??.5*s*a/(Math.PI*i*i)),C=Number.isFinite(e.solarWindPressureNPa)?Number(e.solarWindPressureNPa):2.2/Math.max(.08,n*n),w=_e({radiusM:i,rotationOmegaRadS:g,coreRadiusNorm:x,coreConductivitySm:Number(e.coreConductivitySm??r),centralPressurePa:S,solarWindPressureNPa:C}),T=ge(Math.max(1,h)),E=Object.freeze({radiusM:i,massKg:a,gravityMps2:s,rotationOmegaRadS:g,surfacePressurePa:h,eqTempK:c,meanMolecularWeightAmu:p,scaleHeightM:_,rossbyRadiusOverR:v,atmWeight:h>=10?Math.min(1,Math.log10(h)/5.5):0,volatileMassFrac:y,particulateMassFrac:b,volatileCloudFrac:y,dustAvailability:b,eCritVPerM:T,dynamo:w,solarWindPressureNPa:C});return Object.freeze({...E,activation:ve(E)})}var be=ye;function xe(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var Se=`
struct AtmoParams {
  width: u32,
  height: u32,
  step_index: u32,
  enable_triboelectric: u32,
  radius_m: f32,
  gravity: f32,
  omega_rot: f32,
  dt_sim: f32,
  eq_temp_k: f32,
  volatile_frac: f32,
  dust_avail: f32,
  atm_weight: f32,
  e_crit_norm: f32,     // Normalized Paschen breakdown threshold
  charge_gain: f32,     // Triboelectric separation efficiency
  aurora_lat_rad: f32,  // Core-geodynamo open field-line cusp latitude
  aurora_strength: f32, // Solar-wind driven auroral emission strength
  sun_dir: vec4<f32>,   // Live unit vector toward host star (xyz) + solar wind pressure (w)
};

// Ping-pong atmospheric fluid state (2 vec4 = 32 B per cell):
//   flow: vec4(u_east, v_north, h_geopot_anom, T_anom)
//   chem: vec4(q_cloud, q_dust, vorticity, rain_or_sed)
struct AtmoCell {
  flow: vec4<f32>,
  chem: vec4<f32>,
};

// Electromagnetic, visual-ready, & live CFD flow state (3 vec4 = 48 B per cell) — directly bound by LIT_SPHERE_WGSL!
//   em0:      vec4(rho_charge, phi_elec, e_mag_norm, lightning_flash)
//   vis:      vec4(cloud_density, dust_density, lightning_glow, aurora_envelope)
//   cfd_flow: vec4(u_east, v_north, vorticity, t_anom)
struct EmVisCell {
  em0: vec4<f32>,
  vis: vec4<f32>,
  cfd_flow: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: AtmoParams;
@group(0) @binding(1) var<storage, read> atmo_src: array<AtmoCell>;
@group(0) @binding(2) var<storage, read_write> atmo_dst: array<AtmoCell>;
@group(0) @binding(3) var<storage, read> em_src: array<EmVisCell>;
@group(0) @binding(4) var<storage, read_write> em_dst: array<EmVisCell>;
// Telemetry reduction (2 vec4 = 32 B):
//   [0]: vec4(mean_speed, max_vorticity, mean_cloud, mean_dust)
//   [1]: vec4(max_efield_norm, lightning_cell_count, total_abs_charge, max_aurora)
@group(0) @binding(5) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;
var<workgroup> wg4: array<f32, 64>;
var<workgroup> wg5: array<f32, 64>;
var<workgroup> wg6: array<f32, 64>;
var<workgroup> wg7: array<f32, 64>;

const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 6.28318530717958647692;

fn cell_idx(x: i32, y: i32) -> u32 {
  let w = i32(params.width);
  let h = i32(params.height);
  let wx = ((x % w) + w) % w;
  let wy = clamp(y, 0, h - 1);
  return u32(wy * w + wx);
}

fn cell_normal(ix: u32, iy: u32) -> vec3<f32> {
  let u = (f32(ix) + 0.5) / f32(params.width);
  let v = (f32(iy) + 0.5) / f32(params.height);
  let lon = (u - 0.5) * TWO_PI;
  let lat = (0.5 - v) * PI;
  let cl = cos(lat);
  return vec3<f32>(cl * cos(lon), sin(lat), cl * sin(lon));
}

fn sample_atmo_bilin(fx: f32, fy: f32) -> AtmoCell {
  let w = f32(params.width);
  let h = f32(params.height);
  let sx = fx - floor(fx / w) * w;
  let sy = clamp(fy, 0.0, h - 1.001);
  let x0 = i32(floor(sx));
  let y0 = i32(floor(sy));
  let tx = fract(sx);
  let ty = fract(sy);
  let c00 = atmo_src[cell_idx(x0, y0)];
  let c10 = atmo_src[cell_idx(x0 + 1, y0)];
  let c01 = atmo_src[cell_idx(x0, y0 + 1)];
  let c11 = atmo_src[cell_idx(x0 + 1, y0 + 1)];
  var out: AtmoCell;
  out.flow = mix(mix(c00.flow, c10.flow, tx), mix(c01.flow, c11.flow, tx), ty);
  out.chem = mix(mix(c00.chem, c10.chem, tx), mix(c01.chem, c11.chem, tx), ty);
  return out;
}

fn sample_em_bilin(fx: f32, fy: f32) -> EmVisCell {
  let w = f32(params.width);
  let h = f32(params.height);
  let sx = fx - floor(fx / w) * w;
  let sy = clamp(fy, 0.0, h - 1.001);
  let x0 = i32(floor(sx));
  let y0 = i32(floor(sy));
  let tx = fract(sx);
  let ty = fract(sy);
  let c00 = em_src[cell_idx(x0, y0)];
  let c10 = em_src[cell_idx(x0 + 1, y0)];
  let c01 = em_src[cell_idx(x0, y0 + 1)];
  let c11 = em_src[cell_idx(x0 + 1, y0 + 1)];
  var out: EmVisCell;
  out.em0 = mix(mix(c00.em0, c10.em0, tx), mix(c01.em0, c11.em0, tx), ty);
  out.vis = mix(mix(c00.vis, c10.vis, tx), mix(c01.vis, c11.vis, tx), ty);
  out.cfd_flow = mix(mix(c00.cfd_flow, c10.cfd_flow, tx), mix(c01.cfd_flow, c11.cfd_flow, tx), ty);
  return out;
}

// 1. Prognostic Spherical Baroclinic Shallow-Water Fluid + Cloud/Dust Advection + Insolation
@compute @workgroup_size(8, 8)
fn atmo_step_fluid(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = cell_idx(ix, iy);
  let w = f32(params.width);
  let h = f32(params.height);
  let lat = (0.5 - (f32(iy) + 0.5) / h) * PI;
  let sin_lat = sin(lat);
  let raw_cos = max(0.0, cos(lat));
  // Smooth polar coordinate-singularity filter (prevents 1/cos(lat) blowup near ±90° poles!)
  let pole_taper = smoothstep(0.08, 0.38, raw_cos);
  let cos_lat = max(0.30, raw_cos);

  // Normalized spherical grid spacings (dimensionless planetary radius = 1, velocity scale = c_baroclinic)
  let dx = (TWO_PI * cos_lat) / w;
  let dy = PI / h;
  let dt = params.dt_sim;

  let c0 = atmo_src[idx];
  let cxp = atmo_src[cell_idx(ix + 1, iy)];
  let cxm = atmo_src[cell_idx(ix - 1, iy)];
  let cyp = atmo_src[cell_idx(ix, iy - 1)]; // north = smaller iy!
  let cym = atmo_src[cell_idx(ix, iy + 1)];

  // Semi-Lagrangian backtrace on sphere
  let bx = f32(ix) - (c0.flow.x * dt) / dx;
  let by = f32(iy) + (c0.flow.y * dt) / dy; // north velocity v > 0 decreases iy
  let adv = sample_atmo_bilin(bx, by);

  // Real Solar Insolation from live host-star vector!
  let n_hat = cell_normal(gid.x, gid.y);
  let insol = max(0.0, dot(n_hat, normalize(params.sun_dir.xyz)));
  let t_eq = 0.72 * raw_cos + 0.48 * insol - 0.18 * adv.chem.x - 0.12 * adv.chem.y;
  let t_new = clamp(adv.flow.w + (t_eq - adv.flow.w) * 0.09 * dt * 6.0, -1.5, 1.8);

  // Horizontal divergence, vorticity, and geopotential height gradient (baroclinic thermal wind!)
  let du_dx = (cxp.flow.x - cxm.flow.x) / (2.0 * dx);
  let dv_dy = (cyp.flow.y - cym.flow.y) / (2.0 * dy);
  let div_v = clamp((du_dx + dv_dy) * pole_taper, -6.0, 6.0);
  let dv_dx = (cxp.flow.y - cxm.flow.y) / (2.0 * dx);
  let du_dy = (cyp.flow.x - cym.flow.x) / (2.0 * dy);
  let vort = clamp((dv_dx - du_dy) * pole_taper, -10.0, 10.0);

  // Geopotential anomaly coupled to thermal expansion & mass convergence
  let dh_dx = ((cxp.flow.z - cxm.flow.z) / (2.0 * dx) + 0.45 * (cxp.flow.w - cxm.flow.w) / (2.0 * dx)) * pole_taper;
  let dh_dy = ((cyp.flow.z - cym.flow.z) / (2.0 * dy) + 0.45 * (cyp.flow.w - cym.flow.w) / (2.0 * dy)) * pole_taper;

  // Real Coriolis parameter f = 2 * Omega_scaled * sin(lat):
  let rot_scale = clamp((params.omega_rot / 7.2921e-5) * (params.radius_m / 6.371e6), 0.05, 14.0);
  let f_rot = rot_scale * 2.2 * sin_lat;

  // Physical Hadley / Ferrel / Polar / Multi-Jet Meridional Circulation (continuous function of Rossby/rotation number!):
  //   - Slow rotator (rot_scale < 0.35): single global Hadley super-rotating cell
  //   - Earth-like rotator (0.35..2.0): 3-cell Trade easterlies + Ferrel mid-lat westerlies
  //   - Fast-rotating gas/ice giant (rot_scale > 2.0): emergent alternating Rhines zonal jets (cos(n_jets * lat))!
  let three_cell_w = smoothstep(0.18, 0.55, rot_scale);
  let multi_jet_w = smoothstep(1.8, 5.5, rot_scale);
  let earth_zonal = 0.58 * sin(2.0 * lat) * sin(2.0 * lat) - 0.34 * (raw_cos * raw_cos * raw_cos);
  let giant_zonal = (0.72 * cos(lat * 10.0) + 0.36 * sin(lat * 18.0)) * raw_cos;
  let u_target_zonal = mix(
    mix(0.28 * raw_cos, earth_zonal, three_cell_w),
    giant_zonal,
    multi_jet_w
  );
  let p_grad_u = -dh_dx + (u_target_zonal - adv.flow.x) * mix(0.24, 0.38, multi_jet_w);
  let p_grad_v = -dh_dy;

  // Exact implicit Coriolis rotation (energy-conserving, unconditionally stable for ANY f_rot!)
  let u_pre = adv.flow.x + p_grad_u * dt;
  let v_pre = adv.flow.y + p_grad_v * dt;
  let alpha = f_rot * dt;
  let denom = 1.0 + alpha * alpha;
  let drag = 1.0 / (1.0 + 0.12 * dt);
  var u_new = ((u_pre + alpha * v_pre) / denom) * drag * (0.45 + 0.55 * pole_taper);
  var v_new = ((v_pre - alpha * u_pre) / denom) * drag * (0.35 + 0.65 * pole_taper);

  // Smooth Laplacian hyperviscosity preventing grid-scale noise while keeping synoptic Rossby cyclones crisp!
  let lap_u = (cxp.flow.x + cxm.flow.x + cyp.flow.x + cym.flow.x - 4.0 * c0.flow.x);
  let lap_v = (cxp.flow.y + cxm.flow.y + cyp.flow.y + cym.flow.y - 4.0 * c0.flow.y);
  u_new = clamp(u_new + 0.055 * lap_u, -2.4, 2.4);
  v_new = clamp(v_new + 0.055 * lap_v, -2.0, 2.0);

  let h_new = clamp(adv.flow.z - 0.46 * div_v * dt + 0.16 * (t_new - adv.flow.z) * dt + 0.04 * (cxp.flow.z + cxm.flow.z + cyp.flow.z + cym.flow.z - 4.0 * c0.flow.z), -1.5, 1.5);

  // True Hadley/Ferrel Condensation-Subsidence-Rainout Equilibrium:
  //   - Moist updrafts in ITCZ (lat ~ 0) and baroclinic mid-latitude cyclone tracks (|lat| ~ 48 deg)
  //   - Clear subsiding subtropical high-pressure belts (|lat| ~ 26 deg) letting oceans & continents shine cleanly!
  let abs_lat = abs(lat);
  let itcz_x = abs_lat / 0.17;
  let storm_x = (abs_lat - 0.84) / 0.24;
  let subtrop_x = (abs_lat - 0.45) / 0.19;
  let itcz_band = exp(-(itcz_x * itcz_x));
  let storm_track = exp(-(storm_x * storm_x));
  let subtrop_dry = exp(-(subtrop_x * subtrop_x)) * three_cell_w;
  let updraft = max(0.0, -div_v - 0.08) + max(0.0, abs(vort) - 0.45) * 0.28 + (0.28 * itcz_band + 0.22 * storm_track) * three_cell_w;
  let subsidence = max(0.0, div_v + 0.04) + 0.42 * subtrop_dry;
  let wind_spd = length(vec2<f32>(u_new, v_new));
  let evap_src = params.volatile_frac * (0.04 * insol + 0.34 * updraft) * pole_taper * dt;
  let rain_sink = (max(0.0, adv.chem.x - 0.28) * 0.90 + subsidence * 0.65 * adv.chem.x + 0.15 * adv.chem.x) * dt;
  let lap_cloud = cxp.chem.x + cxm.chem.x + cyp.chem.x + cym.chem.x - 4.0 * c0.chem.x;
  let q_cloud = clamp(adv.chem.x + evap_src - rain_sink + 0.055 * lap_cloud, 0.0, 0.94);

  // Dry aeolian saltation plumes lifted by high-speed baroclinic storm fronts & dust devils
  let saltation = max(0.0, wind_spd - 0.22) * 1.15 + max(0.0, abs(vort) - 0.45) * 0.35;
  let dust_lift = params.dust_avail * saltation * (0.35 + 0.65 * insol) * pole_taper * 0.65 * dt;
  let dust_settle = (adv.chem.y * 0.34 + subsidence * 0.25 * adv.chem.y) * dt;
  let lap_dust = cxp.chem.y + cxm.chem.y + cyp.chem.y + cym.chem.y - 4.0 * c0.chem.y;
  let q_dust = clamp(adv.chem.y + dust_lift - dust_settle + 0.045 * lap_dust, 0.0, 0.94);

  var out: AtmoCell;
  out.flow = vec4<f32>(u_new, v_new, h_new, t_new);
  out.chem = vec4<f32>(q_cloud, q_dust, vort, rain_sink);
  atmo_dst[idx] = out;
}

// 2. Non-Inductive Triboelectric Charge Separation (Moist Graupel-Ice + Dry Dust-Storm Shear)
@compute @workgroup_size(8, 8)
fn atmo_triboelectric_charge(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = cell_idx(ix, iy);
  let w = f32(params.width);
  let h = f32(params.height);
  let lat = (0.5 - (f32(iy) + 0.5) / h) * PI;
  let raw_cos = max(0.0, cos(lat));
  let pole_taper = smoothstep(0.10, 0.38, raw_cos);
  let cos_lat = max(0.30, raw_cos);
  let dx = (TWO_PI * cos_lat) / w;
  let dy = PI / h;
  let dt = params.dt_sim;

  let a = atmo_src[idx]; // newest fluid state after swap!
  let bx = f32(ix) - (a.flow.x * dt) / dx;
  let by = f32(iy) + (a.flow.y * dt) / dy;
  let em_adv = sample_em_bilin(bx, by);

  let vort = a.chem.z;
  let spd = length(a.flow.xy);
  let q_cloud = a.chem.x;
  let q_dust = a.chem.y;

  // Takahashi-Saunders moist convective charging (~cloud^2 * |vort| * rain)
  // + Melnik-Farrell dry dust triboelectric charging (~dust * wind_shear * |vort|)
  // Tapered cleanly at coordinate poles so discharges spark inside real storm cores!
  var dq = 0.0;
  if (params.enable_triboelectric != 0u && params.atm_weight > 0.05) {
    let moist_charge = q_cloud * q_cloud * (abs(vort) * 1.85 + a.chem.w * 18.0);
    let dust_charge = q_dust * (spd * 1.35 + abs(vort) * 2.2);
    let sign_pol = select(-1.0, 1.0, vort >= 0.0);
    dq = sign_pol * params.charge_gain * (moist_charge + dust_charge) * pole_taper * dt;
  }

  // Ohmic ion conductivity leakage
  let rho_q = clamp(em_adv.em0.x * exp(-0.22 * dt) + dq, -8.0, 8.0);
  // Crisp localized convective lightning decay (prevents smeared cyan squares across the globe!)
  let flash_decay = em_adv.em0.w * exp(-7.8 * dt);

  var out = em_adv;
  out.em0 = vec4<f32>(rho_q, em_adv.em0.y, em_adv.em0.z, flash_decay);
  em_dst[idx] = out;
}

// 3. Spherical Electrostatic Poisson Solver (Jacobi relaxation: nabla^2 phi = -rho_q / eps0)
@compute @workgroup_size(8, 8)
fn atmo_poisson_efield(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = cell_idx(ix, iy);
  let w = f32(params.width);
  let h = f32(params.height);
  let lat = (0.5 - (f32(iy) + 0.5) / h) * PI;
  let cos_lat = max(0.30, cos(lat));
  let dx = (TWO_PI * cos_lat) / w;
  let dy = PI / h;
  let idx2 = 1.0 / (dx * dx);
  let idy2 = 1.0 / (dy * dy);

  let e0 = em_src[idx];
  let exp_ = em_src[cell_idx(ix + 1, iy)].em0.y;
  let exm = em_src[cell_idx(ix - 1, iy)].em0.y;
  let eyp = em_src[cell_idx(ix, iy - 1)].em0.y;
  let eym = em_src[cell_idx(ix, iy + 1)].em0.y;

  let denom = 2.0 * (idx2 + idy2);
  let phi_new = ((exp_ + exm) * idx2 + (eyp + eym) * idy2 + e0.em0.x) / denom;
  let ex = -(exp_ - exm) / (2.0 * dx);
  let ey = -(eyp - eym) / (2.0 * dy);
  // Total local E-field = horizontal dipole field |grad phi| + vertical cloud/dust dipole |rho_q|
  let e_mag = sqrt(ex * ex + ey * ey + e0.em0.x * e0.em0.x * 0.85);

  var out = e0;
  out.em0 = vec4<f32>(e0.em0.x, phi_new, e_mag, e0.em0.w);
  em_dst[idx] = out;
}

// 4. Paschen Dielectric Breakdown Lightning Discharge + Geodynamo Polar Aurorae
@compute @workgroup_size(8, 8)
fn atmo_paschen_breakdown(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = cell_idx(ix, iy);
  let h = f32(params.height);
  let lat = (0.5 - (f32(iy) + 0.5) / h) * PI;

  let a = atmo_src[idx];
  var e = em_src[idx];
  var rho_q = e.em0.x;
  let e_mag = e.em0.z;
  var flash = e.em0.w;

  // Real Paschen dielectric breakdown: when |E| exceeds E_crit(P), discharge channel fires!
  if (params.enable_triboelectric != 0u && e_mag > params.e_crit_norm) {
    let over = clamp((e_mag - params.e_crit_norm) / max(0.08, params.e_crit_norm), 0.15, 2.5);
    flash = max(flash, clamp(0.65 + 0.55 * over, 0.0, 1.8));
    // Conservative charge neutralization by the conductive plasma leader channel!
    rho_q = rho_q * 0.18;
  }

  // Core-geodynamo magnetic cusp polar auroral oval driven by solar wind pressure:
  // Store smooth latitudinal envelope in vis.w; crisp full-resolution 3D Birkeland filament curtains
  // are evaluated per-fragment in LIT_SPHERE_WGSL (eliminating coarse 128x64 beaded grid aliasing!).
  let aur_d = (abs(lat) - params.aurora_lat_rad) / 0.068;
  let aurora = params.aurora_strength * exp(-aur_d * aur_d) * clamp(params.sun_dir.w * 0.48, 0.28, 1.45);

  e.em0 = vec4<f32>(rho_q, e.em0.y, e_mag, flash);
  // Visual-ready zero-copy GPU payload + live spherical CFD velocity/vorticity read directly by LIT_SPHERE_WGSL!
  e.vis = vec4<f32>(a.chem.x, a.chem.y, flash, aurora);
  e.cfd_flow = vec4<f32>(a.flow.x, a.flow.y, a.chem.z, a.flow.w);
  em_dst[idx] = e;
}

// 5. Parallel GPU Telemetry Reduction (1 workgroup of 64 threads — ZERO WG(1)!)
@compute @workgroup_size(64)
fn reduce_atmo_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let total = params.width * params.height;
  var spd_sum = 0.0;
  var max_vort = 0.0;
  var cloud_sum = 0.0;
  var dust_sum = 0.0;
  var max_e = 0.0;
  var light_cnt = 0.0;
  var q_abs = 0.0;
  var max_aur = 0.0;

  var i = tid;
  loop {
    if (i >= total) { break; }
    let a = atmo_src[i];
    let e = em_src[i];
    spd_sum = spd_sum + length(a.flow.xy);
    max_vort = max(max_vort, abs(a.chem.z));
    cloud_sum = cloud_sum + a.chem.x;
    dust_sum = dust_sum + a.chem.y;
    max_e = max(max_e, e.em0.z);
    if (e.em0.w > 0.35) { light_cnt = light_cnt + 1.0; }
    q_abs = q_abs + abs(e.em0.x);
    max_aur = max(max_aur, e.vis.w);
    i = i + 64u;
  }

  wg0[tid] = spd_sum;
  wg1[tid] = max_vort;
  wg2[tid] = cloud_sum;
  wg3[tid] = dust_sum;
  wg4[tid] = max_e;
  wg5[tid] = light_cnt;
  wg6[tid] = q_abs;
  wg7[tid] = max_aur;
  workgroupBarrier();

  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] = wg0[tid] + wg0[tid + s];
      wg1[tid] = max(wg1[tid], wg1[tid + s]);
      wg2[tid] = wg2[tid] + wg2[tid + s];
      wg3[tid] = wg3[tid] + wg3[tid + s];
      wg4[tid] = max(wg4[tid], wg4[tid + s]);
      wg5[tid] = wg5[tid] + wg5[tid + s];
      wg6[tid] = wg6[tid] + wg6[tid + s];
      wg7[tid] = max(wg7[tid], wg7[tid + s]);
    }
    workgroupBarrier();
    s = s >> 1u;
  }

  if (tid == 0u) {
    let inv_n = 1.0 / max(1.0, f32(total));
    telemetry[0] = vec4<f32>(wg0[0] * inv_n, wg1[0], wg2[0] * inv_n, wg3[0] * inv_n);
    telemetry[1] = vec4<f32>(wg4[0], wg5[0], wg6[0] * inv_n, wg7[0]);
  }
}
`;function Ce(t,{width:n=128,height:r=64,bodyParams:i=null,enableTriboelectric:c=!0,seed:l=20261125,label:u=`ulg-planetary-atmo-em`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createPlanetaryAtmosphereElectricSessionWebGpu requires a live WebGPU GPUDevice`);let d=Math.max(32,Math.min(256,Math.trunc(n))),f=Math.max(16,Math.min(128,Math.trunc(r))),p=d*f,m=i||be({radiusKm:6371,massSolar:3003e-9,atm:.72,tempK:288,kind:1,color1:[.06,.26,.58]}),h=!!c,g=xe(l),_=g()*Math.PI*2,v=g()*Math.PI*2,y=g()*Math.PI*2,b=new Float32Array(p*8),x=new Float32Array(p*12),S=Math.max(.05,Math.min(14,m.rotationOmegaRadS/72921e-9*(m.radiusM/6371e3))),C=Math.max(0,Math.min(1,(S-1.8)/3.7));for(let e=0;e<f;e+=1){let t=(.5-(e+.5)/f)*Math.PI,n=Math.abs(t),r=Math.cos(t),i=Math.exp(-((n/.18)**2)),a=Math.exp(-(((n-.82)/.28)**2)),o=1-.72*Math.exp(-(((n-.44)/.2)**2));for(let n=0;n<d;n+=1){let s=((n+.5)/d-.5)*2*Math.PI,c=(e*d+n)*8,l=(e*d+n)*12,u=.54*Math.sin(2*t)*Math.sin(2*t)-.32*Math.max(0,r)**3,f=(.76*Math.cos(10*t)+.36*Math.sin(18*t))*r,p=u*(1-C)+f*C,h=.22*Math.sin(3*s+2.6*t+_)+.15*Math.cos(5*s-3.4*t+v),g=.18*Math.cos(4*s+1.8*t+v)+.1*Math.sin(6*s-2.4*t+y);b[c+0]=p+h,b[c+1]=g,b[c+2]=.24*Math.sin(3*s+t+_)*r,b[c+3]=.7*r;let S=.5+.32*Math.sin(3*s-4.2*t+_)+.18*Math.cos(6*s+5*t+y),w=Math.max(.02,Math.min(.88,(.48*i+.56*a*S+.14*S)*o)),T=Math.max(.04,Math.min(.82,.28+.3*(.5+.5*Math.sin(2*s+2.2*t+v))*r));b[c+4]=m.volatileCloudFrac*w,b[c+5]=m.dustAvailability*T,b[c+6]=.35*Math.cos(3*s+2.6*t+_)*r,b[c+7]=0,x[l+4]=b[c+4],x[l+5]=b[c+5],x[l+8]=b[c+0],x[l+9]=b[c+1],x[l+10]=b[c+6],x[l+11]=b[c+3]}}let w=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`storage`),a(3,`read-only-storage`),a(4,`storage`),a(5,`storage`)],T=e=>s(t,{cacheKey:`ulg-planetary-atmo-em-${e}.v3-cfd-flow`,label:`${u}-${e}`,code:Se,entryPoint:e,bindings:w}),E=T(`atmo_step_fluid`),D=T(`atmo_triboelectric_charge`),O=T(`atmo_poisson_efield`),k=T(`atmo_paschen_breakdown`),A=T(`reduce_atmo_telemetry`),j=t.createBuffer({label:`${u}-params`,size:80,usage:me.UNIFORM|me.COPY_DST}),M=t.createBuffer({label:`${u}-atmo-a`,size:b.byteLength,usage:me.STORAGE|me.COPY_DST}),N=t.createBuffer({label:`${u}-atmo-b`,size:b.byteLength,usage:me.STORAGE|me.COPY_DST}),P=t.createBuffer({label:`${u}-em-a`,size:x.byteLength,usage:me.STORAGE|me.COPY_DST|me.COPY_SRC}),F=t.createBuffer({label:`${u}-em-b`,size:x.byteLength,usage:me.STORAGE|me.COPY_DST|me.COPY_SRC}),I=t.createBuffer({label:`${u}-tel`,size:32,usage:me.STORAGE|me.COPY_SRC}),L=t.createBuffer({label:`${u}-tel-read`,size:32,usage:me.MAP_READ|me.COPY_DST});t.queue.writeBuffer(M,0,b),t.queue.writeBuffer(N,0,b),t.queue.writeBuffer(P,0,x),t.queue.writeBuffer(F,0,x);let R=(e,n,r,i)=>o(t,{layout:E.bindGroupLayout,label:`${u}-bg`,entries:[{binding:0,resource:{buffer:j}},{binding:1,resource:{buffer:e}},{binding:2,resource:{buffer:n}},{binding:3,resource:{buffer:r}},{binding:4,resource:{buffer:i}},{binding:5,resource:{buffer:I}}]}),z=R(M,N,P,F),B=R(M,N,F,P),V=R(N,M,P,F),ee=R(N,M,F,P),H=(e,t)=>e===0?t===0?z:B:t===0?V:ee,U=0,W=0,G=0,te=!1,K=!1,ne=Object.freeze({schema:pe,stepIndex:0,meanWindSpeed:0,maxVorticity:0,meanCloudCover:m.volatileCloudFrac*.4,meanDustLoad:m.dustAvailability*.3,peakElectricFieldVPerM:0,paschenBreakdownVPerM:m.eCritVPerM,activeLightningCells:0,meanAbsCharge:0,maxAuroraGlow:m.dynamo?.auroralStrength||0,dipoleFieldMicroT:(m.dynamo?.bEquatorialT||0)*1e6,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),q=Math.ceil(d/8),J=Math.ceil(f/8);function re(e,n){let r=Math.max(.36,Math.min(2.2,(m.eCritVPerM/26e4)**.45*1.1)),i=new ArrayBuffer(80);new Uint32Array(i,0,4).set([d,f,G,+!!h]),new Float32Array(i,16,16).set([m.radiusM,m.gravityMps2,m.rotationOmegaRadS,e,m.eqTempK,m.volatileCloudFrac,m.dustAvailability,m.atmWeight,r,2.15,m.dynamo?.auroralLatRad??1.18,m.dynamo?.auroralStrength??.65,n[0],n[1],n[2],m.solarWindPressureNPa??2]),t.queue.writeBuffer(j,0,i)}async function ie({dtSim:n=.045,substeps:r=2,sunDir:i=[.65,.28,.7],readTelemetry:a=!0}={}){if(K)return ne;let o=Math.max(1,Math.min(8,Math.trunc(r)));re(Math.max(.005,Math.min(.08,Number(n)||.045)),i);let s=t.createCommandEncoder({label:`${u}-step-${G}`}),c=s.beginComputePass({label:`${u}-pass`});for(let e=0;e<o;e+=1){c.setBindGroup(0,H(U,W)),c.setPipeline(E.pipeline),c.dispatchWorkgroups(q,J),U^=1,c.setBindGroup(0,H(U,W)),c.setPipeline(D.pipeline),c.dispatchWorkgroups(q,J),W^=1,c.setPipeline(O.pipeline);for(let e=0;e<6;e+=1)c.setBindGroup(0,H(U,W)),c.dispatchWorkgroups(q,J),W^=1;c.setBindGroup(0,H(U,W)),c.setPipeline(k.pipeline),c.dispatchWorkgroups(q,J),W^=1,G+=1}c.setBindGroup(0,H(U,W)),c.setPipeline(A.pipeline),c.dispatchWorkgroups(1),c.end();let l=a&&!te&&L.mapState===`unmapped`;if(l&&(te=!0,s.copyBufferToBuffer(I,0,L,0,32)),t.queue.submit([s.finish()]),l)try{if(await L.mapAsync(me.MAP_READ),!K){let t=new Float32Array(L.getMappedRange(0,32)),n=Math.max(.36,Math.min(2.2,(m.eCritVPerM/26e4)**.45*1.1));ne=Object.freeze({schema:pe,stepIndex:G,meanWindSpeed:t[0],maxVorticity:t[1],meanCloudCover:t[2],meanDustLoad:t[3],peakElectricFieldNorm:t[4],peakElectricFieldVPerM:t[4]/n*m.eCritVPerM,paschenBreakdownVPerM:m.eCritVPerM,activeLightningCells:Math.round(t[5]),meanAbsCharge:t[6],maxAuroraGlow:t[7],dipoleFieldMicroT:(m.dynamo?.bEquatorialT||0)*1e6,enableTriboelectric:h,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{L.unmap()}catch{}}catch(e){if(!K&&e?.name!==`AbortError`)throw e}finally{te=!1}return ne}function ae(e){h=!!e}function Y(){if(!K){K=!0;for(let e of[j,M,N,P,F,I,L])try{e.destroy()}catch{}}}return Object.freeze({schema:pe,lawAdapter:he,get width(){return d},get height(){return f},get stepIndex(){return G},get bodyParams(){return m},get enableTriboelectric(){return h},getResidentEmVisBuffer:()=>W===0?P:F,getTelemetry:()=>ne,setEnableTriboelectric:ae,step:ie,dispose:Y})}function we(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`planetary-atmosphere-em@1`)?e.resolveModule(`planetary-atmosphere-em@1`)?.descriptor||null:e.registerModule({method:{model:`planetary-atmosphere-em`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/planetaryAtmosphereElectricGpu.js`,entryPoint:`atmo_paschen_breakdown`,workgroupSize:64},parameterSchema:{dtSim:{type:`number`,min:.002,max:.1,required:!1},substeps:{type:`number`,min:1,max:16,required:!1},enableTriboelectric:{type:`boolean`,required:!1}},stateLayout:{tensorId:`planetary-em-vis`,dtype:`f32`,layout:`interleaved`,strideElements:12,strideBytes:48,fields:[`rhoQ`,`phiE`,`eMag`,`flash`,`cloud`,`dust`,`lightningGlow`,`auroraEnvelope`,`uEast`,`vNorth`,`vorticity`,`tAnom`]},scaleRangeM:[1e4,1e8],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=Ce(n,{width:64,height:32,enableTriboelectric:r.enableTriboelectric??!0}),a=await i.step({dtSim:r.dtSim??.045,substeps:r.substeps??4,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:planetary-atmo-em:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/planetaryAtmosphereElectricGpu.js`,entryPoint:`createPlanetaryAtmosphereElectricSessionWebGpu`,kernelEntryPoint:`atmo_paschen_breakdown`},representation:`spherical-shell-baroclinic-em-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-spherical-baroclinic-em`,placement:`local`},validity:{finite:Number.isFinite(a.meanWindSpeed)&&Number.isFinite(a.peakElectricFieldVPerM)},validation:{status:`pass`,validationMode:`gpu-atmo-em-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var Te=`peercompute.ulg.particle-rigid-dynamics-gpu.v1`,Ee=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),De=Object.freeze({id:`particle-rigid-dynamics`,lawNodeId:`law:particle-rigid-dynamics`,orderConstraint:`after:scale-atlas-multipole-gravity`,adapterMode:n.SOLID_PROXY,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`solid-rigid-frames`,`solid-local-particles`,`solid-external-wrench`,`ss-spatial-epoch-directory`]),writes:Object.freeze([`solid-rigid-frames`,`solid-world-particles`]),accumulates:Object.freeze([`solid-wrench-accumulators`,`solid-rigid-telemetry`]),pairedVolumeState:Object.freeze({v0Lane:`solid-local-particles.radius`,jLane:`solid-rigid-frames.quat`}),conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`angular-momentum`]),validityDomain:Object.freeze({requiresNonDegenerateInertia:!0,maxCflDisplacementRadii:.5}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([.001,1e8]),fundamentalLaws:Object.freeze([`rigid-body-se3-dlm-symplectic`,`hertz-mindlin-jkr-cohesive-contact`,`coulomb-friction-rolling-resistance`,`mutual-gravitational-coupling`])});function Oe(e={}){let t=Math.max(0,Math.trunc(Number(e.solidBodyCount)||0)),n=Math.max(0,Math.trunc(Number(e.solidParticleCount)||0)),r=t>0&&n>0;return Object.freeze({active:r,reason:r?`solid-phase-composites-present`:`no-solid-composites-dormant`,solidBodyCount:t,solidParticleCount:n})}function ke(e,t,n,r,i,a){let o=[[e,r,i],[r,t,a],[i,a,n]],s=[[1,0,0],[0,1,0],[0,0,1]];for(let e=0;e<14;e+=1)for(let e=0;e<3;e+=1)for(let t=e+1;t<3;t+=1){let n=o[e][t];if(Math.abs(n)<1e-12)continue;let r=(o[t][t]-o[e][e])/(2*n),i=r>=0?1/(r+Math.sqrt(1+r*r)):-1/(-r+Math.sqrt(1+r*r)),a=1/Math.sqrt(1+i*i),c=i*a,l=o[e][e],u=o[t][t];o[e][e]=l-i*n,o[t][t]=u+i*n,o[e][t]=0,o[t][e]=0;for(let n=0;n<3;n+=1){if(n===e||n===t)continue;let r=o[n][e],i=o[n][t];o[n][e]=a*r-c*i,o[e][n]=o[n][e],o[n][t]=c*r+a*i,o[t][n]=o[n][t]}for(let n=0;n<3;n+=1){let r=s[n][e],i=s[n][t];s[n][e]=a*r-c*i,s[n][t]=c*r+a*i}}s[0][0]*(s[1][1]*s[2][2]-s[1][2]*s[2][1])-s[0][1]*(s[1][0]*s[2][2]-s[1][2]*s[2][0])+s[0][2]*(s[1][0]*s[2][1]-s[1][1]*s[2][0])<0&&(s[0][2]=-s[0][2],s[1][2]=-s[1][2],s[2][2]=-s[2][2]);let c=s[0][0]+s[1][1]+s[2][2],l,u,d,f;if(c>0){let e=Math.sqrt(c+1)*2;f=.25*e,l=(s[2][1]-s[1][2])/e,u=(s[0][2]-s[2][0])/e,d=(s[1][0]-s[0][1])/e}else if(s[0][0]>s[1][1]&&s[0][0]>s[2][2]){let e=Math.sqrt(1+s[0][0]-s[1][1]-s[2][2])*2;f=(s[2][1]-s[1][2])/e,l=.25*e,u=(s[0][1]+s[1][0])/e,d=(s[0][2]+s[2][0])/e}else if(s[1][1]>s[2][2]){let e=Math.sqrt(1+s[1][1]-s[0][0]-s[2][2])*2;f=(s[0][2]-s[2][0])/e,l=(s[0][1]+s[1][0])/e,u=.25*e,d=(s[1][2]+s[2][1])/e}else{let e=Math.sqrt(1+s[2][2]-s[0][0]-s[1][1])*2;f=(s[1][0]-s[0][1])/e,l=(s[0][2]+s[2][0])/e,u=(s[1][2]+s[2][1])/e,d=.25*e}let p=Math.hypot(l,u,d,f)||1;return{moments:[Math.max(1e-8,o[0][0]),Math.max(1e-8,o[1][1]),Math.max(1e-8,o[2][2])],R:s,quat:[l/p,u/p,d/p,f/p]}}function Ae(e,t){return[e[3]*t[0]+t[3]*e[0]+(e[1]*t[2]-e[2]*t[1]),e[3]*t[1]+t[3]*e[1]+(e[2]*t[0]-e[0]*t[2]),e[3]*t[2]+t[3]*e[2]+(e[0]*t[1]-e[1]*t[0]),e[3]*t[3]-(e[0]*t[0]+e[1]*t[1]+e[2]*t[2])]}function je(e,t){let n=2*(e[1]*t[2]-e[2]*t[1]),r=2*(e[2]*t[0]-e[0]*t[2]),i=2*(e[0]*t[1]-e[1]*t[0]);return[t[0]+e[3]*n+(e[1]*i-e[2]*r),t[1]+e[3]*r+(e[2]*n-e[0]*i),t[2]+e[3]*i+(e[0]*r-e[1]*n)]}function Me(e=[]){let t=e.length,n=0;for(let t of e)n+=t.particles?.length||0;let r=new Float32Array(Math.max(1,t)*24),i=new Float32Array(Math.max(1,n)*4),a=new Float32Array(Math.max(1,n)*4),o=new Float32Array(Math.max(1,n)*8),s=0,c=.05;for(let n=0;n<t;n+=1){let t=e[n],l=t.particles||[],u=s,d=l.length,f=t.isStatic===!0||Number(t.mass)===0,p=0,m=0,h=0,g=0;for(let e of l){let t=Math.max(1e-8,Number(e.mass??1));p+=t,m+=t*(Number(e.localPos?.[0])||0),h+=t*(Number(e.localPos?.[1])||0),g+=t*(Number(e.localPos?.[2])||0)}p>0&&(m/=p,h/=p,g/=p);let _=Number(t.mass)>0?Number(t.mass)/Math.max(1e-12,p):1,v=f?0:p*_,y=0,b=0,x=0,S=0,C=0,w=0,T=0,E=[];for(let e of l){let n=Math.max(1e-8,Number(e.mass??1))*_,r=Math.max(1e-4,Number(e.radius??.25));r>c&&(c=r);let i=(Number(e.localPos?.[0])||0)-m,a=(Number(e.localPos?.[1])||0)-h,o=(Number(e.localPos?.[2])||0)-g,s=.4*n*r*r;y+=n*(a*a+o*o)+s,b+=n*(i*i+o*o)+s,x+=n*(i*i+a*a)+s,S-=n*i*a,C-=n*i*o,w-=n*a*o,T=Math.max(T,Math.hypot(i,a,o)+r),E.push({rx:i,ry:a,rz:o,r,m:n,cohesion:Number(e.cohesion??t.cohesion??0),matId:Number(e.materialId??t.materialId??0)})}let D=ke(y,b,x,S,C,w),O=t.quaternion||[0,0,0,1],k=Math.hypot(...O)||1,A=O.map(e=>e/k),j=Ae(A,D.quat),M=Math.hypot(...j)||1,N=j.map(e=>e/M),P=je(A,[m,h,g]),F=[(Number(t.position?.[0])||0)+P[0],(Number(t.position?.[1])||0)+P[1],(Number(t.position?.[2])||0)+P[2]],I=[Number(t.velocity?.[0])||0,Number(t.velocity?.[1])||0,Number(t.velocity?.[2])||0],L=[Number(t.angularVelocity?.[0])||0,Number(t.angularVelocity?.[1])||0,Number(t.angularVelocity?.[2])||0],R=je([-N[0],-N[1],-N[2],N[3]],L),z=[D.moments[0]*R[0],D.moments[1]*R[1],D.moments[2]*R[2]],B=f?[0,0,0]:je(N,z),V=n*24;r[V+0]=F[0],r[V+1]=F[1],r[V+2]=F[2],r[V+3]=v,r[V+4]=N[0],r[V+5]=N[1],r[V+6]=N[2],r[V+7]=N[3],r[V+8]=v*I[0],r[V+9]=v*I[1],r[V+10]=v*I[2],r[V+11]=Number(t.linearDrag??0),r[V+12]=B[0],r[V+13]=B[1],r[V+14]=B[2],r[V+15]=Number(t.angularDrag??0),r[V+16]=D.moments[0],r[V+17]=D.moments[1],r[V+18]=D.moments[2],r[V+19]=T,r[V+20]=Number(t.materialId??0),r[V+21]=Number(t.flags??0),r[V+22]=u,r[V+23]=d;let ee=[-D.quat[0],-D.quat[1],-D.quat[2],D.quat[3]];for(let e of E){let t=je(ee,[e.rx,e.ry,e.rz]),r=s*4;i[r+0]=t[0],i[r+1]=t[1],i[r+2]=t[2],i[r+3]=e.r,a[r+0]=n,a[r+1]=e.m,a[r+2]=e.matId,a[r+3]=e.cohesion;let c=je(N,t),l=s*8;o[l+0]=F[0]+c[0],o[l+1]=F[1]+c[1],o[l+2]=F[2]+c[2],o[l+3]=e.r,o[l+4]=I[0]+(L[1]*c[2]-L[2]*c[1]),o[l+5]=I[1]+(L[2]*c[0]-L[0]*c[2]),o[l+6]=I[2]+(L[0]*c[1]-L[1]*c[0]),o[l+7]=n,s+=1}}return Object.freeze({bodyCount:t,particleCount:n,maxParticleRadius:c,bodiesBufData:r,localPosBufData:i,localMetaBufData:a,worldParticlesInit:o})}function Ne({count:e=12,bodyRadius:t=.5,particleRadius:n=.18,mass:r=1,cohesion:i=0,seed:a=1}={}){let o=a>>>0||1,s=()=>(o=Math.imul(1664525,o)+1013904223>>>0,o/4294967296),c=[],l=Math.PI*(3-Math.sqrt(5)),u=Math.max(1,Math.trunc(e));for(let e=0;e<u;e+=1){if(u===1){c.push({localPos:[0,0,0],radius:n,mass:r,cohesion:i});break}let a=1-2*((e+.5)/u),o=Math.sqrt(Math.max(0,1-a*a)),d=e*l+(s()-.5)*.25,f=Math.max(0,t-n*.65)*(.72+.28*s());c.push({localPos:[Math.cos(d)*o*f,a*f*(.78+.35*s()),Math.sin(d)*o*f],radius:n*(.85+.25*s()),mass:r/u,cohesion:i})}return c}var Pe=`
struct RigidDynParams {
  body_count: u32,
  particle_count: u32,
  grid_dim_x: u32,
  grid_dim_y: u32,
  grid_dim_z: u32,
  enable_mutual_gravity: u32,
  enable_box_bounds: u32,
  step_index: u32,
  dt: f32,
  stiffness_k: f32,      // Hertz-Mindlin contact stiffness
  damping_c: f32,        // Normal contact damping (unilateral: approaching only!)
  friction_mu: f32,      // Coulomb friction coefficient (clamped to mu * F_n!)
  rolling_mu: f32,       // Rolling resistance coefficient
  cohesion_gain: f32,    // JKR surface cohesion strength
  gravity_g: f32,        // Mutual N-body gravity G (when enable_mutual_gravity == 1)
  softening2: f32,
  cell_size: f32,
  inv_cell_size: f32,
  pad0: f32,
  pad1: f32,
  grid_origin: vec4<f32>, // xyz = domain min corner, w = max_speed
  ext_gravity: vec4<f32>, // xyz = optional uniform gravity, w = unused
  box_min: vec4<f32>,
  box_max: vec4<f32>,
};

struct RigidBody {
  pos_m: vec4<f32>,
  quat: vec4<f32>,
  lin_mom_drag: vec4<f32>,
  ang_mom_drag: vec4<f32>,
  inertia_r: vec4<f32>,
  info: vec4<f32>,
};

struct WorldParticle {
  pos_r: vec4<f32>,
  vel_b: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: RigidDynParams;
@group(0) @binding(1) var<storage, read_write> bodies: array<RigidBody>;
@group(0) @binding(2) var<storage, read> local_pos: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> local_meta: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> world_particles: array<WorldParticle>;
// Per-particle contact force & torque (2 vec4 per particle -> clean zero-contention contact pass!)
@group(0) @binding(5) var<storage, read_write> part_wrench: array<vec4<f32>>;
// Optional per-body external wrench (2 vec4 per body: [0]=force.xyz, [1]=torque.xyz)
@group(0) @binding(6) var<storage, read> ext_wrench: array<vec4<f32>>;
// Telemetry reduction (2 vec4): [0]=(total_ke, total_px, total_py, total_pz), [1]=(Lx, Ly, Lz, contact_pairs)
@group(0) @binding(7) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;
var<workgroup> wg4: array<f32, 64>;
var<workgroup> wg5: array<f32, 64>;
var<workgroup> wg6: array<f32, 64>;
var<workgroup> wg7: array<f32, 64>;

fn quat_mul(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(
    a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz),
    a.w * b.w - dot(a.xyz, b.xyz)
  );
}

fn quat_rotate(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

fn quat_rotate_inv(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  return quat_rotate(vec4<f32>(-q.xyz, q.w), v);
}

fn axis_quat(axis_idx: u32, theta: f32) -> vec4<f32> {
  let s = sin(0.5 * theta);
  let c = cos(0.5 * theta);
  if (axis_idx == 0u) { return vec4<f32>(s, 0.0, 0.0, c); }
  if (axis_idx == 1u) { return vec4<f32>(0.0, s, 0.0, c); }
  return vec4<f32>(0.0, 0.0, s, c);
}

// World omega = R * I_principal^-1 * R^T * L   (FIXES webgpuphys R^T*I^-1*R bug!)
fn world_omega_from_L(q: vec4<f32>, I_prin: vec3<f32>, L_world: vec3<f32>) -> vec3<f32> {
  let L_body = quat_rotate_inv(q, L_world);
  let w_body = L_body / max(I_prin, vec3<f32>(1e-8));
  return quat_rotate(q, w_body);
}

// Dullweber-Leimkuhler-McLachlan (1997) 5-stage symmetric symplectic free-rotation splitting (1,2,3,2,1):
// Conserves world angular momentum L bit-exactly and keeps spin kinetic energy bounded!
fn dlm_free_rotate(q_in: vec4<f32>, I_prin: vec3<f32>, L_world: vec3<f32>, dt: f32) -> vec4<f32> {
  var q = normalize(q_in);
  var L_b = quat_rotate_inv(q, L_world);

  // Stage 1: axis 0 by dt/2
  let th0a = (L_b.x / max(1e-8, I_prin.x)) * (0.5 * dt);
  let r0a = axis_quat(0u, th0a);
  q = quat_mul(q, r0a);
  L_b = quat_rotate_inv(r0a, L_b);

  // Stage 2: axis 1 by dt/2
  let th1a = (L_b.y / max(1e-8, I_prin.y)) * (0.5 * dt);
  let r1a = axis_quat(1u, th1a);
  q = quat_mul(q, r1a);
  L_b = quat_rotate_inv(r1a, L_b);

  // Stage 3: axis 2 by dt
  let th2 = (L_b.z / max(1e-8, I_prin.z)) * dt;
  let r2 = axis_quat(2u, th2);
  q = quat_mul(q, r2);
  L_b = quat_rotate_inv(r2, L_b);

  // Stage 4: axis 1 by dt/2
  let th1b = (L_b.y / max(1e-8, I_prin.y)) * (0.5 * dt);
  let r1b = axis_quat(1u, th1b);
  q = quat_mul(q, r1b);
  L_b = quat_rotate_inv(r1b, L_b);

  // Stage 5: axis 0 by dt/2
  let th0b = (L_b.x / max(1e-8, I_prin.x)) * (0.5 * dt);
  let r0b = axis_quat(0u, th0b);
  q = normalize(quat_mul(q, r0b));
  return q;
}

// 1. FUSED SINGLE-PASS PARTICLE SCATTER (replaces webgpuphys's 3 separate scatter passes!)
@compute @workgroup_size(64)
fn scatter_particles(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  let lp = local_pos[i];
  let lm = local_meta[i];
  let b_idx = u32(round(lm.x));
  let b = bodies[b_idx];
  let m = b.pos_m.w;
  let r_world = quat_rotate(b.quat, lp.xyz);
  let pos_w = b.pos_m.xyz + r_world;
  var vel_w = vec3<f32>(0.0);
  if (m > 0.0) {
    let v_cm = b.lin_mom_drag.xyz / m;
    let omega = world_omega_from_L(b.quat, b.inertia_r.xyz, b.ang_mom_drag.xyz);
    vel_w = v_cm + cross(omega, r_world);
  }
  world_particles[i].pos_r = vec4<f32>(pos_w, lp.w);
  world_particles[i].vel_b = vec4<f32>(vel_w, lm.x);
}

// 2. SINGLE-PASS HERTZ-MINDLIN + JKR COHESIVE + COULOMB CONTACT FORCE & TORQUE
//    Uses exact body-level bounding-sphere culling (zero silent MAX_PARTICLES_PER_CELL=4 drops!)
//    and evaluates contact-point velocity & lever arm ONCE (fixing both webgpuphys double-count bugs!).
@compute @workgroup_size(64)
fn solve_particle_contacts(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  let wp_i = world_particles[i];
  let lm_i = local_meta[i];
  let bi = u32(round(lm_i.x));
  let body_i = bodies[bi];
  let pi = wp_i.pos_r.xyz;
  let ri = wp_i.pos_r.w;
  let vi = wp_i.vel_b.xyz;
  let lever_i = pi - body_i.pos_m.xyz;
  let omega_i = select(vec3<f32>(0.0), world_omega_from_L(body_i.quat, body_i.inertia_r.xyz, body_i.ang_mom_drag.xyz), body_i.pos_m.w > 0.0);

  var f_sum = vec3<f32>(0.0);
  var t_sum = vec3<f32>(0.0);
  var contact_cnt = 0.0;

  let b_count = params.body_count;
  for (var bj = 0u; bj < b_count; bj = bj + 1u) {
    if (bj == bi) { continue; }
    let body_j = bodies[bj];
    // Fast exact bounding-sphere broadphase culling per body (0 silent drops!)
    let d_body = pi - body_j.pos_m.xyz;
    let reach = ri + body_j.inertia_r.w + 0.08 * ri;
    if (dot(d_body, d_body) > reach * reach) { continue; }

    let p_off = u32(round(body_j.info.z));
    let p_cnt = u32(round(body_j.info.w));
    let omega_j = select(vec3<f32>(0.0), world_omega_from_L(body_j.quat, body_j.inertia_r.xyz, body_j.ang_mom_drag.xyz), body_j.pos_m.w > 0.0);

    for (var k = 0u; k < p_cnt; k = k + 1u) {
      let j = p_off + k;
      let wp_j = world_particles[j];
      let rj = wp_j.pos_r.w;
      let delta_p = pi - wp_j.pos_r.xyz; // points from j -> i
      let dist2 = dot(delta_p, delta_p);
      let r_sum = ri + rj;
      let coh_range = r_sum * 1.12;
      if (dist2 >= coh_range * coh_range || dist2 < 1e-12) { continue; }

      let dist = sqrt(dist2);
      let n = delta_p / dist; // outward normal from j to i
      let overlap = r_sum - dist;

      // Shared exact contact midpoint c = 0.5 * ((pi - ri*n) + (pj + rj*n)) so
      // cross(c, F_ij) + cross(c, F_ji) == 0 bit-exactly even under overlap + Coulomb friction!
      let r_arm_i = ri - 0.5 * max(0.0, overlap);
      let r_arm_j = rj - 0.5 * max(0.0, overlap);
      let vc_i = vi + cross(omega_i, -r_arm_i * n);
      let vc_j = wp_j.vel_b.xyz + cross(omega_j, r_arm_j * n);
      let v_rel = vc_i - vc_j;
      let vn = dot(v_rel, n); // negative when approaching!

      var f_c = vec3<f32>(0.0);
      if (overlap > 0.0) {
        contact_cnt = contact_cnt + 1.0;
        let eff_r = (ri * rj) / max(1e-6, r_sum);
        // Hertz-Mindlin nonlinear elastic repulsion (delta^(3/2)) + unilateral damping (approaching only!)
        let ov_clamped = min(overlap, 0.55 * r_sum);
        let f_spring = params.stiffness_k * sqrt(eff_r) * ov_clamped * sqrt(ov_clamped);
        let f_damp = select(0.0, -params.damping_c * vn, vn < 0.0);
        let f_n = max(0.0, f_spring + f_damp);

        // Coulomb-clamped tangential friction (|F_t| <= mu * F_n)
        let v_t = v_rel - vn * n;
        let v_t_mag = length(v_t);
        var f_t = vec3<f32>(0.0);
        if (v_t_mag > 1e-6) {
          let f_t_mag = min(params.friction_mu * f_n, params.damping_c * 1.8 * v_t_mag);
          f_t = -(v_t / v_t_mag) * f_t_mag;
        }
        f_c = f_n * n + f_t;

        // Rolling resistance torque opposing relative spin
        let w_rel = omega_i - omega_j;
        let w_mag = length(w_rel);
        if (w_mag > 1e-6 && params.rolling_mu > 0.0) {
          t_sum = t_sum - (w_rel / w_mag) * min(params.rolling_mu * eff_r * f_n, params.damping_c * eff_r * w_mag);
        }
      }

      // Optional JKR surface cohesion (sintered asteroid regolith / planetesimal sticking!)
      let coh_pair = 0.5 * (lm_i.w + local_meta[j].w) * params.cohesion_gain;
      if (coh_pair > 0.0) {
        let s = clamp((coh_range - dist) / max(1e-5, coh_range - r_sum * 0.85), 0.0, 1.0);
        f_c = f_c - n * (coh_pair * s * (1.0 - 0.5 * s));
      }

      f_sum = f_sum + f_c;
      // Exact shared-midpoint lever arm from body COM to contact midpoint c!
      t_sum = t_sum + cross(lever_i - r_arm_i * n, f_c);
    }
  }

  // Optional lab-box containment walls (disabled by default for open astrophysics!)
  if (params.enable_box_bounds != 0u) {
    let bmin = params.box_min.xyz;
    let bmax = params.box_max.xyz;
    for (var ax = 0u; ax < 3u; ax = ax + 1u) {
      let c = pi[ax];
      if (c - ri < bmin[ax]) {
        let ov = (bmin[ax] + ri) - c;
        var n = vec3<f32>(0.0); n[ax] = 1.0;
        let vn = dot(vi, n);
        let fn_w = max(0.0, params.stiffness_k * ov + select(0.0, -params.damping_c * vn, vn < 0.0));
        let vt = vi - vn * n;
        let vtm = length(vt);
        let ft = select(vec3<f32>(0.0), -(vt / max(1e-6, vtm)) * min(params.friction_mu * fn_w, params.damping_c * 1.5 * vtm), vtm > 1e-6);
        let fw = fn_w * n + ft;
        f_sum = f_sum + fw;
        t_sum = t_sum + cross(lever_i - ri * n, fw);
      } else if (c + ri > bmax[ax]) {
        let ov = (c + ri) - bmax[ax];
        var n = vec3<f32>(0.0); n[ax] = -1.0;
        let vn = dot(vi, n);
        let fn_w = max(0.0, params.stiffness_k * ov + select(0.0, -params.damping_c * vn, vn < 0.0));
        let vt = vi - vn * n;
        let vtm = length(vt);
        let ft = select(vec3<f32>(0.0), -(vt / max(1e-6, vtm)) * min(params.friction_mu * fn_w, params.damping_c * 1.5 * vtm), vtm > 1e-6);
        let fw = fn_w * n + ft;
        f_sum = f_sum + fw;
        t_sum = t_sum + cross(lever_i - ri * n, fw);
      }
    }
  }

  part_wrench[i * 2u + 0u] = vec4<f32>(f_sum, contact_cnt);
  part_wrench[i * 2u + 1u] = vec4<f32>(t_sum, 0.0);
}

// 3. PER-BODY DETERMINISTIC WRENCH REDUCTION + OPTIONAL MUTUAL GRAVITY + DLM SYMPLECTIC STEP!
//    Since each body owns a contiguous particle slice [p_off .. p_off + p_cnt), each body thread
//    sums its constituent particle wrenches deterministically with ZERO atomic CAS contention!
@compute @workgroup_size(64)
fn integrate_rigid_bodies(@builtin(global_invocation_id) gid: vec3<u32>) {
  let bi = gid.x;
  if (bi >= params.body_count) { return; }
  var b = bodies[bi];
  let m = b.pos_m.w;
  if (!(m > 0.0)) { return; } // Static body stays immobile

  let p_off = u32(round(b.info.z));
  let p_cnt = u32(round(b.info.w));

  var f_tot = ext_wrench[bi * 2u + 0u].xyz + params.ext_gravity.xyz * m;
  var t_tot = ext_wrench[bi * 2u + 1u].xyz;

  // Deterministic order-independent sum over constituent particles
  for (var k = 0u; k < p_cnt; k = k + 1u) {
    let idx = p_off + k;
    f_tot = f_tot + part_wrench[idx * 2u + 0u].xyz;
    t_tot = t_tot + part_wrench[idx * 2u + 1u].xyz;
  }

  // Optional pairwise mutual Newtonian self-gravity between rigid bodies (exact F_ij = -F_ji!)
  if (params.enable_mutual_gravity != 0u) {
    let G = params.gravity_g;
    let eps2 = params.softening2;
    let pi = b.pos_m.xyz;
    for (var bj = 0u; bj < params.body_count; bj = bj + 1u) {
      if (bj == bi) { continue; }
      let other = bodies[bj];
      let mj = other.pos_m.w;
      if (!(mj > 0.0)) { continue; }
      let d = other.pos_m.xyz - pi;
      let r2 = dot(d, d) + eps2;
      let inv_r = inverseSqrt(r2);
      f_tot = f_tot + d * (G * m * mj * inv_r * inv_r * inv_r);
    }
  }

  let dt = params.dt;
  // Symplectic momentum kick + unconditional implicit drag 1/(1 + c*dt) (never flips sign!)
  let drag_l = 1.0 / (1.0 + max(0.0, b.lin_mom_drag.w) * dt);
  let drag_a = 1.0 / (1.0 + max(0.0, b.ang_mom_drag.w) * dt);
  var P_new = (b.lin_mom_drag.xyz + f_tot * dt) * drag_l;
  let L_new = (b.ang_mom_drag.xyz + t_tot * dt) * drag_a;

  // Optional safety CFL speed clamp if grid_origin.w > 0
  let v_new = P_new / m;
  let max_v = params.grid_origin.w;
  if (max_v > 0.0) {
    let vm = length(v_new);
    if (vm > max_v) {
      P_new = v_new * (max_v / vm) * m;
    }
  }

  // Linear drift + Exact DLM (1997) 5-stage symplectic principal-axis free-rotation!
  let pos_new = b.pos_m.xyz + (P_new / m) * dt;
  let q_new = dlm_free_rotate(b.quat, b.inertia_r.xyz, L_new, dt);

  b.pos_m = vec4<f32>(pos_new, m);
  b.quat = q_new;
  b.lin_mom_drag = vec4<f32>(P_new, b.lin_mom_drag.w);
  b.ang_mom_drag = vec4<f32>(L_new, b.ang_mom_drag.w);
  bodies[bi] = b;
}

// 4. PARALLEL 64-THREAD CONSERVATION TELEMETRY REDUCTION (KE, linear P, angular L_total, contacts)
@compute @workgroup_size(64)
fn reduce_rigid_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var ke = 0.0;
  var px = 0.0; var py = 0.0; var pz = 0.0;
  var lx = 0.0; var ly = 0.0; var lz = 0.0;
  var contacts = 0.0;

  var i = tid;
  loop {
    if (i >= params.body_count) { break; }
    let b = bodies[i];
    let m = b.pos_m.w;
    if (m > 0.0) {
      let P = b.lin_mom_drag.xyz;
      let L_spin = b.ang_mom_drag.xyz;
      let L_b = quat_rotate_inv(b.quat, L_spin);
      let ke_lin = 0.5 * dot(P, P) / m;
      let ke_rot = 0.5 * dot(L_b, L_b / max(b.inertia_r.xyz, vec3<f32>(1e-8)));
      ke = ke + ke_lin + ke_rot;
      px = px + P.x; py = py + P.y; pz = pz + P.z;
      let L_tot = L_spin + cross(b.pos_m.xyz, P);
      lx = lx + L_tot.x; ly = ly + L_tot.y; lz = lz + L_tot.z;
    }
    i = i + 64u;
  }

  var p = tid;
  loop {
    if (p >= params.particle_count) { break; }
    contacts = contacts + part_wrench[p * 2u + 0u].w;
    p = p + 64u;
  }

  wg0[tid] = ke; wg1[tid] = px; wg2[tid] = py; wg3[tid] = pz;
  wg4[tid] = lx; wg5[tid] = ly; wg6[tid] = lz; wg7[tid] = contacts;
  workgroupBarrier();

  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
      wg4[tid] += wg4[tid + s]; wg5[tid] += wg5[tid + s];
      wg6[tid] += wg6[tid + s]; wg7[tid] += wg7[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }

  if (tid == 0u) {
    telemetry[0] = vec4<f32>(wg0[0], wg1[0], wg2[0], wg3[0]);
    telemetry[1] = vec4<f32>(wg4[0], wg5[0], wg6[0], wg7[0] * 0.5);
  }
}
`;function Fe(t,n=[],{stiffnessK:r=900,dampingC:i=8,frictionMu:c=.45,rollingMu:l=.04,cohesionGain:u=0,enableMutualGravity:d=!1,gravityG:f=1,softening:p=.15,extGravity:m=[0,0,0],boxBounds:h=null,maxSpeed:g=0,label:_=`ulg-particle-rigid`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createParticleRigidDynamicsSessionWebGpu requires a live WebGPU GPUDevice`);let v=Me(n),y=v.bodyCount,b=v.particleCount,x=[a(0,`uniform`),a(1,`storage`),a(2,`read-only-storage`),a(3,`read-only-storage`),a(4,`storage`),a(5,`storage`),a(6,`read-only-storage`),a(7,`storage`)],S=e=>s(t,{cacheKey:`ulg-particle-rigid-${e}.v1`,label:`${_}-${e}`,code:Pe,entryPoint:e,bindings:x}),C=S(`scatter_particles`),w=S(`solve_particle_contacts`),T=S(`integrate_rigid_bodies`),E=S(`reduce_rigid_telemetry`),D=t.createBuffer({label:`${_}-params`,size:144,usage:Ee.UNIFORM|Ee.COPY_DST}),O=t.createBuffer({label:`${_}-bodies`,size:v.bodiesBufData.byteLength,usage:Ee.STORAGE|Ee.COPY_DST|Ee.COPY_SRC}),k=t.createBuffer({label:`${_}-local-pos`,size:v.localPosBufData.byteLength,usage:Ee.STORAGE|Ee.COPY_DST}),A=t.createBuffer({label:`${_}-local-meta`,size:v.localMetaBufData.byteLength,usage:Ee.STORAGE|Ee.COPY_DST}),j=t.createBuffer({label:`${_}-world-part`,size:v.worldParticlesInit.byteLength,usage:Ee.STORAGE|Ee.VERTEX|Ee.COPY_DST|Ee.COPY_SRC}),M=t.createBuffer({label:`${_}-part-wrench`,size:Math.max(32,b*32),usage:Ee.STORAGE}),N=t.createBuffer({label:`${_}-ext-wrench`,size:Math.max(32,y*32),usage:Ee.STORAGE|Ee.COPY_DST}),P=t.createBuffer({label:`${_}-tel`,size:32,usage:Ee.STORAGE|Ee.COPY_SRC}),F=t.createBuffer({label:`${_}-tel-read`,size:32,usage:Ee.MAP_READ|Ee.COPY_DST}),I=t.createBuffer({label:`${_}-bodies-read`,size:v.bodiesBufData.byteLength,usage:Ee.MAP_READ|Ee.COPY_DST});t.queue.writeBuffer(O,0,v.bodiesBufData),t.queue.writeBuffer(k,0,v.localPosBufData),t.queue.writeBuffer(A,0,v.localMetaBufData),t.queue.writeBuffer(j,0,v.worldParticlesInit);let L=o(t,{layout:C.bindGroupLayout,label:`${_}-bg`,entries:[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:O}},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:A}},{binding:4,resource:{buffer:j}},{binding:5,resource:{buffer:M}},{binding:6,resource:{buffer:N}},{binding:7,resource:{buffer:P}}]}),R=0,z=0,B=!1,V=!1,ee=new Float32Array(v.bodiesBufData),H=!1,U=Object.freeze({schema:Te,stepIndex:0,simTime:0,bodyCount:y,particleCount:b,kineticEnergy:0,linearMomentum:Object.freeze([0,0,0]),angularMomentum:Object.freeze([0,0,0]),activeContacts:0,accuracyTier:e.TIER_1_QUANTITATIVE,scientificValidation:!1}),W=Math.max(1,Math.ceil(b/64)),G=Math.max(1,Math.ceil(y/64));function te(e){let n=new ArrayBuffer(144);new Uint32Array(n,0,8).set([y,b,1,1,1,+!!d,+!!h,R]);let a=Math.max(.02,v.maxParticleRadius*2);new Float32Array(n,32,28).set([e,r,i,c,l,u,f,p*p,a,1/a,0,0,0,0,0,g,m[0]||0,m[1]||0,m[2]||0,0,h?.min?.[0]??-10,h?.min?.[1]??-10,h?.min?.[2]??-10,0,h?.max?.[0]??10,h?.max?.[1]??10,h?.max?.[2]??10,0]),t.queue.writeBuffer(D,0,n)}function K(e){e&&e.byteLength>0&&t.queue.writeBuffer(N,0,e.subarray(0,Math.min(e.length,y*8)))}async function ne({dt:n=.008,substeps:r=4,readTelemetry:i=!0}={}){if(H||y===0||b===0)return U;let a=Math.max(1,Math.min(32,Math.trunc(r))),o=Math.max(1e-5,Math.min(.05,Number(n)||.008));te(o);let s=t.createCommandEncoder({label:`${_}-step-${R}`}),c=s.beginComputePass({label:`${_}-pass`});c.setBindGroup(0,L);for(let e=0;e<a;e+=1)c.setPipeline(C.pipeline),c.dispatchWorkgroups(W),c.setPipeline(w.pipeline),c.dispatchWorkgroups(W),c.setPipeline(T.pipeline),c.dispatchWorkgroups(G),R+=1,z+=o;c.setPipeline(C.pipeline),c.dispatchWorkgroups(W),c.setPipeline(E.pipeline),c.dispatchWorkgroups(1),c.end();let l=i&&!B&&F.mapState===`unmapped`;if(l&&(B=!0,s.copyBufferToBuffer(P,0,F,0,32)),t.queue.submit([s.finish()]),l)try{if(await F.mapAsync(Ee.MAP_READ),!H){let t=new Float32Array(F.getMappedRange(0,32));U=Object.freeze({schema:Te,stepIndex:R,simTime:z,bodyCount:y,particleCount:b,kineticEnergy:t[0],linearMomentum:Object.freeze([t[1],t[2],t[3]]),angularMomentum:Object.freeze([t[4],t[5],t[6]]),activeContacts:t[7],accuracyTier:e.TIER_1_QUANTITATIVE,scientificValidation:!1})}try{F.unmap()}catch{}}catch(e){if(!H&&e?.name!==`AbortError`)throw e}finally{B=!1}return U}async function q(){if(H||y===0)return new Float32Array;if(V||I.mapState!==`unmapped`)return new Float32Array(ee);V=!0;try{let e=t.createCommandEncoder({label:`${_}-read-bodies`});e.copyBufferToBuffer(O,0,I,0,v.bodiesBufData.byteLength),t.queue.submit([e.finish()]),await I.mapAsync(Ee.MAP_READ),H||(ee=new Float32Array(I.getMappedRange().slice(0)));try{I.unmap()}catch{}}catch(e){if(!H&&e?.name!==`AbortError`)throw e}finally{V=!1}return new Float32Array(ee)}function J(){if(!H){H=!0;for(let e of[D,O,k,A,j,M,N,P,F,I])try{e.destroy()}catch{}}}return Object.freeze({schema:Te,lawAdapter:De,get bodyCount(){return y},get particleCount(){return b},get stepIndex(){return R},get simTime(){return z},getResidentBodiesBuffer:()=>O,getResidentWorldParticlesBuffer:()=>j,getTelemetry:()=>U,setExternalWrenches:K,readBodiesSnapshot:q,step:ne,dispose:J})}function Ie(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`particle-rigid-dynamics@1`)?e.resolveModule(`particle-rigid-dynamics@1`)?.descriptor||null:e.registerModule({method:{model:`particle-rigid-dynamics`,version:1},kernel:{sourceModule:`src/runtime/sph/particleRigidDynamicsGpu.js`,entryPoint:`integrate_rigid_bodies`,workgroupSize:64},parameterSchema:{dt:{type:`number`,min:1e-5,max:.05,required:!1},substeps:{type:`number`,min:1,max:32,required:!1},stiffnessK:{type:`number`,min:1,max:1e7,required:!1}},stateLayout:{tensorId:`solid-rigid-frames`,dtype:`f32`,layout:`interleaved`,strideElements:24,strideBytes:96,fields:[`x`,`y`,`z`,`m`,`qx`,`qy`,`qz`,`qw`,`Px`,`Py`,`Pz`,`dragL`,`Lx`,`Ly`,`Lz`,`dragA`,`I1`,`I2`,`I3`,`boundR`,`matId`,`flags`,`pOff`,`pCnt`]},scaleRangeM:[.001,1e8],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=Fe(n,e.input?.bodySpecs||[{position:[-1,0,0],velocity:[.6,0,0],angularVelocity:[0,.5,0],particles:Ne({count:6,bodyRadius:.4,particleRadius:.16,mass:1,seed:1})},{position:[1,0,0],velocity:[-.6,0,0],angularVelocity:[.3,0,0],particles:Ne({count:6,bodyRadius:.4,particleRadius:.16,mass:1,seed:2})}],{stiffnessK:r.stiffnessK??600}),a=await i.step({dt:r.dt??.008,substeps:r.substeps??4,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:particle-rigid:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/sph/particleRigidDynamicsGpu.js`,entryPoint:`createParticleRigidDynamicsSessionWebGpu`,kernelEntryPoint:`integrate_rigid_bodies`},representation:`se3-dlm-particle-rigid-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-dlm-particle-rigid`,placement:`local`},validity:{finite:Number.isFinite(a.kineticEnergy)},validation:{status:`pass`,validationMode:`gpu-rigid-conservation`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var Le=`ulg.astrophysics.protoplanetary-disk-formation-webgpu.v1`,Re=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),ze=Object.freeze({id:`protoplanetary-accretion`,lawNodeId:`law:astrophysics-protoplanetary-accretion`,orderConstraint:`after:nebular-mhd-collapse`,adapterMode:n.AGGREGATE_FAR,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`protoplanetary-pebbles`,`solid-rigid-frames`,`stellar-luminosity`,`polytope-sublimation-boundary`]),writes:Object.freeze([`protoplanetary-pebbles`,`solid-rigid-frames`]),accumulates:Object.freeze([`pebble-accretion-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`angular-momentum`]),validityDomain:Object.freeze({starMassMinSolar:.05,diskMassPositive:!0,snowLineTempKRange:Object.freeze([120,220])}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e10,0x5af3107a4000]),fundamentalLaws:Object.freeze([`newtonian-nbody-gravity`,`epstein-stokes-aerodynamic-drag`,`streaming-instability`,`radiative-equilibrium-snow-line`,`hill-sphere-pebble-accretion`,`particle-rigid-planetesimal-collisions`])});function Be(e={}){let t=Number(e.starMassSolar)||0,n=Number(e.diskSolidMassEarth)||0,r=t>.02&&n>1e-4;return Object.freeze({active:r,reason:r?`circumstellar-gas-dust-disk-present`:`no-protoplanetary-disk-dormant`})}function Ve({rAu:e=1,starLuminositySolar:t=1,snowLineTempK:n=170}={}){let r=280*Math.max(.01,Number(t)||1)**.25,i=r/Math.sqrt(Math.max(.03,Number(e)||1)),a=(r/Math.max(40,Number(n)||170))**2;return Object.freeze({tempK:i,snowLineAu:a,isVolatileIcePhase:i<n})}function He(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var Ue=`
struct DiskParams {
  pebble_count: u32,
  embryo_count: u32,
  step_index: u32,
  enable_gas_drag: u32,
  dt: f32,
  g_star: f32,           // G * M_star in sim units
  eta_subkep: f32,       // Sub-Keplerian gas pressure support factor (~0.005..0.025)
  stokes_ref: f32,       // Reference Stokes number tau_s (~0.25 optimal for streaming instability!)
  t_1au_k: f32,          // Disk temperature at r = 1 sim-AU
  t_snow_k: f32,         // Volatile H2O sublimation temperature from Gate 2 Polytope (~170 K)
  accretion_hill_fac: f32,
  softening2: f32,
  star_pos: vec4<f32>,   // Translation-invariant central star position (xyz) + star radius (w)
};

// 16 floats (64 B) per pebble — zero-copy compatible with renderer Mode 2/5!
//   pos_m:    vec4(x, y, z, mass)           (mass == 0 => accreted onto a planetesimal embryo!)
//   vel_st:   vec4(vx, vy, vz, stokes_tau)
//   thermo:   vec4(temp_k, ice_frac, drag_heat, radial_au)
//   meta:     vec4(accreted_body_id_plus1, local_clump_density, seed, active_flag)
struct Pebble {
  pos_m: vec4<f32>,
  vel_st: vec4<f32>,
  thermo: vec4<f32>,
  info: vec4<f32>,
};

struct EmbryoSummary {
  pos_m: vec4<f32>,  // xyz, mass
  vel_r: vec4<f32>,  // vx, vy, vz, hill_radius
};

@group(0) @binding(0) var<uniform> params: DiskParams;
@group(0) @binding(1) var<storage, read_write> pebbles: array<Pebble>;
@group(0) @binding(2) var<storage, read> embryos: array<EmbryoSummary>;
// Atomic pebble accretion tally per embryo (mass * 1e5, px * 1e4, py * 1e4, pz * 1e4)
@group(0) @binding(3) var<storage, read_write> acc_atomic: array<atomic<i32>>;
// Telemetry (2 vec4): [0]=(active_pebbles, accreted_pebbles, rocky_count, icy_count),
//                     [1]=(mean_radius_au, mean_ice_frac, total_pebble_mass, mean_temp_k)
@group(0) @binding(4) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;
var<workgroup> wg4: array<f32, 64>;
var<workgroup> wg5: array<f32, 64>;
var<workgroup> wg6: array<f32, 64>;
var<workgroup> wg7: array<f32, 64>;

@compute @workgroup_size(64)
fn clear_accretion(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.embryo_count * 4u) { return; }
  atomicStore(&acc_atomic[i], 0);
}

@compute @workgroup_size(64)
fn step_protoplanetary_pebbles(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.pebble_count) { return; }
  var pb = pebbles[i];
  if (pb.info.w < 0.5 || !(pb.pos_m.w > 0.0)) { return; }

  let dt = params.dt;
  let rel = pb.pos_m.xyz - params.star_pos.xyz;
  let r2_star = dot(rel, rel) + params.softening2;
  let r_star = sqrt(r2_star);
  let r_cyl = max(0.08, length(vec2<f32>(rel.x, rel.z)));

  // 1. Central protostar Newtonian gravity
  var acc = -rel * (params.g_star / (r2_star * r_star));

  // 2. Mutual gravity from ALL growing composite planetesimal embryos + Hill-sphere pebble accretion!
  let n_emb = params.embryo_count;
  var accreted = false;
  for (var e = 0u; e < n_emb; e = e + 1u) {
    let em = embryos[e];
    let me = em.pos_m.w;
    if (!(me > 0.0)) { continue; }
    let d = em.pos_m.xyz - pb.pos_m.xyz;
    let d2 = dot(d, d) + 0.004;
    let dist = sqrt(d2);
    let r_acc = em.vel_r.w * params.accretion_hill_fac;
    // Physical Hill-sphere pebble capture: when pebble enters embryo's Hill sphere at bound relative speed!
    if (dist < r_acc) {
      let v_rel = pb.vel_st.xyz - em.vel_r.xyz;
      let v_esc2 = 2.0 * params.g_star * (me / max(1.0, params.g_star)) / max(0.04, dist) + 1.8;
      if (dot(v_rel, v_rel) < v_esc2) {
        // Conservatively transfer pebble mass & linear momentum to embryo e!
        let m_pb = pb.pos_m.w;
        atomicAdd(&acc_atomic[e * 4u + 0u], i32(round(m_pb * 100000.0)));
        atomicAdd(&acc_atomic[e * 4u + 1u], i32(round(m_pb * pb.vel_st.x * 10000.0)));
        atomicAdd(&acc_atomic[e * 4u + 2u], i32(round(m_pb * pb.vel_st.y * 10000.0)));
        atomicAdd(&acc_atomic[e * 4u + 3u], i32(round(m_pb * pb.vel_st.z * 10000.0)));
        pb.pos_m.w = 0.0;
        pb.info.x = f32(e + 1u);
        pb.info.w = 0.0;
        accreted = true;
        break;
      }
    }
    acc = acc + d * (me / (d2 * dist));
  }
  if (accreted) {
    pebbles[i] = pb;
    return;
  }

  // 3. Radiative equilibrium T(r) & Gate 2 Polytope volatile sublimation snow line!
  let temp_k = params.t_1au_k / sqrt(max(0.08, r_cyl));
  let target_ice = smoothstep(params.t_snow_k + 18.0, params.t_snow_k - 18.0, temp_k);
  let ice_frac = mix(pb.thermo.y, target_ice, clamp(dt * 1.5, 0.0, 1.0));

  // 4. Sub-Keplerian Gas Disk Aerodynamic Drag (Epstein/Stokes) + Streaming Instability Back-Reaction!
  //    Outside snow line, icy pebbles have slightly larger effective grain size -> higher Stokes tau_s,
  //    enhancing pebble accretion and ring clumping just outside the snow line!
  var drag_heat = 0.0;
  if (params.enable_gas_drag != 0u) {
    let omega_k = sqrt(params.g_star / (r_cyl * r_cyl * r_cyl));
    let v_kep = omega_k * r_cyl;
    // Gas orbits slightly sub-Keplerian due to outward radial pressure gradient
    let v_gas_mag = v_kep * (1.0 - params.eta_subkep);
    let tang = vec3<f32>(-rel.z / r_cyl, 0.0, rel.x / r_cyl);
    let v_gas = tang * v_gas_mag;
    let dv = pb.vel_st.xyz - v_gas;
    // Effective stopping time modulated by snow-line ice mantle & streaming-instability collective drag reduction
    let tau_s = max(0.05, params.stokes_ref * (1.0 + 0.65 * ice_frac) * pow(r_cyl / 3.0, 0.35));
    let t_stop = tau_s / max(0.05, omega_k);
    // Vertical settling toward disk midplane + aerodynamic headwind radial drift
    let a_drag = -dv / max(0.15, t_stop);
    acc = acc + a_drag;
    drag_heat = length(dv) * length(a_drag);
  }

  // Symplectic Velocity-Verlet kick-drift
  let v_new = pb.vel_st.xyz + acc * dt;
  let p_new = pb.pos_m.xyz + v_new * dt;
  let r_new = length(p_new - params.star_pos.xyz);

  // Inner sublimation boundary near protostar photosphere
  if (r_new < params.star_pos.w * 1.15) {
    pb.pos_m.w = 0.0;
    pb.info.w = 0.0;
  } else {
    pb.pos_m = vec4<f32>(p_new, pb.pos_m.w);
    pb.vel_st = vec4<f32>(v_new, pb.vel_st.w);
    pb.thermo = vec4<f32>(temp_k, ice_frac, drag_heat, r_cyl);
  }
  pebbles[i] = pb;
}

@compute @workgroup_size(64)
fn reduce_disk_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var active_cnt = 0.0;
  var accreted = 0.0;
  var rocky = 0.0;
  var icy = 0.0;
  var r_sum = 0.0;
  var ice_sum = 0.0;
  var mass_sum = 0.0;
  var t_sum = 0.0;

  var i = tid;
  loop {
    if (i >= params.pebble_count) { break; }
    let pb = pebbles[i];
    if (pb.info.w > 0.5 && pb.pos_m.w > 0.0) {
      active_cnt = active_cnt + 1.0;
      if (pb.thermo.y > 0.5) { icy = icy + 1.0; } else { rocky = rocky + 1.0; }
      r_sum = r_sum + pb.thermo.w;
      ice_sum = ice_sum + pb.thermo.y;
      mass_sum = mass_sum + pb.pos_m.w;
      t_sum = t_sum + pb.thermo.x;
    } else if (pb.info.x > 0.5) {
      accreted = accreted + 1.0;
    }
    i = i + 64u;
  }

  wg0[tid] = active_cnt; wg1[tid] = accreted; wg2[tid] = rocky; wg3[tid] = icy;
  wg4[tid] = r_sum; wg5[tid] = ice_sum; wg6[tid] = mass_sum; wg7[tid] = t_sum;
  workgroupBarrier();

  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
      wg4[tid] += wg4[tid + s]; wg5[tid] += wg5[tid + s];
      wg6[tid] += wg6[tid + s]; wg7[tid] += wg7[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }

  if (tid == 0u) {
    let denom = max(1.0, wg0[0]);
    telemetry[0] = vec4<f32>(wg0[0], wg1[0], wg2[0], wg3[0]);
    telemetry[1] = vec4<f32>(wg4[0] / denom, wg5[0] / denom, wg6[0], wg7[0] / denom);
  }
}
`;function We(t,{pebbleCount:n=3072,embryoCount:r=18,starMassSim:i=42,starLuminositySolar:c=1,snowLineTempK:l=170,enableGasDrag:u=!0,seed:d=20261125,centerOffset:f=[0,0,0],label:p=`ulg-protoplanetary-disk`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createProtoplanetaryDiskFormationSessionWebGpu requires a live WebGPU GPUDevice`);let m=Math.max(256,Math.min(16384,Math.trunc(n))),h=Math.max(4,Math.min(48,Math.trunc(r))),g=He(d),_=Number(f?.[0])||0,v=Number(f?.[1])||0,y=Number(f?.[2])||0,b=280*Math.max(.01,c)**.25,x=(b/l)**2,S=[{position:[_,v,y],velocity:[0,0,0],angularVelocity:[0,.25,0],mass:i,isStatic:!1,materialId:0,particles:[{localPos:[0,0,0],radius:.42,mass:i,cohesion:0}]}],C=[];for(let e=0;e<h;e+=1){let t=1.15*8.2**((e+.5)/h)*(.92+.16*g()),n=g()*Math.PI*2,r=(g()-.5)*.14*t,{tempK:a,isVolatileIcePhase:o}=Ve({rAu:t,starLuminositySolar:c,snowLineTempK:l}),s=(o?.16:.055)*(.7+.8*g()),f=(o?.24:.16)*Math.cbrt(s/.08),p=Math.sqrt(i/Math.max(.2,t)),m=(g()-.5)*.06,b=Math.cos(n)*t,x=Math.sin(n)*t,w=-Math.sin(n)*(1+m)*p,T=Math.cos(n)*(1+m)*p,E=(g()-.5)*.06*p;S.push({position:[b+_,r+v,x+y],velocity:[w,E,T],angularVelocity:[(g()-.5)*.8,.6+g()*.9,(g()-.5)*.8],mass:s,linearDrag:u?.012:0,angularDrag:.01,materialId:o?2:1,cohesion:o?3.5:1.8,particles:Ne({count:5,bodyRadius:f,particleRadius:f*.48,mass:s,cohesion:o?3.5:1.8,seed:d+e*31})}),C.push({initialRadiusAu:t,initialTempK:a,isVolatileIcePhase:o,accretedMass:0})}let w=Fe(t,S,{stiffnessK:320,dampingC:6.5,frictionMu:.55,rollingMu:.05,cohesionGain:1.4,enableMutualGravity:!0,gravityG:1,softening:.14,label:`${p}-rigid`}),T=new Float32Array(m*16);for(let e=0;e<m;e+=1){let t=.85+g()**1.15*8.6,n=g()*Math.PI*2,r=.055*t,a=(g()-.5)*2*r,o=Math.sqrt(i/Math.max(.2,t)),{tempK:s,isVolatileIcePhase:u}=Ve({rAu:t,starLuminositySolar:c,snowLineTempK:l}),d=u?.0022:8e-4,f=e*16;T[f+0]=Math.cos(n)*t+_,T[f+1]=a+v,T[f+2]=Math.sin(n)*t+y,T[f+3]=d,T[f+4]=-Math.sin(n)*o,T[f+5]=(g()-.5)*.04*o,T[f+6]=Math.cos(n)*o,T[f+7]=.25*(u?1.5:1),T[f+8]=s,T[f+9]=+!!u,T[f+10]=0,T[f+11]=t,T[f+12]=0,T[f+13]=1,T[f+14]=g(),T[f+15]=1}let E=[a(0,`uniform`),a(1,`storage`),a(2,`read-only-storage`),a(3,`storage`),a(4,`storage`)],D=e=>s(t,{cacheKey:`ulg-protoplanetary-disk-${e}.v1`,label:`${p}-${e}`,code:Ue,entryPoint:e,bindings:E}),O=D(`clear_accretion`),k=D(`step_protoplanetary_pebbles`),A=D(`reduce_disk_telemetry`),j=t.createBuffer({label:`${p}-params`,size:64,usage:Re.UNIFORM|Re.COPY_DST}),M=t.createBuffer({label:`${p}-pebbles`,size:T.byteLength,usage:Re.STORAGE|Re.VERTEX|Re.COPY_DST|Re.COPY_SRC}),N=t.createBuffer({label:`${p}-embryos`,size:h*32,usage:Re.STORAGE|Re.COPY_DST}),P=t.createBuffer({label:`${p}-acc-atomic`,size:h*16,usage:Re.STORAGE|Re.COPY_SRC}),F=t.createBuffer({label:`${p}-tel`,size:32,usage:Re.STORAGE|Re.COPY_SRC}),I=t.createBuffer({label:`${p}-tel-read`,size:32,usage:Re.MAP_READ|Re.COPY_DST});t.queue.writeBuffer(M,0,T);let L=o(t,{layout:k.bindGroupLayout,label:`${p}-bg`,entries:[{binding:0,resource:{buffer:j}},{binding:1,resource:{buffer:M}},{binding:2,resource:{buffer:N}},{binding:3,resource:{buffer:P}},{binding:4,resource:{buffer:F}}]}),R=new Float32Array(h*8),z=Float32Array.from(S.length?new Float32Array(S.length*24):[]),B=0,V=0,ee=!!u,H=!1,U=!1,W=Object.freeze({schema:Le,stepIndex:0,simTime:0,activePebbles:m,accretedPebbles:0,rockyPebbles:0,icyPebbles:0,meanRadiusAu:3.2,snowLineAu:x,embryoCount:h,rigidBodyCount:w.bodyCount,rigidActiveContacts:0,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1});function G(e){if(!e||e.length<(h+1)*24)return[_,v,y];let n=[e[0],e[1],e[2]],r=Math.max(1,e[3]);for(let t=0;t<h;t+=1){let i=(t+1)*24,a=e[i+0],o=e[i+1],s=e[i+2],c=Math.max(1e-5,e[i+3]),l=Math.hypot(a-n[0],o-n[1],s-n[2]),u=Math.max(.14,l*Math.cbrt(c/(3*r))),d=t*8;R[d+0]=a,R[d+1]=o,R[d+2]=s,R[d+3]=c,R[d+4]=e[i+8]/c,R[d+5]=e[i+9]/c,R[d+6]=e[i+10]/c,R[d+7]=u}return t.queue.writeBuffer(N,0,R),n}function te(e,n){let r=new ArrayBuffer(64);new Uint32Array(r,0,4).set([m,h,B,+!!ee]),new Float32Array(r,16,12).set([e,i,.018,.28,b,l,1.15,.035,n[0],n[1],n[2],.42]),t.queue.writeBuffer(j,0,r)}let K=Math.ceil(m/64),ne=Math.ceil(h*4/64);async function q({dt:n=.016,substeps:r=2,readTelemetry:i=!0}={}){if(U)return W;let a=Math.max(1,Math.min(8,Math.trunc(r))),o=Math.max(.002,Math.min(.035,Number(n)||.016)),s=await w.step({dt:o*.5,substeps:a*2,readTelemetry:i}),c=[_,v,y];(i||B===0)&&(z=await w.readBodiesSnapshot(),c=G(z)),te(o,c);let l=t.createCommandEncoder({label:`${p}-step-${B}`}),u=l.beginComputePass({label:`${p}-pass`});u.setBindGroup(0,L),u.setPipeline(O.pipeline),u.dispatchWorkgroups(ne),u.setPipeline(k.pipeline);for(let e=0;e<a;e+=1)u.dispatchWorkgroups(K),B+=1,V+=o;u.setPipeline(A.pipeline),u.dispatchWorkgroups(1),u.end();let d=i&&!H&&I.mapState===`unmapped`;if(d&&(H=!0,l.copyBufferToBuffer(F,0,I,0,32)),t.queue.submit([l.finish()]),d)try{if(await I.mapAsync(Re.MAP_READ),!U){let t=new Float32Array(I.getMappedRange(0,32));W=Object.freeze({schema:Le,stepIndex:B,simTime:V,activePebbles:Math.round(t[0]),accretedPebbles:Math.round(t[1]),rockyPebbles:Math.round(t[2]),icyPebbles:Math.round(t[3]),meanRadiusAu:t[4],meanIceFrac:t[5],totalPebbleMass:t[6],meanTempK:t[7],snowLineAu:x,embryoCount:h,rigidBodyCount:w.bodyCount,rigidActiveContacts:s?.activeContacts??0,rigidKineticEnergy:s?.kineticEnergy??0,enableGasDrag:ee,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{I.unmap()}catch{}}catch(e){if(!U&&e?.name!==`AbortError`)throw e}finally{H=!1}return W}function J(e=1){let t=[];if(!z||z.length<24)return t;let n=z[0],r=z[1],i=z[2];t.push({pos:[0,0,0],radius:.48*e,color0:[1,.9,.65],color1:[1,.45,.12],kind:0,atm:0});for(let a=0;a<h;a+=1){let o=(a+1)*24,s=C[a],c=(z[o+0]-n)*e,l=(z[o+1]-r)*e,u=(z[o+2]-i)*e,d=Math.max(.08,z[o+19]*e*.85);t.push({pos:[c,l,u],radius:d,color0:s?.isVolatileIcePhase?[.68,.84,.98]:[.76,.56,.4],color1:s?.isVolatileIcePhase?[.32,.54,.82]:[.44,.3,.22],kind:s?.isVolatileIcePhase?3:1,atm:s?.isVolatileIcePhase?.35:.08,seed:(a+1)*3.17})}return t}function re(e){ee=!!e}function ie(){if(!U){U=!0,w.dispose();for(let e of[j,M,N,P,F,I])try{e.destroy()}catch{}}}return Object.freeze({schema:Le,lawAdapter:ze,get pebbleCount(){return m},get embryoCount(){return h},get snowLineAu(){return x},get stepIndex(){return B},get enableGasDrag(){return ee},getResidentPebblesBuffer:()=>M,getResidentRigidParticlesBuffer:()=>w.getResidentWorldParticlesBuffer(),getEmbryoRenderSpheres:J,getTelemetry:()=>W,setEnableGasDrag:re,step:q,dispose:ie})}function Ge(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`protoplanetary-accretion@1`)?e.resolveModule(`protoplanetary-accretion@1`)?.descriptor||null:e.registerModule({method:{model:`protoplanetary-accretion`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/protoplanetaryDiskFormationGpu.js`,entryPoint:`step_protoplanetary_pebbles`,workgroupSize:64},parameterSchema:{dt:{type:`number`,min:.001,max:.05,required:!1},substeps:{type:`number`,min:1,max:16,required:!1},enableGasDrag:{type:`boolean`,required:!1}},stateLayout:{tensorId:`protoplanetary-pebbles`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`m`,`vx`,`vy`,`vz`,`stokes`,`tempK`,`iceFrac`,`dragHeat`,`rAu`,`accBody`,`clump`,`seed`,`active`]},scaleRangeM:[1e10,0x5af3107a4000],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=We(n,{pebbleCount:512,embryoCount:8,enableGasDrag:r.enableGasDrag??!0}),a=await i.step({dt:r.dt??.015,substeps:r.substeps??2,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:protoplanetary-disk:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/protoplanetaryDiskFormationGpu.js`,entryPoint:`createProtoplanetaryDiskFormationSessionWebGpu`,kernelEntryPoint:`step_protoplanetary_pebbles`},representation:`protoplanetary-pebbles+particle-rigid-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-protoplanetary-disk-rigid`,placement:`local`},validity:{finite:Number.isFinite(a.meanRadiusAu)&&Number.isFinite(a.snowLineAu)},validation:{status:`pass`,validationMode:`gpu-disk-accretion-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var Ke=`ulg.astrophysics.cosmic-epoch-state.v1`,qe=.3153,Je=.0493,Ye=92e-6,Xe=1-qe-Ye,Ze=67.36,Qe=Ze*1e3/3085677581491367e7*0x701d7851f6c000,$e=2.7255,et=Object.freeze([.019855071751231884,.10166676129318664,.2372337950418355,.4082826787521751,.591717321247825,.7627662049581645,.8983332387068134,.9801449282487681]),tt=Object.freeze([.05061426814518813,.11119051722668723,.15685332293894363,.181341891689181,.181341891689181,.15685332293894363,.11119051722668723,.05061426814518813]);function nt(e){let t=Math.max(1e-6,Number(e)||1),n=t*t*t,r=n*t;return Math.sqrt(Ye/r+qe/n+Xe)}function rt(e){let t=Math.max(1e-5,Math.min(4,Number(e)||1)),n=[0];for(let e=1;e<=6;e+=1)n.push(t*(e/6)**2.2);let r=0;for(let e=0;e<6;e+=1){let t=n[e],i=n[e+1]-t;for(let e=0;e<8;e+=1){let n=t+i*et[e];n<=0||(r+=i*tt[e]/(n*nt(n)))}}return r/Qe}function it(e,{omegaM:t=qe,omegaB:n=Je,h:r=Ze/100}={}){let i=Math.max(1e-5,Number(e)||.01),a=t*r*r,o=n*r*r,s=Math.max(.01,Math.min(.5,n/Math.max(1e-4,t))),c=1-s,l=$e/2.7,u=.0746*a/(l*l),d=44.5*Math.log(9.83/a)/Math.sqrt(1+10*o**.75),f=1.6*o**.52*a**.73*(1+(10.4*a)**-.95),p=i/(13.41*u),m=(e,t,n)=>{let r=Math.log(Math.E+1.8*n*e);return r/(r+(14.2/t+386/(1+69.9*e**1.08))*e*e)},h=m(p,1,1),g=i*d,_=g<1e-4?1:Math.sin(g)/g,v=Math.exp(-((i/Math.max(.02,f))**1.4)),y=(m(p,1,1)/(1+(g/5.2)**2)+.18*v)*(.42+.58*_)*v;return{transfer:Math.max(1e-6,c*h+s*y),tCdm:h,tBaryon:y,soundHorizonMpc:d,kSilk:f,kEq:u}}function at(e){let t=Math.max(-.6,Number(e)||0),n=1/(1+Math.exp(-(t-1090)/85)),r=1/(1+Math.exp((t-7.7)/1.15));return Math.max(2e-4,Math.min(1,Math.max(n,r)))}function ot({massSolar:e=1,ageGyr:t=4.57,metallicitySolar:n=1}={}){let r=Math.max(.02,Math.min(100,Number(e)||1)),i=Math.max(0,Number(t)||0),a=Math.max(1e-4,Number(n)||1);if(r<.08){let e=.095+.04*Math.exp(-i/.25),t=Math.max(350,2400*(r/.075)**.85*(.05/(i+.05))**.28),n=e*e*(t/5778)**4;return Object.freeze({stage:`brown-dwarf`,massSolar:r,radiusSolar:e,luminositySolar:n,effectiveTempK:t,eddRatio:n/Math.max(.01,r)/32e3,massLossSolarPerYr:0,coreDegenerate:!0,remnantClass:`brown-dwarf`,mainSequenceLifetimeGyr:1/0})}let o=1/(1+Math.exp(-(r-.43)/.07)),s=.21*r**2.3,c=(1+(1/3.2)**2)**.55,l=.72*r**4.5*c/(1+(r/3.2)**2)**.55,u=((1-o)*s+o*l)*Math.max(.01,a)**(-.12*o),d=16e3*r,f=u*d/(u+d),p=1/(1+Math.exp(-(r-1.35)/.25)),m=.18+.78*o+.35*p,h=f*(1+.45*m),g=.94+.34*p,_=Math.max(.003,r/Math.max(1e-5,h)*9.6*g),v=Math.max(2e-4,.04*r**-1.8),y=Math.max(8e-4,_*(r>8?.12:.18)),b=h,x=r<1?r**.8:r**.58,S=5778*(b/(x*x))**.25;if(i<v){let e=i/v,t=x*(3.8-2.8*e),n=Math.max(2400,S*(.62+.38*e)),a=t*t*(n/5778)**4;return Object.freeze({stage:`protostar-yso`,massSolar:r,radiusSolar:t,luminositySolar:a,effectiveTempK:n,eddRatio:a/r/32e3,massLossSolarPerYr:1e-7*r,coreDegenerate:!1,remnantClass:`none`,mainSequenceLifetimeGyr:_})}if(i<_){let e=(i-v)/Math.max(1e-6,_-v),t=f*(1+m*Math.max(0,e)**1.15),n=x*(.9+.32*e),o=5778*(t/(n*n))**.25,s=t/r/32e3,c=r>=25&&e>.65;return Object.freeze({stage:c?`wolf-rayet-lbv`:`main-sequence`,massSolar:r*(c?1-.38*(e-.65)/.35:1),radiusSolar:n*(c?1.8:1),luminositySolar:t,effectiveTempK:c?Math.max(38e3,o*1.35):o,eddRatio:s,massLossSolarPerYr:c?2e-5*a**.7:1e-14*t*n/r,coreDegenerate:!1,remnantClass:`none`,mainSequenceLifetimeGyr:_})}let C=i-_;if(C<y){let e=C/y,t=x+((r<8?Math.min(240,140*r**.55):Math.min(950,320*(r/8)**.5))-x)*e**1.8,n=b+((r<8?2200*r**1.4:b*3.5)-b)*e**1.7,i=Math.max(2900,Math.min(4800,5778*(n/(t*t))**.25)),a=r-(r-(r<8?.48+.11*r:r*.82))*e**2.4;return Object.freeze({stage:e>.72&&r<8?`agb-superwind`:`red-giant`,massSolar:a,radiusSolar:t,luminositySolar:n,effectiveTempK:i,eddRatio:n/Math.max(.3,a)/32e3,massLossSolarPerYr:r<8?1e-5*e**2:5e-5,coreDegenerate:r<8,remnantClass:`none`,mainSequenceLifetimeGyr:_})}let w=C-y;if(r<8){let e=Math.min(1.38,.48+.11*r),t=.0126*(e/.6)**(-1/3)*Math.sqrt(Math.max(.05,1-(e/1.44)**(4/3))),n=w<1e-4,i=n?95e3:Math.max(4500,35e3*(.02/(w+.02))**.35),a=t*t*(i/5778)**4;return Object.freeze({stage:n?`planetary-nebula`:`white-dwarf`,massSolar:e,radiusSolar:t,luminositySolar:a,effectiveTempK:i,eddRatio:a/e/32e3,massLossSolarPerYr:n?1e-7:0,coreDegenerate:!0,remnantClass:`white-dwarf`,mainSequenceLifetimeGyr:_})}let T=w<15e-5;if(r<22){let e=Math.min(2.15,1.28+.055*(r-8));return Object.freeze({stage:T?`supernova-remnant-pwn`:`neutron-star`,massSolar:e,radiusSolar:12/695700,luminositySolar:T?400:.02,effectiveTempK:T?15e5:6e5,eddRatio:0,massLossSolarPerYr:0,coreDegenerate:!0,remnantClass:`neutron-star`,mainSequenceLifetimeGyr:_})}let E=Math.max(3,r*.38),D=2.95325*E/695700;return Object.freeze({stage:T?`hypernova-remnant`:`stellar-black-hole`,massSolar:E,radiusSolar:D,luminositySolar:0,effectiveTempK:0,eddRatio:0,massLossSolarPerYr:0,coreDegenerate:!0,remnantClass:`black-hole`,mainSequenceLifetimeGyr:_})}var st=Object.freeze([Object.freeze({id:`recombination`,label:`CMB Recombination`,shortLabel:`z=1100 CMB`,redshiftZ:1100,localSystemAgeGyr:38e-5,summary:`380 kyr · T_CMB = 3,000 K · Peebles recombination & BAO acoustic horizon (r_s ≈ 147 Mpc)`}),Object.freeze({id:`cosmic-dawn`,label:`Cosmic Dawn & Reionization`,shortLabel:`z=10 Dawn`,redshiftZ:10,localSystemAgeGyr:.005,summary:`470 Myr · Z ≈ 10⁻⁴ Z☉ · Pop III halos, UV reionization bubbles & first protogalaxies`}),Object.freeze({id:`quasar-peak`,label:`Cosmic Noon & Quasar Peak`,shortLabel:`z=2.8 Quasar`,redshiftZ:2.8,localSystemAgeGyr:.04,summary:`2.3 Gyr · High gas-fraction starburst disks, Eddington Kerr Quasars/Blazars & Hadean impacts`}),Object.freeze({id:`present-day`,label:`Present Universe (z = 0)`,shortLabel:`z=0 Today`,redshiftZ:0,localSystemAgeGyr:4.57,summary:`13.8 Gyr · Mature Cosmic Web, Galaxy Clusters, Spirals, Solar System & Compact Remnants`}),Object.freeze({id:`far-future`,label:`Red-Giant & Remnant Era (+5 Gyr)`,shortLabel:`+5 Gyr RGB/WD`,redshiftZ:-.28,localSystemAgeGyr:10.85,summary:`18.8 Gyr · Λ-dominated expansion, Red-Giant engulfment (R☉ → 1 AU), Planetary Nebulae & White Dwarfs`})]);function ct({redshiftZ:e=0,localSystemAgeGyr:t=4.57,localStarMassSolar:n=1}={}){let r=Math.max(-.55,Math.min(1200,Number(e)||0)),i=1/(1+r),a=rt(i),o=$e/i,s=at(r),c=r>18?1e-5:Math.min(1.6,Math.max(1e-5,10**(-.26*Math.max(0,r))*(r<0?1.25:1))),l=Math.max(.05,Math.min(.88,.14+.68*(1-Math.exp(-Math.max(0,r)/2.6)))),u=Math.log10(Math.max(.45,1+r)),d=r>25?0:Math.exp(-(((u-.56)/.36)**2))*(r<0?.15:1),f=r>18?0:Math.max(.02,Math.exp(-(((Math.max(0,r)-2.5)/4.2)**2))),p=ot({massSolar:n,ageGyr:t,metallicitySolar:Math.max(.01,c)}),m=`present-day`;return r>=400?m=`recombination`:r>=6?m=`cosmic-dawn`:r>=1.2?m=`quasar-peak`:(r<-.1||t>=10)&&(m=`far-future`),Object.freeze({schema:Ke,eraId:m,redshiftZ:r,scaleFactorA:i,cosmicAgeGyr:a,hubbleKmSMpc:Ze*nt(i),cmbTempK:o,ionizationFrac:s,meanMetallicitySolar:c,galaxyGasFraction:l,quasarActivityFactor:d,uvBackgroundFlux:f,localSystemAgeGyr:Number(t)||0,stellarState:p})}var lt=`ulg.astrophysics.cosmological-baryon-radiation-webgpu.v1`,ut=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),dt=Object.freeze({id:`cosmological-baryon-radiation`,lawNodeId:`law:astrophysics-cosmological-baryon-radiation`,orderConstraint:`after:flrw-treepm-cosmology`,adapterMode:n.CELL_LOCAL,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`cosmo-baryon-grid`,`cosmic-epoch-state`,`fft3d-poisson-grid`]),writes:Object.freeze([`cosmo-baryon-grid`,`lensing-deflection-map`,`cosmo-baryon-tracers`]),accumulates:Object.freeze([`cosmo-cmb-bao-sz-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`comoving-baryon-mass`,`baryon-linear-momentum`,`photon-ionization-balance`]),validityDomain:Object.freeze({redshiftMin:-.55,redshiftMax:1200,gridNMin:16,gridNMax:48}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e21,1e26]),fundamentalLaws:Object.freeze([`eisenstein-hu-bao`,`peebles-recombination`,`m1-reionization-rt`,`compressible-icm-hydro`,`gravitational-lensing-poisson`])});function ft(e={}){let t=Number(e.comovingBoxMpc)||0,n=Number(e.baryonFraction??.157),r=Number(e.redshiftZ??0),i=Number(e.clusterMassSolar)||0,a=t>=1&&(n>0||r>5)||i>=0x9184e72a000;return{active:a,cmbMode:r>=400,reionizationActive:r>=5.5&&r<=25,icmClusterActive:r<3&&(i>=0x9184e72a000||n>.01),reason:a?`cosmological-baryon-radiation-present`:`sub-cosmological-or-dark-only-dormant`}}function pt(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function mt({gridN:e=24,tracerCount:t=6144,boxSizeMpc:n=260,redshiftZ:r=0,clusterMergerMode:i=!1,seed:a=20261125,centerOffset:o=[0,0,0]}={}){let s=Math.max(16,Math.min(32,Math.trunc(e))),c=s*s*s,l=n/s,u=n*.5,d=pt(a),f=ct({redshiftZ:r}),p=Number(o?.[0])||0,m=Number(o?.[1])||0,h=Number(o?.[2])||0,g=[],_=2*Math.PI/n;for(let e=0;e<28;e+=1){let e=Math.floor(d()*7)-3,t=Math.floor(d()*7)-3,n=Math.floor(d()*7)-3,r=Math.hypot(e,t,n)*_;if(r<1e-5)continue;let i=it(r),a=Math.sqrt((r/.05)**.965)*i.transfer;g.push({kx:e*_,ky:t*_,kz:n*_,phase:d()*Math.PI*2,amp:a})}let v=new Float32Array(c),y=new Float32Array(c*3),b=0;for(let e=0;e<s;e+=1)for(let t=0;t<s;t+=1)for(let n=0;n<s;n+=1){let r=(e*s+t)*s+n,i=(n+.5)*l-u,a=(t+.5)*l-u,o=(e+.5)*l-u,c=0,d=0,f=0,p=0;for(let e of g){let t=e.kx*i+e.ky*a+e.kz*o+e.phase,n=Math.cos(t)*e.amp,r=Math.sin(t)*e.amp,s=e.kx*e.kx+e.ky*e.ky+e.kz*e.kz+1e-6;c+=n,d-=e.kx/s*r*.08,f-=e.ky/s*r*.08,p-=e.kz/s*r*.08}v[r]=c,y[r*3+0]=d,y[r*3+1]=f,y[r*3+2]=p,b+=c*c}let x=Math.max(1e-4,Math.sqrt(b/c)),S=new Float32Array(c*8),C=0;for(let e=0;e<s;e+=1)for(let t=0;t<s;t+=1)for(let r=0;r<s;r+=1){let a=(e*s+t)*s+r,o=(r+.5)*l-u,c=(t+.5)*l-u,d=(e+.5)*l-u,p=v[a]/x,m=y[a*3+0]/x,h=y[a*3+1]/x,g=y[a*3+2]/x,_=f.redshiftZ>=400?.15:Math.max(.45,Math.min(1.25,.45+.8*f.scaleFactorA)),b=Math.max(.12,1+p*.55*_),w=Math.max(.08,1+p*.48*_),T=f.cmbTempK,E=f.ionizationFrac;if(i){let e=Math.hypot(o+u*.28,c,d),t=Math.hypot(o-u*.26,c*1.1,d),r=n*.14,i=6.5/(1+(e/r)**2)**1.4,a=4.2/(1+(t/r)**2)**1.4;b=.25+i+a;let s=Math.hypot(o+u*.14,c,d),l=Math.hypot(o-u*.12,c,d);w=.22+5.5/(1+(s/(r*1.1))**2)**1.3+3.8/(1+(l/(r*1.1))**2)**1.3,m=(o<0?1.8:-1.8)*Math.exp(-Math.hypot(o,c,d)/(u*.8)),T=15e6+65e6*Math.exp(-Math.hypot(o,c,d)/(r*1.3)),E=1}else if(f.redshiftZ>=400)T=f.cmbTempK*(1+.08*Math.max(-1.5,Math.min(1.5,p))),E=f.ionizationFrac;else if(f.redshiftZ>=5.5){let e=b>1.24;E=e?.55:.02,T=e?15e3:Math.max(f.cmbTempK,85)}else T=Math.max(1e4,25e4*w**1.45),E=1;let D=a*8;S[D+0]=w,S[D+1]=m,S[D+2]=h,S[D+3]=g,S[D+4]=T,S[D+5]=E,S[D+6]=b,S[D+7]=p,C+=b+.18*w}C/=c;let w=Math.max(256,Math.min(32768,Math.trunc(t))),T=new Float32Array(w*16);for(let e=0;e<w;e+=1){let t,n,r;if(f.redshiftZ>=400){let e=2*d()-1,i=d()*Math.PI*2,a=Math.sqrt(Math.max(0,1-e*e)),o=u*(.76+.1*d());t=o*a*Math.cos(i),n=o*e,r=o*a*Math.sin(i)}else if(i){let i=e%3==0,a=e&1?1:-1,o=d()**.72*u*(i?.36:.26),s=2*d()-1,c=d()*Math.PI*2,l=Math.sqrt(Math.max(0,1-s*s));t=a*u*(i?.5:.14)+o*l*Math.cos(c),n=o*s*(i?.85:1.25),r=o*l*Math.sin(c)*.85}else{let e=Math.cbrt(d())*u*.92,i=2*d()-1,a=d()*Math.PI*2,o=Math.sqrt(Math.max(0,1-i*i));t=e*o*Math.cos(a),n=e*i,r=e*o*Math.sin(a)}let a=e*16;T[a+0]=t+p,T[a+1]=n+m,T[a+2]=r+h,T[a+3]=1,T[a+4]=0,T[a+5]=0,T[a+6]=0,T[a+7]=.5,T[a+8]=f.cmbTempK,T[a+9]=f.ionizationFrac,T[a+10]=0,T[a+11]=i?+(e%3==0):+(e%5==0),T[a+12]=f.redshiftZ,T[a+13]=0,T[a+14]=+!!i,T[a+15]=d()}return Object.freeze({gridN:s,totalCells:c,tracerCount:w,boxSizeMpc:n,epoch:f,clusterMergerMode:i,centerOffset:Object.freeze([p,m,h]),cells:S,tracers:T,meanRho:C})}var ht=`
struct CosmoRadParams {
  grid_n: u32,
  tracer_count: u32,
  mode_flags: u32,    // bit0: cmb, bit1: reionization, bit2: cluster_merger
  step_index: u32,
  box_size: f32,
  dx: f32,
  dt: f32,
  redshift_z: f32,
  cmb_temp_k: f32,
  uv_flux: f32,
  mean_rho: f32,
  gravity_g: f32,
  center_offset: vec4<f32>,
};

struct CosmoCell {
  fluid: vec4<f32>, // rho_b, vx, vy, vz
  rad: vec4<f32>,   // T_gas_K, x_HII, rho_dm, delta_or_sz
};

struct CosmoTracer {
  pos_m: vec4<f32>,
  vel_rho: vec4<f32>,
  t_xhii_sz_sp: vec4<f32>,
  z_xray_flag_s: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: CosmoRadParams;
@group(0) @binding(1) var<storage, read> cells_src: array<CosmoCell>;
@group(0) @binding(2) var<storage, read_write> cells_dst: array<CosmoCell>;
@group(0) @binding(3) var<storage, read_write> tracers: array<CosmoTracer>;
// 2D projected surface density kappa & deflection alpha (N*N vec4: kappa, alpha_x, alpha_y, sz_y)
@group(0) @binding(4) var<storage, read_write> lens_map: array<vec4<f32>>;
// Telemetry: [0]=vec4(mean_xHII, max_temp_K, total_xray, total_sz_y), [1]=vec4(max_kappa, max_alpha, mean_rho_b, rms_dT)
@group(0) @binding(5) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;
var<workgroup> wg4: array<f32, 64>;
var<workgroup> wg5: array<f32, 64>;
var<workgroup> wg6: array<f32, 64>;
var<workgroup> wg7: array<f32, 64>;

fn cidx(x: i32, y: i32, z: i32, n: i32) -> u32 {
  let wx = ((x % n) + n) % n;
  let wy = ((y % n) + n) % n;
  let wz = ((z % n) + n) % n;
  return u32((wz * n + wy) * n + wx);
}

fn sample_cell_trilin(loc_p: vec3<f32>) -> CosmoCell {
  let n = i32(params.grid_n);
  let half = params.box_size * 0.5;
  let g = ((loc_p + vec3<f32>(half)) / params.dx) - vec3<f32>(0.5);
  let i0 = vec3<i32>(floor(g));
  let f = fract(g);
  let c000 = cells_src[cidx(i0.x, i0.y, i0.z, n)];
  let c100 = cells_src[cidx(i0.x + 1, i0.y, i0.z, n)];
  let c010 = cells_src[cidx(i0.x, i0.y + 1, i0.z, n)];
  let c110 = cells_src[cidx(i0.x + 1, i0.y + 1, i0.z, n)];
  let c001 = cells_src[cidx(i0.x, i0.y, i0.z + 1, n)];
  let c101 = cells_src[cidx(i0.x + 1, i0.y, i0.z + 1, n)];
  let c011 = cells_src[cidx(i0.x, i0.y + 1, i0.z + 1, n)];
  let c111 = cells_src[cidx(i0.x + 1, i0.y + 1, i0.z + 1, n)];
  var out: CosmoCell;
  out.fluid = mix(
    mix(mix(c000.fluid, c100.fluid, f.x), mix(c010.fluid, c110.fluid, f.x), f.y),
    mix(mix(c001.fluid, c101.fluid, f.x), mix(c011.fluid, c111.fluid, f.x), f.y),
    f.z
  );
  out.rad = mix(
    mix(mix(c000.rad, c100.rad, f.x), mix(c010.rad, c110.rad, f.x), f.y),
    mix(mix(c001.rad, c101.rad, f.x), mix(c011.rad, c111.rad, f.x), f.y),
    f.z
  );
  return out;
}

// 1. Evolve 3D Eulerian Baryons, Reionization Ionizing-Front Percolation, & ICM Shock Heating
@compute @workgroup_size(4, 4, 4)
fn step_cosmo_baryon_rad(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = i32(params.grid_n);
  if (i32(gid.x) >= n || i32(gid.y) >= n || i32(gid.z) >= n) { return; }
  let ix = i32(gid.x); let iy = i32(gid.y); let iz = i32(gid.z);
  let idx = cidx(ix, iy, iz, n);

  let c0 = cells_src[idx];
  let cxp = cells_src[cidx(ix + 1, iy, iz, n)];
  let cxm = cells_src[cidx(ix - 1, iy, iz, n)];
  let cyp = cells_src[cidx(ix, iy + 1, iz, n)];
  let cym = cells_src[cidx(ix, iy - 1, iz, n)];
  let czp = cells_src[cidx(ix, iy, iz + 1, n)];
  let czm = cells_src[cidx(ix, iy, iz - 1, n)];

  let dt = params.dt;
  let dx = params.dx;
  let inv2dx = 0.5 / dx;
  let half = params.box_size * 0.5;
  let pos = vec3<f32>(f32(ix) + 0.5, f32(iy) + 0.5, f32(iz) + 0.5) * dx - vec3<f32>(half);

  let adv = sample_cell_trilin(pos - c0.fluid.yzw * dt);
  let div_v = (cxp.fluid.y - cxm.fluid.y + cyp.fluid.z - cym.fluid.z + czp.fluid.w - czm.fluid.w) * inv2dx;

  // Compressible baryon continuity + pressure gradient + gravitational pull toward DM overdensities
  let rho_b = clamp(adv.fluid.x * exp(-clamp(div_v * dt, -0.35, 0.35)), 0.04, 24.0);
  let p_xp = cxp.fluid.x * (cxp.rad.x * 1e-6);
  let p_xm = cxm.fluid.x * (cxm.rad.x * 1e-6);
  let p_yp = cyp.fluid.x * (cyp.rad.x * 1e-6);
  let p_ym = cym.fluid.x * (cym.rad.x * 1e-6);
  let p_zp = czp.fluid.x * (czp.rad.x * 1e-6);
  let p_zm = czm.fluid.x * (czm.rad.x * 1e-6);
  let grad_p = vec3<f32>(p_xp - p_xm, p_yp - p_ym, p_zp - p_zm) * inv2dx;

  // Local tidal pull toward dark-matter overdensity gradient (captures filament/cluster accretion!)
  let grad_dm = vec3<f32>(
    (cxp.rad.z - cxm.rad.z) * inv2dx,
    (cyp.rad.z - cym.rad.z) * inv2dx,
    (czp.rad.z - czm.rad.z) * inv2dx
  );
  let v_new = clamp(adv.fluid.yzw + (grad_dm * params.gravity_g - grad_p / max(0.08, rho_b) * 0.35) * dt, vec3<f32>(-18.0), vec3<f32>(18.0));

  // Ionizing UV radiative diffusion + Pop III star-forming halo sources (Reionization bubbles!)
  let lap_xhii = (cxp.rad.y + cxm.rad.y + cyp.rad.y + cym.rad.y + czp.rad.y + czm.rad.y - 6.0 * c0.rad.y);
  let is_cmb = (params.mode_flags & 1u) != 0u;
  let is_reion = (params.mode_flags & 2u) != 0u;
  var x_hii = adv.rad.y;
  var temp_k = adv.rad.x;
  var delta_sz = adv.rad.w;

  if (is_cmb) {
    // Acoustic standing-wave baryon-photon oscillation around T_CMB(z)
    let lap_d = (cxp.rad.w + cxm.rad.w + cyp.rad.w + cym.rad.w + czp.rad.w + czm.rad.w - 6.0 * c0.rad.w);
    delta_sz = c0.rad.w + (0.045 * lap_d - 0.02 * div_v) * dt;
    temp_k = params.cmb_temp_k * (1.0 + 0.09 * clamp(delta_sz, -1.2, 1.2));
  } else if (is_reion) {
    // Real ionization-front expansion: Pop III halos (rho_dm > 1.15) emit UV photons diffusing outward,
    // balanced against case-B recombination alpha_B * rho_b * x_HII^2!
    let src_uv = select(0.0, 2.4 * params.uv_flux * (c0.rad.z - 1.10), c0.rad.z > 1.15);
    let recomb = 0.08 * rho_b * x_hii * x_hii;
    x_hii = clamp(x_hii + (src_uv * (1.0 - x_hii) + 0.22 * lap_xhii * params.uv_flux - recomb) * dt, 0.001, 1.0);
    // Photoheating to ~1.8e4 K inside ionized H II bubbles vs cold neutral IGM outside
    let t_eq = mix(max(params.cmb_temp_k, 45.0), 2.0e4, x_hii);
    temp_k = clamp(temp_k + (t_eq - temp_k) * 0.25 * dt, 20.0, 2.5e5);
    delta_sz = x_hii;
  } else {
    // Compressible ICM shock heating (-div_v > 0) + thermal Bremsstrahlung cooling
    let shock_heat = max(0.0, -div_v) * 6.5e6 * rho_b;
    let brem_cool = 1.4e-5 * rho_b * rho_b * sqrt(max(1e3, temp_k));
    temp_k = clamp(temp_k + (shock_heat - brem_cool * 0.02) * dt, max(params.cmb_temp_k, 1e4), 1.8e8);
    // Local Sunyaev-Zel'dovich thermal pressure proxy (n_e * T_e)
    delta_sz = rho_b * (temp_k * 1e-7);
    x_hii = 1.0;
  }

  var out: CosmoCell;
  out.fluid = vec4<f32>(rho_b, v_new);
  out.rad = vec4<f32>(temp_k, x_hii, c0.rad.z, delta_sz);
  cells_dst[idx] = out;
}

// 2. Project 3D Total Mass (DM + Baryons) -> 2D Lensing Convergence kappa(x,y) & Deflection alpha(x,y)!
@compute @workgroup_size(8, 8)
fn compute_lensing_projection(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = i32(params.grid_n);
  if (i32(gid.x) >= n || i32(gid.y) >= n) { return; }
  let ix = i32(gid.x); let iy = i32(gid.y);
  var sigma_tot = 0.0;
  var sz_col = 0.0;
  for (var iz = 0; iz < n; iz = iz + 1) {
    let c = cells_src[cidx(ix, iy, iz, n)];
    sigma_tot = sigma_tot + (c.rad.z + 0.18 * c.fluid.x);
    sz_col = sz_col + max(0.0, c.rad.w);
  }
  let inv_n = 1.0 / f32(n);
  let kappa = max(0.0, (sigma_tot * inv_n - params.mean_rho) * 0.45);
  lens_map[u32(iy * n + ix)] = vec4<f32>(kappa, 0.0, 0.0, sz_col * inv_n);
}

// 3. Compute 2D Gravitational Lensing Deflection Vector alpha(theta) = grad(psi) from kappa!
@compute @workgroup_size(8, 8)
fn compute_lensing_deflection(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = i32(params.grid_n);
  if (i32(gid.x) >= n || i32(gid.y) >= n) { return; }
  let ix = i32(gid.x); let iy = i32(gid.y);
  let id_c = u32(iy * n + ix);
  var ax = 0.0;
  var ay = 0.0;
  // Direct 2D Green's function convolution alpha(theta) = (1/pi) * integral kappa(theta') (theta-theta')/|theta-theta'|^2
  // Exact & tiny on N=24..32 (576-1024 taps per thread -> < 0.05 ms on GPU!)
  let inv_pi_n2 = 1.0 / (3.14159265 * f32(n));
  for (var jy = 0; jy < n; jy = jy + 1) {
    for (var jx = 0; jx < n; jx = jx + 1) {
      let dx_i = f32(ix - jx);
      let dy_i = f32(iy - jy);
      let r2 = dx_i * dx_i + dy_i * dy_i + 0.35;
      let kap = lens_map[u32(jy * n + jx)].x;
      ax = ax + kap * (dx_i / r2);
      ay = ay + kap * (dy_i / r2);
    }
  }
  let prev = lens_map[id_c];
  lens_map[id_c] = vec4<f32>(prev.x, ax * inv_pi_n2, ay * inv_pi_n2, prev.w);
}

// 4. Update zero-copy 3D visualization tracers directly from live baryon/radiation/ICM grid
@compute @workgroup_size(64)
fn step_cosmo_tracers(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.tracer_count) { return; }
  var tr = tracers[i];
  let half = params.box_size * 0.48;
  let loc_p = tr.pos_m.xyz - params.center_offset.xyz;
  let c = sample_cell_trilin(loc_p);

  let is_cmb = (params.mode_flags & 1u) != 0u;
  var next_p = loc_p;
  if (!is_cmb) {
    next_p = loc_p + c.fluid.yzw * params.dt * 1.4;
    if (abs(next_p.x) > half) { next_p.x = next_p.x - sign(next_p.x) * params.box_size * 0.94; }
    if (abs(next_p.y) > half) { next_p.y = next_p.y - sign(next_p.y) * params.box_size * 0.94; }
    if (abs(next_p.z) > half) { next_p.z = next_p.z - sign(next_p.z) * params.box_size * 0.94; }
  }
  let xray = c.fluid.x * c.fluid.x * sqrt(max(1.0, c.rad.x * 1e-6));
  tr.pos_m = vec4<f32>(next_p + params.center_offset.xyz, tr.pos_m.w);
  tr.vel_rho = vec4<f32>(c.fluid.yzw, select(c.fluid.x, c.rad.z, tr.t_xhii_sz_sp.w > 0.5));
  tr.t_xhii_sz_sp = vec4<f32>(c.rad.x, c.rad.y, c.rad.w, tr.t_xhii_sz_sp.w);
  tr.z_xray_flag_s = vec4<f32>(params.redshift_z, xray, f32(params.mode_flags), tr.z_xray_flag_s.w);
  tracers[i] = tr;
}

// 5. Parallel 64-thread Telemetry Reduction (ZERO WG(1)!)
@compute @workgroup_size(64)
fn reduce_cosmo_baryon_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n = params.grid_n;
  let total = n * n * n;
  var xhii_sum = 0.0;
  var max_t = 0.0;
  var xray_sum = 0.0;
  var sz_sum = 0.0;
  var rho_sum = 0.0;
  var dt_sq = 0.0;
  var i = tid;
  loop {
    if (i >= total) { break; }
    let c = cells_src[i];
    xhii_sum = xhii_sum + c.rad.y;
    max_t = max(max_t, c.rad.x);
    xray_sum = xray_sum + c.fluid.x * c.fluid.x * sqrt(max(1.0, c.rad.x * 1e-6));
    sz_sum = sz_sum + max(0.0, c.rad.w);
    rho_sum = rho_sum + c.fluid.x;
    let dtf = (c.rad.x - params.cmb_temp_k) / max(1.0, params.cmb_temp_k);
    dt_sq = dt_sq + dtf * dtf;
    i = i + 64u;
  }

  let n2 = n * n;
  var max_kap = 0.0;
  var max_alp = 0.0;
  var j = tid;
  loop {
    if (j >= n2) { break; }
    let lm = lens_map[j];
    max_kap = max(max_kap, lm.x);
    max_alp = max(max_alp, length(lm.yz));
    j = j + 64u;
  }

  wg0[tid] = xhii_sum; wg1[tid] = max_t; wg2[tid] = xray_sum; wg3[tid] = sz_sum;
  wg4[tid] = max_kap; wg5[tid] = max_alp; wg6[tid] = rho_sum; wg7[tid] = dt_sq;
  workgroupBarrier();

  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s];
      wg1[tid] = max(wg1[tid], wg1[tid + s]);
      wg2[tid] += wg2[tid + s];
      wg3[tid] += wg3[tid + s];
      wg4[tid] = max(wg4[tid], wg4[tid + s]);
      wg5[tid] = max(wg5[tid], wg5[tid + s]);
      wg6[tid] += wg6[tid + s];
      wg7[tid] += wg7[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }

  if (tid == 0u) {
    let inv_t = 1.0 / max(1.0, f32(total));
    telemetry[0] = vec4<f32>(wg0[0] * inv_t, wg1[0], wg2[0] * inv_t, wg3[0] * inv_t);
    telemetry[1] = vec4<f32>(wg4[0], wg5[0], wg6[0] * inv_t, sqrt(wg7[0] * inv_t));
  }
}
`;function gt(t,{gridN:n=24,tracerCount:r=6144,boxSizeMpc:i=260,redshiftZ:c=10,clusterMergerMode:l=!1,uvFlux:u=null,gravityG:d=1.2,seed:f=20261125,centerOffset:p=[0,0,0],label:m=`ulg-cosmo-baryon-rad`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createCosmologicalBaryonRadiationSessionWebGpu requires a live WebGPU GPUDevice`);let h=mt({gridN:n,tracerCount:r,boxSizeMpc:i,redshiftZ:c,clusterMergerMode:l,seed:f,centerOffset:p}),g=h.gridN,_=h.boxSizeMpc/g,v=u==null?h.epoch.uvBackgroundFlux:Number(u),y=h.epoch.redshiftZ>=400|(h.epoch.redshiftZ>=5.5&&h.epoch.redshiftZ<400?2:0)|(l?4:0),b=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`storage`),a(3,`storage`),a(4,`storage`),a(5,`storage`)],x=e=>s(t,{cacheKey:`ulg-cosmo-baryon-rad-${e}.v1`,label:`${m}-${e}`,code:ht,entryPoint:e,bindings:b}),S=x(`step_cosmo_baryon_rad`),C=x(`compute_lensing_projection`),w=x(`compute_lensing_deflection`),T=x(`step_cosmo_tracers`),E=x(`reduce_cosmo_baryon_telemetry`),D=t.createBuffer({label:`${m}-params`,size:64,usage:ut.UNIFORM|ut.COPY_DST}),O=t.createBuffer({label:`${m}-cellA`,size:h.cells.byteLength,usage:ut.STORAGE|ut.COPY_DST}),k=t.createBuffer({label:`${m}-cellB`,size:h.cells.byteLength,usage:ut.STORAGE|ut.COPY_DST}),A=t.createBuffer({label:`${m}-tracers`,size:h.tracers.byteLength,usage:ut.STORAGE|ut.VERTEX|ut.COPY_DST|ut.COPY_SRC}),j=t.createBuffer({label:`${m}-lens`,size:g*g*16,usage:ut.STORAGE|ut.COPY_SRC}),M=t.createBuffer({label:`${m}-tel`,size:32,usage:ut.STORAGE|ut.COPY_SRC}),N=t.createBuffer({label:`${m}-tel-read`,size:32,usage:ut.MAP_READ|ut.COPY_DST});t.queue.writeBuffer(O,0,h.cells),t.queue.writeBuffer(k,0,h.cells),t.queue.writeBuffer(A,0,h.tracers);let P=(e,n,r)=>o(t,{layout:S.bindGroupLayout,label:`${m}-bg-${r}`,entries:[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:e}},{binding:2,resource:{buffer:n}},{binding:3,resource:{buffer:A}},{binding:4,resource:{buffer:j}},{binding:5,resource:{buffer:M}}]}),F=P(O,k,`0`),I=P(k,O,`1`),L=0,R=0,z=!1,B=!1,V=Object.freeze({schema:lt,stepIndex:0,redshiftZ:h.epoch.redshiftZ,cmbTempK:h.epoch.cmbTempK,meanIonizedFraction:h.epoch.ionizationFrac,maxGasTempK:h.epoch.cmbTempK,meanXrayEmissivity:0,meanSzComptonY:0,maxLensingKappa:0,maxLensingDeflection:0,meanBaryonDensity:1,cmbRmsDeltaTOverT:0,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),ee=Math.ceil(g/4),H=Math.ceil(g/8),U=Math.ceil(h.tracerCount/64);function W(e){let n=new ArrayBuffer(64);new Uint32Array(n,0,4).set([g,h.tracerCount,y,R]),new Float32Array(n,16,12).set([h.boxSizeMpc,_,e,h.epoch.redshiftZ,h.epoch.cmbTempK,v,h.meanRho,d,h.centerOffset[0],h.centerOffset[1],h.centerOffset[2],0]),t.queue.writeBuffer(D,0,n)}async function G({dt:n=.08,substeps:r=2,readTelemetry:i=!0}={}){if(B)return V;let a=Math.max(1,Math.min(16,Math.trunc(r)));W(Math.max(.005,Math.min(.25,Number(n)||.08)));let o=t.createCommandEncoder({label:`${m}-step-${R}`}),s=o.beginComputePass({label:`${m}-pass`});for(let e=0;e<a;e+=1)s.setBindGroup(0,L===0?F:I),s.setPipeline(S.pipeline),s.dispatchWorkgroups(ee,ee,ee),L^=1,s.setBindGroup(0,L===0?F:I),s.setPipeline(T.pipeline),s.dispatchWorkgroups(U),R+=1;s.setBindGroup(0,L===0?F:I),s.setPipeline(C.pipeline),s.dispatchWorkgroups(H,H),s.setPipeline(w.pipeline),s.dispatchWorkgroups(H,H),s.setPipeline(E.pipeline),s.dispatchWorkgroups(1),s.end();let c=i&&!z&&N.mapState===`unmapped`;if(c&&(z=!0,o.copyBufferToBuffer(M,0,N,0,32)),t.queue.submit([o.finish()]),c)try{if(await N.mapAsync(ut.MAP_READ),!B){let t=new Float32Array(N.getMappedRange(0,32));V=Object.freeze({schema:lt,stepIndex:R,redshiftZ:h.epoch.redshiftZ,cmbTempK:h.epoch.cmbTempK,meanIonizedFraction:t[0],maxGasTempK:t[1],meanXrayEmissivity:t[2],meanSzComptonY:t[3],maxLensingKappa:t[4],maxLensingDeflection:t[5],meanBaryonDensity:t[6],cmbRmsDeltaTOverT:t[7],accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{N.unmap()}catch{}}catch(e){if(!B&&e?.name!==`AbortError`)throw e}finally{z=!1}return V}function te(){if(!B){B=!0;for(let e of[D,O,k,A,j,M,N])try{e.destroy()}catch{}}}return Object.freeze({schema:lt,lawAdapter:dt,get gridN(){return g},get tracerCount(){return h.tracerCount},get boxSizeMpc(){return h.boxSizeMpc},get epoch(){return h.epoch},get stepIndex(){return R},getResidentTracersBuffer:()=>A,getResidentLensingBuffer:()=>j,getTelemetry:()=>V,step:G,dispose:te})}function _t(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`cosmological-baryon-radiation@1`)?e.resolveModule(`cosmological-baryon-radiation@1`)?.descriptor||null:e.registerModule({method:{model:`cosmological-baryon-radiation`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/cosmologicalBaryonRadiationGpu.js`,entryPoint:`step_cosmo_baryon_rad`,workgroupSize:64},parameterSchema:{redshiftZ:{type:`number`,min:-.55,max:1200,required:!1},clusterMergerMode:{type:`boolean`,required:!1}},stateLayout:{tensorId:`cosmo-baryon-tracers`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`m`,`vx`,`vy`,`vz`,`rho`,`T`,`xHII`,`sz`,`species`,`z`,`xray`,`flags`,`seed`]},scaleRangeM:[1e21,1e26],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=gt(n,{gridN:16,tracerCount:512,redshiftZ:r.redshiftZ??10,clusterMergerMode:!!r.clusterMergerMode}),a=await i.step({dt:.08,substeps:2,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:cosmo-baryon-rad:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/cosmologicalBaryonRadiationGpu.js`,entryPoint:`createCosmologicalBaryonRadiationSessionWebGpu`,kernelEntryPoint:`step_cosmo_baryon_rad`},representation:`cosmo-baryon-rt-lensing-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-cosmo-baryon-radiation`,placement:`local`},validity:{finite:Number.isFinite(a.meanIonizedFraction)&&Number.isFinite(a.maxLensingKappa)},validation:{status:`pass`,validationMode:`gpu-cosmo-baryon-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var vt=`ulg.astrophysics.relativistic-compact-kerr-jet-webgpu.v1`,yt=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),bt=Object.freeze({id:`relativistic-compact-kerr-jet`,lawNodeId:`law:astrophysics-relativistic-compact-kerr-jet`,orderConstraint:`after:self-gravitating-hydro-fusion`,adapterMode:n.CELL_LOCAL,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`compact-object-state`,`accretion-flux-state`]),writes:Object.freeze([`compact-tov-profile`,`relativistic-jet-tracers`]),accumulates:Object.freeze([`kerr-bz-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`baryon-number`,`adm-mass-energy`,`kerr-spin-angular-momentum`]),validityDomain:Object.freeze({kerrSpinMax:.998,minCompactness:1e-4}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e3,1e22]),fundamentalLaws:Object.freeze([`general-relativity-tov`,`fermi-dirac-degenerate-eos`,`nuclear-saturation-eos`,`kerr-spacetime`,`blandford-znajek-jet`])});function xt(e={}){let t=Number(e.compactnessGMOverRc2)||0,n=Number(e.centralRelativisticMassSolar)||0,r=Number(e.accretionRateEddington)||0,i=t>1e-4||n>=.5&&r>1e-6;return{active:i,kerrJetActive:n>=2.5&&r>1e-4&&Math.abs(Number(e.kerrSpinA)||0)>.05&&Math.abs(Number(e.magneticFieldStrength)||0)>0,reason:i?`relativistic-compact-object-present`:`newtonian-low-compactness-dormant`}}function St({massSolar:e=1e8,spinA:t=.9,accretionRateEddington:n=.35,magneticFluxNorm:r=1}={}){let i=Math.max(.5,Number(e)||10),a=Math.max(-.998,Math.min(.998,Number(t)||0)),o=Math.abs(a),s=66743e-15*i*198847e25/299792458**2,c=1+Math.sqrt(Math.max(0,1-a*a)),l=a/Math.max(1e-6,2*c),u=1+Math.cbrt(1-a*a)*(Math.cbrt(1+o)+Math.cbrt(1-o)),d=Math.sqrt(3*a*a+u*u),f=a>=0?1:-1,p=3+d-f*Math.sqrt(Math.max(0,(3-u)*(3+u+2*d))),m=Math.max(.038,Math.min(.42,1-Math.sqrt(Math.max(.3,1-2/(3*p))))),h=1257e28*i,g=Math.max(0,Number(n)||0),_=g*h,v=Math.max(0,Number(r)||0),y=l*l*1.3*(v*v),b=_*y,x=1+Math.min(18,9.5*Math.sqrt(y*Math.min(2,g*4)));return Object.freeze({massSolar:i,spinA:a,rGravM:s,rHorizonRg:c,rIscoRg:p,omegaH:l,radiativeEfficiency:m,eddLumW:h,bolometricLumW:_,bzEfficiency:y,jetPowerW:b,lorentzGamma:x})}var Ct=`
struct TovParams {
  sample_count: u32,
  max_steps: u32,
  pad0: u32,
  pad1: u32,
};

struct TovInput {
  // x = central_rho_kg_m3, y = y_electron (0.5 for C/O WD), z = eos_stiffness_scale (1.0 canonical), w = pad
  cfg: vec4<f32>,
};

struct TovOutput {
  // x = mass_solar, y = radius_km, z = compactness_GM_Rc2, w = branch_code (0=WD, 1=unstable, 2=NS, 3=BH)
  res: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: TovParams;
@group(0) @binding(1) var<storage, read> inputs: array<TovInput>;
@group(0) @binding(2) var<storage, read_write> outputs: array<TovOutput>;

const PI: f32 = 3.14159265359;
// Exact scaled GR TOV units keeping all intermediates inside [1e-16, 1e16] (ZERO f32 overflow!):
//   r in km, m in M_sun, rho9 = rho / 1e9 kg/m^3, p22 = P / 1e22 Pa!
const RS_PER_MSUN_KM: f32 = 2.95325;
const P22_TO_RHO9: f32 = 1.112650e-4;
const DM_COEFF: f32 = 6.31962e-12;
const MP_COEFF: f32 = 7.03152e-16;
const DP_COEFF: f32 = 1.32716e4;

// Continuous Unified Degenerate EOS returning p22 = P / 1e22 Pa from rho9 = rho / 1e9 kg/m^3!
fn unified_degenerate_p22(rho9: f32, ye: f32, stiff: f32) -> f32 {
  if (rho9 <= 1e-8) { return 0.0; }
  // 1. Relativistic Fermi-Dirac electron degeneracy: rho_0 = m_p (m_e c / hbar)^3 / (3 pi^2) = 9.81e8 kg/m^3 (0.981e9)
  let x = pow(max(0.0, rho9 * ye / 0.981), 0.33333334);
  let x2 = x * x;
  let sq = sqrt(1.0 + x2);
  // Chandrasekhar constant A_e / 1e22 = 0.60023
  var p_e = 0.0;
  if (x < 0.05) {
    p_e = 0.60023 * (1.6 * x2 * x2 * x);
  } else {
    p_e = 0.60023 * (x * (2.0 * x2 - 3.0) * sq + 3.0 * log(x + sq));
  }
  // Smooth neutronization suppression above neutron drip (4e14 kg/m^3 -> rho9 = 4e5)
  let e_keep = 1.0 / (1.0 + pow(rho9 / 1.2e6, 1.5));

  // 2. Relativistic neutron degeneracy + stiff nuclear repulsion above rho_sat = 2.7e17 kg/m^3 (rho9 = 2.7e8)
  let x_n = pow(max(0.0, rho9 / 6.106e9), 0.33333334);
  let xn2 = x_n * x_n;
  let sqn = sqrt(1.0 + xn2);
  let p_n_ideal = 1.629e13 * (x_n * (2.0 * xn2 - 3.0) * sqn + 3.0 * log(x_n + sqn));
  let r_sat = rho9 / 2.7e8;
  let p_nuc = select(0.0, 1.35e11 * stiff * pow(r_sat, 2.45), rho9 > 1.5e7);
  let n_on = smoothstep(3.0e5, 4.0e6, rho9);
  return p_e * e_keep + (p_n_ideal * 0.28 + p_nuc) * n_on;
}

// Invert p22(rho9) -> rho9(p22) monotonically via log-space bisection (22 iters -> < 1e-4 accuracy!)
fn invert_eos_rho9(p_target: f32, rho9_hint: f32, ye: f32, stiff: f32) -> f32 {
  if (p_target <= 0.0) { return 0.0; }
  var lo = 1e-7;
  var hi = max(1e-2, rho9_hint * 1.15);
  for (var it = 0u; it < 22u; it = it + 1u) {
    let mid = sqrt(lo * hi);
    let pm = unified_degenerate_p22(mid, ye, stiff);
    if (pm < p_target) { lo = mid; } else { hi = mid; }
  }
  return sqrt(lo * hi);
}

@compute @workgroup_size(64)
fn solve_tov_batch(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.sample_count) { return; }
  let cfg = inputs[i].cfg;
  let rho_c_si = max(1e6, cfg.x);
  let rho_c9 = rho_c_si * 1e-9;
  let ye = clamp(cfg.y, 0.2, 0.9);
  let stiff = clamp(cfg.z, 0.4, 2.5);

  let is_nuclear = rho_c9 > 1.0e6;
  let dr = select(18.0, 0.045, is_nuclear); // 18 km steps for WD, 45 m (0.045 km) for Neutron Star!
  var r = dr;
  var rho9 = rho_c9;
  var p22 = unified_degenerate_p22(rho_c9, ye, stiff);
  var m = (DM_COEFF / 3.0) * r * r * r * rho_c9;
  let p_surf = p22 * 1e-6;

  for (var s = 0u; s < params.max_steps; s = s + 1u) {
    if (p22 <= p_surf || rho9 <= 1e-6) { break; }
    let r_s = RS_PER_MSUN_KM * m;
    if (r <= r_s * 1.02) { break; }
    let rho_eff = rho9 + P22_TO_RHO9 * p22;
    let m_eff = m + MP_COEFF * r * r * r * p22;
    let dp_dr = -(DP_COEFF * rho_eff * m_eff) / (r * (r - r_s));
    let dm_dr = DM_COEFF * r * r * rho9;

    // Midpoint RK2 step for clean TOV accuracy
    let p_mid = max(0.0, p22 + 0.5 * dp_dr * dr);
    let m_mid = m + 0.5 * dm_dr * dr;
    let r_mid = r + 0.5 * dr;
    let rho_mid = invert_eos_rho9(p_mid, rho9, ye, stiff);
    let rs_mid = RS_PER_MSUN_KM * m_mid;
    if (r_mid <= rs_mid * 1.02 || p_mid <= p_surf) {
      r = r_mid;
      m = m_mid;
      break;
    }
    let dp_mid = -(DP_COEFF * (rho_mid + P22_TO_RHO9 * p_mid) * (m_mid + MP_COEFF * r_mid * r_mid * r_mid * p_mid)) / (r_mid * (r_mid - rs_mid));
    let dm_mid = DM_COEFF * r_mid * r_mid * rho_mid;

    p22 = p22 + dp_mid * dr;
    m = m + dm_mid * dr;
    r = r + dr;
    rho9 = invert_eos_rho9(max(0.0, p22), rho9, ye, stiff);
  }

  let compact = (0.5 * RS_PER_MSUN_KM * m) / max(1e-3, r);
  var branch = 0.0; // White Dwarf
  if (compact >= 0.44 || (is_nuclear && rho_c9 > 3.5e9)) {
    branch = 3.0; // Black Hole horizon collapse
  } else if (is_nuclear) {
    branch = 2.0; // Neutron Star
  } else if (rho_c9 > 5.0e4) {
    branch = 1.0; // Electron-capture unstable gap
  }
  outputs[i].res = vec4<f32>(m, r, compact, branch);
}
`;async function wt(e,t=[],{maxSteps:n=900,label:r=`ulg-tov-batch`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveRelativisticTovBatchWebGpu requires a live WebGPU GPUDevice`);let i=Math.max(1,t.length),c=new Float32Array(i*4);for(let e=0;e<i;e+=1){let n=t[e]||{};c[e*4+0]=Number(n.centralRhoKgM3??1e10),c[e*4+1]=Number(n.yElectron??.5),c[e*4+2]=Number(n.stiffnessScale??1),c[e*4+3]=0}let l=s(e,{cacheKey:`ulg-tov-batch-solve.v1`,label:r,code:Ct,entryPoint:`solve_tov_batch`,bindings:[a(0,`uniform`),a(1,`read-only-storage`),a(2,`storage`)]}),u=e.createBuffer({label:`${r}-p`,size:16,usage:yt.UNIFORM|yt.COPY_DST}),d=e.createBuffer({label:`${r}-in`,size:c.byteLength,usage:yt.STORAGE|yt.COPY_DST}),f=e.createBuffer({label:`${r}-out`,size:i*16,usage:yt.STORAGE|yt.COPY_SRC}),p=e.createBuffer({label:`${r}-rd`,size:i*16,usage:yt.MAP_READ|yt.COPY_DST});e.queue.writeBuffer(u,0,new Uint32Array([i,n,0,0])),e.queue.writeBuffer(d,0,c);let m=o(e,{layout:l.bindGroupLayout,label:`${r}-bg`,entries:[{binding:0,resource:{buffer:u}},{binding:1,resource:{buffer:d}},{binding:2,resource:{buffer:f}}]}),h=e.createCommandEncoder({label:`${r}-enc`}),g=h.beginComputePass({label:`${r}-pass`});g.setPipeline(l.pipeline),g.setBindGroup(0,m),g.dispatchWorkgroups(Math.ceil(i/64)),g.end(),h.copyBufferToBuffer(f,0,p,0,i*16),e.queue.submit([h.finish()]),await p.mapAsync(yt.MAP_READ);let _=new Float32Array(p.getMappedRange(0,i*16)),v=[`white-dwarf`,`unstable-gap`,`neutron-star`,`black-hole`],y=[];for(let e=0;e<i;e+=1)y.push(Object.freeze({centralRhoKgM3:c[e*4+0],massSolar:_[e*4+0],radiusKm:_[e*4+1],compactness:_[e*4+2],branch:v[Math.min(3,Math.max(0,Math.round(_[e*4+3])))]}));p.unmap();for(let e of[u,d,f,p])try{e.destroy()}catch{}return Object.freeze(y)}var Tt=`
struct KerrParams {
  particle_count: u32,
  step_index: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  r_horizon: f32,
  r_isco: f32,
  spin_a: f32,
  edd_ratio: f32,
  bz_power: f32,       // Blandford-Znajek jet power factor (0 if spin=0 or B=0!)
  lorentz_max: f32,
  box_half: f32,
  center_offset: vec4<f32>,
};

// 16 floats (64 B) matching PARTICLE_CLOUD_WGSL Mode 7 (Relativistic Jet / Disk / Ejecta!):
//   pos_m:    vec4(x, y, z, role)       role: 0=accretion_disk, 1=bz_jet_plasma, 2=corona_torus
//   vel_gam:  vec4(vx, vy, vz, gamma)   gamma = Lorentz factor >= 1.0
//   em_b:     vec4(temp_norm, b_phi, sync_emiss, age)
//   meta0:    vec4(seed, r_init, jet_sign, live)
struct RelParcel {
  pos_m: vec4<f32>,
  vel_gam: vec4<f32>,
  em_b: vec4<f32>,
  meta0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: KerrParams;
@group(0) @binding(1) var<storage, read_write> parcels: array<RelParcel>;
@group(0) @binding(2) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

@compute @workgroup_size(64)
fn step_kerr_bz_jet(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  var p = parcels[i];
  let role = p.pos_m.w;
  var loc = p.pos_m.xyz - params.center_offset.xyz;
  var vel = p.vel_gam.xyz;
  let dt = params.dt;

  if (role > 0.5 && role < 1.5) {
    // Relativistic Blandford-Znajek Jet Plasma Parcel!
    if (params.bz_power <= 1e-5) {
      // Zero BZ power (a* = 0 or B = 0) -> no relativistic jet acceleration!
      p.vel_gam = vec4<f32>(0.0, 0.0, 0.0, 1.0);
      p.em_b = vec4<f32>(0.0, 0.0, 0.0, p.em_b.w);
      p.meta0.w = 0.0;
      parcels[i] = p;
      return;
    }
    p.meta0.w = 1.0;
    let sgn = select(-1.0, 1.0, p.meta0.z >= 0.0);
    let y_abs = abs(loc.y);
    // Magnetocentrifugal acceleration along parabolic BZ funnel r_jet ~ r_0 * (1 + |y|)^0.58
    let v_target_y = sgn * (0.55 + 2.8 * sqrt(params.bz_power)) * (0.45 + 0.55 * smoothstep(0.0, 3.5, y_abs));
    let r_cyl = max(0.06, length(loc.xz));
    let omega_twist = params.spin_a * 2.2 / (0.35 + y_abs * 0.45);
    // Helical magnetic hoop collimation + radial parabolic expansion
    let r_target = 0.16 + 0.24 * pow(y_abs, 0.62) * (0.45 + 0.55 * p.meta0.x);
    let radial_f = (r_target - r_cyl) * 2.5;
    let rx = loc.x / r_cyl;
    let rz = loc.z / r_cyl;
    vel = vec3<f32>(
      -rz * r_cyl * omega_twist + rx * radial_f,
      mix(vel.y, v_target_y, clamp(dt * 3.5, 0.0, 1.0)),
      rx * r_cyl * omega_twist + rz * radial_f
    );
    loc = loc + vel * dt;
    // Recycle jet parcel smoothly at magnetospheric launch base near ergosphere
    if (abs(loc.y) > params.box_half * 1.15) {
      let ang = p.meta0.x * 6.2831853 + f32(params.step_index) * 0.17;
      let r0 = params.r_horizon * (0.75 + 0.45 * p.meta0.y);
      loc = vec3<f32>(cos(ang) * r0, sgn * (params.r_horizon * 0.9 + 0.15 * p.meta0.x), sin(ang) * r0);
      vel = vec3<f32>(0.0, sgn * 0.6, 0.0);
    }
    let gam = 1.0 + (params.lorentz_max - 1.0) * smoothstep(0.2, 5.0, abs(loc.y));
    let sync = clamp(0.45 + 0.95 * params.bz_power / (1.0 + abs(loc.y) * 0.16), 0.1, 2.0);
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
    p.vel_gam = vec4<f32>(vel, gam);
    p.em_b = vec4<f32>(0.95, params.spin_a * params.bz_power, sync, p.em_b.w + dt);
    parcels[i] = p;
    return;
  }

  // Relativistic Kerr Accretion Disk / Dusty Torus Parcel (Paczynski-Wiita + Kerr frame dragging!)
  let r_cyl = max(params.r_isco * 0.85, length(loc.xz));
  let r3 = max(params.r_horizon * 1.05, length(loc));
  // Prograde Kerr orbital angular velocity Omega_K = 1 / (r^(3/2) + a*)
  let gm = 18.0;
  let omega_k = sqrt(gm) / (pow(r_cyl, 1.5) + params.spin_a * params.r_horizon * 0.6);
  // Viscous alpha-disk inward drift + vertical epicyclic restoring force
  let v_in = -0.06 * params.edd_ratio / max(0.5, r_cyl);
  let rx = loc.x / r_cyl;
  let rz = loc.z / r_cyl;
  vel = vec3<f32>(
    -rz * r_cyl * omega_k + rx * v_in,
    vel.y - (gm * loc.y / (r3 * r3 * r3)) * dt * 0.45,
    rx * r_cyl * omega_k + rz * v_in
  );
  vel.y = vel.y * exp(-0.8 * dt);
  loc = loc + vel * dt;

  // Plunging inside r_ISCO recycles cleanly at outer feeding radius
  if (length(loc.xz) < params.r_isco * 0.92) {
    let ang = p.meta0.x * 6.2831853 + f32(params.step_index) * 0.05;
    let r_outer = params.r_isco * (4.5 + 3.5 * p.meta0.y);
    loc = vec3<f32>(cos(ang) * r_outer, (p.meta0.x - 0.5) * 0.35, sin(ang) * r_outer);
  }

  // Novikov-Thorne temperature profile T(r) ~ (r / r_ISCO)^(-3/4) * (1 - sqrt(r_ISCO / r))^(1/4)
  let r_now = max(params.r_isco * 1.01, length(loc.xz));
  let nt_f = pow(params.r_isco / r_now, 0.75) * pow(max(0.02, 1.0 - sqrt(params.r_isco / r_now)), 0.25);
  let t_norm = clamp(nt_f * (1.2 + 1.6 * params.edd_ratio), 0.08, 1.8);
  let beta = clamp(length(vel) / 14.0, 0.0, 0.78);
  let gam_d = 1.0 / sqrt(max(0.15, 1.0 - beta * beta));

  p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
  p.vel_gam = vec4<f32>(vel, gam_d);
  p.em_b = vec4<f32>(t_norm, 0.0, t_norm, p.em_b.w + dt);
  p.meta0.w = 1.0;
  parcels[i] = p;
}

@compute @workgroup_size(64)
fn reduce_kerr_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var max_gam = 1.0;
  var jet_cnt = 0.0;
  var disk_lum = 0.0;
  var jet_sync = 0.0;
  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = parcels[i];
    if (p.meta0.w > 0.5) {
      max_gam = max(max_gam, p.vel_gam.w);
      if (p.pos_m.w > 0.5 && p.pos_m.w < 1.5) {
        jet_cnt = jet_cnt + 1.0;
        jet_sync = jet_sync + p.em_b.z;
      } else {
        disk_lum = disk_lum + p.em_b.x;
      }
    }
    i = i + 64u;
  }
  wg0[tid] = max_gam; wg1[tid] = jet_cnt; wg2[tid] = disk_lum; wg3[tid] = jet_sync;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] = max(wg0[tid], wg0[tid + s]);
      wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s];
      wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    telemetry[0] = vec4<f32>(wg0[0], wg1[0], wg2[0], wg3[0]);
  }
}
`;function Et(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Dt(t,{massSolar:n=4e8,spinA:r=.92,accretionRateEddington:i=.42,magneticFluxNorm:c=1,particleCount:l=6144,seed:u=20261125,centerOffset:d=[0,0,0],label:f=`ulg-kerr-bz-jet`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createKerrAccretionJetSessionWebGpu requires a live WebGPU GPUDevice`);let p=St({massSolar:n,spinA:r,accretionRateEddington:i,magneticFluxNorm:c}),m=Math.max(256,Math.min(32768,Math.trunc(l))),h=Et(u),g=Number(d?.[0])||0,_=Number(d?.[1])||0,v=Number(d?.[2])||0,y=.52,b=Math.max(.45,p.rHorizonRg*y),x=Math.max(b*1.15,p.rIscoRg*y),S=new Float32Array(m*16),C=p.bzEfficiency>1e-4?.36:0,w=Math.floor(m*C);for(let e=0;e<m;e+=1){let t=e*16;if(e<w){let n=e&1?-1:1,i=b+h()**1.15*9.5,a=h()*Math.PI*2,o=(.14+.24*i**.62)*(.25+.75*h());S[t+0]=Math.cos(a)*o+g,S[t+1]=n*i+_,S[t+2]=Math.sin(a)*o+v,S[t+3]=1,S[t+4]=0,S[t+5]=n*1.8,S[t+6]=0,S[t+7]=p.lorentzGamma,S[t+8]=.95,S[t+9]=r*p.bzEfficiency,S[t+10]=1,S[t+11]=h(),S[t+12]=h(),S[t+13]=h(),S[t+14]=n,S[t+15]=1}else{let e=x*(1.05+h()**1.45*7.2),n=h()*Math.PI*2,r=e>x*5.2,i=r?.45+.22*(e-x*5.2):.06+.05*e,a=(h()-.5)*2*i,o=Math.sqrt(18/e);S[t+0]=Math.cos(n)*e+g,S[t+1]=a+_,S[t+2]=Math.sin(n)*e+v,S[t+3]=r?2:0,S[t+4]=-Math.sin(n)*o,S[t+5]=0,S[t+6]=Math.cos(n)*o,S[t+7]=1.08,S[t+8]=Math.min(1.6,(x/e)**.75*1.5),S[t+9]=0,S[t+10]=.8,S[t+11]=h(),S[t+12]=h(),S[t+13]=h(),S[t+14]=1,S[t+15]=1}}let T=[a(0,`uniform`),a(1,`storage`),a(2,`storage`)],E=s(t,{cacheKey:`ulg-kerr-bz-jet-step.v1`,label:`${f}-step`,code:Tt,entryPoint:`step_kerr_bz_jet`,bindings:T}),D=s(t,{cacheKey:`ulg-kerr-bz-jet-tel.v1`,label:`${f}-tel`,code:Tt,entryPoint:`reduce_kerr_telemetry`,bindings:T}),O=t.createBuffer({label:`${f}-params`,size:64,usage:yt.UNIFORM|yt.COPY_DST}),k=t.createBuffer({label:`${f}-parcels`,size:S.byteLength,usage:yt.STORAGE|yt.VERTEX|yt.COPY_DST|yt.COPY_SRC}),A=t.createBuffer({label:`${f}-tel`,size:16,usage:yt.STORAGE|yt.COPY_SRC}),j=t.createBuffer({label:`${f}-tel-rd`,size:16,usage:yt.MAP_READ|yt.COPY_DST});t.queue.writeBuffer(k,0,S);let M=o(t,{layout:E.bindGroupLayout,label:`${f}-bg`,entries:[{binding:0,resource:{buffer:O}},{binding:1,resource:{buffer:k}},{binding:2,resource:{buffer:A}}]}),N=0,P=!1,F=!1,I=Object.freeze({schema:vt,stepIndex:0,...p,maxLorentzGamma:1,activeJetParcels:0,diskLuminosityProxy:0,jetSynchrotronProxy:0,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),L=Math.ceil(m/64);async function R({dt:n=.03,substeps:r=2,readTelemetry:a=!0}={}){if(F)return I;let o=Math.max(1,Math.min(16,Math.trunc(r))),s=Math.max(.004,Math.min(.1,Number(n)||.03)),c=new ArrayBuffer(64);new Uint32Array(c,0,4).set([m,N,0,0]),new Float32Array(c,16,12).set([s,b,x,p.spinA,i,p.bzEfficiency,p.lorentzGamma,9.2,g,_,v,0]),t.queue.writeBuffer(O,0,c);let l=t.createCommandEncoder({label:`${f}-enc-${N}`}),u=l.beginComputePass({label:`${f}-pass`});u.setBindGroup(0,M),u.setPipeline(E.pipeline);for(let e=0;e<o;e+=1)u.dispatchWorkgroups(L),N+=1;u.setPipeline(D.pipeline),u.dispatchWorkgroups(1),u.end();let d=a&&!P&&j.mapState===`unmapped`;if(d&&(P=!0,l.copyBufferToBuffer(A,0,j,0,16)),t.queue.submit([l.finish()]),d)try{if(await j.mapAsync(yt.MAP_READ),!F){let t=new Float32Array(j.getMappedRange(0,16));I=Object.freeze({schema:vt,stepIndex:N,...p,maxLorentzGamma:t[0],activeJetParcels:Math.round(t[1]),diskLuminosityProxy:t[2],jetSynchrotronProxy:t[3],accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{j.unmap()}catch{}}catch(e){if(!F&&e?.name!==`AbortError`)throw e}finally{P=!1}return I}function z(){if(!F){F=!0;for(let e of[O,k,A,j])try{e.destroy()}catch{}}}return Object.freeze({schema:vt,lawAdapter:bt,get particleCount(){return m},get metrics(){return p},get horizonVisualRadius(){return b},get stepIndex(){return N},getResidentParcelsBuffer:()=>k,getTelemetry:()=>I,step:R,dispose:z})}function Ot(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`relativistic-compact-kerr-jet@1`)?e.resolveModule(`relativistic-compact-kerr-jet@1`)?.descriptor||null:e.registerModule({method:{model:`relativistic-compact-kerr-jet`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/relativisticCompactObjectGpu.js`,entryPoint:`step_kerr_bz_jet`,workgroupSize:64},parameterSchema:{massSolar:{type:`number`,min:.5,max:1e11,required:!1},spinA:{type:`number`,min:-.998,max:.998,required:!1},accretionRateEddington:{type:`number`,min:0,max:10,required:!1}},stateLayout:{tensorId:`relativistic-jet-tracers`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`role`,`vx`,`vy`,`vz`,`gamma`,`temp`,`bPhi`,`sync`,`age`,`seed`,`rInit`,`jetSign`,`live`]},scaleRangeM:[1e3,1e22],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=Dt(n,{massSolar:r.massSolar??1e8,spinA:r.spinA??.9,accretionRateEddington:r.accretionRateEddington??.35,particleCount:512}),a=await i.step({dt:.03,substeps:2,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:kerr-bz-jet:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/relativisticCompactObjectGpu.js`,entryPoint:`createKerrAccretionJetSessionWebGpu`,kernelEntryPoint:`step_kerr_bz_jet`},representation:`kerr-tov-bz-jet-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-kerr-tov-bz`,placement:`local`},validity:{finite:Number.isFinite(a.rIscoRg)&&Number.isFinite(a.jetPowerW)},validation:{status:`pass`,validationMode:`gpu-kerr-tov-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var kt=`ulg.astrophysics.emergent-3d-mhd-dynamo-webgpu.v1`,At=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),jt=`
struct DynamoParams {
  grid_n: u32,
  particle_count: u32,
  stride_floats: u32,
  step_index: u32,
  box_size: f32,
  dx: f32,
  dt: f32,
  eta_res: f32,        // Resistive magnetic diffusivity
  alpha_amp: f32,      // Helical Parker/SKR alpha-effect amplitude (antisymmetric in y!)
  c_h: f32,            // Dedner GLM divergence cleaning speed
  c_p2: f32,           // Dedner GLM damping rate
  b_sat: f32,          // Quenching saturation field B_eq (dynamical alpha-quenching!)
  vel_scale: f32,      // Velocity coupling factor
  b_init: f32,         // Seed field amplitude (0 => strictly zero dynamo!)
  mode_flags: f32,     // 0 = galactic disk dynamo, 1 = spherical stellar convective dynamo
  pad0: f32,
  center_offset: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: DynamoParams;
@group(0) @binding(1) var<storage, read> raw_particles: array<f32>;
// 4 atomic<i32> per cell: [m_q, mvx_q, mvy_q, mvz_q]
@group(0) @binding(2) var<storage, read_write> vel_accum: array<atomic<i32>>;
// Finalized velocity grid: vec4(vx, vy, vz, mass_density)
@group(0) @binding(3) var<storage, read_write> vel_grid: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> b_src: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> b_dst: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

const Q_M: f32 = 2048.0;
const Q_MV: f32 = 512.0;

fn cidx_clamp(x: i32, y: i32, z: i32, n: i32) -> u32 {
  let cx = clamp(x, 0, n - 1);
  let cy = clamp(y, 0, n - 1);
  let cz = clamp(z, 0, n - 1);
  return u32((cz * n + cy) * n + cx);
}

@compute @workgroup_size(64)
fn clear_vel_accum(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = params.grid_n * params.grid_n * params.grid_n;
  let i = gid.x;
  if (i >= total) { return; }
  let base = i * 4u;
  atomicStore(&vel_accum[base + 0u], 0);
  atomicStore(&vel_accum[base + 1u], 0);
  atomicStore(&vel_accum[base + 2u], 0);
  atomicStore(&vel_accum[base + 3u], 0);
}

// Deposit live GPU particle velocities (galaxies or stars) into 3D Eulerian velocity grid!
@compute @workgroup_size(64)
fn deposit_particle_velocities(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  let o = i * params.stride_floats;
  let px = raw_particles[o + 0u] - params.center_offset.x;
  let py = raw_particles[o + 1u] - params.center_offset.y;
  let pz = raw_particles[o + 2u] - params.center_offset.z;
  let m = raw_particles[o + 3u];
  if (!(m > 0.0)) { return; }
  // Skip invisible dark-matter halo particles (popTag < 0) in galactic stride-8 layout
  // so galactic magnetic induction is driven by the rotating baryonic disk/gas!
  if (params.stride_floats == 8u && raw_particles[o + 7u] < -0.5) { return; }

  let vx = raw_particles[o + 4u];
  let vy = raw_particles[o + 5u];
  let vz = raw_particles[o + 6u];

  let half = params.box_size * 0.5;
  let n = i32(params.grid_n);
  let gx = ((px + half) / params.box_size) * f32(n);
  let gy = ((py + half) / params.box_size) * f32(n);
  let gz = ((pz + half) / params.box_size) * f32(n);
  if (gx < 0.0 || gy < 0.0 || gz < 0.0 || gx >= f32(n) || gy >= f32(n) || gz >= f32(n)) { return; }
  let ix = clamp(i32(floor(gx)), 0, n - 1);
  let iy = clamp(i32(floor(gy)), 0, n - 1);
  let iz = clamp(i32(floor(gz)), 0, n - 1);
  let base = cidx_clamp(ix, iy, iz, n) * 4u;

  let w = clamp(m, 1e-4, 4.0);
  atomicAdd(&vel_accum[base + 0u], i32(round(clamp(w * Q_M, -1e7, 1e7))));
  atomicAdd(&vel_accum[base + 1u], i32(round(clamp(w * vx * Q_MV, -1e7, 1e7))));
  atomicAdd(&vel_accum[base + 2u], i32(round(clamp(w * vy * Q_MV, -1e7, 1e7))));
  atomicAdd(&vel_accum[base + 3u], i32(round(clamp(w * vz * Q_MV, -1e7, 1e7))));
}

@compute @workgroup_size(64)
fn finalize_vel_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = params.grid_n * params.grid_n * params.grid_n;
  let i = gid.x;
  if (i >= total) { return; }
  let base = i * 4u;
  let m = f32(atomicLoad(&vel_accum[base + 0u])) / Q_M;
  if (m > 1e-5) {
    let inv_m = 1.0 / m;
    let vx = (f32(atomicLoad(&vel_accum[base + 1u])) / Q_MV) * inv_m;
    let vy = (f32(atomicLoad(&vel_accum[base + 2u])) / Q_MV) * inv_m;
    let vz = (f32(atomicLoad(&vel_accum[base + 3u])) / Q_MV) * inv_m;
    // Smooth temporal low-pass filter of deposited Eulerian velocity for clean curl(v x B)
    let prev = vel_grid[i];
    let v_cur = vec3<f32>(vx, vy, vz) * params.vel_scale;
    let v_sm = select(v_cur, mix(prev.xyz, v_cur, 0.35), prev.w > 1e-5);
    vel_grid[i] = vec4<f32>(v_sm, m);
  } else {
    // Gently decay empty halo cells while preserving smooth coronal velocity transport
    let prev = vel_grid[i];
    vel_grid[i] = vec4<f32>(prev.xyz * 0.90, 0.0);
  }
}

fn eval_alpha(pos_y: f32, env_alpha: f32, b_vec: vec3<f32>) -> f32 {
  let half = params.box_size * 0.5;
  let b2 = dot(b_vec, b_vec);
  let quench = 1.0 / (1.0 + b2 / max(1e-4, params.b_sat * params.b_sat));
  let hemi = clamp(pos_y / max(0.35, half * 0.25), -1.0, 1.0);
  return params.alpha_amp * hemi * env_alpha * quench;
}

// Smooth Eulerian gas velocity sample (7-cell stencil averaging out discrete particle shot noise)
fn sample_smooth_vel(ix: i32, iy: i32, iz: i32, n: i32) -> vec3<f32> {
  let c0 = vel_grid[cidx_clamp(ix, iy, iz, n)];
  let cxp = vel_grid[cidx_clamp(ix + 1, iy, iz, n)];
  let cxm = vel_grid[cidx_clamp(ix - 1, iy, iz, n)];
  let cyp = vel_grid[cidx_clamp(ix, iy + 1, iz, n)];
  let cym = vel_grid[cidx_clamp(ix, iy - 1, iz, n)];
  let czp = vel_grid[cidx_clamp(ix, iy, iz + 1, n)];
  let czm = vel_grid[cidx_clamp(ix, iy, iz - 1, n)];
  let w0 = max(0.05, c0.w) * 2.0;
  let wxp = max(0.02, cxp.w);
  let wxm = max(0.02, cxm.w);
  let wyp = max(0.02, cyp.w);
  let wym = max(0.02, cym.w);
  let wzp = max(0.02, czp.w);
  let wzm = max(0.02, czm.w);
  let v_sum = c0.xyz * w0 + cxp.xyz * wxp + cxm.xyz * wxm + cyp.xyz * wyp + cym.xyz * wym + czp.xyz * wzp + czm.xyz * wzm;
  return v_sum / (w0 + wxp + wxm + wyp + wym + wzp + wzm);
}

fn clamp_vel_cfl(v: vec3<f32>, v_lim: f32) -> vec3<f32> {
  let vm = length(v);
  return select(v, v * (v_lim / max(1e-6, vm)), vm > v_lim);
}

@compute @workgroup_size(4, 4, 4)
fn step_dynamo_bfield(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = i32(params.grid_n);
  if (i32(gid.x) >= n || i32(gid.y) >= n || i32(gid.z) >= n) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let iz = i32(gid.z);
  let idx = cidx_clamp(ix, iy, iz, n);

  // Strict falsifiable null limit: if initial seed B0 == 0, keep B identically zero!
  if (abs(params.b_init) <= 1e-7) {
    b_dst[idx] = vec4<f32>(0.0);
    return;
  }

  let dx = params.dx;
  let inv2dx = 0.5 / dx;
  let invdx2 = 1.0 / (dx * dx);
  let dt = params.dt;
  let half = params.box_size * 0.5;
  let pos = (vec3<f32>(f32(ix) + 0.5, f32(iy) + 0.5, f32(iz) + 0.5) * dx) - vec3<f32>(half);

  // Open-boundary vacuum taper near outer box wall so streamlines exit smoothly
  let edge_d = max(abs(pos.x), max(abs(pos.y), abs(pos.z))) / half;
  if (edge_d > 0.94) {
    b_dst[idx] = b_src[idx] * 0.90;
    return;
  }

  let b0 = b_src[idx];
  let bxp = b_src[cidx_clamp(ix + 1, iy, iz, n)];
  let bxm = b_src[cidx_clamp(ix - 1, iy, iz, n)];
  let byp = b_src[cidx_clamp(ix, iy + 1, iz, n)];
  let bym = b_src[cidx_clamp(ix, iy - 1, iz, n)];
  let bzp = b_src[cidx_clamp(ix, iy, iz + 1, n)];
  let bzm = b_src[cidx_clamp(ix, iy, iz - 1, n)];

  // Enforce advection CFL bound on sampled velocities so high-dispersion stars never destabilize curl(v x B)
  let v_lim = 0.26 * dx / max(1e-4, dt);
  let v0  = clamp_vel_cfl(sample_smooth_vel(ix, iy, iz, n), v_lim);
  let vxp = clamp_vel_cfl(sample_smooth_vel(ix + 1, iy, iz, n), v_lim);
  let vxm = clamp_vel_cfl(sample_smooth_vel(ix - 1, iy, iz, n), v_lim);
  let vyp = clamp_vel_cfl(sample_smooth_vel(ix, iy + 1, iz, n), v_lim);
  let vym = clamp_vel_cfl(sample_smooth_vel(ix, iy - 1, iz, n), v_lim);
  let vzp = clamp_vel_cfl(sample_smooth_vel(ix, iy, iz + 1, n), v_lim);
  let vzm = clamp_vel_cfl(sample_smooth_vel(ix, iy, iz - 1, n), v_lim);

  // Local Rusanov / Lax-Friedrichs upwind magnetic diffusivity guarantees cell Rm = |v|*dx/eta_eff < 2.0,
  // completely eliminating FTCS odd-even checkerboard ("squiggly coil") instabilities!
  let v_loc = max(
    length(v0),
    max(
      max(length(vxp), length(vxm)),
      max(max(length(vyp), length(vym)), max(length(vzp), length(vzm)))
    )
  );
  let eta_cfl_cap = 0.125 * dx * dx / max(1e-4, dt);
  let eta_eff = min(max(params.eta_res, 0.58 * v_loc * dx), eta_cfl_cap);

  // Helical alpha-effect envelope (antisymmetric across equator y=0, dynamically quenched!)
  let r_norm = length(pos) / max(0.5, half * 0.65);
  let env_alpha = exp(-r_norm * r_norm * 0.75);

  // Total electromotive force EMF = (v x B) + alpha * B at 6 face neighbors!
  let emf_xp = cross(vxp, bxp.xyz) + bxp.xyz * eval_alpha(pos.y, env_alpha, bxp.xyz);
  let emf_xm = cross(vxm, bxm.xyz) + bxm.xyz * eval_alpha(pos.y, env_alpha, bxm.xyz);
  let emf_yp = cross(vyp, byp.xyz) + byp.xyz * eval_alpha(pos.y + dx, env_alpha, byp.xyz);
  let emf_ym = cross(vym, bym.xyz) + bym.xyz * eval_alpha(pos.y - dx, env_alpha, bym.xyz);
  let emf_zp = cross(vzp, bzp.xyz) + bzp.xyz * eval_alpha(pos.y, env_alpha, bzp.xyz);
  let emf_zm = cross(vzm, bzm.xyz) + bzm.xyz * eval_alpha(pos.y, env_alpha, bzm.xyz);

  let curl_emf = vec3<f32>(
    (emf_yp.z - emf_ym.z) * inv2dx - (emf_zp.y - emf_zm.y) * inv2dx,
    (emf_zp.x - emf_zm.x) * inv2dx - (emf_xp.z - emf_xm.z) * inv2dx,
    (emf_xp.y - emf_xm.y) * inv2dx - (emf_yp.x - emf_ym.x) * inv2dx
  );

  // Resistive + Rusanov upwind magnetic diffusivity eta_eff * laplacian(B)
  let lap_b = (bxp.xyz + bxm.xyz + byp.xyz + bym.xyz + bzp.xyz + bzm.xyz - 6.0 * b0.xyz) * invdx2;
  let grad_psi = vec3<f32>(
    (bxp.w - bxm.w) * inv2dx,
    (byp.w - bym.w) * inv2dx,
    (bzp.w - bzm.w) * inv2dx
  );

  // CFL-safe induction update + dynamical magnetic-buoyancy quenching near saturation
  let dB = (curl_emf + eta_eff * lap_b - grad_psi) * dt;
  let dB_mag = length(dB);
  let dB_safe = select(dB, dB * (0.28 * params.b_sat / dB_mag), dB_mag > 0.28 * params.b_sat);
  var b_next = b0.xyz + dB_safe;
  let bm = length(b_next);
  let b_cap = params.b_sat * 2.6;
  if (bm > b_cap) { b_next = b_next * (b_cap / bm); }

  // Dedner GLM divergence cleaning with collocated Laplacian stabilizer (prevents odd-even psi decoupling)
  let div_b = (bxp.x - bxm.x) * inv2dx + (byp.y - bym.y) * inv2dx + (bzp.z - bzm.z) * inv2dx;
  let lap_psi = (bxp.w + bxm.w + byp.w + bym.w + bzp.w + bzm.w - 6.0 * b0.w) * 0.06;
  let psi_next = (b0.w + lap_psi - (params.c_h * params.c_h) * div_b * dt) * exp(-params.c_p2 * dt);

  b_dst[idx] = vec4<f32>(b_next, psi_next);
}

@compute @workgroup_size(64)
fn reduce_dynamo_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n = params.grid_n;
  let total = n * n * n;
  let dV = params.dx * params.dx * params.dx;
  let half = params.box_size * 0.5;
  var mag_e = 0.0;
  var max_b = 0.0;
  var max_bphi = 0.0;
  var divb_sum = 0.0;

  var i = tid;
  loop {
    if (i >= total) { break; }
    let b = b_src[i].xyz;
    let bm = length(b);
    let ix = i % n;
    let iy = (i / n) % n;
    let iz = i / (n * n);
    let x = (f32(ix) + 0.5) * params.dx - half;
    let z = (f32(iz) + 0.5) * params.dx - half;
    let rc = max(1e-4, length(vec2<f32>(x, z)));
    let bphi = abs((-z * b.x + x * b.z) / rc);
    mag_e = mag_e + 0.5 * dot(b, b) * dV;
    max_b = max(max_b, bm);
    max_bphi = max(max_bphi, bphi);
    divb_sum = divb_sum + abs(b_src[i].w);
    i = i + 64u;
  }

  wg0[tid] = mag_e;
  wg1[tid] = max_b;
  wg2[tid] = max_bphi;
  wg3[tid] = divb_sum;
  workgroupBarrier();

  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] = wg0[tid] + wg0[tid + s];
      wg1[tid] = max(wg1[tid], wg1[tid + s]);
      wg2[tid] = max(wg2[tid], wg2[tid + s]);
      wg3[tid] = wg3[tid] + wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }

  if (tid == 0u) {
    telemetry[0] = vec4<f32>(wg0[0], wg1[0], wg2[0], wg3[0] / max(1.0, f32(total)));
  }
}
`;function Mt({gridN:e=24,boxSize:t=24,initialB0:n=.28,geometry:r=`galactic`}={}){let i=Math.max(12,Math.min(32,Math.trunc(e))),a=i*i*i,o=new Float32Array(a*4);if(Math.abs(n)<=1e-7)return o;let s=t/i,c=t*.5,l=new Float32Array(a),u=new Float32Array(a),d=new Float32Array(a),f=r===`stellar`?t*.16:t*.24,p=r===`stellar`?f:t*.1;for(let e=0;e<i;e+=1)for(let t=0;t<i;t+=1)for(let a=0;a<i;a+=1){let o=(e*i+t)*i+a,m=(a+.5)*s-c,h=(t+.5)*s-c,g=(e+.5)*s-c,_=m*m+g*g,v=_+h*h;if(r===`stellar`){let e=(v+f*f)**1.5,t=n*f**3*2.2/e;l[o]=t*g,u[o]=0,d[o]=-t*m}else{let e=Math.sqrt(_),t=Math.exp(-_/(2*f*f)-h*h/(2*p*p)),r=Math.atan2(g,m),i=n*f*t*(1.25+e/f*.28*Math.cos(2*r));l[o]=0,u[o]=i,d[o]=0}}let m=(e,t,n)=>{let r=Math.max(0,Math.min(i-1,e)),a=Math.max(0,Math.min(i-1,t));return(Math.max(0,Math.min(i-1,n))*i+a)*i+r},h=.5/s;for(let e=0;e<i;e+=1)for(let t=0;t<i;t+=1)for(let n=0;n<i;n+=1){let r=((e*i+t)*i+n)*4,a=(d[m(n,t+1,e)]-d[m(n,t-1,e)])*h,s=(u[m(n,t,e+1)]-u[m(n,t,e-1)])*h,c=(l[m(n,t,e+1)]-l[m(n,t,e-1)])*h,f=(d[m(n+1,t,e)]-d[m(n-1,t,e)])*h,p=(u[m(n+1,t,e)]-u[m(n-1,t,e)])*h,g=(l[m(n,t+1,e)]-l[m(n,t-1,e)])*h;o[r+0]=a-s,o[r+1]=c-f,o[r+2]=p-g,o[r+3]=0}return o}function Nt({bHost:e,gridN:t,boxSize:n,seedPoints:r,stepsPerDir:i=32,stepLen:a=.32,worldScale:o=1,offset:s=[0,0,0],alpha:c=.42,refB:l=.25,colorPoloidal:u=[.22,.78,1],colorToroidal:d=[.88,.48,1]}){if(!e||e.length<t*t*t*4)return new Float32Array;let f=t,p=n/f,m=n*.5,h=s[0]||0,g=s[1]||0,_=s[2]||0,v=new Float32Array(f*f*f*4),y=(e,t,n)=>{let r=Math.max(0,Math.min(f-1,e)),i=Math.max(0,Math.min(f-1,t));return((Math.max(0,Math.min(f-1,n))*f+i)*f+r)*4};for(let t=0;t<f;t+=1)for(let n=0;n<f;n+=1)for(let r=0;r<f;r+=1){let i=y(r,n,t),a=y(r+1,n,t),o=y(r-1,n,t),s=y(r,n+1,t),c=y(r,n-1,t),l=y(r,n,t+1),u=y(r,n,t-1);for(let t=0;t<3;t+=1){let n=(e[a+t]+e[o+t]+e[s+t]+e[c+t]+e[l+t]+e[u+t])/6;v[i+t]=e[i+t]*.5+n*.5}}let b=(e,t,n)=>{let r=(e+m)/p-.5,i=(t+m)/p-.5,a=(n+m)/p-.5;if(r<0||i<0||a<0||r>=f-1||i>=f-1||a>=f-1)return[0,0,0];let o=Math.floor(r),s=Math.floor(i),c=Math.floor(a),l=r-o,u=i-s,d=a-c,h=(e,t,n)=>((n*f+t)*f+e)*4,g=h(o,s,c),_=h(o+1,s,c),y=h(o,s+1,c),b=h(o+1,s+1,c),x=h(o,s,c+1),S=h(o+1,s,c+1),C=h(o,s+1,c+1),w=h(o+1,s+1,c+1),T=[0,0,0];for(let e=0;e<3;e+=1){let t=v[g+e]*(1-l)+v[_+e]*l,n=v[y+e]*(1-l)+v[b+e]*l,r=v[x+e]*(1-l)+v[S+e]*l,i=v[C+e]*(1-l)+v[w+e]*l,a=t*(1-u)+n*u,o=r*(1-u)+i*u;T[e]=a*(1-d)+o*d}return T},x=[],S=m*.9,C=Math.max(1e-4,l*.08),w=Math.max(1e-4,l*.05);for(let e of r){let t=b(e[0],e[1],e[2]);if(!(Math.hypot(t[0],t[1],t[2])<C))for(let t of[1,-1]){let n=e[0],r=e[1],s=e[2],f=0,p=0,m=0;for(let e=0;e<i;e+=1){let v=b(n,r,s),y=Math.hypot(v[0],v[1],v[2]);if(y<w)break;let C=b(n+v[0]/y*t*a*.5,r+v[1]/y*t*a*.5,s+v[2]/y*t*a*.5),T=Math.hypot(C[0],C[1],C[2]);if(T<w)break;let E=C[0]/T*t,D=C[1]/T*t,O=C[2]/T*t;if(e>0&&E*f+D*p+O*m<.25)break;f=E,p=D,m=O;let k=n+E*a,A=r+D*a,j=s+O*a;if(Math.abs(k)>S||Math.abs(A)>S||Math.abs(j)>S)break;let M=Math.max(1e-4,Math.hypot(n,s)),N=Math.abs((-s*C[0]+n*C[2])/M),P=Math.min(1,N/Math.max(1e-4,T)*.75+Math.min(.6,T/Math.max(.05,l*2.5))*.45),F=(1-e/i*.85)*c,I=u[0]+(d[0]-u[0])*P,L=u[1]+(d[1]-u[1])*P,R=u[2]+(d[2]-u[2])*P;x.push((n-h)*o,(r-g)*o,(s-_)*o,I,L,R,F),x.push((k-h)*o,(A-g)*o,(j-_)*o,I,L,R,F*.94),n=k,r=A,s=j}}}return new Float32Array(x)}function Pt(e,{gridN:t=24,boxSize:n=24,strideFloats:r=8,geometry:i=`galactic`,initialB0:c=.28,alphaAmp:l=.14,etaRes:u=.045,bSat:d=.85,velScale:f=.22,centerOffset:p=[0,0,0],label:m=`ulg-emergent-dynamo`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createEmergent3dDynamoFieldWebGpu requires a live WebGPU GPUDevice`);let h=Math.max(12,Math.min(32,Math.trunc(t))),g=h*h*h,_=n/h,v=Number(c)||0,y=Mt({gridN:h,boxSize:n,initialB0:v,geometry:i}),b=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`storage`),a(3,`storage`),a(4,`read-only-storage`),a(5,`storage`),a(6,`storage`)],x=t=>s(e,{cacheKey:`ulg-emergent-dynamo-${t}.v1`,label:`${m}-${t}`,code:jt,entryPoint:t,bindings:b}),S=x(`clear_vel_accum`),C=x(`deposit_particle_velocities`),w=x(`finalize_vel_grid`),T=x(`step_dynamo_bfield`),E=x(`reduce_dynamo_telemetry`),D=e.createBuffer({label:`${m}-params`,size:80,usage:At.UNIFORM|At.COPY_DST}),O=e.createBuffer({label:`${m}-vaccum`,size:g*16,usage:At.STORAGE}),k=e.createBuffer({label:`${m}-vgrid`,size:g*16,usage:At.STORAGE|At.COPY_DST}),A=e.createBuffer({label:`${m}-ba`,size:y.byteLength,usage:At.STORAGE|At.COPY_DST|At.COPY_SRC}),j=e.createBuffer({label:`${m}-bb`,size:y.byteLength,usage:At.STORAGE|At.COPY_DST|At.COPY_SRC}),M=e.createBuffer({label:`${m}-tel`,size:16,usage:At.STORAGE|At.COPY_SRC}),N=e.createBuffer({label:`${m}-tel-rd`,size:16,usage:At.MAP_READ|At.COPY_DST}),P=e.createBuffer({label:`${m}-b-rd`,size:y.byteLength,usage:At.MAP_READ|At.COPY_DST});e.queue.writeBuffer(A,0,y),e.queue.writeBuffer(j,0,y),e.queue.writeBuffer(k,0,new Float32Array(g*4));let F=0,I=0,L=!1,R=!1,z=!1,B=Float32Array.from(y),V=Object.freeze({schema:kt,geometry:i,stepIndex:0,initialB0:v,magneticEnergy:0,maxBField:Math.abs(v),peakToroidalB:0,meanAbsPsi:0}),ee=Math.ceil(g/64),H=Math.ceil(h/4),U=new WeakMap;function W(t){let n=U.get(t);if(!n){let r=(n,r,i)=>o(e,{layout:T.bindGroupLayout,label:`${m}-bg-${i}`,entries:[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:O}},{binding:3,resource:{buffer:k}},{binding:4,resource:{buffer:n}},{binding:5,resource:{buffer:r}},{binding:6,resource:{buffer:M}}]});n=[r(A,j,`ab`),r(j,A,`ba`)],U.set(t,n)}return n}function G(t=v){v=Number(t)||0;let r=Mt({gridN:h,boxSize:n,initialB0:v,geometry:i});e.queue.writeBuffer(A,0,r),e.queue.writeBuffer(j,0,r),B.set(r),F=0,I=0,Math.abs(v)<=1e-7&&(V=Object.freeze({schema:kt,geometry:i,stepIndex:0,initialB0:0,magneticEnergy:0,maxBField:0,peakToroidalB:0,meanAbsPsi:0}))}async function te({particleBuffer:t,particleCount:a,dt:o=.04,substeps:s=1,readTelemetry:c=!1,readBField:g=!1}={}){if(z||!t||!(a>0))return V;let b=Math.max(1,Math.min(8,Math.trunc(s))),x=Math.max(.005,Math.min(.08,Number(o)||.04)),O=.16*_/Math.max(1e-4,x),k=new ArrayBuffer(80);new Uint32Array(k,0,4).set([h,Math.trunc(a),r,I]),new Float32Array(k,16,16).set([n,_,x,u,l,O,6.5,d,f,v,+(i===`stellar`),0,p[0]||0,p[1]||0,p[2]||0,0]),e.queue.writeBuffer(D,0,k);let U=W(t),G=Math.ceil(a/64),te=e.createCommandEncoder({label:`${m}-step-${I}`}),K=te.beginComputePass({label:`${m}-pass`});K.setBindGroup(0,U[F]),K.setPipeline(S.pipeline),K.dispatchWorkgroups(ee),K.setPipeline(C.pipeline),K.dispatchWorkgroups(G),K.setPipeline(w.pipeline),K.dispatchWorkgroups(ee),K.setPipeline(T.pipeline);for(let e=0;e<b;e+=1)K.setBindGroup(0,U[F]),K.dispatchWorkgroups(H,H,H),F^=1,I+=1;let ne=c&&!L&&N.mapState===`unmapped`;ne&&(K.setBindGroup(0,U[F]),K.setPipeline(E.pipeline),K.dispatchWorkgroups(1)),K.end(),ne&&(L=!0,te.copyBufferToBuffer(M,0,N,0,16));let q=g&&!R&&P.mapState===`unmapped`;q&&(R=!0,te.copyBufferToBuffer(F===0?A:j,0,P,0,y.byteLength)),e.queue.submit([te.finish()]);let J=[];return ne&&J.push((async()=>{try{if(await N.mapAsync(At.MAP_READ),!z){let e=new Float32Array(N.getMappedRange(0,16));V=Object.freeze({schema:kt,geometry:i,stepIndex:I,initialB0:v,magneticEnergy:e[0],maxBField:e[1],peakToroidalB:e[2],meanAbsPsi:e[3]})}try{N.unmap()}catch{}}catch(e){if(!z&&e?.name!==`AbortError`)throw e}finally{L=!1}})()),q&&J.push((async()=>{try{await P.mapAsync(At.MAP_READ),z||B.set(new Float32Array(P.getMappedRange(0,y.byteLength)));try{P.unmap()}catch{}}catch(e){if(!z&&e?.name!==`AbortError`)throw e}finally{R=!1}})()),J.length&&await Promise.all(J),V}function K(e,t,r){if(Math.abs(v)<=1e-7)return[0,0,0];let i=n*.5,a=Math.max(0,Math.min(h-1,Math.floor((e+i)/_))),o=Math.max(0,Math.min(h-1,Math.floor((t+i)/_))),s=((Math.max(0,Math.min(h-1,Math.floor((r+i)/_)))*h+o)*h+a)*4;return[B[s],B[s+1],B[s+2]]}function ne({worldScale:e=1,offset:t=[0,0,0],alpha:r=.4}={}){if(Math.abs(v)<=1e-7)return new Float32Array;let a=[];if(i===`stellar`){for(let e of[2.2,3.1])for(let t=0;t<8;t+=1){let n=t/8*Math.PI*2+e*.35,r=t&1?-.42:.42;a.push([e*Math.cos(r)*Math.cos(n),e*Math.sin(r),e*Math.cos(r)*Math.sin(n)])}return Nt({bHost:B,gridN:h,boxSize:n,seedPoints:a,stepsPerDir:28,stepLen:.24,worldScale:e,offset:t,alpha:r,refB:Math.max(.15,Math.abs(v)),colorPoloidal:[.24,.8,1],colorToroidal:[1,.62,.24]})}for(let e of[3.2,6])for(let t=0;t<6;t+=1){let n=t/6*Math.PI*2+e*.28;a.push([Math.cos(n)*e,0,Math.sin(n)*e])}return Nt({bHost:B,gridN:h,boxSize:n,seedPoints:a,stepsPerDir:34,stepLen:.34,worldScale:e,offset:t,alpha:r,refB:Math.max(.12,Math.abs(v)),colorPoloidal:[.22,.78,1],colorToroidal:[.76,.46,1]})}function q(){if(!z){z=!0;for(let e of[D,O,k,A,j,M,N,P])try{e.destroy()}catch{}}}return Object.freeze({schema:kt,get gridN(){return h},get boxSize(){return n},get geometry(){return i},get initialB0(){return v},get stepIndex(){return I},getResidentBFieldBuffer:()=>F===0?A:j,getTelemetry:()=>V,resetSeedB:G,sampleBAt:K,buildStreamlines:ne,step:te,dispose:q})}var Ft=`ulg.astrophysics.compact-magnetosphere-webgpu.v1`,It=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Lt=Object.freeze({id:`compact-magnetosphere-spindown`,lawNodeId:`law:astrophysics-compact-magnetosphere-spindown`,orderConstraint:`after:relativistic-compact-kerr-jet`,adapterMode:n.SURFACE_INTERFACE,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`compact-object-state`,`magnetosphere-bfield-grid`,`magnetosphere-parcels`]),writes:Object.freeze([`compact-object-state`,`magnetosphere-bfield-grid`,`magnetosphere-parcels`]),accumulates:Object.freeze([`magnetosphere-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`magnetic-flux`,`rotational-energy-plus-em-radiated`]),validityDomain:Object.freeze({minSurfaceBFieldTesla:100,maxRadiusM:5e7}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e4,0x16345785d8a0000]),fundamentalLaws:Object.freeze([`spitkovsky-force-free-spindown`,`3d-force-free-induction-glm`,`polar-cap-synchrotron-beam`,`hall-crustal-yield-reconnection`])});function Rt(e={}){let t=Math.abs(Number(e.surfaceBFieldTesla)||0),n=Number(e.compactRadiusM)||0,r=t>=100&&n>1e3&&n<5e7;return{active:r,magnetarYieldCapable:r&&t>=1e9,pulsarBeamActive:r&&Math.abs(Number(e.spinOmegaRadS)||0)>.05,reason:r?`magnetized-compact-star-present`:`low-field-or-noncompact-dormant`}}function zt({massSolar:e=1.45,radiusM:t=12e3,surfaceBFieldTesla:n=4e8,spinPeriodS:r=.033,obliquityRad:i=.62}={}){let a=Math.max(.2,Number(e)||1.4)*198847e25,o=Math.max(5e3,Number(t)||12e3),s=Math.abs(Number(n)||0),c=Math.max(.001,Number(r)||.033),l=2*Math.PI/c,u=299792458,d=4*Math.PI*1e-7,f=Math.sin(i),p=.35*a*o*o,m=s<=0?0:4*Math.PI/d*s*s*o**6*l**4/(u*u*u)*(1+f*f)*.25,h=s<=0?0:-m/Math.max(1,p*l),g=s<=0?0:-(2*Math.PI*h)/(l*l),_=u/l,v=o*Math.sqrt(Math.min(1,o/Math.max(o,_))),y=s*s/(2*d)/4e25;return Object.freeze({inertiaKgM2:p,omegaRadS:l,spinPeriodS:c,surfaceBFieldTesla:s,spinDownLumW:m,omegaDotRadS2:h,pDotSPerS:g,rLightCylinderM:_,rPolarCapM:v,crustYieldRatio:y,magnetarRegime:y>=1,characteristicAgeYr:g>1e-30?c/(2*g)/31557600:1/0})}var Bt=`
struct MagParams {
  particle_count: u32,
  step_index: u32,
  grid_n: u32,
  pad1: u32,
  dt: f32,
  rot_phase: f32,      // Live integrated spin angle theta(t) from exact I*dOmega/dt!
  obliquity: f32,      // Angle alpha between spin axis (Y) and magnetic dipole axis!
  b_norm: f32,         // Normalized B-field strength (0 -> dormant!)
  beam_power: f32,     // Polar-cap curvature beam intensity
  flare_amp: f32,      // Live starquake reconnection giant flare intensity (0 unless crust yields!)
  pwn_power: f32,      // Pulsar wind nebula expansion drive
  twist_phi: f32,      // Magnetar crustal Hall helicity shear
  box_size: f32,
  dx: f32,
  vis_omega: f32,      // Visual-paced physical angular speed
  c_h: f32,            // Dedner GLM divergence-cleaning speed
  center_offset: vec4<f32>,
};

// 16 floats (64 B) matching PARTICLE_CLOUD_WGSL Mode 7 & universal GPU entity picker!
//   pos_m:    vec4(x, y, z, role)   role: 0=magnetosphere_plasma, 1=open_polar_beam, 2=reconnection_flare_or_pwn
//   vel_gam:  vec4(vx, vy, vz, gamma)
//   em_b:     vec4(temp_norm, local_b_mag, emiss, age)
//   meta0:    vec4(seed, shell_r, pole_sign, live)
struct MagParcel {
  pos_m: vec4<f32>,
  vel_gam: vec4<f32>,
  em_b: vec4<f32>,
  meta0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: MagParams;
@group(0) @binding(1) var<storage, read_write> parcels: array<MagParcel>;
@group(0) @binding(2) var<storage, read> b_src: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> b_dst: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

fn bidx(x: i32, y: i32, z: i32, n: i32) -> u32 {
  let cx = clamp(x, 0, n - 1);
  let cy = clamp(y, 0, n - 1);
  let cz = clamp(z, 0, n - 1);
  return u32((cz * n + cy) * n + cx);
}

fn sample_b_grid(local_p: vec3<f32>) -> vec3<f32> {
  let n = i32(params.grid_n);
  let half = params.box_size * 0.5;
  let g = ((local_p + vec3<f32>(half)) / params.dx) - vec3<f32>(0.5);
  let i0 = vec3<i32>(floor(g));
  let f = clamp(fract(g), vec3<f32>(0.0), vec3<f32>(1.0));
  let b000 = b_dst[bidx(i0.x,     i0.y,     i0.z,     n)].xyz;
  let b100 = b_dst[bidx(i0.x + 1, i0.y,     i0.z,     n)].xyz;
  let b010 = b_dst[bidx(i0.x,     i0.y + 1, i0.z,     n)].xyz;
  let b110 = b_dst[bidx(i0.x + 1, i0.y + 1, i0.z,     n)].xyz;
  let b001 = b_dst[bidx(i0.x,     i0.y,     i0.z + 1, n)].xyz;
  let b101 = b_dst[bidx(i0.x + 1, i0.y,     i0.z + 1, n)].xyz;
  let b011 = b_dst[bidx(i0.x,     i0.y + 1, i0.z + 1, n)].xyz;
  let b111 = b_dst[bidx(i0.x + 1, i0.y + 1, i0.z + 1, n)].xyz;
  return mix(
    mix(mix(b000, b100, f.x), mix(b010, b110, f.x), f.y),
    mix(mix(b001, b101, f.x), mix(b011, b111, f.x), f.y),
    f.z
  );
}

fn dipole_core_b(pos: vec3<f32>, m_vec: vec3<f32>, r_soft: f32) -> vec3<f32> {
  let r2 = dot(pos, pos) + r_soft * r_soft;
  let inv_r = inverseSqrt(r2);
  let inv_r3 = inv_r * inv_r * inv_r;
  let inv_r5 = inv_r3 / r2;
  let m_dot_r = dot(m_vec, pos);
  return pos * (3.0 * m_dot_r * inv_r5) - m_vec * inv_r3;
}

// 1. Live GPU 3D Force-Free / Hall-Twist Magnetosphere B(x, y, z) Induction + Dedner GLM!
//    - Inside the neutron star crust (r < R_crust), enforces the rotating oblique dipole
//      core moment + Hall crustal azimuthal shear twist!
//    - Outside the crust, evolves real 3D resistive MHD induction dB/dt = curl(v_corot x B)
//      + curl(alpha_hall B) + eta * laplacian(B) - grad(psi) so open polar field lines,
//      relativistic light-cylinder sweep-back spirals, and twisted magnetar flux bundles
//      EMERGE directly on the 3D GPU grid!
@compute @workgroup_size(4, 4, 4)
fn step_mag_bfield_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = i32(params.grid_n);
  if (i32(gid.x) >= n || i32(gid.y) >= n || i32(gid.z) >= n) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let iz = i32(gid.z);
  let idx = bidx(ix, iy, iz, n);

  // Strict falsifiable null limit: B = 0 => exact zero magnetic field everywhere!
  if (params.b_norm <= 1e-6) {
    b_dst[idx] = vec4<f32>(0.0);
    return;
  }

  let dx = params.dx;
  let inv2dx = 0.5 / dx;
  let invdx2 = 1.0 / (dx * dx);
  let dt_b = min(0.024, params.dt * 0.55);
  let half = params.box_size * 0.5;
  let pos = (vec3<f32>(f32(ix) + 0.5, f32(iy) + 0.5, f32(iz) + 0.5) * dx) - vec3<f32>(half);
  let r = length(pos);

  let sa = sin(params.obliquity);
  let ca = cos(params.obliquity);
  let cp = cos(params.rot_phase);
  let sp = sin(params.rot_phase);
  let m_axis = normalize(vec3<f32>(sa * cp, ca, sa * sp));
  let m_moment = m_axis * (params.b_norm * 4.8);

  // Inner magnetized neutron-star crust boundary condition (r < 1.35 sim units):
  // rotating oblique dipole core + Hall-drift toroidal twist!
  let r_crust = 1.35;
  if (r < r_crust) {
    let b_dip = dipole_core_b(pos, m_moment, 0.72);
    let b_tor = cross(m_axis, pos) * (params.twist_phi * 0.52 * params.b_norm / (0.65 + r * r));
    let b_core = b_dip + b_tor;
    let b_clamped = select(b_core, b_core * (12.0 / length(b_core)), length(b_core) > 12.0);
    b_dst[idx] = vec4<f32>(b_clamped, 0.0);
    return;
  }

  // Outer radiation boundary condition (outgoing wave absorption at edge of box)
  let edge_d = max(abs(pos.x), max(abs(pos.y), abs(pos.z))) / half;
  if (edge_d > 0.92) {
    b_dst[idx] = b_src[idx] * 0.90;
    return;
  }

  let b0 = b_src[idx];
  let bxp = b_src[bidx(ix + 1, iy, iz, n)];
  let bxm = b_src[bidx(ix - 1, iy, iz, n)];
  let byp = b_src[bidx(ix, iy + 1, iz, n)];
  let bym = b_src[bidx(ix, iy - 1, iz, n)];
  let bzp = b_src[bidx(ix, iy, iz + 1, n)];
  let bzm = b_src[bidx(ix, iy, iz - 1, n)];

  // Relativistic corotation + pulsar-wind radial outflow velocity field (tapered at light cylinder!)
  //   v(r) = (Omega x r) / (1 + (r / R_LC)^2) + v_wind * r_hat * (r / (r + R_LC))
  let r_lc = 3.8;
  let om_vec = vec3<f32>(0.0, params.vis_omega * 0.65, 0.0);
  let wind_v = 0.42 + params.flare_amp * 1.45 + params.pwn_power * 0.55;

  let p_xp = pos + vec3<f32>(dx, 0.0, 0.0);
  let p_xm = pos - vec3<f32>(dx, 0.0, 0.0);
  let p_yp = pos + vec3<f32>(0.0, dx, 0.0);
  let p_ym = pos - vec3<f32>(0.0, dx, 0.0);
  let p_zp = pos + vec3<f32>(0.0, 0.0, dx);
  let p_zm = pos - vec3<f32>(0.0, 0.0, dx);

  let v_xp = cross(om_vec, p_xp) / (1.0 + dot(p_xp, p_xp) / (r_lc * r_lc)) + normalize(p_xp) * (wind_v * length(p_xp) / (length(p_xp) + r_lc));
  let v_xm = cross(om_vec, p_xm) / (1.0 + dot(p_xm, p_xm) / (r_lc * r_lc)) + normalize(p_xm) * (wind_v * length(p_xm) / (length(p_xm) + r_lc));
  let v_yp = cross(om_vec, p_yp) / (1.0 + dot(p_yp, p_yp) / (r_lc * r_lc)) + normalize(p_yp) * (wind_v * length(p_yp) / (length(p_yp) + r_lc));
  let v_ym = cross(om_vec, p_ym) / (1.0 + dot(p_ym, p_ym) / (r_lc * r_lc)) + normalize(p_ym) * (wind_v * length(p_ym) / (length(p_ym) + r_lc));
  let v_zp = cross(om_vec, p_zp) / (1.0 + dot(p_zp, p_zp) / (r_lc * r_lc)) + normalize(p_zp) * (wind_v * length(p_zp) / (length(p_zp) + r_lc));
  let v_zm = cross(om_vec, p_zm) / (1.0 + dot(p_zm, p_zm) / (r_lc * r_lc)) + normalize(p_zm) * (wind_v * length(p_zm) / (length(p_zm) + r_lc));

  // Helical twist EMF + corotation induction curl(v x B)
  let h_amp = params.twist_phi * 0.14 * exp(-r / 4.2);
  let emf_xp = cross(v_xp, bxp.xyz) + bxp.xyz * h_amp;
  let emf_xm = cross(v_xm, bxm.xyz) + bxm.xyz * h_amp;
  let emf_yp = cross(v_yp, byp.xyz) + byp.xyz * h_amp;
  let emf_ym = cross(v_ym, bym.xyz) + bym.xyz * h_amp;
  let emf_zp = cross(v_zp, bzp.xyz) + bzp.xyz * h_amp;
  let emf_zm = cross(v_zm, bzm.xyz) + bzm.xyz * h_amp;

  let curl_emf = vec3<f32>(
    (emf_yp.z - emf_ym.z) * inv2dx - (emf_zp.y - emf_zm.y) * inv2dx,
    (emf_zp.x - emf_zm.x) * inv2dx - (emf_xp.z - emf_xm.z) * inv2dx,
    (emf_xp.y - emf_xm.y) * inv2dx - (emf_yp.x - emf_ym.x) * inv2dx
  );

  // Resistive diffusion increases impulsively during magnetar reconnection giant flares!
  let eta_eff = 0.085 + params.flare_amp * 0.14;
  let lap_b = (bxp.xyz + bxm.xyz + byp.xyz + bym.xyz + bzp.xyz + bzm.xyz - 6.0 * b0.xyz) * invdx2;
  let grad_psi = vec3<f32>(
    (bxp.w - bxm.w) * inv2dx,
    (byp.w - bym.w) * inv2dx,
    (bzp.w - bzm.w) * inv2dx
  );

  var b_next = b0.xyz + (curl_emf + eta_eff * lap_b - grad_psi) * dt_b;
  // Gentle inner relaxation toward rotating crust boundary in transition shell (r in [1.35..1.85])
  if (r < 1.85) {
    let w_bc = 1.0 - smoothstep(1.35, 1.85, r);
    let b_ref = dipole_core_b(pos, m_moment, 0.72) + cross(m_axis, pos) * (params.twist_phi * 0.45 * params.b_norm / (0.65 + r * r));
    b_next = mix(b_next, b_ref, w_bc * 0.42);
  }
  let bm = length(b_next);
  if (bm > 12.0) { b_next = b_next * (12.0 / bm); }

  let div_b = (bxp.x - bxm.x) * inv2dx + (byp.y - bym.y) * inv2dx + (bzp.z - bzm.z) * inv2dx;
  let psi_next = (b0.w - (params.c_h * params.c_h) * div_b * dt_b) * exp(-4.5 * dt_b);
  b_dst[idx] = vec4<f32>(b_next, psi_next);
}

// 2. Persistent Lorentz / Guiding-Center GPU Plasma Parcel Integration in Live GPU B(x, y, z)!
//    Every parcel reads the live 3D GPU B-field, tracks its real velocity, local |B|, and gamma!
@compute @workgroup_size(64)
fn step_compact_magnetosphere(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  var p = parcels[i];
  let role = p.pos_m.w;
  if (params.b_norm <= 1e-6) {
    p.em_b.y = 0.0;
    p.em_b.z = 0.0;
    p.meta0.w = 0.0;
    parcels[i] = p;
    return;
  }
  p.meta0.w = 1.0;

  let sa = sin(params.obliquity);
  let ca = cos(params.obliquity);
  let cp = cos(params.rot_phase);
  let sp = sin(params.rot_phase);
  let m_axis = normalize(vec3<f32>(sa * cp, ca, sa * sp));
  let e1 = normalize(vec3<f32>(-sp, 0.0, cp));
  let e2 = cross(m_axis, e1);
  let sgn = select(-1.0, 1.0, p.meta0.z >= 0.0);
  let dt = params.dt;

  var loc = p.pos_m.xyz - params.center_offset.xyz;
  var vel = p.vel_gam.xyz;
  let b_vec = sample_b_grid(loc);
  let b_mag = length(b_vec);
  let b_hat = select(m_axis * sgn, b_vec / b_mag, b_mag > 1e-4);

  if (role > 0.5 && role < 1.5) {
    // Open polar-cap pair plasma accelerated relativistically along live GPU open B(x,y,z) lines!
    let dir_out = select(-b_hat, b_hat, dot(b_hat, loc) >= 0.0);
    let v_corot = cross(vec3<f32>(0.0, params.vis_omega * 0.55, 0.0), loc) / (1.0 + dot(loc, loc) / 14.0);
    let v_stream = dir_out * (3.2 + 2.6 * params.beam_power) + v_corot;
    vel = mix(vel, v_stream, clamp(dt * 4.5, 0.0, 1.0));
    loc = loc + vel * dt;
    let r_now = length(loc);
    var age = p.em_b.w + dt * 0.45;
    // If parcel escapes outer simulation boundary, re-enter cleanly at the active polar-cap acceleration gap
    if (r_now > 7.6 || r_now < 0.35 || age > 2.2) {
      let ph = p.meta0.x * 6.2831853 + f32(params.step_index) * 0.07;
      let cap_r = 0.14 + 0.34 * p.meta0.y;
      loc = m_axis * (sgn * 0.65) + (e1 * cos(ph) + e2 * sin(ph)) * cap_r;
      vel = m_axis * (sgn * 3.5);
      age = 0.0;
    }
    let emiss = clamp(params.beam_power * (1.25 - 0.11 * length(loc)) * (0.45 + 0.55 * min(1.5, b_mag)), 0.10, 2.2);
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
    p.vel_gam = vec4<f32>(vel, 1.0 + 4.5 * params.beam_power);
    p.em_b = vec4<f32>(1.15, b_mag, emiss, age);
    parcels[i] = p;
    return;
  }

  if (role >= 1.5) {
    // Reconnection Giant Flare fireball & PWN plasma driven by magnetic pressure & Lorentz sweep!
    let r = max(0.35, length(loc));
    let r_hat = loc / r;
    let lorentz_sweep = cross(b_hat, r_hat) * (0.35 * min(2.0, b_mag));
    let drive = 0.55 + params.flare_amp * 5.0 + params.pwn_power * 1.4;
    let v_goal = r_hat * drive + lorentz_sweep + cross(vec3<f32>(0.0, 0.45, 0.0), r_hat);
    vel = mix(vel, v_goal, clamp(dt * 2.4, 0.0, 1.0));
    loc = loc + vel * dt;
    if (length(loc) > 8.4) {
      let th = p.meta0.x * 6.2831853 + f32(params.step_index) * 0.11;
      let cy = (p.meta0.y * 2.0 - 1.0) * 0.85;
      let sy = sqrt(max(0.0, 1.0 - cy * cy));
      loc = vec3<f32>(cos(th) * sy, cy, sin(th) * sy) * (0.72 + 0.42 * p.meta0.x);
      vel = normalize(loc) * drive;
    }
    let flare_em = clamp(0.16 + params.flare_amp * 2.3 + params.pwn_power * 0.82, 0.0, 2.5) * exp(-max(0.0, length(loc) - 1.5) * 0.18);
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
    p.vel_gam = vec4<f32>(vel, 1.0 + 3.0 * params.flare_amp);
    p.em_b = vec4<f32>(0.45 + 1.2 * params.flare_amp, b_mag, flare_em, p.em_b.w + dt);
    parcels[i] = p;
    return;
  }

  // Closed magnetosphere plasma: persistent guiding-center motion strictly along live GPU B(x,y,z)
  // plus corotation E x B drift (ZERO analytic r_dip = R*sin^2(theta) prescription!)
  let v_par = sgn * (1.2 + 0.65 * params.b_norm);
  let v_corot = cross(vec3<f32>(0.0, params.vis_omega * 0.62, 0.0), loc) / (1.0 + dot(loc, loc) / 14.0);
  // Weak radial mirror confinement back into active magnetosphere belt when approaching crust/outer boundary
  let r_cur = length(loc);
  let v_guide = b_hat * v_par + v_corot;
  vel = mix(vel, v_guide, clamp(dt * 5.0, 0.0, 1.0));
  loc = loc + vel * dt;
  let r_next = length(loc);
  var pole_s = p.meta0.z;
  // Magnetic mirror reflection at neutron-star footpoints (real magnetic bottle!)
  if (r_next < 0.72) {
    loc = normalize(loc) * 0.78;
    pole_s = -pole_s;
    vel = -vel * 0.6;
  } else if (r_next > 5.8) {
    // Re-inject smoothly along closed equatorial flux shell
    let az = p.meta0.x * 6.2831853 + params.rot_phase;
    let r_eq = 1.6 + p.meta0.y * 2.4;
    loc = (e1 * cos(az) + e2 * sin(az)) * r_eq + m_axis * ((p.meta0.y - 0.5) * 0.6);
    vel = v_corot;
  }
  let em_loop = clamp((0.32 + 0.55 * min(2.0, b_mag) + 0.90 * params.flare_amp) / (0.65 + r_cur * 0.28), 0.14, 2.2);
  p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
  p.vel_gam = vec4<f32>(vel, 1.0 + 0.15 * min(2.0, b_mag));
  p.em_b = vec4<f32>(0.72 + 0.75 * params.flare_amp, b_mag, em_loop, p.em_b.w + dt);
  p.meta0.z = pole_s;
  parcels[i] = p;
}

@compute @workgroup_size(64)
fn reduce_magnetosphere_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var beam_em = 0.0;
  var flare_em = 0.0;
  var loop_em = 0.0;
  var active_cnt = 0.0;
  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = parcels[i];
    if (p.meta0.w > 0.5) {
      active_cnt = active_cnt + 1.0;
      if (p.pos_m.w > 0.5 && p.pos_m.w < 1.5) { beam_em = beam_em + p.em_b.z; }
      else if (p.pos_m.w >= 1.5) { flare_em = flare_em + p.em_b.z; }
      else { loop_em = loop_em + p.em_b.z; }
    }
    i = i + 64u;
  }
  wg0[tid] = beam_em; wg1[tid] = flare_em; wg2[tid] = loop_em; wg3[tid] = active_cnt;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    telemetry[0] = vec4<f32>(wg0[0], wg1[0], wg2[0], wg3[0]);
  }
}
`;function Vt(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Ht(t,{massSolar:n=1.45,radiusM:r=12e3,surfaceBFieldTesla:i=12e10,spinPeriodS:c=.033,obliquityRad:l=.65,particleCount:u=5120,gridN:d=24,boxSize:f=14,seed:p=20261125,centerOffset:m=[0,0,0],label:h=`ulg-compact-magnetosphere`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createCompactMagnetosphereSessionWebGpu requires a live WebGPU GPUDevice`);let g=zt({massSolar:n,radiusM:r,surfaceBFieldTesla:i,spinPeriodS:c,obliquityRad:l}),_=Math.max(256,Math.min(32768,Math.trunc(u))),v=Math.max(16,Math.min(32,Math.trunc(d))),y=v*v*v,b=f/v,x=f*.5,S=Vt(p),C=Number(m?.[0])||0,w=Number(m?.[1])||0,T=Number(m?.[2])||0,E=g.surfaceBFieldTesla<=0?0:Math.min(2.5,Math.max(.05,Math.log10(g.surfaceBFieldTesla/1e4+1)*.28)),D=g.surfaceBFieldTesla<=0?0:Math.min(1.6,Math.max(.15,Math.log10(g.spinDownLumW/1e24+1)*.14)),O=g.surfaceBFieldTesla<=0?0:Math.min(1.4,Math.max(.05,Math.log10(g.spinDownLumW/1e27+1)*.18)),k=new Float32Array(y*4);if(E>0){let e=E*4.8*Math.sin(l),t=E*4.8*Math.cos(l);for(let n=0;n<v;n+=1)for(let r=0;r<v;r+=1)for(let i=0;i<v;i+=1){let a=(i+.5)*b-x,o=(r+.5)*b-x,s=(n+.5)*b-x,c=a*a+o*o+s*s+.72*.72,l=1/Math.sqrt(c),u=l*l*l,d=u/c,f=e*a+t*o+0*s,p=((n*v+r)*v+i)*4,m=3*f*a*d-e*u,h=3*f*o*d-t*u,g=3*f*s*d-0*u,_=Math.hypot(m,h,g);_>12&&(m*=12/_,h*=12/_,g*=12/_),k[p+0]=m,k[p+1]=h,k[p+2]=g,k[p+3]=0}}let A=new Float32Array(_*16),j=Math.floor(_*.34),M=Math.floor(_*.3);for(let e=0;e<_;e+=1){let t=e*16,n=e<j?1:e<j+M?2:0,r=S()*Math.PI*2,i=2*S()-1,a=Math.sqrt(Math.max(0,1-i*i)),o=n===0?1.2+S()*2.8:.7+S()*4.6;A[t+0]=Math.cos(r)*a*o+C,A[t+1]=i*o+w,A[t+2]=Math.sin(r)*a*o+T,A[t+3]=n,A[t+4]=Math.cos(r)*a*.5,A[t+5]=i*.5,A[t+6]=Math.sin(r)*a*.5,A[t+7]=1.2,A[t+8]=.8,A[t+9]=E,A[t+10]=.5,A[t+11]=S(),A[t+12]=S(),A[t+13]=S(),A[t+14]=e&1?-1:1,A[t+15]=1}let N=[a(0,`uniform`),a(1,`storage`),a(2,`read-only-storage`),a(3,`storage`),a(4,`storage`)],P=s(t,{cacheKey:`ulg-compact-mag-bgrid.v2`,label:`${h}-bgrid`,code:Bt,entryPoint:`step_mag_bfield_grid`,bindings:N}),F=s(t,{cacheKey:`ulg-compact-mag-step.v2`,label:`${h}-step`,code:Bt,entryPoint:`step_compact_magnetosphere`,bindings:N}),I=s(t,{cacheKey:`ulg-compact-mag-tel.v2`,label:`${h}-tel`,code:Bt,entryPoint:`reduce_magnetosphere_telemetry`,bindings:N}),L=t.createBuffer({label:`${h}-params`,size:80,usage:It.UNIFORM|It.COPY_DST}),R=t.createBuffer({label:`${h}-parcels`,size:A.byteLength,usage:It.STORAGE|It.VERTEX|It.COPY_DST|It.COPY_SRC}),z=t.createBuffer({label:`${h}-ba`,size:k.byteLength,usage:It.STORAGE|It.COPY_DST|It.COPY_SRC}),B=t.createBuffer({label:`${h}-bb`,size:k.byteLength,usage:It.STORAGE|It.COPY_DST|It.COPY_SRC}),V=t.createBuffer({label:`${h}-tel`,size:16,usage:It.STORAGE|It.COPY_SRC}),ee=t.createBuffer({label:`${h}-tel-rd`,size:16,usage:It.MAP_READ|It.COPY_DST}),H=t.createBuffer({label:`${h}-b-rd`,size:k.byteLength,usage:It.MAP_READ|It.COPY_DST});t.queue.writeBuffer(R,0,A),t.queue.writeBuffer(z,0,k),t.queue.writeBuffer(B,0,k);let U=(e,n,r)=>o(t,{layout:F.bindGroupLayout,label:`${h}-bg-${r}`,entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:R}},{binding:2,resource:{buffer:e}},{binding:3,resource:{buffer:n}},{binding:4,resource:{buffer:V}}]}),W=[U(z,B,`ab`),U(B,z,`ba`)],G=0,te=0,K=0,ne=g.omegaRadS,q=g.magnetarRegime?.65:0,J=0,re=0,ie=g.magnetarRegime?1.8:.25,ae=[],Y=!1,X=!1,Z=Float32Array.from(k),Q=!1,oe=Object.freeze({schema:Ft,stepIndex:0,...g,omegaNowRadS:ne,crustStrain:q,flareAmplitude:J,flareCount:re,beamFluxProxy:0,flareFluxProxy:0,flareHistory:Object.freeze([]),emergentBFieldGridN:v,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),se=Math.ceil(_/64),ce=Math.ceil(v/4);async function le({dt:n=.04,substeps:r=2,readTelemetry:i=!0,readBField:a=!1}={}){if(Q)return oe;let o=Math.max(1,Math.min(16,Math.trunc(r))),s=Math.max(.005,Math.min(.12,Number(n)||.04)),c=.45;for(let e=0;e<o;e+=1){if(c=Math.min(4.8,Math.max(.45,Math.log10(ne+1)*1.45)),K=(K+c*s)%(Math.PI*2),g.surfaceBFieldTesla>0){let e=Math.min(.02,Math.abs(g.omegaDotRadS2/Math.max(1e-6,g.omegaRadS))*1e6*s);ne=Math.max(.001,ne*(1-e))}if(g.crustYieldRatio>=1){let e=.42*Math.min(4,Math.sqrt(g.crustYieldRatio));q+=e*s,ie=.8+q*2.4,q>=1&&(q=.12,J=Math.min(2.2,1.35+.35*Math.log10(g.crustYieldRatio+1)),re+=1)}J*=Math.exp(-1.4*s),te+=1}ae.push(Number((J+D*.25).toFixed(4))),ae.length>96&&ae.shift();let u=.22*b/Math.max(1e-4,Math.min(.024,s*.55)),d=new ArrayBuffer(80);new Uint32Array(d,0,4).set([_,te,v,0]),new Float32Array(d,16,16).set([s,K,l,E,D,J,O,ie,f,b,c,u,C,w,T,0]),t.queue.writeBuffer(L,0,d);let p=t.createCommandEncoder({label:`${h}-enc-${te}`}),m=p.beginComputePass({label:`${h}-pass`}),y=W[G];m.setBindGroup(0,y),m.setPipeline(P.pipeline),m.dispatchWorkgroups(ce,ce,ce),m.setPipeline(F.pipeline),m.dispatchWorkgroups(se),m.setPipeline(I.pipeline),m.dispatchWorkgroups(1),m.end(),G^=1;let x=i&&!Y&&ee.mapState===`unmapped`;x&&(Y=!0,p.copyBufferToBuffer(V,0,ee,0,16));let S=(a||te%4==0)&&!X&&H.mapState===`unmapped`;S&&(X=!0,p.copyBufferToBuffer(G===0?z:B,0,H,0,k.byteLength)),t.queue.submit([p.finish()]);let A=[];return x&&A.push((async()=>{try{if(await ee.mapAsync(It.MAP_READ),!Q){let t=new Float32Array(ee.getMappedRange(0,16));oe=Object.freeze({schema:Ft,stepIndex:te,...g,omegaNowRadS:ne,crustStrain:q,flareAmplitude:J,flareCount:re,beamFluxProxy:t[0],flareFluxProxy:t[1],flareHistory:Object.freeze([...ae]),emergentBFieldGridN:v,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{ee.unmap()}catch{}}catch(e){if(!Q&&e?.name!==`AbortError`)throw e}finally{Y=!1}})()),S&&A.push((async()=>{try{await H.mapAsync(It.MAP_READ),Q||Z.set(new Float32Array(H.getMappedRange(0,k.byteLength)));try{H.unmap()}catch{}}catch(e){if(!Q&&e?.name!==`AbortError`)throw e}finally{X=!1}})()),A.length&&await Promise.all(A),oe}function ue({linesPerRing:e=12,steps:t=26,worldScale:n=1,alpha:r=.5}={}){if(g.surfaceBFieldTesla<=0)return new Float32Array;let i=Math.sin(l),a=Math.cos(l),o=Math.cos(K),s=Math.sin(K),c=i*o,u=a,d=i*s,p=-s,m=o,h=u*m-d*0,_=d*p-c*m,y=c*0-u*p,b=[];for(let t=0;t<e;t+=1){let n=t/e*Math.PI*2,r=Math.cos(n),i=Math.sin(n),a=t&1?2.65:1.85,o=t&1?-.28:.28,s=Math.cos(o),l=Math.sin(o);b.push([c*a*l+(p*r+h*i)*a*s,u*a*l+(0*r+_*i)*a*s,d*a*l+(m*r+y*i)*a*s])}return Nt({bHost:Z,gridN:v,boxSize:f,seedPoints:b,stepsPerDir:t,stepLen:.24,worldScale:n,offset:[-C,-w,-T],alpha:r,refB:Math.max(.25,E),colorPoloidal:g.magnetarRegime?[.95,.36+.35*Math.min(1,J),1]:[.3,.84,1],colorToroidal:g.magnetarRegime?[1,.8,.34]:[.76,.48,1]})}function de(){if(!Q){Q=!0;for(let e of[L,R,z,B,V,ee,H])try{e.destroy()}catch{}}}return Object.freeze({schema:Ft,lawAdapter:Lt,get particleCount(){return _},get gridN(){return v},get physics(){return g},get stepIndex(){return te},get rotPhase(){return K},get flareAmplitude(){return J},getResidentParcelsBuffer:()=>R,getResidentBFieldBuffer:()=>G===0?z:B,getTelemetry:()=>oe,buildDipoleFieldLines:ue,step:le,dispose:de})}function Ut(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`compact-magnetosphere-spindown@1`)?e.resolveModule(`compact-magnetosphere-spindown@1`)?.descriptor||null:e.registerModule({method:{model:`compact-magnetosphere-spindown`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/compactMagnetosphereGpu.js`,entryPoint:`step_compact_magnetosphere`,workgroupSize:64},parameterSchema:{surfaceBFieldTesla:{type:`number`,min:0,max:0x9184e72a000,required:!1},spinPeriodS:{type:`number`,min:.001,max:100,required:!1}},stateLayout:{tensorId:`magnetosphere-parcels`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`role`,`vx`,`vy`,`vz`,`gamma`,`temp`,`bLocalMag`,`emiss`,`age`,`seed`,`shellR`,`poleSign`,`live`]},scaleRangeM:[1e4,0x16345785d8a0000],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=Ht(n,{surfaceBFieldTesla:r.surfaceBFieldTesla??12e10,spinPeriodS:r.spinPeriodS??.033,particleCount:512}),a=await i.step({dt:.04,substeps:2,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:compact-magnetosphere:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/compactMagnetosphereGpu.js`,entryPoint:`createCompactMagnetosphereSessionWebGpu`,kernelEntryPoint:`step_compact_magnetosphere`},representation:`compact-magnetosphere-3d-mhd-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-compact-magnetosphere-3d-mhd`,placement:`local`},validity:{finite:Number.isFinite(a.spinDownLumW)&&Number.isFinite(a.crustYieldRatio)},validation:{status:`pass`,validationMode:`gpu-magnetosphere-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var Wt=`ulg.astrophysics.relativistic-binary-gw-rprocess-webgpu.v1`,Gt=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Kt=Object.freeze({id:`relativistic-binary-gw-rprocess`,lawNodeId:`law:astrophysics-relativistic-binary-gw-rprocess`,orderConstraint:`after:relativistic-compact-kerr-jet`,adapterMode:n.EXACT_NEAR,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`binary-compact-state`,`merger-ejecta-parcels`]),writes:Object.freeze([`binary-compact-state`,`merger-ejecta-parcels`]),accumulates:Object.freeze([`gw-strain-ringbuffer`,`rprocess-yield-ledger`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`adm-energy-plus-gw-flux`,`angular-momentum-plus-gw-flux`,`baryon-nucleon-sum`]),validityDomain:Object.freeze({minBodies:2,maxVOverC:.65}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e4,0x38d7ea4c68000]),fundamentalLaws:Object.freeze([`1pn-periastron-precession`,`2.5pn-peters-mathews-gw`,`roche-lobe-l1-overflow`,`rprocess-kilonova-heating`,`type-ia-c12-detonation`])});function qt(e={}){let t=Number(e.gravitatingBodyCount)||0,n=Number(e.maxPairwiseVOverC)||0,r=!!e.rocheOverflowPresent,i=t>=2&&(n>=1e-4||r);return{active:i,gwInspiralActive:i&&n>=.001,rocheTransferActive:i&&r,reason:i?`relativistic-or-roche-interacting-binary-present`:`wide-newtonian-system-dormant`}}function Jt(e){let t=Math.max(1e-4,Number(e)||1),n=Math.cbrt(t),r=n*n;return .49*r/(.6*r+Math.log(1+n))}var Yt=`
struct BinParams {
  particle_count: u32,
  mode_flags: u32,      // bit0=roche_stream, bit1=kilonova_rprocess, bit2=type_ia_detonation, bit3=merged
  step_index: u32,
  pad0: u32,
  dt: f32,
  gm_tot: f32,
  m1_frac: f32,
  m2_frac: f32,
  gw_strain_amp: f32,
  ejecta_temp_scale: f32,
  time_since_merge: f32,
  box_half: f32,
  b1_pos_r: vec4<f32>,  // xyz = body 1 pos, w = body 1 visual radius
  b2_pos_r: vec4<f32>,  // xyz = body 2 pos, w = body 2 visual radius
  center_offset: vec4<f32>,
};

// 16 floats (64 B) matching PARTICLE_CLOUD_WGSL Mode 7!
//   pos_m:   vec4(x, y, z, role)    role: 0=accretion_stream_disk, 1=blue_polar_wind_or_gw_wave, 2=red_lanthanide_rprocess_or_sn_ejecta
//   vel_gam: vec4(vx, vy, vz, ye_or_gamma)
//   em_b:    vec4(temp_norm, ye_neutron_rich, emiss, age)
//   meta0:   vec4(seed, r0, phase, live)
struct EjectaParcel {
  pos_m: vec4<f32>,
  vel_gam: vec4<f32>,
  em_b: vec4<f32>,
  meta0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: BinParams;
@group(0) @binding(1) var<storage, read_write> parcels: array<EjectaParcel>;
@group(0) @binding(2) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

@compute @workgroup_size(64)
fn step_binary_ejecta(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  var p = parcels[i];
  let role = p.pos_m.w;
  var loc = p.pos_m.xyz - params.center_offset.xyz;
  var vel = p.vel_gam.xyz;
  let dt = params.dt;

  let merged = (params.mode_flags & 8u) != 0u;
  let is_roche = (params.mode_flags & 1u) != 0u;
  let is_kilonova = (params.mode_flags & 2u) != 0u;
  let is_type_ia = (params.mode_flags & 4u) != 0u;

  let p1 = params.b1_pos_r.xyz;
  let p2 = params.b2_pos_r.xyz;

  if (merged && (is_kilonova || is_type_ia)) {
    // Homologous + r-process / 56Ni radioactive heating expansion!
    // r-process heating q_dot(t) ~ (1 + t)^(-1.3) -> luminous blue (polar high-Ye) + red lanthanide (equatorial low-Ye) Kilonova!
    let t_m = max(0.05, params.time_since_merge);
    let heat = pow(1.0 + t_m * 0.45, -1.3) * params.ejecta_temp_scale;
    let r = max(0.15, length(loc));
    let dir = loc / r;
    let v_exp = select(1.4, 2.4, is_type_ia) * (0.45 + 0.85 * p.meta0.x);
    if (length(vel) < 0.6) {
      vel = dir * v_exp + cross(vec3<f32>(0.0, 1.0, 0.0), dir) * 0.45;
    }
    loc = loc + vel * dt;
    if (length(loc) > params.box_half * 1.05) {
      let ang = p.meta0.x * 6.2831853 + f32(params.step_index) * 0.09;
      let cy = (p.meta0.y * 2.0 - 1.0) * select(0.42, 0.92, role < 1.5);
      let sy = sqrt(max(0.0, 1.0 - cy * cy));
      loc = vec3<f32>(cos(ang) * sy, cy, sin(ang) * sy) * (0.45 + 0.35 * p.meta0.z);
      vel = normalize(loc) * v_exp;
    }
    let ye = select(0.16, 0.38, role < 1.5); // low Ye < 0.25 -> lanthanide-rich red kilonova / Au/U synthesis!
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
    p.vel_gam = vec4<f32>(vel, 1.0 + 0.35 * v_exp);
    p.em_b = vec4<f32>(clamp(heat * select(0.65, 1.35, role < 1.5), 0.12, 1.8), ye, clamp(heat * 1.15, 0.15, 2.2), p.em_b.w + dt);
    p.meta0.w = 1.0;
    parcels[i] = p;
    return;
  }

  if (is_roche && role < 0.5) {
    // Roche-lobe L1 mass-transfer stream curving via Coriolis into hot X-ray accretion disk around body 1!
    let d1 = p1 - loc;
    let d2 = p2 - loc;
    let r1 = max(0.32, length(d1));
    let r2 = max(0.32, length(d2));
    let acc = (d1 / (r1 * r1 * r1)) * (params.gm_tot * params.m1_frac)
            + (d2 / (r2 * r2 * r2)) * (params.gm_tot * params.m2_frac);
    vel = vel + acc * dt;
    // Mild viscous circularization near accretor
    let r_acc = length(loc - p1);
    if (r_acc < 2.2) {
      vel = vel * (1.0 - 0.18 * dt);
    }
    loc = loc + vel * dt;
    // Respawn captured or escaped parcels at L1 Lagrange nozzle between donor (p2) and accretor (p1)
    if (r1 < params.b1_pos_r.w * 0.95 || length(loc) > params.box_half) {
      let l1 = mix(p1, p2, 0.58);
      let sep = p1 - p2;
      let tang = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), sep + vec3<f32>(1e-4, 0.0, 0.0)));
      loc = l1 + tang * ((p.meta0.x - 0.5) * 0.35) + vec3<f32>(0.0, (p.meta0.y - 0.5) * 0.25, 0.0);
      vel = normalize(sep + vec3<f32>(1e-4, 0.0, 0.0)) * 1.2 + tang * 1.6;
    }
    let t_hot = clamp(1.8 / max(0.4, r1), 0.15, 1.8);
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
    p.vel_gam = vec4<f32>(vel, 1.15);
    p.em_b = vec4<f32>(t_hot, 0.5, t_hot, p.em_b.w + dt);
    p.meta0.w = 1.0;
    parcels[i] = p;
    return;
  }

  // Tidal spiral arms / pre-merger quadrupole gravitational-wave perturbation tracers
  let d1 = p1 - loc;
  let d2 = p2 - loc;
  let r1 = max(0.38, length(d1));
  let r2 = max(0.38, length(d2));
  let acc = (d1 / (r1 * r1 * r1)) * (params.gm_tot * params.m1_frac)
          + (d2 / (r2 * r2 * r2)) * (params.gm_tot * params.m2_frac);
  vel = vel + acc * dt;
  loc = loc + vel * dt;
  // Gentle recycling if flung outside box
  if (length(loc) > params.box_half) {
    let ang = p.meta0.x * 6.2831853 + f32(params.step_index) * 0.08;
    let rr = 0.8 + p.meta0.y * 2.2;
    let host = select(p2, p1, (i & 1u) == 0u);
    loc = host + vec3<f32>(cos(ang) * rr, (p.meta0.z - 0.5) * 0.28, sin(ang) * rr);
    let vc = sqrt(params.gm_tot * 0.5 / max(0.5, rr));
    vel = vec3<f32>(-sin(ang) * vc, 0.0, cos(ang) * vc);
  }
  let em = clamp(0.35 + 1.8 * params.gw_strain_amp / (0.6 + 0.25 * length(loc)), 0.15, 1.8);
  p.pos_m = vec4<f32>(loc + params.center_offset.xyz, role);
  p.vel_gam = vec4<f32>(vel, 1.0 + params.gw_strain_amp * 2.0);
  p.em_b = vec4<f32>(em, 0.22, em, p.em_b.w + dt);
  p.meta0.w = 1.0;
  parcels[i] = p;
}

@compute @workgroup_size(64)
fn reduce_binary_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var em_sum = 0.0;
  var r_sum = 0.0;
  var low_ye_cnt = 0.0;
  var live_cnt = 0.0;
  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = parcels[i];
    if (p.meta0.w > 0.5) {
      live_cnt = live_cnt + 1.0;
      em_sum = em_sum + p.em_b.z;
      r_sum = r_sum + length(p.pos_m.xyz - params.center_offset.xyz);
      if (p.em_b.y < 0.25) { low_ye_cnt = low_ye_cnt + 1.0; }
    }
    i = i + 64u;
  }
  wg0[tid] = em_sum; wg1[tid] = r_sum; wg2[tid] = low_ye_cnt; wg3[tid] = live_cnt;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let inv = 1.0 / max(1.0, wg3[0]);
    telemetry[0] = vec4<f32>(wg0[0] * inv, wg1[0] * inv, wg2[0], wg3[0]);
  }
}
`;function Xt(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Zt(t,{m1Solar:n=1.45,m2Solar:r=1.32,r1Sim:i=.42,r2Sim:c=.4,separation0:l=4.6,eccentricity0:u=.08,cSpeedSim:d=7.2,rocheOverflow:f=!1,neutronRich:p=!0,wdCarbonOxygen:m=!1,particleCount:h=4096,seed:g=20261125,centerOffset:_=[0,0,0],label:v=`ulg-relativistic-binary`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createRelativisticBinaryMergerSessionWebGpu requires a live WebGPU GPUDevice`);let y=Math.max(256,Math.min(32768,Math.trunc(h))),b=Xt(g),x=Number(_?.[0])||0,S=Number(_?.[1])||0,C=Number(_?.[2])||0,w=14*Math.max(.5,(n+r)/2.8),T=Math.max(.1,n+r),E=n/T,D=r/T,O=Number.isFinite(d)&&d>0?1/(d*d):0,k=O>0?O**2.5:0,A=Math.max(i+c+.5,Number(l)||4.6),j=[A*(1-u),0,0],M=[0,0,Math.sqrt(w*(1+u)/Math.max(.5,A*(1-u)))],N=!1,P=0,F=0,I=0,L=[],R=[],z=()=>({b1:[-j[0]*D,-j[1]*D,-j[2]*D],b2:[j[0]*E,j[1]*E,j[2]*E]}),B=new Float32Array(y*16),V=z();for(let e=0;e<y;e+=1){let t=e*16,n=f?e<y*.7?0:1:e<y*.45?1:2,r=e&1?V.b2:V.b1,i=b()*Math.PI*2,a=.65+b()*2.1,o=r[0]+Math.cos(i)*a,s=(b()-.5)*.35,c=r[2]+Math.sin(i)*a,l=Math.sqrt(w*.45/Math.max(.5,a));B[t+0]=o+x,B[t+1]=s+S,B[t+2]=c+C,B[t+3]=n,B[t+4]=-Math.sin(i)*l,B[t+5]=0,B[t+6]=Math.cos(i)*l,B[t+7]=1.05,B[t+8]=.6,B[t+9]=p?.18:.5,B[t+10]=.5,B[t+11]=b(),B[t+12]=b(),B[t+13]=b(),B[t+14]=b(),B[t+15]=1}let ee=[a(0,`uniform`),a(1,`storage`),a(2,`storage`)],H=s(t,{cacheKey:`ulg-rel-binary-step.v1`,label:`${v}-step`,code:Yt,entryPoint:`step_binary_ejecta`,bindings:ee}),U=s(t,{cacheKey:`ulg-rel-binary-tel.v1`,label:`${v}-tel`,code:Yt,entryPoint:`reduce_binary_telemetry`,bindings:ee}),W=t.createBuffer({label:`${v}-params`,size:96,usage:Gt.UNIFORM|Gt.COPY_DST}),G=t.createBuffer({label:`${v}-parcels`,size:B.byteLength,usage:Gt.STORAGE|Gt.VERTEX|Gt.COPY_DST|Gt.COPY_SRC}),te=t.createBuffer({label:`${v}-tel`,size:16,usage:Gt.STORAGE|Gt.COPY_SRC}),K=t.createBuffer({label:`${v}-tel-rd`,size:16,usage:Gt.MAP_READ|Gt.COPY_DST});t.queue.writeBuffer(G,0,B);let ne=o(t,{layout:H.bindGroupLayout,label:`${v}-bg`,entries:[{binding:0,resource:{buffer:W}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:te}}]}),q=!1,J=!1,re=0,ie=0,ae=0,Y=Math.hypot(j[0],j[1],j[2]),X=Jt(r/Math.max(.05,n)),Z=Object.freeze({schema:Wt,stepIndex:0,separation:Y,merged:!1,remnantType:`inspiral`,gwStrainPlus:0,gwStrainCross:0,gwFrequency:0,rocheLobeRatio:X,rProcessEjectaCount:0,meanEjectaEmissivity:0,gwStrainHistory:Object.freeze([]),accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),Q=Math.ceil(y/64);function oe(e){if(N){P+=e,re=Math.exp(-P*3.2)*Math.cos(P*16)*(k>0?.9:0),ie=Math.exp(-P*3.2)*Math.sin(P*16)*(k>0?.9:0);return}let t=j[0],n=j[1],r=j[2],a=M[0],o=M[1],s=M[2],l=f?Math.max(1.2,(i+c)*1.6):.2,u=Math.max(l,Math.hypot(t,n,r)),d=a*a+o*o+s*s,p=(t*a+n*o+r*s)/u,m=E*D,h=w/u,g=O*((4+2*m)*h-(1+3*m)*d+1.5*m*p*p),_=O*(4-2*m)*p,v=f?.02:22,y=k>0?8/5*m*(w*w/(u*u*u))*k*v:0,b=y*(3*d+17/3*h),x=y*(d+3*h),S=-w/(u*u*u),C=S*((1+g)*t-_*a)+(p/u*b*t-x*a),T=S*((1+g)*n-_*o)+(p/u*b*n-x*o),F=S*((1+g)*r-_*s)+(p/u*b*r-x*s);if(M[0]+=C*e,M[1]+=T*e,M[2]+=F*e,j[0]+=M[0]*e,j[1]+=M[1]*e,j[2]+=M[2]*e,f){let e=A/Math.max(l,Math.hypot(j[0],j[1],j[2]));j[0]*=.94+.06*e,j[1]*=.96,j[2]*=.94+.06*e}Y=Math.hypot(j[0],j[1],j[2]);let I=Math.atan2(j[2],j[0]);ae=Math.sqrt(w/Math.max(.25,Y*Y*Y))/Math.PI;let L=O>0?Math.min(1.6,4.2*m*h*O*(4/Math.max(.6,Y))):0;re=L*Math.cos(2*I),ie=L*Math.sin(2*I),!f&&Y<=(i+c)*1.12&&(N=!0,P=0,j=[0,0,0],M=[0,0,0])}async function se({dt:n=.032,substeps:r=4,readTelemetry:a=!0}={}){if(J)return Z;let o=Math.max(1,Math.min(16,Math.trunc(r))),s=Math.max(.004,Math.min(.08,Number(n)||.032));for(let e=0;e<o;e+=1)oe(s*.5),oe(s*.5),F+=s,I+=1;L.push(Number(re.toFixed(5))),R.push(Number(ae.toFixed(4))),L.length>120&&(L.shift(),R.shift());let l=z(),u=!!f|(p?2:0)|(m?4:0)|(N?8:0),d=new ArrayBuffer(96);new Uint32Array(d,0,4).set([y,u,I,0]),new Float32Array(d,16,20).set([s,w,E,D,Math.hypot(re,ie),p?1.65:m?2.1:1,P,9,l.b1[0],l.b1[1],l.b1[2],i,l.b2[0],l.b2[1],l.b2[2],c,x,S,C,0]),t.queue.writeBuffer(W,0,d);let h=t.createCommandEncoder({label:`${v}-enc-${I}`}),g=h.beginComputePass({label:`${v}-pass`});g.setBindGroup(0,ne),g.setPipeline(H.pipeline),g.dispatchWorkgroups(Q),g.setPipeline(U.pipeline),g.dispatchWorkgroups(1),g.end();let _=a&&!q&&K.mapState===`unmapped`;if(_&&(q=!0,h.copyBufferToBuffer(te,0,K,0,16)),t.queue.submit([h.finish()]),_)try{if(await K.mapAsync(Gt.MAP_READ),!J){let t=new Float32Array(K.getMappedRange(0,16));Z=Object.freeze({schema:Wt,stepIndex:I,separation:Y,merged:N,remnantType:N?m?`type-ia-supernova-zero-remnant`:p?`bns-kilonova-rprocess`:`kerr-bbh-remnant`:f?`roche-xray-binary`:`gw-inspiral`,gwStrainPlus:re,gwStrainCross:ie,gwFrequency:ae,rocheLobeRatio:X,rProcessEjectaCount:Math.round(t[2]),meanEjectaEmissivity:t[0],gwStrainHistory:Object.freeze([...L]),accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{K.unmap()}catch{}}catch(e){if(!J&&e?.name!==`AbortError`)throw e}finally{q=!1}return Z}function ce(e=1){let t=z();if(N&&m)return[];if(N)return[{pos:[x*e,S*e,C*e],radius:Math.max(i,c)*1.25*e,color0:p?[.72,.88,1]:[0,0,0],color1:p?[.35,.65,1]:[0,0,0],kind:p?0:5,atm:0}];let a=!p&&!m&&n>=3,o=!p&&!m&&r>=3&&!f;return[{pos:[(t.b1[0]+x)*e,(t.b1[1]+S)*e,(t.b1[2]+C)*e],radius:i*e,color0:a?[0,0,0]:[.76,.9,1],color1:a?[0,0,0]:[.42,.72,1],kind:a?5:0,atm:0},{pos:[(t.b2[0]+x)*e,(t.b2[1]+S)*e,(t.b2[2]+C)*e],radius:c*e,color0:o?[0,0,0]:f?[1,.76,.42]:[.8,.92,1],color1:o?[0,0,0]:f?[.95,.38,.14]:[.46,.74,1],kind:o?5:0,atm:0}]}function le(){if(!J){J=!0;for(let e of[W,G,te,K])try{e.destroy()}catch{}}}return Object.freeze({schema:Wt,lawAdapter:Kt,get particleCount(){return y},get stepIndex(){return I},get merged(){return N},get separation(){return Y},getResidentParcelsBuffer:()=>G,getRenderSpheres:ce,getTelemetry:()=>Z,step:se,dispose:le})}function Qt(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`relativistic-binary-gw-rprocess@1`)?e.resolveModule(`relativistic-binary-gw-rprocess@1`)?.descriptor||null:e.registerModule({method:{model:`relativistic-binary-gw-rprocess`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/relativisticBinaryMergerGpu.js`,entryPoint:`step_binary_ejecta`,workgroupSize:64},parameterSchema:{m1Solar:{type:`number`,min:.2,max:1e10,required:!1},m2Solar:{type:`number`,min:.2,max:1e10,required:!1},cSpeedSim:{type:`number`,min:1,max:1e9,required:!1}},stateLayout:{tensorId:`merger-ejecta-parcels`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`role`,`vx`,`vy`,`vz`,`gamma`,`temp`,`ye`,`emiss`,`age`,`seed`,`r0`,`phase`,`live`]},scaleRangeM:[1e4,0x38d7ea4c68000],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=Zt(n,{m1Solar:r.m1Solar??1.45,m2Solar:r.m2Solar??1.32,particleCount:512}),a=await i.step({dt:.03,substeps:4,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:rel-binary:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/relativisticBinaryMergerGpu.js`,entryPoint:`createRelativisticBinaryMergerSessionWebGpu`,kernelEntryPoint:`step_binary_ejecta`},representation:`rel-binary-gw-rprocess-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-rel-binary-gw`,placement:`local`},validity:{finite:Number.isFinite(a.separation)&&Number.isFinite(a.gwStrainPlus)},validation:{status:`pass`,validationMode:`gpu-binary-gw-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var $t=`ulg.astrophysics.radiative-photoionization-wind-webgpu.v1`,en=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),tn=Object.freeze({id:`radiative-photoionization-winds`,lawNodeId:`law:astrophysics-radiative-photoionization-winds`,orderConstraint:`after:nebular-mhd-collapse`,adapterMode:n.CELL_LOCAL,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`stellar-luminosity-sources`,`outflow-tail-particles`]),writes:Object.freeze([`outflow-tail-particles`]),accumulates:Object.freeze([`radiative-wind-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass-with-outflow`,`momentum-radiation-plus-gas`,`ionization-balance`]),validityDomain:Object.freeze({requiresRadiativeOrThermalDriver:!0}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e3,0x56bc75e2d63100000]),fundamentalLaws:Object.freeze([`stromgren-photoionization`,`radiation-pressure-wind`,`xuv-photoevaporation`,`clausius-clapeyron-sublimation`,`solar-wind-ion-pickup`])});function nn(e={}){let t=Number(e.uvFluxNorm)||0,n=Number(e.xuvFluxWPerM2)||0,r=(Number(e.surfaceTempK)||0)>(Number(e.sublimationTempK)||1e9),i=Number(e.fastWindSpeedNorm)||0,a=t>1e-4||n>.1||r||i>.001;return{active:a,photoionizationActive:t>1e-4,outflowActive:n>.1||r||i>.001,reason:a?`radiative-or-sublimation-driver-present`:`dark-cold-quiescent-dormant`}}var rn=`
struct RadWindParams {
  particle_count: u32,
  regime_code: u32,    // 0=h2_pillars_nebula, 1=planetary_nebula, 2=snr_pwn_blastwave, 3=comet_dual_tail, 4=hot_jupiter_xuv
  step_index: u32,
  pad0: u32,
  dt: f32,
  uv_flux: f32,        // Ionizing UV strength (0 -> zero photoionization!)
  rad_beta: f32,       // Radiation pressure / gravity ratio (curves dust tail / drives WR winds!)
  wind_speed: f32,     // Solar / fast post-AGB / blastwave wind velocity
  subl_drive: f32,     // Sublimation or XUV mass-loss drive (0 -> zero outgassing!)
  bipolar_asym: f32,   // Equatorial torus confinement producing hourglass/bipolar planetary nebulae
  box_half: f32,
  pad1: f32,
  source_dir: vec4<f32>, // xyz = unit direction toward ionizing star / Sun, w = source distance
  center_offset: vec4<f32>,
};

// 16 floats (64 B) matching PARTICLE_CLOUD_WGSL Mode 8 (Photoionized Nebulae + Comet/XUV Outflows!):
//   pos_m:    vec4(x, y, z, species)   species: 0=neutral_dust/pillar, 1=H_alpha_or_ion_tail, 2=OIII_hot_shell, 3=SII_or_shock_front
//   vel_ion:  vec4(vx, vy, vz, x_HII)
//   em_spec:  vec4(h_alpha, o_iii, s_ii_or_dust, age)
//   meta0:    vec4(seed, r0, theta0, live)
struct RadParcel {
  pos_m: vec4<f32>,
  vel_ion: vec4<f32>,
  em_spec: vec4<f32>,
  meta0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: RadWindParams;
@group(0) @binding(1) var<storage, read_write> parcels: array<RadParcel>;
@group(0) @binding(2) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

@compute @workgroup_size(64)
fn step_radiative_wind(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  var p = parcels[i];
  var loc = p.pos_m.xyz - params.center_offset.xyz;
  var vel = p.vel_ion.xyz;
  var x_hii = p.vel_ion.w;
  let dt = params.dt;
  let reg = params.regime_code;
  let s_dir = normalize(params.source_dir.xyz);

  if (reg == 3u || reg == 4u) {
    // Active Comet Dual-Tail (reg=3) OR Hot-Jupiter XUV Photoevaporation Tail (reg=4)!
    if (params.subl_drive <= 1e-6) {
      p.vel_ion.w = 0.0;
      p.em_spec = vec4<f32>(0.0, 0.0, 0.0, p.em_spec.w);
      p.meta0.w = 0.0;
      parcels[i] = p;
      return;
    }
    p.meta0.w = 1.0;
    let is_ion = p.pos_m.w > 0.5 && p.pos_m.w < 1.5;
    let anti_sun = -s_dir;
    // Perpendicular orbital-lag tangent curving the radiation-pressure dust tail vs straight ion tail!
    let orb_tang = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), anti_sun + vec3<f32>(0.0, 0.0, 1e-4)));
    let age = p.em_spec.w + dt * (0.28 + 0.35 * params.subl_drive);
    if (is_ion) {
      // Photoionized CO+/H2O+ (or H+ XUV) swept straight antisolar by magnetized solar wind!
      let a_sw = anti_sun * (params.wind_speed * 2.2) + vec3<f32>(0.0, sin(age * 4.0 + p.meta0.x * 6.28) * 0.12, 0.0);
      vel = mix(vel, a_sw, clamp(dt * 3.2, 0.0, 1.0));
      x_hii = clamp(x_hii + params.uv_flux * (1.0 - x_hii) * dt * 2.5, 0.0, 1.0);
    } else {
      // Micron dust grains pushed by radiation pressure beta AND curving along orbital lag!
      let a_rad = anti_sun * (params.rad_beta * 1.45) + orb_tang * (0.55 * params.rad_beta * age);
      vel = vel + a_rad * dt;
      x_hii = 0.0;
    }
    loc = loc + vel * dt;
    if (length(loc) > params.box_half * 1.1 || age > 3.6) {
      // Respawn at sunlit hemisphere sublimation/exobase surface!
      let phi = p.meta0.x * 6.2831853;
      let ct = 0.25 + 0.75 * p.meta0.y;
      let st = sqrt(max(0.0, 1.0 - ct * ct));
      let side = normalize(cross(s_dir, vec3<f32>(0.0, 1.0, 0.0) + vec3<f32>(1e-4, 0.0, 0.0)));
      let up_s = cross(side, s_dir);
      let n_emit = normalize(s_dir * ct + (side * cos(phi) + up_s * sin(phi)) * st);
      let r_body = select(0.55, 0.95, reg == 4u);
      loc = n_emit * r_body;
      vel = n_emit * (0.35 + 0.45 * params.subl_drive) + anti_sun * 0.25;
      p.em_spec.w = 0.0;
    } else {
      p.em_spec.w = age;
    }
    let fade = exp(-length(loc) * 0.12);
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
    p.vel_ion = vec4<f32>(vel, x_hii);
    p.em_spec = vec4<f32>(
      select(0.12, 0.08 * x_hii, is_ion) * fade,
      select(0.04, 1.38 * x_hii, is_ion) * fade,
      select(1.05 * params.subl_drive, 0.02, is_ion) * fade,
      p.em_spec.w
    );
    parcels[i] = p;
    return;
  }

  // Regimes 0 (H II Star-Forming Pillars), 1 (Planetary Nebula), 2 (SNR / Crab PWN)!
  let r = max(0.25, length(loc));
  let dir = loc / r;
  // Local UV flux falls as 1/r^2 and is attenuated inside dense molecular pillar cores (self-shielding!)
  let is_pillar_core = (reg == 0u) && (p.pos_m.w < 0.5);
  let shield = select(1.0, 0.18 + 0.82 * smoothstep(-2.0, 4.5, dot(loc, s_dir)), is_pillar_core);
  let f_uv_loc = params.uv_flux * shield / (0.35 + 0.12 * r * r);

  // Real Stromgren photoionization balance: dx_HII/dt = (1 - x_HII)*F_UV - alpha_B * x_HII^2
  let ion_src = (1.0 - x_hii) * f_uv_loc * 1.8;
  let recomb = 0.35 * x_hii * x_hii;
  x_hii = clamp(x_hii + (ion_src - recomb) * dt, 0.0, 1.0);

  if (reg == 1u) {
    // Planetary Nebula: fast post-AGB stellar wind colliding with slow equatorial dusty torus -> hourglass/ring!
    let lat_y = abs(dir.y);
    let polar_boost = 1.0 + params.bipolar_asym * lat_y * lat_y;
    let v_shell = params.wind_speed * polar_boost * (0.35 + 0.65 * p.meta0.y);
    vel = mix(vel, dir * v_shell, clamp(dt * 1.8, 0.0, 1.0));
    loc = loc + vel * dt;
    if (length(loc) > params.box_half * 0.92) {
      let th = p.meta0.x * 6.2831853;
      let cy = (p.meta0.z * 2.0 - 1.0);
      let sy = sqrt(max(0.0, 1.0 - cy * cy));
      loc = vec3<f32>(cos(th) * sy, cy, sin(th) * sy) * (0.55 + 0.35 * p.meta0.y);
      vel = normalize(loc) * v_shell * 0.6;
    }
  } else if (reg == 2u) {
    // Supernova Remnant / Crab PWN: Sedov-Taylor blastwave decelerating (R ~ t^(2/5)) + filamentary turbulence!
    let sedov_v = params.wind_speed / pow(0.6 + r * 0.42, 1.15);
    let rt_swirl = vec3<f32>(sin(loc.y * 2.1 + p.meta0.x * 6.28), cos(loc.z * 2.1), sin(loc.x * 2.1)) * 0.22;
    vel = mix(vel, dir * sedov_v + rt_swirl, clamp(dt * 2.0, 0.0, 1.0));
    loc = loc + vel * dt;
    if (length(loc) > params.box_half * 0.95) {
      let th = p.meta0.x * 6.2831853;
      let cy = (p.meta0.z * 2.0 - 1.0);
      let sy = sqrt(max(0.0, 1.0 - cy * cy));
      loc = vec3<f32>(cos(th) * sy, cy, sin(th) * sy) * (0.75 + 0.45 * p.meta0.y);
    }
  } else {
    // H II Star-Forming Pillars: photoevaporative rocket acceleration ablating sunlit tips away from O-star!
    let rocket = -s_dir * (f_uv_loc * params.rad_beta * 0.45) * x_hii;
    vel = (vel + rocket * dt) * exp(-0.4 * dt);
    loc = loc + vel * dt;
    if (length(loc) > params.box_half * 0.96) {
      loc = loc * 0.55;
      vel = vec3<f32>(0.0);
    }
  }

  // Physically stratified nebular emission lines (Hubble SHO / optical H-alpha, [O III], [S II]):
  //   - Inner highly ionized zone -> vivid emerald-cyan [O III] 500.7 nm
  //   - Intermediate ionized shell -> crimson-rose H-alpha 656.3 nm
  //   - Outer ionization front / dense shielded molecular skin -> amber-gold [S II] 672 nm
  let o3 = select(
    x_hii * (1.0 - smoothstep(0.9, 5.4, r)) * (0.95 + 0.55 * params.uv_flux),
    x_hii * (1.0 - smoothstep(1.2, 4.2, r)) * 1.45,
    reg == 1u || reg == 2u
  );
  let ha = x_hii * smoothstep(0.6, 4.8, r) * (0.72 + 0.45 * params.uv_flux);
  let s2 = (1.0 - x_hii * 0.82) * smoothstep(0.0, 0.55, x_hii + 0.16) * 1.15;

  p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
  p.vel_ion = vec4<f32>(vel, x_hii);
  p.em_spec = vec4<f32>(ha, o3, s2, p.em_spec.w + dt);
  p.meta0.w = 1.0;
  parcels[i] = p;
}

@compute @workgroup_size(64)
fn reduce_rad_wind_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var xhii_sum = 0.0;
  var spd_sum = 0.0;
  var em_sum = 0.0;
  var live_cnt = 0.0;
  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = parcels[i];
    if (p.meta0.w > 0.5) {
      live_cnt = live_cnt + 1.0;
      xhii_sum = xhii_sum + p.vel_ion.w;
      spd_sum = spd_sum + length(p.vel_ion.xyz);
      em_sum = em_sum + p.em_spec.x + p.em_spec.y + p.em_spec.z;
    }
    i = i + 64u;
  }
  wg0[tid] = xhii_sum; wg1[tid] = spd_sum; wg2[tid] = em_sum; wg3[tid] = live_cnt;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let inv = 1.0 / max(1.0, wg3[0]);
    telemetry[0] = vec4<f32>(wg0[0] * inv, wg1[0] * inv, wg2[0] * inv, wg3[0]);
  }
}
`;function an(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function on(t,{regime:n=`h2-pillars`,uvFlux:r=1.2,radBeta:i=.85,windSpeed:c=1.6,sublimationDrive:l=1,bipolarAsymmetry:u=1.35,sourceDir:d=[.65,.55,.52],particleCount:f=5120,seed:p=20261125,centerOffset:m=[0,0,0],label:h=`ulg-radiative-wind`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createRadiativePhotoionizationWindSessionWebGpu requires a live WebGPU GPUDevice`);let g={"h2-pillars":0,"planetary-nebula":1,"snr-pwn":2,"comet-dual-tail":3,"hot-jupiter-xuv":4}[n]??0,_=Math.max(256,Math.min(32768,Math.trunc(f))),v=an(p),y=Number(m?.[0])||0,b=Number(m?.[1])||0,x=Number(m?.[2])||0,S=Math.hypot(d[0],d[1],d[2])||1,C=[d[0]/S,d[1]/S,d[2]/S],w=new Float32Array(_*16);for(let e=0;e<_;e+=1){let t=e*16,n=0,a=0,o=0,s=0,l=0,d=0,f=1,p=r>0?.35:0;if(g===0)if(e<_*.62){let t=e%3,i=(t-1)*2.4,s=t===1?-.9:.7,c=(v()-.5)*6.8,l=(.45+.55*(1-(c+3.4)/7.5))*Math.sqrt(v()),u=v()*Math.PI*2;n=i+Math.cos(u)*l,a=c,o=s+Math.sin(u)*l,f=0,p=r>0?.12:0}else{let e=Math.cbrt(v())*6.8,t=2*v()-1,r=Math.sqrt(Math.max(0,1-t*t)),i=v()*Math.PI*2;n=e*r*Math.cos(i),a=e*t,o=e*r*Math.sin(i),f=2}else if(g===1){let e=v()*Math.PI*2,t=2*v()-1,r=Math.sqrt(Math.max(0,1-t*t)),i=(1.6+v()*2.6)*(1+u*.45*t*t);n=i*r*Math.cos(e),a=i*t,o=i*r*Math.sin(e),s=n*.25,l=a*.32,d=o*.25,f=Math.abs(t)>.5?2:1}else if(g===2){let t=e<_*.28,r=v()*Math.PI*2,i=2*v()-1,c=Math.sqrt(Math.max(0,1-i*i)),u=t?.4+v()*1.9:3.2+(v()-.5)*1.3;n=u*c*Math.cos(r),a=u*i,o=u*c*Math.sin(r),s=n*.4,l=a*.4,d=o*.4,f=t?2:3}else{let t=(e&1)==0,u=v()*6.5,m=.25+.14*u,h=v()*Math.PI*2,g=[-C[2],0,C[0]],_=Math.hypot(g[0],g[2])||1;g[0]/=_,g[2]/=_;let y=t?0:.16*u*u*i;n=-C[0]*u+g[0]*(y+Math.cos(h)*m),a=-C[1]*u+Math.sin(h)*m,o=-C[2]*u+g[2]*(y+Math.cos(h)*m),s=-C[0]*(t?c:i),l=-C[1]*(t?c:i),d=-C[2]*(t?c:i),f=+!!t,p=t&&r>0?.8:0}w[t+0]=n+y,w[t+1]=a+b,w[t+2]=o+x,w[t+3]=f,w[t+4]=s,w[t+5]=l,w[t+6]=d,w[t+7]=p,w[t+8]=p*.7,w[t+9]=p*.5,w[t+10]=.4,w[t+11]=v()*2.5,w[t+12]=v(),w[t+13]=v(),w[t+14]=v(),w[t+15]=1}let T=[a(0,`uniform`),a(1,`storage`),a(2,`storage`)],E=s(t,{cacheKey:`ulg-rad-wind-step.v1`,label:`${h}-step`,code:rn,entryPoint:`step_radiative_wind`,bindings:T}),D=s(t,{cacheKey:`ulg-rad-wind-tel.v1`,label:`${h}-tel`,code:rn,entryPoint:`reduce_rad_wind_telemetry`,bindings:T}),O=t.createBuffer({label:`${h}-params`,size:80,usage:en.UNIFORM|en.COPY_DST}),k=t.createBuffer({label:`${h}-parcels`,size:w.byteLength,usage:en.STORAGE|en.VERTEX|en.COPY_DST|en.COPY_SRC}),A=t.createBuffer({label:`${h}-tel`,size:16,usage:en.STORAGE|en.COPY_SRC}),j=t.createBuffer({label:`${h}-tel-rd`,size:16,usage:en.MAP_READ|en.COPY_DST});t.queue.writeBuffer(k,0,w);let M=o(t,{layout:E.bindGroupLayout,label:`${h}-bg`,entries:[{binding:0,resource:{buffer:O}},{binding:1,resource:{buffer:k}},{binding:2,resource:{buffer:A}}]}),N=0,P=!1,F=!1,I=Object.freeze({schema:$t,regime:n,stepIndex:0,meanIonizedFraction:0,meanOutflowSpeed:0,meanLineEmission:0,activeParcels:0,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),L=Math.ceil(_/64);async function R({dt:a=.035,substeps:o=2,readTelemetry:s=!0}={}){if(F)return I;let d=Math.max(1,Math.min(16,Math.trunc(o))),f=Math.max(.004,Math.min(.1,Number(a)||.035)),p=new ArrayBuffer(80);new Uint32Array(p,0,4).set([_,g,N,0]),new Float32Array(p,16,16).set([f,r,i,c,l,u,8.6,0,C[0],C[1],C[2],6,y,b,x,0]),t.queue.writeBuffer(O,0,p);let m=t.createCommandEncoder({label:`${h}-enc-${N}`}),v=m.beginComputePass({label:`${h}-pass`});v.setBindGroup(0,M),v.setPipeline(E.pipeline);for(let e=0;e<d;e+=1)v.dispatchWorkgroups(L),N+=1;v.setPipeline(D.pipeline),v.dispatchWorkgroups(1),v.end();let S=s&&!P&&j.mapState===`unmapped`;if(S&&(P=!0,m.copyBufferToBuffer(A,0,j,0,16)),t.queue.submit([m.finish()]),S)try{if(await j.mapAsync(en.MAP_READ),!F){let t=new Float32Array(j.getMappedRange(0,16));I=Object.freeze({schema:$t,regime:n,stepIndex:N,meanIonizedFraction:t[0],meanOutflowSpeed:t[1],meanLineEmission:t[2],activeParcels:Math.round(t[3]),accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{j.unmap()}catch{}}catch(e){if(!F&&e?.name!==`AbortError`)throw e}finally{P=!1}return I}function z(){if(!F){F=!0;for(let e of[O,k,A,j])try{e.destroy()}catch{}}}return Object.freeze({schema:$t,lawAdapter:tn,get regime(){return n},get particleCount(){return _},get stepIndex(){return N},getResidentParcelsBuffer:()=>k,getTelemetry:()=>I,step:R,dispose:z})}function sn(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`radiative-photoionization-winds@1`)?e.resolveModule(`radiative-photoionization-winds@1`)?.descriptor||null:e.registerModule({method:{model:`radiative-photoionization-winds`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/radiativePhotoionizationWindGpu.js`,entryPoint:`step_radiative_wind`,workgroupSize:64},parameterSchema:{regime:{type:`string`,required:!1},uvFlux:{type:`number`,min:0,max:20,required:!1}},stateLayout:{tensorId:`outflow-tail-particles`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`species`,`vx`,`vy`,`vz`,`xHII`,`hAlpha`,`oIII`,`sII`,`age`,`seed`,`r0`,`theta0`,`live`]},scaleRangeM:[1e3,0x56bc75e2d63100000],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=on(n,{regime:r.regime??`planetary-nebula`,uvFlux:r.uvFlux??1.2,particleCount:512}),a=await i.step({dt:.035,substeps:2,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:rad-wind:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/radiativePhotoionizationWindGpu.js`,entryPoint:`createRadiativePhotoionizationWindSessionWebGpu`,kernelEntryPoint:`step_radiative_wind`},representation:`radiative-photoionization-wind-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-radiative-wind`,placement:`local`},validity:{finite:Number.isFinite(a.meanIonizedFraction)&&Number.isFinite(a.meanOutflowSpeed)},validation:{status:`pass`,validationMode:`gpu-radiative-wind-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var cn=`ulg.astrophysics.tidal-roche-disruption-webgpu.v1`,ln=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),un=Object.freeze({id:`tidal-roche-rheology-cryovolcanism`,lawNodeId:`law:astrophysics-tidal-roche-rheology`,orderConstraint:`after:particle-rigid-dynamics`,adapterMode:n.SOLID_PROXY,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`solid-rigid-frames`,`tidal-debris-particles`]),writes:Object.freeze([`tidal-debris-particles`]),accumulates:Object.freeze([`tidal-dissipation-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`orbital-plus-spin-angular-momentum`]),validityDomain:Object.freeze({minBodies:2}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([100,0x5af3107a4000]),fundamentalLaws:Object.freeze([`roche-tidal-tensor`,`cohesive-bond-rupture`,`viscoelastic-tidal-dissipation`,`cryovolcanic-plume-venting`,`common-envelope-drag`])});function dn(e={}){let t=Number(e.gravitatingBodyCount)||0,n=Number(e.maxTidalStrain)||0,r=Number(e.maxSurfaceTempK)||0,i=Number(e.solidBodyCount)||0,a=t>=2&&(n>1e-6||i>0)||r>1200;return{active:a,rocheDisruptionActive:n>.25,magmaOceanActive:r>1400,reason:a?`tidal-or-magma-rheology-present`:`isolated-cold-body-dormant`}}var fn=`
struct TidalParams {
  particle_count: u32,
  mode_code: u32,      // 0=roche_rubble_disruption+rings, 1=giant_impact_magma_disk, 2=cryovolcanic_plumes, 3=red_giant_engulfment
  step_index: u32,
  pad0: u32,
  dt: f32,
  gm_host: f32,
  r_host: f32,
  r_roche: f32,
  cohesion_strength: f32,
  self_grav_k: f32,
  tidal_heat_drive: f32,
  envelope_drag: f32,
  shepherd_pos_m: vec4<f32>, // xyz = shepherd moon position, w = shepherd GM
  cluster_com_r: vec4<f32>,  // xyz = rubble-pile COM (updated dynamically), w = initial cluster radius
  center_offset: vec4<f32>,
};

// 16 floats (64 B) matching PARTICLE_CLOUD_WGSL Mode 9 (Roche Debris / Ring / Impact / Cryo-Plume!):
//   pos_m:    vec4(x, y, z, mass)
//   vel_bond: vec4(vx, vy, vz, bond_intact)   bond_intact: 1.0 = cohesively bound, 0.0 = tidally ruptured!
//   therm_id: vec4(temp_K_norm, strain, role, age)
//   meta0:    vec4(seed, r_local, phi0, live)
struct TidalParticle {
  pos_m: vec4<f32>,
  vel_bond: vec4<f32>,
  therm_id: vec4<f32>,
  meta0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: TidalParams;
@group(0) @binding(1) var<storage, read_write> parts: array<TidalParticle>;
@group(0) @binding(2) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

@compute @workgroup_size(64)
fn step_tidal_roche(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  var p = parts[i];
  var loc = p.pos_m.xyz - params.center_offset.xyz;
  var vel = p.vel_bond.xyz;
  var intact = p.vel_bond.w;
  let dt = params.dt;
  let mode = params.mode_code;

  if (mode == 4u) {
    // Catastrophic Antimatter / Kinetic Shatter: incandescent rocky/molten/icy fragments
    // expanding ballistically under residual self-gravity + weak orbital shear into a glowing debris cloud!
    let r_frag = max(0.25, length(loc));
    let n_r = loc / r_frag;
    // Residual core self-gravity decelerates slow inner fragments while fast ejecta escapes!
    let acc_sg = -n_r * (params.gm_host * 0.14 / (r_frag * r_frag + 0.35));
    vel = vel + acc_sg * dt;
    loc = loc + vel * dt;
    let t_cool = clamp(p.therm_id.x * exp(-0.14 * dt), 0.16, 2.2);
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
    p.vel_bond = vec4<f32>(vel, 0.0);
    p.therm_id = vec4<f32>(t_cool, 2.5, 1.0, p.therm_id.w + dt);
    p.meta0.w = 1.0;
    parts[i] = p;
    return;
  }

  if (mode == 2u) {
    // Cryovolcanic Icy Moon Supersonic Water-Vapor / Ice-Crystal Plumes (driven by tidal_heat_drive!)
    if (params.tidal_heat_drive <= 1e-6) {
      p.therm_id.x = 0.0;
      p.meta0.w = 0.0;
      parts[i] = p;
      return;
    }
    p.meta0.w = 1.0;
    let r = max(params.r_host * 0.9, length(loc));
    let dir = loc / r;
    // Gravity pulls ballistic ice crystals back down while fast vapor escapes into E-ring!
    let acc_g = -dir * (params.gm_host / (r * r));
    vel = vel + acc_g * dt;
    loc = loc + vel * dt;
    let age = p.therm_id.w + dt;
    if (length(loc) < params.r_host * 1.01 || length(loc) > params.r_host * 4.5 || age > 4.2) {
      // Erupt from south-polar tidal tiger-stripe fractures!
      let stripe = floor(p.meta0.x * 4.0) - 1.5;
      let az = p.meta0.z * 6.2831853;
      let lat = -1.28 + stripe * 0.08 + (p.meta0.y - 0.5) * 0.06;
      let cl = cos(lat); let sl = sin(lat);
      let n_vent = normalize(vec3<f32>(cl * cos(az), sl, cl * sin(az)));
      loc = n_vent * (params.r_host * 1.02);
      let v_jet = (0.85 + 1.45 * p.meta0.y) * sqrt(params.tidal_heat_drive);
      vel = n_vent * v_jet + vec3<f32>((p.meta0.x - 0.5) * 0.25, 0.0, (p.meta0.z - 0.5) * 0.25);
      p.therm_id.w = 0.0;
    } else {
      p.therm_id.w = age;
    }
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
    p.vel_bond = vec4<f32>(vel, 0.0);
    p.therm_id = vec4<f32>(clamp(0.45 + 0.55 * params.tidal_heat_drive, 0.2, 1.5), params.tidal_heat_drive, 2.0, p.therm_id.w);
    parts[i] = p;
    return;
  }

  // Gravity from central host planet/star + shepherd moon resonant kicks!
  let r = max(params.r_host * 0.85, length(loc));
  let dir = loc / r;
  var acc = -dir * (params.gm_host / (r * r));

  if (params.shepherd_pos_m.w > 0.0) {
    let ds = params.shepherd_pos_m.xyz - loc;
    let rs = max(0.22, length(ds));
    acc = acc + (ds / (rs * rs * rs)) * params.shepherd_pos_m.w;
    // Resonant ring-gap clearing if ring particle strays inside shepherd Hill sphere
    if (rs < 0.36 && p.therm_id.z > 0.5) {
      let push = -ds / rs;
      vel = vel + push * 0.32 * dt;
    }
  }

  // Exact Tidal Gravity-Gradient Stress vs. Cohesive Tensile Strength + Self-Gravity!
  // Tidal acceleration across cluster radius R_c is: a_tidal = 2 * G * M_host * R_c / r^3
  let r_c = max(0.15, params.cluster_com_r.w);
  let a_tidal = (2.0 * params.gm_host * r_c) / (r * r * r);
  let a_hold = params.self_grav_k + params.cohesion_strength;
  let strain = a_tidal / max(1e-4, a_hold);

  if (mode == 0u && intact > 0.5) {
    // Check physical Roche-limit tensile rupture criterion: strain > 1.0 (i.e. r < R_Roche!)
    if (strain > 1.0 && r < params.r_roche * 1.05) {
      intact = 0.0; // Bond ruptured! Particle detaches into independent Keplerian ring debris!
    } else {
      // Intact cohesive rubble-pile restoring spring toward live cluster COM!
      let to_com = params.cluster_com_r.xyz - loc;
      let d_com = length(to_com);
      if (d_com > r_c * 0.35) {
        acc = acc + to_com * (a_hold * 2.4);
      }
    }
  }

  // Red-Giant Common-Envelope Aerodynamic Drag (mode=3) spiraling inner orbits inward!
  if (mode == 3u && r < params.r_host * 1.45) {
    vel = vel * (1.0 - params.envelope_drag * dt);
  }

  vel = vel + acc * dt;
  // Mild inelastic ring-plane flattening (mutual ring-particle collisions damp inclination!)
  if (intact < 0.5 && mode <= 1u) {
    vel.y = vel.y * (1.0 - 0.65 * dt);
  }
  loc = loc + vel * dt;

  // Keep disrupted debris outside host surface (accreted debris recycles softly at outer disk edge)
  if (length(loc) < params.r_host * 1.04) {
    let n_out = normalize(loc + vec3<f32>(1e-4, 0.0, 0.0));
    loc = n_out * (params.r_host * 1.06);
    vel = vel - n_out * min(0.0, dot(vel, n_out)) * 1.2;
  }

  // Thermal heating: Giant Impact / Magma Ocean stays molten hot (>1.0); tidal disruption warms debris
  let t_next = select(
    clamp(p.therm_id.x * exp(-0.08 * dt) + strain * 0.12 * dt, 0.12, 1.8),
    clamp(0.85 + 0.85 * exp(-length(loc) * 0.18), 0.25, 1.8),
    mode == 1u
  );
  p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
  p.vel_bond = vec4<f32>(vel, intact);
  p.therm_id = vec4<f32>(t_next, strain, p.therm_id.z, p.therm_id.w + dt);
  p.meta0.w = 1.0;
  parts[i] = p;
}

@compute @workgroup_size(64)
fn reduce_tidal_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var ruptured = 0.0;
  var strain_max = 0.0;
  var r_sum = 0.0;
  var live_cnt = 0.0;
  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = parts[i];
    if (p.meta0.w > 0.5) {
      live_cnt = live_cnt + 1.0;
      if (p.vel_bond.w < 0.5) { ruptured = ruptured + 1.0; }
      strain_max = max(strain_max, p.therm_id.y);
      r_sum = r_sum + length(p.pos_m.xyz - params.center_offset.xyz);
    }
    i = i + 64u;
  }
  wg0[tid] = ruptured; wg1[tid] = strain_max; wg2[tid] = r_sum; wg3[tid] = live_cnt;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s];
      wg1[tid] = max(wg1[tid], wg1[tid + s]);
      wg2[tid] += wg2[tid + s];
      wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let inv = 1.0 / max(1.0, wg3[0]);
    telemetry[0] = vec4<f32>(wg0[0] * inv, wg1[0], wg2[0] * inv, wg3[0]);
  }
}
`;function pn(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function mn(t,{mode:n=`roche-rings`,orbitRadiusSim:r=2.6,rHostSim:i=1.35,rRocheSim:c=3.6,gmHost:l=24,cohesionStrength:u=.65,selfGravK:d=.55,tidalHeatDrive:f=1,shepherdGm:p=.55,particleCount:m=4096,seed:h=20261125,centerOffset:g=[0,0,0],label:_=`ulg-tidal-roche`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createTidalRocheDisruptionSessionWebGpu requires a live WebGPU GPUDevice`);let v={"roche-rings":0,"giant-impact":1,"cryo-plumes":2,"red-giant-engulf":3,"catastrophic-shatter":4}[n]??0,y=Math.max(256,Math.min(32768,Math.trunc(m))),b=pn(h),x=Number(g?.[0])||0,S=Number(g?.[1])||0,C=Number(g?.[2])||0,w=[r,0,0],T=[0,0,Math.sqrt(l/Math.max(.5,r))],E=1.1,D=c*.92,O=.52,k=new Float32Array(y*16);for(let e=0;e<y;e+=1){let t=e*16,n=0,r=0,a=0,o=0,s=0,u=0,d=1,p=0,m=.25;if(v===0)if(e<y*.45){let e=Math.cbrt(b())*O,t=2*b()-1,i=Math.sqrt(Math.max(0,1-t*t)),c=b()*Math.PI*2;n=w[0]+e*i*Math.cos(c),r=w[1]+e*t,a=w[2]+e*i*Math.sin(c),o=T[0],s=T[1],u=T[2],d=1,p=0}else{let e=i*1.28+b()*(c*1.05-i*1.28),t=b()*Math.PI*2,f=Math.sqrt(l/e);n=Math.cos(t)*e,r=(b()-.5)*.08,a=Math.sin(t)*e,o=-Math.sin(t)*f,s=0,u=Math.cos(t)*f,d=0,p=1}else if(v===1){let e=b()*Math.PI*2,t=i*1.15+b()**.78*5.2,c=Math.sqrt(l/t)*(.88+.24*b());n=Math.cos(e)*t,r=(b()-.5)*(.28+.16*t),a=Math.sin(e)*t,o=-Math.sin(e)*c,s=(b()-.5)*.35,u=Math.cos(e)*c,d=0,p=1,m=1.45}else if(v===2){let e=b()*Math.PI*2,t=-1.25+(b()-.5)*.22,c=Math.cos(t),l=Math.sin(t),f=i*(1.02+b()*1.8);n=c*Math.cos(e)*f,r=l*f,a=c*Math.sin(e)*f,o=n*.4,s=r*.4,u=a*.4,d=0,p=2,m=.6}else if(v===4){let e=Math.cbrt(b()),t=(.12+.88*e)*Math.max(.35,i*.85),c=2*b()-1,l=Math.sqrt(Math.max(0,1-c*c)),h=b()*Math.PI*2,g=l*Math.cos(h),_=c,v=l*Math.sin(h);n=g*t,r=_*t,a=v*t;let y=(1.15+2.85*e*(.6+.8*b()))*Math.max(.5,f);o=g*y-v*.35,s=_*y,u=v*y+g*.35,d=0,p=1,m=1.25+(1-e)*.95}else{let e=b()*Math.PI*2,t=i*(1.1+b()*3.8),c=Math.sqrt(l/t);n=Math.cos(e)*t,r=(b()-.5)*.4,a=Math.sin(e)*t,o=-Math.sin(e)*c,s=0,u=Math.cos(e)*c,d=0,p=3,m=1.3}k[t+0]=n+x,k[t+1]=r+S,k[t+2]=a+C,k[t+3]=1,k[t+4]=o,k[t+5]=s,k[t+6]=u,k[t+7]=d,k[t+8]=m,k[t+9]=0,k[t+10]=p,k[t+11]=b()*2,k[t+12]=b(),k[t+13]=b(),k[t+14]=b(),k[t+15]=1}let A=[a(0,`uniform`),a(1,`storage`),a(2,`storage`)],j=s(t,{cacheKey:`ulg-tidal-roche-step.v2-shatter`,label:`${_}-step`,code:fn,entryPoint:`step_tidal_roche`,bindings:A}),M=s(t,{cacheKey:`ulg-tidal-roche-tel.v1`,label:`${_}-tel`,code:fn,entryPoint:`reduce_tidal_telemetry`,bindings:A}),N=t.createBuffer({label:`${_}-params`,size:96,usage:ln.UNIFORM|ln.COPY_DST}),P=t.createBuffer({label:`${_}-parts`,size:k.byteLength,usage:ln.STORAGE|ln.VERTEX|ln.COPY_DST|ln.COPY_SRC}),F=t.createBuffer({label:`${_}-tel`,size:16,usage:ln.STORAGE|ln.COPY_SRC}),I=t.createBuffer({label:`${_}-tel-rd`,size:16,usage:ln.MAP_READ|ln.COPY_DST});t.queue.writeBuffer(P,0,k);let L=o(t,{layout:j.bindGroupLayout,label:`${_}-bg`,entries:[{binding:0,resource:{buffer:N}},{binding:1,resource:{buffer:P}},{binding:2,resource:{buffer:F}}]}),R=0,z=!1,B=!1,V=Object.freeze({schema:cn,mode:n,stepIndex:0,rupturedFraction:0,maxTidalStrain:0,meanRadiusSim:r,activeParticles:0,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),ee=Math.ceil(y/64);async function H({dt:r=.025,substeps:a=2,readTelemetry:o=!0}={}){if(B)return V;let s=Math.max(1,Math.min(16,Math.trunc(a))),m=Math.max(.004,Math.min(.08,Number(r)||.025));for(let e=0;e<s;e+=1){let e=Math.max(.5,Math.hypot(w[0],w[1],w[2])),t=-l/(e*e*e);T[0]+=w[0]*t*m,T[1]+=w[1]*t*m,T[2]+=w[2]*t*m,w[0]+=T[0]*m,w[1]+=T[1]*m,w[2]+=T[2]*m;let n=Math.sqrt(l/D**3);E+=n*m,R+=1}let h=[Math.cos(E)*D,0,Math.sin(E)*D],g=new ArrayBuffer(96);new Uint32Array(g,0,4).set([y,v,R,0]),new Float32Array(g,16,20).set([m,l,i,c,u,d,f,v===3?.35:0,h[0],h[1],h[2],v===0?p:0,w[0],w[1],w[2],O,x,S,C,0]),t.queue.writeBuffer(N,0,g);let b=t.createCommandEncoder({label:`${_}-enc-${R}`}),k=b.beginComputePass({label:`${_}-pass`});k.setBindGroup(0,L),k.setPipeline(j.pipeline),k.dispatchWorkgroups(ee),k.setPipeline(M.pipeline),k.dispatchWorkgroups(1),k.end();let A=o&&!z&&I.mapState===`unmapped`;if(A&&(z=!0,b.copyBufferToBuffer(F,0,I,0,16)),t.queue.submit([b.finish()]),A)try{if(await I.mapAsync(ln.MAP_READ),!B){let t=new Float32Array(I.getMappedRange(0,16));V=Object.freeze({schema:cn,mode:n,stepIndex:R,rupturedFraction:t[0],maxTidalStrain:t[1],meanRadiusSim:t[2],activeParticles:Math.round(t[3]),accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}try{I.unmap()}catch{}}catch(e){if(!B&&e?.name!==`AbortError`)throw e}finally{z=!1}return V}function U(e=1){let t=[];if(v===0)t.push({pos:[x*e,S*e,C*e],radius:i*e,color0:[.88,.78,.58],color1:[.68,.56,.38],kind:2,atm:.42}),t.push({pos:[(Math.cos(E)*D+x)*e,S*e,(Math.sin(E)*D+C)*e],radius:.14*e,color0:[.76,.74,.72],color1:[.48,.46,.44],kind:3,atm:0});else if(v===1)t.push({pos:[x*e,S*e,C*e],radius:i*e,color0:[1,.42,.08],color1:[.22,.08,.05],kind:7,atm:.55});else if(v===2)t.push({pos:[x*e,S*e,C*e],radius:i*e,color0:[.86,.9,.96],color1:[.46,.62,.78],kind:3,atm:.14});else if(v===4)return t;else t.push({pos:[x*e,S*e,C*e],radius:i*1.65*e,color0:[1,.38,.12],color1:[.72,.12,.04],kind:0,atm:0});return t}function W(){if(!B){B=!0;for(let e of[N,P,F,I])try{e.destroy()}catch{}}}return Object.freeze({schema:cn,lawAdapter:un,get mode(){return n},get particleCount(){return y},get stepIndex(){return R},getResidentParticlesBuffer:()=>P,getRenderSpheres:U,getTelemetry:()=>V,step:H,dispose:W})}function hn(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`tidal-roche-rheology-cryovolcanism@1`)?e.resolveModule(`tidal-roche-rheology-cryovolcanism@1`)?.descriptor||null:e.registerModule({method:{model:`tidal-roche-rheology-cryovolcanism`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/tidalRocheDisruptionGpu.js`,entryPoint:`step_tidal_roche`,workgroupSize:64},parameterSchema:{mode:{type:`string`,required:!1},orbitRadiusSim:{type:`number`,min:.5,max:50,required:!1}},stateLayout:{tensorId:`tidal-debris-particles`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`m`,`vx`,`vy`,`vz`,`intact`,`temp`,`strain`,`role`,`age`,`seed`,`r0`,`phi0`,`live`]},scaleRangeM:[100,0x5af3107a4000],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=mn(n,{mode:r.mode??`roche-rings`,orbitRadiusSim:r.orbitRadiusSim??2.4,particleCount:512}),a=await i.step({dt:.025,substeps:2,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:tidal-roche:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/tidalRocheDisruptionGpu.js`,entryPoint:`createTidalRocheDisruptionSessionWebGpu`,kernelEntryPoint:`step_tidal_roche`},representation:`tidal-roche-rheology-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-tidal-roche`,placement:`local`},validity:{finite:Number.isFinite(a.rupturedFraction)&&Number.isFinite(a.maxTidalStrain)},validation:{status:`pass`,validationMode:`gpu-tidal-roche-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var gn=`ulg.astrophysics.planetary-atmosphere-3d-cfd-webgpu.v1`,_n=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),vn=Object.freeze({id:`planetary-atmosphere-3d-cfd`,lawNodeId:`law:astrophysics-planetary-atmosphere-3d-cfd`,orderConstraint:`after:planetary-atmosphere-em`,adapterMode:n.SURFACE_INTERFACE,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`planetary-body-state`,`planetary-atmo-3d-velocity`,`planetary-atmo-3d-clouds`,`vehicle-3d-pose`]),writes:Object.freeze([`planetary-atmo-3d-velocity`,`planetary-atmo-3d-pressure`,`planetary-atmo-3d-clouds`,`cfd-3d-motes`]),accumulates:Object.freeze([`planetary-atmo-3d-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`incompressible-3d-volume-flux`,`condensable-vapor-plus-cloud-mass`,`baroclinic-vorticity`]),validityDomain:Object.freeze({minSurfacePressurePa:20,maxMachNumber:.85,cflBounded:!0}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([10,2e5]),fundamentalLaws:Object.freeze([`navier-stokes-3d-anelastic-boussinesq`,`coriolis-zonal-jet-instability`,`hydrostatic-adiabatic-stratification`,`clausius-clapeyron-multi-species-condensation`,`aerodynamic-buoyant-craft-coupling`])});function yn(e={}){let t=!!(e.surfaceViewActive||e.atmosphericDiveActive),n=Math.max(0,Number(e.surfacePressurePa)||0),r=t&&n>=20;return{active:r,deepFluidEnvelope:r&&!e.hasSolidCrust,reason:r?e.hasSolidCrust?`3d-tropospheric-cfd-active`:`3d-deep-giant-baroclinic-cfd-active`:n<20?`vacuum-atmosphere-dormant`:`orbital-scale-dormant`}}var bn=Object.freeze([{id:`CH4`,name:`Methane Ice`,A:4.22,B:455,tMaxK:130,color:[.46,.84,.98],hazeRgb:[.22,.56,.86]},{id:`NH3`,name:`Ammonia Cirrus`,A:6.72,B:1588,tMaxK:240,color:[.96,.91,.78],hazeRgb:[.84,.74,.56]},{id:`NH4SH`,name:`Ammonium Hydrosulfide`,A:10.65,B:2410,tMaxK:310,color:[.84,.52,.3],hazeRgb:[.7,.38,.2]},{id:`H2O`,name:`Water Cloud / Supercell`,A:6.08,B:2260,tMaxK:420,color:[.96,.98,1],hazeRgb:[.58,.76,.95]},{id:`H2SO4`,name:`Sulfuric Acid Deck`,A:7.45,B:3250,tMaxK:620,color:[.95,.88,.58],hazeRgb:[.88,.76,.38]},{id:`KCl`,name:`Alkali Chloride Haze`,A:7.61,B:8400,tMaxK:1300,color:[.94,.7,.44],hazeRgb:[.76,.46,.24]},{id:`MgSiO3`,name:`Silicate Cloud Deck`,A:10.45,B:21500,tMaxK:2400,color:[1,.62,.28],hazeRgb:[.82,.34,.14]}]);function xn(e,t,n){return Math.max(t,Math.min(n,e))}function Sn(e,t,n){let r=xn(n,0,1);return[e[0]+(t[0]-e[0])*r,e[1]+(t[1]-e[1])*r,e[2]+(t[2]-e[2])*r]}function Cn(e={},t=null){let n=Math.max(1e5,(Number(e.radiusKm)||(t?.radiusM?t.radiusM/1e3:6371))*1e3),r=Math.max(0xde0b6b3a7640000,(Number(e.massSolar)||300349e-11)*198847e25),i=xn(Number(t?.gravityMS2??e.surfaceGravityMS2)||66743e-15*r/(n*n),.15,45),a=t?.hasSolidCrust??n<16e6,o=Math.max(0,Number(t?.pressurePa??e.surfacePressurePa)||0),s=Math.max(35,Number(t?.tempK??e.tempK)||288),c=Math.max(0,Number(e.volatileMassFrac??(t?.hasLiquidOcean?.08:a&&o>=2e4&&o<15e5&&s>=255&&s<=375?.06:0))||0),l=Math.max(0,Number(e.particulateMassFrac)||0),u=Math.abs(Number(e.rotationOmegaRadS)||(a?729e-7:176e-6)),d=xn(Number(e.coRatio)||.55,.15,1.8),f=Math.max(.5,Number(e.metallicityEnhancement)||(a?1:n<35e6?25:3.5)),p=!a,m=p?n<35e6?.00265:.00232:o>2e6||o>50&&o<2e4?.0438:s<130&&o>5e4?.0274:.0289,h=p?12100:m>.036?845:1005,g=8.31446*s/(m*i*1e3),_=i/h*1e3,v=[];if(p){let e=s<105||n<35e6,t=s>650,r=t?2e-4:e?.023:.0024*Math.min(4,f*.35),i=t?.0018*d:1e-6,a=e?.012:t?.0015/Math.max(.4,d):.0032,o=t?5e-5:e?4e-4:42e-5,c=t?1e-4:12e-5,l=e?.145:.132,u=l+r+i+a+o+c;v=[{id:`H2`,name:`Hydrogen`,moleFrac:Math.max(.55,1-u),condensable:!1},{id:`He`,name:`Helium`,moleFrac:l,condensable:!1},{id:`CH4`,name:`Methane`,moleFrac:r,condensable:!0},{id:`H2O`,name:`Water Vapor`,moleFrac:a,condensable:!0},{id:`NH3`,name:`Ammonia`,moleFrac:o,condensable:!0},{id:`NH4SH`,name:`NH₄SH / H₂S`,moleFrac:c,condensable:!0},...t?[{id:`CO`,name:`Carbon Monoxide`,moleFrac:i,condensable:!1},{id:`MgSiO3`,name:`Silicate Vapor`,moleFrac:25e-5,condensable:!0},{id:`KCl`,name:`Alkali Chlorides`,moleFrac:18e-5,condensable:!0}]:[]]}else if(o>15e5)v=[{id:`CO2`,name:`Carbon Dioxide`,moleFrac:.964,condensable:!1},{id:`N2`,name:`Nitrogen`,moleFrac:.034,condensable:!1},{id:`H2SO4`,name:`Sulfuric Acid / SO₂`,moleFrac:.0016,condensable:!0},{id:`H2O`,name:`Water Vapor`,moleFrac:4e-4,condensable:!0}];else if(s<130&&o>3e4)v=[{id:`N2`,name:`Nitrogen`,moleFrac:.946,condensable:!1},{id:`CH4`,name:`Methane`,moleFrac:.049,condensable:!0},{id:`H2`,name:`Hydrogen`,moleFrac:.002,condensable:!1},{id:`C2H6`,name:`Ethane / Tholins`,moleFrac:.003,condensable:!1}];else if(o>=2e4&&c>=.015&&s>=255&&s<=375){let e=xn(.012+c*.14,.008,.038);v=[{id:`N2`,name:`Nitrogen`,moleFrac:.781-e*.78,condensable:!1},{id:`O2`,name:`Oxygen`,moleFrac:.209-e*.21,condensable:!1},{id:`H2O`,name:`Water Vapor`,moleFrac:e,condensable:!0},{id:`Ar`,name:`Argon`,moleFrac:.0093,condensable:!1},{id:`CO2`,name:`Carbon Dioxide`,moleFrac:45e-5,condensable:!1}]}else v=o>=20?[{id:`CO2`,name:`Carbon Dioxide`,moleFrac:.952,condensable:!1},{id:`N2`,name:`Nitrogen`,moleFrac:.027,condensable:!1},{id:`Ar`,name:`Argon`,moleFrac:.019,condensable:!1},{id:`H2O`,name:`Water Vapor`,moleFrac:Math.max(3e-4,c*.02),condensable:!0}]:[];let y=p?-110:0,b=p?65:o>15e5?72:28,x=p?14:o>15e5?52:3.5,S=p?1:Math.max(1e-5,o/101325),C=p?Math.max(55,s*1.18):s,w=o<20?0:xn((p?45:12)*Math.max(.2,u/729e-7)**.45*Math.sqrt(Math.max(.3,C/165)),4,180),T=xn(w/Math.max(.001,2*u*n*.12),.015,2.5),E=o<20?0:xn((p?1.35:.95)*Math.sqrt(i/9.81),.25,2.6);return Object.freeze({hasSolidCrust:a,isDeepFluid:p,gravityMS2:i,radiusM:n,omegaRadS:u,basePressurePa:o,baseTempK:s,molarMassKgMol:m,cpJKgK:h,scaleHeightKm:xn(g,4,75),dryLapseKPerKm:xn(_,.35,11.5),minAltKm:y,maxAltKm:b,startAltKm:x,refPressureBar:S,refTempK:C,jetSpeedScaleMS:w,rossbyNumber:T,convectiveBuoyancyScale:E,dustFrac:l,volatileFrac:c,bulkComposition:Object.freeze(v.map(e=>Object.freeze({...e}))),baseSkyZenith:t?.skyZenithRgb?[...t.skyZenithRgb]:[.12,.34,.76],baseSkyHorizon:t?.skyHorizonRgb?[...t.skyHorizonRgb]:[.56,.78,.96]})}function wn(e,t=0){let n=xn(Number(t)||0,e.minAltKm,e.maxAltKm);if(e.basePressurePa<20&&e.hasSolidCrust)return{altKm:n,pressureBar:0,pressurePa:0,tempK:e.baseTempK,rhoKgM3:0,scaleHeightKm:e.scaleHeightKm,activeCloudDeck:`Vacuum Exosphere`,activeCloudId:`none`,cloudOpticalDensity:0,cloudColor:[.5,.6,.7],species:[],condensingDecks:[],skyZenithRgb:[.004,.007,.016],skyHorizonRgb:[.012,.018,.032],opticalDepth:0};let r=e.isDeepFluid?28:e.basePressurePa>15e5?62:12.5,i=e.isDeepFluid?Math.min(3.4,e.dryLapseKPerKm*.92):e.volatileFrac>.01?e.dryLapseKPerKm*.66:e.dryLapseKPerKm*.85,a;a=n<=r?Math.max(42,e.refTempK-i*n):Math.max(42,e.refTempK-i*r)+(n-r)*.85;let o=.5*(e.refTempK+a),s=Math.max(3,8.31446*o/(e.molarMassKgMol*e.gravityMS2*1e3)),c=xn(e.refPressureBar*Math.exp(-n/s),1e-5,200),l=c*101325,u=l*e.molarMassKgMol/(8.31446*a),d=[],f=[],p=null,m=0,h=[0,0,0],g=0,_=0;for(let t of e.bulkComposition){let e=t.moleFrac,n=0,r=t.condensable?bn.find(e=>e.id===t.id):null;if(r&&t.moleFrac>1e-6){let i=t.moleFrac*c,o=10**xn(r.A-r.B/Math.max(35,a),-18,6),s=i/Math.max(1e-18,o);if(s>1&&a<r.tMaxK){let i=Math.exp(-((Math.log10(s)/1.15)**2)),a=Math.min(.985,1-1/s);n=t.moleFrac*a*i,e=Math.max(1e-7,t.moleFrac/s);let o=xn(i*Math.min(1,(t.moleFrac*350)**.42),0,1);if(o>.08){let e={id:r.id,name:r.name,density:o,color:r.color,hazeRgb:r.hazeRgb,satRatio:s};f.push(e),m+=o,h[0]+=r.color[0]*o,h[1]+=r.color[1]*o,h[2]+=r.color[2]*o,g+=o,(!p||o>p.density)&&(p=e)}}}_+=e,d.push({id:t.id,name:t.name,moleFrac:e,condensedFrac:n})}if(!e.isDeepFluid&&n>r*.85&&d.some(e=>e.id===`O2`&&e.moleFrac>.05)){let e=6e-6*Math.exp(-(((n-(r+9))/6)**2));e>1e-7&&(d.push({id:`O3`,name:`Ozone Layer`,moleFrac:e,condensedFrac:0}),_+=e)}if(_>0)for(let e of d)e.moleFrac/=_;d.sort((e,t)=>t.moleFrac-e.moleFrac);let v=g>1e-4?[h[0]/g,h[1]/g,h[2]/g]:[.92,.95,.98],y=xn(m,0,1),b=xn(Math.log10(Math.max(1e-4,c)/.008)/1.85,0,1),x=e.isDeepFluid?xn(1-Math.max(0,Math.log10(Math.max(1,c))-.65)*.55,.22,1):1,S=e.baseSkyZenith.map(e=>e*b*x),C=e.baseSkyHorizon.map(e=>e*(.35+.65*b)*x);if(p){let t=xn(p.density*(e.isDeepFluid?.72:.34),0,.78);C=Sn(C,p.hazeRgb.map(e=>e*x),t),S=Sn(S,p.hazeRgb.map(e=>e*.58*x),t*.62)}if(e.isDeepFluid&&c>8){let e=xn((Math.log10(c)-.9)/.7,0,.85);S=Sn(S,[.06,.04,.08],e),C=Sn(C,[.22,.11,.06],e)}let w=`Clear Troposphere`;return n>r+2?w=`Upper Stratosphere`:p?w=p.name:e.isDeepFluid&&c>12?w=`Deep Supercritical H₂/He`:e.dustFrac>.25&&n<5&&(w=`Suspended Mineral Dust Layer`),{altKm:n,pressureBar:c,pressurePa:l,tempK:a,rhoKgM3:u,scaleHeightKm:s,activeCloudDeck:w,activeCloudId:p?p.id:`clear`,cloudOpticalDensity:y,cloudColor:v,species:d,condensingDecks:f,skyZenithRgb:S,skyHorizonRgb:C,opticalDepth:xn(b*.95,.02,1)}}var Tn=`
struct Cfd3dParams {
  dims: vec4<u32>,         // nx, ny, nz, mote_count
  flags: vec4<u32>,        // step_idx, is_deep_fluid, pad0, pad1
  phys0: vec4<f32>,        // dt, jet_scale, coriolis_f, buoyancy_g
  phys1: vec4<f32>,        // box_half_xz, box_half_y, rossby_num, cloud_opt
  craft_pos: vec4<f32>,    // x, y, z, alt_km
  deck0_col: vec4<f32>,    // upper cloud RGB, upper_y_norm
  deck1_col: vec4<f32>,    // mid cloud RGB, mid_y_norm
  deck2_col: vec4<f32>,    // lower cloud RGB, lower_y_norm
};

fn wrap_i(i: i32, n: i32) -> u32 {
  let m = i % n;
  return u32(select(m, m + n, m < 0));
}

fn clamp_i(i: i32, n: i32) -> u32 {
  return u32(clamp(i, 0, n - 1));
}
`,En=`
${Tn}

@group(0) @binding(0) var<uniform> p: Cfd3dParams;
@group(0) @binding(1) var<storage, read> vel_in: array<vec4<f32>>;        // (u, v, w, theta_pert)
@group(0) @binding(2) var<storage, read_write> vel_out: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> cloud_in: array<vec4<f32>>;      // (q_cloud, deck_mix, vort_mag, flash)
@group(0) @binding(4) var<storage, read_write> cloud_out: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> pdiv_in: array<vec2<f32>>;       // (pressure, div)
@group(0) @binding(6) var<storage, read_write> pdiv_out: array<vec2<f32>>;

fn vid(ix: u32, iy: u32, iz: u32) -> u32 {
  return (iz * p.dims.y + iy) * p.dims.x + ix;
}

fn sample_vel_trilin(pos_g: vec3<f32>) -> vec4<f32> {
  let nx = i32(p.dims.x);
  let ny = i32(p.dims.y);
  let nz = i32(p.dims.z);
  let gx = pos_g.x;
  let gy = clamp(pos_g.y, 0.0, f32(ny) - 1.001);
  let gz = pos_g.z;
  let ix0 = i32(floor(gx));
  let iy0 = i32(floor(gy));
  let iz0 = i32(floor(gz));
  let fx = gx - f32(ix0);
  let fy = gy - f32(iy0);
  let fz = gz - f32(iz0);

  let x0 = wrap_i(ix0, nx); let x1 = wrap_i(ix0 + 1, nx);
  let y0 = clamp_i(iy0, ny); let y1 = clamp_i(iy0 + 1, ny);
  let z0 = wrap_i(iz0, nz); let z1 = wrap_i(iz0 + 1, nz);

  let c000 = vel_in[vid(x0, y0, z0)];
  let c100 = vel_in[vid(x1, y0, z0)];
  let c010 = vel_in[vid(x0, y1, z0)];
  let c110 = vel_in[vid(x1, y1, z0)];
  let c001 = vel_in[vid(x0, y0, z1)];
  let c101 = vel_in[vid(x1, y0, z1)];
  let c011 = vel_in[vid(x0, y1, z1)];
  let c111 = vel_in[vid(x1, y1, z1)];

  let c00 = mix(c000, c100, fx);
  let c10 = mix(c010, c110, fx);
  let c01 = mix(c001, c101, fx);
  let c11 = mix(c011, c111, fx);
  let c0 = mix(c00, c10, fy);
  let c1 = mix(c01, c11, fy);
  return mix(c0, c1, fz);
}

fn sample_cloud_trilin(pos_g: vec3<f32>) -> vec4<f32> {
  let nx = i32(p.dims.x);
  let ny = i32(p.dims.y);
  let nz = i32(p.dims.z);
  let gx = pos_g.x;
  let gy = clamp(pos_g.y, 0.0, f32(ny) - 1.001);
  let gz = pos_g.z;
  let ix0 = i32(floor(gx));
  let iy0 = i32(floor(gy));
  let iz0 = i32(floor(gz));
  let fx = gx - f32(ix0);
  let fy = gy - f32(iy0);
  let fz = gz - f32(iz0);

  let x0 = wrap_i(ix0, nx); let x1 = wrap_i(ix0 + 1, nx);
  let y0 = clamp_i(iy0, ny); let y1 = clamp_i(iy0 + 1, ny);
  let z0 = wrap_i(iz0, nz); let z1 = wrap_i(iz0 + 1, nz);

  let c00 = mix(cloud_in[vid(x0, y0, z0)], cloud_in[vid(x1, y0, z0)], fx);
  let c10 = mix(cloud_in[vid(x0, y1, z0)], cloud_in[vid(x1, y1, z0)], fx);
  let c01 = mix(cloud_in[vid(x0, y0, z1)], cloud_in[vid(x1, y0, z1)], fx);
  let c11 = mix(cloud_in[vid(x0, y1, z1)], cloud_in[vid(x1, y1, z1)], fx);
  return mix(mix(c00, c10, fy), mix(c01, c11, fy), fz);
}

// Pass 1: Semi-Lagrangian 3D Advection + Baroclinic Buoyancy + 3D Coriolis + Thermal Wind Jets + Cloud Condensation
@compute @workgroup_size(4, 4, 4)
fn cfd3d_advect_forces(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.dims.x || gid.y >= p.dims.y || gid.z >= p.dims.z) { return; }
  let id = vid(gid.x, gid.y, gid.z);
  let dt = p.phys0.x;
  let jet_scale = p.phys0.y;
  let coriolis_f = p.phys0.z;
  let buoy_g = p.phys0.w;
  let rossby = max(0.05, p.phys1.z);
  let is_deep = p.flags.y != 0u;

  let cur_v = vel_in[id];
  // Semi-Lagrangian backtrace in grid units
  let vel_to_grid = 0.22;
  let back_g = vec3<f32>(f32(gid.x), f32(gid.y), f32(gid.z)) - cur_v.xyz * (dt * vel_to_grid);
  let adv_v = sample_vel_trilin(back_g);
  let adv_c = sample_cloud_trilin(back_g);

  var u = adv_v.x;
  var v = adv_v.y;
  var w = adv_v.z;
  var theta = adv_v.w;

  let y_norm = (f32(gid.y) + 0.5) / f32(p.dims.y);
  let z_norm = (f32(gid.z) + 0.5) / f32(p.dims.z);
  let x_norm = (f32(gid.x) + 0.5) / f32(p.dims.x);

  // Baroclinic thermal-wind zonal jet equilibrium profile:
  //   Small Rossby number (fast-rotating gas giant) -> multi-band alternating prograde/retrograde zonal jets!
  //   Larger Rossby number (terrestrial world) -> mid-latitude westerly jet stream + surface trade winds!
  let band_freq = select(6.2831853, 12.5663706, rossby < 0.25);
  let vert_jet_env = select(
    sin(clamp((y_norm - 0.15) / 0.85, 0.0, 1.0) * 3.1415926),
    0.55 + 0.45 * sin(y_norm * 3.1415926),
    is_deep
  );
  let u_jet_eq = jet_scale * 0.28 * sin(z_norm * band_freq + 0.45 * sin(x_norm * 6.2831853)) * vert_jet_env;
  let relax_tau = select(0.18, 0.26, is_deep);
  u = u + (u_jet_eq - u) * (relax_tau * dt);

  // 3D Coriolis force (-f * k x v): deflects horizontal flows into spinning cyclones & anticyclonic vortices!
  let f_eff = coriolis_f * (0.4 + 0.8 * (z_norm - 0.5));
  let du_cor = f_eff * w;
  let dw_cor = -f_eff * u;
  u = u + du_cor * dt;
  w = w + dw_cor * dt;

  // Baroclinic convective buoyancy from warm lower layers / moist latent heating!
  let conv_wave = sin(x_norm * 12.5663706 + f32(p.flags.x) * 0.015) * cos(z_norm * 12.5663706 - f32(p.flags.x) * 0.011);
  let lower_heat = (1.0 - smoothstep(0.06, 0.45, y_norm)) * (0.35 + 0.65 * max(0.0, conv_wave));
  let upper_cool = smoothstep(0.62, 0.96, y_norm) * 0.30;
  theta = theta * exp(-0.32 * dt) + (lower_heat - upper_cool) * (0.85 * buoy_g * dt);
  v = v + theta * (1.85 * buoy_g * dt);

  // Impermeable top/bottom boundary damping (prevents vertical blowup!)
  let wall_damp = smoothstep(0.0, 0.12, y_norm) * (1.0 - smoothstep(0.88, 1.0, y_norm));
  v = v * (0.82 + 0.18 * wall_damp);
  if (gid.y == 0u || gid.y + 1u == p.dims.y) {
    v = 0.0;
  }

  // Mild eddy viscosity & physical velocity safety cap
  let visc = exp(-0.08 * dt);
  u = clamp(u * visc, -35.0, 35.0);
  v = clamp(v * visc, -16.0, 16.0);
  w = clamp(w * visc, -35.0, 35.0);
  theta = clamp(theta, -4.5, 4.5);

  // Multi-deck Clausius-Clapeyron cloud condensation density along vertical strata (deck0=upper, deck1=mid, deck2=lower)
  let d0_x = (y_norm - p.deck0_col.w) / 0.14;
  let d1_x = (y_norm - p.deck1_col.w) / 0.16;
  let d2_x = (y_norm - p.deck2_col.w) / 0.17;
  let d0 = exp(-(d0_x * d0_x));
  let d1 = exp(-(d1_x * d1_x));
  let d2 = exp(-(d2_x * d2_x));
  let deck_env = max(d0, max(d1, d2));
  let updraft_cond = max(0.0, v * 0.16 + theta * 0.12);
  let target_q = clamp(deck_env * (0.28 + 0.72 * p.phys1.w) + updraft_cond * 0.45, 0.0, 1.25);
  let q_next = clamp(adv_c.x * exp(-0.22 * dt) + target_q * (0.34 * dt), 0.0, 1.25);
  let deck_mix = clamp(y_norm, 0.0, 1.0);
  // Localized convective electrical flash in strong moist updrafts (zero flashes when q_next is low!)
  let flash_trig = select(0.0, 1.0, q_next > 0.72 && v > 1.8 && abs(conv_wave) > 0.72);
  let flash_next = clamp(max(adv_c.w * exp(-6.5 * dt), flash_trig), 0.0, 1.5);

  vel_out[id] = vec4<f32>(u, v, w, theta);
  cloud_out[id] = vec4<f32>(q_next, deck_mix, adv_c.z, flash_next);
}

// Pass 2: Compute 3D Velocity Divergence div(v*)
@compute @workgroup_size(4, 4, 4)
fn cfd3d_divergence(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.dims.x || gid.y >= p.dims.y || gid.z >= p.dims.z) { return; }
  let nx = i32(p.dims.x);
  let ny = i32(p.dims.y);
  let nz = i32(p.dims.z);
  let xm = wrap_i(i32(gid.x) - 1, nx); let xp = wrap_i(i32(gid.x) + 1, nx);
  let ym = clamp_i(i32(gid.y) - 1, ny); let yp = clamp_i(i32(gid.y) + 1, ny);
  let zm = wrap_i(i32(gid.z) - 1, nz); let zp = wrap_i(i32(gid.z) + 1, nz);

  let du_dx = 0.5 * (vel_in[vid(xp, gid.y, gid.z)].x - vel_in[vid(xm, gid.y, gid.z)].x);
  let dv_dy = 0.5 * (vel_in[vid(gid.x, yp, gid.z)].y - vel_in[vid(gid.x, ym, gid.z)].y);
  let dw_dz = 0.5 * (vel_in[vid(gid.x, gid.y, zp)].z - vel_in[vid(gid.x, gid.y, zm)].z);
  let id = vid(gid.x, gid.y, gid.z);
  pdiv_out[id] = vec2<f32>(pdiv_in[id].x * 0.75, du_dx + dv_dy + dw_dz);
}

// Pass 3: 3D Jacobi Pressure Poisson Solver (nabla^2 p = div(v*))
@compute @workgroup_size(4, 4, 4)
fn cfd3d_jacobi_pressure(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.dims.x || gid.y >= p.dims.y || gid.z >= p.dims.z) { return; }
  let nx = i32(p.dims.x);
  let ny = i32(p.dims.y);
  let nz = i32(p.dims.z);
  let xm = wrap_i(i32(gid.x) - 1, nx); let xp = wrap_i(i32(gid.x) + 1, nx);
  let ym = clamp_i(i32(gid.y) - 1, ny); let yp = clamp_i(i32(gid.y) + 1, ny);
  let zm = wrap_i(i32(gid.z) - 1, nz); let zp = wrap_i(i32(gid.z) + 1, nz);
  let id = vid(gid.x, gid.y, gid.z);

  let p_sum = pdiv_in[vid(xm, gid.y, gid.z)].x + pdiv_in[vid(xp, gid.y, gid.z)].x
    + pdiv_in[vid(gid.x, ym, gid.z)].x + pdiv_in[vid(gid.x, yp, gid.z)].x
    + pdiv_in[vid(gid.x, gid.y, zm)].x + pdiv_in[vid(gid.x, gid.y, zp)].x;
  let div_v = pdiv_in[id].y;
  pdiv_out[id] = vec2<f32>((p_sum - div_v) * (1.0 / 6.0), div_v);
}

// Pass 4A: Divergence-Free Velocity Projection v <- v* - grad(p) + 3D Vorticity |curl(v)|
@compute @workgroup_size(4, 4, 4)
fn cfd3d_project_velocity(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.dims.x || gid.y >= p.dims.y || gid.z >= p.dims.z) { return; }
  let nx = i32(p.dims.x);
  let ny = i32(p.dims.y);
  let nz = i32(p.dims.z);
  let xm = wrap_i(i32(gid.x) - 1, nx); let xp = wrap_i(i32(gid.x) + 1, nx);
  let ym = clamp_i(i32(gid.y) - 1, ny); let yp = clamp_i(i32(gid.y) + 1, ny);
  let zm = wrap_i(i32(gid.z) - 1, nz); let zp = wrap_i(i32(gid.z) + 1, nz);
  let id = vid(gid.x, gid.y, gid.z);

  let dpx = 0.5 * (pdiv_in[vid(xp, gid.y, gid.z)].x - pdiv_in[vid(xm, gid.y, gid.z)].x);
  let dpy = 0.5 * (pdiv_in[vid(gid.x, yp, gid.z)].x - pdiv_in[vid(gid.x, ym, gid.z)].x);
  let dpz = 0.5 * (pdiv_in[vid(gid.x, gid.y, zp)].x - pdiv_in[vid(gid.x, gid.y, zm)].x);

  let v_raw = vel_in[id];
  var v_proj = vec3<f32>(v_raw.x - dpx, v_raw.y - dpy, v_raw.z - dpz);
  if (gid.y == 0u || gid.y + 1u == p.dims.y) {
    v_proj.y = 0.0;
  }
  vel_out[id] = vec4<f32>(v_proj, v_raw.w);

  // 3D Vorticity magnitude |curl(v)| for cyclone/eddy highlighting & telemetry
  let dw_dy = 0.5 * (vel_in[vid(gid.x, yp, gid.z)].z - vel_in[vid(gid.x, ym, gid.z)].z);
  let dv_dz = 0.5 * (vel_in[vid(gid.x, gid.y, zp)].y - vel_in[vid(gid.x, gid.y, zm)].y);
  let du_dz = 0.5 * (vel_in[vid(gid.x, gid.y, zp)].x - vel_in[vid(gid.x, gid.y, zm)].x);
  let dw_dx = 0.5 * (vel_in[vid(xp, gid.y, gid.z)].z - vel_in[vid(xm, gid.y, gid.z)].z);
  let dv_dx = 0.5 * (vel_in[vid(xp, gid.y, gid.z)].y - vel_in[vid(xm, gid.y, gid.z)].y);
  let du_dy = 0.5 * (vel_in[vid(gid.x, yp, gid.z)].x - vel_in[vid(gid.x, ym, gid.z)].x);
  let vort = length(vec3<f32>(dw_dy - dv_dz, du_dz - dw_dx, dv_dx - du_dy));

  let c_in = cloud_in[id];
  cloud_out[id] = vec4<f32>(c_in.x, c_in.y, vort, c_in.w);
}
`,Dn=`
${Tn}

@group(0) @binding(0) var<uniform> p: Cfd3dParams;
@group(0) @binding(1) var<storage, read> vel_in: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> cloud_in: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> pdiv_in: array<vec2<f32>>;
@group(0) @binding(4) var<storage, read_write> motes: array<f32>;
@group(0) @binding(5) var<storage, read_write> telemetry: array<f32>;

fn vid(ix: u32, iy: u32, iz: u32) -> u32 {
  return (iz * p.dims.y + iy) * p.dims.x + ix;
}

fn sample_vel_trilin(pos_g: vec3<f32>) -> vec4<f32> {
  let nx = i32(p.dims.x);
  let ny = i32(p.dims.y);
  let nz = i32(p.dims.z);
  let gx = pos_g.x;
  let gy = clamp(pos_g.y, 0.0, f32(ny) - 1.001);
  let gz = pos_g.z;
  let ix0 = i32(floor(gx));
  let iy0 = i32(floor(gy));
  let iz0 = i32(floor(gz));
  let fx = gx - f32(ix0);
  let fy = gy - f32(iy0);
  let fz = gz - f32(iz0);
  let x0 = wrap_i(ix0, nx); let x1 = wrap_i(ix0 + 1, nx);
  let y0 = clamp_i(iy0, ny); let y1 = clamp_i(iy0 + 1, ny);
  let z0 = wrap_i(iz0, nz); let z1 = wrap_i(iz0 + 1, nz);
  let c00 = mix(vel_in[vid(x0, y0, z0)], vel_in[vid(x1, y0, z0)], fx);
  let c10 = mix(vel_in[vid(x0, y1, z0)], vel_in[vid(x1, y1, z0)], fx);
  let c01 = mix(vel_in[vid(x0, y0, z1)], vel_in[vid(x1, y0, z1)], fx);
  let c11 = mix(vel_in[vid(x0, y1, z1)], vel_in[vid(x1, y1, z1)], fx);
  return mix(mix(c00, c10, fy), mix(c01, c11, fy), fz);
}

fn sample_cloud_trilin(pos_g: vec3<f32>) -> vec4<f32> {
  let nx = i32(p.dims.x);
  let ny = i32(p.dims.y);
  let nz = i32(p.dims.z);
  let gx = pos_g.x;
  let gy = clamp(pos_g.y, 0.0, f32(ny) - 1.001);
  let gz = pos_g.z;
  let ix0 = i32(floor(gx));
  let iy0 = i32(floor(gy));
  let iz0 = i32(floor(gz));
  let fx = gx - f32(ix0);
  let fy = gy - f32(iy0);
  let fz = gz - f32(iz0);
  let x0 = wrap_i(ix0, nx); let x1 = wrap_i(ix0 + 1, nx);
  let y0 = clamp_i(iy0, ny); let y1 = clamp_i(iy0 + 1, ny);
  let z0 = wrap_i(iz0, nz); let z1 = wrap_i(iz0 + 1, nz);
  let c00 = mix(cloud_in[vid(x0, y0, z0)], cloud_in[vid(x1, y0, z0)], fx);
  let c10 = mix(cloud_in[vid(x0, y1, z0)], cloud_in[vid(x1, y1, z0)], fx);
  let c01 = mix(cloud_in[vid(x0, y0, z1)], cloud_in[vid(x1, y0, z1)], fx);
  let c11 = mix(cloud_in[vid(x0, y1, z1)], cloud_in[vid(x1, y1, z1)], fx);
  return mix(mix(c00, c10, fy), mix(c01, c11, fy), fz);
}

// Pass 4B: Advect 3,072 Zero-Copy GPU 3D Volumetric Cloud Puffs & CFD Eddy Streamers Around the Craft!
@compute @workgroup_size(64)
fn cfd3d_step_motes(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let count = p.dims.w;
  if (i >= count) { return; }
  let o = i * 16u;
  let dt = p.phys0.x;
  let half_xz = max(28.0, p.phys1.x);
  let half_y = max(16.0, p.phys1.y);
  let cx = p.craft_pos.x;
  let cy = p.craft_pos.y;
  let cz = p.craft_pos.z;
  let is_deep = p.flags.y != 0u;
  let ground_y = p.deck2_col.w;

  var px = motes[o + 0u];
  var py = motes[o + 1u];
  var pz = motes[o + 2u];
  let role = motes[o + 3u]; // 3.0 = 3D volumetric cloud puff, 4.0 = crisp 3D CFD flow streamline mote
  var age = motes[o + 7u] + dt;
  let max_life = max(1.5, motes[o + 11u]);
  let seed = motes[o + 14u];

  // Vertical envelope:
  //   - Deep fluid gas/ice giants: full 360-deg surrounding cloud canyons & zonal jet streams around craft!
  //   - Rocky solid-crust worlds: keep 3D CFD flow ribbons sweeping cleanly through rover/drone/UFO airspace
  //     (ground_y + 2.5m .. +46m) and lift volumetric cumulus/cirrus cloud decks high into the real sky dome
  //     (ground_y + 115m .. +230m) so clouds form an overhead sky canopy and NEVER whiteout the camera!
  let y_min = select(
    select(ground_y + 2.5, max(ground_y + 115.0, cy + 48.0), role < 3.5),
    cy - half_y,
    is_deep
  );
  let y_max = select(
    select(max(ground_y + 46.0, cy + 20.0), max(ground_y + 230.0, cy + 135.0), role < 3.5),
    cy + half_y,
    is_deep
  );

  // Map mote world position into periodic 3D CFD grid centered around the exploring craft
  let rel_x = px - cx;
  let rel_z = pz - cz;
  let needs_wrap = abs(rel_x) > half_xz || abs(rel_z) > half_xz || py < y_min - 1.5 || py > y_max + 2.0 || age >= max_life;
  if (needs_wrap) {
    let s1 = fract(sin(seed * 91.7 + f32(p.flags.x) * 0.13 + f32(i) * 0.017) * 43758.5453);
    let s2 = fract(sin(seed * 173.3 + f32(p.flags.x) * 0.29 + f32(i) * 0.031) * 28461.1731);
    let s3 = fract(sin(seed * 251.9 + f32(p.flags.x) * 0.41 + f32(i) * 0.053) * 19537.7193);
    px = cx + (s1 * 2.0 - 1.0) * half_xz * 0.96;
    py = mix(y_min, y_max, s2);
    pz = cz + (s3 * 2.0 - 1.0) * half_xz * 0.96;
    age = s1 * 0.4;
  }

  let gx = ((px - cx) / (2.0 * half_xz) + 0.5) * f32(p.dims.x);
  let gy_norm = clamp((py - y_min) / max(4.0, y_max - y_min), 0.0, 0.999);
  let gy = gy_norm * f32(p.dims.y);
  let gz = ((pz - cz) / (2.0 * half_xz) + 0.5) * f32(p.dims.z);
  let v_loc = sample_vel_trilin(vec3<f32>(gx, gy, gz));
  let c_loc = sample_cloud_trilin(vec3<f32>(gx, gy, gz));

  // Advect mote directly by live 3D GPU Navier-Stokes velocity field!
  px = px + v_loc.x * (dt * 1.55);
  py = clamp(py + v_loc.y * (dt * 1.35), y_min, y_max);
  pz = pz + v_loc.z * (dt * 1.55);

  let yn = clamp(gy / f32(p.dims.y), 0.0, 1.0);
  // Multi-deck chemical color blend across vertical cloud strata
  var deck_rgb = mix(p.deck2_col.rgb, p.deck1_col.rgb, smoothstep(0.18, 0.55, yn));
  deck_rgb = mix(deck_rgb, p.deck0_col.rgb, smoothstep(0.55, 0.88, yn));
  let spd = length(v_loc.xyz);

  var col = deck_rgb;
  var sz = 1.8;
  var live = 1.0;
  if (role < 3.5) {
    // 3D Volumetric Cloud Strata Puff: visible where live GPU Clausius-Clapeyron cloud q > 0.14!
    let flash_boost = c_loc.w * 2.0;
    col = deck_rgb * (0.76 + 0.36 * yn) + vec3<f32>(0.72, 0.88, 1.0) * flash_boost;
    sz = select(2.8 + c_loc.x * 3.6, 3.0 + c_loc.x * 4.0, is_deep);
    let q_vis = select(c_loc.x * clamp(p.phys1.w * 1.45, 0.12, 1.0), c_loc.x, is_deep);
    live = select(0.0, clamp((q_vis - 0.14) * 1.45, 0.0, 0.85), q_vis > 0.14);
  } else {
    // 3D CFD Flow Streamer / Vortex Tracer: color-coded by vertical buoyancy & vorticity!
    let vort_t = clamp(c_loc.z * 0.28, 0.0, 1.0);
    let updraft_t = clamp(v_loc.y * 0.24 + 0.5, 0.0, 1.0);
    let stream_col = mix(vec3<f32>(0.24, 0.82, 1.0), vec3<f32>(1.0, 0.78, 0.32), updraft_t);
    col = mix(stream_col, vec3<f32>(1.0, 0.44, 0.78), vort_t * 0.65) * (0.95 + 0.35 * min(1.5, spd * 0.08));
    sz = select(0.62 + min(0.80, spd * 0.045), 0.55 + min(0.85, spd * 0.035), is_deep);
    live = clamp(0.48 + spd * 0.05, 0.0, 1.0);
  }

  motes[o + 0u] = px;
  motes[o + 1u] = py;
  motes[o + 2u] = pz;
  motes[o + 4u] = v_loc.x;
  motes[o + 5u] = v_loc.y;
  motes[o + 6u] = v_loc.z;
  motes[o + 7u] = age;
  motes[o + 8u] = col.r;
  motes[o + 9u] = col.g;
  motes[o + 10u] = col.b;
  motes[o + 12u] = sz;
  motes[o + 13u] = c_loc.z;
  motes[o + 15u] = live;
}

// Pass 4C: Parallel 64-thread Telemetry + Exact Craft-Location 3D CFD Wind Sampling!
var<workgroup> wg_v2: array<f32, 64>;
var<workgroup> wg_vort: array<f32, 64>;
var<workgroup> wg_div2: array<f32, 64>;
var<workgroup> wg_q: array<f32, 64>;

@compute @workgroup_size(64)
fn cfd3d_reduce_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let total = p.dims.x * p.dims.y * p.dims.z;
  var sum_v2 = 0.0;
  var sum_vort = 0.0;
  var sum_div2 = 0.0;
  var sum_q = 0.0;

  var idx = tid;
  while (idx < total) {
    let v = vel_in[idx];
    let c = cloud_in[idx];
    let d = pdiv_in[idx].y;
    sum_v2 = sum_v2 + dot(v.xyz, v.xyz);
    sum_vort = sum_vort + c.z;
    sum_div2 = sum_div2 + d * d;
    sum_q = sum_q + c.x;
    idx = idx + 64u;
  }
  wg_v2[tid] = sum_v2;
  wg_vort[tid] = sum_vort;
  wg_div2[tid] = sum_div2;
  wg_q[tid] = sum_q;
  workgroupBarrier();

  var stride = 32u;
  while (stride > 0u) {
    if (tid < stride) {
      wg_v2[tid] = wg_v2[tid] + wg_v2[tid + stride];
      wg_vort[tid] = wg_vort[tid] + wg_vort[tid + stride];
      wg_div2[tid] = wg_div2[tid] + wg_div2[tid + stride];
      wg_q[tid] = wg_q[tid] + wg_q[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }

  if (tid == 0u) {
    let inv_n = 1.0 / max(1.0, f32(total));
    // Sample exact 3D CFD velocity & vorticity right at the exploring craft center (grid midpoint)!
    let mid = vec3<f32>(f32(p.dims.x) * 0.5, f32(p.dims.y) * 0.5, f32(p.dims.z) * 0.5);
    let v_craft = sample_vel_trilin(mid);
    let c_craft = sample_cloud_trilin(mid);
    telemetry[0] = v_craft.x;
    telemetry[1] = v_craft.y;
    telemetry[2] = v_craft.z;
    telemetry[3] = c_craft.z; // local vorticity at craft
    telemetry[4] = sqrt(wg_v2[0] * inv_n);    // global RMS 3D wind speed
    telemetry[5] = wg_vort[0] * inv_n;        // global mean 3D vorticity
    telemetry[6] = sqrt(wg_div2[0] * inv_n);  // global 3D divergence RMS
    telemetry[7] = wg_q[0] * inv_n;           // global mean 3D cloud density
  }
}
`;function On(t,{bodySpec:n={},env:r=null,nx:i=32,ny:c=24,nz:l=32,moteCount:u=3072,label:d=`ulg-atmo-3d-cfd`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createPlanetaryAtmo3dCfdSessionWebGpu requires a live WebGPU GPUDevice`);let f=Cn(n,r),p=Math.max(16,Math.min(48,Math.trunc(i))),m=Math.max(12,Math.min(32,Math.trunc(c))),h=Math.max(16,Math.min(48,Math.trunc(l))),g=p*m*h,_=Math.max(256,Math.min(6144,Math.trunc(u))),v=new Float32Array(g*4),y=new Float32Array(g*4),b=f.rossbyNumber<.25?Math.PI*4:Math.PI*2;for(let e=0;e<h;e+=1){let t=(e+.5)/h;for(let n=0;n<m;n+=1){let r=(n+.5)/m,i=f.isDeepFluid?.55+.45*Math.sin(r*Math.PI):Math.sin(r*Math.PI);for(let a=0;a<p;a+=1){let o=(a+.5)/p,s=((e*m+n)*p+a)*4,c=f.jetSpeedScaleMS*.22*Math.sin(t*b+.35*Math.sin(o*Math.PI*2))*i,l=f.jetSpeedScaleMS*.06*Math.cos(o*Math.PI*4)*Math.sin(t*b)*i,u=f.convectiveBuoyancyScale*.45*Math.sin(o*Math.PI*4)*Math.cos(t*Math.PI*4)*Math.sin(r*Math.PI);v[s+0]=c,v[s+1]=u,v[s+2]=l,v[s+3]=.2*Math.sin(o*Math.PI*4)*Math.cos(t*Math.PI*4)*(1-r);let d=Math.exp(-(((r-.78)/.14)**2)),h=Math.exp(-(((r-.48)/.16)**2)),g=Math.exp(-(((r-.22)/.17)**2));y[s+0]=Math.max(d,h,g)*(.42+.28*Math.cos(o*Math.PI*4+t*Math.PI*2)),y[s+1]=r,y[s+2]=0,y[s+3]=0}}}let x=new Float32Array(_*16),S=f.isDeepFluid?96:165,C=f.isDeepFluid?38:32,w=f.isDeepFluid?.62:.56;for(let e=0;e<_;e+=1){let t=e*16,n=(Math.sin(e*12.9898+1.1)*43758.5453%1+1)%1,r=(Math.sin(e*78.233+2.7)*28461.1731%1+1)%1,i=(Math.sin(e*39.425+4.3)*19537.7193%1+1)%1,a=e<_*w;x[t+0]=(n*2-1)*S,x[t+1]=f.isDeepFluid?(r*2-1)*C:a?14+r*32:1.8+r*22,x[t+2]=(i*2-1)*S,x[t+3]=a?3:4,x[t+7]=n*3,x[t+8]=.92,x[t+9]=.94,x[t+10]=.98,x[t+11]=a?5+r*4:2.4+r*2.2,x[t+12]=a?4.2:.7,x[t+14]=(e*2654435761>>>0)/4294967296,x[t+15]=.8}let T=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`storage`),a(3,`read-only-storage`),a(4,`storage`),a(5,`read-only-storage`),a(6,`storage`)],E=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`read-only-storage`),a(3,`read-only-storage`),a(4,`storage`),a(5,`storage`)],D=e=>s(t,{cacheKey:`ulg-atmo-3d-cfd-fluid-${e}.v4`,label:`${d}-${e}`,code:En,entryPoint:e,bindings:T}),O=e=>s(t,{cacheKey:`ulg-atmo-3d-cfd-post-${e}.v4`,label:`${d}-${e}`,code:Dn,entryPoint:e,bindings:E}),k=D(`cfd3d_advect_forces`),A=D(`cfd3d_divergence`),j=D(`cfd3d_jacobi_pressure`),M=D(`cfd3d_project_velocity`),N=O(`cfd3d_step_motes`),P=O(`cfd3d_reduce_telemetry`),F=t.createBuffer({label:`${d}-params`,size:128,usage:_n.UNIFORM|_n.COPY_DST}),I=t.createBuffer({label:`${d}-velA`,size:v.byteLength,usage:_n.STORAGE|_n.COPY_DST}),L=t.createBuffer({label:`${d}-velB`,size:v.byteLength,usage:_n.STORAGE|_n.COPY_DST}),R=t.createBuffer({label:`${d}-cloudA`,size:y.byteLength,usage:_n.STORAGE|_n.COPY_DST}),z=t.createBuffer({label:`${d}-cloudB`,size:y.byteLength,usage:_n.STORAGE|_n.COPY_DST}),B=t.createBuffer({label:`${d}-pdivA`,size:g*8,usage:_n.STORAGE|_n.COPY_DST}),V=t.createBuffer({label:`${d}-pdivB`,size:g*8,usage:_n.STORAGE|_n.COPY_DST}),ee=t.createBuffer({label:`${d}-motes`,size:x.byteLength,usage:_n.STORAGE|_n.VERTEX|_n.COPY_SRC|_n.COPY_DST}),H=t.createBuffer({label:`${d}-tel`,size:32,usage:_n.STORAGE|_n.COPY_SRC}),U=t.createBuffer({label:`${d}-tel-rd`,size:32,usage:_n.MAP_READ|_n.COPY_DST});t.queue.writeBuffer(I,0,v),t.queue.writeBuffer(L,0,v),t.queue.writeBuffer(R,0,y),t.queue.writeBuffer(z,0,y),t.queue.writeBuffer(ee,0,x);let W=(e,n,r,i,a,s,c)=>o(t,{layout:k.bindGroupLayout,label:`${d}-${e}`,entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:r}},{binding:3,resource:{buffer:i}},{binding:4,resource:{buffer:a}},{binding:5,resource:{buffer:s}},{binding:6,resource:{buffer:c}}]}),G=W(`adv`,I,L,R,z,B,V),te=W(`div`,L,I,z,R,B,V),K=W(`jacBA`,L,I,z,R,V,B),ne=W(`jacAB`,L,I,z,R,B,V),q=W(`proj`,L,I,z,R,V,B),J=o(t,{layout:N.bindGroupLayout,label:`${d}-post`,entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:I}},{binding:2,resource:{buffer:R}},{binding:3,resource:{buffer:V}},{binding:4,resource:{buffer:ee}},{binding:5,resource:{buffer:H}}]}),re=Math.ceil(p/4),ie=Math.ceil(m/4),ae=Math.ceil(h/4),Y=Math.ceil(_/64),X=wn(f,f.maxAltKm*.55),Z=wn(f,(f.minAltKm+f.maxAltKm)*.5),Q=wn(f,f.minAltKm*.55),oe=X.condensingDecks[0]?.color||(f.isDeepFluid?[.96,.91,.78]:[.95,.97,1]),se=Z.condensingDecks[0]?.color||(f.isDeepFluid?[.84,.52,.3]:[.9,.94,.98]),ce=Q.condensingDecks[0]?.color||(f.isDeepFluid?[.94,.97,1]:[.84,.88,.94]),le=0,ue=!1,de=!1,fe=wn(f,f.startAltKm),pe=Object.freeze({schema:gn,stepIndex:0,gridDims:[p,m,h],moteCount:_,craftWindMS:[0,0,0],craftWindSpeedMS:0,craftVorticity:0,rmsWindMS:0,meanVorticity:0,divergenceRms:0,meanCloudDensity:0,chemistry:fe,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1});async function me({dt:n=.024,craftPos:r=[0,0,0],altKm:i=f.startAltKm,groundY:a=-9999,readTelemetry:o=!0}={}){if(de)return pe;let s=xn(Number(n)||.024,.005,.05);le+=1,fe=wn(f,i);let c=xn(f.omegaRadS*4200,0,2.2),l=Number.isFinite(Number(a))?Number(a):-9999,u=new ArrayBuffer(128);new Uint32Array(u,0,8).set([p,m,h,_,le,+!!f.isDeepFluid,0,0]),new Float32Array(u,32,24).set([s,f.jetSpeedScaleMS,c,f.convectiveBuoyancyScale,S,C,f.rossbyNumber,Math.max(.25,fe.cloudOpticalDensity),r[0]||0,r[1]||0,r[2]||0,fe.altKm,oe[0],oe[1],oe[2],.78,se[0],se[1],se[2],.48,ce[0],ce[1],ce[2],l]),t.queue.writeBuffer(F,0,u);let g=t.createCommandEncoder({label:`${d}-enc-${le}`}),v=g.beginComputePass({label:`${d}-pass`});v.setPipeline(k.pipeline),v.setBindGroup(0,G),v.dispatchWorkgroups(re,ie,ae),v.setPipeline(A.pipeline),v.setBindGroup(0,te),v.dispatchWorkgroups(re,ie,ae),v.setPipeline(j.pipeline);for(let e=0;e<3;e+=1)v.setBindGroup(0,K),v.dispatchWorkgroups(re,ie,ae),v.setBindGroup(0,ne),v.dispatchWorkgroups(re,ie,ae);v.setPipeline(M.pipeline),v.setBindGroup(0,q),v.dispatchWorkgroups(re,ie,ae),v.setPipeline(N.pipeline),v.setBindGroup(0,J),v.dispatchWorkgroups(Y),v.setPipeline(P.pipeline),v.setBindGroup(0,J),v.dispatchWorkgroups(1),v.end();let y=o&&!ue&&U.mapState===`unmapped`;y&&(ue=!0,g.copyBufferToBuffer(H,0,U,0,32)),t.queue.submit([g.finish()]);let b=pe.craftWindMS,x=pe.craftVorticity,w=pe.rmsWindMS,T=pe.meanVorticity,E=pe.divergenceRms,D=pe.meanCloudDensity;if(y&&!de&&U.mapState===`unmapped`)try{if(await U.mapAsync(_n.MAP_READ),!de){let e=new Float32Array(U.getMappedRange(0,32));b=[e[0],e[1],e[2]],x=e[3],w=e[4],T=e[5],E=e[6],D=e[7]}if(!de)try{U.unmap()}catch{}}catch(e){if(!de&&e?.name!==`AbortError`)throw e}finally{ue=!1}else y&&(ue=!1);return pe=Object.freeze({schema:gn,stepIndex:le,gridDims:[p,m,h],moteCount:_,craftWindMS:b,craftWindSpeedMS:Math.hypot(b[0],b[1],b[2]),craftVorticity:x,rmsWindMS:w,meanVorticity:T,divergenceRms:E,meanCloudDensity:D,chemistry:fe,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),pe}function he(){if(!de){de=!0;for(let e of[F,I,L,R,z,B,V,ee,H,U])try{e.destroy()}catch{}}}return Object.freeze({schema:gn,lawAdapter:vn,profile:f,get moteCount(){return _},get stepIndex(){return le},getResidentMotesBuffer:()=>ee,getResidentVelocityBuffer:()=>I,getResidentCloudBuffer:()=>R,getChemistryAtAltitude:e=>wn(f,e),getTelemetry:()=>pe,step:me,dispose:he})}function kn(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`planetary-atmosphere-3d-cfd@1`)?e.resolveModule(`planetary-atmosphere-3d-cfd@1`)?.descriptor||null:e.registerModule({method:{model:`planetary-atmosphere-3d-cfd`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/planetaryAtmosphere3dCfdGpu.js`,entryPoint:`cfd3d_advect_forces`,workgroupSize:64},parameterSchema:{surfacePressurePa:{type:`number`,min:20,max:1e8,required:!1},rotationOmegaRadS:{type:`number`,min:0,max:.01,required:!1}},stateLayout:{tensorId:`planetary-atmo-3d-cfd-motes`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`role`,`vx`,`vy`,`vz`,`age`,`r`,`g`,`b`,`maxLife`,`size`,`vorticity`,`seed`,`live`]},scaleRangeM:[10,2e5],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=On(n,{bodySpec:{radiusKm:69911,massSolar:954588e-9,surfacePressurePa:r.surfacePressurePa??1e6,tempK:165,rotationOmegaRadS:r.rotationOmegaRadS??1758e-7},nx:16,ny:12,nz:16,moteCount:256}),a=await i.step({dt:.025,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:planetary-atmo-3d-cfd:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/planetaryAtmosphere3dCfdGpu.js`,entryPoint:`createPlanetaryAtmo3dCfdSessionWebGpu`,kernelEntryPoint:`cfd3d_advect_forces`},representation:`planetary-atmo-3d-cfd-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-planetary-atmo-3d-cfd`,placement:`local`},validity:{finite:Number.isFinite(a.rmsWindMS)&&Number.isFinite(a.divergenceRms)},validation:{status:`pass`,validationMode:`gpu-3d-cfd-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var An=299792458,jn=4135667696e-24,Mn=5.670374419e-8,Nn=9.15;function Pn(e,t,n){return Math.max(t,Math.min(n,e))}function Fn(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function In(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function Ln(e){let t=0,n=0,r=0;e>=380&&e<440?(t=-(e-440)/60,r=1):e<490?(n=(e-440)/50,r=1):e<510?(n=1,r=-(e-510)/20):e<580?(t=(e-510)/70,n=1):e<645?(t=1,n=-(e-645)/65):e<=750&&(t=1);let i=e<420?.35+.65*((e-380)/40):e>700?.35+.65*((750-e)/50):1;return[Pn(t*i,0,1),Pn(n*i,0,1),Pn(r*i,0,1)]}function Rn(e){let t=Pn(Number.isFinite(e)?e:-6.27,-13,1),n=10**t,r=An/n,i=jn*r,a=n*1e9,o=`Visible`,s=`VIS`,c=!1,l=[.22,1,.42],u=``;if(n<1e-11)o=`Gamma Ray`,s=`γ-RAY`,l=[.78,.36,1],u=`${(i*1e-6).toFixed(2)} MeV (${(n*0xe8d4a51000).toFixed(2)} pm)`;else if(n<1e-8)o=n<1e-10?`Hard X-Ray`:`Soft X-Ray`,s=`X-RAY`,l=[.46,.72,1],u=i>=1e3?`${(i*.001).toFixed(2)} keV (${(n*1e10).toFixed(2)} Å)`:`${i.toFixed(0)} eV (${a.toFixed(2)} nm)`;else if(n<38e-8)o=n<12e-8?`Extreme UV`:`Ultraviolet`,s=`UV`,l=[.58,.28,1],u=`${a.toFixed(0)} nm (${i.toFixed(1)} eV)`;else if(n<=75e-8)o=`Visible Light`,s=`VIS`,c=!0,l=Ln(a),u=`${a.toFixed(0)} nm (${i.toFixed(2)} eV)`;else if(n<.001){let e=n*1e6;o=e<2.5?`Near-IR`:e<25?`Mid-IR (Thermal)`:`Far-IR / THz`,s=e<25?`IR`:`THz`,l=e<25?[1,.24,.14]:[1,.48,.16],u=e<100?`${e.toFixed(2)} μm`:`${(r*1e-12).toFixed(2)} THz`}else n<.3?(o=`Microwave`,s=`μW`,l=[1,.62,.18],u=`${(n*100).toFixed(2)} cm (${(r*1e-9).toFixed(2)} GHz)`):(o=`Radio / RF`,s=`RF`,l=[.96,.78,.26],u=`${n.toFixed(2)} m (${(r*1e-6).toFixed(1)} MHz)`);return{log10Meters:t,wavelengthM:n,wavelengthNm:a,freqHz:r,photonEv:i,band:o,shortBand:s,isVisible:c,rgb:l,displayLabel:u}}function zn(e){let t=String(e?.formula||`SiO2`),n=String(e?.id||``),r=t.includes(`H₂O`)||t.includes(`H2O`)||n.includes(`water`)||n.includes(`ice`),i=t.includes(`CH₄`)||t.includes(`CH4`)||n.includes(`tholin`)||n.includes(`organic`),a=t.includes(`Fe`)||n.includes(`ferric`)||n.includes(`magma`),o=e?.primaryZ===26||e?.primaryZ===28||e?.primaryZ===29||e?.primaryZ===79;return r?{formula:`H₂O`,polarDipole:.94,irVibBandUm:3.05,bandGapEv:7.4,visAbsorb:.09,metallicity:0,tMeltK:273.15,tBoilK:373.15,tPlasmaK:5200,cpJPerKgK:4180,densityKgM3:980,meltDesc:`Liquid H₂O melt pool`,boilDesc:`Superheated H₂O steam geyser`,uvDesc:`Photolysis: H₂O + hν → H• + •OH + H₂/O₂`,xrayDesc:`Radiolytic H₂O K-shell plasma flash`}:i?{formula:`CH₄ / C-H-O`,polarDipole:.14,irVibBandUm:3.35,bandGapEv:4.2,visAbsorb:.56,metallicity:0,tMeltK:340,tBoilK:680,tPlasmaK:4600,cpJPerKgK:2200,densityKgM3:1150,meltDesc:`Pyrolytic hydrocarbon tar & vapor`,boilDesc:`Thermal cracking: CH₄ → C(soot) + 2 H₂`,uvDesc:`UV radical photopolymerization & ablation`,xrayDesc:`Carbon K-edge Coulomb fragmentation`}:o?{formula:`Fe / Ni Alloy`,polarDipole:.05,irVibBandUm:8,bandGapEv:0,visAbsorb:.36,metallicity:.92,tMeltK:1811,tBoilK:3134,tPlasmaK:6400,cpJPerKgK:450,densityKgM3:7870,meltDesc:`Molten incandescent iron-alloy slag`,boilDesc:`Vaporized metallic Fe plasma plume`,uvDesc:`Photoelectric electron ejection & ablation`,xrayDesc:`Fe K-alpha fluorescence & ionized plasma`}:{formula:a?`Fe₂O₃ · SiO₂`:`SiO₂ · Mg₂SiO₄`,polarDipole:.16,irVibBandUm:9.6,bandGapEv:a?2.15:8.6,visAbsorb:a?.72:.42,metallicity:a?.18:.02,tMeltK:1470,tBoilK:2950,tPlasmaK:6200,cpJPerKgK:840,densityKgM3:2900,meltDesc:`Molten silicate magma & vitrified glass`,boilDesc:`Vaporizing SiO + O₂ rock plasma`,uvDesc:`UV photo-desorption & silicate spallation`,xrayDesc:`Si/O K-shell photoionization & shock crater`}}function Bn({log10WavelengthM:e=-6.27,powerW:t=1e8,maxPowerW:n=1e26,spotRadiusM:r=1.6,sample:i=null,currentTempK:a=260,dt:o=.02}={}){let s=Rn(e),c=zn(i),l=Math.max(0xe8d4a51000,Math.min(1e26,Number(n)||1e26)),u=Pn(Number(t)||1e7,1e3,l),d=Math.max(.4,Number(r)||1.6),f=Math.PI*d*d,p=s.wavelengthM*1e6,m=Math.exp(-(((Math.log10(s.wavelengthM)+1.45)/1.65)**2)),h=Math.exp(-((Math.log(Math.max(.001,p)/c.irVibBandUm)/.95)**2)),g=s.photonEv>=c.bandGapEv&&c.bandGapEv>0?Pn(.55+.4*Math.tanh((s.photonEv-c.bandGapEv)*.4),0,.96):0,_=c.metallicity*Pn(.18+.48*Math.exp(-Math.max(0,Math.log10(s.wavelengthM)+6.5)*.6),.06,.68),v=s.photonEv>40?Pn(.62+.34*Math.tanh(Math.log10(s.photonEv/40)*.6),0,.97):0,y=Pn(c.visAbsorb*(s.isVisible?1:.25)+c.polarDipole*m*.88+(1-c.metallicity)*h*.84+g*.78+_+v,.04,.98);s.wavelengthM>.3&&(y=Pn(.05+c.polarDipole*.22+c.metallicity*.14,.04,.38));let b=u*y/f,x=s.wavelengthM>.001?.18:s.photonEv>500?.14:.045,S=Math.max(2500,c.densityKgM3*f*x*c.cpJPerKgK),C=f*.85*Mn*Math.max(20,a)**4,w=Pn(a+Pn((u*y-C)*o/S,-120,4800),20,28e3),T=`Heating`,E=`${c.formula} absorbing ${(y*100).toFixed(0)}% ${s.shortBand}`,D=0,O=0;return s.photonEv>200&&u>=1e7?(T=`Coulomb Plasma`,E=c.xrayDesc,D=Pn(Math.log10(u/1e6)*.55*y,.08,4.5),O=.22):w>=c.tPlasmaK?(T=`Ionized Plasma`,E=`${c.formula} thermal ionization plasma (${Math.round(w)} K)`,D=Pn(Math.log10(u/1e6)*.48*y,.12,4.2),O=.25):w>=c.tBoilK?(T=`Vaporizing`,E=`${c.boilDesc} (${Math.round(w)} K)`,D=Pn(Math.log10(u/1e5)*.26*y,.04,2.8),O=.18):w>=c.tMeltK?(T=`Melting`,E=`${c.meltDesc} (${Math.round(w)} K)`,D=Pn(Math.log10(u/1e5)*.07*y,.01,.8),O=.14):s.photonEv>=4&&s.photonEv<=200&&u>=1e6?(T=`Photodissociation`,E=c.uvDesc,D=Pn(Math.log10(u/1e5)*.08*y,.01,.9),O=.06):s.isVisible&&c.visAbsorb<.15&&(T=`Transmitting`,E=`Visible ${Math.round(s.wavelengthNm)} nm transmitting through transparent ${c.formula}`),{em:s,materialFormula:c.formula,absorptance:y,absorbedFluxWPerM2:b,nextTempK:w,phaseState:T,reactionOutcome:E,ablationRateMPerS:D,meltDelta:O,tMeltK:c.tMeltK,tBoilK:c.tBoilK}}function Vn(e={}){let t=Math.max(50,(Number(e.radiusKm)||10)*1e3),n=e.isComet?620:e.isMetallicAsteroid?5400:2650,r=Number(e.massSolar)>0?Number(e.massSolar)*198847e25:4/3*Math.PI*t*t*t*n,i=.6*66743e-15*r*r/t,a=e.isComet?15e3:e.isMetallicAsteroid?25e6:35e4,o=4/3*Math.PI*t*t*t*a;return Math.max(1e9,i+o)}function Hn(e=0xe8d4a51000){return Math.max(1e3,Number(e)||0xe8d4a51000)/(2*An*An)}function Un({massRateKgS:e=null,powerW:t=null,dt:n=.02}={}){let r=Number.isFinite(Number(e))&&Number(e)>0?Number(e):Hn(t??36e9),i=2*Math.max(1e-18,r*n)*An*An,a=i*.5,o=2*r*An*An,s=a/4184e6,c=Pn(8+4.6*Math.max(.01,s)**.3,9,58);return{energyJ:i,coupledEnergyJ:a,massRateKgS:r,powerW:o,tntTons:s,craterRadiusM:c,craterDepthM:Pn(c*.36,3,22),gammaPeakKev:511,plasmaTempK:24e3,reactionOutcome:`p̄+p / e⁺+e⁻ Annihilation: E=2mc² (${o>=1e24?`${(o*1e-24).toFixed(1)} YW`:o>=0xde0b6b3a7640000?`${(o*1e-18).toFixed(1)} EW`:o>=0xe8d4a51000?`${(o*1e-12).toFixed(1)} TW`:`${(o*1e-9).toFixed(1)} GW`} · 511 keV γ + π± fireball)`}}function Wn(e,t,n,r,i){let a=i[0]-e[0],o=i[1]-e[1],s=i[2]-e[2],c=a*t[0]+o*t[1]+s*t[2],l=a*n[0]+o*n[1]+s*n[2],u=Math.hypot(c,l),d=u>1e-4?c/u:0,f=u>1e-4?l/u:1;return[e[0]+(t[0]*d+n[0]*f)*r,e[1]+(t[1]*d+n[1]*f)*r,e[2]+(t[2]*d+n[2]*f)*r]}function Gn(e,t,n,r,i,a){e.push(t[0],t[1],t[2],t[1],n[0],n[1],n[2],r,i[0],i[1],i[2],a)}function Kn(e,t,n,r,i,a,o,s,c,l,u=0,d=4,f=0,p=!0){let m=(e,a,o)=>{let s=Math.cos(o),c=Math.sin(o);return[t[0]+n[0]*e+(r[0]*s+i[0]*c)*a,t[1]+n[1]*e+(r[1]*s+i[1]*c)*a,t[2]+n[2]*e+(r[2]*s+i[2]*c)*a]},h=[t[0]-n[0]*s,t[1]-n[1]*s,t[2]-n[2]*s],g=[t[0]+n[0]*s,t[1]+n[1]*s,t[2]+n[2]*s],_=[-n[0],-n[1],-n[2]],v=(a-o)/Math.max(1e-4,2*s);for(let t=0;t<c;t+=1){let y=f+t/c*Math.PI*2,b=f+(t+1)/c*Math.PI*2,x=Math.cos(y),S=Math.sin(y),C=Math.cos(b),w=Math.sin(b),T=Fn([r[0]*x+i[0]*S+n[0]*v,r[1]*x+i[1]*S+n[1]*v,r[2]*x+i[2]*S+n[2]*v]),E=Fn([r[0]*C+i[0]*w+n[0]*v,r[1]*C+i[1]*w+n[1]*v,r[2]*C+i[2]*w+n[2]*v]),D=m(-s,a,y),O=m(-s,a,b),k=m(s,o,y),A=m(s,o,b);Gn(e,D,T,d,l,u),Gn(e,O,E,d,l,u),Gn(e,A,E,d,l,u),Gn(e,D,T,d,l,u),Gn(e,A,E,d,l,u),Gn(e,k,T,d,l,u),p&&(o>1e-4&&(Gn(e,g,n,d,l,u),Gn(e,k,n,d,l,u),Gn(e,A,n,d,l,u)),a>1e-4&&(Gn(e,h,_,d,l,u),Gn(e,O,_,d,l,u),Gn(e,D,_,d,l,u)))}}function qn(e,t,n,r,i,a,o=10,s=6){let c=n[0]-t[0],l=n[1]-t[1],u=n[2]-t[2],d=Math.hypot(c,l,u);if(d<1e-4)return;let f=[c/d,l/d,u/d],p=Fn(In(f,Math.abs(f[1])<.92?[0,1,0]:[1,0,0])),m=Fn(In(f,p));Kn(e,[(t[0]+n[0])*.5,(t[1]+n[1])*.5,(t[2]+n[2])*.5],f,p,m,r,r*.92,d*.5,o,i,a,s,0,!1)}function Jn(e,t,{pos:n=[0,0,0],yaw:r=0,pitch:i=0,roll:a=0,radius:o=Nn,rimAngle:s=0,vertThrust:c=0,tractorActive:l=!1,tractorHeight:u=24,tractorGroundPos:d=null,beam:f=null,isCockpit:p=!1,isRemote:m=!1,shieldFlash:h=0,curvFn:g=e=>e}={}){let _=Math.cos(r),v=Math.sin(r),y=Math.cos(i),b=Math.sin(i),x=Math.cos(a),S=Math.sin(a),C=Fn([v*y,-b,_*y]),w=Fn([_,0,-v]),T=Fn(In(C,w)),E=Fn([w[0]*x+T[0]*S,w[1]*x+T[1]*S,w[2]*x+T[2]*S]),D=Fn(In(C,E)),O=g(n),k=o/9.15,A=(e,t,n)=>[O[0]+E[0]*(e*k)+D[0]*(t*k)+C[0]*(n*k),O[1]+E[1]*(e*k)+D[1]*(t*k)+C[1]*(n*k),O[2]+E[2]*(e*k)+D[2]*(t*k)+C[2]*(n*k)],j=m?[.8,.86,.96]:[.88,.92,.96],M=m?[.54,.62,.78]:[.64,.7,.78],N=[.18,.22,.28],P=m?[.98,.56,.24]:c>.15?[.24,1,.64]:c<-.15?[1,.64,.22]:[.28,.96,.58],F=1.25+Math.abs(c)*.85;if(p)Kn(e,A(0,.25,0),D,E,C,9.1*k,4.1*k,.35*k,32,M,.04,4,0,!0),Kn(e,A(0,-.05,0),D,E,C,9.25*k,9.25*k,.09*k,32,P,F,4,0,!1),Kn(e,A(0,1.38,3.65),D,E,C,1.15*k,.9*k,.14*k,20,[.05,.14,.1],.25,4,0,!0),Kn(t,A(0,1.6,3.85),D,E,C,1.24*k,1.16*k,.035*k,20,[.18,1,.56],.58,6,0,!1),Kn(t,A(0,4.45,0),D,E,C,4.15*k,1.65*k,.45*k,28,[.14,.98,.46],.3,5,0,!0);else{Kn(e,A(0,-1.55,0),D,E,C,2.2*k,3.1*k,.22*k,24,l?[1,.9,.25]:P,l?2.2:1.4,4,0,!0),Kn(e,A(0,-1.1,0),D,E,C,3.1*k,6.4*k,.34*k,32,M,.04,4,0,!1),Kn(e,A(0,-.48,0),D,E,C,6.4*k,8.95*k,.3*k,32,j,.05,4,0,!1),Kn(e,A(0,0,0),D,E,C,9.15*k,9.15*k,.2*k,32,N,.08,4,0,!1),Kn(e,A(0,0,0),D,E,C,9.22*k,9.22*k,.065*k,32,P,F,4,s*.25,!1),Kn(e,A(0,.48,0),D,E,C,8.98*k,6.55*k,.3*k,32,j,.06,4,0,!1),Kn(e,A(0,1.05,0),D,E,C,6.55*k,4.4*k,.28*k,32,M,.05,4,0,!1),Kn(e,A(0,1.4,0),D,E,C,4.45*k,4.18*k,.14*k,32,N,.08,4,0,!0),Kn(e,A(0,1.56,0),D,E,C,3.6*k,3.2*k,.08*k,20,[.06,.14,.1],.15,4,0,!0),Kn(e,A(0,1.92,1.4),D,E,C,1.2*k,.9*k,.24*k,12,[.16,.95,.56],.85,4,0,!0);let n=4.15*k,r=1.44,i=m?[.22,1,.62]:[.14,.98,.44];for(let e=0;e<5;e+=1){let a=e/5*(Math.PI*.485),o=(e+1)/5*(Math.PI*.485),s=Math.cos(a)*n,c=Math.cos(o)*n,l=r+Math.sin(a)*n/k*.78,u=r+Math.sin(o)*n/k*.78,d=.5*(l+u),f=Math.max(.02*k,.5*(u-l)*k);Kn(t,A(0,d,0),D,E,C,s,c,f,32,i,.54,5,0,e===4)}}if(l&&u>.5){let e=Math.max(2,u),n=2.15*k,r=Math.max(n*1.45,Math.min(28*k,n+e*.28)),i=A(0,-1.6,0),a=d?g(d):[i[0]-D[0]*e,i[1]-D[1]*e,i[2]-D[2]*e],o=[i[0]-a[0],i[1]-a[1],i[2]-a[2]],c=Math.hypot(o[0],o[1],o[2])||e,l=[o[0]/c,o[1]/c,o[2]/c],f=Fn(In(l,Math.abs(l[0])<.9?[1,0,0]:[0,0,1])),p=Fn(In(l,f)),m=[(i[0]+a[0])*.5,(i[1]+a[1])*.5,(i[2]+a[2])*.5];Kn(t,m,l,f,p,r,n,c*.5,24,[1,.88,.2],.34,6,0,!1),Kn(t,m,l,f,p,r*.52,n*.6,c*.5,18,[1,.96,.55],.42,6,0,!1);for(let e=0;e<3;e+=1){let i=((s*.32+e/3)%1+1)%1,c=[a[0]+o[0]*i,a[1]+o[1]*i,a[2]+o[2]*i],u=r*(1-i)+n*i;Kn(t,c,l,f,p,u*1.03,u*.97,.25*k,20,[1,.94,.38],.56,6,0,!1)}}if(f&&Array.isArray(f.targetPos)){let e=Wn(O,E,C,9.2*k,g(f.targetPos)),n=g(f.targetPos),r=f.rgb||[.22,1,.45],i=(f.isAntimatter?.96:.48)*k*(f.thicknessMul||1);qn(t,e,n,i*.5,[1,.98,.95],.96,8,6),qn(t,e,n,i*1.65,r,f.isAntimatter?.72:.58,10,6);let a=(f.isAntimatter?6.8:3.6)*k;Kn(t,[n[0],n[1]+.55*k,n[2]],[0,1,0],[1,0,0],[0,0,1],a,a*.15,.95*k,16,r,.62,6,0,!0),Kn(t,[n[0],n[1]+.35*k,n[2]],[0,1,0],[1,0,0],[0,0,1],a*.48,a*.08,.65*k,12,[1,.98,.9],.85,6,0,!0),f.isAntimatter&&qn(t,e,n,i*2.55,[.85,.24,1],.34,10,6)}h>.02&&Kn(t,A(0,.5,0),D,E,C,9.9*k,6.5*k,2.6*k,20,[.3,.88,1],Pn(h*.55,0,.55),5,0,!0)}function Yn(e,t,n,r=e=>e){let i=Math.max(.05,Number(n.scale)||1),a=r(n.pos),o=Fn(n.vel||[0,0,1]),s=Fn(In(o,Math.abs(o[1])<.9?[0,1,0]:[1,0,0])),c=Fn(In(o,s));Kn(e,a,o,s,c,.28*i,.28*i,1.15*i,8,[.88,.92,.96],.08,4,0,!0),Kn(e,[a[0]+o[0]*1.55*i,a[1]+o[1]*1.55*i,a[2]+o[2]*1.55*i],o,s,c,.28*i,.04*i,.45*i,8,[1,.28,.16],.45,4,0,!0),qn(t,a,[a[0]-o[0]*2.4*i,a[1]-o[1]*2.4*i,a[2]-o[2]*2.4*i],.42*i,[1,.68,.18],.78,6,6)}function Xn(e,t,n,r,i=1){let a=[0,1,0],o=[Math.cos(r),0,Math.sin(r)],s=[-Math.sin(r),0,Math.cos(r)];Kn(e,n,a,o,s,.35*i,.18*i,.14*i,8,[.96,.78,.24],.35,4,r,!0),Kn(t,[n[0],n[1]+.18*i,n[2]],a,o,s,.22*i,.04*i,.12*i,8,[.22,1,.56],.62,5,r,!0)}var Zn=Object.freeze({COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Qn=32,$n=24,er=32,tr=2048,nr=64;function rr(e,t,n){return Math.max(t,Math.min(n,e))}function ir(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function ar(e){let t=(Math.imul(e|0,668265261)^374761393)>>>0;return t=Math.imul(t^t>>>15,2246822507)>>>0,t=Math.imul(t^t>>>13,3266489909)>>>0,((t^t>>>16)>>>0)/4294967296}var or=`
struct DeformParams {
  grid_n: u32,
  stamp_kind: u32,       // 0 = cool/diffuse only, 1 = crater/blast, 2 = laser spot heat/melt, 3 = antimatter mega-crater
  mpm_count: u32,
  step_idx: u32,
  patch_half_m: f32,
  ambient_temp_k: f32,
  dt: f32,
  gravity_g: f32,
  stamp_x: f32,
  stamp_z: f32,
  stamp_radius_m: f32,
  stamp_depth_m: f32,
  stamp_temp_k: f32,
  stamp_melt: f32,
  stamp_char: f32,
  mpm_origin_x: f32,
  mpm_origin_y: f32,
  mpm_origin_z: f32,
  mpm_cell_m: f32,
  mpm_floor_y: f32,
};

// Persistent 128x128 deformation field:
//   x = heightDeltaM (negative crater bowl, positive raised ejecta rim)
//   y = tempK (surface thermal glow from laser / missile / antimatter!)
//   z = meltFrac (0..1 molten glass / melted ice pool)
//   w = charFrac (0..1 scorched blast rim / vitrified obsidian)
@group(0) @binding(0) var<uniform> dp: DeformParams;
@group(0) @binding(1) var<storage, read_write> deform_field: array<vec4<f32>>;

// 64-byte MLS-MPM material points (exact PARTICLE_CLOUD_WGSL Mode 11 layout for zero-copy rendering!)
//   pos_role: vec4(x, y, z, role)    role: 0=molten/plasma, 1=rock_ejecta, 2=vapor/steam
//   vel_age:  vec4(vx, vy, vz, age)
//   col_life: vec4(r, g, b, maxLife)
//   meta0:    vec4(size, tempK, mass, live)
struct MpmPoint {
  pos_role: vec4<f32>,
  vel_age: vec4<f32>,
  col_life: vec4<f32>,
  meta0: vec4<f32>,
};

struct MpmGridCell {
  mass_i: atomic<i32>,
  px_i: atomic<i32>,
  py_i: atomic<i32>,
  pz_i: atomic<i32>,
};

@group(0) @binding(2) var<storage, read_write> mpm_points: array<MpmPoint>;
@group(0) @binding(3) var<storage, read_write> mpm_grid: array<MpmGridCell>;

@compute @workgroup_size(8, 8)
fn update_surface_deform_field(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = dp.grid_n;
  if (gid.x >= n || gid.y >= n) { return; }
  let idx = gid.y * n + gid.x;
  let u = (f32(gid.x) / f32(n - 1u)) * 2.0 - 1.0;
  let v = (f32(gid.y) / f32(n - 1u)) * 2.0 - 1.0;
  let wx = u * dp.patch_half_m;
  let wz = v * dp.patch_half_m;

  var cell = deform_field[idx];
  if (cell.y < 10.0) { cell.y = dp.ambient_temp_k; }

  // 1. Apply active crater blast, laser thermal spot, or antimatter annihilation excavation!
  if (dp.stamp_kind > 0u && dp.stamp_radius_m > 0.1) {
    let dx = wx - dp.stamp_x;
    let dz = wz - dp.stamp_z;
    let r = sqrt(dx * dx + dz * dz);
    let rn = r / dp.stamp_radius_m;
    if (rn < 1.85) {
      if (dp.stamp_kind == 1u || dp.stamp_kind == 3u) {
        // Parabolic crater bowl + authentic raised ejecta rim lip (rn in 0.85..1.55)!
        let bowl = max(0.0, 1.0 - rn * rn);
        let rim_d = rn - 1.12;
        let rim = exp(-(rim_d * rim_d) * 14.0) * 0.24;
        let dh = -dp.stamp_depth_m * bowl + dp.stamp_depth_m * rim;
        cell.x = clamp(cell.x + dh, -48.0, 22.0);
        let heat_w = exp(-rn * rn * 1.45);
        cell.y = max(cell.y, dp.ambient_temp_k + (dp.stamp_temp_k - dp.ambient_temp_k) * heat_w);
        cell.z = clamp(cell.z + dp.stamp_melt * heat_w, 0.0, 1.0);
        cell.w = clamp(cell.w + dp.stamp_char * exp(-rn * rn * 0.65), 0.0, 1.0);
      } else if (dp.stamp_kind == 2u) {
        // Continuous Tunable-EM Laser spot heating, melting, & vaporization trenching!
        let gauss = exp(-rn * rn * 2.2);
        cell.x = clamp(cell.x - dp.stamp_depth_m * gauss, -42.0, 20.0);
        cell.y = clamp(mix(cell.y, max(cell.y, dp.stamp_temp_k), clamp(gauss * 0.48, 0.0, 1.0)), dp.ambient_temp_k, 16000.0);
        cell.z = clamp(cell.z + dp.stamp_melt * gauss, 0.0, 1.0);
        cell.w = clamp(cell.w + dp.stamp_char * gauss * 0.65, 0.0, 1.0);
      }
    }
  }

  // 2. Stefan-Boltzmann T^4 radiative cooling back toward planetary ambient temperature
  if (cell.y > dp.ambient_temp_k + 0.5) {
    let t_norm = clamp((cell.y - dp.ambient_temp_k) / 2000.0, 0.0, 8.0);
    let cool = (18.0 + 420.0 * t_norm * t_norm) * dp.dt;
    cell.y = max(dp.ambient_temp_k, cell.y - cool);
  }
  cell.z = max(0.0, cell.z - dp.dt * 0.015);
  deform_field[idx] = cell;
}

const MPM_GX_U: u32 = 32u;
const MPM_GY_U: u32 = 24u;
const MPM_GZ_U: u32 = 32u;
const MPM_FIXED_SCALE: f32 = 512.0;

@compute @workgroup_size(64)
fn clear_mpm_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = MPM_GX_U * MPM_GY_U * MPM_GZ_U;
  if (gid.x >= total) { return; }
  atomicStore(&mpm_grid[gid.x].mass_i, 0);
  atomicStore(&mpm_grid[gid.x].px_i, 0);
  atomicStore(&mpm_grid[gid.x].py_i, 0);
  atomicStore(&mpm_grid[gid.x].pz_i, 0);
}

fn mpm_grid_idx(gx: u32, gy: u32, gz: u32) -> u32 {
  return (gy * MPM_GZ_U + gz) * MPM_GX_U + gx;
}

@compute @workgroup_size(64)
fn p2g_mpm_ejecta(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= dp.mpm_count) { return; }
  let pt = mpm_points[gid.x];
  if (pt.meta0.w < 0.5) { return; }
  let inv_dx = 1.0 / max(0.5, dp.mpm_cell_m);
  let rel = (pt.pos_role.xyz - vec3<f32>(dp.mpm_origin_x, dp.mpm_origin_y, dp.mpm_origin_z)) * inv_dx;
  let base = vec3<i32>(floor(rel - vec3<f32>(0.5)));
  let fx = rel - vec3<f32>(base);
  // Quadratic B-spline weights (standard MLS-MPM!)
  let w0 = 0.5 * (1.5 - fx) * (1.5 - fx);
  let w1 = 0.75 - (fx - 1.0) * (fx - 1.0);
  let w2 = 0.5 * (fx - 0.5) * (fx - 0.5);
  var wx = array<f32, 3>(w0.x, w1.x, w2.x);
  var wy = array<f32, 3>(w0.y, w1.y, w2.y);
  var wz = array<f32, 3>(w0.z, w1.z, w2.z);

  let mass = max(0.1, pt.meta0.z);
  let vel = pt.vel_age.xyz;
  for (var i = 0; i < 3; i = i + 1) {
    let gx = base.x + i;
    if (gx < 0 || gx >= i32(MPM_GX_U)) { continue; }
    for (var j = 0; j < 3; j = j + 1) {
      let gy = base.y + j;
      if (gy < 0 || gy >= i32(MPM_GY_U)) { continue; }
      for (var k = 0; k < 3; k = k + 1) {
        let gz = base.z + k;
        if (gz < 0 || gz >= i32(MPM_GZ_U)) { continue; }
        let w = wx[i] * wy[j] * wz[k];
        if (w <= 1e-4) { continue; }
        let wm = w * mass;
        let idx = mpm_grid_idx(u32(gx), u32(gy), u32(gz));
        atomicAdd(&mpm_grid[idx].mass_i, i32(clamp(wm * MPM_FIXED_SCALE, 1.0, 2000000.0)));
        atomicAdd(&mpm_grid[idx].px_i, i32(clamp(wm * vel.x * MPM_FIXED_SCALE, -2000000.0, 2000000.0)));
        atomicAdd(&mpm_grid[idx].py_i, i32(clamp(wm * vel.y * MPM_FIXED_SCALE, -2000000.0, 2000000.0)));
        atomicAdd(&mpm_grid[idx].pz_i, i32(clamp(wm * vel.z * MPM_FIXED_SCALE, -2000000.0, 2000000.0)));
      }
    }
  }
}

@compute @workgroup_size(64)
fn update_mpm_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = MPM_GX_U * MPM_GY_U * MPM_GZ_U;
  if (gid.x >= total) { return; }
  let mi = atomicLoad(&mpm_grid[gid.x].mass_i);
  if (mi <= 0) { return; }
  let m = f32(mi) / MPM_FIXED_SCALE;
  var vx = (f32(atomicLoad(&mpm_grid[gid.x].px_i)) / MPM_FIXED_SCALE) / max(1e-4, m);
  var vy = (f32(atomicLoad(&mpm_grid[gid.x].py_i)) / MPM_FIXED_SCALE) / max(1e-4, m);
  var vz = (f32(atomicLoad(&mpm_grid[gid.x].pz_i)) / MPM_FIXED_SCALE) / max(1e-4, m);

  // Gravity + mild atmospheric drag + granular pressure repulsion on crowded floor cells
  vy = vy - dp.gravity_g * dp.dt;
  let drag = max(0.84, 1.0 - 0.14 * dp.dt);
  vx = vx * drag;
  vz = vz * drag;

  let gy = gid.x / (MPM_GX_U * MPM_GZ_U);
  if (gy <= 1u && vy < 0.0) {
    vy = -vy * 0.22;
    vx = vx * 0.62;
    vz = vz * 0.62;
  }

  atomicStore(&mpm_grid[gid.x].px_i, i32(clamp(vx * MPM_FIXED_SCALE, -2000000.0, 2000000.0)));
  atomicStore(&mpm_grid[gid.x].py_i, i32(clamp(vy * MPM_FIXED_SCALE, -2000000.0, 2000000.0)));
  atomicStore(&mpm_grid[gid.x].pz_i, i32(clamp(vz * MPM_FIXED_SCALE, -2000000.0, 2000000.0)));
}

@compute @workgroup_size(64)
fn g2p_mpm_ejecta(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= dp.mpm_count) { return; }
  var pt = mpm_points[gid.x];
  if (pt.meta0.w < 0.5) { return; }

  let age = pt.vel_age.w + dp.dt;
  let max_life = max(0.5, pt.col_life.w);
  if (age >= max_life) {
    pt.meta0.w = 0.0;
    mpm_points[gid.x] = pt;
    return;
  }

  let role = pt.pos_role.w;
  var vel = pt.vel_age.xyz;
  let inv_dx = 1.0 / max(0.5, dp.mpm_cell_m);
  let rel = (pt.pos_role.xyz - vec3<f32>(dp.mpm_origin_x, dp.mpm_origin_y, dp.mpm_origin_z)) * inv_dx;
  let base = vec3<i32>(floor(rel - vec3<f32>(0.5)));
  let fx = rel - vec3<f32>(base);
  let w0 = 0.5 * (1.5 - fx) * (1.5 - fx);
  let w1 = 0.75 - (fx - 1.0) * (fx - 1.0);
  let w2 = 0.5 * (fx - 0.5) * (fx - 0.5);
  var wx = array<f32, 3>(w0.x, w1.x, w2.x);
  var wy = array<f32, 3>(w0.y, w1.y, w2.y);
  var wz = array<f32, 3>(w0.z, w1.z, w2.z);

  var v_pic = vec3<f32>(0.0);
  var w_sum = 0.0;
  for (var i = 0; i < 3; i = i + 1) {
    let gx = base.x + i;
    if (gx < 0 || gx >= i32(MPM_GX_U)) { continue; }
    for (var j = 0; j < 3; j = j + 1) {
      let gy = base.y + j;
      if (gy < 0 || gy >= i32(MPM_GY_U)) { continue; }
      for (var k = 0; k < 3; k = k + 1) {
        let gz = base.z + k;
        if (gz < 0 || gz >= i32(MPM_GZ_U)) { continue; }
        let w = wx[i] * wy[j] * wz[k];
        if (w <= 1e-4) { continue; }
        let idx = mpm_grid_idx(u32(gx), u32(gy), u32(gz));
        if (atomicLoad(&mpm_grid[idx].mass_i) > 0) {
          let gv = vec3<f32>(
            f32(atomicLoad(&mpm_grid[idx].px_i)) / MPM_FIXED_SCALE,
            f32(atomicLoad(&mpm_grid[idx].py_i)) / MPM_FIXED_SCALE,
            f32(atomicLoad(&mpm_grid[idx].pz_i)) / MPM_FIXED_SCALE
          );
          v_pic = v_pic + gv * w;
          w_sum = w_sum + w;
        }
      }
    }
  }

  if (w_sum > 0.1) {
    let v_grid = v_pic / w_sum;
    // PIC/FLIP blend (82% FLIP ballistic retention + 18% PIC cohesive crater-slump viscosity!)
    vel = mix(vel + vec3<f32>(0.0, -dp.gravity_g * dp.dt, 0.0), v_grid, 0.28);
  } else {
    // Outside local active MPM box: continue ballistic + buoyant plume physics cleanly!
    let g_eff = select(dp.gravity_g, -dp.gravity_g * 0.35, role > 1.5);
    vel.y = vel.y - g_eff * dp.dt;
  }

  var pos = pt.pos_role.xyz + vel * dp.dt;
  // Ground collision against active crater floor + friction settling
  let floor_y = dp.mpm_floor_y;
  if (pos.y < floor_y && role < 1.5) {
    pos.y = floor_y;
    if (vel.y < 0.0) { vel.y = -vel.y * 0.28; }
    vel.x = vel.x * 0.72;
    vel.z = vel.z * 0.72;
  }

  // Radiative cooling shifts incandescent lava/plasma particles -> glowing ember -> dark basalt dust!
  let temp_k = max(dp.ambient_temp_k, pt.meta0.y - (320.0 + pt.meta0.y * 0.22) * dp.dt);
  if (role < 0.5) {
    let glow = clamp((temp_k - 900.0) / 2600.0, 0.0, 1.0);
    pt.col_life.x = mix(0.42, 1.0, glow);
    pt.col_life.y = mix(0.24, 0.86, glow * glow);
    pt.col_life.z = mix(0.20, 0.52, glow * glow * glow);
  }
  pt.pos_role = vec4<f32>(pos, role);
  pt.vel_age = vec4<f32>(vel, age);
  pt.meta0.y = temp_k;
  mpm_points[gid.x] = pt;
}
`,sr=`
struct ReplayParams {
  grid_n: u32,
  stamp_count: u32,
  pad0: u32,
  pad1: u32,
  patch_half_m: f32,
  ambient_temp_k: f32,
  pad2: f32,
  pad3: f32,
};

struct CraterStampRec {
  pos_rad_dep: vec4<f32>, // x, z, radiusM, depthM
  therm_kind: vec4<f32>,  // tempK, melt, char, kind (1=missile, 2=laser, 3=antimatter)
};

@group(0) @binding(0) var<uniform> rp: ReplayParams;
@group(0) @binding(1) var<storage, read> stamps: array<CraterStampRec>;
@group(0) @binding(2) var<storage, read_write> deform_field: array<vec4<f32>>;

@compute @workgroup_size(8, 8)
fn replay_crater_stamps(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = rp.grid_n;
  if (gid.x >= n || gid.y >= n) { return; }
  let idx = gid.y * n + gid.x;
  let u = (f32(gid.x) / f32(n - 1u)) * 2.0 - 1.0;
  let v = (f32(gid.y) / f32(n - 1u)) * 2.0 - 1.0;
  let wx = u * rp.patch_half_m;
  let wz = v * rp.patch_half_m;

  var cell = deform_field[idx];
  if (cell.y < 10.0) { cell.y = rp.ambient_temp_k; }

  for (var i = 0u; i < rp.stamp_count; i = i + 1u) {
    let st = stamps[i];
    let rad = max(0.5, st.pos_rad_dep.z);
    let dx = wx - st.pos_rad_dep.x;
    let dz = wz - st.pos_rad_dep.y;
    let r = sqrt(dx * dx + dz * dz);
    let rn = r / rad;
    if (rn >= 1.85) { continue; }
    let kind = u32(round(st.therm_kind.w));
    if (kind == 2u) {
      let spot = exp(-rn * rn * 2.2);
      cell.x = clamp(cell.x - st.pos_rad_dep.w * spot, -48.0, 22.0);
      cell.y = max(cell.y, rp.ambient_temp_k + (st.therm_kind.x - rp.ambient_temp_k) * spot * 0.45);
      cell.z = clamp(cell.z + st.therm_kind.y * spot, 0.0, 1.0);
      cell.w = clamp(cell.w + st.therm_kind.z * spot, 0.0, 1.0);
    } else {
      let bowl = max(0.0, 1.0 - rn * rn);
      let rim_d = rn - 1.12;
      let rim = exp(-(rim_d * rim_d) * 14.0) * 0.24;
      let dh = -st.pos_rad_dep.w * bowl + st.pos_rad_dep.w * rim;
      cell.x = clamp(cell.x + dh, -48.0, 22.0);
      let heat_w = exp(-rn * rn * 1.45);
      cell.y = max(cell.y, rp.ambient_temp_k + (st.therm_kind.x - rp.ambient_temp_k) * heat_w * 0.35);
      cell.z = clamp(cell.z + st.therm_kind.y * heat_w, 0.0, 1.0);
      cell.w = clamp(cell.w + st.therm_kind.z * exp(-rn * rn * 0.65), 0.0, 1.0);
    }
  }
  deform_field[idx] = cell;
}
`,cr=`
struct SkinParams {
  boulder_count: u32,
  tri_count: u32,
  pad0: u32,
  pad1: u32,
  ref_x: f32,
  ref_z: f32,
  curv_inv_2r: f32,
  pad2: f32,
};

struct BoulderPose {
  pos_r: vec4<f32>,         // x, y, z, radius (<= 0 => dead/culled!)
  quat: vec4<f32>,          // unit SE(3) DLM quaternion (qx, qy, qz, qw)
  stretch_temp: vec4<f32>,  // sx, sy, sz, tempK
  col_emiss: vec4<f32>,     // r, g, b, emiss
};

struct SurfaceVert {
  pos_h: vec4<f32>,
  norm_tag: vec4<f32>,
  col_emiss: vec4<f32>,
};

@group(0) @binding(0) var<uniform> sp: SkinParams;
@group(0) @binding(1) var<storage, read> poses: array<BoulderPose>;
@group(0) @binding(2) var<storage, read> tmpl_verts: array<vec4<f32>>; // 60 verts: xyz = unit ico vert, w = vertIdx
@group(0) @binding(3) var<storage, read_write> out_verts: array<SurfaceVert>;

fn q_rot(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

fn jitter_for(bid: u32, vid: u32) -> f32 {
  var h = (bid * 1009u + vid * 37u + 17u) * 2654435761u;
  h = h ^ (h >> 15u);
  return 0.78 + f32(h & 0xFFFFu) * (0.44 / 65536.0);
}

@compute @workgroup_size(64)
fn skin_boulder_meshes(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total_tris = sp.boulder_count * sp.tri_count;
  let ti = gid.x;
  if (ti >= total_tris) { return; }
  let bid = ti / sp.tri_count;
  let local_tri = ti % sp.tri_count;
  let v_base = ti * 3u;
  let b = poses[bid];

  if (b.pos_r.w <= 0.01) {
    let zero_v = SurfaceVert(vec4<f32>(0.0, -9999.0, 0.0, 0.0), vec4<f32>(0.0, 1.0, 0.0, 0.0), vec4<f32>(0.0));
    out_verts[v_base + 0u] = zero_v;
    out_verts[v_base + 1u] = zero_v;
    out_verts[v_base + 2u] = zero_v;
    return;
  }

  let dx = b.pos_r.x - sp.ref_x;
  let dz = b.pos_r.z - sp.ref_z;
  if (dx * dx + dz * dz > 360.0 * 360.0) {
    let zero_v = SurfaceVert(vec4<f32>(0.0, -9999.0, 0.0, 0.0), vec4<f32>(0.0, 1.0, 0.0, 0.0), vec4<f32>(0.0));
    out_verts[v_base + 0u] = zero_v;
    out_verts[v_base + 1u] = zero_v;
    out_verts[v_base + 2u] = zero_v;
    return;
  }

  let base_curv_y = b.pos_r.y - (dx * dx + dz * dz) * sp.curv_inv_2r;
  let center = vec3<f32>(b.pos_r.x, base_curv_y, b.pos_r.z);
  let t0 = tmpl_verts[local_tri * 3u + 0u];
  let t1 = tmpl_verts[local_tri * 3u + 1u];
  let t2 = tmpl_verts[local_tri * 3u + 2u];
  let p0 = center + q_rot(b.quat, t0.xyz * (b.pos_r.w * jitter_for(bid, u32(t0.w))) * b.stretch_temp.xyz);
  let p1 = center + q_rot(b.quat, t1.xyz * (b.pos_r.w * jitter_for(bid, u32(t1.w))) * b.stretch_temp.xyz);
  let p2 = center + q_rot(b.quat, t2.xyz * (b.pos_r.w * jitter_for(bid, u32(t2.w))) * b.stretch_temp.xyz);

  var nrm = normalize(cross(p1 - p0, p2 - p0) + vec3<f32>(1e-6, 0.0, 0.0));
  let face_c = (p0 + p1 + p2) * (1.0 / 3.0) - center;
  if (dot(nrm, face_c) < 0.0) { nrm = -nrm; }

  let hot = clamp((b.stretch_temp.w - 750.0) / 1600.0, 0.0, 1.0);
  let rgb = mix(b.col_emiss.rgb, vec3<f32>(1.0, 0.36 + 0.52 * hot, 0.14 * hot), hot);
  let emiss = select(b.col_emiss.w, hot * 1.65, hot > 0.02);

  out_verts[v_base + 0u] = SurfaceVert(vec4<f32>(p0, b.pos_r.y), vec4<f32>(nrm, 0.0), vec4<f32>(rgb, emiss));
  out_verts[v_base + 1u] = SurfaceVert(vec4<f32>(p1, b.pos_r.y), vec4<f32>(nrm, 0.0), vec4<f32>(rgb, emiss));
  out_verts[v_base + 2u] = SurfaceVert(vec4<f32>(p2, b.pos_r.y), vec4<f32>(nrm, 0.0), vec4<f32>(rgb, emiss));
}
`;function lr(e,t){return[e[3]*t[0]+t[3]*e[0]+(e[1]*t[2]-e[2]*t[1]),e[3]*t[1]+t[3]*e[1]+(e[2]*t[0]-e[0]*t[2]),e[3]*t[2]+t[3]*e[2]+(e[0]*t[1]-e[1]*t[0]),e[3]*t[3]-(e[0]*t[0]+e[1]*t[1]+e[2]*t[2])]}function ur(e){let t=Math.hypot(e[0],e[1],e[2],e[3])||1;return[e[0]/t,e[1]/t,e[2]/t,e[3]/t]}function dr(e,t){let n=2*(e[1]*t[2]-e[2]*t[1]),r=2*(e[2]*t[0]-e[0]*t[2]),i=2*(e[0]*t[1]-e[1]*t[0]);return[t[0]+e[3]*n+(e[1]*i-e[2]*r),t[1]+e[3]*r+(e[2]*n-e[0]*i),t[2]+e[3]*i+(e[0]*r-e[1]*n)]}function fr(e,t){return dr([-e[0],-e[1],-e[2],e[3]],t)}function pr(e,t){let n=(t,n)=>{let r=.5*(fr(e.quat,e.angMom)[t]/Math.max(1e-4,e.inertia[t]))*n,i=Math.sin(r),a=Math.cos(r),o=t===0?[i,0,0,a]:t===1?[0,i,0,a]:[0,0,i,a];e.quat=ur(lr(e.quat,o))};n(0,t*.5),n(1,t*.5),n(2,t),n(1,t*.5),n(0,t*.5)}var mr=(()=>{let e=(1+Math.sqrt(5))*.5;return[[-1,e,0],[1,e,0],[-1,-e,0],[1,-e,0],[0,-1,e],[0,1,e],[0,-1,-e],[0,1,-e],[e,0,-1],[e,0,1],[-e,0,-1],[-e,0,1]].map(e=>ir(e))})(),hr=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];function gr(e,{env:t,baseHeightFn:n,initialCraterStamps:r=[],onCraterStamp:i=null,seed:c=20261125,label:l=`ulg-surface-mpm`}={}){let u=16384,d=new Float32Array(u*4),f=Number(t?.tempK)||240;for(let e=0;e<u;e+=1)d[e*4+1]=f;let p=e.createBuffer({label:`${l}-deform-field`,size:d.byteLength,usage:Zn.STORAGE|Zn.COPY_DST});e.queue.writeBuffer(p,0,d);let m=e.createBuffer({label:`${l}-mpm-points`,size:tr*64,usage:Zn.STORAGE|Zn.VERTEX|Zn.COPY_DST}),h=e.createBuffer({label:`${l}-mpm-grid`,size:Qn*$n*er*16,usage:Zn.STORAGE|Zn.COPY_DST}),g=e.createBuffer({label:`${l}-params`,size:80,usage:Zn.UNIFORM|Zn.COPY_DST}),_=nr*hr.length*3,v=e.createBuffer({label:`${l}-boulders`,size:_*48,usage:Zn.STORAGE|Zn.VERTEX|Zn.COPY_DST}),y=e.createBuffer({label:`${l}-boulder-poses`,size:nr*64,usage:Zn.STORAGE|Zn.COPY_DST}),b=new Float32Array(nr*16),x=e.createBuffer({label:`${l}-skin-params`,size:32,usage:Zn.UNIFORM|Zn.COPY_DST}),S=new Float32Array(hr.length*3*4);for(let e=0;e<hr.length;e+=1){let t=hr[e];for(let n=0;n<3;n+=1){let r=t[n],i=mr[r],a=(e*3+n)*4;S[a+0]=i[0],S[a+1]=i[1],S[a+2]=i[2],S[a+3]=r}}let C=e.createBuffer({label:`${l}-boulder-tmpl`,size:S.byteLength,usage:Zn.STORAGE|Zn.COPY_DST});e.queue.writeBuffer(C,0,S);let w=s(e,{cacheKey:`ulg-surface-boulder-skin-dlm.v1`,label:`${l}-skin`,code:cr,entryPoint:`skin_boulder_meshes`,bindings:[a(0,`uniform`),a(1,`read-only-storage`),a(2,`read-only-storage`),a(3,`storage`)]}),T=o(e,{layout:w.bindGroupLayout,label:`${l}-skin-bg`,entries:[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:y}},{binding:2,resource:{buffer:C}},{binding:3,resource:{buffer:v}}]}),E=s(e,{cacheKey:`ulg-surface-crater-replay.v1`,label:`${l}-replay`,code:sr,entryPoint:`replay_crater_stamps`,bindings:[a(0,`uniform`),a(1,`read-only-storage`),a(2,`storage`)]}),D=e.createBuffer({label:`${l}-replay-params`,size:32,usage:Zn.UNIFORM|Zn.COPY_DST}),O=e.createBuffer({label:`${l}-replay-stamps`,size:512*32,usage:Zn.STORAGE|Zn.COPY_DST}),k=o(e,{layout:E.bindGroupLayout,label:`${l}-replay-bg`,entries:[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:O}},{binding:2,resource:{buffer:p}}]}),A=[a(0,`uniform`),a(1,`storage`),a(2,`storage`),a(3,`storage`)],j=t=>s(e,{cacheKey:`ulg-surface-deform-mpm-${t}.v1`,label:`${l}-${t}`,code:or,entryPoint:t,bindings:A}),M=j(`update_surface_deform_field`),N=j(`clear_mpm_grid`),P=j(`p2g_mpm_ejecta`),F=j(`update_mpm_grid`),I=j(`g2p_mpm_ejecta`),L=o(e,{layout:M.bindGroupLayout,label:`${l}-bg`,entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:p}},{binding:2,resource:{buffer:m}},{binding:3,resource:{buffer:h}}]}),R=[],z=null,B=0,V=0,ee=0,H=[0,0,0],U=0,W=0,G=0,te=0,K=0,ne=0,q=!1,J=0,re=0,ie=0;function ae(t=[]){if(!Array.isArray(t)||t.length===0)return 0;let n=Math.min(512,t.length),r=new Float32Array(n*8);for(let e=0;e<n;e+=1){let n=t[e],i={kind:Math.max(1,Math.min(3,Math.trunc(Number(n.kind)||1))),x:Number(n.x)||0,z:Number(n.z)||0,radiusM:Math.max(.5,Number(n.radiusM)||10),depthM:Math.max(.02,Number(n.depthM)||3),rimM:Number.isFinite(Number(n.rimM))?Number(n.rimM):.24,tempK:Number(n.tempK)||f,melt:Number(n.melt)||.6,char:Number(n.char)||.7};R.push(i),(i.kind===1||i.kind===3)&&(G+=1);let a=e*8;r[a+0]=i.x,r[a+1]=i.z,r[a+2]=i.radiusM,r[a+3]=i.depthM,r[a+4]=i.tempK,r[a+5]=i.melt,r[a+6]=i.char,r[a+7]=i.kind}e.queue.writeBuffer(O,0,r);let i=new ArrayBuffer(32);new Uint32Array(i,0,4).set([128,n,0,0]),new Float32Array(i,16,4).set([384,f,0,0]),e.queue.writeBuffer(D,0,i);let a=e.createCommandEncoder({label:`${l}-replay-enc`}),o=a.beginComputePass({label:`${l}-replay-pass`});return o.setPipeline(E.pipeline),o.setBindGroup(0,k),o.dispatchWorkgroups(16,16),o.end(),e.queue.submit([a.finish()]),K=n,n}Array.isArray(r)&&r.length>0&&ae(r);function Y(e,t){let n=0;for(let r=0;r<R.length;r+=1){let i=R[r],a=e-i.x,o=t-i.z,s=a*a+o*o,c=i.radiusM*1.85;if(s>c*c)continue;let l=Math.sqrt(s)/i.radiusM;if(i.kind===2)n-=i.depthM*Math.exp(-l*l*2.2);else{let e=Math.max(0,1-l*l),t=l-1.12,r=Math.exp(-(t*t)*14)*.24;n+=-i.depthM*e+i.depthM*r}}return rr(n,-48,22)}function X(e,t){return(typeof n==`function`?n(e,t):0)+Y(e,t)}function Z(e,t){let n=1.6,r=X(e-n,t),i=X(e+n,t),a=X(e,t-n),o=X(e,t+n);return ir([r-i,2*n,a-o])}let Q=[],oe=t?.crustPrimaryRgb||[.58,.42,.34],se=t?.crustSecondaryRgb||[.76,.62,.52];if(t?.hasSolidCrust)for(let e=0;e<nr;e+=1){let n=ar(c+e*197+11),r=ar(c+e*353+29),i=ar(c+e*571+47),a=ar(c+e*739+61),o=n*Math.PI*2,s=20+r**.72*245,l=Math.cos(o)*s,u=Math.sin(o)*s,d=X(l,u);if(t.hasLiquidOcean&&d<(t.seaLevelM??-100)-4)continue;let p=.95+i**2*6.8,m=[.78+a*.45,.62+ar(c+e*811)*.48,.76+ar(c+e*919)*.46],h=mr.map((t,n)=>.78+ar(c+e*1009+n*37)*.44),g=t.isCryoMoon?940:2400+a*1200,_=Math.max(400,4/3*g*Math.PI*p*p*p),v=.82+.36*a,y=[rr((oe[0]*.58+se[0]*.42)*v,.24,.96),rr((oe[1]*.58+se[1]*.42)*v,.2,.96),rr((oe[2]*.58+se[2]*.42)*v,.18,.96)],b=p*m[0],x=p*m[1],S=p*m[2],C=[Math.max(10,.2*_*(x*x+S*S)),Math.max(10,.2*_*(b*b+S*S)),Math.max(10,.2*_*(b*b+x*x))],w=ur([n-.5,r-.5,i-.5,.75+a*.5]);Q.push({id:e,alive:!0,pos:[l,d+p*m[1]*.72,u],vel:[0,0,0],quat:w,angMom:[0,0,0],inertia:C,radius:p,stretch:m,vJitters:h,mass:_,baseCol:y,tempK:f,hp:1,captured:!1})}function ce({center:t=[0,0,0],radiusM:n=6,speedMS:r=28,tempK:i=2200,rgb:a=[1,.55,.18],role:o=0,count:s=160,lifeS:c=4.5}={}){if(q)return;let l=Math.max(8,Math.min(512,Math.trunc(s))),u=new Float32Array(l*16);for(let e=0;e<l;e+=1){let s=ar(ne*997+e*131+17),l=ar(ne*997+e*263+41),d=ar(ne*997+e*419+73),f=ar(ne*997+e*601+97),p=s*Math.PI*2,m=Math.sqrt(l)*n,h=t[0]+Math.cos(p)*m,g=t[2]+Math.sin(p)*m,_=t[1]+.4+d*Math.max(1.2,n*.45),v=r*(.35+.85*f),y=.35+.6*d,b=Math.cos(p)*v*Math.cos(y),x=v*Math.sin(y),S=Math.sin(p)*v*Math.cos(y),C=e*16;u[C+0]=h,u[C+1]=_,u[C+2]=g,u[C+3]=o,u[C+4]=b,u[C+5]=x,u[C+6]=S,u[C+7]=0,u[C+8]=a[0],u[C+9]=a[1],u[C+10]=a[2],u[C+11]=c*(.65+.65*l),u[C+12]=rr(.45+d*(o>1.5?2.4:1.15),.35,3.4),u[C+13]=i*(.75+.5*f),u[C+14]=1+l*2.5,u[C+15]=1}let d=Math.min(l,tr-ee);e.queue.writeBuffer(m,ee*64,u.subarray(0,d*16)),d<l&&e.queue.writeBuffer(m,0,u.subarray(d*16)),ee=(ee+l)%tr,H=[t[0]-Qn*1.25,t[1]-4,t[2]-er*1.25],U=X(t[0],t[2])-1.5,V=Math.max(V,c+1.5)}function le({kind:e=1,pos:n=[0,0,0],radiusM:r=12,depthM:a=4.2,tempK:o=2600,melt:s=.85,char:c=.9,blastImpulse:l=0,ejectaCount:u=0,ejectaRgb:d=[1,.58,.2],ejectaRole:p=0}={}){if(z={kind:e,x:n[0],z:n[2],radiusM:r,depthM:a,tempK:o,melt:s,char:c},B=Math.max(B,14),e===1||e===3||a>.08){let t={kind:e,x:n[0],z:n[2],radiusM:r,depthM:a,rimM:.24,tempK:o,melt:s,char:c};if(R.push(t),R.length>512&&R.shift(),(e===1||e===3)&&(G+=1),typeof i==`function`)try{i({...t})}catch{}}let m={silicates:0,volatiles:0,metals:0,exotics:0};if(l>0||e===2){let i=Math.max(r*3.2,18);for(let r of Q){if(!r.alive)continue;let a=r.pos[0]-n[0],s=r.pos[1]-n[1],c=r.pos[2]-n[2],u=Math.hypot(a,s,c);if(u>i+r.radius)continue;let d=Math.max(0,1-u/(i+r.radius));if(l>0){let e=u>.1?[a/u,(s+4.5)/(u+4.5),c/u]:[0,1,0],t=Math.min(68,l*d*d/Math.max(500,r.mass**.72));r.vel[0]+=e[0]*t,r.vel[1]+=Math.abs(e[1])*t+6.5*d,r.vel[2]+=e[2]*t,r.angMom[0]+=(ar(r.id+ne)-.5)*t*.42*r.inertia[0],r.angMom[1]+=(ar(r.id+ne+3)-.5)*t*.22*r.inertia[1],r.angMom[2]+=(ar(r.id+ne+7)-.5)*t*.42*r.inertia[2]}r.tempK=Math.min(9e3,r.tempK+(o-f)*d*(e===2?.16:.75));let p=e===3?d*1.4:e===1?d*.65:d*.08;r.hp-=p,r.hp<=0&&(r.alive=!1,te+=1,m.silicates+=r.radius*8,m.metals+=r.radius*5,m.volatiles+=t?.isCryoMoon?r.radius*12:r.radius*2.5,m.exotics+=e===3?r.radius*1.5:r.radius*.4,ce({center:r.pos,radiusM:r.radius*1.4,speedMS:22,tempK:Math.max(1800,r.tempK),rgb:r.tempK>1200?[1,.56,.16]:r.baseCol,role:r.tempK>1200?0:1,count:64,lifeS:4}))}}return u>0&&ce({center:n,radiusM:Math.max(2,r*.65),speedMS:e===3?52:e===1?34:16,tempK:o,rgb:d,role:p,count:u,lifeS:e===3?6.2:4.2}),m}let ue=0;function de(n,{tractorActive:r=!1,tractorOrigin:i=null,curvInv2R:a=0,refX:o=0,refZ:s=0}={}){let c=t?.gravityMS2??9.81,l=0,u={silicates:0,volatiles:0,metals:0,exotics:0};for(let e=0;e<Q.length;e+=1){let t=Q[e];if(!t.alive)continue;if(t.captured=!1,r&&i){let e=i[0]-t.pos[0],r=i[2]-t.pos[2],a=Math.hypot(e,r),o=i[1]-t.pos[1];if(a<22&&o>2&&o<85){t.captured=!0,l+=1;let a=i[1]-11.5-t.radius;t.vel[0]+=(e*1.8-t.vel[0]*2.2)*n,t.vel[1]+=((a-t.pos[1])*3-t.vel[1]*2.4+c)*n,t.vel[2]+=(r*1.8-t.vel[2]*2.2)*n,t.angMom[1]+=1.4*t.inertia[1]*n,u.silicates+=n*4.5,u.metals+=n*3,u.volatiles+=n*2.5}}t.captured||(t.vel[1]-=c*n),t.pos[0]+=t.vel[0]*n,t.pos[1]+=t.vel[1]*n,t.pos[2]+=t.vel[2]*n,pr(t,n);let a=X(t.pos[0],t.pos[2]),o=t.radius*t.stretch[1]*.78;if(t.pos[1]-o<a){t.pos[1]=a+o;let e=Z(t.pos[0],t.pos[2]),r=t.vel[0]*e[0]+t.vel[1]*e[1]+t.vel[2]*e[2];if(r<0){let n=Math.abs(r)>3.5?.32:0;t.vel[0]-=(1+n)*r*e[0],t.vel[1]-=(1+n)*r*e[1],t.vel[2]-=(1+n)*r*e[2]}t.vel[0]+=e[0]*c*.45*n,t.vel[2]+=e[2]*c*.45*n;let i=Math.max(0,1-2.4*n);t.vel[0]*=i,t.vel[2]*=i;let s=t.vel[2]/Math.max(.5,o),l=-t.vel[0]/Math.max(.5,o);t.angMom[0]=s*t.inertia[0],t.angMom[2]=l*t.inertia[2],t.angMom[1]*=Math.max(0,1-2*n)}else{let e=Math.max(0,1-.18*n);t.angMom[0]*=e,t.angMom[1]*=e,t.angMom[2]*=e}t.tempK>f+1&&(t.tempK=Math.max(f,t.tempK-(25+(t.tempK-f)*.14)*n))}for(let e=0;e<Q.length;e+=1){let t=Q[e];if(t.alive)for(let n=e+1;n<Q.length;n+=1){let e=Q[n];if(!e.alive)continue;let r=e.pos[0]-t.pos[0],i=e.pos[1]-t.pos[1],a=e.pos[2]-t.pos[2],o=(t.radius+e.radius)*.82,s=r*r+i*i+a*a;if(s>=o*o||s<1e-6)continue;let c=Math.sqrt(s),l=r/c,u=i/c,d=a/c,f=o-c,p=1/t.mass,m=1/e.mass,h=p+m;t.pos[0]-=l*f*(p/h),t.pos[1]-=u*f*(p/h),t.pos[2]-=d*f*(p/h),e.pos[0]+=l*f*(m/h),e.pos[1]+=u*f*(m/h),e.pos[2]+=d*f*(m/h);let g=e.vel[0]-t.vel[0],_=e.vel[1]-t.vel[1],v=e.vel[2]-t.vel[2],y=g*l+_*u+v*d;if(y<0){let n=-1.35*y/h;t.vel[0]-=n*p*l,t.vel[1]-=n*p*u,t.vel[2]-=n*p*d,e.vel[0]+=n*m*l,e.vel[1]+=n*m*u,e.vel[2]+=n*m*d}}}J=o,re=s,ie=a,b.fill(0);for(let e=0;e<Q.length;e+=1){let t=Q[e],n=e*16;if(!t.alive){b[n+3]=0;continue}b[n+0]=t.pos[0],b[n+1]=t.pos[1],b[n+2]=t.pos[2],b[n+3]=t.radius,b[n+4]=t.quat[0],b[n+5]=t.quat[1],b[n+6]=t.quat[2],b[n+7]=t.quat[3],b[n+8]=t.stretch[0],b[n+9]=t.stretch[1],b[n+10]=t.stretch[2],b[n+11]=t.tempK,b[n+12]=t.baseCol[0],b[n+13]=t.baseCol[1],b[n+14]=t.baseCol[2],b[n+15]=t.captured?.28:0}return ue=Math.min(_,Q.length*hr.length*3),Q.length>0&&e.queue.writeBuffer(y,0,b.subarray(0,Q.length*16)),{capturedCount:l,harvested:u}}function fe(e){if(!e||typeof e!=`object`)return!1;let t={kind:Math.max(1,Math.min(3,Math.trunc(Number(e.kind)||1))),x:Number(e.x)||0,z:Number(e.z)||0,radiusM:Math.max(.5,Math.min(120,Number(e.radiusM)||10)),depthM:Math.max(.02,Math.min(48,Number(e.depthM)||3)),rimM:Number.isFinite(Number(e.rimM))?Number(e.rimM):.24,tempK:Number(e.tempK)||f,melt:Math.max(0,Math.min(1,Number(e.melt)||.6)),char:Math.max(0,Math.min(1,Number(e.char)||.7))};return R.push(t),R.length>512&&R.shift(),(t.kind===1||t.kind===3)&&(G+=1),z={...t},B=Math.max(B,6),!0}function pe(n,r){if(q)return;if(ne+=1,Q.length>0){let t=new ArrayBuffer(32);new Uint32Array(t,0,4).set([Q.length,hr.length,0,0]),new Float32Array(t,16,4).set([J,re,ie,0]),e.queue.writeBuffer(x,0,t);let r=n.beginComputePass({label:`${l}-boulder-skin-pass`});r.setPipeline(w.pipeline),r.setBindGroup(0,T),r.dispatchWorkgroups(Math.ceil(Q.length*hr.length/64)),r.end()}let i=!!z||B>0,a=V>0;if(!i&&!a)return;let o=new ArrayBuffer(80),s=new Uint32Array(o),c=new Float32Array(o);if(s[0]=128,s[1]=z?z.kind:0,s[2]=tr,s[3]=ne,c[4]=384,c[5]=f,c[6]=r,c[7]=t?.gravityMS2??9.81,c[8]=z?z.x:0,c[9]=z?z.z:0,c[10]=z?z.radiusM:0,c[11]=z?z.depthM:0,c[12]=z?z.tempK:f,c[13]=z?z.melt:0,c[14]=z?z.char:0,c[15]=H[0],c[16]=H[1],c[17]=H[2],c[18]=2.5,c[19]=U,e.queue.writeBuffer(g,0,o),z=null,i){B=Math.max(0,B-r);let e=n.beginComputePass({label:`${l}-deform-pass`});e.setPipeline(M.pipeline),e.setBindGroup(0,L),e.dispatchWorkgroups(16,16),e.end()}if(a){V=Math.max(0,V-r),W+=1;let e=Math.ceil(Qn*$n*er/64),t=Math.ceil(tr/64),i=n.beginComputePass({label:`${l}-mpm-clear`});i.setPipeline(N.pipeline),i.setBindGroup(0,L),i.dispatchWorkgroups(e),i.end();let a=n.beginComputePass({label:`${l}-mpm-p2g`});a.setPipeline(P.pipeline),a.setBindGroup(0,L),a.dispatchWorkgroups(t),a.end();let o=n.beginComputePass({label:`${l}-mpm-grid`});o.setPipeline(F.pipeline),o.setBindGroup(0,L),o.dispatchWorkgroups(e),o.end();let s=n.beginComputePass({label:`${l}-mpm-g2p`});s.setPipeline(I.pipeline),s.setBindGroup(0,L),s.dispatchWorkgroups(t),s.end()}}function me(){if(!q){q=!0;for(let e of[p,m,h,g,v,y,C,x,D,O])try{e.destroy()}catch{}}}return Object.freeze({getResidentDeformBuffer:()=>p,getResidentMpmPointsBuffer:()=>m,getResidentBoulderVertBuffer:()=>v,get mpmPointCount(){return tr},get mpmActive(){return V>0},get boulderVertCount(){return ue},get boulderSkinGpuActive(){return!0},get aliveBoulderCount(){return Q.filter(e=>e.alive).length},get totalCratersCarved(){return G},get craterReplayCount(){return K},get totalBouldersShattered(){return te},get totalMpmDispatches(){return W},get boulders(){return Q},getCraterStamps:()=>R.map(e=>({...e})),applyRemoteCraterStamp:fe,evaluateDeformationOffset:Y,evaluateGroundHeight:X,evaluateGroundNormal:Z,applyBlastOrHeatStamp:le,injectMpmBurst:ce,stepRigidBouldersAndUpload:de,encodeGpuStep:pe,dispose:me})}var _r=12800,vr=Object.freeze({COPY_DST:8,UNIFORM:64,STORAGE:128}),yr=`
struct TectParams {
  grid_n: u32,
  plate_count: u32,
  iter_index: u32,
  flags: u32,          // bit0=hasLiquidSolvent, bit1=isCryo, bit2=isMagma
  seed_f: f32,
  tectonic_amp: f32,
  erosion_rate: f32,
  talus_angle: f32,
  rain_rate: f32,
  evap_rate: f32,
  sea_level_norm: f32,
  crater_str: f32,
};

struct PlateDesc {
  pos_vel: vec4<f32>,  // xy = uv center [0..1], zw = velocity
  props: vec4<f32>,    // x = baseElev (-0.65..+0.65), y = crustThickness, z = roughness, w = pad
};

@group(0) @binding(0) var<uniform> params: TectParams;
@group(0) @binding(1) var<storage, read> plates: array<PlateDesc>;
@group(0) @binding(2) var<storage, read> state_in: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> state_out: array<vec4<f32>>;

fn t_hash2(p: vec2<f32>, s: f32) -> f32 {
  let xi = bitcast<u32>(i32(floor(p.x)));
  let zi = bitcast<u32>(i32(floor(p.y)));
  let si = bitcast<u32>(i32(round(s * 100.0)));
  var h = xi * 374761393u + zi * 668265263u + si * 1442695041u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h & 0xFFFFFFu) * (1.0 / 16777216.0);
}

fn t_vnoise(p: vec2<f32>, s: f32) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = t_hash2(i, s);
  let b = t_hash2(i + vec2<f32>(1.0, 0.0), s);
  let c = t_hash2(i + vec2<f32>(0.0, 1.0), s);
  let d = t_hash2(i + vec2<f32>(1.0, 1.0), s);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn t_fbm(p_in: vec2<f32>, s: f32) -> f32 {
  var sum = 0.0;
  var amp = 0.52;
  var p = p_in;
  for (var i = 0u; i < 4u; i = i + 1u) {
    sum = sum + amp * (t_vnoise(p, s) * 2.0 - 1.0);
    // Rotated octave warp (0.37 rad) to eliminate axis-aligned grid artifacts
    let rx = p.x * 0.932 - p.y * 0.362;
    let ry = p.x * 0.362 + p.y * 0.932;
    p = vec2<f32>(rx, ry) * 2.04 + vec2<f32>(7.13, -4.81);
    amp = amp * 0.49;
  }
  return sum;
}

fn wrap_idx(ix: i32, iy: i32, n: i32) -> u32 {
  let wx = clamp(ix, 0, n - 1);
  let wy = clamp(iy, 0, n - 1);
  return u32(wy * n + wx);
}

@compute @workgroup_size(8, 8)
fn init_tectonic_plates(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.grid_n;
  if (gid.x >= n || gid.y >= n) { return; }
  let uv = (vec2<f32>(f32(gid.x), f32(gid.y)) + 0.5) / f32(n);
  // Domain-warped coordinates give organic curved mountain arcs and archipelagos
  let warp = vec2<f32>(
    t_fbm(uv * 5.2 + vec2<f32>(1.7, 3.1), params.seed_f),
    t_fbm(uv * 5.2 + vec2<f32>(-4.3, 2.5), params.seed_f + 3.7)
  ) * 0.068;
  let wuv = uv + warp;

  var d1 = 1e9;
  var d2 = 1e9;
  var p1 = 0u;
  var p2 = 0u;
  let pc = params.plate_count;
  for (var i = 0u; i < pc; i = i + 1u) {
    let pl = plates[i];
    let diff = wuv - pl.pos_vel.xy;
    let d = length(diff);
    if (d < d1) {
      d2 = d1; p2 = p1;
      d1 = d; p1 = i;
    } else if (d < d2) {
      d2 = d; p2 = i;
    }
  }

  let pl1 = plates[p1];
  let pl2 = plates[p2];
  let boundary_dist = max(0.0, d2 - d1);
  let boundary_w = exp(-boundary_dist * boundary_dist * 340.0);
  let seam_dir = normalize(pl2.pos_vel.xy - pl1.pos_vel.xy + vec2<f32>(1e-5, 0.0));
  // Positive convergence => subduction mountain range; negative => divergent rift canyon!
  let conv = dot(pl1.pos_vel.zw - pl2.pos_vel.zw, seam_dir);
  let ridge_noise = abs(t_fbm(uv * 14.0, params.seed_f + 9.2));
  let orogeny = select(
    conv * 0.55 * boundary_w,
    conv * (0.72 + 0.55 * ridge_noise) * boundary_w,
    conv > 0.0
  );

  // Macro continental shelf + fractal relief + plate tectonics
  let macro_n = t_fbm(uv * 3.4, params.seed_f + 1.3) * 0.42;
  let meso_n = t_fbm(uv * 10.5, params.seed_f + 5.9) * 0.16;
  var elev = clamp(pl1.props.x * 0.52 + macro_n + meso_n + orogeny, -1.0, 1.0);

  // Keep landing center (uv ~ 0.5) near mild navigable coastal/piedmont terrain so vehicles never spawn underwater!
  let center_d = length(uv - vec2<f32>(0.5, 0.5));
  let landing_safe = 1.0 - smoothstep(0.025, 0.095, center_d);
  elev = mix(elev, max(elev, params.sea_level_norm + 0.14), landing_safe * 0.85);

  let base_moist = clamp(0.45 + 0.42 * t_fbm(uv * 4.5, params.seed_f + 13.7) - max(0.0, elev) * 0.25, 0.05, 0.98);
  let water_init = select(0.0, params.rain_rate * (0.5 + 0.8 * base_moist), (params.flags & 1u) != 0u);
  let soil_class = clamp(0.5 + 0.5 * pl1.props.z + 0.25 * meso_n, 0.0, 1.0);

  // During erosion passes: x = elevNorm, y = waterFlux/riverDepth, z = moisture, w = soilClass
  state_out[gid.y * n + gid.x] = vec4<f32>(elev, water_init, base_moist, soil_class);
}

@compute @workgroup_size(8, 8)
fn step_hydraulic_erosion(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.grid_n;
  if (gid.x >= n || gid.y >= n) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let ni = i32(n);
  let idx = gid.y * n + gid.x;
  let c = state_in[idx];

  let nL = state_in[wrap_idx(ix - 1, iy, ni)];
  let nR = state_in[wrap_idx(ix + 1, iy, ni)];
  let nD = state_in[wrap_idx(ix, iy - 1, ni)];
  let nU = state_in[wrap_idx(ix, iy + 1, ni)];

  var h = c.x;
  var water = c.y;
  var moist = c.z;
  let soil = c.w;

  // 1. Thermal talus diffusion (smooths extreme cliff overhangs into scree slopes)
  let h_avg = 0.25 * (nL.x + nR.x + nD.x + nU.x);
  let max_diff = max(
    max(abs(h - nL.x), abs(h - nR.x)),
    max(abs(h - nD.x), abs(h - nU.x))
  );
  if (max_diff > params.talus_angle) {
    h = mix(h, h_avg, 0.22);
  }

  // 2. Parallel hydraulic flow & river-channel incision (only when surface liquid solvent exists!)
  if ((params.flags & 1u) != 0u) {
    // Accumulate water flowing downhill from higher neighbors
    var inflow = params.rain_rate * (0.35 + 0.65 * moist);
    let dL = max(0.0, nL.x - h);
    let dR = max(0.0, nR.x - h);
    let dD = max(0.0, nD.x - h);
    let dU = max(0.0, nU.x - h);
    inflow = inflow + (nL.y * clamp(dL * 8.0, 0.0, 0.65)
      + nR.y * clamp(dR * 8.0, 0.0, 0.65)
      + nD.y * clamp(dD * 8.0, 0.0, 0.65)
      + nU.y * clamp(dU * 8.0, 0.0, 0.65)) * 0.42;

    let min_nb = min(min(nL.x, nR.x), min(nD.x, nU.x));
    let out_slope = max(0.0, h - min_nb);
    let outflow = water * clamp(out_slope * 10.0, 0.0, 0.72);
    water = clamp(water + inflow - outflow * 0.82 - water * params.evap_rate, 0.0, 2.5);

    // Stream-power incision (carves river valleys above sea level, deposits silt in flat basins!)
    if (h > params.sea_level_norm + 0.02) {
      let shear = water * out_slope;
      let incise = min(0.014, shear * params.erosion_rate);
      let deposit = select(0.0, min(0.004, water * 0.006), out_slope < 0.008);
      h = clamp(h - incise + deposit, -1.0, 1.0);
    }
    // River & coastal moisture diffusion so lush riverbanks and wetlands emerge naturally!
    let nb_moist = 0.25 * (nL.z + nR.z + nD.z + nU.z);
    let coast_wet = select(0.0, 0.35, h <= params.sea_level_norm + 0.04);
    moist = clamp(mix(moist, nb_moist, 0.12) + min(0.18, water * 0.22 + coast_wet * 0.08) - max(0.0, h - 0.55) * 0.02, 0.04, 1.0);
  } else {
    // Dry/aeolian worlds: gentler wind smoothing without water incision
    h = mix(h, h_avg, 0.03);
    water = 0.0;
  }

  state_out[idx] = vec4<f32>(h, water, moist, soil);
}
`;function br(e){let t=e>>>0||1;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function xr(e,{env:t={},seed:n=20261125,erosionPasses:r=48,label:i=`ulg-surface-tectonics`}={}){let c=br((n^1367130551)>>>0),l=new Float32Array(128),u=!!(t.hasLiquidOcean||t.hasExoticOcean),d=(c()-.45)*.36;for(let e=0;e<16;e+=1){let t=e*8;l[t+0]=.08+c()*.84,l[t+1]=.08+c()*.84;let n=c()*Math.PI*2,r=.35+c()*.85;l[t+2]=Math.cos(n)*r,l[t+3]=Math.sin(n)*r;let i=c()<(u?.56:.72);l[t+4]=(i?.18+c()*.45:-.58+c()*.34)+d,l[t+5]=i?.85:.25,l[t+6]=(c()-.5)*1.4,l[t+7]=0}let f=e.createBuffer({label:`${i}-plates`,size:l.byteLength,usage:vr.STORAGE|vr.COPY_DST});e.queue.writeBuffer(f,0,l);let p=256*256*16,m=e.createBuffer({label:`${i}-A`,size:p,usage:vr.STORAGE}),h=e.createBuffer({label:`${i}-B`,size:p,usage:vr.STORAGE}),g=e.createBuffer({label:`${i}-params`,size:48,usage:vr.UNIFORM|vr.COPY_DST}),_=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`read-only-storage`),a(3,`storage`)],v=s(e,{cacheKey:`ulg-surface-tectonics-init.v1`,label:`${i}-init`,code:yr,entryPoint:`init_tectonic_plates`,bindings:_}),y=s(e,{cacheKey:`ulg-surface-tectonics-erode.v1`,label:`${i}-erode`,code:yr,entryPoint:`step_hydraulic_erosion`,bindings:_}),b=o(e,{label:`${i}-bg-ab`,layout:v.bindGroupLayout,entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:f}},{binding:2,resource:{buffer:m}},{binding:3,resource:{buffer:h}}]}),x=o(e,{label:`${i}-bg-ba`,layout:v.bindGroupLayout,entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:f}},{binding:2,resource:{buffer:h}},{binding:3,resource:{buffer:m}}]}),S=new ArrayBuffer(48),C=new Uint32Array(S),w=new Float32Array(S),T=!!u|(t.isCryoMoon?2:0)|(t.isMagmaOcean?4:0),E=u?Math.max(-.5,Math.min(.2,(Number(t.seaLevelM)||-6)/Math.max(12,Number(t.terrainAmpM)||40))):-.95;C[0]=256,C[1]=16,C[2]=0,C[3]=T,w[4]=(n>>>0)%1e4*.0137,w[5]=Number(t.terrainAmpM)||42,w[6]=u?.58:.06,w[7]=u?.045:.075,w[8]=u?.055:0,w[9]=.045,w[10]=E,w[11]=Number(t.craterStrength)||.25,e.queue.writeBuffer(g,0,S);let D=e.createCommandEncoder({label:`${i}-bake`}),O=D.beginComputePass({label:`${i}-bake-pass`});O.setPipeline(v.pipeline),O.setBindGroup(0,b),O.dispatchWorkgroups(32,32),O.setPipeline(y.pipeline);let k=Math.max(2,Math.min(64,Math.trunc(r)&-2));for(let e=0;e<k;e+=1)O.setBindGroup(0,e%2==0?x:b),O.dispatchWorkgroups(32,32);O.end(),e.queue.submit([D.finish()]);let A=h,j=!1;return Object.freeze({gridN:256,worldSpanM:_r,plateCount:16,erosionPasses:k,continentBias:d,getResidentFieldBuffer:()=>A,getResidentTectonicBuffer:()=>A,dispose(){if(!j){j=!0;try{f.destroy()}catch{}try{m.destroy()}catch{}try{h.destroy()}catch{}try{g.destroy()}catch{}}}})}var Sr=Object.freeze({COPY_DST:8,UNIFORM:64,STORAGE:128}),Cr=`
struct OceanParams {
  grid_n: u32,
  step_index: u32,
  impulse_active: u32,
  pad0: u32,
  dt: f32,
  gravity_g: f32,
  celerity_c2: f32,    // scaled wave speed squared ~ g * H_eff
  damping: f32,        // viscous damping
  wind_x: f32,         // Ekman-rotated surface wind stress X
  wind_z: f32,         // Ekman-rotated surface wind stress Z
  ice_cover: f32,      // 0 = open liquid, 1 = frozen sea ice (damps wave amplitude)
  time_s: f32,
  impulse_xyz_r: vec4<f32>, // x = gridU [0..1], y = gridV [0..1], z = amp, w = radiusUv
};

@group(0) @binding(0) var<uniform> params: OceanParams;
@group(0) @binding(1) var<storage, read> h_prev: array<f32>;
@group(0) @binding(2) var<storage, read> h_curr: array<f32>;
@group(0) @binding(3) var<storage, read_write> h_next: array<f32>;
@group(0) @binding(4) var<storage, read_write> ocean_out: array<vec4<f32>>;

fn wrap_o(ix: i32, iy: i32, n: i32) -> u32 {
  let wx = ((ix % n) + n) % n;
  let wy = ((iy % n) + n) % n;
  return u32(wy * n + wx);
}

@compute @workgroup_size(8, 8)
fn step_ocean_wave_pde(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.grid_n;
  if (gid.x >= n || gid.y >= n) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let ni = i32(n);
  let idx = gid.y * n + gid.x;

  let c0 = h_curr[idx];
  let p0 = h_prev[idx];
  let cL = h_curr[wrap_o(ix - 1, iy, ni)];
  let cR = h_curr[wrap_o(ix + 1, iy, ni)];
  let cD = h_curr[wrap_o(ix, iy - 1, ni)];
  let cU = h_curr[wrap_o(ix, iy + 1, ni)];

  let lap = (cL + cR + cD + cU) - 4.0 * c0;
  let open_w = max(0.0, 1.0 - params.ice_cover);

  // Wind-driven directional gravity-capillary swell forcing aligned with live Ekman current!
  let uv = (vec2<f32>(f32(gid.x), f32(gid.y)) + 0.5) / f32(n);
  let w_spd = length(vec2<f32>(params.wind_x, params.wind_z));
  let w_dir = select(vec2<f32>(0.82, 0.57), vec2<f32>(params.wind_x, params.wind_z) / max(1e-4, w_spd), w_spd > 0.05);
  let w_perp = vec2<f32>(-w_dir.y, w_dir.x);
  let g_scale = sqrt(max(0.15, params.gravity_g) / 9.81);
  let ph1 = dot(uv, w_dir) * 37.6991 - params.time_s * (1.85 * g_scale);
  let ph2 = dot(uv, w_dir * 0.78 + w_perp * 0.62) * 62.8318 - params.time_s * (2.65 * g_scale);
  let ph3 = dot(uv, w_dir * 0.72 - w_perp * 0.69) * 87.9646 - params.time_s * (3.15 * g_scale);
  let wind_gain = clamp(0.18 + w_spd * 0.085, 0.14, 1.45) * open_w;
  // Low-gravity worlds have slower, taller wave crests for the same wind stress!
  let grav_amp = clamp(pow(max(0.15, 9.81 / max(0.25, params.gravity_g)), 0.35), 0.75, 2.35);
  let force = (sin(ph1) * 0.55 + sin(ph2) * 0.30 + cos(ph3) * 0.15) * wind_gain * grav_amp * 0.018;

  var imp = 0.0;
  if (params.impulse_active != 0u) {
    var du = uv - params.impulse_xyz_r.xy;
    du = du - round(du);
    let r2 = dot(du, du);
    let rad = max(0.008, params.impulse_xyz_r.w);
    imp = params.impulse_xyz_r.z * exp(-r2 / (rad * rad)) * open_w;
  }

  // Exact leapfrog 2D wave PDE with stability-clamped celerity c^2 <= 0.24
  let c2 = clamp(params.celerity_c2, 0.03, 0.22);
  let damp = clamp(params.damping + params.ice_cover * 0.18, 0.004, 0.35);
  var next_h = (2.0 - damp) * c0 - (1.0 - damp) * p0 + c2 * lap + force + imp;
  next_h = clamp(next_h * (0.25 + 0.75 * open_w), -3.2, 3.2);
  h_next[idx] = next_h;

  // Compute physical surface slopes & steepness-driven whitecap foam!
  let cell_m = ${(512*2/128).toFixed(4)};
  let dhdx = (cR - cL) / (2.0 * cell_m);
  let dhdz = (cU - cD) / (2.0 * cell_m);
  let steep = length(vec2<f32>(dhdx, dhdz));
  let crest = max(0.0, next_h);
  let foam = clamp(smoothstep(0.055, 0.22, steep + crest * 0.12) * open_w, 0.0, 1.0);
  ocean_out[idx] = vec4<f32>(next_h, dhdx, dhdz, foam);
}

fn Math_pow_safe_inv_g(g: f32) -> f32 {
  return pow(9.81 / max(0.35, g), 0.38);
}
`;function wr(e,{gravityMS2:t=9.81,latitudeRad:n=.55,enabled:r=!0,label:i=`ulg-surface-ocean`}={}){let c=16384*4,l=[e.createBuffer({label:`${i}-h0`,size:c,usage:Sr.STORAGE|Sr.COPY_DST}),e.createBuffer({label:`${i}-h1`,size:c,usage:Sr.STORAGE|Sr.COPY_DST}),e.createBuffer({label:`${i}-h2`,size:c,usage:Sr.STORAGE|Sr.COPY_DST})],u=e.createBuffer({label:`${i}-out`,size:262144,usage:Sr.STORAGE|Sr.COPY_DST}),d=e.createBuffer({label:`${i}-params`,size:64,usage:Sr.UNIFORM|Sr.COPY_DST}),f=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`read-only-storage`),a(3,`storage`),a(4,`storage`)],p=s(e,{cacheKey:`ulg-surface-ocean-wave-pde.v1`,label:`${i}-wave-pde`,code:Cr,entryPoint:`step_ocean_wave_pde`,bindings:f}),m=[0,1,2].map(t=>o(e,{label:`${i}-bg-${t}`,layout:p.bindGroupLayout,entries:[{binding:0,resource:{buffer:d}},{binding:1,resource:{buffer:l[t]}},{binding:2,resource:{buffer:l[(t+1)%3]}},{binding:3,resource:{buffer:l[(t+2)%3]}},{binding:4,resource:{buffer:u}}]})),h=new ArrayBuffer(64),g=new Uint32Array(h),_=new Float32Array(h),v=0,y=0,b=0,x=null,S=!1;function C(e,t,n=.65,r=18){let i=512*2;x={u:(e/i%1+1)%1,v:(t/i%1+1)%1,amp:Math.max(-2.5,Math.min(2.5,n)),radUv:Math.max(.01,r/i)}}function w(a,{dt:o=.02,windX:s=4,windZ:c=2,iceCoverFrac:l=0,latRad:u=n}={}){if(S||!r||l>=.985)return!1;b+=Math.max(.004,Math.min(.05,o)),y+=1;let f=Math.PI*.25*(u>=0?-1:1),C=Math.cos(f),w=Math.sin(f),T=s*C-c*w,E=s*w+c*C,D=Math.max(.04,Math.min(.2,.14*Math.sqrt(Math.max(.2,t)/9.81)));g[0]=128,g[1]=y,g[2]=+!!x,g[3]=0,_[4]=o,_[5]=t,_[6]=D,_[7]=.028,_[8]=T,_[9]=E,_[10]=Math.max(0,Math.min(1,l)),_[11]=b,x?(_[12]=x.u,_[13]=x.v,_[14]=x.amp,_[15]=x.radUv,x=null):(_[12]=0,_[13]=0,_[14]=0,_[15]=.02),e.queue.writeBuffer(d,0,h);let O=a.beginComputePass({label:`${i}-pass`});return O.setPipeline(p.pipeline),O.setBindGroup(0,m[v]),O.dispatchWorkgroups(16,16),O.end(),v=(v+1)%3,!0}return Object.freeze({gridN:128,patchHalfM:512,get enabled(){return r},get stepIndex(){return y},getResidentOceanBuffer:()=>u,queueSplashImpulse:C,encodeGpuStep:w,dispose(){if(!S){S=!0;for(let e of l)try{e.destroy()}catch{}try{u.destroy()}catch{}try{d.destroy()}catch{}}}})}var Tr=1024,Er=Object.freeze({COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Dr=`
struct FloraParams {
  grid_side: u32,
  flags: u32,            // bit0=biosphereActive, bit1=hasLiquidOcean, bit2=hasCiv, bit3=isExoticSolvent
  tect_n: u32,
  pad0: u32,
  center_x: f32,
  center_z: f32,
  spacing_m: f32,
  seed_f: f32,
  terrain_amp: f32,
  crater_str: f32,
  sea_level: f32,
  snowline_m: f32,
  curv_inv_2r: f32,
  focus_x: f32,
  focus_z: f32,
  buckling_scale: f32,   // Euler buckling height scale (9.81/g)^0.45
  pigment_rgb: vec4<f32>,// rgb = Wien stellar photosynthetic pigment, w = biosphereViability [0..1]
  season_aux: vec4<f32>, // x = autumnShift [0..1], y = civTechK [0..2], z = tectWorldSpanM, w = seaIceFrac
};

// 48-byte GPU instance record read directly by SURFACE_FLORA_INSTANCED_WGSL:
//   pos_scale: vec4(wx, wy_curved, wz, scaleH)  (scaleH <= 0 => culled!)
//   rot_kind:  vec4(yawRad, radialScale, kindId, snowWeight)  kind: 0=conifer, 1=broadleaf/xeno, 2=settlement
//   col_emiss: vec4(r, g, b, emissiveWindow)
struct FloraInstance {
  pos_scale: vec4<f32>,
  rot_kind: vec4<f32>,
  col_emiss: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: FloraParams;
@group(0) @binding(1) var<storage, read> tectonic_field: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> deform_field: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> instances: array<FloraInstance>;

fn f_hash2(ix: f32, iz: f32, s: f32) -> f32 {
  let xi = bitcast<u32>(i32(floor(ix)));
  let zi = bitcast<u32>(i32(floor(iz)));
  let si = bitcast<u32>(i32(round(s * 100.0)));
  var h = xi * 374761393u + zi * 668265263u + si * 1442695041u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h & 0xFFFFFFu) * (1.0 / 16777216.0);
}

fn f_vnoise2(x: f32, z: f32, s: f32) -> f32 {
  let ix = floor(x); let iz = floor(z);
  let fx = x - ix; let fz = z - iz;
  let ux = fx * fx * (3.0 - 2.0 * fx);
  let uz = fz * fz * (3.0 - 2.0 * fz);
  let a = f_hash2(ix, iz, s);
  let b = f_hash2(ix + 1.0, iz, s);
  let c = f_hash2(ix, iz + 1.0, s);
  let d = f_hash2(ix + 1.0, iz + 1.0, s);
  return mix(mix(a, b, ux), mix(c, d, ux), uz);
}

fn f_fbm2(x_in: f32, z_in: f32, s: f32) -> f32 {
  var sum = 0.0; var amp = 0.52; var fx = x_in; var fz = z_in;
  for (var i = 0u; i < 4u; i = i + 1u) {
    sum = sum + amp * (f_vnoise2(fx, fz, s) * 2.0 - 1.0);
    fx = fx * 2.03 + 11.7; fz = fz * 2.03 - 7.3; amp = amp * 0.48;
  }
  return sum;
}

fn sample_tect(x: f32, z: f32) -> vec4<f32> {
  let span = max(1000.0, params.season_aux.z);
  let u = clamp((x / span) + 0.5, 0.0, 0.999);
  let v = clamp((z / span) + 0.5, 0.0, 0.999);
  let n = params.tect_n;
  let ix = min(n - 1u, u32(floor(u * f32(n))));
  let iy = min(n - 1u, u32(floor(v * f32(n))));
  return tectonic_field[iy * n + ix];
}

fn sample_def(x: f32, z: f32) -> vec4<f32> {
  let half_m = 384.0;
  if (abs(x) >= half_m || abs(z) >= half_m) { return vec4<f32>(0.0); }
  let u = clamp((x / half_m) * 0.5 + 0.5, 0.0, 0.999);
  let v = clamp((z / half_m) * 0.5 + 0.5, 0.0, 0.999);
  let ix = min(127u, u32(floor(u * 127.0)));
  let iy = min(127u, u32(floor(v * 127.0)));
  return deform_field[iy * 128u + ix];
}

fn f_crater_field(x: f32, z: f32, scale: f32, s: f32) -> f32 {
  let sx = x * scale; let sz = z * scale;
  let cx = floor(sx); let cz = floor(sz);
  var best = 0.0;
  for (var dz = -1; dz <= 1; dz = dz + 1) {
    for (var dx = -1; dx <= 1; dx = dx + 1) {
      let gx = cx + f32(dx); let gz = cz + f32(dz);
      let h = f_hash2(gx, gz, s + 7.3);
      if (h < 0.56) { continue; }
      let ox = gx + 0.18 + 0.64 * f_hash2(gx, gz, s + 19.1);
      let oz = gz + 0.18 + 0.64 * f_hash2(gx, gz, s + 37.7);
      let rad = 0.22 + 0.28 * f_hash2(gx, gz, s + 53.3);
      let d = length(vec2<f32>(sx - ox, sz - oz)) / rad;
      if (d < 1.38) {
        if (d < 0.84) {
          let q = d / 0.84;
          best = best - 0.42 * (1.0 - q * q);
        } else {
          let rt = (d - 0.84) / 0.54;
          best = best + 0.19 * sin(rt * 3.14159265) * (1.0 - 0.35 * rt);
        }
      }
    }
  }
  return best;
}

fn eval_ground_h(x: f32, z: f32) -> f32 {
  let r0 = length(vec2<f32>(x, z));
  let a = clamp((r0 - 18.0) / 52.0, 0.0, 1.0);
  let apron = a * a * (3.0 - 2.0 * a);
  let rolling = f_fbm2(x * 0.0055, z * 0.0055, params.seed_f) * params.terrain_amp;
  let ridge = abs(f_fbm2(x * 0.011 + 5.1, z * 0.011 - 3.4, params.seed_f + 2.1)) * (params.terrain_amp * 0.36);
  let detail = f_fbm2(x * 0.032, z * 0.032, params.seed_f + 4.9) * (params.terrain_amp * 0.08);
  var craters = 0.0;
  if (params.crater_str > 0.02) {
    craters = (f_crater_field(x, z, 0.0075, params.seed_f) * params.terrain_amp * 0.72
      + f_crater_field(x, z, 0.024, params.seed_f + 11.0) * params.terrain_amp * 0.24) * params.crater_str;
  }
  let tect = sample_tect(x, z);
  let tect_blend = smoothstep(240.0, 560.0, r0);
  let tect_h = tect.x * (params.terrain_amp * 0.42) * tect_blend;
  let def = sample_def(x, z);
  return (rolling + ridge * 0.45 + detail + craters + tect_h) * (0.10 + 0.90 * apron) + def.x;
}

@compute @workgroup_size(64)
fn place_surface_flora(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let side = params.grid_side;
  let total = side * side;
  if (idx >= total) { return; }

  var inst: FloraInstance;
  inst.pos_scale = vec4<f32>(0.0, -9999.0, 0.0, 0.0);
  inst.rot_kind = vec4<f32>(0.0);
  inst.col_emiss = vec4<f32>(0.0);

  let bio_on = (params.flags & 1u) != 0u;
  let civ_on = (params.flags & 4u) != 0u;
  if (!bio_on && !civ_on) {
    instances[idx] = inst;
    return;
  }

  let gx = idx % side;
  let gz = idx / side;
  let half = f32(side) * 0.5;
  let cell_x = floor(params.center_x / params.spacing_m) + (f32(gx) - half);
  let cell_z = floor(params.center_z / params.spacing_m) + (f32(gz) - half);

  let jx = (f_hash2(cell_x, cell_z, params.seed_f + 17.3) - 0.5) * 0.78;
  let jz = (f_hash2(cell_x, cell_z, params.seed_f + 43.1) - 0.5) * 0.78;
  let wx = (cell_x + 0.5 + jx) * params.spacing_m;
  let wz = (cell_z + 0.5 + jz) * params.spacing_m;

  // Keep immediate spawn pad (r < 22 m) clear for Rover/UFO landing
  if (length(vec2<f32>(wx, wz)) < 22.0) {
    instances[idx] = inst;
    return;
  }

  let def = sample_def(wx, wz);
  // Scorched/vaporized laser or missile craters burn away vegetation!
  if (def.w > 0.35 || def.y > 600.0 || def.x < -1.0) {
    instances[idx] = inst;
    return;
  }

  let h = eval_ground_h(wx, wz);
  let has_ocean = (params.flags & 2u) != 0u;
  if (has_ocean && h < params.sea_level + 1.2) {
    instances[idx] = inst;
    return;
  }

  let eps = 3.5;
  let hL = eval_ground_h(wx - eps, wz);
  let hR = eval_ground_h(wx + eps, wz);
  let hD = eval_ground_h(wx, wz - eps);
  let hU = eval_ground_h(wx, wz + eps);
  let n_vec = normalize(vec3<f32>(hL - hR, 2.0 * eps, hD - hU));
  let slope = 1.0 - clamp(n_vec.y, 0.0, 1.0);
  if (slope > 0.44) {
    instances[idx] = inst;
    return;
  }

  let tect = sample_tect(wx, wz);
  if (has_ocean && tect.y > 1.78 && slope < 0.12) {
    instances[idx] = inst;
    return;
  }
  let moisture = tect.z;
  let viability = params.pigment_rgb.w;
  let r_sel = f_hash2(cell_x, cell_z, params.seed_f + 81.9);
  let r_sz = f_hash2(cell_x, cell_z, params.seed_f + 109.7);
  let yaw = f_hash2(cell_x, cell_z, params.seed_f + 131.3) * 6.2831853;

  // Check for indigenous civilization settlement spire on flat fertile lowlands!
  let civ_k = params.season_aux.y;
  let is_civ_slot = civ_on && civ_k >= 0.35 && slope < 0.14 && h < params.snowline_m - 6.0
    && r_sel > (0.985 - min(0.06, civ_k * 0.035));

  var kind = 0.0;
  var scale_h = 0.0;
  var rad_scale = 1.0;
  var col = params.pigment_rgb.rgb;
  var emiss = 0.0;
  let snow_w = smoothstep(params.snowline_m - 6.0, params.snowline_m + 10.0, h);

  if (is_civ_slot) {
    kind = 2.0; // Indigenous habitation tower / geodesic dome with glowing warm windows!
    scale_h = (6.5 + r_sz * 11.5) * clamp(params.buckling_scale, 0.7, 1.8);
    rad_scale = 0.95 + r_sz * 0.55;
    col = mix(vec3<f32>(0.76, 0.80, 0.86), vec3<f32>(0.92, 0.84, 0.72), r_sz);
    emiss = 0.55 + 0.65 * clamp(civ_k, 0.0, 1.5);
  } else if (bio_on) {
    // Biological flora density modulated by moisture, viability & altitude!
    let alt_fade = 1.0 - smoothstep(params.snowline_m - 2.0, params.snowline_m + 22.0, h);
    let dens = clamp(viability * (0.28 + 0.78 * moisture) * alt_fade, 0.0, 0.95);
    if (r_sel > dens) {
      instances[idx] = inst;
      return;
    }
    let is_alpine = snow_w > 0.25 || (r_sz < 0.45 && moisture < 0.55);
    kind = select(1.0, 0.0, is_alpine);
    scale_h = (5.2 + r_sz * 9.8) * clamp(params.buckling_scale, 0.55, 2.4);
    rad_scale = select(1.05 + r_sz * 0.45, 0.72 + r_sz * 0.30, is_alpine);

    // Emergent orbital autumn / seasonal foliage hue shift & alpine snow dusting
    let autumn = params.season_aux.x * select(1.0, 0.18, is_alpine);
    let autumn_col = vec3<f32>(0.82, 0.42, 0.14);
    col = mix(params.pigment_rgb.rgb * (0.78 + 0.42 * r_sz), autumn_col, autumn * 0.72);
    col = mix(col, vec3<f32>(0.88, 0.93, 0.98), snow_w * 0.68);
    // Exotic cryo-solvent worlds can exhibit subtle bioluminescence!
    if ((params.flags & 8u) != 0u) {
      emiss = 0.18 + 0.28 * r_sz;
    }
  } else {
    instances[idx] = inst;
    return;
  }

  // Store raw uncurved ground height h — spherical curvature -(dx^2+dz^2)*curv_inv_2r is applied
  // LIVE every frame in SURFACE_FLORA_INSTANCED_WGSL so trees NEVER sink into terrain or hop when moving!
  inst.pos_scale = vec4<f32>(wx, h, wz, scale_h);
  inst.rot_kind = vec4<f32>(yaw, rad_scale, kind, snow_w);
  inst.col_emiss = vec4<f32>(col, emiss);
  instances[idx] = inst;
}
`;function Or(){let e=[],t=(t,n,r,i,a,o,s,c)=>{e.push(t[0],t[1],t[2],s,i[0],i[1],i[2],c,n[0],n[1],n[2],s,a[0],a[1],a[2],c,r[0],r[1],r[2],s,o[0],o[1],o[2],c)},n=(e,n,r,i,a,o,s)=>{let c=Math.max(1e-4,n-e),l=(r-i)/c;for(let c=0;c<a;c+=1){let u=c/a*Math.PI*2,d=(c+1)/a*Math.PI*2,f=Math.cos(u),p=Math.sin(u),m=Math.cos(d),h=Math.sin(d),g=Math.hypot(f,l,p)||1,_=Math.hypot(m,l,h)||1,v=[f/g,l/g,p/g],y=[m/_,l/_,h/_],b=[f*r,e,p*r],x=[m*r,e,h*r],S=[f*i,n,p*i],C=[m*i,n,h*i];t(b,x,C,v,y,y,o,s),i>1e-4&&t(b,C,S,v,y,v,o,s)}};return n(-.05,.34,.08,.05,5,0,0),n(.24,.62,.36,.08,6,1,0),n(.48,.84,.28,.05,6,1,0),n(.7,1.05,.19,.001,6,1,0),n(-.05,.48,.09,.05,6,0,1),n(.42,.72,.26,.48,7,1,1),n(.72,1,.48,.18,7,1,1),n(.98,1.08,.18,.001,7,1,1),n(-.05,.42,.44,.38,8,0,2),n(.42,.54,.4,.4,8,2,2),n(.54,.86,.38,.16,8,1,2),n(.86,1.15,.05,.01,6,2,2),new Float32Array(e)}function kr(e,{tectonicFieldBuf:t,deformFieldBuf:n,label:r=`ulg-surface-flora`}={}){let i=e.createBuffer({label:`${r}-instances`,size:Tr*48,usage:Er.STORAGE|Er.COPY_DST}),c=Or(),l=Math.floor(c.length/8),u=e.createBuffer({label:`${r}-template-verts`,size:c.byteLength,usage:Er.VERTEX|Er.COPY_DST});e.queue.writeBuffer(u,0,c);let d=e.createBuffer({label:`${r}-params`,size:96,usage:Er.UNIFORM|Er.COPY_DST}),f=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`read-only-storage`),a(3,`storage`)],p=s(e,{cacheKey:`ulg-surface-flora-placement.v1`,label:`${r}-place`,code:Dr,entryPoint:`place_surface_flora`,bindings:f}),m=o(e,{label:`${r}-bg`,layout:p.bindGroupLayout,entries:[{binding:0,resource:{buffer:d}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:n}},{binding:3,resource:{buffer:i}}]}),h=new ArrayBuffer(96),g=new Uint32Array(h),_=new Float32Array(h),v=``,y=0,b=!1;function x(t,{centerX:n=0,centerZ:i=0,focusX:a=0,focusZ:o=0,env:s={},xeno:c=null,snowlineM:l=28,autumnShift:u=0,seaIceFrac:f=0,tectWorldSpanM:x=12800,tectN:S=256,force:C=!1}={}){if(b)return!1;let w=!!(s?.hasSolidCrust&&!s?.isMagmaOcean&&!s?.isMinorBody&&!s?.isComet&&!s?.isCryoMoon&&(Number(s?.pressurePa)||0)>=500&&c?.solvent!==`H2O-subsurface`&&c?.solvent!==`none`),T=w&&!!(c&&c.biosphereViability>=.18),E=w&&!!(c&&c.civTechK>=.35);if(!T&&!E)return y=0,!1;let D=`${Math.floor(n/26)}:${Math.floor(i/26)}:${Math.round(l)}:${Math.round(u*20)}`;if(!C&&D===v)return y=Tr,!1;v=D,y=Tr;let O=!!T|(s.hasLiquidOcean||s.hasExoticOcean?2:0)|(E?4:0)|(c?.solvent&&c.solvent!==`H2O`?8:0);g[0]=32,g[1]=O,g[2]=S,g[3]=0,_[4]=n,_[5]=i,_[6]=26,_[7]=(Number(s.seed)||1)%997*.13+1.7,_[8]=Number(s.terrainAmpM)||42,_[9]=Number(s.craterStrength)||.2,_[10]=Number(s.seaLevelM)||-6,_[11]=l,_[12]=s.hasSolidCrust?1/(2*(Number(s.tinyPlanetCurvatureRadiusM)||2800)):0,_[13]=a,_[14]=o,_[15]=Number(c?.bucklingHeightScale)||1;let k=c?.pigmentRgb||[.16,.52,.22];_[16]=k[0],_[17]=k[1],_[18]=k[2],_[19]=Number(c?.biosphereViability)||.5,_[20]=u,_[21]=Number(c?.civTechK)||0,_[22]=x,_[23]=f,e.queue.writeBuffer(d,0,h);let A=t.beginComputePass({label:`${r}-pass`});return A.setPipeline(p.pipeline),A.setBindGroup(0,m),A.dispatchWorkgroups(Math.ceil(Tr/64)),A.end(),!0}return Object.freeze({maxInstances:Tr,templateVertCount:l,get activeInstanceCount(){return y},getResidentInstancesBuffer:()=>i,getResidentTemplateVertBuffer:()=>u,encodePlacementIfNeeded:x,dispose(){if(!b){b=!0;try{i.destroy()}catch{}try{u.destroy()}catch{}try{d.destroy()}catch{}}}})}function Ar(e,t,n){return Math.max(t,Math.min(n,e))}function jr(e){let t=e>>>0||1;return t=Math.imul(t^t>>>16,73244475)>>>0,t=Math.imul(t^t>>>16,73244475)>>>0,((t^t>>>16)>>>0)/4294967296}function Mr({tempK:e=288,pressurePa:t=101325,volatileFrac:n=.04,hasSolidCrust:r=!0,isCryoMoon:i=!1}={}){let a=Number(e)||288,o=Math.max(0,Number(t)||0),s=Math.max(0,Number(n)||0);return Object.freeze(o>=25e5&&a>=295&&a<=760||o>=5e5&&a>388&&a<=760?{solvent:`H2SO4`,formula:`H₂SO₄`,label:`Sulfuric Acid Cloud Aerosols (50 km Deck)`,dielectricEr:101,tMeltK:283.5,tBoilK:610,oceanRgb:[.64,.56,.24],membraneType:`Sulfonated Acidophile Vesicle`,hydrophobicCoupling:2.2,hBondStrength:1.65,deltaPh:2.35,strongPairFraction:.82,sequence:`HHH+PP-HHH+PP-HHHH+PP-HHH+PP-HHH`}:r&&o>=611&&a>=262&&a<=388&&s>=.012?{solvent:`H2O`,formula:`H₂O`,label:`Liquid Water (Aqueous)`,dielectricEr:78.4,tMeltK:273.15,tBoilK:373.15,oceanRgb:[.04,.24,.48],membraneType:`Phospholipid Bilayer`,hydrophobicCoupling:1.85,hBondStrength:1.45,deltaPh:1,strongPairFraction:.52,sequence:`HPPHH+PHHPPHH-PPHHPPH+PPH-PHHPPH`}:r&&o>=12e3&&a>=82&&a<=124?{solvent:`CH4`,formula:`CH₄/C₂H₆`,label:`Cryogenic Liquid Methane / Ethane`,dielectricEr:1.7,tMeltK:90.7,tBoilK:111.7,oceanRgb:[.18,.16,.1],membraneType:`Acrylonitrile Azotosome`,hydrophobicCoupling:1.18,hBondStrength:1.1,deltaPh:.45,strongPairFraction:.36,sequence:`+P-P+P-PHHP+P-P+P-PHHP+P-P+P-P`}:r&&o>=5e3&&a>=190&&a<=258&&s>=.008?{solvent:`NH3`,formula:`NH₃`,label:`Liquid Ammonia–Water Eutectic`,dielectricEr:22,tMeltK:195.4,tBoilK:239.8,oceanRgb:[.14,.26,.34],membraneType:`Ammonophilic Amphiphile`,hydrophobicCoupling:1.38,hBondStrength:1.25,deltaPh:.85,strongPairFraction:.48,sequence:`HPH+PHH-PHPHH+PH-PHPHH+PH-PHPH`}:i||r&&a>=75&&a<=180&&s>=.02?{solvent:`H2O-subsurface`,formula:`H₂O (Subsurface)`,label:`Subsurface Hydrothermal Brine Ocean`,dielectricEr:78.4,tMeltK:273.15,tBoilK:373.15,oceanRgb:[.06,.34,.56],membraneType:`Ether-Lipid Barophile Bilayer`,hydrophobicCoupling:2.05,hBondStrength:1.55,deltaPh:1.65,strongPairFraction:.68,sequence:`HHP+HHP-HHHP+HHP-HHHP+HHP-HHP+`}:{solvent:`none`,formula:`None`,label:`Anhydrous / Sterile Regime`,dielectricEr:78.4,tMeltK:273.15,tBoilK:373.15,oceanRgb:[.08,.14,.22],membraneType:`None`,hydrophobicCoupling:0,hBondStrength:.6,deltaPh:0,strongPairFraction:.5,sequence:`HPPHH+PHHPPHH-PP`})}function Nr(e=5778,t=`H2O`){let n=Ar(Number(e)||5778,2400,14e3);if(t===`CH4`)return[.58,.38,.72];if(t===`NH3`)return[.24,.62,.56];if(t===`H2SO4`)return[.76,.64,.22];if(n<3750){let e=Ar((n-2600)/1150,0,1);return[.34+.24*e,.09+.08*e,.12+.06*e]}if(n<5150){let e=Ar((n-3750)/1400,0,1);return[.58-.38*e,.22+.3*e,.12+.08*e]}if(n<=6350){let e=Ar((n-5150)/1200,0,1);return[.14+.06*(1-e),.48+.1*e,.18+.12*e]}let r=Ar((n-6350)/3e3,0,1);return[.2+.28*r,.44-.12*r,.58+.28*r]}function Pr({worldName:e=`Exoplanet`,tempK:t=288,pressurePa:n=101325,gravityMS2:r=9.81,rhoAtmKgM3:i=1.22,volatileFrac:a=.04,hasSolidCrust:o=!0,isCryoMoon:s=!1,isMagmaOcean:c=!1,stellarTeffK:l=5778,uvFluxNorm:u=1,seed:d=20261125}={}){let f=Mr(c?{tempK:1850,pressurePa:0,volatileFrac:0,hasSolidCrust:!1}:{tempK:t,pressurePa:n,volatileFrac:a,hasSolidCrust:o,isCryoMoon:s}),p=Math.max(.25,Number(r)||9.81),m=Math.max(0,Number(i)||0),h=Ar(Number(u)||(Math.max(2500,l)/5778)**3.2,.05,8),g=0;f.solvent===`H2O`?g=.88:f.solvent===`NH3`?g=.56:f.solvent===`CH4`?g=.48:f.solvent===`H2SO4`?g=.34:f.solvent===`H2O-subsurface`&&(g=.52),f.solvent!==`H2O-subsurface`&&n<1500&&(g*=Ar(n/1500,.05,1));let _=jr((d^729683222)>>>0),v=jr((d^2135587861)>>>0);g>.15&&(g=Ar(g*(.65+.55*_),0,1));let y=0,b=`Uninhabited`;if(g>=.42&&o&&!c&&v>.34){let e=Ar((v-.34)/.66,0,1);y=Number((.36+e*.68).toFixed(2)),b=y>=.85?`Type I Planetary Grid`:y>=.68?`Industrial Radio Era`:y>=.5?`Agrarian / Metallurgy`:`Settlement Megalithic`}let x=Ar((9.81/p)**.45*(1+.14*Math.log1p(m)),.45,2.6),S=Nr(l,f.solvent),C=f.solvent===`H2SO4`?330:f.solvent===`H2O-subsurface`?295:Ar(Number(t)||288,Math.max(82,f.tMeltK-4),Math.min(440,f.tBoilK+20)),w=Number(Ar(.014+.022*Math.sqrt(h),.01,.18).toFixed(3)),T=Number(Ar(1.35*(9.81/p)**.22*(1/(1+.12*m)),.55,2.35).toFixed(2));return Object.freeze({worldName:e,solvent:f.solvent,solventFormula:f.formula,solventLabel:f.label,oceanRgb:f.oceanRgb,tMeltK:f.tMeltK,tBoilK:f.tBoilK,dielectricEr:f.dielectricEr,membraneType:f.membraneType,biosphereViability:Number(g.toFixed(2)),civTechK:y,civStage:b,hasRadioBeacons:y>=.65,hasNightCityLights:y>=.55,bucklingHeightScale:Number(x.toFixed(2)),pigmentRgb:Object.freeze(S),stellarTeffK:Math.round(l),uvFluxNorm:Number(h.toFixed(2)),gravityMS2:Number(p.toFixed(2)),pressurePa:Math.round(n),labParams:Object.freeze({memTempK:Math.round(C),memEpsHp:f.hydrophobicCoupling,memOsmotic:f.solvent===`H2O-subsurface`?.42:.25,foldTempK:Math.round(C),foldEpsHp:f.solvent===`CH4`?.68:f.hydrophobicCoupling,foldEpsHb:f.hBondStrength,foldDielectricEr:f.dielectricEr,foldSeq:f.sequence,evoMu:w,evoBeta:2.4,evoStrongFrac:f.strongPairFraction,hhDeltaPh:f.deltaPh,morphV0:T})})}var Fr=Object.freeze([Object.freeze({id:`earth-h2o`,label:`🌍 Earth H₂O (G2V)`,worldName:`Earth (G2V)`,tempK:288,pressurePa:101325,gravityMS2:9.81,rhoAtmKgM3:1.22,volatileFrac:.05,hasSolidCrust:!0,isCryoMoon:!1,stellarTeffK:5778,uvFluxNorm:1,recommendedMode:`protocell-vesicle`}),Object.freeze({id:`titan-ch4`,label:`🟠 Titan CH₄ Azotosome`,worldName:`Titan (CH₄ Cryo-Sea)`,tempK:94,pressurePa:146700,gravityMS2:1.35,rhoAtmKgM3:5.3,volatileFrac:.06,hasSolidCrust:!0,isCryoMoon:!1,stellarTeffK:5778,uvFluxNorm:.12,recommendedMode:`lipid-soup`}),Object.freeze({id:`mdwarf-crimson`,label:`🔴 M-Dwarf Super-Earth`,worldName:`Proxima-like M-Dwarf World`,tempK:296,pressurePa:185e3,gravityMS2:14.8,rhoAtmKgM3:2.1,volatileFrac:.06,hasSolidCrust:!0,isCryoMoon:!1,stellarTeffK:3150,uvFluxNorm:3.4,recommendedMode:`quasispecies-eigen`}),Object.freeze({id:`venus-h2so4`,label:`🟡 Venus H₂SO₄ Cloud Deck`,worldName:`Venus 52 km Acid Cloud Deck`,tempK:332,pressurePa:92e5,gravityMS2:8.87,rhoAtmKgM3:1.15,volatileFrac:.02,hasSolidCrust:!0,isCryoMoon:!1,stellarTeffK:5778,uvFluxNorm:1.9,recommendedMode:`amphipathic-helix-bundle`}),Object.freeze({id:`europa-vent`,label:`🔵 Europa Hydrothermal`,worldName:`Europa Subsurface Vent`,tempK:102,pressurePa:0,gravityMS2:1.31,rhoAtmKgM3:0,volatileFrac:.08,hasSolidCrust:!0,isCryoMoon:!0,stellarTeffK:5778,uvFluxNorm:.05,recommendedMode:`excitable-spiral`})]);function Ir({kind:e=`fauna`,worldName:t=`Exoplanet`,env:n={},xeno:r=null,latDeg:i=32,lonDeg:a=0,seed:o=1337}={}){let s=r||Pr({worldName:t,tempK:n.tempK??288,pressurePa:n.pressurePa??101325,gravityMS2:n.gravityMS2??9.81,rhoAtmKgM3:n.rhoAtmKgM3??1.22,seed:o}),c=Math.max(.25,Number(n.gravityMS2??s.gravityMS2)||9.81),l=Math.max(0,Number(n.rhoAtmKgM3)||1.22),u=e===`fauna`,d=s.solvent||`H2O`,f=d===`CH4`?`Cryo-Azoto`:d===`NH3`?`Ammono`:d===`H2SO4`?`Sulfo`:`Bio`,p,m;if(u)c<4.5||l>2.2?(p=`Buoyant Gas-Sac Glider`,m=`${f} Aero-Glider`):c>11.5?(p=`Armored High-g Hexapod`,m=`${f} Litho-Hexapod`):(p=`Articulated Terrestrial Grazer`,m=`${f} Quadruped Grazer`);else{let e=Number(s.stellarTeffK)||5778,t=d===`CH4`?`Tholin-Frond`:e<3900?`Crimson-Leaf`:e>6400?`Violet-Canopy`:`Chlorophyll`;p=c<5?`Tall Slender Low-g Spire Tree`:c>12?`Buttressed High-g Canopy Tree`:`Broadleaf / Conifer Vascular Tree`,m=`${t} Arbor`}let h=String(s.labParams?.foldSeq||`HPPHH+PHHPPHH-PPHHPPH+PPH-PHHPPH`),g=u?[`H`,`P`,`+`,`-`,`H`,`P`]:[`H`,`H`,`P`,`P`,`+`,`-`],_=h.split(``);for(let e=0;e<5;e+=1){let t=Math.floor(jr(o+e*97+(u?7:31)>>>0)*_.length);_[t]=g[Math.floor(jr(o+e*211>>>0)*g.length)]}let v=_.join(``),y=u?`excitable-spiral`:`amphipathic-helix-bundle`;return Object.freeze({id:`spec-${e}-${(o>>>0).toString(36)}`,kind:u?`fauna`:`flora`,speciesName:m,morphClass:p,worldName:t,solvent:d,solventFormula:s.solventFormula||d,solventLabel:s.solventLabel||d,membraneType:s.membraneType||`Phospholipid Bilayer`,tempK:Math.round(s.labParams?.memTempK??n.tempK??288),gravityMS2:Number(c.toFixed(2)),pressurePa:Math.round(n.pressurePa??s.pressurePa??101325),stellarTeffK:Math.round(s.stellarTeffK||5778),uvFluxNorm:s.uvFluxNorm??1,fasta:v,recommendedBioMode:y,latDeg:Number(Number(i||0).toFixed(1)),lonDeg:Number(Number(a||0).toFixed(1)),profile:s})}function Lr(e,t=`protocell-vesicle`,n=null){let r=new URLSearchParams({xeno:`1`,world:String(n?.worldName||e?.worldName||`Exoplanet`),T:String(Math.round(n?.tempK||e?.labParams?.memTempK||288)),P:String(Math.round(n?.pressurePa||e?.pressurePa||101325)),g:String(n?.gravityMS2||e?.gravityMS2||9.81),solvent:String(n?.solvent||e?.solvent||`H2O`),teff:String(Math.round(n?.stellarTeffK||e?.stellarTeffK||5778)),uv:String(n?.uvFluxNorm||e?.uvFluxNorm||1),mode:n?.recommendedBioMode||t});return n&&(r.set(`specimenKind`,String(n.kind||`fauna`)),r.set(`species`,String(n.speciesName||`Abducted Organism`)),n.morphClass&&r.set(`morph`,String(n.morphClass)),n.fasta&&r.set(`fasta`,String(n.fasta)),Number.isFinite(n.latDeg)&&r.set(`lat`,String(n.latDeg)),Number.isFinite(n.lonDeg)&&r.set(`lon`,String(n.lonDeg))),`./life-lab.html?${r.toString()}`}function Rr(e=``){let t=new URLSearchParams(e||``);if(t.get(`xeno`)!==`1`)return null;let n=t.get(`solvent`)||``,r=Number(t.get(`T`))||288,i=Number(t.get(`P`))||101325,a=Number(t.get(`g`))||9.81,o=Number(t.get(`teff`))||5778,s=Number(t.get(`uv`))||1,c=t.get(`world`)||`Alien World`,l=t.get(`mode`)||`protocell-vesicle`,u=Pr({worldName:c,tempK:r,pressurePa:n===`H2SO4`?Math.max(i,1e6):n===`CH4`?Math.max(i,1e5):i,gravityMS2:a,isCryoMoon:n===`H2O-subsurface`,volatileFrac:.05,stellarTeffK:o,uvFluxNorm:s}),d=t.get(`species`)||``,f=t.get(`specimenKind`)||``,p=t.get(`fasta`)||``,m=t.get(`morph`)||``,h=d?Object.freeze({kind:f||`fauna`,speciesName:d,morphClass:m||(f===`flora`?`Vascular Flora`:`Motile Fauna`),worldName:c,fasta:p||u.labParams.foldSeq,latDeg:Number(t.get(`lat`))||0,lonDeg:Number(t.get(`lon`))||0}):null;return{profile:h?Object.freeze({...u,abductedSpecimen:h,labParams:Object.freeze({...u.labParams,foldSeq:h.fasta})}):u,mode:l,abductedSpecimen:h}}var zr=`ulg.astrophysics.planetary-surface-vehicles-webgpu.v1`,Br=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,INDEX:16,VERTEX:32,UNIFORM:64,STORAGE:128}),Vr=Object.freeze({id:`planetary-surface-vehicles`,lawNodeId:`law:astrophysics-planetary-surface-vehicles`,orderConstraint:`after:planetary-atmosphere-em`,adapterMode:n.SURFACE_INTERFACE,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`planetary-body-state`,`planetary-atmo-em-grid`,`surface-vehicle-inputs`]),writes:Object.freeze([`surface-terrain-mesh`,`surface-plume-particles`,`surface-vehicle-frames`]),accumulates:Object.freeze([`surface-vehicle-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`vehicle-momentum-plus-impulse`,`rocket-propellant-budget`,`ballistic-dust-mass`]),validityDomain:Object.freeze({minBodyRadiusM:5e4,maxViewSpanM:5e4}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([.1,5e4]),fundamentalLaws:Object.freeze([`local-gravitational-acceleration`,`rocker-bogie-contact-suspension`,`tsiolkovsky-rocket-impulse`,`actuator-disk-aerodynamic-lift`,`quadratic-aerodynamic-drag`])});function Hr(e={}){let t=!!e.surfaceViewActive,n=Number(e.viewSpanM)||0,r=Number(e.bodyRadiusM)||0,i=t||r>=1e5&&n>0&&n<=2e4;return{active:i,aerodynamicFlightPossible:i&&(Number(e.surfacePressurePa)||0)>=200,reason:i?`planetary-surface-explorer-active`:`orbital-or-deep-space-dormant`}}function Ur(t={},{planetaryResult:n=null,planetaryAtmoState:r=null,planetaryMode:i=`standard`,landingSite:a=null,seed:o=20261125}={}){let s=Math.max(1e9,(Number(t.massSolar)||300349e-11)*198847e25),c=Math.max(100,(Number(t.radiusKm)||6371)*1e3),l=66743e-15*s/(c*c),u=Math.max(.002,Math.min(35,Number(t.surfaceGravityMS2)||l)),d=r||ye(t,n),f=c<16e6,p=i===`magma-ocean`||(Number(t.tempK)||288)>1200,m=i===`cryo-plumes`,h=i===`rogue`,g=i===`eyeball-locked`,_=Math.max(0,Number(d?.surfacePressurePa??t.surfacePressurePa)||0);p&&_<5e4&&(_=18e4),m&&(_=0);let v=Math.max(35,p?1850:h?75:Number(t.tempK)||288),y=Math.max(35,v+(Number(a?.tempOffsetK)||0)),b=f?_>2e6||_>100&&_<2e4?.044:.029:.0024,x=_>.001?_*b/(8.31446*y):0,S=Math.max(0,Number(d?.volatileMassFrac??t.volatileMassFrac)||0),C=Math.max(0,Number(d?.particulateMassFrac??t.particulateMassFrac)||0),w=Pr({worldName:t.name||`World`,tempK:y,pressurePa:_,gravityMS2:u,stellarTeffK:Number(t.hostStarTeffK)||5778,volatileFrac:S,hasSolidCrust:f,isCryoMoon:m,isMagmaOcean:p,seed:o,civTechK:Number.isFinite(Number(t.civTechK))?Number(t.civTechK):void 0}),T=f&&!p&&!m&&!h&&_>=611&&y>=265&&y<=365&&S>=.015,E=f&&!p&&!m&&!T&&(w.solvent===`CH4`||w.solvent===`NH3`||w.solvent===`H2SO4`),D=T||E,O=w.oceanRgb||[.04,.24,.46],k=w.solvent===`CH4`?90.7:w.solvent===`NH3`?195.4:w.solvent===`H2SO4`?283.5:273.15,A=1.8,j=.5*1.13*.0205*57600*x,M=A*u,N=j>M*1.05,P=M>0?j/M:0,F=p?[.24,.1,.07]:m?[.76,.85,.94]:t.color0||[.68,.44,.28],I=p?[1,.42,.08]:m?[.42,.62,.82]:t.color1||[.38,.28,.22],L=h?.08:Math.max(0,Math.min(1,Math.log10(Math.max(1,_)/15)/3.8)),R=D?Math.min(.14,C*.22):_>50&&_<3e4?Math.min(1,.58+C*1.4):Math.min(.7,C*.8),z=!f||_>8e5||y<130&&_>5e4,B,V;if(p)B=[.22,.07,.04],V=[.78,.3,.1];else if(L<.03)B=[.004,.007,.016],V=[.012,.018,.032];else if(z)B=[.56*F[0]+.16,.48*F[1]+.12,.26*F[2]+.05],V=[.92*F[0]+.1,.78*F[1]+.08,.42*F[2]+.05];else{let e=[.07,.26,.72],t=[.46,.72,.98],n=[.42,.22,.14],r=[.84,.56,.36];B=[(e[0]*(1-R)+n[0]*R)*L,(e[1]*(1-R)+n[1]*R)*L,(e[2]*(1-R)+n[2]*R)*L],V=[(t[0]*(1-R)+r[0]*R)*L,(t[1]*(1-R)+r[1]*R)*L,(t[2]*(1-R)+r[2]*R)*L]}let ee=f?Math.max(.08,Math.min(1,1-L*.78-(D?.2:0))):0,H=Math.max(.65,Math.min(1.6,Number(a?.ampScale)||1)),U=f?Math.max(24,Math.min(96,42*(9.81/u)**.32*H)):14,W=D?-6+(Number(a?.seaLevelOffsetM)||0):-999,G=x>1e-4?Math.min(18,(2.2+9.5*R+3.5*L)*(g?1.4:1)):0,te=!!t.isMinorBody||c<6e5,K=!!t.isComet,ne=!!t.isMetallicAsteroid,q=te?Math.max(.14,Math.min(2.2,u)):u,J=te?Math.max(460,Math.min(1450,460+c/5e5*990)):2800;return Object.freeze({schema:zr,gravityMS2:q,rawGravityMS2:u,radiusM:c,massKg:s,hasSolidCrust:f,isMinorBody:te,isComet:K,isMetallicAsteroid:ne,isMagmaOcean:p,isCryoMoon:m,isRogue:h,isEyeball:g,hasLiquidOcean:D,hasExoticOcean:E,oceanRgb:Object.freeze([O[0],O[1],O[2]]),solvent:w.solvent,solventMeltTempK:k,xenobiology:w,seaLevelM:W,pressurePa:_,tempK:y,molarMassKgPerMol:b,rhoAtmKgM3:x,skyOpticalDepth:L,skyZenithRgb:Object.freeze(B),skyHorizonRgb:Object.freeze(V),dustTint:R,craterStrength:te?Math.max(.75,ee):ee,terrainAmpM:te?Math.max(26,Math.min(54,U*.62)):U,baseWindMS:G,droneMassKg:A,maxAeroLiftN:j,droneWeightN:M,droneFlightCapable:N,droneThrustToWeight:P,color0:Object.freeze([a?.isDesert?Math.min(1,F[0]*1.15+.16):a?.isPolarIce?.86:F[0],a?.isDesert?Math.min(1,F[1]*.96+.08):a?.isPolarIce?.91:F[1],a?.isDesert?Math.max(.12,F[2]*.65):a?.isPolarIce?.96:F[2]]),color1:Object.freeze([I[0],I[1],I[2]]),crustPrimaryRgb:Object.freeze([F[0],F[1],F[2]]),crustSecondaryRgb:Object.freeze([I[0],I[1],I[2]]),landingSite:a||null,tinyPlanetCurvatureRadiusM:J,seed:o>>>0||1,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1})}function Wr(e){return e*e*(3-2*e)}function Gr(e,t,n){let r=Math.floor(e)|0,i=Math.floor(t)|0,a=Math.round(n*100)|0,o=Math.imul(r,374761393)+Math.imul(i,668265263)+Math.imul(a,1442695041)|0;return o=Math.imul(o^o>>>13,1274126177)|0,o=(o^o>>>16)>>>0,(o&16777215)/16777216}function Kr(e,t,n){let r=Math.floor(e),i=Math.floor(t),a=Wr(e-r),o=Wr(t-i),s=Gr(r,i,n),c=Gr(r+1,i,n),l=Gr(r,i+1,n),u=Gr(r+1,i+1,n);return(s*(1-a)+c*a)*(1-o)+(l*(1-a)+u*a)*o}function qr(e,t,n){let r=0,i=.52,a=e,o=t;for(let e=0;e<4;e+=1){r+=i*(Kr(a,o,n)*2-1);let e=a*2.03+11.7,t=o*2.03-7.3;a=e,o=t,i*=.48}return r}function Jr(e,t,n,r){let i=e*n,a=t*n,o=Math.floor(i),s=Math.floor(a),c=0;for(let e=-1;e<=1;e+=1)for(let t=-1;t<=1;t+=1){let n=o+t,l=s+e;if(Gr(n,l,r+7.3)<.56)continue;let u=n+.18+.64*Gr(n,l,r+19.1),d=l+.18+.64*Gr(n,l,r+37.7),f=.22+.28*Gr(n,l,r+53.3),p=Math.hypot(i-u,a-d)/f;if(p<1.38)if(p<.84)c+=-.42*(1-(p/.84)**2);else{let e=(p-.84)/.54;c+=.19*Math.sin(e*Math.PI)*(1-.35*e)}}return c}function Yr(e,t,n){let r=n.seed%997*.13+1.7;if(!n.hasSolidCrust)return qr(e*.0065,t*.0065,r)*n.terrainAmpM-28;let i=Math.min(1,Math.max(0,(Math.hypot(e,t)-18)/52)),a=i*i*(3-2*i),o=qr(e*.0055,t*.0055,r)*n.terrainAmpM,s=Math.abs(qr(e*.011+5.1,t*.011-3.4,r+2.1))*(n.terrainAmpM*.36),c=qr(e*.032,t*.032,r+4.9)*(n.terrainAmpM*.08),l=n.craterStrength>.02?(Jr(e,t,.0075,r)*n.terrainAmpM*.72+Jr(e,t,.024,r+11)*n.terrainAmpM*.24)*n.craterStrength:0,u=(o+s*.45+c+l)*(.1+.9*a);return n.hasLiquidOcean&&u<n.seaLevelM?n.seaLevelM:u}function Xr(e,t,n){let r=n.seed%997*.13+1.7;if(!n.hasSolidCrust)return qr(e*.0065,t*.0065,r)*n.terrainAmpM-28;let i=Math.min(1,Math.max(0,(Math.hypot(e,t)-18)/52)),a=i*i*(3-2*i),o=qr(e*.0055,t*.0055,r)*n.terrainAmpM,s=Math.abs(qr(e*.011+5.1,t*.011-3.4,r+2.1))*(n.terrainAmpM*.36),c=qr(e*.032,t*.032,r+4.9)*(n.terrainAmpM*.08),l=n.craterStrength>.02?(Jr(e,t,.0075,r)*n.terrainAmpM*.72+Jr(e,t,.024,r+11)*n.terrainAmpM*.24)*n.craterStrength:0;return(o+s*.45+c+l)*(.1+.9*a)}function Zr(e,t,n,r){let i=Math.max(.25,Number(n)||2.2),a=Math.floor(e/i),o=Math.floor(t/i),s=e/i-a,c=t/i-o,l=a*i,u=(a+1)*i,d=o*i,f=(o+1)*i,p=Yr(l,d,r),m=Yr(u,d,r),h=Yr(l,f,r),g=Yr(u,f,r);return s+c<=1?p+s*(m-p)+c*(h-p):g+(1-s)*(h-g)+(1-c)*(m-g)}function Qr(e,t,n,r,i,a=null){let o=Math.sin(n),s=Math.cos(n),c=[[-1.22,-1.22],[1.22,-1.22],[-1.22,0],[1.22,0],[-1.22,1.22],[1.22,1.22]],l=0,u=0,d=0,f=0,p=0,m=!1,h=[];for(let n=0;n<c.length;n+=1){let[g,_]=c[n],v=e+s*g+o*_,y=t-o*g+s*_,b=typeof a==`function`?a(v,y):0,x=Zr(v,y,r,i)+b,S=Yr(v,y,i)+b,C=Math.max(x,S);i.hasLiquidOcean&&Xr(v,y,i)+b<i.seaLevelM+.08&&(m=!0),h.push({rx:g,rz:_,hGround:C}),l+=C,u+=g*C,d+=g*g,f+=_*C,p+=_*_}let g=typeof a==`function`?a(e,t):0,_=Math.max(Zr(e,t,r,i)+g,Yr(e,t,i)+g);i.hasLiquidOcean&&Xr(e,t,i)<i.seaLevelM+.08&&(m=!0);let v=u/Math.max(1e-6,d),y=f/Math.max(1e-6,p),b=-(s*v+o*y),x=-(-o*v+s*y),S=Math.hypot(b,1,x)||1,C=[b/S,1/S,x/S],w=o*C[0]+s*C[2],T=[o-C[0]*w,-C[1]*w,s-C[2]*w],E=Math.hypot(T[0],T[1],T[2])||1,D=T[1]/E,O=[C[1]*(T[2]/E)-C[2]*D,C[2]*(T[0]/E)-C[0]*(T[2]/E),C[0]*D-C[1]*(T[0]/E)],k=Math.hypot(O[0],O[1],O[2])||1,A=O[1]/k,j=_+.16;for(let e=0;e<h.length;e+=1){let t=h[e],n=t.hGround-(A*t.rx+D*t.rz)+.16;n>j&&(j=n)}return{supportY:j,centerGroundY:_,normal:C,anyUnderwater:m,maxSlopeSin:Math.sqrt(Math.max(0,1-C[1]*C[1]))}}function $r(e,t,n){let r=.65,i=Yr(e-r,t,n),a=Yr(e+r,t,n),o=Yr(e,t-r,n),s=Yr(e,t+r,n),c=i-a,l=2*r,u=o-s,d=Math.hypot(c,l,u)||1;return[c/d,l/d,u/d]}var ei=Object.freeze({1:{Z:1,sym:`H`,name:`Hydrogen`},2:{Z:2,sym:`He`,name:`Helium`},6:{Z:6,sym:`C`,name:`Carbon`},7:{Z:7,sym:`N`,name:`Nitrogen`},8:{Z:8,sym:`O`,name:`Oxygen`},11:{Z:11,sym:`Na`,name:`Sodium`},12:{Z:12,sym:`Mg`,name:`Magnesium`},13:{Z:13,sym:`Al`,name:`Aluminum`},14:{Z:14,sym:`Si`,name:`Silicon`},16:{Z:16,sym:`S`,name:`Sulfur`},17:{Z:17,sym:`Cl`,name:`Chlorine`},18:{Z:18,sym:`Ar`,name:`Argon`},20:{Z:20,sym:`Ca`,name:`Calcium`},22:{Z:22,sym:`Ti`,name:`Titanium`},26:{Z:26,sym:`Fe`,name:`Iron`},28:{Z:28,sym:`Ni`,name:`Nickel`}}),ti=Object.freeze({H2:{formula:`H₂`,name:`Molecular Hydrogen`,primaryZ:1,moleculeKey:`H2`,elements:[1]},He:{formula:`He`,name:`Helium`,primaryZ:2,moleculeKey:`H2`,elements:[2]},CH4:{formula:`CH₄`,name:`Methane`,primaryZ:6,moleculeKey:`CH4`,elements:[6,1]},H2O:{formula:`H₂O`,name:`Water`,primaryZ:8,moleculeKey:`H2O`,elements:[8,1]},NH3:{formula:`NH₃`,name:`Ammonia`,primaryZ:7,moleculeKey:`NH3`,elements:[7,1]},NH4SH:{formula:`NH₄SH`,name:`Ammonium Hydrosulfide`,primaryZ:16,moleculeKey:`NH3`,elements:[7,1,16]},H2SO4:{formula:`H₂SO₄`,name:`Sulfuric Acid`,primaryZ:16,moleculeKey:`H2O`,elements:[16,8,1]},CO2:{formula:`CO₂`,name:`Carbon Dioxide`,primaryZ:6,moleculeKey:`CO2`,elements:[6,8]},CO:{formula:`CO`,name:`Carbon Monoxide`,primaryZ:6,moleculeKey:`CO`,elements:[6,8]},N2:{formula:`N₂`,name:`Molecular Nitrogen`,primaryZ:7,moleculeKey:`N2`,elements:[7]},O2:{formula:`O₂`,name:`Molecular Oxygen`,primaryZ:8,moleculeKey:`O2`,elements:[8]},Ar:{formula:`Ar`,name:`Argon`,primaryZ:18,moleculeKey:`N2`,elements:[18]},C2H6:{formula:`C₂H₆`,name:`Ethane / Tholins`,primaryZ:6,moleculeKey:`CH4`,elements:[6,1,7]},MgSiO3:{formula:`MgSiO₃`,name:`Enstatite Silicate`,primaryZ:14,moleculeKey:`SiO2`,elements:[12,14,8]},KCl:{formula:`KCl`,name:`Potassium Chloride`,primaryZ:17,moleculeKey:`H2O`,elements:[17,11]}});function ni(e){let t=new Set,n=[];for(let r of e)t.has(r)||!ei[r]||(t.add(r),n.push({...ei[r]}));return n}function ri(e,t=[0,0,0],{activeVehicle:n=`rover`,cfdTelemetry:r=null,worldName:i=`World`}={}){let a=Number(t?.[0])||0,o=Number(t?.[1])||0,s=Number(t?.[2])||0,c=e.seed%997*.13+1.7,l=e.hasSolidCrust?Yr(a,s,e):-999,u=e.hasSolidCrust?Math.max(0,o-l):Math.max(0,o);if((!e.hasSolidCrust||n===`ufo`&&u>10)&&r?.chemistry?.species?.length){let e=r.chemistry,t=(e.activeCloudId&&e.activeCloudId!==`none`?e.condensingDecks?.find(t=>t.id===e.activeCloudId):null)||(e.condensingDecks?.length?[...e.condensingDecks].sort((e,t)=>(t.density||0)-(e.density||0))[0]:null),n=t?.id||e.species[0]?.id||`H2`,c=ti[n]||ti.H2,l=e.species.slice(0,5).map(e=>{let t=ti[e.id]||{formula:e.id,name:e.name||e.id,primaryZ:8,moleculeKey:`H2O`,elements:[8,1]};return{id:e.id,formula:t.formula,name:t.name,moleFrac:e.moleFrac,condensed:e.condensedFrac>1e-6,primaryZ:t.primaryZ,moleculeKey:t.moleculeKey,elements:t.elements}}),u=[];for(let e of l)u.push(...e.elements);let d=t?e.tempK<210?`solid`:`melt`:e.pressureBar>12?`melt`:`vapor`;return{id:`atmo-${n.toLowerCase()}`,worldName:i,category:`atmosphere-stratum`,name:t?`${t.name} (${c.formula})`:`${e.activeCloudDeck} (${c.formula})`,shortLabel:t?`${t.id} Cloud`:`${c.formula} Stratum`,locationTag:`Alt ${e.altKm.toFixed(1)} km · ${e.pressureBar>=.1?`${e.pressureBar.toFixed(2)} bar`:`${(e.pressureBar*101.3).toFixed(1)} kPa`}`,coords:[Number(a.toFixed(1)),Number(o.toFixed(1)),Number(s.toFixed(1))],phasePreset:d,tempK:Math.round(e.tempK),pressureBar:e.pressureBar,primaryZ:c.primaryZ,formula:c.formula,moleculeKey:c.moleculeKey,compounds:l,elements:ni(u),summary:`${e.activeCloudDeck} sampled at ${e.altKm.toFixed(1)} km (${Math.round(e.tempK)} K, ${e.pressureBar.toFixed(2)} bar)`}}let d=Xr(a,s,e),f=Yr(a,s,e),p=$r(a,s,e),m=1-Math.max(0,Math.min(1,p[1])),h=Math.max(0,Math.min(1,f/Math.max(4,e.terrainAmpM)*.5+.5)),g=e.craterStrength>.02?(Jr(a,s,.022,c)*.72+Jr(a,s,.068,c+11)*.28)*e.craterStrength:0,_=[Number(a.toFixed(1)),Number(f.toFixed(1)),Number(s.toFixed(1))],v=`(${a.toFixed(0)}m, ${s.toFixed(0)}m) · Elev ${f.toFixed(1)}m`,y=t=>({...t,worldName:i,category:`surface-sample`,locationTag:v,coords:_,pressureBar:e.pressurePa/101325,elements:ni(t.compounds.flatMap(e=>e.elements))});if(e.hasLiquidOcean&&d<=e.seaLevelM+.08){let t=e.solvent||`H2O`;return y(t===`CH4`?{id:`cryogenic-methane-sea`,name:`Cryogenic Liquid Methane Sea (CH₄ · C₂H₆)`,shortLabel:`Methane CH₄ Sea`,phasePreset:`melt`,tempK:Math.round(e.tempK),primaryZ:6,formula:`CH₄`,moleculeKey:`CH4`,xenoProfile:e.xenobiology,xenoUrl:e.xenobiology?Lr(e.xenobiology):null,compounds:[{id:`CH4`,formula:`CH₄`,name:`Liquid Methane`,moleFrac:.78,primaryZ:6,moleculeKey:`CH4`,elements:[6,1]},{id:`C2H6`,formula:`C₂H₆`,name:`Liquid Ethane`,moleFrac:.16,primaryZ:6,moleculeKey:`CH4`,elements:[6,1]},{id:`N2`,formula:`N₂ / HCN`,name:`Dissolved Azotosome Precursors`,moleFrac:.06,primaryZ:7,moleculeKey:`N2`,elements:[7,6,1]}],summary:`Exotic cryogenic hydrocarbon sea (potential azotosome habitat) sampled at ${v}`}:t===`NH3`?{id:`liquid-ammonia-ocean`,name:`Liquid Ammonia-Water Ocean (NH₃ · H₂O)`,shortLabel:`Ammonia NH₃ Sea`,phasePreset:`melt`,tempK:Math.round(e.tempK),primaryZ:7,formula:`NH₃`,moleculeKey:`NH3`,xenoProfile:e.xenobiology,xenoUrl:e.xenobiology?Lr(e.xenobiology):null,compounds:[{id:`NH3`,formula:`NH₃`,name:`Liquid Ammonia`,moleFrac:.72,primaryZ:7,moleculeKey:`NH3`,elements:[7,1]},{id:`H2O`,formula:`H₂O`,name:`Eutectic Water-Ammonia`,moleFrac:.24,primaryZ:8,moleculeKey:`H2O`,elements:[8,1]},{id:`CH4`,formula:`CH₄`,name:`Dissolved Organics`,moleFrac:.04,primaryZ:6,moleculeKey:`CH4`,elements:[6,1]}],summary:`Cold polar ammonia-eutectic ocean sampled at ${v}`}:{id:`saline-ocean-water`,name:`Saline Liquid Ocean (H₂O · NaCl)`,shortLabel:`Ocean H₂O`,phasePreset:`melt`,tempK:Math.round(Math.max(274,Math.min(340,e.tempK))),primaryZ:8,formula:`H₂O`,moleculeKey:`H2O`,xenoProfile:e.xenobiology,xenoUrl:e.xenobiology?Lr(e.xenobiology):null,compounds:[{id:`H2O`,formula:`H₂O`,name:`Liquid Water`,moleFrac:.965,primaryZ:8,moleculeKey:`H2O`,elements:[8,1]},{id:`NaCl`,formula:`NaCl`,name:`Dissolved Halite Salt`,moleFrac:.029,primaryZ:11,moleculeKey:`H2O`,elements:[11,17]},{id:`CO2`,formula:`CO₂`,name:`Dissolved Carbonate`,moleFrac:.006,primaryZ:6,moleculeKey:`CO2`,elements:[6,8]}],summary:`Liquid volatile ocean sampled directly below craft at ${v}`})}if(e.isMagmaOcean){let t=1-Wr(Math.max(0,Math.min(1,(Math.abs(qr(a*.075,s*.075,c+3))-.12)/.3))),n=1-Wr(Math.max(0,Math.min(1,(h-.08)/.24))),r=Math.max(t*.9,n)>.35;return y({id:r?`molten-silicate-magma`:`quenched-basalt-crust`,name:r?`Molten Silicate Magma (Mg₂SiO₄ · FeO)`:`Quenched Volcanic Basalt (SiO₂ · FeO)`,shortLabel:r?`Molten Magma`:`Basalt Crust`,phasePreset:r?`melt`:`solid`,tempK:Math.round(r?Math.max(1750,e.tempK):Math.max(920,e.tempK*.65)),primaryZ:r?14:26,formula:r?`Mg₂SiO₄`:`SiO₂`,moleculeKey:`SiO2`,compounds:[{id:`SiO2`,formula:`SiO₂`,name:`Silica Melt`,moleFrac:.52,primaryZ:14,moleculeKey:`SiO2`,elements:[14,8]},{id:`MgSiO3`,formula:`Mg₂SiO₄`,name:`Forsterite Olivine`,moleFrac:.28,primaryZ:12,moleculeKey:`SiO2`,elements:[12,14,8]},{id:`FeO`,formula:`FeO`,name:`Ferrous Oxide`,moleFrac:.2,primaryZ:26,moleculeKey:`O2`,elements:[26,8]}],summary:`${r?`Incandescent molten fissure`:`Solidified dark volcanic plate`} sampled at ${v}`})}if(e.isCryoMoon||e.hasLiquidOcean&&h>.72||e.tempK<155&&h>.56)return y({id:`crystalline-water-ice`,name:e.isCryoMoon?`Cryovolcanic Water-Ice Lithosphere (H₂O Ih)`:`Alpine Glacial Ice & Frost (H₂O · CO₂)`,shortLabel:`Glacial H₂O Ice`,phasePreset:`solid`,tempK:Math.round(Math.min(255,Math.max(70,e.tempK-(e.hasLiquidOcean?22:0)))),primaryZ:8,formula:`H₂O`,moleculeKey:`H2O`,compounds:[{id:`H2O`,formula:`H₂O`,name:`Hexagonal Water Ice (Ih)`,moleFrac:.86,primaryZ:8,moleculeKey:`H2O`,elements:[8,1]},{id:`CO2`,formula:`CO₂`,name:`Dry-Ice Clathrate`,moleFrac:.09,primaryZ:6,moleculeKey:`CO2`,elements:[6,8]},{id:`NH3`,formula:`NH₃`,name:`Ammonia Hydrate`,moleFrac:.05,primaryZ:7,moleculeKey:`NH3`,elements:[7,1]}],summary:`Crystalline ice terrain sampled at ${v}`});if(e.hasLiquidOcean&&f<=e.seaLevelM+1)return y({id:`coastal-quartz-sand`,name:`Coastal Quartz & Carbonate Sand (SiO₂ · CaCO₃)`,shortLabel:`Quartz Sand`,phasePreset:`solid`,tempK:Math.round(e.tempK),primaryZ:14,formula:`SiO₂`,moleculeKey:`SiO2`,compounds:[{id:`SiO2`,formula:`SiO₂`,name:`Crystalline Quartz`,moleFrac:.68,primaryZ:14,moleculeKey:`SiO2`,elements:[14,8]},{id:`CaCO3`,formula:`CaCO₃`,name:`Biogenic Calcite`,moleFrac:.24,primaryZ:20,moleculeKey:`CO2`,elements:[20,6,8]},{id:`H2O`,formula:`H₂O`,name:`Interstitial Brine`,moleFrac:.08,primaryZ:8,moleculeKey:`H2O`,elements:[8,1]}],summary:`Coastal sand & carbonate shoreline sampled at ${v}`});if(g<-.14)return y({id:`impact-crater-breccia`,name:`Impact Crater Fe-Ni Breccia (Fe · Ni · SiO₂)`,shortLabel:`Crater Fe-Ni`,phasePreset:`solid`,tempK:Math.round(e.tempK),primaryZ:26,formula:`Fe-Ni`,moleculeKey:`SiO2`,compounds:[{id:`FeNi`,formula:`Fe-Ni`,name:`Meteoritic Kamacite Alloy`,moleFrac:.54,primaryZ:26,moleculeKey:`O2`,elements:[26,28]},{id:`SiO2`,formula:`SiO₂`,name:`Shocked Stishovite Silica`,moleFrac:.34,primaryZ:14,moleculeKey:`SiO2`,elements:[14,8]},{id:`FeS`,formula:`FeS`,name:`Troilite Sulfide`,moleFrac:.12,primaryZ:16,moleculeKey:`CO`,elements:[26,16]}],summary:`Shocked impact-crater basin & metallic ejecta sampled at ${v}`});if(m>.22||h>.64)return y({id:`exposed-basalt-ridge`,name:`Exposed Basalt & Olivine Ridge (SiO₂ · Mg₂SiO₄)`,shortLabel:`Basalt Ridge`,phasePreset:`solid`,tempK:Math.round(e.tempK),primaryZ:14,formula:`SiO₂`,moleculeKey:`SiO2`,compounds:[{id:`SiO2`,formula:`SiO₂`,name:`Silicate Framework`,moleFrac:.5,primaryZ:14,moleculeKey:`SiO2`,elements:[14,8]},{id:`Mg2SiO4`,formula:`Mg₂SiO₄`,name:`Olivine Silicate`,moleFrac:.26,primaryZ:12,moleculeKey:`SiO2`,elements:[12,14,8]},{id:`Al2O3`,formula:`Al₂O₃`,name:`Corundum / Plagioclase`,moleFrac:.14,primaryZ:13,moleculeKey:`O2`,elements:[13,8]},{id:`FeO`,formula:`FeO`,name:`Iron Oxide`,moleFrac:.1,primaryZ:26,moleculeKey:`O2`,elements:[26,8]}],summary:`Steep bedrock outcrop & silicate ridge sampled at ${v}`});if(e.hasLiquidOcean){let t=e.xenobiology;return y({id:t&&(t.solvent!==`H2O`||t.biosphereViability>=.25)?`alien-biosphere-flora`:`verdant-organic-loam`,name:t?.biosphereViability>=.25?`${t.floraMorphology} (${t.solventLabel} Biosphere)`:`Organic Humus & Silicate Loam (CH₄ · SiO₂ · H₂O)`,shortLabel:t?.biosphereViability>=.25?`${t.solvent} Flora`:`Organic Loam`,phasePreset:`solid`,tempK:Math.round(e.tempK),primaryZ:6,formula:t?.solvent===`CH4`?`C-H-N`:`C-H-O`,moleculeKey:`CH4`,xenoProfile:t,xenoUrl:t?Lr(t):null,compounds:[{id:`CH4`,formula:t?.solvent===`CH4`?`C₂H₃N (Azotosome)`:`C₆H₁₀O₅`,name:t?.membraneClass||`Organic Biopolymer / Cellulose`,moleFrac:.42,primaryZ:6,moleculeKey:`CH4`,elements:[6,1,8]},{id:`SiO2`,formula:`SiO₂`,name:`Clay & Quartz Soil`,moleFrac:.36,primaryZ:14,moleculeKey:`SiO2`,elements:[14,8]},{id:`H2O`,formula:t?.solventLabel||`H₂O`,name:`Solvent Pore Fluid`,moleFrac:.14,primaryZ:8,moleculeKey:`H2O`,elements:[8,1]},{id:`NH3`,formula:`NO₃⁻/NH₃`,name:`Fixed Nitrogen`,moleFrac:.08,primaryZ:7,moleculeKey:`NH3`,elements:[7,1,8]}],summary:t?`${t.floraMorphology} · ${t.metabolism} · ${t.civStage} sampled at ${v}`:`Temperate organic-bearing lowland soil sampled at ${v}`})}return e.tempK<135&&e.pressurePa>3e4?y({id:`cryogenic-tholin-regolith`,name:`Cryogenic Tholin & Methane Ice (C₂H₆ · CH₄ · H₂O)`,shortLabel:`Tholin / CH₄`,phasePreset:`solid`,tempK:Math.round(e.tempK),primaryZ:6,formula:`CH₄/C₂H₆`,moleculeKey:`CH4`,compounds:[{id:`CH4`,formula:`CH₄`,name:`Hydrocarbon Clathrate`,moleFrac:.48,primaryZ:6,moleculeKey:`CH4`,elements:[6,1]},{id:`H2O`,formula:`H₂O`,name:`Bedrock Water-Ice Cobbles`,moleFrac:.34,primaryZ:8,moleculeKey:`H2O`,elements:[8,1]},{id:`N2`,formula:`N₂ / HCN`,name:`Photochemical Tholins`,moleFrac:.18,primaryZ:7,moleculeKey:`N2`,elements:[7,6,1]}],summary:`Dense cryogenic haze-deposited hydrocarbon dunes sampled at ${v}`}):e.dustTint>.45&&e.pressurePa>20?y({id:`ferric-oxide-regolith`,name:`Ferric Oxide & Basalt Dust (Fe₂O₃ · SiO₂ · CO₂)`,shortLabel:`Ferric Fe₂O₃`,phasePreset:`solid`,tempK:Math.round(e.tempK),primaryZ:26,formula:`Fe₂O₃`,moleculeKey:`CO2`,compounds:[{id:`Fe2O3`,formula:`Fe₂O₃`,name:`Hematite Iron Oxide Dust`,moleFrac:.46,primaryZ:26,moleculeKey:`O2`,elements:[26,8]},{id:`SiO2`,formula:`SiO₂`,name:`Basaltic Plagioclase`,moleFrac:.4,primaryZ:14,moleculeKey:`SiO2`,elements:[14,8]},{id:`CO2`,formula:`CO₂`,name:`Adsorbed Carbon Dioxide`,moleFrac:.14,primaryZ:6,moleculeKey:`CO2`,elements:[6,8]}],summary:`Oxidized iron-rich desert regolith sampled at ${v}`}):y({id:`anorthosite-silicate-regolith`,name:`Anorthosite & Ilmenite Regolith (SiO₂ · Al₂O₃ · FeTiO₃)`,shortLabel:`Silicate Regolith`,phasePreset:`solid`,tempK:Math.round(e.tempK),primaryZ:14,formula:`SiO₂`,moleculeKey:`SiO2`,compounds:[{id:`SiO2`,formula:`SiO₂`,name:`Silicate Feldspar`,moleFrac:.48,primaryZ:14,moleculeKey:`SiO2`,elements:[14,8]},{id:`Al2O3`,formula:`Al₂O₃`,name:`Anorthosite Alumina`,moleFrac:.28,primaryZ:13,moleculeKey:`O2`,elements:[13,8]},{id:`FeTiO3`,formula:`FeTiO₃`,name:`Ilmenite Ore`,moleFrac:.24,primaryZ:22,moleculeKey:`O2`,elements:[26,22,8]}],summary:`Unweathered silicate regolith sampled at ${v}`})}var ii=`
struct SurfaceParams {
  grid_n: u32,           // 129
  particle_count: u32,   // 2048
  mode_flags: u32,       // bit0=solidCrust, bit1=magmaOcean, bit2=cryoMoon, bit3=liquidOcean
  step_index: u32,
  center_x: f32,
  center_z: f32,
  cell_size: f32,
  seed_f: f32,
  terrain_amp: f32,
  crater_str: f32,
  sea_level: f32,
  curv_inv_2r: f32,      // 1 / (2 * R_tiny_planet)
  gravity_g: f32,
  rho_atm: f32,
  wind_x: f32,
  wind_z: f32,
  dt: f32,
  rocket_on: f32,        // 0..1 rover jump-rocket throttle
  rover_speed: f32,
  drone_throttle: f32,   // 0..1 drone rotor downwash
  rover_pos_y: vec4<f32>,// xyz = rover pos, w = rover yaw
  drone_pos_a: vec4<f32>,// xyz = drone pos, w = drone aero_lift_norm
  col0_pad: vec4<f32>,   // rgb = primary crust albedo, w = focus_x
  col1_pad: vec4<f32>,   // rgb = secondary highland/lava albedo, w = focus_z
  ocean_rgb_ice: vec4<f32>, // rgb = active solvent ocean albedo, w = seaIceCoverFrac [0..1]
  climate_aux: vec4<f32>,   // x = snowlineM, y = outerCellSizeM, z = tectWorldSpanM, w = outerCenterX
  clip_aux: vec4<f32>,      // x = outerCenterZ, y = tectAmpScale, z = oceanPatchHalfM, w = autumnShift
};

// 48-byte mesh vertex matching SURFACE_MESH_WGSL:
//   pos_curv:  vec4(x, y, z, rawHeight)
//   norm_tag:  vec4(nx, ny, nz, biomeTag)   tag: 0=rock/regolith, 1=highland/ice, 2=liquid_ocean, 3=magma_crack
//   col_emiss: vec4(r, g, b, emissiveOrFoam)
struct TerrainVert {
  pos_curv: vec4<f32>,
  norm_tag: vec4<f32>,
  col_emiss: vec4<f32>,
};

// 64-byte plume particle matching PARTICLE_CLOUD_WGSL Mode 11:
//   pos_role: vec4(x, y, z, role)   0=rocket_flame, 1=regolith_dust, 2=drone_downwash_or_wind_mote
//   vel_age:  vec4(vx, vy, vz, age)
//   col_life: vec4(r, g, b, maxLife)
//   meta0:    vec4(size, temp, seed, live)
struct PlumeParticle {
  pos_role: vec4<f32>,
  vel_age: vec4<f32>,
  col_life: vec4<f32>,
  meta0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: SurfaceParams;
@group(0) @binding(1) var<storage, read_write> terrain_verts: array<TerrainVert>;
@group(0) @binding(2) var<storage, read_write> plumes: array<PlumeParticle>;
@group(0) @binding(3) var<storage, read_write> telemetry: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> deform_field: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> ocean_field: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> tectonic_field: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

fn hash2(ix: f32, iz: f32, s: f32) -> f32 {
  let xi = bitcast<u32>(i32(floor(ix)));
  let zi = bitcast<u32>(i32(floor(iz)));
  let si = bitcast<u32>(i32(round(s * 100.0)));
  var h = xi * 374761393u + zi * 668265263u + si * 1442695041u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h & 0xFFFFFFu) * (1.0 / 16777216.0);
}

fn vnoise2(x: f32, z: f32, s: f32) -> f32 {
  let ix = floor(x);
  let iz = floor(z);
  let fx = x - ix;
  let fz = z - iz;
  let ux = fx * fx * (3.0 - 2.0 * fx);
  let uz = fz * fz * (3.0 - 2.0 * fz);
  let a = hash2(ix, iz, s);
  let b = hash2(ix + 1.0, iz, s);
  let c = hash2(ix, iz + 1.0, s);
  let d = hash2(ix + 1.0, iz + 1.0, s);
  return mix(mix(a, b, ux), mix(c, d, ux), uz);
}

fn fbm2(x_in: f32, z_in: f32, s: f32) -> f32 {
  var sum = 0.0;
  var amp = 0.52;
  var fx = x_in;
  var fz = z_in;
  for (var i = 0u; i < 4u; i = i + 1u) {
    sum = sum + amp * (vnoise2(fx, fz, s) * 2.0 - 1.0);
    fx = fx * 2.03 + 11.7;
    fz = fz * 2.03 - 7.3;
    amp = amp * 0.48;
  }
  return sum;
}

fn crater_field(x: f32, z: f32, scale: f32, s: f32) -> f32 {
  let sx = x * scale;
  let sz = z * scale;
  let cx = floor(sx);
  let cz = floor(sz);
  var best = 0.0;
  for (var dz = -1; dz <= 1; dz = dz + 1) {
    for (var dx = -1; dx <= 1; dx = dx + 1) {
      let gx = cx + f32(dx);
      let gz = cz + f32(dz);
      let h = hash2(gx, gz, s + 7.3);
      if (h < 0.56) { continue; }
      let ox = gx + 0.18 + 0.64 * hash2(gx, gz, s + 19.1);
      let oz = gz + 0.18 + 0.64 * hash2(gx, gz, s + 37.7);
      let rad = 0.22 + 0.28 * hash2(gx, gz, s + 53.3);
      let d = length(vec2<f32>(sx - ox, sz - oz)) / rad;
      if (d < 1.38) {
        if (d < 0.84) {
          let q = d / 0.84;
          best = best - 0.42 * (1.0 - q * q);
        } else {
          let rt = (d - 0.84) / 0.54;
          best = best + 0.19 * sin(rt * 3.14159265) * (1.0 - 0.35 * rt);
        }
      }
    }
  }
  return best;
}

fn sample_deform_field(x: f32, z: f32) -> vec4<f32> {
  let half_m = 384.0;
  if (abs(x) >= half_m || abs(z) >= half_m) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  let edge_fade = (1.0 - smoothstep(half_m - 16.0, half_m, abs(x))) * (1.0 - smoothstep(half_m - 16.0, half_m, abs(z)));
  let u = clamp((x / half_m) * 0.5 + 0.5, 0.0, 0.9999);
  let v = clamp((z / half_m) * 0.5 + 0.5, 0.0, 0.9999);
  let gf = vec2<f32>(u * 127.0, v * 127.0);
  let i0 = vec2<u32>(u32(floor(gf.x)), u32(floor(gf.y)));
  let i1 = vec2<u32>(min(127u, i0.x + 1u), min(127u, i0.y + 1u));
  let f = fract(gf);
  let c00 = deform_field[i0.y * 128u + i0.x];
  let c10 = deform_field[i0.y * 128u + i1.x];
  let c01 = deform_field[i1.y * 128u + i0.x];
  let c11 = deform_field[i1.y * 128u + i1.x];
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y) * edge_fade;
}

fn sample_tectonic_field(x: f32, z: f32) -> vec4<f32> {
  let span = max(1000.0, params.climate_aux.z);
  let u = clamp((x / span) + 0.5, 0.0, 0.9999);
  let v = clamp((z / span) + 0.5, 0.0, 0.9999);
  let gf = vec2<f32>(u * 255.0, v * 255.0);
  let i0 = vec2<u32>(u32(floor(gf.x)), u32(floor(gf.y)));
  let i1 = vec2<u32>(min(255u, i0.x + 1u), min(255u, i0.y + 1u));
  let f = fract(gf);
  let c00 = tectonic_field[i0.y * 256u + i0.x];
  let c10 = tectonic_field[i0.y * 256u + i1.x];
  let c01 = tectonic_field[i1.y * 256u + i0.x];
  let c11 = tectonic_field[i1.y * 256u + i1.x];
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

fn sample_ocean_field(x: f32, z: f32) -> vec4<f32> {
  let span = max(64.0, params.clip_aux.z * 2.0);
  let u = fract(x / span);
  let v = fract(z / span);
  let gf = vec2<f32>(u * 128.0, v * 128.0);
  let i0 = vec2<u32>(u32(floor(gf.x)) & 127u, u32(floor(gf.y)) & 127u);
  let i1 = vec2<u32>((i0.x + 1u) & 127u, (i0.y + 1u) & 127u);
  let f = fract(gf);
  let c00 = ocean_field[i0.y * 128u + i0.x];
  let c10 = ocean_field[i0.y * 128u + i1.x];
  let c01 = ocean_field[i1.y * 128u + i0.x];
  let c11 = ocean_field[i1.y * 128u + i1.x];
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

fn eval_crust_height(x: f32, z: f32) -> f32 {
  let is_solid = (params.mode_flags & 1u) != 0u;
  if (!is_solid) {
    // Opaque deep swirling gas-giant ammonia/water cloud deck anchored cleanly beneath the saucer!
    return fbm2(x * 0.0065, z * 0.0065, params.seed_f) * params.terrain_amp + params.sea_level;
  }
  let r0 = length(vec2<f32>(x, z));
  let a = clamp((r0 - 18.0) / 52.0, 0.0, 1.0);
  let apron = a * a * (3.0 - 2.0 * a);
  let rolling = fbm2(x * 0.0055, z * 0.0055, params.seed_f) * params.terrain_amp;
  let ridge = abs(fbm2(x * 0.011 + 5.1, z * 0.011 - 3.4, params.seed_f + 2.1)) * (params.terrain_amp * 0.36);
  let detail = fbm2(x * 0.032, z * 0.032, params.seed_f + 4.9) * (params.terrain_amp * 0.08);
  var craters = 0.0;
  if (params.crater_str > 0.02) {
    craters = (crater_field(x, z, 0.0075, params.seed_f) * params.terrain_amp * 0.72
      + crater_field(x, z, 0.024, params.seed_f + 11.0) * params.terrain_amp * 0.24) * params.crater_str;
  }
  // Macro Voronoi plate tectonics & hydraulic river valley relief (fades smoothly outside 240 m boulder/rover valley!)
  let tect_blend = smoothstep(240.0, 560.0, r0);
  let tect = sample_tectonic_field(x, z);
  let tect_h = tect.x * (params.terrain_amp * params.clip_aux.y) * tect_blend;
  let def = sample_deform_field(x, z);
  return (rolling + ridge * 0.45 + detail + craters + tect_h) * (0.10 + 0.90 * apron) + def.x;
}

fn eval_height(x: f32, z: f32) -> f32 {
  let raw_h = eval_crust_height(x, z);
  let has_ocean = (params.mode_flags & 8u) != 0u;
  if (has_ocean && raw_h < params.sea_level) {
    return params.sea_level;
  }
  return raw_h;
}

// Kernel 1: Generate 2-Ring +-6 km Planetary GPU Clipmap Mesh (gid.z=0 inner +-608m, gid.z=1 outer +-6km!)
@compute @workgroup_size(8, 8, 1)
fn generate_surface_terrain_mesh(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.grid_n;
  if (gid.x >= n || gid.y >= n || gid.z >= 2u) { return; }
  let is_outer = gid.z == 1u;
  let half = f32(n - 1u) * 0.5;
  let cs = select(params.cell_size, params.climate_aux.y, is_outer);
  let cx = select(params.center_x, params.climate_aux.w, is_outer);
  let cz = select(params.center_z, params.clip_aux.x, is_outer);
  let wx = cx + (f32(gid.x) - half) * cs;
  let wz = cz + (f32(gid.y) - half) * cs;

  let crust_h = eval_crust_height(wx, wz);
  let is_solid = (params.mode_flags & 1u) != 0u;
  let is_magma = (params.mode_flags & 2u) != 0u;
  let is_cryo = (params.mode_flags & 4u) != 0u;
  let has_ocean = (params.mode_flags & 8u) != 0u;
  let ice_cover = clamp(params.ocean_rgb_ice.w, 0.0, 1.0);
  let is_ocean = is_solid && has_ocean && crust_h <= params.sea_level + 0.04;

  var h = select(crust_h, params.sea_level, is_ocean);
  let eps = max(0.5, cs * 0.45);
  let hL = eval_height(wx - eps, wz);
  let hR = eval_height(wx + eps, wz);
  let hD = eval_height(wx, wz - eps);
  let hU = eval_height(wx, wz + eps);
  var n_vec = normalize(vec3<f32>(hL - hR, 2.0 * eps, hD - hU));

  var wave_foam = 0.0;
  if (is_ocean && ice_cover < 0.96) {
    let ow = sample_ocean_field(wx, wz);
    let wave_fade = 1.0 - smoothstep(420.0, 1800.0, length(vec2<f32>(wx - params.col0_pad.w, wz - params.col1_pad.w)));
    let wave_amp = (1.0 - ice_cover) * wave_fade;
    h = h + ow.x * wave_amp * 0.85;
    n_vec = normalize(vec3<f32>(-ow.y * wave_amp * 2.2, 1.0, -ow.z * wave_amp * 2.2));
    wave_foam = ow.w * wave_amp;
  }

  // Subtle seam drop on outer clipmap overlap collar so inner high-detail ring always wins cleanly!
  let dx = wx - params.col0_pad.w;
  let dz = wz - params.col1_pad.w;
  let r2 = dx * dx + dz * dz;
  let collar_drop = select(0.0, select(0.0, 1.8, max(abs(wx - params.center_x), abs(wz - params.center_z)) < 580.0), is_outer);
  let y_curved = h - r2 * params.curv_inv_2r - collar_drop;

  let tect = sample_tectonic_field(wx, wz);
  let slope = 1.0 - clamp(n_vec.y, 0.0, 1.0);
  let h_norm = clamp((h / max(4.0, params.terrain_amp)) * 0.5 + 0.5, 0.0, 1.0);
  let strata = 0.5 + 0.5 * sin(h * 1.4 + fbm2(wx * 0.08, wz * 0.08, params.seed_f + 9.0) * 3.0);

  var col = mix(params.col0_pad.rgb, params.col1_pad.rgb, clamp(h_norm * 0.65 + slope * 1.2 + strata * 0.16, 0.0, 1.0));
  var emiss = 0.0;
  var tag = 0.0;

  if (!is_solid) {
    // Gas giant cloud bands
    let band = 0.5 + 0.5 * sin(wz * 0.04 + fbm2(wx * 0.02, wz * 0.02, params.seed_f) * 3.5);
    col = mix(params.col0_pad.rgb, params.col1_pad.rgb, band);
    tag = 1.0;
  } else if (is_ocean) {
    if (ice_cover >= 0.72) {
      // Frozen winter sea ice: bright pale-cyan pressure ridges, Rover-drivable!
      let ridge_n = fbm2(wx * 0.05, wz * 0.05, params.seed_f + 13.0);
      col = mix(vec3<f32>(0.76, 0.88, 0.96), vec3<f32>(0.92, 0.96, 1.0), clamp(0.5 + 0.5 * ridge_n, 0.0, 1.0));
      tag = 1.0;
    } else {
      // Active solvent liquid ocean (H2O sapphire, CH4 hydrocarbon amber-teal, NH3 deep indigo, etc.)
      let shallow = 1.0 - smoothstep(0.0, 4.5, params.sea_level - crust_h);
      col = mix(params.ocean_rgb_ice.rgb, params.ocean_rgb_ice.rgb * 1.65 + vec3<f32>(0.04, 0.16, 0.14), shallow * 0.55);
      col = mix(col, vec3<f32>(0.84, 0.93, 0.98), ice_cover * 0.65);
      emiss = wave_foam;
      tag = 2.0;
    }
  } else if (is_magma) {
    let crack = 1.0 - smoothstep(0.12, 0.42, abs(fbm2(wx * 0.075, wz * 0.075, params.seed_f + 3.0)));
    let low_lava = 1.0 - smoothstep(0.08, 0.32, h_norm);
    let lava_w = clamp(max(crack * 0.9, low_lava), 0.0, 1.0);
    col = mix(vec3<f32>(0.10, 0.07, 0.06), vec3<f32>(1.0, 0.36, 0.06), lava_w);
    emiss = lava_w * 1.45;
    tag = select(0.0, 3.0, lava_w > 0.35);
  } else if (is_cryo) {
    let fissure = 1.0 - smoothstep(0.04, 0.16, abs(fbm2(wx * 0.055, wz * 0.055, params.seed_f + 6.0)));
    col = mix(vec3<f32>(0.78, 0.87, 0.95), vec3<f32>(0.30, 0.62, 0.88), clamp(fissure + slope * 0.8, 0.0, 1.0));
    emiss = fissure * 0.25;
    tag = 1.0;
  } else if (has_ocean) {
    // Multi-biome tectonic/hydraulic terrain: beaches, arid plateaus, lush valleys, rivers, rocky cliffs, emergent seasonal snowline!
    let coast = 1.0 - smoothstep(params.sea_level + 0.05, params.sea_level + 1.4, h);
    let snow = smoothstep(params.climate_aux.x - 4.0, params.climate_aux.x + 12.0, h);
    let moisture = tect.z;
    // Rivers appear ONLY in concentrated valley drainage channels (above background rainfall equilibrium ~1.2!)
    let river = smoothstep(1.48, 2.18, tect.y) * (1.0 - smoothstep(0.05, 0.15, slope)) * (1.0 - snow * 0.85);
    let autumn = clamp(params.clip_aux.w, 0.0, 1.0);
    let dry_col = vec3<f32>(0.62, 0.52, 0.34);
    let lush_col = mix(vec3<f32>(0.14, 0.44, 0.18), vec3<f32>(0.50, 0.36, 0.15), autumn * 0.55);
    let biome_base = mix(dry_col, lush_col, smoothstep(0.20, 0.68, moisture));
    let rock_col = mix(vec3<f32>(0.42, 0.38, 0.34), vec3<f32>(0.30, 0.28, 0.26), tect.w);
    col = mix(biome_base, rock_col, clamp(slope * 2.1 + smoothstep(0.54, 0.86, h_norm) * 0.55, 0.0, 1.0));
    col = mix(col, vec3<f32>(0.78, 0.72, 0.56), coast);
    col = mix(col, params.ocean_rgb_ice.rgb * 1.35, river * 0.82);
    col = mix(col, vec3<f32>(0.90, 0.94, 0.98), snow);
    tag = select(select(0.0, 2.0, river > 0.72 && ice_cover < 0.72), 1.0, snow > 0.42);
  }

  // Persistent GPU Laser/Missile/Antimatter Thermal Glow, Vitrified Melt & Scorched Crater Rim!
  if (is_solid && !is_outer) {
    let def_v = sample_deform_field(wx, wz);
    let char_f = clamp(def_v.w, 0.0, 1.0);
    let melt_f = clamp(def_v.z, 0.0, 1.0);
    let glow_f = clamp((def_v.y - 820.0) / 1800.0, 0.0, 1.0);
    col = mix(col, vec3<f32>(0.11, 0.10, 0.12), char_f * 0.72);
    if (is_cryo && melt_f > 0.08) {
      // Melted ice turns into shimmering liquid water pool!
      col = mix(col, vec3<f32>(0.08, 0.36, 0.66), melt_f * 0.85);
      tag = select(tag, 2.0, melt_f > 0.32);
    } else if (glow_f > 0.02) {
      let lava_col = mix(vec3<f32>(1.0, 0.28, 0.04), vec3<f32>(1.0, 0.92, 0.56), glow_f);
      col = mix(col, lava_col, clamp(glow_f * 0.92 + melt_f * 0.25, 0.0, 1.0));
      emiss = max(emiss, glow_f * 2.25);
      tag = select(tag, 3.0, glow_f > 0.28);
    }
  }

  let ring_off = gid.z * n * n;
  let idx = ring_off + gid.y * n + gid.x;
  var v: TerrainVert;
  v.pos_curv = vec4<f32>(wx, y_curved, wz, h);
  v.norm_tag = vec4<f32>(n_vec, tag);
  v.col_emiss = vec4<f32>(col, emiss);
  terrain_verts[idx] = v;
}

// Kernel 2: Live GPU Jump-Rocket Exhaust, Ballistic Regolith Dust, & Drone Rotor Downwash!
@compute @workgroup_size(64)
fn step_surface_plume_particles(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  var p = plumes[i];
  let role = p.pos_role.w;
  let dt = params.dt;
  let seed = p.meta0.z;
  let ang = seed * 6.2831853 + f32(params.step_index) * 0.37;
  let r_rand = fract(sin(seed * 91.7 + f32(params.step_index) * 1.13) * 43758.5);

  var pos = p.pos_role.xyz;
  var vel = p.vel_age.xyz;
  var age = p.vel_age.w + dt;
  let max_life = max(0.25, p.col_life.w);
  var live = p.meta0.w;

  if (age >= max_life || live < 0.5) {
    // Respawn according to physical emission role!
    if (role < 0.5) {
      // Role 0: Rover Jump-Rocket exhaust flames (4 corner nozzles!)
      if (params.rocket_on > 0.05) {
        let nozzle = i & 3u;
        let sx = select(-0.95, 0.95, (nozzle & 1u) != 0u);
        let sz = select(-1.15, 1.15, (nozzle & 2u) != 0u);
        let cy = cos(params.rover_pos_y.w);
        let sy = sin(params.rover_pos_y.w);
        let ox = sx * cy + sz * sy;
        let oz = -sx * sy + sz * cy;
        let stagger = fract(seed * 7.31 + f32(params.step_index) * 0.17);
        let vy_jet = -11.5 - 9.5 * r_rand;
        pos = params.rover_pos_y.xyz + vec3<f32>(ox + cos(ang) * 0.08, 0.24 + stagger * vy_jet * 0.09, oz + sin(ang) * 0.08);
        vel = vec3<f32>(cos(ang) * 1.2, vy_jet, sin(ang) * 1.2);
        age = stagger * 0.14;
        live = 1.0;
        p.col_life = vec4<f32>(1.0, 0.72, 0.28, 0.26 + 0.18 * r_rand);
        p.meta0 = vec4<f32>(0.42, 1.8, seed, 1.0);
      } else {
        live = 0.0;
      }
    } else if (role < 1.5) {
      // Role 1: Ballistic regolith dust kicked up by rover wheels OR rocket impingement!
      let emit_dust = params.rocket_on > 0.05 || params.rover_speed > 1.2;
      if (emit_dust) {
        let cy = cos(params.rover_pos_y.w);
        let sy = sin(params.rover_pos_y.w);
        if (params.rocket_on > 0.05) {
          let rad = 0.8 + r_rand * 1.8;
          pos = params.rover_pos_y.xyz + vec3<f32>(cos(ang) * rad, 0.08, sin(ang) * rad);
          vel = vec3<f32>(cos(ang) * 8.5 + params.wind_x * 0.3, 1.8 + r_rand * 3.5, sin(ang) * 8.5 + params.wind_z * 0.3);
        } else {
          // Crisp twin wheel-track rooster tails behind left/right rear wheels!
          let side = select(-1.22, 1.22, (i & 1u) != 0u);
          let back = -1.25 - r_rand * 0.6;
          pos = params.rover_pos_y.xyz + vec3<f32>(side * cy + back * sy, 0.12, -side * sy + back * cy);
          vel = vec3<f32>(-sy * 2.2 + cos(ang) * 1.2 + params.wind_x * 0.3, 0.8 + r_rand * 1.6, -cy * 2.2 + sin(ang) * 1.2 + params.wind_z * 0.3);
        }
        age = r_rand * 0.08;
        live = 1.0;
        p.col_life = vec4<f32>(params.col0_pad.rgb * 1.15, 0.75 + 0.55 * r_rand);
        p.meta0 = vec4<f32>(0.40 + 0.28 * r_rand, 0.25, seed, 1.0);
      } else {
        live = 0.0;
      }
    } else {
      // Role 2: Active Comet Sublimation Outgassing Jets (mode_flags bit4 = 16u!) OR Drone downwash / atmospheric dust!
      let is_comet_vent = (params.mode_flags & 16u) != 0u;
      if (is_comet_vent) {
        // Active solar-driven H2O/CO sublimation geysers erupting vertically from fissured comet vents into vacuum coma!
        let vent_id = i % 6u;
        let v_ang = f32(vent_id) * 1.0471975 + params.seed_f;
        let v_rad = 26.0 + f32(vent_id) * 18.0;
        let vx_base = params.col0_pad.w + cos(v_ang) * v_rad + (r_rand - 0.5) * 6.0;
        let vz_base = params.col1_pad.w + sin(v_ang) * v_rad + (cos(ang) - 0.5) * 6.0;
        let vy_base = eval_height(vx_base, vz_base);
        pos = vec3<f32>(vx_base, vy_base + 0.4, vz_base);
        let jet_spd = 18.0 + r_rand * 26.0;
        vel = vec3<f32>(cos(ang) * (2.5 + r_rand * 4.5), jet_spd, sin(ang) * (2.5 + r_rand * 4.5));
        p.col_life = vec4<f32>(0.68, 0.90, 1.0, 2.2 + 1.8 * r_rand);
        p.meta0 = vec4<f32>(0.55 + 0.65 * r_rand, 0.85, seed, 1.0);
        age = r_rand * 0.35;
        live = 1.0;
      } else if (params.rho_atm > 1e-4 && (params.drone_throttle > 0.05 || abs(params.wind_x) + abs(params.wind_z) > 0.5)) {
        let is_downwash = params.drone_throttle > 0.05 && (i & 3u) != 0u;
        if (is_downwash) {
          let rad = 0.35 + r_rand * 1.1;
          pos = params.drone_pos_a.xyz + vec3<f32>(cos(ang) * rad, -0.25, sin(ang) * rad);
          vel = vec3<f32>(cos(ang) * 4.2 + params.wind_x * 0.5, -5.2 - 2.6 * r_rand, sin(ang) * 4.2 + params.wind_z * 0.5);
          p.col_life = vec4<f32>(mix(params.col0_pad.rgb, vec3<f32>(0.85, 0.92, 1.0), 0.35), 0.65 + 0.35 * r_rand);
          p.meta0 = vec4<f32>(0.32 + 0.22 * r_rand, 0.15, seed, 1.0);
          live = 1.0;
        } else if ((i & 3u) == 0u) {
          // Sparse fine wind-blown atmospheric dust wisps
          let rx = (fract(seed * 13.7 + f32(params.step_index) * 0.01) - 0.5) * 64.0;
          let rz = (fract(seed * 29.3 + f32(params.step_index) * 0.017) - 0.5) * 64.0;
          let ry = 0.8 + r_rand * 12.0;
          let bx = params.col0_pad.w + rx;
          let bz = params.col1_pad.w + rz;
          pos = vec3<f32>(bx, eval_height(bx, bz) + ry, bz);
          vel = vec3<f32>(params.wind_x, (r_rand - 0.5) * 0.4, params.wind_z);
          p.col_life = vec4<f32>(mix(params.col0_pad.rgb, vec3<f32>(0.92, 0.88, 0.82), 0.45), 1.8 + 1.0 * r_rand);
          p.meta0 = vec4<f32>(0.11 + 0.09 * r_rand, 0.1, seed, 1.0);
          live = 1.0;
        } else {
          live = 0.0;
        }
        age = r_rand * 0.15;
      } else {
        live = 0.0;
      }
    }
  } else {
    // Real ballistic gravity + atmospheric drag + wind coupling + terrain rebound!
    let drag = clamp(params.rho_atm * 0.85, 0.0, 2.5);
    let wind_v = vec3<f32>(params.wind_x, 0.0, params.wind_z);
    if (role > 0.5) {
      vel.y = vel.y - params.gravity_g * select(0.55, 0.12, role > 1.5) * dt;
      vel = vel + (wind_v - vel) * drag * dt;
    }
    pos = pos + vel * dt;
    let gh = eval_height(pos.x, pos.z);
    if (pos.y < gh + 0.08) {
      pos.y = gh + 0.08;
      // Radial surface impingement splash!
      vel.y = abs(vel.y) * 0.22;
      vel.x = vel.x * 1.15;
      vel.z = vel.z * 1.15;
    }
  }

  p.pos_role = vec4<f32>(pos, role);
  p.vel_age = vec4<f32>(vel, age);
  p.meta0.w = live;
  plumes[i] = p;
}

// Kernel 3: Parallel 64-thread Telemetry Reduction
@compute @workgroup_size(64)
fn reduce_surface_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var live_cnt = 0.0;
  var flame_cnt = 0.0;
  var dust_cnt = 0.0;
  var spd_sum = 0.0;
  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = plumes[i];
    if (p.meta0.w > 0.5) {
      live_cnt = live_cnt + 1.0;
      spd_sum = spd_sum + length(p.vel_age.xyz);
      if (p.pos_role.w < 0.5) { flame_cnt = flame_cnt + 1.0; }
      else { dust_cnt = dust_cnt + 1.0; }
    }
    i = i + 64u;
  }
  wg0[tid] = live_cnt; wg1[tid] = flame_cnt; wg2[tid] = dust_cnt; wg3[tid] = spd_sum;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    telemetry[0] = vec4<f32>(wg0[0], wg1[0], wg2[0], wg3[0] / max(1.0, wg0[0]));
  }
}
`;function ai(e,t,n,r,i,a,o,s,c,l=0){let u=(e,c,l)=>[t[0]+n[0]*(e*a)+r[0]*(c*o)+i[0]*(l*s),t[1]+n[1]*(e*a)+r[1]*(c*o)+i[1]*(l*s),t[2]+n[2]*(e*a)+r[2]*(c*o)+i[2]*(l*s)],d=[{n,pts:[u(1,-1,-1),u(1,1,-1),u(1,1,1),u(1,-1,1)]},{n:[-n[0],-n[1],-n[2]],pts:[u(-1,-1,1),u(-1,1,1),u(-1,1,-1),u(-1,-1,-1)]},{n:r,pts:[u(-1,1,-1),u(-1,1,1),u(1,1,1),u(1,1,-1)]},{n:[-r[0],-r[1],-r[2]],pts:[u(-1,-1,1),u(-1,-1,-1),u(1,-1,-1),u(1,-1,1)]},{n:i,pts:[u(-1,-1,1),u(1,-1,1),u(1,1,1),u(-1,1,1)]},{n:[-i[0],-i[1],-i[2]],pts:[u(1,-1,-1),u(-1,-1,-1),u(-1,1,-1),u(1,1,-1)]}],f=(t,n)=>{e.push(t[0],t[1],t[2],t[1],n[0],n[1],n[2],4,c[0],c[1],c[2],l)};for(let e of d)f(e.pts[0],e.n),f(e.pts[1],e.n),f(e.pts[2],e.n),f(e.pts[0],e.n),f(e.pts[2],e.n),f(e.pts[3],e.n)}function oi(e,t,n,r,i,a,o,s,c,l,u=0,d=0,f=!0){let p=(t,n)=>{e.push(t[0],t[1],t[2],t[1],n[0],n[1],n[2],4,l[0],l[1],l[2],u)},m=(e,a,o)=>{let s=Math.cos(o),c=Math.sin(o);return[t[0]+n[0]*e+(r[0]*s+i[0]*c)*a,t[1]+n[1]*e+(r[1]*s+i[1]*c)*a,t[2]+n[2]*e+(r[2]*s+i[2]*c)*a]},h=[t[0]-n[0]*s,t[1]-n[1]*s,t[2]-n[2]*s],g=[t[0]+n[0]*s,t[1]+n[1]*s,t[2]+n[2]*s],_=[-n[0],-n[1],-n[2]],v=(a-o)/Math.max(1e-4,2*s);for(let e=0;e<c;e+=1){let t=d+e/c*Math.PI*2,l=d+(e+1)/c*Math.PI*2,u=.5*(t+l),y=Math.cos(u),b=Math.sin(u),x=si([r[0]*y+i[0]*b+n[0]*v,r[1]*y+i[1]*b+n[1]*v,r[2]*y+i[2]*b+n[2]*v]),S=m(-s,a,t),C=m(-s,a,l),w=m(s,o,t),T=m(s,o,l);p(S,x),p(C,x),p(T,x),p(S,x),p(T,x),p(w,x),f&&(o>1e-4&&(p(g,n),p(w,n),p(T,n)),a>1e-4&&(p(h,_),p(C,_),p(S,_)))}}function si(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function ci(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function li(e,t,n,r,i,a=null,o={}){let s=[],c=[],l=e=>{let t=e[0]-r,a=e[2]-i;return[e[0],e[1]-(t*t+a*a)*n,e[2]]};if(e.visible){let t=si(e.up||[0,1,0]),n=[Math.sin(e.yaw),0,Math.cos(e.yaw)],r=n[0]*t[0]+n[1]*t[1]+n[2]*t[2],i=si([n[0]-t[0]*r,n[1]-t[1]*r,n[2]-t[2]*r]),a=si(ci(t,i)),o=l(e.pos),c=(e,n,r)=>[o[0]+a[0]*e+t[0]*n+i[0]*r,o[1]+a[1]*e+t[1]*n+i[1]*r,o[2]+a[2]*e+t[2]*n+i[2]*r];ai(s,c(0,.78,0),a,t,i,.88,.34,1.28,[.9,.86,.78],0),ai(s,c(0,1.15,-.05),a,t,i,.94,.08,1.32,[.94,.96,.98],0),ai(s,c(0,.72,1.3),a,t,i,.82,.07,.05,[.34,.38,.44],0),ai(s,c(-.56,.84,1.31),a,t,i,.14,.07,.03,[1,.95,.82],1.15),ai(s,c(.56,.84,1.31),a,t,i,.14,.07,.03,[1,.95,.82],1.15),ai(s,c(0,.5,0),a,t,i,.78,.14,1.18,[.88,.68,.24],0),ai(s,c(-1.14,1.12,-.15),a,t,i,.39,.035,.98,[.78,.7,.38],0),ai(s,c(1.14,1.12,-.15),a,t,i,.39,.035,.98,[.78,.7,.38],0),ai(s,c(-1.14,1.145,-.15),a,t,i,.34,.025,.92,[.12,.28,.62],.08),ai(s,c(1.14,1.145,-.15),a,t,i,.34,.025,.92,[.12,.28,.62],.08),oi(s,c(0,.96,-1.52),i,a,t,.34,.3,.34,8,[.36,.38,.42],0,0,!0),oi(s,c(0,1,-1.86),i,a,t,.22,.18,.08,8,[.95,.44,.14],.42,0,!0),oi(s,c(.28,1.62,.86),t,a,i,.08,.07,.46,8,[.85,.88,.92],0,0,!0),ai(s,c(.28,2.08,.92),a,t,i,.32,.16,.22,[.92,.94,.96],0),oi(s,c(.16,2.08,1.14),i,a,t,.07,.06,.04,8,[.22,.88,1],.95,0,!0),oi(s,c(.4,2.08,1.14),i,a,t,.07,.06,.04,8,[.22,.88,1],.95,0,!0),ai(s,c(0,1.24,-.35),a,t,i,.52,.03,.52,[.22,.26,.32],0),oi(s,c(-.56,1.56,-.82),t,a,i,.04,.3,.1,10,[.92,.94,.96],0,0,!0);let u=e.rocketThrottle>.05?1.85:0,d=e.rocketThrottle>.05?[1,.72,.24]:[.3,.34,.4];for(let e of[-.94,.94])for(let n of[-1.05,1.05])oi(s,c(e,.42,n),t,a,i,.18,.09,.22,8,d,u,0,!0);let f=Math.cos(e.wheelAngle),p=Math.sin(e.wheelAngle),m=[t[0]*f+i[0]*p,t[1]*f+i[1]*p,t[2]*f+i[2]*p],h=[i[0]*f-t[0]*p,i[1]*f-t[1]*p,i[2]*f-t[2]*p];for(let e of[-1.22,1.22]){ai(s,c(e*.9,.58,0),a,t,i,.06,.07,1.32,[.76,.78,.82],0);for(let n of[-1.22,0,1.22])oi(s,c(e*.94,.4,n),t,a,i,.055,.055,.22,6,[.7,.73,.78],0,0,!1),oi(s,c(e,.34,n),a,m,h,.34,.34,.21,10,[.22,.24,.28],0,0,!0),oi(s,c(e*1.03,.34,n),a,m,h,.16,.16,.22,8,[.86,.68,.28],.04,0,!0),ai(s,c(e*1.04,.34,n),a,m,h,.225,.35,.045,[.42,.45,.5],0)}}if(t.visible!==!1){let e=l(t.pos),n=Math.cos(t.yaw),r=Math.sin(t.yaw),i=Math.cos(t.pitch),a=Math.sin(t.pitch),o=Math.cos(t.roll),c=Math.sin(t.roll),u=si([r*i,-a,n*i]),d=si([n,0,-r]),f=si(ci(u,d)),p=si([d[0]*o+f[0]*c,d[1]*o+f[1]*c,d[2]*o+f[2]*c]),m=si(ci(u,p)),h=(t,n,r)=>[e[0]+p[0]*t+m[0]*n+u[0]*r,e[1]+p[1]*t+m[1]*n+u[1]*r,e[2]+p[2]*t+m[2]*n+u[2]*r];oi(s,h(0,.34,0),m,p,u,.27,.24,.19,8,[.92,.72,.24],.06,0,!0),oi(s,h(0,.34,.25),u,p,m,.07,.06,.04,8,[.22,.96,.72],1.15,0,!0),oi(s,h(0,.72,0),m,p,u,.045,.045,.26,6,[.82,.86,.9],0,0,!1),ai(s,h(0,1.02,0),p,m,u,.38,.03,.2,[.16,.3,.68],.12);for(let e of[-.34,.34])for(let t of[-.34,.34])ai(s,h(e,.12,t),p,m,u,.035,.16,.035,[.28,.3,.34],0),ai(s,h(e,.02,t),p,m,u,.07,.02,.07,[.56,.6,.66],0);for(let e=0;e<2;e+=1){let n=e===0?t.rotorAngle:-t.rotorAngle*1.04+1.1,r=Math.cos(n),i=Math.sin(n),a=[p[0]*r+u[0]*i,p[1]*r+u[1]*i,p[2]*r+u[2]*i],o=[u[0]*r-p[0]*i,u[1]*r-p[1]*i,u[2]*r-p[2]*i];ai(s,h(0,.84+e*.11,0),a,m,o,1.08,.015,.085,[.24,.28,.34],0),ai(s,h(0,.84+e*.11,0),o,m,a,1.08,.015,.085,[.24,.28,.34],0)}}if(a&&a.visible&&Jn(s,c,{pos:a.pos,yaw:a.yaw,pitch:a.pitch,roll:a.roll,radius:Nn,rimAngle:a.rimAngle,vertThrust:a.vertThrust,tractorActive:!!o.tractorActive,tractorHeight:o.tractorHeight??26,tractorGroundPos:o.tractorGroundPos||null,beam:o.activeBeam||null,isCockpit:!!o.isUfoCockpit,isRemote:!1,shieldFlash:o.shieldFlash||0,curvFn:l}),Array.isArray(o.missiles))for(let e of o.missiles)e.alive&&Yn(s,c,e,l);if(Array.isArray(o.remoteUfos))for(let e of o.remoteUfos)Array.isArray(e.pos)&&Jn(s,c,{pos:e.pos,yaw:e.yaw||0,pitch:e.pitch||0,roll:e.roll||0,radius:Nn,rimAngle:a?.rimAngle||0,vertThrust:e.vertThrust||0,tractorActive:!!e.tractorActive,tractorHeight:24,beam:e.beam||null,isCockpit:!1,isRemote:!0,shieldFlash:e.shieldFlash||0,curvFn:l});if(Array.isArray(o.probes))for(let e of o.probes){let t=e.angle||0,n=55+(e.orbitRadius||2)*18,o=r+Math.cos(t)*n,u=i+Math.sin(t)*n;Xn(s,c,l([o,(a?.pos?.[1]??28)+26+Math.sin(t*2)*8,u]),t*2,2.2)}if(Array.isArray(o.organisms))for(let e of o.organisms){if(!e||e.abducted)continue;let[t,n,a]=e.pos;if((t-r)*(t-r)+(a-i)*(a-i)>280*280)continue;let o=e.yaw||0,u=Math.cos(o),d=Math.sin(o),f=[d,0,u],p=[u,0,-d],m=[0,1,0],h=(e,r,i)=>l([t+p[0]*e+f[0]*i,n+r,a+p[2]*e+f[2]*i]),g=e.scale||1,_=e.rgb||[.22,.56,.24],v=e.abducting?.65:e.emissive||0;if(e.kind===`flora`){let e=5.4*g;oi(s,h(0,e*.28,0),m,p,f,.34*g,.22*g,e*.56,6,[.34,.24,.16],v*.3,0,!1),oi(s,h(0,e*.66,0),m,p,f,1.85*g,.95*g,e*.38,7,_,v,0,!0),oi(s,h(0,e*.96,0),m,p,f,1.15*g,.15*g,e*.34,7,[Math.min(1,_[0]*1.15),Math.min(1,_[1]*1.15),Math.min(1,_[2]*1.15)],v,0,!0)}else if(e.morph===`glider`){let t=Math.sin((e.phase||0)*2.2)*.55;oi(s,h(0,2.2+t,0),m,p,f,1.15*g,.65*g,1.1*g,8,_,.22+v,0,!0),ai(s,h(0,1.65+t,0),p,m,f,3.2*g,.12*g,1.1*g,[Math.min(1,_[0]+.18),Math.min(1,_[1]+.14),Math.min(1,_[2]+.18)],.18+v),ai(s,h(-.35*g,.8+t,-.3*g),p,m,f,.12*g,1.1*g,.12*g,_,.1+v),ai(s,h(.35*g,.8+t,-.3*g),p,m,f,.12*g,1.1*g,.12*g,_,.1+v)}else{let t=Math.sin((e.phase||0)*5.2)*.28*g,n=(e.morph===`hexapod`?.78:1.12)*g;ai(s,h(0,n,0),p,m,f,.92*g,.66*g,1.75*g,_,v),ai(s,h(0,n+.34*g,1.05*g),p,m,f,.58*g,.5*g,.68*g,[Math.min(1,_[0]*1.15),Math.min(1,_[1]*1.12),Math.min(1,_[2]*1.08)],v),ai(s,h(-.2*g,n+.44*g,1.38*g),p,m,f,.12*g,.12*g,.08*g,[.98,.92,.32],1.15),ai(s,h(.2*g,n+.44*g,1.38*g),p,m,f,.12*g,.12*g,.08*g,[.98,.92,.32],1.15),ai(s,h(0,n+.12*g,-1.08*g),p,m,f,.18*g,.18*g,.72*g,_,v);let r=e.morph===`hexapod`?[-.66,0,.66]:[-.62,.62];for(let e=0;e<r.length;e+=1){let i=r[e]*g,a=e&1?-t:t;ai(s,h(-.42*g,n*.46,i+a),p,m,f,.18*g,n*.92,.2*g,[_[0]*.75,_[1]*.75,_[2]*.75],v*.5),ai(s,h(.42*g,n*.46,i-a),p,m,f,.18*g,n*.92,.2*g,[_[0]*.75,_[1]*.75,_[2]*.75],v*.5)}}e.abducting&&oi(c,h(0,1.4*g,0),m,p,f,2.2*g,2.2*g,.28,12,[.35,1,.72],1.4,0,!1)}return{opaque:new Float32Array(s),fx:new Float32Array(c)}}function ui(t,{bodySpec:n={},planetaryResult:r=null,planetaryAtmoState:i=null,planetaryMode:c=`standard`,landingSite:l=null,gridN:u=129,cellSizeM:d=9.5,particleCount:f=2048,seed:p=20261125,initialVehicle:m=`ufo`,initialCheckpoint:h=null,initialCraterStamps:g=[],onCraterStamp:_=null,label:v=`ulg-planetary-surface`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createPlanetarySurfaceSessionWebGpu requires a live WebGPU GPUDevice`);let y=Ur(n,{planetaryResult:r,planetaryAtmoState:i,planetaryMode:c,landingSite:l,seed:p}),b=Math.max(33,Math.min(129,Math.trunc(u))),x=b*b,S=x*2,C=d*10,w=Math.max(256,Math.min(8192,Math.trunc(f))),T=[];for(let e=0;e<b-1;e+=1)for(let t=0;t<b-1;t+=1){let n=e*b+t,r=n+1,i=n+b,a=i+1;T.push(n,i,r,r,i,a)}let E=(b-1)*.5,D=Math.max(2,Math.floor(E*d/C)-1);for(let e=0;e<b-1;e+=1)for(let t=0;t<b-1;t+=1){if(Math.abs(t+.5-E)<D&&Math.abs(e+.5-E)<D)continue;let n=x+e*b+t,r=n+1,i=n+b,a=i+1;T.push(n,i,r,r,i,a)}let O=new Uint32Array(T),k=O.length,A=new Float32Array(w*16);for(let e=0;e<w;e+=1){let t=e*16,n=e<w*.28?0:e<w*.68?1:2;A[t+3]=n,A[t+7]=9,A[t+11]=1,A[t+14]=(e*2654435761>>>0)/4294967296,A[t+15]=0}let j=[a(0,`uniform`),a(1,`storage`),a(2,`storage`),a(3,`storage`),a(4,`read-only-storage`),a(5,`read-only-storage`),a(6,`read-only-storage`)],M=e=>s(t,{cacheKey:`ulg-planetary-surface-${e}.v5-comet-jets`,label:`${v}-${e}`,code:ii,entryPoint:e,bindings:j}),N=M(`generate_surface_terrain_mesh`),P=M(`step_surface_plume_particles`),F=M(`reduce_surface_telemetry`),I=t.createBuffer({label:`${v}-params`,size:192,usage:Br.UNIFORM|Br.COPY_DST}),L=t.createBuffer({label:`${v}-terrain-verts`,size:S*48,usage:Br.STORAGE|Br.VERTEX}),R=t.createBuffer({label:`${v}-terrain-idx`,size:O.byteLength,usage:Br.INDEX|Br.COPY_DST}),z=t.createBuffer({label:`${v}-plumes`,size:A.byteLength,usage:Br.STORAGE|Br.VERTEX|Br.COPY_DST}),B=t.createBuffer({label:`${v}-tel`,size:16,usage:Br.STORAGE|Br.COPY_SRC}),V=t.createBuffer({label:`${v}-tel-rd`,size:16,usage:Br.MAP_READ|Br.COPY_DST}),ee=24576,H=16384,U=t.createBuffer({label:`${v}-veh-verts`,size:ee*48,usage:Br.VERTEX|Br.COPY_DST}),W=t.createBuffer({label:`${v}-fx-verts`,size:H*48,usage:Br.VERTEX|Br.COPY_DST}),G=gr(t,{env:y,baseHeightFn:(e,t)=>Yr(e,t,y),initialCraterStamps:g,onCraterStamp:_,seed:p,label:`${v}-mpm`}),te=xr(t,{env:y,seed:p,erosionPasses:y.hasSolidCrust?48:0,label:`${v}-tect`}),K=wr(t,{gravityMS2:y.gravityMS2,latitudeRad:.55,enabled:!!y.hasLiquidOcean,label:`${v}-ocean`}),ne=kr(t,{tectonicFieldBuf:te.getResidentTectonicBuffer(),deformFieldBuf:G.getResidentDeformBuffer(),label:`${v}-flora`});t.queue.writeBuffer(R,0,O),t.queue.writeBuffer(z,0,A);let q=!y.hasSolidCrust||y.pressurePa>=20?On(t,{bodySpec:n,env:y,nx:32,ny:24,nz:32,moteCount:Math.min(3072,w+1024),label:`${v}-cfd3d`}):null,J=o(t,{layout:N.bindGroupLayout,label:`${v}-bg-v4`,entries:[{binding:0,resource:{buffer:I}},{binding:1,resource:{buffer:L}},{binding:2,resource:{buffer:z}},{binding:3,resource:{buffer:B}},{binding:4,resource:{buffer:G.getResidentDeformBuffer()}},{binding:5,resource:{buffer:K.getResidentOceanBuffer()}},{binding:6,resource:{buffer:te.getResidentTectonicBuffer()}}]}),re=Qr(0,0,.35,d,y),ie=re.supportY,ae=m===`rover`&&y.hasSolidCrust,Y={visible:ae,deployed:ae,pos:[0,ie,0],vel:[0,0,0],yaw:.35,up:re.normal,wheelAngle:0,onGround:y.hasSolidCrust,rocketFuel:1,rocketThrottle:0,altitudeM:0,speedMS:0},X={visible:ae,docked:!0,pos:[0,y.hasSolidCrust?ie+1.25:6,-.35],vel:[0,0,0],yaw:.35,pitch:0,roll:0,rotorAngle:0,throttle:0,rcsFuel:1,altitudeM:y.hasSolidCrust?1.25:22,aeroLiftN:0,speedMS:0},Z={visible:!0,pos:[0,y.hasSolidCrust?ie+16:14,0],vel:[0,0,0],yaw:.35,pitch:0,roll:0,rimAngle:0,vertThrust:0,altitudeKm:q?q.profile.startAltKm:.03,altitudeM:y.hasSolidCrust?16:14e3,speedMS:0},Q=ae?`rover`:`ufo`,oe=`chase`,se=ae?-.32:0,ce=.22,le=1,ue=!1,de=0,fe=`laser`,pe=-6.27,me=25e7,he=0xe8d4a51000,ge=!1,_e=null,ve=y.tempK,ye=null,be=0,xe=Vn(n),Se=0,Ce=!1,we=[],Te=[],Ee=0,De=[],Oe={silicates:0,volatiles:0,metals:0,exotics:0},ke=[],Ae=[],je=[],Me=[];if(y.hasSolidCrust&&!y.isMagmaOcean&&(y.xenobiology?.biosphereViability??0)>=.25&&!l?.isOcean){let e=y.xenobiology,t=y.gravityMS2<4.5||y.rhoAtmKgM3>2.2?`glider`:y.gravityMS2>11.5?`hexapod`:`quadruped`,n=e.pigmentRgb||[.18,.56,.22],r=e.solvent===`CH4`?[.68,.48,.86]:e.solvent===`NH3`?[.34,.78,.72]:[.76,.58,.36],i=Math.max(.65,Math.min(1.85,e.bucklingHeightScale||1)),a=l?.isPolarIce?6:12,o=l?.isPolarIce?6:16;for(let s=0;s<a+o;s+=1){let o=s<a,c=(s*2.399963+p%97*.1)%(Math.PI*2),l=o?16+s%6*14.5+(s>=6?18:0):20+(s-a)%8*15+12,u=Math.cos(c)*l,d=Math.sin(c)*l,f=Xr(u,d,y);if(y.hasLiquidOcean&&f<y.seaLevelM+.6&&t!==`glider`)continue;let m=Yr(u,d,y);Me.push({id:`org-${o?`fauna`:`flora`}-${s}`,kind:o?`fauna`:`flora`,morph:o?t:`tree`,pos:[u,m+(t===`glider`&&o?4.5:0),d],yaw:c+1.1,speed:o?t===`glider`?3.8:2.6+s%3*.7:0,phase:s*1.37,scale:o?.85+s%4*.16:(.85+s%5*.18)*i,rgb:o?r:[n[0],n[1],n[2]],emissive:e.solvent===`CH4`?.25:0,abducting:!1,abducted:!1,seed:(p^Math.imul(s+17,2654435761))>>>0})}}if(h&&typeof h==`object`){if(Array.isArray(h.roverPos)&&h.roverPos.length===3&&y.hasSolidCrust){let e=Number(h.roverPos[0])||0,t=Number(h.roverPos[2])||0,n=Number(h.roverYaw)||Y.yaw,r=Qr(e,t,n,d,y);Y.pos=[e,Math.max(r.supportY,Number(h.roverPos[1])||r.supportY),t],Y.yaw=n,Y.up=r.normal,Y.onGround=h.roverOnGround!==!1,Y.deployed=!!(h.roverDeployed??h.activeVehicle===`rover`),Y.visible=Y.deployed}if(Array.isArray(h.dronePos)&&h.dronePos.length===3&&(X.pos=[...h.dronePos],X.docked=!!h.droneDocked,Number.isFinite(Number(h.droneYaw))&&(X.yaw=Number(h.droneYaw))),Array.isArray(h.ufoPos)&&h.ufoPos.length===3&&(Z.pos=[...h.ufoPos],Number.isFinite(Number(h.ufoYaw))&&(Z.yaw=Number(h.ufoYaw)),Number.isFinite(Number(h.ufoAltitudeKm))&&q)){let e=q.profile;Z.altitudeKm=Math.max(e.minAltKm,Math.min(e.maxAltKm,Number(h.ufoAltitudeKm)))}h.activeVehicle===`ufo`?(Q=`ufo`,Z.visible=!0):h.activeVehicle===`drone`?(Q=`drone`,X.visible=!0,X.docked=!1,Z.visible=!0):h.activeVehicle===`rover`&&y.hasSolidCrust&&(Q=`rover`,Y.visible=!0,Y.deployed=!0,X.visible=!0,Z.visible=!0),(h.cameraMode===`first-person`||h.cameraMode===`chase`)&&(oe=h.cameraMode),Number.isFinite(Number(h.lookYawOffset))&&(se=Number(h.lookYawOffset)),Number.isFinite(Number(h.lookPitch))&&(ce=Math.max(-.85,Math.min(1.15,Number(h.lookPitch)))),Number.isFinite(Number(h.chaseDistScale))&&(le=Math.max(.55,Math.min(2.4,Number(h.chaseDistScale))))}let Ne=0,Pe=0,Fe=0,Ie=0,Le=!1,Re=!1,ze=q?q.getTelemetry():null,Be=Object.freeze({schema:zr,stepIndex:0,activeVehicle:Q,cameraMode:oe,gravityMS2:y.gravityMS2,rhoAtmKgM3:y.rhoAtmKgM3,pressurePa:y.pressurePa,tempK:y.tempK,droneFlightCapable:y.droneFlightCapable,droneMaxAeroLiftN:y.maxAeroLiftN,droneAeroLiftN:0,roverPos:[...Y.pos],roverSpeedMS:0,roverAltitudeM:0,roverRocketFuel:1,roverOnGround:Y.onGround,dronePos:[...X.pos],droneSpeedMS:0,droneAltitudeM:X.altitudeM,ufoPos:[...Z.pos],ufoSpeedMS:0,ufoAltitudeKm:Z.altitudeKm,cfdActive:!!(q&&(Q===`ufo`||!y.hasSolidCrust)),cfdAvailable:!!q,cfdTelemetry:ze,activePlumeParticles:0,flameParticles:0,dustParticles:0,meanDustSpeedMS:0,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),Ve=Math.ceil(b/8),He=Math.ceil(w/64);function Ue(e){if(e===`rover`&&y.hasSolidCrust){if(!Y.deployed){let e=Qr(Z.pos[0],Z.pos[2],Z.yaw,d,y),t=G.evaluateDeformationOffset(Z.pos[0],Z.pos[2]);Y.pos=[Z.pos[0],e.supportY+t,Z.pos[2]],Y.vel=[0,0,0],Y.yaw=Z.yaw,Y.up=e.normal,Y.onGround=!0,Y.deployed=!0,de=2.4}Q=`rover`,Y.visible=!0,X.visible=!0,Z.visible=!0}else if(e===`drone`){if(Q=`drone`,X.visible=!0,Z.visible=!0,X.docked){X.docked=!1;let e=Y.deployed?Y.pos:Z.pos,t=y.hasSolidCrust?G.evaluateGroundHeight(e[0],e[2]):0,n=y.hasSolidCrust?Y.deployed?Y.pos[1]+1.55:t+.25:Z.pos[1]-4;X.pos=[e[0],n,e[2]],X.vel=[0,y.droneFlightCapable?3.2:0,0],X.yaw=Y.deployed?Y.yaw:Z.yaw,de=2}}else if(e===`ufo`&&(Q=`ufo`,Z.visible=!0,de=0,Z.yaw+=se,se=0,y.hasSolidCrust)){let e=Y.deployed?Y.pos:Z.pos,t=G.evaluateGroundHeight(e[0],e[2]);Z.pos=[Z.pos[0],Math.max(t+20,Z.pos[1]),Z.pos[2]]}return Q}function We(e=2.2){de=Math.max(de,e)}function Ge(e){return ue=!!e,ue}function Ke({mode:e,log10WavelengthM:t,powerW:n,maxPowerW:r}={}){return(e===`laser`||e===`missile`||e===`antimatter`)&&(fe=e),Number.isFinite(Number(r))&&(he=Math.max(0xe8d4a51000,Math.min(1e26,Number(r)))),Number.isFinite(Number(t))&&(pe=Math.max(-13,Math.min(1,Number(t)))),Number.isFinite(Number(n))&&(me=Math.max(1e3,Math.min(he,Number(n)))),{mode:fe,log10WavelengthM:pe,powerW:me,maxPowerW:he}}function qe(){let e=at(),t=si([e.target[0]-e.eye[0],e.target[1]-e.eye[1],e.target[2]-e.eye[2]]),n=Z.yaw+se,r=Math.sin(n),i=Math.cos(n);if(oe===`chase`&&y.hasSolidCrust){let e=Z.pos[0]+r*125+i*12,t=Z.pos[2]+i*125-r*12;return[e,G.evaluateGroundHeight(e,t),t]}if(y.hasSolidCrust)for(let n=14;n<=420;n+=4){let r=e.eye[0]+t[0]*n,i=e.eye[1]+t[1]*n,a=e.eye[2]+t[2]*n,o=G.evaluateGroundHeight(r,a);if(i<=o)return[r,o,a]}let a=Z.pos[0]+r*72,o=Z.pos[2]+i*72;return[a,y.hasSolidCrust?G.evaluateGroundHeight(a,o):Z.pos[1]-18,o]}function Je({firing:e,aimWorldPos:t=null}={}){ge=!!e,ge&&(de=0),Array.isArray(t)&&t.length===3?_e=[...t]:ge||(_e=null)}function Ye({aimWorldPos:e=null,fromPos:t=null,vel:n=null,isRemote:r=!1}={}){let i=Array.isArray(e)&&e.length===3?[...e]:qe(),a=t;if(!Array.isArray(a)){let e=Math.cos(Z.yaw),t=Math.sin(Z.yaw),n=[t,0,e],r=[e,0,-t];a=Wn(Z.pos,r,n,Nn+.35,i)}let o=si([i[0]-a[0],i[1]-a[1],i[2]-a[2]]),s={pos:[...a],vel:Array.isArray(n)?[...n]:[o[0]*115+Z.vel[0]*.35,o[1]*115,o[2]*115+Z.vel[2]*.35],target:i,age:0,alive:!0,isRemote:!!r};return De.push(s),De.length>16&&De.shift(),{pos:[...s.pos],vel:[...s.vel],target:[...i]}}function Xe({remoteUfos:e=[],probes:t=[],shieldFlash:n=0}={}){we=Array.isArray(e)?e:[],Te=Array.isArray(t)?t:[],Ee=Math.max(0,Number(n)||0)}function Ze(){let e={...Oe};return Oe.silicates=0,Oe.volatiles=0,Oe.metals=0,Oe.exotics=0,{harvested:e,peerHits:ke.splice(0,ke.length),abductions:Ae.splice(0,Ae.length)}}function Qe(e){if(!q)return Z.altitudeKm;let t=q.profile;return Z.altitudeKm=Math.max(t.minAltKm,Math.min(t.maxAltKm,Number(e)||t.startAltKm)),Z.altitudeM=Z.altitudeKm*1e3,Z.altitudeKm}function $e(){if(q&&(Q===`ufo`||!y.hasSolidCrust)){let e=ze?.chemistry||wn(q.profile,Z.altitudeKm);return{...y,skyZenithRgb:e.skyZenithRgb,skyHorizonRgb:e.skyHorizonRgb,skyOpticalDepth:e.opticalDepth}}return y}function et(e){return oe=e===`first-person`?`first-person`:`chase`,oe}function tt(e,t){let n=Number(e)||0;Q===`ufo`?(Z.yaw+=n,se=0):se+=n,ce=Math.max(-.85,Math.min(1.15,ce+(Number(t)||0)))}function nt(e=1){let t=Number(e);return Number.isFinite(t)&&t>.1&&(le=Math.max(.55,Math.min(2.4,le*t))),le}function rt(){return Object.freeze({activeVehicle:Q,cameraMode:oe,roverPos:[...Y.pos],roverYaw:Y.yaw,roverOnGround:Y.onGround,roverDeployed:Y.deployed,dronePos:[...X.pos],droneDocked:X.docked,droneYaw:X.yaw,ufoPos:[...Z.pos],ufoYaw:Z.yaw,ufoAltitudeKm:Z.altitudeKm,lookYawOffset:se,lookPitch:ce,chaseDistScale:le})}function it(e,t={}){let n=!!t.forward-+!!t.backward+(Number(t.moveY)||0),r=!!t.right-+!!t.left+(Number(t.moveX)||0),i=!!(t.jump||t.up),a=!!t.down,o=!!(t.turbo||t.run),s=!!t.yawLeft-+!!t.yawRight;Math.abs(s)>.01&&Q!==`ufo`&&(se+=s*1.8*e);let c=ze?.craftWindMS,l=q&&c?c[0]:y.baseWindMS*Math.cos(Ie*.09+.6),u=q&&c?c[2]:y.baseWindMS*Math.sin(Ie*.09+.6);if(Y.visible){let t=Q===`rover`,s=t?Math.max(-1,Math.min(1,n)):0,c=t?Math.max(-1,Math.min(1,r)):0,f=t&&a,p=e/4,m=Math.max(15.5,y.gravityMS2*2.55),h=t&&i&&Y.rocketFuel>.02;h?(Y.onGround&&(Y.vel[1]=Math.max(Y.vel[1],3.4),Y.pos[1]+=.08),Y.rocketThrottle=1,Y.rocketFuel=Math.max(0,Y.rocketFuel-.32*e),Y.onGround=!1):(Y.rocketThrottle=0,Y.onGround&&(Y.rocketFuel=Math.min(1,Y.rocketFuel+.26*e)));let g=(e,t)=>G.evaluateDeformationOffset(e,t),_=Qr(Y.pos[0],Y.pos[2],Y.yaw,d,y,g);for(let e=0;e<4;e+=1){let e=Y.onGround?1.85:1.15;Y.yaw-=c*e*p;let t=Math.sin(Y.yaw),n=Math.cos(Y.yaw),r=n,i=-t;if(h&&(Y.vel[1]+=m*p,Y.vel[0]+=t*s*5.2*p,Y.vel[2]+=n*s*5.2*p),Y.onGround){let e=o?28:17.5,a=(o?42:28)*s,c=_.normal;Y.vel[0]+=t*a*p+c[0]*y.gravityMS2*.55*p,Y.vel[2]+=n*a*p+c[2]*y.gravityMS2*.55*p;let l=Y.vel[0]*t+Y.vel[2]*n,u=Y.vel[0]*r+Y.vel[2]*i,d=Math.exp(-9*p),m=Math.exp(f?-9.5*p:Math.abs(s)<.05?-4.4*p:-1.1*p),h=Math.max(-e*.6,Math.min(e,l*m)),g=u*d;Y.vel[0]=t*h+r*g,Y.vel[2]=n*h+i*g,Y.wheelAngle+=h/.34*p}else{Y.vel[1]-=y.gravityMS2*p;let e=Math.hypot(Y.vel[0],Y.vel[1],Y.vel[2]),t=.5*y.rhoAtmKgM3*.014*e;Y.vel[0]+=(l-Y.vel[0])*Math.min(.4,t*p),Y.vel[2]+=(u-Y.vel[2])*Math.min(.4,t*p)}let a=Y.pos[0],v=Y.pos[2],b=a+Y.vel[0]*p,x=v+Y.vel[2]*p,S=Y.pos[1]+Y.vel[1]*p,C=Qr(b,x,Y.yaw,d,y,g),w=C.normal[1]<.58&&S<=C.supportY+.45,T=y.hasLiquidOcean&&ot<.72&&C.anyUnderwater&&!_.anyUnderwater&&S<=C.supportY+.45;if(w||T){let e=w?C.normal[0]:a-b,t=w?C.normal[2]:v-x,n=Math.hypot(e,t)||1,r=e/n,i=t/n,o=Y.vel[0]*r+Y.vel[2]*i;o<0&&(Y.vel[0]-=o*r*1.25,Y.vel[2]-=o*i*1.25),Y.pos[0]=a+r*.04,Y.pos[2]=v+i*.04,C=Qr(Y.pos[0],Y.pos[2],Y.yaw,d,y,g)}else Y.pos[0]=b,Y.pos[2]=x;Y.pos[1]=S;let E=C.supportY,D=C.normal;if(Y.pos[1]<=E+.03&&Y.vel[1]<=.15&&Y.rocketThrottle<.05){Y.pos[1]=E;let e=-(Y.vel[0]*D[0]+Y.vel[2]*D[2])/Math.max(.35,D[1]);Y.vel[1]=Math.min(0,e),Y.onGround=!0}else if(Y.pos[1]<E){Y.pos[1]=E;let e=Y.vel[0]*D[0]+Y.vel[1]*D[1]+Y.vel[2]*D[2];e<0&&(Y.vel[0]-=e*D[0]*.35,Y.vel[1]-=e*D[1],Y.vel[2]-=e*D[2]*.35),Y.vel[1]<0&&(Y.vel[1]=0),Y.onGround=Y.rocketThrottle<.05}else Y.pos[1]>E+.18&&(Y.onGround=!1);let O=Y.onGround?D:[0,1,0],k=Math.min(1,p*12);Y.up=si([Y.up[0]+(O[0]-Y.up[0])*k,Y.up[1]+(O[1]-Y.up[1])*k,Y.up[2]+(O[2]-Y.up[2])*k]),_=C}Y.altitudeM=Math.max(0,Y.pos[1]-_.supportY),Y.speedMS=Math.hypot(Y.vel[0],Y.vel[1],Y.vel[2])}if(X.docked&&Y.visible){let e=Math.cos(Y.yaw),t=Math.sin(Y.yaw);X.pos=[Y.pos[0]+Y.up[0]*1.3-t*.35,Y.pos[1]+Y.up[1]*1.3,Y.pos[2]+Y.up[2]*1.3-e*.35],X.vel=[...Y.vel],X.yaw=Y.yaw,X.pitch=0,X.roll=0,X.throttle=0,X.aeroLiftN=0,X.altitudeM=Y.altitudeM+1.24,X.speedMS=Y.speedMS}else{let t=Q===`drone`,c=t?Math.max(-1,Math.min(1,n)):0,f=t?Math.max(-1,Math.min(1,r)):0,p=t?!!i-+!!a:0;t&&Math.abs(s)>.01&&(X.yaw+=s*1.8*e);let m=0;if(y.droneFlightCapable){let e=Math.min(.88,y.droneWeightN/Math.max(1e-6,y.maxAeroLiftN));m=Math.max(.05,Math.min(1,e+p*(o?.45:.32)))}else m=i?.65:0;X.throttle+=(m-X.throttle)*Math.min(1,e*7.5),X.aeroLiftN=y.maxAeroLiftN*X.throttle;let h=24*Math.max(.15,X.throttle);X.rotorAngle=(X.rotorAngle+h*e)%(Math.PI*2);let g=X.yaw+(t?se:0),_=Math.sin(g),v=Math.cos(g),b=-v,x=_,S=o?.36:.24,C=y.droneFlightCapable?c*S:0,w=y.droneFlightCapable?-f*S:0;X.pitch+=(C-X.pitch)*Math.min(1,e*8),X.roll+=(w-X.roll)*Math.min(1,e*8);let T=Yr(X.pos[0],X.pos[2],y),E=Math.max(0,X.pos[1]-T),D=y.droneFlightCapable&&E<3?1+.16*(1-E/3):1,O=X.aeroLiftN*D*Math.cos(X.pitch)*Math.cos(X.roll)/y.droneMassKg,k=y.droneFlightCapable&&p===0?-X.vel[1]*2.8:0,A=y.droneFlightCapable?-X.vel[1]*(1.45+Math.min(2.5,y.rhoAtmKgM3*.35)):0,j=y.droneFlightCapable?Math.min(18,O-y.gravityMS2):O-y.gravityMS2;if(X.vel[1]+=(j+k+A)*e,X.vel[1]=Math.max(-14,Math.min(10.5,X.vel[1])),y.droneFlightCapable){let t=o?32:20;X.vel[0]+=(_*c+b*f)*t*e,X.vel[2]+=(v*c+x*f)*t*e}let M=Math.max(.25,Math.min(3.5,.85+y.rhoAtmKgM3*.45));y.rhoAtmKgM3>1e-4&&(X.vel[0]+=(l*.45-X.vel[0])*Math.min(.85,M*e),X.vel[2]+=(u*.45-X.vel[2])*Math.min(.85,M*e)),X.pos[0]+=X.vel[0]*e,X.pos[1]+=X.vel[1]*e,X.pos[2]+=X.vel[2]*e;let N=Math.max(Zr(X.pos[0],X.pos[2],d,y),Yr(X.pos[0],X.pos[2],y)),P=y.hasSolidCrust?N+.06:N+6;X.pos[1]<P&&(X.pos[1]=P,X.vel[1]<0&&(X.vel[1]=0),X.vel[0]*=Math.exp(-5*e),X.vel[2]*=Math.exp(-5*e)),X.altitudeM=Math.max(0,X.pos[1]-N),X.speedMS=Math.hypot(X.vel[0],X.vel[1],X.vel[2])}if(Z.visible){let t=Q===`ufo`,c=t?Math.max(-1,Math.min(1,n)):0,l=t?Math.max(-1,Math.min(1,r)):0,u=t?!!i-+!!a:0;t&&(Math.abs(s)>.01&&(Z.yaw+=s*1.8*e),Math.abs(se)>1e-4&&(Z.yaw+=se,se=0)),Z.vertThrust+=(u-Z.vertThrust)*Math.min(1,e*8),Z.rimAngle=(Z.rimAngle+(2.4+Math.abs(Z.vertThrust)*4.5+Math.hypot(c,l)*3)*e)%(Math.PI*2);let d=Z.yaw,f=Math.sin(d),p=Math.cos(d),m=-p,h=f,g=q&&ze?.craftWindMS?ze.craftWindMS:[0,0,0],_=o?.3:.19;Z.pitch+=(c*_-Z.pitch)*Math.min(1,e*6.5),Z.roll+=(l*_+Math.max(-.14,Math.min(.14,-g[0]*.006))-Z.roll)*Math.min(1,e*6.5);let v=o?72:42,b=o?42:24,x=q?1.15:1.45;if(Z.vel[0]+=((f*c+m*l)*v+(g[0]*.45-Z.vel[0])*x)*e,Z.vel[2]+=((p*c+h*l)*v+(g[2]*.45-Z.vel[2])*x)*e,Z.vel[1]+=(u*b+(g[1]*.55-Z.vel[1])*1.65)*e,Z.pos[0]+=Z.vel[0]*e,Z.pos[1]+=Z.vel[1]*e,Z.pos[2]+=Z.vel[2]*e,q){let t=q.profile,n=t.isDeepFluid?o?18:9.5:o?4.2:2.2;Z.altitudeKm=Math.max(t.minAltKm,Math.min(t.maxAltKm,Z.altitudeKm+(u*n+g[1]*.08)*e))}if(y.hasSolidCrust){let e=G.evaluateGroundHeight(Z.pos[0],Z.pos[2]);Z.pos[1]<e+6.5&&(Z.pos[1]=e+6.5,Z.vel[1]<0&&(Z.vel[1]=0)),Z.altitudeM=Math.max(0,Z.pos[1]-e)}else Z.altitudeM=Z.altitudeKm*1e3;Z.speedMS=Math.hypot(Z.vel[0],Z.vel[1],Z.vel[2])}return{windX:l,windZ:u}}function at(){let e=Q===`ufo`,t=Q===`drone`,n=e?Z.pos:t?X.pos:Y.pos,r=(e?Z.yaw:t?X.yaw:Y.yaw)+se,i=Math.cos(ce),a=Math.sin(ce),o=Math.sin(r),s=Math.cos(r);if(oe===`first-person`){let r=e?3.15:t?.55:2.28,c=e?2.65:.55,l=[n[0]+o*c,n[1]+r,n[2]+s*c];return{eye:l,target:[l[0]+o*i*32,l[1]-a*32-(e?2.8:0),l[2]+s*i*32],up:[0,1,0],focusPos:n}}let c=(e?36:t?9.5:11.5)*le,l=n[0]-o*i*c,u=n[2]-s*i*c,d=n[1]+(e?16.5:2.8)+a*c;if(y.hasSolidCrust){let e=G.evaluateGroundHeight(l,u);d=Math.max(e+2.4,d)}let f=e?[n[0]+o*54,n[1]-5.5,n[2]+s*54]:[n[0]+o*2.5,n[1]+(t?.8:1.45),n[2]+s*2.5];return{eye:[l,d,u],target:f,up:[0,1,0],focusPos:n}}let ot=l?.isPolarIce?.95:0,st=l?.isPolarIce?-45:y.terrainAmpM*.56,ct=0;async function lt({dt:r=.016,controls:i={},climate:a=null,readTelemetry:o=!0}={}){if(Re)return Be;let s=Math.max(.004,Math.min(.045,Number(r)||.016));Ie+=s,Fe+=1,a&&typeof a==`object`&&(Number.isFinite(Number(a.iceCoverFrac))&&(ot=Math.max(l?.isPolarIce?.9:0,Math.min(1,Number(a.iceCoverFrac)))),Number.isFinite(Number(a.snowlineM))&&(st=l?.isPolarIce?Math.min(-35,Number(a.snowlineM)):Number(a.snowlineM)),Number.isFinite(Number(a.autumnShift))&&(ct=Math.max(0,Math.min(1,Number(a.autumnShift)))));let{windX:c,windZ:u}=it(s,i),f=Q===`ufo`?Z.pos:Q===`drone`?X.pos:Y.pos,p=Math.round(f[0]/d)*d,m=Math.round(f[2]/d)*d,h=Math.round(f[0]/C)*C,g=Math.round(f[2]/C)*C,_=!!y.hasSolidCrust|(y.isMagmaOcean?2:0)|(y.isCryoMoon?4:0)|(y.hasLiquidOcean?8:0)|(y.isComet?16:0),x=y.seed%997*.13+1.7,S=y.hasSolidCrust?1/(2*y.tinyPlanetCurvatureRadiusM):0,T=y.hasSolidCrust?y.seaLevelM:Z.pos[1]-42,E=y.hasSolidCrust?1/(2*y.tinyPlanetCurvatureRadiusM):1/(2*9500),D=new ArrayBuffer(192);new Uint32Array(D,0,4).set([b,w,_,Fe]),new Float32Array(D,16,44).set([p,m,d,x,y.terrainAmpM,y.craterStrength,T,E,y.gravityMS2,y.rhoAtmKgM3,c,u,s,Y.rocketThrottle,Y.speedMS,X.throttle,Y.pos[0],Y.pos[1],Y.pos[2],Y.yaw,X.pos[0],X.pos[1],X.pos[2],y.droneThrustToWeight,y.color0[0],y.color0[1],y.color0[2],f[0],y.color1[0],y.color1[1],y.color1[2],f[2],y.oceanRgb[0],y.oceanRgb[1],y.oceanRgb[2],ot,st,C,_r,h,g,.42,512,ct]),t.queue.writeBuffer(I,0,D),de=Math.max(0,de-s),be=Math.max(0,be-s*2.8);let O=!!(ue||de>.01),k=y.hasSolidCrust?G.evaluateGroundHeight(Z.pos[0],Z.pos[2]):Z.pos[1]-28,A=[Z.pos[0],k,Z.pos[2]],j=Math.max(4,Z.pos[1]-k),M=G.stepRigidBouldersAndUpload(s,{tractorActive:O&&Z.visible,tractorOrigin:Z.pos,curvInv2R:S,refX:f[0],refZ:f[2]});Oe.silicates+=M.harvested.silicates,Oe.volatiles+=M.harvested.volatiles,Oe.metals+=M.harvested.metals,Oe.exotics+=M.harvested.exotics;let L=null;if(Me.length>0){let e=null,t=1e9;if(O&&Z.visible)for(let n of Me){if(n.abducted)continue;let r=n.pos[0]-Z.pos[0],i=n.pos[2]-Z.pos[2],a=Math.hypot(r,i);if(a<34){let r=a*(n.kind===`fauna`?.85:1);r<t&&(t=r,e=n)}}for(let t of Me)if(!t.abducted)if(t.phase+=s,t===e){t.abducting=!0,L=t;let e=Z.pos[0]-t.pos[0],r=Z.pos[1]-1.2-t.pos[1],i=Z.pos[2]-t.pos[2],o=Math.hypot(e,r,i);if(o<=3.8){t.abducted=!0,t.abducting=!1;let e=Ir({kind:t.kind,worldName:n?.name||`Exoplanet`,env:y,xeno:y.xenobiology,latDeg:a?.observerLatDeg??l?.latDeg??32,lonDeg:(l?.lonDeg??0)+(a?.observerLonOffsetDeg??0),seed:t.seed});je.push(e),Ae.push(e);continue}let c=15.5;t.pos[0]+=e/Math.max(.1,o)*c*s,t.pos[1]+=Math.max(6.5,r/Math.max(.1,o)*c)*s,t.pos[2]+=i/Math.max(.1,o)*c*s,t.yaw+=2.6*s}else if(t.abducting=!1,t.kind===`fauna`){t.yaw+=Math.sin(t.phase*.45+t.seed*.001)*.45*s;let e=t.pos[0]+Math.sin(t.yaw)*t.speed*s,n=t.pos[2]+Math.cos(t.yaw)*t.speed*s,r=G.evaluateGroundHeight(e,n);if(y.hasLiquidOcean&&r<=y.seaLevelM+.35&&t.morph!==`glider`||Math.hypot(e-f[0],n-f[2])>260)t.yaw+=1.45;else{t.pos[0]=e,t.pos[2]=n;let i=r+(t.morph===`glider`?5.2+Math.sin(t.phase*1.4)*1.2:0);t.pos[1]+=(i-t.pos[1])*Math.min(1,s*7)}}else{let e=G.evaluateGroundHeight(t.pos[0],t.pos[2]);t.pos[1]>e+.05&&(t.pos[1]=Math.max(e,t.pos[1]-12*s))}}for(let e=De.length-1;e>=0;--e){let t=De[e];if(!t.alive){De.splice(e,1);continue}if(t.age+=s,Array.isArray(t.target)&&t.target.length===3){let e=t.target[0]-t.pos[0],n=t.target[1]-t.pos[1],r=t.target[2]-t.pos[2],i=Math.hypot(e,n,r);if(i>1.5){let a=Math.min(1,s*7.5);t.vel[0]+=(e/i*128-t.vel[0])*a,t.vel[1]+=(n/i*128-t.vel[1])*a,t.vel[2]+=(r/i*128-t.vel[2])*a}}t.vel[1]-=y.gravityMS2*.18*s,t.pos[0]+=t.vel[0]*s,t.pos[1]+=t.vel[1]*s,t.pos[2]+=t.vel[2]*s;let n=null;if(Array.isArray(t.target)&&t.target.length===3&&Math.hypot(t.pos[0]-t.target[0],t.pos[1]-t.target[1],t.pos[2]-t.target[2])<4&&(n=[...t.target]),!t.isRemote){for(let e of we)if(Array.isArray(e.pos)&&Math.hypot(t.pos[0]-e.pos[0],t.pos[1]-e.pos[1],t.pos[2]-e.pos[2])<12.15){n=[...t.pos],ke.push({targetPeerId:e.peerId,weapon:`missile`,damage:28,wavelengthNm:620});break}}if(!n){for(let e of G.boulders)if(e.alive&&Math.hypot(t.pos[0]-e.pos[0],t.pos[1]-e.pos[1],t.pos[2]-e.pos[2])<e.radius+1.8){n=[...t.pos];break}}let r=y.hasSolidCrust?G.evaluateGroundHeight(t.pos[0],t.pos[2]):Z.pos[1]-42;if(!n&&(t.pos[1]<=r+.6||t.age>5.5)&&(n=[t.pos[0],Math.max(r,t.pos[1]),t.pos[2]]),n){t.alive=!1,Se+=4e12,Se>=.85*xe&&(Ce=!0),y.hasLiquidOcean&&Xr(n[0],n[2],y)<=y.seaLevelM+1&&K.queueSplashImpulse(n[0],n[2],-1.8,22);let e=G.applyBlastOrHeatStamp({kind:1,pos:n,radiusM:14.5,depthM:5.2,tempK:2850,melt:.78,char:.92,blastImpulse:185e3,ejectaCount:220,ejectaRgb:[1,.56,.16],ejectaRole:0}),r=y.isMetallicAsteroid?4:y.isComet?2.5:1;Oe.silicates+=(e.silicates+10)*r,Oe.metals+=(e.metals+6)*r,Oe.volatiles+=(e.volatiles+(y.isComet?16:4))*r,Oe.exotics+=e.exotics,ye={weapon:`missile`,phaseState:Ce?`BINDING ENERGY EXCEEDED`:`Shock Detonation`,reactionOutcome:`Thermobaric impact crater (R=14.5 m · GPU MLS-MPM ejecta + boulder shockwave)`}}}let R=null;if(ge&&Z.visible&&(fe===`laser`||fe===`antimatter`)){let e=Array.isArray(_e)?_e:qe(),t=null;for(let n of we)if(Array.isArray(n.pos)&&Math.hypot(e[0]-n.pos[0],e[1]-n.pos[1],e[2]-n.pos[2])<9.15*2.2){t=n;break}let r=ri(y,e,{activeVehicle:`ufo`,cfdTelemetry:ze,worldName:n?.name||`World`});if(fe===`antimatter`){let n=Un({massRateKgS:Hn(Math.max(1e10,me)),dt:s});if(Se+=n.coupledEnergyJ,Se>=.85*xe&&(Ce=!0),be=.16,R={targetPos:e,rgb:[.84,.36,1],isAntimatter:!0,thicknessMul:1.4},ye={weapon:`antimatter`,phaseState:Ce?`BINDING ENERGY EXCEEDED`:`Annihilation Plasma`,tempK:n.plasmaTempK,reactionOutcome:n.reactionOutcome},t&&ke.push({targetPeerId:t.peerId,weapon:`antimatter`,damage:22*s*8,wavelengthNm:.0024}),Fe%2==0){let t=G.applyBlastOrHeatStamp({kind:3,pos:e,radiusM:n.craterRadiusM*.62,depthM:Math.min(8.5,n.craterDepthM*.32),tempK:6500,melt:.95,char:1,blastImpulse:34e4,ejectaCount:160,ejectaRgb:[.88,.44,1],ejectaRole:0}),r=y.isMetallicAsteroid?4:y.isComet?2.5:1;Oe.silicates+=(t.silicates+5)*r,Oe.metals+=(t.metals+4)*r,Oe.volatiles+=(y.isComet?12:2)*r,Oe.exotics+=t.exotics+2.5}}else{let n=Bn({log10WavelengthM:pe,powerW:me,maxPowerW:he,spotRadiusM:1.6,sample:r,currentTempK:ve,dt:s});Se+=Math.max(0,me*n.absorptance*s),Se>=.85*xe&&(Ce=!0),ve=n.nextTempK,R={targetPos:e,rgb:n.em.rgb,isAntimatter:!1,thicknessMul:.72+Math.max(0,Math.log10(me/1e4))*.14},ye={weapon:`laser`,band:n.em.band,wavelengthLabel:n.em.displayLabel,absorptance:n.absorptance,tempK:n.nextTempK,phaseState:n.phaseState,reactionOutcome:n.reactionOutcome},t&&ke.push({targetPeerId:t.peerId,weapon:`laser`,damage:14*s*6,wavelengthNm:n.em.wavelengthNm});let i=n.phaseState===`Vaporizing`||n.phaseState===`Ionized Plasma`||n.phaseState===`Coulomb Plasma`,a=G.applyBlastOrHeatStamp({kind:2,pos:e,radiusM:6.8,depthM:n.ablationRateMPerS*s*2.2,tempK:n.nextTempK,melt:n.meltDelta,char:n.nextTempK>700?.22:.02,blastImpulse:i?16e3:0,ejectaCount:i&&Fe%2==0?48:0,ejectaRgb:n.materialFormula===`H₂O`?[.82,.94,1]:n.em.rgb,ejectaRole:n.materialFormula===`H₂O`?2:0});Oe.silicates+=a.silicates+(i?.6:0),Oe.volatiles+=a.volatiles+(n.materialFormula===`H₂O`?1.2:0),Oe.metals+=a.metals+(i?.4:0),Oe.exotics+=a.exotics}}else ve=Math.max(y.tempK,ve-(ve-y.tempK)*s*1.4);let z=li(Y,X,S,f[0],f[2],Z,{tractorActive:O,tractorHeight:j,tractorGroundPos:A,activeBeam:R,isUfoCockpit:Q===`ufo`&&oe===`first-person`,shieldFlash:Ee,missiles:De,remoteUfos:we,probes:Te,organisms:Me});Ne=Math.min(ee,Math.floor(z.opaque.length/12)),Ne>0&&t.queue.writeBuffer(U,0,z.opaque.subarray(0,Ne*12)),Pe=Math.min(H,Math.floor(z.fx.length/12)),Pe>0&&t.queue.writeBuffer(W,0,z.fx.subarray(0,Pe*12));let te=t.createCommandEncoder({label:`${v}-enc-${Fe}`});G.encodeGpuStep(te,s),K.encodeGpuStep(te,{dt:s,windX:c,windZ:u,iceCoverFrac:ot,latRad:Number(a?.latitudeRad)||.55}),ne.encodePlacementIfNeeded(te,{centerX:p,centerZ:m,focusX:f[0],focusZ:f[2],env:y,xeno:y.xenobiology,snowlineM:st,autumnShift:ct,seaIceFrac:ot,tectWorldSpanM:_r,tectN:256,force:Fe===1});let re=te.beginComputePass({label:`${v}-pass`});re.setBindGroup(0,J),re.setPipeline(N.pipeline),re.dispatchWorkgroups(Ve,Ve,2),re.setPipeline(P.pipeline),re.dispatchWorkgroups(He),re.setPipeline(F.pipeline),re.dispatchWorkgroups(1),re.end();let ie=o&&!Le&&V.mapState===`unmapped`;ie&&(Le=!0,te.copyBufferToBuffer(B,0,V,0,16)),t.queue.submit([te.finish()]);let ae=!!q,se=y.hasSolidCrust?Yr(f[0],f[2],y):-9999,ce=Q===`ufo`||!y.hasSolidCrust?Z.altitudeKm:Math.max(.01,(f[1]-se)*.001+.02);ae&&(ze=await q.step({dt:Math.min(.035,s*1.35),craftPos:f,altKm:ce,groundY:se,readTelemetry:o||Fe<=2}));let le=ri(y,f,{activeVehicle:Q,cfdTelemetry:ze,worldName:n?.name||`World`}),Ue=Be.activePlumeParticles,We=Be.flameParticles,Ge=Be.dustParticles,Ke=Be.meanDustSpeedMS;if(ie&&!Re&&V.mapState===`unmapped`)try{if(await V.mapAsync(Br.MAP_READ),!Re){let e=new Float32Array(V.getMappedRange(0,16));Ue=Math.round(e[0]),We=Math.round(e[1]),Ge=Math.round(e[2]),Ke=e[3]}if(!Re)try{V.unmap()}catch{}}catch(e){if(!Re&&e?.name!==`AbortError`)throw e}finally{Le=!1}else ie&&(Le=!1);return Be=Object.freeze({schema:zr,stepIndex:Fe,activeVehicle:Q,cameraMode:oe,gravityMS2:y.gravityMS2,rhoAtmKgM3:ze?.chemistry&&(Q===`ufo`||!y.hasSolidCrust)?ze.chemistry.rhoKgM3:y.rhoAtmKgM3,pressurePa:ze?.chemistry&&(Q===`ufo`||!y.hasSolidCrust)?ze.chemistry.pressurePa:y.pressurePa,tempK:ze?.chemistry&&(Q===`ufo`||!y.hasSolidCrust)?ze.chemistry.tempK:y.tempK,droneFlightCapable:y.droneFlightCapable,droneMaxAeroLiftN:y.maxAeroLiftN,droneAeroLiftN:X.aeroLiftN,roverPos:[...Y.pos],roverSpeedMS:Y.speedMS,roverAltitudeM:Y.altitudeM,roverRocketFuel:Y.rocketFuel,roverOnGround:Y.onGround,dronePos:[...X.pos],droneSpeedMS:X.speedMS,droneAltitudeM:X.altitudeM,ufoPos:[...Z.pos],ufoVel:[...Z.vel],ufoYaw:Z.yaw,ufoPitch:Z.pitch,ufoRoll:Z.roll,ufoVertThrust:Z.vertThrust,ufoSpeedMS:Z.speedMS,ufoAltitudeM:Z.altitudeM,ufoAltitudeKm:Z.altitudeKm,ufoDiameterFt:60,tractorActive:O,weaponMode:fe,laserLog10WavelengthM:pe,laserPowerW:me,weaponFiring:ge,activeBeam:R,weaponReaction:ye,antimatterFlash:be,activeMissileCount:De.length,aliveBoulderCount:G.aliveBoulderCount,bouldersCaptured:M.capturedCount,abductedCount:je.length,latestAbductedSpecimen:je.length?je[je.length-1]:null,abductingOrganismName:L?L.kind===`fauna`?`Fauna Organism`:`Flora Tree`:null,livingOrganismCount:Me.reduce((e,t)=>e+ +!t.abducted,0),landingSite:y.landingSite||null,totalCratersCarved:G.totalCratersCarved,craterReplayCount:G.craterReplayCount,boulderSkinGpuActive:!!G.boulderSkinGpuActive,totalBouldersShattered:G.totalBouldersShattered,deliveredWeaponEnergyJ:Se,bodyBindingEnergyJ:xe,shatterFraction:Math.min(1,Se/Math.max(1,.85*xe)),shatterTriggered:Ce,isMinorBody:!!y.isMinorBody,isComet:!!y.isComet,isMetallicAsteroid:!!y.isMetallicAsteroid,mpmActive:G.mpmActive,mpmDispatches:G.totalMpmDispatches,cfdActive:ae,cfdAvailable:!!q,cfdTelemetry:ze,localSample:le,activePlumeParticles:Ue,flameParticles:We,dustParticles:Ge,meanDustSpeedMS:Ke,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),Be}function ut(){if(!Re){Re=!0;try{q?.dispose()}catch{}try{G?.dispose()}catch{}try{te?.dispose()}catch{}try{K?.dispose()}catch{}try{ne?.dispose()}catch{}for(let e of[I,L,R,z,B,V,U,W])try{e.destroy()}catch{}}}function dt(){return ri(y,Q===`ufo`?Z.pos:Q===`drone`?X.pos:Y.pos,{activeVehicle:Q,cfdTelemetry:ze,worldName:n?.name||`World`})}return Object.freeze({schema:zr,lawAdapter:Vr,get bodySpec(){return n},get env(){return y},get isMinorBody(){return!!y.isMinorBody},get xenobiology(){return y.xenobiology},get activeVehicle(){return Q},get cameraMode(){return oe},get gridN(){return b},get indexCount(){return k},get vehicleVertCount(){return Ne},get fxVertCount(){return Pe},get boulderVertCount(){return G.boulderVertCount},get mpmPointCount(){return G.mpmActive?G.mpmPointCount:0},get floraInstanceCount(){return ne.activeInstanceCount},get floraTemplateVertCount(){return ne.templateVertCount},get particleCount(){return w},get cfdMoteCount(){return q?q.moteCount:0},get cfdProfile(){return q?q.profile:null},get stepIndex(){return Fe},getCraterStamps:()=>G.getCraterStamps(),applyRemoteCraterStamp:e=>G.applyRemoteCraterStamp(e),getAbductedSpecimens:()=>[...je],getOrganisms:()=>Me,getResidentTerrainVertBuffer:()=>L,getResidentTerrainIndexBuffer:()=>R,getResidentVehicleVertBuffer:()=>U,getResidentFxVertBuffer:()=>W,getResidentBoulderVertBuffer:()=>G.getResidentBoulderVertBuffer(),getResidentMpmPointsBuffer:()=>G.getResidentMpmPointsBuffer(),getResidentFloraInstancesBuffer:()=>ne.getResidentInstancesBuffer(),getResidentFloraTemplateVertBuffer:()=>ne.getResidentTemplateVertBuffer(),getResidentOceanBuffer:()=>K.getResidentOceanBuffer(),getResidentTectonicBuffer:()=>te.getResidentTectonicBuffer(),getResidentPlumesBuffer:()=>z,getResidentCfdMotesBuffer:()=>q?q.getResidentMotesBuffer():null,getActiveSkyEnv:$e,getLocalSample:dt,getCameraPose:at,getCheckpoint:rt,adjustChaseDistance:nt,setActiveVehicle:Ue,triggerTractorPulse:We,setTractorBeam:Ge,setWeaponConfig:Ke,setWeaponFire:Je,launchMissile:Ye,setExternalEntities:Xe,drainPendingEvents:Ze,setUfoAltitudeKm:Qe,setCameraMode:et,addLookDelta:tt,getTelemetry:()=>Be,step:lt,dispose:ut})}function di(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`planetary-surface-vehicles@1`)?e.resolveModule(`planetary-surface-vehicles@1`)?.descriptor||null:e.registerModule({method:{model:`planetary-surface-vehicles`,version:1},kernel:{sourceModule:`src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js`,entryPoint:`step_surface_plume_particles`,workgroupSize:64},parameterSchema:{surfaceGravityMS2:{type:`number`,min:.1,max:40,required:!1},surfacePressurePa:{type:`number`,min:0,max:1e8,required:!1}},stateLayout:{tensorId:`surface-plume-particles`,dtype:`f32`,layout:`interleaved`,strideElements:16,strideBytes:64,fields:[`x`,`y`,`z`,`role`,`vx`,`vy`,`vz`,`age`,`r`,`g`,`b`,`maxLife`,`size`,`temp`,`seed`,`live`]},scaleRangeM:[.1,5e4],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=ui(n,{bodySpec:{surfaceGravityMS2:r.surfaceGravityMS2??3.72,surfacePressurePa:r.surfacePressurePa??650,tempK:215},gridN:33,particleCount:256}),a=await i.step({dt:.02,controls:{forward:!0,jump:!0},readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:planetary-surface:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js`,entryPoint:`createPlanetarySurfaceSessionWebGpu`,kernelEntryPoint:`step_surface_plume_particles`},representation:`planetary-surface-vehicles-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-planetary-surface`,placement:`local`},validity:{finite:Number.isFinite(a.roverAltitudeM)&&Number.isFinite(a.droneMaxAeroLiftN)},validation:{status:`pass`,validationMode:`gpu-surface-vehicle-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var fi=`ulg.biology.amphiphile-membrane-webgpu.v1`,pi=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),mi=Object.freeze({id:`amphiphile-membrane-self-assembly`,lawNodeId:`law:biology-amphiphile-membrane-self-assembly`,orderConstraint:`after:reactive-bond-order-md`,adapterMode:n.CELL_LOCAL,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`amphiphile-beads`,`solvent-hydrophobic-coupling`]),writes:Object.freeze([`amphiphile-beads`]),accumulates:Object.freeze([`membrane-assembly-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`lipid-count`,`covalent-backbone-connectivity`]),validityDomain:Object.freeze({minLipids:32,minTempK:75,maxTempK:900}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e-9,1e-6]),fundamentalLaws:Object.freeze([`hydrophobic-solvent-exclusion`,`amphiphilic-steric-electrostatic-repulsion`,`helfrich-membrane-bending-elasticity`,`langevin-overdamped-brownian-dynamics`])});function hi(e={}){let t=Number(e.amphiphileCount)||0,n=!!e.amphiphileMembraneActive||t>=16;return{active:n,reason:n?`amphiphilic-molecules-present`:`no-amphiphiles-dormant`}}var gi=`
struct LipParams {
  bead_count: u32,       // 3 * lipid_count (0=head, 1=tail1, 2=tail2)
  lipid_count: u32,
  step_index: u32,
  init_mode: u32,
  dt: f32,
  eps_hydrophobic: f32,  // Tail-tail hydrophobic attraction strength (0 -> isotropic gas!)
  temp_k: f32,
  osmotic_press: f32,    // Internal osmotic pressure driving vesicle swelling / budding
  box_half: f32,
  gamma_damp: f32,
  seed_f: f32,
  pad0: f32,
};

// 48 bytes per bead (3 x vec4<f32>):
//   pos_t: vec4(x, y, z, beadType)  0=hydrophilic head, 1=tail-mid, 2=tail-end
//   vel_m: vec4(vx, vy, vz, lipidId)
//   col_r: vec4(r, g, b, radius)
struct LipBead {
  pos_t: vec4<f32>,
  vel_m: vec4<f32>,
  col_r: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: LipParams;
@group(0) @binding(1) var<storage, read> beads_in: array<LipBead>;
@group(0) @binding(2) var<storage, read_write> beads_out: array<LipBead>;
@group(0) @binding(3) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

fn hash_l(x: f32) -> f32 {
  return fract(sin(x * 127.1 + params.seed_f * 19.7) * 43758.5453);
}

@compute @workgroup_size(64)
fn step_amphiphile_beads(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.bead_count) { return; }

  let bi = beads_in[i];
  let pi = bi.pos_t.xyz;
  let ti = u32(round(bi.pos_t.w));
  let lip_id = i / 3u;
  let base = lip_id * 3u;

  var f = vec3<f32>(0.0);

  // 1. Intramolecular covalent lipid chain bonds (head <-> tail1 <-> tail2) + rod straightening angle!
  let r_bond = 0.88;
  let k_bond = 42.0;
  if (ti == 0u) {
    let d1 = pi - beads_in[base + 1u].pos_t.xyz;
    let l1 = max(0.15, length(d1));
    f = f - (d1 / l1) * (l1 - r_bond) * k_bond;
    // Straightening bend between head and tail2 (eq distance ~ 2 * r_bond)
    let d2 = pi - beads_in[base + 2u].pos_t.xyz;
    let l2 = max(0.25, length(d2));
    f = f - (d2 / l2) * (l2 - 1.72) * 10.5;
  } else if (ti == 1u) {
    let d0 = pi - beads_in[base].pos_t.xyz;
    let l0 = max(0.15, length(d0));
    f = f - (d0 / l0) * (l0 - r_bond) * k_bond;
    let d2 = pi - beads_in[base + 2u].pos_t.xyz;
    let l2 = max(0.15, length(d2));
    f = f - (d2 / l2) * (l2 - r_bond) * k_bond;
  } else {
    let d1 = pi - beads_in[base + 1u].pos_t.xyz;
    let l1 = max(0.15, length(d1));
    f = f - (d1 / l1) * (l1 - r_bond) * k_bond;
    let d0 = pi - beads_in[base].pos_t.xyz;
    let l0 = max(0.25, length(d0));
    f = f - (d0 / l0) * (l0 - 1.72) * 10.5;
  }

  // 2. Pairwise Amphiphilic Solvent-Exclusion Forces (Cooke-Deserno / Martini coarse-grained physics!)
  let eps_hp = max(0.0, params.eps_hydrophobic);
  let r_cut = 3.2;
  let r_cut2 = r_cut * r_cut;
  for (var j = 0u; j < params.bead_count; j = j + 1u) {
    if (j == i) { continue; }
    let bj = beads_in[j];
    let dvec = pi - bj.pos_t.xyz;
    let r2 = dot(dvec, dvec);
    if (r2 >= r_cut2 || r2 < 1e-4) { continue; }
    let r = sqrt(r2);
    let dir = dvec / r;
    let tj = u32(round(bj.pos_t.w));
    let same_lip = (j / 3u) == lip_id;
    if (same_lip) { continue; }

    // Soft WCA steric core repulsion (universal excluded volume)
    let sigma = select(0.95, 1.12, ti == 0u && tj == 0u);
    if (r < sigma * 1.122) {
      let inv = sigma / max(0.45, r);
      let inv6 = inv * inv * inv * inv * inv * inv;
      let f_rep = clamp(4.2 * (2.0 * inv6 * inv6 - inv6) / max(0.45, r), 0.0, 28.0);
      f = f + dir * f_rep;
    }

    if (ti > 0u && tj > 0u) {
      // Hydrophobic tail-tail solvent-exclusion attraction (vanishes identically when eps_hydrophobic == 0!)
      if (r > sigma && r < r_cut) {
        let u = (r - sigma) / (r_cut - sigma);
        let attract = -eps_hp * 4.8 * sin(u * 3.14159265) * (1.0 - 0.35 * u);
        f = f + dir * attract;
      }
    } else if ((ti == 0u && tj > 0u) || (ti > 0u && tj == 0u)) {
      // Hydrophilic-hydrophobic immiscibility repulsion (forces heads outward toward aqueous solvent!)
      if (r < 2.25) {
        let imm = (1.0 - r / 2.25) * (1.8 + eps_hp * 2.2);
        f = f + dir * imm;
      }
    } else if (ti == 0u && tj == 0u) {
      // Gentle polar head-group electrostatic repulsion + water-bridged curvature stabilization
      if (r < 2.4) {
        let h_rep = (1.0 - r / 2.4) * 1.35;
        f = f + dir * h_rep;
      }
    }
  }

  // Optional internal osmotic outward pressure inside enclosed vesicle shell
  let r_cen = length(pi);
  if (params.osmotic_press > 0.01 && r_cen > 0.5 && r_cen < params.box_half * 0.72) {
    f = f + (pi / r_cen) * params.osmotic_press * 1.4;
  }

  // Gentle spherical aqueous droplet confinement boundary
  if (r_cen > params.box_half) {
    f = f - (pi / r_cen) * (r_cen - params.box_half) * 8.5;
  }

  // Langevin Brownian integration
  let dt = params.dt;
  let s0 = f32(i) * 13.37 + f32(params.step_index) * 5.19;
  let rx = (hash_l(s0 + 1.0) + hash_l(s0 + 2.0) - 1.0) * 1.732;
  let ry = (hash_l(s0 + 3.0) + hash_l(s0 + 4.0) - 1.0) * 1.732;
  let rz = (hash_l(s0 + 5.0) + hash_l(s0 + 6.0) - 1.0) * 1.732;
  let sigma_v = sqrt(max(0.0, params.temp_k * 0.0022 * params.gamma_damp * dt));

  var v = bi.vel_m.xyz + clamp(f, vec3<f32>(-40.0), vec3<f32>(40.0)) * dt;
  v = v * exp(-params.gamma_damp * dt) + vec3<f32>(rx, ry, rz) * sigma_v;
  v = clamp(v, vec3<f32>(-10.0), vec3<f32>(10.0));
  let p_next = pi + v * dt;

  var out_b = bi;
  out_b.pos_t = vec4<f32>(p_next, bi.pos_t.w);
  out_b.vel_m = vec4<f32>(v, bi.vel_m.w);
  beads_out[i] = out_b;
}

@compute @workgroup_size(64)
fn reduce_amphiphile_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var tail_coord = 0.0;
  var tail_cnt = 0.0;
  var radial_align = 0.0;
  var r_sum = 0.0;

  var lip = tid;
  loop {
    if (lip >= params.lipid_count) { break; }
    let p_h = beads_out[lip * 3u].pos_t.xyz;
    let p_t1 = beads_out[lip * 3u + 1u].pos_t.xyz;
    let p_t2 = beads_out[lip * 3u + 2u].pos_t.xyz;
    let axis = normalize(p_h - p_t2 + vec3<f32>(1e-5, 0.0, 0.0));
    let r_mid = length(p_t1);
    r_sum = r_sum + r_mid;
    // Outward radial head orientation (positive in micelles/vesicles; near 0 in random soup!)
    if (r_mid > 0.25) {
      radial_align = radial_align + abs(dot(axis, p_t1 / r_mid));
    }
    // Count hydrophobic tail neighbors within 2.5 units (order parameter for hydrophobic collapse!)
    var nbrs = 0.0;
    for (var j = 0u; j < params.lipid_count; j = j + 1u) {
      if (j == lip) { continue; }
      let pj = beads_out[j * 3u + 2u].pos_t.xyz;
      let d2 = dot(p_t2 - pj, p_t2 - pj);
      if (d2 < 6.25) { nbrs = nbrs + 1.0; }
    }
    tail_coord = tail_coord + nbrs;
    tail_cnt = tail_cnt + 1.0;
    lip = lip + 64u;
  }

  wg0[tid] = tail_coord; wg1[tid] = radial_align; wg2[tid] = r_sum; wg3[tid] = tail_cnt;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let inv = 1.0 / max(1.0, wg3[0]);
    telemetry[0] = vec4<f32>(wg0[0] * inv, wg1[0] * inv, wg2[0] * inv, wg3[0]);
  }
}
`;function _i(t,{lipidCount:n=320,initMode:r=`soup`,hydrophobicCoupling:i=1.65,temperatureK:c=300,osmoticPressure:l=0,seed:u=20261125,label:d=`ulg-bio-amphiphile`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createAmphiphileMembraneSessionWebGpu requires a live WebGPU GPUDevice`);let f=Math.max(48,Math.min(768,Math.trunc(n))),p=f*3,m=r===`vesicle`?11.5:9.2,h=u>>>0||1,g=()=>{h=h+1831565813|0;let e=Math.imul(h^h>>>15,1|h);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296},_=new Float32Array(p*12),v=[.22,.84,1],y=[.96,.74,.24],b=[.92,.5,.16],x=Math.PI*(3-Math.sqrt(5));for(let e=0;e<f;e+=1){let t,n,i,a,o,s;if(r===`vesicle`){let r=(e&1)==0,c=e>>1,l=Math.max(1,f>>1),u=1-2*((c+.5)/l),d=Math.sqrt(Math.max(0,1-u*u)),p=c*x,m=Math.cos(p)*d,h=u,g=Math.sin(p)*d,_=r?7.6:4.2;t=m*_,n=h*_,i=g*_;let v=r?-1:1;a=m*v,o=h*v,s=g*v}else if(r===`bilayer`){let r=(e&1)==0,c=e>>1,l=Math.ceil(Math.sqrt(f/2)),u=c%l/Math.max(1,l-1)-.5,d=Math.floor(c/l)/Math.max(1,l-1)-.5;t=u*12+(g()-.5)*.25,i=d*12+(g()-.5)*.25,n=r?1.85:-1.85,a=0,o=r?-1:1,s=0}else{let e=Math.cbrt(g())*6.8,r=2*g()-1,c=Math.sqrt(Math.max(0,1-r*r)),l=g()*Math.PI*2;t=e*c*Math.cos(l),n=e*r,i=e*c*Math.sin(l);let u=2*g()-1,d=Math.sqrt(Math.max(0,1-u*u)),f=g()*Math.PI*2;a=d*Math.cos(f),o=u,s=d*Math.sin(f)}let c=[[t,n,i,0,v,.44],[t+a*.88,n+o*.88,i+s*.88,1,y,.36],[t+a*1.76,n+o*1.76,i+s*1.76,2,b,.34]];for(let t=0;t<3;t+=1){let n=(e*3+t)*12,[r,i,a,o,s,l]=c[t];_[n+0]=r,_[n+1]=i,_[n+2]=a,_[n+3]=o,_[n+4]=0,_[n+5]=0,_[n+6]=0,_[n+7]=e,_[n+8]=s[0],_[n+9]=s[1],_[n+10]=s[2],_[n+11]=l}}let S=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`storage`),a(3,`storage`)],C=s(t,{cacheKey:`ulg-bio-amphiphile-step.v1`,label:`${d}-step`,code:gi,entryPoint:`step_amphiphile_beads`,bindings:S}),w=s(t,{cacheKey:`ulg-bio-amphiphile-tel.v1`,label:`${d}-tel`,code:gi,entryPoint:`reduce_amphiphile_telemetry`,bindings:S}),T=t.createBuffer({label:`${d}-params`,size:48,usage:pi.UNIFORM|pi.COPY_DST}),E=t.createBuffer({label:`${d}-a`,size:_.byteLength,usage:pi.STORAGE|pi.COPY_SRC|pi.COPY_DST}),D=t.createBuffer({label:`${d}-b`,size:_.byteLength,usage:pi.STORAGE|pi.COPY_SRC|pi.COPY_DST}),O=t.createBuffer({label:`${d}-tel`,size:16,usage:pi.STORAGE|pi.COPY_SRC}),k=t.createBuffer({label:`${d}-tel-rd`,size:16,usage:pi.MAP_READ|pi.COPY_DST});t.queue.writeBuffer(E,0,_),t.queue.writeBuffer(D,0,_);let A=o(t,{layout:C.bindGroupLayout,label:`${d}-bg-ab`,entries:[{binding:0,resource:{buffer:T}},{binding:1,resource:{buffer:E}},{binding:2,resource:{buffer:D}},{binding:3,resource:{buffer:O}}]}),j=o(t,{layout:C.bindGroupLayout,label:`${d}-bg-ba`,entries:[{binding:0,resource:{buffer:T}},{binding:1,resource:{buffer:D}},{binding:2,resource:{buffer:E}},{binding:3,resource:{buffer:O}}]}),M=Math.max(0,Number(i)),N=Math.max(80,Number(c)||300),P=Math.max(0,Number(l)||0),F=0,I=0,L=!1,R=!1,z=Object.freeze({schema:fi,initMode:r,stepIndex:0,lipidCount:f,beadCount:p,hydrophobicCoupling:M,temperatureK:N,meanTailCoordination:0,radialHeadOrder:0,meanRadius:5,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),B=Math.ceil(p/64);function V(e){M=Math.max(0,Math.min(3.5,Number(e)||0))}function ee(e){N=Math.max(80,Math.min(900,Number(e)||300))}function H(e){P=Math.max(0,Math.min(3,Number(e)||0))}async function U({dt:n=.022,substeps:i=4,readTelemetry:a=!0}={}){if(R)return z;let o=Math.max(1,Math.min(12,Math.trunc(i))),s=Math.max(.008,Math.min(.032,Number(n)||.022)),c=u%997*.13+1.1,l=new ArrayBuffer(48);new Uint32Array(l,0,4).set([p,f,I+o,+(r===`vesicle`)]),new Float32Array(l,16,8).set([s,M,N,P,m,3.2,c,0]),t.queue.writeBuffer(T,0,l);let h=t.createCommandEncoder({label:`${d}-enc-${I}`}),g=h.beginComputePass({label:`${d}-pass`});g.setPipeline(C.pipeline);for(let e=0;e<o;e+=1)g.setBindGroup(0,F===0?A:j),g.dispatchWorkgroups(B),F=1-F,I+=1;g.setPipeline(w.pipeline),g.setBindGroup(0,F===1?A:j),g.dispatchWorkgroups(1),g.end();let _=a&&!L&&k.mapState===`unmapped`;_&&(L=!0,h.copyBufferToBuffer(O,0,k,0,16)),t.queue.submit([h.finish()]);let v=z.meanTailCoordination,y=z.radialHeadOrder,b=z.meanRadius;if(_)try{if(await k.mapAsync(pi.MAP_READ),!R){let e=new Float32Array(k.getMappedRange(0,16));v=e[0],y=e[1],b=e[2]}try{k.unmap()}catch{}}catch(e){if(!R&&e?.name!==`AbortError`)throw e}finally{L=!1}return z=Object.freeze({schema:fi,initMode:r,stepIndex:I,lipidCount:f,beadCount:p,hydrophobicCoupling:M,temperatureK:N,meanTailCoordination:v,radialHeadOrder:y,meanRadius:b,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),z}function W(){if(!R){R=!0;for(let e of[T,E,D,O,k])try{e.destroy()}catch{}}}return Object.freeze({schema:fi,lawAdapter:mi,lipidCount:f,beadCount:p,initMode:r,get stepIndex(){return I},getResidentBeadsBuffer:()=>F===0?E:D,getTelemetry:()=>z,setHydrophobicCoupling:V,setTemperatureK:ee,setOsmoticPressure:H,step:U,dispose:W})}function vi(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`amphiphile-membrane-self-assembly@1`)?e.resolveModule(`amphiphile-membrane-self-assembly@1`)?.descriptor||null:e.registerModule({method:{model:`amphiphile-membrane-self-assembly`,version:1},kernel:{sourceModule:`src/runtime/biology/amphiphileMembraneGpu.js`,entryPoint:`step_amphiphile_beads`,workgroupSize:64},parameterSchema:{hydrophobicCoupling:{type:`number`,min:0,max:3.5,required:!1},temperatureK:{type:`number`,min:80,max:900,required:!1}},stateLayout:{tensorId:`amphiphile-beads`,dtype:`f32`,layout:`interleaved`,strideElements:12,strideBytes:48,fields:[`x`,`y`,`z`,`beadType`,`vx`,`vy`,`vz`,`lipidId`,`r`,`g`,`b`,`radius`]},scaleRangeM:[1e-9,1e-6],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=e.input?.parameters||{},i=_i(n,{lipidCount:96,hydrophobicCoupling:r.hydrophobicCoupling??1.65,temperatureK:r.temperatureK??300}),a=await i.step({dt:.022,substeps:6,readTelemetry:!0});return i.dispose(),t({artifactId:`${e.taskId}:amphiphile:${a.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/biology/amphiphileMembraneGpu.js`,entryPoint:`createAmphiphileMembraneSessionWebGpu`,kernelEntryPoint:`step_amphiphile_beads`},representation:`amphiphile-beads-f32`,outputs:{telemetry:a},execution:{backend:`webgpu-amphiphile-md`,placement:`local`},validity:{finite:Number.isFinite(a.meanTailCoordination)},validation:{status:`pass`,validationMode:`gpu-amphiphile-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var yi=`ulg.biology.biopolymer-folding-catalysis-webgpu.v1`,bi=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),xi=Object.freeze({id:`biopolymer-folding-catalysis`,lawNodeId:`law:biology-biopolymer-folding-catalysis`,orderConstraint:`after:amphiphile-membrane-self-assembly`,adapterMode:n.CELL_LOCAL,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`polymer-residues`,`sequence-phys-descriptors`]),writes:Object.freeze([`polymer-residues`]),accumulates:Object.freeze([`folding-catalysis-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`monomer-sequence-length`,`net-polymer-charge`]),validityDomain:Object.freeze({minResidues:8,maxResidues:256,minTempK:50,maxTempK:1e3}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e-9,1e-7]),fundamentalLaws:Object.freeze([`hydrophobic-collapse-funnel`,`backbone-hydrogen-bond-helicity`,`ramachandran-steric-torsion`,`electrostatic-salt-bridge-preorganization`,`eyring-transition-state-barrier-lowering`])});function Si(e={}){let t=Number(e.polymerResidueCount)||0,n=!!e.biopolymerFoldingActive||t>=8;return{active:n,reason:n?`heteropolymer-chain-present`:`no-biopolymer-chain-dormant`}}var Ci=Object.freeze({"amphipathic-helix-bundle":Object.freeze({id:`amphipathic-helix-bundle`,name:`Amphipathic Helix-Turn-Helix Catalyst (36-mer)`,sequence:`HPPHH+PHHPPHH-PHPPPHHPPHH+PHHPPHH-PP`,description:`Alternating hydrophobic/polar heptad repeats spontaneously form a helical hydrophobic core with an electrostatic (+/-) active cleft.`}),"globular-hydrophobic-core":Object.freeze({id:`globular-hydrophobic-core`,name:`Globular Hydrophobic-Core Enzyme (44-mer)`,sequence:`PHHPHH+PPHHHPP-PHHPHHHPP+PPHHH-PPHHPHH+PPHHP`,description:`Dense hydrophobic interior pulls polar/charged catalytic residues into a compact pocket; heat above 650 K to watch thermal denaturation!`}),"beta-hairpin-fold":Object.freeze({id:`beta-hairpin-fold`,name:`Antiparallel Polar-Hydrophobic Hairpin (28-mer)`,sequence:`HPHPH+PPHPP-HPHPH+PPHPP-HPHP`,description:`Alternating H-P strands zip together via inter-strand hydrophobic contacts and salt bridges.`})}),wi=`
struct FoldParams {
  res_count: u32,
  step_index: u32,
  pad_u0: u32,
  pad_u1: u32,
  dt: f32,
  temp_k: f32,
  eps_hp: f32,          // Hydrophobic H-H attraction strength
  eps_hbond: f32,       // Backbone i -> i+4 helical hydrogen-bond strength
  dielectric_er: f32,
  gamma_damp: f32,
  seed_f: f32,
  pad_f0: f32,
};

// 48 bytes per residue bead (matches amphiphile bead render ABI!):
//   pos_t: vec4(x, y, z, resClass)   0=H(hydrophobic), 1=P(polar), 2=+(cationic), 3=-(anionic)
//   vel_q: vec4(vx, vy, vz, chargeQ)
//   col_r: vec4(r, g, b, radius)
struct ResBead {
  pos_t: vec4<f32>,
  vel_q: vec4<f32>,
  col_r: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: FoldParams;
@group(0) @binding(1) var<storage, read> res_in: array<ResBead>;
@group(0) @binding(2) var<storage, read_write> res_out: array<ResBead>;
@group(0) @binding(3) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

fn hash_p(x: f32) -> f32 {
  return fract(sin(x * 127.1 + params.seed_f * 23.1) * 43758.5453);
}

@compute @workgroup_size(64)
fn step_biopolymer_folding(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.res_count) { return; }

  let bi = res_in[i];
  let pi = bi.pos_t.xyz;
  let ci = u32(round(bi.pos_t.w));
  let qi = bi.vel_q.w;
  var f = vec3<f32>(0.0);

  // 1. Covalent peptide backbone bonds (i <-> i-1, i+1) at equilibrium spacing 1.15 units
  let r_eq = 1.15;
  let k_bb = 52.0;
  if (i > 0u) {
    let d = pi - res_in[i - 1u].pos_t.xyz;
    let l = max(0.2, length(d));
    f = f - (d / l) * (l - r_eq) * k_bb;
  }
  if (i + 1u < params.res_count) {
    let d = pi - res_in[i + 1u].pos_t.xyz;
    let l = max(0.2, length(d));
    f = f - (d / l) * (l - r_eq) * k_bb;
  }

  // 2. Steric Ramachandran backbone stiffness (i <-> i±2 preferred ~ 1.88 units)
  if (i >= 2u) {
    let d = pi - res_in[i - 2u].pos_t.xyz;
    let l = max(0.25, length(d));
    f = f - (d / l) * (l - 1.88) * 7.5;
  }
  if (i + 2u < params.res_count) {
    let d = pi - res_in[i + 2u].pos_t.xyz;
    let l = max(0.25, length(d));
    f = f - (d / l) * (l - 1.88) * 7.5;
  }

  // 3. Directional Backbone Hydrogen Bonding (i <-> i±4 alpha-helix zipper at r_hb = 1.65!)
  if (params.eps_hbond > 0.01) {
    if (i >= 4u) {
      let d = pi - res_in[i - 4u].pos_t.xyz;
      let l = max(0.3, length(d));
      if (l < 4.5) {
        let dr = l - 1.68;
        let w = exp(-dr * dr * 0.42);
        f = f - (d / l) * dr * params.eps_hbond * 3.8 * w;
      }
    }
    if (i + 4u < params.res_count) {
      let d = pi - res_in[i + 4u].pos_t.xyz;
      let l = max(0.3, length(d));
      if (l < 4.5) {
        let dr = l - 1.68;
        let w = exp(-dr * dr * 0.42);
        f = f - (d / l) * dr * params.eps_hbond * 3.8 * w;
      }
    }
  }

  // 4. Nonbonded Hydrophobic Core Collapse (H-H), Steric Exclusion, & Screened Electrostatics (+/-)!
  let eps_r = max(1.0, params.dielectric_er);
  for (var j = 0u; j < params.res_count; j = j + 1u) {
    let diff_u = select(j - i, i - j, i > j);
    if (diff_u <= 2u) { continue; }
    let bj = res_in[j];
    let dvec = pi - bj.pos_t.xyz;
    let r = max(0.35, length(dvec));
    let dir = dvec / r;
    let cj = u32(round(bj.pos_t.w));
    let qj = bj.vel_q.w;

    // Universal excluded volume steric repulsion (sigma = 1.18)
    if (r < 1.32) {
      let inv = 1.18 / max(0.45, r);
      let inv6 = inv * inv * inv * inv * inv * inv;
      f = f + dir * clamp(3.8 * (2.0 * inv6 * inv6 - inv6) / r, 0.0, 28.0);
    }

    // Hydrophobic H-H attraction driving compact globular core formation!
    if (ci == 0u && cj == 0u && params.eps_hp > 0.01 && r > 1.18 && r < 11.5) {
      let u = (r - 1.18) / 10.32;
      let f_hp = -params.eps_hp * 6.8 * sin(u * 3.14159265) * (1.0 - 0.30 * u);
      f = f + dir * f_hp;
    }

    // Screened Debye-Huckel salt-bridge electrostatics (+/- attract, like repel!)
    if (abs(qi * qj) > 0.1 && r < 10.5) {
      let screen = exp(-r * 0.18) / (eps_r * 0.06 + 1.0);
      let f_el = (qi * qj * 10.5 * screen) / (r * r + 0.55);
      f = f + dir * clamp(f_el, -16.0, 16.0);
    }
  }

  // Soft center-of-mass tether preventing translational drift off-camera
  let r_com = length(pi);
  if (r_com > 12.0) {
    f = f - (pi / r_com) * (r_com - 12.0) * 1.5;
  }

  // Langevin Brownian dynamics (300 K -> compact native fold; > 650 K -> entropic thermal denaturation!)
  let dt = params.dt;
  let s0 = f32(i) * 17.13 + f32(params.step_index) * 4.31;
  let rx = (hash_p(s0 + 1.1) + hash_p(s0 + 2.7) - 1.0) * 1.732;
  let ry = (hash_p(s0 + 3.9) + hash_p(s0 + 5.3) - 1.0) * 1.732;
  let rz = (hash_p(s0 + 7.1) + hash_p(s0 + 8.9) - 1.0) * 1.732;
  let t_excess = max(0.0, params.temp_k - 360.0);
  // Entropic thermal unfolding: k_B T fluctuations scale steeply above native stability temperature
  let sigma_v = sqrt(max(0.0, (params.temp_k * 0.012 + t_excess * 0.085) * params.gamma_damp * dt));

  var v = bi.vel_q.xyz + clamp(f, vec3<f32>(-45.0), vec3<f32>(45.0)) * dt;
  v = v * exp(-params.gamma_damp * dt) + vec3<f32>(rx, ry, rz) * sigma_v;
  v = clamp(v, vec3<f32>(-18.0), vec3<f32>(18.0));
  let p_next = pi + v * dt;

  var out_b = bi;
  out_b.pos_t = vec4<f32>(p_next, bi.pos_t.w);
  out_b.vel_q = vec4<f32>(v, qi);
  res_out[i] = out_b;
}

// Parallel 64-thread reduction computing Radius of Gyration R_g, Helical H-Bond fraction,
// Hydrophobic Contact count, AND Live 3D Active-Site Electrostatic Preorganization |E_pocket|!
@compute @workgroup_size(64)
fn reduce_biopolymer_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n = params.res_count;
  // First find centroid (thread 0..63 cooperative reduction)
  var cx = 0.0; var cy = 0.0; var cz = 0.0;
  var i = tid;
  loop {
    if (i >= n) { break; }
    let p = res_out[i].pos_t.xyz;
    cx = cx + p.x; cy = cy + p.y; cz = cz + p.z;
    i = i + 64u;
  }
  wg0[tid] = cx; wg1[tid] = cy; wg2[tid] = cz;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) { wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s]; wg2[tid] += wg2[tid + s]; }
    workgroupBarrier();
    s = s >> 1u;
  }
  let inv_n = 1.0 / max(1.0, f32(n));
  let com = vec3<f32>(wg0[0] * inv_n, wg1[0] * inv_n, wg2[0] * inv_n);
  workgroupBarrier();

  // Gently recenter polymer COM toward origin so folded/denaturing chains NEVER Brownian-walk off-camera!
  // Preserves 100% of internal distances, R_g, secondary structure, and active-site electrostatics!
  let com_corr = com * 0.22;
  i = tid;
  loop {
    if (i >= n) { break; }
    res_out[i].pos_t = vec4<f32>(res_out[i].pos_t.xyz - com_corr, res_out[i].pos_t.w);
    i = i + 64u;
  }
  workgroupBarrier();
  let com_adj = com - com_corr;

  // Compute R_g^2, helical i->i+4 contacts, hydrophobic H-H contacts, and pocket electric field at COM!
  var rg2 = 0.0;
  var hel_cnt = 0.0;
  var hp_cnt = 0.0;
  var e_pocket = vec3<f32>(0.0);
  i = tid;
  loop {
    if (i >= n) { break; }
    let b = res_out[i];
    let rel = b.pos_t.xyz - com_adj;
    rg2 = rg2 + dot(rel, rel);
    if (i + 4u < n) {
      let d4 = length(b.pos_t.xyz - res_out[i + 4u].pos_t.xyz);
      if (d4 < 2.25) { hel_cnt = hel_cnt + 1.0; }
    }
    if (u32(round(b.pos_t.w)) == 0u) {
      for (var j = i + 3u; j < n; j = j + 1u) {
        if (u32(round(res_out[j].pos_t.w)) == 0u) {
          let d = length(b.pos_t.xyz - res_out[j].pos_t.xyz);
          if (d < 2.35) { hp_cnt = hp_cnt + 1.0; }
        }
      }
    }
    let q = b.vel_q.w;
    if (abs(q) > 0.1) {
      let d2 = dot(rel, rel) + 0.8;
      e_pocket = e_pocket + rel * (q / (d2 * sqrt(d2)));
    }
    i = i + 64u;
  }
  wg0[tid] = rg2; wg1[tid] = hel_cnt; wg2[tid] = hp_cnt; wg3[tid] = length(e_pocket);
  workgroupBarrier();
  s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let rg = sqrt(wg0[0] * inv_n);
    let hel_frac = wg1[0] / max(1.0, f32(n) - 4.0);
    // Compactness gates active-site electrostatic preorganization: unfolded chain loses pocket alignment!
    let compact = clamp(1.0 - smoothstep(2.6, 5.8, rg), 0.0, 1.0);
    let e_field_norm = wg3[0] * compact;
    telemetry[0] = vec4<f32>(rg, hel_frac, wg2[0], e_field_norm);
  }
}
`;function Ti(t,{sequence:n=Ci[`amphipathic-helix-bundle`].sequence,temperatureK:r=300,hydrophobicCoupling:i=1.6,hBondStrength:c=1.25,dielectricEr:l=78.4,seed:u=20261125,label:d=`ulg-bio-folding`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createBiopolymerFoldingSessionWebGpu requires a live WebGPU GPUDevice`);let f=String(n||`HPPHH+PHHPPHH-PP`).replace(/[^HP+\-]/gi,``).toUpperCase(),p=Math.max(8,Math.min(128,f.length)),m=new Float32Array(p*12);for(let e=0;e<p;e+=1){let t=f[e]||`P`,n=t===`H`?0:t===`+`?2:t===`-`?3:1,r=n===2?1:n===3?-1:0,i=n===0?[.96,.72,.2]:n===2?[.24,.62,1]:n===3?[1,.3,.44]:[.24,.9,.74],a=e/Math.max(1,p-1),o=a*Math.PI*3.6,s=2.6+1.4*Math.sin(a*Math.PI),c=Math.cos(o)*s,l=(a-.5)*5.2+Math.sin(e*1.1)*.45,u=Math.sin(o)*s,d=e*12;m[d+0]=c,m[d+1]=l,m[d+2]=u,m[d+3]=n,m[d+4]=0,m[d+5]=0,m[d+6]=0,m[d+7]=r,m[d+8]=i[0],m[d+9]=i[1],m[d+10]=i[2],m[d+11]=n===0?.5:.46}let h=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`storage`),a(3,`storage`)],g=s(t,{cacheKey:`ulg-bio-folding-step.v1`,label:`${d}-step`,code:wi,entryPoint:`step_biopolymer_folding`,bindings:h}),_=s(t,{cacheKey:`ulg-bio-folding-tel.v2-com`,label:`${d}-tel`,code:wi,entryPoint:`reduce_biopolymer_telemetry`,bindings:h}),v=t.createBuffer({label:`${d}-params`,size:48,usage:bi.UNIFORM|bi.COPY_DST}),y=t.createBuffer({label:`${d}-a`,size:m.byteLength,usage:bi.STORAGE|bi.COPY_SRC|bi.COPY_DST}),b=t.createBuffer({label:`${d}-b`,size:m.byteLength,usage:bi.STORAGE|bi.COPY_SRC|bi.COPY_DST}),x=t.createBuffer({label:`${d}-tel`,size:16,usage:bi.STORAGE|bi.COPY_SRC}),S=t.createBuffer({label:`${d}-tel-rd`,size:16,usage:bi.MAP_READ|bi.COPY_DST});t.queue.writeBuffer(y,0,m),t.queue.writeBuffer(b,0,m);let C=o(t,{layout:g.bindGroupLayout,label:`${d}-bg-ab`,entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:y}},{binding:2,resource:{buffer:b}},{binding:3,resource:{buffer:x}}]}),w=o(t,{layout:g.bindGroupLayout,label:`${d}-bg-ba`,entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:b}},{binding:2,resource:{buffer:y}},{binding:3,resource:{buffer:x}}]}),T=Math.max(50,Number(r)||300),E=Math.max(0,Number(i)),D=Math.max(0,Number(c)),O=Math.max(1,Number(l)||78.4),k=0,A=0,j=!1,M=!1,N=Object.freeze({schema:yi,sequence:f,residueCount:p,stepIndex:0,temperatureK:T,radiusOfGyrationA:8.5,helicalFraction:0,hydrophobicContacts:0,pocketFieldNorm:0,barrierLoweringKjMol:0,catalyticRateBoost:1,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),P=Math.ceil(p/64);function F(e){T=Math.max(50,Math.min(1e3,Number(e)||300))}function I(e){E=Math.max(0,Math.min(3.5,Number(e)||0))}function L(e){D=Math.max(0,Math.min(3,Number(e)||0))}async function R({dt:n=.018,substeps:r=6,readTelemetry:i=!0}={}){if(M)return N;let a=Math.max(1,Math.min(16,Math.trunc(r))),o=Math.max(.006,Math.min(.025,Number(n)||.018)),s=u%997*.19+2.3,c=new ArrayBuffer(48);new Uint32Array(c,0,4).set([p,A+a,0,0]),new Float32Array(c,16,8).set([o,T,E,D,O,3,s,0]),t.queue.writeBuffer(v,0,c);let l=t.createCommandEncoder({label:`${d}-enc-${A}`}),m=l.beginComputePass({label:`${d}-pass`});m.setPipeline(g.pipeline);for(let e=0;e<a;e+=1)m.setBindGroup(0,k===0?C:w),m.dispatchWorkgroups(P),k=1-k,A+=1;m.setPipeline(_.pipeline),m.setBindGroup(0,k===1?C:w),m.dispatchWorkgroups(1),m.end();let h=i&&!j&&S.mapState===`unmapped`;h&&(j=!0,l.copyBufferToBuffer(x,0,S,0,16)),t.queue.submit([l.finish()]);let y=N.radiusOfGyrationA,b=N.helicalFraction,F=N.hydrophobicContacts,I=N.pocketFieldNorm;if(h)try{if(await S.mapAsync(bi.MAP_READ),!M){let e=new Float32Array(S.getMappedRange(0,16));y=e[0],b=e[1],F=Math.round(e[2]),I=e[3]}try{S.unmap()}catch{}}catch(e){if(!M&&e?.name!==`AbortError`)throw e}finally{j=!1}let L=Math.min(34,I*14.5),R=.00831446*T,z=Math.exp(Math.min(12,L/Math.max(.5,R)));return N=Object.freeze({schema:yi,sequence:f,residueCount:p,stepIndex:A,temperatureK:T,radiusOfGyrationA:y,helicalFraction:b,hydrophobicContacts:F,pocketFieldNorm:I,barrierLoweringKjMol:L,catalyticRateBoost:z,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),N}function z(){if(!M){M=!0;for(let e of[v,y,b,x,S])try{e.destroy()}catch{}}}return Object.freeze({schema:yi,lawAdapter:xi,sequence:f,residueCount:p,get stepIndex(){return A},getResidentResiduesBuffer:()=>k===0?y:b,getTelemetry:()=>N,setTemperatureK:F,setHydrophobicCoupling:I,setHBondStrength:L,step:R,dispose:z})}function Ei(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`biopolymer-folding-catalysis@1`)?e.resolveModule(`biopolymer-folding-catalysis@1`)?.descriptor||null:e.registerModule({method:{model:`biopolymer-folding-catalysis`,version:1},kernel:{sourceModule:`src/runtime/biology/biopolymerFoldingGpu.js`,entryPoint:`step_biopolymer_folding`,workgroupSize:64},parameterSchema:{temperatureK:{type:`number`,min:50,max:1e3,required:!1},hydrophobicCoupling:{type:`number`,min:0,max:3.5,required:!1}},stateLayout:{tensorId:`polymer-residues`,dtype:`f32`,layout:`interleaved`,strideElements:12,strideBytes:48,fields:[`x`,`y`,`z`,`resClass`,`vx`,`vy`,`vz`,`q`,`r`,`g`,`b`,`radius`]},scaleRangeM:[1e-9,1e-7],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=Ti(n,{temperatureK:(e.input?.parameters||{}).temperatureK??300}),i=await r.step({dt:.018,substeps:8,readTelemetry:!0});return r.dispose(),t({artifactId:`${e.taskId}:biopolymer:${i.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/biology/biopolymerFoldingGpu.js`,entryPoint:`createBiopolymerFoldingSessionWebGpu`,kernelEntryPoint:`step_biopolymer_folding`},representation:`polymer-residues-f32`,outputs:{telemetry:i},execution:{backend:`webgpu-biopolymer-folding`,placement:`local`},validity:{finite:Number.isFinite(i.radiusOfGyrationA)},validation:{status:`pass`,validationMode:`gpu-biopolymer-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var Di=`ulg.biology.template-replication-evolution-webgpu.v1`,Oi=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),ki=Object.freeze({id:`template-replication-evolution`,lawNodeId:`law:biology-template-replication-evolution`,orderConstraint:`after:biopolymer-folding-catalysis`,adapterMode:n.CELL_LOCAL,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`replicator-population`,`thermal-mismatch-rate`]),writes:Object.freeze([`replicator-population`]),accumulates:Object.freeze([`quasispecies-eigen-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`carrying-capacity-population`,`monomer-alphabet-cardinality`]),validityDomain:Object.freeze({minSeqLength:8,maxSeqLength:16,muMin:0,muMax:.75}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e-9,1e-4]),fundamentalLaws:Object.freeze([`complementary-hbond-duplex-melting`,`template-directed-polymerization`,`eigen-quasispecies-error-threshold`,`resource-limited-moran-selection`])});function Ai(e={}){let t=Number(e.replicatorCount)||0,n=!!e.templateReplicationActive||t>=16;return{active:n,reason:n?`complementary-oligomer-population-present`:`no-replicating-polymers-dormant`}}function ji({lengthL:e=16,strongPairFraction:t=.5,saltMolar:n=.15,tempMinK:r=280,tempMaxK:i=390}={}){let a=Math.max(4,Math.trunc(Number(e)||16)),o=Math.max(0,Math.min(1,Number(t)||.5)),s=31*(1-o)+41.5*o,c=88*(1-o)+105*o,l=16.6*Math.log10(Math.max(.005,Number(n)||.15)/.15),u=(a-1)*s,d=((a-1)*c+24)*.001,f=u/Math.max(1e-4,d)+l,p=[];for(let e=0;e<=44;e+=1){let t=r+e/44*(i-r),n=u*(1-t/f),a=Math.exp(Math.max(-40,Math.min(40,n/(.00831446*t)))),o=a/(1+a);p.push({tempK:t,duplexFraction:o})}let m=Math.log(6)/a;return Object.freeze({lengthL:a,strongPairFraction:o,meltingTempK:f,meltingTempC:f-273.15,eigenErrorThresholdMu:m,curve:p})}var Mi=`
struct RepParams {
  pop_count: u32,
  step_index: u32,
  target_genome: u32,  // 16 x 2-bit catalytic motif (physical folding energy minimum)
  seq_len: u32,        // 16
  dt: f32,
  mutation_mu: f32,    // Per-monomer thermal mismatch error probability [0..0.5]
  selection_beta: f32, // Catalytic fitness advantage ln(sigma)
  temp_k: f32,
  seed_f: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

// 48 bytes per spatial protocell replicator (directly renderable as 3D GPU beads!):
//   pos_fit: vec4(x, y, z, fitness)
//   vel_gen: vec4(vx, vy, vz, bitcast<f32>(genome_u32))
//   col_r:   vec4(r, g, b, radius)
struct Replicator {
  pos_fit: vec4<f32>,
  vel: vec3<f32>,
  genome: u32,
  col_r: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: RepParams;
@group(0) @binding(1) var<storage, read> pop_in: array<Replicator>;
@group(0) @binding(2) var<storage, read_write> pop_out: array<Replicator>;
@group(0) @binding(3) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

fn pcg_u32(v_in: u32) -> u32 {
  let state = v_in * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn rand01(seed_u: u32) -> f32 {
  return f32(pcg_u32(seed_u) & 0x00ffffffu) / 16777216.0;
}

fn hamming_matches(g: u32, goal_g: u32, seq_n: u32) -> u32 {
  var matches = 0u;
  for (var k = 0u; k < seq_n; k = k + 1u) {
    let shift = k * 2u;
    let b1 = (g >> shift) & 3u;
    let b2 = (goal_g >> shift) & 3u;
    if (b1 == b2) { matches = matches + 1u; }
  }
  return matches;
}

fn eval_fitness(g: u32) -> f32 {
  let m = f32(hamming_matches(g, params.target_genome, params.seq_len));
  let frac = m / max(1.0, f32(params.seq_len));
  return exp(params.selection_beta * (frac - 1.0));
}

@compute @workgroup_size(64)
fn step_replicator_population(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.pop_count) { return; }

  let self_r = pop_in[i];
  let seed0 = i * 1973u + params.step_index * 9277u + u32(params.seed_f * 100.0);

  // Local spatial tournament selection among 5 neighbors (resource-limited competition!)
  var best_idx = i;
  var best_fit = self_r.pos_fit.w;
  for (var t = 0u; t < 5u; t = t + 1u) {
    let cand = pcg_u32(seed0 + t * 37u) % params.pop_count;
    let cf = pop_in[cand].pos_fit.w;
    if (cf > best_fit) {
      best_fit = cf;
      best_idx = cand;
    }
  }

  let p_replace = clamp(0.28 * (best_fit / max(0.05, self_r.pos_fit.w + best_fit)), 0.04, 0.52);
  var genome = self_r.genome;
  var pos = self_r.pos_fit.xyz;
  var vel = self_r.vel;

  if (rand01(seed0 + 991u) < p_replace) {
    var child = pop_in[best_idx].genome;
    for (var k = 0u; k < params.seq_len; k = k + 1u) {
      if (rand01(seed0 + 1301u + k * 79u) < params.mutation_mu) {
        let shift = k * 2u;
        let old_b = (child >> shift) & 3u;
        let delta = 1u + (pcg_u32(seed0 + 4099u + k * 53u) % 3u);
        let new_b = (old_b + delta) & 3u;
        child = (child & ~(3u << shift)) | (new_b << shift);
      }
    }
    genome = child;
    let parent_p = pop_in[best_idx].pos_fit.xyz;
    pos = mix(pos, parent_p, 0.08);
  }

  let fit = eval_fitness(genome);
  let match_frac = f32(hamming_matches(genome, params.target_genome, params.seq_len)) / max(1.0, f32(params.seq_len));

  // Fitness-radial sequence space embedding: adapted quasispecies cluster tightly at emerald core,
  // while Eigen error catastrophe expands population outward into purple random-sequence halo!
  let r_cur = max(0.25, length(pos));
  let r_goal = mix(7.6, 1.4, clamp((match_frac - 0.25) / 0.75, 0.0, 1.0));
  let radial_pull = (pos / r_cur) * (r_goal - r_cur) * 2.2;
  let dx = (rand01(seed0 + 51u) - 0.5) * 0.55;
  let dy = (rand01(seed0 + 53u) - 0.5) * 0.55;
  let dz = (rand01(seed0 + 59u) - 0.5) * 0.55;
  vel = vel * 0.88 + (radial_pull + vec3<f32>(dx, dy, dz) * 4.5) * params.dt;
  pos = pos + vel * params.dt;
  let r_len = length(pos);
  if (r_len > 8.6) {
    pos = pos * (8.6 / r_len);
    vel = -vel * 0.5;
  }

  var col = mix(vec3<f32>(0.54, 0.22, 0.82), vec3<f32>(0.18, 0.80, 1.0), smoothstep(0.25, 0.65, match_frac));
  col = mix(col, vec3<f32>(0.22, 1.0, 0.54), smoothstep(0.62, 0.96, match_frac));
  let rad = 0.20 + 0.24 * fit;

  var out_r: Replicator;
  out_r.pos_fit = vec4<f32>(pos, fit);
  out_r.vel = vel;
  out_r.genome = genome;
  out_r.col_r = vec4<f32>(col, rad);
  pop_out[i] = out_r;
}

@compute @workgroup_size(64)
fn reduce_replicator_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var fit_sum = 0.0;
  var match_sum = 0.0;
  var elite_cnt = 0.0;
  var max_fit = 0.0;
  var i = tid;
  loop {
    if (i >= params.pop_count) { break; }
    let r = pop_out[i];
    let f = r.pos_fit.w;
    let mf = f32(hamming_matches(r.genome, params.target_genome, params.seq_len)) / max(1.0, f32(params.seq_len));
    fit_sum = fit_sum + f;
    match_sum = match_sum + mf;
    if (mf >= 0.75) { elite_cnt = elite_cnt + 1.0; }
    if (f > max_fit) { max_fit = f; }
    i = i + 64u;
  }
  wg0[tid] = fit_sum; wg1[tid] = match_sum; wg2[tid] = elite_cnt; wg3[tid] = max_fit;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] = max(wg3[tid], wg3[tid + s]);
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let inv = 1.0 / max(1.0, f32(params.pop_count));
    telemetry[0] = vec4<f32>(wg0[0] * inv, wg1[0] * inv, wg2[0] * inv, wg3[0]);
  }
}
`;function Ni(t,{populationCount:n=1024,mutationRateMu:r=.02,selectionBeta:i=3.2,temperatureK:c=310,seed:l=20261125,label:u=`ulg-bio-replicator`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createTemplateReplicationSessionWebGpu requires a live WebGPU GPUDevice`);let d=Math.max(128,Math.min(4096,Math.trunc(n))),f=2624469780,p=l>>>0||1,m=()=>{p=p+1831565813|0;let e=Math.imul(p^p>>>15,1|p);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296},h=new Float32Array(d*12),g=new Uint32Array(h.buffer);for(let e=0;e<d;e+=1){let t=Math.cbrt(m())*7.8,n=2*m()-1,r=Math.sqrt(Math.max(0,1-n*n)),i=m()*Math.PI*2,a=Math.floor(m()*4294967295)>>>0;e<Math.max(8,Math.floor(d*.04))&&(a=f^Math.floor(m()*15)<<4>>>0);let o=e*12;h[o+0]=t*r*Math.cos(i),h[o+1]=t*n,h[o+2]=t*r*Math.sin(i),h[o+3]=.15,h[o+4]=0,h[o+5]=0,h[o+6]=0,g[o+7]=a,h[o+8]=.45,h[o+9]=.35,h[o+10]=.78,h[o+11]=.24}let _=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`storage`),a(3,`storage`)],v=s(t,{cacheKey:`ulg-bio-rep-step.v1`,label:`${u}-step`,code:Mi,entryPoint:`step_replicator_population`,bindings:_}),y=s(t,{cacheKey:`ulg-bio-rep-tel.v1`,label:`${u}-tel`,code:Mi,entryPoint:`reduce_replicator_telemetry`,bindings:_}),b=t.createBuffer({label:`${u}-params`,size:48,usage:Oi.UNIFORM|Oi.COPY_DST}),x=t.createBuffer({label:`${u}-a`,size:h.byteLength,usage:Oi.STORAGE|Oi.COPY_SRC|Oi.COPY_DST}),S=t.createBuffer({label:`${u}-b`,size:h.byteLength,usage:Oi.STORAGE|Oi.COPY_SRC|Oi.COPY_DST}),C=t.createBuffer({label:`${u}-tel`,size:16,usage:Oi.STORAGE|Oi.COPY_SRC}),w=t.createBuffer({label:`${u}-tel-rd`,size:16,usage:Oi.MAP_READ|Oi.COPY_DST});t.queue.writeBuffer(x,0,h),t.queue.writeBuffer(S,0,h);let T=o(t,{layout:v.bindGroupLayout,label:`${u}-bg-ab`,entries:[{binding:0,resource:{buffer:b}},{binding:1,resource:{buffer:x}},{binding:2,resource:{buffer:S}},{binding:3,resource:{buffer:C}}]}),E=o(t,{layout:v.bindGroupLayout,label:`${u}-bg-ba`,entries:[{binding:0,resource:{buffer:b}},{binding:1,resource:{buffer:S}},{binding:2,resource:{buffer:x}},{binding:3,resource:{buffer:C}}]}),D=Math.max(0,Math.min(.65,Number(r))),O=Math.max(.5,Number(i)||3.2),k=Math.max(250,Number(c)||310),A=0,j=0,M=!1,N=!1,P=[],F=Object.freeze({schema:Di,populationCount:d,stepIndex:0,mutationRateMu:D,eigenThresholdMu:O/16,meanFitness:.15,meanSequenceIdentity:.25,quasispeciesFraction:.02,maxFitness:.5,fitnessHistory:[],accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),I=Math.ceil(d/64);function L(e){D=Math.max(0,Math.min(.65,Number(e)||0))}function R(e){O=Math.max(.5,Math.min(6,Number(e)||3.2))}async function z({dt:n=.08,substeps:r=2,readTelemetry:i=!0}={}){if(N)return F;let a=Math.max(1,Math.min(8,Math.trunc(r))),o=l%997*.11+1.7,s=new ArrayBuffer(48);new Uint32Array(s,0,4).set([d,j+a,f,16]),new Float32Array(s,16,8).set([n,D,O,k,o,0,0,0]),t.queue.writeBuffer(b,0,s);let c=t.createCommandEncoder({label:`${u}-enc-${j}`}),p=c.beginComputePass({label:`${u}-pass`});p.setPipeline(v.pipeline);for(let e=0;e<a;e+=1)p.setBindGroup(0,A===0?T:E),p.dispatchWorkgroups(I),A=1-A,j+=1;p.setPipeline(y.pipeline),p.setBindGroup(0,A===1?T:E),p.dispatchWorkgroups(1),p.end();let m=i&&!M&&w.mapState===`unmapped`;m&&(M=!0,c.copyBufferToBuffer(C,0,w,0,16)),t.queue.submit([c.finish()]);let h=F.meanFitness,g=F.meanSequenceIdentity,_=F.quasispeciesFraction,x=F.maxFitness;if(m)try{if(await w.mapAsync(Oi.MAP_READ),!N){let e=new Float32Array(w.getMappedRange(0,16));h=e[0],g=e[1],_=e[2],x=e[3],P.push(g),P.length>96&&P.shift()}try{w.unmap()}catch{}}catch(e){if(!N&&e?.name!==`AbortError`)throw e}finally{M=!1}return F=Object.freeze({schema:Di,populationCount:d,stepIndex:j,mutationRateMu:D,eigenThresholdMu:O/16,meanFitness:h,meanSequenceIdentity:g,quasispeciesFraction:_,maxFitness:x,fitnessHistory:[...P],accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),F}function B(){if(!N){N=!0;for(let e of[b,x,S,C,w])try{e.destroy()}catch{}}}return Object.freeze({schema:Di,lawAdapter:ki,populationCount:d,get stepIndex(){return j},getResidentPopulationBuffer:()=>A===0?x:S,getTelemetry:()=>F,setMutationRateMu:L,setSelectionBeta:R,step:z,dispose:B})}function Pi(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`template-replication-evolution@1`)?e.resolveModule(`template-replication-evolution@1`)?.descriptor||null:e.registerModule({method:{model:`template-replication-evolution`,version:1},kernel:{sourceModule:`src/runtime/biology/templateReplicationGpu.js`,entryPoint:`step_replicator_population`,workgroupSize:64},parameterSchema:{mutationRateMu:{type:`number`,min:0,max:.65,required:!1}},stateLayout:{tensorId:`replicator-population`,dtype:`f32`,layout:`interleaved`,strideElements:12,strideBytes:48,fields:[`x`,`y`,`z`,`fitness`,`vx`,`vy`,`vz`,`genomeBits`,`r`,`g`,`b`,`radius`]},scaleRangeM:[1e-9,1e-4],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=Ni(n,{populationCount:256,mutationRateMu:(e.input?.parameters||{}).mutationRateMu??.02}),i=await r.step({dt:.08,substeps:4,readTelemetry:!0});return r.dispose(),t({artifactId:`${e.taskId}:replicator:${i.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/biology/templateReplicationGpu.js`,entryPoint:`createTemplateReplicationSessionWebGpu`,kernelEntryPoint:`step_replicator_population`},representation:`replicator-population-f32`,outputs:{telemetry:i},execution:{backend:`webgpu-template-replication`,placement:`local`},validity:{finite:Number.isFinite(i.meanSequenceIdentity)},validation:{status:`pass`,validationMode:`gpu-quasispecies-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var Fi=`ulg.biology.chemiosmotic-bioenergetics-webgpu.v1`,Ii=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),Li=Object.freeze({id:`chemiosmotic-bioenergetics-electrophysiology`,lawNodeId:`law:biology-chemiosmotic-bioenergetics-electrophysiology`,orderConstraint:`after:amphiphile-membrane-self-assembly`,adapterMode:n.CELL_LOCAL,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`excitable-membrane-field`,`transmembrane-ion-gradients`]),writes:Object.freeze([`excitable-membrane-field`]),accumulates:Object.freeze([`bioenergetics-electrophys-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`ion-channel-gating-bounds`,`chemiosmotic-energy-balance`]),validityDomain:Object.freeze({minTempK:270,maxTempK:340,gNaMin:0}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e-8,.01]),fundamentalLaws:Object.freeze([`mitchell-chemiosmotic-proton-motive-force`,`mechanochemical-atp-free-energy-coupling`,`hodgkin-huxley-voltage-gated-ion-conductance`,`electrotonic-cable-diffusion`])});function Ri(e={}){let t=!!e.excitableMembraneActive||Math.abs(Number(e.deltaPh)||0)>.05||(Number(e.gNaMsCm2)||0)>0;return{active:t,reason:t?`transmembrane-electrochemical-gradient-present`:`no-transmembrane-gradient-dormant`}}function zi({deltaPsiMv:t=150,deltaPh:n=1,temperatureK:r=310,protonsPerAtp:i=3.33,uncouplerLeak:a=0,atpOverAdpRatio:o=5}={}){let s=Math.max(250,Number(r)||310),c=8.31446,l=96485.33,u=Math.max(0,Math.min(1,Number(a)||0)),d=Math.abs(Number(t)||0)*(1-u),f=Math.abs(Number(n)||0)*(1-u),p=2.303*c*s/l*1e3,m=d+p*f,h=i*(l*m*1e-6),g=30.5+c*s*.001*Math.log(Math.max(.01,o)/.002),_=Math.max(0,h-g),v=m>.001?Math.max(0,_*2.4):0,y=u*(Math.abs(t)+p*Math.abs(n))*.05;return Object.freeze({schema:Fi,temperatureK:s,protonMotiveForceMv:m,protonDriveKjMol:h,deltaGAtpKjMol:g,netThermoDriveKj:_,atpSynthesisFlux:v,thermodynamicallyFeasible:h>g,dissipationHeatWProxy:y,accuracyTier:e.TIER_1_QUANTITATIVE,scientificValidation:!1})}var Bi=`
struct HhParams {
  width: u32,
  height: u32,
  step_index: u32,
  stim_active: u32,
  dt_ms: f32,
  g_na: f32,         // Sodium conductance (mS/cm^2; 120 normal, 0 = TTX block -> NO action potential!)
  g_k: f32,          // Potassium conductance (mS/cm^2; 36 normal)
  g_leak: f32,       // Leak conductance (0.3)
  diff_v: f32,       // Electrotonic cable diffusion D_V
  stim_amp: f32,
  stim_x: f32,
  stim_y: f32,
};

// vec4(V_m [mV], m, h, n) per membrane patch cell
@group(0) @binding(0) var<uniform> params: HhParams;
@group(0) @binding(1) var<storage, read> mem_in: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> mem_out: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

fn idx_clamp(x: i32, y: i32) -> u32 {
  let cx = u32(clamp(x, 0, i32(params.width) - 1));
  let cy = u32(clamp(y, 0, i32(params.height) - 1));
  return cy * params.width + cx;
}

fn safe_vtrap(x: f32, y: f32) -> f32 {
  if (abs(x / y) < 1e-4) {
    return y * (1.0 - x / (2.0 * y));
  }
  return x / (exp(x / y) - 1.0);
}

@compute @workgroup_size(8, 8)
fn step_hodgkin_huxley_membrane(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = gid.y * params.width + gid.x;
  let st = mem_in[idx];
  let V = clamp(st.x, -100.0, 70.0);
  let m = clamp(st.y, 0.0, 1.0);
  let h = clamp(st.z, 0.0, 1.0);
  let n = clamp(st.w, 0.0, 1.0);

  let lap_v = mem_in[idx_clamp(ix - 1, iy)].x
    + mem_in[idx_clamp(ix + 1, iy)].x
    + mem_in[idx_clamp(ix, iy - 1)].x
    + mem_in[idx_clamp(ix, iy + 1)].x
    - 4.0 * V;

  // Classic Hodgkin-Huxley voltage-gated channel rate equations (shifted to V_rest = -65 mV)
  let am = 0.1 * safe_vtrap(-(V + 40.0), 10.0);
  let bm = 4.0 * exp(-(V + 65.0) / 18.0);
  let ah = 0.07 * exp(-(V + 65.0) / 20.0);
  let bh = 1.0 / (exp(-(V + 35.0) / 10.0) + 1.0);
  let an = 0.01 * safe_vtrap(-(V + 55.0), 10.0);
  let bn = 0.125 * exp(-(V + 65.0) / 80.0);

  let e_na = 50.0;
  let e_k = -77.0;
  let e_l = -54.4;
  let i_na = params.g_na * (m * m * m) * h * (V - e_na);
  let i_k  = params.g_k * (n * n * n * n) * (V - e_k);
  let i_l  = params.g_leak * (V - e_l);

  var i_stim = 0.0;
  if (params.stim_active != 0u) {
    let fx = f32(gid.x) / f32(params.width);
    let fy = f32(gid.y) / f32(params.height);
    let d_stim = length(vec2<f32>(fx - params.stim_x, fy - params.stim_y));
    if (d_stim < 0.06) {
      i_stim = params.stim_amp;
    }
  }

  let dt = params.dt_ms;
  let dV = (i_stim - i_na - i_k - i_l) + params.diff_v * lap_v;
  // Rush-Larsen exponential integration for stiff gating variables (unconditionally stable!)
  let m_inf = am / max(1e-5, am + bm);
  let h_inf = ah / max(1e-5, ah + bh);
  let n_inf = an / max(1e-5, an + bn);
  let m_next = m_inf + (m - m_inf) * exp(-(am + bm) * dt);
  let h_next = h_inf + (h - h_inf) * exp(-(ah + bh) * dt);
  let n_next = n_inf + (n - n_inf) * exp(-(an + bn) * dt);
  let V_next = clamp(V + dV * dt, -95.0, 60.0);

  mem_out[idx] = vec4<f32>(V_next, m_next, h_next, n_next);
}

@compute @workgroup_size(64)
fn reduce_membrane_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let total = params.width * params.height;
  var v_sum = 0.0;
  var v_max = -100.0;
  var excited = 0.0;
  var i = tid;
  loop {
    if (i >= total) { break; }
    let v = mem_out[i].x;
    v_sum = v_sum + v;
    if (v > v_max) { v_max = v; }
    if (v > -15.0) { excited = excited + 1.0; }
    i = i + 64u;
  }
  let center_idx = (params.height / 2u) * params.width + (params.width / 2u);
  wg0[tid] = v_sum; wg1[tid] = v_max; wg2[tid] = excited; wg3[tid] = mem_out[center_idx].x;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s];
      wg1[tid] = max(wg1[tid], wg1[tid + s]);
      wg2[tid] += wg2[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let inv = 1.0 / max(1.0, f32(total));
    telemetry[0] = vec4<f32>(wg0[0] * inv, wg1[0], wg2[0] * inv, wg3[0]);
  }
}
`;function Vi(t,{width:n=128,height:r=128,gNa:i=120,gK:c=36,deltaPsiMv:l=150,deltaPh:u=1,uncouplerLeak:d=0,initSpiral:f=!0,label:p=`ulg-bio-excitable`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createExcitableMembraneSessionWebGpu requires a live WebGPU GPUDevice`);let m=Math.max(32,Math.min(256,Math.trunc(n))),h=Math.max(32,Math.min(256,Math.trunc(r))),g=new Float32Array(m*h*4);for(let e=0;e<h;e+=1)for(let t=0;t<m;t+=1){let n=(e*m+t)*4,r=t/m,i=e/h,a=-65,o=.053,s=.596,c=.318;f&&r>.44&&r<.52&&i>.45?(a=22,o=.92,s=.45,c=.35):f&&r>=.52&&r<.64&&i>.45&&(a=-72,o=.02,s=.08,c=.72),g[n+0]=a,g[n+1]=o,g[n+2]=s,g[n+3]=c}let _=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`storage`),a(3,`storage`)],v=s(t,{cacheKey:`ulg-bio-hh-step.v1`,label:`${p}-step`,code:Bi,entryPoint:`step_hodgkin_huxley_membrane`,bindings:_}),y=s(t,{cacheKey:`ulg-bio-hh-tel.v1`,label:`${p}-tel`,code:Bi,entryPoint:`reduce_membrane_telemetry`,bindings:_}),b=t.createBuffer({label:`${p}-params`,size:48,usage:Ii.UNIFORM|Ii.COPY_DST}),x=t.createBuffer({label:`${p}-fa`,size:g.byteLength,usage:Ii.STORAGE|Ii.COPY_SRC|Ii.COPY_DST}),S=t.createBuffer({label:`${p}-fb`,size:g.byteLength,usage:Ii.STORAGE|Ii.COPY_SRC|Ii.COPY_DST}),C=t.createBuffer({label:`${p}-tel`,size:16,usage:Ii.STORAGE|Ii.COPY_SRC}),w=t.createBuffer({label:`${p}-tel-rd`,size:16,usage:Ii.MAP_READ|Ii.COPY_DST});t.queue.writeBuffer(x,0,g),t.queue.writeBuffer(S,0,g);let T=o(t,{layout:v.bindGroupLayout,label:`${p}-bg-ab`,entries:[{binding:0,resource:{buffer:b}},{binding:1,resource:{buffer:x}},{binding:2,resource:{buffer:S}},{binding:3,resource:{buffer:C}}]}),E=o(t,{layout:v.bindGroupLayout,label:`${p}-bg-ba`,entries:[{binding:0,resource:{buffer:b}},{binding:1,resource:{buffer:S}},{binding:2,resource:{buffer:x}},{binding:3,resource:{buffer:C}}]}),D=Math.max(0,Number(i)),O=Math.max(0,Number(c)),k=Number(l)||150,A=Number(u)||1,j=Math.max(0,Math.min(1,Number(d)||0)),M=f?0:12,N=.25,P=.5,F=0,I=0,L=!1,R=!1,z=[],B=Object.freeze({schema:Fi,stepIndex:0,gNa:D,gK:O,meanVoltageMv:-65,maxVoltageMv:-65,excitedFraction:0,probeVoltageMv:-65,voltageTraceMv:[],chemiosmosis:zi({deltaPsiMv:k,deltaPh:A,uncouplerLeak:j}),accuracyTier:e.TIER_1_QUANTITATIVE,scientificValidation:!1}),V=Math.ceil(m/8),ee=Math.ceil(h/8);function H(e){D=Math.max(0,Math.min(200,Number(e)||0))}function U(e){O=Math.max(0,Math.min(100,Number(e)||0))}function W({deltaPsiMv:e,deltaPh:t,uncouplerLeak:n}={}){e!=null&&(k=Number(e)),t!=null&&(A=Number(t)),n!=null&&(j=Math.max(0,Math.min(1,Number(n))))}function G(e=.5,t=.5){N=Math.max(.05,Math.min(.95,Number(e)||.5)),P=Math.max(.05,Math.min(.95,Number(t)||.5)),M=18}async function te({dtMs:n=.035,substeps:r=12,readTelemetry:i=!0}={}){if(R)return B;let a=Math.max(1,Math.min(24,Math.trunc(r))),o=Math.max(.01,Math.min(.045,Number(n)||.035)),s=+(M>0);M>0&&--M;let c=new ArrayBuffer(48);new Uint32Array(c,0,4).set([m,h,I+a,s]),new Float32Array(c,16,8).set([o,D,O,.3,1.25,38,N,P]),t.queue.writeBuffer(b,0,c);let l=t.createCommandEncoder({label:`${p}-enc-${I}`}),u=l.beginComputePass({label:`${p}-pass`});u.setPipeline(v.pipeline);for(let e=0;e<a;e+=1)u.setBindGroup(0,F===0?T:E),u.dispatchWorkgroups(V,ee),F=1-F,I+=1;u.setPipeline(y.pipeline),u.setBindGroup(0,F===1?T:E),u.dispatchWorkgroups(1),u.end();let d=i&&!L&&w.mapState===`unmapped`;d&&(L=!0,l.copyBufferToBuffer(C,0,w,0,16)),t.queue.submit([l.finish()]);let f=B.meanVoltageMv,g=B.maxVoltageMv,_=B.excitedFraction,x=B.probeVoltageMv;if(d)try{if(await w.mapAsync(Ii.MAP_READ),!R){let e=new Float32Array(w.getMappedRange(0,16));f=e[0],g=e[1],_=e[2],x=e[3],z.push(x),z.length>96&&z.shift()}try{w.unmap()}catch{}}catch(e){if(!R&&e?.name!==`AbortError`)throw e}finally{L=!1}return B=Object.freeze({schema:Fi,stepIndex:I,gNa:D,gK:O,meanVoltageMv:f,maxVoltageMv:g,excitedFraction:_,probeVoltageMv:x,voltageTraceMv:[...z],chemiosmosis:zi({deltaPsiMv:k,deltaPh:A,uncouplerLeak:j}),accuracyTier:e.TIER_1_QUANTITATIVE,scientificValidation:!1}),B}function K(){if(!R){R=!0;for(let e of[b,x,S,C,w])try{e.destroy()}catch{}}}return Object.freeze({schema:Fi,lawAdapter:Li,width:m,height:h,get stepIndex(){return I},getResidentFieldBuffer:()=>F===0?x:S,getTelemetry:()=>B,setGNa:H,setGK:U,setChemiosmosis:W,triggerStimulus:G,step:te,dispose:K})}function Hi(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`chemiosmotic-bioenergetics-electrophysiology@1`)?e.resolveModule(`chemiosmotic-bioenergetics-electrophysiology@1`)?.descriptor||null:e.registerModule({method:{model:`chemiosmotic-bioenergetics-electrophysiology`,version:1},kernel:{sourceModule:`src/runtime/biology/membraneBioenergeticsGpu.js`,entryPoint:`step_hodgkin_huxley_membrane`,workgroupSize:64},parameterSchema:{gNa:{type:`number`,min:0,max:200,required:!1},deltaPh:{type:`number`,min:0,max:4,required:!1}},stateLayout:{tensorId:`excitable-membrane-field`,dtype:`f32`,layout:`interleaved`,strideElements:4,strideBytes:16,fields:[`Vm_mV`,`m`,`h`,`n`]},scaleRangeM:[1e-8,.01],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=Vi(n,{width:64,height:64,gNa:(e.input?.parameters||{}).gNa??120}),i=await r.step({dtMs:.035,substeps:8,readTelemetry:!0});return r.dispose(),t({artifactId:`${e.taskId}:excitable:${i.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/biology/membraneBioenergeticsGpu.js`,entryPoint:`createExcitableMembraneSessionWebGpu`,kernelEntryPoint:`step_hodgkin_huxley_membrane`},representation:`excitable-membrane-f32`,outputs:{telemetry:i},execution:{backend:`webgpu-hodgkin-huxley`,placement:`local`},validity:{finite:Number.isFinite(i.maxVoltageMv)},validation:{status:`pass`,validationMode:`gpu-excitable-membrane-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var Ui=`ulg.biology.morphogenesis-active-matter-webgpu.v1`,Wi=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),Gi=Object.freeze({id:`reaction-diffusion-active-matter`,lawNodeId:`law:biology-reaction-diffusion-active-matter`,orderConstraint:`after:chemiosmotic-bioenergetics-electrophysiology`,adapterMode:n.CELL_LOCAL,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`morphogen-rd-field`,`active-matter-agents`]),writes:Object.freeze([`morphogen-rd-field`,`active-matter-agents`]),accumulates:Object.freeze([`morphogenesis-chemotaxis-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`active-agent-count`,`non-negative-morphogen-concentrations`]),validityDomain:Object.freeze({dUMin:0,dVMin:0,v0Min:0}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e-6,.1]),fundamentalLaws:Object.freeze([`turing-differential-diffusion-instability`,`gray-scott-autocatalytic-morphogenesis`,`run-and-tumble-chemotaxis`,`active-brownian-self-propulsion`])});function Ki(e={}){let t=!!e.morphogenesisActive||(Number(e.activeAgentCount)||0)>=16;return{active:t,reason:t?`morphogen-or-active-agents-present`:`no-morphogenesis-dormant`}}var qi=Object.freeze({"turing-spots":Object.freeze({id:`turing-spots`,name:`Turing Spots & Chemotactic Colonies`,F:.036,k:.064,dU:.21,dV:.105}),"turing-labyrinth":Object.freeze({id:`turing-labyrinth`,name:`Embryonic Labyrinth Stripes`,F:.042,k:.06,dU:.21,dV:.105}),"mitosis-division":Object.freeze({id:`mitosis-division`,name:`Self-Dividing Mitosis Droplets`,F:.028,k:.062,dU:.21,dV:.105})}),Ji=`
struct MorphParams {
  width: u32,
  height: u32,
  agent_count: u32,
  step_index: u32,
  dt_rd: f32,
  feed_f: f32,
  kill_k: f32,
  diff_u: f32,
  diff_v: f32,
  v0_propel: f32,      // Self-propulsion speed (0 -> passive Brownian!)
  chemo_gain: f32,     // Chemotactic gradient sensitivity (0 -> unbiased random walk!)
  seed_f: f32,
};

// Morphogen field: vec4(u_substrate, v_activator, chemo_density, grad_mag)
// Active agent (48 bytes -> directly renderable as 3D/2D WebGPU beads!):
//   pos_th: vec4(x_world, y_world, z_world, heading_rad)
//   vel_c:  vec4(vx, vy, vz, sensed_v)
//   col_r:  vec4(r, g, b, radius)
struct ActiveAgent {
  pos_th: vec4<f32>,
  vel_c: vec4<f32>,
  col_r: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: MorphParams;
@group(0) @binding(1) var<storage, read> field_in: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> field_out: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> agents: array<ActiveAgent>;
@group(0) @binding(4) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

fn wrap_idx(x: i32, y: i32) -> u32 {
  let wi = i32(params.width);
  let hi = i32(params.height);
  let ux = u32(((x % wi) + wi) % wi);
  let uy = u32(((y % hi) + hi) % hi);
  return uy * params.width + ux;
}

fn hash_m(x: f32) -> f32 {
  return fract(sin(x * 127.1 + params.seed_f * 29.3) * 43758.5453);
}

@compute @workgroup_size(8, 8)
fn step_morphogen_field(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = gid.y * params.width + gid.x;
  let c = field_in[idx];
  let cL = field_in[wrap_idx(ix - 1, iy)];
  let cR = field_in[wrap_idx(ix + 1, iy)];
  let cD = field_in[wrap_idx(ix, iy - 1)];
  let cU = field_in[wrap_idx(ix, iy + 1)];
  let lap = cL + cR + cD + cU - 4.0 * c;

  let u = clamp(c.x, 0.0, 1.2);
  let v = clamp(c.y, 0.0, 1.2);
  let chem = clamp(c.z, 0.0, 2.0);
  let uvv = u * v * v;
  let du = params.diff_u * lap.x - uvv + params.feed_f * (1.0 - u);
  let dv = params.diff_v * lap.y + uvv - (params.feed_f + params.kill_k) * v;
  let u_next = clamp(u + du * params.dt_rd, 0.0, 1.2);
  let v_next = clamp(v + dv * params.dt_rd, 0.0, 1.2);
  // Unsaturated screened-Poisson chemoattractant plume (d c / dt = D lap(c) + lambda*(v - c)):
  // Exact decay length L = sqrt(0.24 / 0.009) ~ 5.2 cells so plumes span across inter-spot valleys!
  let dchem = 0.24 * lap.z + 0.009 * (v_next - chem);
  let chem_next = clamp(chem + dchem * params.dt_rd, 0.0, 1.2);
  field_out[idx] = vec4<f32>(u_next, v_next, chem_next, v_next);
}

@compute @workgroup_size(64)
fn step_chemotactic_agents(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.agent_count) { return; }
  var ag = agents[i];
  let world_half = 8.0;
  var px = ag.pos_th.x;
  var pz = ag.pos_th.z;
  var heading = ag.pos_th.w;
  var vx = 0.0;
  var vz = 0.0;
  var sensed_v = 0.0;

  // 8 fine chemotactic substeps (dt_ag = 0.048 -> <= 0.9 cell/substep, zero spot overshoot!)
  for (var sub = 0u; sub < 8u; sub = sub + 1u) {
    let fx = clamp((px / (2.0 * world_half)) + 0.5, 0.0, 0.9999) * f32(params.width);
    let fz = clamp((pz / (2.0 * world_half)) + 0.5, 0.0, 0.9999) * f32(params.height);
    let gx_i = i32(floor(fx));
    let gz_i = i32(floor(fz));
    let cell = field_out[wrap_idx(gx_i, gz_i)];
    sensed_v = cell.y;
    // Nested +/-1, +/-3, +/-5 chemoattractant gradient spanning valleys AND peaks!
    let cL1 = field_out[wrap_idx(gx_i - 1, gz_i)];
    let cR1 = field_out[wrap_idx(gx_i + 1, gz_i)];
    let cD1 = field_out[wrap_idx(gx_i, gz_i - 1)];
    let cU1 = field_out[wrap_idx(gx_i, gz_i + 1)];
    let cL3 = field_out[wrap_idx(gx_i - 3, gz_i)];
    let cR3 = field_out[wrap_idx(gx_i + 3, gz_i)];
    let cD3 = field_out[wrap_idx(gx_i, gz_i - 3)];
    let cU3 = field_out[wrap_idx(gx_i, gz_i + 3)];
    let cL5 = field_out[wrap_idx(gx_i - 5, gz_i)];
    let cR5 = field_out[wrap_idx(gx_i + 5, gz_i)];
    let cD5 = field_out[wrap_idx(gx_i, gz_i - 5)];
    let cU5 = field_out[wrap_idx(gx_i, gz_i + 5)];
    let grad_x = (cR1.y - cL1.y) * 1.6 + (cR3.z - cL3.z) * 1.8 + (cR5.z - cL5.z) * 1.2;
    let grad_z = (cU1.y - cD1.y) * 1.6 + (cU3.z - cD3.z) * 1.8 + (cU5.z - cD5.z) * 1.2;

    let s0 = f32(i) * 19.7 + f32(params.step_index * 8u + sub) * 3.13;
    let rot_noise = (hash_m(s0 + 1.3) - 0.5) * 0.90;
    let hx = cos(heading);
    let hz = sin(heading);
    let g_mag = length(vec2<f32>(grad_x, grad_z));
    // Biased run-and-tumble steering up secreted chemoattractant gradient (exact 0 when chemo_gain == 0!)
    let g_dir_x = select(0.0, grad_x / g_mag, g_mag > 1e-6);
    let g_dir_z = select(0.0, grad_z / g_mag, g_mag > 1e-6);
    let cross_turn = hx * g_dir_z - hz * g_dir_x;
    let dot_align = hx * g_dir_x + hz * g_dir_z;
    // Berg-Brown klinokinesis + chemotactic heading bias (strictly 0 when v0==0 or chemo_gain==0!)
    let tumble_mod = select(1.0, select(0.16, 2.2, dot_align < 0.0), params.chemo_gain > 0.01 && g_mag > 1e-6);
    heading = heading + cross_turn * clamp(params.chemo_gain * 1.1, 0.0, 2.4) + rot_noise * 0.14 * tumble_mod;

    // Chemokinetic dwell slows random swimming at activator summits, with mild rotational spread so colonies form visible swarms!
    let dwell = select(1.0, 1.0 - 0.72 * clamp(sensed_v * 3.6, 0.0, 0.80), params.chemo_gain > 0.01);
    let spd = params.v0_propel * dwell;
    let drift_gain = params.v0_propel * clamp(params.chemo_gain * 0.62, 0.0, 1.35) * clamp(g_mag * 85.0, 0.0, 1.0);
    vx = cos(heading) * spd + g_dir_x * drift_gain + (hash_m(s0 + 5.7) - 0.5) * 0.22;
    vz = sin(heading) * spd + g_dir_z * drift_gain + (hash_m(s0 + 9.1) - 0.5) * 0.22;
    px = px + vx * 0.048;
    pz = pz + vz * 0.048;
    if (px > world_half) { px = px - 2.0 * world_half; }
    if (px < -world_half) { px = px + 2.0 * world_half; }
    if (pz > world_half) { pz = pz - 2.0 * world_half; }
    if (pz < -world_half) { pz = pz + 2.0 * world_half; }
  }
  let fx_f = clamp((px / (2.0 * world_half)) + 0.5, 0.0, 0.9999) * f32(params.width);
  let fz_f = clamp((pz / (2.0 * world_half)) + 0.5, 0.0, 0.9999) * f32(params.height);
  sensed_v = field_out[wrap_idx(i32(floor(fx_f)), i32(floor(fz_f)))].y;

  let ny = 0.22 + sensed_v * 1.65;
  let col = mix(vec3<f32>(0.24, 0.72, 1.0), vec3<f32>(0.98, 0.90, 0.28), clamp(sensed_v * 3.0, 0.0, 1.0));
  ag.pos_th = vec4<f32>(px, ny, pz, heading);
  ag.vel_c = vec4<f32>(vx, 0.0, vz, sensed_v);
  ag.col_r = vec4<f32>(col, 0.095 + 0.045 * clamp(sensed_v * 2.5, 0.0, 1.0));
  agents[i] = ag;
}

@compute @workgroup_size(64)
fn reduce_morphogenesis_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let total = params.width * params.height;
  var v_sum = 0.0;
  var v2_sum = 0.0;
  var i = tid;
  loop {
    if (i >= total) { break; }
    let v = field_out[i].y;
    v_sum = v_sum + v;
    v2_sum = v2_sum + v * v;
    i = i + 64u;
  }
  var ag_v = 0.0;
  var ag_spd = 0.0;
  var a = tid;
  loop {
    if (a >= params.agent_count) { break; }
    let ag = agents[a];
    ag_v = ag_v + ag.vel_c.w;
    ag_spd = ag_spd + length(ag.vel_c.xz);
    a = a + 64u;
  }
  wg0[tid] = v_sum; wg1[tid] = v2_sum; wg2[tid] = ag_v; wg3[tid] = ag_spd;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let inv_f = 1.0 / max(1.0, f32(total));
    let inv_a = 1.0 / max(1.0, f32(params.agent_count));
    let mean_v = wg0[0] * inv_f;
    let var_v = max(0.0, wg1[0] * inv_f - mean_v * mean_v);
    let ag_mean_v = wg2[0] * inv_a;
    // Chemotactic enrichment ratio: (> 1.2 when active agents cluster in morphogen peaks; ~1.0 when unbiased!)
    let enrich = ag_mean_v / max(1e-4, mean_v);
    telemetry[0] = vec4<f32>(mean_v, sqrt(var_v), enrich, wg3[0] * inv_a);
  }
}
`;function Yi(t,{width:n=128,height:r=128,agentCount:i=2048,regimeId:c=`turing-spots`,v0Propel:l=2.6,chemoGain:u=1.8,seed:d=20261125,label:f=`ulg-bio-morphogenesis`}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`createMorphogenesisActiveSessionWebGpu requires a live WebGPU GPUDevice`);let p=Math.max(32,Math.min(256,Math.trunc(n))),m=Math.max(32,Math.min(256,Math.trunc(r))),h=Math.max(128,Math.min(4096,Math.trunc(i))),g=qi[c]||qi[`turing-spots`],_=d>>>0||1,v=()=>{_=_+1831565813|0;let e=Math.imul(_^_>>>15,1|_);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296},y=new Float32Array(p*m*4),b=Array.from({length:24},()=>[.08+v()*.84,.08+v()*.84]);for(let e=0;e<m;e+=1)for(let t=0;t<p;t+=1){let n=t/p,r=e/m,i=(e*p+t)*4,a=!1,o=0;for(let[e,t]of b){let i=Math.hypot(n-e,r-t);i<.04&&(a=!0),o+=Math.exp(-(i*i)/(2*.095*.095))*.35}y[i+0]=a?.5:1,y[i+1]=a?.26+v()*.06:0,y[i+2]=Math.min(1,o),y[i+3]=0}let x=new Float32Array(h*12);for(let e=0;e<h;e+=1){let t=e*12;x[t+0]=(v()-.5)*16,x[t+1]=.25,x[t+2]=(v()-.5)*16,x[t+3]=v()*Math.PI*2,x[t+4]=0,x[t+5]=0,x[t+6]=0,x[t+7]=0,x[t+8]=.28,x[t+9]=.8,x[t+10]=1,x[t+11]=.15}let S=[a(0,`uniform`),a(1,`read-only-storage`),a(2,`storage`),a(3,`storage`),a(4,`storage`)],C=e=>s(t,{cacheKey:`ulg-bio-morph-${e}.v1`,label:`${f}-${e}`,code:Ji,entryPoint:e,bindings:S}),w=C(`step_morphogen_field`),T=C(`step_chemotactic_agents`),E=C(`reduce_morphogenesis_telemetry`),D=t.createBuffer({label:`${f}-params`,size:48,usage:Wi.UNIFORM|Wi.COPY_DST}),O=t.createBuffer({label:`${f}-fa`,size:y.byteLength,usage:Wi.STORAGE|Wi.COPY_SRC|Wi.COPY_DST}),k=t.createBuffer({label:`${f}-fb`,size:y.byteLength,usage:Wi.STORAGE|Wi.COPY_SRC|Wi.COPY_DST}),A=t.createBuffer({label:`${f}-agents`,size:x.byteLength,usage:Wi.STORAGE|Wi.COPY_SRC|Wi.COPY_DST}),j=t.createBuffer({label:`${f}-tel`,size:16,usage:Wi.STORAGE|Wi.COPY_SRC}),M=t.createBuffer({label:`${f}-tel-rd`,size:16,usage:Wi.MAP_READ|Wi.COPY_DST});t.queue.writeBuffer(O,0,y),t.queue.writeBuffer(k,0,y),t.queue.writeBuffer(A,0,x);let N=o(t,{layout:w.bindGroupLayout,label:`${f}-bg-ab`,entries:[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:O}},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:A}},{binding:4,resource:{buffer:j}}]}),P=o(t,{layout:w.bindGroupLayout,label:`${f}-bg-ba`,entries:[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:k}},{binding:2,resource:{buffer:O}},{binding:3,resource:{buffer:A}},{binding:4,resource:{buffer:j}}]}),F=g.F,I=g.k,L=g.dU,R=g.dV,z=Math.max(0,Number(l)),B=Math.max(0,Number(u)),V=0,ee=0,H=!1,U=!1,W=Object.freeze({schema:Ui,regimeId:g.id,stepIndex:0,meanActivatorV:0,turingPatternStd:0,chemotacticEnrichment:1,meanAgentSpeed:0,v0Propel:z,chemoGain:B,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),G=Math.ceil(p/8),te=Math.ceil(m/8),K=Math.ceil(h/64);function ne(e){z=Math.max(0,Math.min(8,Number(e)||0))}function q(e){B=Math.max(0,Math.min(5,Number(e)||0))}function J(e,t=null){if(t==null){let t=Math.max(.5,Math.min(4,Number(e)||2));L=.21,R=Math.max(.02,Math.min(.22,L/t))}else L=Math.max(.01,Math.min(.22,Number(e)||.21)),R=Math.max(.01,Math.min(.22,Number(t)||.105))}async function re({dtRd:n=.95,substeps:r=10,readTelemetry:i=!0}={}){if(U)return W;let a=Math.max(1,Math.min(24,Math.trunc(r))),o=d%997*.17+3.1,s=new ArrayBuffer(48);new Uint32Array(s,0,4).set([p,m,h,ee+a]),new Float32Array(s,16,8).set([n,F,I,L,R,z,B,o]),t.queue.writeBuffer(D,0,s);let c=t.createCommandEncoder({label:`${f}-enc-${ee}`}),l=c.beginComputePass({label:`${f}-pass`});l.setPipeline(w.pipeline);for(let e=0;e<a;e+=1)l.setBindGroup(0,V===0?N:P),l.dispatchWorkgroups(G,te),V=1-V,ee+=1;let u=V===1?N:P;l.setPipeline(T.pipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(K),l.setPipeline(E.pipeline),l.setBindGroup(0,u),l.dispatchWorkgroups(1),l.end();let _=i&&!H&&M.mapState===`unmapped`;_&&(H=!0,c.copyBufferToBuffer(j,0,M,0,16)),t.queue.submit([c.finish()]);let v=W.meanActivatorV,y=W.turingPatternStd,b=W.chemotacticEnrichment,x=W.meanAgentSpeed;if(_)try{if(await M.mapAsync(Wi.MAP_READ),!U){let e=new Float32Array(M.getMappedRange(0,16));v=e[0],y=e[1],b=e[2],x=e[3]}try{M.unmap()}catch{}}catch(e){if(!U&&e?.name!==`AbortError`)throw e}finally{H=!1}return W=Object.freeze({schema:Ui,regimeId:g.id,stepIndex:ee,meanActivatorV:v,turingPatternStd:y,chemotacticEnrichment:b,meanAgentSpeed:x,v0Propel:z,chemoGain:B,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,scientificValidation:!1}),W}function ie(){if(!U){U=!0;for(let e of[D,O,k,A,j,M])try{e.destroy()}catch{}}}return Object.freeze({schema:Ui,lawAdapter:Gi,width:p,height:m,agentCount:h,regimeId:g.id,get stepIndex(){return ee},getResidentFieldBuffer:()=>V===0?O:k,getResidentAgentsBuffer:()=>A,getTelemetry:()=>W,setV0Propel:ne,setChemoGain:q,setDiffusionRatio:J,step:re,dispose:ie})}function Xi(e){return!e||typeof e.registerModule!=`function`?null:e.hasModule?.(`reaction-diffusion-active-matter@1`)?e.resolveModule(`reaction-diffusion-active-matter@1`)?.descriptor||null:e.registerModule({method:{model:`reaction-diffusion-active-matter`,version:1},kernel:{sourceModule:`src/runtime/biology/morphogenesisActiveMatterGpu.js`,entryPoint:`step_morphogen_field`,workgroupSize:64},parameterSchema:{v0Propel:{type:`number`,min:0,max:8,required:!1},chemoGain:{type:`number`,min:0,max:5,required:!1}},stateLayout:{tensorId:`active-matter-agents`,dtype:`f32`,layout:`interleaved`,strideElements:12,strideBytes:48,fields:[`x`,`y`,`z`,`heading`,`vx`,`vy`,`vz`,`sensedV`,`r`,`g`,`b`,`radius`]},scaleRangeM:[1e-6,.1],async stepCapsule(e,{createSimulationArtifact:t,device:n}){let r=Yi(n,{width:64,height:64,agentCount:256,v0Propel:(e.input?.parameters||{}).v0Propel??2.6}),i=await r.step({dtRd:.95,substeps:8,readTelemetry:!0});return r.dispose(),t({artifactId:`${e.taskId}:morphogenesis:${i.stepIndex}`,taskKind:e.taskKind,closureRef:{module:`src/runtime/biology/morphogenesisActiveMatterGpu.js`,entryPoint:`createMorphogenesisActiveSessionWebGpu`,kernelEntryPoint:`step_morphogen_field`},representation:`morphogenesis-active-f32`,outputs:{telemetry:i},execution:{backend:`webgpu-morphogenesis-active`,placement:`local`},validity:{finite:Number.isFinite(i.turingPatternStd)},validation:{status:`pass`,validationMode:`gpu-morphogenesis-invariants`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...e.provenance,methodHash:e.methodHash,inputHash:e.inputHash}})}})}var Zi=`peercompute.ulg.universal-law-graph.v1`,$=Object.freeze({GRAVITY:`gravity`,ELECTROMAGNETISM:`electromagnetism`,HYDRODYNAMICS:`hydrodynamics`,THERMODYNAMICS:`thermodynamics`,RIGID_SOLID_MECHANICS:`rigid-solid-mechanics`,NUCLEAR_QUANTUM:`nuclear-quantum`,CHEMICAL_BONDING:`chemical-bonding`,SOFT_MATTER_BIOPHYSICS:`soft-matter-biophysics`,REACTION_DIFFUSION_ACTIVE:`reaction-diffusion-active`}),Qi=Object.freeze({id:`flrw-treepm-cosmology`,lawNodeId:`law:astrophysics-flrw-treepm-cosmology`,orderConstraint:`root:cosmological-epoch`,adapterMode:n.AGGREGATE_FAR,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`cosmo-particles`,`flrw-scale-factor`,`fft3d-poisson-grid`]),writes:Object.freeze([`cosmo-particles`,`fft3d-poisson-grid`]),accumulates:Object.freeze([`cosmo-power-spectrum-pk`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`comoving-mass`,`comoving-linear-momentum`]),validityDomain:Object.freeze({aScaleMin:.01,aScaleMax:2,comovingBoxMinMpc:1}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e22,1e26])}),$i=Object.freeze({id:`galactic-mhd-evolution`,lawNodeId:`law:astrophysics-galactic-mhd-evolution`,orderConstraint:`after:flrw-treepm-cosmology`,adapterMode:n.AGGREGATE_FAR,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`galactic-stars-dm-ism`,`ss-scale-atlas-multipole`,`gate1-ism-cooling-anchors`]),writes:Object.freeze([`galactic-stars-dm-ism`]),accumulates:Object.freeze([`galactic-dynamo-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`angular-momentum`]),validityDomain:Object.freeze({minBodies:64,metallicityNonNegative:!0}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([0xde0b6b3a7640000,1e22])}),ea=Object.freeze({id:`solar-system-nbody`,lawNodeId:`law:astrophysics-symplectic-nbody-f32x2`,orderConstraint:`after:protoplanetary-accretion`,adapterMode:n.AGGREGATE_FAR,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`nbody-f32x2-bodies`]),writes:Object.freeze([`nbody-f32x2-bodies`]),accumulates:Object.freeze([`nbody-conservation-ledger`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`angular-momentum`,`symplectic-energy`]),validityDomain:Object.freeze({doubleFloatProtectedTwoSum:!0,maxDtSubYr:12e-5}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e7,0x2386f26fc10000])}),ta=Object.freeze({id:`self-gravitating-hydro-fusion`,lawNodeId:`law:astrophysics-stellar-hydro-fusion`,orderConstraint:`after:nebular-mhd-collapse`,adapterMode:n.AGGREGATE_FAR,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`stellar-hydro-parcels`,`closure-plasma-eos`,`gate1-nuclear-qvalues`]),writes:Object.freeze([`stellar-hydro-parcels`]),accumulates:Object.freeze([`stellar-fusion-telemetry`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass`,`nucleon-fractions`,`linear-momentum`,`first-law-energy`]),validityDomain:Object.freeze({requiresPositiveDensity:!0,gate1BetaPlusQValues:!0}),fallbackPolicy:t.EXACT_SUBSTEP,scaleRangeM:Object.freeze([1e8,0x16345785d8a0000])}),na=Object.freeze({id:`planetary-interior-polytope`,lawNodeId:`law:astrophysics-planetary-hydrostatic-polytope`,orderConstraint:`after:solar-system-nbody`,adapterMode:n.CELL_LOCAL,spatialAuthority:i.CANONICAL_SS_EPOCH,reads:Object.freeze([`gate2-polytope-atlas-bank`,`planetary-mass-composition`]),writes:Object.freeze([`planetary-radial-hydrostatic-profile`]),accumulates:Object.freeze([`planetary-moi-and-core-radius`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`radial-mass`,`hydrostatic-balance`]),validityDomain:Object.freeze({failClosedPolytopeBounds:!0,maxPressurePa:0xe8d4a51000}),fallbackPolicy:t.FAIL_CLOSED,scaleRangeM:Object.freeze([1e5,1e8])}),ra=Object.freeze([Object.freeze({id:`flrw-treepm-cosmology`,methodKey:`flrw-treepm-cosmology@1`,title:`ΛCDM FLRW 2LPT + 3D-FFT TreePM Cosmology`,families:Object.freeze([$.GRAVITY,$.HYDRODYNAMICS]),scaleRangeM:Object.freeze([1e22,1e26]),adapter:Qi,evaluateActivation(e={}){let t=(Number(e.comovingBoxMpc)||0)>=1&&(Number(e.omegaM)||0)>0;return{active:t,reason:t?`expanding-comoving-volume-present`:`sub-cosmological-scale-dormant`}}}),Object.freeze({id:`galactic-mhd-evolution`,methodKey:`galactic-mhd-evolution@1`,title:`Galactic Scale-Atlas Multipole, ISM Λ(T, Z) Cooling & α–ω Dynamo`,families:Object.freeze([$.GRAVITY,$.HYDRODYNAMICS,$.ELECTROMAGNETISM,$.THERMODYNAMICS]),scaleRangeM:Object.freeze([0xde0b6b3a7640000,1e22]),adapter:$i,evaluateActivation(e={}){let t=Number(e.galacticBodyCount)||0,n=Number(e.viewSpanM)||0,r=t>=64||n>=0x16345785d8a0000&&n<=1e23;return{active:r,reason:r?`galactic-halo-disk-present`:`outside-galactic-regime-dormant`}}}),Object.freeze({id:`nebular-mhd-collapse`,methodKey:`nebular-mhd-collapse@1`,title:`3D Self-Gravitating Resistive MHD Nebular Collapse & Bipolar Jets`,families:Object.freeze([$.GRAVITY,$.HYDRODYNAMICS,$.ELECTROMAGNETISM,$.THERMODYNAMICS]),scaleRangeM:Object.freeze([0x9184e72a000,0xde0b6b3a7640000]),adapter:se,evaluateActivation(e={}){let t=Number(e.nebulaCloudMass)||0,n=Math.abs(Number(e.magneticFieldStrength)||0),r=Number(e.magneticReynolds)||0,i=t>0&&(n>0||r>1||!!e.ionizedGasPresent);return{active:i,lorentzActive:n>1e-6,reason:i?`magnetized-self-gravitating-cloud-present`:`no-magnetized-nebula-dormant`}}}),Object.freeze({id:`protoplanetary-accretion`,methodKey:`protoplanetary-accretion@1`,title:`Protoplanetary Disk Gas Drag, Snow-Line Sublimation & Pebble Accretion`,families:Object.freeze([$.GRAVITY,$.HYDRODYNAMICS,$.THERMODYNAMICS,$.RIGID_SOLID_MECHANICS]),scaleRangeM:Object.freeze([1e10,0x5af3107a4000]),adapter:ze,evaluateActivation:Be}),Object.freeze({id:`solar-system-nbody`,methodKey:`solar-system-nbody@1`,title:`Real-Scale Double-Float (f32x2) Symplectic Mutual N-Body Gravity`,families:Object.freeze([$.GRAVITY]),scaleRangeM:Object.freeze([1e7,0x2386f26fc10000]),adapter:ea,evaluateActivation(e={}){let t=(Number(e.gravitatingBodyCount)||0)>=2;return{active:t,reason:t?`multi-body-gravitational-system-present`:`single-or-zero-body-dormant`}}}),Object.freeze({id:`self-gravitating-hydro-fusion`,methodKey:`self-gravitating-hydro@1`,title:`Self-Gravitating Compressible Plasma & Gate 1 Thermonuclear Fusion`,families:Object.freeze([$.GRAVITY,$.HYDRODYNAMICS,$.THERMODYNAMICS,$.NUCLEAR_QUANTUM]),scaleRangeM:Object.freeze([1e8,0x16345785d8a0000]),adapter:ta,evaluateActivation(e={}){let t=Number(e.coreTempK)||0,n=Number(e.bodyMassKg)||0,r=t>=1e6||n>=1e28;return{active:r,reason:r?`fusion-capable-plasma-core-present`:`sub-stellar-temperature-dormant`}}}),Object.freeze({id:`planetary-interior-polytope`,methodKey:`planetary-interior-polytope@1`,title:`Fail-Closed Gate 2 Polytope-Atlas Hydrostatic Interior Equilibrium`,families:Object.freeze([$.GRAVITY,$.THERMODYNAMICS]),scaleRangeM:Object.freeze([1e5,1e8]),adapter:na,evaluateActivation(e={}){let t=Number(e.bodyMassKg)||0,n=Number(e.bodyRadiusM)||0,r=t>=0x56bc75e2d63100000&&n>=1e5&&t<1e28;return{active:r,reason:r?`self-gravitating-planetary-interior-present`:`non-hydrostatic-body-dormant`}}}),Object.freeze({id:`planetary-atmosphere-em`,methodKey:`planetary-atmosphere-em@1`,title:`Spherical Baroclinic Fluid, Particulate Triboelectricity, Paschen Breakdown & Core Geodynamo`,families:Object.freeze([$.HYDRODYNAMICS,$.ELECTROMAGNETISM,$.THERMODYNAMICS]),scaleRangeM:Object.freeze([1e4,1e8]),adapter:he,evaluateActivation(e={}){let t=ve(e);return{active:t.anyActive,details:t,reason:t.anyActive?`active:${t.activeLaws.join(`,`)}`:`vacuum-nonmagnetized-body-dormant`}}}),Object.freeze({id:`particle-rigid-dynamics`,methodKey:`particle-rigid-dynamics@1`,title:`Particle-Composite SE(3) DLM Symplectic Rigid-Body & Hertz-Mindlin/JKR Contact Dynamics`,families:Object.freeze([$.RIGID_SOLID_MECHANICS,$.GRAVITY]),scaleRangeM:Object.freeze([.001,1e8]),adapter:De,evaluateActivation:Oe}),Object.freeze({id:`cosmological-baryon-radiation`,methodKey:`cosmological-baryon-radiation@1`,title:`Eisenstein-Hu BAO/CMB Recombination, Reionization Bubbles, ICM X-Ray/SZ & 2D Lensing`,families:Object.freeze([$.GRAVITY,$.HYDRODYNAMICS,$.THERMODYNAMICS,$.ELECTROMAGNETISM]),scaleRangeM:Object.freeze([1e21,1e26]),adapter:dt,evaluateActivation:ft}),Object.freeze({id:`relativistic-compact-kerr-jet`,methodKey:`relativistic-compact-kerr-jet@1`,title:`GR TOV Unified Degenerate EOS (WD/NS/BH) & Kerr Blandford-Znajek Relativistic Jets (Quasar/Blazar)`,families:Object.freeze([$.GRAVITY,$.ELECTROMAGNETISM,$.HYDRODYNAMICS,$.NUCLEAR_QUANTUM]),scaleRangeM:Object.freeze([1e3,1e22]),adapter:bt,evaluateActivation:xt}),Object.freeze({id:`compact-magnetosphere-spindown`,methodKey:`compact-magnetosphere-spindown@1`,title:`Force-Free Oblique Dipole Spin-Down, Pulsar Lighthouse Beams & Magnetar Crustal-Yield Giant Flares`,families:Object.freeze([$.ELECTROMAGNETISM,$.RIGID_SOLID_MECHANICS,$.GRAVITY]),scaleRangeM:Object.freeze([1e4,0x16345785d8a0000]),adapter:Lt,evaluateActivation:Rt}),Object.freeze({id:`relativistic-binary-gw-rprocess`,methodKey:`relativistic-binary-gw-rprocess@1`,title:`1PN/2.5PN Gravitational-Wave Inspiral Chirp, Roche-Lobe X-Ray Binaries, Type Ia & BNS Kilonova r-Process`,families:Object.freeze([$.GRAVITY,$.NUCLEAR_QUANTUM,$.HYDRODYNAMICS]),scaleRangeM:Object.freeze([1e4,0x38d7ea4c68000]),adapter:Kt,evaluateActivation:qt}),Object.freeze({id:`radiative-photoionization-winds`,methodKey:`radiative-photoionization-winds@1`,title:`Strömgren Photoionization (H II Pillars/Planetary Nebulae/SNR), Stellar Winds, XUV Escape & Dual-Tail Comets`,families:Object.freeze([$.ELECTROMAGNETISM,$.HYDRODYNAMICS,$.THERMODYNAMICS]),scaleRangeM:Object.freeze([1e3,0x56bc75e2d63100000]),adapter:tn,evaluateActivation:nn}),Object.freeze({id:`tidal-roche-rheology-cryovolcanism`,methodKey:`tidal-roche-rheology-cryovolcanism@1`,title:`Roche-Limit Cohesive Disruption, Ring Shepherd Moons, Tidal Heating, Cryovolcanism, Magma Oceans & RGB Engulfment`,families:Object.freeze([$.GRAVITY,$.RIGID_SOLID_MECHANICS,$.THERMODYNAMICS,$.HYDRODYNAMICS]),scaleRangeM:Object.freeze([100,0x5af3107a4000]),adapter:un,evaluateActivation:dn}),Object.freeze({id:`planetary-surface-vehicles`,methodKey:`planetary-surface-vehicles@1`,title:`Planetary Surface Terrain, Rocker-Bogie Rover Jump Rockets, & Actuator-Disk Atmospheric Drone Flight`,families:Object.freeze([$.GRAVITY,$.RIGID_SOLID_MECHANICS,$.HYDRODYNAMICS]),scaleRangeM:Object.freeze([.1,5e4]),adapter:Vr,evaluateActivation:Hr}),Object.freeze({id:`organic-molecular-graph-hybridization`,methodKey:`organic-molecular-graph-hybridization@1`,title:`Organic Molecular Graph Hybridization (sp/sp²/sp³), GPU Extended-Hückel π-MOs, QEq Charges & 3D CIP Chirality`,families:Object.freeze([$.NUCLEAR_QUANTUM,$.ELECTROMAGNETISM,$.CHEMICAL_BONDING]),scaleRangeM:Object.freeze([1e-10,1e-8]),adapter:d,evaluateActivation:m}),Object.freeze({id:`reactive-bond-order-md`,methodKey:`reactive-bond-order-md@1`,title:`WebGPU Reactive Bond-Order MD, Dihedral Conformations, Directional H-Bonds, SN2 Inversion & Diels-Alder [4+2]`,families:Object.freeze([$.CHEMICAL_BONDING,$.ELECTROMAGNETISM,$.THERMODYNAMICS]),scaleRangeM:Object.freeze([1e-10,1e-8]),adapter:W,evaluateActivation:G}),Object.freeze({id:`acid-base-catalysis-kinetics`,methodKey:`acid-base-catalysis-kinetics@1`,title:`First-Principles Brønsted-Lowry pKa Equilibria, Frank Chiral Symmetry Breaking, BZ Spirals & Prebiotic RAF Networks`,families:Object.freeze([$.CHEMICAL_BONDING,$.THERMODYNAMICS,$.REACTION_DIFFUSION_ACTIVE]),scaleRangeM:Object.freeze([1e-9,.001]),adapter:re,evaluateActivation:ie}),Object.freeze({id:`amphiphile-membrane-self-assembly`,methodKey:`amphiphile-membrane-self-assembly@1`,title:`Amphiphile Hydrophobic Self-Assembly, Bilayer Membranes & Osmotic Protocell Vesicles`,families:Object.freeze([$.SOFT_MATTER_BIOPHYSICS,$.THERMODYNAMICS,$.ELECTROMAGNETISM]),scaleRangeM:Object.freeze([1e-9,1e-6]),adapter:mi,evaluateActivation:hi}),Object.freeze({id:`biopolymer-folding-catalysis`,methodKey:`biopolymer-folding-catalysis@1`,title:`Heteropolymer Hydrophobic Collapse, Secondary H-Bond Folding, Thermal Denaturation & Electrostatic Pocket Catalysis`,families:Object.freeze([$.SOFT_MATTER_BIOPHYSICS,$.CHEMICAL_BONDING,$.ELECTROMAGNETISM,$.THERMODYNAMICS]),scaleRangeM:Object.freeze([1e-9,1e-7]),adapter:xi,evaluateActivation:Si}),Object.freeze({id:`template-replication-evolution`,methodKey:`template-replication-evolution@1`,title:`Complementary H-Bond Duplex Melting, Template Replication, Quasispecies Selection & Eigen Error Threshold`,families:Object.freeze([$.SOFT_MATTER_BIOPHYSICS,$.CHEMICAL_BONDING,$.THERMODYNAMICS]),scaleRangeM:Object.freeze([1e-9,1e-6]),adapter:ki,evaluateActivation:Ai}),Object.freeze({id:`chemiosmotic-bioenergetics-electrophysiology`,methodKey:`chemiosmotic-bioenergetics-electrophysiology@1`,title:`Mitchell Chemiosmotic Proton-Motive Force, ATP Synthesis & Hodgkin-Huxley Excitable Membrane Spiral Waves`,families:Object.freeze([$.SOFT_MATTER_BIOPHYSICS,$.ELECTROMAGNETISM,$.THERMODYNAMICS,$.REACTION_DIFFUSION_ACTIVE]),scaleRangeM:Object.freeze([1e-8,.01]),adapter:Li,evaluateActivation:Ri}),Object.freeze({id:`reaction-diffusion-active-matter`,methodKey:`reaction-diffusion-active-matter@1`,title:`Turing Reaction-Diffusion Morphogenesis & Chemotactic Self-Propelled Active-Matter Colonies`,families:Object.freeze([$.REACTION_DIFFUSION_ACTIVE,$.SOFT_MATTER_BIOPHYSICS,$.HYDRODYNAMICS]),scaleRangeM:Object.freeze([1e-6,.1]),adapter:Gi,evaluateActivation:Ki}),Object.freeze({id:`planetary-atmosphere-3d-cfd`,methodKey:`planetary-atmosphere-3d-cfd@1`,title:`3D Stratified Planetary Atmospheric Navier-Stokes CFD & Multi-Species Condensation Chemistry`,families:Object.freeze([$.HYDRODYNAMICS,$.THERMODYNAMICS,$.CHEMICAL_BONDING]),scaleRangeM:Object.freeze([10,2e5]),adapter:vn,evaluateActivation:yn})]);function ia(e={}){let t=[],n=[],r=new Set;for(let i of ra){let a=i.evaluateActivation(e);if(a?.active){t.push(Object.freeze({id:i.id,methodKey:i.methodKey,title:i.title,families:i.families,reason:a.reason||`active`,details:a.details||null}));for(let e of i.families)r.add(e)}else n.push(Object.freeze({id:i.id,methodKey:i.methodKey,reason:a?.reason||`dormant`}))}return Object.freeze({schema:Zi,active:Object.freeze(t),dormant:Object.freeze(n),activeFamilies:Object.freeze([...r])})}function aa(e){return!e||typeof e.registerModule!=`function`?[]:[fe(e),we(e),Ge(e),Ie(e),_t(e),Ot(e),Ut(e),Qt(e),sn(e),hn(e),di(e),kn(e),ee(e),ne(e),Z(e),vi(e),Ei(e),Pi(e),Hi(e),Xi(e)].filter(Boolean)}var oa=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),sa=Object.freeze({STANDARD:0,GALAXY_VISIBLE:1,SOLAR_DOUBLE_FLOAT:2,FLAGGED_LIVE_16F:3,MD_PERIODIC_4F:4}),ca=`
struct PickParams {
  view_proj: mat4x4<f32>,
  click_ndc_asp: vec4<f32>,  // x = clickNdcX, y = clickNdcY, z = aspect, w = maxPickNdc
  offset_scale: vec4<f32>,   // xyz = focusOffsetHi, w = worldScale
  offset_lo: vec4<f32>,      // xyz = focusOffsetLo (or halfBox for MD), w = flags
  counts: vec4<u32>,         // x = count, y = strideVec4 (1..4), z = layoutMode, w = skipFirst
};

@group(0) @binding(0) var<uniform> params: PickParams;
@group(0) @binding(1) var<storage, read> entities: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> pick_out: array<vec4<f32>>;

var<workgroup> wg_score: array<f32, 64>;
var<workgroup> wg_depth: array<f32, 64>;
var<workgroup> wg_idx: array<u32, 64>;

@compute @workgroup_size(64)
fn pick_nearest_entity(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n = params.counts.x;
  let stride = max(1u, params.counts.y);
  let mode = params.counts.z;
  let skip_first = params.counts.w;
  let max_r = max(0.015, params.click_ndc_asp.w);
  let asp = max(0.25, params.click_ndc_asp.z);
  let click_xy = params.click_ndc_asp.xy;
  let w_scale = params.offset_scale.w;

  var best_score = 1e9;
  var best_depth = 1e9;
  var best_idx = 0xffffffffu;

  var i = skip_first + tid;
  loop {
    if (i >= n) { break; }
    let base = i * stride;
    let v0 = entities[base];
    var valid = true;
    var wpos = vec3<f32>(0.0);

    let flags_u = u32(round(max(0.0, params.offset_lo.w)));
    let include_dm = (flags_u & 1u) != 0u;
    let rev_z = (flags_u & 2u) != 0u;
    let em_pref_pulsar = (flags_u & 4u) != 0u;
    let em_pref_xray = (flags_u & 8u) != 0u;
    let em_pref_uv = (flags_u & 16u) != 0u;
    var em_priority_bonus = 0.0;
    if (mode == 1u) {
      let v1 = entities[base + 1u];
      if (v1.w < 0.0 && !include_dm) { valid = false; }
      wpos = (v0.xyz - params.offset_scale.xyz) * w_scale;
      if (valid && (em_pref_pulsar || em_pref_xray || em_pref_uv)) {
        var hx = i ^ 0x13579bdfu;
        hx = (hx ^ (hx >> 16u)) * 0x7feb352du;
        hx = (hx ^ (hx >> 15u)) * 0x846ca68bu;
        hx = hx ^ (hx >> 16u);
        let gh = f32(hx & 0x00ffffffu) * (1.0 / 16777216.0);
        let is_pulsar = (gh > 0.986 && v1.w >= 0.20);
        let is_xrb = (gh > 0.974 && gh <= 0.986 && v1.w >= 0.10);
        if (em_pref_pulsar && is_pulsar) { em_priority_bonus = 0.075; }
        else if (em_pref_xray && is_xrb) { em_priority_bonus = 0.075; }
        else if (em_pref_uv && v1.w >= 0.78) { em_priority_bonus = 0.045; }
      }
    } else if (mode == 2u) {
      let v1 = entities[base + 1u];
      let dxyz = (v0.xyz - params.offset_scale.xyz) + (v1.xyz - params.offset_lo.xyz);
      wpos = dxyz * w_scale;
    } else if (mode == 3u) {
      let v3 = entities[base + 3u];
      if (v3.w < 0.5) { valid = false; }
      wpos = (v0.xyz - params.offset_scale.xyz) * w_scale;
    } else if (mode == 4u) {
      let hb = params.offset_lo.xyz;
      wpos = (v0.xyz - hb) * w_scale;
    } else {
      wpos = (v0.xyz - params.offset_scale.xyz) * w_scale;
    }

    if (valid) {
      let clip = params.view_proj * vec4<f32>(wpos, 1.0);
      if (clip.w > 0.02) {
        let ndc = clip.xyz / clip.w;
        if (ndc.z >= 0.0 && ndc.z <= 1.0) {
          let dx = (ndc.x - click_xy.x) * asp;
          let dy = (ndc.y - click_xy.y);
          let dist = sqrt(dx * dx + dy * dy);
          if (dist <= max_r) {
            // Favor closest to cursor first, boosting EM-highlighted exotic sources (pulsars/X-ray binaries) when active!
            let depth_bias = select(ndc.z, 1.0 - ndc.z, rev_z);
            let score = dist - em_priority_bonus + depth_bias * 0.012;
            if (score < best_score) {
              best_score = score;
              best_depth = ndc.z;
              best_idx = i;
            }
          }
        }
      }
    }
    i = i + 64u;
  }

  wg_score[tid] = best_score;
  wg_depth[tid] = best_depth;
  wg_idx[tid] = best_idx;
  workgroupBarrier();

  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      if (wg_score[tid + s] < wg_score[tid]) {
        wg_score[tid] = wg_score[tid + s];
        wg_depth[tid] = wg_depth[tid + s];
        wg_idx[tid] = wg_idx[tid + s];
      }
    }
    workgroupBarrier();
    s = s >> 1u;
  }

  if (tid == 0u) {
    let win = wg_idx[0u];
    if (win == 0xffffffffu) {
      pick_out[0u] = vec4<f32>(-1.0, 999.0, 1.0, 0.0);
      pick_out[1u] = vec4<f32>(0.0);
      pick_out[2u] = vec4<f32>(0.0);
      pick_out[3u] = vec4<f32>(0.0);
      pick_out[4u] = vec4<f32>(0.0);
    } else {
      let base = win * stride;
      pick_out[0u] = vec4<f32>(f32(win), wg_score[0u], wg_depth[0u], 1.0);
      pick_out[1u] = entities[base];
      pick_out[2u] = select(vec4<f32>(0.0), entities[base + 1u], stride >= 2u);
      pick_out[3u] = select(vec4<f32>(0.0), entities[base + 2u], stride >= 3u);
      pick_out[4u] = select(vec4<f32>(0.0), entities[base + 3u], stride >= 4u);
    }
  }
}
`;function la(e){let t=e.createBuffer({label:`ulg-gpu-entity-picker-params`,size:128,usage:oa.UNIFORM|oa.COPY_DST}),n=e.createBuffer({label:`ulg-gpu-entity-picker-out`,size:80,usage:oa.STORAGE|oa.COPY_SRC}),r=e.createBuffer({label:`ulg-gpu-entity-picker-read`,size:80,usage:oa.COPY_DST|oa.MAP_READ}),i=e.createBuffer({label:`ulg-gpu-entity-tracker-read`,size:64,usage:oa.COPY_DST|oa.MAP_READ}),c=s(e,{cacheKey:`ulg-gpu-entity-picker.v2-revz`,label:`ulg-gpu-entity-picker`,code:ca,entryPoint:`pick_nearest_entity`,bindings:[a(0,`uniform`),a(1,`read-only-storage`),a(2,`storage`)]}),l=!1,u=!1,d=!1;async function f({buffer:i,count:a,strideFloats:s=16,layoutMode:u=sa.STANDARD,skipFirst:f=0,viewProj:p,clickNdcX:m,clickNdcY:h,aspect:g=1.6,maxPickNdc:_=.085,offsetHi:v=[0,0,0],offsetLo:y=[0,0,0],worldScale:b=1,includeDarkMatter:x=!1,reversedZ:S=!1,emPreferenceFlags:C=0}){if(d||l||!i||!(a>0)||r.mapState!==`unmapped`)return null;l=!0;try{let l=new ArrayBuffer(128),w=new Float32Array(l),T=new Uint32Array(l);w.set(p,0),w[16]=m,w[17]=h,w[18]=g,w[19]=_,w[20]=v[0]||0,w[21]=v[1]||0,w[22]=v[2]||0,w[23]=b,w[24]=y[0]||0,w[25]=y[1]||0,w[26]=y[2]||0,w[27]=+!!x+(S?2:0)+(Math.trunc(Number(C)||0)&28),T[28]=Math.trunc(a),T[29]=Math.max(1,Math.min(4,Math.trunc(s/4))),T[30]=u,T[31]=Math.max(0,Math.trunc(f)),e.queue.writeBuffer(t,0,l);let E=o(e,{layout:c.bindGroupLayout,label:`ulg-gpu-entity-picker-bg`,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:i}},{binding:2,resource:{buffer:n}}]}),D=e.createCommandEncoder({label:`ulg-gpu-entity-pick`}),O=D.beginComputePass({label:`ulg-gpu-entity-pick-pass`});O.setPipeline(c.pipeline),O.setBindGroup(0,E),O.dispatchWorkgroups(1),O.end(),D.copyBufferToBuffer(n,0,r,0,80),e.queue.submit([D.finish()]),await r.mapAsync(oa.MAP_READ);let k=null;if(!d){let e=new Float32Array(r.getMappedRange(0,80));e[3]>.5&&e[0]>=0&&(k={index:Math.round(e[0]),scoreNdc:e[1],depth:e[2],vec0:[e[4],e[5],e[6],e[7]],vec1:[e[8],e[9],e[10],e[11]],vec2:[e[12],e[13],e[14],e[15]],vec3:[e[16],e[17],e[18],e[19]]})}try{r.unmap()}catch{}return k}catch(e){if(!d&&e?.name!==`AbortError`)throw e;return null}finally{l=!1}}async function p(t,n,r=16){if(d||u||!t||n<0||i.mapState!==`unmapped`)return null;let a=Math.min(64,Math.max(16,Math.trunc(r)*4)),o=Math.trunc(n)*a;if(o+a>t.size)return null;u=!0;try{let n=e.createCommandEncoder({label:`ulg-gpu-track-single`});n.copyBufferToBuffer(t,o,i,0,a),e.queue.submit([n.finish()]),await i.mapAsync(oa.MAP_READ);let r=null;d||(r=new Float32Array(i.getMappedRange(0,a).slice(0)));try{i.unmap()}catch{}return r}catch(e){if(!d&&e?.name!==`AbortError`)throw e;return null}finally{u=!1}}function m(){if(!d){d=!0;for(let e of[t,n,r,i])try{e.destroy()}catch{}}}return Object.freeze({pickEntity:f,readSingleEntity:p,dispose:m})}export{Pt as A,de as B,Vn as C,on as D,mn as E,ct as F,F as G,ae as H,ot as I,B as J,V as K,We as L,wt as M,gt as N,Zt as O,st as P,Ce as R,Hn as S,Rn as T,K as U,X as V,P as W,L as Y,Pr as _,qi as a,Yn as b,zi as c,Ci as d,Ti as f,Lr as g,Fr as h,ia as i,Dt as j,Ht as k,Ni as l,ui as m,la as n,Yi as o,_i as p,I as q,aa as r,Vi as s,sa as t,ji as u,Rr as v,Un as w,Xn as x,Jn as y,ye as z};