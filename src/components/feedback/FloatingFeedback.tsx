
import React from "react";
import { useLocation } from "react-router-dom";
import { Plus, MessageSquare } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const FloatingFeedback: React.FC = () => {
  const { pathname } = useLocation();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pagePath = pathname || "/";
  const pageUrl = typeof window !== "undefined" ? window.location.href : pagePath;
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";

  const canSubmit = feedback.trim().length >= 5 && !submitting;

  const handleSubmit = async () => {
    setError(null);
    if (!canSubmit) {
      setError("Please enter at least 5 characters.");
      return;
    }
    setSubmitting(true);
    console.log("[Feedback] Submitting RPC payload", {
      page_path: pagePath,
      page_url: pageUrl,
      user_agent: userAgent,
      email: email || null,
      feedback_text: feedback.trim(),
    });

    const { data, error } = await supabase.rpc("submit_feedback", {
      page_path: pagePath,
      feedback_text: feedback.trim(),
      email: email || null,
      page_url: pageUrl,
      user_agent: userAgent,
    });

    console.log("[Feedback] RPC result", { data, error });

    if (error) {
      setError(error.message || "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    toast({
      title: "Thank you!",
      description: "Your feedback has been submitted.",
    });

    // Reset and close
    setFeedback("");
    setEmail("");
    setSubmitting(false);
    setOpen(false);
  };

  return (
    <>
      {/* Floating + button (Orbit-themed) */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            aria-label="Open feedback"
            className="fixed bottom-5 right-5 z-50 rounded-full shadow-lg ring-1 ring-border
                       bg-gradient-to-br from-primary to-primary/80 text-primary-foreground
                       hover:opacity-95 transition focus:outline-none focus:ring-2 focus:ring-ring
                       w-14 h-14 flex items-center justify-center"
          >
            <Plus className="h-6 w-6" />
          </button>
        </SheetTrigger>

        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Share feedback
            </SheetTitle>
            <SheetDescription>
              Help us improve Orbit. This will include the page you’re on and basic browser info.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your feedback</label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What’s working well? What could be better?"
                className="min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 5 characters. We read every submission.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email (optional)</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If you’re not signed in, add your email in case we need to follow up.
              </p>
            </div>

            <div className="space-y-1 rounded-md bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Context: <span className="font-medium">{pagePath}</span>
              </p>
            </div>

            {error && (
              <div className="text-sm text-destructive" role="alert">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground pt-2">
              By submitting, you agree to our privacy policy.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default FloatingFeedback;
