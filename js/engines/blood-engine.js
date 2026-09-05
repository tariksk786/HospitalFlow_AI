// ============================================
// HospitalFlow AI — Blood Engine
// ============================================

import Config from '../config.js';
import appState from '../state.js';
import eventBus, { EventTypes } from '../events.js';
import { generateId, generateSeqId } from '../utils.js';
import NotificationManager from '../notifications.js';

let requestCounter = 20;
let donorNotifWave = {};

const BloodEngine = {
  /**
   * Create an emergency blood request
   */
  createRequest({ patientId, bloodGroup, component = 'Whole Blood', units, urgency, department, requestingHospital }) {
    const s = appState.get();

    // Validate
    if (!bloodGroup || !units || units < 1) throw new Error('Invalid blood request parameters');

    // Check for duplicate active request
    const duplicate = s.bloodRequests.find(r =>
      r.patientId === patientId &&
      r.bloodGroup === bloodGroup &&
      !['Resolved', 'Issued'].includes(r.status)
    );
    if (duplicate) {
      throw new Error(`Active blood request already exists: ${duplicate.id}`);
    }

    requestCounter++;
    const requestId = `BR-${String(requestCounter).padStart(3, '0')}`;
    const patient = s.patients.find(p => p.id === patientId);

    const request = {
      id: requestId,
      patientId,
      bloodGroup,
      component,
      units: parseInt(units),
      urgency,
      department,
      requestingHospital: requestingHospital || 'HospitalFlow Central Hospital',
      status: 'Created',
      matchedFacilityId: null,
      matchedSources: [],
      donorWave: 0,
      createdAt: new Date().toISOString(),
      resolvedAt: null
    };

    appState.addItem('bloodRequests', request);

    eventBus.emit(EventTypes.BLOOD_REQUEST_CREATED, {
      requestId,
      patientName: patient?.displayName,
      bloodGroup,
      units,
      urgency,
      component
    }, { source: 'blood-engine', entityId: requestId });

    if (urgency === 'Emergency' || urgency === 'Critical') {
      eventBus.emit(EventTypes.BLOOD_REQUEST_CRITICAL, {
        requestId,
        patientId,
        patientName: patient?.displayName,
        bloodGroup,
        units,
        urgency,
        department,
        component
      }, { source: 'blood-engine', entityId: requestId });
    }

    NotificationManager.create({
      type: 'Blood',
      category: 'Emergency',
      priority: urgency === 'Emergency' ? 'Critical' : urgency === 'Urgent' ? 'High' : 'Medium',
      title: `Blood Request: ${bloodGroup} (${urgency})`,
      message: `${units} units ${bloodGroup} ${component} requested for ${patient?.displayName || 'patient'} — ${department}`,
      relatedModule: 'emergency',
      relatedEntityId: requestId
    });

    // Auto-process: check internal inventory
    setTimeout(() => this.processRequest(requestId), 300);

    return request;
  },

  /**
   * Process a blood request through the escalation pipeline
   */
  processRequest(requestId) {
    const s = appState.get();
    const request = s.bloodRequests.find(r => r.id === requestId);
    if (!request || request.status === 'Resolved') return;

    // Step 1: Check internal inventory
    appState.updateItem('bloodRequests', requestId, { status: 'Checking Internal' });

    const internalStock = s.bloodInventory.filter(bi =>
      bi.bloodGroup === request.bloodGroup &&
      bi.facilityId === 'FAC-001' &&
      (bi.component === request.component || request.component === 'Whole Blood')
    );

    const availableInternal = internalStock.reduce((sum, bi) =>
      sum + (bi.units - bi.reservedUnits), 0
    );

    if (availableInternal >= request.units) {
      // Internal inventory sufficient
      appState.updateItem('bloodRequests', requestId, {
        status: 'Matched',
        matchedFacilityId: 'FAC-001',
        matchedSources: [{ facilityId: 'FAC-001', facilityName: 'Internal Inventory', units: request.units, distance: 0, transferTime: 0 }]
      });

      eventBus.emit(EventTypes.BLOOD_SOURCE_MATCHED, {
        requestId,
        facilityName: 'Internal Inventory',
        units: request.units,
        bloodGroup: request.bloodGroup
      }, { source: 'blood-engine', entityId: requestId });

      return;
    }

    // Step 2: Search external sources
    appState.updateItem('bloodRequests', requestId, { status: 'Searching Sources' });

    const sources = this.findMatchingSources(request);

    if (sources.length > 0) {
      appState.updateItem('bloodRequests', requestId, {
        status: 'Matched',
        matchedSources: sources
      });

      eventBus.emit(EventTypes.BLOOD_SOURCE_MATCHED, {
        requestId,
        facilityName: sources[0].facilityName,
        units: sources[0].available,
        bloodGroup: request.bloodGroup,
        totalSources: sources.length
      }, { source: 'blood-engine', entityId: requestId });

      NotificationManager.create({
        type: 'Blood',
        category: 'Blood',
        priority: 'High',
        title: 'Blood Sources Found',
        message: `${sources.length} source(s) found for ${request.units} units ${request.bloodGroup}. Top: ${sources[0].facilityName}`,
        relatedModule: 'emergency',
        relatedEntityId: requestId
      });
    } else {
      // No sources — escalate to donor matching
      appState.updateItem('bloodRequests', requestId, { status: 'Escalated' });

      NotificationManager.create({
        type: 'Blood',
        category: 'Emergency',
        priority: 'Critical',
        title: 'Blood Request Escalated',
        message: `No facility sources for ${request.units} units ${request.bloodGroup} — donor coordination activated`,
        relatedModule: 'emergency',
        relatedEntityId: requestId
      });
    }
  },

  /**
   * Find and rank matching blood sources from external facilities
   */
  findMatchingSources(request) {
    const s = appState.get();
    const extInventory = s.externalInventory || [];
    const sources = [];

    // Check each external facility
    s.facilities.filter(f => f.id !== 'FAC-001' && f.operationalStatus === 'Active').forEach(facility => {
      const stock = extInventory.filter(ei =>
        ei.facilityId === facility.id &&
        ei.bloodGroup === request.bloodGroup
      );

      const available = stock.reduce((sum, s) => sum + (s.units - s.reservedUnits), 0);

      if (available > 0) {
        const nearestExpiry = stock
          .filter(s => s.expiryDate)
          .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0];

        // Estimate transfer time based on distance (rough: 3 min per km in city)
        const transferMinutes = Math.round((facility.distance || 5) * 3);

        sources.push({
          facilityId: facility.id,
          facilityName: facility.name,
          facilityType: facility.type,
          available,
          distance: facility.distance,
          transferTime: transferMinutes,
          nearestExpiry: nearestExpiry?.expiryDate,
          // Operational confidence score (not clinical)
          score: this._calculateSourceScore(available, request.units, facility.distance, transferMinutes)
        });
      }
    });

    // Rank by score (higher is better)
    return sources.sort((a, b) => b.score - a.score);
  },

  /**
   * Reserve blood units from a source
   */
  reserveUnits(requestId, facilityId, units) {
    const s = appState.get();
    const request = s.bloodRequests.find(r => r.id === requestId);
    if (!request) throw new Error('Request not found');

    const facility = s.facilities.find(f => f.id === facilityId);

    if (facilityId === 'FAC-001') {
      // Reserve from internal inventory
      const invItems = s.bloodInventory.filter(bi =>
        bi.bloodGroup === request.bloodGroup &&
        bi.facilityId === 'FAC-001'
      );

      let remaining = units;
      invItems.forEach(item => {
        if (remaining <= 0) return;
        const canReserve = Math.min(remaining, item.units - item.reservedUnits);
        if (canReserve > 0) {
          appState.updateItem('bloodInventory', item.id, {
            reservedUnits: item.reservedUnits + canReserve,
            updatedAt: new Date().toISOString(),
            status: this._getInventoryStatus(item.units, item.reservedUnits + canReserve)
          });
          remaining -= canReserve;
        }
      });
    } else {
      // Reserve from external (update external inventory)
      const extInv = (s.externalInventory || []);
      extInv.forEach(ei => {
        if (ei.facilityId === facilityId && ei.bloodGroup === request.bloodGroup) {
          ei.reservedUnits = (ei.reservedUnits || 0) + units;
        }
      });
    }

    appState.updateItem('bloodRequests', requestId, {
      status: 'Reserved',
      matchedFacilityId: facilityId
    });

    eventBus.emit(EventTypes.BLOOD_UNITS_RESERVED, {
      requestId,
      bloodGroup: request.bloodGroup,
      units,
      facilityName: facility?.name || 'Internal'
    }, { source: 'blood-engine', entityId: requestId });

    NotificationManager.create({
      type: 'Blood',
      category: 'Blood',
      priority: 'High',
      title: 'Blood Units Reserved',
      message: `${units} units ${request.bloodGroup} reserved from ${facility?.name || 'Internal Inventory'}`,
      relatedModule: 'emergency',
      relatedEntityId: requestId
    });

    // Check if any blood group is now critical
    this._checkCriticalStock();
    appState.recalculateDashboard();
  },

  /**
   * Issue blood units (mark request as resolved)
   */
  issueUnits(requestId) {
    const s = appState.get();
    const request = s.bloodRequests.find(r => r.id === requestId);
    if (!request) return;

    appState.updateItem('bloodRequests', requestId, {
      status: 'Issued',
      resolvedAt: new Date().toISOString()
    });

    // Reduce actual inventory
    if (request.matchedFacilityId === 'FAC-001') {
      const invItems = s.bloodInventory.filter(bi =>
        bi.bloodGroup === request.bloodGroup && bi.facilityId === 'FAC-001'
      );
      let remaining = request.units;
      invItems.forEach(item => {
        if (remaining <= 0) return;
        const toIssue = Math.min(remaining, item.reservedUnits);
        if (toIssue > 0) {
          appState.updateItem('bloodInventory', item.id, {
            units: item.units - toIssue,
            reservedUnits: item.reservedUnits - toIssue,
            updatedAt: new Date().toISOString(),
            status: this._getInventoryStatus(item.units - toIssue, item.reservedUnits - toIssue)
          });
          remaining -= toIssue;
        }
      });
    }

    eventBus.emit(EventTypes.BLOOD_UNITS_ISSUED, {
      requestId,
      bloodGroup: request.bloodGroup,
      units: request.units
    }, { source: 'blood-engine', entityId: requestId });

    this._checkCriticalStock();
    appState.recalculateDashboard();
  },

  /**
   * Resolve request
   */
  resolveRequest(requestId) {
    appState.updateItem('bloodRequests', requestId, {
      status: 'Resolved',
      resolvedAt: new Date().toISOString()
    });
    appState.recalculateDashboard();
  },

  /**
   * Send donor notification wave
   */
  sendDonorNotificationWave(requestId) {
    const s = appState.get();
    const request = s.bloodRequests.find(r => r.id === requestId);
    if (!request) return [];

    const waveNum = (request.donorWave || 0) + 1;
    const waveSize = Config.DONOR_WAVE_SIZE;

    // Find eligible donors for this blood group
    const eligibleDonors = s.donors.filter(d =>
      d.bloodGroup === request.bloodGroup &&
      d.verified &&
      d.eligibility === 'Eligible' &&
      d.available &&
      !d.notifiedForRequestId // Not already notified for this request
    ).sort((a, b) => {
      // Sort by locality proximity (simple alpha sort for demo)
      return (a.locality || '').localeCompare(b.locality || '');
    });

    const waveStart = (waveNum - 1) * waveSize;
    const waveDonors = eligibleDonors.slice(waveStart, waveStart + waveSize);

    if (waveDonors.length === 0) return [];

    // Generate OTP and mark as notified
    waveDonors.forEach(donor => {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      appState.updateItem('donors', donor.id, {
        notifiedForRequestId: requestId,
        notificationWave: waveNum,
        notificationStatus: 'Sent',
        otpCode: otp,
        otpVerified: false
      });

      eventBus.emit(EventTypes.DONOR_NOTIFICATION_SENT, {
        donorName: donor.displayName,
        bloodGroup: donor.bloodGroup,
        wave: waveNum,
        contactPreference: donor.contactPreference
      }, { source: 'blood-engine', entityId: donor.id });
    });

    appState.updateItem('bloodRequests', requestId, {
      donorWave: waveNum
    });

    NotificationManager.create({
      type: 'Blood',
      category: 'Blood',
      priority: 'High',
      title: `Donor Wave ${waveNum} Sent`,
      message: `${waveDonors.length} ${request.bloodGroup} donors notified (Wave ${waveNum})`,
      relatedModule: 'emergency',
      relatedEntityId: requestId
    });

    return waveDonors;
  },

  /**
   * Verify donor OTP
   */
  verifyDonorOTP(donorId, enteredOTP) {
    const s = appState.get();
    const donor = s.donors.find(d => d.id === donorId);
    if (!donor) return { success: false, message: 'Donor not found' };

    if (donor.otpCode === enteredOTP) {
      appState.updateItem('donors', donorId, {
        otpVerified: true,
        notificationStatus: 'Confirmed'
      });

      eventBus.emit(EventTypes.DONOR_CONFIRMED, {
        donorName: donor.displayName,
        bloodGroup: donor.bloodGroup,
        requestId: donor.notifiedForRequestId
      }, { source: 'blood-engine', entityId: donorId });

      NotificationManager.create({
        type: 'Blood',
        category: 'Blood',
        priority: 'High',
        title: 'Donor Confirmed',
        message: `${donor.displayName} confirmed availability for ${donor.bloodGroup} donation`,
        relatedModule: 'emergency'
      });

      return { success: true, message: 'OTP verified — Donor confirmed' };
    }

    return { success: false, message: 'Invalid OTP. Please try again.' };
  },

  /**
   * Get donors for a specific blood group, sorted by eligibility
   */
  getEligibleDonors(bloodGroup) {
    return appState.get().donors.filter(d =>
      d.bloodGroup === bloodGroup && d.verified && d.eligibility === 'Eligible' && d.available
    );
  },

  _calculateSourceScore(available, needed, distance, transferTime) {
    let score = 0;
    // Availability weight (50%)
    score += Math.min(1, available / needed) * 50;
    // Distance weight (30%) — closer is better
    score += Math.max(0, 30 - (distance * 2));
    // Transfer time (20%) — faster is better
    score += Math.max(0, 20 - transferTime);
    return Math.round(score);
  },

  _getInventoryStatus(units, reserved) {
    const available = units - reserved;
    if (available <= Config.BLOOD_THRESHOLDS.CRITICAL) return 'Critical';
    if (available <= Config.BLOOD_THRESHOLDS.LOW) return 'Low';
    return 'Adequate';
  },

  _checkCriticalStock() {
    const summary = appState.getBloodSummary();
    summary.forEach(item => {
      if (item.status === 'Critical') {
        eventBus.emit(EventTypes.BLOOD_STOCK_CRITICAL, {
          bloodGroup: item.bloodGroup,
          availableUnits: item.available
        }, { source: 'blood-engine' });
      }
    });
  }
};

export default BloodEngine;
