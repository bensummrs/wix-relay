import express from 'express';

const app = express();
app.use(express.json());

const NEW_SITE_API_KEY = process.env.NEW_SITE_API_KEY;
const NEW_SITE_ID = process.env.NEW_SITE_ID;
const SECRET = process.env.SECRET;

app.post('/sync-payment', async (req, res) => {
  try {
    if (req.body.secret !== SECRET) {
      return res.status(401).json({ error: 'Unauthorised' });
    }

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'No email' });
    console.log(`\n=== Syncing payment for: ${email} ===`);

    const contactId = await findContactByEmail(email);
    if (!contactId) {
      return res.status(404).json({ error: `No contact found for ${email}` });
    }

    const memberId = await findMemberByContactId(contactId);
    if (!memberId) {
      return res.status(404).json({ error: 'No member found for contact' });
    }

    const order = await findUnpaidOrder(memberId);
    if (!order) {
      return res.status(404).json({ error: 'No unpaid order found' });
    }

    await markOrderAsPaid(order.id);

    console.log(`✅ Marked order ${order.id} as paid`);
    return res.json({ success: true, orderId: order.id });

  } catch (err) {
    console.error('Sync failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

const wixHeaders = {
  'Content-Type': 'application/json',
  Authorization: NEW_SITE_API_KEY,
  'wix-site-id': NEW_SITE_ID,
};

async function findContactByEmail(email) {
  const res = await fetch(
    'https://www.wixapis.com/contacts/v4/contacts/query',
    {
      method: 'POST',
      headers: wixHeaders,
      body: JSON.stringify({
        query: {
          filter: { 'info.emails.email': email },
          paging: { limit: 1 },
        },
      }),
    }
  );

  const data = await res.json();
  console.log(`[findContact] status=${res.status} response=${JSON.stringify(data)}`);

  if (!res.ok) {
    throw new Error(`Contacts API failed: ${JSON.stringify(data)}`);
  }

  return data?.contacts?.[0]?.id ?? null;
}

// --- Step 2: Find member from contact ID ---
async function findMemberByContactId(contactId) {
  const res = await fetch(
    'https://www.wixapis.com/members/v1/members/query',
    {
      method: 'POST',
      headers: wixHeaders,
      body: JSON.stringify({
        query: {
          filter: { contactId },
          paging: { limit: 1 },
        },
      }),
    }
  );

  const data = await res.json();
  console.log(`[findMember] status=${res.status} response=${JSON.stringify(data)}`);

  if (!res.ok) {
    throw new Error(`Members API failed: ${JSON.stringify(data)}`);
  }

  return data?.members?.[0]?.id ?? null;
}

// --- Step 3: Find unpaid order for member ---
async function findUnpaidOrder(memberId) {
  const url = new URL('https://www.wixapis.com/pricing-plans/v2/orders');
  url.searchParams.set('buyerIds', memberId);
  url.searchParams.set('paymentStatuses', 'UNPAID');

  const res = await fetch(url.toString(), { method: 'GET', headers: wixHeaders });
  const data = await res.json();
  console.log(`[findOrder] status=${res.status} response=${JSON.stringify(data)}`);

  if (!res.ok) {
    throw new Error(`Orders API failed: ${JSON.stringify(data)}`);
  }

  return data?.orders?.[0] ?? null;
}

// --- Step 4: Mark order as paid ---
async function markOrderAsPaid(orderId) {
  const res = await fetch(
    `https://www.wixapis.com/pricing-plans/v2/orders/${orderId}/mark-as-paid`,
    { method: 'POST', headers: wixHeaders }
  );

  const data = await res.json();
  console.log(`[markAsPaid] status=${res.status} response=${JSON.stringify(data)}`);

  if (!res.ok) {
    throw new Error(`Mark-as-paid failed: ${JSON.stringify(data)}`);
  }

  return data;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Relay running on port ${PORT}`));