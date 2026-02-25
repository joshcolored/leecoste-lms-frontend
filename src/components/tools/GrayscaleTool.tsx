import { useState, useRef } from 'react'
import { Palette, Lock, Loader2, ArrowRight, X, ArrowBigLeft } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { useNavigate } from "react-router-dom"
import { getPdfMetaData, loadPdfDocument, unlockPdf } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'

type PdfData = { file: File, thumbnail?: string, pageCount: number, isLocked: boolean, pdfDoc?: any, password?: string }

export default function GrayscaleTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pdfData, setPdfData] = useState<PdfData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [customFileName, setCustomFileName] = useState('paperknife-grayscale')
  const [unlockPassword, setUnlockPassword] = useState('')
  const navigate = useNavigate()
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
        password: unlockPassword
      })
      setCustomFileName(`${pdfData.file.name.replace('.pdf', '')}-grayscale`)
    } else {
      alert('Incorrect password')
    }
    setIsProcessing(false)
  }

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') return
    setIsProcessing(true)
    try {
      const meta = await getPdfMetaData(file)
      if (meta.isLocked) {
        setPdfData({ file, pageCount: 0, isLocked: true })
      } else {
        const pdfDoc = await loadPdfDocument(file)
        setPdfData({ file, pageCount: meta.pageCount, isLocked: false, pdfDoc, thumbnail: meta.thumbnail })
        setCustomFileName(`${file.name.replace('.pdf', '')}-grayscale`)
      }
    } catch (err) {
      console.error(err)
      alert('Error processing PDF')
    } finally {
      setIsProcessing(false)
      setDownloadUrl(null)
    }
  }

  const convertToGrayscale = async () => {
    if (!pdfData || !pdfData.pdfDoc) return
    setIsProcessing(true)
    setProgress(0)
    await new Promise(resolve => setTimeout(resolve, 100))

    try {
      const outPdf = await PDFDocument.create()
      const scale = 1.5

      for (let i = 1; i <= pdfData.pageCount; i++) {
        const page = await pdfData.pdfDoc.getPage(i)
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) continue

        canvas.height = viewport.height
        canvas.width = viewport.width

        // Render page
        await page.render({ canvasContext: ctx, viewport }).promise

        // Apply Grayscale Filter
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        for (let j = 0; j < data.length; j += 4) {
          const avg = (data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114)
          data[j] = avg     // R
          data[j + 1] = avg // G
          data[j + 2] = avg // B
        }
        ctx.putImageData(imageData, 0, 0)

        // Convert to JPG
        const imgData = canvas.toDataURL('image/jpeg', 0.75)
        const img = await outPdf.embedJpg(imgData)

        const newPage = outPdf.addPage([viewport.width, viewport.height])
        newPage.drawImage(img, {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height,
        })

        setProgress(Math.round((i / pdfData.pageCount) * 100))
      }

      const pdfBytes = await outPdf.save()
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      addActivity({
        name: `${customFileName}.pdf`,
        tool: 'Grayscale',
        size: blob.size,
        resultUrl: url
      })
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const ActionButton = () => (
    <button
      onClick={convertToGrayscale}
      disabled={isProcessing}
      className="w-full bg-[var(--brand-color)] hover:bg-[var(--brand-color)]/90 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-[var(--brand-color)]/20 py-4 rounded-2xl text-sm md:p-6 md:rounded-3xl md:text-xl"
    >
      {isProcessing ? (
        <>
          <Loader2 className="animate-spin" size={18} />
          {progress}%
        </>
      ) : (
        <>
          <Palette size={18} />
          Convert to Grayscale
          <ArrowRight size={18} />
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
            <Palette size={18} />
            </span>
          PDF to Grayscale
        </h1>
       <p className="text-xs md:text-sm text-gray-400 mt-2 font-medium">
          Remove colors from your PDF to save ink and storage.
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
          <div className="w-20 h-20 bg-[var(--brand-color)]/10 dark:bg-[var(--brand-color)]/20 text-[var(--brand-color)] rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
            <Palette size={32} />
          </div>
          <h3 className="text-xl font-bold dark:text-white mb-2">Select PDF</h3>
          <p className="text-sm text-gray-400">Tap to start desaturating</p>
        </div>
        </div>
      ) : pdfData.isLocked ? (
        <div className="max-w-md mx-auto">
          <div className="bg-white dark:bg-neutral-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 text-center shadow-2xl">
            <div className="w-16 h-16 bg-[var(--brand-color)]/10 dark:bg-[var(--brand-color)]/30 text-[var(--brand-color)] rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-4 dark:text-white">Protected File</h3>
            <input
              type="password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-gray-50 dark:bg-black rounded-2xl px-6 py-4 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-center mb-6 dark:text-white"
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
            <div className="w-16 h-20 bg-gray-50 dark:bg-zinc-800 rounded-md overflow-hidden shrink-0 border border-gray-100 dark:border-zinc-800 flex items-center justify-center">
              {pdfData.thumbnail ? (
                <img src={pdfData.thumbnail} className="w-full h-full object-cover" alt="PDF Preview" />
              ) : (
                <Palette size={20} className="text-[var(--brand-color)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm truncate dark:text-white">{pdfData.file.name}</h3>
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
                <div className="text-center py-6 px-6 bg-gray-50 dark:bg-neutral-700 rounded-2xl border border-gray-100 dark:border-white/5">
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                    This tool converts all document pages to black-and-white.
                    Perfect for printing and reducing file size.
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

                {isProcessing && (
                  <div className="space-y-4">
                    <div className="w-full bg-gray-100 dark:bg-zinc-800 h-3 rounded-full overflow-hidden shadow-inner">
                      <div
                        className="bg-[var(--brand-color)] h-full transition-all rounded-full shadow-lg"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[12px] text-center font-black text-gray-500 uppercase tracking-widest animate-pulse">
                      Removing Chromatic Data...
                    </p>
                  </div>
                )}

                <ActionButton />
              </>
            ) : (
              <SuccessState
                message="Grayscale Conversion Complete!"
                downloadUrl={downloadUrl}
                fileName={`${customFileName}.pdf`}
                onStartOver={() => {
                  setDownloadUrl(null)
                  setProgress(0)
                  setPdfData(null)
                }}
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
    </div>
  )
}
