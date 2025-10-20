// app/layout.js

export const metadata = {
  title: "Mystery Agent — Client Portal",
  description: "Client web portal for missions, templates, and reports",
};

function BrandStylesHead() {
  return (
    <>
      {/* Brand CI (colors, tokens, fonts) */}
      <link rel="stylesheet" href="/brand/ci.css" />

      {/* Fonts (fallback if Gotham not web-licensed) */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Favicons */}
      <link rel="icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="manifest" href="/site.webmanifest" />

      {/* Brand defaults in case ci.css is missing */}
      <style>{`
        :root{
          --brand: #14213D;
          --accent: #FDC449;
          --text: #111418;
          --bg: #FAFBFC;
          --panel: #FFFFFF;
          --border: #E2E8F0;
          --radius: 12px;
          --shadow: 0 10px 30px rgba(0,0,0,.08);
        }
        html, body {
          background: var(--bg);
          color: var(--text);
          font-family: Gotham, Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 0;
        }
      `}</style>
    </>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <BrandStylesHead />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
