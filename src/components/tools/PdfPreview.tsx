import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { X, Loader2, Lock, Unlock } from "lucide-react"
import { loadPdfDocument, renderPageThumbnail, unlockPdf } from "../../utils/pdfHelpers"

interface Props {
  file: File
  onClose: () => void
  onProcess: () => void
}

export default function PdfPreview({ file, onClose, onProcess }: Props) {
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const [password, setPassword] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const doc = await loadPdfDocument(file)
        setPdfDoc(doc)
        setTotalPages(doc.numPages)
      } catch (err: any) {
        if (err.name === "PasswordException") {
          setIsLocked(true)
        }
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [file])

  const handleUnlock = async () => {
    const result = await unlockPdf(file, password)
    if (result.success) {
      setPdfDoc(result.pdfDoc)
      setTotalPages(result.pageCount)
      setIsLocked(false)
    } else {
      alert("Incorrect password")
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-zinc-950 z-[999] flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-white/10">
        <h2 className="text-white font-bold truncate max-w-[60%]">
          {file.name}
        </h2>

        <div className="flex items-center gap-3">
          <button
            onClick={onProcess}
            className="bg-[var(--brand-color)] px-4 py-2 rounded-xl text-white font-bold"
          >
            Use in Tool
          </button>

          <button onClick={onClose} className="text-white">
            <X size={22} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main
        ref={containerRef}
        className="flex-1 overflow-y-auto p-10 space-y-12"
      >
        {isLoading && (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="animate-spin text-[var(--brand-color)]" />
          </div>
        )}

        {isLocked && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Lock size={32} className="text-[var(--brand-color)] mb-4" />
            <input
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-800 text-white px-4 py-2 rounded-lg mb-4"
            />
            <button
              onClick={handleUnlock}
              className="bg-[var(--brand-color)] hover:opacity-80 px-6 py-2 rounded-lg text-white font-bold"
            >
              <Unlock size={16} className="inline mr-2" />
              Unlock
            </button>
          </div>
        )}

        {!isLoading && !isLocked && pdfDoc && (
          <>
            {Array.from({ length: totalPages }).map((_, i) => (
              <Page
                key={i}
                pdfDoc={pdfDoc}
                pageNum={i + 1}
              />
            ))}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-zinc-900 text-zinc-500 text-xs px-6 py-3 border-t border-white/10 flex justify-between">
        <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
        <span>{totalPages} Pages</span>
      </footer>
    </div>,
    document.body
  )
}

function Page({ pdfDoc, pageNum }: { pdfDoc: any; pageNum: number }) {
  const [img, setImg] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !img) {
          const data = await renderPageThumbnail(pdfDoc, pageNum, 2.0)
          setImg(data)
        }
      },
      { rootMargin: "600px" }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [pdfDoc, pageNum, img])

  return (
    <div ref={ref} className="flex justify-center">
      {img ? (
        <img
          src={img}
          className="max-w-full shadow-2xl rounded"
          alt={`Page ${pageNum}`}
        />
      ) : (
        <div className="h-80 flex items-center justify-center">
          <Loader2 className="animate-spin text-[var(--brand-color)]" />
        </div>
      )}
    </div>
  )
}