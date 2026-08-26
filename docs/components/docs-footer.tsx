"use client";

import { PageFooter, type FooterProps } from "fumadocs-ui/layouts/docs/page";
import { SiteFooter } from "./site-footer";

/**
 * Footer slot for DocsPage: the built-in prev/next navigation, then the site
 * footer as a continuation of the article column — the sidebar keeps its own
 * full-height scroll and is never displaced. Client module so the component
 * reference can be passed through DocsPage's `slots` prop.
 */
export function DocsFooter(props: FooterProps) {
  return (
    <>
      <PageFooter {...props} />
      <SiteFooter variant="docs" />
    </>
  );
}
