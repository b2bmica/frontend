import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top Banner Loader */}
      <div className="relative h-1 w-full bg-slate-100 overflow-hidden rounded-full mb-8">
        <div className="absolute inset-0 bg-primary/20 animate-pulse" />
        <div 
          className="absolute top-0 h-full bg-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]" 
          style={{ 
            width: '30%', 
            left: '-30%',
            animation: 'loader-slide 2s infinite linear' 
          }} 
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-none shadow-sm ring-1 ring-slate-100">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-24 mb-2 rounded-lg" />
              <Skeleton className="h-3 w-32 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="md:col-span-4 border-none shadow-sm ring-1 ring-slate-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3 rounded-lg" />
                    <Skeleton className="h-3 w-1/4 rounded-lg opacity-50" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 border-none shadow-sm ring-1 ring-slate-100">
          <CardContent className="p-6">
            <Skeleton className="h-5 w-40 mb-6 rounded-lg" />
            <div className="space-y-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-24 rounded-full" />
                    <Skeleton className="h-3 w-8 rounded-full" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-col items-center">
              <div className="w-32 h-32 rounded-full border-4 border-slate-50 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-b-2 border-primary animate-spin" />
              </div>
              <Skeleton className="h-3 w-32 mt-6 rounded-full opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes loader-slide {
          0% { left: -30%; width: 30%; }
          50% { left: 40%; width: 40%; }
          100% { left: 100%; width: 30%; }
        }
      `}} />
    </div>
  )
}

export function EmptyState({
  title = "No data found",
  description = "There are no records to display at the moment.",
  icon: Icon,
  action,
}: {
  title?: string
  description?: string
  icon?: React.ElementType
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in duration-500">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        {Icon ? (
          <Icon className="h-10 w-10 text-muted-foreground" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-muted-foreground/20" />
        )}
      </div>
      <h3 className="mt-6 text-xl font-semibold">{title}</h3>
      <p className="mt-2 mb-6 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action}
    </div>
  )
}

export function ErrorState({
  title = "Something went wrong",
  description = "An error occurred while loading the data. Please try again.",
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <span className="text-3xl">⚠️</span>
      </div>
      <h3 className="mt-6 text-xl font-semibold text-destructive">{title}</h3>
      <p className="mt-2 mb-6 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
        >
          Try Again
        </button>
      )}
    </div>
  )
}
