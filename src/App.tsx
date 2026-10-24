import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import Layout from './components/Layout';
import TrustStrip from './components/TrustStrip';
import PartnerStrip from './components/PartnerStrip';
import { ThemeProvider } from './context/ThemeContext';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { LazyRoute } from './components/LazyRoute';
import { RouteLoading } from './components/RouteLoading';
import { usePageSeo } from './utils/seo';
import { changeLocale, type Locale } from './i18n';

// Lazy load below-the-fold homepage components
const StealthAnimation = lazy(() => import('./components/StealthAnimation'));
const Architecture = lazy(() => import('./components/Architecture'));
const ForDevelopers = lazy(() => import('./components/ForDevelopers'));
const Chains = lazy(() => import('./components/Chains'));
const StellarMetrics = lazy(() => import('./components/StellarMetrics'));
const Compare = lazy(() => import('./components/Compare'));
const Showcase = lazy(() => import('./components/Showcase'));
const CaseStudiesStrip = lazy(() => import('./components/CaseStudiesStrip'));
const EcosystemPartners = lazy(() => import('./components/EcosystemPartners'));
const CtaStrip = lazy(() => import('./components/CtaStrip'));
const Footer = lazy(() => import('./components/Footer'));

// Lazy load pages
const loadFaq = () => import('./pages/Faq');
const loadPrivacy = () => import('./pages/Privacy');
const loadNewsletter = () => import('./pages/Newsletter');
const loadUseCases = () => import('./pages/UseCases');
const loadCostCalculatorPage = () => import('./pages/CostCalculatorPage');
const loadStellar = () => import('./pages/Stellar');
const loadRoadmap = () => import('./pages/Roadmap');
const loadGrants = () => import('./pages/Grants');
const loadCaseStudies = () => import('./pages/CaseStudies');
const loadCareers = () => import('./pages/Careers');
const loadAbout = () => import('./pages/About');
const loadGovernance = () => import('./pages/Governance');
const loadVitals = () => import('./pages/Vitals');
const loadSecurity = () => import('./pages/Security');
const loadThreatModel = () => import('./pages/ThreatModel');
const loadStatus = () => import('./pages/Status');
const loadNotFound = () => import('./pages/NotFound');
const loadContributors = () => import('./pages/Contributors');
const loadBlog = () => import('./pages/Blog');
const loadEcosystem = () => import('./pages/Ecosystem');
const loadChainsPage = () => import('./pages/Chains');

/**
 * Sets the active locale based on the URL prefix, then renders `children`.
 * Used by locale-prefixed routes like /es/* and /pt/*.
 */
function LocaleScope({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  useEffect(() => {
    changeLocale(locale);
  }, [locale]);
  return <>{children}</>;
}

/**
 * Synchronises the i18n language with the URL.
 * When the user navigates to an unprefixed (English) route — i.e. a path that
 * does NOT start with /es or /pt — the locale is reset to English so that the
 * language state never lingers from a previous non-English visit.
 */
function LocaleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    const isLocalePrefixed = pathname.startsWith('/es') || pathname.startsWith('/pt');
    if (!isLocalePrefixed) {
      changeLocale('en');
    }
    // locale-prefixed routes are handled by LocaleScope; no action needed here.
  }, [pathname]);
  return null;
}

