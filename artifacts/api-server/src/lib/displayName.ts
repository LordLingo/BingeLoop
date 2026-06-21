import { clerkClient } from "@clerk/express";

export async function resolveDisplayName(userId: string): Promise<string> {
  const user = await clerkClient.users.getUser(userId);
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.primaryEmailAddress?.emailAddress ||
    "Unknown"
  );
}
