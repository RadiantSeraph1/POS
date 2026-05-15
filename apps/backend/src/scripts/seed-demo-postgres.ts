import { createPgQueryClient } from "../sync/postgres-client.ts";
import { DEMO_POSTGRES_IDS, seedDemoPostgresData } from "./demo-postgres-seed.ts";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for the demo PostgreSQL seed script.");
}

const pg = await createPgQueryClient(connectionString);

try {
  await pg.client.query("BEGIN");
  await seedDemoPostgresData(pg.client);
  await pg.client.query("COMMIT");

  console.log("Demo PostgreSQL seed completed.");
  console.log(JSON.stringify(DEMO_POSTGRES_IDS, null, 2));
} catch (error) {
  await pg.client.query("ROLLBACK");
  throw error;
} finally {
  await pg.close();
}
