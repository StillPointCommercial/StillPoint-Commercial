import Link from 'next/link'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-warm-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="font-dm-serif text-3xl text-charcoal mb-3">Page not found</h1>
        <p className="text-text-light mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 bg-[#B5876B] text-white rounded-xl text-sm font-medium hover:bg-[#a07860] transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
