export const printReceipt = (transaction: any, items: any[], brandName: string) => {
  // Format for 58mm thermal printer (~48mm printable area / ~384 dots)
  // Usually translates to about 32-48 characters per line depending on font size
  
  const formattedDate = new Date(transaction.created_at).toLocaleString('id-ID');
  
  let itemsHtml = '';
  items.forEach(item => {
    const itemName = item.quantity + 'x ' + item.product_name;
    const price = 'Rp ' + item.subtotal?.toLocaleString('id-ID');
    
    itemsHtml += `
      <div class="item">
        <div class="item-name">${itemName}</div>
        <div class="item-price">${price}</div>
      </div>
      ${item.serve_type ? `<div class="item-serve-type">${item.serve_type}</div>` : ''}
    `;
  });

  const html = `
    <html>
      <head>
        <style>
          @page { margin: 0; size: 58mm auto; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 58mm;
            padding: 2mm;
            margin: 0;
            font-size: 12px;
            color: #000;
            line-height: 1.2;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
          .brand { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 5px; text-transform: uppercase; }
          .header-info { text-align: center; font-size: 10px; margin-bottom: 10px; }
          .item { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2px; }
          .item-name { width: 65%; word-wrap: break-word; }
          .item-price { width: 35%; text-align: right; }
          .item-serve-type { font-size: 10px; color: #333; margin-left: 15px; margin-bottom: 2px; }
          .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 5px; }
          .footer { text-align: center; font-size: 10px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="brand">${brandName}</div>
        <div class="header-info">
          <div>Receipt #${transaction.id.split('-')[0].toUpperCase()}</div>
          <div>${formattedDate}</div>
          <div>Cashier: ${transaction.staff_id.split('-')[0]}</div>
        </div>
        
        <div class="divider"></div>
        ${itemsHtml}
        <div class="divider"></div>
        
        <div class="total-row">
          <div>TOTAL</div>
          <div>Rp ${transaction.total_amount?.toLocaleString('id-ID')}</div>
        </div>
        
        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 5px;">
          <div>Payment:</div>
          <div>${transaction.payment_method}</div>
        </div>

        ${transaction.payment_method === 'CASH' && transaction.change_amount !== undefined ? `
          <div style="display: flex; justify-content: space-between; font-size: 10px;">
            <div>Cash:</div>
            <div>Rp ${(transaction.total_amount + transaction.change_amount).toLocaleString('id-ID')}</div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10px;">
            <div>Change:</div>
            <div>Rp ${transaction.change_amount.toLocaleString('id-ID')}</div>
          </div>
        ` : ''}
        
        <div class="footer">
          <div>Thank you for your visit!</div>
          <div>Powered by Jagoan Kasir</div>
        </div>
      </body>
    </html>
  `;

  // Create an invisible iframe, insert the HTML, and print it
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    // Wait a brief moment for styles to apply before printing
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Remove iframe after printing dialog closes
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  }
};
