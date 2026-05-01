"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/app/components/ui/Button";

export function LoginButton() {
  const pathname = usePathname();
  const redirect = encodeURIComponent(pathname);

  return (
    <Button asChild variant="outline">
      <a href={`/api/auth/steam?redirect=${redirect}`}>
        Sign in with Steam
      </a>
    </Button>
  );
}
