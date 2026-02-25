export default function MessagesSkeleton() {
  return (
    <div className="h-[calc(100vh-120px)] rounded-xl border border-neutral-300 dark:border-neutral-800 overflow-hidden animate-pulse">

      <div className="hidden md:flex h-full">

        {/* ================= SIDEBAR ================= */}
        <div className="w-80 border-r border-neutral-300 dark:border-neutral-800 flex flex-col">

          {/* Sidebar Header */}
          <div className="px-4 py-5 border-b border-neutral-300 dark:border-neutral-800">
            <div className="h-6 w-32 bg-gray-200 dark:bg-neutral-700 rounded" />
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-neutral-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-gray-200 dark:bg-neutral-700 rounded" />
                  <div className="h-3 w-40 bg-gray-200 dark:bg-neutral-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ================= CHAT ================= */}
        <div className="flex-1 flex flex-col">

          {/* Chat Header */}
          <div className="px-6 py-4 border-b border-neutral-300 dark:border-neutral-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-neutral-700" />
            <div className="space-y-2">
              <div className="h-3 w-24 bg-gray-200 dark:bg-neutral-700 rounded" />
              <div className="h-3 w-40 bg-gray-200 dark:bg-neutral-700 rounded" />
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-6 space-y-6 overflow-hidden">

            {/* Left bubble */}
            <div className="flex justify-start">
              <div className="h-10 w-40 bg-gray-200 dark:bg-neutral-700 rounded-2xl" />
            </div>

            {/* Right bubble */}
            <div className="flex justify-end">
              <div className="h-10 w-52 bg-gray-200 dark:bg-neutral-700 rounded-2xl" />
            </div>

            {/* Left image bubble */}
            <div className="flex justify-start">
              <div className="h-40 w-56 bg-gray-200 dark:bg-neutral-700 rounded-xl" />
            </div>

            {/* Right text bubble */}
            <div className="flex justify-end">
              <div className="h-12 w-60 bg-gray-200 dark:bg-neutral-700 rounded-2xl" />
            </div>

          </div>

          {/* Input Bar */}
          <div className="p-4 border-t border-neutral-300 dark:border-neutral-800 flex gap-3">
            <div className="h-10 w-10 bg-gray-200 dark:bg-neutral-700 rounded-full" />
            <div className="flex-1 h-10 bg-gray-200 dark:bg-neutral-700 rounded-full" />
            <div className="h-10 w-10 bg-gray-200 dark:bg-neutral-700 rounded-full" />
          </div>

        </div>
      </div>

      {/* ================= MOBILE SKELETON ================= */}
      <div className="md:hidden h-full p-4 space-y-4">

        <div className="h-6 w-32 bg-gray-200 dark:bg-neutral-700 rounded" />

        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-neutral-700" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 bg-gray-200 dark:bg-neutral-700 rounded" />
              <div className="h-3 w-40 bg-gray-200 dark:bg-neutral-700 rounded" />
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}