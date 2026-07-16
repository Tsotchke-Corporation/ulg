var e=`@group(0) @binding(0)
var<storage, read_write> vals: array<u32>;

@group(0) @binding(1)
var<storage, read_write> block_sums: array<u32>;

// Pipeline can override SCAN_BLOCK_SIZE
@id(0) override SCAN_BLOCK_SIZE: u32 = 512;

@compute @workgroup_size(SCAN_BLOCK_SIZE / 2)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
        @builtin(workgroup_id) group_id: vec3<u32>)
{
    let prev_sum = block_sums[group_id.x];
    vals[2 * global_id.x] += prev_sum;
    vals[2 * global_id.x + 1] += prev_sum;
}

`,t=`// See https://www.eecs.umich.edu/courses/eecs570/hw/parprefix.pdf

@group(0) @binding(0)
var<storage, read_write> vals: array<u32>;

@group(0) @binding(1)
var<storage, read_write> block_sums: array<u32>;

// Pipeline can override SCAN_BLOCK_SIZE
@id(0) override SCAN_BLOCK_SIZE: u32 = 512;

var<workgroup> chunk: array<u32, SCAN_BLOCK_SIZE>;

@compute @workgroup_size(SCAN_BLOCK_SIZE / 2)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
        @builtin(local_invocation_id) local_id: vec3<u32>,
        @builtin(workgroup_id) group_id: vec3<u32>)
{
    chunk[2 * local_id.x] = vals[2 * global_id.x];
    chunk[2 * local_id.x + 1] = vals[2 * global_id.x + 1];

    var offs = 1u;
    // Reduce step up tree
    for (var d = SCAN_BLOCK_SIZE >> 1; d > 0; d = d >> 1) {
        workgroupBarrier();
        if (local_id.x < d) {
            let a = offs * (2 * local_id.x + 1) - 1;
            let b = offs * (2 * local_id.x + 2) - 1;
            chunk[b] += chunk[a];
        }
        offs = offs << 1;
    }

    if (local_id.x == 0) {
        block_sums[group_id.x] = chunk[SCAN_BLOCK_SIZE - 1];
        chunk[SCAN_BLOCK_SIZE - 1] = 0;
    }

    // Sweep down the tree to finish the scan
    for (var d = 1u; d < SCAN_BLOCK_SIZE; d = d << 1) {
        offs = offs >> 1;
        workgroupBarrier();
        if (local_id.x < d) {
            let a = offs * (2 * local_id.x + 1) - 1;
            let b = offs * (2 * local_id.x + 2) - 1;
            let tmp = chunk[a];
            chunk[a] = chunk[b];
            chunk[b] += tmp;
        }
    }

    workgroupBarrier();
    vals[2 * global_id.x] = chunk[2 * local_id.x];
    vals[2 * global_id.x + 1] = chunk[2 * local_id.x + 1];
}

`,n=`// See https://www.eecs.umich.edu/courses/eecs570/hw/parprefix.pdf
// Compute the prefix sum over the results from each block, this no longer
// writes out the block sums since we're scanning on the block sums
// This shader also applies the carry_in value and writes the carry_ouy

@group(0) @binding(0)
var<storage, read_write> vals: array<u32>;

struct CarryInOut {
    in: u32,
    out: u32,
}

@group(0) @binding(1)
var<storage, read_write> carry: CarryInOut;

// Pipeline can override SCAN_BLOCK_SIZE
@id(0) override SCAN_BLOCK_SIZE: u32 = 512;

var<workgroup> chunk: array<u32, SCAN_BLOCK_SIZE>;

@compute @workgroup_size(SCAN_BLOCK_SIZE / 2)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
        @builtin(local_invocation_id) local_id: vec3<u32>,
        @builtin(workgroup_id) group_id: vec3<u32>)
{
    chunk[2 * local_id.x] = vals[2 * global_id.x];
    chunk[2 * local_id.x + 1] = vals[2 * global_id.x + 1];

    var offs = 1u;
    // Reduce step up tree
    for (var d = SCAN_BLOCK_SIZE >> 1; d > 0; d = d >> 1) {
        workgroupBarrier();
        if (local_id.x < d) {
            let a = offs * (2 * local_id.x + 1) - 1;
            let b = offs * (2 * local_id.x + 2) - 1;
            chunk[b] += chunk[a];
        }
        offs = offs << 1;
    }

    if (local_id.x == 0) {
        carry.out = chunk[SCAN_BLOCK_SIZE - 1] + carry.in;
        chunk[SCAN_BLOCK_SIZE - 1] = 0;
    }

    // Sweep down the tree to finish the scan
    for (var d = 1u; d < SCAN_BLOCK_SIZE; d = d << 1) {
        offs = offs >> 1;
        workgroupBarrier();
        if (local_id.x < d) {
            let a = offs * (2 * local_id.x + 1) - 1;
            let b = offs * (2 * local_id.x + 2) - 1;
            let tmp = chunk[a];
            chunk[a] = chunk[b];
            chunk[b] += tmp;
        }
    }

    workgroupBarrier();
    vals[2 * global_id.x] = chunk[2 * local_id.x] + carry.in;
    vals[2 * global_id.x + 1] = chunk[2 * local_id.x + 1] + carry.in;
}

`;function r(e,t){return Math.floor((e+t-1)/t)*t}var i=class extends Error{constructor(e,{debugLabel:t=null,messages:n=[]}={}){super(e),this.name=`ShaderCompilationError`,this.debugLabel=t,this.messages=n,this.status=`shader-compilation-error`}};function a(e,t){try{Object.assign(e,t)}catch{}}async function o(e,t,n,{log:r=!1,strictCompilationInfo:o=!1}={}){let s=e.createShaderModule({code:t});if(typeof s.getCompilationInfo!=`function`)return a(s,{compilationInfoStatus:`unavailable`,compilationInfoReason:`getCompilationInfo is not available`}),s;let c;try{c=await s.getCompilationInfo()}catch(e){let t=e instanceof Error?e.message:String(e);if(a(s,{compilationInfoStatus:`unavailable`,compilationInfoReason:t}),r){let e=n?` for ${n}`:``;console.warn(`Shader compilation info unavailable${e}: ${t}`)}if(o)throw e;return s}if(c.messages.length>0){let e=!1,a=t.split(`
`),o=[];for(let t=0;t<c.messages.length;++t){let n=c.messages[t];o.push({type:n.type,lineNum:n.lineNum,linePos:n.linePos,message:n.message,sourceLine:a[n.lineNum-1]||``}),e||=n.type==`error`}if(e){if(r){let e=n?` for ${n}`:``;console.error(`Shader compilation failed${e}`,o)}throw new i(`Shader failed to compile`,{debugLabel:n,messages:o})}if(r){let e=n?` for ${n}`:``;console.info(`Shader compilation log${e}`,o)}}return s}var s=512,c=class i{#e;#t=s*s;#n;#r;#i;constructor(e){this.#e=e}static async create(r){let a=new i(r),c=r.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`,hasDynamicOffset:!0}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]}),l=r.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]});return a.#n=r.createComputePipeline({layout:r.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:await o(r,t,`ExclusiveScan::prefixSum`),entryPoint:`main`,constants:{0:s}}}),a.#r=r.createComputePipeline({layout:r.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:await o(r,n,`ExclusiveScan::prefixSumBlocks`),entryPoint:`main`,constants:{0:s}}}),a.#i=r.createComputePipeline({layout:r.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:await o(r,e,`ExclusiveScan::addBlockSums`),entryPoint:`main`,constants:{0:s}}}),a}getAlignedSize(e){return r(e,s)}async scan(e,t){let n=e.size/4;if(n!=this.getAlignedSize(n))throw Error(`Error: GPU input buffer size (${n}) must be aligned to ExclusiveScan::getAlignedSize, expected ${this.getAlignedSize(n)}`);let r=this.#e.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),i=this.#e.createBuffer({size:s*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),a=this.#e.createBuffer({size:8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),o=this.#e.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),c=this.#e.createBindGroup({layout:this.#r.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:a}}]}),l=Math.ceil(t/this.#t),u=null,d=null;l>1?(u=this.#e.createBindGroup({layout:this.#n.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e,size:this.#t*4}},{binding:1,resource:{buffer:i}}]}),d=n%this.#t==0?u:this.#e.createBindGroup({layout:this.#n.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e,size:n%this.#t*4}},{binding:1,resource:{buffer:i}}]})):(u=this.#e.createBindGroup({layout:this.#n.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e,size:Math.min(this.#t,n)*4}},{binding:1,resource:{buffer:i}}]}),d=u);let f=this.#e.createCommandEncoder();f.clearBuffer(i),f.clearBuffer(a),t<n&&f.clearBuffer(e,t*4,4);for(let e=0;e<l;++e){let t=u;e+1==l&&(t=d);let r=Math.min((n-e*this.#t)/s,s);f.clearBuffer(i);let p=f.beginComputePass();p.setPipeline(this.#n),p.setBindGroup(0,t,[e*this.#t*4]),p.dispatchWorkgroups(r,1,1),p.setPipeline(this.#r),p.setBindGroup(0,c),p.dispatchWorkgroups(1,1,1),p.setPipeline(this.#i),p.setBindGroup(0,t,[e*this.#t*4]),p.dispatchWorkgroups(r,1,1),p.end(),f.copyBufferToBuffer(a,4,o,0,4),f.copyBufferToBuffer(o,0,a,0,4)}t<n?f.copyBufferToBuffer(e,t*4,r,0,4):f.copyBufferToBuffer(a,4,r,0,4),this.#e.queue.submit([f.finish()]),await r.mapAsync(GPUMapMode.READ);let p=new Uint32Array(r.getMappedRange())[0];return r.unmap(),p}},l=new Int32Array([-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,3,-1,0,0,0,0,0,0,0,0,0,0,0,0,1,9,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,8,1,9,8,3,1,-1,0,0,0,0,0,0,0,0,0,2,10,1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,8,3,1,2,10,-1,0,0,0,0,0,0,0,0,0,9,2,10,9,0,2,-1,0,0,0,0,0,0,0,0,0,3,2,10,3,10,8,8,10,9,-1,0,0,0,0,0,0,2,3,11,-1,0,0,0,0,0,0,0,0,0,0,0,0,11,0,8,11,2,0,-1,0,0,0,0,0,0,0,0,0,1,9,0,2,3,11,-1,0,0,0,0,0,0,0,0,0,2,1,9,2,9,11,11,9,8,-1,0,0,0,0,0,0,3,10,1,3,11,10,-1,0,0,0,0,0,0,0,0,0,1,0,8,1,8,10,10,8,11,-1,0,0,0,0,0,0,0,3,11,0,11,9,9,11,10,-1,0,0,0,0,0,0,11,10,9,11,9,8,-1,0,0,0,0,0,0,0,0,0,4,7,8,-1,0,0,0,0,0,0,0,0,0,0,0,0,4,3,0,4,7,3,-1,0,0,0,0,0,0,0,0,0,4,7,8,9,0,1,-1,0,0,0,0,0,0,0,0,0,9,4,7,9,7,1,1,7,3,-1,0,0,0,0,0,0,4,7,8,1,2,10,-1,0,0,0,0,0,0,0,0,0,4,3,0,4,7,3,2,10,1,-1,0,0,0,0,0,0,2,9,0,2,10,9,4,7,8,-1,0,0,0,0,0,0,3,2,7,7,9,4,7,2,9,9,2,10,-1,0,0,0,8,4,7,3,11,2,-1,0,0,0,0,0,0,0,0,0,7,11,2,7,2,4,4,2,0,-1,0,0,0,0,0,0,2,3,11,1,9,0,8,4,7,-1,0,0,0,0,0,0,2,1,9,2,9,4,2,4,11,11,4,7,-1,0,0,0,10,3,11,10,1,3,8,4,7,-1,0,0,0,0,0,0,4,7,0,0,10,1,7,10,0,7,11,10,-1,0,0,0,8,4,7,0,3,11,0,11,9,9,11,10,-1,0,0,0,7,9,4,7,11,9,9,11,10,-1,0,0,0,0,0,0,4,9,5,-1,0,0,0,0,0,0,0,0,0,0,0,0,8,3,0,4,9,5,-1,0,0,0,0,0,0,0,0,0,0,5,4,0,1,5,-1,0,0,0,0,0,0,0,0,0,4,8,3,4,3,5,5,3,1,-1,0,0,0,0,0,0,1,2,10,9,5,4,-1,0,0,0,0,0,0,0,0,0,4,9,5,8,3,0,1,2,10,-1,0,0,0,0,0,0,10,5,4,10,4,2,2,4,0,-1,0,0,0,0,0,0,4,8,3,4,3,2,4,2,5,5,2,10,-1,0,0,0,2,3,11,5,4,9,-1,0,0,0,0,0,0,0,0,0,11,0,8,11,2,0,9,5,4,-1,0,0,0,0,0,0,5,0,1,5,4,0,3,11,2,-1,0,0,0,0,0,0,11,2,8,8,5,4,2,5,8,2,1,5,-1,0,0,0,3,10,1,3,11,10,5,4,9,-1,0,0,0,0,0,0,9,5,4,1,0,8,1,8,10,10,8,11,-1,0,0,0,10,5,11,11,0,3,11,5,0,0,5,4,-1,0,0,0,4,10,5,4,8,10,10,8,11,-1,0,0,0,0,0,0,7,9,5,7,8,9,-1,0,0,0,0,0,0,0,0,0,0,9,5,0,5,3,3,5,7,-1,0,0,0,0,0,0,8,0,1,8,1,7,7,1,5,-1,0,0,0,0,0,0,3,1,5,3,5,7,-1,0,0,0,0,0,0,0,0,0,7,9,5,7,8,9,1,2,10,-1,0,0,0,0,0,0,1,2,10,0,9,5,0,5,3,3,5,7,-1,0,0,0,7,8,5,5,2,10,8,2,5,8,0,2,-1,0,0,0,10,3,2,10,5,3,3,5,7,-1,0,0,0,0,0,0,9,7,8,9,5,7,11,2,3,-1,0,0,0,0,0,0,0,9,2,2,7,11,2,9,7,7,9,5,-1,0,0,0,3,11,2,8,0,1,8,1,7,7,1,5,-1,0,0,0,2,7,11,2,1,7,7,1,5,-1,0,0,0,0,0,0,11,1,3,11,10,1,7,8,9,7,9,5,-1,0,0,0,11,10,1,11,1,7,7,1,0,7,0,9,7,9,5,-1,5,7,8,5,8,10,10,8,0,10,0,3,10,3,11,-1,11,10,5,11,5,7,-1,0,0,0,0,0,0,0,0,0,10,6,5,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,8,3,10,6,5,-1,0,0,0,0,0,0,0,0,0,9,0,1,5,10,6,-1,0,0,0,0,0,0,0,0,0,8,1,9,8,3,1,10,6,5,-1,0,0,0,0,0,0,6,1,2,6,5,1,-1,0,0,0,0,0,0,0,0,0,6,1,2,6,5,1,0,8,3,-1,0,0,0,0,0,0,5,9,0,5,0,6,6,0,2,-1,0,0,0,0,0,0,6,5,2,2,8,3,5,8,2,5,9,8,-1,0,0,0,2,3,11,10,6,5,-1,0,0,0,0,0,0,0,0,0,0,11,2,0,8,11,6,5,10,-1,0,0,0,0,0,0,0,1,9,3,11,2,10,6,5,-1,0,0,0,0,0,0,10,6,5,2,1,9,2,9,11,11,9,8,-1,0,0,0,11,6,5,11,5,3,3,5,1,-1,0,0,0,0,0,0,11,6,8,8,1,0,8,6,1,1,6,5,-1,0,0,0,0,3,11,0,11,6,0,6,9,9,6,5,-1,0,0,0,5,11,6,5,9,11,11,9,8,-1,0,0,0,0,0,0,7,8,4,6,5,10,-1,0,0,0,0,0,0,0,0,0,3,4,7,3,0,4,5,10,6,-1,0,0,0,0,0,0,6,5,10,7,8,4,9,0,1,-1,0,0,0,0,0,0,5,10,6,9,4,7,9,7,1,1,7,3,-1,0,0,0,1,6,5,1,2,6,7,8,4,-1,0,0,0,0,0,0,7,0,4,7,3,0,6,5,1,6,1,2,-1,0,0,0,4,7,8,5,9,0,5,0,6,6,0,2,-1,0,0,0,2,6,5,2,5,3,3,5,9,3,9,4,3,4,7,-1,4,7,8,5,10,6,11,2,3,-1,0,0,0,0,0,0,6,5,10,7,11,2,7,2,4,4,2,0,-1,0,0,0,4,7,8,9,0,1,6,5,10,3,11,2,-1,0,0,0,6,5,10,11,4,7,11,2,4,4,2,9,9,2,1,-1,7,8,4,11,6,5,11,5,3,3,5,1,-1,0,0,0,0,4,7,0,7,1,1,7,11,1,11,6,1,6,5,-1,4,7,8,9,6,5,9,0,6,6,0,11,11,0,3,-1,7,11,4,11,9,4,11,5,9,11,6,5,-1,0,0,0,10,4,9,10,6,4,-1,0,0,0,0,0,0,0,0,0,10,4,9,10,6,4,8,3,0,-1,0,0,0,0,0,0,1,10,6,1,6,0,0,6,4,-1,0,0,0,0,0,0,4,8,6,6,1,10,6,8,1,1,8,3,-1,0,0,0,9,1,2,9,2,4,4,2,6,-1,0,0,0,0,0,0,0,8,3,9,1,2,9,2,4,4,2,6,-1,0,0,0,0,2,6,0,6,4,-1,0,0,0,0,0,0,0,0,0,3,4,8,3,2,4,4,2,6,-1,0,0,0,0,0,0,4,10,6,4,9,10,2,3,11,-1,0,0,0,0,0,0,8,2,0,8,11,2,4,9,10,4,10,6,-1,0,0,0,2,3,11,1,10,6,1,6,0,0,6,4,-1,0,0,0,8,11,2,8,2,4,4,2,1,4,1,10,4,10,6,-1,3,11,1,1,4,9,11,4,1,11,6,4,-1,0,0,0,6,4,9,6,9,11,11,9,1,11,1,0,11,0,8,-1,11,0,3,11,6,0,0,6,4,-1,0,0,0,0,0,0,8,11,6,8,6,4,-1,0,0,0,0,0,0,0,0,0,6,7,8,6,8,10,10,8,9,-1,0,0,0,0,0,0,3,0,7,7,10,6,0,10,7,0,9,10,-1,0,0,0,1,10,6,1,6,7,1,7,0,0,7,8,-1,0,0,0,6,1,10,6,7,1,1,7,3,-1,0,0,0,0,0,0,9,1,8,8,6,7,8,1,6,6,1,2,-1,0,0,0,7,3,0,7,0,6,6,0,9,6,9,1,6,1,2,-1,8,6,7,8,0,6,6,0,2,-1,0,0,0,0,0,0,2,6,7,2,7,3,-1,0,0,0,0,0,0,0,0,0,11,2,3,6,7,8,6,8,10,10,8,9,-1,0,0,0,9,10,6,9,6,0,0,6,7,0,7,11,0,11,2,-1,3,11,2,0,7,8,0,1,7,7,1,6,6,1,10,-1,6,7,10,7,1,10,7,2,1,7,11,2,-1,0,0,0,1,3,11,1,11,9,9,11,6,9,6,7,9,7,8,-1,6,7,11,9,1,0,-1,0,0,0,0,0,0,0,0,0,8,0,7,0,6,7,0,11,6,0,3,11,-1,0,0,0,6,7,11,-1,0,0,0,0,0,0,0,0,0,0,0,0,6,11,7,-1,0,0,0,0,0,0,0,0,0,0,0,0,3,0,8,11,7,6,-1,0,0,0,0,0,0,0,0,0,6,11,7,9,0,1,-1,0,0,0,0,0,0,0,0,0,1,8,3,1,9,8,7,6,11,-1,0,0,0,0,0,0,11,7,6,2,10,1,-1,0,0,0,0,0,0,0,0,0,1,2,10,0,8,3,11,7,6,-1,0,0,0,0,0,0,9,2,10,9,0,2,11,7,6,-1,0,0,0,0,0,0,11,7,6,3,2,10,3,10,8,8,10,9,-1,0,0,0,2,7,6,2,3,7,-1,0,0,0,0,0,0,0,0,0,8,7,6,8,6,0,0,6,2,-1,0,0,0,0,0,0,7,2,3,7,6,2,1,9,0,-1,0,0,0,0,0,0,8,7,9,9,2,1,9,7,2,2,7,6,-1,0,0,0,6,10,1,6,1,7,7,1,3,-1,0,0,0,0,0,0,6,10,1,6,1,0,6,0,7,7,0,8,-1,0,0,0,7,6,3,3,9,0,6,9,3,6,10,9,-1,0,0,0,6,8,7,6,10,8,8,10,9,-1,0,0,0,0,0,0,8,6,11,8,4,6,-1,0,0,0,0,0,0,0,0,0,11,3,0,11,0,6,6,0,4,-1,0,0,0,0,0,0,6,8,4,6,11,8,0,1,9,-1,0,0,0,0,0,0,1,9,3,3,6,11,9,6,3,9,4,6,-1,0,0,0,8,6,11,8,4,6,10,1,2,-1,0,0,0,0,0,0,2,10,1,11,3,0,11,0,6,6,0,4,-1,0,0,0,11,4,6,11,8,4,2,10,9,2,9,0,-1,0,0,0,4,6,11,4,11,9,9,11,3,9,3,2,9,2,10,-1,3,8,4,3,4,2,2,4,6,-1,0,0,0,0,0,0,2,0,4,2,4,6,-1,0,0,0,0,0,0,0,0,0,0,1,9,3,8,4,3,4,2,2,4,6,-1,0,0,0,9,2,1,9,4,2,2,4,6,-1,0,0,0,0,0,0,6,10,4,4,3,8,4,10,3,3,10,1,-1,0,0,0,1,6,10,1,0,6,6,0,4,-1,0,0,0,0,0,0,10,9,0,10,0,6,6,0,3,6,3,8,6,8,4,-1,10,9,4,10,4,6,-1,0,0,0,0,0,0,0,0,0,6,11,7,5,4,9,-1,0,0,0,0,0,0,0,0,0,0,8,3,9,5,4,7,6,11,-1,0,0,0,0,0,0,0,5,4,0,1,5,6,11,7,-1,0,0,0,0,0,0,7,6,11,4,8,3,4,3,5,5,3,1,-1,0,0,0,2,10,1,11,7,6,5,4,9,-1,0,0,0,0,0,0,0,8,3,1,2,10,4,9,5,11,7,6,-1,0,0,0,6,11,7,10,5,4,10,4,2,2,4,0,-1,0,0,0,6,11,7,5,2,10,5,4,2,2,4,3,3,4,8,-1,2,7,6,2,3,7,4,9,5,-1,0,0,0,0,0,0,4,9,5,8,7,6,8,6,0,0,6,2,-1,0,0,0,3,6,2,3,7,6,0,1,5,0,5,4,-1,0,0,0,1,5,4,1,4,2,2,4,8,2,8,7,2,7,6,-1,5,4,9,6,10,1,6,1,7,7,1,3,-1,0,0,0,4,9,5,7,0,8,7,6,0,0,6,1,1,6,10,-1,3,7,6,3,6,0,0,6,10,0,10,5,0,5,4,-1,4,8,5,8,10,5,8,6,10,8,7,6,-1,0,0,0,5,6,11,5,11,9,9,11,8,-1,0,0,0,0,0,0,0,9,5,0,5,6,0,6,3,3,6,11,-1,0,0,0,8,0,11,11,5,6,11,0,5,5,0,1,-1,0,0,0,11,5,6,11,3,5,5,3,1,-1,0,0,0,0,0,0,10,1,2,5,6,11,5,11,9,9,11,8,-1,0,0,0,2,10,1,3,6,11,3,0,6,6,0,5,5,0,9,-1,0,2,10,0,10,8,8,10,5,8,5,6,8,6,11,-1,11,3,6,3,5,6,3,10,5,3,2,10,-1,0,0,0,2,3,6,6,9,5,3,9,6,3,8,9,-1,0,0,0,5,0,9,5,6,0,0,6,2,-1,0,0,0,0,0,0,6,2,3,6,3,5,5,3,8,5,8,0,5,0,1,-1,6,2,1,6,1,5,-1,0,0,0,0,0,0,0,0,0,8,9,5,8,5,3,3,5,6,3,6,10,3,10,1,-1,1,0,10,0,6,10,0,5,6,0,9,5,-1,0,0,0,0,3,8,10,5,6,-1,0,0,0,0,0,0,0,0,0,10,5,6,-1,0,0,0,0,0,0,0,0,0,0,0,0,11,5,10,11,7,5,-1,0,0,0,0,0,0,0,0,0,5,11,7,5,10,11,3,0,8,-1,0,0,0,0,0,0,11,5,10,11,7,5,9,0,1,-1,0,0,0,0,0,0,9,3,1,9,8,3,5,10,11,5,11,7,-1,0,0,0,2,11,7,2,7,1,1,7,5,-1,0,0,0,0,0,0,3,0,8,2,11,7,2,7,1,1,7,5,-1,0,0,0,2,11,0,0,5,9,0,11,5,5,11,7,-1,0,0,0,9,8,3,9,3,5,5,3,2,5,2,11,5,11,7,-1,10,2,3,10,3,5,5,3,7,-1,0,0,0,0,0,0,5,10,7,7,0,8,10,0,7,10,2,0,-1,0,0,0,1,9,0,10,2,3,10,3,5,5,3,7,-1,0,0,0,7,5,10,7,10,8,8,10,2,8,2,1,8,1,9,-1,7,5,1,7,1,3,-1,0,0,0,0,0,0,0,0,0,8,1,0,8,7,1,1,7,5,-1,0,0,0,0,0,0,0,5,9,0,3,5,5,3,7,-1,0,0,0,0,0,0,7,5,9,7,9,8,-1,0,0,0,0,0,0,0,0,0,4,5,10,4,10,8,8,10,11,-1,0,0,0,0,0,0,11,3,10,10,4,5,10,3,4,4,3,0,-1,0,0,0,9,0,1,4,5,10,4,10,8,8,10,11,-1,0,0,0,3,1,9,3,9,11,11,9,4,11,4,5,11,5,10,-1,8,4,11,11,1,2,4,1,11,4,5,1,-1,0,0,0,5,1,2,5,2,4,4,2,11,4,11,3,4,3,0,-1,11,8,4,11,4,2,2,4,5,2,5,9,2,9,0,-1,2,11,3,5,9,4,-1,0,0,0,0,0,0,0,0,0,4,5,10,4,10,2,4,2,8,8,2,3,-1,0,0,0,10,4,5,10,2,4,4,2,0,-1,0,0,0,0,0,0,0,1,9,8,2,3,8,4,2,2,4,10,10,4,5,-1,10,2,5,2,4,5,2,9,4,2,1,9,-1,0,0,0,4,3,8,4,5,3,3,5,1,-1,0,0,0,0,0,0,0,4,5,0,5,1,-1,0,0,0,0,0,0,0,0,0,0,3,9,3,5,9,3,4,5,3,8,4,-1,0,0,0,4,5,9,-1,0,0,0,0,0,0,0,0,0,0,0,0,7,4,9,7,9,11,11,9,10,-1,0,0,0,0,0,0,8,3,0,7,4,9,7,9,11,11,9,10,-1,0,0,0,0,1,4,4,11,7,1,11,4,1,10,11,-1,0,0,0,10,11,7,10,7,1,1,7,4,1,4,8,1,8,3,-1,2,11,7,2,7,4,2,4,1,1,4,9,-1,0,0,0,0,8,3,1,4,9,1,2,4,4,2,7,7,2,11,-1,7,2,11,7,4,2,2,4,0,-1,0,0,0,0,0,0,7,4,11,4,2,11,4,3,2,4,8,3,-1,0,0,0,7,4,3,3,10,2,3,4,10,10,4,9,-1,0,0,0,2,0,8,2,8,10,10,8,7,10,7,4,10,4,9,-1,4,0,1,4,1,7,7,1,10,7,10,2,7,2,3,-1,4,8,7,1,10,2,-1,0,0,0,0,0,0,0,0,0,9,7,4,9,1,7,7,1,3,-1,0,0,0,0,0,0,8,7,0,7,1,0,7,9,1,7,4,9,-1,0,0,0,4,0,3,4,3,7,-1,0,0,0,0,0,0,0,0,0,4,8,7,-1,0,0,0,0,0,0,0,0,0,0,0,0,8,9,10,8,10,11,-1,0,0,0,0,0,0,0,0,0,0,11,3,0,9,11,11,9,10,-1,0,0,0,0,0,0,1,8,0,1,10,8,8,10,11,-1,0,0,0,0,0,0,3,1,10,3,10,11,-1,0,0,0,0,0,0,0,0,0,2,9,1,2,11,9,9,11,8,-1,0,0,0,0,0,0,0,9,3,9,11,3,9,2,11,9,1,2,-1,0,0,0,11,8,0,11,0,2,-1,0,0,0,0,0,0,0,0,0,2,11,3,-1,0,0,0,0,0,0,0,0,0,0,0,0,3,10,2,3,8,10,10,8,9,-1,0,0,0,0,0,0,9,10,2,9,2,0,-1,0,0,0,0,0,0,0,0,0,3,8,2,8,10,2,8,1,10,8,0,1,-1,0,0,0,2,1,10,-1,0,0,0,0,0,0,0,0,0,0,0,0,8,9,1,8,1,3,-1,0,0,0,0,0,0,0,0,0,1,0,9,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,3,8,-1,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]),u=class{#e;constructor(e,t,n){this.#e=e.limits.maxComputeWorkgroupsPerDimension,this.totalWorkGroups=t;let i=Math.ceil(t/e.limits.maxComputeWorkgroupsPerDimension);this.stride=e.limits.minUniformBufferOffsetAlignment;let a=null;if(n&&(this.stride=r(8+n.byteLength,e.limits.minUniformBufferOffsetAlignment),a=new Uint8Array(n)),this.stride*i>e.limits.maxUniformBufferBindingSize)throw console.log(`Error! PushConstants uniform buffer is too big for a uniform buffer`),Error(`PushConstants uniform buffer is too big for a uniform buffer`);this.pushConstantsBuffer=e.createBuffer({size:this.stride*i,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let o=new ArrayBuffer(this.stride*i);for(let r=0;r<i;++r){let i=new Uint32Array(o,r*this.stride,2);i[0]=e.limits.maxComputeWorkgroupsPerDimension*r,i[1]=t,a&&new Uint8Array(o,r*this.stride+8,n.byteLength).set(a)}e.queue.writeBuffer(this.pushConstantsBuffer,0,o)}numDispatches(){return this.pushConstantsBuffer.size/this.stride}pushConstantsOffset(e){return this.stride*e}dispatchSize(e){let t=this.totalWorkGroups%this.#e;return t==0||e+1<this.numDispatches()?this.#e:t}},d=`@group(0) @binding(0)
var<storage, read_write> item_active: array<u32>;

@group(0) @binding(1)
var<storage, read_write> output_offset: array<u32>;

@group(0) @binding(2)
var<storage, read_write> output: array<u32>;

struct PushConstants {
    group_id_offset: u32,
    total_workgoups: u32,
    total_elements: u32
};

@group(1) @binding(0)
var<uniform> push_constants: PushConstants;

@id(0) override WORKGROUP_SIZE: u32 = 32;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let item_id = global_id.x + push_constants.group_id_offset * WORKGROUP_SIZE;
    // Handle out of bounds threads
    if (item_id >= push_constants.total_elements) {
        return;
    }
    // We compact down the IDs of the active elements in the buffer.
    // Active elements have non-zero values
    if (item_active[global_id.x] != 0) {
        output[output_offset[global_id.x]] = item_id;
    }
}

