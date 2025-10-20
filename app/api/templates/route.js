// app/api/templates/route.js
import { NextResponse } from "next/server";

export async function GET() {
  const templates = [
    {
      id: "tpl-fastfood",
      name: "Fast Food Mystery Visit",
      notes: "Order, cleanliness, staff courtesy, speed.",
      defaultStore: "Demo Store",
      defaultLocation: {
        address: "Tahrir, Cairo",
        lat: 30.0444, lng: 31.2357,
        addressParts: { line1:"Tahrir", city:"Cairo", region:"Cairo", country:"EG" }
      },
      defaultChecklist: [
        { text: "Was the greeting friendly?", requires: { photo:false, video:false, comment:true, timer:false } },
        { text: "Order accuracy verified",   requires: { photo:true,  video:false, comment:false, timer:false } },
      ],
      defaultBudget: 120, defaultFee: 30,
      requiresVideo: false, requiresPhotos: true, timeOnSiteMin: 10,
    },
    {
      id: "tpl-retail",
      name: "Retail Store Audit",
      notes: "Merchandising, availability, signage, queue time.",
      defaultStore: "Demo Retail",
      defaultLocation: { address: "Zamalek, Cairo", lat: 30.0667, lng: 31.2167, addressParts:{ line1:"Zamalek", city:"Cairo", region:"Cairo", country:"EG" } },
      defaultChecklist: [
        "Signage present at entrance",
        { text: "Shelves tidy", requires: { photo:true, video:false, comment:false, timer:false } }
      ],
      defaultBudget: 0, defaultFee: 50,
      requiresVideo: false, requiresPhotos: true, timeOnSiteMin: 8,
    },
    {
      id: "tpl-bank",
      name: "Bank Branch Service",
      notes: "Greeting, ID process, product knowledge.",
      defaultStore: "Demo Branch",
      defaultLocation: { address:"Nasr City, Cairo", lat:30.056, lng:31.330, addressParts:{ line1:"Nasr City", city:"Cairo", region:"Cairo", country:"EG" } },
      defaultChecklist: [
        { text:"Security present", requires:{ photo:false, video:false, comment:false, timer:false } },
        { text:"Waiting time", requires:{ timer:true, photo:false, comment:true, video:false } }
      ],
      defaultBudget: 0, defaultFee: 60,
      requiresVideo: false, requiresPhotos: false, timeOnSiteMin: 12,
    }
  ];
  return NextResponse.json({ templates });
}