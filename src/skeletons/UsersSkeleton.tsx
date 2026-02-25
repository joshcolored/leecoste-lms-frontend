export default function UsersSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">

      {/* ================= HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-3">

        {/* Title */}
        <div className="h-6 w-24 bg-gray-200 dark:bg-neutral-700 rounded" />

        {/* Filters + Search */}
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="h-10 w-32 bg-gray-200 dark:bg-neutral-700 rounded-lg" />
          <div className="h-10 w-64 bg-gray-200 dark:bg-neutral-700 rounded-lg" />
        </div>
      </div>

      {/* ================= MOBILE SKELETON ================= */}
      <div className="md:hidden space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-neutral-800 rounded-xl p-4 shadow space-y-3"
          >
            <div className="flex items-center gap-3">

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-neutral-700" />

              {/* Name + Email */}
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-gray-200 dark:bg-neutral-700 rounded" />
                <div className="h-3 w-40 bg-gray-200 dark:bg-neutral-700 rounded" />
              </div>

              {/* Role Badge */}
              <div className="h-6 w-16 bg-gray-200 dark:bg-neutral-700 rounded-full" />
            </div>

            {/* Dates */}
            <div className="flex justify-between">
              <div className="h-3 w-24 bg-gray-200 dark:bg-neutral-700 rounded" />
              <div className="h-3 w-24 bg-gray-200 dark:bg-neutral-700 rounded" />
            </div>

            {/* Checkbox + Delete */}
            <div className="flex justify-between pt-2">
              <div className="h-4 w-4 bg-gray-200 dark:bg-neutral-700 rounded" />
              <div className="h-4 w-12 bg-gray-200 dark:bg-neutral-700 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* ================= DESKTOP TABLE SKELETON ================= */}
      <div className="hidden md:block bg-white dark:bg-neutral-800 rounded-xl shadow overflow-hidden">

        {/* Table Head */}
        <div className="grid grid-cols-[40px_2fr_1fr_1fr_1fr_40px] gap-3 px-4 py-3 border-b bg-gray-50 dark:bg-neutral-700 dark:border-gray-700">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-gray-200 dark:bg-neutral-600 rounded"
            />
          ))}
        </div>

        {/* Table Rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[40px_2fr_1fr_1fr_1fr_40px] gap-3 px-4 py-3 items-center border-b dark:border-gray-700"
          >
            {/* Checkbox */}
            <div className="h-4 w-4 bg-gray-200 dark:bg-neutral-700 rounded" />

            {/* User */}
            <div className="flex gap-3 items-center">
              <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-neutral-700" />
              <div className="space-y-2">
                <div className="h-3 w-24 bg-gray-200 dark:bg-neutral-700 rounded" />
                <div className="h-3 w-40 bg-gray-200 dark:bg-neutral-700 rounded" />
              </div>
            </div>

            {/* Role */}
            <div className="h-6 w-16 bg-gray-200 dark:bg-neutral-700 rounded-full" />

            {/* Dates */}
            <div className="h-4 w-20 bg-gray-200 dark:bg-neutral-700 rounded" />
            <div className="h-4 w-20 bg-gray-200 dark:bg-neutral-700 rounded" />

            {/* Menu */}
            <div className="h-4 w-4 bg-gray-200 dark:bg-neutral-700 rounded" />
          </div>
        ))}
      </div>

      {/* ================= PAGINATION ================= */}
      <div className="flex justify-between">
        <div className="h-8 w-20 bg-gray-200 dark:bg-neutral-700 rounded" />

        <div className="flex gap-2">
          <div className="h-8 w-8 bg-gray-200 dark:bg-neutral-700 rounded" />
          <div className="h-8 w-8 bg-gray-200 dark:bg-neutral-700 rounded" />
          <div className="h-8 w-8 bg-gray-200 dark:bg-neutral-700 rounded" />
        </div>

        <div className="h-8 w-20 bg-gray-200 dark:bg-neutral-700 rounded" />
      </div>

    </div>
  );
}