// Chapter 11's cart-pole task and the trained network that plays it. Mirrors
// resources/chapters/11-dqn/code/cartpole.py equation for equation (the test below checks the numbers match).

import policyFile from "./cartpole-policy.json";
import type { Rng } from "./bandit";

export const GRAVITY = 9.8;
export const CART_MASS = 1.0;
export const POLE_MASS = 0.1;
export const POLE_HALF_LENGTH = 0.5;
export const FORCE = 10.0;
export const DT = 0.02;
export const MAX_STEPS = 200;
export const ANGLE_LIMIT = (12 * 2 * Math.PI) / 360;
export const TRACK_LIMIT = 2.4;

export type State = [number, number, number, number]; // cart position, cart speed, pole angle, pole angular speed

export function reset(rng: Rng): State {
  const u = () => (rng() * 2 - 1) * 0.05;
  return [u(), u(), u(), u()];
}

// One step. action 1 pushes right, action 0 pushes left. Returns the new state and whether the pole fell / the cart left the track.
export function step(state: State, action: number): { state: State; fell: boolean } {
  const [x, xDot, theta, thetaDot] = state;
  const force = action === 1 ? FORCE : -FORCE;
  const totalMass = CART_MASS + POLE_MASS;
  const poleMoment = POLE_MASS * POLE_HALF_LENGTH;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const temp = (force + poleMoment * thetaDot ** 2 * sin) / totalMass;
  const thetaAcc = (GRAVITY * sin - cos * temp) / (POLE_HALF_LENGTH * (4 / 3 - (POLE_MASS * cos ** 2) / totalMass));
  const xAcc = temp - (poleMoment * thetaAcc * cos) / totalMass;
  const next: State = [x + DT * xDot, xDot + DT * xAcc, theta + DT * thetaDot, thetaDot + DT * thetaAcc];
  return { state: next, fell: Math.abs(next[0]) > TRACK_LIMIT || Math.abs(next[2]) > ANGLE_LIMIT };
}

type Policy = { layers: number[]; W: number[][][]; b: number[][] };
const POLICY = policyFile as Policy;

// The trained network: ReLU hidden layers, linear output. Returns the two Q-values [push left, push right].
export function qValues(state: State): number[] {
  let x: number[] = [...state];
  for (let l = 0; l < POLICY.W.length; l++) {
    const w = POLICY.W[l];
    const b = POLICY.b[l];
    const out = b.map((bias, j) => bias + x.reduce((sum, xi, i) => sum + xi * w[i][j], 0));
    x = l < POLICY.W.length - 1 ? out.map((v) => Math.max(v, 0)) : out;
  }
  return x;
}

export function trainedAction(state: State): number {
  const q = qValues(state);
  return q[1] > q[0] ? 1 : 0;
}

// Run a policy to the end of an episode; returns the number of steps the pole stayed up (at most 200).
export function episodeLength(policy: (s: State) => number, rng: Rng): number {
  let s = reset(rng);
  for (let t = 1; t <= MAX_STEPS; t++) {
    const out = step(s, policy(s));
    s = out.state;
    if (out.fell) return t;
  }
  return MAX_STEPS;
}
