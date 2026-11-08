// Keyword landing pages (/solutions/<slug>). Copy sticks to what Clickforms actually does:
// multi-page forms, 20+ field types, conditional logic, e-signatures, file uploads, approval
// workflows, audit trail, branding, PDF export, Australian hosting, free plan.

export interface Solution {
  slug: string;
  /** Short name used in nav/footer/internal links. */
  name: string;
  /** <title> — keep under ~60 chars. */
  title: string;
  /** Meta description — keep under ~160 chars. */
  description: string;
  keywords: string[];
  eyebrow: string;
  h1: string;
  lead: string;
  sectionTitle: string;
  sectionLead: string;
  features: { title: string; body: string }[];
  steps: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
  related: string[];
}

export const SOLUTIONS: Solution[] = [
  {
    slug: 'online-form-builder',
    name: 'Online form builder',
    title: 'Online Form Builder Australia | Clickforms',
    description:
      'Build professional online forms in minutes. Multi-page forms, conditional logic, e-signatures and file uploads. An Australian online form builder.',
    keywords: [
      'online form builder',
      'form builder',
      'form builder Australia',
      'create online forms',
    ],
    eyebrow: 'Online form builder',
    h1: 'The online form builder for forms that have to be right',
    lead: 'Design branded, multi-page forms with a drag-and-drop builder, collect structured responses and signatures, and keep every submission searchable, hosted and supported in Australia.',
    sectionTitle: 'Everything you need to build and run online forms',
    sectionLead:
      'Clickforms is a form builder for teams that collect detailed information, not just a contact box. Build and publish your first form today.',
    features: [
      {
        title: '20+ field types',
        body: 'Text, dates, dropdowns, tables, ratings, signatures, file uploads and more, all built in, no add-ons.',
      },
      {
        title: 'Conditional logic',
        body: 'Show or hide fields and whole sections based on earlier answers, so people only see what applies to them.',
      },
      {
        title: 'Multi-page forms',
        body: 'Break long forms into clear steps with as many pages as you need.',
      },
      {
        title: 'Your branding',
        body: 'Set your colours and logo once and every form you publish matches your organisation.',
      },
      {
        title: 'Structured responses',
        body: 'Every submission is stored as clean, searchable data and can be exported as a PDF.',
      },
      {
        title: 'Secure by design',
        body: 'Role-based access, email-code two-factor sign-in and a full audit trail.',
      },
    ],
    steps: [
      { title: 'Build', body: 'Add fields, pages and logic in the visual builder.' },
      {
        title: 'Publish',
        body: 'Share one link and your form is live on your own organisation subdomain.',
      },
      { title: 'Collect', body: 'Responses arrive complete, timestamped and ready to review.' },
    ],
    faqs: [
      {
        q: 'What is an online form builder?',
        a: 'An online form builder lets you create forms in your browser without writing code, then share them by link so people can complete them on any device. Clickforms also stores each response as structured data and supports signatures, uploads and approvals.',
      },
      {
        q: 'Is Clickforms free to try?',
        a: 'Yes. The Free plan has no time limit and needs no credit card. Paid plans are priced in Australian dollars.',
      },
      {
        q: 'Do I need technical skills to build a form?',
        a: 'No. Forms are built visually, including multi-page layouts and conditional logic, with no code.',
      },
      {
        q: 'Where is my data hosted?',
        a: 'Clickforms is hosted and supported from Australia.',
      },
    ],
    related: ['custom-forms', 'intake-forms', 'e-signature-forms'],
  },
  {
    slug: 'custom-forms',
    name: 'Custom forms',
    title: 'Custom Forms Builder: Create Your Own Forms | Clickforms',
    description:
      'Create custom forms that match your workflow and brand. Choose from 20+ field types, add conditional logic, signatures and approvals.',
    keywords: ['custom forms', 'custom form builder', 'create custom forms', 'build your own form'],
    eyebrow: 'Custom forms',
    h1: 'Create custom forms that fit your workflow, not the other way around',
    lead: 'Start from a blank canvas or a ready-made category, then shape every field, page and rule to match how your organisation actually works.',
    sectionTitle: 'Fully custom, without any code',
    sectionLead:
      'Generic form tools force you to bend your process around them. Clickforms gives you the building blocks to model the form you really need.',
    features: [
      {
        title: 'Start blank or from a template',
        body: 'Begin with a blank canvas or reuse a form you already built as a starting point.',
      },
      {
        title: 'Copy styling between forms',
        body: 'Apply the colours and logo from one form to another in one click.',
      },
      {
        title: 'Rules that adapt',
        body: 'Conditional logic reveals only the questions relevant to each respondent.',
      },
      {
        title: 'Custom text and colours',
        body: 'Control headings, labels, help text and colours so forms look like yours.',
      },
      {
        title: 'Prefilled forms by email',
        body: 'Fill in known answers yourself and email the form to a client to finish and submit.',
      },
      {
        title: 'Approvals and audit trail',
        body: 'Route forms through sign-off before they go live and see who changed what, and when.',
      },
    ],
    steps: [
      { title: 'Design', body: 'Lay out pages and fields exactly as you need them.' },
      { title: 'Refine', body: 'Add logic, branding and required fields.' },
      { title: 'Launch', body: 'Publish and share by link or email.' },
    ],
    faqs: [
      {
        q: 'Can I create fully custom forms?',
        a: 'Yes. You can build forms from scratch with 20+ field types, multiple pages, conditional logic and your own branding.',
      },
      {
        q: 'Can I reuse a form I have already built?',
        a: 'Yes. Forms can be reused as templates and styling can be copied from one form to another.',
      },
      {
        q: 'Can I send a form with some answers already filled in?',
        a: 'Yes. Fill in the answers you know, enter the recipient’s email, and they receive a personal link to review and complete the rest.',
      },
    ],
    related: ['online-form-builder', 'intake-forms', 'consent-forms'],
  },
  {
    slug: 'intake-forms',
    name: 'Intake forms',
    title: 'Online Client Intake Forms | Clickforms',
    description:
      'Collect client intake information online: demographics, referrals and consent in one guided form. Conditional logic, e-signatures and secure storage.',
    keywords: [
      'intake forms',
      'client intake form',
      'online intake form',
      'patient intake form',
      'new client form',
    ],
    eyebrow: 'Intake forms',
    h1: 'Client intake forms that arrive complete, not as scattered PDFs',
    lead: 'Capture demographics, referral details, supporting documents and consent in a single guided form, so new clients are fully onboarded before their first appointment.',
    sectionTitle: 'Online intake forms built for detail-heavy onboarding',
    sectionLead:
      'Replace paper packs and email attachments with one form that collects everything and validates it as people go.',
    features: [
      {
        title: 'Guided, multi-page',
        body: 'Walk clients through intake step by step on any device.',
      },
      {
        title: 'Only relevant questions',
        body: 'Conditional logic hides what doesn’t apply, reducing incomplete submissions.',
      },
      {
        title: 'Documents and signatures',
        body: 'Collect ID, referrals and signed consent in the same submission.',
      },
      {
        title: 'Prefill known details',
        body: 'Send a client a form with their details already filled in for them to confirm.',
      },
      {
        title: 'Searchable records',
        body: 'Find any intake by participant name, date or status in seconds.',
      },
      { title: 'Audit-ready', body: 'Every submission is timestamped and tracked.' },
    ],
    steps: [
      {
        title: 'Build your intake',
        body: 'Use fields for contact details, history, referrals and uploads.',
      },
      { title: 'Send the link', body: 'Share by link or email a prefilled version.' },
      { title: 'Review', body: 'Review, approve and export completed intakes.' },
    ],
    faqs: [
      {
        q: 'What is an intake form?',
        a: 'An intake form is the first form a new client, patient or participant completes. It gathers the personal, contact and background information a service needs to get started.',
      },
      {
        q: 'Can clients complete the intake on their phone?',
        a: 'Yes. Forms work on phones, tablets and desktops without an app.',
      },
      {
        q: 'Can clients upload documents?',
        a: 'Yes. File and image uploads are built-in field types.',
      },
    ],
    related: ['consent-forms', 'ndis-forms', 'custom-forms'],
  },
  {
    slug: 'consent-forms',
    name: 'Consent forms',
    title: 'Online Consent Forms with E-Signature | Clickforms',
    description:
      'Create and collect online consent forms with e-signatures. Branded, timestamped and easy to produce later. Built for Australian care and compliance teams.',
    keywords: [
      'consent forms',
      'online consent form',
      'digital consent form',
      'consent form with signature',
    ],
    eyebrow: 'Consent forms',
    h1: 'Online consent forms with e-signatures you can stand behind',
    lead: 'Collect informed consent digitally, branded to your organisation, recorded with a timestamp and ready to produce whenever you are asked for it.',
    sectionTitle: 'Digital consent without the paper trail',
    sectionLead:
      'Move consent off printed pages and inboxes into a form that records exactly what was agreed, by whom and when.',
    features: [
      {
        title: 'E-signature capture',
        body: 'Signatures are a built-in field, drawn on any device.',
      },
      {
        title: 'Clause-level logic',
        body: 'Show only the consent clauses that apply to each person.',
      },
      { title: 'Timestamped records', body: 'Every consent is stored with its submission time.' },
      { title: 'PDF export', body: 'Download completed consents as PDFs to file or share.' },
      { title: 'Approval workflow', body: 'Have consent wording approved before it goes live.' },
      { title: 'Audit trail', body: 'See who published which version, and when.' },
    ],
    steps: [
      { title: 'Write the consent', body: 'Add your wording and the signature field.' },
      { title: 'Get it approved', body: 'Route it through sign-off before publishing.' },
      { title: 'Collect and file', body: 'Receive signed consents and export them as PDFs.' },
    ],
    faqs: [
      {
        q: 'Can I collect consent with an electronic signature?',
        a: 'Yes. Clickforms includes a signature field so people can sign on a phone, tablet or computer, and the signed form is stored with the submission.',
      },
      {
        q: 'Can I export signed consent forms?',
        a: 'Yes. Completed submissions can be exported as PDFs.',
      },
      {
        q: 'Does Clickforms keep a record of changes to a form?',
        a: 'Yes. Each published version is tracked, and the audit trail shows who published what and when.',
      },
    ],
    related: ['e-signature-forms', 'intake-forms', 'service-agreement-forms'],
  },
  {
    slug: 'e-signature-forms',
    name: 'E-signature forms',
    title: 'E-Signature Forms: Collect Signatures Online | Clickforms',
    description:
      'Collect electronic signatures inside your online forms. Sign on any device, store with each submission and export to PDF.',
    keywords: [
      'e-signature forms',
      'electronic signature form',
      'online signature form',
      'sign forms online',
    ],
    eyebrow: 'E-signature forms',
    h1: 'E-signature forms: collect signatures online, inside the form',
    lead: 'No separate signing tool. Add a signature field to any form and collect signed submissions from any device.',
    sectionTitle: 'Signatures built into your forms',
    sectionLead:
      'Signing is part of the form, not an extra step, so the signature, the answers and the timestamp always stay together.',
    features: [
      { title: 'Sign on any device', body: 'Draw a signature with a finger, stylus or mouse.' },
      {
        title: 'Stored with the response',
        body: 'The signature is saved alongside the answers it belongs to.',
      },
      {
        title: 'Required where needed',
        body: 'Make a signature mandatory before a form can be submitted.',
      },
      { title: 'PDF export', body: 'Download signed submissions as PDFs.' },
      {
        title: 'Combine with uploads',
        body: 'Collect supporting documents in the same submission.',
      },
      { title: 'Audit trail', body: 'Know exactly when each form was submitted.' },
    ],
    steps: [
      { title: 'Add a signature field', body: 'Drop it anywhere in your form.' },
      { title: 'Share the link', body: 'Respondents complete and sign on their device.' },
      { title: 'Export', body: 'Download the signed submission as a PDF.' },
    ],
    faqs: [
      {
        q: 'How do I collect signatures on an online form?',
        a: 'Add a signature field in the Clickforms builder and share the form link. Respondents sign on screen and the signature is saved with their submission.',
      },
      {
        q: 'Do respondents need an account to sign?',
        a: 'No. Respondents open your link and complete the form without creating an account.',
      },
    ],
    related: ['consent-forms', 'service-agreement-forms', 'online-form-builder'],
  },
  {
    slug: 'service-agreement-forms',
    name: 'Service agreement forms',
    title: 'Online Service Agreement Forms | Clickforms',
    description:
      'Create service agreements clients can review, sign and attach documents to online. Multi-page forms, e-signatures and PDF export.',
    keywords: [
      'service agreement form',
      'online service agreement',
      'sign service agreement online',
      'client agreement form',
    ],
    eyebrow: 'Service agreements',
    h1: 'Service agreement forms clients can review and sign online',
    lead: 'Turn multi-page service agreements into a form that clients read, complete, sign and return from any device, no printing, no scanning.',
    sectionTitle: 'Agreements that get completed the first time',
    sectionLead:
      'Guided pages, required fields and built-in signatures mean fewer follow-ups and fewer incomplete agreements.',
    features: [
      { title: 'Multi-page agreements', body: 'Present terms in clear sections.' },
      { title: 'E-signature', body: 'Clients sign directly in the form.' },
      {
        title: 'Supporting documents',
        body: 'Let clients attach files as part of the agreement.',
      },
      { title: 'Branded', body: 'Your colours and logo on every agreement.' },
      {
        title: 'Prefilled by email',
        body: 'Send the agreement with client details already filled in.',
      },
      {
        title: 'Approval workflow',
        body: 'Review changes to your agreement before they go live.',
      },
    ],
    steps: [
      { title: 'Build the agreement', body: 'Lay out terms, fields and a signature.' },
      { title: 'Send to the client', body: 'Share a link or email a prefilled copy.' },
      { title: 'Receive it signed', body: 'Review the signed agreement and export a PDF.' },
    ],
    faqs: [
      {
        q: 'Can clients sign a service agreement online?',
        a: 'Yes. Add a signature field to your agreement form and clients can sign on screen from any device.',
      },
      {
        q: 'Can I send an agreement with the client’s details filled in?',
        a: 'Yes. Prefill the answers you know and email the client a personal link to confirm and sign.',
      },
    ],
    related: ['e-signature-forms', 'consent-forms', 'ndis-forms'],
  },
  {
    slug: 'ndis-forms',
    name: 'NDIS forms',
    title: 'NDIS Forms Online: Intake, Consent & Agreements | Clickforms',
    description:
      'Online forms for NDIS providers: participant intake, service agreements, consent and incident reports with e-signatures and audit trails. Australian-hosted.',
    keywords: [
      'NDIS forms',
      'NDIS service agreement',
      'NDIS intake form',
      'NDIS provider forms',
      'NDIS incident report form',
    ],
    eyebrow: 'NDIS forms',
    h1: 'NDIS forms online: intake, service agreements, consent and incident reports',
    lead: 'Give participants one clear place to complete paperwork, and give your team structured, signed, audit-ready records, hosted and supported in Australia.',
    sectionTitle: 'Built for providers who run a lot of forms',
    sectionLead:
      'NDIS providers handle intake, agreements, consent and reporting every day. Clickforms keeps all of it consistent, searchable and traceable.',
    features: [
      {
        title: 'Participant intake',
        body: 'Capture details, referrals and documents in one guided form.',
      },
      { title: 'Service agreements', body: 'Participants review and sign online.' },
      { title: 'Consent forms', body: 'Signed, timestamped consent you can produce on request.' },
      {
        title: 'Incident reports',
        body: 'Structured fields for consistent logging and follow-up.',
      },
      {
        title: 'Approval workflows',
        body: 'Sign-off before forms go live; every change is recorded.',
      },
      {
        title: 'Participant names in responses',
        body: 'See who submitted each form at a glance.',
      },
    ],
    steps: [
      {
        title: 'Choose your forms',
        body: 'Start from intake, agreement, consent or incident report.',
      },
      { title: 'Share with participants', body: 'Send a link or a prefilled copy by email.' },
      { title: 'Keep records tidy', body: 'Review, approve and export submissions.' },
    ],
    faqs: [
      {
        q: 'Can I use Clickforms for NDIS service agreements?',
        a: 'Yes. You can build a service agreement form with e-signature and document uploads, and participants complete it online. Clickforms is a forms tool and does not replace your own compliance obligations.',
      },
      {
        q: 'Is Clickforms hosted in Australia?',
        a: 'Yes. Clickforms is hosted and supported from Australia.',
      },
      {
        q: 'Can I keep a record of who changed a form?',
        a: 'Yes. The audit trail records who published which version and when.',
      },
    ],
    related: ['intake-forms', 'service-agreement-forms', 'consent-forms'],
  },
];

export function getSolution(slug: string): Solution | undefined {
  return SOLUTIONS.find((s) => s.slug === slug);
}
