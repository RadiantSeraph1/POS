import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { resolve } from "node:path";

import {
  SqliteSyncEventRepository,
  SyncIngestionService,
  createBackendHttpServer
} from "../../../backend/src/sync/index.ts";
import { resolveProjectPath } from "../../../desktop/src/db.ts";
import { WarehouseBackendClient } from "../backend-client.ts";
import { parseWarehouseAppConfig } from "../config.ts";
import type { WarehouseDashboardState } from "../models.ts";
import { projectWarehouseDashboard } from "../projector.ts";
import type { ReceivingQueue } from "../receiving-model.ts";
import { deriveReceivingQueue } from "../receiving-model.ts";
import { buildReceiveTransferInput, submitReceiveTransfer } from "../receiving-actions.ts";
import {
  submitApproveTransfer,
  submitCancelTransfer,
  submitDispatchTransfer,
  submitRejectTransfer
} from "../transfer-actions.ts";
import { WAREHOUSE_DEMO_IDS, seedTransferLifecycle } from "../workbench.ts";

export interface WarehouseOperatorStatus {
  kind: "success" | "info" | "error";
  message: string;
}

export interface WarehouseShellSnapshot {
  dashboard: WarehouseDashboardState;
  queue: ReceivingQueue;
  backendMode: "embedded" | "external";
  baseUrl: string;
  status?: WarehouseOperatorStatus;
}

export interface ReceiveTransferCommand {
  transferId: string;
  quantitiesByTransferItemId: Record<string, number>;
  notes?: string;
}

export interface RejectTransferCommand {
  transferId: string;
  reason: string;
}

export interface ApproveTransferCommand {
  transferId: string;
  quantitiesByTransferItemId: Record<string, number>;
}

export interface DispatchTransferCommand {
  transferId: string;
  quantitiesByTransferItemId: Record<string, number>;
}

export interface CancelTransferCommand {
  transferId: string;
  reason: string;
}

interface ServiceRuntime {
  client: WarehouseBackendClient;
  baseUrl: string;
  backendMode: "embedded" | "external";
  backendServer?: Server;
  backendRepository?: SqliteSyncEventRepository;
}

