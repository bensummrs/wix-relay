import express from 'express';
import { syncPayment } from './sync-payment.js';
import { syncCancellations } from './sync-cancellations.js';

const app = express();
app.use(express.json());

const SECRET = process.env.SECRET;

function requireSecret(req, res, next) {
  if (req.body.secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  next();
}

app.post('/sync-payment', requireSecret, async (req, res) => {
  try {
    const { email, planName } = req.body;
    if (!email) return res.status(400).json({ error: 'No email' });

    const result = await syncPayment({ email, planName });
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.json(result);
  } catch (err) {
    console.error('sync-payment failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/sync-cancellations', requireSecret, (req, res) => {
  syncCancellations(); // fire and forget
  res.json({ started: true });
});

const DAY_MS = 24 * 60 * 60 * 1000;
setInterval(syncCancellations, DAY_MS);
setTimeout(syncCancellations, 10_000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Relay running on port ${PORT}`));