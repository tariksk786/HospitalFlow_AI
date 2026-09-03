// ============================================
// HospitalFlow AI — Chart Manager
// ============================================

import Config from './config.js';
import appState from './state.js';

const ChartManager = {
  instances: {},

  /**
   * Destroy all chart instances
   */
  destroyAll() {
    Object.values(this.instances).forEach(chart => {
      try { chart.destroy(); } catch (e) {}
    });
    this.instances = {};
  },

  /**
   * Destroy a specific chart
   */
  destroy(id) {
    if (this.instances[id]) {
      try { this.instances[id].destroy(); } catch (e) {}
      delete this.instances[id];
    }
  },

  /**
   * Get or create a Chart.js chart
   */
  getOrCreate(canvasId, config) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, config);
    this.instances[canvasId] = chart;
    return chart;
  },

  /**
   * OPD Congestion Chart — Department load bar chart
   */
  renderCongestionChart(canvasId) {
    const loads = appState.getDepartmentLoads();

    const config = {
      type: 'bar',
      data: {
        labels: loads.map(l => l.department),
        datasets: [
          {
            label: 'Waiting',
            data: loads.map(l => l.waiting),
            backgroundColor: 'rgba(14, 165, 233, 0.7)',
            borderColor: '#0EA5E9',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Consulting',
            data: loads.map(l => l.consulting),
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderColor: '#10B981',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16,
              font: { family: 'Inter', size: 12 }
            }
          },
          tooltip: {
            backgroundColor: '#0F172A',
            titleFont: { family: 'Inter', size: 13 },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              afterBody: (items) => {
                const idx = items[0].dataIndex;
                const load = loads[idx];
                return `Active Doctors: ${load.activeDoctors}/${load.totalDoctors}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: 'Inter', size: 11 },
              color: '#64748B'
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.5)' },
            ticks: {
              stepSize: 2,
              font: { family: 'Inter', size: 11 },
              color: '#64748B'
            }
          }
        }
      }
    };

    return this.getOrCreate(canvasId, config);
  },

  /**
   * Blood Inventory Chart — Horizontal bar per blood group
   */
  renderBloodInventoryChart(canvasId) {
    const summary = appState.getBloodSummary();

    const statusColors = summary.map(s => {
      if (s.status === 'Critical') return 'rgba(239, 68, 68, 0.8)';
      if (s.status === 'Low') return 'rgba(245, 158, 11, 0.8)';
      return 'rgba(16, 185, 129, 0.8)';
    });

    const config = {
      type: 'bar',
      data: {
        labels: summary.map(s => s.bloodGroup),
        datasets: [
          {
            label: 'Available',
            data: summary.map(s => s.available),
            backgroundColor: statusColors,
            borderWidth: 0,
            borderRadius: 4
          },
          {
            label: 'Reserved',
            data: summary.map(s => s.reservedUnits),
            backgroundColor: 'rgba(148, 163, 184, 0.4)',
            borderWidth: 0,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16,
              font: { family: 'Inter', size: 12 }
            }
          },
          tooltip: {
            backgroundColor: '#0F172A',
            titleFont: { family: 'Inter', size: 13 },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              afterBody: (items) => {
                const idx = items[0].dataIndex;
                const s = summary[idx];
                return `Status: ${s.status}\nTotal: ${s.totalUnits} units`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            stacked: true,
            grid: { color: 'rgba(226, 232, 240, 0.5)' },
            ticks: { font: { family: 'Inter', size: 11 }, color: '#64748B' }
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: { font: { family: 'Inter', size: 12, weight: '600' }, color: '#0F172A' }
          }
        }
      }
    };

    return this.getOrCreate(canvasId, config);
  },

  /**
   * Congestion Trend Line Chart (simulated historical)
   */
  renderCongestionTrendChart(canvasId) {
    const hours = ['8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    const departments = ['General Medicine', 'Cardiology', 'Neurology'];
    const colors = ['#0EA5E9', '#F59E0B', '#6366F1'];

    // Generate trend data from queue history patterns
    const datasets = departments.map((dept, i) => {
      const loads = appState.getDepartmentLoads();
      const currentLoad = loads.find(l => l.department === dept)?.total || 0;
      const data = hours.map((_, hi) => {
        // Simulated pattern: ramp up, peak at 11-12, taper
        const peakFactor = Math.sin((hi / hours.length) * Math.PI);
        return Math.max(0, Math.round(currentLoad * peakFactor * (0.5 + Math.random() * 0.3)));
      });
      // Replace current hour with actual data
      const currentHour = new Date().getHours() - 8;
      if (currentHour >= 0 && currentHour < data.length) {
        data[currentHour] = currentLoad;
      }

      return {
        label: dept,
        data,
        borderColor: colors[i],
        backgroundColor: `${colors[i]}20`,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6
      };
    });

    const config = {
      type: 'line',
      data: { labels: hours, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16,
              font: { family: 'Inter', size: 12 }
            }
          },
          tooltip: {
            backgroundColor: '#0F172A',
            titleFont: { family: 'Inter', size: 13 },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 12,
            cornerRadius: 8,
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Inter', size: 11 }, color: '#64748B' }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.5)' },
            ticks: { stepSize: 2, font: { family: 'Inter', size: 11 }, color: '#64748B' },
            title: { display: true, text: 'Patients', font: { family: 'Inter', size: 12 }, color: '#64748B' }
          }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false }
      }
    };

    return this.getOrCreate(canvasId, config);
  },

  /**
   * Simulation comparison doughnut chart
   */
  renderSimComparisonChart(canvasId, baseline, simulated) {
    const config = {
      type: 'doughnut',
      data: {
        labels: ['Baseline Avg Wait', 'Additional Wait'],
        datasets: [{
          data: [baseline.avgWait, Math.max(0, simulated.avgWait - baseline.avgWait)],
          backgroundColor: ['rgba(14, 165, 233, 0.8)', 'rgba(239, 68, 68, 0.8)'],
          borderWidth: 0,
          cutout: '70%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 12,
              font: { family: 'Inter', size: 12 }
            }
          }
        }
      }
    };

    return this.getOrCreate(canvasId, config);
  },

  /**
   * Update an existing chart's data
   */
  updateChart(canvasId, updateFn) {
    const chart = this.instances[canvasId];
    if (chart) {
      updateFn(chart);
      chart.update('none');
    }
  }
};

export default ChartManager;
