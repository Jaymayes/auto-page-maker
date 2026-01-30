// Define the gtag function globally
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

// FE-001: Fix Google Analytics function signature and XSS vulnerability
export const initGA = () => {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

  if (!measurementId) {
    // Only warn once in development to avoid console spam
    if (import.meta.env.DEV && !(window as any).GA_WARNED) {
      console.warn('Google Analytics disabled: VITE_GA_MEASUREMENT_ID not set.');
      (window as any).GA_WARNED = true;
    }
    return;
  }

  // Validate measurement ID format to prevent XSS
  if (!/^G-[A-Z0-9]+$/.test(measurementId)) {
    console.error('Invalid Google Analytics measurement ID format');
    return;
  }

  // Add Google Analytics script to the head
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script1);

  // Initialize gtag - use proper script injection to prevent XSS
  const script2 = document.createElement('script');
  script2.textContent = [
    'window.dataLayer = window.dataLayer || [];',
    'function gtag(){dataLayer.push(arguments);}',
    'gtag("js", new Date());',
    `gtag("config", "${measurementId.replace(/[^A-Z0-9-]/g, '')}");`
  ].join('\n');
  document.head.appendChild(script2);
};

// Track page views - useful for single-page applications
export const trackPageView = (url: string) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId) return;
  
  // Sanitize URL to prevent XSS
  const sanitizedUrl = url.replace(/[<>"'&]/g, '');
  
  window.gtag('config', measurementId, {
    page_path: sanitizedUrl
  });
};

// FE-001: Fix function signature to match actual usage and add XSS protection
export const trackEvent = (
  action: string, 
  category: string,
  label?: string, 
  value?: number
) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  // Sanitize string inputs to prevent XSS
  const sanitizedAction = action.replace(/[<>"'&]/g, '');
  const sanitizedCategory = category.replace(/[<>"'&]/g, '');
  const sanitizedLabel = label?.replace(/[<>"'&]/g, '');
  
  window.gtag('event', sanitizedAction, {
    event_category: sanitizedCategory,
    event_label: sanitizedLabel,
    value: value,
  });
};
