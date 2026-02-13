"use client";

import React from "react";
import PublicLocaleProvider from "@/components/public/PublicLocaleProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";

function ThemeToggleWithLocale() {
  const { locale } = useStudentLocale();
  return <ThemeToggle locale={locale} />;
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicLocaleProvider>
      <div className="min-h-[100svh]" style={{ background: 'var(--background)' }}>
        {/* Theme Toggle - Fixed position in top right */}
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggleWithLocale />
        </div>
        <main id="main-content" tabIndex={-1} className="outline-none w-[95%] sm:w-[95%] md:w-[95%] lg:w-full mx-auto">
          {children}
        </main>
      </div>
    </PublicLocaleProvider>
  );
}