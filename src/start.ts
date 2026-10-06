import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { getRequest, setResponseHeader } from '@tanstack/react-start/server';

const publicCache = createMiddleware().server(async ({ next }) => {
  const request = getRequest(); const path = new URL(request.url).pathname;
  const publicPage = path === '/' || path === '/discover' || /^\/e\/[0-9a-f-]{36}$/i.test(path);
  if (request.method === 'GET' && publicPage && !request.headers.has('authorization') && !request.headers.has('cookie')) {
    setResponseHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=60');
  } else { setResponseHeader('Cache-Control', 'private, no-store'); }
  return next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(getRequest().headers.get('accept-language') ?? 'en'), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware, publicCache],
}));
