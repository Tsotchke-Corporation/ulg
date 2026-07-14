const INDIRECT_ARGS_SCHEMA = 'peercompute.ulg.sph-native-webgpu-indirect-args-validation.v0';

function surfaceMaterial(surfaceKey) {
  const parts = String(surfaceKey || '').split('|');
  return String(parts[1] || parts[0] || '').trim().toLowerCase();
}

function normalizeDraw(draw = {}) {
  const args = Array.isArray(draw.args)
    ? draw.args.slice(0, 4).map((value) => Math.max(0, Math.round(Number(value) || 0)))
    : [0, 0, 0, 0];
  while (args.length < 4) args.push(0);
  const vertexCount = args[0];
  const instanceCount = args[1];
  return {
    ...draw,
    args,
    vertexCount,
    triangleCount: Math.floor(vertexCount / 3),
    instanceCount,
    firstVertex: args[2],
    firstInstance: args[3],
    drawable: vertexCount > 0 && instanceCount > 0
  };
}

function normalizeExpectedProductMaterials(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean))];
}

export function summarizeNativeSurfaceIndirectArgsReadback(readback = null, {
  expectedProductMaterials = readback?.expectedProductMaterials ?? []
} = {}) {
  const expectedProducts = normalizeExpectedProductMaterials(expectedProductMaterials);
  if (readback?.status !== 'ready') {
    return {
      schema: INDIRECT_ARGS_SCHEMA,
      status: readback?.status ?? 'not-run',
      reason: readback?.reason ?? 'native surface indirect readback was unavailable',
      args: null,
      draws: [],
      primaryStatus: 'missing',
      secondaryStatus: 'missing',
      productStatus: expectedProducts.length > 0 ? 'expected-products-missing' : 'missing',
      expectedProductMaterials: expectedProducts,
      attachedProductMaterials: [],
      missingExpectedProductMaterials: expectedProducts
    };
  }
  const draws = Array.isArray(readback.draws)
    ? readback.draws.map(normalizeDraw)
    : [];
  const primaryDraws = draws.filter((draw) => draw.source === 'primary');
  const primaryDrawableDraws = primaryDraws.filter((draw) => draw.drawable);
  const primary = primaryDrawableDraws[0] || primaryDraws[0] || null;
  const additionalDraws = draws.filter((draw) => draw.source === 'additional');
  const productDraws = additionalDraws.filter((draw) => {
    const material = surfaceMaterial(draw.surfaceKey);
    return material === 'naoh' || material === 'h2';
  });
  const attachedProductMaterials = [...new Set(productDraws.map((draw) => (
    surfaceMaterial(draw.surfaceKey)
  )))];
  const missingExpectedProductMaterials = expectedProducts.filter((material) => (
    !attachedProductMaterials.includes(material)
  ));
  const drawableDrawCount = draws.filter((draw) => draw.drawable).length;
  const additionalDrawableDrawCount = additionalDraws.filter((draw) => draw.drawable).length;
  const productDrawableDrawCount = productDraws.filter((draw) => draw.drawable).length;
  const primaryDrawableDrawCount = primaryDrawableDraws.length;
  const primaryStatus = primaryDraws.length === 0
    ? 'missing'
    : (primaryDraws.length === 1
        ? (primaryDrawableDrawCount === 1 ? 'drawable' : 'empty')
        : (primaryDrawableDrawCount === primaryDraws.length
            ? 'all-primary-drawable'
            : (primaryDrawableDrawCount > 0 ? 'partial-primary-drawable' : 'all-primary-empty')));
  const secondaryStatus = additionalDraws.length === 0
    ? 'missing'
    : (additionalDrawableDrawCount > 0 ? 'has-drawable-secondary' : 'all-empty');
  const productStatus = expectedProducts.length > 0
    ? (missingExpectedProductMaterials.length === expectedProducts.length
        ? 'expected-products-missing'
        : (missingExpectedProductMaterials.length > 0
            ? 'some-expected-products-missing'
            : (productDrawableDrawCount === productDraws.length
                ? 'all-expected-products-drawable'
                : (productDrawableDrawCount > 0
                    ? 'partial-expected-products-drawable'
                    : 'all-expected-products-empty'))))
    : (productDraws.length === 0
        ? 'missing'
        : (productDrawableDrawCount === productDraws.length
            ? 'all-attached-products-drawable'
            : (productDrawableDrawCount > 0
                ? 'partial-attached-products-drawable'
                : 'all-attached-products-empty')));
  const aggregateIndirectVertexCount = draws.reduce(
    (sum, draw) => sum + draw.vertexCount,
    0
  );
  const aggregateIndirectTriangleCount = draws.reduce(
    (sum, draw) => sum + draw.triangleCount,
    0
  );
  const submittedVertexInstanceCount = draws.reduce(
    (sum, draw) => sum + (draw.drawable ? draw.vertexCount * draw.instanceCount : 0),
    0
  );
  const submittedTriangleInstanceCount = draws.reduce(
    (sum, draw) => sum + (draw.drawable ? draw.triangleCount * draw.instanceCount : 0),
    0
  );
  return {
    schema: INDIRECT_ARGS_SCHEMA,
    status: primaryDrawableDrawCount > 0 ? 'passed' : 'failed',
    reason: primaryDrawableDrawCount > 0
      ? `native bridge primary is drawable; product status=${productStatus}`
      : `native bridge primary status=${primaryStatus}; product status=${productStatus}`,
    args: primary?.args ?? null,
    vertexCount: primary?.vertexCount ?? 0,
    instanceCount: primary?.instanceCount ?? 0,
    firstVertex: primary?.firstVertex ?? 0,
    firstInstance: primary?.firstInstance ?? 0,
    primaryStatus,
    primaryDrawCount: primaryDraws.length,
    primaryDrawableDrawCount,
    primaryZeroDrawCount: primaryDraws.length - primaryDrawableDrawCount,
    secondaryStatus,
    productStatus,
    expectedProductMaterials: expectedProducts,
    attachedProductMaterials,
    missingExpectedProductMaterials,
    drawCount: draws.length,
    drawableDrawCount,
    zeroDrawCount: draws.length - drawableDrawCount,
    additionalDrawCount: additionalDraws.length,
    additionalDrawableDrawCount,
    additionalZeroDrawCount: additionalDraws.length - additionalDrawableDrawCount,
    productDrawCount: productDraws.length,
    productDrawableDrawCount,
    aggregateIndirectVertexCount,
    aggregateIndirectTriangleCount,
    submittedVertexInstanceCount,
    submittedTriangleInstanceCount,
    readbackByteLength: Math.max(0, Math.round(Number(readback.readbackByteLength) || 0)),
    queueSubmitCount: Math.max(0, Math.round(Number(readback.queueSubmitCount) || 0)),
    mapAsyncCount: Math.max(0, Math.round(Number(readback.mapAsyncCount) || 0)),
    draws
  };
}
