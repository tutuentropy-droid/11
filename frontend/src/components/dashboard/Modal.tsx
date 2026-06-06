import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative glass-panel glow-border w-full max-w-lg rounded-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
        <span className="hud-corner tl" />
        <span className="hud-corner tr" />
        <span className="hud-corner bl" />
        <span className="hud-corner br" />
        {title && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-mono text-cockpit-cyan uppercase tracking-wider flex items-center gap-2">
                <span>◆</span> {title}
              </div>
              <button
                onClick={onClose}
                className="text-cockpit-muted hover:text-cockpit-text transition-colors text-lg leading-none"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            <div className="hud-line mb-4" />
          </>
        )}
        {!title && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-cockpit-muted hover:text-cockpit-text transition-colors text-lg leading-none z-10"
            aria-label="关闭"
          >
            ✕
          </button>
        )}
        <div>{children}</div>
      </div>
    </div>
  )
}
