import "./globals.css";

export const metadata = {
  title: "Hushlearn — quiet knowledge, spoken gently",
  description:
    "A private, browser-first ASMR learning companion grounded in your selected knowledge base.",
  metadataBase: new URL("https://hushlearn-mira.namchonglau.chatgpt.site"),
  openGraph: {
    title: "Hushlearn",
    description: "Quiet knowledge, spoken gently.",
    images: [
      {
        url: "/og.png",
        width: 1536,
        height: 1024,
        alt: "Hushlearn 3D learning companion Mira",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hushlearn",
    description: "Quiet knowledge, spoken gently.",
    images: ["/og.png"],
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
