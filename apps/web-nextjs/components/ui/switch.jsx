"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function Switch({
  className,
  checked: checkedProp,
  defaultChecked,
  onCheckedChange,
  disabled,
  ...props
}) {
  const [uncontrolled, setUncontrolled] = React.useState(Boolean(defaultChecked));
  const isControlled = checkedProp !== undefined;
  const checked = isControlled ? checkedProp : uncontrolled;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "peer inline-flex h-[1.15rem] w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary text-primary-foreground" : "bg-input dark:bg-input/80",
        className
      )}
      onClick={() => {
        if (disabled) return;
        const next = !checked;
        if (!isControlled) setUncontrolled(next);
        onCheckedChange?.(next);
      }}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background shadow-xs ring-0 transition-transform",
          checked ? "translate-x-[calc(100%-2px)] dark:bg-primary-foreground" : "translate-x-0"
        )}
      />
    </button>
  );
}
