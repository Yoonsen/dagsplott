import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

export default function App() {
  const [word, setWord] = useState('sushi');
  const [startDate, setStartDate] = useState('2010');
  const [endDate, setEndDate] = useState('2020');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://api.nb.no/dhlab/ngram_newspapers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          period: [parseInt(startDate), parseInt(endDate)],
          word: [word]
        })
      });

      const json = await response.json();

      // Parse format: { 'word year': value, ... }
      const grouped = {};
      Object.entries(json).forEach(([key, count]) => {
        const [w, year] = key.split(' ');
        if (!grouped[w]) grouped[w] = {};
        grouped[w][year] = count;
      });

      const labels = Array.from({ length: endDate - startDate + 1 }, (_, i) => (parseInt(startDate) + i).toString());

      const datasets = Object.entries(grouped).map(([w, counts]) => ({
        label: w,
        data: labels.map(year => counts[year] || 0),
        fill: false,
        borderColor: w === 'sushi' ? 'rgb(255, 99, 132)' : 'rgb(75, 192, 192)',
        tension: 0.1
      }));

      setData({ labels, datasets });
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Daily Ngram Plot</h1>
      <div className="mb-4 space-y-2">
        <input className="border p-2 w-full" value={word} onChange={e => setWord(e.target.value)} placeholder="Word (e.g. sushi, pizza)" />
        <input className="border p-2 w-full" type="number" value={startDate} onChange={e => setStartDate(e.target.value)} placeholder="Start year" />
        <input className="border p-2 w-full" type="number" value={endDate} onChange={e => setEndDate(e.target.value)} placeholder="End year" />
        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={fetchData}>Fetch</button>
      </div>
      {loading && <p>Laster...</p>}
      {data && <Line data={data} />}
    </div>
  );
}
