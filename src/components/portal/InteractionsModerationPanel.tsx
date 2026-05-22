import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Star, Check, X, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  flyerId: string;
  isOwner: boolean;
}

interface Testimonial { id: string; name: string | null; rating: number | null; body: string | null; photo_url: string | null; status: string; created_at: string; }
interface Reservation { id: string; name: string; email: string | null; phone: string | null; reserve_at: string; party_size: number; notes: string | null; status: string; created_at: string; }
interface Participant { id: string; name: string; email: string; phone: string | null; created_at: string; }
interface SurveyResp { id: string; answers: any; session_id: string | null; created_at: string; }
interface Rating { id: string; stars: number; comment: string | null; session_id: string; created_at: string; }

function csv(rows: any[], cols: string[]): string {
  const esc = (v: any) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function InteractionsModerationPanel({ flyerId, isOwner }: Props) {
  const [loading, setLoading] = useState(true);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [surveys, setSurveys] = useState<SurveyResp[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);

  async function load() {
    setLoading(true);
    const [t, r, p, s, rt] = await Promise.all([
      supabase.from("testimonials").select("*").eq("flyer_id", flyerId).order("created_at", { ascending: false }),
      supabase.from("table_reservations").select("*").eq("flyer_id", flyerId).order("reserve_at", { ascending: true }),
      supabase.from("challenge_participants").select("*").eq("flyer_id", flyerId).order("created_at", { ascending: false }),
      supabase.from("survey_responses").select("*").eq("flyer_id", flyerId).order("created_at", { ascending: false }),
      supabase.from("business_ratings").select("*").eq("flyer_id", flyerId).order("created_at", { ascending: false }),
    ]);
    setTestimonials((t.data as any) || []);
    setReservations((r.data as any) || []);
    setParticipants((p.data as any) || []);
    setSurveys((s.data as any) || []);
    setRatings((rt.data as any) || []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [flyerId]);

  async function setTestimonialStatus(id: string, status: "approved" | "rejected") {
    const prev = testimonials;
    setTestimonials((arr) => arr.map((t) => t.id === id ? { ...t, status } : t));
    const { error } = await supabase.from("testimonials").update({ status }).eq("id", id);
    if (error) { setTestimonials(prev); toast.error(error.message); return; }
    toast.success(status === "approved" ? "Approved" : "Rejected");
  }
  async function deleteTestimonial(id: string) {
    if (!confirm("Delete this testimonial?")) return;
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setTestimonials((arr) => arr.filter((t) => t.id !== id));
  }
  async function updateReservation(id: string, status: string) {
    const prev = reservations;
    setReservations((arr) => arr.map((r) => r.id === id ? { ...r, status } : r));
    const { error } = await supabase.from("table_reservations").update({ status }).eq("id", id);
    if (error) { setReservations(prev); toast.error(error.message); return; }
  }

  const avgRating = useMemo(() => {
    if (ratings.length === 0) return 0;
    return ratings.reduce((s, r) => s + r.stars, 0) / ratings.length;
  }, [ratings]);

  const ratingDist = useMemo(() => {
    const d = [0, 0, 0, 0, 0];
    for (const r of ratings) if (r.stars >= 1 && r.stars <= 5) d[r.stars - 1]++;
    return d;
  }, [ratings]);

  const pendingCount = testimonials.filter((t) => t.status === "pending").length;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      <Tabs defaultValue="testimonials">
        <TabsList className="flex-wrap">
          <TabsTrigger value="testimonials">
            Testimonials ({testimonials.length}){pendingCount > 0 && <Badge variant="destructive" className="ml-2">{pendingCount} pending</Badge>}
          </TabsTrigger>
          <TabsTrigger value="reservations">Reservations ({reservations.length})</TabsTrigger>
          <TabsTrigger value="challenges">Challenges ({participants.length})</TabsTrigger>
          <TabsTrigger value="surveys">Survey Responses ({surveys.length})</TabsTrigger>
          <TabsTrigger value="ratings">Business Rating ({ratings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="testimonials" className="space-y-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Testimonials moderation</CardTitle></CardHeader>
            <CardContent>
              {testimonials.length === 0 ? (
                <p className="text-sm text-muted-foreground">No testimonials yet.</p>
              ) : (
                <div className="space-y-2">
                  {testimonials.map((t) => (
                    <div key={t.id} className="rounded border border-border p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {t.photo_url && <img src={t.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />}
                            <span className="font-medium">{t.name || "Anonymous"}</span>
                            {t.rating != null && (
                              <span className="flex items-center text-yellow-500">
                                {Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
                              </span>
                            )}
                            <Badge variant={t.status === "approved" ? "default" : t.status === "rejected" ? "destructive" : "secondary"}>
                              {t.status}
                            </Badge>
                          </div>
                          {t.body && <p className="mt-1 text-muted-foreground italic">"{t.body}"</p>}
                          <p className="mt-1 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                        </div>
                        {isOwner && (
                          <div className="flex flex-col gap-1">
                            {t.status !== "approved" && (
                              <Button size="sm" variant="outline" onClick={() => setTestimonialStatus(t.id, "approved")}>
                                <Check className="h-3 w-3 mr-1" /> Approve
                              </Button>
                            )}
                            {t.status !== "rejected" && (
                              <Button size="sm" variant="outline" onClick={() => setTestimonialStatus(t.id, "rejected")}>
                                <X className="h-3 w-3 mr-1" /> Reject
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => deleteTestimonial(t.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservations" className="space-y-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm">Table reservations</CardTitle>
              <Button size="sm" variant="outline" disabled={reservations.length === 0}
                onClick={() => download("reservations.csv", csv(reservations, ["reserve_at","party_size","name","email","phone","notes","status","created_at"]))}>
                <Download className="mr-1 h-3 w-3" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {reservations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reservations yet.</p>
              ) : (
                <div className="space-y-2">
                  {reservations.map((r) => (
                    <div key={r.id} className="rounded border border-border p-2 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">
                            {new Date(r.reserve_at).toLocaleString()} · Party of {r.party_size}
                            <Badge variant={r.status === "cancelled" ? "destructive" : "secondary"} className="ml-2">{r.status}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.name} {r.email && `· ${r.email}`} {r.phone && `· ${r.phone}`}
                          </div>
                          {r.notes && <div className="text-xs italic text-muted-foreground mt-1">"{r.notes}"</div>}
                        </div>
                        {isOwner && r.status !== "cancelled" && (
                          <Button size="sm" variant="ghost" onClick={() => updateReservation(r.id, "cancelled")}>Cancel</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="challenges" className="space-y-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm">Challenge participants</CardTitle>
              <Button size="sm" variant="outline" disabled={participants.length === 0}
                onClick={() => download("participants.csv", csv(participants, ["name","email","phone","created_at"]))}>
                <Download className="mr-1 h-3 w-3" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No participants yet.</p>
              ) : (
                <div className="space-y-1">
                  {participants.map((p) => (
                    <div key={p.id} className="text-sm">
                      <span className="font-medium">{p.name}</span> · {p.email}
                      {p.phone && ` · ${p.phone}`}
                      <span className="ml-2 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="surveys" className="space-y-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm">Survey responses</CardTitle>
              <Button size="sm" variant="outline" disabled={surveys.length === 0}
                onClick={() => download("surveys.csv", csv(
                  surveys.map((s) => ({ created_at: s.created_at, session_id: s.session_id, answers: JSON.stringify(s.answers) })),
                  ["created_at","session_id","answers"]
                ))}>
                <Download className="mr-1 h-3 w-3" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {surveys.length === 0 ? (
                <p className="text-sm text-muted-foreground">No survey responses yet.</p>
              ) : (
                <div className="space-y-2">
                  {surveys.map((s) => (
                    <div key={s.id} className="rounded border border-border p-2 text-xs">
                      <div className="font-mono text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                      <div className="mt-1 space-y-1">
                        {Object.entries(s.answers || {}).map(([q, a]) => (
                          <div key={q}>
                            <span className="font-medium">{q}:</span>{" "}
                            <span className="text-muted-foreground">{typeof a === "object" ? JSON.stringify(a) : String(a)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ratings" className="space-y-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Business rating summary</CardTitle></CardHeader>
            <CardContent>
              {ratings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ratings yet.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-bold">{avgRating.toFixed(1)}</div>
                    <div>
                      <div className="flex text-yellow-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < Math.round(avgRating) ? "fill-current" : ""}`} />
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">{ratings.length} rating{ratings.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const c = ratingDist[star - 1];
                      const pct = ratings.length ? (c / ratings.length) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-2 text-xs">
                          <span className="w-6">{star}★</span>
                          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-yellow-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-10 text-right tabular-nums">{c}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="text-xs font-medium text-muted-foreground">Recent comments</div>
                    {ratings.filter((r) => r.comment).slice(0, 20).map((r) => (
                      <div key={r.id} className="rounded border border-border p-2 text-xs">
                        <div className="flex items-center gap-1 text-yellow-500">
                          {Array.from({ length: r.stars }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
                          <span className="ml-2 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="mt-1 italic">"{r.comment}"</p>
                      </div>
                    ))}
                    {ratings.filter((r) => r.comment).length === 0 && (
                      <p className="text-xs text-muted-foreground">No written comments.</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
