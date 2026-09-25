import RecordPreview from '../imports/RecordPreview.jsx'

/** A session upload's rows as they will be stored: the scan-code column
 *  first (marked), then every other column in file order. */
export default function SheetPreview({ fileName, codeColumn, columns, rows, problems }) {
  const shape = [
    {
      key: '\0code', // cannot collide with a real header
      code: true,
      header: (
        <>
          {codeColumn}
          <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-brand-700">
            scan code
          </span>
        </>
      ),
      value: (row) => row.item_code,
    },
    ...columns.map((c) => ({ key: c, header: c, value: (row) => row.data[c] })),
  ]
  return <RecordPreview caption={`Rows in ${fileName}`} columns={shape} rows={rows} problems={problems} />
}
