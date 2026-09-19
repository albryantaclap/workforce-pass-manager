import { useState, useEffect } from 'react';

/**
 * Consistent pagination state hook for all Inventory pages.
 *
 * Usage:
 *   const { page, setPage, rowsPerPage, setRowsPerPage } = usePagination(50, [search, fromDate, toDate]);
 *
 * The second argument is an array of filter dependencies. Whenever any of them
 * changes, the page automatically resets to 0 (Page 1). Changing rows-per-page
 * also resets to Page 1.
 *
 * @param {number} defaultRowsPerPage — default rows per page (default 50)
 * @param {Array}  resetDeps          — filter values that trigger a reset to page 0
 */
export function usePagination(defaultRowsPerPage = 50, resetDeps = []) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);

  // Reset to page 0 whenever any filter dependency changes
  useEffect(() => {
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  const changeRowsPerPage = (newSize) => {
    setRowsPerPage(newSize);
    setPage(0);
  };

  return { page, setPage, rowsPerPage, setRowsPerPage: changeRowsPerPage };
}