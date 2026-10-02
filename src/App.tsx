/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  GitBranch, 
  Terminal, 
  Code2, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink,
  BookOpen,
  ArrowRight,
  FolderGit2,
  RefreshCw,
  Cpu
} from 'lucide-react';

export default function App() {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [taskDescription, setTaskDescription] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const samplePrompt = repoUrl 
    ? `Please clone and modify repository ${repoUrl} (branch: ${branch || 'main'}). Changes to make: ${taskDescription || 'Explain code and improve components'}.`
    : `Please clone https://github.com/OWNER/REPO and modify it.`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FolderGit2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                GitHub Repository Assistant
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Ready to Modify
                </span>
              </h1>
              <p className="text-xs text-slate-400">Modify your existing local and GitHub repository in this project</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Environment Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full space-y-10">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-900/30 p-6 sm:p-8">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Existing Project Integration
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Ready to modify your existing repository
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Because this AI Studio project has terminal and git capabilities, you can provide your GitHub repository link or files directly in our chat, and I can clone it into this workspace, test it live, and perform your modifications.
            </p>
          </div>
        </div>

        {/* 3 Step Integration Workflows */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Code2 className="w-5 h-5 text-indigo-400" />
            3 Ways to Connect &amp; Modify Your Repo
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1 */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between hover:border-slate-700 transition">
              <div className="space-y-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-500/20">
                  1
                </div>
                <h4 className="font-semibold text-white text-base">Provide Repo URL in Chat</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Provide your public GitHub repository URL (e.g., <code className="text-indigo-300">https://github.com/user/repo</code>). I can run git commands to clone the code directly into this environment and start editing.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-indigo-400 font-medium flex items-center gap-1">
                Fastest for public repos <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 2 */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between hover:border-slate-700 transition">
              <div className="space-y-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-500/20">
                  2
                </div>
                <h4 className="font-semibold text-white text-base">Paste Files / Code Snippets</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  If the repository is private or you only need specific files updated (e.g. components, routes, styles), paste the relevant file contents in the chat alongside what changes you need.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-indigo-400 font-medium flex items-center gap-1">
                Ideal for private repos <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 3 */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between hover:border-slate-700 transition">
              <div className="space-y-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-500/20">
                  3
                </div>
                <h4 className="font-semibold text-white text-base">Push Back Changes to Git</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Once edits are made in AI Studio, you can either copy the updated code back to your local repository or set a git remote with a GitHub Personal Access Token to commit and push directly.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-indigo-400 font-medium flex items-center gap-1">
                Sync back to GitHub <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </section>

        {/* Quick Helper Generator Form */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-400" />
                Repository Details Quick-Prompt
              </h3>
              <p className="text-xs text-slate-400">Fill this in to quickly send me the exact repository details in chat</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">GitHub Repository URL</label>
              <input 
                type="text"
                placeholder="https://github.com/username/project-repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Target Branch (Default: main)</label>
              <input 
                type="text"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-slate-300">What modifications do you want to make?</label>
              <textarea 
                rows={3}
                placeholder="e.g., Fix styling bugs, add a new profile page, update dependencies, optimize performance, implement a new feature..."
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* Generated message preview */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Ready-to-send chat prompt:</span>
              <button
                onClick={() => copyToClipboard(samplePrompt, 1)}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded border border-indigo-500/20 transition"
              >
                {copiedIndex === 1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedIndex === 1 ? 'Copied prompt!' : 'Copy to Chat'}
              </button>
            </div>
            <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 font-mono text-xs text-slate-300 overflow-x-auto">
              {samplePrompt}
            </div>
          </div>
        </section>

        {/* Local Git CLI instructions */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Working with Local Git &amp; GitHub
          </h3>
          <p className="text-xs text-slate-400">
            If you want to pull modifications made in this workspace down to your local machine:
          </p>

          <div className="space-y-3 font-mono text-xs">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-300">git checkout -b ai-studio-updates</span>
              <button 
                onClick={() => copyToClipboard('git checkout -b ai-studio-updates', 2)}
                className="text-slate-400 hover:text-white"
              >
                {copiedIndex === 2 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-300">git status &amp;&amp; git diff</span>
              <button 
                onClick={() => copyToClipboard('git status && git diff', 3)}
                className="text-slate-400 hover:text-white"
              >
                {copiedIndex === 3 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-center text-xs text-slate-500">
        AI Studio Project Workspace &bull; Share your repo URL or code files in chat to proceed
      </footer>
    </div>
  );
}
