// Pure parser tests - real xlsx bytes built with SheetJS itself, so the
// numeric/date formatting edge cases are proven against the real library,
// not a guess at its behaviour.
import * as XLSX from 'xlsx'
import {
  normaliseHeader, findItemCodeColumn, parseSpreadsheet, buildImportPayload,
} from './spreadsheet.js'

function xlsxBuffer(rows, formats = {}) {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  for (const [addr, z] of Object.entries(formats)) {
    if (ws[addr]) ws[addr].z = z
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Items')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}

describe('normaliseHeader', () => {
  test('strips case, spaces, dashes and underscores', () => {
    expect(normaliseHeader('Item Code')).toBe('itemcode')
    expect(normaliseHeader('item-code')).toBe('itemcode')
    expect(normaliseHeader('ITEM_CODE')).toBe('itemcode')
    expect(normaliseHeader(' Item   Code ')).toBe('itemcode')
  })
})

describe('findItemCodeColumn', () => {
  test('matches itemCode, Item Code, item-code, ITEMCODE and item_code', () => {
    for (const header of ['itemCode', 'Item Code', 'item-code', 'ITEMCODE', 'item_code']) {
      expect(findItemCodeColumn(['Serial', header, 'Notes'])).toBe(header)
    }
  })

  test('is undefined when no header matches', () => {
    expect(findItemCodeColumn(['Serial', 'Notes'])).toBeUndefined()
  })
})

describe('parseSpreadsheet - xlsx', () => {
  test('reads an .xlsx into headers and rows with sheet line numbers', async () => {
    const buffer = xlsxBuffer([
      ['Item Code', 'Name'],
      ['A-1', 'Laptop'],
      ['A-2', 'Phone'],
    ])
    const parsed = await parseSpreadsheet({ name: 'items.xlsx', buffer })
    expect(parsed.sheetName).toBe('Items')
    expect(parsed.headers).toEqual(['Item Code', 'Name'])
    expect(parsed.rows).toEqual([
      { line: 2, values: { 'Item Code': 'A-1', Name: 'Laptop' } },
      { line: 3, values: { 'Item Code': 'A-2', Name: 'Phone' } },
    ])
  })

  test('blank rows are dropped but the other rows keep their line numbers', async () => {
    const buffer = xlsxBuffer([
      ['Item Code', 'Name'],
      ['A-1', 'Laptop'],
      ['', ''],
      ['A-3', 'Phone'],
    ])
    const parsed = await parseSpreadsheet({ name: 'items.xlsx', buffer })
    expect(parsed.rows.map((r) => r.line)).toEqual([2, 4])
  })

  test('row values are null-prototype objects, so __proto__ is just a column', async () => {
    const buffer = xlsxBuffer([
      ['Item Code', '__proto__'],
      ['A-1', 'not-a-prototype'],
    ])
    const parsed = await parseSpreadsheet({ name: 'items.xlsx', buffer })
    expect(Object.getPrototypeOf(parsed.rows[0].values)).toBeNull()
    expect(parsed.rows[0].values.__proto__).toBe('not-a-prototype')
  })

  test('blank and duplicate headers get readable names', async () => {
    const buffer = xlsxBuffer([
      ['Item Code', '', 'Item Code'],
      ['A-1', 'x', 'y'],
    ])
    const parsed = await parseSpreadsheet({ name: 'items.xlsx', buffer })
    expect(parsed.headers).toEqual(['Item Code', 'Column 2', 'Item Code (2)'])
  })

  test('a text cell keeps its leading zeros ("00123")', async () => {
    const buffer = xlsxBuffer([['Item Code'], ['00123']])
    const parsed = await parseSpreadsheet({ name: 'items.xlsx', buffer })
    expect(parsed.rows[0].values['Item Code']).toBe('00123')
  })

  test('a number formatted with a leading-zero pattern reads as its display text', async () => {
    const buffer = xlsxBuffer([['Item Code'], [123]], { A2: '00000' })
    const parsed = await parseSpreadsheet({ name: 'items.xlsx', buffer })
    expect(parsed.rows[0].values['Item Code']).toBe('00123')
  })

  test('a 16-digit number keeps full precision instead of scientific notation', async () => {
    const buffer = xlsxBuffer([['Item Code'], [1234567890123456]])
    const parsed = await parseSpreadsheet({ name: 'items.xlsx', buffer })
    expect(parsed.rows[0].values['Item Code']).toBe('1234567890123456')
  })

  test('a date cell reads as YYYY-MM-DD', async () => {
    const buffer = xlsxBuffer([['Item Code', 'Purchased'], ['A-1', new Date(2026, 0, 15)]])
    const parsed = await parseSpreadsheet({ name: 'items.xlsx', buffer })
    expect(parsed.rows[0].values.Purchased).toBe('2026-01-15')
  })
})

describe('parseSpreadsheet - csv', () => {
  test('reads a .csv', async () => {
    const text = 'Item Code,Name\nA-1,Laptop\nA-2,Phone\n'
    const buffer = new TextEncoder().encode(text).buffer
    const parsed = await parseSpreadsheet({ name: 'items.csv', buffer })
    expect(parsed.headers).toEqual(['Item Code', 'Name'])
    expect(parsed.rows).toEqual([
      { line: 2, values: { 'Item Code': 'A-1', Name: 'Laptop' } },
      { line: 3, values: { 'Item Code': 'A-2', Name: 'Phone' } },
    ])
  })
})

describe('buildImportPayload', () => {
  test('drops reserved export columns and the item-code column from data', () => {
    const parsed = {
      headers: ['Item Code', 'Name', 'Scan Status', 'Scanned At', 'Scanned By'],
      rows: [{
        line: 2,
        values: {
          'Item Code': 'A-1', Name: 'Laptop', 'Scan Status': 'Scanned',
          'Scanned At': '2026-01-01', 'Scanned By': 'Allen',
        },
      }],
    }
    const payload = buildImportPayload(parsed)
    expect(payload.codeColumn).toBe('Item Code')
    expect(payload.columns).toEqual(['Name'])
    expect(payload.reserved).toEqual(['Scan Status', 'Scanned At', 'Scanned By'])
    expect(payload.rows).toEqual([{ line: 2, item_code: 'A-1', data: { Name: 'Laptop' } }])
  })

  test('reports a clear error when there is no item code column', () => {
    const payload = buildImportPayload({ headers: ['Name'], rows: [] })
    expect(payload.error).toMatch(/item code/i)
  })

  test('reports a clear error when more than one header looks like an item code column', () => {
    const payload = buildImportPayload({ headers: ['Item Code', 'item_code'], rows: [] })
    expect(payload.error).toMatch(/item code/i)
  })

  test('an explicit display column list is kept as given', () => {
    const parsed = { headers: ['Item Code', 'Name', 'Notes'], rows: [] }
    const payload = buildImportPayload(parsed, ['Name'])
    expect(payload.display_columns).toEqual(['Name'])
  })
})