`,f=class e{#e;WORKGROUP_SIZE=64;#t;#n;constructor(e){this.#e=e,this.#t=e.limits.maxComputeWorkgroupsPerDimension}static async create(t){let n=new e(t),r=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`,hasDynamicOffset:!0}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`,hasDynamicOffset:!0}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]}),i=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`,hasDynamicOffset:!0}}]});return n.#n=t.createComputePipeline({layout:t.createPipelineLayout({bindGroupLayouts:[r,i]}),compute:{module:await o(t,d,`StreamCompactIDs`),entryPoint:`main`,constants:{0:n.WORKGROUP_SIZE}}}),n}async compactActiveIDs(e,t,n,r){let i=new Uint32Array([r]),a=new u(this.#e,Math.ceil(r/this.WORKGROUP_SIZE),i.buffer),o=this.#e.createBindGroup({layout:this.#n.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:a.pushConstantsBuffer,size:12}}]}),s=this.#t*this.WORKGROUP_SIZE;if(a.numDispatches()>1&&s*4%256!=0)throw Error(`StreamCompactIDs: Buffer dynamic offsets will not be 256b aligned! Set WORKGROUP_SIZE = 64`);let c=this.#e.createBindGroup({layout:this.#n.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e,size:Math.min(r,s)*4}},{binding:1,resource:{buffer:t,size:Math.min(r,s)*4}},{binding:2,resource:{buffer:n}}]}),l=c,d=r%s;d!=0&&(l=this.#e.createBindGroup({layout:this.#n.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e,size:d*4}},{binding:1,resource:{buffer:t,size:d*4}},{binding:2,resource:{buffer:n}}]}));let f=this.#e.createCommandEncoder(),p=f.beginComputePass();p.setPipeline(this.#n);for(let e=0;e<a.numDispatches();++e){let t=c;e+1==a.numDispatches()&&(t=l),p.setBindGroup(0,t,[e*s*4,e*s*4]),p.setBindGroup(1,o,[e*a.stride]),p.dispatchWorkgroups(a.dispatchSize(e),1,1)}p.end(),this.#e.queue.submit([f.finish()]),await this.#e.queue.onSubmittedWorkDone()}},p=`alias float2 = vec2<f32>;
alias float3 = vec3<f32>;
alias float4 = vec4<f32>;
alias uint2 = vec2<u32>;
alias uint3 = vec3<u32>;
alias uint4 = vec4<u32>;
alias int2 = vec2<i32>;
alias int3 = vec3<i32>;
alias int4 = vec4<i32>;

