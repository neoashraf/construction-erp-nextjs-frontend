/**
 * The overview §6 pagination shape `{ data, page, pageSize, total }` and request
 * params `?page=&pageSize=` (default pageSize 25). Never assume another shape (skill §3).
 */

export const DEFAULT_PAGE_SIZE = 25;

export interface PageParams {
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Serialize page params to a query string fragment (`page=1&pageSize=25`). */
export function pageQuery(params: PageParams = {}): string {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  return new URLSearchParams({ page: String(page), pageSize: String(pageSize) }).toString();
}

/** Total number of pages for a paginated response. */
export function pageCount(result: Pick<Paginated<unknown>, "total" | "pageSize">): number {
  if (result.pageSize <= 0) return 0;
  return Math.ceil(result.total / result.pageSize);
}
