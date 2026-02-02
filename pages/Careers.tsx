"use client";

import React from "react";
import Header from "../app/web/src/components/Header";
import Footer from "../app/web/src/components/Footer";
import { Button } from "../app/web/src/components/ui/button";
import { Card, CardContent } from "../app/web/src/components/ui/card";
import { Input } from "../app/web/src/components/ui/input";
import { Label } from "../app/web/src/components/ui/label";
import { Upload, Users } from "lucide-react";

// Importing exact colors file you requested
import colors from "../lib/colors";

/** Helper to add slash-style alpha to HSL tokens (returns original if not hsl) */
const withAlpha = (token: string, alpha: number) => {
  if (!token) return token;
  // if token already contains a slash alpha, replace it
  if (/\s*\/\s*[\d.]+\)/.test(token)) {
    return token.replace(/\)\s*$/, ` / ${alpha})`);
  }
  if (token.startsWith("hsl(")) {
    return token.replace(/\)$/, ` / ${alpha})`);
  }
  return token;
};

const Careers = () => {
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
            // use backgroundImage to make intent explicit (same effect as background)
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
                // gradient text: set the gradient as background-image and make text transparent
                backgroundImage: colors.gradientPrimary ?? undefined,
                WebkitBackgroundClip: "text" as any,
                backgroundClip: "text" as any,
                color: "transparent", // <-- important: make text transparent
                WebkitTextFillColor: "transparent", // <-- webkit fallback
              }}
            >
              Join Our Team
            </h1>

            <p
              className="text-xl max-w-2xl mx-auto"
              style={{ color: colors.mutedForeground }}
            >
              Help us build the future of business optimization. We're looking
              for passionate individuals who want to make a real impact.
            </p>
          </div>
        </section>

        {/* Application Form */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              <Card
                className="shadow-soft"
                style={{
                  background: withAlpha(colors.card, 1),
                  border: `1px solid ${withAlpha(colors.border, 0.5)}`,
                }}
              >
                <CardContent className="p-8">
                  <div className="text-center mb-8">
                    <Users
                      className="h-12 w-12 mx-auto mb-4"
                      style={{ color: colors.primary }}
                    />
                    <h2
                      className="text-3xl font-bold mb-4"
                      style={{ color: colors.foreground }}
                    >
                      Apply to Join Our Team
                    </h2>
                    <p style={{ color: colors.mutedForeground }}>
                      We're always looking for talented individuals to join our
                      mission. Send us your details and we'll get in touch.
                    </p>
                  </div>

                  <form className="space-y-6">
                    <div className="space-y-2">
                      <Label
                        htmlFor="name"
                        style={{ color: colors.foreground }}
                      >
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        placeholder="Enter your full name"
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
                        type="email"
                        placeholder="Enter your email address"
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
                        htmlFor="phone"
                        style={{ color: colors.foreground }}
                      >
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="Enter your phone number"
                        required
                        style={{
                          background: colors.background,
                          color: colors.foreground,
                          borderColor: withAlpha(colors.input, 0.6),
                        }}
                      />
                    </div>

                    {/* <div className="space-y-2">
                      <Label
                        htmlFor="resume"
                        style={{ color: colors.foreground }}
                      >
                        Upload Resume
                      </Label>

                      <label
                        htmlFor="resume"
                        className="block rounded-lg p-6 text-center transition-colors cursor-pointer"
                        style={{
                          borderStyle: "dashed",
                          borderWidth: 2,
                          borderColor: withAlpha(colors.mutedForeground, 0.25),
                          background: withAlpha(colors.card, 0.02),
                          color: colors.mutedForeground,
                        }}
                      >
                        <Upload
                          className="h-8 w-8 mx-auto mb-2"
                          style={{ color: colors.mutedForeground }}
                        />
                        <p
                          className="text-sm mb-1"
                          style={{ color: colors.mutedForeground }}
                        >
                          Click to upload your resume
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: colors.mutedForeground }}
                        >
                          PDF, DOC, or DOCX (Max 5MB)
                        </p>

                        <input
                          id="resume"
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          required
                        />
                      </label>
                    </div> */}

                    <Button
                      type="submit"
                      className="w-full"
                      style={{
                        background: colors.primary,
                        color: colors.primaryForeground,
                        boxShadow: colors.shadowGlow,
                        border: `1px solid ${withAlpha(colors.primary, 0.9)}`,
                      }}
                    >
                      Submit Application
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Careers;
