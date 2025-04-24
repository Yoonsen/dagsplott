import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

const colorPalette = [
  'rgb(255, 99, 132)',    // red
  'rgb(54, 162, 235)',    // blue
  'rgb(255, 206, 86)',    // yellow
  'rgb(75, 192, 192)',    // green
  'rgb(153, 102, 255)',   // purple
  'rgb(255, 159, 64)',    // orange
];



export default function App() {
  const [word, setWord] = useState('sushi, pizza');
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState('2020-12-31');
  const [data, setData] = useState(null);
  const [rawGrouped, setRawGrouped] = useState(null);
  const [allDates, setAllDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [smooth, setSmooth] = useState(1);
  const [cumulative, setCumulative] = useState(false);

  const format = date => date.replace(/-/g, '');

  const [showDatePopup, setShowDatePopup] = useState(false);
    const [cohort, setCohort] = useState(false);
    
  const smoothArray = (arr, k) => {
    if (k <= 1) return arr;
    return arr.map((_, i, a) => {
      const start = Math.max(0, i - Math.floor(k / 2));
      const end = Math.min(a.length, i + Math.ceil(k / 2));
      const slice = a.slice(start, end);
      const valid = slice.filter(v => typeof v === 'number');
      return valid.reduce((sum, val) => sum + val, 0) / valid.length;
    });
  };

 const buildDatasets = (grouped, dates, cum, smoothing, cohortMode) => {
  let allY = Object.entries(grouped).map(([_, counts]) => 
    dates.map(date => counts[date] || 0)
  );

  if (cohortMode) {
    const totals = dates.map((_, i) => 
      allY.reduce((sum, series) => sum + series[i], 0)
    );
    allY = allY.map(series => 
      series.map((val, i) => totals[i] ? val / totals[i] : 0)
    );
  } else if (cum) {
    allY = allY.map(series => 
      series.reduce((acc, val, i) => [...acc, val + (acc[i - 1] || 0)], [])
    );
  }

  allY = allY.map(series => smoothArray(series, smoothing));

  return Object.keys(grouped).map((w, idx) => ({
    label: w,
    data: allY[idx],
    fill: false,
    borderColor: colorPalette[idx % colorPalette.length],
    tension: 0.1,
    pointRadius: 0
  }));
};

  const fetchData = async () => {
    setLoading(true);
    try {
      const words = word.split(',').map(w => w.trim()).filter(w => w);

      const response = await fetch('https://api.nb.no/dhlab/ngram_newspapers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          period: [parseInt(format(startDate)), parseInt(format(endDate))],
          word: words
        })
      });

      const json = await response.json();

      const grouped = {};
      Object.entries(json).forEach(([key, count]) => {
        const [w, date] = key.split(' ');
        if (!grouped[w]) grouped[w] = {};
        grouped[w][date] = count;
      });

      const dates = Object.values(grouped)[0] ? Object.keys(Object.values(grouped)[0]).sort() : [];
      setRawGrouped(grouped);
      setAllDates(dates);

     const datasets = buildDatasets(grouped, dates, cumulative, smooth, cohort);

      setData({ labels: dates, datasets });
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  };
    

useEffect(() => {
  if (rawGrouped && allDates.length) {
    const datasets = buildDatasets(rawGrouped, allDates, cumulative, smooth, cohort);
    setData({ labels: allDates, datasets });
  }
}, [cumulative, smooth, cohort]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') fetchData();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 font-sans">
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-3xl px-8 py-10 space-y-8">
        <h1 className="text-4xl font-bold text-center text-slate-800 tracking-tight">📰 Dagsplott</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Words</label>
            <input
              className="w-full border border-slate-300 p-3 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              value={word}
              onChange={e => setWord(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="pizza, sushi"
            />
          </div>
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Date range</label>
              <button
                onClick={() => setShowDatePopup(!showDatePopup)}
                className="w-full border border-slate-300 p-3 rounded-md bg-white focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
              >
                📅 {startDate} – {endDate}
              </button>
            
              {showDatePopup && (
                <div className="absolute z-10 bg-white border border-slate-300 rounded-md shadow-md mt-2 p-4 space-y-2 w-full">
                  <div>
                    <label className="block text-xs text-slate-600">Start</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-slate-300 p-2 rounded" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600">End</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-slate-300 p-2 rounded" />
                  </div>
                </div>
              )}
            </div>
  <div className="pt-6">
    <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={fetchData}>
      🔍 Finn
    </button>
  </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-700">Smoothing</label>
              <button
                className="px-2 py-1 bg-slate-200 rounded"
                onClick={() => setSmooth(s => Math.max(1, s - 1))}
              >-</button>
              <span className="w-8 text-center">{smooth}</span>
              <button
                className="px-2 py-1 bg-slate-200 rounded"
                onClick={() => setSmooth(s => Math.min(31, s + 1))}
              >+</button>
            </div>

          <div className="flex items-end gap-3 pt-6">
            <input type="checkbox" id="cumulative" checked={cumulative} onChange={e => setCumulative(e.target.checked)} />
            <label htmlFor="cumulative" className="text-slate-700">Cumulative</label>
              <input type="checkbox" id="cohort" checked={cohort} onChange={e => setCohort(e.target.checked)} />
<label htmlFor="cohort">Cohort mode</label>
          </div>
        </div>



        {loading && <p className="text-center text-blue-600">Loading...</p>}
        {data && <div className="pt-4"><Line data={data} /></div>}
      </div>
    </div>
  );
}
