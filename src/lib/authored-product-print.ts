/** Keep closed product details available in paged output without changing the screen's open state. */
export const PRODUCT_PRINT_CSS = `
@media print {
  :root {
    color-scheme: light;
    --bg: white; --surface: white; --ink: black; --muted: #333;
    --surface-ink: black; --surface-muted: #333; --link: black;
  }
  .skip, .site-nav, .footer-link, .closing, .action-arrow,
  .hero-actions:has(.action[href="#details"]), .visual:has(.original-art) { display: none; }
  .product .hero, .product .details-section { padding-block: 1rem; }
  .product .details-section { display: block; }
  .product .section-heading { margin-block-end: 1rem; break-after: avoid; }
  .product .hero .visual { max-inline-size: 30rem; margin-block: 1rem; margin-inline: auto; }
  .product .hero-actions { margin-block-start: .75rem; }
  .product .action { min-block-size: 0; padding: 0; border: 0; color: black; background: none; text-decoration: underline; }
  .feature-disclosure::details-content { display: block; content-visibility: visible; }
  .feature-disclosure summary, .feature-static-heading { padding-block: .6rem; break-after: avoid; }
  .feature-disclosure summary::after, .feature-disclosure[open] summary::after { content: none; }
  .feature-disclosure .feature-body { padding: 0 0 .8rem; orphans: 2; widows: 2; }
  .product .quote-section { margin-block: 1rem; padding: 1rem; }
}
`;
