import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import ErrorBoundary from "./ErrorBoundary";
import PublicStorefront from "./PublicStorefront";
import StoreLegal from "./StoreLegal";

import "./styles.css";
import "./feature-components.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}

const normalizedPath =
  window.location.pathname
    .replace(/\/+$/, "")
    .toLowerCase() || "/";

function RoutedApplication() {
  if (
    normalizedPath === "/shop" ||
    normalizedPath.startsWith("/shop/product/")
  ) {
    return <PublicStorefront />;
  }

  if (normalizedPath === "/shop/privacy") {
    return <StoreLegal page="privacy" />;
  }

  if (normalizedPath === "/shop/terms") {
    return <StoreLegal page="terms" />;
  }

  if (normalizedPath === "/shop/refunds") {
    return <StoreLegal page="refunds" />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RoutedApplication />
    </ErrorBoundary>
  </React.StrictMode>
);
