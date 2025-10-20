import Link from "next/link";
export default function Page() {
  return (
    <main style={{minHeight:"80vh",display:"grid",placeItems:"center",padding:"40px"}}>
      <div style={{textAlign:"center"}}>
        <h1 style={{fontSize:"28px",marginBottom:"8px"}}>Mystery Agent — Client Portal</h1>
        <p style={{opacity:.7,marginBottom:"12px"}}>Click below to preview the portal UI.</p>
        <Link href="/portal" style={{textDecoration:"underline"}}>Go to /portal</Link>
      </div>
    </main>
  );
}
