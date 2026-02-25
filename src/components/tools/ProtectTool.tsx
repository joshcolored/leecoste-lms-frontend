import { useState, useRef } from 'react'
import { Lock, ShieldCheck, Loader2, ArrowRight, X, Check, ArrowBigLeft } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite'
import { useNavigate } from "react-router-dom"
import { getPdfMetaData, unlockPdf } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
import { useObjectURL } from '../../utils/useObjectURL'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'

type ProtectPdfFile = {
  file: File
  thumbnail?: string
  pageCount: number
  isLocked: boolean
  sourcePassword?: string
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

export default function ProtectTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { objectUrl, createUrl, clearUrls } = useObjectURL()
  const [pdfData, setPdfData] = useState<ProtectPdfFile | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [customFileName, setCustomFileName] = useState('paperknife-protected')
  const navigate = useNavigate()
  const { Toasts, toastError } = useLocalToast()

  const handleUnlock = async () => {
    if (!pdfData || !unlockPassword) return
    setIsProcessing(true)
    const result = await unlockPdf(pdfData.file, unlockPassword)
    if (result.success) {
      setPdfData({
        ...pdfData,
        isLocked: false,
        thumbnail: result.thumbnail,
        pageCount: result.pageCount,
        sourcePassword: unlockPassword,
      })
      setCustomFileName(
        `${pdfData.file.name.replace(/\.pdf$/i, '')}-protected`,
      )
    } else {
      toastError('Incorrect password')
    }
    setIsProcessing(false)
  }

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
    setCustomFileName(`${file.name.replace(/\.pdf$/i, '')}-protected`)
    clearUrls()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0])
    if (e.target) e.target.value = ''
  }

  const protectPDF = async () => {
    if (!pdfData || !password || password !== confirmPassword) return
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 150))

    try {
      const arrayBuffer = await pdfData.file.arrayBuffer()
      const sourcePdf = await PDFDocument.load(arrayBuffer, {
        password: pdfData.sourcePassword || undefined,
        ignoreEncryption: true,
      } as any)
      const newPdf = await PDFDocument.create()
      const pages = await newPdf.copyPages(sourcePdf, sourcePdf.getPageIndices())
      pages.forEach(page => newPdf.addPage(page))
      const pdfBytes = await newPdf.save()

      const encryptedBytes = await encryptPDF(pdfBytes, password)
      const blob = new Blob([encryptedBytes as any], {
        type: 'application/pdf',
      })
      const url = createUrl(blob)
      addActivity({
        name: `${customFileName || 'protected'}.pdf`,
        tool: 'Protect',
        size: blob.size,
        resultUrl: url,
      })
    } catch (error: any) {
      console.error('Encryption error:', error)
      toastError(`Encryption failed: ${error.message || 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const ActionButton = () => (
    <button
      onClick={protectPDF}
      disabled={isProcessing || !password || password !== confirmPassword}
      className="w-full bg-[var(--brand-color)] hover:opacity-80 text-white font-semibold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 py-4 rounded-2xl text-sm md:p-6 md:rounded-3xl md:text-xl"
    >
      {isProcessing ? (
        <>
          <Loader2 className="animate-spin" /> Securing...
        </>
      ) : (
        <>
          Encrypt &amp; Save <ArrowRight size={18} />
        </>
      )}
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
      {/* Header to replace NativeToolLayout */}
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight dark:text-white flex items-center gap-3">
          <span className="w-9 h-9 rounded-2xl bg-[var(--brand-color)] text-white flex items-center justify-center">
            <ShieldCheck size={18} />
          </span>
          Protect PDF
        </h1>
        <p className="text-xs md:text-sm text-gray-400 mt-2 font-medium">
          Add strong encryption to your documents. Processed locally.
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
          <div onClick={() => !isProcessing && fileInputRef.current?.click()} className="border-2 border-dashed border-gray-500 bg-neutral-100 mb-8 dark:bg-neutral-700 dark:border-neutral-300 max-w-4xl mx-auto p-8 space-y-8 dark:border-neutral-800 rounded-lg p-16 text-center cursor-pointer hover:bg-rose-50 dark:hover:bg-neutral-900 transition">
            <div className="w-20 h-20 bg-[var(--brand-color)] text-white  rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-xl font-bold dark:text-white mb-2">
              Select PDFs
            </h3>
            <p className="text-sm text-gray-400 font-medium">
              Tap to start protecting your PDF
            </p>
          </div>
        </div>
      ) : pdfData.isLocked ? (
        <div
          className="w-full border-gray-100  dark:bg-neutral-800 rounded-lg p-12 text-center transition-all cursor-default group"
        >
        <div className="max-w-md mx-auto relative z-[100]">
          <div className="bg-white dark:bg-neutral-700 p-8 rounded-lg border border-gray-100 dark:border-white/5 shadow-2xl text-center">
            <div className="w-16 h-16 bg-[var(--brand-color)] text-white rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock size={32} />
            </div>
            <h3 className="text-2xl font-semibold mb-2 dark:text-white">
              Protected File
            </h3>
            <input
              type="password"
              value={unlockPassword}
              onChange={e => setUnlockPassword(e.target.value)}
              placeholder="Enter Password"
              className="w-full bg-gray-50 dark:bg-black rounded-2xl px-6 py-4 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-center mb-4 dark:text-white"
              autoFocus
            />
            <button
              onClick={handleUnlock}
              disabled={!unlockPassword || isProcessing}
              className="w-full bg-[var(--brand-color)] text-white p-4 rounded-2xl font-semibold uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-50"
            >
              Unlock PDF
            </button>
          </div>
        </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg border border-gray-100 dark:border-white/5 flex items-center gap-6">
            <div className="w-16 h-20 bg-gray-50 dark:bg-black rounded-md overflow-hidden shrink-0 border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-rose-500">
              {pdfData.thumbnail ? (
                <img
                  src={pdfData.thumbnail}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Lock size={20} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate dark:text-white">
                {pdfData.file.name}
              </h3>
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-widest">
                {pdfData.pageCount} Pages •{' '}
                {(pdfData.file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
            <button
              onClick={() => setPdfData(null)}
              className="p-2 text-gray-400 hover:text-[var(--brand-color)] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="bg-white dark:bg-neutral-800 p-8 rounded-lg border border-gray-100 dark:border-white/5 space-y-6 shadow-sm">
            {!objectUrl ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-2 tracking-widest px-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-neutral-900 rounded-md px-4 py-3 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-sm dark:text-white"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-2 tracking-widest px-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-neutral-900 rounded-md px-4 py-3 border border-transparent focus:border-rose-500 outline-none font-bold text-sm dark:text-white"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-2 tracking-widest px-1">
                    Output Filename
                  </label>
                  <input
                    type="text"
                    value={customFileName}
                    onChange={e => setCustomFileName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-neutral-900 rounded-md px-4 py-3 border border-transparent focus:border-rose-500 outline-none font-bold text-sm dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <SuccessState
                message="Encrypted Successfully"
                downloadUrl={objectUrl}
                fileName={`${customFileName || 'protected'}.pdf`}
                onStartOver={() => {
                  clearUrls()
                  setPassword('')
                  setConfirmPassword('')
                  setPdfData(null)
                  setIsProcessing(false)
                }}
              />
            )}

            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-white/5 flex items-start gap-3">
              <Lock
                size={14}
                className="text-amber-500 shrink-0 mt-0.5"
              />
              <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
                This tool cannot recover forgotten passwords. Save it securely.
              </p>
            </div>

            {!objectUrl && (
              <ActionButton />
            )}

            <button
              onClick={() => {
                setPdfData(null)
                setIsProcessing(false)
              }}
              className="w-full py-2 text-[10px] font-semibold uppercase text-gray-500 hover:text-[var(--brand-color)] transition-colors"
            >
              Close File
            </button>
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
