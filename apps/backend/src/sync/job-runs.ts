export interface SyncJobRunQueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: ReadonlyArray<unknown>
  ): Promise<{ rows: T[] }>;
}

export interface SyncJobDescriptor {
  jobType: string;
  jobName: string;
}

interface SyncJobRunRow extends Record<string, unknown> {
  id: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return String(error);
}

export async function runRecordedSyncJob<TSummary extends object>(
  client: SyncJobRunQueryClient,
  descriptor: SyncJobDescriptor,
  execute: () => Promise<TSummary>
): Promise<TSummary> {
  const started = await client.query<SyncJobRunRow>(
    `
      INSERT INTO sync_job_runs (
        job_type,
        job_name,
        status,
        started_at
      )
      VALUES ($1, $2, 'running', NOW())
      RETURNING id::TEXT AS id
    `,
    [descriptor.jobType, descriptor.jobName]
  );

  const runId = started.rows[0]?.id;

  if (!runId) {
    throw new Error("Failed to create sync job run record.");
  }

  try {
    const summary = await execute();

    await client.query(
      `
        UPDATE sync_job_runs
        SET
          status = 'succeeded',
          summary_json = $1::JSONB,
          finished_at = NOW()
        WHERE id = $2::UUID
      `,
      [summary, runId]
    );

    return summary;
  } catch (error) {
    await client.query(
      `
        UPDATE sync_job_runs
        SET
          status = 'failed',
          error_message = $1,
          finished_at = NOW()
        WHERE id = $2::UUID
      `,
      [errorMessage(error), runId]
    );

    throw error;
  }
}
