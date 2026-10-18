// Cloudflare Pages Function: every request under /api/* is handled by the Hono app.
import { handle } from 'hono/cloudflare-pages';
import { app } from '../../server/index';

export const onRequest = handle(app);
