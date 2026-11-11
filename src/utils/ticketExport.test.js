import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument, PDFName } from 'pdf-lib'
import { buildTicketPdf } from './ticketExport.js'

test('车票 PDF 保留单页 8.6 × 5.4 cm 尺寸及车票图片', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZ0AAAAASUVORK5CYII='
  const document = await PDFDocument.load(await buildTicketPdf(png))
  assert.equal(document.getPageCount(), 1)
  const [page] = document.getPages()
  assert.ok(Math.abs(page.getWidth() * 2.54 / 72 - 8.6) < 0.001)
  assert.ok(Math.abs(page.getHeight() * 2.54 / 72 - 5.4) < 0.001)
  assert.ok(page.node.Resources().get(PDFName.of('XObject')))
})
