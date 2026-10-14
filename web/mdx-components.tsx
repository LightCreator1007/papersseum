import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentProps } from "react";
import { AgentLoop } from "@/components/learn/agent-loop";
import { BanditCasino } from "@/components/learn/bandit-casino";
import { Callout } from "@/components/learn/callout";
import { Check } from "@/components/learn/check";
import { DiscountPlayground } from "@/components/learn/discount-playground";
import { CheeseHunt } from "@/components/learn/cheese-hunt";
import { CodeBlock } from "@/components/learn/code-block";
import { GridWorld } from "@/components/learn/grid-world";
import { SlopeExplorer } from "@/components/learn/slope-explorer";
import { ValueExplorer } from "@/components/learn/value-explorer";

// Components every lesson can use without importing them.
const components: MDXComponents = {
  Callout,
  Check,
  AgentLoop,
  BanditCasino,
  CheeseHunt,
  DiscountPlayground,
  GridWorld,
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
