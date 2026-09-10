import { app } from '@/lib/hono-app';

export const dynamic = 'force-dynamic';

export const GET = (req: Request) => app.fetch(req);
export const POST = (req: Request) => app.fetch(req);
export const PUT = (req: Request) => app.fetch(req);
export const DELETE = (req: Request) => app.fetch(req);
export const PATCH = (req: Request) => app.fetch(req);
