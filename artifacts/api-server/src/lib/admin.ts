import { clerkClient } from "@clerk/express";

// The app owner/admin is matched by email via the ADMIN_EMAIL secret. This is
// intentionally email-based (the owner knows their email; not their cryptic
// Clerk user id). When ADMIN_EMAIL is unset, NOBODY is admin — the dashboard is
// inaccessible by default, which is the safe failure mode.
export async function isAdminUser(userId: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return false;

  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
    return !!email && email === adminEmail;
  } catch {
    // Clerk lookup failed — deny rather than risk granting access.
    return false;
  }
}
