import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Distribution } from '../types';
import { Search, Download, Printer } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function DistributionLog() {
  const [logs, setLogs] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('distributions')
        .select(`
          *,
          recipient:recipients(*),
          inventory:inventory(*),
          distributor:profiles(*)
        `)
        .order('date_distributed', { ascending: false });
        
      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const getDistributorName = (log: Distribution) => {
    if (log.remarks && log.remarks.startsWith('Distributor: ')) {
      const firstLine = log.remarks.split('\n')[0];
      return firstLine.replace('Distributor: ', '').trim();
    }
    return log.distributor?.name || '';
  };

  const getCleanRemarks = (log: Distribution) => {
    if (log.remarks && log.remarks.startsWith('Distributor: ')) {
      const parts = log.remarks.split('\n');
      if (parts.length > 1) {
        return parts.slice(1).join('\n');
      }
      return '';
    }
    return log.remarks || '';
  };

  const filteredLogs = logs.filter(log => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      log.recipient?.last_name.toLowerCase().includes(searchLower) ||
      log.recipient?.first_name.toLowerCase().includes(searchLower) ||
      log.inventory?.name.toLowerCase().includes(searchLower) ||
      log.recipient?.rsbsa_number.toLowerCase().includes(searchLower);
      
    const matchesDate = dateFilter ? log.date_distributed.startsWith(dateFilter) : true;
    const matchesCategory = categoryFilter ? log.inventory?.category === categoryFilter : true;
    
    return matchesSearch && matchesDate && matchesCategory;
  });

  const handleExportCSV = () => {
    const headers = ['Date', 'RSBSA Number', 'Recipient Name', 'Barangay', 'Item', 'Batch Number', 'Expiration Date', 'Category', 'Quantity', 'Unit', 'Distributed By', 'Remarks'];
    const csvData = filteredLogs.map(log => [
      format(new Date(log.date_distributed), 'yyyy-MM-dd HH:mm'),
      log.recipient?.rsbsa_number || '',
      `"${log.recipient?.last_name}, ${log.recipient?.first_name}"`,
      log.recipient?.barangay || '',
      `"${log.inventory?.name || ''}"`,
      `"${log.inventory?.batch_number || ''}"`,
      `"${log.inventory?.expiration_date || ''}"`,
      log.inventory?.category || '',
      log.quantity,
      log.inventory?.unit || '',
      `"${getDistributorName(log)}"`,
      `"${getCleanRemarks(log)}"`
    ]);

    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `distribution_log_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Distribution Log Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 14, 30);
    
    const tableColumn = ["Date", "Recipient", "RSBSA No.", "Item", "Batch/Exp", "Qty", "Unit", "Distributor"];
    const tableRows = filteredLogs.map(log => [
      format(new Date(log.date_distributed), 'yyyy-MM-dd'),
      `${log.recipient?.last_name}, ${log.recipient?.first_name}`,
      log.recipient?.rsbsa_number || '',
      log.inventory?.name || '',
      `${log.inventory?.batch_number ? 'B:' + log.inventory.batch_number : ''} ${log.inventory?.expiration_date ? 'E:' + log.inventory.expiration_date : ''}`.trim(),
      log.quantity,
      log.inventory?.unit || '',
      getDistributorName(log)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [5, 150, 105] } // Emerald 600
    });

    doc.save(`distribution_log_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Distribution Log</h1>
          <p className="mt-1 text-sm text-gray-500">History of all distributed items</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handlePrintPDF}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
          >
            <Printer className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
            Print PDF
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
          >
            <Download className="-ml-1 mr-2 h-5 w-5" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            />
          </div>
          <div className="sm:w-48">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-md"
            >
              <option value="">All Categories</option>
              <option value="SEEDS">Seeds</option>
              <option value="FERTILIZER_ORGANIC">Organic Fertilizer</option>
              <option value="FERTILIZER_INORGANIC">Inorganic Fertilizer</option>
              <option value="DEWORMING">Deworming</option>
              <option value="ANTI_RABIES">Anti-Rabies</option>
              <option value="PESTICIDES">Pesticides</option>
            </select>
          </div>
          <div className="sm:w-48">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-md"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading logs...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch/Exp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distributed By</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      No distribution logs found
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(log.date_distributed), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {log.recipient?.last_name}, {log.recipient?.first_name}
                        </div>
                        <div className="text-sm text-gray-500">{log.recipient?.rsbsa_number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{log.inventory?.name}</div>
                        <div className="text-xs text-gray-500">{log.inventory?.category}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.inventory?.batch_number && <div className="text-gray-900">Batch: {log.inventory.batch_number}</div>}
                        {log.inventory?.expiration_date && <div className="text-xs">Exp: {log.inventory.expiration_date}</div>}
                        {!log.inventory?.batch_number && !log.inventory?.expiration_date && <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.inventory?.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getDistributorName(log)}
                        {getCleanRemarks(log) && (
                          <div className="text-xs text-gray-400 mt-1 truncate max-w-[150px]" title={getCleanRemarks(log)}>
                            {getCleanRemarks(log)}
                          </div>
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
    </div>
  );
}
