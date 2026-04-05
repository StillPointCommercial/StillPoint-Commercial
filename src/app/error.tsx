'use client'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-warm-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="font-dm-serif text-3xl text-charcoal mb-3">Something went wrong</h1>
        <p className="text-text-light mb-6">
          An unexpected error occurred. Please try again or return to the dashboard.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-[#B5876B] text-white rounded-xl text-sm font-medium hover:bg-[#a07860] transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-5 py-2.5 border border-gray-200 text-charcoal rounded-xl text-sm font-medium hover:bg-cream transition-colors"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