const MC_NUM_CASES: u32 = 256;
const MC_CASE_ELEMENTS: u32 = 16;

struct VolumeInfo {
    dims: uint4,
    scalar_strides: uint4,
    scalar_offset: u32,
    isovalue: f32,
    _padding: uint2,
    _reserved_0: uint4,
    _reserved_1: uint4,
    _reserved_2: uint4,
    _reserved_3: u32,
    normal_sign: f32,
    _extended_padding: uint2,
};

@group(0) @binding(0)
var volume: texture_3d<f32>;

@group(0) @binding(1)
var<uniform> volume_info: VolumeInfo;

const INDEX_TO_VERTEX: array<int3, 8> = array<int3, 8>(
    int3(0, 0, 0),
    int3(1, 0, 0),
    int3(1, 1, 0),
    int3(0, 1, 0),
    int3(0, 0, 1),
    int3(1, 0, 1),
    int3(1, 1, 1),
    int3(0, 1, 1)
);


fn voxel_id_to_pos(id: u32) -> uint3
{
    return uint3(id % (volume_info.dims[0] - 1),
            (id / (volume_info.dims[0] - 1)) % (volume_info.dims[1] - 1),
            id / ((volume_info.dims[0] - 1) * (volume_info.dims[1] - 1)));
}

fn compute_voxel_values(voxel: uint3, values: ptr<function, array<f32, 8>>)
{
    for (var i = 0; i < 8; i++) {
        let p = voxel + uint3(INDEX_TO_VERTEX[i]);
        (*values)[i] = textureLoad(volume, p, 0).x;
    }
}

