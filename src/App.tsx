import { useState, useEffect, useCallback } from "react";
import { Dashboard } from "./features/dashboard/Dashboard";
import { CohortView } from "./features/cohorts/CohortView";
import { RetentionView } from "./features/retention/RetentionView";
import { WaterfallView } from "./features/waterfall/WaterfallView";
import { UnitEconomicsView } from "./features/economics/UnitEconomicsView";
import { CustomerEconomicsView } from "./features/economics/CustomerEconomicsView";
import { ForecastingView } from "./features/forecasting/ForecastingView";
import { ChurnAnalyticsView } from "./features/churn/ChurnAnalyticsView";
import { DocumentationView } from "./features/docs/DocumentationView";
import { SettingsView } from "./features/settings/SettingsView";
import { DataManagementView } from "./features/data/DataManagementView";
import { WorkspaceSwitcher } from "./components/WorkspaceSwitcher";
import { useWorkspaceStore } from "./store/workspace";
import { useFinancialsStore } from "./store/financials";
import { useCohortStore } from "./store/cohort";

type Tab = 'dashboard' | 'cohorts' | 'retention' | 'waterfall' | 'economics' | 'customers' | 'churn' | 'forecasting' | 'data' | 'docs' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const { activeId, load } = useWorkspaceStore();
  const fetchFinancials = useFinancialsStore(s => s.fetchData);
  const fetchCohort = useCohortStore(s => s.fetchData);

  // Load workspace list on startup
  useEffect(() => {
    load();
  }, [load]);

  // Whenever the active workspace changes, refetch all stores with the correct ID
  useEffect(() => {
    if (activeId) {
      fetchFinancials();
      fetchCohort();
    }
  }, [activeId, fetchFinancials, fetchCohort]);

  // Called by WorkspaceSwitcher after any create/switch/delete
  const handleActiveIdChange = useCallback((newId: string) => {
    if (newId) {
      fetchFinancials();
      fetchCohort();
    }
  }, [fetchFinancials, fetchCohort]);

  return (
    <div className="app-container">
      {/* Premium Navigation Bar */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-logo" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="nav-logo-icon">L</div>
              <span className="text-gradient">LedgerLine</span>
            </div>
            {/* Workspace switcher sits right of the logo */}
            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)' }} />
            <WorkspaceSwitcher onActiveIdChange={handleActiveIdChange} />
          </div>

          <div className="nav-menu">
            <button onClick={() => setActiveTab('dashboard')} className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}>Dashboard</button>
            <button onClick={() => setActiveTab('cohorts')} className={`nav-item ${activeTab === 'cohorts' ? 'active' : ''}`}>Cohorts</button>
            <button onClick={() => setActiveTab('retention')} className={`nav-item ${activeTab === 'retention' ? 'active' : ''}`}>Retention</button>
            <button onClick={() => setActiveTab('waterfall')} className={`nav-item ${activeTab === 'waterfall' ? 'active' : ''}`}>Waterfall</button>
            <button onClick={() => setActiveTab('economics')} className={`nav-item ${activeTab === 'economics' ? 'active' : ''}`}>Economics</button>
            <button onClick={() => setActiveTab('customers')} className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`}>Customers</button>
            <button onClick={() => setActiveTab('churn')} className={`nav-item ${activeTab === 'churn' ? 'active' : ''}`}>Churn</button>
            <button onClick={() => setActiveTab('forecasting')} className={`nav-item ${activeTab === 'forecasting' ? 'active' : ''}`}>Forecast</button>
            <button onClick={() => setActiveTab('data')} className={`nav-item ${activeTab === 'data' ? 'active' : ''}`}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              Data
            </button>
            <button onClick={() => setActiveTab('docs')} className={`nav-item ${activeTab === 'docs' ? 'active' : ''}`}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Docs
            </button>
            <button onClick={() => setActiveTab('settings')} className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Settings
            </button>

            </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="content-wrapper">
        {activeTab === 'dashboard'   && <Dashboard onGoToSettings={() => setActiveTab('settings')} />}
        {activeTab === 'cohorts'     && <CohortView />}
        {activeTab === 'retention'   && <RetentionView />}
        {activeTab === 'waterfall'   && <WaterfallView />}
        {activeTab === 'economics'   && <UnitEconomicsView />}
        {activeTab === 'customers'   && <CustomerEconomicsView />}
        {activeTab === 'churn'       && <ChurnAnalyticsView />}
        {activeTab === 'forecasting' && <ForecastingView />}
        <div style={{ display: activeTab === 'data' ? 'block' : 'none' }}>
            <DataManagementView />
          </div>
        {activeTab === 'docs'        && <DocumentationView />}
        {activeTab === 'settings'    && <SettingsView />}
      </div>
    </div>
  );
}

export default App;
