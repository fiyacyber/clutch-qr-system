import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth";
import {
  buildSetupForgotPasswordPath,
  GUIDED_SETUP_ENTRY_PATH,
  resolvePostLoginRedirect,
} from "@/lib/onboarding-routing";

export default async function SetupGuidedEntryPage() {
  const { user } = await requireCustomer();

  if (!user) {
    redirect(buildSetupForgotPasswordPath({ nextPath: GUIDED_SETUP_ENTRY_PATH }));
  }

  const redirectPath = await resolvePostLoginRedirect({
    authUserId: user.id,
    requestedNext: GUIDED_SETUP_ENTRY_PATH,
  });

  redirect(redirectPath);
}
