/**
 * Visually hidden link that becomes visible on keyboard focus, letting
 * keyboard / screen-reader users jump past the global header straight
 * into the page's main landmark. Required for WCAG 2.4.1 (Bypass Blocks).
 *
 * Pages must render their primary region as `<main id="main-content">`
 * (or pass `id="main-content"` to PageShell). When the link is activated
 * we also move keyboard focus into the target so subsequent Tab presses
 * continue from inside the content, not back at the URL bar.
 */
const TARGET_ID = "main-content";

const SkipToMain = () => {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(TARGET_ID);
    if (!target) return;
    event.preventDefault();
    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
    }
    target.focus({ preventScroll: false });
    target.scrollIntoView({ block: "start" });
  };

  return (
    <a
      href={`#${TARGET_ID}`}
      onClick={handleClick}
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-full focus-visible:bg-[hsl(var(--accent-500))] focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-[hsl(var(--accent-50))] focus-visible:shadow-lg"
    >
      Skip to main content
    </a>
  );
};

export default SkipToMain;
