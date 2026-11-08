import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { JsonLd } from '@/components/json-ld';
import { LandingChatBubble } from '@/components/landing/landing-chat-bubble';
import { LandingCta } from '@/components/landing/landing-cta';
import { LandingFooter } from '@/components/landing/landing-footer';
import { ArrowRightIcon, DocumentIcon } from '@/components/landing/landing-icons';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingPageHero } from '@/components/landing/landing-page-hero';
import { authOptions } from '@/lib/auth';
import { breadcrumbJsonLd, faqJsonLd, pageMetadata } from '@/lib/seo/site';
import { getSolution, SOLUTIONS } from '@/lib/seo/solutions';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) return {};
  return pageMetadata({
    path: `/solutions/${solution.slug}`,
    title: solution.title,
    description: solution.description,
    keywords: solution.keywords,
  });
}

export default async function SolutionPage({ params }: PageProps) {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) notFound();

  const session = await getServerSession(authOptions);
  const isAuthenticated = Boolean(session?.user);
  const primaryHref = isAuthenticated ? '/forms' : '/signup';
  const related = solution.related
    .map((s) => getSolution(s))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <div className="landing">
      <JsonLd data={faqJsonLd(solution.faqs)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Clickforms', path: '/' },
          { name: solution.name, path: `/solutions/${solution.slug}` },
        ])}
      />
      <LandingNav isAuthenticated={isAuthenticated} />

      <LandingPageHero eyebrow={solution.eyebrow} title={solution.h1} lead={solution.lead} />

      <section className="landing-form-types">
        <div className="landing-container">
          <div className="landing-section-head landing-section-head--center">
            <h2>{solution.sectionTitle}</h2>
            <p className="landing-section-lead">{solution.sectionLead}</p>
          </div>

          <div className="landing-form-types-grid">
            {solution.features.map((feature) => (
              <article key={feature.title} className="landing-form-type">
                <span className="landing-form-type-icon">
                  <DocumentIcon />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>

          <div className="landing-form-types-more-wrap">
            <p className="landing-form-types-more">
              <span>Free plan available. No credit card required.</span>
              <Link href={primaryHref}>
                {isAuthenticated ? 'Open your workspace' : 'Start building'}
                <ArrowRightIcon />
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="landing-form-types">
        <div className="landing-container">
          <div className="landing-section-head landing-section-head--center">
            <h2>How it works</h2>
          </div>
          <div className="landing-form-types-grid">
            {solution.steps.map((step, index) => (
              <article key={step.title} className="landing-form-type">
                <h3>
                  {index + 1}. {step.title}
                </h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-form-types">
        <div className="landing-container">
          <div className="landing-section-head landing-section-head--center">
            <h2>Frequently asked questions</h2>
          </div>
          <div className="landing-form-types-grid">
            {solution.faqs.map((faq) => (
              <article key={faq.q} className="landing-form-type">
                <h3>{faq.q}</h3>
                <p>{faq.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-form-types">
        <div className="landing-container">
          <div className="landing-section-head landing-section-head--center">
            <h2>Related</h2>
          </div>
          <div className="landing-form-types-grid">
            {related.map((item) => (
              <article key={item.slug} className="landing-form-type">
                <h3>
                  <Link href={`/solutions/${item.slug}`}>{item.name}</Link>
                </h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <LandingCta isAuthenticated={isAuthenticated} />
      <LandingFooter />
      <LandingChatBubble />
    </div>
  );
}
