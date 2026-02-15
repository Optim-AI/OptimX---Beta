"use client";

import React, { useState } from "react";
import Header from "../app/web/src/components/Header";
import Footer from "../app/web/src/components/Footer";
import { Button } from "../app/web/src/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../app/web/src/components/ui/card";
import { Input } from "../app/web/src/components/ui/input";
import { Textarea } from "../app/web/src/components/ui/textarea";
import { Label } from "../app/web/src/components/ui/label";
import { toast } from "../app/web/src/hooks/use-toast";
import { Mail } from "lucide-react";
// import { supabase } from "@/integrations/supabase/client";
// react-helmet-async removed per your request

// *** Import your color tokens exactly as requested (path unchanged) ***
import colors from '@/lib/ui/colors';

/** tiny helper to add slash-style alpha to simple hsl(...) tokens */
const withAlpha = (token: string | undefined, alpha: number) => {
  if (!token) return token;
  // if already contains slash alpha, replace it
  if (/\s*\/\s*[\d.]+\)/.test(token)) {
    return token.replace(/\)\s*$/, ` / ${alpha})`);
  }
  if (token.startsWith("hsl(")) {
    return token.replace(/\)$/, ` / ${alpha})`);
  }
  return token;
};

/**
 * Metadata export — Next.js will use this when present in a server page/layout.
 * Keeping it here so the SEO data exists in the module (you can move it to a server wrapper if you prefer).
 */
