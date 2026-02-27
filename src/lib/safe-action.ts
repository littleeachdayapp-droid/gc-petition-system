import { createSafeActionClient } from "next-safe-action";
import { getCurrentUser } from "@/lib/auth-helpers";

export const actionClient = createSafeActionClient({
  handleServerError(e) {
    console.error("Action error:", e.message);
    return e.message;
  },
});

export const authActionClient = actionClient.use(async ({ next }) => {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return next({ ctx: { user } });
});
