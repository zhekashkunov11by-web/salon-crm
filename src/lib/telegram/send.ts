const TELEGRAM_API = 'https://api.telegram.org/bot'

export type TelegramChat = 'all' | 'owners' | 'both'

async function sendMessage(token: string, chatId: string, text: string): Promise<boolean> {
  if (!token || !chatId) return false
  try {
    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function sendTelegram(
  text: string,
  chat: TelegramChat = 'all'
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatAll = process.env.TELEGRAM_CHAT_ID_ALL
  const chatOwners = process.env.TELEGRAM_CHAT_ID_OWNERS

  if (!token) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }
  }

  const results: boolean[] = []

  if ((chat === 'all' || chat === 'both') && chatAll) {
    results.push(await sendMessage(token, chatAll, text))
  }
  if ((chat === 'owners' || chat === 'both') && chatOwners) {
    results.push(await sendMessage(token, chatOwners, text))
  }

  if (results.length === 0) {
    return { ok: false, error: 'No chat IDs configured' }
  }

  return { ok: results.some(Boolean) }
}

export async function sendNewLeadNotification(lead: {
  client_name: string
  phone?: string
  source?: string
  status_name?: string
}): Promise<void> {
  const text = `🔔 *Новая заявка*\n\n` +
    `👤 ${lead.client_name}\n` +
    (lead.phone ? `📞 ${lead.phone}\n` : '') +
    (lead.source ? `📍 Источник: ${lead.source}\n` : '') +
    (lead.status_name ? `📋 Статус: ${lead.status_name}\n` : '') +
    `\n_Откройте CRM для работы с заявкой_`

  await sendTelegram(text, 'all')
}

export async function sendDailyReportNotification(report: {
  date: string
  total: number
  clients: number
  plan_progress: number
}): Promise<void> {
  const emoji = report.plan_progress >= 100 ? '🎉' : report.plan_progress >= 70 ? '📈' : '📉'
  const text = `${emoji} *Итоги дня ${report.date}*\n\n` +
    `💰 Выручка: *${new Intl.NumberFormat('ru-RU').format(report.total)} ₽*\n` +
    `👥 Клиентов: ${report.clients}\n` +
    `📊 План месяца: ${report.plan_progress}%`

  await sendTelegram(text, 'both')
}
