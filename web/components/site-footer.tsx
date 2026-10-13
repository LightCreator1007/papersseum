import { Suspense } from "react";
import { LoadBoundary } from "@/components/load-boundary";
import { getSeason } from "@/lib/queries";

async function FooterContent() {
  const season = await getSeason();
  return (
    <>
      <span>{season.name}</span>
      {season.engineHash && <span className="mono">engine {season.engineHash}</span>}
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <LoadBoundary what="the season" quiet>
          <Suspense fallback={null}>
            <FooterContent />
          </Suspense>
        </LoadBoundary>
      </div>
    </footer>
  );
}
