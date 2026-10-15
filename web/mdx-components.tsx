import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentProps } from "react";
import { AgentLoop } from "@/features/learn/components/agent-loop";
import { BanditCasino } from "@/features/learn/components/bandit-casino";
import { Callout } from "@/features/learn/components/callout";
import { Check } from "@/features/learn/components/check";
import { DiscountPlayground } from "@/features/learn/components/discount-playground";
import { CartPoleStage } from "@/features/learn/components/cartpole-stage";
import { CheeseHunt } from "@/features/learn/components/cheese-hunt";
import { CodeBlock } from "@/features/learn/components/code-block";
import { GradientDescent } from "@/features/learn/components/gradient-descent";
import { GridWorld } from "@/features/learn/components/grid-world";
import { MonteCarloGrid } from "@/features/learn/components/monte-carlo-grid";
import { NeuralPlayground } from "@/features/learn/components/neural-playground";
import { PolicyNudge } from "@/features/learn/components/policy-nudge";
import { RpsLearners } from "@/features/learn/components/rps-learners";
import { EloCalculator } from "@/features/learn/components/elo-calculator";
import { QLearningLab } from "@/features/learn/components/q-learning-lab";
import { SlopeExplorer } from "@/features/learn/components/slope-explorer";
import { ValueExplorer } from "@/features/learn/components/value-explorer";

// Components every lesson can use without importing them.
const components: MDXComponents = {
  Callout,
  Check,
  AgentLoop,
  BanditCasino,
  CartPoleStage,
  CheeseHunt,
  DiscountPlayground,
  GradientDescent,
  GridWorld,
  MonteCarloGrid,
  NeuralPlayground,
  PolicyNudge,
  RpsLearners,
  EloCalculator,
  QLearningLab,
  SlopeExplorer,
  ValueExplorer,
  pre: (props: ComponentProps<"pre">) => <CodeBlock>{props.children}</CodeBlock>,
  a: ({ href = "", children, ...rest }: ComponentProps<"a">) =>
    href.startsWith("/") ? (
      <Link href={href}>{children}</Link>
    ) : (
      <a href={href} {...rest} rel="noreferrer noopener" target="_blank">
        {children}
      </a>
    ),
  table: (props: ComponentProps<"table">) => (
    <div className="table-scroll">
      <table {...props} />
    </div>
  ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
