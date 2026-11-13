import { useSearchParams } from 'react-router-dom'
import { ORDER_STATUSES } from '../api/orderStatus.js'

const FILTER_FIELDS = ['status', 'date_from', 'date_to']

function toParams(values) {
  return Object.fromEntries(FILTER_FIELDS.filter((field) => values[field]).map((field) => [field, values[field]]))
}

// Filters and page live in the URL. An inverted date range is flagged and left out of `query`.
export default function useOrderFilters() {
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status') ?? ''
  const filters = {
    status: ORDER_STATUSES.includes(statusParam) ? statusParam : '',
    date_from: params.get('date_from') ?? '',
    date_to: params.get('date_to') ?? '',
  }
  const page = Math.max(1, Number(params.get('page')) || 1)
  const rangeInvalid = Boolean(filters.date_from && filters.date_to && filters.date_from > filters.date_to)

  return {
    filters,
    page,
    rangeInvalid,
    isFiltered: FILTER_FIELDS.some((field) => filters[field]),
    query: { ...(rangeInvalid ? { ...filters, date_from: '', date_to: '' } : filters), page },
    applyFilters: (next) => setParams(toParams(next)),
    goToPage: (next) => setParams({ ...toParams(filters), page: String(next) }),
    backToFirstPage: () => setParams(toParams(filters), { replace: true }),
    clearFilters: () => setParams({}),
  }
}
