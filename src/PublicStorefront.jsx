import { useMemo, useState } from "react";
import {
    ArrowRight,
    Check,
    ChevronDown,
    Download,
    ExternalLink,
    FileText,
    LockKeyhole,
    ShieldCheck,
    ShoppingBag,
    Sparkles,
} from "lucide-react";

import ThemeScene from "./ThemeScene";
import { validateCheckoutUrl } from "./checkoutSecurity";
import {
    storeFaq,
    storeProducts,
    storeSettings,
} from "./storeProducts";

const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
});

function recordCheckoutClick(productId) {
    try {
        const key = "twinpath-store-clicks";
        const existing = JSON.parse(
            localStorage.getItem(key) || "{}"
        );

        existing[productId] =
            Number(existing[productId] || 0) + 1;

        localStorage.setItem(key, JSON.stringify(existing));
    } catch {
        // Analytics must never block checkout.
    }
}

function ProductCard({ product }) {
    const checkout = validateCheckoutUrl(product.checkoutUrl);

    return (
        <article
            className={`store-product-card ${product.featured ? "featured" : ""
                }`}
            style={{ "--product-accent": product.accent }}
        >
            {product.featured && (
                <div className="store-featured-label">
                    <Sparkles size={14} />
                    Best value
                </div>
            )}

            <div className="store-product-icon">
                <FileText size={24} />
            </div>

            <span className="store-category">{product.category}</span>
            <h3>{product.title}</h3>
            <p>{product.description}</p>

            <ul className="store-benefits">
                {product.benefits.map((benefit) => (
                    <li key={benefit}>
                        <Check size={16} />
                        <span>{benefit}</span>
                    </li>
                ))}
            </ul>

            <div className="store-product-meta">
                <span>
                    <Download size={15} />
                    {product.format}
                </span>

                <span>
                    <LockKeyhole size={15} />
                    Hosted checkout
                </span>
            </div>

            <div className="store-product-footer">
                <div className="store-price">
                    {product.originalPrice && (
                        <del>{currency.format(product.originalPrice)}</del>
                    )}

                    <strong>{currency.format(product.price)}</strong>
                </div>

                {checkout.valid ? (
                    <a
                        className="button primary"
                        href={checkout.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => recordCheckoutClick(product.id)}
                    >
                        Get it
                        <ExternalLink size={16} />
                    </a>
                ) : (
                    <button
                        className="button secondary"
                        type="button"
                        disabled
                        title={checkout.reason}
                    >
                        Unavailable
                    </button>
                )}
            </div>

            <small className="store-delivery">{product.delivery}</small>
        </article>
    );
}

function FaqItem({ item }) {
    const [open, setOpen] = useState(false);

    return (
        <article className={`store-faq-item ${open ? "open" : ""}`}>
            <button type="button" onClick={() => setOpen((value) => !value)}>
                <span>{item.question}</span>
                <ChevronDown size={18} />
            </button>

            {open && <p>{item.answer}</p>}
        </article>
    );
}

