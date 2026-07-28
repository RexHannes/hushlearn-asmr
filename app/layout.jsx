import "./globals.css";

export const metadata = {
  title: "Hushlearn — quiet knowledge, spoken gently",
  description:
    "A private, browser-first ASMR learning companion grounded in your selected knowledge base.",
  metadataBase: new URL("https://hushlearn.app"),
  openGraph: {
    title: "Hushlearn",
    description: "Quiet knowledge, spoken gently.",
    images: ["/assets/mira-study.webp"],
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport = {
  themeColor: "#071019",
  colorScheme: "dark",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
