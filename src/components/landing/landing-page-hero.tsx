export function LandingPageHero({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <section className="landing-page-hero">
      <div className="landing-page-hero-deco landing-page-hero-deco--a" aria-hidden="true" />
      <div className="landing-page-hero-deco landing-page-hero-deco--b" aria-hidden="true" />
      <div className="landing-container">
        <span className="landing-page-hero-eyebrow">{eyebrow}</span>
        <h1 className="landing-page-hero-title">{title}</h1>
        {lead ? <p className="landing-page-hero-lead">{lead}</p> : null}
      </div>
    </section>
  );
}
