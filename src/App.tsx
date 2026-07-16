import React, { useState } from "react";
import { Dashboard } from "./features/dashboard/Dashboard";
import { CohortView } from "./features/cohorts/CohortView";
import { RetentionView } from "./features/retention/RetentionView";
import { WaterfallView } from "./features/waterfall/WaterfallView";
import { UnitEconomicsView } from "./features/economics/UnitEconomicsView";
import { ForecastingView } from "./features/forecasting/ForecastingView";
import { ExportButton } from "./features/export/ExportButton";
import { DocumentationView } from "./features/docs/DocumentationView";
import { SettingsView } from "./features/settings/SettingsView";

type Tab = 'dashboard' | 'cohorts' | 'retention' | 'waterfall' | 'economics' | 'forecasting' | 'docs' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <main className="min-h-screen bg-gray-900 text-white font-sans flex flex-col">
      {/* Premium Navigation Bar */}
      <nav className="w-full bg-gray-900/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-emerald-500 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
              L
            </div>
            <span className="font-semibold text-lg tracking-wide text-white">LedgerLine</span>
          </div>
          
          <div className="flex items-center space-x-1 bg-white/5 p-1 rounded-lg border border-white/5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'dashboard' 
                  ? 'bg-emerald-500 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('cohorts')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'cohorts' 
                  ? 'bg-emerald-500 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Cohorts
            </button>
            <button
              onClick={() => setActiveTab('retention')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'retention' 
                  ? 'bg-emerald-500 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Retention
            </button>
            <button
              onClick={() => setActiveTab('waterfall')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'waterfall' 
                  ? 'bg-emerald-500 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Waterfall
            </button>
            <button
              onClick={() => setActiveTab('economics')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'economics' 
                  ? 'bg-emerald-500 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Unit Economics
            </button>
            <button
              onClick={() => setActiveTab('forecasting')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'forecasting' 
                  ? 'bg-emerald-500 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Forecasting
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === 'docs' 
                  ? 'bg-emerald-500 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Docs
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === 'settings' 
                  ? 'bg-emerald-500 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
            
            {/* Divider */}
            <div className="w-px h-6 bg-white/10 mx-2"></div>
            
            <ExportButton />
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-7xl mx-auto p-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'cohorts' && <CohortView />}
        {activeTab === 'retention' && <RetentionView />}
        {activeTab === 'waterfall' && <WaterfallView />}
        {activeTab === 'economics' && <UnitEconomicsView />}
        {activeTab === 'forecasting' && <ForecastingView />}
        {activeTab === 'docs' && <DocumentationView />}
        {activeTab === 'settings' && <SettingsView />}
      </div>
    </main>
  );
}

export default App;
