import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DEMO_POSTGRES_IDS, seedDemoPostgresData } from "./demo-postgres-seed.ts";
import { createPgQueryClient } from "../sync/postgres-client.ts";

export interface PostgresSetupConfig {
  targetDatabase: string;
  targetConnectionString: string;
  maintenanceConnectionString: string;
}

export function parsePostgresSetupConfig(connectionString: string): PostgresSetupConfig {
  const targetUrl = new URL(connectionString);
  const targetDatabase = decodeURIComponent(targetUrl.pathname.replace(/^\//, ""));

  if (!targetDatabase) {
    throw new Error("DATABASE_URL must include a target database name.");
  }

  const maintenanceUrl = new URL(targetUrl.toString());
  maintenanceUrl.pathname = "/postgres";

  return {
    targetDatabase,
    targetConnectionString: targetUrl.toString(),
    maintenanceConnectionString: maintenanceUrl.toString()
  };
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function resolveProjectRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, "../../../..");
}

async function ensureDatabase(config: PostgresSetupConfig): Promise<void> {
  const maintenance = await createPgQueryClient(config.maintenanceConnectionString);

  try {
    const result = await maintenance.client.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM pg_database
          WHERE datname = $1
        ) AS exists
      `,
      [config.targetDatabase]
    );

    if (!result.rows[0]?.exists) {
      await maintenance.client.query(`CREATE DATABASE ${quoteIdentifier(config.targetDatabase)}`);
      console.log(`Created PostgreSQL database '${config.targetDatabase}'.`);
    } else {
      console.log(`PostgreSQL database '${config.targetDatabase}' already exists.`);
    }
  } finally {
    await maintenance.close();
  }
}

async function applySchema(config: PostgresSetupConfig): Promise<void> {
  const projectRoot = resolveProjectRoot();
  const schemaFile = resolve(
    projectRoot,
    "infrastructure",
    "sql",
    "postgres",
    "001_initial_cloud_schema.sql"
  );
  const schemaSql = readFileSync(schemaFile, "utf8");
  const target = await createPgQueryClient(config.targetConnectionString);

  try {
    await target.client.query(schemaSql);
    console.log("Applied PostgreSQL cloud schema.");
  } finally {
    await target.close();
  }
}

async function seedDemoRows(config: PostgresSetupConfig): Promise<void> {
  const target = await createPgQueryClient(config.targetConnectionString);

  try {
    await target.client.query("BEGIN");
    await seedDemoPostgresData(target.client);
    await target.client.query("COMMIT");
    console.log("Seeded demo PostgreSQL records.");
    console.log(JSON.stringify(DEMO_POSTGRES_IDS, null, 2));
  } catch (error) {
    await target.client.query("ROLLBACK");
    throw error;
  } finally {
    await target.close();
  }
}

export async function initializePostgres(connectionString: string): Promise<void> {
  const config = parsePostgresSetupConfig(connectionString);

  await ensureDatabase(config);
  await applySchema(config);
  await seedDemoRows(config);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for PostgreSQL initialization.");
  }

  await initializePostgres(connectionString);
  console.log("PostgreSQL initialization completed.");
}
