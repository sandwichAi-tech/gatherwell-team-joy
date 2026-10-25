import { claimReferralVisits } from '@/components/referrals';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmHost } from '@/components/confirm-dialog';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import i18n, { applySavedLanguage, isServerRenderedMarketing } from "@/lib/i18n";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ListSkeleton } from '@/components/launch-states';
import { clearPendingInvite } from '@/lib/account';
import { BrandLogo } from '@/components/brand-logo';

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="missing-page">
      <div className="missing-inner">
        <span className="brand"><BrandLogo /><span className="sr-only">{t('brand')}</span></span>
        <h1 className="missing-number">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("error.notFound")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("error.missing")}
        </p>
        <div className="mt-6">
          <Button asChild><Link to="/">{t("error.home")}</Link></Button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">
          {t("error.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("error.message")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("error.retry")}
          </Button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("error.home")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: i18n.t("brand") },
      { name: "description", content: i18n.t("meta.home") },
      { name: "theme-color", content: "#F7F0F0" },
      { property: "og:title", content: i18n.t("brand") },
      { property: "og:description", content: i18n.t("meta.home") },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "ZoheeWell" },
      { name: "twitter:card", content: "summary_large_image" },

    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png?v=zoheewell-logo", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png?v=zoheewell-logo" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  pendingComponent: ListSkeleton,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    // Server-rendered marketing pages switch language themselves once their own content has hydrated.
    if (!isServerRenderedMarketing(window.location.pathname)) applySavedLanguage();
    const theme = localStorage.getItem("gatherwell-theme") ?? "system";
    document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches));
    const applyLanguage = () => { document.documentElement.lang = i18n.resolvedLanguage ?? "en"; };
    applyLanguage(); i18n.on("languageChanged", applyLanguage);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      // A saved invite or return path never carries over to a different account on this device.
      if (event === "SIGNED_OUT") { clearPendingInvite(); try { sessionStorage.removeItem("zw-next"); } catch { /* storage unavailable */ } }
      if (event === "SIGNED_IN") claimReferralVisits();
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => { i18n.off("languageChanged", applyLanguage); data.subscription.unsubscribe(); };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <a className="skip-link" href="#main-content">{i18n.t('launch.skip')}</a>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="bottom-center" swipeDirections={["bottom","left","right"]} className="gw-toaster" />
      <ConfirmHost />
    </QueryClientProvider>
  );
}
