// "use client";

// import React, { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import Sidebar from "../app/web/src/components/Sidebar";
// import { Button } from "../app/web/src/components/ui/button";
// import { Card } from "../app/web/src/components/ui/card";
// import { Input } from "../app/web/src/components/ui/input";
// import { Label } from "../app/web/src/components/ui/label";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "../app/web/src/components/ui/select";
// import { Slider } from "../app/web/src/components/ui/slider";
// import { Textarea } from "../app/web/src/components/ui/textarea";
// import { Switch } from "../app/web/src/components/ui/switch";
// import { Badge } from "../app/web/src/components/ui/badge";
// import { Progress } from "../app/web/src/components/ui/progress";
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipProvider,
//   TooltipTrigger,
// } from "../app/web/src/components/ui/tooltip";
// import {
//   ArrowLeft,
//   ArrowRight,
//   CheckCircle2,
//   Upload,
//   MapPin,
//   MessageCircle,
//   Save,
//   Rocket,
//   Sparkles,
// } from "lucide-react";
// import { toast } from "sonner";

// // exact colors import path you requested — DO NOT change
// import colors from "C:/Users/jpsha/Documents/OPTIM - Copy/demo-repository/lib/colors";

// // supabase client for browser usage (assumes you have this export)
// import { supabase } from "../lib/supabaseClient";

// /* -------------------- color tokens (fallback-safe) -------------------- */
// const { primary, primary5 } = (colors as any) || {};
// const primaryColor = typeof primary === "string" ? primary : undefined;
// const primaryBg5 = typeof primary5 === "string" ? primary5 : undefined;

// /* -------------------- IndexedDB helpers (same approach as your other pages) -------------------- */
// const DB_NAME = "optim-app-db";
// const STORE_NAME = "images";

// function openDb(): Promise<IDBDatabase> {
//   return new Promise((resolve, reject) => {
//     const req = indexedDB.open(DB_NAME, 1);
//     req.onupgradeneeded = () => {
//       const db = req.result;
//       if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
//     };
//     req.onsuccess = () => resolve(req.result);
//     req.onerror = () => reject(req.error);
//   });
// }

// function idbPut(key: string, value: Blob | string): Promise<void> {
//   return new Promise(async (resolve, reject) => {
//     try {
//       const db = await openDb();
//       const tx = db.transaction(STORE_NAME, "readwrite");
//       const store = tx.objectStore(STORE_NAME);
//       const putReq = store.put(value, key);
//       putReq.onsuccess = () => resolve();
//       putReq.onerror = () => reject(putReq.error);
//       tx.oncomplete = () => db.close();
//     } catch (e) {
//       reject(e);
//     }
//   });
// }

// function dataURLtoBlob(dataurl: string): Blob {
//   const arr = dataurl.split(",");
//   const mimeMatch = arr[0].match(/:(.*?);/);
//   const mime = mimeMatch ? mimeMatch[1] : "image/png";
//   const bstr = atob(arr[1]);
//   let n = bstr.length;
//   const u8arr = new Uint8Array(n);
//   while (n--) u8arr[n] = bstr.charCodeAt(n);
//   return new Blob([u8arr], { type: mime });
// }

// /* -------------------- CampaignCreate Page -------------------- */
// const CampaignCreate: React.FC = () => {
//   const router = useRouter();

//   const [mode, setMode] = useState<"ad" | "post">("ad");
//   const [step, setStep] = useState(1);
//   const totalSteps = mode === "ad" ? 6 : 4;

//   // Form state for Ad Generation
//   const [adFormData, setAdFormData] = useState({
//     campaignName: "",
//     objective: "",
//     platforms: [] as string[],
//     campaignType: "",
//     brandName: "",
//     tagline: "",
//     tone: "",
//     primaryCTA: "",
//     location: "",
//     ageRange: [18, 65] as [number, number],
//     gender: "all",
//     interests: "",
//     autoTarget: true,
//     budgetType: "daily",
//     budget: 5000,
//     startDate: "",
//     endDate: "",
//     autoOptimize: true,
//     description: "",
//     emotion: "",
//     offerInfo: "",
//     multipleVariations: false,
//     logoPublicUrl: null as string | null,
//     logoDataUrl: null as string | null, // local override
//   });

//   // Form state for Post Generation
//   const [postFormData, setPostFormData] = useState({
//     postName: "",
//     platforms: [] as string[],
//     postType: "",
//     goal: "",
//     brandName: "",
//     tone: "",
//     primaryCTA: "",
//     hashtags: "",
//     prompt: "",
//     generatedCaption: "",
//     multipleVersions: false,
//     logoPublicUrl: null as string | null,
//     logoDataUrl: null as string | null,
//   });

//   const adStepTitles = [
//     "Campaign Basics",
//     "Brand & Creative Details",
//     "Audience Targeting",
//     "Budget & Schedule",
//     "Creative Direction",
//     "Review & Launch",
//   ];

//   const postStepTitles = [
//     "Post Basics",
//     "Brand & Creative Info",
//     "AI Post Generator",
//     "Review & Publish",
//   ];

//   const stepTitles = mode === "ad" ? adStepTitles : postStepTitles;
//   const progress = (step / totalSteps) * 100;

//   // Load user profile for autofill (logo, tagline, brandName)
//   useEffect(() => {
//     (async () => {
//       try {
//         const { data: userData } = await supabase.auth.getUser();
//         const user = (userData as any)?.user;
//         if (!user) return;
//         const { data, error } = await supabase
//           .from("profiles")
//           .select("*")
//           .eq("id", user.id)
//           .single();
//         if (!error && data) {
//           // autofill ad and post brand fields if missing
//           if (data.company_name) {
//             setAdFormData((prev) => ({ ...prev, brandName: prev.brandName || data.company_name }));
//             setPostFormData((prev) => ({ ...prev, brandName: prev.brandName || data.company_name }));
//           }
//           if (data.tagline) {
//             setAdFormData((prev) => ({ ...prev, tagline: prev.tagline || data.tagline }));
//           }
//           // logo
//           if (data.logo_path) {
//             try {
//               const { data: pub } = supabase.storage.from("user-uploads").getPublicUrl(data.logo_path);
//               const publicUrl = (pub as any)?.publicUrl ?? null;
//               if (publicUrl) {
//                 setAdFormData((prev) => ({ ...prev, logoPublicUrl: prev.logoPublicUrl || publicUrl }));
//                 setPostFormData((prev) => ({ ...prev, logoPublicUrl: prev.logoPublicUrl || publicUrl }));
//               }
//             } catch (e) {
//               console.warn("logo public url failed", e);
//             }
//           }
//         }
//       } catch (e) {
//         console.warn("profile load failed", e);
//       }
//     })();
//   }, []);