fn sample_volume_scalar(p: int3) -> f32
{
    let upper = int3(volume_info.dims.xyz) - int3(1);
    return textureLoad(volume, clamp(p, int3(0), upper), 0).x;
}
`,m=`alias float2 = vec2<f32>;
alias float3 = vec3<f32>;
alias float4 = vec4<f32>;
alias uint2 = vec2<u32>;
alias uint3 = vec3<u32>;
alias uint4 = vec4<u32>;
alias int2 = vec2<i32>;
alias int3 = vec3<i32>;
alias int4 = vec4<i32>;

const MC_NUM_CASES: u32 = 256;
const MC_CASE_ELEMENTS: u32 = 16;

struct VolumeInfo {
    dims: uint4,
    scalar_strides: uint4,
    scalar_offset: u32,
    isovalue: f32,
    _padding: uint2,
    _reserved_0: uint4,
    _reserved_1: uint4,
    _reserved_2: uint4,
    _reserved_3: u32,
    normal_sign: f32,
    _extended_padding: uint2,
};

@group(0) @binding(0)
var<storage> scalar_volume: array<f32>;

@group(0) @binding(1)
var<uniform> volume_info: VolumeInfo;

const INDEX_TO_VERTEX: array<int3, 8> = array<int3, 8>(
    int3(0, 0, 0),
    int3(1, 0, 0),
    int3(1, 1, 0),
    int3(0, 1, 0),
    int3(0, 0, 1),
    int3(1, 0, 1),
    int3(1, 1, 1),
    int3(0, 1, 1)
);

fn voxel_id_to_pos(id: u32) -> uint3
{
    return uint3(id % (volume_info.dims[0] - 1),
            (id / (volume_info.dims[0] - 1)) % (volume_info.dims[1] - 1),
            id / ((volume_info.dims[0] - 1) * (volume_info.dims[1] - 1)));
}

fn scalar_buffer_index(p: uint3) -> u32
{
    return volume_info.scalar_offset
        + p.x * volume_info.scalar_strides.x
        + p.y * volume_info.scalar_strides.y
        + p.z * volume_info.scalar_strides.z;
}

fn compute_voxel_values(voxel: uint3, values: ptr<function, array<f32, 8>>)
{
    for (var i = 0; i < 8; i++) {
        let p = voxel + uint3(INDEX_TO_VERTEX[i]);
        (*values)[i] = scalar_volume[scalar_buffer_index(p)];
    }
}

fn sample_volume_scalar(p: int3) -> f32
{
    let upper = int3(volume_info.dims.xyz) - int3(1);
    return scalar_volume[scalar_buffer_index(uint3(clamp(p, int3(0), upper)))];
}
`,h=`alias float2 = vec2<f32>;
alias float3 = vec3<f32>;
alias float4 = vec4<f32>;
alias uint2 = vec2<u32>;
alias uint3 = vec3<u32>;
alias uint4 = vec4<u32>;
alias int2 = vec2<i32>;
alias int3 = vec3<i32>;
alias int4 = vec4<i32>;

