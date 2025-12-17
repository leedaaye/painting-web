import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Painting Web - AI 图片生成",
  description: "AI 图片生成工具",
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
        <Toaster position="top-center" richColors theme="dark" />
      </body>
    </html>
  );
}