//   // Helpers: save draft to server
//   async function saveDraft(payload: any) {
//     try {
//       const resp = await fetch("/api/campaigns/save-draft", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });
//       const json = await resp.json();
//       if (!resp.ok || !json?.ok) {
//         throw new Error(json?.error || `Save draft failed: ${resp.status}`);
//       }
//       toast.success("Draft saved");
//       return json.draft;
//     } catch (err: any) {
//       console.error("saveDraft error", err);
//       toast.error("Save failed: " + (err.message || String(err)));
//       return null;
//     }
//   }

//   // onClick Save as Draft (top-level button)
//   const handleSaveAsDraft = async () => {
//     const payload =
//       mode === "ad"
//         ? { mode: "ad", name: adFormData.campaignName, inputs: adFormData, ...adFormData }
//         : { mode: "post", postName: postFormData.postName, inputs: postFormData, ...postFormData };

//     // include inlined logoDataUrl if a local file has been uploaded (so server can persist or upload)
//     if (adFormData.logoDataUrl) payload.logoDataUrl = adFormData.logoDataUrl;
//     if (postFormData.logoDataUrl) payload.logoDataUrl = postFormData.logoDataUrl;

//     await saveDraft(payload);
//   };

//   // Called when moving to next step — persist the current full form to server (ensures step1 saved at least)
//   const handleNext = async () => {
//     // Persist at each step so nothing lost (you asked step1 in particular; this covers that)
//     try {
//       const payload =
//         mode === "ad"
//           ? {
//               mode: "ad",
//               name: adFormData.campaignName,
//               inputs: adFormData,
//               campaignType: adFormData.campaignType,
//             }
//           : {
//               mode: "post",
//               postName: postFormData.postName,
//               inputs: postFormData,
//               postType: postFormData.postType,
//             };

//       // attach inline logos if present
//       if (adFormData.logoDataUrl) payload.logoDataUrl = adFormData.logoDataUrl;
//       if (postFormData.logoDataUrl) payload.logoDataUrl = postFormData.logoDataUrl;

//       await saveDraft(payload);
//     } catch (e) {
//       console.warn("autosave failed", e);
//     } finally {
//       if (step < totalSteps) setStep(step + 1);
//       else {
//         // Finalize: generate or publish
//         if (mode === "ad") {
//           await handleGenerateCampaign();
//         } else {
//           await handlePublishPost();
//         }
//       }
//     }
//   };

//   // file->dataURL helper
//   const fileToDataUrl = (file: File): Promise<string> =>
//     new Promise((res, rej) => {
//       const fr = new FileReader();
//       fr.onload = () => res(String(fr.result));
//       fr.onerror = rej;
//       fr.readAsDataURL(file);
//     });

//   // Logo upload handlers (for both flows)
//   const handleAdLogoChange = async (f?: File | null) => {
//     if (!f) {
//       setAdFormData((p) => ({ ...p, logoDataUrl: null, logoPublicUrl: null }));
//       return;
//     }
//     try {
//       const dataUrl = await fileToDataUrl(f);
//       setAdFormData((p) => ({ ...p, logoDataUrl: dataUrl }));
//     } catch (e) {
//       toast.error("Logo read failed");
//     }
//   };
//   const handlePostLogoChange = async (f?: File | null) => {
//     if (!f) {
//       setPostFormData((p) => ({ ...p, logoDataUrl: null, logoPublicUrl: null }));
//       return;
//     }
//     try {
//       const dataUrl = await fileToDataUrl(f);
//       setPostFormData((p) => ({ ...p, logoDataUrl: dataUrl }));
//     } catch (e) {
//       toast.error("Logo read failed");
//     }
//   };

//   // Remove logo (revert to none)
//   const removeAdLogo = () => setAdFormData((p) => ({ ...p, logoPublicUrl: null, logoDataUrl: null }));
//   const removePostLogo = () => setPostFormData((p) => ({ ...p, logoPublicUrl: null, logoDataUrl: null }));

//   // AI: generate caption / hashtags using your generateCaption endpoint
//   const generateCaption = async (prompt: string, setResult: (text: string) => void) => {
//     try {
//       if (!prompt || prompt.trim().length === 0) {
//         toast.error("Please provide some text for AI to work with.");
//         return;
//       }
//       const resp = await fetch("/api/generateCaption", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ prompt }),
//       });
//       const json = await resp.json();
//       if (!resp.ok) {
//         throw new Error(json?.error || "AI generation failed");
//       }
//       // assume json.caption
//       if (json.caption) {
//         setResult(json.caption);
//         toast.success("AI generated text");
//       } else {
//         toast.error("AI returned no caption");
//       }
//     } catch (err: any) {
//       console.error("generateCaption error", err);
//       toast.error("AI generation failed: " + (err.message || String(err)));
//     }
//   };

//   // Final: call /api/generate-campaign to create AI image & store preview
//   const handleGenerateCampaign = async () => {
//     try {
//       // basic validation
//       if (!adFormData.campaignName || !adFormData.description) {
//         toast.error("Please fill Campaign Name and Description before generating.");
//         return;
//       }

//       toast("Generating campaign — this may take a while...", { icon: "🤖" });

//       const payload: any = {
//         mode: "generate",
//         // copy prominent fields directly for prompt builder
//         campaignName: adFormData.campaignName,
//         objective: adFormData.objective,
//         platforms: adFormData.platforms,
//         campaignType: adFormData.campaignType,
//         brandName: adFormData.brandName,
//         tagline: adFormData.tagline,
//         tone: adFormData.tone,
//         primaryCTA: adFormData.primaryCTA,
//         location: adFormData.location,
//         ageRange: adFormData.ageRange,
//         gender: adFormData.gender,
//         interests: adFormData.interests,
//         autoTarget: adFormData.autoTarget,
//         budgetType: adFormData.budgetType,
//         budget: adFormData.budget,
//         startDate: adFormData.startDate,
//         endDate: adFormData.endDate,
//         autoOptimize: adFormData.autoOptimize,
//         description: adFormData.description,
//         emotion: adFormData.emotion,
//         offerInfo: adFormData.offerInfo,
//         // assets
//         target: { id: "insta_feed", width: 1080, height: 1080 },
//         aiCustomization: {
//           colorPrimary: undefined,
//           colorSecondary: undefined,
//           logoUrl: adFormData.logoPublicUrl ?? null,
//         },
//       };

