import { describe, expect, it } from "vitest";
import { accuracy, gradients, loss, makeData, makeNet, predict, train, type Net } from "@/features/learn/neural";

describe("neural playground", () => {
  it("backpropagation agrees with brute-force slopes (the gradient check)", () => {
    const data = makeData("xor", 24, 3);
    const net = makeNet(4, 5);
    const g = gradients(net, data);
    const h = 1e-6;
    const check = (get: () => number, set: (v: number) => void, analytic: number) => {
      const old = get();
      set(old + h);
      const up = loss(net, data);
      set(old - h);
      const down = loss(net, data);
      set(old);
      const numeric = (up - down) / (2 * h);
      expect(Math.abs(numeric - analytic) / Math.max(1e-8, Math.abs(numeric) + Math.abs(analytic))).toBeLessThan(1e-6);
    };
    for (let j = 0; j < net.hidden; j++) {
      check(() => net.w1[0][j], (v) => (net.w1[0][j] = v), g.w1[0][j]);
      check(() => net.w1[1][j], (v) => (net.w1[1][j] = v), g.w1[1][j]);
      check(() => net.b1[j], (v) => (net.b1[j] = v), g.b1[j]);
      check(() => net.w2[j], (v) => (net.w2[j] = v), g.w2[j]);
    }
    check(() => net.b2, (v) => (net.b2 = v), g.b2);
  });

  it("training lowers the loss", () => {
    const data = makeData("blobs");
    const net = makeNet(3, 2);
    const before = loss(net, data);
    train(net, data, 200, 0.5);
    expect(loss(net, data)).toBeLessThan(before);
  });

  it("one hidden neuron separates two blobs", () => {
    for (let seed = 1; seed <= 4; seed++) {
      const data = makeData("blobs", 160, seed);
      const net = makeNet(1, seed);
      train(net, data, 1500, 0.5);
      expect(accuracy(net, data)).toBeGreaterThan(0.95);
    }
  });

  it("one hidden neuron cannot learn XOR, but four can", () => {
    for (let seed = 1; seed <= 4; seed++) {
      const data = makeData("xor", 160, seed);
      const one = makeNet(1, seed);
      train(one, data, 4000, 0.5);
      expect(accuracy(one, data)).toBeLessThan(0.85);
      const four = makeNet(4, seed);
      train(four, data, 4000, 0.5);
      expect(accuracy(four, data)).toBeGreaterThan(0.95);
    }
  });

  it("a small hidden layer can wrap around a circle that no straight line can separate", () => {
    for (let seed = 1; seed <= 4; seed++) {
      const data = makeData("circle", 160, seed);
      const net = makeNet(6, seed);
      train(net, data, 4000, 0.5);
      expect(accuracy(net, data)).toBeGreaterThan(0.9);
    }
  });

  it("predictions are probabilities, and the net is deterministic for a seed", () => {
    const a: Net = makeNet(3, 9);
    const b: Net = makeNet(3, 9);
    for (const p of [[0, 0], [0.5, -0.5], [-1, 1]] as [number, number][]) {
      expect(predict(a, p)).toBe(predict(b, p));
      expect(predict(a, p)).toBeGreaterThan(0);
      expect(predict(a, p)).toBeLessThan(1);
    }
  });
});
