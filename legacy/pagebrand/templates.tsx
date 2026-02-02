import React, { useEffect, useState } from "react";

export default function BrandTemplates() {
  const [brand, setBrand] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Load brand analysis from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("brand:lastResult");
    if (stored) {
      setBrand(JSON.parse(stored));
    }
  }, []);

  async function generate(type: string) {
    if (!brand) return;

    setLoading(true);
    setTemplates([]);

    try {
      const r = await fetch("/api/brand/generateTemplates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          type
        })
      });

      const j = await r.json();
      setTemplates(j.templates || []);
    } catch (e) {
      console.error(e);
    }

    setLoading(false);
  }

  // Empty state
  if (!brand) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-bold">No brand data found</h1>
        <p className="text-gray-500 mt-2">
          Go back to Brand Analysis and analyze a website first.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          Templates for {brand.facts?.company_name || "your brand"}
        </h1>
        <p className="text-gray-500 mt-1">
          Auto-generated creatives using your brand, products, and positioning.
        </p>
      </div>

      {/* Products */}
      <section>
        <h2 className="font-semibold mb-4">Brand Assets Detected</h2>
        <div className="grid grid-cols-4 gap-4">
          {(
  brand.product_images?.length
    ? brand.product_images
    : [brand.logo].filter(Boolean)
).map((img: string, i: number) => (
            <div
              key={i}
              className="border rounded-lg overflow-hidden bg-white"
            >
              <img
                src={img}
                alt=""
                className="w-full h-40 object-cover"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Template Categories */}
      <section>
        <h2 className="font-semibold mb-4">Creative Templates</h2>

        <div className="grid grid-cols-3 gap-6">
          <TemplateCard title="Instagram Ads" onGenerate={generate} />
          <TemplateCard title="Facebook Ads" onGenerate={generate} />
          <TemplateCard title="Website Banners" onGenerate={generate} />
          <TemplateCard title="Email Headers" onGenerate={generate} />
          <TemplateCard title="WhatsApp Creatives" onGenerate={generate} />
          <TemplateCard title="Poster Designs" onGenerate={generate} />
        </div>
      </section>

      {/* Loading */}
      {loading && (
        <div className="text-sm text-gray-500">
          Generating templates…
        </div>
      )}

      {/* Generated Templates */}
      {templates.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">
            Generated Creatives
          </h2>

          <div className="grid grid-cols-3 gap-6">
            {templates.map((t, i) => (
              <div
                key={i}
                className="border rounded-lg overflow-hidden bg-white"
              >
                <img
                  src={t.image}
                  alt=""
                  className="w-full h-48 object-cover"
                />

                <div className="p-4 space-y-2">
                  <p className="font-semibold">{t.headline}</p>
                  <p className="text-sm text-gray-600">
                    {t.subheadline}
                  </p>

                  <button className="w-full bg-black text-white py-2 rounded-lg mt-2">
                    {t.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------------------- COMPONENTS ---------------------- */

function TemplateCard({
  title,
  onGenerate
}: {
  title: string;
  onGenerate: (type: string) => void;
}) {
  return (
    <div className="border rounded-lg p-6 bg-white hover:shadow cursor-pointer">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-gray-500 mt-2">
        Auto-generated using your brand assets
      </p>

      <button
        onClick={() => onGenerate(title)}
        className="mt-4 text-indigo-600 font-medium"
      >
        Generate →
      </button>
    </div>
  );
}
