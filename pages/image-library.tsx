"use client";

import type { JSX } from "react";
import { GeneratedContentsLibrary } from "@/app/web/src/components/generated-contents/GeneratedContentsLibrary";

/**
 * Legacy route kept for bookmarks and OAuth redirects.
 * Canonical path: /generated-contents
 */
export default function ImageLibraryPage(): JSX.Element {
  return <GeneratedContentsLibrary />;
}
