interface OverdueItem {
  contactName: string
  company: string | null
  action: string
  daysOverdue: number
  contactUrl: string
}

export function buildDigestHtml(items: OverdueItem[], appUrl: string): string {
  const rows = items.map(item => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #DDD6CC;">
        <a href="${item.contactUrl}" style="color: #B5876B; text-decoration: none; font-weight: 500;">
          ${item.contactName}
        </a>
        ${item.company ? `<span style="color: #7A746D;"> &middot; ${item.company}</span>` : ''}
        <br/>
        <span style="color: #3A3632; font-size: 14px;">${item.action}</span>
        <br/>
        <span style="color: #C0392B; font-size: 12px; font-weight: 500;">${item.daysOverdue} day${item.daysOverdue !== 1 ? 's' : ''} overdue</span>
      </td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; padding: 32px 16px;">
    <h1 style="font-family: 'DM Serif Display', Georgia, serif; color: #2C2C2C; font-size: 24px; margin-bottom: 4px;">
      StillPoint
    </h1>
    <p style="color: #7A746D; font-size: 13px; margin-top: 0; margin-bottom: 24px;">
      Daily Digest &mdash; ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
    </p>

    <div style="background: #F5F2ED; border: 1px solid #DDD6CC; border-radius: 8px; overflow: hidden;">
      <div style="background: #E8E0D4; padding: 10px 16px;">
        <strong style="color: #2C2C2C; font-size: 14px;">${items.length} overdue action${items.length !== 1 ? 's' : ''}</strong>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        ${rows}
      </table>
    </div>

    <p style="text-align: center; margin-top: 24px;">
      <a href="${appUrl}" style="display: inline-block; background: #B5876B; color: #FAF8F5; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
        Open StillPoint CIS
      </a>
    </p>

    <p style="color: #8A8279; font-size: 11px; text-align: center; margin-top: 32px;">
      StillPoint Commercial Partners
    </p>
  </div>
</body>
</html>`
}
