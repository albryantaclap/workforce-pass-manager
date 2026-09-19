import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const ROWS_OPTIONS = [20, 50, 100, 200];

/**
 * Consistent pagination control for all Inventory pages.
 *
 * Props:
 *  page            — current page (0-indexed)
 *  totalPages       — total number of pages
 *  totalRecords     — total records in the (filtered) dataset
 *  rowsPerPage      — current rows-per-page value
 *  onPageChange     — (newPage) => void
 *  onRowsPerPageChange — (newSize) => void
 *  isFiltered       — whether any filter/search is active (affects label text)
 */
export default function Pagination({
  page,
  totalPages,
  totalRecords,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  isFiltered = false,
}) {
  if (totalRecords === 0) return null;

  const safeTotalPages = Math.max(1, totalPages);
  const start = page * rowsPerPage + 1;
  const end = Math.min((page + 1) * rowsPerPage, totalRecords);
  const isFirst = page === 0;
  const isLast = page >= safeTotalPages - 1;

  // Build a window of page-number buttons (max 5 visible)
  const maxButtons = 5;
  let startPage = Math.max(0, page - Math.floor(maxButtons / 2));
  let endPage = Math.min(safeTotalPages - 1, startPage + maxButtons - 1);
  startPage = Math.max(0, endPage - maxButtons + 1);
  const pageButtons = [];
  for (let i = startPage; i <= endPage; i++) pageButtons.push(i);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-slate-200 bg-slate-50/50">
      {/* Left: summary text */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          Showing <strong className="text-foreground">{start.toLocaleString()}–{end.toLocaleString()}</strong> of{' '}
          <strong className="text-foreground">{totalRecords.toLocaleString()}</strong>{' '}
          {isFiltered ? 'filtered' : ''} records
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Page <strong className="text-foreground">{page + 1}</strong> of{' '}
          <strong className="text-foreground">{safeTotalPages}</strong>
        </span>
      </div>

      {/* Right: rows-per-page + nav buttons */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Rows per page:</span>
          <Select value={String(rowsPerPage)} onValueChange={v => onRowsPerPageChange(Number(v))}>
            <SelectTrigger className="w-[72px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROWS_OPTIONS.map(n => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={isFirst}
            onClick={() => onPageChange(0)}
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={isFirst}
            onClick={() => onPageChange(page - 1)}
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {pageButtons.map(p => (
            <Button
              key={p}
              size="icon"
              variant={p === page ? 'default' : 'outline'}
              className="h-8 w-8 text-xs"
              onClick={() => onPageChange(p)}
            >
              {p + 1}
            </Button>
          ))}
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={isLast}
            onClick={() => onPageChange(page + 1)}
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={isLast}
            onClick={() => onPageChange(safeTotalPages - 1)}
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}