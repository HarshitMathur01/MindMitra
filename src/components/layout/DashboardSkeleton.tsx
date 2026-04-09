import React from "react";

export function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-background px-4 pt-4 pb-36 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-lg flex-col gap-6 animate-pulse">
                {/* Hero skeleton */}
                <div className="relative min-h-[220px] w-full overflow-hidden rounded-2xl bg-muted sm:min-h-[280px]">
                    <div className="absolute top-4 left-4 flex gap-3 sm:left-6">
                        <div className="h-[5.5rem] w-[5.5rem] rounded-full bg-background/40" />
                        <div className="h-4 w-32 mt-4 rounded bg-background/40" />
                    </div>
                    <div className="absolute top-4 right-4 flex gap-2 sm:right-6">
                        <div className="h-11 w-11 rounded-full bg-background/40" />
                        <div className="h-11 w-11 rounded-full bg-background/40" />
                    </div>
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
                        <div className="h-3 w-32 rounded bg-background/40" />
                        <div className="h-8 w-48 rounded bg-background/40 sm:h-10 sm:w-64" />
                        <div className="h-8 w-40 rounded-full bg-background/40" />
                    </div>
                </div>

                {/* Affirmation skeleton */}
                <div className="h-[100px] w-full rounded-xl bg-muted" />

                {/* Mood skeleton */}
                <div className="h-[160px] w-full rounded-xl bg-card shadow-xs border border-border p-4">
                    <div className="h-3 w-40 mx-auto rounded bg-muted mb-6" />
                    <div className="flex justify-between gap-2 sm:justify-center sm:gap-6">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex flex-col items-center gap-2">
                                <div className="h-[3.5rem] w-[3.5rem] rounded-full bg-muted" />
                                <div className="h-3 w-10 rounded bg-muted" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions skeleton */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="h-5 w-32 rounded bg-muted" />
                        <div className="h-4 w-12 rounded bg-muted" />
                    </div>
                    <div className="flex gap-3 overflow-hidden md:grid md:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="min-h-[140px] min-w-[92px] flex-1 rounded-xl bg-muted p-4 md:min-w-0">
                                <div className="h-10 w-10 rounded-xl bg-background/50" />
                                <div className="h-4 w-16 rounded bg-background/50 mt-4" />
                                <div className="h-3 w-10 rounded bg-background/50 mt-2" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Mood tags skeleton */}
                <div className="space-y-4">
                    <div className="h-5 w-36 rounded bg-muted" />
                    <div className="flex gap-3 overflow-hidden">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-[46px] w-[180px] shrink-0 rounded-full bg-muted" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
