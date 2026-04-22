import {
  headersFor,
  findContactByEmail,
  findMemberByContactId,
  getMemberEmail,
  NEW_SITE_ID,
  OLD_SITE_ID,
} from './wix-api.js';

async function findRecentlyCancelledOnNewSite(sinceHours = 25) {
  const sinceDate = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  const url = new URL('https://www.wixapis.com/pricing-plans/v2/orders');
  url.searchParams.append('orderStatuses', 'CANCELED');

  const res = await fetch(url.toString(), { method: 'GET', headers: headersFor(NEW_SITE_ID) });
  const data = await res.json();
  console.log(`[cancelCheck] found ${data?.orders?.length ?? 0} cancelled on new site`);
  if (!res.ok) throw new Error(`New site query failed: ${JSON.stringify(data)}`);

  return (data?.orders ?? []).filter((o) => {
    const cancelDate = o.cancellation?.effectiveAt;
    return cancelDate && new Date(cancelDate) >= sinceDate;
  });
}

async function findActiveOrderOnOldSite(email) {
  const contactId = await findContactByEmail(email, OLD_SITE_ID);
  if (!contactId) return null;

  const memberId = await findMemberByContactId(contactId, OLD_SITE_ID);
  if (!memberId) return null;

  const url = new URL('https://www.wixapis.com/pricing-plans/v2/orders');
  url.searchParams.set('buyerIds', memberId);
  url.searchParams.append('orderStatuses', 'ACTIVE');
  url.searchParams.append('orderStatuses', 'PENDING');

  const res = await fetch(url.toString(), { method: 'GET', headers: headersFor(OLD_SITE_ID) });
  const data = await res.json();
  if (!res.ok) throw new Error(`Old site orders query failed: ${JSON.stringify(data)}`);
  return data?.orders?.[0] ?? null;
}

async function cancelOrderOnOldSite(orderId) {
  const res = await fetch(
    `https://www.wixapis.com/pricing-plans/v2/orders/${orderId}/cancel`,
    {
      method: 'POST',
      headers: headersFor(OLD_SITE_ID),
      body: JSON.stringify({ effectiveAt: 'IMMEDIATELY' }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Cancel failed: ${JSON.stringify(data)}`);
  return data;
}

export async function syncCancellations() {
  console.log(`\n=== Running cancellation sync at ${new Date().toISOString()} ===`);
  try {
    const cancelled = await findRecentlyCancelledOnNewSite(25);

    for (const order of cancelled) {
      const memberId = order.buyer?.memberId;
      if (!memberId) continue;

      try {
        const email = await getMemberEmail(memberId, NEW_SITE_ID);
        if (!email) {
          console.warn(`No email for member ${memberId}`);
          continue;
        }

        console.log(`Processing cancellation for ${email}`);
        const oldOrder = await findActiveOrderOnOldSite(email);
        if (!oldOrder) {
          console.log(`  → No active order on old site for ${email}, skipping`);
          continue;
        }

        await cancelOrderOnOldSite(oldOrder.id);
        console.log(`  ✅ Cancelled old site order ${oldOrder.id}`);
      } catch (err) {
        console.error(`  ❌ Failed for member ${memberId}:`, err.message);
      }
    }

    console.log(`=== Cancellation sync complete ===\n`);
  } catch (err) {
    console.error('Cancellation sync failed:', err);
  }
}