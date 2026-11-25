import{m as e}from"./taskRuntime-BENbHj78.js";import{$a as t,$f as n,Cr as r,Jf as i,Kg as a,Mr as o,Nr as s,Pg as c,Q as l,Qa as u,Qf as d,Sr as f,Tr as p,Xf as m,Yf as h,Za as g,Zf as _,br as v,cr as y,dt as b,eo as x,ep as S,fo as C,ft as w,ho as T,jr as E,mo as D,no as O,ot as k,po as A,to as j,tp as M,ut as N,vr as ee,wr as P,xr as F,yr as I,yt as te}from"./molecularDynamicsWebGpu-D3Vza8Ty.js";import{Ai as ne,Ar as re,Di as ie,Fr as ae,Ii as oe,J as L,Lr as se,M as R,Mi as z,P as B,R as V,Vr as ce,W as le,Y as H,ds as ue,fs as U,ms as W,ps as de}from"./sphGpuBuffers-DAbX79BR.js";import{acquireQueueOrderedPooledBuffer as fe,computeBufferBinding as G,createCachedExplicitBindGroup as pe,createCachedExplicitComputePipeline as me,createExplicitComputePipeline as he,deferSubmittedWorkCleanup as ge,registerQueueOrderedPooledBufferReturn as _e,releaseOrDestroyQueueOrderedPooledBuffer as ve,releaseQueueOrderedPooledBuffer as ye,unwrapWebGpuCacheDevice as K}from"../runtime/webgpuComputeLayout.js";import{_ as q,d as be,h as xe,l as Se,m as Ce,p as we}from"./nuclearCherenkovClosure-CpSgQJrk.js";import{n as Te}from"./radiationClosure-BRkiUYv5.js";var Ee=new WeakMap,De=new WeakMap,Oe=1;function ke(e){return(typeof e==`object`||typeof e==`function`)&&e!=null}function Ae(e){if(!ke(e))return null;let t=Ee.get(e);return t??(t=`gpu-device-${Oe++}`,Ee.set(e,t)),t}function je(e,t,{resourceKind:n=`gpu-resource`}={}){if(!ke(e))throw TypeError(`markResourceDevice requires a resource object`);if(!ke(t))throw TypeError(`markResourceDevice requires a device object`);let r={device:t,deviceId:Ae(t),resourceKind:n};return De.set(e,r),r}function Me(e,t){return je(e,t,{resourceKind:`gpu-buffer`})}function Ne(e,t){return je(e,t,{resourceKind:`gpu-texture`})}function Pe(e){if(!ke(e))return null;let t=De.get(e);if(t!=null)return t;let n=e.ownerDevice||e.device||null;return ke(n)?{device:n,deviceId:Ae(n),resourceKind:e.constructor?.name||`gpu-resource`}:null}function Fe(e){let t=Pe(e);return t==null?{ownerKnown:!1,ownerDeviceId:null,resourceKind:e?.constructor?.name||`unknown-resource`}:{ownerKnown:!0,ownerDeviceId:t.deviceId,resourceKind:t.resourceKind}}function Ie({device:e,resource:t,label:n=`resource`,allowUnknown:r=!0}={}){let i=Ae(e);if(!ke(e))return{ok:!1,status:`expected-device-missing`,label:n,expectedDeviceId:null,ownerKnown:!1,ownerDeviceId:null};if(!ke(t))return{ok:!1,status:`resource-missing`,label:n,expectedDeviceId:i,ownerKnown:!1,ownerDeviceId:null};let a=Pe(t);if(a==null)return{ok:!!r,status:r?`resource-device-unknown`:`resource-device-unknown-blocked`,label:n,expectedDeviceId:i,ownerKnown:!1,ownerDeviceId:null};let o=a.device===e;return{ok:o,status:o?`same-device`:`cross-device-resource`,label:n,expectedDeviceId:i,ownerKnown:!0,ownerDeviceId:a.deviceId,resourceKind:a.resourceKind}}var Le=`peercompute.webgpu-marching-cubes.surface-adapter.v0`,Re=`peercompute.webgpu-marching-cubes.adapter-contract.v0`,ze=`peercompute.webgpu-marching-cubes.surface-preflight.v0`,Be=`peercompute.webgpu-marching-cubes.device-ownership-validation.v0`,Ve=`peercompute.webgpu-marching-cubes.volume-source.v0`,He=`peercompute.webgpu-marching-cubes.surface.v0`,Ue=`peercompute.webgpu-marching-cubes.surface-execution.v0`,We=`peercompute.webgpu-marching-cubes.surface-row-metadata.v0`,Ge=`peercompute.webgpu-marching-cubes.surface-output-descriptor.v0`,Ke=`peercompute.webgpu-marching-cubes.device-policy.v0`,qe=`peercompute.webgpu-marching-cubes.material-metadata.v0`,Je=`peercompute.webgpu-marching-cubes.pbr-metadata.v0`,Ye=`peercompute.webgpu-marching-cubes.position-buffer-descriptor.v0`,Xe=`peercompute.webgpu-marching-cubes.normal-buffer-descriptor.v0`,Ze=`peercompute.webgpu-marching-cubes.cpu-fallback.v0`,Qe=`peercompute.webgpu-marching-cubes.compact-position-rows.v0`,$e=`peercompute.webgpu-marching-cubes.compact-normal-rows.v0`,et=`peercompute.webgpu-marching-cubes.compact-material-rows.v0`,tt=`peercompute.webgpu-marching-cubes.surface-draw-rows.v0`,nt=`peercompute.webgpu-marching-cubes.indirect-draw-rows.v0`,rt=`peercompute.webgpu-marching-cubes.layout.compact-position-f32x4.v0`,it=`peercompute.webgpu-marching-cubes.layout.compact-normal-f32x4.v0`,at=`peercompute.webgpu-marching-cubes.packed-normal-rows.v0`,ot=`peercompute.webgpu-marching-cubes.layout.normal-octahedral-snorm16x2.v0`,st=`octahedral-snorm16x2`,J=`peercompute.webgpu-marching-cubes.layout.compact-material-f32x4.v0`,ct=`peercompute.webgpu-marching-cubes.layout.surface-draw-u32x4.v0`,lt=`peercompute.webgpu-marching-cubes.layout.indirect-draw-u32x4.v0`,ut=Object.freeze([`positionX:f32`,`positionY:f32`,`positionZ:f32`,`padding:f32`]),dt=Object.freeze([`normalX:f32`,`normalY:f32`,`normalZ:f32`,`padding:f32`]),ft=Object.freeze([`normalOctahedralSnorm16x2:u32`]),pt=Object.freeze([`materialId:f32`,`phaseId:f32`,`sourceVoxelLinearIndex:f32`,`status:f32`]),mt=Object.freeze([`firstVertex:u32`,`vertexCount:u32`,`materialSlot:u32`,`flags:u32`]),ht=Object.freeze([`vertexCount:u32`,`instanceCount:u32`,`firstVertex:u32`,`firstInstance:u32`]),Y=`float32x4-position`,gt=`texture-3d`,_t=`scalar-buffer`,vt=`peercompute.webgpu-marching-cubes.layout.scalar-field-f32.v0`,yt=`sparse-brick-atlas`,bt=`peercompute.webgpu-marching-cubes.layout.sparse-brick-atlas-f32.v0`,xt=4294967295,St=4294967295;Object.freeze([`timestamp-query`]);function X(e){return(typeof e==`object`||typeof e==`function`)&&e!=null}function Ct(e,t){let n=Number(e);if(!Number.isFinite(n))throw TypeError(`${t} must be a finite number`);return n}function wt(e,t=`normalSign`){let n=Ct(e??1,t);if(n!==-1&&n!==1)throw RangeError(`${t} must be exactly -1 or 1`);return n}function Tt(e,t=`dims`){if(!Array.isArray(e)&&!ArrayBuffer.isView(e))throw TypeError(`${t} must be an array-like [x, y, z]`);if(e.length<3)throw RangeError(`${t} must have at least three entries`);return Array.from(e.slice(0,3),(e,n)=>{let r=Number(e);if(!Number.isInteger(r)||r<=0)throw RangeError(`${t}[${n}] must be a positive integer`);return r})}function Et(e,t){let n=Number(e);if(!Number.isInteger(n)||n<=0)throw RangeError(`${t} must be a positive integer`);return n}function Dt(e,t){let n=Number(e);if(!Number.isInteger(n)||n<0)throw RangeError(`${t} must be a non-negative integer`);return n}function Ot(e,t){let n=Dt(e,t);if(n>4294967295)throw RangeError(`${t} must fit in a u32`);return n}function kt(e,t,n){let r=t??e?.size??e?.byteLength??null;return r==null?null:Dt(r,`${n}.byteLength`)}function At(e){return e?.scalarBuffer||e?.storageBuffer||(e?.sourceType===`scalar-buffer`?e?.buffer:null)||(!X(e?.texture)&&e?.dims!=null?e?.buffer:null)||null}function jt(e,{texture:t=null,scalarBuffer:n=null,directoryBuffer:r=null,activeBrickRowsBuffer:i=null,atlasBuffer:a=null,candidateVoxelIdsBuffer:o=null}={}){if(e!=null){let t=String(e);if(t===`texture-3d`||t===`scalar-buffer`||t===`sparse-brick-atlas`)return t;throw TypeError(`unsupported volume sourceType ${t}`)}return X(r)||X(i)||X(a)||X(o)?yt:X(n)?_t:X(t)?gt:null}function Mt(e){return String(e?.scalarType||e?.scalarFormat||e?.format||`f32`)}function Nt(e){let t=e?.scalarOffset??e?.scalarOffsetFloats??e?.bufferOffsetFloats??e?.offsetFloats??e?.offset??null,n=e?.scalarOffsetBytes??e?.bufferOffsetBytes??e?.byteOffset??null;if(n!=null){let e=Dt(n,`scalarOffsetBytes`);if(e%Float32Array.BYTES_PER_ELEMENT!=0)throw RangeError(`scalarOffsetBytes must be a multiple of 4 for f32 scalar buffers`);if(t!=null&&Dt(t,`scalarOffset`)*Float32Array.BYTES_PER_ELEMENT!=e)throw RangeError(`scalarOffset and scalarOffsetBytes describe different offsets`);return e/Float32Array.BYTES_PER_ELEMENT}return t==null?0:Dt(t,`scalarOffset`)}function Pt(e,t){let n=e?.scalarStrides||e?.strides||null;if(n!=null){if(!Array.isArray(n)&&!ArrayBuffer.isView(n))throw TypeError(`scalarStrides must be an array-like [x, y, z]`);if(n.length<3)throw RangeError(`scalarStrides must have at least three entries`);return Array.from(n.slice(0,3),(e,t)=>Et(e,`scalarStrides[${t}]`))}let r=Et(e?.rowStrideFloats??e?.rowStride??t[0],`rowStrideFloats`);return[1,r,Et(e?.sliceStrideFloats??e?.sliceStride??r*t[1],`sliceStrideFloats`)]}function Ft(e,t){let n=t?.bufferByteLength??t?.scalarBufferByteLength??t?.byteLength??null??e?.size??e?.byteLength??null;return n==null?null:Dt(n,`scalarBuffer.byteLength`)}function It(e,t){let n=At(e),r=Mt(e),i=Pt(e,t),a=Nt(e),o=Ft(n,e),s=a+(t[0]-1)*i[0]+(t[1]-1)*i[1]+(t[2]-1)*i[2],c=s+1,l=c*Float32Array.BYTES_PER_ELEMENT;return{sourceType:_t,layoutName:vt,scalarType:r,scalarBuffer:n,storageBuffer:n,scalarStrides:i,rowStrideFloats:i[1],sliceStrideFloats:i[2],scalarOffset:a,scalarOffsetBytes:a*Float32Array.BYTES_PER_ELEMENT,bufferByteLength:o,requiredScalarCount:c,requiredByteLength:l,maxScalarIndex:s,byteLengthValid:o==null||o>=l}}function Lt(e,t){let n=Et(e?.brickSize??8,`brickSize`),r=t.map(e=>Math.ceil(e/n)),i=Ot(r[0]*r[1]*r[2],`directoryCount`);if(e?.directoryCount!=null&&Ot(e.directoryCount,`directoryCount`)!==i)throw RangeError(`directoryCount must equal the exact brickCounts product`);let a=Ot(e?.directoryOffset??0,`directoryOffset`),o=Et(e?.activeBrickRowStrideU32??e?.activeBrickRowStride??16,`activeBrickRowStrideU32`),s=Ot(e?.activeBrickAtlasCellOffsetLane??7,`activeBrickAtlasCellOffsetLane`);if(s>=o)throw RangeError(`activeBrickAtlasCellOffsetLane must be within an active brick row`);let c=Et(e?.atlasCellStrideFloats??e?.atlasCellStride??8,`atlasCellStrideFloats`),l=Ot(e?.atlasScalarLane??0,`atlasScalarLane`);if(l>=c)throw RangeError(`atlasScalarLane must be within an atlas cell row`);let u=e?.candidateVoxelOffset??e?.candidateVoxelOffsetU32??null,d=e?.candidateVoxelOffsetBytes??null,f;if(d!=null){let e=Dt(d,`candidateVoxelOffsetBytes`);if(e%Uint32Array.BYTES_PER_ELEMENT!=0)throw RangeError(`candidateVoxelOffsetBytes must be a multiple of 4`);if(f=Ot(e/Uint32Array.BYTES_PER_ELEMENT,`candidateVoxelOffset`),u!=null&&Ot(u,`candidateVoxelOffset`)!==f)throw RangeError(`candidateVoxelOffset and candidateVoxelOffsetBytes describe different offsets`)}else f=Ot(u??0,`candidateVoxelOffset`);let p=f*Uint32Array.BYTES_PER_ELEMENT,m=Ot(e?.directorySentinel??4294967295,`directorySentinel`),h=Ot(e?.candidateSentinel??4294967295,`candidateSentinel`);if(m!==4294967295||h!==4294967295)throw RangeError(`sparse directory and candidate sentinels must be 0xffffffff`);let g=e?.directoryBuffer||null,_=e?.activeBrickRowsBuffer||null,v=e?.atlasBuffer||null,y=e?.candidateVoxelIdsBuffer||null,b=e?.candidateDispatchIndirectBuffer||null,x=kt(g,e?.directoryBufferByteLength,`directoryBuffer`),S=kt(_,e?.activeBrickRowsBufferByteLength,`activeBrickRowsBuffer`),C=kt(v,e?.atlasBufferByteLength,`atlasBuffer`),w=kt(y,e?.candidateVoxelIdsBufferByteLength,`candidateVoxelIdsBuffer`),T=b==null?null:kt(b,e?.candidateDispatchIndirectBufferByteLength,`candidateDispatchIndirectBuffer`),E=Dt(e?.candidateDispatchIndirectOffsetBytes??0,`candidateDispatchIndirectOffsetBytes`);if(E%Uint32Array.BYTES_PER_ELEMENT!==0)throw RangeError(`candidateDispatchIndirectOffsetBytes must be a multiple of 4`);let D=Ot(e?.activeBrickCount??e?.activeBrickCapacity??(S==null?0:Math.floor(S/(o*Uint32Array.BYTES_PER_ELEMENT))),`activeBrickCount`),O=Ot(e?.atlasCellCount??e?.atlasCellCapacity??(C==null?0:Math.floor(C/(c*Float32Array.BYTES_PER_ELEMENT))),`atlasCellCount`),k=Ot(e?.candidateVoxelCount??e?.candidateVoxelCapacity??(w==null?0:Math.max(0,Math.floor(w/Uint32Array.BYTES_PER_ELEMENT)-f)),`candidateVoxelCount`),A=Ot(e?.generationId??e?.generation??0,`generationId`),j=Ct(e?.backgroundValue??0,`backgroundValue`),M=(a+i)*Uint32Array.BYTES_PER_ELEMENT,N=D*o*Uint32Array.BYTES_PER_ELEMENT,ee=O*c*Float32Array.BYTES_PER_ELEMENT,P=(f+k)*Uint32Array.BYTES_PER_ELEMENT,F=b==null?0:E+3*Uint32Array.BYTES_PER_ELEMENT,I={directory:x==null||x>=M,activeBrickRows:S==null||S>=N,atlas:C==null||C>=ee,candidateVoxelIds:w==null||w>=P,candidateDispatchIndirect:b==null||T>=F};return{sourceType:yt,layoutName:bt,directoryBuffer:g,activeBrickRowsBuffer:_,atlasBuffer:v,candidateVoxelIdsBuffer:y,candidateDispatchIndirectBuffer:b,brickSize:n,brickCounts:r,tailBrickSampleExtent:t.map(e=>(e-1)%n+1),directoryOffset:a,directoryCount:i,directorySentinel:m,activeBrickCount:D,activeBrickCapacity:D,activeBrickRowStrideU32:o,activeBrickAtlasCellOffsetLane:s,atlasCellCount:O,atlasCellCapacity:O,atlasCellStrideFloats:c,atlasScalarLane:l,candidateVoxelCount:k,candidateVoxelCapacity:k,candidateVoxelOffset:f,candidateVoxelOffsetU32:f,candidateVoxelOffsetBytes:p,candidateVoxelBindingByteLength:k*Uint32Array.BYTES_PER_ELEMENT,candidateDispatchIndirectOffsetBytes:E,candidateDispatchIndirectBufferByteLength:T,candidateDispatchIndirectRequiredByteLength:F,candidateDispatchMode:b==null?`fixed-capacity`:`gpu-indirect-admitted-count`,candidateSentinel:h,generationId:A,generation:A,backgroundValue:j,directoryBufferByteLength:x,directoryRequiredByteLength:M,activeBrickRowsBufferByteLength:S,activeBrickRowsRequiredByteLength:N,atlasBufferByteLength:C,atlasRequiredByteLength:ee,candidateVoxelIdsBufferByteLength:w,candidateVoxelIdsRequiredByteLength:P,byteLengthChecks:I,byteLengthValid:Object.values(I).every(Boolean),candidateContract:`logical dual-grid voxel IDs; unused capacity entries are 0xffffffff`,candidateDispatchContract:b==null?`host capacity dispatch with sentinel guards`:`GPU-authored dispatchWorkgroupsIndirect u32x3 row; x is zero when generation admission fails`}}function Rt(e){return{name:e?.name||`Error`,message:e instanceof Error?e.message:String(e),status:e?.status||e?.code||`error`,details:e?.details||null,stage:e?.stage||e?.adapterStage||e?.marchingCubesStage||null,stack:e instanceof Error&&e.stack||null}}function zt(e,t){if(e!=null&&(typeof e==`object`||typeof e==`function`))try{e.adapterStage=e.adapterStage||t}catch{}return e}function Bt(e,t={}){return{status:e,at:new Date().toISOString(),...t}}function Vt({ownsDevice:e=!1,ownerDeviceId:t=null,device:n=null}={}){let r=!!e;return{schema:Ke,version:0,ownership:r?`adapter-owned`:`caller-owned`,ownsDevice:r,requestDeviceByDefault:!1,ownedDeviceHelper:`requestWebGpuMarchingCubesDevice`,sameDeviceChecks:!0,ownerDeviceId:t,deviceLabel:typeof n?.label==`string`?n.label:null}}function Ht(e=null){return e?.schema===`peercompute.webgpu-marching-cubes.material-metadata.v0`?{version:0,role:`material-metadata`,available:!!e.available,payload:e.payload??null,placeholder:e.payload==null,...e}:{schema:qe,version:0,role:`material-metadata`,available:e!=null,placeholder:e==null,payload:e}}function Ut(e=null){return e?.schema===`peercompute.webgpu-marching-cubes.pbr-metadata.v0`?{version:0,role:`pbr-metadata`,available:!!e.available,payload:e.payload??null,placeholder:e.payload==null,...e}:{schema:Je,version:0,role:`pbr-metadata`,available:e!=null,placeholder:e==null,payload:e}}function Wt({status:e=`position-rows-empty`,available:t=!1,rowCount:n=0,buffer:r=null,bufferOffsetBytes:i=0,bufferByteLength:a=0,bufferRetained:o=!1,bufferOwnership:s=`none`,ownerDeviceId:c=null,resourceOwnership:l=null,devicePolicy:u=null,bufferKind:d=null}={}){let f=Math.max(0,Math.round(Number(n)||0)),p=Math.max(0,Math.round(Number(a)||0)),m=f*ut.length*Float32Array.BYTES_PER_ELEMENT,h=d||r?.bufferKind||(r==null?`none`:`gpu-buffer`);return{schema:Ye,version:0,role:`position-buffer`,status:e,available:!!t,layoutName:rt,rowSchema:Qe,rowLayout:[...ut],vertexFormat:Y,rowStrideFloats:ut.length,rowStrideBytes:ut.length*Float32Array.BYTES_PER_ELEMENT,rowCount:f,count:f,buffer:r,bufferKind:h,bufferOffsetBytes:i,bufferByteLength:p,byteLength:p,expectedByteLength:m,byteLengthValid:!t||p>=m,bufferRetained:!!o,bufferOwnership:s,ownership:{buffer:s,device:u?.ownership||null,ownerDeviceId:c,resourceOwnership:l},ownerDeviceId:c,resourceOwnership:l,sameDeviceStatus:l?.status||null,sameDevice:l?.ok??null,devicePolicy:u,readback:!1}}function Gt({status:e=`normal-rows-empty`,available:t=!1,rowCount:n=0,buffer:r=null,bufferOffsetBytes:i=0,bufferByteLength:a=0,bufferRetained:o=!1,bufferOwnership:s=`none`,ownerDeviceId:c=null,resourceOwnership:l=null,devicePolicy:u=null,surfaceGenerationId:d=null,volumeGenerationId:f=null,normalSign:p=1,bufferKind:m=null}={}){let h=Math.max(0,Math.round(Number(n)||0)),g=Math.max(0,Math.round(Number(a)||0)),_=h*Uint32Array.BYTES_PER_ELEMENT,v=m||r?.bufferKind||(r==null?`none`:`gpu-buffer`),y=wt(p),b=d==null?null:Dt(d,`surfaceGenerationId`),x=f==null?null:Dt(f,`volumeGenerationId`);return{schema:Xe,version:0,descriptorVersion:0,role:`normal-buffer`,status:e,available:!!t,layoutName:ot,rowSchema:at,rowLayout:[...ft],rowStrideBytes:Uint32Array.BYTES_PER_ELEMENT,rowCount:h,count:h,encoding:st,componentEncoding:`snorm16x2`,decode:`octahedral-unit-vector`,semantic:`oriented-scalar-gradient`,sourceSemantic:`scalar-gradient`,normalSign:y,degenerateEncoding:`reserved-u32-0x80008000`,degenerateSentinel:2147516416,buffer:r,bufferKind:v,bufferOffsetBytes:i,bufferByteLength:g,byteLength:g,expectedByteLength:_,byteLengthValid:!t||g>=_,bufferRetained:!!o,bufferOwnership:s,ownership:{buffer:s,device:u?.ownership||null,ownerDeviceId:c,resourceOwnership:l,lifetimeOwner:`surface-result-release`,pairedPositionRelease:!0},ownerDeviceId:c,resourceOwnership:l,sameDeviceStatus:l?.status||null,sameDevice:l?.ok??null,devicePolicy:u,generation:{schema:`peercompute.webgpu-marching-cubes.surface-buffer-generation.v0`,surfaceGenerationId:b,volumeGenerationId:x,pairedPositionSurfaceGenerationId:b,producerStage:`marchingCubesVertexEmit`,sameSubmitAsPosition:!0},lifetime:{owner:`surface-result`,releaseMethod:`surface.release`,pairedWithPositionBuffer:!0,retireAfterConsumerSubmitFence:!0},producer:{stage:`marchingCubesVertexEmit`,timestampSpanLabel:`marchingCubesVertexEmit`,additionalSubmitCount:0},readback:!1}}function Kt({schema:e,family:t,status:n,available:r=!1,layoutName:i,rowLayout:a,rowStrideFloats:o=0,rowStrideBytes:s=0,rowCount:c=0,buffer:l=null,bufferOffsetBytes:u=0,bufferByteLength:d=0,bufferRetained:f=!1,bufferOwnership:p=`none`,ownerDeviceId:m=null,resourceOwnership:h=null,devicePolicy:g=null,reason:_=null,derivation:v=null,sourceCounts:y=null,materialPayload:b=null,pbrPayload:x=null,bufferKind:S=null}={}){let C=S||l?.bufferKind||(l==null?`none`:`gpu-buffer`),w={schema:e,version:0,descriptorVersion:0,family:t,role:`${t}-rows`,status:n,available:!!r,produced:!!r,layoutName:i,rowLayout:[...a],rowStrideFloats:o,rowStrideBytes:s,rowCount:c,count:c,buffer:l,bufferOffsetBytes:u,bufferByteLength:d,byteLength:d,expectedByteLength:Math.max(0,c*s),byteLengthValid:!r||d>=Math.max(0,c*s),bufferRetained:!!f,bufferKind:C,bufferOwnership:p,ownership:{buffer:p,device:g?.ownership||null,ownerDeviceId:m,resourceOwnership:h},ownerDeviceId:m,resourceOwnership:h,devicePolicy:g,materialPayload:b,pbrPayload:x,sourceCounts:y,reason:_,derivation:v,readback:!1};return t===`position`&&(w.positionBufferDescriptor=Wt({status:n,available:r,rowCount:c,buffer:l,bufferOffsetBytes:u,bufferByteLength:d,bufferRetained:f,bufferOwnership:p,ownerDeviceId:m,resourceOwnership:h,devicePolicy:g,bufferKind:C})),w}function qt({buffer:e=null,bufferByteLength:t=0,bufferRetained:n=!1,bufferOwnership:r=`none`,ownerDeviceId:i=null,resourceOwnership:a=null,devicePolicy:o=null,vertexCount:s=0,triangleCount:c=0,normalBuffer:l=null,normalBufferByteLength:u=0,normalResourceOwnership:d=null,surfaceGenerationId:f=null,volumeGenerationId:p=null,normalSign:m=1,materialPayload:h=null,pbrPayload:g=null}={}){let _=Math.max(0,Math.round(Number(s)||0)),v=Math.max(0,Math.round(Number(c)||0)),y=_>0&&X(e),b=y&&X(l)&&u>=_*Uint32Array.BYTES_PER_ELEMENT,x=y?t:0,S=Ht(h),C=Ut(g),w={vertexCount:_,triangleCount:v},T=Gt({status:b?`normal-rows-resident`:`normal-rows-not-produced`,available:b,rowCount:b?_:0,buffer:b?l:null,bufferByteLength:b?u:0,bufferRetained:b&&!!n,bufferOwnership:b?r:`none`,ownerDeviceId:i,resourceOwnership:b?d:null,devicePolicy:o,surfaceGenerationId:f,volumeGenerationId:p,normalSign:m}),E={position:Kt({schema:Qe,family:`position`,status:y?`position-rows-resident`:`position-rows-empty`,available:y,layoutName:rt,rowLayout:ut,rowStrideFloats:4,rowStrideBytes:16,rowCount:_,buffer:e,bufferOffsetBytes:0,bufferByteLength:x,bufferRetained:y&&!!n,bufferOwnership:y?r:`none`,ownerDeviceId:i,resourceOwnership:a,devicePolicy:o,sourceCounts:w,materialPayload:S,pbrPayload:C}),normal:Kt({schema:b?at:$e,family:`normal`,status:T.status,available:b,layoutName:b?ot:it,rowLayout:b?ft:dt,rowStrideFloats:b?0:4,rowStrideBytes:b?Uint32Array.BYTES_PER_ELEMENT:16,rowCount:b?_:0,buffer:b?l:null,bufferByteLength:b?u:0,bufferRetained:b&&!!n,bufferOwnership:b?r:`none`,ownerDeviceId:i,resourceOwnership:b?d:null,devicePolicy:o,sourceCounts:w,reason:b?null:`surface engine did not provide packed normal rows`,derivation:b?`central-difference scalar gradients interpolated during marching-cubes vertex emission`:`consumer may use a face-normal fallback for legacy engines`}),material:Kt({schema:et,family:`material`,status:`material-rows-not-produced`,available:!1,layoutName:J,rowLayout:pt,rowStrideFloats:4,rowStrideBytes:16,rowCount:0,devicePolicy:o,sourceCounts:w,materialPayload:S,pbrPayload:C,reason:`native kernel currently has no material, phase, or PBR input`,derivation:`supply material and PBR metadata in the caller-owned translation stage`}),draw:Kt({schema:tt,family:`draw`,status:`draw-rows-not-produced`,available:!1,layoutName:ct,rowLayout:mt,rowStrideFloats:0,rowStrideBytes:16,rowCount:0,devicePolicy:o,sourceCounts:w,reason:`adapter emits one retained compact position buffer, not renderer draw rows`,derivation:`ULG can translate the retained triangle-list positions into surface draw rows`}),indirect:Kt({schema:nt,family:`indirect`,status:`indirect-draw-rows-not-produced`,available:!1,layoutName:lt,rowLayout:ht,rowStrideFloats:0,rowStrideBytes:16,rowCount:0,devicePolicy:o,sourceCounts:w,reason:`adapter does not own the render pass or indirect draw buffer`,derivation:`ULG can build indirect draw rows from vertexCount and caller-owned draw policy`})};return E.normal.normalBufferDescriptor=T,E.normal.encoding=T.encoding,E.normal.semantic=T.semantic,E.normal.sourceSemantic=T.sourceSemantic,E.normal.normalSign=T.normalSign,E.normal.generation=T.generation,E.normal.lifetime=T.lifetime,E.normal.producer=T.producer,{schema:Ge,version:0,descriptorVersion:0,status:y?`surface-outputs-resident`:`surface-outputs-empty`,topology:`triangle-list`,indexFormat:null,layoutName:rt,rowLayoutName:rt,vertexFormat:Y,rowCount:_,vertexCount:_,triangleCount:v,byteLength:x,readback:!1,fullReadback:!1,devicePolicy:o,materialPayload:S,pbrPayload:C,retainedBuffers:{position:y?e:null,normal:b?l:null},rows:E,positionBufferDescriptor:E.position.positionBufferDescriptor,normalBufferDescriptor:T,materialDescriptor:E.material,drawDescriptor:E.draw,indirectDescriptor:E.indirect}}function Jt({buffer:e=null,bufferByteLength:t=0,bufferRetained:n=!1,bufferOwnership:r=`none`,ownerDeviceId:i=null,resourceOwnership:a=null,devicePolicy:o=null,vertexCount:s=0,triangleCount:c=0,normalBuffer:l=null,normalBufferByteLength:u=0,normalResourceOwnership:d=null,surfaceGenerationId:f=null,volumeGenerationId:p=null,normalSign:m=1,materialPayload:h=null,pbrPayload:g=null}={}){let _=Math.max(0,Math.round(Number(s)||0)),v=_>0&&X(e),y=v&&X(l)&&u>=_*Uint32Array.BYTES_PER_ELEMENT,b=v?`position-rows-resident`:`position-rows-empty`,x=Ht(h),S=Ut(g),C=Gt({status:y?`normal-rows-resident`:`normal-rows-not-produced`,available:y,rowCount:y?_:0,buffer:y?l:null,bufferByteLength:y?u:0,bufferRetained:y&&!!n,bufferOwnership:y?r:`none`,ownerDeviceId:i,resourceOwnership:y?d:null,devicePolicy:o,surfaceGenerationId:f,volumeGenerationId:p,normalSign:m});return{schema:We,version:0,status:v?`surface-position-rows-resident`:`surface-position-rows-empty`,layoutName:rt,rowLayoutName:rt,rowCount:_,triangleCount:c,byteLength:v?t:0,devicePolicy:o,materialPayload:x,pbrPayload:S,readback:!1,fullReadback:!1,position:{schema:Qe,version:0,descriptorVersion:0,family:`position`,role:`position-rows`,status:b,available:v,produced:v,layoutName:rt,rowLayout:[...ut],rowStrideFloats:4,rowStrideBytes:16,rowCount:_,count:_,buffer:e,bufferOffsetBytes:0,bufferByteLength:v?t:0,byteLength:v?t:0,bufferRetained:v&&!!n,bufferOwnership:v?r:`none`,ownership:{buffer:v?r:`none`,device:o?.ownership||null,ownerDeviceId:i,resourceOwnership:a},ownerDeviceId:i,resourceOwnership:a,devicePolicy:o,positionBufferDescriptor:Wt({status:b,available:v,rowCount:_,buffer:e,bufferOffsetBytes:0,bufferByteLength:v?t:0,bufferRetained:v&&!!n,bufferOwnership:v?r:`none`,ownerDeviceId:i,resourceOwnership:a,devicePolicy:o}),readback:!1},normal:{schema:y?at:$e,version:0,descriptorVersion:0,family:`normal`,role:`normal-rows`,status:C.status,available:y,produced:y,reason:y?null:`surface engine did not provide packed normal rows`,layoutName:y?ot:it,rowLayout:y?[...ft]:[...dt],rowStrideFloats:y?0:4,rowStrideBytes:y?Uint32Array.BYTES_PER_ELEMENT:16,rowCount:y?_:0,count:y?_:0,buffer:y?l:null,bufferByteLength:y?u:0,byteLength:y?u:0,bufferRetained:y&&!!n,bufferOwnership:y?r:`none`,ownership:C.ownership,ownerDeviceId:C.ownerDeviceId,resourceOwnership:C.resourceOwnership,devicePolicy:o,encoding:C.encoding,semantic:C.semantic,sourceSemantic:C.sourceSemantic,normalSign:C.normalSign,generation:C.generation,lifetime:C.lifetime,producer:C.producer,normalBufferDescriptor:C,derivation:y?`central-difference scalar gradients interpolated during marching-cubes vertex emission`:`consumer may use a face-normal fallback for legacy engines`,readback:!1},material:{schema:et,version:0,descriptorVersion:0,family:`material`,role:`material-rows`,status:`material-rows-not-produced`,available:!1,produced:!1,metadataAvailable:x.available||S.available,reason:`native kernel currently has no material or phase input`,layoutName:J,rowLayout:[...pt],rowStrideFloats:4,rowStrideBytes:16,rowCount:0,count:0,buffer:null,bufferByteLength:0,byteLength:0,bufferRetained:!1,bufferOwnership:`none`,devicePolicy:o,materialPayload:x,pbrPayload:S,derivation:`supply material metadata in the caller-owned translation stage`,readback:!1}}}function Yt({texture:e=null,scalarBuffer:t=null,sparseVolume:n=null,dims:r,dualGridDims:i=null,device:a=null,diagonalLength:o=null,label:s=`volume`,source:c=null,sourceType:l=null,scalarType:u=`f32`,scalarStrides:d=null,rowStrideFloats:f=null,rowStride:p=null,sliceStrideFloats:m=null,sliceStride:h=null,scalarOffset:g=null,scalarOffsetBytes:_=null,bufferByteLength:v=null,normalSign:y=1,originalVolume:b=null,markTextureOwner:x=!1,markBufferOwner:S=!1,requireTexture:C=!1,requireNativeSource:w=!1}={}){let T=Tt(r),E=wt(y),D=t||null,O=n||{},k=jt(l,{texture:e,scalarBuffer:D,directoryBuffer:O.directoryBuffer,activeBrickRowsBuffer:O.activeBrickRowsBuffer,atlasBuffer:O.atlasBuffer,candidateVoxelIdsBuffer:O.candidateVoxelIdsBuffer});if(C&&(k!==`texture-3d`||!X(e)))throw TypeError(`volume requires a GPUTexture-like texture`);if(w&&k==null)throw TypeError(`volume requires a texture_3d, f32 scalar buffer, or sparse brick atlas source`);if(k===`scalar-buffer`&&!X(D))throw TypeError(`buffer volume requires a GPUBuffer-like scalarBuffer`);if(k===`sparse-brick-atlas`){for(let[e,t]of[[`directoryBuffer`,O.directoryBuffer],[`activeBrickRowsBuffer`,O.activeBrickRowsBuffer],[`atlasBuffer`,O.atlasBuffer],[`candidateVoxelIdsBuffer`,O.candidateVoxelIdsBuffer]])if(!X(t))throw TypeError(`sparse brick volume requires a GPUBuffer-like ${e}`)}let A=k===`scalar-buffer`?It({scalarBuffer:D,scalarType:u,scalarStrides:d,rowStrideFloats:f,rowStride:p,sliceStrideFloats:m,sliceStride:h,scalarOffset:g,scalarOffsetBytes:_,bufferByteLength:v},T):null;if(A!=null&&A.scalarType!==`f32`)throw TypeError(`buffer volume scalarType must be f32`);if(A!=null&&!A.byteLengthValid)throw RangeError(`buffer volume scalarBuffer is too small for dims, strides, and offset`);let j=k===`sparse-brick-atlas`?Lt(O,T):null;if(j!=null&&!j.byteLengthValid)throw RangeError(`sparse brick volume contains an undersized GPU buffer`);let M=j==null?[]:[j.directoryBuffer,j.activeBrickRowsBuffer,j.atlasBuffer,j.candidateVoxelIdsBuffer,j.candidateDispatchIndirectBuffer].filter(X),N=k===`scalar-buffer`?D:k===`sparse-brick-atlas`?j.atlasBuffer:e,ee=Fe(N);if(X(N)&&X(a)){if(k===`texture-3d`&&x)ee=Ne(N,a);else if(k===`scalar-buffer`&&S)ee=Me(N,a);else if(k===`sparse-brick-atlas`&&S){for(let e of M)Me(e,a);ee=Fe(N)}}let P=i==null?T.map(e=>e-1):Tt(i,`dualGridDims`),F=o==null?Math.hypot(T[0],T[1],T[2]):Ct(o,`diagonalLength`);return Object.freeze({schema:Ve,version:0,label:s,source:c||(k===`scalar-buffer`?`external-scalar-buffer`:k===`sparse-brick-atlas`?`external-sparse-brick-atlas`:k===`texture-3d`?`external-texture`:`external-volume`),sourceType:k,device:a,ownerDeviceId:ee?.ownerDeviceId||ee?.deviceId||null,dims:T,dualGridDims:P,numVoxels:T[0]*T[1]*T[2],dualGridNumVoxels:P[0]*P[1]*P[2],diagonalLength:F,normalSign:E,normalSemantic:`oriented-scalar-gradient`,normalSourceSemantic:`scalar-gradient`,texture:e,scalarBuffer:A?.scalarBuffer||null,storageBuffer:A?.storageBuffer||null,scalarType:A?.scalarType||null,scalarLayoutName:A?.layoutName||null,scalarStrides:A?.scalarStrides||null,rowStrideFloats:A?.rowStrideFloats||null,sliceStrideFloats:A?.sliceStrideFloats||null,scalarOffset:A?.scalarOffset||0,scalarOffsetBytes:A?.scalarOffsetBytes||0,scalarBufferByteLength:A?.bufferByteLength||null,scalarRequiredByteLength:A?.requiredByteLength||null,scalarRequiredCount:A?.requiredScalarCount||null,scalarBufferByteLengthValid:A?.byteLengthValid??null,scalar:A,sparse:j,...j||{},originalVolume:b})}function Xt(e,{device:t=null,markTextureOwner:n=!1,markBufferOwner:r=!1,requireTexture:i=!1,requireNativeSource:a=!1}={}){if(!X(e))throw TypeError(`normalizeMarchingCubesVolumeSource requires a volume object`);let o=X(e.device)?e.device:t,s=At(e);return Yt({texture:e.texture||null,scalarBuffer:s,sparseVolume:e,dims:e.dims,dualGridDims:e.dualGridDims||null,device:o,diagonalLength:e.diagonalLength??null,label:e.label||`volume`,source:e.source||null,sourceType:e.sourceType||e.volumeSourceType||null,scalarType:Mt(e),scalarStrides:e.scalarStrides||e.strides||null,rowStrideFloats:e.rowStrideFloats??null,rowStride:e.rowStride??null,sliceStrideFloats:e.sliceStrideFloats??null,sliceStride:e.sliceStride??null,scalarOffset:e.scalarOffset??e.scalarOffsetFloats??e.bufferOffsetFloats??e.offsetFloats??e.offset??null,scalarOffsetBytes:e.scalarOffsetBytes??e.bufferOffsetBytes??e.byteOffset??null,bufferByteLength:e.bufferByteLength??e.scalarBufferByteLength??e.byteLength??null,normalSign:e.normalSign??1,originalVolume:e.schema===`peercompute.webgpu-marching-cubes.volume-source.v0`?e.originalVolume||null:e,markTextureOwner:n,markBufferOwner:r,requireTexture:i,requireNativeSource:a})}function Zt({scalarBuffer:e=null,storageBuffer:t=null,buffer:n=null,dims:r,scalarStrides:i=null,strides:a=null,rowStrideFloats:o=null,rowStride:s=null,sliceStrideFloats:c=null,sliceStride:l=null,scalarOffset:u=null,scalarOffsetFloats:d=null,bufferOffsetFloats:f=null,scalarOffsetBytes:p=null,bufferOffsetBytes:m=null,byteOffset:h=null,bufferByteLength:g=null,scalarBufferByteLength:_=null,device:v=null,diagonalLength:y=null,label:b=`volume`,source:x=`external-scalar-buffer`,scalarType:S=`f32`,normalSign:C=1}={}){let w=e||t||n;if(!X(w))throw TypeError(`createBufferVolumeDescriptor requires a GPUBuffer-like scalarBuffer`);return Yt({scalarBuffer:w,dims:r,device:v,diagonalLength:y,label:b,source:x,sourceType:_t,normalSign:C,scalarType:S,scalarStrides:i||a||null,rowStrideFloats:o,rowStride:s,sliceStrideFloats:c,sliceStride:l,scalarOffset:u??d??f??null,scalarOffsetBytes:p??m??h??null,bufferByteLength:g??_??null,markBufferOwner:!0,requireNativeSource:!0})}function Qt({backend:e=`webgpu`}={}){return Object.freeze({schema:Re,version:0,adapterSchema:Le,backend:e,api:Object.freeze([`getStatus`,`getCapabilities`,`preflight`,`extractSurface`,`setVolume`,`release`]),devicePolicy:Object.freeze({schema:Ke,version:0,defaultOwnership:`caller-owned`,requestDeviceByDefault:!1,ownedDeviceHelper:`requestWebGpuMarchingCubesDevice`,sameDeviceChecks:!0,validationSchema:Be,validationHelper:`validateSurfaceAdapterDeviceOwnership`,crossDeviceOutputStatus:`same-device-check-failed`}),input:Object.freeze({volumeSchema:Ve,nativeSourceTypes:Object.freeze([gt,_t,yt]),acceptedVolumeFields:Object.freeze(`texture.scalarBuffer.storageBuffer.dims.dualGridDims.dualGridNumVoxels.diagonalLength.device.sourceType.scalarType.scalarStrides.rowStrideFloats.sliceStrideFloats.scalarOffset.scalarOffsetBytes.directoryBuffer.activeBrickRowsBuffer.atlasBuffer.candidateVoxelIdsBuffer.brickSize.directoryOffset.activeBrickCount.activeBrickRowStrideU32.activeBrickAtlasCellOffsetLane.atlasCellCount.atlasCellStrideFloats.atlasScalarLane.candidateVoxelCount.candidateVoxelOffset.candidateVoxelOffsetBytes.generationId.backgroundValue`.split(`.`)),scalarBuffer:Object.freeze({sourceType:_t,layoutName:vt,scalarType:`f32`,strideUnits:`f32-elements`,offsetUnits:`f32-elements-or-bytes`,nativeKernelStatus:`supported`,blockedStatus:`buffer-volume-native-engine-blocked`}),sparseBrickAtlas:Object.freeze({sourceType:yt,layoutName:bt,brickSize:8,directorySentinel:xt,candidateSentinel:St,activeBrickRowStrideU32:16,activeBrickAtlasCellOffsetLane:7,atlasCellStrideFloats:8,atlasScalarLane:0,candidateIdSpace:`logical-dual-grid-voxel-id`,candidateOffsetUnits:`u32-elements-or-bytes`,candidateOffsetAlignment:`device.limits.minStorageBufferOffsetAlignment`,extractionMode:`gpu-conservative-no-readback`,bufferOwnership:`borrowed-caller-owned`,generationRequired:!0,nativeKernelStatus:`supported`}),isovalue:`finite-number`,normalSign:`exactly-minus-one-or-plus-one`,commandEncoding:Object.freeze({option:`commandEncoder`,mode:`external-command-encoder`,extractionMode:`gpu-conservative-no-readback`,internalSubmitCount:0,callerOwnsFinishAndSubmit:!0,retirementHook:`result.retireTemporaryResourcesAfterSubmit`})}),output:Object.freeze({version:0,surfaceSchema:He,executionSchema:Ue,rowMetadataSchema:We,outputDescriptorSchema:Ge,positionBufferDescriptorSchema:Ye,normalBufferDescriptorSchema:Xe,vertexFormat:Y,positionRows:Object.freeze({schema:Qe,version:0,layoutName:rt,rowLayout:ut,rowStrideFloats:4,rowStrideBytes:16,bufferDescriptorSchema:Ye}),normalRows:Object.freeze({schema:at,version:0,layoutName:ot,rowLayout:ft,rowStrideFloats:0,rowStrideBytes:Uint32Array.BYTES_PER_ELEMENT,encoding:st,sourceSemantic:`scalar-gradient`,orientation:`volume.normalSign`,bufferDescriptorSchema:Xe,generationCoupledToPosition:!0,producedByNativeKernel:!0}),materialRows:Object.freeze({schema:et,version:0,layoutName:J,rowLayout:pt,rowStrideFloats:4,rowStrideBytes:16,materialMetadataSchema:qe,pbrMetadataSchema:Je,produced:!1}),drawRows:Object.freeze({schema:tt,version:0,layoutName:ct,rowLayout:mt,rowStrideBytes:16,placeholderStatus:`draw-rows-not-produced`,produced:!1}),indirectRows:Object.freeze({schema:nt,version:0,layoutName:lt,rowLayout:ht,rowStrideBytes:16,placeholderStatus:`indirect-draw-rows-not-produced`,produced:!1}),cpuFallbackSchema:Ze,readback:!1})})}function $t(e,{requiresTexture:t=!1,requiresNativeSource:n=!1}={}){let r=[],i=null;try{i=Tt(e?.dims,`volume.dims`);let t=e?.dualGridDims==null?i.map(e=>e-1):Tt(e.dualGridDims,`volume.dualGridDims`),n=Number(e?.dualGridNumVoxels)||t[0]*t[1]*t[2],a=t.every(e=>e>0)&&n>0;r.push({ok:a,kind:`volume`,status:a?`volume-dims-ready`:`volume-dims-too-small`,label:`volume.dims`,dims:i,dualGridDims:t,dualGridNumVoxels:n})}catch(e){r.push({ok:!1,kind:`volume`,status:`volume-dims-invalid`,label:`volume.dims`,error:Rt(e)})}if(t){let t=e?.texture||null,n=X(t)&&typeof t.createView==`function`;r.push({ok:n,kind:`volume`,status:n?`volume-texture-ready`:`volume-texture-missing`,label:`volume.texture`,requiresCreateView:!0})}let a=At(e),o=e?.sourceType||e?.volumeSourceType||null,s=o===`scalar-buffer`||X(a);if(n||s||o!=null&&o!==`texture-3d`)try{let t=jt(o,{texture:e?.texture||null,scalarBuffer:a,directoryBuffer:e?.directoryBuffer||null,activeBrickRowsBuffer:e?.activeBrickRowsBuffer||null,atlasBuffer:e?.atlasBuffer||null,candidateVoxelIdsBuffer:e?.candidateVoxelIdsBuffer||null});if(t===`texture-3d`){let n=e?.texture||null,i=X(n)&&typeof n.createView==`function`;r.push({ok:i,kind:`volume`,status:i?`volume-texture-ready`:`volume-texture-missing`,label:`volume.texture`,sourceType:t,requiresCreateView:!0})}else if(t===`scalar-buffer`){if(!X(a))r.push({ok:!1,kind:`volume`,status:`volume-scalar-buffer-missing`,label:`volume.scalarBuffer`,sourceType:t});else if(i!=null){let n=It({scalarBuffer:a,scalarType:Mt(e),scalarStrides:e?.scalarStrides||e?.strides||null,rowStrideFloats:e?.rowStrideFloats??null,rowStride:e?.rowStride??null,sliceStrideFloats:e?.sliceStrideFloats??null,sliceStride:e?.sliceStride??null,scalarOffset:e?.scalarOffset??e?.scalarOffsetFloats??e?.bufferOffsetFloats??e?.offsetFloats??e?.offset??null,scalarOffsetBytes:e?.scalarOffsetBytes??e?.bufferOffsetBytes??e?.byteOffset??null,bufferByteLength:e?.bufferByteLength??e?.scalarBufferByteLength??e?.byteLength??null},i),o=n.scalarType===`f32`;r.push({ok:o&&n.byteLengthValid,kind:`volume`,status:o?n.byteLengthValid?`volume-scalar-buffer-ready`:`volume-scalar-buffer-out-of-range`:`volume-scalar-buffer-type-unsupported`,label:`volume.scalarBuffer`,sourceType:t,scalarType:n.scalarType,scalarStrides:n.scalarStrides,scalarOffset:n.scalarOffset,scalarOffsetBytes:n.scalarOffsetBytes,bufferByteLength:n.bufferByteLength,requiredByteLength:n.requiredByteLength,requiredScalarCount:n.requiredScalarCount,layoutName:n.layoutName})}}else if(t===`sparse-brick-atlas`&&i!=null){let n=Lt(e,i),a=[{key:`directory`,label:`volume.directoryBuffer`,resource:n.directoryBuffer,byteLength:n.directoryBufferByteLength,requiredByteLength:n.directoryRequiredByteLength},{key:`activeBrickRows`,label:`volume.activeBrickRowsBuffer`,resource:n.activeBrickRowsBuffer,byteLength:n.activeBrickRowsBufferByteLength,requiredByteLength:n.activeBrickRowsRequiredByteLength},{key:`atlas`,label:`volume.atlasBuffer`,resource:n.atlasBuffer,byteLength:n.atlasBufferByteLength,requiredByteLength:n.atlasRequiredByteLength},{key:`candidateVoxelIds`,label:`volume.candidateVoxelIdsBuffer`,resource:n.candidateVoxelIdsBuffer,byteLength:n.candidateVoxelIdsBufferByteLength,requiredByteLength:n.candidateVoxelIdsRequiredByteLength}];X(n.candidateDispatchIndirectBuffer)&&a.push({key:`candidateDispatchIndirect`,label:`volume.candidateDispatchIndirectBuffer`,resource:n.candidateDispatchIndirectBuffer,byteLength:n.candidateDispatchIndirectBufferByteLength,requiredByteLength:n.candidateDispatchIndirectRequiredByteLength});for(let e of a){let i=X(e.resource),a=n.byteLengthChecks[e.key];r.push({ok:i&&a,kind:`volume`,status:i?a?`volume-sparse-buffer-ready`:`volume-sparse-buffer-out-of-range`:`volume-sparse-buffer-missing`,label:e.label,sourceType:t,bufferByteLength:e.byteLength,requiredByteLength:e.requiredByteLength,layoutName:n.layoutName,generationId:n.generationId,candidateVoxelOffset:n.candidateVoxelOffset,candidateVoxelOffsetBytes:n.candidateVoxelOffsetBytes})}}else n&&r.push({ok:!1,kind:`volume`,status:`volume-source-missing`,label:`volume.source`,acceptedSourceTypes:[gt,_t,yt]})}catch(e){r.push({ok:!1,kind:`volume`,status:`volume-source-invalid`,label:`volume.source`,error:Rt(e)})}return r}function en(e,t,{requiresTexture:n=!1,requiresNativeSource:r=!1}={}){let i=$t(t,{requiresTexture:n,requiresNativeSource:r});if((t?.sourceType===`sparse-brick-atlas`||X(t?.candidateVoxelIdsBuffer))&&t?.dims!=null)try{let n=Lt(t,Tt(t.dims,`volume.dims`)),r=Et(e?.limits?.minStorageBufferOffsetAlignment??256,`device.limits.minStorageBufferOffsetAlignment`),a=n.candidateVoxelOffsetBytes%r===0;i.push({ok:a,kind:`volume`,status:a?`volume-candidate-offset-ready`:`volume-candidate-offset-unaligned`,label:`volume.candidateVoxelOffsetBytes`,candidateVoxelOffset:n.candidateVoxelOffset,candidateVoxelOffsetBytes:n.candidateVoxelOffsetBytes,minStorageBufferOffsetAlignment:r})}catch{}if(X(t?.device)){let n=Ae(e),r=Ae(t.device);i.push({ok:t.device===e,kind:`device`,status:t.device===e?`same-device`:`cross-device-volume`,label:`volume.device`,expectedDeviceId:n,ownerKnown:!0,ownerDeviceId:r,resourceKind:`gpu-device`})}X(t?.texture)&&i.push({kind:`device`,...Ie({device:e,resource:t.texture,label:`volume.texture`,allowUnknown:!0})});let a=At(t);X(a)&&i.push({kind:`device`,...Ie({device:e,resource:a,label:`volume.scalarBuffer`,allowUnknown:!0})});for(let[n,r]of[[`volume.directoryBuffer`,t?.directoryBuffer],[`volume.activeBrickRowsBuffer`,t?.activeBrickRowsBuffer],[`volume.atlasBuffer`,t?.atlasBuffer],[`volume.candidateVoxelIdsBuffer`,t?.candidateVoxelIdsBuffer],[`volume.candidateDispatchIndirectBuffer`,t?.candidateDispatchIndirectBuffer]])X(r)&&i.push({kind:`device`,...Ie({device:e,resource:r,label:n,allowUnknown:!0})});return i}function tn(e){return e.find(e=>!e.ok)||null}function nn({device:e,volume:t=null,surface:n=null,requiresTexture:r=!1,allowUnknownSurfaceBuffer:i=!0}={}){let a=[];X(e)||a.push({ok:!1,kind:`device`,status:`expected-device-missing`,label:`device`,expectedDeviceId:null,ownerKnown:!1,ownerDeviceId:null}),t!=null&&a.push(...en(e,t,{requiresTexture:r})),n?.buffer!=null&&a.push({kind:`device`,...Ie({device:e,resource:n.buffer,label:`surface.buffer`,allowUnknown:i})}),n?.normalBuffer!=null&&a.push({kind:`device`,...Ie({device:e,resource:n.normalBuffer,label:`surface.normalBuffer`,allowUnknown:i})});let o=tn(a);return{schema:Be,version:0,ok:o==null,status:o==null?`same-device-validated`:`same-device-check-failed`,expectedDeviceId:Ae(e),ownerDeviceId:Ae(e),requiresTexture:r,allowUnknownSurfaceBuffer:i,checks:a,failedCheck:o}}function rn({backend:e,device:t,status:n=`surface-empty`,reason:r=null,isovalue:i=null,volume:a=null,ownsDevice:o=!1,materialPayload:s=null,pbrPayload:c=null}={}){let l=Ae(t),u=Vt({ownsDevice:o,ownerDeviceId:l,device:t}),d=qt({ownerDeviceId:l,devicePolicy:u,normalSign:a?.normalSign??1,materialPayload:s,pbrPayload:c});return{schema:He,version:0,backend:e,status:n,reason:r,isovalue:i,volumeDims:a?.dims?Array.from(a.dims):null,layoutName:rt,rowLayoutName:rt,vertexCount:0,triangleCount:0,rowSchema:Qe,rowLayout:[...ut],rowStrideFloats:4,rowStrideBytes:16,rowCount:0,vertexStrideFloats:4,vertexStrideBytes:16,vertexFormat:Y,buffer:null,bufferByteLength:0,byteLength:0,bufferRetained:!1,bufferOwnership:`none`,ownerDeviceId:l,resourceOwnership:null,devicePolicy:u,materialPayload:d.materialPayload,pbrPayload:d.pbrPayload,rowMetadata:Jt({ownerDeviceId:l,devicePolicy:u,materialPayload:s,pbrPayload:c}),outputDescriptors:d,release(){return Bt(`surface-buffer-empty`)}}}function an({device:e,buffer:t,normalBuffer:n=null,normalBufferByteLength:r=0,vertexCount:i,vertexCountMode:a=null,maxVertexCount:o=null,actualVertexCounterBuffer:s=null,actualVertexCounterBufferByteLength:c=0,drawIndirectBuffer:l=null,drawIndirectBufferByteLength:u=0,readbackMode:d=null,surfaceGenerationId:f=null,volumeGenerationId:p=null,normalSign:m=1,backend:h=`external`,isovalue:g=null,volume:_=null,status:v=null,ownsBuffer:y=!0,markOwner:b=!0,ownsDevice:x=!1,materialPayload:S=null,pbrPayload:C=null}={}){let w=Math.max(0,Math.round(Ct(i,`vertexCount`)));if(w===0||t==null)return rn({backend:h,device:e,status:v||`surface-empty`,isovalue:g,volume:_,ownsDevice:x,materialPayload:S,pbrPayload:C});if(!X(t))throw TypeError(`createSurfaceResultFromBuffer requires a GPUBuffer-like buffer`);let T=Pe(t);b&&T==null&&X(e)&&Me(t,e);let E=Pe(n);b&&X(n)&&E==null&&X(e)&&Me(n,e);let D=Ie({device:e,resource:t,label:`surface.buffer`,allowUnknown:!0}),O=X(n)?Ie({device:e,resource:n,label:`surface.normalBuffer`,allowUnknown:!0}):null,k=Math.max(Number(t.size)||0,w*4*Float32Array.BYTES_PER_ELEMENT),A=y?`adapter-owned`:`borrowed`,j=Fe(t).ownerDeviceId,M=Number(n?.size),N=X(n)?Number.isFinite(M)?Math.max(0,M):Math.max(0,Number(r)||0):0,ee=Vt({ownsDevice:x,ownerDeviceId:Ae(e),device:e}),P=qt({buffer:t,bufferByteLength:k,bufferRetained:!0,bufferOwnership:A,ownerDeviceId:j,resourceOwnership:D,devicePolicy:ee,vertexCount:w,vertexCountMode:a,maxVertexCount:o??w,actualVertexCounterBuffer:s,actualVertexCounterBufferByteLength:c,drawIndirectBuffer:l,drawIndirectBufferByteLength:u,readbackMode:d,triangleCount:w/3,normalBuffer:n,normalBufferByteLength:N,normalResourceOwnership:O,surfaceGenerationId:f,volumeGenerationId:p,normalSign:m,materialPayload:S,pbrPayload:C}),F=!1,I={schema:He,version:0,backend:h,status:v||(D.ok?`surface-ready`:`surface-device-check-warning`),isovalue:g,volumeDims:_?.dims?Array.from(_.dims):null,layoutName:rt,rowLayoutName:rt,vertexCount:w,vertexCountMode:a,maxVertexCount:o??w,actualVertexCounterBuffer:s,actualVertexCounterBufferByteLength:c,drawIndirectBuffer:l,drawIndirectBufferByteLength:u,readbackMode:d,surfaceGenerationId:f,volumeGenerationId:p,normalBuffer:n,normalBufferByteLength:N,normalEncoding:X(n)?st:null,normalSemantic:X(n)?`oriented-scalar-gradient`:null,normalSourceSemantic:X(n)?`scalar-gradient`:null,normalSign:wt(m),normalPositionGenerationCoupled:X(n),normalAdditionalSubmitCount:X(n)?0:null,triangleCount:w/3,rowSchema:Qe,rowLayout:[...ut],rowStrideFloats:4,rowStrideBytes:16,rowCount:w,vertexStrideFloats:4,vertexStrideBytes:16,vertexFormat:Y,buffer:t,bufferByteLength:k,byteLength:k,bufferRetained:!0,bufferOwnership:A,ownerDeviceId:j,resourceOwnership:D,devicePolicy:ee,materialPayload:P.materialPayload,pbrPayload:P.pbrPayload,rowMetadata:Jt({buffer:t,bufferByteLength:k,bufferRetained:!0,bufferOwnership:A,ownerDeviceId:j,resourceOwnership:D,devicePolicy:ee,vertexCount:w,triangleCount:w/3,normalBuffer:n,normalBufferByteLength:N,normalResourceOwnership:O,surfaceGenerationId:f,volumeGenerationId:p,normalSign:m,materialPayload:S,pbrPayload:C}),outputDescriptors:P,release({force:e=!1}={}){return F?Bt(`surface-buffer-already-released`,{released:!0}):!y&&!e?Bt(`surface-buffer-borrowed-retained`,{released:!1}):(t.destroy?.(),n&&n!==t&&n.destroy?.(),F=!0,I.status=`surface-buffer-released`,I.bufferRetained=!1,I.rowMetadata.status=`surface-position-rows-released`,I.rowMetadata.position.status=`position-rows-released`,I.rowMetadata.position.bufferRetained=!1,I.rowMetadata.position.positionBufferDescriptor.status=`position-rows-released`,I.rowMetadata.position.positionBufferDescriptor.bufferRetained=!1,I.outputDescriptors.status=`surface-outputs-released`,I.outputDescriptors.retainedBuffers.position=null,I.outputDescriptors.retainedBuffers.normal=null,I.outputDescriptors.rows.position.status=`position-rows-released`,I.outputDescriptors.rows.position.bufferRetained=!1,I.outputDescriptors.rows.position.positionBufferDescriptor.status=`position-rows-released`,I.outputDescriptors.rows.position.positionBufferDescriptor.bufferRetained=!1,I.outputDescriptors.positionBufferDescriptor.status=`position-rows-released`,I.outputDescriptors.positionBufferDescriptor.bufferRetained=!1,I.rowMetadata.normal.status=`normal-rows-released`,I.rowMetadata.normal.bufferRetained=!1,I.rowMetadata.normal.normalBufferDescriptor.status=`normal-rows-released`,I.rowMetadata.normal.normalBufferDescriptor.bufferRetained=!1,I.outputDescriptors.rows.normal.status=`normal-rows-released`,I.outputDescriptors.rows.normal.bufferRetained=!1,I.outputDescriptors.rows.normal.normalBufferDescriptor.status=`normal-rows-released`,I.outputDescriptors.rows.normal.normalBufferDescriptor.bufferRetained=!1,I.outputDescriptors.normalBufferDescriptor.status=`normal-rows-released`,I.outputDescriptors.normalBufferDescriptor.bufferRetained=!1,y&&(s?.destroy?.(),l?.destroy?.()),Bt(`surface-buffer-released`,{released:!0}))}};return I}function on(e,{device:t,ownsDevice:n=!1,ownsBuffer:r=!0,materialPayload:i=null,pbrPayload:a=null}={}){if(!X(e)||e.schema!==`peercompute.webgpu-marching-cubes.surface.v0`)return e;let o=Math.max(0,Math.round(Number(e.vertexCount??e.rowCount)||0)),s=Math.max(0,Number(e.triangleCount)||o/3),c=e.buffer||null,l=e.normalBuffer||e.outputDescriptors?.rows?.normal?.buffer||e.rowMetadata?.normal?.buffer||null,u=o>0&&X(c),d=Math.max(Number(e.bufferByteLength)||0,u?o*4*Float32Array.BYTES_PER_ELEMENT:0),f=e.resourceOwnership||(u?Ie({device:t,resource:c,label:`surface.buffer`,allowUnknown:!0}):null),p=e.normalResourceOwnership||(X(l)?Ie({device:t,resource:l,label:`surface.normalBuffer`,allowUnknown:!0}):null),m=Number(l?.size),h=X(l)?Number.isFinite(m)?Math.max(0,m):Math.max(0,Number(e.normalBufferByteLength)||0):0,g=e.ownerDeviceId||(u?Fe(c).ownerDeviceId:null)||Ae(t),_=e.bufferOwnership||(u?r?`adapter-owned`:`borrowed`:`none`),v=e.devicePolicy||Vt({ownsDevice:n,ownerDeviceId:Ae(t),device:t}),y=i??e.materialPayload??e.material??null,b=a??e.pbrPayload??e.pbr??null;e.version=e.version??0,e.layoutName=e.layoutName||`peercompute.webgpu-marching-cubes.layout.compact-position-f32x4.v0`,e.rowLayoutName=e.rowLayoutName||`peercompute.webgpu-marching-cubes.layout.compact-position-f32x4.v0`,e.vertexCount=o,e.vertexCountMode=e.vertexCountMode||null,e.maxVertexCount=Math.max(o,Math.round(Number(e.maxVertexCount)||0)),e.actualVertexCounterBuffer=e.actualVertexCounterBuffer||null,e.actualVertexCounterBufferByteLength=Math.max(0,Number(e.actualVertexCounterBufferByteLength)||0),e.drawIndirectBuffer=e.drawIndirectBuffer||null,e.drawIndirectBufferByteLength=Math.max(0,Number(e.drawIndirectBufferByteLength)||0),e.readbackMode=e.readbackMode||null,e.surfaceGenerationId=e.surfaceGenerationId??null,e.volumeGenerationId=e.volumeGenerationId??null,e.normalBuffer=l,e.normalBufferByteLength=h,e.normalSign=wt(e.normalSign??1),e.triangleCount=s,e.bufferByteLength=d,e.byteLength=e.byteLength??d,e.bufferOwnership=_,e.ownerDeviceId=g,e.resourceOwnership=f,e.devicePolicy=v,e.materialPayload=Ht(y),e.pbrPayload=Ut(b);let x=Jt({buffer:c,bufferByteLength:d,bufferRetained:u&&!!e.bufferRetained,bufferOwnership:_,ownerDeviceId:g,resourceOwnership:f,devicePolicy:v,vertexCount:o,triangleCount:s,normalBuffer:l,normalBufferByteLength:h,normalResourceOwnership:p,surfaceGenerationId:e.surfaceGenerationId,volumeGenerationId:e.volumeGenerationId,normalSign:e.normalSign,materialPayload:y,pbrPayload:b}),S=qt({buffer:c,bufferByteLength:d,bufferRetained:u&&!!e.bufferRetained,bufferOwnership:_,ownerDeviceId:g,resourceOwnership:f,devicePolicy:v,vertexCount:o,triangleCount:s,normalBuffer:l,normalBufferByteLength:h,normalResourceOwnership:p,surfaceGenerationId:e.surfaceGenerationId,volumeGenerationId:e.volumeGenerationId,normalSign:e.normalSign,materialPayload:y,pbrPayload:b});return e.rowMetadata=e.rowMetadata?.schema===`peercompute.webgpu-marching-cubes.surface-row-metadata.v0`?e.rowMetadata:x,e.outputDescriptors=e.outputDescriptors?.schema===`peercompute.webgpu-marching-cubes.surface-output-descriptor.v0`?e.outputDescriptors:S,e.rowMetadata.version=e.rowMetadata.version??0,e.outputDescriptors.version=e.outputDescriptors.version??0,e.outputDescriptors.descriptorVersion=e.outputDescriptors.descriptorVersion??0,e.rowMetadata.position==null?e.rowMetadata.position=x.position:e.rowMetadata.position.positionBufferDescriptor??(e.rowMetadata.position.positionBufferDescriptor=x.position.positionBufferDescriptor),e.outputDescriptors.rows==null?e.outputDescriptors.rows=S.rows:e.outputDescriptors.rows.position==null?e.outputDescriptors.rows.position=S.rows.position:e.outputDescriptors.rows.position.positionBufferDescriptor??(e.outputDescriptors.rows.position.positionBufferDescriptor=S.rows.position.positionBufferDescriptor),e.rowMetadata.normal??(e.rowMetadata.normal=x.normal),e.outputDescriptors.rows.normal??(e.outputDescriptors.rows.normal=S.rows.normal),e.outputDescriptors.positionBufferDescriptor=e.outputDescriptors.positionBufferDescriptor||e.outputDescriptors.rows?.position?.positionBufferDescriptor||S.positionBufferDescriptor,e.outputDescriptors.normalBufferDescriptor=e.outputDescriptors.normalBufferDescriptor||e.outputDescriptors.rows?.normal?.normalBufferDescriptor||S.normalBufferDescriptor,e}var sn=Object.freeze(`sourceType.noReadback.vertexRowsBudget.vertexRowsBudgetClamped.conservativeWorstCaseVertexCount.candidateVoxelCount.candidateVoxelOffset.candidateVoxelOffsetBytes.candidateVoxelCountMode.volumeGenerationId.surfaceGenerationId.normalBuffer.normalBufferByteLength.normalEncoding.normalSemantic.normalSourceSemantic.normalSign.normalDegenerateEncoding.normalProducerStage.normalTimestampSpanLabel.normalAdditionalSubmitCount.normalPositionGenerationCoupled.commandEncodingMode.internalSubmitCount.requiresExternalSubmit.encodingRetirement.temporaryResourceCount.retireTemporaryResourcesAfterSubmit`.split(`.`));function cn(e,t){if(!X(e)||!X(t))return e;for(let n of sn)t[n]!==void 0&&(e[n]=t[n]);return e}async function ln({device:t,volume:n}){let{MarchingCubes:r}=await e(async()=>{let{MarchingCubes:e}=await import(`./marching_cubes-DBTWK5ez.js`);return{MarchingCubes:e}},[],import.meta.url),i=Xt(n,{device:t,requireNativeSource:!0});return r.create(i,t)}function un({adapter:e,backend:t,device:n,currentVolume:r,input:i={},requiresTexture:a=!1,requiresNativeSource:o=!1}={}){let s=typeof i==`number`?{isovalue:i}:i||{},c=null,l=[];try{c=Ct(s?.isovalue,`isovalue`)}catch(e){l.push(Rt(e))}let u=s.volume||r,d=u!=null,f=d?en(n,u,{requiresTexture:a,requiresNativeSource:o}):[],p=tn(f),m=`ready`;return l.length>0?m=`invalid-input`:d?p!=null&&(m=p.kind===`device`?`same-device-check-failed`:p.status===`buffer-volume-native-engine-blocked`?`buffer-volume-native-engine-blocked`:`preflight-check-failed`):(m=`volume-missing`,l.push({status:m,message:`extractSurface requires a volume`})),{schema:ze,version:0,adapterSchema:Le,adapterId:e.adapterId,backend:t,ok:m===`ready`,status:m,isovalue:c,hasVolume:d,volumeDims:u?.dims?Array.from(u.dims):null,requiresTexture:a,requiresNativeSource:o,sourceType:u?.sourceType||jt(null,{texture:u?.texture||null,scalarBuffer:At(u),directoryBuffer:u?.directoryBuffer||null,activeBrickRowsBuffer:u?.activeBrickRowsBuffer||null,atlasBuffer:u?.atlasBuffer||null,candidateVoxelIdsBuffer:u?.candidateVoxelIdsBuffer||null}),deviceChecks:f,errors:l,ownerDeviceId:e.ownerDeviceId,devicePolicy:e.devicePolicy}}function dn({adapter:e,backend:t,status:n,ok:r,result:i=null,webgpuStatus:a=null,deviceChecks:o=[],preflight:s=null,errors:c=[]}={}){return{schema:Ue,version:0,adapterSchema:Le,adapterId:e.adapterId,backend:t,status:n,ok:r,result:i,preflight:s,webgpuStatus:a||{status:n},deviceChecks:o,errors:c,ownsDevice:e.ownsDevice,deviceOwned:!!e.ownsDevice,devicePolicy:e.devicePolicy,ownerDeviceId:e.ownerDeviceId,readback:!1,surfaceVertexReadback:!1}}function fn({device:e,volume:t=null,engine:n=null,engineFactory:r=ln,backend:i=`webgpu`,ownsDevice:a=!1,adapterId:o=`webgpu-marching-cubes`,onStatus:s=null}={}){if(!X(e))throw TypeError(`createMarchingCubesSurfaceAdapter requires an existing GPUDevice`);if(typeof r!=`function`&&n==null)throw TypeError(`createMarchingCubesSurfaceAdapter requires an engineFactory or engine`);let c=n,l=t,u=!1,d=Ae(e),f=Vt({ownsDevice:a,ownerDeviceId:d,device:e}),p=n==null&&r===ln,m={schema:Le,adapterId:o,backend:i,device:e,ownerDeviceId:d,devicePolicy:f,ownsDevice:!!a,contract:Qt({backend:i}),get volume(){return l},async setVolume(e){return l=e,c!=null&&c!==n&&await c.dispose?.(),c=n,this.getStatus(`volume-set`)},getStatus(e=u?`adapter-released`:`adapter-ready`){return{schema:Le,version:0,adapterId:o,backend:i,status:e,ownsDevice:!!a,ownerDeviceId:d,devicePolicy:f,hasVolume:l!=null,hasEngine:c!=null,requiresTexture:!1,requiresNativeSource:p,contractSchema:Re,preflightSchema:ze}},getCapabilities(){return Qt({backend:i})},preflight(t={}){return un({adapter:m,backend:i,device:e,currentVolume:l,input:t,requiresTexture:!1,requiresNativeSource:p})},async extractSurface(t={}){let n=typeof t==`number`?{isovalue:t}:t||{},a=m.preflight(n),o=a.isovalue,s=n.volume||l,u=n.materialPayload??n.material??null,d=n.pbrPayload??n.pbr??null,f={isovalue:o,volume:s,device:e,materialPayload:u,pbrPayload:d,readbackMode:n.readbackMode,noReadback:n.noReadback,vertexRowsBudget:n.vertexRowsBudget,timestampProfiler:n.timestampProfiler,timestampMetadata:n.timestampMetadata,commandEncoder:n.commandEncoder};if(!a.ok){let t=tn(a.deviceChecks),n=a.errors[0]||t||{status:a.status,message:a.status},r=a.status===`same-device-check-failed`,c=a.status===`invalid-input`||a.status===`volume-missing`,l=a.status===`buffer-volume-native-engine-blocked`,f=rn({backend:i,device:e,status:r?`surface-device-check-failed`:l?`buffer-volume-native-engine-blocked`:`surface-error`,reason:n.message||n.status,isovalue:o,volume:s,ownsDevice:m.ownsDevice,materialPayload:u,pbrPayload:d});return dn({adapter:m,backend:i,status:c?`invalid-input`:a.status,ok:!1,result:f,preflight:a,webgpuStatus:{status:c?`invalid-input`:l?`buffer-volume-native-engine-blocked`:`blocked`,reason:n.message||n.status},deviceChecks:a.deviceChecks,errors:a.errors.length>0?a.errors:[n]})}try{if(c==null||s!==l){l=s;try{c=await r({device:e,volume:s,adapter:m,capabilities:m.getCapabilities()})}catch(e){throw zt(e,`native-engine-create`)}}let t;try{t=typeof c.extractSurface==`function`?await c.extractSurface(f):await c.computeSurface(o,f)}catch(e){throw zt(e,`native-engine-extract-surface`)}let p=u??t?.materialPayload??t?.material??null,h=d??t?.pbrPayload??t?.pbr??null,g=t?.schema===`peercompute.webgpu-marching-cubes.surface.v0`?t:an({device:e,buffer:t?.buffer||null,normalBuffer:t?.normalBuffer||null,normalBufferByteLength:t?.normalBufferByteLength||0,vertexCount:t?.count||t?.vertexCount||0,vertexCountMode:t?.vertexCountMode||null,maxVertexCount:t?.maxVertexCount??null,actualVertexCounterBuffer:t?.actualVertexCounterBuffer||null,actualVertexCounterBufferByteLength:t?.actualVertexCounterBufferByteLength||0,drawIndirectBuffer:t?.drawIndirectBuffer||null,drawIndirectBufferByteLength:t?.drawIndirectBufferByteLength||0,readbackMode:t?.readbackMode||n.readbackMode||null,surfaceGenerationId:t?.surfaceGenerationId??null,volumeGenerationId:t?.volumeGenerationId??s?.generationId??null,normalSign:t?.normalSign??s?.normalSign??1,backend:i,isovalue:o,volume:s,ownsBuffer:n.ownsBuffer??!0,ownsDevice:m.ownsDevice,materialPayload:p,pbrPayload:h});cn(g,t),on(g,{device:e,ownsDevice:m.ownsDevice,ownsBuffer:n.ownsBuffer??!0,materialPayload:p,pbrPayload:h});let _=nn({device:e,volume:s,surface:g,requiresTexture:!1,allowUnknownSurfaceBuffer:!0}),v=_.checks.find(e=>(e.label===`surface.buffer`||e.label===`surface.normalBuffer`)&&!e.ok);return v==null?dn({adapter:m,backend:i,status:g.vertexCount>0?`surface-ready`:`surface-empty`,ok:!0,result:g,webgpuStatus:{status:`executed`,vertexCount:g.vertexCount,triangleCount:g.triangleCount,validation:_},deviceChecks:_.checks,preflight:a}):(g.status=`surface-device-check-failed`,dn({adapter:m,backend:i,status:`same-device-check-failed`,ok:!1,result:g,webgpuStatus:{status:`blocked`,reason:v.status,validation:_},deviceChecks:_.checks,preflight:a,errors:[v]}))}catch(t){let n=Rt(t),r=n.status===`buffer-volume-native-engine-blocked`;return dn({adapter:m,backend:i,status:r?`buffer-volume-native-engine-blocked`:`surface-error`,ok:!1,result:rn({backend:i,device:e,status:r?`buffer-volume-native-engine-blocked`:`surface-error`,reason:n.message,isovalue:o,volume:s,ownsDevice:m.ownsDevice,materialPayload:u,pbrPayload:d}),webgpuStatus:{status:r?`buffer-volume-native-engine-blocked`:`error`,reason:n.message,error:n},deviceChecks:a.deviceChecks,preflight:a,errors:[n]})}},async release({destroyDevice:t=!1}={}){return u=!0,await c?.dispose?.(),c=null,(t||a)&&typeof e.destroy==`function`&&e.destroy(),this.getStatus(`adapter-released`)}};return s?.(m.getStatus()),m}var pn=20*Uint32Array.BYTES_PER_ELEMENT+256*Uint32Array.BYTES_PER_ELEMENT,mn={COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},hn=`
struct RenderFieldParams {
  particle_count: u32,
  surface_count: u32,
  total_field_cells: u32,
  product_event_count: u32,
  field_padding: f32,
  ref_edge_m: f32,
  render_smear_dt_s: f32,
  dispersed_medium_enabled: u32,
};

struct RenderProductHistoryGateParams {
  gate_required: u32,
  expected_magic: u32,
  expected_version: u32,
  expected_ready_status: u32,
  expected_generation: u32,
  expected_seal: u32,
  expected_row_capacity: u32,
  expected_row_stride_vec4: u32,
};

struct SpatialGridParams {
  total_bricks: u32,
  scan_block_count: u32,
  particle_entry_capacity: u32,
  event_entry_capacity: u32,
  max_bricks_per_source: u32,
  has_product_events: u32,
  surface_fallback_offset: u32,
  surface_event_fallback_offset: u32,
  p_counts_offset: u32,
  p_offsets_offset: u32,
  p_cursors_offset: u32,
  p_block_totals_offset: u32,
  p_entries_offset: u32,
  e_counts_offset: u32,
  e_offsets_offset: u32,
  e_cursors_offset: u32,
  e_block_totals_offset: u32,
  e_entries_offset: u32,
  _pad0: u32,
  _pad1: u32,
  surface_brick_info: array<vec4<u32>, 64>,
};

const RENDER_FIELD_RENDER_ROW_VEC4_STRIDE: u32 = 5u;
const RENDER_FIELD_F32_FINITE_MAX: f32 = 3.402823466e+38;
const RENDER_FIELD_F32_MIN_NORMAL: f32 = 1.175494351e-38;
`,gn=`
fn render_product_history_ready() -> bool {
  if (product_history_gate.gate_required == 0u) {
    return true;
  }
  return arrayLength(&product_history_control) >= 8u
    && product_history_control[0u] == product_history_gate.expected_magic
    && product_history_control[1u] == product_history_gate.expected_version
    && product_history_control[2u] == product_history_gate.expected_ready_status
    && product_history_control[3u] <= product_history_control[4u]
    && product_history_control[4u] == product_history_gate.expected_row_capacity
    && product_history_control[5u] == product_history_gate.expected_row_stride_vec4
    && product_history_control[6u] == product_history_gate.expected_generation
    && product_history_control[7u] == product_history_gate.expected_seal;
}

fn render_product_event_count() -> u32 {
  if (product_history_gate.gate_required != 0u) {
    return product_history_control[3u];
  }
  return params.product_event_count;
}

fn surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn surface_row2(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 2u];
}

fn surface_row3(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 3u];
}

fn phase_partitioned_metaball_strength(
  full_strength: f32,
  phase_weight: f32,
  isolation: f32,
  subtract: f32
) -> f32 {
  let fraction = clamp(phase_weight, 0.0, 1.0);
  let volume_scale_squared = pow(fraction * fraction, 0.3333333333333333);
  let zero_radius_strength = max(isolation + subtract, 0.0) * 0.000001;
  return full_strength * volume_scale_squared
    + zero_radius_strength * (1.0 - volume_scale_squared);
}

fn metaball_support_norm(strength: f32, subtract: f32) -> f32 {
  return sqrt(max(strength / max(subtract, 1.0e-12) - 0.000001, 0.0));
}

fn render_phase_weight(surface_phase_id: f32, row_phase_id: f32, gas_fraction: f32, solid_fraction: f32) -> f32 {
  let gas = clamp(gas_fraction, 0.0, 1.0);
  let solid = clamp(solid_fraction, 0.0, 1.0);
  let liquid = clamp(1.0 - gas - solid, 0.0, 1.0);
  if (surface_phase_id == 1.0) { return solid; }
  if (surface_phase_id == 2.0) { return liquid; }
  if (surface_phase_id == 3.0) { return gas; }
  return select(0.0, 1.0, row_phase_id == surface_phase_id);
}
`,_n=`
fn render_row0(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE];
}

fn render_row1(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE + 1u];
}

fn render_row2(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE + 2u];
}

fn render_row3(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE + 3u];
}

fn render_row4(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE + 4u];
}

fn render_bulk_phase_weight(
  particle_index: u32,
  material_id: f32,
  surface_phase_id: f32,
  carrier_mass_kg: f32,
  phase_weight: f32
) -> f32 {
  if (params.dispersed_medium_enabled == 0u || !(carrier_mass_kg > 0.0)
    || !sph_dispersed_medium_optics_finite(carrier_mass_kg)) {
    return phase_weight;
  }
  let dispersed = dispersed_medium_optics_rows[particle_index];
  if (
    render_row1(particle_index).y == 3.0
    && surface_phase_id == 2.0
    && params.particle_count >= 4u
    && (params.particle_count % 4u) == 0u
  ) {
    let phase_stride = params.particle_count / 4u;
    let companion_index = (particle_index % phase_stride) + phase_stride;
    if (companion_index < arrayLength(&dispersed_medium_optics_rows)) {
      let companion = dispersed_medium_optics_rows[companion_index];
      if (
        sph_dispersed_medium_optics_row_is_ready(companion)
        && companion.dispersed_material_id == material_id
        && companion.dispersed_phase_id == surface_phase_id
      ) {
        return 0.0;
      }
    }
  }
  if (!sph_dispersed_medium_optics_row_is_ready(dispersed)
    || dispersed.dispersed_material_id != material_id
    || dispersed.dispersed_phase_id != surface_phase_id) {
    return phase_weight;
  }
  let dispersed_fraction = min(dispersed.dispersed_mass_kg, carrier_mass_kg) / carrier_mass_kg;
  return max(0.0, phase_weight - dispersed_fraction);
}
`,vn=`
fn smooth_palette_weight(ratio: f32) -> f32 {
  let t = clamp(ratio, 0.0, 1.0);
  return 1.0 - t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

fn render_field_saturating_nonnegative_add(a: f32, b: f32) -> f32 {
  if (!(a > 0.0)) { return max(0.0, b); }
  if (!(b > 0.0)) { return max(0.0, a); }
  if (a >= RENDER_FIELD_F32_FINITE_MAX - b) {
    return RENDER_FIELD_F32_FINITE_MAX;
  }
  let sum = a + b;
  return select(0.0, sum, sum >= RENDER_FIELD_F32_MIN_NORMAL);
}

fn render_field_saturating_nonnegative_product(a: f32, b: f32) -> f32 {
  if (!(a > 0.0) || !(b > 0.0)) { return 0.0; }
  let product = a * b;
  if (!(product <= RENDER_FIELD_F32_FINITE_MAX)) {
    return RENDER_FIELD_F32_FINITE_MAX;
  }
  if (product < RENDER_FIELD_F32_MIN_NORMAL) { return 0.0; }
  return product;
}

struct RenderFieldPositiveF32Scale {
  mantissa: f32,
  exponent: i32,
  nonzero: u32,
  _pad: u32,
};

fn render_field_decompose_f32_magnitude(
  value: f32
) -> RenderFieldPositiveF32Scale {
  let bits = bitcast<u32>(value) & 0x7fffffffu;
  let raw_exponent = (bits >> 23u) & 0xffu;
  let fraction = bits & 0x007fffffu;
  if (bits == 0u || raw_exponent == 0xffu) {
    return RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u);
  }
  if (raw_exponent == 0u) {
    let highest = 31u - countLeadingZeros(fraction);
    let shift = 23u - highest;
    let normalized = fraction << shift;
    return RenderFieldPositiveF32Scale(
      bitcast<f32>(0x3f800000u | (normalized & 0x007fffffu)),
      i32(highest) - 149,
      1u,
      0u
    );
  }
  return RenderFieldPositiveF32Scale(
    bitcast<f32>(0x3f800000u | fraction),
    i32(raw_exponent) - 127,
    1u,
    0u
  );
}

fn render_field_balanced_optical_product(
  cross_section_m2: f32,
  cell_weight: f32,
  inverse_cell_edge_per_m: f32
) -> f32 {
  let cross_section =
    render_field_decompose_f32_magnitude(cross_section_m2);
  let weight = render_field_decompose_f32_magnitude(cell_weight);
  let inverse_edge =
    render_field_decompose_f32_magnitude(inverse_cell_edge_per_m);
  if (
    cross_section.nonzero == 0u
    || weight.nonzero == 0u
    || inverse_edge.nonzero == 0u
  ) {
    return 0.0;
  }
  var mantissa = (
    (cross_section.mantissa * weight.mantissa)
    * inverse_edge.mantissa
  ) * inverse_edge.mantissa;
  var exponent = cross_section.exponent
    + weight.exponent
    + 2 * inverse_edge.exponent;
  for (
    var iteration = 0u;
    iteration < 4u && mantissa >= 2.0;
    iteration = iteration + 1u
  ) {
    mantissa = mantissa * 0.5;
    exponent = exponent + 1;
  }
  if (exponent < -126) { return 0.0; }
  if (exponent > 127) { return RENDER_FIELD_F32_FINITE_MAX; }
  return bitcast<f32>(
    (u32(exponent + 127) << 23u)
    | (bitcast<u32>(mantissa) & 0x007fffffu)
  );
}

fn render_field_balanced_signed_optical_product(
  signed_cross_section_m2: f32,
  cell_weight: f32,
  inverse_cell_edge_per_m: f32
) -> f32 {
  let magnitude = render_field_balanced_optical_product(
    signed_cross_section_m2,
    cell_weight,
    inverse_cell_edge_per_m
  );
  if (magnitude == 0.0) { return 0.0; }
  let sign_bit = bitcast<u32>(signed_cross_section_m2) & 0x80000000u;
  return bitcast<f32>(bitcast<u32>(magnitude) | sign_bit);
}

struct RenderFieldWeightedTemperatureAccumulator {
  weight: RenderFieldPositiveF32Scale,
  weighted_temperature: RenderFieldPositiveF32Scale,
};

struct RenderFieldSignedF32ScaleAccumulator {
  positive: RenderFieldPositiveF32Scale,
  negative: RenderFieldPositiveF32Scale,
};

fn render_field_normalized_mantissa_at_exponent(
  mantissa: f32,
  exponent: i32
) -> f32 {
  if (exponent < -126) { return 0.0; }
  return bitcast<f32>(
    (u32(exponent + 127) << 23u)
    | (bitcast<u32>(mantissa) & 0x007fffffu)
  );
}

fn render_field_add_positive_scales(
  left: RenderFieldPositiveF32Scale,
  right: RenderFieldPositiveF32Scale
) -> RenderFieldPositiveF32Scale {
  if (left.nonzero == 0u) { return right; }
  if (right.nonzero == 0u) { return left; }
  var base_exponent: i32;
  var mantissa: f32;
  if (right.exponent >= left.exponent) {
    let scaled_left = render_field_normalized_mantissa_at_exponent(
      left.mantissa,
      left.exponent - right.exponent
    );
    base_exponent = right.exponent;
    mantissa = right.mantissa + scaled_left;
  } else {
    let scaled_right = render_field_normalized_mantissa_at_exponent(
      right.mantissa,
      right.exponent - left.exponent
    );
    base_exponent = left.exponent;
    mantissa = left.mantissa + scaled_right;
  }
  if (mantissa >= 2.0) {
    mantissa = mantissa * 0.5;
    base_exponent = base_exponent + 1;
  }
  return RenderFieldPositiveF32Scale(mantissa, base_exponent, 1u, 0u);
}

fn render_field_compare_positive_scales(
  left: RenderFieldPositiveF32Scale,
  right: RenderFieldPositiveF32Scale
) -> i32 {
  if (left.nonzero == 0u) {
    return select(0, -1, right.nonzero != 0u);
  }
  if (right.nonzero == 0u) { return 1; }
  if (left.exponent != right.exponent) {
    return select(-1, 1, left.exponent > right.exponent);
  }
  if (left.mantissa == right.mantissa) { return 0; }
  return select(-1, 1, left.mantissa > right.mantissa);
}

fn render_field_subtract_positive_scales(
  larger: RenderFieldPositiveF32Scale,
  smaller: RenderFieldPositiveF32Scale
) -> RenderFieldPositiveF32Scale {
  if (larger.nonzero == 0u) {
    return RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u);
  }
  if (smaller.nonzero == 0u) { return larger; }
  let scaled_smaller = render_field_normalized_mantissa_at_exponent(
    smaller.mantissa,
    smaller.exponent - larger.exponent
  );
  let residual = larger.mantissa - scaled_smaller;
  let normalized_residual = render_field_decompose_f32_magnitude(residual);
  if (normalized_residual.nonzero == 0u) {
    return RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u);
  }
  return RenderFieldPositiveF32Scale(
    normalized_residual.mantissa,
    larger.exponent + normalized_residual.exponent,
    1u,
    0u
  );
}

fn render_field_positive_scale_value(scale: RenderFieldPositiveF32Scale) -> f32 {
  if (scale.nonzero == 0u || scale.exponent < -126) { return 0.0; }
  if (scale.exponent > 127) { return RENDER_FIELD_F32_FINITE_MAX; }
  return bitcast<f32>(
    (u32(scale.exponent + 127) << 23u)
    | (bitcast<u32>(scale.mantissa) & 0x007fffffu)
  );
}

fn render_field_accumulate_signed_scale(
  state: RenderFieldSignedF32ScaleAccumulator,
  sample: f32
) -> RenderFieldSignedF32ScaleAccumulator {
  if (sample == 0.0 || !(sample == sample) || abs(sample) > RENDER_FIELD_F32_FINITE_MAX) {
    return state;
  }
  let sample_scale = render_field_decompose_f32_magnitude(sample);
  if (sample_scale.nonzero == 0u) { return state; }
  if ((bitcast<u32>(sample) & 0x80000000u) != 0u) {
    return RenderFieldSignedF32ScaleAccumulator(
      state.positive,
      render_field_add_positive_scales(state.negative, sample_scale)
    );
  }
  return RenderFieldSignedF32ScaleAccumulator(
    render_field_add_positive_scales(state.positive, sample_scale),
    state.negative
  );
}

fn render_field_signed_scale_sum(state: RenderFieldSignedF32ScaleAccumulator) -> f32 {
  let comparison = render_field_compare_positive_scales(state.positive, state.negative);
  if (comparison == 0) { return 0.0; }
  let positive = comparison > 0;
  var larger = state.negative;
  var smaller = state.positive;
  if (positive) {
    larger = state.positive;
    smaller = state.negative;
  }
  let magnitude = render_field_positive_scale_value(
    render_field_subtract_positive_scales(larger, smaller)
  );
  return select(-magnitude, magnitude, positive);
}

fn render_field_multiply_positive_scales(
  left: RenderFieldPositiveF32Scale,
  right: RenderFieldPositiveF32Scale
) -> RenderFieldPositiveF32Scale {
  if (left.nonzero == 0u || right.nonzero == 0u) {
    return RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u);
  }
  var mantissa = left.mantissa * right.mantissa;
  var exponent = left.exponent + right.exponent;
  if (mantissa >= 2.0) {
    mantissa = mantissa * 0.5;
    exponent = exponent + 1;
  }
  return RenderFieldPositiveF32Scale(mantissa, exponent, 1u, 0u);
}

fn render_field_divide_positive_scales(
  numerator: RenderFieldPositiveF32Scale,
  denominator: RenderFieldPositiveF32Scale
) -> f32 {
  if (numerator.nonzero == 0u || denominator.nonzero == 0u) {
    return 0.0;
  }
  var mantissa = numerator.mantissa / denominator.mantissa;
  var exponent = numerator.exponent - denominator.exponent;
  if (mantissa < 1.0) {
    mantissa = mantissa * 2.0;
    exponent = exponent - 1;
  } else if (mantissa >= 2.0) {
    mantissa = mantissa * 0.5;
    exponent = exponent + 1;
  }
  if (exponent < -126) { return 0.0; }
  if (exponent > 127) { return RENDER_FIELD_F32_FINITE_MAX; }
  return bitcast<f32>(
    (u32(exponent + 127) << 23u)
    | (bitcast<u32>(mantissa) & 0x007fffffu)
  );
}

fn render_field_accumulate_weighted_temperature(
  state: RenderFieldWeightedTemperatureAccumulator,
  sample: f32,
  sample_weight: f32
) -> RenderFieldWeightedTemperatureAccumulator {
  if (
    !(sample_weight > 0.0)
    || !(sample == sample)
    || abs(sample) > RENDER_FIELD_F32_FINITE_MAX
  ) {
    return state;
  }
  let sample_scale = render_field_decompose_f32_magnitude(sample_weight);
  if (sample_scale.nonzero == 0u) { return state; }
  let next_weight = render_field_add_positive_scales(state.weight, sample_scale);
  let finite_sample = clamp(sample, 0.0, RENDER_FIELD_F32_FINITE_MAX);
  let temperature_scale = render_field_decompose_f32_magnitude(finite_sample);
  if (temperature_scale.nonzero == 0u) {
    return RenderFieldWeightedTemperatureAccumulator(next_weight, state.weighted_temperature);
  }
  return RenderFieldWeightedTemperatureAccumulator(
    next_weight,
    render_field_add_positive_scales(
      state.weighted_temperature,
      render_field_multiply_positive_scales(sample_scale, temperature_scale)
    )
  );
}

fn render_field_cic_axis_weight(
  cell_index: u32,
  particle_coordinate: f32,
  resolution: u32
) -> f32 {
  let particle_cell = clamp(particle_coordinate, 0.0, 1.0) * f32(resolution);
  var weight = max(0.0, 1.0 - abs(f32(cell_index) - particle_cell));
  if (cell_index == 0u) {
    weight = weight + max(0.0, 1.0 - abs(-1.0 - particle_cell));
  }
  if (cell_index + 1u == resolution) {
    weight = weight + max(0.0, 1.0 - abs(f32(resolution) - particle_cell));
  }
  return min(1.0, weight);
}
`,yn=`
${c}
${hn}

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> dispersed_medium_optics_rows: array<SphDispersedMediumOptics>;
@group(0) @binding(3) var<storage, read> product_history_control: array<u32>;
@group(0) @binding(4) var<storage, read_write> spatial_grid_u32: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params: RenderFieldParams;
@group(0) @binding(6) var<uniform> product_history_gate: RenderProductHistoryGateParams;
@group(0) @binding(7) var<uniform> grid: SpatialGridParams;

${gn}
${_n}

struct ParticleBrickBounds {
  is_active: u32,
  is_sphere: u32,
  min_b: vec3<u32>,
  max_b: vec3<u32>,
  center: vec3<f32>,
  radius_pad_sq: f32,
};

fn compute_particle_brick_bounds(
  particle_index: u32,
  surface_index: u32,
  resolution: u32
) -> ParticleBrickBounds {
  var empty = ParticleBrickBounds(0u, 0u, vec3<u32>(0u), vec3<u32>(0u), vec3<f32>(0.0), 0.0);
  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let s2 = surface_row2(surface_index);
  let s3 = surface_row3(surface_index);
  let dispersed_surface_active = s3.y > 0.0;
  let span = 1.0 - 2.0 * params.field_padding;
  let ref_edge = max(params.ref_edge_m, 1.0e-12);
  let res_f = f32(resolution);
  let max_cell_f = f32(resolution - 1u);

  if (dispersed_surface_active) {
    if (params.dispersed_medium_enabled == 0u) {
      return empty;
    }
    let dispersed = dispersed_medium_optics_rows[particle_index];
    if (
      sph_dispersed_medium_optics_row_is_ready(dispersed)
      && dispersed.optical_state_id > 0.0
      && dispersed.optical_state_id == s3.y
    ) {
      let row0 = render_row0(particle_index);
      let p = vec3<f32>(
        clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
        clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
        clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
      );
      let pc = p * res_f;
      let min_c = vec3<u32>(clamp(floor(pc - vec3<f32>(1.01)), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
      let max_c = vec3<u32>(clamp(ceil(pc + vec3<f32>(1.01)), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
      return ParticleBrickBounds(1u, 0u, min_c >> vec3<u32>(2u), max_c >> vec3<u32>(2u), p, 0.0);
    }
    let row0 = render_row0(particle_index);
    let row1 = render_row1(particle_index);
    if (
      row0.w > 0.0
      && row1.y == 3.0
      && params.particle_count >= 4u
      && (params.particle_count % 4u) == 0u
    ) {
      let phase_stride = params.particle_count / 4u;
      let companion_index = (particle_index % phase_stride) + phase_stride;
      if (companion_index < arrayLength(&dispersed_medium_optics_rows)) {
        let companion = dispersed_medium_optics_rows[companion_index];
        let row2 = render_row2(particle_index);
        let row4_wet = render_row4(particle_index);
        let suspended = clamp(1.0 - row2.y - row4_wet.x, 0.0, 1.0);
        if (
          suspended > 0.0
          && sph_dispersed_medium_optics_row_is_ready(companion)
          && companion.optical_state_id > 0.0
          && companion.optical_state_id == s3.y
        ) {
          let row3 = render_row3(particle_index);
          let p = vec3<f32>(
            clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
            clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
            clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
          );
          let support_cells = clamp(max((row3.y * span / ref_edge) * res_f, 3.6), 1.0, 6.0);
          let pc = p * res_f;
          let pad = vec3<f32>(support_cells + 0.01);
          let min_c = vec3<u32>(clamp(floor(pc - pad), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
          let max_c = vec3<u32>(clamp(ceil(pc + pad), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
          return ParticleBrickBounds(1u, 0u, min_c >> vec3<u32>(2u), max_c >> vec3<u32>(2u), p, 0.0);
        }
      }
    }
    return empty;
  }

  let material_id = s0.x;
  let row1 = render_row1(particle_index);
  if (row1.x != material_id) {
    return empty;
  }
  let render_domain_id = max(s3.x, 0.0);
  let row2 = render_row2(particle_index);
  if (render_domain_id > 0.0 && row2.w != render_domain_id) {
    return empty;
  }
  let row0 = render_row0(particle_index);
  let row4 = render_row4(particle_index);
  let phase_id = s0.y;
  let phase_weight = render_bulk_phase_weight(
    particle_index, material_id, phase_id, row0.w,
    render_phase_weight(phase_id, row1.y, row2.y, row4.x)
  );
  if (phase_weight <= 0.0) {
    return empty;
  }
  let row3 = render_row3(particle_index);
  let subtract = max(s1.z, 1.0e-12);
  let strength = s1.w;
  let particle_radius_scale = select(0.0, -s2.x, s2.x < 0.0);
  let inv_resolution = 1.0 / res_f;
  let particle_radius_norm_scale = particle_radius_scale * span / ref_edge;
  let particle_radius_floor_norm = select(
    0.0,
    sqrt(0.75 * inv_resolution * inv_resolution + 0.000001),
    particle_radius_scale > 0.0
  );
  let particle_radius_norm = select(
    0.0,
    max(row3.y * particle_radius_norm_scale, particle_radius_floor_norm),
    particle_radius_scale > 0.0 && row3.y > 0.0
  );
  let full_particle_strength = select(
    strength,
    (s1.y + subtract) * particle_radius_norm * particle_radius_norm,
    particle_radius_norm > 0.0
  );
  let particle_strength = phase_partitioned_metaball_strength(
    full_particle_strength,
    phase_weight,
    s1.y,
    subtract
  );
  let r2 = particle_strength / subtract - 0.000001;
  if (!(r2 > 0.0)) {
    return empty;
  }
  let r_pad = sqrt(r2) * 1.0001 + 1.0e-5;
  let p = vec3<f32>(
    clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
    clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
    clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
  );
  let min_c = vec3<u32>(clamp(floor((p - vec3<f32>(r_pad)) * res_f), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
  let max_c = vec3<u32>(clamp(ceil((p + vec3<f32>(r_pad)) * res_f), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
  return ParticleBrickBounds(1u, 1u, min_c >> vec3<u32>(2u), max_c >> vec3<u32>(2u), p, r_pad * r_pad);
}

fn sphere_intersects_brick(
  center: vec3<f32>,
  radius_pad_sq: f32,
  bx: u32,
  by: u32,
  bz: u32,
  resolution: u32,
  inv_resolution: f32
) -> bool {
  let bmin = vec3<f32>(f32(bx * 4u), f32(by * 4u), f32(bz * 4u)) * inv_resolution;
  let max_v = resolution - 1u;
  let bmax = vec3<f32>(
    f32(min(bx * 4u + 3u, max_v)),
    f32(min(by * 4u + 3u, max_v)),
    f32(min(bz * 4u + 3u, max_v))
  ) * inv_resolution;
  let closest = clamp(center, bmin, bmax);
  let delta = center - closest;
  return dot(delta, delta) <= radius_pad_sq;
}

@compute @workgroup_size(64, 1, 1)
fn count_particle_bricks(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  let surface_index = global_id.y;
  if (particle_index >= params.particle_count || surface_index >= params.surface_count) {
    return;
  }
  if (!render_product_history_ready()) {
    return;
  }
  let s1 = surface_row1(surface_index);
  let resolution = max(u32(s1.x), 1u);
  let bounds = compute_particle_brick_bounds(particle_index, surface_index, resolution);
  if (bounds.is_active == 0u) {
    return;
  }
  let span_b = bounds.max_b - bounds.min_b + vec3<u32>(1u);
  let box_bricks = span_b.x * span_b.y * span_b.z;
  if (box_bricks > grid.max_bricks_per_source) {
    atomicStore(&spatial_grid_u32[grid.surface_fallback_offset + surface_index], 1u);
    return;
  }
  let binfo = grid.surface_brick_info[surface_index];
  let brick_dim = binfo.x;
  let brick_offset = binfo.z;
  let inv_resolution = 1.0 / f32(resolution);
  for (var bz = bounds.min_b.z; bz <= bounds.max_b.z; bz = bz + 1u) {
    for (var by = bounds.min_b.y; by <= bounds.max_b.y; by = by + 1u) {
      for (var bx = bounds.min_b.x; bx <= bounds.max_b.x; bx = bx + 1u) {
        if (
          bounds.is_sphere == 0u
          || sphere_intersects_brick(bounds.center, bounds.radius_pad_sq, bx, by, bz, resolution, inv_resolution)
        ) {
          let brick_global = brick_offset + (bz * brick_dim + by) * brick_dim + bx;
          atomicAdd(&spatial_grid_u32[grid.p_counts_offset + brick_global], 1u);
        }
      }
    }
  }
}

@compute @workgroup_size(64, 1, 1)
fn scatter_particle_bricks(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  let surface_index = global_id.y;
  if (particle_index >= params.particle_count || surface_index >= params.surface_count) {
    return;
  }
  if (!render_product_history_ready()) {
    return;
  }
  if (
    atomicLoad(&spatial_grid_u32[1u]) != 0u
    || atomicLoad(&spatial_grid_u32[grid.surface_fallback_offset + surface_index]) != 0u
  ) {
    return;
  }
  let s1 = surface_row1(surface_index);
  let resolution = max(u32(s1.x), 1u);
  let bounds = compute_particle_brick_bounds(particle_index, surface_index, resolution);
  if (bounds.is_active == 0u) {
    return;
  }
  let span_b = bounds.max_b - bounds.min_b + vec3<u32>(1u);
  if (span_b.x * span_b.y * span_b.z > grid.max_bricks_per_source) {
    return;
  }
  let binfo = grid.surface_brick_info[surface_index];
  let brick_dim = binfo.x;
  let brick_offset = binfo.z;
  let inv_resolution = 1.0 / f32(resolution);
  for (var bz = bounds.min_b.z; bz <= bounds.max_b.z; bz = bz + 1u) {
    for (var by = bounds.min_b.y; by <= bounds.max_b.y; by = by + 1u) {
      for (var bx = bounds.min_b.x; bx <= bounds.max_b.x; bx = bx + 1u) {
        if (
          bounds.is_sphere == 0u
          || sphere_intersects_brick(bounds.center, bounds.radius_pad_sq, bx, by, bz, resolution, inv_resolution)
        ) {
          let brick_global = brick_offset + (bz * brick_dim + by) * brick_dim + bx;
          let slot = atomicAdd(&spatial_grid_u32[grid.p_cursors_offset + brick_global], 1u);
          if (slot < grid.particle_entry_capacity) {
            atomicStore(&spatial_grid_u32[grid.p_entries_offset + slot], particle_index);
          }
        }
      }
    }
  }
}
`,bn=`
${hn}

@group(0) @binding(0) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> product_history_control: array<u32>;
@group(0) @binding(3) var<storage, read_write> spatial_grid_u32: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: RenderFieldParams;
@group(0) @binding(5) var<uniform> product_history_gate: RenderProductHistoryGateParams;
@group(0) @binding(6) var<uniform> grid: SpatialGridParams;

${gn}

struct EventBrickBounds {
  is_active: u32,
  min_b: vec3<u32>,
  max_b: vec3<u32>,
  center: vec3<f32>,
  radius_pad_sq: f32,
};

fn compute_event_brick_bounds(
  event_index: u32,
  surface_index: u32,
  resolution: u32
) -> EventBrickBounds {
  var empty = EventBrickBounds(0u, vec3<u32>(0u), vec3<u32>(0u), vec3<f32>(0.0), 0.0);
  let s3 = surface_row3(surface_index);
  if (s3.y > 0.0) {
    return empty;
  }
  let event4 = product_events[event_index * 8u + 4u];
  if (event4.z != 1.0) {
    return empty;
  }
  let event3 = product_events[event_index * 8u + 3u];
  if (event3.y <= 0.0) {
    return empty;
  }
  let s0 = surface_row0(surface_index);
  let event1 = product_events[event_index * 8u + 1u];
  if (event1.x != s0.x) {
    return empty;
  }
  let event2 = product_events[event_index * 8u + 2u];
  if (event2.w > 0.0 && event2.w != s0.y) {
    return empty;
  }
  let s1 = surface_row1(surface_index);
  let subtract = max(s1.z, 1.0e-12);
  let strength = s1.w;
  let r2 = strength / subtract - 0.000001;
  if (!(r2 > 0.0)) {
    return empty;
  }
  let r_pad = sqrt(r2) * 1.0001 + 1.0e-5;
  let span = 1.0 - 2.0 * params.field_padding;
  let ref_edge = max(params.ref_edge_m, 1.0e-12);
  let event0 = product_events[event_index * 8u];
  let p = vec3<f32>(
    clamp(params.field_padding + (event0.x / ref_edge) * span, 0.001, 0.999),
    clamp(params.field_padding + (event0.y / ref_edge) * span, 0.001, 0.999),
    clamp(params.field_padding + (event0.z / ref_edge) * span, 0.001, 0.999)
  );
  let res_f = f32(resolution);
  let max_cell_f = f32(resolution - 1u);
  let min_c = vec3<u32>(clamp(floor((p - vec3<f32>(r_pad)) * res_f), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
  let max_c = vec3<u32>(clamp(ceil((p + vec3<f32>(r_pad)) * res_f), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
  return EventBrickBounds(1u, min_c >> vec3<u32>(2u), max_c >> vec3<u32>(2u), p, r_pad * r_pad);
}

fn event_sphere_intersects_brick(
  center: vec3<f32>,
  radius_pad_sq: f32,
  bx: u32,
  by: u32,
  bz: u32,
  resolution: u32,
  inv_resolution: f32
) -> bool {
  let bmin = vec3<f32>(f32(bx * 4u), f32(by * 4u), f32(bz * 4u)) * inv_resolution;
  let max_v = resolution - 1u;
  let bmax = vec3<f32>(
    f32(min(bx * 4u + 3u, max_v)),
    f32(min(by * 4u + 3u, max_v)),
    f32(min(bz * 4u + 3u, max_v))
  ) * inv_resolution;
  let closest = clamp(center, bmin, bmax);
  let delta = center - closest;
  return dot(delta, delta) <= radius_pad_sq;
}

@compute @workgroup_size(64, 1, 1)
fn count_event_bricks(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let event_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count || !render_product_history_ready()) {
    return;
  }
  if (event_index >= render_product_event_count()) {
    return;
  }
  let resolution = max(u32(surface_row1(surface_index).x), 1u);
  let bounds = compute_event_brick_bounds(event_index, surface_index, resolution);
  if (bounds.is_active == 0u) {
    return;
  }
  let span_b = bounds.max_b - bounds.min_b + vec3<u32>(1u);
  if (span_b.x * span_b.y * span_b.z > grid.max_bricks_per_source) {
    atomicStore(&spatial_grid_u32[grid.surface_event_fallback_offset + surface_index], 1u);
    return;
  }
  let binfo = grid.surface_brick_info[surface_index];
  let brick_dim = binfo.x;
  let brick_offset = binfo.z;
  let inv_resolution = 1.0 / f32(resolution);
  for (var bz = bounds.min_b.z; bz <= bounds.max_b.z; bz = bz + 1u) {
    for (var by = bounds.min_b.y; by <= bounds.max_b.y; by = by + 1u) {
      for (var bx = bounds.min_b.x; bx <= bounds.max_b.x; bx = bx + 1u) {
        if (event_sphere_intersects_brick(bounds.center, bounds.radius_pad_sq, bx, by, bz, resolution, inv_resolution)) {
          let brick_global = brick_offset + (bz * brick_dim + by) * brick_dim + bx;
          atomicAdd(&spatial_grid_u32[grid.e_counts_offset + brick_global], 1u);
        }
      }
    }
  }
}

@compute @workgroup_size(64, 1, 1)
fn scatter_event_bricks(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let event_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count || !render_product_history_ready()) {
    return;
  }
  if (event_index >= render_product_event_count()) {
    return;
  }
  if (
    atomicLoad(&spatial_grid_u32[3u]) != 0u
    || atomicLoad(&spatial_grid_u32[grid.surface_event_fallback_offset + surface_index]) != 0u
  ) {
    return;
  }
  let resolution = max(u32(surface_row1(surface_index).x), 1u);
  let bounds = compute_event_brick_bounds(event_index, surface_index, resolution);
  if (bounds.is_active == 0u) {
    return;
  }
  let span_b = bounds.max_b - bounds.min_b + vec3<u32>(1u);
  if (span_b.x * span_b.y * span_b.z > grid.max_bricks_per_source) {
    return;
  }
  let binfo = grid.surface_brick_info[surface_index];
  let brick_dim = binfo.x;
  let brick_offset = binfo.z;
  let inv_resolution = 1.0 / f32(resolution);
  for (var bz = bounds.min_b.z; bz <= bounds.max_b.z; bz = bz + 1u) {
    for (var by = bounds.min_b.y; by <= bounds.max_b.y; by = by + 1u) {
      for (var bx = bounds.min_b.x; bx <= bounds.max_b.x; bx = bx + 1u) {
        if (event_sphere_intersects_brick(bounds.center, bounds.radius_pad_sq, bx, by, bz, resolution, inv_resolution)) {
          let brick_global = brick_offset + (bz * brick_dim + by) * brick_dim + bx;
          let slot = atomicAdd(&spatial_grid_u32[grid.e_cursors_offset + brick_global], 1u);
          if (slot < grid.event_entry_capacity) {
            atomicStore(&spatial_grid_u32[grid.e_entries_offset + slot], event_index);
          }
        }
      }
    }
  }
}
`,xn=`
${hn}

@group(0) @binding(0) var<storage, read_write> spatial_grid_u32: array<u32>;
@group(0) @binding(1) var<uniform> grid: SpatialGridParams;

var<workgroup> wg_scan: array<u32, 512>;

@compute @workgroup_size(256, 1, 1)
fn scan_brick_blocks(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let tid = local_id.x;
  let block_id = workgroup_id.x;
  let channel = workgroup_id.y;
  let counts_base = select(grid.p_counts_offset, grid.e_counts_offset, channel != 0u);
  let offsets_base = select(grid.p_offsets_offset, grid.e_offsets_offset, channel != 0u);
  let cursors_base = select(grid.p_cursors_offset, grid.e_cursors_offset, channel != 0u);
  let totals_base = select(grid.p_block_totals_offset, grid.e_block_totals_offset, channel != 0u);
  let meta_base = select(0u, 2u, channel != 0u);
  let entry_cap = select(grid.particle_entry_capacity, grid.event_entry_capacity, channel != 0u);

  let block_base = block_id * 512u;
  let i0 = block_base + tid;
  let i1 = block_base + tid + 256u;
  wg_scan[tid] = select(0u, spatial_grid_u32[counts_base + i0], i0 < grid.total_bricks);
  wg_scan[tid + 256u] = select(0u, spatial_grid_u32[counts_base + i1], i1 < grid.total_bricks);

  var offset = 1u;
  for (var d = 256u; d > 0u; d = d >> 1u) {
    workgroupBarrier();
    if (tid < d) {
      let ai = offset * (2u * tid + 1u) - 1u;
      let bi = offset * (2u * tid + 2u) - 1u;
      wg_scan[bi] = wg_scan[bi] + wg_scan[ai];
    }
    offset = offset << 1u;
  }
  workgroupBarrier();
  if (tid == 0u) {
    let block_total = wg_scan[511u];
    spatial_grid_u32[totals_base + block_id] = block_total;
    if (grid.scan_block_count == 1u) {
      spatial_grid_u32[meta_base] = block_total;
      if (block_total > entry_cap) {
        spatial_grid_u32[meta_base + 1u] = 1u;
      }
    }
    wg_scan[511u] = 0u;
  }
  for (var d = 1u; d < 512u; d = d << 1u) {
    offset = offset >> 1u;
    workgroupBarrier();
    if (tid < d) {
      let ai = offset * (2u * tid + 1u) - 1u;
      let bi = offset * (2u * tid + 2u) - 1u;
      let t = wg_scan[ai];
      wg_scan[ai] = wg_scan[bi];
      wg_scan[bi] = wg_scan[bi] + t;
    }
  }
  workgroupBarrier();
  if (i0 < grid.total_bricks) {
    let v0 = wg_scan[tid];
    spatial_grid_u32[offsets_base + i0] = v0;
    if (grid.scan_block_count == 1u) {
      spatial_grid_u32[cursors_base + i0] = v0;
    }
  }
  if (i1 < grid.total_bricks) {
    let v1 = wg_scan[tid + 256u];
    spatial_grid_u32[offsets_base + i1] = v1;
    if (grid.scan_block_count == 1u) {
      spatial_grid_u32[cursors_base + i1] = v1;
    }
  }
}

@compute @workgroup_size(256, 1, 1)
fn scan_brick_block_totals(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let tid = local_id.x;
  let channel = workgroup_id.y;
  let totals_base = select(grid.p_block_totals_offset, grid.e_block_totals_offset, channel != 0u);
  let meta_base = select(0u, 2u, channel != 0u);
  let entry_cap = select(grid.particle_entry_capacity, grid.event_entry_capacity, channel != 0u);
  let n = grid.scan_block_count;

  wg_scan[tid] = select(0u, spatial_grid_u32[totals_base + tid], tid < n);
  wg_scan[tid + 256u] = select(0u, spatial_grid_u32[totals_base + tid + 256u], tid + 256u < n);

  var offset = 1u;
  for (var d = 256u; d > 0u; d = d >> 1u) {
    workgroupBarrier();
    if (tid < d) {
      let ai = offset * (2u * tid + 1u) - 1u;
      let bi = offset * (2u * tid + 2u) - 1u;
      wg_scan[bi] = wg_scan[bi] + wg_scan[ai];
    }
    offset = offset << 1u;
  }
  workgroupBarrier();
  if (tid == 0u) {
    let grand_total = wg_scan[511u];
    spatial_grid_u32[meta_base] = grand_total;
    if (grand_total > entry_cap) {
      spatial_grid_u32[meta_base + 1u] = 1u;
    }
    wg_scan[511u] = 0u;
  }
  for (var d = 1u; d < 512u; d = d << 1u) {
    offset = offset >> 1u;
    workgroupBarrier();
    if (tid < d) {
      let ai = offset * (2u * tid + 1u) - 1u;
      let bi = offset * (2u * tid + 2u) - 1u;
      let t = wg_scan[ai];
      wg_scan[ai] = wg_scan[bi];
      wg_scan[bi] = wg_scan[bi] + t;
    }
  }
  workgroupBarrier();
  if (tid < n) {
    spatial_grid_u32[totals_base + tid] = wg_scan[tid];
  }
  if (tid + 256u < n) {
    spatial_grid_u32[totals_base + tid + 256u] = wg_scan[tid + 256u];
  }
}

@compute @workgroup_size(256, 1, 1)
fn add_brick_block_offsets(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let tid = local_id.x;
  let block_id = workgroup_id.x;
  let channel = workgroup_id.y;
  let offsets_base = select(grid.p_offsets_offset, grid.e_offsets_offset, channel != 0u);
  let cursors_base = select(grid.p_cursors_offset, grid.e_cursors_offset, channel != 0u);
  let totals_base = select(grid.p_block_totals_offset, grid.e_block_totals_offset, channel != 0u);
  let block_offset = spatial_grid_u32[totals_base + block_id];
  let block_base = block_id * 512u;
  let i0 = block_base + tid;
  let i1 = block_base + tid + 256u;
  if (i0 < grid.total_bricks) {
    let v0 = spatial_grid_u32[offsets_base + i0] + block_offset;
    spatial_grid_u32[offsets_base + i0] = v0;
    spatial_grid_u32[cursors_base + i0] = v0;
  }
  if (i1 < grid.total_bricks) {
    let v1 = spatial_grid_u32[offsets_base + i1] + block_offset;
    spatial_grid_u32[offsets_base + i1] = v1;
    spatial_grid_u32[cursors_base + i1] = v1;
  }
}
`;function Sn({motionField:e=!1}={}){return`
${c}
${hn}

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> render_field_cells: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: RenderFieldParams;
@group(0) @binding(4) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> product_history_control: array<u32>;
@group(0) @binding(6) var<uniform> product_history_gate: RenderProductHistoryGateParams;
@group(0) @binding(7) var<storage, read> dispersed_medium_optics_rows: array<SphDispersedMediumOptics>;
@group(0) @binding(8) var<storage, read> spatial_grid_u32: array<u32>;
@group(0) @binding(9) var<uniform> grid: SpatialGridParams;
${e?`@group(0) @binding(10) var<storage, read_write> render_motion_field: array<vec4<f32>>;`:``}

${gn}
${_n}
${vn}

struct BrickCtrl {
  ready: u32,
  dispersed: u32,
  p_fb: u32,
  e_fb: u32,
  p_start: u32,
  p_count: u32,
  e_start: u32,
  e_count: u32,
};

var<workgroup> wg_ctrl: BrickCtrl;
var<workgroup> wg_p_pos_str: array<vec4<f32>, 64>;
var<workgroup> wg_p_sup_temp_vel: array<vec4<f32>, 64>;
var<workgroup> wg_p_vel_z: array<f32, 64>;
var<workgroup> wg_smear_votes: array<u32, 64>;
var<workgroup> wg_any_smear: u32;

@compute @workgroup_size(64, 1, 1)
fn gather_bricks(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let tid = local_id.x;
  let brick_local = workgroup_id.x;
  let surface_index = workgroup_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }
  let binfo = grid.surface_brick_info[surface_index];
  let brick_dim = binfo.x;
  let brick_count = binfo.y;
  let brick_offset = binfo.z;
  if (brick_local >= brick_count) {
    return;
  }
  let brick_global = brick_offset + brick_local;

  if (tid == 0u) {
    let ready = render_product_history_ready();
    let dispersed = surface_row3(surface_index).y > 0.0;
    let p_fb = (spatial_grid_u32[1u] != 0u)
      || (spatial_grid_u32[grid.surface_fallback_offset + surface_index] != 0u);
    let e_fb = (grid.has_product_events != 0u)
      && (
        (spatial_grid_u32[3u] != 0u)
        || (spatial_grid_u32[grid.surface_event_fallback_offset + surface_index] != 0u)
      );
    wg_ctrl = BrickCtrl(
      select(0u, 1u, ready),
      select(0u, 1u, dispersed),
      select(0u, 1u, p_fb),
      select(0u, 1u, e_fb),
      spatial_grid_u32[grid.p_offsets_offset + brick_global],
      spatial_grid_u32[grid.p_counts_offset + brick_global],
      select(0u, spatial_grid_u32[grid.e_offsets_offset + brick_global], grid.has_product_events != 0u),
      select(0u, spatial_grid_u32[grid.e_counts_offset + brick_global], grid.has_product_events != 0u)
    );
  }
  let ctrl = workgroupUniformLoad(&wg_ctrl);

  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let s2 = surface_row2(surface_index);
  let s3 = surface_row3(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  let resolution = max(u32(s1.x), 1u);

  let brick_plane = brick_dim * brick_dim;
  let bz = brick_local / brick_plane;
  let brem = brick_local - bz * brick_plane;
  let by = brem / brick_dim;
  let bx = brem - by * brick_dim;

  let lx = tid & 3u;
  let ly = (tid >> 2u) & 3u;
  let lz = tid >> 4u;
  let x = bx * 4u + lx;
  let y = by * 4u + ly;
  let z = bz * 4u + lz;
  let cell_index = z * resolution * resolution + y * resolution + x;
  let out_index = field_offset + cell_index;
  let in_bounds = x < resolution && y < resolution && z < resolution
    && cell_index < field_cell_count && out_index < params.total_field_cells;

  if (ctrl.ready == 0u) {
    if (in_bounds) {
      render_field_cells[out_index * 2u] = vec4<f32>(0.0);
      render_field_cells[out_index * 2u + 1u] = vec4<f32>(0.0);
${e?`      render_motion_field[out_index] = vec4<f32>(0.0);`:``}
    }
    return;
  }

  let empty_brick = (ctrl.p_fb == 0u && ctrl.p_count == 0u)
    && (ctrl.dispersed != 0u || (ctrl.e_fb == 0u && ctrl.e_count == 0u));
  if (empty_brick) {
    if (in_bounds) {
      render_field_cells[out_index * 2u] = vec4<f32>(0.0);
      render_field_cells[out_index * 2u + 1u] = vec4<f32>(0.0);
${e?`      render_motion_field[out_index] = vec4<f32>(0.0);`:``}
    }
    return;
  }

  let inv_resolution = 1.0 / f32(resolution);
  let cell = vec3<f32>(f32(x) * inv_resolution, f32(y) * inv_resolution, f32(z) * inv_resolution);
  let material_id = s0.x;
  let phase_id = s0.y;
  let render_domain_id = max(s3.x, 0.0);
  let subtract = max(s1.z, 1.0e-12);
  let strength = s1.w;
  let support_norm = sqrt(abs(strength) / subtract);
  let particle_radius_scale = select(0.0, -s2.x, s2.x < 0.0);
  let color = vec3<f32>(s2.y, s2.z, s2.w);
  let span = 1.0 - 2.0 * params.field_padding;
  let ref_edge = max(params.ref_edge_m, 1.0e-12);
  let particle_radius_norm_scale = particle_radius_scale * span / ref_edge;
  let particle_radius_floor_norm = select(
    0.0,
    sqrt(0.75 * inv_resolution * inv_resolution + 0.000001),
    particle_radius_scale > 0.0
  );

  var density = 0.0;
  var palette = vec3<f32>(0.0, 0.0, 0.0);
  var temperature_weighted = 0.0;
  var temperature_weight = 0.0;
  var velocity_weighted = vec3<f32>(0.0, 0.0, 0.0);
  var velocity_sq_weighted = 0.0;
  var dispersed_scattering_optical_depth = 0.0;
  var dispersed_absorption_optical_depth = 0.0;
  var dispersed_scattering_asymmetry = RenderFieldSignedF32ScaleAccumulator(
    RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u),
    RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u)
  );
  var dispersed_temperature = RenderFieldWeightedTemperatureAccumulator(
    RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u),
    RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u)
  );

  if (ctrl.dispersed != 0u) {
    if (in_bounds && params.dispersed_medium_enabled != 0u) {
      let loop_count = select(ctrl.p_count, params.particle_count, ctrl.p_fb != 0u);
      let inverse_cell_edge_per_m = min(
        RENDER_FIELD_F32_FINITE_MAX,
        (span * f32(resolution)) / ref_edge
      );
      for (var iter = 0u; iter < loop_count; iter = iter + 1u) {
        let particle_index = select(
          spatial_grid_u32[grid.p_entries_offset + ctrl.p_start + iter],
          iter,
          ctrl.p_fb != 0u
        );
        let row0 = render_row0(particle_index);
        let row1 = render_row1(particle_index);
        let row2 = render_row2(particle_index);
        let row3 = render_row3(particle_index);
        let dispersed = dispersed_medium_optics_rows[particle_index];
        if (
          sph_dispersed_medium_optics_row_is_ready(dispersed)
          && dispersed.optical_state_id > 0.0
          && dispersed.optical_state_id == s3.y
        ) {
          let dispersed_particle = vec3<f32>(
            clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
            clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
            clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
          );
          let cell_weight = render_field_cic_axis_weight(x, dispersed_particle.x, resolution)
            * render_field_cic_axis_weight(y, dispersed_particle.y, resolution)
            * render_field_cic_axis_weight(z, dispersed_particle.z, resolution);
          if (cell_weight > 0.0) {
            let scattering_optical_depth = render_field_balanced_optical_product(
              dispersed.scattering_cross_section_m2, cell_weight, inverse_cell_edge_per_m
            );
            let absorption_optical_depth = render_field_balanced_optical_product(
              dispersed.absorption_cross_section_m2, cell_weight, inverse_cell_edge_per_m
            );
            let asymmetry_optical_depth = render_field_balanced_signed_optical_product(
              dispersed.scattering_asymmetry_cross_section_m2, cell_weight, inverse_cell_edge_per_m
            );
            dispersed_scattering_optical_depth = render_field_saturating_nonnegative_add(
              dispersed_scattering_optical_depth, scattering_optical_depth
            );
            dispersed_absorption_optical_depth = render_field_saturating_nonnegative_add(
              dispersed_absorption_optical_depth, absorption_optical_depth
            );
            dispersed_scattering_asymmetry = render_field_accumulate_signed_scale(
              dispersed_scattering_asymmetry, asymmetry_optical_depth
            );
            dispersed_temperature = render_field_accumulate_weighted_temperature(
              dispersed_temperature, row1.z, scattering_optical_depth
            );
            dispersed_temperature = render_field_accumulate_weighted_temperature(
              dispersed_temperature, row1.z, absorption_optical_depth
            );
          }
        } else if (
          row0.w > 0.0
          && row1.y == 3.0
          && params.particle_count >= 4u
          && (params.particle_count % 4u) == 0u
        ) {
          let phase_stride = params.particle_count / 4u;
          let companion_index = (particle_index % phase_stride) + phase_stride;
          if (companion_index < arrayLength(&dispersed_medium_optics_rows)) {
            let companion = dispersed_medium_optics_rows[companion_index];
            let row4_wet = render_row4(particle_index);
            let suspended_condensate_fraction = clamp(1.0 - row2.y - row4_wet.x, 0.0, 1.0);
            if (
              suspended_condensate_fraction > 0.0
              && sph_dispersed_medium_optics_row_is_ready(companion)
              && companion.optical_state_id > 0.0
              && companion.optical_state_id == s3.y
            ) {
              let dispersed_particle = vec3<f32>(
                clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
                clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
                clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
              );
              let support_cells = clamp(max((row3.y * span / ref_edge) * f32(resolution), 3.6), 1.0, 6.0);
              let wx = max(0.0, 1.0 - abs(f32(x) - dispersed_particle.x * f32(resolution)) / support_cells) / support_cells;
              let wy = max(0.0, 1.0 - abs(f32(y) - dispersed_particle.y * f32(resolution)) / support_cells) / support_cells;
              let wz = max(0.0, 1.0 - abs(f32(z) - dispersed_particle.z * f32(resolution)) / support_cells) / support_cells;
              let cell_weight = wx * wy * wz;
              if (cell_weight > 0.0) {
                let companion_rho = select(1000.0, render_row1(companion_index).w, render_row1(companion_index).w > 100.0);
                let mist_mass_kg = row0.w * suspended_condensate_fraction;
                let mist_scattering_m2 = (0.75 * 3.8 * mist_mass_kg) / (companion_rho * 0.45e-6);
                let scattering_optical_depth = render_field_balanced_optical_product(
                  mist_scattering_m2, cell_weight, inverse_cell_edge_per_m
                );
                let asymmetry_optical_depth = render_field_balanced_signed_optical_product(
                  0.72 * mist_scattering_m2, cell_weight, inverse_cell_edge_per_m
                );
                dispersed_scattering_optical_depth = render_field_saturating_nonnegative_add(
                  dispersed_scattering_optical_depth, scattering_optical_depth
                );
                dispersed_scattering_asymmetry = render_field_accumulate_signed_scale(
                  dispersed_scattering_asymmetry, asymmetry_optical_depth
                );
                dispersed_temperature = render_field_accumulate_weighted_temperature(
                  dispersed_temperature, row1.z, scattering_optical_depth
                );
              }
            }
          }
        }
      }
    }
    if (in_bounds) {
${e?`      render_motion_field[out_index] = vec4<f32>(0.0);`:``}
      let dispersed_scattering_asymmetry_optical_depth = clamp(
        render_field_signed_scale_sum(dispersed_scattering_asymmetry),
        -dispersed_scattering_optical_depth,
        dispersed_scattering_optical_depth
      );
      let dispersed_total_optical_depth = render_field_saturating_nonnegative_add(
        dispersed_scattering_optical_depth,
        dispersed_absorption_optical_depth
      );
      let out_density = render_field_saturating_nonnegative_product(
        max(s1.y, 0.0),
        dispersed_total_optical_depth
      );
      let out_palette = select(vec3<f32>(0.0), color, dispersed_total_optical_depth > 0.0);
      let mean_temperature_k = render_field_divide_positive_scales(
        dispersed_temperature.weighted_temperature,
        dispersed_temperature.weight
      );
      render_field_cells[out_index * 2u] = vec4<f32>(out_density, out_palette);
      render_field_cells[out_index * 2u + 1u] = vec4<f32>(
        mean_temperature_k,
        dispersed_scattering_optical_depth,
        dispersed_absorption_optical_depth,
        dispersed_scattering_asymmetry_optical_depth
      );
    }
    return;
  }

  // Bulk surface path: cooperative shared-memory tiled gather over brick entries.
  if (ctrl.p_fb == 0u) {
    let p_end = ctrl.p_start + ctrl.p_count;
    for (var batch = ctrl.p_start; batch < p_end; batch = batch + 64u) {
      let batch_len = min(64u, p_end - batch);
      if (tid < batch_len) {
        let p_idx = spatial_grid_u32[grid.p_entries_offset + batch + tid];
        let row0 = render_row0(p_idx);
        let row1 = render_row1(p_idx);
        let row2 = render_row2(p_idx);
        let row3 = render_row3(p_idx);
        let row4 = render_row4(p_idx);
        let pw = render_bulk_phase_weight(
          p_idx, material_id, phase_id, row0.w,
          render_phase_weight(phase_id, row1.y, row2.y, row4.x)
        );
        let p_pos = vec3<f32>(
          clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
        );
        let p_rad = select(
          0.0,
          max(row3.y * particle_radius_norm_scale, particle_radius_floor_norm),
          particle_radius_scale > 0.0 && row3.y > 0.0
        );
        let full_str = select(
          strength,
          (s1.y + subtract) * p_rad * p_rad,
          p_rad > 0.0
        );
        let p_str = phase_partitioned_metaball_strength(full_str, pw, s1.y, subtract);
        let p_sup = max(metaball_support_norm(p_str, subtract), 1.0e-6);
        wg_p_pos_str[tid] = vec4<f32>(p_pos, p_str);
        wg_p_sup_temp_vel[tid] = vec4<f32>(p_sup, row1.z, row4.y, row4.z);
        wg_p_vel_z[tid] = row4.w;
      }
      workgroupBarrier();
      if (in_bounds) {
        for (var k = 0u; k < batch_len; k = k + 1u) {
          let ps = wg_p_pos_str[k];
          let delta = cell - ps.xyz;
          let dist2 = dot(delta, delta);
          let value = ps.w / (0.000001 + dist2) - subtract;
          if (value > 0.0) {
            let stv = wg_p_sup_temp_vel[k];
            let vz = wg_p_vel_z[k];
            density = density + value;
            let ratio = sqrt(dist2) / stv.x;
            palette = palette + color * smooth_palette_weight(ratio);
            temperature_weighted = temperature_weighted + stv.y * value;
            temperature_weight = temperature_weight + value;
            let vel = vec3<f32>(stv.z, stv.w, vz);
            velocity_weighted = velocity_weighted + vel * value;
            velocity_sq_weighted = velocity_sq_weighted + dot(vel, vel) * value;
          }
        }
      }
      workgroupBarrier();
    }
  } else if (in_bounds) {
    for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
      let row0 = render_row0(particle_index);
      let row1 = render_row1(particle_index);
      let row2 = render_row2(particle_index);
      let row3 = render_row3(particle_index);
      if (row1.x != material_id || (render_domain_id > 0.0 && row2.w != render_domain_id)) {
        continue;
      }
      let row4 = render_row4(particle_index);
      let phase_weight = render_bulk_phase_weight(
        particle_index, material_id, phase_id, row0.w,
        render_phase_weight(phase_id, row1.y, row2.y, row4.x)
      );
      if (phase_weight <= 0.0) { continue; }
      let particle = vec3<f32>(
        clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
        clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
        clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
      );
      let delta = cell - particle;
      let dist2 = dot(delta, delta);
      let particle_radius_norm = select(
        0.0,
        max(row3.y * particle_radius_norm_scale, particle_radius_floor_norm),
        particle_radius_scale > 0.0 && row3.y > 0.0
      );
      let full_particle_strength = select(
        strength,
        (s1.y + subtract) * particle_radius_norm * particle_radius_norm,
        particle_radius_norm > 0.0
      );
      let particle_strength = phase_partitioned_metaball_strength(full_particle_strength, phase_weight, s1.y, subtract);
      let particle_support_norm = metaball_support_norm(particle_strength, subtract);
      let value = particle_strength / (0.000001 + dist2) - subtract;
      if (value > 0.0) {
        density = density + value;
        let ratio = sqrt(dist2) / max(particle_support_norm, 1.0e-6);
        palette = palette + color * smooth_palette_weight(ratio);
        temperature_weighted = temperature_weighted + row1.z * value;
        temperature_weight = temperature_weight + value;
        let particle_velocity = row4.yzw;
        velocity_weighted = velocity_weighted + particle_velocity * value;
        velocity_sq_weighted = velocity_sq_weighted + dot(particle_velocity, particle_velocity) * value;
      }
    }
  }

${e?`  if (in_bounds) {
    render_motion_field[out_index] = vec4<f32>(velocity_weighted, temperature_weight);
  }
`:``}
  // Splash-shard smear correction (workgroup-uniform fast path).
  var smear_sq = 0.0;
  var needs_smear = false;
  if (in_bounds && temperature_weight > 0.0 && params.render_smear_dt_s > 0.0) {
    let mean_velocity = velocity_weighted / temperature_weight;
    let dispersion_sq_ms = max(0.0, velocity_sq_weighted / temperature_weight - dot(mean_velocity, mean_velocity));
    let smear_norm = sqrt(dispersion_sq_ms) * params.render_smear_dt_s * span / ref_edge;
    smear_sq = smear_norm * smear_norm;
    needs_smear = smear_sq > 1.0e-10;
  }
  wg_smear_votes[tid] = select(0u, 1u, needs_smear);
  workgroupBarrier();
  if (tid == 0u) {
    var any_flag = 0u;
    for (var i = 0u; i < 64u; i = i + 1u) {
      any_flag = any_flag | wg_smear_votes[i];
    }
    wg_any_smear = any_flag;
  }
  let brick_has_smear = workgroupUniformLoad(&wg_any_smear) != 0u;

  if (brick_has_smear) {
    var corrected_density = 0.0;
    var corrected_palette = vec3<f32>(0.0, 0.0, 0.0);
    var corrected_temperature_weighted = 0.0;
    var corrected_temperature_weight = 0.0;
    if (ctrl.p_fb == 0u) {
      if (ctrl.p_count <= 64u) {
        if (needs_smear) {
          for (var k = 0u; k < ctrl.p_count; k = k + 1u) {
            let ps = wg_p_pos_str[k];
            let delta = cell - ps.xyz;
            let dist2 = dot(delta, delta) + smear_sq;
            let value = ps.w / (0.000001 + dist2) - subtract;
            if (value > 0.0) {
              let stv = wg_p_sup_temp_vel[k];
              corrected_density = corrected_density + value;
              let ratio = sqrt(dist2) / stv.x;
              corrected_palette = corrected_palette + color * smooth_palette_weight(ratio);
              corrected_temperature_weighted = corrected_temperature_weighted + stv.y * value;
              corrected_temperature_weight = corrected_temperature_weight + value;
            }
          }
        }
      } else {
        let p_end = ctrl.p_start + ctrl.p_count;
        for (var batch = ctrl.p_start; batch < p_end; batch = batch + 64u) {
          let batch_len = min(64u, p_end - batch);
          if (tid < batch_len) {
            let p_idx = spatial_grid_u32[grid.p_entries_offset + batch + tid];
            let row0 = render_row0(p_idx);
            let row1 = render_row1(p_idx);
            let row2 = render_row2(p_idx);
            let row3 = render_row3(p_idx);
            let row4 = render_row4(p_idx);
            let pw = render_bulk_phase_weight(
              p_idx, material_id, phase_id, row0.w,
              render_phase_weight(phase_id, row1.y, row2.y, row4.x)
            );
            let p_pos = vec3<f32>(
              clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
              clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
              clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
            );
            let p_rad = select(
              0.0,
              max(row3.y * particle_radius_norm_scale, particle_radius_floor_norm),
              particle_radius_scale > 0.0 && row3.y > 0.0
            );
            let full_str = select(
              strength,
              (s1.y + subtract) * p_rad * p_rad,
              p_rad > 0.0
            );
            let p_str = phase_partitioned_metaball_strength(full_str, pw, s1.y, subtract);
            let p_sup = max(metaball_support_norm(p_str, subtract), 1.0e-6);
            wg_p_pos_str[tid] = vec4<f32>(p_pos, p_str);
            wg_p_sup_temp_vel[tid] = vec4<f32>(p_sup, row1.z, 0.0, 0.0);
          }
          workgroupBarrier();
          if (needs_smear) {
            for (var k = 0u; k < batch_len; k = k + 1u) {
              let ps = wg_p_pos_str[k];
              let delta = cell - ps.xyz;
              let dist2 = dot(delta, delta) + smear_sq;
              let value = ps.w / (0.000001 + dist2) - subtract;
              if (value > 0.0) {
                let stv = wg_p_sup_temp_vel[k];
                corrected_density = corrected_density + value;
                let ratio = sqrt(dist2) / stv.x;
                corrected_palette = corrected_palette + color * smooth_palette_weight(ratio);
                corrected_temperature_weighted = corrected_temperature_weighted + stv.y * value;
                corrected_temperature_weight = corrected_temperature_weight + value;
              }
            }
          }
          workgroupBarrier();
        }
      }
    } else if (needs_smear) {
      for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
        let row0 = render_row0(particle_index);
        let row1 = render_row1(particle_index);
        let row2 = render_row2(particle_index);
        let row3 = render_row3(particle_index);
        if (row1.x != material_id || (render_domain_id > 0.0 && row2.w != render_domain_id)) {
          continue;
        }
        let phase_weight = render_bulk_phase_weight(
          particle_index, material_id, phase_id, row0.w,
          render_phase_weight(phase_id, row1.y, row2.y, render_row4(particle_index).x)
        );
        if (phase_weight <= 0.0) { continue; }
        let particle = vec3<f32>(
          clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
        );
        let delta = cell - particle;
        let dist2 = dot(delta, delta) + smear_sq;
        let particle_radius_norm = select(
          0.0,
          max(row3.y * particle_radius_norm_scale, particle_radius_floor_norm),
          particle_radius_scale > 0.0 && row3.y > 0.0
        );
        let full_particle_strength = select(
          strength,
          (s1.y + subtract) * particle_radius_norm * particle_radius_norm,
          particle_radius_norm > 0.0
        );
        let particle_strength = phase_partitioned_metaball_strength(full_particle_strength, phase_weight, s1.y, subtract);
        let particle_support_norm = metaball_support_norm(particle_strength, subtract);
        let value = particle_strength / (0.000001 + dist2) - subtract;
        if (value > 0.0) {
          corrected_density = corrected_density + value;
          let ratio = sqrt(dist2) / max(particle_support_norm, 1.0e-6);
          corrected_palette = corrected_palette + color * smooth_palette_weight(ratio);
          corrected_temperature_weighted = corrected_temperature_weighted + row1.z * value;
          corrected_temperature_weight = corrected_temperature_weight + value;
        }
      }
    }
    if (needs_smear) {
      density = corrected_density;
      palette = corrected_palette;
      temperature_weighted = corrected_temperature_weighted;
      temperature_weight = corrected_temperature_weight;
    }
  }

  // Product events pass (brick-binned with shared-memory batching or exact fallback).
  if (grid.has_product_events != 0u) {
    if (ctrl.e_fb == 0u) {
      let e_end = ctrl.e_start + ctrl.e_count;
      let denom_sup = max(support_norm, 1.0e-6);
      for (var batch = ctrl.e_start; batch < e_end; batch = batch + 64u) {
        let batch_len = min(64u, e_end - batch);
        if (tid < batch_len) {
          let ev_idx = spatial_grid_u32[grid.e_entries_offset + batch + tid];
          let event0 = product_events[ev_idx * 8u];
          let ev_pos = vec3<f32>(
            clamp(params.field_padding + (event0.x / ref_edge) * span, 0.001, 0.999),
            clamp(params.field_padding + (event0.y / ref_edge) * span, 0.001, 0.999),
            clamp(params.field_padding + (event0.z / ref_edge) * span, 0.001, 0.999)
          );
          wg_p_pos_str[tid] = vec4<f32>(ev_pos, 0.0);
        }
        workgroupBarrier();
        if (in_bounds) {
          for (var k = 0u; k < batch_len; k = k + 1u) {
            let ev_pos = wg_p_pos_str[k].xyz;
            let delta = cell - ev_pos;
            let dist2 = dot(delta, delta);
            let value = strength / (0.000001 + dist2) - subtract;
            if (value > 0.0) {
              density = density + value;
              let ratio = sqrt(dist2) / denom_sup;
              palette = palette + color * smooth_palette_weight(ratio);
            }
          }
        }
        workgroupBarrier();
      }
    } else if (in_bounds) {
      let authenticated_product_event_count = render_product_event_count();
      for (var event_index = 0u; event_index < authenticated_product_event_count; event_index = event_index + 1u) {
        let event0 = product_events[event_index * 8u];
        let event1 = product_events[event_index * 8u + 1u];
        let event2 = product_events[event_index * 8u + 2u];
        let event3 = product_events[event_index * 8u + 3u];
        let event4 = product_events[event_index * 8u + 4u];
        if (
          event4.z != 1.0
          || event3.y <= 0.0
          || event1.x != material_id
          || (event2.w > 0.0 && event2.w != phase_id)
        ) {
          continue;
        }
        let event_position = vec3<f32>(
          clamp(params.field_padding + (event0.x / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (event0.y / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (event0.z / ref_edge) * span, 0.001, 0.999)
        );
        let delta = cell - event_position;
        let dist2 = dot(delta, delta);
        let value = strength / (0.000001 + dist2) - subtract;
        if (value > 0.0) {
          density = density + value;
          let ratio = sqrt(dist2) / max(support_norm, 1.0e-6);
          palette = palette + color * smooth_palette_weight(ratio);
        }
      }
    }
  }

  if (in_bounds) {
    let mean_temperature_k = select(
      0.0,
      temperature_weighted / max(temperature_weight, 1.0e-6),
      temperature_weight > 0.0
    );
    render_field_cells[out_index * 2u] = vec4<f32>(density, palette);
    render_field_cells[out_index * 2u + 1u] = vec4<f32>(mean_temperature_k, 0.0, 0.0, 0.0);
  }
}
`}var Cn=Sn(),wn=Sn({motionField:!0}),Tn=new WeakMap;function En({device:e,surfaceRecords:t,surfaceCount:n,particleCount:r,productEventCount:i=0}={}){if(!Number.isInteger(n)||n<1||n>64||!(t instanceof Float32Array)||t.length<n*16)return null;let a=Number(e?.limits?.maxComputeWorkgroupsPerDimension??65535),o=Number(e?.limits?.maxBufferSize??256*1024*1024),s=Number(e?.limits?.maxStorageBufferBindingSize??128*1024*1024),c=Math.min(o,s);if(Number(e?.limits?.maxStorageBuffersPerShaderStage??8)<8)return null;let l=new Uint32Array(256),u=0,d=0;for(let e=0;e<n;e+=1){let n=Math.max(1,Math.trunc(Number(t[e*16+4])||1)),r=Math.ceil(n/4),i=r*r*r;if(i>a)return null;l[e*4]=r,l[e*4+1]=i,l[e*4+2]=u,l[e*4+3]=0,u+=i,i>d&&(d=i)}if(u<1||u>262144)return null;let f=r>0?Math.ceil(r/64):0,p=i>0,m=p?Math.ceil(i/64):0;if(f>a||m>a||n>a)return null;let h=Math.ceil(u/512),g=e=>Math.ceil(e/4)*4,_=8+g(n),v=_+g(n),y=v+g(u),b=p?y+g(u):y,x=b,S=x+g(u),C=S+g(u),w=C+g(h),T=Math.max(262144,Math.min(4194304,Math.max(u*8,r*16))),E=w+T,D=p?Math.max(131072,Math.min(2097152,Math.max(u*4,i*8))):0,O=E,k=p?O+g(u):E,A=p?k+g(u):E,j=p?A+g(h):E,M=(p?j+D:E)*Uint32Array.BYTES_PER_ELEMENT;return M>c?null:{surfaceCount:n,totalBricks:u,maxBricksPerSurface:d,scanBlockCount:h,particleWorkgroups:f,eventWorkgroups:m,hasProductEvents:p,surfaceFallbackOffset:8,surfaceEventFallbackOffset:_,pCountsOffset:v,eCountsOffset:y,clearBytes:b*Uint32Array.BYTES_PER_ELEMENT,pOffsetsOffset:x,pCursorsOffset:S,pBlockTotalsOffset:C,pEntriesOffset:w,particleEntryCapacity:T,eOffsetsOffset:O,eCursorsOffset:k,eBlockTotalsOffset:A,eEntriesOffset:j,eventEntryCapacity:D,totalBytes:M,surfaceBrickInfo:l}}function Dn(e){let t=new Uint32Array(pn/4);return t[0]=e.totalBricks,t[1]=e.scanBlockCount,t[2]=e.particleEntryCapacity,t[3]=e.eventEntryCapacity,t[4]=512,t[5]=+!!e.hasProductEvents,t[6]=e.surfaceFallbackOffset,t[7]=e.surfaceEventFallbackOffset,t[8]=e.pCountsOffset,t[9]=e.pOffsetsOffset,t[10]=e.pCursorsOffset,t[11]=e.pBlockTotalsOffset,t[12]=e.pEntriesOffset,t[13]=e.eCountsOffset,t[14]=e.eOffsetsOffset,t[15]=e.eCursorsOffset,t[16]=e.eBlockTotalsOffset,t[17]=e.eEntriesOffset,t[18]=0,t[19]=0,t.set(e.surfaceBrickInfo,20),t}function On(e,t){let n=Tn.get(e);if(n||(n={gridBuffer:null,gridCapacityBytes:0,paramsBuffer:null},Tn.set(e,n)),n.paramsBuffer||=e.createBuffer({label:`ulg-sph-render-field-spatial-grid-params`,size:pn,usage:mn.UNIFORM|mn.COPY_DST}),!n.gridBuffer||n.gridCapacityBytes<t){let r=n.gridBuffer,i=Math.max(t,Math.min(t*2,32*1024*1024));n.gridBuffer=e.createBuffer({label:`ulg-sph-render-field-spatial-grid-u32`,size:i,usage:mn.STORAGE|mn.COPY_DST}),n.gridCapacityBytes=i,r&&ge(e,()=>r.destroy?.())}return n}function kn({device:e,encoder:t,plan:n,sourceRowsResource:r,surfaceResource:i,fieldRowsResource:a,paramsBuffer:o,productEventsResource:s,productHistoryControlResource:c,productHistoryGateParamsBuffer:l,dispersedOpticsResource:u,motionFieldResource:d=null}){let f=On(e,n.totalBytes),p=Dn(n);e.queue.writeBuffer(f.paramsBuffer,0,p);let m={buffer:f.gridBuffer,offset:0,size:n.totalBytes};t.clearBuffer(f.gridBuffer,0,n.clearBytes);let h=[G(0,`read-only-storage`),G(1,`read-only-storage`),G(2,`read-only-storage`),G(3,`read-only-storage`),G(4,`storage`),G(5,`uniform`),G(6,`uniform`),G(7,`uniform`)],g=[G(0,`storage`),G(1,`uniform`)],_=[G(0,`read-only-storage`),G(1,`read-only-storage`),G(2,`storage`),G(3,`uniform`),G(4,`read-only-storage`),G(5,`read-only-storage`),G(6,`uniform`),G(7,`read-only-storage`),G(8,`read-only-storage`),G(9,`uniform`),...d?[G(10,`storage`)]:[]],v=me(e,{cacheKey:`ulg-sph-render-field-spatial-v1-count-particles`,label:`ulg-sph-render-field-spatial-count-particles`,code:yn,entryPoint:`count_particle_bricks`,bindings:h}),y=me(e,{cacheKey:`ulg-sph-render-field-spatial-v1-scatter-particles`,label:`ulg-sph-render-field-spatial-scatter-particles`,code:yn,entryPoint:`scatter_particle_bricks`,bindings:h}),b=me(e,{cacheKey:`ulg-sph-render-field-spatial-v1-scan-blocks`,label:`ulg-sph-render-field-spatial-scan-blocks`,code:xn,entryPoint:`scan_brick_blocks`,bindings:g}),x=n.scanBlockCount>1?me(e,{cacheKey:`ulg-sph-render-field-spatial-v1-scan-totals`,label:`ulg-sph-render-field-spatial-scan-totals`,code:xn,entryPoint:`scan_brick_block_totals`,bindings:g}):null,S=n.scanBlockCount>1?me(e,{cacheKey:`ulg-sph-render-field-spatial-v1-add-offsets`,label:`ulg-sph-render-field-spatial-add-offsets`,code:xn,entryPoint:`add_brick_block_offsets`,bindings:g}):null,C=me(e,{cacheKey:d?`ulg-sph-render-field-spatial-v1-gather-motion`:`ulg-sph-render-field-spatial-v1-gather`,label:`ulg-sph-render-field-spatial-gather`,code:d?wn:Cn,entryPoint:`gather_bricks`,bindings:_}),w=n.particleWorkgroups>0?pe(e,{label:`ulg-sph-render-field-spatial-particle-bin-bg`,layout:v.bindGroupLayout,entries:[{binding:0,resource:r},{binding:1,resource:i},{binding:2,resource:u},{binding:3,resource:c},{binding:4,resource:m},{binding:5,resource:{buffer:o}},{binding:6,resource:{buffer:l}},{binding:7,resource:{buffer:f.paramsBuffer}}]}):null,T=null,E=null,D=null;if(n.hasProductEvents&&n.eventWorkgroups>0){let t=[G(0,`read-only-storage`),G(1,`read-only-storage`),G(2,`read-only-storage`),G(3,`storage`),G(4,`uniform`),G(5,`uniform`),G(6,`uniform`)];T=me(e,{cacheKey:`ulg-sph-render-field-spatial-v1-count-events`,label:`ulg-sph-render-field-spatial-count-events`,code:bn,entryPoint:`count_event_bricks`,bindings:t}),E=me(e,{cacheKey:`ulg-sph-render-field-spatial-v1-scatter-events`,label:`ulg-sph-render-field-spatial-scatter-events`,code:bn,entryPoint:`scatter_event_bricks`,bindings:t}),D=pe(e,{label:`ulg-sph-render-field-spatial-event-bin-bg`,layout:T.bindGroupLayout,entries:[{binding:0,resource:s},{binding:1,resource:i},{binding:2,resource:c},{binding:3,resource:m},{binding:4,resource:{buffer:o}},{binding:5,resource:{buffer:l}},{binding:6,resource:{buffer:f.paramsBuffer}}]})}let O=pe(e,{label:`ulg-sph-render-field-spatial-scan-bg`,layout:b.bindGroupLayout,entries:[{binding:0,resource:m},{binding:1,resource:{buffer:f.paramsBuffer}}]}),k=pe(e,{label:`ulg-sph-render-field-spatial-gather-bg`,layout:C.bindGroupLayout,entries:[{binding:0,resource:r},{binding:1,resource:i},{binding:2,resource:a},{binding:3,resource:{buffer:o}},{binding:4,resource:s},{binding:5,resource:c},{binding:6,resource:{buffer:l}},{binding:7,resource:u},{binding:8,resource:m},{binding:9,resource:{buffer:f.paramsBuffer}},...d?[{binding:10,resource:d}]:[]]}),A=(e,n,r,i,a=1,o=1)=>{let s=t.beginComputePass({label:e});s.setPipeline(n.pipeline),s.setBindGroup(0,r),s.dispatchWorkgroups(i,a,o),s.end()},j=n.hasProductEvents?2:1;return w&&A(`ulg-sph-render-field-spatial-count-particles`,v,w,n.particleWorkgroups,n.surfaceCount),D&&A(`ulg-sph-render-field-spatial-count-events`,T,D,n.eventWorkgroups,n.surfaceCount),A(`ulg-sph-render-field-spatial-scan-blocks`,b,O,n.scanBlockCount,j),n.scanBlockCount>1&&(A(`ulg-sph-render-field-spatial-scan-totals`,x,O,1,j),A(`ulg-sph-render-field-spatial-add-offsets`,S,O,n.scanBlockCount,j)),w&&A(`ulg-sph-render-field-spatial-scatter-particles`,y,w,n.particleWorkgroups,n.surfaceCount),D&&A(`ulg-sph-render-field-spatial-scatter-events`,E,D,n.eventWorkgroups,n.surfaceCount),A(`ulg-sph-render-field-spatial-gather`,C,k,n.maxBricksPerSurface,n.surfaceCount),{pipelineCacheStatus:C.cacheStatus}}function An(e,{bucketKey:t,label:n,size:r,usage:i}){let a=Math.max(4,Math.ceil(Number(r)||4));return typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice&&typeof e.queue?.onSubmittedWorkDone==`function`?_e(fe(e,{bucketKey:t,label:n,size:a,usage:i}),e,{bucketKey:t,size:a,usage:i}):e.createBuffer({label:n,size:a,usage:i})}var jn=F.length,Mn=P.length,Nn=ee.length,Pn=`peercompute.ulg.sph-render-field-motion.v0`,Fn=y.length;v.length;var In=I.length,Ln=f.length,Rn=r.length,zn=p.length,Bn=E.length,Vn=o.length,Hn=s.length,Un=64*1024*1024,Wn=32768,Gn=64*1024*1024,Kn=11754943508222875e-54,qn=Kn*16,Jn=Math.fround(1e-12);new Uint32Array(new Float32Array(1).buffer);var Yn=new WeakMap,Xn=new WeakMap,Zn=new WeakMap,Qn=new WeakMap;function $n(e){let t=Array.isArray(e?.metadata)?e.metadata:[],n=e?.records??null;return Object.freeze({surfaceTable:e,records:n,recordValues:n instanceof Float32Array?Object.freeze(Array.from(n)):null,metadata:t,surfaceCount:e?.surfaceCount,totalFieldCells:e?.totalFieldCells,maxFieldCellCount:e?.maxFieldCellCount,surfaces:Object.freeze(t.map(e=>Object.freeze({surface:e,index:e?.index,resolution:e?.resolution,fieldOffset:e?.fieldOffset,fieldCellCount:e?.fieldCellCount,isolation:e?.isolation,subtract:e?.subtract,strength:e?.strength,radiusNorm:e?.radiusNorm,particleRadiusScale:e?.particleRadiusScale,particleRadiusFloorNorm:e?.particleRadiusFloorNorm,colorLinear:Array.isArray(e?.colorLinear)?Object.freeze([...e.colorLinear]):null,surfaceKey:e?.surfaceKey,material:e?.material,phase:e?.phase,renderKey:e?.renderKey,materialId:e?.materialId,phaseId:e?.phaseId,opticalStateId:e?.opticalStateId,opticalStateKey:e?.opticalStateKey,surfaceIdentityKey:e?.surfaceIdentityKey,collectiveOpticalRoute:e?.collectiveOpticalRoute,collectiveOpticalRouteSchema:e?.collectiveOpticalRouteSchema,collectiveOpticalRouteKey:e?.collectiveOpticalRouteKey,collectiveOpticalRouteId:e?.collectiveOpticalRouteId,opticalResponseAuthorityFlag:e?.opticalResponseAuthorityFlag,opticalResponseAuthority:e?.opticalResponseAuthority,opticalResponseReady:e?.opticalResponseReady,opticalVisibilityFlag:e?.opticalVisibilityFlag,opticalVisibilityReason:e?.opticalVisibilityReason,opticalOpacity:e?.opticalOpacity,opticalEffectiveOpacity:e?.opticalEffectiveOpacity,opticalDepth:e?.opticalDepth,opticalScatteringCoefficientPerM:e?.opticalScatteringCoefficientPerM,opticalTransmission:e?.opticalTransmission,opticalRoughness:e?.opticalRoughness,opticalBlockedFlag:e?.opticalBlockedFlag,opticalProvenanceSource:e?.opticalProvenanceSource,renderDomainId:e?.renderDomainId,renderDomainKey:e?.renderDomainKey,renderLayer:e?.renderLayer,renderOrder:e?.renderOrder,transparencyClassId:e?.transparencyClassId,depthWriteFlag:e?.depthWriteFlag,emissiveTemperatureK:e?.emissiveTemperatureK,status:e?.status})))})}function er(e,t){let n=e?.metadata;return!!(t&&e===t.surfaceTable&&e?.records===t.records&&t.records instanceof Float32Array&&Array.isArray(t.recordValues)&&t.records.length===t.recordValues.length&&t.recordValues.every((e,n)=>Object.is(t.records[n],e))&&n===t.metadata&&e?.surfaceCount===t.surfaceCount&&e?.totalFieldCells===t.totalFieldCells&&e?.maxFieldCellCount===t.maxFieldCellCount&&Array.isArray(n)&&n.length===t.surfaces.length&&t.surfaces.every((e,t)=>{let r=n[t];return!!(r===e.surface&&r?.index===e.index&&r?.resolution===e.resolution&&r?.fieldOffset===e.fieldOffset&&r?.fieldCellCount===e.fieldCellCount&&r?.isolation===e.isolation&&r?.subtract===e.subtract&&r?.strength===e.strength&&r?.radiusNorm===e.radiusNorm&&r?.particleRadiusScale===e.particleRadiusScale&&r?.particleRadiusFloorNorm===e.particleRadiusFloorNorm&&(e.colorLinear==null?r?.colorLinear==null:Array.isArray(r?.colorLinear)&&r.colorLinear.length===e.colorLinear.length&&e.colorLinear.every((e,t)=>Object.is(r.colorLinear[t],e)))&&r?.surfaceKey===e.surfaceKey&&r?.material===e.material&&r?.phase===e.phase&&r?.renderKey===e.renderKey&&r?.materialId===e.materialId&&r?.phaseId===e.phaseId&&r?.opticalStateId===e.opticalStateId&&r?.opticalStateKey===e.opticalStateKey&&r?.surfaceIdentityKey===e.surfaceIdentityKey&&r?.collectiveOpticalRoute===e.collectiveOpticalRoute&&r?.collectiveOpticalRouteSchema===e.collectiveOpticalRouteSchema&&r?.collectiveOpticalRouteKey===e.collectiveOpticalRouteKey&&r?.collectiveOpticalRouteId===e.collectiveOpticalRouteId&&r?.opticalResponseAuthorityFlag===e.opticalResponseAuthorityFlag&&r?.opticalResponseAuthority===e.opticalResponseAuthority&&r?.opticalResponseReady===e.opticalResponseReady&&r?.opticalVisibilityFlag===e.opticalVisibilityFlag&&r?.opticalVisibilityReason===e.opticalVisibilityReason&&r?.opticalOpacity===e.opticalOpacity&&r?.opticalEffectiveOpacity===e.opticalEffectiveOpacity&&r?.opticalDepth===e.opticalDepth&&r?.opticalScatteringCoefficientPerM===e.opticalScatteringCoefficientPerM&&r?.opticalTransmission===e.opticalTransmission&&r?.opticalRoughness===e.opticalRoughness&&r?.opticalBlockedFlag===e.opticalBlockedFlag&&r?.opticalProvenanceSource===e.opticalProvenanceSource&&r?.renderDomainId===e.renderDomainId&&r?.renderDomainKey===e.renderDomainKey&&r?.renderLayer===e.renderLayer&&r?.renderOrder===e.renderOrder&&r?.transparencyClassId===e.transparencyClassId&&r?.depthWriteFlag===e.depthWriteFlag&&r?.emissiveTemperatureK===e.emissiveTemperatureK&&r?.status===e.status)}))}function tr({buffer:e,artifact:t,invalidate:n}={}){if(!e||!t||typeof n!=`function`)return null;let r=Qn.get(e);r?.artifact!==t&&r?.invalidate?.();let i=Object.freeze({buffer:e,artifact:t,invalidate:n});return Qn.set(e,i),i}function nr(e){if(!e)return!1;let t=Qn.get(e);return t&&t.invalidate?.(),Qn.delete(e),!!t}function rr(e,t){return e?Qn.get(e)?.artifact===t:!0}function ir(e,t){e&&Qn.get(e)?.artifact===t&&Qn.delete(e)}function ar(e,{device:t,sourceFamily:n,particleCount:r,renderRowsBuffer:i=null,renderRows:a=null}={}){let o=Yn.get(e);return!!(o&&o.active===!0&&o.device===t&&o.sourceFamily===n&&o.particleCount===r&&e?.schroederSpatialSourceFamily===o.sourceFamily&&e?.particleCount===o.particleCount&&(e?.renderRowsBuffer??null)===o.renderRowsBuffer&&e?.renderRows===o.renderRows&&(o.renderRowsBuffer!=null||Array.isArray(o.renderRowValues)&&e.renderRows instanceof Float32Array&&e.renderRows.length===o.renderRowValues.length&&o.renderRowValues.every((t,n)=>e.renderRows[n]===t))&&(e?.dispersedMediumOptics??null)===o.dispersedMediumOptics&&e?.rowStrideFloats===o.rowStrideFloats&&Array.isArray(e?.rowLayout)&&e.rowLayout.length===o.rowLayout.length&&e.rowLayout.every((e,t)=>e===o.rowLayout[t])&&(i==null||o.renderRowsBuffer===i)&&(a==null||o.renderRows===a)&&(o.renderRowsBuffer==null||Xn.get(o.renderRowsBuffer)===e)&&(o.dispersedMediumOptics==null||o.dispersedMediumOptics.buffer===o.dispersedMediumOpticsBuffer&&o.dispersedMediumOptics.authority===o.dispersedMediumOpticsAuthority&&H(t,o.dispersedMediumOpticsAuthority,{buffer:o.dispersedMediumOpticsBuffer,particleCount:o.particleCount,rowCount:o.particleCount,rowStrideFloats:8})))}function or({device:e,sourceFamily:t,productEventRows:n=null,productEventBuffer:r=null,productEventSource:i=null,productEventCount:a=0,productEventLiveCountDescriptor:o=null}={}){return n!=null||r!=null||i!=null||Number(a)!==0?n!=null||r==null||i==null||i.productEventBuffer!==r||!Number.isSafeInteger(a)||a<=0||!o||!oe(o,{handle:i,device:e})||o.hostObserved!==!1||o.expectedRowCapacity!==a||o.rowCapacity!==a||o.expectedRowStrideVec4!==Fn/4||o.rowStrideFloats!==Fn||Number(r.size)<a*Fn*Float32Array.BYTES_PER_ELEMENT?!1:ce(t?.productHistoryCommitGate??null,{device:e,residentProductMass:i}):!0}function sr(e){let t=Yn.get(e);!t||t.active!==!0||(t.active=!1,t.renderRowsBuffer&&Xn.get(t.renderRowsBuffer)===e&&Xn.delete(t.renderRowsBuffer))}function cr(e,{device:t,sourceFamily:n,particleCount:r,fieldRowsBuffer:i=null,fieldRows:a=null,surfaceBuffer:o=null,surfaceTable:s=null}={}){let c=Zn.get(e);return!!(c&&c.active===!0&&c.device===t&&c.sourceFamily===n&&c.particleCount===r&&e?.schroederSpatialSourceFamily===c.sourceFamily&&e?.particleCount===c.particleCount&&(e?.fieldRowsBuffer??null)===c.fieldRowsBuffer&&e?.fieldRows===c.fieldRows&&(e?.surfaceBuffer??null)===c.surfaceBuffer&&e?.surfaceTable===c.surfaceTable&&e?.rowStrideFloats===c.rowStrideFloats&&e?.fieldRowByteLength===c.fieldRowByteLength&&e?.fieldRowsBufferByteLength===c.fieldRowsBufferByteLength&&e?.fieldPadding===c.fieldPadding&&e?.refEdgeM===c.refEdgeM&&e?.productEventCount===c.productEventCount&&e?.productEventRowCapacity===c.productEventRowCapacity&&e?.productEventBufferBound===(c.productEventBuffer!=null)&&e?.productEventCountAuthority===c.productEventCountAuthority&&e?.productEventControlAuthentication===c.productEventControlAuthentication&&c.productEventSourceAuthenticated===(c.productEventBuffer!=null)&&e?.dispersedMediumOpticsBound===!!(c.dispersedMediumOpticsBuffer||c.dispersedMediumOpticsRows)&&e?.dispersedMediumOpticsRowCount===(c.dispersedMediumOpticsBuffer||c.dispersedMediumOpticsRows?c.particleCount:0)&&c.dispersedMediumOpticsSourceAuthenticated===!!c.dispersedMediumOpticsBuffer&&(c.dispersedMediumOpticsBuffer==null||c.dispersedMediumOptics===c.renderRowsSource?.dispersedMediumOptics&&c.dispersedMediumOptics?.buffer===c.dispersedMediumOpticsBuffer&&c.dispersedMediumOptics?.authority===c.dispersedMediumOpticsAuthority)&&er(e?.surfaceTable,c.surfaceTableSnapshot)&&(i==null||c.fieldRowsBuffer===i)&&(a==null||c.fieldRows===a)&&(o==null||c.surfaceBuffer===o)&&(s==null||c.surfaceTable===s)&&(c.fieldRowsBuffer==null||rr(c.fieldRowsBuffer,e)))}function lr(e){let t=Zn.get(e);!t||t.active!==!0||(t.active=!1,t.fieldRowsBuffer&&ir(t.fieldRowsBuffer,e))}var ur=1.9,dr=.5,fr=48,pr=`peercompute.ulg.sph-render-row-particle-scale-stability.v0`,mr=`peercompute.ulg.sph-render-row-material-bank-particle-size-consumer.v0`,hr=`sph-resident-render-row-extraction`,gr=`sph-resident-render-field-splat`,_r=`full-parity-readback`,vr=`no-full-readback`,yr=`dense-readback`,br=`compact-active-readback`,xr=`gpu-resident-summary`,Sr=`fixed-cell-slots`,Cr=`atomic-compact`,wr=Object.freeze(Object.fromEntries(Object.entries(l).map(([e,t])=>[t,e]))),Z={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,VERTEX:globalThis.GPUBufferUsage?.VERTEX??32,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256},Tr={READ:globalThis.GPUMapMode?.READ??1},Er=16777215;function Dr(e){if(e?.schema!==`peercompute.ulg.sph-gpu-particle-buffer.v0`)throw TypeError(`SPH render rows require a packed SPH GPU particle buffer`)}function Or(e){let t=Math.max(0,Math.round(Q(e?.particleCount,0))*U);if(e?.identity==null)return new Uint32Array(t);if(!(e.identity instanceof Uint32Array))throw TypeError(`SPH particle identity rows must be a Uint32Array`);if(e.identity.length<t)throw RangeError(`SPH particle identity rows must cover every particle slot`);return e.identity}function kr({sphParticleState:e=null,sphParticleUpload:t=null}={}){return e?.cpuStateStale===!0||e?.cpuIdentityStale===!0||t?.identityRequired===!0||V(e)}function Ar(e={}){return kr(e)||R(e.sphParticleUpload)}function jr({device:e,sphParticleUpload:t,particleCount:n,identityBuffer:r}){let i=e=>e!=null&&(typeof e!=`number`||e!==0);if(!(t?.dispersedMediumOptics!=null||t?.dispersedMediumOpticsAuthority!=null||t?.dispersedMediumOpticsBuffer!=null||i(t?.dispersedMediumOpticsRowCount)||i(t?.dispersedMediumOpticsRowStrideFloats)||i(t?.dispersedMediumOpticsBufferByteLength)||t?.ownsDispersedMediumOpticsBuffer===!0))return null;let a=t?.dispersedMediumOptics??null,o=n*8*Float32Array.BYTES_PER_ELEMENT,s=Number(a?.buffer?.size);if(!a||a.particleCount!==n||a.rowCount!==n||a.rowStrideFloats!==8||a.bufferByteLength!==o||!Number.isSafeInteger(s)||s!==o||t.dispersedMediumOpticsAuthority!==a.authority||t.dispersedMediumOpticsBuffer!==a.buffer||t.dispersedMediumOpticsRowCount!==a.rowCount||t.dispersedMediumOpticsRowStrideFloats!==a.rowStrideFloats||t.dispersedMediumOpticsBufferByteLength!==a.bufferByteLength||t.ownsDispersedMediumOpticsBuffer!==!0&&t.ownsDispersedMediumOpticsBuffer!==!1||!L(a,{particleCount:n,topologyEpoch:t.topologyEpoch,identityRevision:t.identityRevision,identityBuffer:r})||!H(e,a.authority,{buffer:a.buffer,particleCount:n,rowCount:n,rowStrideFloats:8}))throw TypeError(`SPH render rows rejected a torn, foreign, or misaligned dispersed-medium optics sidecar`);return a}function Q(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function Mr(e,t,{positive:n=!1}={}){let r=Number(e);if(!Number.isSafeInteger(r)||r<+!!n||r>Er||Math.fround(r)!==r)throw RangeError(`${t} must be a ${n?`positive`:`non-negative`} integer exactly representable as f32`);return r}function Nr(e,t,{min:n=0}={}){let r=Number(e);if(!Number.isSafeInteger(r)||r<n||r>4294967295||Math.fround(r)!==r)throw RangeError(`${t} must be an integer exactly representable as both u32 and f32`);return r}function Pr(e,t){let n=Number(e);if(!Number.isSafeInteger(n)||n<0||n>4294967295)throw RangeError(`${t} must be a non-negative safe u32 integer`);return n}function Fr(e,t){let n=Number(e),r=Number(t);if(!Number.isFinite(n))throw RangeError(`fieldPadding must be finite`);if(!Number.isFinite(r))throw RangeError(`refEdgeM must be finite`);let i=Math.fround(n),a=Math.fround(r);if(!(i>=0&&i<.5))throw RangeError(`fieldPadding must satisfy 0 <= fieldPadding < 0.5 after f32 encoding`);if(!(a>0)||!Number.isFinite(a))throw RangeError(`refEdgeM must be positive and finite after f32 encoding`);if(a<Jn)throw RangeError(`refEdgeM must be at least 1e-12 m after f32 encoding`);return{fieldPadding:i,refEdgeM:a}}function Ir(e,t,n){return Math.min(n,Math.max(t,e))}function Lr(e,{noFullReadback:t=!1}={}){let n=String(e||``).trim().toLowerCase();return n===Cr||n===`webgpu-atomic-compact`||n===`compact`?Cr:n===Sr||n===`webgpu-fixed-cell-slots`||n===`fixed`?Sr:t?Cr:Sr}function Rr(e){return+(e===Cr)}function zr({requiredVertexRows:e=0,requestedMaxVertexRows:t=null,emissionMode:n=Sr,compactByteBudget:r=Gn}={}){let i=Math.max(0,Math.round(Q(e,0))),a=t!=null&&t!==``&&Number.isFinite(Number(t))?Math.max(0,Math.round(Number(t))):null;if(n!==Cr)return Math.max(i,a??i);let o=zn*Float32Array.BYTES_PER_ELEMENT,s=Math.max(0,Math.floor(Math.max(o,Q(r,Gn))/o)),c=Math.min(i,a??s);return i>0?Math.max(3,c-c%3):0}function Br(e){return wr[Math.round(Q(e,0))]||`unknown`}function Vr(e,t){return e===`h2o`&&t===`solid`?`ice`:e===`h2o`&&t===`gas`?`steam`:e||`unknown`}function Hr(e){let t=Math.round(Q(e,0));return t===1?`base`:t===2?`drop`:null}function Ur({material:e,phase:t,renderDomainId:n}){let r=Math.max(0,Math.round(Q(n,0)));return r<=0?null:`render-domain:${r}|material:${e||`unknown`}|phase:${t||`unknown`}`}function Wr(e){let t=String(e||``).trim();return t?/^[A-Z][a-z]?$/.test(t)?t:t.toLowerCase():`unknown`}function Gr(e={},t=null){let n=new Map;for(let t of Object.keys(e||{}))n.set(N(t),Wr(t));for(let e of t?.metadata||[]){e.product&&n.set(e.productMaterialId,e.product),e.a&&n.set(e.aMaterialId,e.a),e.b&&n.set(e.bMaterialId,e.b);for(let t of e.productTerms||[])t.material&&Number.isFinite(t.materialId)&&n.set(t.materialId,t.material);for(let t of e.reactantTerms||[])t.material&&Number.isFinite(t.materialId)&&n.set(t.materialId,t.material)}for(let e of t?.productTermMetadata||[])e.material&&Number.isFinite(e.materialId)&&n.set(e.materialId,e.material);for(let e of t?.reactantTermMetadata||[])e.material&&Number.isFinite(e.materialId)&&n.set(e.materialId,e.material);return n}function Kr({material:e,phase:t,temperatureK:n,materialProperties:r}){let i=Te(n);if(i.visible)return[...i.srgb];let a=te({material:e,phase:t,properties:r?.[e]??r?.[String(e).toLowerCase()]??r?.[String(e).toUpperCase()]??null});return a.baseColorSrgb??a.pbr?.baseColorSrgb??[1,1,1]}function qr(e=[]){let t={};for(let n of e||[]){let e=Te(n.temperatureK);if(!e.visible)continue;let r=.2126*e.srgb[0]+.7152*e.srgb[1]+.0722*e.srgb[2],i=[n.material,n.renderKey,Ur(n)].filter(Boolean);for(let e of i){let i=t[e]||(t[e]={t:0,w:0});i.t+=(Number(n.temperatureK)||0)*r,i.w+=r}}let n={};for(let[e,r]of Object.entries(t))n[e]=r.w>0?r.t/r.w:null;return n}function Jr(e=[]){let t={};for(let n of e||[]){let e=Te(n.temperatureK);if(!e.visible)continue;let r=.2126*e.srgb[0]+.7152*e.srgb[1]+.0722*e.srgb[2],i=[n.material,n.renderKey,Ur(n)].filter(Boolean);for(let n of i){let i=t[n]||(t[n]={r:0,g:0,b:0,w:0});i.r+=e.srgb[0]*r,i.g+=e.srgb[1]*r,i.b+=e.srgb[2]*r,i.w+=r}}let n={};for(let[e,r]of Object.entries(t))n[e]=r.w>0?[r.r/r.w,r.g/r.w,r.b/r.w]:null;return n}function Yr(e,{materialProperties:n={},reactionTable:r=null,materialMap:i=Gr(n,r)}={}){if(!(e instanceof Float32Array))throw TypeError(`decodeSphRenderRows requires Float32Array render rows`);if(e.length%jn!==0)throw RangeError(`SPH render rows length must align to the render row stride`);let a=e.length/jn,o=new Float32Array(a*3),s=new Float32Array(a*3),c=new Float32Array(a),l=new Float32Array(a),u=Array(a),d=[];for(let t=0;t<a;t+=1){let r=t*jn,a=e[r+4],f=e[r+5],p=i.get(a)||`unknown`,m=Br(f),h=Vr(p,m),g=e[r+6],_=Math.max(0,Math.round(Q(e[r+11],0))),v=Q(e[r+12],0),y=Q(e[r+13],0),b=Q(e[r+14],1),x=Q(e[r+15],0),S=Hr(_),C=Kr({material:p,phase:m,temperatureK:g,materialProperties:n});o.set([e[r],e[r+1],e[r+2]],t*3),s.set(C,t*3),c[t]=v,l[t]=y;let w={material:p,phase:m,renderKey:h};_>0&&(w.renderDomainId=_,w.renderDomainKey=S),u[t]=w,d.push({index:t,positionM:[e[r],e[r+1],e[r+2]],massKg:e[r+3],materialId:a,material:p,phaseId:f,phase:m,temperatureK:g,status:e[r+7],restDensityKgPerM3:e[r+8],phaseFractionGas:e[r+9],representedEntityCount:e[r+10],renderDomainId:_,renderDomainKey:S,currentVolumeM3:v,particleRadiusM:y,volumeRatioJ:b,pressurePa:x,renderKey:h})}return{schema:t,status:`render-rows-decoded`,particleCount:a,positionsM:o,colorsRgb:s,currentVolumesM3:c,particleRadiiM:l,materials:u,rows:d,emissiveByMaterial:Jr(d),emissiveTemperatureByMaterial:qr(d),scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Xr({particleCount:e,rowProducer:t,maxSupportRadiusM:n=0,maxGasRadiusM:r=0}){return{schema:pr,status:`gpu-row-cap-policy-applied-in-shader`,rowProducer:t,particleCount:e,maxRadiusGrowthRatioAllowed:4,maxVolumeRatioJAllowed:64,maxSupportRadiusSmoothingRatioAllowed:ur,maxSupportRadiusM:Math.max(0,Q(n,0)),maxGasRadiusSmoothingRatioAllowed:dr,maxGasParticleRadiusM:Math.max(0,Q(r,0)),supportRadiusPolicyAppliedInShader:!0,capAppliedCount:null,capAppliedCountKnown:!1,reason:`WebGPU retained render rows apply radius growth, J, support-radius, and gas visual-radius caps in shader without a CPU particle scan`,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Zr(e,t,n,r=0){let i=Math.max(4,n.byteLength);ni(e,t,i),ri(e,t,i);let a=e.createBuffer({label:t,size:i,usage:Z.STORAGE|Z.COPY_DST|r});try{n.byteLength>0&&e.queue.writeBuffer(a,0,n)}catch(e){throw a.destroy?.(),e}return a}function Qr(e,t,n,r=0){let i=Math.max(4,n);return ni(e,t,i),ri(e,t,i),e.createBuffer({label:t,size:i,usage:Z.STORAGE|Z.COPY_DST|r})}function $r(e){let t=Number(e?.limits?.maxBufferSize);return Number.isFinite(t)&&t>0?t:null}function ei(e){let t=Number(e?.limits?.maxStorageBufferBindingSize);return Number.isFinite(t)&&t>0?t:null}function ti(e){let t=Number(e?.limits?.maxComputeWorkgroupsPerDimension);return Number.isSafeInteger(t)&&t>0?t:null}function ni(e,t,n){if(!Number.isSafeInteger(n)||n<=0)throw RangeError(`${t} byte length must be a positive safe integer`);let r=$r(e);if(r!=null&&!(n<=r))throw RangeError(`${t} byte length ${n} exceeds WebGPU device maxBufferSize ${r}`)}function ri(e,t,n){if(!Number.isSafeInteger(n)||n<=0)throw RangeError(`${t} storage binding byte length must be a positive safe integer`);let r=ei(e);if(r!=null&&!(n<=r))throw RangeError(`${t} byte length ${n} exceeds WebGPU device maxStorageBufferBindingSize ${r}`)}function ii(e,t,...n){for(let[e,r]of n.entries())if(!(Number.isSafeInteger(r)&&r>=0))throw RangeError(`${t} workgroup dimension ${e} must be a non-negative safe integer`);let r=ti(e);if(r!=null){for(let[e,i]of n.entries())if(!(i<=r))throw RangeError(`${t} workgroup dimension ${e} (${i}) exceeds WebGPU device maxComputeWorkgroupsPerDimension ${r}`)}}function ai(e,t){if(!Number.isSafeInteger(e)||e<0)throw RangeError(`${t} required byte length must be a non-negative safe integer`);return Math.max(4,e)}function oi(e,t){let n=Number(e);if(!Number.isSafeInteger(n)||n<0)throw RangeError(`${t} must be a non-negative safe integer byte length`);return n}function si(e,t,n,r,{offset:i=0}={}){if(!n)return null;let a=ai(r,t),o=Number(n.size);if(!Number.isSafeInteger(i)||i<0||i%Uint32Array.BYTES_PER_ELEMENT!==0)throw RangeError(`${t} binding offset must be a non-negative four-byte-aligned safe integer`);let s=Number(e?.limits?.minStorageBufferOffsetAlignment);if(i>0&&Number.isSafeInteger(s)&&s>0&&i%s!==0)throw RangeError(`${t} binding offset ${i} is not aligned to WebGPU device minStorageBufferOffsetAlignment ${s}`);if(!Number.isSafeInteger(o)||o<0)throw RangeError(`${t} must expose its exact GPU buffer size`);let c=i+a;if(!Number.isSafeInteger(c)||o<c)throw RangeError(`${t} capacity ${o} is smaller than required binding range ${c}`);return ri(e,t,a),a}function ci(e,t,{offset:n=0,label:r=`WebGPU storage buffer`}={}){let i=ai(t,r);return n>0?{buffer:e,offset:n,size:i}:{buffer:e,size:i}}function li(e=null){return Math.max(0,Math.round(Q(e?.totalFieldCells,0)))*3*Vn*Float32Array.BYTES_PER_ELEMENT}function ui({device:e,candidateRowsByteLength:t,candidateReadbackByteBudget:n=Un}={}){let r=Math.max(4,Math.round(Q(t,0))),i=Math.max(0,Math.round(Q(n,Un)));if(i>0&&r>i)return{status:`candidate-readback-budget-exceeded`,reason:`material-interface candidate rows byte length ${r} exceeds readback budget ${i}`,byteLength:r,budget:i};let a=$r(e);if(a!=null&&r>a)return{status:`candidate-readback-max-buffer-size-exceeded`,reason:`material-interface candidate rows byte length ${r} exceeds WebGPU device maxBufferSize ${a}`,byteLength:r,maxBufferSize:a};let o=ei(e);return o!=null&&r>o?{status:`candidate-readback-max-storage-binding-size-exceeded`,reason:`material-interface candidate rows byte length ${r} exceeds WebGPU device maxStorageBufferBindingSize ${o}`,byteLength:r,maxStorageBufferBindingSize:o}:null}function di({sourceField:e,sourceRenderField:t,resolvedFieldRowsBuffer:n,resolvedSurfaceBuffer:r,source:i,sourceCadence:a,candidateRowsByteLength:o,candidateReadbackByteBudget:c,candidateReadbackBlocker:l,candidateReadbackMode:u,compactCandidateField:d=null}){let f={schema:D,status:`material-interface-field-candidate-readback-skipped`,reason:l.reason,backend:`webgpu-candidate-readback-skipped`,authority:`resident-physics-material-interface-extractor`,source:i,sourceCadence:a,sourceFieldSchema:e?.schema??null,sourceFieldStatus:e?.status??null,sourceFieldBackend:e?.backend??null,sourceFieldPipelineCacheStatus:e?.sourceRenderFieldPipelineCacheStatus??e?.pipelineCacheStatus??null,sourceRenderFieldSchema:t?.schema??null,sourceRenderFieldBackend:t?.backend??null,sourceRenderFieldPipelineCacheStatus:t?.pipelineCacheStatus??e?.sourceRenderFieldPipelineCacheStatus??null,sourceRenderFieldReadback:!!t?.renderFieldReadback,sourceFieldRowsBufferBound:!!n,sourceSurfaceBufferBound:!!r,surfaceCount:t?.surfaceCount??0,readySurfaceCount:0,totalSurfaceAreaM2:0,candidateCount:Math.max(0,Math.round(Q(t?.totalFieldCells,0)))*3,activeCandidateCount:0,candidateBackend:d?.backend??null,candidateReadback:!1,candidateReadbackMode:u,candidateRowsByteLength:o,candidateReadbackByteBudget:c,candidateReadbackBlockerStatus:l.status,candidateReadbackBlocker:l,candidateCompactStatus:d?.status??null,candidateCompactOverflowCount:d?.compactCandidateOverflowCount??0,candidateCompactCapacity:d?.compactCandidateCapacity??null,elementCount:0,elementLayout:[...s],elementStrideFloats:Hn,elementRows:new Float32Array,elements:[],forceCouplingStatus:`blocked-material-interface-candidate-readback-skipped`,surfaces:[],queueCompletionStatus:`not-submitted-candidate-readback-skipped`,queueCompletionMethod:null,normalDerivation:`candidate-readback-skipped-budget-or-device-limit`,surfaceAreaDerivation:`candidate-readback-skipped-budget-or-device-limit`,physicsStage:`material-interface-extraction`,pressureInterfaceProducer:!1,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1};return d?.interfaceSourceKeyBuffer&&(f.interfaceSourceKeyBuffer=d.interfaceSourceKeyBuffer,f.interfaceSourceKeyBufferRetained=!!d.interfaceSourceKeyBufferRetained,f.interfaceSourceKeyBufferByteLength=d.interfaceSourceKeyBufferByteLength??0),typeof d?.destroyMaterialInterfaceCandidateFieldBuffers==`function`&&(f.destroyMaterialInterfaceFieldBuffers=({reason:e=`skipped-material-interface-field-buffer-cleanup`}={})=>d.destroyMaterialInterfaceCandidateFieldBuffers({reason:e})),f}function fi({sourceField:e,sourceRenderField:t,resolvedFieldRowsBuffer:n,resolvedSurfaceBuffer:r,source:i,sourceCadence:a,candidateRowsByteLength:o,candidateReadbackByteBudget:c,candidateReadbackMode:l,compactCandidateCapacity:u=null}){let d=t?.surfaceTable?.surfaceCount??t?.surfaceCount??0,f=Math.max(0,Math.round(Q(t?.totalFieldCells,0)))*3,p=zi({candidateCount:f,surfaceCount:d,compactCandidateCapacity:u}),m=p*Vn*Float32Array.BYTES_PER_ELEMENT;return{schema:D,status:`material-interface-field-gpu-resident-summary-pending`,reason:`candidate rows remain GPU-resident; CPU material-interface elements require compact readback or a GPU pressure consumer`,backend:`webgpu-gpu-resident-summary`,authority:`resident-physics-material-interface-extractor`,source:i,sourceCadence:a,sourceFieldSchema:e?.schema??null,sourceFieldStatus:e?.status??null,sourceFieldBackend:e?.backend??null,sourceFieldPipelineCacheStatus:e?.sourceRenderFieldPipelineCacheStatus??e?.pipelineCacheStatus??null,sourceRenderFieldSchema:t?.schema??null,sourceRenderFieldBackend:t?.backend??null,sourceRenderFieldPipelineCacheStatus:t?.pipelineCacheStatus??e?.sourceRenderFieldPipelineCacheStatus??null,sourceRenderFieldReadback:!!t?.renderFieldReadback,sourceFieldRowsBufferBound:!!n,sourceSurfaceBufferBound:!!r,surfaceCount:d,readySurfaceCount:0,totalSurfaceAreaM2:0,candidateCount:f,activeCandidateCount:0,activeCandidateCountPending:!0,candidateBackend:`gpu-resident-summary`,candidateReadback:!1,candidateReadbackMode:l,candidateRowsByteLength:o,candidateDenseRowsByteLength:o,candidateCompactRowsByteLength:m,candidateCompactCapacity:p,candidateCompactOverflowCount:0,candidateCompactFallbackStatus:null,candidateMetadataReadback:!1,candidateReadbackByteBudget:c,candidatePipelineCacheStatus:null,elementCount:0,elementLayout:[...s],elementStrideFloats:Hn,elementRows:new Float32Array,elements:[],forceCouplingStatus:`blocked-gpu-resident-pressure-interface-consumer-required`,surfaces:[],queueCompletionStatus:`not-submitted-gpu-resident-summary`,queueCompletionMethod:null,normalDerivation:`gpu-resident-candidate-summary-pending`,surfaceAreaDerivation:`gpu-resident-candidate-summary-pending`,physicsStage:`material-interface-extraction`,pressureInterfaceProducer:!1,gpuAuthoritativeState:!0,gpuResidentMaterialInterfaceSummary:!0,gpuResidentMaterialInterfaceSummaryPending:!0,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1}}function pi({particleCount:e,renderDomainBaseCount:t=0,renderDomainDropCount:n=0,hasMechanics:r=!1,maxSupportRadiusM:i=0,maxGasRadiusM:a=0,materialBankParticleSizeRowCount:o=0}={}){let s=new ArrayBuffer(fr),c=new DataView(s);return c.setUint32(0,e,!0),c.setUint32(4,Math.max(0,Math.round(Q(t,0))),!0),c.setUint32(8,Math.max(0,Math.round(Q(n,0))),!0),c.setUint32(12,+!!r,!0),c.setFloat32(16,Math.max(0,Q(i,0)),!0),c.setFloat32(20,Math.max(0,Q(a,0)),!0),c.setUint32(24,Math.max(0,Math.round(Q(o,0))),!0),s}function mi({rowCount:e=0,bufferSource:t=`none`}={}){let n=Math.max(0,Math.round(Q(e,0)));return{schema:mr,status:n>0?`shader-bound-material-bank-particle-size-rows`:`no-material-bank-particle-size-rows`,rowCount:n,shaderBinding:5,bufferSource:n>0?t:`none`,consumer:`sph-render-rows-wgsl`,consumedAs:`non-authoritative-role-rest-volume-seed-before-mechanics`,strictSourceOfTruth:!1,mechanicsOverridePreserved:!0,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function hi({particleCount:e,productEventCount:t=0,surfaceCount:n,totalFieldCells:r,fieldPadding:i,refEdgeM:a,renderSmearDtS:o=0,dispersedMediumOpticsEnabled:s=!1}){let c=new ArrayBuffer(32),l=new DataView(c);return l.setUint32(0,e,!0),l.setUint32(4,n,!0),l.setUint32(8,r,!0),l.setUint32(12,t,!0),l.setFloat32(16,i,!0),l.setFloat32(20,a,!0),l.setFloat32(24,Math.max(0,Number(o)||0),!0),l.setUint32(28,+!!s,!0),c}function gi(e=null){let t=new Uint32Array(8);return e?(t[0]=1,t[1]=e.expectedMagic,t[2]=e.expectedVersion,t[3]=e.expectedReadyStatus,t[4]=e.expectedGeneration,t[5]=e.expectedSeal,t[6]=e.expectedRowCapacity,t[7]=e.expectedRowStrideVec4,t):t}function _i({surfaceCount:e,totalFieldCells:t,candidateCount:n,fieldPadding:r,refEdgeM:i,isolationScale:a,sourceKeyEnabled:o=!1}){let s=new ArrayBuffer(32),c=new DataView(s);return c.setUint32(0,e,!0),c.setUint32(4,t,!0),c.setUint32(8,n,!0),c.setUint32(12,+!!o,!0),c.setFloat32(16,r,!0),c.setFloat32(20,i,!0),c.setFloat32(24,a,!0),c.setFloat32(28,0,!0),s}function vi({surfaceCount:e,totalFieldCells:t,maxVertexRows:n,emissionModeId:r=0,fieldPadding:i,refEdgeM:a,isolationScale:o}){let s=new ArrayBuffer(32),c=new DataView(s);return c.setUint32(0,e,!0),c.setUint32(4,n,!0),c.setUint32(8,t,!0),c.setUint32(12,r,!0),c.setFloat32(16,i,!0),c.setFloat32(20,a,!0),c.setFloat32(24,o,!0),c.setFloat32(28,0,!0),s}function yi({surfaceCount:e,totalFieldCells:t,fieldPadding:n,refEdgeM:r,isolationScale:i}){let a=new ArrayBuffer(32),o=new DataView(a);return o.setUint32(0,e,!0),o.setUint32(4,t,!0),o.setUint32(8,0,!0),o.setUint32(12,0,!0),o.setFloat32(16,n,!0),o.setFloat32(20,r,!0),o.setFloat32(24,i,!0),o.setFloat32(28,0,!0),a}function bi({surfaceCount:e,sourceVertexRowCount:t,maxCompactVertexRows:n,sourceVertexCounterMode:r=0}){let i=new ArrayBuffer(16),a=new DataView(i);return a.setUint32(0,e,!0),a.setUint32(4,t,!0),a.setUint32(8,n,!0),a.setUint32(12,r,!0),i}async function xi(e,t,n,r=`ulg-sph-render-readback`){ni(e,r,Math.max(4,n));let i=e.createBuffer({label:r,size:Math.max(4,n),usage:Z.MAP_READ|Z.COPY_DST}),a=!1;try{let r=e.createCommandEncoder();return r.copyBufferToBuffer(t,0,i,0,n),e.queue.submit([r.finish()]),await i.mapAsync(Tr.READ),a=!0,i.getMappedRange().slice(0)}finally{a&&i.unmap(),i.destroy?.()}}function Si(){return{min:[1/0,1/0,1/0],max:[-1/0,-1/0,-1/0]}}function Ci(e){return e&&e.min.every(Number.isFinite)&&e.max.every(Number.isFinite)?{min:[...e.min],max:[...e.max]}:null}function wi(e,t){for(let n=0;n<3;n+=1){let r=Q(t?.[n],NaN);Number.isFinite(r)&&(e.min[n]=Math.min(e.min[n],r),e.max[n]=Math.max(e.max[n],r))}}function Ti(e,t){return`${Math.round(Q(e,0))}:${Math.round(Q(t,0))}`}function Ei({state:e,thermo:t,particleCount:n,maxSampleRows:r=8}={}){let i=Si(),a={},o=[],s=0,c=0,l=0,u=0,d=1/0,f=-1/0;for(let p=0;p<n;p+=1){let n=p*de,m=p*W,h=[Q(e?.[n],NaN),Q(e?.[n+1],NaN),Q(e?.[n+2],NaN)],g=Q(e?.[n+3],0),_=Q(t?.[m],0),v=Q(t?.[m+1],0),y=Q(t?.[m+2],NaN),b=Q(t?.[m+10],0);h.every(Number.isFinite)&&(s+=1,wi(i,h),h.every(e=>Math.abs(e)<=1e-12)&&(c+=1)),g>0&&(l+=1,u+=g),Number.isFinite(y)&&(d=Math.min(d,y),f=Math.max(f,y));let x=Ti(_,v);a[x]=(a[x]||0)+1,o.length<r&&o.push({index:p,positionM:h,massKg:g,materialId:_,phaseId:v,temperatureK:Number.isFinite(y)?y:null,status:b})}return{particleCount:n,finitePositionCount:s,zeroPositionCount:c,positiveMassCount:l,totalMassKg:u,boundsM:Ci(i),minTemperatureK:Number.isFinite(d)?d:null,maxTemperatureK:Number.isFinite(f)?f:null,materialPhaseCounts:a,sampleRows:o}}function Di(e,{maxSampleRows:t=8}={}){let n=e instanceof Float32Array?Math.floor(e.length/jn):0,r=Si(),i={},a=[],o=0,s=0,c=0,l=0,u=1/0,d=-1/0,f=1/0,p=-1/0;for(let m=0;m<n;m+=1){let n=m*jn,h=[Q(e[n],NaN),Q(e[n+1],NaN),Q(e[n+2],NaN)],g=Q(e[n+3],0),_=Q(e[n+4],0),v=Q(e[n+5],0),y=Q(e[n+6],NaN),b=Q(e[n+7],0),x=Q(e[n+13],NaN);h.every(Number.isFinite)&&(o+=1,wi(r,h),h.every(e=>Math.abs(e)<=1e-12)&&(s+=1)),g>0&&(c+=1,l+=g),Number.isFinite(y)&&(u=Math.min(u,y),d=Math.max(d,y)),Number.isFinite(x)&&x>0&&(f=Math.min(f,x),p=Math.max(p,x));let S=Ti(_,v);i[S]=(i[S]||0)+1,a.length<t&&a.push({index:m,positionM:h,massKg:g,materialId:_,phaseId:v,temperatureK:Number.isFinite(y)?y:null,status:b,particleRadiusM:Number.isFinite(x)?x:null})}return{particleCount:n,finitePositionCount:o,zeroPositionCount:s,positiveMassCount:c,totalMassKg:l,boundsM:Ci(r),minTemperatureK:Number.isFinite(u)?u:null,maxTemperatureK:Number.isFinite(d)?d:null,minParticleRadiusM:Number.isFinite(f)?f:null,maxParticleRadiusM:Number.isFinite(p)?p:null,materialPhaseCounts:i,sampleRows:a}}async function Oi({device:e,sphParticleState:t,sphParticleUpload:n=null,sourceStateBuffer:r=null,sourceThermoBuffer:i=null,renderDomainBaseCount:a=0,renderDomainDropCount:o=0,includeRenderRows:s=!0,maxSampleRows:c=8}={}){if(Dr(t),!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`summarizeSphResidentParticleUploadWebGpu requires a WebGPU-like device`);let l=r||n?.stateBuffer||null,u=i||n?.thermoBuffer||null;if(!l||!u)return{schema:`peercompute.ulg.sph-resident-particle-upload-debug.v0`,status:`resident-particle-upload-debug-source-unavailable`,reason:`retained state and thermo buffers are required`,particleCount:t.particleCount,uploadStatus:n?.status??null,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};let d=Math.max(0,Math.round(Q(t.particleCount,0))),f=d*de*Float32Array.BYTES_PER_ELEMENT,p=d*W*Float32Array.BYTES_PER_ELEMENT,[m,h]=await Promise.all([xi(e,l,f,`ulg-sph-resident-debug-state-readback`),xi(e,u,p,`ulg-sph-resident-debug-thermo-readback`)]),g=Ei({state:new Float32Array(m).slice(0,d*de),thermo:new Float32Array(h).slice(0,d*W),particleCount:d,maxSampleRows:c}),_=null,v=null;if(s)try{_=Di((await oa({device:e,sphParticleState:t,sphParticleUpload:n,sourceStateBuffer:l,sourceThermoBuffer:u,readbackMode:_r,renderDomainBaseCount:a,renderDomainDropCount:o})).renderRows,{maxSampleRows:c})}catch(e){v=e instanceof Error?e.message:String(e)}return{schema:`peercompute.ulg.sph-resident-particle-upload-debug.v0`,status:v?`resident-particle-upload-debug-render-rows-error`:`resident-particle-upload-debug-ready`,uploadStatus:n?.status??null,sourceStep:n?.step??t.step??null,sourceTime:n?.time??t.time??null,particleCount:d,readbackByteLength:f+p,stateBufferLabel:l?.label??null,thermoBufferLabel:u?.label??null,particleRows:g,renderRows:_,renderRowsError:v,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function ki(e=[],{defaultResolution:t=32,defaultIsolation:n=80,defaultSubtract:r=24}={}){if(!Array.isArray(e))throw TypeError(`surfaceDescriptors must be an array`);let i=new Float32Array(e.length*Mn),a=[],o=0,s=0;return e.forEach((e,c)=>{let u=Nr(Math.max(4,Math.round(Q(e.resolution,t))),`surfaceDescriptors[${c}].resolution`,{min:4}),d=Nr(u**3,`surfaceDescriptors[${c}].fieldCellCount`,{min:1});o=Nr(o,`surfaceDescriptors[${c}].fieldOffset`);let f=Q(e.isolation,n),p=Math.max(1e-12,Q(e.subtract,r)),m=Ir(Q(e.radiusNorm,.05),.001,.5),h=Number.isFinite(e.strength)?e.strength:(f+p)*m*m,g=Array.isArray(e.colorLinear)||ArrayBuffer.isView(e.colorLinear)?e.colorLinear:[1,1,1],_=Mr(e.materialId??(e.material?N(e.material):0),`surfaceDescriptors[${c}].materialId`),v=Mr(e.phaseId??(e.phase?k(e.phase):l.unknown),`surfaceDescriptors[${c}].phaseId`),y=Mr(e.renderDomainId??0,`surfaceDescriptors[${c}].renderDomainId`),x=e.opticalState||null,S=Mr(e.opticalStateId??b(x),`surfaceDescriptors[${c}].opticalStateId`),C=S>0;if((e.collectiveOpticalRoute===!0||e.collectiveOpticalRouteSchema)&&!C)throw RangeError(`surfaceDescriptors[${c}] collective optical route requires a positive opticalStateId`);for(let[t,n]of[[`collectiveOpticalRouteId`,e.collectiveOpticalRouteId],[`routeId`,e.routeId]])if(n!=null&&Number(n)!==S)throw RangeError(`surfaceDescriptors[${c}].${t} contradicts opticalStateId`);let T=e.opticalStateKey??w(x),E=c*Mn;i.set([_,v,o,d,u,f,p,h,Math.max(0,Q(e.particleRadiusScale,0))>0?-Math.max(0,Q(e.particleRadiusScale,0)):m,Ir(Q(g[0],1),0,1),Ir(Q(g[1],1),0,1),Ir(Q(g[2],1),0,1),y,S,Number.isFinite(Number(e.transparencyClassId))?Number(e.transparencyClassId):-1,Number.isFinite(Number(e.depthWriteFlag))?Number(e.depthWriteFlag):-1],E);let D=i.subarray(E,E+Mn),O=D[8]<0?-D[8]:0,A=Ki({...e,index:c,phaseId:v}),j={index:c,surfaceKey:e.surfaceKey??`${_}|${v}`,material:e.material??null,phase:e.phase??null,renderKey:e.renderKey??e.material??null,opticalState:x?{...x}:null,opticalStateKey:T,opticalStateId:D[13],surfaceIdentityKey:e.surfaceIdentityKey??(C?e.surfaceKey??null:null),collectiveOpticalRoute:C,collectiveOpticalRouteSchema:C?e.collectiveOpticalRouteSchema??e.schema??null:null,collectiveOpticalRouteKey:e.collectiveOpticalRouteKey??e.routeKey??e.surfaceIdentityKey??(C?e.surfaceKey:null)??null,collectiveOpticalRouteId:C?D[13]:null,opticalResponseAuthorityFlag:+(Q(e.opticalResponseAuthorityFlag,0)>0),opticalResponseAuthority:e.opticalResponseAuthority??null,opticalResponseReady:e.opticalResponseReady===!0,opticalVisibilityFlag:+(Q(e.opticalVisibilityFlag,1)>0),opticalVisibilityReason:e.opticalVisibilityReason??null,opticalOpacity:e.opticalOpacity!=null&&Number.isFinite(Number(e.opticalOpacity))?Ir(Number(e.opticalOpacity),0,1):null,opticalEffectiveOpacity:e.opticalEffectiveOpacity!=null&&Number.isFinite(Number(e.opticalEffectiveOpacity))?Ir(Number(e.opticalEffectiveOpacity),0,1):null,opticalDepth:e.opticalDepth!=null&&Number.isFinite(Number(e.opticalDepth))?Math.max(0,Number(e.opticalDepth)):null,opticalScatteringCoefficientPerM:e.opticalScatteringCoefficientPerM!=null&&Number.isFinite(Number(e.opticalScatteringCoefficientPerM))?Math.max(0,Number(e.opticalScatteringCoefficientPerM)):null,opticalTransmission:e.opticalTransmission!=null&&Number.isFinite(Number(e.opticalTransmission))?Ir(Number(e.opticalTransmission),0,1):null,opticalRoughness:e.opticalRoughness!=null&&Number.isFinite(Number(e.opticalRoughness))?Ir(Number(e.opticalRoughness),0,1):null,opticalBlockedFlag:+(Q(e.opticalBlockedFlag,0)>0),opticalProvenanceSource:e.opticalProvenanceSource??null,renderDomainId:D[12],renderDomainKey:e.renderDomainKey??Hr(e.renderDomainId),renderLayer:e.renderLayer??A.renderLayer,renderOrder:A.renderOrder,transparencyClassId:A.transparencyClassId,depthWriteFlag:A.depthWriteFlag,emissiveTemperatureK:Math.max(0,Q(e.emissiveTemperatureK,0)),materialId:D[0],phaseId:D[1],fieldOffset:D[2],fieldCellCount:D[3],resolution:D[4],isolation:D[5],subtract:D[6],strength:D[7],radiusNorm:m,particleRadiusScale:O,particleRadiusPolicyStatus:e.particleRadiusPolicyStatus??null,particleRadiusPolicyMode:e.particleRadiusPolicyMode??null,particleRadiusContinuityFloorEligible:e.particleRadiusContinuityFloorEligible===!0,particleRadiusContinuityFloorApplied:e.particleRadiusContinuityFloorApplied===!0,particleRadiusScaleRequested:e.particleRadiusScaleRequested??null,particleRadiusContinuityFloorScale:e.particleRadiusContinuityFloorScale??null,particleRadiusContinuityFloorScaleUnbounded:e.particleRadiusContinuityFloorScaleUnbounded??null,particleRadiusContinuityRepresentativeRadiusM:e.particleRadiusContinuityRepresentativeRadiusM??null,particleRadiusContinuitySmoothingLengthM:e.particleRadiusContinuitySmoothingLengthM??null,particleRadiusContinuitySupportMultiplier:e.particleRadiusContinuitySupportMultiplier??null,particleRadiusContinuitySupportTargetIsoradiusM:e.particleRadiusContinuitySupportTargetIsoradiusM??null,particleRadiusContinuitySamplingCellSizeM:e.particleRadiusContinuitySamplingCellSizeM??null,particleRadiusContinuitySamplingMarginM:e.particleRadiusContinuitySamplingMarginM??null,particleRadiusContinuityTargetIsoradiusM:e.particleRadiusContinuityTargetIsoradiusM??null,particleRadiusFloorNorm:O>0?Math.sqrt(.75/(u*u)+1e-6):0,colorLinear:[D[9],D[10],D[11]],status:Q(e.status,1)};a.push(j),o=Nr(o+d,`surfaceDescriptors[${c}].nextFieldOffset`),s=Math.max(s,d)}),{schema:g,status:`render-field-surface-table-built`,surfaceCount:e.length,rowLayout:[...P],rowStrideFloats:Mn,records:i,metadata:a,totalFieldCells:o,maxFieldCellCount:s,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Ai(e){if(e?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`||!(e.records instanceof Float32Array)||!Array.isArray(e.metadata)||!Number.isSafeInteger(e.surfaceCount)||e.surfaceCount!==e.metadata.length||e.records.length!==e.surfaceCount*Mn)throw TypeError(`SPH render field requires a render-field surface table`);let t=0,n=0;for(let r=0;r<e.surfaceCount;r+=1){let i=e.metadata[r];if(Pr(i?.index,`surfaceTable.metadata[${r}].index`)!==r)throw RangeError(`render surface metadata index ${i?.index} does not match array index ${r}`);let a=r*Mn,o=e.records.subarray(a,a+Mn);if(o.some(e=>!Number.isFinite(e)))throw RangeError(`render surface ${r} contains a non-finite encoded lane`);let s=Nr(i?.resolution,`surfaceTable.metadata[${r}].resolution`,{min:4}),c=Nr(i?.fieldCellCount,`surfaceTable.metadata[${r}].fieldCellCount`,{min:1}),l=Nr(i?.fieldOffset,`surfaceTable.metadata[${r}].fieldOffset`);if(c!==s**3||l!==t)throw RangeError(`render surface ${r} has inconsistent field geometry`);let u=i.particleRadiusScale>0?-i.particleRadiusScale:i.radiusNorm;if([i.materialId,i.phaseId,l,c,s,i.isolation,i.subtract,i.strength,u,i.colorLinear?.[0],i.colorLinear?.[1],i.colorLinear?.[2],i.renderDomainId,i.opticalStateId].some((e,t)=>!Number.isFinite(Number(e))||!Object.is(o[t],Math.fround(Number(e)))))throw RangeError(`render surface ${r} metadata does not match its encoded routing/geometry lanes`);let d=o[14]>=0?o[14]:Gi(o[1]),f=o[15]>=0?o[15]:d>0?0:1;if(Math.fround(Number(i.transparencyClassId))!==Math.fround(d)||Math.fround(Number(i.depthWriteFlag))!==Math.fround(f))throw RangeError(`render surface ${r} metadata does not match its encoded render policy`);t=Nr(t+c,`surfaceTable.metadata[${r}].nextFieldOffset`),n=Math.max(n,c)}if(e.totalFieldCells!==t||e.maxFieldCellCount!==n)throw RangeError(`render surface table aggregate geometry is inconsistent`)}function ji(e,t){let n=e[t],r=e[t+1],i=e[t+2],o=e[t+3],s=e[t+4],c=e[t+5],l=e[t+6],u=e[t+7];return o===a.ready&&Number.isFinite(n)&&Number.isSafeInteger(n)&&n>=0&&n<=Er&&Number.isFinite(r)&&Number.isSafeInteger(r)&&r>=0&&r<=Er&&Number.isFinite(i)&&Number.isSafeInteger(i)&&i>0&&i<=Er&&Number.isFinite(s)&&s>=0&&Number.isFinite(c)&&c>=0&&Number.isFinite(l)&&l>=0&&Number.isFinite(u)&&Math.abs(u)<=c}function Mi(e,t){if(e==null)return null;if(!(e instanceof Float32Array))throw TypeError(`dispersed-medium optics rows must be a Float32Array`);let n=t*8;if(e.length!==n)throw RangeError(`dispersed-medium optics rows must contain exactly ${t} particle-aligned rows`);let r=new Set;for(let n=0;n<t;n+=1){let t=n*8;if(e[t+3]===a.blocked){for(let r=0;r<8;r+=1)if(r!==3&&e[t+r]!==0)throw RangeError(`dispersed-medium blocked row ${n} must have zero data lanes`);continue}if(!ji(e,t))throw RangeError(`dispersed-medium row ${n} is neither canonical ready nor canonical blocked`);r.add(e[t+2])}return r}function Ni(e,t=[]){let n=new Map;for(let[t,r]of e.metadata.entries()){let e=Mr(r.opticalStateId??0,`surfaceTable.metadata[${t}].opticalStateId`);if(e!==0){if(n.has(e))throw RangeError(`dispersed-medium opticalStateId ${e} routes to more than one render surface`);n.set(e,t)}}for(let r of t){if(!n.has(r)){let t=e.metadata.map(e=>`${e?.material??`?`}/${e?.phase??`?`}=${e?.opticalStateId??0}`).slice(0,12).join(`, `);throw RangeError(`ready dispersed-medium opticalStateId ${r} has no render surface route (routed: ${t})`)}let t=e.metadata[n.get(r)],i=Math.fround(Number(t?.isolation));if(!(i>=Kn)||!Number.isFinite(i))throw RangeError(`ready dispersed-medium opticalStateId ${r} requires a positive finite f32 isolation threshold outside the denormal range`)}return n}function Pi(e,t,n,r){let i=new Set(r),a=Math.fround(1-Math.fround(2*t));for(let t of e.metadata){if(!i.has(t.opticalStateId))continue;let e=Math.fround(a*Math.fround(t.resolution));if(!(Math.fround(e/n)>=qn))throw RangeError(`dispersed-medium cell scale enters the implementation-defined f32 denormal range`)}}function Fi(e){if(e?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`||!(e.fieldRows instanceof Float32Array))throw TypeError(`splitSphRenderFieldBySurface requires an SPH render field`);return e.surfaceTable.metadata.map(t=>{let n=new Float32Array(t.fieldCellCount),r=new Float32Array(t.fieldCellCount*3);for(let i=0;i<t.fieldCellCount;i+=1){let a=(t.fieldOffset+i)*Nn;n[i]=e.fieldRows[a],r[i*3]=e.fieldRows[a+1],r[i*3+1]=e.fieldRows[a+2],r[i*3+2]=e.fieldRows[a+3]}return{...t,field:n,palette:r}})}function Ii(e){let t=Math.hypot(e[0],e[1],e[2]);return t>0?[e[0]/t,e[1]/t,e[2]/t]:[0,0,0]}function Li(e,t,n=1){let r=e.surfaceTable?.metadata||[],i=Array(r.length).fill(0),a=t.length/Vn;for(let e=0;e<a;e+=1){let n=e*Vn;if(!(t[n+15]>0))continue;let r=Math.round(t[n]);r>=0&&r<i.length&&(i[r]+=1)}return r.map(t=>{let r=t.isolation*Q(n,1),a=0;for(let n=0;n<t.fieldCellCount;n+=1){let i=(t.fieldOffset+n)*Nn;e.fieldRows?.[i]>=r&&(a+=1)}let o=i[t.index]||0;return{surfaceKey:t.surfaceKey,material:t.material,phase:t.phase,renderKey:t.renderKey,materialId:t.materialId,phaseId:t.phaseId,opticalStateKey:t.opticalStateKey||`default`,resolution:t.resolution,isolation:r,activeCellCount:a,candidateOffset:t.fieldOffset*3,candidateCount:t.fieldCellCount*3,activeCandidateCount:o,status:o>0?`interface-candidates-active`:a>0?`interface-candidates-active-without-crossing`:`interface-candidates-empty`}})}async function Ri({device:e,renderField:t,fieldRowsBuffer:n=null,surfaceBuffer:r=null,isolationScale:a=1}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphMaterialInterfaceCandidateFieldWebGpu requires a WebGPU-like device`);if(t?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)throw TypeError(`buildSphMaterialInterfaceCandidateFieldWebGpu requires an SPH render field`);if(!n&&!(t.fieldRows instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceCandidateFieldWebGpu requires fieldRows or fieldRowsBuffer`);if(!r&&!(t.surfaceTable?.records instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceCandidateFieldWebGpu requires surface table records or surfaceBuffer`);let s=t.surfaceTable?.surfaceCount??t.surfaceCount??0,c=t.totalFieldCells??0,l=c*3,u=l*Vn*Float32Array.BYTES_PER_ELEMENT,d=c*Nn*Float32Array.BYTES_PER_ELEMENT,f=s*Mn*Float32Array.BYTES_PER_ELEMENT,p=Math.ceil(Math.max(1,(t.maxFieldCellCount||0)*3)/64),m=Math.max(1,s);ii(e,`material-interface candidates`,p,m),ni(e,`ulg-sph-interface-candidates`,Math.max(4,u)),ni(e,`ulg-sph-interface-candidate-readback`,Math.max(4,u)),ri(e,`ulg-sph-interface-candidates`,Math.max(4,u));let h=n||null,g=r||null;si(e,`material-interface source render field`,h,d),si(e,`material-interface render surfaces`,g,f);let _=h||Zr(e,`ulg-sph-interface-source-render-field`,t.fieldRows,Z.COPY_SRC),v=g||Zr(e,`ulg-sph-interface-render-surfaces`,t.surfaceTable.records),y=e.createBuffer({label:`ulg-sph-interface-candidates`,size:Math.max(4,u),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST}),b=e.createBuffer({label:`ulg-sph-interface-candidate-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(b,0,_i({surfaceCount:s,totalFieldCells:c,candidateCount:l,fieldPadding:Q(t.fieldPadding,.22),refEdgeM:Q(t.refEdgeM,10),isolationScale:Q(a,1)}));let{pipeline:x,bindGroupLayout:S}=he(e,{label:`ulg-sph-interface-candidates`,module:e.createShaderModule({label:`ulg-sph-interface-candidates`,code:i}),entryPoint:`main`,bindings:[G(0,`read-only-storage`),G(1,`read-only-storage`),G(2,`storage`),G(3,`uniform`)]}),C=pe(e,{layout:S,entries:[{binding:0,resource:ci(v,f,{label:`material-interface render surfaces`})},{binding:1,resource:ci(_,d,{label:`material-interface source render field`})},{binding:2,resource:ci(y,u,{label:`material-interface candidates`})},{binding:3,resource:{buffer:b}}]}),w=e.createCommandEncoder(),T=w.beginComputePass();T.setPipeline(x),T.setBindGroup(0,C),T.dispatchWorkgroups(p,m),T.end();let E=`queue-submitted`,D=`queue.submit`;e.queue.submit([w.finish()]);let O=await xi(e,y,u,`ulg-sph-interface-candidate-readback`);E=`readback-map-completed`,D=`mapAsync(readback-buffer)`;let k=new Float32Array(O);h||_.destroy?.(),g||v.destroy?.(),y.destroy?.(),b.destroy?.();let j=Li(t,k,a),M=j.reduce((e,t)=>e+t.activeCandidateCount,0);return{schema:A,backend:`webgpu`,status:M>0?`material-interface-candidate-field-ready`:`material-interface-candidate-field-empty`,sourceSchema:t.schema,sourceBackend:t.backend,surfaceCount:s,totalFieldCells:c,candidateCount:l,activeCandidateCount:M,rowLayout:[...o],rowStrideFloats:Vn,candidateRows:k,candidateRowByteLength:k.byteLength,candidateShape:`fixed-render-field-cell-axis-triplets`,surfaces:j,fieldRowsBufferBound:!!h,surfaceBufferBound:!!g,queueCompletionStatus:E,queueCompletionMethod:D,candidateReadback:!0,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1}}function zi({candidateCount:e,surfaceCount:t,compactCandidateCapacity:n=null}){let r=Math.round(Q(n,0));if(r>0)return Math.max(1,Math.min(e,r));let i=Math.max(Wn,Math.max(1,Math.round(Q(t,0)))*8192);return Math.max(1,Math.min(e,i))}function Bi(e=null){if(!(e instanceof Float32Array)||e.length<=0)return 0;let t=0;for(let n=0;n+2<e.length;n+=Bn)(e[n+2]||0)>0&&(t+=1);return t}async function Vi({device:e,renderField:t,fieldRowsBuffer:n=null,surfaceBuffer:r=null,sourceIndexFieldBuffer:i=null,isolationScale:a=1,compactCandidateCapacity:s=null}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires a WebGPU-like device`);if(t?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)throw TypeError(`buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires an SPH render field`);if(!n&&!(t.fieldRows instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires fieldRows or fieldRowsBuffer`);if(!r&&!(t.surfaceTable?.records instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires surface table records or surfaceBuffer`);let c=t.surfaceTable?.surfaceCount??t.surfaceCount??0,l=t.totalFieldCells??0,u=l*3,d=u*Vn*Float32Array.BYTES_PER_ELEMENT,f=zi({candidateCount:u,surfaceCount:c,compactCandidateCapacity:s}),p=f*Vn*Float32Array.BYTES_PER_ELEMENT,m=f*Bn*Float32Array.BYTES_PER_ELEMENT,g=l*Nn*Float32Array.BYTES_PER_ELEMENT,_=c*Mn*Float32Array.BYTES_PER_ELEMENT,v=Math.max(1,l)*Uint32Array.BYTES_PER_ELEMENT,y=Math.ceil(Math.max(1,(t.maxFieldCellCount||0)*3)/64),b=Math.max(1,c);ii(e,`compact material-interface candidates`,y,b),ni(e,`ulg-sph-interface-compact-candidates`,Math.max(4,p)),ri(e,`ulg-sph-interface-compact-candidates`,Math.max(4,p)),ni(e,`ulg-sph-interface-source-keys`,Math.max(4,m)),ri(e,`ulg-sph-interface-source-keys`,Math.max(4,m)),ni(e,`ulg-sph-interface-compact-metadata`,16),ri(e,`ulg-sph-interface-compact-metadata`,16);let x=n||null,S=r||null,w=i||t.sourceIndexFieldBuffer||null,T=!!w;si(e,`compact material-interface source render field`,x,g),si(e,`compact material-interface render surfaces`,S,_),si(e,`compact material-interface source-index field`,w,v);let E=x||Zr(e,`ulg-sph-interface-source-render-field`,t.fieldRows,Z.COPY_SRC),D=S||Zr(e,`ulg-sph-interface-render-surfaces`,t.surfaceTable.records),O=w||Qr(e,`ulg-sph-interface-source-index-disabled`,Math.max(1,l)*Uint32Array.BYTES_PER_ELEMENT),k=e.createBuffer({label:`ulg-sph-interface-compact-candidates`,size:Math.max(4,p),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST}),j=e.createBuffer({label:`ulg-sph-interface-source-keys`,size:Math.max(4,m),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST}),M=e.createBuffer({label:`ulg-sph-interface-compact-metadata`,size:16,usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST}),N=e.createBuffer({label:`ulg-sph-interface-compact-candidate-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(N,0,_i({surfaceCount:c,totalFieldCells:l,candidateCount:u,fieldPadding:Q(t.fieldPadding,.22),refEdgeM:Q(t.refEdgeM,10),isolationScale:Q(a,1),sourceKeyEnabled:T})),e.queue.writeBuffer(j,0,new Float32Array(f*Bn)),e.queue.writeBuffer(M,0,new Uint32Array([0,0,f,u]));let{pipeline:ee,bindGroupLayout:P,cacheStatus:F}=me(e,{cacheKey:`ulg-sph-interface-compact-candidates-v1`,label:`ulg-sph-interface-compact-candidates`,code:h,entryPoint:`main`,bindings:[G(0,`read-only-storage`),G(1,`read-only-storage`),G(2,`storage`),G(3,`uniform`),G(4,`storage`),G(5,`storage`),G(6,`storage`)]}),I=pe(e,{layout:P,entries:[{binding:0,resource:ci(D,_,{label:`compact material-interface render surfaces`})},{binding:1,resource:ci(E,g,{label:`compact material-interface source render field`})},{binding:2,resource:ci(k,p,{label:`compact material-interface candidates`})},{binding:3,resource:{buffer:N}},{binding:4,resource:ci(M,16,{label:`compact material-interface metadata`})},{binding:5,resource:ci(O,v,{label:`compact material-interface source-index field`})},{binding:6,resource:ci(j,m,{label:`compact material-interface source keys`})}]}),te=e.createCommandEncoder(),ne=te.beginComputePass();ne.setPipeline(ee),ne.setBindGroup(0,I),ne.dispatchWorkgroups(y,b),ne.end(),e.queue.submit([te.finish()]);let re=await xi(e,M,16,`ulg-sph-interface-compact-candidate-metadata-readback`),ie=new Uint32Array(re),ae=ie[0]??0,oe=ie[1]??0,L=Math.min(ae,f),se=L*Vn*Float32Array.BYTES_PER_ELEMENT,R=se>0?new Float32Array(await xi(e,k,se,`ulg-sph-interface-compact-candidate-readback`)):new Float32Array,z=L*Bn*Float32Array.BYTES_PER_ELEMENT,B=T&&z>0?new Float32Array(await xi(e,j,z,`ulg-sph-interface-source-key-readback`)):new Float32Array,V=Bi(B),ce=!!(T&&L>0);x||E.destroy?.(),S||D.destroy?.(),w||O.destroy?.(),k.destroy?.(),M.destroy?.(),N.destroy?.(),ce||j.destroy?.();let le=Li(t,R,a),H=!1,ue={schema:A,backend:`webgpu-compact`,status:oe>0||ae>f?`material-interface-compact-candidate-field-overflow`:ae>0?`material-interface-candidate-field-ready`:`material-interface-candidate-field-empty`,reason:oe>0||ae>f?`compact material-interface candidate capacity ${f} was exceeded by ${oe} rows`:null,sourceSchema:t.schema,sourceBackend:t.backend,surfaceCount:c,totalFieldCells:l,candidateCount:u,activeCandidateCount:ae,rowLayout:[...o],rowStrideFloats:Vn,candidateRows:R,candidateRowByteLength:R.byteLength,candidateDenseRowsByteLength:d,candidateCompactRowsByteLength:se,compactCandidateCapacity:f,compactCandidateOverflowCount:oe,compactCandidateMetadata:{activeCandidateCount:ae,overflowCount:oe,capacity:f,denseCandidateCount:u},candidateShape:`compact-active-render-field-cell-axis-triplets`,surfaces:le,fieldRowsBufferBound:!!x,surfaceBufferBound:!!S,sourceIndexFieldBufferBound:T,queueCompletionStatus:`compact-readback-map-completed`,queueCompletionMethod:`mapAsync(compact-candidate-readback-buffer)`,pipelineCacheStatus:F,candidateReadback:!0,candidateReadbackMode:br,candidateMetadataReadback:!0,interfaceSourceKeySchema:C,interfaceSourceKeyStatus:T?V>0?`interface-source-key-retained`:`interface-source-key-empty`:`interface-source-key-unavailable`,interfaceSourceKeyReason:T?null:`source-local material-interface source-index field was unavailable`,interfaceSourceKeyRows:B,interfaceSourceKeyReadback:B.length>0,interfaceSourceKeyRowCount:L,interfaceSourceKeyReadyCount:V,interfaceSourceKeyStrideFloats:Bn,interfaceSourceKeyRowByteLength:z,interfaceSourceKeyBufferRetained:ce,interfaceSourceKeyBufferByteLength:ce?m:0,interfaceSourceKeySurfaceIndexFallbackEnabled:!1,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1};return ce&&(ue.interfaceSourceKeyBuffer=j,ue.destroyMaterialInterfaceCandidateFieldBuffers=({reason:e=`material-interface-candidate-field-buffer-cleanup`}={})=>H?{schema:`peercompute.ulg.sph-material-interface-candidate-field-buffer-cleanup.v0`,status:`material-interface-candidate-field-buffers-already-destroyed`,reason:e}:(H=!0,j.destroy?.(),ue.interfaceSourceKeyBufferRetained=!1,ue.interfaceSourceKeyBufferDestroyed=!0,{schema:`peercompute.ulg.sph-material-interface-candidate-field-buffer-cleanup.v0`,status:`material-interface-candidate-field-buffers-destroyed`,reason:e,interfaceSourceKeyBufferDestroyed:!0})),ue}Object.freeze([[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]),Object.freeze([[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]]);var Hi=12,Ui=Hi*3;function Wi(e){let t=Math.max(0,Math.round(Q(e,0))-1);return t*t*t}function Gi(e){let t=Math.round(Q(e,0));return t===l.gas?3:t===l.liquid?2:0}function Ki(e={}){let t=Number(e.transparencyClassId),n=Number.isFinite(t)&&t>=0?t:Gi(e.phaseId),r=Number(e.depthWriteFlag),i=Number.isFinite(r)&&r>=0?r:n>0?0:1,a=Number(e.renderOrder),o=Q(e.surfaceIndex??e.index,0),s=Number.isFinite(a)?a:n*1e3+o;return{renderLayer:e.renderLayer??null,renderOrder:s,transparencyClassId:n,depthWriteFlag:i}}function qi(e={}){let t=e=>{if(e==null||e===``)return null;let t=Number(e);return Number.isFinite(t)?t:null};return{particleRadiusScale:t(e.particleRadiusScale),particleRadiusPolicyStatus:e.particleRadiusPolicyStatus??null,particleRadiusPolicyMode:e.particleRadiusPolicyMode??null,particleRadiusContinuityFloorEligible:e.particleRadiusContinuityFloorEligible??null,particleRadiusContinuityFloorApplied:e.particleRadiusContinuityFloorApplied??null,particleRadiusScaleRequested:t(e.particleRadiusScaleRequested),particleRadiusContinuityFloorScale:t(e.particleRadiusContinuityFloorScale),particleRadiusContinuityFloorScaleUnbounded:t(e.particleRadiusContinuityFloorScaleUnbounded),particleRadiusContinuityRepresentativeRadiusM:t(e.particleRadiusContinuityRepresentativeRadiusM),particleRadiusContinuitySmoothingLengthM:t(e.particleRadiusContinuitySmoothingLengthM),particleRadiusContinuitySupportMultiplier:t(e.particleRadiusContinuitySupportMultiplier),particleRadiusContinuitySupportTargetIsoradiusM:t(e.particleRadiusContinuitySupportTargetIsoradiusM),particleRadiusContinuitySamplingCellSizeM:t(e.particleRadiusContinuitySamplingCellSizeM),particleRadiusContinuitySamplingMarginM:t(e.particleRadiusContinuitySamplingMarginM),particleRadiusContinuityTargetIsoradiusM:t(e.particleRadiusContinuityTargetIsoradiusM)}}function Ji(e){let t=e?.surfaces||[],n=Math.max(0,Math.round(Q(e?.surfaceCount,t.length))),r=new Float32Array(n*Mn);for(let e=0;e<n;e+=1){let n=t[e]||{},i=e*Mn,a=Array.isArray(n.colorLinear)||ArrayBuffer.isView(n.colorLinear)?n.colorLinear:[1,1,1];r.set([Q(n.materialId,0),Q(n.phaseId,l.unknown),Q(n.fieldOffset??n.cellOffset,0),Q(n.fieldCellCount??n.cellCount??n.voxelCount??0,0),Q(n.resolution,0),Q(n.isolation,0),Q(n.subtract,0),Q(n.strength,0),Q(n.radiusNorm,0),Ir(Q(a[0],1),0,1),Ir(Q(a[1],1),0,1),Ir(Q(a[2],1),0,1),1,Q(n.opticalStateId,0),Number.isFinite(Number(n.transparencyClassId))?Number(n.transparencyClassId):-1,Number.isFinite(Number(n.depthWriteFlag))?Number(n.depthWriteFlag):-1],i)}return r}function Yi(e,t=[]){let n=e.length/Rn,r=0,i=0,a=0,o=[];for(let s=0;s<n;s+=1){let n=s*Rn,c=t[s]||{},l=e[n+11]>0,u=Math.round(Q(e[n+5],0)),d=Math.round(Q(e[n+7],0));l&&(r+=1),i+=u,a+=d,o.push({surfaceKey:c.surfaceKey,material:c.material,phase:c.phase,renderKey:c.renderKey,surfaceIndex:Math.round(Q(e[n],s)),materialId:e[n+1],phaseId:e[n+2],opticalStateId:e[n+3],vertexOffset:Math.round(Q(e[n+4],0)),vertexCount:u,triangleOffset:Math.round(Q(e[n+6],0)),triangleCount:d,renderOrder:e[n+8],transparencyClassId:e[n+9],depthWriteFlag:e[n+10],boundsCenterM:[e[n+12],e[n+13],e[n+14]],boundsRadiusM:e[n+15],status:l?`surface-draw-ready`:`surface-draw-empty`})}return{surfaces:o,activeSurfaceCount:r,vertexCount:i,triangleCount:a}}function Xi(e,t=[]){let n=e.length/In,r=0,i=0,a=0,o=[];for(let s=0;s<n;s+=1){let n=s*In,c=t[s]||{},l=e[n+11]>0,u=Math.round(Q(e[n+4],0)),d=Q(e[n+6],0);l&&(r+=1),i+=u,a=Math.max(a,d),o.push({surfaceKey:c.surfaceKey,material:c.material,phase:c.phase,renderKey:c.renderKey,...qi(c),surfaceIndex:Math.round(Q(e[n],s)),materialId:e[n+1],phaseId:e[n+2],opticalStateId:e[n+3],activeCellCount:u,crossingCellCount:Math.round(Q(e[n+5],0)),maxDensity:d,isolation:e[n+7],minActiveM:[e[n+8],e[n+9],e[n+10]],maxActiveM:[e[n+12],e[n+13],e[n+14]],cellSizeM:e[n+15],boundsCenterM:[e[n+16],e[n+17],e[n+18]],boundsRadiusM:e[n+19],status:l?`render-field-surface-active`:`render-field-surface-empty`})}return{surfaces:o,activeSurfaceCount:r,activeCellCount:i,maxDensity:a}}async function Zi({device:e,renderField:t,fieldRowsBuffer:n=null,surfaceBuffer:r=null,isolationScale:i=1,retainSummaryRowsBuffer:a=!1}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`summarizeSphRenderFieldSurfacesWebGpu requires a WebGPU-like device`);if(t?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)throw TypeError(`summarizeSphRenderFieldSurfacesWebGpu requires an SPH render field`);if(!n&&!(t.fieldRows instanceof Float32Array))throw TypeError(`summarizeSphRenderFieldSurfacesWebGpu requires fieldRows or fieldRowsBuffer`);if(!r&&!(t.surfaceTable?.records instanceof Float32Array))throw TypeError(`summarizeSphRenderFieldSurfacesWebGpu requires surface table records or surfaceBuffer`);let o=t.surfaceTable?.surfaceCount??t.surfaceCount??0,s=o*In*Float32Array.BYTES_PER_ELEMENT,c=(t.totalFieldCells??0)*Nn*Float32Array.BYTES_PER_ELEMENT,l=o*Mn*Float32Array.BYTES_PER_ELEMENT,d=Math.max(1,o);ii(e,`render field surface summary`,d),ni(e,`ulg-sph-render-field-surface-summary`,Math.max(4,s)),ri(e,`ulg-sph-render-field-surface-summary`,Math.max(4,s));let f=n||null,p=r||null;si(e,`render field surface summary source field`,f,c),si(e,`render field surface summary surfaces`,p,l);let m=f||Zr(e,`ulg-sph-render-field-summary-source-field`,t.fieldRows,Z.COPY_SRC),h=p||Zr(e,`ulg-sph-render-field-summary-surfaces`,t.surfaceTable.records),g=e.createBuffer({label:`ulg-sph-render-field-surface-summary`,size:Math.max(4,s),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST});s>0&&e.queue.writeBuffer(g,0,new Float32Array(o*In));let v=e.createBuffer({label:`ulg-sph-render-field-surface-summary-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(v,0,yi({surfaceCount:o,totalFieldCells:t.totalFieldCells??0,fieldPadding:Q(t.fieldPadding,.22),refEdgeM:Q(t.refEdgeM,10),isolationScale:Q(i,1)}));let{pipeline:y,bindGroupLayout:b}=he(e,{label:`ulg-sph-render-field-surface-summary`,module:e.createShaderModule({label:`ulg-sph-render-field-surface-summary`,code:_}),entryPoint:`main`,bindings:[G(0,`read-only-storage`),G(1,`read-only-storage`),G(2,`storage`),G(3,`uniform`)]}),x=pe(e,{layout:b,entries:[{binding:0,resource:ci(h,l,{label:`render field surface summary surfaces`})},{binding:1,resource:ci(m,c,{label:`render field surface summary source field`})},{binding:2,resource:ci(g,s,{label:`render field surface summary rows`})},{binding:3,resource:{buffer:v}}]}),S=e.createCommandEncoder(),C=S.beginComputePass();C.setPipeline(y),C.setBindGroup(0,x),C.dispatchWorkgroups(d),C.end(),e.queue.submit([S.finish()]);let w=`queue-submitted`,T=`queue.submit`,E=new Float32Array;if(s>0){let t=await xi(e,g,s,`ulg-sph-render-field-surface-summary-readback`);E=new Float32Array(t),w=`compact-summary-readback-map-completed`,T=`mapAsync(compact-summary-readback-buffer)`}f||m.destroy?.(),p||h.destroy?.(),a||g.destroy?.(),v.destroy?.();let D=Xi(E,t.surfaceTable?.metadata||[]),O={schema:u,backend:`webgpu`,status:D.activeSurfaceCount>0?`render-field-surface-summary-ready`:`render-field-surface-summary-empty`,sourceRenderFieldSchema:t.schema,sourceRenderFieldBackend:t.backend,surfaceCount:o,activeSurfaceCount:D.activeSurfaceCount,activeCellCount:D.activeCellCount,maxDensity:D.maxDensity,rowLayout:[...I],rowStrideFloats:In,summaryRows:E,summaryRowsByteLength:s,summaryRowsBufferByteLength:a?s:0,summaryRowsBufferRetained:!!a,fieldRowsBufferBound:!!f,surfaceBufferBound:!!p,queueCompletionStatus:w,queueCompletionMethod:T,renderFieldSurfaceSummaryReadback:!0,renderFieldReadback:!!t.renderFieldReadback,surfaces:D.surfaces,scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};return a&&(O.summaryRowsBuffer=g,O.destroySummaryRowsBuffer=()=>g.destroy?.()),O}function Qi(e,t,n=1){let r=e.surfaceTable?.metadata||[],i=r.map(()=>new Set),a=Array(r.length).fill(0),o=t.length/zn;for(let e=0;e<o;e+=1){let n=e*zn;if(!(t[n+15]>0))continue;let o=Math.round(t[n]);o>=0&&o<r.length&&(a[o]+=1,i[o].add(Math.round(t[n+3])))}return r.map(e=>{let t=a[e.index]||0,r=i[e.index]?.size||0,o=Ki(e);return{surfaceKey:e.surfaceKey,material:e.material,phase:e.phase,renderKey:e.renderKey,renderLayer:e.renderLayer??o.renderLayer,renderOrder:o.renderOrder,transparencyClassId:o.transparencyClassId,depthWriteFlag:o.depthWriteFlag,materialId:e.materialId,phaseId:e.phaseId,opticalStateKey:e.opticalStateKey||`default`,opticalStateId:e.opticalStateId||0,resolution:e.resolution,isolation:e.isolation*Q(n,1),voxelResolution:Math.max(0,e.resolution-1),voxelCount:Wi(e.resolution),fieldOffset:e.fieldOffset,fieldCellCount:e.fieldCellCount,activeCellCount:null,triangleOffset:null,triangleCount:r,vertexOffset:null,vertexCount:t,status:r>0?`surface-vertices-ready`:`surface-vertices-empty`}})}function $i(e){if(!(e instanceof Float32Array)||e.length===0)return new Float32Array;let t=[];for(let n=0;n<e.length;n+=zn)if(e[n+15]>0){let r=Array.from(e.slice(n,n+zn)),i=t.length/zn;r[3]=Math.floor(i/3),r[4]=i%3,t.push(...r)}return Float32Array.from(t)}async function ea({device:e,renderField:t,fieldRowsBuffer:n=null,surfaceBuffer:r=null,isolationScale:i=1,readbackMode:a=_r,retainVertexRowsBuffer:o=!1,maxVertexRows:s=null,surfaceVertexEmissionMode:c=null,compactByteBudget:l=Gn,onProgress:u=null,waitForQueueCompletion:d=!0,deferCleanup:f=!0,useQueueFenceForCleanup:m=!0}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphRenderSurfaceVerticesWebGpu requires a WebGPU-like device`);if(t?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)throw TypeError(`buildSphRenderSurfaceVerticesWebGpu requires an SPH render field`);if(!n&&!(t.fieldRows instanceof Float32Array))throw TypeError(`buildSphRenderSurfaceVerticesWebGpu requires fieldRows or fieldRowsBuffer`);if(!r&&!(t.surfaceTable?.records instanceof Float32Array))throw TypeError(`buildSphRenderSurfaceVerticesWebGpu requires surface table records or surfaceBuffer`);let h=t.surfaceTable?.surfaceCount??t.surfaceCount??0,g=t.totalFieldCells??0,_=a===vr,v=Lr(c,{noFullReadback:_}),y=Rr(v),b=g*Ui,x=zr({requiredVertexRows:b,requestedMaxVertexRows:s,emissionMode:v,compactByteBudget:l}),S=x*zn*Float32Array.BYTES_PER_ELEMENT,C=g*Nn*Float32Array.BYTES_PER_ELEMENT,w=h*Mn*Float32Array.BYTES_PER_ELEMENT,T=Math.ceil(Math.max(1,t.maxFieldCellCount||0)/64),E=Math.max(1,h);ii(e,`render surface vertices`,T,E),ni(e,`ulg-sph-surface-vertices`,Math.max(4,S)),ri(e,`ulg-sph-surface-vertices`,Math.max(4,S)),ni(e,`ulg-sph-surface-vertex-counter`,16),ri(e,`ulg-sph-surface-vertex-counter`,16);let D=v===Cr&&x<b,k=!!(_&&o&&v===Cr),A=typeof u==`function`?(e,n={})=>{try{u({status:e,stage:`surface-vertices`,surfaceCount:h,totalFieldCells:g,maxFieldCellCount:t.maxFieldCellCount??null,requiredVertexRows:b,maxVertexRows:x,fixedSlotVertexRowsByteLength:S,surfaceVertexEmissionMode:v,surfaceVertexBudgetCapped:D,compactByteBudget:l,readbackMode:_?vr:_r,...n})}catch{}}:()=>{};A(`surface-vertices-kernel-started`);let j=n||null,N=r||null;si(e,`render surface vertices source field`,j,C),si(e,`render surface vertices surfaces`,N,w),A(`surface-vertices-source-buffers-started`);let ee=j||Zr(e,`ulg-sph-surface-vertices-source-render-field`,t.fieldRows,Z.COPY_SRC),P=N||Zr(e,`ulg-sph-surface-vertices-render-surfaces`,t.surfaceTable.records);A(`surface-vertices-source-buffers-ready`,{borrowedFieldRowsBuffer:!!j,borrowedSurfaceBuffer:!!N}),A(`surface-vertices-output-buffer-create-started`);let F=e.createBuffer({label:`ulg-sph-surface-vertices`,size:Math.max(4,S),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST});A(`surface-vertices-output-buffer-create-complete`),S>0&&(A(`surface-vertices-output-buffer-zero-started`),e.queue.writeBuffer(F,0,new Float32Array(x*zn)),A(`surface-vertices-output-buffer-zero-complete`)),A(`surface-vertices-params-buffer-started`);let I=e.createBuffer({label:`ulg-sph-surface-vertex-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(I,0,vi({surfaceCount:h,totalFieldCells:g,maxVertexRows:x,emissionModeId:y,fieldPadding:Q(t.fieldPadding,.22),refEdgeM:Q(t.refEdgeM,10),isolationScale:Q(i,1)})),A(`surface-vertices-params-buffer-complete`),A(`surface-vertices-counter-buffer-started`);let te=e.createBuffer({label:`ulg-sph-surface-vertex-counter`,size:16,usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST});e.queue.writeBuffer(te,0,new Uint32Array(4)),A(`surface-vertices-counter-buffer-complete`),A(`surface-vertices-shader-module-started`);let ne=e.createShaderModule({label:`ulg-sph-surface-vertices`,code:M});A(`surface-vertices-shader-module-complete`),A(`surface-vertices-pipeline-started`);let{pipeline:re,bindGroupLayout:ie}=he(e,{label:`ulg-sph-surface-vertices`,module:ne,entryPoint:`main`,bindings:[G(0,`read-only-storage`),G(1,`read-only-storage`),G(2,`storage`),G(3,`uniform`),G(4,`storage`)]});A(`surface-vertices-pipeline-complete`),A(`surface-vertices-bind-group-started`);let ae=pe(e,{layout:ie,entries:[{binding:0,resource:ci(P,w,{label:`render surface vertices surfaces`})},{binding:1,resource:ci(ee,C,{label:`render surface vertices source field`})},{binding:2,resource:ci(F,S,{label:`render surface vertices`})},{binding:3,resource:{buffer:I}},{binding:4,resource:ci(te,16,{label:`render surface vertex counter`})}]});A(`surface-vertices-bind-group-complete`),A(`surface-vertices-command-encode-started`);let oe=e.createCommandEncoder(),L=oe.beginComputePass();L.setPipeline(re),L.setBindGroup(0,ae),L.dispatchWorkgroups(T,E),L.end(),A(`surface-vertices-command-encode-complete`,{workgroupCountX:T,workgroupCountY:E});let se=new Float32Array,R=null,z=null,B=`not-submitted`,V=null,ce=!1,le=!1;if(!_)if(A(`surface-vertices-queue-submit-started`),e.queue.submit([oe.finish()]),B=`queue-submitted`,V=`queue.submit`,A(`surface-vertices-queue-submit-complete`,{queueCompletionStatus:B,queueCompletionMethod:V}),x>0){A(`surface-vertices-full-readback-started`);let t=await xi(e,F,S,`ulg-sph-surface-vertex-readback`);B=`readback-map-completed`,V=`mapAsync(readback-buffer)`,se=$i(new Float32Array(t)),R=se.length/zn,z=R/3,A(`surface-vertices-full-readback-complete`,{queueCompletionStatus:B,queueCompletionMethod:V,vertexCount:R,triangleCount:z})}else B=`readback-skipped-empty-buffer`,V=`queue.submit`,A(`surface-vertices-full-readback-skipped`,{queueCompletionStatus:B,queueCompletionMethod:V});else if(d&&e.queue?.onSubmittedWorkDone)A(`surface-vertices-queue-submit-started`),e.queue.submit([oe.finish()]),B=`queue-submitted`,V=`queue.submit`,A(`surface-vertices-queue-submit-complete`,{queueCompletionStatus:B,queueCompletionMethod:V}),A(`surface-vertices-queue-work-wait-started`),await e.queue.onSubmittedWorkDone(),B=`queue-work-completed`,V=`queue.onSubmittedWorkDone`,A(`surface-vertices-queue-work-wait-complete`,{queueCompletionStatus:B,queueCompletionMethod:V});else{A(`surface-vertices-queue-submit-started`),e.queue.submit([oe.finish()]);let t=!!(e.queue?.onSubmittedWorkDone&&f&&m);B=t?`queue-submitted-cleanup-deferred`:e.queue?.onSubmittedWorkDone?`queue-submitted-gpu-handoff-no-cpu-fence`:`queue-submitted-no-explicit-completion`,V=t?`deferred queue.onSubmittedWorkDone cleanup`:e.queue?.onSubmittedWorkDone?`queue.submit(in-order-gpu-surface-vertex-handoff)`:`queue.submit`,ce=t,le=!!(e.queue?.onSubmittedWorkDone&&f&&!m),A(`surface-vertices-queue-submit-complete`,{queueCompletionStatus:B,queueCompletionMethod:V})}let H=!1,ue=()=>{H||(H=!0,j||ee.destroy?.(),N||P.destroy?.(),o||F.destroy?.(),I.destroy?.(),k||te.destroy?.())};ce?(A(`surface-vertices-cleanup-deferred`,{queueCompletionStatus:B,queueCompletionMethod:V}),ge(e,()=>{ue(),A(`surface-vertices-deferred-cleanup-complete`,{queueCompletionStatus:B,queueCompletionMethod:V})})):le?A(`surface-vertices-cleanup-deferred-no-queue-fence`,{queueCompletionStatus:B,queueCompletionMethod:V,reason:`retained resident handoff owns cleanup through buffer lease release`}):_&&!d&&e.queue?.onSubmittedWorkDone&&!f?A(`surface-vertices-cleanup-retained-for-resident-handoff`,{queueCompletionStatus:B,queueCompletionMethod:V,reason:`caller disabled queue-fence cleanup because a same-queue consumer/readback owns the synchronization boundary`}):(A(`surface-vertices-cleanup-started`),ue(),A(`surface-vertices-cleanup-complete`));let U=be({ledgerId:`sph-surface-vertices:${h}:${x}:buffer-leases`,stateKey:`sph-surface-vertices`,scope:`sph-surface-vertex-buffer-leases`}),W=[],de=`surface-vertices:vertex-rows:${x}:${S}`,fe=`surface-vertices:vertex-counter:${x}:16`;if(o){Ce(U,{resourceKey:de,resourceKind:`surface-vertex-rows-buffer`,stateFamily:`render-surface-vertices`,ownerStage:`surface-vertex-builder`,producerStage:`surface-vertex-builder`,source:`buildSphRenderSurfaceVerticesWebGpu`,status:`resident-surface-vertex-buffer-retained`,retained:!0,byteLength:S,rowCount:x,bufferLabel:F?.label,emissionMode:v,expectedConsumers:[`surface-draw-metadata`]});let e=Se(U,{resourceKey:de,consumerStage:`surface-draw-metadata`,reason:`retained-surface-vertex-buffer`});W.push(e.leaseId)}if(k){Ce(U,{resourceKey:fe,resourceKind:`surface-vertex-counter-buffer`,stateFamily:`render-surface-vertices`,ownerStage:`surface-vertex-builder`,producerStage:`surface-vertex-builder`,source:`buildSphRenderSurfaceVerticesWebGpu`,status:`resident-surface-vertex-counter-retained`,retained:!0,byteLength:16,rowCount:1,bufferLabel:te?.label,emissionMode:v,expectedConsumers:[`surface-draw-metadata`]});let e=Se(U,{resourceKey:fe,consumerStage:`surface-draw-metadata`,reason:`retained-surface-vertex-counter`});W.push(e.leaseId)}let me=se.length?Qi(t,se,i):(t.surfaceTable?.metadata||[]).map(e=>{let t=Ki(e);return{surfaceKey:e.surfaceKey,material:e.material,phase:e.phase,renderKey:e.renderKey,renderLayer:e.renderLayer??t.renderLayer,renderOrder:t.renderOrder,transparencyClassId:t.transparencyClassId,depthWriteFlag:t.depthWriteFlag,materialId:e.materialId,phaseId:e.phaseId,opticalStateKey:e.opticalStateKey||`default`,opticalStateId:e.opticalStateId||0,resolution:e.resolution,isolation:e.isolation*Q(i,1),voxelResolution:Math.max(0,e.resolution-1),voxelCount:Wi(e.resolution),fieldOffset:e.fieldOffset,fieldCellCount:e.fieldCellCount,activeCellCount:null,triangleOffset:null,triangleCount:null,vertexOffset:null,vertexCount:null,status:`surface-vertex-summary-not-read`}}),_e={schema:O,backend:`webgpu`,status:_?v===Cr?`surface-vertices-resident-atomic-compact`:`surface-vertices-resident-fixed-slots`:(z||0)>0?`surface-vertices-ready`:`surface-vertices-empty`,sourceRenderFieldSchema:t.schema,sourceRenderFieldBackend:t.backend,surfaceExtractionMethod:`tetrahedralized-render-field-cubes`,compactionMode:_?v===Cr?`webgpu-atomic-compact`:`webgpu-fixed-cell-slots`:`webgpu-fixed-cell-slots-debug-compacted`,surfaceVertexEmissionMode:v,surfaceVertexEmissionModeId:y,surfaceVertexBudgetCapped:D,surfaceVertexCompactByteBudget:v===Cr?Math.max(0,Math.round(Q(l,Gn))):null,requiredVertexRows:b,surfaceCount:h,totalFieldCells:g,activeCellCount:null,triangleCount:z,vertexCount:R,overflowCount:_&&v===Cr?null:0,maxTrianglesPerCell:Hi,maxVerticesPerCell:Ui,maxVertexRows:x,rowLayout:[...p],rowStrideFloats:zn,vertexRows:se,vertexRowsByteLength:se.byteLength,fixedSlotVertexRowsByteLength:S,fixedSlotVertexRowCount:x,vertexRowsBufferByteLength:o?S:0,vertexRowsBufferRowCount:o?x:0,vertexRowsBufferRetained:!!o,vertexCounterBufferByteLength:k?16:0,vertexCounterBufferRetained:k,counterBufferRetained:k,counterReadback:!1,fieldRowsBufferBound:!!j,surfaceBufferBound:!!N,readbackMode:_?vr:_r,queueCompletionStatus:B,queueCompletionMethod:V,surfaceVertexDeferredCleanup:le,surfaceVertexReadback:!_,renderFieldReadback:!!t.renderFieldReadback,surfaces:me,residentBufferLeaseLedger:U,residentBufferLeaseSummary:q(U),residentBufferLeaseLedgerStatus:U.status,residentBufferLeaseResourceCount:U.resourceCount,residentBufferLeaseActiveLeaseCount:U.activeLeaseCount,scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};if(o){_e.vertexRowsBuffer=F,k&&(_e.vertexCounterBuffer=te);let e=!1,t=!1,n=()=>(_e.residentBufferLeaseSummary=q(U),_e.residentBufferLeaseLedgerStatus=_e.residentBufferLeaseSummary.status,_e.residentBufferLeaseResourceCount=_e.residentBufferLeaseSummary.resourceCount,_e.residentBufferLeaseActiveLeaseCount=_e.residentBufferLeaseSummary.activeLeaseCount,_e.residentBufferLeaseSummary);_e.releaseSurfaceVertexBufferLeases=({status:e=`released`}={})=>{for(let t of W)xe(U,t,{status:e});return n()},_e.destroySurfaceVertexBuffers=({force:r=!1,releaseLeases:i=!1,reason:a=`surface-vertex-buffer-cleanup`}={})=>(ue(),i&&_e.releaseSurfaceVertexBufferLeases(),we(U,de,()=>{e||(e=!0,F.destroy?.())},{force:r,reason:a}),k&&we(U,fe,()=>{t||(t=!0,te.destroy?.())},{force:r,reason:a}),n())}return _e}async function ta({device:e,surfaceVertices:t,surfaceBuffer:n=null,readbackMode:i=_r,compactSummaryReadback:a=!1,retainDrawRowsBuffer:o=!1,retainCompactedVertexRowsBuffer:s=!1,retainDrawIndirectRowsBuffer:c=!1,waitForQueueCompletion:l=!0,onProgress:u=null}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphRenderSurfaceDrawMetadataWebGpu requires a WebGPU-like device`);if(t?.schema!==`peercompute.ulg.sph-gpu-render-surface-vertices.v0`)throw TypeError(`buildSphRenderSurfaceDrawMetadataWebGpu requires an SPH surface vertex field`);let d=!!t.vertexRowsBuffer,p=t.vertexRows instanceof Float32Array&&t.vertexRows.length>0;if(!d&&!p)throw TypeError(`buildSphRenderSurfaceDrawMetadataWebGpu requires vertexRows or a retained vertexRowsBuffer`);let m=i===vr,h=!!t.vertexCounterBuffer,g=+!!h,_=h?`resident-vertex-counter`:`uniform-upper-bound`,v=zn*Float32Array.BYTES_PER_ELEMENT;if(t.rowStrideFloats!=null&&t.rowStrideFloats!==zn)throw RangeError(`surface vertex rowStrideFloats does not match the draw-kernel vertex ABI`);let y;if(d){let e=[[`vertexRowsBufferRowCount`,t.vertexRowsBufferRowCount],[`maxVertexRows`,t.maxVertexRows],[`fixedSlotVertexRowCount`,t.fixedSlotVertexRowCount]].filter(([,e])=>e!=null),n=[[`vertexRowsBufferByteLength`,t.vertexRowsBufferByteLength],[`fixedSlotVertexRowsByteLength`,t.fixedSlotVertexRowsByteLength]].filter(([,e])=>e!=null),r=Number(t.vertexRowsBuffer.size);if(!Number.isSafeInteger(r)||r<0)throw RangeError(`surface vertex rows buffer must expose its exact GPU buffer size`);if(e.length>0){y=Pr(e[0][1],`surfaceVertices.${e[0][0]}`);for(let[t,n]of e.slice(1))if(Pr(n,`surfaceVertices.${t}`)!==y)throw RangeError(`surface vertex row-count metadata must identify one exact borrowed range`)}else if(n.length>0){let[e,t]=n[0],r=oi(t,`surfaceVertices.${e}`);if(r%v!==0)throw RangeError(`surface vertex byte-length metadata must align to the vertex row ABI`);y=Pr(r/v,`surface vertex borrowed row count`)}else{if(r%v!==0)throw RangeError(`surface vertex rows buffer capacity must align to the vertex row ABI when row metadata is absent`);y=Pr(r/v,`surface vertex borrowed row count`)}let i=y*v;for(let[e,t]of n)if(oi(t,`surfaceVertices.${e}`)!==i)throw RangeError(`surface vertex row-count and byte-length metadata describe different borrowed ranges`)}else{if(t.vertexRows.length%zn!==0)throw RangeError(`surface vertex host rows must align to the vertex row ABI`);y=Pr(t.vertexRows.length/zn,`surface vertex host row count`)}let b=Pr(t.surfaceCount??t.surfaces?.length??0,`surface vertex surfaceCount`),C=y*v,w=b*Rn*Float32Array.BYTES_PER_ELEMENT,T=b*Ln*Uint32Array.BYTES_PER_ELEMENT,E=Ln*Uint32Array.BYTES_PER_ELEMENT,D=b*Mn*Float32Array.BYTES_PER_ELEMENT,O=Math.max(1,b);ii(e,`render surface draw metadata`,O);for(let[t,n]of[[`render surface draw compacted vertices`,C],[`render surface draw rows`,w],[`render surface draw indirect rows`,T],[`render surface draw aggregate indirect row`,E]]){let r=ai(n,t);ni(e,t,r),ri(e,t,r)}let k=typeof u==`function`?(e,t={})=>{try{u({status:e,stage:`surface-draw-metadata`,surfaceCount:b,sourceVertexRowCount:y,compactedVertexRowsByteLength:C,drawRowsByteLength:w,drawIndirectRowsByteLength:T,drawAggregateIndirectRowsByteLength:E,sourceVertexCounterMode:_,sourceVertexCounterBufferBound:h,readbackMode:m?vr:_r,compactSummaryReadback:!!a,...t})}catch{}}:()=>{};k(`surface-draw-metadata-kernel-started`);let A=n||null;if(si(e,`render surface draw source vertices`,d?t.vertexRowsBuffer:null,C),si(e,`render surface draw surfaces`,A,D),h&&t.vertexCounterBufferByteLength!=null&&oi(t.vertexCounterBufferByteLength,`surfaceVertices.vertexCounterBufferByteLength`)!==16)throw RangeError(`surface vertex counter byte length does not match its exact storage ABI`);si(e,`render surface draw source vertex counter`,h?t.vertexCounterBuffer:null,16),k(`surface-draw-metadata-source-buffers-started`,{hasBorrowedVertexBuffer:d,borrowedSurfaceBuffer:!!A});let M=d?t.vertexRowsBuffer:Zr(e,`ulg-sph-surface-draw-source-vertices`,t.vertexRows,Z.COPY_SRC),N=A||Zr(e,`ulg-sph-surface-draw-surfaces`,Ji(t)),ee=h?t.vertexCounterBuffer:e.createBuffer({label:`ulg-sph-surface-draw-source-vertex-counter`,size:16,usage:Z.STORAGE|Z.COPY_DST});h||e.queue.writeBuffer(ee,0,new Uint32Array([y,0,0,0])),k(`surface-draw-metadata-source-buffers-ready`,{hasBorrowedVertexBuffer:d,borrowedSurfaceBuffer:!!A,hasBorrowedVertexCounterBuffer:h}),k(`surface-draw-metadata-output-buffers-started`);let P=e.createBuffer({label:`ulg-sph-surface-draw-compacted-vertices`,size:Math.max(4,C),usage:Z.STORAGE|Z.VERTEX|Z.COPY_SRC|Z.COPY_DST});C>0&&e.queue.writeBuffer(P,0,new Float32Array(y*zn));let F=e.createBuffer({label:`ulg-sph-surface-draw-metadata`,size:Math.max(4,w),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST});w>0&&e.queue.writeBuffer(F,0,new Float32Array(b*Rn));let I=e.createBuffer({label:`ulg-sph-surface-draw-indirect`,size:Math.max(4,T),usage:Z.STORAGE|Z.INDIRECT|Z.COPY_SRC|Z.COPY_DST});T>0&&e.queue.writeBuffer(I,0,new Uint32Array(b*Ln));let te=e.createBuffer({label:`ulg-sph-surface-draw-aggregate-indirect`,size:E,usage:Z.STORAGE|Z.INDIRECT|Z.COPY_SRC|Z.COPY_DST});e.queue.writeBuffer(te,0,new Uint32Array(Ln)),k(`surface-draw-metadata-output-buffers-complete`),k(`surface-draw-metadata-params-buffer-started`);let ne=e.createBuffer({label:`ulg-sph-surface-draw-params`,size:16,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(ne,0,bi({surfaceCount:b,sourceVertexRowCount:y,maxCompactVertexRows:y,sourceVertexCounterMode:g})),k(`surface-draw-metadata-params-buffer-complete`),k(`surface-draw-metadata-shader-module-started`);let re=e.createShaderModule({label:`ulg-sph-surface-draw`,code:S});k(`surface-draw-metadata-shader-module-complete`),k(`surface-draw-metadata-pipeline-started`);let{pipeline:ie,bindGroupLayout:ae}=he(e,{label:`ulg-sph-surface-draw`,module:re,entryPoint:`main`,bindings:[G(0,`read-only-storage`),G(1,`read-only-storage`),G(2,`storage`),G(3,`storage`),G(4,`uniform`),G(5,`storage`),G(6,`read-only-storage`),G(7,`storage`)]});k(`surface-draw-metadata-pipeline-complete`),k(`surface-draw-metadata-bind-group-started`);let oe=pe(e,{layout:ae,entries:[{binding:0,resource:ci(N,D,{label:`render surface draw surfaces`})},{binding:1,resource:ci(M,C,{label:`render surface draw source vertices`})},{binding:2,resource:ci(P,C,{label:`render surface draw compacted vertices`})},{binding:3,resource:ci(F,w,{label:`render surface draw rows`})},{binding:4,resource:{buffer:ne}},{binding:5,resource:ci(I,T,{label:`render surface draw indirect rows`})},{binding:6,resource:ci(ee,16,{label:`render surface draw source vertex counter`})},{binding:7,resource:ci(te,E,{label:`render surface draw aggregate indirect row`})}]});k(`surface-draw-metadata-bind-group-complete`),k(`surface-draw-metadata-command-encode-started`);let L=e.createCommandEncoder(),se=L.beginComputePass();se.setPipeline(ie),se.setBindGroup(0,oe),se.dispatchWorkgroups(O),se.end(),k(`surface-draw-metadata-command-encode-complete`,{workgroupCountX:O});let R=new Float32Array,z=new Uint32Array,B=new Float32Array,V=null,ce=null,le=null,H,ue=!1,U=0,W=`not-submitted`,de=null,fe=!1,me=null,_e=null,ve=null,ye=null;if(!m)if(k(`surface-draw-metadata-queue-submit-started`),e.queue.submit([L.finish()]),W=`queue-submitted`,de=`queue.submit`,k(`surface-draw-metadata-queue-submit-complete`,{queueCompletionStatus:W,queueCompletionMethod:de}),w>0){k(`surface-draw-metadata-full-readback-started`);let n=await xi(e,F,w,`ulg-sph-surface-draw-readback`);W=`readback-map-completed`,de=`mapAsync(readback-buffer)`,R=new Float32Array(n);let r=Yi(R,t.surfaces||[]);if(H=r.surfaces,V=r.activeSurfaceCount,ce=r.vertexCount,le=r.triangleCount,ce>0){let t=await xi(e,P,ce*zn*Float32Array.BYTES_PER_ELEMENT,`ulg-sph-surface-draw-compacted-vertex-readback`);B=new Float32Array(t)}if(T>0){let t=await xi(e,I,T,`ulg-sph-surface-draw-indirect-readback`);z=new Uint32Array(t)}k(`surface-draw-metadata-full-readback-complete`,{queueCompletionStatus:W,queueCompletionMethod:de,activeSurfaceCount:V,vertexCount:ce,triangleCount:le})}else H=[],V=0,ce=0,le=0,z=new Uint32Array,W=`readback-skipped-empty-buffer`,de=`queue.submit`,k(`surface-draw-metadata-full-readback-skipped`,{queueCompletionStatus:W,queueCompletionMethod:de});else if(l&&e.queue?.onSubmittedWorkDone?(k(`surface-draw-metadata-queue-submit-started`),e.queue.submit([L.finish()]),W=`queue-submitted`,de=`queue.submit`,k(`surface-draw-metadata-queue-submit-complete`,{queueCompletionStatus:W,queueCompletionMethod:de}),k(`surface-draw-metadata-queue-work-wait-started`),await e.queue.onSubmittedWorkDone(),W=`queue-work-completed`,de=`queue.onSubmittedWorkDone`,k(`surface-draw-metadata-queue-work-wait-complete`,{queueCompletionStatus:W,queueCompletionMethod:de})):(k(`surface-draw-metadata-queue-submit-started`),e.queue.submit([L.finish()]),W=e.queue?.onSubmittedWorkDone&&!a?`queue-submitted-cleanup-deferred`:`queue-submitted-no-explicit-completion`,de=e.queue?.onSubmittedWorkDone&&!a?`deferred queue.onSubmittedWorkDone cleanup`:`queue.submit`,fe=!!(e.queue?.onSubmittedWorkDone&&!a),k(`surface-draw-metadata-queue-submit-complete`,{queueCompletionStatus:W,queueCompletionMethod:de})),H=(t.surfaces||[]).map((e,t)=>({...(()=>{let n=Ki({...e,surfaceIndex:t});return{surfaceKey:e.surfaceKey,material:e.material,phase:e.phase,renderKey:e.renderKey,renderLayer:e.renderLayer??n.renderLayer,surfaceIndex:t,materialId:e.materialId,phaseId:e.phaseId,opticalStateId:e.opticalStateId||0,vertexOffset:null,vertexCount:null,triangleOffset:null,triangleCount:null,renderOrder:n.renderOrder,transparencyClassId:n.transparencyClassId,depthWriteFlag:n.depthWriteFlag,boundsCenterM:[0,0,0],boundsRadiusM:null,status:`surface-draw-summary-not-read`}})()})),a&&w>0){k(`surface-draw-metadata-compact-summary-readback-started`);let n=await xi(e,F,w,`ulg-sph-surface-draw-compact-summary-readback`);R=new Float32Array(n);let r=Yi(R,t.surfaces||[]);H=r.surfaces,V=r.activeSurfaceCount,ce=r.vertexCount,le=r.triangleCount,ue=!0,U=w,W=`compact-summary-readback-map-completed`,de=`mapAsync(compact-summary-readback-buffer)`,k(`surface-draw-metadata-compact-summary-readback-complete`,{queueCompletionStatus:W,queueCompletionMethod:de,activeSurfaceCount:V,vertexCount:ce,triangleCount:le})}else ue=!1,U=0,me=Math.max(0,y-y%3),_e=Math.floor(me/3),ve=me>=3?`surface-draw-gpu-resident-draw-range-available`:`surface-draw-gpu-resident-empty-draw-range`,ye=me>=3?`compact surface-draw summary was not read; retained GPU buffers expose a conservative upper-bound draw range for same-device consumers`:`compact surface-draw summary was not read and retained GPU buffers do not contain a drawable triangle range`,k(`surface-draw-metadata-gpu-only-draw-range-ready`,{queueCompletionStatus:W,queueCompletionMethod:de,gpuOnlyDrawRangeStatus:ve,gpuOnlyDrawRangeVertexCount:me,gpuOnlyDrawRangeTriangleCount:_e});let K=()=>{d||M.destroy?.(),A||N.destroy?.(),h||ee.destroy?.(),ne.destroy?.()},Te=o||m,Ee=s||m,De=c||m,Oe=m;Te||F.destroy?.(),Ee||P.destroy?.(),De||I.destroy?.(),Oe||te.destroy?.(),fe?(k(`surface-draw-metadata-cleanup-deferred`,{queueCompletionStatus:W,queueCompletionMethod:de}),ge(e,()=>{K(),k(`surface-draw-metadata-deferred-cleanup-complete`,{queueCompletionStatus:W,queueCompletionMethod:de})})):(k(`surface-draw-metadata-cleanup-started`),K(),k(`surface-draw-metadata-cleanup-complete`));let ke=be({ledgerId:`sph-resident-surface-draw:${b}:buffer-leases`,stateKey:`sph-resident-surface-draw`,scope:`sph-resident-surface-draw-buffer-leases`}),Ae=[],je=({resourceKey:e,resourceKind:t,buffer:n,byteLength:r,rowCount:i})=>{Ce(ke,{resourceKey:e,resourceKind:t,stateFamily:`render-surface`,ownerStage:`surface-draw-metadata`,producerStage:`surface-draw-metadata`,source:`buildSphRenderSurfaceDrawMetadataWebGpu`,status:`resident-surface-draw-buffer-retained`,retained:!0,byteLength:r,rowCount:i,bufferLabel:n?.label,expectedConsumers:[`resident-surface-draw-overlay`,`diagnostics`]});let a=Se(ke,{resourceKey:e,consumerStage:`resident-surface-draw-overlay`,reason:`retained-overlay-draw-buffer`});Ae.push(a.leaseId)};Te&&je({resourceKey:`surface-draw:draw-rows:${b}:${w}`,resourceKind:`surface-draw-rows-buffer`,buffer:F,byteLength:w,rowCount:b}),De&&je({resourceKey:`surface-draw:draw-indirect:${b}:${T}`,resourceKind:`surface-draw-indirect-buffer`,buffer:I,byteLength:T,rowCount:b}),Oe&&je({resourceKey:`surface-draw:draw-aggregate-indirect:1:${E}`,resourceKind:`surface-draw-aggregate-indirect-buffer`,buffer:te,byteLength:E,rowCount:1}),Ee&&je({resourceKey:`surface-draw:compacted-vertices:${y}:${C}`,resourceKind:`surface-draw-compacted-vertices-buffer`,buffer:P,byteLength:C,rowCount:y});let Me={schema:j,backend:`webgpu`,status:m?`surface-draw-resident`:(V||0)>0?`surface-draw-metadata-ready`:`surface-draw-metadata-empty`,sourceSurfaceVertexSchema:t.schema,sourceSurfaceVertexBackend:t.backend,surfaceCount:b,activeSurfaceCount:V,vertexCount:ce,triangleCount:le,rowLayout:[...r],rowStrideFloats:Rn,drawRows:R,drawRowsByteLength:w,drawRowsBufferByteLength:Te?w:0,drawRowsBufferRetained:Te,drawIndirectSchema:x,drawIndirectRowLayout:[...f],drawIndirectRowStrideUints:Ln,drawIndirectRows:z,drawIndirectRowsByteLength:T,drawIndirectRowsBufferByteLength:De?T:0,drawIndirectRowsBufferRetained:De,drawAggregateIndirectRowsByteLength:E,drawAggregateIndirectRowsBufferByteLength:Oe?E:0,drawAggregateIndirectRowsBufferRetained:Oe,compactedVertexRows:B,compactedVertexRowsByteLength:B.byteLength,compactedVertexRowsBufferByteLength:Ee?C:0,compactedVertexRowsBufferRetained:Ee,sourceVertexRowCount:y,sourceVertexRowsBufferBound:d,sourceVertexCounterMode:_,sourceVertexCounterBufferBound:h,sourceVertexCounterBufferByteLength:h?16:0,surfaceBufferBound:!!A,readbackMode:m?vr:_r,queueCompletionStatus:W,queueCompletionMethod:de,surfaceDrawReadback:!m,surfaceDrawSummaryReadback:ue,surfaceDrawSummaryReadbackByteLength:U,surfaceDrawGpuOnlyHandoff:!!(m&&!ue),surfaceDrawGpuOnlyHandoffStatus:ve,surfaceDrawGpuOnlyHandoffReason:ye,surfaceDrawGpuOnlyUpperBoundVertexCount:me,surfaceDrawGpuOnlyUpperBoundTriangleCount:_e,surfaceDrawGpuOnlyAggregateIndirectReady:!!(m&&!ue&&Oe&&h),surfaceDrawGpuOnlyAggregateDrawRangeExact:!!(m&&!ue&&h),surfaceDrawGpuOnlyDrawRangeConservative:!!(m&&!ue&&(me||0)>=3),fullSurfaceDrawReadback:!m,compactionMode:`webgpu-surface-prefix-scan-compact`,surfaces:H,residentBufferLeaseLedger:ke,residentBufferLeaseSummary:q(ke),residentBufferLeaseLedgerStatus:ke.status,residentBufferLeaseResourceCount:ke.resourceCount,residentBufferLeaseActiveLeaseCount:ke.activeLeaseCount,scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};if(Te&&(Me.drawRowsBuffer=F),De&&(Me.drawIndirectRowsBuffer=I),Oe&&(Me.drawAggregateIndirectRowsBuffer=te),Ee&&(Me.compactedVertexRowsBuffer=P),Te||Ee||De){let e=new Set,t=()=>(Me.residentBufferLeaseSummary=q(ke),Me.residentBufferLeaseLedgerStatus=Me.residentBufferLeaseSummary.status,Me.residentBufferLeaseResourceCount=Me.residentBufferLeaseSummary.resourceCount,Me.residentBufferLeaseActiveLeaseCount=Me.residentBufferLeaseSummary.activeLeaseCount,Me.residentBufferLeaseSummary);Me.releaseSurfaceDrawBufferLeases=({status:e=`released`}={})=>{for(let t of Ae)xe(ke,t,{status:e});return t()};let n=(t,n)=>{e.has(t)||(e.add(t),n?.destroy?.())};Me.destroySurfaceDrawBuffers=({force:e=!1,releaseLeases:r=!1,reason:i=`surface-draw-buffer-cleanup`}={})=>{if(r&&Me.releaseSurfaceDrawBufferLeases(),Te){let t=`surface-draw:draw-rows:${b}:${w}`;we(ke,t,()=>{n(t,F)},{force:e,reason:i})}if(Ee){let t=`surface-draw:compacted-vertices:${y}:${C}`;we(ke,t,()=>{n(t,P)},{force:e,reason:i})}if(De){let t=`surface-draw:draw-indirect:${b}:${T}`;we(ke,t,()=>{n(t,I)},{force:e,reason:i})}if(Oe){let t=`surface-draw:draw-aggregate-indirect:1:${E}`;we(ke,t,()=>{n(t,te)},{force:e,reason:i})}return t()}}return Me}function na(e){if(e?.schema!==`peercompute.ulg.sph-material-interface-candidate-field.v0`||!(e.candidateRows instanceof Float32Array))throw TypeError(`compactSphMaterialInterfaceCandidates requires a material-interface candidate field`);if(e.candidateRows.length%Vn!==0)throw RangeError(`material-interface candidate rows must align to the candidate row stride`)}function ra(e){na(e);let t=e.candidateRows,n=e.interfaceSourceKeyRows instanceof Float32Array?e.interfaceSourceKeyRows:null,r=(e.surfaces||[]).map(e=>({...e,crossingFaceCount:0,surfaceAreaM2:0,normalAreaSum:[0,0,0],centroidAreaSum:[0,0,0],elementOffset:0,elementCount:0})),i=[],a=[],o=t.length/Vn,c=e=>{if(!n)return null;let t=e*Bn;if(t+2>=n.length)return null;let r=Math.round(Q(n[t],-1)),i=n[t+2]||0;if(r!==e||!(i>0))return null;let a=Math.round(Q(n[t+1],-1));return a>=0?a:null};for(let e=0;e<o;e+=1){let n=e*Vn;if(!(t[n+15]>0))continue;let o=Math.round(t[n]),s=r[o];if(!s)continue;s.elementCount===0&&(s.elementOffset=a.length);let l=t[n+7],u=[t[n+11],t[n+12],t[n+13]],d=[t[n+4],t[n+5],t[n+6]],f=[t[n+8],t[n+9],t[n+10]],p=a.length,m=c(p),h={index:p,surfaceIndex:o,surfaceKey:s.surfaceKey,material:s.material,phase:s.phase,renderKey:s.renderKey,materialId:t[n+1],phaseId:t[n+2],axisId:t[n+3],centroidM:d,areaM2:l,normal:f,normalAreaVectorM2:u,crossingSign:t[n+14],...m==null?{}:{sourceParticleIndex:m},status:`interface-element-ready`};a.push(h),i.push(h.surfaceIndex,h.materialId,h.phaseId,h.axisId,h.centroidM[0],h.centroidM[1],h.centroidM[2],h.areaM2,h.normal[0],h.normal[1],h.normal[2],h.normalAreaVectorM2[0],h.normalAreaVectorM2[1],h.normalAreaVectorM2[2],h.crossingSign,1),s.crossingFaceCount+=1,s.surfaceAreaM2+=l,s.normalAreaSum[0]+=u[0],s.normalAreaSum[1]+=u[1],s.normalAreaSum[2]+=u[2],s.centroidAreaSum[0]+=d[0]*l,s.centroidAreaSum[1]+=d[1]*l,s.centroidAreaSum[2]+=d[2]*l,s.elementCount+=1}let l=r.map(e=>({surfaceKey:e.surfaceKey,material:e.material,phase:e.phase,renderKey:e.renderKey,materialId:e.materialId,phaseId:e.phaseId,opticalStateKey:e.opticalStateKey||`default`,resolution:e.resolution,isolation:e.isolation,activeCellCount:e.activeCellCount,crossingFaceCount:e.crossingFaceCount,candidateOffset:e.candidateOffset,candidateCount:e.candidateCount,activeCandidateCount:e.activeCandidateCount,elementOffset:e.elementOffset,elementCount:e.elementCount,surfaceAreaM2:e.surfaceAreaM2,meanOutwardNormal:Ii(e.normalAreaSum),areaCentroidM:e.surfaceAreaM2>0?e.centroidAreaSum.map(t=>t/e.surfaceAreaM2):[null,null,null],normalDerivation:`render-field-isosurface-threshold-crossing-candidates`,surfaceAreaDerivation:`fixed-cell-axis-candidate-face-area-sum`,status:e.surfaceAreaM2>0?`material-interface-derived`:e.activeCellCount>0?`material-interface-active-without-crossing`:`material-interface-empty`})),u=l.reduce((e,t)=>e+t.surfaceAreaM2,0),d=l.filter(e=>e.surfaceAreaM2>0).length,f={schema:D,status:d>0?`material-interface-field-ready`:`material-interface-field-empty`,sourceSchema:e.sourceSchema,sourceBackend:e.sourceBackend,candidateFieldSchema:e.schema,candidateBackend:e.backend,surfaceCount:l.length,readySurfaceCount:d,totalSurfaceAreaM2:u,candidateCount:e.candidateCount,activeCandidateCount:e.activeCandidateCount,candidateStrideFloats:e.rowStrideFloats,candidateShape:e.candidateShape,elementCount:a.length,elementLayout:[...s],elementStrideFloats:Hn,elementRows:Float32Array.from(i),elements:a,interfaceSourceKeySchema:e.interfaceSourceKeySchema??null,interfaceSourceKeySourceStatus:e.interfaceSourceKeyStatus??null,interfaceSourceKeyStatus:e.interfaceSourceKeyStatus??null,interfaceSourceKeyReason:e.interfaceSourceKeyReason??null,interfaceSourceKeyRows:e.interfaceSourceKeyRows instanceof Float32Array?e.interfaceSourceKeyRows:new Float32Array,interfaceSourceKeyReadback:!!e.interfaceSourceKeyReadback,interfaceSourceKeyRowCount:e.interfaceSourceKeyRowCount??0,interfaceSourceKeyReadyCount:e.interfaceSourceKeyReadyCount??0,interfaceSourceKeyStrideFloats:e.interfaceSourceKeyStrideFloats??Bn,interfaceSourceKeyBufferRetained:!!e.interfaceSourceKeyBufferRetained,interfaceSourceKeyBufferByteLength:e.interfaceSourceKeyBufferByteLength??0,interfaceSourceKeySurfaceIndexFallbackEnabled:e.interfaceSourceKeySurfaceIndexFallbackEnabled!==!1,forceCouplingStatus:d>0?`blocked-pressure-force-solver-not-implemented`:`blocked-material-surface-normals-not-resolved`,surfaces:l,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1};return e.interfaceSourceKeyBuffer&&(f.interfaceSourceKeyBuffer=e.interfaceSourceKeyBuffer),typeof e.destroyMaterialInterfaceCandidateFieldBuffers==`function`&&(f.destroyMaterialInterfaceFieldBuffers=({reason:t=`material-interface-field-buffer-cleanup`}={})=>e.destroyMaterialInterfaceCandidateFieldBuffers({reason:t})),f}async function ia({device:e,renderField:t,fieldRowsBuffer:n=null,surfaceBuffer:r=null,isolationScale:i=1,source:a=`resident-physics-material-interface-extractor`,sourceCadence:o=`resident-physics-stage`,candidateReadbackByteBudget:s=Un,candidateReadbackMode:c=yr,compactCandidateCapacity:l=null}={}){let u=t?.schema===`peercompute.ulg.sph-material-interface-source-field.v0`?t:null,d=u?.sourceRenderField||t,f=n||u?.fieldRowsBuffer||null,p=r||u?.surfaceBuffer||null,m=li(d),h=c===br?br:c===xr?xr:yr;if(h===xr)return fi({sourceField:u,sourceRenderField:d,resolvedFieldRowsBuffer:f,resolvedSurfaceBuffer:p,source:a,sourceCadence:o,candidateRowsByteLength:m,candidateReadbackByteBudget:s,candidateReadbackMode:h,compactCandidateCapacity:l});let g=h===br?br:yr,_=g===br?null:ui({device:e,candidateRowsByteLength:m,candidateReadbackByteBudget:s});if(_)return di({sourceField:u,sourceRenderField:d,resolvedFieldRowsBuffer:f,resolvedSurfaceBuffer:p,source:a,sourceCadence:o,candidateRowsByteLength:m,candidateReadbackByteBudget:s,candidateReadbackBlocker:_,candidateReadbackMode:g});let v=null;if(g===br){if(v=await Vi({device:e,renderField:d,fieldRowsBuffer:f,surfaceBuffer:p,sourceIndexFieldBuffer:u?.sourceIndexFieldBuffer||d?.sourceIndexFieldBuffer||null,isolationScale:i,compactCandidateCapacity:l}),v.status===`material-interface-compact-candidate-field-overflow`){let t=ui({device:e,candidateRowsByteLength:m,candidateReadbackByteBudget:s});if(t)return di({sourceField:u,sourceRenderField:d,resolvedFieldRowsBuffer:f,resolvedSurfaceBuffer:p,source:a,sourceCadence:o,candidateRowsByteLength:m,candidateReadbackByteBudget:s,candidateReadbackBlocker:t,candidateReadbackMode:g,compactCandidateField:v});v.destroyMaterialInterfaceCandidateFieldBuffers?.({reason:`compact-candidate-overflow-switching-to-dense-fallback`}),v=await Ri({device:e,renderField:d,fieldRowsBuffer:f,surfaceBuffer:p,isolationScale:i}),v.compactFallbackStatus=`fallback-dense-readback-after-compact-overflow`}}else v=await Ri({device:e,renderField:d,fieldRowsBuffer:f,surfaceBuffer:p,isolationScale:i});let y=ra(v),b=v.candidateReadbackMode===br;return{...y,backend:b?`webgpu-compact-candidate-readback`:`webgpu-candidate-readback`,authority:`resident-physics-material-interface-extractor`,source:a,sourceCadence:o,sourceFieldSchema:u?.schema??null,sourceFieldStatus:u?.status??null,sourceFieldBackend:u?.backend??null,sourceFieldPipelineCacheStatus:u?.sourceRenderFieldPipelineCacheStatus??u?.pipelineCacheStatus??null,sourceRenderFieldSchema:d?.schema??null,sourceRenderFieldBackend:d?.backend??null,sourceRenderFieldPipelineCacheStatus:d?.pipelineCacheStatus??u?.sourceRenderFieldPipelineCacheStatus??null,sourceRenderFieldReadback:!!d?.renderFieldReadback,sourceFieldRowsBufferBound:!!f,sourceSurfaceBufferBound:!!p,candidateBackend:v.backend,candidateReadback:!!v.candidateReadback,candidateReadbackMode:v.candidateReadbackMode??h,candidateRowsByteLength:m,candidateDenseRowsByteLength:v.candidateDenseRowsByteLength??m,candidateCompactRowsByteLength:v.candidateCompactRowsByteLength??null,candidateCompactCapacity:v.compactCandidateCapacity??null,candidateCompactOverflowCount:v.compactCandidateOverflowCount??0,candidateCompactFallbackStatus:v.compactFallbackStatus??null,candidateMetadataReadback:!!v.candidateMetadataReadback,candidatePipelineCacheStatus:v.pipelineCacheStatus??null,queueCompletionStatus:v.queueCompletionStatus??null,queueCompletionMethod:v.queueCompletionMethod??null,normalDerivation:`physics-owned-field-cell-crossing-candidates`,surfaceAreaDerivation:`physics-owned-fixed-cell-face-area-sum`,physicsStage:`material-interface-extraction`,pressureInterfaceProducer:!0}}async function aa({device:e,renderRows:t,renderRowsBuffer:n=null,renderRowsSource:r=null,dispersedMediumOptics:i=null,dispersedMediumOpticsRows:a=null,dispersedMediumOpticsBuffer:o=null,dispersedMediumOpticsAuthority:s=null,schroederSpatialSourceFamily:c=r?.schroederSpatialSourceFamily??null,productEventRows:l=null,productEventBuffer:u=null,productEventSource:f=null,productEventLiveCountDescriptor:p=null,surfaceTable:h,particleCount:_=null,productEventCount:v=null,fieldPadding:y=.22,refEdgeM:b=10,renderSmearDtS:x=0,readbackMode:S=_r,retainFieldRowsBuffer:C=!1,retainMotionFieldBuffer:w=!1,retainSurfaceBuffer:T=!1,waitForQueueCompletion:E=!0,deferCleanup:D=!0,useQueueFenceForCleanup:O=!0,targetFieldRowsBuffer:k=null,targetFieldRowsBufferByteLength:A=null,preferSpatialGrid:j=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphRenderFieldWebGpu requires a WebGPU-like device`);if(typeof w!=`boolean`)throw TypeError(`retainMotionFieldBuffer must be a boolean`);if(!n&&!(t instanceof Float32Array))throw TypeError(`buildSphRenderFieldWebGpu requires renderRows or renderRowsBuffer`);if(t&&t.length%jn!==0)throw RangeError(`SPH render rows length must align to the render row stride`);if(l&&(!(l instanceof Float32Array)||l.length%Fn!==0))throw RangeError(`SPH product-event rows length must align to the product-event row stride`);Ai(h),{fieldPadding:y,refEdgeM:b}=Fr(y,b);let M=$n(h),N=Float32Array.from(M.recordValues),P=t?.length?t.length/jn:0,F=Pr(_??r?.particleCount??P,`particleCount`),I=F*jn*Float32Array.BYTES_PER_ELEMENT;if(!n&&P!==F)throw RangeError(`particleCount must match exact host rows or fit the resident render-row buffer capacity`);let te=l?.length?l.length/Fn:0,re=Pr(v??te,`productEventCount`);if(!u&&re!==te)throw RangeError(`productEventCount must exactly match the host product-event rows`);let ae=Mi(a,F);if(i&&(o!=null&&o!==i.buffer||s!=null&&s!==i.authority))throw TypeError(`SPH render field rejected torn dispersed-medium child aliases`);let L=i?.buffer??o??null,R=i?.authority??s??null;if((L||R)&&!i)throw TypeError(`resident dispersed-medium rendering requires the exact branded child descriptor; buffer and authority aliases only corroborate it`);let B=!!(i||a||L||R);if(a&&(i||L||R))throw TypeError(`SPH render field accepts either dispersed-medium host rows or one authenticated resident buffer, not both`);let V=F*8*Float32Array.BYTES_PER_ELEMENT,ce=Number(L?.size);if((i||L||R)&&(i!=null&&(i.particleCount!==F||i.rowCount!==F||i.rowStrideFloats!==8||i.bufferByteLength!==V)||!L||!R||!H(e,R,{upload:i,buffer:L,particleCount:F,rowCount:F,rowStrideFloats:8,bufferByteLength:V})||!Number.isSafeInteger(ce)||ce!==V))throw TypeError(`SPH render field rejected a torn or foreign dispersed-medium optics authority`);B?(Ni(h,ae??R?.readyOpticalStateIds??[]),Pi(h,y,b,ae??R?.readyOpticalStateIds??[])):Ni(h);let le=S===vr,ue=n||null,U=u||null,W=p??(U&&f?ne(f,e):null);if((f?.productEventLiveCountAuthority||z(f))&&!W)throw TypeError(`SPH render field rejected a torn product-event live-count authority`);if(W&&(!oe(W,{handle:f,device:e})||!(Number(U?.size)>=re*Fn*Float32Array.BYTES_PER_ELEMENT)||f.productEventBuffer!==U||W.controlBuffer==null||W.controlPrefixByteLength!==ie||W.hostObserved!==!1||W.expectedRowCapacity!==re||W.expectedRowStrideVec4!==Fn/4||W.rowCapacity!==re||W.rowStrideFloats!==Fn))throw TypeError(`SPH render field GPU live-count authority does not match its product-event buffer capacity and row ABI`);if(c){if(r?.schroederSpatialSourceFamily!==c||r?.particleCount!==F||n==null)throw TypeError(`successor render field requires exact branded render rows and no unauthenticated product-event source`);if(se(c,{device:e,particleCount:F}),!ar(r,{device:e,sourceFamily:c,particleCount:F,renderRowsBuffer:n,renderRows:n?null:t}))throw TypeError(`successor render field requires module-authenticated render-row derivation`);if(!or({device:e,sourceFamily:c,productEventRows:l,productEventBuffer:U,productEventSource:f,productEventCount:re,productEventLiveCountDescriptor:W}))throw TypeError(`successor render field requires exact branded render rows and no unauthenticated product-event source`)}if(i&&!c){let i=r?.schroederSpatialSourceFamily??null;if(!r||!ar(r,{device:e,sourceFamily:i,particleCount:F,renderRowsBuffer:n,renderRows:n?null:t}))throw TypeError(`resident dispersed-medium rendering requires module-authenticated render-row lineage`)}if(i||r?.dispersedMediumOptics){let e=r?.dispersedMediumOptics??null;if(a!=null||i!==e||L!==(e?.buffer??null)||R!==(e?.authority??null))throw TypeError(`render field requires the exact dispersed-medium sidecar captured with its render rows`)}let de=ue?U?`resident-render-rows-and-product-events-buffer`:`resident-render-rows-buffer`:U?`uploaded-render-rows-with-resident-product-events`:`uploaded-render-rows`,fe=re*Fn*Float32Array.BYTES_PER_ELEMENT,he=U||l?fe:Fn*Float32Array.BYTES_PER_ELEMENT,_e=B?V:8*Float32Array.BYTES_PER_ELEMENT,ye=h.surfaceCount*Mn*Float32Array.BYTES_PER_ELEMENT,K=h.totalFieldCells*Nn*Float32Array.BYTES_PER_ELEMENT,Te=w?h.totalFieldCells*4*Float32Array.BYTES_PER_ELEMENT:0;w&&(ni(e,`render field motion`,Te),ri(e,`render field motion`,Te)),ni(e,`render field cells`,K),ri(e,`render field cells`,K);let Ee=Math.ceil(Math.max(1,h.maxFieldCellCount)/64),De=Math.max(1,h.surfaceCount);ii(e,`render field`,Ee,De),si(e,`render field source rows`,ue,I),si(e,`render field product events`,U,fe),si(e,`render field dispersed-medium optics`,L,V),W&&si(e,`render field product-history control`,W.controlBuffer,ie,{offset:W.controlOffsetBytes??0});let Oe=0;if(k){let t=oi(k.size,`targetFieldRowsBuffer.size`);if(Oe=A==null?t:oi(A,`targetFieldRowsBufferByteLength`),Oe>t)throw RangeError(`targetFieldRowsBufferByteLength (${Oe}) exceeds the actual GPU buffer capacity (${t})`);if(Oe<K)throw RangeError(`targetFieldRowsBuffer is too small (${Oe}) for render field (${K})`);si(e,`render field target cells`,k,K)}let ke=new Set,Ae=e=>(e&&ke.add(e),e),{sourceRowsBuffer:je,sourceProductEventBuffer:Me,sourceDispersedMediumOpticsBuffer:Ne,productHistoryControlBufferOwned:Pe,productHistoryControlBuffer:Fe,productHistoryGateParamsBuffer:Ie,surfaceBuffer:Le,fieldRowsBufferBorrowed:Re,fieldRowsBuffer:ze,motionFieldBuffer:Be,paramsBuffer:Ve,pipelineCacheStatus:He,encoder:Ue}=(()=>{try{let n=ue||Ae(Zr(e,`ulg-sph-render-field-source-rows`,t,Z.COPY_SRC)),r=U||Ae(l?Zr(e,`ulg-sph-render-field-product-events`,l,Z.COPY_SRC):An(e,{bucketKey:`ulg-sph-render-field-product-events-empty`,label:`ulg-sph-render-field-product-events`,size:Fn*Float32Array.BYTES_PER_ELEMENT,usage:Z.STORAGE|Z.COPY_DST|Z.COPY_SRC})),i=L||Ae(a?Zr(e,`ulg-sph-render-field-dispersed-medium-optics`,a,Z.COPY_SRC):An(e,{bucketKey:`ulg-sph-render-field-dispersed-medium-optics-disabled`,label:`ulg-sph-render-field-dispersed-medium-optics-disabled`,size:8*Float32Array.BYTES_PER_ELEMENT,usage:Z.STORAGE|Z.COPY_DST})),o=!W,s=W?.controlBuffer||Ae(An(e,{bucketKey:`ulg-sph-render-field-product-history-control-disabled`,label:`ulg-sph-render-field-product-history-control-disabled`,size:ie,usage:Z.STORAGE|Z.COPY_DST})),c=Ae(An(e,{bucketKey:`ulg-sph-render-field-product-history-gate-params`,label:`ulg-sph-render-field-product-history-gate-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST}));e.queue.writeBuffer(c,0,gi(W));let u=Ae((()=>{let t=An(e,{bucketKey:`ulg-sph-render-field-surfaces`,label:`ulg-sph-render-field-surfaces`,size:Math.max(4,N?.byteLength??4),usage:Z.STORAGE|Z.COPY_DST});return N?.byteLength>0&&e.queue.writeBuffer(t,0,N),t})()),f=!!k,p=k||Ae(Qr(e,`ulg-sph-render-field-cells`,K,Z.COPY_SRC)),g=w?Ae(Qr(e,`ulg-sph-render-field-motion`,Te,Z.COPY_SRC)):null,_=Ae(An(e,{bucketKey:`ulg-sph-render-field-params`,label:`ulg-sph-render-field-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST})),v=U||l?re:0;e.queue.writeBuffer(_,0,hi({particleCount:F,productEventCount:v,surfaceCount:h.surfaceCount,totalFieldCells:h.totalFieldCells,fieldPadding:y,refEdgeM:b,renderSmearDtS:x,dispersedMediumOpticsEnabled:B}));let S=ci(n,I,{label:`render field source rows`}),C=ci(u,ye,{label:`render field surfaces`}),T=ci(p,K,{label:`render field cells`}),E=ci(r,he,{label:`render field product events`}),D={buffer:s,offset:W?.controlOffsetBytes??0,size:ie},O=ci(i,_e,{label:`render field dispersed-medium optics`}),A=g?ci(g,Te,{label:`render field motion`}):null,M=j?En({device:e,surfaceRecords:N,surfaceCount:h.surfaceCount,particleCount:F,productEventCount:v}):null,ee=e.createCommandEncoder(),P=null;if(M)({pipelineCacheStatus:P}=kn({device:e,encoder:ee,plan:M,sourceRowsResource:S,surfaceResource:C,fieldRowsResource:T,paramsBuffer:_,productEventsResource:E,productHistoryControlResource:D,productHistoryGateParamsBuffer:c,dispersedOpticsResource:O,motionFieldResource:A}));else{let{pipeline:t,bindGroupLayout:n,cacheStatus:r}=me(e,{cacheKey:w?`ulg-sph-render-field-v5-disjoint-bulk-dispersed-optics-motion-v0`:`ulg-sph-render-field-v5-disjoint-bulk-dispersed-optics`,label:`ulg-sph-render-field`,code:w?m:d,entryPoint:`main`,bindings:[G(0,`read-only-storage`),G(1,`read-only-storage`),G(2,`storage`),G(3,`uniform`),G(4,`read-only-storage`),G(5,`read-only-storage`),G(6,`uniform`),G(7,`read-only-storage`),...w?[G(8,`storage`)]:[]]});P=r;let i=pe(e,{label:`ulg-sph-render-field-bg`,layout:n,entries:[{binding:0,resource:S},{binding:1,resource:C},{binding:2,resource:T},{binding:3,resource:{buffer:_}},{binding:4,resource:E},{binding:5,resource:D},{binding:6,resource:{buffer:c}},{binding:7,resource:O},...A?[{binding:8,resource:A}]:[]]}),a=ee.beginComputePass();a.setPipeline(t),a.setBindGroup(0,i),a.dispatchWorkgroups(Ee,De),a.end()}return{sourceRowsBuffer:n,sourceProductEventBuffer:r,sourceDispersedMediumOpticsBuffer:i,productHistoryControlBufferOwned:o,productHistoryControlBuffer:s,productHistoryGateParamsBuffer:c,surfaceBuffer:u,fieldRowsBufferBorrowed:f,fieldRowsBuffer:p,motionFieldBuffer:g,paramsBuffer:_,pipelineCacheStatus:P,encoder:ee}}catch(e){for(let e of ke)e.destroy?.();throw e}})(),We=`not-submitted`,Ge=null,Ke,qe=!1,Je=!1,Ye=!1,Xe=()=>{Ye||(Ye=!0,ue||je.destroy?.(),U||Me.destroy?.(),L||Ne.destroy?.(),Pe&&Fe.destroy?.(),Ie.destroy?.(),Le.destroy?.(),Re||ze.destroy?.(),Be?.destroy?.(),Ve.destroy?.())},Ze=()=>{k&&nr(k)};try{if(le)E&&e.queue?.onSubmittedWorkDone?(e.queue.submit([Ue.finish()]),Je=!0,Ze(),We=`queue-submitted`,Ge=`queue.submit`,await e.queue.onSubmittedWorkDone(),We=`queue-work-completed`,Ge=`queue.onSubmittedWorkDone`):(e.queue.submit([Ue.finish()]),Je=!0,Ze(),We=e.queue?.onSubmittedWorkDone?`queue-submitted-gpu-handoff-no-cpu-fence`:`queue-submitted-no-explicit-completion`,Ge=e.queue?.onSubmittedWorkDone?`queue.submit(in-order-gpu-render-field-handoff)`:`queue.submit`,qe=!!(e.queue?.onSubmittedWorkDone&&D)),Ke=new Float32Array;else{e.queue.submit([Ue.finish()]),Je=!0,Ze(),We=`queue-submitted`,Ge=`queue.submit`;let t=await xi(e,ze,h.totalFieldCells*Nn*Float32Array.BYTES_PER_ELEMENT,`ulg-sph-render-field-readback`);We=`readback-map-completed`,Ge=`mapAsync(readback-buffer)`,Ke=new Float32Array(t)}}catch(t){throw Je?ge(e,Xe):Xe(),t}if(!er(h,M))throw ge(e,Xe),TypeError(`render surface table mutated while its GPU field submission was in flight`);let Qe=!1,$e=Be?Object.freeze({schema:Pn,buffer:Be,byteLength:Te,rowCount:h.totalFieldCells,rowStrideFloats:4,rowStrideBytes:4*Float32Array.BYTES_PER_ELEMENT,fieldPadding:y,refEdgeM:b,sourceGenerationId:c?.sourceGenerationId??null,sourceVelocityLanes:Object.freeze([17,18,19]),momentWeight:`pre-smear-positive-particle-metaball-value`,immutable:!0,readback:!1,authoritativeStateMutation:!1,get destroyed(){return Qe},destroy(){return Qe?!1:(Qe=!0,ve(Be),!0)}}):null,et=!1,tt=()=>{et||(et=!0,ue||ve(je),U||ve(Me),L||ve(Ne),Pe&&ve(Fe),ve(Ie),T||ve(Le),!C&&!Re&&ve(ze),ve(Ve))},nt=!1;qe&&O?nt=ge(e,tt):qe?nt=!0:tt();let rt=be({ledgerId:`sph-render-field:${h.surfaceCount}:${h.totalFieldCells}:buffer-leases`,stateKey:`sph-render-field`,scope:`sph-render-field-buffer-leases`}),it=[],at=({resourceKey:e,resourceKind:t,buffer:n,byteLength:r,rowCount:i,expectedConsumers:a=[]})=>{Ce(rt,{resourceKey:e,resourceKind:t,stateFamily:`render-field`,ownerStage:`render-field-builder`,producerStage:`render-field-builder`,source:`buildSphRenderFieldWebGpu`,status:`resident-render-field-buffer-retained`,retained:!0,byteLength:r,rowCount:i,bufferLabel:n?.label,expectedConsumers:a});for(let t of a){let n=Se(rt,{resourceKey:e,consumerStage:t,reason:`retained-render-field-buffer`});it.push(n.leaseId)}},ot=`render-field:field-rows:${h.totalFieldCells}:${K}`,st=`render-field:surface-table:${h.surfaceCount}:${h.records.byteLength}`;C&&at({resourceKey:ot,resourceKind:`render-field-rows-buffer`,buffer:ze,byteLength:K,rowCount:h.totalFieldCells,expectedConsumers:[`material-interface-extraction`,`surface-vertex-extraction`]}),T&&at({resourceKey:st,resourceKind:`render-field-surface-table-buffer`,buffer:Le,byteLength:h.records.byteLength,rowCount:h.surfaceCount,expectedConsumers:[`surface-vertex-extraction`,`surface-draw-metadata`]});let J={schema:g,backend:`webgpu`,status:`render-field-built`,kernelScope:gr,schroederSpatialLineageMode:c?`authenticated-successor`:`non-schroeder`,schroederSpatialSourceFamily:c,schroederSpatialSourceFamilyStatus:c?.status??null,schroederSpatialSourceFamilyRole:c?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:c?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:c?.successorEpochIdentity??null,particleCount:F,dispersedMediumOpticsBound:B,dispersedMediumOpticsRowCount:B?F:0,dispersedMediumOpticsAuthority:L?`same-device-resident-authority`:a?`host-exact-particle-aligned-rows`:`absent`,dispersedMediumOpticsBufferByteLength:B?F*8*Float32Array.BYTES_PER_ELEMENT:0,productEventCount:U||l?re:0,productEventCountAuthority:W?`gpu-authored-filtered-live-prefix`:`host-exact-or-sparse-scan-bound`,productEventControlAuthentication:W?`full-eight-word-gpu-commit-gate`:`not-required-zero-control`,productEventControlHostObserved:W?.hostObserved??!1,productEventCountHostKnown:!W,productEventRowCapacity:W?.expectedRowCapacity??(U||l?re:0),productEventBufferBound:!!(U||l),productEventBufferByteLength:U||l?re*Fn*Float32Array.BYTES_PER_ELEMENT:0,surfaceCount:h.surfaceCount,totalFieldCells:h.totalFieldCells,maxFieldCellCount:h.maxFieldCellCount,surfaceTable:h,rowLayout:[...ee],rowStrideFloats:Nn,fieldRows:Ke,fieldRowByteLength:K,fieldPadding:y,refEdgeM:b,renderFieldInputSource:de,readbackMode:le?vr:_r,queueCompletionStatus:We,queueCompletionMethod:Ge,pipelineCacheStatus:He,renderFieldDeferredCleanup:nt,renderFieldReadback:!le,fullReadbackPerformed:!le,normalHotLoopReadbackFree:le,fieldRowsBufferRetained:!!C,fieldRowsBufferByteLength:C?K:0,fieldRowsBufferBorrowed:Re,fieldRowsBufferReused:Re,fieldRowsBufferOwnedByResult:!Re,motionField:$e,motionFieldReadback:!1,surfaceBufferRetained:!!T,surfaceBufferByteLength:T?h.records.byteLength:0,residentBufferLeaseLedger:rt,residentBufferLeaseSummary:q(rt),residentBufferLeaseLedgerStatus:rt.status,residentBufferLeaseResourceCount:rt.resourceCount,residentBufferLeaseActiveLeaseCount:rt.activeLeaseCount,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};if(C&&(J.fieldRowsBuffer=ze),T&&(J.surfaceBuffer=Le),J.takeMotionField=()=>{let e=$e;return $e=null,J.motionField=null,e?.destroyed?null:e},C||T||w){let e=new Set,t=()=>(J.residentBufferLeaseSummary=q(rt),J.residentBufferLeaseLedgerStatus=J.residentBufferLeaseSummary.status,J.residentBufferLeaseResourceCount=J.residentBufferLeaseSummary.resourceCount,J.residentBufferLeaseActiveLeaseCount=J.residentBufferLeaseSummary.activeLeaseCount,J.residentBufferLeaseSummary);J.releaseRenderFieldBufferLeases=({status:e=`released`}={})=>{for(let t of it)xe(rt,t,{status:e});return t()};let n=(t,n)=>{e.has(t)||(e.add(t),ve(n))};J.destroyRenderFieldBuffers=({force:e=!1,releaseLeases:r=!1,reason:i=`render-field-buffer-cleanup`}={})=>(lr(J),tt(),$e?.destroy(),$e=null,J.motionField=null,r&&J.releaseRenderFieldBufferLeases(),C&&we(rt,ot,()=>{Re||n(ot,ze)},{force:e,reason:i}),T&&we(rt,st,()=>{n(st,Le)},{force:e,reason:i}),t())}return c&&(Zn.set(J,{active:!0,device:e,sourceFamily:c,particleCount:F,renderRowsSource:r,renderRowsBuffer:ue,renderRows:ue?null:t,dispersedMediumOpticsBuffer:L,dispersedMediumOptics:i,dispersedMediumOpticsRows:a,dispersedMediumOpticsAuthority:R,dispersedMediumOpticsSourceAuthenticated:!!(L&&R&&i&&i===r?.dispersedMediumOptics),productEventBuffer:U,productEventRows:l,productEventSource:f,productEventLiveCountDescriptor:W,productEventSourceAuthenticated:!!(U&&W),productEventCount:U||l?re:0,productEventRowCapacity:W?.expectedRowCapacity??(U||l?re:0),productEventCountAuthority:W?`gpu-authored-filtered-live-prefix`:`host-exact-or-sparse-scan-bound`,productEventControlAuthentication:W?`full-eight-word-gpu-commit-gate`:`not-required-zero-control`,surfaceTable:h,surfaceRecords:h.records,surfaceTableSnapshot:M,surfaceBuffer:J.surfaceBuffer??null,fieldRowsBuffer:J.fieldRowsBuffer??null,fieldRows:J.fieldRows,fieldRowByteLength:K,fieldRowsBufferByteLength:J.fieldRowsBufferByteLength,rowStrideFloats:Nn,fieldPadding:y,refEdgeM:b}),J.fieldRowsBuffer&&tr({buffer:J.fieldRowsBuffer,artifact:J,invalidate:()=>lr(J)})),J}async function oa({device:e,sphParticleState:r,mlsMpmParticleState:i=null,sphParticleUpload:a=null,mlsMpmParticleUpload:o=null,sourceStateBuffer:s=null,sourceThermoBuffer:c=null,sourceIdentityBuffer:l=null,sourceMechanicsBuffer:u=null,schroederSpatialSourceFamily:d=null,retainRenderRowsBuffer:f=!1,readbackMode:p=_r,renderDomainBaseCount:m=0,renderDomainDropCount:h=0}={}){if(Dr(r),!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`extractSphRenderRowsWebGpu requires a WebGPU-like device`);let g=Pr(r.particleCount,`SPH render-row particleCount`),_=p===vr,v=s||a?.stateBuffer||null,y=c||a?.thermoBuffer||null,b=l||a?.identityBuffer||null,x=jr({device:e,sphParticleUpload:a,particleCount:g,identityBuffer:b});if(x&&!B(a,{device:e,stateBuffer:v,thermoBuffer:y,identityBuffer:b}))throw TypeError(`SPH render rows rejected dispersed-medium optics paired with foreign particle-aligned source buffers`);let S=i?.mechanics instanceof Float32Array&&i.mechanics.length>=g*ue,C=u||o?.mechanicsBuffer||null;if(d){if(_&&!f)throw TypeError(`successor render rows require a retained GPU handoff buffer when full readback is disabled`);se(d,{device:e,particleCount:g,stateBuffer:v,thermoBuffer:y,identityBuffer:b,mechanicsBuffer:C})}let w=Ar({sphParticleState:r,sphParticleUpload:a}),T=kr({sphParticleState:r,sphParticleUpload:a});if(w){let e=[v?null:`state`,y?null:`thermo`,T&&!C?`mechanics`:null,b?null:`identity`].filter(Boolean);if(e.length>0)throw TypeError(`SPH render rows require authoritative resident ${e.join(`, `)} buffers`);let t=a?.identitySchema||r?.identitySchema||null,n=Math.max(0,Math.round(Q(a?.identityStrideBytes??r?.identityStrideBytes,0))),i=Math.max(0,Math.round(Q(a?.identityBufferByteLength??b?.size??r?.identityBufferByteLength??r?.identity?.byteLength,0))),o=U*Uint32Array.BYTES_PER_ELEMENT;if(t!==`peercompute.ulg.sph-gpu-particle-identity-buffer.v0`)throw TypeError(`SPH render rows require the authoritative particle identity schema`);if(n!==o)throw TypeError(`SPH render rows require the authoritative particle identity stride`);if(i<g*o)throw RangeError(`SPH render rows require identity capacity for every resident particle`)}let E=r.materialPropertyBankParticleSizeTable?.rows,D=Pr(r.materialPropertyBankParticleSizeTable?.rowCount??0,`packed material-bank particle-size row count`),O=a?.materialPropertyBankParticleSizeBuffer||null,k=O?Pr(a?.materialPropertyBankParticleSizeRowCount??0,`resident material-bank particle-size row count`):0,A=O?k:E?.byteLength>0?D:0,j=g*de*Float32Array.BYTES_PER_ELEMENT,M=g*W*Float32Array.BYTES_PER_ELEMENT,N=g*U*Uint32Array.BYTES_PER_ELEMENT,ee=g*ue*Float32Array.BYTES_PER_ELEMENT,P=C||S?ee:ue*Float32Array.BYTES_PER_ELEMENT,I=A*16*Float32Array.BYTES_PER_ELEMENT,te=A>0?I:16*Float32Array.BYTES_PER_ELEMENT,ne=g*jn*Float32Array.BYTES_PER_ELEMENT,ie=Math.ceil(g/64);if(ii(e,`render rows`,ie),ni(e,`ulg-sph-render-rows`,Math.max(4,ne)),ri(e,`ulg-sph-render-rows`,Math.max(4,ne)),si(e,`render rows source state`,v,j),si(e,`render rows source thermo`,y,M),si(e,`render rows source identity`,b,N),si(e,`render rows source mechanics`,C,ee),si(e,`render rows material-bank particle-size rows`,O,I),!O&&A>0&&(!(E instanceof Float32Array)||E.byteLength<I))throw RangeError(`packed material-bank particle-size rows do not cover their advertised row count`);let oe=new Set,L=e=>(e&&oe.add(e),e),{stateBuffer:R,thermoBuffer:z,identityBuffer:V,mechanicsBuffer:ce,materialBankParticleSizeBuffer:H,renderRowsBuffer:fe,useGpuHandoffBuffer:he,retainedRenderRowsBuffer:_e,maxSupportRadiusM:ye,maxGasRadiusM:K,paramsBuffer:q,encoder:be}=(()=>{try{let t=v||L(Zr(e,`ulg-sph-render-source-state`,r.state)),a=y||L(Zr(e,`ulg-sph-render-source-thermo`,r.thermo)),o=b||L(Zr(e,`ulg-sph-render-source-identity`,Or(r))),s=C||L(Zr(e,S?`ulg-sph-render-source-mechanics`:`ulg-sph-render-source-mechanics-empty`,S?i.mechanics:new Float32Array(ue))),c=O||(A>0&&E?.byteLength>0?L(Zr(e,`ulg-sph-render-material-bank-particle-size-rows`,E)):L(An(e,{bucketKey:`ulg-sph-render-material-bank-particle-size-rows-empty`,label:`ulg-sph-render-material-bank-particle-size-rows-empty`,size:16*Float32Array.BYTES_PER_ELEMENT,usage:Z.STORAGE|Z.COPY_DST}))),l=L(An(e,{bucketKey:`ulg-sph-render-rows`,label:`ulg-sph-render-rows`,size:Math.max(4,ne),usage:Z.STORAGE|Z.COPY_DST|Z.COPY_SRC})),u=_&&f&&ne>0,d=u?L(e.createBuffer({label:`ulg-sph-render-rows-retained-handoff`,size:Math.max(4,ne),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST})):l,p=Q(r.smoothingLengthM,0)*ur,x=Q(r.smoothingLengthM,0)*dr,w=L(An(e,{bucketKey:`ulg-sph-render-rows-params`,label:`ulg-sph-render-rows-params`,size:fr,usage:Z.UNIFORM|Z.COPY_DST}));e.queue.writeBuffer(w,0,pi({particleCount:g,renderDomainBaseCount:m,renderDomainDropCount:h,hasMechanics:!!(C||S),maxSupportRadiusM:p,maxGasRadiusM:x,materialBankParticleSizeRowCount:A}));let{pipeline:T,bindGroupLayout:D}=me(e,{cacheKey:`ulg-sph-render-rows-v1`,label:`ulg-sph-render-rows`,code:n,entryPoint:`main`,bindings:[G(0,`read-only-storage`),G(1,`read-only-storage`),G(2,`storage`),G(3,`uniform`),G(4,`read-only-storage`),G(5,`read-only-storage`),G(6,`read-only-storage`)]}),k=pe(e,{label:`ulg-sph-render-rows-bg`,layout:D,entries:[{binding:0,resource:ci(t,j,{label:`render rows source state`})},{binding:1,resource:ci(a,M,{label:`render rows source thermo`})},{binding:2,resource:ci(l,ne,{label:`render rows output`})},{binding:3,resource:{buffer:w}},{binding:4,resource:ci(s,P,{label:`render rows source mechanics`})},{binding:5,resource:ci(c,te,{label:`render rows material-bank particle-size rows`})},{binding:6,resource:ci(o,N,{label:`render rows source identity`})}]}),ee=e.createCommandEncoder();l&&typeof ee.clearBuffer==`function`&&ee.clearBuffer(l);let F=ee.beginComputePass();return F.setPipeline(T),F.setBindGroup(0,k),F.dispatchWorkgroups(ie),F.end(),u&&ee.copyBufferToBuffer(l,0,d,0,ne),{stateBuffer:t,thermoBuffer:a,identityBuffer:o,mechanicsBuffer:s,materialBankParticleSizeBuffer:c,renderRowsBuffer:l,useGpuHandoffBuffer:u,retainedRenderRowsBuffer:d,maxSupportRadiusM:p,maxGasRadiusM:x,paramsBuffer:w,encoder:ee}}catch(e){for(let e of oe)e.destroy?.();throw e}})(),xe,Se=`not-submitted`,Ce=null,we=!1,Te=null,Ee=null,De=null,Oe=!1,ke=()=>{if(Oe)return;Oe=!0,De?.(),De=null;let t=Te??Ee;t&&ae(d,t,{device:e}),Te=null,Ee=null;let n=new Set([v?null:R,y?null:z,b?null:V,C?null:ce,O?null:H,fe,_e,q]);for(let e of n)e?.destroy?.()};try{x&&(De=le(e,x)),d&&(Te=re(d,{device:e,consumerStage:`sph-render-rows-gpu-submission`}))}catch(e){throw ke(),e}try{e.queue.submit([be.finish()])}catch(e){throw ke(),e}if(Te){let t=Te;Te=null,f?Ee=t:ge(e,()=>{ae(d,t,{device:e})})}try{if(_)f?(Se=`queue-submitted-gpu-handoff-no-cpu-fence`,Ce=he?`queue.submit(in-order-gpu-copy-handoff)`:`queue.submit(in-order-gpu-buffer-handoff)`,we=!0):e.queue?.onSubmittedWorkDone?(await e.queue.onSubmittedWorkDone(),Se=`queue-work-completed`,Ce=`queue.onSubmittedWorkDone`):(Se=`queue-submitted`,Ce=`queue.submit`),xe=new Float32Array;else{Se=`queue-submitted`,Ce=`queue.submit`;let t=await xi(e,fe,ne);xe=new Float32Array(t),Se=`readback-map-completed`,Ce=`mapAsync(readback-buffer)`}}catch(t){throw ge(e,ke),t}let Ae=null,je=!1,Me=[],Ne=()=>{for(let e of Me)ve(e);Me.length=0},Pe=()=>{je||(je=!0,Ae&&sr(Ae),Ne(),ve(_e),De?.(),De=null,Ee&&=(ae(d,Ee,{device:e}),null))},Fe=e=>{e?.destroy&&(we?Me.push(e):ve(e))};v||Fe(R),y||Fe(z),b||Fe(V),C||Fe(ce),O||Fe(H),he&&Fe(fe),f||Pe(),Fe(q);let Ie={schema:t,backend:`webgpu`,status:`render-rows-extracted`,kernelScope:hr,particleCount:r.particleCount,dispersedMediumOptics:x,dispersedMediumOpticsBound:!!x,dispersedMediumOpticsRowCount:x?.rowCount??0,dispersedMediumOpticsRowStrideFloats:x?.rowStrideFloats??0,dispersedMediumOpticsBufferByteLength:x?.bufferByteLength??0,dispersedMediumOpticsSource:x?`exact-sph-particle-upload-child`:`absent`,dispersedMediumOpticsHostReadback:!1,schroederSpatialSourceFamily:d,schroederSpatialSourceFamilyStatus:d?.status??null,schroederSpatialSourceFamilyRole:d?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:d?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:d?.successorEpochIdentity??null,schroederSpatialSourceFamilyAncestorGenerationId:d?.ancestorSpatialGenerationId??null,schroederSpatialSourceFamilyPositionAuthority:d?.positionAuthority??null,schroederSpatialSourceFamilySpatialQueryAuthority:d?.spatialQueryAuthority??null,schroederSpatialSourceFamilyPositionEpoch:d?.positionEpoch??null,schroederSpatialSourceFamilyTopologyEpoch:d?.topologyEpoch??null,rowLayout:[...F],rowStrideFloats:jn,renderRows:xe,renderRowByteLength:ne,renderRowsReadbackByteLength:xe.byteLength,renderRowsBufferRetained:!!f,renderRowsBufferByteLength:ne,readbackMode:_?vr:_r,renderRowsReadback:!_,compactRenderReadback:!_,fullReadbackPerformed:!_,normalHotLoopReadbackFree:_,renderRowsIncludeMechanicsVolume:!!(C||S),renderRowsIncludeParticleIdentity:!0,particleIdentityBufferSource:b?l?`explicit-source-buffer`:`sph-particle-upload`:`packed-sph-particle-state`,residentParticleAuthorityRequired:w,particleIdentityStrideUints:U,materialPropertyBankParticleSizeConsumer:mi({rowCount:A,bufferSource:O?`sph-particle-upload`:A>0?`packed-sph-particle-state`:`empty-buffer`}),renderRowsGpuHandoffCopy:he,renderRowsHandoffMode:he?`gpu-copy-barrier`:`direct-render-row-buffer`,queueCompletionStatus:Se,queueCompletionMethod:Ce,renderRowsDeferredCleanup:we,particleScaleStability:Xr({particleCount:r.particleCount,rowProducer:`webgpu-shader`,maxSupportRadiusM:ye,maxGasRadiusM:K}),scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};if(f&&(Ie.renderRowsBuffer=_e,Ie.renderRowsBufferOwned=!0,Ie.destroyRenderRowsBuffer=Pe),d||x){let t={active:!0,device:e,sourceFamily:d,particleCount:r.particleCount,renderRowsBuffer:Ie.renderRowsBuffer??null,renderRows:Ie.renderRows,renderRowValues:Ie.renderRowsBuffer==null?Object.freeze(Array.from(Ie.renderRows)):null,dispersedMediumOptics:x,dispersedMediumOpticsBuffer:x?.buffer??null,dispersedMediumOpticsAuthority:x?.authority??null,rowStrideFloats:Ie.rowStrideFloats,rowLayout:Object.freeze([...Ie.rowLayout])};if(Yn.set(Ie,t),Ae=Ie,t.renderRowsBuffer){let e=Xn.get(t.renderRowsBuffer);e&&e!==Ie&&sr(e),Xn.set(t.renderRowsBuffer,Ie)}}return Ie}var sa=Object.freeze({STORAGE:128,UNIFORM:64,COPY_DST:8}),ca=new WeakMap,la=new WeakMap;function ua(e,t){let n=K(e),r=la.get(n);r||(r=new Map,la.set(n,r));let i=r.get(t);return i||(i=e.createBuffer({label:`ulg-solid-isosurface-field-splat-params-${t}`,size:80,usage:sa.UNIFORM|sa.COPY_DST}),r.set(t,i)),i}function da(e){let t=ca.get(e);return t||(t=e.createBuffer({label:`ulg-solid-isosurface-dummy-thermo`,size:16,usage:sa.STORAGE|sa.COPY_DST}),ca.set(e,t)),t}var fa=`
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
`;function pa({device:e,encoder:t,family:n,renderField:r}={}){if(!e||!t||!n||n.destroyed||n.device!==e||!(n.memberCount>0)||!n.frameBuffer||!n.memberBuffer||!n.latticeBuffer||!r?.fieldRowsBuffer||!Array.isArray(r?.surfaceTable?.metadata))return null;let i=Number(r.refEdgeM),a=Number(r.fieldPadding);if(!(i>0)||!Number.isFinite(a))return null;let o=Array.isArray(n.materials)&&n.materials.length>0?n.materials:[null],s=new Map;for(let e=0;e<o.length;e+=1){let t=o[e],r=e===0&&Number(n.thermal?.materialId)>0?Number(n.thermal.materialId):t?N(t):0;if(!(r>0))continue;let i=s.get(r);i||(i={materialId:r,materialKey:t,bodyIndices:[],usesFamilyThermal:e===0&&!!n.thermalStage?.thermoBuffer},s.set(r,i)),i.bodyIndices.push(e),e===0&&n.thermalStage?.thermoBuffer&&(i.usesFamilyThermal=!0)}if(s.size===0)return null;let c=me(e,{cacheKey:`ulg-solid-isosurface-field-splat.v2`,label:`ulg-solid-isosurface-field-splat`,code:fa,entryPoint:`splat_rigid_solid_isosurface`,bindings:[G(0,`uniform`),G(1,`read-only-storage`),G(2,`read-only-storage`),G(3,`read-only-storage`),G(4,`read-only-storage`),G(5,`storage`)]}),l=[];for(let o of s.values()){let u=r.surfaceTable.metadata.find(e=>Number(e?.materialId)===o.materialId&&Number(e?.phaseId)===1&&Number(e?.opticalStateId||0)===0);if(!u)continue;let d=Math.floor(Number(u.resolution)||0),f=Math.floor(Number(u.fieldOffset)||0);if(!(d>0))continue;let p=Number(u.isolation)||.25,m=Number(u.subtract)||12,h=Number(u.strength)||.02,g=Number(u.particleRadiusScale)>0?Number(u.particleRadiusScale):0,_=Array.isArray(u.colorLinear)&&u.colorLinear.length>=3?u.colorLinear:[.78,.9,.98],v=o.usesFamilyThermal&&!!n.thermalStage?.thermoBuffer,y=v?n.thermalStage.thermoBuffer:da(e),b=o.bodyIndices[0]??0,x=Number(n.bodyTemperaturesK?.[b]),S=Number.isFinite(x)&&x>0?x:Number(n.thermal?.meltTemperatureK)?Math.min(273.15,Number(n.thermal.meltTemperatureK)-10):273.15,C=[0,0,0,0];if(s.size>1)for(let e of o.bodyIndices){let t=e>>>5;t<4&&(C[t]=(C[t]|1<<(e&31))>>>0)}let w=ua(e,o.materialId),T=new ArrayBuffer(80),E=new Uint32Array(T),D=new Float32Array(T);E.set([n.memberCount,d,f,+!!v],0),D.set([a,i,p,m],4),D.set([h,g,S,0],8),D.set([Number(_[0])||.78,Number(_[1])||.9,Number(_[2])||.98,0],12),E.set(C,16),e.queue.writeBuffer(w,0,T);let O=pe(e,{label:`ulg-solid-isosurface-field-splat-bg-${o.materialId}`,layout:c.bindGroupLayout,entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:n.frameBuffer}},{binding:2,resource:{buffer:n.memberBuffer}},{binding:3,resource:{buffer:n.latticeBuffer}},{binding:4,resource:{buffer:y}},{binding:5,resource:{buffer:r.fieldRowsBuffer}}]}),k=t.beginComputePass({label:`ulg-solid-isosurface-field-splat-${o.materialId}`});k.setPipeline(c.pipeline),k.setBindGroup(0,O),k.dispatchWorkgroups(Math.ceil(d**3/64)),k.end(),l.push(w)}return l.length===0?null:{surfaceCount:l.length,destroy(){}}}var ma=F.length;P.length;var ha=ee.length,ga=y.length,_a=`full-parity-readback`,va=`no-full-readback`,ya=`sph-resident-material-interface-source-local-splat`,ba=1024,xa=new WeakMap;function Sa(e,{device:t,sourceFamily:n,particleCount:r,fieldRowsBuffer:i=null,fieldRows:a=null,surfaceBuffer:o=null,surfaceTable:s=null}={}){let c=xa.get(e);return!!(c&&c.active===!0&&c.device===t&&c.sourceFamily===n&&c.particleCount===r&&e?.schroederSpatialSourceFamily===c.sourceFamily&&e?.particleCount===c.particleCount&&(e?.fieldRowsBuffer??null)===c.fieldRowsBuffer&&e?.fieldRows===c.fieldRows&&(e?.surfaceBuffer??null)===c.surfaceBuffer&&e?.surfaceTable===c.surfaceTable&&e?.rowStrideFloats===c.rowStrideFloats&&e?.fieldRowByteLength===c.fieldRowByteLength&&e?.fieldRowsBufferByteLength===c.fieldRowsBufferByteLength&&e?.fieldPadding===c.fieldPadding&&e?.refEdgeM===c.refEdgeM&&e?.productEventCount===0&&e?.productEventBufferBound===!1&&er(e?.surfaceTable,c.surfaceTableSnapshot)&&(i==null||c.fieldRowsBuffer===i)&&(a==null||c.fieldRows===a)&&(o==null||c.surfaceBuffer===o)&&(s==null||c.surfaceTable===s)&&(c.fieldRowsBuffer==null||rr(c.fieldRowsBuffer,e)))}function Ca(e){let t=xa.get(e);!t||t.active!==!0||(t.active=!1,t.fieldRowsBuffer&&ir(t.fieldRowsBuffer,e))}var wa={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},Ta={READ:globalThis.GPUMapMode?.READ??1},Ea=`
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
`,Da=`
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
`;function Oa(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function ka(e){if(e?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`||!(e.records instanceof Float32Array))throw TypeError(`source-local material-interface field requires a render-field surface table`)}function Aa(e,t,n,r=0){let i=Math.max(4,n.byteLength),a=e.createBuffer({label:t,size:i,usage:wa.STORAGE|wa.COPY_DST|r});return n.byteLength>0&&e.queue.writeBuffer(a,0,n),a}function ja(e,t,n,r=0){return e.createBuffer({label:t,size:Math.max(4,n),usage:wa.STORAGE|wa.COPY_DST|r})}function Ma({particleCount:e,productEventCount:t,surfaceCount:n,totalFieldCells:r,fieldPadding:i,refEdgeM:a,densityScale:o,sourceCount:s}){let c=new ArrayBuffer(32),l=new DataView(c);return l.setUint32(0,e,!0),l.setUint32(4,n,!0),l.setUint32(8,r,!0),l.setUint32(12,t,!0),l.setFloat32(16,i,!0),l.setFloat32(20,a,!0),l.setFloat32(24,o,!0),l.setUint32(28,s,!0),c}async function Na(e,t,n,r=`ulg-sph-material-interface-source-local-readback`){let i=e.createBuffer({label:r,size:Math.max(4,n),usage:wa.COPY_DST|wa.MAP_READ}),a=e.createCommandEncoder();a.copyBufferToBuffer(t,0,i,0,Math.max(4,n)),e.queue.submit([a.finish()]),await i.mapAsync(Ta.READ);let o=i.getMappedRange().slice(0,n);return i.unmap(),i.destroy?.(),o}function Pa(e,t){let n=Math.max(0,Math.round(Oa(t,0))),r=0;for(let t of e.metadata||[]){let e=Math.max(1,Math.round(Oa(t.resolution,1))),i=Math.max(0,Math.round(Oa(t.fieldCellCount,e**3))),a=Math.max(1e-12,Oa(t.subtract,1e-12)),o=Math.sqrt(Math.abs(Oa(t.strength,0))/a),s=Math.min(e-1,Math.ceil(o*e)+1);r+=Math.min(i,(s*2+1)**3)*n}let i=Math.max(0,Math.round(Oa(e.totalFieldCells,0)))*n;return{sourceCount:n,estimatedCellVisits:r,denseCellParticlePairs:i,estimatedVisitRatio:i>0?r/i:0}}async function Fa({device:e,renderRows:t,renderRowsBuffer:n=null,renderRowsSource:r=null,schroederSpatialSourceFamily:i=r?.schroederSpatialSourceFamily??null,productEventRows:a=null,productEventBuffer:o=null,surfaceTable:s,particleCount:c=null,productEventCount:l=null,fieldPadding:u=.22,refEdgeM:d=10,readbackMode:f=va,retainFieldRowsBuffer:p=!0,retainSurfaceBuffer:m=!0,retainSourceIndexFieldBuffer:h=!0,waitForQueueCompletion:_=!1,deferCleanup:v=!0,useQueueFenceForCleanup:y=!0,targetFieldRowsBuffer:b=null,targetFieldRowsBufferByteLength:x=null,source:S=`resident-physics-material-interface-source-field`,sourceCadence:C=`resident-physics-stage`}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphMaterialInterfaceSourceFieldLocalWebGpu requires a WebGPU-like device`);if(!n&&!(t instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceSourceFieldLocalWebGpu requires renderRows or renderRowsBuffer`);if(t&&t.length%ma!==0)throw RangeError(`SPH render rows length must align to the render row stride`);if(a&&(!(a instanceof Float32Array)||a.length%ga!==0))throw RangeError(`SPH product-event rows length must align to the product-event row stride`);ka(s);let w=Math.max(0,Math.round(Oa(c??(t?.length?t.length/ma:0),0))),E=Math.max(0,Math.round(Oa(l??(a?.length?a.length/ga:0),0)));if(i){if(r?.schroederSpatialSourceFamily!==i||r?.particleCount!==w||n==null||n&&r?.renderRowsBuffer!==n||E!==0||o!=null||a!=null)throw TypeError(`source-local field requires the exact render-row artifact derived from its successor source family`);if(se(i,{device:e,particleCount:w}),!ar(r,{device:e,sourceFamily:i,particleCount:w,renderRowsBuffer:n,renderRows:n?null:t}))throw TypeError(`source-local field requires module-authenticated successor render rows`)}let D=w+(o||a?E:0),O=f===va,k=s.totalFieldCells*ha*Float32Array.BYTES_PER_ELEMENT,A=s.totalFieldCells*Uint32Array.BYTES_PER_ELEMENT,j=b?Math.max(0,Math.round(Oa(x??b.size??b.byteLength??0,0))):0,M=b?Math.max(0,Math.round(Oa(b.size??b.byteLength??b.byteLengthBytes??0,0))):0;if(b&&M<=0)throw RangeError(`targetFieldRowsBuffer must expose its actual GPU buffer capacity`);if(b&&M>0&&j>M)throw RangeError(`targetFieldRowsBufferByteLength (${j}) exceeds the actual GPU buffer capacity (${M})`);let N=M>0?Math.min(j,M):j;if(b&&N<k)throw RangeError(`targetFieldRowsBuffer is too small (${N}) for source-local material-interface field (${k})`);let P=n||null,F=o||null,I=!!b,te=P||Aa(e,`ulg-sph-material-interface-source-local-render-rows`,t,wa.COPY_SRC),ne=F||Aa(e,`ulg-sph-material-interface-source-local-product-events`,a||new Float32Array(ga),wa.COPY_SRC),ie=Aa(e,`ulg-sph-material-interface-source-local-surfaces`,s.records,wa.COPY_SRC),oe=ja(e,`ulg-sph-material-interface-source-local-density-atomic`,s.totalFieldCells*Uint32Array.BYTES_PER_ELEMENT,wa.COPY_SRC),L=ja(e,`ulg-sph-material-interface-source-local-source-index-atomic`,s.totalFieldCells*Uint32Array.BYTES_PER_ELEMENT,wa.COPY_SRC),R=b||ja(e,`ulg-sph-material-interface-source-local-field-cells`,s.totalFieldCells*ha*Float32Array.BYTES_PER_ELEMENT,wa.COPY_SRC),z=e.createBuffer({label:`ulg-sph-material-interface-source-local-params`,size:32,usage:wa.UNIFORM|wa.COPY_DST});e.queue.writeBuffer(z,0,Ma({particleCount:w,productEventCount:F||a?E:0,surfaceCount:s.surfaceCount,totalFieldCells:s.totalFieldCells,fieldPadding:u,refEdgeM:d,densityScale:ba,sourceCount:D}));let B=me(e,{cacheKey:`ulg-sph-material-interface-source-local-splat-v1`,label:`ulg-sph-material-interface-source-local-splat`,code:Ea,entryPoint:`main`,bindings:[G(0,`read-only-storage`),G(1,`read-only-storage`),G(2,`storage`),G(3,`uniform`),G(4,`read-only-storage`),G(5,`storage`)]}),V=e.createBindGroup({layout:B.bindGroupLayout,entries:[{binding:0,resource:{buffer:te}},{binding:1,resource:{buffer:ie}},{binding:2,resource:{buffer:oe}},{binding:3,resource:{buffer:z}},{binding:4,resource:{buffer:ne}},{binding:5,resource:{buffer:L}}]}),ce=me(e,{cacheKey:`ulg-sph-material-interface-source-local-resolve-v1`,label:`ulg-sph-material-interface-source-local-resolve`,code:Da,entryPoint:`main`,bindings:[G(0,`read-only-storage`),G(1,`storage`),G(2,`storage`),G(3,`uniform`)]}),le=e.createBindGroup({layout:ce.bindGroupLayout,entries:[{binding:0,resource:{buffer:ie}},{binding:1,resource:{buffer:oe}},{binding:2,resource:{buffer:R}},{binding:3,resource:{buffer:z}}]}),H=e.createCommandEncoder(),ue=H.beginComputePass();ue.setPipeline(B.pipeline),ue.setBindGroup(0,V),ue.dispatchWorkgroups(Math.max(1,Math.ceil(Math.max(1,D)/64)),Math.max(1,s.surfaceCount)),ue.end();let U=H.beginComputePass();U.setPipeline(ce.pipeline),U.setBindGroup(0,le),U.dispatchWorkgroups(Math.max(1,Math.ceil(Math.max(1,s.maxFieldCellCount)/64)),Math.max(1,s.surfaceCount)),U.end();let W=`not-submitted`,de=null,fe=new Float32Array,pe=!1,he=null;i&&(he=re(i,{device:e,consumerStage:`sph-material-interface-source-field-gpu-submission`}));try{e.queue.submit([H.finish()])}catch(t){throw he&&=(ae(i,he,{device:e}),null),t}if(b&&nr(b),he){let t=he;he=null,ge(e,()=>{ae(i,t,{device:e})})}if(O)_&&e.queue?.onSubmittedWorkDone?(W=`queue-submitted`,de=`queue.submit`,await e.queue.onSubmittedWorkDone(),W=`queue-work-completed`,de=`queue.onSubmittedWorkDone`):(W=e.queue?.onSubmittedWorkDone?`queue-submitted-gpu-handoff-no-cpu-fence`:`queue-submitted-no-explicit-completion`,de=e.queue?.onSubmittedWorkDone?`queue.submit(in-order-gpu-source-local-field-handoff)`:`queue.submit`,pe=!!(e.queue?.onSubmittedWorkDone&&v));else{W=`queue-submitted`,de=`queue.submit`;let t=await Na(e,R,k,`ulg-sph-material-interface-source-local-field-readback`);fe=new Float32Array(t),W=`readback-map-completed`,de=`mapAsync(readback-buffer)`}let _e=!1,ve=()=>{_e||(_e=!0,P||te.destroy?.(),F||ne.destroy?.(),oe.destroy?.(),z.destroy?.(),m||ie.destroy?.(),!p&&!I&&R.destroy?.(),h||L.destroy?.())},ye=!1;pe&&y?ye=ge(e,ve):pe?ye=!0:ve();let K=Pa(s,D),q={schema:g,backend:`webgpu-source-local`,status:`render-field-built`,kernelScope:ya,sourceLocalSourceField:!0,schroederSpatialSourceFamily:i,schroederSpatialSourceFamilyStatus:i?.status??null,schroederSpatialSourceFamilyRole:i?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:i?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:i?.successorEpochIdentity??null,schroederSpatialSourceFamilyAncestorGenerationId:i?.ancestorSpatialGenerationId??null,schroederSpatialSourceFamilyPositionAuthority:i?.positionAuthority??null,schroederSpatialSourceFamilySpatialQueryAuthority:i?.spatialQueryAuthority??null,schroederSpatialSourceFamilyPositionEpoch:i?.positionEpoch??null,schroederSpatialSourceFamilyTopologyEpoch:i?.topologyEpoch??null,particleCount:w,productEventCount:F||a?E:0,productEventBufferBound:!!(F||a),productEventBufferByteLength:F||a?E*ga*Float32Array.BYTES_PER_ELEMENT:0,surfaceCount:s.surfaceCount,totalFieldCells:s.totalFieldCells,maxFieldCellCount:s.maxFieldCellCount,surfaceTable:s,rowLayout:[...ee],rowStrideFloats:ha,fieldRows:fe,fieldRowByteLength:k,fieldPadding:u,refEdgeM:d,renderFieldInputSource:P?`resident-render-rows-buffer-source-local`:`uploaded-render-rows-source-local`,readbackMode:O?va:_a,queueCompletionStatus:W,queueCompletionMethod:de,pipelineCacheStatus:B.cacheStatus===`pipeline-cache-hit`&&ce.cacheStatus===`pipeline-cache-hit`?`pipeline-cache-hit`:`pipeline-cache-miss`,sourceLocalSplatPipelineCacheStatus:B.cacheStatus,sourceLocalResolvePipelineCacheStatus:ce.cacheStatus,renderFieldDeferredCleanup:ye,renderFieldReadback:!O,fullReadbackPerformed:!O,normalHotLoopReadbackFree:O,fieldRowsBufferRetained:!!p,fieldRowsBufferByteLength:p?k:0,fieldRowsBufferBorrowed:I,fieldRowsBufferReused:I,fieldRowsBufferOwnedByResult:!I,surfaceBufferRetained:!!m,surfaceBufferByteLength:m?s.records.byteLength:0,sourceIndexFieldSchema:`peercompute.ulg.sph-material-interface-source-index-field.v0`,sourceIndexFieldStatus:h?`source-local-source-index-field-retained`:`source-local-source-index-field-transient`,sourceIndexFieldBufferRetained:!!h,sourceIndexFieldBufferByteLength:h?A:0,sourceIndexFieldStrideUints:1,sourceLocalDensityScale:ba,sourceLocalSourceCount:D,sourceLocalEstimatedCellVisits:K.estimatedCellVisits,sourceLocalDenseCellParticlePairs:K.denseCellParticlePairs,sourceLocalEstimatedVisitRatio:K.estimatedVisitRatio,sourceLocalDispatchWorkgroups:{splatX:Math.max(1,Math.ceil(Math.max(1,D)/64)),splatY:Math.max(1,s.surfaceCount),resolveX:Math.max(1,Math.ceil(Math.max(1,s.maxFieldCellCount)/64)),resolveY:Math.max(1,s.surfaceCount)},scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};p&&(q.fieldRowsBuffer=R),m&&(q.surfaceBuffer=ie),h&&(q.sourceIndexFieldBuffer=L),i&&(xa.set(q,{active:!0,device:e,sourceFamily:i,particleCount:w,fieldRowsBuffer:q.fieldRowsBuffer??null,fieldRows:q.fieldRows,surfaceBuffer:q.surfaceBuffer??null,surfaceTable:s,surfaceRecords:s.records,surfaceTableSnapshot:$n(s),renderRowsSource:r,renderRowsBuffer:P,renderRows:P?null:t,productEventBuffer:null,productEventRows:null,productEventCount:0,fieldPadding:u,refEdgeM:d,rowStrideFloats:ha,fieldRowByteLength:k,fieldRowsBufferByteLength:q.fieldRowsBufferByteLength}),q.fieldRowsBuffer&&tr({buffer:q.fieldRowsBuffer,artifact:q,invalidate:()=>Ca(q)}));let be=!1,xe=()=>{be||(be=!0,Ca(q),I||R.destroy?.(),ie.destroy?.(),L.destroy?.())};return{schema:T,backend:`webgpu-source-local`,status:`material-interface-source-field-ready`,source:S,sourceCadence:C,sourceRenderField:q,sourceRenderFieldSchema:q.schema,sourceRenderFieldBackend:q.backend,sourceRenderFieldStatus:q.status,sourceRenderFieldReadback:!!q.renderFieldReadback,sourceRenderFieldReadbackMode:q.readbackMode??null,sourceRenderFieldQueueCompletionStatus:q.queueCompletionStatus??null,sourceRenderFieldQueueCompletionMethod:q.queueCompletionMethod??null,sourceRenderFieldPipelineCacheStatus:q.pipelineCacheStatus??null,kernelScope:ya,sourceLocalSourceField:!0,schroederSpatialSourceFamily:i,schroederSpatialSourceFamilyStatus:i?.status??null,schroederSpatialSourceFamilyRole:i?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:i?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:i?.successorEpochIdentity??null,schroederSpatialSourceFamilyAncestorGenerationId:i?.ancestorSpatialGenerationId??null,schroederSpatialSourceFamilyPositionAuthority:i?.positionAuthority??null,schroederSpatialSourceFamilySpatialQueryAuthority:i?.spatialQueryAuthority??null,schroederSpatialSourceFamilyPositionEpoch:i?.positionEpoch??null,schroederSpatialSourceFamilyTopologyEpoch:i?.topologyEpoch??null,sourceLocalDensityScale:ba,sourceLocalSourceCount:D,sourceLocalEstimatedCellVisits:K.estimatedCellVisits,sourceLocalDenseCellParticlePairs:K.denseCellParticlePairs,sourceLocalEstimatedVisitRatio:K.estimatedVisitRatio,sourceLocalSplatPipelineCacheStatus:B.cacheStatus,sourceLocalResolvePipelineCacheStatus:ce.cacheStatus,particleCount:q.particleCount,productEventCount:q.productEventCount,surfaceCount:q.surfaceCount,totalFieldCells:q.totalFieldCells,maxFieldCellCount:q.maxFieldCellCount,surfaceTable:q.surfaceTable,rowLayout:q.rowLayout,rowStrideFloats:q.rowStrideFloats,fieldRows:q.fieldRows,fieldRowByteLength:q.fieldRowByteLength,fieldPadding:q.fieldPadding,refEdgeM:q.refEdgeM,fieldRowsBuffer:q.fieldRowsBuffer||null,surfaceBuffer:q.surfaceBuffer||null,fieldRowsBufferRetained:!!q.fieldRowsBufferRetained,fieldRowsBufferByteLength:q.fieldRowsBufferByteLength??0,fieldRowsBufferBorrowed:!!q.fieldRowsBufferBorrowed,fieldRowsBufferReused:!!q.fieldRowsBufferReused,fieldRowsBufferOwnedByResult:q.fieldRowsBufferOwnedByResult??null,surfaceBufferRetained:!!q.surfaceBufferRetained,surfaceBufferByteLength:q.surfaceBufferByteLength??0,sourceIndexFieldSchema:q.sourceIndexFieldSchema,sourceIndexFieldStatus:q.sourceIndexFieldStatus,sourceIndexFieldBuffer:q.sourceIndexFieldBuffer||null,sourceIndexFieldBufferRetained:!!q.sourceIndexFieldBufferRetained,sourceIndexFieldBufferByteLength:q.sourceIndexFieldBufferByteLength??0,sourceIndexFieldStrideUints:q.sourceIndexFieldStrideUints??1,readbackMode:q.readbackMode??null,queueCompletionStatus:q.queueCompletionStatus??null,queueCompletionMethod:q.queueCompletionMethod??null,normalHotLoopReadbackFree:!!q.normalHotLoopReadbackFree,releaseMaterialInterfaceSourceFieldLeases(){return null},destroyMaterialInterfaceSourceFieldBuffers(){return ve(),xe(),null},scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1}}var Ia=`peercompute.ulg.sph-webgpu-marching-cubes-extension-adapter.v0`,La=`peercompute.ulg.sph-webgpu-marching-cubes-extension-execution.v0`,Ra=`peercompute.ulg.sph-webgpu-marching-cubes-extension-preflight.v0`,za=`peercompute.webgpu-marching-cubes.compact-position-rows.v0`,Ba=`peercompute.ulg.sph-webgpu-marching-cubes-extension-translation.v0`,Va=`peercompute.ulg.sph-webgpu-marching-cubes-buffer-volume-descriptor.v0`,Ha=`peercompute.ulg.sph-gpu-render-surface-vertex-row.v0`,Ua=`scalar-buffer`,Wa=`peercompute.webgpu-marching-cubes.layout.scalar-field-f32.v0`,Ga=`full-parity-readback`,Ka=`no-full-readback`,qa={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,VERTEX:globalThis.GPUBufferUsage?.VERTEX??32,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256},Ja={READ:globalThis.GPUMapMode?.READ??1},Ya=64,Xa=new WeakMap,Za=new WeakMap,Qa=new WeakMap,$a=new WeakMap,eo=new WeakMap,to=new WeakMap;function no(e){return ArrayBuffer.isView(e)?new Uint8Array(e.buffer,e.byteOffset,e.byteLength).slice():null}function ro(e,t){if(t==null)return e==null;if(!ArrayBuffer.isView(e)||e.byteLength!==t.byteLength)return!1;let n=new Uint8Array(e.buffer,e.byteOffset,e.byteLength);for(let e=0;e<n.length;e+=1)if(n[e]!==t[e])return!1;return!0}function io(e,t,n){if(!t||typeof t!=`object`)return;let r=e.get(t);r&&r!==n&&(r.active=!1),e.set(t,n)}function ao(e,t){if(!t||typeof t!=`object`)return;let n=e.get(t);n&&(n.active=!1),e.delete(t)}function oo(e){return!!(e?.schroederSpatialSourceFamily||e?.schroederSpatialSourceFamilyStatus||e?.schroederSpatialSourceFamilyRole||e?.schroederSpatialSourceGenerationId!=null||e?.schroederSpatialSuccessorEpochIdentity||e?.schroederSpatialSourceFamilyAncestorGenerationId!=null||e?.schroederSpatialSourceFamilyPositionAuthority||e?.schroederSpatialSourceFamilySpatialQueryAuthority!=null||e?.schroederSpatialSourcePositionAuthority||e?.schroederSpatialSourceQueryAuthority!=null)}function so(e){return{schroederSpatialSourceFamily:e??null,schroederSpatialSourceFamilyStatus:e?.status??null,schroederSpatialSourceFamilyRole:e?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:e?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:e?.successorEpochIdentity??null,schroederSpatialSourcePositionAuthority:e?.positionAuthority??null,schroederSpatialSourceQueryAuthority:e?.spatialQueryAuthority??null}}function co(e,t){return e?.schroederSpatialSourceFamily===t&&e?.schroederSpatialSourceFamilyStatus===t?.status&&e?.schroederSpatialSourceFamilyRole===t?.sourceFamilyRole&&e?.schroederSpatialSourceGenerationId===t?.sourceGenerationId&&e?.schroederSpatialSuccessorEpochIdentity===t?.successorEpochIdentity&&e?.schroederSpatialSourcePositionAuthority===t?.positionAuthority&&e?.schroederSpatialSourceQueryAuthority===t?.spatialQueryAuthority}var lo=`
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
`,uo=`
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
`;function fo(e){return(typeof e==`object`||typeof e==`function`)&&e!==null}function $(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function po(e){return typeof e==`string`&&e.length>0?e:null}function mo(e,t=[0,1,0]){let n=Array.isArray(e)||ArrayBuffer.isView(e)?e:t;return[$(n[0],t[0]),$(n[1],t[1]),$(n[2],t[2])]}function ho(e,t){return e.every(Number.isFinite)&&t.every(Number.isFinite)&&e.every((e,n)=>e<=t[n])}function go({min:e=null,max:t=null}={}){let n=mo(e,[NaN,NaN,NaN]),r=mo(t,[NaN,NaN,NaN]),i=ho(n,r);return{enabled:i,status:i?`position-clamp-ready`:`position-clamp-disabled`,minM:i?n:[0,0,0],maxM:i?r:[0,0,0]}}function _o(e,t=[0,1,0]){let n=mo(e,t),r=Math.hypot(n[0],n[1],n[2]);return r>1e-12?[n[0]/r,n[1]/r,n[2]/r]:[...t]}function vo({resolution:e=null,fieldPadding:t=null,refEdgeM:n=null,positionGridBias:r=-.5}={}){let i=Math.max(0,Math.round($(e,0))),a=$(t,NaN),o=$(n,NaN),s=1-2*a;if(!(i>0&&Number.isFinite(a)&&Number.isFinite(o)&&o>0&&s>1e-12))return Object.freeze({enabled:!1,status:`position-transform-disabled`,resolution:i||null,fieldPadding:Number.isFinite(a)?a:null,refEdgeM:Number.isFinite(o)?o:null,scaleM:1,originM:Object.freeze([0,0,0]),gridBias:0});let c=o/(s*i),l=-a*o/s;return Object.freeze({enabled:!0,status:`ulg-render-field-grid-to-world-transform-ready`,resolution:i,fieldPadding:a,refEdgeM:o,scaleM:c,originM:Object.freeze([l,l,l]),gridBias:$(r,-.5)})}function yo(e,t){if(!ho(e,t))return null;let n=[(e[0]+t[0])*.5,(e[1]+t[1])*.5,(e[2]+t[2])*.5];return{minM:[...e],maxM:[...t],centerM:n,radiusM:Math.hypot(t[0]-n[0],t[1]-n[1],t[2]-n[2])}}function bo({positionTransform:e=null,positionClamp:t=null}={}){if(t?.enabled)return yo(t.minM,t.maxM);if(e?.enabled){let t=$(e.scaleM,1),n=mo(e.originM,[0,0,0]),r=Math.max(1,Math.round($(e.resolution,1))),i=Math.max(0,r-1)*t;return yo(n,[n[0]+i,n[1]+i,n[2]+i])}return null}function xo(e,t,n={}){return{schema:Va,ok:!1,status:e,reason:t,sourceType:Ua,scalarLayoutName:Wa,scalarType:`f32`,extensionDescriptorFactory:`createBufferVolumeDescriptor`,...n}}function So(e=null){let t=e?.role??e?.renderDomainRole??null;if(t===`drop`||t===`base`)return t;let n=String(e?.renderDomainKey??e?.surfaceKey??``).toLowerCase();if(n.includes(`drop`))return`drop`;if(n.includes(`base`))return`base`;let r=Math.round($(e?.renderDomainId,0));return r===1?`base`:r===2?`drop`:null}function Co(e){return typeof e==`string`?e.trim().toLowerCase():``}function wo(e,t){if(!e||e.schema!==`peercompute.ulg.algorithm-material-surface-extraction-rows.v0`)return{status:`algorithm-surface-policy-rows-not-supplied`,row:null};let n=Array.isArray(e.rows)?e.rows:[],r=So(t),i=Co(t?.material),a=Co(t?.phase),o=e=>!!i&&Co(e.material)===i&&(!a||Co(e.phase)===a),s=r?n.find(e=>e.role===r&&o(e))||null:n.find(o)||null;return{status:s?`algorithm-surface-policy-row-selected`:`algorithm-surface-policy-row-not-found`,row:s}}function To({device:e=null,renderField:t=null,renderFieldExecution:n=null,surface:r=null,surfaceIndex:i=0,algorithmMaterialSurfaceExtractionRows:a=null,label:o=`ulg-sph-render-field-density-volume`,source:s=`ulg-render-field-density-storage-buffer`}={}){let c=t||n?.result||n?.renderField||null;if(!c)return xo(`ulg-render-field-buffer-volume-blocked-missing-render-field`,`retained ULG render-field metadata is required before native marching-cubes buffer-volume extraction`);let l=c.schroederSpatialSourceFamily??n?.schroederSpatialSourceFamily??null;if(!l&&(oo(c)||oo(n)))return xo(`ulg-render-field-buffer-volume-blocked-partial-successor-lineage`,`native extraction rejects partial Schroeder lineage without the exact branded source family`);if(l){se(l,{device:e,particleCount:c.particleCount??l.particleCount});let t=c.schroederSpatialSourceFieldAuthority??c,n=t.fieldRowsBuffer??null,r={device:e,sourceFamily:l,particleCount:t.particleCount??l.particleCount,fieldRowsBuffer:n,fieldRows:n?null:t.fieldRows,surfaceBuffer:t.surfaceBuffer??null,surfaceTable:t.surfaceTable??null},i=Sa(t,r),a=cr(t,r);if(!i&&!a)return xo(`ulg-render-field-buffer-volume-blocked-successor-lineage`,`native extraction requires the exact module-authenticated successor source field`);c=t}if(c.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)return xo(`ulg-render-field-buffer-volume-blocked-schema`,`ULG buffer-volume extraction requires peercompute.ulg.sph-gpu-render-field.v1 input`,{renderFieldSchema:c.schema??null});let u=l?c.fieldRowsBuffer??null:c.fieldRowsBuffer||n?.fieldRowsBuffer||null;if(!fo(u))return xo(`ulg-render-field-buffer-volume-blocked-missing-buffer`,`retained fieldRowsBuffer is required for native webgpu-marching-cubes scalar-buffer input`,{renderFieldSchema:c.schema,fieldRowsBufferRetained:!!c.fieldRowsBufferRetained,fieldRowsBufferByteLength:c.fieldRowsBufferByteLength??0});let d=l?c.surfaceTable??null:c.surfaceTable||n?.surfaceTable||null,f=Math.max(0,Math.round($(i,0))),p=d?.metadata?.[f]||null;if(l&&r!=null&&r!==p)return xo(`ulg-render-field-buffer-volume-blocked-substituted-successor-surface`,`successor extraction requires the exact surface metadata record owned by the authenticated source field`,{renderFieldSchema:c.schema,surfaceIndex:f});let m=l?p:r||p;if(!m)return xo(`ulg-render-field-buffer-volume-blocked-missing-surface`,`render-field surface metadata is required to locate the scalar sub-volume inside fieldRowsBuffer`,{renderFieldSchema:c.schema,surfaceIndex:f,surfaceCount:d?.surfaceCount??c.surfaceCount??0});let h=Math.max(1,Math.round($(m.resolution,0))),g=Math.max(1,Math.round($(c.rowStrideFloats,ee.length))),_=Math.max(0,Math.round($(m.fieldOffset,0))),v=_*g,y=[g,g*h,g*h*h],b=v+Math.max(0,h-1)*y[0]+Math.max(0,h-1)*y[1]+Math.max(0,h-1)*y[2]+1,x=v*Float32Array.BYTES_PER_ELEMENT,S=b*Float32Array.BYTES_PER_ELEMENT,C=Math.round($(c.fieldRowsBufferByteLength,0)),w=Math.round($(u.size??u.byteLength??u.byteLengthBytes,0)),T=Math.max(0,C),E=Math.max(0,T>0&&w>0?Math.min(T,w):T||w),D=u.device||u.ownerDevice||u.__webgpuDevice||u.__webgpuMarchingCubesDevice||null,O=e&&D?e===D?`same-device`:`cross-device-resource`:`same-device-validation-deferred-to-extension`,k=T>0&&w>0&&T>w,A=E>=S;if(O===`cross-device-resource`)return xo(`ulg-render-field-buffer-volume-blocked-cross-device`,`fieldRowsBuffer is associated with a different GPUDevice than the native marching-cubes adapter`,{renderFieldSchema:c.schema,surfaceIndex:f,sameDeviceStatus:O,scalarBuffer:u,scalarBufferByteLength:E});if(k||!A)return xo(`ulg-render-field-buffer-volume-blocked-undersized-buffer`,k?`render-field metadata claims more scalar bytes than the retained GPU buffer owns`:`fieldRowsBuffer is smaller than the selected render-field surface sub-volume`,{renderFieldSchema:c.schema,surfaceIndex:f,scalarBuffer:u,scalarBufferByteLength:E,scalarRequiredByteLength:S});let j=[h,h,h],M=vo({resolution:h,fieldPadding:c.fieldPadding,refEdgeM:c.refEdgeM}),N=wo(a,m),P=N.row,F=m.isolation==null?null:Number(m.isolation),I=P?.isovalue==null?null:Number(P.isovalue),te=Number.isFinite(F),ne=Number.isFinite(I),re=te?F:null,ie=te?`render-field-surface-isolation`:`isovalue-unavailable`,ae=te?`algorithm-surface-policy-not-applied-render-field-isolation-authoritative`:`algorithm-surface-policy-not-applied-render-field-isolation-required`,oe=te?`the retained scalar field and its authored isolation share the renderer scalar convention`:`native extraction requires the retained render-field isolation; policy rows are not renderer-authoritative for this scalar convention`,L={surfaceExtractionIsovalueSource:ie,surfaceExtractionPolicyStatus:N.status,surfaceExtractionPolicyApplied:!1,surfaceExtractionPolicyApplicationStatus:ae,surfaceExtractionPolicyApplicationReason:oe,surfaceExtractionPolicyRequestedIsovalue:ne?I:null,surfaceExtractionPolicyRendererAuthority:P?.rendererAuthority??null,surfaceExtractionPolicyStrictSourceOfTruth:P?.strictSourceOfTruth??null,surfaceExtractionPolicyRowsSchema:a?.schema??null,surfaceExtractionPolicyRowSchema:P?.schema??null,surfaceExtractionPolicyRole:P?.role??null,surfaceExtractionPolicyMaterial:P?.material??null,surfaceExtractionPolicyPhase:P?.phase??null,surfaceExtractionPolicyIsovaluePolicy:P?.isovaluePolicy??null,surfaceExtractionPolicySmoothingRadiusM:P?.smoothingRadiusM??null,surfaceExtractionPolicyVoxelSizeM:P?.voxelSizeM??null,surfaceExtractionPolicyNormalScaleM:P?.normalScaleM??null};if(!te)return xo(`ulg-render-field-buffer-volume-blocked-missing-isolation`,`retained render-field surface metadata must author a finite isolation for native extraction`,{renderFieldSchema:c.schema,surfaceIndex:f,surfaceKey:m.surfaceKey??null,...L});let R={schema:Va,ok:!0,status:`ulg-render-field-buffer-volume-descriptor-ready`,reason:null,extensionDescriptorFactory:`createBufferVolumeDescriptor`,renderFieldSchema:c.schema,renderFieldBackend:c.backend??n?.backend??null,...so(l),schroederSpatialSourceFieldAuthority:c.schroederSpatialSourceFieldAuthority??(l?c:null),source:s,sourceType:Ua,scalarLayoutName:Wa,scalarType:`f32`,scalarLane:`density`,scalarLaneIndex:0,normalSign:-1,normalSemantic:`outward-density-gradient`,normalSourceSemantic:`scalar-gradient`,scalarBuffer:u,storageBuffer:u,buffer:u,scalarBufferByteLength:E,bufferByteLength:E,scalarRequiredByteLength:S,scalarOffset:v,scalarOffsetBytes:x,scalarStrides:y,rowStrideFloats:y[1],sliceStrideFloats:y[2],cellRowStrideFloats:g,dims:j,surfaceIndex:f,surfaceKey:m.surfaceKey??null,material:m.material??null,phase:m.phase??null,renderKey:m.renderKey??null,renderDomainId:m.renderDomainId??null,renderDomainKey:m.renderDomainKey??null,fieldOffset:_,fieldCellCount:m.fieldCellCount??h**3,isolation:re,isovalue:re,...L,fieldPadding:c.fieldPadding??null,refEdgeM:c.refEdgeM??null,positionTransform:M,positionTransformStatus:M.status,positionTransformGridBias:M.gridBias,positionTransformScaleM:M.scaleM,positionTransformOriginM:[...M.originM],device:e,sameDeviceRequired:!0,sameDeviceStatus:O,label:o,nativeConsumerKind:`native-webgpu-marching-cubes-buffer-volume`,nativeRequiredAdapter:`webgpu-marching-cubes.buffer-volume.v0`,scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};return l&&(Object.freeze(R.scalarStrides),Object.freeze(R.dims),Object.freeze(R.positionTransformOriginM),Xa.set(R,Object.freeze({device:e,sourceFamily:l,sourceField:c,scalarBuffer:u,surfaceBuffer:c.surfaceBuffer??null,surfaceTable:c.surfaceTable,surfaceRecord:m,surfaceIndex:f,surfaceKey:R.surfaceKey,material:R.material,phase:R.phase,renderKey:R.renderKey,renderDomainId:R.renderDomainId,renderDomainKey:R.renderDomainKey,scalarOffset:v,scalarOffsetBytes:x,scalarStrides:[...y],dims:[...j],scalarBufferByteLength:E,scalarRequiredByteLength:S,scalarType:R.scalarType,normalSign:R.normalSign,fieldOffset:_,fieldCellCount:R.fieldCellCount,isovalue:re,cellRowStrideFloats:g,rowStrideFloats:R.rowStrideFloats,sliceStrideFloats:R.sliceStrideFloats,fieldPadding:c.fieldPadding,refEdgeM:c.refEdgeM,positionTransform:R.positionTransform,positionTransformStatus:R.positionTransformStatus,positionTransformGridBias:R.positionTransformGridBias,positionTransformScaleM:R.positionTransformScaleM,positionTransformOriginM:[...R.positionTransformOriginM]})),Object.freeze(R)),R}function Eo(e,t,{device:n,sourceFamily:r}){return!!(t&&t.device===n&&t.sourceFamily===r&&e.schema===`peercompute.ulg.sph-webgpu-marching-cubes-buffer-volume-descriptor.v0`&&e.ok===!0&&e.status===`ulg-render-field-buffer-volume-descriptor-ready`&&e.device===n&&e.scalarBuffer===t.scalarBuffer&&e.storageBuffer===t.scalarBuffer&&e.buffer===t.scalarBuffer&&e.schroederSpatialSourceFamily===r&&e.schroederSpatialSourceFieldAuthority===t.sourceField&&e.scalarBufferByteLength===t.scalarBufferByteLength&&e.bufferByteLength===t.scalarBufferByteLength&&e.scalarRequiredByteLength===t.scalarRequiredByteLength&&e.scalarType===t.scalarType&&e.normalSign===t.normalSign&&e.surfaceIndex===t.surfaceIndex&&e.surfaceKey===t.surfaceKey&&e.material===t.material&&e.phase===t.phase&&e.renderKey===t.renderKey&&e.renderDomainId===t.renderDomainId&&e.renderDomainKey===t.renderDomainKey&&e.scalarOffset===t.scalarOffset&&e.scalarOffsetBytes===t.scalarOffsetBytes&&e.fieldOffset===t.fieldOffset&&e.fieldCellCount===t.fieldCellCount&&e.isolation===t.isovalue&&e.isovalue===t.isovalue&&e.cellRowStrideFloats===t.cellRowStrideFloats&&e.rowStrideFloats===t.rowStrideFloats&&e.sliceStrideFloats===t.sliceStrideFloats&&e.fieldPadding===t.fieldPadding&&e.refEdgeM===t.refEdgeM&&e.positionTransform===t.positionTransform&&e.positionTransformStatus===t.positionTransformStatus&&e.positionTransformGridBias===t.positionTransformGridBias&&e.positionTransformScaleM===t.positionTransformScaleM&&Array.isArray(e.positionTransformOriginM)&&e.positionTransformOriginM.length===t.positionTransformOriginM.length&&e.positionTransformOriginM.every((e,n)=>e===t.positionTransformOriginM[n])&&Array.isArray(e.dims)&&e.dims.length===t.dims.length&&e.dims.every((e,n)=>e===t.dims[n])&&Array.isArray(e.scalarStrides)&&e.scalarStrides.length===t.scalarStrides.length&&e.scalarStrides.every((e,n)=>e===t.scalarStrides[n]))}function Do(e,{device:t,sourceFamily:n=e?.schroederSpatialSourceFamily}={}){let r=Xa.get(e);if(!Eo(e,r,{device:t,sourceFamily:n}))return!1;let i=r.sourceField.fieldRowsBuffer??null,a={device:t,sourceFamily:n,particleCount:r.sourceField.particleCount,fieldRowsBuffer:i,fieldRows:i?null:r.sourceField.fieldRows,surfaceBuffer:r.surfaceBuffer,surfaceTable:r.surfaceTable};return!!(Sa(r.sourceField,a)||cr(r.sourceField,a))}function Oo(e){return{volume:e,device:e?.device??null,scalarBuffer:e?.scalarBuffer??null,storageBuffer:e?.storageBuffer??null,sourceType:e?.sourceType??null,scalarOffset:e?.scalarOffset??null,scalarOffsetBytes:e?.scalarOffsetBytes??null,scalarType:e?.scalarType??null,normalSign:e?.normalSign??null,scalarBufferByteLength:e?.scalarBufferByteLength??null,scalarRequiredByteLength:e?.scalarRequiredByteLength??null,rowStrideFloats:e?.rowStrideFloats??null,sliceStrideFloats:e?.sliceStrideFloats??null,numVoxels:e?.numVoxels??null,dualGridNumVoxels:e?.dualGridNumVoxels??null,diagonalLength:e?.diagonalLength??null,dims:Array.from(e?.dims??[]),dualGridDims:Array.from(e?.dualGridDims??[]),scalarStrides:Array.from(e?.scalarStrides??[])}}function ko(e){if(!e)return!1;let t=Oo(e.volume);return!!(Do(e.descriptor,{device:e.device,sourceFamily:e.sourceFamily})&&t.volume===e.volumeState.volume&&t.device===e.volumeState.device&&t.scalarBuffer===e.volumeState.scalarBuffer&&t.storageBuffer===e.volumeState.storageBuffer&&t.sourceType===e.volumeState.sourceType&&t.scalarOffset===e.volumeState.scalarOffset&&t.scalarOffsetBytes===e.volumeState.scalarOffsetBytes&&t.scalarType===e.volumeState.scalarType&&t.normalSign===e.volumeState.normalSign&&t.scalarBufferByteLength===e.volumeState.scalarBufferByteLength&&t.scalarRequiredByteLength===e.volumeState.scalarRequiredByteLength&&t.rowStrideFloats===e.volumeState.rowStrideFloats&&t.sliceStrideFloats===e.volumeState.sliceStrideFloats&&t.numVoxels===e.volumeState.numVoxels&&t.dualGridNumVoxels===e.volumeState.dualGridNumVoxels&&t.diagonalLength===e.volumeState.diagonalLength&&t.dims.length===e.volumeState.dims.length&&t.dims.every((t,n)=>t===e.volumeState.dims[n])&&t.dualGridDims.length===e.volumeState.dualGridDims.length&&t.dualGridDims.every((t,n)=>t===e.volumeState.dualGridDims[n])&&t.scalarStrides.length===e.volumeState.scalarStrides.length&&t.scalarStrides.every((t,n)=>t===e.volumeState.scalarStrides[n]))}function Ao({device:e,descriptor:t,volume:n}={}){let r=t?.schroederSpatialSourceFamily??null;if(!r)return null;if(!Do(t,{device:e,sourceFamily:r}))throw TypeError(`marching-cubes volume requires an active authenticated successor descriptor`);let i=t.dims.map(e=>Math.max(0,e-1)),a=t.dims.reduce((e,t)=>e*t,1),o=i.reduce((e,t)=>e*t,1);if(!n||n.device!==e||n.scalarBuffer!==t.scalarBuffer||n.storageBuffer!==t.scalarBuffer||n.sourceType!==t.sourceType||n.scalarType!==t.scalarType||n.scalarBufferByteLength!==t.scalarBufferByteLength||n.scalarRequiredByteLength!==t.scalarRequiredByteLength||n.scalarOffset!==t.scalarOffset||n.scalarOffsetBytes!==t.scalarOffsetBytes||n.rowStrideFloats!==t.rowStrideFloats||n.sliceStrideFloats!==t.sliceStrideFloats||n.normalSign!==t.normalSign||n.numVoxels!==a||n.dualGridNumVoxels!==o||!Array.isArray(n.dims)||n.dims.length!==t.dims.length||!n.dims.every((e,n)=>e===t.dims[n])||!Array.isArray(n.dualGridDims)||n.dualGridDims.length!==i.length||!n.dualGridDims.every((e,t)=>e===i[t])||!Array.isArray(n.scalarStrides)||n.scalarStrides.length!==t.scalarStrides.length||!n.scalarStrides.every((e,n)=>e===t.scalarStrides[n]))throw TypeError(`marching-cubes volume does not exactly match its authenticated successor descriptor`);let s=Object.freeze({device:e,descriptor:t,volume:n,volumeState:Object.freeze(Oo(n)),sourceFamily:r,scalarBuffer:t.scalarBuffer,surfaceIndex:t.surfaceIndex,isovalue:t.isovalue});return Za.set(n,s),Object.freeze({status:`ulg-marching-cubes-successor-volume-lineage-bound`,sourceFamilyRole:r.sourceFamilyRole,sourceGenerationId:r.sourceGenerationId,surfaceIndex:t.surfaceIndex})}function jo(e,t,{surfaceIndex:n,materialId:r,phaseId:i,opticalStateId:a,vertexOffset:o,vertexCount:s,triangleOffset:c,triangleCount:l,renderOrder:u,transparencyClassId:d,depthWriteFlag:f,status:p,boundsCenterM:m,boundsRadiusM:h}){e.set([n,r,i,a,o,s,c,l,u,d,f,p,m[0],m[1],m[2],h],t)}function Mo({vertexCount:e,sourceStrideFloats:t,surfaceIndex:n,triangleCount:r,materialId:i,phaseId:a,opticalStateId:o,density:s,isolation:c,sourceVoxelLinearIndex:l,transparencyClassId:u,depthWriteFlag:d,renderOrder:f,fallbackNormal:p,positionTransform:m=null,positionClamp:h=null,surfaceBounds:g=null,fieldGradient:_=null}){let v=new ArrayBuffer(160),y=new DataView(v),b=m?.enabled?m:null,x=h?.enabled?h:null,S=g||bo({positionTransform:b,positionClamp:x}),C=mo(b?.originM,[0,0,0]),w=mo(x?.minM,[0,0,0]),T=mo(x?.maxM,[0,0,0]),E=mo(S?.centerM,[0,0,0]);return y.setUint32(0,Math.max(0,Math.round($(e,0))),!0),y.setUint32(4,Math.max(1,Math.round($(t,4))),!0),y.setUint32(8,Math.max(0,Math.round($(n,0))),!0),y.setUint32(12,Math.max(0,Math.round($(r,0))),!0),y.setFloat32(16,$(i,0),!0),y.setFloat32(20,$(a,0),!0),y.setFloat32(24,$(o,0),!0),y.setFloat32(28,$(s,0),!0),y.setFloat32(32,$(c,0),!0),y.setFloat32(36,$(l,0),!0),y.setFloat32(40,$(u,0),!0),y.setFloat32(44,$(d,1),!0),y.setFloat32(48,$(f,n),!0),y.setFloat32(52,p[0],!0),y.setFloat32(56,p[1],!0),y.setFloat32(60,p[2],!0),y.setFloat32(64,$(b?.scaleM,1),!0),y.setFloat32(68,C[0],!0),y.setFloat32(72,C[1],!0),y.setFloat32(76,C[2],!0),y.setFloat32(80,$(b?.gridBias,0),!0),y.setFloat32(88,$(_?.resolution,0),!0),y.setFloat32(92,$(_?.scalarOffsetFloats,0),!0),y.setFloat32(124,+!!_?.buffer,!0),y.setFloat32(144,$(_?.rowStrideFloats,1),!0),y.setFloat32(84,+!!b,!0),y.setFloat32(96,w[0],!0),y.setFloat32(100,w[1],!0),y.setFloat32(104,w[2],!0),y.setFloat32(108,T[0],!0),y.setFloat32(112,T[1],!0),y.setFloat32(116,T[2],!0),y.setFloat32(120,+!!x,!0),y.setFloat32(128,E[0],!0),y.setFloat32(132,E[1],!0),y.setFloat32(136,E[2],!0),y.setFloat32(140,$(S?.radiusM,0),!0),v}async function No(e,t,n,r=`ulg-sph-marching-cubes-extension-readback`){let i=null,a=!1;try{i=e.createBuffer({label:r,size:Math.max(4,n),usage:qa.MAP_READ|qa.COPY_DST});let o=e.createCommandEncoder();return o.copyBufferToBuffer(t,0,i,0,n),e.queue.submit([o.finish()]),await i.mapAsync(Ja.READ),a=!0,i.getMappedRange().slice(0)}finally{if(a)try{i?.unmap?.()}catch{}try{i?.destroy?.()}catch{}}}function Po({surfaceIndex:e,materialId:t,phaseId:n,opticalStateId:r,material:i,phase:a,renderKey:o,surfaceKey:s,vertexCount:c,triangleCount:l,renderOrder:u,transparencyClassId:d,depthWriteFlag:p,status:m=`surface-draw-summary-not-read`,boundsCenterM:h=null,boundsRadiusM:g=null,indirectRowIndex:_=0,indirectOffsetBytes:v=null}){let y=mo(h,[0,0,0]),b=$(g,0),x=Number.isFinite(Number(c))?Math.max(0,Math.round(Number(c))):null,S=Number.isFinite(Number(l))?Math.max(0,Math.round(Number(l))):null,C=Math.max(0,Math.round($(_,0))),w=f.length*Uint32Array.BYTES_PER_ELEMENT,T=Number.isFinite(Number(v))?Math.max(0,Math.round(Number(v))):C*w,E=(x??0)>=3;return{surfaceKey:s||`extension-surface-${e}`,material:i,phase:a,renderKey:o,surfaceIndex:e,materialId:t,phaseId:n,opticalStateId:r,indirectRowIndex:C,indirectOffsetBytes:T,vertexOffset:E?0:null,vertexCount:x,triangleOffset:E?0:null,triangleCount:S,renderOrder:u,transparencyClassId:d,depthWriteFlag:p,boundsCenterM:y,boundsRadiusM:b>0?b:null,status:m}}function Fo(e){let t=e?.result||null,n=(t?.outputDescriptors?.rows?.position||t?.rowMetadata?.position||null)?.resourceOwnership||t?.resourceOwnership||null;if(n?.ok===!1||n?.status===`cross-device-resource`)throw TypeError(`extension surface buffer is not owned by this GPUDevice (${n.status})`);let r=Lo(t);if(r.resourceOwnership?.ok===!1||r.resourceOwnership?.status===`cross-device-resource`)throw TypeError(`extension packed normal buffer is not owned by this GPUDevice (${r.resourceOwnership.status})`)}function Io(e=null){let t=e?.outputDescriptors||null,n=t?.rows?.position||null,r=e?.rowMetadata?.position||null,i=n||r||null,a=Math.max(0,Math.round($(i?.rowStrideFloats??e?.rowStrideFloats??e?.vertexStrideFloats,0))),o=Math.max(0,Math.round($(i?.rowStrideBytes??e?.rowStrideBytes??e?.vertexStrideBytes,0))),s=i?.schema??e?.rowSchema??null,c=Array.isArray(i?.rowLayout)?[...i.rowLayout]:Array.isArray(e?.rowLayout)?[...e.rowLayout]:null,l=i?.buffer||t?.retainedBuffers?.position||e?.buffer||null,u=!!(i?.bufferRetained&&i?.buffer||t?.retainedBuffers?.position&&l||e?.bufferRetained&&e?.buffer),d=Math.max(0,Math.round($(i?.bufferByteLength??e?.bufferByteLength,0)));return{outputDescriptorSchema:t?.schema??null,outputDescriptorStatus:t?.status??null,outputDescriptorTopology:t?.topology??null,outputDescriptorReadback:t?.readback??null,outputDescriptorFullReadback:t?.fullReadback??null,rowMetadataSchema:e?.rowMetadata?.schema??null,rowMetadataStatus:e?.rowMetadata?.status??null,rowSchema:s,rowLayout:c,rowLayoutName:i?.layoutName??t?.layoutName??e?.layoutName??null,rowStrideFloats:a,rowStrideBytes:o,rowCount:Math.max(0,Math.round($(i?.rowCount??e?.rowCount??e?.vertexCount,0))),status:i?.status??null,available:!!(i?.available??u),buffer:l,bufferRetained:u,bufferByteLength:d,ownerDeviceId:i?.ownerDeviceId??e?.ownerDeviceId??null,resourceOwnership:i?.resourceOwnership??e?.resourceOwnership??null,readback:i?.readback??t?.readback??e?.rowMetadata?.readback??e?.readback??null,normalRowsStatus:t?.rows?.normal?.status??e?.rowMetadata?.normal?.status??null,materialRowsStatus:t?.rows?.material?.status??e?.rowMetadata?.material?.status??null,drawRowsStatus:t?.rows?.draw?.status??null,drawRowsAvailable:t?.rows?.draw?.available??null,indirectDrawRowsStatus:t?.rows?.indirect?.status??null,indirectDrawRowsAvailable:t?.rows?.indirect?.available??null,materialMetadataAvailable:t?.materialPayload?.available??e?.rowMetadata?.material?.metadataAvailable??null,pbrMetadataAvailable:t?.pbrPayload?.available??null}}function Lo(e=null){let t=e?.outputDescriptors||null,n=t?.rows?.normal||null,r=e?.rowMetadata?.normal||null,i=n||r||null,a=i?.normalBufferDescriptor||t?.normalBufferDescriptor||null,o=fo(a?.generation)?a.generation:null,s=o!=null,c=!!(s&&Object.prototype.hasOwnProperty.call(o,`surfaceGenerationId`)),l=!!(s&&Object.prototype.hasOwnProperty.call(o,`pairedPositionSurfaceGenerationId`)),u=!!(s&&Object.prototype.hasOwnProperty.call(o,`volumeGenerationId`)),d=i?.buffer||t?.retainedBuffers?.normal||e?.normalBuffer||null,f=Math.max(0,Math.round($(i?.bufferByteLength??a?.bufferByteLength??e?.normalBufferByteLength,0))),p=Math.max(0,Math.round($(i?.rowCount??a?.rowCount,0))),m=c?o.surfaceGenerationId:null,h=l?o.pairedPositionSurfaceGenerationId:null,g=u?o.volumeGenerationId:null;return{descriptorSchema:a?.schema??null,rowSchema:i?.schema??a?.rowSchema??null,layoutName:i?.layoutName??a?.layoutName??null,encoding:i?.encoding??a?.encoding??e?.normalEncoding??null,semantic:i?.semantic??a?.semantic??e?.normalSemantic??null,sourceSemantic:i?.sourceSemantic??a?.sourceSemantic??e?.normalSourceSemantic??null,normalSign:Number(i?.normalSign??a?.normalSign??e?.normalSign),status:i?.status??a?.status??null,available:!!(i?.available??a?.available),buffer:d,bufferRetained:!!(i?.bufferRetained&&i?.buffer||a?.bufferRetained&&a?.buffer||t?.retainedBuffers?.normal&&d),bufferByteLength:f,rowStrideBytes:Math.max(0,Math.round($(i?.rowStrideBytes??a?.rowStrideBytes,0))),rowCount:p,ownerDeviceId:i?.ownerDeviceId??a?.ownerDeviceId??null,resourceOwnership:i?.resourceOwnership??a?.resourceOwnership??null,generationDescriptorAuthored:s,surfaceGenerationIdAuthored:c,pairedPositionSurfaceGenerationIdAuthored:l,volumeGenerationIdAuthored:u,surfaceGenerationId:m,pairedPositionSurfaceGenerationId:h,volumeGenerationId:g,sameSubmitAsPosition:a?.generation?.sameSubmitAsPosition===!0,lifetimeOwner:a?.lifetime?.owner??null,pairedWithPositionBuffer:a?.lifetime?.pairedWithPositionBuffer===!0,producerStage:a?.producer?.stage??e?.normalProducerStage??null,timestampSpanLabel:a?.producer?.timestampSpanLabel??e?.normalTimestampSpanLabel??null,additionalSubmitCount:Math.max(0,Math.round($(a?.producer?.additionalSubmitCount??e?.normalAdditionalSubmitCount,0)))}}function Ro(e,t=null){let n=e?.result??null,r=t??Bo(e),i=Io(n),a=Lo(n);return{result:n,summaryFingerprint:JSON.stringify(r),positionBuffer:i.buffer??null,normalBuffer:a.buffer??null,positionRows:n?.positionRows??n?.compactPositionRows??null,actualVertexCounterBuffer:n?.actualVertexCounterBuffer??n?.vertexCounterBuffer??null,drawIndirectBuffer:n?.drawIndirectBuffer??null,surfaceGenerationId:n?.surfaceGenerationId??null,volumeGenerationId:n?.volumeGenerationId??null,resultIsovalue:n?.isovalue??null}}function zo(e){return{schema:La,status:`extension-surface-execution-invalid`,reason:e,extensionExecutionSchema:null,extensionSurfaceSchema:null,extensionStatus:null,extensionOk:!1,extensionBackend:null,extensionAdapterId:null,extensionOwnsDevice:null,extensionOwnerDeviceId:null,extensionResourceOwnershipStatus:null,extensionVertexFormat:null,extensionVertexStrideFloats:null,extensionVertexStrideBytes:null,extensionVertexCount:0,extensionTriangleCount:0,extensionBufferRetained:!1,extensionReadback:null,extensionSurfaceVertexReadback:null,readyForUlgSurfaceVertexRows:!1,requiresUlgVertexRowTranslation:!0,requiresUlgDrawMetadata:!0,surfaceVertexSchema:O,surfaceVertexFormat:Ha,surfaceVertexRowLayout:[...p],surfaceVertexRowStrideFloats:p.length,surfaceDrawSchema:j,surfaceDrawRowLayout:[...r],surfaceDrawRowStrideFloats:r.length,surfaceDrawIndirectSchema:x,surfaceDrawIndirectRowLayout:[...f],surfaceDrawIndirectRowStrideUints:f.length,hotLoopSafe:!1,rendererIntegration:`not-integrated`}}function Bo(e){if(!fo(e))return zo(`missing extension surface execution`);let t=e.result||null,n=Io(t),i=Lo(t),a=t?.schema??null,o=e.ok===!0,s=Math.max(0,Math.round($(t?.vertexCount,0))),c=t?.vertexCountMode??null,l=t?.vertexRowsBudget==null?null:Math.max(0,Math.round($(t.vertexRowsBudget,0))),u=t?.vertexRowsBudgetClamped===!0?!0:t?.vertexRowsBudgetClamped===!1?!1:null,d=t?.conservativeWorstCaseVertexCount==null?null:Math.max(0,Math.round($(t.conservativeWorstCaseVertexCount,0))),m=t?.actualVertexCounterBuffer||t?.vertexCounterBuffer||null,h=Math.max(0,Math.round($(t?.actualVertexCounterBufferByteLength??t?.vertexCounterBufferByteLength??m?.size,0))),g=t?.drawIndirectBuffer||null,_=Math.max(0,Math.round($(t?.drawIndirectBufferByteLength??g?.size,0))),v=Math.max(0,$(t?.triangleCount,0)),y=n.rowStrideFloats>0?n.rowStrideFloats:t?.vertexStrideFloats==null?null:Math.max(0,Math.round($(t.vertexStrideFloats,0))),b=n.rowStrideBytes>0?n.rowStrideBytes:t?.vertexStrideBytes==null?null:Math.max(0,Math.round($(t.vertexStrideBytes,0))),S=t?.vertexFormat??null,C=n.bufferRetained,w=n.resourceOwnership?.status??null,T=!!(i.volumeGenerationId==null&&t?.volumeGenerationId==null||Number.isInteger(i.volumeGenerationId)&&Number.isInteger(t?.volumeGenerationId)&&i.volumeGenerationId===t.volumeGenerationId),E=!!(i.generationDescriptorAuthored&&i.surfaceGenerationIdAuthored&&i.pairedPositionSurfaceGenerationIdAuthored&&i.volumeGenerationIdAuthored&&Number.isInteger(i.surfaceGenerationId)&&Number.isInteger(i.pairedPositionSurfaceGenerationId)&&Number.isInteger(t?.surfaceGenerationId)&&i.surfaceGenerationId===i.pairedPositionSurfaceGenerationId&&i.surfaceGenerationId===t.surfaceGenerationId&&T),D=!!(i.descriptorSchema===`peercompute.webgpu-marching-cubes.normal-buffer-descriptor.v0`&&i.rowSchema===`peercompute.webgpu-marching-cubes.packed-normal-rows.v0`&&i.layoutName===`peercompute.webgpu-marching-cubes.layout.normal-octahedral-snorm16x2.v0`&&i.encoding===`octahedral-snorm16x2`&&i.semantic===`oriented-scalar-gradient`&&i.sourceSemantic===`scalar-gradient`&&(i.normalSign===-1||i.normalSign===1)&&i.available&&i.bufferRetained&&i.buffer&&i.rowStrideBytes===Uint32Array.BYTES_PER_ELEMENT&&i.rowCount===s&&i.bufferByteLength>=s*Uint32Array.BYTES_PER_ELEMENT&&i.resourceOwnership?.ok!==!1&&i.resourceOwnership?.status!==`cross-device-resource`&&E&&i.sameSubmitAsPosition&&i.pairedWithPositionBuffer&&i.lifetimeOwner===`surface-result`&&i.additionalSubmitCount===0),k=`packed-normal-ready`;!i.buffer||!i.bufferRetained?k=`packed-normal-buffer-unavailable`:E?D||(k=`packed-normal-contract-invalid`):k=`packed-normal-generation-mismatch`;let A=e.errors?.[0]||e.webgpuStatus?.error||t?.error||null,M=po(e.webgpuStatus?.reason)||po(A?.message)||po(t?.reason)||po(e.status),N=!!(o&&a===`peercompute.webgpu-marching-cubes.surface.v0`&&C&&s>0),ee=!!(N&&y===p.length&&S===`peercompute.ulg.sph-gpu-render-surface-vertex-row.v0`),P=!ee,F=`extension-surface-execution-blocked`;return F=o?N?P?`extension-surface-ready-needs-ulg-row-translation`:`extension-surface-ready-ulg-row-compatible`:s>0?`extension-surface-buffer-unavailable`:`extension-surface-empty`:e.status===`same-device-check-failed`?`extension-surface-same-device-check-failed`:`extension-surface-execution-blocked`,{schema:La,status:F,reason:F.endsWith(`failed`)||F.endsWith(`blocked`)?M:null,extensionExecutionSchema:e.schema??null,extensionSurfaceSchema:a,extensionStatus:e.status??null,extensionOk:o,extensionErrorName:A?.name??null,extensionErrorStatus:A?.status??null,extensionErrorStage:A?.stage??null,extensionErrorStack:A?.stack??null,extensionBackend:e.backend??null,extensionAdapterId:e.adapterId??null,extensionOwnsDevice:e.ownsDevice??null,extensionOwnerDeviceId:e.ownerDeviceId??t?.ownerDeviceId??null,extensionResourceOwnershipStatus:w,extensionVertexFormat:S,extensionVertexStrideFloats:y,extensionVertexStrideBytes:b,extensionVertexCount:s,extensionVertexCountMode:c,extensionVertexRowsBudget:l,extensionVertexRowsBudgetClamped:u,extensionConservativeWorstCaseVertexCount:d,extensionActualVertexCounterBufferRetained:!!m,extensionActualVertexCounterBufferByteLength:h,extensionDrawIndirectBufferRetained:!!g,extensionDrawIndirectBufferByteLength:_,extensionTriangleCount:v,extensionBufferRetained:C,extensionBufferByteLength:n.bufferByteLength,extensionPackedNormalReady:D,extensionPackedNormalStatus:k,extensionNormalDescriptorSchema:i.descriptorSchema,extensionNormalRowsSchema:i.rowSchema,extensionNormalLayoutName:i.layoutName,extensionNormalEncoding:i.encoding,extensionNormalSemantic:i.semantic,extensionNormalSourceSemantic:i.sourceSemantic,extensionNormalSign:Number.isFinite(i.normalSign)?i.normalSign:null,extensionNormalBufferRetained:i.bufferRetained,extensionNormalBufferByteLength:i.bufferByteLength,extensionNormalRowStrideBytes:i.rowStrideBytes,extensionNormalRowCount:i.rowCount,extensionNormalOwnerDeviceId:i.ownerDeviceId,extensionNormalResourceOwnershipStatus:i.resourceOwnership?.status??null,extensionNormalGenerationDescriptorAuthored:i.generationDescriptorAuthored,extensionNormalSurfaceGenerationIdAuthored:i.surfaceGenerationIdAuthored,extensionNormalPairedPositionSurfaceGenerationIdAuthored:i.pairedPositionSurfaceGenerationIdAuthored,extensionNormalVolumeGenerationIdAuthored:i.volumeGenerationIdAuthored,extensionNormalSurfaceGenerationId:i.surfaceGenerationId,extensionNormalPairedPositionSurfaceGenerationId:i.pairedPositionSurfaceGenerationId,extensionNormalVolumeGenerationId:i.volumeGenerationId,extensionNormalSameSubmitAsPosition:i.sameSubmitAsPosition,extensionNormalLifetimeOwner:i.lifetimeOwner,extensionNormalPairedWithPositionBuffer:i.pairedWithPositionBuffer,extensionNormalProducerStage:i.producerStage,extensionNormalTimestampSpanLabel:i.timestampSpanLabel,extensionNormalAdditionalSubmitCount:i.additionalSubmitCount,extensionOutputDescriptorSchema:n.outputDescriptorSchema,extensionOutputDescriptorStatus:n.outputDescriptorStatus,extensionOutputDescriptorTopology:n.outputDescriptorTopology,extensionOutputDescriptorReadback:n.outputDescriptorReadback,extensionOutputDescriptorFullReadback:n.outputDescriptorFullReadback,extensionRowMetadataSchema:n.rowMetadataSchema,extensionRowMetadataStatus:n.rowMetadataStatus,extensionPositionRowsSchema:n.rowSchema,extensionPositionRowsStatus:n.status,extensionPositionRowsAvailable:n.available,extensionPositionRowsReadback:n.readback,extensionPositionRowsRowLayout:n.rowLayout,extensionPositionRowsLayoutName:n.rowLayoutName,extensionPositionRowsRowCount:n.rowCount,extensionNormalRowsStatus:n.normalRowsStatus,extensionMaterialRowsStatus:n.materialRowsStatus,extensionDrawRowsStatus:n.drawRowsStatus,extensionDrawRowsAvailable:n.drawRowsAvailable,extensionIndirectDrawRowsStatus:n.indirectDrawRowsStatus,extensionIndirectDrawRowsAvailable:n.indirectDrawRowsAvailable,extensionMaterialMetadataAvailable:n.materialMetadataAvailable,extensionPbrMetadataAvailable:n.pbrMetadataAvailable,extensionReadback:e.readback??null,extensionSurfaceVertexReadback:e.surfaceVertexReadback??null,readyForUlgSurfaceVertexRows:ee,requiresUlgVertexRowTranslation:P,requiresUlgDrawMetadata:!0,surfaceVertexSchema:O,surfaceVertexFormat:Ha,surfaceVertexRowLayout:[...p],surfaceVertexRowStrideFloats:p.length,surfaceDrawSchema:j,surfaceDrawRowLayout:[...r],surfaceDrawRowStrideFloats:r.length,surfaceDrawIndirectSchema:x,surfaceDrawIndirectRowLayout:[...f],surfaceDrawIndirectRowStrideUints:f.length,hotLoopSafe:!!(N&&e.readback===!1&&e.surfaceVertexReadback===!1&&n.readback!==!0),rendererIntegration:`pending-ulg-row-translation-and-engine-bridge`}}function Vo({device:e,volume:t=null,adapterFactory:n,adapter:r=null,adapterId:i=`webgpu-marching-cubes`,backend:a=`webgpu-marching-cubes-extension`}={}){if(!fo(e))throw TypeError(`createUlgWebGpuMarchingCubesExtensionAdapter requires a caller-owned GPUDevice`);if(!r&&typeof n!=`function`)throw TypeError(`createUlgWebGpuMarchingCubesExtensionAdapter requires an adapter or adapterFactory`);let o=r,s=async()=>(o||=await n({device:e,volume:t,adapterId:i}),o),c={schema:Ia,adapterId:i,backend:a,device:e,ownsDevice:!1,volume:t,get adapter(){return o},getStatus(){return{schema:Ia,status:o?`extension-adapter-ready`:`extension-adapter-pending`,adapterSchema:o?.schema??null,adapterStatus:o?.getStatus?.()??null,adapterId:i,backend:a,ownsDevice:!1}},getCapabilities(){return o?.getCapabilities?.()??{schema:`peercompute.ulg.sph-webgpu-marching-cubes-extension-adapter.v0`,status:o?`extension-capabilities-unavailable`:`extension-adapter-pending`,adapterSchema:o?.schema??null,adapterId:i,backend:a,ownsDevice:!1}},async preflight(e={}){let n=await s();if(typeof n.preflight!=`function`)return{schema:Ra,ok:!0,status:`extension-preflight-unavailable`,reason:`extension adapter does not expose preflight; extraction will rely on adapter extractSurface checks`,backend:a,adapterSchema:n?.schema??null,adapterId:i,ownsDevice:!1,extensionPreflight:null};let r=await n.preflight({...e,volume:e.volume||t}),o=r?.ok!==!1;return{schema:Ra,ok:o,status:o?`extension-preflight-ready`:`extension-preflight-blocked`,reason:o?null:r?.status||`extension preflight blocked surface extraction`,backend:a,adapterSchema:n?.schema??null,adapterId:i,ownsDevice:!1,extensionPreflightSchema:r?.schema??null,extensionPreflightStatus:r?.status??null,deviceChecks:r?.deviceChecks||[],extensionPreflight:r}},async extractSurface(n={}){let r=n.volume||t,o=to.get(c);if(!o||o.device!==e||o.volume!==t)throw TypeError(`marching-cubes extension wrapper authority is unavailable`);let l=Za.get(r);if(l){let e=n.isovalue??l.descriptor.isovalue;if(r!==t||e!==l.descriptor.isovalue||!ko(l)||Za.get(r)!==l)throw TypeError(`marching-cubes extraction requires the active exact successor volume binding`)}let u=await s();if(l&&!ko(l))throw TypeError(`marching-cubes successor volume changed while the extension adapter was resolving`);let d=await c.preflight(n);if(l&&!ko(l))throw TypeError(`marching-cubes successor volume changed during extension preflight`);if(d.ok===!1){let e={schema:La,status:`extension-surface-preflight-blocked`,reason:d.reason,extensionOk:!1,extensionStatus:d.extensionPreflightStatus,extensionExecutionSchema:null,extensionSurfaceSchema:null,readyForUlgSurfaceVertexRows:!1,requiresUlgVertexRowTranslation:!0,requiresUlgDrawMetadata:!0,hotLoopSafe:!1,rendererIntegration:`blocked-before-extension-extraction`};return{schema:La,status:e.status,reason:e.reason,backend:a,adapterSchema:c.schema,extensionAdapterSchema:u?.schema??null,adapterId:i,ownsDevice:!1,preflight:d,summary:e,extensionExecution:null,surfaceVertexSchema:null,surfaceDrawSchema:null,surfaceDrawIndirectSchema:null,readyForUlgSurfaceVertexRows:!1,requiresUlgVertexRowTranslation:!0,requiresUlgDrawMetadata:!0,hotLoopSafe:!1,rendererIntegration:e.rendererIntegration}}let f=await u.extractSurface({...n,volume:n.volume||t}),p=f?.result??null,m=p?.release,h=!1;try{let t=Bo(f),o=l?Ro(f,t):null;if(o)for(let e of[o.positionBuffer,o.normalBuffer,o.positionRows,o.actualVertexCounterBuffer,o.drawIndirectBuffer])ao($a,e);if(l&&!ko(l))throw TypeError(`marching-cubes successor volume changed during extension extraction`);let s={schema:La,status:t.status,reason:t.reason,backend:a,adapterSchema:c.schema,extensionAdapterSchema:u?.schema??null,adapterId:i,ownsDevice:!1,preflight:d,summary:t,extensionExecution:f,webgpuStatus:f?.webgpuStatus??null,errors:f?.errors||[],errorName:t.extensionErrorName,errorStatus:t.extensionErrorStatus,errorStage:t.extensionErrorStage,errorStack:t.extensionErrorStack,surfaceVertexSchema:t.surfaceVertexSchema,surfaceDrawSchema:t.surfaceDrawSchema,surfaceDrawIndirectSchema:t.surfaceDrawIndirectSchema,readyForUlgSurfaceVertexRows:t.readyForUlgSurfaceVertexRows,requiresUlgVertexRowTranslation:t.requiresUlgVertexRowTranslation,requiresUlgDrawMetadata:t.requiresUlgDrawMetadata,hotLoopSafe:t.hotLoopSafe,rendererIntegration:t.rendererIntegration};if(l){if(o.resultIsovalue!==l.descriptor.isovalue)throw TypeError(`marching-cubes successor output isovalue does not match its authenticated descriptor`);let t=[o.positionBuffer,o.normalBuffer,o.actualVertexCounterBuffer,o.drawIndirectBuffer].filter(Boolean);if(t.includes(l.scalarBuffer)||new Set(t).size!==t.length)throw TypeError(`marching-cubes successor output resources must be distinct from the source volume and from one another`);let i={active:!0,device:e,wrapper:c,volume:r,descriptor:l.descriptor,sourceFamily:l.sourceFamily,scalarBuffer:l.scalarBuffer,wrappedExecution:s,extensionExecution:f,extensionResult:o.result,executionSummaryFingerprint:o.summaryFingerprint,positionBuffer:o.positionBuffer,normalBuffer:o.normalBuffer,positionRows:o.positionRows,positionRowsBytes:no(o.positionRows),actualVertexCounterBuffer:o.actualVertexCounterBuffer,drawIndirectBuffer:o.drawIndirectBuffer,surfaceGenerationId:o.surfaceGenerationId,volumeGenerationId:o.volumeGenerationId,resultIsovalue:o.resultIsovalue,releaseMethod:null,isovalue:n.isovalue??l.descriptor.isovalue},a=o.result?.release;if(typeof a!=`function`)throw TypeError(`marching-cubes successor output requires an authenticated release lifecycle`);{let e=function(...e){return i.active=!1,a.apply(this,e)};try{o.result.release=e}catch{throw TypeError(`marching-cubes successor output lifecycle cannot be authenticated`)}if(o.result.release!==e)throw TypeError(`marching-cubes successor output lifecycle cannot be authenticated`);i.releaseMethod=e}io($a,i.positionBuffer,i),io($a,i.normalBuffer,i),io($a,i.positionRows,i),io($a,i.actualVertexCounterBuffer,i),io($a,i.drawIndirectBuffer,i),Qa.set(s,i),f&&typeof f==`object`&&Qa.set(f,i)}return h=!0,s}catch(e){if(!h){let e=null;try{e=Ro(f)}catch{}let t=l?.scalarBuffer??null,n=[e?.positionBuffer,e?.normalBuffer,e?.actualVertexCounterBuffer,e?.drawIndirectBuffer,p?.positionBuffer,p?.vertexBuffer,p?.buffer,p?.normalBuffer,p?.packedNormalBuffer,p?.actualVertexCounterBuffer,p?.vertexCounterBuffer,p?.drawIndirectBuffer].filter(e=>e&&typeof e==`object`);if(!(t&&n.includes(t))&&typeof m==`function`)try{await m.call(p)}catch{}}throw e}}};return to.set(c,Object.freeze({device:e,volume:t})),c}function Ho(e,t=null){let n=Qa.get(e);if(!n){if(t||oo(e)||oo(e?.result))throw TypeError(`marching-cubes translation rejects unbranded or partial successor lineage`);return null}let r=e===n.wrappedExecution?n.extensionExecution:e,i=Ro(r),a=i.result;if(n.active!==!0||t&&t!==n.sourceFamily||!Object.isFrozen(n.descriptor)||!Do(n.descriptor,{device:n.device,sourceFamily:n.sourceFamily})||!ko(Za.get(n.volume))||r!==n.extensionExecution||a!==n.extensionResult||i.summaryFingerprint!==n.executionSummaryFingerprint||i.positionBuffer!==n.positionBuffer||i.normalBuffer!==n.normalBuffer||i.positionRows!==n.positionRows||!ro(i.positionRows,n.positionRowsBytes)||i.actualVertexCounterBuffer!==n.actualVertexCounterBuffer||i.drawIndirectBuffer!==n.drawIndirectBuffer||i.surfaceGenerationId!==n.surfaceGenerationId||i.volumeGenerationId!==n.volumeGenerationId||i.resultIsovalue!==n.resultIsovalue||n.releaseMethod!=null&&a?.release!==n.releaseMethod)throw TypeError(`marching-cubes output does not match its authenticated successor extraction`);return n}function Uo(e,t=null){let n=Qa.get(e);if(!n)return null;let r=e===n.wrappedExecution?n.extensionExecution:e,i=Ro(r),a=Xa.get(n.descriptor);if(n.active!==!0||t&&t!==n.sourceFamily||!Object.isFrozen(n.descriptor)||!Eo(n.descriptor,a,{device:n.device,sourceFamily:n.sourceFamily})||r!==n.extensionExecution||i.result!==n.extensionResult||i.summaryFingerprint!==n.executionSummaryFingerprint||i.positionBuffer!==n.positionBuffer||i.normalBuffer!==n.normalBuffer||i.positionRows!==n.positionRows||!ro(i.positionRows,n.positionRowsBytes)||i.actualVertexCounterBuffer!==n.actualVertexCounterBuffer||i.drawIndirectBuffer!==n.drawIndirectBuffer||i.surfaceGenerationId!==n.surfaceGenerationId||i.volumeGenerationId!==n.volumeGenerationId||i.resultIsovalue!==n.resultIsovalue||n.releaseMethod!=null&&i.result?.release!==n.releaseMethod)throw TypeError(`sealed marching-cubes output no longer matches its authenticated successor extraction`);return n}function Wo(e,{device:t,sourceFamily:n=null,descriptor:r=null}={}){try{let i=Ho(e,n);return!!(i&&i.device===t&&i.sourceFamily===n&&(!r||i.descriptor===r))}catch{return!1}}function Go(e,{device:t,surfaceIndex:n,isolation:r,sourceVoxelLinearIndex:i,positionTransform:a,positionTransformResolution:o,fieldPadding:s,refEdgeM:c,fieldGradient:l=null,positionRows:u=null,positionClampMinM:d=null,positionClampMaxM:f=null}={}){if(!e)return null;let p=e.descriptor,m=p.dims?.[0]??null;if(t!==e.device||n!==p.surfaceIndex||i!==p.fieldOffset||r!=null&&r!==p.isovalue||a!=null&&a!==p.positionTransform||o!=null&&o!==m||s!=null&&s!==p.fieldPadding||c!=null&&c!==p.refEdgeM||u!=null&&u!==e.positionRows||d!=null||f!=null||l!=null&&(l.buffer!==p.scalarBuffer||l.scalarOffsetFloats!==p.scalarOffset||l.rowStrideFloats!==p.cellRowStrideFloats||l.resolution!==m))throw TypeError(`successor surface translation inputs do not match the authenticated extraction descriptor`);return{descriptor:p,surfaceIndex:p.surfaceIndex,isolation:p.isovalue,sourceVoxelLinearIndex:p.fieldOffset,positionTransform:p.positionTransform,positionTransformResolution:m,fieldPadding:p.fieldPadding,refEdgeM:p.refEdgeM,fieldGradient:Object.freeze({buffer:p.scalarBuffer,scalarOffsetFloats:p.scalarOffset,rowStrideFloats:p.cellRowStrideFloats,resolution:m}),positionRows:e.positionRows}}function Ko(e){let t=e?.surfaceVertices??null,n=e?.surfaceDraw??null,r=t?.surfaces??null,i=n?.surfaces??null,a=r?.[0]??null,o=i?.[0]??null,s=o;return{surfaceVertices:t,surfaceDraw:n,surfaceVerticesSurfaces:r,surfaceDrawSurfaces:i,surfaceVerticesSurface:a,surfaceDrawSurface:o,vertexRows:t?.vertexRows??null,drawRows:n?.drawRows??null,drawIndirectRows:n?.drawIndirectRows??null,compactedVertexRows:n?.compactedVertexRows??null,vertexRowsBuffer:t?.vertexRowsBuffer??null,drawRowsBuffer:n?.drawRowsBuffer??null,drawIndirectRowsBuffer:n?.drawIndirectRowsBuffer??null,compactedVertexRowsBuffer:n?.compactedVertexRowsBuffer??null,surfaceVerticesCompactPositionRowsBuffer:t?.compactPositionRowsBuffer??null,surfaceDrawCompactPositionRowsBuffer:n?.compactPositionRowsBuffer??null,surfaceVerticesCompactNormalRowsBuffer:t?.compactNormalRowsBuffer??null,surfaceDrawCompactNormalRowsBuffer:n?.compactNormalRowsBuffer??null,surfaceDrawRenderFieldGradientVolume:n?.renderFieldGradientVolume??null,surfaceDrawRenderFieldGradientBuffer:n?.renderFieldGradientVolume?.buffer??null,translationCompactNormalRowsBuffer:e?.compactNormalRowsBuffer??null,translationPositionTransform:e?.positionTransform??null,surfaceVerticesPositionTransform:t?.positionTransform??null,surfaceDrawPositionTransform:n?.positionTransform??null,surfaceVertexRowLayout:t?.rowLayout??null,surfaceDrawRowLayout:n?.rowLayout??null,surfaceDrawIndirectRowLayout:n?.drawIndirectRowLayout??null,structuralFingerprint:JSON.stringify({surfaceVertexRowLayout:t?.rowLayout??null,surfaceVertexRowStrideFloats:t?.rowStrideFloats??null,surfaceDrawRowLayout:n?.rowLayout??null,surfaceDrawRowStrideFloats:n?.rowStrideFloats??null,surfaceDrawIndirectRowLayout:n?.drawIndirectRowLayout??null,surfaceDrawIndirectRowStrideUints:n?.drawIndirectRowStrideUints??null,positionClamp:e?.positionClamp??null,surfaceVertexPositionClamp:t?.positionClamp??null,surfaceDrawPositionClamp:n?.positionClamp??null,surfaceVerticesSurfaces:r,surfaceDrawSurfaces:i}),renderConsumptionFingerprint:JSON.stringify({directCompactPositionDraw:n?.directCompactPositionDraw===!0,sourceVertexRowCount:n?.sourceVertexRowCount??null,sourceVertexCount:n?.sourceVertexCount??null,sourceVertexCountMode:n?.sourceVertexCountMode??null,vertexCount:n?.vertexCount??null,triangleCount:n?.triangleCount??null,compactPositionRowsBufferRetained:n?.compactPositionRowsBufferRetained??null,compactPositionRowsBufferByteLength:n?.compactPositionRowsBufferByteLength??null,compactPositionRowsBufferRowCount:n?.compactPositionRowsBufferRowCount??null,compactPositionRowsVertexCount:n?.compactPositionRowsVertexCount??null,compactPositionRowsStrideFloats:n?.compactPositionRowsStrideFloats??null,compactPositionRowsStrideBytes:n?.compactPositionRowsStrideBytes??null,compactPositionRowsFormat:n?.compactPositionRowsFormat??null,compactPositionRowsSchema:n?.compactPositionRowsSchema??null,compactPositionRowsOwnership:n?.compactPositionRowsOwnership??null,compactPositionRowsSurfaceGenerationId:n?.compactPositionRowsSurfaceGenerationId??null,compactPositionRowsVolumeGenerationId:n?.compactPositionRowsVolumeGenerationId??null,compactNormalRowsBufferRetained:n?.compactNormalRowsBufferRetained??null,compactNormalRowsBufferByteLength:n?.compactNormalRowsBufferByteLength??null,compactNormalRowsBufferRowCount:n?.compactNormalRowsBufferRowCount??null,compactNormalRowsSchema:n?.compactNormalRowsSchema??null,compactNormalRowsDescriptorSchema:n?.compactNormalRowsDescriptorSchema??null,compactNormalRowsLayoutName:n?.compactNormalRowsLayoutName??null,compactNormalRowsEncoding:n?.compactNormalRowsEncoding??null,compactNormalRowsSemantic:n?.compactNormalRowsSemantic??null,compactNormalRowsSourceSemantic:n?.compactNormalRowsSourceSemantic??null,compactNormalRowsNormalSign:n?.compactNormalRowsNormalSign??null,compactNormalRowsSurfaceGenerationId:n?.compactNormalRowsSurfaceGenerationId??null,compactNormalRowsPairedPositionSurfaceGenerationId:n?.compactNormalRowsPairedPositionSurfaceGenerationId??null,compactNormalRowsVolumeGenerationId:n?.compactNormalRowsVolumeGenerationId??null,compactNormalRowsSameSubmitAsPosition:n?.compactNormalRowsSameSubmitAsPosition??null,compactNormalRowsLifetimeOwner:n?.compactNormalRowsLifetimeOwner??null,compactNormalRowsPairedWithPositionBuffer:n?.compactNormalRowsPairedWithPositionBuffer??null,compactNormalRowsProducerStage:n?.compactNormalRowsProducerStage??null,compactNormalRowsTimestampSpanLabel:n?.compactNormalRowsTimestampSpanLabel??null,compactNormalRowsAdditionalSubmitCount:n?.compactNormalRowsAdditionalSubmitCount??null,compactNormalRowsOwnership:n?.compactNormalRowsOwnership??null,surfaceCount:n?.surfaceCount??null,activeSurfaceCount:n?.activeSurfaceCount??null,compactedVertexRowsBufferRetained:n?.compactedVertexRowsBufferRetained??null,compactedVertexRowsBufferByteLength:n?.compactedVertexRowsBufferByteLength??null,renderFieldGradientVolumePresent:n?.renderFieldGradientVolume!=null,renderFieldGradientDims:n?.renderFieldGradientVolume?.dims??null,renderFieldGradientScalarStrides:n?.renderFieldGradientVolume?.scalarStrides??null,renderFieldGradientScalarOffset:n?.renderFieldGradientVolume?.scalarOffset??null,drawIndirectRowsBufferRetained:n?.drawIndirectRowsBufferRetained??null,drawIndirectRowsBufferByteLength:n?.drawIndirectRowsBufferByteLength??null,drawIndirectRowsOwnership:n?.drawIndirectRowsOwnership??null,directCompactPositionDrawIndirectSource:n?.directCompactPositionDrawIndirectSource??null,readbackMode:n?.readbackMode??null,positionTransformStatus:n?.positionTransformStatus??null,positionClampStatus:n?.positionClampStatus??null,density:n?.density??null,isolation:n?.isolation??null,sourceVoxelLinearIndex:n?.sourceVoxelLinearIndex??null,fallbackNormal:n?.fallbackNormal??null}),primitiveFingerprint:JSON.stringify({status:e?.status??null,backend:e?.backend??null,sourceVertexCount:e?.sourceVertexCount??null,translatedVertexCount:e?.translatedVertexCount??null,triangleCount:e?.triangleCount??null,directCompactPositionDraw:e?.directCompactPositionDraw===!0,compactPositionRowsSurfaceGenerationId:e?.compactPositionRowsSurfaceGenerationId??null,compactPositionRowsVolumeGenerationId:e?.compactPositionRowsVolumeGenerationId??null,compactNormalRowsSurfaceGenerationId:e?.compactNormalRowsSurfaceGenerationId??null,compactNormalRowsPairedPositionSurfaceGenerationId:e?.compactNormalRowsPairedPositionSurfaceGenerationId??null,compactNormalRowsVolumeGenerationId:e?.compactNormalRowsVolumeGenerationId??null,positionTransformStatus:e?.positionTransformStatus??null,surfaceVertexStatus:t?.status??null,surfaceVertexCount:t?.vertexCount??null,surfaceVertexTriangleCount:t?.triangleCount??null,surfaceDrawStatus:n?.status??null,surfaceDrawVertexCount:n?.vertexCount??null,surfaceDrawTriangleCount:n?.triangleCount??null,surfaceIndex:s?.surfaceIndex??null,indirectOffsetBytes:s?.indirectOffsetBytes??null})}}function qo({translation:e,extractionLineage:t}={}){if(!e||!t)return null;if(Ho(t.extensionExecution,t.sourceFamily)!==t)throw TypeError(`successor surface publication requires the still-active exact extraction lineage`);let n=Ko(e),r={active:!0,device:t.device,sourceFamily:t.sourceFamily,descriptor:t.descriptor,extensionExecution:t.extensionExecution,extractionLineage:t,translation:e,...n,vertexRowsBytes:no(n.vertexRows),drawRowsBytes:no(n.drawRows),drawIndirectRowsBytes:no(n.drawIndirectRows),compactedVertexRowsBytes:no(n.compactedVertexRows)};return eo.set(e,r),n.surfaceVertices&&eo.set(n.surfaceVertices,r),n.surfaceDraw&&eo.set(n.surfaceDraw,r),r}function Jo(e){let t=eo.get(e);t&&(t.active=!1)}function Yo(e,{device:t,sourceFamily:n=e?.schroederSpatialSourceFamily??null,descriptor:r=null,extensionExecution:i=null}={}){let a=eo.get(e);if(!a||a.active!==!0||a.device!==t||a.sourceFamily!==n||r&&a.descriptor!==r||i&&a.extensionExecution!==i)return!1;let o=null;try{o=Uo(a.extensionExecution,a.sourceFamily)}catch{return!1}let s=Ko(a.translation);return!!(o===a.extractionLineage&&co(a.translation,a.sourceFamily)&&co(a.surfaceVertices,a.sourceFamily)&&co(a.surfaceDraw,a.sourceFamily)&&a.translation?.surfaceVertices===a.surfaceVertices&&a.translation?.surfaceDraw===a.surfaceDraw&&s.surfaceVertices===a.surfaceVertices&&s.surfaceDraw===a.surfaceDraw&&s.surfaceVerticesSurfaces===a.surfaceVerticesSurfaces&&s.surfaceDrawSurfaces===a.surfaceDrawSurfaces&&s.surfaceVerticesSurface===a.surfaceVerticesSurface&&s.surfaceDrawSurface===a.surfaceDrawSurface&&s.vertexRows===a.vertexRows&&s.drawRows===a.drawRows&&s.drawIndirectRows===a.drawIndirectRows&&s.compactedVertexRows===a.compactedVertexRows&&ro(s.vertexRows,a.vertexRowsBytes)&&ro(s.drawRows,a.drawRowsBytes)&&ro(s.drawIndirectRows,a.drawIndirectRowsBytes)&&ro(s.compactedVertexRows,a.compactedVertexRowsBytes)&&s.vertexRowsBuffer===a.vertexRowsBuffer&&s.drawRowsBuffer===a.drawRowsBuffer&&s.drawIndirectRowsBuffer===a.drawIndirectRowsBuffer&&s.compactedVertexRowsBuffer===a.compactedVertexRowsBuffer&&s.surfaceVerticesCompactPositionRowsBuffer===a.surfaceVerticesCompactPositionRowsBuffer&&s.surfaceDrawCompactPositionRowsBuffer===a.surfaceDrawCompactPositionRowsBuffer&&s.surfaceVerticesCompactNormalRowsBuffer===a.surfaceVerticesCompactNormalRowsBuffer&&s.surfaceDrawCompactNormalRowsBuffer===a.surfaceDrawCompactNormalRowsBuffer&&s.surfaceDrawRenderFieldGradientVolume===a.surfaceDrawRenderFieldGradientVolume&&s.surfaceDrawRenderFieldGradientBuffer===a.surfaceDrawRenderFieldGradientBuffer&&s.translationCompactNormalRowsBuffer===a.translationCompactNormalRowsBuffer&&s.translationPositionTransform===a.translationPositionTransform&&s.surfaceVerticesPositionTransform===a.surfaceVerticesPositionTransform&&s.surfaceDrawPositionTransform===a.surfaceDrawPositionTransform&&s.translationPositionTransform===a.descriptor.positionTransform&&s.surfaceVerticesPositionTransform===a.descriptor.positionTransform&&s.surfaceDrawPositionTransform===a.descriptor.positionTransform&&s.surfaceVertexRowLayout===a.surfaceVertexRowLayout&&s.surfaceDrawRowLayout===a.surfaceDrawRowLayout&&s.surfaceDrawIndirectRowLayout===a.surfaceDrawIndirectRowLayout&&s.structuralFingerprint===a.structuralFingerprint&&s.renderConsumptionFingerprint===a.renderConsumptionFingerprint&&s.primitiveFingerprint===a.primitiveFingerprint)}async function Xo({device:e,extensionExecution:t,schroederSpatialSourceFamily:n=null,surfaceIndex:i=0,materialId:a=0,phaseId:o=0,opticalStateId:s=0,material:c=null,phase:l=null,renderKey:u=null,surfaceKey:d=null,density:m=0,isolation:h=null,sourceVoxelLinearIndex:g=0,fallbackNormal:_=[0,1,0],transparencyClassId:v=0,depthWriteFlag:y=1,renderOrder:b=null,positionTransform:S=null,positionTransformResolution:C=null,fieldPadding:w=null,refEdgeM:T=null,positionGridBias:E=-.5,positionClampMinM:D=null,positionClampMaxM:k=null,fieldGradient:A=null,readbackMode:M=Ka,compactSummaryReadback:N=!1,translateVertexRows:ee=!0,allowExtensionDrawIndirectBuffer:P=!1,retainVertexRowsBuffer:F=!0,retainDrawRowsBuffer:I=!0,retainDrawIndirectRowsBuffer:te=!0,waitForQueueCompletion:ne=!0,onProgress:re=null}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu requires a WebGPU-like device`);let ie=Ho(t,n),ae=ie?.sourceFamily??null;if(ae){let t=Go(ie,{device:e,surfaceIndex:i,isolation:h,sourceVoxelLinearIndex:g,positionTransform:S,positionTransformResolution:C,fieldPadding:w,refEdgeM:T,fieldGradient:A,positionClampMinM:D,positionClampMaxM:k});i=t.surfaceIndex,h=t.isolation,g=t.sourceVoxelLinearIndex,S=t.positionTransform,C=t.positionTransformResolution,w=t.fieldPadding,T=t.refEdgeM,A=t.fieldGradient,D=null,k=null}let oe=Bo(t);if(oe.extensionOk!==!0)throw TypeError(oe.reason||`extension surface execution was not successful`);let L=Io(t?.result||null).buffer;if(!L||oe.extensionBufferRetained!==!0)throw TypeError(`buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu requires a retained extension surface buffer`);Fo(t),ae&&se(ae,{device:e,particleCount:ae.particleCount});let R=M===Ka,z=!!(R&&ee===!1);if(!R&&ee===!1)throw TypeError(`direct compact-position surface draw metadata requires no-full-readback mode`);let B=Math.max(3,Math.round($(oe.extensionVertexStrideFloats,4))),V=Math.max(0,Math.round($(oe.extensionVertexCount,0))),ce=oe.extensionVertexCountMode??null,le=t?.result||null,H=Lo(le);if(z&&oe.extensionPackedNormalReady!==!0)throw TypeError(`direct compact-position surface draw requires generation-matched packed normals (${oe.extensionPackedNormalStatus})`);if(z&&H.normalSign!==-1)throw TypeError(`ULG SPH density surfaces require packed normalSign=-1`);let ue=le?.actualVertexCounterBuffer||le?.vertexCounterBuffer||null,U=Math.max(0,Math.round($(le?.actualVertexCounterBufferByteLength??le?.vertexCounterBufferByteLength??ue?.size,0))),W=le?.drawIndirectBuffer||null,de=Math.max(0,Math.round($(le?.drawIndirectBufferByteLength??W?.size,0))),pe=ue,he=!1,ye=Math.floor(V/3),K=ye*3,Te=Math.max(0,Math.round($(i,0))),Ee=$(a,0),De=$(o,0),Oe=$(s,0),ke=$(m,0),Ae=$(h??t?.result?.isovalue??t?.isovalue,0),je=_o(_),Me=S||vo({resolution:C,fieldPadding:w,refEdgeM:T,positionGridBias:E}),Ne=go({min:D,max:k}),Pe=bo({positionTransform:Me,positionClamp:Ne}),Fe=b==null?Te:$(b,Te),Ie=$(v,0),Le=$(y,1),Re=K*p.length*Float32Array.BYTES_PER_ELEMENT,ze=z?0:Re,Be=r.length*Float32Array.BYTES_PER_ELEMENT,Ve=f.length*Uint32Array.BYTES_PER_ELEMENT,He=!!(z&&P&&!N&&W&&de>=Ve),Ue=He?`webgpu-marching-cubes-extension-draw-indirect-buffer`:`ulg-compact-position-draw-metadata-kernel`,We=He?`extension-owned-retained-buffer`:`ulg-owned-retained-buffer`,Ge=typeof re==`function`?(e,t={})=>{try{re({status:e,stage:`webgpu-marching-cubes-extension-surface-translation`,sourceVertexCount:V,sourceVertexCountMode:ce,translatedVertexCount:K,triangleCount:ye,vertexRowsByteLength:ze,translatedVertexRowsByteLength:Re,drawRowsByteLength:Be,drawIndirectRowsByteLength:Ve,directCompactPositionDraw:z,directCompactPositionDrawIndirectSource:Ue,drawIndirectRowsOwnership:We,readbackMode:R?Ka:Ga,compactSummaryReadback:!!N,...t})}catch{}}:()=>{};Ge(`extension-surface-translation-kernel-started`);let Ke=new Set,qe=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,Je=!1,Ye=(t,n=null)=>{let r=qe&&n?_e(fe(e,{bucketKey:n,label:t.label,size:t.size,usage:t.usage}),e,{bucketKey:n,size:t.size,usage:t.usage}):e.createBuffer(t);return Ke.add(r),r},Xe=(e,t=!1)=>{if(!e||!Ke.delete(e))return!1;try{ve(e,{allowPool:t})}catch{}return!0},Ze=e=>(e&&Ke.delete(e),e);try{let t=null;z||(t=Ye({label:`ulg-sph-extension-surface-vertices`,size:Math.max(4,ze),usage:qa.STORAGE|qa.VERTEX|qa.COPY_SRC|qa.COPY_DST}));let n=z?`skipped-direct-compact-position-draw`:R?`skipped-no-full-readback-indirect-draw`:`cleared-for-readback`;!z&&!R&&ze>0&&e.queue.writeBuffer(t,0,new Float32Array(K*p.length));let i=new Float32Array(r.length);He&&jo(i,0,{surfaceIndex:Te,materialId:Ee,phaseId:De,opticalStateId:Oe,vertexOffset:0,vertexCount:K,triangleOffset:0,triangleCount:ye,renderOrder:Fe,transparencyClassId:Ie,depthWriteFlag:Le,status:+(ye>0),boundsCenterM:Pe?.centerM??[0,0,0],boundsRadiusM:Pe?.radiusM??0});let a=Ye({label:`ulg-sph-extension-surface-draw`,size:Math.max(4,Be),usage:qa.STORAGE|qa.COPY_SRC|qa.COPY_DST},`ulg-sph-extension-surface-draw`);e.queue.writeBuffer(a,0,i);let o=He?W:Ye({label:`ulg-sph-extension-surface-draw-indirect`,size:Math.max(4,Ve),usage:qa.STORAGE|qa.INDIRECT|qa.COPY_SRC|qa.COPY_DST},`ulg-sph-extension-surface-draw-indirect`);He||e.queue.writeBuffer(o,0,new Uint32Array(f.length));let s=He?null:Ye({label:`ulg-sph-extension-surface-translation-params`,size:160,usage:qa.UNIFORM|qa.COPY_DST},`ulg-sph-extension-surface-translation-params`);!pe&&!He&&(pe=Ye({label:`ulg-sph-extension-surface-source-vertex-count`,size:4,usage:qa.STORAGE|qa.COPY_DST},`ulg-sph-extension-surface-source-vertex-count`),e.queue.writeBuffer(pe,0,new Uint32Array([V])),he=!0);let m=A?.buffer&&Number.isFinite(A.resolution)&&A.resolution>0?{buffer:A.buffer,resolution:Math.round(A.resolution),scalarOffsetFloats:Math.max(0,Math.round(Number(A.scalarOffsetFloats)||0)),rowStrideFloats:Math.max(1,Math.round(Number(A.rowStrideFloats)||1))}:null;He||e.queue.writeBuffer(s,0,Mo({vertexCount:V,sourceStrideFloats:B,surfaceIndex:Te,triangleCount:ye,materialId:Ee,phaseId:De,opticalStateId:Oe,density:ke,isolation:Ae,sourceVoxelLinearIndex:g,transparencyClassId:Ie,depthWriteFlag:Le,renderOrder:Fe,fallbackNormal:je,positionTransform:Me,positionClamp:Ne,surfaceBounds:Pe,fieldGradient:m})),Ge(`extension-surface-translation-buffers-ready`);let h=He?null:z?me(e,{cacheKey:`ulg-sph-webgpu-marching-cubes-extension-compact-surface-draw:v1`,label:`ulg-sph-webgpu-marching-cubes-extension-compact-surface-draw`,code:uo,entryPoint:`main`,bindings:[G(0,`storage`),G(1,`storage`),G(2,`uniform`),G(3,`read-only-storage`)]}):me(e,{cacheKey:`ulg-sph-webgpu-marching-cubes-extension-surface-translation:v3-degenerate-cull`,label:`ulg-sph-webgpu-marching-cubes-extension-surface-translation`,code:lo,entryPoint:`main`,bindings:[G(0,`read-only-storage`),G(1,`storage`),G(2,`storage`),G(3,`storage`),G(4,`uniform`),G(5,`read-only-storage`),G(6,`read-only-storage`)]}),_=He?`skipped-extension-draw-indirect-buffer`:h.cacheStatus??null,v=null,y=null,b=0,S=null;if(He)Ge(`extension-surface-translation-command-skipped`,{reason:`using extension-owned drawIndirectBuffer for direct compact-position draw`,workgroupCountX:b});else{let{pipeline:n,bindGroupLayout:r}=h;v=e.createBindGroup({layout:r,entries:z?[{binding:0,resource:{buffer:a}},{binding:1,resource:{buffer:o}},{binding:2,resource:{buffer:s}},{binding:3,resource:{buffer:pe}}]:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:a}},{binding:3,resource:{buffer:o}},{binding:4,resource:{buffer:s}},{binding:5,resource:{buffer:pe}},{binding:6,resource:{buffer:m?.buffer||(S=Ye({label:`ulg-sph-extension-surface-field-gradient-dummy`,size:4,usage:qa.STORAGE}))}}]}),y=e.createCommandEncoder();let i=y.beginComputePass();i.setPipeline(n),i.setBindGroup(0,v),b=z?1:Math.max(1,Math.ceil(Math.max(1,ye)/Ya)),i.dispatchWorkgroups(b),i.end(),Ge(`extension-surface-translation-command-encoded`,{workgroupCountX:b})}let C=new Float32Array,w=He?i:new Float32Array,T=new Uint32Array,E=!1,D=0,k=`not-submitted`,M=null,ee=!1;R?(He?(k=`queue-work-not-required`,M=`extension-owned-draw-indirect-buffer`):ne&&e.queue?.onSubmittedWorkDone?(e.queue.submit([y.finish()]),Je=!0,k=`queue-submitted`,M=`queue.submit`,await e.queue.onSubmittedWorkDone(),k=`queue-work-completed`,M=`queue.onSubmittedWorkDone`):(e.queue.submit([y.finish()]),Je=!0,k=e.queue?.onSubmittedWorkDone&&!N?`queue-submitted-cleanup-deferred`:`queue-submitted-no-explicit-completion`,M=e.queue?.onSubmittedWorkDone&&!N?`deferred queue.onSubmittedWorkDone cleanup`:`queue.submit`,ee=!!(e.queue?.onSubmittedWorkDone&&!N)),N&&(w=new Float32Array(await No(e,a,Be,`ulg-sph-extension-surface-draw-summary-readback`)),E=!0,D=Be,k=`compact-summary-readback-map-completed`,M=`mapAsync(compact-summary-readback-buffer)`)):(e.queue.submit([y.finish()]),Je=!0,k=`queue-submitted`,M=`queue.submit`,ze>0&&(C=new Float32Array(await No(e,t,ze,`ulg-sph-extension-surface-vertex-readback`))),w=new Float32Array(await No(e,a,Be,`ulg-sph-extension-surface-draw-readback`)),T=new Uint32Array(await No(e,o,Ve,`ulg-sph-extension-surface-draw-indirect-readback`)),k=`readback-map-completed`,M=`mapAsync(readback-buffer)`,Ge(`extension-surface-translation-full-readback-complete`));let P=()=>{Xe(s),Xe(S),he&&Xe(pe)},re=!z&&(F||R),se=I||R,fe=te||R;re||Xe(t),se||Xe(a),!fe&&!He&&Xe(o),ee?ge(e,P):P();let _e=Po({surfaceIndex:Te,materialId:Ee,phaseId:De,opticalStateId:Oe,material:c,phase:l,renderKey:u,surfaceKey:d,vertexCount:K,triangleCount:ye,renderOrder:Fe,transparencyClassId:Ie,depthWriteFlag:Le,status:!R||N?ye>0?`surface-draw-ready`:`surface-draw-empty`:`surface-draw-summary-not-read`,boundsCenterM:Pe?.centerM??null,boundsRadiusM:Pe?.radiusM??null,indirectRowIndex:0,indirectOffsetBytes:0}),Re=ue?`extension-gpu-vertex-counter`:`host-constant-vertex-count`,Ke=!!ue,Qe=ue?U:4,$e=!!(L&&oe.extensionBufferRetained),et=Math.max(0,Math.round($(oe.extensionVertexStrideBytes,B*Float32Array.BYTES_PER_ELEMENT)))*V,tt=le?.surfaceGenerationId??null,nt=le?.volumeGenerationId??null,rt=!!(z&&H.buffer&&H.bufferRetained&&oe.extensionPackedNormalReady),it=rt?H.bufferByteLength:0,at={compactNormalRowsBufferRetained:rt,compactNormalRowsBufferByteLength:it,compactNormalRowsBufferRowCount:rt?H.rowCount:0,compactNormalRowsSchema:H.rowSchema,compactNormalRowsDescriptorSchema:H.descriptorSchema,compactNormalRowsLayoutName:H.layoutName,compactNormalRowsEncoding:H.encoding,compactNormalRowsSemantic:H.semantic,compactNormalRowsSourceSemantic:H.sourceSemantic,compactNormalRowsNormalSign:Number.isFinite(H.normalSign)?H.normalSign:null,compactNormalRowsSurfaceGenerationId:H.surfaceGenerationId,compactNormalRowsPairedPositionSurfaceGenerationId:H.pairedPositionSurfaceGenerationId,compactNormalRowsVolumeGenerationId:H.volumeGenerationId,compactNormalRowsSameSubmitAsPosition:H.sameSubmitAsPosition,compactNormalRowsLifetimeOwner:H.lifetimeOwner,compactNormalRowsPairedWithPositionBuffer:H.pairedWithPositionBuffer,compactNormalRowsProducerStage:H.producerStage,compactNormalRowsTimestampSpanLabel:H.timestampSpanLabel,compactNormalRowsAdditionalSubmitCount:H.additionalSubmitCount,compactNormalRowsOwnership:`extension-owned-retained-buffer`},ot={translationPipelineCreated:!!h,translationBindGroupCreated:!!v,translationCommandEncoderCreated:!!y,translationWorkgroupCountX:b,translationSubmissionObserved:Je},st={schema:O,backend:`webgpu`,...so(ae),status:z?`surface-vertices-resident-extension-compact-position-direct`:R?`surface-vertices-resident-extension-compact-translation`:K>0?`surface-vertices-ready`:`surface-vertices-empty`,sourceSurfaceExecutionSchema:oe.extensionExecutionSchema,sourceSurfaceSchema:oe.extensionSurfaceSchema,surfaceExtractionMethod:z?`webgpu-marching-cubes-extension-compact-position-direct`:`webgpu-marching-cubes-extension-compact-position-gpu-translation`,compactionMode:z?`webgpu-extension-compact-position-direct`:`webgpu-extension-compact-position-to-ulg-rows`,directCompactPositionDraw:z,positionTransform:Me,positionTransformStatus:Me.status,positionClamp:Ne,positionClampStatus:Ne.status,surfaceCount:1,rowLayout:[...p],rowStrideFloats:p.length,vertexRows:C,vertexRowsByteLength:C.byteLength,vertexCount:K,vertexCountMode:ce,triangleCount:ye,maxVertexRows:K,vertexRowsBufferByteLength:re?ze:0,vertexRowsBufferRowCount:re?K:0,vertexRowsBufferRetained:re,sourceVertexCount:V,sourceVertexCountMode:ce,sourceVertexCounterMode:Re,sourceVertexCounterBufferBound:!!pe,sourceVertexCounterBufferRetained:Ke,sourceVertexCounterBufferByteLength:Qe,translatedVertexCount:K,ignoredTrailingVertexCount:V-K,sourceVertexRowsBufferBound:!0,sourceVertexFormat:oe.extensionVertexFormat,sourceVertexStrideFloats:B,compactPositionRowsBufferRetained:$e,compactPositionRowsBufferByteLength:et,compactPositionRowsBufferRowCount:V,compactPositionRowsVertexCount:V,compactPositionRowsStrideFloats:B,compactPositionRowsStrideBytes:Math.max(0,Math.round($(oe.extensionVertexStrideBytes,B*Float32Array.BYTES_PER_ELEMENT))),compactPositionRowsFormat:oe.extensionVertexFormat,compactPositionRowsSchema:za,compactPositionRowsOwnership:`extension-owned-retained-buffer`,compactPositionRowsSurfaceGenerationId:tt,compactPositionRowsVolumeGenerationId:nt,...at,vertexRowsBufferClearStatus:n,translationPipelineCacheStatus:_,...ot,directCompactPositionDrawIndirectSource:Ue,drawIndirectRowsOwnership:We,extensionDrawIndirectBufferRetained:!!W,extensionDrawIndirectBufferByteLength:de,readbackMode:R?Ka:Ga,queueCompletionStatus:k,queueCompletionMethod:M,surfaceVertexReadback:!R,surfaces:[_e],scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};re&&(st.vertexRowsBuffer=t),$e&&(st.compactPositionRowsBuffer=L),rt&&(st.compactNormalRowsBuffer=H.buffer);let J={schema:j,backend:`webgpu`,...so(ae),status:z?`surface-draw-resident-extension-compact-position-direct`:R?`surface-draw-resident-extension-compact-translation`:ye>0?`surface-draw-metadata-ready`:`surface-draw-metadata-empty`,sourceSurfaceVertexSchema:st.schema,sourceSurfaceVertexBackend:st.backend,surfaceCount:1,activeSurfaceCount:+(ye>0),vertexCount:K,vertexCountMode:ce,sourceVertexCount:V,sourceVertexCountMode:ce,sourceVertexCounterMode:Re,sourceVertexCounterBufferBound:!!pe,sourceVertexCounterBufferRetained:Ke,sourceVertexCounterBufferByteLength:Qe,vertexRowsBufferClearStatus:n,translationPipelineCacheStatus:_,...ot,directCompactPositionDrawIndirectSource:Ue,drawIndirectRowsOwnership:We,extensionDrawIndirectBufferRetained:!!W,extensionDrawIndirectBufferByteLength:de,triangleCount:ye,rowLayout:[...r],rowStrideFloats:r.length,drawRows:w,drawRowsByteLength:Be,drawRowsBufferByteLength:se?Be:0,drawRowsBufferRetained:se,drawIndirectSchema:x,drawIndirectRowLayout:[...f],drawIndirectRowStrideUints:f.length,drawIndirectRows:T,drawIndirectRowsByteLength:Ve,drawIndirectRowsBufferByteLength:fe?Ve:0,drawIndirectRowsBufferRetained:fe,drawIndirectRowsOwnership:We,directCompactPositionDrawIndirectSource:Ue,extensionDrawIndirectBufferRetained:!!W,extensionDrawIndirectBufferByteLength:de,compactedVertexRows:R?new Float32Array:C,compactedVertexRowsByteLength:R?0:C.byteLength,compactedVertexRowsBufferByteLength:re?ze:0,compactedVertexRowsBufferRetained:re,compactPositionRowsBufferRetained:$e,compactPositionRowsBufferByteLength:et,compactPositionRowsBufferRowCount:V,compactPositionRowsVertexCount:V,compactPositionRowsStrideFloats:B,compactPositionRowsStrideBytes:Math.max(0,Math.round($(oe.extensionVertexStrideBytes,B*Float32Array.BYTES_PER_ELEMENT))),compactPositionRowsFormat:oe.extensionVertexFormat,compactPositionRowsSchema:za,compactPositionRowsOwnership:`extension-owned-retained-buffer`,compactPositionRowsSurfaceGenerationId:tt,compactPositionRowsVolumeGenerationId:nt,...at,directCompactPositionDraw:z,sourceVertexRowCount:K,sourceVertexRowsBufferBound:!0,readbackMode:R?Ka:Ga,queueCompletionStatus:k,queueCompletionMethod:M,surfaceDrawReadback:!R,surfaceDrawSummaryReadback:E,surfaceDrawSummaryReadbackByteLength:D,fullSurfaceDrawReadback:!R,compactionMode:z?`webgpu-extension-compact-position-direct-draw-metadata`:`webgpu-extension-compact-position-to-ulg-draw-metadata`,positionTransform:Me,positionTransformStatus:Me.status,positionClamp:Ne,positionClampStatus:Ne.status,surfaces:[_e],scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};se&&(J.drawRowsBuffer=a),fe&&(J.drawIndirectRowsBuffer=o),re&&(J.compactedVertexRowsBuffer=t),$e&&(J.compactPositionRowsBuffer=L),rt&&(J.compactNormalRowsBuffer=H.buffer);let ct=be({ledgerId:`sph-extension-surface:${Te}:${K}:buffer-leases`,stateKey:`sph-extension-surface`,scope:`sph-extension-surface-buffer-leases`}),lt=[],ut=({resourceKey:e,resourceKind:t,buffer:n,byteLength:r,rowCount:i,expectedConsumers:a,status:o=`resident-extension-surface-buffer-retained`})=>{Ce(ct,{resourceKey:e,resourceKind:t,stateFamily:`render-surface`,ownerStage:`webgpu-marching-cubes-extension-surface-translation`,producerStage:`webgpu-marching-cubes-extension-surface-translation`,source:`buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu`,status:o,retained:!0,byteLength:r,rowCount:i,bufferLabel:n?.label,expectedConsumers:a});let s=Se(ct,{resourceKey:e,consumerStage:a?.[0]||`surface-renderer`,reason:`retained-extension-surface-buffer`});lt.push(s.leaseId)},dt=`extension-surface:vertex-rows:${K}:${ze}`,ft=`extension-surface:draw-rows:1:${Be}`,pt=`extension-surface:draw-indirect:1:${Ve}`,mt=`extension-surface:compact-position:g${H.surfaceGenerationId??`unknown`}:${et}`,ht=`extension-surface:packed-normal:g${H.surfaceGenerationId??`unknown`}:${it}`;z&&$e&&ut({resourceKey:mt,resourceKind:`extension-owned-compact-position-buffer`,buffer:L,byteLength:et,rowCount:V,expectedConsumers:[`surface-draw-renderer`,`diagnostics`],status:`resident-extension-surface-buffer-borrowed-generation-owned`}),rt&&ut({resourceKey:ht,resourceKind:`extension-owned-packed-normal-buffer`,buffer:H.buffer,byteLength:it,rowCount:H.rowCount,expectedConsumers:[`surface-draw-renderer`,`diagnostics`],status:`resident-extension-surface-buffer-borrowed-generation-owned`}),re&&ut({resourceKey:dt,resourceKind:`extension-surface-vertex-rows-buffer`,buffer:t,byteLength:ze,rowCount:K,expectedConsumers:[`surface-draw-renderer`,`diagnostics`]}),se&&ut({resourceKey:ft,resourceKind:`extension-surface-draw-rows-buffer`,buffer:a,byteLength:Be,rowCount:1,expectedConsumers:[`surface-draw-renderer`,`diagnostics`]}),fe&&ut({resourceKey:pt,resourceKind:He?`extension-owned-draw-indirect-buffer`:`extension-surface-draw-indirect-buffer`,buffer:o,byteLength:Ve,rowCount:1,expectedConsumers:[`surface-draw-renderer`,`diagnostics`],status:He?`resident-extension-surface-buffer-borrowed`:`resident-extension-surface-buffer-retained`});let Y={schema:Ba,status:z?`extension-surface-compact-position-direct-resident-webgpu`:R?`extension-surface-translated-resident-webgpu`:`extension-surface-translated-to-ulg-rows`,reason:V===K?null:`extension vertexCount was not divisible by 3; trailing vertices were ignored`,backend:`webgpu`,...so(ae),summary:oe,sourceBufferBound:!0,sourceBufferRetained:oe.extensionBufferRetained,compactPositionRowsBufferRetained:$e,compactPositionRowsBufferByteLength:et,compactPositionRowsVertexCount:V,compactPositionRowsStrideFloats:B,compactPositionRowsFormat:oe.extensionVertexFormat,compactPositionRowsOwnership:`extension-owned-retained-buffer`,compactPositionRowsSurfaceGenerationId:tt,compactPositionRowsVolumeGenerationId:nt,...at,directCompactPositionDraw:z,sourceVertexCount:V,translatedVertexCount:K,triangleCount:ye,ignoredTrailingVertexCount:V-K,sourceVertexFormat:oe.extensionVertexFormat,sourceVertexStrideFloats:B,surfaceVertices:st,surfaceDraw:J,vertexRowsBufferClearStatus:n,translationPipelineCacheStatus:_,...ot,directCompactPositionDrawIndirectSource:Ue,drawIndirectRowsOwnership:We,extensionDrawIndirectBufferRetained:!!W,extensionDrawIndirectBufferByteLength:de,positionTransform:Me,positionTransformStatus:Me.status,positionClamp:Ne,positionClampStatus:Ne.status,readbackMode:R?Ka:Ga,queueCompletionStatus:k,queueCompletionMethod:M,hotLoopGpuTranslationRequired:!1,hotLoopUlgVertexRowExpansionSkipped:z,residentBufferLeaseLedger:ct,residentBufferLeaseSummary:q(ct),residentBufferLeaseLedgerStatus:ct.status,residentBufferLeaseResourceCount:ct.resourceCount,residentBufferLeaseActiveLeaseCount:ct.activeLeaseCount};rt&&(Y.compactNormalRowsBuffer=H.buffer);let gt=()=>(Y.residentBufferLeaseSummary=q(ct),Y.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseSummary.status,Y.residentBufferLeaseResourceCount=Y.residentBufferLeaseSummary.resourceCount,Y.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseSummary.activeLeaseCount,st.residentBufferLeaseSummary=Y.residentBufferLeaseSummary,st.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseLedgerStatus,st.residentBufferLeaseResourceCount=Y.residentBufferLeaseResourceCount,st.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseActiveLeaseCount,J.residentBufferLeaseSummary=Y.residentBufferLeaseSummary,J.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseLedgerStatus,J.residentBufferLeaseResourceCount=Y.residentBufferLeaseResourceCount,J.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseActiveLeaseCount,Y.residentBufferLeaseSummary),_t=new Set,vt=null,yt=(e,t)=>{_t.has(e)||(_t.add(e),console.debug?.(`[ext-surface-destroy] surface=${Te} key=${e} reason=${vt}`),ve(t,{allowPool:qe}))};return Y.releaseExtensionSurfaceBufferLeases=({status:e=`released`}={})=>{for(let t of lt)xe(ct,t,{status:e});return gt()},Y.destroyExtensionSurfaceBuffers=({force:e=!1,releaseLeases:n=!1,reason:r=`extension-surface-buffer-cleanup`}={})=>(vt=r,Jo(Y),n&&Y.releaseExtensionSurfaceBufferLeases(),re&&we(ct,dt,()=>{yt(dt,t)},{force:e,reason:r}),z&&$e&&we(ct,mt,null,{force:e,reason:r}),rt&&we(ct,ht,null,{force:e,reason:r}),se&&we(ct,ft,()=>{yt(ft,a)},{force:e,reason:r}),fe&&we(ct,pt,He?null:()=>{yt(pt,o)},{force:e,reason:r}),gt()),st.residentBufferLeaseLedger=ct,st.residentBufferLeaseSummary=Y.residentBufferLeaseSummary,st.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseLedgerStatus,st.residentBufferLeaseResourceCount=Y.residentBufferLeaseResourceCount,st.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseActiveLeaseCount,st.releaseExtensionSurfaceBufferLeases=Y.releaseExtensionSurfaceBufferLeases,st.destroyExtensionSurfaceBuffers=Y.destroyExtensionSurfaceBuffers,st.releaseSurfaceVertexBufferLeases=Y.releaseExtensionSurfaceBufferLeases,st.destroySurfaceVertexBuffers=Y.destroyExtensionSurfaceBuffers,J.residentBufferLeaseLedger=ct,J.residentBufferLeaseSummary=Y.residentBufferLeaseSummary,J.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseLedgerStatus,J.residentBufferLeaseResourceCount=Y.residentBufferLeaseResourceCount,J.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseActiveLeaseCount,J.releaseExtensionSurfaceBufferLeases=Y.releaseExtensionSurfaceBufferLeases,J.destroyExtensionSurfaceBuffers=Y.destroyExtensionSurfaceBuffers,J.releaseSurfaceDrawBufferLeases=Y.releaseExtensionSurfaceBufferLeases,J.destroySurfaceDrawBuffers=Y.destroyExtensionSurfaceBuffers,ie&&qo({translation:Y,extractionLineage:ie}),re&&Ze(t),se&&Ze(a),fe&&!He&&Ze(o),Y}catch(t){let n=()=>{for(let e of[...Ke])Xe(e)};if(Je)try{ge(e,n)}catch{n()}else n();throw t}}var Zo=`peercompute.ulg.native-surface-temperature-rows.v0`,Qo=`peercompute.ulg.native-surface-temperature-coverage.v0`,$o=`peercompute.ulg.native-surface-temperature-execution.v0`,es=`peercompute.ulg.native-surface-temperature-f32-kelvin.v0`,ts={COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256},ns=4294967295,rs=Float32Array.BYTES_PER_ELEMENT,is=new WeakMap;function as(e){let t=is.get(e);if(t)return{...t,dispatchPlanPipelineCacheStatus:`pipeline-cache-hit`,temperaturePipelineCacheStatus:`pipeline-cache-hit`};let n=me(e,{cacheKey:`ulg-native-surface-temperature-dispatch-plan.v0`,label:`ulg-native-surface-temperature-dispatch-plan`,code:os,entryPoint:`plan_dispatch`,bindings:[G(3,`uniform`),G(4,`read-only-storage`),G(5,`storage`)]}),r=me(e,{cacheKey:`ulg-native-surface-temperature-rows.v1-indirect`,label:`ulg-native-surface-temperature-rows`,code:os,entryPoint:`main`,bindings:[G(0,`read-only-storage`),G(1,`read-only-storage`),G(2,`storage`),G(3,`uniform`),G(4,`read-only-storage`)]}),i=Object.freeze({dispatchPlanPipeline:n.pipeline,dispatchPlanBindGroupLayout:n.bindGroupLayout,dispatchPlanPipelineCacheStatus:n.cacheStatus,pipeline:r.pipeline,bindGroupLayout:r.bindGroupLayout,temperaturePipelineCacheStatus:r.cacheStatus});return is.set(e,i),i}var os=`
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
`;function ss(e,t){if(!e||typeof e!=`object`&&typeof e!=`function`)throw TypeError(`${t} is required`);return e}function cs(e,t){let n=Number(e);if(!Number.isSafeInteger(n)||n<0||n>ns)throw RangeError(`${t} must be a non-negative uint32 integer`);return n}function ls(e,t){let n=cs(e,t);if(n<=0)throw RangeError(`${t} must be positive`);return n}function us(e,t,n){let r=ls(t??e?.size,`${n}ByteLength`);if(r%rs!==0)throw RangeError(`${n}ByteLength must be aligned to f32 rows`);if(Number.isFinite(Number(e?.size))&&r>Number(e.size))throw RangeError(`${n}ByteLength exceeds the GPU buffer size`);return r}function ds(e,t){if(!(Array.isArray(e)||ArrayBuffer.isView(e))||e.length<3)throw TypeError(`${t} must contain three uint32 integers`);return[ls(e[0],`${t}[0]`),ls(e[1],`${t}[1]`),ls(e[2],`${t}[2]`)]}function fs(e,t){if(e==null)throw TypeError(`${t} must be explicitly authored`);return cs(e,t)}function ps(e,t){if(e===void 0)throw TypeError(`${t} must be explicitly authored (null is allowed)`);return e===null?null:cs(e,t)}function ms(e,t){return!!(e&&Object.prototype.hasOwnProperty.call(e,t))}function hs(e,t,n){if(e&&!ms(e,t))throw TypeError(`${n}.${t} must be explicitly authored`)}function gs(e,t,n){if(e!==t)throw RangeError(`${n} metadata disagrees across source descriptors`)}function _s(e,t,n){let r=Number(e?.limits?.maxStorageBufferBindingSize);if(Number.isFinite(r)&&r>0&&t>r)throw RangeError(`${n} exceeds maxStorageBufferBindingSize`)}function vs({conservativeVertexRowCount:e,compactPositionStrideFloats:t,compactPositionFloatCount:n,renderFieldFloatCount:r,fieldDimensions:i,fieldOffsetFloats:a,fieldStridesFloats:o,maxComputeWorkgroupsPerDimension:s=65535}){let c=new Uint32Array(64/4);return c[0]=e,c[1]=t,c[2]=n,c[3]=r,c[4]=i[0],c[5]=i[1],c[6]=i[2],c[7]=a,c[8]=o[0],c[9]=o[1],c[10]=o[2],c[11]=s,c}function ys({device:e,commandEncoder:t,compactPositions:n=null,actualVertexCounter:r=null,renderField:i=null,generation:a=null,compactPositionRowsBuffer:o=n?.buffer??null,compactPositionRowsBufferByteLength:s=n?.byteLength,conservativeVertexRowCount:c=n?.rowCount,compactPositionRowsStrideFloats:l=n?.strideFloats,actualVertexCounterBuffer:u=r?.buffer??null,actualVertexCounterBufferByteLength:d=r?.byteLength,renderFieldScalarsBuffer:f=i?.buffer??null,renderFieldScalarsBufferByteLength:p=i?.byteLength,fieldDimensions:m=i?.dims,fieldStridesFloats:h=i?.scalarStrides,fieldOffsetFloats:g=i?.scalarOffsetFloats??i?.scalarOffset??0,surfaceGenerationId:_=a?.surfaceGenerationId??n?.surfaceGenerationId,volumeGenerationId:v=ms(a,`volumeGenerationId`)?a.volumeGenerationId:ms(n,`volumeGenerationId`)?n.volumeGenerationId:void 0,renderFieldVolumeGenerationId:y=ms(i,`volumeGenerationId`)?i.volumeGenerationId:void 0,label:b=`ulg-native-surface-temperature-rows`}={}){if(ss(e,`device`),typeof e.createBuffer!=`function`||typeof e.createShaderModule!=`function`||typeof e.createComputePipeline!=`function`||typeof e.createBindGroup!=`function`)throw TypeError(`device must provide the required WebGPU compute methods`);if(ss(t,`commandEncoder`),typeof t.beginComputePass!=`function`)throw TypeError(`commandEncoder must be a caller-owned GPUCommandEncoder`);ss(o,`compactPositionRowsBuffer`),ss(u,`actualVertexCounterBuffer`),ss(f,`renderFieldScalarsBuffer`),hs(n,`surfaceGenerationId`,`compactPositions`),hs(n,`volumeGenerationId`,`compactPositions`),hs(i,`volumeGenerationId`,`renderField`),hs(a,`surfaceGenerationId`,`generation`),hs(a,`volumeGenerationId`,`generation`);let x=fs(_,`surfaceGenerationId`);n&&gs(x,fs(n.surfaceGenerationId,`compactPositions.surfaceGenerationId`),`surfaceGenerationId`),a&&gs(x,fs(a.surfaceGenerationId,`generation.surfaceGenerationId`),`surfaceGenerationId`);let S=ps(v,`volumeGenerationId`);gs(S,ps(y,`renderFieldVolumeGenerationId`),`volumeGenerationId`),i&&gs(S,ps(i.volumeGenerationId,`renderField.volumeGenerationId`),`volumeGenerationId`),n&&gs(S,ps(n.volumeGenerationId,`compactPositions.volumeGenerationId`),`volumeGenerationId`),a&&gs(S,ps(a.volumeGenerationId,`generation.volumeGenerationId`),`volumeGenerationId`);let C=ls(c,`conservativeVertexRowCount`),w=ls(l,`compactPositionRowsStrideFloats`);if(w<3)throw RangeError(`compactPositionRowsStrideFloats must contain xyz`);let T=us(o,s,`compactPositionRowsBuffer`),E=T/rs,D=C*w;if(!Number.isSafeInteger(D)||D>ns||D>E)throw RangeError(`compact position buffer does not cover every conservative vertex row`);let O=us(u,d,`actualVertexCounterBuffer`);if(O<Uint32Array.BYTES_PER_ELEMENT)throw RangeError(`actualVertexCounterBuffer must contain one u32 counter`);let k=ds(m,`fieldDimensions`),A=ds(h,`fieldStridesFloats`),j=cs(g,`fieldOffsetFloats`),M=us(f,p,`renderFieldScalarsBuffer`),N=M/rs,ee=j+(k[0]-1)*A[0]+(k[1]-1)*A[1]+(k[2]-1)*A[2]+4;if(!Number.isSafeInteger(ee)||ee>ns||ee>=N)throw RangeError(`render field buffer does not cover density lane 0 and temperature lane +4`);let P=C*rs,F=ls(e?.limits?.maxComputeWorkgroupsPerDimension??65535,`maxComputeWorkgroupsPerDimension`);_s(e,T,`compact position binding`),_s(e,M,`render field binding`),_s(e,P,`temperature output binding`),_s(e,Uint32Array.BYTES_PER_ELEMENT,`actual vertex counter binding`);let I=vs({conservativeVertexRowCount:C,compactPositionStrideFloats:w,compactPositionFloatCount:E,renderFieldFloatCount:N,fieldDimensions:k,fieldOffsetFloats:j,fieldStridesFloats:A,maxComputeWorkgroupsPerDimension:F}),te=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,ne=ts.UNIFORM|ts.COPY_DST,re=3*Uint32Array.BYTES_PER_ELEMENT,ie=ts.STORAGE|ts.INDIRECT,ae=ts.STORAGE|ts.COPY_SRC|ts.COPY_DST,oe=Math.min(Number(e.limits?.maxStorageBufferBindingSize)||134217728,Number(e.limits?.maxBufferSize)||268435456),L=P;if(te){let e=4096;for(;e<P&&e*2<=oe;)e*=2;L=e>=P?e:P}let se=null,R=null,z=null;try{se=te?fe(e,{bucketKey:`ulg-native-surface-temperature-rows-output`,label:`${b}-output`,size:L,usage:ae}):e.createBuffer({label:`${b}-output`,size:P,usage:ts.STORAGE|ts.COPY_SRC}),te&&typeof t.clearBuffer==`function`&&t.clearBuffer(se,0,P),R=te?fe(e,{bucketKey:`ulg-native-surface-temperature-params`,label:`${b}-params`,size:64,usage:ne}):e.createBuffer({label:`${b}-params`,size:64,usage:ne}),e.queue.writeBuffer(R,0,I.buffer,I.byteOffset,I.byteLength),z=te?fe(e,{bucketKey:`ulg-native-surface-temperature-dispatch-indirect`,label:`${b}-dispatch-indirect`,size:re,usage:ie}):e.createBuffer({label:`${b}-dispatch-indirect`,size:re,usage:ie});let{dispatchPlanPipeline:n,dispatchPlanBindGroupLayout:r,dispatchPlanPipelineCacheStatus:i,pipeline:a,bindGroupLayout:s,temperaturePipelineCacheStatus:c}=as(e),l=pe(e,{label:`${b}-dispatch-plan-bind-group`,layout:r,entries:[{binding:3,resource:{buffer:R,size:64}},{binding:4,resource:{buffer:u,size:Uint32Array.BYTES_PER_ELEMENT}},{binding:5,resource:{buffer:z,size:re}}]}),d=pe(e,{label:`${b}-bind-group`,layout:s,entries:[{binding:0,resource:{buffer:o,size:T}},{binding:1,resource:{buffer:f,size:M}},{binding:2,resource:{buffer:se,size:te?L:P}},{binding:3,resource:{buffer:R,size:64}},{binding:4,resource:{buffer:u,size:Uint32Array.BYTES_PER_ELEMENT}}]}),p=t.beginComputePass({label:`${b}-dispatch-plan-pass`});p.setPipeline(n),p.setBindGroup(0,l),p.dispatchWorkgroups(1),p.end();let m=t.beginComputePass({label:`${b}-compute-pass`});if(m.setPipeline(a),m.setBindGroup(0,d),typeof m.dispatchWorkgroupsIndirect!=`function`)throw TypeError(`commandEncoder compute pass must support dispatchWorkgroupsIndirect`);m.dispatchWorkgroupsIndirect(z,0),m.end();let h=!1,g={schema:Qo,status:`gpu-counter-clamped-prefix-encoded-zero-initialized-tail`,mode:`gpu-counter-clamped-conservative-vertex-row-prefix`,firstRow:0,endRowExclusive:C,rowCount:C,conservativeVertexRowCount:C,compactPositionRowCount:C,encodedRowCountSource:`gpu-actual-vertex-counter-clamped-to-conservative-capacity`,unusedTailInitialization:`webgpu-zero-initialized-fresh-output-buffer`,outputStrideFloats:1,outputByteLength:P,surfaceGenerationId:x,volumeGenerationId:S,complete:!0},_=i===c?i:`mixed-pipeline-cache-status`,v={schema:$o,temperatureRowsSchema:Zo,temperatureRowsLayoutName:es,status:`native-surface-temperature-command-encoded`,backend:`webgpu`,encoding:`f32-kelvin`,semantic:`density-weighted-render-field-temperature-k`,densityLaneOffsetFloats:0,temperatureLaneOffsetFloats:4,surfaceGenerationId:x,volumeGenerationId:S,coverage:g,temperatureRowsBuffer:se,temperatureRowsBufferByteLength:P,temperatureRowsBufferRowCount:C,temperatureRowsStrideFloats:1,temperatureRowsOwnership:`ulg-owned-generation-buffer`,paramsBuffer:R,paramsBufferByteLength:64,paramsBufferOwnership:`ulg-owned-generation-buffer`,dispatchArgsBuffer:z,dispatchArgsBufferByteLength:3*Uint32Array.BYTES_PER_ELEMENT,dispatchArgsBufferOwnership:`ulg-owned-generation-buffer`,actualVertexCounterBufferByteLength:O,actualVertexCounterMode:`gpu-actual-vertex-counter-clamped-to-conservative-capacity`,compactPositionRowsBufferByteLength:T,compactPositionRowsStrideFloats:w,renderFieldScalarsBufferByteLength:M,fieldDimensions:[...k],fieldStridesFloats:[...A],fieldOffsetFloats:j,workgroupCountX:null,workgroupCountXUpperBound:Math.min(F,Math.ceil(C/64)),workgroupCountYUpperBound:Math.max(1,Math.ceil(Math.ceil(C/64)/F)),maxComputeWorkgroupsPerDimension:F,dispatchMode:`dispatchWorkgroupsIndirect`,pipelineCacheStatus:_,dispatchPlanPipelineCacheStatus:i,temperaturePipelineCacheStatus:c,commandEncoderOwnership:`caller-owned-external-command-encoder`,commandPassCount:2,additionalSubmitCount:0,readbackPerformed:!1,fullReadbackPerformed:!1,destroyed:!1,destroy(){return h?!1:(h=!0,te?(ye(e,se,{bucketKey:`ulg-native-surface-temperature-rows-output`,size:L,usage:ae}),ye(e,R,{bucketKey:`ulg-native-surface-temperature-params`,size:64,usage:ne}),ye(e,z,{bucketKey:`ulg-native-surface-temperature-dispatch-indirect`,size:re,usage:ie})):(se.destroy?.(),R.destroy?.(),z.destroy?.()),v.destroyed=!0,v.status=`native-surface-temperature-resources-destroyed`,!0)}};return v}catch(e){throw se?.destroy?.(),R?.destroy?.(),z?.destroy?.(),e}}export{Zt as A,ea as C,Zi as D,Fi as E,Oi as O,ta as S,oa as T,zn as _,To as a,aa as b,Do as c,Fa as d,pa as f,Ln as g,jn as h,Xo as i,fn as j,ar as k,Wo as l,Nn as m,Va as n,Vo as o,Fn as p,Ao as r,oo as s,ys as t,Yo as u,ia as v,Yr as w,Gr as x,ki as y};