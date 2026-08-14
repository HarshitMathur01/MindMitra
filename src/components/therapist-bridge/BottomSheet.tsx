import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | undefined;
  children?: ReactNode | undefined;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85dvh] overflow-y-auto rounded-t-2xl border-border bg-card px-6 pb-10 pt-7 sm:max-w-2xl"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="display text-3xl text-ink">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="text-base leading-relaxed text-muted-foreground">
              {description}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        {children ? <div className="mt-6">{children}</div> : null}
      </SheetContent>
    </Sheet>
  );
}
