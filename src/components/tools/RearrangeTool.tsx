import { useState, useRef, useEffect } from 'react'
import { Loader2, Lock, Grid, Move, RefreshCcw, X, ArrowBigLeft, Check } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { useNavigate } from "react-router-dom"
import { getPdfMetaData, loadPdfDocument, renderPageThumbnail, unlockPdf } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'

// ---------- Minimal local toast (replacing sonner) ----------
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

type RearrangePdfData = {
  file: File
  pageCount: number
  isLocked: boolean
  pdfDoc?: any
  password?: string
  thumbnail?: string
}

const LazyThumbnail = ({ pdfDoc, pageNum }: { pdfDoc: any; pageNum: number }) => {
  const [src, setSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pdfDoc || src) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        renderPageThumbnail(pdfDoc, pageNum, 1.0).then(setSrc)
        observer.disconnect()
      }
    }, { rootMargin: '200px' })
    if (imgRef.current) observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [pdfDoc, pageNum, src])

  if (src)
    return (
      <img
        src={src}
        className="w-full h-full object-contain bg-white pointer-events-none"
        alt={`P${pageNum}`}
      />
    )
  return (
    <div
      ref={imgRef}
      className="w-full h-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center"
    >
      <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ---------- Simple drag & drop (replacing dnd-kit) ----------
function SortablePage({
  pageNum,
  pdfDoc,
  index,
  moveItem,
  isDragging,
}: {
  id: string
  pageNum: number
  pdfDoc: any
  index: number
  moveItem: (from: number, to: number) => void
  isDragging: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [isGrabbed, setIsGrabbed] = useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsGrabbed(true)
    e.preventDefault()
  }
  const handleMouseMove = (e: MouseEvent) => {
    if (!isGrabbed || !ref.current) return
    const containerRect = ref.current.parentElement!.getBoundingClientRect()

    let newIndex = index
    const mouseX = e.clientX - containerRect.left
    const mouseY = e.clientY - containerRect.top

    // Simple closest sibling detection
    const siblings = Array.from(ref.current.parentElement!.children)
    siblings.forEach((sibling, siblingIndex) => {
      if (sibling === ref.current) return
      const siblingRect = sibling.getBoundingClientRect()
      const siblingCenterY = (siblingRect.top + siblingRect.bottom) / 2 - containerRect.top
      const siblingCenterX = (siblingRect.left + siblingRect.right) / 2 - containerRect.left

      if (Math.abs(mouseX - siblingCenterX) < 50 && Math.abs(mouseY - siblingCenterY) < 100) {
        newIndex = siblingIndex
      }
    })

    if (newIndex !== index) {
      moveItem(index, newIndex)
    }
  }

  const handleMouseUp = () => {
    setIsGrabbed(false)
  }

  useEffect(() => {
    if (isGrabbed) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isGrabbed, index, moveItem])

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      className={`relative group cursor-grab active:cursor-grabbing aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all bg-gray-50 dark:bg-neutral-900 touch-none ${isDragging
        ? 'border-[var(--brand-color)] shadow-2xl scale-105 opacity-90'
        : 'border-transparent hover:border-[var(--brand-color)] shadow-sm'
        }`}
    >
      <div className="w-full h-full p-2">
        <LazyThumbnail pdfDoc={pdfDoc} pageNum={pageNum} />
      </div>
      <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md rounded-lg p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity">
        <Move size={14} />
      </div>
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[9px] font-black text-white">
        PAGE {pageNum}
      </div>
    </div>
  )
}

