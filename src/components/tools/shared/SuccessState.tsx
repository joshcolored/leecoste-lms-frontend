import { Download, Eye, CheckCircle2, Share2, RotateCcw } from "lucide-react"
import { useState } from "react"
import PdfPreview from "../PdfPreview"

interface SuccessStateProps {
  message: string
  downloadUrl: string
  fileName: string
  onStartOver: () => void
  showPreview?: boolean
}

export default function SuccessState({
  message,
  downloadUrl,
  fileName,
  onStartOver,
  showPreview = true
}: SuccessStateProps) {
  const [internalPreviewFile, setInternalPreviewFile] = useState<File | null>(null)

  // ✅ Download (pure web)
  const handleDownload = () => {
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ✅ Share (Web Share API with fallback)
  const handleShare = async () => {
    try {
      const response = await fetch(downloadUrl)
      const blob = await response.blob()
      const file = new File([blob], fileName, { type: blob.type })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName
        })
      } else {
        handleDownload()
      }
    } catch (err) {
      console.error("Share failed:", err)
    }
  }

  // ✅ Preview
  const handlePreview = async () => {
    try {
      const response = await fetch(downloadUrl)
      const blob = await response.blob()
      const file = new File([blob], fileName, { type: blob.type })
      setInternalPreviewFile(file)
    } catch (err) {
      console.error("Preview failed:", err)
    }
  }

  return (
    <div className="animate-in slide-in-from-bottom duration-500 fade-in space-y-6">

      {/* Preview Modal */}
      {internalPreviewFile && (
        <PdfPreview
          file={internalPreviewFile}
          onClose={() => setInternalPreviewFile(null)}
          onProcess={() => setInternalPreviewFile(null)}
        />
      )}

      {/* Success Banner */}
      <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm border border-green-100 dark:border-green-900/30">
        <CheckCircle2 size={18} />
        {message}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">

        <div className="flex gap-3">
          {showPreview && (
            <button
              onClick={handlePreview}
              className="flex-1 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white border border-gray-200 dark:border-neutral-800 p-4 rounded-2xl shadow-sm font-black text-sm transition-all hover:bg-gray-50 active:scale-95 flex items-center justify-center gap-2"
            >
              <Eye size={18} /> Preview
            </button>
          )}

          <button
            onClick={handleShare}
            className="flex-1 bg-[var(--brand-color)] dark:bg-[var(--brand-color)] text-white border border-rose-100 dark:border-rose-900/30 p-4 rounded-2xl shadow-sm font-semi-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Share2 size={18} /> Share
          </button>
        </div>

        <button
          onClick={handleDownload}
          className="w-full bg-gray-900 dark:bg-white text-white dark:text-black p-5 rounded-2xl shadow-xl font-black text-lg tracking-tight transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-3"
        >
          <Download size={22} /> Download
        </button>
      </div>

      {/* Start Over */}
      <button
        onClick={onStartOver}
        className="w-full mt-4 py-4 bg-gray-50 dark:bg-neutral-900 text-gray-400 hover:text-[var(--brand-color)] dark:hover:text-[var(--brand-color)] rounded-2xl border border-gray-100 dark:border-white/5 font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
      >
        <RotateCcw size={14} /> Start New Session
      </button>
    </div>
  )
}