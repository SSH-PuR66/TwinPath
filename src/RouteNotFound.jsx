import { ArrowLeft, ShoppingBag, Sparkles } from "lucide-react";

import ThemeScene from "./ThemeScene";

export default function RouteNotFound() {
  return (
    <main className="route-not-found">
      <ThemeScene themeKey="aurora" />

      <section className="route-not-found-card">
        <div className="brand-mark" aria-hidden="true">
          <Sparkles size={26} />
        </div>
        <span className="store-category">404 · Route not found</span>
        <h1>This path does not lead anywhere yet.</h1>
        <p>
          Return to your private TwinPath workspace or browse the public
          TwinPath Studio library.
        </p>

        <div className="route-not-found-actions">
          <a className="button primary" href="/">
            <ArrowLeft size={17} />
            Private app
          </a>
          <a className="button secondary" href="/shop">
            <ShoppingBag size={17} />
            Browse products
          </a>
        </div>
      </section>
    </main>
  );
}