//       // include local logo data if user uploaded override
//       if (adFormData.logoDataUrl) payload.logoDataUrl = adFormData.logoDataUrl;

//       // call generation endpoint
//       const resp = await fetch("/api/generate-campaign", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });

//       const json = await resp.json();
//       if (!resp.ok || !json?.ok) {
//         throw new Error(json?.error || `Generation failed: ${resp.status}`);
//       }

//       // if returned public URL(s), store as preview and go preview page
//       if (json.image && typeof json.image === "string" && !json.image.startsWith("data:")) {
//         // save preview in session directly (preview page will pick this up)
//         const previewObj = { inputs: payload, output: json.copy ?? null, image: json.image, images: Array.isArray(json.images) ? json.images : [json.image] };
//         try {
//           sessionStorage.setItem("preview", JSON.stringify(previewObj));
//         } catch (e) {
//           console.warn("session set failed", e);
//         }
//         router.push("/create-campaign-preview");
//         return;
//       }

//       // If data URL returned, store blob in IDB and pass imageKey in preview (same pattern as your other pages)
//       if (json.image && typeof json.image === "string" && json.image.startsWith("data:")) {
//         try {
//           const blob = dataURLtoBlob(json.image);
//           const imageKey = `preview_image_${Date.now()}`;
//           await idbPut(imageKey, blob);
//           const previewObj = { inputs: payload, output: json.copy ?? null, image: null, images: [], imageKey };
//           sessionStorage.setItem("preview", JSON.stringify(previewObj));
//           router.push("/create-campaign-preview");
//           return;
//         } catch (e) {
//           console.error("Failed to store generated image in IndexedDB", e);
//           // fallback: store data URL in session (preview page might not show it inline, but still better than nothing)
//           const previewObj = { inputs: payload, output: json.copy ?? null, image: json.image, images: [json.image] };
//           sessionStorage.setItem("preview", JSON.stringify(previewObj));
//           router.push("/create-campaign-preview");
//           return;
//         }
//       }

//       // fallback
//       toast.error("Generation returned no usable image");
//     } catch (err: any) {
//       console.error("handleGenerateCampaign error", err);
//       toast.error("Generate failed: " + (err.message || String(err)));
//     }
//   };

//   // Publish post: call generation for caption and optionally posting flow (simpler flow: create draft + optionally trigger posting via post API)
//   const handlePublishPost = async () => {
//     try {
//       if (!postFormData.postName || postFormData.platforms.length === 0) {
//         toast.error("Please set Post Name and pick at least one platform.");
//         return;
//       }

//       // Save final draft first (server side) then you may call posting endpoint depending on platforms
//       const payload = { mode: "post", postName: postFormData.postName, inputs: postFormData };

//       const saved = await saveDraft(payload);
//       if (!saved) return;

//       // If user wants immediate publishing: call your posting endpoints or your existing publish flow (not implemented here).
//       toast.success("Post saved as draft. Use publishing flow to post to platforms.");
//       router.push("/campaigns");
//     } catch (err: any) {
//       console.error("handlePublishPost error", err);
//       toast.error("Publish failed: " + (err.message || String(err)));
//     }
//   };

//   // Call OpenAI for hashtags/caption
//   const handleGenerateHashtags = async () => {
//     await generateCaption(postFormData.prompt || postFormData.postName || "Create hashtags", (text) => {
//       // attempt to extract hashtags only (if AI returns caption with hashtags, keep them)
//       // simple heuristic: extract words starting with #
//       const matches = (text || "").match(/#[\w-]+/g);
//       if (matches && matches.length) {
//         setPostFormData((p) => ({ ...p, hashtags: matches.join(" ") }));
//       } else {
//         // fallback: store AI text into hashtags field for manual edit
//         setPostFormData((p) => ({ ...p, hashtags: text }));
//       }
//     });
//   };

//   const handleGeneratePostCaption = async () => {
//     await generateCaption(postFormData.prompt || postFormData.postName || "Create caption", (text) => {
//       setPostFormData((p) => ({ ...p, generatedCaption: text }));
//     });
//   };

//   // Final: post ad to Facebook (optional). This will call your updated /api/auth/facebook/ads endpoint
//   // (We do not auto-call this on Generate — keep ad creation paused as default. Provide a helper if you need it.)
//   const postAdToFacebook = async () => {
//     try {
//       // assemble creative image: use generated preview (sessionStorage) or a public image url the user provided
//       // For simplicity this function assumes creativeImageUrl is a public URL field you have or you uploaded previously.
//       // We will take the first imageUrl from session preview if available
//       const previewRaw = sessionStorage.getItem("preview");
//       let creativeImageUrl = undefined;
//       if (previewRaw) {
//         try {
//           const parsed = JSON.parse(previewRaw);
//           if (parsed.image && typeof parsed.image === "string" && !parsed.image.startsWith("data:")) {
//             creativeImageUrl = parsed.image;
//           } else if (Array.isArray(parsed.images) && parsed.images.length && typeof parsed.images[0] === "string" && !parsed.images[0].startsWith("data:")) {
//             creativeImageUrl = parsed.images[0];
//           }
//         } catch (e) { /* ignore */ }
//       }

//       if (!creativeImageUrl) {
//         return toast.error("No public image found for posting — generate and save a public image first.");
//       }

//       const body = {
//         campaignName: adFormData.campaignName,
//         adSetName: `${adFormData.campaignName || "Campaign"} - AdSet`,
//         budget: adFormData.budget,
//         creativeImageUrl,
//         creativeCaption: adFormData.tagline || adFormData.description || "",
//         targeting: adFormData.autoTarget ? undefined : { geo_locations: { countries: ["IN"] }, age_min: adFormData.ageRange[0], age_max: adFormData.ageRange[1] },
//         destinationLink: undefined,
//         // include other mapping fields as needed...
//       };

//       const resp = await fetch("/api/auth/facebook/ads", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(body),
//       });
//       const json = await resp.json();
//       if (!resp.ok) {
//         throw new Error(json?.error || JSON.stringify(json));
//       }
//       toast.success("Facebook ad created (paused). See console for ids.");
//       console.log("fb ad response", json);
//     } catch (err: any) {
//       console.error("postAdToFacebook error", err);
//       toast.error("Post to Facebook failed: " + (err.message || String(err)));
//     }
//   };

//   /* -------------------- UI (kept intact with requested small edits) -------------------- */

