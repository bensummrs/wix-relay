import { headersFor, findContactByEmail, findMemberByContactId, NEW_SITE_ID } from './wix-api.js';

async function findUnpaidSubscription(memberId, planName = null) {
  const url = new URL('https://www.wixapis.com/pricing-plans/v2/orders');
  url.searchParams.set('buyerIds', memberId);
  url.searchParams.set('paymentStatuses', 'UNPAID');
  url.searchParams.append('orderStatuses', 'ACTIVE');
  url.searchParams.append('orderStatuses', 'PENDING');

  const res = await fetch(url.toString(), { method: 'GET', headers: headersFor(NEW_SITE_ID) });
  const data = await res.json();
  console.log(`[findSubscription] status=${res.status} found=${data?.orders?.length ?? 0}`);
  if (!res.ok) throw new Error(`Orders API failed: ${JSON.stringify(data)}`);

  const candidates = data?.orders ?? [];
  if (planName) {
    const matched = candidates.find((o) => o.planName === planName);
    if (matched) return matched;
    console.warn(`[findSubscription] No match for plan "${planName}", using first candidate`);
  }
  return candidates.find((o) => o.status === 'ACTIVE') ?? candidates[0] ?? null;
}

async function markOrderAsPaid(orderId) {
  const res = await fetch(
    `https://www.wixapis.com/pricing-plans/v2/orders/${orderId}/mark-as-paid`,
    { method: 'POST', headers: headersFor(NEW_SITE_ID) }
  );
  const data = await res.json();
  console.log(`[markAsPaid] status=${res.status} response=${JSON.stringify(data)}`);
  if (!res.ok) throw new Error(`Mark-as-paid failed: ${JSON.stringify(data)}`);
  return data;
}

export async function syncPayment({ email, planName }) {
  console.log(`\n=== Syncing payment for: ${email} ===`);

  const contactId = await findContactByEmail(email, NEW_SITE_ID);
  if (!contactId) return { error: `No contact found for ${email}`, status: 404 };

  const memberId = await findMemberByContactId(contactId, NEW_SITE_ID);
  if (!memberId) return { error: 'No member found for contact', status: 404 };

  const order = await findUnpaidSubscription(memberId, planName);
  if (!order) return { error: 'No unpaid order found', status: 404 };

  await markOrderAsPaid(order.id);
  console.log(`✅ Marked order ${order.id} as paid`);
  return { success: true, orderId: order.id };
}