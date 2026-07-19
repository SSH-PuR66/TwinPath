export function Skeleton({ className = "" }) {
    return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function DashboardSkeleton() {
    return (
        <div className="page-stack" aria-label="Loading dashboard">
            <Skeleton className="skeleton-hero" />

            <div className="summary-grid">
                <Skeleton className="skeleton-card" />
                <Skeleton className="skeleton-card" />
                <Skeleton className="skeleton-card" />
            </div>

            <Skeleton className="skeleton-list" />
        </div>
    );
}
