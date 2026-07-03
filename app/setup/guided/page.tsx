import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth";
import { GUIDED_SETUP_ENTRY_PATH, resolvePostLoginRedirect } from "@/lib/onboarding-routing";

export default async function SetupGuidedEntryPage() {
  const { user } = await requireCustomer();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(GUIDED_SETUP_ENTRY_PATH)}`);
  }

  const redirectPath = await resolvePostLoginRedirect({
    authUserId: user.id,
    requestedNext: GUIDED_SETUP_ENTRY_PATH,
  });

  redirect(redirectPath);
}
