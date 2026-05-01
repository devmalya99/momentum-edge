import React from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { Wallet, ShieldAlert, Database, Trash2, Plus, Tag, ListChecks } from 'lucide-react';

export default function Settings() {
  const { settings, updateSettings, trades, rules, addRule, deleteRule } = useTradeStore();
  const [newChecklistRule, setNewChecklistRule] = React.useState('');

  const handleClearData = async () => {
    if (confirm('Are you sure you want to clear ALL trade data? This cannot be undone.')) {
      alert('Feature coming soon. For now, use browser dev tools to clear IndexedDB.');
    }
  };

  const addTradeType = () => {
    const newType = { id: crypto.randomUUID(), name: 'New Type', description: '', minHoldingPeriod: '', expectedReturn: '' };
    updateSettings({ tradeTypes: [...(settings.tradeTypes || []), newType] });
  };

  const updateTradeType = (id: string, updates: any) => {
    updateSettings({
      tradeTypes: settings.tradeTypes?.map(t => t.id === id ? { ...t, ...updates } : t)
    });
  };

  const deleteTradeType = (id: string) => {
    updateSettings({ tradeTypes: settings.tradeTypes?.filter(t => t.id !== id) });
  };

  const addChecklistRule = () => {
    const trimmed = newChecklistRule.trim();
    if (!trimmed) return;
    void addRule({
      name: trimmed,
      maxScore: 1,
      enabled: true,
    });
    setNewChecklistRule('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-gray-400 mt-1">Configure your capital, risk, and custom categories.</p>
      </div>

      <div className="space-y-6">
        {/* Capital Management */}
        <section className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-6">
          <div className="flex items-center gap-3">
            <Wallet className="text-blue-400" size={24} />
            <h2 className="text-xl font-bold">Capital Management</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Trading Capital ($)</label>
              <input
                type="number"
                value={settings.totalCapital}
                onChange={(e) => updateSettings({ totalCapital: parseFloat(e.target.value) })}
                className="w-full bg-[#0a0a0b] border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-xl font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Maximum Risk Per Trade (%)</label>
              <input
                type="number"
                value={settings.riskPerTradePercent}
                onChange={(e) => updateSettings({ riskPerTradePercent: parseFloat(e.target.value) })}
                className="w-full bg-[#0a0a0b] border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-xl font-bold"
              />
              <p className="text-gray-500 text-xs mt-2">Trades exceeding this risk threshold will be blocked during entry.</p>
            </div>
          </div>
        </section>

        <section className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-6">
          <div className="flex items-center gap-3">
            <ListChecks className="text-emerald-400" size={24} />
            <h2 className="text-xl font-bold">New Trade Checklist</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Passing Score (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={settings.checklistPassingScore ?? 70}
                onChange={(e) => updateSettings({ checklistPassingScore: parseFloat(e.target.value) || 0 })}
                className="w-full bg-[#0a0a0b] border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-xl font-bold"
              />
              <p className="text-gray-500 text-xs mt-2">
                Trade entry will warn if checked rules fall below this threshold.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                Checklist Rules
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newChecklistRule}
                  onChange={(e) => setNewChecklistRule(e.target.value)}
                  placeholder="Add checklist rule..."
                  className="flex-1 bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
                <button
                  type="button"
                  onClick={addChecklistRule}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-all"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-3"
                >
                  <span className="text-sm text-gray-200">{rule.name}</span>
                  <button
                    type="button"
                    onClick={() => void deleteRule(rule.id)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
                    aria-label={`Delete ${rule.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trade Types */}
        <section className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Tag className="text-purple-400" size={24} />
              <h2 className="text-xl font-bold">Trade Types & Expectations</h2>
            </div>
            <button
              onClick={addTradeType}
              className="flex items-center gap-2 text-xs font-bold bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-all"
            >
              <Plus size={14} /> Add Type
            </button>
          </div>
          
          <div className="space-y-4">
            {settings.tradeTypes?.map(type => (
              <div key={type.id} className="bg-[#0a0a0b] p-6 rounded-2xl border border-white/5 space-y-4 relative group">
                <button
                  onClick={() => deleteTradeType(type.id)}
                  className="absolute top-4 right-4 p-2 text-red-500/0 group-hover:text-red-500/50 hover:text-red-400! hover:bg-red-500/10 rounded-xl transition-all"
                >
                  <Trash2 size={16} />
                </button>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Type Name</label>
                  <input
                    type="text"
                    value={type.name}
                    onChange={(e) => updateTradeType(type.id, { name: e.target.value })}
                    className="w-full bg-transparent border-b border-white/10 focus:border-purple-500 px-0 py-2 focus:outline-none transition-all text-lg font-bold"
                    placeholder="e.g. Buy & Forget"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Min. Holding Period</label>
                    <input
                      type="text"
                      value={type.minHoldingPeriod || ''}
                      onChange={(e) => updateTradeType(type.id, { minHoldingPeriod: e.target.value })}
                      className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                      placeholder="e.g. 3 months"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Expected Return</label>
                    <input
                      type="text"
                      value={type.expectedReturn || ''}
                      onChange={(e) => updateTradeType(type.id, { expectedReturn: e.target.value })}
                      className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                      placeholder="e.g. 50-100%"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Description / Rules</label>
                  <textarea
                    value={type.description || ''}
                    onChange={(e) => updateTradeType(type.id, { description: e.target.value })}
                    className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 min-h-[60px]"
                    placeholder="Describe the trade style..."
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="p-8 rounded-3xl bg-red-600/5 border border-red-500/10 space-y-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-red-400" size={24} />
            <h2 className="text-xl font-bold">Danger Zone</h2>
          </div>

          <div className="p-4 rounded-2xl bg-[#0a0a0b] border border-white/5 flex items-center justify-between">
            <div>
              <div className="font-bold">Clear All Trade Logs</div>
              <div className="text-xs text-gray-500">Permanently delete all {trades.length} trades from local storage.</div>
            </div>
            <button 
              onClick={handleClearData}
              className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl font-bold text-xs hover:bg-red-500/20 transition-all flex items-center gap-2"
            >
              <Trash2 size={14} />
              Clear Data
            </button>
          </div>
        </section>

        <section className="p-8 rounded-3xl bg-[#161618] border border-white/5 space-y-4">
          <div className="flex items-center gap-3">
            <Database className="text-gray-400" size={24} />
            <h2 className="text-xl font-bold">Data Storage</h2>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            Momentum Edge uses <strong>IndexedDB</strong> to store your data locally in your browser. 
            No data is sent to any server. Your trades are private and secure on this device.
          </p>
          <div className="pt-4 flex items-center justify-between text-xs text-gray-500">
            <span>Database Version: 1.0.0</span>
            <span>Storage Status: Healthy</span>
          </div>
        </section>
      </div>
    </div>
  );
}
