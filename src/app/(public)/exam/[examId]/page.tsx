import { Metadata } from "next";
import { headers } from "next/headers";
import ExamEntry from "@/components/public/ExamEntry";
import { supabaseServer } from "@/lib/supabase/server";

// ISR Configuration: Revalidate every 60 seconds (Requirement 3.1)
export const revalidate = 60;

// Generate static params for published exams (Requirement 3.1)
export async function generateStaticParams() {
  try {
    const supabase = supabaseServer();
    
    // Fetch all published exams for static generation
    const { data: exams } = await supabase
      .from("exams")
      .select("id")
      .eq("status", "published")
      .eq("is_archived", false);
    
    if (!exams || exams.length === 0) {
      return [];
    }
    
    return exams.map((exam) => ({
      examId: exam.id,
    }));
  } catch (error) {
    console.error("Error generating static params for exams:", error);
    return [];
  }
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: { examId: string };
}): Promise<Metadata> {
  try {
    const supabase = supabaseServer();
    const { data: exam } = await supabase
      .from("exams")
      .select("title, description")
      .eq("id", params.examId)
      .eq("status", "published")
      .single();
    
    if (!exam) {
      return {
        title: "Exam Entry",
      };
    }
    
    return {
      title: exam.title || "Exam Entry",
      description: exam.description || undefined,
    };
  } catch {
    return {
      title: "Exam Entry",
    };
  }
}

export default async function ExamEntryPage({
  params,
}: {
  params: { examId: string };
}) {
  const { examId } = params;
  
  // Fetch system mode on server side to avoid client-side flash
  let systemMode: "exam" | "results" | "disabled" = "exam";
  let disabledMessage: string | null = null;
  
  try {
    const supabase = supabaseServer();
    const { data: configs } = await supabase
      .from("app_config")
      .select("key, value")
      .in("key", ["system_mode", "system_disabled_message"]);
    
    if (configs) {
      const modeConfig = configs.find((c) => c.key === "system_mode");
      const messageConfig = configs.find((c) => c.key === "system_disabled_message");
      
      if (modeConfig?.value) {
        systemMode = modeConfig.value as "exam" | "results" | "disabled";
      }
      
      if (messageConfig?.value) {
        disabledMessage = messageConfig.value;
      }
    }
  } catch (error) {
    console.error("Error fetching system mode:", error);
  }
  
  // Set cache headers for CDN (Requirement 3.6)
  const headersList = headers();
  
  return (
    <ExamEntry
      examId={examId}
      initialSystemMode={systemMode}
      initialDisabledMessage={disabledMessage}
      skipModeFetch={true}
    />
  );
}
