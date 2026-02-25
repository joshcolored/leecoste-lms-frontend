import { useState, useRef, useEffect } from 'react'
import { Loader2, Scissors, Check, Plus, Lock, ArrowRight, X, Zap, ArrowBigLeft } from 'lucide-react'
import JSZip from 'jszip'
import { useNavigate } from "react-router-dom"
// remove sonner import
// import { toast } from 'sonner'

import { getPdfMetaData, loadPdfDocument, renderGridThumbnail, unlockPdf } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
// remove pipeline context
// import { usePipeline } from '../../utils/pipelineContext'
import { useObjectURL } from '../../utils/useObjectURL'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'
// remove NativeToolLayout
// import { NativeToolLayout } from './shared/NativeToolLayout'

type SplitPdfFile = {
  file: File
  pageCount: number
  isLocked: boolean
  pdfDoc?: any
  password?: string
  thumbnail?: string
}

type Toast = {
  id: number
  type: 'success' | 'error'
  message: string
}

// very small local toast helper to replace sonner
function useLocalToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = (type: Toast['type'], message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  return {
    Toasts: () => (
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
    ),
    toastSuccess: (m: string) => show('success', m),
    toastError: (m: string) => show('error', m),
  }
}

const LazyThumbnail = ({ pdfDoc, pageNum }: { pdfDoc: any; pageNum: number }) => {
  const [src, setSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pdfDoc || src) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          renderGridThumbnail(pdfDoc, pageNum).then(setSrc)
          observer.disconnect()
        }
      },
      { rootMargin: '400px' }
    )
    if (imgRef.current) observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [pdfDoc, pageNum, src])

  if (src)
    return (
      <img
        src={src}
        className="w-full h-full object-cover animate-in fade-in duration-300"
        alt={`Page ${pageNum}`}
      />
    )
  return (
    <div
      ref={imgRef}
      className="w-full h-full bg-gray-50 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-gray-400"
    >
      <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent dark:border-zinc-700 rounded-full animate-spin" />
    </div>
  )
}