//   return (
//     <div className="min-h-screen flex bg-slate-50">
//       <Sidebar />

//       <div className="flex-1">
//         <div className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
//           <div className="max-w-7xl mx-auto px-6 py-4">
//             <div className="flex items-center justify-between mb-4">
//               <h1
//                 className="text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent"
//                 style={primaryColor ? { backgroundImage: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}99)` } : undefined}
//               >
//                 Create Campaign
//               </h1>

//               <div className="flex items-center gap-3">
//                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
//                   <Save className="h-4 w-4" />
//                   <span>Draft Saved</span>
//                 </div>
//               </div>
//             </div>

//             <div className="flex justify-center mb-6">
//               <TooltipProvider>
//                 <Tooltip>
//                   <TooltipTrigger asChild>
//                     <div className="glass-card p-1.5 rounded-full inline-flex gap-1">
//                       <button
//                         onClick={() => {
//                           setMode("ad");
//                           setStep(1);
//                         }}
//                         className={`
//                           relative px-6 py-2.5 rounded-full font-medium text-sm transition-all duration-300
//                           flex items-center gap-2
//                           ${mode === "ad"
//                             ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg shadow-primary/50"
//                             : "text-muted-foreground hover:text-foreground"
//                           }
//                         `}
//                         style={mode === "ad" && primaryColor ? { boxShadow: `0 6px 18px ${primaryColor}22` } : undefined}
//                       >
//                         <Rocket className="h-4 w-4" />
//                         Ad Generation
//                       </button>

//                       <button
//                         onClick={() => {
//                           setMode("post");
//                           setStep(1);
//                         }}
//                         className={`
//                           relative px-6 py-2.5 rounded-full font-medium text-sm transition-all duration-300
//                           flex items-center gap-2
//                           ${mode === "post"
//                             ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg shadow-primary/50"
//                             : "text-muted-foreground hover:text-foreground"
//                           }
//                         `}
//                         style={mode === "post" && primaryColor ? { boxShadow: `0 6px 18px ${primaryColor}22` } : undefined}
//                       >
//                         <Sparkles className="h-4 w-4" />
//                         Post Generation
//                       </button>
//                     </div>
//                   </TooltipTrigger>
//                   <TooltipContent>
//                     <p>Switch between paid ad setup and organic post creation</p>
//                   </TooltipContent>
//                 </Tooltip>
//               </TooltipProvider>
//             </div>

//             <div className="space-y-2">
//               <div className="flex items-center justify-between text-sm">
//                 <span className="text-muted-foreground">
//                   Step {step} of {totalSteps}: {stepTitles[step - 1]}
//                 </span>
//                 <span className="text-muted-foreground">{Math.round(progress)}%</span>
//               </div>
//               <Progress value={progress} className="h-2" />
//             </div>
//           </div>
//         </div>

//         <div className="max-w-7xl mx-auto px-6 py-8">
//           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//             {/* Form Section */}
//             <div className="lg:col-span-2">
//               <Card className="glass-card p-8 rounded-2xl border-border/50">
//                 {mode === "ad" ? (
//                   <>
//                     {/* AD flow — step blocks unchanged except previews removed and platforms limited */}
//                     {step === 1 && (
//                       <div className="space-y-6">
//                         <div>
//                           <Label htmlFor="campaignName">Campaign Name</Label>
//                           <Input
//                             id="campaignName"
//                             placeholder="Diwali Sale 2025"
//                             value={adFormData.campaignName}
//                             onChange={(e) => setAdFormData({ ...adFormData, campaignName: e.target.value })}
//                             className="mt-2"
//                           />
//                         </div>

//                         <div>
//                           <Label>Objective</Label>
//                           <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
//                             {["Sales", "Traffic", "Engagement", "Awareness", "App Installs", "Custom"].map((obj) => (
//                               <Button
//                                 key={obj}
//                                 variant={adFormData.objective === obj ? "default" : "outline"}
//                                 onClick={() => setAdFormData({ ...adFormData, objective: obj })}
//                                 className="justify-start"
//                               >
//                                 {obj}
//                               </Button>
//                             ))}
//                           </div>
//                         </div>

//                         <div>
//                           <Label>Platform Selection</Label>
//                           <div className="flex flex-wrap gap-2 mt-2">
//                             {["Facebook", "Instagram"].map((platform) => (
//                               <Badge
//                                 key={platform}
//                                 variant={adFormData.platforms.includes(platform) ? "default" : "outline"}
//                                 className="cursor-pointer px-4 py-2"
//                                 onClick={() => {
//                                   const newPlatforms = adFormData.platforms.includes(platform)
//                                     ? adFormData.platforms.filter((p) => p !== platform)
//                                     : [...adFormData.platforms, platform];
//                                   setAdFormData({ ...adFormData, platforms: newPlatforms });
//                                 }}
//                               >
//                                 {platform}
//                               </Badge>
//                             ))}
//                           </div>
//                         </div>

//                         <div>
//                           <Label htmlFor="campaignType">Campaign Type</Label>
//                           <Select
//                             value={adFormData.campaignType}
//                             onValueChange={(value) => setAdFormData({ ...adFormData, campaignType: value })}
//                           >
//                             <SelectTrigger className="mt-2">
//                               <SelectValue placeholder="Select type" />
//                             </SelectTrigger>
//                             <SelectContent>
//                               <SelectItem value="single">Single Product</SelectItem>
//                               <SelectItem value="multi">Multi-Product</SelectItem>
//                               <SelectItem value="event">Event</SelectItem>
//                               <SelectItem value="brand">Brand Promo</SelectItem>
//                               <SelectItem value="announcement">Announcement</SelectItem>
//                             </SelectContent>
//                           </Select>
//                         </div>
//                       </div>
//                     )}

//                     {step === 2 && (
//                       <div className="space-y-6">
//                         <div>
//                           <Label htmlFor="brandName">Brand Name</Label>
//                           <Input
//                             id="brandName"
//                             placeholder="Your Brand"
//                             value={adFormData.brandName}
//                             onChange={(e) => setAdFormData({ ...adFormData, brandName: e.target.value })}
//                             className="mt-2"
//                           />
//                         </div>

//                         <div>
//                           <Label>Logo Upload (Optional)</Label>
//                           <div className="mt-2">
//                             <div className="mt-2 border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
//                               <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
//                               <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
//                               <input
//                                 type="file"
//                                 accept="image/*"
//                                 onChange={(e) => {
//                                   const f = e.target.files ? e.target.files[0] : null;
//                                   if (f) handleAdLogoChange(f);
//                                 }}
//                                 className="mt-3"
//                               />
//                             </div>

