import { inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_PNG_DIMENSION = 4096;
const MAX_PNG_PIXEL_COUNT = 4 * 1024 * 1024;
export const MAX_PHYSICAL_PIXEL_PNG_BYTE_LENGTH = 32 * 1024 * 1024;
const MAX_PNG_CHUNK_COUNT = 16_384;
const MAX_PNG_CHUNK_BYTE_LENGTH = 16 * 1024 * 1024;
const DISTINCT_COLOR_LIMIT = 4096;
const MIN_SURFACE_NON_DOMINANT_PIXEL_COUNT = 16;
const MIN_SURFACE_NON_DOMINANT_PIXEL_RATIO = 0.005;

const PNG_CRC_TABLE = Object.freeze(Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return value >>> 0;
}));

function pngCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  return upDistance <= upLeftDistance ? up : upLeft;
}

function invalidPng(reason, details = {}) {
  return Object.freeze({ status: 'invalid', reason, ...details });
}

/**
 * Decode the conservative PNG subset emitted by Chrome's CDP screenshot API.
 * Acceptance derives from decoded pixels, never from page-authored metrics.
 */
export function decodePhysicalPixelPng(bytes, { includeRgbaPixels = false } = {}) {
  if (
    !Buffer.isBuffer(bytes)
    || bytes.byteLength < 45
    || !bytes.subarray(0, PNG_SIGNATURE.byteLength).equals(PNG_SIGNATURE)
  ) {
    return invalidPng('not-a-complete-png');
  }
  if (bytes.byteLength > MAX_PHYSICAL_PIXEL_PNG_BYTE_LENGTH) {
    return invalidPng('png-byte-length-exceeds-limit');
  }
  let offset = PNG_SIGNATURE.byteLength;
  let header = null;
  let sawImageEnd = false;
  let chunkCount = 0;
  const imageDataChunks = [];
  try {
    while (offset < bytes.byteLength) {
      chunkCount += 1;
      if (chunkCount > MAX_PNG_CHUNK_COUNT) {
        return invalidPng('png-chunk-count-exceeds-limit');
      }
      if (offset + 12 > bytes.byteLength) {
        return invalidPng('truncated-png-chunk');
      }
      const length = bytes.readUInt32BE(offset);
      if (length > MAX_PNG_CHUNK_BYTE_LENGTH) {
        return invalidPng('png-chunk-byte-length-exceeds-limit');
      }
      const typeBytes = bytes.subarray(offset + 4, offset + 8);
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd + 4 > bytes.byteLength) {
        return invalidPng('truncated-png-chunk-data');
      }
      const data = bytes.subarray(dataStart, dataEnd);
      if (bytes.readUInt32BE(dataEnd) !== pngCrc32(Buffer.concat([typeBytes, data]))) {
        return invalidPng('png-crc-mismatch');
      }
      const type = typeBytes.toString('ascii');
      if (
        !/^[A-Za-z]{4}$/u.test(type)
        || (typeBytes[2] & 0x20) !== 0
      ) {
        return invalidPng('png-chunk-type-invalid');
      }
      if (header == null) {
        if (type !== 'IHDR' || length !== 13) {
          return invalidPng('png-ihdr-missing-or-misordered');
        }
        header = {
          width: data.readUInt32BE(0),
          height: data.readUInt32BE(4),
          bitDepth: data[8],
          colorType: data[9],
          compression: data[10],
          filter: data[11],
          interlace: data[12]
        };
        const channels = new Map([[0, 1], [2, 3], [4, 2], [6, 4]])
          .get(header.colorType);
        const pixelCount = header.width * header.height;
        if (
          !Number.isSafeInteger(header.width)
          || !Number.isSafeInteger(header.height)
          || header.width <= 0
          || header.height <= 0
          || header.width > MAX_PNG_DIMENSION
          || header.height > MAX_PNG_DIMENSION
          || !Number.isSafeInteger(pixelCount)
          || pixelCount > MAX_PNG_PIXEL_COUNT
          || header.bitDepth !== 8
          || channels == null
          || header.compression !== 0
          || header.filter !== 0
          || header.interlace !== 0
        ) {
          return invalidPng('png-layout-unsupported');
        }
        header.channels = channels;
        header.pixelCount = pixelCount;
      } else if (type === 'IHDR') {
        return invalidPng('png-ihdr-repeated');
      } else if (type === 'IDAT') {
        imageDataChunks.push(data);
      } else if (type === 'IEND') {
        if (length !== 0 || sawImageEnd) return invalidPng('png-iend-invalid');
        sawImageEnd = true;
        offset = dataEnd + 4;
        if (offset !== bytes.byteLength) return invalidPng('png-data-after-iend');
        break;
      } else if (type === 'tRNS') {
        // Chrome compositor screenshots are expected to be opaque. Supporting
        // tRNS without applying it would let hidden RGB values masquerade as
        // visible surface content.
        return invalidPng('png-transparency-chunk-unsupported');
      } else if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') {
        return invalidPng('png-animation-chunk-unsupported');
      } else {
        // The attestation intentionally accepts only the minimal static PNG
        // subset emitted by Chrome's screenshot encoder. Metadata chunks are
        // unnecessary for decoded compositor-pixel evidence and fail closed.
        return invalidPng(
          (typeBytes[0] & 0x20) === 0
            ? 'png-unknown-critical-chunk'
            : 'png-ancillary-chunk-unsupported'
        );
      }
      offset = dataEnd + 4;
    }
    if (!sawImageEnd || offset !== bytes.byteLength || header == null) {
      return invalidPng('png-iend-missing-or-trailing-data');
    }
    const channels = header.channels;
    const pixelCount = header.pixelCount;
    if (imageDataChunks.length === 0) {
      return invalidPng('png-layout-unsupported');
    }
    const rowBytes = header.width * channels;
    const expectedLength = (rowBytes + 1) * header.height;
    const compressed = Buffer.concat(imageDataChunks);
    const inflatedResult = inflateSync(compressed, {
      info: true,
      maxOutputLength: expectedLength
    });
    const inflated = inflatedResult.buffer;
    if (inflatedResult.engine?.bytesWritten !== compressed.byteLength) {
      return invalidPng('png-idat-trailing-compressed-bytes');
    }
    if (inflated.byteLength !== expectedLength) {
      return invalidPng('png-inflated-length-mismatch');
    }

    const rgbaPixels = includeRgbaPixels ? Buffer.alloc(pixelCount * 4) : null;
    let previous = Buffer.alloc(rowBytes);
    let nontransparentPixelCount = 0;
    let nonblackPixelCount = 0;
    let minR = 255;
    let maxR = 0;
    let minG = 255;
    let maxG = 0;
    let minB = 255;
    let maxB = 0;
    let minAlpha = 255;
    let maxAlpha = 0;
    const colorCounts = new Map();
    let distinctColorCountCapped = false;
    for (let y = 0; y < header.height; y += 1) {
      const rowOffset = y * (rowBytes + 1);
      const filter = inflated[rowOffset];
      if (filter > 4) return invalidPng('png-filter-unsupported');
      const source = inflated.subarray(rowOffset + 1, rowOffset + 1 + rowBytes);
      const row = Buffer.alloc(rowBytes);
      for (let index = 0; index < rowBytes; index += 1) {
        const left = index >= channels ? row[index - channels] : 0;
        const up = previous[index] ?? 0;
        const upLeft = index >= channels ? previous[index - channels] ?? 0 : 0;
        const predictor = filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paethPredictor(left, up, upLeft) : 0;
        row[index] = (source[index] + predictor) & 0xff;
      }
      for (let x = 0; x < header.width; x += 1) {
        const sourceOffset = x * channels;
        const r = row[sourceOffset];
        const g = header.colorType === 0 || header.colorType === 4
          ? r
          : row[sourceOffset + 1];
        const b = header.colorType === 0 || header.colorType === 4
          ? r
          : row[sourceOffset + 2];
        const alpha = header.colorType === 4
          ? row[sourceOffset + 1]
          : (header.colorType === 6 ? row[sourceOffset + 3] : 255);
        if (alpha > 0) nontransparentPixelCount += 1;
        if (alpha > 0 && (r > 0 || g > 0 || b > 0)) nonblackPixelCount += 1;
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minG = Math.min(minG, g);
        maxG = Math.max(maxG, g);
        minB = Math.min(minB, b);
        maxB = Math.max(maxB, b);
        minAlpha = Math.min(minAlpha, alpha);
        maxAlpha = Math.max(maxAlpha, alpha);
        if (rgbaPixels) {
          const targetOffset = (y * header.width + x) * 4;
          rgbaPixels[targetOffset] = r;
          rgbaPixels[targetOffset + 1] = g;
          rgbaPixels[targetOffset + 2] = b;
          rgbaPixels[targetOffset + 3] = alpha;
        }
        const key = `${r},${g},${b},${alpha}`;
        if (colorCounts.has(key)) {
          colorCounts.set(key, colorCounts.get(key) + 1);
        } else if (colorCounts.size < DISTINCT_COLOR_LIMIT) {
          colorCounts.set(key, 1);
        } else {
          distinctColorCountCapped = true;
        }
      }
      previous = row;
    }
    const distinctColorCount = colorCounts.size;
    const dominantColorPixelCount = distinctColorCountCapped
      ? null
      : Math.max(...colorCounts.values());
    const nonDominantPixelCountLowerBound = distinctColorCountCapped
      ? Math.max(0, distinctColorCount - 1)
      : Math.max(0, pixelCount - dominantColorPixelCount);
    const nonDominantPixelRatioLowerBound = pixelCount > 0
      ? nonDominantPixelCountLowerBound / pixelCount
      : 0;
    const spatialChannelSpan = Math.max(
      maxR - minR,
      maxG - minG,
      maxB - minB
    );
    const hasSurfaceLikeVariation = Boolean(
      distinctColorCount >= 4
      && spatialChannelSpan >= 8
    );
    const fullyOpaque = minAlpha === 255 && maxAlpha === 255;
    return Object.freeze({
      status: 'ready',
      width: header.width,
      height: header.height,
      bitDepth: header.bitDepth,
      colorType: header.colorType,
      pixelCount,
      nontransparentPixelCount,
      nonblackPixelCount,
      minR,
      maxR,
      minG,
      maxG,
      minB,
      maxB,
      minAlpha,
      maxAlpha,
      spatialChannelSpan,
      distinctColorCount,
      distinctColorCountCapped,
      dominantColorPixelCount,
      nonDominantPixelCountLowerBound,
      nonDominantPixelRatioLowerBound,
      fullyOpaque,
      hasVisiblePixels: nontransparentPixelCount > 0 && nonblackPixelCount > 0,
      hasSurfaceLikeVariation,
      hasVisibleSurfaceContent: Boolean(
        fullyOpaque
        && nontransparentPixelCount > 0
        && nonblackPixelCount > 0
        && hasSurfaceLikeVariation
        && nonDominantPixelCountLowerBound
          >= MIN_SURFACE_NON_DOMINANT_PIXEL_COUNT
        && nonDominantPixelRatioLowerBound
          >= MIN_SURFACE_NON_DOMINANT_PIXEL_RATIO
      ),
      rgbaPixels: rgbaPixels || undefined
    });
  } catch (error) {
    return invalidPng(
      error instanceof Error ? error.message : String(error)
    );
  }
}

