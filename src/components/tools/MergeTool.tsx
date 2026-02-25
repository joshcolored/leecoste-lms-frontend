import { useState, useRef } from "react"
import { Upload, X, Loader2, Eye, ArrowBigLeft, Layers } from "lucide-react"
import { PDFDocument } from "pdf-lib"
import PrivacyBadge from './shared/PrivacyBadge'
import PdfPreview from "./PdfPreview"
import { useNavigate } from "react-router-dom"
type PdfFile = {
  id: string
  file: File
}

export default function MergeTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const [files, setFiles] = useState<PdfFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [mergedFile, setMergedFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState("merged-pdf")
  const [previewFile, setPreviewFile] = useState<File | null>(null)

  const generateId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return

    const newFiles = Array.from(fileList)
      .filter(f => f.type === "application/pdf")
      .map(f => ({
        id: generateId(),
        file: f,
      }))

    setFiles(prev => [...prev, ...newFiles])

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const mergePDFs = async () => {
    if (files.length < 2) return

    setIsProcessing(true)

    try {
      const mergedPdf = await PDFDocument.create()

      for (const item of files) {
        const bytes = await item.file.arrayBuffer()
        const pdf = await PDFDocument.load(bytes)
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        pages.forEach(p => mergedPdf.addPage(p))
      }

      const mergedBytes = await mergedPdf.save()
      const uint8 = new Uint8Array(mergedBytes)
      const blob = new Blob([uint8], { type: "application/pdf" })

      const finalName = `${fileName || "merged"}.pdf`
      const file = new File([blob], finalName, { type: "application/pdf" })

      setMergedFile(file)
      setDownloadUrl(URL.createObjectURL(blob))
    } catch (err) {
      console.error(err)
      alert("Failed to merge PDFs.")
    } finally {
      setIsProcessing(false)
    }
  }

  const reset = () => {
    setFiles([])
    setDownloadUrl(null)
    setMergedFile(null)
  }

  return (
    <div className="min-h-screen scroll-smooth">

      <button
        onClick={() => navigate(-1)}
        className="
    mb-6
    inline-flex
    items-center
    gap-2
    px-4
    py-2
    text-[var(--brand-color)]
    dark:text-white
    rounded-xl
    bg-gray-100
    dark:bg-neutral-900
    border
    border-[var(--brand-color)]
    dark:border-neutral-800
    hover:bg-[var(--brand-color)]
    hover:text-white
    dark:hover:text-[var(--brand-color)]
    transition-all
    duration-200
    font-bold
  "
      >
        <ArrowBigLeft size={18} />
        Back
      </button>
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight dark:text-white flex items-center gap-3">
          <span className="w-9 h-9 rounded-2xl bg-[var(--brand-color)] text-white flex items-center justify-center">
            <Layers size={18} />
          </span>
          Merge PDF
        </h1>
        <p className="text-xs md:text-sm text-gray-400 mt-2 font-medium">
          Combine multiple PDF files into one document. Processed entirely on your device.
        </p>
      </header>
      <div className="relative items-center bg-white mt-4 p-12 bg-gray-50 rounded-xl
                dark:bg-neutral-800">

        {/* Upload */}
        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-500 bg-neutral-100 mb-8 dark:bg-neutral-700 dark:border-neutral-300 max-w-4xl mx-auto p-8 space-y-8 dark:border-neutral-800 rounded-3xl p-16 text-center cursor-pointer hover:bg-rose-50 dark:hover:bg-neutral-900 transition">
          <div className="w-20 h-20 bg-[var(--brand-color)] text-white text-[var(--brand-color)] dark:bg-[var(--brand-color)] rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
            <Upload size={32} />
          </div>
          <h3 className="text-xl font-bold dark:text-white mb-2">
            Select PDF File
          </h3>
          <p className="text-sm text-gray-400 font-medium">
            Tap to start merging
          </p>
        </div>

        <input
          type="file"
          multiple
          accept=".pdf"
          ref={fileInputRef}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-3">
            {files.map(file => (
              <div
                key={file.id}
                className="flex justify-between items-center max-w-4xl mx-auto p-4 bg-white dark:bg-neutral-900 rounded-2xl border dark:border-neutral-800"
              >
                <span className="truncate dark:text-white text-sm font-semibold">
                  {file.file.name}
                </span>

                <button
                  onClick={() => removeFile(file.id)}
                  className="text-[var(--brand-color)] hover:scale-110 transition"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Merge Controls */}
        {files.length >= 2 && !mergedFile && (
          <div className="space-y-4 max-w-4xl mt-8 mx-auto">

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-[var(--brand-color)] mb-2">
                Output File Name
              </label>
              <input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 outline-none border border-transparent focus:border-rose-500 dark:text-white"
              />
            </div>

            <button
              onClick={mergePDFs}
              disabled={isProcessing}
              className="
    w-full
    bg-[var(--brand-color)]
    hover:brightness-90
    active:scale-[0.98]
    text-white
    py-4
    rounded-2xl
    font-bold
    uppercase
    tracking-widest
    transition-all
    duration-200
    disabled:opacity-50
    disabled:cursor-not-allowed
    flex
    items-center
    justify-center
    gap-3
    shadow-lg
    shadow-[var(--brand-color)]/30
  "
            >
              {isProcessing && <Loader2 className="animate-spin" size={18} />}
              {isProcessing ? "Merging..." : "Merge PDFs"}
            </button>
          </div>
        )}

        {/* Success State with Preview */}
        {mergedFile && downloadUrl && (
          <div className="text-center max-w-4xl mt-8 mx-auto space-y-6 p-10 bg-white dark:bg-neutral-900 rounded-3xl border dark:border-neutral-800 shadow-xl">

            <h2 className="text-xl font-black text-green-600">
              PDFs Merged Successfully!
            </h2>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">

              <button
                onClick={() => setPreviewFile(mergedFile)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 justify-center"
              >
                <Eye size={18} />
                Preview PDF
              </button>

              <a
                href={downloadUrl}
                download={mergedFile.name}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl font-bold"
              >
                Download
              </a>

            </div>

            <button
              onClick={reset}
              className="block mx-auto text-sm text-[var(--brand-color)] hover:underline"
            >
              Start Over
            </button>
          </div>
        )}

        {/* Preview Modal */}
        {previewFile && (
          <PdfPreview
            file={previewFile}
            onClose={() => setPreviewFile(null)}
            onProcess={() => setPreviewFile(null)}
          />
        )}

      </div>
      <div className="mt-6">
        <PrivacyBadge />
      </div>

    </div>


  )
}
