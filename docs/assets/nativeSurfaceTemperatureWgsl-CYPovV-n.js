import{Fa as e,Gn as t,Jn as n,Ka as r,Kn as i,La as a,Pn as o,QC as s,S_ as c,Ua as l,Va as u,Wa as d,Wn as f,Xn as p,Yn as m,Zn as h,__ as g,ao as _,ar as v,b_ as y,f as b,io as x,ir as S,l as C,m as w,n_ as T,no as E,oo as D,qn as O,r_ as k,rr as A,v as j,v_ as M,ww as N,x_ as ee,y_ as P}from"./sphReactionLineageGpu-fuYpGAba.js";import{G as F,Jp as I,Md as te,Q as ne,Sd as re,bd as ie,cm as ae,dp as L,dt as R,fd as oe,fp as z,lp as B,mm as V,nm as H,om as se,ot as ce,q as U,sm as W,up as G,ut as le}from"./sphGpuBuffers-B4et98sp.js";import{acquireQueueOrderedPooledBuffer as ue,computeBufferBinding as K,createCachedExplicitBindGroup as de,createCachedExplicitComputePipeline as fe,createExplicitComputePipeline as pe,deferSubmittedWorkCleanup as me,releaseQueueOrderedPooledBuffer as he}from"../runtime/webgpuComputeLayout.js";import{a as ge,i as _e,l as ve,n as ye,o as q,s as be,t as xe}from"./radiationClosure-BMVoijLy.js";var Se=new WeakMap,Ce=new WeakMap,we=1;function Te(e){return(typeof e==`object`||typeof e==`function`)&&e!=null}function Ee(e){if(!Te(e))return null;let t=Se.get(e);return t??(t=`gpu-device-${we++}`,Se.set(e,t)),t}function De(e,t,{resourceKind:n=`gpu-resource`}={}){if(!Te(e))throw TypeError(`markResourceDevice requires a resource object`);if(!Te(t))throw TypeError(`markResourceDevice requires a device object`);let r={device:t,deviceId:Ee(t),resourceKind:n};return Ce.set(e,r),r}function Oe(e,t){return De(e,t,{resourceKind:`gpu-buffer`})}function ke(e,t){return De(e,t,{resourceKind:`gpu-texture`})}function Ae(e){if(!Te(e))return null;let t=Ce.get(e);if(t!=null)return t;let n=e.ownerDevice||e.device||null;return Te(n)?{device:n,deviceId:Ee(n),resourceKind:e.constructor?.name||`gpu-resource`}:null}function je(e){let t=Ae(e);return t==null?{ownerKnown:!1,ownerDeviceId:null,resourceKind:e?.constructor?.name||`unknown-resource`}:{ownerKnown:!0,ownerDeviceId:t.deviceId,resourceKind:t.resourceKind}}function Me({device:e,resource:t,label:n=`resource`,allowUnknown:r=!0}={}){let i=Ee(e);if(!Te(e))return{ok:!1,status:`expected-device-missing`,label:n,expectedDeviceId:null,ownerKnown:!1,ownerDeviceId:null};if(!Te(t))return{ok:!1,status:`resource-missing`,label:n,expectedDeviceId:i,ownerKnown:!1,ownerDeviceId:null};let a=Ae(t);if(a==null)return{ok:!!r,status:r?`resource-device-unknown`:`resource-device-unknown-blocked`,label:n,expectedDeviceId:i,ownerKnown:!1,ownerDeviceId:null};let o=a.device===e;return{ok:o,status:o?`same-device`:`cross-device-resource`,label:n,expectedDeviceId:i,ownerKnown:!0,ownerDeviceId:a.deviceId,resourceKind:a.resourceKind}}var Ne=`peercompute.webgpu-marching-cubes.surface-adapter.v0`,Pe=`peercompute.webgpu-marching-cubes.adapter-contract.v0`,Fe=`peercompute.webgpu-marching-cubes.surface-preflight.v0`,Ie=`peercompute.webgpu-marching-cubes.device-ownership-validation.v0`,Le=`peercompute.webgpu-marching-cubes.volume-source.v0`,Re=`peercompute.webgpu-marching-cubes.surface.v0`,ze=`peercompute.webgpu-marching-cubes.surface-execution.v0`,Be=`peercompute.webgpu-marching-cubes.surface-row-metadata.v0`,Ve=`peercompute.webgpu-marching-cubes.surface-output-descriptor.v0`,He=`peercompute.webgpu-marching-cubes.device-policy.v0`,Ue=`peercompute.webgpu-marching-cubes.material-metadata.v0`,We=`peercompute.webgpu-marching-cubes.pbr-metadata.v0`,Ge=`peercompute.webgpu-marching-cubes.position-buffer-descriptor.v0`,Ke=`peercompute.webgpu-marching-cubes.normal-buffer-descriptor.v0`,qe=`peercompute.webgpu-marching-cubes.cpu-fallback.v0`,Je=`peercompute.webgpu-marching-cubes.compact-position-rows.v0`,Ye=`peercompute.webgpu-marching-cubes.compact-normal-rows.v0`,Xe=`peercompute.webgpu-marching-cubes.compact-material-rows.v0`,Ze=`peercompute.webgpu-marching-cubes.surface-draw-rows.v0`,Qe=`peercompute.webgpu-marching-cubes.indirect-draw-rows.v0`,$e=`peercompute.webgpu-marching-cubes.layout.compact-position-f32x4.v0`,et=`peercompute.webgpu-marching-cubes.layout.compact-normal-f32x4.v0`,tt=`peercompute.webgpu-marching-cubes.packed-normal-rows.v0`,nt=`peercompute.webgpu-marching-cubes.layout.normal-octahedral-snorm16x2.v0`,rt=`octahedral-snorm16x2`,it=`peercompute.webgpu-marching-cubes.layout.compact-material-f32x4.v0`,J=`peercompute.webgpu-marching-cubes.layout.surface-draw-u32x4.v0`,at=`peercompute.webgpu-marching-cubes.layout.indirect-draw-u32x4.v0`,ot=Object.freeze([`positionX:f32`,`positionY:f32`,`positionZ:f32`,`padding:f32`]),st=Object.freeze([`normalX:f32`,`normalY:f32`,`normalZ:f32`,`padding:f32`]),ct=Object.freeze([`normalOctahedralSnorm16x2:u32`]),lt=Object.freeze([`materialId:f32`,`phaseId:f32`,`sourceVoxelLinearIndex:f32`,`status:f32`]),ut=Object.freeze([`firstVertex:u32`,`vertexCount:u32`,`materialSlot:u32`,`flags:u32`]),dt=Object.freeze([`vertexCount:u32`,`instanceCount:u32`,`firstVertex:u32`,`firstInstance:u32`]),ft=`float32x4-position`,pt=`texture-3d`,Y=`scalar-buffer`,mt=`peercompute.webgpu-marching-cubes.layout.scalar-field-f32.v0`,ht=`sparse-brick-atlas`,gt=`peercompute.webgpu-marching-cubes.layout.sparse-brick-atlas-f32.v0`,_t=4294967295,vt=4294967295;Object.freeze([`timestamp-query`]);function X(e){return(typeof e==`object`||typeof e==`function`)&&e!=null}function yt(e,t){let n=Number(e);if(!Number.isFinite(n))throw TypeError(`${t} must be a finite number`);return n}function bt(e,t=`normalSign`){let n=yt(e??1,t);if(n!==-1&&n!==1)throw RangeError(`${t} must be exactly -1 or 1`);return n}function xt(e,t=`dims`){if(!Array.isArray(e)&&!ArrayBuffer.isView(e))throw TypeError(`${t} must be an array-like [x, y, z]`);if(e.length<3)throw RangeError(`${t} must have at least three entries`);return Array.from(e.slice(0,3),(e,n)=>{let r=Number(e);if(!Number.isInteger(r)||r<=0)throw RangeError(`${t}[${n}] must be a positive integer`);return r})}function St(e,t){let n=Number(e);if(!Number.isInteger(n)||n<=0)throw RangeError(`${t} must be a positive integer`);return n}function Ct(e,t){let n=Number(e);if(!Number.isInteger(n)||n<0)throw RangeError(`${t} must be a non-negative integer`);return n}function wt(e,t){let n=Ct(e,t);if(n>4294967295)throw RangeError(`${t} must fit in a u32`);return n}function Tt(e,t,n){let r=t??e?.size??e?.byteLength??null;return r==null?null:Ct(r,`${n}.byteLength`)}function Et(e){return e?.scalarBuffer||e?.storageBuffer||(e?.sourceType===`scalar-buffer`?e?.buffer:null)||(!X(e?.texture)&&e?.dims!=null?e?.buffer:null)||null}function Dt(e,{texture:t=null,scalarBuffer:n=null,directoryBuffer:r=null,activeBrickRowsBuffer:i=null,atlasBuffer:a=null,candidateVoxelIdsBuffer:o=null}={}){if(e!=null){let t=String(e);if(t===`texture-3d`||t===`scalar-buffer`||t===`sparse-brick-atlas`)return t;throw TypeError(`unsupported volume sourceType ${t}`)}return X(r)||X(i)||X(a)||X(o)?ht:X(n)?Y:X(t)?pt:null}function Ot(e){return String(e?.scalarType||e?.scalarFormat||e?.format||`f32`)}function kt(e){let t=e?.scalarOffset??e?.scalarOffsetFloats??e?.bufferOffsetFloats??e?.offsetFloats??e?.offset??null,n=e?.scalarOffsetBytes??e?.bufferOffsetBytes??e?.byteOffset??null;if(n!=null){let e=Ct(n,`scalarOffsetBytes`);if(e%Float32Array.BYTES_PER_ELEMENT!=0)throw RangeError(`scalarOffsetBytes must be a multiple of 4 for f32 scalar buffers`);if(t!=null&&Ct(t,`scalarOffset`)*Float32Array.BYTES_PER_ELEMENT!=e)throw RangeError(`scalarOffset and scalarOffsetBytes describe different offsets`);return e/Float32Array.BYTES_PER_ELEMENT}return t==null?0:Ct(t,`scalarOffset`)}function At(e,t){let n=e?.scalarStrides||e?.strides||null;if(n!=null){if(!Array.isArray(n)&&!ArrayBuffer.isView(n))throw TypeError(`scalarStrides must be an array-like [x, y, z]`);if(n.length<3)throw RangeError(`scalarStrides must have at least three entries`);return Array.from(n.slice(0,3),(e,t)=>St(e,`scalarStrides[${t}]`))}let r=St(e?.rowStrideFloats??e?.rowStride??t[0],`rowStrideFloats`);return[1,r,St(e?.sliceStrideFloats??e?.sliceStride??r*t[1],`sliceStrideFloats`)]}function jt(e,t){let n=t?.bufferByteLength??t?.scalarBufferByteLength??t?.byteLength??null??e?.size??e?.byteLength??null;return n==null?null:Ct(n,`scalarBuffer.byteLength`)}function Mt(e,t){let n=Et(e),r=Ot(e),i=At(e,t),a=kt(e),o=jt(n,e),s=a+(t[0]-1)*i[0]+(t[1]-1)*i[1]+(t[2]-1)*i[2],c=s+1,l=c*Float32Array.BYTES_PER_ELEMENT;return{sourceType:Y,layoutName:mt,scalarType:r,scalarBuffer:n,storageBuffer:n,scalarStrides:i,rowStrideFloats:i[1],sliceStrideFloats:i[2],scalarOffset:a,scalarOffsetBytes:a*Float32Array.BYTES_PER_ELEMENT,bufferByteLength:o,requiredScalarCount:c,requiredByteLength:l,maxScalarIndex:s,byteLengthValid:o==null||o>=l}}function Nt(e,t){let n=St(e?.brickSize??8,`brickSize`),r=t.map(e=>Math.ceil(e/n)),i=wt(r[0]*r[1]*r[2],`directoryCount`);if(e?.directoryCount!=null&&wt(e.directoryCount,`directoryCount`)!==i)throw RangeError(`directoryCount must equal the exact brickCounts product`);let a=wt(e?.directoryOffset??0,`directoryOffset`),o=St(e?.activeBrickRowStrideU32??e?.activeBrickRowStride??16,`activeBrickRowStrideU32`),s=wt(e?.activeBrickAtlasCellOffsetLane??7,`activeBrickAtlasCellOffsetLane`);if(s>=o)throw RangeError(`activeBrickAtlasCellOffsetLane must be within an active brick row`);let c=St(e?.atlasCellStrideFloats??e?.atlasCellStride??8,`atlasCellStrideFloats`),l=wt(e?.atlasScalarLane??0,`atlasScalarLane`);if(l>=c)throw RangeError(`atlasScalarLane must be within an atlas cell row`);let u=e?.candidateVoxelOffset??e?.candidateVoxelOffsetU32??null,d=e?.candidateVoxelOffsetBytes??null,f;if(d!=null){let e=Ct(d,`candidateVoxelOffsetBytes`);if(e%Uint32Array.BYTES_PER_ELEMENT!=0)throw RangeError(`candidateVoxelOffsetBytes must be a multiple of 4`);if(f=wt(e/Uint32Array.BYTES_PER_ELEMENT,`candidateVoxelOffset`),u!=null&&wt(u,`candidateVoxelOffset`)!==f)throw RangeError(`candidateVoxelOffset and candidateVoxelOffsetBytes describe different offsets`)}else f=wt(u??0,`candidateVoxelOffset`);let p=f*Uint32Array.BYTES_PER_ELEMENT,m=wt(e?.directorySentinel??4294967295,`directorySentinel`),h=wt(e?.candidateSentinel??4294967295,`candidateSentinel`);if(m!==4294967295||h!==4294967295)throw RangeError(`sparse directory and candidate sentinels must be 0xffffffff`);let g=e?.directoryBuffer||null,_=e?.activeBrickRowsBuffer||null,v=e?.atlasBuffer||null,y=e?.candidateVoxelIdsBuffer||null,b=e?.candidateDispatchIndirectBuffer||null,x=Tt(g,e?.directoryBufferByteLength,`directoryBuffer`),S=Tt(_,e?.activeBrickRowsBufferByteLength,`activeBrickRowsBuffer`),C=Tt(v,e?.atlasBufferByteLength,`atlasBuffer`),w=Tt(y,e?.candidateVoxelIdsBufferByteLength,`candidateVoxelIdsBuffer`),T=b==null?null:Tt(b,e?.candidateDispatchIndirectBufferByteLength,`candidateDispatchIndirectBuffer`),E=Ct(e?.candidateDispatchIndirectOffsetBytes??0,`candidateDispatchIndirectOffsetBytes`);if(E%Uint32Array.BYTES_PER_ELEMENT!==0)throw RangeError(`candidateDispatchIndirectOffsetBytes must be a multiple of 4`);let D=wt(e?.activeBrickCount??e?.activeBrickCapacity??(S==null?0:Math.floor(S/(o*Uint32Array.BYTES_PER_ELEMENT))),`activeBrickCount`),O=wt(e?.atlasCellCount??e?.atlasCellCapacity??(C==null?0:Math.floor(C/(c*Float32Array.BYTES_PER_ELEMENT))),`atlasCellCount`),k=wt(e?.candidateVoxelCount??e?.candidateVoxelCapacity??(w==null?0:Math.max(0,Math.floor(w/Uint32Array.BYTES_PER_ELEMENT)-f)),`candidateVoxelCount`),A=wt(e?.generationId??e?.generation??0,`generationId`),j=yt(e?.backgroundValue??0,`backgroundValue`),M=(a+i)*Uint32Array.BYTES_PER_ELEMENT,N=D*o*Uint32Array.BYTES_PER_ELEMENT,ee=O*c*Float32Array.BYTES_PER_ELEMENT,P=(f+k)*Uint32Array.BYTES_PER_ELEMENT,F=b==null?0:E+3*Uint32Array.BYTES_PER_ELEMENT,I={directory:x==null||x>=M,activeBrickRows:S==null||S>=N,atlas:C==null||C>=ee,candidateVoxelIds:w==null||w>=P,candidateDispatchIndirect:b==null||T>=F};return{sourceType:ht,layoutName:gt,directoryBuffer:g,activeBrickRowsBuffer:_,atlasBuffer:v,candidateVoxelIdsBuffer:y,candidateDispatchIndirectBuffer:b,brickSize:n,brickCounts:r,tailBrickSampleExtent:t.map(e=>(e-1)%n+1),directoryOffset:a,directoryCount:i,directorySentinel:m,activeBrickCount:D,activeBrickCapacity:D,activeBrickRowStrideU32:o,activeBrickAtlasCellOffsetLane:s,atlasCellCount:O,atlasCellCapacity:O,atlasCellStrideFloats:c,atlasScalarLane:l,candidateVoxelCount:k,candidateVoxelCapacity:k,candidateVoxelOffset:f,candidateVoxelOffsetU32:f,candidateVoxelOffsetBytes:p,candidateVoxelBindingByteLength:k*Uint32Array.BYTES_PER_ELEMENT,candidateDispatchIndirectOffsetBytes:E,candidateDispatchIndirectBufferByteLength:T,candidateDispatchIndirectRequiredByteLength:F,candidateDispatchMode:b==null?`fixed-capacity`:`gpu-indirect-admitted-count`,candidateSentinel:h,generationId:A,generation:A,backgroundValue:j,directoryBufferByteLength:x,directoryRequiredByteLength:M,activeBrickRowsBufferByteLength:S,activeBrickRowsRequiredByteLength:N,atlasBufferByteLength:C,atlasRequiredByteLength:ee,candidateVoxelIdsBufferByteLength:w,candidateVoxelIdsRequiredByteLength:P,byteLengthChecks:I,byteLengthValid:Object.values(I).every(Boolean),candidateContract:`logical dual-grid voxel IDs; unused capacity entries are 0xffffffff`,candidateDispatchContract:b==null?`host capacity dispatch with sentinel guards`:`GPU-authored dispatchWorkgroupsIndirect u32x3 row; x is zero when generation admission fails`}}function Pt(e){return{name:e?.name||`Error`,message:e instanceof Error?e.message:String(e),status:e?.status||e?.code||`error`,details:e?.details||null,stage:e?.stage||e?.adapterStage||e?.marchingCubesStage||null,stack:e instanceof Error&&e.stack||null}}function Ft(e,t){if(e!=null&&(typeof e==`object`||typeof e==`function`))try{e.adapterStage=e.adapterStage||t}catch{}return e}function It(e,t={}){return{status:e,at:new Date().toISOString(),...t}}function Lt({ownsDevice:e=!1,ownerDeviceId:t=null,device:n=null}={}){let r=!!e;return{schema:He,version:0,ownership:r?`adapter-owned`:`caller-owned`,ownsDevice:r,requestDeviceByDefault:!1,ownedDeviceHelper:`requestWebGpuMarchingCubesDevice`,sameDeviceChecks:!0,ownerDeviceId:t,deviceLabel:typeof n?.label==`string`?n.label:null}}function Rt(e=null){return e?.schema===`peercompute.webgpu-marching-cubes.material-metadata.v0`?{version:0,role:`material-metadata`,available:!!e.available,payload:e.payload??null,placeholder:e.payload==null,...e}:{schema:Ue,version:0,role:`material-metadata`,available:e!=null,placeholder:e==null,payload:e}}function zt(e=null){return e?.schema===`peercompute.webgpu-marching-cubes.pbr-metadata.v0`?{version:0,role:`pbr-metadata`,available:!!e.available,payload:e.payload??null,placeholder:e.payload==null,...e}:{schema:We,version:0,role:`pbr-metadata`,available:e!=null,placeholder:e==null,payload:e}}function Bt({status:e=`position-rows-empty`,available:t=!1,rowCount:n=0,buffer:r=null,bufferOffsetBytes:i=0,bufferByteLength:a=0,bufferRetained:o=!1,bufferOwnership:s=`none`,ownerDeviceId:c=null,resourceOwnership:l=null,devicePolicy:u=null,bufferKind:d=null}={}){let f=Math.max(0,Math.round(Number(n)||0)),p=Math.max(0,Math.round(Number(a)||0)),m=f*ot.length*Float32Array.BYTES_PER_ELEMENT,h=d||r?.bufferKind||(r==null?`none`:`gpu-buffer`);return{schema:Ge,version:0,role:`position-buffer`,status:e,available:!!t,layoutName:$e,rowSchema:Je,rowLayout:[...ot],vertexFormat:ft,rowStrideFloats:ot.length,rowStrideBytes:ot.length*Float32Array.BYTES_PER_ELEMENT,rowCount:f,count:f,buffer:r,bufferKind:h,bufferOffsetBytes:i,bufferByteLength:p,byteLength:p,expectedByteLength:m,byteLengthValid:!t||p>=m,bufferRetained:!!o,bufferOwnership:s,ownership:{buffer:s,device:u?.ownership||null,ownerDeviceId:c,resourceOwnership:l},ownerDeviceId:c,resourceOwnership:l,sameDeviceStatus:l?.status||null,sameDevice:l?.ok??null,devicePolicy:u,readback:!1}}function Vt({status:e=`normal-rows-empty`,available:t=!1,rowCount:n=0,buffer:r=null,bufferOffsetBytes:i=0,bufferByteLength:a=0,bufferRetained:o=!1,bufferOwnership:s=`none`,ownerDeviceId:c=null,resourceOwnership:l=null,devicePolicy:u=null,surfaceGenerationId:d=null,volumeGenerationId:f=null,normalSign:p=1,bufferKind:m=null}={}){let h=Math.max(0,Math.round(Number(n)||0)),g=Math.max(0,Math.round(Number(a)||0)),_=h*Uint32Array.BYTES_PER_ELEMENT,v=m||r?.bufferKind||(r==null?`none`:`gpu-buffer`),y=bt(p),b=d==null?null:Ct(d,`surfaceGenerationId`),x=f==null?null:Ct(f,`volumeGenerationId`);return{schema:Ke,version:0,descriptorVersion:0,role:`normal-buffer`,status:e,available:!!t,layoutName:nt,rowSchema:tt,rowLayout:[...ct],rowStrideBytes:Uint32Array.BYTES_PER_ELEMENT,rowCount:h,count:h,encoding:rt,componentEncoding:`snorm16x2`,decode:`octahedral-unit-vector`,semantic:`oriented-scalar-gradient`,sourceSemantic:`scalar-gradient`,normalSign:y,degenerateEncoding:`reserved-u32-0x80008000`,degenerateSentinel:2147516416,buffer:r,bufferKind:v,bufferOffsetBytes:i,bufferByteLength:g,byteLength:g,expectedByteLength:_,byteLengthValid:!t||g>=_,bufferRetained:!!o,bufferOwnership:s,ownership:{buffer:s,device:u?.ownership||null,ownerDeviceId:c,resourceOwnership:l,lifetimeOwner:`surface-result-release`,pairedPositionRelease:!0},ownerDeviceId:c,resourceOwnership:l,sameDeviceStatus:l?.status||null,sameDevice:l?.ok??null,devicePolicy:u,generation:{schema:`peercompute.webgpu-marching-cubes.surface-buffer-generation.v0`,surfaceGenerationId:b,volumeGenerationId:x,pairedPositionSurfaceGenerationId:b,producerStage:`marchingCubesVertexEmit`,sameSubmitAsPosition:!0},lifetime:{owner:`surface-result`,releaseMethod:`surface.release`,pairedWithPositionBuffer:!0,retireAfterConsumerSubmitFence:!0},producer:{stage:`marchingCubesVertexEmit`,timestampSpanLabel:`marchingCubesVertexEmit`,additionalSubmitCount:0},readback:!1}}function Ht({schema:e,family:t,status:n,available:r=!1,layoutName:i,rowLayout:a,rowStrideFloats:o=0,rowStrideBytes:s=0,rowCount:c=0,buffer:l=null,bufferOffsetBytes:u=0,bufferByteLength:d=0,bufferRetained:f=!1,bufferOwnership:p=`none`,ownerDeviceId:m=null,resourceOwnership:h=null,devicePolicy:g=null,reason:_=null,derivation:v=null,sourceCounts:y=null,materialPayload:b=null,pbrPayload:x=null,bufferKind:S=null}={}){let C=S||l?.bufferKind||(l==null?`none`:`gpu-buffer`),w={schema:e,version:0,descriptorVersion:0,family:t,role:`${t}-rows`,status:n,available:!!r,produced:!!r,layoutName:i,rowLayout:[...a],rowStrideFloats:o,rowStrideBytes:s,rowCount:c,count:c,buffer:l,bufferOffsetBytes:u,bufferByteLength:d,byteLength:d,expectedByteLength:Math.max(0,c*s),byteLengthValid:!r||d>=Math.max(0,c*s),bufferRetained:!!f,bufferKind:C,bufferOwnership:p,ownership:{buffer:p,device:g?.ownership||null,ownerDeviceId:m,resourceOwnership:h},ownerDeviceId:m,resourceOwnership:h,devicePolicy:g,materialPayload:b,pbrPayload:x,sourceCounts:y,reason:_,derivation:v,readback:!1};return t===`position`&&(w.positionBufferDescriptor=Bt({status:n,available:r,rowCount:c,buffer:l,bufferOffsetBytes:u,bufferByteLength:d,bufferRetained:f,bufferOwnership:p,ownerDeviceId:m,resourceOwnership:h,devicePolicy:g,bufferKind:C})),w}function Ut({buffer:e=null,bufferByteLength:t=0,bufferRetained:n=!1,bufferOwnership:r=`none`,ownerDeviceId:i=null,resourceOwnership:a=null,devicePolicy:o=null,vertexCount:s=0,triangleCount:c=0,normalBuffer:l=null,normalBufferByteLength:u=0,normalResourceOwnership:d=null,surfaceGenerationId:f=null,volumeGenerationId:p=null,normalSign:m=1,materialPayload:h=null,pbrPayload:g=null}={}){let _=Math.max(0,Math.round(Number(s)||0)),v=Math.max(0,Math.round(Number(c)||0)),y=_>0&&X(e),b=y&&X(l)&&u>=_*Uint32Array.BYTES_PER_ELEMENT,x=y?t:0,S=Rt(h),C=zt(g),w={vertexCount:_,triangleCount:v},T=Vt({status:b?`normal-rows-resident`:`normal-rows-not-produced`,available:b,rowCount:b?_:0,buffer:b?l:null,bufferByteLength:b?u:0,bufferRetained:b&&!!n,bufferOwnership:b?r:`none`,ownerDeviceId:i,resourceOwnership:b?d:null,devicePolicy:o,surfaceGenerationId:f,volumeGenerationId:p,normalSign:m}),E={position:Ht({schema:Je,family:`position`,status:y?`position-rows-resident`:`position-rows-empty`,available:y,layoutName:$e,rowLayout:ot,rowStrideFloats:4,rowStrideBytes:16,rowCount:_,buffer:e,bufferOffsetBytes:0,bufferByteLength:x,bufferRetained:y&&!!n,bufferOwnership:y?r:`none`,ownerDeviceId:i,resourceOwnership:a,devicePolicy:o,sourceCounts:w,materialPayload:S,pbrPayload:C}),normal:Ht({schema:b?tt:Ye,family:`normal`,status:T.status,available:b,layoutName:b?nt:et,rowLayout:b?ct:st,rowStrideFloats:b?0:4,rowStrideBytes:b?Uint32Array.BYTES_PER_ELEMENT:16,rowCount:b?_:0,buffer:b?l:null,bufferByteLength:b?u:0,bufferRetained:b&&!!n,bufferOwnership:b?r:`none`,ownerDeviceId:i,resourceOwnership:b?d:null,devicePolicy:o,sourceCounts:w,reason:b?null:`surface engine did not provide packed normal rows`,derivation:b?`central-difference scalar gradients interpolated during marching-cubes vertex emission`:`consumer may use a face-normal fallback for legacy engines`}),material:Ht({schema:Xe,family:`material`,status:`material-rows-not-produced`,available:!1,layoutName:it,rowLayout:lt,rowStrideFloats:4,rowStrideBytes:16,rowCount:0,devicePolicy:o,sourceCounts:w,materialPayload:S,pbrPayload:C,reason:`native kernel currently has no material, phase, or PBR input`,derivation:`supply material and PBR metadata in the caller-owned translation stage`}),draw:Ht({schema:Ze,family:`draw`,status:`draw-rows-not-produced`,available:!1,layoutName:J,rowLayout:ut,rowStrideFloats:0,rowStrideBytes:16,rowCount:0,devicePolicy:o,sourceCounts:w,reason:`adapter emits one retained compact position buffer, not renderer draw rows`,derivation:`ULG can translate the retained triangle-list positions into surface draw rows`}),indirect:Ht({schema:Qe,family:`indirect`,status:`indirect-draw-rows-not-produced`,available:!1,layoutName:at,rowLayout:dt,rowStrideFloats:0,rowStrideBytes:16,rowCount:0,devicePolicy:o,sourceCounts:w,reason:`adapter does not own the render pass or indirect draw buffer`,derivation:`ULG can build indirect draw rows from vertexCount and caller-owned draw policy`})};return E.normal.normalBufferDescriptor=T,E.normal.encoding=T.encoding,E.normal.semantic=T.semantic,E.normal.sourceSemantic=T.sourceSemantic,E.normal.normalSign=T.normalSign,E.normal.generation=T.generation,E.normal.lifetime=T.lifetime,E.normal.producer=T.producer,{schema:Ve,version:0,descriptorVersion:0,status:y?`surface-outputs-resident`:`surface-outputs-empty`,topology:`triangle-list`,indexFormat:null,layoutName:$e,rowLayoutName:$e,vertexFormat:ft,rowCount:_,vertexCount:_,triangleCount:v,byteLength:x,readback:!1,fullReadback:!1,devicePolicy:o,materialPayload:S,pbrPayload:C,retainedBuffers:{position:y?e:null,normal:b?l:null},rows:E,positionBufferDescriptor:E.position.positionBufferDescriptor,normalBufferDescriptor:T,materialDescriptor:E.material,drawDescriptor:E.draw,indirectDescriptor:E.indirect}}function Wt({buffer:e=null,bufferByteLength:t=0,bufferRetained:n=!1,bufferOwnership:r=`none`,ownerDeviceId:i=null,resourceOwnership:a=null,devicePolicy:o=null,vertexCount:s=0,triangleCount:c=0,normalBuffer:l=null,normalBufferByteLength:u=0,normalResourceOwnership:d=null,surfaceGenerationId:f=null,volumeGenerationId:p=null,normalSign:m=1,materialPayload:h=null,pbrPayload:g=null}={}){let _=Math.max(0,Math.round(Number(s)||0)),v=_>0&&X(e),y=v&&X(l)&&u>=_*Uint32Array.BYTES_PER_ELEMENT,b=v?`position-rows-resident`:`position-rows-empty`,x=Rt(h),S=zt(g),C=Vt({status:y?`normal-rows-resident`:`normal-rows-not-produced`,available:y,rowCount:y?_:0,buffer:y?l:null,bufferByteLength:y?u:0,bufferRetained:y&&!!n,bufferOwnership:y?r:`none`,ownerDeviceId:i,resourceOwnership:y?d:null,devicePolicy:o,surfaceGenerationId:f,volumeGenerationId:p,normalSign:m});return{schema:Be,version:0,status:v?`surface-position-rows-resident`:`surface-position-rows-empty`,layoutName:$e,rowLayoutName:$e,rowCount:_,triangleCount:c,byteLength:v?t:0,devicePolicy:o,materialPayload:x,pbrPayload:S,readback:!1,fullReadback:!1,position:{schema:Je,version:0,descriptorVersion:0,family:`position`,role:`position-rows`,status:b,available:v,produced:v,layoutName:$e,rowLayout:[...ot],rowStrideFloats:4,rowStrideBytes:16,rowCount:_,count:_,buffer:e,bufferOffsetBytes:0,bufferByteLength:v?t:0,byteLength:v?t:0,bufferRetained:v&&!!n,bufferOwnership:v?r:`none`,ownership:{buffer:v?r:`none`,device:o?.ownership||null,ownerDeviceId:i,resourceOwnership:a},ownerDeviceId:i,resourceOwnership:a,devicePolicy:o,positionBufferDescriptor:Bt({status:b,available:v,rowCount:_,buffer:e,bufferOffsetBytes:0,bufferByteLength:v?t:0,bufferRetained:v&&!!n,bufferOwnership:v?r:`none`,ownerDeviceId:i,resourceOwnership:a,devicePolicy:o}),readback:!1},normal:{schema:y?tt:Ye,version:0,descriptorVersion:0,family:`normal`,role:`normal-rows`,status:C.status,available:y,produced:y,reason:y?null:`surface engine did not provide packed normal rows`,layoutName:y?nt:et,rowLayout:y?[...ct]:[...st],rowStrideFloats:y?0:4,rowStrideBytes:y?Uint32Array.BYTES_PER_ELEMENT:16,rowCount:y?_:0,count:y?_:0,buffer:y?l:null,bufferByteLength:y?u:0,byteLength:y?u:0,bufferRetained:y&&!!n,bufferOwnership:y?r:`none`,ownership:C.ownership,ownerDeviceId:C.ownerDeviceId,resourceOwnership:C.resourceOwnership,devicePolicy:o,encoding:C.encoding,semantic:C.semantic,sourceSemantic:C.sourceSemantic,normalSign:C.normalSign,generation:C.generation,lifetime:C.lifetime,producer:C.producer,normalBufferDescriptor:C,derivation:y?`central-difference scalar gradients interpolated during marching-cubes vertex emission`:`consumer may use a face-normal fallback for legacy engines`,readback:!1},material:{schema:Xe,version:0,descriptorVersion:0,family:`material`,role:`material-rows`,status:`material-rows-not-produced`,available:!1,produced:!1,metadataAvailable:x.available||S.available,reason:`native kernel currently has no material or phase input`,layoutName:it,rowLayout:[...lt],rowStrideFloats:4,rowStrideBytes:16,rowCount:0,count:0,buffer:null,bufferByteLength:0,byteLength:0,bufferRetained:!1,bufferOwnership:`none`,devicePolicy:o,materialPayload:x,pbrPayload:S,derivation:`supply material metadata in the caller-owned translation stage`,readback:!1}}}function Gt({texture:e=null,scalarBuffer:t=null,sparseVolume:n=null,dims:r,dualGridDims:i=null,device:a=null,diagonalLength:o=null,label:s=`volume`,source:c=null,sourceType:l=null,scalarType:u=`f32`,scalarStrides:d=null,rowStrideFloats:f=null,rowStride:p=null,sliceStrideFloats:m=null,sliceStride:h=null,scalarOffset:g=null,scalarOffsetBytes:_=null,bufferByteLength:v=null,normalSign:y=1,originalVolume:b=null,markTextureOwner:x=!1,markBufferOwner:S=!1,requireTexture:C=!1,requireNativeSource:w=!1}={}){let T=xt(r),E=bt(y),D=t||null,O=n||{},k=Dt(l,{texture:e,scalarBuffer:D,directoryBuffer:O.directoryBuffer,activeBrickRowsBuffer:O.activeBrickRowsBuffer,atlasBuffer:O.atlasBuffer,candidateVoxelIdsBuffer:O.candidateVoxelIdsBuffer});if(C&&(k!==`texture-3d`||!X(e)))throw TypeError(`volume requires a GPUTexture-like texture`);if(w&&k==null)throw TypeError(`volume requires a texture_3d, f32 scalar buffer, or sparse brick atlas source`);if(k===`scalar-buffer`&&!X(D))throw TypeError(`buffer volume requires a GPUBuffer-like scalarBuffer`);if(k===`sparse-brick-atlas`){for(let[e,t]of[[`directoryBuffer`,O.directoryBuffer],[`activeBrickRowsBuffer`,O.activeBrickRowsBuffer],[`atlasBuffer`,O.atlasBuffer],[`candidateVoxelIdsBuffer`,O.candidateVoxelIdsBuffer]])if(!X(t))throw TypeError(`sparse brick volume requires a GPUBuffer-like ${e}`)}let A=k===`scalar-buffer`?Mt({scalarBuffer:D,scalarType:u,scalarStrides:d,rowStrideFloats:f,rowStride:p,sliceStrideFloats:m,sliceStride:h,scalarOffset:g,scalarOffsetBytes:_,bufferByteLength:v},T):null;if(A!=null&&A.scalarType!==`f32`)throw TypeError(`buffer volume scalarType must be f32`);if(A!=null&&!A.byteLengthValid)throw RangeError(`buffer volume scalarBuffer is too small for dims, strides, and offset`);let j=k===`sparse-brick-atlas`?Nt(O,T):null;if(j!=null&&!j.byteLengthValid)throw RangeError(`sparse brick volume contains an undersized GPU buffer`);let M=j==null?[]:[j.directoryBuffer,j.activeBrickRowsBuffer,j.atlasBuffer,j.candidateVoxelIdsBuffer,j.candidateDispatchIndirectBuffer].filter(X),N=k===`scalar-buffer`?D:k===`sparse-brick-atlas`?j.atlasBuffer:e,ee=je(N);if(X(N)&&X(a)){if(k===`texture-3d`&&x)ee=ke(N,a);else if(k===`scalar-buffer`&&S)ee=Oe(N,a);else if(k===`sparse-brick-atlas`&&S){for(let e of M)Oe(e,a);ee=je(N)}}let P=i==null?T.map(e=>e-1):xt(i,`dualGridDims`),F=o==null?Math.hypot(T[0],T[1],T[2]):yt(o,`diagonalLength`);return Object.freeze({schema:Le,version:0,label:s,source:c||(k===`scalar-buffer`?`external-scalar-buffer`:k===`sparse-brick-atlas`?`external-sparse-brick-atlas`:k===`texture-3d`?`external-texture`:`external-volume`),sourceType:k,device:a,ownerDeviceId:ee?.ownerDeviceId||ee?.deviceId||null,dims:T,dualGridDims:P,numVoxels:T[0]*T[1]*T[2],dualGridNumVoxels:P[0]*P[1]*P[2],diagonalLength:F,normalSign:E,normalSemantic:`oriented-scalar-gradient`,normalSourceSemantic:`scalar-gradient`,texture:e,scalarBuffer:A?.scalarBuffer||null,storageBuffer:A?.storageBuffer||null,scalarType:A?.scalarType||null,scalarLayoutName:A?.layoutName||null,scalarStrides:A?.scalarStrides||null,rowStrideFloats:A?.rowStrideFloats||null,sliceStrideFloats:A?.sliceStrideFloats||null,scalarOffset:A?.scalarOffset||0,scalarOffsetBytes:A?.scalarOffsetBytes||0,scalarBufferByteLength:A?.bufferByteLength||null,scalarRequiredByteLength:A?.requiredByteLength||null,scalarRequiredCount:A?.requiredScalarCount||null,scalarBufferByteLengthValid:A?.byteLengthValid??null,scalar:A,sparse:j,...j||{},originalVolume:b})}function Kt(e,{device:t=null,markTextureOwner:n=!1,markBufferOwner:r=!1,requireTexture:i=!1,requireNativeSource:a=!1}={}){if(!X(e))throw TypeError(`normalizeMarchingCubesVolumeSource requires a volume object`);let o=X(e.device)?e.device:t,s=Et(e);return Gt({texture:e.texture||null,scalarBuffer:s,sparseVolume:e,dims:e.dims,dualGridDims:e.dualGridDims||null,device:o,diagonalLength:e.diagonalLength??null,label:e.label||`volume`,source:e.source||null,sourceType:e.sourceType||e.volumeSourceType||null,scalarType:Ot(e),scalarStrides:e.scalarStrides||e.strides||null,rowStrideFloats:e.rowStrideFloats??null,rowStride:e.rowStride??null,sliceStrideFloats:e.sliceStrideFloats??null,sliceStride:e.sliceStride??null,scalarOffset:e.scalarOffset??e.scalarOffsetFloats??e.bufferOffsetFloats??e.offsetFloats??e.offset??null,scalarOffsetBytes:e.scalarOffsetBytes??e.bufferOffsetBytes??e.byteOffset??null,bufferByteLength:e.bufferByteLength??e.scalarBufferByteLength??e.byteLength??null,normalSign:e.normalSign??1,originalVolume:e.schema===`peercompute.webgpu-marching-cubes.volume-source.v0`?e.originalVolume||null:e,markTextureOwner:n,markBufferOwner:r,requireTexture:i,requireNativeSource:a})}function qt({scalarBuffer:e=null,storageBuffer:t=null,buffer:n=null,dims:r,scalarStrides:i=null,strides:a=null,rowStrideFloats:o=null,rowStride:s=null,sliceStrideFloats:c=null,sliceStride:l=null,scalarOffset:u=null,scalarOffsetFloats:d=null,bufferOffsetFloats:f=null,scalarOffsetBytes:p=null,bufferOffsetBytes:m=null,byteOffset:h=null,bufferByteLength:g=null,scalarBufferByteLength:_=null,device:v=null,diagonalLength:y=null,label:b=`volume`,source:x=`external-scalar-buffer`,scalarType:S=`f32`,normalSign:C=1}={}){let w=e||t||n;if(!X(w))throw TypeError(`createBufferVolumeDescriptor requires a GPUBuffer-like scalarBuffer`);return Gt({scalarBuffer:w,dims:r,device:v,diagonalLength:y,label:b,source:x,sourceType:Y,normalSign:C,scalarType:S,scalarStrides:i||a||null,rowStrideFloats:o,rowStride:s,sliceStrideFloats:c,sliceStride:l,scalarOffset:u??d??f??null,scalarOffsetBytes:p??m??h??null,bufferByteLength:g??_??null,markBufferOwner:!0,requireNativeSource:!0})}function Jt({backend:e=`webgpu`}={}){return Object.freeze({schema:Pe,version:0,adapterSchema:Ne,backend:e,api:Object.freeze([`getStatus`,`getCapabilities`,`preflight`,`extractSurface`,`setVolume`,`release`]),devicePolicy:Object.freeze({schema:He,version:0,defaultOwnership:`caller-owned`,requestDeviceByDefault:!1,ownedDeviceHelper:`requestWebGpuMarchingCubesDevice`,sameDeviceChecks:!0,validationSchema:Ie,validationHelper:`validateSurfaceAdapterDeviceOwnership`,crossDeviceOutputStatus:`same-device-check-failed`}),input:Object.freeze({volumeSchema:Le,nativeSourceTypes:Object.freeze([pt,Y,ht]),acceptedVolumeFields:Object.freeze(`texture.scalarBuffer.storageBuffer.dims.dualGridDims.dualGridNumVoxels.diagonalLength.device.sourceType.scalarType.scalarStrides.rowStrideFloats.sliceStrideFloats.scalarOffset.scalarOffsetBytes.directoryBuffer.activeBrickRowsBuffer.atlasBuffer.candidateVoxelIdsBuffer.brickSize.directoryOffset.activeBrickCount.activeBrickRowStrideU32.activeBrickAtlasCellOffsetLane.atlasCellCount.atlasCellStrideFloats.atlasScalarLane.candidateVoxelCount.candidateVoxelOffset.candidateVoxelOffsetBytes.generationId.backgroundValue`.split(`.`)),scalarBuffer:Object.freeze({sourceType:Y,layoutName:mt,scalarType:`f32`,strideUnits:`f32-elements`,offsetUnits:`f32-elements-or-bytes`,nativeKernelStatus:`supported`,blockedStatus:`buffer-volume-native-engine-blocked`}),sparseBrickAtlas:Object.freeze({sourceType:ht,layoutName:gt,brickSize:8,directorySentinel:_t,candidateSentinel:vt,activeBrickRowStrideU32:16,activeBrickAtlasCellOffsetLane:7,atlasCellStrideFloats:8,atlasScalarLane:0,candidateIdSpace:`logical-dual-grid-voxel-id`,candidateOffsetUnits:`u32-elements-or-bytes`,candidateOffsetAlignment:`device.limits.minStorageBufferOffsetAlignment`,extractionMode:`gpu-conservative-no-readback`,bufferOwnership:`borrowed-caller-owned`,generationRequired:!0,nativeKernelStatus:`supported`}),isovalue:`finite-number`,normalSign:`exactly-minus-one-or-plus-one`,commandEncoding:Object.freeze({option:`commandEncoder`,mode:`external-command-encoder`,extractionMode:`gpu-conservative-no-readback`,internalSubmitCount:0,callerOwnsFinishAndSubmit:!0,retirementHook:`result.retireTemporaryResourcesAfterSubmit`})}),output:Object.freeze({version:0,surfaceSchema:Re,executionSchema:ze,rowMetadataSchema:Be,outputDescriptorSchema:Ve,positionBufferDescriptorSchema:Ge,normalBufferDescriptorSchema:Ke,vertexFormat:ft,positionRows:Object.freeze({schema:Je,version:0,layoutName:$e,rowLayout:ot,rowStrideFloats:4,rowStrideBytes:16,bufferDescriptorSchema:Ge}),normalRows:Object.freeze({schema:tt,version:0,layoutName:nt,rowLayout:ct,rowStrideFloats:0,rowStrideBytes:Uint32Array.BYTES_PER_ELEMENT,encoding:rt,sourceSemantic:`scalar-gradient`,orientation:`volume.normalSign`,bufferDescriptorSchema:Ke,generationCoupledToPosition:!0,producedByNativeKernel:!0}),materialRows:Object.freeze({schema:Xe,version:0,layoutName:it,rowLayout:lt,rowStrideFloats:4,rowStrideBytes:16,materialMetadataSchema:Ue,pbrMetadataSchema:We,produced:!1}),drawRows:Object.freeze({schema:Ze,version:0,layoutName:J,rowLayout:ut,rowStrideBytes:16,placeholderStatus:`draw-rows-not-produced`,produced:!1}),indirectRows:Object.freeze({schema:Qe,version:0,layoutName:at,rowLayout:dt,rowStrideBytes:16,placeholderStatus:`indirect-draw-rows-not-produced`,produced:!1}),cpuFallbackSchema:qe,readback:!1})})}function Yt(e,{requiresTexture:t=!1,requiresNativeSource:n=!1}={}){let r=[],i=null;try{i=xt(e?.dims,`volume.dims`);let t=e?.dualGridDims==null?i.map(e=>e-1):xt(e.dualGridDims,`volume.dualGridDims`),n=Number(e?.dualGridNumVoxels)||t[0]*t[1]*t[2],a=t.every(e=>e>0)&&n>0;r.push({ok:a,kind:`volume`,status:a?`volume-dims-ready`:`volume-dims-too-small`,label:`volume.dims`,dims:i,dualGridDims:t,dualGridNumVoxels:n})}catch(e){r.push({ok:!1,kind:`volume`,status:`volume-dims-invalid`,label:`volume.dims`,error:Pt(e)})}if(t){let t=e?.texture||null,n=X(t)&&typeof t.createView==`function`;r.push({ok:n,kind:`volume`,status:n?`volume-texture-ready`:`volume-texture-missing`,label:`volume.texture`,requiresCreateView:!0})}let a=Et(e),o=e?.sourceType||e?.volumeSourceType||null,s=o===`scalar-buffer`||X(a);if(n||s||o!=null&&o!==`texture-3d`)try{let t=Dt(o,{texture:e?.texture||null,scalarBuffer:a,directoryBuffer:e?.directoryBuffer||null,activeBrickRowsBuffer:e?.activeBrickRowsBuffer||null,atlasBuffer:e?.atlasBuffer||null,candidateVoxelIdsBuffer:e?.candidateVoxelIdsBuffer||null});if(t===`texture-3d`){let n=e?.texture||null,i=X(n)&&typeof n.createView==`function`;r.push({ok:i,kind:`volume`,status:i?`volume-texture-ready`:`volume-texture-missing`,label:`volume.texture`,sourceType:t,requiresCreateView:!0})}else if(t===`scalar-buffer`){if(!X(a))r.push({ok:!1,kind:`volume`,status:`volume-scalar-buffer-missing`,label:`volume.scalarBuffer`,sourceType:t});else if(i!=null){let n=Mt({scalarBuffer:a,scalarType:Ot(e),scalarStrides:e?.scalarStrides||e?.strides||null,rowStrideFloats:e?.rowStrideFloats??null,rowStride:e?.rowStride??null,sliceStrideFloats:e?.sliceStrideFloats??null,sliceStride:e?.sliceStride??null,scalarOffset:e?.scalarOffset??e?.scalarOffsetFloats??e?.bufferOffsetFloats??e?.offsetFloats??e?.offset??null,scalarOffsetBytes:e?.scalarOffsetBytes??e?.bufferOffsetBytes??e?.byteOffset??null,bufferByteLength:e?.bufferByteLength??e?.scalarBufferByteLength??e?.byteLength??null},i),o=n.scalarType===`f32`;r.push({ok:o&&n.byteLengthValid,kind:`volume`,status:o?n.byteLengthValid?`volume-scalar-buffer-ready`:`volume-scalar-buffer-out-of-range`:`volume-scalar-buffer-type-unsupported`,label:`volume.scalarBuffer`,sourceType:t,scalarType:n.scalarType,scalarStrides:n.scalarStrides,scalarOffset:n.scalarOffset,scalarOffsetBytes:n.scalarOffsetBytes,bufferByteLength:n.bufferByteLength,requiredByteLength:n.requiredByteLength,requiredScalarCount:n.requiredScalarCount,layoutName:n.layoutName})}}else if(t===`sparse-brick-atlas`&&i!=null){let n=Nt(e,i),a=[{key:`directory`,label:`volume.directoryBuffer`,resource:n.directoryBuffer,byteLength:n.directoryBufferByteLength,requiredByteLength:n.directoryRequiredByteLength},{key:`activeBrickRows`,label:`volume.activeBrickRowsBuffer`,resource:n.activeBrickRowsBuffer,byteLength:n.activeBrickRowsBufferByteLength,requiredByteLength:n.activeBrickRowsRequiredByteLength},{key:`atlas`,label:`volume.atlasBuffer`,resource:n.atlasBuffer,byteLength:n.atlasBufferByteLength,requiredByteLength:n.atlasRequiredByteLength},{key:`candidateVoxelIds`,label:`volume.candidateVoxelIdsBuffer`,resource:n.candidateVoxelIdsBuffer,byteLength:n.candidateVoxelIdsBufferByteLength,requiredByteLength:n.candidateVoxelIdsRequiredByteLength}];X(n.candidateDispatchIndirectBuffer)&&a.push({key:`candidateDispatchIndirect`,label:`volume.candidateDispatchIndirectBuffer`,resource:n.candidateDispatchIndirectBuffer,byteLength:n.candidateDispatchIndirectBufferByteLength,requiredByteLength:n.candidateDispatchIndirectRequiredByteLength});for(let e of a){let i=X(e.resource),a=n.byteLengthChecks[e.key];r.push({ok:i&&a,kind:`volume`,status:i?a?`volume-sparse-buffer-ready`:`volume-sparse-buffer-out-of-range`:`volume-sparse-buffer-missing`,label:e.label,sourceType:t,bufferByteLength:e.byteLength,requiredByteLength:e.requiredByteLength,layoutName:n.layoutName,generationId:n.generationId,candidateVoxelOffset:n.candidateVoxelOffset,candidateVoxelOffsetBytes:n.candidateVoxelOffsetBytes})}}else n&&r.push({ok:!1,kind:`volume`,status:`volume-source-missing`,label:`volume.source`,acceptedSourceTypes:[pt,Y,ht]})}catch(e){r.push({ok:!1,kind:`volume`,status:`volume-source-invalid`,label:`volume.source`,error:Pt(e)})}return r}function Xt(e,t,{requiresTexture:n=!1,requiresNativeSource:r=!1}={}){let i=Yt(t,{requiresTexture:n,requiresNativeSource:r});if((t?.sourceType===`sparse-brick-atlas`||X(t?.candidateVoxelIdsBuffer))&&t?.dims!=null)try{let n=Nt(t,xt(t.dims,`volume.dims`)),r=St(e?.limits?.minStorageBufferOffsetAlignment??256,`device.limits.minStorageBufferOffsetAlignment`),a=n.candidateVoxelOffsetBytes%r===0;i.push({ok:a,kind:`volume`,status:a?`volume-candidate-offset-ready`:`volume-candidate-offset-unaligned`,label:`volume.candidateVoxelOffsetBytes`,candidateVoxelOffset:n.candidateVoxelOffset,candidateVoxelOffsetBytes:n.candidateVoxelOffsetBytes,minStorageBufferOffsetAlignment:r})}catch{}if(X(t?.device)){let n=Ee(e),r=Ee(t.device);i.push({ok:t.device===e,kind:`device`,status:t.device===e?`same-device`:`cross-device-volume`,label:`volume.device`,expectedDeviceId:n,ownerKnown:!0,ownerDeviceId:r,resourceKind:`gpu-device`})}X(t?.texture)&&i.push({kind:`device`,...Me({device:e,resource:t.texture,label:`volume.texture`,allowUnknown:!0})});let a=Et(t);X(a)&&i.push({kind:`device`,...Me({device:e,resource:a,label:`volume.scalarBuffer`,allowUnknown:!0})});for(let[n,r]of[[`volume.directoryBuffer`,t?.directoryBuffer],[`volume.activeBrickRowsBuffer`,t?.activeBrickRowsBuffer],[`volume.atlasBuffer`,t?.atlasBuffer],[`volume.candidateVoxelIdsBuffer`,t?.candidateVoxelIdsBuffer],[`volume.candidateDispatchIndirectBuffer`,t?.candidateDispatchIndirectBuffer]])X(r)&&i.push({kind:`device`,...Me({device:e,resource:r,label:n,allowUnknown:!0})});return i}function Zt(e){return e.find(e=>!e.ok)||null}function Qt({device:e,volume:t=null,surface:n=null,requiresTexture:r=!1,allowUnknownSurfaceBuffer:i=!0}={}){let a=[];X(e)||a.push({ok:!1,kind:`device`,status:`expected-device-missing`,label:`device`,expectedDeviceId:null,ownerKnown:!1,ownerDeviceId:null}),t!=null&&a.push(...Xt(e,t,{requiresTexture:r})),n?.buffer!=null&&a.push({kind:`device`,...Me({device:e,resource:n.buffer,label:`surface.buffer`,allowUnknown:i})}),n?.normalBuffer!=null&&a.push({kind:`device`,...Me({device:e,resource:n.normalBuffer,label:`surface.normalBuffer`,allowUnknown:i})});let o=Zt(a);return{schema:Ie,version:0,ok:o==null,status:o==null?`same-device-validated`:`same-device-check-failed`,expectedDeviceId:Ee(e),ownerDeviceId:Ee(e),requiresTexture:r,allowUnknownSurfaceBuffer:i,checks:a,failedCheck:o}}function $t({backend:e,device:t,status:n=`surface-empty`,reason:r=null,isovalue:i=null,volume:a=null,ownsDevice:o=!1,materialPayload:s=null,pbrPayload:c=null}={}){let l=Ee(t),u=Lt({ownsDevice:o,ownerDeviceId:l,device:t}),d=Ut({ownerDeviceId:l,devicePolicy:u,normalSign:a?.normalSign??1,materialPayload:s,pbrPayload:c});return{schema:Re,version:0,backend:e,status:n,reason:r,isovalue:i,volumeDims:a?.dims?Array.from(a.dims):null,layoutName:$e,rowLayoutName:$e,vertexCount:0,triangleCount:0,rowSchema:Je,rowLayout:[...ot],rowStrideFloats:4,rowStrideBytes:16,rowCount:0,vertexStrideFloats:4,vertexStrideBytes:16,vertexFormat:ft,buffer:null,bufferByteLength:0,byteLength:0,bufferRetained:!1,bufferOwnership:`none`,ownerDeviceId:l,resourceOwnership:null,devicePolicy:u,materialPayload:d.materialPayload,pbrPayload:d.pbrPayload,rowMetadata:Wt({ownerDeviceId:l,devicePolicy:u,materialPayload:s,pbrPayload:c}),outputDescriptors:d,release(){return It(`surface-buffer-empty`)}}}function en({device:e,buffer:t,normalBuffer:n=null,normalBufferByteLength:r=0,vertexCount:i,vertexCountMode:a=null,maxVertexCount:o=null,actualVertexCounterBuffer:s=null,actualVertexCounterBufferByteLength:c=0,drawIndirectBuffer:l=null,drawIndirectBufferByteLength:u=0,readbackMode:d=null,surfaceGenerationId:f=null,volumeGenerationId:p=null,normalSign:m=1,backend:h=`external`,isovalue:g=null,volume:_=null,status:v=null,ownsBuffer:y=!0,markOwner:b=!0,ownsDevice:x=!1,materialPayload:S=null,pbrPayload:C=null}={}){let w=Math.max(0,Math.round(yt(i,`vertexCount`)));if(w===0||t==null)return $t({backend:h,device:e,status:v||`surface-empty`,isovalue:g,volume:_,ownsDevice:x,materialPayload:S,pbrPayload:C});if(!X(t))throw TypeError(`createSurfaceResultFromBuffer requires a GPUBuffer-like buffer`);let T=Ae(t);b&&T==null&&X(e)&&Oe(t,e);let E=Ae(n);b&&X(n)&&E==null&&X(e)&&Oe(n,e);let D=Me({device:e,resource:t,label:`surface.buffer`,allowUnknown:!0}),O=X(n)?Me({device:e,resource:n,label:`surface.normalBuffer`,allowUnknown:!0}):null,k=Math.max(Number(t.size)||0,w*4*Float32Array.BYTES_PER_ELEMENT),A=y?`adapter-owned`:`borrowed`,j=je(t).ownerDeviceId,M=Number(n?.size),N=X(n)?Number.isFinite(M)?Math.max(0,M):Math.max(0,Number(r)||0):0,ee=Lt({ownsDevice:x,ownerDeviceId:Ee(e),device:e}),P=Ut({buffer:t,bufferByteLength:k,bufferRetained:!0,bufferOwnership:A,ownerDeviceId:j,resourceOwnership:D,devicePolicy:ee,vertexCount:w,vertexCountMode:a,maxVertexCount:o??w,actualVertexCounterBuffer:s,actualVertexCounterBufferByteLength:c,drawIndirectBuffer:l,drawIndirectBufferByteLength:u,readbackMode:d,triangleCount:w/3,normalBuffer:n,normalBufferByteLength:N,normalResourceOwnership:O,surfaceGenerationId:f,volumeGenerationId:p,normalSign:m,materialPayload:S,pbrPayload:C}),F=!1,I={schema:Re,version:0,backend:h,status:v||(D.ok?`surface-ready`:`surface-device-check-warning`),isovalue:g,volumeDims:_?.dims?Array.from(_.dims):null,layoutName:$e,rowLayoutName:$e,vertexCount:w,vertexCountMode:a,maxVertexCount:o??w,actualVertexCounterBuffer:s,actualVertexCounterBufferByteLength:c,drawIndirectBuffer:l,drawIndirectBufferByteLength:u,readbackMode:d,surfaceGenerationId:f,volumeGenerationId:p,normalBuffer:n,normalBufferByteLength:N,normalEncoding:X(n)?rt:null,normalSemantic:X(n)?`oriented-scalar-gradient`:null,normalSourceSemantic:X(n)?`scalar-gradient`:null,normalSign:bt(m),normalPositionGenerationCoupled:X(n),normalAdditionalSubmitCount:X(n)?0:null,triangleCount:w/3,rowSchema:Je,rowLayout:[...ot],rowStrideFloats:4,rowStrideBytes:16,rowCount:w,vertexStrideFloats:4,vertexStrideBytes:16,vertexFormat:ft,buffer:t,bufferByteLength:k,byteLength:k,bufferRetained:!0,bufferOwnership:A,ownerDeviceId:j,resourceOwnership:D,devicePolicy:ee,materialPayload:P.materialPayload,pbrPayload:P.pbrPayload,rowMetadata:Wt({buffer:t,bufferByteLength:k,bufferRetained:!0,bufferOwnership:A,ownerDeviceId:j,resourceOwnership:D,devicePolicy:ee,vertexCount:w,triangleCount:w/3,normalBuffer:n,normalBufferByteLength:N,normalResourceOwnership:O,surfaceGenerationId:f,volumeGenerationId:p,normalSign:m,materialPayload:S,pbrPayload:C}),outputDescriptors:P,release({force:e=!1}={}){return F?It(`surface-buffer-already-released`,{released:!0}):!y&&!e?It(`surface-buffer-borrowed-retained`,{released:!1}):(t.destroy?.(),n&&n!==t&&n.destroy?.(),F=!0,I.status=`surface-buffer-released`,I.bufferRetained=!1,I.rowMetadata.status=`surface-position-rows-released`,I.rowMetadata.position.status=`position-rows-released`,I.rowMetadata.position.bufferRetained=!1,I.rowMetadata.position.positionBufferDescriptor.status=`position-rows-released`,I.rowMetadata.position.positionBufferDescriptor.bufferRetained=!1,I.outputDescriptors.status=`surface-outputs-released`,I.outputDescriptors.retainedBuffers.position=null,I.outputDescriptors.retainedBuffers.normal=null,I.outputDescriptors.rows.position.status=`position-rows-released`,I.outputDescriptors.rows.position.bufferRetained=!1,I.outputDescriptors.rows.position.positionBufferDescriptor.status=`position-rows-released`,I.outputDescriptors.rows.position.positionBufferDescriptor.bufferRetained=!1,I.outputDescriptors.positionBufferDescriptor.status=`position-rows-released`,I.outputDescriptors.positionBufferDescriptor.bufferRetained=!1,I.rowMetadata.normal.status=`normal-rows-released`,I.rowMetadata.normal.bufferRetained=!1,I.rowMetadata.normal.normalBufferDescriptor.status=`normal-rows-released`,I.rowMetadata.normal.normalBufferDescriptor.bufferRetained=!1,I.outputDescriptors.rows.normal.status=`normal-rows-released`,I.outputDescriptors.rows.normal.bufferRetained=!1,I.outputDescriptors.rows.normal.normalBufferDescriptor.status=`normal-rows-released`,I.outputDescriptors.rows.normal.normalBufferDescriptor.bufferRetained=!1,I.outputDescriptors.normalBufferDescriptor.status=`normal-rows-released`,I.outputDescriptors.normalBufferDescriptor.bufferRetained=!1,y&&(s?.destroy?.(),l?.destroy?.()),It(`surface-buffer-released`,{released:!0}))}};return I}function tn(e,{device:t,ownsDevice:n=!1,ownsBuffer:r=!0,materialPayload:i=null,pbrPayload:a=null}={}){if(!X(e)||e.schema!==`peercompute.webgpu-marching-cubes.surface.v0`)return e;let o=Math.max(0,Math.round(Number(e.vertexCount??e.rowCount)||0)),s=Math.max(0,Number(e.triangleCount)||o/3),c=e.buffer||null,l=e.normalBuffer||e.outputDescriptors?.rows?.normal?.buffer||e.rowMetadata?.normal?.buffer||null,u=o>0&&X(c),d=Math.max(Number(e.bufferByteLength)||0,u?o*4*Float32Array.BYTES_PER_ELEMENT:0),f=e.resourceOwnership||(u?Me({device:t,resource:c,label:`surface.buffer`,allowUnknown:!0}):null),p=e.normalResourceOwnership||(X(l)?Me({device:t,resource:l,label:`surface.normalBuffer`,allowUnknown:!0}):null),m=Number(l?.size),h=X(l)?Number.isFinite(m)?Math.max(0,m):Math.max(0,Number(e.normalBufferByteLength)||0):0,g=e.ownerDeviceId||(u?je(c).ownerDeviceId:null)||Ee(t),_=e.bufferOwnership||(u?r?`adapter-owned`:`borrowed`:`none`),v=e.devicePolicy||Lt({ownsDevice:n,ownerDeviceId:Ee(t),device:t}),y=i??e.materialPayload??e.material??null,b=a??e.pbrPayload??e.pbr??null;e.version=e.version??0,e.layoutName=e.layoutName||`peercompute.webgpu-marching-cubes.layout.compact-position-f32x4.v0`,e.rowLayoutName=e.rowLayoutName||`peercompute.webgpu-marching-cubes.layout.compact-position-f32x4.v0`,e.vertexCount=o,e.vertexCountMode=e.vertexCountMode||null,e.maxVertexCount=Math.max(o,Math.round(Number(e.maxVertexCount)||0)),e.actualVertexCounterBuffer=e.actualVertexCounterBuffer||null,e.actualVertexCounterBufferByteLength=Math.max(0,Number(e.actualVertexCounterBufferByteLength)||0),e.drawIndirectBuffer=e.drawIndirectBuffer||null,e.drawIndirectBufferByteLength=Math.max(0,Number(e.drawIndirectBufferByteLength)||0),e.readbackMode=e.readbackMode||null,e.surfaceGenerationId=e.surfaceGenerationId??null,e.volumeGenerationId=e.volumeGenerationId??null,e.normalBuffer=l,e.normalBufferByteLength=h,e.normalSign=bt(e.normalSign??1),e.triangleCount=s,e.bufferByteLength=d,e.byteLength=e.byteLength??d,e.bufferOwnership=_,e.ownerDeviceId=g,e.resourceOwnership=f,e.devicePolicy=v,e.materialPayload=Rt(y),e.pbrPayload=zt(b);let x=Wt({buffer:c,bufferByteLength:d,bufferRetained:u&&!!e.bufferRetained,bufferOwnership:_,ownerDeviceId:g,resourceOwnership:f,devicePolicy:v,vertexCount:o,triangleCount:s,normalBuffer:l,normalBufferByteLength:h,normalResourceOwnership:p,surfaceGenerationId:e.surfaceGenerationId,volumeGenerationId:e.volumeGenerationId,normalSign:e.normalSign,materialPayload:y,pbrPayload:b}),S=Ut({buffer:c,bufferByteLength:d,bufferRetained:u&&!!e.bufferRetained,bufferOwnership:_,ownerDeviceId:g,resourceOwnership:f,devicePolicy:v,vertexCount:o,triangleCount:s,normalBuffer:l,normalBufferByteLength:h,normalResourceOwnership:p,surfaceGenerationId:e.surfaceGenerationId,volumeGenerationId:e.volumeGenerationId,normalSign:e.normalSign,materialPayload:y,pbrPayload:b});return e.rowMetadata=e.rowMetadata?.schema===`peercompute.webgpu-marching-cubes.surface-row-metadata.v0`?e.rowMetadata:x,e.outputDescriptors=e.outputDescriptors?.schema===`peercompute.webgpu-marching-cubes.surface-output-descriptor.v0`?e.outputDescriptors:S,e.rowMetadata.version=e.rowMetadata.version??0,e.outputDescriptors.version=e.outputDescriptors.version??0,e.outputDescriptors.descriptorVersion=e.outputDescriptors.descriptorVersion??0,e.rowMetadata.position==null?e.rowMetadata.position=x.position:e.rowMetadata.position.positionBufferDescriptor??(e.rowMetadata.position.positionBufferDescriptor=x.position.positionBufferDescriptor),e.outputDescriptors.rows==null?e.outputDescriptors.rows=S.rows:e.outputDescriptors.rows.position==null?e.outputDescriptors.rows.position=S.rows.position:e.outputDescriptors.rows.position.positionBufferDescriptor??(e.outputDescriptors.rows.position.positionBufferDescriptor=S.rows.position.positionBufferDescriptor),e.rowMetadata.normal??(e.rowMetadata.normal=x.normal),e.outputDescriptors.rows.normal??(e.outputDescriptors.rows.normal=S.rows.normal),e.outputDescriptors.positionBufferDescriptor=e.outputDescriptors.positionBufferDescriptor||e.outputDescriptors.rows?.position?.positionBufferDescriptor||S.positionBufferDescriptor,e.outputDescriptors.normalBufferDescriptor=e.outputDescriptors.normalBufferDescriptor||e.outputDescriptors.rows?.normal?.normalBufferDescriptor||S.normalBufferDescriptor,e}var nn=Object.freeze(`sourceType.noReadback.vertexRowsBudget.vertexRowsBudgetClamped.conservativeWorstCaseVertexCount.candidateVoxelCount.candidateVoxelOffset.candidateVoxelOffsetBytes.candidateVoxelCountMode.volumeGenerationId.surfaceGenerationId.normalBuffer.normalBufferByteLength.normalEncoding.normalSemantic.normalSourceSemantic.normalSign.normalDegenerateEncoding.normalProducerStage.normalTimestampSpanLabel.normalAdditionalSubmitCount.normalPositionGenerationCoupled.commandEncodingMode.internalSubmitCount.requiresExternalSubmit.encodingRetirement.temporaryResourceCount.retireTemporaryResourcesAfterSubmit`.split(`.`));function rn(e,t){if(!X(e)||!X(t))return e;for(let n of nn)t[n]!==void 0&&(e[n]=t[n]);return e}async function an({device:e,volume:t}){let{MarchingCubes:n}=await N(async()=>{let{MarchingCubes:e}=await import(`./marching_cubes-DBTWK5ez.js`);return{MarchingCubes:e}},[],import.meta.url),r=Kt(t,{device:e,requireNativeSource:!0});return n.create(r,e)}function on({adapter:e,backend:t,device:n,currentVolume:r,input:i={},requiresTexture:a=!1,requiresNativeSource:o=!1}={}){let s=typeof i==`number`?{isovalue:i}:i||{},c=null,l=[];try{c=yt(s?.isovalue,`isovalue`)}catch(e){l.push(Pt(e))}let u=s.volume||r,d=u!=null,f=d?Xt(n,u,{requiresTexture:a,requiresNativeSource:o}):[],p=Zt(f),m=`ready`;return l.length>0?m=`invalid-input`:d?p!=null&&(m=p.kind===`device`?`same-device-check-failed`:p.status===`buffer-volume-native-engine-blocked`?`buffer-volume-native-engine-blocked`:`preflight-check-failed`):(m=`volume-missing`,l.push({status:m,message:`extractSurface requires a volume`})),{schema:Fe,version:0,adapterSchema:Ne,adapterId:e.adapterId,backend:t,ok:m===`ready`,status:m,isovalue:c,hasVolume:d,volumeDims:u?.dims?Array.from(u.dims):null,requiresTexture:a,requiresNativeSource:o,sourceType:u?.sourceType||Dt(null,{texture:u?.texture||null,scalarBuffer:Et(u),directoryBuffer:u?.directoryBuffer||null,activeBrickRowsBuffer:u?.activeBrickRowsBuffer||null,atlasBuffer:u?.atlasBuffer||null,candidateVoxelIdsBuffer:u?.candidateVoxelIdsBuffer||null}),deviceChecks:f,errors:l,ownerDeviceId:e.ownerDeviceId,devicePolicy:e.devicePolicy}}function sn({adapter:e,backend:t,status:n,ok:r,result:i=null,webgpuStatus:a=null,deviceChecks:o=[],preflight:s=null,errors:c=[]}={}){return{schema:ze,version:0,adapterSchema:Ne,adapterId:e.adapterId,backend:t,status:n,ok:r,result:i,preflight:s,webgpuStatus:a||{status:n},deviceChecks:o,errors:c,ownsDevice:e.ownsDevice,deviceOwned:!!e.ownsDevice,devicePolicy:e.devicePolicy,ownerDeviceId:e.ownerDeviceId,readback:!1,surfaceVertexReadback:!1}}function cn({device:e,volume:t=null,engine:n=null,engineFactory:r=an,backend:i=`webgpu`,ownsDevice:a=!1,adapterId:o=`webgpu-marching-cubes`,onStatus:s=null}={}){if(!X(e))throw TypeError(`createMarchingCubesSurfaceAdapter requires an existing GPUDevice`);if(typeof r!=`function`&&n==null)throw TypeError(`createMarchingCubesSurfaceAdapter requires an engineFactory or engine`);let c=n,l=t,u=!1,d=Ee(e),f=Lt({ownsDevice:a,ownerDeviceId:d,device:e}),p=n==null&&r===an,m={schema:Ne,adapterId:o,backend:i,device:e,ownerDeviceId:d,devicePolicy:f,ownsDevice:!!a,contract:Jt({backend:i}),get volume(){return l},async setVolume(e){return l=e,c!=null&&c!==n&&await c.dispose?.(),c=n,this.getStatus(`volume-set`)},getStatus(e=u?`adapter-released`:`adapter-ready`){return{schema:Ne,version:0,adapterId:o,backend:i,status:e,ownsDevice:!!a,ownerDeviceId:d,devicePolicy:f,hasVolume:l!=null,hasEngine:c!=null,requiresTexture:!1,requiresNativeSource:p,contractSchema:Pe,preflightSchema:Fe}},getCapabilities(){return Jt({backend:i})},preflight(t={}){return on({adapter:m,backend:i,device:e,currentVolume:l,input:t,requiresTexture:!1,requiresNativeSource:p})},async extractSurface(t={}){let n=typeof t==`number`?{isovalue:t}:t||{},a=m.preflight(n),o=a.isovalue,s=n.volume||l,u=n.materialPayload??n.material??null,d=n.pbrPayload??n.pbr??null,f={isovalue:o,volume:s,device:e,materialPayload:u,pbrPayload:d,readbackMode:n.readbackMode,noReadback:n.noReadback,vertexRowsBudget:n.vertexRowsBudget,timestampProfiler:n.timestampProfiler,timestampMetadata:n.timestampMetadata,commandEncoder:n.commandEncoder};if(!a.ok){let t=Zt(a.deviceChecks),n=a.errors[0]||t||{status:a.status,message:a.status},r=a.status===`same-device-check-failed`,c=a.status===`invalid-input`||a.status===`volume-missing`,l=a.status===`buffer-volume-native-engine-blocked`,f=$t({backend:i,device:e,status:r?`surface-device-check-failed`:l?`buffer-volume-native-engine-blocked`:`surface-error`,reason:n.message||n.status,isovalue:o,volume:s,ownsDevice:m.ownsDevice,materialPayload:u,pbrPayload:d});return sn({adapter:m,backend:i,status:c?`invalid-input`:a.status,ok:!1,result:f,preflight:a,webgpuStatus:{status:c?`invalid-input`:l?`buffer-volume-native-engine-blocked`:`blocked`,reason:n.message||n.status},deviceChecks:a.deviceChecks,errors:a.errors.length>0?a.errors:[n]})}try{if(c==null||s!==l){l=s;try{c=await r({device:e,volume:s,adapter:m,capabilities:m.getCapabilities()})}catch(e){throw Ft(e,`native-engine-create`)}}let t;try{t=typeof c.extractSurface==`function`?await c.extractSurface(f):await c.computeSurface(o,f)}catch(e){throw Ft(e,`native-engine-extract-surface`)}let p=u??t?.materialPayload??t?.material??null,h=d??t?.pbrPayload??t?.pbr??null,g=t?.schema===`peercompute.webgpu-marching-cubes.surface.v0`?t:en({device:e,buffer:t?.buffer||null,normalBuffer:t?.normalBuffer||null,normalBufferByteLength:t?.normalBufferByteLength||0,vertexCount:t?.count||t?.vertexCount||0,vertexCountMode:t?.vertexCountMode||null,maxVertexCount:t?.maxVertexCount??null,actualVertexCounterBuffer:t?.actualVertexCounterBuffer||null,actualVertexCounterBufferByteLength:t?.actualVertexCounterBufferByteLength||0,drawIndirectBuffer:t?.drawIndirectBuffer||null,drawIndirectBufferByteLength:t?.drawIndirectBufferByteLength||0,readbackMode:t?.readbackMode||n.readbackMode||null,surfaceGenerationId:t?.surfaceGenerationId??null,volumeGenerationId:t?.volumeGenerationId??s?.generationId??null,normalSign:t?.normalSign??s?.normalSign??1,backend:i,isovalue:o,volume:s,ownsBuffer:n.ownsBuffer??!0,ownsDevice:m.ownsDevice,materialPayload:p,pbrPayload:h});rn(g,t),tn(g,{device:e,ownsDevice:m.ownsDevice,ownsBuffer:n.ownsBuffer??!0,materialPayload:p,pbrPayload:h});let _=Qt({device:e,volume:s,surface:g,requiresTexture:!1,allowUnknownSurfaceBuffer:!0}),v=_.checks.find(e=>(e.label===`surface.buffer`||e.label===`surface.normalBuffer`)&&!e.ok);return v==null?sn({adapter:m,backend:i,status:g.vertexCount>0?`surface-ready`:`surface-empty`,ok:!0,result:g,webgpuStatus:{status:`executed`,vertexCount:g.vertexCount,triangleCount:g.triangleCount,validation:_},deviceChecks:_.checks,preflight:a}):(g.status=`surface-device-check-failed`,sn({adapter:m,backend:i,status:`same-device-check-failed`,ok:!1,result:g,webgpuStatus:{status:`blocked`,reason:v.status,validation:_},deviceChecks:_.checks,preflight:a,errors:[v]}))}catch(t){let n=Pt(t),r=n.status===`buffer-volume-native-engine-blocked`;return sn({adapter:m,backend:i,status:r?`buffer-volume-native-engine-blocked`:`surface-error`,ok:!1,result:$t({backend:i,device:e,status:r?`buffer-volume-native-engine-blocked`:`surface-error`,reason:n.message,isovalue:o,volume:s,ownsDevice:m.ownsDevice,materialPayload:u,pbrPayload:d}),webgpuStatus:{status:r?`buffer-volume-native-engine-blocked`:`error`,reason:n.message,error:n},deviceChecks:a.deviceChecks,preflight:a,errors:[n]})}},async release({destroyDevice:t=!1}={}){return u=!0,await c?.dispose?.(),c=null,(t||a)&&typeof e.destroy==`function`&&e.destroy(),this.getStatus(`adapter-released`)}};return s?.(m.getStatus()),m}var ln=O.length,un=p.length,dn=f.length,fn=`peercompute.ulg.sph-render-field-motion.v0`,pn=o.length;i.length;var mn=t.length,hn=n.length,gn=m.length,_n=h.length,vn=A.length,yn=S.length,bn=v.length,xn=64*1024*1024,Sn=32768,Cn=64*1024*1024,wn=34028234663852886e22,Tn=11754943508222875e-54,En=Tn*16,Dn=Math.fround(1e-12),On=new Float32Array(1),kn=new Uint32Array(On.buffer),An=new WeakMap,jn=new WeakMap,Mn=new WeakMap,Nn=new WeakMap;function Pn(e){let t=Array.isArray(e?.metadata)?e.metadata:[],n=e?.records??null;return Object.freeze({surfaceTable:e,records:n,recordValues:n instanceof Float32Array?Object.freeze(Array.from(n)):null,metadata:t,surfaceCount:e?.surfaceCount,totalFieldCells:e?.totalFieldCells,maxFieldCellCount:e?.maxFieldCellCount,surfaces:Object.freeze(t.map(e=>Object.freeze({surface:e,index:e?.index,resolution:e?.resolution,fieldOffset:e?.fieldOffset,fieldCellCount:e?.fieldCellCount,isolation:e?.isolation,subtract:e?.subtract,strength:e?.strength,radiusNorm:e?.radiusNorm,particleRadiusScale:e?.particleRadiusScale,particleRadiusFloorNorm:e?.particleRadiusFloorNorm,colorLinear:Array.isArray(e?.colorLinear)?Object.freeze([...e.colorLinear]):null,surfaceKey:e?.surfaceKey,material:e?.material,phase:e?.phase,renderKey:e?.renderKey,materialId:e?.materialId,phaseId:e?.phaseId,opticalStateId:e?.opticalStateId,opticalStateKey:e?.opticalStateKey,surfaceIdentityKey:e?.surfaceIdentityKey,collectiveOpticalRoute:e?.collectiveOpticalRoute,collectiveOpticalRouteSchema:e?.collectiveOpticalRouteSchema,collectiveOpticalRouteKey:e?.collectiveOpticalRouteKey,collectiveOpticalRouteId:e?.collectiveOpticalRouteId,opticalResponseAuthorityFlag:e?.opticalResponseAuthorityFlag,opticalResponseAuthority:e?.opticalResponseAuthority,opticalResponseReady:e?.opticalResponseReady,opticalVisibilityFlag:e?.opticalVisibilityFlag,opticalVisibilityReason:e?.opticalVisibilityReason,opticalOpacity:e?.opticalOpacity,opticalEffectiveOpacity:e?.opticalEffectiveOpacity,opticalDepth:e?.opticalDepth,opticalScatteringCoefficientPerM:e?.opticalScatteringCoefficientPerM,opticalTransmission:e?.opticalTransmission,opticalRoughness:e?.opticalRoughness,opticalBlockedFlag:e?.opticalBlockedFlag,opticalProvenanceSource:e?.opticalProvenanceSource,renderDomainId:e?.renderDomainId,renderDomainKey:e?.renderDomainKey,renderLayer:e?.renderLayer,renderOrder:e?.renderOrder,transparencyClassId:e?.transparencyClassId,depthWriteFlag:e?.depthWriteFlag,emissiveTemperatureK:e?.emissiveTemperatureK,status:e?.status})))})}function Fn(e,t){let n=e?.metadata;return!!(t&&e===t.surfaceTable&&e?.records===t.records&&t.records instanceof Float32Array&&Array.isArray(t.recordValues)&&t.records.length===t.recordValues.length&&t.recordValues.every((e,n)=>Object.is(t.records[n],e))&&n===t.metadata&&e?.surfaceCount===t.surfaceCount&&e?.totalFieldCells===t.totalFieldCells&&e?.maxFieldCellCount===t.maxFieldCellCount&&Array.isArray(n)&&n.length===t.surfaces.length&&t.surfaces.every((e,t)=>{let r=n[t];return!!(r===e.surface&&r?.index===e.index&&r?.resolution===e.resolution&&r?.fieldOffset===e.fieldOffset&&r?.fieldCellCount===e.fieldCellCount&&r?.isolation===e.isolation&&r?.subtract===e.subtract&&r?.strength===e.strength&&r?.radiusNorm===e.radiusNorm&&r?.particleRadiusScale===e.particleRadiusScale&&r?.particleRadiusFloorNorm===e.particleRadiusFloorNorm&&(e.colorLinear==null?r?.colorLinear==null:Array.isArray(r?.colorLinear)&&r.colorLinear.length===e.colorLinear.length&&e.colorLinear.every((e,t)=>Object.is(r.colorLinear[t],e)))&&r?.surfaceKey===e.surfaceKey&&r?.material===e.material&&r?.phase===e.phase&&r?.renderKey===e.renderKey&&r?.materialId===e.materialId&&r?.phaseId===e.phaseId&&r?.opticalStateId===e.opticalStateId&&r?.opticalStateKey===e.opticalStateKey&&r?.surfaceIdentityKey===e.surfaceIdentityKey&&r?.collectiveOpticalRoute===e.collectiveOpticalRoute&&r?.collectiveOpticalRouteSchema===e.collectiveOpticalRouteSchema&&r?.collectiveOpticalRouteKey===e.collectiveOpticalRouteKey&&r?.collectiveOpticalRouteId===e.collectiveOpticalRouteId&&r?.opticalResponseAuthorityFlag===e.opticalResponseAuthorityFlag&&r?.opticalResponseAuthority===e.opticalResponseAuthority&&r?.opticalResponseReady===e.opticalResponseReady&&r?.opticalVisibilityFlag===e.opticalVisibilityFlag&&r?.opticalVisibilityReason===e.opticalVisibilityReason&&r?.opticalOpacity===e.opticalOpacity&&r?.opticalEffectiveOpacity===e.opticalEffectiveOpacity&&r?.opticalDepth===e.opticalDepth&&r?.opticalScatteringCoefficientPerM===e.opticalScatteringCoefficientPerM&&r?.opticalTransmission===e.opticalTransmission&&r?.opticalRoughness===e.opticalRoughness&&r?.opticalBlockedFlag===e.opticalBlockedFlag&&r?.opticalProvenanceSource===e.opticalProvenanceSource&&r?.renderDomainId===e.renderDomainId&&r?.renderDomainKey===e.renderDomainKey&&r?.renderLayer===e.renderLayer&&r?.renderOrder===e.renderOrder&&r?.transparencyClassId===e.transparencyClassId&&r?.depthWriteFlag===e.depthWriteFlag&&r?.emissiveTemperatureK===e.emissiveTemperatureK&&r?.status===e.status)}))}function In({buffer:e,artifact:t,invalidate:n}={}){if(!e||!t||typeof n!=`function`)return null;let r=Nn.get(e);r?.artifact!==t&&r?.invalidate?.();let i=Object.freeze({buffer:e,artifact:t,invalidate:n});return Nn.set(e,i),i}function Ln(e){if(!e)return!1;let t=Nn.get(e);return t&&t.invalidate?.(),Nn.delete(e),!!t}function Rn(e,t){return e?Nn.get(e)?.artifact===t:!0}function zn(e,t){e&&Nn.get(e)?.artifact===t&&Nn.delete(e)}function Bn(e,{device:t,sourceFamily:n,particleCount:r,renderRowsBuffer:i=null,renderRows:a=null}={}){let o=An.get(e);return!!(o&&o.active===!0&&o.device===t&&o.sourceFamily===n&&o.particleCount===r&&e?.schroederSpatialSourceFamily===o.sourceFamily&&e?.particleCount===o.particleCount&&(e?.renderRowsBuffer??null)===o.renderRowsBuffer&&e?.renderRows===o.renderRows&&(o.renderRowsBuffer!=null||Array.isArray(o.renderRowValues)&&e.renderRows instanceof Float32Array&&e.renderRows.length===o.renderRowValues.length&&o.renderRowValues.every((t,n)=>e.renderRows[n]===t))&&(e?.dispersedMediumOptics??null)===o.dispersedMediumOptics&&e?.rowStrideFloats===o.rowStrideFloats&&Array.isArray(e?.rowLayout)&&e.rowLayout.length===o.rowLayout.length&&e.rowLayout.every((e,t)=>e===o.rowLayout[t])&&(i==null||o.renderRowsBuffer===i)&&(a==null||o.renderRows===a)&&(o.renderRowsBuffer==null||jn.get(o.renderRowsBuffer)===e)&&(o.dispersedMediumOptics==null||o.dispersedMediumOptics.buffer===o.dispersedMediumOpticsBuffer&&o.dispersedMediumOptics.authority===o.dispersedMediumOpticsAuthority&&R(t,o.dispersedMediumOpticsAuthority,{buffer:o.dispersedMediumOpticsBuffer,particleCount:o.particleCount,rowCount:o.particleCount,rowStrideFloats:8})))}function Vn({device:e,sourceFamily:t,productEventRows:n=null,productEventBuffer:r=null,productEventSource:i=null,productEventCount:a=0,productEventLiveCountDescriptor:o=null}={}){return n!=null||r!=null||i!=null||Number(a)!==0?n!=null||r==null||i==null||i.productEventBuffer!==r||!Number.isSafeInteger(a)||a<=0||!o||!j(o,{handle:i,device:e})||o.hostObserved!==!1||o.expectedRowCapacity!==a||o.rowCapacity!==a||o.expectedRowStrideVec4!==pn/4||o.rowStrideFloats!==pn||Number(r.size)<a*pn*Float32Array.BYTES_PER_ELEMENT?!1:te(t?.productHistoryCommitGate??null,{device:e,residentProductMass:i}):!0}function Hn(e){let t=An.get(e);!t||t.active!==!0||(t.active=!1,t.renderRowsBuffer&&jn.get(t.renderRowsBuffer)===e&&jn.delete(t.renderRowsBuffer))}function Un(e,{device:t,sourceFamily:n,particleCount:r,fieldRowsBuffer:i=null,fieldRows:a=null,surfaceBuffer:o=null,surfaceTable:s=null}={}){let c=Mn.get(e);return!!(c&&c.active===!0&&c.device===t&&c.sourceFamily===n&&c.particleCount===r&&e?.schroederSpatialSourceFamily===c.sourceFamily&&e?.particleCount===c.particleCount&&(e?.fieldRowsBuffer??null)===c.fieldRowsBuffer&&e?.fieldRows===c.fieldRows&&(e?.surfaceBuffer??null)===c.surfaceBuffer&&e?.surfaceTable===c.surfaceTable&&e?.rowStrideFloats===c.rowStrideFloats&&e?.fieldRowByteLength===c.fieldRowByteLength&&e?.fieldRowsBufferByteLength===c.fieldRowsBufferByteLength&&e?.fieldPadding===c.fieldPadding&&e?.refEdgeM===c.refEdgeM&&e?.productEventCount===c.productEventCount&&e?.productEventRowCapacity===c.productEventRowCapacity&&e?.productEventBufferBound===(c.productEventBuffer!=null)&&e?.productEventCountAuthority===c.productEventCountAuthority&&e?.productEventControlAuthentication===c.productEventControlAuthentication&&c.productEventSourceAuthenticated===(c.productEventBuffer!=null)&&e?.dispersedMediumOpticsBound===!!(c.dispersedMediumOpticsBuffer||c.dispersedMediumOpticsRows)&&e?.dispersedMediumOpticsRowCount===(c.dispersedMediumOpticsBuffer||c.dispersedMediumOpticsRows?c.particleCount:0)&&c.dispersedMediumOpticsSourceAuthenticated===!!c.dispersedMediumOpticsBuffer&&(c.dispersedMediumOpticsBuffer==null||c.dispersedMediumOptics===c.renderRowsSource?.dispersedMediumOptics&&c.dispersedMediumOptics?.buffer===c.dispersedMediumOpticsBuffer&&c.dispersedMediumOptics?.authority===c.dispersedMediumOpticsAuthority)&&Fn(e?.surfaceTable,c.surfaceTableSnapshot)&&(i==null||c.fieldRowsBuffer===i)&&(a==null||c.fieldRows===a)&&(o==null||c.surfaceBuffer===o)&&(s==null||c.surfaceTable===s)&&(c.fieldRowsBuffer==null||Rn(c.fieldRowsBuffer,e)))}function Wn(e){let t=Mn.get(e);!t||t.active!==!0||(t.active=!1,t.fieldRowsBuffer&&zn(t.fieldRowsBuffer,e))}var Gn=1.9,Kn=.5,qn=48,Jn=`peercompute.ulg.sph-render-row-particle-scale-stability.v0`,Yn=`peercompute.ulg.sph-render-row-material-bank-particle-size-consumer.v0`,Xn=`sph-resident-render-row-extraction`,Zn=`sph-resident-render-field-splat`,Qn=`full-parity-readback`,$n=`no-full-readback`,er=`dense-readback`,tr=`compact-active-readback`,nr=`gpu-resident-summary`,rr=`fixed-cell-slots`,ir=`atomic-compact`,ar=Object.freeze(Object.fromEntries(Object.entries(I).map(([e,t])=>[t,e]))),Z={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,VERTEX:globalThis.GPUBufferUsage?.VERTEX??32,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256},or={READ:globalThis.GPUMapMode?.READ??1},sr=16777215;function cr(e){if(e?.schema!==`peercompute.ulg.sph-gpu-particle-buffer.v0`)throw TypeError(`SPH render rows require a packed SPH GPU particle buffer`)}function lr(e){let t=Math.max(0,Math.round(Q(e?.particleCount,0))*G);if(e?.identity==null)return new Uint32Array(t);if(!(e.identity instanceof Uint32Array))throw TypeError(`SPH particle identity rows must be a Uint32Array`);if(e.identity.length<t)throw RangeError(`SPH particle identity rows must cover every particle slot`);return e.identity}function ur({sphParticleState:e=null,sphParticleUpload:t=null}={}){return e?.cpuStateStale===!0||e?.cpuIdentityStale===!0||t?.identityRequired===!0||ne(e)}function dr(e={}){return ur(e)||F(e.sphParticleUpload)}function fr({device:e,sphParticleUpload:t,particleCount:n,identityBuffer:r}){let i=e=>e!=null&&(typeof e!=`number`||e!==0);if(!(t?.dispersedMediumOptics!=null||t?.dispersedMediumOpticsAuthority!=null||t?.dispersedMediumOpticsBuffer!=null||i(t?.dispersedMediumOpticsRowCount)||i(t?.dispersedMediumOpticsRowStrideFloats)||i(t?.dispersedMediumOpticsBufferByteLength)||t?.ownsDispersedMediumOpticsBuffer===!0))return null;let a=t?.dispersedMediumOptics??null,o=n*8*Float32Array.BYTES_PER_ELEMENT,s=Number(a?.buffer?.size);if(!a||a.particleCount!==n||a.rowCount!==n||a.rowStrideFloats!==8||a.bufferByteLength!==o||!Number.isSafeInteger(s)||s!==o||t.dispersedMediumOpticsAuthority!==a.authority||t.dispersedMediumOpticsBuffer!==a.buffer||t.dispersedMediumOpticsRowCount!==a.rowCount||t.dispersedMediumOpticsRowStrideFloats!==a.rowStrideFloats||t.dispersedMediumOpticsBufferByteLength!==a.bufferByteLength||t.ownsDispersedMediumOpticsBuffer!==!0&&t.ownsDispersedMediumOpticsBuffer!==!1||!le(a,{particleCount:n,topologyEpoch:t.topologyEpoch,identityRevision:t.identityRevision,identityBuffer:r})||!R(e,a.authority,{buffer:a.buffer,particleCount:n,rowCount:n,rowStrideFloats:8}))throw TypeError(`SPH render rows rejected a torn, foreign, or misaligned dispersed-medium optics sidecar`);return a}function Q(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function pr(e,t,{positive:n=!1}={}){let r=Number(e);if(!Number.isSafeInteger(r)||r<+!!n||r>sr||Math.fround(r)!==r)throw RangeError(`${t} must be a ${n?`positive`:`non-negative`} integer exactly representable as f32`);return r}function mr(e,t,{min:n=0}={}){let r=Number(e);if(!Number.isSafeInteger(r)||r<n||r>4294967295||Math.fround(r)!==r)throw RangeError(`${t} must be an integer exactly representable as both u32 and f32`);return r}function hr(e,t){let n=Number(e);if(!Number.isSafeInteger(n)||n<0||n>4294967295)throw RangeError(`${t} must be a non-negative safe u32 integer`);return n}function gr(e,t){let n=Number(e),r=Number(t);if(!Number.isFinite(n))throw RangeError(`fieldPadding must be finite`);if(!Number.isFinite(r))throw RangeError(`refEdgeM must be finite`);let i=Math.fround(n),a=Math.fround(r);if(!(i>=0&&i<.5))throw RangeError(`fieldPadding must satisfy 0 <= fieldPadding < 0.5 after f32 encoding`);if(!(a>0)||!Number.isFinite(a))throw RangeError(`refEdgeM must be positive and finite after f32 encoding`);if(a<Dn)throw RangeError(`refEdgeM must be at least 1e-12 m after f32 encoding`);return{fieldPadding:i,refEdgeM:a}}function _r(e,t){if(!(e>0))return Math.max(0,t);if(!(t>0))return Math.max(0,e);if(e>=wn-t)return wn;let n=Math.fround(e+t);return n<Tn?0:n}function vr(e,t){if(!(e>0)||!(t>0))return 0;let n=Math.fround(e*t);return Number.isFinite(n)?n<Tn?0:n:wn}function yr(e){return On[0]=e,kn[0]}function br(e){return kn[0]=e>>>0,On[0]}function xr(e){let t=yr(e)&2147483647,n=t>>>23&255,r=t&8388607;if(t===0||n===255)return null;if(n===0){let e=31-Math.clz32(r);return{mantissa:br(1065353216|r<<23-e>>>0&8388607),exponent:e-149}}return{mantissa:br(1065353216|r),exponent:n-127}}function Sr(e,t,n){let r=xr(e),i=xr(t),a=xr(n);if(!r||!i||!a)return 0;let o=Math.fround(Math.fround(Math.fround(r.mantissa*i.mantissa)*a.mantissa)*a.mantissa),s=r.exponent+i.exponent+2*a.exponent;for(let e=0;e<4&&o>=2;e+=1)o=Math.fround(o*.5),s+=1;return s<-126?0:s>127?wn:br((s+127<<23|yr(o)&8388607)>>>0)}function Cr(e,t,n){let r=Sr(e,t,n);if(r===0)return 0;let i=yr(e)&2147483648;return br((yr(r)|i)>>>0)}function wr(e,t){return t<-126?0:br((t+127<<23|yr(e)&8388607)>>>0)}function Tr(e,t){if(!e?.nonzero)return{...t,nonzero:!!t?.nonzero};if(!t?.nonzero)return{...e,nonzero:!0};let n,r;if(t.exponent>=e.exponent){let i=wr(e.mantissa,e.exponent-t.exponent);n=t.exponent,r=Math.fround(t.mantissa+i)}else{let i=wr(t.mantissa,t.exponent-e.exponent);n=e.exponent,r=Math.fround(e.mantissa+i)}return r>=2&&(r=Math.fround(r*.5),n+=1),{mantissa:r,exponent:n,nonzero:!0}}function Er(e,t){return e?.nonzero?t?.nonzero?e.exponent===t.exponent?e.mantissa===t.mantissa?0:e.mantissa>t.mantissa?1:-1:e.exponent>t.exponent?1:-1:1:t?.nonzero?-1:0}function Dr(e,t){if(!e?.nonzero)return{mantissa:0,exponent:0,nonzero:!1};if(!t?.nonzero)return{...e,nonzero:!0};let n=wr(t.mantissa,t.exponent-e.exponent),r=xr(Math.fround(e.mantissa-n));return r?{mantissa:r.mantissa,exponent:e.exponent+r.exponent,nonzero:!0}:{mantissa:0,exponent:0,nonzero:!1}}function Or(e){return!e?.nonzero||e.exponent<-126?0:e.exponent>127?wn:br((e.exponent+127<<23|yr(e.mantissa)&8388607)>>>0)}function kr(e,t){if(t===0||!Number.isFinite(t))return e;let n=xr(t);return n?(n.nonzero=!0,yr(t)&2147483648?{positive:e.positive,negative:Tr(e.negative,n)}:{positive:Tr(e.positive,n),negative:e.negative}):e}function Ar(e){let t=Er(e.positive,e.negative);if(t===0)return 0;let n=t>0,r=Or(Dr(n?e.positive:e.negative,n?e.negative:e.positive));return n?r:-r}function jr(e,t){if(!e?.nonzero||!t?.nonzero)return{mantissa:0,exponent:0,nonzero:!1};let n=Math.fround(e.mantissa*t.mantissa),r=e.exponent+t.exponent;return n>=2&&(n=Math.fround(n*.5),r+=1),{mantissa:n,exponent:r,nonzero:!0}}function Mr(e,t){if(!e?.nonzero||!t?.nonzero)return 0;let n=Math.fround(e.mantissa/t.mantissa),r=e.exponent-t.exponent;return n<1?(n=Math.fround(n*2),--r):n>=2&&(n=Math.fround(n*.5),r+=1),r<-126?0:r>127?wn:br((r+127<<23|yr(n)&8388607)>>>0)}function Nr(e,t,n){if(!(n>0)||!Number.isFinite(t))return e;let r=xr(n);if(!r)return e;r.nonzero=!0;let i=Tr(e.weight,r),a=xr(Fr(t,0,wn));return a?(a.nonzero=!0,{weight:i,weightedTemperature:Tr(e.weightedTemperature,jr(r,a))}):{weight:i,weightedTemperature:e.weightedTemperature}}function Pr(e){return Mr(e.weightedTemperature,e.weight)}function Fr(e,t,n){return Math.min(n,Math.max(t,e))}function Ir(e,{noFullReadback:t=!1}={}){let n=String(e||``).trim().toLowerCase();return n===ir||n===`webgpu-atomic-compact`||n===`compact`?ir:n===rr||n===`webgpu-fixed-cell-slots`||n===`fixed`?rr:t?ir:rr}function Lr(e){return+(e===ir)}function Rr({requiredVertexRows:e=0,requestedMaxVertexRows:t=null,emissionMode:n=rr,compactByteBudget:r=Cn}={}){let i=Math.max(0,Math.round(Q(e,0))),a=t!=null&&t!==``&&Number.isFinite(Number(t))?Math.max(0,Math.round(Number(t))):null;if(n!==ir)return Math.max(i,a??i);let o=_n*Float32Array.BYTES_PER_ELEMENT,s=Math.max(0,Math.floor(Math.max(o,Q(r,Cn))/o)),c=Math.min(i,a??s);return i>0?Math.max(3,c-c%3):0}function zr(e){return ar[Math.round(Q(e,0))]||`unknown`}function Br(e,t){return e===`h2o`&&t===`solid`?`ice`:e===`h2o`&&t===`gas`?`steam`:e||`unknown`}function Vr(e){let t=Math.round(Q(e,0));return t===1?`base`:t===2?`drop`:null}function Hr({material:e,phase:t,renderDomainId:n}){let r=Math.max(0,Math.round(Q(n,0)));return r<=0?null:`render-domain:${r}|material:${e||`unknown`}|phase:${t||`unknown`}`}function Ur(e){let t=String(e||``).trim();return t?/^[A-Z][a-z]?$/.test(t)?t:t.toLowerCase():`unknown`}function Wr(e={},t=null){let n=new Map;for(let t of Object.keys(e||{}))n.set(se(t),Ur(t));for(let e of t?.metadata||[]){e.product&&n.set(e.productMaterialId,e.product),e.a&&n.set(e.aMaterialId,e.a),e.b&&n.set(e.bMaterialId,e.b);for(let t of e.productTerms||[])t.material&&Number.isFinite(t.materialId)&&n.set(t.materialId,t.material);for(let t of e.reactantTerms||[])t.material&&Number.isFinite(t.materialId)&&n.set(t.materialId,t.material)}for(let e of t?.productTermMetadata||[])e.material&&Number.isFinite(e.materialId)&&n.set(e.materialId,e.material);for(let e of t?.reactantTermMetadata||[])e.material&&Number.isFinite(e.materialId)&&n.set(e.materialId,e.material);return n}function Gr({material:e,phase:t,temperatureK:n,materialProperties:r}){let i=xe(n);if(i.visible)return[...i.srgb];let a=V({material:e,phase:t,properties:r?.[e]??r?.[String(e).toLowerCase()]??r?.[String(e).toUpperCase()]??null});return a.baseColorSrgb??a.pbr?.baseColorSrgb??[1,1,1]}function Kr(e=[]){let t={};for(let n of e||[]){let e=xe(n.temperatureK);if(!e.visible)continue;let r=.2126*e.srgb[0]+.7152*e.srgb[1]+.0722*e.srgb[2],i=[n.material,n.renderKey,Hr(n)].filter(Boolean);for(let e of i){let i=t[e]||(t[e]={t:0,w:0});i.t+=(Number(n.temperatureK)||0)*r,i.w+=r}}let n={};for(let[e,r]of Object.entries(t))n[e]=r.w>0?r.t/r.w:null;return n}function qr(e=[]){let t={};for(let n of e||[]){let e=xe(n.temperatureK);if(!e.visible)continue;let r=.2126*e.srgb[0]+.7152*e.srgb[1]+.0722*e.srgb[2],i=[n.material,n.renderKey,Hr(n)].filter(Boolean);for(let n of i){let i=t[n]||(t[n]={r:0,g:0,b:0,w:0});i.r+=e.srgb[0]*r,i.g+=e.srgb[1]*r,i.b+=e.srgb[2]*r,i.w+=r}}let n={};for(let[e,r]of Object.entries(t))n[e]=r.w>0?[r.r/r.w,r.g/r.w,r.b/r.w]:null;return n}function Jr(e,{materialProperties:t={},reactionTable:n=null,materialMap:r=Wr(t,n)}={}){if(!(e instanceof Float32Array))throw TypeError(`decodeSphRenderRows requires Float32Array render rows`);if(e.length%ln!==0)throw RangeError(`SPH render rows length must align to the render row stride`);let i=e.length/ln,a=new Float32Array(i*3),o=new Float32Array(i*3),s=new Float32Array(i),c=new Float32Array(i),l=Array(i),d=[];for(let n=0;n<i;n+=1){let i=n*ln,u=e[i+4],f=e[i+5],p=r.get(u)||`unknown`,m=zr(f),h=Br(p,m),g=e[i+6],_=Math.max(0,Math.round(Q(e[i+11],0))),v=Q(e[i+12],0),y=Q(e[i+13],0),b=Q(e[i+14],1),x=Q(e[i+15],0),S=Vr(_),C=Gr({material:p,phase:m,temperatureK:g,materialProperties:t});a.set([e[i],e[i+1],e[i+2]],n*3),o.set(C,n*3),s[n]=v,c[n]=y;let w={material:p,phase:m,renderKey:h};_>0&&(w.renderDomainId=_,w.renderDomainKey=S),l[n]=w,d.push({index:n,positionM:[e[i],e[i+1],e[i+2]],massKg:e[i+3],materialId:u,material:p,phaseId:f,phase:m,temperatureK:g,status:e[i+7],restDensityKgPerM3:e[i+8],phaseFractionGas:e[i+9],representedEntityCount:e[i+10],renderDomainId:_,renderDomainKey:S,currentVolumeM3:v,particleRadiusM:y,volumeRatioJ:b,pressurePa:x,renderKey:h})}return{schema:u,status:`render-rows-decoded`,particleCount:i,positionsM:a,colorsRgb:o,currentVolumesM3:s,particleRadiiM:c,materials:l,rows:d,emissiveByMaterial:qr(d),emissiveTemperatureByMaterial:Kr(d),scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Yr(e,{renderDomainBaseCount:t=0,renderDomainDropCount:n=0,particleIdentity:r=null}={}){let i=r instanceof Uint32Array?r[e*G]:0;if(i>0)return i;let a=Math.max(0,Math.round(Q(t,0))),o=Math.max(0,Math.round(Q(n,0)));return a>0&&e<a?1:o>0&&e>=a&&e<a+o?2:0}function Xr(e,t){let n=Q(e,0),r=Q(t,0);return n>0&&r>0?n/r:0}function Zr(e){let t=Q(e,0);return t>0?Math.cbrt(3*t/(4*Math.PI)):0}function Qr(e){let t=Q(e,0);return t>0?4*Math.PI*t**3/3:0}function $r({particleCount:e,rowProducer:t,maxSupportRadiusM:n=0,maxGasRadiusM:r=0}){return{schema:Jn,status:`particle-scale-bounded`,rowProducer:t,particleCount:e,maxRadiusGrowthRatioAllowed:4,maxVolumeRatioJAllowed:64,maxSupportRadiusSmoothingRatioAllowed:Gn,maxSupportRadiusM:Math.max(0,Q(n,0)),maxGasRadiusSmoothingRatioAllowed:Kn,maxGasParticleRadiusM:Math.max(0,Q(r,0)),supportRadiusPolicyAppliedInShader:!1,capAppliedCount:0,maxRawParticleRadiusM:0,maxParticleRadiusM:0,maxRawRadiusGrowthRatio:0,maxEffectiveRadiusGrowthRatio:0,maxRawVolumeRatioJ:0,maxEffectiveVolumeRatioJ:0,sampleCappedRows:[],scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function ei(e,t,{index:n,materialId:r,phaseId:i,maxSampleRows:a=8}={}){!e||!t||(e.maxRawParticleRadiusM=Math.max(e.maxRawParticleRadiusM,Q(t.rawParticleRadiusM,0)),e.maxParticleRadiusM=Math.max(e.maxParticleRadiusM,Q(t.particleRadiusM,0)),e.maxRawRadiusGrowthRatio=Math.max(e.maxRawRadiusGrowthRatio,Q(t.rawRadiusGrowthRatio,0)),e.maxEffectiveRadiusGrowthRatio=Math.max(e.maxEffectiveRadiusGrowthRatio,Q(t.effectiveRadiusGrowthRatio,0)),e.maxRawVolumeRatioJ=Math.max(e.maxRawVolumeRatioJ,Q(t.rawVolumeRatioJ,0)),e.maxEffectiveVolumeRatioJ=Math.max(e.maxEffectiveVolumeRatioJ,Q(t.volumeRatioJ,0)),t.radiusCapApplied&&(e.capAppliedCount+=1,e.status=`particle-scale-cap-applied`,!(e.sampleCappedRows.length>=a)&&e.sampleCappedRows.push({index:n,materialId:r,phaseId:i,reason:t.radiusCapReason,restVolumeM3:t.restVolumeM3,rawCurrentVolumeM3:t.rawCurrentVolumeM3,currentVolumeM3:t.currentVolumeM3,restParticleRadiusM:t.restParticleRadiusM,rawParticleRadiusM:t.rawParticleRadiusM,particleRadiusM:t.particleRadiusM,rawVolumeRatioJ:t.rawVolumeRatioJ,volumeRatioJ:t.volumeRatioJ,rawRadiusGrowthRatio:t.rawRadiusGrowthRatio,effectiveRadiusGrowthRatio:t.effectiveRadiusGrowthRatio})))}function ti({particleCount:e,rowProducer:t,maxSupportRadiusM:n=0,maxGasRadiusM:r=0}){return{schema:Jn,status:`gpu-row-cap-policy-applied-in-shader`,rowProducer:t,particleCount:e,maxRadiusGrowthRatioAllowed:4,maxVolumeRatioJAllowed:64,maxSupportRadiusSmoothingRatioAllowed:Gn,maxSupportRadiusM:Math.max(0,Q(n,0)),maxGasRadiusSmoothingRatioAllowed:Kn,maxGasParticleRadiusM:Math.max(0,Q(r,0)),supportRadiusPolicyAppliedInShader:!0,capAppliedCount:null,capAppliedCountKnown:!1,reason:`WebGPU retained render rows apply radius growth, J, support-radius, and gas visual-radius caps in shader without a CPU particle scan`,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function ni({sphParticleState:e,mlsMpmParticleState:t=null,particleIndex:n,massKg:r,restDensityKgPerM3:i,visualParticleRadiusM:a=0,phaseId:o=I.unknown,maxSupportRadiusM:s=0,maxGasRadiusM:c=0}={}){let l=Xr(r,i),u=Qr(a),d=u>0?u:l,f=1,p=0,m=t?.mechanics;if(m instanceof Float32Array&&n>=0&&n<Q(e?.particleCount,0)){let e=n*B;if(e+28<m.length){let t=Q(m[e+18],1),n=Q(m[e+19],0),r=Q(m[e+28],0);f=t>0?t:1,n>0&&!(u>0)&&(d=n),p=Math.max(r,0)}}let h=Math.max(f,1e-9),g=Math.max(d*h,0),_=Zr(d),v=Zr(g),y=_>0&&v>0?v/_:0,b=g,x=v,S=h,C=y,w=!1,T=null,E=_*4;_>0&&v>E&&(w=!0,T=`max-radius-growth-ratio`,x=E,b=d*64,S=64,C=4);let D=Q(s,0);D>0&&x>D&&(w=!0,T=T?`${T}+max-support-radius`:`max-support-radius`,x=D,b=Qr(D),S=d>0?Math.max(b/d,1e-9):S,C=_>0?x/_:0);let O=Q(c,0);return Math.round(Q(o,I.unknown))===I.gas&&O>0&&x>O&&(w=!0,T=T?`${T}+gas-phase-visual-radius-proxy`:`gas-phase-visual-radius-proxy`,x=O,b=Qr(O),S=d>0?Math.max(b/d,1e-9):S,C=_>0?x/_:0),{currentVolumeM3:b,particleRadiusM:x,volumeRatioJ:S,pressurePa:p,restVolumeM3:d,rawCurrentVolumeM3:g,restParticleRadiusM:_,rawParticleRadiusM:v,rawVolumeRatioJ:h,rawRadiusGrowthRatio:y,effectiveRadiusGrowthRatio:C,radiusCapApplied:w,radiusCapReason:T}}function ri({sphParticleState:e,mlsMpmParticleState:t=null,renderDomainBaseCount:n=0,renderDomainDropCount:r=0}={}){cr(e);let i=new Float32Array(e.particleCount*ln),a=Q(e.smoothingLengthM,0)*Gn,o=Q(e.smoothingLengthM,0)*Kn,s=$r({particleCount:e.particleCount,rowProducer:`cpu-reference`,maxSupportRadiusM:a,maxGasRadiusM:o});for(let c=0;c<e.particleCount;c+=1){let l=c*L,u=c*z,d=c*ln,f=e.state[l+3],p=e.thermo[u],m=e.thermo[u+1],h=e.thermo[u+3],g=e.thermo[u+11],_=ni({sphParticleState:e,mlsMpmParticleState:t,particleIndex:c,massKg:f,restDensityKgPerM3:h,visualParticleRadiusM:g,phaseId:m,maxSupportRadiusM:a,maxGasRadiusM:o});ei(s,_,{index:c,materialId:p,phaseId:m}),i.set([e.state[l],e.state[l+1],e.state[l+2],f,p,m,e.thermo[u+2],e.thermo[u+10],h,e.thermo[u+6],e.thermo[u+9],Yr(c,{renderDomainBaseCount:n,renderDomainDropCount:r,particleIdentity:e.identity}),_.currentVolumeM3,_.particleRadiusM,_.volumeRatioJ,_.pressurePa,e.thermo[u+4],0,0,0],d)}return{schema:u,backend:`cpu-reference`,status:`render-rows-extracted`,kernelScope:Xn,particleCount:e.particleCount,rowLayout:[...O],rowStrideFloats:ln,renderRows:i,renderRowByteLength:i.byteLength,particleScaleStability:s,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function ii(e,t,n,r=0){let i=Math.max(4,n.byteLength);li(e,t,i),ui(e,t,i);let a=e.createBuffer({label:t,size:i,usage:Z.STORAGE|Z.COPY_DST|r});try{n.byteLength>0&&e.queue.writeBuffer(a,0,n)}catch(e){throw a.destroy?.(),e}return a}function ai(e,t,n,r=0){let i=Math.max(4,n);return li(e,t,i),ui(e,t,i),e.createBuffer({label:t,size:i,usage:Z.STORAGE|Z.COPY_DST|r})}function oi(e){let t=Number(e?.limits?.maxBufferSize);return Number.isFinite(t)&&t>0?t:null}function si(e){let t=Number(e?.limits?.maxStorageBufferBindingSize);return Number.isFinite(t)&&t>0?t:null}function ci(e){let t=Number(e?.limits?.maxComputeWorkgroupsPerDimension);return Number.isSafeInteger(t)&&t>0?t:null}function li(e,t,n){if(!Number.isSafeInteger(n)||n<=0)throw RangeError(`${t} byte length must be a positive safe integer`);let r=oi(e);if(r!=null&&!(n<=r))throw RangeError(`${t} byte length ${n} exceeds WebGPU device maxBufferSize ${r}`)}function ui(e,t,n){if(!Number.isSafeInteger(n)||n<=0)throw RangeError(`${t} storage binding byte length must be a positive safe integer`);let r=si(e);if(r!=null&&!(n<=r))throw RangeError(`${t} byte length ${n} exceeds WebGPU device maxStorageBufferBindingSize ${r}`)}function di(e,t,...n){for(let[e,r]of n.entries())if(!(Number.isSafeInteger(r)&&r>=0))throw RangeError(`${t} workgroup dimension ${e} must be a non-negative safe integer`);let r=ci(e);if(r!=null){for(let[e,i]of n.entries())if(!(i<=r))throw RangeError(`${t} workgroup dimension ${e} (${i}) exceeds WebGPU device maxComputeWorkgroupsPerDimension ${r}`)}}function fi(e,t){if(!Number.isSafeInteger(e)||e<0)throw RangeError(`${t} required byte length must be a non-negative safe integer`);return Math.max(4,e)}function pi(e,t){let n=Number(e);if(!Number.isSafeInteger(n)||n<0)throw RangeError(`${t} must be a non-negative safe integer byte length`);return n}function mi(e,t,n,r,{offset:i=0}={}){if(!n)return null;let a=fi(r,t),o=Number(n.size);if(!Number.isSafeInteger(i)||i<0||i%Uint32Array.BYTES_PER_ELEMENT!==0)throw RangeError(`${t} binding offset must be a non-negative four-byte-aligned safe integer`);let s=Number(e?.limits?.minStorageBufferOffsetAlignment);if(i>0&&Number.isSafeInteger(s)&&s>0&&i%s!==0)throw RangeError(`${t} binding offset ${i} is not aligned to WebGPU device minStorageBufferOffsetAlignment ${s}`);if(!Number.isSafeInteger(o)||o<0)throw RangeError(`${t} must expose its exact GPU buffer size`);let c=i+a;if(!Number.isSafeInteger(c)||o<c)throw RangeError(`${t} capacity ${o} is smaller than required binding range ${c}`);return ui(e,t,a),a}function hi(e,t,{offset:n=0,label:r=`WebGPU storage buffer`}={}){let i=fi(t,r);return n>0?{buffer:e,offset:n,size:i}:{buffer:e,size:i}}function gi(e=null){return Math.max(0,Math.round(Q(e?.totalFieldCells,0)))*3*yn*Float32Array.BYTES_PER_ELEMENT}function _i({device:e,candidateRowsByteLength:t,candidateReadbackByteBudget:n=xn}={}){let r=Math.max(4,Math.round(Q(t,0))),i=Math.max(0,Math.round(Q(n,xn)));if(i>0&&r>i)return{status:`candidate-readback-budget-exceeded`,reason:`material-interface candidate rows byte length ${r} exceeds readback budget ${i}`,byteLength:r,budget:i};let a=oi(e);if(a!=null&&r>a)return{status:`candidate-readback-max-buffer-size-exceeded`,reason:`material-interface candidate rows byte length ${r} exceeds WebGPU device maxBufferSize ${a}`,byteLength:r,maxBufferSize:a};let o=si(e);return o!=null&&r>o?{status:`candidate-readback-max-storage-binding-size-exceeded`,reason:`material-interface candidate rows byte length ${r} exceeds WebGPU device maxStorageBufferBindingSize ${o}`,byteLength:r,maxStorageBufferBindingSize:o}:null}function vi({sourceField:e,sourceRenderField:t,resolvedFieldRowsBuffer:n,resolvedSurfaceBuffer:r,source:i,sourceCadence:a,candidateRowsByteLength:o,candidateReadbackByteBudget:s,candidateReadbackBlocker:c,candidateReadbackMode:l,compactCandidateField:u=null}){let d={schema:_,status:`material-interface-field-candidate-readback-skipped`,reason:c.reason,backend:`webgpu-candidate-readback-skipped`,authority:`resident-physics-material-interface-extractor`,source:i,sourceCadence:a,sourceFieldSchema:e?.schema??null,sourceFieldStatus:e?.status??null,sourceFieldBackend:e?.backend??null,sourceFieldPipelineCacheStatus:e?.sourceRenderFieldPipelineCacheStatus??e?.pipelineCacheStatus??null,sourceRenderFieldSchema:t?.schema??null,sourceRenderFieldBackend:t?.backend??null,sourceRenderFieldPipelineCacheStatus:t?.pipelineCacheStatus??e?.sourceRenderFieldPipelineCacheStatus??null,sourceRenderFieldReadback:!!t?.renderFieldReadback,sourceFieldRowsBufferBound:!!n,sourceSurfaceBufferBound:!!r,surfaceCount:t?.surfaceCount??0,readySurfaceCount:0,totalSurfaceAreaM2:0,candidateCount:Math.max(0,Math.round(Q(t?.totalFieldCells,0)))*3,activeCandidateCount:0,candidateBackend:u?.backend??null,candidateReadback:!1,candidateReadbackMode:l,candidateRowsByteLength:o,candidateReadbackByteBudget:s,candidateReadbackBlockerStatus:c.status,candidateReadbackBlocker:c,candidateCompactStatus:u?.status??null,candidateCompactOverflowCount:u?.compactCandidateOverflowCount??0,candidateCompactCapacity:u?.compactCandidateCapacity??null,elementCount:0,elementLayout:[...v],elementStrideFloats:bn,elementRows:new Float32Array,elements:[],forceCouplingStatus:`blocked-material-interface-candidate-readback-skipped`,surfaces:[],queueCompletionStatus:`not-submitted-candidate-readback-skipped`,queueCompletionMethod:null,normalDerivation:`candidate-readback-skipped-budget-or-device-limit`,surfaceAreaDerivation:`candidate-readback-skipped-budget-or-device-limit`,physicsStage:`material-interface-extraction`,pressureInterfaceProducer:!1,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1};return u?.interfaceSourceKeyBuffer&&(d.interfaceSourceKeyBuffer=u.interfaceSourceKeyBuffer,d.interfaceSourceKeyBufferRetained=!!u.interfaceSourceKeyBufferRetained,d.interfaceSourceKeyBufferByteLength=u.interfaceSourceKeyBufferByteLength??0),typeof u?.destroyMaterialInterfaceCandidateFieldBuffers==`function`&&(d.destroyMaterialInterfaceFieldBuffers=({reason:e=`skipped-material-interface-field-buffer-cleanup`}={})=>u.destroyMaterialInterfaceCandidateFieldBuffers({reason:e})),d}function yi({sourceField:e,sourceRenderField:t,resolvedFieldRowsBuffer:n,resolvedSurfaceBuffer:r,source:i,sourceCadence:a,candidateRowsByteLength:o,candidateReadbackByteBudget:s,candidateReadbackMode:c,compactCandidateCapacity:l=null}){let u=t?.surfaceTable?.surfaceCount??t?.surfaceCount??0,d=Math.max(0,Math.round(Q(t?.totalFieldCells,0)))*3,f=ia({candidateCount:d,surfaceCount:u,compactCandidateCapacity:l}),p=f*yn*Float32Array.BYTES_PER_ELEMENT;return{schema:_,status:`material-interface-field-gpu-resident-summary-pending`,reason:`candidate rows remain GPU-resident; CPU material-interface elements require compact readback or a GPU pressure consumer`,backend:`webgpu-gpu-resident-summary`,authority:`resident-physics-material-interface-extractor`,source:i,sourceCadence:a,sourceFieldSchema:e?.schema??null,sourceFieldStatus:e?.status??null,sourceFieldBackend:e?.backend??null,sourceFieldPipelineCacheStatus:e?.sourceRenderFieldPipelineCacheStatus??e?.pipelineCacheStatus??null,sourceRenderFieldSchema:t?.schema??null,sourceRenderFieldBackend:t?.backend??null,sourceRenderFieldPipelineCacheStatus:t?.pipelineCacheStatus??e?.sourceRenderFieldPipelineCacheStatus??null,sourceRenderFieldReadback:!!t?.renderFieldReadback,sourceFieldRowsBufferBound:!!n,sourceSurfaceBufferBound:!!r,surfaceCount:u,readySurfaceCount:0,totalSurfaceAreaM2:0,candidateCount:d,activeCandidateCount:0,activeCandidateCountPending:!0,candidateBackend:`gpu-resident-summary`,candidateReadback:!1,candidateReadbackMode:c,candidateRowsByteLength:o,candidateDenseRowsByteLength:o,candidateCompactRowsByteLength:p,candidateCompactCapacity:f,candidateCompactOverflowCount:0,candidateCompactFallbackStatus:null,candidateMetadataReadback:!1,candidateReadbackByteBudget:s,candidatePipelineCacheStatus:null,elementCount:0,elementLayout:[...v],elementStrideFloats:bn,elementRows:new Float32Array,elements:[],forceCouplingStatus:`blocked-gpu-resident-pressure-interface-consumer-required`,surfaces:[],queueCompletionStatus:`not-submitted-gpu-resident-summary`,queueCompletionMethod:null,normalDerivation:`gpu-resident-candidate-summary-pending`,surfaceAreaDerivation:`gpu-resident-candidate-summary-pending`,physicsStage:`material-interface-extraction`,pressureInterfaceProducer:!1,gpuAuthoritativeState:!0,gpuResidentMaterialInterfaceSummary:!0,gpuResidentMaterialInterfaceSummaryPending:!0,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1}}function bi({particleCount:e,renderDomainBaseCount:t=0,renderDomainDropCount:n=0,hasMechanics:r=!1,maxSupportRadiusM:i=0,maxGasRadiusM:a=0,materialBankParticleSizeRowCount:o=0}={}){let s=new ArrayBuffer(qn),c=new DataView(s);return c.setUint32(0,e,!0),c.setUint32(4,Math.max(0,Math.round(Q(t,0))),!0),c.setUint32(8,Math.max(0,Math.round(Q(n,0))),!0),c.setUint32(12,+!!r,!0),c.setFloat32(16,Math.max(0,Q(i,0)),!0),c.setFloat32(20,Math.max(0,Q(a,0)),!0),c.setUint32(24,Math.max(0,Math.round(Q(o,0))),!0),s}function xi({rowCount:e=0,bufferSource:t=`none`}={}){let n=Math.max(0,Math.round(Q(e,0)));return{schema:Yn,status:n>0?`shader-bound-material-bank-particle-size-rows`:`no-material-bank-particle-size-rows`,rowCount:n,shaderBinding:5,bufferSource:n>0?t:`none`,consumer:`sph-render-rows-wgsl`,consumedAs:`non-authoritative-role-rest-volume-seed-before-mechanics`,strictSourceOfTruth:!1,mechanicsOverridePreserved:!0,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Si({particleCount:e,productEventCount:t=0,surfaceCount:n,totalFieldCells:r,fieldPadding:i,refEdgeM:a,renderSmearDtS:o=0,dispersedMediumOpticsEnabled:s=!1}){let c=new ArrayBuffer(32),l=new DataView(c);return l.setUint32(0,e,!0),l.setUint32(4,n,!0),l.setUint32(8,r,!0),l.setUint32(12,t,!0),l.setFloat32(16,i,!0),l.setFloat32(20,a,!0),l.setFloat32(24,Math.max(0,Number(o)||0),!0),l.setUint32(28,+!!s,!0),c}function Ci(e=null){let t=new Uint32Array(8);return e?(t[0]=1,t[1]=e.expectedMagic,t[2]=e.expectedVersion,t[3]=e.expectedReadyStatus,t[4]=e.expectedGeneration,t[5]=e.expectedSeal,t[6]=e.expectedRowCapacity,t[7]=e.expectedRowStrideVec4,t):t}function wi({surfaceCount:e,totalFieldCells:t,candidateCount:n,fieldPadding:r,refEdgeM:i,isolationScale:a,sourceKeyEnabled:o=!1}){let s=new ArrayBuffer(32),c=new DataView(s);return c.setUint32(0,e,!0),c.setUint32(4,t,!0),c.setUint32(8,n,!0),c.setUint32(12,+!!o,!0),c.setFloat32(16,r,!0),c.setFloat32(20,i,!0),c.setFloat32(24,a,!0),c.setFloat32(28,0,!0),s}function Ti({surfaceCount:e,totalFieldCells:t,maxVertexRows:n,emissionModeId:r=0,fieldPadding:i,refEdgeM:a,isolationScale:o}){let s=new ArrayBuffer(32),c=new DataView(s);return c.setUint32(0,e,!0),c.setUint32(4,n,!0),c.setUint32(8,t,!0),c.setUint32(12,r,!0),c.setFloat32(16,i,!0),c.setFloat32(20,a,!0),c.setFloat32(24,o,!0),c.setFloat32(28,0,!0),s}function Ei({surfaceCount:e,totalFieldCells:t,fieldPadding:n,refEdgeM:r,isolationScale:i}){let a=new ArrayBuffer(32),o=new DataView(a);return o.setUint32(0,e,!0),o.setUint32(4,t,!0),o.setUint32(8,0,!0),o.setUint32(12,0,!0),o.setFloat32(16,n,!0),o.setFloat32(20,r,!0),o.setFloat32(24,i,!0),o.setFloat32(28,0,!0),a}function Di({surfaceCount:e,sourceVertexRowCount:t,maxCompactVertexRows:n,sourceVertexCounterMode:r=0}){let i=new ArrayBuffer(16),a=new DataView(i);return a.setUint32(0,e,!0),a.setUint32(4,t,!0),a.setUint32(8,n,!0),a.setUint32(12,r,!0),i}async function Oi(e,t,n,r=`ulg-sph-render-readback`){li(e,r,Math.max(4,n));let i=e.createBuffer({label:r,size:Math.max(4,n),usage:Z.MAP_READ|Z.COPY_DST}),a=!1;try{let r=e.createCommandEncoder();return r.copyBufferToBuffer(t,0,i,0,n),e.queue.submit([r.finish()]),await i.mapAsync(or.READ),a=!0,i.getMappedRange().slice(0)}finally{a&&i.unmap(),i.destroy?.()}}function ki(){return{min:[1/0,1/0,1/0],max:[-1/0,-1/0,-1/0]}}function Ai(e){return e&&e.min.every(Number.isFinite)&&e.max.every(Number.isFinite)?{min:[...e.min],max:[...e.max]}:null}function ji(e,t){for(let n=0;n<3;n+=1){let r=Q(t?.[n],NaN);Number.isFinite(r)&&(e.min[n]=Math.min(e.min[n],r),e.max[n]=Math.max(e.max[n],r))}}function Mi(e,t){return`${Math.round(Q(e,0))}:${Math.round(Q(t,0))}`}function Ni({state:e,thermo:t,particleCount:n,maxSampleRows:r=8}={}){let i=ki(),a={},o=[],s=0,c=0,l=0,u=0,d=1/0,f=-1/0;for(let p=0;p<n;p+=1){let n=p*L,m=p*z,h=[Q(e?.[n],NaN),Q(e?.[n+1],NaN),Q(e?.[n+2],NaN)],g=Q(e?.[n+3],0),_=Q(t?.[m],0),v=Q(t?.[m+1],0),y=Q(t?.[m+2],NaN),b=Q(t?.[m+10],0);h.every(Number.isFinite)&&(s+=1,ji(i,h),h.every(e=>Math.abs(e)<=1e-12)&&(c+=1)),g>0&&(l+=1,u+=g),Number.isFinite(y)&&(d=Math.min(d,y),f=Math.max(f,y));let x=Mi(_,v);a[x]=(a[x]||0)+1,o.length<r&&o.push({index:p,positionM:h,massKg:g,materialId:_,phaseId:v,temperatureK:Number.isFinite(y)?y:null,status:b})}return{particleCount:n,finitePositionCount:s,zeroPositionCount:c,positiveMassCount:l,totalMassKg:u,boundsM:Ai(i),minTemperatureK:Number.isFinite(d)?d:null,maxTemperatureK:Number.isFinite(f)?f:null,materialPhaseCounts:a,sampleRows:o}}function Pi(e,{maxSampleRows:t=8}={}){let n=e instanceof Float32Array?Math.floor(e.length/ln):0,r=ki(),i={},a=[],o=0,s=0,c=0,l=0,u=1/0,d=-1/0,f=1/0,p=-1/0;for(let m=0;m<n;m+=1){let n=m*ln,h=[Q(e[n],NaN),Q(e[n+1],NaN),Q(e[n+2],NaN)],g=Q(e[n+3],0),_=Q(e[n+4],0),v=Q(e[n+5],0),y=Q(e[n+6],NaN),b=Q(e[n+7],0),x=Q(e[n+13],NaN);h.every(Number.isFinite)&&(o+=1,ji(r,h),h.every(e=>Math.abs(e)<=1e-12)&&(s+=1)),g>0&&(c+=1,l+=g),Number.isFinite(y)&&(u=Math.min(u,y),d=Math.max(d,y)),Number.isFinite(x)&&x>0&&(f=Math.min(f,x),p=Math.max(p,x));let S=Mi(_,v);i[S]=(i[S]||0)+1,a.length<t&&a.push({index:m,positionM:h,massKg:g,materialId:_,phaseId:v,temperatureK:Number.isFinite(y)?y:null,status:b,particleRadiusM:Number.isFinite(x)?x:null})}return{particleCount:n,finitePositionCount:o,zeroPositionCount:s,positiveMassCount:c,totalMassKg:l,boundsM:Ai(r),minTemperatureK:Number.isFinite(u)?u:null,maxTemperatureK:Number.isFinite(d)?d:null,minParticleRadiusM:Number.isFinite(f)?f:null,maxParticleRadiusM:Number.isFinite(p)?p:null,materialPhaseCounts:i,sampleRows:a}}async function Fi({device:e,sphParticleState:t,sphParticleUpload:n=null,sourceStateBuffer:r=null,sourceThermoBuffer:i=null,renderDomainBaseCount:a=0,renderDomainDropCount:o=0,includeRenderRows:s=!0,maxSampleRows:c=8}={}){if(cr(t),!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`summarizeSphResidentParticleUploadWebGpu requires a WebGPU-like device`);let l=r||n?.stateBuffer||null,u=i||n?.thermoBuffer||null;if(!l||!u)return{schema:`peercompute.ulg.sph-resident-particle-upload-debug.v0`,status:`resident-particle-upload-debug-source-unavailable`,reason:`retained state and thermo buffers are required`,particleCount:t.particleCount,uploadStatus:n?.status??null,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};let d=Math.max(0,Math.round(Q(t.particleCount,0))),f=d*L*Float32Array.BYTES_PER_ELEMENT,p=d*z*Float32Array.BYTES_PER_ELEMENT,[m,h]=await Promise.all([Oi(e,l,f,`ulg-sph-resident-debug-state-readback`),Oi(e,u,p,`ulg-sph-resident-debug-thermo-readback`)]),g=Ni({state:new Float32Array(m).slice(0,d*L),thermo:new Float32Array(h).slice(0,d*z),particleCount:d,maxSampleRows:c}),_=null,v=null;if(s)try{_=Pi((await Ta({device:e,sphParticleState:t,sphParticleUpload:n,sourceStateBuffer:l,sourceThermoBuffer:u,readbackMode:Qn,renderDomainBaseCount:a,renderDomainDropCount:o})).renderRows,{maxSampleRows:c})}catch(e){v=e instanceof Error?e.message:String(e)}return{schema:`peercompute.ulg.sph-resident-particle-upload-debug.v0`,status:v?`resident-particle-upload-debug-render-rows-error`:`resident-particle-upload-debug-ready`,uploadStatus:n?.status??null,sourceStep:n?.step??t.step??null,sourceTime:n?.time??t.time??null,particleCount:d,readbackByteLength:f+p,stateBufferLabel:l?.label??null,thermoBufferLabel:u?.label??null,particleRows:g,renderRows:_,renderRowsError:v,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Ii(t=[],{defaultResolution:n=32,defaultIsolation:r=80,defaultSubtract:i=24}={}){if(!Array.isArray(t))throw TypeError(`surfaceDescriptors must be an array`);let a=new Float32Array(t.length*un),o=[],s=0,c=0;return t.forEach((e,t)=>{let l=mr(Math.max(4,Math.round(Q(e.resolution,n))),`surfaceDescriptors[${t}].resolution`,{min:4}),u=mr(l**3,`surfaceDescriptors[${t}].fieldCellCount`,{min:1});s=mr(s,`surfaceDescriptors[${t}].fieldOffset`);let d=Q(e.isolation,r),f=Math.max(1e-12,Q(e.subtract,i)),p=Fr(Q(e.radiusNorm,.05),.001,.5),m=Number.isFinite(e.strength)?e.strength:(d+f)*p*p,h=Array.isArray(e.colorLinear)||ArrayBuffer.isView(e.colorLinear)?e.colorLinear:[1,1,1],g=pr(e.materialId??(e.material?se(e.material):0),`surfaceDescriptors[${t}].materialId`),_=pr(e.phaseId??(e.phase?H(e.phase):I.unknown),`surfaceDescriptors[${t}].phaseId`),v=pr(e.renderDomainId??0,`surfaceDescriptors[${t}].renderDomainId`),y=e.opticalState||null,b=pr(e.opticalStateId??W(y),`surfaceDescriptors[${t}].opticalStateId`),x=b>0;if((e.collectiveOpticalRoute===!0||e.collectiveOpticalRouteSchema)&&!x)throw RangeError(`surfaceDescriptors[${t}] collective optical route requires a positive opticalStateId`);for(let[n,r]of[[`collectiveOpticalRouteId`,e.collectiveOpticalRouteId],[`routeId`,e.routeId]])if(r!=null&&Number(r)!==b)throw RangeError(`surfaceDescriptors[${t}].${n} contradicts opticalStateId`);let S=e.opticalStateKey??ae(y),C=t*un;a.set([g,_,s,u,l,d,f,m,Math.max(0,Q(e.particleRadiusScale,0))>0?-Math.max(0,Q(e.particleRadiusScale,0)):p,Fr(Q(h[0],1),0,1),Fr(Q(h[1],1),0,1),Fr(Q(h[2],1),0,1),v,b,Number.isFinite(Number(e.transparencyClassId))?Number(e.transparencyClassId):-1,Number.isFinite(Number(e.depthWriteFlag))?Number(e.depthWriteFlag):-1],C);let w=a.subarray(C,C+un),T=w[8]<0?-w[8]:0,E=da({...e,index:t,phaseId:_}),D={index:t,surfaceKey:e.surfaceKey??`${g}|${_}`,material:e.material??null,phase:e.phase??null,renderKey:e.renderKey??e.material??null,opticalState:y?{...y}:null,opticalStateKey:S,opticalStateId:w[13],surfaceIdentityKey:e.surfaceIdentityKey??(x?e.surfaceKey??null:null),collectiveOpticalRoute:x,collectiveOpticalRouteSchema:x?e.collectiveOpticalRouteSchema??e.schema??null:null,collectiveOpticalRouteKey:e.collectiveOpticalRouteKey??e.routeKey??e.surfaceIdentityKey??(x?e.surfaceKey:null)??null,collectiveOpticalRouteId:x?w[13]:null,opticalResponseAuthorityFlag:+(Q(e.opticalResponseAuthorityFlag,0)>0),opticalResponseAuthority:e.opticalResponseAuthority??null,opticalResponseReady:e.opticalResponseReady===!0,opticalVisibilityFlag:+(Q(e.opticalVisibilityFlag,1)>0),opticalVisibilityReason:e.opticalVisibilityReason??null,opticalOpacity:e.opticalOpacity!=null&&Number.isFinite(Number(e.opticalOpacity))?Fr(Number(e.opticalOpacity),0,1):null,opticalEffectiveOpacity:e.opticalEffectiveOpacity!=null&&Number.isFinite(Number(e.opticalEffectiveOpacity))?Fr(Number(e.opticalEffectiveOpacity),0,1):null,opticalDepth:e.opticalDepth!=null&&Number.isFinite(Number(e.opticalDepth))?Math.max(0,Number(e.opticalDepth)):null,opticalScatteringCoefficientPerM:e.opticalScatteringCoefficientPerM!=null&&Number.isFinite(Number(e.opticalScatteringCoefficientPerM))?Math.max(0,Number(e.opticalScatteringCoefficientPerM)):null,opticalTransmission:e.opticalTransmission!=null&&Number.isFinite(Number(e.opticalTransmission))?Fr(Number(e.opticalTransmission),0,1):null,opticalRoughness:e.opticalRoughness!=null&&Number.isFinite(Number(e.opticalRoughness))?Fr(Number(e.opticalRoughness),0,1):null,opticalBlockedFlag:+(Q(e.opticalBlockedFlag,0)>0),opticalProvenanceSource:e.opticalProvenanceSource??null,renderDomainId:w[12],renderDomainKey:e.renderDomainKey??Vr(e.renderDomainId),renderLayer:e.renderLayer??E.renderLayer,renderOrder:E.renderOrder,transparencyClassId:E.transparencyClassId,depthWriteFlag:E.depthWriteFlag,emissiveTemperatureK:Math.max(0,Q(e.emissiveTemperatureK,0)),materialId:w[0],phaseId:w[1],fieldOffset:w[2],fieldCellCount:w[3],resolution:w[4],isolation:w[5],subtract:w[6],strength:w[7],radiusNorm:p,particleRadiusScale:T,particleRadiusPolicyStatus:e.particleRadiusPolicyStatus??null,particleRadiusPolicyMode:e.particleRadiusPolicyMode??null,particleRadiusContinuityFloorEligible:e.particleRadiusContinuityFloorEligible===!0,particleRadiusContinuityFloorApplied:e.particleRadiusContinuityFloorApplied===!0,particleRadiusScaleRequested:e.particleRadiusScaleRequested??null,particleRadiusContinuityFloorScale:e.particleRadiusContinuityFloorScale??null,particleRadiusContinuityFloorScaleUnbounded:e.particleRadiusContinuityFloorScaleUnbounded??null,particleRadiusContinuityRepresentativeRadiusM:e.particleRadiusContinuityRepresentativeRadiusM??null,particleRadiusContinuitySmoothingLengthM:e.particleRadiusContinuitySmoothingLengthM??null,particleRadiusContinuitySupportMultiplier:e.particleRadiusContinuitySupportMultiplier??null,particleRadiusContinuitySupportTargetIsoradiusM:e.particleRadiusContinuitySupportTargetIsoradiusM??null,particleRadiusContinuitySamplingCellSizeM:e.particleRadiusContinuitySamplingCellSizeM??null,particleRadiusContinuitySamplingMarginM:e.particleRadiusContinuitySamplingMarginM??null,particleRadiusContinuityTargetIsoradiusM:e.particleRadiusContinuityTargetIsoradiusM??null,particleRadiusFloorNorm:T>0?Math.sqrt(.75/(l*l)+1e-6):0,colorLinear:[w[9],w[10],w[11]],status:Q(e.status,1)};o.push(D),s=mr(s+u,`surfaceDescriptors[${t}].nextFieldOffset`),c=Math.max(c,u)}),{schema:e,status:`render-field-surface-table-built`,surfaceCount:t.length,rowLayout:[...p],rowStrideFloats:un,records:a,metadata:o,totalFieldCells:s,maxFieldCellCount:c,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Li(e){if(e?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`||!(e.records instanceof Float32Array)||!Array.isArray(e.metadata)||!Number.isSafeInteger(e.surfaceCount)||e.surfaceCount!==e.metadata.length||e.records.length!==e.surfaceCount*un)throw TypeError(`SPH render field requires a render-field surface table`);let t=0,n=0;for(let r=0;r<e.surfaceCount;r+=1){let i=e.metadata[r];if(hr(i?.index,`surfaceTable.metadata[${r}].index`)!==r)throw RangeError(`render surface metadata index ${i?.index} does not match array index ${r}`);let a=r*un,o=e.records.subarray(a,a+un);if(o.some(e=>!Number.isFinite(e)))throw RangeError(`render surface ${r} contains a non-finite encoded lane`);let s=mr(i?.resolution,`surfaceTable.metadata[${r}].resolution`,{min:4}),c=mr(i?.fieldCellCount,`surfaceTable.metadata[${r}].fieldCellCount`,{min:1}),l=mr(i?.fieldOffset,`surfaceTable.metadata[${r}].fieldOffset`);if(c!==s**3||l!==t)throw RangeError(`render surface ${r} has inconsistent field geometry`);let u=i.particleRadiusScale>0?-i.particleRadiusScale:i.radiusNorm;if([i.materialId,i.phaseId,l,c,s,i.isolation,i.subtract,i.strength,u,i.colorLinear?.[0],i.colorLinear?.[1],i.colorLinear?.[2],i.renderDomainId,i.opticalStateId].some((e,t)=>!Number.isFinite(Number(e))||!Object.is(o[t],Math.fround(Number(e)))))throw RangeError(`render surface ${r} metadata does not match its encoded routing/geometry lanes`);let d=o[14]>=0?o[14]:ua(o[1]),f=o[15]>=0?o[15]:d>0?0:1;if(Math.fround(Number(i.transparencyClassId))!==Math.fround(d)||Math.fround(Number(i.depthWriteFlag))!==Math.fround(f))throw RangeError(`render surface ${r} metadata does not match its encoded render policy`);t=mr(t+c,`surfaceTable.metadata[${r}].nextFieldOffset`),n=Math.max(n,c)}if(e.totalFieldCells!==t||e.maxFieldCellCount!==n)throw RangeError(`render surface table aggregate geometry is inconsistent`)}function Ri(e,t,n,r){let i=Math.fround(1-Math.fround(2*n)),a=Math.fround(.001),o=Math.fround(.999),s=t=>{let s=Math.fround(e[t]/r),c=Math.fround(s*i);return Fr(Math.fround(n+c),a,o)};return[s(t),s(t+1),s(t+2)]}function zi(e,t){return!(e>0)||e===t}function Bi(e,t){let n=Math.max(0,Math.round(Q(t,0)));return n<=0?!0:Math.round(Q(e,0))===n}function Vi(e,t){let n=e[t],r=e[t+1],i=e[t+2],a=e[t+3],o=e[t+4],c=e[t+5],l=e[t+6],u=e[t+7];return a===s.ready&&Number.isFinite(n)&&Number.isSafeInteger(n)&&n>=0&&n<=sr&&Number.isFinite(r)&&Number.isSafeInteger(r)&&r>=0&&r<=sr&&Number.isFinite(i)&&Number.isSafeInteger(i)&&i>0&&i<=sr&&Number.isFinite(o)&&o>=0&&Number.isFinite(c)&&c>=0&&Number.isFinite(l)&&l>=0&&Number.isFinite(u)&&Math.abs(u)<=c}function Hi(e,t){if(e==null)return null;if(!(e instanceof Float32Array))throw TypeError(`dispersed-medium optics rows must be a Float32Array`);let n=t*8;if(e.length!==n)throw RangeError(`dispersed-medium optics rows must contain exactly ${t} particle-aligned rows`);let r=new Set;for(let n=0;n<t;n+=1){let t=n*8;if(e[t+3]===s.blocked){for(let r=0;r<8;r+=1)if(r!==3&&e[t+r]!==0)throw RangeError(`dispersed-medium blocked row ${n} must have zero data lanes`);continue}if(!Vi(e,t))throw RangeError(`dispersed-medium row ${n} is neither canonical ready nor canonical blocked`);r.add(e[t+2])}return r}function Ui(e,t=[]){let n=new Map;for(let[t,r]of e.metadata.entries()){let e=pr(r.opticalStateId??0,`surfaceTable.metadata[${t}].opticalStateId`);if(e!==0){if(n.has(e))throw RangeError(`dispersed-medium opticalStateId ${e} routes to more than one render surface`);n.set(e,t)}}for(let r of t){if(!n.has(r)){let t=e.metadata.map(e=>`${e?.material??`?`}/${e?.phase??`?`}=${e?.opticalStateId??0}`).slice(0,12).join(`, `);throw RangeError(`ready dispersed-medium opticalStateId ${r} has no render surface route (routed: ${t})`)}let t=e.metadata[n.get(r)],i=Math.fround(Number(t?.isolation));if(!(i>=Tn)||!Number.isFinite(i))throw RangeError(`ready dispersed-medium opticalStateId ${r} requires a positive finite f32 isolation threshold outside the denormal range`)}return n}function Wi(e,t,n,r){let i=new Set(r),a=Math.fround(1-Math.fround(2*t));for(let t of e.metadata){if(!i.has(t.opticalStateId))continue;let e=Math.fround(a*Math.fround(t.resolution));if(!(Math.fround(e/n)>=En))throw RangeError(`dispersed-medium cell scale enters the implementation-defined f32 denormal range`)}}function Gi(e,t,n){let r=Math.fround(Fr(t,0,1)*Math.fround(n)),i=e=>Math.max(0,Math.fround(1-Math.abs(Math.fround(Math.fround(e)-r)))),a=i(e);return e===0&&(a=Math.fround(a+i(-1))),e===n-1&&(a=Math.fround(a+i(n))),Math.min(1,a)}function Ki(e,t,n){let r=Gi(e[0],t[0],n),i=Gi(e[1],t[1],n),a=Gi(e[2],t[2],n);return Math.fround(Math.fround(r*i)*a)}function qi({rows:e,offset:t,cellIndex:n,particle:r,resolution:i,fieldPadding:a,refEdgeM:o}){let s=Ki(n,r,i);if(!(s>0))return null;let c=Math.fround(1-Math.fround(2*a)),l=Math.fround(c*Math.fround(i)),u=Math.min(wn,Math.fround(l/o));return{scattering:Sr(e[t+5],s,u),absorption:Sr(e[t+6],s,u),scatteringAsymmetry:Cr(e[t+7],s,u)}}function Ji(e,t,n,r){let i=Fr(Q(n,0),0,1),a=Fr(Q(r,0),0,1),o=Fr(1-i-a,0,1);return e===1?a:e===2?o:e===3?i:+(t===e)}function Yi({phaseWeight:e,materialId:t,surfacePhaseId:n,carrierMassKg:r,dispersedRows:i,offset:a}){if(!i||!Vi(i,a)||i[a]!==t||i[a+1]!==n||!Number.isFinite(r)||!(r>0))return e;let o=Math.min(i[a+4],r)/r;return Math.max(0,e-o)}function Xi({fullStrength:e,phaseWeight:t,isolation:n,subtract:r}){let i=Fr(Q(t,0),0,1),a=Math.cbrt(i*i),o=Math.max(0,Q(n,0)+Q(r,0))*1e-6;return Q(e,0)*a+o*(1-a)}function Zi(e,t){return Math.sqrt(Math.max(Q(e,0)/Math.max(Q(t,0),1e-12)-1e-6,0))}function Qi({cell:e,position:t,strength:n,subtract:r,supportNorm:i,color:a,density:o,palette:s,distanceSqOffset:c=0}){let l=e[0]-t[0],u=e[1]-t[1],d=e[2]-t[2],f=l*l+u*u+d*d+c,p=n/(1e-6+f)-r;if(p<=0)return{density:o,palette:s};let m=Fr(Math.sqrt(f)/Math.max(i,1e-6),0,1),h=1-m**3*(m*(m*6-15)+10);return{density:o+p,palette:[s[0]+a[0]*h,s[1]+a[1]*h,s[2]+a[2]*h]}}function $i({renderRows:t,dispersedMediumOpticsRows:n=null,productEventRows:r=null,surfaceTable:i,particleCount:a=null,productEventCount:o=null,fieldPadding:s=.22,refEdgeM:c=10,renderSmearDtS:l=0}={}){if(!(t instanceof Float32Array))throw TypeError(`buildSphRenderFieldCpu requires Float32Array render rows`);if(t.length%ln!==0)throw RangeError(`SPH render rows length must align to the render row stride`);if(r&&(!(r instanceof Float32Array)||r.length%pn!==0))throw RangeError(`SPH product-event rows length must align to the product-event row stride`);Li(i),{fieldPadding:s,refEdgeM:c}=gr(s,c);let u=t.length/ln,d=hr(a??u,`particleCount`);if(d!==u)throw RangeError(`particleCount must exactly match the particle-aligned host render rows`);let p=r?.length?r.length/pn:0,m=hr(o??p,`productEventCount`);if(m!==p)throw RangeError(`productEventCount must exactly match the host product-event rows`);let h=Hi(n,d);Ui(i),n&&(Ui(i,h),Wi(i,s,c,h));let g=new Float32Array(i.totalFieldCells*dn);for(let e of i.metadata){let i=e.resolution,a=Math.sqrt(Math.abs(e.strength)/Math.max(e.subtract,1e-12)),o=Math.max(0,Q(e.particleRadiusScale,0)),u=Math.max(0,Q(e.particleRadiusFloorNorm,0)),f=1-2*s,p=Math.max(c,1e-12),h=o*f/p;for(let f=0;f<e.fieldCellCount;f+=1){let p=i*i,_=Math.floor(f/p),v=f-_*p,y=Math.floor(v/i),b=v-y*i,x=[b/i,y/i,_/i],S=0,C=[0,0,0],w=0,T=0,E=e.opticalStateId>0,D=0,O=0,k={positive:{mantissa:0,exponent:0,nonzero:!1},negative:{mantissa:0,exponent:0,nonzero:!1}},A={weight:{mantissa:0,exponent:0,nonzero:!1},weightedTemperature:{mantissa:0,exponent:0,nonzero:!1}};if(n)for(let r=0;r<d;r+=1){let a=r*8;if(!Vi(n,a)||n[a+2]!==e.opticalStateId)continue;let o=r*ln,l=Ri(t,o,s,c),u=qi({rows:n,offset:a,cellIndex:[b,y,_],particle:l,resolution:i,fieldPadding:s,refEdgeM:c});u&&(D=_r(D,u.scattering),O=_r(O,u.absorption),k=kr(k,u.scatteringAsymmetry),A=Nr(A,t[o+6],u.scattering),A=Nr(A,t[o+6],u.absorption))}let j=Fr(Ar(k),-D,D),M=[0,0,0],N=0,ee=r=>{let i={density:0,palette:[0,0,0],temperatureWeighted:0,temperatureWeight:0,accumulateMoments:r===0};for(let a=0;a<d;a+=1){let l=a*ln,d=t[l+4],f=t[l+5],p=t[l+11];if(d!==e.materialId||!Bi(p,e.renderDomainId))continue;let m=Yi({phaseWeight:Ji(e.phaseId,f,t[l+9],t[l+16]),materialId:d,surfacePhaseId:e.phaseId,carrierMassKg:t[l+3],dispersedRows:n,offset:a*8});if(m<=0)continue;let g=Ri(t,l,s,c),_=Q(t[l+13],0),v=o>0&&_>0?Math.max(_*h,u):0,y=Xi({fullStrength:v>0?(e.isolation+e.subtract)*v**2:e.strength,phaseWeight:m,isolation:e.isolation,subtract:e.subtract}),b=Zi(y,e.subtract),S=Qi({cell:x,position:g,strength:y,subtract:e.subtract,supportNorm:b,color:e.colorLinear,density:i.density,palette:i.palette,distanceSqOffset:r}),C=S.density-i.density;if(C>0&&(i.temperatureWeighted+=t[l+6]*C,i.temperatureWeight+=C,i.accumulateMoments)){let e=t[l+17],n=t[l+18],r=t[l+19];M[0]+=e*C,M[1]+=n*C,M[2]+=r*C,N+=(e*e+n*n+r*r)*C}i.density=S.density,i.palette=S.palette}return i},P=_r(D,O),F=E?{density:vr(Math.max(0,e.isolation),P),palette:P>0?[...e.colorLinear]:[0,0,0],temperatureWeighted:0,temperatureWeight:A.weight.nonzero?A.weight.mantissa:0}:ee(0);if(!E&&F.temperatureWeight>0&&l>0){let e=F.temperatureWeight,t=[M[0]/e,M[1]/e,M[2]/e],n=Math.max(0,N/e-(t[0]**2+t[1]**2+t[2]**2)),r=1-2*s,i=Math.sqrt(n)*l*r/Math.max(c,1e-12),a=i*i;a>1e-10&&(F=ee(a))}S=F.density,C=F.palette,w=F.temperatureWeighted,T=F.temperatureWeight;for(let t=0;!E&&t<m&&r;t+=1){let n=t*pn,i=r[n+18],o=r[n+4],l=r[n+11],u=r[n+13];if(i!==1||!(u>0)||o!==e.materialId||!zi(l,e.phaseId))continue;let d=Qi({cell:x,position:[Fr(s+r[n]/Math.max(c,1e-12)*(1-2*s),.001,.999),Fr(s+r[n+1]/Math.max(c,1e-12)*(1-2*s),.001,.999),Fr(s+r[n+2]/Math.max(c,1e-12)*(1-2*s),.001,.999)],strength:e.strength,subtract:e.subtract,supportNorm:a,color:e.colorLinear,density:S,palette:C});S=d.density,C=d.palette}let I=(e.fieldOffset+f)*dn;g[I]=S,g[I+1]=C[0],g[I+2]=C[1],g[I+3]=C[2],g[I+4]=E?Pr(A):T>0?w/T:0,g[I+5]=D,g[I+6]=O,g[I+7]=j}}return{schema:e,backend:`cpu-reference`,status:`render-field-built`,kernelScope:Zn,particleCount:d,dispersedMediumOpticsBound:!!n,dispersedMediumOpticsRowCount:n?d:0,productEventCount:m,surfaceCount:i.surfaceCount,totalFieldCells:i.totalFieldCells,maxFieldCellCount:i.maxFieldCellCount,surfaceTable:i,rowLayout:[...f],rowStrideFloats:dn,fieldRows:g,fieldRowByteLength:g.byteLength,fieldPadding:s,refEdgeM:c,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function ea(e){if(e?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`||!(e.fieldRows instanceof Float32Array))throw TypeError(`splitSphRenderFieldBySurface requires an SPH render field`);return e.surfaceTable.metadata.map(t=>{let n=new Float32Array(t.fieldCellCount),r=new Float32Array(t.fieldCellCount*3);for(let i=0;i<t.fieldCellCount;i+=1){let a=(t.fieldOffset+i)*dn;n[i]=e.fieldRows[a],r[i*3]=e.fieldRows[a+1],r[i*3+1]=e.fieldRows[a+2],r[i*3+2]=e.fieldRows[a+3]}return{...t,field:n,palette:r}})}function ta(e){let t=Math.hypot(e[0],e[1],e[2]);return t>0?[e[0]/t,e[1]/t,e[2]/t]:[0,0,0]}function na(e,t,n=1){let r=e.surfaceTable?.metadata||[],i=Array(r.length).fill(0),a=t.length/yn;for(let e=0;e<a;e+=1){let n=e*yn;if(!(t[n+15]>0))continue;let r=Math.round(t[n]);r>=0&&r<i.length&&(i[r]+=1)}return r.map(t=>{let r=t.isolation*Q(n,1),a=0;for(let n=0;n<t.fieldCellCount;n+=1){let i=(t.fieldOffset+n)*dn;e.fieldRows?.[i]>=r&&(a+=1)}let o=i[t.index]||0;return{surfaceKey:t.surfaceKey,material:t.material,phase:t.phase,renderKey:t.renderKey,materialId:t.materialId,phaseId:t.phaseId,opticalStateKey:t.opticalStateKey||`default`,resolution:t.resolution,isolation:r,activeCellCount:a,candidateOffset:t.fieldOffset*3,candidateCount:t.fieldCellCount*3,activeCandidateCount:o,status:o>0?`interface-candidates-active`:a>0?`interface-candidates-active-without-crossing`:`interface-candidates-empty`}})}async function ra({device:e,renderField:t,fieldRowsBuffer:n=null,surfaceBuffer:r=null,isolationScale:i=1}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphMaterialInterfaceCandidateFieldWebGpu requires a WebGPU-like device`);if(t?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)throw TypeError(`buildSphMaterialInterfaceCandidateFieldWebGpu requires an SPH render field`);if(!n&&!(t.fieldRows instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceCandidateFieldWebGpu requires fieldRows or fieldRowsBuffer`);if(!r&&!(t.surfaceTable?.records instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceCandidateFieldWebGpu requires surface table records or surfaceBuffer`);let a=t.surfaceTable?.surfaceCount??t.surfaceCount??0,o=t.totalFieldCells??0,s=o*3,c=s*yn*Float32Array.BYTES_PER_ELEMENT,l=o*dn*Float32Array.BYTES_PER_ELEMENT,u=a*un*Float32Array.BYTES_PER_ELEMENT,d=Math.ceil(Math.max(1,(t.maxFieldCellCount||0)*3)/64),f=Math.max(1,a);di(e,`material-interface candidates`,d,f),li(e,`ulg-sph-interface-candidates`,Math.max(4,c)),li(e,`ulg-sph-interface-candidate-readback`,Math.max(4,c)),ui(e,`ulg-sph-interface-candidates`,Math.max(4,c));let p=n||null,m=r||null;mi(e,`material-interface source render field`,p,l),mi(e,`material-interface render surfaces`,m,u);let h=p||ii(e,`ulg-sph-interface-source-render-field`,t.fieldRows,Z.COPY_SRC),g=m||ii(e,`ulg-sph-interface-render-surfaces`,t.surfaceTable.records),_=e.createBuffer({label:`ulg-sph-interface-candidates`,size:Math.max(4,c),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST}),v=e.createBuffer({label:`ulg-sph-interface-candidate-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(v,0,wi({surfaceCount:a,totalFieldCells:o,candidateCount:s,fieldPadding:Q(t.fieldPadding,.22),refEdgeM:Q(t.refEdgeM,10),isolationScale:Q(i,1)}));let{pipeline:y,bindGroupLayout:b}=pe(e,{label:`ulg-sph-interface-candidates`,module:e.createShaderModule({label:`ulg-sph-interface-candidates`,code:T}),entryPoint:`main`,bindings:[K(0,`read-only-storage`),K(1,`read-only-storage`),K(2,`storage`),K(3,`uniform`)]}),C=e.createBindGroup({layout:b,entries:[{binding:0,resource:hi(g,u,{label:`material-interface render surfaces`})},{binding:1,resource:hi(h,l,{label:`material-interface source render field`})},{binding:2,resource:hi(_,c,{label:`material-interface candidates`})},{binding:3,resource:{buffer:v}}]}),w=e.createCommandEncoder(),E=w.beginComputePass();E.setPipeline(y),E.setBindGroup(0,C),E.dispatchWorkgroups(d,f),E.end();let D=`queue-submitted`,O=`queue.submit`;e.queue.submit([w.finish()]);let k=await Oi(e,_,c,`ulg-sph-interface-candidate-readback`);D=`readback-map-completed`,O=`mapAsync(readback-buffer)`;let A=new Float32Array(k);p||h.destroy?.(),m||g.destroy?.(),_.destroy?.(),v.destroy?.();let j=na(t,A,i),M=j.reduce((e,t)=>e+t.activeCandidateCount,0);return{schema:x,backend:`webgpu`,status:M>0?`material-interface-candidate-field-ready`:`material-interface-candidate-field-empty`,sourceSchema:t.schema,sourceBackend:t.backend,surfaceCount:a,totalFieldCells:o,candidateCount:s,activeCandidateCount:M,rowLayout:[...S],rowStrideFloats:yn,candidateRows:A,candidateRowByteLength:A.byteLength,candidateShape:`fixed-render-field-cell-axis-triplets`,surfaces:j,fieldRowsBufferBound:!!p,surfaceBufferBound:!!m,queueCompletionStatus:D,queueCompletionMethod:O,candidateReadback:!0,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1}}function ia({candidateCount:e,surfaceCount:t,compactCandidateCapacity:n=null}){let r=Math.round(Q(n,0));if(r>0)return Math.max(1,Math.min(e,r));let i=Math.max(Sn,Math.max(1,Math.round(Q(t,0)))*8192);return Math.max(1,Math.min(e,i))}function aa(e=null){if(!(e instanceof Float32Array)||e.length<=0)return 0;let t=0;for(let n=0;n+2<e.length;n+=vn)(e[n+2]||0)>0&&(t+=1);return t}async function oa({device:e,renderField:t,fieldRowsBuffer:n=null,surfaceBuffer:r=null,sourceIndexFieldBuffer:i=null,isolationScale:a=1,compactCandidateCapacity:o=null}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires a WebGPU-like device`);if(t?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)throw TypeError(`buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires an SPH render field`);if(!n&&!(t.fieldRows instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires fieldRows or fieldRowsBuffer`);if(!r&&!(t.surfaceTable?.records instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires surface table records or surfaceBuffer`);let s=t.surfaceTable?.surfaceCount??t.surfaceCount??0,c=t.totalFieldCells??0,l=c*3,u=l*yn*Float32Array.BYTES_PER_ELEMENT,d=ia({candidateCount:l,surfaceCount:s,compactCandidateCapacity:o}),f=d*yn*Float32Array.BYTES_PER_ELEMENT,p=d*vn*Float32Array.BYTES_PER_ELEMENT,m=c*dn*Float32Array.BYTES_PER_ELEMENT,h=s*un*Float32Array.BYTES_PER_ELEMENT,g=Math.max(1,c)*Uint32Array.BYTES_PER_ELEMENT,_=Math.ceil(Math.max(1,(t.maxFieldCellCount||0)*3)/64),v=Math.max(1,s);di(e,`compact material-interface candidates`,_,v),li(e,`ulg-sph-interface-compact-candidates`,Math.max(4,f)),ui(e,`ulg-sph-interface-compact-candidates`,Math.max(4,f)),li(e,`ulg-sph-interface-source-keys`,Math.max(4,p)),ui(e,`ulg-sph-interface-source-keys`,Math.max(4,p)),li(e,`ulg-sph-interface-compact-metadata`,16),ui(e,`ulg-sph-interface-compact-metadata`,16);let y=n||null,b=r||null,C=i||t.sourceIndexFieldBuffer||null,w=!!C;mi(e,`compact material-interface source render field`,y,m),mi(e,`compact material-interface render surfaces`,b,h),mi(e,`compact material-interface source-index field`,C,g);let T=y||ii(e,`ulg-sph-interface-source-render-field`,t.fieldRows,Z.COPY_SRC),D=b||ii(e,`ulg-sph-interface-render-surfaces`,t.surfaceTable.records),O=C||ai(e,`ulg-sph-interface-source-index-disabled`,Math.max(1,c)*Uint32Array.BYTES_PER_ELEMENT),A=e.createBuffer({label:`ulg-sph-interface-compact-candidates`,size:Math.max(4,f),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST}),j=e.createBuffer({label:`ulg-sph-interface-source-keys`,size:Math.max(4,p),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST}),M=e.createBuffer({label:`ulg-sph-interface-compact-metadata`,size:16,usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST}),N=e.createBuffer({label:`ulg-sph-interface-compact-candidate-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(N,0,wi({surfaceCount:s,totalFieldCells:c,candidateCount:l,fieldPadding:Q(t.fieldPadding,.22),refEdgeM:Q(t.refEdgeM,10),isolationScale:Q(a,1),sourceKeyEnabled:w})),e.queue.writeBuffer(j,0,new Float32Array(d*vn)),e.queue.writeBuffer(M,0,new Uint32Array([0,0,d,l]));let{pipeline:ee,bindGroupLayout:P,cacheStatus:F}=fe(e,{cacheKey:`ulg-sph-interface-compact-candidates-v1`,label:`ulg-sph-interface-compact-candidates`,code:k,entryPoint:`main`,bindings:[K(0,`read-only-storage`),K(1,`read-only-storage`),K(2,`storage`),K(3,`uniform`),K(4,`storage`),K(5,`storage`),K(6,`storage`)]}),I=e.createBindGroup({layout:P,entries:[{binding:0,resource:hi(D,h,{label:`compact material-interface render surfaces`})},{binding:1,resource:hi(T,m,{label:`compact material-interface source render field`})},{binding:2,resource:hi(A,f,{label:`compact material-interface candidates`})},{binding:3,resource:{buffer:N}},{binding:4,resource:hi(M,16,{label:`compact material-interface metadata`})},{binding:5,resource:hi(O,g,{label:`compact material-interface source-index field`})},{binding:6,resource:hi(j,p,{label:`compact material-interface source keys`})}]}),te=e.createCommandEncoder(),ne=te.beginComputePass();ne.setPipeline(ee),ne.setBindGroup(0,I),ne.dispatchWorkgroups(_,v),ne.end(),e.queue.submit([te.finish()]);let re=await Oi(e,M,16,`ulg-sph-interface-compact-candidate-metadata-readback`),ie=new Uint32Array(re),ae=ie[0]??0,L=ie[1]??0,R=Math.min(ae,d),oe=R*yn*Float32Array.BYTES_PER_ELEMENT,z=oe>0?new Float32Array(await Oi(e,A,oe,`ulg-sph-interface-compact-candidate-readback`)):new Float32Array,B=R*vn*Float32Array.BYTES_PER_ELEMENT,V=w&&B>0?new Float32Array(await Oi(e,j,B,`ulg-sph-interface-source-key-readback`)):new Float32Array,H=aa(V),se=!!(w&&R>0);y||T.destroy?.(),b||D.destroy?.(),C||O.destroy?.(),A.destroy?.(),M.destroy?.(),N.destroy?.(),se||j.destroy?.();let ce=na(t,z,a),U=!1,W={schema:x,backend:`webgpu-compact`,status:L>0||ae>d?`material-interface-compact-candidate-field-overflow`:ae>0?`material-interface-candidate-field-ready`:`material-interface-candidate-field-empty`,reason:L>0||ae>d?`compact material-interface candidate capacity ${d} was exceeded by ${L} rows`:null,sourceSchema:t.schema,sourceBackend:t.backend,surfaceCount:s,totalFieldCells:c,candidateCount:l,activeCandidateCount:ae,rowLayout:[...S],rowStrideFloats:yn,candidateRows:z,candidateRowByteLength:z.byteLength,candidateDenseRowsByteLength:u,candidateCompactRowsByteLength:oe,compactCandidateCapacity:d,compactCandidateOverflowCount:L,compactCandidateMetadata:{activeCandidateCount:ae,overflowCount:L,capacity:d,denseCandidateCount:l},candidateShape:`compact-active-render-field-cell-axis-triplets`,surfaces:ce,fieldRowsBufferBound:!!y,surfaceBufferBound:!!b,sourceIndexFieldBufferBound:w,queueCompletionStatus:`compact-readback-map-completed`,queueCompletionMethod:`mapAsync(compact-candidate-readback-buffer)`,pipelineCacheStatus:F,candidateReadback:!0,candidateReadbackMode:tr,candidateMetadataReadback:!0,interfaceSourceKeySchema:E,interfaceSourceKeyStatus:w?H>0?`interface-source-key-retained`:`interface-source-key-empty`:`interface-source-key-unavailable`,interfaceSourceKeyReason:w?null:`source-local material-interface source-index field was unavailable`,interfaceSourceKeyRows:V,interfaceSourceKeyReadback:V.length>0,interfaceSourceKeyRowCount:R,interfaceSourceKeyReadyCount:H,interfaceSourceKeyStrideFloats:vn,interfaceSourceKeyRowByteLength:B,interfaceSourceKeyBufferRetained:se,interfaceSourceKeyBufferByteLength:se?p:0,interfaceSourceKeySurfaceIndexFallbackEnabled:!1,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1};return se&&(W.interfaceSourceKeyBuffer=j,W.destroyMaterialInterfaceCandidateFieldBuffers=({reason:e=`material-interface-candidate-field-buffer-cleanup`}={})=>U?{schema:`peercompute.ulg.sph-material-interface-candidate-field-buffer-cleanup.v0`,status:`material-interface-candidate-field-buffers-already-destroyed`,reason:e}:(U=!0,j.destroy?.(),W.interfaceSourceKeyBufferRetained=!1,W.interfaceSourceKeyBufferDestroyed=!0,{schema:`peercompute.ulg.sph-material-interface-candidate-field-buffer-cleanup.v0`,status:`material-interface-candidate-field-buffers-destroyed`,reason:e,interfaceSourceKeyBufferDestroyed:!0})),W}Object.freeze([[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]),Object.freeze([[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]]);var sa=12,ca=sa*3;function la(e){let t=Math.max(0,Math.round(Q(e,0))-1);return t*t*t}function ua(e){let t=Math.round(Q(e,0));return t===I.gas?3:t===I.liquid?2:0}function da(e={}){let t=Number(e.transparencyClassId),n=Number.isFinite(t)&&t>=0?t:ua(e.phaseId),r=Number(e.depthWriteFlag),i=Number.isFinite(r)&&r>=0?r:n>0?0:1,a=Number(e.renderOrder),o=Q(e.surfaceIndex??e.index,0),s=Number.isFinite(a)?a:n*1e3+o;return{renderLayer:e.renderLayer??null,renderOrder:s,transparencyClassId:n,depthWriteFlag:i}}function fa(e={}){let t=e=>{if(e==null||e===``)return null;let t=Number(e);return Number.isFinite(t)?t:null};return{particleRadiusScale:t(e.particleRadiusScale),particleRadiusPolicyStatus:e.particleRadiusPolicyStatus??null,particleRadiusPolicyMode:e.particleRadiusPolicyMode??null,particleRadiusContinuityFloorEligible:e.particleRadiusContinuityFloorEligible??null,particleRadiusContinuityFloorApplied:e.particleRadiusContinuityFloorApplied??null,particleRadiusScaleRequested:t(e.particleRadiusScaleRequested),particleRadiusContinuityFloorScale:t(e.particleRadiusContinuityFloorScale),particleRadiusContinuityFloorScaleUnbounded:t(e.particleRadiusContinuityFloorScaleUnbounded),particleRadiusContinuityRepresentativeRadiusM:t(e.particleRadiusContinuityRepresentativeRadiusM),particleRadiusContinuitySmoothingLengthM:t(e.particleRadiusContinuitySmoothingLengthM),particleRadiusContinuitySupportMultiplier:t(e.particleRadiusContinuitySupportMultiplier),particleRadiusContinuitySupportTargetIsoradiusM:t(e.particleRadiusContinuitySupportTargetIsoradiusM),particleRadiusContinuitySamplingCellSizeM:t(e.particleRadiusContinuitySamplingCellSizeM),particleRadiusContinuitySamplingMarginM:t(e.particleRadiusContinuitySamplingMarginM),particleRadiusContinuityTargetIsoradiusM:t(e.particleRadiusContinuityTargetIsoradiusM)}}function pa(e){let t=e?.surfaces||[],n=Math.max(0,Math.round(Q(e?.surfaceCount,t.length))),r=new Float32Array(n*un);for(let e=0;e<n;e+=1){let n=t[e]||{},i=e*un,a=Array.isArray(n.colorLinear)||ArrayBuffer.isView(n.colorLinear)?n.colorLinear:[1,1,1];r.set([Q(n.materialId,0),Q(n.phaseId,I.unknown),Q(n.fieldOffset??n.cellOffset,0),Q(n.fieldCellCount??n.cellCount??n.voxelCount??0,0),Q(n.resolution,0),Q(n.isolation,0),Q(n.subtract,0),Q(n.strength,0),Q(n.radiusNorm,0),Fr(Q(a[0],1),0,1),Fr(Q(a[1],1),0,1),Fr(Q(a[2],1),0,1),1,Q(n.opticalStateId,0),Number.isFinite(Number(n.transparencyClassId))?Number(n.transparencyClassId):-1,Number.isFinite(Number(n.depthWriteFlag))?Number(n.depthWriteFlag):-1],i)}return r}function ma(e,t=[]){let n=e.length/gn,r=0,i=0,a=0,o=[];for(let s=0;s<n;s+=1){let n=s*gn,c=t[s]||{},l=e[n+11]>0,u=Math.round(Q(e[n+5],0)),d=Math.round(Q(e[n+7],0));l&&(r+=1),i+=u,a+=d,o.push({surfaceKey:c.surfaceKey,material:c.material,phase:c.phase,renderKey:c.renderKey,surfaceIndex:Math.round(Q(e[n],s)),materialId:e[n+1],phaseId:e[n+2],opticalStateId:e[n+3],vertexOffset:Math.round(Q(e[n+4],0)),vertexCount:u,triangleOffset:Math.round(Q(e[n+6],0)),triangleCount:d,renderOrder:e[n+8],transparencyClassId:e[n+9],depthWriteFlag:e[n+10],boundsCenterM:[e[n+12],e[n+13],e[n+14]],boundsRadiusM:e[n+15],status:l?`surface-draw-ready`:`surface-draw-empty`})}return{surfaces:o,activeSurfaceCount:r,vertexCount:i,triangleCount:a}}function ha(e,t=[]){let n=e.length/mn,r=0,i=0,a=0,o=[];for(let s=0;s<n;s+=1){let n=s*mn,c=t[s]||{},l=e[n+11]>0,u=Math.round(Q(e[n+4],0)),d=Q(e[n+6],0);l&&(r+=1),i+=u,a=Math.max(a,d),o.push({surfaceKey:c.surfaceKey,material:c.material,phase:c.phase,renderKey:c.renderKey,...fa(c),surfaceIndex:Math.round(Q(e[n],s)),materialId:e[n+1],phaseId:e[n+2],opticalStateId:e[n+3],activeCellCount:u,crossingCellCount:Math.round(Q(e[n+5],0)),maxDensity:d,isolation:e[n+7],minActiveM:[e[n+8],e[n+9],e[n+10]],maxActiveM:[e[n+12],e[n+13],e[n+14]],cellSizeM:e[n+15],boundsCenterM:[e[n+16],e[n+17],e[n+18]],boundsRadiusM:e[n+19],status:l?`render-field-surface-active`:`render-field-surface-empty`})}return{surfaces:o,activeSurfaceCount:r,activeCellCount:i,maxDensity:a}}async function ga({device:e,renderField:n,fieldRowsBuffer:r=null,surfaceBuffer:i=null,isolationScale:o=1,retainSummaryRowsBuffer:s=!1}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`summarizeSphRenderFieldSurfacesWebGpu requires a WebGPU-like device`);if(n?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)throw TypeError(`summarizeSphRenderFieldSurfacesWebGpu requires an SPH render field`);if(!r&&!(n.fieldRows instanceof Float32Array))throw TypeError(`summarizeSphRenderFieldSurfacesWebGpu requires fieldRows or fieldRowsBuffer`);if(!i&&!(n.surfaceTable?.records instanceof Float32Array))throw TypeError(`summarizeSphRenderFieldSurfacesWebGpu requires surface table records or surfaceBuffer`);let c=n.surfaceTable?.surfaceCount??n.surfaceCount??0,l=c*mn*Float32Array.BYTES_PER_ELEMENT,u=(n.totalFieldCells??0)*dn*Float32Array.BYTES_PER_ELEMENT,d=c*un*Float32Array.BYTES_PER_ELEMENT,f=Math.max(1,c);di(e,`render field surface summary`,f),li(e,`ulg-sph-render-field-surface-summary`,Math.max(4,l)),ui(e,`ulg-sph-render-field-surface-summary`,Math.max(4,l));let p=r||null,m=i||null;mi(e,`render field surface summary source field`,p,u),mi(e,`render field surface summary surfaces`,m,d);let h=p||ii(e,`ulg-sph-render-field-summary-source-field`,n.fieldRows,Z.COPY_SRC),g=m||ii(e,`ulg-sph-render-field-summary-surfaces`,n.surfaceTable.records),_=e.createBuffer({label:`ulg-sph-render-field-surface-summary`,size:Math.max(4,l),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST});l>0&&e.queue.writeBuffer(_,0,new Float32Array(c*mn));let v=e.createBuffer({label:`ulg-sph-render-field-surface-summary-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(v,0,Ei({surfaceCount:c,totalFieldCells:n.totalFieldCells??0,fieldPadding:Q(n.fieldPadding,.22),refEdgeM:Q(n.refEdgeM,10),isolationScale:Q(o,1)}));let{pipeline:y,bindGroupLayout:b}=pe(e,{label:`ulg-sph-render-field-surface-summary`,module:e.createShaderModule({label:`ulg-sph-render-field-surface-summary`,code:M}),entryPoint:`main`,bindings:[K(0,`read-only-storage`),K(1,`read-only-storage`),K(2,`storage`),K(3,`uniform`)]}),x=e.createBindGroup({layout:b,entries:[{binding:0,resource:hi(g,d,{label:`render field surface summary surfaces`})},{binding:1,resource:hi(h,u,{label:`render field surface summary source field`})},{binding:2,resource:hi(_,l,{label:`render field surface summary rows`})},{binding:3,resource:{buffer:v}}]}),S=e.createCommandEncoder(),C=S.beginComputePass();C.setPipeline(y),C.setBindGroup(0,x),C.dispatchWorkgroups(f),C.end(),e.queue.submit([S.finish()]);let w=`queue-submitted`,T=`queue.submit`,E=new Float32Array;if(l>0){let t=await Oi(e,_,l,`ulg-sph-render-field-surface-summary-readback`);E=new Float32Array(t),w=`compact-summary-readback-map-completed`,T=`mapAsync(compact-summary-readback-buffer)`}p||h.destroy?.(),m||g.destroy?.(),s||_.destroy?.(),v.destroy?.();let D=ha(E,n.surfaceTable?.metadata||[]),O={schema:a,backend:`webgpu`,status:D.activeSurfaceCount>0?`render-field-surface-summary-ready`:`render-field-surface-summary-empty`,sourceRenderFieldSchema:n.schema,sourceRenderFieldBackend:n.backend,surfaceCount:c,activeSurfaceCount:D.activeSurfaceCount,activeCellCount:D.activeCellCount,maxDensity:D.maxDensity,rowLayout:[...t],rowStrideFloats:mn,summaryRows:E,summaryRowsByteLength:l,summaryRowsBufferByteLength:s?l:0,summaryRowsBufferRetained:!!s,fieldRowsBufferBound:!!p,surfaceBufferBound:!!m,queueCompletionStatus:w,queueCompletionMethod:T,renderFieldSurfaceSummaryReadback:!0,renderFieldReadback:!!n.renderFieldReadback,surfaces:D.surfaces,scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};return s&&(O.summaryRowsBuffer=_,O.destroySummaryRowsBuffer=()=>_.destroy?.()),O}function _a(e,t,n=1){let r=e.surfaceTable?.metadata||[],i=r.map(()=>new Set),a=Array(r.length).fill(0),o=t.length/_n;for(let e=0;e<o;e+=1){let n=e*_n;if(!(t[n+15]>0))continue;let o=Math.round(t[n]);o>=0&&o<r.length&&(a[o]+=1,i[o].add(Math.round(t[n+3])))}return r.map(e=>{let t=a[e.index]||0,r=i[e.index]?.size||0,o=da(e);return{surfaceKey:e.surfaceKey,material:e.material,phase:e.phase,renderKey:e.renderKey,renderLayer:e.renderLayer??o.renderLayer,renderOrder:o.renderOrder,transparencyClassId:o.transparencyClassId,depthWriteFlag:o.depthWriteFlag,materialId:e.materialId,phaseId:e.phaseId,opticalStateKey:e.opticalStateKey||`default`,opticalStateId:e.opticalStateId||0,resolution:e.resolution,isolation:e.isolation*Q(n,1),voxelResolution:Math.max(0,e.resolution-1),voxelCount:la(e.resolution),fieldOffset:e.fieldOffset,fieldCellCount:e.fieldCellCount,activeCellCount:null,triangleOffset:null,triangleCount:r,vertexOffset:null,vertexCount:t,status:r>0?`surface-vertices-ready`:`surface-vertices-empty`}})}function va(e){if(!(e instanceof Float32Array)||e.length===0)return new Float32Array;let t=[];for(let n=0;n<e.length;n+=_n)if(e[n+15]>0){let r=Array.from(e.slice(n,n+_n)),i=t.length/_n;r[3]=Math.floor(i/3),r[4]=i%3,t.push(...r)}return Float32Array.from(t)}async function ya({device:e,renderField:t,fieldRowsBuffer:n=null,surfaceBuffer:i=null,isolationScale:a=1,readbackMode:o=Qn,retainVertexRowsBuffer:s=!1,maxVertexRows:l=null,surfaceVertexEmissionMode:u=null,compactByteBudget:d=Cn,onProgress:f=null,waitForQueueCompletion:p=!0,deferCleanup:m=!0,useQueueFenceForCleanup:g=!0}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphRenderSurfaceVerticesWebGpu requires a WebGPU-like device`);if(t?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)throw TypeError(`buildSphRenderSurfaceVerticesWebGpu requires an SPH render field`);if(!n&&!(t.fieldRows instanceof Float32Array))throw TypeError(`buildSphRenderSurfaceVerticesWebGpu requires fieldRows or fieldRowsBuffer`);if(!i&&!(t.surfaceTable?.records instanceof Float32Array))throw TypeError(`buildSphRenderSurfaceVerticesWebGpu requires surface table records or surfaceBuffer`);let _=t.surfaceTable?.surfaceCount??t.surfaceCount??0,v=t.totalFieldCells??0,y=o===$n,b=Ir(u,{noFullReadback:y}),x=Lr(b),S=v*ca,C=Rr({requiredVertexRows:S,requestedMaxVertexRows:l,emissionMode:b,compactByteBudget:d}),w=C*_n*Float32Array.BYTES_PER_ELEMENT,T=v*dn*Float32Array.BYTES_PER_ELEMENT,E=_*un*Float32Array.BYTES_PER_ELEMENT,D=Math.ceil(Math.max(1,t.maxFieldCellCount||0)/64),O=Math.max(1,_);di(e,`render surface vertices`,D,O),li(e,`ulg-sph-surface-vertices`,Math.max(4,w)),ui(e,`ulg-sph-surface-vertices`,Math.max(4,w)),li(e,`ulg-sph-surface-vertex-counter`,16),ui(e,`ulg-sph-surface-vertex-counter`,16);let k=b===ir&&C<S,A=!!(y&&s&&b===ir),j=typeof f==`function`?(e,n={})=>{try{f({status:e,stage:`surface-vertices`,surfaceCount:_,totalFieldCells:v,maxFieldCellCount:t.maxFieldCellCount??null,requiredVertexRows:S,maxVertexRows:C,fixedSlotVertexRowsByteLength:w,surfaceVertexEmissionMode:b,surfaceVertexBudgetCapped:k,compactByteBudget:d,readbackMode:y?$n:Qn,...n})}catch{}}:()=>{};j(`surface-vertices-kernel-started`);let M=n||null,N=i||null;mi(e,`render surface vertices source field`,M,T),mi(e,`render surface vertices surfaces`,N,E),j(`surface-vertices-source-buffers-started`);let ee=M||ii(e,`ulg-sph-surface-vertices-source-render-field`,t.fieldRows,Z.COPY_SRC),P=N||ii(e,`ulg-sph-surface-vertices-render-surfaces`,t.surfaceTable.records);j(`surface-vertices-source-buffers-ready`,{borrowedFieldRowsBuffer:!!M,borrowedSurfaceBuffer:!!N}),j(`surface-vertices-output-buffer-create-started`);let F=e.createBuffer({label:`ulg-sph-surface-vertices`,size:Math.max(4,w),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST});j(`surface-vertices-output-buffer-create-complete`),w>0&&(j(`surface-vertices-output-buffer-zero-started`),e.queue.writeBuffer(F,0,new Float32Array(C*_n)),j(`surface-vertices-output-buffer-zero-complete`)),j(`surface-vertices-params-buffer-started`);let I=e.createBuffer({label:`ulg-sph-surface-vertex-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(I,0,Ti({surfaceCount:_,totalFieldCells:v,maxVertexRows:C,emissionModeId:x,fieldPadding:Q(t.fieldPadding,.22),refEdgeM:Q(t.refEdgeM,10),isolationScale:Q(a,1)})),j(`surface-vertices-params-buffer-complete`),j(`surface-vertices-counter-buffer-started`);let te=e.createBuffer({label:`ulg-sph-surface-vertex-counter`,size:16,usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST});e.queue.writeBuffer(te,0,new Uint32Array(4)),j(`surface-vertices-counter-buffer-complete`),j(`surface-vertices-shader-module-started`);let ne=e.createShaderModule({label:`ulg-sph-surface-vertices`,code:c});j(`surface-vertices-shader-module-complete`),j(`surface-vertices-pipeline-started`);let{pipeline:re,bindGroupLayout:ie}=pe(e,{label:`ulg-sph-surface-vertices`,module:ne,entryPoint:`main`,bindings:[K(0,`read-only-storage`),K(1,`read-only-storage`),K(2,`storage`),K(3,`uniform`),K(4,`storage`)]});j(`surface-vertices-pipeline-complete`),j(`surface-vertices-bind-group-started`);let ae=e.createBindGroup({layout:ie,entries:[{binding:0,resource:hi(P,E,{label:`render surface vertices surfaces`})},{binding:1,resource:hi(ee,T,{label:`render surface vertices source field`})},{binding:2,resource:hi(F,w,{label:`render surface vertices`})},{binding:3,resource:{buffer:I}},{binding:4,resource:hi(te,16,{label:`render surface vertex counter`})}]});j(`surface-vertices-bind-group-complete`),j(`surface-vertices-command-encode-started`);let L=e.createCommandEncoder(),R=L.beginComputePass();R.setPipeline(re),R.setBindGroup(0,ae),R.dispatchWorkgroups(D,O),R.end(),j(`surface-vertices-command-encode-complete`,{workgroupCountX:D,workgroupCountY:O});let oe=new Float32Array,z=null,B=null,V=`not-submitted`,H=null,se=!1,ce=!1;if(!y)if(j(`surface-vertices-queue-submit-started`),e.queue.submit([L.finish()]),V=`queue-submitted`,H=`queue.submit`,j(`surface-vertices-queue-submit-complete`,{queueCompletionStatus:V,queueCompletionMethod:H}),C>0){j(`surface-vertices-full-readback-started`);let t=await Oi(e,F,w,`ulg-sph-surface-vertex-readback`);V=`readback-map-completed`,H=`mapAsync(readback-buffer)`,oe=va(new Float32Array(t)),z=oe.length/_n,B=z/3,j(`surface-vertices-full-readback-complete`,{queueCompletionStatus:V,queueCompletionMethod:H,vertexCount:z,triangleCount:B})}else V=`readback-skipped-empty-buffer`,H=`queue.submit`,j(`surface-vertices-full-readback-skipped`,{queueCompletionStatus:V,queueCompletionMethod:H});else if(p&&e.queue?.onSubmittedWorkDone)j(`surface-vertices-queue-submit-started`),e.queue.submit([L.finish()]),V=`queue-submitted`,H=`queue.submit`,j(`surface-vertices-queue-submit-complete`,{queueCompletionStatus:V,queueCompletionMethod:H}),j(`surface-vertices-queue-work-wait-started`),await e.queue.onSubmittedWorkDone(),V=`queue-work-completed`,H=`queue.onSubmittedWorkDone`,j(`surface-vertices-queue-work-wait-complete`,{queueCompletionStatus:V,queueCompletionMethod:H});else{j(`surface-vertices-queue-submit-started`),e.queue.submit([L.finish()]);let t=!!(e.queue?.onSubmittedWorkDone&&m&&g);V=t?`queue-submitted-cleanup-deferred`:e.queue?.onSubmittedWorkDone?`queue-submitted-gpu-handoff-no-cpu-fence`:`queue-submitted-no-explicit-completion`,H=t?`deferred queue.onSubmittedWorkDone cleanup`:e.queue?.onSubmittedWorkDone?`queue.submit(in-order-gpu-surface-vertex-handoff)`:`queue.submit`,se=t,ce=!!(e.queue?.onSubmittedWorkDone&&m&&!g),j(`surface-vertices-queue-submit-complete`,{queueCompletionStatus:V,queueCompletionMethod:H})}let U=!1,W=()=>{U||(U=!0,M||ee.destroy?.(),N||P.destroy?.(),s||F.destroy?.(),I.destroy?.(),A||te.destroy?.())};se?(j(`surface-vertices-cleanup-deferred`,{queueCompletionStatus:V,queueCompletionMethod:H}),me(e,()=>{W(),j(`surface-vertices-deferred-cleanup-complete`,{queueCompletionStatus:V,queueCompletionMethod:H})})):ce?j(`surface-vertices-cleanup-deferred-no-queue-fence`,{queueCompletionStatus:V,queueCompletionMethod:H,reason:`retained resident handoff owns cleanup through buffer lease release`}):y&&!p&&e.queue?.onSubmittedWorkDone&&!m?j(`surface-vertices-cleanup-retained-for-resident-handoff`,{queueCompletionStatus:V,queueCompletionMethod:H,reason:`caller disabled queue-fence cleanup because a same-queue consumer/readback owns the synchronization boundary`}):(j(`surface-vertices-cleanup-started`),W(),j(`surface-vertices-cleanup-complete`));let G=_e({ledgerId:`sph-surface-vertices:${_}:${C}:buffer-leases`,stateKey:`sph-surface-vertices`,scope:`sph-surface-vertex-buffer-leases`}),le=[],ue=`surface-vertices:vertex-rows:${C}:${w}`,de=`surface-vertices:vertex-counter:${C}:16`;if(s){q(G,{resourceKey:ue,resourceKind:`surface-vertex-rows-buffer`,stateFamily:`render-surface-vertices`,ownerStage:`surface-vertex-builder`,producerStage:`surface-vertex-builder`,source:`buildSphRenderSurfaceVerticesWebGpu`,status:`resident-surface-vertex-buffer-retained`,retained:!0,byteLength:w,rowCount:C,bufferLabel:F?.label,emissionMode:b,expectedConsumers:[`surface-draw-metadata`]});let e=ye(G,{resourceKey:ue,consumerStage:`surface-draw-metadata`,reason:`retained-surface-vertex-buffer`});le.push(e.leaseId)}if(A){q(G,{resourceKey:de,resourceKind:`surface-vertex-counter-buffer`,stateFamily:`render-surface-vertices`,ownerStage:`surface-vertex-builder`,producerStage:`surface-vertex-builder`,source:`buildSphRenderSurfaceVerticesWebGpu`,status:`resident-surface-vertex-counter-retained`,retained:!0,byteLength:16,rowCount:1,bufferLabel:te?.label,emissionMode:b,expectedConsumers:[`surface-draw-metadata`]});let e=ye(G,{resourceKey:de,consumerStage:`surface-draw-metadata`,reason:`retained-surface-vertex-counter`});le.push(e.leaseId)}let fe=oe.length?_a(t,oe,a):(t.surfaceTable?.metadata||[]).map(e=>{let t=da(e);return{surfaceKey:e.surfaceKey,material:e.material,phase:e.phase,renderKey:e.renderKey,renderLayer:e.renderLayer??t.renderLayer,renderOrder:t.renderOrder,transparencyClassId:t.transparencyClassId,depthWriteFlag:t.depthWriteFlag,materialId:e.materialId,phaseId:e.phaseId,opticalStateKey:e.opticalStateKey||`default`,opticalStateId:e.opticalStateId||0,resolution:e.resolution,isolation:e.isolation*Q(a,1),voxelResolution:Math.max(0,e.resolution-1),voxelCount:la(e.resolution),fieldOffset:e.fieldOffset,fieldCellCount:e.fieldCellCount,activeCellCount:null,triangleOffset:null,triangleCount:null,vertexOffset:null,vertexCount:null,status:`surface-vertex-summary-not-read`}}),he={schema:r,backend:`webgpu`,status:y?b===ir?`surface-vertices-resident-atomic-compact`:`surface-vertices-resident-fixed-slots`:(B||0)>0?`surface-vertices-ready`:`surface-vertices-empty`,sourceRenderFieldSchema:t.schema,sourceRenderFieldBackend:t.backend,surfaceExtractionMethod:`tetrahedralized-render-field-cubes`,compactionMode:y?b===ir?`webgpu-atomic-compact`:`webgpu-fixed-cell-slots`:`webgpu-fixed-cell-slots-debug-compacted`,surfaceVertexEmissionMode:b,surfaceVertexEmissionModeId:x,surfaceVertexBudgetCapped:k,surfaceVertexCompactByteBudget:b===ir?Math.max(0,Math.round(Q(d,Cn))):null,requiredVertexRows:S,surfaceCount:_,totalFieldCells:v,activeCellCount:null,triangleCount:B,vertexCount:z,overflowCount:y&&b===ir?null:0,maxTrianglesPerCell:sa,maxVerticesPerCell:ca,maxVertexRows:C,rowLayout:[...h],rowStrideFloats:_n,vertexRows:oe,vertexRowsByteLength:oe.byteLength,fixedSlotVertexRowsByteLength:w,fixedSlotVertexRowCount:C,vertexRowsBufferByteLength:s?w:0,vertexRowsBufferRowCount:s?C:0,vertexRowsBufferRetained:!!s,vertexCounterBufferByteLength:A?16:0,vertexCounterBufferRetained:A,counterBufferRetained:A,counterReadback:!1,fieldRowsBufferBound:!!M,surfaceBufferBound:!!N,readbackMode:y?$n:Qn,queueCompletionStatus:V,queueCompletionMethod:H,surfaceVertexDeferredCleanup:ce,surfaceVertexReadback:!y,renderFieldReadback:!!t.renderFieldReadback,surfaces:fe,residentBufferLeaseLedger:G,residentBufferLeaseSummary:ve(G),residentBufferLeaseLedgerStatus:G.status,residentBufferLeaseResourceCount:G.resourceCount,residentBufferLeaseActiveLeaseCount:G.activeLeaseCount,scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};if(s){he.vertexRowsBuffer=F,A&&(he.vertexCounterBuffer=te);let e=!1,t=!1,n=()=>(he.residentBufferLeaseSummary=ve(G),he.residentBufferLeaseLedgerStatus=he.residentBufferLeaseSummary.status,he.residentBufferLeaseResourceCount=he.residentBufferLeaseSummary.resourceCount,he.residentBufferLeaseActiveLeaseCount=he.residentBufferLeaseSummary.activeLeaseCount,he.residentBufferLeaseSummary);he.releaseSurfaceVertexBufferLeases=({status:e=`released`}={})=>{for(let t of le)be(G,t,{status:e});return n()},he.destroySurfaceVertexBuffers=({force:r=!1,releaseLeases:i=!1,reason:a=`surface-vertex-buffer-cleanup`}={})=>(W(),i&&he.releaseSurfaceVertexBufferLeases(),ge(G,ue,()=>{e||(e=!0,F.destroy?.())},{force:r,reason:a}),A&&ge(G,de,()=>{t||(t=!0,te.destroy?.())},{force:r,reason:a}),n())}return he}async function ba({device:e,surfaceVertices:t,surfaceBuffer:r=null,readbackMode:i=Qn,compactSummaryReadback:a=!1,retainDrawRowsBuffer:o=!1,retainCompactedVertexRowsBuffer:s=!1,retainDrawIndirectRowsBuffer:c=!1,waitForQueueCompletion:u=!0,onProgress:f=null}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphRenderSurfaceDrawMetadataWebGpu requires a WebGPU-like device`);if(t?.schema!==`peercompute.ulg.sph-gpu-render-surface-vertices.v0`)throw TypeError(`buildSphRenderSurfaceDrawMetadataWebGpu requires an SPH surface vertex field`);let p=!!t.vertexRowsBuffer,h=t.vertexRows instanceof Float32Array&&t.vertexRows.length>0;if(!p&&!h)throw TypeError(`buildSphRenderSurfaceDrawMetadataWebGpu requires vertexRows or a retained vertexRowsBuffer`);let g=i===$n,_=!!t.vertexCounterBuffer,v=+!!_,y=_?`resident-vertex-counter`:`uniform-upper-bound`,b=_n*Float32Array.BYTES_PER_ELEMENT;if(t.rowStrideFloats!=null&&t.rowStrideFloats!==_n)throw RangeError(`surface vertex rowStrideFloats does not match the draw-kernel vertex ABI`);let x;if(p){let e=[[`vertexRowsBufferRowCount`,t.vertexRowsBufferRowCount],[`maxVertexRows`,t.maxVertexRows],[`fixedSlotVertexRowCount`,t.fixedSlotVertexRowCount]].filter(([,e])=>e!=null),n=[[`vertexRowsBufferByteLength`,t.vertexRowsBufferByteLength],[`fixedSlotVertexRowsByteLength`,t.fixedSlotVertexRowsByteLength]].filter(([,e])=>e!=null),r=Number(t.vertexRowsBuffer.size);if(!Number.isSafeInteger(r)||r<0)throw RangeError(`surface vertex rows buffer must expose its exact GPU buffer size`);if(e.length>0){x=hr(e[0][1],`surfaceVertices.${e[0][0]}`);for(let[t,n]of e.slice(1))if(hr(n,`surfaceVertices.${t}`)!==x)throw RangeError(`surface vertex row-count metadata must identify one exact borrowed range`)}else if(n.length>0){let[e,t]=n[0],r=pi(t,`surfaceVertices.${e}`);if(r%b!==0)throw RangeError(`surface vertex byte-length metadata must align to the vertex row ABI`);x=hr(r/b,`surface vertex borrowed row count`)}else{if(r%b!==0)throw RangeError(`surface vertex rows buffer capacity must align to the vertex row ABI when row metadata is absent`);x=hr(r/b,`surface vertex borrowed row count`)}let i=x*b;for(let[e,t]of n)if(pi(t,`surfaceVertices.${e}`)!==i)throw RangeError(`surface vertex row-count and byte-length metadata describe different borrowed ranges`)}else{if(t.vertexRows.length%_n!==0)throw RangeError(`surface vertex host rows must align to the vertex row ABI`);x=hr(t.vertexRows.length/_n,`surface vertex host row count`)}let S=hr(t.surfaceCount??t.surfaces?.length??0,`surface vertex surfaceCount`),C=x*b,w=S*gn*Float32Array.BYTES_PER_ELEMENT,T=S*hn*Uint32Array.BYTES_PER_ELEMENT,E=hn*Uint32Array.BYTES_PER_ELEMENT,D=S*un*Float32Array.BYTES_PER_ELEMENT,O=Math.max(1,S);di(e,`render surface draw metadata`,O);for(let[t,n]of[[`render surface draw compacted vertices`,C],[`render surface draw rows`,w],[`render surface draw indirect rows`,T],[`render surface draw aggregate indirect row`,E]]){let r=fi(n,t);li(e,t,r),ui(e,t,r)}let k=typeof f==`function`?(e,t={})=>{try{f({status:e,stage:`surface-draw-metadata`,surfaceCount:S,sourceVertexRowCount:x,compactedVertexRowsByteLength:C,drawRowsByteLength:w,drawIndirectRowsByteLength:T,drawAggregateIndirectRowsByteLength:E,sourceVertexCounterMode:y,sourceVertexCounterBufferBound:_,readbackMode:g?$n:Qn,compactSummaryReadback:!!a,...t})}catch{}}:()=>{};k(`surface-draw-metadata-kernel-started`);let A=r||null;if(mi(e,`render surface draw source vertices`,p?t.vertexRowsBuffer:null,C),mi(e,`render surface draw surfaces`,A,D),_&&t.vertexCounterBufferByteLength!=null&&pi(t.vertexCounterBufferByteLength,`surfaceVertices.vertexCounterBufferByteLength`)!==16)throw RangeError(`surface vertex counter byte length does not match its exact storage ABI`);mi(e,`render surface draw source vertex counter`,_?t.vertexCounterBuffer:null,16),k(`surface-draw-metadata-source-buffers-started`,{hasBorrowedVertexBuffer:p,borrowedSurfaceBuffer:!!A});let j=p?t.vertexRowsBuffer:ii(e,`ulg-sph-surface-draw-source-vertices`,t.vertexRows,Z.COPY_SRC),M=A||ii(e,`ulg-sph-surface-draw-surfaces`,pa(t)),N=_?t.vertexCounterBuffer:e.createBuffer({label:`ulg-sph-surface-draw-source-vertex-counter`,size:16,usage:Z.STORAGE|Z.COPY_DST});_||e.queue.writeBuffer(N,0,new Uint32Array([x,0,0,0])),k(`surface-draw-metadata-source-buffers-ready`,{hasBorrowedVertexBuffer:p,borrowedSurfaceBuffer:!!A,hasBorrowedVertexCounterBuffer:_}),k(`surface-draw-metadata-output-buffers-started`);let P=e.createBuffer({label:`ulg-sph-surface-draw-compacted-vertices`,size:Math.max(4,C),usage:Z.STORAGE|Z.VERTEX|Z.COPY_SRC|Z.COPY_DST});C>0&&e.queue.writeBuffer(P,0,new Float32Array(x*_n));let F=e.createBuffer({label:`ulg-sph-surface-draw-metadata`,size:Math.max(4,w),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST});w>0&&e.queue.writeBuffer(F,0,new Float32Array(S*gn));let I=e.createBuffer({label:`ulg-sph-surface-draw-indirect`,size:Math.max(4,T),usage:Z.STORAGE|Z.INDIRECT|Z.COPY_SRC|Z.COPY_DST});T>0&&e.queue.writeBuffer(I,0,new Uint32Array(S*hn));let te=e.createBuffer({label:`ulg-sph-surface-draw-aggregate-indirect`,size:E,usage:Z.STORAGE|Z.INDIRECT|Z.COPY_SRC|Z.COPY_DST});e.queue.writeBuffer(te,0,new Uint32Array(hn)),k(`surface-draw-metadata-output-buffers-complete`),k(`surface-draw-metadata-params-buffer-started`);let ne=e.createBuffer({label:`ulg-sph-surface-draw-params`,size:16,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(ne,0,Di({surfaceCount:S,sourceVertexRowCount:x,maxCompactVertexRows:x,sourceVertexCounterMode:v})),k(`surface-draw-metadata-params-buffer-complete`),k(`surface-draw-metadata-shader-module-started`);let re=e.createShaderModule({label:`ulg-sph-surface-draw`,code:ee});k(`surface-draw-metadata-shader-module-complete`),k(`surface-draw-metadata-pipeline-started`);let{pipeline:ie,bindGroupLayout:ae}=pe(e,{label:`ulg-sph-surface-draw`,module:re,entryPoint:`main`,bindings:[K(0,`read-only-storage`),K(1,`read-only-storage`),K(2,`storage`),K(3,`storage`),K(4,`uniform`),K(5,`storage`),K(6,`read-only-storage`),K(7,`storage`)]});k(`surface-draw-metadata-pipeline-complete`),k(`surface-draw-metadata-bind-group-started`);let L=e.createBindGroup({layout:ae,entries:[{binding:0,resource:hi(M,D,{label:`render surface draw surfaces`})},{binding:1,resource:hi(j,C,{label:`render surface draw source vertices`})},{binding:2,resource:hi(P,C,{label:`render surface draw compacted vertices`})},{binding:3,resource:hi(F,w,{label:`render surface draw rows`})},{binding:4,resource:{buffer:ne}},{binding:5,resource:hi(I,T,{label:`render surface draw indirect rows`})},{binding:6,resource:hi(N,16,{label:`render surface draw source vertex counter`})},{binding:7,resource:hi(te,E,{label:`render surface draw aggregate indirect row`})}]});k(`surface-draw-metadata-bind-group-complete`),k(`surface-draw-metadata-command-encode-started`);let R=e.createCommandEncoder(),oe=R.beginComputePass();oe.setPipeline(ie),oe.setBindGroup(0,L),oe.dispatchWorkgroups(O),oe.end(),k(`surface-draw-metadata-command-encode-complete`,{workgroupCountX:O});let z=new Float32Array,B=new Uint32Array,V=new Float32Array,H=null,se=null,ce=null,U,W=!1,G=0,le=`not-submitted`,ue=null,de=!1,fe=null,he=null,xe=null,Se=null;if(!g)if(k(`surface-draw-metadata-queue-submit-started`),e.queue.submit([R.finish()]),le=`queue-submitted`,ue=`queue.submit`,k(`surface-draw-metadata-queue-submit-complete`,{queueCompletionStatus:le,queueCompletionMethod:ue}),w>0){k(`surface-draw-metadata-full-readback-started`);let n=await Oi(e,F,w,`ulg-sph-surface-draw-readback`);le=`readback-map-completed`,ue=`mapAsync(readback-buffer)`,z=new Float32Array(n);let r=ma(z,t.surfaces||[]);if(U=r.surfaces,H=r.activeSurfaceCount,se=r.vertexCount,ce=r.triangleCount,se>0){let t=await Oi(e,P,se*_n*Float32Array.BYTES_PER_ELEMENT,`ulg-sph-surface-draw-compacted-vertex-readback`);V=new Float32Array(t)}if(T>0){let t=await Oi(e,I,T,`ulg-sph-surface-draw-indirect-readback`);B=new Uint32Array(t)}k(`surface-draw-metadata-full-readback-complete`,{queueCompletionStatus:le,queueCompletionMethod:ue,activeSurfaceCount:H,vertexCount:se,triangleCount:ce})}else U=[],H=0,se=0,ce=0,B=new Uint32Array,le=`readback-skipped-empty-buffer`,ue=`queue.submit`,k(`surface-draw-metadata-full-readback-skipped`,{queueCompletionStatus:le,queueCompletionMethod:ue});else if(u&&e.queue?.onSubmittedWorkDone?(k(`surface-draw-metadata-queue-submit-started`),e.queue.submit([R.finish()]),le=`queue-submitted`,ue=`queue.submit`,k(`surface-draw-metadata-queue-submit-complete`,{queueCompletionStatus:le,queueCompletionMethod:ue}),k(`surface-draw-metadata-queue-work-wait-started`),await e.queue.onSubmittedWorkDone(),le=`queue-work-completed`,ue=`queue.onSubmittedWorkDone`,k(`surface-draw-metadata-queue-work-wait-complete`,{queueCompletionStatus:le,queueCompletionMethod:ue})):(k(`surface-draw-metadata-queue-submit-started`),e.queue.submit([R.finish()]),le=e.queue?.onSubmittedWorkDone&&!a?`queue-submitted-cleanup-deferred`:`queue-submitted-no-explicit-completion`,ue=e.queue?.onSubmittedWorkDone&&!a?`deferred queue.onSubmittedWorkDone cleanup`:`queue.submit`,de=!!(e.queue?.onSubmittedWorkDone&&!a),k(`surface-draw-metadata-queue-submit-complete`,{queueCompletionStatus:le,queueCompletionMethod:ue})),U=(t.surfaces||[]).map((e,t)=>({...(()=>{let n=da({...e,surfaceIndex:t});return{surfaceKey:e.surfaceKey,material:e.material,phase:e.phase,renderKey:e.renderKey,renderLayer:e.renderLayer??n.renderLayer,surfaceIndex:t,materialId:e.materialId,phaseId:e.phaseId,opticalStateId:e.opticalStateId||0,vertexOffset:null,vertexCount:null,triangleOffset:null,triangleCount:null,renderOrder:n.renderOrder,transparencyClassId:n.transparencyClassId,depthWriteFlag:n.depthWriteFlag,boundsCenterM:[0,0,0],boundsRadiusM:null,status:`surface-draw-summary-not-read`}})()})),a&&w>0){k(`surface-draw-metadata-compact-summary-readback-started`);let n=await Oi(e,F,w,`ulg-sph-surface-draw-compact-summary-readback`);z=new Float32Array(n);let r=ma(z,t.surfaces||[]);U=r.surfaces,H=r.activeSurfaceCount,se=r.vertexCount,ce=r.triangleCount,W=!0,G=w,le=`compact-summary-readback-map-completed`,ue=`mapAsync(compact-summary-readback-buffer)`,k(`surface-draw-metadata-compact-summary-readback-complete`,{queueCompletionStatus:le,queueCompletionMethod:ue,activeSurfaceCount:H,vertexCount:se,triangleCount:ce})}else W=!1,G=0,fe=Math.max(0,x-x%3),he=Math.floor(fe/3),xe=fe>=3?`surface-draw-gpu-resident-draw-range-available`:`surface-draw-gpu-resident-empty-draw-range`,Se=fe>=3?`compact surface-draw summary was not read; retained GPU buffers expose a conservative upper-bound draw range for same-device consumers`:`compact surface-draw summary was not read and retained GPU buffers do not contain a drawable triangle range`,k(`surface-draw-metadata-gpu-only-draw-range-ready`,{queueCompletionStatus:le,queueCompletionMethod:ue,gpuOnlyDrawRangeStatus:xe,gpuOnlyDrawRangeVertexCount:fe,gpuOnlyDrawRangeTriangleCount:he});let Ce=()=>{p||j.destroy?.(),A||M.destroy?.(),_||N.destroy?.(),ne.destroy?.()},we=o||g,Te=s||g,Ee=c||g,De=g;we||F.destroy?.(),Te||P.destroy?.(),Ee||I.destroy?.(),De||te.destroy?.(),de?(k(`surface-draw-metadata-cleanup-deferred`,{queueCompletionStatus:le,queueCompletionMethod:ue}),me(e,()=>{Ce(),k(`surface-draw-metadata-deferred-cleanup-complete`,{queueCompletionStatus:le,queueCompletionMethod:ue})})):(k(`surface-draw-metadata-cleanup-started`),Ce(),k(`surface-draw-metadata-cleanup-complete`));let Oe=_e({ledgerId:`sph-resident-surface-draw:${S}:buffer-leases`,stateKey:`sph-resident-surface-draw`,scope:`sph-resident-surface-draw-buffer-leases`}),ke=[],Ae=({resourceKey:e,resourceKind:t,buffer:n,byteLength:r,rowCount:i})=>{q(Oe,{resourceKey:e,resourceKind:t,stateFamily:`render-surface`,ownerStage:`surface-draw-metadata`,producerStage:`surface-draw-metadata`,source:`buildSphRenderSurfaceDrawMetadataWebGpu`,status:`resident-surface-draw-buffer-retained`,retained:!0,byteLength:r,rowCount:i,bufferLabel:n?.label,expectedConsumers:[`resident-surface-draw-overlay`,`diagnostics`]});let a=ye(Oe,{resourceKey:e,consumerStage:`resident-surface-draw-overlay`,reason:`retained-overlay-draw-buffer`});ke.push(a.leaseId)};we&&Ae({resourceKey:`surface-draw:draw-rows:${S}:${w}`,resourceKind:`surface-draw-rows-buffer`,buffer:F,byteLength:w,rowCount:S}),Ee&&Ae({resourceKey:`surface-draw:draw-indirect:${S}:${T}`,resourceKind:`surface-draw-indirect-buffer`,buffer:I,byteLength:T,rowCount:S}),De&&Ae({resourceKey:`surface-draw:draw-aggregate-indirect:1:${E}`,resourceKind:`surface-draw-aggregate-indirect-buffer`,buffer:te,byteLength:E,rowCount:1}),Te&&Ae({resourceKey:`surface-draw:compacted-vertices:${x}:${C}`,resourceKind:`surface-draw-compacted-vertices-buffer`,buffer:P,byteLength:C,rowCount:x});let je={schema:d,backend:`webgpu`,status:g?`surface-draw-resident`:(H||0)>0?`surface-draw-metadata-ready`:`surface-draw-metadata-empty`,sourceSurfaceVertexSchema:t.schema,sourceSurfaceVertexBackend:t.backend,surfaceCount:S,activeSurfaceCount:H,vertexCount:se,triangleCount:ce,rowLayout:[...m],rowStrideFloats:gn,drawRows:z,drawRowsByteLength:w,drawRowsBufferByteLength:we?w:0,drawRowsBufferRetained:we,drawIndirectSchema:l,drawIndirectRowLayout:[...n],drawIndirectRowStrideUints:hn,drawIndirectRows:B,drawIndirectRowsByteLength:T,drawIndirectRowsBufferByteLength:Ee?T:0,drawIndirectRowsBufferRetained:Ee,drawAggregateIndirectRowsByteLength:E,drawAggregateIndirectRowsBufferByteLength:De?E:0,drawAggregateIndirectRowsBufferRetained:De,compactedVertexRows:V,compactedVertexRowsByteLength:V.byteLength,compactedVertexRowsBufferByteLength:Te?C:0,compactedVertexRowsBufferRetained:Te,sourceVertexRowCount:x,sourceVertexRowsBufferBound:p,sourceVertexCounterMode:y,sourceVertexCounterBufferBound:_,sourceVertexCounterBufferByteLength:_?16:0,surfaceBufferBound:!!A,readbackMode:g?$n:Qn,queueCompletionStatus:le,queueCompletionMethod:ue,surfaceDrawReadback:!g,surfaceDrawSummaryReadback:W,surfaceDrawSummaryReadbackByteLength:G,surfaceDrawGpuOnlyHandoff:!!(g&&!W),surfaceDrawGpuOnlyHandoffStatus:xe,surfaceDrawGpuOnlyHandoffReason:Se,surfaceDrawGpuOnlyUpperBoundVertexCount:fe,surfaceDrawGpuOnlyUpperBoundTriangleCount:he,surfaceDrawGpuOnlyAggregateIndirectReady:!!(g&&!W&&De&&_),surfaceDrawGpuOnlyAggregateDrawRangeExact:!!(g&&!W&&_),surfaceDrawGpuOnlyDrawRangeConservative:!!(g&&!W&&(fe||0)>=3),fullSurfaceDrawReadback:!g,compactionMode:`webgpu-surface-prefix-scan-compact`,surfaces:U,residentBufferLeaseLedger:Oe,residentBufferLeaseSummary:ve(Oe),residentBufferLeaseLedgerStatus:Oe.status,residentBufferLeaseResourceCount:Oe.resourceCount,residentBufferLeaseActiveLeaseCount:Oe.activeLeaseCount,scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};if(we&&(je.drawRowsBuffer=F),Ee&&(je.drawIndirectRowsBuffer=I),De&&(je.drawAggregateIndirectRowsBuffer=te),Te&&(je.compactedVertexRowsBuffer=P),we||Te||Ee){let e=new Set,t=()=>(je.residentBufferLeaseSummary=ve(Oe),je.residentBufferLeaseLedgerStatus=je.residentBufferLeaseSummary.status,je.residentBufferLeaseResourceCount=je.residentBufferLeaseSummary.resourceCount,je.residentBufferLeaseActiveLeaseCount=je.residentBufferLeaseSummary.activeLeaseCount,je.residentBufferLeaseSummary);je.releaseSurfaceDrawBufferLeases=({status:e=`released`}={})=>{for(let t of ke)be(Oe,t,{status:e});return t()};let n=(t,n)=>{e.has(t)||(e.add(t),n?.destroy?.())};je.destroySurfaceDrawBuffers=({force:e=!1,releaseLeases:r=!1,reason:i=`surface-draw-buffer-cleanup`}={})=>{if(r&&je.releaseSurfaceDrawBufferLeases(),we){let t=`surface-draw:draw-rows:${S}:${w}`;ge(Oe,t,()=>{n(t,F)},{force:e,reason:i})}if(Te){let t=`surface-draw:compacted-vertices:${x}:${C}`;ge(Oe,t,()=>{n(t,P)},{force:e,reason:i})}if(Ee){let t=`surface-draw:draw-indirect:${S}:${T}`;ge(Oe,t,()=>{n(t,I)},{force:e,reason:i})}if(De){let t=`surface-draw:draw-aggregate-indirect:1:${E}`;ge(Oe,t,()=>{n(t,te)},{force:e,reason:i})}return t()}}return je}function xa(e){if(e?.schema!==`peercompute.ulg.sph-material-interface-candidate-field.v0`||!(e.candidateRows instanceof Float32Array))throw TypeError(`compactSphMaterialInterfaceCandidates requires a material-interface candidate field`);if(e.candidateRows.length%yn!==0)throw RangeError(`material-interface candidate rows must align to the candidate row stride`)}function Sa(e){xa(e);let t=e.candidateRows,n=e.interfaceSourceKeyRows instanceof Float32Array?e.interfaceSourceKeyRows:null,r=(e.surfaces||[]).map(e=>({...e,crossingFaceCount:0,surfaceAreaM2:0,normalAreaSum:[0,0,0],centroidAreaSum:[0,0,0],elementOffset:0,elementCount:0})),i=[],a=[],o=t.length/yn,s=e=>{if(!n)return null;let t=e*vn;if(t+2>=n.length)return null;let r=Math.round(Q(n[t],-1)),i=n[t+2]||0;if(r!==e||!(i>0))return null;let a=Math.round(Q(n[t+1],-1));return a>=0?a:null};for(let e=0;e<o;e+=1){let n=e*yn;if(!(t[n+15]>0))continue;let o=Math.round(t[n]),c=r[o];if(!c)continue;c.elementCount===0&&(c.elementOffset=a.length);let l=t[n+7],u=[t[n+11],t[n+12],t[n+13]],d=[t[n+4],t[n+5],t[n+6]],f=[t[n+8],t[n+9],t[n+10]],p=a.length,m=s(p),h={index:p,surfaceIndex:o,surfaceKey:c.surfaceKey,material:c.material,phase:c.phase,renderKey:c.renderKey,materialId:t[n+1],phaseId:t[n+2],axisId:t[n+3],centroidM:d,areaM2:l,normal:f,normalAreaVectorM2:u,crossingSign:t[n+14],...m==null?{}:{sourceParticleIndex:m},status:`interface-element-ready`};a.push(h),i.push(h.surfaceIndex,h.materialId,h.phaseId,h.axisId,h.centroidM[0],h.centroidM[1],h.centroidM[2],h.areaM2,h.normal[0],h.normal[1],h.normal[2],h.normalAreaVectorM2[0],h.normalAreaVectorM2[1],h.normalAreaVectorM2[2],h.crossingSign,1),c.crossingFaceCount+=1,c.surfaceAreaM2+=l,c.normalAreaSum[0]+=u[0],c.normalAreaSum[1]+=u[1],c.normalAreaSum[2]+=u[2],c.centroidAreaSum[0]+=d[0]*l,c.centroidAreaSum[1]+=d[1]*l,c.centroidAreaSum[2]+=d[2]*l,c.elementCount+=1}let c=r.map(e=>({surfaceKey:e.surfaceKey,material:e.material,phase:e.phase,renderKey:e.renderKey,materialId:e.materialId,phaseId:e.phaseId,opticalStateKey:e.opticalStateKey||`default`,resolution:e.resolution,isolation:e.isolation,activeCellCount:e.activeCellCount,crossingFaceCount:e.crossingFaceCount,candidateOffset:e.candidateOffset,candidateCount:e.candidateCount,activeCandidateCount:e.activeCandidateCount,elementOffset:e.elementOffset,elementCount:e.elementCount,surfaceAreaM2:e.surfaceAreaM2,meanOutwardNormal:ta(e.normalAreaSum),areaCentroidM:e.surfaceAreaM2>0?e.centroidAreaSum.map(t=>t/e.surfaceAreaM2):[null,null,null],normalDerivation:`render-field-isosurface-threshold-crossing-candidates`,surfaceAreaDerivation:`fixed-cell-axis-candidate-face-area-sum`,status:e.surfaceAreaM2>0?`material-interface-derived`:e.activeCellCount>0?`material-interface-active-without-crossing`:`material-interface-empty`})),l=c.reduce((e,t)=>e+t.surfaceAreaM2,0),u=c.filter(e=>e.surfaceAreaM2>0).length,d={schema:_,status:u>0?`material-interface-field-ready`:`material-interface-field-empty`,sourceSchema:e.sourceSchema,sourceBackend:e.sourceBackend,candidateFieldSchema:e.schema,candidateBackend:e.backend,surfaceCount:c.length,readySurfaceCount:u,totalSurfaceAreaM2:l,candidateCount:e.candidateCount,activeCandidateCount:e.activeCandidateCount,candidateStrideFloats:e.rowStrideFloats,candidateShape:e.candidateShape,elementCount:a.length,elementLayout:[...v],elementStrideFloats:bn,elementRows:Float32Array.from(i),elements:a,interfaceSourceKeySchema:e.interfaceSourceKeySchema??null,interfaceSourceKeySourceStatus:e.interfaceSourceKeyStatus??null,interfaceSourceKeyStatus:e.interfaceSourceKeyStatus??null,interfaceSourceKeyReason:e.interfaceSourceKeyReason??null,interfaceSourceKeyRows:e.interfaceSourceKeyRows instanceof Float32Array?e.interfaceSourceKeyRows:new Float32Array,interfaceSourceKeyReadback:!!e.interfaceSourceKeyReadback,interfaceSourceKeyRowCount:e.interfaceSourceKeyRowCount??0,interfaceSourceKeyReadyCount:e.interfaceSourceKeyReadyCount??0,interfaceSourceKeyStrideFloats:e.interfaceSourceKeyStrideFloats??vn,interfaceSourceKeyBufferRetained:!!e.interfaceSourceKeyBufferRetained,interfaceSourceKeyBufferByteLength:e.interfaceSourceKeyBufferByteLength??0,interfaceSourceKeySurfaceIndexFallbackEnabled:e.interfaceSourceKeySurfaceIndexFallbackEnabled!==!1,forceCouplingStatus:u>0?`blocked-pressure-force-solver-not-implemented`:`blocked-material-surface-normals-not-resolved`,surfaces:c,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1};return e.interfaceSourceKeyBuffer&&(d.interfaceSourceKeyBuffer=e.interfaceSourceKeyBuffer),typeof e.destroyMaterialInterfaceCandidateFieldBuffers==`function`&&(d.destroyMaterialInterfaceFieldBuffers=({reason:t=`material-interface-field-buffer-cleanup`}={})=>e.destroyMaterialInterfaceCandidateFieldBuffers({reason:t})),d}async function Ca({device:e,renderField:t,fieldRowsBuffer:n=null,surfaceBuffer:r=null,isolationScale:i=1,source:a=`resident-physics-material-interface-extractor`,sourceCadence:o=`resident-physics-stage`,candidateReadbackByteBudget:s=xn,candidateReadbackMode:c=er,compactCandidateCapacity:l=null}={}){let u=t?.schema===`peercompute.ulg.sph-material-interface-source-field.v0`?t:null,d=u?.sourceRenderField||t,f=n||u?.fieldRowsBuffer||null,p=r||u?.surfaceBuffer||null,m=gi(d),h=c===tr?tr:c===nr?nr:er;if(h===nr)return yi({sourceField:u,sourceRenderField:d,resolvedFieldRowsBuffer:f,resolvedSurfaceBuffer:p,source:a,sourceCadence:o,candidateRowsByteLength:m,candidateReadbackByteBudget:s,candidateReadbackMode:h,compactCandidateCapacity:l});let g=h===tr?tr:er,_=g===tr?null:_i({device:e,candidateRowsByteLength:m,candidateReadbackByteBudget:s});if(_)return vi({sourceField:u,sourceRenderField:d,resolvedFieldRowsBuffer:f,resolvedSurfaceBuffer:p,source:a,sourceCadence:o,candidateRowsByteLength:m,candidateReadbackByteBudget:s,candidateReadbackBlocker:_,candidateReadbackMode:g});let v=null;if(g===tr){if(v=await oa({device:e,renderField:d,fieldRowsBuffer:f,surfaceBuffer:p,sourceIndexFieldBuffer:u?.sourceIndexFieldBuffer||d?.sourceIndexFieldBuffer||null,isolationScale:i,compactCandidateCapacity:l}),v.status===`material-interface-compact-candidate-field-overflow`){let t=_i({device:e,candidateRowsByteLength:m,candidateReadbackByteBudget:s});if(t)return vi({sourceField:u,sourceRenderField:d,resolvedFieldRowsBuffer:f,resolvedSurfaceBuffer:p,source:a,sourceCadence:o,candidateRowsByteLength:m,candidateReadbackByteBudget:s,candidateReadbackBlocker:t,candidateReadbackMode:g,compactCandidateField:v});v.destroyMaterialInterfaceCandidateFieldBuffers?.({reason:`compact-candidate-overflow-switching-to-dense-fallback`}),v=await ra({device:e,renderField:d,fieldRowsBuffer:f,surfaceBuffer:p,isolationScale:i}),v.compactFallbackStatus=`fallback-dense-readback-after-compact-overflow`}}else v=await ra({device:e,renderField:d,fieldRowsBuffer:f,surfaceBuffer:p,isolationScale:i});let y=Sa(v),b=v.candidateReadbackMode===tr;return{...y,backend:b?`webgpu-compact-candidate-readback`:`webgpu-candidate-readback`,authority:`resident-physics-material-interface-extractor`,source:a,sourceCadence:o,sourceFieldSchema:u?.schema??null,sourceFieldStatus:u?.status??null,sourceFieldBackend:u?.backend??null,sourceFieldPipelineCacheStatus:u?.sourceRenderFieldPipelineCacheStatus??u?.pipelineCacheStatus??null,sourceRenderFieldSchema:d?.schema??null,sourceRenderFieldBackend:d?.backend??null,sourceRenderFieldPipelineCacheStatus:d?.pipelineCacheStatus??u?.sourceRenderFieldPipelineCacheStatus??null,sourceRenderFieldReadback:!!d?.renderFieldReadback,sourceFieldRowsBufferBound:!!f,sourceSurfaceBufferBound:!!p,candidateBackend:v.backend,candidateReadback:!!v.candidateReadback,candidateReadbackMode:v.candidateReadbackMode??h,candidateRowsByteLength:m,candidateDenseRowsByteLength:v.candidateDenseRowsByteLength??m,candidateCompactRowsByteLength:v.candidateCompactRowsByteLength??null,candidateCompactCapacity:v.compactCandidateCapacity??null,candidateCompactOverflowCount:v.compactCandidateOverflowCount??0,candidateCompactFallbackStatus:v.compactFallbackStatus??null,candidateMetadataReadback:!!v.candidateMetadataReadback,candidatePipelineCacheStatus:v.pipelineCacheStatus??null,queueCompletionStatus:v.queueCompletionStatus??null,queueCompletionMethod:v.queueCompletionMethod??null,normalDerivation:`physics-owned-field-cell-crossing-candidates`,surfaceAreaDerivation:`physics-owned-fixed-cell-face-area-sum`,physicsStage:`material-interface-extraction`,pressureInterfaceProducer:!0}}async function wa({device:t,renderRows:n,renderRowsBuffer:r=null,renderRowsSource:i=null,dispersedMediumOptics:a=null,dispersedMediumOpticsRows:o=null,dispersedMediumOpticsBuffer:s=null,dispersedMediumOpticsAuthority:c=null,schroederSpatialSourceFamily:l=i?.schroederSpatialSourceFamily??null,productEventRows:u=null,productEventBuffer:d=null,productEventSource:p=null,productEventLiveCountDescriptor:m=null,surfaceTable:h,particleCount:_=null,productEventCount:v=null,fieldPadding:y=.22,refEdgeM:x=10,renderSmearDtS:S=0,readbackMode:T=Qn,retainFieldRowsBuffer:E=!1,retainMotionFieldBuffer:D=!1,retainSurfaceBuffer:O=!1,waitForQueueCompletion:k=!0,deferCleanup:A=!0,useQueueFenceForCleanup:M=!0,targetFieldRowsBuffer:N=null,targetFieldRowsBufferByteLength:ee=null}={}){if(!t?.createBuffer||!t.queue?.writeBuffer)throw TypeError(`buildSphRenderFieldWebGpu requires a WebGPU-like device`);if(typeof D!=`boolean`)throw TypeError(`retainMotionFieldBuffer must be a boolean`);if(!r&&!(n instanceof Float32Array))throw TypeError(`buildSphRenderFieldWebGpu requires renderRows or renderRowsBuffer`);if(n&&n.length%ln!==0)throw RangeError(`SPH render rows length must align to the render row stride`);if(u&&(!(u instanceof Float32Array)||u.length%pn!==0))throw RangeError(`SPH product-event rows length must align to the product-event row stride`);Li(h),{fieldPadding:y,refEdgeM:x}=gr(y,x);let F=Pn(h),I=Float32Array.from(F.recordValues),te=n?.length?n.length/ln:0,ne=hr(_??i?.particleCount??te,`particleCount`),ie=ne*ln*Float32Array.BYTES_PER_ELEMENT;if(!r&&te!==ne)throw RangeError(`particleCount must match exact host rows or fit the resident render-row buffer capacity`);let ae=u?.length?u.length/pn:0,L=hr(v??ae,`productEventCount`);if(!d&&L!==ae)throw RangeError(`productEventCount must exactly match the host product-event rows`);let oe=Hi(o,ne);if(a&&(s!=null&&s!==a.buffer||c!=null&&c!==a.authority))throw TypeError(`SPH render field rejected torn dispersed-medium child aliases`);let z=a?.buffer??s??null,B=a?.authority??c??null;if((z||B)&&!a)throw TypeError(`resident dispersed-medium rendering requires the exact branded child descriptor; buffer and authority aliases only corroborate it`);let V=!!(a||o||z||B);if(o&&(a||z||B))throw TypeError(`SPH render field accepts either dispersed-medium host rows or one authenticated resident buffer, not both`);let H=ne*8*Float32Array.BYTES_PER_ELEMENT,se=Number(z?.size);if((a||z||B)&&(a!=null&&(a.particleCount!==ne||a.rowCount!==ne||a.rowStrideFloats!==8||a.bufferByteLength!==H)||!z||!B||!R(t,B,{upload:a,buffer:z,particleCount:ne,rowCount:ne,rowStrideFloats:8,bufferByteLength:H})||!Number.isSafeInteger(se)||se!==H))throw TypeError(`SPH render field rejected a torn or foreign dispersed-medium optics authority`);V?(Ui(h,oe??B?.readyOpticalStateIds??[]),Wi(h,y,x,oe??B?.readyOpticalStateIds??[])):Ui(h);let ce=T===$n,U=r||null,W=d||null,G=m??(W&&p?b(p,t):null);if((p?.productEventLiveCountAuthority||w(p))&&!G)throw TypeError(`SPH render field rejected a torn product-event live-count authority`);if(G&&(!j(G,{handle:p,device:t})||!(Number(W?.size)>=L*pn*Float32Array.BYTES_PER_ELEMENT)||p.productEventBuffer!==W||G.controlBuffer==null||G.controlPrefixByteLength!==C||G.hostObserved!==!1||G.expectedRowCapacity!==L||G.expectedRowStrideVec4!==pn/4||G.rowCapacity!==L||G.rowStrideFloats!==pn))throw TypeError(`SPH render field GPU live-count authority does not match its product-event buffer capacity and row ABI`);if(l){if(i?.schroederSpatialSourceFamily!==l||i?.particleCount!==ne||r==null)throw TypeError(`successor render field requires exact branded render rows and no unauthenticated product-event source`);if(re(l,{device:t,particleCount:ne}),!Bn(i,{device:t,sourceFamily:l,particleCount:ne,renderRowsBuffer:r,renderRows:r?null:n}))throw TypeError(`successor render field requires module-authenticated render-row derivation`);if(!Vn({device:t,sourceFamily:l,productEventRows:u,productEventBuffer:W,productEventSource:p,productEventCount:L,productEventLiveCountDescriptor:G}))throw TypeError(`successor render field requires exact branded render rows and no unauthenticated product-event source`)}if(a&&!l){let e=i?.schroederSpatialSourceFamily??null;if(!i||!Bn(i,{device:t,sourceFamily:e,particleCount:ne,renderRowsBuffer:r,renderRows:r?null:n}))throw TypeError(`resident dispersed-medium rendering requires module-authenticated render-row lineage`)}if(a||i?.dispersedMediumOptics){let e=i?.dispersedMediumOptics??null;if(o!=null||a!==e||z!==(e?.buffer??null)||B!==(e?.authority??null))throw TypeError(`render field requires the exact dispersed-medium sidecar captured with its render rows`)}let le=U?W?`resident-render-rows-and-product-events-buffer`:`resident-render-rows-buffer`:W?`uploaded-render-rows-with-resident-product-events`:`uploaded-render-rows`,ue=L*pn*Float32Array.BYTES_PER_ELEMENT,de=W||u?ue:pn*Float32Array.BYTES_PER_ELEMENT,pe=V?H:8*Float32Array.BYTES_PER_ELEMENT,he=h.surfaceCount*un*Float32Array.BYTES_PER_ELEMENT,xe=h.totalFieldCells*dn*Float32Array.BYTES_PER_ELEMENT,Se=D?h.totalFieldCells*4*Float32Array.BYTES_PER_ELEMENT:0;D&&(li(t,`render field motion`,Se),ui(t,`render field motion`,Se)),li(t,`render field cells`,xe),ui(t,`render field cells`,xe);let Ce=Math.ceil(Math.max(1,h.maxFieldCellCount)/64),we=Math.max(1,h.surfaceCount);di(t,`render field`,Ce,we),mi(t,`render field source rows`,U,ie),mi(t,`render field product events`,W,ue),mi(t,`render field dispersed-medium optics`,z,H),G&&mi(t,`render field product-history control`,G.controlBuffer,C,{offset:G.controlOffsetBytes??0});let Te=0;if(N){let e=pi(N.size,`targetFieldRowsBuffer.size`);if(Te=ee==null?e:pi(ee,`targetFieldRowsBufferByteLength`),Te>e)throw RangeError(`targetFieldRowsBufferByteLength (${Te}) exceeds the actual GPU buffer capacity (${e})`);if(Te<xe)throw RangeError(`targetFieldRowsBuffer is too small (${Te}) for render field (${xe})`);mi(t,`render field target cells`,N,xe)}let Ee=new Set,De=e=>(e&&Ee.add(e),e),{sourceRowsBuffer:Oe,sourceProductEventBuffer:ke,sourceDispersedMediumOpticsBuffer:Ae,productHistoryControlBufferOwned:je,productHistoryControlBuffer:Me,productHistoryGateParamsBuffer:Ne,surfaceBuffer:Pe,fieldRowsBufferBorrowed:Fe,fieldRowsBuffer:Ie,motionFieldBuffer:Le,paramsBuffer:Re,pipelineCacheStatus:ze,encoder:Be}=(()=>{try{let e=U||De(ii(t,`ulg-sph-render-field-source-rows`,n,Z.COPY_SRC)),r=W||De(ii(t,`ulg-sph-render-field-product-events`,u||new Float32Array(pn),Z.COPY_SRC)),i=z||De(o?ii(t,`ulg-sph-render-field-dispersed-medium-optics`,o,Z.COPY_SRC):ai(t,`ulg-sph-render-field-dispersed-medium-optics-disabled`,8*Float32Array.BYTES_PER_ELEMENT)),a=!G,s=G?.controlBuffer||De(ai(t,`ulg-sph-render-field-product-history-control-disabled`,C)),c=De(t.createBuffer({label:`ulg-sph-render-field-product-history-gate-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST}));t.queue.writeBuffer(c,0,Ci(G));let l=De(ii(t,`ulg-sph-render-field-surfaces`,I)),d=!!N,f=N||De(ai(t,`ulg-sph-render-field-cells`,xe,Z.COPY_SRC)),p=D?De(ai(t,`ulg-sph-render-field-motion`,Se,Z.COPY_SRC)):null,m=De(t.createBuffer({label:`ulg-sph-render-field-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST}));t.queue.writeBuffer(m,0,Si({particleCount:ne,productEventCount:W||u?L:0,surfaceCount:h.surfaceCount,totalFieldCells:h.totalFieldCells,fieldPadding:y,refEdgeM:x,renderSmearDtS:S,dispersedMediumOpticsEnabled:V}));let{pipeline:_,bindGroupLayout:v,cacheStatus:b}=fe(t,{cacheKey:D?`ulg-sph-render-field-v5-disjoint-bulk-dispersed-optics-motion-v0`:`ulg-sph-render-field-v5-disjoint-bulk-dispersed-optics`,label:`ulg-sph-render-field`,code:D?g:P,entryPoint:`main`,bindings:[K(0,`read-only-storage`),K(1,`read-only-storage`),K(2,`storage`),K(3,`uniform`),K(4,`read-only-storage`),K(5,`read-only-storage`),K(6,`uniform`),K(7,`read-only-storage`),...D?[K(8,`storage`)]:[]]}),w=t.createBindGroup({layout:v,entries:[{binding:0,resource:hi(e,ie,{label:`render field source rows`})},{binding:1,resource:hi(l,he,{label:`render field surfaces`})},{binding:2,resource:hi(f,xe,{label:`render field cells`})},{binding:3,resource:{buffer:m}},{binding:4,resource:hi(r,de,{label:`render field product events`})},{binding:5,resource:{buffer:s,offset:G?.controlOffsetBytes??0,size:C}},{binding:6,resource:{buffer:c}},{binding:7,resource:hi(i,pe,{label:`render field dispersed-medium optics`})},...p?[{binding:8,resource:hi(p,Se,{label:`render field motion`})}]:[]]}),T=t.createCommandEncoder(),E=T.beginComputePass();return E.setPipeline(_),E.setBindGroup(0,w),E.dispatchWorkgroups(Ce,we),E.end(),{sourceRowsBuffer:e,sourceProductEventBuffer:r,sourceDispersedMediumOpticsBuffer:i,productHistoryControlBufferOwned:a,productHistoryControlBuffer:s,productHistoryGateParamsBuffer:c,surfaceBuffer:l,fieldRowsBufferBorrowed:d,fieldRowsBuffer:f,motionFieldBuffer:p,paramsBuffer:m,pipelineCacheStatus:b,encoder:T}}catch(e){for(let e of Ee)e.destroy?.();throw e}})(),Ve=`not-submitted`,He=null,Ue,We=!1,Ge=!1,Ke=!1,qe=()=>{Ke||(Ke=!0,U||Oe.destroy?.(),W||ke.destroy?.(),z||Ae.destroy?.(),je&&Me.destroy?.(),Ne.destroy?.(),Pe.destroy?.(),Fe||Ie.destroy?.(),Le?.destroy?.(),Re.destroy?.())},Je=()=>{N&&Ln(N)};try{if(ce)k&&t.queue?.onSubmittedWorkDone?(t.queue.submit([Be.finish()]),Ge=!0,Je(),Ve=`queue-submitted`,He=`queue.submit`,await t.queue.onSubmittedWorkDone(),Ve=`queue-work-completed`,He=`queue.onSubmittedWorkDone`):(t.queue.submit([Be.finish()]),Ge=!0,Je(),Ve=t.queue?.onSubmittedWorkDone?`queue-submitted-gpu-handoff-no-cpu-fence`:`queue-submitted-no-explicit-completion`,He=t.queue?.onSubmittedWorkDone?`queue.submit(in-order-gpu-render-field-handoff)`:`queue.submit`,We=!!(t.queue?.onSubmittedWorkDone&&A)),Ue=new Float32Array;else{t.queue.submit([Be.finish()]),Ge=!0,Je(),Ve=`queue-submitted`,He=`queue.submit`;let e=await Oi(t,Ie,h.totalFieldCells*dn*Float32Array.BYTES_PER_ELEMENT,`ulg-sph-render-field-readback`);Ve=`readback-map-completed`,He=`mapAsync(readback-buffer)`,Ue=new Float32Array(e)}}catch(e){throw Ge?me(t,qe):qe(),e}if(!Fn(h,F))throw me(t,qe),TypeError(`render surface table mutated while its GPU field submission was in flight`);let Ye=!1,Xe=Le?Object.freeze({schema:fn,buffer:Le,byteLength:Se,rowCount:h.totalFieldCells,rowStrideFloats:4,rowStrideBytes:4*Float32Array.BYTES_PER_ELEMENT,fieldPadding:y,refEdgeM:x,sourceGenerationId:l?.sourceGenerationId??null,sourceVelocityLanes:Object.freeze([17,18,19]),momentWeight:`pre-smear-positive-particle-metaball-value`,immutable:!0,readback:!1,authoritativeStateMutation:!1,get destroyed(){return Ye},destroy(){return Ye?!1:(Ye=!0,Le.destroy?.(),!0)}}):null,Ze=!1,Qe=()=>{Ze||(Ze=!0,U||Oe.destroy?.(),W||ke.destroy?.(),z||Ae.destroy?.(),je&&Me.destroy?.(),Ne.destroy?.(),O||Pe.destroy?.(),!E&&!Fe&&Ie.destroy?.(),Re.destroy?.())},$e=!1;We&&M?$e=me(t,Qe):We?$e=!0:Qe();let et=_e({ledgerId:`sph-render-field:${h.surfaceCount}:${h.totalFieldCells}:buffer-leases`,stateKey:`sph-render-field`,scope:`sph-render-field-buffer-leases`}),tt=[],nt=({resourceKey:e,resourceKind:t,buffer:n,byteLength:r,rowCount:i,expectedConsumers:a=[]})=>{q(et,{resourceKey:e,resourceKind:t,stateFamily:`render-field`,ownerStage:`render-field-builder`,producerStage:`render-field-builder`,source:`buildSphRenderFieldWebGpu`,status:`resident-render-field-buffer-retained`,retained:!0,byteLength:r,rowCount:i,bufferLabel:n?.label,expectedConsumers:a});for(let t of a){let n=ye(et,{resourceKey:e,consumerStage:t,reason:`retained-render-field-buffer`});tt.push(n.leaseId)}},rt=`render-field:field-rows:${h.totalFieldCells}:${xe}`,it=`render-field:surface-table:${h.surfaceCount}:${h.records.byteLength}`;E&&nt({resourceKey:rt,resourceKind:`render-field-rows-buffer`,buffer:Ie,byteLength:xe,rowCount:h.totalFieldCells,expectedConsumers:[`material-interface-extraction`,`surface-vertex-extraction`]}),O&&nt({resourceKey:it,resourceKind:`render-field-surface-table-buffer`,buffer:Pe,byteLength:h.records.byteLength,rowCount:h.surfaceCount,expectedConsumers:[`surface-vertex-extraction`,`surface-draw-metadata`]});let J={schema:e,backend:`webgpu`,status:`render-field-built`,kernelScope:Zn,schroederSpatialLineageMode:l?`authenticated-successor`:`non-schroeder`,schroederSpatialSourceFamily:l,schroederSpatialSourceFamilyStatus:l?.status??null,schroederSpatialSourceFamilyRole:l?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:l?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:l?.successorEpochIdentity??null,particleCount:ne,dispersedMediumOpticsBound:V,dispersedMediumOpticsRowCount:V?ne:0,dispersedMediumOpticsAuthority:z?`same-device-resident-authority`:o?`host-exact-particle-aligned-rows`:`absent`,dispersedMediumOpticsBufferByteLength:V?ne*8*Float32Array.BYTES_PER_ELEMENT:0,productEventCount:W||u?L:0,productEventCountAuthority:G?`gpu-authored-filtered-live-prefix`:`host-exact-or-sparse-scan-bound`,productEventControlAuthentication:G?`full-eight-word-gpu-commit-gate`:`not-required-zero-control`,productEventControlHostObserved:G?.hostObserved??!1,productEventCountHostKnown:!G,productEventRowCapacity:G?.expectedRowCapacity??(W||u?L:0),productEventBufferBound:!!(W||u),productEventBufferByteLength:W||u?L*pn*Float32Array.BYTES_PER_ELEMENT:0,surfaceCount:h.surfaceCount,totalFieldCells:h.totalFieldCells,maxFieldCellCount:h.maxFieldCellCount,surfaceTable:h,rowLayout:[...f],rowStrideFloats:dn,fieldRows:Ue,fieldRowByteLength:xe,fieldPadding:y,refEdgeM:x,renderFieldInputSource:le,readbackMode:ce?$n:Qn,queueCompletionStatus:Ve,queueCompletionMethod:He,pipelineCacheStatus:ze,renderFieldDeferredCleanup:$e,renderFieldReadback:!ce,fullReadbackPerformed:!ce,normalHotLoopReadbackFree:ce,fieldRowsBufferRetained:!!E,fieldRowsBufferByteLength:E?xe:0,fieldRowsBufferBorrowed:Fe,fieldRowsBufferReused:Fe,fieldRowsBufferOwnedByResult:!Fe,motionField:Xe,motionFieldReadback:!1,surfaceBufferRetained:!!O,surfaceBufferByteLength:O?h.records.byteLength:0,residentBufferLeaseLedger:et,residentBufferLeaseSummary:ve(et),residentBufferLeaseLedgerStatus:et.status,residentBufferLeaseResourceCount:et.resourceCount,residentBufferLeaseActiveLeaseCount:et.activeLeaseCount,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};if(E&&(J.fieldRowsBuffer=Ie),O&&(J.surfaceBuffer=Pe),J.takeMotionField=()=>{let e=Xe;return Xe=null,J.motionField=null,e?.destroyed?null:e},E||O||D){let e=new Set,t=()=>(J.residentBufferLeaseSummary=ve(et),J.residentBufferLeaseLedgerStatus=J.residentBufferLeaseSummary.status,J.residentBufferLeaseResourceCount=J.residentBufferLeaseSummary.resourceCount,J.residentBufferLeaseActiveLeaseCount=J.residentBufferLeaseSummary.activeLeaseCount,J.residentBufferLeaseSummary);J.releaseRenderFieldBufferLeases=({status:e=`released`}={})=>{for(let t of tt)be(et,t,{status:e});return t()};let n=(t,n)=>{e.has(t)||(e.add(t),n?.destroy?.())};J.destroyRenderFieldBuffers=({force:e=!1,releaseLeases:r=!1,reason:i=`render-field-buffer-cleanup`}={})=>(Wn(J),Qe(),Xe?.destroy(),Xe=null,J.motionField=null,r&&J.releaseRenderFieldBufferLeases(),E&&ge(et,rt,()=>{Fe||n(rt,Ie)},{force:e,reason:i}),O&&ge(et,it,()=>{n(it,Pe)},{force:e,reason:i}),t())}return l&&(Mn.set(J,{active:!0,device:t,sourceFamily:l,particleCount:ne,renderRowsSource:i,renderRowsBuffer:U,renderRows:U?null:n,dispersedMediumOpticsBuffer:z,dispersedMediumOptics:a,dispersedMediumOpticsRows:o,dispersedMediumOpticsAuthority:B,dispersedMediumOpticsSourceAuthenticated:!!(z&&B&&a&&a===i?.dispersedMediumOptics),productEventBuffer:W,productEventRows:u,productEventSource:p,productEventLiveCountDescriptor:G,productEventSourceAuthenticated:!!(W&&G),productEventCount:W||u?L:0,productEventRowCapacity:G?.expectedRowCapacity??(W||u?L:0),productEventCountAuthority:G?`gpu-authored-filtered-live-prefix`:`host-exact-or-sparse-scan-bound`,productEventControlAuthentication:G?`full-eight-word-gpu-commit-gate`:`not-required-zero-control`,surfaceTable:h,surfaceRecords:h.records,surfaceTableSnapshot:F,surfaceBuffer:J.surfaceBuffer??null,fieldRowsBuffer:J.fieldRowsBuffer??null,fieldRows:J.fieldRows,fieldRowByteLength:xe,fieldRowsBufferByteLength:J.fieldRowsBufferByteLength,rowStrideFloats:dn,fieldPadding:y,refEdgeM:x}),J.fieldRowsBuffer&&In({buffer:J.fieldRowsBuffer,artifact:J,invalidate:()=>Wn(J)})),J}async function Ta({device:e,sphParticleState:t,mlsMpmParticleState:n=null,sphParticleUpload:r=null,mlsMpmParticleUpload:i=null,sourceStateBuffer:a=null,sourceThermoBuffer:o=null,sourceIdentityBuffer:s=null,sourceMechanicsBuffer:c=null,schroederSpatialSourceFamily:l=null,retainRenderRowsBuffer:d=!1,readbackMode:f=Qn,renderDomainBaseCount:p=0,renderDomainDropCount:m=0}={}){if(cr(t),!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`extractSphRenderRowsWebGpu requires a WebGPU-like device`);let h=hr(t.particleCount,`SPH render-row particleCount`),g=f===$n,_=a||r?.stateBuffer||null,v=o||r?.thermoBuffer||null,b=s||r?.identityBuffer||null,x=fr({device:e,sphParticleUpload:r,particleCount:h,identityBuffer:b});if(x&&!U(r,{device:e,stateBuffer:_,thermoBuffer:v,identityBuffer:b}))throw TypeError(`SPH render rows rejected dispersed-medium optics paired with foreign particle-aligned source buffers`);let S=n?.mechanics instanceof Float32Array&&n.mechanics.length>=h*B,C=c||i?.mechanicsBuffer||null;if(l){if(g&&!d)throw TypeError(`successor render rows require a retained GPU handoff buffer when full readback is disabled`);re(l,{device:e,particleCount:h,stateBuffer:_,thermoBuffer:v,identityBuffer:b,mechanicsBuffer:C})}let w=dr({sphParticleState:t,sphParticleUpload:r}),T=ur({sphParticleState:t,sphParticleUpload:r});if(w){let e=[_?null:`state`,v?null:`thermo`,T&&!C?`mechanics`:null,b?null:`identity`].filter(Boolean);if(e.length>0)throw TypeError(`SPH render rows require authoritative resident ${e.join(`, `)} buffers`);let n=r?.identitySchema||t?.identitySchema||null,i=Math.max(0,Math.round(Q(r?.identityStrideBytes??t?.identityStrideBytes,0))),a=Math.max(0,Math.round(Q(r?.identityBufferByteLength??b?.size??t?.identityBufferByteLength??t?.identity?.byteLength,0))),o=G*Uint32Array.BYTES_PER_ELEMENT;if(n!==`peercompute.ulg.sph-gpu-particle-identity-buffer.v0`)throw TypeError(`SPH render rows require the authoritative particle identity schema`);if(i!==o)throw TypeError(`SPH render rows require the authoritative particle identity stride`);if(a<h*o)throw RangeError(`SPH render rows require identity capacity for every resident particle`)}let E=t.materialPropertyBankParticleSizeTable?.rows,D=hr(t.materialPropertyBankParticleSizeTable?.rowCount??0,`packed material-bank particle-size row count`),k=r?.materialPropertyBankParticleSizeBuffer||null,A=k?hr(r?.materialPropertyBankParticleSizeRowCount??0,`resident material-bank particle-size row count`):0,j=k?A:E?.byteLength>0?D:0,M=h*L*Float32Array.BYTES_PER_ELEMENT,N=h*z*Float32Array.BYTES_PER_ELEMENT,ee=h*G*Uint32Array.BYTES_PER_ELEMENT,P=h*B*Float32Array.BYTES_PER_ELEMENT,F=C||S?P:B*Float32Array.BYTES_PER_ELEMENT,I=j*16*Float32Array.BYTES_PER_ELEMENT,te=j>0?I:16*Float32Array.BYTES_PER_ELEMENT,ne=h*ln*Float32Array.BYTES_PER_ELEMENT,ae=Math.ceil(h/64);if(di(e,`render rows`,ae),li(e,`ulg-sph-render-rows`,Math.max(4,ne)),ui(e,`ulg-sph-render-rows`,Math.max(4,ne)),mi(e,`render rows source state`,_,M),mi(e,`render rows source thermo`,v,N),mi(e,`render rows source identity`,b,ee),mi(e,`render rows source mechanics`,C,P),mi(e,`render rows material-bank particle-size rows`,k,I),!k&&j>0&&(!(E instanceof Float32Array)||E.byteLength<I))throw RangeError(`packed material-bank particle-size rows do not cover their advertised row count`);let R=new Set,V=e=>(e&&R.add(e),e),{stateBuffer:H,thermoBuffer:se,identityBuffer:W,mechanicsBuffer:le,materialBankParticleSizeBuffer:ue,renderRowsBuffer:de,useGpuHandoffBuffer:pe,retainedRenderRowsBuffer:he,maxSupportRadiusM:ge,maxGasRadiusM:_e,paramsBuffer:ve,encoder:ye}=(()=>{try{let r=_||V(ii(e,`ulg-sph-render-source-state`,t.state)),i=v||V(ii(e,`ulg-sph-render-source-thermo`,t.thermo)),a=b||V(ii(e,`ulg-sph-render-source-identity`,lr(t))),o=C||V(ii(e,S?`ulg-sph-render-source-mechanics`:`ulg-sph-render-source-mechanics-empty`,S?n.mechanics:new Float32Array(B))),s=k||V(ii(e,j>0?`ulg-sph-render-material-bank-particle-size-rows`:`ulg-sph-render-material-bank-particle-size-rows-empty`,j>0&&E?.byteLength>0?E:new Float32Array(16))),c=V(ai(e,`ulg-sph-render-rows`,ne,Z.COPY_SRC)),l=g&&d&&ne>0,u=l?V(e.createBuffer({label:`ulg-sph-render-rows-retained-handoff`,size:Math.max(4,ne),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST})):c,f=Q(t.smoothingLengthM,0)*Gn,x=Q(t.smoothingLengthM,0)*Kn,w=V(e.createBuffer({label:`ulg-sph-render-rows-params`,size:qn,usage:Z.UNIFORM|Z.COPY_DST}));e.queue.writeBuffer(w,0,bi({particleCount:h,renderDomainBaseCount:p,renderDomainDropCount:m,hasMechanics:!!(C||S),maxSupportRadiusM:f,maxGasRadiusM:x,materialBankParticleSizeRowCount:j}));let{pipeline:T,bindGroupLayout:D}=fe(e,{cacheKey:`ulg-sph-render-rows-v1`,label:`ulg-sph-render-rows`,code:y,entryPoint:`main`,bindings:[K(0,`read-only-storage`),K(1,`read-only-storage`),K(2,`storage`),K(3,`uniform`),K(4,`read-only-storage`),K(5,`read-only-storage`),K(6,`read-only-storage`)]}),O=e.createBindGroup({layout:D,entries:[{binding:0,resource:hi(r,M,{label:`render rows source state`})},{binding:1,resource:hi(i,N,{label:`render rows source thermo`})},{binding:2,resource:hi(c,ne,{label:`render rows output`})},{binding:3,resource:{buffer:w}},{binding:4,resource:hi(o,F,{label:`render rows source mechanics`})},{binding:5,resource:hi(s,te,{label:`render rows material-bank particle-size rows`})},{binding:6,resource:hi(a,ee,{label:`render rows source identity`})}]}),A=e.createCommandEncoder(),P=A.beginComputePass();return P.setPipeline(T),P.setBindGroup(0,O),P.dispatchWorkgroups(ae),P.end(),l&&A.copyBufferToBuffer(c,0,u,0,ne),{stateBuffer:r,thermoBuffer:i,identityBuffer:a,mechanicsBuffer:o,materialBankParticleSizeBuffer:s,renderRowsBuffer:c,useGpuHandoffBuffer:l,retainedRenderRowsBuffer:u,maxSupportRadiusM:f,maxGasRadiusM:x,paramsBuffer:w,encoder:A}}catch(e){for(let e of R)e.destroy?.();throw e}})(),q,be=`not-submitted`,xe=null,Se=!1,Ce=null,we=null,Te=null,Ee=!1,De=()=>{if(Ee)return;Ee=!0,Te?.(),Te=null;let t=Ce??we;t&&ie(l,t,{device:e}),Ce=null,we=null;let n=new Set([_?null:H,v?null:se,b?null:W,C?null:le,k?null:ue,de,he,ve]);for(let e of n)e?.destroy?.()};try{x&&(Te=ce(e,x)),l&&(Ce=oe(l,{device:e,consumerStage:`sph-render-rows-gpu-submission`}))}catch(e){throw De(),e}try{e.queue.submit([ye.finish()])}catch(e){throw De(),e}if(Ce){let t=Ce;Ce=null,d?we=t:me(e,()=>{ie(l,t,{device:e})})}try{if(g)d?(be=`queue-submitted-gpu-handoff-no-cpu-fence`,xe=pe?`queue.submit(in-order-gpu-copy-handoff)`:`queue.submit(in-order-gpu-buffer-handoff)`,Se=!0):e.queue?.onSubmittedWorkDone?(await e.queue.onSubmittedWorkDone(),be=`queue-work-completed`,xe=`queue.onSubmittedWorkDone`):(be=`queue-submitted`,xe=`queue.submit`),q=new Float32Array;else{be=`queue-submitted`,xe=`queue.submit`;let t=await Oi(e,de,ne);q=new Float32Array(t),be=`readback-map-completed`,xe=`mapAsync(readback-buffer)`}}catch(t){throw me(e,De),t}let Oe=null,ke=!1,Ae=[],je=()=>{for(let e of Ae)e?.destroy?.();Ae.length=0},Me=()=>{ke||(ke=!0,Oe&&Hn(Oe),je(),he.destroy?.(),Te?.(),Te=null,we&&=(ie(l,we,{device:e}),null))},Ne=e=>{e?.destroy&&(Se?Ae.push(e):e.destroy())};_||Ne(H),v||Ne(se),b||Ne(W),C||Ne(le),k||Ne(ue),pe&&Ne(de),d||Me(),Ne(ve);let Pe={schema:u,backend:`webgpu`,status:`render-rows-extracted`,kernelScope:Xn,particleCount:t.particleCount,dispersedMediumOptics:x,dispersedMediumOpticsBound:!!x,dispersedMediumOpticsRowCount:x?.rowCount??0,dispersedMediumOpticsRowStrideFloats:x?.rowStrideFloats??0,dispersedMediumOpticsBufferByteLength:x?.bufferByteLength??0,dispersedMediumOpticsSource:x?`exact-sph-particle-upload-child`:`absent`,dispersedMediumOpticsHostReadback:!1,schroederSpatialSourceFamily:l,schroederSpatialSourceFamilyStatus:l?.status??null,schroederSpatialSourceFamilyRole:l?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:l?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:l?.successorEpochIdentity??null,schroederSpatialSourceFamilyAncestorGenerationId:l?.ancestorSpatialGenerationId??null,schroederSpatialSourceFamilyPositionAuthority:l?.positionAuthority??null,schroederSpatialSourceFamilySpatialQueryAuthority:l?.spatialQueryAuthority??null,schroederSpatialSourceFamilyPositionEpoch:l?.positionEpoch??null,schroederSpatialSourceFamilyTopologyEpoch:l?.topologyEpoch??null,rowLayout:[...O],rowStrideFloats:ln,renderRows:q,renderRowByteLength:ne,renderRowsReadbackByteLength:q.byteLength,renderRowsBufferRetained:!!d,renderRowsBufferByteLength:ne,readbackMode:g?$n:Qn,renderRowsReadback:!g,compactRenderReadback:!g,fullReadbackPerformed:!g,normalHotLoopReadbackFree:g,renderRowsIncludeMechanicsVolume:!!(C||S),renderRowsIncludeParticleIdentity:!0,particleIdentityBufferSource:b?s?`explicit-source-buffer`:`sph-particle-upload`:`packed-sph-particle-state`,residentParticleAuthorityRequired:w,particleIdentityStrideUints:G,materialPropertyBankParticleSizeConsumer:xi({rowCount:j,bufferSource:k?`sph-particle-upload`:j>0?`packed-sph-particle-state`:`empty-buffer`}),renderRowsGpuHandoffCopy:pe,renderRowsHandoffMode:pe?`gpu-copy-barrier`:`direct-render-row-buffer`,queueCompletionStatus:be,queueCompletionMethod:xe,renderRowsDeferredCleanup:Se,particleScaleStability:ti({particleCount:t.particleCount,rowProducer:`webgpu-shader`,maxSupportRadiusM:ge,maxGasRadiusM:_e}),scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};if(d&&(Pe.renderRowsBuffer=he,Pe.renderRowsBufferOwned=!0,Pe.destroyRenderRowsBuffer=Me),l||x){let n={active:!0,device:e,sourceFamily:l,particleCount:t.particleCount,renderRowsBuffer:Pe.renderRowsBuffer??null,renderRows:Pe.renderRows,renderRowValues:Pe.renderRowsBuffer==null?Object.freeze(Array.from(Pe.renderRows)):null,dispersedMediumOptics:x,dispersedMediumOpticsBuffer:x?.buffer??null,dispersedMediumOpticsAuthority:x?.authority??null,rowStrideFloats:Pe.rowStrideFloats,rowLayout:Object.freeze([...Pe.rowLayout])};if(An.set(Pe,n),Oe=Pe,n.renderRowsBuffer){let e=jn.get(n.renderRowsBuffer);e&&e!==Pe&&Hn(e),jn.set(n.renderRowsBuffer,Pe)}}return Pe}var Ea=Object.freeze({STORAGE:128,UNIFORM:64,COPY_DST:8}),Da=new WeakMap;function Oa(e){let t=Da.get(e);return t||(t=e.createBuffer({label:`ulg-solid-isosurface-dummy-thermo`,size:16,usage:Ea.STORAGE|Ea.COPY_DST}),Da.set(e,t)),t}var ka=`
struct SolidFieldParams {
  // member_count, resolution, field_offset, has_thermo
  counts: vec4<u32>,
  // field_padding, ref_edge_m, isovalue, subtract
  field0: vec4<f32>,
  // strength, particle_radius_scale, default_temperature_k, unused
  field1: vec4<f32>,
  // color.rgb, unused
  color: vec4<f32>,
  // body bitmask words (supports up to 128 rigid bodies per family; all 0 = all bodies)
  body_mask: vec4<u32>,
};

@group(0) @binding(0) var<uniform> params: SolidFieldParams;
@group(0) @binding(1) var<storage, read> frames: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> members: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> lattice: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> member_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> field_rows: array<f32>;

const PI: f32 = 3.141592653589793;
const CELL_FLOATS: u32 = 8u;

fn quat_rotate(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

fn smooth_palette_weight(ratio: f32) -> f32 {
  let t = clamp(1.0 - ratio, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

fn body_in_mask(body: u32, mask: vec4<u32>) -> bool {
  if ((mask.x | mask.y | mask.z | mask.w) == 0u) { return true; }
  let word = body >> 5u;
  let bit = 1u << (body & 31u);
  if (word == 0u) { return (mask.x & bit) != 0u; }
  if (word == 1u) { return (mask.y & bit) != 0u; }
  if (word == 2u) { return (mask.z & bit) != 0u; }
  if (word == 3u) { return (mask.w & bit) != 0u; }
  return false;
}

@compute @workgroup_size(64)
fn splat_rigid_solid_isosurface(@builtin(global_invocation_id) id: vec3<u32>) {
  let resolution = params.counts.y;
  let cell_index = id.x;
  let total_cells = resolution * resolution * resolution;
  if (cell_index >= total_cells) { return; }

  let xy = resolution * resolution;
  let z = cell_index / xy;
  let rem = cell_index - z * xy;
  let y = rem / resolution;
  let x = rem - y * resolution;
  let inv_resolution = 1.0 / f32(resolution);
  let cell = vec3<f32>(f32(x), f32(y), f32(z)) * inv_resolution;

  let padding = params.field0.x;
  let span = 1.0 - 2.0 * padding;
  let ref_edge = max(params.field0.y, 1.0e-12);
  let isovalue = params.field0.z;
  let subtract = max(params.field0.w, 1.0e-12);
  let strength = params.field1.x;
  let particle_radius_scale = max(params.field1.y, 0.0);
  let default_temp = params.field1.z;
  let particle_radius_norm_scale = particle_radius_scale * span / ref_edge;
  let particle_radius_floor_norm = select(
    0.0,
    sqrt(0.75 * inv_resolution * inv_resolution + 0.000001),
    particle_radius_scale > 0.0
  );
  let color = params.color.xyz;

  var density = 0.0;
  var palette = vec3<f32>(0.0);
  var temp_weighted = 0.0;
  var temp_weight = 0.0;

  let member_count = params.counts.x;
  let has_thermo = params.counts.w != 0u;
  let mask = params.body_mask;

  for (var m = 0u; m < member_count; m = m + 1u) {
    let m0 = members[m * 2u];
    if (!(m0.w > 0.0)) { continue; }
    let body = bitcast<u32>(members[m * 2u + 1u].x);
    if (!body_in_mask(body, mask)) { continue; }
    let base = body * 8u;
    let f0 = frames[base];
    let q = frames[base + 1u];
    let world = f0.xyz + quat_rotate(q, m0.xyz);
    let particle = vec3<f32>(
      clamp(padding + (world.x / ref_edge) * span, 0.001, 0.999),
      clamp(padding + (world.y / ref_edge) * span, 0.001, 0.999),
      clamp(padding + (world.z / ref_edge) * span, 0.001, 0.999)
    );
    let delta = cell - particle;
    let dist2 = dot(delta, delta);
    let pitch = max(lattice[body * 4u + 3u].xyz, vec3<f32>(1.0e-9));
    let member_radius_m = pow((0.75 / PI) * pitch.x * pitch.y * pitch.z, 1.0 / 3.0);
    let particle_radius_norm = select(
      0.0,
      max(member_radius_m * particle_radius_norm_scale, particle_radius_floor_norm),
      particle_radius_scale > 0.0
    );
    let member_strength = select(
      strength,
      (isovalue + subtract) * particle_radius_norm * particle_radius_norm,
      particle_radius_norm > 0.0
    );
    let support_norm = sqrt(max(member_strength, 0.0) / subtract);
    let value = member_strength / (0.000001 + dist2) - subtract;
    if (value > 0.0) {
      density = density + value;
      let ratio = sqrt(dist2) / max(support_norm, 1.0e-6);
      palette = palette + color * smooth_palette_weight(ratio);
      let member_temp = select(default_temp, member_thermo[m].y, has_thermo);
      temp_weighted = temp_weighted + member_temp * value;
      temp_weight = temp_weight + value;
    }
  }

  if (!(density > 0.0)) { return; }
  let row = (params.counts.z + cell_index) * CELL_FLOATS;
  let prior_density = max(field_rows[row], 0.0);
  let prior_temp = field_rows[row + 4u];
  let total_density = prior_density + density;
  field_rows[row] = total_density;
  field_rows[row + 1u] = field_rows[row + 1u] + palette.x;
  field_rows[row + 2u] = field_rows[row + 2u] + palette.y;
  field_rows[row + 3u] = field_rows[row + 3u] + palette.z;
  if (temp_weight > 0.0) {
    let added_temp = temp_weighted / temp_weight;
    field_rows[row + 4u] = select(
      added_temp,
      (prior_temp * prior_density + added_temp * density) / max(total_density, 1.0e-6),
      prior_density > 0.0 && prior_temp > 0.0
    );
  }
}
`;function Aa({device:e,encoder:t,family:n,renderField:r}={}){if(!e||!t||!n||n.destroyed||n.device!==e||!(n.memberCount>0)||!n.frameBuffer||!n.memberBuffer||!n.latticeBuffer||!r?.fieldRowsBuffer||!Array.isArray(r?.surfaceTable?.metadata))return null;let i=Number(r.refEdgeM),a=Number(r.fieldPadding);if(!(i>0)||!Number.isFinite(a))return null;let o=Array.isArray(n.materials)&&n.materials.length>0?n.materials:[null],s=new Map;for(let e=0;e<o.length;e+=1){let t=o[e],r=e===0&&Number(n.thermal?.materialId)>0?Number(n.thermal.materialId):t?se(t):0;if(!(r>0))continue;let i=s.get(r);i||(i={materialId:r,materialKey:t,bodyIndices:[],usesFamilyThermal:e===0&&!!n.thermalStage?.thermoBuffer},s.set(r,i)),i.bodyIndices.push(e),e===0&&n.thermalStage?.thermoBuffer&&(i.usesFamilyThermal=!0)}if(s.size===0)return null;let c=fe(e,{cacheKey:`ulg-solid-isosurface-field-splat.v2`,label:`ulg-solid-isosurface-field-splat`,code:ka,entryPoint:`splat_rigid_solid_isosurface`,bindings:[K(0,`uniform`),K(1,`read-only-storage`),K(2,`read-only-storage`),K(3,`read-only-storage`),K(4,`read-only-storage`),K(5,`storage`)]}),l=[];for(let o of s.values()){let u=r.surfaceTable.metadata.find(e=>Number(e?.materialId)===o.materialId&&Number(e?.phaseId)===1&&Number(e?.opticalStateId||0)===0);if(!u)continue;let d=Math.floor(Number(u.resolution)||0),f=Math.floor(Number(u.fieldOffset)||0);if(!(d>0))continue;let p=Number(u.isolation)||.25,m=Number(u.subtract)||12,h=Number(u.strength)||.02,g=Number(u.particleRadiusScale)>0?Number(u.particleRadiusScale):0,_=Array.isArray(u.colorLinear)&&u.colorLinear.length>=3?u.colorLinear:[.78,.9,.98],v=o.usesFamilyThermal&&!!n.thermalStage?.thermoBuffer,y=v?n.thermalStage.thermoBuffer:Oa(e),b=o.bodyIndices[0]??0,x=Number(n.bodyTemperaturesK?.[b]),S=Number.isFinite(x)&&x>0?x:Number(n.thermal?.meltTemperatureK)?Math.min(273.15,Number(n.thermal.meltTemperatureK)-10):273.15,C=[0,0,0,0];if(s.size>1)for(let e of o.bodyIndices){let t=e>>>5;t<4&&(C[t]=(C[t]|1<<(e&31))>>>0)}let w=e.createBuffer({label:`ulg-solid-isosurface-field-splat-params-${o.materialId}`,size:80,usage:Ea.UNIFORM|Ea.COPY_DST}),T=new ArrayBuffer(80),E=new Uint32Array(T),D=new Float32Array(T);E.set([n.memberCount,d,f,+!!v],0),D.set([a,i,p,m],4),D.set([h,g,S,0],8),D.set([Number(_[0])||.78,Number(_[1])||.9,Number(_[2])||.98,0],12),E.set(C,16),e.queue.writeBuffer(w,0,T);let O=e.createBindGroup({layout:c.bindGroupLayout,entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:n.frameBuffer}},{binding:2,resource:{buffer:n.memberBuffer}},{binding:3,resource:{buffer:n.latticeBuffer}},{binding:4,resource:{buffer:y}},{binding:5,resource:{buffer:r.fieldRowsBuffer}}]}),k=t.beginComputePass({label:`ulg-solid-isosurface-field-splat-${o.materialId}`});k.setPipeline(c.pipeline),k.setBindGroup(0,O),k.dispatchWorkgroups(Math.ceil(d**3/64)),k.end(),l.push(w)}return l.length===0?null:l.length===1?l[0]:{surfaceCount:l.length,destroy(){for(let e of l)try{e.destroy()}catch{}}}}var ja=O.length;p.length;var Ma=f.length,Na=o.length,Pa=`full-parity-readback`,Fa=`no-full-readback`,Ia=`sph-resident-material-interface-source-local-splat`,La=1024,Ra=new WeakMap;function za(e,{device:t,sourceFamily:n,particleCount:r,fieldRowsBuffer:i=null,fieldRows:a=null,surfaceBuffer:o=null,surfaceTable:s=null}={}){let c=Ra.get(e);return!!(c&&c.active===!0&&c.device===t&&c.sourceFamily===n&&c.particleCount===r&&e?.schroederSpatialSourceFamily===c.sourceFamily&&e?.particleCount===c.particleCount&&(e?.fieldRowsBuffer??null)===c.fieldRowsBuffer&&e?.fieldRows===c.fieldRows&&(e?.surfaceBuffer??null)===c.surfaceBuffer&&e?.surfaceTable===c.surfaceTable&&e?.rowStrideFloats===c.rowStrideFloats&&e?.fieldRowByteLength===c.fieldRowByteLength&&e?.fieldRowsBufferByteLength===c.fieldRowsBufferByteLength&&e?.fieldPadding===c.fieldPadding&&e?.refEdgeM===c.refEdgeM&&e?.productEventCount===0&&e?.productEventBufferBound===!1&&Fn(e?.surfaceTable,c.surfaceTableSnapshot)&&(i==null||c.fieldRowsBuffer===i)&&(a==null||c.fieldRows===a)&&(o==null||c.surfaceBuffer===o)&&(s==null||c.surfaceTable===s)&&(c.fieldRowsBuffer==null||Rn(c.fieldRowsBuffer,e)))}function Ba(e){let t=Ra.get(e);!t||t.active!==!0||(t.active=!1,t.fieldRowsBuffer&&zn(t.fieldRowsBuffer,e))}var Va={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},Ha={READ:globalThis.GPUMapMode?.READ??1},Ua=`
struct SourceFieldParams {
  particle_count: u32,
  surface_count: u32,
  total_field_cells: u32,
  product_event_count: u32,
  field_padding: f32,
  ref_edge_m: f32,
  density_scale: f32,
  source_count: u32,
};

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> density_accum: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params: SourceFieldParams;
@group(0) @binding(4) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> source_index_accum: array<atomic<u32>>;

const RENDER_ROW_VEC4_STRIDE: u32 = 5u;
const PRODUCT_EVENT_VEC4_STRIDE: u32 = 8u;

fn render_row0(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE];
}

fn render_row1(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE + 1u];
}

fn render_row2(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE + 2u];
}

fn surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn product_event_row0(event_index: u32) -> vec4<f32> {
  return product_events[event_index * PRODUCT_EVENT_VEC4_STRIDE];
}

fn product_event_row1(event_index: u32) -> vec4<f32> {
  return product_events[event_index * PRODUCT_EVENT_VEC4_STRIDE + 1u];
}

fn product_event_row2(event_index: u32) -> vec4<f32> {
  return product_events[event_index * PRODUCT_EVENT_VEC4_STRIDE + 2u];
}

fn product_event_row3(event_index: u32) -> vec4<f32> {
  return product_events[event_index * PRODUCT_EVENT_VEC4_STRIDE + 3u];
}

fn product_event_row4(event_index: u32) -> vec4<f32> {
  return product_events[event_index * PRODUCT_EVENT_VEC4_STRIDE + 4u];
}

fn normalized_position(position_m: vec3<f32>) -> vec3<f32> {
  let span = 1.0 - 2.0 * params.field_padding;
  let ref_edge = max(params.ref_edge_m, 1.0e-12);
  return vec3<f32>(
    clamp(params.field_padding + (position_m.x / ref_edge) * span, 0.001, 0.999),
    clamp(params.field_padding + (position_m.y / ref_edge) * span, 0.001, 0.999),
    clamp(params.field_padding + (position_m.z / ref_edge) * span, 0.001, 0.999)
  );
}

fn source_matches_domain(source_domain_id: f32, surface_domain_id: f32) -> bool {
  let surface_domain = max(surface_domain_id, 0.0);
  return surface_domain <= 0.0 || source_domain_id == surface_domain;
}

fn quantized_density(value: f32) -> u32 {
  return u32(clamp(value * params.density_scale, 0.0, 4294967040.0));
}

fn field_index_3d(x: u32, y: u32, z: u32, resolution: u32) -> u32 {
  return z * resolution * resolution + y * resolution + x;
}

fn splat_source(
  position: vec3<f32>,
  surface_index: u32,
  surface0: vec4<f32>,
  surface1: vec4<f32>,
  source_key: u32
) {
  let field_offset = u32(surface0.z);
  let field_cell_count = u32(surface0.w);
  let resolution = max(u32(surface1.x), 1u);
  let subtract = max(surface1.z, 1.0e-12);
  let strength = surface1.w;
  let support_norm = sqrt(abs(strength) / subtract);
  let radius_cells = min(i32(resolution) - 1, i32(ceil(support_norm * f32(resolution))) + 1);
  let center = vec3<i32>(
    i32(clamp(floor(position.x * f32(resolution)), 0.0, f32(resolution - 1u))),
    i32(clamp(floor(position.y * f32(resolution)), 0.0, f32(resolution - 1u))),
    i32(clamp(floor(position.z * f32(resolution)), 0.0, f32(resolution - 1u)))
  );

  for (var dz = -radius_cells; dz <= radius_cells; dz = dz + 1) {
    let z_i = center.z + dz;
    if (z_i < 0 || z_i >= i32(resolution)) {
      continue;
    }
    for (var dy = -radius_cells; dy <= radius_cells; dy = dy + 1) {
      let y_i = center.y + dy;
      if (y_i < 0 || y_i >= i32(resolution)) {
        continue;
      }
      for (var dx = -radius_cells; dx <= radius_cells; dx = dx + 1) {
        let x_i = center.x + dx;
        if (x_i < 0 || x_i >= i32(resolution)) {
          continue;
        }
        let cell = vec3<f32>(
          f32(x_i) / f32(resolution),
          f32(y_i) / f32(resolution),
          f32(z_i) / f32(resolution)
        );
        let delta = cell - position;
        let dist2 = dot(delta, delta);
        let value = strength / (0.000001 + dist2) - subtract;
        if (value <= 0.0) {
          continue;
        }
        let local_cell = field_index_3d(u32(x_i), u32(y_i), u32(z_i), resolution);
        if (local_cell >= field_cell_count) {
          continue;
        }
        let out_index = field_offset + local_cell;
        if (out_index < params.total_field_cells) {
          atomicAdd(&density_accum[out_index], quantized_density(value));
          if (source_key > 0u) {
            let _source_claim = atomicCompareExchangeWeak(&source_index_accum[out_index], 0u, source_key);
          }
        }
      }
    }
  }
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let source_index = global_id.x;
  let surface_index = global_id.y;
  if (source_index >= params.source_count || surface_index >= params.surface_count) {
    return;
  }

  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let material_id = s0.x;
  let phase_id = s0.y;
  let render_domain_id = max(render_surfaces[surface_index * 4u + 3u].x, 0.0);

  if (source_index < params.particle_count) {
    let row0 = render_row0(source_index);
    let row1 = render_row1(source_index);
    let row2 = render_row2(source_index);
    if (row1.x != material_id || row1.y != phase_id || !source_matches_domain(row2.w, render_domain_id)) {
      return;
    }
    splat_source(normalized_position(row0.xyz), surface_index, s0, s1, source_index + 1u);
    return;
  }

  let event_index = source_index - params.particle_count;
  if (event_index >= params.product_event_count) {
    return;
  }
  let event0 = product_event_row0(event_index);
  let event1 = product_event_row1(event_index);
  let event2 = product_event_row2(event_index);
  let event3 = product_event_row3(event_index);
  let event4 = product_event_row4(event_index);
  let event_material_id = event1.x;
  let event_phase_id = event2.w;
  let event_unplaced_mass_kg = event3.y;
  let event_status = event4.z;
  if (
    event_status != 1.0
    || event_unplaced_mass_kg <= 0.0
    || event_material_id != material_id
    || (event_phase_id > 0.0 && event_phase_id != phase_id)
  ) {
    return;
  }
  splat_source(normalized_position(event0.xyz), surface_index, s0, s1, 0u);
}
`,Wa=`
struct SourceFieldParams {
  particle_count: u32,
  surface_count: u32,
  total_field_cells: u32,
  product_event_count: u32,
  field_padding: f32,
  ref_edge_m: f32,
  density_scale: f32,
  source_count: u32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> density_accum: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> render_field_cells: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: SourceFieldParams;

fn surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn surface_row2(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 2u];
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let cell_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }
  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let s2 = surface_row2(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  if (cell_index >= field_cell_count) {
    return;
  }
  let out_index = field_offset + cell_index;
  if (out_index >= params.total_field_cells) {
    return;
  }
  let density = f32(atomicLoad(&density_accum[out_index])) / max(params.density_scale, 1.0);
  let color = select(vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(s2.y, s2.z, s2.w), density > 0.0);
  // Two vec4 lanes per cell (see SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT); the
  // physics material-interface source field carries no temperature.
  render_field_cells[out_index * 2u] = vec4<f32>(density, color);
  render_field_cells[out_index * 2u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
}
`;function Ga(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function Ka(e){if(e?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`||!(e.records instanceof Float32Array))throw TypeError(`source-local material-interface field requires a render-field surface table`)}function qa(e,t,n,r=0){let i=Math.max(4,n.byteLength),a=e.createBuffer({label:t,size:i,usage:Va.STORAGE|Va.COPY_DST|r});return n.byteLength>0&&e.queue.writeBuffer(a,0,n),a}function Ja(e,t,n,r=0){return e.createBuffer({label:t,size:Math.max(4,n),usage:Va.STORAGE|Va.COPY_DST|r})}function Ya({particleCount:e,productEventCount:t,surfaceCount:n,totalFieldCells:r,fieldPadding:i,refEdgeM:a,densityScale:o,sourceCount:s}){let c=new ArrayBuffer(32),l=new DataView(c);return l.setUint32(0,e,!0),l.setUint32(4,n,!0),l.setUint32(8,r,!0),l.setUint32(12,t,!0),l.setFloat32(16,i,!0),l.setFloat32(20,a,!0),l.setFloat32(24,o,!0),l.setUint32(28,s,!0),c}async function Xa(e,t,n,r=`ulg-sph-material-interface-source-local-readback`){let i=e.createBuffer({label:r,size:Math.max(4,n),usage:Va.COPY_DST|Va.MAP_READ}),a=e.createCommandEncoder();a.copyBufferToBuffer(t,0,i,0,Math.max(4,n)),e.queue.submit([a.finish()]),await i.mapAsync(Ha.READ);let o=i.getMappedRange().slice(0,n);return i.unmap(),i.destroy?.(),o}function Za(e,t){let n=Math.max(0,Math.round(Ga(t,0))),r=0;for(let t of e.metadata||[]){let e=Math.max(1,Math.round(Ga(t.resolution,1))),i=Math.max(0,Math.round(Ga(t.fieldCellCount,e**3))),a=Math.max(1e-12,Ga(t.subtract,1e-12)),o=Math.sqrt(Math.abs(Ga(t.strength,0))/a),s=Math.min(e-1,Math.ceil(o*e)+1);r+=Math.min(i,(s*2+1)**3)*n}let i=Math.max(0,Math.round(Ga(e.totalFieldCells,0)))*n;return{sourceCount:n,estimatedCellVisits:r,denseCellParticlePairs:i,estimatedVisitRatio:i>0?r/i:0}}async function Qa({device:t,renderRows:n,renderRowsBuffer:r=null,renderRowsSource:i=null,schroederSpatialSourceFamily:a=i?.schroederSpatialSourceFamily??null,productEventRows:o=null,productEventBuffer:s=null,surfaceTable:c,particleCount:l=null,productEventCount:u=null,fieldPadding:d=.22,refEdgeM:p=10,readbackMode:m=Fa,retainFieldRowsBuffer:h=!0,retainSurfaceBuffer:g=!0,retainSourceIndexFieldBuffer:_=!0,waitForQueueCompletion:v=!1,deferCleanup:y=!0,useQueueFenceForCleanup:b=!0,targetFieldRowsBuffer:x=null,targetFieldRowsBufferByteLength:S=null,source:C=`resident-physics-material-interface-source-field`,sourceCadence:w=`resident-physics-stage`}={}){if(!t?.createBuffer||!t.queue?.writeBuffer)throw TypeError(`buildSphMaterialInterfaceSourceFieldLocalWebGpu requires a WebGPU-like device`);if(!r&&!(n instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceSourceFieldLocalWebGpu requires renderRows or renderRowsBuffer`);if(n&&n.length%ja!==0)throw RangeError(`SPH render rows length must align to the render row stride`);if(o&&(!(o instanceof Float32Array)||o.length%Na!==0))throw RangeError(`SPH product-event rows length must align to the product-event row stride`);Ka(c);let T=Math.max(0,Math.round(Ga(l??(n?.length?n.length/ja:0),0))),E=Math.max(0,Math.round(Ga(u??(o?.length?o.length/Na:0),0)));if(a){if(i?.schroederSpatialSourceFamily!==a||i?.particleCount!==T||r==null||r&&i?.renderRowsBuffer!==r||E!==0||s!=null||o!=null)throw TypeError(`source-local field requires the exact render-row artifact derived from its successor source family`);if(re(a,{device:t,particleCount:T}),!Bn(i,{device:t,sourceFamily:a,particleCount:T,renderRowsBuffer:r,renderRows:r?null:n}))throw TypeError(`source-local field requires module-authenticated successor render rows`)}let O=T+(s||o?E:0),k=m===Fa,A=c.totalFieldCells*Ma*Float32Array.BYTES_PER_ELEMENT,j=c.totalFieldCells*Uint32Array.BYTES_PER_ELEMENT,M=x?Math.max(0,Math.round(Ga(S??x.size??x.byteLength??0,0))):0,N=x?Math.max(0,Math.round(Ga(x.size??x.byteLength??x.byteLengthBytes??0,0))):0;if(x&&N<=0)throw RangeError(`targetFieldRowsBuffer must expose its actual GPU buffer capacity`);if(x&&N>0&&M>N)throw RangeError(`targetFieldRowsBufferByteLength (${M}) exceeds the actual GPU buffer capacity (${N})`);let ee=N>0?Math.min(M,N):M;if(x&&ee<A)throw RangeError(`targetFieldRowsBuffer is too small (${ee}) for source-local material-interface field (${A})`);let P=r||null,F=s||null,I=!!x,te=P||qa(t,`ulg-sph-material-interface-source-local-render-rows`,n,Va.COPY_SRC),ne=F||qa(t,`ulg-sph-material-interface-source-local-product-events`,o||new Float32Array(Na),Va.COPY_SRC),ae=qa(t,`ulg-sph-material-interface-source-local-surfaces`,c.records,Va.COPY_SRC),L=Ja(t,`ulg-sph-material-interface-source-local-density-atomic`,c.totalFieldCells*Uint32Array.BYTES_PER_ELEMENT,Va.COPY_SRC),R=Ja(t,`ulg-sph-material-interface-source-local-source-index-atomic`,c.totalFieldCells*Uint32Array.BYTES_PER_ELEMENT,Va.COPY_SRC),z=x||Ja(t,`ulg-sph-material-interface-source-local-field-cells`,c.totalFieldCells*Ma*Float32Array.BYTES_PER_ELEMENT,Va.COPY_SRC),B=t.createBuffer({label:`ulg-sph-material-interface-source-local-params`,size:32,usage:Va.UNIFORM|Va.COPY_DST});t.queue.writeBuffer(B,0,Ya({particleCount:T,productEventCount:F||o?E:0,surfaceCount:c.surfaceCount,totalFieldCells:c.totalFieldCells,fieldPadding:d,refEdgeM:p,densityScale:La,sourceCount:O}));let V=fe(t,{cacheKey:`ulg-sph-material-interface-source-local-splat-v1`,label:`ulg-sph-material-interface-source-local-splat`,code:Ua,entryPoint:`main`,bindings:[K(0,`read-only-storage`),K(1,`read-only-storage`),K(2,`storage`),K(3,`uniform`),K(4,`read-only-storage`),K(5,`storage`)]}),H=t.createBindGroup({layout:V.bindGroupLayout,entries:[{binding:0,resource:{buffer:te}},{binding:1,resource:{buffer:ae}},{binding:2,resource:{buffer:L}},{binding:3,resource:{buffer:B}},{binding:4,resource:{buffer:ne}},{binding:5,resource:{buffer:R}}]}),se=fe(t,{cacheKey:`ulg-sph-material-interface-source-local-resolve-v1`,label:`ulg-sph-material-interface-source-local-resolve`,code:Wa,entryPoint:`main`,bindings:[K(0,`read-only-storage`),K(1,`storage`),K(2,`storage`),K(3,`uniform`)]}),ce=t.createBindGroup({layout:se.bindGroupLayout,entries:[{binding:0,resource:{buffer:ae}},{binding:1,resource:{buffer:L}},{binding:2,resource:{buffer:z}},{binding:3,resource:{buffer:B}}]}),U=t.createCommandEncoder(),W=U.beginComputePass();W.setPipeline(V.pipeline),W.setBindGroup(0,H),W.dispatchWorkgroups(Math.max(1,Math.ceil(Math.max(1,O)/64)),Math.max(1,c.surfaceCount)),W.end();let G=U.beginComputePass();G.setPipeline(se.pipeline),G.setBindGroup(0,ce),G.dispatchWorkgroups(Math.max(1,Math.ceil(Math.max(1,c.maxFieldCellCount)/64)),Math.max(1,c.surfaceCount)),G.end();let le=`not-submitted`,ue=null,de=new Float32Array,pe=!1,he=null;a&&(he=oe(a,{device:t,consumerStage:`sph-material-interface-source-field-gpu-submission`}));try{t.queue.submit([U.finish()])}catch(e){throw he&&=(ie(a,he,{device:t}),null),e}if(x&&Ln(x),he){let e=he;he=null,me(t,()=>{ie(a,e,{device:t})})}if(k)v&&t.queue?.onSubmittedWorkDone?(le=`queue-submitted`,ue=`queue.submit`,await t.queue.onSubmittedWorkDone(),le=`queue-work-completed`,ue=`queue.onSubmittedWorkDone`):(le=t.queue?.onSubmittedWorkDone?`queue-submitted-gpu-handoff-no-cpu-fence`:`queue-submitted-no-explicit-completion`,ue=t.queue?.onSubmittedWorkDone?`queue.submit(in-order-gpu-source-local-field-handoff)`:`queue.submit`,pe=!!(t.queue?.onSubmittedWorkDone&&y));else{le=`queue-submitted`,ue=`queue.submit`;let e=await Xa(t,z,A,`ulg-sph-material-interface-source-local-field-readback`);de=new Float32Array(e),le=`readback-map-completed`,ue=`mapAsync(readback-buffer)`}let ge=!1,_e=()=>{ge||(ge=!0,P||te.destroy?.(),F||ne.destroy?.(),L.destroy?.(),B.destroy?.(),g||ae.destroy?.(),!h&&!I&&z.destroy?.(),_||R.destroy?.())},ve=!1;pe&&b?ve=me(t,_e):pe?ve=!0:_e();let ye=Za(c,O),q={schema:e,backend:`webgpu-source-local`,status:`render-field-built`,kernelScope:Ia,sourceLocalSourceField:!0,schroederSpatialSourceFamily:a,schroederSpatialSourceFamilyStatus:a?.status??null,schroederSpatialSourceFamilyRole:a?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:a?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:a?.successorEpochIdentity??null,schroederSpatialSourceFamilyAncestorGenerationId:a?.ancestorSpatialGenerationId??null,schroederSpatialSourceFamilyPositionAuthority:a?.positionAuthority??null,schroederSpatialSourceFamilySpatialQueryAuthority:a?.spatialQueryAuthority??null,schroederSpatialSourceFamilyPositionEpoch:a?.positionEpoch??null,schroederSpatialSourceFamilyTopologyEpoch:a?.topologyEpoch??null,particleCount:T,productEventCount:F||o?E:0,productEventBufferBound:!!(F||o),productEventBufferByteLength:F||o?E*Na*Float32Array.BYTES_PER_ELEMENT:0,surfaceCount:c.surfaceCount,totalFieldCells:c.totalFieldCells,maxFieldCellCount:c.maxFieldCellCount,surfaceTable:c,rowLayout:[...f],rowStrideFloats:Ma,fieldRows:de,fieldRowByteLength:A,fieldPadding:d,refEdgeM:p,renderFieldInputSource:P?`resident-render-rows-buffer-source-local`:`uploaded-render-rows-source-local`,readbackMode:k?Fa:Pa,queueCompletionStatus:le,queueCompletionMethod:ue,pipelineCacheStatus:V.cacheStatus===`pipeline-cache-hit`&&se.cacheStatus===`pipeline-cache-hit`?`pipeline-cache-hit`:`pipeline-cache-miss`,sourceLocalSplatPipelineCacheStatus:V.cacheStatus,sourceLocalResolvePipelineCacheStatus:se.cacheStatus,renderFieldDeferredCleanup:ve,renderFieldReadback:!k,fullReadbackPerformed:!k,normalHotLoopReadbackFree:k,fieldRowsBufferRetained:!!h,fieldRowsBufferByteLength:h?A:0,fieldRowsBufferBorrowed:I,fieldRowsBufferReused:I,fieldRowsBufferOwnedByResult:!I,surfaceBufferRetained:!!g,surfaceBufferByteLength:g?c.records.byteLength:0,sourceIndexFieldSchema:`peercompute.ulg.sph-material-interface-source-index-field.v0`,sourceIndexFieldStatus:_?`source-local-source-index-field-retained`:`source-local-source-index-field-transient`,sourceIndexFieldBufferRetained:!!_,sourceIndexFieldBufferByteLength:_?j:0,sourceIndexFieldStrideUints:1,sourceLocalDensityScale:La,sourceLocalSourceCount:O,sourceLocalEstimatedCellVisits:ye.estimatedCellVisits,sourceLocalDenseCellParticlePairs:ye.denseCellParticlePairs,sourceLocalEstimatedVisitRatio:ye.estimatedVisitRatio,sourceLocalDispatchWorkgroups:{splatX:Math.max(1,Math.ceil(Math.max(1,O)/64)),splatY:Math.max(1,c.surfaceCount),resolveX:Math.max(1,Math.ceil(Math.max(1,c.maxFieldCellCount)/64)),resolveY:Math.max(1,c.surfaceCount)},scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};h&&(q.fieldRowsBuffer=z),g&&(q.surfaceBuffer=ae),_&&(q.sourceIndexFieldBuffer=R),a&&(Ra.set(q,{active:!0,device:t,sourceFamily:a,particleCount:T,fieldRowsBuffer:q.fieldRowsBuffer??null,fieldRows:q.fieldRows,surfaceBuffer:q.surfaceBuffer??null,surfaceTable:c,surfaceRecords:c.records,surfaceTableSnapshot:Pn(c),renderRowsSource:i,renderRowsBuffer:P,renderRows:P?null:n,productEventBuffer:null,productEventRows:null,productEventCount:0,fieldPadding:d,refEdgeM:p,rowStrideFloats:Ma,fieldRowByteLength:A,fieldRowsBufferByteLength:q.fieldRowsBufferByteLength}),q.fieldRowsBuffer&&In({buffer:q.fieldRowsBuffer,artifact:q,invalidate:()=>Ba(q)}));let be=!1,xe=()=>{be||(be=!0,Ba(q),I||z.destroy?.(),ae.destroy?.(),R.destroy?.())};return{schema:D,backend:`webgpu-source-local`,status:`material-interface-source-field-ready`,source:C,sourceCadence:w,sourceRenderField:q,sourceRenderFieldSchema:q.schema,sourceRenderFieldBackend:q.backend,sourceRenderFieldStatus:q.status,sourceRenderFieldReadback:!!q.renderFieldReadback,sourceRenderFieldReadbackMode:q.readbackMode??null,sourceRenderFieldQueueCompletionStatus:q.queueCompletionStatus??null,sourceRenderFieldQueueCompletionMethod:q.queueCompletionMethod??null,sourceRenderFieldPipelineCacheStatus:q.pipelineCacheStatus??null,kernelScope:Ia,sourceLocalSourceField:!0,schroederSpatialSourceFamily:a,schroederSpatialSourceFamilyStatus:a?.status??null,schroederSpatialSourceFamilyRole:a?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:a?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:a?.successorEpochIdentity??null,schroederSpatialSourceFamilyAncestorGenerationId:a?.ancestorSpatialGenerationId??null,schroederSpatialSourceFamilyPositionAuthority:a?.positionAuthority??null,schroederSpatialSourceFamilySpatialQueryAuthority:a?.spatialQueryAuthority??null,schroederSpatialSourceFamilyPositionEpoch:a?.positionEpoch??null,schroederSpatialSourceFamilyTopologyEpoch:a?.topologyEpoch??null,sourceLocalDensityScale:La,sourceLocalSourceCount:O,sourceLocalEstimatedCellVisits:ye.estimatedCellVisits,sourceLocalDenseCellParticlePairs:ye.denseCellParticlePairs,sourceLocalEstimatedVisitRatio:ye.estimatedVisitRatio,sourceLocalSplatPipelineCacheStatus:V.cacheStatus,sourceLocalResolvePipelineCacheStatus:se.cacheStatus,particleCount:q.particleCount,productEventCount:q.productEventCount,surfaceCount:q.surfaceCount,totalFieldCells:q.totalFieldCells,maxFieldCellCount:q.maxFieldCellCount,surfaceTable:q.surfaceTable,rowLayout:q.rowLayout,rowStrideFloats:q.rowStrideFloats,fieldRows:q.fieldRows,fieldRowByteLength:q.fieldRowByteLength,fieldPadding:q.fieldPadding,refEdgeM:q.refEdgeM,fieldRowsBuffer:q.fieldRowsBuffer||null,surfaceBuffer:q.surfaceBuffer||null,fieldRowsBufferRetained:!!q.fieldRowsBufferRetained,fieldRowsBufferByteLength:q.fieldRowsBufferByteLength??0,fieldRowsBufferBorrowed:!!q.fieldRowsBufferBorrowed,fieldRowsBufferReused:!!q.fieldRowsBufferReused,fieldRowsBufferOwnedByResult:q.fieldRowsBufferOwnedByResult??null,surfaceBufferRetained:!!q.surfaceBufferRetained,surfaceBufferByteLength:q.surfaceBufferByteLength??0,sourceIndexFieldSchema:q.sourceIndexFieldSchema,sourceIndexFieldStatus:q.sourceIndexFieldStatus,sourceIndexFieldBuffer:q.sourceIndexFieldBuffer||null,sourceIndexFieldBufferRetained:!!q.sourceIndexFieldBufferRetained,sourceIndexFieldBufferByteLength:q.sourceIndexFieldBufferByteLength??0,sourceIndexFieldStrideUints:q.sourceIndexFieldStrideUints??1,readbackMode:q.readbackMode??null,queueCompletionStatus:q.queueCompletionStatus??null,queueCompletionMethod:q.queueCompletionMethod??null,normalHotLoopReadbackFree:!!q.normalHotLoopReadbackFree,releaseMaterialInterfaceSourceFieldLeases(){return null},destroyMaterialInterfaceSourceFieldBuffers(){return _e(),xe(),null},scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1}}var $a=`peercompute.ulg.sph-webgpu-marching-cubes-extension-adapter.v0`,eo=`peercompute.ulg.sph-webgpu-marching-cubes-extension-execution.v0`,to=`peercompute.ulg.sph-webgpu-marching-cubes-extension-preflight.v0`,no=`peercompute.webgpu-marching-cubes.compact-position-rows.v0`,ro=`peercompute.ulg.sph-webgpu-marching-cubes-extension-translation.v0`,io=`peercompute.ulg.sph-webgpu-marching-cubes-buffer-volume-descriptor.v0`,ao=`peercompute.ulg.sph-gpu-render-surface-vertex-row.v0`,oo=`scalar-buffer`,so=`peercompute.webgpu-marching-cubes.layout.scalar-field-f32.v0`,co=`full-parity-readback`,lo=`no-full-readback`,uo={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,VERTEX:globalThis.GPUBufferUsage?.VERTEX??32,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256},fo={READ:globalThis.GPUMapMode?.READ??1},po=64,mo=new WeakMap,ho=new WeakMap,go=new WeakMap,_o=new WeakMap,vo=new WeakMap,yo=new WeakMap;function bo(e){return ArrayBuffer.isView(e)?new Uint8Array(e.buffer,e.byteOffset,e.byteLength).slice():null}function xo(e,t){if(t==null)return e==null;if(!ArrayBuffer.isView(e)||e.byteLength!==t.byteLength)return!1;let n=new Uint8Array(e.buffer,e.byteOffset,e.byteLength);for(let e=0;e<n.length;e+=1)if(n[e]!==t[e])return!1;return!0}function So(e,t,n){if(!t||typeof t!=`object`)return;let r=e.get(t);r&&r!==n&&(r.active=!1),e.set(t,n)}function Co(e,t){if(!t||typeof t!=`object`)return;let n=e.get(t);n&&(n.active=!1),e.delete(t)}function wo(e){return!!(e?.schroederSpatialSourceFamily||e?.schroederSpatialSourceFamilyStatus||e?.schroederSpatialSourceFamilyRole||e?.schroederSpatialSourceGenerationId!=null||e?.schroederSpatialSuccessorEpochIdentity||e?.schroederSpatialSourceFamilyAncestorGenerationId!=null||e?.schroederSpatialSourceFamilyPositionAuthority||e?.schroederSpatialSourceFamilySpatialQueryAuthority!=null||e?.schroederSpatialSourcePositionAuthority||e?.schroederSpatialSourceQueryAuthority!=null)}function To(e){return{schroederSpatialSourceFamily:e??null,schroederSpatialSourceFamilyStatus:e?.status??null,schroederSpatialSourceFamilyRole:e?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:e?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:e?.successorEpochIdentity??null,schroederSpatialSourcePositionAuthority:e?.positionAuthority??null,schroederSpatialSourceQueryAuthority:e?.spatialQueryAuthority??null}}function Eo(e,t){return e?.schroederSpatialSourceFamily===t&&e?.schroederSpatialSourceFamilyStatus===t?.status&&e?.schroederSpatialSourceFamilyRole===t?.sourceFamilyRole&&e?.schroederSpatialSourceGenerationId===t?.sourceGenerationId&&e?.schroederSpatialSuccessorEpochIdentity===t?.successorEpochIdentity&&e?.schroederSpatialSourcePositionAuthority===t?.positionAuthority&&e?.schroederSpatialSourceQueryAuthority===t?.spatialQueryAuthority}var Do=`
struct SurfaceTranslationParams {
  vertex_count: u32,
  source_stride_floats: u32,
  surface_index: u32,
  triangle_count: u32,
  material_id: f32,
  phase_id: f32,
  optical_state_id: f32,
  density: f32,
  isolation: f32,
  source_voxel_base: f32,
  transparency_class_id: f32,
  depth_write_flag: f32,
  render_order: f32,
  fallback_normal_x: f32,
  fallback_normal_y: f32,
  fallback_normal_z: f32,
  position_scale_m: f32,
  position_origin_x_m: f32,
  position_origin_y_m: f32,
  position_origin_z_m: f32,
  position_grid_bias: f32,
  position_transform_enabled: f32,
  field_resolution: f32,
  field_scalar_offset: f32,
  position_clamp_min_x_m: f32,
  position_clamp_min_y_m: f32,
  position_clamp_min_z_m: f32,
  position_clamp_max_x_m: f32,
  position_clamp_max_y_m: f32,
  position_clamp_max_z_m: f32,
  position_clamp_enabled: f32,
  gradient_normals_enabled: f32,
  bounds_center_x_m: f32,
  bounds_center_y_m: f32,
  bounds_center_z_m: f32,
  bounds_radius_m: f32,
  field_row_stride: f32,
  field_gradient_pad0: f32,
  field_gradient_pad1: f32,
  field_gradient_pad2: f32,
};

@group(0) @binding(0) var<storage, read> compact_position_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> surface_vertex_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> surface_draw_rows: array<f32>;
@group(0) @binding(3) var<storage, read_write> surface_draw_indirect_rows: array<u32>;
@group(0) @binding(4) var<uniform> params: SurfaceTranslationParams;
@group(0) @binding(5) var<storage, read> source_vertex_count_rows: array<u32>;
@group(0) @binding(6) var<storage, read> field_rows: array<f32>;

fn compact_position(vertex_index: u32) -> vec3<f32> {
  let offset = vertex_index * params.source_stride_floats;
  return vec3<f32>(
    compact_position_rows[offset + 0u],
    compact_position_rows[offset + 1u],
    compact_position_rows[offset + 2u]
  );
}

fn ulg_world_position(p: vec3<f32>) -> vec3<f32> {
  if (params.position_transform_enabled <= 0.5) {
    return p;
  }
  return vec3<f32>(
    params.position_origin_x_m,
    params.position_origin_y_m,
    params.position_origin_z_m
  ) + (p + vec3<f32>(params.position_grid_bias)) * params.position_scale_m;
}

fn clamp_world_position(p: vec3<f32>) -> vec3<f32> {
  if (params.position_clamp_enabled <= 0.5) {
    return p;
  }
  return clamp(
    p,
    vec3<f32>(
      params.position_clamp_min_x_m,
      params.position_clamp_min_y_m,
      params.position_clamp_min_z_m
    ),
    vec3<f32>(
      params.position_clamp_max_x_m,
      params.position_clamp_max_y_m,
      params.position_clamp_max_z_m
    )
  );
}

fn normalize_or_fallback(v: vec3<f32>) -> vec3<f32> {
  let len = length(v);
  if (len <= 0.000000000001) {
    return normalize(vec3<f32>(
      params.fallback_normal_x,
      params.fallback_normal_y,
      params.fallback_normal_z
    ));
  }
  return v / len;
}

fn field_sample(v: vec3<i32>) -> f32 {
  let r = i32(params.field_resolution);
  let c = clamp(v, vec3<i32>(0), vec3<i32>(r - 1));
  // Cell rows carry [density, paletteR, paletteG, paletteB]; density is lane 0.
  let idx = u32((c.z * r * r + c.y * r + c.x) * i32(params.field_row_stride) + i32(params.field_scalar_offset));
  return field_rows[idx];
}

fn field_trilinear(p: vec3<f32>) -> f32 {
  let base = floor(p);
  let f = p - base;
  let b = vec3<i32>(base);
  let c00 = mix(field_sample(b), field_sample(b + vec3<i32>(1, 0, 0)), f.x);
  let c10 = mix(field_sample(b + vec3<i32>(0, 1, 0)), field_sample(b + vec3<i32>(1, 1, 0)), f.x);
  let c01 = mix(field_sample(b + vec3<i32>(0, 0, 1)), field_sample(b + vec3<i32>(1, 0, 1)), f.x);
  let c11 = mix(field_sample(b + vec3<i32>(0, 1, 1)), field_sample(b + vec3<i32>(1, 1, 1)), f.x);
  return mix(mix(c00, c10, f.y), mix(c01, c11, f.y), f.z);
}

// Isosurface normal from the density-field gradient (the physical surface
// normal), oriented coherently with the triangle winding. Falls back to the
// face normal when the gradient degenerates or the field is not bound.
fn field_gradient_normal(p: vec3<f32>, face_normal: vec3<f32>) -> vec3<f32> {
  if (params.gradient_normals_enabled <= 0.5) {
    return face_normal;
  }
  let h = 0.75;
  let g = vec3<f32>(
    field_trilinear(p + vec3<f32>(h, 0.0, 0.0)) - field_trilinear(p - vec3<f32>(h, 0.0, 0.0)),
    field_trilinear(p + vec3<f32>(0.0, h, 0.0)) - field_trilinear(p - vec3<f32>(0.0, h, 0.0)),
    field_trilinear(p + vec3<f32>(0.0, 0.0, h)) - field_trilinear(p - vec3<f32>(0.0, 0.0, h))
  );
  let len = length(g);
  if (len <= 0.000000001) {
    return face_normal;
  }
  var n = g / len;
  if (dot(n, face_normal) < 0.0) {
    n = -n;
  }
  return n;
}

fn write_vertex(vertex_index: u32, triangle_index: u32, p: vec3<f32>, normal: vec3<f32>) {
  let offset = vertex_index * 16u;
  surface_vertex_rows[offset + 0u] = f32(params.surface_index);
  surface_vertex_rows[offset + 1u] = params.material_id;
  surface_vertex_rows[offset + 2u] = params.phase_id;
  surface_vertex_rows[offset + 3u] = f32(triangle_index);
  surface_vertex_rows[offset + 4u] = f32(vertex_index);
  surface_vertex_rows[offset + 5u] = p.x;
  surface_vertex_rows[offset + 6u] = p.y;
  surface_vertex_rows[offset + 7u] = p.z;
  surface_vertex_rows[offset + 8u] = normal.x;
  surface_vertex_rows[offset + 9u] = normal.y;
  surface_vertex_rows[offset + 10u] = normal.z;
  surface_vertex_rows[offset + 11u] = params.optical_state_id;
  surface_vertex_rows[offset + 12u] = params.density;
  surface_vertex_rows[offset + 13u] = params.isolation;
  surface_vertex_rows[offset + 14u] = params.source_voxel_base + f32(triangle_index);
  surface_vertex_rows[offset + 15u] = 1.0;
}

fn actual_vertex_count() -> u32 {
  return min(params.vertex_count, source_vertex_count_rows[0u]);
}

fn actual_triangle_count() -> u32 {
  return actual_vertex_count() / 3u;
}

fn write_draw_metadata(triangle_count: u32) {
  surface_draw_rows[0u] = f32(params.surface_index);
  surface_draw_rows[1u] = params.material_id;
  surface_draw_rows[2u] = params.phase_id;
  surface_draw_rows[3u] = params.optical_state_id;
  surface_draw_rows[4u] = 0.0;
  surface_draw_rows[5u] = f32(triangle_count * 3u);
  surface_draw_rows[6u] = 0.0;
  surface_draw_rows[7u] = f32(triangle_count);
  surface_draw_rows[8u] = params.render_order;
  surface_draw_rows[9u] = params.transparency_class_id;
  surface_draw_rows[10u] = params.depth_write_flag;
  surface_draw_rows[11u] = select(0.0, 1.0, triangle_count > 0u);
  surface_draw_rows[12u] = params.bounds_center_x_m;
  surface_draw_rows[13u] = params.bounds_center_y_m;
  surface_draw_rows[14u] = params.bounds_center_z_m;
  surface_draw_rows[15u] = params.bounds_radius_m;
  surface_draw_indirect_rows[0u] = triangle_count * 3u;
  surface_draw_indirect_rows[1u] = select(0u, 1u, triangle_count > 0u);
  surface_draw_indirect_rows[2u] = 0u;
  surface_draw_indirect_rows[3u] = 0u;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let triangle_index = id.x;
  let triangle_count = actual_triangle_count();
  if (triangle_index >= triangle_count) {
    return;
  }
  let vertex_base = triangle_index * 3u;
  let g0 = compact_position(vertex_base + 0u);
  let g1 = compact_position(vertex_base + 1u);
  let g2 = compact_position(vertex_base + 2u);
  // Degenerate slivers (grid-space area below any visible scale) contribute
  // only shading noise at the fluid boundary; collapse them so the
  // rasterizer culls the zero-area result.
  let grid_area2 = length(cross(g1 - g0, g2 - g0));
  let degenerate = grid_area2 < 0.02;
  let p0 = clamp_world_position(ulg_world_position(g0));
  let p1r = clamp_world_position(ulg_world_position(g1));
  let p2r = clamp_world_position(ulg_world_position(g2));
  let p1 = select(p1r, p0, degenerate);
  let p2 = select(p2r, p0, degenerate);
  let face_normal = normalize_or_fallback(cross(p1 - p0, p2 - p0));
  write_vertex(vertex_base + 0u, triangle_index, p0, field_gradient_normal(g0, face_normal));
  write_vertex(vertex_base + 1u, triangle_index, p1, field_gradient_normal(g1, face_normal));
  write_vertex(vertex_base + 2u, triangle_index, p2, field_gradient_normal(g2, face_normal));
  if (triangle_index == 0u) {
    write_draw_metadata(triangle_count);
  }
}
`,Oo=`
struct SurfaceTranslationParams {
  vertex_count: u32,
  source_stride_floats: u32,
  surface_index: u32,
  triangle_count: u32,
  material_id: f32,
  phase_id: f32,
  optical_state_id: f32,
  density: f32,
  isolation: f32,
  source_voxel_base: f32,
  transparency_class_id: f32,
  depth_write_flag: f32,
  render_order: f32,
  fallback_normal_x: f32,
  fallback_normal_y: f32,
  fallback_normal_z: f32,
  position_scale_m: f32,
  position_origin_x_m: f32,
  position_origin_y_m: f32,
  position_origin_z_m: f32,
  position_grid_bias: f32,
  position_transform_enabled: f32,
  field_resolution: f32,
  field_scalar_offset: f32,
  position_clamp_min_x_m: f32,
  position_clamp_min_y_m: f32,
  position_clamp_min_z_m: f32,
  position_clamp_max_x_m: f32,
  position_clamp_max_y_m: f32,
  position_clamp_max_z_m: f32,
  position_clamp_enabled: f32,
  gradient_normals_enabled: f32,
  bounds_center_x_m: f32,
  bounds_center_y_m: f32,
  bounds_center_z_m: f32,
  bounds_radius_m: f32,
  field_row_stride: f32,
  field_gradient_pad0: f32,
  field_gradient_pad1: f32,
  field_gradient_pad2: f32,
};

@group(0) @binding(0) var<storage, read_write> surface_draw_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> surface_draw_indirect_rows: array<u32>;
@group(0) @binding(2) var<uniform> params: SurfaceTranslationParams;
@group(0) @binding(3) var<storage, read> source_vertex_count_rows: array<u32>;

fn actual_vertex_count() -> u32 {
  return min(params.vertex_count, source_vertex_count_rows[0u]);
}

fn actual_triangle_count() -> u32 {
  return actual_vertex_count() / 3u;
}

fn write_draw_metadata(triangle_count: u32) {
  surface_draw_rows[0u] = f32(params.surface_index);
  surface_draw_rows[1u] = params.material_id;
  surface_draw_rows[2u] = params.phase_id;
  surface_draw_rows[3u] = params.optical_state_id;
  surface_draw_rows[4u] = 0.0;
  surface_draw_rows[5u] = f32(triangle_count * 3u);
  surface_draw_rows[6u] = 0.0;
  surface_draw_rows[7u] = f32(triangle_count);
  surface_draw_rows[8u] = params.render_order;
  surface_draw_rows[9u] = params.transparency_class_id;
  surface_draw_rows[10u] = params.depth_write_flag;
  surface_draw_rows[11u] = select(0.0, 1.0, triangle_count > 0u);
  surface_draw_rows[12u] = params.bounds_center_x_m;
  surface_draw_rows[13u] = params.bounds_center_y_m;
  surface_draw_rows[14u] = params.bounds_center_z_m;
  surface_draw_rows[15u] = params.bounds_radius_m;
  surface_draw_indirect_rows[0u] = triangle_count * 3u;
  surface_draw_indirect_rows[1u] = select(0u, 1u, triangle_count > 0u);
  surface_draw_indirect_rows[2u] = 0u;
  surface_draw_indirect_rows[3u] = 0u;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x > 0u) {
    return;
  }
  write_draw_metadata(actual_triangle_count());
}
`;function ko(e){return(typeof e==`object`||typeof e==`function`)&&e!==null}function $(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function Ao(e){return typeof e==`string`&&e.length>0?e:null}function jo(e,t=[0,1,0]){let n=Array.isArray(e)||ArrayBuffer.isView(e)?e:t;return[$(n[0],t[0]),$(n[1],t[1]),$(n[2],t[2])]}function Mo(e,t){return e.every(Number.isFinite)&&t.every(Number.isFinite)&&e.every((e,n)=>e<=t[n])}function No({min:e=null,max:t=null}={}){let n=jo(e,[NaN,NaN,NaN]),r=jo(t,[NaN,NaN,NaN]),i=Mo(n,r);return{enabled:i,status:i?`position-clamp-ready`:`position-clamp-disabled`,minM:i?n:[0,0,0],maxM:i?r:[0,0,0]}}function Po(e,t=[0,1,0]){let n=jo(e,t),r=Math.hypot(n[0],n[1],n[2]);return r>1e-12?[n[0]/r,n[1]/r,n[2]/r]:[...t]}function Fo({resolution:e=null,fieldPadding:t=null,refEdgeM:n=null,positionGridBias:r=-.5}={}){let i=Math.max(0,Math.round($(e,0))),a=$(t,NaN),o=$(n,NaN),s=1-2*a;if(!(i>0&&Number.isFinite(a)&&Number.isFinite(o)&&o>0&&s>1e-12))return Object.freeze({enabled:!1,status:`position-transform-disabled`,resolution:i||null,fieldPadding:Number.isFinite(a)?a:null,refEdgeM:Number.isFinite(o)?o:null,scaleM:1,originM:Object.freeze([0,0,0]),gridBias:0});let c=o/(s*i),l=-a*o/s;return Object.freeze({enabled:!0,status:`ulg-render-field-grid-to-world-transform-ready`,resolution:i,fieldPadding:a,refEdgeM:o,scaleM:c,originM:Object.freeze([l,l,l]),gridBias:$(r,-.5)})}function Io(e,t){if(!Mo(e,t))return null;let n=[(e[0]+t[0])*.5,(e[1]+t[1])*.5,(e[2]+t[2])*.5];return{minM:[...e],maxM:[...t],centerM:n,radiusM:Math.hypot(t[0]-n[0],t[1]-n[1],t[2]-n[2])}}function Lo({positionTransform:e=null,positionClamp:t=null}={}){if(t?.enabled)return Io(t.minM,t.maxM);if(e?.enabled){let t=$(e.scaleM,1),n=jo(e.originM,[0,0,0]),r=Math.max(1,Math.round($(e.resolution,1))),i=Math.max(0,r-1)*t;return Io(n,[n[0]+i,n[1]+i,n[2]+i])}return null}function Ro(e,t,n={}){return{schema:io,ok:!1,status:e,reason:t,sourceType:oo,scalarLayoutName:so,scalarType:`f32`,extensionDescriptorFactory:`createBufferVolumeDescriptor`,...n}}function zo(e=null){let t=e?.role??e?.renderDomainRole??null;if(t===`drop`||t===`base`)return t;let n=String(e?.renderDomainKey??e?.surfaceKey??``).toLowerCase();if(n.includes(`drop`))return`drop`;if(n.includes(`base`))return`base`;let r=Math.round($(e?.renderDomainId,0));return r===1?`base`:r===2?`drop`:null}function Bo(e){return typeof e==`string`?e.trim().toLowerCase():``}function Vo(e,t){if(!e||e.schema!==`peercompute.ulg.algorithm-material-surface-extraction-rows.v0`)return{status:`algorithm-surface-policy-rows-not-supplied`,row:null};let n=Array.isArray(e.rows)?e.rows:[],r=zo(t),i=Bo(t?.material),a=Bo(t?.phase),o=e=>!!i&&Bo(e.material)===i&&(!a||Bo(e.phase)===a),s=r?n.find(e=>e.role===r&&o(e))||null:n.find(o)||null;return{status:s?`algorithm-surface-policy-row-selected`:`algorithm-surface-policy-row-not-found`,row:s}}function Ho({device:e=null,renderField:t=null,renderFieldExecution:n=null,surface:r=null,surfaceIndex:i=0,algorithmMaterialSurfaceExtractionRows:a=null,label:o=`ulg-sph-render-field-density-volume`,source:s=`ulg-render-field-density-storage-buffer`}={}){let c=t||n?.result||n?.renderField||null;if(!c)return Ro(`ulg-render-field-buffer-volume-blocked-missing-render-field`,`retained ULG render-field metadata is required before native marching-cubes buffer-volume extraction`);let l=c.schroederSpatialSourceFamily??n?.schroederSpatialSourceFamily??null;if(!l&&(wo(c)||wo(n)))return Ro(`ulg-render-field-buffer-volume-blocked-partial-successor-lineage`,`native extraction rejects partial Schroeder lineage without the exact branded source family`);if(l){re(l,{device:e,particleCount:c.particleCount??l.particleCount});let t=c.schroederSpatialSourceFieldAuthority??c,n=t.fieldRowsBuffer??null,r={device:e,sourceFamily:l,particleCount:t.particleCount??l.particleCount,fieldRowsBuffer:n,fieldRows:n?null:t.fieldRows,surfaceBuffer:t.surfaceBuffer??null,surfaceTable:t.surfaceTable??null},i=za(t,r),a=Un(t,r);if(!i&&!a)return Ro(`ulg-render-field-buffer-volume-blocked-successor-lineage`,`native extraction requires the exact module-authenticated successor source field`);c=t}if(c.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)return Ro(`ulg-render-field-buffer-volume-blocked-schema`,`ULG buffer-volume extraction requires peercompute.ulg.sph-gpu-render-field.v1 input`,{renderFieldSchema:c.schema??null});let u=l?c.fieldRowsBuffer??null:c.fieldRowsBuffer||n?.fieldRowsBuffer||null;if(!ko(u))return Ro(`ulg-render-field-buffer-volume-blocked-missing-buffer`,`retained fieldRowsBuffer is required for native webgpu-marching-cubes scalar-buffer input`,{renderFieldSchema:c.schema,fieldRowsBufferRetained:!!c.fieldRowsBufferRetained,fieldRowsBufferByteLength:c.fieldRowsBufferByteLength??0});let d=l?c.surfaceTable??null:c.surfaceTable||n?.surfaceTable||null,p=Math.max(0,Math.round($(i,0))),m=d?.metadata?.[p]||null;if(l&&r!=null&&r!==m)return Ro(`ulg-render-field-buffer-volume-blocked-substituted-successor-surface`,`successor extraction requires the exact surface metadata record owned by the authenticated source field`,{renderFieldSchema:c.schema,surfaceIndex:p});let h=l?m:r||m;if(!h)return Ro(`ulg-render-field-buffer-volume-blocked-missing-surface`,`render-field surface metadata is required to locate the scalar sub-volume inside fieldRowsBuffer`,{renderFieldSchema:c.schema,surfaceIndex:p,surfaceCount:d?.surfaceCount??c.surfaceCount??0});let g=Math.max(1,Math.round($(h.resolution,0))),_=Math.max(1,Math.round($(c.rowStrideFloats,f.length))),v=Math.max(0,Math.round($(h.fieldOffset,0))),y=v*_,b=[_,_*g,_*g*g],x=y+Math.max(0,g-1)*b[0]+Math.max(0,g-1)*b[1]+Math.max(0,g-1)*b[2]+1,S=y*Float32Array.BYTES_PER_ELEMENT,C=x*Float32Array.BYTES_PER_ELEMENT,w=Math.round($(c.fieldRowsBufferByteLength,0)),T=Math.round($(u.size??u.byteLength??u.byteLengthBytes,0)),E=Math.max(0,w),D=Math.max(0,E>0&&T>0?Math.min(E,T):E||T),O=u.device||u.ownerDevice||u.__webgpuDevice||u.__webgpuMarchingCubesDevice||null,k=e&&O?e===O?`same-device`:`cross-device-resource`:`same-device-validation-deferred-to-extension`,A=E>0&&T>0&&E>T,j=D>=C;if(k===`cross-device-resource`)return Ro(`ulg-render-field-buffer-volume-blocked-cross-device`,`fieldRowsBuffer is associated with a different GPUDevice than the native marching-cubes adapter`,{renderFieldSchema:c.schema,surfaceIndex:p,sameDeviceStatus:k,scalarBuffer:u,scalarBufferByteLength:D});if(A||!j)return Ro(`ulg-render-field-buffer-volume-blocked-undersized-buffer`,A?`render-field metadata claims more scalar bytes than the retained GPU buffer owns`:`fieldRowsBuffer is smaller than the selected render-field surface sub-volume`,{renderFieldSchema:c.schema,surfaceIndex:p,scalarBuffer:u,scalarBufferByteLength:D,scalarRequiredByteLength:C});let M=[g,g,g],N=Fo({resolution:g,fieldPadding:c.fieldPadding,refEdgeM:c.refEdgeM}),ee=Vo(a,h),P=ee.row,F=h.isolation==null?null:Number(h.isolation),I=P?.isovalue==null?null:Number(P.isovalue),te=Number.isFinite(F),ne=Number.isFinite(I),ie=te?F:null,ae=te?`render-field-surface-isolation`:`isovalue-unavailable`,L=te?`algorithm-surface-policy-not-applied-render-field-isolation-authoritative`:`algorithm-surface-policy-not-applied-render-field-isolation-required`,R=te?`the retained scalar field and its authored isolation share the renderer scalar convention`:`native extraction requires the retained render-field isolation; policy rows are not renderer-authoritative for this scalar convention`,oe={surfaceExtractionIsovalueSource:ae,surfaceExtractionPolicyStatus:ee.status,surfaceExtractionPolicyApplied:!1,surfaceExtractionPolicyApplicationStatus:L,surfaceExtractionPolicyApplicationReason:R,surfaceExtractionPolicyRequestedIsovalue:ne?I:null,surfaceExtractionPolicyRendererAuthority:P?.rendererAuthority??null,surfaceExtractionPolicyStrictSourceOfTruth:P?.strictSourceOfTruth??null,surfaceExtractionPolicyRowsSchema:a?.schema??null,surfaceExtractionPolicyRowSchema:P?.schema??null,surfaceExtractionPolicyRole:P?.role??null,surfaceExtractionPolicyMaterial:P?.material??null,surfaceExtractionPolicyPhase:P?.phase??null,surfaceExtractionPolicyIsovaluePolicy:P?.isovaluePolicy??null,surfaceExtractionPolicySmoothingRadiusM:P?.smoothingRadiusM??null,surfaceExtractionPolicyVoxelSizeM:P?.voxelSizeM??null,surfaceExtractionPolicyNormalScaleM:P?.normalScaleM??null};if(!te)return Ro(`ulg-render-field-buffer-volume-blocked-missing-isolation`,`retained render-field surface metadata must author a finite isolation for native extraction`,{renderFieldSchema:c.schema,surfaceIndex:p,surfaceKey:h.surfaceKey??null,...oe});let z={schema:io,ok:!0,status:`ulg-render-field-buffer-volume-descriptor-ready`,reason:null,extensionDescriptorFactory:`createBufferVolumeDescriptor`,renderFieldSchema:c.schema,renderFieldBackend:c.backend??n?.backend??null,...To(l),schroederSpatialSourceFieldAuthority:c.schroederSpatialSourceFieldAuthority??(l?c:null),source:s,sourceType:oo,scalarLayoutName:so,scalarType:`f32`,scalarLane:`density`,scalarLaneIndex:0,normalSign:-1,normalSemantic:`outward-density-gradient`,normalSourceSemantic:`scalar-gradient`,scalarBuffer:u,storageBuffer:u,buffer:u,scalarBufferByteLength:D,bufferByteLength:D,scalarRequiredByteLength:C,scalarOffset:y,scalarOffsetBytes:S,scalarStrides:b,rowStrideFloats:b[1],sliceStrideFloats:b[2],cellRowStrideFloats:_,dims:M,surfaceIndex:p,surfaceKey:h.surfaceKey??null,material:h.material??null,phase:h.phase??null,renderKey:h.renderKey??null,renderDomainId:h.renderDomainId??null,renderDomainKey:h.renderDomainKey??null,fieldOffset:v,fieldCellCount:h.fieldCellCount??g**3,isolation:ie,isovalue:ie,...oe,fieldPadding:c.fieldPadding??null,refEdgeM:c.refEdgeM??null,positionTransform:N,positionTransformStatus:N.status,positionTransformGridBias:N.gridBias,positionTransformScaleM:N.scaleM,positionTransformOriginM:[...N.originM],device:e,sameDeviceRequired:!0,sameDeviceStatus:k,label:o,nativeConsumerKind:`native-webgpu-marching-cubes-buffer-volume`,nativeRequiredAdapter:`webgpu-marching-cubes.buffer-volume.v0`,scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};return l&&(Object.freeze(z.scalarStrides),Object.freeze(z.dims),Object.freeze(z.positionTransformOriginM),mo.set(z,Object.freeze({device:e,sourceFamily:l,sourceField:c,scalarBuffer:u,surfaceBuffer:c.surfaceBuffer??null,surfaceTable:c.surfaceTable,surfaceRecord:h,surfaceIndex:p,surfaceKey:z.surfaceKey,material:z.material,phase:z.phase,renderKey:z.renderKey,renderDomainId:z.renderDomainId,renderDomainKey:z.renderDomainKey,scalarOffset:y,scalarOffsetBytes:S,scalarStrides:[...b],dims:[...M],scalarBufferByteLength:D,scalarRequiredByteLength:C,scalarType:z.scalarType,normalSign:z.normalSign,fieldOffset:v,fieldCellCount:z.fieldCellCount,isovalue:ie,cellRowStrideFloats:_,rowStrideFloats:z.rowStrideFloats,sliceStrideFloats:z.sliceStrideFloats,fieldPadding:c.fieldPadding,refEdgeM:c.refEdgeM,positionTransform:z.positionTransform,positionTransformStatus:z.positionTransformStatus,positionTransformGridBias:z.positionTransformGridBias,positionTransformScaleM:z.positionTransformScaleM,positionTransformOriginM:[...z.positionTransformOriginM]})),Object.freeze(z)),z}function Uo(e,t,{device:n,sourceFamily:r}){return!!(t&&t.device===n&&t.sourceFamily===r&&e.schema===`peercompute.ulg.sph-webgpu-marching-cubes-buffer-volume-descriptor.v0`&&e.ok===!0&&e.status===`ulg-render-field-buffer-volume-descriptor-ready`&&e.device===n&&e.scalarBuffer===t.scalarBuffer&&e.storageBuffer===t.scalarBuffer&&e.buffer===t.scalarBuffer&&e.schroederSpatialSourceFamily===r&&e.schroederSpatialSourceFieldAuthority===t.sourceField&&e.scalarBufferByteLength===t.scalarBufferByteLength&&e.bufferByteLength===t.scalarBufferByteLength&&e.scalarRequiredByteLength===t.scalarRequiredByteLength&&e.scalarType===t.scalarType&&e.normalSign===t.normalSign&&e.surfaceIndex===t.surfaceIndex&&e.surfaceKey===t.surfaceKey&&e.material===t.material&&e.phase===t.phase&&e.renderKey===t.renderKey&&e.renderDomainId===t.renderDomainId&&e.renderDomainKey===t.renderDomainKey&&e.scalarOffset===t.scalarOffset&&e.scalarOffsetBytes===t.scalarOffsetBytes&&e.fieldOffset===t.fieldOffset&&e.fieldCellCount===t.fieldCellCount&&e.isolation===t.isovalue&&e.isovalue===t.isovalue&&e.cellRowStrideFloats===t.cellRowStrideFloats&&e.rowStrideFloats===t.rowStrideFloats&&e.sliceStrideFloats===t.sliceStrideFloats&&e.fieldPadding===t.fieldPadding&&e.refEdgeM===t.refEdgeM&&e.positionTransform===t.positionTransform&&e.positionTransformStatus===t.positionTransformStatus&&e.positionTransformGridBias===t.positionTransformGridBias&&e.positionTransformScaleM===t.positionTransformScaleM&&Array.isArray(e.positionTransformOriginM)&&e.positionTransformOriginM.length===t.positionTransformOriginM.length&&e.positionTransformOriginM.every((e,n)=>e===t.positionTransformOriginM[n])&&Array.isArray(e.dims)&&e.dims.length===t.dims.length&&e.dims.every((e,n)=>e===t.dims[n])&&Array.isArray(e.scalarStrides)&&e.scalarStrides.length===t.scalarStrides.length&&e.scalarStrides.every((e,n)=>e===t.scalarStrides[n]))}function Wo(e,{device:t,sourceFamily:n=e?.schroederSpatialSourceFamily}={}){let r=mo.get(e);if(!Uo(e,r,{device:t,sourceFamily:n}))return!1;let i=r.sourceField.fieldRowsBuffer??null,a={device:t,sourceFamily:n,particleCount:r.sourceField.particleCount,fieldRowsBuffer:i,fieldRows:i?null:r.sourceField.fieldRows,surfaceBuffer:r.surfaceBuffer,surfaceTable:r.surfaceTable};return!!(za(r.sourceField,a)||Un(r.sourceField,a))}function Go(e){return{volume:e,device:e?.device??null,scalarBuffer:e?.scalarBuffer??null,storageBuffer:e?.storageBuffer??null,sourceType:e?.sourceType??null,scalarOffset:e?.scalarOffset??null,scalarOffsetBytes:e?.scalarOffsetBytes??null,scalarType:e?.scalarType??null,normalSign:e?.normalSign??null,scalarBufferByteLength:e?.scalarBufferByteLength??null,scalarRequiredByteLength:e?.scalarRequiredByteLength??null,rowStrideFloats:e?.rowStrideFloats??null,sliceStrideFloats:e?.sliceStrideFloats??null,numVoxels:e?.numVoxels??null,dualGridNumVoxels:e?.dualGridNumVoxels??null,diagonalLength:e?.diagonalLength??null,dims:Array.from(e?.dims??[]),dualGridDims:Array.from(e?.dualGridDims??[]),scalarStrides:Array.from(e?.scalarStrides??[])}}function Ko(e){if(!e)return!1;let t=Go(e.volume);return!!(Wo(e.descriptor,{device:e.device,sourceFamily:e.sourceFamily})&&t.volume===e.volumeState.volume&&t.device===e.volumeState.device&&t.scalarBuffer===e.volumeState.scalarBuffer&&t.storageBuffer===e.volumeState.storageBuffer&&t.sourceType===e.volumeState.sourceType&&t.scalarOffset===e.volumeState.scalarOffset&&t.scalarOffsetBytes===e.volumeState.scalarOffsetBytes&&t.scalarType===e.volumeState.scalarType&&t.normalSign===e.volumeState.normalSign&&t.scalarBufferByteLength===e.volumeState.scalarBufferByteLength&&t.scalarRequiredByteLength===e.volumeState.scalarRequiredByteLength&&t.rowStrideFloats===e.volumeState.rowStrideFloats&&t.sliceStrideFloats===e.volumeState.sliceStrideFloats&&t.numVoxels===e.volumeState.numVoxels&&t.dualGridNumVoxels===e.volumeState.dualGridNumVoxels&&t.diagonalLength===e.volumeState.diagonalLength&&t.dims.length===e.volumeState.dims.length&&t.dims.every((t,n)=>t===e.volumeState.dims[n])&&t.dualGridDims.length===e.volumeState.dualGridDims.length&&t.dualGridDims.every((t,n)=>t===e.volumeState.dualGridDims[n])&&t.scalarStrides.length===e.volumeState.scalarStrides.length&&t.scalarStrides.every((t,n)=>t===e.volumeState.scalarStrides[n]))}function qo({device:e,descriptor:t,volume:n}={}){let r=t?.schroederSpatialSourceFamily??null;if(!r)return null;if(!Wo(t,{device:e,sourceFamily:r}))throw TypeError(`marching-cubes volume requires an active authenticated successor descriptor`);let i=t.dims.map(e=>Math.max(0,e-1)),a=t.dims.reduce((e,t)=>e*t,1),o=i.reduce((e,t)=>e*t,1);if(!n||n.device!==e||n.scalarBuffer!==t.scalarBuffer||n.storageBuffer!==t.scalarBuffer||n.sourceType!==t.sourceType||n.scalarType!==t.scalarType||n.scalarBufferByteLength!==t.scalarBufferByteLength||n.scalarRequiredByteLength!==t.scalarRequiredByteLength||n.scalarOffset!==t.scalarOffset||n.scalarOffsetBytes!==t.scalarOffsetBytes||n.rowStrideFloats!==t.rowStrideFloats||n.sliceStrideFloats!==t.sliceStrideFloats||n.normalSign!==t.normalSign||n.numVoxels!==a||n.dualGridNumVoxels!==o||!Array.isArray(n.dims)||n.dims.length!==t.dims.length||!n.dims.every((e,n)=>e===t.dims[n])||!Array.isArray(n.dualGridDims)||n.dualGridDims.length!==i.length||!n.dualGridDims.every((e,t)=>e===i[t])||!Array.isArray(n.scalarStrides)||n.scalarStrides.length!==t.scalarStrides.length||!n.scalarStrides.every((e,n)=>e===t.scalarStrides[n]))throw TypeError(`marching-cubes volume does not exactly match its authenticated successor descriptor`);let s=Object.freeze({device:e,descriptor:t,volume:n,volumeState:Object.freeze(Go(n)),sourceFamily:r,scalarBuffer:t.scalarBuffer,surfaceIndex:t.surfaceIndex,isovalue:t.isovalue});return ho.set(n,s),Object.freeze({status:`ulg-marching-cubes-successor-volume-lineage-bound`,sourceFamilyRole:r.sourceFamilyRole,sourceGenerationId:r.sourceGenerationId,surfaceIndex:t.surfaceIndex})}function Jo(e,t,{surfaceIndex:n,materialId:r,phaseId:i,opticalStateId:a,vertexOffset:o,vertexCount:s,triangleOffset:c,triangleCount:l,renderOrder:u,transparencyClassId:d,depthWriteFlag:f,status:p,boundsCenterM:m,boundsRadiusM:h}){e.set([n,r,i,a,o,s,c,l,u,d,f,p,m[0],m[1],m[2],h],t)}function Yo({vertexCount:e,sourceStrideFloats:t,surfaceIndex:n,triangleCount:r,materialId:i,phaseId:a,opticalStateId:o,density:s,isolation:c,sourceVoxelLinearIndex:l,transparencyClassId:u,depthWriteFlag:d,renderOrder:f,fallbackNormal:p,positionTransform:m=null,positionClamp:h=null,surfaceBounds:g=null,fieldGradient:_=null}){let v=new ArrayBuffer(160),y=new DataView(v),b=m?.enabled?m:null,x=h?.enabled?h:null,S=g||Lo({positionTransform:b,positionClamp:x}),C=jo(b?.originM,[0,0,0]),w=jo(x?.minM,[0,0,0]),T=jo(x?.maxM,[0,0,0]),E=jo(S?.centerM,[0,0,0]);return y.setUint32(0,Math.max(0,Math.round($(e,0))),!0),y.setUint32(4,Math.max(1,Math.round($(t,4))),!0),y.setUint32(8,Math.max(0,Math.round($(n,0))),!0),y.setUint32(12,Math.max(0,Math.round($(r,0))),!0),y.setFloat32(16,$(i,0),!0),y.setFloat32(20,$(a,0),!0),y.setFloat32(24,$(o,0),!0),y.setFloat32(28,$(s,0),!0),y.setFloat32(32,$(c,0),!0),y.setFloat32(36,$(l,0),!0),y.setFloat32(40,$(u,0),!0),y.setFloat32(44,$(d,1),!0),y.setFloat32(48,$(f,n),!0),y.setFloat32(52,p[0],!0),y.setFloat32(56,p[1],!0),y.setFloat32(60,p[2],!0),y.setFloat32(64,$(b?.scaleM,1),!0),y.setFloat32(68,C[0],!0),y.setFloat32(72,C[1],!0),y.setFloat32(76,C[2],!0),y.setFloat32(80,$(b?.gridBias,0),!0),y.setFloat32(88,$(_?.resolution,0),!0),y.setFloat32(92,$(_?.scalarOffsetFloats,0),!0),y.setFloat32(124,+!!_?.buffer,!0),y.setFloat32(144,$(_?.rowStrideFloats,1),!0),y.setFloat32(84,+!!b,!0),y.setFloat32(96,w[0],!0),y.setFloat32(100,w[1],!0),y.setFloat32(104,w[2],!0),y.setFloat32(108,T[0],!0),y.setFloat32(112,T[1],!0),y.setFloat32(116,T[2],!0),y.setFloat32(120,+!!x,!0),y.setFloat32(128,E[0],!0),y.setFloat32(132,E[1],!0),y.setFloat32(136,E[2],!0),y.setFloat32(140,$(S?.radiusM,0),!0),v}async function Xo(e,t,n,r=`ulg-sph-marching-cubes-extension-readback`){let i=null,a=!1;try{i=e.createBuffer({label:r,size:Math.max(4,n),usage:uo.MAP_READ|uo.COPY_DST});let o=e.createCommandEncoder();return o.copyBufferToBuffer(t,0,i,0,n),e.queue.submit([o.finish()]),await i.mapAsync(fo.READ),a=!0,i.getMappedRange().slice(0)}finally{if(a)try{i?.unmap?.()}catch{}try{i?.destroy?.()}catch{}}}function Zo({surfaceIndex:e,materialId:t,phaseId:r,opticalStateId:i,material:a,phase:o,renderKey:s,surfaceKey:c,vertexCount:l,triangleCount:u,renderOrder:d,transparencyClassId:f,depthWriteFlag:p,status:m=`surface-draw-summary-not-read`,boundsCenterM:h=null,boundsRadiusM:g=null,indirectRowIndex:_=0,indirectOffsetBytes:v=null}){let y=jo(h,[0,0,0]),b=$(g,0),x=Number.isFinite(Number(l))?Math.max(0,Math.round(Number(l))):null,S=Number.isFinite(Number(u))?Math.max(0,Math.round(Number(u))):null,C=Math.max(0,Math.round($(_,0))),w=n.length*Uint32Array.BYTES_PER_ELEMENT,T=Number.isFinite(Number(v))?Math.max(0,Math.round(Number(v))):C*w,E=(x??0)>=3;return{surfaceKey:c||`extension-surface-${e}`,material:a,phase:o,renderKey:s,surfaceIndex:e,materialId:t,phaseId:r,opticalStateId:i,indirectRowIndex:C,indirectOffsetBytes:T,vertexOffset:E?0:null,vertexCount:x,triangleOffset:E?0:null,triangleCount:S,renderOrder:d,transparencyClassId:f,depthWriteFlag:p,boundsCenterM:y,boundsRadiusM:b>0?b:null,status:m}}function Qo(e){let t=e?.result||null,n=(t?.outputDescriptors?.rows?.position||t?.rowMetadata?.position||null)?.resourceOwnership||t?.resourceOwnership||null;if(n?.ok===!1||n?.status===`cross-device-resource`)throw TypeError(`extension surface buffer is not owned by this GPUDevice (${n.status})`);let r=es(t);if(r.resourceOwnership?.ok===!1||r.resourceOwnership?.status===`cross-device-resource`)throw TypeError(`extension packed normal buffer is not owned by this GPUDevice (${r.resourceOwnership.status})`)}function $o(e=null){let t=e?.outputDescriptors||null,n=t?.rows?.position||null,r=e?.rowMetadata?.position||null,i=n||r||null,a=Math.max(0,Math.round($(i?.rowStrideFloats??e?.rowStrideFloats??e?.vertexStrideFloats,0))),o=Math.max(0,Math.round($(i?.rowStrideBytes??e?.rowStrideBytes??e?.vertexStrideBytes,0))),s=i?.schema??e?.rowSchema??null,c=Array.isArray(i?.rowLayout)?[...i.rowLayout]:Array.isArray(e?.rowLayout)?[...e.rowLayout]:null,l=i?.buffer||t?.retainedBuffers?.position||e?.buffer||null,u=!!(i?.bufferRetained&&i?.buffer||t?.retainedBuffers?.position&&l||e?.bufferRetained&&e?.buffer),d=Math.max(0,Math.round($(i?.bufferByteLength??e?.bufferByteLength,0)));return{outputDescriptorSchema:t?.schema??null,outputDescriptorStatus:t?.status??null,outputDescriptorTopology:t?.topology??null,outputDescriptorReadback:t?.readback??null,outputDescriptorFullReadback:t?.fullReadback??null,rowMetadataSchema:e?.rowMetadata?.schema??null,rowMetadataStatus:e?.rowMetadata?.status??null,rowSchema:s,rowLayout:c,rowLayoutName:i?.layoutName??t?.layoutName??e?.layoutName??null,rowStrideFloats:a,rowStrideBytes:o,rowCount:Math.max(0,Math.round($(i?.rowCount??e?.rowCount??e?.vertexCount,0))),status:i?.status??null,available:!!(i?.available??u),buffer:l,bufferRetained:u,bufferByteLength:d,ownerDeviceId:i?.ownerDeviceId??e?.ownerDeviceId??null,resourceOwnership:i?.resourceOwnership??e?.resourceOwnership??null,readback:i?.readback??t?.readback??e?.rowMetadata?.readback??e?.readback??null,normalRowsStatus:t?.rows?.normal?.status??e?.rowMetadata?.normal?.status??null,materialRowsStatus:t?.rows?.material?.status??e?.rowMetadata?.material?.status??null,drawRowsStatus:t?.rows?.draw?.status??null,drawRowsAvailable:t?.rows?.draw?.available??null,indirectDrawRowsStatus:t?.rows?.indirect?.status??null,indirectDrawRowsAvailable:t?.rows?.indirect?.available??null,materialMetadataAvailable:t?.materialPayload?.available??e?.rowMetadata?.material?.metadataAvailable??null,pbrMetadataAvailable:t?.pbrPayload?.available??null}}function es(e=null){let t=e?.outputDescriptors||null,n=t?.rows?.normal||null,r=e?.rowMetadata?.normal||null,i=n||r||null,a=i?.normalBufferDescriptor||t?.normalBufferDescriptor||null,o=ko(a?.generation)?a.generation:null,s=o!=null,c=!!(s&&Object.prototype.hasOwnProperty.call(o,`surfaceGenerationId`)),l=!!(s&&Object.prototype.hasOwnProperty.call(o,`pairedPositionSurfaceGenerationId`)),u=!!(s&&Object.prototype.hasOwnProperty.call(o,`volumeGenerationId`)),d=i?.buffer||t?.retainedBuffers?.normal||e?.normalBuffer||null,f=Math.max(0,Math.round($(i?.bufferByteLength??a?.bufferByteLength??e?.normalBufferByteLength,0))),p=Math.max(0,Math.round($(i?.rowCount??a?.rowCount,0))),m=c?o.surfaceGenerationId:null,h=l?o.pairedPositionSurfaceGenerationId:null,g=u?o.volumeGenerationId:null;return{descriptorSchema:a?.schema??null,rowSchema:i?.schema??a?.rowSchema??null,layoutName:i?.layoutName??a?.layoutName??null,encoding:i?.encoding??a?.encoding??e?.normalEncoding??null,semantic:i?.semantic??a?.semantic??e?.normalSemantic??null,sourceSemantic:i?.sourceSemantic??a?.sourceSemantic??e?.normalSourceSemantic??null,normalSign:Number(i?.normalSign??a?.normalSign??e?.normalSign),status:i?.status??a?.status??null,available:!!(i?.available??a?.available),buffer:d,bufferRetained:!!(i?.bufferRetained&&i?.buffer||a?.bufferRetained&&a?.buffer||t?.retainedBuffers?.normal&&d),bufferByteLength:f,rowStrideBytes:Math.max(0,Math.round($(i?.rowStrideBytes??a?.rowStrideBytes,0))),rowCount:p,ownerDeviceId:i?.ownerDeviceId??a?.ownerDeviceId??null,resourceOwnership:i?.resourceOwnership??a?.resourceOwnership??null,generationDescriptorAuthored:s,surfaceGenerationIdAuthored:c,pairedPositionSurfaceGenerationIdAuthored:l,volumeGenerationIdAuthored:u,surfaceGenerationId:m,pairedPositionSurfaceGenerationId:h,volumeGenerationId:g,sameSubmitAsPosition:a?.generation?.sameSubmitAsPosition===!0,lifetimeOwner:a?.lifetime?.owner??null,pairedWithPositionBuffer:a?.lifetime?.pairedWithPositionBuffer===!0,producerStage:a?.producer?.stage??e?.normalProducerStage??null,timestampSpanLabel:a?.producer?.timestampSpanLabel??e?.normalTimestampSpanLabel??null,additionalSubmitCount:Math.max(0,Math.round($(a?.producer?.additionalSubmitCount??e?.normalAdditionalSubmitCount,0)))}}function ts(e,t=null){let n=e?.result??null,r=t??rs(e),i=$o(n),a=es(n);return{result:n,summaryFingerprint:JSON.stringify(r),positionBuffer:i.buffer??null,normalBuffer:a.buffer??null,positionRows:n?.positionRows??n?.compactPositionRows??null,actualVertexCounterBuffer:n?.actualVertexCounterBuffer??n?.vertexCounterBuffer??null,drawIndirectBuffer:n?.drawIndirectBuffer??null,surfaceGenerationId:n?.surfaceGenerationId??null,volumeGenerationId:n?.volumeGenerationId??null,resultIsovalue:n?.isovalue??null}}function ns(e){return{schema:eo,status:`extension-surface-execution-invalid`,reason:e,extensionExecutionSchema:null,extensionSurfaceSchema:null,extensionStatus:null,extensionOk:!1,extensionBackend:null,extensionAdapterId:null,extensionOwnsDevice:null,extensionOwnerDeviceId:null,extensionResourceOwnershipStatus:null,extensionVertexFormat:null,extensionVertexStrideFloats:null,extensionVertexStrideBytes:null,extensionVertexCount:0,extensionTriangleCount:0,extensionBufferRetained:!1,extensionReadback:null,extensionSurfaceVertexReadback:null,readyForUlgSurfaceVertexRows:!1,requiresUlgVertexRowTranslation:!0,requiresUlgDrawMetadata:!0,surfaceVertexSchema:r,surfaceVertexFormat:ao,surfaceVertexRowLayout:[...h],surfaceVertexRowStrideFloats:h.length,surfaceDrawSchema:d,surfaceDrawRowLayout:[...m],surfaceDrawRowStrideFloats:m.length,surfaceDrawIndirectSchema:l,surfaceDrawIndirectRowLayout:[...n],surfaceDrawIndirectRowStrideUints:n.length,hotLoopSafe:!1,rendererIntegration:`not-integrated`}}function rs(e){if(!ko(e))return ns(`missing extension surface execution`);let t=e.result||null,i=$o(t),a=es(t),o=t?.schema??null,s=e.ok===!0,c=Math.max(0,Math.round($(t?.vertexCount,0))),u=t?.vertexCountMode??null,f=t?.vertexRowsBudget==null?null:Math.max(0,Math.round($(t.vertexRowsBudget,0))),p=t?.vertexRowsBudgetClamped===!0?!0:t?.vertexRowsBudgetClamped===!1?!1:null,g=t?.conservativeWorstCaseVertexCount==null?null:Math.max(0,Math.round($(t.conservativeWorstCaseVertexCount,0))),_=t?.actualVertexCounterBuffer||t?.vertexCounterBuffer||null,v=Math.max(0,Math.round($(t?.actualVertexCounterBufferByteLength??t?.vertexCounterBufferByteLength??_?.size,0))),y=t?.drawIndirectBuffer||null,b=Math.max(0,Math.round($(t?.drawIndirectBufferByteLength??y?.size,0))),x=Math.max(0,$(t?.triangleCount,0)),S=i.rowStrideFloats>0?i.rowStrideFloats:t?.vertexStrideFloats==null?null:Math.max(0,Math.round($(t.vertexStrideFloats,0))),C=i.rowStrideBytes>0?i.rowStrideBytes:t?.vertexStrideBytes==null?null:Math.max(0,Math.round($(t.vertexStrideBytes,0))),w=t?.vertexFormat??null,T=i.bufferRetained,E=i.resourceOwnership?.status??null,D=!!(a.volumeGenerationId==null&&t?.volumeGenerationId==null||Number.isInteger(a.volumeGenerationId)&&Number.isInteger(t?.volumeGenerationId)&&a.volumeGenerationId===t.volumeGenerationId),O=!!(a.generationDescriptorAuthored&&a.surfaceGenerationIdAuthored&&a.pairedPositionSurfaceGenerationIdAuthored&&a.volumeGenerationIdAuthored&&Number.isInteger(a.surfaceGenerationId)&&Number.isInteger(a.pairedPositionSurfaceGenerationId)&&Number.isInteger(t?.surfaceGenerationId)&&a.surfaceGenerationId===a.pairedPositionSurfaceGenerationId&&a.surfaceGenerationId===t.surfaceGenerationId&&D),k=!!(a.descriptorSchema===`peercompute.webgpu-marching-cubes.normal-buffer-descriptor.v0`&&a.rowSchema===`peercompute.webgpu-marching-cubes.packed-normal-rows.v0`&&a.layoutName===`peercompute.webgpu-marching-cubes.layout.normal-octahedral-snorm16x2.v0`&&a.encoding===`octahedral-snorm16x2`&&a.semantic===`oriented-scalar-gradient`&&a.sourceSemantic===`scalar-gradient`&&(a.normalSign===-1||a.normalSign===1)&&a.available&&a.bufferRetained&&a.buffer&&a.rowStrideBytes===Uint32Array.BYTES_PER_ELEMENT&&a.rowCount===c&&a.bufferByteLength>=c*Uint32Array.BYTES_PER_ELEMENT&&a.resourceOwnership?.ok!==!1&&a.resourceOwnership?.status!==`cross-device-resource`&&O&&a.sameSubmitAsPosition&&a.pairedWithPositionBuffer&&a.lifetimeOwner===`surface-result`&&a.additionalSubmitCount===0),A=`packed-normal-ready`;!a.buffer||!a.bufferRetained?A=`packed-normal-buffer-unavailable`:O?k||(A=`packed-normal-contract-invalid`):A=`packed-normal-generation-mismatch`;let j=e.errors?.[0]||e.webgpuStatus?.error||t?.error||null,M=Ao(e.webgpuStatus?.reason)||Ao(j?.message)||Ao(t?.reason)||Ao(e.status),N=!!(s&&o===`peercompute.webgpu-marching-cubes.surface.v0`&&T&&c>0),ee=!!(N&&S===h.length&&w===`peercompute.ulg.sph-gpu-render-surface-vertex-row.v0`),P=!ee,F=`extension-surface-execution-blocked`;return F=s?N?P?`extension-surface-ready-needs-ulg-row-translation`:`extension-surface-ready-ulg-row-compatible`:c>0?`extension-surface-buffer-unavailable`:`extension-surface-empty`:e.status===`same-device-check-failed`?`extension-surface-same-device-check-failed`:`extension-surface-execution-blocked`,{schema:eo,status:F,reason:F.endsWith(`failed`)||F.endsWith(`blocked`)?M:null,extensionExecutionSchema:e.schema??null,extensionSurfaceSchema:o,extensionStatus:e.status??null,extensionOk:s,extensionErrorName:j?.name??null,extensionErrorStatus:j?.status??null,extensionErrorStage:j?.stage??null,extensionErrorStack:j?.stack??null,extensionBackend:e.backend??null,extensionAdapterId:e.adapterId??null,extensionOwnsDevice:e.ownsDevice??null,extensionOwnerDeviceId:e.ownerDeviceId??t?.ownerDeviceId??null,extensionResourceOwnershipStatus:E,extensionVertexFormat:w,extensionVertexStrideFloats:S,extensionVertexStrideBytes:C,extensionVertexCount:c,extensionVertexCountMode:u,extensionVertexRowsBudget:f,extensionVertexRowsBudgetClamped:p,extensionConservativeWorstCaseVertexCount:g,extensionActualVertexCounterBufferRetained:!!_,extensionActualVertexCounterBufferByteLength:v,extensionDrawIndirectBufferRetained:!!y,extensionDrawIndirectBufferByteLength:b,extensionTriangleCount:x,extensionBufferRetained:T,extensionBufferByteLength:i.bufferByteLength,extensionPackedNormalReady:k,extensionPackedNormalStatus:A,extensionNormalDescriptorSchema:a.descriptorSchema,extensionNormalRowsSchema:a.rowSchema,extensionNormalLayoutName:a.layoutName,extensionNormalEncoding:a.encoding,extensionNormalSemantic:a.semantic,extensionNormalSourceSemantic:a.sourceSemantic,extensionNormalSign:Number.isFinite(a.normalSign)?a.normalSign:null,extensionNormalBufferRetained:a.bufferRetained,extensionNormalBufferByteLength:a.bufferByteLength,extensionNormalRowStrideBytes:a.rowStrideBytes,extensionNormalRowCount:a.rowCount,extensionNormalOwnerDeviceId:a.ownerDeviceId,extensionNormalResourceOwnershipStatus:a.resourceOwnership?.status??null,extensionNormalGenerationDescriptorAuthored:a.generationDescriptorAuthored,extensionNormalSurfaceGenerationIdAuthored:a.surfaceGenerationIdAuthored,extensionNormalPairedPositionSurfaceGenerationIdAuthored:a.pairedPositionSurfaceGenerationIdAuthored,extensionNormalVolumeGenerationIdAuthored:a.volumeGenerationIdAuthored,extensionNormalSurfaceGenerationId:a.surfaceGenerationId,extensionNormalPairedPositionSurfaceGenerationId:a.pairedPositionSurfaceGenerationId,extensionNormalVolumeGenerationId:a.volumeGenerationId,extensionNormalSameSubmitAsPosition:a.sameSubmitAsPosition,extensionNormalLifetimeOwner:a.lifetimeOwner,extensionNormalPairedWithPositionBuffer:a.pairedWithPositionBuffer,extensionNormalProducerStage:a.producerStage,extensionNormalTimestampSpanLabel:a.timestampSpanLabel,extensionNormalAdditionalSubmitCount:a.additionalSubmitCount,extensionOutputDescriptorSchema:i.outputDescriptorSchema,extensionOutputDescriptorStatus:i.outputDescriptorStatus,extensionOutputDescriptorTopology:i.outputDescriptorTopology,extensionOutputDescriptorReadback:i.outputDescriptorReadback,extensionOutputDescriptorFullReadback:i.outputDescriptorFullReadback,extensionRowMetadataSchema:i.rowMetadataSchema,extensionRowMetadataStatus:i.rowMetadataStatus,extensionPositionRowsSchema:i.rowSchema,extensionPositionRowsStatus:i.status,extensionPositionRowsAvailable:i.available,extensionPositionRowsReadback:i.readback,extensionPositionRowsRowLayout:i.rowLayout,extensionPositionRowsLayoutName:i.rowLayoutName,extensionPositionRowsRowCount:i.rowCount,extensionNormalRowsStatus:i.normalRowsStatus,extensionMaterialRowsStatus:i.materialRowsStatus,extensionDrawRowsStatus:i.drawRowsStatus,extensionDrawRowsAvailable:i.drawRowsAvailable,extensionIndirectDrawRowsStatus:i.indirectDrawRowsStatus,extensionIndirectDrawRowsAvailable:i.indirectDrawRowsAvailable,extensionMaterialMetadataAvailable:i.materialMetadataAvailable,extensionPbrMetadataAvailable:i.pbrMetadataAvailable,extensionReadback:e.readback??null,extensionSurfaceVertexReadback:e.surfaceVertexReadback??null,readyForUlgSurfaceVertexRows:ee,requiresUlgVertexRowTranslation:P,requiresUlgDrawMetadata:!0,surfaceVertexSchema:r,surfaceVertexFormat:ao,surfaceVertexRowLayout:[...h],surfaceVertexRowStrideFloats:h.length,surfaceDrawSchema:d,surfaceDrawRowLayout:[...m],surfaceDrawRowStrideFloats:m.length,surfaceDrawIndirectSchema:l,surfaceDrawIndirectRowLayout:[...n],surfaceDrawIndirectRowStrideUints:n.length,hotLoopSafe:!!(N&&e.readback===!1&&e.surfaceVertexReadback===!1&&i.readback!==!0),rendererIntegration:`pending-ulg-row-translation-and-engine-bridge`}}function is({device:e,volume:t=null,adapterFactory:n,adapter:r=null,adapterId:i=`webgpu-marching-cubes`,backend:a=`webgpu-marching-cubes-extension`}={}){if(!ko(e))throw TypeError(`createUlgWebGpuMarchingCubesExtensionAdapter requires a caller-owned GPUDevice`);if(!r&&typeof n!=`function`)throw TypeError(`createUlgWebGpuMarchingCubesExtensionAdapter requires an adapter or adapterFactory`);let o=r,s=async()=>(o||=await n({device:e,volume:t,adapterId:i}),o),c={schema:$a,adapterId:i,backend:a,device:e,ownsDevice:!1,volume:t,get adapter(){return o},getStatus(){return{schema:$a,status:o?`extension-adapter-ready`:`extension-adapter-pending`,adapterSchema:o?.schema??null,adapterStatus:o?.getStatus?.()??null,adapterId:i,backend:a,ownsDevice:!1}},getCapabilities(){return o?.getCapabilities?.()??{schema:`peercompute.ulg.sph-webgpu-marching-cubes-extension-adapter.v0`,status:o?`extension-capabilities-unavailable`:`extension-adapter-pending`,adapterSchema:o?.schema??null,adapterId:i,backend:a,ownsDevice:!1}},async preflight(e={}){let n=await s();if(typeof n.preflight!=`function`)return{schema:to,ok:!0,status:`extension-preflight-unavailable`,reason:`extension adapter does not expose preflight; extraction will rely on adapter extractSurface checks`,backend:a,adapterSchema:n?.schema??null,adapterId:i,ownsDevice:!1,extensionPreflight:null};let r=await n.preflight({...e,volume:e.volume||t}),o=r?.ok!==!1;return{schema:to,ok:o,status:o?`extension-preflight-ready`:`extension-preflight-blocked`,reason:o?null:r?.status||`extension preflight blocked surface extraction`,backend:a,adapterSchema:n?.schema??null,adapterId:i,ownsDevice:!1,extensionPreflightSchema:r?.schema??null,extensionPreflightStatus:r?.status??null,deviceChecks:r?.deviceChecks||[],extensionPreflight:r}},async extractSurface(n={}){let r=n.volume||t,o=yo.get(c);if(!o||o.device!==e||o.volume!==t)throw TypeError(`marching-cubes extension wrapper authority is unavailable`);let l=ho.get(r);if(l){let e=n.isovalue??l.descriptor.isovalue;if(r!==t||e!==l.descriptor.isovalue||!Ko(l)||ho.get(r)!==l)throw TypeError(`marching-cubes extraction requires the active exact successor volume binding`)}let u=await s();if(l&&!Ko(l))throw TypeError(`marching-cubes successor volume changed while the extension adapter was resolving`);let d=await c.preflight(n);if(l&&!Ko(l))throw TypeError(`marching-cubes successor volume changed during extension preflight`);if(d.ok===!1){let e={schema:eo,status:`extension-surface-preflight-blocked`,reason:d.reason,extensionOk:!1,extensionStatus:d.extensionPreflightStatus,extensionExecutionSchema:null,extensionSurfaceSchema:null,readyForUlgSurfaceVertexRows:!1,requiresUlgVertexRowTranslation:!0,requiresUlgDrawMetadata:!0,hotLoopSafe:!1,rendererIntegration:`blocked-before-extension-extraction`};return{schema:eo,status:e.status,reason:e.reason,backend:a,adapterSchema:c.schema,extensionAdapterSchema:u?.schema??null,adapterId:i,ownsDevice:!1,preflight:d,summary:e,extensionExecution:null,surfaceVertexSchema:null,surfaceDrawSchema:null,surfaceDrawIndirectSchema:null,readyForUlgSurfaceVertexRows:!1,requiresUlgVertexRowTranslation:!0,requiresUlgDrawMetadata:!0,hotLoopSafe:!1,rendererIntegration:e.rendererIntegration}}let f=await u.extractSurface({...n,volume:n.volume||t}),p=f?.result??null,m=p?.release,h=!1;try{let t=rs(f),o=l?ts(f,t):null;if(o)for(let e of[o.positionBuffer,o.normalBuffer,o.positionRows,o.actualVertexCounterBuffer,o.drawIndirectBuffer])Co(_o,e);if(l&&!Ko(l))throw TypeError(`marching-cubes successor volume changed during extension extraction`);let s={schema:eo,status:t.status,reason:t.reason,backend:a,adapterSchema:c.schema,extensionAdapterSchema:u?.schema??null,adapterId:i,ownsDevice:!1,preflight:d,summary:t,extensionExecution:f,webgpuStatus:f?.webgpuStatus??null,errors:f?.errors||[],errorName:t.extensionErrorName,errorStatus:t.extensionErrorStatus,errorStage:t.extensionErrorStage,errorStack:t.extensionErrorStack,surfaceVertexSchema:t.surfaceVertexSchema,surfaceDrawSchema:t.surfaceDrawSchema,surfaceDrawIndirectSchema:t.surfaceDrawIndirectSchema,readyForUlgSurfaceVertexRows:t.readyForUlgSurfaceVertexRows,requiresUlgVertexRowTranslation:t.requiresUlgVertexRowTranslation,requiresUlgDrawMetadata:t.requiresUlgDrawMetadata,hotLoopSafe:t.hotLoopSafe,rendererIntegration:t.rendererIntegration};if(l){if(o.resultIsovalue!==l.descriptor.isovalue)throw TypeError(`marching-cubes successor output isovalue does not match its authenticated descriptor`);let t=[o.positionBuffer,o.normalBuffer,o.actualVertexCounterBuffer,o.drawIndirectBuffer].filter(Boolean);if(t.includes(l.scalarBuffer)||new Set(t).size!==t.length)throw TypeError(`marching-cubes successor output resources must be distinct from the source volume and from one another`);let i={active:!0,device:e,wrapper:c,volume:r,descriptor:l.descriptor,sourceFamily:l.sourceFamily,scalarBuffer:l.scalarBuffer,wrappedExecution:s,extensionExecution:f,extensionResult:o.result,executionSummaryFingerprint:o.summaryFingerprint,positionBuffer:o.positionBuffer,normalBuffer:o.normalBuffer,positionRows:o.positionRows,positionRowsBytes:bo(o.positionRows),actualVertexCounterBuffer:o.actualVertexCounterBuffer,drawIndirectBuffer:o.drawIndirectBuffer,surfaceGenerationId:o.surfaceGenerationId,volumeGenerationId:o.volumeGenerationId,resultIsovalue:o.resultIsovalue,releaseMethod:null,isovalue:n.isovalue??l.descriptor.isovalue},a=o.result?.release;if(typeof a!=`function`)throw TypeError(`marching-cubes successor output requires an authenticated release lifecycle`);{let e=function(...e){return i.active=!1,a.apply(this,e)};try{o.result.release=e}catch{throw TypeError(`marching-cubes successor output lifecycle cannot be authenticated`)}if(o.result.release!==e)throw TypeError(`marching-cubes successor output lifecycle cannot be authenticated`);i.releaseMethod=e}So(_o,i.positionBuffer,i),So(_o,i.normalBuffer,i),So(_o,i.positionRows,i),So(_o,i.actualVertexCounterBuffer,i),So(_o,i.drawIndirectBuffer,i),go.set(s,i),f&&typeof f==`object`&&go.set(f,i)}return h=!0,s}catch(e){if(!h){let e=null;try{e=ts(f)}catch{}let t=l?.scalarBuffer??null,n=[e?.positionBuffer,e?.normalBuffer,e?.actualVertexCounterBuffer,e?.drawIndirectBuffer,p?.positionBuffer,p?.vertexBuffer,p?.buffer,p?.normalBuffer,p?.packedNormalBuffer,p?.actualVertexCounterBuffer,p?.vertexCounterBuffer,p?.drawIndirectBuffer].filter(e=>e&&typeof e==`object`);if(!(t&&n.includes(t))&&typeof m==`function`)try{await m.call(p)}catch{}}throw e}}};return yo.set(c,Object.freeze({device:e,volume:t})),c}function as(e,t=null){let n=go.get(e);if(!n){if(t||wo(e)||wo(e?.result))throw TypeError(`marching-cubes translation rejects unbranded or partial successor lineage`);return null}let r=e===n.wrappedExecution?n.extensionExecution:e,i=ts(r),a=i.result;if(n.active!==!0||t&&t!==n.sourceFamily||!Object.isFrozen(n.descriptor)||!Wo(n.descriptor,{device:n.device,sourceFamily:n.sourceFamily})||!Ko(ho.get(n.volume))||r!==n.extensionExecution||a!==n.extensionResult||i.summaryFingerprint!==n.executionSummaryFingerprint||i.positionBuffer!==n.positionBuffer||i.normalBuffer!==n.normalBuffer||i.positionRows!==n.positionRows||!xo(i.positionRows,n.positionRowsBytes)||i.actualVertexCounterBuffer!==n.actualVertexCounterBuffer||i.drawIndirectBuffer!==n.drawIndirectBuffer||i.surfaceGenerationId!==n.surfaceGenerationId||i.volumeGenerationId!==n.volumeGenerationId||i.resultIsovalue!==n.resultIsovalue||n.releaseMethod!=null&&a?.release!==n.releaseMethod)throw TypeError(`marching-cubes output does not match its authenticated successor extraction`);return n}function os(e,t=null){let n=go.get(e);if(!n)return null;let r=e===n.wrappedExecution?n.extensionExecution:e,i=ts(r),a=mo.get(n.descriptor);if(n.active!==!0||t&&t!==n.sourceFamily||!Object.isFrozen(n.descriptor)||!Uo(n.descriptor,a,{device:n.device,sourceFamily:n.sourceFamily})||r!==n.extensionExecution||i.result!==n.extensionResult||i.summaryFingerprint!==n.executionSummaryFingerprint||i.positionBuffer!==n.positionBuffer||i.normalBuffer!==n.normalBuffer||i.positionRows!==n.positionRows||!xo(i.positionRows,n.positionRowsBytes)||i.actualVertexCounterBuffer!==n.actualVertexCounterBuffer||i.drawIndirectBuffer!==n.drawIndirectBuffer||i.surfaceGenerationId!==n.surfaceGenerationId||i.volumeGenerationId!==n.volumeGenerationId||i.resultIsovalue!==n.resultIsovalue||n.releaseMethod!=null&&i.result?.release!==n.releaseMethod)throw TypeError(`sealed marching-cubes output no longer matches its authenticated successor extraction`);return n}function ss(e,{device:t,sourceFamily:n=null,descriptor:r=null}={}){try{let i=as(e,n);return!!(i&&i.device===t&&i.sourceFamily===n&&(!r||i.descriptor===r))}catch{return!1}}function cs(e,{device:t,surfaceIndex:n,isolation:r,sourceVoxelLinearIndex:i,positionTransform:a,positionTransformResolution:o,fieldPadding:s,refEdgeM:c,fieldGradient:l=null,positionRows:u=null,positionClampMinM:d=null,positionClampMaxM:f=null}={}){if(!e)return null;let p=e.descriptor,m=p.dims?.[0]??null;if(t!==e.device||n!==p.surfaceIndex||i!==p.fieldOffset||r!=null&&r!==p.isovalue||a!=null&&a!==p.positionTransform||o!=null&&o!==m||s!=null&&s!==p.fieldPadding||c!=null&&c!==p.refEdgeM||u!=null&&u!==e.positionRows||d!=null||f!=null||l!=null&&(l.buffer!==p.scalarBuffer||l.scalarOffsetFloats!==p.scalarOffset||l.rowStrideFloats!==p.cellRowStrideFloats||l.resolution!==m))throw TypeError(`successor surface translation inputs do not match the authenticated extraction descriptor`);return{descriptor:p,surfaceIndex:p.surfaceIndex,isolation:p.isovalue,sourceVoxelLinearIndex:p.fieldOffset,positionTransform:p.positionTransform,positionTransformResolution:m,fieldPadding:p.fieldPadding,refEdgeM:p.refEdgeM,fieldGradient:Object.freeze({buffer:p.scalarBuffer,scalarOffsetFloats:p.scalarOffset,rowStrideFloats:p.cellRowStrideFloats,resolution:m}),positionRows:e.positionRows}}function ls(e){let t=e?.surfaceVertices??null,n=e?.surfaceDraw??null,r=t?.surfaces??null,i=n?.surfaces??null,a=r?.[0]??null,o=i?.[0]??null,s=o;return{surfaceVertices:t,surfaceDraw:n,surfaceVerticesSurfaces:r,surfaceDrawSurfaces:i,surfaceVerticesSurface:a,surfaceDrawSurface:o,vertexRows:t?.vertexRows??null,drawRows:n?.drawRows??null,drawIndirectRows:n?.drawIndirectRows??null,compactedVertexRows:n?.compactedVertexRows??null,vertexRowsBuffer:t?.vertexRowsBuffer??null,drawRowsBuffer:n?.drawRowsBuffer??null,drawIndirectRowsBuffer:n?.drawIndirectRowsBuffer??null,compactedVertexRowsBuffer:n?.compactedVertexRowsBuffer??null,surfaceVerticesCompactPositionRowsBuffer:t?.compactPositionRowsBuffer??null,surfaceDrawCompactPositionRowsBuffer:n?.compactPositionRowsBuffer??null,surfaceVerticesCompactNormalRowsBuffer:t?.compactNormalRowsBuffer??null,surfaceDrawCompactNormalRowsBuffer:n?.compactNormalRowsBuffer??null,surfaceDrawRenderFieldGradientVolume:n?.renderFieldGradientVolume??null,surfaceDrawRenderFieldGradientBuffer:n?.renderFieldGradientVolume?.buffer??null,translationCompactNormalRowsBuffer:e?.compactNormalRowsBuffer??null,translationPositionTransform:e?.positionTransform??null,surfaceVerticesPositionTransform:t?.positionTransform??null,surfaceDrawPositionTransform:n?.positionTransform??null,surfaceVertexRowLayout:t?.rowLayout??null,surfaceDrawRowLayout:n?.rowLayout??null,surfaceDrawIndirectRowLayout:n?.drawIndirectRowLayout??null,structuralFingerprint:JSON.stringify({surfaceVertexRowLayout:t?.rowLayout??null,surfaceVertexRowStrideFloats:t?.rowStrideFloats??null,surfaceDrawRowLayout:n?.rowLayout??null,surfaceDrawRowStrideFloats:n?.rowStrideFloats??null,surfaceDrawIndirectRowLayout:n?.drawIndirectRowLayout??null,surfaceDrawIndirectRowStrideUints:n?.drawIndirectRowStrideUints??null,positionClamp:e?.positionClamp??null,surfaceVertexPositionClamp:t?.positionClamp??null,surfaceDrawPositionClamp:n?.positionClamp??null,surfaceVerticesSurfaces:r,surfaceDrawSurfaces:i}),renderConsumptionFingerprint:JSON.stringify({directCompactPositionDraw:n?.directCompactPositionDraw===!0,sourceVertexRowCount:n?.sourceVertexRowCount??null,sourceVertexCount:n?.sourceVertexCount??null,sourceVertexCountMode:n?.sourceVertexCountMode??null,vertexCount:n?.vertexCount??null,triangleCount:n?.triangleCount??null,compactPositionRowsBufferRetained:n?.compactPositionRowsBufferRetained??null,compactPositionRowsBufferByteLength:n?.compactPositionRowsBufferByteLength??null,compactPositionRowsBufferRowCount:n?.compactPositionRowsBufferRowCount??null,compactPositionRowsVertexCount:n?.compactPositionRowsVertexCount??null,compactPositionRowsStrideFloats:n?.compactPositionRowsStrideFloats??null,compactPositionRowsStrideBytes:n?.compactPositionRowsStrideBytes??null,compactPositionRowsFormat:n?.compactPositionRowsFormat??null,compactPositionRowsSchema:n?.compactPositionRowsSchema??null,compactPositionRowsOwnership:n?.compactPositionRowsOwnership??null,compactPositionRowsSurfaceGenerationId:n?.compactPositionRowsSurfaceGenerationId??null,compactPositionRowsVolumeGenerationId:n?.compactPositionRowsVolumeGenerationId??null,compactNormalRowsBufferRetained:n?.compactNormalRowsBufferRetained??null,compactNormalRowsBufferByteLength:n?.compactNormalRowsBufferByteLength??null,compactNormalRowsBufferRowCount:n?.compactNormalRowsBufferRowCount??null,compactNormalRowsSchema:n?.compactNormalRowsSchema??null,compactNormalRowsDescriptorSchema:n?.compactNormalRowsDescriptorSchema??null,compactNormalRowsLayoutName:n?.compactNormalRowsLayoutName??null,compactNormalRowsEncoding:n?.compactNormalRowsEncoding??null,compactNormalRowsSemantic:n?.compactNormalRowsSemantic??null,compactNormalRowsSourceSemantic:n?.compactNormalRowsSourceSemantic??null,compactNormalRowsNormalSign:n?.compactNormalRowsNormalSign??null,compactNormalRowsSurfaceGenerationId:n?.compactNormalRowsSurfaceGenerationId??null,compactNormalRowsPairedPositionSurfaceGenerationId:n?.compactNormalRowsPairedPositionSurfaceGenerationId??null,compactNormalRowsVolumeGenerationId:n?.compactNormalRowsVolumeGenerationId??null,compactNormalRowsSameSubmitAsPosition:n?.compactNormalRowsSameSubmitAsPosition??null,compactNormalRowsLifetimeOwner:n?.compactNormalRowsLifetimeOwner??null,compactNormalRowsPairedWithPositionBuffer:n?.compactNormalRowsPairedWithPositionBuffer??null,compactNormalRowsProducerStage:n?.compactNormalRowsProducerStage??null,compactNormalRowsTimestampSpanLabel:n?.compactNormalRowsTimestampSpanLabel??null,compactNormalRowsAdditionalSubmitCount:n?.compactNormalRowsAdditionalSubmitCount??null,compactNormalRowsOwnership:n?.compactNormalRowsOwnership??null,surfaceCount:n?.surfaceCount??null,activeSurfaceCount:n?.activeSurfaceCount??null,compactedVertexRowsBufferRetained:n?.compactedVertexRowsBufferRetained??null,compactedVertexRowsBufferByteLength:n?.compactedVertexRowsBufferByteLength??null,renderFieldGradientVolumePresent:n?.renderFieldGradientVolume!=null,renderFieldGradientDims:n?.renderFieldGradientVolume?.dims??null,renderFieldGradientScalarStrides:n?.renderFieldGradientVolume?.scalarStrides??null,renderFieldGradientScalarOffset:n?.renderFieldGradientVolume?.scalarOffset??null,drawIndirectRowsBufferRetained:n?.drawIndirectRowsBufferRetained??null,drawIndirectRowsBufferByteLength:n?.drawIndirectRowsBufferByteLength??null,drawIndirectRowsOwnership:n?.drawIndirectRowsOwnership??null,directCompactPositionDrawIndirectSource:n?.directCompactPositionDrawIndirectSource??null,readbackMode:n?.readbackMode??null,positionTransformStatus:n?.positionTransformStatus??null,positionClampStatus:n?.positionClampStatus??null,density:n?.density??null,isolation:n?.isolation??null,sourceVoxelLinearIndex:n?.sourceVoxelLinearIndex??null,fallbackNormal:n?.fallbackNormal??null}),primitiveFingerprint:JSON.stringify({status:e?.status??null,backend:e?.backend??null,sourceVertexCount:e?.sourceVertexCount??null,translatedVertexCount:e?.translatedVertexCount??null,triangleCount:e?.triangleCount??null,directCompactPositionDraw:e?.directCompactPositionDraw===!0,compactPositionRowsSurfaceGenerationId:e?.compactPositionRowsSurfaceGenerationId??null,compactPositionRowsVolumeGenerationId:e?.compactPositionRowsVolumeGenerationId??null,compactNormalRowsSurfaceGenerationId:e?.compactNormalRowsSurfaceGenerationId??null,compactNormalRowsPairedPositionSurfaceGenerationId:e?.compactNormalRowsPairedPositionSurfaceGenerationId??null,compactNormalRowsVolumeGenerationId:e?.compactNormalRowsVolumeGenerationId??null,positionTransformStatus:e?.positionTransformStatus??null,surfaceVertexStatus:t?.status??null,surfaceVertexCount:t?.vertexCount??null,surfaceVertexTriangleCount:t?.triangleCount??null,surfaceDrawStatus:n?.status??null,surfaceDrawVertexCount:n?.vertexCount??null,surfaceDrawTriangleCount:n?.triangleCount??null,surfaceIndex:s?.surfaceIndex??null,indirectOffsetBytes:s?.indirectOffsetBytes??null})}}function us({translation:e,extractionLineage:t}={}){if(!e||!t)return null;if(as(t.extensionExecution,t.sourceFamily)!==t)throw TypeError(`successor surface publication requires the still-active exact extraction lineage`);let n=ls(e),r={active:!0,device:t.device,sourceFamily:t.sourceFamily,descriptor:t.descriptor,extensionExecution:t.extensionExecution,extractionLineage:t,translation:e,...n,vertexRowsBytes:bo(n.vertexRows),drawRowsBytes:bo(n.drawRows),drawIndirectRowsBytes:bo(n.drawIndirectRows),compactedVertexRowsBytes:bo(n.compactedVertexRows)};return vo.set(e,r),n.surfaceVertices&&vo.set(n.surfaceVertices,r),n.surfaceDraw&&vo.set(n.surfaceDraw,r),r}function ds(e){let t=vo.get(e);t&&(t.active=!1)}function fs(e,{device:t,sourceFamily:n=e?.schroederSpatialSourceFamily??null,descriptor:r=null,extensionExecution:i=null}={}){let a=vo.get(e);if(!a||a.active!==!0||a.device!==t||a.sourceFamily!==n||r&&a.descriptor!==r||i&&a.extensionExecution!==i)return!1;let o=null;try{o=os(a.extensionExecution,a.sourceFamily)}catch{return!1}let s=ls(a.translation);return!!(o===a.extractionLineage&&Eo(a.translation,a.sourceFamily)&&Eo(a.surfaceVertices,a.sourceFamily)&&Eo(a.surfaceDraw,a.sourceFamily)&&a.translation?.surfaceVertices===a.surfaceVertices&&a.translation?.surfaceDraw===a.surfaceDraw&&s.surfaceVertices===a.surfaceVertices&&s.surfaceDraw===a.surfaceDraw&&s.surfaceVerticesSurfaces===a.surfaceVerticesSurfaces&&s.surfaceDrawSurfaces===a.surfaceDrawSurfaces&&s.surfaceVerticesSurface===a.surfaceVerticesSurface&&s.surfaceDrawSurface===a.surfaceDrawSurface&&s.vertexRows===a.vertexRows&&s.drawRows===a.drawRows&&s.drawIndirectRows===a.drawIndirectRows&&s.compactedVertexRows===a.compactedVertexRows&&xo(s.vertexRows,a.vertexRowsBytes)&&xo(s.drawRows,a.drawRowsBytes)&&xo(s.drawIndirectRows,a.drawIndirectRowsBytes)&&xo(s.compactedVertexRows,a.compactedVertexRowsBytes)&&s.vertexRowsBuffer===a.vertexRowsBuffer&&s.drawRowsBuffer===a.drawRowsBuffer&&s.drawIndirectRowsBuffer===a.drawIndirectRowsBuffer&&s.compactedVertexRowsBuffer===a.compactedVertexRowsBuffer&&s.surfaceVerticesCompactPositionRowsBuffer===a.surfaceVerticesCompactPositionRowsBuffer&&s.surfaceDrawCompactPositionRowsBuffer===a.surfaceDrawCompactPositionRowsBuffer&&s.surfaceVerticesCompactNormalRowsBuffer===a.surfaceVerticesCompactNormalRowsBuffer&&s.surfaceDrawCompactNormalRowsBuffer===a.surfaceDrawCompactNormalRowsBuffer&&s.surfaceDrawRenderFieldGradientVolume===a.surfaceDrawRenderFieldGradientVolume&&s.surfaceDrawRenderFieldGradientBuffer===a.surfaceDrawRenderFieldGradientBuffer&&s.translationCompactNormalRowsBuffer===a.translationCompactNormalRowsBuffer&&s.translationPositionTransform===a.translationPositionTransform&&s.surfaceVerticesPositionTransform===a.surfaceVerticesPositionTransform&&s.surfaceDrawPositionTransform===a.surfaceDrawPositionTransform&&s.translationPositionTransform===a.descriptor.positionTransform&&s.surfaceVerticesPositionTransform===a.descriptor.positionTransform&&s.surfaceDrawPositionTransform===a.descriptor.positionTransform&&s.surfaceVertexRowLayout===a.surfaceVertexRowLayout&&s.surfaceDrawRowLayout===a.surfaceDrawRowLayout&&s.surfaceDrawIndirectRowLayout===a.surfaceDrawIndirectRowLayout&&s.structuralFingerprint===a.structuralFingerprint&&s.renderConsumptionFingerprint===a.renderConsumptionFingerprint&&s.primitiveFingerprint===a.primitiveFingerprint)}async function ps({device:e,extensionExecution:t,schroederSpatialSourceFamily:i=null,surfaceIndex:a=0,materialId:o=0,phaseId:s=0,opticalStateId:c=0,material:u=null,phase:f=null,renderKey:p=null,surfaceKey:g=null,density:_=0,isolation:v=null,sourceVoxelLinearIndex:y=0,fallbackNormal:b=[0,1,0],transparencyClassId:x=0,depthWriteFlag:S=1,renderOrder:C=null,positionTransform:w=null,positionTransformResolution:T=null,fieldPadding:E=null,refEdgeM:D=null,positionGridBias:O=-.5,positionClampMinM:k=null,positionClampMaxM:A=null,fieldGradient:j=null,readbackMode:M=lo,compactSummaryReadback:N=!1,translateVertexRows:ee=!0,allowExtensionDrawIndirectBuffer:P=!1,retainVertexRowsBuffer:F=!0,retainDrawRowsBuffer:I=!0,retainDrawIndirectRowsBuffer:te=!0,waitForQueueCompletion:ne=!0,onProgress:ie=null}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu requires a WebGPU-like device`);let ae=as(t,i),L=ae?.sourceFamily??null;if(L){let t=cs(ae,{device:e,surfaceIndex:a,isolation:v,sourceVoxelLinearIndex:y,positionTransform:w,positionTransformResolution:T,fieldPadding:E,refEdgeM:D,fieldGradient:j,positionClampMinM:k,positionClampMaxM:A});a=t.surfaceIndex,v=t.isolation,y=t.sourceVoxelLinearIndex,w=t.positionTransform,T=t.positionTransformResolution,E=t.fieldPadding,D=t.refEdgeM,j=t.fieldGradient,k=null,A=null}let R=rs(t);if(R.extensionOk!==!0)throw TypeError(R.reason||`extension surface execution was not successful`);let oe=$o(t?.result||null).buffer;if(!oe||R.extensionBufferRetained!==!0)throw TypeError(`buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu requires a retained extension surface buffer`);Qo(t),L&&re(L,{device:e,particleCount:L.particleCount});let z=M===lo,B=!!(z&&ee===!1);if(!z&&ee===!1)throw TypeError(`direct compact-position surface draw metadata requires no-full-readback mode`);let V=Math.max(3,Math.round($(R.extensionVertexStrideFloats,4))),H=Math.max(0,Math.round($(R.extensionVertexCount,0))),se=R.extensionVertexCountMode??null,ce=t?.result||null,U=es(ce);if(B&&R.extensionPackedNormalReady!==!0)throw TypeError(`direct compact-position surface draw requires generation-matched packed normals (${R.extensionPackedNormalStatus})`);if(B&&U.normalSign!==-1)throw TypeError(`ULG SPH density surfaces require packed normalSign=-1`);let W=ce?.actualVertexCounterBuffer||ce?.vertexCounterBuffer||null,G=Math.max(0,Math.round($(ce?.actualVertexCounterBufferByteLength??ce?.vertexCounterBufferByteLength??W?.size,0))),le=ce?.drawIndirectBuffer||null,ue=Math.max(0,Math.round($(ce?.drawIndirectBufferByteLength??le?.size,0))),de=W,pe=!1,he=Math.floor(H/3),xe=he*3,Se=Math.max(0,Math.round($(a,0))),Ce=$(o,0),we=$(s,0),Te=$(c,0),Ee=$(_,0),De=$(v??t?.result?.isovalue??t?.isovalue,0),Oe=Po(b),ke=w||Fo({resolution:T,fieldPadding:E,refEdgeM:D,positionGridBias:O}),Ae=No({min:k,max:A}),je=Lo({positionTransform:ke,positionClamp:Ae}),Me=C==null?Se:$(C,Se),Ne=$(x,0),Pe=$(S,1),Fe=xe*h.length*Float32Array.BYTES_PER_ELEMENT,Ie=B?0:Fe,Le=m.length*Float32Array.BYTES_PER_ELEMENT,Re=n.length*Uint32Array.BYTES_PER_ELEMENT,ze=!!(B&&P&&!N&&le&&ue>=Re),Be=ze?`webgpu-marching-cubes-extension-draw-indirect-buffer`:`ulg-compact-position-draw-metadata-kernel`,Ve=ze?`extension-owned-retained-buffer`:`ulg-owned-retained-buffer`,He=typeof ie==`function`?(e,t={})=>{try{ie({status:e,stage:`webgpu-marching-cubes-extension-surface-translation`,sourceVertexCount:H,sourceVertexCountMode:se,translatedVertexCount:xe,triangleCount:he,vertexRowsByteLength:Ie,translatedVertexRowsByteLength:Fe,drawRowsByteLength:Le,drawIndirectRowsByteLength:Re,directCompactPositionDraw:B,directCompactPositionDrawIndirectSource:Be,drawIndirectRowsOwnership:Ve,readbackMode:z?lo:co,compactSummaryReadback:!!N,...t})}catch{}}:()=>{};He(`extension-surface-translation-kernel-started`);let Ue=new Set,We=!1,Ge=t=>{let n=e.createBuffer(t);return Ue.add(n),n},Ke=e=>{if(!e||!Ue.delete(e))return!1;try{e.destroy?.()}catch{}return!0},qe=e=>(e&&Ue.delete(e),e);try{let t=null;B||(t=Ge({label:`ulg-sph-extension-surface-vertices`,size:Math.max(4,Ie),usage:uo.STORAGE|uo.VERTEX|uo.COPY_SRC|uo.COPY_DST}));let i=B?`skipped-direct-compact-position-draw`:z?`skipped-no-full-readback-indirect-draw`:`cleared-for-readback`;!B&&!z&&Ie>0&&e.queue.writeBuffer(t,0,new Float32Array(xe*h.length));let a=new Float32Array(m.length);ze&&Jo(a,0,{surfaceIndex:Se,materialId:Ce,phaseId:we,opticalStateId:Te,vertexOffset:0,vertexCount:xe,triangleOffset:0,triangleCount:he,renderOrder:Me,transparencyClassId:Ne,depthWriteFlag:Pe,status:+(he>0),boundsCenterM:je?.centerM??[0,0,0],boundsRadiusM:je?.radiusM??0});let o=Ge({label:`ulg-sph-extension-surface-draw`,size:Math.max(4,Le),usage:uo.STORAGE|uo.COPY_SRC|uo.COPY_DST});e.queue.writeBuffer(o,0,a);let s=ze?le:Ge({label:`ulg-sph-extension-surface-draw-indirect`,size:Math.max(4,Re),usage:uo.STORAGE|uo.INDIRECT|uo.COPY_SRC|uo.COPY_DST});ze||e.queue.writeBuffer(s,0,new Uint32Array(n.length));let c=ze?null:Ge({label:`ulg-sph-extension-surface-translation-params`,size:160,usage:uo.UNIFORM|uo.COPY_DST});!de&&!ze&&(de=Ge({label:`ulg-sph-extension-surface-source-vertex-count`,size:4,usage:uo.STORAGE|uo.COPY_DST}),e.queue.writeBuffer(de,0,new Uint32Array([H])),pe=!0);let _=j?.buffer&&Number.isFinite(j.resolution)&&j.resolution>0?{buffer:j.buffer,resolution:Math.round(j.resolution),scalarOffsetFloats:Math.max(0,Math.round(Number(j.scalarOffsetFloats)||0)),rowStrideFloats:Math.max(1,Math.round(Number(j.rowStrideFloats)||1))}:null;ze||e.queue.writeBuffer(c,0,Yo({vertexCount:H,sourceStrideFloats:V,surfaceIndex:Se,triangleCount:he,materialId:Ce,phaseId:we,opticalStateId:Te,density:Ee,isolation:De,sourceVoxelLinearIndex:y,transparencyClassId:Ne,depthWriteFlag:Pe,renderOrder:Me,fallbackNormal:Oe,positionTransform:ke,positionClamp:Ae,surfaceBounds:je,fieldGradient:_})),He(`extension-surface-translation-buffers-ready`);let v=ze?null:B?fe(e,{cacheKey:`ulg-sph-webgpu-marching-cubes-extension-compact-surface-draw:v1`,label:`ulg-sph-webgpu-marching-cubes-extension-compact-surface-draw`,code:Oo,entryPoint:`main`,bindings:[K(0,`storage`),K(1,`storage`),K(2,`uniform`),K(3,`read-only-storage`)]}):fe(e,{cacheKey:`ulg-sph-webgpu-marching-cubes-extension-surface-translation:v3-degenerate-cull`,label:`ulg-sph-webgpu-marching-cubes-extension-surface-translation`,code:Do,entryPoint:`main`,bindings:[K(0,`read-only-storage`),K(1,`storage`),K(2,`storage`),K(3,`storage`),K(4,`uniform`),K(5,`read-only-storage`),K(6,`read-only-storage`)]}),b=ze?`skipped-extension-draw-indirect-buffer`:v.cacheStatus??null,x=null,S=null,C=0,w=null;if(ze)He(`extension-surface-translation-command-skipped`,{reason:`using extension-owned drawIndirectBuffer for direct compact-position draw`,workgroupCountX:C});else{let{pipeline:n,bindGroupLayout:r}=v;x=e.createBindGroup({layout:r,entries:B?[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:s}},{binding:2,resource:{buffer:c}},{binding:3,resource:{buffer:de}}]:[{binding:0,resource:{buffer:oe}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:o}},{binding:3,resource:{buffer:s}},{binding:4,resource:{buffer:c}},{binding:5,resource:{buffer:de}},{binding:6,resource:{buffer:_?.buffer||(w=Ge({label:`ulg-sph-extension-surface-field-gradient-dummy`,size:4,usage:uo.STORAGE}))}}]}),S=e.createCommandEncoder();let i=S.beginComputePass();i.setPipeline(n),i.setBindGroup(0,x),C=B?1:Math.max(1,Math.ceil(Math.max(1,he)/po)),i.dispatchWorkgroups(C),i.end(),He(`extension-surface-translation-command-encoded`,{workgroupCountX:C})}let T=new Float32Array,E=ze?a:new Float32Array,D=new Uint32Array,O=!1,k=0,A=`not-submitted`,M=null,ee=!1;z?(ze?(A=`queue-work-not-required`,M=`extension-owned-draw-indirect-buffer`):ne&&e.queue?.onSubmittedWorkDone?(e.queue.submit([S.finish()]),We=!0,A=`queue-submitted`,M=`queue.submit`,await e.queue.onSubmittedWorkDone(),A=`queue-work-completed`,M=`queue.onSubmittedWorkDone`):(e.queue.submit([S.finish()]),We=!0,A=e.queue?.onSubmittedWorkDone&&!N?`queue-submitted-cleanup-deferred`:`queue-submitted-no-explicit-completion`,M=e.queue?.onSubmittedWorkDone&&!N?`deferred queue.onSubmittedWorkDone cleanup`:`queue.submit`,ee=!!(e.queue?.onSubmittedWorkDone&&!N)),N&&(E=new Float32Array(await Xo(e,o,Le,`ulg-sph-extension-surface-draw-summary-readback`)),O=!0,k=Le,A=`compact-summary-readback-map-completed`,M=`mapAsync(compact-summary-readback-buffer)`)):(e.queue.submit([S.finish()]),We=!0,A=`queue-submitted`,M=`queue.submit`,Ie>0&&(T=new Float32Array(await Xo(e,t,Ie,`ulg-sph-extension-surface-vertex-readback`))),E=new Float32Array(await Xo(e,o,Le,`ulg-sph-extension-surface-draw-readback`)),D=new Uint32Array(await Xo(e,s,Re,`ulg-sph-extension-surface-draw-indirect-readback`)),A=`readback-map-completed`,M=`mapAsync(readback-buffer)`,He(`extension-surface-translation-full-readback-complete`));let P=()=>{Ke(c),Ke(w),pe&&Ke(de)},re=!B&&(F||z),ie=I||z,Fe=te||z;re||Ke(t),ie||Ke(o),!Fe&&!ze&&Ke(s),ee?me(e,P):P();let Ue=Zo({surfaceIndex:Se,materialId:Ce,phaseId:we,opticalStateId:Te,material:u,phase:f,renderKey:p,surfaceKey:g,vertexCount:xe,triangleCount:he,renderOrder:Me,transparencyClassId:Ne,depthWriteFlag:Pe,status:!z||N?he>0?`surface-draw-ready`:`surface-draw-empty`:`surface-draw-summary-not-read`,boundsCenterM:je?.centerM??null,boundsRadiusM:je?.radiusM??null,indirectRowIndex:0,indirectOffsetBytes:0}),Je=W?`extension-gpu-vertex-counter`:`host-constant-vertex-count`,Ye=!!W,Xe=W?G:4,Ze=!!(oe&&R.extensionBufferRetained),Qe=Math.max(0,Math.round($(R.extensionVertexStrideBytes,V*Float32Array.BYTES_PER_ELEMENT)))*H,$e=ce?.surfaceGenerationId??null,et=ce?.volumeGenerationId??null,tt=!!(B&&U.buffer&&U.bufferRetained&&R.extensionPackedNormalReady),nt=tt?U.bufferByteLength:0,rt={compactNormalRowsBufferRetained:tt,compactNormalRowsBufferByteLength:nt,compactNormalRowsBufferRowCount:tt?U.rowCount:0,compactNormalRowsSchema:U.rowSchema,compactNormalRowsDescriptorSchema:U.descriptorSchema,compactNormalRowsLayoutName:U.layoutName,compactNormalRowsEncoding:U.encoding,compactNormalRowsSemantic:U.semantic,compactNormalRowsSourceSemantic:U.sourceSemantic,compactNormalRowsNormalSign:Number.isFinite(U.normalSign)?U.normalSign:null,compactNormalRowsSurfaceGenerationId:U.surfaceGenerationId,compactNormalRowsPairedPositionSurfaceGenerationId:U.pairedPositionSurfaceGenerationId,compactNormalRowsVolumeGenerationId:U.volumeGenerationId,compactNormalRowsSameSubmitAsPosition:U.sameSubmitAsPosition,compactNormalRowsLifetimeOwner:U.lifetimeOwner,compactNormalRowsPairedWithPositionBuffer:U.pairedWithPositionBuffer,compactNormalRowsProducerStage:U.producerStage,compactNormalRowsTimestampSpanLabel:U.timestampSpanLabel,compactNormalRowsAdditionalSubmitCount:U.additionalSubmitCount,compactNormalRowsOwnership:`extension-owned-retained-buffer`},it={translationPipelineCreated:!!v,translationBindGroupCreated:!!x,translationCommandEncoderCreated:!!S,translationWorkgroupCountX:C,translationSubmissionObserved:We},J={schema:r,backend:`webgpu`,...To(L),status:B?`surface-vertices-resident-extension-compact-position-direct`:z?`surface-vertices-resident-extension-compact-translation`:xe>0?`surface-vertices-ready`:`surface-vertices-empty`,sourceSurfaceExecutionSchema:R.extensionExecutionSchema,sourceSurfaceSchema:R.extensionSurfaceSchema,surfaceExtractionMethod:B?`webgpu-marching-cubes-extension-compact-position-direct`:`webgpu-marching-cubes-extension-compact-position-gpu-translation`,compactionMode:B?`webgpu-extension-compact-position-direct`:`webgpu-extension-compact-position-to-ulg-rows`,directCompactPositionDraw:B,positionTransform:ke,positionTransformStatus:ke.status,positionClamp:Ae,positionClampStatus:Ae.status,surfaceCount:1,rowLayout:[...h],rowStrideFloats:h.length,vertexRows:T,vertexRowsByteLength:T.byteLength,vertexCount:xe,vertexCountMode:se,triangleCount:he,maxVertexRows:xe,vertexRowsBufferByteLength:re?Ie:0,vertexRowsBufferRowCount:re?xe:0,vertexRowsBufferRetained:re,sourceVertexCount:H,sourceVertexCountMode:se,sourceVertexCounterMode:Je,sourceVertexCounterBufferBound:!!de,sourceVertexCounterBufferRetained:Ye,sourceVertexCounterBufferByteLength:Xe,translatedVertexCount:xe,ignoredTrailingVertexCount:H-xe,sourceVertexRowsBufferBound:!0,sourceVertexFormat:R.extensionVertexFormat,sourceVertexStrideFloats:V,compactPositionRowsBufferRetained:Ze,compactPositionRowsBufferByteLength:Qe,compactPositionRowsBufferRowCount:H,compactPositionRowsVertexCount:H,compactPositionRowsStrideFloats:V,compactPositionRowsStrideBytes:Math.max(0,Math.round($(R.extensionVertexStrideBytes,V*Float32Array.BYTES_PER_ELEMENT))),compactPositionRowsFormat:R.extensionVertexFormat,compactPositionRowsSchema:no,compactPositionRowsOwnership:`extension-owned-retained-buffer`,compactPositionRowsSurfaceGenerationId:$e,compactPositionRowsVolumeGenerationId:et,...rt,vertexRowsBufferClearStatus:i,translationPipelineCacheStatus:b,...it,directCompactPositionDrawIndirectSource:Be,drawIndirectRowsOwnership:Ve,extensionDrawIndirectBufferRetained:!!le,extensionDrawIndirectBufferByteLength:ue,readbackMode:z?lo:co,queueCompletionStatus:A,queueCompletionMethod:M,surfaceVertexReadback:!z,surfaces:[Ue],scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};re&&(J.vertexRowsBuffer=t),Ze&&(J.compactPositionRowsBuffer=oe),tt&&(J.compactNormalRowsBuffer=U.buffer);let at={schema:d,backend:`webgpu`,...To(L),status:B?`surface-draw-resident-extension-compact-position-direct`:z?`surface-draw-resident-extension-compact-translation`:he>0?`surface-draw-metadata-ready`:`surface-draw-metadata-empty`,sourceSurfaceVertexSchema:J.schema,sourceSurfaceVertexBackend:J.backend,surfaceCount:1,activeSurfaceCount:+(he>0),vertexCount:xe,vertexCountMode:se,sourceVertexCount:H,sourceVertexCountMode:se,sourceVertexCounterMode:Je,sourceVertexCounterBufferBound:!!de,sourceVertexCounterBufferRetained:Ye,sourceVertexCounterBufferByteLength:Xe,vertexRowsBufferClearStatus:i,translationPipelineCacheStatus:b,...it,directCompactPositionDrawIndirectSource:Be,drawIndirectRowsOwnership:Ve,extensionDrawIndirectBufferRetained:!!le,extensionDrawIndirectBufferByteLength:ue,triangleCount:he,rowLayout:[...m],rowStrideFloats:m.length,drawRows:E,drawRowsByteLength:Le,drawRowsBufferByteLength:ie?Le:0,drawRowsBufferRetained:ie,drawIndirectSchema:l,drawIndirectRowLayout:[...n],drawIndirectRowStrideUints:n.length,drawIndirectRows:D,drawIndirectRowsByteLength:Re,drawIndirectRowsBufferByteLength:Fe?Re:0,drawIndirectRowsBufferRetained:Fe,drawIndirectRowsOwnership:Ve,directCompactPositionDrawIndirectSource:Be,extensionDrawIndirectBufferRetained:!!le,extensionDrawIndirectBufferByteLength:ue,compactedVertexRows:z?new Float32Array:T,compactedVertexRowsByteLength:z?0:T.byteLength,compactedVertexRowsBufferByteLength:re?Ie:0,compactedVertexRowsBufferRetained:re,compactPositionRowsBufferRetained:Ze,compactPositionRowsBufferByteLength:Qe,compactPositionRowsBufferRowCount:H,compactPositionRowsVertexCount:H,compactPositionRowsStrideFloats:V,compactPositionRowsStrideBytes:Math.max(0,Math.round($(R.extensionVertexStrideBytes,V*Float32Array.BYTES_PER_ELEMENT))),compactPositionRowsFormat:R.extensionVertexFormat,compactPositionRowsSchema:no,compactPositionRowsOwnership:`extension-owned-retained-buffer`,compactPositionRowsSurfaceGenerationId:$e,compactPositionRowsVolumeGenerationId:et,...rt,directCompactPositionDraw:B,sourceVertexRowCount:xe,sourceVertexRowsBufferBound:!0,readbackMode:z?lo:co,queueCompletionStatus:A,queueCompletionMethod:M,surfaceDrawReadback:!z,surfaceDrawSummaryReadback:O,surfaceDrawSummaryReadbackByteLength:k,fullSurfaceDrawReadback:!z,compactionMode:B?`webgpu-extension-compact-position-direct-draw-metadata`:`webgpu-extension-compact-position-to-ulg-draw-metadata`,positionTransform:ke,positionTransformStatus:ke.status,positionClamp:Ae,positionClampStatus:Ae.status,surfaces:[Ue],scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};ie&&(at.drawRowsBuffer=o),Fe&&(at.drawIndirectRowsBuffer=s),re&&(at.compactedVertexRowsBuffer=t),Ze&&(at.compactPositionRowsBuffer=oe),tt&&(at.compactNormalRowsBuffer=U.buffer);let ot=_e({ledgerId:`sph-extension-surface:${Se}:${xe}:buffer-leases`,stateKey:`sph-extension-surface`,scope:`sph-extension-surface-buffer-leases`}),st=[],ct=({resourceKey:e,resourceKind:t,buffer:n,byteLength:r,rowCount:i,expectedConsumers:a,status:o=`resident-extension-surface-buffer-retained`})=>{q(ot,{resourceKey:e,resourceKind:t,stateFamily:`render-surface`,ownerStage:`webgpu-marching-cubes-extension-surface-translation`,producerStage:`webgpu-marching-cubes-extension-surface-translation`,source:`buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu`,status:o,retained:!0,byteLength:r,rowCount:i,bufferLabel:n?.label,expectedConsumers:a});let s=ye(ot,{resourceKey:e,consumerStage:a?.[0]||`surface-renderer`,reason:`retained-extension-surface-buffer`});st.push(s.leaseId)},lt=`extension-surface:vertex-rows:${xe}:${Ie}`,ut=`extension-surface:draw-rows:1:${Le}`,dt=`extension-surface:draw-indirect:1:${Re}`,ft=`extension-surface:compact-position:g${U.surfaceGenerationId??`unknown`}:${Qe}`,pt=`extension-surface:packed-normal:g${U.surfaceGenerationId??`unknown`}:${nt}`;B&&Ze&&ct({resourceKey:ft,resourceKind:`extension-owned-compact-position-buffer`,buffer:oe,byteLength:Qe,rowCount:H,expectedConsumers:[`surface-draw-renderer`,`diagnostics`],status:`resident-extension-surface-buffer-borrowed-generation-owned`}),tt&&ct({resourceKey:pt,resourceKind:`extension-owned-packed-normal-buffer`,buffer:U.buffer,byteLength:nt,rowCount:U.rowCount,expectedConsumers:[`surface-draw-renderer`,`diagnostics`],status:`resident-extension-surface-buffer-borrowed-generation-owned`}),re&&ct({resourceKey:lt,resourceKind:`extension-surface-vertex-rows-buffer`,buffer:t,byteLength:Ie,rowCount:xe,expectedConsumers:[`surface-draw-renderer`,`diagnostics`]}),ie&&ct({resourceKey:ut,resourceKind:`extension-surface-draw-rows-buffer`,buffer:o,byteLength:Le,rowCount:1,expectedConsumers:[`surface-draw-renderer`,`diagnostics`]}),Fe&&ct({resourceKey:dt,resourceKind:ze?`extension-owned-draw-indirect-buffer`:`extension-surface-draw-indirect-buffer`,buffer:s,byteLength:Re,rowCount:1,expectedConsumers:[`surface-draw-renderer`,`diagnostics`],status:ze?`resident-extension-surface-buffer-borrowed`:`resident-extension-surface-buffer-retained`});let Y={schema:ro,status:B?`extension-surface-compact-position-direct-resident-webgpu`:z?`extension-surface-translated-resident-webgpu`:`extension-surface-translated-to-ulg-rows`,reason:H===xe?null:`extension vertexCount was not divisible by 3; trailing vertices were ignored`,backend:`webgpu`,...To(L),summary:R,sourceBufferBound:!0,sourceBufferRetained:R.extensionBufferRetained,compactPositionRowsBufferRetained:Ze,compactPositionRowsBufferByteLength:Qe,compactPositionRowsVertexCount:H,compactPositionRowsStrideFloats:V,compactPositionRowsFormat:R.extensionVertexFormat,compactPositionRowsOwnership:`extension-owned-retained-buffer`,compactPositionRowsSurfaceGenerationId:$e,compactPositionRowsVolumeGenerationId:et,...rt,directCompactPositionDraw:B,sourceVertexCount:H,translatedVertexCount:xe,triangleCount:he,ignoredTrailingVertexCount:H-xe,sourceVertexFormat:R.extensionVertexFormat,sourceVertexStrideFloats:V,surfaceVertices:J,surfaceDraw:at,vertexRowsBufferClearStatus:i,translationPipelineCacheStatus:b,...it,directCompactPositionDrawIndirectSource:Be,drawIndirectRowsOwnership:Ve,extensionDrawIndirectBufferRetained:!!le,extensionDrawIndirectBufferByteLength:ue,positionTransform:ke,positionTransformStatus:ke.status,positionClamp:Ae,positionClampStatus:Ae.status,readbackMode:z?lo:co,queueCompletionStatus:A,queueCompletionMethod:M,hotLoopGpuTranslationRequired:!1,hotLoopUlgVertexRowExpansionSkipped:B,residentBufferLeaseLedger:ot,residentBufferLeaseSummary:ve(ot),residentBufferLeaseLedgerStatus:ot.status,residentBufferLeaseResourceCount:ot.resourceCount,residentBufferLeaseActiveLeaseCount:ot.activeLeaseCount};tt&&(Y.compactNormalRowsBuffer=U.buffer);let mt=()=>(Y.residentBufferLeaseSummary=ve(ot),Y.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseSummary.status,Y.residentBufferLeaseResourceCount=Y.residentBufferLeaseSummary.resourceCount,Y.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseSummary.activeLeaseCount,J.residentBufferLeaseSummary=Y.residentBufferLeaseSummary,J.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseLedgerStatus,J.residentBufferLeaseResourceCount=Y.residentBufferLeaseResourceCount,J.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseActiveLeaseCount,at.residentBufferLeaseSummary=Y.residentBufferLeaseSummary,at.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseLedgerStatus,at.residentBufferLeaseResourceCount=Y.residentBufferLeaseResourceCount,at.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseActiveLeaseCount,Y.residentBufferLeaseSummary),ht=new Set,gt=null,_t=(e,t)=>{ht.has(e)||(ht.add(e),console.debug?.(`[ext-surface-destroy] surface=${Se} key=${e} reason=${gt}`),t?.destroy?.())};return Y.releaseExtensionSurfaceBufferLeases=({status:e=`released`}={})=>{for(let t of st)be(ot,t,{status:e});return mt()},Y.destroyExtensionSurfaceBuffers=({force:e=!1,releaseLeases:n=!1,reason:r=`extension-surface-buffer-cleanup`}={})=>(gt=r,ds(Y),n&&Y.releaseExtensionSurfaceBufferLeases(),re&&ge(ot,lt,()=>{_t(lt,t)},{force:e,reason:r}),B&&Ze&&ge(ot,ft,null,{force:e,reason:r}),tt&&ge(ot,pt,null,{force:e,reason:r}),ie&&ge(ot,ut,()=>{_t(ut,o)},{force:e,reason:r}),Fe&&ge(ot,dt,ze?null:()=>{_t(dt,s)},{force:e,reason:r}),mt()),J.residentBufferLeaseLedger=ot,J.residentBufferLeaseSummary=Y.residentBufferLeaseSummary,J.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseLedgerStatus,J.residentBufferLeaseResourceCount=Y.residentBufferLeaseResourceCount,J.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseActiveLeaseCount,J.releaseExtensionSurfaceBufferLeases=Y.releaseExtensionSurfaceBufferLeases,J.destroyExtensionSurfaceBuffers=Y.destroyExtensionSurfaceBuffers,J.releaseSurfaceVertexBufferLeases=Y.releaseExtensionSurfaceBufferLeases,J.destroySurfaceVertexBuffers=Y.destroyExtensionSurfaceBuffers,at.residentBufferLeaseLedger=ot,at.residentBufferLeaseSummary=Y.residentBufferLeaseSummary,at.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseLedgerStatus,at.residentBufferLeaseResourceCount=Y.residentBufferLeaseResourceCount,at.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseActiveLeaseCount,at.releaseExtensionSurfaceBufferLeases=Y.releaseExtensionSurfaceBufferLeases,at.destroyExtensionSurfaceBuffers=Y.destroyExtensionSurfaceBuffers,at.releaseSurfaceDrawBufferLeases=Y.releaseExtensionSurfaceBufferLeases,at.destroySurfaceDrawBuffers=Y.destroyExtensionSurfaceBuffers,ae&&us({translation:Y,extractionLineage:ae}),re&&qe(t),ie&&qe(o),Fe&&!ze&&qe(s),Y}catch(t){let n=()=>{for(let e of[...Ue])Ke(e)};if(We)try{me(e,n)}catch{n()}else n();throw t}}var ms=`
struct RefractionProjectedPoint {
  uv: vec2<f32>,
  depth: f32,
  valid: f32,
};

struct RefractionWorldPoint {
  world_position: vec3<f32>,
  valid: f32,
};

struct RefractionSurfacePixel {
  pixel: vec2<u32>,
  uv: vec2<f32>,
  valid: f32,
};

struct RefractedPath {
  exit_uv: vec2<f32>,
  path_m: f32,
  valid: f32,
  exit_world: vec3<f32>,
  lateral_displacement_m: f32,
};

fn invalid_refracted_path() -> RefractedPath {
  return RefractedPath(
    vec2<f32>(0.0),
    0.0,
    0.0,
    vec3<f32>(0.0),
    0.0
  );
}

fn refraction_project_world_to_uv(
  world_position: vec3<f32>,
  view_projection: mat4x4<f32>
) -> RefractionProjectedPoint {
  let clip = view_projection * vec4<f32>(world_position, 1.0);
  if (!(clip.w > 1.0e-6)) {
    return RefractionProjectedPoint(vec2<f32>(0.0), 0.0, 0.0);
  }
  let ndc = clip.xyz / clip.w;
  let uv = vec2<f32>(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
  let depth = ndc.z * 0.5 + 0.5;
  let finite = all(uv == uv) && depth == depth
    && all(abs(uv) < vec2<f32>(1.0e20)) && abs(depth) < 1.0e20;
  let inside_view = all(uv >= vec2<f32>(0.001))
    && all(uv <= vec2<f32>(0.999))
    && depth >= 0.0 && depth <= 1.0;
  return RefractionProjectedPoint(
    uv,
    depth,
    select(0.0, 1.0, finite && inside_view)
  );
}

fn refraction_unproject_uv_depth(
  uv: vec2<f32>,
  depth: f32,
  inverse_view_projection: mat4x4<f32>
) -> RefractionWorldPoint {
  let input_valid = all(uv == uv) && depth == depth
    && all(uv >= vec2<f32>(0.0)) && all(uv <= vec2<f32>(1.0))
    && depth >= 0.0 && depth <= 1.0;
  if (!input_valid) {
    return RefractionWorldPoint(vec3<f32>(0.0), 0.0);
  }
  let ndc = vec3<f32>(
    uv.x * 2.0 - 1.0,
    1.0 - uv.y * 2.0,
    depth * 2.0 - 1.0
  );
  let world_h = inverse_view_projection * vec4<f32>(ndc, 1.0);
  if (!(abs(world_h.w) > 1.0e-8)) {
    return RefractionWorldPoint(vec3<f32>(0.0), 0.0);
  }
  let world_position = world_h.xyz / world_h.w;
  let finite = all(world_position == world_position)
    && all(abs(world_position) < vec3<f32>(1.0e20));
  return RefractionWorldPoint(
    world_position,
    select(0.0, 1.0, finite)
  );
}

fn refraction_surface_pixel(
  fragment_position_px: vec2<f32>,
  target_dimensions: vec2<u32>
) -> RefractionSurfacePixel {
  let finite = all(fragment_position_px == fragment_position_px)
    && all(abs(fragment_position_px) < vec2<f32>(1.0e20));
  if (!finite || target_dimensions.x <= 1u || target_dimensions.y <= 1u) {
    return RefractionSurfacePixel(vec2<u32>(0u), vec2<f32>(0.0), 0.0);
  }
  let floored = floor(fragment_position_px);
  let dimensions_f = vec2<f32>(target_dimensions);
  if (any(floored < vec2<f32>(0.0)) || any(floored >= dimensions_f)) {
    return RefractionSurfacePixel(vec2<u32>(0u), vec2<f32>(0.0), 0.0);
  }
  let pixel = vec2<u32>(floored);
  return RefractionSurfacePixel(
    pixel,
    (vec2<f32>(pixel) + vec2<f32>(0.5)) / dimensions_f,
    1.0
  );
}

fn refraction_rear_surface_admitted(
  front_depth: f32,
  back_depth: f32,
  entry_world: vec3<f32>,
  back_world: vec3<f32>,
  outward_normal: vec3<f32>,
  view_direction_to_camera: vec3<f32>,
  max_path_m: f32
) -> f32 {
  let scalar_inputs_finite = front_depth == front_depth
    && back_depth == back_depth
    && max_path_m == max_path_m
    && abs(front_depth) < 1.0e20
    && abs(back_depth) < 1.0e20
    && abs(max_path_m) < 1.0e20;
  let vector_inputs_finite = all(entry_world == entry_world)
    && all(back_world == back_world)
    && all(outward_normal == outward_normal)
    && all(view_direction_to_camera == view_direction_to_camera)
    && all(abs(entry_world) < vec3<f32>(1.0e20))
    && all(abs(back_world) < vec3<f32>(1.0e20))
    && all(abs(outward_normal) < vec3<f32>(1.0e20))
    && all(abs(view_direction_to_camera) < vec3<f32>(1.0e20));
  if (!scalar_inputs_finite || !vector_inputs_finite) {
    return 0.0;
  }
  if (!(front_depth >= 0.0 && front_depth <= 1.0
    && back_depth >= 0.0 && back_depth < 0.999999
    && back_depth > front_depth + 1.0e-5
    && max_path_m > 1.0e-6)) {
    return 0.0;
  }
  let normal_length_squared = dot(outward_normal, outward_normal);
  let view_length_squared = dot(view_direction_to_camera, view_direction_to_camera);
  if (!(normal_length_squared > 1.0e-8 && view_length_squared > 1.0e-8)) {
    return 0.0;
  }
  let normal = outward_normal / sqrt(normal_length_squared);
  let view_direction = view_direction_to_camera / sqrt(view_length_squared);
  if (!(dot(normal, view_direction) > 1.0e-5)) {
    return 0.0;
  }
  let to_back = back_world - entry_world;
  let rear_distance_m = length(to_back);
  let behind_entry = dot(to_back, -view_direction) > 1.0e-6;
  return select(
    0.0,
    1.0,
    rear_distance_m > 1.0e-6 && rear_distance_m <= max_path_m && behind_entry
  );
}

fn refracted_path_to_back_plane(
  entry_world: vec3<f32>,
  back_world: vec3<f32>,
  rear_surface_valid: f32,
  internal_direction: vec3<f32>,
  view_projection: mat4x4<f32>,
  max_path_m: f32
) -> RefractedPath {
  if (!(rear_surface_valid > 0.5)) {
    return invalid_refracted_path();
  }
  let thickness_axis = back_world - entry_world;
  let view_thickness_m = length(thickness_axis);
  if (!(view_thickness_m > 1.0e-6 && max_path_m > 1.0e-6)) {
    return invalid_refracted_path();
  }
  let axis = thickness_axis / view_thickness_m;
  let direction_length_squared = dot(internal_direction, internal_direction);
  if (!(direction_length_squared > 1.0e-8)) {
    return invalid_refracted_path();
  }
  let direction = internal_direction / sqrt(direction_length_squared);
  let axial_rate = dot(direction, axis);
  if (!(axial_rate > 1.0e-4)) {
    return invalid_refracted_path();
  }
  let path_m = view_thickness_m / axial_rate;
  if (!(path_m > 0.0 && path_m <= max_path_m)) {
    return invalid_refracted_path();
  }
  let exit_world = entry_world + direction * path_m;
  let projected = refraction_project_world_to_uv(exit_world, view_projection);
  if (!(projected.valid > 0.5)) {
    return invalid_refracted_path();
  }
  let lateral_displacement_m = length(exit_world - back_world);
  return RefractedPath(
    projected.uv,
    path_m,
    1.0,
    exit_world,
    lateral_displacement_m
  );
}

fn refraction_beer_lambert_transmission_rgb(
  absorption_coefficient_per_m: vec3<f32>,
  path_m: vec3<f32>
) -> vec3<f32> {
  let valid = all(absorption_coefficient_per_m == absorption_coefficient_per_m)
    && all(path_m == path_m)
    && all(absorption_coefficient_per_m >= vec3<f32>(0.0))
    && all(path_m >= vec3<f32>(0.0));
  if (!valid) {
    return vec3<f32>(0.0);
  }
  let optical_depth = min(
    absorption_coefficient_per_m * path_m,
    vec3<f32>(80.0)
  );
  return exp(-optical_depth);
}

fn refraction_beer_lambert_from_extinction_rgb(
  extinction_k: vec3<f32>,
  wavelength_m: vec3<f32>,
  path_m: vec3<f32>
) -> vec3<f32> {
  let valid = all(extinction_k == extinction_k)
    && all(wavelength_m == wavelength_m)
    && all(extinction_k >= vec3<f32>(0.0))
    && all(wavelength_m > vec3<f32>(0.0));
  if (!valid) {
    return vec3<f32>(0.0);
  }
  let absorption_coefficient_per_m = 12.566370614359172
    * extinction_k / wavelength_m;
  return refraction_beer_lambert_transmission_rgb(
    absorption_coefficient_per_m,
    path_m
  );
}
`,hs=`
struct BackgroundParams {
  cover_scale: vec2<f32>,
  pad0: vec2<f32>,
};

@group(0) @binding(0) var background_image: texture_2d<f32>;
@group(0) @binding(1) var background_sampler: sampler;
@group(0) @binding(2) var<uniform> params: BackgroundParams;

struct BackgroundVertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> BackgroundVertexOutput {
  let positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  let position = positions[vertex_index];
  var output: BackgroundVertexOutput;
  output.position = vec4<f32>(position, 1.0, 1.0);
  output.uv = vec2<f32>(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  return output;
}

fn background_color(input: BackgroundVertexOutput) -> vec4<f32> {
  let uv = (input.uv - vec2<f32>(0.5)) * params.cover_scale + vec2<f32>(0.5);
  return vec4<f32>(textureSample(background_image, background_sampler, uv).rgb, 1.0);
}

@fragment
fn fs_main(input: BackgroundVertexOutput) -> @location(0) vec4<f32> {
  return background_color(input);
}

struct BackgroundMrtOutput {
  @location(0) base: vec4<f32>,
  @location(1) composite: vec4<f32>,
};

@fragment
fn fs_staged_mrt_main(input: BackgroundVertexOutput) -> BackgroundMrtOutput {
  let color = background_color(input);
  var output: BackgroundMrtOutput;
  output.base = color;
  output.composite = color;
  return output;
}
`,gs=`
struct CameraUniform {
  view_projection: mat4x4<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  // The ids are constant per triangle; flat interpolation keeps them exact
  // even for degenerate (zero-area) marching-cubes triangles, whose
  // perspective barycentrics otherwise produce garbage ids that miss the
  // optical table and rasterize single blocked-red pixels.
  @location(1) @interpolate(flat) material_id: f32,
  @location(2) @interpolate(flat) phase_id: f32,
  @location(3) @interpolate(flat) optical_state_id: f32,
  @location(4) world_position: vec3<f32>,
  // Per-vertex field-sampled temperature, interpolated across the triangle so
  // emission varies per fragment (hot core, cooler rim). 0 = no field sample;
  // the emissive fn falls back to the per-surface uniform temperature.
  @location(5) emissive_temperature_k: f32,
};

// View direction for shading. The compact-position variant replaces this with
// the real camera-relative direction; the legacy vertex-row variant keeps a
// fixed plausible direction (its camera uniform is only a matrix).
fn resident_view_direction(world_position: vec3<f32>) -> vec3<f32> {
  return normalize(vec3<f32>(0.15, 0.25, 1.0));
}

// The compact production variant replaces this with the draw batch's admitted
// transparency class. Legacy vertex-row draws can only refract exact records.
fn refractive_draw_admitted() -> bool {
  return true;
}

// Legacy vertex-row draws retain the historical lighting exactly. The compact
// production variant replaces these helpers with its live scene-lighting
// uniform values without growing the retained camera ABI.
fn resident_ambient_irradiance() -> f32 {
  return 1.4;
}

fn resident_direct_light_scale() -> f32 {
  return 1.0;
}

fn resident_environment_light_scale() -> f32 {
  return 1.0;
}

// Thermal emission for hot materials. The compact variant supplies the
// surface's closure-derived emission temperature; the legacy variant has no
// temperature input and stays dark.
fn resident_surface_emissive(emissive_temperature_k: f32) -> vec3<f32> {
  return vec3<f32>(0.0);
}

// Piecewise-linear samples of the runtime radiation closure's
// Planck -> CIE 1931 -> sRGB chromaticity, decoded back to linear RGB for the
// renderer. The closure is valid from 800K through 6000K; hotter inputs retain
// its 6000K near-white chromaticity while radiance continues to follow T^4.
fn blackbody_chromaticity_linear_rgb(temperature_k: f32) -> vec3<f32> {
  let c800 = vec3<f32>(1.0, 0.0, 0.0);
  let c1300 = vec3<f32>(1.0, 0.096791621, 0.0);
  let c1850 = vec3<f32>(1.0, 0.230484590, 0.0);
  let c2200 = vec3<f32>(1.0, 0.313068766, 0.028089405);
  let c3000 = vec3<f32>(1.0, 0.484022759, 0.154496753);
  let c5500 = vec3<f32>(1.0, 0.851543201, 0.754730788);
  let c6000 = vec3<f32>(1.0, 0.900902375, 0.876112819);

  if (temperature_k <= 1300.0) {
    return mix(c800, c1300, clamp((temperature_k - 800.0) / 500.0, 0.0, 1.0));
  }
  if (temperature_k <= 1850.0) {
    return mix(c1300, c1850, (temperature_k - 1300.0) / 550.0);
  }
  if (temperature_k <= 2200.0) {
    return mix(c1850, c2200, (temperature_k - 1850.0) / 350.0);
  }
  if (temperature_k <= 3000.0) {
    return mix(c2200, c3000, (temperature_k - 2200.0) / 800.0);
  }
  if (temperature_k <= 5500.0) {
    return mix(c3000, c5500, (temperature_k - 3000.0) / 2500.0);
  }
  return mix(c5500, c6000, clamp((temperature_k - 5500.0) / 500.0, 0.0, 1.0));
}

fn blackbody_emission_rgb(temperature_k: f32) -> vec3<f32> {
  // Visible glow starts ~800K (Draper point).
  let t = clamp((temperature_k - 800.0) / 1400.0, 0.0, 1.4);
  if (t <= 0.0) {
    return vec3<f32>(0.0);
  }
  let color = blackbody_chromaticity_linear_rgb(temperature_k);
  // Sphere-lane parity: the particle bridge drives emissive at intensity
  // ~1.8x its material color; the previous t^2+0.15 scale left molten metal
  // surfaces reading matte next to their glowing sphere twins.
  //
  // Above the ramp's saturation anchor (t=1.0, 2200K) radiance follows
  // Stefan-Boltzmann T^4 relative to the anchor instead of clamping: the old
  // min(..., 2.6) flattened every temperature above ~2760K to one radiance,
  // so a 5000K reaction crown rendered the same orange as a 2200K blob.
  // ACES rolls the T^4 overshoot into white, giving hot cores the white-hot
  // read. Below the anchor the legacy quadratic is unchanged (molten-metal
  // range keeps its calibrated sphere-lane parity). Cap keeps accumulation
  // sane; ACES output stays bounded regardless.
  let quad_scale = min(1.9 * t * t + 0.2, 2.6);
  let rel = temperature_k / 2200.0;
  let stefan_scale = min(2.1 * rel * rel * rel * rel, 60.0);
  return color * select(quad_scale, stefan_scale, temperature_k > 2200.0);
}

@group(0) @binding(0) var<storage, read> surface_vertices: array<vec4<f32>>;
@group(0) @binding(1) var<uniform> camera_data: CameraUniform;
@group(0) @binding(2) var<storage, read> optical_records: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> spectral_samples: array<vec4<f32>>;

// Scene-color copy for screen-space refraction through transmissive
// dielectrics (water/ice). The copy is taken from the canvas after the opaque
// pass (background + opaque surfaces + box wireframe), so the transmitted
// term samples what is actually behind the surface instead of an analytic
// environment. A 1x1 dummy texture disables the path (textureDimensions
// gate) for the opaque pass, the legacy vertex-row lane, and non-native
// bridges whose canvas is not configured with COPY_SRC.
@group(1) @binding(0) var scene_color_copy: texture_2d<f32>;
@group(1) @binding(1) var scene_color_sampler: sampler;

// Prefiltered environment from the scene background image (latlong layout,
// mip chain indexed by roughness). A 1x1 dummy keeps the analytic hemisphere
// fallback when no background image is active.
@group(1) @binding(2) var env_map: texture_2d<f32>;
@group(1) @binding(3) var env_sampler: sampler;
// Native compact surfaces bind a full-resolution depth32float texture written
// by a front-culled backface pass. Legacy paths bind a 1x1 dummy and therefore
// fail closed to reflective/opaque PBR without ray bending.
@group(1) @binding(4) var refractive_back_depth: texture_depth_2d;

struct RefractiveBackfaceGeometry {
  world_position: vec3<f32>,
  valid: f32,
};

fn resident_refractive_backface(in: VertexOut) -> RefractiveBackfaceGeometry {
  return RefractiveBackfaceGeometry(vec3<f32>(0.0), 0.0);
}

fn resident_refraction_max_path_m() -> f32 {
  return 0.0;
}

${ms}

fn env_latlong_sample(dir: vec3<f32>, roughness: f32) -> vec3<f32> {
  var d = dir;
  let len2 = dot(d, d);
  if (len2 <= 1.0e-8) {
    d = vec3<f32>(0.0, 1.0, 0.0);
  } else {
    d = d / sqrt(len2);
  }
  let u = atan2(d.z, d.x) * 0.15915494 + 0.5;
  let v = acos(clamp(d.y, -1.0, 1.0)) * 0.31830989;
  let mip_count = f32(textureNumLevels(env_map));
  let lod = clamp(roughness, 0.0, 1.0) * max(mip_count - 1.0, 0.0);
  let sampled = textureSampleLevel(env_map, env_sampler, vec2<f32>(u, v), lod).rgb;
  // The background image is display-encoded; shading runs in linear light.
  return pow(clamp(sampled, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(2.2));
}

struct OpticalMaterial {
  base_color_linear: vec3<f32>,
  metalness: f32,
  roughness: f32,
  transmission: f32,
  opacity: f32,
  ior: f32,
  attenuation_linear: vec3<f32>,
  attenuation_distance_m: f32,
  absorption_coefficient_per_m: f32,
  scattering_coefficient_per_m: f32,
  optical_depth: f32,
  spectral_tint_linear: vec3<f32>,
  spectral_offset: f32,
  spectral_count: f32,
  status: f32,
  blocked: f32,
  found: f32,
};

fn id_equal(a: f32, b: f32) -> bool {
  return abs(round(a) - round(b)) < 0.5;
}

fn optical_record_count() -> u32 {
  return arrayLength(&optical_records) / 6u;
}

fn optical_record_row(record_index: u32, row_index: u32) -> vec4<f32> {
  return optical_records[record_index * 6u + row_index];
}

fn spectral_sample_count() -> u32 {
  return arrayLength(&spectral_samples) / 2u;
}

fn spectral_sample_row(sample_index: u32, row_index: u32) -> vec4<f32> {
  return spectral_samples[sample_index * 2u + row_index];
}

fn spectral_wavelength_rgb(wavelength_nm: f32) -> vec3<f32> {
  let w = clamp(wavelength_nm, 380.0, 780.0);
  var rgb = vec3<f32>(0.0);
  if (w < 440.0) {
    rgb = vec3<f32>(-(w - 440.0) / 60.0, 0.0, 1.0);
  } else if (w < 490.0) {
    rgb = vec3<f32>(0.0, (w - 440.0) / 50.0, 1.0);
  } else if (w < 510.0) {
    rgb = vec3<f32>(0.0, 1.0, -(w - 510.0) / 20.0);
  } else if (w < 580.0) {
    rgb = vec3<f32>((w - 510.0) / 70.0, 1.0, 0.0);
  } else if (w < 645.0) {
    rgb = vec3<f32>(1.0, -(w - 645.0) / 65.0, 0.0);
  } else {
    rgb = vec3<f32>(1.0, 0.0, 0.0);
  }
  let edge = select(
    select(1.0, 0.3 + 0.7 * (w - 380.0) / 40.0, w < 420.0),
    0.3 + 0.7 * (780.0 - w) / 80.0,
    w > 700.0
  );
  return pow(clamp(rgb * edge, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(2.2));
}

fn spectral_tint_from_samples(spectral_offset: f32, spectral_count_value: f32, transmission: f32) -> vec3<f32> {
  let total_samples = spectral_sample_count();
  let start = u32(max(0.0, round(spectral_offset)));
  let count = min(u32(max(0.0, round(spectral_count_value))), 32u);
  if (count == 0u || start >= total_samples) {
    return vec3<f32>(1.0);
  }
  var weighted = vec3<f32>(0.0);
  var weight_sum = 0.0;
  for (var local = 0u; local < 32u; local = local + 1u) {
    if (local >= count) {
      break;
    }
    let sample_index = start + local;
    if (sample_index >= total_samples) {
      break;
    }
    let row0 = spectral_sample_row(sample_index, 0u);
    let wavelength_rgb = spectral_wavelength_rgb(row0.x);
    let reflectance = clamp(row0.y, 0.0, 1.0);
    let transmittance = clamp(row0.z, 0.0, 1.0);
    let response = mix(reflectance, transmittance, clamp(transmission, 0.0, 1.0));
    weighted = weighted + wavelength_rgb * response;
    weight_sum = weight_sum + max(response, 0.0001);
  }
  if (!(weight_sum > 0.0)) {
    return vec3<f32>(1.0);
  }
  let tint = weighted / weight_sum;
  let max_channel = max(max(tint.r, tint.g), tint.b);
  return clamp(tint / max(max_channel, 0.0001), vec3<f32>(0.0), vec3<f32>(1.0));
}

struct SpectralComplexIndex {
  n_rgb: vec3<f32>,
  k_rgb: vec3<f32>,
  valid: f32,
};

fn spectral_complex_index_rgb(spectral_offset: f32, spectral_count_value: f32) -> SpectralComplexIndex {
  let total_samples = spectral_sample_count();
  let start = u32(max(0.0, round(spectral_offset)));
  let count = min(u32(max(0.0, round(spectral_count_value))), 32u);
  var n_rgb = vec3<f32>(1.0);
  var k_rgb = vec3<f32>(0.0);
  var found = vec3<f32>(0.0);
  var best_distance = vec3<f32>(1.0e9);
  for (var local = 0u; local < 32u; local = local + 1u) {
    if (local >= count) { break; }
    let sample_index = start + local;
    if (sample_index >= total_samples) { break; }
    let row0 = spectral_sample_row(sample_index, 0u);
    let row1 = spectral_sample_row(sample_index, 1u);
    let wavelength_nm = row0.x;
    let n = row1.y;
    let k = row1.z;
    if (!(wavelength_nm >= 380.0 && wavelength_nm <= 780.0 && n >= 1.0 && n < 10.0 && k >= 0.0 && k < 1.0e6)) {
      continue;
    }
    let red_distance = abs(wavelength_nm - 630.0);
    if (wavelength_nm >= 600.0 && red_distance < best_distance.r) {
      best_distance.r = red_distance;
      n_rgb.r = n;
      k_rgb.r = k;
      found.r = 1.0;
    }
    let green_distance = abs(wavelength_nm - 530.0);
    if (wavelength_nm >= 500.0 && wavelength_nm < 600.0 && green_distance < best_distance.g) {
      best_distance.g = green_distance;
      n_rgb.g = n;
      k_rgb.g = k;
      found.g = 1.0;
    }
    let blue_distance = abs(wavelength_nm - 480.0);
    if (wavelength_nm < 500.0 && blue_distance < best_distance.b) {
      best_distance.b = blue_distance;
      n_rgb.b = n;
      k_rgb.b = k;
      found.b = 1.0;
    }
  }
  let valid = select(0.0, 1.0, all(found > vec3<f32>(0.5)));
  return SpectralComplexIndex(n_rgb, k_rgb, valid);
}

fn complex_normal_fresnel_rgb(n_rgb: vec3<f32>, k_rgb: vec3<f32>) -> vec3<f32> {
  let numerator = (n_rgb - vec3<f32>(1.0)) * (n_rgb - vec3<f32>(1.0)) + k_rgb * k_rgb;
  let denominator = (n_rgb + vec3<f32>(1.0)) * (n_rgb + vec3<f32>(1.0)) + k_rgb * k_rgb;
  return clamp(numerator / max(denominator, vec3<f32>(1.0e-8)), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn fallback_optical_material(phase_id: f32) -> OpticalMaterial {
  var color = vec3<f32>(0.72, 0.9, 1.0);
  if (phase_id < 1.5) {
    color = vec3<f32>(0.88, 0.88, 0.82);
  } else if (phase_id < 2.5) {
    color = vec3<f32>(0.28, 0.7, 1.0);
  } else if (phase_id < 3.5) {
    color = vec3<f32>(0.86, 0.96, 1.0);
  }
  return OpticalMaterial(color, 0.0, 0.65, 0.0, 1.0, 1.0, vec3<f32>(1.0), 1.0e20, 0.0, 0.0, 0.0, vec3<f32>(1.0), 0.0, 0.0, 0.0, 1.0, 0.0);
}

fn find_optical_material(material_id: f32, phase_id: f32, optical_state_id: f32) -> OpticalMaterial {
  let count = optical_record_count();
  var fallback_index: i32 = -1;
  for (var record_index = 0u; record_index < count; record_index = record_index + 1u) {
    let row0 = optical_record_row(record_index, 0u);
    let row5 = optical_record_row(record_index, 5u);
    if (id_equal(row0.x, material_id) && id_equal(row0.y, phase_id)) {
      if (id_equal(row5.w, optical_state_id)) {
        let row1 = optical_record_row(record_index, 1u);
        let row2 = optical_record_row(record_index, 2u);
        let row3 = optical_record_row(record_index, 3u);
        let row4 = optical_record_row(record_index, 4u);
        let spectral_tint = spectral_tint_from_samples(row0.z, row0.w, row2.y);
        let spectral_tint_weight = 0.35 * (1.0 - clamp(row1.w, 0.0, 1.0));
        return OpticalMaterial(
          clamp(mix(row1.xyz, row1.xyz * spectral_tint, spectral_tint_weight), vec3<f32>(0.0), vec3<f32>(1.0)),
          clamp(row1.w, 0.0, 1.0),
          clamp(row2.x, 0.04, 1.0),
          clamp(row2.y, 0.0, 1.0),
          clamp(row2.z, 0.0, 1.0),
          max(row2.w, 1.0),
          clamp(row3.xyz, vec3<f32>(0.0), vec3<f32>(1.0)),
          max(row3.w, 0.00001),
          max(row4.x, 0.0),
          max(row4.y, 0.0),
          max(row5.x, 0.0),
          spectral_tint,
          row0.z,
          row0.w,
          row5.z,
          row5.y,
          1.0
        );
      }
      // State-zero fallback is valid only for an ordinary state-zero query.
      // Positive ids are reserved for canonical collective routes; falling
      // those back to bulk condensed optics would grant opacity to a missing
      // or mismatched route instead of failing closed.
      if (id_equal(optical_state_id, 0.0) && id_equal(row5.w, 0.0) && fallback_index < 0) {
        fallback_index = i32(record_index);
      }
    }
  }
  if (fallback_index >= 0) {
    let index = u32(fallback_index);
    let row0 = optical_record_row(index, 0u);
    let row1 = optical_record_row(index, 1u);
    let row2 = optical_record_row(index, 2u);
    let row3 = optical_record_row(index, 3u);
    let row4 = optical_record_row(index, 4u);
    let row5 = optical_record_row(index, 5u);
    let spectral_tint = spectral_tint_from_samples(row0.z, row0.w, row2.y);
    let spectral_tint_weight = 0.35 * (1.0 - clamp(row1.w, 0.0, 1.0));
    return OpticalMaterial(
      clamp(mix(row1.xyz, row1.xyz * spectral_tint, spectral_tint_weight), vec3<f32>(0.0), vec3<f32>(1.0)),
      clamp(row1.w, 0.0, 1.0),
      clamp(row2.x, 0.04, 1.0),
      0.0,
      1.0,
      1.0,
      clamp(row3.xyz, vec3<f32>(0.0), vec3<f32>(1.0)),
      max(row3.w, 0.00001),
      max(row4.x, 0.0),
      max(row4.y, 0.0),
      max(row5.x, 0.0),
      spectral_tint,
      0.0,
      0.0,
      1.0,
      row5.y,
      0.0
    );
  }
  return fallback_optical_material(phase_id);
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  let base = vertex_index * 4u;
  let row0 = surface_vertices[base];
  let row1 = surface_vertices[base + 1u];
  let row2 = surface_vertices[base + 2u];
  let position_m = vec3<f32>(row1.y, row1.z, row1.w);
  var out: VertexOut;
  var clip = camera_data.view_projection * vec4<f32>(position_m, 1.0);
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  if (clip.w <= 0.0) {
    clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  }
  out.position = clip;
  out.world_position = position_m;
  out.normal = normalize(row2.xyz + vec3<f32>(0.0001, 0.0002, 0.0003));
  out.material_id = row0.y;
  out.phase_id = row0.z;
  out.optical_state_id = row2.w;
  out.emissive_temperature_k = 0.0;
  return out;
}

fn resident_surface_color(in: VertexOut) -> vec4<f32> {
  let optical = find_optical_material(in.material_id, in.phase_id, in.optical_state_id);
  let blocked = optical.blocked > 0.5 || optical.status == 255.0;
  let optical_depth = clamp(optical.optical_depth, 0.0, 16.0);
  let absorption_depth = clamp(optical.absorption_coefficient_per_m * min(optical.attenuation_distance_m, 1.0), 0.0, 16.0);
  let attenuation_weight = clamp(1.0 - exp(-max(optical_depth, absorption_depth)), 0.0, 1.0);
  let attenuated_base = mix(
    optical.base_color_linear,
    optical.base_color_linear * optical.attenuation_linear,
    attenuation_weight
  );
  let base_color = select(attenuated_base, vec3<f32>(0.55, 0.05, 0.18), blocked);
  let normal = normalize(in.normal);
  let view_dir = resident_view_direction(in.world_position);
  // Positive optical-state ids are reserved for canonical collective routes.
  // Those routes retain the condensed phase for material identity but are
  // participating media, not polished condensed-material boundaries.
  let is_vapor = round(in.phase_id) == 3.0 || in.optical_state_id > 0.5;
  let roughness = clamp(optical.roughness, 0.04, 1.0);
  let metalness = clamp(optical.metalness, 0.0, 1.0);
  // Recovery retains the closure-admitted material IOR (water = 1.333).
  // The refactor-only molecular index is explicitly unvalidated and is not
  // granted rendering authority by this bounded port.
  let refractive_index = max(optical.ior, 1.0);
  let refractive_authority = optical.found > 0.5
    && optical.blocked < 0.5
    && abs(optical.status - 255.0) > 0.5
    && !is_vapor
    && refractive_index > 1.000001
    && refractive_draw_admitted();
  let dielectric_f0_scalar = pow(
    (refractive_index - 1.0) / (refractive_index + 1.0),
    2.0
  );
  let dielectric_f0 = select(vec3<f32>(0.04), vec3<f32>(dielectric_f0_scalar), refractive_authority);
  let f0 = mix(dielectric_f0, base_color, metalness);
  let ndotv = clamp(dot(normal, view_dir), 0.0, 1.0);
  // Sphere-lane PBR parity: the particle bridge renders through Three's
  // MeshPhysicalMaterial (GGX microfacet BRDF, energy-conserving Lambert)
  // under the scene's exact light set - ambient 1.4, hemisphere
  // (0xddffff/0x202a30) 0.9, key directional white 1.1 from (4,8,6), fill
  // 0xbfe9ff 0.5 from (-6,3,-4) - with a RoomEnvironment IBL. This shader
  // mirrors that: same lights, GGX + Smith + Schlick, split-sum environment
  // approximation, then the same ACESFilmic(exposure 1.08) tone pipeline.
  let backface = resident_refractive_backface(in);
  let refraction_max_path_m = resident_refraction_max_path_m();
  let refracted_path_r = refracted_path_to_back_plane(
    in.world_position,
    backface.world_position,
    backface.valid,
    refract(-view_dir, normal, 1.0 / refractive_index),
    camera_data.view_projection,
    refraction_max_path_m
  );
  let refracted_path_g = refracted_path_to_back_plane(
    in.world_position,
    backface.world_position,
    backface.valid,
    refract(-view_dir, normal, 1.0 / refractive_index),
    camera_data.view_projection,
    refraction_max_path_m
  );
  let refracted_path_b = refracted_path_to_back_plane(
    in.world_position,
    backface.world_position,
    backface.valid,
    refract(-view_dir, normal, 1.0 / refractive_index),
    camera_data.view_projection,
    refraction_max_path_m
  );
  let scene_color_available = textureDimensions(scene_color_copy, 0).x > 1u;
  let refracted_geometry_valid = refracted_path_r.valid > 0.5
    && refracted_path_g.valid > 0.5
    && refracted_path_b.valid > 0.5;
  let transmissive_surface = optical.transmission > 0.01
    && metalness < 0.1
    && !is_vapor
    && refractive_authority
    && refracted_geometry_valid
    && scene_color_available;
  // Three's MeshPhysicalMaterial transmission model: transmitted light
  // REPLACES diffuse reflection (energy conservation) - a clear medium has
  // almost no diffuse term. Adding full diffuse on top of transmission was
  // why surface water read as a bright milky blob while the sphere lane
  // rendered dark glass over the dark scene.
  let diffuse_weight = select(1.0, 1.0 - clamp(optical.transmission, 0.0, 1.0), transmissive_surface);
  let albedo = base_color * (1.0 - metalness) * diffuse_weight;
  let alpha_r = roughness * roughness;
  // Scene lights (linear-light colors x intensity, /pi folded into Lambert).
  let ambient_irradiance_value = max(resident_ambient_irradiance(), 0.0);
  let direct_light_scale = max(resident_direct_light_scale(), 0.0);
  let environment_light_scale = max(resident_environment_light_scale(), 0.0);
  let ambient_irradiance = vec3<f32>(ambient_irradiance_value);
  let hemi_sky = vec3<f32>(0.733, 1.0, 1.0);
  let hemi_ground = vec3<f32>(0.0144, 0.0241, 0.0306);
  let hemi_irradiance = mix(hemi_ground, hemi_sky, clamp(normal.y * 0.5 + 0.5, 0.0, 1.0))
    * 0.9 * direct_light_scale;
  let key_dir = normalize(vec3<f32>(4.0, 8.0, 6.0));
  let key_radiance = vec3<f32>(1.1) * direct_light_scale;
  let fill_dir = normalize(vec3<f32>(-6.0, 3.0, -4.0));
  let fill_radiance = vec3<f32>(0.518, 0.815, 1.0) * 0.5 * direct_light_scale;
  let inv_pi = 0.3183098862;
  let key_ndotl = clamp(dot(normal, key_dir), 0.0, 1.0);
  let fill_ndotl = clamp(dot(normal, fill_dir), 0.0, 1.0);
  let diffuse = albedo * inv_pi
    * (ambient_irradiance + hemi_irradiance + key_radiance * key_ndotl + fill_radiance * fill_ndotl);
  // GGX specular per directional light (D * V_SmithCorrelated * F_Schlick).
  var specular = vec3<f32>(0.0);
  {
    let a2 = alpha_r * alpha_r;
    let dirs = array<vec3<f32>, 2>(key_dir, fill_dir);
    let radiances = array<vec3<f32>, 2>(key_radiance, fill_radiance);
    for (var li = 0u; li < 2u; li = li + 1u) {
      let l = dirs[li];
      let ndotl = clamp(dot(normal, l), 0.0, 1.0);
      if (ndotl <= 0.0) { continue; }
      let h = normalize(l + view_dir);
      let ndoth = clamp(dot(normal, h), 0.0, 1.0);
      let vdoth = clamp(dot(view_dir, h), 0.0, 1.0);
      let d_denom = ndoth * ndoth * (a2 - 1.0) + 1.0;
      let d_ggx = a2 / max(3.14159265 * d_denom * d_denom, 1.0e-6);
      let v_smith = 0.5 / max(
        ndotl * (ndotv * (1.0 - alpha_r) + alpha_r) + ndotv * (ndotl * (1.0 - alpha_r) + alpha_r),
        1.0e-6
      );
      let f_schlick = f0 + (vec3<f32>(1.0) - f0) * pow(1.0 - vdoth, 5.0);
      specular = specular + radiances[li] * ndotl * d_ggx * v_smith * f_schlick;
    }
  }
  // Environment (RoomEnvironment stand-in): bright interior gradient sampled
  // by the split-sum approximation (Karis analytic env BRDF), so metals
  // reflect the room across the whole surface exactly like the sphere lane.
  var env_color = mix(vec3<f32>(0.23, 0.26, 0.30), vec3<f32>(0.85, 0.92, 1.0),
    clamp(normal.y * 0.5 + 0.5, 0.0, 1.0));
  if (textureDimensions(env_map, 0).x > 1u) {
    env_color = env_latlong_sample(reflect(-view_dir, normal), roughness);
  }
  let env_r = vec4<f32>(-1.0, -0.0275, -0.572, 0.022) * roughness
    + vec4<f32>(1.0, 0.0425, 1.04, -0.04);
  let env_a004 = min(env_r.x * env_r.x, exp2(-9.28 * ndotv)) * env_r.x + env_r.y;
  let env_ab = vec2<f32>(-1.04, 1.04) * env_a004 + env_r.zw;
  let env_specular = env_color * (f0 * env_ab.x + vec3<f32>(env_ab.y))
    * environment_light_scale;
  let scatter_haze = clamp(log2(1.0 + optical.scattering_coefficient_per_m) * 0.018, 0.0, 0.35);
  let rim = pow(1.0 - ndotv, 3.0) * scatter_haze;
  let ambient_visibility_scale = clamp(ambient_irradiance_value / 1.4, 0.0, 1.0);
  let emissive = resident_surface_emissive(in.emissive_temperature_k);
  // Keep physically derived thermal emission independent of the laboratory
  // illumination controls. Dark-lab mode removes incident light, not glow.
  var lit = diffuse + specular + env_specular
    + base_color * rim * ambient_visibility_scale
    + emissive;
  if (is_vapor && !blocked) {
    // This proxy is the boundary of an integrated extinction field, not a
    // material interface. Use an isotropic single-scattering source under the
    // admitted scene lights; normal-dependent GGX highlights would turn a
    // cloud into polished droplets even though no such boundary exists.
    let isotropic_phase = 0.07957747155; // 1 / (4 pi)
    let hemi_mean_radiance = 0.5 * (hemi_sky + hemi_ground)
      * 0.9 * direct_light_scale;
    let incident_radiance = ambient_irradiance
      + hemi_mean_radiance
      + key_radiance
      + fill_radiance;
    lit = base_color * incident_radiance * isotropic_phase + emissive;
  }
  // PBR transmission (MeshPhysicalMaterial model): transmissive dielectrics
  // render near-OPAQUE - transparency lives in the transmitted light, not in
  // alpha blending. Transmitted term = environment through the volume,
  // Beer-Lambert attenuated by the material's own absorption over its
  // attenuation distance, weighted by (1 - Fresnel) x transmission. The old
  // path drew water as a ghost alpha film (alpha = 1 - 0.72 x transmission).
  if (transmissive_surface) {
    let fresnel_rgb = clamp(
      f0 + (vec3<f32>(1.0) - f0) * pow(1.0 - ndotv, 5.0),
      vec3<f32>(0.0),
      vec3<f32>(1.0)
    );
    let path_m_rgb = vec3<f32>(
      refracted_path_r.path_m,
      refracted_path_g.path_m,
      refracted_path_b.path_m
    );
    let attenuation_sigma_rgb = -log(clamp(
      optical.attenuation_linear,
      vec3<f32>(1.0e-6),
      vec3<f32>(1.0)
    )) / max(optical.attenuation_distance_m, 1.0e-6);
    let transmitted_tint = refraction_beer_lambert_transmission_rgb(
      attenuation_sigma_rgb,
      path_m_rgb
    );
    let refracted = vec3<f32>(
      textureSampleLevel(scene_color_copy, scene_color_sampler, refracted_path_r.exit_uv, 0.0).r,
      textureSampleLevel(scene_color_copy, scene_color_sampler, refracted_path_g.exit_uv, 0.0).g,
      textureSampleLevel(scene_color_copy, scene_color_sampler, refracted_path_b.exit_uv, 0.0).b
    );
    // The canvas copy is display-encoded; shading runs in linear light.
    let refracted_linear = pow(clamp(refracted, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(2.2));
    let transmitted = refracted_linear * transmitted_tint;
    lit = lit + (vec3<f32>(1.0) - fresnel_rgb)
      * clamp(optical.transmission, 0.0, 1.0)
      * transmitted;
  }
  // Three tone pipeline: exposure, ACESFilmic, then display encode below.
  lit = lit * 1.08;
  let aces_a = lit * (2.51 * lit + vec3<f32>(0.03));
  let aces_b = lit * (2.43 * lit + vec3<f32>(0.59)) + vec3<f32>(0.14);
  lit = clamp(aces_a / aces_b, vec3<f32>(0.0), vec3<f32>(1.0));
  // Condensed dielectrics remain alpha-one: their transparency comes only
  // from the PBR transmitted-light term above.  Gas is different.  Until the
  // phase-volume integrator owns this pass, its surface proxy represents
  // Beer-Lambert coverage and must be premultiplied/non-depth-writing.  Treat
  // blocked vapor closures as visible diagnostics instead of invisible depth
  // occluders.
  // For a locally convex reconstructed volume, |n.v| is the normalized
  // line-of-sight chord of a spherical patch. Applying Beer-Lambert to that
  // physical path estimate softens the silhouette without inventing an
  // opacity curve or altering the transported optical depth.
  let projected_chord_fraction = clamp(ndotv, 0.0, 1.0);
  let projected_optical_depth = optical_depth * projected_chord_fraction;
  var vapor_alpha = clamp(1.0 - exp(-projected_optical_depth), 0.0, 1.0);
  // Positive optical-state ids are reserved for canonical collective routes.
  // Those routes fail closed when their typed closure is blocked; the legacy
  // red diagnostic remains available only for an ordinary gas surface.
  if (blocked && is_vapor && in.optical_state_id < 0.5) {
    vapor_alpha = 1.0;
  }
  let output_alpha = select(1.0, vapor_alpha, is_vapor);
  // The canvas format is non-sRGB (getPreferredCanvasFormat), so linear-light
  // shading must be display-encoded here or everything reads ~2x too dark.
  let display_lit = pow(clamp(lit, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(1.0 / 2.2));
  return vec4<f32>(display_lit * output_alpha, output_alpha);
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  return resident_surface_color(in);
}

`,_s=16*Float32Array.BYTES_PER_ELEMENT+192+16*Float32Array.BYTES_PER_ELEMENT,vs=gs.replace(`struct CameraUniform {
  view_projection: mat4x4<f32>,
};`,`struct CameraUniform {
  view_projection: mat4x4<f32>,
  vertex_count: u32,
  source_stride_floats: u32,
  surface_index: u32,
  triangle_count: u32,
  material_id: f32,
  phase_id: f32,
  optical_state_id: f32,
  density: f32,
  isolation: f32,
  source_voxel_base: f32,
  transparency_class_id: f32,
  depth_write_flag: f32,
  render_order: f32,
  fallback_normal_x: f32,
  fallback_normal_y: f32,
  fallback_normal_z: f32,
  position_scale_m: f32,
  position_origin_x_m: f32,
  position_origin_y_m: f32,
  position_origin_z_m: f32,
  position_grid_bias: f32,
  position_transform_enabled: f32,
  ambient_light_suppression: f32,
  direct_light_suppression: f32,
  position_clamp_min_x_m: f32,
  position_clamp_min_y_m: f32,
  position_clamp_min_z_m: f32,
  position_clamp_max_x_m: f32,
  position_clamp_max_y_m: f32,
  position_clamp_max_z_m: f32,
  position_clamp_enabled: f32,
  environment_light_suppression: f32,
  bounds_center_x_m: f32,
  bounds_center_y_m: f32,
  bounds_center_z_m: f32,
  bounds_radius_m: f32,
  field_dim_x: u32,
  field_dim_y: u32,
  field_dim_z: u32,
  field_stride_x: u32,
  field_stride_y: u32,
  field_stride_z: u32,
  field_offset: u32,
  field_gradient_enabled: f32,
  camera_position_x_m: f32,
  camera_position_y_m: f32,
  camera_position_z_m: f32,
  emissive_temperature_k: f32,
  inverse_view_projection: mat4x4<f32>,
};`).replace(`fn resident_view_direction(world_position: vec3<f32>) -> vec3<f32> {
  return normalize(vec3<f32>(0.15, 0.25, 1.0));
}`,`fn resident_view_direction(world_position: vec3<f32>) -> vec3<f32> {
  let camera_position = vec3<f32>(
    camera_data.camera_position_x_m,
    camera_data.camera_position_y_m,
    camera_data.camera_position_z_m
  );
  let to_camera = camera_position - world_position;
  if (dot(to_camera, to_camera) <= 0.000001) {
    return normalize(vec3<f32>(0.15, 0.25, 1.0));
  }
  return normalize(to_camera);
}`).replace(`fn refractive_draw_admitted() -> bool {
  return true;
}`,`fn refractive_draw_admitted() -> bool {
  return abs(camera_data.transparency_class_id - 2.0) < 0.5;
}`).replace(`fn resident_ambient_irradiance() -> f32 {
  return 1.4;
}

fn resident_direct_light_scale() -> f32 {
  return 1.0;
}

fn resident_environment_light_scale() -> f32 {
  return 1.0;
}`,`fn resident_ambient_irradiance() -> f32 {
  let suppression = clamp(camera_data.ambient_light_suppression, 0.0, 1.0);
  return mix(1.4, 0.03, suppression);
}

fn resident_direct_light_scale() -> f32 {
  return 1.0 - clamp(camera_data.direct_light_suppression, 0.0, 1.0);
}

fn resident_environment_light_scale() -> f32 {
  return 1.0 - clamp(camera_data.environment_light_suppression, 0.0, 1.0);
}`).replace(`fn resident_refractive_backface(in: VertexOut) -> RefractiveBackfaceGeometry {
  return RefractiveBackfaceGeometry(vec3<f32>(0.0), 0.0);
}`,`fn resident_refractive_backface(in: VertexOut) -> RefractiveBackfaceGeometry {
  let dimensions = textureDimensions(refractive_back_depth);
  let surface_pixel = refraction_surface_pixel(in.position.xy, dimensions);
  if (!(surface_pixel.valid > 0.5)) {
    return RefractiveBackfaceGeometry(vec3<f32>(0.0), 0.0);
  }
  let back_depth = textureLoad(refractive_back_depth, surface_pixel.pixel, 0);
  let back_point = refraction_unproject_uv_depth(
    surface_pixel.uv,
    back_depth,
    camera_data.inverse_view_projection
  );
  if (!(back_point.valid > 0.5)) {
    return RefractiveBackfaceGeometry(vec3<f32>(0.0), 0.0);
  }
  let back_world = back_point.world_position;
  return RefractiveBackfaceGeometry(
    back_world,
    refraction_rear_surface_admitted(
      in.position.z,
      back_depth,
      in.world_position,
      back_world,
      in.normal,
      resident_view_direction(in.world_position),
      resident_refraction_max_path_m()
    )
  );
}`).replace(`fn resident_refraction_max_path_m() -> f32 {
  return 0.0;
}`,`fn resident_refraction_max_path_m() -> f32 {
  let radius_m = camera_data.bounds_radius_m;
  return select(
    0.0,
    2.0 * radius_m,
    radius_m == radius_m && abs(radius_m) < 1.0e20 && radius_m > 1.0e-6
  );
}`).replace(`fn resident_surface_emissive(emissive_temperature_k: f32) -> vec3<f32> {
  return vec3<f32>(0.0);
}`,`fn resident_surface_emissive(emissive_temperature_k: f32) -> vec3<f32> {
  // Field-sampled per-fragment temperature when available; per-surface
  // closure temperature where the field is empty or unbound.
  let temperature_k = select(camera_data.emissive_temperature_k, emissive_temperature_k, emissive_temperature_k > 0.0);
  return blackbody_emission_rgb(temperature_k);
}`).replace(`@group(0) @binding(0) var<storage, read> surface_vertices: array<vec4<f32>>;`,`@group(0) @binding(0) var<storage, read> compact_position_rows: array<f32>;
@group(0) @binding(4) var<storage, read> compact_packed_normals: array<u32>;
@group(0) @binding(5) var<storage, read> compact_vertex_temperatures_k: array<f32>;`).replace(/@vertex\nfn vs_main\(@builtin\(vertex_index\) vertex_index: u32\) -> VertexOut \{[\s\S]*?\n\}\n\nfn resident_surface_color/,`fn compact_position(vertex_index: u32) -> vec3<f32> {
  let offset = vertex_index * camera_data.source_stride_floats;
  return vec3<f32>(
    compact_position_rows[offset + 0u],
    compact_position_rows[offset + 1u],
    compact_position_rows[offset + 2u]
  );
}

fn compact_world_position(vertex_index: u32) -> vec3<f32> {
  var p = compact_position(vertex_index);
  if (camera_data.position_transform_enabled > 0.5) {
    p = vec3<f32>(
      camera_data.position_origin_x_m,
      camera_data.position_origin_y_m,
      camera_data.position_origin_z_m
    ) + (p + vec3<f32>(camera_data.position_grid_bias)) * camera_data.position_scale_m;
  }
  if (camera_data.position_clamp_enabled > 0.5) {
    p = clamp(
      p,
      vec3<f32>(
        camera_data.position_clamp_min_x_m,
        camera_data.position_clamp_min_y_m,
        camera_data.position_clamp_min_z_m
      ),
      vec3<f32>(
        camera_data.position_clamp_max_x_m,
        camera_data.position_clamp_max_y_m,
        camera_data.position_clamp_max_z_m
      )
    );
  }
  return p;
}

fn compact_normal(vertex_index: u32) -> vec3<f32> {
  let triangle_base = vertex_index - (vertex_index % 3u);
  let p0 = compact_world_position(triangle_base + 0u);
  let p1 = compact_world_position(triangle_base + 1u);
  let p2 = compact_world_position(triangle_base + 2u);
  let n = cross(p1 - p0, p2 - p0);
  if (length(n) <= 0.000000000001) {
    return normalize(vec3<f32>(
      camera_data.fallback_normal_x,
      camera_data.fallback_normal_y,
      camera_data.fallback_normal_z
    ) + vec3<f32>(0.0001, 0.0002, 0.0003));
  }
  return normalize(n);
}

fn octahedral_sign_not_zero(v: vec2<f32>) -> vec2<f32> {
  return select(vec2<f32>(-1.0), vec2<f32>(1.0), v >= vec2<f32>(0.0));
}

fn compact_packed_normal(vertex_index: u32) -> vec3<f32> {
  if (vertex_index >= arrayLength(&compact_packed_normals)) {
    return vec3<f32>(0.0);
  }
  let packed = compact_packed_normals[vertex_index];
  if (packed == 0x80008000u) {
    return vec3<f32>(0.0);
  }
  let oct = unpack2x16snorm(packed);
  var normal = vec3<f32>(oct, 1.0 - abs(oct.x) - abs(oct.y));
  if (normal.z < 0.0) {
    normal = vec3<f32>(
      (vec2<f32>(1.0) - abs(normal.yx)) * octahedral_sign_not_zero(normal.xy),
      normal.z
    );
  }
  let length_squared = dot(normal, normal);
  if (length_squared <= 0.000000000001) {
    return vec3<f32>(0.0);
  }
  return normal / sqrt(length_squared);
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  let position_m = compact_world_position(vertex_index);
  var out: VertexOut;
  var clip = camera_data.view_projection * vec4<f32>(position_m, 1.0);
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  if (clip.w <= 0.0) {
    clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  }
  out.position = clip;
  out.world_position = position_m;
  var normal = compact_normal(vertex_index);
  let smooth_normal = compact_packed_normal(vertex_index);
  if (dot(smooth_normal, smooth_normal) > 0.25) {
    normal = smooth_normal;
  }
  out.normal = normal;
  out.material_id = camera_data.material_id;
  out.phase_id = camera_data.phase_id;
  out.optical_state_id = camera_data.optical_state_id;
  var vertex_temperature_k = 0.0;
  if (vertex_index < arrayLength(&compact_vertex_temperatures_k)) {
    vertex_temperature_k = compact_vertex_temperatures_k[vertex_index];
  }
  out.emissive_temperature_k = vertex_temperature_k;
  return out;
}

fn resident_surface_color`),ys=`peercompute.ulg.native-surface-temperature-rows.v0`,bs=`peercompute.ulg.native-surface-temperature-coverage.v0`,xs=`peercompute.ulg.native-surface-temperature-execution.v0`,Ss=`peercompute.ulg.native-surface-temperature-f32-kelvin.v0`,Cs={COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256},ws=4294967295,Ts=Float32Array.BYTES_PER_ELEMENT,Es=new WeakMap;function Ds(e){let t=Es.get(e);if(t)return{...t,dispatchPlanPipelineCacheStatus:`pipeline-cache-hit`,temperaturePipelineCacheStatus:`pipeline-cache-hit`};let n=fe(e,{cacheKey:`ulg-native-surface-temperature-dispatch-plan.v0`,label:`ulg-native-surface-temperature-dispatch-plan`,code:Os,entryPoint:`plan_dispatch`,bindings:[K(3,`uniform`),K(4,`read-only-storage`),K(5,`storage`)]}),r=fe(e,{cacheKey:`ulg-native-surface-temperature-rows.v1-indirect`,label:`ulg-native-surface-temperature-rows`,code:Os,entryPoint:`main`,bindings:[K(0,`read-only-storage`),K(1,`read-only-storage`),K(2,`storage`),K(3,`uniform`),K(4,`read-only-storage`)]}),i=Object.freeze({dispatchPlanPipeline:n.pipeline,dispatchPlanBindGroupLayout:n.bindGroupLayout,dispatchPlanPipelineCacheStatus:n.cacheStatus,pipeline:r.pipeline,bindGroupLayout:r.bindGroupLayout,temperaturePipelineCacheStatus:r.cacheStatus});return Es.set(e,i),i}var Os=`
const DENSITY_LANE_OFFSET: u32 = 0u;
const TEMPERATURE_LANE_OFFSET: u32 = 4u;

struct TemperatureParams {
  conservative_vertex_row_count: u32,
  compact_position_stride_floats: u32,
  compact_position_float_count: u32,
  render_field_float_count: u32,
  field_dim_x: u32,
  field_dim_y: u32,
  field_dim_z: u32,
  field_offset_floats: u32,
  field_stride_x_floats: u32,
  field_stride_y_floats: u32,
  field_stride_z_floats: u32,
  max_workgroups_per_dimension: u32,
  _reserved_1: u32,
  _reserved_2: u32,
  _reserved_3: u32,
  _reserved_4: u32,
};

struct FieldCorner {
  density: f32,
  temperature_k: f32,
  valid: u32,
};

@group(0) @binding(0) var<storage, read> compact_position_rows: array<f32>;
@group(0) @binding(1) var<storage, read> render_field_scalars: array<f32>;
@group(0) @binding(2) var<storage, read_write> temperature_rows_k: array<f32>;
@group(0) @binding(3) var<uniform> params: TemperatureParams;
@group(0) @binding(4) var<storage, read> actual_vertex_counter: array<u32>;
@group(0) @binding(5) var<storage, read_write> dispatch_args: array<u32>;

fn finite_scalar(value: f32) -> bool {
  return value == value && abs(value) < 1.0e30;
}

fn finite_position(value: vec3<f32>) -> bool {
  return all(value == value) && all(abs(value) < vec3<f32>(1.0e30));
}

fn field_corner(ix: i32, iy: i32, iz: i32) -> FieldCorner {
  let cx = clamp(ix, 0, i32(params.field_dim_x) - 1);
  let cy = clamp(iy, 0, i32(params.field_dim_y) - 1);
  let cz = clamp(iz, 0, i32(params.field_dim_z) - 1);
  let base = params.field_offset_floats
    + u32(cx) * params.field_stride_x_floats
    + u32(cy) * params.field_stride_y_floats
    + u32(cz) * params.field_stride_z_floats;
  if (base >= params.render_field_float_count) {
    return FieldCorner(0.0, 0.0, 0u);
  }
  if (TEMPERATURE_LANE_OFFSET >= params.render_field_float_count - base) {
    return FieldCorner(0.0, 0.0, 0u);
  }
  let density = render_field_scalars[base + DENSITY_LANE_OFFSET];
  let temperature_k = render_field_scalars[base + TEMPERATURE_LANE_OFFSET];
  if (!finite_scalar(density) || !finite_scalar(temperature_k)) {
    return FieldCorner(0.0, 0.0, 0u);
  }
  return FieldCorner(max(density, 0.0), temperature_k, 1u);
}

fn field_temperature_sample(grid_position: vec3<f32>) -> f32 {
  let maximum_grid_position = vec3<f32>(
    f32(params.field_dim_x - 1u),
    f32(params.field_dim_y - 1u),
    f32(params.field_dim_z - 1u)
  );
  let p = clamp(grid_position, vec3<f32>(0.0), maximum_grid_position);
  let base = floor(p);
  let f = p - base;
  let ix = i32(base.x);
  let iy = i32(base.y);
  let iz = i32(base.z);
  var temperature_sum = 0.0;
  var weight_sum = 0.0;
  for (var corner = 0u; corner < 8u; corner = corner + 1u) {
    let dx = i32(corner & 1u);
    let dy = i32((corner >> 1u) & 1u);
    let dz = i32((corner >> 2u) & 1u);
    let wx = select(1.0 - f.x, f.x, dx == 1);
    let wy = select(1.0 - f.y, f.y, dy == 1);
    let wz = select(1.0 - f.z, f.z, dz == 1);
    let sample = field_corner(ix + dx, iy + dy, iz + dz);
    if (sample.valid == 0u) {
      return 0.0;
    }
    let weight = wx * wy * wz * sample.density;
    temperature_sum = temperature_sum + sample.temperature_k * weight;
    weight_sum = weight_sum + weight;
  }
  if (!(weight_sum > 1.0e-6)) {
    return 0.0;
  }
  let temperature_k = temperature_sum / weight_sum;
  return select(0.0, temperature_k, finite_scalar(temperature_k));
}

@compute @workgroup_size(1)
fn plan_dispatch(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (any(global_id != vec3<u32>(0u))) {
    return;
  }
  let actual_vertex_row_count = min(
    actual_vertex_counter[0],
    params.conservative_vertex_row_count
  );
  let total_workgroup_count =
    (actual_vertex_row_count + 63u)
      / 64u;
  if (total_workgroup_count == 0u) {
    dispatch_args[0] = 0u;
    dispatch_args[1] = 1u;
    dispatch_args[2] = 1u;
    return;
  }
  let workgroup_count_x = min(
    total_workgroup_count,
    params.max_workgroups_per_dimension
  );
  dispatch_args[0] = workgroup_count_x;
  dispatch_args[1] =
    (total_workgroup_count + workgroup_count_x - 1u) / workgroup_count_x;
  dispatch_args[2] = 1u;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x
    + global_id.y
      * params.max_workgroups_per_dimension
      * 64u;
  let actual_vertex_row_count = min(
    actual_vertex_counter[0],
    params.conservative_vertex_row_count
  );
  if (row_index >= actual_vertex_row_count) {
    return;
  }
  // Every admitted invocation writes a fail-closed value before touching
  // either borrowed source buffer.
  temperature_rows_k[row_index] = 0.0;
  if (params.compact_position_stride_floats < 3u
    || params.compact_position_float_count < 3u) {
    return;
  }
  let maximum_safe_row =
    (params.compact_position_float_count - 3u)
      / params.compact_position_stride_floats;
  if (row_index > maximum_safe_row) {
    return;
  }
  let position_offset = row_index * params.compact_position_stride_floats;
  let grid_position = vec3<f32>(
    compact_position_rows[position_offset + 0u],
    compact_position_rows[position_offset + 1u],
    compact_position_rows[position_offset + 2u]
  );
  if (!finite_position(grid_position)
    || params.field_dim_x == 0u
    || params.field_dim_y == 0u
    || params.field_dim_z == 0u) {
    return;
  }
  temperature_rows_k[row_index] = field_temperature_sample(grid_position);
}
`;function ks(e,t){if(!e||typeof e!=`object`&&typeof e!=`function`)throw TypeError(`${t} is required`);return e}function As(e,t){let n=Number(e);if(!Number.isSafeInteger(n)||n<0||n>ws)throw RangeError(`${t} must be a non-negative uint32 integer`);return n}function js(e,t){let n=As(e,t);if(n<=0)throw RangeError(`${t} must be positive`);return n}function Ms(e,t,n){let r=js(t??e?.size,`${n}ByteLength`);if(r%Ts!==0)throw RangeError(`${n}ByteLength must be aligned to f32 rows`);if(Number.isFinite(Number(e?.size))&&r>Number(e.size))throw RangeError(`${n}ByteLength exceeds the GPU buffer size`);return r}function Ns(e,t){if(!(Array.isArray(e)||ArrayBuffer.isView(e))||e.length<3)throw TypeError(`${t} must contain three uint32 integers`);return[js(e[0],`${t}[0]`),js(e[1],`${t}[1]`),js(e[2],`${t}[2]`)]}function Ps(e,t){if(e==null)throw TypeError(`${t} must be explicitly authored`);return As(e,t)}function Fs(e,t){if(e===void 0)throw TypeError(`${t} must be explicitly authored (null is allowed)`);return e===null?null:As(e,t)}function Is(e,t){return!!(e&&Object.prototype.hasOwnProperty.call(e,t))}function Ls(e,t,n){if(e&&!Is(e,t))throw TypeError(`${n}.${t} must be explicitly authored`)}function Rs(e,t,n){if(e!==t)throw RangeError(`${n} metadata disagrees across source descriptors`)}function zs(e,t,n){let r=Number(e?.limits?.maxStorageBufferBindingSize);if(Number.isFinite(r)&&r>0&&t>r)throw RangeError(`${n} exceeds maxStorageBufferBindingSize`)}function Bs({conservativeVertexRowCount:e,compactPositionStrideFloats:t,compactPositionFloatCount:n,renderFieldFloatCount:r,fieldDimensions:i,fieldOffsetFloats:a,fieldStridesFloats:o,maxComputeWorkgroupsPerDimension:s=65535}){let c=new Uint32Array(64/4);return c[0]=e,c[1]=t,c[2]=n,c[3]=r,c[4]=i[0],c[5]=i[1],c[6]=i[2],c[7]=a,c[8]=o[0],c[9]=o[1],c[10]=o[2],c[11]=s,c}function Vs({device:e,commandEncoder:t,compactPositions:n=null,actualVertexCounter:r=null,renderField:i=null,generation:a=null,compactPositionRowsBuffer:o=n?.buffer??null,compactPositionRowsBufferByteLength:s=n?.byteLength,conservativeVertexRowCount:c=n?.rowCount,compactPositionRowsStrideFloats:l=n?.strideFloats,actualVertexCounterBuffer:u=r?.buffer??null,actualVertexCounterBufferByteLength:d=r?.byteLength,renderFieldScalarsBuffer:f=i?.buffer??null,renderFieldScalarsBufferByteLength:p=i?.byteLength,fieldDimensions:m=i?.dims,fieldStridesFloats:h=i?.scalarStrides,fieldOffsetFloats:g=i?.scalarOffsetFloats??i?.scalarOffset??0,surfaceGenerationId:_=a?.surfaceGenerationId??n?.surfaceGenerationId,volumeGenerationId:v=Is(a,`volumeGenerationId`)?a.volumeGenerationId:Is(n,`volumeGenerationId`)?n.volumeGenerationId:void 0,renderFieldVolumeGenerationId:y=Is(i,`volumeGenerationId`)?i.volumeGenerationId:void 0,label:b=`ulg-native-surface-temperature-rows`}={}){if(ks(e,`device`),typeof e.createBuffer!=`function`||typeof e.createShaderModule!=`function`||typeof e.createComputePipeline!=`function`||typeof e.createBindGroup!=`function`)throw TypeError(`device must provide the required WebGPU compute methods`);if(ks(t,`commandEncoder`),typeof t.beginComputePass!=`function`)throw TypeError(`commandEncoder must be a caller-owned GPUCommandEncoder`);ks(o,`compactPositionRowsBuffer`),ks(u,`actualVertexCounterBuffer`),ks(f,`renderFieldScalarsBuffer`),Ls(n,`surfaceGenerationId`,`compactPositions`),Ls(n,`volumeGenerationId`,`compactPositions`),Ls(i,`volumeGenerationId`,`renderField`),Ls(a,`surfaceGenerationId`,`generation`),Ls(a,`volumeGenerationId`,`generation`);let x=Ps(_,`surfaceGenerationId`);n&&Rs(x,Ps(n.surfaceGenerationId,`compactPositions.surfaceGenerationId`),`surfaceGenerationId`),a&&Rs(x,Ps(a.surfaceGenerationId,`generation.surfaceGenerationId`),`surfaceGenerationId`);let S=Fs(v,`volumeGenerationId`);Rs(S,Fs(y,`renderFieldVolumeGenerationId`),`volumeGenerationId`),i&&Rs(S,Fs(i.volumeGenerationId,`renderField.volumeGenerationId`),`volumeGenerationId`),n&&Rs(S,Fs(n.volumeGenerationId,`compactPositions.volumeGenerationId`),`volumeGenerationId`),a&&Rs(S,Fs(a.volumeGenerationId,`generation.volumeGenerationId`),`volumeGenerationId`);let C=js(c,`conservativeVertexRowCount`),w=js(l,`compactPositionRowsStrideFloats`);if(w<3)throw RangeError(`compactPositionRowsStrideFloats must contain xyz`);let T=Ms(o,s,`compactPositionRowsBuffer`),E=T/Ts,D=C*w;if(!Number.isSafeInteger(D)||D>ws||D>E)throw RangeError(`compact position buffer does not cover every conservative vertex row`);let O=Ms(u,d,`actualVertexCounterBuffer`);if(O<Uint32Array.BYTES_PER_ELEMENT)throw RangeError(`actualVertexCounterBuffer must contain one u32 counter`);let k=Ns(m,`fieldDimensions`),A=Ns(h,`fieldStridesFloats`),j=As(g,`fieldOffsetFloats`),M=Ms(f,p,`renderFieldScalarsBuffer`),N=M/Ts,ee=j+(k[0]-1)*A[0]+(k[1]-1)*A[1]+(k[2]-1)*A[2]+4;if(!Number.isSafeInteger(ee)||ee>ws||ee>=N)throw RangeError(`render field buffer does not cover density lane 0 and temperature lane +4`);let P=C*Ts,F=js(e?.limits?.maxComputeWorkgroupsPerDimension??65535,`maxComputeWorkgroupsPerDimension`);zs(e,T,`compact position binding`),zs(e,M,`render field binding`),zs(e,P,`temperature output binding`),zs(e,Uint32Array.BYTES_PER_ELEMENT,`actual vertex counter binding`);let I=Bs({conservativeVertexRowCount:C,compactPositionStrideFloats:w,compactPositionFloatCount:E,renderFieldFloatCount:N,fieldDimensions:k,fieldOffsetFloats:j,fieldStridesFloats:A,maxComputeWorkgroupsPerDimension:F}),te=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,ne=Cs.UNIFORM|Cs.COPY_DST,re=3*Uint32Array.BYTES_PER_ELEMENT,ie=Cs.STORAGE|Cs.INDIRECT,ae=null,L=null,R=null;try{ae=e.createBuffer({label:`${b}-output`,size:P,usage:Cs.STORAGE|Cs.COPY_SRC}),L=te?ue(e,{bucketKey:`ulg-native-surface-temperature-params`,label:`${b}-params`,size:64,usage:ne}):e.createBuffer({label:`${b}-params`,size:64,usage:ne}),e.queue.writeBuffer(L,0,I.buffer,I.byteOffset,I.byteLength),R=te?ue(e,{bucketKey:`ulg-native-surface-temperature-dispatch-indirect`,label:`${b}-dispatch-indirect`,size:re,usage:ie}):e.createBuffer({label:`${b}-dispatch-indirect`,size:re,usage:ie});let{dispatchPlanPipeline:n,dispatchPlanBindGroupLayout:r,dispatchPlanPipelineCacheStatus:i,pipeline:a,bindGroupLayout:s,temperaturePipelineCacheStatus:c}=Ds(e),l=de(e,{label:`${b}-dispatch-plan-bind-group`,layout:r,entries:[{binding:3,resource:{buffer:L,size:64}},{binding:4,resource:{buffer:u,size:Uint32Array.BYTES_PER_ELEMENT}},{binding:5,resource:{buffer:R,size:re}}]}),d=de(e,{label:`${b}-bind-group`,layout:s,entries:[{binding:0,resource:{buffer:o,size:T}},{binding:1,resource:{buffer:f,size:M}},{binding:2,resource:{buffer:ae,size:P}},{binding:3,resource:{buffer:L,size:64}},{binding:4,resource:{buffer:u,size:Uint32Array.BYTES_PER_ELEMENT}}]}),p=t.beginComputePass({label:`${b}-dispatch-plan-pass`});p.setPipeline(n),p.setBindGroup(0,l),p.dispatchWorkgroups(1),p.end();let m=t.beginComputePass({label:`${b}-compute-pass`});if(m.setPipeline(a),m.setBindGroup(0,d),typeof m.dispatchWorkgroupsIndirect!=`function`)throw TypeError(`commandEncoder compute pass must support dispatchWorkgroupsIndirect`);m.dispatchWorkgroupsIndirect(R,0),m.end();let h=!1,g={schema:bs,status:`gpu-counter-clamped-prefix-encoded-zero-initialized-tail`,mode:`gpu-counter-clamped-conservative-vertex-row-prefix`,firstRow:0,endRowExclusive:C,rowCount:C,conservativeVertexRowCount:C,compactPositionRowCount:C,encodedRowCountSource:`gpu-actual-vertex-counter-clamped-to-conservative-capacity`,unusedTailInitialization:`webgpu-zero-initialized-fresh-output-buffer`,outputStrideFloats:1,outputByteLength:P,surfaceGenerationId:x,volumeGenerationId:S,complete:!0},_=i===c?i:`mixed-pipeline-cache-status`,v={schema:xs,temperatureRowsSchema:ys,temperatureRowsLayoutName:Ss,status:`native-surface-temperature-command-encoded`,backend:`webgpu`,encoding:`f32-kelvin`,semantic:`density-weighted-render-field-temperature-k`,densityLaneOffsetFloats:0,temperatureLaneOffsetFloats:4,surfaceGenerationId:x,volumeGenerationId:S,coverage:g,temperatureRowsBuffer:ae,temperatureRowsBufferByteLength:P,temperatureRowsBufferRowCount:C,temperatureRowsStrideFloats:1,temperatureRowsOwnership:`ulg-owned-generation-buffer`,paramsBuffer:L,paramsBufferByteLength:64,paramsBufferOwnership:`ulg-owned-generation-buffer`,dispatchArgsBuffer:R,dispatchArgsBufferByteLength:3*Uint32Array.BYTES_PER_ELEMENT,dispatchArgsBufferOwnership:`ulg-owned-generation-buffer`,actualVertexCounterBufferByteLength:O,actualVertexCounterMode:`gpu-actual-vertex-counter-clamped-to-conservative-capacity`,compactPositionRowsBufferByteLength:T,compactPositionRowsStrideFloats:w,renderFieldScalarsBufferByteLength:M,fieldDimensions:[...k],fieldStridesFloats:[...A],fieldOffsetFloats:j,workgroupCountX:null,workgroupCountXUpperBound:Math.min(F,Math.ceil(C/64)),workgroupCountYUpperBound:Math.max(1,Math.ceil(Math.ceil(C/64)/F)),maxComputeWorkgroupsPerDimension:F,dispatchMode:`dispatchWorkgroupsIndirect`,pipelineCacheStatus:_,dispatchPlanPipelineCacheStatus:i,temperaturePipelineCacheStatus:c,commandEncoderOwnership:`caller-owned-external-command-encoder`,commandPassCount:2,additionalSubmitCount:0,readbackPerformed:!1,fullReadbackPerformed:!1,destroyed:!1,destroy(){return h?!1:(h=!0,ae.destroy?.(),te?(he(e,L,{bucketKey:`ulg-native-surface-temperature-params`,size:64,usage:ne}),he(e,R,{bucketKey:`ulg-native-surface-temperature-dispatch-indirect`,size:re,usage:ie})):(L.destroy?.(),R.destroy?.()),v.destroyed=!0,v.status=`native-surface-temperature-resources-destroyed`,!0)}};return v}catch(e){throw ae?.destroy?.(),L?.destroy?.(),R?.destroy?.(),e}}export{Jr as A,Ca as C,Wr as D,wa as E,Fi as F,Bn as I,qt as L,Ta as M,ea as N,ba as O,ga as P,cn as R,_n as S,Ii as T,Qa as _,_s as a,dn as b,io as c,Ho as d,is as f,fs as g,ss as h,hs as i,ri as j,ya as k,qo as l,Wo as m,ys as n,vs as o,wo as p,Vs as r,gs as s,Ss as t,ps as u,Aa as v,$i as w,ln as x,pn as y};