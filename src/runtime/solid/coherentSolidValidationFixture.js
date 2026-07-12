import {
  COHERENT_SOLID_CONTACT_PROXY_WORDS,
  COHERENT_SOLID_FRAME_WORDS,
  COHERENT_SOLID_MEMBER_WORDS,
  COHERENT_SOLID_REST_VERTEX_FLOATS,
  COHERENT_SOLID_ROW_STATUS_ACTIVE,
  ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
  ULG_COHERENT_SOLID_REST_MESH_SCHEMA,
  ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA
} from '../../../ulg-gpu-abi/src/coherentSolid.js';

const BOX_FACES = Object.freeze([
  { normal: [1, 0, 0], corners: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { normal: [-1, 0, 0], corners: [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]] },
  { normal: [0, 1, 0], corners: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]] },
  { normal: [0, -1, 0], corners: [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]] },
  { normal: [0, 0, 1], corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { normal: [0, 0, -1], corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] }
]);

const COMPONENTS = Object.freeze([
  {
    center: [-0.5, 0, 0],
    size: [7, 2, 2],
    color: [0.12, 0.86, 0.72],
    excludedContactNormals: ['1,0,0'],
    contactAreaAdjustmentsM2: { '0,-1,0': -1.5 }
  },
  {
    center: [4, 1.5, 0],
    size: [2, 5, 3],
    color: [0.96, 0.36, 0.22],
    excludedContactNormals: [],
    contactAreaAdjustmentsM2: { '-1,0,0': -4 }
  },
  {
    center: [-3.25, -1.5, 0.25],
    size: [1.5, 1, 1],
    color: [0.98, 0.82, 0.22],
    excludedContactNormals: ['0,1,0'],
    contactAreaAdjustmentsM2: {}
  }
]);

function f32Bits(value) {
  return new Uint32Array(new Float32Array([value]).buffer)[0];
}

function volume(size) {
  return size[0] * size[1] * size[2];
}

function weightedCenter(components) {
  const total = components.reduce((sum, component) => sum + volume(component.size), 0);
  const center = [0, 0, 0];
  for (const component of components) {
    const weight = volume(component.size);
    for (let axis = 0; axis < 3; axis += 1) {
      center[axis] += component.center[axis] * weight / total;
    }
  }
  return center;
}

function translatedComponents() {
  const centerOfMass = weightedCenter(COMPONENTS);
  return {
    centerOfMass,
    components: COMPONENTS.map((component) => ({
      ...component,
      center: component.center.map((value, axis) => value - centerOfMass[axis])
    }))
  };
}

function appendBoxMesh(vertices, indices, component) {
  const [sx, sy, sz] = component.size.map((value) => value * 0.5);
  for (const face of BOX_FACES) {
    const firstVertex = vertices.length / COHERENT_SOLID_REST_VERTEX_FLOATS;
    const shade = 0.72 + 0.28 * Math.max(0, face.normal[1] * 0.6 + face.normal[2] * 0.4);
    for (const corner of face.corners) {
      vertices.push(
        component.center[0] + corner[0] * sx,
        component.center[1] + corner[1] * sy,
        component.center[2] + corner[2] * sz,
        0,
        face.normal[0],
        face.normal[1],
        face.normal[2],
        0,
        component.color[0] * shade,
        component.color[1] * shade,
        component.color[2] * shade,
        1
      );
    }
    indices.push(
      firstVertex + 0,
      firstVertex + 1,
      firstVertex + 2,
      firstVertex + 0,
      firstVertex + 2,
      firstVertex + 3
    );
  }
}

function massSample(component, densityKgM3) {
  const massKg = volume(component.size) * densityKgM3;
  const [sx, sy, sz] = component.size;
  return {
    localPositionM: [...component.center],
    restVolumeM3: volume(component.size),
    massKg,
    localInertiaKgM2: [
      [massKg * (sy * sy + sz * sz) / 12, 0, 0],
      [0, massKg * (sx * sx + sz * sz) / 12, 0],
      [0, 0, massKg * (sx * sx + sy * sy) / 12]
    ]
  };
}

