import { createHash } from "crypto";

type DashboardRoute = "/portal" | "/portal/connect" | "/portal/create" | "/portal/analytics";

interface GuardedTaskOptions<T, R> {
  route: DashboardRoute;
  endpoint: string;
  customerId?: string | null;
  fallback: T;
  task: () => PromiseLike<R>;
  mapResult?: (result: R) => { data: T; error?: unknown };
}

interface GuardedTaskResult<T> {
  data: T;
  failed: boolean;
}

function hashCustomerId(customerId?: string | null) {
  if (!customerId) return null;
  return createHash("sha256").update(customerId).digest("hex").slice(0, 12);
}

function parseStatusCode(error: unknown) {
  const baseError = (error as {
    status?: number;
    statusCode?: number;
    code?: string | number;
    cause?: { status?: number; statusCode?: number; code?: string | number };
  } | null);

  const status = Number(
    baseError?.status
      ?? baseError?.statusCode
      ?? baseError?.cause?.status
      ?? baseError?.cause?.statusCode
      ?? baseError?.code
      ?? baseError?.cause?.code
  );

  if (Number.isFinite(status) && status >= 100 && status <= 599) {
    return status;
  }

  const message = String(
    (error as { message?: string } | null)?.message
      ?? (error as { details?: string } | null)?.details
      ?? error
      ?? ""
  );

  const statusMatch = message.match(/\b([1-5]\d{2})\b/);
  if (statusMatch) {
    const parsed = Number(statusMatch[1]);
    if (Number.isFinite(parsed)) return parsed;
  }

  const codeMatch = message.match(/(?:status|code)\s*[:=]\s*([1-5]\d{2})/i);
  if (codeMatch) {
    const parsed = Number(codeMatch[1]);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function logDashboard5xx(params: {
  route: DashboardRoute;
  endpoint: string;
  customerId?: string | null;
  error: unknown;
}) {
  const status = parseStatusCode(params.error);
  if (!status || status < 500 || status > 599) return;

  console.error("[dashboard-5xx]", {
    route: params.route,
    endpoint: params.endpoint,
    status,
    customerHash: hashCustomerId(params.customerId),
  });
}

export async function runGuardedDashboardTask<T, R>(
  options: GuardedTaskOptions<T, R>
): Promise<GuardedTaskResult<T>> {
  try {
    const result = await options.task();
    const mapped = options.mapResult
      ? options.mapResult(result)
      : {
          data: (result as { data?: T | null } | null)?.data ?? options.fallback,
          error: (result as { error?: unknown } | null)?.error,
        };

    if (mapped.error) {
      logDashboard5xx({
        route: options.route,
        endpoint: options.endpoint,
        customerId: options.customerId,
        error: mapped.error,
      });

      return {
        data: options.fallback,
        failed: true,
      };
    }

    return {
      data: mapped.data ?? options.fallback,
      failed: false,
    };
  } catch (error) {
    logDashboard5xx({
      route: options.route,
      endpoint: options.endpoint,
      customerId: options.customerId,
      error,
    });

    return {
      data: options.fallback,
      failed: true,
    };
  }
}