function Home() {
  const seo = usePageSeo('home');

  return (
    <div className="bg-surface text-on-surface">
      <Helmet>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <link rel="canonical" href={seo.canonical} />
        {seo.alternates.map((alt) => (
          <link key={alt.hrefLang} rel="alternate" hrefLang={alt.hrefLang} href={alt.href} />
        ))}
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        <meta property="og:url" content={seo.canonical} />
      </Helmet>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <TrustStrip />
        <Features />
        <Suspense fallback={null}>
          <StealthAnimation />
          <Architecture />
          <ForDevelopers />
          <Chains />
          <StellarMetrics />
          <Compare />
          <Showcase />
          <CaseStudiesStrip />
          <EcosystemPartners />
          <CtaStrip />
        </Suspense>
        <PartnerStrip />
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <LocaleSync />
        <RouteErrorBoundary>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/faq" element={<LazyRoute loader={loadFaq} />} />
              <Route path="/privacy" element={<LazyRoute loader={loadPrivacy} />} />
              <Route path="/newsletter" element={<LazyRoute loader={loadNewsletter} />} />
              <Route path="/use-cases" element={<LazyRoute loader={loadUseCases} />} />
              <Route
                path="/use-cases/calculator"
                element={<LazyRoute loader={loadCostCalculatorPage} />}
              />
              <Route path="/roadmap" element={<LazyRoute loader={loadRoadmap} />} />
              <Route path="/case-studies" element={<LazyRoute loader={loadCaseStudies} />} />
              <Route path="/case-studies/:slug" element={<LazyRoute loader={loadCaseStudies} />} />
              <Route
                path="/ecosystem"
                element={
                  <Layout>
                    <LazyRoute loader={loadEcosystem} />
                  </Layout>
                }
              />
              <Route path="/vitals" element={<LazyRoute loader={loadVitals} />} />
              <Route
                path="/security"
                element={
                  <Layout>
                    <LazyRoute loader={loadSecurity} />
                  </Layout>
                }
              />
              <Route
                path="/threat-model"
                element={
                  <Layout>
                    <LazyRoute loader={loadThreatModel} />
                  </Layout>
                }
              />
              {/* Status page route */}
              <Route
                path="/status"
                element={
                  <Layout>
                    <LazyRoute loader={loadStatus} />
                  </Layout>
                }
              />
              {/* Wrap Stellar with Layout */}
              <Route
                path="/stellar"
                element={
                  <Layout>
                    <LazyRoute loader={loadStellar} />
                  </Layout>
                }
              />
              <Route
                path="/careers"
                element={
                  <Layout>
                    <LazyRoute loader={loadCareers} />
                  </Layout>
                }
              />
              <Route
                path="/grants"
                element={
                  <Layout>
                    <LazyRoute loader={loadGrants} />
                  </Layout>
                }
              />
              <Route
                path="/about"
                element={
                  <Layout>
                    <LazyRoute loader={loadAbout} />
                  </Layout>
                }
              />
              <Route
                path="/governance"
                element={
                  <Layout>
                    <LazyRoute loader={loadGovernance} />
                  </Layout>
                }
              />
              <Route
                path="/contributors"
                element={
                  <Layout>
                    <LazyRoute loader={loadContributors} />
                  </Layout>
                }
              />
              <Route
                path="/blog"
                element={
                  <Layout>
                    <LazyRoute loader={loadBlog} />
                  </Layout>
                }
              />
              <Route
                path="/blog/tag/:tagSlug"
                element={
                  <Layout>
                    <LazyRoute loader={loadBlog} />
                  </Layout>
                }
              />
              <Route
                path="/blog/:slug"
                element={
                  <Layout>
                    <LazyRoute loader={loadBlog} />
                  </Layout>
                }
              />
              <Route
                path="/blog/author/:authorId"
                element={
                  <Layout>
                    <LazyRoute loader={loadBlog} />
                  </Layout>
                }
              />
              <Route
                path="/chains"
                element={
                  <Layout>
                    <LazyRoute loader={loadChainsPage} />
                  </Layout>
                }
              />
              <Route path="*" element={<LazyRoute loader={loadNotFound} />} />

              {/* ── Locale-prefixed routes (/es/*, /pt/*) ────────────────────
                These are the distinct, crawlable URLs referenced by hreflang
                alternates. Each route activates the matching locale then
                renders the same page component as its English counterpart.    */}
              {(['es', 'pt'] as const).map((locale) => (
                <>
                  <Route
                    key={`${locale}-home`}
                    path={`/${locale}`}
                    element={
                      <LocaleScope locale={locale}>
                        <Home />
                      </LocaleScope>
                    }
                  />
                  <Route
                    key={`${locale}-stellar`}
                    path={`/${locale}/stellar`}
                    element={
                      <LocaleScope locale={locale}>
                        <Layout>
                          <LazyRoute loader={loadStellar} />
                        </Layout>
                      </LocaleScope>
                    }
                  />
                  <Route
                    key={`${locale}-grants`}
                    path={`/${locale}/grants`}
                    element={
                      <LocaleScope locale={locale}>
                        <Layout>
                          <LazyRoute loader={loadGrants} />
                        </Layout>
                      </LocaleScope>
                    }
                  />
                  <Route
                    key={`${locale}-blog`}
                    path={`/${locale}/blog`}
                    element={
                      <LocaleScope locale={locale}>
                        <Layout>
                          <LazyRoute loader={loadBlog} />
                        </Layout>
                      </LocaleScope>
                    }
                  />
                  <Route
                    key={`${locale}-blog-slug`}
                    path={`/${locale}/blog/:slug`}
                    element={
                      <LocaleScope locale={locale}>
                        <Layout>
                          <LazyRoute loader={loadBlog} />
                        </Layout>
                      </LocaleScope>
                    }
                  />
                  <Route
                    key={`${locale}-blog-author`}
                    path={`/${locale}/blog/author/:authorId`}
                    element={
                      <LocaleScope locale={locale}>
                        <Layout>
                          <LazyRoute loader={loadBlog} />
                        </Layout>
                      </LocaleScope>
                    }
                  />
                  <Route
                    key={`${locale}-blog-tag`}
                    path={`/${locale}/blog/tag/:tagSlug`}
                    element={
                      <LocaleScope locale={locale}>
                        <Layout>
                          <LazyRoute loader={loadBlog} />
                        </Layout>
                      </LocaleScope>
                    }
                  />
                  <Route
                    key={`${locale}-case-studies`}
                    path={`/${locale}/case-studies`}
                    element={
                      <LocaleScope locale={locale}>
                        <LazyRoute loader={loadCaseStudies} />
                      </LocaleScope>
                    }
                  />
                  <Route
                    key={`${locale}-case-studies-slug`}
                    path={`/${locale}/case-studies/:slug`}
                    element={
                      <LocaleScope locale={locale}>
                        <LazyRoute loader={loadCaseStudies} />
                      </LocaleScope>
                    }
                  />
                </>
              ))}
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  );
}
