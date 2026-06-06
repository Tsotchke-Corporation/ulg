#!/usr/bin/env node
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const defaultUrl = process.env.ULG_LIVE_URL || 'http://100.86.83.35:5173/';
const url = valueFor('--url') || defaultUrl;
const timeoutMs = Number(valueFor('--timeout-ms') || process.env.ULG_LIVE_TIMEOUT_MS || 15000);
const bridge = args.includes('--bridge');

function valueFor(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
  await page.waitForFunction(
    () => window.__ulgDemo?.telemetry?.services?.length >= 2,
    null,
    { timeout: timeoutMs }
  );
  await page.waitForFunction(
    () => window.__ulgDemo?.telemetry?.artifacts?.length >= 2,
    null,
    { timeout: timeoutMs }
  );

  const status = await page.evaluate(async ({ bridgeRequested }) => {
    const telemetry = window.__ulgDemo.telemetry;
    const services = telemetry.services.map((service) => ({
      serviceId: service.serviceId,
      status: service.status,
      assetStatus: service.assetProbe?.status || null
    }));
    const artifacts = telemetry.artifacts.map((record) => ({
      sourceService: record.ref.sourceService,
      artifactKind: record.artifactKind,
      uri: record.ref.uri,
      summary: record.artifactSummary
    }));
    const moonlab = artifacts.find((record) => record.sourceService === 'moonlab')?.summary || null;
    const eshkol = artifacts.find((record) => record.sourceService === 'eshkol')?.summary || null;
    const handoff = await window.__ulgDemo.createPeerComputeHandoff();
    let bridgeAck = null;
    let bridgeError = null;
    if (bridgeRequested) {
      try {
        bridgeAck = await window.__ulgDemo.launchPeerComputeMagnetarDemo();
      } catch (error) {
        bridgeError = String(error?.message || error);
      }
    }

    return {
      schema: 'ulg.live-status.v0',
      url: window.location.href,
      serviceCount: services.length,
      artifactCount: artifacts.length,
      services,
      handoff: {
        schema: handoff.schema,
        artifactCount: handoff.artifactCount,
        artifactKinds: handoff.artifacts.map((artifact) => artifact.artifactKind),
        sourceServices: handoff.artifacts.map((artifact) => artifact.ref.sourceService)
      },
      moonlab: {
        webGpuParityScopeReady: moonlab?.moonlabWebGpuParityScopeReady ?? null,
        probabilityKernelProbeDeclared: moonlab?.moonlabWebGpuProbabilityKernelProbeDeclared ?? null,
        probabilityKernel: moonlab?.moonlabWebGpuProbabilityKernel ?? null,
        probabilityKernelExecuted: moonlab?.moonlabWebGpuProbabilityKernelExecuted ?? null,
        probabilityKernelPassed: moonlab?.moonlabWebGpuProbabilityKernelPassed ?? null,
        magnetarReferenceReady: moonlab?.magnetarReferenceReady ?? null,
        magnetarCalibratedReferenceReadyCount: moonlab?.magnetarCalibratedReferenceReadyCount ?? null
      },
      eshkol: {
        descriptorReady: eshkol?.closureDescriptorReady ?? null,
        tensorRuntimeContractReady: eshkol?.closureTensorRuntimeContractReady ?? null,
        productionHandlerBoundaryDeclared: eshkol?.closureProductionHandlerBoundaryDeclared ?? null,
        productionHandlerReady: eshkol?.closureProductionHandlerReady ?? null,
        productionHandlerRuntimeExecution: eshkol?.closureProductionHandlerRuntimeExecution ?? null
      },
      bridge: bridgeRequested ? {
        ack: bridgeAck,
        error: bridgeError
      } : null
    };
  }, { bridgeRequested: bridge });

  console.log(JSON.stringify(status, null, 2));
  if (bridge && status.bridge?.error) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
