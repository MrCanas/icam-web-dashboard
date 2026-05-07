// Query especializada para dashboard Monday (incluye los campos mínimos analíticos).
export const MONDAY_DASHBOARD_ITEMS_QUERY = `
  query DashboardItems($boardId: ID!, $limit: Int!, $cursor: String) {
    boards(ids: [$boardId]) {
      id
      name
      items_page(limit: $limit, cursor: $cursor) {
        cursor
        items {
          id
          name
          updated_at
          column_values {
            id
            text
            value
          }
        }
      }
    }
  }
`;

