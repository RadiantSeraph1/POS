import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  PostgresSyncEventRepository,
  SqliteSyncEventRepository,
  type PostgresQueryClient,
  type SyncEventRepository
} from "./repository.ts";
import { createPgQueryClient, type LoadedPostgresClient } from "./postgres-client.ts";

export interface BootstrappedSyncRepository {
  kind: "sqlite" | "postgres";
  location: string;
  repository: SyncEventRepository;
  queryClient?: PostgresQueryClient;
  close(): Promise<void>;
}

export async function createSyncRepositoryFromEnv(
  cwd = process.cwd()
): Promise<BootstrappedSyncRepository> {
  const repositoryKind = (process.env.BACKEND_SYNC_REPOSITORY ?? "sqlite") as "sqlite" | "postgres";

  if (repositoryKind === "sqlite") {
    const dataDir = resolve(cwd, "data", "backend");
    mkdirSync(dataDir, { recursive: true });
    const location = resolve(dataDir, "sync-events.sqlite");
    const repository = new SqliteSyncEventRepository(location);
    await repository.initialize?.();

    return {
      kind: "sqlite",
      location,
      repository,
      close: async () => {
        await repository.close?.();
      }
    };
  }

  if (repositoryKind === "postgres") {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is required when BACKEND_SYNC_REPOSITORY=postgres."
      );
    }

    const pg = await createPgQueryClient(connectionString);
    const repository = new PostgresSyncEventRepository(pg.client);

    return {
      kind: "postgres",
      location: connectionString,
      repository,
      queryClient: pg.client,
      close: async () => {
        await pg.close();
      }
    };
  }

  throw new Error(
    `Unsupported BACKEND_SYNC_REPOSITORY '${repositoryKind}'. Use 'sqlite' or 'postgres'.`
  );
}
