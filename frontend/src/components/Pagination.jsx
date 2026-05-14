import React, { useEffect, useMemo, useState } from "react";

function clampPage(page, pageCount) {
  return Math.min(Math.max(Number(page) || 1, 1), Math.max(pageCount, 1));
}

export function usePagination(items = [], pageSize = 10, resetKey = "") {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    setPage((current) => clampPage(current, pageCount));
  }, [pageCount]);

  const pageItems = useMemo(() => {
    const start = (clampPage(page, pageCount) - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageCount, pageSize]);

  const currentPage = clampPage(page, pageCount);
  const startItem = total ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = total ? Math.min(currentPage * pageSize, total) : 0;

  return {
    page: currentPage,
    setPage,
    pageItems,
    pageCount,
    total,
    startItem,
    endItem,
  };
}

export default function PaginationControls({ pagination, t }) {
  if (!pagination || pagination.total <= pagination.pageItems.length) return null;

  const { page, pageCount, total, startItem, endItem, setPage } = pagination;

  return (
    <nav className="pagination-controls" aria-label={t?.("pagination.label", { defaultValue: "Pagination" }) || "Pagination"}>
      <span className="pagination-range">
        {t?.("pagination.range", {
          start: startItem,
          end: endItem,
          total,
          defaultValue: `${startItem}-${endItem} of ${total}`,
        }) || `${startItem}-${endItem} of ${total}`}
      </span>
      <div className="pagination-actions">
        <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1}>
          {t?.("pagination.previous", { defaultValue: "Previous" }) || "Previous"}
        </button>
        <span>
          {t?.("pagination.page", {
            page,
            pages: pageCount,
            defaultValue: `${page} / ${pageCount}`,
          }) || `${page} / ${pageCount}`}
        </span>
        <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pageCount}>
          {t?.("pagination.next", { defaultValue: "Next" }) || "Next"}
        </button>
      </div>
    </nav>
  );
}