export function publicPhysicalPixelPngMetrics(decoded) {
  if (decoded?.status !== 'ready') return decoded;
  const { rgbaPixels: _rgbaPixels, ...metrics } = decoded;
  return Object.freeze(metrics);
}

export function comparePhysicalPixelPngFrames(
  referenceBytes,
  candidateBytes,
  {
    minChannelDelta = 2,
    minChangedPixelCount = 8,
    minChangedPixelRatio = 0.001,
    minChangedBoundsWidth = 2,
    minChangedBoundsHeight = 2
  } = {}
) {
  const reference = decodePhysicalPixelPng(referenceBytes, {
    includeRgbaPixels: true
  });
  const candidate = decodePhysicalPixelPng(candidateBytes, {
    includeRgbaPixels: true
  });
  if (
    reference?.status !== 'ready'
    || candidate?.status !== 'ready'
    || !reference.rgbaPixels
    || !candidate.rgbaPixels
  ) {
    return Object.freeze({
      schema: 'peercompute.ulg.physical-pixel-compositor-frame-delta.v1',
      status: 'invalid',
      reason: `reference=${reference?.status ?? 'missing'}; candidate=${candidate?.status ?? 'missing'}`,
      reference: publicPhysicalPixelPngMetrics(reference),
      candidate: publicPhysicalPixelPngMetrics(candidate)
    });
  }
  if (
    reference.width !== candidate.width
    || reference.height !== candidate.height
    || reference.rgbaPixels.byteLength !== candidate.rgbaPixels.byteLength
  ) {
    return Object.freeze({
      schema: 'peercompute.ulg.physical-pixel-compositor-frame-delta.v1',
      status: 'dimension-mismatch',
      reason: `reference=${reference.width}x${reference.height}; candidate=${candidate.width}x${candidate.height}`,
      reference: publicPhysicalPixelPngMetrics(reference),
      candidate: publicPhysicalPixelPngMetrics(candidate)
    });
  }
  const threshold = Math.max(1, Math.min(255, Math.round(Number(minChannelDelta) || 1)));
  const minimumChanged = Math.max(
    1,
    Math.round(Number(minChangedPixelCount) || 1)
  );
  const minimumChangedRatio = Math.max(
    0,
    Math.min(1, Number(minChangedPixelRatio) || 0)
  );
  const minimumBoundsWidth = Math.max(
    1,
    Math.round(Number(minChangedBoundsWidth) || 1)
  );
  const minimumBoundsHeight = Math.max(
    1,
    Math.round(Number(minChangedBoundsHeight) || 1)
  );
  let changedPixelCount = 0;
  let maxChannelDelta = 0;
  let totalChangedChannelDelta = 0;
  let minX = reference.width;
  let minY = reference.height;
  let maxX = -1;
  let maxY = -1;
  for (let pixelIndex = 0; pixelIndex < reference.pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    const redDelta = Math.abs(
      reference.rgbaPixels[offset] - candidate.rgbaPixels[offset]
    );
    const greenDelta = Math.abs(
      reference.rgbaPixels[offset + 1] - candidate.rgbaPixels[offset + 1]
    );
    const blueDelta = Math.abs(
      reference.rgbaPixels[offset + 2] - candidate.rgbaPixels[offset + 2]
    );
    const pixelMaxDelta = Math.max(redDelta, greenDelta, blueDelta);
    maxChannelDelta = Math.max(maxChannelDelta, pixelMaxDelta);
    if (pixelMaxDelta < threshold) continue;
    changedPixelCount += 1;
    totalChangedChannelDelta += redDelta + greenDelta + blueDelta;
    const x = pixelIndex % reference.width;
    const y = Math.floor(pixelIndex / reference.width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const changedPixelRatio = reference.pixelCount > 0
    ? changedPixelCount / reference.pixelCount
    : 0;
  const changedBounds = changedPixelCount > 0
    ? Object.freeze({
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      })
    : null;
  return Object.freeze({
    schema: 'peercompute.ulg.physical-pixel-compositor-frame-delta.v1',
    status: 'ready',
    reason: null,
    width: reference.width,
    height: reference.height,
    pixelCount: reference.pixelCount,
    minChannelDelta: threshold,
    minChangedPixelCount: minimumChanged,
    minChangedPixelRatio: minimumChangedRatio,
    minChangedBoundsWidth: minimumBoundsWidth,
    minChangedBoundsHeight: minimumBoundsHeight,
    changedPixelCount,
    changedPixelRatio,
    maxChannelDelta,
    meanChangedRgbChannelDelta: changedPixelCount > 0
      ? totalChangedChannelDelta / (changedPixelCount * 3)
      : 0,
    changedBounds,
    reference: publicPhysicalPixelPngMetrics(reference),
    candidate: publicPhysicalPixelPngMetrics(candidate),
    visibleContentAdvanced: Boolean(
      reference.hasVisibleSurfaceContent
      && candidate.hasVisibleSurfaceContent
      && changedPixelCount >= minimumChanged
      && changedPixelRatio >= minimumChangedRatio
      && maxChannelDelta >= threshold
      && changedBounds?.width >= minimumBoundsWidth
      && changedBounds?.height >= minimumBoundsHeight
    )
  });
}