export const metadata = {
  title: "Contact SkalX AI - AI Marketing Automation & Campaign Management",
  description:
    "Get in touch with SkalX AI for AI-powered marketing automation solutions. Contact our expert team for personalized marketing campaigns, SEO optimization, and business growth strategies.",
  keywords:
    "contact SkalX AI, AI marketing consultation, marketing automation support, campaign management contact, digital marketing help, business growth solutions, marketing strategy consultation",
  openGraph: {
    title: "Contact SkalX AI - AI Marketing Automation Expert Support",
    description:
      "Ready to transform your business with AI-powered marketing? Contact SkalX AI's expert team for personalized marketing automation solutions and campaign management.",
    type: "website",
    url: "https://optim.com/contact",
  },
  alternates: { canonical: "https://optim.com/contact" },
};

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    businessName: "",
    phoneNumber: "",
    message: "",
    email: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (
      !formData.name ||
      !formData.businessName ||
      !formData.phoneNumber ||
      !formData.message
    ) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // If you later uncomment supabase, this call will invoke your edge function
      // const { error } = await supabase.functions.invoke("send-contact-email", {
      //   body: {
      //     name: formData.name,
      //     businessName: formData.businessName,
      //     phoneNumber: formData.phoneNumber,
      //     message: formData.message,
      //     email: formData.email,
      //     type: "contact",
      //   },
      // });
      // if (error) throw error;

      // Mock success behavior for now (remove when supabase is enabled)
      toast({
        title: "Message Sent Successfully!",
        description:
          "Thank you for contacting us. We'll get back to you within 24 hours.",
      });

      setFormData({
        name: "",
        businessName: "",
        phoneNumber: "",
        message: "",
        email: "",
      });
    } catch (err) {
      console.error("Contact form error:", err);
      toast({
        title: "Error",
        description:
          "Failed to send message. Please try again or contact us directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: colors.background, color: colors.foreground }}
    >
      <Header />

      <main className="pt-20">
        {/* Hero Section */}
        <section
          className="py-20"
          style={{
            backgroundImage: `linear-gradient(135deg, ${withAlpha(
              colors.primary,
              0.05
            )} 0%, ${withAlpha(colors.accent, 0.1)} 100%)`,
          }}
        >
          <div className="container mx-auto px-4 text-center">
            <h1
              className="text-4xl md:text-5xl font-bold mb-6"
              style={{
                backgroundImage: colors.gradientPrimary ?? undefined,
                WebkitBackgroundClip: "text" as any,
                backgroundClip: "text" as any,
                color: "transparent",
                WebkitTextFillColor: "transparent",
              }}
            >
              Talk to Sales
            </h1>

            <p
              className="text-xl max-w-2xl mx-auto"
              style={{ color: colors.mutedForeground }}
            >
              Enterprise plans, custom integrations, or questions about scaling your marketing with SkalX AI? Our team will respond within 24 hours.
            </p>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Contact Form */}
              <Card
                className="shadow-medium"
                style={{
                  background: withAlpha(colors.card, 1),
                  border: `1px solid ${withAlpha(colors.border, 0.5)}`,
                }}
              >
                <CardHeader>
                  <CardTitle
                    className="text-2xl"
                    style={{ color: colors.foreground }}
                  >
                    Get in Touch
                  </CardTitle>
                  <CardDescription style={{ color: colors.mutedForeground }}>
                    Share your business needs and how SkalX AI can help you create, launch, and optimize ads without expanding headcount.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label
                        htmlFor="name"
                        style={{ color: colors.foreground }}
                      >
                        Name *
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        placeholder="Your full name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        style={{
                          background: colors.background,
                          color: colors.foreground,
                          borderColor: withAlpha(colors.input, 0.6),
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="businessName"
                        style={{ color: colors.foreground }}
                      >
                        Business Name *
                      </Label>
                      <Input
                        id="businessName"
                        name="businessName"
                        type="text"
                        placeholder="Your business name"
                        value={formData.businessName}
                        onChange={handleChange}
                        required
                        style={{
                          background: colors.background,
                          color: colors.foreground,
                          borderColor: withAlpha(colors.input, 0.6),
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="email"
                        style={{ color: colors.foreground }}
                      >
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="your.email@company.com (optional for acknowledgment)"
                        value={formData.email}
                        onChange={handleChange}
                        style={{
                          background: colors.background,
                          color: colors.foreground,
                          borderColor: withAlpha(colors.input, 0.6),
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="phoneNumber"
                        style={{ color: colors.foreground }}
                      >
                        Phone Number *
                      </Label>
                      <Input
                        id="phoneNumber"
                        name="phoneNumber"
                        type="tel"
                        placeholder="Your phone number"
                        value={formData.phoneNumber}
                        onChange={handleChange}
                        required
                        style={{
                          background: colors.background,
                          color: colors.foreground,
                          borderColor: withAlpha(colors.input, 0.6),
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="message"
                        style={{ color: colors.foreground }}
                      >
                        Message *
                      </Label>
                      <Textarea
                        id="message"
                        name="message"
                        placeholder="Tell us about your marketing challenges, current strategies, target audience, and how we can help optimize your campaigns..."
                        className="min-h-[120px]"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        style={{
                          background: colors.background,
                          color: colors.foreground,
                          borderColor: withAlpha(colors.input, 0.6),
                        }}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={isSubmitting}
                      style={{
                        background: colors.primary,
                        color: colors.primaryForeground,
                        boxShadow: colors.shadowGlow,
                        border: `1px solid ${withAlpha(colors.primary, 0.9)}`,
                      }}
                    >
                      {isSubmitting ? "Sending..." : "Send Message"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <div className="space-y-8">
                <div>
                  <h2
                    className="text-2xl font-bold mb-6"
                    style={{ color: colors.foreground }}
                  >
                  </h2>

                  <div className="space-y-6">
                    <div className="flex items-start space-x-4">
                      <Mail
                        className="h-6 w-6 mt-1"
                        style={{ color: colors.primary }}
                      />
                      <div>
                        <h3
                          className="font-semibold"
                          style={{ color: colors.foreground }}
                        >
                          Reachout to us
                        </h3>
                        <p style={{ color: colors.mutedForeground }}>
                          info@optim.app
                        </p>
                        <p style={{ color: colors.mutedForeground }}>
                          <a
                            href="tel:+919003815101"
                            style={{ color: colors.primary }}
                            className="hover:opacity-90 transition-opacity"
                          >
                            +91 9003815101
                          </a>
                        </p>
                        <p
                          className="text-sm"
                          style={{ color: colors.mutedForeground }}
                        >
                          Get personalized AI marketing strategies
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Card
                  style={{
                    background: `linear-gradient(135deg, ${withAlpha(
                      colors.primary,
                      0.05
                    )} 0%, ${withAlpha(colors.accent, 0.1)} 100%)`,
                    border: `1px solid ${withAlpha(colors.primary, 0.2)}`,
                  }}
                >
                  <CardContent className="p-6">
                    <h3
                      className="font-semibold mb-2"
                      style={{ color: colors.foreground }}
                    >
                      Marketing Optimization Benefits
                    </h3>
                    <div
                      className="space-y-2 text-sm"
                      style={{ color: colors.mutedForeground }}
                    >
                      <p>✓ AI-powered campaign automation</p>
                      <p>✓ Advanced audience targeting</p>
                      <p>✓ Real-time performance optimization</p>
                      <p>✓ Multi-platform content management</p>
                      <p>✓ Data-driven insights & analytics</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
