import styles from './Table.module.css'

// `columns` are { key, header, render(row) }. Below 48rem each row becomes a stacked
// card whose cells are labelled by their column header.
export default function Table({ columns, rows, caption, getRowKey, hideCaption = false }) {
  return (
    <div className={styles.region} role="region" aria-label={caption} tabIndex={0}>
      <table className={styles.table}>
        <caption className={hideCaption ? 'visually-hidden' : styles.caption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.header}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
