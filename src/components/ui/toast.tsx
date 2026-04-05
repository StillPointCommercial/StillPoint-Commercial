'use client'

import { createContext, useCallback, useContext, useState } from 'react'

type ToastVariant = 'success' | 'error' | 'info'

interface Toast {
  id: number
  title: string
  variant: ToastVariant
  visible: boolean
}

interface ToastContextValue {
  toast: (opts: { title: string; variant?: ToastVariant }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback(({ title, variant = 'info' }: { title: string; variant?: ToastVariant }) => {
    const id = nextId++
    setToasts(prev => [...prev, { id, title, variant, visible: false }])

    // Trigger enter animation
    requestAnimationFrame(() => {
      setToasts(prev => prev.map(t => (t.id === id ? { ...t, visible: true } : t)))
    })

    // Auto-dismiss after 3s
    setTimeout(() => {
      setToasts(prev => prev.map(t => (t.id === id ? { ...t, visible: false } : t)))
      // Remove from DOM after animation
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 300)
    }, 3000)
  }, [])

  const borderColor: Record<ToastVariant, string> = {
    success: 'border-l-green-500',
    error: 'border-l-red-500',
    info: 'border-l-[#B5876B]',
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto bg-white border border-gray-200 border-l-4 ${borderColor[t.variant]} shadow-lg rounded-xl px-4 py-3 min-w-[250px] max-w-sm transition-all duration-300 ease-in-out ${
              t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <p className="text-sm text-charcoal font-medium">{t.title}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