export default function PublicStorefront() {
    const [category, setCategory] = useState("All");

    const categories = useMemo(
        () => [
            "All",
            ...new Set(storeProducts.map((product) => product.category)),
        ],
        []
    );

    const products =
        category === "All"
            ? storeProducts
            : storeProducts.filter(
                (product) => product.category === category
            );

    function scrollToProducts() {
        document
            .getElementById("products")
            ?.scrollIntoView({ behavior: "smooth" });
    }

    return (
        <main className="public-store">
            <ThemeScene themeKey="cyber" reducedMotion />

            <div className="store-layer">
                <header className="store-header">
                    <a className="store-logo" href="/shop">
                        <span>
                            <Sparkles size={19} />
                        </span>
                        TwinPath Studio
                    </a>

                    <nav>
                        <button type="button" onClick={scrollToProducts}>
                            Products
                        </button>

                        <a href="#faq">FAQ</a>

                        <a className="store-private-link" href="/">
                            Private app
                        </a>
                    </nav>
                </header>

                <section className="store-hero">
                    <div className="store-hero-copy">
                        <span className="store-kicker">
                            ORIGINAL DIGITAL TOOLS
                        </span>

                        <h1>
                            Practical systems for a safer and more organized digital life.
                        </h1>

                        <p>
                            Downloadable checklists and templates for students,
                            individuals and small organizations. Built for practical use,
                            not empty promises.
                        </p>

                        <div className="store-hero-actions">
                            <button
                                className="button primary"
                                type="button"
                                onClick={scrollToProducts}
                            >
                                Browse products
                                <ArrowRight size={17} />
                            </button>

                            <a className="button secondary" href="#standards">
                                Product standards
                            </a>
                        </div>

                        <div className="store-trust-row">
                            <span>
                                <ShieldCheck size={16} />
                                Hosted payment
                            </span>

                            <span>
                                <Download size={16} />
                                Digital delivery
                            </span>

                            <span>
                                <LockKeyhole size={16} />
                                No card storage here
                            </span>
                        </div>
                    </div>

                    <div className="store-visual" aria-hidden="true">
                        <div className="store-orbit orbit-one" />
                        <div className="store-orbit orbit-two" />

                        <div className="store-floating-card card-one">
                            <ShieldCheck size={22} />
                            <span>Security</span>
                        </div>

                        <div className="store-floating-card card-two">
                            <FileText size={22} />
                            <span>Templates</span>
                        </div>

                        <div className="store-floating-card card-three">
                            <ShoppingBag size={22} />
                            <span>Instant access</span>
                        </div>
                    </div>
                </section>

                <section className="store-section" id="products">
                    <div className="store-section-heading">
                        <div>
                            <span className="store-kicker">THE LIBRARY</span>
                            <h2>Choose a useful starting point</h2>
                            <p>
                                Start with one product, measure real demand and improve what
                                customers actually value.
                            </p>
                        </div>
                    </div>

                    <div className="store-filter-row">
                        {categories.map((item) => (
                            <button
                                key={item}
                                type="button"
                                className={category === item ? "active" : ""}
                                onClick={() => setCategory(item)}
                            >
                                {item}
                            </button>
                        ))}
                    </div>

                    <div className="store-product-grid">
                        {products.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </section>

                <section className="store-standards" id="standards">
                    <div>
                        <span className="store-kicker">PRODUCT STANDARDS</span>
                        <h2>Useful, original and honest</h2>
                    </div>

                    <div className="store-standard-grid">
                        <article>
                            <ShieldCheck />
                            <h3>Original material</h3>
                            <p>
                                Products must be created or lawfully licensed by the seller.
                            </p>
                        </article>

                        <article>
                            <FileText />
                            <h3>Clear purpose</h3>
                            <p>
                                Every product explains what it includes and what it cannot
                                guarantee.
                            </p>
                        </article>

                        <article>
                            <LockKeyhole />
                            <h3>Hosted payments</h3>
                            <p>
                                Payment details are handled by the checkout provider, not
                                stored by TwinPath.
                            </p>
                        </article>
                    </div>
                </section>

                <section className="store-section" id="faq">
                    <div className="store-section-heading">
                        <div>
                            <span className="store-kicker">QUESTIONS</span>
                            <h2>Frequently asked questions</h2>
                        </div>
                    </div>

                    <div className="store-faq-list">
                        {storeFaq.map((item) => (
                            <FaqItem key={item.question} item={item} />
                        ))}
                    </div>
                </section>

                <footer className="store-footer">
                    <div>
                        <strong>TwinPath Studio</strong>
                        <p>Original digital organization and security tools.</p>
                    </div>

                    <div>
                        <a href="#products">Products</a>
                        <a href="#faq">FAQ</a>
                        <a href="/shop/privacy">Privacy</a>
                        <a href="/shop/terms">Terms</a>
                        <a href="/shop/refunds">Refunds</a>
                        <a href={`mailto:${storeSettings.supportEmail}`}>
                            Customer support
                        </a>
                        <a href="/">Private app</a>
                    </div>

                    <small>
                        Educational materials only. No income, employment, certification
                        or security result is guaranteed.
                    </small>
                </footer>
            </div>
        </main>
    );
}
