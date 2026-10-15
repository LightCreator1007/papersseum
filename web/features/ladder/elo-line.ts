// SVG polyline points for an Elo history, oldest first. Highest value at the top.
export function eloLinePoints(values: number[], width: number, height: number, pad = 4): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const round = (n: number) => Math.round(n * 100) / 100;
  return values
    .map((v, i) => {
      const y = max === min ? height / 2 : pad + (height - 2 * pad) * (1 - (v - min) / (max - min));
      return `${round(i * step)},${round(y)}`;
    })
    .join(" ");
}
