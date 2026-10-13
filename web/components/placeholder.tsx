// Quiet stand-in while a section streams in: empty ruled rows, no animation.
export function Placeholder({ lines = 3 }: { lines?: number }) {
  return (
    <div className="placeholder" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="placeholder-line" />
      ))}
    </div>
  );
}
