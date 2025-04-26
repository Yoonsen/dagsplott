import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import { saveAs } from 'file-saver';

const colorPalette = [
  'rgb(255, 99, 132)',    // red
  'rgb(54, 162, 235)',    // blue
  'rgb(255, 206, 86)',    // yellow
  'rgb(75, 192, 192)',    // green
  'rgb(153, 102, 255)',   // purple
  'rgb(255, 159, 64)',    // orange
];



export default function App() {
  const [word, setWord] = useState('akevitt, whisky, vodka,  cognac, konjakk');
  const [startDate, setStartDate] = useState('2016-01-01');
  const [endDate, setEndDate] = useState('2020-12-31');
  const [data, setData] = useState(null);
  const [rawGrouped, setRawGrouped] = useState(null);
  const [allDates, setAllDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [smooth, setSmooth] = useState(8);
  const [cumulative, setCumulative] = useState(false);
    const [wordColorMap, setWordColorMap] = useState({});
  
    const chartRef = useRef(null); 
  
    const format = date => date.replace(/-/g, '');

  const [showDatePopup, setShowDatePopup] = useState(false);
    const [cohort, setCohort] = useState(false);
   const [mode, setMode] = useState('absolute');
 
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
    
const assignColors = (words, existingMap) => {
  // Lag et nytt map basert på gamle, men bare med ord som fortsatt finnes
  const newMap = {};
  const usedColors = new Set();

  words.forEach(w => {
    if (existingMap[w]) {
      newMap[w] = existingMap[w];
      usedColors.add(existingMap[w]);
    }
  });

  // Finn neste ledige farge
  let colorIndex = 0;
  words.forEach(w => {
    if (!newMap[w]) {
      while (usedColors.has(colorPalette[colorIndex % colorPalette.length])) {
        colorIndex++;
      }
      newMap[w] = colorPalette[colorIndex % colorPalette.length];
      usedColors.add(colorPalette[colorIndex % colorPalette.length]);
      colorIndex++;
    }
  });

  return newMap;
};


// Define the makeNbQuery function at the top or inside the component
const makeNbQuery = (name, start_date, end_date) => {
  return "https://www.nb.no/search?mediatype=aviser&" + new URLSearchParams({
    q: name,
    fromDate: start_date.replace(/-/g, ""),
    toDate: end_date.replace(/-/g, "")
  }).toString();
};
    
const handleChartClick = (event, chart) => {
  // Ensure the chart is available
  if (chart) {
    // Use the event to get the clicked elements
    const activePoints = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true });

    // If there's a valid active point (the user clicked on something)
    if (activePoints.length > 0) {
      const clickedElementIndex = activePoints[0].index;
      const datasetIndex = activePoints[0].datasetIndex;

      const clickedData = chart.data.datasets[datasetIndex].data[clickedElementIndex];  // Get the clicked data point
      const label = chart.data.labels[clickedElementIndex]; // Get the corresponding label (e.g., the date)

      // Now, create the query URL using the clicked word and date
      const word = chart.data.datasets[datasetIndex].label;  // Get the word from the dataset
      const searchUrl = makeNbQuery(word, label, label);  // Assuming `label` is the date, you can adjust as needed

      // Open the URL in a new tab
      window.open(searchUrl, '_blank');
    }
  }
};



const buildDatasets = (grouped, dates, smoothing, mode, colorMap) => {
  const wordEntries = Object.entries(grouped);

  let allY = wordEntries.map(([_, counts]) =>
    dates.map(date => counts[date] || 0)
  );

  if (mode === "cohort") {
    const totals = dates.map((_, i) =>
      allY.reduce((sum, series) => sum + series[i], 0)
    );
    allY = allY.map(series =>
      series.map((val, i) => totals[i] ? val / totals[i] : 0)
    );
  } else if (mode === "cumulative") {
    allY = allY.map(series =>
      series.reduce((acc, val, i) => [...acc, val + (acc[i - 1] || 0)], [])
    );
  }

  allY = allY.map(series => smoothArray(series, smoothing));

  return wordEntries.map(([w], idx) => ({
    label: w,
    data: allY[idx],
    fill: false,
    borderColor: colorMap[w] || colorPalette[idx % colorPalette.length],
    tension: 0.1,
    pointRadius: 0
  }));
};


const fetchData = async () => {
  setLoading(true);
  try {
      
    const words = word.split(',').map(w => w.trim()).filter(w => w);
    const format = date => date.replace(/-/g, '');

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

    // Generate all dates in range
    const dateRange = [];
    let curr = new Date(startDate);
    const end = new Date(endDate);
    while (curr <= end) {
      const ymd = curr.toISOString().split('T')[0].replace(/-/g, '');
      dateRange.push(ymd);
      curr.setDate(curr.getDate() + 1);
    }

    // Unpack and fill zeros
    const grouped = {};
    Object.entries(json).forEach(([key, count]) => {
      const [w, date] = key.split(' ');
      if (!grouped[w]) grouped[w] = {};
      grouped[w][date] = count;
    });

    for (const w of words) {
      if (!grouped[w]) grouped[w] = {};
      dateRange.forEach(date => {
        if (!(date in grouped[w])) grouped[w][date] = 0;
      });
    }

    setRawGrouped(grouped);
    setAllDates(dateRange);
      
    const newColorMap = assignColors(words, wordColorMap);
    setWordColorMap(newColorMap);
    const datasets = buildDatasets(grouped, dateRange, smooth, mode, newColorMap);

    setData({ labels: dateRange, datasets });
  } catch (e) {
    console.error('Error fetching data:', e);
  } finally {
    setLoading(false);
  }
};

    

