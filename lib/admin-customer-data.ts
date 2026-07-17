type QueryError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export type AdminCustomerQueryResult = {
  name: string;
  error: QueryError | null | undefined;
};

function describeQueryError(error: QueryError) {
  const code = String(error.code || "unknown");
  const message = String(error.message || "Unknown Supabase query error");
  return `${code} ${message}`;
}

export function assertAdminCustomerQueriesSucceeded(results: AdminCustomerQueryResult[]) {
  const failures = results.filter((result) => result.error);
  if (failures.length === 0) return;

  const failureSummary = failures
    .map((result) => `${result.name}: ${describeQueryError(result.error as QueryError)}`)
    .join("; ");

  throw new Error(`Unable to load required admin customer-management data. ${failureSummary}`);
}
