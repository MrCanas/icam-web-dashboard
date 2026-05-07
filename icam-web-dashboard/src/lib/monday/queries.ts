export const MONDAY_ME_QUERY = `
  query Me {
    me {
      id
      name
    }
  }
`;

export const MONDAY_BOARDS_QUERY = `
  query Boards($ids: [ID!]) {
    boards(ids: $ids) {
      id
      name
      state
    }
  }
`;

export const MONDAY_COLUMNS_QUERY = `
  query BoardColumns($boardId: [ID!]) {
    boards(ids: $boardId) {
      id
      name
      columns {
        id
        title
        type
      }
    }
  }
`;

export const MONDAY_ITEMS_QUERY = `
  query BoardItems($boardId: ID!, $limit: Int!, $cursor: String) {
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
