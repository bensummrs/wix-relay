const NEW_SITE_API_KEY = process.env.NEW_SITE_API_KEY;

export const NEW_SITE_ID = process.env.NEW_SITE_ID;
export const OLD_SITE_ID = process.env.OLD_SITE_ID;

export function headersFor(siteId) {
  return {
    'Content-Type': 'application/json',
    Authorization: NEW_SITE_API_KEY,
    'wix-site-id': siteId,
  };
}

export async function findContactByEmail(email, siteId) {
  const res = await fetch(
    'https://www.wixapis.com/contacts/v4/contacts/query',
    {
      method: 'POST',
      headers: headersFor(siteId),
      body: JSON.stringify({
        query: { filter: { 'info.emails.email': email }, paging: { limit: 1 } },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Contacts API failed: ${JSON.stringify(data)}`);
  return data?.contacts?.[0]?.id ?? null;
}

export async function findMemberByContactId(contactId, siteId) {
  const res = await fetch(
    'https://www.wixapis.com/members/v1/members/query',
    {
      method: 'POST',
      headers: headersFor(siteId),
      body: JSON.stringify({
        query: { filter: { contactId }, paging: { limit: 1 } },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Members API failed: ${JSON.stringify(data)}`);
  return data?.members?.[0]?.id ?? null;
}

export async function getMemberEmail(memberId, siteId) {
  const res = await fetch(
    `https://www.wixapis.com/members/v1/members/${memberId}`,
    { method: 'GET', headers: headersFor(siteId) }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Get member failed: ${JSON.stringify(data)}`);
  return data?.member?.loginEmail ?? null;
}