const MC_NUM_CASES: u32 = 256;
const MC_CASE_ELEMENTS: u32 = 16;

struct VolumeInfo {
    dims: uint4,
    scalar_strides: uint4,
    scalar_offset: u32,
    isovalue: f32,
    brick_size: u32,
    brick_count_x: u32,
    brick_count_y: u32,
    brick_count_z: u32,
    directory_offset: u32,
    directory_count: u32,
    active_brick_row_stride_u32: u32,
    active_brick_atlas_cell_offset_lane: u32,
    atlas_cell_stride_floats: u32,
    atlas_scalar_lane: u32,
    directory_sentinel: u32,
    generation_id: u32,
    background_value: f32,
    active_brick_count: u32,
    atlas_cell_count: u32,
    normal_sign: f32,
    _padding: uint2,
};

@group(0) @binding(0)
var<storage, read> atlas: array<f32>;

@group(0) @binding(1)
var<uniform> volume_info: VolumeInfo;

@group(0) @binding(2)
var<storage, read> brick_directory: array<u32>;

@group(0) @binding(3)
var<storage, read> active_brick_rows: array<u32>;

const INDEX_TO_VERTEX: array<int3, 8> = array<int3, 8>(
    int3(0, 0, 0),
    int3(1, 0, 0),
    int3(1, 1, 0),
    int3(0, 1, 0),
    int3(0, 0, 1),
    int3(1, 0, 1),
    int3(1, 1, 1),
    int3(0, 1, 1)
);

fn voxel_id_to_pos(id: u32) -> uint3
{
    return uint3(id % (volume_info.dims.x - 1u),
            (id / (volume_info.dims.x - 1u)) % (volume_info.dims.y - 1u),
            id / ((volume_info.dims.x - 1u) * (volume_info.dims.y - 1u)));
}

fn sparse_scalar_at(p: uint3) -> f32
{
    if (any(p >= volume_info.dims.xyz) || volume_info.brick_size == 0u) {
        return volume_info.background_value;
    }

    let brick = p / volume_info.brick_size;
    if (brick.x >= volume_info.brick_count_x
            || brick.y >= volume_info.brick_count_y
            || brick.z >= volume_info.brick_count_z) {
        return volume_info.background_value;
    }

    let local_directory_index = brick.x
        + volume_info.brick_count_x
            * (brick.y + volume_info.brick_count_y * brick.z);
    if (local_directory_index >= volume_info.directory_count) {
        return volume_info.background_value;
    }
    let directory_index = volume_info.directory_offset + local_directory_index;
    if (directory_index >= arrayLength(&brick_directory)) {
        return volume_info.background_value;
    }

    let active_brick_index = brick_directory[directory_index];
    if (active_brick_index == volume_info.directory_sentinel
            || active_brick_index >= volume_info.active_brick_count
            || volume_info.active_brick_row_stride_u32 == 0u) {
        return volume_info.background_value;
    }
    let row_index = active_brick_index * volume_info.active_brick_row_stride_u32
        + volume_info.active_brick_atlas_cell_offset_lane;
    if (row_index >= arrayLength(&active_brick_rows)) {
        return volume_info.background_value;
    }

    let local = p % volume_info.brick_size;
    let local_cell_index = local.x + volume_info.brick_size
        * (local.y + volume_info.brick_size * local.z);
    let atlas_cell_index = active_brick_rows[row_index] + local_cell_index;
    if (atlas_cell_index >= volume_info.atlas_cell_count) {
        return volume_info.background_value;
    }
    let scalar_index = atlas_cell_index * volume_info.atlas_cell_stride_floats
        + volume_info.atlas_scalar_lane;
    if (scalar_index >= arrayLength(&atlas)) {
        return volume_info.background_value;
    }
    return atlas[scalar_index];
}

fn compute_voxel_values(voxel: uint3, values: ptr<function, array<f32, 8>>)
{
    for (var i = 0u; i < 8u; i++) {
        let p = voxel + uint3(INDEX_TO_VERTEX[i]);
        (*values)[i] = sparse_scalar_at(p);
    }
}

fn sample_volume_scalar(p: int3) -> f32
{
    let upper = int3(volume_info.dims.xyz) - int3(1);
    return sparse_scalar_at(uint3(clamp(p, int3(0), upper)));
}
`,g=`// include of compute_voxel_values.wgsl is inserted here

@group(1) @binding(0)
var<storage, read_write> voxel_active: array<u32>;

@group(1) @binding(1)
var<storage, read_write> voxel_id_output_offset: array<u32>;

@group(1) @binding(2)
var<storage, read_write> n_voxel_active: array<atomic<u32>>;

@compute @workgroup_size(4, 4, 2)
fn main(@builtin(global_invocation_id) global_id: uint3)
{
    // We might have some workgroups run for voxels out of bounds due to the
    // padding to align to the workgroup size. We also only compute for voxels
    // on the dual grid, which has dimensions of volume_dims - 1
    if (any(global_id >= volume_info.dims.xyz - uint3(1))) {
        return;
    }

    var values: array<f32, 8>;
    compute_voxel_values(global_id, &values);
    // Compute the case this falls into to see if this voxel has vertices
    var case_index = 0u;
    for (var i = 0u; i < 8u; i++) {
        if (values[i] <= volume_info.isovalue) {
            case_index |= 1u << i;
        }
    }
    let voxel_idx = global_id.x +
        (volume_info.dims.x - 1) * (global_id.y + (volume_info.dims.y - 1) * global_id.z);
    let is_active = select(0u, 1u, case_index != 0 && case_index != MC_NUM_CASES - 1);
    voxel_active[voxel_idx] = is_active;

    // We don't care about inactive voxels here
    if (is_active != 0) {
        let output_offset = atomicAdd(&n_voxel_active[0], is_active);
        voxel_id_output_offset[voxel_idx] = output_offset;
    }
}

`,_=`// include of compute_voxel_values.wgsl is inserted here

@id(0) override WORKGROUP_SIZE: u32 = 32;

@group(1) @binding(0)
var<storage> case_table: array<i32>;

@group(1) @binding(1)
var<storage, read_write> active_voxel_ids: array<u32>;

@group(1) @binding(2)
var<storage, read_write> voxel_vertex_offsets: array<u32>;

@group(1) @binding(3)
var<storage, read_write> total_vertices: array<atomic<u32>>;

struct PushConstants {
    group_id_offset: u32,
    total_workgoups: u32,
    total_elements: u32
};

@group(2) @binding(0)
var<uniform> push_constants: PushConstants;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) global_id: uint3)
{
    // Skip out of bounds threads
    let work_item = global_id.x + push_constants.group_id_offset * WORKGROUP_SIZE;
    if (work_item >= push_constants.total_elements) {
        return;
    }

    let voxel_id = active_voxel_ids[work_item];
    if (voxel_id == 0xffffffffu) {
        voxel_vertex_offsets[work_item] = 0u;
        return;
    }
    var values: array<f32, 8>;
    compute_voxel_values(voxel_id_to_pos(voxel_id), &values);

    var case_index = 0u;
    for (var i = 0u; i < 8u; i++) {
        if (values[i] <= volume_info.isovalue) {
            case_index |= 1u << i;
        }
    }

    // There are 16 entries per-case, terminated by a -1 when the vertex
    // entries end for the given case
    var num_verts = 0u;
    for (var i = 0u; i < MC_CASE_ELEMENTS && case_table[case_index * MC_CASE_ELEMENTS + i] != -1; i++) 
    {
        num_verts++;
    }
    let offset = atomicAdd(&total_vertices[0], num_verts);
    voxel_vertex_offsets[work_item] = offset;
}
`,v=`// include of compute_voxel_values.wgsl is inserted here

@id(0) override WORKGROUP_SIZE: u32 = 32;

@group(1) @binding(0)
var<storage> case_table: array<i32>;

@group(1) @binding(1)
var<storage, read_write> active_voxel_ids: array<u32>;

@group(1) @binding(2)
var<storage, read_write> voxel_vertex_offsets: array<u32>;

@group(1) @binding(3)
var<storage, read_write> vertices: array<float4>;

@group(1) @binding(4)
var<storage, read_write> packed_normals: array<u32>;

struct PushConstants {
    group_id_offset: u32,
    total_workgoups: u32,
    total_elements: u32
};

@group(2) @binding(0)
var<uniform> push_constants: PushConstants;

const EDGE_VERTICES: array<uint2, 12> = array<uint2, 12>(
    uint2(0, 1),
    uint2(1, 2),
    uint2(2, 3),
    uint2(3, 0),
    uint2(4, 5),
    uint2(6, 5),
    uint2(6, 7),
    uint2(7, 4),
    uint2(0, 4),
    uint2(1, 5),
    uint2(2, 6),
    uint2(3, 7)
);

fn lerp_verts(va: int3, vb: int3, fa: f32, fb: f32) -> float3
{
    var t: f32 = 0.0;
    if (abs(fa - fb) >= 0.001) {
        t = (volume_info.isovalue - fa) / (fb - fa);
    }
    return mix(float3(va), float3(vb), t);
}

fn edge_interp_t(fa: f32, fb: f32) -> f32
{
    if (abs(fa - fb) < 0.001) {
        return 0.0;
    }
    return clamp((volume_info.isovalue - fa) / (fb - fa), 0.0, 1.0);
}

fn scalar_gradient_at(p: int3) -> float3
{
    return float3(
        sample_volume_scalar(p + int3(1, 0, 0)) - sample_volume_scalar(p - int3(1, 0, 0)),
        sample_volume_scalar(p + int3(0, 1, 0)) - sample_volume_scalar(p - int3(0, 1, 0)),
        sample_volume_scalar(p + int3(0, 0, 1)) - sample_volume_scalar(p - int3(0, 0, 1))
    );
}

