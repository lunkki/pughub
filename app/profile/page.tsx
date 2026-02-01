import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function ProfileRedirectPage() {
  const user = await getCurrentUser();
  if (!user) {
    const redirectParam = encodeURIComponent("/profile");
    redirect(`/api/auth/steam?redirect=${redirectParam}`);
  }

  redirect(`/profile/${user.steamId}`);
}
