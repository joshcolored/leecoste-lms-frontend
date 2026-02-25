export default function ToolsSkeleton() {
  return (
    <div className="min-h-screen scroll-smooth animate-pulse">

      <div className="relative items-center mt-4 p-6 bg-gray-50 rounded-xl dark:bg-neutral-800 space-y-8">

        
        {/* <div className="space-y-3">
          <div className="h-6 w-64 bg-gray-200 dark:bg-neutral-700 rounded" />
          <div className="h-4 w-96 bg-gray-200 dark:bg-neutral-700 rounded" />
        </div>

        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">


          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-20 rounded-full bg-gray-200 dark:bg-neutral-700"
              />
            ))}
          </div>

          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="h-10 w-full sm:w-72 rounded-full bg-gray-200 dark:bg-neutral-700" />
            <div className="h-10 w-24 rounded-full bg-gray-200 dark:bg-neutral-700" />
          </div>
        </div> */}


        <div className="grid 
          grid-cols-1 
          sm:grid-cols-2 
          lg:grid-cols-3 
          xl:grid-cols-4 
          gap-6"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="p-6 rounded-[2rem] bg-white dark:bg-neutral-700/50 border border-gray-100 dark:border-white/5 space-y-4"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl bg-gray-200 dark:bg-neutral-600" />

              {/* Title */}
              <div className="h-5 w-3/4 bg-gray-200 dark:bg-neutral-600 rounded" />

              {/* Description */}
              <div className="space-y-2">
                <div className="h-3 w-full bg-gray-200 dark:bg-neutral-600 rounded" />
                <div className="h-3 w-5/6 bg-gray-200 dark:bg-neutral-600 rounded" />
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}