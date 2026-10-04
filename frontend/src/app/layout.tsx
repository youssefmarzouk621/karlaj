import type { Metadata } from "next";
import { Archivo, Familjen_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";
import { auth } from "@/auth";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

// Display face for headings (variable weight, upright + italic).
const familjen = Familjen_Grotesk({
  variable: "--font-familjen",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrickArt — Photo to LEGO Mosaic",
  description: "Turn any photo into a buildable LEGO mosaic with instruction booklet",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${archivo.variable} ${familjen.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pt-[60px] md:pt-[72px]">
        <Providers session={session}>
          <Header />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
