import "katex/dist/katex.min.css";
import "./learn.css";
import { SmoothScroll } from "@/components/motion/smooth-scroll";

export default function LearnLayout({ children }: LayoutProps<"/learn">) {
  return (
    <>
      <SmoothScroll />
      {children}
    </>
  );
}
