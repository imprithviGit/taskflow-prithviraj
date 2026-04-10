export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 bg-slate-200 rounded-lg w-2/3" />
        <div className="h-8 w-8 bg-slate-200 rounded-xl" />
      </div>
      <div className="h-3.5 bg-slate-100 rounded w-full mb-2" />
      <div className="h-3.5 bg-slate-100 rounded w-4/5" />
      <div className="h-3 bg-slate-100 rounded w-1/3 mt-4" />
    </div>
  )
}

export function SkeletonTask() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-slate-100 rounded-full" />
        <div className="h-5 w-12 bg-slate-100 rounded-full" />
      </div>
    </div>
  )
}

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-8 h-8 border-[3px] border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}
