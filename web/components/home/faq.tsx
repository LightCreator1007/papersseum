import { Children, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import FaqBody from "@/generated/docs/pages/competition--faq.mdx";
import { FaqItem } from "./faq-item";
import styles from "./faq.module.css";

// COMPETITION.md section 8, verbatim. Each FAQ is one paragraph that opens with its
// question in bold: "**Question?** Answer." The MDX is rendered with a paragraph that
// splits there, so the bold run becomes the disclosure button and the rest its panel.
// A paragraph without a leading bold run renders as is. The section heading is dropped;
// the home page sets its own.

function startsWithStrong(nodes: ReactNode[]): nodes is [ReactElement<{ children?: ReactNode }>, ...ReactNode[]] {
  const first = nodes[0];
  return isValidElement(first) && first.type === "strong";
}

function FaqParagraph({ children, ...rest }: ComponentProps<"p">) {
  const nodes = Children.toArray(children);
  if (!startsWithStrong(nodes)) return <p {...rest}>{children}</p>;
  const [question, ...answer] = nodes;
  if (typeof answer[0] === "string") answer[0] = answer[0].replace(/^\s+/, "");
  return <FaqItem question={question.props.children}>{answer}</FaqItem>;
}

export function Faq() {
  return (
    <div className={styles.faq}>
      <FaqBody components={{ h2: () => null, p: FaqParagraph }} />
    </div>
  );
}
