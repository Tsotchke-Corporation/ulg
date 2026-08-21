import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SPH_REACTION_STRICT_GATE_BLOCKER,
  SPH_REACTION_STRICT_GATE_INDEX,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION,
  SPH_REACTION_STRICT_GATE_STATUS,
  SPH_REACTION_STRICT_GATE_VERSION,
  validateSphReactionStrictGateControl
} from '../ulg-gpu-abi/src/sphReactionStrictGate.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_REACTION_STRICT_GATE === '1';
const NATIVE_BASE_URL = process.env.ULG_REACTION_STRICT_GATE_BASE_URL
  || 'https://127.0.0.1:5174/';
const NATIVE_CHROME = process.env.ULG_REACTION_STRICT_GATE_CHROME
  || '/usr/bin/google-chrome';
const NATIVE_ADAPTER_ATTEMPT_LIMIT = 3;
const NATIVE_ADAPTER_BACKOFF_MS = 150;

const NATIVE_TEST_NAME =
  'native reaction strict-gate v2 compiles and rejects replay, collision, layout, and signed-zero aliases';
const NATIVE_SKIP_REASON =
  'set ULG_RUN_NATIVE_REACTION_STRICT_GATE=1 for native Vulkan WebGPU';

test(NATIVE_TEST_NAME, {
  skip: RUN_NATIVE ? false : NATIVE_SKIP_REASON,
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: NATIVE_CHROME,
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async ({
      adapterAttemptLimit,
      adapterBackoffMs
    }) => {
      const gpu = navigator.gpu ?? null;
      const adapterAttempts = [];
      const browserContext = {
        isSecureContext: globalThis.isSecureContext === true,
        origin: globalThis.location?.origin ?? null,
        userAgent: navigator.userAgent
      };
      if (!gpu) {
        return {
          status: 'navigator-gpu-unavailable',
          reason: 'navigator.gpu is unavailable',
          adapterAttempts,
          browserContext
        };
      }
      let adapter = null;
      for (let attempt = 1; attempt <= adapterAttemptLimit; attempt += 1) {
        const startedAtMs = performance.now();
        let error = null;
        try {
          adapter = await gpu.requestAdapter({
            powerPreference: 'high-performance'
          });
        } catch (caught) {
          error = caught?.message || String(caught);
        }
        adapterAttempts.push({
          attempt,
          durationMs: performance.now() - startedAtMs,
          status: adapter ? 'available' : (error ? 'rejected' : 'null'),
          error
        });
        if (adapter) break;
        if (attempt < adapterAttemptLimit) {
          await new Promise((resolve) => {
            setTimeout(resolve, adapterBackoffMs * attempt);
          });
        }
      }
      if (!adapter) {
        return {
          status: 'adapter-unavailable',
          reason: `WebGPU adapter unavailable after ${adapterAttemptLimit} bounded attempts`,
          adapterAttempts,
          browserContext
        };
      }
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const nonce = Date.now();
      const [wgslModule, abi] = await Promise.all([
        import(`/ulg-gpu-abi/src/sphReactionStrictGateWgsl.js?nativeStrictGate=${nonce}`),
        import(`/ulg-gpu-abi/src/sphReactionStrictGate.js?nativeStrictGate=${nonce}`)
      ]);
      const shaderModule = device.createShaderModule({
        label: 'native-reaction-strict-gate-v2',
        code: wgslModule.sphReactionStrictGateFinalizeWgsl
      });
      const compilationInfo = await shaderModule.getCompilationInfo();
      const compilationErrors = compilationInfo.messages
        .filter((message) => message.type === 'error')
        .map((message) => ({
          lineNum: message.lineNum,
          linePos: message.linePos,
          message: message.message
        }));
      if (compilationErrors.length > 0) {
        return { status: 'compile-failed', compilationErrors, adapterAttempts };
      }

      let pipeline;
      try {
        pipeline = await device.createComputePipelineAsync({
          label: 'native-reaction-strict-gate-v2',
          layout: 'auto',
          compute: {
            module: shaderModule,
            entryPoint: 'finalize_reaction_strict_gate'
          }
        });
      } catch (error) {
        return {
          status: 'pipeline-failed',
          compilationErrors,
          adapterAttempts,
          error: error?.message || String(error)
        };
      }

      const asU32Words = (values) => values instanceof Uint32Array
        ? values
        : new Uint32Array(
            values.buffer,
            values.byteOffset,
            values.byteLength / Uint32Array.BYTES_PER_ELEMENT
          );
      const storageBuffer = (label, values, usage = 0) => {
        const words = asU32Words(values);
        const buffer = device.createBuffer({
          label,
          size: words.byteLength,
          usage: GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_DST
            | GPUBufferUsage.COPY_SRC
            | usage
        });
        device.queue.writeBuffer(buffer, 0, words);
        return buffer;
      };
      const authorityFor = (residualValues) => {
        const authority = new Float32Array(residualValues.length);
        for (let offset = 0; offset < residualValues.length; offset += 8) {
          authority.set([
            residualValues[offset],
            residualValues[offset + 5],
            residualValues[offset + 6],
            residualValues[offset + 1],
            1,
            1,
            0,
            residualValues[offset + 7]
          ], offset);
        }
        return authority;
      };
      const receiptFor = ({
        residualEvidence,
        termAuthority,
        shadowWords,
        reactionCount,
        atomTermCount,
        atomResidualCapacity = atomTermCount,
        atomTermCapacity = atomTermCount
      }) => abi.createSphReactionStrictGateProducerReceipt({
        atomResidualValues: residualEvidence,
        atomTermValues: termAuthority,
        producerShadowWords: shadowWords,
        sourceGeneration: 17,
        completionGeneration: 18,
        seal: 19,
        reactionCount,
        atomTermCount,
        atomResidualCapacity,
        atomTermCapacity,
        producerSequence: 20
      });
      const paramsFor = ({
        reactionCount,
        atomTermCount,
        atomResidualCapacity = atomTermCount,
        atomTermCapacity = atomTermCount,
        atomResidualToleranceMol = 1e-6,
        chargeResidualToleranceMol = 1e-6
      }) => abi.createSphReactionStrictGateFinalizeParams({
        reactionCount,
        atomTermCount,
        atomResidualCapacity,
        atomTermCapacity,
        expectedSourceGeneration: 17,
        expectedCompletionGeneration: 18,
        expectedSeal: 19,
        atomResidualToleranceMol,
        chargeResidualToleranceMol
      });
      const runCase = async ({
        id,
        residualBinding,
        termBinding,
        shadowWords,
        receiptWords,
        paramsWords,
        cpuBlockerFlags = null
      }) => {
        const residualBuffer = storageBuffer(`${id}-residual`, residualBinding);
        const termBuffer = storageBuffer(`${id}-term`, termBinding);
        const receiptBuffer = storageBuffer(`${id}-receipt`, receiptWords);
        const gateBuffer = device.createBuffer({
          label: `${id}-gate`,
          size: abi.SPH_REACTION_STRICT_GATE_BYTES,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });
        const paramsBuffer = device.createBuffer({
          label: `${id}-params`,
          size: paramsWords.byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(paramsBuffer, 0, paramsWords);
        const shadowBuffer = storageBuffer(`${id}-shadow`, shadowWords);
        const readbackBuffer = device.createBuffer({
          label: `${id}-readback`,
          size: abi.SPH_REACTION_STRICT_GATE_BYTES,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const bindGroup = device.createBindGroup({
          label: `${id}-bind-group`,
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: residualBuffer } },
            { binding: 1, resource: { buffer: termBuffer } },
            { binding: 2, resource: { buffer: receiptBuffer } },
            { binding: 3, resource: { buffer: gateBuffer } },
            { binding: 4, resource: { buffer: paramsBuffer } },
            { binding: 5, resource: { buffer: shadowBuffer } }
          ]
        });
        const encoder = device.createCommandEncoder({ label: `${id}-encoder` });
        const pass = encoder.beginComputePass({ label: `${id}-pass` });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(1);
        pass.end();
        encoder.copyBufferToBuffer(
          gateBuffer,
          0,
          readbackBuffer,
          0,
          abi.SPH_REACTION_STRICT_GATE_BYTES
        );
        device.queue.submit([encoder.finish()]);
        await readbackBuffer.mapAsync(GPUMapMode.READ);
        const controlWords = Array.from(new Uint32Array(
          readbackBuffer.getMappedRange().slice(0)
        ));
        readbackBuffer.unmap();
        for (const buffer of [
          residualBuffer,
          termBuffer,
          receiptBuffer,
          gateBuffer,
          paramsBuffer,
          shadowBuffer,
          readbackBuffer
        ]) buffer.destroy();
        return {
          id,
          controlWords,
          receiptWords: Array.from(receiptWords),
          cpuBlockerFlags
        };
      };

      const canonicalResidual = new Float32Array([
        0, 1, 0, 0, 1, 1, 0, 1,
        0, 1, 0, 0, 1, 2, 0, 1
      ]);
      const canonicalTerm = authorityFor(canonicalResidual);
      const canonicalShadow = abi.createSphReactionStrictGateProducerShadow({
        atomResidualValues: canonicalResidual,
        atomTermValues: canonicalTerm,
        atomTermCount: 2
      });
      const canonicalReceipt = receiptFor({
        residualEvidence: canonicalResidual,
        termAuthority: canonicalTerm,
        shadowWords: canonicalShadow,
        reactionCount: 1,
        atomTermCount: 2
      });
      const canonicalParams = paramsFor({ reactionCount: 1, atomTermCount: 2 });
      const cpuBlockersForReceipt = (producerReceipt) =>
        abi.finalizeSphReactionStrictGateCpu({
          atomResidualValues: canonicalResidual,
          atomTermValues: canonicalTerm,
          producerShadowWords: canonicalShadow,
          producerReceipt,
          atomResidualCapacity: 2,
          atomTermCapacity: 2,
          reactionCount: 1,
          atomTermCount: 2,
          expectedSourceGeneration: 17,
          expectedCompletionGeneration: 18,
          expectedSeal: 19
        }).blockerFlags;
      const mutateReceipt = (index, value) => {
        const receipt = canonicalReceipt.slice();
        receipt[index] = value;
        return receipt;
      };
      const receiptParityCases = [
        {
          id: 'receipt-status-not-ready',
          receiptWords: mutateReceipt(
            abi.SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.statusFlags,
            abi.SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS.BLOCKED
              | abi.SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS.FAIL_CLOSED
          )
        },
        {
          id: 'receipt-blocker-present',
          receiptWords: mutateReceipt(
            abi.SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.blockerFlags,
            abi.SPH_REACTION_STRICT_GATE_BLOCKER.PROBLEM_ROW
          )
        },
        {
          id: 'receipt-producer-sequence-zero',
          receiptWords: mutateReceipt(
            abi.SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.producerSequence,
            0
          )
        },
        {
          id: 'receipt-source-generation-zero',
          receiptWords: mutateReceipt(
            abi.SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.sourceGeneration,
            0
          )
        },
        {
          id: 'receipt-seal-zero',
          receiptWords: mutateReceipt(
            abi.SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.seal,
            0
          )
        },
        {
          id: 'receipt-short-binding',
          receiptWords: Uint32Array.of(0)
        }
      ];

      const collidingResidual = new Float32Array([
        0, 1, 0, 0, 24, 1, 0, 1,
        0, 1, 0, 0, 384, 2, 0, 1
      ]);
      const collidingTerm = new Float32Array([
        0, 1, 0, 1, 1, 1, -999935, 1,
        0, 2, 0, 1, 1, 1, 969331, 1
      ]);
      const oversizedResidual = new Uint32Array(canonicalResidual.length + 1);
      oversizedResidual.set(asU32Words(canonicalResidual));

      const signedZeroResidual = new Float32Array([
        -0, 1, 0, 0, 1, 1, 0, 1
      ]);
      const signedZeroTerm = new Float32Array([
        0, 1, 0, 1, 1, 1, 0, 1
      ]);
      const signedZeroShadow = abi.createSphReactionStrictGateProducerShadow({
        atomResidualValues: signedZeroResidual,
        atomTermValues: signedZeroTerm,
        atomTermCount: 1
      });
      const signedZeroReceipt = receiptFor({
        residualEvidence: signedZeroResidual,
        termAuthority: signedZeroTerm,
        shadowWords: signedZeroShadow,
        reactionCount: 1,
        atomTermCount: 1
      });

      const looseResidual = new Float32Array([
        0, 1, 0.5, 0, 1, 1, 0, 1
      ]);
      const looseTerm = authorityFor(looseResidual);
      const looseShadow = abi.createSphReactionStrictGateProducerShadow({
        atomResidualValues: looseResidual,
        atomTermValues: looseTerm,
        atomTermCount: 1
      });
      const looseReceipt = receiptFor({
        residualEvidence: looseResidual,
        termAuthority: looseTerm,
        shadowWords: looseShadow,
        reactionCount: 1,
        atomTermCount: 1
      });

      const emptyResidual = new Float32Array();
      const emptyTerm = new Float32Array();
      const emptyShadow = abi.createSphReactionStrictGateProducerShadow({
        atomResidualValues: emptyResidual,
        atomTermValues: emptyTerm,
        atomTermCount: 0
      });
      const emptyReceipt = receiptFor({
        residualEvidence: emptyResidual,
        termAuthority: emptyTerm,
        shadowWords: emptyShadow,
        reactionCount: 0,
        atomTermCount: 0
      });

      const roundingResidual = new Float32Array([
        0, 1, Math.fround(1 + 2 ** -23), 0, 1, 1, 0, 1,
        0, 1, 2 ** -24, 0, 1, 2, 0, 1
      ]);
      const roundingTerm = authorityFor(roundingResidual);
      const roundingShadow = abi.createSphReactionStrictGateProducerShadow({
        atomResidualValues: roundingResidual,
        atomTermValues: roundingTerm,
        atomTermCount: 2
      });
      const roundingReceipt = receiptFor({
        residualEvidence: roundingResidual,
        termAuthority: roundingTerm,
        shadowWords: roundingShadow,
        reactionCount: 1,
        atomTermCount: 2
      });

      const minimumSubnormal = new Float32Array(Uint32Array.of(1).buffer)[0];
      const subnormalResidual = new Float32Array([
        0, 1, minimumSubnormal, 0, 1, 1, 0, 1
      ]);
      const subnormalTerm = authorityFor(subnormalResidual);
      const subnormalShadow = abi.createSphReactionStrictGateProducerShadow({
        atomResidualValues: subnormalResidual,
        atomTermValues: subnormalTerm,
        atomTermCount: 1
      });
      const subnormalReceipt = receiptFor({
        residualEvidence: subnormalResidual,
        termAuthority: subnormalTerm,
        shadowWords: subnormalShadow,
        reactionCount: 1,
        atomTermCount: 1
      });

      const maximumFinite = new Float32Array(
        Uint32Array.of(0x7f7f_ffff).buffer
      )[0];
      const overflowResidual = new Float32Array([
        0, 1, maximumFinite, 0, 1, 1, 0, 1,
        0, 1, maximumFinite, 0, 1, 2, 0, 1
      ]);
      const overflowTerm = authorityFor(overflowResidual);
      const overflowShadow = abi.createSphReactionStrictGateProducerShadow({
        atomResidualValues: overflowResidual,
        atomTermValues: overflowTerm,
        atomTermCount: 2
      });
      const overflowReceipt = receiptFor({
        residualEvidence: overflowResidual,
        termAuthority: overflowTerm,
        shadowWords: overflowShadow,
        reactionCount: 1,
        atomTermCount: 2
      });

      const cases = [];
      cases.push(await runCase({
        id: 'canonical-pass',
        residualBinding: canonicalResidual,
        termBinding: canonicalTerm,
        shadowWords: canonicalShadow,
        receiptWords: canonicalReceipt,
        paramsWords: canonicalParams
      }));
      cases.push(await runCase({
        id: 'fnv-collision',
        residualBinding: collidingResidual,
        termBinding: collidingTerm,
        shadowWords: canonicalShadow,
        receiptWords: canonicalReceipt,
        paramsWords: canonicalParams
      }));
      cases.push(await runCase({
        id: 'oversized-binding',
        residualBinding: oversizedResidual,
        termBinding: canonicalTerm,
        shadowWords: canonicalShadow,
        receiptWords: canonicalReceipt,
        paramsWords: canonicalParams
      }));
      cases.push(await runCase({
        id: 'zero-sentinel',
        residualBinding: Uint32Array.of(0),
        termBinding: Uint32Array.of(0),
        shadowWords: emptyShadow,
        receiptWords: emptyReceipt,
        paramsWords: paramsFor({ reactionCount: 0, atomTermCount: 0 })
      }));
      cases.push(await runCase({
        id: 'signed-zero-identity',
        residualBinding: signedZeroResidual,
        termBinding: signedZeroTerm,
        shadowWords: signedZeroShadow,
        receiptWords: signedZeroReceipt,
        paramsWords: paramsFor({ reactionCount: 1, atomTermCount: 1 })
      }));
      cases.push(await runCase({
        id: 'loose-tolerance-replay',
        residualBinding: looseResidual,
        termBinding: looseTerm,
        shadowWords: looseShadow,
        receiptWords: looseReceipt,
        paramsWords: paramsFor({
          reactionCount: 1,
          atomTermCount: 1,
          atomResidualToleranceMol: 1,
          chargeResidualToleranceMol: 1
        })
      }));
      cases.push(await runCase({
        id: 'round-to-nearest-tie',
        residualBinding: roundingResidual,
        termBinding: roundingTerm,
        shadowWords: roundingShadow,
        receiptWords: roundingReceipt,
        paramsWords: paramsFor({
          reactionCount: 1,
          atomTermCount: 2,
          atomResidualToleranceMol: Math.fround(1 + 2 ** -23)
        })
      }));
      cases.push(await runCase({
        id: 'minimum-subnormal',
        residualBinding: subnormalResidual,
        termBinding: subnormalTerm,
        shadowWords: subnormalShadow,
        receiptWords: subnormalReceipt,
        paramsWords: paramsFor({
          reactionCount: 1,
          atomTermCount: 1,
          atomResidualToleranceMol: 0
        })
      }));
      cases.push(await runCase({
        id: 'binary32-overflow',
        residualBinding: overflowResidual,
        termBinding: overflowTerm,
        shadowWords: overflowShadow,
        receiptWords: overflowReceipt,
        paramsWords: paramsFor({
          reactionCount: 1,
          atomTermCount: 2,
          atomResidualToleranceMol: maximumFinite
        })
      }));
      for (const receiptCase of receiptParityCases) {
        cases.push(await runCase({
          id: receiptCase.id,
          residualBinding: canonicalResidual,
          termBinding: canonicalTerm,
          shadowWords: canonicalShadow,
          receiptWords: receiptCase.receiptWords,
          paramsWords: canonicalParams,
          cpuBlockerFlags: cpuBlockersForReceipt(receiptCase.receiptWords)
        }));
      }

      await device.queue.onSubmittedWorkDone();
      return {
        status: 'ok',
        adapterAttempts,
        compilationErrors,
        cases,
        validationError: (await device.popErrorScope())?.message || null,
        uncapturedErrors
      };
    }, {
      adapterAttemptLimit: NATIVE_ADAPTER_ATTEMPT_LIMIT,
      adapterBackoffMs: NATIVE_ADAPTER_BACKOFF_MS
    });
    if (
      native?.status === 'navigator-gpu-unavailable'
      || native?.status === 'adapter-unavailable'
    ) {
      let chromeGpuDiagnostics;
      let cdpSession = null;
      try {
        cdpSession = await browser.newBrowserCDPSession();
        const systemInfo = await cdpSession.send('SystemInfo.getInfo');
        const gpu = systemInfo?.gpu ?? {};
        chromeGpuDiagnostics = {
          browserVersion: browser.version(),
          modelName: systemInfo?.modelName ?? null,
          modelVersion: systemInfo?.modelVersion ?? null,
          devices: Array.isArray(gpu.devices)
            ? gpu.devices.slice(0, 4).map((device) => ({
                vendorId: device.vendorId ?? null,
                deviceId: device.deviceId ?? null,
                vendorString: device.vendorString ?? null,
                deviceString: device.deviceString ?? null,
                driverVendor: device.driverVendor ?? null,
                driverVersion: device.driverVersion ?? null
              }))
            : [],
          featureStatus: gpu.featureStatus ?? null,
          auxAttributes: {
            glRenderer: gpu.auxAttributes?.glRenderer ?? null,
            glVendor: gpu.auxAttributes?.glVendor ?? null,
            displayType: gpu.auxAttributes?.displayType ?? null,
            passthroughCmdDecoder: gpu.auxAttributes?.passthroughCmdDecoder ?? null
          }
        };
      } catch (error) {
        chromeGpuDiagnostics = {
          browserVersion: browser.version(),
          diagnosticError: error?.message || String(error)
        };
      } finally {
        await cdpSession?.detach().catch(() => {});
      }
      native = { ...native, chromeGpuDiagnostics };
    }
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'ok', JSON.stringify(native));
  assert.deepEqual(native.compilationErrors, []);
  assert.equal(native.validationError, null, JSON.stringify(native));
  assert.deepEqual(native.uncapturedErrors, []);
  const byId = Object.fromEntries(native.cases.map((result) => [result.id, result]));
  const blockerFlags = (id) => byId[id].controlWords[3] >>> 0;
  const statusFlags = (id) => byId[id].controlWords[2] >>> 0;

  assert.equal(blockerFlags('canonical-pass'), 0);
  assert.notEqual(
    statusFlags('canonical-pass') & SPH_REACTION_STRICT_GATE_STATUS.PASS,
    0
  );
  assert.notEqual(
    blockerFlags('fnv-collision')
      & SPH_REACTION_STRICT_GATE_BLOCKER.BITWISE_SHADOW_MISMATCH,
    0
  );
  assert.notEqual(
    blockerFlags('fnv-collision')
      & SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE,
    0
  );
  assert.notEqual(
    blockerFlags('oversized-binding')
      & SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH,
    0
  );
  assert.notEqual(
    blockerFlags('oversized-binding')
      & SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE,
    0
  );
  assert.equal(blockerFlags('zero-sentinel'), 0);
  assert.notEqual(
    statusFlags('zero-sentinel') & SPH_REACTION_STRICT_GATE_STATUS.PASS,
    0
  );
  assert.notEqual(
    blockerFlags('signed-zero-identity')
      & SPH_REACTION_STRICT_GATE_BLOCKER.PROBLEM_ROW,
    0
  );
  assert.equal(
    blockerFlags('signed-zero-identity')
      & SPH_REACTION_STRICT_GATE_BLOCKER.BITWISE_SHADOW_MISMATCH,
    0
  );
  assert.equal(blockerFlags('loose-tolerance-replay'), 0);
  assert.notEqual(
    blockerFlags('round-to-nearest-tie')
      & SPH_REACTION_STRICT_GATE_BLOCKER.ATOM_RESIDUAL_OUT_OF_TOLERANCE,
    0
  );
  assert.equal(
    byId['round-to-nearest-tie'].controlWords[
      SPH_REACTION_STRICT_GATE_INDEX.maxAbsAtomResidualMol
    ] >>> 0,
    0x3f80_0002
  );
  assert.notEqual(
    blockerFlags('minimum-subnormal')
      & SPH_REACTION_STRICT_GATE_BLOCKER.ATOM_RESIDUAL_OUT_OF_TOLERANCE,
    0
  );
  assert.equal(
    byId['minimum-subnormal'].controlWords[
      SPH_REACTION_STRICT_GATE_INDEX.maxAbsAtomResidualMol
    ] >>> 0,
    1
  );
  assert.notEqual(
    blockerFlags('binary32-overflow')
      & SPH_REACTION_STRICT_GATE_BLOCKER.NONFINITE_EVIDENCE,
    0
  );
  const receiptParityExpectations = {
    'receipt-status-not-ready': {
      blockers: (
        SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
        | SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH
      ) >>> 0,
      readyRows: 0,
      problemRows: 2
    },
    'receipt-blocker-present': {
      blockers: (
        SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
        | SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH
      ) >>> 0,
      readyRows: 0,
      problemRows: 2
    },
    'receipt-producer-sequence-zero': {
      blockers: (
        SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
        | SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH
      ) >>> 0,
      readyRows: 0,
      problemRows: 2
    },
    'receipt-source-generation-zero': {
      blockers: (
        SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
        | SPH_REACTION_STRICT_GATE_BLOCKER.GENERATION_MISMATCH
      ) >>> 0,
      readyRows: 2,
      problemRows: 0
    },
    'receipt-seal-zero': {
      blockers: (
        SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
        | SPH_REACTION_STRICT_GATE_BLOCKER.SEAL_MISMATCH
      ) >>> 0,
      readyRows: 2,
      problemRows: 0
    },
    'receipt-short-binding': {
      blockers: (
        SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
        | SPH_REACTION_STRICT_GATE_BLOCKER.GENERATION_MISMATCH
        | SPH_REACTION_STRICT_GATE_BLOCKER.SEAL_MISMATCH
        | SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH
      ) >>> 0,
      readyRows: 0,
      problemRows: 2
    }
  };
  for (const [id, expected] of Object.entries(receiptParityExpectations)) {
    assert.equal(blockerFlags(id), expected.blockers, id);
    assert.equal(byId[id].cpuBlockerFlags, expected.blockers, `${id}-cpu`);
    assert.equal(
      byId[id].controlWords[SPH_REACTION_STRICT_GATE_INDEX.readyRowCount] >>> 0,
      expected.readyRows,
      `${id}-ready-rows`
    );
    assert.equal(
      byId[id].controlWords[SPH_REACTION_STRICT_GATE_INDEX.problemRowCount] >>> 0,
      expected.problemRows,
      `${id}-problem-rows`
    );
  }

  const looseReplay = byId['loose-tolerance-replay'];
  const strictValidation = validateSphReactionStrictGateControl(
    Uint32Array.from(looseReplay.controlWords),
    {
      sourceGeneration: 17,
      completionGeneration: 18,
      seal: 19,
      reactionCount: 1,
      atomTermCount: 1,
      atomResidualCapacity: 1,
      atomTermCapacity: 1,
      atomResidualStrideVec4: 2,
      atomTermStrideVec4: 2,
      atomResidualToleranceMol: 1e-6,
      chargeResidualToleranceMol: 1e-6,
      gateVersion: SPH_REACTION_STRICT_GATE_VERSION,
      producerReceiptVersion: SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION,
      producerReceipt: Uint32Array.from(looseReplay.receiptWords)
    }
  );
  assert.equal(strictValidation.authorityBound, true);
  assert.equal(strictValidation.pass, false);
  assert.ok(strictValidation.reasons.includes('atomResidualToleranceMol-mismatch'));
  assert.ok(strictValidation.reasons.includes('chargeResidualToleranceMol-mismatch'));
});
