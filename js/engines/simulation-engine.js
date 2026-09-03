// ============================================
// HospitalFlow AI — Simulation Engine
// ============================================

import Config from '../config.js';
import appState from '../state.js';
import eventBus, { EventTypes } from '../events.js';
import PredictionEngine from './prediction-engine.js';
import FlowEngine from './flow-engine.js';
import { deepClone, generateId } from '../utils.js';
import NotificationManager from '../notifications.js';

let simCounter = 6;

const SimulationEngine = {
  /**
   * Run a what-if simulation against a cloned state
   * Never mutates live state
   */
  runSimulation({ emergencyPatients = 0, doctorsUnavailable = 0, additionalPatients = 0, department = 'All' }) {
    // 1. Get baseline metrics from current live state
    const baseline = this._calculateMetrics(appState.get(), department);

    // 2. Clone state for simulation
    const simState = deepClone(appState.get());

    // 3. Apply scenario modifications to cloned state

    // Remove doctors
    if (doctorsUnavailable > 0) {
      const availableDocs = simState.doctors.filter(d => {
        if (department !== 'All' && d.department !== department) return false;
        return ['Available', 'Consulting'].includes(d.status);
      });

      const toRemove = availableDocs.slice(0, doctorsUnavailable);
      toRemove.forEach(d => {
        const doc = simState.doctors.find(sd => sd.id === d.id);
        if (doc) doc.status = 'Unavailable';
      });
    }

    // Add emergency patients
    if (emergencyPatients > 0) {
      for (let i = 0; i < emergencyPatients; i++) {
        const targetDept = department !== 'All' ? department :
          Config.DEPARTMENTS[i % Config.DEPARTMENTS.length];

        simState.queueEntries.push({
          id: `SIM-Q-E${i}`,
          patientId: `SIM-P-E${i}`,
          department: targetDept,
          status: 'Waiting',
          priority: 'Emergency',
          estimatedWait: 0,
          enteredAt: new Date().toISOString()
        });
      }
    }

    // Add regular patients
    if (additionalPatients > 0) {
      for (let i = 0; i < additionalPatients; i++) {
        const targetDept = department !== 'All' ? department :
          Config.DEPARTMENTS[i % Config.DEPARTMENTS.length];

        simState.queueEntries.push({
          id: `SIM-Q-R${i}`,
          patientId: `SIM-P-R${i}`,
          department: targetDept,
          status: 'Waiting',
          priority: 'Normal',
          estimatedWait: 0,
          enteredAt: new Date().toISOString()
        });
      }
    }

    // 4. Calculate simulated metrics
    const simulated = this._calculateMetrics(simState, department);

    // 5. Generate recommendations
    const recommendations = this._generateRecommendations(baseline, simulated, {
      emergencyPatients, doctorsUnavailable, additionalPatients, department
    });

    // 6. Calculate department breakdown
    const departmentBreakdown = this._getDepartmentBreakdown(simState);

    const result = {
      inputParameters: { emergencyPatients, doctorsUnavailable, additionalPatients, department },
      baseline,
      simulated,
      recommendations,
      departmentBreakdown,
      timestamp: new Date().toISOString()
    };

    eventBus.emit(EventTypes.SIMULATION_RUN, {
      emergencyPatients,
      doctorsUnavailable,
      additionalPatients,
      department,
      baselineAvgWait: baseline.avgWait,
      simulatedAvgWait: simulated.avgWait
    }, { source: 'simulation-engine' });

    return result;
  },

  /**
   * Save a simulation scenario
   */
  saveScenario(name, result) {
    simCounter++;
    const scenario = {
      id: `SIM-${String(simCounter).padStart(3, '0')}`,
      name: name || `Scenario ${simCounter}`,
      inputParameters: result.inputParameters,
      baselineResults: result.baseline,
      simulatedResults: result.simulated,
      recommendations: result.recommendations,
      createdBy: appState.get().currentUser?.id || 'demo',
      createdAt: new Date().toISOString()
    };

    appState.addItem('simulationScenarios', scenario);
    return scenario;
  },

  /**
   * Apply a simulation scenario to live state
   * This is the ONLY method that mutates live state
   */
  applyScenario(result) {
    const s = appState.get();

    // Apply doctor unavailability
    if (result.inputParameters.doctorsUnavailable > 0) {
      const dept = result.inputParameters.department;
      const availableDocs = s.doctors.filter(d => {
        if (dept !== 'All' && d.department !== dept) return false;
        return ['Available', 'Consulting'].includes(d.status);
      });

      const toRemove = availableDocs.slice(0, result.inputParameters.doctorsUnavailable);
      toRemove.forEach(d => {
        appState.updateItem('doctors', d.id, { status: 'Unavailable', currentPatientId: null });
      });
    }

    // Add emergency queue entries
    if (result.inputParameters.emergencyPatients > 0) {
      const demoPatients = s.patients.filter(p =>
        !s.queueEntries.some(q => q.patientId === p.id && ['Waiting', 'Called', 'Consulting'].includes(q.status))
      );

      for (let i = 0; i < Math.min(result.inputParameters.emergencyPatients, demoPatients.length); i++) {
        const targetDept = result.inputParameters.department !== 'All'
          ? result.inputParameters.department
          : Config.DEPARTMENTS[i % Config.DEPARTMENTS.length];

        const doctor = s.doctors.find(d =>
          d.department === targetDept && ['Available', 'Consulting'].includes(d.status)
        );

        if (doctor && demoPatients[i]) {
          try {
            FlowEngine.insertEmergencyPatient({
              patientId: demoPatients[i].id,
              department: targetDept,
              doctorId: doctor.id
            });
          } catch (err) {
            console.warn('Could not insert emergency patient:', err);
          }
        }
      }
    }

    // Recalculate all department ETAs
    Config.DEPARTMENTS.forEach(dept => {
      PredictionEngine.recalculateQueueETAs(dept);
    });

    appState.recalculateDashboard();

    eventBus.emit(EventTypes.SIMULATION_APPLIED, {
      ...result.inputParameters
    }, { source: 'simulation-engine' });

    NotificationManager.create({
      type: 'System',
      category: 'System',
      priority: 'High',
      title: 'Simulation Applied',
      message: 'What-if scenario has been applied to live hospital state',
      relatedModule: 'flow'
    });
  },

  // ---- Private helpers ----

  _calculateMetrics(state, filterDept = 'All') {
    const queueEntries = state.queueEntries.filter(q => {
      if (filterDept !== 'All' && q.department !== filterDept) return false;
      return ['Waiting', 'Called'].includes(q.status);
    });

    const waitTimes = queueEntries.map(q => q.estimatedWait || 0);
    const avgWait = waitTimes.length > 0
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
      : 0;
    const maxWait = waitTimes.length > 0 ? Math.max(...waitTimes) : 0;

    // Find peak department
    const deptCounts = {};
    queueEntries.forEach(q => {
      deptCounts[q.department] = (deptCounts[q.department] || 0) + 1;
    });
    const peakDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0];

    // Active doctors
    const activeDoctors = state.doctors.filter(d => {
      if (filterDept !== 'All' && d.department !== filterDept) return false;
      return ['Available', 'Consulting'].includes(d.status);
    }).length;

    const totalDoctors = state.doctors.filter(d => {
      if (filterDept !== 'All' && d.department !== filterDept) return false;
      return true;
    }).length;

    return {
      avgWait,
      maxWait,
      peakCongestion: peakDept ? peakDept[0] : 'None',
      longestQueue: peakDept ? peakDept[1] : 0,
      totalWaiting: queueEntries.length,
      activeDoctorCapacity: activeDoctors,
      totalDoctors,
      estimatedAffectedPatients: queueEntries.length
    };
  },

  _getDepartmentBreakdown(state) {
    return Config.DEPARTMENTS.map(dept => {
      const waiting = state.queueEntries.filter(q =>
        q.department === dept && ['Waiting', 'Called'].includes(q.status)
      ).length;
      const doctors = state.doctors.filter(d =>
        d.department === dept && ['Available', 'Consulting'].includes(d.status)
      ).length;

      return { department: dept, waiting, activeDoctors: doctors };
    });
  },

  _generateRecommendations(baseline, simulated, params) {
    const recommendations = [];

    if (simulated.avgWait > baseline.avgWait * 1.5) {
      recommendations.push('Open additional consultation rooms to increase throughput');
    }

    if (params.doctorsUnavailable > 0) {
      recommendations.push(`Temporarily redistribute patients from affected queues to available doctors`);
    }

    if (params.additionalPatients > 10) {
      recommendations.push('Stagger non-urgent arrivals by 15-minute intervals to reduce peak load');
    }

    if (params.emergencyPatients > 2) {
      recommendations.push('Activate additional emergency consultation capacity');
    }

    if (simulated.longestQueue > 10) {
      recommendations.push(`${simulated.peakCongestion}: Consider diverting eligible patients to departments with shorter queues`);
    }

    if (simulated.activeDoctorCapacity <= 2 && simulated.totalWaiting > 8) {
      recommendations.push('Request on-call physician support to maintain service levels');
    }

    if (recommendations.length === 0) {
      recommendations.push('Current capacity appears sufficient for this scenario');
    }

    return recommendations;
  }
};

export default SimulationEngine;
