import { forwardRef, type AnchorHTMLAttributes } from "react";
import { Link } from "react-router-dom";

/**
 * One anchor that does the right thing for all three link shapes the
 * landing uses:
 *
 *   `/auth`, `/privacy`  → react-router `<Link>` (client-side, no reload)
 *   `#personas`          → plain `<a>` (in-page scroll)
 *   `tel:` / `https://`  → plain `<a>`, external ones get rel + target
 *
 * Without this, in-app destinations on the marketing page would do a full
 * document reload and throw away the already-booted React tree.
 */
type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export const LandingLink = forwardRef<HTMLAnchorElement, Props>(
  function LandingLink({ href, children, ...rest }, ref) {
    if (href.startsWith("/")) {
      return (
        <Link ref={ref} to={href} {...rest}>
          {children}
        </Link>
      );
    }

    const isExternal = /^https?:/i.test(href);

    return (
      <a
        ref={ref}
        href={href}
        {...(isExternal
          ? { target: "_blank", rel: "noreferrer noopener" }
          : null)}
        {...rest}
      >
        {children}
      </a>
    );
  },
);