//                             <div className="mt-3 flex items-center gap-3">
//                               <div className="w-28 h-20 bg-white border rounded flex items-center justify-center overflow-hidden">
//                                 {adFormData.logoDataUrl ? (
//                                   // eslint-disable-next-line @next/next/no-img-element
//                                   <img src={adFormData.logoDataUrl} alt="logo" className="w-full h-full object-contain" />
//                                 ) : adFormData.logoPublicUrl ? (
//                                   // eslint-disable-next-line @next/next/no-img-element
//                                   <img src={adFormData.logoPublicUrl} alt="logo" className="w-full h-full object-contain" />
//                                 ) : (
//                                   <div className="text-xs text-slate-400">No logo</div>
//                                 )}
//                               </div>
//                               <div>
//                                 <button
//                                   onClick={() => {
//                                     handleAdLogoChange(null);
//                                   }}
//                                   className="px-2 py-1 border rounded text-sm mr-2"
//                                 >
//                                   Remove Upload
//                                 </button>
//                                 <button
//                                   onClick={() => removeAdLogo()}
//                                   className="px-2 py-1 border rounded text-sm"
//                                 >
//                                   Remove Stored Logo
//                                 </button>
//                               </div>
//                             </div>
//                           </div>
//                         </div>

//                         <div>
//                           <Label htmlFor="tagline">Tagline</Label>
//                           <Input
//                             id="tagline"
//                             placeholder="Luxury that feels local."
//                             value={adFormData.tagline}
//                             onChange={(e) => setAdFormData({ ...adFormData, tagline: e.target.value })}
//                             className="mt-2"
//                           />
//                         </div>

//                         <div>
//                           <Label htmlFor="tone">Tone of Voice</Label>
//                           <Select
//                             value={adFormData.tone}
//                             onValueChange={(value) => setAdFormData({ ...adFormData, tone: value })}
//                           >
//                             <SelectTrigger className="mt-2">
//                               <SelectValue placeholder="Select tone" />
//                             </SelectTrigger>
//                             <SelectContent>
//                               <SelectItem value="friendly">Friendly</SelectItem>
//                               <SelectItem value="bold">Bold</SelectItem>
//                               <SelectItem value="professional">Professional</SelectItem>
//                               <SelectItem value="playful">Playful</SelectItem>
//                               <SelectItem value="luxury">Luxury</SelectItem>
//                               <SelectItem value="genz">Gen Z</SelectItem>
//                               <SelectItem value="minimal">Minimal</SelectItem>
//                             </SelectContent>
//                           </Select>
//                         </div>

//                         <div>
//                           <Label htmlFor="primaryCTA">Primary CTA</Label>
//                           <Select
//                             value={adFormData.primaryCTA}
//                             onValueChange={(value) => setAdFormData({ ...adFormData, primaryCTA: value })}
//                           >
//                             <SelectTrigger className="mt-2">
//                               <SelectValue placeholder="Select CTA" />
//                             </SelectTrigger>
//                             <SelectContent>
//                               <SelectItem value="shop">Shop Now</SelectItem>
//                               <SelectItem value="learn">Learn More</SelectItem>
//                               <SelectItem value="book">Book Now</SelectItem>
//                               <SelectItem value="signup">Sign Up</SelectItem>
//                               <SelectItem value="contact">Contact Us</SelectItem>
//                               <SelectItem value="custom">Custom</SelectItem>
//                             </SelectContent>
//                           </Select>
//                         </div>
//                       </div>
//                     )}

//                     {step === 3 && (
//                       <div className="space-y-6">
//                         <div className="flex items-center justify-between">
//                           <Label>Let AI Auto-Target Audience</Label>
//                           <Switch
//                             checked={adFormData.autoTarget}
//                             onCheckedChange={(checked) => setAdFormData({ ...adFormData, autoTarget: checked })}
//                           />
//                         </div>

//                         {!adFormData.autoTarget && (
//                           <>
//                             <div>
//                               <Label htmlFor="location">Location</Label>
//                               <div className="relative mt-2">
//                                 <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//                                 <Input
//                                   id="location"
//                                   placeholder="City, State, or Country"
//                                   value={adFormData.location}
//                                   onChange={(e) => setAdFormData({ ...adFormData, location: e.target.value })}
//                                   className="pl-10"
//                                 />
//                               </div>
//                             </div>

//                             <div>
//                               <Label>Age Range: {adFormData.ageRange[0]} - {adFormData.ageRange[1]}</Label>
//                               <Slider
//                                 value={adFormData.ageRange}
//                                 onValueChange={(value) => setAdFormData({ ...adFormData, ageRange: value as [number, number] })}
//                                 min={18}
//                                 max={65}
//                                 step={1}
//                                 className="mt-4"
//                               />
//                             </div>

//                             <div>
//                               <Label>Gender</Label>
//                               <div className="flex gap-2 mt-2">
//                                 {["All", "Male", "Female", "Custom"].map((g) => (
//                                   <Button
//                                     key={g}
//                                     variant={adFormData.gender === g.toLowerCase() ? "default" : "outline"}
//                                     onClick={() => setAdFormData({ ...adFormData, gender: g.toLowerCase() })}
//                                     size="sm"
//                                   >
//                                     {g}
//                                   </Button>
//                                 ))}
//                               </div>
//                             </div>
//                           </>
//                         )}
//                       </div>
//                     )}

//                     {step === 4 && (
//                       <div className="space-y-6">
//                         <div>
//                           <Label>Budget Type</Label>
//                           <div className="flex gap-4 mt-2">
//                             {["daily", "lifetime"].map((type) => (
//                               <Button
//                                 key={type}
//                                 variant={adFormData.budgetType === type ? "default" : "outline"}
//                                 onClick={() => setAdFormData({ ...adFormData, budgetType: type })}
//                                 className="flex-1 capitalize"
//                               >
//                                 {type}
//                               </Button>
//                             ))}
//                           </div>
//                         </div>

//                         <div>
//                           <Label>Budget: ₹{adFormData.budget.toLocaleString()}</Label>
//                           <Slider
//                             value={[adFormData.budget]}
//                             onValueChange={(value) => setAdFormData({ ...adFormData, budget: value[0] })}
//                             min={500}
//                             max={500000}
//                             step={500}
//                             className="mt-4"
//                           />
//                         </div>

