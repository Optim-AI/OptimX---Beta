"use client";

import React from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Clock } from "lucide-react";

// import exact file you provided
import colors from "C:\\Users\\jpsha\\Documents\\OPTIM - Copy\\demo-repository\\lib\\colors";

/**
 * small helper to add alpha to HSL tokens that are "hsl(...)" or already "hsl(... / x%)"
 * returns string like "hsl(... / 0.2)" (keeps raw token if it doesn't match)
 */
const withAlpha = (hsl: string, alpha: number) => {
  if (!hsl) return hsl;
  // if token already has a slash-style alpha, replace it
  if (/\s*\/\s*[\d.]+/.test(hsl)) {
    return hsl.replace(/\)\s*$/, ` / ${alpha})`);
  }
  if (hsl.startsWith("hsl(")) {
    return hsl.replace(/\)$/, ` / ${alpha})`);
  }
  // fallback for gradients / complex tokens: return original
  return hsl;
};

const Blog = () => {
  const blogPosts = [
    {
      title: "10 Ways to Optimize Your Business Operations in 2024",
      excerpt:
        "Discover the latest strategies and technologies that can transform your business efficiency and drive growth.",
      author: "Rajesh Kumar",
      date: "March 15, 2024",
      readTime: "5 min read",
      category: "Business Strategy",
      image: "/placeholder.svg",
    },
    {
      title: "The ROI of Business Process Automation",
      excerpt:
        "Learn how automation can deliver measurable returns and why it's crucial for modern businesses.",
      author: "Priya Sharma",
      date: "March 10, 2024",
      readTime: "7 min read",
      category: "Automation",
      image: "/placeholder.svg",
    },
    {
      title: "Digital Transformation: A Complete Guide for Indian SMEs",
      excerpt:
        "Everything you need to know about digital transformation and how to implement it successfully.",
      author: "Amit Patel",
      date: "March 5, 2024",
      readTime: "10 min read",
      category: "Digital Transformation",
      image: "/placeholder.svg",
    },
    {
      title: "Data-Driven Decision Making: Best Practices",
      excerpt:
        "How to leverage data analytics to make better business decisions and improve outcomes.",
      author: "Neha Gupta",
      date: "February 28, 2024",
      readTime: "6 min read",
      category: "Data Analytics",
      image: "/placeholder.svg",
    },
    {
      title: "Supply Chain Optimization in the Post-Pandemic Era",
      excerpt:
        "Strategies for building resilient and efficient supply chains in today's uncertain world.",
      author: "Vikram Singh",
      date: "February 20, 2024",
      readTime: "8 min read",
      category: "Supply Chain",
      image: "/placeholder.svg",
    },
    {
      title: "Customer Experience Optimization: Key Metrics and Strategies",
      excerpt:
        "Improve customer satisfaction and loyalty through strategic experience optimization.",
      author: "Sonia Mehta",
      date: "February 15, 2024",
      readTime: "5 min read",
      category: "Customer Experience",
      image: "/placeholder.svg",
    },
  ];

  const categories = [
    "All",
    "Business Strategy",
    "Automation",
    "Digital Transformation",
    "Data Analytics",
    "Supply Chain",
    "Customer Experience",
  ];

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
            background: `linear-gradient(135deg, ${withAlpha(
              colors.primary,
              0.05
            )} 0%, ${withAlpha(colors.accent, 0.1)} 100%)`,
          }}
        >
          <div className="container mx-auto px-4 text-center">
            <h1
              className="text-4xl md:text-5xl font-bold mb-6"
              // gradient-text class kept for existing animation; also ensure fallback color
              style={{
                background:
                  colors.gradientPrimary ?? undefined,
                WebkitBackgroundClip: "text" as any,
                backgroundClip: "text" as any,
                color: colors.primaryForeground,
              }}
            >
              OptimX Blog
            </h1>
            <p
              className="text-xl max-w-2xl mx-auto"
              style={{ color: colors.mutedForeground }}
            >
              Insights, strategies, and best practices for business optimization
              and growth.
            </p>
          </div>
        </section>

        {/* Categories */}
        <section
          className="py-8 border-b"
          style={{ borderColor: withAlpha(colors.border, 0.5) }}
        >
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap gap-2 justify-center">
              {categories.map((category, index) => (
                <Badge
                  key={index}
                  variant={index === 0 ? "default" : "outline"}
                  className="cursor-pointer transition-colors"
                  // style forces color tokens from your colors.ts
                  style={{
                    background:
                      index === 0 ? colors.primary : undefined,
                    color:
                      index === 0
                        ? colors.primaryForeground
                        : colors.sidebarAccentForeground,
                    borderColor:
                      index === 0 ? undefined : withAlpha(colors.border, 0.5),
                  }}
                >
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        {/* Blog Posts */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {blogPosts.map((post, index) => (
                <Card
                  key={index}
                  className="shadow-soft hover:shadow-medium transition-all duration-300 cursor-pointer group"
                  // make card background slightly tinted using card token
                  style={{
                    background: withAlpha(colors.card, 1),
                    border: `1px solid ${withAlpha(colors.border, 0.5)}`,
                  }}
                >
                  <div className="aspect-video rounded-t-lg mb-4 overflow-hidden">
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${withAlpha(
                          colors.primary,
                          0.2
                        )} 0%, ${withAlpha(colors.accent, 0.3)} 100%)`,
                      }}
                    >
                      <span style={{ color: colors.mutedForeground }}>
                        Blog Image
                      </span>
                    </div>
                  </div>

                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <Badge
                        variant="secondary"
                        style={{
                          background: withAlpha(colors.secondary, 1),
                          color: colors.secondaryForeground,
                          borderColor: withAlpha(colors.border, 0.4),
                        }}
                      >
                        {post.category}
                      </Badge>
                    </div>

                    <CardTitle
                      className="group-hover:!text-primary transition-colors line-clamp-2"
                      // override Tailwind utility with inline color from tokens
                      style={{ color: colors.foreground }}
                    >
                      {post.title}
                    </CardTitle>

                    <CardDescription
                      className="line-clamp-3"
                      style={{ color: colors.mutedForeground }}
                    >
                      {post.excerpt}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div
                      className="flex items-center justify-between text-sm"
                      style={{ color: colors.mutedForeground }}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1">
                          <User className="h-4 w-4" />
                          <span>{post.author}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{post.date}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{post.readTime}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Newsletter Signup */}
        <section
          className="py-20"
          style={{ background: withAlpha(colors.muted, 0.5) }}
        >
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4" style={{ color: colors.foreground }}>
              Stay Updated
            </h2>
            <p
              className="mb-8 max-w-2xl mx-auto"
              style={{ color: colors.mutedForeground }}
            >
              Subscribe to our newsletter to get the latest insights on business
              optimization and growth strategies delivered to your inbox.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-2 rounded-md border"
                style={{
                  borderColor: withAlpha(colors.input, 0.6),
                  background: colors.background,
                  color: colors.foreground,
                }}
              />
              <button
                className="px-6 py-2 rounded-md transition-colors"
                style={{
                  background: colors.primary,
                  color: colors.primaryForeground,
                  // hover handled visually by transition; if you want JS hover replace with onMouseEnter/onMouseLeave
                  boxShadow: colors.shadowGlow,
                }}
              >
                Subscribe
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Blog;
