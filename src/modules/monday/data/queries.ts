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
      groups {
        id
        title
      }
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
          created_at
          updated_at
          group {
            id
            title
          }
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

export const MONDAY_ACTIVITY_LOGS_QUERY = `
  query BoardActivityLogs(
    $boardId: [ID!]
    $columnIds: [String!]
    $limit: Int!
    $page: Int!
    $from: String
    $to: String
  ) {
    boards(ids: $boardId) {
      activity_logs(
        limit: $limit
        page: $page
        from: $from
        to: $to
        column_ids: $columnIds
      ) {
        id
        created_at
        event
        data
      }
    }
  }
`;