function contactSamples(components) {
  const samples = [];
  for (const [componentIndex, component] of components.entries()) {
    const half = component.size.map((value) => value * 0.5);
    const faceAreas = [
      component.size[1] * component.size[2],
      component.size[0] * component.size[2],
      component.size[0] * component.size[1]
    ];
    const directions = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1]
    ];
    for (const normal of directions) {
      const normalKey = normal.join(',');
      if (component.excludedContactNormals?.includes(normalKey)) continue;
      const axis = normal.findIndex((value) => value !== 0);
      const position = [...component.center];
      position[axis] += normal[axis] * half[axis];
      const areaWeightM2 = faceAreas[axis]
        + Number(component.contactAreaAdjustmentsM2?.[normalKey] || 0);
      samples.push({
        componentIndex,
        localPositionM: position,
        localNormal: normal,
        areaWeightM2,
        volumeWeightM3: volume(component.size) / 6,
        supportM: Math.min(...component.size) * 0.5
      });
    }
  }
  return samples;
}

export function createAsymmetricCoherentSolidFixture({
  geometryKey = 0x534f4c31,
  densityKgM3 = 1,
  materialId = 1,
  phaseId = 1,
  closureId = 1,
  pbrMaterialKey = 1
} = {}) {
  if (!Number.isFinite(densityKgM3) || densityKgM3 <= 0) {
    throw new RangeError('densityKgM3 must be positive and finite');
  }
  const { centerOfMass, components } = translatedComponents();
  const vertices = [];
  const indices = [];
  for (const component of components) appendBoxMesh(vertices, indices, component);
  const restVertices = new Float32Array(vertices);
  const triangleIndices = new Uint32Array(indices);
  const members = components.map((component) => massSample(component, densityKgM3));
  const proxies = contactSamples(components);
  return {
    schema: 'peercompute.ulg.schroeder-solid-asymmetric-validation-fixture.v0',
    status: 'asymmetric-persistent-rest-shape-ready',
    geometryKey,
    originalVolumeCentroidM: centerOfMass,
    restOriginPolicy: 'physical-center-of-mass',
    restMesh: {
      schema: ULG_COHERENT_SOLID_REST_MESH_SCHEMA,
      geometryKey,
      topologyGeneration: 1,
      vertexStrideFloats: COHERENT_SOLID_REST_VERTEX_FLOATS,
      vertexCount: restVertices.length / COHERENT_SOLID_REST_VERTEX_FLOATS,
      indexCount: triangleIndices.length,
      vertices: restVertices,
      indices: triangleIndices,
      topology: 'persistent-indexed-triangle-rest-mesh',
      updatePolicy: 'upload-once-transform-from-resident-frame'
    },
    shapeCarrier: {
      schema: ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA,
      carrierType: 'rest-frame-triangle-mesh',
      attachmentType: 'coherent-rigid-body-frame',
      geometryKey,
      topologyGeneration: 1,
      materialId,
      phaseId,
      closureId,
      pbrMaterialKey,
      visibleTopologySource: 'rest-mesh-not-particles-or-density-field'
    },
    materialMembers: members,
    contactSamples: proxies,
    totalMassKg: members.reduce((sum, member) => sum + member.massKg, 0),
    exposedBoundaryAreaM2: proxies.reduce((sum, proxy) => sum + proxy.areaWeightM2, 0),
    componentCount: components.length,
    contactSampleCount: proxies.length,
    asymmetryEvidence: {
      componentExtentsDiffer: true,
      reflectionSymmetryBroken: true,
      principalExtentsM: [9, 6, 3]
    }
  };
}

