export default function GlobalLoader() {
  return (
    <div className="
      fixed inset-0 z-[9999]
      bg-white/80 backdrop-blur-sm
      flex items-center justify-center
    ">

      <div className="flex flex-col items-center">

        {/* Spinner */}
        <div className="
          w-14 h-14
          border-4 border-indigo-200
          border-t-indigo-600
          rounded-full animate-spin
          mb-4
        " />

        <p className="text-gray-500 text-sm animate-pulse">
          Loading application...
        </p>

      </div>

    </div>
  );
}
