import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import en from "@/locales/en.json";
import es from "@/locales/es.json";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it('matches the public admin password sign-in screen', () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes('/admin-login');
    expect(matches.at(-1)?.routeId).toBe('/admin-login');
    expect(matches.some(route => route.routeId === '/_authenticated')).toBe(false);
  });
  it.each(["/home", "/events", "/team", "/learn", "/me"])("matches protected ZoheeWell tab %s", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(`/_authenticated/_app${path}`);
  });

  it.each([["/login", "/login"], ["/join/ABC123", "/join/$code"], ["/e/123", "/e/$id"], ["/terms", "/terms"], ["/privacy", "/privacy"], ["/", "/"], ["/discover", "/discover"], ["/credits", "/credits"], ["/onboarding", "/_authenticated/onboarding"]])("matches %s", (path, id) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(id);
  });

  it("keeps English and Spanish translation keys aligned", () => {
    const keys = (value: Record<string, unknown>, prefix = ""): string[] =>
      Object.entries(value).flatMap(([key, child]) =>
        typeof child === "object" && child !== null
          ? keys(child as Record<string, unknown>, `${prefix}${key}.`)
          : [`${prefix}${key}`],
      ).sort();
    expect(keys(es)).toEqual(keys(en));
  });

  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});
