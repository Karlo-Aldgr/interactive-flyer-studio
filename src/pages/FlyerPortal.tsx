import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Appointment {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  note: string | null;
  start_at: string;
  end_at: string;
  timezone: string | null;
  status: "confirmed" | "cancelled";
  metadata: any;
  created_at: string;
}

interface Subscriber {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  list_name: string | null;
  created_at: string;
}

interface FormSubmission {
  id: string;
  data: any;
  created_at: string;
}

function csv(rows: any[], cols: string[]): string {
  const esc = (v: any) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function downloadCsv(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FlyerPortal() {
  const { flyerId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [flyerTitle, setFlyerTitle] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [search, setSearch] = useState("");
  const [calDate, setCalDate] = useState<Date | undefined>();

  useEffect(() => {
    if (!user || !flyerId) return;
    (async () => {
      setLoading(true);
      const { data: flyer } = await supabase
        .from("flyers")
        .select("id, title, owner_id")
        .eq("id", flyerId)
        .maybeSingle();

      if (!flyer || flyer.owner_id !== user.id) {
        // Allow admins
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!roles) {
          setAuthorized(false);
          setLoading(false);
          return;
        }
      }
      setAuthorized(true);
      setFlyerTitle(flyer?.title || "Flyer");

      const [{ data: ap }, { data: sub }, { data: sm }] = await Promise.all([
        supabase
          .from("appointments")
          .select("*")
          .eq("flyer_id", flyerId)
          .order("start_at", { ascending: true }),
        supabase
          .from("subscribers")
          .select("*")
          .eq("flyer_id", flyerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("form_submissions")
          .select("*")
          .eq("flyer_id", flyerId)
          .order("created_at", { ascending: false }),
      ]);

      setAppointments((ap as Appointment[]) || []);
      setSubscribers((sub as Subscriber[]) || []);
      setSubmissions((sm as FormSubmission[]) || []);
      setLoading(false);
    })();
  }, [user, flyerId]);

  async function cancelAppointment(id: string) {
    if (!confirm("Cancel this appointment?")) return;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setAppointments((arr) => arr.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)));
    toast.success("Cancelled");
  }

  if (!user) return <div className="p-8">Please sign in.</div>;
  if (loading) return <div className="flex items-center gap-2 p-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!authorized) return <div className="p-8 text-destructive">Not authorized.</div>;

  const filtered = (arr: any[]) =>
    arr.filter((r) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return [r.name, r.email, r.phone, r.note]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s));
    });

  const apptDays = new Set(
    appointments
      .filter((a) => a.status === "confirmed")
      .map((a) => new Date(a.start_at).toDateString())
  );

  const apptsForCalDate = calDate
    ? appointments.filter((a) => new Date(a.start_at).toDateString() === calDate.toDateString())
    : [];

  return (
    <div className="container mx-auto max-w-6xl space-y-4 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to={`/editor/${flyerId}`}><ChevronLeft className="mr-1 h-4 w-4" /> Editor</Link>
          </Button>
          <h1 className="text-xl font-semibold">{flyerTitle} — Portal</h1>
        </div>
        <Input
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Tabs defaultValue="appointments">
        <TabsList>
          <TabsTrigger value="appointments">Appointments ({appointments.length})</TabsTrigger>
          <TabsTrigger value="subscribers">Subscribers ({subscribers.length})</TabsTrigger>
          <TabsTrigger value="forms">Form submissions ({submissions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[auto_1fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={calDate}
                  onSelect={setCalDate}
                  modifiers={{ booked: (d) => apptDays.has(d.toDateString()) }}
                  modifiersClassNames={{ booked: "bg-primary/20 font-bold" }}
                />
                {calDate && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium">{calDate.toDateString()}</p>
                    {apptsForCalDate.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No appointments.</p>
                    ) : (
                      apptsForCalDate.map((a) => (
                        <div key={a.id} className="text-xs">
                          {new Date(a.start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {a.name || a.email}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">All bookings</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      "appointments.csv",
                      csv(
                        appointments.map((a) => ({
                          start_at: a.start_at,
                          end_at: a.end_at,
                          name: a.name,
                          email: a.email,
                          phone: a.phone,
                          note: a.note,
                          status: a.status,
                          timezone: a.timezone,
                        })),
                        ["start_at", "end_at", "name", "email", "phone", "note", "status", "timezone"]
                      )
                    )
                  }
                >
                  <Download className="mr-1 h-3 w-3" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                {appointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No appointments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {filtered(appointments).map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded border border-border p-2 text-sm">
                        <div>
                          <div className="font-medium">
                            {new Date(a.start_at).toLocaleString()} {" "}
                            {a.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {a.name || "—"} · {a.email} {a.phone && `· ${a.phone}`}
                          </div>
                          {a.note && <div className="text-xs italic text-muted-foreground">"{a.note}"</div>}
                        </div>
                        {a.status === "confirmed" && (
                          <Button size="sm" variant="ghost" onClick={() => cancelAppointment(a.id)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subscribers" className="space-y-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Subscribers</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadCsv(
                    "subscribers.csv",
                    csv(subscribers, ["created_at", "name", "email", "phone", "list_name"])
                  )
                }
              >
                <Download className="mr-1 h-3 w-3" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {subscribers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subscribers yet.</p>
              ) : (
                <div className="space-y-1">
                  {filtered(subscribers).map((s) => (
                    <div key={s.id} className="text-sm">
                      <span className="font-medium">{s.name || "—"}</span> · {s.email} {s.phone && `· ${s.phone}`}
                      {s.list_name && <Badge variant="secondary" className="ml-2">{s.list_name}</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forms" className="space-y-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Form submissions</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadCsv(
                    "submissions.csv",
                    csv(
                      submissions.map((s) => ({
                        created_at: s.created_at,
                        ...s.data,
                      })),
                      Array.from(
                        new Set([
                          "created_at",
                          ...submissions.flatMap((s) => Object.keys(s.data || {})),
                        ])
                      )
                    )
                  )
                }
              >
                <Download className="mr-1 h-3 w-3" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No submissions yet.</p>
              ) : (
                <div className="space-y-2">
                  {submissions.map((s) => (
                    <div key={s.id} className="rounded border border-border p-2 text-xs">
                      <div className="font-mono text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                      <pre className="mt-1 whitespace-pre-wrap break-words">{JSON.stringify(s.data, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
