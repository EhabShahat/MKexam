import React from "react";
import PublicLocaleProvider from "@/components/public/PublicLocaleProvider";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicLocaleProvider>
      <div className="min-h-screen bg-gray-50">
        <main id="main-content" tabIndex={-1} className="outline-none">
          {children}
        </main>
      </div>
    </PublicLocaleProvider>
  );
}