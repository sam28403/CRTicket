export const EXPORT_TICKET_WIDTH = 860
export const EXPORT_TICKET_HEIGHT = 540

const BASE_TICKET_WIDTH = 430

function px(value) {
  return typeof value === 'number' ? `${value}px` : value
}

function ensureBody() {
  return document.body || document.documentElement
}

function buildOffscreenHost({ width, height }) {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = px(width)
  host.style.height = px(height)
  host.style.overflow = 'hidden'
  host.style.transform = 'none'
  host.style.pointerEvents = 'none'
  host.style.zIndex = '-1'
  return host
}

function normalizeTicketNode(ticketNode) {
  const cloned = ticketNode.cloneNode(true)

  if (cloned instanceof HTMLElement) {
    cloned.style.transform = 'none'
    cloned.style.width = px(BASE_TICKET_WIDTH)
  }

  return cloned
}

export async function renderTicketToCanvas(html2canvas, ticketNode) {
  const host = buildOffscreenHost({ width: BASE_TICKET_WIDTH, height: EXPORT_TICKET_HEIGHT })
  const cloned = normalizeTicketNode(ticketNode)

  host.appendChild(cloned)
  ensureBody().appendChild(host)

  try {
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const scale = EXPORT_TICKET_WIDTH / BASE_TICKET_WIDTH
    return await html2canvas(cloned, { scale, backgroundColor: null })
  } finally {
    host.remove()
  }
}

export async function renderTicketImage(html2canvas, ticketNode) {
  const canvas = await renderTicketToCanvas(html2canvas, ticketNode)
  return canvas.toDataURL('image/png')
}

export function downloadTicketPNG(imageData, number) {
  const link = document.createElement('a')
  link.href = imageData
  link.download = `${number}.png`
  link.click()
}

export async function buildTicketPdf(imageData) {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const pointsPerCm = 72 / 2.54
  const page = pdf.addPage([8.6 * pointsPerCm, 5.4 * pointsPerCm])
  const image = await pdf.embedPng(imageData)
  page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
  return pdf.save()
}

export async function downloadTicketPDF(imageData, number) {
  const bytes = await buildTicketPdf(imageData)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${number}.pdf`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

