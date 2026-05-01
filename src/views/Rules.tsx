import React, { useState } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { Plus, Trash2, Check, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export default function Rules() {
  const { rules, addRule, updateRule, deleteRule } = useTradeStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    enabled: true,
  });

  const handleAdd = () => {
    if (!newRule.name) return;
    addRule({ ...newRule, maxScore: 1 });
    setNewRule({ name: '', enabled: true });
    setIsAdding(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scoring Rules</h1>
          <p className="text-gray-400 mt-1">Define the criteria for quantifying setup quality.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-600/20"
        >
          <Plus size={18} />
          Add Rule
        </button>
      </div>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 rounded-2xl bg-[#161618] border border-white/5 space-y-4"
        >
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Rule Name</label>
              <input
                type="text"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                placeholder="e.g., Clean consolidation"
                className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
            >
              Save Rule
            </button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="p-5 rounded-2xl bg-[#161618] border border-white/5 hover:border-white/10 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-medium text-gray-200 leading-tight">{rule.name}</h3>
                <span className="text-xs text-gray-500 mt-1 block">Binary rule: Yes / No</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => updateRule(rule.id, { enabled: !rule.enabled })}
                  className={`p-1.5 rounded-lg transition-colors ${rule.enabled ? 'text-green-400 hover:bg-green-400/10' : 'text-gray-500 hover:bg-white/5'}`}
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${rule.enabled ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-500'}`}>
                {rule.enabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
