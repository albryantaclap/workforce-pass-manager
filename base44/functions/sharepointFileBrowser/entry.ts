import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, driveId, itemId, path } = await req.json();

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("share_point");

    const headers = { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' };

    if (action === 'getSites') {
      // Get the root site info
      const res = await fetch('https://graph.microsoft.com/v1.0/sites/root', { headers });
      const site = await res.json();
      return Response.json({ site });
    }

    if (action === 'getDrives') {
      const siteId = path;
      const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drives`, { headers });
      const data = await res.json();
      return Response.json({ drives: data.value || [] });
    }

    if (action === 'listFiles') {
      let url;
      if (itemId) {
        url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/children`;
      } else {
        url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;
      }
      url += '?$select=id,name,file,folder,@microsoft.graph.downloadUrl,thumbnails&$expand=thumbnails';
      const res = await fetch(url, { headers });
      const data = await res.json();
      return Response.json({ items: data.value || [] });
    }

    if (action === 'getDownloadUrl') {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}?$select=id,name,@microsoft.graph.downloadUrl`,
        { headers }
      );
      const data = await res.json();
      return Response.json({ downloadUrl: data['@microsoft.graph.downloadUrl'] });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});