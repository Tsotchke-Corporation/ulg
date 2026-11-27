import{Ha as e}from"./src-B-qApvaQ.js";import{g as t,m as n}from"./webgpuComputeLayout-CHUyeeFd.js";var r=Object.freeze(`H.He.Li.Be.B.C.N.O.F.Ne.Na.Mg.Al.Si.P.S.Cl.Ar.K.Ca.Sc.Ti.V.Cr.Mn.Fe.Co.Ni.Cu.Zn.Ga.Ge.As.Se.Br.Kr.Rb.Sr.Y.Zr.Nb.Mo.Tc.Ru.Rh.Pd.Ag.Cd.In.Sn.Sb.Te.I.Xe.Cs.Ba.La.Ce.Pr.Nd.Pm.Sm.Eu.Gd.Tb.Dy.Ho.Er.Tm.Yb.Lu.Hf.Ta.W.Re.Os.Ir.Pt.Au.Hg.Tl.Pb.Bi.Po.At.Rn.Fr.Ra.Ac.Th.Pa.U.Np.Pu.Am.Cm.Bk.Cf.Es.Fm.Md.No.Lr.Rf.Db.Sg.Bh.Hs.Mt.Ds.Rg.Cn.Nh.Fl.Mc.Lv.Ts.Og`.split(`.`)),i=Object.freeze([1.008,4.0026,6.94,9.0122,10.81,12.011,14.007,15.999,18.998,20.18,22.99,24.305,26.982,28.085,30.974,32.06,35.45,39.948,39.098,40.078,44.956,47.867,50.942,51.996,54.938,55.845,58.933,58.693,63.546,65.38,69.723,72.63,74.922,78.971,79.904,83.798,85.468,87.62,88.906,91.224,92.906,95.95,98,101.07,102.91,106.42,107.87,112.41,114.82,118.71,121.76,127.6,126.9,131.29,132.91,137.33,138.91,140.12,140.91,144.24,145,150.36,151.96,157.25,158.93,162.5,164.93,167.26,168.93,173.05,174.97,178.49,180.95,183.84,186.21,190.23,192.22,195.08,196.97,200.59,204.38,207.2,208.98,209,210,222,223,226,227,232.04,231.04,238.03,237,244,243,247,247,251,252,257,258,259,266,267,268,269,270,269,278,281,282,285,286,289,290,293,294,294]),a=16605390666e-37;function o(e){return i[e-1]*a}var s=Object.freeze({0:2,1:6,2:10,3:14}),c=[`s`,`p`,`d`,`f`];function l(e){return r[e-1]??null}function u(e){let t=r.indexOf(e);return t>=0?t+1:null}function d(){let e=[];for(let t=1;t<=8;t+=1)for(let n=0;n<t&&n<=3;n+=1)e.push({n:t,l:n});return e.sort((e,t)=>e.n+e.l-(t.n+t.l)||e.n-t.n),e}var f=d(),p={24:{"3,2":5,"4,0":1},29:{"3,2":10,"4,0":1},41:{"4,2":4,"5,0":1},42:{"4,2":5,"5,0":1},44:{"4,2":7,"5,0":1},45:{"4,2":8,"5,0":1},46:{"4,2":10,"5,0":0},47:{"4,2":10,"5,0":1},57:{"4,3":0,"5,2":1,"6,0":2},58:{"4,3":1,"5,2":1,"6,0":2},64:{"4,3":7,"5,2":1,"6,0":2},78:{"4,3":14,"5,2":9,"6,0":1},79:{"4,3":14,"5,2":10,"6,0":1},89:{"5,3":0,"6,2":1,"7,0":2},90:{"5,3":0,"6,2":2,"7,0":2},91:{"5,3":2,"6,2":1,"7,0":2},92:{"5,3":3,"6,2":1,"7,0":2},93:{"5,3":4,"6,2":1,"7,0":2},96:{"5,3":7,"6,2":1,"7,0":2}};function m(e,{applyAnomalies:t=!0}={}){if(!Number.isInteger(e)||e<1||e>118)throw RangeError(`Z out of range: ${e}`);let n=new Map,r=e;for(let{n:e,l:t}of f){if(r<=0)break;let i=Math.min(s[t],r);n.set(`${e},${t}`,i),r-=i}if(t&&p[e])for(let[t,r]of Object.entries(p[e]))r===0?n.delete(t):n.set(t,r);let i=[];for(let[e,t]of n){if(t<=0)continue;let[n,r]=e.split(`,`).map(Number);i.push({n,l:r,occupancy:t})}return i.sort((e,t)=>e.n-t.n||e.l-t.l),i}function h(e,t){let n=m(e,t),r=new Map(f.map((e,t)=>[`${e.n},${e.l}`,t]));return[...n].sort((e,t)=>(r.get(`${e.n},${e.l}`)??99)-(r.get(`${t.n},${t.l}`)??99)).map(e=>`${e.n}${c[e.l]}${e.occupancy}`).join(` `)}function g(e,t){return m(e,t).map(({n:e,l:t,occupancy:n})=>{let r=2*t+1,i=Math.min(n,r);return{n:e,l:t,occUp:i,occDown:n-i}})}function _(e,t){return g(e,t).reduce((e,t)=>e+(t.occUp-t.occDown),0)}function v(e,t){let n=m(e,t),r=n.reduce((e,t)=>Math.max(e,t.n),0);return n.filter(e=>e.n===r&&(e.l===0||e.l===1)).reduce((e,t)=>e+t.occupancy,0)}var y=`peercompute.ulg.law-adapter-contract.v1`,b=Object.freeze({CELL_LOCAL:`cell-local`,EXACT_NEAR:`exact-near`,CROSS_LEVEL:`cross-level`,AGGREGATE_FAR:`aggregate-far`,SOLID_PROXY:`solid-proxy`,SURFACE_INTERFACE:`surface-interface`,GLOBAL_REDUCTION:`global-reduction`}),x=new Set(Object.values(b)),S=Object.freeze({CANONICAL_SS_EPOCH:`canonical-ss-epoch`,LEGACY_PRIVATE_GRID:`legacy-private-grid`}),C=new Set(Object.values(S)),w=Object.freeze({STRICT:`strict`,ASYNC:`async`,FROZEN:`frozen`,EXACT_SUBSTEP:`exact-substep`,DIRECT_PAIR:`direct-pair`,DORMANT_SKIP:`dormant-skip`,FAIL_CLOSED:`fail-closed`}),T=new Set(Object.values(w)),E=Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`mls-mpm-mechanics`,`mls-mpm-grid-velocity`,`exact-energy-ledger`,`exact-mass-ledger`,`solid-rigid-frames`]);function D(e){return Array.isArray(e)?[...new Set(e.map(e=>String(e??``).trim()).filter(Boolean))]:[]}function O(e,{requireExtendedMetadata:t=!1}={}){let n=[],r=[];if(!e||typeof e!=`object`)return Object.freeze({valid:!1,errors:Object.freeze([`law-adapter-not-object`]),debt:Object.freeze([])});let i=String(e.id??e.lawId??``).trim();i||n.push(`law-adapter-missing-id`),D(e.reads);let a=D(e.writes),o=D(e.accumulates),s=new Set(a);for(let e of o)s.has(e)&&n.push(`stage-writes-and-accumulates-same-resource:${i||`unknown`}:${e}`);if((e.adapterMode!==void 0||t)&&(x.has(e.adapterMode)||n.push(`invalid-adapter-mode:${i||`unknown`}:${String(e.adapterMode)}`)),(e.fallbackPolicy!==void 0||t)&&(T.has(e.fallbackPolicy)||n.push(`invalid-fallback-policy:${i||`unknown`}:${String(e.fallbackPolicy)}`)),(e.spatialAuthority!==void 0||t)&&(C.has(e.spatialAuthority)?e.spatialAuthority===S.LEGACY_PRIVATE_GRID&&r.push(`legacy-private-grid:${i||`unknown`}`):n.push(`invalid-spatial-authority:${i||`unknown`}:${String(e.spatialAuthority)}`)),t){Array.isArray(e.conservedQuantities)||n.push(`missing-conserved-quantities:${i||`unknown`}`),(!e.validityDomain||typeof e.validityDomain!=`object`)&&n.push(`missing-validity-domain:${i||`unknown`}`);let t=e.pairedVolumeState;t!==`not-applicable`&&!(t&&typeof t==`object`&&typeof t.v0Lane==`string`&&typeof t.jLane==`string`)&&n.push(`invalid-paired-volume-state:${i||`unknown`}`)}return Object.freeze({valid:n.length===0,errors:Object.freeze(n),debt:Object.freeze(r)})}function k(e,{requireExtendedMetadata:t=!1,handoffCompatibleResources:n=E}={}){let r=[],i=[];if(!e||typeof e!=`object`||!Array.isArray(e.stages))return Object.freeze({schema:y,valid:!1,errors:Object.freeze([`fused-law-plan-invalid-structure`]),debt:Object.freeze([]),stageCount:0,exclusiveWritersByResource:Object.freeze({}),accumulatorsByResource:Object.freeze({})});let a=Array.isArray(e.requiredStageOrder)?e.requiredStageOrder:[],o=new Map(a.map((e,t)=>[e,t])),s=new Set(n),c=new Set,l=new Map,u=new Map;for(let n of e.stages){if(!n||typeof n!=`object`){r.push(`stage-entry-not-object`);continue}let e=String(n.id??n.lawId??``).trim();if(!e){r.push(`stage-missing-id`);continue}c.has(e)&&r.push(`duplicate-stage-id:${e}`),c.add(e),!t&&(!n.lawNodeId||!n.orderConstraint)&&r.push(`stage-missing-contract-metadata:${e}`);let a=O(n,{requireExtendedMetadata:t});for(let e of a.errors)r.push(e);for(let e of a.debt)i.push(e);let d=D(n.reads),f=D(n.writes),p=D(n.accumulates);for(let t of p)u.has(t)||u.set(t,[]),u.get(t).push(e);for(let t of f){l.has(t)||l.set(t,[]);let n=l.get(t);if(n.length>0){let i=o.get(e),a=o.get(n[n.length-1]);s.has(t)&&Number.isInteger(a)&&Number.isInteger(i)&&i>a&&d.includes(t)||r.push(`illegal-double-writer:${t}:${n[n.length-1]}+${e}`)}n.push(e)}}return Object.freeze({schema:y,valid:r.length===0,errors:Object.freeze(r),debt:Object.freeze(i),stageCount:e.stages.length,exclusiveWritersByResource:Object.freeze(Object.fromEntries([...l.entries()].map(([e,t])=>[e,Object.freeze([...t])]))),accumulatorsByResource:Object.freeze(Object.fromEntries([...u.entries()].map(([e,t])=>[e,Object.freeze([...t])])))})}function A(e,t={}){let n=k(e,t);if(!n.valid){let e=Error(`Invalid ULG law adapter schedule: ${n.errors.join(`, `)}`);throw e.code=`ERR_LAW_ADAPTER_SCHEDULE_INVALID`,e.validation=n,e}return n}var j=Object.freeze([Object.freeze({id:`mls-mpm-p2g`,lawNodeId:`law:mechanics-p2g`,orderConstraint:`before:mls-mpm-grid-update`,adapterMode:b.CELL_LOCAL,spatialAuthority:S.CANONICAL_SS_EPOCH,reads:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`mls-mpm-mechanics`]),writes:Object.freeze([`mls-mpm-grid-velocity`]),accumulates:Object.freeze([`mls-mpm-grid-momentum`]),pairedVolumeState:Object.freeze({v0Lane:`mls-mpm-mechanics.restVolume`,jLane:`mls-mpm-mechanics.F`}),conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`angular-momentum`]),validityDomain:Object.freeze({cflMax:1,requiresFiniteF:!0}),fallbackPolicy:w.EXACT_SUBSTEP}),Object.freeze({id:`mls-mpm-grid-update`,lawNodeId:`law:mechanics-grid-update`,orderConstraint:`after:mls-mpm-p2g`,adapterMode:b.CELL_LOCAL,spatialAuthority:S.CANONICAL_SS_EPOCH,reads:Object.freeze([`mls-mpm-grid-velocity`,`mls-mpm-grid-momentum`]),writes:Object.freeze([`mls-mpm-grid-velocity`]),accumulates:Object.freeze([]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`linear-momentum`]),validityDomain:Object.freeze({finiteGravity:!0}),fallbackPolicy:w.FAIL_CLOSED}),Object.freeze({id:`implicit-pressure-solve`,lawNodeId:`law:implicit-pressure-projection`,orderConstraint:`after:mls-mpm-grid-update`,adapterMode:b.CELL_LOCAL,spatialAuthority:S.CANONICAL_SS_EPOCH,reads:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`mls-mpm-mechanics`,`mls-mpm-grid-velocity`]),writes:Object.freeze([`mls-mpm-grid-velocity`]),accumulates:Object.freeze([`implicit-pressure-cg-scratch`]),pairedVolumeState:Object.freeze({v0Lane:`mls-mpm-mechanics.restVolumeM3`,jLane:`mls-mpm-mechanics.volumeRatioJ`}),conservedQuantities:Object.freeze([`linear-momentum`,`incompressibility-divergence`]),validityDomain:Object.freeze({cavitationFloorGaugePa:0,eshkolStiffnessDomain:Object.freeze([.9,1.1])}),fallbackPolicy:w.DORMANT_SKIP}),Object.freeze({id:`mls-mpm-g2p`,lawNodeId:`law:mechanics-g2p`,orderConstraint:`after:implicit-pressure-solve`,adapterMode:b.CELL_LOCAL,spatialAuthority:S.CANONICAL_SS_EPOCH,reads:Object.freeze([`sph-particle-state`,`mls-mpm-mechanics`,`mls-mpm-grid-velocity`]),writes:Object.freeze([`sph-particle-state`,`mls-mpm-mechanics`]),accumulates:Object.freeze([]),pairedVolumeState:Object.freeze({v0Lane:`mls-mpm-mechanics.restVolumeM3`,jLane:`mls-mpm-mechanics.volumeRatioJ`}),conservedQuantities:Object.freeze([`mass`,`linear-momentum`]),validityDomain:Object.freeze({maxDisplacementCells:1}),fallbackPolicy:w.EXACT_SUBSTEP}),Object.freeze({id:`thermal-conduction-radiation`,lawNodeId:`law:thermal-conduction-radiation`,orderConstraint:`after:mls-mpm-g2p`,adapterMode:b.EXACT_NEAR,spatialAuthority:S.CANONICAL_SS_EPOCH,reads:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`exact-energy-ledger`]),writes:Object.freeze([`sph-thermo-phase`,`exact-energy-ledger`]),accumulates:Object.freeze([`thermal-flux-proposals`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`internal-energy-minus-entropy-2e-149`]),validityDomain:Object.freeze({temperatureMinK:.001,usesG6Uncertainty:!0}),fallbackPolicy:w.DORMANT_SKIP}),Object.freeze({id:`reaction-discovery-apply`,lawNodeId:`law:chemistry-reaction`,orderConstraint:`after:thermal-conduction-radiation`,adapterMode:b.EXACT_NEAR,spatialAuthority:S.CANONICAL_SS_EPOCH,reads:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`exact-mass-ledger`,`exact-energy-ledger`]),writes:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`exact-mass-ledger`,`exact-energy-ledger`]),accumulates:Object.freeze([`reaction-proposals`]),pairedVolumeState:`not-applicable`,conservedQuantities:Object.freeze([`mass-2e-149`,`atoms`,`internal-energy-2e-149`]),validityDomain:Object.freeze({requiresBalancedStoichiometry:!0}),fallbackPolicy:w.DORMANT_SKIP}),Object.freeze({id:`phase-carrier-transfer`,lawNodeId:`law:phase-change`,orderConstraint:`after:reaction-discovery-apply`,adapterMode:b.CELL_LOCAL,spatialAuthority:S.CANONICAL_SS_EPOCH,reads:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`mls-mpm-mechanics`,`exact-mass-ledger`,`exact-energy-ledger`]),writes:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`mls-mpm-mechanics`,`exact-mass-ledger`,`exact-energy-ledger`]),accumulates:Object.freeze([]),pairedVolumeState:Object.freeze({v0Lane:`mls-mpm-mechanics.restVolume`,jLane:`mls-mpm-mechanics.F`}),conservedQuantities:Object.freeze([`mass-2e-149`,`internal-energy-2e-149`,`linear-momentum`]),validityDomain:Object.freeze({usesPhaseWindowsAndG6Uncertainty:!0}),fallbackPolicy:w.DORMANT_SKIP}),Object.freeze({id:`phase-slot-refinement`,lawNodeId:`law:dynamic-material-volume-lod`,orderConstraint:`after:phase-carrier-transfer`,adapterMode:b.SURFACE_INTERFACE,spatialAuthority:S.CANONICAL_SS_EPOCH,reads:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`mls-mpm-mechanics`,`exact-mass-ledger`,`exact-energy-ledger`]),writes:Object.freeze([`sph-particle-state`,`sph-thermo-phase`,`mls-mpm-mechanics`,`exact-mass-ledger`,`exact-energy-ledger`]),accumulates:Object.freeze([`phase-slot-refinement-evidence`]),pairedVolumeState:Object.freeze({v0Lane:`mls-mpm-mechanics.restVolumeM3`,jLane:`mls-mpm-mechanics.volumeRatioJ`}),conservedQuantities:Object.freeze([`mass-2e-149`,`internal-energy-minus-entropy-2e-149`,`linear-momentum`,`first-moment`,`represented-volume`]),validityDomain:Object.freeze({fluidLanes:Object.freeze([1,2]),requiresStateManagerAdmission:!0}),fallbackPolicy:w.DORMANT_SKIP}),Object.freeze({id:`coherent-solids-rigid-and-coupling`,lawNodeId:`law:coherent-solids`,orderConstraint:`after:phase-slot-refinement`,adapterMode:b.SOLID_PROXY,spatialAuthority:S.CANONICAL_SS_EPOCH,reads:Object.freeze([`solid-rigid-frames`,`sph-particle-state`,`sph-thermo-phase`]),writes:Object.freeze([`solid-rigid-frames`,`sph-particle-state`,`sph-thermo-phase`]),accumulates:Object.freeze([`solid-impulse-ledger`]),pairedVolumeState:Object.freeze({v0Lane:`solid-members.restVolume`,jLane:`solid-frames.pose`}),conservedQuantities:Object.freeze([`mass`,`linear-momentum`,`angular-momentum`,`internal-energy`]),validityDomain:Object.freeze({requiresNonDegenerateInertia:!0}),fallbackPolicy:w.FAIL_CLOSED})]),M=globalThis.GPUShaderStage?.COMPUTE??4;function N(e,t,{visibility:n=M,uniformBindings:r=[]}={}){let i=O(e);if(!i.valid){let e=Error(`Cannot derive bind-group layout for invalid law descriptor: ${i.errors.join(`, `)}`);throw e.code=`ERR_LAW_DESCRIPTOR_INVALID`,e}if(!t||typeof t!=`object`)throw TypeError(`resourceBindingTable must map resource names to non-negative integer binding indices`);let a=D(e.reads),o=D(e.writes),s=D(e.accumulates),c=new Set([...o,...s]),l=[...new Set([...a,...o,...s])],u=new Map;for(let r of l){let i=t[r];if(!Number.isSafeInteger(i)||i<0){let t=RangeError(`Law "${e.id}" declares resource "${r}" which has no valid binding index in resourceBindingTable`);throw t.code=`ERR_LAW_BINDING_MISSING`,t}if(u.has(i)){let t=Error(`Law "${e.id}" binding index ${i} collision between "${u.get(i).resource}" and "${r}"`);throw t.code=`ERR_LAW_BINDING_COLLISION`,t}u.set(i,{resource:r,entry:Object.freeze({binding:i,visibility:n,buffer:Object.freeze({type:c.has(r)?`storage`:`read-only-storage`})})})}for(let t of r){let r=typeof t==`number`?t:t?.binding,i=typeof t==`object`&&t?.minBindingSize>0?t.minBindingSize:void 0;if(!Number.isSafeInteger(r)||r<0)throw RangeError(`Law "${e.id}" uniform binding index must be a non-negative integer`);if(u.has(r)){let t=Error(`Law "${e.id}" uniform binding ${r} collides with storage resource "${u.get(r).resource}"`);throw t.code=`ERR_LAW_BINDING_COLLISION`,t}u.set(r,{resource:`uniform:${r}`,entry:Object.freeze({binding:r,visibility:n,buffer:Object.freeze({type:`uniform`,...i===void 0?{}:{minBindingSize:i}})})})}let d=[...u.entries()].sort((e,t)=>e[0]-t[0]).map(([,e])=>e.entry);return Object.freeze(d)}function P(e,t,n,r={}){let i=N(e,t,r);if(!Array.isArray(n))throw TypeError(`Law "${e.id}": boundEntries must be an array`);let a=i.map(e=>e.binding),o=n.map(e=>e?.binding),s=new Set(o);if(s.size!==n.length){let t=Error(`Law "${e.id}": duplicate binding index in bind-group entries`);throw t.code=`ERR_LAW_BIND_GROUP_DUPLICATE`,t}let c=a.filter(e=>!s.has(e)),l=o.filter(e=>!a.includes(e));if(c.length>0||l.length>0){let t=Error(`Law "${e.id}": bind-group mismatch (missing=[${c.join(`,`)}], extra=[${l.join(`,`)}])`);throw t.code=`ERR_LAW_BIND_GROUP_MISMATCH`,t.missing=Object.freeze(c),t.extra=Object.freeze(l),t}return i}var F=`ulg.nuclear.structure-webgpu.v1`,I=`nuclear-ldm-strutinsky-ws-wkb.v1`,L=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),R=15.8,z=17.8,B=.711,ee=11.18,te=Object.freeze([2,8,20,28,50,82,126,184]),V=938.27208816,H=939.56542052,U=.51099895,W=931.49410242,G=197.3269804,ne=1/137.035999084,re=52917.7210903,K=Object.freeze([{label:`1s1/2`,n:1,l:0,twoJ:1},{label:`1p3/2`,n:1,l:1,twoJ:3},{label:`1p1/2`,n:1,l:1,twoJ:1},{label:`1d5/2`,n:1,l:2,twoJ:5},{label:`2s1/2`,n:2,l:0,twoJ:1},{label:`1d3/2`,n:1,l:2,twoJ:3},{label:`1f7/2`,n:1,l:3,twoJ:7},{label:`2p3/2`,n:2,l:1,twoJ:3},{label:`1f5/2`,n:1,l:3,twoJ:5},{label:`2p1/2`,n:2,l:1,twoJ:1},{label:`1g9/2`,n:1,l:4,twoJ:9},{label:`1g7/2`,n:1,l:4,twoJ:7},{label:`2d5/2`,n:2,l:2,twoJ:5},{label:`2d3/2`,n:2,l:2,twoJ:3},{label:`3s1/2`,n:3,l:0,twoJ:1},{label:`1h11/2`,n:1,l:5,twoJ:11},{label:`1h9/2`,n:1,l:5,twoJ:9},{label:`2f7/2`,n:2,l:3,twoJ:7},{label:`1i13/2`,n:1,l:6,twoJ:13},{label:`2f5/2`,n:2,l:3,twoJ:5},{label:`3p3/2`,n:3,l:1,twoJ:3},{label:`3p1/2`,n:3,l:1,twoJ:1},{label:`2g9/2`,n:2,l:4,twoJ:9},{label:`1i11/2`,n:1,l:6,twoJ:11},{label:`1j15/2`,n:1,l:7,twoJ:15},{label:`3d5/2`,n:3,l:2,twoJ:5},{label:`4s1/2`,n:4,l:0,twoJ:1},{label:`2g7/2`,n:2,l:4,twoJ:7},{label:`3d3/2`,n:3,l:2,twoJ:3}]);function ie(e,t){let n=0;for(let r of te){let i=e-r,a=t-r,o=1.15+.022*r;n+=2.4*Math.exp(-(i*i)/(2*o*o)),n+=2.4*Math.exp(-(a*a)/(2*o*o))}return n}function q(e,t){let n=Math.trunc(e),r=Math.trunc(t),i=r-n;if(n<0||i<0||r<=0||r===1)return 0;if(n===1&&r===2)return 2.22457;if(n===1&&r===3)return 8.4818;if(n===2&&r===3)return 7.71804;if(n===2&&r===4)return 28.2957;let a=Math.cbrt(r),o=a*a,s=R*r,c=-17.8*o,l=-.711*(n*(n-1))/a,u=-22.7*((i-n)*(i-n))/r,d=-37*Math.abs(i-n)/r,f=0;n%2==0&&i%2==0?f=ee/Math.sqrt(r):n%2==1&&i%2==1&&(f=-11.18/Math.sqrt(r));let p=ie(n,i);return Math.max(0,s+c+l+u+d+f+p)}function ae(e){let t=Math.max(1,Math.trunc(e));if(t===1)return .8414;let n=Math.cbrt(t),r=Math.max(0,1.128*n-.89/n),i=.523*(1-Math.exp(-r/1.15)),a=(.6*r*r+1.4*Math.PI*Math.PI*i*i)*(1-1/t);return Math.sqrt(a+.8414*.8414)}function J(e){let t=Math.max(0,Math.trunc(e)),n=K[0];for(let e of K){let r=e.twoJ+1;if(t<=r){n=e;break}t-=r,n=e}return n}function oe(e,t){let n=Math.trunc(e),r=Math.trunc(t)-n,i=(n&1)==1,a=(r&1)==1;if(!i&&!a)return Object.freeze({spinI:0,parity:`+`,shellLabel:`even-even paired`,magneticMomentMuN:0});let o=(e,t)=>{let n=e.twoJ/2,r=e.l,i=+!!t,a=t?5.5857:-3.8261;return Math.abs(n-(r+.5))<1e-6?(n-.5)*i+.5*a:n/(n+1)*((n+1.5)*i-.5*a)};if(i&&!a){let e=J(n);return Object.freeze({spinI:e.twoJ/2,parity:e.l&1?`-`:`+`,shellLabel:`p:${e.label}`,magneticMomentMuN:o(e,!0)})}if(!i&&a){let e=J(r);return Object.freeze({spinI:e.twoJ/2,parity:e.l&1?`-`:`+`,shellLabel:`n:${e.label}`,magneticMomentMuN:o(e,!1)})}let s=J(n),c=J(r),l=s.twoJ/2,u=c.twoJ/2,d=Math.max(1,Math.abs(l-u)+1);return Object.freeze({spinI:d,parity:s.l+c.l&1?`-`:`+`,shellLabel:`p:${s.label}+n:${c.label}`,magneticMomentMuN:.5*(o(s,!0)+o(c,!1))})}function Y(e){let t=Math.trunc(e);if(t===1)return 1;if(t===2)return 4;let n=Math.max(t,Math.floor(1.8*t)),r=Math.min(310,Math.ceil(2.75*t)+8),i=Math.round(2*t+.015*t**(5/3)),a=-1/0;for(let e=n;e<=r;e+=1){let n=q(t,e);if(e>2&&(n-q(t,e-1)<=0||n-q(t-1,e-1)<=0))continue;let r=n/e,o=q(t+1,e),s=q(t-1,e),c=H-V-U,l=o-n+c,u=s-n-c,d=(l<=0&&u<=0?50:0)-Math.max(l,u)+.15*r;d>a&&(a=d,i=e)}return i}function se(e,t,n,{sampleCount:r=64}={}){let i=Math.max(1,e-2),a=Math.max(1,t-4),o=1.25*(Math.cbrt(a)+Math.cbrt(4)),s=4*a/(4+a)*W,c=2*i*ne*G,l=c/o,u=Number(n),d=u>.05?Math.min(250,c/u*1.25):Math.max(40,o*4),f=new Float32Array(r),p=new Float32Array(r);for(let e=0;e<r;e+=1){let t=.5+e/(r-1)*d;f[e]=t,p[e]=-45/(1+Math.exp((t-o)/.55))+(t>=o?c/t:c/(2*o)*(3-t*t/(o*o)))}if(!(u>.05))return Object.freeze({tunnelingAllowed:!1,rTouchFm:o,muMeV:s,barrierHeightMeV:l,turningPointFm:1/0,gamowExponent:1/0,log10HalfLifeS:1/0,rFm:f,vMeV:p});let m=c/u,h=0;if(m>o){let e=(m-o)/64;for(let t=0;t<64;t+=1){let n=o+(t+.5)*e,r=Math.max(0,c/n-u);h+=Math.sqrt(2*s*r)/G*e}h*=2}let g=Math.sqrt(2*u/s)*299792458e15/(2*o),_=h/Math.LN10-Math.log10(Math.max(1e10,g))+Math.log10(Math.LN2);return Object.freeze({tunnelingAllowed:!0,rTouchFm:o,muMeV:s,barrierHeightMeV:l,turningPointFm:m,gamowExponent:h,log10HalfLifeS:_,rFm:f,vMeV:p})}function X(t,n=null){let r=Math.trunc(t),i=n==null?Y(r):Math.trunc(n),a=i-r,o=q(r,i),s=o/i,c=r*938.78308711+a*H-o,u=c/W,d=c-i*W,f=ae(i),p=f/re,m=oe(r,i),h=r>=2&&i>=5?q(r-2,i-4)+q(2,4)-o:-10,g=q(r+1,i)-o+(H-V-U),_=r>1?q(r-1,i)-o-(H-V-U):-10,v=r*r/(i*48),y=Math.max(0,.72*z*Math.cbrt(i*i)*Math.max(0,1-v)**3),b=se(r,i,h),x=`stable`,S=1/0,C=r,w=i;if(v>=.92&&r>=96)x=`spontaneous-fission`,S=Math.max(-6,18*(1-v)*10),C=Math.floor(r/2),w=Math.floor(i/2);else if(g>.05&&g>=_)x=`beta-minus`,S=Math.max(-3,5.5-5*Math.log10(Math.max(.1,g))),C=r+1,w=i;else if(_>.05){let e=_-2*U,t=e>.05;x=t?`beta-plus`:`electron-capture`,S=Math.max(-3,5.8-4.5*Math.log10(Math.max(.1,t?e:_))),C=r-1,w=i}else (r>=84||h>1.8&&b.log10HalfLifeS<22)&&(x=`alpha`,S=b.log10HalfLifeS,C=r-2,w=i-4);let T=l(r)||`Z${r}`;return Object.freeze({schema:F,generatorFingerprint:I,isotope:`${T}-${i}`,Z:r,N:a,A:i,bindingEnergyMeV:o,bindingPerNucleonMeV:s,atomicMassU:u,massExcessMeV:d,chargeRadiusFm:f,chargeRadiusBohr:p,spinI:m.spinI,parity:m.parity,shellLabel:m.shellLabel,magneticMomentMuN:m.magneticMomentMuN,fissility:v,fissionBarrierMeV:y,qAlphaMeV:h,qBetaMinusMeV:g,qElectronCaptureMeV:_,dominantMode:x,daughterZ:C,daughterA:w,log10HalfLifeS:S,alphaWkb:b,accuracyTier:r<=100?e.TIER_1_QUANTITATIVE:e.TIER_3_THEORETICAL_ENVELOPE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,model:`ldm-strutinsky-woods-saxon-wkb`})})}var Z=`
struct NuclearParams {
  z_sel: u32,
  a_sel: u32,
  vol_dim: u32,
  max_z: u32,
  max_n: u32,
  r_half_fm: f32,
  diffuseness_fm: f32,
  box_half_fm: f32,
};

@group(0) @binding(0) var<uniform> params: NuclearParams;
// Output 2D chart of nuclides: vec4(B_per_A_MeV, Q_alpha, Q_beta_minus, modeCode)
// modeCode: 0=unbound, 1=stable, 2=beta-, 3=beta+/EC, 4=alpha, 5=fission
@group(0) @binding(1) var<storage, read_write> nuclide_chart: array<vec4<f32>>;
// Output 3D nuclear density volume (vol_dim^3): vec4(rho_p, rho_n, V_coul_norm, alpha_density)
@group(0) @binding(2) var<storage, read_write> nuclear_volume: array<vec4<f32>>;

fn shell_corr(z_f: f32, n_f: f32) -> f32 {
  var mag = array<f32, 8>(2.0, 8.0, 20.0, 28.0, 50.0, 82.0, 126.0, 184.0);
  var acc = 0.0;
  for (var i = 0u; i < 8u; i = i + 1u) {
    let m = mag[i];
    let w = 1.15 + 0.022 * m;
    let inv2w2 = 0.5 / (w * w);
    let dz = z_f - m;
    let dn = n_f - m;
    acc = acc + 2.4 * exp(-dz * dz * inv2w2) + 2.4 * exp(-dn * dn * inv2w2);
  }
  return acc;
}

fn binding_mev(z_i: i32, a_i: i32) -> f32 {
  let n_i = a_i - z_i;
  if (z_i < 0 || n_i < 0 || a_i <= 1) { return 0.0; }
  if (z_i == 1 && a_i == 2) { return 2.22457; }
  if (z_i == 2 && a_i == 4) { return 28.2957; }
  let z = f32(z_i);
  let n = f32(n_i);
  let a = f32(a_i);
  let a13 = pow(a, 1.0 / 3.0);
  let a23 = a13 * a13;
  var pair = 0.0;
  if ((z_i & 1) == 0 && (n_i & 1) == 0) {
    pair = 11.18 / sqrt(a);
  } else if ((z_i & 1) == 1 && (n_i & 1) == 1) {
    pair = -11.18 / sqrt(a);
  }
  let b = 15.80 * a - 17.80 * a23 - 0.711 * z * (z - 1.0) / a13
    - 22.70 * (n - z) * (n - z) / a - 37.0 * abs(n - z) / a + pair + shell_corr(z, n);
  return max(0.0, b);
}

@compute @workgroup_size(64)
fn compute_nuclide_chart(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.max_z * params.max_n;
  if (idx >= total) { return; }
  let z = i32(idx / params.max_n) + 1;
  let n = i32(idx % params.max_n);
  let a = z + n;
  let b = binding_mev(z, a);
  let ba = b / f32(a);
  let b_n_prev = binding_mev(z, a - 1);
  let b_p_prev = binding_mev(z - 1, a - 1);
  // Outside drip lines -> unbound
  if (a > 1 && (b - b_n_prev < 0.0 || b - b_p_prev < 0.0)) {
    nuclide_chart[idx] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    return;
  }
  let q_alpha = select(-10.0, binding_mev(z - 2, a - 4) + 28.2957 - b, z >= 2 && a >= 5);
  let q_bm = binding_mev(z + 1, a) - b + 0.78233;
  let q_ec = select(-10.0, binding_mev(z - 1, a) - b - 0.78233, z > 1);
  let fiss = f32(z * z) / (f32(a) * 48.0);
  var mode = 1.0; // stable
  if (fiss >= 0.92 && z >= 96) {
    mode = 5.0;
  } else if (q_bm > 0.05 && q_bm >= q_ec) {
    mode = 2.0;
  } else if (q_ec > 0.05) {
    mode = 3.0;
  } else if (z >= 84 || q_alpha > 2.2) {
    mode = 4.0;
  }
  nuclide_chart[idx] = vec4<f32>(ba, q_alpha, q_bm, mode);
}

@compute @workgroup_size(64)
fn compute_nuclear_volume(@builtin(global_invocation_id) id: vec3<u32>) {
  let dim = params.vol_dim;
  let total = dim * dim * dim;
  let idx = id.x;
  if (idx >= total) { return; }
  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let fx = ((f32(ix) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fy = ((f32(iy) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fz = ((f32(iz) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let r_fm = length(vec3<f32>(fx, fy, fz)) * params.box_half_fm;
  let r_p = params.r_half_fm;
  // Neutron skin thickness delta_r_np ~ 0.12 * (N - Z) / A * 2.5 fm
  let z_f = f32(params.z_sel);
  let a_f = max(1.0, f32(params.a_sel));
  let n_f = max(0.0, a_f - z_f);
  let r_n = r_p + max(0.0, 0.3 * (n_f - z_f) / a_f);
  let rho_p = (z_f / a_f) / (1.0 + exp((r_fm - r_p) / params.diffuseness_fm));
  let rho_n = (n_f / a_f) / (1.0 + exp((r_fm - r_n) / params.diffuseness_fm));
  let v_coul = select(r_p / max(r_fm, 0.1), 0.5 * (3.0 - (r_fm * r_fm) / max(r_p * r_p, 0.01)), r_fm < r_p);
  let dens = clamp(rho_p + rho_n, 0.0, 1.0);
  nuclear_volume[idx] = vec4<f32>(rho_p, rho_n, clamp(v_coul * 0.65, 0.0, 1.0), dens);
}
`;async function ce(e,r,i=null,{volDim:a=32,maxZ:o=118,maxN:s=200}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveNuclearStructureWebGpu requires a live WebGPU GPUDevice`);let c=X(r,i),l=Math.cbrt(c.A),u=Math.max(.85,1.128*l-.89/l),d=Math.max(4.5,u*1.9),f=o*s,p=a*a*a,m=[n(0,`uniform`),n(1,`storage`),n(2,`storage`)],h=t(e,{cacheKey:`ulg-nuclear-chart.v1`,label:`ulg-nuclear-chart`,code:Z,entryPoint:`compute_nuclide_chart`,bindings:m}),g=t(e,{cacheKey:`ulg-nuclear-volume.v1`,label:`ulg-nuclear-volume`,code:Z,entryPoint:`compute_nuclear_volume`,bindings:m}),_=new ArrayBuffer(32);new Uint32Array(_,0,5).set([c.Z,c.A,a,o,s]),new Float32Array(_,20,3).set([u,.523,d]);let v=e.createBuffer({size:32,usage:L.UNIFORM|L.COPY_DST});e.queue.writeBuffer(v,0,_);let y=e.createBuffer({size:f*16,usage:L.STORAGE|L.COPY_SRC}),b=e.createBuffer({size:p*16,usage:L.STORAGE|L.COPY_SRC}),x=e.createBuffer({size:f*16,usage:L.MAP_READ|L.COPY_DST}),S=e.createBuffer({size:p*16,usage:L.MAP_READ|L.COPY_DST}),C=e.createBindGroup({layout:h.bindGroupLayout,entries:[v,y,b].map((e,t)=>({binding:t,resource:{buffer:e}}))}),w=e.createCommandEncoder({label:`ulg-nuclear-structure`}),T=w.beginComputePass({label:`ulg-nuclear-structure-pass`});T.setBindGroup(0,C),T.setPipeline(h.pipeline),T.dispatchWorkgroups(Math.ceil(f/64)),T.setPipeline(g.pipeline),T.dispatchWorkgroups(Math.ceil(p/64)),T.end(),w.copyBufferToBuffer(y,0,x,0,f*16),w.copyBufferToBuffer(b,0,S,0,p*16),e.queue.submit([w.finish()]);try{await Promise.all([x.mapAsync(L.MAP_READ),S.mapAsync(L.MAP_READ)]);let e=new Float32Array(x.getMappedRange().slice(0,f*16)),t=new Float32Array(S.getMappedRange().slice(0,p*16));return x.unmap(),S.unmap(),Object.freeze({...c,backend:`webgpu`,chartDims:Object.freeze({maxZ:o,maxN:s}),chartData:e,volDim:a,boxHalfFm:d,volumeData:t})}finally{for(let e of[v,y,b,x,S])e.destroy()}}var le=`ulg.nuclear.fission-ldm-webgpu.v1`;function ue(e,t,{samples:n=48}={}){let r=Math.max(1,Math.trunc(Number(e)||92)),i=Math.max(r,Math.trunc(Number(t)||235)),a=Math.cbrt(i),o=a*a*z,s=B*(r*(r-1))/a,c=Math.max(.01,Math.min(1.25,s/Math.max(1e-6,2*o))),l=new Float32Array(n),u=new Float32Array(n),d=0,f=.72,p=0;for(let e=0;e<n;e+=1){let t=e/(n-1)*1.35;l[e]=t;let r=t*t,i=r*t,a=r*r,c=o*(.4*r-4/105*i-.14*a),m=s*(-.2*r-4/105*i-.18*a),h=t>.9?-Math.min(185,.35*s*((t-.9)/.45)**2.2):0,g=c+m+h;u[e]=g,t<=1.05&&g>d&&(d=g,f=t,p=e)}return Object.freeze({schema:le,Z:r,A:i,fissility:c,eSurf0MeV:o,eCoul0MeV:s,barrierMeV:d,saddleBeta:f,scissionBeta:1.02,peakIdx:p,betas:l,deltaEMeV:u})}var de=`
struct FissionParams {
  dim: u32,
  z_sel: u32,
  a_sel: u32,
  pad0: u32,
  beta2: f32,
  r_half_fm: f32,
  box_half_fm: f32,
  diffuseness_fm: f32,
};

@group(0) @binding(0) var<uniform> p: FissionParams;
@group(0) @binding(1) var<storage, read_write> vol_out: array<vec4<f32>>;

@compute @workgroup_size(64)
fn compute_fission_volume(@builtin(global_invocation_id) id: vec3<u32>) {
  let dim = p.dim;
  let total = dim * dim * dim;
  let idx = id.x;
  if (idx >= total) { return; }

  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let fx = ((f32(ix) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fy = ((f32(iy) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fz = ((f32(iz) + 0.5) / f32(dim)) * 2.0 - 1.0;

  let pos = vec3<f32>(fx, fy, fz) * p.box_half_fm;
  let beta = clamp(p.beta2, 0.0, 1.4);
  let z_f = f32(p.z_sel);
  let a_f = max(1.0, f32(p.a_sel));
  let n_f = max(0.0, a_f - z_f);
  let skin = max(0.0, 0.30 * (n_f - z_f) / a_f);
  let diff = max(0.25, p.diffuseness_fm);

  var rho_p = 0.0;
  var rho_n = 0.0;

  // Continuous C^infinity Cassini-Oval / Two-Center Liquid-Drop Fission (ZERO abrupt jump at beta = 0.98!)
  // Smoothly elongates -> forms thin hyperbolic neck -> pinches through scission -> separates into 58%/42% fragments + prompt neutrons!
  let s_prog = smoothstep(0.20, 1.40, beta);
  let sep_half = s_prog * p.r_half_fm * 1.42;
  let r_heavy = p.r_half_fm * mix(1.0, pow(0.58, 0.3333333), smoothstep(0.30, 1.05, beta));
  let r_light = p.r_half_fm * mix(1.0, pow(0.42, 0.3333333), smoothstep(0.30, 1.05, beta));
  // Keep center of mass pinned at x = 0 across the entire asymmetric 58/42 split!
  let c_heavy = vec3<f32>(-sep_half * 0.84, 0.0, 0.0);
  let c_light = vec3<f32>( sep_half * 1.16, 0.0, 0.0);
  let dh = length(pos - c_heavy);
  let dl = length(pos - c_light);
  // Smooth-min (smin) neck bridge vanishes continuously as beta crosses scission (~0.98)!
  let neck_k = max(0.02, (1.0 - smoothstep(0.42, 1.04, beta)) * p.r_half_fm * 0.88);
  let dh_s = dh - r_heavy;
  let dl_s = dl - r_light;
  let h_mix = clamp(0.5 + 0.5 * (dl_s - dh_s) / neck_k, 0.0, 1.0);
  let d_surf_p = mix(dl_s, dh_s, h_mix) - neck_k * h_mix * (1.0 - h_mix);
  let d_surf_n = d_surf_p - skin;
  rho_p = (z_f / a_f) / (1.0 + exp(d_surf_p / diff));
  rho_n = (n_f / a_f) / (1.0 + exp(d_surf_n / diff));

  // Prompt scission neutron evaporation burst emerging perpendicularly from the snapped neck (beta > 0.88)!
  let scis_w = smoothstep(0.86, 1.02, beta) * (1.0 - smoothstep(1.22, 1.42, beta));
  let n_rad = max(0.1, (beta - 0.84) * p.r_half_fm * 2.1);
  let n_p1 = vec3<f32>(0.12 * p.r_half_fm,  n_rad * 0.65,  n_rad * 0.32);
  let n_p2 = vec3<f32>(-0.10 * p.r_half_fm, -n_rad * 0.58, n_rad * 0.42);
  let n_p3 = vec3<f32>(0.06 * p.r_half_fm,  n_rad * 0.25, -n_rad * 0.72);
  let n_sig = max(0.18, diff * 1.35);
  let prompt_n = scis_w * (
    exp(-dot(pos - n_p1, pos - n_p1) / (n_sig * n_sig))
    + exp(-dot(pos - n_p2, pos - n_p2) / (n_sig * n_sig))
    + exp(-dot(pos - n_p3, pos - n_p3) / (n_sig * n_sig))
  );
  rho_n = clamp(rho_n + prompt_n * 0.85, 0.0, 1.0);

  let dens = clamp(rho_p + rho_n, 0.0, 1.0);
  // Isovector proton-core (fiery amber-gold) vs outer neutron-skin (electric cyan-blue),
  // plus incandescent white-gold scission neck stress & bright aqua prompt scission neutrons!
  let n_frac = rho_n / max(1e-4, dens);
  let skin_w = smoothstep(0.54, 0.78, n_frac);
  let base_col = mix(vec3<f32>(1.0, 0.44, 0.08), vec3<f32>(0.10, 0.72, 1.0), skin_w) * (0.45 + 0.75 * dens);
  let neck_glow = exp(-pos.x * pos.x / max(0.45, p.r_half_fm * 0.38)) * smoothstep(0.38, 0.94, beta) * (1.0 - smoothstep(0.96, 1.12, beta)) * dens;
  let final_col = clamp(base_col + vec3<f32>(1.0, 0.94, 0.62) * neck_glow * 1.15 + vec3<f32>(0.28, 0.96, 1.0) * prompt_n * 1.1, vec3<f32>(0.0), vec3<f32>(1.0));
  vol_out[idx] = vec4<f32>(final_col, dens);
}
`,fe=new WeakMap;function pe(e,r,{beta2:i=0,dim:a=28,reuseBuffer:o=null}={}){if(!e||typeof e.createBuffer!=`function`)return null;let s=fe.get(e);s||(s={pipe:t(e,{cacheKey:`ulg-nuclear-fission-vol.v1`,label:`ulg-nuclear-fission-vol`,code:de,entryPoint:`compute_fission_volume`,bindings:[n(0,`uniform`),n(1,`storage`)]}),pBuf:e.createBuffer({label:`ulg-fission-params`,size:32,usage:L.UNIFORM|L.COPY_DST})},fe.set(e,s));let c=Math.max(1,Math.trunc(Number(r?.Z)||92)),l=Math.max(c,Math.trunc(Number(r?.A)||235)),u=Math.cbrt(l),d=Math.max(.85,1.128*u-.89/u),f=Math.max(6.5,d*2.55),p=a*a*a,m=p*16,h=o&&o.size>=m?o:e.createBuffer({label:`ulg-nuclear-fission-3d`,size:m,usage:L.STORAGE|L.COPY_SRC}),g=new ArrayBuffer(32);new Uint32Array(g,0,4).set([a,c,l,0]),new Float32Array(g,16,4).set([Number(i)||0,d,f,.523]),e.queue.writeBuffer(s.pBuf,0,g);let _=e.createBindGroup({layout:s.pipe.bindGroupLayout,entries:[{binding:0,resource:{buffer:s.pBuf}},{binding:1,resource:{buffer:h}}]}),v=e.createCommandEncoder({label:`ulg-fission-vol-enc`}),y=v.beginComputePass();return y.setPipeline(s.pipe.pipeline),y.setBindGroup(0,_),y.dispatchWorkgroups(Math.ceil(p/64)),y.end(),e.queue.submit([v.finish()]),{buffer:h,dim:a,beta2:Number(i)||0}}function me(e){return!e||typeof e.registerModule!=`function`?null:e.registerModule({method:{model:`nuclear-fission-ldm`,version:`1`},kernel:{sourceModule:`src/runtime/nuclear/nuclearStructureGpu.js`,entryPoint:`compute_fission_volume`,workgroupSize:64,wgsl:de},parameterSchema:{Z:{type:`number`,min:1,max:118},A:{type:`number`,min:1,max:310},beta2:{type:`number`,min:0,max:1.35}},stateLayout:{tensorId:`nuclear_fission_volume_3d`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=e?.parameters||{},r=ue(n.Z??92,n.A??235),i=t?.device?pe(t.device,{Z:n.Z??92,A:n.A??235},{beta2:n.beta2??r.saddleBeta,dim:16}):null;return i?.buffer&&i.buffer.destroy(),{status:`ok`,curve:r}}})}var Q=`ulg.gpumath.batched-symmetric-eigensolver.v1`,$=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),he=`
struct EigenParams {
  n: u32,
  batch_count: u32,
  max_sweeps: u32,
  stride: u32, // n * n
  tol: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<uniform> params: EigenParams;
// In-place symmetric matrices A (length = batch_count * n * n); diagonal holds sorted eigenvalues on exit.
@group(0) @binding(1) var<storage, read_write> a_mat: array<f32>;
// Output eigenvectors V (column-major columns: column j is eigenvector j -> v_mat[base + row * n + col]).
@group(0) @binding(2) var<storage, read_write> v_mat: array<f32>;
// Output sorted eigenvalues (length = batch_count * n).
@group(0) @binding(3) var<storage, read_write> eigvals: array<f32>;

var<workgroup> sh_c: f32;
var<workgroup> sh_s: f32;
var<workgroup> sh_skip: u32;
var<workgroup> sh_sweep_max: f32;
var<workgroup> sh_done: u32;

@compute @workgroup_size(64)
fn jacobi_symmetric_batched(
  @builtin(workgroup_id) wg_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let b = wg_id.x;
  if (b >= params.batch_count) { return; }
  let lid = local_id.x;
  let n = params.n;
  let stride = params.stride;
  let base = b * stride;

  // Initialize V = I cooperatively
  for (var idx = lid; idx < stride; idx = idx + 64u) {
    let r = idx / n;
    let c = idx % n;
    v_mat[base + idx] = select(0.0, 1.0, r == c);
  }
  if (lid == 0u) {
    sh_done = 0u;
  }
  workgroupBarrier();

  for (var sweep = 0u; sweep < params.max_sweeps; sweep = sweep + 1u) {
    if (lid == 0u) {
      sh_sweep_max = 0.0;
    }
    workgroupBarrier();

    for (var p = 0u; p + 1u < n; p = p + 1u) {
      for (var q = p + 1u; q < n; q = q + 1u) {
        if (lid == 0u) {
          let apq = a_mat[base + p * n + q];
          let abs_apq = abs(apq);
          if (abs_apq > sh_sweep_max) {
            sh_sweep_max = abs_apq;
          }
          if (sh_done != 0u || abs_apq <= params.tol) {
            sh_skip = 1u;
          } else {
            sh_skip = 0u;
            let app = a_mat[base + p * n + p];
            let aqq = a_mat[base + q * n + q];
            let tau = (aqq - app) / (2.0 * apq);
            let t = select(-1.0 / (-tau + sqrt(1.0 + tau * tau)), 1.0 / (tau + sqrt(1.0 + tau * tau)), tau >= 0.0);
            let c = 1.0 / sqrt(1.0 + t * t);
            let s = t * c;
            sh_c = c;
            sh_s = s;
          }
        }
        workgroupBarrier();

        if (sh_skip == 0u) {
          let c = sh_c;
          let s = sh_s;
          // Update off-diagonal rows/cols k != p, q in parallel
          for (var k = lid; k < n; k = k + 64u) {
            if (k != p && k != q) {
              let akp = a_mat[base + k * n + p];
              let akq = a_mat[base + k * n + q];
              let new_kp = c * akp - s * akq;
              let new_kq = s * akp + c * akq;
              a_mat[base + k * n + p] = new_kp;
              a_mat[base + p * n + k] = new_kp;
              a_mat[base + k * n + q] = new_kq;
              a_mat[base + q * n + k] = new_kq;
            }
            // Accumulate eigenvectors V = V * J
            let vkp = v_mat[base + k * n + p];
            let vkq = v_mat[base + k * n + q];
            v_mat[base + k * n + p] = c * vkp - s * vkq;
            v_mat[base + k * n + q] = s * vkp + c * vkq;
          }
        }
        workgroupBarrier();

        if (lid == 0u && sh_skip == 0u) {
          let c = sh_c;
          let s = sh_s;
          let app = a_mat[base + p * n + p];
          let aqq = a_mat[base + q * n + q];
          let apq = a_mat[base + p * n + q];
          let c2 = c * c;
          let s2 = s * s;
          let cs2 = 2.0 * c * s * apq;
          a_mat[base + p * n + p] = c2 * app - cs2 + s2 * aqq;
          a_mat[base + q * n + q] = s2 * app + cs2 + c2 * aqq;
          a_mat[base + p * n + q] = 0.0;
          a_mat[base + q * n + p] = 0.0;
        }
        workgroupBarrier();
      }
    }

    if (lid == 0u && sh_sweep_max <= params.tol) {
      sh_done = 1u;
    }
    workgroupBarrier();
  }

  // Extract eigenvalues and sort ascending along with eigenvector columns
  for (var i = lid; i < n; i = i + 64u) {
    eigvals[b * n + i] = a_mat[base + i * n + i];
  }
  workgroupBarrier();

  // Parallel column-swap selection sort (small N <= 256, deterministic)
  for (var i = 0u; i + 1u < n; i = i + 1u) {
    if (lid == 0u) {
      var min_j = i;
      var min_v = eigvals[b * n + i];
      for (var j = i + 1u; j < n; j = j + 1u) {
        let v = eigvals[b * n + j];
        if (v < min_v) {
          min_v = v;
          min_j = j;
        }
      }
      sh_skip = min_j;
      if (min_j != i) {
        eigvals[b * n + min_j] = eigvals[b * n + i];
        eigvals[b * n + i] = min_v;
      }
    }
    workgroupBarrier();
    let swap_j = sh_skip;
    if (swap_j != i) {
      for (var r = lid; r < n; r = r + 64u) {
        let tmp = v_mat[base + r * n + i];
        v_mat[base + r * n + i] = v_mat[base + r * n + swap_j];
        v_mat[base + r * n + swap_j] = tmp;
      }
    }
    workgroupBarrier();
  }
}
`,ge=`
struct MulParams {
  n: u32,
  batch_count: u32,
  mode: u32, // 0: X = U * diag(1/sqrt(d)) * U^T, 1: out = A * B, 2: out = X * A * X (uses temp)
  stride: u32,
};

@group(0) @binding(0) var<uniform> params: MulParams;
@group(0) @binding(1) var<storage, read> lhs: array<f32>;
@group(0) @binding(2) var<storage, read> rhs: array<f32>;
@group(0) @binding(3) var<storage, read_write> out_mat: array<f32>;

@compute @workgroup_size(64)
fn mat_op(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.batch_count * params.stride;
  if (idx >= total) { return; }
  let b = idx / params.stride;
  let local = idx % params.stride;
  let n = params.n;
  let r = local / n;
  let c = local % n;
  let base = b * params.stride;
  var acc = 0.0;
  if (params.mode == 0u) {
    // lhs = eigenvectors U, rhs = eigenvalues d (length batch*n)
    for (var k = 0u; k < n; k = k + 1u) {
      let dk = max(rhs[b * n + k], 1.0e-12);
      acc = acc + lhs[base + r * n + k] * (1.0 / sqrt(dk)) * lhs[base + c * n + k];
    }
  } else {
    // out = lhs * rhs
    for (var k = 0u; k < n; k = k + 1u) {
      acc = acc + lhs[base + r * n + k] * rhs[base + k * n + c];
    }
  }
  out_mat[idx] = acc;
}
`;async function _e(e,{matrices:r,n:i,batchCount:a=1,maxSweeps:o=32,tolerance:s=1e-6,keepResident:c=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveSymmetricEigenBatchedWebGpu requires a live WebGPU GPUDevice`);let l=Math.trunc(Number(i)),u=Math.max(1,Math.trunc(Number(a)));if(!(l>=1&&l<=256))throw RangeError(`Unsupported matrix dimension n=${l} (expected 1..256)`);let d=l*l,f=u*d,p=r instanceof Float32Array?r:Float32Array.from(r);if(p.length!==f)throw RangeError(`Expected ${f} matrix floats for batch=${u}, n=${l}; got ${p.length}`);let m=t(e,{cacheKey:`ulg-gpumath-jacobi-sym-batched.v1`,label:`ulg-gpumath-jacobi-sym-batched`,code:he,entryPoint:`jacobi_symmetric_batched`,bindings:[n(0,`uniform`),n(1,`storage`),n(2,`storage`),n(3,`storage`)]}),h=new ArrayBuffer(32);new Uint32Array(h,0,4).set([l,u,Math.max(1,Math.trunc(o)),d]),new Float32Array(h,16,4).set([Number(s),0,0,0]);let g=e.createBuffer({label:`ulg-gpumath-eig-params`,size:32,usage:$.UNIFORM|$.COPY_DST});e.queue.writeBuffer(g,0,h);let _=e.createBuffer({label:`ulg-gpumath-eig-a`,size:Math.max(16,f*4),usage:$.STORAGE|$.COPY_DST|$.COPY_SRC});e.queue.writeBuffer(_,0,p);let v=e.createBuffer({label:`ulg-gpumath-eig-v`,size:Math.max(16,f*4),usage:$.STORAGE|$.COPY_SRC}),y=e.createBuffer({label:`ulg-gpumath-eig-vals`,size:Math.max(16,u*l*4),usage:$.STORAGE|$.COPY_SRC}),b=e.createBindGroup({layout:m.bindGroupLayout,entries:[g,_,v,y].map((e,t)=>({binding:t,resource:{buffer:e}}))}),x=e.createCommandEncoder({label:`ulg-gpumath-jacobi-eig`}),S=x.beginComputePass({label:`ulg-gpumath-jacobi-eig-pass`});if(S.setPipeline(m.pipeline),S.setBindGroup(0,b),S.dispatchWorkgroups(u),S.end(),c)return e.queue.submit([x.finish()]),g.destroy(),_.destroy(),Object.freeze({schema:Q,backend:`webgpu`,n:l,batchCount:u,eigenvaluesBuffer:y,eigenvectorsBuffer:v,destroy(){y.destroy(),v.destroy()}});let C=e.createBuffer({label:`ulg-gpumath-eig-read-vals`,size:Math.max(16,u*l*4),usage:$.MAP_READ|$.COPY_DST}),w=e.createBuffer({label:`ulg-gpumath-eig-read-vecs`,size:Math.max(16,f*4),usage:$.MAP_READ|$.COPY_DST});x.copyBufferToBuffer(y,0,C,0,u*l*4),x.copyBufferToBuffer(v,0,w,0,f*4),e.queue.submit([x.finish()]);try{await Promise.all([C.mapAsync($.MAP_READ),w.mapAsync($.MAP_READ)]);let e=new Float32Array(C.getMappedRange().slice(0,u*l*4)),t=new Float32Array(w.getMappedRange().slice(0,f*4));return C.unmap(),w.unmap(),Object.freeze({schema:Q,backend:`webgpu`,n:l,batchCount:u,eigenvalues:e,eigenvectors:t})}finally{for(let e of[g,_,v,y,C,w])e.destroy()}}async function ve(e,{fockMatrices:r,overlapMatrices:i,n:a,batchCount:o=1,maxSweeps:s=32,tolerance:c=1e-6}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveGeneralizedSymmetricEigenBatchedWebGpu requires a live WebGPU GPUDevice`);let l=Math.trunc(Number(a)),u=Math.max(1,Math.trunc(Number(o))),d=l*l,f=u*d,p=r instanceof Float32Array?r:Float32Array.from(r),m=await _e(e,{matrices:i instanceof Float32Array?i:Float32Array.from(i),n:l,batchCount:u,maxSweeps:s,tolerance:c,keepResident:!0}),h=t(e,{cacheKey:`ulg-gpumath-mat-op.v1`,label:`ulg-gpumath-mat-op`,code:ge,entryPoint:`mat_op`,bindings:[n(0,`uniform`),n(1,`read-only-storage`),n(2,`read-only-storage`),n(3,`storage`)]}),g=t(e,{cacheKey:`ulg-gpumath-jacobi-sym-batched.v1`,label:`ulg-gpumath-jacobi-sym-batched`,code:he,entryPoint:`jacobi_symmetric_batched`,bindings:[n(0,`uniform`),n(1,`storage`),n(2,`storage`),n(3,`storage`)]}),_=t=>{let n=e.createBuffer({size:16,usage:$.UNIFORM|$.COPY_DST});return e.queue.writeBuffer(n,0,new Uint32Array(t)),n},v=_([l,u,0,d]),y=_([l,u,1,d]),b=new ArrayBuffer(32);new Uint32Array(b,0,4).set([l,u,s,d]),new Float32Array(b,16,4).set([c,0,0,0]);let x=e.createBuffer({size:32,usage:$.UNIFORM|$.COPY_DST});e.queue.writeBuffer(x,0,b);let S=Math.max(16,f*4),C=e.createBuffer({size:S,usage:$.STORAGE|$.COPY_DST});e.queue.writeBuffer(C,0,p);let w=e.createBuffer({size:S,usage:$.STORAGE}),T=e.createBuffer({size:S,usage:$.STORAGE}),E=e.createBuffer({size:S,usage:$.STORAGE}),D=e.createBuffer({size:S,usage:$.STORAGE}),O=e.createBuffer({size:S,usage:$.STORAGE|$.COPY_SRC}),k=e.createBuffer({size:Math.max(16,u*l*4),usage:$.STORAGE|$.COPY_SRC}),A=e.createBuffer({size:Math.max(16,u*l*4),usage:$.MAP_READ|$.COPY_DST}),j=e.createBuffer({size:S,usage:$.MAP_READ|$.COPY_DST}),M=(t,n)=>e.createBindGroup({layout:t,entries:n.map((e,t)=>({binding:t,resource:{buffer:e}}))}),N=M(h.bindGroupLayout,[v,m.eigenvectorsBuffer,m.eigenvaluesBuffer,w]),P=M(h.bindGroupLayout,[y,w,C,T]),F=M(h.bindGroupLayout,[y,T,w,E]),I=M(g.bindGroupLayout,[x,E,D,k]),L=M(h.bindGroupLayout,[y,w,D,O]),R=Math.ceil(f/64),z=e.createCommandEncoder({label:`ulg-gpumath-gen-eig`}),B=z.beginComputePass({label:`ulg-gpumath-gen-eig-pass`});B.setPipeline(h.pipeline),B.setBindGroup(0,N),B.dispatchWorkgroups(R),B.setBindGroup(0,P),B.dispatchWorkgroups(R),B.setBindGroup(0,F),B.dispatchWorkgroups(R),B.setPipeline(g.pipeline),B.setBindGroup(0,I),B.dispatchWorkgroups(u),B.setPipeline(h.pipeline),B.setBindGroup(0,L),B.dispatchWorkgroups(R),B.end(),z.copyBufferToBuffer(k,0,A,0,u*l*4),z.copyBufferToBuffer(O,0,j,0,f*4),e.queue.submit([z.finish()]);try{await Promise.all([A.mapAsync($.MAP_READ),j.mapAsync($.MAP_READ)]);let e=new Float32Array(A.getMappedRange().slice(0,u*l*4)),t=new Float32Array(j.getMappedRange().slice(0,f*4));return A.unmap(),j.unmap(),Object.freeze({schema:Q,backend:`webgpu`,generalized:!0,n:l,batchCount:u,eigenvalues:e,eigenvectors:t})}finally{m.destroy();for(let e of[v,y,x,C,w,T,E,D,O,k,A,j])e.destroy()}}export{m as C,v as D,_ as E,u as O,h as S,l as T,O as _,X as a,r as b,me as c,b as d,w as f,N as g,A as h,pe as i,ce as l,P as m,_e as n,Y as o,S as p,ue as r,q as s,ve as t,j as u,k as v,g as w,o as x,i as y};