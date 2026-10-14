import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentProps } from "react";
import { BanditCasino } from "@/components/learn/bandit-casino";
import { Callout } from "@/components/learn/callout";
import { Check } from "@/components/learn/check";
import { CodeBlock } from "@/components/learn/code-block";

// Components every lesson can use without importing them.
const components: MDXComponents = {
  Callout,
  Check,
  BanditCasino,
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
