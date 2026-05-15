import Link from 'next/link'

const SETTINGS_SECTIONS = [
  {
    href: '/settings/general',
    icon: '🏪',
    title: 'Общие настройки',
    desc: 'Название салона, план выручки, часовой пояс',
  },
  {
    href: '/settings/staff',
    icon: '👥',
    title: 'Сотрудники',
    desc: 'Мастера, косметологи, администраторы, ставки',
  },
  {
    href: '/settings/references',
    icon: '📚',
    title: 'Справочники',
    desc: 'Категории расходов, расходники, технологические карты',
  },
  {
    href: '/settings/services',
    icon: '💆',
    title: 'Услуги',
    desc: 'Список услуг, привязка к направлению, себестоимость',
  },
  {
    href: '/settings/channels',
    icon: '📣',
    title: 'Каналы трафика',
    desc: 'Instagram, ВКонтакте, Яндекс, Google и другие',
  },
  {
    href: '/settings/accounts',
    icon: '💳',
    title: 'Счета',
    desc: 'Наличные, карта/терминал, расчётный счёт',
  },
  {
    href: '/settings/funnel',
    icon: '🔄',
    title: 'Воронка продаж',
    desc: 'Статусы, дополнительные поля карточек',
  },
  {
    href: '/settings/dikidi',
    icon: '🔗',
    title: 'Интеграция Dikidi',
    desc: 'API ключ, синхронизация, лог',
  },
  {
    href: '/settings/amocrm',
    icon: '💬',
    title: 'Интеграция amoCRM',
    desc: 'Омниканальные входящие: Instagram, ВК, Telegram, WhatsApp, Facebook',
  },
  {
    href: '/settings/telegram',
    icon: '📱',
    title: 'Telegram уведомления',
    desc: 'Бот, чаты, какие события отправлять',
  },
  {
    href: '/settings/ad-platforms',
    icon: '📡',
    title: 'Рекламные платформы',
    desc: 'Facebook, Instagram, Яндекс Директ, VK, Google Ads, Telegram Ads',
  },
  {
    href: '/settings/analytics',
    icon: '🔬',
    title: 'Пиксели и аналитика',
    desc: 'Яндекс Метрика, GA4, VK Pixel, Meta Pixel, TikTok Pixel, Calltouch',
  },
]

export default function SettingsPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Настройки</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SETTINGS_SECTIONS.map(section => (
          <Link
            key={section.href}
            href={section.href}
            className="card p-5 hover:shadow-md hover:border-violet-200 transition-all group"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{section.icon}</span>
              <div>
                <h3 className="font-semibold text-gray-900 group-hover:text-violet-700 transition-colors">
                  {section.title}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{section.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
