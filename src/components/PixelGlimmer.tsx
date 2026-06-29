// A digital, pixelated glimmer for the hero on drug switch: a grid of chunky blocks (the
// "pixels") that snap off left→right, revealing the brand gradient beneath in a colored
// sweep, then the whole layer dissolves. Pure CSS animations (cheap); re-runs on re-mount.
const COLS = 22
const ROWS = 4

export function PixelGlimmer() {
  return (
    <div className="pixel-glimmer pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-brand-gradient opacity-40" />
      <div
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
      >
        {Array.from({ length: COLS * ROWS }).map((_, i) => {
          const col = i % COLS
          const row = Math.floor(i / COLS)
          // left→right wave with a little diagonal jitter so it reads as pixels, not bars
          const delay = col * 18 + row * 8 + ((col + row) % 3) * 14
          return <span key={i} className="pixel-cell" style={{ animationDelay: `${delay}ms` }} />
        })}
      </div>
    </div>
  )
}
