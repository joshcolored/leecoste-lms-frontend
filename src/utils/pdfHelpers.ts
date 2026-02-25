import * as pdfjsLib from 'pdfjs-dist'


pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface PdfMetaData {
  thumbnail: string
  pageCount: number
  isLocked: boolean
}

/* ===============================
   SIMPLE WEB DOWNLOAD
================================= */
export const downloadFile = async (
  data: Uint8Array | Blob,
  fileName: string,
  mimeType: string
) => {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data as BlobPart], { type: mimeType })

  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/* ===============================
   LOAD PDF
================================= */
export const loadPdfDocument = async (file: File) => {
  const buffer = await file.arrayBuffer()

  const loadingTask = pdfjsLib.getDocument({
    data: buffer
  })

  return await loadingTask.promise
}

/* ===============================
   RENDER FULL PREVIEW PAGE
================================= */
export const renderPageThumbnail = async (
  pdf: any,
  pageNum: number,
  scale = 1.5
): Promise<string> => {
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) return ""

  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({
    canvasContext: context,
    viewport
  }).promise

  return canvas.toDataURL("image/jpeg", 0.9)
}

/* ===============================
   LIGHT GRID THUMBNAIL
================================= */
export const renderGridThumbnail = async (
  pdf: any,
  pageNum: number
): Promise<string> => {
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale: 0.5 })

  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) return ""

  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({
    canvasContext: context,
    viewport
  }).promise

  return canvas.toDataURL("image/jpeg", 0.6)
}

/* ===============================
   GET PDF METADATA
================================= */
export const getPdfMetaData = async (
  file: File
): Promise<PdfMetaData> => {
  try {
    const buffer = await file.arrayBuffer()

    const loadingTask = pdfjsLib.getDocument({
      data: buffer
    })

    loadingTask.onPassword = () => {
      throw new Error("PASSWORD_REQUIRED")
    }

    const pdf = await loadingTask.promise
    const thumbnail = await renderPageThumbnail(pdf, 1)

    return {
      thumbnail,
      pageCount: pdf.numPages,
      isLocked: false
    }
  } catch (err: any) {
    if (
      err?.message === "PASSWORD_REQUIRED" ||
      err?.name === "PasswordException"
    ) {
      return {
        thumbnail: "",
        pageCount: 0,
        isLocked: true
      }
    }

    return {
      thumbnail: "",
      pageCount: 0,
      isLocked: false
    }
  }
}

/* ===============================
   UNLOCK PDF
================================= */
export const unlockPdf = async (
  file: File,
  password: string
): Promise<
  PdfMetaData & { success: boolean; pdfDoc?: any }
> => {
  try {
    const buffer = await file.arrayBuffer()

    const loadingTask = pdfjsLib.getDocument({
      data: buffer,
      password
    })

    const pdf = await loadingTask.promise
    const thumbnail = await renderPageThumbnail(pdf, 1)

    return {
      thumbnail,
      pageCount: pdf.numPages,
      isLocked: false,
      success: true,
      pdfDoc: pdf
    }
  } catch {
    return {
      thumbnail: "",
      pageCount: 0,
      isLocked: true,
      success: false
    }
  }
}