import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "outline";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const variantClasses =
      variant === "outline"
        ? "border border-slate-700 text-slate-200 hover:bg-slate-800"
        : "bg-blue-600 text-white hover:bg-blue-700";

    return (
      <Comp
        className={cn(
          "px-4 py-2 rounded transition-colors",
          variantClasses,
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
