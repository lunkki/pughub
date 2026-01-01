import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageRoles } from "@/lib/permissions";
import { RoleManagerClient } from "./RoleManagerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RolesPage() {
  const user = await getCurrentUser();
  if (!user) {
    const redirectParam = encodeURIComponent("/admin/roles");
    return (
      <div className="p-10 text-slate-50">
        <h1 className="text-xl font-bold mb-4">You must be logged in.</h1>
        <Link
          href={`/api/auth/steam?redirect=${redirectParam}`}
          className="underline text-sky-400"
        >
          Sign in with Steam
        </Link>
      </div>
    );
  }

  if (!canManageRoles(user)) {
    return (
      <div className="p-10 text-slate-50">
        <h1 className="text-xl font-bold mb-2">Access denied</h1>
        <p className="text-slate-300 text-sm">
          Only admins can manage roles.
        </p>
      </div>
    );
  }

  const users = await prisma.user.findMany({
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      steamId: true,
      role: true,
      avatarUrl: true,
    },
  });

  return (
    <div className="w-full space-y-6 p-6 text-slate-50 md:p-8">
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0e1627] p-6 shadow-2xl shadow-sky-900/30 md:p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-sky-200">
          Admin
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Role management</h1>
        <p className="mt-2 text-sm text-slate-300">
          Assign PLAYER, MANAGER, or ADMIN roles.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-sky-900/10">
        <RoleManagerClient initialUsers={users} currentUserId={user.id} />
      </div>
    </div>
  );
}
