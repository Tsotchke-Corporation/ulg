import * as THREE from 'three';

const NODE_COLORS = {
  peercompute: 0x75f7b4,
  eshkol: 0xf7d774,
  moonlab: 0x74c7f7,
  child: 0xf07df2,
  gpu: 0xff8f70,
  inactive: 0x3d4752
};

export function createWorkerTreeScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050807);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
  camera.position.set(0, 4.4, 8.8);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const keyLight = new THREE.DirectionalLight(0x96ffe1, 1.2);
  keyLight.position.set(3, 6, 4);
  scene.add(keyLight);

  const grid = new THREE.GridHelper(10, 20, 0x1d8b6d, 0x0d332b);
  grid.position.y = -1.2;
  scene.add(grid);

  const group = new THREE.Group();
  scene.add(group);

  let telemetry = { services: [], tasks: [], leases: [], gpu: {} };
  const meshes = new Map();
  const lines = new Map();

  function setTelemetry(nextTelemetry) {
    telemetry = nextTelemetry;
    syncScene();
  }

  function syncScene() {
    const nodes = buildNodes(telemetry);
    const liveIds = new Set(nodes.map((node) => node.id));
    for (const [id, mesh] of meshes) {
      if (!liveIds.has(id)) {
        group.remove(mesh);
        meshes.delete(id);
      }
    }
    for (const node of nodes) {
      const mesh = meshes.get(node.id) ?? createNodeMesh(node);
      mesh.userData.target = node.position;
      mesh.material.color.setHex(node.color);
      mesh.scale.setScalar(node.scale);
      meshes.set(node.id, mesh);
      if (!mesh.parent) {
        group.add(mesh);
      }
    }
    syncLines(nodes);
  }

  function syncLines(nodes) {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const desired = [];
    for (const node of nodes) {
      if (node.parent && nodeMap.has(node.parent)) {
        desired.push(`${node.parent}->${node.id}`);
      }
    }
    const desiredSet = new Set(desired);
    for (const [id, line] of lines) {
      if (!desiredSet.has(id)) {
        group.remove(line);
        lines.delete(id);
      }
    }
    for (const edgeId of desired) {
      const [from, to] = edgeId.split('->');
      const fromNode = nodeMap.get(from);
      const toNode = nodeMap.get(to);
      let line = lines.get(edgeId);
      if (!line) {
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.LineBasicMaterial({ color: 0x2fffc1, transparent: true, opacity: 0.38 });
        line = new THREE.Line(geometry, material);
        lines.set(edgeId, line);
        group.add(line);
      }
      line.geometry.setFromPoints([
        new THREE.Vector3(...fromNode.position),
        new THREE.Vector3(...toNode.position)
      ]);
    }
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / Math.max(rect.height, 1);
    camera.updateProjectionMatrix();
  }

  function animate(time) {
    for (const mesh of meshes.values()) {
      const [x, y, z] = mesh.userData.target ?? [0, 0, 0];
      mesh.position.lerp(new THREE.Vector3(x, y + Math.sin(time * 0.0015 + x) * 0.06, z), 0.08);
      mesh.rotation.y += 0.012;
      mesh.rotation.x += 0.006;
    }
    group.rotation.y = Math.sin(time * 0.00025) * 0.12;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(animate);

  return { setTelemetry, resize, canvas: renderer.domElement };
}

function createNodeMesh(node) {
  const geometry = node.kind === 'peercompute'
    ? new THREE.IcosahedronGeometry(0.42, 1)
    : new THREE.SphereGeometry(0.28, 24, 16);
  const material = new THREE.MeshStandardMaterial({
    color: node.color,
    emissive: node.color,
    emissiveIntensity: 0.22,
    roughness: 0.45,
    metalness: 0.1
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...node.position);
  mesh.userData.target = node.position;
  return mesh;
}

function buildNodes(telemetry) {
  const nodes = [{
    id: 'peercompute',
    kind: 'peercompute',
    color: NODE_COLORS.peercompute,
    scale: 1,
    position: [0, 1.4, 0]
  }];

  const servicePositions = {
    eshkol: [-2.4, 0.2, 0],
    moonlab: [2.4, 0.2, 0]
  };
  for (const service of telemetry.services ?? []) {
    const position = servicePositions[service.serviceId] ?? [0, 0, 0];
    nodes.push({
      id: service.serviceId,
      parent: 'peercompute',
      kind: service.serviceId,
      color: NODE_COLORS[service.serviceId] ?? NODE_COLORS.inactive,
      scale: service.status === 'ready' ? 1 : 0.75,
      position
    });
  }

  for (const task of telemetry.tasks ?? []) {
    const base = servicePositions[task.serviceId] ?? [0, 0, 0];
    task.children.forEach((child, index) => {
      nodes.push({
        id: child.childId,
        parent: task.serviceId,
        kind: 'child',
        color: child.status === 'cancelled' ? NODE_COLORS.inactive : NODE_COLORS.child,
        scale: 0.62 + child.progress * 0.38,
        position: [base[0] + (index - 0.5) * 0.82, -1.1, base[2] + 0.35]
      });
    });
  }

  nodes.push({
    id: 'gpu-broker',
    parent: 'peercompute',
    kind: 'gpu',
    color: telemetry.gpu?.supported ? NODE_COLORS.gpu : NODE_COLORS.inactive,
    scale: telemetry.gpu?.activeLeases ? 1 : 0.7,
    position: [0, -0.25, -2.25]
  });

  return nodes;
}
