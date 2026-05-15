import type { PostgresQueryClient } from "./repository.ts";

interface PgPoolLike {
  end(): Promise<void>;
  query<T>(text: string, params?: ReadonlyArray<unknown>): Promise<{ rows: T[] }>;
}

export interface LoadedPostgresClient {
  client: PostgresQueryClient;
  close(): Promise<void>;
}

export async function createPgQueryClient(connectionString: string): Promise<LoadedPostgresClient> {
  let pgModule: { Pool: new (config: { connectionString: string }) => PgPoolLike };

  try {
    pgModule = (await import("pg")) as { Pool: new (config: { connectionString: string }) => PgPoolLike };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to load the 'pg' package. Install backend dependencies first, then retry PostgreSQL mode. Original error: ${message}`
    );
  }

  const pool = new pgModule.Pool({
    connectionString
  });

  return {
    client: {
      query: async <T>(text: string, params: ReadonlyArray<unknown> = []) => {
        return pool.query<T>(text, params);
      }
    },
    close: async () => {
      await pool.end();
    }
  };
}

