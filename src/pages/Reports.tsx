import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Download, Printer, FileText, BarChart2, Filter } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('inventory');
  const [data, setData] = useState<any[]>([]);
  
  // Filter states
  const [categories, setCategories] = useState<string[]>([]);
  const [barangays, setBarangays] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [reportType, selectedCategory, selectedBarangay]);

  const fetchFilterOptions = async () => {
    try {
      // Fetch unique categories
      const { data: invData } = await supabase.from('inventory').select('category');
      if (invData) {
        const uniqueCategories = Array.from(new Set(invData.map(item => item.category))).filter(Boolean);
        setCategories(uniqueCategories as string[]);
      }

      // Fetch unique barangays
      const { data: recData } = await supabase.from('recipients').select('barangay');
      if (recData) {
        const uniqueBarangays = Array.from(new Set(recData.map(item => item.barangay))).filter(Boolean);
        setBarangays(uniqueBarangays as string[]);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (reportType === 'inventory') {
        let query = supabase.from('inventory').select('*').order('category');
        if (selectedCategory) {
          query = query.eq('category', selectedCategory);
        }
        const { data: invData, error } = await query;
        if (error) throw error;
        setData(invData || []);
      } else if (reportType === 'recipients') {
        let query = supabase.from('recipients').select('*').order('barangay');
        if (selectedBarangay) {
          query = query.eq('barangay', selectedBarangay);
        }
        const { data: recData, error } = await query;
        if (error) throw error;
        setData(recData || []);
      } else if (reportType === 'summary') {
        // Group distributions by category
        let query = supabase
          .from('distributions')
          .select('quantity, inventory!inner(category, name), recipients!inner(barangay)');
          
        if (selectedCategory) {
          query = query.eq('inventory.category', selectedCategory);
        }
        if (selectedBarangay) {
          query = query.eq('recipients.barangay', selectedBarangay);
        }

        const { data: distData, error } = await query;
        if (error) throw error;
        
        // Aggregate data
        const summary: Record<string, number> = {};
        (distData || []).forEach((d: any) => {
          const cat = d.inventory?.category || 'UNKNOWN';
          summary[cat] = (summary[cat] || 0) + d.quantity;
        });
        
        setData(Object.entries(summary).map(([category, total]) => ({ category, total })));
      } else if (reportType === 'recipient_distributions') {
        let query = supabase
          .from('distributions')
          .select('quantity, inventory!inner(category, name, unit), recipients!inner(rsbsa_number, first_name, last_name, barangay)');
          
        if (selectedCategory) {
          query = query.eq('inventory.category', selectedCategory);
        }
        if (selectedBarangay) {
          query = query.eq('recipients.barangay', selectedBarangay);
        }

        const { data: distData, error } = await query;
        if (error) throw error;
        
        // Aggregate data by recipient and item
        const summary: Record<string, any> = {};
        (distData || []).forEach((d: any) => {
          const rec = d.recipients;
          const inv = d.inventory;
          const key = `${rec.rsbsa_number}_${inv.category}_${inv.name}`;
          
          if (!summary[key]) {
            summary[key] = {
              rsbsa_number: rec.rsbsa_number,
              name: `${rec.last_name}, ${rec.first_name}`,
              barangay: rec.barangay,
              category: inv.category,
              item_name: inv.name,
              unit: inv.unit,
              total_quantity: 0
            };
          }
          summary[key].total_quantity += d.quantity;
        });
        
        const aggregatedData = Object.values(summary).sort((a: any, b: any) => {
          if (a.name !== b.name) return a.name.localeCompare(b.name);
          return a.category.localeCompare(b.category);
        });
        
        setData(aggregatedData);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`MAO RSBSA - ${reportType.toUpperCase()} REPORT`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 14, 30);
    
    let filterText = '';
    if (reportType === 'inventory' && selectedCategory) filterText = `Category: ${selectedCategory}`;
    if (reportType === 'recipients' && selectedBarangay) filterText = `Barangay: ${selectedBarangay}`;
    if (reportType === 'summary' || reportType === 'recipient_distributions') {
      const filters = [];
      if (selectedCategory) filters.push(`Category: ${selectedCategory}`);
      if (selectedBarangay) filters.push(`Barangay: ${selectedBarangay}`);
      filterText = filters.join(' | ');
    }
    
    if (filterText) {
      doc.text(`Filters: ${filterText}`, 14, 36);
    }

    let head: string[][] = [];
    let body: any[][] = [];

    if (reportType === 'inventory') {
      head = [['Item Name', 'Category', 'Quantity', 'Unit']];
      body = data.map(item => [item.name, item.category, item.quantity, item.unit]);
    } else if (reportType === 'recipients') {
      head = [['RSBSA No.', 'Name', 'Barangay', 'Municipality', 'Farm Area (ha)']];
      body = data.map(item => [item.rsbsa_number, `${item.last_name}, ${item.first_name}`, item.barangay, item.municipality, item.farm_area_hectares]);
    } else if (reportType === 'summary') {
      head = [['Category', 'Total Distributed Quantity']];
      body = data.map(item => [item.category, item.total]);
    } else if (reportType === 'recipient_distributions') {
      head = [['RSBSA No.', 'Name', 'Barangay', 'Category', 'Item Name', 'Total Qty']];
      body = data.map(item => [item.rsbsa_number, item.name, item.barangay, item.category, item.item_name, `${item.total_quantity} ${item.unit}`]);
    }

    autoTable(doc, {
      head: head,
      body: body,
      startY: filterText ? 42 : 36,
      theme: 'grid',
      headStyles: { fillColor: [5, 150, 105] }
    });

    doc.save(`mao_report_${reportType}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const handleExportCSV = () => {
    let headers: string[] = [];
    let csvData: any[][] = [];

    if (reportType === 'inventory') {
      headers = ['Item Name', 'Category', 'Quantity', 'Unit'];
      csvData = data.map(item => [`"${item.name}"`, item.category, item.quantity, item.unit]);
    } else if (reportType === 'recipients') {
      headers = ['RSBSA No.', 'Name', 'Barangay', 'Municipality', 'Farm Area (ha)'];
      csvData = data.map(item => [item.rsbsa_number, `"${item.last_name}, ${item.first_name}"`, `"${item.barangay}"`, `"${item.municipality}"`, item.farm_area_hectares]);
    } else if (reportType === 'summary') {
      headers = ['Category', 'Total Distributed Quantity'];
      csvData = data.map(item => [item.category, item.total]);
    } else if (reportType === 'recipient_distributions') {
      headers = ['RSBSA No.', 'Name', 'Barangay', 'Category', 'Item Name', 'Total Qty'];
      csvData = data.map(item => [item.rsbsa_number, `"${item.name}"`, `"${item.barangay}"`, item.category, `"${item.item_name}"`, `${item.total_quantity} ${item.unit}`]);
    }

    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `mao_report_${reportType}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">Generate and export system reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Report Controls */}
        <div className="bg-white shadow rounded-lg p-6 col-span-1">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Report Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Report Type</label>
              <div className="space-y-2">
                <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="reportType"
                    value="inventory"
                    checked={reportType === 'inventory'}
                    onChange={(e) => {
                      setReportType(e.target.value);
                      setSelectedBarangay(''); // Clear barangay filter when switching to inventory
                    }}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                  />
                  <span className="ml-3 flex flex-col">
                    <span className="block text-sm font-medium text-gray-900">Current Inventory</span>
                    <span className="block text-xs text-gray-500">List of all available items</span>
                  </span>
                </label>
                
                <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="reportType"
                    value="recipients"
                    checked={reportType === 'recipients'}
                    onChange={(e) => {
                      setReportType(e.target.value);
                      setSelectedCategory(''); // Clear category filter when switching to recipients
                    }}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                  />
                  <span className="ml-3 flex flex-col">
                    <span className="block text-sm font-medium text-gray-900">Registered Recipients</span>
                    <span className="block text-xs text-gray-500">List of all RSBSA farmers</span>
                  </span>
                </label>

                <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="reportType"
                    value="summary"
                    checked={reportType === 'summary'}
                    onChange={(e) => setReportType(e.target.value)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                  />
                  <span className="ml-3 flex flex-col">
                    <span className="block text-sm font-medium text-gray-900">Distribution Summary</span>
                    <span className="block text-xs text-gray-500">Aggregated distribution totals</span>
                  </span>
                </label>

                <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="reportType"
                    value="recipient_distributions"
                    checked={reportType === 'recipient_distributions'}
                    onChange={(e) => setReportType(e.target.value)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                  />
                  <span className="ml-3 flex flex-col">
                    <span className="block text-sm font-medium text-gray-900">Distribution by Recipient</span>
                    <span className="block text-xs text-gray-500">Aggregated items per farmer</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Filters */}
            <div className="pt-4 border-t border-gray-200 space-y-3">
              <h4 className="text-sm font-medium text-gray-900 flex items-center">
                <Filter className="h-4 w-4 mr-1 text-gray-500" />
                Filters
              </h4>
              
              {['inventory', 'summary', 'recipient_distributions'].includes(reportType) && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              {['recipients', 'summary', 'recipient_distributions'].includes(reportType) && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Barangay</label>
                  <select
                    value={selectedBarangay}
                    onChange={(e) => setSelectedBarangay(e.target.value)}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  >
                    <option value="">All Barangays</option>
                    {barangays.map(brgy => (
                      <option key={brgy} value={brgy}>{brgy}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200 space-y-3">
              <button
                onClick={handlePrintPDF}
                disabled={loading || data.length === 0}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                <Printer className="-ml-1 mr-2 h-5 w-5" />
                Generate PDF
              </button>
              <button
                onClick={handleExportCSV}
                disabled={loading || data.length === 0}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                <Download className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Report Preview */}
        <div className="bg-white shadow rounded-lg p-6 col-span-1 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-gray-400" />
              Report Preview
            </h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {data.length} records
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64 text-gray-500">Generating preview...</div>
          ) : data.length === 0 ? (
            <div className="flex justify-center items-center h-64 text-gray-500">No data available for this report.</div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {reportType === 'inventory' && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                      </>
                    )}
                    {reportType === 'recipients' && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">RSBSA No.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barangay</th>
                      </>
                    )}
                    {reportType === 'summary' && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Distributed</th>
                      </>
                    )}
                    {reportType === 'recipient_distributions' && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barangay</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.slice(0, 10).map((item, idx) => (
                    <tr key={idx}>
                      {reportType === 'inventory' && (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{item.category}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.quantity} {item.unit}</td>
                        </>
                      )}
                      {reportType === 'recipients' && (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.rsbsa_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.last_name}, {item.first_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{item.barangay}</td>
                        </>
                      )}
                      {reportType === 'summary' && (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.category}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-semibold">{item.total}</td>
                        </>
                      )}
                      {reportType === 'recipient_distributions' && (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{item.barangay}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div className="font-medium">{item.item_name}</div>
                            <div className="text-xs text-gray-500">{item.category}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-semibold">{item.total_quantity} {item.unit}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length > 10 && (
                <div className="bg-gray-50 px-4 py-3 text-center text-sm text-gray-500 border-t">
                  Showing 10 of {data.length} records. Export to view all.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
