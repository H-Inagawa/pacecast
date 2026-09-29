export function paddedRange(values: number[], fallbackSpan = 2): [number, number] {
  if (values.length === 0) {
    return [0, fallbackSpan];
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [min - fallbackSpan / 2, max + fallbackSpan / 2];
  }
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}
