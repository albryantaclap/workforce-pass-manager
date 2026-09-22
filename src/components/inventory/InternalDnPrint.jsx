/**
 * InternalDnPrint — opens a print-ready window for an Internal Delivery Note.
 * @param {Object} transfer — The TRANSFER InventoryTransaction record.
 */
export function printInternalDn(transfer) {
  const win = window.open('', '_blank', 'width=800,height=600');
  if (!win) return;

  const rows = Array.isArray(transfer) ? transfer : [transfer];

  const itemRows = rows.map(t => `
    <tr>
      <td style="text-align:center">${t.item_sn || ''}</td>
      <td>${t.item_name || ''}</td>
      <td style="text-align:center">${t.unit || ''}</td>
      <td style="text-align:center">${t.quantity_abs || 0}</td>
    </tr>`).join('');

  const first = rows[0] || {};

  win.document.write(`
    <html>
    <head>
      <title>Internal Delivery Note — ${first.internal_dn_no || ''}</title>
      <style>
        * { font-family: Arial, Helvetica, sans-serif; }
        body { padding: 40px; color: #1a1a1a; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { font-size: 20px; margin: 0; letter-spacing: 1px; }
        .header p { font-size: 12px; color: #666; margin: 4px 0 0; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
        .meta div { line-height: 1.8; }
        .meta strong { font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
        th, td { border: 1px solid #ccc; padding: 8px 10px; }
        th { background: #f5f5f5; font-weight: 700; text-align: left; }
        .remarks { margin: 16px 0; font-size: 13px; }
        .signatures { margin-top: 64px; display: flex; justify-content: space-around; }
        .sig-block { text-align: center; }
        .sig-line { border-top: 1px solid #333; width: 220px; padding-top: 6px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>INTERNAL DELIVERY NOTE</h1>
        <p>Store-to-Store Stock Transfer</p>
      </div>
      <div class="meta">
        <div>
          <strong>DN No:</strong> ${first.internal_dn_no || ''}<br/>
          <strong>Date:</strong> ${first.transaction_date || ''}
        </div>
        <div>
          <strong>From Store:</strong> ${first.transfer_from_store || ''}<br/>
          <strong>To Store:</strong> ${first.transfer_to_store || ''}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:120px;text-align:center">Item S.N.</th>
            <th>Item Name / Description</th>
            <th style="width:80px;text-align:center">Unit</th>
            <th style="width:100px;text-align:center">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
      ${first.remarks ? `<div class="remarks"><strong>Remarks:</strong> ${first.remarks}</div>` : ''}
      <div class="signatures">
        <div class="sig-block"><div class="sig-line">Prepared By</div></div>
        <div class="sig-block"><div class="sig-line">Authorized By</div></div>
        <div class="sig-block"><div class="sig-line">Received By</div></div>
      </div>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}