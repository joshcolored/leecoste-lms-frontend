import { useState, useRef } from 'react'
import { ImagePlus, Plus, X, Loader2, GripVertical, Upload, ArrowRight, ArrowBigLeft } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { useNavigate } from "react-router-dom"
import { addActivity } from '../../utils/recentActivity'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'

type ImageFile = { id: string, file: File, preview: string }

function SortableImageItem({ id, img, onRemove }: { id: string, img: ImageFile, onRemove: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 rounded-2xl border transition-all shadow-sm hover:shadow-lg group relative touch-none cursor-move border-gray-100 dark:border-white/5 hover:border-[var(--brand-color)]/50">
      <div className="p-2 text-[var(--brand-color)] hover:text-[var(--brand-color)]/80 active:scale-90 transition-transform cursor-grab">
        <GripVertical size={20} />
      </div>
      <div className="w-14 h-20 bg-gray-100 dark:bg-zinc-800 rounded-xl overflow-hidden shrink-0 border border-gray-200 dark:border-zinc-700">
        <img src={img.preview} alt="Preview" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate dark:text-white line-clamp-1">{img.file.name}</p>
      </div>
      <button
        onClick={() => onRemove(id)}
        className="p-2 text-gray-400 hover:text-[var(--brand-color)] transition-colors"
      >
        <X size={18} />
      </button>
    </div>
  )
}

export default function ImageToPdfTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<ImageFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [customFileName, setCustomFileName] = useState('paperknife-images-to-pdf')
  const navigate = useNavigate()
  const handleFiles = (selectedFiles: FileList | File[]) => {
    const newImages = Array.from(selectedFiles)
      .filter(f => f.type.startsWith('image/'))
      .map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: URL.createObjectURL(file)
      }))
    if (newImages.length === 0) {
      alert('Please select images (JPG, PNG, WebP)')
      return
    }
    setImages(prev => [...prev, ...newImages])
    setDownloadUrl(null)
  }

  const handleDragEnd = (fromIndex: number, toIndex: number) => {
    setImages((items) => {
      const newItems = [...items]
      const [movedItem] = newItems.splice(fromIndex, 1)
      newItems.splice(toIndex, 0, movedItem)
      return newItems
    })
  }

  const convertToPDF = async () => {
    if (images.length === 0) return
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 100))
    try {
      const pdfDoc = await PDFDocument.create()
      for (const imgData of images) {
        const imgBytes = await imgData.file.arrayBuffer()
        let pdfImg
        if (imgData.file.type.includes('png')) {
          pdfImg = await pdfDoc.embedPng(imgBytes)
        } else {
          pdfImg = await pdfDoc.embedJpg(imgBytes)
        }
        const { width, height } = pdfImg.scale(1)
        const page = pdfDoc.addPage([width, height])
        page.drawImage(pdfImg, { x: 0, y: 0, width, height })
      }
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      addActivity({
        name: `${customFileName}.pdf`,
        tool: 'Image to PDF',
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
      onClick={convertToPDF}
      disabled={isProcessing || images.length === 0}
      className="w-full bg-[var(--brand-color)] hover:bg-[var(--brand-color)]/90 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-[var(--brand-color)]/20 py-4 rounded-2xl text-sm md:p-6 md:rounded-3xl md:text-xl"
    >
      {isProcessing ? (
        <>
          <Loader2 className="animate-spin" size={18} />
          Working...
        </>
      ) : (
        <>
          Generate PDF
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
            <ImagePlus size={18} />
          </span>
          Image to PDF
        </h1>
        <p className="text-xs md:text-sm text-gray-400 mt-2 font-medium">
          Convert photos and images into a professional PDF.
        </p>
      </header>

      <input
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {images.length === 0 ? (
         <div
          className="w-full border-gray-100  dark:bg-neutral-800 rounded-lg p-12 text-center transition-all cursor-default group"
        >
         <div onClick={() => !isProcessing && fileInputRef.current?.click()} className="border-2 border-dashed border-gray-500 bg-neutral-100 mb-8 dark:bg-neutral-700 dark:border-neutral-300 max-w-4xl mx-auto p-8 space-y-8 dark:border-neutral-800 rounded-lg p-16 text-center cursor-pointer hover:bg-rose-50 dark:hover:bg-neutral-800 transition">
          <div className="w-20 h-20 bg-[var(--brand-color)]/10 dark:bg-[var(--brand-color)]/20 text-[var(--brand-color)] rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
            <Upload size={32} />
          </div>
          <h3 className="text-xl font-bold dark:text-white mb-2">Select Images</h3>
          <p className="text-sm text-gray-400">JPG, PNG, or WebP (Multiple OK)</p>
        </div>
        </div>
      ) : !downloadUrl ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-white/5">
            <p className="text-[12px] font-black uppercase text-gray-600 dark:text-gray-300">
              {images.length} Images Selected
            </p>
            <button
              onClick={() => setImages([])}
              className="text-[10px] font-black uppercase text-[var(--brand-color)] hover:text-[var(--brand-color)]/80 px-3 py-1 rounded-full bg-[var(--brand-color)]/5 transition-all"
            >
              Clear All
            </button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {images.map((img, index) => (
              <div
                key={img.id}
                className="group"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', index.toString())}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
                  const toIndex = index
                  if (fromIndex !== toIndex) {
                    handleDragEnd(fromIndex, toIndex)
                  }
                }}
              >
                <SortableImageItem
                  id={img.id}
                  img={img}
                  onRemove={(id) => setImages(prev => prev.filter(i => i.id !== id))}
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-4 border-2 border-dashed dark:bg-neutral-800 border-gray-700 dark:border-neutral-600 rounded-2xl text-gray-500 dark:text-gray-400 font-bold text-sm flex items-center justify-center gap-2 hover:border-[var(--brand-color)] hover:text-[var(--brand-color)] hover:bg-[var(--brand-color)]/5 transition-all"
          >
            <Plus size={16} />
            Add More Images
          </button>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 px-1">
              Output Filename
            </label>
            <input
              type="text"
              value={customFileName}
              placeholder='Please input your output filename...'
              onChange={(e) => setCustomFileName(e.target.value)}
              className="w-full bg-gray-50 dark:bg-neutral-700 rounded-xl px-4 py-3 border border-transparent focus:border-[var(--brand-color)] outline-none font-bold text-sm dark:text-white"
            />
          </div>

          <ActionButton />
        </div>
      ) : (
        <SuccessState
          message="PDF Ready!"
          downloadUrl={downloadUrl}
          fileName={`${customFileName}.pdf`}
          onStartOver={() => {
            setImages([])
            setDownloadUrl(null)
          }}
        />
      )}
      <PrivacyBadge />
    </div>
  )
}
