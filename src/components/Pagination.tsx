interface PaginationProps {
  page: number;
  perPage: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  perPageOptions?: number[];
}

export default function Pagination({
  page,
  perPage,
  totalPages,
  total,
  onPageChange,
  onPerPageChange,
  perPageOptions = [25, 50, 100, 200],
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pageNumbers.push(i);

  const btn =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-500">
        Menampilkan {total > 0 ? (page - 1) * perPage + 1 : 0}–{Math.min(page * perPage, total)} dari{" "}
        {total} data
      </p>

      <div className="flex items-center gap-1">
        <button className={btn} disabled={page <= 1} onClick={() => onPageChange(1)}>
          &laquo;
        </button>
        <button className={btn} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Sebelumnya
        </button>

        {pageNumbers[0] > 1 && (
          <>
            <button className={btn} onClick={() => onPageChange(1)}>
              1
            </button>
            {pageNumbers[0] > 2 && <span className="px-1 text-slate-400">…</span>}
          </>
        )}

        {pageNumbers.map((n) => (
          <button
            key={n}
            onClick={() => onPageChange(n)}
            className={
              n === page
                ? "inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-indigo-600 px-3 text-sm font-semibold text-white"
                : btn
            }
          >
            {n}
          </button>
        ))}

        {pageNumbers[pageNumbers.length - 1] < totalPages && (
          <>
            {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
              <span className="px-1 text-slate-400">…</span>
            )}
            <button className={btn} onClick={() => onPageChange(totalPages)}>
              {totalPages}
            </button>
          </>
        )}

        <button className={btn} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Berikutnya
        </button>
        <button className={btn} disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
          &raquo;
        </button>
      </div>

      {onPerPageChange && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Baris/halaman</span>
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}