'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Компонент автоматически подгружает и вставляет пиксели/счётчики
// на основе настроек из таблицы analytics_settings
export default function PixelInjector() {
  useEffect(() => {
    const supabase = createClient()

    async function injectPixels() {
      const { data } = await supabase
        .from('analytics_settings')
        .select('key, value, is_enabled')

      if (!data) return

      const settings = Object.fromEntries(
        data.filter(r => r.is_enabled && r.value).map(r => [r.key, r.value])
      )

      // Яндекс Метрика
      if (settings.yandex_metrika && !document.getElementById('ym-script')) {
        const id = settings.yandex_metrika
        const script = document.createElement('script')
        script.id = 'ym-script'
        script.innerHTML = `
          (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
          m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
          (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
          ym(${id}, "init", { clickmap:true, trackLinks:true, accurateTrackBounce:true });
        `
        document.head.appendChild(script)
      }

      // Google Analytics 4
      if (settings.google_analytics && !document.getElementById('ga4-script')) {
        const id = settings.google_analytics
        const s1 = document.createElement('script')
        s1.id = 'ga4-script'
        s1.async = true
        s1.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
        document.head.appendChild(s1)
        const s2 = document.createElement('script')
        s2.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}');`
        document.head.appendChild(s2)
      }

      // VK Pixel
      if (settings.vk_pixel && !document.getElementById('vk-pixel-script')) {
        const id = settings.vk_pixel
        const script = document.createElement('script')
        script.id = 'vk-pixel-script'
        script.innerHTML = `
          !function(){var t=document.createElement("script");t.type="text/javascript",t.async=!0,
          t.src="https://vk.com/js/api/openapi.js?169",t.onload=function(){VK.Retargeting.Init("${id}"),VK.Retargeting.Hit()},
          document.head.appendChild(t)}();
        `
        document.head.appendChild(script)
      }

      // Meta Pixel (Facebook/Instagram)
      if (settings.fb_pixel && !document.getElementById('fb-pixel-script')) {
        const id = settings.fb_pixel
        const script = document.createElement('script')
        script.id = 'fb-pixel-script'
        script.innerHTML = `
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${id}');fbq('track','PageView');
        `
        document.head.appendChild(script)
      }

      // TikTok Pixel
      if (settings.tiktok_pixel && !document.getElementById('tt-pixel-script')) {
        const id = settings.tiktok_pixel
        const script = document.createElement('script')
        script.id = 'tt-pixel-script'
        script.innerHTML = `
          !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
          ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],
          ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
          for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
          ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},
          ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;
          ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
          n=document.createElement("script");n.type="text/javascript";n.async=!0;n.src=r+"?sdkid="+e+"&lib="+t;
          e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
          ttq.load('${id}');ttq.page()}(window,document,'ttq');
        `
        document.head.appendChild(script)
      }

      // Calltouch
      if (settings.calltouch && !document.getElementById('ct-script')) {
        const id = settings.calltouch
        const script = document.createElement('script')
        script.id = 'ct-script'
        script.innerHTML = `
          (function(w,d,n,c){w.CalltouchDataObject=n;w[n]=function(){w[n].q.push(arguments)};
          if(!w[n].q){w[n].q=[]}var s=d.createElement('script');s.async=true;
          s.src='https://mod.calltouch.ru/init.js?id=${id}';
          var fs=d.getElementsByTagName('script')[0];fs.parentNode.insertBefore(s,fs)})(window,document,'ct');
        `
        document.head.appendChild(script)
      }
    }

    injectPixels()
  }, [])

  return null
}
