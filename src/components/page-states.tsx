import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-4 w-[350px]" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-12 w-12 rounded-full mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
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
