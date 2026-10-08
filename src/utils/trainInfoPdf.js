import { PDFDocument, PageSizes, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { displayTrainCode } from './trainDisplay.js'

// 模板.docx：A4、上下 72 pt、左右 90 pt，六等宽列，灰色表头及 0.5 pt 黑色网格。
const pageSize = PageSizes.A4
const tableLeft = 90
const tableWidth = 8275 / 20
const columnWidth = tableWidth / 6
const bottomMargin = 72
const titleTop = 78
const titleSize = 24
const headers = ['站序', '站名', '到站时间', '出发时间', '停留时间', '里程']
let fontRequest

export function trainPdfTitle(result) {
  const codes = []
  for (const stop of result.stops) {
    const code = displayTrainCode(stop.train || result.train)
    if (code && codes.at(-1) !== code) codes.push(code)
  }
  if (!codes.length) return displayTrainCode(result.train)
  let title = codes[0]
  for (let index = 1; index < codes.length; index++) {
    const previous = codes[index - 1]
    const current = codes[index]
    let common = 0
    while (common < Math.min(previous.length, current.length) && previous[common] === current[common]) common++
    title += `/${common && previous.length === current.length ? current.slice(common) : current}`
  }
  return title
}

export function trainPdfFilename(result) {
  const train = displayTrainCode(result.train).split('/')[0].replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
  return `${train}_${String(result.date).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')}.pdf`
}

export function trainPdfRows(result) {
  return result.stops.map((stop, index) => [
    String(stop.no || index + 1).padStart(2, '0'), stop.station,
    stop.arrival || '----',
    // 模板的终到站出发时间与到达时间相同；始发到达、两端停留均为 ----。
    stop.departure || (index === result.stops.length - 1 ? stop.arrival : null) || '----',
    stop.stay == null ? '----' : `${stop.stay}分钟`,
    stop.mileage == null ? '----' : `${stop.mileage} km`,
  ])
}

function wrapText(text, font, size, width) {
  const lines = []
  let line = ''
  for (const character of String(text)) {
    if (line && font.widthOfTextAtSize(line + character, size) > width) {
      lines.push(line)
      line = ''
    }
    line += character
  }
  lines.push(line)
  return lines
}

export function planTrainPdf(result, font) {
  const title = trainPdfTitle(result)
  const titleLines = wrapText(title, font, titleSize, tableWidth)
  const titleHeight = font.heightAtSize(titleSize)
  const tableTop = titleTop + titleLines.length * titleHeight + 4
  const availableHeight = pageSize[1] - tableTop - bottomMargin
  const rows = [headers, ...trainPdfRows(result)]
  const measure = size => rows.map(cells => {
    const sizes = cells.map((text, column) => column === 1 && [...String(text)].length === 5
      ? Math.min(size, (columnWidth - 6) / font.widthOfTextAtSize(String(text), 1))
      : size)
    const lines = cells.map((text, column) => wrapText(text, font, sizes[column], columnWidth - (column === 1 && [...String(text)].length === 5 ? 6 : 10.8)))
    return { lines, sizes, height: Math.max(18.75, Math.max(...lines.map((cell, column) => cell.length * font.heightAtSize(sizes[column]))) + 4) }
  })
  let fontSize = 14
  let measured = measure(fontSize)
  if (measured.reduce((sum, row) => sum + row.height, 0) > availableHeight) {
    fontSize = 12
    measured = measure(fontSize)
  }
  const header = measured[0]
  const pages = []
  let page = []
  let height = header.height
  for (const row of measured.slice(1)) {
    if (row.height + header.height > availableHeight) throw new Error('单行内容过长，无法按模板导出')
    if (height + row.height > availableHeight) {
      pages.push(page)
      page = []
      height = header.height
    }
    page.push(row)
    height += row.height
  }
  if (page.length) pages.push(page)
  return { titleLines, titleHeight, tableTop, fontSize, header, pages }
}

export async function buildTrainInfoPdf(result, fontBytes) {
  if (!result?.stops?.length) throw new Error('没有可导出的车次数据')
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const font = await document.embedFont(fontBytes, { subset: true })
  const plan = planTrainPdf(result, font)
  for (const rows of plan.pages) {
    const page = document.addPage(pageSize)
    const drawCentered = (text, size, center, baseline) => page.drawText(text, {
      x: center - font.widthOfTextAtSize(text, size) / 2, y: baseline, font, size, color: rgb(0, 0, 0),
    })
    plan.titleLines.forEach((line, index) => drawCentered(line, titleSize, pageSize[0] / 2,
      pageSize[1] - titleTop - index * plan.titleHeight - font.heightAtSize(titleSize, { descender: false })))
    let top = pageSize[1] - plan.tableTop
    const tableRows = [plan.header, ...rows]
    const tableBottom = top - tableRows.reduce((sum, row) => sum + row.height, 0)
    page.drawRectangle({ x: tableLeft, y: top - plan.header.height, width: tableWidth, height: plan.header.height, color: rgb(166 / 255, 166 / 255, 166 / 255) })
    const rule = y => page.drawLine({ start: { x: tableLeft, y }, end: { x: tableLeft + tableWidth, y }, thickness: 0.5, color: rgb(0, 0, 0) })
    rule(top)
    for (const row of tableRows) {
      row.lines.forEach((lines, column) => {
        const size = row.sizes[column]
        const lineHeight = font.heightAtSize(size)
        const baseline = top - (row.height - lines.length * lineHeight) / 2 - font.heightAtSize(size, { descender: false })
        lines.forEach((line, index) => drawCentered(line, size, tableLeft + (column + 0.5) * columnWidth, baseline - index * lineHeight))
      })
      top -= row.height
      rule(top)
    }
    for (let column = 0; column <= 6; column++) {
      const x = tableLeft + column * columnWidth
      page.drawLine({ start: { x, y: pageSize[1] - plan.tableTop }, end: { x, y: tableBottom }, thickness: 0.5, color: rgb(0, 0, 0) })
    }
  }
  return { bytes: await document.save(), filename: trainPdfFilename(result), fontSize: plan.fontSize, pageCount: plan.pages.length }
}

export async function downloadTrainInfoPdf(result) {
  if (!fontRequest) {
    fontRequest = fetch(`${import.meta.env.BASE_URL}google_sans_rounded_regular.ttf`).then(response => {
      if (!response.ok) throw new Error('导出字体加载失败，请稍后重试')
      return response.arrayBuffer()
    }).catch(error => { fontRequest = null; throw error })
  }
  const { bytes, filename } = await buildTrainInfoPdf(result, await fontRequest)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
