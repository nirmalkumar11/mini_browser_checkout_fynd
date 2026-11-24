import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MAX_QTY, PRODUCTS } from './products.js';
import { validateOrder } from './validate.js';
import { REFERENCE_PATTERN, createOrderStore } from './orders.js';

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

export function createApp({ store = createOrderStore() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.get('/api/products', (_req, res) => res.json({ products: PRODUCTS, maxQuantity: MAX_QTY }));

  app.post('/api/orders', (req, res) => {
    const result = validateOrder(req.body);
    if (result.errors) {
      return res.status(400).json({ error: 'validation_failed', details: result.errors });
    }
    const order = store.create(result);
    res.status(201).location(`/api/orders/${order.reference}`).json(order);
  });

  app.get('/api/orders/:reference', (req, res) => {
    const order = REFERENCE_PATTERN.test(req.params.reference) ? store.get(req.params.reference) : undefined;
    if (!order) return res.status(404).json({ error: 'order_not_found' });
    res.json(order);
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  // Optional: after `npm run build`, Express also serves the React app.
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large' });
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
