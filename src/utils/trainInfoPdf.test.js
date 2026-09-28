import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PDFDocument, PageSizes } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { buildTrainInfoPdf, planTrainPdf, trainPdfFilename, trainPdfRows, trainPdfTitle } from './trainInfoPdf.js'

const fontBytes = await readFile(new URL('../../public/google_sans_rounded_regular.ttf', import.meta.url))
const document = await PDFDocument.create()
document.registerFontkit(fontkit)
const font = await document.embedFont(fontBytes, { subset: true })

function fixture(count) {
  return { train: 'K1127', date: '2026-09-28', stops: Array.from({ length: count }, (_, index) => ({
    no: String(index + 1).padStart(2, '0'), train: 'K1127', station: index === 0 ? '上海松江' : '襄阳',
    arrival: index ? '12:52' : null, departure: index === count - 1 ? null : '18:22',
    stay: index === 0 || index === count - 1 ? null : 3, mileage: index * 54, arrivalDay: index ? 1 : 0,
  })) }
}

test('模板仅含六列，里程含单位，两端空值及终到时间保持模板写法', () => {
  const result = fixture(3)
  assert.deepEqual(trainPdfRows(result), [
    ['01', '上海松江', '----', '18:22', '----', '0 km'],
    ['02', '襄阳', '12:52', '18:22', '3分钟', '54 km'],
    ['03', '襄阳', '12:52', '12:52', '----', '108 km'],
  ])
  result.stops[1].mileage = null
  assert.equal(trainPdfRows(result)[1][5], '----')
  result.stops[1].train = 'K1126'
  assert.equal(trainPdfTitle(result), 'K1127/6/7')
  assert.equal(trainPdfFilename({ ...result, train: 'K1127/K1126' }), 'K1127_2026-09-28.pdf')
})

test('优先 14 pt，一页放不下改 12 pt，仍放不下再分页且不丢站', () => {
  const short = planTrainPdf(fixture(16), font)
  assert.equal(short.fontSize, 14)
  assert.equal(short.pages.length, 1)
  const medium = planTrainPdf(fixture(32), font)
  assert.equal(medium.fontSize, 12)
  assert.equal(medium.pages.length, 1)
  const long = planTrainPdf(fixture(60), font)
  assert.equal(long.fontSize, 12)
  assert.equal(long.pages.length, 2)
  assert.equal(long.pages.flat().length, 60)
  for (const page of long.pages) {
    assert.ok(page.reduce((height, row) => height + row.height, long.tableTop + long.header.height) <= PageSizes.A4[1] - 72)
  }
})

test('长站名按实际字体宽度换行，所有文字保持在单元格内', () => {
  const result = fixture(4)
  result.stops[1].station = '一个很长的中文车站名称'
  const plan = planTrainPdf(result, font)
  const lines = plan.pages[0][1].lines[1]
  assert.ok(lines.length > 1)
  assert.equal(lines.join(''), result.stops[1].station)
  for (const line of lines) assert.ok(font.widthOfTextAtSize(line, plan.fontSize) <= 8275 / 20 / 6 - 10.8)
})

test('五字站名在 14 pt 和 12 pt 表格中均保持单行', () => {
  for (const count of [16, 32]) {
    const result = fixture(count)
    result.stops[1].station = '呼和浩特东'
    result.stops[2].station = '锡林呼都嘎'
    const plan = planTrainPdf(result, font)
    for (const row of plan.pages.flat().slice(1, 3)) {
      assert.equal(row.lines[1].length, 1)
      assert.ok(font.widthOfTextAtSize(row.lines[1][0], row.sizes[1]) <= 8275 / 20 / 6 - 6)
    }
  }
})

test('输出为可重新打开的 A4 PDF，页数符合排版，拒绝空结果', async () => {
  const output = await buildTrainInfoPdf(fixture(60), fontBytes)
  const reopened = await PDFDocument.load(output.bytes)
  assert.equal(reopened.getPageCount(), 2)
  for (const page of reopened.getPages()) assert.deepEqual([page.getWidth(), page.getHeight()], PageSizes.A4)
  await assert.rejects(buildTrainInfoPdf({ stops: [] }, fontBytes), /没有可导出/)
})
