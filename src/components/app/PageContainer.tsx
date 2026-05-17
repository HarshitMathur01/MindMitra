import * as React from "react";
import { cn } from "@/lib/utils";

type ContainerWidth = "sm" | "md" | "content" | "wide" | "full";

const widthMap: Record<ContainerWidth, string> = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  content: "max-w-4xl",  // settings, profile, forms
  wide: "max-w-5xl",     // catalogs, mindgym hub
  full: "max-w-none",    // chat, dashboard
};

interface PageContainerProps extends React.HTMLAttributes<HTMLElement> {
  as?: "main" | "div" | "section";
  width?: ContainerWidth;
}

/**
 * Standard page container — wraps content with consistent horizontal padding
 * and max-width. Always mobile-first.
 *
 * Usage:
 *   <PageContainer width="content" className="py-8 pb-24 md:pb-8">
 */
const PageContainer = React.forwardRef<HTMLElement, PageContainerProps>(
  ({ as: Tag = "main", width = "content", className, children, ...props }, ref) => {
    return (
      // @ts-expect-error — polymorphic ref
      <Tag
        ref={ref}
        className={cn(
          "mx-auto w-full px-4 sm:px-6 lg:px-8",
          widthMap[width],
          className
        )}
        {...props}
      >
        {children}
      </Tag>
    );
  }
);

PageContainer.displayName = "PageContainer";

export { PageContainer, type ContainerWidth };
