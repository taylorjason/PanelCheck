/**
 * Render charts based on observations
 * Uses global Chart object loaded from CDN
 * @param {Array} observations
 */
export function renderCharts(observations) {
    const canvasElement = document.getElementById('trend-chart');
    const ctx = canvasElement.getContext('2d');

    // Destroy existing chart if any
    if (window.trendChart) {
        window.trendChart.destroy();
        window.trendChart = null;
    }

    if (observations.length === 0) {
        return;
    }

    // Group observations by marker
    const markerGroups = {};
    observations.forEach(obs => {
        const markerText = obs.code && obs.code.text ? obs.code.text.split(' - ')[1] : 'Unknown';
        if (!markerGroups[markerText]) {
            markerGroups[markerText] = [];
        }
        markerGroups[markerText].push({
            x: obs.effectiveDateTime || obs.date,
            y: obs.valueQuantity && obs.valueQuantity.value
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
                    type: 'category',
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Value'
                    }
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
