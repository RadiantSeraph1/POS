import type {
  SaleCreatedPayload,
  SyncEnvelope
} from "../../../../packages/types/src/index.ts";

export interface ReplayQueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: ReadonlyArray<unknown>
  ): Promise<{ rows: T[] }>;
}

export interface SaleReplayResult {
  saleId: string;
  saleItems: number;
  payments: number;
  replayed: boolean;
}

export interface SaleReplayBatchSummary {
  scanned: number;
  replayed: number;
  skipped: number;
  failed: number;
}

interface PendingSaleEventRow extends Record<string, unknown> {
  id: string;
  event_type: SyncEnvelope["eventType"];
  aggregate_type: SyncEnvelope["aggregateType"];
  aggregate_id: string;
  payload_json: Record<string, unknown>;
  local_created_at: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return String(error);
}

function asObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error(`SALE_CREATED payload field '${fieldName}' must be an object.`);
  }

  return value as Record<string, unknown>;
}

function asArray(value: unknown, fieldName: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new Error(`SALE_CREATED payload field '${fieldName}' must be an array.`);
  }

  return value.map((entry) => asObject(entry, fieldName));
}

function requiredString(payload: Record<string, unknown>, fieldName: string): string {
  const value = payload[fieldName];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`SALE_CREATED payload is missing '${fieldName}'.`);
  }

  return value;
}

function optionalString(payload: Record<string, unknown>, fieldName: string): string | null {
  const value = payload[fieldName];

  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`SALE_CREATED payload field '${fieldName}' must be a string.`);
  }

  return value;
}

function requiredNumber(payload: Record<string, unknown>, fieldName: string): number {
  const value = payload[fieldName];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`SALE_CREATED payload is missing numeric '${fieldName}'.`);
  }

  return value;
}

function parseSaleCreatedPayload(envelope: SyncEnvelope): SaleCreatedPayload {
  if (envelope.eventType !== "SALE_CREATED" || envelope.aggregateType !== "sale") {
    throw new Error("Only SALE_CREATED sale events can be replayed by this projector.");
  }

  const payload = asObject(envelope.payload, "payload");
  const items = asArray(payload.items, "items");
  const payments = asArray(payload.payments, "payments");
  const customerId = optionalString(payload, "customerId");

  return {
    saleId: requiredString(payload, "saleId"),
    saleNumber: requiredString(payload, "saleNumber"),
    organizationId: requiredString(payload, "organizationId"),
    branchId: requiredString(payload, "branchId"),
    deviceId: requiredString(payload, "deviceId"),
    cashierUserId: requiredString(payload, "cashierUserId"),
    ...(customerId ? { customerId } : {}),
    currencyCode: requiredString(payload, "currencyCode"),
    subtotalMinor: requiredNumber(payload, "subtotalMinor"),
    discountMinor: requiredNumber(payload, "discountMinor"),
    taxMinor: requiredNumber(payload, "taxMinor"),
    totalMinor: requiredNumber(payload, "totalMinor"),
    items: items.map((item) => {
      const productVariantId = optionalString(item, "productVariantId");

      return {
        saleItemId: requiredString(item, "saleItemId"),
        productId: requiredString(item, "productId"),
        ...(productVariantId ? { productVariantId } : {}),
        quantity: requiredNumber(item, "quantity"),
        unitPriceMinor: requiredNumber(item, "unitPriceMinor"),
        discountMinor: requiredNumber(item, "discountMinor"),
        taxMinor: requiredNumber(item, "taxMinor"),
        lineTotalMinor: requiredNumber(item, "lineTotalMinor")
      };
    }),
    payments: payments.map((payment) => {
      const providerCode = optionalString(payment, "providerCode");
      const externalReference = optionalString(payment, "externalReference");

      return {
        paymentId: requiredString(payment, "paymentId"),
        method: requiredString(payment, "method"),
        amountMinor: requiredNumber(payment, "amountMinor"),
        ...(providerCode ? { providerCode } : {}),
        ...(externalReference ? { externalReference } : {})
      };
    })
  };
}