export function createAsymmetricContactProxyRows(fixture, {
  bodyIndex = 0,
  bodyId,
  componentGeneration,
  generationId,
  activeSsLevel = 0,
  topologyGeneration = 1,
  provenanceId = 0
} = {}) {
  for (const [label, value] of Object.entries({
    bodyIndex,
    bodyId,
    componentGeneration,
    generationId,
    topologyGeneration,
    provenanceId
  })) {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
      throw new RangeError(`${label} must be a u32`);
    }
  }
  const rows = new Uint32Array(
    fixture.contactSamples.length * COHERENT_SOLID_CONTACT_PROXY_WORDS
  );
  for (let index = 0; index < fixture.contactSamples.length; index += 1) {
    const sample = fixture.contactSamples[index];
    const base = index * COHERENT_SOLID_CONTACT_PROXY_WORDS;
    rows[base + 0] = bodyIndex;
    rows[base + 1] = bodyId;
    rows[base + 2] = index;
    rows[base + 3] = sample.componentIndex;
    rows[base + 4] = componentGeneration;
    rows[base + 5] = generationId;
    rows[base + 6] = activeSsLevel >>> 0;
    rows[base + 7] = COHERENT_SOLID_ROW_STATUS_ACTIVE;
    rows[base + 8] = f32Bits(sample.localPositionM[0]);
    rows[base + 9] = f32Bits(sample.localPositionM[1]);
    rows[base + 10] = f32Bits(sample.localPositionM[2]);
    rows[base + 12] = f32Bits(sample.localNormal[0]);
    rows[base + 13] = f32Bits(sample.localNormal[1]);
    rows[base + 14] = f32Bits(sample.localNormal[2]);
    rows[base + 15] = f32Bits(sample.areaWeightM2);
    rows[base + 16] = f32Bits(sample.volumeWeightM3);
    rows[base + 17] = f32Bits(sample.supportM);
    rows[base + 18] = 1;
    rows[base + 19] = 1;
    rows[base + 20] = 1;
    rows[base + 21] = 1;
    rows[base + 22] = fixture.geometryKey;
    rows[base + 23] = index;
    rows[base + 28] = topologyGeneration;
    rows[base + 29] = provenanceId;
    rows[base + 30] = COHERENT_SOLID_ROW_STATUS_ACTIVE;
  }
  return {
    schema: ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
    rows,
    proxyCount: fixture.contactSamples.length,
    strideWords: COHERENT_SOLID_CONTACT_PROXY_WORDS,
    generationId,
    topologyGeneration,
    ownership: 'body-local-contact-quadrature-independent-of-render-mesh-lod'
  };
}

function addMatrix(left, right) {
  return left.map((row, rowIndex) => row.map((value, columnIndex) => (
    value + right[rowIndex][columnIndex]
  )));
}

function pointInertia([x, y, z], mass) {
  return [
    [mass * (y * y + z * z), -mass * x * y, -mass * x * z],
    [-mass * y * x, mass * (x * x + z * z), -mass * y * z],
    [-mass * z * x, -mass * z * y, mass * (x * x + y * y)]
  ];
}

function invertMatrix3(matrix) {
  const [a, b, c] = matrix[0];
  const [d, e, f] = matrix[1];
  const [g, h, i] = matrix[2];
  const determinant = a * (e * i - f * h)
    - b * (d * i - f * g)
    + c * (d * h - e * g);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-20) {
    throw new RangeError('coherent-solid fixture inertia is singular');
  }
  return [
    [(e * i - f * h) / determinant, (c * h - b * i) / determinant, (b * f - c * e) / determinant],
    [(f * g - d * i) / determinant, (a * i - c * g) / determinant, (c * d - a * f) / determinant],
    [(d * h - e * g) / determinant, (b * g - a * h) / determinant, (a * e - b * d) / determinant]
  ];
}