useEffect(() => {
  if (rawGrouped && allDates.length) {
    const datasets = buildDatasets(rawGrouped, allDates, smooth, mode, wordColorMap);
    setData({ labels: allDates, datasets });
  }
}, [cumulative, smooth, mode, wordColorMap]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') fetchData();
  };

// PNG
const downloadChartImage = () => {
  if (chartRef.current) {
    const chart = chartRef.current; // Access the chart object
    const image = chart.toBase64Image(); // Generate the image as a Base64 string
    const link = document.createElement('a');
    link.href = image; // Set the href to the Base64 image data
    link.download = 'chart.png'; // Set the download filename
    link.click();  // Trigger the download
  }
};



    
// CSV
const downloadCSV = () => {
  const rows = [];
  const labels = data.labels; // These should be your dates
  const datasets = data.datasets;

  // Add headers (labels)
  rows.push(['Date', ...datasets.map(dataset => dataset.label)]);

  // Add data rows
  for (let i = 0; i < labels.length; i++) {
    const row = [labels[i]];  // Add the date as the first column
    datasets.forEach(dataset => row.push(dataset.data[i]));  // Add the corresponding count for each dataset
    rows.push(row);
  }

  // Convert rows to CSV format
  const csvContent = rows.map(row => row.join(',')).join('\n');

  // Create a Blob from the CSV data
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, 'chart-data.csv');
};
    
  return (
<div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 font-sans">
  <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-3xl px-4 py-6 space-y-2">
    <h6 className="text-2xl font-semibold text-center text-slate-800 tracking-tight">📰 Dagsplott</h6>

    {/* First Row: Input and Fetch */}
<div className="relative w-full">
  {/* Input felt */}
  <input
    className="w-full border border-slate-300 p-3 pl-10 pr-20 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
    value={word}
    onChange={e => setWord(e.target.value)}
    onKeyDown={handleKeyDown}
    placeholder="pizza, sushi"
  />
  
  {/* Søkeknapp */}
  <button
    onClick={fetchData}
    className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xl text-slate-500 hover:text-slate-700 focus:outline-none"
  >
    🔍
  </button>

  {/* Kalenderknapp */}
  <button
    onClick={() => setShowDatePopup(!showDatePopup)}
    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xl text-slate-500 hover:text-slate-700 focus:outline-none"
  >
    🗓
  </button>

  {/* Dato-popup */}
  {showDatePopup && (
    <div className="absolute right-0 mt-2 bg-white border border-slate-300 rounded-md shadow-md p-4 z-10">
      <div className="mb-2">
        <label className="block text-xs text-slate-600">Start</label>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full border border-slate-300 p-2 rounded"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-600">Ende</label>
        <input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full border border-slate-300 p-2 rounded"
        />
      </div>
    </div>
  )}
</div>


    {/* Second Row: Date (with Calendar), Cohort, Cumulative, Smoothing */}
<div className="flex flex-wrap gap-4 pt-4">
  {/* Visning */}
<div className="relative">
  <select
    value={mode}
    onChange={e => setMode(e.target.value)}
    className="appearance-none border border-slate-200 rounded p-2 pr-8 bg-slate-100"
  >
    <option value="absolute">Absolutt</option>
    <option value="cumulative">Kumulativ</option>
    <option value="cohort">Kohort</option>
  </select>
  <div className="pointer-events-none absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-500">
    ▼
  </div>
</div>


  {/* Glatting */}
<div className="flex items-center gap-1">
  <label className="text-sm text-slate-700 mr-2">Glatte</label>
  <div className="flex items-center border border-slate-300 rounded overflow-hidden">
    <button
      className="px-3 py-1 bg-slate-100 hover:bg-slate-300 text-sm"
      onClick={() => setSmooth(s => Math.max(1, s - 1))}
    >-</button>
    <span className="px-3">{smooth}</span>
    <button
      className="px-3 py-1 bg-slate-100 hover:bg-slate-300 text-sm"
      onClick={() => setSmooth(s => Math.min(31, s + 1))}
    >+</button>
  </div>
</div>


</div>


    {/* Graph */}
    {loading && <p className="text-center text-blue-600">Loading...</p>}
    {data && (
      <div className="pt-4 max-h-[70vh] sm:max-h-[80vh] overflow-y-auto">        
          <Line 
  ref={chartRef} 
  data={data} 
  options={{
    onClick: (event) => handleChartClick(event, chartRef.current) // Ensure it's properly passed
  }} 
/>
      </div>
    )}

    {/* Download Buttons */}
    {data && (
      <div className="flex justify-between pt-6">
        <button onClick={downloadChartImage} className="text-slate px-4 py-2 rounded">
          🖼️ Last ned graf (PNG)
        </button>
        <button onClick={downloadCSV} className="text-slate px-4 py-2 rounded">
          📄 Last ned data (CSV)
        </button>
      </div>
    )}
  </div>
    <p className="text-center text-xs text-slate-400 pt-6">
  Dagsplott v1.0 © 2025
</p>
</div>

  );
}
