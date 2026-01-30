import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";

// Render app immediately
createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// Defer performance and SEO tracking to idle
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    import("./lib/performance-metrics").then(({ initializePerformanceTracking }) => {
      initializePerformanceTracking();
    });
    import("./lib/seo-tracker").then(({ initializeSEOTracking }) => {
      initializeSEOTracking();
    });
  });
} else {
  setTimeout(() => {
    import("./lib/performance-metrics").then(({ initializePerformanceTracking }) => {
      initializePerformanceTracking();
    });
    import("./lib/seo-tracker").then(({ initializeSEOTracking }) => {
      initializeSEOTracking();
    });
  }, 1000);
}
