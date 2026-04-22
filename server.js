import express from 'express';

const app = express();
app.use(express.json());

const NEW_SITE_API_KEY = process.env.NEW_SITE_API_KEY;
const NEW_SITE_ID = process.env.NEW_SITE_ID;
const SECRET = process.env.SECRET;

app.post('/sync-payment', async (req, res) => {
  try {
    // Verify the request came from your old Wix site
    if (req.body.secret !== SECRET) {
      return res.status(401).json({ error: 'Unauthorised' });
    }

    const email = req.body.email;
    if (!email) return res.status(400).json({ error: 'No email' });

    console.log(`Syncing payment for: ${email}`);

    // 1. Find contact on new site by email
    const contactRes = await fetch(
      'https://www.wixapis.com/contacts/v4/contacts/query',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: NEW_SITE_API_KEY,
          'wix-site-id': NEW_SITE_ID,
        },
        body: JSON.stringify({
          query: {
            filter: { 'info.emails.email': { $eq: email } },
            paging: { limit: 1 },
          },
        }),
      }
    );

    console.log(contactRes);
    const contactData = await contactRes.json();
    const contactId = contactData?.contacts?.[0]?.id;

    if (!contactId) {
      console.warn(`No contact found for ${email}. ${contactRes}`);
      return res.status(404).json({ error: 'Contact not found on new site' });
    }

    // 2. Find their unpaid subscription
    const subsRes = await fetch(
      'https://www.wixapis.com/pricing-plans/v2/orders/query',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: NEW_SITE_API_KEY,
          'wix-site-id': NEW_SITE_ID,
        },
        body: JSON.stringify({
          query: {
            filter: {
              'buyer.contactId': { $eq: contactId },
              lastPaymentStatus: { $eq: 'UNPAID' },
            },
            paging: { limit: 5 },
          },
        }),
      }
    );
    const subsData = await subsRes.json();
    const unpaidOrder = subsData?.orders?.[0];

    if (!unpaidOrder) {
      console.warn(`No unpaid order found for contact ${contactId}`);
      return res.status(404).json({ error: 'No unpaid order found' });
    }

    // 3. Mark as paid
    await fetch(
      `https://www.wixapis.com/pricing-plans/v2/orders/${unpaidOrder.id}/markAsPaid`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: NEW_SITE_API_KEY,
          'wix-site-id': NEW_SITE_ID,
        },
      }
    );

    console.log(`Marked order ${unpaidOrder.id} as paid`);
    return res.json({ success: true, orderId: unpaidOrder.id });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Relay running on port ${PORT}`));