//                         <div className="grid grid-cols-2 gap-4">
//                           <div>
//                             <Label htmlFor="startDate">Start Date</Label>
//                             <Input
//                               id="startDate"
//                               type="date"
//                               value={adFormData.startDate}
//                               onChange={(e) => setAdFormData({ ...adFormData, startDate: e.target.value })}
//                               className="mt-2"
//                             />
//                           </div>
//                           <div>
//                             <Label htmlFor="endDate">End Date</Label>
//                             <Input
//                               id="endDate"
//                               type="date"
//                               value={adFormData.endDate}
//                               onChange={(e) => setAdFormData({ ...adFormData, endDate: e.target.value })}
//                               className="mt-2"
//                             />
//                           </div>
//                         </div>

//                         <div className="flex items-center justify-between">
//                           <Label>Auto-optimize Spend</Label>
//                           <Switch
//                             checked={adFormData.autoOptimize}
//                             onCheckedChange={(checked) => setAdFormData({ ...adFormData, autoOptimize: checked })}
//                           />
//                         </div>
//                       </div>
//                     )}

//                     {step === 5 && (
//                       <div className="space-y-6">
//                         <div>
//                           <Label htmlFor="description">Campaign Description</Label>
//                           <Textarea
//                             id="description"
//                             placeholder="Promoting our Diwali discounts on home decor products in Chennai."
//                             value={adFormData.description}
//                             onChange={(e) => setAdFormData({ ...adFormData, description: e.target.value })}
//                             rows={4}
//                             className="mt-2"
//                           />
//                         </div>

//                         <div>
//                           <Button
//                             variant="outline"
//                             onClick={() => generateCaption(adFormData.description || adFormData.campaignName || "Write a campaign description", (text) => {
//                               setAdFormData((p) => ({ ...p, description: text }));
//                             })}
//                           >
//                             <Sparkles className="h-4 w-4 mr-2" />
//                             AI Assist Description
//                           </Button>
//                         </div>

//                         <div>
//                           <Label htmlFor="emotion">Emotion / Vibe</Label>
//                           <Select
//                             value={adFormData.emotion}
//                             onValueChange={(value) => setAdFormData({ ...adFormData, emotion: value })}
//                           >
//                             <SelectTrigger className="mt-2">
//                               <SelectValue placeholder="Select emotion" />
//                             </SelectTrigger>
//                             <SelectContent>
//                               <SelectItem value="festive">Festive</SelectItem>
//                               <SelectItem value="aspirational">Aspirational</SelectItem>
//                               <SelectItem value="witty">Witty</SelectItem>
//                               <SelectItem value="premium">Premium</SelectItem>
//                               <SelectItem value="casual">Casual</SelectItem>
//                             </SelectContent>
//                           </Select>
//                         </div>

//                         <div>
//                           <Label htmlFor="offerInfo">Offer Info</Label>
//                           <Input
//                             id="offerInfo"
//                             placeholder="Use code DIWALI20 for 20% off"
//                             value={adFormData.offerInfo}
//                             onChange={(e) => setAdFormData({ ...adFormData, offerInfo: e.target.value })}
//                             className="mt-2"
//                           />
//                         </div>

//                         <div className="flex items-center justify-between">
//                           <Label>Generate Multiple Variations</Label>
//                           <Switch
//                             checked={adFormData.multipleVariations}
//                             onCheckedChange={(checked) => setAdFormData({ ...adFormData, multipleVariations: checked })}
//                           />
//                         </div>
//                       </div>
//                     )}

//                     {step === 6 && (
//                       <div className="space-y-6">
//                         <div className="p-6 bg-muted/50 rounded-xl space-y-4">
//                           <h3 className="font-semibold text-lg">Campaign Summary</h3>
//                           <div className="grid grid-cols-2 gap-4 text-sm">
//                             <div>
//                               <span className="text-muted-foreground">Campaign:</span>
//                               <p className="font-medium">{adFormData.campaignName || "Untitled"}</p>
//                             </div>
//                             <div>
//                               <span className="text-muted-foreground">Objective:</span>
//                               <p className="font-medium">{adFormData.objective || "Not set"}</p>
//                             </div>
//                             <div>
//                               <span className="text-muted-foreground">Platforms:</span>
//                               <p className="font-medium">{adFormData.platforms.join(", ") || "None"}</p>
//                             </div>
//                             <div>
//                               <span className="text-muted-foreground">Budget:</span>
//                               <p className="font-medium">₹{adFormData.budget.toLocaleString()} / {adFormData.budgetType}</p>
//                             </div>
//                           </div>
//                         </div>

//                         <div className="p-6 bg-primary/5 rounded-xl border border-primary/20">
//                           <h4 className="font-semibold mb-2 flex items-center gap-2">
//                             <CheckCircle2 className="h-5 w-5 text-primary" />
//                             Ready to Generate
//                           </h4>
//                           <p className="text-sm text-muted-foreground">
//                             AI will create optimized ad copies, visuals, and targeting recommendations based on your inputs.
//                           </p>

//                           <div className="mt-4 flex gap-3">
//                             <Button onClick={handleGenerateCampaign} className="bg-blue-600 text-white">
//                               Generate & Preview
//                             </Button>
//                             <Button onClick={() => postAdToFacebook()} variant="outline">
//                               Create Ad (Facebook)
//                             </Button>
//                           </div>
//                         </div>
//                       </div>
//                     )}
//                   </>
//                 ) : (
//                   <>
//                     {/* POST GENERATION FLOW */}
//                     {step === 1 && (
//                       <div className="space-y-6">
//                         <div>
//                           <Label htmlFor="postName">Post Name</Label>
//                           <Input
//                             id="postName"
//                             placeholder="Summer Collection Launch"
//                             value={postFormData.postName}
//                             onChange={(e) => setPostFormData({ ...postFormData, postName: e.target.value })}
//                             className="mt-2"
//                           />
//                         </div>

//                         <div>
//                           <Label>Platform Selection</Label>
//                           <div className="flex flex-wrap gap-2 mt-2">
//                             {["Instagram", "Facebook"].map((platform) => (
//                               <Badge
//                                 key={platform}
//                                 variant={postFormData.platforms.includes(platform) ? "default" : "outline"}
//                                 className="cursor-pointer px-4 py-2"
//                                 onClick={() => {
//                                   const newPlatforms = postFormData.platforms.includes(platform)
//                                     ? postFormData.platforms.filter((p) => p !== platform)
//                                     : [...postFormData.platforms, platform];
//                                   setPostFormData({ ...postFormData, platforms: newPlatforms });
//                                 }}
//                               >
//                                 {platform}
//                               </Badge>
//                             ))}
//                           </div>
//                         </div>

