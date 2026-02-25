import { useState, useRef } from 'react'
import { Lock, Unlock, Loader2, X, ArrowBigLeft, Check } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { useNavigate } from "react-router-dom"
import { getPdfMetaData, unlockPdf } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
import { useObjectURL } from '../../utils/useObjectURL'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'

type UnlockPdfFile = {
  file: File
  thumbnail?: string
  pageCount: number
  isLocked: boolean
  password?: string
  pdfDoc?: any
}

type Toast = {
  id: number
  type: 'success' | 'error'
  message: string
}

function useLocalToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = (type: Toast['type'], message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  const Toasts = () => (
    <div className="fixed top-[80px] right-4 z-[9999] space-y-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${t.type === 'error'
            ? 'bg-rose-600 text-white'
            : 'bg-emerald-600 text-white'
            }`}
        >
          {t.type === 'error' ? (
            <X size={16} className="shrink-0" />
          ) : (
            <Check size={16} className="shrink-0" />
          )}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )

  return {
    Toasts,
    toastError: (m: string) => show('error', m),
    toastSuccess: (m: string) => show('success', m),
  }
}

export default function UnlockTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { objectUrl, createUrl, clearUrls } = useObjectURL()
  const [pdfData, setPdfData] = useState<UnlockPdfFile | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [password, setPassword] = useState('')
  const [customFileName, setCustomFileName] = useState('paperknife-unlocked')
  const navigate = useNavigate()
  const { Toasts, toastError } = useLocalToast()

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toastError('Please select a PDF file.')
      return
    }
    const meta = await getPdfMetaData(file)
    setPdfData({
      file,
      thumbnail: meta.thumbnail,
      pageCount: meta.pageCount,
      isLocked: meta.isLocked,
    })
    setCustomFileName(`${file.name.replace(/\.pdf$/i, '')}-unlocked`)
    clearUrls()
    setPassword('')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0])
    if (e.target) e.target.value = ''
  }

  const performUnlock = async () => {
    if (!pdfData || (pdfData.isLocked && !password)) return
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 100))
    try {
      const result = await unlockPdf(pdfData.file, password)
      if (!result.success) throw new Error('Incorrect password.')
      const arrayBuffer = await pdfData.file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer, {
        password: password || undefined,
        ignoreEncryption: true,
      } as any)
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = createUrl(blob)
      addActivity({
        name: `${customFileName || 'unlocked'}.pdf`,
        tool: 'Unlock',
        size: blob.size,
        resultUrl: url,
      })
    } catch (error: any) {
      toastError(error?.message || 'Error.')
    } finally {
      setIsProcessing(false)
    }
  }

  const ActionButton = () => (
    <button
      onClick={performUnlock}
      disabled={isProcessing || (pdfData?.isLocked && !password)}
      className="w-full bg-[var(--brand-color)] hover:opacity-80 text-white font-semibold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 py-4 rounded-2xl text-sm md:p-6 md:rounded-3xl md:text-xl flex items-center justify-center gap-3 shadow-lg shadow-rose-500/20"
    >
      {isProcessing ? (
        <Loader2 className="animate-spin" />
      ) : (
        <Unlock size={20} />
      )}{' '}
      Unlock PDF
    </button>
  )

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
    dark:bg-neutral-800
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
      {/* Header to replace NativeToolLayout */}
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight dark:text-white flex items-center gap-3">
          <span className="w-9 h-9 rounded-2xl bg-[var(--brand-color)] text-white flex items-center justify-center">
            <Unlock size={18} />
          </span>
          Unlock PDF
        </h1>
        <p className="text-xs md:text-sm text-gray-400 mt-2 font-medium">
          Remove passwords and restrictions permanently. Processed locally.
        </p>
      </header>

      <input
        type="file"
        accept=".pdf"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileSelect}
      />

      {!pdfData ? (
        <div
          className="w-full border-gray-100  dark:bg-neutral-800 rounded-lg p-12 text-center transition-all cursor-default group"
        >
          <div onClick={() => !isProcessing && fileInputRef.current?.click()} className="border-2 border-dashed border-gray-500 bg-neutral-100 mb-8 dark:bg-neutral-700 dark:border-neutral-300 max-w-4xl mx-auto p-8 space-y-8 dark:border-neutral-800 rounded-lg p-16 text-center cursor-pointer hover:bg-rose-50 dark:hover:bg-neutral-800 transition">
            <div className="w-20 h-20 bg-[var(--brand-color)] text-white  rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Unlock size={32} />
            </div>
            <h3 className="text-xl font-bold dark:text-white mb-2">
              Select Locked PDF
            </h3>
            <p className="text-sm text-gray-400">Tap to browse files</p>
          </div>


        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg border border-gray-100 dark:border-white/5 flex items-center gap-6 shadow-sm">
            <div className="w-16 h-20 bg-gray-50 dark:bg-neutral-700 rounded-md overflow-hidden shrink-0 border border-gray-100 dark:border-neutral-800 flex items-center justify-center text-[var(--brand-color)] shadow-inner">
              {pdfData.thumbnail ? (
                <img
                  src={pdfData.thumbnail}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Lock size={20} />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h3 className="font-bold text-sm truncate dark:text-white">
                {pdfData.file.name}
              </h3>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">
                {pdfData.isLocked ? 'Encrypted Document' : 'Open Document'}
              </p>
            </div>
            <button
              onClick={() => setPdfData(null)}
              className="p-2 text-gray-400 hover:text-[var(--brand-color)] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="bg-white dark:bg-neutral-800 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 space-y-6 shadow-sm">
            {!objectUrl ? (
              <div className="space-y-6">
                {pdfData.isLocked ? (
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-3">
                      Master Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-neutral-900 rounded-xl px-4 py-4 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-lg text-center dark:text-white"
                      placeholder="••••••••"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/20 text-center">
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-widest">
                      File is already unlocked!
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-3">
                    Output Filename
                  </label>
                  <input
                    type="text"
                    value={customFileName}
                    onChange={e => setCustomFileName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-neutral-900 rounded-xl px-4 py-3 border border-transparent focus:border-rose-500 outline-none font-bold text-sm dark:text-white"
                  />
                </div>
                <ActionButton />
              </div>
            ) : (
              <SuccessState
                message="Encryption Removed!"
                downloadUrl={objectUrl}
                fileName={`${customFileName || 'unlocked'}.pdf`}
                onStartOver={() => {
                  clearUrls()
                  setPassword('')
                  setPdfData(null)
                  setIsProcessing(false)
                }}
              />
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        <PrivacyBadge />
      </div>

      <Toasts />
    </div>
  )
}
