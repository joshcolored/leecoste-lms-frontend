import { useState, useRef } from 'react'
import { Image as ImageIcon, Lock, Loader2, X, Sparkles, Check, ArrowBigLeft, FileImage } from 'lucide-react'
import JSZip from 'jszip'
import { useNavigate } from "react-router-dom"
import { getPdfMetaData, loadPdfDocument, unlockPdf } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'

type PdfData = { file: File, thumbnail?: string, pageCount: number, isLocked: boolean, pdfDoc?: any, password?: string }

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

/* ------------------------ Main tool ------------------------ */

export default function ExtractImagesTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { Toasts, toastError, toastSuccess } = useLocalToast()
  const navigate = useNavigate()
  const [pdfData, setPdfData] = useState<PdfData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [extractedCount, setExtractedCount] = useState(0)
  const [customFileName, setCustomFileName] = useState('extracted-images')
  const [unlockPassword, setUnlockPassword] = useState('')

  const handleUnlock = async () => {
    if (!pdfData || !unlockPassword) return
    setIsProcessing(true)
    const result = await unlockPdf(pdfData.file, unlockPassword)
    if (result.success) {
      setPdfData({
        ...pdfData,
        isLocked: false,
        pageCount: result.pageCount,
        pdfDoc: result.pdfDoc,
        thumbnail: result.thumbnail,
        password: unlockPassword,
      })
      setCustomFileName(`${pdfData.file.name.replace('.pdf', '')}-extracted`)
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
        setPdfData({
          file,
          pageCount: meta.pageCount,
          isLocked: false,
          pdfDoc,
          thumbnail: meta.thumbnail,
        })
        setCustomFileName(`${file.name.replace('.pdf', '')}-extracted`)
        toastSuccess('PDF loaded successfully!')
      }
    } catch (err) {
      console.error(err)
      toastError('Error processing PDF')
    } finally {
      setIsProcessing(false)
      setDownloadUrl(null)
    }
  }

  const extractImages = async () => {
    if (!pdfData || !pdfData.pdfDoc) return
    setIsProcessing(true)
    setProgress(0)
    setExtractedCount(0)
    await new Promise(resolve => setTimeout(resolve, 100))

    try {
      const zip = new JSZip()
      let imageCounter = 0

      for (let i = 1; i <= pdfData.pageCount; i++) {
        const page = await pdfData.pdfDoc.getPage(i)
        const operatorList = await page.getOperatorList()

        for (let j = 0; j < operatorList.fnArray.length; j++) {
          const depName = operatorList.argsArray[j]?.[0]
          if (typeof depName === 'string' && depName.startsWith('img_')) {
            try {
              const imgObj = await page.objs.get(depName)
              if (imgObj && imgObj.data) {
                imageCounter++

                const canvas = document.createElement('canvas')
                canvas.width = imgObj.width
                canvas.height = imgObj.height
                const ctx = canvas.getContext('2d')
                if (ctx) {
                  const imageData = ctx.createImageData(imgObj.width, imgObj.height)
                  imageData.data.set(imgObj.data)
                  ctx.putImageData(imageData, 0, 0)

                  const dataUrl = canvas.toDataURL('image/png')
                  const base64Data = dataUrl.split(',')[1]
                  zip.file(
                    `image-${imageCounter.toString().padStart(3, '0')}.png`,
                    base64Data,
                    { base64: true }
                  )
                }
              }
            } catch (e) {
              console.warn('Failed to extract an image object', e)
            }
          }
        }

        setProgress(Math.round((i / pdfData.pageCount) * 100))
      }

      if (imageCounter === 0) {
        toastError(
          'No embedded images found.',
          'The file might be heavily compressed or uses non-standard image encoding.'
        )
        setIsProcessing(false)
        return
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      setDownloadUrl(url)
      setExtractedCount(imageCounter)
      addActivity({
        name: `${customFileName}.zip`,
        tool: 'Extract Images',
        size: zipBlob.size,
        resultUrl: url,
      })
      toastSuccess(`Extracted ${imageCounter} images!`)
    } catch (error: any) {
      toastError(`Error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const ActionButton = () => (
    <button
      onClick={extractImages}
      disabled={isProcessing}
      className="w-full bg-[var(--brand-color)] hover:bg-[var(--brand-color)]/90 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-[var(--brand-color)]/20 py-4 rounded-2xl text-sm md:p-6 md:rounded-3xl md:text-xl"
    >
      {isProcessing ? (
        <>
          <Loader2 className="animate-spin" />
          {progress}%
        </>
      ) : (
        <>
          <Sparkles size={18} />
          Extract Raw Images
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
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight dark:text-white flex items-center gap-3">
          <span className="w-9 h-9 rounded-2xl bg-[var(--brand-color)] text-white flex items-center justify-center">
             <FileImage size={18} />
          </span>
          Extract Images
        </h1>
       <p className="text-xs md:text-sm text-gray-400 mt-2 font-medium">
          Find and save all original images embedded inside the PDF.
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
            <ImageIcon size={32} />
          </div>
          <h3 className="text-xl font-bold dark:text-white mb-2">Select PDF</h3>
          <p className="text-sm text-gray-400">Tap to search for images</p>
        </div>
        </div>
      ) : pdfData.isLocked ? (
        <div className="max-w-md mx-auto">
          <div className="bg-white dark:bg-neutral-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 text-center shadow-2xl">
            <div className="w-16 h-16 bg-[var(--brand-color)]/10 dark:bg-[var(--brand-color)]/30 text-[var(--brand-color)] rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-2 dark:text-white">Protected File</h3>
            <input
              type="password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-gray-50 dark:bg-neutral-900 rounded-2xl px-6 py-4 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-center mb-4 dark:text-white"
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
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg border border-gray-100 dark:border-white/5 flex items-center gap-6 shadow-sm">
            <div className="w-16 h-20 bg-gray-50 dark:bg-black rounded-md overflow-hidden shrink-0 border border-gray-100 dark:border-zinc-800 flex items-center justify-center">
              {pdfData.thumbnail ? (
                <img src={pdfData.thumbnail} className="w-full h-full object-cover" alt="PDF preview" />
              ) : (
                <ImageIcon size={20} className="text-[var(--brand-color)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm truncate dark:text-white">
                {pdfData.file.name}
              </h3>
              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
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
            {!downloadUrl ? (
              <>
                <div className="space-y-4">
                  <div className="text-center py-2 px-4 bg-gray-50 dark:bg-neutral-700 rounded-md border border-gray-100 dark:border-white/5">
                    <p className="text-xs text-gray-500 dark:text-zinc-200 leading-relaxed font-medium">
                      This tool scans every page and recovers high-quality source images. Perfect for saving photos from documents.
                    </p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/50 rounded-md border border-amber-100 dark:border-amber-900/20 text-center">
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-widest">
                      Note: If no images are detected, the file may have been rasterized (printed to PDF) or heavily compressed.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest px-1">
                    Output ZIP Name
                  </label>
                  <input
                    type="text"
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-neutral-900 rounded-xl px-4 py-3 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-sm dark:text-white"
                  />
                </div>

                {isProcessing && (
                  <div className="space-y-3">
                    <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden shadow-inner">
                      <div
                        className="bg-[var(--brand-color)] h-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-center font-black text-gray-400 uppercase tracking-widest animate-pulse">
                      Extracting High-Res Assets...
                    </p>
                  </div>
                )}

                <ActionButton />
              </>
            ) : (
              <SuccessState
                message={`Successfully extracted ${extractedCount} images!`}
                downloadUrl={downloadUrl}
                fileName={`${customFileName}.zip`}
                onStartOver={() => {
                  setDownloadUrl(null)
                  setProgress(0)
                  setExtractedCount(0)
                  setPdfData(null)
                }}
                showPreview={false}
              />
            )}

            <button
              onClick={() => setPdfData(null)}
              className="w-full py-2 text-[10px] font-black uppercase text-gray-300 hover:text-[var(--brand-color)] transition-colors"
            >
              Close File
            </button>
          </div>
        </div>
      )}

      <PrivacyBadge />
      <Toasts />
    </div>
  )
}
