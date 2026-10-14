// Chapter 10's "Neural playground": a small network (2 inputs, a hidden layer of tanh neurons, 1 sigmoid output)
// with backpropagation written out by hand, trained by gradient descent. Same maths as
// resources/chapters/10-neural-networks/code/mlp.py, with a cross-entropy loss for yes/no answers.

import { mulberry32, type Rng } from "./bandit";

export type Dataset = "blobs" | "xor" | "circle";
export type Data = { x: [number, number][]; y: number[] };

function gaussian(rng: Rng): number {
  // Box-Muller: two uniform numbers become one normally-distributed number
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export function makeData(kind: Dataset, n = 160, seed = 1): Data {
  const rng = mulberry32(seed);
  const x: [number, number][] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    if (kind === "blobs") {
      const label = i % 2;
      const c = label ? 0.5 : -0.5;
      x.push([c + 0.2 * gaussian(rng), c + 0.2 * gaussian(rng)]);
      y.push(label);
    } else if (kind === "xor") {
      // points in the four corners; the label is "the signs of x and y differ"
      let px = 0;
      let py = 0;
      do {
        px = rng() * 2 - 1;
        py = rng() * 2 - 1;
      } while (Math.abs(px) < 0.12 || Math.abs(py) < 0.12);
      x.push([px, py]);
      y.push(px * py < 0 ? 1 : 0);
    } else {
      const label = i % 2;
      const angle = rng() * 2 * Math.PI;
      const radius = label ? 0.1 + 0.3 * rng() : 0.6 + 0.3 * rng();
      x.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
      y.push(label);
    }
  }
  return { x, y };
}

export type Net = {
  hidden: number;
  w1: number[][]; // [2][hidden]
  b1: number[];
  w2: number[]; // [hidden]
  b2: number;
};

export function makeNet(hidden: number, seed = 1): Net {
  const rng = mulberry32(seed);
  return {
    hidden,
    w1: Array.from({ length: 2 }, () => Array.from({ length: hidden }, () => gaussian(rng) * Math.sqrt(1 / 2))),
    b1: Array(hidden).fill(0),
    w2: Array.from({ length: hidden }, () => gaussian(rng) * Math.sqrt(1 / hidden)),
    b2: 0,
  };
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function predict(net: Net, p: [number, number]): number {
  let z2 = net.b2;
  for (let j = 0; j < net.hidden; j++) z2 += net.w2[j] * Math.tanh(p[0] * net.w1[0][j] + p[1] * net.w1[1][j] + net.b1[j]);
  return sigmoid(z2);
}

export function loss(net: Net, data: Data): number {
  let total = 0;
  data.x.forEach((p, i) => {
    const q = Math.min(Math.max(predict(net, p), 1e-12), 1 - 1e-12);
    total -= data.y[i] * Math.log(q) + (1 - data.y[i]) * Math.log(1 - q);
  });
  return total / data.x.length;
}

export function accuracy(net: Net, data: Data): number {
  return data.x.filter((p, i) => (predict(net, p) > 0.5 ? 1 : 0) === data.y[i]).length / data.x.length;
}

export type Gradients = { w1: number[][]; b1: number[]; w2: number[]; b2: number };

// Backpropagation, spelled out. For each example:
//   forward:  z1 = x W1 + b1,  a1 = tanh(z1),  z2 = a1 . w2 + b2,  p = sigmoid(z2)
//   backward: dz2 = p - y                       (the slope of cross-entropy with respect to z2)
//             dw2 = a1 * dz2,  db2 = dz2
//             da1 = w2 * dz2                    (pass the slope back through the weights)
//             dz1 = da1 * (1 - a1^2)            (and through the bend: tanh'(z) = 1 - tanh(z)^2)
//             dW1 = x * dz1,   db1 = dz1
export function gradients(net: Net, data: Data): Gradients {
  const n = data.x.length;
  const g: Gradients = { w1: [Array(net.hidden).fill(0), Array(net.hidden).fill(0)], b1: Array(net.hidden).fill(0), w2: Array(net.hidden).fill(0), b2: 0 };
  data.x.forEach((p, i) => {
    const a1 = Array.from({ length: net.hidden }, (_, j) => Math.tanh(p[0] * net.w1[0][j] + p[1] * net.w1[1][j] + net.b1[j]));
    const prob = sigmoid(net.b2 + a1.reduce((s, a, j) => s + a * net.w2[j], 0));
    const dz2 = (prob - data.y[i]) / n;
    g.b2 += dz2;
    for (let j = 0; j < net.hidden; j++) {
      g.w2[j] += a1[j] * dz2;
      const dz1 = net.w2[j] * dz2 * (1 - a1[j] ** 2);
      g.b1[j] += dz1;
      g.w1[0][j] += p[0] * dz1;
      g.w1[1][j] += p[1] * dz1;
    }
  });
  return g;
}

// Gradient descent: a number of steps, each moving every weight a little against its slope.
export function train(net: Net, data: Data, steps: number, lr: number): number {
  for (let s = 0; s < steps; s++) {
    const g = gradients(net, data);
    for (let j = 0; j < net.hidden; j++) {
      net.w1[0][j] -= lr * g.w1[0][j];
      net.w1[1][j] -= lr * g.w1[1][j];
      net.b1[j] -= lr * g.b1[j];
      net.w2[j] -= lr * g.w2[j];
    }
    net.b2 -= lr * g.b2;
  }
  return loss(net, data);
}

// What the network answers over a grid covering [-1, 1] x [-1, 1], for drawing the decision regions.
export function gridProbabilities(net: Net, cells = 28): number[] {
  const out: number[] = [];
  for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) out.push(predict(net, [-1 + ((c + 0.5) * 2) / cells, 1 - ((r + 0.5) * 2) / cells]));
  return out;
}
