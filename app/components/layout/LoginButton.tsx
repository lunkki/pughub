"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/app/components/ui/Button";

export function LoginButton() {
  const pathname = usePathname();

  return (
    <Button asChild variant="outline">
      <a href={`/api/auth/steam?redirect=${pathname}`}>
        Sign in with Steam
      </a>
    </Button>
  );
}
