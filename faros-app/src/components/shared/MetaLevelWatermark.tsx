import Link from 'next/link'

export function MetaLevelWatermark({ className = '' }: { className?: string }) {
  return (
    <div className={`w-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity duration-300 ${className}`}>
      <Link href="https://wa.me/573017505981" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[10px] text-[var(--color-on-surface-variant)] uppercase tracking-[0.1em] font-medium group">
        <span>Powered by</span>
        <div className="flex items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/metalevel-logo.png" alt="" className="h-10 w-auto opacity-90 group-hover:opacity-100 transition-opacity scale-[1.3]" />
          <span className="font-black text-white group-hover:text-[var(--color-primary-fixed)] transition-colors">MetaLevel Code</span>
        </div>
      </Link>
    </div>
  )
}
