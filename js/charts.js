import Chart from 'chart.js/auto';

/**
 * Render charts based on records
 * @param {Array} records
 */
export function renderCharts(records) {
    const ctx = document.getElementById('trend-chart').getContext('2d');

    // Destroy existing chart if any
    if (window.trendChart) {
        window.trendChart.destroy();
    }

    if (records.length === 0) {
        return;
    }

    // Group records by marker
    const markerGroups = {};
    records.forEach(record => {
        if (!markerGroups[record.marker]) {
            markerGroups[record.marker] = [];
        }
        markerGroups[record.marker].push({
            x: record.date,
            y: record.value
        });
    });

    // Prepare datasets
    const datasets = Object.keys(markerGroups).map(marker => ({
        label: marker,
        data: markerGroups[marker].sort((a, b) => a.x.localeCompare(b.x)),
        borderColor: getRandomColor(),
        backgroundColor: 'rgba(0,0,0,0)',
        tension: 0.1
    }));

    window.trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    }
                },
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

/**
 * Get a random color for chart lines
 * @returns {string}
 */
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}
