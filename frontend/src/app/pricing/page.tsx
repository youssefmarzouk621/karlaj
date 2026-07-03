import Link from "next/link";

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "Try it out with small mosaics",
    features: [
      "Up to 32 x 32 studs",
      "PDF instruction booklet",
      "Full parts list",
      "3 mosaics per month",
    ],
    cta: "Get started",
    href: "/create",
    accent: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "/mo",
    description: "For serious builders and gifters",
    features: [
      "Up to 96 x 96 studs",
      "PDF instruction booklet",
      "Unlimited mosaics",
      "Priority processing",
      "High-res PDF export",
    ],
    cta: "Start free trial",
    href: "/create",
    accent: true,
  },
  {
    name: "Studio",
    price: "$39",
    period: "/mo",
    description: "For businesses and creators",
    features: [
      "Everything in Pro",
      "Custom color palettes",
      "API access",
      "Bulk generation",
      "White-label PDF branding",
      "Priority support",
    ],
    cta: "Contact us",
    href: "/create",
    accent: false,
  },
];

export default function PricingPage() {
  return (
    <main className="flex-1 px-6 md:px-12 py-20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-accent font-semibold text-sm tracking-widest uppercase mb-3">
            Pricing
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            Simple, transparent pricing
          </h1>
          <p className="text-muted mt-4 text-lg max-w-md mx-auto">
            Start for free. Upgrade when you need bigger mosaics or unlimited
            builds.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 border flex flex-col ${
                plan.accent
                  ? "border-accent bg-accent/5"
                  : "border-border-custom bg-surface"
              }`}
            >
              {plan.accent && (
                <span className="text-accent text-xs font-bold uppercase tracking-widest mb-4">
                  Most popular
                </span>
              )}
              <h2 className="text-xl font-bold">{plan.name}</h2>
              <p className="text-muted text-sm mt-1">{plan.description}</p>

              <div className="mt-6 mb-6">
                <span className="text-4xl font-black">{plan.price}</span>
                {plan.period && (
                  <span className="text-muted text-sm">{plan.period}</span>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <svg
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        plan.accent ? "text-accent" : "text-muted"
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-muted">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`block text-center py-3 rounded-lg font-medium text-sm transition-colors ${
                  plan.accent
                    ? "bg-accent hover:bg-accent-hover text-white"
                    : "bg-surface border border-border-custom hover:border-muted text-text"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