//                         <div>
//                           <Label htmlFor="postType">Post Type</Label>
//                           <Select
//                             value={postFormData.postType}
//                             onValueChange={(value) => setPostFormData({ ...postFormData, postType: value })}
//                           >
//                             <SelectTrigger className="mt-2">
//                               <SelectValue placeholder="Select type" />
//                             </SelectTrigger>
//                             <SelectContent>
//                               <SelectItem value="image">Image</SelectItem>
//                               <SelectItem value="carousel">Carousel</SelectItem>
//                               <SelectItem value="video">Video</SelectItem>
//                               <SelectItem value="story">Story</SelectItem>
//                               <SelectItem value="text">Text</SelectItem>
//                             </SelectContent>
//                           </Select>
//                         </div>

//                         <div>
//                           <Label htmlFor="goal">Goal</Label>
//                           <Select
//                             value={postFormData.goal}
//                             onValueChange={(value) => setPostFormData({ ...postFormData, goal: value })}
//                           >
//                             <SelectTrigger className="mt-2">
//                               <SelectValue placeholder="Select goal" />
//                             </SelectTrigger>
//                             <SelectContent>
//                               <SelectItem value="engagement">Engagement</SelectItem>
//                               <SelectItem value="awareness">Awareness</SelectItem>
//                               <SelectItem value="announcement">Announcement</SelectItem>
//                               <SelectItem value="product">Product Highlight</SelectItem>
//                             </SelectContent>
//                           </Select>
//                         </div>

//                         <div>
//                           <Label>Upload Assets (Optional)</Label>
//                           <div className="mt-2 border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
//                             <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
//                             <p className="text-sm text-muted-foreground">Click to upload images or videos</p>
//                           </div>
//                         </div>
//                       </div>
//                     )}

//                     {step === 2 && (
//                       <div className="space-y-6">
//                         <div>
//                           <Label htmlFor="brandName">Brand Name</Label>
//                           <Input
//                             id="brandName"
//                             placeholder="Your Brand"
//                             value={postFormData.brandName}
//                             onChange={(e) => setPostFormData({ ...postFormData, brandName: e.target.value })}
//                             className="mt-2"
//                           />
//                         </div>

//                         <div>
//                           <Label>Logo (Optional)</Label>
//                           <div className="mt-2 border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
//                             <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
//                             <p className="text-sm text-muted-foreground">Upload your logo</p>
//                             <input
//                               type="file"
//                               accept="image/*"
//                               onChange={(e) => {
//                                 const f = e.target.files ? e.target.files[0] : null;
//                                 if (f) handlePostLogoChange(f);
//                               }}
//                               className="mt-3"
//                             />
//                           </div>

//                           <div className="mt-3 flex items-center gap-3">
//                             <div className="w-28 h-20 bg-white border rounded flex items-center justify-center overflow-hidden">
//                               {postFormData.logoDataUrl ? (
//                                 // eslint-disable-next-line @next/next/no-img-element
//                                 <img src={postFormData.logoDataUrl} alt="logo" className="w-full h-full object-contain" />
//                               ) : postFormData.logoPublicUrl ? (
//                                 // eslint-disable-next-line @next/next/no-img-element
//                                 <img src={postFormData.logoPublicUrl} alt="logo" className="w-full h-full object-contain" />
//                               ) : (
//                                 <div className="text-xs text-slate-400">No logo</div>
//                               )}
//                             </div>
//                             <div>
//                               <button
//                                 onClick={() => handlePostLogoChange(null)}
//                                 className="px-2 py-1 border rounded text-sm mr-2"
//                               >
//                                 Remove Upload
//                               </button>
//                               <button
//                                 onClick={() => removePostLogo()}
//                                 className="px-2 py-1 border rounded text-sm"
//                               >
//                                 Remove Stored Logo
//                               </button>
//                             </div>
//                           </div>
//                         </div>

//                         <div>
//                           <Label htmlFor="tone">Tone of Voice</Label>
//                           <Select
//                             value={postFormData.tone}
//                             onValueChange={(value) => setPostFormData({ ...postFormData, tone: value })}
//                           >
//                             <SelectTrigger className="mt-2">
//                               <SelectValue placeholder="Select tone" />
//                             </SelectTrigger>
//                             <SelectContent>
//                               <SelectItem value="friendly">Friendly</SelectItem>
//                               <SelectItem value="bold">Bold</SelectItem>
//                               <SelectItem value="playful">Playful</SelectItem>
//                               <SelectItem value="minimal">Minimal</SelectItem>
//                               <SelectItem value="luxury">Luxury</SelectItem>
//                             </SelectContent>
//                           </Select>
//                         </div>

//                         <div>
//                           <Label htmlFor="primaryCTA">Primary CTA (Optional)</Label>
//                           <Input
//                             id="primaryCTA"
//                             placeholder="Shop Now, Learn More, etc."
//                             value={postFormData.primaryCTA}
//                             onChange={(e) => setPostFormData({ ...postFormData, primaryCTA: e.target.value })}
//                             className="mt-2"
//                           />
//                         </div>

//                         <div>
//                           <Label htmlFor="hashtags">Hashtag Suggestions</Label>
//                           <div className="flex gap-2 mt-2">
//                             <Input
//                               id="hashtags"
//                               placeholder="#fashion #style #trending"
//                               value={postFormData.hashtags}
//                               onChange={(e) => setPostFormData({ ...postFormData, hashtags: e.target.value })}
//                             />
//                             <Button variant="outline" onClick={handleGenerateHashtags}>
//                               <Sparkles className="h-4 w-4 mr-2" />
//                               AI Generate
//                             </Button>
//                           </div>
//                         </div>
//                       </div>
//                     )}

//                     {step === 3 && (
//                       <div className="space-y-6">
//                         <div>
//                           <Label htmlFor="prompt">Describe your post or campaign idea</Label>
//                           <Textarea
//                             id="prompt"
//                             placeholder="Create an engaging post about our new summer collection launch. Focus on vibrant colors and beach vibes..."
//                             value={postFormData.prompt}
//                             onChange={(e) => setPostFormData({ ...postFormData, prompt: e.target.value })}
//                             rows={6}
//                             className="mt-2"
//                           />
//                         </div>

