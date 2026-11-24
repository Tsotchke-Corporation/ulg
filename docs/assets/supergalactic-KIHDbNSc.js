import{attachWebGpuUncapturedErrorTelemetry as e}from"../runtime/webgpuDeviceLimits.js";import{r as t,t as n}from"./supergalacticTreePmGpu-BvigTqJu.js";var r=document.getElementById(`viewport`),i=document.getElementById(`pk-canvas`),a=document.getElementById(`hud-az`),o=document.getElementById(`hud-sigma`),s=document.getElementById(`hud-dmax`),c=document.getElementById(`hud-n`),l=document.getElementById(`hud-status`),u=document.getElementById(`toggle-run`),d=document.getElementById(`reset-sim`),f=document.getElementById(`toggle-spin`),p=new URLSearchParams(window.location.search).get(`cameraAutoSpin`)===`1`,m=`
struct RenderUniforms {
  angle_y: f32,
  angle_x: f32,
  inv_half_box: f32,
  aspect: f32,
};

struct CosmoParticle {
  pos_m: vec4<f32>,
  vel_rho: vec4<f32>,
  acc_phi: vec4<f32>,
  tag: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: RenderUniforms;
@group(0) @binding(1) var<storage, read> particles: array<CosmoParticle>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) quad_uv: vec2<f32>,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  let corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let pt = particles[iid];
  let p = pt.pos_m.xyz * u.inv_half_box;
  let cy = cos(u.angle_y); let sy = sin(u.angle_y);
  let cx = cos(u.angle_x); let sx = sin(u.angle_x);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cx - z1 * sx;
  let z2 = p.y * sx + z1 * cx + 2.6;
  let inv_z = 1.65 / max(0.35, z2);
  let center = vec2<f32>((x1 * inv_z) / max(0.5, u.aspect), y2 * inv_z);

  let rho = clamp(pt.vel_rho.w, 0.08, 1.0);
  let is_baryon = pt.tag.x > 0.5;
  let pt_size = (0.0055 + 0.011 * rho) * inv_z;
  let ndc = center + vec2<f32>((uv.x * pt_size) / max(0.5, u.aspect), uv.y * pt_size);

  let col_dm = mix(vec3<f32>(0.22, 0.35, 0.85), vec3<f32>(0.38, 0.86, 1.0), rho);
  let col_hi = mix(col_dm, vec3<f32>(1.0, 0.88, 0.50), smoothstep(0.50, 1.0, rho));
  let col = select(col_hi, mix(vec3<f32>(0.90, 0.38, 0.22), vec3<f32>(1.0, 0.82, 0.48), rho), is_baryon);

  var out: VsOut;
  out.pos = vec4<f32>(ndc, clamp(z2 * 0.08, 0.0, 0.999), 1.0);
  out.color = vec4<f32>(col, 0.22 + 0.55 * rho);
  out.quad_uv = uv;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.quad_uv, in.quad_uv);
  if (r2 > 1.0) { discard; }
  let glow = exp(-3.4 * r2);
  return vec4<f32>(in.color.rgb * glow, in.color.a * glow);
}
`,h=null,g=null,_=!0,v=!1,y=.42,b=.28,x=!1,S=0,C=0,w=null;function T(e){if(!i||!e||!e.kBins?.length)return;let t=i.getContext(`2d`);if(!t)return;let n=i.width,r=i.height;t.fillStyle=`#050b16`,t.fillRect(0,0,n,r),!w&&e.pkValues.some(e=>e>0)&&(w={kBins:[...e.kBins],pkValues:[...e.pkValues]});let a=e.kBins.map(e=>Math.log10(Math.max(1e-4,e))),o=e.pkValues.map(e=>Math.log10(Math.max(1e-6,e))),s=Math.min(...a),c=Math.max(s+.2,...a),l=[...o,...w?w.pkValues.map(e=>Math.log10(Math.max(1e-6,e))):[]],u=Math.min(...l)-.3,d=Math.max(u+1,...l)+.3,f=e=>12+(e-s)/(c-s)*(n-22),p=e=>r-14-(e-u)/(d-u)*(r-28);t.strokeStyle=`rgba(148,163,184,0.18)`,t.lineWidth=1,t.strokeRect(10,12,n-20,r-24),w&&(t.beginPath(),t.strokeStyle=`rgba(148,163,184,0.55)`,t.setLineDash([3,3]),w.kBins.forEach((e,n)=>{let r=f(Math.log10(Math.max(1e-4,e))),i=p(Math.log10(Math.max(1e-6,w.pkValues[n])));n===0?t.moveTo(r,i):t.lineTo(r,i)}),t.stroke(),t.setLineDash([])),t.beginPath(),t.strokeStyle=`#38bdf8`,t.lineWidth=2,a.forEach((e,n)=>{let r=f(e),i=p(o[n]);n===0?t.moveTo(r,i):t.lineTo(r,i)}),t.stroke(),t.fillStyle=`#94a3b8`,t.font=`10px monospace`,t.fillText(`GPU P(k) · D(a)/D0=${(e.linearGrowthRatio||1).toFixed(2)}x`,12,10)}r.addEventListener(`pointerdown`,e=>{x=!0,S=e.clientX,C=e.clientY,r.setPointerCapture?.(e.pointerId)}),r.addEventListener(`pointermove`,e=>{if(!x)return;let t=e.clientX-S,n=e.clientY-C;S=e.clientX,C=e.clientY,y+=t*.008,b=Math.max(-1.45,Math.min(1.45,b+n*.008))});var E=()=>{x=!1};r.addEventListener(`pointerup`,E),r.addEventListener(`pointercancel`,E);async function D(){let i=null;for(let e=0;e<8&&!i;e+=1)i=await navigator.gpu?.requestAdapter({powerPreference:`high-performance`}),i||await new Promise(e=>setTimeout(e,250));if(!i){l.textContent=`WebGPU unavailable (fail-closed)`;return}h=await i.requestDevice(),e(h,{label:`supergalactic-demo`});let S=r.getContext(`webgpu`),C=navigator.gpu.getPreferredCanvasFormat(),E=()=>{r.width=Math.max(320,Math.floor(window.innerWidth*window.devicePixelRatio)),r.height=Math.max(240,Math.floor(window.innerHeight*window.devicePixelRatio)),S.configure({device:h,format:C,alphaMode:`opaque`,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC})};E(),window.addEventListener(`resize`,E);let D=h.createShaderModule({code:m}),O=h.createRenderPipeline({layout:`auto`,vertex:{module:D,entryPoint:`vs_main`},fragment:{module:D,entryPoint:`fs_main`,targets:[{format:C,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`}}),k=h.createBuffer({size:16,usage:72}),A=null,j=async()=>{g&&g.destroy(),w=null;let e=await n(h,{gridPerSide:24,fftGridN:32,boxLengthMpc:200,aInit:.05,amplitude:.42});g=t(h,{gridPerSide:24,pmGridN:32,boxLengthMpc:200,aInit:.05,da:.012,initialConditions:e}),A=h.createBindGroup({layout:O.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:k}},{binding:1,resource:{buffer:g.particlesBuffer}}]}),c.textContent=`${g.particleCount.toLocaleString()} / 32³ FFT`,l.textContent=`running (1-submit GPU TreePM)`};await j(),u.addEventListener(`click`,()=>{_=!_,u.textContent=_?`Pause`:`Resume`}),d.addEventListener(`click`,()=>{j()}),f&&(f.textContent=p?`Auto-Orbit: On`:`Auto-Orbit: Off`,f.addEventListener(`click`,()=>{p=!p,f.textContent=p?`Auto-Orbit: On`:`Auto-Orbit: Off`}));function M(){!_||v||!g||(v=!0,g.step({readTelemetry:!0}).then(e=>{e&&(a.textContent=`a=${e.scaleFactorA.toFixed(3)} · z=${e.redshiftZ.toFixed(2)}`,o.textContent=e.sigmaDensity.toFixed(3),s.textContent=e.maxOverdensity.toFixed(2),T(e.powerSpectrumPk),window.__ulgSupergalacticState={...e,cameraAutoSpin:p,cameraAngles:[y,b],gpuErrorCount:(globalThis.__ulgWebGpuUncapturedErrors||[]).filter(e=>e.label===`supergalactic-demo`).length}),g&&g.getState().aScale>=1.25&&j()}).catch(e=>{console.error(`TreePM step error:`,e)}).finally(()=>{v=!1}))}function N(){if(g&&A){p&&!x&&(y+=.004);let e=r.width/Math.max(1,r.height);h.queue.writeBuffer(k,0,Float32Array.from([y,b,2/g.boxLengthMpc,e]));let t=h.createCommandEncoder({label:`ulg-supergalactic-render`}),n=t.beginRenderPass({colorAttachments:[{view:S.getCurrentTexture().createView(),clearValue:{r:.015,g:.025,b:.055,a:1},loadOp:`clear`,storeOp:`store`}]});n.setPipeline(O),n.setBindGroup(0,A),n.draw(6,g.particleCount),n.end(),h.queue.submit([t.finish()])}M(),requestAnimationFrame(N)}window.__ulgCaptureSupergalacticPng=async()=>{if(!g||!A)return null;let e=Math.min(1280,Math.max(320,r.width)),t=Math.min(800,Math.max(240,r.height)),n=Math.ceil(e*4/256)*256,i=h.createTexture({size:[e,t,1],format:C,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),a=h.createBuffer({size:n*t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});h.queue.writeBuffer(k,0,Float32Array.from([y,b,2/g.boxLengthMpc,e/t]));let o=h.createCommandEncoder({label:`ulg-supergalactic-capture`}),s=o.beginRenderPass({colorAttachments:[{view:i.createView(),clearValue:{r:.015,g:.025,b:.055,a:1},loadOp:`clear`,storeOp:`store`}]});s.setPipeline(O),s.setBindGroup(0,A),s.draw(6,g.particleCount),s.end(),o.copyTextureToBuffer({texture:i},{buffer:a,bytesPerRow:n},[e,t,1]),h.queue.submit([o.finish()]),await a.mapAsync(GPUMapMode.READ);let c=new Uint8Array(a.getMappedRange().slice(0));a.unmap(),a.destroy(),i.destroy();let l=new Uint8ClampedArray(e*t*4),u=C.includes(`bgra`);for(let r=0;r<t;r+=1)for(let t=0;t<e;t+=1){let i=r*n+t*4,a=(r*e+t)*4;l[a]=u?c[i+2]:c[i],l[a+1]=c[i+1],l[a+2]=u?c[i]:c[i+2],l[a+3]=255}let d=document.createElement(`canvas`);return d.width=e,d.height=t,d.getContext(`2d`).putImageData(new ImageData(l,e,t),0,0),d.toDataURL(`image/png`)},requestAnimationFrame(N)}D();