/**
 * Video Converter Pro (Web) - Analytics & UTM Tracking
 * GA4 event tracking and Mezamii UTM link generation
 */

const GA4_ID = 'G-4LQPFT3P9Z';
const UTM_BASE = 'https://mezamii.com';
const UTM_SOURCE = 'videoconverter_web';
const UTM_MEDIUM = 'webapp';

/**
 * Initialize Google Analytics 4
 */
export function initAnalytics() {
  // Load gtag.js
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA4_ID, {
    page_title: 'Video Converter Pro Web',
    page_location: window.location.href
  });
}

/**
 * Track custom events
 */
export function trackEvent(eventName, params = {}) {
  if (window.gtag) {
    window.gtag('event', eventName, params);
  }
}

/**
 * Track conversion start
 */
export function trackConversionStart(format, preset, fileCount) {
  trackEvent('conversion_start', {
    output_format: format,
    quality_preset: preset,
    file_count: fileCount,
    platform: 'web'
  });
}

/**
 * Track conversion complete
 */
export function trackConversionComplete(format, fileCount, totalDuration) {
  trackEvent('conversion_complete', {
    output_format: format,
    file_count: fileCount,
    total_duration_ms: totalDuration,
    platform: 'web'
  });
}

/**
 * Track PWA install
 */
export function trackPWAInstall() {
  trackEvent('pwa_install', { platform: 'web' });
}

/**
 * Track theme toggle
 */
export function trackThemeToggle(theme) {
  trackEvent('theme_toggle', { theme });
}

/**
 * Generate Mezamii UTM link
 */
export function mezamiiLink(campaign) {
  return `${UTM_BASE}?utm_source=${UTM_SOURCE}&utm_medium=${UTM_MEDIUM}&utm_campaign=${campaign}`;
}
