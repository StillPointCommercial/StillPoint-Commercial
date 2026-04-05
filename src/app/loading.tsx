export default function Loading() {
  return (
    <div className="min-h-screen bg-warm-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-[#B5876B] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-text-light">Loading...</p>
      </div>
    </div>
  )
}
