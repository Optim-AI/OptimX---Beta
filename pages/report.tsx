"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Sidebar from "../app/web/src/components/Sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../app/web/src/components/ui/card";
import { Button } from "../app/web/src/components/ui/button";
import { Input } from "../app/web/src/components/ui/input";
import { Label } from "../app/web/src/components/ui/label";
import { Textarea } from "../app/web/src/components/ui/textarea";
import { toast } from "../app/web/src/hooks/use-toast";
import { authFetch } from "@/lib/utils";
import { Flag, AlertCircle, MessageSquare, Upload, X, CheckCircle, Loader2, Clock, Eye, CheckCircle2, Ticket } from "lucide-react";
import colors from "@/lib/ui/colors";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB per image

type ReportType = "error" | "feedback";

interface UserReport {
  id: string;
  userId: string;
  type: string;
  message: string;
  pageUrl: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  vouchers?: {
    id: string;
    creditType: string;
    credits: number;
    status: string;
    expiresAt: string | null;
    createdAt: string | null;
  }[];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; icon: React.ReactNode; label: string }> = {
    open: {
      bg: "rgba(59, 130, 246, 0.15)",
      color: "rgb(96, 165, 250)",
      icon: <Clock size={12} />,
      label: "Open",
    },
    reviewed: {
      bg: "rgba(234, 179, 8, 0.15)",
      color: "rgb(250, 204, 21)",
      icon: <Eye size={12} />,
      label: "Reviewed",
    },
    resolved: {
      bg: "rgba(34, 197, 94, 0.15)",
      color: "rgb(74, 222, 128)",
      icon: <CheckCircle2 size={12} />,
      label: "Resolved",
    },
  };
  const c = config[status] || config.open;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const isError = type === "error";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: isError ? "rgba(239, 68, 68, 0.15)" : "rgba(99, 102, 241, 0.15)",
        color: isError ? "rgb(248, 113, 113)" : "rgb(129, 140, 248)",
      }}
    >
      {isError ? <AlertCircle size={12} /> : <MessageSquare size={12} />}
      {isError ? "Bug" : "Feedback"}
    </span>
  );
}

