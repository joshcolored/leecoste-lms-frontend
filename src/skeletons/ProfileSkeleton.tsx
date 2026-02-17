export default function ProfileSkeleton() {
    return (
        <div className="space-y-6 animate-pulse max-w-3xl mx-auto">

            {/* Avatar */}
            <div className="flex items-center gap-4">

                <div className="w-24 h-24 rounded-full bg-gray-200" />

                <div className="h-4 w-24 bg-gray-200 rounded" />

            </div>

            {/* Inputs */}
            <div className="h-10 w-1/2 bg-gray-200 rounded" />
            <div className="h-10 w-1/2 bg-gray-200 rounded" />

            {/* Button */}
            <div className="h-10 w-32 bg-gray-200 rounded" />

        </div>
    );
}
