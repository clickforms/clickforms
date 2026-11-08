'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import '@/components/landing/landing-nav.css';
import { BrandMark } from '@/components/brand-mark';
import { NavCaretIcon, SendIcon } from '@/components/landing/landing-icons';

const PRODUCT_SUBLINKS = [
  { label: 'Services', href: '/product/services' },
  { label: 'How it works', href: '/product/how-it-works' },
] as const;

const NAV_LINKS = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Resources', href: '/resources' },
  { label: 'Contact', href: '/contact' },
  { label: 'Help', href: '/help' },
] as const;

export function LandingNav({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const [productOpen, setProductOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const primaryHref = isAuthenticated ? '/forms' : '/login';

  useEffect(() => {
    if (!productOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setProductOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setProductOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [productOpen]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the mobile menu whenever the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const isProductActive = pathname?.startsWith('/product') ?? false;

  return (
    <header className="landing-nav">
      <div className="landing-nav-inner">
        <Link href="/" className="landing-brand">
          <BrandMark id="nav" size={36} />
          <span className="landing-brand-wordmark">
            <span>Click</span>
            <span className="landing-brand-wordmark-forms">forms</span>
          </span>
        </Link>

        <nav className="landing-nav-links" aria-label="Primary">
          <div className="landing-nav-dropdown" ref={wrapperRef}>
            <button
              type="button"
              className="landing-nav-link landing-nav-link--btn"
              aria-expanded={productOpen}
              aria-haspopup="true"
              data-active={isProductActive || undefined}
              onClick={() => setProductOpen((value) => !value)}
            >
              Product
              <NavCaretIcon />
            </button>
            {productOpen ? (
              <div className="landing-nav-dropdown-panel" role="menu">
                {PRODUCT_SUBLINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="landing-nav-dropdown-item"
                    role="menuitem"
                    onClick={() => setProductOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="landing-nav-link"
              data-active={pathname === item.href || undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="landing-nav-actions">
          {isAuthenticated ? (
            <Link className="landing-btn landing-btn--cta landing-btn--sm" href="/forms">
              <SendIcon />
              Go to portal
            </Link>
          ) : (
            <>
              <Link
                className="landing-btn landing-btn--outline landing-btn--sm landing-nav-signup"
                href="/signup"
              >
                Sign up
              </Link>
              <Link className="landing-btn landing-btn--cta landing-btn--sm" href={primaryHref}>
                <SendIcon />
                Get started
              </Link>
            </>
          )}
          <button
            type="button"
            className="landing-nav-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span className="landing-nav-toggle-bars" aria-hidden="true" />
          </button>
        </div>
      </div>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="landing-mobile-scrim"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setMenuOpen(false)}
          />
          <nav id="landing-mobile-menu" className="landing-mobile-menu" aria-label="Mobile">
            <p className="landing-mobile-group">Product</p>
            {PRODUCT_SUBLINKS.map((item) => (
              <Link key={item.href} href={item.href} className="landing-mobile-link">
                {item.label}
              </Link>
            ))}
            <div className="landing-mobile-divider" />
            {NAV_LINKS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="landing-mobile-link"
                data-active={pathname === item.href || undefined}
              >
                {item.label}
              </Link>
            ))}
            {isAuthenticated ? null : (
              <Link className="landing-btn landing-btn--outline landing-mobile-cta" href="/signup">
                Sign up
              </Link>
            )}
          </nav>
        </>
      ) : null}
    </header>
  );
}