export default function RearrangeTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pdfData, setPdfData] = useState<RearrangePdfData | null>(null)
  const [pageOrder, setPageOrder] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [customFileName, setCustomFileName] = useState('paperknife-rearranged')
  const [unlockPassword, setUnlockPassword] = useState('')
  const navigate = useNavigate()
  const { Toasts, toastError } = useLocalToast()

  const moveItem = (fromIndex: number, toIndex: number) => {
    setPageOrder(prev => {
      const newOrder = [...prev]
      const [moved] = newOrder.splice(fromIndex, 1)
      newOrder.splice(toIndex, 0, moved)
      return newOrder
    })
    setDownloadUrl(null)
  }

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
        password: unlockPassword,
        thumbnail: result.thumbnail,
      })
      setPageOrder(
        Array.from({ length: result.pageCount }, (_, i) => (i + 1).toString()),
      )
      setCustomFileName(
        `${pdfData.file.name.replace(/\.pdf$/i, '')}-rearranged`,
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
        setPageOrder(
          Array.from({ length: meta.pageCount }, (_, i) =>
            (i + 1).toString(),
          ),
        )
        setCustomFileName(`${file.name.replace(/\.pdf$/i, '')}-rearranged`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsProcessing(false)
      setDownloadUrl(null)
    }
  }

  const savePDF = async () => {
    if (!pdfData) return
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 100))
    try {
      const arrayBuffer = await pdfData.file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer, {
        password: pdfData.password || undefined,
        ignoreEncryption: true,
      } as any)
      const newPdf = await PDFDocument.create()
      const indices = pageOrder.map(id => parseInt(id) - 1)
      const copiedPages = await newPdf.copyPages(pdfDoc, indices)
      copiedPages.forEach(page => newPdf.addPage(page))
      const pdfBytes = await newPdf.save()
      const blob = new Blob([pdfBytes as any], {
        type: 'application/pdf',
      })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      addActivity({
        name: `${customFileName}.pdf`,
        tool: 'Rearrange',
        size: blob.size,
        resultUrl: url,
      })
    } catch (error: any) {
      toastError(`Error: ${error.message || 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const ActionButton = () => (
    <button
      onClick={savePDF}
      disabled={isProcessing}
      className="w-full bg-[var(--brand-color)] hover:bg-[var(--brand-color)] text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 py-4 rounded-2xl text-sm md:p-6 md:rounded-3xl md:text-xl flex items-center justify-center gap-3 shadow-lg shadow-[var(--brand-color)]/20"
    >
      {isProcessing ? (
        <Loader2 className="animate-spin" />
      ) : (
        <RefreshCcw size={20} />
      )}{' '}
      Save New Order
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
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight dark:text-white flex items-center gap-3">
          <span className="w-9 h-9 rounded-2xl bg-[var(--brand-color)] text-white flex items-center justify-center">
            <Grid size={18} />
          </span>
          Rearrange PDF
        </h1>
        <p className="text-xs md:text-sm text-gray-400 mt-2 font-medium">
          Drag and drop to reorder pages visually.
        </p>
      </header>

      <input
        type="file"
        accept=".pdf"
        className="hidden"
        ref={fileInputRef}
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {!pdfData ? (
        <div
          className="w-full border-gray-100  dark:bg-neutral-800 rounded-lg p-12 text-center transition-all cursor-default group"
        >
          <div onClick={() => !isProcessing && fileInputRef.current?.click()} className="border-2 border-dashed border-gray-500 bg-neutral-100 mb-8 dark:bg-neutral-700 dark:border-neutral-300 max-w-4xl mx-auto p-8 space-y-8 dark:border-neutral-800 rounded-lg p-16 text-center cursor-pointer hover:bg-rose-50 dark:hover:bg-neutral-800 transition">
            <div className="w-20 h-20 bg-[var(--brand-color)] text-white  rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Grid size={32} />
            </div>
            <h3 className="text-xl font-bold dark:text-white mb-2">
              Select PDF
            </h3>
            <p className="text-sm text-gray-400 font-medium">
              Tap to start reordering
            </p>
          </div>
        </div>
      ) : pdfData.isLocked ? (
        <div className="max-w-md mx-auto relative z-[100]">
          <div className="bg-white dark:bg-neutral-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 text-center shadow-2xl">
            <div className="w-16 h-16 bg-[var(--brand-color)/10] dark:bg-[var(--brand-color)/20] text-[var(--brand-color)] rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-2 dark:text-white">
              Protected File
            </h3>
            <input
              type="password"
              value={unlockPassword}
              onChange={e => setUnlockPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-gray-50 dark:bg-black rounded-2xl px-6 py-4 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-center mb-4 dark:text-white"
            />
            <button
              onClick={handleUnlock}
              disabled={!unlockPassword || isProcessing}
              className="w-full bg-[var(--brand-color)] text-white p-4 rounded-2xl font-black uppercase text-xs hover:bg-[var(--brand-color)]"
            >
              Unlock
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-3xl border border-gray-100 dark:border-white/5 flex items-center gap-6 shadow-sm">
            <div className="w-12 h-16 bg-gray-50 dark:bg-black rounded-xl overflow-hidden shrink-0 border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-[var(--brand-color)] shadow-inner">
              {pdfData.thumbnail ? (
                <img
                  src={pdfData.thumbnail}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Grid size={24} />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h3 className="font-bold text-sm truncate dark:text-white">
                {pdfData.file.name}
              </h3>
              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
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

          <div className="bg-white dark:bg-neutral-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex justify-between items-center mb-6 px-2">
              <h4 className="font-black uppercase tracking-widest text-[10px] text-gray-400">
                Hold &amp; drag pages
              </h4>
              <button
                onClick={() =>
                  setPageOrder(
                    Array.from({ length: pdfData.pageCount }, (_, i) =>
                      (i + 1).toString(),
                    ),
                  )
                }
                className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-1 hover:text-[var(--brand-color)] transition-colors font-bold"
              >
                <RefreshCcw size={12} />
                Reset
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-1 relative">
              {pageOrder.map((id, index) => (
                <SortablePage
                  key={id}
                  id={id}
                  pageNum={parseInt(id)}
                  pdfDoc={pdfData.pdfDoc}
                  index={index}
                  moveItem={moveItem}
                  isDragging={false}
                />
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-800 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm space-y-6">
            {!downloadUrl ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-3">
                    Output Filename
                  </label>
                  <input
                    type="text"
                    value={customFileName}
                    onChange={e => setCustomFileName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-neutral-900 rounded-xl px-4 py-3 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-sm dark:text-white"
                  />
                </div>
                {!isProcessing && <ActionButton />}
              </div>
            ) : (
              <SuccessState
                message="Rearranged Successfully!"
                downloadUrl={downloadUrl}
                fileName={`${customFileName}.pdf`}
                onStartOver={() => {
                  setDownloadUrl(null)
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

      <div className="mt-6">
        <PrivacyBadge />
      </div>

      <Toasts />
    </div>
  )
}
