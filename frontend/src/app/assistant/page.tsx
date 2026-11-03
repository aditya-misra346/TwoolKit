"use client";

import { useState } from "react";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { analyzeFileWithAssistant, type AssistantAnalysis, getFormattingRiskExplanation } from "@/lib/fileAssistant";
import { extOf, categoryOf, formatBytes } from "@/lib/fileTypes";
import {
  Sparkles,
  Bot,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Info,
} from "lucide-react";
import clsx from "clsx";

export default function AssistantPage() {
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AssistantAnalysis | null>(null);

  // Conversion risk explainer
  const [sourceExt, setSourceExt] = useState("pdf");
  const [targetExt, setTargetExt] = useState("docx");

  const riskExplanations = getFormattingRiskExplanation(sourceExt, targetExt);

  const handleAnalyzeFile = async (staged: StagedFile) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Read first 20KB of text or extract string
      let textSample = "";
      try {
        textSample = await staged.file.slice(0, 25000).text();
      } catch {
        textSample = `File: ${staged.name}`;
      }

      const res = await analyzeFileWithAssistant(
        staged.name,
        textSample,
        staged.size,
        staged.category
      );
      setAnalysisResult(res);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <Sparkles className="w-7 h-7 text-amber-500" />
          Intelligent File Assistant
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
          AI-powered document summaries, key fact extraction, and conversion formatting risk analysis.
        </p>
      </div>

      <DropZone
        onFilesSelected={(newFiles) => {
          setFiles(newFiles);
          if (newFiles.length > 0) void handleAnalyzeFile(newFiles[0]);
        }}
        selectedFiles={files}
        onRemoveFile={() => {
          setFiles([]);
          setAnalysisResult(null);
        }}
        multiple={false}
        title="Drop a document or PDF for intelligent analysis"
        description="Extracts key points, summarizes content, and recommends optimal workflows"
        showToolRecommendations={false}
      />

      {isAnalyzing && (
        <div className="p-8 rounded-3xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mx-auto" />
          <div className="text-sm font-bold text-amber-950 dark:text-amber-200">
            Analyzing document structure & contents...
          </div>
        </div>
      )}

      {analysisResult && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {analysisResult.title}
              </h2>
            </div>
            <span
              className={clsx(
                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                analysisResult.source === "gemini_ai"
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              )}
            >
              {analysisResult.source === "gemini_ai" ? "Gemini AI" : "Local Heuristic"}
            </span>
          </div>

          {/* Summary Box */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
              Executive Summary
            </span>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              {analysisResult.summary}
            </p>
          </div>

          {/* Key Facts */}
          {analysisResult.keyPoints && analysisResult.keyPoints.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                Key Extracted Facts
              </span>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                {analysisResult.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Workflow Recommendations */}
          {analysisResult.recommendedActions && analysisResult.recommendedActions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                Recommended Processing Actions
              </span>
              <div className="space-y-2">
                {analysisResult.recommendedActions.map((act, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between"
                  >
                    <span>{act}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conversion Formatting Risk Explainer */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            Conversion Formatting Risk Advisor
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Understand why certain conversions cannot perfectly preserve original layout or animations.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Source Format:
            </label>
            <select
              value={sourceExt}
              onChange={(e) => setSourceExt(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs uppercase font-mono font-bold"
            >
              <option value="pdf">PDF</option>
              <option value="pptx">PPTX</option>
              <option value="docx">DOCX</option>
              <option value="xlsx">XLSX</option>
              <option value="png">PNG</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Target Format:
            </label>
            <select
              value={targetExt}
              onChange={(e) => setTargetExt(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs uppercase font-mono font-bold"
            >
              <option value="docx">DOCX</option>
              <option value="pptx">PPTX</option>
              <option value="xlsx">XLSX</option>
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="jpeg">JPEG</option>
              <option value="gif">GIF</option>
            </select>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 space-y-2 text-xs">
          {riskExplanations.length === 0 ? (
            <div className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Direct format compatibility: Low formatting risk for this combination.
            </div>
          ) : (
            riskExplanations.map((risk, i) => (
              <div key={i} className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{risk}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