export default function SplitTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  // removed pipeline
  // const { consumePipelineFile } = usePipeline()
  const { objectUrl, createUrl, clearUrls } = useObjectURL()
  const [pdfData, setPdfData] = useState<SplitPdfFile | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingMeta, setIsLoadingMeta] = useState(false)
  const navigate = useNavigate()
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [customFileName, setCustomFileName] = useState('paperknife-split')
  const [rangeInput, setRangeInput] = useState('')
  const [splitMode, setSplitMode] = useState<'single' | 'individual'>('single')
  const [unlockPassword, setUnlockPassword] = useState('')
  const { Toasts, toastError, toastSuccess } = useLocalToast()

  // remove pipeline-driven auto-load
  // useEffect(() => {
  //   const pipelined = consumePipelineFile()
  //   if (pipelined) {
  //     const file = new File([pipelined.buffer as any], pipelined.name, { type: 'application/pdf' })
  //     handleFile(file)
  //   }
  // }, [])

  const handleUnlock = async () => {
    if (!pdfData || !unlockPassword) return
    setIsLoadingMeta(true)
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
      const all = new Set<number>()
      for (let i = 1; i <= result.pageCount; i++) all.add(i)
      setSelectedPages(all)
      setRangeInput(`1-${result.pageCount}`)
    } else {
      toastError('Incorrect password')
    }
    setIsLoadingMeta(false)
  }

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toastError('Please select a PDF file.')
      return
    }
    setIsLoadingMeta(true)
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
        const all = new Set<number>()
        for (let i = 1; i <= meta.pageCount; i++) all.add(i)
        setSelectedPages(all)
        setRangeInput(`1-${meta.pageCount}`)
      }
    } catch (err) {
      console.error(err)
      toastError('Failed to read PDF metadata.')
    } finally {
      setIsLoadingMeta(false)
      clearUrls()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0])
    if (e.target) e.target.value = ''
  }

  const togglePage = (pageNum: number) => {
    const newSelection = new Set(selectedPages)
    if (newSelection.has(pageNum)) newSelection.delete(pageNum)
    else newSelection.add(pageNum)
    setSelectedPages(newSelection)
    clearUrls()
  }

  const parseRange = (text: string) => {
    if (!pdfData) return
    const pages = new Set<number>()
    const parts = text.split(',').map(p => p.trim())
    parts.forEach(part => {
      if (!part) return
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number)
        if (!isNaN(start) && !isNaN(end)) {
          for (
            let i = Math.max(1, start);
            i <= Math.min(end, pdfData.pageCount);
            i++
          )
            pages.add(i)
        }
      } else {
        const num = Number(part)
        if (!isNaN(num) && num >= 1 && num <= pdfData.pageCount) pages.add(num)
      }
    })
    setSelectedPages(pages)
    clearUrls()
  }

  const splitPDF = async () => {
    if (!pdfData || selectedPages.size === 0) return
    setIsProcessing(true)
    try {
      const buffer = await pdfData.file.arrayBuffer()
      const worker = new Worker(
        new URL('../../utils/pdfWorker.ts', import.meta.url),
        { type: 'module' }
      )
      worker.postMessage({
        type: 'SPLIT_PDF',
        payload: {
          buffer,
          password: pdfData.password,
          selectedPages: Array.from(selectedPages),
          mode: splitMode,
          customFileName,
        },
      })
      worker.onmessage = async e => {
        const { type, payload } = e.data
        if (type === 'SUCCESS') {
          const blob = new Blob([payload], { type: 'application/pdf' })
          const url = createUrl(blob)
          addActivity({
            name: `${customFileName || 'split'}.pdf`,
            tool: 'Split',
            size: blob.size,
            resultUrl: url,
          })
          toastSuccess('Split successful.')
          setIsProcessing(false)
          worker.terminate()
        } else if (type === 'SUCCESS_BATCH') {
          const zip = new JSZip()
          payload.forEach((res: { name: string; buffer: Uint8Array }) => {
            zip.file(res.name, res.buffer)
          })
          const zipBlob = await zip.generateAsync({ type: 'blob' })
          const url = createUrl(zipBlob)
          addActivity({
            name: `${customFileName || 'split'}.zip`,
            tool: 'Split',
            size: zipBlob.size,
            resultUrl: url,
          })
          toastSuccess('Split successful.')
          setIsProcessing(false)
          worker.terminate()
        } else if (type === 'ERROR') {
          toastError(payload || 'Error splitting PDF.')
          setIsProcessing(false)
          worker.terminate()
        }
      }
    } catch (error: any) {
      toastError(error?.message || 'Error splitting PDF.')
      setIsProcessing(false)
    }
  }

  const ActionButton = () => (
    <button
      onClick={splitPDF}
      disabled={isProcessing || selectedPages.size === 0}
      className={`w-full bg-[var(--brand-color)] hover:opacity-70 text-white font-semibold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 py-4 rounded-2xl text-sm md:p-6 md:rounded-lg md:text-xl flex items-center justify-center gap-3 shadow-lg shadow-rose-500/20`}
    >
      {isProcessing ? (
        <>
          <Loader2 className="animate-spin" /> Working...
        </>
      ) : (
        <>
          Extract {selectedPages.size} Pages <ArrowRight size={18} />
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
      {/* simple header to replace NativeToolLayout title */}
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight dark:text-white flex items-center gap-3">
          <span className="w-9 h-9 rounded-2xl bg-[var(--brand-color)] text-white flex items-center justify-center">
            <Scissors size={18} />
          </span>
          Split PDF
        </h1>
        <p className="text-xs md:text-sm text-gray-400 mt-2 font-medium">
          Select pages visually or by range to extract them. Everything stays on your device.
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
        <button
          className={`w-full dark:border-zinc-900  dark:bg-neutral-800 rounded-xl p-12 text-center transition-all cursor-default group ${isLoadingMeta ? 'cursor-wait' : ''
            }`}
        >
          {isLoadingMeta ? (
            <div className="flex flex-col items-center">
              <Loader2 size={48} className="text-[var(--brand-color)] animate-spin mb-4" />
              <h3 className="text-xl dark:text-white font-bold mb-2">Analyzing PDF...</h3>
            </div>
          ) : (
            <>
            <div onClick={() => !isLoadingMeta && fileInputRef.current?.click()}  className="border-2 border-dashed border-gray-500 bg-neutral-100 mb-8 dark:bg-neutral-700 dark:border-neutral-300 max-w-4xl mx-auto p-8 space-y-8 dark:border-neutral-800 rounded-lg p-16 text-center cursor-pointer hover:bg-rose-50 dark:hover:bg-neutral-900 transition">
              <div className="w-20 h-20 bg-[var(--brand-color)] text-white  rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Scissors size={32} />
              </div>
              <h3 className="text-xl font-bold dark:text-white mb-2">
                Select PDF File
              </h3>
              <p className="text-sm text-gray-400 font-medium">
                Tap to start splitting
              </p>
              </div>
            </>
          )}
        </button>
      ) : pdfData.isLocked ? (
        <div className="max-w-md mx-auto relative z-[100]">
          <div className="bg-white dark:bg-neutral-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-2xl text-center">
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
              disabled={!unlockPassword || isLoadingMeta}
              className="w-full bg-[var(--brand-color)] text-white p-4 rounded-2xl font-semibold uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-50"
            >
              Unlock PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg border border-gray-100 dark:border-white/5 flex items-center gap-6 shadow-sm">
            <div className="w-12 h-16 bg-gray-50 dark:bg-black rounded-md overflow-hidden shrink-0 border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-rose-500 shadow-inner">
              {pdfData.thumbnail ? (
                <img
                  src={pdfData.thumbnail}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Scissors size={24} />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h3 className="font-bold text-sm truncate dark:text-white">
                {pdfData.file.name}
              </h3>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">
                {pdfData.pageCount} Pages •{' '}
                {(pdfData.file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
            <button
              onClick={() => setPdfData(null)}
              className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {pdfData.pageCount > 50 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-4 rounded-lg flex items-center gap-3 text-amber-600 dark:text-amber-400 animate-in fade-in duration-500">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center shrink-0">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest leading-none mb-1">
                  Heavy Document
                </p>
                <p className="text-[11px] font-medium leading-tight">
                  Visual selection for large files may be slower. Use range
                  selection for speed.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg border border-gray-100 dark:border-white/5 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="font-semibold uppercase tracking-widest text-[10px] text-gray-400 px-2">
                    Page Selection
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const all = new Set<number>()
                        for (let i = 1; i <= pdfData.pageCount; i++)
                          all.add(i)
                        setSelectedPages(all)
                      }}
                      className="text-[10px] font-semibold uppercase text-[var(--brand-color)] hover:bg-[var(--brand-color)] hover:text-white px-2 py-1 rounded-lg transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedPages(new Set())}
                      className="text-[10px] font-semibold uppercase text-gray-400 px-2 py-1 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-1 scrollbar-hide">
                  {Array.from({ length: pdfData.pageCount }).map((_, i) => {
                    const pageNum = i + 1
                    const isSelected = selectedPages.has(pageNum)
                    return (
                      <div
                        key={pageNum}
                        onClick={() => togglePage(pageNum)}
                        className={`relative group cursor-pointer aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${isSelected
                            ? 'border-[var(--brand-color)] shadow-md scale-[1.02]'
                            : 'border-transparent hover:border-gray-200 dark:hover:border-zinc-800'
                          }`}
                      >
                        <LazyThumbnail
                          pdfDoc={pdfData.pdfDoc}
                          pageNum={pageNum}
                        />
                        <div
                          className={`absolute inset-0 flex items-center justify-center transition-opacity ${isSelected
                              ? 'bg-[rose-500/10] opacity-100'
                              : 'bg-black/20 opacity-0 group-hover:opacity-100'
                            }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform ${isSelected
                                ? 'bg-[var(--brand-color)] text-white scale-100'
                                : 'bg-white text-gray-400 scale-75'
                              }`}
                          >
                            {isSelected ? (
                              <Check size={20} strokeWidth={3} />
                            ) : (
                              <Plus size={20} />
                            )}
                          </div>
                        </div>
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[9px] font-semibold text-white">
                          PAGE {pageNum}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-neutral-800 p-8 rounded-lg border border-gray-100 dark:border-white/5 shadow-sm sticky top-24">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                        Split Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-black p-1 rounded-2xl">
                        <button
                          onClick={() => {
                            setSplitMode('single')
                            clearUrls()
                          }}
                          className={`py-2 px-3 rounded-xl text-[9px] font-semibold uppercase transition-all ${splitMode === 'single'
                              ? 'bg-white dark:bg-zinc-800 text-[var(--brand-color)] shadow-sm'
                              : 'text-gray-400'
                            }`}
                        >
                          One Document
                        </button>
                        <button
                          onClick={() => {
                            setSplitMode('individual')
                            clearUrls()
                          }}
                          className={`py-2 px-3 rounded-xl text-[9px] font-semibold uppercase transition-all ${splitMode === 'individual'
                              ? 'bg-white dark:bg-zinc-800 text-[var(--brand-color)] shadow-sm'
                              : 'text-gray-400'
                            }`}
                        >
                          Separate Files
                        </button>
                      </div>
                      <p className="text-[8px] text-gray-400 mt-2 px-1 leading-relaxed font-bold uppercase tracking-tight">
                        <b>One Document:</b> Merges selected pages into one PDF.
                        <br />
                        <b>Separate Files:</b> Each page becomes its own PDF
                        (ZIP).
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                        Output Filename
                      </label>
                      <input
                        type="text"
                        value={customFileName}
                        onChange={e => setCustomFileName(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-sm dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                        Range Selection
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={rangeInput}
                          onChange={e => setRangeInput(e.target.value)}
                          placeholder="e.g. 1, 3-5"
                          className="flex-1 bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-sm dark:text-white"
                        />
                        <button
                          onClick={() => parseRange(rangeInput)}
                          className="px-4 bg-[var(--brand-color)] text-white rounded-xl font-semibold text-[10px] uppercase active:scale-95 transition-transform"
                        >
                          Apply
                        </button>
                      </div>
                      <p className="text-[8px] text-gray-400 mt-2 px-1">
                        Use commas for separate pages and dashes for ranges.
                      </p>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-gray-100 dark:border-white/5">
                    <div className="flex justify-between items-end mb-4 px-1">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.2em]">
                        Selected
                      </span>
                      <span className="text-xl font-semibold text-[var(--brand-color)]">
                        {selectedPages.size}{' '}
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          Pages
                        </span>
                      </span>
                    </div>
                    {objectUrl && (
                      <SuccessState
                        message="Split Successful!"
                        downloadUrl={objectUrl}
                        fileName={`${customFileName || 'split'}.${splitMode === 'single' ? 'pdf' : 'zip'
                          }`}
                        onStartOver={() => {
                          clearUrls()
                          setPdfData(null)
                          setIsProcessing(false)
                        }}
                        showPreview={splitMode === 'single'}
                      />
                    )}
                    {!objectUrl && (
                      <div className="mt-4">
                        <ActionButton />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setPdfData(null)
                      clearUrls()
                    }}
                    className="w-full py-2 text-[10px] font-semibold uppercase text-gray-300 hover:text-[var(--brand-color)] transition-colors"
                  >
                    Close File
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <PrivacyBadge />
      </div>

      {/* inline toast container */}
      <Toasts />
    </div>
  )
}
