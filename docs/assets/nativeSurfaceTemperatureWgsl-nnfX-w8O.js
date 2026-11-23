import{$i as e,Bh as t,C as n,Dn as r,En as i,Jh as a,Oh as o,On as s,Qi as c,Xu as l,Yu as u,Zi as d,_n as f,bn as p,dd as m,ea as h,fa as g,fd as _,gn as v,ha as y,hd as b,hn as x,ma as S,md as C,mn as w,na as T,pa as E,pd as D,pn as O,rn as k,ta as A,ud as j,vn as M,yn as N}from"./eshkolTriadClosures-9Z_qNCQ3.js";import{Eo as P,F,G as I,Kc as L,N as ee,So as te,X as ne,Y as re,_o as ie,al as R,bo as ae,co as z,dc as B,el as V,fc as H,il as U,mo as oe,ol as W,pc as se,ro as G,uc as K,uo as ce,z as le}from"./sphGpuBuffers-mT7xOtO0.js";import{acquireQueueOrderedPooledBuffer as ue,computeBufferBinding as q,createCachedExplicitBindGroup as de,createCachedExplicitComputePipeline as fe,createExplicitComputePipeline as pe,deferSubmittedWorkCleanup as me,registerQueueOrderedPooledBufferReturn as he,releaseOrDestroyQueueOrderedPooledBuffer as ge,releaseQueueOrderedPooledBuffer as _e}from"../runtime/webgpuComputeLayout.js";import{a as ve,l as J,o as ye,r as be,s as xe,t as Se}from"./residentBufferLease-DDgtlGZ9.js";import{t as Ce}from"./radiationClosure-B9e6bKCa.js";var we=new WeakMap,Te=new WeakMap,Ee=1;function De(e){return(typeof e==`object`||typeof e==`function`)&&e!=null}function Oe(e){if(!De(e))return null;let t=we.get(e);return t??(t=`gpu-device-${Ee++}`,we.set(e,t)),t}function ke(e,t,{resourceKind:n=`gpu-resource`}={}){if(!De(e))throw TypeError(`markResourceDevice requires a resource object`);if(!De(t))throw TypeError(`markResourceDevice requires a device object`);let r={device:t,deviceId:Oe(t),resourceKind:n};return Te.set(e,r),r}function Ae(e,t){return ke(e,t,{resourceKind:`gpu-buffer`})}function je(e,t){return ke(e,t,{resourceKind:`gpu-texture`})}function Me(e){if(!De(e))return null;let t=Te.get(e);if(t!=null)return t;let n=e.ownerDevice||e.device||null;return De(n)?{device:n,deviceId:Oe(n),resourceKind:e.constructor?.name||`gpu-resource`}:null}function Ne(e){let t=Me(e);return t==null?{ownerKnown:!1,ownerDeviceId:null,resourceKind:e?.constructor?.name||`unknown-resource`}:{ownerKnown:!0,ownerDeviceId:t.deviceId,resourceKind:t.resourceKind}}function Pe({device:e,resource:t,label:n=`resource`,allowUnknown:r=!0}={}){let i=Oe(e);if(!De(e))return{ok:!1,status:`expected-device-missing`,label:n,expectedDeviceId:null,ownerKnown:!1,ownerDeviceId:null};if(!De(t))return{ok:!1,status:`resource-missing`,label:n,expectedDeviceId:i,ownerKnown:!1,ownerDeviceId:null};let a=Me(t);if(a==null)return{ok:!!r,status:r?`resource-device-unknown`:`resource-device-unknown-blocked`,label:n,expectedDeviceId:i,ownerKnown:!1,ownerDeviceId:null};let o=a.device===e;return{ok:o,status:o?`same-device`:`cross-device-resource`,label:n,expectedDeviceId:i,ownerKnown:!0,ownerDeviceId:a.deviceId,resourceKind:a.resourceKind}}var Fe=`peercompute.webgpu-marching-cubes.surface-adapter.v0`,Ie=`peercompute.webgpu-marching-cubes.adapter-contract.v0`,Le=`peercompute.webgpu-marching-cubes.surface-preflight.v0`,Re=`peercompute.webgpu-marching-cubes.device-ownership-validation.v0`,ze=`peercompute.webgpu-marching-cubes.volume-source.v0`,Be=`peercompute.webgpu-marching-cubes.surface.v0`,Ve=`peercompute.webgpu-marching-cubes.surface-execution.v0`,He=`peercompute.webgpu-marching-cubes.surface-row-metadata.v0`,Ue=`peercompute.webgpu-marching-cubes.surface-output-descriptor.v0`,We=`peercompute.webgpu-marching-cubes.device-policy.v0`,Ge=`peercompute.webgpu-marching-cubes.material-metadata.v0`,Ke=`peercompute.webgpu-marching-cubes.pbr-metadata.v0`,qe=`peercompute.webgpu-marching-cubes.position-buffer-descriptor.v0`,Je=`peercompute.webgpu-marching-cubes.normal-buffer-descriptor.v0`,Ye=`peercompute.webgpu-marching-cubes.cpu-fallback.v0`,Xe=`peercompute.webgpu-marching-cubes.compact-position-rows.v0`,Ze=`peercompute.webgpu-marching-cubes.compact-normal-rows.v0`,Qe=`peercompute.webgpu-marching-cubes.compact-material-rows.v0`,$e=`peercompute.webgpu-marching-cubes.surface-draw-rows.v0`,et=`peercompute.webgpu-marching-cubes.indirect-draw-rows.v0`,tt=`peercompute.webgpu-marching-cubes.layout.compact-position-f32x4.v0`,nt=`peercompute.webgpu-marching-cubes.layout.compact-normal-f32x4.v0`,rt=`peercompute.webgpu-marching-cubes.packed-normal-rows.v0`,it=`peercompute.webgpu-marching-cubes.layout.normal-octahedral-snorm16x2.v0`,at=`octahedral-snorm16x2`,ot=`peercompute.webgpu-marching-cubes.layout.compact-material-f32x4.v0`,st=`peercompute.webgpu-marching-cubes.layout.surface-draw-u32x4.v0`,ct=`peercompute.webgpu-marching-cubes.layout.indirect-draw-u32x4.v0`,lt=Object.freeze([`positionX:f32`,`positionY:f32`,`positionZ:f32`,`padding:f32`]),ut=Object.freeze([`normalX:f32`,`normalY:f32`,`normalZ:f32`,`padding:f32`]),dt=Object.freeze([`normalOctahedralSnorm16x2:u32`]),ft=Object.freeze([`materialId:f32`,`phaseId:f32`,`sourceVoxelLinearIndex:f32`,`status:f32`]),pt=Object.freeze([`firstVertex:u32`,`vertexCount:u32`,`materialSlot:u32`,`flags:u32`]),mt=Object.freeze([`vertexCount:u32`,`instanceCount:u32`,`firstVertex:u32`,`firstInstance:u32`]),ht=`float32x4-position`,Y=`texture-3d`,gt=`scalar-buffer`,_t=`peercompute.webgpu-marching-cubes.layout.scalar-field-f32.v0`,vt=`sparse-brick-atlas`,yt=`peercompute.webgpu-marching-cubes.layout.sparse-brick-atlas-f32.v0`,bt=4294967295,xt=4294967295;Object.freeze([`timestamp-query`]);function X(e){return(typeof e==`object`||typeof e==`function`)&&e!=null}function St(e,t){let n=Number(e);if(!Number.isFinite(n))throw TypeError(`${t} must be a finite number`);return n}function Ct(e,t=`normalSign`){let n=St(e??1,t);if(n!==-1&&n!==1)throw RangeError(`${t} must be exactly -1 or 1`);return n}function wt(e,t=`dims`){if(!Array.isArray(e)&&!ArrayBuffer.isView(e))throw TypeError(`${t} must be an array-like [x, y, z]`);if(e.length<3)throw RangeError(`${t} must have at least three entries`);return Array.from(e.slice(0,3),(e,n)=>{let r=Number(e);if(!Number.isInteger(r)||r<=0)throw RangeError(`${t}[${n}] must be a positive integer`);return r})}function Tt(e,t){let n=Number(e);if(!Number.isInteger(n)||n<=0)throw RangeError(`${t} must be a positive integer`);return n}function Et(e,t){let n=Number(e);if(!Number.isInteger(n)||n<0)throw RangeError(`${t} must be a non-negative integer`);return n}function Dt(e,t){let n=Et(e,t);if(n>4294967295)throw RangeError(`${t} must fit in a u32`);return n}function Ot(e,t,n){let r=t??e?.size??e?.byteLength??null;return r==null?null:Et(r,`${n}.byteLength`)}function kt(e){return e?.scalarBuffer||e?.storageBuffer||(e?.sourceType===`scalar-buffer`?e?.buffer:null)||(!X(e?.texture)&&e?.dims!=null?e?.buffer:null)||null}function At(e,{texture:t=null,scalarBuffer:n=null,directoryBuffer:r=null,activeBrickRowsBuffer:i=null,atlasBuffer:a=null,candidateVoxelIdsBuffer:o=null}={}){if(e!=null){let t=String(e);if(t===`texture-3d`||t===`scalar-buffer`||t===`sparse-brick-atlas`)return t;throw TypeError(`unsupported volume sourceType ${t}`)}return X(r)||X(i)||X(a)||X(o)?vt:X(n)?gt:X(t)?Y:null}function jt(e){return String(e?.scalarType||e?.scalarFormat||e?.format||`f32`)}function Mt(e){let t=e?.scalarOffset??e?.scalarOffsetFloats??e?.bufferOffsetFloats??e?.offsetFloats??e?.offset??null,n=e?.scalarOffsetBytes??e?.bufferOffsetBytes??e?.byteOffset??null;if(n!=null){let e=Et(n,`scalarOffsetBytes`);if(e%Float32Array.BYTES_PER_ELEMENT!=0)throw RangeError(`scalarOffsetBytes must be a multiple of 4 for f32 scalar buffers`);if(t!=null&&Et(t,`scalarOffset`)*Float32Array.BYTES_PER_ELEMENT!=e)throw RangeError(`scalarOffset and scalarOffsetBytes describe different offsets`);return e/Float32Array.BYTES_PER_ELEMENT}return t==null?0:Et(t,`scalarOffset`)}function Nt(e,t){let n=e?.scalarStrides||e?.strides||null;if(n!=null){if(!Array.isArray(n)&&!ArrayBuffer.isView(n))throw TypeError(`scalarStrides must be an array-like [x, y, z]`);if(n.length<3)throw RangeError(`scalarStrides must have at least three entries`);return Array.from(n.slice(0,3),(e,t)=>Tt(e,`scalarStrides[${t}]`))}let r=Tt(e?.rowStrideFloats??e?.rowStride??t[0],`rowStrideFloats`);return[1,r,Tt(e?.sliceStrideFloats??e?.sliceStride??r*t[1],`sliceStrideFloats`)]}function Pt(e,t){let n=t?.bufferByteLength??t?.scalarBufferByteLength??t?.byteLength??null??e?.size??e?.byteLength??null;return n==null?null:Et(n,`scalarBuffer.byteLength`)}function Ft(e,t){let n=kt(e),r=jt(e),i=Nt(e,t),a=Mt(e),o=Pt(n,e),s=a+(t[0]-1)*i[0]+(t[1]-1)*i[1]+(t[2]-1)*i[2],c=s+1,l=c*Float32Array.BYTES_PER_ELEMENT;return{sourceType:gt,layoutName:_t,scalarType:r,scalarBuffer:n,storageBuffer:n,scalarStrides:i,rowStrideFloats:i[1],sliceStrideFloats:i[2],scalarOffset:a,scalarOffsetBytes:a*Float32Array.BYTES_PER_ELEMENT,bufferByteLength:o,requiredScalarCount:c,requiredByteLength:l,maxScalarIndex:s,byteLengthValid:o==null||o>=l}}function It(e,t){let n=Tt(e?.brickSize??8,`brickSize`),r=t.map(e=>Math.ceil(e/n)),i=Dt(r[0]*r[1]*r[2],`directoryCount`);if(e?.directoryCount!=null&&Dt(e.directoryCount,`directoryCount`)!==i)throw RangeError(`directoryCount must equal the exact brickCounts product`);let a=Dt(e?.directoryOffset??0,`directoryOffset`),o=Tt(e?.activeBrickRowStrideU32??e?.activeBrickRowStride??16,`activeBrickRowStrideU32`),s=Dt(e?.activeBrickAtlasCellOffsetLane??7,`activeBrickAtlasCellOffsetLane`);if(s>=o)throw RangeError(`activeBrickAtlasCellOffsetLane must be within an active brick row`);let c=Tt(e?.atlasCellStrideFloats??e?.atlasCellStride??8,`atlasCellStrideFloats`),l=Dt(e?.atlasScalarLane??0,`atlasScalarLane`);if(l>=c)throw RangeError(`atlasScalarLane must be within an atlas cell row`);let u=e?.candidateVoxelOffset??e?.candidateVoxelOffsetU32??null,d=e?.candidateVoxelOffsetBytes??null,f;if(d!=null){let e=Et(d,`candidateVoxelOffsetBytes`);if(e%Uint32Array.BYTES_PER_ELEMENT!=0)throw RangeError(`candidateVoxelOffsetBytes must be a multiple of 4`);if(f=Dt(e/Uint32Array.BYTES_PER_ELEMENT,`candidateVoxelOffset`),u!=null&&Dt(u,`candidateVoxelOffset`)!==f)throw RangeError(`candidateVoxelOffset and candidateVoxelOffsetBytes describe different offsets`)}else f=Dt(u??0,`candidateVoxelOffset`);let p=f*Uint32Array.BYTES_PER_ELEMENT,m=Dt(e?.directorySentinel??4294967295,`directorySentinel`),h=Dt(e?.candidateSentinel??4294967295,`candidateSentinel`);if(m!==4294967295||h!==4294967295)throw RangeError(`sparse directory and candidate sentinels must be 0xffffffff`);let g=e?.directoryBuffer||null,_=e?.activeBrickRowsBuffer||null,v=e?.atlasBuffer||null,y=e?.candidateVoxelIdsBuffer||null,b=e?.candidateDispatchIndirectBuffer||null,x=Ot(g,e?.directoryBufferByteLength,`directoryBuffer`),S=Ot(_,e?.activeBrickRowsBufferByteLength,`activeBrickRowsBuffer`),C=Ot(v,e?.atlasBufferByteLength,`atlasBuffer`),w=Ot(y,e?.candidateVoxelIdsBufferByteLength,`candidateVoxelIdsBuffer`),T=b==null?null:Ot(b,e?.candidateDispatchIndirectBufferByteLength,`candidateDispatchIndirectBuffer`),E=Et(e?.candidateDispatchIndirectOffsetBytes??0,`candidateDispatchIndirectOffsetBytes`);if(E%Uint32Array.BYTES_PER_ELEMENT!==0)throw RangeError(`candidateDispatchIndirectOffsetBytes must be a multiple of 4`);let D=Dt(e?.activeBrickCount??e?.activeBrickCapacity??(S==null?0:Math.floor(S/(o*Uint32Array.BYTES_PER_ELEMENT))),`activeBrickCount`),O=Dt(e?.atlasCellCount??e?.atlasCellCapacity??(C==null?0:Math.floor(C/(c*Float32Array.BYTES_PER_ELEMENT))),`atlasCellCount`),k=Dt(e?.candidateVoxelCount??e?.candidateVoxelCapacity??(w==null?0:Math.max(0,Math.floor(w/Uint32Array.BYTES_PER_ELEMENT)-f)),`candidateVoxelCount`),A=Dt(e?.generationId??e?.generation??0,`generationId`),j=St(e?.backgroundValue??0,`backgroundValue`),M=(a+i)*Uint32Array.BYTES_PER_ELEMENT,N=D*o*Uint32Array.BYTES_PER_ELEMENT,P=O*c*Float32Array.BYTES_PER_ELEMENT,F=(f+k)*Uint32Array.BYTES_PER_ELEMENT,I=b==null?0:E+3*Uint32Array.BYTES_PER_ELEMENT,L={directory:x==null||x>=M,activeBrickRows:S==null||S>=N,atlas:C==null||C>=P,candidateVoxelIds:w==null||w>=F,candidateDispatchIndirect:b==null||T>=I};return{sourceType:vt,layoutName:yt,directoryBuffer:g,activeBrickRowsBuffer:_,atlasBuffer:v,candidateVoxelIdsBuffer:y,candidateDispatchIndirectBuffer:b,brickSize:n,brickCounts:r,tailBrickSampleExtent:t.map(e=>(e-1)%n+1),directoryOffset:a,directoryCount:i,directorySentinel:m,activeBrickCount:D,activeBrickCapacity:D,activeBrickRowStrideU32:o,activeBrickAtlasCellOffsetLane:s,atlasCellCount:O,atlasCellCapacity:O,atlasCellStrideFloats:c,atlasScalarLane:l,candidateVoxelCount:k,candidateVoxelCapacity:k,candidateVoxelOffset:f,candidateVoxelOffsetU32:f,candidateVoxelOffsetBytes:p,candidateVoxelBindingByteLength:k*Uint32Array.BYTES_PER_ELEMENT,candidateDispatchIndirectOffsetBytes:E,candidateDispatchIndirectBufferByteLength:T,candidateDispatchIndirectRequiredByteLength:I,candidateDispatchMode:b==null?`fixed-capacity`:`gpu-indirect-admitted-count`,candidateSentinel:h,generationId:A,generation:A,backgroundValue:j,directoryBufferByteLength:x,directoryRequiredByteLength:M,activeBrickRowsBufferByteLength:S,activeBrickRowsRequiredByteLength:N,atlasBufferByteLength:C,atlasRequiredByteLength:P,candidateVoxelIdsBufferByteLength:w,candidateVoxelIdsRequiredByteLength:F,byteLengthChecks:L,byteLengthValid:Object.values(L).every(Boolean),candidateContract:`logical dual-grid voxel IDs; unused capacity entries are 0xffffffff`,candidateDispatchContract:b==null?`host capacity dispatch with sentinel guards`:`GPU-authored dispatchWorkgroupsIndirect u32x3 row; x is zero when generation admission fails`}}function Lt(e){return{name:e?.name||`Error`,message:e instanceof Error?e.message:String(e),status:e?.status||e?.code||`error`,details:e?.details||null,stage:e?.stage||e?.adapterStage||e?.marchingCubesStage||null,stack:e instanceof Error&&e.stack||null}}function Rt(e,t){if(e!=null&&(typeof e==`object`||typeof e==`function`))try{e.adapterStage=e.adapterStage||t}catch{}return e}function zt(e,t={}){return{status:e,at:new Date().toISOString(),...t}}function Bt({ownsDevice:e=!1,ownerDeviceId:t=null,device:n=null}={}){let r=!!e;return{schema:We,version:0,ownership:r?`adapter-owned`:`caller-owned`,ownsDevice:r,requestDeviceByDefault:!1,ownedDeviceHelper:`requestWebGpuMarchingCubesDevice`,sameDeviceChecks:!0,ownerDeviceId:t,deviceLabel:typeof n?.label==`string`?n.label:null}}function Vt(e=null){return e?.schema===`peercompute.webgpu-marching-cubes.material-metadata.v0`?{version:0,role:`material-metadata`,available:!!e.available,payload:e.payload??null,placeholder:e.payload==null,...e}:{schema:Ge,version:0,role:`material-metadata`,available:e!=null,placeholder:e==null,payload:e}}function Ht(e=null){return e?.schema===`peercompute.webgpu-marching-cubes.pbr-metadata.v0`?{version:0,role:`pbr-metadata`,available:!!e.available,payload:e.payload??null,placeholder:e.payload==null,...e}:{schema:Ke,version:0,role:`pbr-metadata`,available:e!=null,placeholder:e==null,payload:e}}function Ut({status:e=`position-rows-empty`,available:t=!1,rowCount:n=0,buffer:r=null,bufferOffsetBytes:i=0,bufferByteLength:a=0,bufferRetained:o=!1,bufferOwnership:s=`none`,ownerDeviceId:c=null,resourceOwnership:l=null,devicePolicy:u=null,bufferKind:d=null}={}){let f=Math.max(0,Math.round(Number(n)||0)),p=Math.max(0,Math.round(Number(a)||0)),m=f*lt.length*Float32Array.BYTES_PER_ELEMENT,h=d||r?.bufferKind||(r==null?`none`:`gpu-buffer`);return{schema:qe,version:0,role:`position-buffer`,status:e,available:!!t,layoutName:tt,rowSchema:Xe,rowLayout:[...lt],vertexFormat:ht,rowStrideFloats:lt.length,rowStrideBytes:lt.length*Float32Array.BYTES_PER_ELEMENT,rowCount:f,count:f,buffer:r,bufferKind:h,bufferOffsetBytes:i,bufferByteLength:p,byteLength:p,expectedByteLength:m,byteLengthValid:!t||p>=m,bufferRetained:!!o,bufferOwnership:s,ownership:{buffer:s,device:u?.ownership||null,ownerDeviceId:c,resourceOwnership:l},ownerDeviceId:c,resourceOwnership:l,sameDeviceStatus:l?.status||null,sameDevice:l?.ok??null,devicePolicy:u,readback:!1}}function Wt({status:e=`normal-rows-empty`,available:t=!1,rowCount:n=0,buffer:r=null,bufferOffsetBytes:i=0,bufferByteLength:a=0,bufferRetained:o=!1,bufferOwnership:s=`none`,ownerDeviceId:c=null,resourceOwnership:l=null,devicePolicy:u=null,surfaceGenerationId:d=null,volumeGenerationId:f=null,normalSign:p=1,bufferKind:m=null}={}){let h=Math.max(0,Math.round(Number(n)||0)),g=Math.max(0,Math.round(Number(a)||0)),_=h*Uint32Array.BYTES_PER_ELEMENT,v=m||r?.bufferKind||(r==null?`none`:`gpu-buffer`),y=Ct(p),b=d==null?null:Et(d,`surfaceGenerationId`),x=f==null?null:Et(f,`volumeGenerationId`);return{schema:Je,version:0,descriptorVersion:0,role:`normal-buffer`,status:e,available:!!t,layoutName:it,rowSchema:rt,rowLayout:[...dt],rowStrideBytes:Uint32Array.BYTES_PER_ELEMENT,rowCount:h,count:h,encoding:at,componentEncoding:`snorm16x2`,decode:`octahedral-unit-vector`,semantic:`oriented-scalar-gradient`,sourceSemantic:`scalar-gradient`,normalSign:y,degenerateEncoding:`reserved-u32-0x80008000`,degenerateSentinel:2147516416,buffer:r,bufferKind:v,bufferOffsetBytes:i,bufferByteLength:g,byteLength:g,expectedByteLength:_,byteLengthValid:!t||g>=_,bufferRetained:!!o,bufferOwnership:s,ownership:{buffer:s,device:u?.ownership||null,ownerDeviceId:c,resourceOwnership:l,lifetimeOwner:`surface-result-release`,pairedPositionRelease:!0},ownerDeviceId:c,resourceOwnership:l,sameDeviceStatus:l?.status||null,sameDevice:l?.ok??null,devicePolicy:u,generation:{schema:`peercompute.webgpu-marching-cubes.surface-buffer-generation.v0`,surfaceGenerationId:b,volumeGenerationId:x,pairedPositionSurfaceGenerationId:b,producerStage:`marchingCubesVertexEmit`,sameSubmitAsPosition:!0},lifetime:{owner:`surface-result`,releaseMethod:`surface.release`,pairedWithPositionBuffer:!0,retireAfterConsumerSubmitFence:!0},producer:{stage:`marchingCubesVertexEmit`,timestampSpanLabel:`marchingCubesVertexEmit`,additionalSubmitCount:0},readback:!1}}function Gt({schema:e,family:t,status:n,available:r=!1,layoutName:i,rowLayout:a,rowStrideFloats:o=0,rowStrideBytes:s=0,rowCount:c=0,buffer:l=null,bufferOffsetBytes:u=0,bufferByteLength:d=0,bufferRetained:f=!1,bufferOwnership:p=`none`,ownerDeviceId:m=null,resourceOwnership:h=null,devicePolicy:g=null,reason:_=null,derivation:v=null,sourceCounts:y=null,materialPayload:b=null,pbrPayload:x=null,bufferKind:S=null}={}){let C=S||l?.bufferKind||(l==null?`none`:`gpu-buffer`),w={schema:e,version:0,descriptorVersion:0,family:t,role:`${t}-rows`,status:n,available:!!r,produced:!!r,layoutName:i,rowLayout:[...a],rowStrideFloats:o,rowStrideBytes:s,rowCount:c,count:c,buffer:l,bufferOffsetBytes:u,bufferByteLength:d,byteLength:d,expectedByteLength:Math.max(0,c*s),byteLengthValid:!r||d>=Math.max(0,c*s),bufferRetained:!!f,bufferKind:C,bufferOwnership:p,ownership:{buffer:p,device:g?.ownership||null,ownerDeviceId:m,resourceOwnership:h},ownerDeviceId:m,resourceOwnership:h,devicePolicy:g,materialPayload:b,pbrPayload:x,sourceCounts:y,reason:_,derivation:v,readback:!1};return t===`position`&&(w.positionBufferDescriptor=Ut({status:n,available:r,rowCount:c,buffer:l,bufferOffsetBytes:u,bufferByteLength:d,bufferRetained:f,bufferOwnership:p,ownerDeviceId:m,resourceOwnership:h,devicePolicy:g,bufferKind:C})),w}function Kt({buffer:e=null,bufferByteLength:t=0,bufferRetained:n=!1,bufferOwnership:r=`none`,ownerDeviceId:i=null,resourceOwnership:a=null,devicePolicy:o=null,vertexCount:s=0,triangleCount:c=0,normalBuffer:l=null,normalBufferByteLength:u=0,normalResourceOwnership:d=null,surfaceGenerationId:f=null,volumeGenerationId:p=null,normalSign:m=1,materialPayload:h=null,pbrPayload:g=null}={}){let _=Math.max(0,Math.round(Number(s)||0)),v=Math.max(0,Math.round(Number(c)||0)),y=_>0&&X(e),b=y&&X(l)&&u>=_*Uint32Array.BYTES_PER_ELEMENT,x=y?t:0,S=Vt(h),C=Ht(g),w={vertexCount:_,triangleCount:v},T=Wt({status:b?`normal-rows-resident`:`normal-rows-not-produced`,available:b,rowCount:b?_:0,buffer:b?l:null,bufferByteLength:b?u:0,bufferRetained:b&&!!n,bufferOwnership:b?r:`none`,ownerDeviceId:i,resourceOwnership:b?d:null,devicePolicy:o,surfaceGenerationId:f,volumeGenerationId:p,normalSign:m}),E={position:Gt({schema:Xe,family:`position`,status:y?`position-rows-resident`:`position-rows-empty`,available:y,layoutName:tt,rowLayout:lt,rowStrideFloats:4,rowStrideBytes:16,rowCount:_,buffer:e,bufferOffsetBytes:0,bufferByteLength:x,bufferRetained:y&&!!n,bufferOwnership:y?r:`none`,ownerDeviceId:i,resourceOwnership:a,devicePolicy:o,sourceCounts:w,materialPayload:S,pbrPayload:C}),normal:Gt({schema:b?rt:Ze,family:`normal`,status:T.status,available:b,layoutName:b?it:nt,rowLayout:b?dt:ut,rowStrideFloats:b?0:4,rowStrideBytes:b?Uint32Array.BYTES_PER_ELEMENT:16,rowCount:b?_:0,buffer:b?l:null,bufferByteLength:b?u:0,bufferRetained:b&&!!n,bufferOwnership:b?r:`none`,ownerDeviceId:i,resourceOwnership:b?d:null,devicePolicy:o,sourceCounts:w,reason:b?null:`surface engine did not provide packed normal rows`,derivation:b?`central-difference scalar gradients interpolated during marching-cubes vertex emission`:`consumer may use a face-normal fallback for legacy engines`}),material:Gt({schema:Qe,family:`material`,status:`material-rows-not-produced`,available:!1,layoutName:ot,rowLayout:ft,rowStrideFloats:4,rowStrideBytes:16,rowCount:0,devicePolicy:o,sourceCounts:w,materialPayload:S,pbrPayload:C,reason:`native kernel currently has no material, phase, or PBR input`,derivation:`supply material and PBR metadata in the caller-owned translation stage`}),draw:Gt({schema:$e,family:`draw`,status:`draw-rows-not-produced`,available:!1,layoutName:st,rowLayout:pt,rowStrideFloats:0,rowStrideBytes:16,rowCount:0,devicePolicy:o,sourceCounts:w,reason:`adapter emits one retained compact position buffer, not renderer draw rows`,derivation:`ULG can translate the retained triangle-list positions into surface draw rows`}),indirect:Gt({schema:et,family:`indirect`,status:`indirect-draw-rows-not-produced`,available:!1,layoutName:ct,rowLayout:mt,rowStrideFloats:0,rowStrideBytes:16,rowCount:0,devicePolicy:o,sourceCounts:w,reason:`adapter does not own the render pass or indirect draw buffer`,derivation:`ULG can build indirect draw rows from vertexCount and caller-owned draw policy`})};return E.normal.normalBufferDescriptor=T,E.normal.encoding=T.encoding,E.normal.semantic=T.semantic,E.normal.sourceSemantic=T.sourceSemantic,E.normal.normalSign=T.normalSign,E.normal.generation=T.generation,E.normal.lifetime=T.lifetime,E.normal.producer=T.producer,{schema:Ue,version:0,descriptorVersion:0,status:y?`surface-outputs-resident`:`surface-outputs-empty`,topology:`triangle-list`,indexFormat:null,layoutName:tt,rowLayoutName:tt,vertexFormat:ht,rowCount:_,vertexCount:_,triangleCount:v,byteLength:x,readback:!1,fullReadback:!1,devicePolicy:o,materialPayload:S,pbrPayload:C,retainedBuffers:{position:y?e:null,normal:b?l:null},rows:E,positionBufferDescriptor:E.position.positionBufferDescriptor,normalBufferDescriptor:T,materialDescriptor:E.material,drawDescriptor:E.draw,indirectDescriptor:E.indirect}}function qt({buffer:e=null,bufferByteLength:t=0,bufferRetained:n=!1,bufferOwnership:r=`none`,ownerDeviceId:i=null,resourceOwnership:a=null,devicePolicy:o=null,vertexCount:s=0,triangleCount:c=0,normalBuffer:l=null,normalBufferByteLength:u=0,normalResourceOwnership:d=null,surfaceGenerationId:f=null,volumeGenerationId:p=null,normalSign:m=1,materialPayload:h=null,pbrPayload:g=null}={}){let _=Math.max(0,Math.round(Number(s)||0)),v=_>0&&X(e),y=v&&X(l)&&u>=_*Uint32Array.BYTES_PER_ELEMENT,b=v?`position-rows-resident`:`position-rows-empty`,x=Vt(h),S=Ht(g),C=Wt({status:y?`normal-rows-resident`:`normal-rows-not-produced`,available:y,rowCount:y?_:0,buffer:y?l:null,bufferByteLength:y?u:0,bufferRetained:y&&!!n,bufferOwnership:y?r:`none`,ownerDeviceId:i,resourceOwnership:y?d:null,devicePolicy:o,surfaceGenerationId:f,volumeGenerationId:p,normalSign:m});return{schema:He,version:0,status:v?`surface-position-rows-resident`:`surface-position-rows-empty`,layoutName:tt,rowLayoutName:tt,rowCount:_,triangleCount:c,byteLength:v?t:0,devicePolicy:o,materialPayload:x,pbrPayload:S,readback:!1,fullReadback:!1,position:{schema:Xe,version:0,descriptorVersion:0,family:`position`,role:`position-rows`,status:b,available:v,produced:v,layoutName:tt,rowLayout:[...lt],rowStrideFloats:4,rowStrideBytes:16,rowCount:_,count:_,buffer:e,bufferOffsetBytes:0,bufferByteLength:v?t:0,byteLength:v?t:0,bufferRetained:v&&!!n,bufferOwnership:v?r:`none`,ownership:{buffer:v?r:`none`,device:o?.ownership||null,ownerDeviceId:i,resourceOwnership:a},ownerDeviceId:i,resourceOwnership:a,devicePolicy:o,positionBufferDescriptor:Ut({status:b,available:v,rowCount:_,buffer:e,bufferOffsetBytes:0,bufferByteLength:v?t:0,bufferRetained:v&&!!n,bufferOwnership:v?r:`none`,ownerDeviceId:i,resourceOwnership:a,devicePolicy:o}),readback:!1},normal:{schema:y?rt:Ze,version:0,descriptorVersion:0,family:`normal`,role:`normal-rows`,status:C.status,available:y,produced:y,reason:y?null:`surface engine did not provide packed normal rows`,layoutName:y?it:nt,rowLayout:y?[...dt]:[...ut],rowStrideFloats:y?0:4,rowStrideBytes:y?Uint32Array.BYTES_PER_ELEMENT:16,rowCount:y?_:0,count:y?_:0,buffer:y?l:null,bufferByteLength:y?u:0,byteLength:y?u:0,bufferRetained:y&&!!n,bufferOwnership:y?r:`none`,ownership:C.ownership,ownerDeviceId:C.ownerDeviceId,resourceOwnership:C.resourceOwnership,devicePolicy:o,encoding:C.encoding,semantic:C.semantic,sourceSemantic:C.sourceSemantic,normalSign:C.normalSign,generation:C.generation,lifetime:C.lifetime,producer:C.producer,normalBufferDescriptor:C,derivation:y?`central-difference scalar gradients interpolated during marching-cubes vertex emission`:`consumer may use a face-normal fallback for legacy engines`,readback:!1},material:{schema:Qe,version:0,descriptorVersion:0,family:`material`,role:`material-rows`,status:`material-rows-not-produced`,available:!1,produced:!1,metadataAvailable:x.available||S.available,reason:`native kernel currently has no material or phase input`,layoutName:ot,rowLayout:[...ft],rowStrideFloats:4,rowStrideBytes:16,rowCount:0,count:0,buffer:null,bufferByteLength:0,byteLength:0,bufferRetained:!1,bufferOwnership:`none`,devicePolicy:o,materialPayload:x,pbrPayload:S,derivation:`supply material metadata in the caller-owned translation stage`,readback:!1}}}function Jt({texture:e=null,scalarBuffer:t=null,sparseVolume:n=null,dims:r,dualGridDims:i=null,device:a=null,diagonalLength:o=null,label:s=`volume`,source:c=null,sourceType:l=null,scalarType:u=`f32`,scalarStrides:d=null,rowStrideFloats:f=null,rowStride:p=null,sliceStrideFloats:m=null,sliceStride:h=null,scalarOffset:g=null,scalarOffsetBytes:_=null,bufferByteLength:v=null,normalSign:y=1,originalVolume:b=null,markTextureOwner:x=!1,markBufferOwner:S=!1,requireTexture:C=!1,requireNativeSource:w=!1}={}){let T=wt(r),E=Ct(y),D=t||null,O=n||{},k=At(l,{texture:e,scalarBuffer:D,directoryBuffer:O.directoryBuffer,activeBrickRowsBuffer:O.activeBrickRowsBuffer,atlasBuffer:O.atlasBuffer,candidateVoxelIdsBuffer:O.candidateVoxelIdsBuffer});if(C&&(k!==`texture-3d`||!X(e)))throw TypeError(`volume requires a GPUTexture-like texture`);if(w&&k==null)throw TypeError(`volume requires a texture_3d, f32 scalar buffer, or sparse brick atlas source`);if(k===`scalar-buffer`&&!X(D))throw TypeError(`buffer volume requires a GPUBuffer-like scalarBuffer`);if(k===`sparse-brick-atlas`){for(let[e,t]of[[`directoryBuffer`,O.directoryBuffer],[`activeBrickRowsBuffer`,O.activeBrickRowsBuffer],[`atlasBuffer`,O.atlasBuffer],[`candidateVoxelIdsBuffer`,O.candidateVoxelIdsBuffer]])if(!X(t))throw TypeError(`sparse brick volume requires a GPUBuffer-like ${e}`)}let A=k===`scalar-buffer`?Ft({scalarBuffer:D,scalarType:u,scalarStrides:d,rowStrideFloats:f,rowStride:p,sliceStrideFloats:m,sliceStride:h,scalarOffset:g,scalarOffsetBytes:_,bufferByteLength:v},T):null;if(A!=null&&A.scalarType!==`f32`)throw TypeError(`buffer volume scalarType must be f32`);if(A!=null&&!A.byteLengthValid)throw RangeError(`buffer volume scalarBuffer is too small for dims, strides, and offset`);let j=k===`sparse-brick-atlas`?It(O,T):null;if(j!=null&&!j.byteLengthValid)throw RangeError(`sparse brick volume contains an undersized GPU buffer`);let M=j==null?[]:[j.directoryBuffer,j.activeBrickRowsBuffer,j.atlasBuffer,j.candidateVoxelIdsBuffer,j.candidateDispatchIndirectBuffer].filter(X),N=k===`scalar-buffer`?D:k===`sparse-brick-atlas`?j.atlasBuffer:e,P=Ne(N);if(X(N)&&X(a)){if(k===`texture-3d`&&x)P=je(N,a);else if(k===`scalar-buffer`&&S)P=Ae(N,a);else if(k===`sparse-brick-atlas`&&S){for(let e of M)Ae(e,a);P=Ne(N)}}let F=i==null?T.map(e=>e-1):wt(i,`dualGridDims`),I=o==null?Math.hypot(T[0],T[1],T[2]):St(o,`diagonalLength`);return Object.freeze({schema:ze,version:0,label:s,source:c||(k===`scalar-buffer`?`external-scalar-buffer`:k===`sparse-brick-atlas`?`external-sparse-brick-atlas`:k===`texture-3d`?`external-texture`:`external-volume`),sourceType:k,device:a,ownerDeviceId:P?.ownerDeviceId||P?.deviceId||null,dims:T,dualGridDims:F,numVoxels:T[0]*T[1]*T[2],dualGridNumVoxels:F[0]*F[1]*F[2],diagonalLength:I,normalSign:E,normalSemantic:`oriented-scalar-gradient`,normalSourceSemantic:`scalar-gradient`,texture:e,scalarBuffer:A?.scalarBuffer||null,storageBuffer:A?.storageBuffer||null,scalarType:A?.scalarType||null,scalarLayoutName:A?.layoutName||null,scalarStrides:A?.scalarStrides||null,rowStrideFloats:A?.rowStrideFloats||null,sliceStrideFloats:A?.sliceStrideFloats||null,scalarOffset:A?.scalarOffset||0,scalarOffsetBytes:A?.scalarOffsetBytes||0,scalarBufferByteLength:A?.bufferByteLength||null,scalarRequiredByteLength:A?.requiredByteLength||null,scalarRequiredCount:A?.requiredScalarCount||null,scalarBufferByteLengthValid:A?.byteLengthValid??null,scalar:A,sparse:j,...j||{},originalVolume:b})}function Yt(e,{device:t=null,markTextureOwner:n=!1,markBufferOwner:r=!1,requireTexture:i=!1,requireNativeSource:a=!1}={}){if(!X(e))throw TypeError(`normalizeMarchingCubesVolumeSource requires a volume object`);let o=X(e.device)?e.device:t,s=kt(e);return Jt({texture:e.texture||null,scalarBuffer:s,sparseVolume:e,dims:e.dims,dualGridDims:e.dualGridDims||null,device:o,diagonalLength:e.diagonalLength??null,label:e.label||`volume`,source:e.source||null,sourceType:e.sourceType||e.volumeSourceType||null,scalarType:jt(e),scalarStrides:e.scalarStrides||e.strides||null,rowStrideFloats:e.rowStrideFloats??null,rowStride:e.rowStride??null,sliceStrideFloats:e.sliceStrideFloats??null,sliceStride:e.sliceStride??null,scalarOffset:e.scalarOffset??e.scalarOffsetFloats??e.bufferOffsetFloats??e.offsetFloats??e.offset??null,scalarOffsetBytes:e.scalarOffsetBytes??e.bufferOffsetBytes??e.byteOffset??null,bufferByteLength:e.bufferByteLength??e.scalarBufferByteLength??e.byteLength??null,normalSign:e.normalSign??1,originalVolume:e.schema===`peercompute.webgpu-marching-cubes.volume-source.v0`?e.originalVolume||null:e,markTextureOwner:n,markBufferOwner:r,requireTexture:i,requireNativeSource:a})}function Xt({scalarBuffer:e=null,storageBuffer:t=null,buffer:n=null,dims:r,scalarStrides:i=null,strides:a=null,rowStrideFloats:o=null,rowStride:s=null,sliceStrideFloats:c=null,sliceStride:l=null,scalarOffset:u=null,scalarOffsetFloats:d=null,bufferOffsetFloats:f=null,scalarOffsetBytes:p=null,bufferOffsetBytes:m=null,byteOffset:h=null,bufferByteLength:g=null,scalarBufferByteLength:_=null,device:v=null,diagonalLength:y=null,label:b=`volume`,source:x=`external-scalar-buffer`,scalarType:S=`f32`,normalSign:C=1}={}){let w=e||t||n;if(!X(w))throw TypeError(`createBufferVolumeDescriptor requires a GPUBuffer-like scalarBuffer`);return Jt({scalarBuffer:w,dims:r,device:v,diagonalLength:y,label:b,source:x,sourceType:gt,normalSign:C,scalarType:S,scalarStrides:i||a||null,rowStrideFloats:o,rowStride:s,sliceStrideFloats:c,sliceStride:l,scalarOffset:u??d??f??null,scalarOffsetBytes:p??m??h??null,bufferByteLength:g??_??null,markBufferOwner:!0,requireNativeSource:!0})}function Zt({backend:e=`webgpu`}={}){return Object.freeze({schema:Ie,version:0,adapterSchema:Fe,backend:e,api:Object.freeze([`getStatus`,`getCapabilities`,`preflight`,`extractSurface`,`setVolume`,`release`]),devicePolicy:Object.freeze({schema:We,version:0,defaultOwnership:`caller-owned`,requestDeviceByDefault:!1,ownedDeviceHelper:`requestWebGpuMarchingCubesDevice`,sameDeviceChecks:!0,validationSchema:Re,validationHelper:`validateSurfaceAdapterDeviceOwnership`,crossDeviceOutputStatus:`same-device-check-failed`}),input:Object.freeze({volumeSchema:ze,nativeSourceTypes:Object.freeze([Y,gt,vt]),acceptedVolumeFields:Object.freeze(`texture.scalarBuffer.storageBuffer.dims.dualGridDims.dualGridNumVoxels.diagonalLength.device.sourceType.scalarType.scalarStrides.rowStrideFloats.sliceStrideFloats.scalarOffset.scalarOffsetBytes.directoryBuffer.activeBrickRowsBuffer.atlasBuffer.candidateVoxelIdsBuffer.brickSize.directoryOffset.activeBrickCount.activeBrickRowStrideU32.activeBrickAtlasCellOffsetLane.atlasCellCount.atlasCellStrideFloats.atlasScalarLane.candidateVoxelCount.candidateVoxelOffset.candidateVoxelOffsetBytes.generationId.backgroundValue`.split(`.`)),scalarBuffer:Object.freeze({sourceType:gt,layoutName:_t,scalarType:`f32`,strideUnits:`f32-elements`,offsetUnits:`f32-elements-or-bytes`,nativeKernelStatus:`supported`,blockedStatus:`buffer-volume-native-engine-blocked`}),sparseBrickAtlas:Object.freeze({sourceType:vt,layoutName:yt,brickSize:8,directorySentinel:bt,candidateSentinel:xt,activeBrickRowStrideU32:16,activeBrickAtlasCellOffsetLane:7,atlasCellStrideFloats:8,atlasScalarLane:0,candidateIdSpace:`logical-dual-grid-voxel-id`,candidateOffsetUnits:`u32-elements-or-bytes`,candidateOffsetAlignment:`device.limits.minStorageBufferOffsetAlignment`,extractionMode:`gpu-conservative-no-readback`,bufferOwnership:`borrowed-caller-owned`,generationRequired:!0,nativeKernelStatus:`supported`}),isovalue:`finite-number`,normalSign:`exactly-minus-one-or-plus-one`,commandEncoding:Object.freeze({option:`commandEncoder`,mode:`external-command-encoder`,extractionMode:`gpu-conservative-no-readback`,internalSubmitCount:0,callerOwnsFinishAndSubmit:!0,retirementHook:`result.retireTemporaryResourcesAfterSubmit`})}),output:Object.freeze({version:0,surfaceSchema:Be,executionSchema:Ve,rowMetadataSchema:He,outputDescriptorSchema:Ue,positionBufferDescriptorSchema:qe,normalBufferDescriptorSchema:Je,vertexFormat:ht,positionRows:Object.freeze({schema:Xe,version:0,layoutName:tt,rowLayout:lt,rowStrideFloats:4,rowStrideBytes:16,bufferDescriptorSchema:qe}),normalRows:Object.freeze({schema:rt,version:0,layoutName:it,rowLayout:dt,rowStrideFloats:0,rowStrideBytes:Uint32Array.BYTES_PER_ELEMENT,encoding:at,sourceSemantic:`scalar-gradient`,orientation:`volume.normalSign`,bufferDescriptorSchema:Je,generationCoupledToPosition:!0,producedByNativeKernel:!0}),materialRows:Object.freeze({schema:Qe,version:0,layoutName:ot,rowLayout:ft,rowStrideFloats:4,rowStrideBytes:16,materialMetadataSchema:Ge,pbrMetadataSchema:Ke,produced:!1}),drawRows:Object.freeze({schema:$e,version:0,layoutName:st,rowLayout:pt,rowStrideBytes:16,placeholderStatus:`draw-rows-not-produced`,produced:!1}),indirectRows:Object.freeze({schema:et,version:0,layoutName:ct,rowLayout:mt,rowStrideBytes:16,placeholderStatus:`indirect-draw-rows-not-produced`,produced:!1}),cpuFallbackSchema:Ye,readback:!1})})}function Qt(e,{requiresTexture:t=!1,requiresNativeSource:n=!1}={}){let r=[],i=null;try{i=wt(e?.dims,`volume.dims`);let t=e?.dualGridDims==null?i.map(e=>e-1):wt(e.dualGridDims,`volume.dualGridDims`),n=Number(e?.dualGridNumVoxels)||t[0]*t[1]*t[2],a=t.every(e=>e>0)&&n>0;r.push({ok:a,kind:`volume`,status:a?`volume-dims-ready`:`volume-dims-too-small`,label:`volume.dims`,dims:i,dualGridDims:t,dualGridNumVoxels:n})}catch(e){r.push({ok:!1,kind:`volume`,status:`volume-dims-invalid`,label:`volume.dims`,error:Lt(e)})}if(t){let t=e?.texture||null,n=X(t)&&typeof t.createView==`function`;r.push({ok:n,kind:`volume`,status:n?`volume-texture-ready`:`volume-texture-missing`,label:`volume.texture`,requiresCreateView:!0})}let a=kt(e),o=e?.sourceType||e?.volumeSourceType||null,s=o===`scalar-buffer`||X(a);if(n||s||o!=null&&o!==`texture-3d`)try{let t=At(o,{texture:e?.texture||null,scalarBuffer:a,directoryBuffer:e?.directoryBuffer||null,activeBrickRowsBuffer:e?.activeBrickRowsBuffer||null,atlasBuffer:e?.atlasBuffer||null,candidateVoxelIdsBuffer:e?.candidateVoxelIdsBuffer||null});if(t===`texture-3d`){let n=e?.texture||null,i=X(n)&&typeof n.createView==`function`;r.push({ok:i,kind:`volume`,status:i?`volume-texture-ready`:`volume-texture-missing`,label:`volume.texture`,sourceType:t,requiresCreateView:!0})}else if(t===`scalar-buffer`){if(!X(a))r.push({ok:!1,kind:`volume`,status:`volume-scalar-buffer-missing`,label:`volume.scalarBuffer`,sourceType:t});else if(i!=null){let n=Ft({scalarBuffer:a,scalarType:jt(e),scalarStrides:e?.scalarStrides||e?.strides||null,rowStrideFloats:e?.rowStrideFloats??null,rowStride:e?.rowStride??null,sliceStrideFloats:e?.sliceStrideFloats??null,sliceStride:e?.sliceStride??null,scalarOffset:e?.scalarOffset??e?.scalarOffsetFloats??e?.bufferOffsetFloats??e?.offsetFloats??e?.offset??null,scalarOffsetBytes:e?.scalarOffsetBytes??e?.bufferOffsetBytes??e?.byteOffset??null,bufferByteLength:e?.bufferByteLength??e?.scalarBufferByteLength??e?.byteLength??null},i),o=n.scalarType===`f32`;r.push({ok:o&&n.byteLengthValid,kind:`volume`,status:o?n.byteLengthValid?`volume-scalar-buffer-ready`:`volume-scalar-buffer-out-of-range`:`volume-scalar-buffer-type-unsupported`,label:`volume.scalarBuffer`,sourceType:t,scalarType:n.scalarType,scalarStrides:n.scalarStrides,scalarOffset:n.scalarOffset,scalarOffsetBytes:n.scalarOffsetBytes,bufferByteLength:n.bufferByteLength,requiredByteLength:n.requiredByteLength,requiredScalarCount:n.requiredScalarCount,layoutName:n.layoutName})}}else if(t===`sparse-brick-atlas`&&i!=null){let n=It(e,i),a=[{key:`directory`,label:`volume.directoryBuffer`,resource:n.directoryBuffer,byteLength:n.directoryBufferByteLength,requiredByteLength:n.directoryRequiredByteLength},{key:`activeBrickRows`,label:`volume.activeBrickRowsBuffer`,resource:n.activeBrickRowsBuffer,byteLength:n.activeBrickRowsBufferByteLength,requiredByteLength:n.activeBrickRowsRequiredByteLength},{key:`atlas`,label:`volume.atlasBuffer`,resource:n.atlasBuffer,byteLength:n.atlasBufferByteLength,requiredByteLength:n.atlasRequiredByteLength},{key:`candidateVoxelIds`,label:`volume.candidateVoxelIdsBuffer`,resource:n.candidateVoxelIdsBuffer,byteLength:n.candidateVoxelIdsBufferByteLength,requiredByteLength:n.candidateVoxelIdsRequiredByteLength}];X(n.candidateDispatchIndirectBuffer)&&a.push({key:`candidateDispatchIndirect`,label:`volume.candidateDispatchIndirectBuffer`,resource:n.candidateDispatchIndirectBuffer,byteLength:n.candidateDispatchIndirectBufferByteLength,requiredByteLength:n.candidateDispatchIndirectRequiredByteLength});for(let e of a){let i=X(e.resource),a=n.byteLengthChecks[e.key];r.push({ok:i&&a,kind:`volume`,status:i?a?`volume-sparse-buffer-ready`:`volume-sparse-buffer-out-of-range`:`volume-sparse-buffer-missing`,label:e.label,sourceType:t,bufferByteLength:e.byteLength,requiredByteLength:e.requiredByteLength,layoutName:n.layoutName,generationId:n.generationId,candidateVoxelOffset:n.candidateVoxelOffset,candidateVoxelOffsetBytes:n.candidateVoxelOffsetBytes})}}else n&&r.push({ok:!1,kind:`volume`,status:`volume-source-missing`,label:`volume.source`,acceptedSourceTypes:[Y,gt,vt]})}catch(e){r.push({ok:!1,kind:`volume`,status:`volume-source-invalid`,label:`volume.source`,error:Lt(e)})}return r}function $t(e,t,{requiresTexture:n=!1,requiresNativeSource:r=!1}={}){let i=Qt(t,{requiresTexture:n,requiresNativeSource:r});if((t?.sourceType===`sparse-brick-atlas`||X(t?.candidateVoxelIdsBuffer))&&t?.dims!=null)try{let n=It(t,wt(t.dims,`volume.dims`)),r=Tt(e?.limits?.minStorageBufferOffsetAlignment??256,`device.limits.minStorageBufferOffsetAlignment`),a=n.candidateVoxelOffsetBytes%r===0;i.push({ok:a,kind:`volume`,status:a?`volume-candidate-offset-ready`:`volume-candidate-offset-unaligned`,label:`volume.candidateVoxelOffsetBytes`,candidateVoxelOffset:n.candidateVoxelOffset,candidateVoxelOffsetBytes:n.candidateVoxelOffsetBytes,minStorageBufferOffsetAlignment:r})}catch{}if(X(t?.device)){let n=Oe(e),r=Oe(t.device);i.push({ok:t.device===e,kind:`device`,status:t.device===e?`same-device`:`cross-device-volume`,label:`volume.device`,expectedDeviceId:n,ownerKnown:!0,ownerDeviceId:r,resourceKind:`gpu-device`})}X(t?.texture)&&i.push({kind:`device`,...Pe({device:e,resource:t.texture,label:`volume.texture`,allowUnknown:!0})});let a=kt(t);X(a)&&i.push({kind:`device`,...Pe({device:e,resource:a,label:`volume.scalarBuffer`,allowUnknown:!0})});for(let[n,r]of[[`volume.directoryBuffer`,t?.directoryBuffer],[`volume.activeBrickRowsBuffer`,t?.activeBrickRowsBuffer],[`volume.atlasBuffer`,t?.atlasBuffer],[`volume.candidateVoxelIdsBuffer`,t?.candidateVoxelIdsBuffer],[`volume.candidateDispatchIndirectBuffer`,t?.candidateDispatchIndirectBuffer]])X(r)&&i.push({kind:`device`,...Pe({device:e,resource:r,label:n,allowUnknown:!0})});return i}function en(e){return e.find(e=>!e.ok)||null}function tn({device:e,volume:t=null,surface:n=null,requiresTexture:r=!1,allowUnknownSurfaceBuffer:i=!0}={}){let a=[];X(e)||a.push({ok:!1,kind:`device`,status:`expected-device-missing`,label:`device`,expectedDeviceId:null,ownerKnown:!1,ownerDeviceId:null}),t!=null&&a.push(...$t(e,t,{requiresTexture:r})),n?.buffer!=null&&a.push({kind:`device`,...Pe({device:e,resource:n.buffer,label:`surface.buffer`,allowUnknown:i})}),n?.normalBuffer!=null&&a.push({kind:`device`,...Pe({device:e,resource:n.normalBuffer,label:`surface.normalBuffer`,allowUnknown:i})});let o=en(a);return{schema:Re,version:0,ok:o==null,status:o==null?`same-device-validated`:`same-device-check-failed`,expectedDeviceId:Oe(e),ownerDeviceId:Oe(e),requiresTexture:r,allowUnknownSurfaceBuffer:i,checks:a,failedCheck:o}}function nn({backend:e,device:t,status:n=`surface-empty`,reason:r=null,isovalue:i=null,volume:a=null,ownsDevice:o=!1,materialPayload:s=null,pbrPayload:c=null}={}){let l=Oe(t),u=Bt({ownsDevice:o,ownerDeviceId:l,device:t}),d=Kt({ownerDeviceId:l,devicePolicy:u,normalSign:a?.normalSign??1,materialPayload:s,pbrPayload:c});return{schema:Be,version:0,backend:e,status:n,reason:r,isovalue:i,volumeDims:a?.dims?Array.from(a.dims):null,layoutName:tt,rowLayoutName:tt,vertexCount:0,triangleCount:0,rowSchema:Xe,rowLayout:[...lt],rowStrideFloats:4,rowStrideBytes:16,rowCount:0,vertexStrideFloats:4,vertexStrideBytes:16,vertexFormat:ht,buffer:null,bufferByteLength:0,byteLength:0,bufferRetained:!1,bufferOwnership:`none`,ownerDeviceId:l,resourceOwnership:null,devicePolicy:u,materialPayload:d.materialPayload,pbrPayload:d.pbrPayload,rowMetadata:qt({ownerDeviceId:l,devicePolicy:u,materialPayload:s,pbrPayload:c}),outputDescriptors:d,release(){return zt(`surface-buffer-empty`)}}}function rn({device:e,buffer:t,normalBuffer:n=null,normalBufferByteLength:r=0,vertexCount:i,vertexCountMode:a=null,maxVertexCount:o=null,actualVertexCounterBuffer:s=null,actualVertexCounterBufferByteLength:c=0,drawIndirectBuffer:l=null,drawIndirectBufferByteLength:u=0,readbackMode:d=null,surfaceGenerationId:f=null,volumeGenerationId:p=null,normalSign:m=1,backend:h=`external`,isovalue:g=null,volume:_=null,status:v=null,ownsBuffer:y=!0,markOwner:b=!0,ownsDevice:x=!1,materialPayload:S=null,pbrPayload:C=null}={}){let w=Math.max(0,Math.round(St(i,`vertexCount`)));if(w===0||t==null)return nn({backend:h,device:e,status:v||`surface-empty`,isovalue:g,volume:_,ownsDevice:x,materialPayload:S,pbrPayload:C});if(!X(t))throw TypeError(`createSurfaceResultFromBuffer requires a GPUBuffer-like buffer`);let T=Me(t);b&&T==null&&X(e)&&Ae(t,e);let E=Me(n);b&&X(n)&&E==null&&X(e)&&Ae(n,e);let D=Pe({device:e,resource:t,label:`surface.buffer`,allowUnknown:!0}),O=X(n)?Pe({device:e,resource:n,label:`surface.normalBuffer`,allowUnknown:!0}):null,k=Math.max(Number(t.size)||0,w*4*Float32Array.BYTES_PER_ELEMENT),A=y?`adapter-owned`:`borrowed`,j=Ne(t).ownerDeviceId,M=Number(n?.size),N=X(n)?Number.isFinite(M)?Math.max(0,M):Math.max(0,Number(r)||0):0,P=Bt({ownsDevice:x,ownerDeviceId:Oe(e),device:e}),F=Kt({buffer:t,bufferByteLength:k,bufferRetained:!0,bufferOwnership:A,ownerDeviceId:j,resourceOwnership:D,devicePolicy:P,vertexCount:w,vertexCountMode:a,maxVertexCount:o??w,actualVertexCounterBuffer:s,actualVertexCounterBufferByteLength:c,drawIndirectBuffer:l,drawIndirectBufferByteLength:u,readbackMode:d,triangleCount:w/3,normalBuffer:n,normalBufferByteLength:N,normalResourceOwnership:O,surfaceGenerationId:f,volumeGenerationId:p,normalSign:m,materialPayload:S,pbrPayload:C}),I=!1,L={schema:Be,version:0,backend:h,status:v||(D.ok?`surface-ready`:`surface-device-check-warning`),isovalue:g,volumeDims:_?.dims?Array.from(_.dims):null,layoutName:tt,rowLayoutName:tt,vertexCount:w,vertexCountMode:a,maxVertexCount:o??w,actualVertexCounterBuffer:s,actualVertexCounterBufferByteLength:c,drawIndirectBuffer:l,drawIndirectBufferByteLength:u,readbackMode:d,surfaceGenerationId:f,volumeGenerationId:p,normalBuffer:n,normalBufferByteLength:N,normalEncoding:X(n)?at:null,normalSemantic:X(n)?`oriented-scalar-gradient`:null,normalSourceSemantic:X(n)?`scalar-gradient`:null,normalSign:Ct(m),normalPositionGenerationCoupled:X(n),normalAdditionalSubmitCount:X(n)?0:null,triangleCount:w/3,rowSchema:Xe,rowLayout:[...lt],rowStrideFloats:4,rowStrideBytes:16,rowCount:w,vertexStrideFloats:4,vertexStrideBytes:16,vertexFormat:ht,buffer:t,bufferByteLength:k,byteLength:k,bufferRetained:!0,bufferOwnership:A,ownerDeviceId:j,resourceOwnership:D,devicePolicy:P,materialPayload:F.materialPayload,pbrPayload:F.pbrPayload,rowMetadata:qt({buffer:t,bufferByteLength:k,bufferRetained:!0,bufferOwnership:A,ownerDeviceId:j,resourceOwnership:D,devicePolicy:P,vertexCount:w,triangleCount:w/3,normalBuffer:n,normalBufferByteLength:N,normalResourceOwnership:O,surfaceGenerationId:f,volumeGenerationId:p,normalSign:m,materialPayload:S,pbrPayload:C}),outputDescriptors:F,release({force:e=!1}={}){return I?zt(`surface-buffer-already-released`,{released:!0}):!y&&!e?zt(`surface-buffer-borrowed-retained`,{released:!1}):(t.destroy?.(),n&&n!==t&&n.destroy?.(),I=!0,L.status=`surface-buffer-released`,L.bufferRetained=!1,L.rowMetadata.status=`surface-position-rows-released`,L.rowMetadata.position.status=`position-rows-released`,L.rowMetadata.position.bufferRetained=!1,L.rowMetadata.position.positionBufferDescriptor.status=`position-rows-released`,L.rowMetadata.position.positionBufferDescriptor.bufferRetained=!1,L.outputDescriptors.status=`surface-outputs-released`,L.outputDescriptors.retainedBuffers.position=null,L.outputDescriptors.retainedBuffers.normal=null,L.outputDescriptors.rows.position.status=`position-rows-released`,L.outputDescriptors.rows.position.bufferRetained=!1,L.outputDescriptors.rows.position.positionBufferDescriptor.status=`position-rows-released`,L.outputDescriptors.rows.position.positionBufferDescriptor.bufferRetained=!1,L.outputDescriptors.positionBufferDescriptor.status=`position-rows-released`,L.outputDescriptors.positionBufferDescriptor.bufferRetained=!1,L.rowMetadata.normal.status=`normal-rows-released`,L.rowMetadata.normal.bufferRetained=!1,L.rowMetadata.normal.normalBufferDescriptor.status=`normal-rows-released`,L.rowMetadata.normal.normalBufferDescriptor.bufferRetained=!1,L.outputDescriptors.rows.normal.status=`normal-rows-released`,L.outputDescriptors.rows.normal.bufferRetained=!1,L.outputDescriptors.rows.normal.normalBufferDescriptor.status=`normal-rows-released`,L.outputDescriptors.rows.normal.normalBufferDescriptor.bufferRetained=!1,L.outputDescriptors.normalBufferDescriptor.status=`normal-rows-released`,L.outputDescriptors.normalBufferDescriptor.bufferRetained=!1,y&&(s?.destroy?.(),l?.destroy?.()),zt(`surface-buffer-released`,{released:!0}))}};return L}function an(e,{device:t,ownsDevice:n=!1,ownsBuffer:r=!0,materialPayload:i=null,pbrPayload:a=null}={}){if(!X(e)||e.schema!==`peercompute.webgpu-marching-cubes.surface.v0`)return e;let o=Math.max(0,Math.round(Number(e.vertexCount??e.rowCount)||0)),s=Math.max(0,Number(e.triangleCount)||o/3),c=e.buffer||null,l=e.normalBuffer||e.outputDescriptors?.rows?.normal?.buffer||e.rowMetadata?.normal?.buffer||null,u=o>0&&X(c),d=Math.max(Number(e.bufferByteLength)||0,u?o*4*Float32Array.BYTES_PER_ELEMENT:0),f=e.resourceOwnership||(u?Pe({device:t,resource:c,label:`surface.buffer`,allowUnknown:!0}):null),p=e.normalResourceOwnership||(X(l)?Pe({device:t,resource:l,label:`surface.normalBuffer`,allowUnknown:!0}):null),m=Number(l?.size),h=X(l)?Number.isFinite(m)?Math.max(0,m):Math.max(0,Number(e.normalBufferByteLength)||0):0,g=e.ownerDeviceId||(u?Ne(c).ownerDeviceId:null)||Oe(t),_=e.bufferOwnership||(u?r?`adapter-owned`:`borrowed`:`none`),v=e.devicePolicy||Bt({ownsDevice:n,ownerDeviceId:Oe(t),device:t}),y=i??e.materialPayload??e.material??null,b=a??e.pbrPayload??e.pbr??null;e.version=e.version??0,e.layoutName=e.layoutName||`peercompute.webgpu-marching-cubes.layout.compact-position-f32x4.v0`,e.rowLayoutName=e.rowLayoutName||`peercompute.webgpu-marching-cubes.layout.compact-position-f32x4.v0`,e.vertexCount=o,e.vertexCountMode=e.vertexCountMode||null,e.maxVertexCount=Math.max(o,Math.round(Number(e.maxVertexCount)||0)),e.actualVertexCounterBuffer=e.actualVertexCounterBuffer||null,e.actualVertexCounterBufferByteLength=Math.max(0,Number(e.actualVertexCounterBufferByteLength)||0),e.drawIndirectBuffer=e.drawIndirectBuffer||null,e.drawIndirectBufferByteLength=Math.max(0,Number(e.drawIndirectBufferByteLength)||0),e.readbackMode=e.readbackMode||null,e.surfaceGenerationId=e.surfaceGenerationId??null,e.volumeGenerationId=e.volumeGenerationId??null,e.normalBuffer=l,e.normalBufferByteLength=h,e.normalSign=Ct(e.normalSign??1),e.triangleCount=s,e.bufferByteLength=d,e.byteLength=e.byteLength??d,e.bufferOwnership=_,e.ownerDeviceId=g,e.resourceOwnership=f,e.devicePolicy=v,e.materialPayload=Vt(y),e.pbrPayload=Ht(b);let x=qt({buffer:c,bufferByteLength:d,bufferRetained:u&&!!e.bufferRetained,bufferOwnership:_,ownerDeviceId:g,resourceOwnership:f,devicePolicy:v,vertexCount:o,triangleCount:s,normalBuffer:l,normalBufferByteLength:h,normalResourceOwnership:p,surfaceGenerationId:e.surfaceGenerationId,volumeGenerationId:e.volumeGenerationId,normalSign:e.normalSign,materialPayload:y,pbrPayload:b}),S=Kt({buffer:c,bufferByteLength:d,bufferRetained:u&&!!e.bufferRetained,bufferOwnership:_,ownerDeviceId:g,resourceOwnership:f,devicePolicy:v,vertexCount:o,triangleCount:s,normalBuffer:l,normalBufferByteLength:h,normalResourceOwnership:p,surfaceGenerationId:e.surfaceGenerationId,volumeGenerationId:e.volumeGenerationId,normalSign:e.normalSign,materialPayload:y,pbrPayload:b});return e.rowMetadata=e.rowMetadata?.schema===`peercompute.webgpu-marching-cubes.surface-row-metadata.v0`?e.rowMetadata:x,e.outputDescriptors=e.outputDescriptors?.schema===`peercompute.webgpu-marching-cubes.surface-output-descriptor.v0`?e.outputDescriptors:S,e.rowMetadata.version=e.rowMetadata.version??0,e.outputDescriptors.version=e.outputDescriptors.version??0,e.outputDescriptors.descriptorVersion=e.outputDescriptors.descriptorVersion??0,e.rowMetadata.position==null?e.rowMetadata.position=x.position:e.rowMetadata.position.positionBufferDescriptor??(e.rowMetadata.position.positionBufferDescriptor=x.position.positionBufferDescriptor),e.outputDescriptors.rows==null?e.outputDescriptors.rows=S.rows:e.outputDescriptors.rows.position==null?e.outputDescriptors.rows.position=S.rows.position:e.outputDescriptors.rows.position.positionBufferDescriptor??(e.outputDescriptors.rows.position.positionBufferDescriptor=S.rows.position.positionBufferDescriptor),e.rowMetadata.normal??(e.rowMetadata.normal=x.normal),e.outputDescriptors.rows.normal??(e.outputDescriptors.rows.normal=S.rows.normal),e.outputDescriptors.positionBufferDescriptor=e.outputDescriptors.positionBufferDescriptor||e.outputDescriptors.rows?.position?.positionBufferDescriptor||S.positionBufferDescriptor,e.outputDescriptors.normalBufferDescriptor=e.outputDescriptors.normalBufferDescriptor||e.outputDescriptors.rows?.normal?.normalBufferDescriptor||S.normalBufferDescriptor,e}var on=Object.freeze(`sourceType.noReadback.vertexRowsBudget.vertexRowsBudgetClamped.conservativeWorstCaseVertexCount.candidateVoxelCount.candidateVoxelOffset.candidateVoxelOffsetBytes.candidateVoxelCountMode.volumeGenerationId.surfaceGenerationId.normalBuffer.normalBufferByteLength.normalEncoding.normalSemantic.normalSourceSemantic.normalSign.normalDegenerateEncoding.normalProducerStage.normalTimestampSpanLabel.normalAdditionalSubmitCount.normalPositionGenerationCoupled.commandEncodingMode.internalSubmitCount.requiresExternalSubmit.encodingRetirement.temporaryResourceCount.retireTemporaryResourcesAfterSubmit`.split(`.`));function sn(e,t){if(!X(e)||!X(t))return e;for(let n of on)t[n]!==void 0&&(e[n]=t[n]);return e}async function cn({device:e,volume:t}){let{MarchingCubes:n}=await a(async()=>{let{MarchingCubes:e}=await import(`./marching_cubes-DBTWK5ez.js`);return{MarchingCubes:e}},[],import.meta.url),r=Yt(t,{device:e,requireNativeSource:!0});return n.create(r,e)}function ln({adapter:e,backend:t,device:n,currentVolume:r,input:i={},requiresTexture:a=!1,requiresNativeSource:o=!1}={}){let s=typeof i==`number`?{isovalue:i}:i||{},c=null,l=[];try{c=St(s?.isovalue,`isovalue`)}catch(e){l.push(Lt(e))}let u=s.volume||r,d=u!=null,f=d?$t(n,u,{requiresTexture:a,requiresNativeSource:o}):[],p=en(f),m=`ready`;return l.length>0?m=`invalid-input`:d?p!=null&&(m=p.kind===`device`?`same-device-check-failed`:p.status===`buffer-volume-native-engine-blocked`?`buffer-volume-native-engine-blocked`:`preflight-check-failed`):(m=`volume-missing`,l.push({status:m,message:`extractSurface requires a volume`})),{schema:Le,version:0,adapterSchema:Fe,adapterId:e.adapterId,backend:t,ok:m===`ready`,status:m,isovalue:c,hasVolume:d,volumeDims:u?.dims?Array.from(u.dims):null,requiresTexture:a,requiresNativeSource:o,sourceType:u?.sourceType||At(null,{texture:u?.texture||null,scalarBuffer:kt(u),directoryBuffer:u?.directoryBuffer||null,activeBrickRowsBuffer:u?.activeBrickRowsBuffer||null,atlasBuffer:u?.atlasBuffer||null,candidateVoxelIdsBuffer:u?.candidateVoxelIdsBuffer||null}),deviceChecks:f,errors:l,ownerDeviceId:e.ownerDeviceId,devicePolicy:e.devicePolicy}}function un({adapter:e,backend:t,status:n,ok:r,result:i=null,webgpuStatus:a=null,deviceChecks:o=[],preflight:s=null,errors:c=[]}={}){return{schema:Ve,version:0,adapterSchema:Fe,adapterId:e.adapterId,backend:t,status:n,ok:r,result:i,preflight:s,webgpuStatus:a||{status:n},deviceChecks:o,errors:c,ownsDevice:e.ownsDevice,deviceOwned:!!e.ownsDevice,devicePolicy:e.devicePolicy,ownerDeviceId:e.ownerDeviceId,readback:!1,surfaceVertexReadback:!1}}function dn({device:e,volume:t=null,engine:n=null,engineFactory:r=cn,backend:i=`webgpu`,ownsDevice:a=!1,adapterId:o=`webgpu-marching-cubes`,onStatus:s=null}={}){if(!X(e))throw TypeError(`createMarchingCubesSurfaceAdapter requires an existing GPUDevice`);if(typeof r!=`function`&&n==null)throw TypeError(`createMarchingCubesSurfaceAdapter requires an engineFactory or engine`);let c=n,l=t,u=!1,d=Oe(e),f=Bt({ownsDevice:a,ownerDeviceId:d,device:e}),p=n==null&&r===cn,m={schema:Fe,adapterId:o,backend:i,device:e,ownerDeviceId:d,devicePolicy:f,ownsDevice:!!a,contract:Zt({backend:i}),get volume(){return l},async setVolume(e){return l=e,c!=null&&c!==n&&await c.dispose?.(),c=n,this.getStatus(`volume-set`)},getStatus(e=u?`adapter-released`:`adapter-ready`){return{schema:Fe,version:0,adapterId:o,backend:i,status:e,ownsDevice:!!a,ownerDeviceId:d,devicePolicy:f,hasVolume:l!=null,hasEngine:c!=null,requiresTexture:!1,requiresNativeSource:p,contractSchema:Ie,preflightSchema:Le}},getCapabilities(){return Zt({backend:i})},preflight(t={}){return ln({adapter:m,backend:i,device:e,currentVolume:l,input:t,requiresTexture:!1,requiresNativeSource:p})},async extractSurface(t={}){let n=typeof t==`number`?{isovalue:t}:t||{},a=m.preflight(n),o=a.isovalue,s=n.volume||l,u=n.materialPayload??n.material??null,d=n.pbrPayload??n.pbr??null,f={isovalue:o,volume:s,device:e,materialPayload:u,pbrPayload:d,readbackMode:n.readbackMode,noReadback:n.noReadback,vertexRowsBudget:n.vertexRowsBudget,timestampProfiler:n.timestampProfiler,timestampMetadata:n.timestampMetadata,commandEncoder:n.commandEncoder};if(!a.ok){let t=en(a.deviceChecks),n=a.errors[0]||t||{status:a.status,message:a.status},r=a.status===`same-device-check-failed`,c=a.status===`invalid-input`||a.status===`volume-missing`,l=a.status===`buffer-volume-native-engine-blocked`,f=nn({backend:i,device:e,status:r?`surface-device-check-failed`:l?`buffer-volume-native-engine-blocked`:`surface-error`,reason:n.message||n.status,isovalue:o,volume:s,ownsDevice:m.ownsDevice,materialPayload:u,pbrPayload:d});return un({adapter:m,backend:i,status:c?`invalid-input`:a.status,ok:!1,result:f,preflight:a,webgpuStatus:{status:c?`invalid-input`:l?`buffer-volume-native-engine-blocked`:`blocked`,reason:n.message||n.status},deviceChecks:a.deviceChecks,errors:a.errors.length>0?a.errors:[n]})}try{if(c==null||s!==l){l=s;try{c=await r({device:e,volume:s,adapter:m,capabilities:m.getCapabilities()})}catch(e){throw Rt(e,`native-engine-create`)}}let t;try{t=typeof c.extractSurface==`function`?await c.extractSurface(f):await c.computeSurface(o,f)}catch(e){throw Rt(e,`native-engine-extract-surface`)}let p=u??t?.materialPayload??t?.material??null,h=d??t?.pbrPayload??t?.pbr??null,g=t?.schema===`peercompute.webgpu-marching-cubes.surface.v0`?t:rn({device:e,buffer:t?.buffer||null,normalBuffer:t?.normalBuffer||null,normalBufferByteLength:t?.normalBufferByteLength||0,vertexCount:t?.count||t?.vertexCount||0,vertexCountMode:t?.vertexCountMode||null,maxVertexCount:t?.maxVertexCount??null,actualVertexCounterBuffer:t?.actualVertexCounterBuffer||null,actualVertexCounterBufferByteLength:t?.actualVertexCounterBufferByteLength||0,drawIndirectBuffer:t?.drawIndirectBuffer||null,drawIndirectBufferByteLength:t?.drawIndirectBufferByteLength||0,readbackMode:t?.readbackMode||n.readbackMode||null,surfaceGenerationId:t?.surfaceGenerationId??null,volumeGenerationId:t?.volumeGenerationId??s?.generationId??null,normalSign:t?.normalSign??s?.normalSign??1,backend:i,isovalue:o,volume:s,ownsBuffer:n.ownsBuffer??!0,ownsDevice:m.ownsDevice,materialPayload:p,pbrPayload:h});sn(g,t),an(g,{device:e,ownsDevice:m.ownsDevice,ownsBuffer:n.ownsBuffer??!0,materialPayload:p,pbrPayload:h});let _=tn({device:e,volume:s,surface:g,requiresTexture:!1,allowUnknownSurfaceBuffer:!0}),v=_.checks.find(e=>(e.label===`surface.buffer`||e.label===`surface.normalBuffer`)&&!e.ok);return v==null?un({adapter:m,backend:i,status:g.vertexCount>0?`surface-ready`:`surface-empty`,ok:!0,result:g,webgpuStatus:{status:`executed`,vertexCount:g.vertexCount,triangleCount:g.triangleCount,validation:_},deviceChecks:_.checks,preflight:a}):(g.status=`surface-device-check-failed`,un({adapter:m,backend:i,status:`same-device-check-failed`,ok:!1,result:g,webgpuStatus:{status:`blocked`,reason:v.status,validation:_},deviceChecks:_.checks,preflight:a,errors:[v]}))}catch(t){let n=Lt(t),r=n.status===`buffer-volume-native-engine-blocked`;return un({adapter:m,backend:i,status:r?`buffer-volume-native-engine-blocked`:`surface-error`,ok:!1,result:nn({backend:i,device:e,status:r?`buffer-volume-native-engine-blocked`:`surface-error`,reason:n.message,isovalue:o,volume:s,ownsDevice:m.ownsDevice,materialPayload:u,pbrPayload:d}),webgpuStatus:{status:r?`buffer-volume-native-engine-blocked`:`error`,reason:n.message,error:n},deviceChecks:a.deviceChecks,preflight:a,errors:[n]})}},async release({destroyDevice:t=!1}={}){return u=!0,await c?.dispose?.(),c=null,(t||a)&&typeof e.destroy==`function`&&e.destroy(),this.getStatus(`adapter-released`)}};return s?.(m.getStatus()),m}var fn=20*Uint32Array.BYTES_PER_ELEMENT+256*Uint32Array.BYTES_PER_ELEMENT,pn={COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},mn=`
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
`,hn=`
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
`,gn=`
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
`,_n=`
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
`,vn=`
${o}
${mn}

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> dispersed_medium_optics_rows: array<SphDispersedMediumOptics>;
@group(0) @binding(3) var<storage, read> product_history_control: array<u32>;
@group(0) @binding(4) var<storage, read_write> spatial_grid_u32: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params: RenderFieldParams;
@group(0) @binding(6) var<uniform> product_history_gate: RenderProductHistoryGateParams;
@group(0) @binding(7) var<uniform> grid: SpatialGridParams;

${hn}
${gn}

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
`,yn=`
${mn}

@group(0) @binding(0) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> product_history_control: array<u32>;
@group(0) @binding(3) var<storage, read_write> spatial_grid_u32: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: RenderFieldParams;
@group(0) @binding(5) var<uniform> product_history_gate: RenderProductHistoryGateParams;
@group(0) @binding(6) var<uniform> grid: SpatialGridParams;

${hn}

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
`,bn=`
${mn}

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
`;function xn({motionField:e=!1}={}){return`
${o}
${mn}

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

${hn}
${gn}
${_n}

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
`}var Sn=xn(),Cn=xn({motionField:!0}),wn=new WeakMap;function Tn({device:e,surfaceRecords:t,surfaceCount:n,particleCount:r,productEventCount:i=0}={}){if(!Number.isInteger(n)||n<1||n>64||!(t instanceof Float32Array)||t.length<n*16)return null;let a=Number(e?.limits?.maxComputeWorkgroupsPerDimension??65535),o=Number(e?.limits?.maxBufferSize??256*1024*1024),s=Number(e?.limits?.maxStorageBufferBindingSize??128*1024*1024),c=Math.min(o,s);if(Number(e?.limits?.maxStorageBuffersPerShaderStage??8)<8)return null;let l=new Uint32Array(256),u=0,d=0;for(let e=0;e<n;e+=1){let n=Math.max(1,Math.trunc(Number(t[e*16+4])||1)),r=Math.ceil(n/4),i=r*r*r;if(i>a)return null;l[e*4]=r,l[e*4+1]=i,l[e*4+2]=u,l[e*4+3]=0,u+=i,i>d&&(d=i)}if(u<1||u>262144)return null;let f=r>0?Math.ceil(r/64):0,p=i>0,m=p?Math.ceil(i/64):0;if(f>a||m>a||n>a)return null;let h=Math.ceil(u/512),g=e=>Math.ceil(e/4)*4,_=8+g(n),v=_+g(n),y=v+g(u),b=p?y+g(u):y,x=b,S=x+g(u),C=S+g(u),w=C+g(h),T=Math.max(262144,Math.min(4194304,Math.max(u*8,r*16))),E=w+T,D=p?Math.max(131072,Math.min(2097152,Math.max(u*4,i*8))):0,O=E,k=p?O+g(u):E,A=p?k+g(u):E,j=p?A+g(h):E,M=(p?j+D:E)*Uint32Array.BYTES_PER_ELEMENT;return M>c?null:{surfaceCount:n,totalBricks:u,maxBricksPerSurface:d,scanBlockCount:h,particleWorkgroups:f,eventWorkgroups:m,hasProductEvents:p,surfaceFallbackOffset:8,surfaceEventFallbackOffset:_,pCountsOffset:v,eCountsOffset:y,clearBytes:b*Uint32Array.BYTES_PER_ELEMENT,pOffsetsOffset:x,pCursorsOffset:S,pBlockTotalsOffset:C,pEntriesOffset:w,particleEntryCapacity:T,eOffsetsOffset:O,eCursorsOffset:k,eBlockTotalsOffset:A,eEntriesOffset:j,eventEntryCapacity:D,totalBytes:M,surfaceBrickInfo:l}}function En(e){let t=new Uint32Array(fn/4);return t[0]=e.totalBricks,t[1]=e.scanBlockCount,t[2]=e.particleEntryCapacity,t[3]=e.eventEntryCapacity,t[4]=512,t[5]=+!!e.hasProductEvents,t[6]=e.surfaceFallbackOffset,t[7]=e.surfaceEventFallbackOffset,t[8]=e.pCountsOffset,t[9]=e.pOffsetsOffset,t[10]=e.pCursorsOffset,t[11]=e.pBlockTotalsOffset,t[12]=e.pEntriesOffset,t[13]=e.eCountsOffset,t[14]=e.eOffsetsOffset,t[15]=e.eCursorsOffset,t[16]=e.eBlockTotalsOffset,t[17]=e.eEntriesOffset,t[18]=0,t[19]=0,t.set(e.surfaceBrickInfo,20),t}function Dn(e,t){let n=wn.get(e);if(n||(n={gridBuffer:null,gridCapacityBytes:0,paramsBuffer:null},wn.set(e,n)),n.paramsBuffer||=e.createBuffer({label:`ulg-sph-render-field-spatial-grid-params`,size:fn,usage:pn.UNIFORM|pn.COPY_DST}),!n.gridBuffer||n.gridCapacityBytes<t){let r=n.gridBuffer,i=Math.max(t,Math.min(t*2,32*1024*1024));n.gridBuffer=e.createBuffer({label:`ulg-sph-render-field-spatial-grid-u32`,size:i,usage:pn.STORAGE|pn.COPY_DST}),n.gridCapacityBytes=i,r&&me(e,()=>r.destroy?.())}return n}function On({device:e,encoder:t,plan:n,sourceRowsResource:r,surfaceResource:i,fieldRowsResource:a,paramsBuffer:o,productEventsResource:s,productHistoryControlResource:c,productHistoryGateParamsBuffer:l,dispersedOpticsResource:u,motionFieldResource:d=null}){let f=Dn(e,n.totalBytes),p=En(n);e.queue.writeBuffer(f.paramsBuffer,0,p);let m={buffer:f.gridBuffer,offset:0,size:n.totalBytes};t.clearBuffer(f.gridBuffer,0,n.clearBytes);let h=[q(0,`read-only-storage`),q(1,`read-only-storage`),q(2,`read-only-storage`),q(3,`read-only-storage`),q(4,`storage`),q(5,`uniform`),q(6,`uniform`),q(7,`uniform`)],g=[q(0,`storage`),q(1,`uniform`)],_=[q(0,`read-only-storage`),q(1,`read-only-storage`),q(2,`storage`),q(3,`uniform`),q(4,`read-only-storage`),q(5,`read-only-storage`),q(6,`uniform`),q(7,`read-only-storage`),q(8,`read-only-storage`),q(9,`uniform`),...d?[q(10,`storage`)]:[]],v=fe(e,{cacheKey:`ulg-sph-render-field-spatial-v1-count-particles`,label:`ulg-sph-render-field-spatial-count-particles`,code:vn,entryPoint:`count_particle_bricks`,bindings:h}),y=fe(e,{cacheKey:`ulg-sph-render-field-spatial-v1-scatter-particles`,label:`ulg-sph-render-field-spatial-scatter-particles`,code:vn,entryPoint:`scatter_particle_bricks`,bindings:h}),b=fe(e,{cacheKey:`ulg-sph-render-field-spatial-v1-scan-blocks`,label:`ulg-sph-render-field-spatial-scan-blocks`,code:bn,entryPoint:`scan_brick_blocks`,bindings:g}),x=n.scanBlockCount>1?fe(e,{cacheKey:`ulg-sph-render-field-spatial-v1-scan-totals`,label:`ulg-sph-render-field-spatial-scan-totals`,code:bn,entryPoint:`scan_brick_block_totals`,bindings:g}):null,S=n.scanBlockCount>1?fe(e,{cacheKey:`ulg-sph-render-field-spatial-v1-add-offsets`,label:`ulg-sph-render-field-spatial-add-offsets`,code:bn,entryPoint:`add_brick_block_offsets`,bindings:g}):null,C=fe(e,{cacheKey:d?`ulg-sph-render-field-spatial-v1-gather-motion`:`ulg-sph-render-field-spatial-v1-gather`,label:`ulg-sph-render-field-spatial-gather`,code:d?Cn:Sn,entryPoint:`gather_bricks`,bindings:_}),w=n.particleWorkgroups>0?e.createBindGroup({label:`ulg-sph-render-field-spatial-particle-bin-bg`,layout:v.bindGroupLayout,entries:[{binding:0,resource:r},{binding:1,resource:i},{binding:2,resource:u},{binding:3,resource:c},{binding:4,resource:m},{binding:5,resource:{buffer:o}},{binding:6,resource:{buffer:l}},{binding:7,resource:{buffer:f.paramsBuffer}}]}):null,T=null,E=null,D=null;if(n.hasProductEvents&&n.eventWorkgroups>0){let t=[q(0,`read-only-storage`),q(1,`read-only-storage`),q(2,`read-only-storage`),q(3,`storage`),q(4,`uniform`),q(5,`uniform`),q(6,`uniform`)];T=fe(e,{cacheKey:`ulg-sph-render-field-spatial-v1-count-events`,label:`ulg-sph-render-field-spatial-count-events`,code:yn,entryPoint:`count_event_bricks`,bindings:t}),E=fe(e,{cacheKey:`ulg-sph-render-field-spatial-v1-scatter-events`,label:`ulg-sph-render-field-spatial-scatter-events`,code:yn,entryPoint:`scatter_event_bricks`,bindings:t}),D=e.createBindGroup({label:`ulg-sph-render-field-spatial-event-bin-bg`,layout:T.bindGroupLayout,entries:[{binding:0,resource:s},{binding:1,resource:i},{binding:2,resource:c},{binding:3,resource:m},{binding:4,resource:{buffer:o}},{binding:5,resource:{buffer:l}},{binding:6,resource:{buffer:f.paramsBuffer}}]})}let O=e.createBindGroup({label:`ulg-sph-render-field-spatial-scan-bg`,layout:b.bindGroupLayout,entries:[{binding:0,resource:m},{binding:1,resource:{buffer:f.paramsBuffer}}]}),k=e.createBindGroup({label:`ulg-sph-render-field-spatial-gather-bg`,layout:C.bindGroupLayout,entries:[{binding:0,resource:r},{binding:1,resource:i},{binding:2,resource:a},{binding:3,resource:{buffer:o}},{binding:4,resource:s},{binding:5,resource:c},{binding:6,resource:{buffer:l}},{binding:7,resource:u},{binding:8,resource:m},{binding:9,resource:{buffer:f.paramsBuffer}},...d?[{binding:10,resource:d}]:[]]}),A=(e,n,r,i,a=1,o=1)=>{let s=t.beginComputePass({label:e});s.setPipeline(n.pipeline),s.setBindGroup(0,r),s.dispatchWorkgroups(i,a,o),s.end()},j=n.hasProductEvents?2:1;return w&&A(`ulg-sph-render-field-spatial-count-particles`,v,w,n.particleWorkgroups,n.surfaceCount),D&&A(`ulg-sph-render-field-spatial-count-events`,T,D,n.eventWorkgroups,n.surfaceCount),A(`ulg-sph-render-field-spatial-scan-blocks`,b,O,n.scanBlockCount,j),n.scanBlockCount>1&&(A(`ulg-sph-render-field-spatial-scan-totals`,x,O,1,j),A(`ulg-sph-render-field-spatial-add-offsets`,S,O,n.scanBlockCount,j)),w&&A(`ulg-sph-render-field-spatial-scatter-particles`,y,w,n.particleWorkgroups,n.surfaceCount),D&&A(`ulg-sph-render-field-spatial-scatter-events`,E,D,n.eventWorkgroups,n.surfaceCount),A(`ulg-sph-render-field-spatial-gather`,C,k,n.maxBricksPerSurface,n.surfaceCount),{pipelineCacheStatus:C.cacheStatus}}var kn=v.length,An=N.length,jn=O.length,Mn=`peercompute.ulg.sph-render-field-motion.v0`,Nn=k.length;x.length;var Pn=w.length,Fn=f.length,In=M.length,Ln=p.length,Rn=i.length,zn=r.length,Bn=s.length,Vn=64*1024*1024,Hn=32768,Un=64*1024*1024,Wn=34028234663852886e22,Gn=11754943508222875e-54,Kn=Gn*16,qn=Math.fround(1e-12),Jn=new Float32Array(1),Yn=new Uint32Array(Jn.buffer),Xn=new WeakMap,Zn=new WeakMap,Qn=new WeakMap,$n=new WeakMap;function er(e){let t=Array.isArray(e?.metadata)?e.metadata:[],n=e?.records??null;return Object.freeze({surfaceTable:e,records:n,recordValues:n instanceof Float32Array?Object.freeze(Array.from(n)):null,metadata:t,surfaceCount:e?.surfaceCount,totalFieldCells:e?.totalFieldCells,maxFieldCellCount:e?.maxFieldCellCount,surfaces:Object.freeze(t.map(e=>Object.freeze({surface:e,index:e?.index,resolution:e?.resolution,fieldOffset:e?.fieldOffset,fieldCellCount:e?.fieldCellCount,isolation:e?.isolation,subtract:e?.subtract,strength:e?.strength,radiusNorm:e?.radiusNorm,particleRadiusScale:e?.particleRadiusScale,particleRadiusFloorNorm:e?.particleRadiusFloorNorm,colorLinear:Array.isArray(e?.colorLinear)?Object.freeze([...e.colorLinear]):null,surfaceKey:e?.surfaceKey,material:e?.material,phase:e?.phase,renderKey:e?.renderKey,materialId:e?.materialId,phaseId:e?.phaseId,opticalStateId:e?.opticalStateId,opticalStateKey:e?.opticalStateKey,surfaceIdentityKey:e?.surfaceIdentityKey,collectiveOpticalRoute:e?.collectiveOpticalRoute,collectiveOpticalRouteSchema:e?.collectiveOpticalRouteSchema,collectiveOpticalRouteKey:e?.collectiveOpticalRouteKey,collectiveOpticalRouteId:e?.collectiveOpticalRouteId,opticalResponseAuthorityFlag:e?.opticalResponseAuthorityFlag,opticalResponseAuthority:e?.opticalResponseAuthority,opticalResponseReady:e?.opticalResponseReady,opticalVisibilityFlag:e?.opticalVisibilityFlag,opticalVisibilityReason:e?.opticalVisibilityReason,opticalOpacity:e?.opticalOpacity,opticalEffectiveOpacity:e?.opticalEffectiveOpacity,opticalDepth:e?.opticalDepth,opticalScatteringCoefficientPerM:e?.opticalScatteringCoefficientPerM,opticalTransmission:e?.opticalTransmission,opticalRoughness:e?.opticalRoughness,opticalBlockedFlag:e?.opticalBlockedFlag,opticalProvenanceSource:e?.opticalProvenanceSource,renderDomainId:e?.renderDomainId,renderDomainKey:e?.renderDomainKey,renderLayer:e?.renderLayer,renderOrder:e?.renderOrder,transparencyClassId:e?.transparencyClassId,depthWriteFlag:e?.depthWriteFlag,emissiveTemperatureK:e?.emissiveTemperatureK,status:e?.status})))})}function tr(e,t){let n=e?.metadata;return!!(t&&e===t.surfaceTable&&e?.records===t.records&&t.records instanceof Float32Array&&Array.isArray(t.recordValues)&&t.records.length===t.recordValues.length&&t.recordValues.every((e,n)=>Object.is(t.records[n],e))&&n===t.metadata&&e?.surfaceCount===t.surfaceCount&&e?.totalFieldCells===t.totalFieldCells&&e?.maxFieldCellCount===t.maxFieldCellCount&&Array.isArray(n)&&n.length===t.surfaces.length&&t.surfaces.every((e,t)=>{let r=n[t];return!!(r===e.surface&&r?.index===e.index&&r?.resolution===e.resolution&&r?.fieldOffset===e.fieldOffset&&r?.fieldCellCount===e.fieldCellCount&&r?.isolation===e.isolation&&r?.subtract===e.subtract&&r?.strength===e.strength&&r?.radiusNorm===e.radiusNorm&&r?.particleRadiusScale===e.particleRadiusScale&&r?.particleRadiusFloorNorm===e.particleRadiusFloorNorm&&(e.colorLinear==null?r?.colorLinear==null:Array.isArray(r?.colorLinear)&&r.colorLinear.length===e.colorLinear.length&&e.colorLinear.every((e,t)=>Object.is(r.colorLinear[t],e)))&&r?.surfaceKey===e.surfaceKey&&r?.material===e.material&&r?.phase===e.phase&&r?.renderKey===e.renderKey&&r?.materialId===e.materialId&&r?.phaseId===e.phaseId&&r?.opticalStateId===e.opticalStateId&&r?.opticalStateKey===e.opticalStateKey&&r?.surfaceIdentityKey===e.surfaceIdentityKey&&r?.collectiveOpticalRoute===e.collectiveOpticalRoute&&r?.collectiveOpticalRouteSchema===e.collectiveOpticalRouteSchema&&r?.collectiveOpticalRouteKey===e.collectiveOpticalRouteKey&&r?.collectiveOpticalRouteId===e.collectiveOpticalRouteId&&r?.opticalResponseAuthorityFlag===e.opticalResponseAuthorityFlag&&r?.opticalResponseAuthority===e.opticalResponseAuthority&&r?.opticalResponseReady===e.opticalResponseReady&&r?.opticalVisibilityFlag===e.opticalVisibilityFlag&&r?.opticalVisibilityReason===e.opticalVisibilityReason&&r?.opticalOpacity===e.opticalOpacity&&r?.opticalEffectiveOpacity===e.opticalEffectiveOpacity&&r?.opticalDepth===e.opticalDepth&&r?.opticalScatteringCoefficientPerM===e.opticalScatteringCoefficientPerM&&r?.opticalTransmission===e.opticalTransmission&&r?.opticalRoughness===e.opticalRoughness&&r?.opticalBlockedFlag===e.opticalBlockedFlag&&r?.opticalProvenanceSource===e.opticalProvenanceSource&&r?.renderDomainId===e.renderDomainId&&r?.renderDomainKey===e.renderDomainKey&&r?.renderLayer===e.renderLayer&&r?.renderOrder===e.renderOrder&&r?.transparencyClassId===e.transparencyClassId&&r?.depthWriteFlag===e.depthWriteFlag&&r?.emissiveTemperatureK===e.emissiveTemperatureK&&r?.status===e.status)}))}function nr({buffer:e,artifact:t,invalidate:n}={}){if(!e||!t||typeof n!=`function`)return null;let r=$n.get(e);r?.artifact!==t&&r?.invalidate?.();let i=Object.freeze({buffer:e,artifact:t,invalidate:n});return $n.set(e,i),i}function rr(e){if(!e)return!1;let t=$n.get(e);return t&&t.invalidate?.(),$n.delete(e),!!t}function ir(e,t){return e?$n.get(e)?.artifact===t:!0}function ar(e,t){e&&$n.get(e)?.artifact===t&&$n.delete(e)}function or(e,{device:t,sourceFamily:n,particleCount:r,renderRowsBuffer:i=null,renderRows:a=null}={}){let o=Xn.get(e);return!!(o&&o.active===!0&&o.device===t&&o.sourceFamily===n&&o.particleCount===r&&e?.schroederSpatialSourceFamily===o.sourceFamily&&e?.particleCount===o.particleCount&&(e?.renderRowsBuffer??null)===o.renderRowsBuffer&&e?.renderRows===o.renderRows&&(o.renderRowsBuffer!=null||Array.isArray(o.renderRowValues)&&e.renderRows instanceof Float32Array&&e.renderRows.length===o.renderRowValues.length&&o.renderRowValues.every((t,n)=>e.renderRows[n]===t))&&(e?.dispersedMediumOptics??null)===o.dispersedMediumOptics&&e?.rowStrideFloats===o.rowStrideFloats&&Array.isArray(e?.rowLayout)&&e.rowLayout.length===o.rowLayout.length&&e.rowLayout.every((e,t)=>e===o.rowLayout[t])&&(i==null||o.renderRowsBuffer===i)&&(a==null||o.renderRows===a)&&(o.renderRowsBuffer==null||Zn.get(o.renderRowsBuffer)===e)&&(o.dispersedMediumOptics==null||o.dispersedMediumOptics.buffer===o.dispersedMediumOpticsBuffer&&o.dispersedMediumOptics.authority===o.dispersedMediumOpticsAuthority&&ne(t,o.dispersedMediumOpticsAuthority,{buffer:o.dispersedMediumOpticsBuffer,particleCount:o.particleCount,rowCount:o.particleCount,rowStrideFloats:8})))}function sr({device:e,sourceFamily:t,productEventRows:n=null,productEventBuffer:r=null,productEventSource:i=null,productEventCount:a=0,productEventLiveCountDescriptor:o=null}={}){return n!=null||r!=null||i!=null||Number(a)!==0?n!=null||r==null||i==null||i.productEventBuffer!==r||!Number.isSafeInteger(a)||a<=0||!o||!P(o,{handle:i,device:e})||o.hostObserved!==!1||o.expectedRowCapacity!==a||o.rowCapacity!==a||o.expectedRowStrideVec4!==Nn/4||o.rowStrideFloats!==Nn||Number(r.size)<a*Nn*Float32Array.BYTES_PER_ELEMENT?!1:oe(t?.productHistoryCommitGate??null,{device:e,residentProductMass:i}):!0}function cr(e){let t=Xn.get(e);!t||t.active!==!0||(t.active=!1,t.renderRowsBuffer&&Zn.get(t.renderRowsBuffer)===e&&Zn.delete(t.renderRowsBuffer))}function lr(e,{device:t,sourceFamily:n,particleCount:r,fieldRowsBuffer:i=null,fieldRows:a=null,surfaceBuffer:o=null,surfaceTable:s=null}={}){let c=Qn.get(e);return!!(c&&c.active===!0&&c.device===t&&c.sourceFamily===n&&c.particleCount===r&&e?.schroederSpatialSourceFamily===c.sourceFamily&&e?.particleCount===c.particleCount&&(e?.fieldRowsBuffer??null)===c.fieldRowsBuffer&&e?.fieldRows===c.fieldRows&&(e?.surfaceBuffer??null)===c.surfaceBuffer&&e?.surfaceTable===c.surfaceTable&&e?.rowStrideFloats===c.rowStrideFloats&&e?.fieldRowByteLength===c.fieldRowByteLength&&e?.fieldRowsBufferByteLength===c.fieldRowsBufferByteLength&&e?.fieldPadding===c.fieldPadding&&e?.refEdgeM===c.refEdgeM&&e?.productEventCount===c.productEventCount&&e?.productEventRowCapacity===c.productEventRowCapacity&&e?.productEventBufferBound===(c.productEventBuffer!=null)&&e?.productEventCountAuthority===c.productEventCountAuthority&&e?.productEventControlAuthentication===c.productEventControlAuthentication&&c.productEventSourceAuthenticated===(c.productEventBuffer!=null)&&e?.dispersedMediumOpticsBound===!!(c.dispersedMediumOpticsBuffer||c.dispersedMediumOpticsRows)&&e?.dispersedMediumOpticsRowCount===(c.dispersedMediumOpticsBuffer||c.dispersedMediumOpticsRows?c.particleCount:0)&&c.dispersedMediumOpticsSourceAuthenticated===!!c.dispersedMediumOpticsBuffer&&(c.dispersedMediumOpticsBuffer==null||c.dispersedMediumOptics===c.renderRowsSource?.dispersedMediumOptics&&c.dispersedMediumOptics?.buffer===c.dispersedMediumOpticsBuffer&&c.dispersedMediumOptics?.authority===c.dispersedMediumOpticsAuthority)&&tr(e?.surfaceTable,c.surfaceTableSnapshot)&&(i==null||c.fieldRowsBuffer===i)&&(a==null||c.fieldRows===a)&&(o==null||c.surfaceBuffer===o)&&(s==null||c.surfaceTable===s)&&(c.fieldRowsBuffer==null||ir(c.fieldRowsBuffer,e)))}function ur(e){let t=Qn.get(e);!t||t.active!==!0||(t.active=!1,t.fieldRowsBuffer&&ar(t.fieldRowsBuffer,e))}var dr=1.9,fr=.5,pr=48,mr=`peercompute.ulg.sph-render-row-particle-scale-stability.v0`,hr=`peercompute.ulg.sph-render-row-material-bank-particle-size-consumer.v0`,gr=`sph-resident-render-row-extraction`,_r=`sph-resident-render-field-splat`,vr=`full-parity-readback`,yr=`no-full-readback`,br=`dense-readback`,xr=`compact-active-readback`,Sr=`gpu-resident-summary`,Cr=`fixed-cell-slots`,wr=`atomic-compact`,Tr=Object.freeze(Object.fromEntries(Object.entries(L).map(([e,t])=>[t,e]))),Z={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,VERTEX:globalThis.GPUBufferUsage?.VERTEX??32,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256},Er={READ:globalThis.GPUMapMode?.READ??1},Dr=16777215;function Or(e){if(e?.schema!==`peercompute.ulg.sph-gpu-particle-buffer.v0`)throw TypeError(`SPH render rows require a packed SPH GPU particle buffer`)}function kr(e){let t=Math.max(0,Math.round(Q(e?.particleCount,0))*B);if(e?.identity==null)return new Uint32Array(t);if(!(e.identity instanceof Uint32Array))throw TypeError(`SPH particle identity rows must be a Uint32Array`);if(e.identity.length<t)throw RangeError(`SPH particle identity rows must cover every particle slot`);return e.identity}function Ar({sphParticleState:e=null,sphParticleUpload:t=null}={}){return e?.cpuStateStale===!0||e?.cpuIdentityStale===!0||t?.identityRequired===!0||le(e)}function jr(e={}){return Ar(e)||ee(e.sphParticleUpload)}function Mr({device:e,sphParticleUpload:t,particleCount:n,identityBuffer:r}){let i=e=>e!=null&&(typeof e!=`number`||e!==0);if(!(t?.dispersedMediumOptics!=null||t?.dispersedMediumOpticsAuthority!=null||t?.dispersedMediumOpticsBuffer!=null||i(t?.dispersedMediumOpticsRowCount)||i(t?.dispersedMediumOpticsRowStrideFloats)||i(t?.dispersedMediumOpticsBufferByteLength)||t?.ownsDispersedMediumOpticsBuffer===!0))return null;let a=t?.dispersedMediumOptics??null,o=n*8*Float32Array.BYTES_PER_ELEMENT,s=Number(a?.buffer?.size);if(!a||a.particleCount!==n||a.rowCount!==n||a.rowStrideFloats!==8||a.bufferByteLength!==o||!Number.isSafeInteger(s)||s!==o||t.dispersedMediumOpticsAuthority!==a.authority||t.dispersedMediumOpticsBuffer!==a.buffer||t.dispersedMediumOpticsRowCount!==a.rowCount||t.dispersedMediumOpticsRowStrideFloats!==a.rowStrideFloats||t.dispersedMediumOpticsBufferByteLength!==a.bufferByteLength||t.ownsDispersedMediumOpticsBuffer!==!0&&t.ownsDispersedMediumOpticsBuffer!==!1||!re(a,{particleCount:n,topologyEpoch:t.topologyEpoch,identityRevision:t.identityRevision,identityBuffer:r})||!ne(e,a.authority,{buffer:a.buffer,particleCount:n,rowCount:n,rowStrideFloats:8}))throw TypeError(`SPH render rows rejected a torn, foreign, or misaligned dispersed-medium optics sidecar`);return a}function Q(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function Nr(e,t,{positive:n=!1}={}){let r=Number(e);if(!Number.isSafeInteger(r)||r<+!!n||r>Dr||Math.fround(r)!==r)throw RangeError(`${t} must be a ${n?`positive`:`non-negative`} integer exactly representable as f32`);return r}function Pr(e,t,{min:n=0}={}){let r=Number(e);if(!Number.isSafeInteger(r)||r<n||r>4294967295||Math.fround(r)!==r)throw RangeError(`${t} must be an integer exactly representable as both u32 and f32`);return r}function Fr(e,t){let n=Number(e);if(!Number.isSafeInteger(n)||n<0||n>4294967295)throw RangeError(`${t} must be a non-negative safe u32 integer`);return n}function Ir(e,t){let n=Number(e),r=Number(t);if(!Number.isFinite(n))throw RangeError(`fieldPadding must be finite`);if(!Number.isFinite(r))throw RangeError(`refEdgeM must be finite`);let i=Math.fround(n),a=Math.fround(r);if(!(i>=0&&i<.5))throw RangeError(`fieldPadding must satisfy 0 <= fieldPadding < 0.5 after f32 encoding`);if(!(a>0)||!Number.isFinite(a))throw RangeError(`refEdgeM must be positive and finite after f32 encoding`);if(a<qn)throw RangeError(`refEdgeM must be at least 1e-12 m after f32 encoding`);return{fieldPadding:i,refEdgeM:a}}function Lr(e,t){if(!(e>0))return Math.max(0,t);if(!(t>0))return Math.max(0,e);if(e>=Wn-t)return Wn;let n=Math.fround(e+t);return n<Gn?0:n}function Rr(e,t){if(!(e>0)||!(t>0))return 0;let n=Math.fround(e*t);return Number.isFinite(n)?n<Gn?0:n:Wn}function zr(e){return Jn[0]=e,Yn[0]}function Br(e){return Yn[0]=e>>>0,Jn[0]}function Vr(e){let t=zr(e)&2147483647,n=t>>>23&255,r=t&8388607;if(t===0||n===255)return null;if(n===0){let e=31-Math.clz32(r);return{mantissa:Br(1065353216|r<<23-e>>>0&8388607),exponent:e-149}}return{mantissa:Br(1065353216|r),exponent:n-127}}function Hr(e,t,n){let r=Vr(e),i=Vr(t),a=Vr(n);if(!r||!i||!a)return 0;let o=Math.fround(Math.fround(Math.fround(r.mantissa*i.mantissa)*a.mantissa)*a.mantissa),s=r.exponent+i.exponent+2*a.exponent;for(let e=0;e<4&&o>=2;e+=1)o=Math.fround(o*.5),s+=1;return s<-126?0:s>127?Wn:Br((s+127<<23|zr(o)&8388607)>>>0)}function Ur(e,t,n){let r=Hr(e,t,n);if(r===0)return 0;let i=zr(e)&2147483648;return Br((zr(r)|i)>>>0)}function Wr(e,t){return t<-126?0:Br((t+127<<23|zr(e)&8388607)>>>0)}function Gr(e,t){if(!e?.nonzero)return{...t,nonzero:!!t?.nonzero};if(!t?.nonzero)return{...e,nonzero:!0};let n,r;if(t.exponent>=e.exponent){let i=Wr(e.mantissa,e.exponent-t.exponent);n=t.exponent,r=Math.fround(t.mantissa+i)}else{let i=Wr(t.mantissa,t.exponent-e.exponent);n=e.exponent,r=Math.fround(e.mantissa+i)}return r>=2&&(r=Math.fround(r*.5),n+=1),{mantissa:r,exponent:n,nonzero:!0}}function Kr(e,t){return e?.nonzero?t?.nonzero?e.exponent===t.exponent?e.mantissa===t.mantissa?0:e.mantissa>t.mantissa?1:-1:e.exponent>t.exponent?1:-1:1:t?.nonzero?-1:0}function qr(e,t){if(!e?.nonzero)return{mantissa:0,exponent:0,nonzero:!1};if(!t?.nonzero)return{...e,nonzero:!0};let n=Wr(t.mantissa,t.exponent-e.exponent),r=Vr(Math.fround(e.mantissa-n));return r?{mantissa:r.mantissa,exponent:e.exponent+r.exponent,nonzero:!0}:{mantissa:0,exponent:0,nonzero:!1}}function Jr(e){return!e?.nonzero||e.exponent<-126?0:e.exponent>127?Wn:Br((e.exponent+127<<23|zr(e.mantissa)&8388607)>>>0)}function Yr(e,t){if(t===0||!Number.isFinite(t))return e;let n=Vr(t);return n?(n.nonzero=!0,zr(t)&2147483648?{positive:e.positive,negative:Gr(e.negative,n)}:{positive:Gr(e.positive,n),negative:e.negative}):e}function Xr(e){let t=Kr(e.positive,e.negative);if(t===0)return 0;let n=t>0,r=Jr(qr(n?e.positive:e.negative,n?e.negative:e.positive));return n?r:-r}function Zr(e,t){if(!e?.nonzero||!t?.nonzero)return{mantissa:0,exponent:0,nonzero:!1};let n=Math.fround(e.mantissa*t.mantissa),r=e.exponent+t.exponent;return n>=2&&(n=Math.fround(n*.5),r+=1),{mantissa:n,exponent:r,nonzero:!0}}function Qr(e,t){if(!e?.nonzero||!t?.nonzero)return 0;let n=Math.fround(e.mantissa/t.mantissa),r=e.exponent-t.exponent;return n<1?(n=Math.fround(n*2),--r):n>=2&&(n=Math.fround(n*.5),r+=1),r<-126?0:r>127?Wn:Br((r+127<<23|zr(n)&8388607)>>>0)}function $r(e,t,n){if(!(n>0)||!Number.isFinite(t))return e;let r=Vr(n);if(!r)return e;r.nonzero=!0;let i=Gr(e.weight,r),a=Vr(ti(t,0,Wn));return a?(a.nonzero=!0,{weight:i,weightedTemperature:Gr(e.weightedTemperature,Zr(r,a))}):{weight:i,weightedTemperature:e.weightedTemperature}}function ei(e){return Qr(e.weightedTemperature,e.weight)}function ti(e,t,n){return Math.min(n,Math.max(t,e))}function ni(e,{noFullReadback:t=!1}={}){let n=String(e||``).trim().toLowerCase();return n===wr||n===`webgpu-atomic-compact`||n===`compact`?wr:n===Cr||n===`webgpu-fixed-cell-slots`||n===`fixed`?Cr:t?wr:Cr}function ri(e){return+(e===wr)}function ii({requiredVertexRows:e=0,requestedMaxVertexRows:t=null,emissionMode:n=Cr,compactByteBudget:r=Un}={}){let i=Math.max(0,Math.round(Q(e,0))),a=t!=null&&t!==``&&Number.isFinite(Number(t))?Math.max(0,Math.round(Number(t))):null;if(n!==wr)return Math.max(i,a??i);let o=Ln*Float32Array.BYTES_PER_ELEMENT,s=Math.max(0,Math.floor(Math.max(o,Q(r,Un))/o)),c=Math.min(i,a??s);return i>0?Math.max(3,c-c%3):0}function ai(e){return Tr[Math.round(Q(e,0))]||`unknown`}function oi(e,t){return e===`h2o`&&t===`solid`?`ice`:e===`h2o`&&t===`gas`?`steam`:e||`unknown`}function si(e){let t=Math.round(Q(e,0));return t===1?`base`:t===2?`drop`:null}function ci({material:e,phase:t,renderDomainId:n}){let r=Math.max(0,Math.round(Q(n,0)));return r<=0?null:`render-domain:${r}|material:${e||`unknown`}|phase:${t||`unknown`}`}function li(e){let t=String(e||``).trim();return t?/^[A-Z][a-z]?$/.test(t)?t:t.toLowerCase():`unknown`}function ui(e={},t=null){let n=new Map;for(let t of Object.keys(e||{}))n.set(U(t),li(t));for(let e of t?.metadata||[]){e.product&&n.set(e.productMaterialId,e.product),e.a&&n.set(e.aMaterialId,e.a),e.b&&n.set(e.bMaterialId,e.b);for(let t of e.productTerms||[])t.material&&Number.isFinite(t.materialId)&&n.set(t.materialId,t.material);for(let t of e.reactantTerms||[])t.material&&Number.isFinite(t.materialId)&&n.set(t.materialId,t.material)}for(let e of t?.productTermMetadata||[])e.material&&Number.isFinite(e.materialId)&&n.set(e.materialId,e.material);for(let e of t?.reactantTermMetadata||[])e.material&&Number.isFinite(e.materialId)&&n.set(e.materialId,e.material);return n}function di({material:e,phase:t,temperatureK:r,materialProperties:i}){let a=Ce(r);if(a.visible)return[...a.srgb];let o=n({material:e,phase:t,properties:i?.[e]??i?.[String(e).toLowerCase()]??i?.[String(e).toUpperCase()]??null});return o.baseColorSrgb??o.pbr?.baseColorSrgb??[1,1,1]}function fi(e=[]){let t={};for(let n of e||[]){let e=Ce(n.temperatureK);if(!e.visible)continue;let r=.2126*e.srgb[0]+.7152*e.srgb[1]+.0722*e.srgb[2],i=[n.material,n.renderKey,ci(n)].filter(Boolean);for(let e of i){let i=t[e]||(t[e]={t:0,w:0});i.t+=(Number(n.temperatureK)||0)*r,i.w+=r}}let n={};for(let[e,r]of Object.entries(t))n[e]=r.w>0?r.t/r.w:null;return n}function pi(e=[]){let t={};for(let n of e||[]){let e=Ce(n.temperatureK);if(!e.visible)continue;let r=.2126*e.srgb[0]+.7152*e.srgb[1]+.0722*e.srgb[2],i=[n.material,n.renderKey,ci(n)].filter(Boolean);for(let n of i){let i=t[n]||(t[n]={r:0,g:0,b:0,w:0});i.r+=e.srgb[0]*r,i.g+=e.srgb[1]*r,i.b+=e.srgb[2]*r,i.w+=r}}let n={};for(let[e,r]of Object.entries(t))n[e]=r.w>0?[r.r/r.w,r.g/r.w,r.b/r.w]:null;return n}function mi(t,{materialProperties:n={},reactionTable:r=null,materialMap:i=ui(n,r)}={}){if(!(t instanceof Float32Array))throw TypeError(`decodeSphRenderRows requires Float32Array render rows`);if(t.length%kn!==0)throw RangeError(`SPH render rows length must align to the render row stride`);let a=t.length/kn,o=new Float32Array(a*3),s=new Float32Array(a*3),c=new Float32Array(a),l=new Float32Array(a),u=Array(a),d=[];for(let e=0;e<a;e+=1){let r=e*kn,a=t[r+4],f=t[r+5],p=i.get(a)||`unknown`,m=ai(f),h=oi(p,m),g=t[r+6],_=Math.max(0,Math.round(Q(t[r+11],0))),v=Q(t[r+12],0),y=Q(t[r+13],0),b=Q(t[r+14],1),x=Q(t[r+15],0),S=si(_),C=di({material:p,phase:m,temperatureK:g,materialProperties:n});o.set([t[r],t[r+1],t[r+2]],e*3),s.set(C,e*3),c[e]=v,l[e]=y;let w={material:p,phase:m,renderKey:h};_>0&&(w.renderDomainId=_,w.renderDomainKey=S),u[e]=w,d.push({index:e,positionM:[t[r],t[r+1],t[r+2]],massKg:t[r+3],materialId:a,material:p,phaseId:f,phase:m,temperatureK:g,status:t[r+7],restDensityKgPerM3:t[r+8],phaseFractionGas:t[r+9],representedEntityCount:t[r+10],renderDomainId:_,renderDomainKey:S,currentVolumeM3:v,particleRadiusM:y,volumeRatioJ:b,pressurePa:x,renderKey:h})}return{schema:e,status:`render-rows-decoded`,particleCount:a,positionsM:o,colorsRgb:s,currentVolumesM3:c,particleRadiiM:l,materials:u,rows:d,emissiveByMaterial:pi(d),emissiveTemperatureByMaterial:fi(d),scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function hi(e,{renderDomainBaseCount:t=0,renderDomainDropCount:n=0,particleIdentity:r=null}={}){let i=r instanceof Uint32Array?r[e*B]:0;if(i>0)return i;let a=Math.max(0,Math.round(Q(t,0))),o=Math.max(0,Math.round(Q(n,0)));return a>0&&e<a?1:o>0&&e>=a&&e<a+o?2:0}function gi(e,t){let n=Q(e,0),r=Q(t,0);return n>0&&r>0?n/r:0}function _i(e){let t=Q(e,0);return t>0?Math.cbrt(3*t/(4*Math.PI)):0}function vi(e){let t=Q(e,0);return t>0?4*Math.PI*t**3/3:0}function yi({particleCount:e,rowProducer:t,maxSupportRadiusM:n=0,maxGasRadiusM:r=0}){return{schema:mr,status:`particle-scale-bounded`,rowProducer:t,particleCount:e,maxRadiusGrowthRatioAllowed:4,maxVolumeRatioJAllowed:64,maxSupportRadiusSmoothingRatioAllowed:dr,maxSupportRadiusM:Math.max(0,Q(n,0)),maxGasRadiusSmoothingRatioAllowed:fr,maxGasParticleRadiusM:Math.max(0,Q(r,0)),supportRadiusPolicyAppliedInShader:!1,capAppliedCount:0,maxRawParticleRadiusM:0,maxParticleRadiusM:0,maxRawRadiusGrowthRatio:0,maxEffectiveRadiusGrowthRatio:0,maxRawVolumeRatioJ:0,maxEffectiveVolumeRatioJ:0,sampleCappedRows:[],scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function bi(e,t,{index:n,materialId:r,phaseId:i,maxSampleRows:a=8}={}){!e||!t||(e.maxRawParticleRadiusM=Math.max(e.maxRawParticleRadiusM,Q(t.rawParticleRadiusM,0)),e.maxParticleRadiusM=Math.max(e.maxParticleRadiusM,Q(t.particleRadiusM,0)),e.maxRawRadiusGrowthRatio=Math.max(e.maxRawRadiusGrowthRatio,Q(t.rawRadiusGrowthRatio,0)),e.maxEffectiveRadiusGrowthRatio=Math.max(e.maxEffectiveRadiusGrowthRatio,Q(t.effectiveRadiusGrowthRatio,0)),e.maxRawVolumeRatioJ=Math.max(e.maxRawVolumeRatioJ,Q(t.rawVolumeRatioJ,0)),e.maxEffectiveVolumeRatioJ=Math.max(e.maxEffectiveVolumeRatioJ,Q(t.volumeRatioJ,0)),t.radiusCapApplied&&(e.capAppliedCount+=1,e.status=`particle-scale-cap-applied`,!(e.sampleCappedRows.length>=a)&&e.sampleCappedRows.push({index:n,materialId:r,phaseId:i,reason:t.radiusCapReason,restVolumeM3:t.restVolumeM3,rawCurrentVolumeM3:t.rawCurrentVolumeM3,currentVolumeM3:t.currentVolumeM3,restParticleRadiusM:t.restParticleRadiusM,rawParticleRadiusM:t.rawParticleRadiusM,particleRadiusM:t.particleRadiusM,rawVolumeRatioJ:t.rawVolumeRatioJ,volumeRatioJ:t.volumeRatioJ,rawRadiusGrowthRatio:t.rawRadiusGrowthRatio,effectiveRadiusGrowthRatio:t.effectiveRadiusGrowthRatio})))}function xi({particleCount:e,rowProducer:t,maxSupportRadiusM:n=0,maxGasRadiusM:r=0}){return{schema:mr,status:`gpu-row-cap-policy-applied-in-shader`,rowProducer:t,particleCount:e,maxRadiusGrowthRatioAllowed:4,maxVolumeRatioJAllowed:64,maxSupportRadiusSmoothingRatioAllowed:dr,maxSupportRadiusM:Math.max(0,Q(n,0)),maxGasRadiusSmoothingRatioAllowed:fr,maxGasParticleRadiusM:Math.max(0,Q(r,0)),supportRadiusPolicyAppliedInShader:!0,capAppliedCount:null,capAppliedCountKnown:!1,reason:`WebGPU retained render rows apply radius growth, J, support-radius, and gas visual-radius caps in shader without a CPU particle scan`,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Si({sphParticleState:e,mlsMpmParticleState:t=null,particleIndex:n,massKg:r,restDensityKgPerM3:i,visualParticleRadiusM:a=0,phaseId:o=L.unknown,maxSupportRadiusM:s=0,maxGasRadiusM:c=0}={}){let l=gi(r,i),u=vi(a),d=u>0?u:l,f=1,p=0,m=t?.mechanics;if(m instanceof Float32Array&&n>=0&&n<Q(e?.particleCount,0)){let e=n*K;if(e+28<m.length){let t=Q(m[e+18],1),n=Q(m[e+19],0),r=Q(m[e+28],0);f=t>0?t:1,n>0&&!(u>0)&&(d=n),p=Math.max(r,0)}}let h=Math.max(f,1e-9),g=Math.max(d*h,0),_=_i(d),v=_i(g),y=_>0&&v>0?v/_:0,b=g,x=v,S=h,C=y,w=!1,T=null,E=_*4;_>0&&v>E&&(w=!0,T=`max-radius-growth-ratio`,x=E,b=d*64,S=64,C=4);let D=Q(s,0);D>0&&x>D&&(w=!0,T=T?`${T}+max-support-radius`:`max-support-radius`,x=D,b=vi(D),S=d>0?Math.max(b/d,1e-9):S,C=_>0?x/_:0);let O=Q(c,0);return Math.round(Q(o,L.unknown))===L.gas&&O>0&&x>O&&(w=!0,T=T?`${T}+gas-phase-visual-radius-proxy`:`gas-phase-visual-radius-proxy`,x=O,b=vi(O),S=d>0?Math.max(b/d,1e-9):S,C=_>0?x/_:0),{currentVolumeM3:b,particleRadiusM:x,volumeRatioJ:S,pressurePa:p,restVolumeM3:d,rawCurrentVolumeM3:g,restParticleRadiusM:_,rawParticleRadiusM:v,rawVolumeRatioJ:h,rawRadiusGrowthRatio:y,effectiveRadiusGrowthRatio:C,radiusCapApplied:w,radiusCapReason:T}}function Ci({sphParticleState:t,mlsMpmParticleState:n=null,renderDomainBaseCount:r=0,renderDomainDropCount:i=0}={}){Or(t);let a=new Float32Array(t.particleCount*kn),o=Q(t.smoothingLengthM,0)*dr,s=Q(t.smoothingLengthM,0)*fr,c=yi({particleCount:t.particleCount,rowProducer:`cpu-reference`,maxSupportRadiusM:o,maxGasRadiusM:s});for(let e=0;e<t.particleCount;e+=1){let l=e*H,u=e*se,d=e*kn,f=t.state[l+3],p=t.thermo[u],m=t.thermo[u+1],h=t.thermo[u+3],g=t.thermo[u+11],_=Si({sphParticleState:t,mlsMpmParticleState:n,particleIndex:e,massKg:f,restDensityKgPerM3:h,visualParticleRadiusM:g,phaseId:m,maxSupportRadiusM:o,maxGasRadiusM:s});bi(c,_,{index:e,materialId:p,phaseId:m}),a.set([t.state[l],t.state[l+1],t.state[l+2],f,p,m,t.thermo[u+2],t.thermo[u+10],h,t.thermo[u+6],t.thermo[u+9],hi(e,{renderDomainBaseCount:r,renderDomainDropCount:i,particleIdentity:t.identity}),_.currentVolumeM3,_.particleRadiusM,_.volumeRatioJ,_.pressurePa,t.thermo[u+4],0,0,0],d)}return{schema:e,backend:`cpu-reference`,status:`render-rows-extracted`,kernelScope:gr,particleCount:t.particleCount,rowLayout:[...v],rowStrideFloats:kn,renderRows:a,renderRowByteLength:a.byteLength,particleScaleStability:c,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function wi(e,t,n,r=0){let i=Math.max(4,n.byteLength);ki(e,t,i),Ai(e,t,i);let a=e.createBuffer({label:t,size:i,usage:Z.STORAGE|Z.COPY_DST|r});try{n.byteLength>0&&e.queue.writeBuffer(a,0,n)}catch(e){throw a.destroy?.(),e}return a}function Ti(e,t,n,r=0){let i=Math.max(4,n);return ki(e,t,i),Ai(e,t,i),e.createBuffer({label:t,size:i,usage:Z.STORAGE|Z.COPY_DST|r})}function Ei(e){let t=Number(e?.limits?.maxBufferSize);return Number.isFinite(t)&&t>0?t:null}function Di(e){let t=Number(e?.limits?.maxStorageBufferBindingSize);return Number.isFinite(t)&&t>0?t:null}function Oi(e){let t=Number(e?.limits?.maxComputeWorkgroupsPerDimension);return Number.isSafeInteger(t)&&t>0?t:null}function ki(e,t,n){if(!Number.isSafeInteger(n)||n<=0)throw RangeError(`${t} byte length must be a positive safe integer`);let r=Ei(e);if(r!=null&&!(n<=r))throw RangeError(`${t} byte length ${n} exceeds WebGPU device maxBufferSize ${r}`)}function Ai(e,t,n){if(!Number.isSafeInteger(n)||n<=0)throw RangeError(`${t} storage binding byte length must be a positive safe integer`);let r=Di(e);if(r!=null&&!(n<=r))throw RangeError(`${t} byte length ${n} exceeds WebGPU device maxStorageBufferBindingSize ${r}`)}function ji(e,t,...n){for(let[e,r]of n.entries())if(!(Number.isSafeInteger(r)&&r>=0))throw RangeError(`${t} workgroup dimension ${e} must be a non-negative safe integer`);let r=Oi(e);if(r!=null){for(let[e,i]of n.entries())if(!(i<=r))throw RangeError(`${t} workgroup dimension ${e} (${i}) exceeds WebGPU device maxComputeWorkgroupsPerDimension ${r}`)}}function Mi(e,t){if(!Number.isSafeInteger(e)||e<0)throw RangeError(`${t} required byte length must be a non-negative safe integer`);return Math.max(4,e)}function Ni(e,t){let n=Number(e);if(!Number.isSafeInteger(n)||n<0)throw RangeError(`${t} must be a non-negative safe integer byte length`);return n}function Pi(e,t,n,r,{offset:i=0}={}){if(!n)return null;let a=Mi(r,t),o=Number(n.size);if(!Number.isSafeInteger(i)||i<0||i%Uint32Array.BYTES_PER_ELEMENT!==0)throw RangeError(`${t} binding offset must be a non-negative four-byte-aligned safe integer`);let s=Number(e?.limits?.minStorageBufferOffsetAlignment);if(i>0&&Number.isSafeInteger(s)&&s>0&&i%s!==0)throw RangeError(`${t} binding offset ${i} is not aligned to WebGPU device minStorageBufferOffsetAlignment ${s}`);if(!Number.isSafeInteger(o)||o<0)throw RangeError(`${t} must expose its exact GPU buffer size`);let c=i+a;if(!Number.isSafeInteger(c)||o<c)throw RangeError(`${t} capacity ${o} is smaller than required binding range ${c}`);return Ai(e,t,a),a}function Fi(e,t,{offset:n=0,label:r=`WebGPU storage buffer`}={}){let i=Mi(t,r);return n>0?{buffer:e,offset:n,size:i}:{buffer:e,size:i}}function Ii(e=null){return Math.max(0,Math.round(Q(e?.totalFieldCells,0)))*3*zn*Float32Array.BYTES_PER_ELEMENT}function Li({device:e,candidateRowsByteLength:t,candidateReadbackByteBudget:n=Vn}={}){let r=Math.max(4,Math.round(Q(t,0))),i=Math.max(0,Math.round(Q(n,Vn)));if(i>0&&r>i)return{status:`candidate-readback-budget-exceeded`,reason:`material-interface candidate rows byte length ${r} exceeds readback budget ${i}`,byteLength:r,budget:i};let a=Ei(e);if(a!=null&&r>a)return{status:`candidate-readback-max-buffer-size-exceeded`,reason:`material-interface candidate rows byte length ${r} exceeds WebGPU device maxBufferSize ${a}`,byteLength:r,maxBufferSize:a};let o=Di(e);return o!=null&&r>o?{status:`candidate-readback-max-storage-binding-size-exceeded`,reason:`material-interface candidate rows byte length ${r} exceeds WebGPU device maxStorageBufferBindingSize ${o}`,byteLength:r,maxStorageBufferBindingSize:o}:null}function Ri({sourceField:e,sourceRenderField:t,resolvedFieldRowsBuffer:n,resolvedSurfaceBuffer:r,source:i,sourceCadence:a,candidateRowsByteLength:o,candidateReadbackByteBudget:c,candidateReadbackBlocker:l,candidateReadbackMode:u,compactCandidateField:d=null}){let f={schema:S,status:`material-interface-field-candidate-readback-skipped`,reason:l.reason,backend:`webgpu-candidate-readback-skipped`,authority:`resident-physics-material-interface-extractor`,source:i,sourceCadence:a,sourceFieldSchema:e?.schema??null,sourceFieldStatus:e?.status??null,sourceFieldBackend:e?.backend??null,sourceFieldPipelineCacheStatus:e?.sourceRenderFieldPipelineCacheStatus??e?.pipelineCacheStatus??null,sourceRenderFieldSchema:t?.schema??null,sourceRenderFieldBackend:t?.backend??null,sourceRenderFieldPipelineCacheStatus:t?.pipelineCacheStatus??e?.sourceRenderFieldPipelineCacheStatus??null,sourceRenderFieldReadback:!!t?.renderFieldReadback,sourceFieldRowsBufferBound:!!n,sourceSurfaceBufferBound:!!r,surfaceCount:t?.surfaceCount??0,readySurfaceCount:0,totalSurfaceAreaM2:0,candidateCount:Math.max(0,Math.round(Q(t?.totalFieldCells,0)))*3,activeCandidateCount:0,candidateBackend:d?.backend??null,candidateReadback:!1,candidateReadbackMode:u,candidateRowsByteLength:o,candidateReadbackByteBudget:c,candidateReadbackBlockerStatus:l.status,candidateReadbackBlocker:l,candidateCompactStatus:d?.status??null,candidateCompactOverflowCount:d?.compactCandidateOverflowCount??0,candidateCompactCapacity:d?.compactCandidateCapacity??null,elementCount:0,elementLayout:[...s],elementStrideFloats:Bn,elementRows:new Float32Array,elements:[],forceCouplingStatus:`blocked-material-interface-candidate-readback-skipped`,surfaces:[],queueCompletionStatus:`not-submitted-candidate-readback-skipped`,queueCompletionMethod:null,normalDerivation:`candidate-readback-skipped-budget-or-device-limit`,surfaceAreaDerivation:`candidate-readback-skipped-budget-or-device-limit`,physicsStage:`material-interface-extraction`,pressureInterfaceProducer:!1,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1};return d?.interfaceSourceKeyBuffer&&(f.interfaceSourceKeyBuffer=d.interfaceSourceKeyBuffer,f.interfaceSourceKeyBufferRetained=!!d.interfaceSourceKeyBufferRetained,f.interfaceSourceKeyBufferByteLength=d.interfaceSourceKeyBufferByteLength??0),typeof d?.destroyMaterialInterfaceCandidateFieldBuffers==`function`&&(f.destroyMaterialInterfaceFieldBuffers=({reason:e=`skipped-material-interface-field-buffer-cleanup`}={})=>d.destroyMaterialInterfaceCandidateFieldBuffers({reason:e})),f}function zi({sourceField:e,sourceRenderField:t,resolvedFieldRowsBuffer:n,resolvedSurfaceBuffer:r,source:i,sourceCadence:a,candidateRowsByteLength:o,candidateReadbackByteBudget:c,candidateReadbackMode:l,compactCandidateCapacity:u=null}){let d=t?.surfaceTable?.surfaceCount??t?.surfaceCount??0,f=Math.max(0,Math.round(Q(t?.totalFieldCells,0)))*3,p=wa({candidateCount:f,surfaceCount:d,compactCandidateCapacity:u}),m=p*zn*Float32Array.BYTES_PER_ELEMENT;return{schema:S,status:`material-interface-field-gpu-resident-summary-pending`,reason:`candidate rows remain GPU-resident; CPU material-interface elements require compact readback or a GPU pressure consumer`,backend:`webgpu-gpu-resident-summary`,authority:`resident-physics-material-interface-extractor`,source:i,sourceCadence:a,sourceFieldSchema:e?.schema??null,sourceFieldStatus:e?.status??null,sourceFieldBackend:e?.backend??null,sourceFieldPipelineCacheStatus:e?.sourceRenderFieldPipelineCacheStatus??e?.pipelineCacheStatus??null,sourceRenderFieldSchema:t?.schema??null,sourceRenderFieldBackend:t?.backend??null,sourceRenderFieldPipelineCacheStatus:t?.pipelineCacheStatus??e?.sourceRenderFieldPipelineCacheStatus??null,sourceRenderFieldReadback:!!t?.renderFieldReadback,sourceFieldRowsBufferBound:!!n,sourceSurfaceBufferBound:!!r,surfaceCount:d,readySurfaceCount:0,totalSurfaceAreaM2:0,candidateCount:f,activeCandidateCount:0,activeCandidateCountPending:!0,candidateBackend:`gpu-resident-summary`,candidateReadback:!1,candidateReadbackMode:l,candidateRowsByteLength:o,candidateDenseRowsByteLength:o,candidateCompactRowsByteLength:m,candidateCompactCapacity:p,candidateCompactOverflowCount:0,candidateCompactFallbackStatus:null,candidateMetadataReadback:!1,candidateReadbackByteBudget:c,candidatePipelineCacheStatus:null,elementCount:0,elementLayout:[...s],elementStrideFloats:Bn,elementRows:new Float32Array,elements:[],forceCouplingStatus:`blocked-gpu-resident-pressure-interface-consumer-required`,surfaces:[],queueCompletionStatus:`not-submitted-gpu-resident-summary`,queueCompletionMethod:null,normalDerivation:`gpu-resident-candidate-summary-pending`,surfaceAreaDerivation:`gpu-resident-candidate-summary-pending`,physicsStage:`material-interface-extraction`,pressureInterfaceProducer:!1,gpuAuthoritativeState:!0,gpuResidentMaterialInterfaceSummary:!0,gpuResidentMaterialInterfaceSummaryPending:!0,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1}}function Bi({particleCount:e,renderDomainBaseCount:t=0,renderDomainDropCount:n=0,hasMechanics:r=!1,maxSupportRadiusM:i=0,maxGasRadiusM:a=0,materialBankParticleSizeRowCount:o=0}={}){let s=new ArrayBuffer(pr),c=new DataView(s);return c.setUint32(0,e,!0),c.setUint32(4,Math.max(0,Math.round(Q(t,0))),!0),c.setUint32(8,Math.max(0,Math.round(Q(n,0))),!0),c.setUint32(12,+!!r,!0),c.setFloat32(16,Math.max(0,Q(i,0)),!0),c.setFloat32(20,Math.max(0,Q(a,0)),!0),c.setUint32(24,Math.max(0,Math.round(Q(o,0))),!0),s}function Vi({rowCount:e=0,bufferSource:t=`none`}={}){let n=Math.max(0,Math.round(Q(e,0)));return{schema:hr,status:n>0?`shader-bound-material-bank-particle-size-rows`:`no-material-bank-particle-size-rows`,rowCount:n,shaderBinding:5,bufferSource:n>0?t:`none`,consumer:`sph-render-rows-wgsl`,consumedAs:`non-authoritative-role-rest-volume-seed-before-mechanics`,strictSourceOfTruth:!1,mechanicsOverridePreserved:!0,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Hi({particleCount:e,productEventCount:t=0,surfaceCount:n,totalFieldCells:r,fieldPadding:i,refEdgeM:a,renderSmearDtS:o=0,dispersedMediumOpticsEnabled:s=!1}){let c=new ArrayBuffer(32),l=new DataView(c);return l.setUint32(0,e,!0),l.setUint32(4,n,!0),l.setUint32(8,r,!0),l.setUint32(12,t,!0),l.setFloat32(16,i,!0),l.setFloat32(20,a,!0),l.setFloat32(24,Math.max(0,Number(o)||0),!0),l.setUint32(28,+!!s,!0),c}function Ui(e=null){let t=new Uint32Array(8);return e?(t[0]=1,t[1]=e.expectedMagic,t[2]=e.expectedVersion,t[3]=e.expectedReadyStatus,t[4]=e.expectedGeneration,t[5]=e.expectedSeal,t[6]=e.expectedRowCapacity,t[7]=e.expectedRowStrideVec4,t):t}function Wi({surfaceCount:e,totalFieldCells:t,candidateCount:n,fieldPadding:r,refEdgeM:i,isolationScale:a,sourceKeyEnabled:o=!1}){let s=new ArrayBuffer(32),c=new DataView(s);return c.setUint32(0,e,!0),c.setUint32(4,t,!0),c.setUint32(8,n,!0),c.setUint32(12,+!!o,!0),c.setFloat32(16,r,!0),c.setFloat32(20,i,!0),c.setFloat32(24,a,!0),c.setFloat32(28,0,!0),s}function Gi({surfaceCount:e,totalFieldCells:t,maxVertexRows:n,emissionModeId:r=0,fieldPadding:i,refEdgeM:a,isolationScale:o}){let s=new ArrayBuffer(32),c=new DataView(s);return c.setUint32(0,e,!0),c.setUint32(4,n,!0),c.setUint32(8,t,!0),c.setUint32(12,r,!0),c.setFloat32(16,i,!0),c.setFloat32(20,a,!0),c.setFloat32(24,o,!0),c.setFloat32(28,0,!0),s}function Ki({surfaceCount:e,totalFieldCells:t,fieldPadding:n,refEdgeM:r,isolationScale:i}){let a=new ArrayBuffer(32),o=new DataView(a);return o.setUint32(0,e,!0),o.setUint32(4,t,!0),o.setUint32(8,0,!0),o.setUint32(12,0,!0),o.setFloat32(16,n,!0),o.setFloat32(20,r,!0),o.setFloat32(24,i,!0),o.setFloat32(28,0,!0),a}function qi({surfaceCount:e,sourceVertexRowCount:t,maxCompactVertexRows:n,sourceVertexCounterMode:r=0}){let i=new ArrayBuffer(16),a=new DataView(i);return a.setUint32(0,e,!0),a.setUint32(4,t,!0),a.setUint32(8,n,!0),a.setUint32(12,r,!0),i}async function Ji(e,t,n,r=`ulg-sph-render-readback`){ki(e,r,Math.max(4,n));let i=e.createBuffer({label:r,size:Math.max(4,n),usage:Z.MAP_READ|Z.COPY_DST}),a=!1;try{let r=e.createCommandEncoder();return r.copyBufferToBuffer(t,0,i,0,n),e.queue.submit([r.finish()]),await i.mapAsync(Er.READ),a=!0,i.getMappedRange().slice(0)}finally{a&&i.unmap(),i.destroy?.()}}function Yi(){return{min:[1/0,1/0,1/0],max:[-1/0,-1/0,-1/0]}}function Xi(e){return e&&e.min.every(Number.isFinite)&&e.max.every(Number.isFinite)?{min:[...e.min],max:[...e.max]}:null}function Zi(e,t){for(let n=0;n<3;n+=1){let r=Q(t?.[n],NaN);Number.isFinite(r)&&(e.min[n]=Math.min(e.min[n],r),e.max[n]=Math.max(e.max[n],r))}}function Qi(e,t){return`${Math.round(Q(e,0))}:${Math.round(Q(t,0))}`}function $i({state:e,thermo:t,particleCount:n,maxSampleRows:r=8}={}){let i=Yi(),a={},o=[],s=0,c=0,l=0,u=0,d=1/0,f=-1/0;for(let p=0;p<n;p+=1){let n=p*H,m=p*se,h=[Q(e?.[n],NaN),Q(e?.[n+1],NaN),Q(e?.[n+2],NaN)],g=Q(e?.[n+3],0),_=Q(t?.[m],0),v=Q(t?.[m+1],0),y=Q(t?.[m+2],NaN),b=Q(t?.[m+10],0);h.every(Number.isFinite)&&(s+=1,Zi(i,h),h.every(e=>Math.abs(e)<=1e-12)&&(c+=1)),g>0&&(l+=1,u+=g),Number.isFinite(y)&&(d=Math.min(d,y),f=Math.max(f,y));let x=Qi(_,v);a[x]=(a[x]||0)+1,o.length<r&&o.push({index:p,positionM:h,massKg:g,materialId:_,phaseId:v,temperatureK:Number.isFinite(y)?y:null,status:b})}return{particleCount:n,finitePositionCount:s,zeroPositionCount:c,positiveMassCount:l,totalMassKg:u,boundsM:Xi(i),minTemperatureK:Number.isFinite(d)?d:null,maxTemperatureK:Number.isFinite(f)?f:null,materialPhaseCounts:a,sampleRows:o}}function ea(e,{maxSampleRows:t=8}={}){let n=e instanceof Float32Array?Math.floor(e.length/kn):0,r=Yi(),i={},a=[],o=0,s=0,c=0,l=0,u=1/0,d=-1/0,f=1/0,p=-1/0;for(let m=0;m<n;m+=1){let n=m*kn,h=[Q(e[n],NaN),Q(e[n+1],NaN),Q(e[n+2],NaN)],g=Q(e[n+3],0),_=Q(e[n+4],0),v=Q(e[n+5],0),y=Q(e[n+6],NaN),b=Q(e[n+7],0),x=Q(e[n+13],NaN);h.every(Number.isFinite)&&(o+=1,Zi(r,h),h.every(e=>Math.abs(e)<=1e-12)&&(s+=1)),g>0&&(c+=1,l+=g),Number.isFinite(y)&&(u=Math.min(u,y),d=Math.max(d,y)),Number.isFinite(x)&&x>0&&(f=Math.min(f,x),p=Math.max(p,x));let S=Qi(_,v);i[S]=(i[S]||0)+1,a.length<t&&a.push({index:m,positionM:h,massKg:g,materialId:_,phaseId:v,temperatureK:Number.isFinite(y)?y:null,status:b,particleRadiusM:Number.isFinite(x)?x:null})}return{particleCount:n,finitePositionCount:o,zeroPositionCount:s,positiveMassCount:c,totalMassKg:l,boundsM:Xi(r),minTemperatureK:Number.isFinite(u)?u:null,maxTemperatureK:Number.isFinite(d)?d:null,minParticleRadiusM:Number.isFinite(f)?f:null,maxParticleRadiusM:Number.isFinite(p)?p:null,materialPhaseCounts:i,sampleRows:a}}async function ta({device:e,sphParticleState:t,sphParticleUpload:n=null,sourceStateBuffer:r=null,sourceThermoBuffer:i=null,renderDomainBaseCount:a=0,renderDomainDropCount:o=0,includeRenderRows:s=!0,maxSampleRows:c=8}={}){if(Or(t),!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`summarizeSphResidentParticleUploadWebGpu requires a WebGPU-like device`);let l=r||n?.stateBuffer||null,u=i||n?.thermoBuffer||null;if(!l||!u)return{schema:`peercompute.ulg.sph-resident-particle-upload-debug.v0`,status:`resident-particle-upload-debug-source-unavailable`,reason:`retained state and thermo buffers are required`,particleCount:t.particleCount,uploadStatus:n?.status??null,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};let d=Math.max(0,Math.round(Q(t.particleCount,0))),f=d*H*Float32Array.BYTES_PER_ELEMENT,p=d*se*Float32Array.BYTES_PER_ELEMENT,[m,h]=await Promise.all([Ji(e,l,f,`ulg-sph-resident-debug-state-readback`),Ji(e,u,p,`ulg-sph-resident-debug-thermo-readback`)]),g=$i({state:new Float32Array(m).slice(0,d*H),thermo:new Float32Array(h).slice(0,d*se),particleCount:d,maxSampleRows:c}),_=null,v=null;if(s)try{_=ea((await Ga({device:e,sphParticleState:t,sphParticleUpload:n,sourceStateBuffer:l,sourceThermoBuffer:u,readbackMode:vr,renderDomainBaseCount:a,renderDomainDropCount:o})).renderRows,{maxSampleRows:c})}catch(e){v=e instanceof Error?e.message:String(e)}return{schema:`peercompute.ulg.sph-resident-particle-upload-debug.v0`,status:v?`resident-particle-upload-debug-render-rows-error`:`resident-particle-upload-debug-ready`,uploadStatus:n?.status??null,sourceStep:n?.step??t.step??null,sourceTime:n?.time??t.time??null,particleCount:d,readbackByteLength:f+p,stateBufferLabel:l?.label??null,thermoBufferLabel:u?.label??null,particleRows:g,renderRows:_,renderRowsError:v,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function na(e=[],{defaultResolution:t=32,defaultIsolation:n=80,defaultSubtract:r=24}={}){if(!Array.isArray(e))throw TypeError(`surfaceDescriptors must be an array`);let i=new Float32Array(e.length*An),a=[],o=0,s=0;return e.forEach((e,c)=>{let l=Pr(Math.max(4,Math.round(Q(e.resolution,t))),`surfaceDescriptors[${c}].resolution`,{min:4}),u=Pr(l**3,`surfaceDescriptors[${c}].fieldCellCount`,{min:1});o=Pr(o,`surfaceDescriptors[${c}].fieldOffset`);let d=Q(e.isolation,n),f=Math.max(1e-12,Q(e.subtract,r)),p=ti(Q(e.radiusNorm,.05),.001,.5),m=Number.isFinite(e.strength)?e.strength:(d+f)*p*p,h=Array.isArray(e.colorLinear)||ArrayBuffer.isView(e.colorLinear)?e.colorLinear:[1,1,1],g=Nr(e.materialId??(e.material?U(e.material):0),`surfaceDescriptors[${c}].materialId`),_=Nr(e.phaseId??(e.phase?V(e.phase):L.unknown),`surfaceDescriptors[${c}].phaseId`),v=Nr(e.renderDomainId??0,`surfaceDescriptors[${c}].renderDomainId`),y=e.opticalState||null,b=Nr(e.opticalStateId??R(y),`surfaceDescriptors[${c}].opticalStateId`),x=b>0;if((e.collectiveOpticalRoute===!0||e.collectiveOpticalRouteSchema)&&!x)throw RangeError(`surfaceDescriptors[${c}] collective optical route requires a positive opticalStateId`);for(let[t,n]of[[`collectiveOpticalRouteId`,e.collectiveOpticalRouteId],[`routeId`,e.routeId]])if(n!=null&&Number(n)!==b)throw RangeError(`surfaceDescriptors[${c}].${t} contradicts opticalStateId`);let S=e.opticalStateKey??W(y),C=c*An;i.set([g,_,o,u,l,d,f,m,Math.max(0,Q(e.particleRadiusScale,0))>0?-Math.max(0,Q(e.particleRadiusScale,0)):p,ti(Q(h[0],1),0,1),ti(Q(h[1],1),0,1),ti(Q(h[2],1),0,1),v,b,Number.isFinite(Number(e.transparencyClassId))?Number(e.transparencyClassId):-1,Number.isFinite(Number(e.depthWriteFlag))?Number(e.depthWriteFlag):-1],C);let w=i.subarray(C,C+An),T=w[8]<0?-w[8]:0,E=ja({...e,index:c,phaseId:_}),D={index:c,surfaceKey:e.surfaceKey??`${g}|${_}`,material:e.material??null,phase:e.phase??null,renderKey:e.renderKey??e.material??null,opticalState:y?{...y}:null,opticalStateKey:S,opticalStateId:w[13],surfaceIdentityKey:e.surfaceIdentityKey??(x?e.surfaceKey??null:null),collectiveOpticalRoute:x,collectiveOpticalRouteSchema:x?e.collectiveOpticalRouteSchema??e.schema??null:null,collectiveOpticalRouteKey:e.collectiveOpticalRouteKey??e.routeKey??e.surfaceIdentityKey??(x?e.surfaceKey:null)??null,collectiveOpticalRouteId:x?w[13]:null,opticalResponseAuthorityFlag:+(Q(e.opticalResponseAuthorityFlag,0)>0),opticalResponseAuthority:e.opticalResponseAuthority??null,opticalResponseReady:e.opticalResponseReady===!0,opticalVisibilityFlag:+(Q(e.opticalVisibilityFlag,1)>0),opticalVisibilityReason:e.opticalVisibilityReason??null,opticalOpacity:e.opticalOpacity!=null&&Number.isFinite(Number(e.opticalOpacity))?ti(Number(e.opticalOpacity),0,1):null,opticalEffectiveOpacity:e.opticalEffectiveOpacity!=null&&Number.isFinite(Number(e.opticalEffectiveOpacity))?ti(Number(e.opticalEffectiveOpacity),0,1):null,opticalDepth:e.opticalDepth!=null&&Number.isFinite(Number(e.opticalDepth))?Math.max(0,Number(e.opticalDepth)):null,opticalScatteringCoefficientPerM:e.opticalScatteringCoefficientPerM!=null&&Number.isFinite(Number(e.opticalScatteringCoefficientPerM))?Math.max(0,Number(e.opticalScatteringCoefficientPerM)):null,opticalTransmission:e.opticalTransmission!=null&&Number.isFinite(Number(e.opticalTransmission))?ti(Number(e.opticalTransmission),0,1):null,opticalRoughness:e.opticalRoughness!=null&&Number.isFinite(Number(e.opticalRoughness))?ti(Number(e.opticalRoughness),0,1):null,opticalBlockedFlag:+(Q(e.opticalBlockedFlag,0)>0),opticalProvenanceSource:e.opticalProvenanceSource??null,renderDomainId:w[12],renderDomainKey:e.renderDomainKey??si(e.renderDomainId),renderLayer:e.renderLayer??E.renderLayer,renderOrder:E.renderOrder,transparencyClassId:E.transparencyClassId,depthWriteFlag:E.depthWriteFlag,emissiveTemperatureK:Math.max(0,Q(e.emissiveTemperatureK,0)),materialId:w[0],phaseId:w[1],fieldOffset:w[2],fieldCellCount:w[3],resolution:w[4],isolation:w[5],subtract:w[6],strength:w[7],radiusNorm:p,particleRadiusScale:T,particleRadiusPolicyStatus:e.particleRadiusPolicyStatus??null,particleRadiusPolicyMode:e.particleRadiusPolicyMode??null,particleRadiusContinuityFloorEligible:e.particleRadiusContinuityFloorEligible===!0,particleRadiusContinuityFloorApplied:e.particleRadiusContinuityFloorApplied===!0,particleRadiusScaleRequested:e.particleRadiusScaleRequested??null,particleRadiusContinuityFloorScale:e.particleRadiusContinuityFloorScale??null,particleRadiusContinuityFloorScaleUnbounded:e.particleRadiusContinuityFloorScaleUnbounded??null,particleRadiusContinuityRepresentativeRadiusM:e.particleRadiusContinuityRepresentativeRadiusM??null,particleRadiusContinuitySmoothingLengthM:e.particleRadiusContinuitySmoothingLengthM??null,particleRadiusContinuitySupportMultiplier:e.particleRadiusContinuitySupportMultiplier??null,particleRadiusContinuitySupportTargetIsoradiusM:e.particleRadiusContinuitySupportTargetIsoradiusM??null,particleRadiusContinuitySamplingCellSizeM:e.particleRadiusContinuitySamplingCellSizeM??null,particleRadiusContinuitySamplingMarginM:e.particleRadiusContinuitySamplingMarginM??null,particleRadiusContinuityTargetIsoradiusM:e.particleRadiusContinuityTargetIsoradiusM??null,particleRadiusFloorNorm:T>0?Math.sqrt(.75/(l*l)+1e-6):0,colorLinear:[w[9],w[10],w[11]],status:Q(e.status,1)};a.push(D),o=Pr(o+u,`surfaceDescriptors[${c}].nextFieldOffset`),s=Math.max(s,u)}),{schema:d,status:`render-field-surface-table-built`,surfaceCount:e.length,rowLayout:[...N],rowStrideFloats:An,records:i,metadata:a,totalFieldCells:o,maxFieldCellCount:s,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function ra(e){if(e?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`||!(e.records instanceof Float32Array)||!Array.isArray(e.metadata)||!Number.isSafeInteger(e.surfaceCount)||e.surfaceCount!==e.metadata.length||e.records.length!==e.surfaceCount*An)throw TypeError(`SPH render field requires a render-field surface table`);let t=0,n=0;for(let r=0;r<e.surfaceCount;r+=1){let i=e.metadata[r];if(Fr(i?.index,`surfaceTable.metadata[${r}].index`)!==r)throw RangeError(`render surface metadata index ${i?.index} does not match array index ${r}`);let a=r*An,o=e.records.subarray(a,a+An);if(o.some(e=>!Number.isFinite(e)))throw RangeError(`render surface ${r} contains a non-finite encoded lane`);let s=Pr(i?.resolution,`surfaceTable.metadata[${r}].resolution`,{min:4}),c=Pr(i?.fieldCellCount,`surfaceTable.metadata[${r}].fieldCellCount`,{min:1}),l=Pr(i?.fieldOffset,`surfaceTable.metadata[${r}].fieldOffset`);if(c!==s**3||l!==t)throw RangeError(`render surface ${r} has inconsistent field geometry`);let u=i.particleRadiusScale>0?-i.particleRadiusScale:i.radiusNorm;if([i.materialId,i.phaseId,l,c,s,i.isolation,i.subtract,i.strength,u,i.colorLinear?.[0],i.colorLinear?.[1],i.colorLinear?.[2],i.renderDomainId,i.opticalStateId].some((e,t)=>!Number.isFinite(Number(e))||!Object.is(o[t],Math.fround(Number(e)))))throw RangeError(`render surface ${r} metadata does not match its encoded routing/geometry lanes`);let d=o[14]>=0?o[14]:Aa(o[1]),f=o[15]>=0?o[15]:d>0?0:1;if(Math.fround(Number(i.transparencyClassId))!==Math.fround(d)||Math.fround(Number(i.depthWriteFlag))!==Math.fround(f))throw RangeError(`render surface ${r} metadata does not match its encoded render policy`);t=Pr(t+c,`surfaceTable.metadata[${r}].nextFieldOffset`),n=Math.max(n,c)}if(e.totalFieldCells!==t||e.maxFieldCellCount!==n)throw RangeError(`render surface table aggregate geometry is inconsistent`)}function ia(e,t,n,r){let i=Math.fround(1-Math.fround(2*n)),a=Math.fround(.001),o=Math.fround(.999),s=t=>{let s=Math.fround(e[t]/r),c=Math.fround(s*i);return ti(Math.fround(n+c),a,o)};return[s(t),s(t+1),s(t+2)]}function aa(e,t){return!(e>0)||e===t}function oa(e,t){let n=Math.max(0,Math.round(Q(t,0)));return n<=0?!0:Math.round(Q(e,0))===n}function sa(e,n){let r=e[n],i=e[n+1],a=e[n+2],o=e[n+3],s=e[n+4],c=e[n+5],l=e[n+6],u=e[n+7];return o===t.ready&&Number.isFinite(r)&&Number.isSafeInteger(r)&&r>=0&&r<=Dr&&Number.isFinite(i)&&Number.isSafeInteger(i)&&i>=0&&i<=Dr&&Number.isFinite(a)&&Number.isSafeInteger(a)&&a>0&&a<=Dr&&Number.isFinite(s)&&s>=0&&Number.isFinite(c)&&c>=0&&Number.isFinite(l)&&l>=0&&Number.isFinite(u)&&Math.abs(u)<=c}function ca(e,n){if(e==null)return null;if(!(e instanceof Float32Array))throw TypeError(`dispersed-medium optics rows must be a Float32Array`);let r=n*8;if(e.length!==r)throw RangeError(`dispersed-medium optics rows must contain exactly ${n} particle-aligned rows`);let i=new Set;for(let r=0;r<n;r+=1){let n=r*8;if(e[n+3]===t.blocked){for(let t=0;t<8;t+=1)if(t!==3&&e[n+t]!==0)throw RangeError(`dispersed-medium blocked row ${r} must have zero data lanes`);continue}if(!sa(e,n))throw RangeError(`dispersed-medium row ${r} is neither canonical ready nor canonical blocked`);i.add(e[n+2])}return i}function la(e,t=[]){let n=new Map;for(let[t,r]of e.metadata.entries()){let e=Nr(r.opticalStateId??0,`surfaceTable.metadata[${t}].opticalStateId`);if(e!==0){if(n.has(e))throw RangeError(`dispersed-medium opticalStateId ${e} routes to more than one render surface`);n.set(e,t)}}for(let r of t){if(!n.has(r)){let t=e.metadata.map(e=>`${e?.material??`?`}/${e?.phase??`?`}=${e?.opticalStateId??0}`).slice(0,12).join(`, `);throw RangeError(`ready dispersed-medium opticalStateId ${r} has no render surface route (routed: ${t})`)}let t=e.metadata[n.get(r)],i=Math.fround(Number(t?.isolation));if(!(i>=Gn)||!Number.isFinite(i))throw RangeError(`ready dispersed-medium opticalStateId ${r} requires a positive finite f32 isolation threshold outside the denormal range`)}return n}function ua(e,t,n,r){let i=new Set(r),a=Math.fround(1-Math.fround(2*t));for(let t of e.metadata){if(!i.has(t.opticalStateId))continue;let e=Math.fround(a*Math.fround(t.resolution));if(!(Math.fround(e/n)>=Kn))throw RangeError(`dispersed-medium cell scale enters the implementation-defined f32 denormal range`)}}function da(e,t,n){let r=Math.fround(ti(t,0,1)*Math.fround(n)),i=e=>Math.max(0,Math.fround(1-Math.abs(Math.fround(Math.fround(e)-r)))),a=i(e);return e===0&&(a=Math.fround(a+i(-1))),e===n-1&&(a=Math.fround(a+i(n))),Math.min(1,a)}function fa(e,t,n){let r=da(e[0],t[0],n),i=da(e[1],t[1],n),a=da(e[2],t[2],n);return Math.fround(Math.fround(r*i)*a)}function pa({rows:e,offset:t,cellIndex:n,particle:r,resolution:i,fieldPadding:a,refEdgeM:o}){let s=fa(n,r,i);if(!(s>0))return null;let c=Math.fround(1-Math.fround(2*a)),l=Math.fround(c*Math.fround(i)),u=Math.min(Wn,Math.fround(l/o));return{scattering:Hr(e[t+5],s,u),absorption:Hr(e[t+6],s,u),scatteringAsymmetry:Ur(e[t+7],s,u)}}function ma(e,t,n,r){let i=ti(Q(n,0),0,1),a=ti(Q(r,0),0,1),o=ti(1-i-a,0,1);return e===1?a:e===2?o:e===3?i:+(t===e)}function ha({phaseWeight:e,materialId:t,surfacePhaseId:n,carrierMassKg:r,dispersedRows:i,offset:a}){if(!i||!sa(i,a)||i[a]!==t||i[a+1]!==n||!Number.isFinite(r)||!(r>0))return e;let o=Math.min(i[a+4],r)/r;return Math.max(0,e-o)}function ga({fullStrength:e,phaseWeight:t,isolation:n,subtract:r}){let i=ti(Q(t,0),0,1),a=Math.cbrt(i*i),o=Math.max(0,Q(n,0)+Q(r,0))*1e-6;return Q(e,0)*a+o*(1-a)}function _a(e,t){return Math.sqrt(Math.max(Q(e,0)/Math.max(Q(t,0),1e-12)-1e-6,0))}function va({cell:e,position:t,strength:n,subtract:r,supportNorm:i,color:a,density:o,palette:s,distanceSqOffset:c=0}){let l=e[0]-t[0],u=e[1]-t[1],d=e[2]-t[2],f=l*l+u*u+d*d+c,p=n/(1e-6+f)-r;if(p<=0)return{density:o,palette:s};let m=ti(Math.sqrt(f)/Math.max(i,1e-6),0,1),h=1-m**3*(m*(m*6-15)+10);return{density:o+p,palette:[s[0]+a[0]*h,s[1]+a[1]*h,s[2]+a[2]*h]}}function ya({renderRows:e,dispersedMediumOpticsRows:t=null,productEventRows:n=null,surfaceTable:r,particleCount:i=null,productEventCount:a=null,fieldPadding:o=.22,refEdgeM:s=10,renderSmearDtS:c=0}={}){if(!(e instanceof Float32Array))throw TypeError(`buildSphRenderFieldCpu requires Float32Array render rows`);if(e.length%kn!==0)throw RangeError(`SPH render rows length must align to the render row stride`);if(n&&(!(n instanceof Float32Array)||n.length%Nn!==0))throw RangeError(`SPH product-event rows length must align to the product-event row stride`);ra(r),{fieldPadding:o,refEdgeM:s}=Ir(o,s);let l=e.length/kn,u=Fr(i??l,`particleCount`);if(u!==l)throw RangeError(`particleCount must exactly match the particle-aligned host render rows`);let f=n?.length?n.length/Nn:0,p=Fr(a??f,`productEventCount`);if(p!==f)throw RangeError(`productEventCount must exactly match the host product-event rows`);let m=ca(t,u);la(r),t&&(la(r,m),ua(r,o,s,m));let h=new Float32Array(r.totalFieldCells*jn);for(let i of r.metadata){let r=i.resolution,a=Math.sqrt(Math.abs(i.strength)/Math.max(i.subtract,1e-12)),l=Math.max(0,Q(i.particleRadiusScale,0)),d=Math.max(0,Q(i.particleRadiusFloorNorm,0)),f=1-2*o,m=Math.max(s,1e-12),g=l*f/m;for(let f=0;f<i.fieldCellCount;f+=1){let m=r*r,_=Math.floor(f/m),v=f-_*m,y=Math.floor(v/r),b=v-y*r,x=[b/r,y/r,_/r],S=0,C=[0,0,0],w=0,T=0,E=i.opticalStateId>0,D=0,O=0,k={positive:{mantissa:0,exponent:0,nonzero:!1},negative:{mantissa:0,exponent:0,nonzero:!1}},A={weight:{mantissa:0,exponent:0,nonzero:!1},weightedTemperature:{mantissa:0,exponent:0,nonzero:!1}};if(t)for(let n=0;n<u;n+=1){let a=n*8;if(!sa(t,a)||t[a+2]!==i.opticalStateId)continue;let c=n*kn,l=ia(e,c,o,s),u=pa({rows:t,offset:a,cellIndex:[b,y,_],particle:l,resolution:r,fieldPadding:o,refEdgeM:s});u&&(D=Lr(D,u.scattering),O=Lr(O,u.absorption),k=Yr(k,u.scatteringAsymmetry),A=$r(A,e[c+6],u.scattering),A=$r(A,e[c+6],u.absorption))}let j=ti(Xr(k),-D,D),M=[0,0,0],N=0,P=n=>{let r={density:0,palette:[0,0,0],temperatureWeighted:0,temperatureWeight:0,accumulateMoments:n===0};for(let a=0;a<u;a+=1){let c=a*kn,u=e[c+4],f=e[c+5],p=e[c+11];if(u!==i.materialId||!oa(p,i.renderDomainId))continue;let m=ha({phaseWeight:ma(i.phaseId,f,e[c+9],e[c+16]),materialId:u,surfacePhaseId:i.phaseId,carrierMassKg:e[c+3],dispersedRows:t,offset:a*8});if(m<=0)continue;let h=ia(e,c,o,s),_=Q(e[c+13],0),v=l>0&&_>0?Math.max(_*g,d):0,y=ga({fullStrength:v>0?(i.isolation+i.subtract)*v**2:i.strength,phaseWeight:m,isolation:i.isolation,subtract:i.subtract}),b=_a(y,i.subtract),S=va({cell:x,position:h,strength:y,subtract:i.subtract,supportNorm:b,color:i.colorLinear,density:r.density,palette:r.palette,distanceSqOffset:n}),C=S.density-r.density;if(C>0&&(r.temperatureWeighted+=e[c+6]*C,r.temperatureWeight+=C,r.accumulateMoments)){let t=e[c+17],n=e[c+18],r=e[c+19];M[0]+=t*C,M[1]+=n*C,M[2]+=r*C,N+=(t*t+n*n+r*r)*C}r.density=S.density,r.palette=S.palette}return r},F=Lr(D,O),I=E?{density:Rr(Math.max(0,i.isolation),F),palette:F>0?[...i.colorLinear]:[0,0,0],temperatureWeighted:0,temperatureWeight:A.weight.nonzero?A.weight.mantissa:0}:P(0);if(!E&&I.temperatureWeight>0&&c>0){let e=I.temperatureWeight,t=[M[0]/e,M[1]/e,M[2]/e],n=Math.max(0,N/e-(t[0]**2+t[1]**2+t[2]**2)),r=1-2*o,i=Math.sqrt(n)*c*r/Math.max(s,1e-12),a=i*i;a>1e-10&&(I=P(a))}S=I.density,C=I.palette,w=I.temperatureWeighted,T=I.temperatureWeight;for(let e=0;!E&&e<p&&n;e+=1){let t=e*Nn,r=n[t+18],c=n[t+4],l=n[t+11],u=n[t+13];if(r!==1||!(u>0)||c!==i.materialId||!aa(l,i.phaseId))continue;let d=va({cell:x,position:[ti(o+n[t]/Math.max(s,1e-12)*(1-2*o),.001,.999),ti(o+n[t+1]/Math.max(s,1e-12)*(1-2*o),.001,.999),ti(o+n[t+2]/Math.max(s,1e-12)*(1-2*o),.001,.999)],strength:i.strength,subtract:i.subtract,supportNorm:a,color:i.colorLinear,density:S,palette:C});S=d.density,C=d.palette}let L=(i.fieldOffset+f)*jn;h[L]=S,h[L+1]=C[0],h[L+2]=C[1],h[L+3]=C[2],h[L+4]=E?ei(A):T>0?w/T:0,h[L+5]=D,h[L+6]=O,h[L+7]=j}}return{schema:d,backend:`cpu-reference`,status:`render-field-built`,kernelScope:_r,particleCount:u,dispersedMediumOpticsBound:!!t,dispersedMediumOpticsRowCount:t?u:0,productEventCount:p,surfaceCount:r.surfaceCount,totalFieldCells:r.totalFieldCells,maxFieldCellCount:r.maxFieldCellCount,surfaceTable:r,rowLayout:[...O],rowStrideFloats:jn,fieldRows:h,fieldRowByteLength:h.byteLength,fieldPadding:o,refEdgeM:s,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function ba(e){if(e?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`||!(e.fieldRows instanceof Float32Array))throw TypeError(`splitSphRenderFieldBySurface requires an SPH render field`);return e.surfaceTable.metadata.map(t=>{let n=new Float32Array(t.fieldCellCount),r=new Float32Array(t.fieldCellCount*3);for(let i=0;i<t.fieldCellCount;i+=1){let a=(t.fieldOffset+i)*jn;n[i]=e.fieldRows[a],r[i*3]=e.fieldRows[a+1],r[i*3+1]=e.fieldRows[a+2],r[i*3+2]=e.fieldRows[a+3]}return{...t,field:n,palette:r}})}function xa(e){let t=Math.hypot(e[0],e[1],e[2]);return t>0?[e[0]/t,e[1]/t,e[2]/t]:[0,0,0]}function Sa(e,t,n=1){let r=e.surfaceTable?.metadata||[],i=Array(r.length).fill(0),a=t.length/zn;for(let e=0;e<a;e+=1){let n=e*zn;if(!(t[n+15]>0))continue;let r=Math.round(t[n]);r>=0&&r<i.length&&(i[r]+=1)}return r.map(t=>{let r=t.isolation*Q(n,1),a=0;for(let n=0;n<t.fieldCellCount;n+=1){let i=(t.fieldOffset+n)*jn;e.fieldRows?.[i]>=r&&(a+=1)}let o=i[t.index]||0;return{surfaceKey:t.surfaceKey,material:t.material,phase:t.phase,renderKey:t.renderKey,materialId:t.materialId,phaseId:t.phaseId,opticalStateKey:t.opticalStateKey||`default`,resolution:t.resolution,isolation:r,activeCellCount:a,candidateOffset:t.fieldOffset*3,candidateCount:t.fieldCellCount*3,activeCandidateCount:o,status:o>0?`interface-candidates-active`:a>0?`interface-candidates-active-without-crossing`:`interface-candidates-empty`}})}async function Ca({device:e,renderField:t,fieldRowsBuffer:n=null,surfaceBuffer:i=null,isolationScale:a=1}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphMaterialInterfaceCandidateFieldWebGpu requires a WebGPU-like device`);if(t?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)throw TypeError(`buildSphMaterialInterfaceCandidateFieldWebGpu requires an SPH render field`);if(!n&&!(t.fieldRows instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceCandidateFieldWebGpu requires fieldRows or fieldRowsBuffer`);if(!i&&!(t.surfaceTable?.records instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceCandidateFieldWebGpu requires surface table records or surfaceBuffer`);let o=t.surfaceTable?.surfaceCount??t.surfaceCount??0,s=t.totalFieldCells??0,c=s*3,l=c*zn*Float32Array.BYTES_PER_ELEMENT,d=s*jn*Float32Array.BYTES_PER_ELEMENT,f=o*An*Float32Array.BYTES_PER_ELEMENT,p=Math.ceil(Math.max(1,(t.maxFieldCellCount||0)*3)/64),m=Math.max(1,o);ji(e,`material-interface candidates`,p,m),ki(e,`ulg-sph-interface-candidates`,Math.max(4,l)),ki(e,`ulg-sph-interface-candidate-readback`,Math.max(4,l)),Ai(e,`ulg-sph-interface-candidates`,Math.max(4,l));let h=n||null,g=i||null;Pi(e,`material-interface source render field`,h,d),Pi(e,`material-interface render surfaces`,g,f);let _=h||wi(e,`ulg-sph-interface-source-render-field`,t.fieldRows,Z.COPY_SRC),v=g||wi(e,`ulg-sph-interface-render-surfaces`,t.surfaceTable.records),y=e.createBuffer({label:`ulg-sph-interface-candidates`,size:Math.max(4,l),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST}),b=e.createBuffer({label:`ulg-sph-interface-candidate-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(b,0,Wi({surfaceCount:o,totalFieldCells:s,candidateCount:c,fieldPadding:Q(t.fieldPadding,.22),refEdgeM:Q(t.refEdgeM,10),isolationScale:Q(a,1)}));let{pipeline:x,bindGroupLayout:S}=pe(e,{label:`ulg-sph-interface-candidates`,module:e.createShaderModule({label:`ulg-sph-interface-candidates`,code:u}),entryPoint:`main`,bindings:[q(0,`read-only-storage`),q(1,`read-only-storage`),q(2,`storage`),q(3,`uniform`)]}),C=e.createBindGroup({layout:S,entries:[{binding:0,resource:Fi(v,f,{label:`material-interface render surfaces`})},{binding:1,resource:Fi(_,d,{label:`material-interface source render field`})},{binding:2,resource:Fi(y,l,{label:`material-interface candidates`})},{binding:3,resource:{buffer:b}}]}),w=e.createCommandEncoder(),T=w.beginComputePass();T.setPipeline(x),T.setBindGroup(0,C),T.dispatchWorkgroups(p,m),T.end();let D=`queue-submitted`,O=`queue.submit`;e.queue.submit([w.finish()]);let k=await Ji(e,y,l,`ulg-sph-interface-candidate-readback`);D=`readback-map-completed`,O=`mapAsync(readback-buffer)`;let A=new Float32Array(k);h||_.destroy?.(),g||v.destroy?.(),y.destroy?.(),b.destroy?.();let j=Sa(t,A,a),M=j.reduce((e,t)=>e+t.activeCandidateCount,0);return{schema:E,backend:`webgpu`,status:M>0?`material-interface-candidate-field-ready`:`material-interface-candidate-field-empty`,sourceSchema:t.schema,sourceBackend:t.backend,surfaceCount:o,totalFieldCells:s,candidateCount:c,activeCandidateCount:M,rowLayout:[...r],rowStrideFloats:zn,candidateRows:A,candidateRowByteLength:A.byteLength,candidateShape:`fixed-render-field-cell-axis-triplets`,surfaces:j,fieldRowsBufferBound:!!h,surfaceBufferBound:!!g,queueCompletionStatus:D,queueCompletionMethod:O,candidateReadback:!0,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1}}function wa({candidateCount:e,surfaceCount:t,compactCandidateCapacity:n=null}){let r=Math.round(Q(n,0));if(r>0)return Math.max(1,Math.min(e,r));let i=Math.max(Hn,Math.max(1,Math.round(Q(t,0)))*8192);return Math.max(1,Math.min(e,i))}function Ta(e=null){if(!(e instanceof Float32Array)||e.length<=0)return 0;let t=0;for(let n=0;n+2<e.length;n+=Rn)(e[n+2]||0)>0&&(t+=1);return t}async function Ea({device:e,renderField:t,fieldRowsBuffer:n=null,surfaceBuffer:i=null,sourceIndexFieldBuffer:a=null,isolationScale:o=1,compactCandidateCapacity:s=null}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires a WebGPU-like device`);if(t?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)throw TypeError(`buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires an SPH render field`);if(!n&&!(t.fieldRows instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires fieldRows or fieldRowsBuffer`);if(!i&&!(t.surfaceTable?.records instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires surface table records or surfaceBuffer`);let c=t.surfaceTable?.surfaceCount??t.surfaceCount??0,u=t.totalFieldCells??0,d=u*3,f=d*zn*Float32Array.BYTES_PER_ELEMENT,p=wa({candidateCount:d,surfaceCount:c,compactCandidateCapacity:s}),m=p*zn*Float32Array.BYTES_PER_ELEMENT,h=p*Rn*Float32Array.BYTES_PER_ELEMENT,_=u*jn*Float32Array.BYTES_PER_ELEMENT,v=c*An*Float32Array.BYTES_PER_ELEMENT,y=Math.max(1,u)*Uint32Array.BYTES_PER_ELEMENT,b=Math.ceil(Math.max(1,(t.maxFieldCellCount||0)*3)/64),x=Math.max(1,c);ji(e,`compact material-interface candidates`,b,x),ki(e,`ulg-sph-interface-compact-candidates`,Math.max(4,m)),Ai(e,`ulg-sph-interface-compact-candidates`,Math.max(4,m)),ki(e,`ulg-sph-interface-source-keys`,Math.max(4,h)),Ai(e,`ulg-sph-interface-source-keys`,Math.max(4,h)),ki(e,`ulg-sph-interface-compact-metadata`,16),Ai(e,`ulg-sph-interface-compact-metadata`,16);let S=n||null,C=i||null,w=a||t.sourceIndexFieldBuffer||null,T=!!w;Pi(e,`compact material-interface source render field`,S,_),Pi(e,`compact material-interface render surfaces`,C,v),Pi(e,`compact material-interface source-index field`,w,y);let D=S||wi(e,`ulg-sph-interface-source-render-field`,t.fieldRows,Z.COPY_SRC),O=C||wi(e,`ulg-sph-interface-render-surfaces`,t.surfaceTable.records),k=w||Ti(e,`ulg-sph-interface-source-index-disabled`,Math.max(1,u)*Uint32Array.BYTES_PER_ELEMENT),A=e.createBuffer({label:`ulg-sph-interface-compact-candidates`,size:Math.max(4,m),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST}),j=e.createBuffer({label:`ulg-sph-interface-source-keys`,size:Math.max(4,h),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST}),M=e.createBuffer({label:`ulg-sph-interface-compact-metadata`,size:16,usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST}),N=e.createBuffer({label:`ulg-sph-interface-compact-candidate-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(N,0,Wi({surfaceCount:c,totalFieldCells:u,candidateCount:d,fieldPadding:Q(t.fieldPadding,.22),refEdgeM:Q(t.refEdgeM,10),isolationScale:Q(o,1),sourceKeyEnabled:T})),e.queue.writeBuffer(j,0,new Float32Array(p*Rn)),e.queue.writeBuffer(M,0,new Uint32Array([0,0,p,d]));let{pipeline:P,bindGroupLayout:F,cacheStatus:I}=fe(e,{cacheKey:`ulg-sph-interface-compact-candidates-v1`,label:`ulg-sph-interface-compact-candidates`,code:l,entryPoint:`main`,bindings:[q(0,`read-only-storage`),q(1,`read-only-storage`),q(2,`storage`),q(3,`uniform`),q(4,`storage`),q(5,`storage`),q(6,`storage`)]}),L=e.createBindGroup({layout:F,entries:[{binding:0,resource:Fi(O,v,{label:`compact material-interface render surfaces`})},{binding:1,resource:Fi(D,_,{label:`compact material-interface source render field`})},{binding:2,resource:Fi(A,m,{label:`compact material-interface candidates`})},{binding:3,resource:{buffer:N}},{binding:4,resource:Fi(M,16,{label:`compact material-interface metadata`})},{binding:5,resource:Fi(k,y,{label:`compact material-interface source-index field`})},{binding:6,resource:Fi(j,h,{label:`compact material-interface source keys`})}]}),ee=e.createCommandEncoder(),te=ee.beginComputePass();te.setPipeline(P),te.setBindGroup(0,L),te.dispatchWorkgroups(b,x),te.end(),e.queue.submit([ee.finish()]);let ne=await Ji(e,M,16,`ulg-sph-interface-compact-candidate-metadata-readback`),re=new Uint32Array(ne),ie=re[0]??0,R=re[1]??0,ae=Math.min(ie,p),z=ae*zn*Float32Array.BYTES_PER_ELEMENT,B=z>0?new Float32Array(await Ji(e,A,z,`ulg-sph-interface-compact-candidate-readback`)):new Float32Array,V=ae*Rn*Float32Array.BYTES_PER_ELEMENT,H=T&&V>0?new Float32Array(await Ji(e,j,V,`ulg-sph-interface-source-key-readback`)):new Float32Array,U=Ta(H),oe=!!(T&&ae>0);S||D.destroy?.(),C||O.destroy?.(),w||k.destroy?.(),A.destroy?.(),M.destroy?.(),N.destroy?.(),oe||j.destroy?.();let W=Sa(t,B,o),se=!1,G={schema:E,backend:`webgpu-compact`,status:R>0||ie>p?`material-interface-compact-candidate-field-overflow`:ie>0?`material-interface-candidate-field-ready`:`material-interface-candidate-field-empty`,reason:R>0||ie>p?`compact material-interface candidate capacity ${p} was exceeded by ${R} rows`:null,sourceSchema:t.schema,sourceBackend:t.backend,surfaceCount:c,totalFieldCells:u,candidateCount:d,activeCandidateCount:ie,rowLayout:[...r],rowStrideFloats:zn,candidateRows:B,candidateRowByteLength:B.byteLength,candidateDenseRowsByteLength:f,candidateCompactRowsByteLength:z,compactCandidateCapacity:p,compactCandidateOverflowCount:R,compactCandidateMetadata:{activeCandidateCount:ie,overflowCount:R,capacity:p,denseCandidateCount:d},candidateShape:`compact-active-render-field-cell-axis-triplets`,surfaces:W,fieldRowsBufferBound:!!S,surfaceBufferBound:!!C,sourceIndexFieldBufferBound:T,queueCompletionStatus:`compact-readback-map-completed`,queueCompletionMethod:`mapAsync(compact-candidate-readback-buffer)`,pipelineCacheStatus:I,candidateReadback:!0,candidateReadbackMode:xr,candidateMetadataReadback:!0,interfaceSourceKeySchema:g,interfaceSourceKeyStatus:T?U>0?`interface-source-key-retained`:`interface-source-key-empty`:`interface-source-key-unavailable`,interfaceSourceKeyReason:T?null:`source-local material-interface source-index field was unavailable`,interfaceSourceKeyRows:H,interfaceSourceKeyReadback:H.length>0,interfaceSourceKeyRowCount:ae,interfaceSourceKeyReadyCount:U,interfaceSourceKeyStrideFloats:Rn,interfaceSourceKeyRowByteLength:V,interfaceSourceKeyBufferRetained:oe,interfaceSourceKeyBufferByteLength:oe?h:0,interfaceSourceKeySurfaceIndexFallbackEnabled:!1,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1};return oe&&(G.interfaceSourceKeyBuffer=j,G.destroyMaterialInterfaceCandidateFieldBuffers=({reason:e=`material-interface-candidate-field-buffer-cleanup`}={})=>se?{schema:`peercompute.ulg.sph-material-interface-candidate-field-buffer-cleanup.v0`,status:`material-interface-candidate-field-buffers-already-destroyed`,reason:e}:(se=!0,j.destroy?.(),G.interfaceSourceKeyBufferRetained=!1,G.interfaceSourceKeyBufferDestroyed=!0,{schema:`peercompute.ulg.sph-material-interface-candidate-field-buffer-cleanup.v0`,status:`material-interface-candidate-field-buffers-destroyed`,reason:e,interfaceSourceKeyBufferDestroyed:!0})),G}Object.freeze([[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]),Object.freeze([[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]]);var Da=12,Oa=Da*3;function ka(e){let t=Math.max(0,Math.round(Q(e,0))-1);return t*t*t}function Aa(e){let t=Math.round(Q(e,0));return t===L.gas?3:t===L.liquid?2:0}function ja(e={}){let t=Number(e.transparencyClassId),n=Number.isFinite(t)&&t>=0?t:Aa(e.phaseId),r=Number(e.depthWriteFlag),i=Number.isFinite(r)&&r>=0?r:n>0?0:1,a=Number(e.renderOrder),o=Q(e.surfaceIndex??e.index,0),s=Number.isFinite(a)?a:n*1e3+o;return{renderLayer:e.renderLayer??null,renderOrder:s,transparencyClassId:n,depthWriteFlag:i}}function Ma(e={}){let t=e=>{if(e==null||e===``)return null;let t=Number(e);return Number.isFinite(t)?t:null};return{particleRadiusScale:t(e.particleRadiusScale),particleRadiusPolicyStatus:e.particleRadiusPolicyStatus??null,particleRadiusPolicyMode:e.particleRadiusPolicyMode??null,particleRadiusContinuityFloorEligible:e.particleRadiusContinuityFloorEligible??null,particleRadiusContinuityFloorApplied:e.particleRadiusContinuityFloorApplied??null,particleRadiusScaleRequested:t(e.particleRadiusScaleRequested),particleRadiusContinuityFloorScale:t(e.particleRadiusContinuityFloorScale),particleRadiusContinuityFloorScaleUnbounded:t(e.particleRadiusContinuityFloorScaleUnbounded),particleRadiusContinuityRepresentativeRadiusM:t(e.particleRadiusContinuityRepresentativeRadiusM),particleRadiusContinuitySmoothingLengthM:t(e.particleRadiusContinuitySmoothingLengthM),particleRadiusContinuitySupportMultiplier:t(e.particleRadiusContinuitySupportMultiplier),particleRadiusContinuitySupportTargetIsoradiusM:t(e.particleRadiusContinuitySupportTargetIsoradiusM),particleRadiusContinuitySamplingCellSizeM:t(e.particleRadiusContinuitySamplingCellSizeM),particleRadiusContinuitySamplingMarginM:t(e.particleRadiusContinuitySamplingMarginM),particleRadiusContinuityTargetIsoradiusM:t(e.particleRadiusContinuityTargetIsoradiusM)}}function Na(e){let t=e?.surfaces||[],n=Math.max(0,Math.round(Q(e?.surfaceCount,t.length))),r=new Float32Array(n*An);for(let e=0;e<n;e+=1){let n=t[e]||{},i=e*An,a=Array.isArray(n.colorLinear)||ArrayBuffer.isView(n.colorLinear)?n.colorLinear:[1,1,1];r.set([Q(n.materialId,0),Q(n.phaseId,L.unknown),Q(n.fieldOffset??n.cellOffset,0),Q(n.fieldCellCount??n.cellCount??n.voxelCount??0,0),Q(n.resolution,0),Q(n.isolation,0),Q(n.subtract,0),Q(n.strength,0),Q(n.radiusNorm,0),ti(Q(a[0],1),0,1),ti(Q(a[1],1),0,1),ti(Q(a[2],1),0,1),1,Q(n.opticalStateId,0),Number.isFinite(Number(n.transparencyClassId))?Number(n.transparencyClassId):-1,Number.isFinite(Number(n.depthWriteFlag))?Number(n.depthWriteFlag):-1],i)}return r}function Pa(e,t=[]){let n=e.length/In,r=0,i=0,a=0,o=[];for(let s=0;s<n;s+=1){let n=s*In,c=t[s]||{},l=e[n+11]>0,u=Math.round(Q(e[n+5],0)),d=Math.round(Q(e[n+7],0));l&&(r+=1),i+=u,a+=d,o.push({surfaceKey:c.surfaceKey,material:c.material,phase:c.phase,renderKey:c.renderKey,surfaceIndex:Math.round(Q(e[n],s)),materialId:e[n+1],phaseId:e[n+2],opticalStateId:e[n+3],vertexOffset:Math.round(Q(e[n+4],0)),vertexCount:u,triangleOffset:Math.round(Q(e[n+6],0)),triangleCount:d,renderOrder:e[n+8],transparencyClassId:e[n+9],depthWriteFlag:e[n+10],boundsCenterM:[e[n+12],e[n+13],e[n+14]],boundsRadiusM:e[n+15],status:l?`surface-draw-ready`:`surface-draw-empty`})}return{surfaces:o,activeSurfaceCount:r,vertexCount:i,triangleCount:a}}function Fa(e,t=[]){let n=e.length/Pn,r=0,i=0,a=0,o=[];for(let s=0;s<n;s+=1){let n=s*Pn,c=t[s]||{},l=e[n+11]>0,u=Math.round(Q(e[n+4],0)),d=Q(e[n+6],0);l&&(r+=1),i+=u,a=Math.max(a,d),o.push({surfaceKey:c.surfaceKey,material:c.material,phase:c.phase,renderKey:c.renderKey,...Ma(c),surfaceIndex:Math.round(Q(e[n],s)),materialId:e[n+1],phaseId:e[n+2],opticalStateId:e[n+3],activeCellCount:u,crossingCellCount:Math.round(Q(e[n+5],0)),maxDensity:d,isolation:e[n+7],minActiveM:[e[n+8],e[n+9],e[n+10]],maxActiveM:[e[n+12],e[n+13],e[n+14]],cellSizeM:e[n+15],boundsCenterM:[e[n+16],e[n+17],e[n+18]],boundsRadiusM:e[n+19],status:l?`render-field-surface-active`:`render-field-surface-empty`})}return{surfaces:o,activeSurfaceCount:r,activeCellCount:i,maxDensity:a}}async function Ia({device:e,renderField:t,fieldRowsBuffer:n=null,surfaceBuffer:r=null,isolationScale:i=1,retainSummaryRowsBuffer:a=!1}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`summarizeSphRenderFieldSurfacesWebGpu requires a WebGPU-like device`);if(t?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)throw TypeError(`summarizeSphRenderFieldSurfacesWebGpu requires an SPH render field`);if(!n&&!(t.fieldRows instanceof Float32Array))throw TypeError(`summarizeSphRenderFieldSurfacesWebGpu requires fieldRows or fieldRowsBuffer`);if(!r&&!(t.surfaceTable?.records instanceof Float32Array))throw TypeError(`summarizeSphRenderFieldSurfacesWebGpu requires surface table records or surfaceBuffer`);let o=t.surfaceTable?.surfaceCount??t.surfaceCount??0,s=o*Pn*Float32Array.BYTES_PER_ELEMENT,l=(t.totalFieldCells??0)*jn*Float32Array.BYTES_PER_ELEMENT,u=o*An*Float32Array.BYTES_PER_ELEMENT,d=Math.max(1,o);ji(e,`render field surface summary`,d),ki(e,`ulg-sph-render-field-surface-summary`,Math.max(4,s)),Ai(e,`ulg-sph-render-field-surface-summary`,Math.max(4,s));let f=n||null,p=r||null;Pi(e,`render field surface summary source field`,f,l),Pi(e,`render field surface summary surfaces`,p,u);let h=f||wi(e,`ulg-sph-render-field-summary-source-field`,t.fieldRows,Z.COPY_SRC),g=p||wi(e,`ulg-sph-render-field-summary-surfaces`,t.surfaceTable.records),_=e.createBuffer({label:`ulg-sph-render-field-surface-summary`,size:Math.max(4,s),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST});s>0&&e.queue.writeBuffer(_,0,new Float32Array(o*Pn));let v=e.createBuffer({label:`ulg-sph-render-field-surface-summary-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(v,0,Ki({surfaceCount:o,totalFieldCells:t.totalFieldCells??0,fieldPadding:Q(t.fieldPadding,.22),refEdgeM:Q(t.refEdgeM,10),isolationScale:Q(i,1)}));let{pipeline:y,bindGroupLayout:b}=pe(e,{label:`ulg-sph-render-field-surface-summary`,module:e.createShaderModule({label:`ulg-sph-render-field-surface-summary`,code:m}),entryPoint:`main`,bindings:[q(0,`read-only-storage`),q(1,`read-only-storage`),q(2,`storage`),q(3,`uniform`)]}),x=e.createBindGroup({layout:b,entries:[{binding:0,resource:Fi(g,u,{label:`render field surface summary surfaces`})},{binding:1,resource:Fi(h,l,{label:`render field surface summary source field`})},{binding:2,resource:Fi(_,s,{label:`render field surface summary rows`})},{binding:3,resource:{buffer:v}}]}),S=e.createCommandEncoder(),C=S.beginComputePass();C.setPipeline(y),C.setBindGroup(0,x),C.dispatchWorkgroups(d),C.end(),e.queue.submit([S.finish()]);let T=`queue-submitted`,E=`queue.submit`,D=new Float32Array;if(s>0){let t=await Ji(e,_,s,`ulg-sph-render-field-surface-summary-readback`);D=new Float32Array(t),T=`compact-summary-readback-map-completed`,E=`mapAsync(compact-summary-readback-buffer)`}f||h.destroy?.(),p||g.destroy?.(),a||_.destroy?.(),v.destroy?.();let O=Fa(D,t.surfaceTable?.metadata||[]),k={schema:c,backend:`webgpu`,status:O.activeSurfaceCount>0?`render-field-surface-summary-ready`:`render-field-surface-summary-empty`,sourceRenderFieldSchema:t.schema,sourceRenderFieldBackend:t.backend,surfaceCount:o,activeSurfaceCount:O.activeSurfaceCount,activeCellCount:O.activeCellCount,maxDensity:O.maxDensity,rowLayout:[...w],rowStrideFloats:Pn,summaryRows:D,summaryRowsByteLength:s,summaryRowsBufferByteLength:a?s:0,summaryRowsBufferRetained:!!a,fieldRowsBufferBound:!!f,surfaceBufferBound:!!p,queueCompletionStatus:T,queueCompletionMethod:E,renderFieldSurfaceSummaryReadback:!0,renderFieldReadback:!!t.renderFieldReadback,surfaces:O.surfaces,scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};return a&&(k.summaryRowsBuffer=_,k.destroySummaryRowsBuffer=()=>_.destroy?.()),k}function La(e,t,n=1){let r=e.surfaceTable?.metadata||[],i=r.map(()=>new Set),a=Array(r.length).fill(0),o=t.length/Ln;for(let e=0;e<o;e+=1){let n=e*Ln;if(!(t[n+15]>0))continue;let o=Math.round(t[n]);o>=0&&o<r.length&&(a[o]+=1,i[o].add(Math.round(t[n+3])))}return r.map(e=>{let t=a[e.index]||0,r=i[e.index]?.size||0,o=ja(e);return{surfaceKey:e.surfaceKey,material:e.material,phase:e.phase,renderKey:e.renderKey,renderLayer:e.renderLayer??o.renderLayer,renderOrder:o.renderOrder,transparencyClassId:o.transparencyClassId,depthWriteFlag:o.depthWriteFlag,materialId:e.materialId,phaseId:e.phaseId,opticalStateKey:e.opticalStateKey||`default`,opticalStateId:e.opticalStateId||0,resolution:e.resolution,isolation:e.isolation*Q(n,1),voxelResolution:Math.max(0,e.resolution-1),voxelCount:ka(e.resolution),fieldOffset:e.fieldOffset,fieldCellCount:e.fieldCellCount,activeCellCount:null,triangleOffset:null,triangleCount:r,vertexOffset:null,vertexCount:t,status:r>0?`surface-vertices-ready`:`surface-vertices-empty`}})}function Ra(e){if(!(e instanceof Float32Array)||e.length===0)return new Float32Array;let t=[];for(let n=0;n<e.length;n+=Ln)if(e[n+15]>0){let r=Array.from(e.slice(n,n+Ln)),i=t.length/Ln;r[3]=Math.floor(i/3),r[4]=i%3,t.push(...r)}return Float32Array.from(t)}async function za({device:e,renderField:t,fieldRowsBuffer:n=null,surfaceBuffer:r=null,isolationScale:i=1,readbackMode:a=vr,retainVertexRowsBuffer:o=!1,maxVertexRows:s=null,surfaceVertexEmissionMode:c=null,compactByteBudget:l=Un,onProgress:u=null,waitForQueueCompletion:d=!0,deferCleanup:f=!0,useQueueFenceForCleanup:m=!0}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphRenderSurfaceVerticesWebGpu requires a WebGPU-like device`);if(t?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)throw TypeError(`buildSphRenderSurfaceVerticesWebGpu requires an SPH render field`);if(!n&&!(t.fieldRows instanceof Float32Array))throw TypeError(`buildSphRenderSurfaceVerticesWebGpu requires fieldRows or fieldRowsBuffer`);if(!r&&!(t.surfaceTable?.records instanceof Float32Array))throw TypeError(`buildSphRenderSurfaceVerticesWebGpu requires surface table records or surfaceBuffer`);let h=t.surfaceTable?.surfaceCount??t.surfaceCount??0,g=t.totalFieldCells??0,_=a===yr,v=ni(c,{noFullReadback:_}),y=ri(v),x=g*Oa,S=ii({requiredVertexRows:x,requestedMaxVertexRows:s,emissionMode:v,compactByteBudget:l}),C=S*Ln*Float32Array.BYTES_PER_ELEMENT,w=g*jn*Float32Array.BYTES_PER_ELEMENT,E=h*An*Float32Array.BYTES_PER_ELEMENT,D=Math.ceil(Math.max(1,t.maxFieldCellCount||0)/64),O=Math.max(1,h);ji(e,`render surface vertices`,D,O),ki(e,`ulg-sph-surface-vertices`,Math.max(4,C)),Ai(e,`ulg-sph-surface-vertices`,Math.max(4,C)),ki(e,`ulg-sph-surface-vertex-counter`,16),Ai(e,`ulg-sph-surface-vertex-counter`,16);let k=v===wr&&S<x,A=!!(_&&o&&v===wr),j=typeof u==`function`?(e,n={})=>{try{u({status:e,stage:`surface-vertices`,surfaceCount:h,totalFieldCells:g,maxFieldCellCount:t.maxFieldCellCount??null,requiredVertexRows:x,maxVertexRows:S,fixedSlotVertexRowsByteLength:C,surfaceVertexEmissionMode:v,surfaceVertexBudgetCapped:k,compactByteBudget:l,readbackMode:_?yr:vr,...n})}catch{}}:()=>{};j(`surface-vertices-kernel-started`);let M=n||null,N=r||null;Pi(e,`render surface vertices source field`,M,w),Pi(e,`render surface vertices surfaces`,N,E),j(`surface-vertices-source-buffers-started`);let P=M||wi(e,`ulg-sph-surface-vertices-source-render-field`,t.fieldRows,Z.COPY_SRC),F=N||wi(e,`ulg-sph-surface-vertices-render-surfaces`,t.surfaceTable.records);j(`surface-vertices-source-buffers-ready`,{borrowedFieldRowsBuffer:!!M,borrowedSurfaceBuffer:!!N}),j(`surface-vertices-output-buffer-create-started`);let I=e.createBuffer({label:`ulg-sph-surface-vertices`,size:Math.max(4,C),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST});j(`surface-vertices-output-buffer-create-complete`),C>0&&(j(`surface-vertices-output-buffer-zero-started`),e.queue.writeBuffer(I,0,new Float32Array(S*Ln)),j(`surface-vertices-output-buffer-zero-complete`)),j(`surface-vertices-params-buffer-started`);let L=e.createBuffer({label:`ulg-sph-surface-vertex-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(L,0,Gi({surfaceCount:h,totalFieldCells:g,maxVertexRows:S,emissionModeId:y,fieldPadding:Q(t.fieldPadding,.22),refEdgeM:Q(t.refEdgeM,10),isolationScale:Q(i,1)})),j(`surface-vertices-params-buffer-complete`),j(`surface-vertices-counter-buffer-started`);let ee=e.createBuffer({label:`ulg-sph-surface-vertex-counter`,size:16,usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST});e.queue.writeBuffer(ee,0,new Uint32Array(4)),j(`surface-vertices-counter-buffer-complete`),j(`surface-vertices-shader-module-started`);let te=e.createShaderModule({label:`ulg-sph-surface-vertices`,code:b});j(`surface-vertices-shader-module-complete`),j(`surface-vertices-pipeline-started`);let{pipeline:ne,bindGroupLayout:re}=pe(e,{label:`ulg-sph-surface-vertices`,module:te,entryPoint:`main`,bindings:[q(0,`read-only-storage`),q(1,`read-only-storage`),q(2,`storage`),q(3,`uniform`),q(4,`storage`)]});j(`surface-vertices-pipeline-complete`),j(`surface-vertices-bind-group-started`);let ie=e.createBindGroup({layout:re,entries:[{binding:0,resource:Fi(F,E,{label:`render surface vertices surfaces`})},{binding:1,resource:Fi(P,w,{label:`render surface vertices source field`})},{binding:2,resource:Fi(I,C,{label:`render surface vertices`})},{binding:3,resource:{buffer:L}},{binding:4,resource:Fi(ee,16,{label:`render surface vertex counter`})}]});j(`surface-vertices-bind-group-complete`),j(`surface-vertices-command-encode-started`);let R=e.createCommandEncoder(),ae=R.beginComputePass();ae.setPipeline(ne),ae.setBindGroup(0,ie),ae.dispatchWorkgroups(D,O),ae.end(),j(`surface-vertices-command-encode-complete`,{workgroupCountX:D,workgroupCountY:O});let z=new Float32Array,B=null,V=null,H=`not-submitted`,U=null,oe=!1,W=!1;if(!_)if(j(`surface-vertices-queue-submit-started`),e.queue.submit([R.finish()]),H=`queue-submitted`,U=`queue.submit`,j(`surface-vertices-queue-submit-complete`,{queueCompletionStatus:H,queueCompletionMethod:U}),S>0){j(`surface-vertices-full-readback-started`);let t=await Ji(e,I,C,`ulg-sph-surface-vertex-readback`);H=`readback-map-completed`,U=`mapAsync(readback-buffer)`,z=Ra(new Float32Array(t)),B=z.length/Ln,V=B/3,j(`surface-vertices-full-readback-complete`,{queueCompletionStatus:H,queueCompletionMethod:U,vertexCount:B,triangleCount:V})}else H=`readback-skipped-empty-buffer`,U=`queue.submit`,j(`surface-vertices-full-readback-skipped`,{queueCompletionStatus:H,queueCompletionMethod:U});else if(d&&e.queue?.onSubmittedWorkDone)j(`surface-vertices-queue-submit-started`),e.queue.submit([R.finish()]),H=`queue-submitted`,U=`queue.submit`,j(`surface-vertices-queue-submit-complete`,{queueCompletionStatus:H,queueCompletionMethod:U}),j(`surface-vertices-queue-work-wait-started`),await e.queue.onSubmittedWorkDone(),H=`queue-work-completed`,U=`queue.onSubmittedWorkDone`,j(`surface-vertices-queue-work-wait-complete`,{queueCompletionStatus:H,queueCompletionMethod:U});else{j(`surface-vertices-queue-submit-started`),e.queue.submit([R.finish()]);let t=!!(e.queue?.onSubmittedWorkDone&&f&&m);H=t?`queue-submitted-cleanup-deferred`:e.queue?.onSubmittedWorkDone?`queue-submitted-gpu-handoff-no-cpu-fence`:`queue-submitted-no-explicit-completion`,U=t?`deferred queue.onSubmittedWorkDone cleanup`:e.queue?.onSubmittedWorkDone?`queue.submit(in-order-gpu-surface-vertex-handoff)`:`queue.submit`,oe=t,W=!!(e.queue?.onSubmittedWorkDone&&f&&!m),j(`surface-vertices-queue-submit-complete`,{queueCompletionStatus:H,queueCompletionMethod:U})}let se=!1,G=()=>{se||(se=!0,M||P.destroy?.(),N||F.destroy?.(),o||I.destroy?.(),L.destroy?.(),A||ee.destroy?.())};oe?(j(`surface-vertices-cleanup-deferred`,{queueCompletionStatus:H,queueCompletionMethod:U}),me(e,()=>{G(),j(`surface-vertices-deferred-cleanup-complete`,{queueCompletionStatus:H,queueCompletionMethod:U})})):W?j(`surface-vertices-cleanup-deferred-no-queue-fence`,{queueCompletionStatus:H,queueCompletionMethod:U,reason:`retained resident handoff owns cleanup through buffer lease release`}):_&&!d&&e.queue?.onSubmittedWorkDone&&!f?j(`surface-vertices-cleanup-retained-for-resident-handoff`,{queueCompletionStatus:H,queueCompletionMethod:U,reason:`caller disabled queue-fence cleanup because a same-queue consumer/readback owns the synchronization boundary`}):(j(`surface-vertices-cleanup-started`),G(),j(`surface-vertices-cleanup-complete`));let K=be({ledgerId:`sph-surface-vertices:${h}:${S}:buffer-leases`,stateKey:`sph-surface-vertices`,scope:`sph-surface-vertex-buffer-leases`}),ce=[],le=`surface-vertices:vertex-rows:${S}:${C}`,ue=`surface-vertices:vertex-counter:${S}:16`;if(o){ye(K,{resourceKey:le,resourceKind:`surface-vertex-rows-buffer`,stateFamily:`render-surface-vertices`,ownerStage:`surface-vertex-builder`,producerStage:`surface-vertex-builder`,source:`buildSphRenderSurfaceVerticesWebGpu`,status:`resident-surface-vertex-buffer-retained`,retained:!0,byteLength:C,rowCount:S,bufferLabel:I?.label,emissionMode:v,expectedConsumers:[`surface-draw-metadata`]});let e=Se(K,{resourceKey:le,consumerStage:`surface-draw-metadata`,reason:`retained-surface-vertex-buffer`});ce.push(e.leaseId)}if(A){ye(K,{resourceKey:ue,resourceKind:`surface-vertex-counter-buffer`,stateFamily:`render-surface-vertices`,ownerStage:`surface-vertex-builder`,producerStage:`surface-vertex-builder`,source:`buildSphRenderSurfaceVerticesWebGpu`,status:`resident-surface-vertex-counter-retained`,retained:!0,byteLength:16,rowCount:1,bufferLabel:ee?.label,emissionMode:v,expectedConsumers:[`surface-draw-metadata`]});let e=Se(K,{resourceKey:ue,consumerStage:`surface-draw-metadata`,reason:`retained-surface-vertex-counter`});ce.push(e.leaseId)}let de=z.length?La(t,z,i):(t.surfaceTable?.metadata||[]).map(e=>{let t=ja(e);return{surfaceKey:e.surfaceKey,material:e.material,phase:e.phase,renderKey:e.renderKey,renderLayer:e.renderLayer??t.renderLayer,renderOrder:t.renderOrder,transparencyClassId:t.transparencyClassId,depthWriteFlag:t.depthWriteFlag,materialId:e.materialId,phaseId:e.phaseId,opticalStateKey:e.opticalStateKey||`default`,opticalStateId:e.opticalStateId||0,resolution:e.resolution,isolation:e.isolation*Q(i,1),voxelResolution:Math.max(0,e.resolution-1),voxelCount:ka(e.resolution),fieldOffset:e.fieldOffset,fieldCellCount:e.fieldCellCount,activeCellCount:null,triangleOffset:null,triangleCount:null,vertexOffset:null,vertexCount:null,status:`surface-vertex-summary-not-read`}}),fe={schema:T,backend:`webgpu`,status:_?v===wr?`surface-vertices-resident-atomic-compact`:`surface-vertices-resident-fixed-slots`:(V||0)>0?`surface-vertices-ready`:`surface-vertices-empty`,sourceRenderFieldSchema:t.schema,sourceRenderFieldBackend:t.backend,surfaceExtractionMethod:`tetrahedralized-render-field-cubes`,compactionMode:_?v===wr?`webgpu-atomic-compact`:`webgpu-fixed-cell-slots`:`webgpu-fixed-cell-slots-debug-compacted`,surfaceVertexEmissionMode:v,surfaceVertexEmissionModeId:y,surfaceVertexBudgetCapped:k,surfaceVertexCompactByteBudget:v===wr?Math.max(0,Math.round(Q(l,Un))):null,requiredVertexRows:x,surfaceCount:h,totalFieldCells:g,activeCellCount:null,triangleCount:V,vertexCount:B,overflowCount:_&&v===wr?null:0,maxTrianglesPerCell:Da,maxVerticesPerCell:Oa,maxVertexRows:S,rowLayout:[...p],rowStrideFloats:Ln,vertexRows:z,vertexRowsByteLength:z.byteLength,fixedSlotVertexRowsByteLength:C,fixedSlotVertexRowCount:S,vertexRowsBufferByteLength:o?C:0,vertexRowsBufferRowCount:o?S:0,vertexRowsBufferRetained:!!o,vertexCounterBufferByteLength:A?16:0,vertexCounterBufferRetained:A,counterBufferRetained:A,counterReadback:!1,fieldRowsBufferBound:!!M,surfaceBufferBound:!!N,readbackMode:_?yr:vr,queueCompletionStatus:H,queueCompletionMethod:U,surfaceVertexDeferredCleanup:W,surfaceVertexReadback:!_,renderFieldReadback:!!t.renderFieldReadback,surfaces:de,residentBufferLeaseLedger:K,residentBufferLeaseSummary:J(K),residentBufferLeaseLedgerStatus:K.status,residentBufferLeaseResourceCount:K.resourceCount,residentBufferLeaseActiveLeaseCount:K.activeLeaseCount,scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};if(o){fe.vertexRowsBuffer=I,A&&(fe.vertexCounterBuffer=ee);let e=!1,t=!1,n=()=>(fe.residentBufferLeaseSummary=J(K),fe.residentBufferLeaseLedgerStatus=fe.residentBufferLeaseSummary.status,fe.residentBufferLeaseResourceCount=fe.residentBufferLeaseSummary.resourceCount,fe.residentBufferLeaseActiveLeaseCount=fe.residentBufferLeaseSummary.activeLeaseCount,fe.residentBufferLeaseSummary);fe.releaseSurfaceVertexBufferLeases=({status:e=`released`}={})=>{for(let t of ce)xe(K,t,{status:e});return n()},fe.destroySurfaceVertexBuffers=({force:r=!1,releaseLeases:i=!1,reason:a=`surface-vertex-buffer-cleanup`}={})=>(G(),i&&fe.releaseSurfaceVertexBufferLeases(),ve(K,le,()=>{e||(e=!0,I.destroy?.())},{force:r,reason:a}),A&&ve(K,ue,()=>{t||(t=!0,ee.destroy?.())},{force:r,reason:a}),n())}return fe}async function Ba({device:e,surfaceVertices:t,surfaceBuffer:n=null,readbackMode:r=vr,compactSummaryReadback:i=!1,retainDrawRowsBuffer:a=!1,retainCompactedVertexRowsBuffer:o=!1,retainDrawIndirectRowsBuffer:s=!1,waitForQueueCompletion:c=!0,onProgress:l=null}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphRenderSurfaceDrawMetadataWebGpu requires a WebGPU-like device`);if(t?.schema!==`peercompute.ulg.sph-gpu-render-surface-vertices.v0`)throw TypeError(`buildSphRenderSurfaceDrawMetadataWebGpu requires an SPH surface vertex field`);let u=!!t.vertexRowsBuffer,d=t.vertexRows instanceof Float32Array&&t.vertexRows.length>0;if(!u&&!d)throw TypeError(`buildSphRenderSurfaceDrawMetadataWebGpu requires vertexRows or a retained vertexRowsBuffer`);let p=r===yr,m=!!t.vertexCounterBuffer,g=+!!m,_=m?`resident-vertex-counter`:`uniform-upper-bound`,v=Ln*Float32Array.BYTES_PER_ELEMENT;if(t.rowStrideFloats!=null&&t.rowStrideFloats!==Ln)throw RangeError(`surface vertex rowStrideFloats does not match the draw-kernel vertex ABI`);let y;if(u){let e=[[`vertexRowsBufferRowCount`,t.vertexRowsBufferRowCount],[`maxVertexRows`,t.maxVertexRows],[`fixedSlotVertexRowCount`,t.fixedSlotVertexRowCount]].filter(([,e])=>e!=null),n=[[`vertexRowsBufferByteLength`,t.vertexRowsBufferByteLength],[`fixedSlotVertexRowsByteLength`,t.fixedSlotVertexRowsByteLength]].filter(([,e])=>e!=null),r=Number(t.vertexRowsBuffer.size);if(!Number.isSafeInteger(r)||r<0)throw RangeError(`surface vertex rows buffer must expose its exact GPU buffer size`);if(e.length>0){y=Fr(e[0][1],`surfaceVertices.${e[0][0]}`);for(let[t,n]of e.slice(1))if(Fr(n,`surfaceVertices.${t}`)!==y)throw RangeError(`surface vertex row-count metadata must identify one exact borrowed range`)}else if(n.length>0){let[e,t]=n[0],r=Ni(t,`surfaceVertices.${e}`);if(r%v!==0)throw RangeError(`surface vertex byte-length metadata must align to the vertex row ABI`);y=Fr(r/v,`surface vertex borrowed row count`)}else{if(r%v!==0)throw RangeError(`surface vertex rows buffer capacity must align to the vertex row ABI when row metadata is absent`);y=Fr(r/v,`surface vertex borrowed row count`)}let i=y*v;for(let[e,t]of n)if(Ni(t,`surfaceVertices.${e}`)!==i)throw RangeError(`surface vertex row-count and byte-length metadata describe different borrowed ranges`)}else{if(t.vertexRows.length%Ln!==0)throw RangeError(`surface vertex host rows must align to the vertex row ABI`);y=Fr(t.vertexRows.length/Ln,`surface vertex host row count`)}let b=Fr(t.surfaceCount??t.surfaces?.length??0,`surface vertex surfaceCount`),x=y*v,S=b*In*Float32Array.BYTES_PER_ELEMENT,w=b*Fn*Uint32Array.BYTES_PER_ELEMENT,T=Fn*Uint32Array.BYTES_PER_ELEMENT,E=b*An*Float32Array.BYTES_PER_ELEMENT,D=Math.max(1,b);ji(e,`render surface draw metadata`,D);for(let[t,n]of[[`render surface draw compacted vertices`,x],[`render surface draw rows`,S],[`render surface draw indirect rows`,w],[`render surface draw aggregate indirect row`,T]]){let r=Mi(n,t);ki(e,t,r),Ai(e,t,r)}let O=typeof l==`function`?(e,t={})=>{try{l({status:e,stage:`surface-draw-metadata`,surfaceCount:b,sourceVertexRowCount:y,compactedVertexRowsByteLength:x,drawRowsByteLength:S,drawIndirectRowsByteLength:w,drawAggregateIndirectRowsByteLength:T,sourceVertexCounterMode:_,sourceVertexCounterBufferBound:m,readbackMode:p?yr:vr,compactSummaryReadback:!!i,...t})}catch{}}:()=>{};O(`surface-draw-metadata-kernel-started`);let k=n||null;if(Pi(e,`render surface draw source vertices`,u?t.vertexRowsBuffer:null,x),Pi(e,`render surface draw surfaces`,k,E),m&&t.vertexCounterBufferByteLength!=null&&Ni(t.vertexCounterBufferByteLength,`surfaceVertices.vertexCounterBufferByteLength`)!==16)throw RangeError(`surface vertex counter byte length does not match its exact storage ABI`);Pi(e,`render surface draw source vertex counter`,m?t.vertexCounterBuffer:null,16),O(`surface-draw-metadata-source-buffers-started`,{hasBorrowedVertexBuffer:u,borrowedSurfaceBuffer:!!k});let j=u?t.vertexRowsBuffer:wi(e,`ulg-sph-surface-draw-source-vertices`,t.vertexRows,Z.COPY_SRC),N=k||wi(e,`ulg-sph-surface-draw-surfaces`,Na(t)),P=m?t.vertexCounterBuffer:e.createBuffer({label:`ulg-sph-surface-draw-source-vertex-counter`,size:16,usage:Z.STORAGE|Z.COPY_DST});m||e.queue.writeBuffer(P,0,new Uint32Array([y,0,0,0])),O(`surface-draw-metadata-source-buffers-ready`,{hasBorrowedVertexBuffer:u,borrowedSurfaceBuffer:!!k,hasBorrowedVertexCounterBuffer:m}),O(`surface-draw-metadata-output-buffers-started`);let F=e.createBuffer({label:`ulg-sph-surface-draw-compacted-vertices`,size:Math.max(4,x),usage:Z.STORAGE|Z.VERTEX|Z.COPY_SRC|Z.COPY_DST});x>0&&e.queue.writeBuffer(F,0,new Float32Array(y*Ln));let I=e.createBuffer({label:`ulg-sph-surface-draw-metadata`,size:Math.max(4,S),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST});S>0&&e.queue.writeBuffer(I,0,new Float32Array(b*In));let L=e.createBuffer({label:`ulg-sph-surface-draw-indirect`,size:Math.max(4,w),usage:Z.STORAGE|Z.INDIRECT|Z.COPY_SRC|Z.COPY_DST});w>0&&e.queue.writeBuffer(L,0,new Uint32Array(b*Fn));let ee=e.createBuffer({label:`ulg-sph-surface-draw-aggregate-indirect`,size:T,usage:Z.STORAGE|Z.INDIRECT|Z.COPY_SRC|Z.COPY_DST});e.queue.writeBuffer(ee,0,new Uint32Array(Fn)),O(`surface-draw-metadata-output-buffers-complete`),O(`surface-draw-metadata-params-buffer-started`);let te=e.createBuffer({label:`ulg-sph-surface-draw-params`,size:16,usage:Z.UNIFORM|Z.COPY_DST});e.queue.writeBuffer(te,0,qi({surfaceCount:b,sourceVertexRowCount:y,maxCompactVertexRows:y,sourceVertexCounterMode:g})),O(`surface-draw-metadata-params-buffer-complete`),O(`surface-draw-metadata-shader-module-started`);let ne=e.createShaderModule({label:`ulg-sph-surface-draw`,code:C});O(`surface-draw-metadata-shader-module-complete`),O(`surface-draw-metadata-pipeline-started`);let{pipeline:re,bindGroupLayout:ie}=pe(e,{label:`ulg-sph-surface-draw`,module:ne,entryPoint:`main`,bindings:[q(0,`read-only-storage`),q(1,`read-only-storage`),q(2,`storage`),q(3,`storage`),q(4,`uniform`),q(5,`storage`),q(6,`read-only-storage`),q(7,`storage`)]});O(`surface-draw-metadata-pipeline-complete`),O(`surface-draw-metadata-bind-group-started`);let R=e.createBindGroup({layout:ie,entries:[{binding:0,resource:Fi(N,E,{label:`render surface draw surfaces`})},{binding:1,resource:Fi(j,x,{label:`render surface draw source vertices`})},{binding:2,resource:Fi(F,x,{label:`render surface draw compacted vertices`})},{binding:3,resource:Fi(I,S,{label:`render surface draw rows`})},{binding:4,resource:{buffer:te}},{binding:5,resource:Fi(L,w,{label:`render surface draw indirect rows`})},{binding:6,resource:Fi(P,16,{label:`render surface draw source vertex counter`})},{binding:7,resource:Fi(ee,T,{label:`render surface draw aggregate indirect row`})}]});O(`surface-draw-metadata-bind-group-complete`),O(`surface-draw-metadata-command-encode-started`);let ae=e.createCommandEncoder(),z=ae.beginComputePass();z.setPipeline(re),z.setBindGroup(0,R),z.dispatchWorkgroups(D),z.end(),O(`surface-draw-metadata-command-encode-complete`,{workgroupCountX:D});let B=new Float32Array,V=new Uint32Array,H=new Float32Array,U=null,oe=null,W=null,se,G=!1,K=0,ce=`not-submitted`,le=null,ue=!1,de=null,fe=null,he=null,ge=null;if(!p)if(O(`surface-draw-metadata-queue-submit-started`),e.queue.submit([ae.finish()]),ce=`queue-submitted`,le=`queue.submit`,O(`surface-draw-metadata-queue-submit-complete`,{queueCompletionStatus:ce,queueCompletionMethod:le}),S>0){O(`surface-draw-metadata-full-readback-started`);let n=await Ji(e,I,S,`ulg-sph-surface-draw-readback`);ce=`readback-map-completed`,le=`mapAsync(readback-buffer)`,B=new Float32Array(n);let r=Pa(B,t.surfaces||[]);if(se=r.surfaces,U=r.activeSurfaceCount,oe=r.vertexCount,W=r.triangleCount,oe>0){let t=await Ji(e,F,oe*Ln*Float32Array.BYTES_PER_ELEMENT,`ulg-sph-surface-draw-compacted-vertex-readback`);H=new Float32Array(t)}if(w>0){let t=await Ji(e,L,w,`ulg-sph-surface-draw-indirect-readback`);V=new Uint32Array(t)}O(`surface-draw-metadata-full-readback-complete`,{queueCompletionStatus:ce,queueCompletionMethod:le,activeSurfaceCount:U,vertexCount:oe,triangleCount:W})}else se=[],U=0,oe=0,W=0,V=new Uint32Array,ce=`readback-skipped-empty-buffer`,le=`queue.submit`,O(`surface-draw-metadata-full-readback-skipped`,{queueCompletionStatus:ce,queueCompletionMethod:le});else if(c&&e.queue?.onSubmittedWorkDone?(O(`surface-draw-metadata-queue-submit-started`),e.queue.submit([ae.finish()]),ce=`queue-submitted`,le=`queue.submit`,O(`surface-draw-metadata-queue-submit-complete`,{queueCompletionStatus:ce,queueCompletionMethod:le}),O(`surface-draw-metadata-queue-work-wait-started`),await e.queue.onSubmittedWorkDone(),ce=`queue-work-completed`,le=`queue.onSubmittedWorkDone`,O(`surface-draw-metadata-queue-work-wait-complete`,{queueCompletionStatus:ce,queueCompletionMethod:le})):(O(`surface-draw-metadata-queue-submit-started`),e.queue.submit([ae.finish()]),ce=e.queue?.onSubmittedWorkDone&&!i?`queue-submitted-cleanup-deferred`:`queue-submitted-no-explicit-completion`,le=e.queue?.onSubmittedWorkDone&&!i?`deferred queue.onSubmittedWorkDone cleanup`:`queue.submit`,ue=!!(e.queue?.onSubmittedWorkDone&&!i),O(`surface-draw-metadata-queue-submit-complete`,{queueCompletionStatus:ce,queueCompletionMethod:le})),se=(t.surfaces||[]).map((e,t)=>({...(()=>{let n=ja({...e,surfaceIndex:t});return{surfaceKey:e.surfaceKey,material:e.material,phase:e.phase,renderKey:e.renderKey,renderLayer:e.renderLayer??n.renderLayer,surfaceIndex:t,materialId:e.materialId,phaseId:e.phaseId,opticalStateId:e.opticalStateId||0,vertexOffset:null,vertexCount:null,triangleOffset:null,triangleCount:null,renderOrder:n.renderOrder,transparencyClassId:n.transparencyClassId,depthWriteFlag:n.depthWriteFlag,boundsCenterM:[0,0,0],boundsRadiusM:null,status:`surface-draw-summary-not-read`}})()})),i&&S>0){O(`surface-draw-metadata-compact-summary-readback-started`);let n=await Ji(e,I,S,`ulg-sph-surface-draw-compact-summary-readback`);B=new Float32Array(n);let r=Pa(B,t.surfaces||[]);se=r.surfaces,U=r.activeSurfaceCount,oe=r.vertexCount,W=r.triangleCount,G=!0,K=S,ce=`compact-summary-readback-map-completed`,le=`mapAsync(compact-summary-readback-buffer)`,O(`surface-draw-metadata-compact-summary-readback-complete`,{queueCompletionStatus:ce,queueCompletionMethod:le,activeSurfaceCount:U,vertexCount:oe,triangleCount:W})}else G=!1,K=0,de=Math.max(0,y-y%3),fe=Math.floor(de/3),he=de>=3?`surface-draw-gpu-resident-draw-range-available`:`surface-draw-gpu-resident-empty-draw-range`,ge=de>=3?`compact surface-draw summary was not read; retained GPU buffers expose a conservative upper-bound draw range for same-device consumers`:`compact surface-draw summary was not read and retained GPU buffers do not contain a drawable triangle range`,O(`surface-draw-metadata-gpu-only-draw-range-ready`,{queueCompletionStatus:ce,queueCompletionMethod:le,gpuOnlyDrawRangeStatus:he,gpuOnlyDrawRangeVertexCount:de,gpuOnlyDrawRangeTriangleCount:fe});let _e=()=>{u||j.destroy?.(),k||N.destroy?.(),m||P.destroy?.(),te.destroy?.()},Ce=a||p,we=o||p,Te=s||p,Ee=p;Ce||I.destroy?.(),we||F.destroy?.(),Te||L.destroy?.(),Ee||ee.destroy?.(),ue?(O(`surface-draw-metadata-cleanup-deferred`,{queueCompletionStatus:ce,queueCompletionMethod:le}),me(e,()=>{_e(),O(`surface-draw-metadata-deferred-cleanup-complete`,{queueCompletionStatus:ce,queueCompletionMethod:le})})):(O(`surface-draw-metadata-cleanup-started`),_e(),O(`surface-draw-metadata-cleanup-complete`));let De=be({ledgerId:`sph-resident-surface-draw:${b}:buffer-leases`,stateKey:`sph-resident-surface-draw`,scope:`sph-resident-surface-draw-buffer-leases`}),Oe=[],ke=({resourceKey:e,resourceKind:t,buffer:n,byteLength:r,rowCount:i})=>{ye(De,{resourceKey:e,resourceKind:t,stateFamily:`render-surface`,ownerStage:`surface-draw-metadata`,producerStage:`surface-draw-metadata`,source:`buildSphRenderSurfaceDrawMetadataWebGpu`,status:`resident-surface-draw-buffer-retained`,retained:!0,byteLength:r,rowCount:i,bufferLabel:n?.label,expectedConsumers:[`resident-surface-draw-overlay`,`diagnostics`]});let a=Se(De,{resourceKey:e,consumerStage:`resident-surface-draw-overlay`,reason:`retained-overlay-draw-buffer`});Oe.push(a.leaseId)};Ce&&ke({resourceKey:`surface-draw:draw-rows:${b}:${S}`,resourceKind:`surface-draw-rows-buffer`,buffer:I,byteLength:S,rowCount:b}),Te&&ke({resourceKey:`surface-draw:draw-indirect:${b}:${w}`,resourceKind:`surface-draw-indirect-buffer`,buffer:L,byteLength:w,rowCount:b}),Ee&&ke({resourceKey:`surface-draw:draw-aggregate-indirect:1:${T}`,resourceKind:`surface-draw-aggregate-indirect-buffer`,buffer:ee,byteLength:T,rowCount:1}),we&&ke({resourceKey:`surface-draw:compacted-vertices:${y}:${x}`,resourceKind:`surface-draw-compacted-vertices-buffer`,buffer:F,byteLength:x,rowCount:y});let Ae={schema:A,backend:`webgpu`,status:p?`surface-draw-resident`:(U||0)>0?`surface-draw-metadata-ready`:`surface-draw-metadata-empty`,sourceSurfaceVertexSchema:t.schema,sourceSurfaceVertexBackend:t.backend,surfaceCount:b,activeSurfaceCount:U,vertexCount:oe,triangleCount:W,rowLayout:[...M],rowStrideFloats:In,drawRows:B,drawRowsByteLength:S,drawRowsBufferByteLength:Ce?S:0,drawRowsBufferRetained:Ce,drawIndirectSchema:h,drawIndirectRowLayout:[...f],drawIndirectRowStrideUints:Fn,drawIndirectRows:V,drawIndirectRowsByteLength:w,drawIndirectRowsBufferByteLength:Te?w:0,drawIndirectRowsBufferRetained:Te,drawAggregateIndirectRowsByteLength:T,drawAggregateIndirectRowsBufferByteLength:Ee?T:0,drawAggregateIndirectRowsBufferRetained:Ee,compactedVertexRows:H,compactedVertexRowsByteLength:H.byteLength,compactedVertexRowsBufferByteLength:we?x:0,compactedVertexRowsBufferRetained:we,sourceVertexRowCount:y,sourceVertexRowsBufferBound:u,sourceVertexCounterMode:_,sourceVertexCounterBufferBound:m,sourceVertexCounterBufferByteLength:m?16:0,surfaceBufferBound:!!k,readbackMode:p?yr:vr,queueCompletionStatus:ce,queueCompletionMethod:le,surfaceDrawReadback:!p,surfaceDrawSummaryReadback:G,surfaceDrawSummaryReadbackByteLength:K,surfaceDrawGpuOnlyHandoff:!!(p&&!G),surfaceDrawGpuOnlyHandoffStatus:he,surfaceDrawGpuOnlyHandoffReason:ge,surfaceDrawGpuOnlyUpperBoundVertexCount:de,surfaceDrawGpuOnlyUpperBoundTriangleCount:fe,surfaceDrawGpuOnlyAggregateIndirectReady:!!(p&&!G&&Ee&&m),surfaceDrawGpuOnlyAggregateDrawRangeExact:!!(p&&!G&&m),surfaceDrawGpuOnlyDrawRangeConservative:!!(p&&!G&&(de||0)>=3),fullSurfaceDrawReadback:!p,compactionMode:`webgpu-surface-prefix-scan-compact`,surfaces:se,residentBufferLeaseLedger:De,residentBufferLeaseSummary:J(De),residentBufferLeaseLedgerStatus:De.status,residentBufferLeaseResourceCount:De.resourceCount,residentBufferLeaseActiveLeaseCount:De.activeLeaseCount,scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};if(Ce&&(Ae.drawRowsBuffer=I),Te&&(Ae.drawIndirectRowsBuffer=L),Ee&&(Ae.drawAggregateIndirectRowsBuffer=ee),we&&(Ae.compactedVertexRowsBuffer=F),Ce||we||Te){let e=new Set,t=()=>(Ae.residentBufferLeaseSummary=J(De),Ae.residentBufferLeaseLedgerStatus=Ae.residentBufferLeaseSummary.status,Ae.residentBufferLeaseResourceCount=Ae.residentBufferLeaseSummary.resourceCount,Ae.residentBufferLeaseActiveLeaseCount=Ae.residentBufferLeaseSummary.activeLeaseCount,Ae.residentBufferLeaseSummary);Ae.releaseSurfaceDrawBufferLeases=({status:e=`released`}={})=>{for(let t of Oe)xe(De,t,{status:e});return t()};let n=(t,n)=>{e.has(t)||(e.add(t),n?.destroy?.())};Ae.destroySurfaceDrawBuffers=({force:e=!1,releaseLeases:r=!1,reason:i=`surface-draw-buffer-cleanup`}={})=>{if(r&&Ae.releaseSurfaceDrawBufferLeases(),Ce){let t=`surface-draw:draw-rows:${b}:${S}`;ve(De,t,()=>{n(t,I)},{force:e,reason:i})}if(we){let t=`surface-draw:compacted-vertices:${y}:${x}`;ve(De,t,()=>{n(t,F)},{force:e,reason:i})}if(Te){let t=`surface-draw:draw-indirect:${b}:${w}`;ve(De,t,()=>{n(t,L)},{force:e,reason:i})}if(Ee){let t=`surface-draw:draw-aggregate-indirect:1:${T}`;ve(De,t,()=>{n(t,ee)},{force:e,reason:i})}return t()}}return Ae}function Va(e){if(e?.schema!==`peercompute.ulg.sph-material-interface-candidate-field.v0`||!(e.candidateRows instanceof Float32Array))throw TypeError(`compactSphMaterialInterfaceCandidates requires a material-interface candidate field`);if(e.candidateRows.length%zn!==0)throw RangeError(`material-interface candidate rows must align to the candidate row stride`)}function Ha(e){Va(e);let t=e.candidateRows,n=e.interfaceSourceKeyRows instanceof Float32Array?e.interfaceSourceKeyRows:null,r=(e.surfaces||[]).map(e=>({...e,crossingFaceCount:0,surfaceAreaM2:0,normalAreaSum:[0,0,0],centroidAreaSum:[0,0,0],elementOffset:0,elementCount:0})),i=[],a=[],o=t.length/zn,c=e=>{if(!n)return null;let t=e*Rn;if(t+2>=n.length)return null;let r=Math.round(Q(n[t],-1)),i=n[t+2]||0;if(r!==e||!(i>0))return null;let a=Math.round(Q(n[t+1],-1));return a>=0?a:null};for(let e=0;e<o;e+=1){let n=e*zn;if(!(t[n+15]>0))continue;let o=Math.round(t[n]),s=r[o];if(!s)continue;s.elementCount===0&&(s.elementOffset=a.length);let l=t[n+7],u=[t[n+11],t[n+12],t[n+13]],d=[t[n+4],t[n+5],t[n+6]],f=[t[n+8],t[n+9],t[n+10]],p=a.length,m=c(p),h={index:p,surfaceIndex:o,surfaceKey:s.surfaceKey,material:s.material,phase:s.phase,renderKey:s.renderKey,materialId:t[n+1],phaseId:t[n+2],axisId:t[n+3],centroidM:d,areaM2:l,normal:f,normalAreaVectorM2:u,crossingSign:t[n+14],...m==null?{}:{sourceParticleIndex:m},status:`interface-element-ready`};a.push(h),i.push(h.surfaceIndex,h.materialId,h.phaseId,h.axisId,h.centroidM[0],h.centroidM[1],h.centroidM[2],h.areaM2,h.normal[0],h.normal[1],h.normal[2],h.normalAreaVectorM2[0],h.normalAreaVectorM2[1],h.normalAreaVectorM2[2],h.crossingSign,1),s.crossingFaceCount+=1,s.surfaceAreaM2+=l,s.normalAreaSum[0]+=u[0],s.normalAreaSum[1]+=u[1],s.normalAreaSum[2]+=u[2],s.centroidAreaSum[0]+=d[0]*l,s.centroidAreaSum[1]+=d[1]*l,s.centroidAreaSum[2]+=d[2]*l,s.elementCount+=1}let l=r.map(e=>({surfaceKey:e.surfaceKey,material:e.material,phase:e.phase,renderKey:e.renderKey,materialId:e.materialId,phaseId:e.phaseId,opticalStateKey:e.opticalStateKey||`default`,resolution:e.resolution,isolation:e.isolation,activeCellCount:e.activeCellCount,crossingFaceCount:e.crossingFaceCount,candidateOffset:e.candidateOffset,candidateCount:e.candidateCount,activeCandidateCount:e.activeCandidateCount,elementOffset:e.elementOffset,elementCount:e.elementCount,surfaceAreaM2:e.surfaceAreaM2,meanOutwardNormal:xa(e.normalAreaSum),areaCentroidM:e.surfaceAreaM2>0?e.centroidAreaSum.map(t=>t/e.surfaceAreaM2):[null,null,null],normalDerivation:`render-field-isosurface-threshold-crossing-candidates`,surfaceAreaDerivation:`fixed-cell-axis-candidate-face-area-sum`,status:e.surfaceAreaM2>0?`material-interface-derived`:e.activeCellCount>0?`material-interface-active-without-crossing`:`material-interface-empty`})),u=l.reduce((e,t)=>e+t.surfaceAreaM2,0),d=l.filter(e=>e.surfaceAreaM2>0).length,f={schema:S,status:d>0?`material-interface-field-ready`:`material-interface-field-empty`,sourceSchema:e.sourceSchema,sourceBackend:e.sourceBackend,candidateFieldSchema:e.schema,candidateBackend:e.backend,surfaceCount:l.length,readySurfaceCount:d,totalSurfaceAreaM2:u,candidateCount:e.candidateCount,activeCandidateCount:e.activeCandidateCount,candidateStrideFloats:e.rowStrideFloats,candidateShape:e.candidateShape,elementCount:a.length,elementLayout:[...s],elementStrideFloats:Bn,elementRows:Float32Array.from(i),elements:a,interfaceSourceKeySchema:e.interfaceSourceKeySchema??null,interfaceSourceKeySourceStatus:e.interfaceSourceKeyStatus??null,interfaceSourceKeyStatus:e.interfaceSourceKeyStatus??null,interfaceSourceKeyReason:e.interfaceSourceKeyReason??null,interfaceSourceKeyRows:e.interfaceSourceKeyRows instanceof Float32Array?e.interfaceSourceKeyRows:new Float32Array,interfaceSourceKeyReadback:!!e.interfaceSourceKeyReadback,interfaceSourceKeyRowCount:e.interfaceSourceKeyRowCount??0,interfaceSourceKeyReadyCount:e.interfaceSourceKeyReadyCount??0,interfaceSourceKeyStrideFloats:e.interfaceSourceKeyStrideFloats??Rn,interfaceSourceKeyBufferRetained:!!e.interfaceSourceKeyBufferRetained,interfaceSourceKeyBufferByteLength:e.interfaceSourceKeyBufferByteLength??0,interfaceSourceKeySurfaceIndexFallbackEnabled:e.interfaceSourceKeySurfaceIndexFallbackEnabled!==!1,forceCouplingStatus:d>0?`blocked-pressure-force-solver-not-implemented`:`blocked-material-surface-normals-not-resolved`,surfaces:l,scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1};return e.interfaceSourceKeyBuffer&&(f.interfaceSourceKeyBuffer=e.interfaceSourceKeyBuffer),typeof e.destroyMaterialInterfaceCandidateFieldBuffers==`function`&&(f.destroyMaterialInterfaceFieldBuffers=({reason:t=`material-interface-field-buffer-cleanup`}={})=>e.destroyMaterialInterfaceCandidateFieldBuffers({reason:t})),f}async function Ua({device:e,renderField:t,fieldRowsBuffer:n=null,surfaceBuffer:r=null,isolationScale:i=1,source:a=`resident-physics-material-interface-extractor`,sourceCadence:o=`resident-physics-stage`,candidateReadbackByteBudget:s=Vn,candidateReadbackMode:c=br,compactCandidateCapacity:l=null}={}){let u=t?.schema===`peercompute.ulg.sph-material-interface-source-field.v0`?t:null,d=u?.sourceRenderField||t,f=n||u?.fieldRowsBuffer||null,p=r||u?.surfaceBuffer||null,m=Ii(d),h=c===xr?xr:c===Sr?Sr:br;if(h===Sr)return zi({sourceField:u,sourceRenderField:d,resolvedFieldRowsBuffer:f,resolvedSurfaceBuffer:p,source:a,sourceCadence:o,candidateRowsByteLength:m,candidateReadbackByteBudget:s,candidateReadbackMode:h,compactCandidateCapacity:l});let g=h===xr?xr:br,_=g===xr?null:Li({device:e,candidateRowsByteLength:m,candidateReadbackByteBudget:s});if(_)return Ri({sourceField:u,sourceRenderField:d,resolvedFieldRowsBuffer:f,resolvedSurfaceBuffer:p,source:a,sourceCadence:o,candidateRowsByteLength:m,candidateReadbackByteBudget:s,candidateReadbackBlocker:_,candidateReadbackMode:g});let v=null;if(g===xr){if(v=await Ea({device:e,renderField:d,fieldRowsBuffer:f,surfaceBuffer:p,sourceIndexFieldBuffer:u?.sourceIndexFieldBuffer||d?.sourceIndexFieldBuffer||null,isolationScale:i,compactCandidateCapacity:l}),v.status===`material-interface-compact-candidate-field-overflow`){let t=Li({device:e,candidateRowsByteLength:m,candidateReadbackByteBudget:s});if(t)return Ri({sourceField:u,sourceRenderField:d,resolvedFieldRowsBuffer:f,resolvedSurfaceBuffer:p,source:a,sourceCadence:o,candidateRowsByteLength:m,candidateReadbackByteBudget:s,candidateReadbackBlocker:t,candidateReadbackMode:g,compactCandidateField:v});v.destroyMaterialInterfaceCandidateFieldBuffers?.({reason:`compact-candidate-overflow-switching-to-dense-fallback`}),v=await Ca({device:e,renderField:d,fieldRowsBuffer:f,surfaceBuffer:p,isolationScale:i}),v.compactFallbackStatus=`fallback-dense-readback-after-compact-overflow`}}else v=await Ca({device:e,renderField:d,fieldRowsBuffer:f,surfaceBuffer:p,isolationScale:i});let y=Ha(v),b=v.candidateReadbackMode===xr;return{...y,backend:b?`webgpu-compact-candidate-readback`:`webgpu-candidate-readback`,authority:`resident-physics-material-interface-extractor`,source:a,sourceCadence:o,sourceFieldSchema:u?.schema??null,sourceFieldStatus:u?.status??null,sourceFieldBackend:u?.backend??null,sourceFieldPipelineCacheStatus:u?.sourceRenderFieldPipelineCacheStatus??u?.pipelineCacheStatus??null,sourceRenderFieldSchema:d?.schema??null,sourceRenderFieldBackend:d?.backend??null,sourceRenderFieldPipelineCacheStatus:d?.pipelineCacheStatus??u?.sourceRenderFieldPipelineCacheStatus??null,sourceRenderFieldReadback:!!d?.renderFieldReadback,sourceFieldRowsBufferBound:!!f,sourceSurfaceBufferBound:!!p,candidateBackend:v.backend,candidateReadback:!!v.candidateReadback,candidateReadbackMode:v.candidateReadbackMode??h,candidateRowsByteLength:m,candidateDenseRowsByteLength:v.candidateDenseRowsByteLength??m,candidateCompactRowsByteLength:v.candidateCompactRowsByteLength??null,candidateCompactCapacity:v.compactCandidateCapacity??null,candidateCompactOverflowCount:v.compactCandidateOverflowCount??0,candidateCompactFallbackStatus:v.compactFallbackStatus??null,candidateMetadataReadback:!!v.candidateMetadataReadback,candidatePipelineCacheStatus:v.pipelineCacheStatus??null,queueCompletionStatus:v.queueCompletionStatus??null,queueCompletionMethod:v.queueCompletionMethod??null,normalDerivation:`physics-owned-field-cell-crossing-candidates`,surfaceAreaDerivation:`physics-owned-fixed-cell-face-area-sum`,physicsStage:`material-interface-extraction`,pressureInterfaceProducer:!0}}async function Wa({device:e,renderRows:t,renderRowsBuffer:n=null,renderRowsSource:r=null,dispersedMediumOptics:i=null,dispersedMediumOpticsRows:a=null,dispersedMediumOpticsBuffer:o=null,dispersedMediumOpticsAuthority:s=null,schroederSpatialSourceFamily:c=r?.schroederSpatialSourceFamily??null,productEventRows:l=null,productEventBuffer:u=null,productEventSource:f=null,productEventLiveCountDescriptor:p=null,surfaceTable:m,particleCount:h=null,productEventCount:g=null,fieldPadding:v=.22,refEdgeM:y=10,renderSmearDtS:b=0,readbackMode:x=vr,retainFieldRowsBuffer:S=!1,retainMotionFieldBuffer:C=!1,retainSurfaceBuffer:w=!1,waitForQueueCompletion:T=!0,deferCleanup:E=!0,useQueueFenceForCleanup:D=!0,targetFieldRowsBuffer:k=null,targetFieldRowsBufferByteLength:A=null,preferSpatialGrid:M=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphRenderFieldWebGpu requires a WebGPU-like device`);if(typeof C!=`boolean`)throw TypeError(`retainMotionFieldBuffer must be a boolean`);if(!n&&!(t instanceof Float32Array))throw TypeError(`buildSphRenderFieldWebGpu requires renderRows or renderRowsBuffer`);if(t&&t.length%kn!==0)throw RangeError(`SPH render rows length must align to the render row stride`);if(l&&(!(l instanceof Float32Array)||l.length%Nn!==0))throw RangeError(`SPH product-event rows length must align to the product-event row stride`);ra(m),{fieldPadding:v,refEdgeM:y}=Ir(v,y);let N=er(m),F=Float32Array.from(N.recordValues),I=t?.length?t.length/kn:0,L=Fr(h??r?.particleCount??I,`particleCount`),ee=L*kn*Float32Array.BYTES_PER_ELEMENT;if(!n&&I!==L)throw RangeError(`particleCount must match exact host rows or fit the resident render-row buffer capacity`);let re=l?.length?l.length/Nn:0,R=Fr(g??re,`productEventCount`);if(!u&&R!==re)throw RangeError(`productEventCount must exactly match the host product-event rows`);let z=ca(a,L);if(i&&(o!=null&&o!==i.buffer||s!=null&&s!==i.authority))throw TypeError(`SPH render field rejected torn dispersed-medium child aliases`);let B=i?.buffer??o??null,V=i?.authority??s??null;if((B||V)&&!i)throw TypeError(`resident dispersed-medium rendering requires the exact branded child descriptor; buffer and authority aliases only corroborate it`);let H=!!(i||a||B||V);if(a&&(i||B||V))throw TypeError(`SPH render field accepts either dispersed-medium host rows or one authenticated resident buffer, not both`);let U=L*8*Float32Array.BYTES_PER_ELEMENT,oe=Number(B?.size);if((i||B||V)&&(i!=null&&(i.particleCount!==L||i.rowCount!==L||i.rowStrideFloats!==8||i.bufferByteLength!==U)||!B||!V||!ne(e,V,{upload:i,buffer:B,particleCount:L,rowCount:L,rowStrideFloats:8,bufferByteLength:U})||!Number.isSafeInteger(oe)||oe!==U))throw TypeError(`SPH render field rejected a torn or foreign dispersed-medium optics authority`);H?(la(m,z??V?.readyOpticalStateIds??[]),ua(m,v,y,z??V?.readyOpticalStateIds??[])):la(m);let W=x===yr,se=n||null,G=u||null,K=p??(G&&f?ae(f,e):null);if((f?.productEventLiveCountAuthority||te(f))&&!K)throw TypeError(`SPH render field rejected a torn product-event live-count authority`);if(K&&(!P(K,{handle:f,device:e})||!(Number(G?.size)>=R*Nn*Float32Array.BYTES_PER_ELEMENT)||f.productEventBuffer!==G||K.controlBuffer==null||K.controlPrefixByteLength!==ie||K.hostObserved!==!1||K.expectedRowCapacity!==R||K.expectedRowStrideVec4!==Nn/4||K.rowCapacity!==R||K.rowStrideFloats!==Nn))throw TypeError(`SPH render field GPU live-count authority does not match its product-event buffer capacity and row ABI`);if(c){if(r?.schroederSpatialSourceFamily!==c||r?.particleCount!==L||n==null)throw TypeError(`successor render field requires exact branded render rows and no unauthenticated product-event source`);if(ce(c,{device:e,particleCount:L}),!or(r,{device:e,sourceFamily:c,particleCount:L,renderRowsBuffer:n,renderRows:n?null:t}))throw TypeError(`successor render field requires module-authenticated render-row derivation`);if(!sr({device:e,sourceFamily:c,productEventRows:l,productEventBuffer:G,productEventSource:f,productEventCount:R,productEventLiveCountDescriptor:K}))throw TypeError(`successor render field requires exact branded render rows and no unauthenticated product-event source`)}if(i&&!c){let i=r?.schroederSpatialSourceFamily??null;if(!r||!or(r,{device:e,sourceFamily:i,particleCount:L,renderRowsBuffer:n,renderRows:n?null:t}))throw TypeError(`resident dispersed-medium rendering requires module-authenticated render-row lineage`)}if(i||r?.dispersedMediumOptics){let e=r?.dispersedMediumOptics??null;if(a!=null||i!==e||B!==(e?.buffer??null)||V!==(e?.authority??null))throw TypeError(`render field requires the exact dispersed-medium sidecar captured with its render rows`)}let le=se?G?`resident-render-rows-and-product-events-buffer`:`resident-render-rows-buffer`:G?`uploaded-render-rows-with-resident-product-events`:`uploaded-render-rows`,ue=R*Nn*Float32Array.BYTES_PER_ELEMENT,de=G||l?ue:Nn*Float32Array.BYTES_PER_ELEMENT,pe=H?U:8*Float32Array.BYTES_PER_ELEMENT,he=m.surfaceCount*An*Float32Array.BYTES_PER_ELEMENT,ge=m.totalFieldCells*jn*Float32Array.BYTES_PER_ELEMENT,_e=C?m.totalFieldCells*4*Float32Array.BYTES_PER_ELEMENT:0;C&&(ki(e,`render field motion`,_e),Ai(e,`render field motion`,_e)),ki(e,`render field cells`,ge),Ai(e,`render field cells`,ge);let Ce=Math.ceil(Math.max(1,m.maxFieldCellCount)/64),we=Math.max(1,m.surfaceCount);ji(e,`render field`,Ce,we),Pi(e,`render field source rows`,se,ee),Pi(e,`render field product events`,G,ue),Pi(e,`render field dispersed-medium optics`,B,U),K&&Pi(e,`render field product-history control`,K.controlBuffer,ie,{offset:K.controlOffsetBytes??0});let Te=0;if(k){let t=Ni(k.size,`targetFieldRowsBuffer.size`);if(Te=A==null?t:Ni(A,`targetFieldRowsBufferByteLength`),Te>t)throw RangeError(`targetFieldRowsBufferByteLength (${Te}) exceeds the actual GPU buffer capacity (${t})`);if(Te<ge)throw RangeError(`targetFieldRowsBuffer is too small (${Te}) for render field (${ge})`);Pi(e,`render field target cells`,k,ge)}let Ee=new Set,De=e=>(e&&Ee.add(e),e),{sourceRowsBuffer:Oe,sourceProductEventBuffer:ke,sourceDispersedMediumOpticsBuffer:Ae,productHistoryControlBufferOwned:je,productHistoryControlBuffer:Me,productHistoryGateParamsBuffer:Ne,surfaceBuffer:Pe,fieldRowsBufferBorrowed:Fe,fieldRowsBuffer:Ie,motionFieldBuffer:Le,paramsBuffer:Re,pipelineCacheStatus:ze,encoder:Be}=(()=>{try{let n=se||De(wi(e,`ulg-sph-render-field-source-rows`,t,Z.COPY_SRC)),r=G||De(wi(e,`ulg-sph-render-field-product-events`,l||new Float32Array(Nn),Z.COPY_SRC)),i=B||De(a?wi(e,`ulg-sph-render-field-dispersed-medium-optics`,a,Z.COPY_SRC):Ti(e,`ulg-sph-render-field-dispersed-medium-optics-disabled`,8*Float32Array.BYTES_PER_ELEMENT)),o=!K,s=K?.controlBuffer||De(Ti(e,`ulg-sph-render-field-product-history-control-disabled`,ie)),c=De(e.createBuffer({label:`ulg-sph-render-field-product-history-gate-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST}));e.queue.writeBuffer(c,0,Ui(K));let u=De(wi(e,`ulg-sph-render-field-surfaces`,F)),d=!!k,f=k||De(Ti(e,`ulg-sph-render-field-cells`,ge,Z.COPY_SRC)),p=C?De(Ti(e,`ulg-sph-render-field-motion`,_e,Z.COPY_SRC)):null,h=De(e.createBuffer({label:`ulg-sph-render-field-params`,size:32,usage:Z.UNIFORM|Z.COPY_DST})),g=G||l?R:0;e.queue.writeBuffer(h,0,Hi({particleCount:L,productEventCount:g,surfaceCount:m.surfaceCount,totalFieldCells:m.totalFieldCells,fieldPadding:v,refEdgeM:y,renderSmearDtS:b,dispersedMediumOpticsEnabled:H}));let x=Fi(n,ee,{label:`render field source rows`}),S=Fi(u,he,{label:`render field surfaces`}),w=Fi(f,ge,{label:`render field cells`}),T=Fi(r,de,{label:`render field product events`}),E={buffer:s,offset:K?.controlOffsetBytes??0,size:ie},D=Fi(i,pe,{label:`render field dispersed-medium optics`}),O=p?Fi(p,_e,{label:`render field motion`}):null,A=M?Tn({device:e,surfaceRecords:F,surfaceCount:m.surfaceCount,particleCount:L,productEventCount:g}):null,N=e.createCommandEncoder(),P=null;if(A)({pipelineCacheStatus:P}=On({device:e,encoder:N,plan:A,sourceRowsResource:x,surfaceResource:S,fieldRowsResource:w,paramsBuffer:h,productEventsResource:T,productHistoryControlResource:E,productHistoryGateParamsBuffer:c,dispersedOpticsResource:D,motionFieldResource:O}));else{let{pipeline:t,bindGroupLayout:n,cacheStatus:r}=fe(e,{cacheKey:C?`ulg-sph-render-field-v5-disjoint-bulk-dispersed-optics-motion-v0`:`ulg-sph-render-field-v5-disjoint-bulk-dispersed-optics`,label:`ulg-sph-render-field`,code:C?j:_,entryPoint:`main`,bindings:[q(0,`read-only-storage`),q(1,`read-only-storage`),q(2,`storage`),q(3,`uniform`),q(4,`read-only-storage`),q(5,`read-only-storage`),q(6,`uniform`),q(7,`read-only-storage`),...C?[q(8,`storage`)]:[]]});P=r;let i=e.createBindGroup({layout:n,entries:[{binding:0,resource:x},{binding:1,resource:S},{binding:2,resource:w},{binding:3,resource:{buffer:h}},{binding:4,resource:T},{binding:5,resource:E},{binding:6,resource:{buffer:c}},{binding:7,resource:D},...O?[{binding:8,resource:O}]:[]]}),a=N.beginComputePass();a.setPipeline(t),a.setBindGroup(0,i),a.dispatchWorkgroups(Ce,we),a.end()}return{sourceRowsBuffer:n,sourceProductEventBuffer:r,sourceDispersedMediumOpticsBuffer:i,productHistoryControlBufferOwned:o,productHistoryControlBuffer:s,productHistoryGateParamsBuffer:c,surfaceBuffer:u,fieldRowsBufferBorrowed:d,fieldRowsBuffer:f,motionFieldBuffer:p,paramsBuffer:h,pipelineCacheStatus:P,encoder:N}}catch(e){for(let e of Ee)e.destroy?.();throw e}})(),Ve=`not-submitted`,He=null,Ue,We=!1,Ge=!1,Ke=!1,qe=()=>{Ke||(Ke=!0,se||Oe.destroy?.(),G||ke.destroy?.(),B||Ae.destroy?.(),je&&Me.destroy?.(),Ne.destroy?.(),Pe.destroy?.(),Fe||Ie.destroy?.(),Le?.destroy?.(),Re.destroy?.())},Je=()=>{k&&rr(k)};try{if(W)T&&e.queue?.onSubmittedWorkDone?(e.queue.submit([Be.finish()]),Ge=!0,Je(),Ve=`queue-submitted`,He=`queue.submit`,await e.queue.onSubmittedWorkDone(),Ve=`queue-work-completed`,He=`queue.onSubmittedWorkDone`):(e.queue.submit([Be.finish()]),Ge=!0,Je(),Ve=e.queue?.onSubmittedWorkDone?`queue-submitted-gpu-handoff-no-cpu-fence`:`queue-submitted-no-explicit-completion`,He=e.queue?.onSubmittedWorkDone?`queue.submit(in-order-gpu-render-field-handoff)`:`queue.submit`,We=!!(e.queue?.onSubmittedWorkDone&&E)),Ue=new Float32Array;else{e.queue.submit([Be.finish()]),Ge=!0,Je(),Ve=`queue-submitted`,He=`queue.submit`;let t=await Ji(e,Ie,m.totalFieldCells*jn*Float32Array.BYTES_PER_ELEMENT,`ulg-sph-render-field-readback`);Ve=`readback-map-completed`,He=`mapAsync(readback-buffer)`,Ue=new Float32Array(t)}}catch(t){throw Ge?me(e,qe):qe(),t}if(!tr(m,N))throw me(e,qe),TypeError(`render surface table mutated while its GPU field submission was in flight`);let Ye=!1,Xe=Le?Object.freeze({schema:Mn,buffer:Le,byteLength:_e,rowCount:m.totalFieldCells,rowStrideFloats:4,rowStrideBytes:4*Float32Array.BYTES_PER_ELEMENT,fieldPadding:v,refEdgeM:y,sourceGenerationId:c?.sourceGenerationId??null,sourceVelocityLanes:Object.freeze([17,18,19]),momentWeight:`pre-smear-positive-particle-metaball-value`,immutable:!0,readback:!1,authoritativeStateMutation:!1,get destroyed(){return Ye},destroy(){return Ye?!1:(Ye=!0,Le.destroy?.(),!0)}}):null,Ze=!1,Qe=()=>{Ze||(Ze=!0,se||Oe.destroy?.(),G||ke.destroy?.(),B||Ae.destroy?.(),je&&Me.destroy?.(),Ne.destroy?.(),w||Pe.destroy?.(),!S&&!Fe&&Ie.destroy?.(),Re.destroy?.())},$e=!1;We&&D?$e=me(e,Qe):We?$e=!0:Qe();let et=be({ledgerId:`sph-render-field:${m.surfaceCount}:${m.totalFieldCells}:buffer-leases`,stateKey:`sph-render-field`,scope:`sph-render-field-buffer-leases`}),tt=[],nt=({resourceKey:e,resourceKind:t,buffer:n,byteLength:r,rowCount:i,expectedConsumers:a=[]})=>{ye(et,{resourceKey:e,resourceKind:t,stateFamily:`render-field`,ownerStage:`render-field-builder`,producerStage:`render-field-builder`,source:`buildSphRenderFieldWebGpu`,status:`resident-render-field-buffer-retained`,retained:!0,byteLength:r,rowCount:i,bufferLabel:n?.label,expectedConsumers:a});for(let t of a){let n=Se(et,{resourceKey:e,consumerStage:t,reason:`retained-render-field-buffer`});tt.push(n.leaseId)}},rt=`render-field:field-rows:${m.totalFieldCells}:${ge}`,it=`render-field:surface-table:${m.surfaceCount}:${m.records.byteLength}`;S&&nt({resourceKey:rt,resourceKind:`render-field-rows-buffer`,buffer:Ie,byteLength:ge,rowCount:m.totalFieldCells,expectedConsumers:[`material-interface-extraction`,`surface-vertex-extraction`]}),w&&nt({resourceKey:it,resourceKind:`render-field-surface-table-buffer`,buffer:Pe,byteLength:m.records.byteLength,rowCount:m.surfaceCount,expectedConsumers:[`surface-vertex-extraction`,`surface-draw-metadata`]});let at={schema:d,backend:`webgpu`,status:`render-field-built`,kernelScope:_r,schroederSpatialLineageMode:c?`authenticated-successor`:`non-schroeder`,schroederSpatialSourceFamily:c,schroederSpatialSourceFamilyStatus:c?.status??null,schroederSpatialSourceFamilyRole:c?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:c?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:c?.successorEpochIdentity??null,particleCount:L,dispersedMediumOpticsBound:H,dispersedMediumOpticsRowCount:H?L:0,dispersedMediumOpticsAuthority:B?`same-device-resident-authority`:a?`host-exact-particle-aligned-rows`:`absent`,dispersedMediumOpticsBufferByteLength:H?L*8*Float32Array.BYTES_PER_ELEMENT:0,productEventCount:G||l?R:0,productEventCountAuthority:K?`gpu-authored-filtered-live-prefix`:`host-exact-or-sparse-scan-bound`,productEventControlAuthentication:K?`full-eight-word-gpu-commit-gate`:`not-required-zero-control`,productEventControlHostObserved:K?.hostObserved??!1,productEventCountHostKnown:!K,productEventRowCapacity:K?.expectedRowCapacity??(G||l?R:0),productEventBufferBound:!!(G||l),productEventBufferByteLength:G||l?R*Nn*Float32Array.BYTES_PER_ELEMENT:0,surfaceCount:m.surfaceCount,totalFieldCells:m.totalFieldCells,maxFieldCellCount:m.maxFieldCellCount,surfaceTable:m,rowLayout:[...O],rowStrideFloats:jn,fieldRows:Ue,fieldRowByteLength:ge,fieldPadding:v,refEdgeM:y,renderFieldInputSource:le,readbackMode:W?yr:vr,queueCompletionStatus:Ve,queueCompletionMethod:He,pipelineCacheStatus:ze,renderFieldDeferredCleanup:$e,renderFieldReadback:!W,fullReadbackPerformed:!W,normalHotLoopReadbackFree:W,fieldRowsBufferRetained:!!S,fieldRowsBufferByteLength:S?ge:0,fieldRowsBufferBorrowed:Fe,fieldRowsBufferReused:Fe,fieldRowsBufferOwnedByResult:!Fe,motionField:Xe,motionFieldReadback:!1,surfaceBufferRetained:!!w,surfaceBufferByteLength:w?m.records.byteLength:0,residentBufferLeaseLedger:et,residentBufferLeaseSummary:J(et),residentBufferLeaseLedgerStatus:et.status,residentBufferLeaseResourceCount:et.resourceCount,residentBufferLeaseActiveLeaseCount:et.activeLeaseCount,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};if(S&&(at.fieldRowsBuffer=Ie),w&&(at.surfaceBuffer=Pe),at.takeMotionField=()=>{let e=Xe;return Xe=null,at.motionField=null,e?.destroyed?null:e},S||w||C){let e=new Set,t=()=>(at.residentBufferLeaseSummary=J(et),at.residentBufferLeaseLedgerStatus=at.residentBufferLeaseSummary.status,at.residentBufferLeaseResourceCount=at.residentBufferLeaseSummary.resourceCount,at.residentBufferLeaseActiveLeaseCount=at.residentBufferLeaseSummary.activeLeaseCount,at.residentBufferLeaseSummary);at.releaseRenderFieldBufferLeases=({status:e=`released`}={})=>{for(let t of tt)xe(et,t,{status:e});return t()};let n=(t,n)=>{e.has(t)||(e.add(t),n?.destroy?.())};at.destroyRenderFieldBuffers=({force:e=!1,releaseLeases:r=!1,reason:i=`render-field-buffer-cleanup`}={})=>(ur(at),Qe(),Xe?.destroy(),Xe=null,at.motionField=null,r&&at.releaseRenderFieldBufferLeases(),S&&ve(et,rt,()=>{Fe||n(rt,Ie)},{force:e,reason:i}),w&&ve(et,it,()=>{n(it,Pe)},{force:e,reason:i}),t())}return c&&(Qn.set(at,{active:!0,device:e,sourceFamily:c,particleCount:L,renderRowsSource:r,renderRowsBuffer:se,renderRows:se?null:t,dispersedMediumOpticsBuffer:B,dispersedMediumOptics:i,dispersedMediumOpticsRows:a,dispersedMediumOpticsAuthority:V,dispersedMediumOpticsSourceAuthenticated:!!(B&&V&&i&&i===r?.dispersedMediumOptics),productEventBuffer:G,productEventRows:l,productEventSource:f,productEventLiveCountDescriptor:K,productEventSourceAuthenticated:!!(G&&K),productEventCount:G||l?R:0,productEventRowCapacity:K?.expectedRowCapacity??(G||l?R:0),productEventCountAuthority:K?`gpu-authored-filtered-live-prefix`:`host-exact-or-sparse-scan-bound`,productEventControlAuthentication:K?`full-eight-word-gpu-commit-gate`:`not-required-zero-control`,surfaceTable:m,surfaceRecords:m.records,surfaceTableSnapshot:N,surfaceBuffer:at.surfaceBuffer??null,fieldRowsBuffer:at.fieldRowsBuffer??null,fieldRows:at.fieldRows,fieldRowByteLength:ge,fieldRowsBufferByteLength:at.fieldRowsBufferByteLength,rowStrideFloats:jn,fieldPadding:v,refEdgeM:y}),at.fieldRowsBuffer&&nr({buffer:at.fieldRowsBuffer,artifact:at,invalidate:()=>ur(at)})),at}async function Ga({device:t,sphParticleState:n,mlsMpmParticleState:r=null,sphParticleUpload:i=null,mlsMpmParticleUpload:a=null,sourceStateBuffer:o=null,sourceThermoBuffer:s=null,sourceIdentityBuffer:c=null,sourceMechanicsBuffer:l=null,schroederSpatialSourceFamily:u=null,retainRenderRowsBuffer:d=!1,readbackMode:f=vr,renderDomainBaseCount:p=0,renderDomainDropCount:m=0}={}){if(Or(n),!t?.createBuffer||!t.queue?.writeBuffer)throw TypeError(`extractSphRenderRowsWebGpu requires a WebGPU-like device`);let h=Fr(n.particleCount,`SPH render-row particleCount`),g=f===yr,_=o||i?.stateBuffer||null,y=s||i?.thermoBuffer||null,b=c||i?.identityBuffer||null,x=Mr({device:t,sphParticleUpload:i,particleCount:h,identityBuffer:b});if(x&&!F(i,{device:t,stateBuffer:_,thermoBuffer:y,identityBuffer:b}))throw TypeError(`SPH render rows rejected dispersed-medium optics paired with foreign particle-aligned source buffers`);let S=r?.mechanics instanceof Float32Array&&r.mechanics.length>=h*K,C=l||a?.mechanicsBuffer||null;if(u){if(g&&!d)throw TypeError(`successor render rows require a retained GPU handoff buffer when full readback is disabled`);ce(u,{device:t,particleCount:h,stateBuffer:_,thermoBuffer:y,identityBuffer:b,mechanicsBuffer:C})}let w=jr({sphParticleState:n,sphParticleUpload:i}),T=Ar({sphParticleState:n,sphParticleUpload:i});if(w){let e=[_?null:`state`,y?null:`thermo`,T&&!C?`mechanics`:null,b?null:`identity`].filter(Boolean);if(e.length>0)throw TypeError(`SPH render rows require authoritative resident ${e.join(`, `)} buffers`);let t=i?.identitySchema||n?.identitySchema||null,r=Math.max(0,Math.round(Q(i?.identityStrideBytes??n?.identityStrideBytes,0))),a=Math.max(0,Math.round(Q(i?.identityBufferByteLength??b?.size??n?.identityBufferByteLength??n?.identity?.byteLength,0))),o=B*Uint32Array.BYTES_PER_ELEMENT;if(t!==`peercompute.ulg.sph-gpu-particle-identity-buffer.v0`)throw TypeError(`SPH render rows require the authoritative particle identity schema`);if(r!==o)throw TypeError(`SPH render rows require the authoritative particle identity stride`);if(a<h*o)throw RangeError(`SPH render rows require identity capacity for every resident particle`)}let E=n.materialPropertyBankParticleSizeTable?.rows,O=Fr(n.materialPropertyBankParticleSizeTable?.rowCount??0,`packed material-bank particle-size row count`),k=i?.materialPropertyBankParticleSizeBuffer||null,A=k?Fr(i?.materialPropertyBankParticleSizeRowCount??0,`resident material-bank particle-size row count`):0,j=k?A:E?.byteLength>0?O:0,M=h*H*Float32Array.BYTES_PER_ELEMENT,N=h*se*Float32Array.BYTES_PER_ELEMENT,P=h*B*Uint32Array.BYTES_PER_ELEMENT,L=h*K*Float32Array.BYTES_PER_ELEMENT,ee=C||S?L:K*Float32Array.BYTES_PER_ELEMENT,te=j*16*Float32Array.BYTES_PER_ELEMENT,ne=j>0?te:16*Float32Array.BYTES_PER_ELEMENT,re=h*kn*Float32Array.BYTES_PER_ELEMENT,ie=Math.ceil(h/64);if(ji(t,`render rows`,ie),ki(t,`ulg-sph-render-rows`,Math.max(4,re)),Ai(t,`ulg-sph-render-rows`,Math.max(4,re)),Pi(t,`render rows source state`,_,M),Pi(t,`render rows source thermo`,y,N),Pi(t,`render rows source identity`,b,P),Pi(t,`render rows source mechanics`,C,L),Pi(t,`render rows material-bank particle-size rows`,k,te),!k&&j>0&&(!(E instanceof Float32Array)||E.byteLength<te))throw RangeError(`packed material-bank particle-size rows do not cover their advertised row count`);let R=new Set,ae=e=>(e&&R.add(e),e),{stateBuffer:V,thermoBuffer:U,identityBuffer:oe,mechanicsBuffer:W,materialBankParticleSizeBuffer:le,renderRowsBuffer:ue,useGpuHandoffBuffer:de,retainedRenderRowsBuffer:pe,maxSupportRadiusM:he,maxGasRadiusM:ge,paramsBuffer:_e,encoder:ve}=(()=>{try{let e=_||ae(wi(t,`ulg-sph-render-source-state`,n.state)),i=y||ae(wi(t,`ulg-sph-render-source-thermo`,n.thermo)),a=b||ae(wi(t,`ulg-sph-render-source-identity`,kr(n))),o=C||ae(wi(t,S?`ulg-sph-render-source-mechanics`:`ulg-sph-render-source-mechanics-empty`,S?r.mechanics:new Float32Array(K))),s=k||ae(wi(t,j>0?`ulg-sph-render-material-bank-particle-size-rows`:`ulg-sph-render-material-bank-particle-size-rows-empty`,j>0&&E?.byteLength>0?E:new Float32Array(16))),c=ae(Ti(t,`ulg-sph-render-rows`,re,Z.COPY_SRC)),l=g&&d&&re>0,u=l?ae(t.createBuffer({label:`ulg-sph-render-rows-retained-handoff`,size:Math.max(4,re),usage:Z.STORAGE|Z.COPY_SRC|Z.COPY_DST})):c,f=Q(n.smoothingLengthM,0)*dr,v=Q(n.smoothingLengthM,0)*fr,x=ae(t.createBuffer({label:`ulg-sph-render-rows-params`,size:pr,usage:Z.UNIFORM|Z.COPY_DST}));t.queue.writeBuffer(x,0,Bi({particleCount:h,renderDomainBaseCount:p,renderDomainDropCount:m,hasMechanics:!!(C||S),maxSupportRadiusM:f,maxGasRadiusM:v,materialBankParticleSizeRowCount:j}));let{pipeline:w,bindGroupLayout:T}=fe(t,{cacheKey:`ulg-sph-render-rows-v1`,label:`ulg-sph-render-rows`,code:D,entryPoint:`main`,bindings:[q(0,`read-only-storage`),q(1,`read-only-storage`),q(2,`storage`),q(3,`uniform`),q(4,`read-only-storage`),q(5,`read-only-storage`),q(6,`read-only-storage`)]}),O=t.createBindGroup({layout:T,entries:[{binding:0,resource:Fi(e,M,{label:`render rows source state`})},{binding:1,resource:Fi(i,N,{label:`render rows source thermo`})},{binding:2,resource:Fi(c,re,{label:`render rows output`})},{binding:3,resource:{buffer:x}},{binding:4,resource:Fi(o,ee,{label:`render rows source mechanics`})},{binding:5,resource:Fi(s,ne,{label:`render rows material-bank particle-size rows`})},{binding:6,resource:Fi(a,P,{label:`render rows source identity`})}]}),A=t.createCommandEncoder(),F=A.beginComputePass();return F.setPipeline(w),F.setBindGroup(0,O),F.dispatchWorkgroups(ie),F.end(),l&&A.copyBufferToBuffer(c,0,u,0,re),{stateBuffer:e,thermoBuffer:i,identityBuffer:a,mechanicsBuffer:o,materialBankParticleSizeBuffer:s,renderRowsBuffer:c,useGpuHandoffBuffer:l,retainedRenderRowsBuffer:u,maxSupportRadiusM:f,maxGasRadiusM:v,paramsBuffer:x,encoder:A}}catch(e){for(let e of R)e.destroy?.();throw e}})(),J,ye=`not-submitted`,be=null,xe=!1,Se=null,Ce=null,we=null,Te=!1,Ee=()=>{if(Te)return;Te=!0,we?.(),we=null;let e=Se??Ce;e&&z(u,e,{device:t}),Se=null,Ce=null;let n=new Set([_?null:V,y?null:U,b?null:oe,C?null:W,k?null:le,ue,pe,_e]);for(let e of n)e?.destroy?.()};try{x&&(we=I(t,x)),u&&(Se=G(u,{device:t,consumerStage:`sph-render-rows-gpu-submission`}))}catch(e){throw Ee(),e}try{t.queue.submit([ve.finish()])}catch(e){throw Ee(),e}if(Se){let e=Se;Se=null,d?Ce=e:me(t,()=>{z(u,e,{device:t})})}try{if(g)d?(ye=`queue-submitted-gpu-handoff-no-cpu-fence`,be=de?`queue.submit(in-order-gpu-copy-handoff)`:`queue.submit(in-order-gpu-buffer-handoff)`,xe=!0):t.queue?.onSubmittedWorkDone?(await t.queue.onSubmittedWorkDone(),ye=`queue-work-completed`,be=`queue.onSubmittedWorkDone`):(ye=`queue-submitted`,be=`queue.submit`),J=new Float32Array;else{ye=`queue-submitted`,be=`queue.submit`;let e=await Ji(t,ue,re);J=new Float32Array(e),ye=`readback-map-completed`,be=`mapAsync(readback-buffer)`}}catch(e){throw me(t,Ee),e}let De=null,Oe=!1,ke=[],Ae=()=>{for(let e of ke)e?.destroy?.();ke.length=0},je=()=>{Oe||(Oe=!0,De&&cr(De),Ae(),pe.destroy?.(),we?.(),we=null,Ce&&=(z(u,Ce,{device:t}),null))},Me=e=>{e?.destroy&&(xe?ke.push(e):e.destroy())};_||Me(V),y||Me(U),b||Me(oe),C||Me(W),k||Me(le),de&&Me(ue),d||je(),Me(_e);let Ne={schema:e,backend:`webgpu`,status:`render-rows-extracted`,kernelScope:gr,particleCount:n.particleCount,dispersedMediumOptics:x,dispersedMediumOpticsBound:!!x,dispersedMediumOpticsRowCount:x?.rowCount??0,dispersedMediumOpticsRowStrideFloats:x?.rowStrideFloats??0,dispersedMediumOpticsBufferByteLength:x?.bufferByteLength??0,dispersedMediumOpticsSource:x?`exact-sph-particle-upload-child`:`absent`,dispersedMediumOpticsHostReadback:!1,schroederSpatialSourceFamily:u,schroederSpatialSourceFamilyStatus:u?.status??null,schroederSpatialSourceFamilyRole:u?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:u?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:u?.successorEpochIdentity??null,schroederSpatialSourceFamilyAncestorGenerationId:u?.ancestorSpatialGenerationId??null,schroederSpatialSourceFamilyPositionAuthority:u?.positionAuthority??null,schroederSpatialSourceFamilySpatialQueryAuthority:u?.spatialQueryAuthority??null,schroederSpatialSourceFamilyPositionEpoch:u?.positionEpoch??null,schroederSpatialSourceFamilyTopologyEpoch:u?.topologyEpoch??null,rowLayout:[...v],rowStrideFloats:kn,renderRows:J,renderRowByteLength:re,renderRowsReadbackByteLength:J.byteLength,renderRowsBufferRetained:!!d,renderRowsBufferByteLength:re,readbackMode:g?yr:vr,renderRowsReadback:!g,compactRenderReadback:!g,fullReadbackPerformed:!g,normalHotLoopReadbackFree:g,renderRowsIncludeMechanicsVolume:!!(C||S),renderRowsIncludeParticleIdentity:!0,particleIdentityBufferSource:b?c?`explicit-source-buffer`:`sph-particle-upload`:`packed-sph-particle-state`,residentParticleAuthorityRequired:w,particleIdentityStrideUints:B,materialPropertyBankParticleSizeConsumer:Vi({rowCount:j,bufferSource:k?`sph-particle-upload`:j>0?`packed-sph-particle-state`:`empty-buffer`}),renderRowsGpuHandoffCopy:de,renderRowsHandoffMode:de?`gpu-copy-barrier`:`direct-render-row-buffer`,queueCompletionStatus:ye,queueCompletionMethod:be,renderRowsDeferredCleanup:xe,particleScaleStability:xi({particleCount:n.particleCount,rowProducer:`webgpu-shader`,maxSupportRadiusM:he,maxGasRadiusM:ge}),scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};if(d&&(Ne.renderRowsBuffer=pe,Ne.renderRowsBufferOwned=!0,Ne.destroyRenderRowsBuffer=je),u||x){let e={active:!0,device:t,sourceFamily:u,particleCount:n.particleCount,renderRowsBuffer:Ne.renderRowsBuffer??null,renderRows:Ne.renderRows,renderRowValues:Ne.renderRowsBuffer==null?Object.freeze(Array.from(Ne.renderRows)):null,dispersedMediumOptics:x,dispersedMediumOpticsBuffer:x?.buffer??null,dispersedMediumOpticsAuthority:x?.authority??null,rowStrideFloats:Ne.rowStrideFloats,rowLayout:Object.freeze([...Ne.rowLayout])};if(Xn.set(Ne,e),De=Ne,e.renderRowsBuffer){let t=Zn.get(e.renderRowsBuffer);t&&t!==Ne&&cr(t),Zn.set(e.renderRowsBuffer,Ne)}}return Ne}var Ka=Object.freeze({STORAGE:128,UNIFORM:64,COPY_DST:8}),qa=new WeakMap;function Ja(e){let t=qa.get(e);return t||(t=e.createBuffer({label:`ulg-solid-isosurface-dummy-thermo`,size:16,usage:Ka.STORAGE|Ka.COPY_DST}),qa.set(e,t)),t}var Ya=`
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
`;function Xa({device:e,encoder:t,family:n,renderField:r}={}){if(!e||!t||!n||n.destroyed||n.device!==e||!(n.memberCount>0)||!n.frameBuffer||!n.memberBuffer||!n.latticeBuffer||!r?.fieldRowsBuffer||!Array.isArray(r?.surfaceTable?.metadata))return null;let i=Number(r.refEdgeM),a=Number(r.fieldPadding);if(!(i>0)||!Number.isFinite(a))return null;let o=Array.isArray(n.materials)&&n.materials.length>0?n.materials:[null],s=new Map;for(let e=0;e<o.length;e+=1){let t=o[e],r=e===0&&Number(n.thermal?.materialId)>0?Number(n.thermal.materialId):t?U(t):0;if(!(r>0))continue;let i=s.get(r);i||(i={materialId:r,materialKey:t,bodyIndices:[],usesFamilyThermal:e===0&&!!n.thermalStage?.thermoBuffer},s.set(r,i)),i.bodyIndices.push(e),e===0&&n.thermalStage?.thermoBuffer&&(i.usesFamilyThermal=!0)}if(s.size===0)return null;let c=fe(e,{cacheKey:`ulg-solid-isosurface-field-splat.v2`,label:`ulg-solid-isosurface-field-splat`,code:Ya,entryPoint:`splat_rigid_solid_isosurface`,bindings:[q(0,`uniform`),q(1,`read-only-storage`),q(2,`read-only-storage`),q(3,`read-only-storage`),q(4,`read-only-storage`),q(5,`storage`)]}),l=[];for(let o of s.values()){let u=r.surfaceTable.metadata.find(e=>Number(e?.materialId)===o.materialId&&Number(e?.phaseId)===1&&Number(e?.opticalStateId||0)===0);if(!u)continue;let d=Math.floor(Number(u.resolution)||0),f=Math.floor(Number(u.fieldOffset)||0);if(!(d>0))continue;let p=Number(u.isolation)||.25,m=Number(u.subtract)||12,h=Number(u.strength)||.02,g=Number(u.particleRadiusScale)>0?Number(u.particleRadiusScale):0,_=Array.isArray(u.colorLinear)&&u.colorLinear.length>=3?u.colorLinear:[.78,.9,.98],v=o.usesFamilyThermal&&!!n.thermalStage?.thermoBuffer,y=v?n.thermalStage.thermoBuffer:Ja(e),b=o.bodyIndices[0]??0,x=Number(n.bodyTemperaturesK?.[b]),S=Number.isFinite(x)&&x>0?x:Number(n.thermal?.meltTemperatureK)?Math.min(273.15,Number(n.thermal.meltTemperatureK)-10):273.15,C=[0,0,0,0];if(s.size>1)for(let e of o.bodyIndices){let t=e>>>5;t<4&&(C[t]=(C[t]|1<<(e&31))>>>0)}let w=e.createBuffer({label:`ulg-solid-isosurface-field-splat-params-${o.materialId}`,size:80,usage:Ka.UNIFORM|Ka.COPY_DST}),T=new ArrayBuffer(80),E=new Uint32Array(T),D=new Float32Array(T);E.set([n.memberCount,d,f,+!!v],0),D.set([a,i,p,m],4),D.set([h,g,S,0],8),D.set([Number(_[0])||.78,Number(_[1])||.9,Number(_[2])||.98,0],12),E.set(C,16),e.queue.writeBuffer(w,0,T);let O=e.createBindGroup({layout:c.bindGroupLayout,entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:n.frameBuffer}},{binding:2,resource:{buffer:n.memberBuffer}},{binding:3,resource:{buffer:n.latticeBuffer}},{binding:4,resource:{buffer:y}},{binding:5,resource:{buffer:r.fieldRowsBuffer}}]}),k=t.beginComputePass({label:`ulg-solid-isosurface-field-splat-${o.materialId}`});k.setPipeline(c.pipeline),k.setBindGroup(0,O),k.dispatchWorkgroups(Math.ceil(d**3/64)),k.end(),l.push(w)}return l.length===0?null:l.length===1?l[0]:{surfaceCount:l.length,destroy(){for(let e of l)try{e.destroy()}catch{}}}}var Za=v.length;N.length;var Qa=O.length,$a=k.length,eo=`full-parity-readback`,to=`no-full-readback`,no=`sph-resident-material-interface-source-local-splat`,ro=1024,io=new WeakMap;function ao(e,{device:t,sourceFamily:n,particleCount:r,fieldRowsBuffer:i=null,fieldRows:a=null,surfaceBuffer:o=null,surfaceTable:s=null}={}){let c=io.get(e);return!!(c&&c.active===!0&&c.device===t&&c.sourceFamily===n&&c.particleCount===r&&e?.schroederSpatialSourceFamily===c.sourceFamily&&e?.particleCount===c.particleCount&&(e?.fieldRowsBuffer??null)===c.fieldRowsBuffer&&e?.fieldRows===c.fieldRows&&(e?.surfaceBuffer??null)===c.surfaceBuffer&&e?.surfaceTable===c.surfaceTable&&e?.rowStrideFloats===c.rowStrideFloats&&e?.fieldRowByteLength===c.fieldRowByteLength&&e?.fieldRowsBufferByteLength===c.fieldRowsBufferByteLength&&e?.fieldPadding===c.fieldPadding&&e?.refEdgeM===c.refEdgeM&&e?.productEventCount===0&&e?.productEventBufferBound===!1&&tr(e?.surfaceTable,c.surfaceTableSnapshot)&&(i==null||c.fieldRowsBuffer===i)&&(a==null||c.fieldRows===a)&&(o==null||c.surfaceBuffer===o)&&(s==null||c.surfaceTable===s)&&(c.fieldRowsBuffer==null||ir(c.fieldRowsBuffer,e)))}function oo(e){let t=io.get(e);!t||t.active!==!0||(t.active=!1,t.fieldRowsBuffer&&ar(t.fieldRowsBuffer,e))}var so={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},co={READ:globalThis.GPUMapMode?.READ??1},lo=`
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
`,uo=`
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
`;function fo(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function po(e){if(e?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`||!(e.records instanceof Float32Array))throw TypeError(`source-local material-interface field requires a render-field surface table`)}function mo(e,t,n,r=0){let i=Math.max(4,n.byteLength),a=e.createBuffer({label:t,size:i,usage:so.STORAGE|so.COPY_DST|r});return n.byteLength>0&&e.queue.writeBuffer(a,0,n),a}function ho(e,t,n,r=0){return e.createBuffer({label:t,size:Math.max(4,n),usage:so.STORAGE|so.COPY_DST|r})}function go({particleCount:e,productEventCount:t,surfaceCount:n,totalFieldCells:r,fieldPadding:i,refEdgeM:a,densityScale:o,sourceCount:s}){let c=new ArrayBuffer(32),l=new DataView(c);return l.setUint32(0,e,!0),l.setUint32(4,n,!0),l.setUint32(8,r,!0),l.setUint32(12,t,!0),l.setFloat32(16,i,!0),l.setFloat32(20,a,!0),l.setFloat32(24,o,!0),l.setUint32(28,s,!0),c}async function _o(e,t,n,r=`ulg-sph-material-interface-source-local-readback`){let i=e.createBuffer({label:r,size:Math.max(4,n),usage:so.COPY_DST|so.MAP_READ}),a=e.createCommandEncoder();a.copyBufferToBuffer(t,0,i,0,Math.max(4,n)),e.queue.submit([a.finish()]),await i.mapAsync(co.READ);let o=i.getMappedRange().slice(0,n);return i.unmap(),i.destroy?.(),o}function vo(e,t){let n=Math.max(0,Math.round(fo(t,0))),r=0;for(let t of e.metadata||[]){let e=Math.max(1,Math.round(fo(t.resolution,1))),i=Math.max(0,Math.round(fo(t.fieldCellCount,e**3))),a=Math.max(1e-12,fo(t.subtract,1e-12)),o=Math.sqrt(Math.abs(fo(t.strength,0))/a),s=Math.min(e-1,Math.ceil(o*e)+1);r+=Math.min(i,(s*2+1)**3)*n}let i=Math.max(0,Math.round(fo(e.totalFieldCells,0)))*n;return{sourceCount:n,estimatedCellVisits:r,denseCellParticlePairs:i,estimatedVisitRatio:i>0?r/i:0}}async function yo({device:e,renderRows:t,renderRowsBuffer:n=null,renderRowsSource:r=null,schroederSpatialSourceFamily:i=r?.schroederSpatialSourceFamily??null,productEventRows:a=null,productEventBuffer:o=null,surfaceTable:s,particleCount:c=null,productEventCount:l=null,fieldPadding:u=.22,refEdgeM:f=10,readbackMode:p=to,retainFieldRowsBuffer:m=!0,retainSurfaceBuffer:h=!0,retainSourceIndexFieldBuffer:g=!0,waitForQueueCompletion:_=!1,deferCleanup:v=!0,useQueueFenceForCleanup:b=!0,targetFieldRowsBuffer:x=null,targetFieldRowsBufferByteLength:S=null,source:C=`resident-physics-material-interface-source-field`,sourceCadence:w=`resident-physics-stage`}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphMaterialInterfaceSourceFieldLocalWebGpu requires a WebGPU-like device`);if(!n&&!(t instanceof Float32Array))throw TypeError(`buildSphMaterialInterfaceSourceFieldLocalWebGpu requires renderRows or renderRowsBuffer`);if(t&&t.length%Za!==0)throw RangeError(`SPH render rows length must align to the render row stride`);if(a&&(!(a instanceof Float32Array)||a.length%$a!==0))throw RangeError(`SPH product-event rows length must align to the product-event row stride`);po(s);let T=Math.max(0,Math.round(fo(c??(t?.length?t.length/Za:0),0))),E=Math.max(0,Math.round(fo(l??(a?.length?a.length/$a:0),0)));if(i){if(r?.schroederSpatialSourceFamily!==i||r?.particleCount!==T||n==null||n&&r?.renderRowsBuffer!==n||E!==0||o!=null||a!=null)throw TypeError(`source-local field requires the exact render-row artifact derived from its successor source family`);if(ce(i,{device:e,particleCount:T}),!or(r,{device:e,sourceFamily:i,particleCount:T,renderRowsBuffer:n,renderRows:n?null:t}))throw TypeError(`source-local field requires module-authenticated successor render rows`)}let D=T+(o||a?E:0),k=p===to,A=s.totalFieldCells*Qa*Float32Array.BYTES_PER_ELEMENT,j=s.totalFieldCells*Uint32Array.BYTES_PER_ELEMENT,M=x?Math.max(0,Math.round(fo(S??x.size??x.byteLength??0,0))):0,N=x?Math.max(0,Math.round(fo(x.size??x.byteLength??x.byteLengthBytes??0,0))):0;if(x&&N<=0)throw RangeError(`targetFieldRowsBuffer must expose its actual GPU buffer capacity`);if(x&&N>0&&M>N)throw RangeError(`targetFieldRowsBufferByteLength (${M}) exceeds the actual GPU buffer capacity (${N})`);let P=N>0?Math.min(M,N):M;if(x&&P<A)throw RangeError(`targetFieldRowsBuffer is too small (${P}) for source-local material-interface field (${A})`);let F=n||null,I=o||null,L=!!x,ee=F||mo(e,`ulg-sph-material-interface-source-local-render-rows`,t,so.COPY_SRC),te=I||mo(e,`ulg-sph-material-interface-source-local-product-events`,a||new Float32Array($a),so.COPY_SRC),ne=mo(e,`ulg-sph-material-interface-source-local-surfaces`,s.records,so.COPY_SRC),re=ho(e,`ulg-sph-material-interface-source-local-density-atomic`,s.totalFieldCells*Uint32Array.BYTES_PER_ELEMENT,so.COPY_SRC),ie=ho(e,`ulg-sph-material-interface-source-local-source-index-atomic`,s.totalFieldCells*Uint32Array.BYTES_PER_ELEMENT,so.COPY_SRC),R=x||ho(e,`ulg-sph-material-interface-source-local-field-cells`,s.totalFieldCells*Qa*Float32Array.BYTES_PER_ELEMENT,so.COPY_SRC),ae=e.createBuffer({label:`ulg-sph-material-interface-source-local-params`,size:32,usage:so.UNIFORM|so.COPY_DST});e.queue.writeBuffer(ae,0,go({particleCount:T,productEventCount:I||a?E:0,surfaceCount:s.surfaceCount,totalFieldCells:s.totalFieldCells,fieldPadding:u,refEdgeM:f,densityScale:ro,sourceCount:D}));let B=fe(e,{cacheKey:`ulg-sph-material-interface-source-local-splat-v1`,label:`ulg-sph-material-interface-source-local-splat`,code:lo,entryPoint:`main`,bindings:[q(0,`read-only-storage`),q(1,`read-only-storage`),q(2,`storage`),q(3,`uniform`),q(4,`read-only-storage`),q(5,`storage`)]}),V=e.createBindGroup({layout:B.bindGroupLayout,entries:[{binding:0,resource:{buffer:ee}},{binding:1,resource:{buffer:ne}},{binding:2,resource:{buffer:re}},{binding:3,resource:{buffer:ae}},{binding:4,resource:{buffer:te}},{binding:5,resource:{buffer:ie}}]}),H=fe(e,{cacheKey:`ulg-sph-material-interface-source-local-resolve-v1`,label:`ulg-sph-material-interface-source-local-resolve`,code:uo,entryPoint:`main`,bindings:[q(0,`read-only-storage`),q(1,`storage`),q(2,`storage`),q(3,`uniform`)]}),U=e.createBindGroup({layout:H.bindGroupLayout,entries:[{binding:0,resource:{buffer:ne}},{binding:1,resource:{buffer:re}},{binding:2,resource:{buffer:R}},{binding:3,resource:{buffer:ae}}]}),oe=e.createCommandEncoder(),W=oe.beginComputePass();W.setPipeline(B.pipeline),W.setBindGroup(0,V),W.dispatchWorkgroups(Math.max(1,Math.ceil(Math.max(1,D)/64)),Math.max(1,s.surfaceCount)),W.end();let se=oe.beginComputePass();se.setPipeline(H.pipeline),se.setBindGroup(0,U),se.dispatchWorkgroups(Math.max(1,Math.ceil(Math.max(1,s.maxFieldCellCount)/64)),Math.max(1,s.surfaceCount)),se.end();let K=`not-submitted`,le=null,ue=new Float32Array,de=!1,pe=null;i&&(pe=G(i,{device:e,consumerStage:`sph-material-interface-source-field-gpu-submission`}));try{e.queue.submit([oe.finish()])}catch(t){throw pe&&=(z(i,pe,{device:e}),null),t}if(x&&rr(x),pe){let t=pe;pe=null,me(e,()=>{z(i,t,{device:e})})}if(k)_&&e.queue?.onSubmittedWorkDone?(K=`queue-submitted`,le=`queue.submit`,await e.queue.onSubmittedWorkDone(),K=`queue-work-completed`,le=`queue.onSubmittedWorkDone`):(K=e.queue?.onSubmittedWorkDone?`queue-submitted-gpu-handoff-no-cpu-fence`:`queue-submitted-no-explicit-completion`,le=e.queue?.onSubmittedWorkDone?`queue.submit(in-order-gpu-source-local-field-handoff)`:`queue.submit`,de=!!(e.queue?.onSubmittedWorkDone&&v));else{K=`queue-submitted`,le=`queue.submit`;let t=await _o(e,R,A,`ulg-sph-material-interface-source-local-field-readback`);ue=new Float32Array(t),K=`readback-map-completed`,le=`mapAsync(readback-buffer)`}let he=!1,ge=()=>{he||(he=!0,F||ee.destroy?.(),I||te.destroy?.(),re.destroy?.(),ae.destroy?.(),h||ne.destroy?.(),!m&&!L&&R.destroy?.(),g||ie.destroy?.())},_e=!1;de&&b?_e=me(e,ge):de?_e=!0:ge();let ve=vo(s,D),J={schema:d,backend:`webgpu-source-local`,status:`render-field-built`,kernelScope:no,sourceLocalSourceField:!0,schroederSpatialSourceFamily:i,schroederSpatialSourceFamilyStatus:i?.status??null,schroederSpatialSourceFamilyRole:i?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:i?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:i?.successorEpochIdentity??null,schroederSpatialSourceFamilyAncestorGenerationId:i?.ancestorSpatialGenerationId??null,schroederSpatialSourceFamilyPositionAuthority:i?.positionAuthority??null,schroederSpatialSourceFamilySpatialQueryAuthority:i?.spatialQueryAuthority??null,schroederSpatialSourceFamilyPositionEpoch:i?.positionEpoch??null,schroederSpatialSourceFamilyTopologyEpoch:i?.topologyEpoch??null,particleCount:T,productEventCount:I||a?E:0,productEventBufferBound:!!(I||a),productEventBufferByteLength:I||a?E*$a*Float32Array.BYTES_PER_ELEMENT:0,surfaceCount:s.surfaceCount,totalFieldCells:s.totalFieldCells,maxFieldCellCount:s.maxFieldCellCount,surfaceTable:s,rowLayout:[...O],rowStrideFloats:Qa,fieldRows:ue,fieldRowByteLength:A,fieldPadding:u,refEdgeM:f,renderFieldInputSource:F?`resident-render-rows-buffer-source-local`:`uploaded-render-rows-source-local`,readbackMode:k?to:eo,queueCompletionStatus:K,queueCompletionMethod:le,pipelineCacheStatus:B.cacheStatus===`pipeline-cache-hit`&&H.cacheStatus===`pipeline-cache-hit`?`pipeline-cache-hit`:`pipeline-cache-miss`,sourceLocalSplatPipelineCacheStatus:B.cacheStatus,sourceLocalResolvePipelineCacheStatus:H.cacheStatus,renderFieldDeferredCleanup:_e,renderFieldReadback:!k,fullReadbackPerformed:!k,normalHotLoopReadbackFree:k,fieldRowsBufferRetained:!!m,fieldRowsBufferByteLength:m?A:0,fieldRowsBufferBorrowed:L,fieldRowsBufferReused:L,fieldRowsBufferOwnedByResult:!L,surfaceBufferRetained:!!h,surfaceBufferByteLength:h?s.records.byteLength:0,sourceIndexFieldSchema:`peercompute.ulg.sph-material-interface-source-index-field.v0`,sourceIndexFieldStatus:g?`source-local-source-index-field-retained`:`source-local-source-index-field-transient`,sourceIndexFieldBufferRetained:!!g,sourceIndexFieldBufferByteLength:g?j:0,sourceIndexFieldStrideUints:1,sourceLocalDensityScale:ro,sourceLocalSourceCount:D,sourceLocalEstimatedCellVisits:ve.estimatedCellVisits,sourceLocalDenseCellParticlePairs:ve.denseCellParticlePairs,sourceLocalEstimatedVisitRatio:ve.estimatedVisitRatio,sourceLocalDispatchWorkgroups:{splatX:Math.max(1,Math.ceil(Math.max(1,D)/64)),splatY:Math.max(1,s.surfaceCount),resolveX:Math.max(1,Math.ceil(Math.max(1,s.maxFieldCellCount)/64)),resolveY:Math.max(1,s.surfaceCount)},scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};m&&(J.fieldRowsBuffer=R),h&&(J.surfaceBuffer=ne),g&&(J.sourceIndexFieldBuffer=ie),i&&(io.set(J,{active:!0,device:e,sourceFamily:i,particleCount:T,fieldRowsBuffer:J.fieldRowsBuffer??null,fieldRows:J.fieldRows,surfaceBuffer:J.surfaceBuffer??null,surfaceTable:s,surfaceRecords:s.records,surfaceTableSnapshot:er(s),renderRowsSource:r,renderRowsBuffer:F,renderRows:F?null:t,productEventBuffer:null,productEventRows:null,productEventCount:0,fieldPadding:u,refEdgeM:f,rowStrideFloats:Qa,fieldRowByteLength:A,fieldRowsBufferByteLength:J.fieldRowsBufferByteLength}),J.fieldRowsBuffer&&nr({buffer:J.fieldRowsBuffer,artifact:J,invalidate:()=>oo(J)}));let ye=!1,be=()=>{ye||(ye=!0,oo(J),L||R.destroy?.(),ne.destroy?.(),ie.destroy?.())};return{schema:y,backend:`webgpu-source-local`,status:`material-interface-source-field-ready`,source:C,sourceCadence:w,sourceRenderField:J,sourceRenderFieldSchema:J.schema,sourceRenderFieldBackend:J.backend,sourceRenderFieldStatus:J.status,sourceRenderFieldReadback:!!J.renderFieldReadback,sourceRenderFieldReadbackMode:J.readbackMode??null,sourceRenderFieldQueueCompletionStatus:J.queueCompletionStatus??null,sourceRenderFieldQueueCompletionMethod:J.queueCompletionMethod??null,sourceRenderFieldPipelineCacheStatus:J.pipelineCacheStatus??null,kernelScope:no,sourceLocalSourceField:!0,schroederSpatialSourceFamily:i,schroederSpatialSourceFamilyStatus:i?.status??null,schroederSpatialSourceFamilyRole:i?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:i?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:i?.successorEpochIdentity??null,schroederSpatialSourceFamilyAncestorGenerationId:i?.ancestorSpatialGenerationId??null,schroederSpatialSourceFamilyPositionAuthority:i?.positionAuthority??null,schroederSpatialSourceFamilySpatialQueryAuthority:i?.spatialQueryAuthority??null,schroederSpatialSourceFamilyPositionEpoch:i?.positionEpoch??null,schroederSpatialSourceFamilyTopologyEpoch:i?.topologyEpoch??null,sourceLocalDensityScale:ro,sourceLocalSourceCount:D,sourceLocalEstimatedCellVisits:ve.estimatedCellVisits,sourceLocalDenseCellParticlePairs:ve.denseCellParticlePairs,sourceLocalEstimatedVisitRatio:ve.estimatedVisitRatio,sourceLocalSplatPipelineCacheStatus:B.cacheStatus,sourceLocalResolvePipelineCacheStatus:H.cacheStatus,particleCount:J.particleCount,productEventCount:J.productEventCount,surfaceCount:J.surfaceCount,totalFieldCells:J.totalFieldCells,maxFieldCellCount:J.maxFieldCellCount,surfaceTable:J.surfaceTable,rowLayout:J.rowLayout,rowStrideFloats:J.rowStrideFloats,fieldRows:J.fieldRows,fieldRowByteLength:J.fieldRowByteLength,fieldPadding:J.fieldPadding,refEdgeM:J.refEdgeM,fieldRowsBuffer:J.fieldRowsBuffer||null,surfaceBuffer:J.surfaceBuffer||null,fieldRowsBufferRetained:!!J.fieldRowsBufferRetained,fieldRowsBufferByteLength:J.fieldRowsBufferByteLength??0,fieldRowsBufferBorrowed:!!J.fieldRowsBufferBorrowed,fieldRowsBufferReused:!!J.fieldRowsBufferReused,fieldRowsBufferOwnedByResult:J.fieldRowsBufferOwnedByResult??null,surfaceBufferRetained:!!J.surfaceBufferRetained,surfaceBufferByteLength:J.surfaceBufferByteLength??0,sourceIndexFieldSchema:J.sourceIndexFieldSchema,sourceIndexFieldStatus:J.sourceIndexFieldStatus,sourceIndexFieldBuffer:J.sourceIndexFieldBuffer||null,sourceIndexFieldBufferRetained:!!J.sourceIndexFieldBufferRetained,sourceIndexFieldBufferByteLength:J.sourceIndexFieldBufferByteLength??0,sourceIndexFieldStrideUints:J.sourceIndexFieldStrideUints??1,readbackMode:J.readbackMode??null,queueCompletionStatus:J.queueCompletionStatus??null,queueCompletionMethod:J.queueCompletionMethod??null,normalHotLoopReadbackFree:!!J.normalHotLoopReadbackFree,releaseMaterialInterfaceSourceFieldLeases(){return null},destroyMaterialInterfaceSourceFieldBuffers(){return ge(),be(),null},scientificValidation:!1,sphValidation:!1,forceCouplingValidation:!1,fullPhysicsValidation:!1}}var bo=`peercompute.ulg.sph-webgpu-marching-cubes-extension-adapter.v0`,xo=`peercompute.ulg.sph-webgpu-marching-cubes-extension-execution.v0`,So=`peercompute.ulg.sph-webgpu-marching-cubes-extension-preflight.v0`,Co=`peercompute.webgpu-marching-cubes.compact-position-rows.v0`,wo=`peercompute.ulg.sph-webgpu-marching-cubes-extension-translation.v0`,To=`peercompute.ulg.sph-webgpu-marching-cubes-buffer-volume-descriptor.v0`,Eo=`peercompute.ulg.sph-gpu-render-surface-vertex-row.v0`,Do=`scalar-buffer`,Oo=`peercompute.webgpu-marching-cubes.layout.scalar-field-f32.v0`,ko=`full-parity-readback`,Ao=`no-full-readback`,jo={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,VERTEX:globalThis.GPUBufferUsage?.VERTEX??32,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256},Mo={READ:globalThis.GPUMapMode?.READ??1},No=64,Po=new WeakMap,Fo=new WeakMap,Io=new WeakMap,Lo=new WeakMap,Ro=new WeakMap,zo=new WeakMap;function Bo(e){return ArrayBuffer.isView(e)?new Uint8Array(e.buffer,e.byteOffset,e.byteLength).slice():null}function Vo(e,t){if(t==null)return e==null;if(!ArrayBuffer.isView(e)||e.byteLength!==t.byteLength)return!1;let n=new Uint8Array(e.buffer,e.byteOffset,e.byteLength);for(let e=0;e<n.length;e+=1)if(n[e]!==t[e])return!1;return!0}function Ho(e,t,n){if(!t||typeof t!=`object`)return;let r=e.get(t);r&&r!==n&&(r.active=!1),e.set(t,n)}function Uo(e,t){if(!t||typeof t!=`object`)return;let n=e.get(t);n&&(n.active=!1),e.delete(t)}function Wo(e){return!!(e?.schroederSpatialSourceFamily||e?.schroederSpatialSourceFamilyStatus||e?.schroederSpatialSourceFamilyRole||e?.schroederSpatialSourceGenerationId!=null||e?.schroederSpatialSuccessorEpochIdentity||e?.schroederSpatialSourceFamilyAncestorGenerationId!=null||e?.schroederSpatialSourceFamilyPositionAuthority||e?.schroederSpatialSourceFamilySpatialQueryAuthority!=null||e?.schroederSpatialSourcePositionAuthority||e?.schroederSpatialSourceQueryAuthority!=null)}function Go(e){return{schroederSpatialSourceFamily:e??null,schroederSpatialSourceFamilyStatus:e?.status??null,schroederSpatialSourceFamilyRole:e?.sourceFamilyRole??null,schroederSpatialSourceGenerationId:e?.sourceGenerationId??null,schroederSpatialSuccessorEpochIdentity:e?.successorEpochIdentity??null,schroederSpatialSourcePositionAuthority:e?.positionAuthority??null,schroederSpatialSourceQueryAuthority:e?.spatialQueryAuthority??null}}function Ko(e,t){return e?.schroederSpatialSourceFamily===t&&e?.schroederSpatialSourceFamilyStatus===t?.status&&e?.schroederSpatialSourceFamilyRole===t?.sourceFamilyRole&&e?.schroederSpatialSourceGenerationId===t?.sourceGenerationId&&e?.schroederSpatialSuccessorEpochIdentity===t?.successorEpochIdentity&&e?.schroederSpatialSourcePositionAuthority===t?.positionAuthority&&e?.schroederSpatialSourceQueryAuthority===t?.spatialQueryAuthority}var qo=`
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
`,Jo=`
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
`;function Yo(e){return(typeof e==`object`||typeof e==`function`)&&e!==null}function $(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function Xo(e){return typeof e==`string`&&e.length>0?e:null}function Zo(e,t=[0,1,0]){let n=Array.isArray(e)||ArrayBuffer.isView(e)?e:t;return[$(n[0],t[0]),$(n[1],t[1]),$(n[2],t[2])]}function Qo(e,t){return e.every(Number.isFinite)&&t.every(Number.isFinite)&&e.every((e,n)=>e<=t[n])}function $o({min:e=null,max:t=null}={}){let n=Zo(e,[NaN,NaN,NaN]),r=Zo(t,[NaN,NaN,NaN]),i=Qo(n,r);return{enabled:i,status:i?`position-clamp-ready`:`position-clamp-disabled`,minM:i?n:[0,0,0],maxM:i?r:[0,0,0]}}function es(e,t=[0,1,0]){let n=Zo(e,t),r=Math.hypot(n[0],n[1],n[2]);return r>1e-12?[n[0]/r,n[1]/r,n[2]/r]:[...t]}function ts({resolution:e=null,fieldPadding:t=null,refEdgeM:n=null,positionGridBias:r=-.5}={}){let i=Math.max(0,Math.round($(e,0))),a=$(t,NaN),o=$(n,NaN),s=1-2*a;if(!(i>0&&Number.isFinite(a)&&Number.isFinite(o)&&o>0&&s>1e-12))return Object.freeze({enabled:!1,status:`position-transform-disabled`,resolution:i||null,fieldPadding:Number.isFinite(a)?a:null,refEdgeM:Number.isFinite(o)?o:null,scaleM:1,originM:Object.freeze([0,0,0]),gridBias:0});let c=o/(s*i),l=-a*o/s;return Object.freeze({enabled:!0,status:`ulg-render-field-grid-to-world-transform-ready`,resolution:i,fieldPadding:a,refEdgeM:o,scaleM:c,originM:Object.freeze([l,l,l]),gridBias:$(r,-.5)})}function ns(e,t){if(!Qo(e,t))return null;let n=[(e[0]+t[0])*.5,(e[1]+t[1])*.5,(e[2]+t[2])*.5];return{minM:[...e],maxM:[...t],centerM:n,radiusM:Math.hypot(t[0]-n[0],t[1]-n[1],t[2]-n[2])}}function rs({positionTransform:e=null,positionClamp:t=null}={}){if(t?.enabled)return ns(t.minM,t.maxM);if(e?.enabled){let t=$(e.scaleM,1),n=Zo(e.originM,[0,0,0]),r=Math.max(1,Math.round($(e.resolution,1))),i=Math.max(0,r-1)*t;return ns(n,[n[0]+i,n[1]+i,n[2]+i])}return null}function is(e,t,n={}){return{schema:To,ok:!1,status:e,reason:t,sourceType:Do,scalarLayoutName:Oo,scalarType:`f32`,extensionDescriptorFactory:`createBufferVolumeDescriptor`,...n}}function as(e=null){let t=e?.role??e?.renderDomainRole??null;if(t===`drop`||t===`base`)return t;let n=String(e?.renderDomainKey??e?.surfaceKey??``).toLowerCase();if(n.includes(`drop`))return`drop`;if(n.includes(`base`))return`base`;let r=Math.round($(e?.renderDomainId,0));return r===1?`base`:r===2?`drop`:null}function os(e){return typeof e==`string`?e.trim().toLowerCase():``}function ss(e,t){if(!e||e.schema!==`peercompute.ulg.algorithm-material-surface-extraction-rows.v0`)return{status:`algorithm-surface-policy-rows-not-supplied`,row:null};let n=Array.isArray(e.rows)?e.rows:[],r=as(t),i=os(t?.material),a=os(t?.phase),o=e=>!!i&&os(e.material)===i&&(!a||os(e.phase)===a),s=r?n.find(e=>e.role===r&&o(e))||null:n.find(o)||null;return{status:s?`algorithm-surface-policy-row-selected`:`algorithm-surface-policy-row-not-found`,row:s}}function cs({device:e=null,renderField:t=null,renderFieldExecution:n=null,surface:r=null,surfaceIndex:i=0,algorithmMaterialSurfaceExtractionRows:a=null,label:o=`ulg-sph-render-field-density-volume`,source:s=`ulg-render-field-density-storage-buffer`}={}){let c=t||n?.result||n?.renderField||null;if(!c)return is(`ulg-render-field-buffer-volume-blocked-missing-render-field`,`retained ULG render-field metadata is required before native marching-cubes buffer-volume extraction`);let l=c.schroederSpatialSourceFamily??n?.schroederSpatialSourceFamily??null;if(!l&&(Wo(c)||Wo(n)))return is(`ulg-render-field-buffer-volume-blocked-partial-successor-lineage`,`native extraction rejects partial Schroeder lineage without the exact branded source family`);if(l){ce(l,{device:e,particleCount:c.particleCount??l.particleCount});let t=c.schroederSpatialSourceFieldAuthority??c,n=t.fieldRowsBuffer??null,r={device:e,sourceFamily:l,particleCount:t.particleCount??l.particleCount,fieldRowsBuffer:n,fieldRows:n?null:t.fieldRows,surfaceBuffer:t.surfaceBuffer??null,surfaceTable:t.surfaceTable??null},i=ao(t,r),a=lr(t,r);if(!i&&!a)return is(`ulg-render-field-buffer-volume-blocked-successor-lineage`,`native extraction requires the exact module-authenticated successor source field`);c=t}if(c.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)return is(`ulg-render-field-buffer-volume-blocked-schema`,`ULG buffer-volume extraction requires peercompute.ulg.sph-gpu-render-field.v1 input`,{renderFieldSchema:c.schema??null});let u=l?c.fieldRowsBuffer??null:c.fieldRowsBuffer||n?.fieldRowsBuffer||null;if(!Yo(u))return is(`ulg-render-field-buffer-volume-blocked-missing-buffer`,`retained fieldRowsBuffer is required for native webgpu-marching-cubes scalar-buffer input`,{renderFieldSchema:c.schema,fieldRowsBufferRetained:!!c.fieldRowsBufferRetained,fieldRowsBufferByteLength:c.fieldRowsBufferByteLength??0});let d=l?c.surfaceTable??null:c.surfaceTable||n?.surfaceTable||null,f=Math.max(0,Math.round($(i,0))),p=d?.metadata?.[f]||null;if(l&&r!=null&&r!==p)return is(`ulg-render-field-buffer-volume-blocked-substituted-successor-surface`,`successor extraction requires the exact surface metadata record owned by the authenticated source field`,{renderFieldSchema:c.schema,surfaceIndex:f});let m=l?p:r||p;if(!m)return is(`ulg-render-field-buffer-volume-blocked-missing-surface`,`render-field surface metadata is required to locate the scalar sub-volume inside fieldRowsBuffer`,{renderFieldSchema:c.schema,surfaceIndex:f,surfaceCount:d?.surfaceCount??c.surfaceCount??0});let h=Math.max(1,Math.round($(m.resolution,0))),g=Math.max(1,Math.round($(c.rowStrideFloats,O.length))),_=Math.max(0,Math.round($(m.fieldOffset,0))),v=_*g,y=[g,g*h,g*h*h],b=v+Math.max(0,h-1)*y[0]+Math.max(0,h-1)*y[1]+Math.max(0,h-1)*y[2]+1,x=v*Float32Array.BYTES_PER_ELEMENT,S=b*Float32Array.BYTES_PER_ELEMENT,C=Math.round($(c.fieldRowsBufferByteLength,0)),w=Math.round($(u.size??u.byteLength??u.byteLengthBytes,0)),T=Math.max(0,C),E=Math.max(0,T>0&&w>0?Math.min(T,w):T||w),D=u.device||u.ownerDevice||u.__webgpuDevice||u.__webgpuMarchingCubesDevice||null,k=e&&D?e===D?`same-device`:`cross-device-resource`:`same-device-validation-deferred-to-extension`,A=T>0&&w>0&&T>w,j=E>=S;if(k===`cross-device-resource`)return is(`ulg-render-field-buffer-volume-blocked-cross-device`,`fieldRowsBuffer is associated with a different GPUDevice than the native marching-cubes adapter`,{renderFieldSchema:c.schema,surfaceIndex:f,sameDeviceStatus:k,scalarBuffer:u,scalarBufferByteLength:E});if(A||!j)return is(`ulg-render-field-buffer-volume-blocked-undersized-buffer`,A?`render-field metadata claims more scalar bytes than the retained GPU buffer owns`:`fieldRowsBuffer is smaller than the selected render-field surface sub-volume`,{renderFieldSchema:c.schema,surfaceIndex:f,scalarBuffer:u,scalarBufferByteLength:E,scalarRequiredByteLength:S});let M=[h,h,h],N=ts({resolution:h,fieldPadding:c.fieldPadding,refEdgeM:c.refEdgeM}),P=ss(a,m),F=P.row,I=m.isolation==null?null:Number(m.isolation),L=F?.isovalue==null?null:Number(F.isovalue),ee=Number.isFinite(I),te=Number.isFinite(L),ne=ee?I:null,re=ee?`render-field-surface-isolation`:`isovalue-unavailable`,ie=ee?`algorithm-surface-policy-not-applied-render-field-isolation-authoritative`:`algorithm-surface-policy-not-applied-render-field-isolation-required`,R=ee?`the retained scalar field and its authored isolation share the renderer scalar convention`:`native extraction requires the retained render-field isolation; policy rows are not renderer-authoritative for this scalar convention`,ae={surfaceExtractionIsovalueSource:re,surfaceExtractionPolicyStatus:P.status,surfaceExtractionPolicyApplied:!1,surfaceExtractionPolicyApplicationStatus:ie,surfaceExtractionPolicyApplicationReason:R,surfaceExtractionPolicyRequestedIsovalue:te?L:null,surfaceExtractionPolicyRendererAuthority:F?.rendererAuthority??null,surfaceExtractionPolicyStrictSourceOfTruth:F?.strictSourceOfTruth??null,surfaceExtractionPolicyRowsSchema:a?.schema??null,surfaceExtractionPolicyRowSchema:F?.schema??null,surfaceExtractionPolicyRole:F?.role??null,surfaceExtractionPolicyMaterial:F?.material??null,surfaceExtractionPolicyPhase:F?.phase??null,surfaceExtractionPolicyIsovaluePolicy:F?.isovaluePolicy??null,surfaceExtractionPolicySmoothingRadiusM:F?.smoothingRadiusM??null,surfaceExtractionPolicyVoxelSizeM:F?.voxelSizeM??null,surfaceExtractionPolicyNormalScaleM:F?.normalScaleM??null};if(!ee)return is(`ulg-render-field-buffer-volume-blocked-missing-isolation`,`retained render-field surface metadata must author a finite isolation for native extraction`,{renderFieldSchema:c.schema,surfaceIndex:f,surfaceKey:m.surfaceKey??null,...ae});let z={schema:To,ok:!0,status:`ulg-render-field-buffer-volume-descriptor-ready`,reason:null,extensionDescriptorFactory:`createBufferVolumeDescriptor`,renderFieldSchema:c.schema,renderFieldBackend:c.backend??n?.backend??null,...Go(l),schroederSpatialSourceFieldAuthority:c.schroederSpatialSourceFieldAuthority??(l?c:null),source:s,sourceType:Do,scalarLayoutName:Oo,scalarType:`f32`,scalarLane:`density`,scalarLaneIndex:0,normalSign:-1,normalSemantic:`outward-density-gradient`,normalSourceSemantic:`scalar-gradient`,scalarBuffer:u,storageBuffer:u,buffer:u,scalarBufferByteLength:E,bufferByteLength:E,scalarRequiredByteLength:S,scalarOffset:v,scalarOffsetBytes:x,scalarStrides:y,rowStrideFloats:y[1],sliceStrideFloats:y[2],cellRowStrideFloats:g,dims:M,surfaceIndex:f,surfaceKey:m.surfaceKey??null,material:m.material??null,phase:m.phase??null,renderKey:m.renderKey??null,renderDomainId:m.renderDomainId??null,renderDomainKey:m.renderDomainKey??null,fieldOffset:_,fieldCellCount:m.fieldCellCount??h**3,isolation:ne,isovalue:ne,...ae,fieldPadding:c.fieldPadding??null,refEdgeM:c.refEdgeM??null,positionTransform:N,positionTransformStatus:N.status,positionTransformGridBias:N.gridBias,positionTransformScaleM:N.scaleM,positionTransformOriginM:[...N.originM],device:e,sameDeviceRequired:!0,sameDeviceStatus:k,label:o,nativeConsumerKind:`native-webgpu-marching-cubes-buffer-volume`,nativeRequiredAdapter:`webgpu-marching-cubes.buffer-volume.v0`,scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};return l&&(Object.freeze(z.scalarStrides),Object.freeze(z.dims),Object.freeze(z.positionTransformOriginM),Po.set(z,Object.freeze({device:e,sourceFamily:l,sourceField:c,scalarBuffer:u,surfaceBuffer:c.surfaceBuffer??null,surfaceTable:c.surfaceTable,surfaceRecord:m,surfaceIndex:f,surfaceKey:z.surfaceKey,material:z.material,phase:z.phase,renderKey:z.renderKey,renderDomainId:z.renderDomainId,renderDomainKey:z.renderDomainKey,scalarOffset:v,scalarOffsetBytes:x,scalarStrides:[...y],dims:[...M],scalarBufferByteLength:E,scalarRequiredByteLength:S,scalarType:z.scalarType,normalSign:z.normalSign,fieldOffset:_,fieldCellCount:z.fieldCellCount,isovalue:ne,cellRowStrideFloats:g,rowStrideFloats:z.rowStrideFloats,sliceStrideFloats:z.sliceStrideFloats,fieldPadding:c.fieldPadding,refEdgeM:c.refEdgeM,positionTransform:z.positionTransform,positionTransformStatus:z.positionTransformStatus,positionTransformGridBias:z.positionTransformGridBias,positionTransformScaleM:z.positionTransformScaleM,positionTransformOriginM:[...z.positionTransformOriginM]})),Object.freeze(z)),z}function ls(e,t,{device:n,sourceFamily:r}){return!!(t&&t.device===n&&t.sourceFamily===r&&e.schema===`peercompute.ulg.sph-webgpu-marching-cubes-buffer-volume-descriptor.v0`&&e.ok===!0&&e.status===`ulg-render-field-buffer-volume-descriptor-ready`&&e.device===n&&e.scalarBuffer===t.scalarBuffer&&e.storageBuffer===t.scalarBuffer&&e.buffer===t.scalarBuffer&&e.schroederSpatialSourceFamily===r&&e.schroederSpatialSourceFieldAuthority===t.sourceField&&e.scalarBufferByteLength===t.scalarBufferByteLength&&e.bufferByteLength===t.scalarBufferByteLength&&e.scalarRequiredByteLength===t.scalarRequiredByteLength&&e.scalarType===t.scalarType&&e.normalSign===t.normalSign&&e.surfaceIndex===t.surfaceIndex&&e.surfaceKey===t.surfaceKey&&e.material===t.material&&e.phase===t.phase&&e.renderKey===t.renderKey&&e.renderDomainId===t.renderDomainId&&e.renderDomainKey===t.renderDomainKey&&e.scalarOffset===t.scalarOffset&&e.scalarOffsetBytes===t.scalarOffsetBytes&&e.fieldOffset===t.fieldOffset&&e.fieldCellCount===t.fieldCellCount&&e.isolation===t.isovalue&&e.isovalue===t.isovalue&&e.cellRowStrideFloats===t.cellRowStrideFloats&&e.rowStrideFloats===t.rowStrideFloats&&e.sliceStrideFloats===t.sliceStrideFloats&&e.fieldPadding===t.fieldPadding&&e.refEdgeM===t.refEdgeM&&e.positionTransform===t.positionTransform&&e.positionTransformStatus===t.positionTransformStatus&&e.positionTransformGridBias===t.positionTransformGridBias&&e.positionTransformScaleM===t.positionTransformScaleM&&Array.isArray(e.positionTransformOriginM)&&e.positionTransformOriginM.length===t.positionTransformOriginM.length&&e.positionTransformOriginM.every((e,n)=>e===t.positionTransformOriginM[n])&&Array.isArray(e.dims)&&e.dims.length===t.dims.length&&e.dims.every((e,n)=>e===t.dims[n])&&Array.isArray(e.scalarStrides)&&e.scalarStrides.length===t.scalarStrides.length&&e.scalarStrides.every((e,n)=>e===t.scalarStrides[n]))}function us(e,{device:t,sourceFamily:n=e?.schroederSpatialSourceFamily}={}){let r=Po.get(e);if(!ls(e,r,{device:t,sourceFamily:n}))return!1;let i=r.sourceField.fieldRowsBuffer??null,a={device:t,sourceFamily:n,particleCount:r.sourceField.particleCount,fieldRowsBuffer:i,fieldRows:i?null:r.sourceField.fieldRows,surfaceBuffer:r.surfaceBuffer,surfaceTable:r.surfaceTable};return!!(ao(r.sourceField,a)||lr(r.sourceField,a))}function ds(e){return{volume:e,device:e?.device??null,scalarBuffer:e?.scalarBuffer??null,storageBuffer:e?.storageBuffer??null,sourceType:e?.sourceType??null,scalarOffset:e?.scalarOffset??null,scalarOffsetBytes:e?.scalarOffsetBytes??null,scalarType:e?.scalarType??null,normalSign:e?.normalSign??null,scalarBufferByteLength:e?.scalarBufferByteLength??null,scalarRequiredByteLength:e?.scalarRequiredByteLength??null,rowStrideFloats:e?.rowStrideFloats??null,sliceStrideFloats:e?.sliceStrideFloats??null,numVoxels:e?.numVoxels??null,dualGridNumVoxels:e?.dualGridNumVoxels??null,diagonalLength:e?.diagonalLength??null,dims:Array.from(e?.dims??[]),dualGridDims:Array.from(e?.dualGridDims??[]),scalarStrides:Array.from(e?.scalarStrides??[])}}function fs(e){if(!e)return!1;let t=ds(e.volume);return!!(us(e.descriptor,{device:e.device,sourceFamily:e.sourceFamily})&&t.volume===e.volumeState.volume&&t.device===e.volumeState.device&&t.scalarBuffer===e.volumeState.scalarBuffer&&t.storageBuffer===e.volumeState.storageBuffer&&t.sourceType===e.volumeState.sourceType&&t.scalarOffset===e.volumeState.scalarOffset&&t.scalarOffsetBytes===e.volumeState.scalarOffsetBytes&&t.scalarType===e.volumeState.scalarType&&t.normalSign===e.volumeState.normalSign&&t.scalarBufferByteLength===e.volumeState.scalarBufferByteLength&&t.scalarRequiredByteLength===e.volumeState.scalarRequiredByteLength&&t.rowStrideFloats===e.volumeState.rowStrideFloats&&t.sliceStrideFloats===e.volumeState.sliceStrideFloats&&t.numVoxels===e.volumeState.numVoxels&&t.dualGridNumVoxels===e.volumeState.dualGridNumVoxels&&t.diagonalLength===e.volumeState.diagonalLength&&t.dims.length===e.volumeState.dims.length&&t.dims.every((t,n)=>t===e.volumeState.dims[n])&&t.dualGridDims.length===e.volumeState.dualGridDims.length&&t.dualGridDims.every((t,n)=>t===e.volumeState.dualGridDims[n])&&t.scalarStrides.length===e.volumeState.scalarStrides.length&&t.scalarStrides.every((t,n)=>t===e.volumeState.scalarStrides[n]))}function ps({device:e,descriptor:t,volume:n}={}){let r=t?.schroederSpatialSourceFamily??null;if(!r)return null;if(!us(t,{device:e,sourceFamily:r}))throw TypeError(`marching-cubes volume requires an active authenticated successor descriptor`);let i=t.dims.map(e=>Math.max(0,e-1)),a=t.dims.reduce((e,t)=>e*t,1),o=i.reduce((e,t)=>e*t,1);if(!n||n.device!==e||n.scalarBuffer!==t.scalarBuffer||n.storageBuffer!==t.scalarBuffer||n.sourceType!==t.sourceType||n.scalarType!==t.scalarType||n.scalarBufferByteLength!==t.scalarBufferByteLength||n.scalarRequiredByteLength!==t.scalarRequiredByteLength||n.scalarOffset!==t.scalarOffset||n.scalarOffsetBytes!==t.scalarOffsetBytes||n.rowStrideFloats!==t.rowStrideFloats||n.sliceStrideFloats!==t.sliceStrideFloats||n.normalSign!==t.normalSign||n.numVoxels!==a||n.dualGridNumVoxels!==o||!Array.isArray(n.dims)||n.dims.length!==t.dims.length||!n.dims.every((e,n)=>e===t.dims[n])||!Array.isArray(n.dualGridDims)||n.dualGridDims.length!==i.length||!n.dualGridDims.every((e,t)=>e===i[t])||!Array.isArray(n.scalarStrides)||n.scalarStrides.length!==t.scalarStrides.length||!n.scalarStrides.every((e,n)=>e===t.scalarStrides[n]))throw TypeError(`marching-cubes volume does not exactly match its authenticated successor descriptor`);let s=Object.freeze({device:e,descriptor:t,volume:n,volumeState:Object.freeze(ds(n)),sourceFamily:r,scalarBuffer:t.scalarBuffer,surfaceIndex:t.surfaceIndex,isovalue:t.isovalue});return Fo.set(n,s),Object.freeze({status:`ulg-marching-cubes-successor-volume-lineage-bound`,sourceFamilyRole:r.sourceFamilyRole,sourceGenerationId:r.sourceGenerationId,surfaceIndex:t.surfaceIndex})}function ms(e,t,{surfaceIndex:n,materialId:r,phaseId:i,opticalStateId:a,vertexOffset:o,vertexCount:s,triangleOffset:c,triangleCount:l,renderOrder:u,transparencyClassId:d,depthWriteFlag:f,status:p,boundsCenterM:m,boundsRadiusM:h}){e.set([n,r,i,a,o,s,c,l,u,d,f,p,m[0],m[1],m[2],h],t)}function hs({vertexCount:e,sourceStrideFloats:t,surfaceIndex:n,triangleCount:r,materialId:i,phaseId:a,opticalStateId:o,density:s,isolation:c,sourceVoxelLinearIndex:l,transparencyClassId:u,depthWriteFlag:d,renderOrder:f,fallbackNormal:p,positionTransform:m=null,positionClamp:h=null,surfaceBounds:g=null,fieldGradient:_=null}){let v=new ArrayBuffer(160),y=new DataView(v),b=m?.enabled?m:null,x=h?.enabled?h:null,S=g||rs({positionTransform:b,positionClamp:x}),C=Zo(b?.originM,[0,0,0]),w=Zo(x?.minM,[0,0,0]),T=Zo(x?.maxM,[0,0,0]),E=Zo(S?.centerM,[0,0,0]);return y.setUint32(0,Math.max(0,Math.round($(e,0))),!0),y.setUint32(4,Math.max(1,Math.round($(t,4))),!0),y.setUint32(8,Math.max(0,Math.round($(n,0))),!0),y.setUint32(12,Math.max(0,Math.round($(r,0))),!0),y.setFloat32(16,$(i,0),!0),y.setFloat32(20,$(a,0),!0),y.setFloat32(24,$(o,0),!0),y.setFloat32(28,$(s,0),!0),y.setFloat32(32,$(c,0),!0),y.setFloat32(36,$(l,0),!0),y.setFloat32(40,$(u,0),!0),y.setFloat32(44,$(d,1),!0),y.setFloat32(48,$(f,n),!0),y.setFloat32(52,p[0],!0),y.setFloat32(56,p[1],!0),y.setFloat32(60,p[2],!0),y.setFloat32(64,$(b?.scaleM,1),!0),y.setFloat32(68,C[0],!0),y.setFloat32(72,C[1],!0),y.setFloat32(76,C[2],!0),y.setFloat32(80,$(b?.gridBias,0),!0),y.setFloat32(88,$(_?.resolution,0),!0),y.setFloat32(92,$(_?.scalarOffsetFloats,0),!0),y.setFloat32(124,+!!_?.buffer,!0),y.setFloat32(144,$(_?.rowStrideFloats,1),!0),y.setFloat32(84,+!!b,!0),y.setFloat32(96,w[0],!0),y.setFloat32(100,w[1],!0),y.setFloat32(104,w[2],!0),y.setFloat32(108,T[0],!0),y.setFloat32(112,T[1],!0),y.setFloat32(116,T[2],!0),y.setFloat32(120,+!!x,!0),y.setFloat32(128,E[0],!0),y.setFloat32(132,E[1],!0),y.setFloat32(136,E[2],!0),y.setFloat32(140,$(S?.radiusM,0),!0),v}async function gs(e,t,n,r=`ulg-sph-marching-cubes-extension-readback`){let i=null,a=!1;try{i=e.createBuffer({label:r,size:Math.max(4,n),usage:jo.MAP_READ|jo.COPY_DST});let o=e.createCommandEncoder();return o.copyBufferToBuffer(t,0,i,0,n),e.queue.submit([o.finish()]),await i.mapAsync(Mo.READ),a=!0,i.getMappedRange().slice(0)}finally{if(a)try{i?.unmap?.()}catch{}try{i?.destroy?.()}catch{}}}function _s({surfaceIndex:e,materialId:t,phaseId:n,opticalStateId:r,material:i,phase:a,renderKey:o,surfaceKey:s,vertexCount:c,triangleCount:l,renderOrder:u,transparencyClassId:d,depthWriteFlag:p,status:m=`surface-draw-summary-not-read`,boundsCenterM:h=null,boundsRadiusM:g=null,indirectRowIndex:_=0,indirectOffsetBytes:v=null}){let y=Zo(h,[0,0,0]),b=$(g,0),x=Number.isFinite(Number(c))?Math.max(0,Math.round(Number(c))):null,S=Number.isFinite(Number(l))?Math.max(0,Math.round(Number(l))):null,C=Math.max(0,Math.round($(_,0))),w=f.length*Uint32Array.BYTES_PER_ELEMENT,T=Number.isFinite(Number(v))?Math.max(0,Math.round(Number(v))):C*w,E=(x??0)>=3;return{surfaceKey:s||`extension-surface-${e}`,material:i,phase:a,renderKey:o,surfaceIndex:e,materialId:t,phaseId:n,opticalStateId:r,indirectRowIndex:C,indirectOffsetBytes:T,vertexOffset:E?0:null,vertexCount:x,triangleOffset:E?0:null,triangleCount:S,renderOrder:u,transparencyClassId:d,depthWriteFlag:p,boundsCenterM:y,boundsRadiusM:b>0?b:null,status:m}}function vs(e){let t=e?.result||null,n=(t?.outputDescriptors?.rows?.position||t?.rowMetadata?.position||null)?.resourceOwnership||t?.resourceOwnership||null;if(n?.ok===!1||n?.status===`cross-device-resource`)throw TypeError(`extension surface buffer is not owned by this GPUDevice (${n.status})`);let r=bs(t);if(r.resourceOwnership?.ok===!1||r.resourceOwnership?.status===`cross-device-resource`)throw TypeError(`extension packed normal buffer is not owned by this GPUDevice (${r.resourceOwnership.status})`)}function ys(e=null){let t=e?.outputDescriptors||null,n=t?.rows?.position||null,r=e?.rowMetadata?.position||null,i=n||r||null,a=Math.max(0,Math.round($(i?.rowStrideFloats??e?.rowStrideFloats??e?.vertexStrideFloats,0))),o=Math.max(0,Math.round($(i?.rowStrideBytes??e?.rowStrideBytes??e?.vertexStrideBytes,0))),s=i?.schema??e?.rowSchema??null,c=Array.isArray(i?.rowLayout)?[...i.rowLayout]:Array.isArray(e?.rowLayout)?[...e.rowLayout]:null,l=i?.buffer||t?.retainedBuffers?.position||e?.buffer||null,u=!!(i?.bufferRetained&&i?.buffer||t?.retainedBuffers?.position&&l||e?.bufferRetained&&e?.buffer),d=Math.max(0,Math.round($(i?.bufferByteLength??e?.bufferByteLength,0)));return{outputDescriptorSchema:t?.schema??null,outputDescriptorStatus:t?.status??null,outputDescriptorTopology:t?.topology??null,outputDescriptorReadback:t?.readback??null,outputDescriptorFullReadback:t?.fullReadback??null,rowMetadataSchema:e?.rowMetadata?.schema??null,rowMetadataStatus:e?.rowMetadata?.status??null,rowSchema:s,rowLayout:c,rowLayoutName:i?.layoutName??t?.layoutName??e?.layoutName??null,rowStrideFloats:a,rowStrideBytes:o,rowCount:Math.max(0,Math.round($(i?.rowCount??e?.rowCount??e?.vertexCount,0))),status:i?.status??null,available:!!(i?.available??u),buffer:l,bufferRetained:u,bufferByteLength:d,ownerDeviceId:i?.ownerDeviceId??e?.ownerDeviceId??null,resourceOwnership:i?.resourceOwnership??e?.resourceOwnership??null,readback:i?.readback??t?.readback??e?.rowMetadata?.readback??e?.readback??null,normalRowsStatus:t?.rows?.normal?.status??e?.rowMetadata?.normal?.status??null,materialRowsStatus:t?.rows?.material?.status??e?.rowMetadata?.material?.status??null,drawRowsStatus:t?.rows?.draw?.status??null,drawRowsAvailable:t?.rows?.draw?.available??null,indirectDrawRowsStatus:t?.rows?.indirect?.status??null,indirectDrawRowsAvailable:t?.rows?.indirect?.available??null,materialMetadataAvailable:t?.materialPayload?.available??e?.rowMetadata?.material?.metadataAvailable??null,pbrMetadataAvailable:t?.pbrPayload?.available??null}}function bs(e=null){let t=e?.outputDescriptors||null,n=t?.rows?.normal||null,r=e?.rowMetadata?.normal||null,i=n||r||null,a=i?.normalBufferDescriptor||t?.normalBufferDescriptor||null,o=Yo(a?.generation)?a.generation:null,s=o!=null,c=!!(s&&Object.prototype.hasOwnProperty.call(o,`surfaceGenerationId`)),l=!!(s&&Object.prototype.hasOwnProperty.call(o,`pairedPositionSurfaceGenerationId`)),u=!!(s&&Object.prototype.hasOwnProperty.call(o,`volumeGenerationId`)),d=i?.buffer||t?.retainedBuffers?.normal||e?.normalBuffer||null,f=Math.max(0,Math.round($(i?.bufferByteLength??a?.bufferByteLength??e?.normalBufferByteLength,0))),p=Math.max(0,Math.round($(i?.rowCount??a?.rowCount,0))),m=c?o.surfaceGenerationId:null,h=l?o.pairedPositionSurfaceGenerationId:null,g=u?o.volumeGenerationId:null;return{descriptorSchema:a?.schema??null,rowSchema:i?.schema??a?.rowSchema??null,layoutName:i?.layoutName??a?.layoutName??null,encoding:i?.encoding??a?.encoding??e?.normalEncoding??null,semantic:i?.semantic??a?.semantic??e?.normalSemantic??null,sourceSemantic:i?.sourceSemantic??a?.sourceSemantic??e?.normalSourceSemantic??null,normalSign:Number(i?.normalSign??a?.normalSign??e?.normalSign),status:i?.status??a?.status??null,available:!!(i?.available??a?.available),buffer:d,bufferRetained:!!(i?.bufferRetained&&i?.buffer||a?.bufferRetained&&a?.buffer||t?.retainedBuffers?.normal&&d),bufferByteLength:f,rowStrideBytes:Math.max(0,Math.round($(i?.rowStrideBytes??a?.rowStrideBytes,0))),rowCount:p,ownerDeviceId:i?.ownerDeviceId??a?.ownerDeviceId??null,resourceOwnership:i?.resourceOwnership??a?.resourceOwnership??null,generationDescriptorAuthored:s,surfaceGenerationIdAuthored:c,pairedPositionSurfaceGenerationIdAuthored:l,volumeGenerationIdAuthored:u,surfaceGenerationId:m,pairedPositionSurfaceGenerationId:h,volumeGenerationId:g,sameSubmitAsPosition:a?.generation?.sameSubmitAsPosition===!0,lifetimeOwner:a?.lifetime?.owner??null,pairedWithPositionBuffer:a?.lifetime?.pairedWithPositionBuffer===!0,producerStage:a?.producer?.stage??e?.normalProducerStage??null,timestampSpanLabel:a?.producer?.timestampSpanLabel??e?.normalTimestampSpanLabel??null,additionalSubmitCount:Math.max(0,Math.round($(a?.producer?.additionalSubmitCount??e?.normalAdditionalSubmitCount,0)))}}function xs(e,t=null){let n=e?.result??null,r=t??Cs(e),i=ys(n),a=bs(n);return{result:n,summaryFingerprint:JSON.stringify(r),positionBuffer:i.buffer??null,normalBuffer:a.buffer??null,positionRows:n?.positionRows??n?.compactPositionRows??null,actualVertexCounterBuffer:n?.actualVertexCounterBuffer??n?.vertexCounterBuffer??null,drawIndirectBuffer:n?.drawIndirectBuffer??null,surfaceGenerationId:n?.surfaceGenerationId??null,volumeGenerationId:n?.volumeGenerationId??null,resultIsovalue:n?.isovalue??null}}function Ss(e){return{schema:xo,status:`extension-surface-execution-invalid`,reason:e,extensionExecutionSchema:null,extensionSurfaceSchema:null,extensionStatus:null,extensionOk:!1,extensionBackend:null,extensionAdapterId:null,extensionOwnsDevice:null,extensionOwnerDeviceId:null,extensionResourceOwnershipStatus:null,extensionVertexFormat:null,extensionVertexStrideFloats:null,extensionVertexStrideBytes:null,extensionVertexCount:0,extensionTriangleCount:0,extensionBufferRetained:!1,extensionReadback:null,extensionSurfaceVertexReadback:null,readyForUlgSurfaceVertexRows:!1,requiresUlgVertexRowTranslation:!0,requiresUlgDrawMetadata:!0,surfaceVertexSchema:T,surfaceVertexFormat:Eo,surfaceVertexRowLayout:[...p],surfaceVertexRowStrideFloats:p.length,surfaceDrawSchema:A,surfaceDrawRowLayout:[...M],surfaceDrawRowStrideFloats:M.length,surfaceDrawIndirectSchema:h,surfaceDrawIndirectRowLayout:[...f],surfaceDrawIndirectRowStrideUints:f.length,hotLoopSafe:!1,rendererIntegration:`not-integrated`}}function Cs(e){if(!Yo(e))return Ss(`missing extension surface execution`);let t=e.result||null,n=ys(t),r=bs(t),i=t?.schema??null,a=e.ok===!0,o=Math.max(0,Math.round($(t?.vertexCount,0))),s=t?.vertexCountMode??null,c=t?.vertexRowsBudget==null?null:Math.max(0,Math.round($(t.vertexRowsBudget,0))),l=t?.vertexRowsBudgetClamped===!0?!0:t?.vertexRowsBudgetClamped===!1?!1:null,u=t?.conservativeWorstCaseVertexCount==null?null:Math.max(0,Math.round($(t.conservativeWorstCaseVertexCount,0))),d=t?.actualVertexCounterBuffer||t?.vertexCounterBuffer||null,m=Math.max(0,Math.round($(t?.actualVertexCounterBufferByteLength??t?.vertexCounterBufferByteLength??d?.size,0))),g=t?.drawIndirectBuffer||null,_=Math.max(0,Math.round($(t?.drawIndirectBufferByteLength??g?.size,0))),v=Math.max(0,$(t?.triangleCount,0)),y=n.rowStrideFloats>0?n.rowStrideFloats:t?.vertexStrideFloats==null?null:Math.max(0,Math.round($(t.vertexStrideFloats,0))),b=n.rowStrideBytes>0?n.rowStrideBytes:t?.vertexStrideBytes==null?null:Math.max(0,Math.round($(t.vertexStrideBytes,0))),x=t?.vertexFormat??null,S=n.bufferRetained,C=n.resourceOwnership?.status??null,w=!!(r.volumeGenerationId==null&&t?.volumeGenerationId==null||Number.isInteger(r.volumeGenerationId)&&Number.isInteger(t?.volumeGenerationId)&&r.volumeGenerationId===t.volumeGenerationId),E=!!(r.generationDescriptorAuthored&&r.surfaceGenerationIdAuthored&&r.pairedPositionSurfaceGenerationIdAuthored&&r.volumeGenerationIdAuthored&&Number.isInteger(r.surfaceGenerationId)&&Number.isInteger(r.pairedPositionSurfaceGenerationId)&&Number.isInteger(t?.surfaceGenerationId)&&r.surfaceGenerationId===r.pairedPositionSurfaceGenerationId&&r.surfaceGenerationId===t.surfaceGenerationId&&w),D=!!(r.descriptorSchema===`peercompute.webgpu-marching-cubes.normal-buffer-descriptor.v0`&&r.rowSchema===`peercompute.webgpu-marching-cubes.packed-normal-rows.v0`&&r.layoutName===`peercompute.webgpu-marching-cubes.layout.normal-octahedral-snorm16x2.v0`&&r.encoding===`octahedral-snorm16x2`&&r.semantic===`oriented-scalar-gradient`&&r.sourceSemantic===`scalar-gradient`&&(r.normalSign===-1||r.normalSign===1)&&r.available&&r.bufferRetained&&r.buffer&&r.rowStrideBytes===Uint32Array.BYTES_PER_ELEMENT&&r.rowCount===o&&r.bufferByteLength>=o*Uint32Array.BYTES_PER_ELEMENT&&r.resourceOwnership?.ok!==!1&&r.resourceOwnership?.status!==`cross-device-resource`&&E&&r.sameSubmitAsPosition&&r.pairedWithPositionBuffer&&r.lifetimeOwner===`surface-result`&&r.additionalSubmitCount===0),O=`packed-normal-ready`;!r.buffer||!r.bufferRetained?O=`packed-normal-buffer-unavailable`:E?D||(O=`packed-normal-contract-invalid`):O=`packed-normal-generation-mismatch`;let k=e.errors?.[0]||e.webgpuStatus?.error||t?.error||null,j=Xo(e.webgpuStatus?.reason)||Xo(k?.message)||Xo(t?.reason)||Xo(e.status),N=!!(a&&i===`peercompute.webgpu-marching-cubes.surface.v0`&&S&&o>0),P=!!(N&&y===p.length&&x===`peercompute.ulg.sph-gpu-render-surface-vertex-row.v0`),F=!P,I=`extension-surface-execution-blocked`;return I=a?N?F?`extension-surface-ready-needs-ulg-row-translation`:`extension-surface-ready-ulg-row-compatible`:o>0?`extension-surface-buffer-unavailable`:`extension-surface-empty`:e.status===`same-device-check-failed`?`extension-surface-same-device-check-failed`:`extension-surface-execution-blocked`,{schema:xo,status:I,reason:I.endsWith(`failed`)||I.endsWith(`blocked`)?j:null,extensionExecutionSchema:e.schema??null,extensionSurfaceSchema:i,extensionStatus:e.status??null,extensionOk:a,extensionErrorName:k?.name??null,extensionErrorStatus:k?.status??null,extensionErrorStage:k?.stage??null,extensionErrorStack:k?.stack??null,extensionBackend:e.backend??null,extensionAdapterId:e.adapterId??null,extensionOwnsDevice:e.ownsDevice??null,extensionOwnerDeviceId:e.ownerDeviceId??t?.ownerDeviceId??null,extensionResourceOwnershipStatus:C,extensionVertexFormat:x,extensionVertexStrideFloats:y,extensionVertexStrideBytes:b,extensionVertexCount:o,extensionVertexCountMode:s,extensionVertexRowsBudget:c,extensionVertexRowsBudgetClamped:l,extensionConservativeWorstCaseVertexCount:u,extensionActualVertexCounterBufferRetained:!!d,extensionActualVertexCounterBufferByteLength:m,extensionDrawIndirectBufferRetained:!!g,extensionDrawIndirectBufferByteLength:_,extensionTriangleCount:v,extensionBufferRetained:S,extensionBufferByteLength:n.bufferByteLength,extensionPackedNormalReady:D,extensionPackedNormalStatus:O,extensionNormalDescriptorSchema:r.descriptorSchema,extensionNormalRowsSchema:r.rowSchema,extensionNormalLayoutName:r.layoutName,extensionNormalEncoding:r.encoding,extensionNormalSemantic:r.semantic,extensionNormalSourceSemantic:r.sourceSemantic,extensionNormalSign:Number.isFinite(r.normalSign)?r.normalSign:null,extensionNormalBufferRetained:r.bufferRetained,extensionNormalBufferByteLength:r.bufferByteLength,extensionNormalRowStrideBytes:r.rowStrideBytes,extensionNormalRowCount:r.rowCount,extensionNormalOwnerDeviceId:r.ownerDeviceId,extensionNormalResourceOwnershipStatus:r.resourceOwnership?.status??null,extensionNormalGenerationDescriptorAuthored:r.generationDescriptorAuthored,extensionNormalSurfaceGenerationIdAuthored:r.surfaceGenerationIdAuthored,extensionNormalPairedPositionSurfaceGenerationIdAuthored:r.pairedPositionSurfaceGenerationIdAuthored,extensionNormalVolumeGenerationIdAuthored:r.volumeGenerationIdAuthored,extensionNormalSurfaceGenerationId:r.surfaceGenerationId,extensionNormalPairedPositionSurfaceGenerationId:r.pairedPositionSurfaceGenerationId,extensionNormalVolumeGenerationId:r.volumeGenerationId,extensionNormalSameSubmitAsPosition:r.sameSubmitAsPosition,extensionNormalLifetimeOwner:r.lifetimeOwner,extensionNormalPairedWithPositionBuffer:r.pairedWithPositionBuffer,extensionNormalProducerStage:r.producerStage,extensionNormalTimestampSpanLabel:r.timestampSpanLabel,extensionNormalAdditionalSubmitCount:r.additionalSubmitCount,extensionOutputDescriptorSchema:n.outputDescriptorSchema,extensionOutputDescriptorStatus:n.outputDescriptorStatus,extensionOutputDescriptorTopology:n.outputDescriptorTopology,extensionOutputDescriptorReadback:n.outputDescriptorReadback,extensionOutputDescriptorFullReadback:n.outputDescriptorFullReadback,extensionRowMetadataSchema:n.rowMetadataSchema,extensionRowMetadataStatus:n.rowMetadataStatus,extensionPositionRowsSchema:n.rowSchema,extensionPositionRowsStatus:n.status,extensionPositionRowsAvailable:n.available,extensionPositionRowsReadback:n.readback,extensionPositionRowsRowLayout:n.rowLayout,extensionPositionRowsLayoutName:n.rowLayoutName,extensionPositionRowsRowCount:n.rowCount,extensionNormalRowsStatus:n.normalRowsStatus,extensionMaterialRowsStatus:n.materialRowsStatus,extensionDrawRowsStatus:n.drawRowsStatus,extensionDrawRowsAvailable:n.drawRowsAvailable,extensionIndirectDrawRowsStatus:n.indirectDrawRowsStatus,extensionIndirectDrawRowsAvailable:n.indirectDrawRowsAvailable,extensionMaterialMetadataAvailable:n.materialMetadataAvailable,extensionPbrMetadataAvailable:n.pbrMetadataAvailable,extensionReadback:e.readback??null,extensionSurfaceVertexReadback:e.surfaceVertexReadback??null,readyForUlgSurfaceVertexRows:P,requiresUlgVertexRowTranslation:F,requiresUlgDrawMetadata:!0,surfaceVertexSchema:T,surfaceVertexFormat:Eo,surfaceVertexRowLayout:[...p],surfaceVertexRowStrideFloats:p.length,surfaceDrawSchema:A,surfaceDrawRowLayout:[...M],surfaceDrawRowStrideFloats:M.length,surfaceDrawIndirectSchema:h,surfaceDrawIndirectRowLayout:[...f],surfaceDrawIndirectRowStrideUints:f.length,hotLoopSafe:!!(N&&e.readback===!1&&e.surfaceVertexReadback===!1&&n.readback!==!0),rendererIntegration:`pending-ulg-row-translation-and-engine-bridge`}}function ws({device:e,volume:t=null,adapterFactory:n,adapter:r=null,adapterId:i=`webgpu-marching-cubes`,backend:a=`webgpu-marching-cubes-extension`}={}){if(!Yo(e))throw TypeError(`createUlgWebGpuMarchingCubesExtensionAdapter requires a caller-owned GPUDevice`);if(!r&&typeof n!=`function`)throw TypeError(`createUlgWebGpuMarchingCubesExtensionAdapter requires an adapter or adapterFactory`);let o=r,s=async()=>(o||=await n({device:e,volume:t,adapterId:i}),o),c={schema:bo,adapterId:i,backend:a,device:e,ownsDevice:!1,volume:t,get adapter(){return o},getStatus(){return{schema:bo,status:o?`extension-adapter-ready`:`extension-adapter-pending`,adapterSchema:o?.schema??null,adapterStatus:o?.getStatus?.()??null,adapterId:i,backend:a,ownsDevice:!1}},getCapabilities(){return o?.getCapabilities?.()??{schema:`peercompute.ulg.sph-webgpu-marching-cubes-extension-adapter.v0`,status:o?`extension-capabilities-unavailable`:`extension-adapter-pending`,adapterSchema:o?.schema??null,adapterId:i,backend:a,ownsDevice:!1}},async preflight(e={}){let n=await s();if(typeof n.preflight!=`function`)return{schema:So,ok:!0,status:`extension-preflight-unavailable`,reason:`extension adapter does not expose preflight; extraction will rely on adapter extractSurface checks`,backend:a,adapterSchema:n?.schema??null,adapterId:i,ownsDevice:!1,extensionPreflight:null};let r=await n.preflight({...e,volume:e.volume||t}),o=r?.ok!==!1;return{schema:So,ok:o,status:o?`extension-preflight-ready`:`extension-preflight-blocked`,reason:o?null:r?.status||`extension preflight blocked surface extraction`,backend:a,adapterSchema:n?.schema??null,adapterId:i,ownsDevice:!1,extensionPreflightSchema:r?.schema??null,extensionPreflightStatus:r?.status??null,deviceChecks:r?.deviceChecks||[],extensionPreflight:r}},async extractSurface(n={}){let r=n.volume||t,o=zo.get(c);if(!o||o.device!==e||o.volume!==t)throw TypeError(`marching-cubes extension wrapper authority is unavailable`);let l=Fo.get(r);if(l){let e=n.isovalue??l.descriptor.isovalue;if(r!==t||e!==l.descriptor.isovalue||!fs(l)||Fo.get(r)!==l)throw TypeError(`marching-cubes extraction requires the active exact successor volume binding`)}let u=await s();if(l&&!fs(l))throw TypeError(`marching-cubes successor volume changed while the extension adapter was resolving`);let d=await c.preflight(n);if(l&&!fs(l))throw TypeError(`marching-cubes successor volume changed during extension preflight`);if(d.ok===!1){let e={schema:xo,status:`extension-surface-preflight-blocked`,reason:d.reason,extensionOk:!1,extensionStatus:d.extensionPreflightStatus,extensionExecutionSchema:null,extensionSurfaceSchema:null,readyForUlgSurfaceVertexRows:!1,requiresUlgVertexRowTranslation:!0,requiresUlgDrawMetadata:!0,hotLoopSafe:!1,rendererIntegration:`blocked-before-extension-extraction`};return{schema:xo,status:e.status,reason:e.reason,backend:a,adapterSchema:c.schema,extensionAdapterSchema:u?.schema??null,adapterId:i,ownsDevice:!1,preflight:d,summary:e,extensionExecution:null,surfaceVertexSchema:null,surfaceDrawSchema:null,surfaceDrawIndirectSchema:null,readyForUlgSurfaceVertexRows:!1,requiresUlgVertexRowTranslation:!0,requiresUlgDrawMetadata:!0,hotLoopSafe:!1,rendererIntegration:e.rendererIntegration}}let f=await u.extractSurface({...n,volume:n.volume||t}),p=f?.result??null,m=p?.release,h=!1;try{let t=Cs(f),o=l?xs(f,t):null;if(o)for(let e of[o.positionBuffer,o.normalBuffer,o.positionRows,o.actualVertexCounterBuffer,o.drawIndirectBuffer])Uo(Lo,e);if(l&&!fs(l))throw TypeError(`marching-cubes successor volume changed during extension extraction`);let s={schema:xo,status:t.status,reason:t.reason,backend:a,adapterSchema:c.schema,extensionAdapterSchema:u?.schema??null,adapterId:i,ownsDevice:!1,preflight:d,summary:t,extensionExecution:f,webgpuStatus:f?.webgpuStatus??null,errors:f?.errors||[],errorName:t.extensionErrorName,errorStatus:t.extensionErrorStatus,errorStage:t.extensionErrorStage,errorStack:t.extensionErrorStack,surfaceVertexSchema:t.surfaceVertexSchema,surfaceDrawSchema:t.surfaceDrawSchema,surfaceDrawIndirectSchema:t.surfaceDrawIndirectSchema,readyForUlgSurfaceVertexRows:t.readyForUlgSurfaceVertexRows,requiresUlgVertexRowTranslation:t.requiresUlgVertexRowTranslation,requiresUlgDrawMetadata:t.requiresUlgDrawMetadata,hotLoopSafe:t.hotLoopSafe,rendererIntegration:t.rendererIntegration};if(l){if(o.resultIsovalue!==l.descriptor.isovalue)throw TypeError(`marching-cubes successor output isovalue does not match its authenticated descriptor`);let t=[o.positionBuffer,o.normalBuffer,o.actualVertexCounterBuffer,o.drawIndirectBuffer].filter(Boolean);if(t.includes(l.scalarBuffer)||new Set(t).size!==t.length)throw TypeError(`marching-cubes successor output resources must be distinct from the source volume and from one another`);let i={active:!0,device:e,wrapper:c,volume:r,descriptor:l.descriptor,sourceFamily:l.sourceFamily,scalarBuffer:l.scalarBuffer,wrappedExecution:s,extensionExecution:f,extensionResult:o.result,executionSummaryFingerprint:o.summaryFingerprint,positionBuffer:o.positionBuffer,normalBuffer:o.normalBuffer,positionRows:o.positionRows,positionRowsBytes:Bo(o.positionRows),actualVertexCounterBuffer:o.actualVertexCounterBuffer,drawIndirectBuffer:o.drawIndirectBuffer,surfaceGenerationId:o.surfaceGenerationId,volumeGenerationId:o.volumeGenerationId,resultIsovalue:o.resultIsovalue,releaseMethod:null,isovalue:n.isovalue??l.descriptor.isovalue},a=o.result?.release;if(typeof a!=`function`)throw TypeError(`marching-cubes successor output requires an authenticated release lifecycle`);{let e=function(...e){return i.active=!1,a.apply(this,e)};try{o.result.release=e}catch{throw TypeError(`marching-cubes successor output lifecycle cannot be authenticated`)}if(o.result.release!==e)throw TypeError(`marching-cubes successor output lifecycle cannot be authenticated`);i.releaseMethod=e}Ho(Lo,i.positionBuffer,i),Ho(Lo,i.normalBuffer,i),Ho(Lo,i.positionRows,i),Ho(Lo,i.actualVertexCounterBuffer,i),Ho(Lo,i.drawIndirectBuffer,i),Io.set(s,i),f&&typeof f==`object`&&Io.set(f,i)}return h=!0,s}catch(e){if(!h){let e=null;try{e=xs(f)}catch{}let t=l?.scalarBuffer??null,n=[e?.positionBuffer,e?.normalBuffer,e?.actualVertexCounterBuffer,e?.drawIndirectBuffer,p?.positionBuffer,p?.vertexBuffer,p?.buffer,p?.normalBuffer,p?.packedNormalBuffer,p?.actualVertexCounterBuffer,p?.vertexCounterBuffer,p?.drawIndirectBuffer].filter(e=>e&&typeof e==`object`);if(!(t&&n.includes(t))&&typeof m==`function`)try{await m.call(p)}catch{}}throw e}}};return zo.set(c,Object.freeze({device:e,volume:t})),c}function Ts(e,t=null){let n=Io.get(e);if(!n){if(t||Wo(e)||Wo(e?.result))throw TypeError(`marching-cubes translation rejects unbranded or partial successor lineage`);return null}let r=e===n.wrappedExecution?n.extensionExecution:e,i=xs(r),a=i.result;if(n.active!==!0||t&&t!==n.sourceFamily||!Object.isFrozen(n.descriptor)||!us(n.descriptor,{device:n.device,sourceFamily:n.sourceFamily})||!fs(Fo.get(n.volume))||r!==n.extensionExecution||a!==n.extensionResult||i.summaryFingerprint!==n.executionSummaryFingerprint||i.positionBuffer!==n.positionBuffer||i.normalBuffer!==n.normalBuffer||i.positionRows!==n.positionRows||!Vo(i.positionRows,n.positionRowsBytes)||i.actualVertexCounterBuffer!==n.actualVertexCounterBuffer||i.drawIndirectBuffer!==n.drawIndirectBuffer||i.surfaceGenerationId!==n.surfaceGenerationId||i.volumeGenerationId!==n.volumeGenerationId||i.resultIsovalue!==n.resultIsovalue||n.releaseMethod!=null&&a?.release!==n.releaseMethod)throw TypeError(`marching-cubes output does not match its authenticated successor extraction`);return n}function Es(e,t=null){let n=Io.get(e);if(!n)return null;let r=e===n.wrappedExecution?n.extensionExecution:e,i=xs(r),a=Po.get(n.descriptor);if(n.active!==!0||t&&t!==n.sourceFamily||!Object.isFrozen(n.descriptor)||!ls(n.descriptor,a,{device:n.device,sourceFamily:n.sourceFamily})||r!==n.extensionExecution||i.result!==n.extensionResult||i.summaryFingerprint!==n.executionSummaryFingerprint||i.positionBuffer!==n.positionBuffer||i.normalBuffer!==n.normalBuffer||i.positionRows!==n.positionRows||!Vo(i.positionRows,n.positionRowsBytes)||i.actualVertexCounterBuffer!==n.actualVertexCounterBuffer||i.drawIndirectBuffer!==n.drawIndirectBuffer||i.surfaceGenerationId!==n.surfaceGenerationId||i.volumeGenerationId!==n.volumeGenerationId||i.resultIsovalue!==n.resultIsovalue||n.releaseMethod!=null&&i.result?.release!==n.releaseMethod)throw TypeError(`sealed marching-cubes output no longer matches its authenticated successor extraction`);return n}function Ds(e,{device:t,sourceFamily:n=null,descriptor:r=null}={}){try{let i=Ts(e,n);return!!(i&&i.device===t&&i.sourceFamily===n&&(!r||i.descriptor===r))}catch{return!1}}function Os(e,{device:t,surfaceIndex:n,isolation:r,sourceVoxelLinearIndex:i,positionTransform:a,positionTransformResolution:o,fieldPadding:s,refEdgeM:c,fieldGradient:l=null,positionRows:u=null,positionClampMinM:d=null,positionClampMaxM:f=null}={}){if(!e)return null;let p=e.descriptor,m=p.dims?.[0]??null;if(t!==e.device||n!==p.surfaceIndex||i!==p.fieldOffset||r!=null&&r!==p.isovalue||a!=null&&a!==p.positionTransform||o!=null&&o!==m||s!=null&&s!==p.fieldPadding||c!=null&&c!==p.refEdgeM||u!=null&&u!==e.positionRows||d!=null||f!=null||l!=null&&(l.buffer!==p.scalarBuffer||l.scalarOffsetFloats!==p.scalarOffset||l.rowStrideFloats!==p.cellRowStrideFloats||l.resolution!==m))throw TypeError(`successor surface translation inputs do not match the authenticated extraction descriptor`);return{descriptor:p,surfaceIndex:p.surfaceIndex,isolation:p.isovalue,sourceVoxelLinearIndex:p.fieldOffset,positionTransform:p.positionTransform,positionTransformResolution:m,fieldPadding:p.fieldPadding,refEdgeM:p.refEdgeM,fieldGradient:Object.freeze({buffer:p.scalarBuffer,scalarOffsetFloats:p.scalarOffset,rowStrideFloats:p.cellRowStrideFloats,resolution:m}),positionRows:e.positionRows}}function ks(e){let t=e?.surfaceVertices??null,n=e?.surfaceDraw??null,r=t?.surfaces??null,i=n?.surfaces??null,a=r?.[0]??null,o=i?.[0]??null,s=o;return{surfaceVertices:t,surfaceDraw:n,surfaceVerticesSurfaces:r,surfaceDrawSurfaces:i,surfaceVerticesSurface:a,surfaceDrawSurface:o,vertexRows:t?.vertexRows??null,drawRows:n?.drawRows??null,drawIndirectRows:n?.drawIndirectRows??null,compactedVertexRows:n?.compactedVertexRows??null,vertexRowsBuffer:t?.vertexRowsBuffer??null,drawRowsBuffer:n?.drawRowsBuffer??null,drawIndirectRowsBuffer:n?.drawIndirectRowsBuffer??null,compactedVertexRowsBuffer:n?.compactedVertexRowsBuffer??null,surfaceVerticesCompactPositionRowsBuffer:t?.compactPositionRowsBuffer??null,surfaceDrawCompactPositionRowsBuffer:n?.compactPositionRowsBuffer??null,surfaceVerticesCompactNormalRowsBuffer:t?.compactNormalRowsBuffer??null,surfaceDrawCompactNormalRowsBuffer:n?.compactNormalRowsBuffer??null,surfaceDrawRenderFieldGradientVolume:n?.renderFieldGradientVolume??null,surfaceDrawRenderFieldGradientBuffer:n?.renderFieldGradientVolume?.buffer??null,translationCompactNormalRowsBuffer:e?.compactNormalRowsBuffer??null,translationPositionTransform:e?.positionTransform??null,surfaceVerticesPositionTransform:t?.positionTransform??null,surfaceDrawPositionTransform:n?.positionTransform??null,surfaceVertexRowLayout:t?.rowLayout??null,surfaceDrawRowLayout:n?.rowLayout??null,surfaceDrawIndirectRowLayout:n?.drawIndirectRowLayout??null,structuralFingerprint:JSON.stringify({surfaceVertexRowLayout:t?.rowLayout??null,surfaceVertexRowStrideFloats:t?.rowStrideFloats??null,surfaceDrawRowLayout:n?.rowLayout??null,surfaceDrawRowStrideFloats:n?.rowStrideFloats??null,surfaceDrawIndirectRowLayout:n?.drawIndirectRowLayout??null,surfaceDrawIndirectRowStrideUints:n?.drawIndirectRowStrideUints??null,positionClamp:e?.positionClamp??null,surfaceVertexPositionClamp:t?.positionClamp??null,surfaceDrawPositionClamp:n?.positionClamp??null,surfaceVerticesSurfaces:r,surfaceDrawSurfaces:i}),renderConsumptionFingerprint:JSON.stringify({directCompactPositionDraw:n?.directCompactPositionDraw===!0,sourceVertexRowCount:n?.sourceVertexRowCount??null,sourceVertexCount:n?.sourceVertexCount??null,sourceVertexCountMode:n?.sourceVertexCountMode??null,vertexCount:n?.vertexCount??null,triangleCount:n?.triangleCount??null,compactPositionRowsBufferRetained:n?.compactPositionRowsBufferRetained??null,compactPositionRowsBufferByteLength:n?.compactPositionRowsBufferByteLength??null,compactPositionRowsBufferRowCount:n?.compactPositionRowsBufferRowCount??null,compactPositionRowsVertexCount:n?.compactPositionRowsVertexCount??null,compactPositionRowsStrideFloats:n?.compactPositionRowsStrideFloats??null,compactPositionRowsStrideBytes:n?.compactPositionRowsStrideBytes??null,compactPositionRowsFormat:n?.compactPositionRowsFormat??null,compactPositionRowsSchema:n?.compactPositionRowsSchema??null,compactPositionRowsOwnership:n?.compactPositionRowsOwnership??null,compactPositionRowsSurfaceGenerationId:n?.compactPositionRowsSurfaceGenerationId??null,compactPositionRowsVolumeGenerationId:n?.compactPositionRowsVolumeGenerationId??null,compactNormalRowsBufferRetained:n?.compactNormalRowsBufferRetained??null,compactNormalRowsBufferByteLength:n?.compactNormalRowsBufferByteLength??null,compactNormalRowsBufferRowCount:n?.compactNormalRowsBufferRowCount??null,compactNormalRowsSchema:n?.compactNormalRowsSchema??null,compactNormalRowsDescriptorSchema:n?.compactNormalRowsDescriptorSchema??null,compactNormalRowsLayoutName:n?.compactNormalRowsLayoutName??null,compactNormalRowsEncoding:n?.compactNormalRowsEncoding??null,compactNormalRowsSemantic:n?.compactNormalRowsSemantic??null,compactNormalRowsSourceSemantic:n?.compactNormalRowsSourceSemantic??null,compactNormalRowsNormalSign:n?.compactNormalRowsNormalSign??null,compactNormalRowsSurfaceGenerationId:n?.compactNormalRowsSurfaceGenerationId??null,compactNormalRowsPairedPositionSurfaceGenerationId:n?.compactNormalRowsPairedPositionSurfaceGenerationId??null,compactNormalRowsVolumeGenerationId:n?.compactNormalRowsVolumeGenerationId??null,compactNormalRowsSameSubmitAsPosition:n?.compactNormalRowsSameSubmitAsPosition??null,compactNormalRowsLifetimeOwner:n?.compactNormalRowsLifetimeOwner??null,compactNormalRowsPairedWithPositionBuffer:n?.compactNormalRowsPairedWithPositionBuffer??null,compactNormalRowsProducerStage:n?.compactNormalRowsProducerStage??null,compactNormalRowsTimestampSpanLabel:n?.compactNormalRowsTimestampSpanLabel??null,compactNormalRowsAdditionalSubmitCount:n?.compactNormalRowsAdditionalSubmitCount??null,compactNormalRowsOwnership:n?.compactNormalRowsOwnership??null,surfaceCount:n?.surfaceCount??null,activeSurfaceCount:n?.activeSurfaceCount??null,compactedVertexRowsBufferRetained:n?.compactedVertexRowsBufferRetained??null,compactedVertexRowsBufferByteLength:n?.compactedVertexRowsBufferByteLength??null,renderFieldGradientVolumePresent:n?.renderFieldGradientVolume!=null,renderFieldGradientDims:n?.renderFieldGradientVolume?.dims??null,renderFieldGradientScalarStrides:n?.renderFieldGradientVolume?.scalarStrides??null,renderFieldGradientScalarOffset:n?.renderFieldGradientVolume?.scalarOffset??null,drawIndirectRowsBufferRetained:n?.drawIndirectRowsBufferRetained??null,drawIndirectRowsBufferByteLength:n?.drawIndirectRowsBufferByteLength??null,drawIndirectRowsOwnership:n?.drawIndirectRowsOwnership??null,directCompactPositionDrawIndirectSource:n?.directCompactPositionDrawIndirectSource??null,readbackMode:n?.readbackMode??null,positionTransformStatus:n?.positionTransformStatus??null,positionClampStatus:n?.positionClampStatus??null,density:n?.density??null,isolation:n?.isolation??null,sourceVoxelLinearIndex:n?.sourceVoxelLinearIndex??null,fallbackNormal:n?.fallbackNormal??null}),primitiveFingerprint:JSON.stringify({status:e?.status??null,backend:e?.backend??null,sourceVertexCount:e?.sourceVertexCount??null,translatedVertexCount:e?.translatedVertexCount??null,triangleCount:e?.triangleCount??null,directCompactPositionDraw:e?.directCompactPositionDraw===!0,compactPositionRowsSurfaceGenerationId:e?.compactPositionRowsSurfaceGenerationId??null,compactPositionRowsVolumeGenerationId:e?.compactPositionRowsVolumeGenerationId??null,compactNormalRowsSurfaceGenerationId:e?.compactNormalRowsSurfaceGenerationId??null,compactNormalRowsPairedPositionSurfaceGenerationId:e?.compactNormalRowsPairedPositionSurfaceGenerationId??null,compactNormalRowsVolumeGenerationId:e?.compactNormalRowsVolumeGenerationId??null,positionTransformStatus:e?.positionTransformStatus??null,surfaceVertexStatus:t?.status??null,surfaceVertexCount:t?.vertexCount??null,surfaceVertexTriangleCount:t?.triangleCount??null,surfaceDrawStatus:n?.status??null,surfaceDrawVertexCount:n?.vertexCount??null,surfaceDrawTriangleCount:n?.triangleCount??null,surfaceIndex:s?.surfaceIndex??null,indirectOffsetBytes:s?.indirectOffsetBytes??null})}}function As({translation:e,extractionLineage:t}={}){if(!e||!t)return null;if(Ts(t.extensionExecution,t.sourceFamily)!==t)throw TypeError(`successor surface publication requires the still-active exact extraction lineage`);let n=ks(e),r={active:!0,device:t.device,sourceFamily:t.sourceFamily,descriptor:t.descriptor,extensionExecution:t.extensionExecution,extractionLineage:t,translation:e,...n,vertexRowsBytes:Bo(n.vertexRows),drawRowsBytes:Bo(n.drawRows),drawIndirectRowsBytes:Bo(n.drawIndirectRows),compactedVertexRowsBytes:Bo(n.compactedVertexRows)};return Ro.set(e,r),n.surfaceVertices&&Ro.set(n.surfaceVertices,r),n.surfaceDraw&&Ro.set(n.surfaceDraw,r),r}function js(e){let t=Ro.get(e);t&&(t.active=!1)}function Ms(e,{device:t,sourceFamily:n=e?.schroederSpatialSourceFamily??null,descriptor:r=null,extensionExecution:i=null}={}){let a=Ro.get(e);if(!a||a.active!==!0||a.device!==t||a.sourceFamily!==n||r&&a.descriptor!==r||i&&a.extensionExecution!==i)return!1;let o=null;try{o=Es(a.extensionExecution,a.sourceFamily)}catch{return!1}let s=ks(a.translation);return!!(o===a.extractionLineage&&Ko(a.translation,a.sourceFamily)&&Ko(a.surfaceVertices,a.sourceFamily)&&Ko(a.surfaceDraw,a.sourceFamily)&&a.translation?.surfaceVertices===a.surfaceVertices&&a.translation?.surfaceDraw===a.surfaceDraw&&s.surfaceVertices===a.surfaceVertices&&s.surfaceDraw===a.surfaceDraw&&s.surfaceVerticesSurfaces===a.surfaceVerticesSurfaces&&s.surfaceDrawSurfaces===a.surfaceDrawSurfaces&&s.surfaceVerticesSurface===a.surfaceVerticesSurface&&s.surfaceDrawSurface===a.surfaceDrawSurface&&s.vertexRows===a.vertexRows&&s.drawRows===a.drawRows&&s.drawIndirectRows===a.drawIndirectRows&&s.compactedVertexRows===a.compactedVertexRows&&Vo(s.vertexRows,a.vertexRowsBytes)&&Vo(s.drawRows,a.drawRowsBytes)&&Vo(s.drawIndirectRows,a.drawIndirectRowsBytes)&&Vo(s.compactedVertexRows,a.compactedVertexRowsBytes)&&s.vertexRowsBuffer===a.vertexRowsBuffer&&s.drawRowsBuffer===a.drawRowsBuffer&&s.drawIndirectRowsBuffer===a.drawIndirectRowsBuffer&&s.compactedVertexRowsBuffer===a.compactedVertexRowsBuffer&&s.surfaceVerticesCompactPositionRowsBuffer===a.surfaceVerticesCompactPositionRowsBuffer&&s.surfaceDrawCompactPositionRowsBuffer===a.surfaceDrawCompactPositionRowsBuffer&&s.surfaceVerticesCompactNormalRowsBuffer===a.surfaceVerticesCompactNormalRowsBuffer&&s.surfaceDrawCompactNormalRowsBuffer===a.surfaceDrawCompactNormalRowsBuffer&&s.surfaceDrawRenderFieldGradientVolume===a.surfaceDrawRenderFieldGradientVolume&&s.surfaceDrawRenderFieldGradientBuffer===a.surfaceDrawRenderFieldGradientBuffer&&s.translationCompactNormalRowsBuffer===a.translationCompactNormalRowsBuffer&&s.translationPositionTransform===a.translationPositionTransform&&s.surfaceVerticesPositionTransform===a.surfaceVerticesPositionTransform&&s.surfaceDrawPositionTransform===a.surfaceDrawPositionTransform&&s.translationPositionTransform===a.descriptor.positionTransform&&s.surfaceVerticesPositionTransform===a.descriptor.positionTransform&&s.surfaceDrawPositionTransform===a.descriptor.positionTransform&&s.surfaceVertexRowLayout===a.surfaceVertexRowLayout&&s.surfaceDrawRowLayout===a.surfaceDrawRowLayout&&s.surfaceDrawIndirectRowLayout===a.surfaceDrawIndirectRowLayout&&s.structuralFingerprint===a.structuralFingerprint&&s.renderConsumptionFingerprint===a.renderConsumptionFingerprint&&s.primitiveFingerprint===a.primitiveFingerprint)}async function Ns({device:e,extensionExecution:t,schroederSpatialSourceFamily:n=null,surfaceIndex:r=0,materialId:i=0,phaseId:a=0,opticalStateId:o=0,material:s=null,phase:c=null,renderKey:l=null,surfaceKey:u=null,density:d=0,isolation:m=null,sourceVoxelLinearIndex:g=0,fallbackNormal:_=[0,1,0],transparencyClassId:v=0,depthWriteFlag:y=1,renderOrder:b=null,positionTransform:x=null,positionTransformResolution:S=null,fieldPadding:C=null,refEdgeM:w=null,positionGridBias:E=-.5,positionClampMinM:D=null,positionClampMaxM:O=null,fieldGradient:k=null,readbackMode:j=Ao,compactSummaryReadback:N=!1,translateVertexRows:P=!0,allowExtensionDrawIndirectBuffer:F=!1,retainVertexRowsBuffer:I=!0,retainDrawRowsBuffer:L=!0,retainDrawIndirectRowsBuffer:ee=!0,waitForQueueCompletion:te=!0,onProgress:ne=null}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu requires a WebGPU-like device`);let re=Ts(t,n),ie=re?.sourceFamily??null;if(ie){let t=Os(re,{device:e,surfaceIndex:r,isolation:m,sourceVoxelLinearIndex:g,positionTransform:x,positionTransformResolution:S,fieldPadding:C,refEdgeM:w,fieldGradient:k,positionClampMinM:D,positionClampMaxM:O});r=t.surfaceIndex,m=t.isolation,g=t.sourceVoxelLinearIndex,x=t.positionTransform,S=t.positionTransformResolution,C=t.fieldPadding,w=t.refEdgeM,k=t.fieldGradient,D=null,O=null}let R=Cs(t);if(R.extensionOk!==!0)throw TypeError(R.reason||`extension surface execution was not successful`);let ae=ys(t?.result||null).buffer;if(!ae||R.extensionBufferRetained!==!0)throw TypeError(`buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu requires a retained extension surface buffer`);vs(t),ie&&ce(ie,{device:e,particleCount:ie.particleCount});let z=j===Ao,B=!!(z&&P===!1);if(!z&&P===!1)throw TypeError(`direct compact-position surface draw metadata requires no-full-readback mode`);let V=Math.max(3,Math.round($(R.extensionVertexStrideFloats,4))),H=Math.max(0,Math.round($(R.extensionVertexCount,0))),U=R.extensionVertexCountMode??null,oe=t?.result||null,W=bs(oe);if(B&&R.extensionPackedNormalReady!==!0)throw TypeError(`direct compact-position surface draw requires generation-matched packed normals (${R.extensionPackedNormalStatus})`);if(B&&W.normalSign!==-1)throw TypeError(`ULG SPH density surfaces require packed normalSign=-1`);let se=oe?.actualVertexCounterBuffer||oe?.vertexCounterBuffer||null,G=Math.max(0,Math.round($(oe?.actualVertexCounterBufferByteLength??oe?.vertexCounterBufferByteLength??se?.size,0))),K=oe?.drawIndirectBuffer||null,le=Math.max(0,Math.round($(oe?.drawIndirectBufferByteLength??K?.size,0))),de=se,pe=!1,_e=Math.floor(H/3),Ce=_e*3,we=Math.max(0,Math.round($(r,0))),Te=$(i,0),Ee=$(a,0),De=$(o,0),Oe=$(d,0),ke=$(m??t?.result?.isovalue??t?.isovalue,0),Ae=es(_),je=x||ts({resolution:S,fieldPadding:C,refEdgeM:w,positionGridBias:E}),Me=$o({min:D,max:O}),Ne=rs({positionTransform:je,positionClamp:Me}),Pe=b==null?we:$(b,we),Fe=$(v,0),Ie=$(y,1),Le=Ce*p.length*Float32Array.BYTES_PER_ELEMENT,Re=B?0:Le,ze=M.length*Float32Array.BYTES_PER_ELEMENT,Be=f.length*Uint32Array.BYTES_PER_ELEMENT,Ve=!!(B&&F&&!N&&K&&le>=Be),He=Ve?`webgpu-marching-cubes-extension-draw-indirect-buffer`:`ulg-compact-position-draw-metadata-kernel`,Ue=Ve?`extension-owned-retained-buffer`:`ulg-owned-retained-buffer`,We=typeof ne==`function`?(e,t={})=>{try{ne({status:e,stage:`webgpu-marching-cubes-extension-surface-translation`,sourceVertexCount:H,sourceVertexCountMode:U,translatedVertexCount:Ce,triangleCount:_e,vertexRowsByteLength:Re,translatedVertexRowsByteLength:Le,drawRowsByteLength:ze,drawIndirectRowsByteLength:Be,directCompactPositionDraw:B,directCompactPositionDrawIndirectSource:He,drawIndirectRowsOwnership:Ue,readbackMode:z?Ao:ko,compactSummaryReadback:!!N,...t})}catch{}}:()=>{};We(`extension-surface-translation-kernel-started`);let Ge=new Set,Ke=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,qe=!1,Je=(t,n=null)=>{let r=Ke&&n?he(ue(e,{bucketKey:n,label:t.label,size:t.size,usage:t.usage}),e,{bucketKey:n,size:t.size,usage:t.usage}):e.createBuffer(t);return Ge.add(r),r},Ye=(e,t=!1)=>{if(!e||!Ge.delete(e))return!1;try{ge(e,{allowPool:t})}catch{}return!0},Xe=e=>(e&&Ge.delete(e),e);try{let t=null;B||(t=Je({label:`ulg-sph-extension-surface-vertices`,size:Math.max(4,Re),usage:jo.STORAGE|jo.VERTEX|jo.COPY_SRC|jo.COPY_DST}));let n=B?`skipped-direct-compact-position-draw`:z?`skipped-no-full-readback-indirect-draw`:`cleared-for-readback`;!B&&!z&&Re>0&&e.queue.writeBuffer(t,0,new Float32Array(Ce*p.length));let r=new Float32Array(M.length);Ve&&ms(r,0,{surfaceIndex:we,materialId:Te,phaseId:Ee,opticalStateId:De,vertexOffset:0,vertexCount:Ce,triangleOffset:0,triangleCount:_e,renderOrder:Pe,transparencyClassId:Fe,depthWriteFlag:Ie,status:+(_e>0),boundsCenterM:Ne?.centerM??[0,0,0],boundsRadiusM:Ne?.radiusM??0});let i=Je({label:`ulg-sph-extension-surface-draw`,size:Math.max(4,ze),usage:jo.STORAGE|jo.COPY_SRC|jo.COPY_DST},`ulg-sph-extension-surface-draw`);e.queue.writeBuffer(i,0,r);let a=Ve?K:Je({label:`ulg-sph-extension-surface-draw-indirect`,size:Math.max(4,Be),usage:jo.STORAGE|jo.INDIRECT|jo.COPY_SRC|jo.COPY_DST},`ulg-sph-extension-surface-draw-indirect`);Ve||e.queue.writeBuffer(a,0,new Uint32Array(f.length));let o=Ve?null:Je({label:`ulg-sph-extension-surface-translation-params`,size:160,usage:jo.UNIFORM|jo.COPY_DST},`ulg-sph-extension-surface-translation-params`);!de&&!Ve&&(de=Je({label:`ulg-sph-extension-surface-source-vertex-count`,size:4,usage:jo.STORAGE|jo.COPY_DST},`ulg-sph-extension-surface-source-vertex-count`),e.queue.writeBuffer(de,0,new Uint32Array([H])),pe=!0);let d=k?.buffer&&Number.isFinite(k.resolution)&&k.resolution>0?{buffer:k.buffer,resolution:Math.round(k.resolution),scalarOffsetFloats:Math.max(0,Math.round(Number(k.scalarOffsetFloats)||0)),rowStrideFloats:Math.max(1,Math.round(Number(k.rowStrideFloats)||1))}:null;Ve||e.queue.writeBuffer(o,0,hs({vertexCount:H,sourceStrideFloats:V,surfaceIndex:we,triangleCount:_e,materialId:Te,phaseId:Ee,opticalStateId:De,density:Oe,isolation:ke,sourceVoxelLinearIndex:g,transparencyClassId:Fe,depthWriteFlag:Ie,renderOrder:Pe,fallbackNormal:Ae,positionTransform:je,positionClamp:Me,surfaceBounds:Ne,fieldGradient:d})),We(`extension-surface-translation-buffers-ready`);let m=Ve?null:B?fe(e,{cacheKey:`ulg-sph-webgpu-marching-cubes-extension-compact-surface-draw:v1`,label:`ulg-sph-webgpu-marching-cubes-extension-compact-surface-draw`,code:Jo,entryPoint:`main`,bindings:[q(0,`storage`),q(1,`storage`),q(2,`uniform`),q(3,`read-only-storage`)]}):fe(e,{cacheKey:`ulg-sph-webgpu-marching-cubes-extension-surface-translation:v3-degenerate-cull`,label:`ulg-sph-webgpu-marching-cubes-extension-surface-translation`,code:qo,entryPoint:`main`,bindings:[q(0,`read-only-storage`),q(1,`storage`),q(2,`storage`),q(3,`storage`),q(4,`uniform`),q(5,`read-only-storage`),q(6,`read-only-storage`)]}),_=Ve?`skipped-extension-draw-indirect-buffer`:m.cacheStatus??null,v=null,y=null,b=0,x=null;if(Ve)We(`extension-surface-translation-command-skipped`,{reason:`using extension-owned drawIndirectBuffer for direct compact-position draw`,workgroupCountX:b});else{let{pipeline:n,bindGroupLayout:r}=m;v=e.createBindGroup({layout:r,entries:B?[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:a}},{binding:2,resource:{buffer:o}},{binding:3,resource:{buffer:de}}]:[{binding:0,resource:{buffer:ae}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:i}},{binding:3,resource:{buffer:a}},{binding:4,resource:{buffer:o}},{binding:5,resource:{buffer:de}},{binding:6,resource:{buffer:d?.buffer||(x=Je({label:`ulg-sph-extension-surface-field-gradient-dummy`,size:4,usage:jo.STORAGE}))}}]}),y=e.createCommandEncoder();let s=y.beginComputePass();s.setPipeline(n),s.setBindGroup(0,v),b=B?1:Math.max(1,Math.ceil(Math.max(1,_e)/No)),s.dispatchWorkgroups(b),s.end(),We(`extension-surface-translation-command-encoded`,{workgroupCountX:b})}let S=new Float32Array,C=Ve?r:new Float32Array,w=new Uint32Array,E=!1,D=0,O=`not-submitted`,j=null,P=!1;z?(Ve?(O=`queue-work-not-required`,j=`extension-owned-draw-indirect-buffer`):te&&e.queue?.onSubmittedWorkDone?(e.queue.submit([y.finish()]),qe=!0,O=`queue-submitted`,j=`queue.submit`,await e.queue.onSubmittedWorkDone(),O=`queue-work-completed`,j=`queue.onSubmittedWorkDone`):(e.queue.submit([y.finish()]),qe=!0,O=e.queue?.onSubmittedWorkDone&&!N?`queue-submitted-cleanup-deferred`:`queue-submitted-no-explicit-completion`,j=e.queue?.onSubmittedWorkDone&&!N?`deferred queue.onSubmittedWorkDone cleanup`:`queue.submit`,P=!!(e.queue?.onSubmittedWorkDone&&!N)),N&&(C=new Float32Array(await gs(e,i,ze,`ulg-sph-extension-surface-draw-summary-readback`)),E=!0,D=ze,O=`compact-summary-readback-map-completed`,j=`mapAsync(compact-summary-readback-buffer)`)):(e.queue.submit([y.finish()]),qe=!0,O=`queue-submitted`,j=`queue.submit`,Re>0&&(S=new Float32Array(await gs(e,t,Re,`ulg-sph-extension-surface-vertex-readback`))),C=new Float32Array(await gs(e,i,ze,`ulg-sph-extension-surface-draw-readback`)),w=new Uint32Array(await gs(e,a,Be,`ulg-sph-extension-surface-draw-indirect-readback`)),O=`readback-map-completed`,j=`mapAsync(readback-buffer)`,We(`extension-surface-translation-full-readback-complete`));let F=()=>{Ye(o),Ye(x),pe&&Ye(de)},ne=!B&&(I||z),ce=L||z,ue=ee||z;ne||Ye(t),ce||Ye(i),!ue&&!Ve&&Ye(a),P?me(e,F):F();let he=_s({surfaceIndex:we,materialId:Te,phaseId:Ee,opticalStateId:De,material:s,phase:c,renderKey:l,surfaceKey:u,vertexCount:Ce,triangleCount:_e,renderOrder:Pe,transparencyClassId:Fe,depthWriteFlag:Ie,status:!z||N?_e>0?`surface-draw-ready`:`surface-draw-empty`:`surface-draw-summary-not-read`,boundsCenterM:Ne?.centerM??null,boundsRadiusM:Ne?.radiusM??null,indirectRowIndex:0,indirectOffsetBytes:0}),Le=se?`extension-gpu-vertex-counter`:`host-constant-vertex-count`,Ge=!!se,Ze=se?G:4,Qe=!!(ae&&R.extensionBufferRetained),$e=Math.max(0,Math.round($(R.extensionVertexStrideBytes,V*Float32Array.BYTES_PER_ELEMENT)))*H,et=oe?.surfaceGenerationId??null,tt=oe?.volumeGenerationId??null,nt=!!(B&&W.buffer&&W.bufferRetained&&R.extensionPackedNormalReady),rt=nt?W.bufferByteLength:0,it={compactNormalRowsBufferRetained:nt,compactNormalRowsBufferByteLength:rt,compactNormalRowsBufferRowCount:nt?W.rowCount:0,compactNormalRowsSchema:W.rowSchema,compactNormalRowsDescriptorSchema:W.descriptorSchema,compactNormalRowsLayoutName:W.layoutName,compactNormalRowsEncoding:W.encoding,compactNormalRowsSemantic:W.semantic,compactNormalRowsSourceSemantic:W.sourceSemantic,compactNormalRowsNormalSign:Number.isFinite(W.normalSign)?W.normalSign:null,compactNormalRowsSurfaceGenerationId:W.surfaceGenerationId,compactNormalRowsPairedPositionSurfaceGenerationId:W.pairedPositionSurfaceGenerationId,compactNormalRowsVolumeGenerationId:W.volumeGenerationId,compactNormalRowsSameSubmitAsPosition:W.sameSubmitAsPosition,compactNormalRowsLifetimeOwner:W.lifetimeOwner,compactNormalRowsPairedWithPositionBuffer:W.pairedWithPositionBuffer,compactNormalRowsProducerStage:W.producerStage,compactNormalRowsTimestampSpanLabel:W.timestampSpanLabel,compactNormalRowsAdditionalSubmitCount:W.additionalSubmitCount,compactNormalRowsOwnership:`extension-owned-retained-buffer`},at={translationPipelineCreated:!!m,translationBindGroupCreated:!!v,translationCommandEncoderCreated:!!y,translationWorkgroupCountX:b,translationSubmissionObserved:qe},ot={schema:T,backend:`webgpu`,...Go(ie),status:B?`surface-vertices-resident-extension-compact-position-direct`:z?`surface-vertices-resident-extension-compact-translation`:Ce>0?`surface-vertices-ready`:`surface-vertices-empty`,sourceSurfaceExecutionSchema:R.extensionExecutionSchema,sourceSurfaceSchema:R.extensionSurfaceSchema,surfaceExtractionMethod:B?`webgpu-marching-cubes-extension-compact-position-direct`:`webgpu-marching-cubes-extension-compact-position-gpu-translation`,compactionMode:B?`webgpu-extension-compact-position-direct`:`webgpu-extension-compact-position-to-ulg-rows`,directCompactPositionDraw:B,positionTransform:je,positionTransformStatus:je.status,positionClamp:Me,positionClampStatus:Me.status,surfaceCount:1,rowLayout:[...p],rowStrideFloats:p.length,vertexRows:S,vertexRowsByteLength:S.byteLength,vertexCount:Ce,vertexCountMode:U,triangleCount:_e,maxVertexRows:Ce,vertexRowsBufferByteLength:ne?Re:0,vertexRowsBufferRowCount:ne?Ce:0,vertexRowsBufferRetained:ne,sourceVertexCount:H,sourceVertexCountMode:U,sourceVertexCounterMode:Le,sourceVertexCounterBufferBound:!!de,sourceVertexCounterBufferRetained:Ge,sourceVertexCounterBufferByteLength:Ze,translatedVertexCount:Ce,ignoredTrailingVertexCount:H-Ce,sourceVertexRowsBufferBound:!0,sourceVertexFormat:R.extensionVertexFormat,sourceVertexStrideFloats:V,compactPositionRowsBufferRetained:Qe,compactPositionRowsBufferByteLength:$e,compactPositionRowsBufferRowCount:H,compactPositionRowsVertexCount:H,compactPositionRowsStrideFloats:V,compactPositionRowsStrideBytes:Math.max(0,Math.round($(R.extensionVertexStrideBytes,V*Float32Array.BYTES_PER_ELEMENT))),compactPositionRowsFormat:R.extensionVertexFormat,compactPositionRowsSchema:Co,compactPositionRowsOwnership:`extension-owned-retained-buffer`,compactPositionRowsSurfaceGenerationId:et,compactPositionRowsVolumeGenerationId:tt,...it,vertexRowsBufferClearStatus:n,translationPipelineCacheStatus:_,...at,directCompactPositionDrawIndirectSource:He,drawIndirectRowsOwnership:Ue,extensionDrawIndirectBufferRetained:!!K,extensionDrawIndirectBufferByteLength:le,readbackMode:z?Ao:ko,queueCompletionStatus:O,queueCompletionMethod:j,surfaceVertexReadback:!z,surfaces:[he],scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};ne&&(ot.vertexRowsBuffer=t),Qe&&(ot.compactPositionRowsBuffer=ae),nt&&(ot.compactNormalRowsBuffer=W.buffer);let st={schema:A,backend:`webgpu`,...Go(ie),status:B?`surface-draw-resident-extension-compact-position-direct`:z?`surface-draw-resident-extension-compact-translation`:_e>0?`surface-draw-metadata-ready`:`surface-draw-metadata-empty`,sourceSurfaceVertexSchema:ot.schema,sourceSurfaceVertexBackend:ot.backend,surfaceCount:1,activeSurfaceCount:+(_e>0),vertexCount:Ce,vertexCountMode:U,sourceVertexCount:H,sourceVertexCountMode:U,sourceVertexCounterMode:Le,sourceVertexCounterBufferBound:!!de,sourceVertexCounterBufferRetained:Ge,sourceVertexCounterBufferByteLength:Ze,vertexRowsBufferClearStatus:n,translationPipelineCacheStatus:_,...at,directCompactPositionDrawIndirectSource:He,drawIndirectRowsOwnership:Ue,extensionDrawIndirectBufferRetained:!!K,extensionDrawIndirectBufferByteLength:le,triangleCount:_e,rowLayout:[...M],rowStrideFloats:M.length,drawRows:C,drawRowsByteLength:ze,drawRowsBufferByteLength:ce?ze:0,drawRowsBufferRetained:ce,drawIndirectSchema:h,drawIndirectRowLayout:[...f],drawIndirectRowStrideUints:f.length,drawIndirectRows:w,drawIndirectRowsByteLength:Be,drawIndirectRowsBufferByteLength:ue?Be:0,drawIndirectRowsBufferRetained:ue,drawIndirectRowsOwnership:Ue,directCompactPositionDrawIndirectSource:He,extensionDrawIndirectBufferRetained:!!K,extensionDrawIndirectBufferByteLength:le,compactedVertexRows:z?new Float32Array:S,compactedVertexRowsByteLength:z?0:S.byteLength,compactedVertexRowsBufferByteLength:ne?Re:0,compactedVertexRowsBufferRetained:ne,compactPositionRowsBufferRetained:Qe,compactPositionRowsBufferByteLength:$e,compactPositionRowsBufferRowCount:H,compactPositionRowsVertexCount:H,compactPositionRowsStrideFloats:V,compactPositionRowsStrideBytes:Math.max(0,Math.round($(R.extensionVertexStrideBytes,V*Float32Array.BYTES_PER_ELEMENT))),compactPositionRowsFormat:R.extensionVertexFormat,compactPositionRowsSchema:Co,compactPositionRowsOwnership:`extension-owned-retained-buffer`,compactPositionRowsSurfaceGenerationId:et,compactPositionRowsVolumeGenerationId:tt,...it,directCompactPositionDraw:B,sourceVertexRowCount:Ce,sourceVertexRowsBufferBound:!0,readbackMode:z?Ao:ko,queueCompletionStatus:O,queueCompletionMethod:j,surfaceDrawReadback:!z,surfaceDrawSummaryReadback:E,surfaceDrawSummaryReadbackByteLength:D,fullSurfaceDrawReadback:!z,compactionMode:B?`webgpu-extension-compact-position-direct-draw-metadata`:`webgpu-extension-compact-position-to-ulg-draw-metadata`,positionTransform:je,positionTransformStatus:je.status,positionClamp:Me,positionClampStatus:Me.status,surfaces:[he],scientificValidation:!1,sphValidation:!1,surfaceExtractionValidation:!1,fullPhysicsValidation:!1};ce&&(st.drawRowsBuffer=i),ue&&(st.drawIndirectRowsBuffer=a),ne&&(st.compactedVertexRowsBuffer=t),Qe&&(st.compactPositionRowsBuffer=ae),nt&&(st.compactNormalRowsBuffer=W.buffer);let ct=be({ledgerId:`sph-extension-surface:${we}:${Ce}:buffer-leases`,stateKey:`sph-extension-surface`,scope:`sph-extension-surface-buffer-leases`}),lt=[],ut=({resourceKey:e,resourceKind:t,buffer:n,byteLength:r,rowCount:i,expectedConsumers:a,status:o=`resident-extension-surface-buffer-retained`})=>{ye(ct,{resourceKey:e,resourceKind:t,stateFamily:`render-surface`,ownerStage:`webgpu-marching-cubes-extension-surface-translation`,producerStage:`webgpu-marching-cubes-extension-surface-translation`,source:`buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu`,status:o,retained:!0,byteLength:r,rowCount:i,bufferLabel:n?.label,expectedConsumers:a});let s=Se(ct,{resourceKey:e,consumerStage:a?.[0]||`surface-renderer`,reason:`retained-extension-surface-buffer`});lt.push(s.leaseId)},dt=`extension-surface:vertex-rows:${Ce}:${Re}`,ft=`extension-surface:draw-rows:1:${ze}`,pt=`extension-surface:draw-indirect:1:${Be}`,mt=`extension-surface:compact-position:g${W.surfaceGenerationId??`unknown`}:${$e}`,ht=`extension-surface:packed-normal:g${W.surfaceGenerationId??`unknown`}:${rt}`;B&&Qe&&ut({resourceKey:mt,resourceKind:`extension-owned-compact-position-buffer`,buffer:ae,byteLength:$e,rowCount:H,expectedConsumers:[`surface-draw-renderer`,`diagnostics`],status:`resident-extension-surface-buffer-borrowed-generation-owned`}),nt&&ut({resourceKey:ht,resourceKind:`extension-owned-packed-normal-buffer`,buffer:W.buffer,byteLength:rt,rowCount:W.rowCount,expectedConsumers:[`surface-draw-renderer`,`diagnostics`],status:`resident-extension-surface-buffer-borrowed-generation-owned`}),ne&&ut({resourceKey:dt,resourceKind:`extension-surface-vertex-rows-buffer`,buffer:t,byteLength:Re,rowCount:Ce,expectedConsumers:[`surface-draw-renderer`,`diagnostics`]}),ce&&ut({resourceKey:ft,resourceKind:`extension-surface-draw-rows-buffer`,buffer:i,byteLength:ze,rowCount:1,expectedConsumers:[`surface-draw-renderer`,`diagnostics`]}),ue&&ut({resourceKey:pt,resourceKind:Ve?`extension-owned-draw-indirect-buffer`:`extension-surface-draw-indirect-buffer`,buffer:a,byteLength:Be,rowCount:1,expectedConsumers:[`surface-draw-renderer`,`diagnostics`],status:Ve?`resident-extension-surface-buffer-borrowed`:`resident-extension-surface-buffer-retained`});let Y={schema:wo,status:B?`extension-surface-compact-position-direct-resident-webgpu`:z?`extension-surface-translated-resident-webgpu`:`extension-surface-translated-to-ulg-rows`,reason:H===Ce?null:`extension vertexCount was not divisible by 3; trailing vertices were ignored`,backend:`webgpu`,...Go(ie),summary:R,sourceBufferBound:!0,sourceBufferRetained:R.extensionBufferRetained,compactPositionRowsBufferRetained:Qe,compactPositionRowsBufferByteLength:$e,compactPositionRowsVertexCount:H,compactPositionRowsStrideFloats:V,compactPositionRowsFormat:R.extensionVertexFormat,compactPositionRowsOwnership:`extension-owned-retained-buffer`,compactPositionRowsSurfaceGenerationId:et,compactPositionRowsVolumeGenerationId:tt,...it,directCompactPositionDraw:B,sourceVertexCount:H,translatedVertexCount:Ce,triangleCount:_e,ignoredTrailingVertexCount:H-Ce,sourceVertexFormat:R.extensionVertexFormat,sourceVertexStrideFloats:V,surfaceVertices:ot,surfaceDraw:st,vertexRowsBufferClearStatus:n,translationPipelineCacheStatus:_,...at,directCompactPositionDrawIndirectSource:He,drawIndirectRowsOwnership:Ue,extensionDrawIndirectBufferRetained:!!K,extensionDrawIndirectBufferByteLength:le,positionTransform:je,positionTransformStatus:je.status,positionClamp:Me,positionClampStatus:Me.status,readbackMode:z?Ao:ko,queueCompletionStatus:O,queueCompletionMethod:j,hotLoopGpuTranslationRequired:!1,hotLoopUlgVertexRowExpansionSkipped:B,residentBufferLeaseLedger:ct,residentBufferLeaseSummary:J(ct),residentBufferLeaseLedgerStatus:ct.status,residentBufferLeaseResourceCount:ct.resourceCount,residentBufferLeaseActiveLeaseCount:ct.activeLeaseCount};nt&&(Y.compactNormalRowsBuffer=W.buffer);let gt=()=>(Y.residentBufferLeaseSummary=J(ct),Y.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseSummary.status,Y.residentBufferLeaseResourceCount=Y.residentBufferLeaseSummary.resourceCount,Y.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseSummary.activeLeaseCount,ot.residentBufferLeaseSummary=Y.residentBufferLeaseSummary,ot.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseLedgerStatus,ot.residentBufferLeaseResourceCount=Y.residentBufferLeaseResourceCount,ot.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseActiveLeaseCount,st.residentBufferLeaseSummary=Y.residentBufferLeaseSummary,st.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseLedgerStatus,st.residentBufferLeaseResourceCount=Y.residentBufferLeaseResourceCount,st.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseActiveLeaseCount,Y.residentBufferLeaseSummary),_t=new Set,vt=null,yt=(e,t)=>{_t.has(e)||(_t.add(e),console.debug?.(`[ext-surface-destroy] surface=${we} key=${e} reason=${vt}`),ge(t,{allowPool:Ke}))};return Y.releaseExtensionSurfaceBufferLeases=({status:e=`released`}={})=>{for(let t of lt)xe(ct,t,{status:e});return gt()},Y.destroyExtensionSurfaceBuffers=({force:e=!1,releaseLeases:n=!1,reason:r=`extension-surface-buffer-cleanup`}={})=>(vt=r,js(Y),n&&Y.releaseExtensionSurfaceBufferLeases(),ne&&ve(ct,dt,()=>{yt(dt,t)},{force:e,reason:r}),B&&Qe&&ve(ct,mt,null,{force:e,reason:r}),nt&&ve(ct,ht,null,{force:e,reason:r}),ce&&ve(ct,ft,()=>{yt(ft,i)},{force:e,reason:r}),ue&&ve(ct,pt,Ve?null:()=>{yt(pt,a)},{force:e,reason:r}),gt()),ot.residentBufferLeaseLedger=ct,ot.residentBufferLeaseSummary=Y.residentBufferLeaseSummary,ot.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseLedgerStatus,ot.residentBufferLeaseResourceCount=Y.residentBufferLeaseResourceCount,ot.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseActiveLeaseCount,ot.releaseExtensionSurfaceBufferLeases=Y.releaseExtensionSurfaceBufferLeases,ot.destroyExtensionSurfaceBuffers=Y.destroyExtensionSurfaceBuffers,ot.releaseSurfaceVertexBufferLeases=Y.releaseExtensionSurfaceBufferLeases,ot.destroySurfaceVertexBuffers=Y.destroyExtensionSurfaceBuffers,st.residentBufferLeaseLedger=ct,st.residentBufferLeaseSummary=Y.residentBufferLeaseSummary,st.residentBufferLeaseLedgerStatus=Y.residentBufferLeaseLedgerStatus,st.residentBufferLeaseResourceCount=Y.residentBufferLeaseResourceCount,st.residentBufferLeaseActiveLeaseCount=Y.residentBufferLeaseActiveLeaseCount,st.releaseExtensionSurfaceBufferLeases=Y.releaseExtensionSurfaceBufferLeases,st.destroyExtensionSurfaceBuffers=Y.destroyExtensionSurfaceBuffers,st.releaseSurfaceDrawBufferLeases=Y.releaseExtensionSurfaceBufferLeases,st.destroySurfaceDrawBuffers=Y.destroyExtensionSurfaceBuffers,re&&As({translation:Y,extractionLineage:re}),ne&&Xe(t),ce&&Xe(i),ue&&!Ve&&Xe(a),Y}catch(t){let n=()=>{for(let e of[...Ge])Ye(e)};if(qe)try{me(e,n)}catch{n()}else n();throw t}}var Ps=`
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
`,Fs=`
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
`,Is=`
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

${Ps}

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

`,Ls=16*Float32Array.BYTES_PER_ELEMENT+192+16*Float32Array.BYTES_PER_ELEMENT,Rs=Is.replace(`struct CameraUniform {
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

fn resident_surface_color`),zs=`peercompute.ulg.native-surface-temperature-rows.v0`,Bs=`peercompute.ulg.native-surface-temperature-coverage.v0`,Vs=`peercompute.ulg.native-surface-temperature-execution.v0`,Hs=`peercompute.ulg.native-surface-temperature-f32-kelvin.v0`,Us={COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256},Ws=4294967295,Gs=Float32Array.BYTES_PER_ELEMENT,Ks=new WeakMap;function qs(e){let t=Ks.get(e);if(t)return{...t,dispatchPlanPipelineCacheStatus:`pipeline-cache-hit`,temperaturePipelineCacheStatus:`pipeline-cache-hit`};let n=fe(e,{cacheKey:`ulg-native-surface-temperature-dispatch-plan.v0`,label:`ulg-native-surface-temperature-dispatch-plan`,code:Js,entryPoint:`plan_dispatch`,bindings:[q(3,`uniform`),q(4,`read-only-storage`),q(5,`storage`)]}),r=fe(e,{cacheKey:`ulg-native-surface-temperature-rows.v1-indirect`,label:`ulg-native-surface-temperature-rows`,code:Js,entryPoint:`main`,bindings:[q(0,`read-only-storage`),q(1,`read-only-storage`),q(2,`storage`),q(3,`uniform`),q(4,`read-only-storage`)]}),i=Object.freeze({dispatchPlanPipeline:n.pipeline,dispatchPlanBindGroupLayout:n.bindGroupLayout,dispatchPlanPipelineCacheStatus:n.cacheStatus,pipeline:r.pipeline,bindGroupLayout:r.bindGroupLayout,temperaturePipelineCacheStatus:r.cacheStatus});return Ks.set(e,i),i}var Js=`
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
`;function Ys(e,t){if(!e||typeof e!=`object`&&typeof e!=`function`)throw TypeError(`${t} is required`);return e}function Xs(e,t){let n=Number(e);if(!Number.isSafeInteger(n)||n<0||n>Ws)throw RangeError(`${t} must be a non-negative uint32 integer`);return n}function Zs(e,t){let n=Xs(e,t);if(n<=0)throw RangeError(`${t} must be positive`);return n}function Qs(e,t,n){let r=Zs(t??e?.size,`${n}ByteLength`);if(r%Gs!==0)throw RangeError(`${n}ByteLength must be aligned to f32 rows`);if(Number.isFinite(Number(e?.size))&&r>Number(e.size))throw RangeError(`${n}ByteLength exceeds the GPU buffer size`);return r}function $s(e,t){if(!(Array.isArray(e)||ArrayBuffer.isView(e))||e.length<3)throw TypeError(`${t} must contain three uint32 integers`);return[Zs(e[0],`${t}[0]`),Zs(e[1],`${t}[1]`),Zs(e[2],`${t}[2]`)]}function ec(e,t){if(e==null)throw TypeError(`${t} must be explicitly authored`);return Xs(e,t)}function tc(e,t){if(e===void 0)throw TypeError(`${t} must be explicitly authored (null is allowed)`);return e===null?null:Xs(e,t)}function nc(e,t){return!!(e&&Object.prototype.hasOwnProperty.call(e,t))}function rc(e,t,n){if(e&&!nc(e,t))throw TypeError(`${n}.${t} must be explicitly authored`)}function ic(e,t,n){if(e!==t)throw RangeError(`${n} metadata disagrees across source descriptors`)}function ac(e,t,n){let r=Number(e?.limits?.maxStorageBufferBindingSize);if(Number.isFinite(r)&&r>0&&t>r)throw RangeError(`${n} exceeds maxStorageBufferBindingSize`)}function oc({conservativeVertexRowCount:e,compactPositionStrideFloats:t,compactPositionFloatCount:n,renderFieldFloatCount:r,fieldDimensions:i,fieldOffsetFloats:a,fieldStridesFloats:o,maxComputeWorkgroupsPerDimension:s=65535}){let c=new Uint32Array(64/4);return c[0]=e,c[1]=t,c[2]=n,c[3]=r,c[4]=i[0],c[5]=i[1],c[6]=i[2],c[7]=a,c[8]=o[0],c[9]=o[1],c[10]=o[2],c[11]=s,c}function sc({device:e,commandEncoder:t,compactPositions:n=null,actualVertexCounter:r=null,renderField:i=null,generation:a=null,compactPositionRowsBuffer:o=n?.buffer??null,compactPositionRowsBufferByteLength:s=n?.byteLength,conservativeVertexRowCount:c=n?.rowCount,compactPositionRowsStrideFloats:l=n?.strideFloats,actualVertexCounterBuffer:u=r?.buffer??null,actualVertexCounterBufferByteLength:d=r?.byteLength,renderFieldScalarsBuffer:f=i?.buffer??null,renderFieldScalarsBufferByteLength:p=i?.byteLength,fieldDimensions:m=i?.dims,fieldStridesFloats:h=i?.scalarStrides,fieldOffsetFloats:g=i?.scalarOffsetFloats??i?.scalarOffset??0,surfaceGenerationId:_=a?.surfaceGenerationId??n?.surfaceGenerationId,volumeGenerationId:v=nc(a,`volumeGenerationId`)?a.volumeGenerationId:nc(n,`volumeGenerationId`)?n.volumeGenerationId:void 0,renderFieldVolumeGenerationId:y=nc(i,`volumeGenerationId`)?i.volumeGenerationId:void 0,label:b=`ulg-native-surface-temperature-rows`}={}){if(Ys(e,`device`),typeof e.createBuffer!=`function`||typeof e.createShaderModule!=`function`||typeof e.createComputePipeline!=`function`||typeof e.createBindGroup!=`function`)throw TypeError(`device must provide the required WebGPU compute methods`);if(Ys(t,`commandEncoder`),typeof t.beginComputePass!=`function`)throw TypeError(`commandEncoder must be a caller-owned GPUCommandEncoder`);Ys(o,`compactPositionRowsBuffer`),Ys(u,`actualVertexCounterBuffer`),Ys(f,`renderFieldScalarsBuffer`),rc(n,`surfaceGenerationId`,`compactPositions`),rc(n,`volumeGenerationId`,`compactPositions`),rc(i,`volumeGenerationId`,`renderField`),rc(a,`surfaceGenerationId`,`generation`),rc(a,`volumeGenerationId`,`generation`);let x=ec(_,`surfaceGenerationId`);n&&ic(x,ec(n.surfaceGenerationId,`compactPositions.surfaceGenerationId`),`surfaceGenerationId`),a&&ic(x,ec(a.surfaceGenerationId,`generation.surfaceGenerationId`),`surfaceGenerationId`);let S=tc(v,`volumeGenerationId`);ic(S,tc(y,`renderFieldVolumeGenerationId`),`volumeGenerationId`),i&&ic(S,tc(i.volumeGenerationId,`renderField.volumeGenerationId`),`volumeGenerationId`),n&&ic(S,tc(n.volumeGenerationId,`compactPositions.volumeGenerationId`),`volumeGenerationId`),a&&ic(S,tc(a.volumeGenerationId,`generation.volumeGenerationId`),`volumeGenerationId`);let C=Zs(c,`conservativeVertexRowCount`),w=Zs(l,`compactPositionRowsStrideFloats`);if(w<3)throw RangeError(`compactPositionRowsStrideFloats must contain xyz`);let T=Qs(o,s,`compactPositionRowsBuffer`),E=T/Gs,D=C*w;if(!Number.isSafeInteger(D)||D>Ws||D>E)throw RangeError(`compact position buffer does not cover every conservative vertex row`);let O=Qs(u,d,`actualVertexCounterBuffer`);if(O<Uint32Array.BYTES_PER_ELEMENT)throw RangeError(`actualVertexCounterBuffer must contain one u32 counter`);let k=$s(m,`fieldDimensions`),A=$s(h,`fieldStridesFloats`),j=Xs(g,`fieldOffsetFloats`),M=Qs(f,p,`renderFieldScalarsBuffer`),N=M/Gs,P=j+(k[0]-1)*A[0]+(k[1]-1)*A[1]+(k[2]-1)*A[2]+4;if(!Number.isSafeInteger(P)||P>Ws||P>=N)throw RangeError(`render field buffer does not cover density lane 0 and temperature lane +4`);let F=C*Gs,I=Zs(e?.limits?.maxComputeWorkgroupsPerDimension??65535,`maxComputeWorkgroupsPerDimension`);ac(e,T,`compact position binding`),ac(e,M,`render field binding`),ac(e,F,`temperature output binding`),ac(e,Uint32Array.BYTES_PER_ELEMENT,`actual vertex counter binding`);let L=oc({conservativeVertexRowCount:C,compactPositionStrideFloats:w,compactPositionFloatCount:E,renderFieldFloatCount:N,fieldDimensions:k,fieldOffsetFloats:j,fieldStridesFloats:A,maxComputeWorkgroupsPerDimension:I}),ee=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,te=Us.UNIFORM|Us.COPY_DST,ne=3*Uint32Array.BYTES_PER_ELEMENT,re=Us.STORAGE|Us.INDIRECT,ie=Us.STORAGE|Us.COPY_SRC|Us.COPY_DST,R=Math.min(Number(e.limits?.maxStorageBufferBindingSize)||134217728,Number(e.limits?.maxBufferSize)||268435456),ae=F;if(ee){let e=4096;for(;e<F&&e*2<=R;)e*=2;ae=e>=F?e:F}let z=null,B=null,V=null;try{z=ee?ue(e,{bucketKey:`ulg-native-surface-temperature-rows-output`,label:`${b}-output`,size:ae,usage:ie}):e.createBuffer({label:`${b}-output`,size:F,usage:Us.STORAGE|Us.COPY_SRC}),ee&&typeof t.clearBuffer==`function`&&t.clearBuffer(z,0,F),B=ee?ue(e,{bucketKey:`ulg-native-surface-temperature-params`,label:`${b}-params`,size:64,usage:te}):e.createBuffer({label:`${b}-params`,size:64,usage:te}),e.queue.writeBuffer(B,0,L.buffer,L.byteOffset,L.byteLength),V=ee?ue(e,{bucketKey:`ulg-native-surface-temperature-dispatch-indirect`,label:`${b}-dispatch-indirect`,size:ne,usage:re}):e.createBuffer({label:`${b}-dispatch-indirect`,size:ne,usage:re});let{dispatchPlanPipeline:n,dispatchPlanBindGroupLayout:r,dispatchPlanPipelineCacheStatus:i,pipeline:a,bindGroupLayout:s,temperaturePipelineCacheStatus:c}=qs(e),l=de(e,{label:`${b}-dispatch-plan-bind-group`,layout:r,entries:[{binding:3,resource:{buffer:B,size:64}},{binding:4,resource:{buffer:u,size:Uint32Array.BYTES_PER_ELEMENT}},{binding:5,resource:{buffer:V,size:ne}}]}),d=de(e,{label:`${b}-bind-group`,layout:s,entries:[{binding:0,resource:{buffer:o,size:T}},{binding:1,resource:{buffer:f,size:M}},{binding:2,resource:{buffer:z,size:F}},{binding:3,resource:{buffer:B,size:64}},{binding:4,resource:{buffer:u,size:Uint32Array.BYTES_PER_ELEMENT}}]}),p=t.beginComputePass({label:`${b}-dispatch-plan-pass`});p.setPipeline(n),p.setBindGroup(0,l),p.dispatchWorkgroups(1),p.end();let m=t.beginComputePass({label:`${b}-compute-pass`});if(m.setPipeline(a),m.setBindGroup(0,d),typeof m.dispatchWorkgroupsIndirect!=`function`)throw TypeError(`commandEncoder compute pass must support dispatchWorkgroupsIndirect`);m.dispatchWorkgroupsIndirect(V,0),m.end();let h=!1,g={schema:Bs,status:`gpu-counter-clamped-prefix-encoded-zero-initialized-tail`,mode:`gpu-counter-clamped-conservative-vertex-row-prefix`,firstRow:0,endRowExclusive:C,rowCount:C,conservativeVertexRowCount:C,compactPositionRowCount:C,encodedRowCountSource:`gpu-actual-vertex-counter-clamped-to-conservative-capacity`,unusedTailInitialization:`webgpu-zero-initialized-fresh-output-buffer`,outputStrideFloats:1,outputByteLength:F,surfaceGenerationId:x,volumeGenerationId:S,complete:!0},_=i===c?i:`mixed-pipeline-cache-status`,v={schema:Vs,temperatureRowsSchema:zs,temperatureRowsLayoutName:Hs,status:`native-surface-temperature-command-encoded`,backend:`webgpu`,encoding:`f32-kelvin`,semantic:`density-weighted-render-field-temperature-k`,densityLaneOffsetFloats:0,temperatureLaneOffsetFloats:4,surfaceGenerationId:x,volumeGenerationId:S,coverage:g,temperatureRowsBuffer:z,temperatureRowsBufferByteLength:F,temperatureRowsBufferRowCount:C,temperatureRowsStrideFloats:1,temperatureRowsOwnership:`ulg-owned-generation-buffer`,paramsBuffer:B,paramsBufferByteLength:64,paramsBufferOwnership:`ulg-owned-generation-buffer`,dispatchArgsBuffer:V,dispatchArgsBufferByteLength:3*Uint32Array.BYTES_PER_ELEMENT,dispatchArgsBufferOwnership:`ulg-owned-generation-buffer`,actualVertexCounterBufferByteLength:O,actualVertexCounterMode:`gpu-actual-vertex-counter-clamped-to-conservative-capacity`,compactPositionRowsBufferByteLength:T,compactPositionRowsStrideFloats:w,renderFieldScalarsBufferByteLength:M,fieldDimensions:[...k],fieldStridesFloats:[...A],fieldOffsetFloats:j,workgroupCountX:null,workgroupCountXUpperBound:Math.min(I,Math.ceil(C/64)),workgroupCountYUpperBound:Math.max(1,Math.ceil(Math.ceil(C/64)/I)),maxComputeWorkgroupsPerDimension:I,dispatchMode:`dispatchWorkgroupsIndirect`,pipelineCacheStatus:_,dispatchPlanPipelineCacheStatus:i,temperaturePipelineCacheStatus:c,commandEncoderOwnership:`caller-owned-external-command-encoder`,commandPassCount:2,additionalSubmitCount:0,readbackPerformed:!1,fullReadbackPerformed:!1,destroyed:!1,destroy(){return h?!1:(h=!0,ee?(_e(e,z,{bucketKey:`ulg-native-surface-temperature-rows-output`,size:ae,usage:ie}),_e(e,B,{bucketKey:`ulg-native-surface-temperature-params`,size:64,usage:te}),_e(e,V,{bucketKey:`ulg-native-surface-temperature-dispatch-indirect`,size:ne,usage:re})):(z.destroy?.(),B.destroy?.(),V.destroy?.()),v.destroyed=!0,v.status=`native-surface-temperature-resources-destroyed`,!0)}};return v}catch(e){throw z?.destroy?.(),B?.destroy?.(),V?.destroy?.(),e}}export{mi as A,Ua as C,ui as D,Wa as E,ta as F,or as I,Xt as L,Ga as M,ba as N,Ba as O,Ia as P,dn as R,Ln as S,na as T,yo as _,Ls as a,jn as b,To as c,cs as d,ws as f,Ms as g,Ds as h,Fs as i,Ci as j,za as k,ps as l,us as m,zs as n,Rs as o,Wo as p,sc as r,Is as s,Hs as t,Ns as u,Xa as v,ya as w,kn as x,Nn as y};