fn octahedral_sign_not_zero(v: float2) -> float2
{
    return select(float2(-1.0), float2(1.0), v >= float2(0.0));
}

fn pack_octahedral_snorm16x2(normal: float3) -> u32
{
    let length_squared = dot(normal, normal);
    if (length_squared <= 0.000000000001) {
        return 0x80008000u;
    }
    let n = normal / sqrt(length_squared);
    var oct = n.xy / (abs(n.x) + abs(n.y) + abs(n.z));
    if (n.z < 0.0) {
        oct = (float2(1.0) - abs(oct.yx)) * octahedral_sign_not_zero(oct);
    }
    let packed = pack2x16snorm(clamp(oct, float2(-1.0), float2(1.0)));
    // Reserve one code point for a degenerate gradient. If an implementation
    // ever rounds a valid vector to the sentinel, move it by one quantization
    // unit; the decoded direction changes below snorm16 precision.
    return select(packed, packed ^ 1u, packed == 0x80008000u);
}

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) global_id: uint3)
{
    // Skip out of bounds threads
    let work_item = global_id.x + push_constants.group_id_offset * WORKGROUP_SIZE;
    if (work_item >= push_constants.total_elements) {
        return;
    }

    let voxel_id = active_voxel_ids[work_item];
    if (voxel_id == 0xffffffffu) {
        return;
    }
    var values: array<f32, 8>;
    let voxel_pos = voxel_id_to_pos(voxel_id);
    compute_voxel_values(voxel_pos, &values);

    var case_index = 0u;
    for (var i = 0u; i < 8u; i++) {
        if (values[i] <= volume_info.isovalue) {
            case_index |= 1u << i;
        }
    }
    if (case_table[case_index * MC_CASE_ELEMENTS] == -1) {
        return;
    }

    // Corner gradients come from the same scalar source and the same command
    // that emits positions. Interpolating the endpoint gradients along an MC
    // edge gives every duplicate of that edge the same smooth normal.
    var gradients: array<float3, 8>;
    for (var i = 0u; i < 8u; i++) {
        gradients[i] = scalar_gradient_at(int3(voxel_pos) + INDEX_TO_VERTEX[i]);
    }

    let vertex_offset = voxel_vertex_offsets[work_item];
    // The vertex buffer may be allocated smaller than the worst case when the
    // caller set a vertex-rows budget; writes past the allocation are dropped
    // and the paired draw-count clamp keeps the draw from reading them.
    let vertex_capacity = arrayLength(&vertices);
    // Now we can finally compute and output the vertices
    for (var i = 0u; i < MC_CASE_ELEMENTS && case_table[case_index * MC_CASE_ELEMENTS + i] != -1; i++)
    {
        if (vertex_offset + i >= vertex_capacity) {
            break;
        }
        let edge = case_table[case_index * MC_CASE_ELEMENTS + i];
        let v0 = EDGE_VERTICES[edge].x;
        let v1 = EDGE_VERTICES[edge].y;

        // Compute the interpolated vertex for this edge within the unit cell
        var v = lerp_verts(INDEX_TO_VERTEX[v0], INDEX_TO_VERTEX[v1], values[v0], values[v1]);
        let t = edge_interp_t(values[v0], values[v1]);
        let gradient = mix(gradients[v0], gradients[v1], t) * volume_info.normal_sign;

        // Offset the vertex into the global volume grid
        v = v + float3(voxel_pos) + 0.5;
        vertices[vertex_offset + i] = float4(v, 1.0);
        packed_normals[vertex_offset + i] = pack_octahedral_snorm16x2(gradient);
    }
}
`,y=`@id(0) override WORKGROUP_SIZE: u32 = 64;

@group(0) @binding(0)
var<storage, read_write> voxel_ids: array<u32>;

struct PushConstants {
    group_id_offset: u32,
    total_workgoups: u32,
    total_elements: u32
};

@group(1) @binding(0)
var<uniform> push_constants: PushConstants;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>)
{
    let work_item = global_id.x + push_constants.group_id_offset * WORKGROUP_SIZE;
    if (work_item >= push_constants.total_elements) {
        return;
    }
    voxel_ids[work_item] = work_item;
}
`,b=`// Clamp the exact vertex total into the indirect draw args and the exposed
// vertex counter when a vertex-rows budget truncated the vertex buffer.
// compute_vertices.wgsl bounds-guards its writes against the allocated buffer,
// so vertices beyond the budget are never written; this kernel keeps the draw
// and any downstream translation dispatch from reading those missing rows.
// The exact (unclamped) total is preserved in slot 1 of the exposed counter
// so callers can detect saturation without any readback on the hot path.

@group(0) @binding(0)
var<storage, read_write> exact_counter: array<u32>;

@group(0) @binding(1)
var<storage, read_write> draw_args: array<u32>;

@group(0) @binding(2)
var<storage, read_write> exposed_counter: array<u32>;

struct ClampParams {
    vertex_budget: u32
};

@group(0) @binding(3)
var<uniform> clamp_params: ClampParams;

