import { createApp } from './app.js';

const port = Number(process.env.API_PORT || 3001);
createApp().listen(port, () => console.log(`Mini Checkout API listening on http://localhost:${port}`));
