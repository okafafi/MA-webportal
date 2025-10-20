// app/api/_data/db.js
// One global, shared in-memory DB across all route files (dev server process).

const SEED = {
  missions: [
    {
      id: "MSN-1001",
      title: "QSR — Cairo Mall Visit",
      store: "Store #12 (Cairo Mall)",
      status: "Now",
      startsAt: Date.now() - 2 * 3600 * 1000,
      expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
      location: { address: "Cairo Mall, Cairo", lat: 30.0444, lng: 31.2357, radiusM: 200 },
      checklist: [
        { text: "Queue time", requires: { photo: false, video: false, comment: true,  timer: true  } },
        { text: "Order accuracy", requires:{ photo: true,  video: false, comment: false, timer: false } },
        { text: "Staff courtesy", requires:{ photo: false, video: false, comment: true,  timer: false } },
        { text: "Cleanliness (FOH)", requires:{ photo: true,  video: false, comment: false, timer: false } },
      ],
      requiresVideo: false, requiresPhotos: true, timeOnSiteMin: 15,
      budget: 200, fee: 50, cost: 250
    },
    {
      id: "MSN-1002",
      title: "Retail — Shelf Audit",
      store: "Store #3 (Heliopolis)",
      status: "Scheduled",
      startsAt: Date.now() + 26 * 3600 * 1000,
      expiresAt: Date.now() + 26 * 3600 * 1000 + 7 * 24 * 3600 * 1000,
      location: { address: "Heliopolis, Cairo", lat: 30.0871, lng: 31.3300, radiusM: 150 },
      checklist: [
        { text: "SKU availability",   requires:{ photo: true,  video: false, comment: false, timer: false } },
        { text: "Facing",             requires:{ photo: true,  video: false, comment: false, timer: false } },
        { text: "Pricing",            requires:{ photo: true,  video: false, comment: false, timer: false } },
        { text: "Promo compliance",   requires:{ photo: true,  video: false, comment: false, timer: false } },
      ],
      requiresVideo: false, requiresPhotos: true, timeOnSiteMin: 20,
      budget: 120, fee: 40, cost: 160
    },
    {
      id: "MSN-1003",
      title: "Coffee — Mystery Visit",
      store: "Store #8 (Zamalek)",
      status: "Now",
      startsAt: Date.now() - 1 * 3600 * 1000,
      expiresAt: Date.now() + 8 * 24 * 3600 * 1000,
      location: { address: "Zamalek, Cairo", lat: 30.0635, lng: 31.2261, radiusM: 120 },
      checklist: [
        { text: "Greeting",         requires:{ photo: false, video: false, comment: true,  timer: false } },
        { text: "Beverage quality", requires:{ photo: true,  video: false, comment: false, timer: false } },
        { text: "Wait time",        requires:{ photo: false, video: false, comment: false, timer: true  } },
        { text: "Ambiance",         requires:{ photo: true,  video: false, comment: false, timer: false } },
      ],
      requiresVideo: true, requiresPhotos: false, timeOnSiteMin: 10,
      budget: 60, fee: 35, cost: 95
    }
  ],
  templates: [
    {
      id: "TPL-2001",
      name: "QSR — Front Counter Experience",
      title: "QSR — Front Counter Experience",
      defaultStore: "Any QSR Store",
      defaultDurationHours: 4,
      defaultLocation: { address: "Cairo", lat: 30.0444, lng: 31.2357, radiusM: 200 },
      checklist: ["Queue time", "Order accuracy", "Staff courtesy", "Cleanliness (FOH)"],
      defaultChecklist: [
        { text: "Queue time",        requires:{ photo:false, video:false, comment:true,  timer:true  } },
        { text: "Order accuracy",    requires:{ photo:true,  video:false, comment:false, timer:false } },
      ],
      requiresVideo: false, requiresPhotos: true, timeOnSiteMin: 15,
      notes: "Front-of-house experience evaluation",
      defaultBudget: 200, defaultFee: 50
    },
    {
      id: "TPL-2002",
      name: "Retail — Shelf Availability Audit",
      title: "Retail — Shelf Availability Audit",
      defaultStore: "Any Retail Store",
      defaultDurationHours: 6,
      defaultLocation: { address: "Heliopolis, Cairo", lat: 30.0871, lng: 31.3300, radiusM: 150 },
      checklist: ["SKU availability", "Facing", "Pricing", "Promo compliance"],
      requiresVideo: false, requiresPhotos: true, timeOnSiteMin: 20,
      notes: "Planogram compliance & shelf health",
      defaultBudget: 120, defaultFee: 40
    },
    {
      id: "TPL-2003",
      name: "Coffee — Mystery Shopper",
      title: "Coffee — Mystery Shopper",
      defaultStore: "Any Coffee Shop",
      defaultDurationHours: 3,
      defaultLocation: { address: "Zamalek, Cairo", lat: 30.0635, lng: 31.2261, radiusM: 120 },
      checklist: ["Greeting", "Order experience", "Drink quality", "Ambiance"],
      requiresVideo: true, requiresPhotos: false, timeOnSiteMin: 10,
      notes: "Customer experience & drink quality",
      defaultBudget: 60, defaultFee: 35
    }
  ],
};

const g = globalThis;
if (!g.__MEM_DB__) {
  // First time: seed
  g.__MEM_DB__ = structuredClone ? structuredClone(SEED) : JSON.parse(JSON.stringify(SEED));
}
export const DB = g.__MEM_DB__;