//                         <div className="flex items-center justify-between">
//                           <Label>Generate multiple versions</Label>
//                           <Switch
//                             checked={postFormData.multipleVersions}
//                             onCheckedChange={(checked) => setPostFormData({ ...postFormData, multipleVersions: checked })}
//                           />
//                         </div>

//                         <div className="p-6 bg-muted/50 rounded-xl">
//                           <h4 className="font-semibold mb-3">AI Generated Caption Preview</h4>
//                           <div className="space-y-3">
//                             <p className="text-sm text-muted-foreground">
//                               {postFormData.generatedCaption || "Your AI-generated caption will appear here after generation..."}
//                             </p>
//                           </div>
//                         </div>

//                         <Button className="w-full" size="lg" onClick={handleGeneratePostCaption}>
//                           <Sparkles className="h-5 w-5 mr-2" />
//                           Generate Post Caption
//                         </Button>
//                       </div>
//                     )}

//                     {step === 4 && (
//                       <div className="space-y-6">
//                         <div className="p-6 bg-muted/50 rounded-xl space-y-4">
//                           <h3 className="font-semibold text-lg">Post Summary</h3>
//                           <div className="grid grid-cols-2 gap-4 text-sm">
//                             <div>
//                               <span className="text-muted-foreground">Post Name:</span>
//                               <p className="font-medium">{postFormData.postName || "Untitled"}</p>
//                             </div>
//                             <div>
//                               <span className="text-muted-foreground">Platforms:</span>
//                               <p className="font-medium">{postFormData.platforms.join(", ") || "None"}</p>
//                             </div>
//                             <div>
//                               <span className="text-muted-foreground">Post Type:</span>
//                               <p className="font-medium">{postFormData.postType || "Not set"}</p>
//                             </div>
//                             <div>
//                               <span className="text-muted-foreground">Goal:</span>
//                               <p className="font-medium">{postFormData.goal || "Not set"}</p>
//                             </div>
//                           </div>
//                         </div>

//                         <div className="p-6 bg-primary/5 rounded-xl border border-primary/20">
//                           <h4 className="font-semibold mb-3">Post Preview</h4>
//                           <div className="bg-background rounded-lg p-4 mb-4">
//                             <p className="text-sm">
//                               {postFormData.generatedCaption || "Your generated post caption will display here..."}
//                             </p>
//                           </div>
//                           <div className="flex gap-2">
//                             <Button variant="outline" className="flex-1" onClick={() => {
//                               navigator.clipboard?.writeText(postFormData.generatedCaption || "");
//                               toast.success("Copied caption");
//                             }}>
//                               Copy Caption
//                             </Button>
//                             <Button variant="outline" className="flex-1">
//                               Download Asset
//                             </Button>
//                             <Button variant="outline" className="flex-1" onClick={() => saveDraft({ mode: "post", postName: postFormData.postName, inputs: postFormData })}>
//                               Save Template
//                             </Button>
//                           </div>
//                         </div>
//                       </div>
//                     )}
//                   </>
//                 )}
//               </Card>
//             </div>

//             {/* Live Preview Panel (kept but simple — no dynamic "generated image" preview) */}
//             <div className="lg:col-span-1">
//               <Card className="glass-card p-6 rounded-2xl border-border/50 sticky top-32">
//                 <h3 className="font-semibold mb-4">Live Preview</h3>
//                 <div className="space-y-4">
//                   <div className="aspect-square bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center">
//                     <p className="text-sm text-muted-foreground">{mode === "ad" ? "Ad" : "Post"} Preview</p>
//                   </div>
//                   <div className="space-y-2 text-sm">
//                     {mode === "ad" ? (
//                       <>
//                         <div className="flex justify-between">
//                           <span className="text-muted-foreground">Campaign:</span>
//                           <span className="font-medium">{adFormData.campaignName || "—"}</span>
//                         </div>
//                         <div className="flex justify-between">
//                           <span className="text-muted-foreground">Platforms:</span>
//                           <span className="font-medium">{adFormData.platforms.length || 0}</span>
//                         </div>
//                         <div className="flex justify-between">
//                           <span className="text-muted-foreground">Budget:</span>
//                           <span className="font-medium">₹{adFormData.budget.toLocaleString()}</span>
//                         </div>
//                       </>
//                     ) : (
//                       <>
//                         <div className="flex justify-between">
//                           <span className="text-muted-foreground">Post:</span>
//                           <span className="font-medium">{postFormData.postName || "—"}</span>
//                         </div>
//                         <div className="flex justify-between">
//                           <span className="text-muted-foreground">Platforms:</span>
//                           <span className="font-medium">{postFormData.platforms.length || 0}</span>
//                         </div>
//                         <div className="flex justify-between">
//                           <span className="text-muted-foreground">Type:</span>
//                           <span className="font-medium">{postFormData.postType || "—"}</span>
//                         </div>
//                       </>
//                     )}
//                   </div>
//                 </div>
//               </Card>
//             </div>
//           </div>
//         </div>

//         {/* Sticky Bottom Navigation */}
//         <div className="sticky bottom-0 z-50 backdrop-blur-xl bg-background/80 border-t border-border/50">
//           <div className="max-w-7xl mx-auto px-6 py-4">
//             <div className="flex items-center justify-between">
//               <Button
//                 variant="ghost"
//                 onClick={() => (step > 1 ? setStep(step - 1) : router.push("/campaigns"))}
//                 size="lg"
//               >
//                 <ArrowLeft className="mr-2 h-5 w-5" />
//                 {step === 1 ? "Cancel" : "Back"}
//               </Button>

//               <div className="flex gap-3">
//                 <Button variant="outline" size="lg" onClick={handleSaveAsDraft}>
//                   Save as Draft
//                 </Button>
//                 {step < totalSteps ? (
//                   <Button onClick={handleNext} size="lg" className="min-w-[140px]">
//                     Next
//                     <ArrowRight className="ml-2 h-5 w-5" />
//                   </Button>
//                 ) : (
//                   <Button onClick={handleNext} size="lg" className="min-w-[140px]">
//                     <CheckCircle2 className="mr-2 h-5 w-5" />
//                     {mode === "ad" ? "Generate Campaign" : "Publish Post"}
//                   </Button>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Floating AI Help */}
//         <button
//           className="fixed bottom-24 right-8 w-14 h-14 bg-gradient-to-r from-primary to-secondary rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-50"
//           aria-label="AI help"
//         >
//           <MessageCircle className="h-6 w-6 text-primary-foreground" />
//         </button>
//       </div>
//     </div>
//   );
// };

// export default CampaignCreate;
