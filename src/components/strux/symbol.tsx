import type { ElementKind } from '@/lib/beam-model';

export function Symbol({ kind, className = '' }: { kind: ElementKind; className?: string }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {kind === 'pinned' && <><path d="M16 6 5 24h22L16 6Z"/><path d="M4 28h24M7 28l-3 3m9-3-3 3m9-3-3 3m9-3-3 3"/></>}
    {kind === 'roller' && <><path d="m16 4-10 16h20L16 4Z"/><circle cx="10" cy="24" r="2"/><circle cx="22" cy="24" r="2"/><path d="M4 29h24"/></>}
    {kind === 'fixed' && <><path d="M12 3v26m0-13h17M5 8l7-5M5 15l7-5M5 22l7-5M5 29l7-5"/></>}
    {kind === 'force' && <><path d="M16 3v25m-6-7 6 7 6-7M4 29h24"/></>}
    {kind === 'distributed' && <><path d="M4 7h24M4 7v16m-3-4 3 4 3-4M16 7v16m-3-4 3 4 3-4M28 7v16m-3-4 3 4 3-4M3 28h26"/></>}
    {kind === 'moment' && <><path d="M8 24a11 11 0 1 1 18-9m-1-8 1 8-8-1"/><path d="M3 28h26"/></>}
  </svg>;
}