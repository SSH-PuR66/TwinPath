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
import PwaControls from "./PwaControls";

import "./styles.css";
import "./feature-components.css";
// Last, so its scales win equal-specificity collisions with the two files above.
import "./design-system.css";
// Last of all: the token layer from the 2026-08-28 UI audit (type, surfaces, motion).
import "./tokens.css";

function RoutedApplication() {
  const route = resolveApplicationRoute(
    window.location.pathname,
    storeProducts.map((product) => product.id)
  );

  let page;
  switch (route.kind) {
    case "private-app":
      page = <App />;
      break;
    case "storefront":
      page = <PublicStorefront />;
      break;
    case "product": {
      const product = storeProducts.find((item) => item.id === route.productId);
      page = <PublicProduct product={product} />;
      break;
    }
    case "legal":
      page = <StoreLegal page={route.page} />;
      break;
    default:
      page = <RouteNotFound />;
  }

  return <>{page}<PwaControls /></>;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RoutedApplication />
    </ErrorBoundary>
  </React.StrictMode>
);
