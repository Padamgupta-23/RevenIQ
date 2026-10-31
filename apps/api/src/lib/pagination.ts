export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  search?: string;
  sort?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export function parsePagination(
  query: Record<string, unknown>,
  defaultPageSize = 20
): PaginationParams {
  let page = 1;
  if (query.page !== undefined) {
    const parsedPage = parseInt(String(query.page), 10);
    if (!isNaN(parsedPage) && parsedPage > 0) {
      page = parsedPage;
    }
  }

  let pageSize = defaultPageSize;
  if (query.pageSize !== undefined) {
    const parsedPageSize = parseInt(String(query.pageSize), 10);
    if (!isNaN(parsedPageSize) && parsedPageSize > 0) {
      pageSize = Math.min(100, parsedPageSize);
    }
  }

  const skip = (page - 1) * pageSize;
  const take = pageSize;

  let search: string | undefined = undefined;
  if (typeof query.search === 'string' && query.search.trim().length > 0) {
    search = query.search.trim();
  }

  let sort: string | undefined = undefined;
  let sortField: string | undefined = undefined;
  let sortOrder: 'asc' | 'desc' | undefined = undefined;

  if (typeof query.sort === 'string' && query.sort.trim().length > 0) {
    sort = query.sort.trim();
    if (sort.startsWith('-')) {
      sortField = sort.substring(1);
      sortOrder = 'desc';
    } else if (sort.includes(':')) {
      const [field, order] = sort.split(':');
      sortField = field;
      sortOrder = order.toLowerCase() === 'desc' ? 'desc' : 'asc';
    } else {
      sortField = sort;
      sortOrder = 'asc';
    }
  }

  return {
    page,
    pageSize,
    skip,
    take,
    search,
    sort,
    sortField,
    sortOrder,
  };
}

export function buildPaginationMeta(
  page: number,
  pageSize: number,
  total: number
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
  };
}
