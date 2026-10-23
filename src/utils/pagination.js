// Helpers for page-based list responses (page size fixed at 10).

const PAGE_SIZE = 10;

function getPage(queryPage) {
  const page = Number(queryPage) || 1;
  if (page < 1) {
    return 1;
  }
  return page;
}

function getOffset(page) {
  return (page - 1) * PAGE_SIZE;
}

function listResponse(items, total, page) {
  return {
    items,
    page,
    pageSize: PAGE_SIZE,
    total,
  };
}

module.exports = { PAGE_SIZE, getPage, getOffset, listResponse };