async function listen(server: Server, port: number): Promise<number> {
  await new Promise<void>((resolvePromise, reject) => {
    server.listen(port, () => resolvePromise());
    server.once("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine embedded warehouse backend port.");
  }

  return address.port;
}

export class WarehouseUiService {
  private readonly client: WarehouseBackendClient;
  private readonly baseUrl: string;
  private readonly backendMode: "embedded" | "external";
  private readonly backendServer: Server | undefined;
  private readonly backendRepository: SqliteSyncEventRepository | undefined;
  private status: WarehouseOperatorStatus | undefined;

  private constructor(runtime: ServiceRuntime) {
    this.client = runtime.client;
    this.baseUrl = runtime.baseUrl;
    this.backendMode = runtime.backendMode;
    this.backendServer = runtime.backendServer;
    this.backendRepository = runtime.backendRepository;
  }

  static async createForTest(): Promise<WarehouseUiService> {
    const repositoryFile = resolve(
      resolveProjectPath("data", "warehouse"),
      `ui-shell-test-${randomUUID()}.sqlite`
    );
    if (existsSync(repositoryFile)) {
      rmSync(repositoryFile, { force: true });
    }

    const backendRepository = new SqliteSyncEventRepository(repositoryFile);
    await backendRepository.initialize();
    const backendService = new SyncIngestionService(backendRepository);
    const backendServer = createBackendHttpServer(backendService);
    const backendPort = await listen(backendServer, 0);
    const baseUrl = `http://127.0.0.1:${backendPort}`;

    return new WarehouseUiService({
      client: new WarehouseBackendClient({ baseUrl }),
      baseUrl,
      backendMode: "embedded",
      backendServer,
      backendRepository
    });
  }

  static async createForApp(): Promise<WarehouseUiService> {
    const config = parseWarehouseAppConfig(process.env);
    const external = Boolean(process.env.PIPEFLOW_SYNC_BASE_URL);

    if (external) {
      return new WarehouseUiService({
        client: new WarehouseBackendClient({
          baseUrl: config.baseUrl,
          ...(config.writeToken ? { writeToken: config.writeToken } : {}),
          ...(config.readToken ? { readToken: config.readToken } : {})
        }),
        baseUrl: config.baseUrl,
        backendMode: "external"
      });
    }

    const repositoryFile = resolveProjectPath("data", "warehouse", `ui-shell-${process.pid}.sqlite`);
    if (existsSync(repositoryFile)) {
      rmSync(repositoryFile, { force: true });
    }

    const backendRepository = new SqliteSyncEventRepository(repositoryFile);
    await backendRepository.initialize();
    const backendService = new SyncIngestionService(backendRepository);
    const backendServer = createBackendHttpServer(backendService);
    const backendPort = await listen(backendServer, 3104);
    const baseUrl = `http://127.0.0.1:${backendPort}`;
    const service = new WarehouseUiService({
      client: new WarehouseBackendClient({ baseUrl }),
      baseUrl,
      backendMode: "embedded",
      backendServer,
      backendRepository
    });

    return service;
  }

  async loadSnapshot(): Promise<WarehouseShellSnapshot> {
    return this.buildSnapshot();
  }

  async seedDemoLifecycle(): Promise<WarehouseShellSnapshot> {
    await seedTransferLifecycle(this.client);
    this.status = {
      kind: "success",
      message: "Demo transfer lifecycle loaded."
    };
    return this.buildSnapshot();
  }

  async receiveTransfer(command: ReceiveTransferCommand): Promise<WarehouseShellSnapshot> {
    const snapshot = await this.buildSnapshot();
    const transfer = snapshot.queue.transfers.find((entry) => entry.transferId === command.transferId);

    if (!transfer) {
      this.status = {
        kind: "error",
        message: "Selected transfer is no longer available for receiving."
      };
      return this.buildSnapshot();
    }

    await submitReceiveTransfer(
      this.client,
      buildReceiveTransferInput(transfer, {
        receiptId: randomUUID(),
        organizationId: WAREHOUSE_DEMO_IDS.organization,
        branchId: WAREHOUSE_DEMO_IDS.branch,
        deviceId: WAREHOUSE_DEMO_IDS.device,
        receivedByUserId: WAREHOUSE_DEMO_IDS.user,
        receivedAt: new Date().toISOString(),
        ...(command.notes ? { notes: command.notes } : {}),
        quantitiesByTransferItemId: command.quantitiesByTransferItemId
      })
    );

    this.status = {
      kind: "success",
      message: `Transfer ${transfer.requestNumber} received successfully.`
    };
    return this.buildSnapshot();
  }

  async rejectTransfer(command: RejectTransferCommand): Promise<WarehouseShellSnapshot> {
    const snapshot = await this.buildSnapshot();
    const transfer = snapshot.dashboard.transfers.find((entry) => entry.transferId === command.transferId);

    if (!transfer) {
      this.status = {
        kind: "error",
        message: "Selected transfer is no longer available."
      };
      return this.buildSnapshot();
    }

    if (transfer.status !== "requested") {
      this.status = {
        kind: "error",
        message: `Transfer ${transfer.requestNumber} can only be rejected while requested.`
      };
      return this.buildSnapshot();
    }

    await submitRejectTransfer(this.client, {
      transfer,
      organizationId: WAREHOUSE_DEMO_IDS.organization,
      branchId: WAREHOUSE_DEMO_IDS.branch,
      deviceId: WAREHOUSE_DEMO_IDS.device,
      rejectedByUserId: WAREHOUSE_DEMO_IDS.warehouseManager,
      rejectedAt: new Date().toISOString(),
      reason: command.reason
    });

    this.status = {
      kind: "success",
      message: `Transfer ${transfer.requestNumber} rejected successfully.`
    };
    return this.buildSnapshot();
  }

  async approveTransfer(command: ApproveTransferCommand): Promise<WarehouseShellSnapshot> {
    const snapshot = await this.buildSnapshot();
    const transfer = snapshot.dashboard.transfers.find((entry) => entry.transferId === command.transferId);

    if (!transfer) {
      this.status = {
        kind: "error",
        message: "Selected transfer is no longer available."
      };
      return this.buildSnapshot();
    }

    if (transfer.status !== "requested") {
      this.status = {
        kind: "error",
        message: `Transfer ${transfer.requestNumber} can only be approved while requested.`
      };
      return this.buildSnapshot();
    }

    await submitApproveTransfer(this.client, {
      transfer,
      branchId: WAREHOUSE_DEMO_IDS.branch,
      deviceId: WAREHOUSE_DEMO_IDS.device,
      approvedByUserId: WAREHOUSE_DEMO_IDS.warehouseManager,
      approvedAt: new Date().toISOString(),
      quantitiesByTransferItemId: command.quantitiesByTransferItemId
    });

    this.status = {
      kind: "success",
      message: `Transfer ${transfer.requestNumber} approved successfully.`
    };
    return this.buildSnapshot();
  }

  async dispatchTransfer(command: DispatchTransferCommand): Promise<WarehouseShellSnapshot> {
    const snapshot = await this.buildSnapshot();
    const transfer = snapshot.dashboard.transfers.find((entry) => entry.transferId === command.transferId);

    if (!transfer) {
      this.status = {
        kind: "error",
        message: "Selected transfer is no longer available."
      };
      return this.buildSnapshot();
    }

    if (transfer.status !== "approved") {
      this.status = {
        kind: "error",
        message: `Transfer ${transfer.requestNumber} can only be dispatched while approved.`
      };
      return this.buildSnapshot();
    }

    await submitDispatchTransfer(this.client, {
      transfer,
      branchId: WAREHOUSE_DEMO_IDS.branch,
      deviceId: WAREHOUSE_DEMO_IDS.device,
      dispatchId: randomUUID(),
      warehouseId: WAREHOUSE_DEMO_IDS.warehouse,
      dispatchedByUserId: WAREHOUSE_DEMO_IDS.warehouseManager,
      dispatchedAt: new Date().toISOString(),
      quantitiesByTransferItemId: command.quantitiesByTransferItemId
    });

    this.status = {
      kind: "success",
      message: `Transfer ${transfer.requestNumber} dispatched successfully.`
    };
    return this.buildSnapshot();
  }

  async cancelTransfer(command: CancelTransferCommand): Promise<WarehouseShellSnapshot> {
    const snapshot = await this.buildSnapshot();
    const transfer = snapshot.dashboard.transfers.find((entry) => entry.transferId === command.transferId);

    if (!transfer) {
      this.status = {
        kind: "error",
        message: "Selected transfer is no longer available."
      };
      return this.buildSnapshot();
    }

    if (
      transfer.status !== "requested" &&
      transfer.status !== "approved" &&
      transfer.status !== "dispatched"
    ) {
      this.status = {
        kind: "error",
        message: `Transfer ${transfer.requestNumber} cannot be cancelled from status ${transfer.status}.`
      };
      return this.buildSnapshot();
    }

    await submitCancelTransfer(this.client, {
      transfer,
      organizationId: WAREHOUSE_DEMO_IDS.organization,
      branchId: WAREHOUSE_DEMO_IDS.branch,
      deviceId: WAREHOUSE_DEMO_IDS.device,
      cancelledByUserId: WAREHOUSE_DEMO_IDS.warehouseManager,
      cancelledAt: new Date().toISOString(),
      reason: command.reason
    });

    this.status = {
      kind: "success",
      message: `Transfer ${transfer.requestNumber} cancelled successfully.`
    };
    return this.buildSnapshot();
  }

  async dispose(): Promise<void> {
    if (this.backendServer) {
      await new Promise<void>((resolvePromise, reject) => {
        this.backendServer!.close((error) => (error ? reject(error) : resolvePromise()));
      });
    }

    await this.backendRepository?.close?.();
  }

  private async buildSnapshot(): Promise<WarehouseShellSnapshot> {
    const events = await this.client.listEvents();
    const dashboard = projectWarehouseDashboard(events);
    const queue = deriveReceivingQueue(dashboard);

    return {
      dashboard,
      queue,
      backendMode: this.backendMode,
      baseUrl: this.baseUrl,
      ...(this.status ? { status: this.status } : {})
    };
  }
}
