import { useState, useRef } from 'react'
import { Hash, Lock, Loader2, Eye, ArrowBigLeft, Check, X } from 'lucide-react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { useNavigate } from "react-router-dom"
import { getPdfMetaData, unlockPdf, loadPdfDocument } from '../../utils/pdfHelpers'
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
    <div className="fixed top-[80px] right-4 z-[9999] space-y-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-right-2 fade-in duration-200 ${
            t.type === 'error'
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

type PageNumberPdfData = { file: File, pageCount: number, isLocked: boolean, password?: string, pdfDoc?: any, thumbnail?: string }
type Position = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

export default function PageNumberTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { Toasts, toastError, toastSuccess } = useLocalToast()
  
  const [pdfData, setPdfData] = useState<PageNumberPdfData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [customFileName, setCustomFileName] = useState('paperknife-numbered')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [format, setFormat] = useState('Page {n} of {total}')
  const [position, setPosition] = useState<Position>('bottom-center')
  const [startFrom] = useState(1)
  const [fontSize] = useState(12)
  const [color] = useState('#6B7280')

  const handleUnlock = async () => {
    if (!pdfData || !unlockPassword) return
    setIsProcessing(true)
    const result = await unlockPdf(pdfData.file, unlockPassword)
    if (result.success) {
      setPdfData({ 
        ...pdfData, 
        isLocked: false, 
        pageCount: result.pageCount, 
        password: unlockPassword, 
        pdfDoc: result.pdfDoc, 
        thumbnail: result.thumbnail 
      })
      setCustomFileName(`${pdfData.file.name.replace('.pdf', '')}-numbered`)
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
          thumbnail: meta.thumbnail 
        })
        setCustomFileName(`${file.name.replace('.pdf', '')}-numbered`)
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

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    return rgb(r, g, b)
  }

  const applyPageNumbers = async () => {
    if (!pdfData) return
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 100))
    try {
      const arrayBuffer = await pdfData.file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer, { 
        password: pdfData.password || undefined, 
        ignoreEncryption: true 
      } as any)
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const pages = pdfDoc.getPages()
      const textColor = hexToRgb(color)
      
      pages.forEach((page, idx) => {
        const { width, height } = page.getSize()
        const n = idx + startFrom
        const total = pages.length + (startFrom - 1)
        const label = format.replace('{n}', n.toString()).replace('{total}', total.toString())
        const textWidth = font.widthOfTextAtSize(label, fontSize)
        const margin = 30
        let x = width / 2 - textWidth / 2
        let y = margin
        
        if (position.includes('left')) x = margin
        if (position.includes('right')) x = width - textWidth - margin
        if (position.includes('top')) y = height - margin - fontSize
        
        page.drawText(label, { x, y, size: fontSize, font, color: textColor })
      })
      
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      addActivity({ 
        name: `${customFileName}.pdf`, 
        tool: 'Page Numbers', 
        size: blob.size, 
        resultUrl: url 
      })
      toastSuccess('Page numbers applied successfully!')
    } catch (error: any) { 
      toastError(`Error: ${error.message}`)
    } finally { 
      setIsProcessing(false) 
    }
  }

  const ActionButton = () => (
    <button 
      onClick={applyPageNumbers} 
      disabled={isProcessing} 
      className="w-full bg-[var(--brand-color)] hover:bg-[var(--brand-color)]/90 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 py-4 rounded-2xl text-sm md:p-6 md:rounded-3xl md:text-xl flex items-center justify-center gap-3 shadow-lg shadow-[var(--brand-color)]/20"
    >
      {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Hash size={20} />}
      Add Page Numbers
    </button>
  )

  const getPreviewStyles = () => {
    const styles: React.CSSProperties = { 
      position: 'absolute', 
      padding: '10px', 
      color, 
      fontSize: '8px', 
      fontWeight: 'bold' 
    }
    if (position.includes('top')) styles.top = 0
    else styles.bottom = 0
    if (position.includes('left')) styles.left = 0
    else if (position.includes('right')) styles.right = 0
    else { 
      styles.left = '50%'
      styles.transform = 'translateX(-50%)'
    }
    return styles
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
      
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight dark:text-white flex items-center gap-3">
          <span className="w-9 h-9 rounded-2xl bg-[var(--brand-color)] text-white flex items-center justify-center">
            <Hash size={18} />
          </span>
          Page Numbers
        </h1>
        <p className="text-xs md:text-sm text-gray-400 mt-2 font-medium">
          Add custom numbering to your PDF automatically.
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
        <div className="w-full border-gray-100 dark:bg-neutral-800 rounded-lg p-12 text-center transition-all cursor-default group">
          <div 
            onClick={() => !isProcessing && fileInputRef.current?.click()} 
            className="border-2 border-dashed border-gray-500 bg-neutral-100 mb-8 dark:bg-neutral-700 dark:border-neutral-300 max-w-4xl mx-auto p-8 space-y-8 dark:border-neutral-800 rounded-lg p-16 text-center cursor-pointer hover:bg-[var(--brand-color)]/5 dark:hover:bg-[var(--brand-color)]/10 transition-all"
          >
            <div className="w-20 h-20 bg-[var(--brand-color)] text-white rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Hash size={32} />
            </div>
            <h3 className="text-xl font-bold dark:text-white mb-2">Select PDF</h3>
            <p className="text-sm text-gray-400">Tap to start numbering</p>
          </div>
        </div>
      ) : pdfData.isLocked ? (
        <div className="max-w-md mx-auto relative z-[100]">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 text-center shadow-2xl">
            <div className="w-16 h-16 bg-[var(--brand-color)]/10 dark:bg-[var(--brand-color)]/30 text-[var(--brand-color)] rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock size={32} />
            </div>
            <input 
              type="password" 
              value={unlockPassword} 
              onChange={(e) => setUnlockPassword(e.target.value)} 
              placeholder="Password" 
              className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-4 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-center mb-4 dark:text-white" 
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col items-center">
              <div className="flex justify-between items-center w-full mb-4 px-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <Eye size={12}/>
                  Live Preview
                </h4>
              </div>
              <div className="relative aspect-[3/4] w-full max-w-[300px] bg-white border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-inner">
                {pdfData.thumbnail ? (
                  <img src={pdfData.thumbnail} className="w-full h-full object-contain" alt="PDF Preview" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-100">
                    <Hash size={64} />
                  </div>
                )}
                <div style={getPreviewStyles()}>
                  {format.replace('{n}', '1').replace('{total}', pdfData.pageCount.toString())}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm space-y-6">
              {!downloadUrl ? (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-3">Label Format</label>
                    <input 
                      type="text" 
                      value={format} 
                      onChange={(e) => setFormat(e.target.value)} 
                      className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-sm dark:text-white" 
                      placeholder="Page {n} of {total}" 
                    />
                    <p className="text-[8px] text-gray-400 mt-2">
                      Use <b>{'{n}'}</b> for page number and <b>{'{total}'}</b> for total pages.
                    </p>
                  </div>
                 
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-3">Position</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as Position[]).map(pos => (
                        <button 
                          key={pos} 
                          onClick={() => setPosition(pos)} 
                          className={`py-3 px-1 rounded-xl text-[8px] font-black uppercase transition-all border hover:text-[var(--brand-color)] hover:border-[var(--brand-color)] ${
                            position === pos 
                              ? 'bg-[var(--brand-color)] text-white border-[var(--brand-color)] shadow-lg shadow-[var(--brand-color)]/20' 
                              : 'bg-gray-50 dark:bg-black text-gray-400 border-gray-100 dark:border-zinc-800'
                          }`}
                        >
                          {pos.replace('-', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-3">Output Filename</label>
                    <input 
                      type="text" 
                      value={customFileName} 
                      onChange={(e) => setCustomFileName(e.target.value)} 
                      className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-sm dark:text-white" 
                    />
                  </div>

                  <ActionButton />
                </>
              ) : (
                <SuccessState 
                  message="Numbers Applied Successfully!" 
                  downloadUrl={downloadUrl} 
                  fileName={`${customFileName}.pdf`} 
                  onStartOver={() => setDownloadUrl(null)} 
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
        </div>
      )}
      <PrivacyBadge />
      
      <Toasts />
    </div>
  )
}
