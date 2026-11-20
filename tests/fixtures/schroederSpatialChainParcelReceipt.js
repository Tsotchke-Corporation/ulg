import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT as format } from '../../src/runtime/sph/sphExactThermalEnergyWgsl.js';

// Independent small manufactured-system oracle. Only the fixed receipt leaves
// the GPU; original owners, integer totals and rejected outputs are checked here.
export function chainParcelReceiptShader({particleCount,parcelCount,rejected,kind,
  sourceMassOffset,candidateMassOffset}) {
  return `${createSphExactMassWgsl(format)}
${createSphExactLedgerWgsl(format)}
@group(0) @binding(0) var<storage,read> bm:array<u32>;
@group(0) @binding(1) var<storage,read> am:array<u32>;
@group(0) @binding(2) var<storage,read> be:array<u32>;
@group(0) @binding(3) var<storage,read> ae:array<u32>;
@group(0) @binding(4) var<storage,read> bp:array<u32>;
@group(0) @binding(5) var<storage,read> ap:array<u32>;
@group(0) @binding(6) var<storage,read> bs:array<u32>;
@group(0) @binding(7) var<storage,read> asink:array<u32>;
@group(0) @binding(8) var<storage,read> bparams:array<u32>;
@group(0) @binding(9) var<storage,read> aparams:array<u32>;
@group(0) @binding(10) var<storage,read> evidence:array<u32>;
@group(0) @binding(11) var<storage,read_write> r:array<u32>;
@group(0) @binding(12) var<storage,read> state:array<u32>;
@compute @workgroup_size(1) fn check() {
  var m0=ExactMass();var m1=ExactMass();var u0=ExactMass();var u1=ExactMass();
  for(var i=0u;i<${particleCount}u;i++) {
    var a=ExactMass();var b=ExactMass();var c=ExactMass();var d=ExactMass();var s0=ExactMass();var s1=ExactMass();
    for(var w=0u;w<EM_WORDS;w++) {
      a.words[w]=bm[${sourceMassOffset}u+i*EM_WORDS+w];b.words[w]=am[${candidateMassOffset}u+i*EM_WORDS+w];
      c.words[w]=be[i*EM_WORDS+w];d.words[w]=ae[i*EM_WORDS+w];
      s0.words[w]=be[(i+${particleCount}u)*EM_WORDS+w];s1.words[w]=ae[(i+${particleCount}u)*EM_WORDS+w];
    }
    let ma=em_add(m0,a);let mb=em_add(m1,b);let ca=el_subtract(c,s0);let cb=el_subtract(d,s1);
    let ua=el_add(u0,ca.value);let ub=el_add(u1,cb.value);
    if((ma.error|mb.error|ca.error|cb.error|ua.error|ub.error)!=0u) {r[0]|=1u;}
    m0=ma.value;m1=mb.value;u0=ua.value;u1=ub.value;
    if(${rejected}) {if(em_compare(a,b)!=0) {r[0]|=2u;}}
    else {let projected=em_project_f32_bits(b);if(projected.error!=0u || projected.bits!=state[i*8u+3u]) {r[0]|=4u;}}
  }
  for(var i=0u;i<${parcelCount+1}u;i++) {
    var a=ExactMass();var b=ExactMass();var c=ExactMass();var d=ExactMass();var x=ExactMass();var y=ExactMass();
    for(var w=0u;w<EM_WORDS;w++) {
      if(i<${parcelCount}u) {
        a.words[w]=bp[i*3u*EM_WORDS+w];b.words[w]=ap[i*3u*EM_WORDS+w];
        x.words[w]=bp[(i*3u+1u)*EM_WORDS+w];y.words[w]=ap[(i*3u+1u)*EM_WORDS+w];
        c.words[w]=bp[(i*3u+2u)*EM_WORDS+w];d.words[w]=ap[(i*3u+2u)*EM_WORDS+w];
      } else {
        a.words[w]=bs[w];b.words[w]=asink[w];x.words[w]=bs[2u*EM_WORDS+w];y.words[w]=asink[2u*EM_WORDS+w];
        c.words[w]=bs[EM_WORDS+w];d.words[w]=asink[EM_WORDS+w];
      }
    }
    let aa=em_add(a,x);let bb=em_add(b,y);let ma=em_add(m0,aa.value);let mb=em_add(m1,bb.value);
    let ua=el_add(u0,c);let ub=el_add(u1,d);
    if((aa.error|bb.error|ma.error|mb.error|ua.error|ub.error)!=0u) {r[0]|=8u;}
    m0=ma.value;m1=mb.value;u0=ua.value;u1=ub.value;
  }
  if(em_compare(m0,m1)!=0 || el_compare(u0,u1)!=0) {r[0]|=16u;}
  if(${rejected}) {
    for(var i=0u;i<arrayLength(&be);i++) {if(be[i]!=ae[i]) {r[0]|=32u;}}
    for(var i=0u;i<arrayLength(&bp);i++) {if(bp[i]!=ap[i]) {r[0]|=32u;}}
    for(var i=0u;i<arrayLength(&bs);i++) {if(bs[i]!=asink[i]) {r[0]|=32u;}}
    for(var i=0u;i<arrayLength(&bparams);i++) {if(bparams[i]!=aparams[i]) {r[0]|=32u;}}
  } else {
    if(evidence[0]!=0x50435231u || evidence[2]!=0u || evidence[7]!=1u) {r[0]|=64u;}
    if(${kind==='wall'}) {
      var wallU=0u;for(var w=0u;w<EM_WORDS;w++){wallU|=asink[EM_WORDS+w];}
      if(evidence[6]!=${parcelCount}u || wallU==0u) {r[0]|=128u;}
    }
    if(${kind==='carrier'} && evidence[5]!=${parcelCount}u) {r[0]|=128u;}
    if(${kind==='airborne'} && evidence[4]!=${parcelCount}u) {r[0]|=128u;}
    if(${kind==='airborne'}) {
      var water=0u;for(var w=0u;w<EM_WORDS;w++){water|=ap[EM_WORDS+w];}
      if(water==0u || (bparams[0]==aparams[0] && bparams[1]==aparams[1] && bparams[2]==aparams[2])) {r[0]|=128u;}
    }
  }
  r[1]=evidence[2];r[2]=evidence[4];r[3]=evidence[5];r[4]=evidence[6];r[5]=evidence[7];
}`;
}
