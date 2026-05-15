import { NextRequest } from 'next/server';

const UPSTREAM =
  process.env.RAG_UPSTREAM_URL ??
  process.env.NEXT_PUBLIC_RAG_API_URL ??
  'http://localhost:8000';

function buildTarget(pathSegments: string[], search: string): string {
  const base = UPSTREAM.replace(/\/$/, '');
  const joined = pathSegments.map((s) => encodeURIComponent(s)).join('/');
  return `${base}/${joined}${search}`;
}

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
]);

async function handle(req: NextRequest, pathSegments: string[], method: string) {
  const target = buildTarget(pathSegments, req.nextUrl.search);
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  const init: RequestInit = { method, headers, redirect: 'manual' };
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }
  const upstream = await fetch(target, init);
  const outHeaders = new Headers(upstream.headers);
  outHeaders.delete('transfer-encoding');
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

type RouteCtx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return handle(req, path ?? [], 'GET');
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return handle(req, path ?? [], 'POST');
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return handle(req, path ?? [], 'PUT');
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return handle(req, path ?? [], 'DELETE');
}
