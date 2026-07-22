import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { resolveApplicationRoute } from "./appRoutes";
import ErrorBoundary from "./ErrorBoundary";
import PublicProduct from "./PublicProduct";
import PublicStorefront from "./PublicStorefront";
import RouteNotFound from "./RouteNotFound";
import StoreLegal from "./StoreLegal";
import { storeProducts } from "./storeProducts";

import "./styles.css";
import "./feature-components.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}

function RoutedApplication() {
  const route = resolveApplicationRoute(
    window.location.pathname,
    storeProducts.map((product) => product.id)
  );

  switch (route.kind) {
    case "private-app":
      return <App />;
    case "storefront":
      return <PublicStorefront />;
    case "product": {
      const product = storeProducts.find((item) => item.id === route.productId);
      return <PublicProduct product={product} />;
    }
    case "legal":
      return <StoreLegal page={route.page} />;
    default:
      return <RouteNotFound />;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RoutedApplication />
    </ErrorBoundary>
  </React.StrictMode>
);