export function createAsymmetricCoherentSolidGpuInputRows(fixture, {
  bodyId = 9001,
  componentGeneration = 1,
  generationId = 1,
  memberGenerationId = 1,
  leaseId = 41,
  leaseEpoch = 0,
  positionM = [0, 0, 0],
  orientation = [0, 0, 0, 1],
  linearMomentumKgMPerS = [0, 0, 0],
  angularMomentumKgM2PerS = [0, 0, 0],
  chartId = 0,
  levelId = 0,
  hierarchyGeneration = 1,
  positionEpoch = 1,
  approximationErrorBudget = 2e-4,
  temperatureK = 300,
  internalEnergyJ = 0,
  provenanceId = 77
} = {}) {
  let inertia = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const member of fixture.materialMembers) {
    inertia = addMatrix(
      inertia,
      addMatrix(member.localInertiaKgM2, pointInertia(member.localPositionM, member.massKg))
    );
  }
  const inverseInertia = invertMatrix3(inertia);
  const frameRows = new Uint32Array(COHERENT_SOLID_FRAME_WORDS);
  frameRows[0] = bodyId;
  frameRows[1] = componentGeneration;
  frameRows[2] = positionEpoch;
  frameRows[3] = 0;
  frameRows[4] = chartId;
  frameRows[5] = hierarchyGeneration;
  frameRows[6] = 0;
  frameRows[7] = 1;
  frameRows[8] = 1;
  frameRows[9] = generationId;
  frameRows[10] = leaseId;
  frameRows[11] = leaseEpoch;
  frameRows[12] = COHERENT_SOLID_ROW_STATUS_ACTIVE;
  for (let index = 0; index < 3; index += 1) frameRows[13 + index] = f32Bits(positionM[index]);
  for (let index = 0; index < 4; index += 1) frameRows[16 + index] = f32Bits(orientation[index]);
  for (let index = 0; index < 3; index += 1) frameRows[20 + index] = f32Bits(linearMomentumKgMPerS[index]);
  for (let index = 0; index < 3; index += 1) frameRows[24 + index] = f32Bits(angularMomentumKgM2PerS[index]);
  frameRows[28] = f32Bits(fixture.totalMassKg);
  frameRows[29] = f32Bits(temperatureK);
  frameRows[30] = f32Bits(internalEnergyJ);
  frameRows[31] = f32Bits(approximationErrorBudget);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      frameRows[[32, 36, 40][row] + column] = f32Bits(inertia[row][column]);
      frameRows[[44, 48, 52][row] + column] = f32Bits(inverseInertia[row][column]);
    }
  }
  frameRows[56] = fixture.shapeCarrier.materialId ?? 0;
  frameRows[57] = fixture.shapeCarrier.phaseId ?? 0;
  frameRows[58] = fixture.shapeCarrier.closureId ?? 0;
  frameRows[60] = fixture.geometryKey;
  frameRows[61] = 1;
  frameRows[62] = 1;
  frameRows[63] = fixture.geometryKey;
  frameRows[64] = fixture.restMesh.topologyGeneration;
  frameRows[65] = 1;
  frameRows[70] = 1;
  frameRows[71] = provenanceId;
  frameRows[75] = f32Bits(1);
  frameRows[76] = 1;
  frameRows[78] = 1;
  frameRows[79] = COHERENT_SOLID_ROW_STATUS_ACTIVE;

  const memberCount = fixture.materialMembers.length;
  const memberRows = new Uint32Array(memberCount * COHERENT_SOLID_MEMBER_WORDS);
  for (let index = 0; index < memberCount; index += 1) {
    const member = fixture.materialMembers[index];
    const base = index * COHERENT_SOLID_MEMBER_WORDS;
    memberRows[base + 0] = 0;
    memberRows[base + 1] = bodyId;
    memberRows[base + 2] = 500 + index;
    memberRows[base + 3] = componentGeneration;
    memberRows[base + 4] = memberGenerationId;
    memberRows[base + 5] = provenanceId;
    memberRows[base + 6] = fixture.shapeCarrier.materialId ?? 0;
    memberRows[base + 7] = fixture.shapeCarrier.phaseId ?? 0;
    for (let axis = 0; axis < 3; axis += 1) {
      memberRows[base + 8 + axis] = f32Bits(member.localPositionM[axis]);
    }
    memberRows[base + 11] = f32Bits(member.restVolumeM3);
    memberRows[base + 12] = f32Bits(member.massKg);
    memberRows[base + 13] = f32Bits(temperatureK);
    memberRows[base + 14] = f32Bits(internalEnergyJ / Math.max(1, memberCount));
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        memberRows[base + [16, 20, 24][row] + column] = f32Bits(
          member.localInertiaKgM2[row][column]
        );
      }
    }
    memberRows[base + 36] = index;
    memberRows[base + 37] = fixture.restMesh.topologyGeneration;
    memberRows[base + 39] = COHERENT_SOLID_ROW_STATUS_ACTIVE;
  }
  const contacts = createAsymmetricContactProxyRows(fixture, {
    bodyId,
    componentGeneration,
    generationId,
    activeSsLevel: levelId,
    topologyGeneration: fixture.restMesh.topologyGeneration,
    provenanceId
  });
  return {
    frameRows,
    memberRows,
    membershipOffsets: new Uint32Array([0, memberCount]),
    membershipIndices: new Uint32Array(Array.from({ length: memberCount }, (_, index) => index)),
    localContactProxyRows: contacts.rows,
    bodyCount: 1,
    memberCount,
    proxyCount: contacts.proxyCount,
    frameGenerationId: generationId,
    memberGenerationId,
    leaseId,
    leaseEpoch,
    chartId,
    levelId,
    hierarchyGeneration,
    positionEpoch,
    inertia,
    inverseInertia
  };
}
