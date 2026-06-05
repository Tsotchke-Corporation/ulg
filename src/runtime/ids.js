let nextId = 0;

export function createId(prefix) {
  nextId += 1;
  return `${prefix}-${Date.now().toString(36)}-${nextId.toString(36)}`;
}
