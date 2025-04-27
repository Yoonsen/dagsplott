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
  const [word, setWord] = useState('pinnekjøtt, ribbe, akevitt, lammelår');
  const [startDate, setStartDate] = useState('2016-01-01');
  const [endDate, setEndDate] = useState('2020-12-31');
  const [data, setData] = useState(null);
  const [rawGrouped, setRawGrouped] = useState(null);
  const [allDates, setAllDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [smooth, setSmooth] = useState(8);
  const [cumulative, setCumulative] = useState(false);
    const [wordColorMap, setWordColorMap] = useState({});
  const [chartHeight, setChartHeight] = useState(400);  // Default høyde 400px

    const chartRef = useRef(null); 
  const [popup, setPopup] = useState(null); // { x, y, word, date }
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

const buildSearchUrl = (word, start, end) => {
  return "https://www.nb.no/search?mediatype=aviser&" + new URLSearchParams({
    q: word,
    fromDate: start,
    toDate: end
  }).toString();
};
    
const handleChartClick = (event, chart) => {
  if (chart) {
    const activePoints = chart.getElementsAtEventForMode(event.native, 'nearest', { intersect: true });

    if (activePoints.length > 0) {
      const clickedElementIndex = activePoints[0].index;
      const datasetIndex = activePoints[0].datasetIndex;
      const label = chart.data.labels[clickedElementIndex];
      const word = chart.data.datasets[datasetIndex].label;

      setPopup({
        x: event.native.offsetX,
        y: event.native.offsetY,
        word,
        date: label
      });
    } else {
      setPopup(null);
    }
  }
};

const darkenColor = (rgbStr, factor = 0.8) => {
  const [r, g, b] = rgbStr.match(/\d+/g).map(Number);
  return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
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
  borderColor: darkenColor(colorMap[w] || colorPalette[idx % colorPalette.length], 0.9),
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

useEffect(() => {
  fetchData();
}, []);

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


const formatDate = (dateStr) => {
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const months = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", 
                  "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
  return `${day}-${months[parseInt(month) - 1]}-${year}`;
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
<div className="min-h-screen w-full bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6 font-sans flex flex-col">
  <div className="flex flex-col flex-grow bg-white shadow-xl rounded-3xl px-4 py-6 space-y-2">
    
    {/* Title */}
    <h6 className="text-2xl font-semibold text-center text-slate-800 tracking-tight">📰 Dagsplott</h6>

    {/* Input and controls */}
    <div className="flex flex-wrap items-center gap-2 sm:gap-4 -mt-2">

  {/* Input field */}
  <div className="relative flex-1 min-w-[200px] flex items-center">
    <input
      className="w-full border border-slate-300 p-2 pl-10 pr-20 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-sm"
      value={word}
      onChange={e => setWord(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="renter, toll, tariff"
    />
    <button
      onClick={fetchData}
      className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-slate-500 hover:text-slate-700 focus:outline-none"
    >
      🔍
    </button>
    <button
      onClick={() => setShowDatePopup(!showDatePopup)}
      className="absolute right-2 top-1/2 -translate-y-1/2 text-lg text-slate-500 hover:text-slate-700 focus:outline-none"
    >
      🗓
    </button>
  </div>
        
 {showDatePopup && (
  <div className="absolute right-10 mt-2 bg-white border border-slate-300 rounded-md shadow-md p-4 z-50 w-64">
    <div className="flex justify-end">
      <button
        onClick={() => setShowDatePopup(false)}
        className="text-slate-400 hover:text-slate-600 text-lg font-bold"
      >
        ×
      </button>
    </div>
    {/* Calendar inputs here */}
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
      {/* OK Button */}
<div className="flex justify-center mt-2">
  <button
    onClick={() => {
      fetchData();
      setShowDatePopup(false);
    }}
    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
  >
    OK
  </button>
</div>
  </div>
)}


  {/* Group: Dropdown + Smoothing */}
  <div className="flex flex-wrap items-center gap-2 min-w-[240px]">

    {/* Dropdown */}
    <div className="flex items-center">
      <select
        value={mode}
        onChange={e => setMode(e.target.value)}
        className="border border-slate-300 rounded p-2 bg-slate-100 text-sm"
      >
        <option value="absolute">Absolutt</option>
        <option value="cumulative">Kumulativ</option>
        <option value="cohort">Kohort</option>
      </select>
    </div>

    {/* Smoothing */}
    <div className="flex items-center">
      <label className="text-sm text-slate-700 mr-2">Glatte</label>
      <div className="flex items-center border border-slate-300 rounded overflow-hidden">
        <button
          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-sm"
          onClick={() => setSmooth(s => Math.max(1, s - 1))}
        >-</button>
        <span className="px-3 text-sm">{smooth}</span>
        <button
          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-sm"
          onClick={() => setSmooth(s => Math.min(31, s + 1))}
        >+</button>
      </div>
    </div>

  </div> {/* End Group */}
  
</div>


    {/* Graph */}
    {loading && (
      <div className="flex justify-center items-center flex-grow">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )}

    {data && (
      <div className="w-full flex-grow min-h-[300px] max-h-[80vh] overflow-hidden flex items-center justify-center">
        <Line
          ref={chartRef}
          data={data}
 options={{
  onClick: (event) => handleChartClick(event, chartRef.current),
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        title: (tooltipItems) => {
          const dateStr = tooltipItems[0].label;
          return formatDate(dateStr);
        }
      }
    }
  },
scales: {
  x: {
    ticks: {
      callback: function(value, index, ticks) {
        const dateStr = this.getLabelForValue(value);
        return formatDate(dateStr); // Kun returnere tekst
      },
      color: function(context) {
        const value = context.tick.value; // Verdien på x-aksen
        const dateStr = context.chart.data.labels[value]; // hent datoen

        const month = parseInt(dateStr.slice(4, 6)); // måned

        if ([11, 12, 1, 2, 3].includes(month)) {
          return '#38bdf8'; // vinter (lys blå)
        } else if ([ 4, 5].includes(month)) {
          return '#22c55e'; // vår (grønn)
        } else if ([6, 7, 8].includes(month)) {
          return '#f59e0b'; // sommer (oransje)
        } else if ([9, 10].includes(month)) {
          return '#f43f5e'; // høst (rød)
        }
        return '#64748b'; // fallback
      }
    }
  }
}
,
  responsive: true,
  maintainAspectRatio: false,
}}

        />
      </div>
    )}


{popup && popup.x !== undefined && (
 <div className="absolute bg-white border border-gray-200 rounded-2xl shadow-2xl p-2 text-sm z-50 space-y-1" style={{ left: popup.x, top: popup.y }}>
  <p className="text-lg font-bold text-slate-700">{popup.word}</p>
    <button
      onClick={() => {
        window.open(makeNbQuery(popup.word, popup.date, popup.date), '_blank');
        setPopup(null);
      }}
      className="block w-full text-left hover:bg-slate-100 p-1"
    >🔎 Søk på dag</button>

    <button
      onClick={() => {
        const day = parseInt(popup.date, 10);
        const weekStart = String(day - 3);
        const weekEnd = String(day + 3);
        window.open(makeNbQuery(popup.word, weekStart, weekEnd), '_blank');
        setPopup(null);
      }}
      className="block w-full text-left hover:bg-slate-100 p-1"
    >📅 Søk på uke</button>

    <button
      onClick={() => {
        const month = popup.date.slice(0,6); // yyyyMM
        const start = month + "01";
        const end = month + "31";
        window.open(makeNbQuery(popup.word, start, end), '_blank');
        setPopup(null);
      }}
      className="block w-full text-left hover:bg-slate-100 p-1"
    >🗓 Søk på måned</button>

    <button
      onClick={() => {
        window.open(makeNbQuery(popup.word, format(startDate), format(endDate)), '_blank');
        setPopup(null);
      }}
      className="block w-full text-left hover:bg-slate-100 p-1"
    >🌍 Søk hele perioden</button>
  </div>
)}

      
    {/* Legend */}
    {data && (
      <div className="pt-4 flex flex-wrap justify-center gap-4">
        {data.datasets.map((ds, idx) => (
          <div key={ds.label} className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: ds.borderColor }}></div>
            <span className="text-xs text-slate-700">{ds.label}</span>
          </div>
        ))}
      </div>
    )}

    {/* Download buttons */}
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
        {/* Footer */}
    <p className="text-center text-xs text-slate-400 pt-6">Dagsplott v1.0 © 2025</p>
</div>




  );
}
