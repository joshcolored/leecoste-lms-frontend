export default function SettingsSkeleton() {
  return (
    <div className="min-h-screen animate-pulse">

      {/* ===== Header ===== */}
      <div className="h-8 w-40 bg-gray-200 dark:bg-neutral-700 rounded mb-6" />

      {/* ===== Tabs ===== */}
      <div className="flex gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-10 w-28 bg-gray-200 dark:bg-neutral-700 rounded-xl"
          />
        ))}
      </div>

      {/* ===== Main Card ===== */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 shadow space-y-6">

        {/* Section Title */}
        <div className="h-5 w-32 bg-gray-200 dark:bg-neutral-700 rounded" />

        {/* Avatar + Upload */}
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
          <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-neutral-700" />
          <div className="flex-1 h-32 rounded-xl bg-gray-200 dark:bg-neutral-700" />
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <div className="h-10 w-full bg-gray-200 dark:bg-neutral-700 rounded-lg" />
          <div className="h-10 w-full bg-gray-200 dark:bg-neutral-700 rounded-lg" />
          <div className="h-10 w-full bg-gray-200 dark:bg-neutral-700 rounded-lg" />
        </div>

        {/* Button */}
        <div className="flex justify-end">
          <div className="h-10 w-28 bg-gray-200 dark:bg-neutral-700 rounded-lg" />
        </div>

      </div>

      {/* ===== Secondary Card (Sessions / Password / etc.) ===== */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 shadow mt-6 space-y-4">

        <div className="h-5 w-40 bg-gray-200 dark:bg-neutral-700 rounded" />

        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 w-full bg-gray-200 dark:bg-neutral-700 rounded-lg"
          />
        ))}
      </div>

    </div>
  );
}