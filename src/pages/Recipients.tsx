import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Recipient } from '../types';
import { Plus, Search, Edit2, Trash2, X, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Recipients() {
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<Recipient | null>(null);
  const [recipientHistory, setRecipientHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<Recipient | null>(null);
  const [recipientToDelete, setRecipientToDelete] = useState<Recipient | null>(null);
  const [formData, setFormData] = useState({
    rsbsa_number: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    barangay: '',
    municipality: '',
    province: '',
    contact_number: '',
    farm_area_hectares: '' as string | number,
    commodity: ''
  });

  const canEdit = user?.role === 'ADMIN' || user?.role === 'STAFF' || user?.role === 'ENCODER';

  useEffect(() => {
    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('recipients')
        .select('*')
        .order('last_name');
        
      if (error) throw error;
      setRecipients(data || []);
    } catch (error) {
      console.error('Error fetching recipients:', error);
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        farm_area_hectares: Number(formData.farm_area_hectares) || 0
      };
      
      if (editingItem) {
        const { error } = await supabase
          .from('recipients')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('recipients')
          .insert([payload]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchRecipients();
    } catch (error) {
      console.error('Error saving recipient:', error);
      alert('Failed to save recipient. Check console for details.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('recipients')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchRecipients();
    } catch (error) {
      console.error('Error deleting recipient:', error);
      alert('Failed to delete recipient.');
    }
  };

  const openViewModal = async (item: Recipient) => {
    setViewingItem(item);
    setIsViewModalOpen(true);
    setHistoryLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('distributions')
        .select(`
          id,
          date_distributed,
          quantity,
          inventory (name, category, unit, batch_number, expiration_date)
        `)
        .eq('recipient_id', item.id)
        .order('date_distributed', { ascending: false });
        
      if (error) throw error;
      setRecipientHistory(data || []);
    } catch (error) {
      console.error('Error fetching recipient history:', error);
      setRecipientHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openModal = (item?: Recipient) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        rsbsa_number: item.rsbsa_number,
        first_name: item.first_name,
        last_name: item.last_name,
        middle_name: item.middle_name || '',
        barangay: item.barangay,
        municipality: item.municipality,
        province: item.province,
        contact_number: item.contact_number || '',
        farm_area_hectares: item.farm_area_hectares,
        commodity: item.commodity
      });
    } else {
      setEditingItem(null);
      setFormData({
        rsbsa_number: '',
        first_name: '',
        last_name: '',
        middle_name: '',
        barangay: '',
        municipality: '',
        province: '',
        contact_number: '',
        farm_area_hectares: '',
        commodity: ''
      });
    }
    setIsModalOpen(true);
  };

  const filteredRecipients = recipients.filter(item => {
    const searchLower = search.toLowerCase();
    return (
      item.rsbsa_number.toLowerCase().includes(searchLower) ||
      item.first_name.toLowerCase().includes(searchLower) ||
      item.last_name.toLowerCase().includes(searchLower) ||
      item.barangay.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recipient Registration</h1>
          <p className="mt-1 text-sm text-gray-500">Manage RSBSA registered farmers and fisherfolks</p>
        </div>
        {canEdit && (
          <button
            onClick={() => openModal()}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Recipient
          </button>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by name, RSBSA number, or barangay..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading recipients...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RSBSA No.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Farm Info</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRecipients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No recipients found
                    </td>
                  </tr>
                ) : (
                  filteredRecipients.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.rsbsa_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.last_name}, {item.first_name} {item.middle_name?.charAt(0)}.
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.barangay}, {item.municipality}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.farm_area_hectares} ha - {item.commodity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => openViewModal(item)} className="text-blue-600 hover:text-blue-900 mr-4" title="View History">
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <>
                            <button onClick={() => openModal(item)} className="text-emerald-600 hover:text-emerald-900 mr-4" title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setRecipientToDelete(item)} className="text-red-600 hover:text-red-900" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-500 opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>

          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {editingItem ? 'Edit Recipient' : 'Add New Recipient'}
                    </h3>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-6">
                      <label className="block text-sm font-medium text-gray-700">RSBSA Number</label>
                      <input
                        type="text"
                        required
                        value={formData.rsbsa_number}
                        onChange={(e) => setFormData({...formData, rsbsa_number: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">First Name</label>
                      <input
                        type="text"
                        required
                        value={formData.first_name}
                        onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                      />
                    </div>
                    
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Last Name</label>
                      <input
                        type="text"
                        required
                        value={formData.last_name}
                        onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Middle Name</label>
                      <input
                        type="text"
                        value={formData.middle_name}
                        onChange={(e) => setFormData({...formData, middle_name: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Barangay</label>
                      <input
                        type="text"
                        required
                        value={formData.barangay}
                        onChange={(e) => setFormData({...formData, barangay: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Municipality</label>
                      <input
                        type="text"
                        required
                        value={formData.municipality}
                        onChange={(e) => setFormData({...formData, municipality: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Province</label>
                      <input
                        type="text"
                        required
                        value={formData.province}
                        onChange={(e) => setFormData({...formData, province: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Contact Number</label>
                      <input
                        type="text"
                        value={formData.contact_number}
                        onChange={(e) => setFormData({...formData, contact_number: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Farm Area (Hectares)</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={formData.farm_area_hectares}
                        onChange={(e) => setFormData({...formData, farm_area_hectares: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Commodity</label>
                      <input
                        type="text"
                        required
                        value={formData.commodity}
                        onChange={(e) => setFormData({...formData, commodity: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-emerald-600 text-base font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* View History Modal */}
      {isViewModalOpen && viewingItem && (
        <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-500 opacity-75 transition-opacity" onClick={() => setIsViewModalOpen(false)}></div>

          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Recipient Information & History
                    </h3>
                    <button type="button" onClick={() => setIsViewModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium">{viewingItem.first_name} {viewingItem.middle_name ? viewingItem.middle_name + ' ' : ''}{viewingItem.last_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">RSBSA Number</p>
                      <p className="font-medium">{viewingItem.rsbsa_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-medium">{viewingItem.barangay}, {viewingItem.municipality}, {viewingItem.province}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Farm Info</p>
                      <p className="font-medium">{viewingItem.farm_area_hectares} ha - {viewingItem.commodity}</p>
                    </div>
                  </div>

                  <h4 className="text-md font-medium text-gray-900 mb-3">Distribution History</h4>
                  
                  {historyLoading ? (
                    <div className="text-center py-4 text-sm text-gray-500">Loading history...</div>
                  ) : recipientHistory.length === 0 ? (
                    <div className="text-center py-4 text-sm text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      No distribution records found for this recipient.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch / Exp</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {recipientHistory.map((record) => (
                            <tr key={record.id}>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {new Date(record.date_distributed).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {record.inventory?.name || 'Unknown Item'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {record.inventory?.batch_number && <div className="font-medium text-gray-900">Batch: {record.inventory.batch_number}</div>}
                                {record.inventory?.expiration_date && <div className="text-xs">Exp: {new Date(record.inventory.expiration_date).toLocaleDateString()}</div>}
                                {!record.inventory?.batch_number && !record.inventory?.expiration_date && <span className="text-gray-400">-</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {record.inventory?.category || 'N/A'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {record.quantity} {record.inventory?.unit || ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={() => setIsViewModalOpen(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {recipientToDelete && (
        <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-500 opacity-75 transition-opacity" onClick={() => setRecipientToDelete(null)}></div>

          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                      <Trash2 className="h-6 w-6 text-red-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                      <h3 className="text-lg font-medium leading-6 text-gray-900" id="modal-title">
                        Delete Recipient
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Are you sure you want to delete <strong>{recipientToDelete.first_name} {recipientToDelete.last_name}</strong>? This action cannot be undone.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button
                    type="button"
                    onClick={() => {
                      handleDelete(recipientToDelete.id);
                      setRecipientToDelete(null);
                    }}
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipientToDelete(null)}
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
