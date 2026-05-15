import type { IncomingMessage } from "node:http";

export type BackendRole = "sync_ingest" | "sync_read" | "sync_admin";

export interface BackendIdentity {
  roles: BackendRole[];
  token: string;
}

export interface BackendAuthConfig {
  enabled: boolean;
  identities: Map<string, BackendIdentity>;
}

export interface AuthenticatedRequest {
  identity: BackendIdentity;
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

const VALID_ROLES: readonly BackendRole[] = ["sync_ingest", "sync_read", "sync_admin"] as const;

function isBackendRole(value: string): value is BackendRole {
  return VALID_ROLES.includes(value as BackendRole);
}

export function parseBackendAuthConfig(env: {
  BACKEND_AUTH_MODE?: string;
  BACKEND_AUTH_TOKENS?: string;
}): BackendAuthConfig {
  const mode = env.BACKEND_AUTH_MODE?.trim().toLowerCase();

  if (!mode || mode === "disabled") {
    return {
      enabled: false,
      identities: new Map()
    };
  }

  if (mode !== "token") {
    throw new Error("BACKEND_AUTH_MODE must be either 'disabled' or 'token'.");
  }

  const rawTokens = env.BACKEND_AUTH_TOKENS?.trim();
  if (!rawTokens) {
    throw new Error("BACKEND_AUTH_TOKENS is required when BACKEND_AUTH_MODE=token.");
  }

  const identities = new Map<string, BackendIdentity>();

  for (const rawEntry of rawTokens.split(";")) {
    const entry = rawEntry.trim();
    if (!entry) {
      continue;
    }

    const separatorIndex = entry.indexOf("=");
    if (separatorIndex < 1 || separatorIndex === entry.length - 1) {
      throw new Error(
        "BACKEND_AUTH_TOKENS entries must use the format token=role1,role2."
      );
    }

    const token = entry.slice(0, separatorIndex).trim();
    const rolesText = entry.slice(separatorIndex + 1).trim();
    const roles = rolesText
      .split(",")
      .map((role) => role.trim())
      .filter((role) => role.length > 0);

    if (roles.length === 0) {
      throw new Error(`Token '${token}' must have at least one role.`);
    }

    for (const role of roles) {
      if (!isBackendRole(role)) {
        throw new Error(`Unsupported backend auth role '${role}'.`);
      }
    }

    identities.set(token, {
      token,
      roles: [...new Set(roles as BackendRole[])]
    });
  }

  if (identities.size === 0) {
    throw new Error("BACKEND_AUTH_TOKENS did not contain any valid token entries.");
  }

  return {
    enabled: true,
    identities
  };
}

export function authenticateRequest(
  request: IncomingMessage,
  config: BackendAuthConfig
): AuthenticatedRequest | null {
  if (!config.enabled) {
    return null;
  }

  const authorization = request.headers.authorization;
  if (!authorization) {
    throw new UnauthorizedError("Missing Authorization header.");
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new UnauthorizedError("Authorization header must use Bearer token format.");
  }

  const identity = config.identities.get(token);
  if (!identity) {
    throw new UnauthorizedError("Invalid API token.");
  }

  return { identity };
}

export function requireRoles(
  authenticatedRequest: AuthenticatedRequest | null,
  config: BackendAuthConfig,
  allowedRoles: readonly BackendRole[]
): void {
  if (!config.enabled) {
    return;
  }

  if (!authenticatedRequest) {
    throw new UnauthorizedError("Authentication is required.");
  }

  const userRoles = new Set(authenticatedRequest.identity.roles);
  const allowed = allowedRoles.some((role) => userRoles.has(role) || userRoles.has("sync_admin"));

  if (!allowed) {
    throw new ForbiddenError("Authenticated token does not have permission for this endpoint.");
  }
}

