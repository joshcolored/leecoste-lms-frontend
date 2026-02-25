import { useState, useRef } from 'react'
import { Loader2, ShieldAlert, Upload, X, FileCheck, ArrowBigLeft } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { addActivity } from '../../utils/recentActivity'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'
import { useNavigate } from "react-router-dom"
type SuccessStateType = 'idle' | 'copied' | 'downloaded'

/* ---------- Minimal local toast (replacing sonner) ---------- */
type Toast = {
  id: number
  type: 'success' | 'error'
  message: string
  description?: string
}

function useLocalToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = (type: Toast['type'], message: string, description?: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message, description }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  const Toasts = () => (
    <div className="fixed top-[80px] right-4 z-[9999] space-y-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-start gap-2 animate-in slide-in-from-right-2 fade-in duration-200 ${t.type === 'error'
            ? 'bg-rose-600 text-white'
            : 'bg-emerald-600 text-white'
            }`}
        >
          {t.type === 'error' ? (
            <X size={16} className="shrink-0 mt-0.5" />
          ) : (
            <FileCheck size={16} className="shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p>{t.message}</p>
            {t.description && (
              <p className="text-[11px] opacity-80">{t.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  return {
    Toasts,
    toastError: (m: string, d?: string) => show('error', m, d),
    toastSuccess: (m: string, d?: string) => show('success', m, d),
  }
}

export default function RepairTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { Toasts, toastError, toastSuccess } = useLocalToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [customFileName, setCustomFileName] = useState('')
  const [, setSuccessState] = useState<SuccessStateType>('idle')
  const navigate = useNavigate()
  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toastError('Please select a PDF file')
      return
    }
    setOriginalFile(file)
    setCustomFileName(`repaired-${file.name.replace('.pdf', '')}`)
    setDownloadUrl(null)
    setSuccessState('idle')
  }

  const startRepair = async () => {
    if (!originalFile) return
    setIsProcessing(true)
    try {
      const arrayBuffer = await originalFile.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer, {
        ignoreEncryption: true,
        throwOnInvalidObject: false
      } as any)

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      setDownloadUrl(url)
      addActivity({ name: `${customFileName}.pdf`, tool: 'Repair', size: blob.size, resultUrl: url })
      toastSuccess('PDF rebuilt successfully!')
    } catch (error: any) {
      toastError(`Repair failed: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const ActionButton = () => (
    <button
      onClick={startRepair}
      disabled={isProcessing}
      className="w-full bg-[var(--brand-color)] hover:bg-[var(--brand-color)]/90 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 py-4 rounded-2xl text-sm md:p-6 md:rounded-3xl md:text-xl flex items-center justify-center gap-3 shadow-xl shadow-[var(--brand-color)]/20"
    >
      {isProcessing ? <Loader2 className="animate-spin" /> : <FileCheck size={20} />} Attempt Repair
    </button>
  )

  return (
    <>
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
            <span className="w-9 h-9 rounded-2xl bg-[var(--brand-color)] text-white flex items-center justify-center">  <ShieldAlert size={18} /></span>
            Repair PDF
          </h1>
          <p className="text-xs md:text-sm text-gray-400 mt-2 font-medium">
            Fix corrupted or unreadable PDF files by rebuilding structure.
          </p>
        </header>

        <input
          type="file"
          accept=".pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <div className="mt-8 mb-4 p-6 bg-amber-50 dark:bg-amber-900/50 rounded-lg border border-amber-100 dark:border-white/5 flex items-start gap-4">
          <ShieldAlert className="text-amber-500 shrink-0" size={20} />
          <div className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed text-left">
            <p className="font-black mb-1 uppercase tracking-widest text-[10px]">Technical Protocol:</p>
            PaperKnife rebuilds the internal cross-reference table and regenerates the file structure from scratch. This can restore access to many files that "cannot be opened."
          </div>
        </div>
        {!originalFile ? (

          <div
            className="w-full border-gray-100  dark:bg-neutral-800 rounded-lg p-12 text-center transition-all cursor-default group"
          >
            <div onClick={() => !isProcessing && fileInputRef.current?.click()} className="border-2 border-dashed border-gray-500 bg-neutral-100 mb-8 dark:bg-neutral-700 dark:border-neutral-300 max-w-4xl mx-auto p-8 space-y-8 dark:border-neutral-800 rounded-lg p-16 text-center cursor-pointer hover:bg-rose-50 dark:hover:bg-neutral-800 transition">
              <div className="w-20 h-20 bg-[var(--brand-color)] text-white  rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Upload size={32} />
              </div>
              <h3 className="text-xl font-bold dark:text-white mb-2">Select Corrupted PDF</h3>
              <p className="text-sm text-gray-400">Tap to browse local files</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white dark:bg-neutral-800 p-6 rounded-3xl border border-gray-100 dark:border-white/5 flex items-center gap-6 shadow-sm">
              <div className="w-16 h-16 bg-[var(--brand-color)]/10 dark:bg-[var(--brand-color)]/20 text-[var(--brand-color)] rounded-2xl flex items-center justify-center shrink-0">
                <ShieldAlert size={24} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <h3 className="font-bold text-sm truncate dark:text-white">{originalFile.name}</h3>
                <p className="text-[10px] text-gray-400 uppercase font-black">
                  {(originalFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={() => {
                  setOriginalFile(null)
                  setSuccessState('idle')
                }}
                className="p-2 text-gray-400 hover:text-[var(--brand-color)] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-white dark:bg-neutral-800 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 space-y-8 shadow-sm">
              {!downloadUrl ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest px-1">
                      Output Filename
                    </label>
                    <input
                      type="text"
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-sm dark:text-white"
                    />
                  </div>
                  {originalFile && !downloadUrl && <ActionButton />}
                </div>
              ) : (
                <SuccessState
                  message="Reconstruction Complete!"
                  downloadUrl={downloadUrl}
                  fileName={`${customFileName}.pdf`}
                  onStartOver={() => {
                    setDownloadUrl(null)
                    setOriginalFile(null)
                    setSuccessState('idle')
                  }}
                  showPreview={true}
                />
              )}
            </div>
          </div>
        )}



        <PrivacyBadge />
      </div>
      <Toasts />
    </>
  )
}
