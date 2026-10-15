import { Suspense } from "react";
import { MeNav, StaticMeNav } from "@/components/me/me-nav";

export default function MeLayout({ children }: LayoutProps<"/me">) {
  return (
    <>
      <h1>Your bot</h1>
      <Suspense fallback={<StaticMeNav />}>
        <MeNav />
      </Suspense>
      {children}
    </>
  );
}
