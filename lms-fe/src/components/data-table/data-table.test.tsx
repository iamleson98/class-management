import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { createColumnHelper } from '@tanstack/react-table'

import { DataTable, DataTableColumnHeader, dataTableFeatures, type DataTableProps, type DataTableFeatures } from '.'

interface Row {
  id: string
  name: string
  email: string
}

const columnHelper = createColumnHelper<DataTableFeatures, Row>()

const columns = [
  columnHelper.accessor('name', {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    filterFn: 'includesString',
  }),
  columnHelper.accessor('email', {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    filterFn: 'includesString',
  }),
]

const data: Row[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
  { id: '3', name: 'Carol', email: 'carol@example.com' },
]

function renderTable(props: Partial<DataTableProps<Row>> = {}) {
  return render(<DataTable columns={columns} data={data} {...props} />)
}

/** The summary text is split across spans — match on the container's text. */
function summaryText(): string {
  return (
    document.querySelector('[data-slot="pagination-summary"]')?.textContent ?? ''
  )
}

/** Radix dropdown triggers open on pointerdown, not click. */
function openDropdown(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0 })
}

describe('DataTable', () => {
  it('renders rows and headers', () => {
    renderTable()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Carol')).toBeInTheDocument()
    expect(summaryText()).toBe('Hiển thị 1–3 trong tổng số 3')
  })

  it('filters rows via the search column', () => {
    renderTable({ searchColumnId: 'name', searchPlaceholder: 'Search…' })
    const input = screen.getByPlaceholderText('Search…')
    fireEvent.change(input, { target: { value: 'Ali' } })
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
    // No-results state appears when nothing matches
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByText('Không tìm thấy kết quả nào')).toBeInTheDocument()
  })

  it('sorts rows ascending then descending via the header menu', async () => {
    renderTable()
    const header = screen.getByRole('button', { name: /name/i })
    openDropdown(header)
    const asc = await screen.findByText('Tăng dần')
    fireEvent.click(asc)

    await waitFor(() => {
      const rows = document.querySelectorAll<HTMLElement>('[data-slot="table-body"] tr')
      expect(within(rows[0]).getByText('Alice')).toBeInTheDocument()
    })

    // Descending
    openDropdown(header)
    const desc = await screen.findByText('Giảm dần')
    fireEvent.click(desc)
    await waitFor(() => {
      const rows = document.querySelectorAll<HTMLElement>('[data-slot="table-body"] tr')
      expect(within(rows[0]).getByText('Carol')).toBeInTheDocument()
    })
  })

  it('paginates client-side with page navigation', () => {
    renderTable({ initialPageSize: 2 })
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Carol')).not.toBeInTheDocument()
    // Page 2
    const next = screen.getByRole('button', { name: /trang sau|tiếp theo/i })
    fireEvent.click(next)
    expect(screen.getByText('Carol')).toBeInTheDocument()
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    expect(summaryText()).toBe('Hiển thị 3–3 trong tổng số 3')
  })

  it('renders skeleton rows while loading', () => {
    renderTable({ data: undefined })
    const skeletons = document.querySelectorAll('[data-slot="table-body"] [data-slot="skeleton"], [data-slot="table-body"] .animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders the custom empty state when there is no data', () => {
    renderTable({ data: [], emptyState: <div data-testid="custom-empty">Empty!</div> })
    expect(screen.getByTestId('custom-empty')).toBeInTheDocument()
  })

  it('drives server-mode pagination via onPaginationChange', async () => {
    const onPaginationChange = vi.fn()
    const { rerender } = render(
      <DataTable
        columns={columns}
        data={[data[0]]}
        paginationMode="server"
        paginationState={{ pageIndex: 0, pageSize: 1 }}
        rowCount={3}
        onPaginationChange={onPaginationChange}
      />
    )
    expect(summaryText()).toBe('Hiển thị 1–1 trong tổng số 3')
    const next = screen.getByRole('button', { name: /trang sau|tiếp theo/i })
    expect(next).not.toBeDisabled()
    fireEvent.click(next)
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 1 })

    // Parent supplies the next page
    rerender(
      <DataTable
        columns={columns}
        data={[data[1]]}
        paginationMode="server"
        paginationState={{ pageIndex: 1, pageSize: 1 }}
        rowCount={3}
        onPaginationChange={onPaginationChange}
      />
    )
    expect(screen.getByText('Bob')).toBeInTheDocument()
    await waitFor(() => {
      expect(summaryText()).toBe('Hiển thị 2–2 trong tổng số 3')
    })
  })

  it('hides a column from the view-options dropdown', async () => {
    renderTable()
    const viewOptions = screen.getByRole('button', { name: /cột|columns/i })
    openDropdown(viewOptions)
    const menu = await screen.findByRole('menu')
    const emailItem = within(menu).getByText(/email/i)
    fireEvent.click(emailItem)
    await waitFor(() => {
      expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument()
    })
  })
})
