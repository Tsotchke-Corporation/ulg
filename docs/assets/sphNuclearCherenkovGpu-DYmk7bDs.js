import"./eshkolTriadClosures-CAdZ5Pha.js";import{N as e,x as t,y as n}from"./polytopeAtlasBuilder-QwnCNpa5.js";import{acquireQueueOrderedPooledBuffer as r,computeBufferBinding as i,createCachedExplicitBindGroup as a,createCachedExplicitComputePipeline as o,deferSubmittedWorkCleanup as s,registerQueueOrderedPooledBufferReturn as c,releaseOrDestroyQueueOrderedPooledBuffer as l,unwrapWebGpuCacheDevice as u}from"../runtime/webgpuComputeLayout.js";import{t as d}from"./sphExactMassWgsl-DwXztSAS.js";import{_ as f,n as p,r as m}from"./sphExactThermalEnergyWgsl-TLzOns4c.js";import{a as h}from"./nuclearCherenkovClosure-BY7Gw8c1.js";import{a as g,n as _,r as v,t as y}from"./nativeSurfaceMaterialWgsl-DDdvgqXl.js";var b=`
struct IsosurfaceMotion {
  displacement: vec3<f32>,
  normal: vec3<f32>,
};

fn isosurface_motion_finite(value: f32) -> bool {
  return value == value && abs(value) < 1.0e30;
}

fn isosurface_motion_finite3(value: vec3<f32>) -> bool {
  return all(value == value) && all(abs(value) < vec3<f32>(1.0e30));
}

fn isosurface_motion_unit(value: vec3<f32>, fallback: vec3<f32>) -> vec3<f32> {
  if (!isosurface_motion_finite3(value)) { return fallback; }
  let scale = max(max(abs(value.x), abs(value.y)), abs(value.z));
  if (!(scale > 0.0)) { return fallback; }
  let scaled = value / scale;
  return scaled / length(scaled);
}

fn sample_isosurface_motion(
  grid: vec3<f32>, grid_scale_m: f32, normal: vec3<f32>,
  age_s: f32, max_displacement_m: f32,
  field_offset: u32, resolution: u32, row_count: u32
) -> IsosurfaceMotion {
  let source_normal = isosurface_motion_unit(normal, vec3<f32>(0.0, 1.0, 0.0));
  let held = IsosurfaceMotion(vec3<f32>(0.0), source_normal);
  if (!isosurface_motion_finite3(grid)
    || !isosurface_motion_finite(grid_scale_m) || !(grid_scale_m > 0.0)
    || !isosurface_motion_finite(age_s) || !(age_s > 0.0)
    || !isosurface_motion_finite(max_displacement_m) || !(max_displacement_m > 0.0)
    || resolution < 2u) { return held; }
  let available = min(row_count, arrayLength(&isosurface_motion_rows));
  if (field_offset >= available) { return held; }
  // Check both products before multiplication; hostile dimensions cannot wrap
  // a row index into another surface's sidecar.
  let remaining = available - field_offset;
  if (resolution > remaining / resolution) { return held; }
  let slab = resolution * resolution;
  if (resolution > remaining / slab) { return held; }

  let maximum = vec3<f32>(f32(resolution - 1u));
  let p = clamp(grid, vec3<f32>(0.0), maximum);
  let base = min(vec3<u32>(floor(p)), vec3<u32>(resolution - 2u));
  let f = p - vec3<f32>(base);
  var moment = vec4<f32>(0.0);
  var dx = vec4<f32>(0.0);
  var dy = vec4<f32>(0.0);
  var dz = vec4<f32>(0.0);
  for (var corner = 0u; corner < 8u; corner = corner + 1u) {
    let offset = vec3<u32>(corner & 1u, (corner >> 1u) & 1u, (corner >> 2u) & 1u);
    let cell = base + offset;
    let row = isosurface_motion_rows[field_offset + cell.x + resolution * cell.y + slab * cell.z];
    if (!isosurface_motion_finite3(row.xyz)
      || !isosurface_motion_finite(row.w) || row.w < 0.0
      || (row.w == 0.0 && any(row.xyz != vec3<f32>(0.0)))) { return held; }
    let w = select(vec3<f32>(1.0) - f, f, offset == vec3<u32>(1u));
    let sign = select(vec3<f32>(-1.0), vec3<f32>(1.0), offset == vec3<u32>(1u));
    moment += row * (w.x * w.y * w.z);
    dx += row * (sign.x * w.y * w.z);
    dy += row * (w.x * sign.y * w.z);
    dz += row * (w.x * w.y * sign.z);
  }
  if (!isosurface_motion_finite3(moment.xyz)
    || !isosurface_motion_finite(moment.w) || !(moment.w > 0.0)) { return held; }
  // Interpolate MOMENTS first: interpolating per-corner quotients invents
  // velocities at empty corners and does not conserve the sampling weights.
  let velocity = moment.xyz / moment.w;
  if (!isosurface_motion_finite3(velocity)) { return held; }
  // Quotient rule, then grid-to-world derivative. Outside the lattice the
  // clamped field is constant along that axis; endpoints use the inner limit.
  let active_axes = vec3<f32>(
    select(0.0, 1.0, grid.x >= 0.0 && grid.x <= maximum.x),
    select(0.0, 1.0, grid.y >= 0.0 && grid.y <= maximum.y),
    select(0.0, 1.0, grid.z >= 0.0 && grid.z <= maximum.z)
  );
  var jx = ((dx.xyz - velocity * dx.w) / moment.w / grid_scale_m) * (age_s * active_axes.x);
  var jy = ((dy.xyz - velocity * dy.w) / moment.w / grid_scale_m) * (age_s * active_axes.y);
  var jz = ((dz.xyz - velocity * dz.w) / moment.w / grid_scale_m) * (age_s * active_axes.z);
  var displacement = age_s * velocity;
  if (!isosurface_motion_finite3(displacement)
    || !isosurface_motion_finite3(jx) || !isosurface_motion_finite3(jy)
    || !isosurface_motion_finite3(jz)) { return held; }
  let magnitude_scale = max(max(abs(displacement.x), abs(displacement.y)), abs(displacement.z));
  if (magnitude_scale > 0.0) {
    let magnitude = magnitude_scale * length(displacement / magnitude_scale);
    if (magnitude >= max_displacement_m) {
      let direction = displacement / magnitude;
      let saturation_scale = max_displacement_m / magnitude;
      displacement = max_displacement_m * direction;
      // Derivative of R*d/|d|, not the uncapped velocity gradient. At the
      // nondifferentiable cap boundary choose the saturated outer derivative.
      jx = saturation_scale * (jx - direction * dot(direction, jx));
      jy = saturation_scale * (jy - direction * dot(direction, jy));
      jz = saturation_scale * (jz - direction * dot(direction, jz));
    }
  }
  jx += vec3<f32>(1.0, 0.0, 0.0);
  jy += vec3<f32>(0.0, 1.0, 0.0);
  jz += vec3<f32>(0.0, 0.0, 1.0);
  // Cofactor(F)*n transports oriented area normals without dividing by det F.
  // A rank-two map can retain a valid surface normal; collapsed/nonfinite
  // transported areas fall back to the normalized source normal.
  let transported_normal = cross(jy, jz) * source_normal.x
    + cross(jz, jx) * source_normal.y + cross(jx, jy) * source_normal.z;
  return IsosurfaceMotion(displacement, isosurface_motion_unit(transported_normal, source_normal));
}
`,x=`
struct WorkerSurfaceMotionUniform {
  grid: vec4<u32>,
  motion: vec4<f32>,
};
@group(0) @binding(6) var<storage, read> isosurface_motion_rows: array<vec4<f32>>;
@group(0) @binding(7) var<uniform> surface_motion: WorkerSurfaceMotionUniform;
${b}
`,S=`@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  var normal = compact_normal(vertex_index);
  let smooth_normal = compact_packed_normal(vertex_index);
  if (dot(smooth_normal, smooth_normal) > 0.25) {
    normal = smooth_normal;
  }
  let motion = sample_isosurface_motion(
    compact_position(vertex_index) + vec3<f32>(camera_data.position_grid_bias),
    camera_data.position_scale_m, normal, surface_motion.motion.x, surface_motion.motion.y,
    surface_motion.grid.x, surface_motion.grid.y, surface_motion.grid.z
  );
  let position_m = compact_world_position(vertex_index) + motion.displacement;
  var out: VertexOut;
  var clip = camera_data.view_projection * vec4<f32>(position_m, 1.0);
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  if (clip.w <= 0.0) {
    clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  }
  out.position = clip;
  out.world_position = position_m;
  out.normal = motion.normal;
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
`,C=/@vertex\nfn vs_main\(@builtin\(vertex_index\) vertex_index: u32\) -> VertexOut \{[\s\S]*?\n\}\n/;if(!C.test(v))throw Error(`shared native compact vertex entry unavailable for retained motion`);var w=x+v.replace(C,S);function T({pixels:e,width:t,height:n,mipLevelCount:r,sampleCount:i=64}={}){let a=Math.max(1,Math.round(Number(t)||0)),o=Math.max(1,Math.round(Number(n)||0)),s=Math.max(1,Math.round(Number(r)||1)),c=Math.max(1,Math.round(Number(i)||1)),l=new Float32Array(a*o*3);for(let t=0;t<a*o;t+=1)l[t*3+0]=((e[t*4+0]||0)/255)**2.2,l[t*3+1]=((e[t*4+1]||0)/255)**2.2,l[t*3+2]=((e[t*4+2]||0)/255)**2.2;let u=(e,t,n)=>{let r=e*a-.5,i=Math.min(Math.max(t*o-.5,0),o-1),s=Math.floor(r),c=Math.floor(i),u=r-s,d=i-c,f=(s%a+a)%a,p=(f+1)%a,m=Math.min(Math.max(c,0),o-1),h=Math.min(m+1,o-1);for(let e=0;e<3;e+=1){let t=l[(m*a+f)*3+e]*(1-u)+l[(m*a+p)*3+e]*u,r=l[(h*a+f)*3+e]*(1-u)+l[(h*a+p)*3+e]*u;n[e]=t*(1-d)+r*d}},d=[],f=a,p=o,m=[0,0,0];for(let t=0;t<s;t+=1){let n=new Uint8ClampedArray(f*p*4);if(t===0)for(let t=0;t<f*p;t+=1)n[t*4+0]=e[t*4+0],n[t*4+1]=e[t*4+1],n[t*4+2]=e[t*4+2],n[t*4+3]=255;else{let e=t/Math.max(1,s-1),r=e*e,i=new Float32Array(c*3);for(let e=0;e<c;e+=1){let t=(e+.5)/c,n=e;n=(n<<16|n>>>16)>>>0,n=((n&1431655765)<<1|(n&2863311530)>>>1)>>>0,n=((n&858993459)<<2|(n&3435973836)>>>2)>>>0,n=((n&252645135)<<4|(n&4042322160)>>>4)>>>0,n=((n&16711935)<<8|(n&4278255360)>>>8)>>>0;let a=n*23283064365386963e-26,o=2*Math.PI*t,s=Math.sqrt((1-a)/(1+(r*r-1)*a)),l=Math.sqrt(Math.max(0,1-s*s));i[e*3+0]=Math.cos(o)*l,i[e*3+1]=Math.sin(o)*l,i[e*3+2]=s}for(let e=0;e<p;e+=1){let t=(e+.5)/p*Math.PI,r=Math.cos(t),a=Math.sin(t);for(let t=0;t<f;t+=1){let o=((t+.5)/f-.5)*2*Math.PI,s=Math.cos(o)*a,l=Math.sin(o)*a,d=Math.abs(r)<.999,p=+!d,h=+!!d,g=h*l-0*r,_=0*s-p*l,v=p*r-h*s,y=Math.hypot(g,_,v)||1;g/=y,_/=y,v/=y;let b=r*v-l*_,x=l*g-s*v,S=s*_-r*g,C=0,w=0,T=0,E=0;for(let e=0;e<c;e+=1){let t=i[e*3+0]*g+i[e*3+1]*b+i[e*3+2]*s,n=i[e*3+0]*_+i[e*3+1]*x+i[e*3+2]*r,a=i[e*3+0]*v+i[e*3+1]*S+i[e*3+2]*l,o=s*t+r*n+l*a,c=2*o*t-s,d=2*o*n-r,f=2*o*a-l,p=s*c+r*d+l*f;p<=0||(u(Math.atan2(f,c)*.15915494+.5,Math.acos(Math.min(Math.max(d,-1),1))*.31830989,m),C+=m[0]*p,w+=m[1]*p,T+=m[2]*p,E+=p)}let D=E>0?1/E:0,O=(e*f+t)*4;n[O+0]=Math.round(Math.min(Math.max(C*D,0),1)**(1/2.2)*255),n[O+1]=Math.round(Math.min(Math.max(w*D,0),1)**(1/2.2)*255),n[O+2]=Math.round(Math.min(Math.max(T*D,0),1)**(1/2.2)*255),n[O+3]=255}}}d.push({width:f,height:p,pixels:n}),f=Math.max(1,f>>1),p=Math.max(1,p>>1)}return d}var E=_,D=136,O=6,k=20,A=(e,t)=>(Array.isArray(e)||ArrayBuffer.isView(e))&&e.length===t&&Array.from(e).every(Number.isFinite);function j(e,t){if(e.byteLength!==t.byteLength)return!1;let n=new Uint8Array(e.buffer,e.byteOffset,e.byteLength),r=new Uint8Array(t.buffer,t.byteOffset,t.byteLength);return n.every((e,t)=>e===r[t])}function ee(e,t){return e.schema===t.schema&&e.recordCount===t.recordCount&&e.spectralSampleCount===t.spectralSampleCount&&e.recordStrideBytes===t.recordStrideBytes&&e.spectralSampleStrideBytes===t.spectralSampleStrideBytes&&j(e.records,t.records)&&j(e.spectralSamples,t.spectralSamples)}function M(e){let r=e?.opticalTable;if(e?.schema!==`peercompute.ulg.worker-native-surface-material.v0`||r?.schema!==`peercompute.ulg.optical-gpu-table.v0`||!(r.records instanceof Float32Array)||!(r.spectralSamples instanceof Float32Array)||!Number.isSafeInteger(r.recordCount)||r.recordCount<=0||!Number.isSafeInteger(r.spectralSampleCount)||r.spectralSampleCount<0||r.recordStrideFloats!==n||r.recordStrideBytes!==n*4||r.spectralSampleStrideFloats!==t||r.spectralSampleStrideBytes!==t*4||r.records.length!==r.recordCount*n||r.spectralSamples.length!==r.spectralSampleCount*t||!r.records.every(Number.isFinite)||!r.spectralSamples.every(Number.isFinite))throw TypeError(`worker native surface requires the exact finite optical closure table`);return Object.freeze({...e,lightingProfile:Object.freeze({...e.lightingProfile}),backgroundClearValue:Object.freeze({...e.backgroundClearValue}),opticalTable:Object.freeze({schema:r.schema,recordCount:r.recordCount,recordStrideFloats:n,recordStrideBytes:n*4,spectralSampleCount:r.spectralSampleCount,spectralSampleStrideFloats:t,spectralSampleStrideBytes:t*4,records:new Float32Array(r.records),spectralSamples:new Float32Array(r.spectralSamples)})})}function te(e,t,n){let r=new Float32Array(E/4),i=new Uint32Array(r.buffer);if(!A(e.viewProjectionMatrix,16)||!A(n,16))throw TypeError(`native surface requires finite forward and inverse camera matrices`);r.set(e.viewProjectionMatrix,0),r.set(n,64);let a=t.metadata||{},o=t.translation?.surfaceDraw||{},s=t.translation?.surfaceVertices||{},c=t.translation?.positionTransform||t.descriptor?.positionTransform||{},l=t.translation?.positionClamp||{},u=(e.nativeSurfaceAppearance||e.request?.nativeSurfaceMaterial||{}).lightingProfile||{};i[16]=s.compactPositionRowsVertexCount??s.compactPositionRowsBufferRowCount??0,i[17]=s.compactPositionRowsStrideFloats??o.compactPositionRowsStrideFloats??4,i[18]=t.descriptor?.surfaceIndex||0,r[20]=Number(a.materialId)||0,r[21]=Number(a.phaseId)||0,r[22]=Number(a.opticalStateId)||0,r[23]=Number(a.density)||0,r[24]=Number(t.descriptor?.isovalue)||0,r[26]=Number(a.transparencyClassId)||0,r[27]=Number(a.depthWriteFlag)===0?0:1,r[28]=Number(a.renderOrder)||0,r.set([0,1,0],29);let d=c.enabled===!0;r[32]=d&&Number.isFinite(c.scaleM)?c.scaleM:1,r.set(d&&A(c.originM,3)?c.originM:[0,0,0],33),r[36]=d&&Number.isFinite(c.gridBias)?c.gridBias:0,r[37]=+!!d,r[38]=Number(u.nativeAmbientSuppression)||0,r[39]=Number(u.nativeDirectSuppression)||0,l.enabled===!0&&A(l.minM,3)&&A(l.maxM,3)&&(r.set(l.minM,40),r.set(l.maxM,43),r[46]=1),r[47]=Number(u.nativeEnvironmentSuppression)||0;let f=e.boxDimsM;return r[51]=A(f,3)?Math.hypot(...f)/2:0,r.set(A(e.cameraPositionM,3)?e.cameraPositionM:[0,0,0],60),r[63]=Math.max(0,Number(a.emissiveTemperatureK)||0),r}function N(e){let t=Math.max(0,Number(e?.drawMotionAgeS)||0),n=Number(e?.motionPacing?.maxSimulationAgeS)||0;if(!(t>0)||!(n>0))return t;let r=n*.65;return r*(1-Math.exp(-t/r))}function ne(e,t,n){let r=new Float32Array(32/4);if(!e.motionField?.buffer)return r;let i=new Uint32Array(r.buffer);return i[0]=t.descriptor?.fieldOffset??0,i[1]=t.metadata?.resolution??0,i[2]=e.motionField.rowCount,r[4]=N(e),r[5]=Math.abs(n[32]),r}function P(e){let t=e?.metadata||{};return t.renderLayer===`vapor-surface`||Number(t.transparencyClassId)===1?`vapor`:t.renderLayer===`refractive-surface`||Number(t.transparencyClassId)===2?`refractive`:`opaque`}function F({device:t,format:n,depthFormat:i,onAppearanceReady:a=null,fetchImage:o=(...e)=>globalThis.fetch(...e),decodeImage:u=(...e)=>globalThis.createImageBitmap(...e),createEnvironmentCanvas:d=(e,t)=>new globalThis.OffscreenCanvas(e,t),createBackgroundCanvas:f=d}){let p=!1,m=null,h=new Map,g=new Map,_=new Set,v=new Set,b=e=>(v.add(e),e),x=typeof globalThis.GPUDevice==`function`&&t instanceof globalThis.GPUDevice,S=(e,n,i,a)=>b(x?c(r(t,{bucketKey:e,label:n,size:i,usage:a}),t,{bucketKey:e,size:i,usage:a}):t.createBuffer({label:n,size:i,usage:a})),C=e=>{let n=[...new Set(e.filter(e=>e&&v.has(e)))];for(let e of n)v.delete(e);n.length!==0&&s(t,()=>{for(let e of n)l(e,{allowPool:!p&&x})})},E=t.createSampler({magFilter:`linear`,minFilter:`linear`,mipmapFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`}),A=t.createSampler({magFilter:`linear`,minFilter:`linear`,mipmapFilter:`linear`,addressModeU:`repeat`,addressModeV:`clamp-to-edge`}),j=b(t.createTexture({label:`ulg-worker-native-dummy-color`,size:[1,1],format:`rgba8unorm`,usage:O}));t.queue.writeTexture({texture:j},new Uint8Array([0,0,0,255]),{bytesPerRow:4},[1,1]);let M=b(t.createTexture({label:`ulg-worker-native-dummy-back-depth`,size:[1,1],format:`depth32float`,usage:k})),N=b(t.createBuffer({label:`ulg-worker-native-no-vertex-temperature`,size:16,usage:D})),F=b(t.createBuffer({label:`ulg-worker-native-no-motion`,size:16,usage:D})),I=t.createShaderModule({label:`ulg-worker-shared-native-surface`,code:w}),L=t.createBindGroupLayout({entries:[{binding:0,visibility:1,buffer:{type:`read-only-storage`}},{binding:1,visibility:3,buffer:{type:`uniform`}},{binding:2,visibility:2,buffer:{type:`read-only-storage`}},{binding:3,visibility:2,buffer:{type:`read-only-storage`}},{binding:4,visibility:1,buffer:{type:`read-only-storage`}},{binding:5,visibility:1,buffer:{type:`read-only-storage`}},{binding:6,visibility:1,buffer:{type:`read-only-storage`}},{binding:7,visibility:1,buffer:{type:`uniform`,minBindingSize:32}}]}),R=t.createBindGroupLayout({entries:[{binding:0,visibility:2,texture:{sampleType:`float`}},{binding:1,visibility:2,sampler:{type:`filtering`}},{binding:2,visibility:2,texture:{sampleType:`float`}},{binding:3,visibility:2,sampler:{type:`filtering`}},{binding:4,visibility:2,texture:{sampleType:`depth`}}]}),z=t.createPipelineLayout({bindGroupLayouts:[L,R]}),B=e=>t.createRenderPipelineAsync?t.createRenderPipelineAsync(e):Promise.resolve(t.createRenderPipeline(e)),V={},H={color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},U=(async()=>{let e=(await I.getCompilationInfo?.())?.messages?.filter(e=>e.type===`error`)||[];if(e.length)throw Error(e.map(e=>e.message).join(`; `));await Promise.all([`opaque`,`vapor`,`backface`].map(async e=>{let t=e===`backface`;V[e]=await B({label:`ulg-worker-native-surface-${e}`,layout:z,vertex:{module:I,entryPoint:`vs_main`},...t?{}:{fragment:{module:I,entryPoint:`fs_main`,targets:[{format:n,...e===`vapor`?{blend:H}:{}}]}},primitive:{topology:`triangle-list`,cullMode:t?`front`:`back`},depthStencil:{format:t?`depth32float`:i,depthWriteEnabled:e!==`vapor`,depthCompare:t?`less`:`less-equal`}})}));let r=t.createShaderModule({code:y});V.background=await B({label:`ulg-worker-native-background`,layout:`auto`,vertex:{module:r,entryPoint:`vs_main`},fragment:{module:r,entryPoint:`fs_main`,targets:[{format:n}]},primitive:{topology:`triangle-list`},depthStencil:{format:i,depthWriteEnabled:!1,depthCompare:`always`}})})(),W=e=>{if(!(p||g.get(e.url)!==e||e.refs<=0))try{a?.({backgroundImageUrl:e.url,status:e.status,error:e.error})}catch{}},G=e=>{e&&(e.width=1,e.height=1)},K=e=>{if(!e)return null;let n=g.get(e);return n||(n={url:e,refs:0,texture:null,status:`pending`,error:null,environmentTexture:null,environmentStatus:`pending`,environmentError:null,abort:new AbortController},g.set(e,n),n.ready=Promise.resolve().then(async()=>{let r=await o(e,{signal:n.abort.signal});if(!r.ok)throw Error(`native background image HTTP ${r.status}`);if(p||g.get(e)!==n)return;let i=await u(await r.blob()),a=null;try{if(p||g.get(e)!==n)return;let r=Math.max(1,Number(i.width)||1),o=Math.max(1,Number(i.height)||1),s=Math.max(1,Math.floor(Number(t.limits?.maxTextureDimension2D)||2048)),c=Math.min(1,Math.min(2048,s)/Math.max(r,o));n.width=Math.max(1,Math.round(r*c)),n.height=Math.max(1,Math.round(o*c)),a=f(n.width,n.height);let l=a.getContext(`2d`,{willReadFrequently:!0});if(!l)throw Error(`native background resize sampler unavailable`);l.drawImage(i,0,0,n.width,n.height);let u=l.getImageData(0,0,n.width,n.height).data,m=n.width*4,h=Math.ceil(m/256)*256,_=u;if(h!==m){_=new Uint8Array(h*n.height);for(let e=0;e<n.height;e++)_.set(u.subarray(e*m,(e+1)*m),e*h)}n.texture=b(t.createTexture({label:`ulg-worker-native-background-image`,size:[n.width,n.height,1],format:`rgba8unorm`,usage:O})),t.queue.writeTexture({texture:n.texture},_,{bytesPerRow:h,rowsPerImage:n.height},[n.width,n.height,1]),G(a),a=null,n.status=`ready`;let v=null;try{v=d(256,128);let e=v.getContext(`2d`,{willReadFrequently:!0});if(!e)throw Error(`native environment 2D image sampler unavailable`);e.drawImage(i,0,0,256,128);let r=T({pixels:e.getImageData(0,0,256,128).data,width:256,height:128,mipLevelCount:9,sampleCount:64});n.environmentTexture=b(t.createTexture({label:`ulg-worker-native-environment-prefilter`,size:[256,128],format:`rgba8unorm`,mipLevelCount:9,usage:O}));for(let e=0;e<r.length;e++)t.queue.writeTexture({texture:n.environmentTexture,mipLevel:e},r[e].pixels,{bytesPerRow:r[e].width*4,rowsPerImage:r[e].height},[r[e].width,r[e].height,1]);n.environmentStatus=`ready`}catch(e){C([n.environmentTexture]),n.environmentTexture=null,n.environmentStatus=`failed`,n.environmentError=String(e?.message||e)}finally{G(v)}}finally{G(a),i.close()}}).catch(e=>{C([n.texture]),n.texture=null,n.status=`failed`,n.error=String(e?.message||e),n.environmentStatus=`unavailable-background-failed`}).finally(()=>W(n))),n.refs+=1,n},q=e=>{!e||--e.refs>0||(g.get(e.url)===e&&g.delete(e.url),e.abort.abort(),C([e.texture,e.environmentTexture]))},J=n=>{for(let e of _)if(ee(e.table,n))return e.refs+=1,e;let r=e(t,n);b(r.recordsBuffer),b(r.spectralSamplesBuffer);let i={buffers:r,refs:1,table:{...n,records:new Float32Array(n.records),spectralSamples:new Float32Array(n.spectralSamples)}};return _.add(i),i},Y=e=>{!e||--e.refs>0||(_.delete(e),C([e.buffers.recordsBuffer,e.buffers.spectralSamplesBuffer]))},X=e=>{let t=h.get(e);t&&(h.delete(e),q(t.background),Y(t.optical),C([t.backgroundUniform,...[...t.bindGroups.values()].map(e=>e.motionUniform)]))},Z=async(e,r)=>{if(await U,p)throw Error(`worker native material disposed`);let[i,a]=r.map(Math.floor);if(!(Number.isFinite(i)&&Number.isFinite(a)&&i>0&&a>0))throw TypeError(`native material viewport unavailable`);(!m||m.width!==i||m.height!==a)&&(m&&C([m.color,m.backDepth]),m={width:i,height:a,color:b(t.createTexture({label:`ulg-worker-native-scene-copy`,size:[i,a],format:n,usage:O})),backDepth:b(t.createTexture({label:`ulg-worker-native-back-depth`,size:[i,a],format:`depth32float`,usage:k}))});let o=e.request.nativeSurfaceMaterial,s=e.nativeSurfaceAppearance||o,c=h.get(e);if(!c){let t=J(o.opticalTable);try{c={optical:t,background:null,backgroundUrl:null,bindGroups:new Map,backgroundUniform:S(`ulg-worker-native-background-uniform`,`ulg-worker-native-background-uniform`,16,72)},h.set(e,c)}catch(e){throw Y(t),e}}let l=s.backgroundImageUrl||null;c.backgroundUrl!==l&&(q(c.background),c.backgroundUrl=l,c.background=K(l));let u=c.background?.environmentTexture||j;return(c.opticsTargets!==m||c.environmentTexture!==u)&&(c.opticsBindGroup=t.createBindGroup({layout:R,entries:[{binding:0,resource:m.color.createView()},{binding:1,resource:E},{binding:2,resource:u.createView()},{binding:3,resource:A},{binding:4,resource:m.backDepth.createView()}]}),c.opaqueOpticsBindGroup=t.createBindGroup({layout:R,entries:[{binding:0,resource:j.createView()},{binding:1,resource:E},{binding:2,resource:u.createView()},{binding:3,resource:A},{binding:4,resource:M.createView()}]}),c.opticsTargets=m,c.environmentTexture=u),c.diagnostics=$(e),c},Q=(e,n,r,{inverse:i,refractive:a=!1,backface:o=!1}={})=>{let s=h.get(n),c=r.translation?.surfaceVertices,l=r.translation?.surfaceDraw?.drawIndirectRowsBuffer;if(p||!s||!c?.compactPositionRowsBuffer||!c?.compactNormalRowsBuffer||!l||!r.uniformBuffer)return!1;let u=te(n,r,i);t.queue.writeBuffer(r.uniformBuffer,0,u);let d=r.translation?.surfaceDraw?.compactTemperatureRowsBuffer||N,f=n.motionField?.buffer||F,m=[c.compactPositionRowsBuffer,r.uniformBuffer,s.optical.buffers.recordsBuffer,s.optical.buffers.spectralSamplesBuffer,c.compactNormalRowsBuffer,d,f],g=s.bindGroups.get(r);return g||(g={motionUniform:S(`ulg-worker-native-surface-motion-uniform`,`ulg-worker-native-surface-motion-uniform`,32,72)},s.bindGroups.set(r,g)),(!g.inputs||m.some((e,t)=>e!==g.inputs[t]))&&(g.bindGroup=t.createBindGroup({layout:L,entries:[{binding:0,resource:{buffer:c.compactPositionRowsBuffer}},{binding:1,resource:{buffer:r.uniformBuffer}},{binding:2,resource:{buffer:s.optical.buffers.recordsBuffer}},{binding:3,resource:{buffer:s.optical.buffers.spectralSamplesBuffer}},{binding:4,resource:{buffer:c.compactNormalRowsBuffer}},{binding:5,resource:{buffer:d}},{binding:6,resource:{buffer:f}},{binding:7,resource:{buffer:g.motionUniform}}]}),g.inputs=m),g.temperatureMode=d===N?`uniform-temperature-fallback`:`retained-compact-temperature-rows`,t.queue.writeBuffer(g.motionUniform,0,ne(n,r,u)),e.setPipeline(V[o?`backface`:P(r)===`vapor`?`vapor`:`opaque`]),e.setBindGroup(0,g.bindGroup),e.setBindGroup(1,a?s.opticsBindGroup:s.opaqueOpticsBindGroup),e.drawIndirect(l,0),!0},re=(e,n)=>{let r=h.get(n);if(!r?.background?.texture)return!1;let i=r.background.width/r.background.height,a=m.width/m.height,o=i>a?[a/i,1]:[1,i/a];return t.queue.writeBuffer(r.backgroundUniform,0,new Float32Array([...o,0,0])),e.setPipeline(V.background),r.backgroundBindTexture!==r.background.texture&&(r.backgroundBindGroup=t.createBindGroup({layout:V.background.getBindGroupLayout(0),entries:[{binding:0,resource:r.background.texture.createView()},{binding:1,resource:E},{binding:2,resource:{buffer:r.backgroundUniform}}]}),r.backgroundBindTexture=r.background.texture),e.setBindGroup(0,r.backgroundBindGroup),e.draw(3),!0},$=e=>{let t=h.get(e);return Object.freeze({backgroundStatus:t?.background?.status||`not-requested`,backgroundError:t?.background?.error||null,backgroundImageUrl:t?.backgroundUrl||null,environmentPrefilterStatus:t?.background?.environmentStatus||`not-requested`,environmentPrefilterError:t?.background?.environmentError||null,environmentLightingSource:t?.background?.environmentTexture?`native-ggx-prefilter-256x128-9mips-64samples`:`native-analytic-fallback`,opticalTableCacheEntryCount:_.size,temperatureModes:[...new Set(Array.from(t?.bindGroups?.values()??[]).map(e=>e.temperatureMode).filter(Boolean))]})};return{ready:U,prepare:Z,draw:Q,drawBackground:re,releaseFrame:X,getDiagnostics:$,clearValue:e=>{let t=e?.nativeSurfaceAppearance||e?.request?.nativeSurfaceMaterial||{};if(t.backgroundImageUrl)return{r:0,g:0,b:0,a:1};let n=t.backgroundClearValue;if(n&&[`r`,`g`,`b`].every(e=>Number.isFinite(n[e])&&n[e]>=0&&n[e]<=1)&&n.a===1)return{r:n.r,g:n.g,b:n.b,a:1};let r=String(t.backgroundColor||``).replace(/^#/,``);return/^[0-9a-f]{6}$/i.test(r)?{r:parseInt(r.slice(0,2),16)/255,g:parseInt(r.slice(2,4),16)/255,b:parseInt(r.slice(4,6),16)/255,a:1}:{r:0,g:0,b:0,a:1}},getSurfaceDrawResources(e,t){let n=h.get(e);if(!n)return null;let r=n.bindGroups.get(t);return{opticalRecordsBuffer:n.optical?.buffers?.recordsBuffer??null,motionUniformBuffer:r?.motionUniform??null}},transferFrame(e,t){let n=h.get(e);n&&e!==t&&(X(t),h.delete(e),h.set(t,n))},copySceneColor(e,t){e.copyTextureToTexture({texture:t},{texture:m.color},[m.width,m.height])},backDepthView(){return m.backDepth.createView()},dispose(){if(!p){p=!0;for(let e of h.keys())X(e);C([...v])}}}}var I=`peercompute.ulg.sph-nuclear-cherenkov-gpu.v1`,L=1602176634e-22,R=Object.freeze({COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128}),z=Object.freeze({VERTEX:globalThis.GPUShaderStage?.VERTEX??1,FRAGMENT:globalThis.GPUShaderStage?.FRAGMENT??2,COMPUTE:globalThis.GPUShaderStage?.COMPUTE??4}),B=33,V=B*16,H=512,U=384,W=p,G=m,K=`
${d(W)}
${f(W)}

struct NuclearTickParams {
  particle_count: u32,
  source_count: u32,
  apply_thermal_heat: u32,
  exact_energy_enabled: u32,
  rigid_body_count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

struct SourceSpec {
  meta0: vec4<f32>, // [domain_id, delta_u_j_per_kg, fallback_radius_m, beta]
  meta1: vec4<f32>, // [attenuation_range_m, radiance_scale, active_flag, rigid_body_index_or_neg1]
};

@group(0) @binding(0) var<uniform> params: NuclearTickParams;
@group(0) @binding(1) var<storage, read> source_specs: array<SourceSpec>;
@group(0) @binding(2) var<storage, read_write> state_rows: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> identity_rows: array<u32>;
@group(0) @binding(4) var<storage, read_write> centroid_accum: array<atomic<i32>>;
@group(0) @binding(5) var<storage, read_write> cherenkov_sources: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> exact_energy_rows: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read> rigid_frames: array<vec4<f32>>;

const Q_MASS: f32 = 1024.0;
const Q_POS: f32 = 1024.0;

@compute @workgroup_size(16)
fn snc_clear(@builtin(global_invocation_id) gid: vec3<u32>) {
  let s = gid.x;
  if (s >= 16u) { return; }
  let base = s * 6u;
  atomicStore(&centroid_accum[base + 0u], 0);
  atomicStore(&centroid_accum[base + 1u], 0);
  atomicStore(&centroid_accum[base + 2u], 0);
  atomicStore(&centroid_accum[base + 3u], 0);
  atomicStore(&centroid_accum[base + 4u], 0);
  atomicStore(&centroid_accum[base + 5u], 0);
  if (s == 0u) {
    cherenkov_sources[0u] = vec4<f32>(f32(params.source_count), 0.0, 0.0, 0.0);
  }
}

fn snc_energy_load(word: u32) -> ExactMass {
  var value: ExactMass;
  for (var w = 0u; w < EM_WORDS; w = w + 1u) {
    value.words[w] = atomicLoad(&exact_energy_rows[word + w]);
  }
  return value;
}

fn snc_energy_store(word: u32, value: ExactMass) {
  for (var w = 0u; w < EM_WORDS; w = w + 1u) {
    atomicStore(&exact_energy_rows[word + w], value.words[w]);
  }
}

@compute @workgroup_size(64)
fn snc_deposit_and_reduce(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.particle_count) { return; }
  let pos_mass = state_rows[idx * 2u];
  let m = pos_mass.w;
  if (!(m > 0.0)) { return; }
  let domain_id = identity_rows[idx];
  if (domain_id == 0u) { return; }

  let scount = min(params.source_count, 16u);
  for (var s = 0u; s < scount; s = s + 1u) {
    let spec = source_specs[s];
    let src_domain = u32(max(0.0, round(spec.meta0.x)));
    if (domain_id != src_domain) { continue; }

    // 1. Deposit exact nuclear decay specific internal energy directly into GPU particle state
    let delta_u = spec.meta0.y;
    if (params.apply_thermal_heat != 0u && delta_u > 0.0) {
      var vel_u = state_rows[idx * 2u + 1u];
      var next_u = vel_u.w + delta_u;

      // Keep exact 2^-149 energy ledger (both U and S source limbs) bit-invariant:
      // sum(U - S) never changes because identical nuclear heat is booked to U and S.
      let required_words = 2u * params.particle_count * EM_WORDS;
      if (params.exact_energy_enabled != 0u && arrayLength(&exact_energy_rows) >= required_words) {
        let exact_du = el_from_f32_bits(bitcast<u32>(m * delta_u));
        let u_word = idx * EM_WORDS;
        let s_word = params.particle_count * EM_WORDS + u_word;
        let sum_u = el_add(snc_energy_load(u_word), exact_du.value);
        let sum_s = el_add(snc_energy_load(s_word), exact_du.value);
        let proj = el_project_f32_bits(sum_u.value);
        if ((exact_du.error | sum_u.error | sum_s.error | proj.error) == 0u) {
          snc_energy_store(u_word, sum_u.value);
          snc_energy_store(s_word, sum_s.value);
          next_u = bitcast<f32>(proj.bits) / m;
        }
      }
      vel_u.w = next_u;
      state_rows[idx * 2u + 1u] = vel_u;
    }

    // 2. Atomically accumulate live 3D mass-weighted centroid directly from GPU particle positions
    let base = s * 6u;
    let mq = i32(clamp(m * Q_MASS, -1e8, 1e8));
    let mxq = i32(clamp(m * pos_mass.x * Q_POS, -1e8, 1e8));
    let myq = i32(clamp(m * pos_mass.y * Q_POS, -1e8, 1e8));
    let mzq = i32(clamp(m * pos_mass.z * Q_POS, -1e8, 1e8));
    atomicAdd(&centroid_accum[base + 0u], mq);
    atomicAdd(&centroid_accum[base + 1u], mxq);
    atomicAdd(&centroid_accum[base + 2u], myq);
    atomicAdd(&centroid_accum[base + 3u], mzq);
    atomicAdd(&centroid_accum[base + 5u], 1);
    break;
  }
}

@compute @workgroup_size(16)
fn snc_finalize(@builtin(global_invocation_id) gid: vec3<u32>) {
  let s = gid.x;
  let scount = min(params.source_count, 16u);
  if (s >= 16u) { return; }
  let out_pos_idx = 1u + s * 2u;
  let out_phys_idx = 2u + s * 2u;
  if (s >= scount) {
    cherenkov_sources[out_pos_idx] = vec4<f32>(0.0);
    cherenkov_sources[out_phys_idx] = vec4<f32>(0.0);
    return;
  }
  let spec = source_specs[s];
  let base = s * 6u;
  var total_m = f32(atomicLoad(&centroid_accum[base + 0u])) / Q_MASS;
  var total_mom = vec3<f32>(
    f32(atomicLoad(&centroid_accum[base + 1u])) / Q_POS,
    f32(atomicLoad(&centroid_accum[base + 2u])) / Q_POS,
    f32(atomicLoad(&centroid_accum[base + 3u])) / Q_POS
  );
  let p_cnt = atomicLoad(&centroid_accum[base + 5u]);
  if (!(total_m > 1e-6 && p_cnt > 0)) {
    total_m = 0.0;
    total_mom = vec3<f32>(0.0);
  }

  // Combine with live GPU A5 rigid-body center-of-mass when this radioactive source
  // is carried by ULG's coherent rigid-solid lane (zero CPU readback!).
  let rigid_idx_f = spec.meta1.w;
  if (rigid_idx_f >= 0.0 && params.rigid_body_count > 0u) {
    let ridx = u32(round(rigid_idx_f));
    if (ridx < params.rigid_body_count && (ridx * 8u) < arrayLength(&rigid_frames)) {
      let frame0 = rigid_frames[ridx * 8u];
      if (frame0.w > 1e-6) {
        total_m = total_m + frame0.w;
        total_mom = total_mom + frame0.xyz * frame0.w;
      }
    }
  }

  if (total_m > 1e-6) {
    let inv_m = 1.0 / total_m;
    let cpos = total_mom * inv_m;
    cherenkov_sources[out_pos_idx] = vec4<f32>(cpos, max(0.02, spec.meta0.z));
    cherenkov_sources[out_phys_idx] = vec4<f32>(
      spec.meta0.w, // beta
      max(0.02, spec.meta1.x), // attenuation_range_m
      max(0.0, spec.meta1.y), // radiance_scale
      spec.meta1.z // active_flag
    );
  } else {
    // Keep prior fallback position if no live particles matched yet, or fail closed if inactive
    let prev_pos = cherenkov_sources[out_pos_idx];
    cherenkov_sources[out_pos_idx] = vec4<f32>(prev_pos.xyz, max(0.02, spec.meta0.z));
    cherenkov_sources[out_phys_idx] = vec4<f32>(
      spec.meta0.w,
      max(0.02, spec.meta1.x),
      max(0.0, spec.meta1.y),
      0.0
    );
  }
}
`,q=`
struct WorkerSurfaceMotionUniform {
  grid: vec4<u32>,
  motion: vec4<f32>,
};

struct CameraUniform {
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
};

@group(0) @binding(0) var<storage, read> compact_position_rows: array<f32>;
@group(0) @binding(1) var<uniform> camera_data: CameraUniform;
@group(0) @binding(2) var<storage, read> optical_records: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> compact_packed_normals: array<u32>;
@group(0) @binding(4) var<storage, read> isosurface_motion_rows: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> surface_motion: WorkerSurfaceMotionUniform;

@group(1) @binding(0) var refractive_back_depth: texture_depth_2d;
@group(1) @binding(1) var<storage, read> cherenkov_sources: array<vec4<f32>>;

${b}
${g}

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) world_position: vec3<f32>,
  @location(2) @interpolate(flat) material_id: f32,
  @location(3) @interpolate(flat) phase_id: f32,
  @location(4) @interpolate(flat) optical_state_id: f32,
};

fn compact_position(vertex_index: u32) -> vec3<f32> {
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
  if (length(n) <= 1.0e-12) {
    return normalize(vec3<f32>(0.0, 1.0, 0.0));
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
  let l2 = dot(normal, normal);
  if (l2 <= 1.0e-12) { return vec3<f32>(0.0); }
  return normal / sqrt(l2);
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  var normal = compact_normal(vertex_index);
  let smooth_normal = compact_packed_normal(vertex_index);
  if (dot(smooth_normal, smooth_normal) > 0.25) {
    normal = smooth_normal;
  }
  let motion = sample_isosurface_motion(
    compact_position(vertex_index) + vec3<f32>(camera_data.position_grid_bias),
    camera_data.position_scale_m, normal, surface_motion.motion.x, surface_motion.motion.y,
    surface_motion.grid.x, surface_motion.grid.y, surface_motion.grid.z
  );
  let position_m = compact_world_position(vertex_index) + motion.displacement;
  var out: VertexOut;
  var clip = camera_data.view_projection * vec4<f32>(position_m, 1.0);
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  if (clip.w <= 0.0) {
    clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  }
  out.position = clip;
  out.world_position = position_m;
  out.normal = motion.normal;
  out.material_id = camera_data.material_id;
  out.phase_id = camera_data.phase_id;
  out.optical_state_id = camera_data.optical_state_id;
  return out;
}

fn id_equal(a: f32, b: f32) -> bool {
  return abs(round(a) - round(b)) < 0.5;
}

struct DielectricOptical {
  ior: f32,
  transmission: f32,
  metalness: f32,
  attenuation_linear: vec3<f32>,
  attenuation_distance_m: f32,
  valid: f32,
};

fn lookup_dielectric_optical(material_id: f32, phase_id: f32, optical_state_id: f32) -> DielectricOptical {
  let count = arrayLength(&optical_records) / 6u;
  for (var i = 0u; i < count; i = i + 1u) {
    let row0 = optical_records[i * 6u + 0u];
    let row5 = optical_records[i * 6u + 5u];
    if (id_equal(row0.x, material_id) && id_equal(row0.y, phase_id) && id_equal(row5.w, optical_state_id)) {
      let row1 = optical_records[i * 6u + 1u];
      let row2 = optical_records[i * 6u + 2u];
      let row3 = optical_records[i * 6u + 3u];
      let blocked = row5.y > 0.5 || abs(row5.z - 255.0) < 0.5;
      return DielectricOptical(
        max(row2.w, 1.0),
        clamp(row2.y, 0.0, 1.0),
        clamp(row1.w, 0.0, 1.0),
        clamp(row3.xyz, vec3<f32>(1.0e-5), vec3<f32>(1.0)),
        max(row3.w, 1.0e-5),
        select(1.0, 0.0, blocked)
      );
    }
  }
  return DielectricOptical(1.0, 0.0, 1.0, vec3<f32>(1.0), 1.0, 0.0);
}

fn wyman_gauss(x: f32, mu: f32, s1: f32, s2: f32) -> f32 {
  let inv = select(1.0 / s2, 1.0 / s1, x < mu);
  let t = (x - mu) * inv;
  return exp(-0.5 * t * t);
}

// First-principles Frank-Tamm d^2N / (dx dlambda) ~ lambda^-2 * (1 - 1 / (beta^2 * n^2))
// integrated against Wyman 2013 CIE 1931 color matching functions -> linear sRGB!
fn frank_tamm_linear_rgb(beta: f32, ior: f32) -> vec3<f32> {
  let sin2 = 1.0 - 1.0 / max(1.0e-6, beta * beta * ior * ior);
  if (!(sin2 > 0.0)) {
    return vec3<f32>(0.0);
  }
  var cx = 0.0;
  var cy = 0.0;
  var cz = 0.0;
  var norm = 0.0;
  let peak_inv_l2 = 1.0 / (380.0 * 380.0);
  // 10 nm CIE 1931 spectral quadrature of Frank-Tamm d^2N / (dx dlambda) ~ lambda^-2
  for (var k = 0u; k < 41u; k = k + 1u) {
    let nm = 380.0 + f32(k) * 10.0;
    let spec = (1.0 / (nm * nm)) / peak_inv_l2;
    let wx = 1.056 * wyman_gauss(nm, 599.8, 37.9, 31.0)
      + 0.362 * wyman_gauss(nm, 442.0, 16.0, 26.7)
      - 0.065 * wyman_gauss(nm, 501.1, 20.4, 26.2);
    let wy = 0.821 * wyman_gauss(nm, 568.8, 46.9, 40.5)
      + 0.286 * wyman_gauss(nm, 530.9, 16.3, 31.1);
    let wz = 1.217 * wyman_gauss(nm, 437.0, 11.8, 36.0)
      + 0.681 * wyman_gauss(nm, 459.0, 26.0, 13.8);
    cx += spec * wx;
    cy += spec * wy;
    cz += spec * wz;
    norm += wy;
  }
  if (!(norm > 0.0)) { return vec3<f32>(0.0); }
  cx /= norm; cy /= norm; cz /= norm;
  // Exact XYZ -> linear sRGB matrix (IEC 61966-2-1), preserving true Frank-Tamm chromaticity
  let lin = vec3<f32>(
    max(0.0, 3.2406 * cx - 1.5372 * cy - 0.4986 * cz),
    max(0.0, -0.9689 * cx + 1.8758 * cy + 0.0415 * cz),
    max(0.0, 0.0557 * cx - 0.2040 * cy + 1.0570 * cz)
  );
  let max_c = max(max(lin.r, lin.g), max(lin.b, 1.0e-5));
  return lin / max_c;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  if (arrayLength(&cherenkov_sources) < 3u) {
    discard;
  }
  let source_count = min(u32(max(0.0, round(cherenkov_sources[0u].x))), 16u);
  if (source_count == 0u) {
    discard;
  }
  let opt = lookup_dielectric_optical(in.material_id, in.phase_id, in.optical_state_id);
  // Strictly fail closed for opaque conductors, vacuum, or non-transmissive media!
  if (!(opt.valid > 0.5) || opt.metalness >= 0.1 || opt.transmission <= 0.01 || opt.ior <= 1.000001) {
    discard;
  }

  let dimensions = textureDimensions(refractive_back_depth);
  let surface_pixel = refraction_surface_pixel(in.position.xy, dimensions);
  if (!(surface_pixel.valid > 0.5)) {
    discard;
  }
  let back_depth = textureLoad(refractive_back_depth, surface_pixel.pixel, 0);
  if (!(back_depth >= 0.0 && back_depth < 0.999999 && back_depth > in.position.z + 1.0e-5)) {
    discard;
  }
  let back_point = refraction_unproject_uv_depth(
    surface_pixel.uv,
    back_depth,
    camera_data.inverse_view_projection
  );
  if (!(back_point.valid > 0.5)) {
    discard;
  }
  let entry_world = in.world_position;
  let cam_pos = vec3<f32>(
    camera_data.camera_position_x_m,
    camera_data.camera_position_y_m,
    camera_data.camera_position_z_m
  );
  let view_dir = normalize(cam_pos - entry_world);
  let normal = normalize(in.normal);
  let max_chord = max(0.01, select(2.0 * camera_data.bounds_radius_m, 2.5, !(camera_data.bounds_radius_m > 1.0e-5)));
  let rear_valid = refraction_rear_surface_admitted(
    in.position.z,
    back_depth,
    entry_world,
    back_point.world_position,
    normal,
    view_dir,
    max_chord
  );
  let refracted_dir = refract(-view_dir, normal, 1.0 / opt.ior);
  let snell_path = refracted_path_to_back_plane(
    entry_world,
    back_point.world_position,
    rear_valid,
    refracted_dir,
    camera_data.view_projection,
    max_chord
  );
  var exit_world = back_point.world_position;
  var raw_chord = length(exit_world - entry_world);
  if (snell_path.valid > 0.5 && snell_path.path_m > 1.0e-4) {
    exit_world = snell_path.exit_world;
    raw_chord = snell_path.path_m;
  }
  if (!(raw_chord > 1.0e-4)) {
    discard;
  }
  let path_m = min(raw_chord, max_chord);
  let ray_dir = (exit_world - entry_world) / raw_chord;
  let clamped_exit = entry_world + ray_dir * path_m;
  let ndotv = clamp(dot(normal, view_dir), 0.0, 1.0);
  let f0 = pow((opt.ior - 1.0) / (opt.ior + 1.0), 2.0);
  let fresnel = clamp(f0 + (1.0 - f0) * pow(1.0 - ndotv, 5.0), 0.0, 1.0);

  let sigma_abs = -log(opt.attenuation_linear) / opt.attenuation_distance_m;
  var volume_radiance = vec3<f32>(0.0);

  for (var s = 0u; s < source_count; s = s + 1u) {
    let pos_rad = cherenkov_sources[1u + s * 2u];
    let phys = cherenkov_sources[2u + s * 2u];
    let beta = phys.x;
    let range_m = max(0.02, phys.y);
    let scale = max(0.0, phys.z);
    let active_flag = phys.w;
    if (!(active_flag > 0.5) || !(scale > 0.0)) {
      continue;
    }
    let sin2_theta = 1.0 - 1.0 / max(1.0e-6, beta * beta * opt.ior * opt.ior);
    if (!(sin2_theta > 0.0)) {
      continue;
    }
    let spec_rgb = frank_tamm_linear_rgb(beta, opt.ior);
    let src_center = pos_rad.xyz;
    let src_radius = max(0.02, pos_rad.w);
    let falloff_r = max(0.07, src_radius * 0.85 + 0.04);

    // 12-point midpoint volumetric integral along the true 3D ray chord inside the dielectric
    var integral = vec3<f32>(0.0);
    let steps = 12u;
    let ds = path_m / f32(steps);
    for (var k = 0u; k < steps; k = k + 1u) {
      let t = (f32(k) + 0.5) / f32(steps);
      let sample_pos = mix(entry_world, clamped_exit, t);
      let d_surface = max(0.0, length(sample_pos - src_center) - src_radius);
      let geom = exp(-d_surface / range_m) / (1.0 + (d_surface / falloff_r) * (d_surface / falloff_r));
      let beer_lambert = exp(-sigma_abs * (t * path_m));
      integral += spec_rgb * beer_lambert * (geom * ds);
    }
    volume_radiance += integral * (sin2_theta * scale);
  }

  let transmitted_radiance = volume_radiance * (1.0 - fresnel) * opt.transmission;
  let peak_rad = max(transmitted_radiance.r, max(transmitted_radiance.g, transmitted_radiance.b));
  if (!(peak_rad > 1.0e-4)) {
    discard;
  }
  // Luminance-preserving Reinhard rolloff keeps true Frank-Tamm CIE chromaticity without desaturating to white
  let lum = max(1.0e-5, dot(transmitted_radiance, vec3<f32>(0.2126, 0.7152, 0.0722)));
  let mapped = transmitted_radiance * (0.68 / (1.0 + lum * 0.85));
  let clamped = clamp(mapped, vec3<f32>(0.0), vec3<f32>(1.0));
  let display = pow(clamped, vec3<f32>(1.0 / 2.2));
  return vec4<f32>(display, 1.0);
}
`,J=new WeakMap;function Y(e){let t=u(e),n=J.get(t);if(!n){let e=[i(0,`uniform`),i(1,`read-only-storage`),i(2,`storage`),i(3,`read-only-storage`),i(4,`storage`),i(5,`storage`),i(6,`storage`),i(7,`read-only-storage`)],r=n=>o(t,{cacheKey:`ulg-sph-nuclear-cherenkov-${n}.v2`,label:`ulg-sph-nuclear-cherenkov-${n}`,code:K,entryPoint:n,bindings:e}),a=t.createBuffer({label:`ulg-sph-nuclear-params`,size:32,usage:R.UNIFORM|R.COPY_DST}),s=t.createBuffer({label:`ulg-sph-nuclear-source-specs`,size:H,usage:R.STORAGE|R.COPY_DST}),c=t.createBuffer({label:`ulg-sph-nuclear-centroid-accum`,size:U,usage:R.STORAGE}),l=t.createBuffer({label:`ulg-sph-nuclear-cherenkov-sources`,size:V,usage:R.STORAGE|R.COPY_DST|R.COPY_SRC}),u=t.createBuffer({label:`ulg-sph-nuclear-dummy-exact-energy`,size:Math.max(64,(2*G+4)*4),usage:R.STORAGE}),d=t.createBuffer({label:`ulg-sph-nuclear-dummy-rigid-frames`,size:128,usage:R.STORAGE});n={device:t,pipes:{clear:r(`snc_clear`),deposit:r(`snc_deposit_and_reduce`),finalize:r(`snc_finalize`)},paramsBuffer:a,sourceSpecsBuffer:s,centroidAccumBuffer:c,cherenkovSourcesBuffer:l,dummyExactEnergyBuffer:u,dummyRigidFramesBuffer:d,activeSourceCount:0,sources:[],elapsedS:0,totalDecays:0,totalDepositedThermalEnergyJ:0,thermalPowerW:0,maxNucleonRelError:0,medium:`vacuum`,refractiveIndex:1,remainingAtomsByKey:new Map,lastSnapshot:null},J.set(t,n)}return n}function X(e){return e&&J.get(u(e))||null}function Z(e){if(!e)return!1;let t=u(e),n=J.get(t);if(!n)return!1;n.activeSourceCount=0,n.sources=[],n.elapsedS=0,n.totalDecays=0,n.totalDepositedThermalEnergyJ=0,n.thermalPowerW=0,n.maxNucleonRelError=0,n.remainingAtomsByKey.clear(),n.lastSnapshot=null;let r=new Float32Array(B*4);return t.queue.writeBuffer(n.cherenkovSourcesBuffer,0,r),!0}function Q(e){let t=!1,n=0,r=null,i=[];for(let a of e.sources){let o=h({beta:a.beta,refractiveIndex:e.refractiveIndex,chargeZ:1}),s={bodyId:a.bodyId,domainId:a.domainId,material:a.material,materialId:a.materialId,isotope:a.isotope,daughterIsotope:a.daughterIsotope,mode:a.mode,centerM:[...a.centerM],radiusM:a.radiusM,attenuationRangeM:a.attenuationRangeM,secondaryElectronMeV:a.secondaryElectronMeV,beta:a.beta,thresholdBeta:o.thresholdBeta,refractiveIndex:e.refractiveIndex,active:o.active,cherenkovAngleDeg:o.cherenkovAngleDeg,photonsPerMeter:o.photonsPerMeter,srgb:[...o.srgb]};i.push(s),o.active&&(t=!0,o.photonsPerMeter>=n&&(n=o.photonsPerMeter,r=s))}return Object.freeze({schema:I,enabled:e.activeSourceCount>0,backend:`webgpu`,medium:e.medium,refractiveIndex:e.refractiveIndex,elapsedS:e.elapsedS,sourceCount:e.activeSourceCount,isotopes:Object.freeze(e.sources.map(e=>e.isotope)),totalDecays:e.totalDecays,totalDepositedThermalEnergyJ:e.totalDepositedThermalEnergyJ,thermalPowerW:e.thermalPowerW,nucleonConservationRelError:e.maxNucleonRelError,cherenkovActive:t,cherenkovBeta:r?.beta??i[0]?.beta??0,cherenkovThresholdBeta:r?.thresholdBeta??1/Math.max(1,e.refractiveIndex),cherenkovAngleDeg:r?.cherenkovAngleDeg??0,cherenkovPhotonsPerMeter:r?.photonsPerMeter??0,cherenkovSrgb:Object.freeze(r?[...r.srgb]:[0,0,0]),sources:Object.freeze(i),closureBacked:!0,validation:Object.freeze({scientificValidation:!1,nuclearBenchmarkValidated:!1,opticalValidation:!1})})}function re(e,{nuclearDescriptor:t=null,stateBuffer:n=null,identityBuffer:r=null,rigidFamily:i=null,particleCount:a=0}={}){let o=Array.isArray(t?.sources)?t.sources:[];if(!e||o.length===0)return Z(e),null;let s=Y(e),c=o.slice(0,16);s.activeSourceCount=c.length,s.sources=c.map(e=>({...e,centerM:[...e.centerM||[0,0,0]]})),s.medium=t.medium||`vacuum`,s.refractiveIndex=Number(t.refractiveIndex)||1,s.elapsedS=0,s.totalDecays=0,s.totalDepositedThermalEnergyJ=0,s.thermalPowerW=0,s.maxNucleonRelError=0,s.remainingAtomsByKey.clear();let l=new Float32Array(B*4);l[0]=c.length;for(let e=0;e<c.length;e+=1){let t=c[e],n=`${t.bodyId}:${t.domainId}:${t.isotope}`;s.remainingAtomsByKey.set(n,Number(t.initialAtomCount)||0);let r=(1+e*2)*4;l[r+0]=Number(t.centerM?.[0])||0,l[r+1]=Number(t.centerM?.[1])||0,l[r+2]=Number(t.centerM?.[2])||0,l[r+3]=Math.max(.02,Number(t.radiusM)||.12);let i=(Number(t.initialAtomCount)||0)*(Number(t.lambdaPerS)||0),a=i>0?Math.min(24,Math.max(1.5,Math.log10(Math.max(10,i))*1.15)):0;l[r+4]=Number(t.beta)||0,l[r+5]=Math.max(.02,Number(t.attenuationRangeM)||.18),l[r+6]=a,l[r+7]=+(t.beta>0&&i>0)}if(s.device.queue.writeBuffer(s.cherenkovSourcesBuffer,0,l),n&&r&&a>0){let e=s.device.createCommandEncoder({label:`ulg-sph-nuclear-seed-centroids`});ie(s.device,e,{stateBuffer:n,identityBuffer:r,rigidFamily:i,particleCount:a,dtS:0,nuclearDescriptor:t}),s.device.queue.submit([e.finish()])}return s.lastSnapshot=Q(s),s.lastSnapshot}function $(e,t,n){if(!t||t.destroyed||!(t.bodyCount>0))return-1;let r=Array.isArray(t.sourceBodyIds)?t.sourceBodyIds:[],i=Array.isArray(t.materials)?t.materials:[],a=String(e?.bodyId||``).trim();if(a){for(let e=0;e<t.bodyCount;e+=1)if(!n.has(e)&&String(r[e]||``).trim()===a)return n.add(e),e}let o=String(e?.material||``).trim().toLowerCase();if(o){for(let e=0;e<t.bodyCount;e+=1)if(!n.has(e)&&String(i[e]||``).trim().toLowerCase()===o)return n.add(e),e}return-1}function ie(e,t,{stateBuffer:n,identityBuffer:r,exactEnergyBuffer:i=null,rigidFamily:o=null,particleCount:s=0,dtS:c=0,nuclearDescriptor:l=null}={}){let u=Array.isArray(l?.sources)?l.sources:[];if(!e||!t||!n||!r||!(s>0)||u.length===0)return null;let d=Y(e),f=u.slice(0,16),p=Math.max(0,Number(c)||0);d.activeSourceCount=f.length,d.medium=l.medium||d.medium,d.refractiveIndex=Number(l.refractiveIndex)||d.refractiveIndex,d.sources.length!==f.length&&(d.sources=f.map(e=>({...e,centerM:[...e.centerM||[0,0,0]]})));let m=o&&!o.destroyed&&o.frameBuffer&&o.bodyCount>0?o:null,h=new Set,g=new Float32Array(128),_=0,v=0,y=0;for(let e=0;e<f.length;e+=1){let t=f[e],n=`${t.bodyId}:${t.domainId}:${t.isotope}`,r=d.remainingAtomsByKey.has(n)?d.remainingAtomsByKey.get(n):Number(t.initialAtomCount)||0,i=Math.max(0,Number(t.lambdaPerS)||0),a=p>0&&i>0&&r>0?r*-Math.expm1(-i*p):0,o=Math.max(0,r-a),s=r>0?Math.abs(o+a-r)/r:0;s>d.maxNucleonRelError&&(d.maxNucleonRelError=s),d.remainingAtomsByKey.set(n,o);let c=a*(Number(t.qValueMeV)||0)*L*(Number(t.localDepositionFraction)||.5),l=c/Math.max(1e-9,Number(t.massKg)||1);_+=a,v+=c,p>0&&(y+=c/p);let u=o*i,b=u>0?Math.min(24,Math.max(1.5,Math.log10(Math.max(10,u))*1.15)):0,x=$(t,m,h),S=e*8;g[S+0]=Number(t.domainId)||0,g[S+1]=l,g[S+2]=Math.max(.02,Number(t.radiusM)||.12),g[S+3]=Number(t.beta)||0,g[S+4]=Math.max(.02,Number(t.attenuationRangeM)||.18),g[S+5]=b,g[S+6]=+(t.beta>0&&u>0),g[S+7]=x}d.elapsedS+=p,d.totalDecays+=_,d.totalDepositedThermalEnergyJ+=v,p>0&&(d.thermalPowerW=y);let b=new Uint32Array([s>>>0,f.length>>>0,+(p>0),+!!i,m?m.bodyCount>>>0:0,0,0,0]);d.device.queue.writeBuffer(d.paramsBuffer,0,b),d.device.queue.writeBuffer(d.sourceSpecsBuffer,0,g);let x=i||d.dummyExactEnergyBuffer,S=m?m.frameBuffer:d.dummyRigidFramesBuffer,C=a(d.device,{label:`ulg-sph-nuclear-cherenkov-bg`,layout:d.pipes.deposit.bindGroupLayout,entries:[{binding:0,resource:{buffer:d.paramsBuffer}},{binding:1,resource:{buffer:d.sourceSpecsBuffer}},{binding:2,resource:{buffer:n}},{binding:3,resource:{buffer:r}},{binding:4,resource:{buffer:d.centroidAccumBuffer}},{binding:5,resource:{buffer:d.cherenkovSourcesBuffer}},{binding:6,resource:{buffer:x}},{binding:7,resource:{buffer:S}}]}),w=t.beginComputePass({label:`ulg-sph-nuclear-decay-and-cherenkov-pass`});return w.setPipeline(d.pipes.clear.pipeline),w.setBindGroup(0,C),w.dispatchWorkgroups(1),w.setPipeline(d.pipes.deposit.pipeline),w.setBindGroup(0,C),w.dispatchWorkgroups(Math.max(1,Math.ceil(s/64))),w.setPipeline(d.pipes.finalize.pipeline),w.setBindGroup(0,C),w.dispatchWorkgroups(1),w.end(),d.lastSnapshot=Q(d),d.lastSnapshot}function ae(e,{colorFormat:t,depthFormat:n=`depth24plus`}={}){let r=u(e),i=r.createShaderModule({label:`ulg-sph-cherenkov-dielectric-volume`,code:q}),o=r.createBindGroupLayout({label:`ulg-sph-cherenkov-vol-data-layout`,entries:[{binding:0,visibility:z.VERTEX,buffer:{type:`read-only-storage`}},{binding:1,visibility:z.VERTEX|z.FRAGMENT,buffer:{type:`uniform`,minBindingSize:E}},{binding:2,visibility:z.FRAGMENT,buffer:{type:`read-only-storage`}},{binding:3,visibility:z.VERTEX,buffer:{type:`read-only-storage`}},{binding:4,visibility:z.VERTEX,buffer:{type:`read-only-storage`}},{binding:5,visibility:z.VERTEX,buffer:{type:`uniform`,minBindingSize:32}}]}),s=r.createBindGroupLayout({label:`ulg-sph-cherenkov-vol-sources-layout`,entries:[{binding:0,visibility:z.FRAGMENT,texture:{sampleType:`depth`}},{binding:1,visibility:z.FRAGMENT,buffer:{type:`read-only-storage`}}]}),c=r.createRenderPipeline({label:`ulg-sph-cherenkov-dielectric-volume-pipeline`,layout:r.createPipelineLayout({bindGroupLayouts:[o,s]}),vertex:{module:i,entryPoint:`vs_main`},fragment:{module:i,entryPoint:`fs_main`,targets:[{format:t,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src`,operation:`add`},alpha:{srcFactor:`zero`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`back`},depthStencil:{format:n,depthWriteEnabled:!1,depthCompare:`less-equal`}}),l=r.createBuffer({label:`ulg-sph-cherenkov-empty-motion`,size:16,usage:R.STORAGE}),d=r.createBuffer({label:`ulg-sph-cherenkov-zero-motion-uniform`,size:32,usage:R.UNIFORM|R.COPY_DST}),f=!1;function p(e,{compactPositionRowsBuffer:t,compactNormalRowsBuffer:n,drawIndirectRowsBuffer:i,cameraUniformBuffer:u,opticalRecordsBuffer:p,motionFieldBuffer:m=null,motionUniformBuffer:h=null,backDepthView:g,cherenkovSourcesBuffer:_}){if(f||!t||!n||!i||!u||!p||!g||!_)return!1;let v=a(r,{label:`ulg-sph-cherenkov-vol-bg0`,layout:o,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:u}},{binding:2,resource:{buffer:p}},{binding:3,resource:{buffer:n}},{binding:4,resource:{buffer:m||l}},{binding:5,resource:{buffer:h||d}}]}),y=r.createBindGroup({label:`ulg-sph-cherenkov-vol-bg1`,layout:s,entries:[{binding:0,resource:g},{binding:1,resource:{buffer:_}}]});return e.setPipeline(c),e.setBindGroup(0,v),e.setBindGroup(1,y),e.drawIndirect(i,0),!0}return{draw:p,dispose(){f||(f=!0,l.destroy(),d.destroy())}}}export{re as a,M as c,X as i,P as l,ae as n,E as o,ie as r,F as s,Z as t,b as u};