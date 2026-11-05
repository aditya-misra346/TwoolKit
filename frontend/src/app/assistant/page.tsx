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
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

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
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-150">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-amber-500 shrink-0" />
          Intelligent Document Assistant & Formatting Advisor
        </h1>
        <p className="text-sm sm:text-base text-slate-500 dark:text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
          Automated executive summaries, key bullet extraction, and conversion compatibility analysis powered by Gemini AI and local heuristics.
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
        description="Generates executive briefs, extracts core facts, and scores format compatibility"
        showToolRecommendations={false}
      />

      {isAnalyzing && (
        <div className="p-6 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-center space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-amber-600 dark:text-amber-400 mx-auto" />
          <div className="text-xs font-bold text-amber-950 dark:text-amber-200">
            Analyzing document structure & contents...
          </div>
        </div>
      )}

      {analysisResult && (
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {analysisResult.title}
              </h2>
            </div>
            <span
              className={clsx(
                "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                analysisResult.source === "gemini_ai"
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              )}
            >
              {analysisResult.source === "gemini_ai" ? "Gemini AI" : "Local Heuristic Engine"}
            </span>
          </div>

          {/* Executive Summary */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Executive Brief
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60">
              {analysisResult.summary}
            </p>
          </div>

          {/* Key Facts */}
          {analysisResult.keyPoints && analysisResult.keyPoints.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Extracted Key Points
              </span>
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {analysisResult.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {analysisResult.recommendedActions && analysisResult.recommendedActions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                Recommended Actions
              </span>
              <div className="flex flex-wrap gap-2">
                {analysisResult.recommendedActions.map((act, i) => (
                  <div
                    key={i}
                    className="px-3 py-1.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-1.5"
                  >
                    <span>{act}</span>
                    <ArrowRight className="w-3 h-3 text-blue-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conversion Formatting Risk Explainer */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-4">
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            Conversion Formatting Risk Matrix
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Transparently understand why certain formats undergo structural compromises during conversion.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Source Format:
            </label>
            <select
              value={sourceExt}
              onChange={(e) => setSourceExt(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs uppercase font-mono font-bold focus:outline-hidden"
            >
              <option value="pdf">PDF</option>
              <option value="pptx">PPTX</option>
              <option value="docx">DOCX</option>
              <option value="xlsx">XLSX</option>
              <option value="png">PNG</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Target Format:
            </label>
            <select
              value={targetExt}
              onChange={(e) => setTargetExt(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs uppercase font-mono font-bold focus:outline-hidden"
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

        <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 space-y-1.5 text-xs">
          {riskExplanations.length === 0 ? (
            <div className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Native format symmetry: High fidelity with low conversion risk.</span>
            </div>
          ) : (
            riskExplanations.map((risk, i) => (
              <div key={i} className="flex items-start gap-2 text-amber-900 dark:text-amber-200 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{risk}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
