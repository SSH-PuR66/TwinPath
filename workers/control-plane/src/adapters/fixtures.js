export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function deterministicId(namespace, input) {
  const text = `${namespace}:${stableStringify(input)}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${namespace}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function fixture(adapter, input, artifacts, actions) {
  return Object.freeze({
    adapter,
    mode: "sandbox",
    fixture_id: deterministicId(adapter, input),
    summary: `Deterministic ${adapter} sandbox fixture`,
    actions,
    artifacts,
    external_actions_performed: false,
  });
}
