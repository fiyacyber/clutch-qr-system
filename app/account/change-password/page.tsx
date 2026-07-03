import { redirect } from "next/navigation";

export default async function AccountChangePasswordAliasPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = String(params?.next || "").trim();
  const target = next ? `/change-password?next=${encodeURIComponent(next)}` : "/change-password";
  redirect(target);
}
