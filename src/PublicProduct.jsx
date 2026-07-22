import {
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import ThemeScene from "./ThemeScene";
import { safeCheckoutUrl } from "./safeUrl";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function PublicProduct({ product }) {
  const checkoutUrl = !product.checkoutUrl?.includes("YOUR_")
    ? safeCheckoutUrl(product.checkoutUrl)
    : null;

  return (
    <main className="public-store public-product-page">
      <ThemeScene themeKey="cyber" />

      <div className="store-layer">
        <header className="store-header">
          <a className="store-logo" href="/shop">
            <span>
              <Sparkles size={19} />
            </span>
            TwinPath Studio
          </a>

          <nav aria-label="Product navigation">
            <a href="/shop">All products</a>
            <a className="store-private-link" href="/">
              Private app
            </a>
          </nav>
        </header>

        <article
          className="product-detail"
          style={{ "--product-accent": product.accent }}
        >
          <div className="product-detail-copy">
            <a className="product-back-link" href="/shop#products">
              <ArrowLeft size={16} />
              Back to products
            </a>

            <span className="store-category">{product.category}</span>
            <h1>{product.title}</h1>
            <p className="product-detail-description">{product.description}</p>

            <ul className="store-benefits product-detail-benefits">
              {product.benefits.map((benefit) => (
                <li key={benefit}>
                  <Check size={17} />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside className="product-purchase-card" aria-label="Purchase details">
            <div className="product-detail-icon" aria-hidden="true">
              <FileText size={28} />
            </div>

            <div className="store-price product-detail-price">
              {product.originalPrice && (
                <del>{currency.format(product.originalPrice)}</del>
              )}
              <strong>{currency.format(product.price)}</strong>
            </div>

            <div className="product-purchase-meta">
              <span>
                <Download size={16} />
                {product.format}
              </span>
              <span>
                <ShieldCheck size={16} />
                {product.delivery}
              </span>
              <span>
                <LockKeyhole size={16} />
                Secure hosted checkout
              </span>
            </div>

            {checkoutUrl ? (
              <a
                className="button primary product-checkout-button"
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get {product.shortTitle}
                <ExternalLink size={17} />
              </a>
            ) : (
              <button
                className="button secondary product-checkout-button"
                type="button"
                disabled
              >
                Coming soon
              </button>
            )}

            <small>
              Payment details and file delivery are handled by the listed
              checkout provider. TwinPath does not store card data.
            </small>
          </aside>
        </article>

        <footer className="store-footer product-footer">
          <div>
            <strong>TwinPath Studio</strong>
            <p>Original digital organization and security tools.</p>
          </div>
          <div>
            <a href="/shop/privacy">Privacy</a>
            <a href="/shop/terms">Terms</a>
            <a href="/shop/refunds">Refunds</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
