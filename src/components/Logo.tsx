// Merkteken: een groen veld met middenlijn en middencirkel.
export default function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0f7a43" />
      <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
        <rect x="12" y="12" width="40" height="40" rx="4" opacity=".9" />
        <line x1="12" y1="32" x2="52" y2="32" />
        <circle cx="32" cy="32" r="8" />
      </g>
    </svg>
  )
}
