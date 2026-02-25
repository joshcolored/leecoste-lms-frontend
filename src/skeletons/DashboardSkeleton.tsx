export default function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">

            {/* Header */}
            <div className="h-8 w-48 bg-gray-200 dark:bg-neutral-700 rounded" />
            <div className="h-4 w-64 bg-gray-200 dark:bg-neutral-700 rounded" />

            {/* Filters */}
            <div className="flex gap-3">
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className="h-8 w-20 bg-gray-200 dark:bg-neutral-700 rounded"
                    />
                ))}
            </div>

            {/* Chart */}
            <div className="h-64 bg-gray-200 dark:bg-neutral-700 rounded-xl" />

            {/* Cards */}
            <div className="grid md:grid-cols-3 gap-6">

                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="h-28 bg-gray-200 dark:bg-neutral-700 rounded-xl"
                    />
                ))}

            </div>

            {/* Info */}
            <div className="grid md:grid-cols-4 gap-6">

                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className="h-24 bg-gray-200 dark:bg-neutral-700 rounded-xl"
                    />
                ))}

            </div>

        </div>
    );
}
