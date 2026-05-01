"use client";

import { useEffect } from "react";

function isModifiedEvent(event: MouseEvent) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

function getDocumentHref(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href");
  if (!href) return null;

  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:")
  ) {
    return null;
  }

  return href;
}

export function ForceDocumentNavigation() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isModifiedEvent(event)) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!anchor) return;

      const href = getDocumentHref(anchor as HTMLAnchorElement);
      if (!href) return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;

      event.preventDefault();
      window.location.assign(url.pathname + url.search + url.hash);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