@compute @workgroup_size(1)
fn main()
{
    let exact = exact_counter[0];
    let clamped = min(exact, clamp_params.vertex_budget);
    draw_args[0] = clamped;
    exposed_counter[0] = clamped;
    exposed_counter[1] = exact;
}
`,x=`texture-3d`,S=`scalar-buffer`,C=`sparse-brick-atlas`,w=112,T=36,E=15,D=Uint32Array.BYTES_PER_ELEMENT,O=`gpu-conservative-no-readback`,k=`external-command-encoder`,A=`internal-queue-submit`,j=`three-webgpu-marching-cubes.encoding-retirement.v1`;function M(e){if(e==null)return null;if(typeof e.beginComputePass!=`function`||typeof e.clearBuffer!=`function`)throw TypeError(`options.commandEncoder must be a GPUCommandEncoder-compatible object`);return e}function N(e){return[...new Set(e.filter(e=>e!=null&&typeof e.destroy==`function`))]}function P(e){let t=Object.freeze(N(e)),n=!1;return Object.freeze({schema:j,mode:k,callerMustSubmitBeforeRetirement:!0,temporaryResources:t,temporaryResourceCount:t.length,get retired(){return n},retireAfterSubmit:()=>{if(n)return Object.freeze({status:`encoding-resources-already-retired`,retired:!0,destroyedResourceCount:0});let e=[],r=0;for(let n of t)try{n.destroy(),r+=1}catch(t){e.push(t)}n=!0;let i=Object.freeze({status:e.length===0?`encoding-resources-retired`:`encoding-resource-retirement-failed`,retired:!0,destroyedResourceCount:r,errorCount:e.length});if(e.length>0){let t=AggregateError(e,`one or more marching-cubes encoding resources failed to retire`);throw t.retirementReport=i,t}return i}})}function F(e,{externalCommandEncoder:t=null,temporaryResources:n=[],internalSubmitCount:r=0,requiresExternalSubmit:i=!1}={}){let a=t!=null;if(e.commandEncodingMode=a?k:A,e.internalSubmitCount=a?0:r,e.requiresExternalSubmit=a&&i,a){let t=P(n);e.encodingRetirement=t,e.temporaryResourceCount=t.temporaryResourceCount,e.retireTemporaryResourcesAfterSubmit=t.retireAfterSubmit}else e.encodingRetirement=null,e.temporaryResourceCount=0,e.retireTemporaryResourcesAfterSubmit=null;return e}function I(e){for(let t of N(e))t.destroy()}function L(e){return e?.sourceType===C||e?.candidateVoxelIdsBuffer!=null?C:e?.sourceType===S||e?.scalarBuffer!=null?S:x}function R(e){if(Array.isArray(e?.scalarStrides)||ArrayBuffer.isView(e?.scalarStrides))return Array.from(e.scalarStrides.slice(0,3));let t=e.dims;return[1,t[0],t[0]*t[1]]}function z(e){return Math.max(0,Math.round(Number(e?.scalarOffset||0)))}function B(e){let t=Number(e?.normalSign??1);if(t!==-1&&t!==1)throw RangeError(`volume.normalSign must be exactly -1 or 1`);return t}function V(e,t=0){let n=new ArrayBuffer(w),r=new Uint32Array(n),i=new Float32Array(n);if(r.set(e.dims,0),r.set(R(e),4),r[8]=z(e),i[9]=Number(t),i[25]=B(e),L(e)===C){let t=Math.max(1,Math.round(Number(e.brickSize)||8)),n=e.brickCounts||e.dims.map(e=>Math.ceil(e/t));r[10]=t,r[11]=n[0],r[12]=n[1],r[13]=n[2],r[14]=Math.max(0,Math.round(Number(e.directoryOffset)||0)),r[15]=Math.max(0,Math.round(Number(e.directoryCount)||n[0]*n[1]*n[2])),r[16]=Math.max(1,Math.round(Number(e.activeBrickRowStrideU32)||16)),r[17]=Math.max(0,Math.round(Number(e.activeBrickAtlasCellOffsetLane)||0)),r[18]=Math.max(1,Math.round(Number(e.atlasCellStrideFloats)||8)),r[19]=Math.max(0,Math.round(Number(e.atlasScalarLane)||0)),r[20]=Number(e.directorySentinel??4294967295)>>>0,r[21]=Number(e.generationId??e.generation??0)>>>0,i[22]=Number(e.backgroundValue??0),r[23]=Math.max(0,Math.round(Number(e.activeBrickCount)||0)),r[24]=Math.max(0,Math.round(Number(e.atlasCellCount)||0))}return n}function H(e){let t={buffer:e.buffer},n=Math.max(0,Math.round(Number(e.bufferOffsetBytes)||0)),r=Math.max(0,Math.round(Number(e.bufferBindingByteLength)||0));return n>0&&(t.offset=n),r>0&&(t.size=r),t}var U=class{constructor(e,t,n=null){this.count=e,this.buffer=t,this.normalBuffer=n}};function W(e,{surfaceGenerationId:t,volumeGenerationId:n=null,normalSign:r,normalBufferByteLength:i=0}={}){return e.surfaceGenerationId=t,e.volumeGenerationId=n,e.normalBufferByteLength=i,e.normalEncoding=`octahedral-snorm16x2`,e.normalSemantic=`oriented-scalar-gradient`,e.normalSign=r,e.normalDegenerateEncoding=`reserved-u32-0x80008000`,e.normalProducerStage=`marchingCubesVertexEmit`,e.normalTimestampSpanLabel=`marchingCubesVertexEmit`,e.normalAdditionalSubmitCount=0,e.normalPositionGenerationCoupled=!0,e}var G=class e{#e;#t;#n;#r;#i;#a;#o;#s=0;#c;#l;#u;#d;#f;#p=null;#m;#h;#g;#_;#v;#y;#b;#x;#S;computeActiveVoxelsTime=0;markActiveVoxelsKernelTime=-1;computeActiveVoxelsScanTime=0;computeActiveVoxelsCompactTime=0;computeVertexOffsetsTime=0;computeNumVertsKernelTime=-1;computeVertexOffsetsScanTime=0;computeVerticesTime=0;computeVerticesKernelTime=-1;constructor(e,t){this.#e=t,this.#t=e,this.#y=L(e)!==C&&t.features.has(`timestamp-query`)}static async create(t,n){let r=new e(t,n),i=L(t),a=i===C;a||(r.#n=await c.create(n),r.#r=await f.create(n)),r.#c=n.createBuffer({size:l.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),n.queue.writeBuffer(r.#c,0,l),r.#l=n.createBuffer({size:w,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),n.queue.writeBuffer(r.#l,0,V(t)),a||(r.#u=n.createBuffer({size:r.#n.getAlignedSize(t.dualGridNumVoxels)*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),r.#d=n.createBuffer({size:r.#u.size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC|GPUBufferUsage.STORAGE})),r.#f=n.createBuffer({size:4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC|GPUBufferUsage.STORAGE}),a||(r.#m=n.createBuffer({size:4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ})),a||(r.#h=n.createBuffer({size:Math.max(4,t.dualGridNumVoxels*4),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}));let s=i===S?m:i===C?h:p,u=a?null:await o(n,s+`
`+g,`mark_active_voxel.wgsl`),d=await o(n,s+`
`+_,`compute_num_verts.wgsl`),b=await o(n,s+`
`+v,`compute_vertices.wgsl`),x=a?null:await o(n,y,`fill_voxel_ids.wgsl`),T=i===S,E=n.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,...T||a?{buffer:{type:`read-only-storage`}}:{texture:{viewDimension:`3d`}}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},...a?[{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}}]:[]]});r.#g=n.createBindGroup({layout:E,entries:[{binding:0,resource:T?{buffer:r.#t.scalarBuffer}:a?{buffer:r.#t.atlasBuffer}:r.#t.texture.createView()},{binding:1,resource:{buffer:r.#l}},...a?[{binding:2,resource:{buffer:r.#t.directoryBuffer}},{binding:3,resource:{buffer:r.#t.activeBrickRowsBuffer}}]:[]]});let D=null;a||(D=n.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]}),r.#_=n.createBindGroup({layout:D,entries:[{binding:0,resource:{buffer:r.#u}},{binding:1,resource:{buffer:r.#d}},{binding:2,resource:{buffer:r.#f}}]}));let O=n.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]}),k=n.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]}),A=n.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`,hasDynamicOffset:!0}}]}),j=a?null:n.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]});return a||(r.#i=n.createComputePipeline({layout:n.createPipelineLayout({bindGroupLayouts:[E,D]}),compute:{module:u,entryPoint:`main`}})),r.#a=n.createComputePipeline({layout:n.createPipelineLayout({bindGroupLayouts:[E,O,A]}),compute:{module:d,entryPoint:`main`}}),r.#o=n.createComputePipeline({layout:n.createPipelineLayout({bindGroupLayouts:[E,k,A]}),compute:{module:b,entryPoint:`main`}}),a||(r.#v=n.createComputePipeline({layout:n.createPipelineLayout({bindGroupLayouts:[j,A]}),compute:{module:x,entryPoint:`main`,constants:{0:64}}})),r.#y&&(r.#b=n.createQuerySet({type:`timestamp`,count:6}),r.#x=n.createBuffer({size:48,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),r.#S=n.createBuffer({size:r.#x.size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ})),a||r.#C(),r}#C(){let e=Math.max(0,Math.round(this.#t.dualGridNumVoxels||0));if(e==0)return;let t=new Uint32Array([e]),n=new u(this.#e,Math.ceil(e/64),t.buffer),r=this.#e.createBindGroup({layout:this.#v.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.#h}}]}),i=this.#e.createBindGroup({layout:this.#v.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:n.pushConstantsBuffer,size:12}}]}),a=this.#e.createCommandEncoder(),o=a.beginComputePass();o.setPipeline(this.#v),o.setBindGroup(0,r);for(let e=0;e<n.numDispatches();++e)o.setBindGroup(1,i,[e*n.stride]),o.dispatchWorkgroups(n.dispatchSize(e),1,1);o.end(),this.#e.queue.submit([a.finish()])}async computeSurface(e,t={}){let n=++this.#s,r={...t,surfaceGenerationId:n},i=L(this.#t)===C||t?.readbackMode===`gpu-conservative-no-readback`||t?.noReadback===!0;if(t?.commandEncoder!=null&&!i)throw Object.assign(Error(`options.commandEncoder requires conservative no-readback extraction`),{status:`external-command-encoder-requires-no-readback`});if(i)return this.computeSurfaceConservativeNoReadback(e,r);this.uploadIsovalue(e);let a=performance.now(),o=await this.computeActiveVoxels(),s=performance.now();if(this.computeActiveVoxelsTime=s-a,o.count==0)return W(new U(0,null),{surfaceGenerationId:n,normalSign:B(this.#t)});a=performance.now();let c=await this.computeVertexOffsets(o);if(s=performance.now(),this.computeVertexOffsetsTime=s-a,c.count==0)return W(new U(0,null),{surfaceGenerationId:n,normalSign:B(this.#t)});a=performance.now();let l=await this.computeVertices(o,c);if(s=performance.now(),this.computeVerticesTime=s-a,o.buffer.destroy(),c.buffer.destroy(),this.#y){await this.#S.mapAsync(GPUMapMode.READ);let e=new BigUint64Array(this.#S.getMappedRange());this.markActiveVoxelsKernelTime=Number(e[1]-e[0])*1e-6,this.computeNumVertsKernelTime=Number(e[3]-e[2])*1e-6,this.computeVerticesKernelTime=Number(e[5]-e[4])*1e-6,this.#S.unmap()}return W(new U(c.count,l.positionBuffer,l.normalBuffer),{surfaceGenerationId:n,normalSign:B(this.#t),normalBufferByteLength:l.normalBufferByteLength})}async computeSurfaceConservativeNoReadback(e,t={}){let n=M(t?.commandEncoder),r=Number.isInteger(t?.surfaceGenerationId)?t.surfaceGenerationId:++this.#s;this.uploadIsovalue(e);let i=L(this.#t)===C,a=Math.max(0,Math.round(i?this.#t.candidateVoxelCount||0:this.#t.dualGridNumVoxels||0));if(a==0){let e=W(new U(0,null),{surfaceGenerationId:r,volumeGenerationId:i?Number(this.#t.generationId||0):null,normalSign:B(this.#t)});return e.noReadback=!0,e.readbackMode=O,e.sourceType=L(this.#t),e.volumeGenerationId=i?Number(this.#t.generationId||0):null,F(e,{externalCommandEncoder:n,requiresExternalSubmit:!1})}let o=a*E,s=Math.max(0,Math.round(Number(t?.vertexRowsBudget)||0)),c=s>0?Math.min(o,s):o,l=c<o,u=c*4*4,d=Number(this.#e.limits?.maxBufferSize)||1/0;if(u>d)throw Object.assign(RangeError(`conservative no-readback marching-cubes vertex buffer (${u}) exceeds maxBufferSize (${d})`),{status:`conservative-no-readback-buffer-too-large`});let f=new U(a,i?this.#t.candidateVoxelIdsBuffer:this.#h);f.countMode=i?`sparse-candidate-voxel-capacity`:`dense-all-voxels`,f.ownsBuffer=!1,f.bufferOffsetBytes=i?Math.max(0,Math.round(Number(this.#t.candidateVoxelOffsetBytes)||0)):0,f.bufferBindingByteLength=i?a*Uint32Array.BYTES_PER_ELEMENT:0,f.indirectDispatchBuffer=i&&this.#t.candidateDispatchIndirectBuffer||null,f.indirectDispatchOffsetBytes=i?Math.max(0,Math.round(Number(this.#t.candidateDispatchIndirectOffsetBytes)||0)):0;let p=await this.computeVertexOffsets(f,{readback:!1,conservativeVertexCount:c,clampVertexCount:l?c:0,timestampProfiler:t?.timestampProfiler,timestampMetadata:t?.timestampMetadata,commandEncoder:n}),m=await this.computeVertices(f,p,{waitForCompletion:!1,writeTimestamps:!1,timestampProfiler:t?.timestampProfiler,timestampMetadata:t?.timestampMetadata,commandEncoder:n}),h=[p.buffer,...p.encodingTemporaryResources||[],...m.encodingTemporaryResources||[]];n??p.buffer.destroy();let g=W(new U(c,m.positionBuffer,m.normalBuffer),{surfaceGenerationId:r,volumeGenerationId:i?Number(this.#t.generationId||0):null,normalSign:B(this.#t),normalBufferByteLength:m.normalBufferByteLength});return g.vertexRowsBudget=s>0?c:null,g.vertexRowsBudgetClamped=l,g.conservativeWorstCaseVertexCount=o,g.vertexCount=o,g.maxVertexCount=o,g.vertexCountMode=`conservative-upper-bound`,g.noReadback=!0,g.actualVertexCounterBuffer=p.actualVertexCounterBuffer||null,g.actualVertexCounterBufferByteLength=p.actualVertexCounterBufferByteLength||0,g.drawIndirectBuffer=p.drawIndirectBuffer||null,g.drawIndirectBufferByteLength=p.drawIndirectBufferByteLength||0,g.readbackMode=O,g.sourceType=L(this.#t),g.candidateVoxelCount=i?a:null,g.candidateVoxelOffset=i?Number(this.#t.candidateVoxelOffset||0):null,g.candidateVoxelOffsetBytes=i?Number(this.#t.candidateVoxelOffsetBytes||0):null,g.candidateVoxelCountMode=i?f.indirectDispatchBuffer?`gpu-indirect-admitted-count-with-capacity-bound`:`fixed-capacity-with-0xffffffff-sentinel`:null,g.candidateDispatchMode=i?f.indirectDispatchBuffer?`dispatch-workgroups-indirect`:`fixed-capacity`:null,g.volumeGenerationId=i?Number(this.#t.generationId||0):null,F(g,{externalCommandEncoder:n,temporaryResources:h,internalSubmitCount:2,requiresExternalSubmit:!0})}uploadIsovalue(e){this.#e.queue.writeBuffer(this.#l,T,new Float32Array([e]))}async computeActiveVoxels(){if(L(this.#t)===C)throw Object.assign(Error(`sparse brick volumes use the borrowed candidate buffer in conservative no-readback mode`),{status:`sparse-brick-atlas-requires-conservative-no-readback`});let e=[Math.ceil(this.#t.dualGridDims[0]/4),Math.ceil(this.#t.dualGridDims[1]/4),Math.ceil(this.#t.dualGridDims[2]/2)],t=this.#e.createCommandEncoder(),n={};this.#y&&(n={timestampWrites:{querySet:this.#b,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1}}),t.clearBuffer(this.#f);let r=t.beginComputePass(n);r.setPipeline(this.#i),r.setBindGroup(0,this.#g),r.setBindGroup(1,this.#_),r.dispatchWorkgroups(e[0],e[1],e[2]),r.end(),t.copyBufferToBuffer(this.#f,0,this.#m,0,4),this.#e.queue.submit([t.finish()]),await this.#m.mapAsync(GPUMapMode.READ);let i=new Uint32Array(this.#m.getMappedRange())[0];if(this.#m.unmap(),i==0)return new U(0,null);let a=this.#e.createBuffer({size:i*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),o=performance.now();await this.#r.compactActiveIDs(this.#u,this.#d,a,this.#t.dualGridNumVoxels);let s=performance.now();return this.computeActiveVoxelsCompactTime=s-o,new U(i,a)}async computeVertexOffsets(e,t={}){let n=t?.readback!==!1,r=M(t?.commandEncoder);if(r!=null&&n)throw Object.assign(Error(`an external command encoder cannot be used with vertex-count readback`),{status:`external-command-encoder-readback-not-supported`});let i=Math.max(0,Math.round(Number(t?.conservativeVertexCount)||0)),a=t?.timestampProfiler||null,s=t?.timestampMetadata||{},c=this.#e.createBuffer({label:`marching-cubes-vertex-offsets`,size:(this.#n==null?Math.max(1,e.count):this.#n.getAlignedSize(e.count))*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),l=this.#e.createBindGroup({layout:this.#a.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:this.#c}},{binding:1,resource:H(e)},{binding:2,resource:{buffer:c}},{binding:3,resource:{buffer:this.#f}}]}),d=new Uint32Array([e.count]),f=new u(this.#e,Math.ceil(e.count/32),d.buffer);f.pushConstantsBuffer.label=`marching-cubes-vertex-count-push-constants`;let p=[f.pushConstantsBuffer],m=this.#e.createBindGroup({layout:this.#a.getBindGroupLayout(2),entries:[{binding:0,resource:{buffer:f.pushConstantsBuffer,size:12}}]}),h=Math.max(0,Math.round(Number(t?.clampVertexCount)||0)),g=r||this.#e.createCommandEncoder();g.clearBuffer(this.#f);let _=null,v=null;n||(_=this.#e.createBuffer({size:h>0?8:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),v=this.#e.createBuffer({size:16,usage:GPUBufferUsage.INDIRECT|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST|GPUBufferUsage.STORAGE}),this.#e.queue.writeBuffer(v,0,new Uint32Array([0,1,0,0])));let y=a?.beginComputePassDescriptor?.(`marchingCubesVertexCount`,s)||{};!a&&this.#y&&(y={timestampWrites:{querySet:this.#b,beginningOfPassWriteIndex:2,endOfPassWriteIndex:3}});let x=g.beginComputePass(y);if(x.setPipeline(this.#a),x.setBindGroup(0,this.#g),x.setBindGroup(1,l),e.indirectDispatchBuffer)x.setBindGroup(2,m,[0]),x.dispatchWorkgroupsIndirect(e.indirectDispatchBuffer,Math.max(0,Math.round(Number(e.indirectDispatchOffsetBytes)||0)));else for(let e=0;e<f.numDispatches();++e)x.setBindGroup(2,m,[e*f.stride]),x.dispatchWorkgroups(f.dispatchSize(e),1,1);if(x.end(),n?g.copyBufferToBuffer(this.#f,0,this.#m,0,4):(g.copyBufferToBuffer(this.#f,0,_,0,4),g.copyBufferToBuffer(this.#f,0,v,0,4)),!n&&h>0){if(!this.#p){let e=await o(this.#e,b,`clamp_vertex_draw_count.wgsl`);this.#p=this.#e.createComputePipeline({layout:`auto`,compute:{module:e,entryPoint:`main`}})}let e=this.#e.createBuffer({label:`marching-cubes-vertex-clamp-params`,size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});p.push(e),this.#e.queue.writeBuffer(e,0,new Uint32Array([h,0,0,0]));let t=this.#e.createBindGroup({layout:this.#p.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.#f}},{binding:1,resource:{buffer:v}},{binding:2,resource:{buffer:_}},{binding:3,resource:{buffer:e}}]}),n=g.beginComputePass(a?.beginComputePassDescriptor?.(`marchingCubesVertexCountClamp`,s)||{});n.setPipeline(this.#p),n.setBindGroup(0,t),n.dispatchWorkgroups(1),n.end()}if(r??(this.#e.queue.submit([g.finish()]),I(p)),!n){let e=new U(i,c);return e.vertexCountMode=`conservative-upper-bound`,e.actualVertexCounterBuffer=_,e.actualVertexCounterBufferByteLength=h>0?8:4,e.drawIndirectBuffer=v,e.drawIndirectBufferByteLength=16,e.encodingTemporaryResources=r==null?[]:p,e}await this.#m.mapAsync(GPUMapMode.READ);let S=new Uint32Array(this.#m.getMappedRange())[0];return this.#m.unmap(),new U(S,c)}async computeVertices(e,t,n={}){let r=n?.waitForCompletion!==!1,i=M(n?.commandEncoder);if(i!=null&&r)throw Object.assign(Error(`an external command encoder requires waitForCompletion: false`),{status:`external-command-encoder-cannot-wait-before-submit`});let a=n?.writeTimestamps!==!1,o=n?.timestampProfiler||null,s=n?.timestampMetadata||{},c=this.#e.createBuffer({size:t.count*4*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_SRC}),l=this.#e.createBuffer({size:t.count*D,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_SRC}),d=this.#e.createBindGroup({layout:this.#o.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:this.#c}},{binding:1,resource:H(e)},{binding:2,resource:{buffer:t.buffer}},{binding:3,resource:{buffer:c}},{binding:4,resource:{buffer:l}}]}),f=new Uint32Array([e.count]),p=new u(this.#e,Math.ceil(e.count/32),f.buffer);p.pushConstantsBuffer.label=`marching-cubes-vertex-emission-push-constants`;let m=[p.pushConstantsBuffer],h=this.#e.createBindGroup({layout:this.#a.getBindGroupLayout(2),entries:[{binding:0,resource:{buffer:p.pushConstantsBuffer,size:12}}]}),g=i||this.#e.createCommandEncoder(),_=o?.beginComputePassDescriptor?.(`marchingCubesVertexEmit`,s)||{};!o&&this.#y&&a&&(_={timestampWrites:{querySet:this.#b,beginningOfPassWriteIndex:4,endOfPassWriteIndex:5}});let v=g.beginComputePass(_);if(v.setPipeline(this.#o),v.setBindGroup(0,this.#g),v.setBindGroup(1,d),e.indirectDispatchBuffer)v.setBindGroup(2,h,[0]),v.dispatchWorkgroupsIndirect(e.indirectDispatchBuffer,Math.max(0,Math.round(Number(e.indirectDispatchOffsetBytes)||0)));else for(let e=0;e<p.numDispatches();++e)v.setBindGroup(2,h,[e*p.stride]),v.dispatchWorkgroups(p.dispatchSize(e),1,1);return v.end(),this.#y&&a&&(g.resolveQuerySet(this.#b,0,6,this.#x,0),g.copyBufferToBuffer(this.#x,0,this.#S,0,this.#x.size)),i??(this.#e.queue.submit([g.finish()]),r&&await this.#e.queue.onSubmittedWorkDone(),I(m)),{positionBuffer:c,normalBuffer:l,normalBufferByteLength:t.count*D,encodingTemporaryResources:i==null?[]:m}}};export{G as MarchingCubes};