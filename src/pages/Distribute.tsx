import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Recipient, InventoryItem } from '../types';
import { Search, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Distribute() {
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchRecipient, setSearchRecipient] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState<string | number>('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch recipients
      const { data: recData, error: recError } = await supabase
        .from('recipients')
        .select('*')
        .order('last_name');
      
      // Fetch inventory
      const { data: invData, error: invError } = await supabase
        .from('inventory')
        .select('*')
        .gt('quantity', 0)
        .order('name');
        
      if (recError || invError) throw recError || invError;
      
      setRecipients(recData || []);
      setInventory(invData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setRecipients([]);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDistribute = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQuantity = Number(quantity);
    if (!selectedRecipient || !selectedItem || !numQuantity || numQuantity <= 0) {
      alert('Please fill all required fields correctly.');
      return;
    }

    const item = inventory.find(i => i.id === selectedItem);
    if (!item || item.quantity < numQuantity) {
      alert('Insufficient inventory quantity.');
      return;
    }

    setSubmitting(true);
    try {
      // Ensure user profile exists (fallback for development)
      if (user?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();
          
        if (!profileData) {
          await supabase.from('profiles').insert([{
            id: user.id,
            email: user.email || 'dev@example.com',
            name: user.name || 'Dev User',
            role: user.role || 'ADMIN'
          }]);
        }
      }

      // 1. Record distribution
      const { error: distError } = await supabase
        .from('distributions')
        .insert([{
          recipient_id: selectedRecipient.id,
          inventory_id: selectedItem,
          quantity: numQuantity,
          date_distributed: new Date().toISOString(),
          distributed_by: user?.id,
          remarks
        }]);

      if (distError) throw distError;

      // 2. Update inventory
      const { error: invError } = await supabase
        .from('inventory')
        .update({ quantity: item.quantity - numQuantity })
        .eq('id', selectedItem);

      if (invError) throw invError;

      alert('Distribution recorded successfully!');
      
      // Reset form
      setSelectedRecipient(null);
      setSearchRecipient('');
      setSelectedItem('');
      setQuantity('');
      setRemarks('');
      
      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Error recording distribution:', error);
      alert('Failed to record distribution. Check console for details.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecipients = searchRecipient === '' ? [] : recipients.filter(item => {
    const searchLower = searchRecipient.toLowerCase();
    return (
      item.rsbsa_number.toLowerCase().includes(searchLower) ||
      item.first_name.toLowerCase().includes(searchLower) ||
      item.last_name.toLowerCase().includes(searchLower)
    );
  }).slice(0, 5); // Limit to 5 results

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Record Distribution</h1>
        <p className="mt-1 text-sm text-gray-500">Distribute items to registered recipients</p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleDistribute} className="space-y-6">
          
          {/* Step 1: Select Recipient */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">1. Select Recipient</h3>
            {!selectedRecipient ? (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name or RSBSA number..."
                  value={searchRecipient}
                  onChange={(e) => setSearchRecipient(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                />
                
                {searchRecipient && (
                  <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-auto">
                    {filteredRecipients.length > 0 ? (
                      <ul className="divide-y divide-gray-200">
                        {filteredRecipients.map(rec => (
                          <li 
                            key={rec.id}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer"
                            onClick={() => {
                              setSelectedRecipient(rec);
                              setSearchRecipient('');
                            }}
                          >
                            <div className="font-medium text-gray-900">{rec.last_name}, {rec.first_name}</div>
                            <div className="text-sm text-gray-500">RSBSA: {rec.rsbsa_number} | {rec.barangay}</div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500">No recipients found.</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 flex justify-between items-center">
                <div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-emerald-500 mr-2" />
                    <span className="font-medium text-emerald-900">{selectedRecipient.last_name}, {selectedRecipient.first_name}</span>
                  </div>
                  <div className="text-sm text-emerald-700 mt-1 ml-7">
                    RSBSA: {selectedRecipient.rsbsa_number} | {selectedRecipient.barangay}, {selectedRecipient.municipality}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecipient(null)}
                  className="text-sm text-emerald-600 hover:text-emerald-800 font-medium"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          <hr className="border-gray-200" />

          {/* Step 2: Select Item & Quantity */}
          <div className={!selectedRecipient ? 'opacity-50 pointer-events-none' : ''}>
            <h3 className="text-lg font-medium text-gray-900 mb-4">2. Distribution Details</h3>
            
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <label className="block text-sm font-medium text-gray-700">Inventory Item</label>
                <select
                  required
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                >
                  <option value="">Select an item...</option>
                  {inventory.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.quantity} {item.unit} available)
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Quantity</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  max={selectedItem ? inventory.find(i => i.id === selectedItem)?.quantity : undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-sm font-medium text-gray-700">Remarks (Optional)</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  placeholder="Any additional notes..."
                />
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-gray-200">
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!selectedRecipient || !selectedItem || submitting}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                {submitting ? 'Recording...' : 'Record Distribution'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
