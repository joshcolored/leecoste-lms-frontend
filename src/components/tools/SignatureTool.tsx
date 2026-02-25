import { useState, useRef } from 'react'
import { Loader2, Lock, Image as ImageIcon, ArrowRight, ArrowBigLeft, PenTool } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { useNavigate } from "react-router-dom"
import { getPdfMetaData, loadPdfDocument, renderPageThumbnail, unlockPdf } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'

type SignaturePdfData = { file: File, pageCount: number, isLocked: boolean, pdfDoc?: any, password?: string }

export default function SignatureTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const signatureInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const [pdfData, setPdfData] = useState<SignaturePdfData | null>(null)
  const [signatureImg, setSignatureImg] = useState<string | null>(null)
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [customFileName, setCustomFileName] = useState('paperknife-signed')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [activePage] = useState(1)
  const [pos, setPos] = useState({ x: 50, y: 50 })
  const [size, setSize] = useState(150)
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [isDraggingSig, setIsDraggingSig] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const navigate = useNavigate()
  const handleUnlock = async () => {
    if (!pdfData || !unlockPassword) return
    setIsProcessing(true)
    try {
      const result = await unlockPdf(pdfData.file, unlockPassword)
      if (result.success) {
        setPdfData({ ...pdfData, isLocked: false, pageCount: result.pageCount, pdfDoc: result.pdfDoc, password: unlockPassword })
        const thumb = await renderPageThumbnail(result.pdfDoc, 1, 2.0)
        setThumbnail(thumb)
      } else {
        alert('Incorrect password')
      }
    } finally {
      setIsProcessing(false)
    }
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
        setPdfData({ file, pageCount: meta.pageCount, isLocked: false, pdfDoc })
        const thumb = await renderPageThumbnail(pdfDoc, 1, 2.0)
        setThumbnail(thumb)
      }
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    if (isDraggingSig) {
      setPos({
        x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
        y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
      })
    } else if (isResizing) {
      const sigX = (pos.x / 100) * rect.width + rect.left
      setSize(Math.max(50, Math.min(rect.width, clientX - (sigX - (size / 2)))))
    }
  }

  const saveSignedPdf = async () => {
    if (!pdfData || !signatureFile) return
    setIsProcessing(true)
    try {
      const arrayBuffer = await pdfData.file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer, {
        password: pdfData.password,
        ignoreEncryption: true
      } as any)
      const sigBytes = await signatureFile.arrayBuffer()
      let sigImage = signatureFile.type === 'image/png'
        ? await pdfDoc.embedPng(sigBytes)
        : await pdfDoc.embedJpg(sigBytes)
      const page = pdfDoc.getPages()[activePage - 1]
      const { width, height } = page.getSize()
      const pdfX = (pos.x / 100) * width
      const pdfY = height - ((pos.y / 100) * height) - (size * (sigImage.height / sigImage.width))
      page.drawImage(sigImage, {
        x: pdfX,
        y: pdfY,
        width: size,
        height: size * (sigImage.height / sigImage.width)
      })
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      addActivity({
        name: `${customFileName}.pdf`,
        tool: 'Signature',
        size: blob.size,
        resultUrl: url
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const ActionButton = () => (
    <button
      onClick={saveSignedPdf}
      disabled={isProcessing || !signatureImg}
      className="w-full bg-[var(--brand-color)] hover:bg-[var(--brand-color)]/90 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-[var(--brand-color)]/20 py-4 rounded-2xl text-sm md:p-6 md:rounded-3xl md:text-xl"
    >
      {isProcessing ? <Loader2 className="animate-spin" /> : <>Sign & Save <ArrowRight size={18} /></>}
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
            <PenTool size={18} />
            </span>
          Signature
        </h1>
        <p className="text-xs md:text-sm text-gray-400 mt-2 font-medium">
          Sign any PDF by dragging your signature image.
        </p>
      </header>

      <input
        type="file"
        accept=".pdf"
        className="hidden"
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={signatureInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            setSignatureFile(file)
            setSignatureImg(URL.createObjectURL(file))
          }
        }}
      />

      {!pdfData ? (
        <div
          className="w-full border-gray-100  dark:bg-neutral-800 rounded-lg p-12 text-center transition-all cursor-default group"
        >
         <div onClick={() => !isProcessing && fileInputRef.current?.click()} className="border-2 border-dashed border-gray-500 bg-neutral-100 mb-8 dark:bg-neutral-700 dark:border-neutral-300 max-w-4xl mx-auto p-8 space-y-8 dark:border-neutral-800 rounded-lg p-16 text-center cursor-pointer hover:bg-rose-50 dark:hover:bg-neutral-800 transition">
          <ImageIcon size={32} className="mx-auto mb-6 text-[var(--brand-color)] group-hover:scale-110 transition-transform" />
          <h3 className="text-xl font-bold dark:text-white mb-2">Select PDF</h3>
          <p className="text-sm text-gray-400">Choose your document to sign</p>
        </div>
        </div>
      ) : pdfData.isLocked ? (
        <div className="max-w-md mx-auto p-8 bg-white dark:bg-neutral-800 rounded-[2.5rem] border border-gray-100 dark:border-white/5 text-center shadow-2xl">
          <Lock size={32} className="mx-auto mb-6 text-[var(--brand-color)]" />
          <h3 className="text-xl font-bold mb-4 dark:text-white">File Protected</h3>
          <input
            type="password"
            value={unlockPassword}
            onChange={(e) => setUnlockPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full p-4 mb-6 border border-transparent rounded-2xl bg-gray-50 dark:bg-zinc-800 focus:border-[var(--brand-color)] outline-none font-bold text-center dark:text-white"
          />
          <button
            onClick={handleUnlock}
            disabled={!unlockPassword || isProcessing}
            className="w-full p-4 bg-[var(--brand-color)] hover:bg-[var(--brand-color)]/90 text-white rounded-2xl font-black uppercase text-xs transition-all active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Unlock'}
          </button>
        </div>
      ) : (
        <div
          className="space-y-6"
          onMouseMove={handleMouseMove}
          onTouchMove={handleMouseMove}
          onMouseUp={() => { setIsDraggingSig(false); setIsResizing(false); }}
          onTouchEnd={() => { setIsDraggingSig(false); setIsResizing(false); }}
        >
          {!downloadUrl ? (
            <>
              <div
                className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-gray-100 dark:border-white/5 relative aspect-[1/1.4] overflow-hidden touch-none cursor-pointer"
                ref={previewRef}
                onClick={(e) => {
                  if (!signatureImg || isDraggingSig || isResizing) return
                  const r = e.currentTarget.getBoundingClientRect()
                  setPos({
                    x: ((e.clientX - r.left) / r.width) * 100,
                    y: ((e.clientY - r.top) / r.height) * 100
                  })
                }}
              >
                {thumbnail ? (
                  <img src={thumbnail} className="w-full h-full rounded-lg object-contain" alt="PDF Preview" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="animate-spin text-[var(--brand-color)]" size={32} />
                  </div>
                )}
                {signatureImg && (
                  <div
                    onMouseDown={(e) => { e.stopPropagation(); setIsDraggingSig(true) }}
                    onTouchStart={(e) => { e.stopPropagation(); setIsDraggingSig(true) }}
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      width: `${size}px`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    className="absolute cursor-move ring-2 ring-[var(--brand-color)]/50 rounded-sm shadow-lg"
                  >
                    <img src={signatureImg} className="w-full pointer-events-none drop-shadow-md" />
                    <div
                      onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true) }}
                      onTouchStart={(e) => { e.stopPropagation(); setIsResizing(true) }}
                      className="absolute -bottom-2 -right-2 w-6 h-6 bg-[var(--brand-color)] rounded-full border-2 border-white cursor-nwse-resize shadow-md flex items-center justify-center"
                    >
                      <div className="w-2 h-2 bg-white rounded-sm" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => signatureInputRef.current?.click()}
                  className="flex-1 p-4 bg-gray-50 dark:bg-neutral-700 text-gray-900 dark:text-white border-2 border-gray-100 dark:border-white/5 rounded-2xl font-black uppercase text-xs hover:border-[var(--brand-color)] hover:bg-[var(--brand-color)]/5 transition-all hover:text-[var(--brand-color)]"
                >
                  <span className="flex items-center justify-center gap-2">
                    <ImageIcon size={16} />
                    Upload Signature
                  </span>
                </button>
              </div>

              <div className="bg-white dark:bg-neutral-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
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

              <ActionButton />
            </>
          ) : (
            <SuccessState
              message="Signed Successfully!"
              downloadUrl={downloadUrl}
              fileName={`${customFileName}.pdf`}
              onStartOver={() => {
                setDownloadUrl(null)
                setPdfData(null)
                setSignatureImg(null)
              }}
            />
          )}
          <button
            onClick={() => {
              setPdfData(null)
              setSignatureImg(null)
            }}
            className="w-full py-2 text-[10px] font-black uppercase text-gray-300 hover:text-[var(--brand-color)] transition-colors"
          >
            Close File
          </button>
        </div>
      )}
      <PrivacyBadge />
    </div>
  )
}