export async function replaySaleCreatedEvent(
  client: ReplayQueryClient,
  envelope: SyncEnvelope
): Promise<SaleReplayResult> {
  const sale = parseSaleCreatedPayload(envelope);

  await client.query("BEGIN");

  try {
    const replayClaim = await client.query<{ event_id: string }>(
      `
        INSERT INTO sync_replay_log (
          event_id,
          event_type,
          aggregate_type,
          aggregate_id,
          projected_at
        )
        VALUES ($1::UUID, $2, $3, $4::UUID, NOW())
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
      `,
      [envelope.eventId, envelope.eventType, envelope.aggregateType, envelope.aggregateId]
    );

    if (replayClaim.rows.length === 0) {
      await client.query("COMMIT");
      return {
        saleId: sale.saleId,
        saleItems: 0,
        payments: 0,
        replayed: false
      };
    }

    await client.query(
      `
        INSERT INTO sales (
          id,
          organization_id,
          branch_id,
          cashier_user_id,
          customer_id,
          sale_number,
          status,
          currency_code,
          subtotal_minor,
          discount_minor,
          tax_minor,
          total_minor,
          happened_at
        )
        VALUES (
          $1::UUID,
          $2::UUID,
          $3::UUID,
          $4::UUID,
          $5::UUID,
          $6,
          'completed',
          $7,
          $8,
          $9,
          $10,
          $11,
          $12::TIMESTAMPTZ
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [
        sale.saleId,
        sale.organizationId,
        sale.branchId,
        sale.cashierUserId,
        sale.customerId ?? null,
        sale.saleNumber,
        sale.currencyCode,
        sale.subtotalMinor,
        sale.discountMinor,
        sale.taxMinor,
        sale.totalMinor,
        envelope.createdAt
      ]
    );

    for (const item of sale.items) {
      await client.query(
        `
          INSERT INTO sale_items (
            id,
            sale_id,
            product_id,
            product_variant_id,
            quantity,
            unit_price_minor,
            discount_minor,
            tax_minor,
            line_total_minor
          )
          VALUES ($1::UUID, $2::UUID, $3::UUID, $4::UUID, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `,
        [
          item.saleItemId,
          sale.saleId,
          item.productId,
          item.productVariantId ?? null,
          item.quantity,
          item.unitPriceMinor,
          item.discountMinor,
          item.taxMinor,
          item.lineTotalMinor
        ]
      );

      await client.query(
        `
          INSERT INTO inventory_levels (
            organization_id,
            location_type,
            location_id,
            product_id,
            product_variant_id,
            sellable_quantity,
            reserved_quantity,
            damaged_quantity,
            last_event_id,
            updated_at
          )
          VALUES ($1::UUID, $2, $3::UUID, $4::UUID, $5::UUID, $6, 0, 0, $7::UUID, $8::TIMESTAMPTZ)
          ON CONFLICT (
            organization_id,
            location_type,
            location_id,
            product_id,
            COALESCE(product_variant_id, '00000000-0000-0000-0000-000000000000'::UUID)
          )
          DO UPDATE SET
            sellable_quantity = inventory_levels.sellable_quantity + EXCLUDED.sellable_quantity,
            last_event_id = EXCLUDED.last_event_id,
            updated_at = EXCLUDED.updated_at
        `,
        [
          sale.organizationId,
          "branch",
          sale.branchId,
          item.productId,
          item.productVariantId ?? null,
          -item.quantity,
          envelope.eventId,
          envelope.createdAt
        ]
      );
    }

    for (const payment of sale.payments) {
      const source = envelope.payload as Record<string, unknown>;
      const paymentSource = asArray(source.payments, "payments").find(
        (entry) => entry.paymentId === payment.paymentId
      );

      await client.query(
        `
          INSERT INTO payments (
            id,
            sale_id,
            payment_method,
            provider_code,
            external_reference,
            amount_minor,
            status,
            paid_at
          )
          VALUES ($1::UUID, $2::UUID, $3, $4, $5, $6, $7, $8::TIMESTAMPTZ)
          ON CONFLICT (id) DO NOTHING
        `,
        [
          payment.paymentId,
          sale.saleId,
          payment.method,
          payment.providerCode ?? null,
          payment.externalReference ?? null,
          payment.amountMinor,
          optionalString(paymentSource ?? {}, "status") ?? "completed",
          optionalString(paymentSource ?? {}, "paidAt") ?? envelope.createdAt
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return {
    saleId: sale.saleId,
    saleItems: sale.items.length,
    payments: sale.payments.length,
    replayed: true
  };
}

export async function replayPendingSaleCreatedEvents(
  client: ReplayQueryClient,
  limit = 100
): Promise<SaleReplayBatchSummary> {
  const pendingEvents = await client.query<PendingSaleEventRow>(
    `
      SELECT
        inventory_events.id,
        inventory_events.event_type,
        inventory_events.aggregate_type,
        inventory_events.aggregate_id::TEXT,
        inventory_events.payload_json,
        inventory_events.local_created_at::TEXT
      FROM inventory_events
      LEFT JOIN sync_replay_log
        ON sync_replay_log.event_id = inventory_events.id
      WHERE inventory_events.event_type = 'SALE_CREATED'
        AND sync_replay_log.event_id IS NULL
      ORDER BY inventory_events.received_at, inventory_events.id
      LIMIT $1
    `,
    [limit]
  );

  const summary: SaleReplayBatchSummary = {
    scanned: pendingEvents.rows.length,
    replayed: 0,
    skipped: 0,
    failed: 0
  };

  for (const row of pendingEvents.rows) {
    try {
      const result = await replaySaleCreatedEvent(client, {
        eventId: row.id,
        eventType: row.event_type,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        payload: row.payload_json,
        createdAt: row.local_created_at
      });

      if (result.replayed) {
        summary.replayed += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      await client.query(
        `
          INSERT INTO sync_replay_failures (
            event_id,
            event_type,
            aggregate_type,
            aggregate_id,
            error_message,
            failed_at
          )
          VALUES ($1::UUID, $2, $3, $4::UUID, $5, NOW())
        `,
        [
          row.id,
          row.event_type,
          row.aggregate_type,
          row.aggregate_id,
          errorMessage(error)
        ]
      );
      summary.failed += 1;
    }
  }

  return summary;
}
