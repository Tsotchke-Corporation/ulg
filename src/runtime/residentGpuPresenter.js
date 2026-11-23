/**
 * Zero-Copy Resident GPU Buffer Presenter for `three/webgpu` (`THREE.WebGPURenderer`).
 *
 * Binds a host-owned, epoch-fenced resident `GPUBuffer` (interleaved 8-float
 * `[x, y, z, mass, vx, vy, vz, radius]` ABI from `ResidentModuleBufferSession`)
 * directly into an `InstancedBufferGeometry` + `MeshBasicNodeMaterial` (TSL)
 * without a single byte of CPU `mapAsync` readback per frame.
 *
 * Falls back cleanly to a CPU-synced `THREE.InstancedMesh` when WebGPU
 * presentation is unavailable.
 */

export const ULG_RESIDENT_GPU_PRESENTER_SCHEMA = 'peercompute.ulg.resident-gpu-presenter.v1';

export async function loadThreeWebGpuAndTsl() {
  const [THREE, TSL] = await Promise.all([import('three/webgpu'), import('three/tsl')]);
  return { THREE, TSL };
}

export function createZeroCopyResidentBodyPresenter({
  THREE,
  TSL = null,
  renderer = null,
  bodyCount,
  palette = 'galactic',
  tintColor = null,
  particleScale = null,
  initialBuffer = null,
  baseGeometry = null
} = {}) {
  const count = Math.max(1, Math.floor(Number(bodyCount) || 1));
  const canZeroCopy = Boolean(
    renderer?.isWebGPURenderer
    && typeof renderer?.backend?.get === 'function'
    && TSL
    && initialBuffer
    && typeof THREE?.InstancedInterleavedBuffer === 'function'
    && typeof THREE?.MeshBasicNodeMaterial === 'function'
  );

  let zeroCopyBoundFrames = 0;
  let cpuSyncedFrames = 0;
  let boundGpuBuffer = null;

  if (canZeroCopy) {
    const srcGeo = baseGeometry || new THREE.IcosahedronGeometry(1, 0);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = srcGeo.index;
    geo.attributes.position = srcGeo.attributes.position;
    if (srcGeo.attributes.normal) geo.attributes.normal = srcGeo.attributes.normal;
    geo.instanceCount = count;

    // 1-row placeholder CPU view; actual backing storage is the resident GPUBuffer injected below.
    const interleaved = new THREE.InstancedInterleavedBuffer(new Float32Array(8), 8, 1);
    interleaved.count = count;
    const posMassAttr = new THREE.InterleavedBufferAttribute(interleaved, 4, 0, false);
    const velRadiusAttr = new THREE.InterleavedBufferAttribute(interleaved, 4, 4, false);
    geo.setAttribute('aPosMass', posMassAttr);
    geo.setAttribute('aVelRadius', velRadiusAttr);

    const backendEntry = renderer.backend.get(interleaved);
    backendEntry.buffer = initialBuffer;
    boundGpuBuffer = initialBuffer;

    const {
      attribute,
      positionLocal,
      vec3,
      float,
      length,
      clamp,
      pow,
      select
    } = TSL;

    const aPosMass = attribute('aPosMass', 'vec4');
    const pos = aPosMass.xyz;
    const mass = aPosMass.w;
    const radiusDist = length(pos);
    const alive = mass.greaterThan(float(0.0));

    let starScale;
    let starColor;
    if (palette === 'continuum-material') {
      const tr = Number.isFinite(tintColor?.[0]) ? tintColor[0] : 0.78;
      const tg = Number.isFinite(tintColor?.[1]) ? tintColor[1] : 0.85;
      const tb = Number.isFinite(tintColor?.[2]) ? tintColor[2] : 0.92;
      const baseSc = Number.isFinite(particleScale) ? particleScale : 0.11;
      const aVelRadius = attribute('aVelRadius', 'vec4');
      const speed = length(aVelRadius.xyz);
      const speedBoost = clamp(speed.mul(float(0.10)), float(0.0), float(0.24));
      const rad = clamp(aVelRadius.w, float(0.04), float(0.26));
      const rim = clamp(positionLocal.y.mul(float(0.32)).add(float(0.82)), float(0.50), float(1.18));
      starScale = select(alive, rad.mul(float(baseSc / 0.11)), float(0.0));
      starColor = vec3(
        clamp(float(tr).mul(rim).add(speedBoost), float(0.0), float(1.0)),
        clamp(float(tg).mul(rim).add(speedBoost), float(0.0), float(1.0)),
        clamp(float(tb).mul(rim).add(speedBoost), float(0.0), float(1.0))
      );
    } else if (palette === 'cosmic-web') {
      const mNorm = clamp(mass.div(float(5.5)), float(0.0), float(1.0));
      const rawScale = float(0.026).add(pow(mNorm, float(0.72)).mul(float(0.068)));
      starScale = select(alive, rawScale, float(0.0));
      starColor = vec3(
        float(0.34).add(mNorm.mul(float(0.66))),
        float(0.24).add(mNorm.mul(float(0.56))),
        float(0.96).sub(mNorm.mul(float(0.52)))
      );
    } else {
      // Galactic astrophysics palette: SMBH core -> warm golden bulge -> vivid sapphire-cyan arms
      const isCore = mass.greaterThan(float(20.0));
      const isBulge = radiusDist.lessThan(float(2.4));
      const bulgeMass = clamp(mass.div(float(0.25)), float(0.0), float(1.0));
      const armHot = clamp(mass.div(float(0.18)), float(0.0), float(1.0));

      const armScale = float(0.020).add(armHot.mul(float(0.026)));
      const bulgeScale = float(0.028).add(bulgeMass.mul(float(0.022)));
      const nonCoreScale = select(isBulge, bulgeScale, armScale);
      const rawScale = select(isCore, float(0.24), nonCoreScale);
      starScale = select(alive, rawScale, float(0.0));

      const armCol = vec3(
        float(0.24).add(float(1.0).sub(armHot).mul(float(0.64))),
        float(0.62).add(armHot.mul(float(0.30))),
        float(1.0)
      );
      const bulgeCol = vec3(float(1.0), float(0.74), float(0.32));
      const coreCol = vec3(float(1.0), float(0.95), float(0.80));
      starColor = select(isCore, coreCol, select(isBulge, bulgeCol, armCol));
    }

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.positionNode = positionLocal.mul(starScale).add(pos);
    mat.colorNode = starColor;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;

    function bindResidentBuffer(gpuBuffer) {
      if (!gpuBuffer) return false;
      renderer.backend.get(interleaved).buffer = gpuBuffer;
      boundGpuBuffer = gpuBuffer;
      zeroCopyBoundFrames += 1;
      return true;
    }

    function bindLeaseHandle(leaseHandle) {
      if (!leaseHandle || typeof leaseHandle.isCurrent !== 'function' || !leaseHandle.isCurrent()) {
        return false;
      }
      return bindResidentBuffer(leaseHandle.buffer);
    }

    return {
      schema: ULG_RESIDENT_GPU_PRESENTER_SCHEMA,
      mode: 'webgpu-zero-copy-storage-vertex',
      zeroCopy: true,
      readbackBytesPerFrame: 0,
      mesh,
      count,
      bindResidentBuffer,
      bindLeaseHandle,
      syncFromCpuBodies: () => false,
      getStats() {
        return {
          mode: 'webgpu-zero-copy-storage-vertex',
          zeroCopy: true,
          count,
          readbackBytesPerFrame: 0,
          zeroCopyBoundFrames,
          cpuSyncedFrames,
          hasBoundBuffer: Boolean(boundGpuBuffer)
        };
      },
      dispose() {
        geo.dispose();
        mat.dispose();
      }
    };
  }

  // Graceful fallback: CPU-updated InstancedMesh (for WebGL2 or CPU-fallback engines)
  const geo = baseGeometry || new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  function syncFromCpuBodies(bodies) {
    if (!bodies) return false;
    const n = Math.min(count, Math.floor(bodies.length / 8));
    for (let i = 0; i < n; i += 1) {
      const b = i * 8;
      const x = bodies[b];
      const y = bodies[b + 1];
      const z = bodies[b + 2];
      const mass = bodies[b + 3];
      dummy.position.set(x, y, z);
      if (!(mass > 0)) {
        dummy.scale.setScalar(0);
      } else if (palette === 'continuum-material') {
        const tr = Number.isFinite(tintColor?.[0]) ? tintColor[0] : 0.78;
        const tg = Number.isFinite(tintColor?.[1]) ? tintColor[1] : 0.85;
        const tb = Number.isFinite(tintColor?.[2]) ? tintColor[2] : 0.92;
        const baseSc = Number.isFinite(particleScale) ? particleScale : 0.11;
        const rad = Math.max(0.04, Math.min(0.26, bodies[b + 7] || baseSc));
        const sp = Math.min(0.25, Math.hypot(bodies[b + 4], bodies[b + 5], bodies[b + 6]) * 0.12);
        dummy.scale.setScalar(rad * (baseSc / 0.11));
        color.setRGB(Math.min(1, tr + sp), Math.min(1, tg + sp), Math.min(1, tb + sp));
      } else if (palette === 'cosmic-web') {
        const mNorm = Math.min(1, mass / 5.5);
        dummy.scale.setScalar(0.026 + 0.068 * Math.pow(mNorm, 0.72));
        color.setRGB(0.34 + 0.66 * mNorm, 0.24 + 0.56 * mNorm, 0.96 - 0.52 * mNorm);
      } else {
        const r = Math.hypot(x, y, z);
        if (i === 0 || mass > 20) {
          dummy.scale.setScalar(0.24);
          color.setRGB(1.0, 0.95, 0.80);
        } else if (r < 2.4) {
          dummy.scale.setScalar(0.030 + 0.022 * Math.min(1, mass / 0.25));
          color.setRGB(1.0, 0.74, 0.32);
        } else {
          const hot = Math.min(1, mass / 0.18);
          dummy.scale.setScalar(0.022 + 0.028 * hot);
          color.setRGB(0.24 + 0.64 * (1 - hot), 0.62 + 0.30 * hot, 1.0);
        }
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    cpuSyncedFrames += 1;
    return true;
  }

  return {
    schema: ULG_RESIDENT_GPU_PRESENTER_SCHEMA,
    mode: 'cpu-instanced-fallback',
    zeroCopy: false,
    readbackBytesPerFrame: count * 32,
    mesh,
    count,
    bindResidentBuffer: () => false,
    bindLeaseHandle: () => false,
    syncFromCpuBodies,
    getStats() {
      return {
        mode: 'cpu-instanced-fallback',
        zeroCopy: false,
        count,
        readbackBytesPerFrame: count * 32,
        zeroCopyBoundFrames,
        cpuSyncedFrames,
        hasBoundBuffer: false
      };
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    }
  };
}
