"use client";
import React, { useMemo, useState } from "react";
import { MapPin, Smile, Frown, TrendingUp, ArrowDownCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";

/** ===== Minimal UI (no Tailwind/shadcn) ===== */
function Card({ title, children, style }) {
  return (
    <div style={{
      background:"#fff", border:"1px solid #E5E7EB", borderRadius:12,
      boxShadow:"0 8px 24px rgba(0,0,0,.06)", ...style
    }}>
      {title ? <div style={{padding:"12px 16px", borderBottom:"1px solid #F1F5F9", fontWeight:600}}>{title}</div> : null}
      <div style={{padding:16}}>{children}</div>
    </div>
  );
}

function Tabs({ value, onChange, items }) {
  return (
    <div style={{ display:"inline-flex", border:"1px solid #E5E7EB", borderRadius:10, overflow:"hidden" }}>
      {items.map((it, idx) => {
        const active = value === it.value;
        const isLast = idx === items.length - 1;
        return (
          <button
            key={it.value}
            onClick={()=>onChange(it.value)}
            style={{
              padding:"8px 12px", fontSize:13, border:"none", cursor:"pointer",
              background: active ? "rgba(11,87,208,.08)" : "#fff",
              color: active ? "#0B57D0" : "#111",
              borderRight: isLast ? "none" : "1px solid #E5E7EB"
            }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e=>onChange(e.target.value)}
      style={{ padding:"8px 10px", border:"1px solid #E5E7EB", borderRadius:8, minWidth:200 }}
    >
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  );
}
/** ========================================== */

export default function ReportDashboard() {
  const [view, setView] = useState("overview");
  const stores = useMemo(() => ["Downtown","Mall Branch","Airport Branch","Suburb Branch","Seaside Branch"], []);
  const [store, setStore] = useState(stores[0]);

  /** --- Overview KPIs (global, not store-specific) --- */
  const kpiCards = [
    { title: "Overall CX Score", value: "82%", trend: "+3%" },
    { title: "NPS %", value: "47%", trend: "+1%" },
    { title: "Brand Standard Compliance %", value: "76%", trend: "+1%" },
    { title: "Repeat Visit %", value: "68%", trend: "+5%" },
    { title: "Service Quality Score", value: "79%", trend: "+2%" },
    { title: "Product Quality Score", value: "88%", trend: "+4%" },
    { title: "Speed of Service Score", value: "84%", trend: "-1%" },
    { title: "Cleanliness & Ambience Score", value: "91%", trend: "Stable" },
    { title: "Friendliness Score", value: "86%", trend: "+2%" },
    { title: "Upselling / Cross-Selling %", value: "54%", trend: "-3%" },
    { title: "Queue / Wait Time Avg.", value: "4.2 min", trend: "-0.5m" },
    { title: "Complaint Rate", value: "7%", trend: "Stable" },
  ];

  /** --- BASE (used to derive realistic per-store numbers) --- */
  const baseChecklist = [
    { category: "Service Quality",           score: 79 },
    { category: "Product Quality",           score: 88 },
    { category: "Speed of Service",          score: 84 },
    { category: "Cleanliness & Ambience",    score: 91 },
    { category: "Brand Standards",           score: 76 },
    { category: "Friendliness",              score: 86 },
    { category: "Upselling / Cross-Selling", score: 54 },
    { category: "Queue / Wait Time",         score: 70 },
    { category: "Complaint Rate (inverse)",  score: 93 },
  ];
  const baseIssues = [
    { name: "Late Greeting",            value: 4 },
    { name: "Slow Order Taking",        value: 3 },
    { name: "Unclean Table",            value: 2 },
    { name: "Missing Uniform Standard", value: 5 },
  ];
  const baseEmotion = [
    { stage: "Arrival",  emotion: 72 },
    { stage: "Ordering", emotion: 84 },
    { stage: "Dining",   emotion: 88 },
    { stage: "Payment",  emotion: 62 },
    { stage: "Exit",     emotion: 76 },
  ];

  /** --- Store tuning profiles to ‘shuffle’ numbers realistically --- */
  const tuning = {
    "Mall Branch":    { delta: +6, paymentDip: +6, issueBias: [-1, -1,  0, -1] },  // best
    "Downtown":       { delta: +2, paymentDip: +2, issueBias: [ 0,  0,  0,  0] },
    "Seaside Branch": { delta: +3, paymentDip: +3, issueBias: [ 0, -1,  0,  0] },
    "Suburb Branch":  { delta: -2, paymentDip: -2, issueBias: [ 0,  0, +1,  0] },
    "Airport Branch": { delta: -8, paymentDip: -6, issueBias: [ 0, +2, +1, +2] },  // worst
  };
  const clamp = (n, lo = 45, hi = 98) => Math.max(lo, Math.min(hi, Math.round(n)));
  const current = tuning[store] || { delta: 0, paymentDip: 0, issueBias: [0,0,0,0] };

  /** --- Derived: store-specific charts for Store Detail / Deep Dive --- */
  const checklistScores = baseChecklist.map((c) => {
    let s = c.score + current.delta;
    if (c.category.includes("Upselling")) s += Math.sign(current.delta) * 1;
    if (c.category.includes("Queue"))     s -= Math.sign(current.delta) * 1;
    if (c.category.includes("Complaint")) s += Math.sign(current.delta) * 2;
    return { category: c.category, score: clamp(s) };
  });

  const issueBreakdown = baseIssues.map((it, i) => {
    const mult = 1 + (current.issueBias[i] || 0) * 0.25; // ±25% per step
    return { name: it.name, value: clamp(Math.round(it.value * mult), 1, 15) };
  });

  const emotionData = baseEmotion.map((p) => {
    let e = Number(p.emotion);
    if (p.stage === "Payment") e += (current.paymentDip || 0) * 0.6 * (current.delta < 0 ? -1 : 1);
    else e += current.delta * 0.3;
    return { stage: String(p.stage), emotion: clamp(e, 40, 100) };
  });

  /** --- Benchmark and global trend unaffected by store choice --- */
  const benchmarkData = [
    { store: "Downtown",       score: 82 },
    { store: "Mall Branch",    score: 91 },
    { store: "Airport Branch", score: 68 },
    { store: "Suburb Branch",  score: 74 },
    { store: "Seaside Branch", score: 88 },
  ];
  const trendData = [
    { month:"May", score:74 },
    { month:"Jun", score:78 },
    { month:"Jul", score:81 },
    { month:"Aug", score:79 },
    { month:"Sep", score:84 },
  ];
  const COLORS = ["#2563eb", "#16a34a", "#facc15", "#ef4444"];

  return (
    <div style={{ padding:16, background:"#F8FAFC", borderRadius:12, marginTop:16 }}>
      {/* FILTER BAR */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { value:"overview", label:"Overview" },
            { value:"store",    label:"Store Detail" },
            { value:"deepdive", label:"Compliance Deep Dive" },
            { value:"benchmark",label:"Benchmark" },
          ]}
        />
        {/* Show Store selector ONLY on Store Detail & Deep Dive */}
        {(view === "store" || view === "deepdive") ? (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:12, color:"#64748B" }}>Store</span>
            <Select value={store} onChange={setStore} options={stores} />
          </div>
        ) : (
          <div />  // keep layout balanced
        )}
      </div>

      {/* OVERVIEW (no store filter shown) */}
      {view === "overview" && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:16, marginBottom:16 }}>
            {kpiCards.map((kpi, idx) => (
              <Card key={idx}>
                <div style={{ fontSize:12, color:"#64748B" }}>{kpi.title}</div>
                <div style={{ fontSize:24, fontWeight:700, marginTop:2 }}>{kpi.value}</div>
                <div style={{ fontSize:11, color:"#16A34A", marginTop:4 }}>{kpi.trend}</div>
              </Card>
            ))}
          </div>

          <Card title="Store Performance Heat Map" style={{ marginBottom:16 }}>
            <div style={{
              height:256, borderRadius:10,
              background:"linear-gradient(90deg, #bbf7d0, #fde68a, #fecaca)",
              display:"flex", alignItems:"center", justifyContent:"center"
            }}>
              <MapPin size={32} />
              <span style={{ marginLeft:8, color:"#334155" }}>Interactive Map Integration Here</span>
            </div>
          </Card>

          <Card title="Customer Emotion Curve">
            <div style={{ width:"100%", height:300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[
                  { stage:"Arrival", emotion:70 },
                  { stage:"Ordering", emotion:85 },
                  { stage:"Dining", emotion:90 },
                  { stage:"Payment", emotion:60 },
                  { stage:"Exit", emotion:75 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="emotion" stroke="#2563eb" strokeWidth={3} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
              <Smile color="#16a34a" /> <Frown color="#ef4444" />
            </div>
          </Card>
        </>
      )}

      {/* STORE DETAIL (store-specific numbers) */}
      {view === "store" && (
        <>
          <Card title={`${store} — Checklist Compliance Breakdown`} style={{ marginBottom:16 }}>
            <div style={{ width:"100%", height:260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={checklistScores}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#2563eb" radius={[8,8,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Customer Emotion Curve (Latest Mission)">
            <div style={{ width:"100%", height:300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={emotionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="emotion" stroke="#16a34a" strokeWidth={3} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
              <Smile color="#16a34a" /> <Frown color="#ef4444" />
            </div>
          </Card>
        </>
      )}

      {/* COMPLIANCE DEEP DIVE (store-specific numbers) */}
      {view === "deepdive" && (
        <>
          <Card title={`Top Issues Identified — ${store}`} style={{ marginBottom:16 }}>
            <div style={{ width:"100%", height:250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={issueBreakdown} cx="50%" cy="50%" labelLine={false} outerRadius={100} dataKey="value" label={({ name }) => name}>
                    {issueBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Actionable Insights">
            <ul style={{ margin:0, paddingLeft:16, color:"#334155" }}>
              <li style={{ marginBottom:6, display:"flex", alignItems:"center", gap:8 }}>
                <AlertTriangle color="#ef4444" /> Uniform compliance is below standards in {clamp(30 + (current.delta<0 ? 10 : 0), 20, 60)}% of visits.
              </li>
              <li style={{ marginBottom:6, display:"flex", alignItems:"center", gap:8 }}>
                <AlertTriangle color="#d97706" /> Greeting delays observed in peak hours.
              </li>
              <li style={{ marginBottom:6, display:"flex", alignItems:"center", gap:8 }}>
                <CheckCircle2 color="#16a34a" /> Product quality remains consistently high.
              </li>
            </ul>
          </Card>
        </>
      )}

      {/* BENCHMARK (no store filter shown) */}
      {view === "benchmark" && (
        <>
          <Card title="Store Performance Comparison" style={{ marginBottom:16 }}>
            <div style={{ width:"100%", height:300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={benchmarkData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="store" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#2563eb" radius={[8,8,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#475569", marginTop:8 }}>
              <span><TrendingUp size={16} color="#16a34a" /> Top Performer: Mall Branch (91%)</span>
              <span><ArrowDownCircle size={16} color="#ef4444" /> Lowest: Airport Branch (68%)</span>
            </div>
          </Card>

          <Card title="CX Score Trend Over Time">
            <div style={{ width:"100%", height:300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#16a34a" strokeWidth={3} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}