export default function ReportPage() {
  const [type, setType] = useState<ReportType>("feedback");
  const [message, setMessage] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // My Reports state
  const [myReports, setMyReports] = useState<UserReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  const fetchMyReports = useCallback(async () => {
    try {
      const res = await authFetch("/api/reports/my");
      const data = await res.json();
      if (data.success && Array.isArray(data.reports)) {
        setMyReports(data.reports);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyReports();
  }, [fetchMyReports]);

  const addImages = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    const imageFiles = list.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast({ title: "Maximum 3 images", description: "You can attach up to 3 images.", variant: "destructive" });
      return;
    }
    const toAdd = imageFiles.slice(0, remaining);
    for (const f of toAdd) {
      if (f.size > MAX_IMAGE_BYTES) {
        toast({ title: "Image too large", description: `${f.name} is over 3MB. Use a smaller image.`, variant: "destructive" });
        continue;
      }
    }
    try {
      const dataUrls = await Promise.all(toAdd.map(fileToDataUrl));
      setImages((prev) => [...prev, ...dataUrls].slice(0, MAX_IMAGES));
      if (toAdd.length < imageFiles.length) {
        toast({ title: "Some images skipped", description: `Only ${MAX_IMAGES} images allowed. Added ${toAdd.length}.`, variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not add images", description: "Please try again.", variant: "destructive" });
    }
  }, [images.length]);

  const removeImage = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      const files = Array.from(items)
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f != null);
      if (files.length) {
        e.preventDefault();
        addImages(files);
      }
    },
    [addImages]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please describe the error or share your feedback.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setSuccessBanner(false);
    try {
      const res = await authFetch("/api/report", {
        method: "POST",
        body: JSON.stringify({
          type,
          message: message.trim(),
          pageUrl: pageUrl.trim() || undefined,
          images: images.length ? images : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Could not submit",
          description: data.error || "Something went wrong. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Thank you",
        description:
          type === "error"
            ? "We've received your report and will look into it."
            : "We've received your feedback and appreciate it.",
      });
      setSuccessBanner(true);
      setMessage("");
      setPageUrl("");
      setImages([]);
      // Refresh report list
      fetchMyReports();
    } catch (err) {
      console.error("Report submit error:", err);
      toast({
        title: "Error",
        description: "Failed to submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: colors.background }}>
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 lg:p-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{
                backgroundColor: type === "error" ? "rgba(239, 68, 68, 0.15)" : colors.primary + "20",
                color: type === "error" ? colors.destructive : colors.primary,
              }}
            >
              <Flag size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: colors.foreground }}>
                Report
              </h1>
              <p className="text-sm" style={{ color: colors.mutedForeground }}>
                Report an error or share feedback so we can improve.
              </p>
            </div>
          </div>

          {/* Success Banner */}
          {successBanner && (
            <div
              className="mb-6 flex items-center gap-3 rounded-lg border px-4 py-3"
              style={{
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                borderColor: "rgba(34, 197, 94, 0.3)",
                color: "rgb(74, 222, 128)",
              }}
            >
              <CheckCircle size={20} />
              <span className="flex-1 text-sm font-medium">
                Report submitted successfully. We'll review it shortly.
              </span>
              <button
                onClick={() => setSuccessBanner(false)}
                className="rounded p-1 transition-colors hover:bg-white/10"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <Card style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            <CardHeader>
              <CardTitle style={{ color: colors.foreground }}>
                What would you like to share?
              </CardTitle>
              <CardDescription style={{ color: colors.mutedForeground }}>
                Describe a bug, an error you saw, or any feedback. Your report helps us fix issues and build a better product.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Type selector */}
                <div className="space-y-2">
                  <Label style={{ color: colors.foreground }}>Type</Label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setType("error"); setSuccessBanner(false); }}
                      className="flex flex-1 items-center gap-2 rounded-lg border-2 px-4 py-3 text-left transition-colors"
                      style={{
                        borderColor: type === "error" ? colors.primary : "rgba(0,0,0,0.1)",
                        backgroundColor: type === "error" ? colors.primary + "12" : "transparent",
                        color: colors.foreground,
                      }}
                    >
                      <AlertCircle size={18} style={{ color: type === "error" ? colors.primary : colors.mutedForeground }} />
                      <span className="font-medium">Error / Bug</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setType("feedback"); setSuccessBanner(false); }}
                      className="flex flex-1 items-center gap-2 rounded-lg border-2 px-4 py-3 text-left transition-colors"
                      style={{
                        borderColor: type === "feedback" ? colors.primary : "rgba(0,0,0,0.1)",
                        backgroundColor: type === "feedback" ? colors.primary + "12" : "transparent",
                        color: colors.foreground,
                      }}
                    >
                      <MessageSquare size={18} style={{ color: type === "feedback" ? colors.primary : colors.mutedForeground }} />
                      <span className="font-medium">Feedback</span>
                    </button>
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <Label htmlFor="message" style={{ color: colors.foreground }}>
                    {type === "error" ? "What went wrong?" : "Your feedback"}
                  </Label>
                  <Textarea
                    id="message"
                    placeholder={
                      type === "error"
                        ? "Describe what happened, what you expected, and any error message you saw..."
                        : "Share your thoughts, suggestions, or ideas..."
                    }
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onPaste={handlePaste}
                    rows={5}
                    className="resize-none"
                    style={{
                      backgroundColor: colors.background,
                      borderColor: "rgba(0,0,0,0.1)",
                      color: colors.foreground,
                    }}
                    required
                  />
                </div>

                {/* Optional: Page URL */}
                <div className="space-y-2">
                  <Label htmlFor="pageUrl" style={{ color: colors.foreground }}>
                    Where did it happen? <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="pageUrl"
                    type="url"
                    placeholder="e.g. https://app.example.com/brand-studio/video"
                    value={pageUrl}
                    onChange={(e) => setPageUrl(e.target.value)}
                    style={{
                      backgroundColor: colors.background,
                      borderColor: "rgba(0,0,0,0.1)",
                      color: colors.foreground,
                    }}
                  />
                </div>

                {/* Images: upload or paste, up to 3 */}
                <div className="space-y-2">
                  <Label style={{ color: colors.foreground }}>
                    Attach screenshots <span className="text-muted-foreground">(optional, up to 3)</span>
                  </Label>
                  <div
                    className="rounded-lg border-2 border-dashed p-4 transition-colors focus-within:ring-2 focus-within:ring-offset-2"
                    style={{
                      borderColor: "rgba(0,0,0,0.12)",
                      backgroundColor: colors.background + "80",
                    }}
                    onPaste={handlePaste}
                    tabIndex={0}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files?.length) addImages(files);
                        e.target.value = "";
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      {images.map((dataUrl, i) => (
                        <div
                          key={i}
                          className="relative inline-block rounded-lg overflow-hidden border shadow-sm"
                          style={{ borderColor: "rgba(0,0,0,0.1)" }}
                        >
                          <img
                            src={dataUrl}
                            alt={`Attachment ${i + 1}`}
                            className="h-20 w-20 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(i)}
                            className="absolute top-1 right-1 rounded-full p-1 shadow-md hover:opacity-90"
                            style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}
                            aria-label="Remove image"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      {images.length < MAX_IMAGES && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition-colors hover:bg-black/5"
                          style={{
                            borderColor: "rgba(0,0,0,0.2)",
                            color: colors.mutedForeground,
                          }}
                        >
                          <Upload size={20} />
                          <span className="text-[10px] font-medium">Upload</span>
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>
                      Upload or paste (Ctrl+V / Cmd+V) up to 3 images. Max 3MB each.
                    </p>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: type === "error" ? colors.destructive : colors.primary,
                    color: type === "error" ? colors.destructiveForeground : colors.primaryForeground,
                  }}
                >
                  {isSubmitting ? "Sending…" : "Submit report"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* My Reports Section */}
          <div className="mt-10">
            <h2 className="mb-4 text-lg font-semibold" style={{ color: colors.foreground }}>
              My Reports
            </h2>

            {reportsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin" style={{ color: colors.mutedForeground }} />
              </div>
            ) : myReports.length === 0 ? (
              <div
                className="rounded-lg border py-10 text-center"
                style={{ borderColor: colors.border, backgroundColor: colors.card }}
              >
                <Flag size={32} className="mx-auto mb-3" style={{ color: colors.mutedForeground }} />
                <p className="text-sm" style={{ color: colors.mutedForeground }}>
                  No reports yet. Submit your first report above.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myReports.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-lg border p-4"
                    style={{ borderColor: colors.border, backgroundColor: colors.card }}
                  >
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      <TypeBadge type={report.type} />
                      <StatusBadge status={report.status} />
                      <span className="ml-auto text-xs" style={{ color: colors.mutedForeground }}>
                        {formatDate(report.createdAt)}
                      </span>
                    </div>
                    <p
                      className="text-sm leading-relaxed line-clamp-2"
                      style={{ color: colors.cardForeground }}
                    >
                      {report.message}
                    </p>
                    {report.pageUrl && (
                      <p className="mt-1 truncate text-xs" style={{ color: colors.mutedForeground }}>
                        {report.pageUrl}
                      </p>
                    )}
                    {report.vouchers && report.vouchers.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {report.vouchers.map((v) => {
                          const isActive = v.status === 'active';
                          const isRedeemed = v.status === 'redeemed';
                          return (
                            <div
                              key={v.id}
                              className="flex items-center gap-2 rounded-lg border px-3 py-2"
                              style={{
                                backgroundColor: isActive ? 'rgba(34, 197, 94, 0.08)' : isRedeemed ? 'rgba(59, 130, 246, 0.08)' : 'rgba(100,100,100,0.06)',
                                borderColor: isActive ? 'rgba(34, 197, 94, 0.25)' : isRedeemed ? 'rgba(59, 130, 246, 0.25)' : 'rgba(100,100,100,0.15)',
                              }}
                            >
                              <Ticket size={14} style={{ color: isActive ? 'rgb(34, 197, 94)' : colors.mutedForeground, flexShrink: 0 }} />
                              <span className="text-xs font-medium" style={{ color: isActive ? 'rgb(34, 197, 94)' : colors.cardForeground }}>
                                Voucher: +{v.credits}{v.creditType === 'video' ? 's' : ''} {v.creditType} credits
                              </span>
                              <span
                                className="ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{
                                  backgroundColor: isActive ? 'rgba(34, 197, 94, 0.15)' : isRedeemed ? 'rgba(59, 130, 246, 0.15)' : 'rgba(100,100,100,0.12)',
                                  color: isActive ? 'rgb(74, 222, 128)' : isRedeemed ? 'rgb(96, 165, 250)' : colors.mutedForeground,
                                }}
                              >
                                {v.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
