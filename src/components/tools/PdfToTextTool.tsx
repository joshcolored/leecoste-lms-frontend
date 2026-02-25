import { useState, useRef, useCallback } from 'react'
import { Loader2, Copy, FileText, Lock, Check, Download, Zap, ScanSearch, ArrowRight, X, ArrowBigLeft } from 'lucide-react'
import Tesseract from 'tesseract.js'
import { getPdfMetaData, loadPdfDocument, unlockPdf, downloadFile } from '../../utils/pdfHelpers'
import PrivacyBadge from './shared/PrivacyBadge'
import { useNavigate } from "react-router-dom"
type PdfToTextData = { file: File, pageCount: number, isLocked: boolean, pdfDoc?: any, password?: string }
type ExtractionMode = 'text' | 'ocr'
type SuccessState = 'idle' | 'copied' | 'downloaded'

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
            <Check size={16} className="shrink-0 mt-0.5" />
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

export default function PdfToTextTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { Toasts, toastError, toastSuccess } = useLocalToast()
  const [pdfData, setPdfData] = useState<PdfToTextData | null>(null)
  const [extractedText, setExtractedText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>('text')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [customFileName, setCustomFileName] = useState('paperknife-extracted')
  const [copied, setCopied] = useState(false)
  const [successState, setSuccessState] = useState<SuccessState>('idle')
  const navigate = useNavigate()
  // F-Droid compliance check
  const isOcrDisabled = import.meta.env.VITE_DISABLE_OCR === 'true'

  const resetSuccessState = useCallback(() => {
    setSuccessState('idle')
  }, [])

  const handleUnlock = async () => {
    if (!pdfData || !unlockPassword) return
    setIsProcessing(true)
    const result = await unlockPdf(pdfData.file, unlockPassword)
    if (result.success) {
      setPdfData({ ...pdfData, isLocked: false, pageCount: result.pageCount, pdfDoc: result.pdfDoc, password: unlockPassword })
      toastSuccess('PDF unlocked successfully!')
    } else {
      toastError('Incorrect password')
    }
    setIsProcessing(false)
  }

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toastError('Please select a PDF file')
      return
    }
    setIsProcessing(true)
    try {
      const meta = await getPdfMetaData(file)
      if (meta.isLocked) {
        setPdfData({ file, pageCount: 0, isLocked: true })
      } else {
        const pdfDoc = await loadPdfDocument(file)
        setPdfData({ file, pageCount: meta.pageCount, isLocked: false, pdfDoc })
        setCustomFileName(`${file.name.replace('.pdf', '')}-extracted`)
      }
      setExtractedText('')
    } catch (err) {
      console.error(err)
      toastError('Failed to load PDF')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStartExtraction = async () => {
    if (!pdfData || !pdfData.pdfDoc) {
      toastError('No PDF loaded')
      return
    }
    setIsProcessing(true)
    setProgress(0)
    setExtractedText('')
    try {
      let result = ''
      if (extractionMode === 'text') {
        for (let i = 1; i <= pdfData.pageCount; i++) {
          const page = await pdfData.pdfDoc.getPage(i)
          const textContent = await page.getTextContent()
          result += `--- Page ${i} ---\n${textContent.items.map((item: any) => item.str).join(' ')}\n\n`
          setProgress(Math.round((i / pdfData.pageCount) * 100))
        }
      } else {
        let currentPageIndex = 1
        const worker = await Tesseract.createWorker('eng', 1, {
          workerPath: '/tesseract/worker.min.js',
          corePath: '/tesseract/tesseract-core.wasm.js',
          langPath: '/tesseract/',
          gzip: false,
          cacheMethod: 'none',
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              const base = ((currentPageIndex - 1) / pdfData.pageCount) * 100;
              setProgress(Math.round(base + (m.progress * (100 / pdfData.pageCount))))
            }
          }
        })
        for (let i = 1; i <= pdfData.pageCount; i++) {
          currentPageIndex = i
          const page = await pdfData.pdfDoc.getPage(i)
          const viewport = page.getViewport({ scale: 2.0 })
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          canvas.height = viewport.height
          canvas.width = viewport.width
          await page.render({ canvasContext: ctx, viewport }).promise
          const { data: { text } } = await worker.recognize(canvas)
          result += `--- Page ${i} (OCR) ---\n${text}\n\n`
          canvas.width = 0
          canvas.height = 0
        }
        await worker.terminate()
      }
      setExtractedText(result)
      toastSuccess('Text extraction complete!')
    } catch (err: any) {
      toastError(err.message || 'Extraction failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCopy = async () => {
    if (!extractedText) return
    try {
      await navigator.clipboard.writeText(extractedText)
      setCopied(true)
      setSuccessState('copied')
      setTimeout(() => {
        setCopied(false)
        resetSuccessState()
      }, 2000)
    } catch (err) {
      toastError('Failed to copy text')
    }
  }

  const handleDownload = async () => {
    if (!extractedText) {
      toastError('No text to download')
      return
    }
    try {
      const blob = new Blob([extractedText], { type: 'text/plain' })
      await downloadFile(blob, `${customFileName}.txt`, 'text/plain')
      setSuccessState('downloaded')
      setTimeout(resetSuccessState, 2000)
    } catch (err) {
      toastError('Download failed')
    }
  }

  const ActionButton = () => (
    <button
      onClick={handleStartExtraction}
      disabled={isProcessing || !pdfData || pdfData.isLocked}
      className={`w-full bg-[var(--brand-color)] hover:bg-[var(--brand-color)]/90 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-[var(--brand-color)]/20 p-6 rounded-3xl text-xl`}
    >
      {isProcessing ? (
        <>
          <Loader2 className="animate-spin" /> {progress}%
        </>
      ) : (
        <>
          Extract Text <ArrowRight size={18} />
        </>
      )}
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
          <span className="w-9 h-9 rounded-2xl bg-[var(--brand-color)] text-white flex items-center justify-center">
            <FileText size={18} />
            </span>
            PDF to Text
          </h1>
          <p className="text-xs md:text-sm text-gray-400 mt-2 font-medium">
            Extract text using fast scan or deep local OCR.
          </p>
        </header>

        <input
          type="file"
          accept=".pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {!pdfData ? (
          <div
          className="w-full border-gray-100  dark:bg-neutral-800 rounded-lg p-12 text-center transition-all cursor-default group"
        >
          <div onClick={() => !isProcessing && fileInputRef.current?.click()} className="border-2 border-dashed border-gray-500 bg-neutral-100 mb-8 dark:bg-neutral-700 dark:border-neutral-300 max-w-4xl mx-auto p-8 space-y-8 dark:border-neutral-800 rounded-lg p-16 text-center cursor-pointer hover:bg-rose-50 dark:hover:bg-neutral-800 transition">
            <div className="w-20 h-20 bg-[var(--brand-color)] text-white  rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <FileText size={32} />
            </div>
            <h3 className="text-xl font-bold dark:text-white mb-2">Select PDF</h3>
            <p className="text-sm text-gray-400">Tap to browse files</p>
          </div>
          </div>
        ) : pdfData.isLocked ? (
          <div className="max-w-md mx-auto">
            <div className="bg-white dark:bg-neutral-800 p-8 rounded-lg border border-gray-100 dark:border-white/5 text-center">
              <div className="w-16 h-16 bg-[var(--brand-color)]/10 dark:bg-[var(--brand-color)]/30 text-[var(--brand-color)] rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-2 dark:text-white">Protected File</h3>
              <input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-gray-50 dark:bg-neutral-900 dark:text-white rounded-md px-6 py-4 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-center mb-4"
              />
              <button
                onClick={handleUnlock}
                disabled={!unlockPassword || isProcessing}
                className="w-full bg-[var(--brand-color)] hover:bg-[var(--brand-color)]/90 text-white p-4 rounded-2xl font-black uppercase text-xs transition-all active:scale-95 disabled:opacity-50"
              >
                Unlock
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg border border-gray-100 dark:border-white/5 flex items-center gap-6">
              <div className="w-16 h-20 bg-gray-50 dark:bg-neutral-700 rounded-md border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-[var(--brand-color)]">
                <FileText size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm truncate dark:text-white">{pdfData.file.name}</h3>
                <p className="text-[10px] text-gray-400 uppercase font-black">
                  {pdfData.pageCount} Pages • {(pdfData.file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <button
                onClick={() => setPdfData(null)}
                className="p-2 text-gray-400 hover:text-[var(--brand-color)] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-white dark:bg-neutral-800 p-8 rounded-lg border border-gray-100 dark:border-white/5 space-y-8 shadow-sm">
              {!extractedText ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setExtractionMode('text')}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center ${extractionMode === 'text'
                        ? 'border-[var(--brand-color)] bg-[var(--brand-color)]/5 dark:bg-neutral-900 text-[var(--brand-color)]'
                        : 'border-gray-400 dark:border-white/5 hover:border-[var(--brand-color)]/50 text-gray-400'
                        }`}
                    >
                      <Zap size={20} className={extractionMode === 'text' ? 'text-[var(--brand-color)]' : 'text-gray-400'} />
                      <span className="font-black uppercase text-[10px] mt-1">Fast Scan</span>
                    </button>
                    <button
                      onClick={() => !isOcrDisabled && setExtractionMode('ocr')}
                      disabled={isOcrDisabled}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center ${extractionMode === 'ocr'
                       ? 'border-[var(--brand-color)] bg-[var(--brand-color)]/5 dark:bg-neutral-900 text-[var(--brand-color)]'
                        : 'border-gray-400 dark:border-white/5 hover:border-[var(--brand-color)]/50 text-gray-400'
                        } ${isOcrDisabled ? 'opacity-40 grayscale' : ''}`}
                    >
                      <ScanSearch size={20} className={extractionMode === 'ocr' ? 'text-[var(--brand-color)]' : 'text-gray-400'} />
                      <span className="font-black uppercase text-[10px] mt-1">{isOcrDisabled ? 'No OCR' : 'Deep OCR'}</span>
                    </button>
                  </div>

                  {isProcessing && (
                    <div className="space-y-2">
                      <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden shadow-inner">
                        <div
                          className="bg-[var(--brand-color)] h-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse px-1">
                        Scanning Document...
                      </p>
                    </div>
                  )}

                  {!isProcessing && (
                    <div className="space-y-4">
                      {isOcrDisabled && (
                        <div className="p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-gray-100 dark:border-white/5">
                          <p className="text-[9px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-center">
                            Deep OCR is disabled in this F-Droid build to comply with non-binary policies. Use 'Fast Scan' or get the full version from GitHub.
                          </p>
                        </div>
                      )}
                      {extractionMode === 'ocr' && !isOcrDisabled && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/50 rounded-xl border border-amber-100 dark:border-amber-900/20">
                          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-widest text-center">
                            Note: Deep OCR is CPU-intensive and may take a few minutes depending on your device performance.
                          </p>
                        </div>
                      )}
                      <div className="p-4 bg-[var(--brand-color)]/5 dark:bg-[var(--brand-color)]/10 rounded-xl border border-[var(--brand-color)]/10 dark:border-[var(--brand-color)]/20 text-center">
                        <p className="text-[10px] text-[var(--brand-color)] dark:text-[var(--brand-color)] font-bold uppercase tracking-widest">
                          Select mode and tap Extract
                        </p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 px-1">
                          Output Filename
                        </label>
                        <input
                          type="text"
                          value={customFileName}
                          onChange={(e) => setCustomFileName(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-neutral-900 rounded-xl px-4 py-3 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-sm dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                  {pdfData && !pdfData.isLocked && !extractedText && <ActionButton />}
                </>
              ) : (
                <div className="space-y-6">
                  <textarea
                    readOnly
                    value={extractedText}
                    className="w-full h-80 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl p-4 font-mono text-[10px] resize-none outline-none focus:border-[var(--brand-color)] dark:text-gray-300 shadow-inner"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleCopy}
                      disabled={successState === 'copied'}
                      className="flex-1 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-100 dark:border-white/5 p-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 hover:border-[var(--brand-color)]"
                    >
                      {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />} Copy
                    </button>
                    <button
                      onClick={handleDownload}
                      disabled={successState === 'downloaded'}
                      className="flex-[2] bg-gray-900 dark:bg-white text-white dark:text-black p-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all hover:bg-gray-800 dark:hover:bg-gray-100"
                    >
                      <Download size={18} /> Download
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setExtractedText('')
                      setProgress(0)
                      setPdfData(null)
                      setSuccessState('idle')
                    }}
                    className="w-full py-2 text-gray-400 uppercase font-black text-[10px] hover:text-[var(--brand-color)] transition-colors"
                  >
                    Close File
                  </button>
                </div>
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
