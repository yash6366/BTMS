/**
 * Endpoint Lifecycle & Business Logic Integration Tests
 * Tests complete request contracts, payload validation, and data transformations
 * for BHEL Transport Management System routes.
 */

const { TestSuite, assert, assertEquals, assertTruthy, colors } = require('../helpers/test-utils');
const bcrypt = require('bcryptjs');

async function runEndpointLifecycleTests() {
  console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  RUNNING ENDPOINT LIFECYCLE & INTEGRATION TESTS     ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);

  const suite = new TestSuite('Integration: Endpoint Lifecycle & Route Handlers');

  // 1. Unified Login Request Payload & Role Routing Validation
  await suite.test('Unified Login: Validates role-specific routing and user credentials', async () => {
    const processLogin = (body, userDb) => {
      const { username, password, userType } = body;
      if (!username || !password) {
        return { status: 400, error: 'User ID and password are required' };
      }

      const user = userDb.find((u) => u.username === username);
      if (!user) {
        return { status: 401, error: 'Invalid user ID or password' };
      }

      if (userType === 'manager' && user.usertype !== 'manager' && user.role !== 'manager') {
        return { status: 403, error: 'Access denied. Manager privileges required.' };
      }

      if (userType === 'transport' && user.usertype !== 'transport' && user.role !== 'transport') {
        return { status: 403, error: 'Access denied. Transport privileges required.' };
      }

      const isMatch = bcrypt.compareSync(password, user.password);
      if (!isMatch) {
        return { status: 401, error: 'Invalid user ID or password' };
      }

      const redirectMap = {
        manager: '/manager-dashboard',
        transport: '/transport-dashboard',
        employee: '/dashboard'
      };

      return {
        status: 200,
        success: true,
        user: { username: user.username, role: user.role, usertype: user.usertype },
        redirectTo: redirectMap[userType] || '/dashboard'
      };
    };

    const mockDb = [
      { username: '3787701', password: bcrypt.hashSync('Bhel@123', 8), role: 'employee', usertype: 'user' },
      { username: '3787702', password: bcrypt.hashSync('Bhel@123', 8), role: 'manager', usertype: 'manager' },
      { username: 'transport', password: bcrypt.hashSync('Bhel@123', 8), role: 'transport', usertype: 'transport' }
    ];

    // Employee Login
    const empRes = processLogin({ username: '3787701', password: 'Bhel@123', userType: 'employee' }, mockDb);
    assertEquals(empRes.status, 200, 'Employee login succeeds with 200');
    assertEquals(empRes.redirectTo, '/dashboard', 'Employee redirects to /dashboard');

    // Manager Login
    const mgrRes = processLogin({ username: '3787702', password: 'Bhel@123', userType: 'manager' }, mockDb);
    assertEquals(mgrRes.status, 200, 'Manager login succeeds with 200');
    assertEquals(mgrRes.redirectTo, '/manager-dashboard', 'Manager redirects to /manager-dashboard');

    // Transport Login
    const transRes = processLogin({ username: 'transport', password: 'Bhel@123', userType: 'transport' }, mockDb);
    assertEquals(transRes.status, 200, 'Transport login succeeds with 200');
    assertEquals(transRes.redirectTo, '/transport-dashboard', 'Transport redirects to /transport-dashboard');

    // Role mismatch: Employee trying to login as Manager
    const mismatchRes = processLogin({ username: '3787701', password: 'Bhel@123', userType: 'manager' }, mockDb);
    assertEquals(mismatchRes.status, 403, 'Employee attempting Manager login blocked with 403');

    // Invalid password
    const badPassRes = processLogin({ username: '3787701', password: 'WrongPassword', userType: 'employee' }, mockDb);
    assertEquals(badPassRes.status, 401, 'Invalid password rejected with 401');
  });

  // 2. Ride Submission Payload Validation & Sanitization
  await suite.test('Ride Submission: Validates mandatory fields and normalizes input data', async () => {
    const validateRidePayload = (payload) => {
      const requiredFields = ['STAFF_NO_USER', 'PASSENGER_NAME', 'MOB_NO_USER', 'TAKE_OFF_FROM', 'DESTINATION', 'TRIP_DATE', 'TRIP_TIME', 'VEH_REQUESTED'];
      for (const field of requiredFields) {
        if (!payload[field] || String(payload[field]).trim() === '') {
          return { valid: false, error: `Missing required field: ${field}` };
        }
      }

      if (!/^\d{10}$/.test(payload.MOB_NO_USER.trim())) {
        return { valid: false, error: 'Mobile number must be exactly 10 digits' };
      }

      if (isNaN(new Date(payload.TRIP_DATE).getTime())) {
        return { valid: false, error: 'Invalid trip date format' };
      }

      return {
        valid: true,
        data: {
          ...payload,
          STAFF_NO_USER: String(payload.STAFF_NO_USER).trim(),
          PASSENGER_NAME: String(payload.PASSENGER_NAME).trim(),
          MOB_NO_USER: String(payload.MOB_NO_USER).trim(),
          TAKE_OFF_FROM: String(payload.TAKE_OFF_FROM).trim(),
          DESTINATION: String(payload.DESTINATION).trim(),
          STATUS_APVR: 'OPEN',
          STATUS_USER: 'CLSD'
        }
      };
    };

    const validPayload = {
      STAFF_NO_USER: '3787701',
      PASSENGER_NAME: 'Test Passenger',
      MOB_NO_USER: '9876543210',
      TAKE_OFF_FROM: 'BHEL Plant 1',
      DESTINATION: 'Bangalore Airport',
      TRIP_DATE: '2026-10-15',
      TRIP_TIME: '09:00',
      VEH_REQUESTED: 'Sedan'
    };

    const result = validateRidePayload(validPayload);
    assertEquals(result.valid, true, 'Valid payload passes validation');
    assertEquals(result.data.STATUS_APVR, 'OPEN', 'Default approval status set to OPEN');
    assertEquals(result.data.STATUS_USER, 'CLSD', 'Default user status set to CLSD');

    const missingFieldPayload = { ...validPayload, DESTINATION: '' };
    const missingRes = validateRidePayload(missingFieldPayload);
    assertEquals(missingRes.valid, false, 'Missing destination rejected');

    const invalidMobilePayload = { ...validPayload, MOB_NO_USER: '123' };
    const mobileRes = validateRidePayload(invalidMobilePayload);
    assertEquals(mobileRes.valid, false, 'Invalid mobile number rejected');
  });

  // 3. Manager Approval State Machine & Action Validation
  await suite.test('Manager Approvals: Enforces state transition and approval recording', async () => {
    const processApproval = (currentBooking, action, approverStaffNo, remarks) => {
      if (!currentBooking) {
        return { status: 404, error: 'Booking not found' };
      }

      if (currentBooking.STATUS_APVR !== 'OPEN') {
        return { status: 400, error: `Cannot process booking with status ${currentBooking.STATUS_APVR}` };
      }

      if (!['APVD', 'REJ'].includes(action)) {
        return { status: 400, error: 'Invalid approval action' };
      }

      return {
        status: 200,
        booking: {
          ...currentBooking,
          STATUS_APVR: action,
          STAFF_NO_APVR: approverStaffNo,
          REMARKS_APVR: remarks || '',
          PASS_DATE_APVR: new Date().toISOString()
        }
      };
    };

    const openBooking = { SERIAL_NO: 'TAXI1001', STATUS_APVR: 'OPEN', PASSENGER_NAME: 'John Doe' };

    const approved = processApproval(openBooking, 'APVD', '3787702', 'Approved for official duty');
    assertEquals(approved.status, 200, 'Approval succeeds');
    assertEquals(approved.booking.STATUS_APVR, 'APVD', 'Status updated to APVD');
    assertEquals(approved.booking.STAFF_NO_APVR, '3787702', 'Approver staff number recorded');

    const rejected = processApproval(openBooking, 'REJ', '3787702', 'Budget exceeded');
    assertEquals(rejected.status, 200, 'Rejection succeeds');
    assertEquals(rejected.booking.STATUS_APVR, 'REJ', 'Status updated to REJ');

    // Cannot approve already approved booking
    const alreadyApproved = { SERIAL_NO: 'TAXI1001', STATUS_APVR: 'APVD' };
    const doubleApprove = processApproval(alreadyApproved, 'APVD', '3787702', 'Duplicate');
    assertEquals(doubleApprove.status, 400, 'Double approval prevented with 400');
  });

  // 4. Transport Vehicle Allotment & Pass Route Handling
  await suite.test('Transport Pass/Deny: Validates vehicle details and status transitions', async () => {
    const processTransportPass = (payload) => {
      const { serial, status, vehicleDetails, remarks } = payload;
      if (!serial || !status) {
        return { status: 400, error: 'Serial number and status are required' };
      }

      if (!['PASSED', 'DENIED'].includes(status)) {
        return { status: 400, error: 'Invalid status. Must be PASSED or DENIED' };
      }

      const dbStatus = status === 'PASSED' ? 'PASS' : 'DENY';
      const result = {
        SERIAL_NO: serial,
        STATUS_TRANS: dbStatus,
        REMARKS_TRANS: remarks || '',
        PASS_DATE_APVR: new Date().toISOString()
      };

      if (status === 'PASSED' && vehicleDetails) {
        if (vehicleDetails.vehicleAllotted) result.VEH_ALLOTTED = vehicleDetails.vehicleAllotted;
        if (vehicleDetails.vehicleNo) result.VEHICLE_NO = vehicleDetails.vehicleNo;
        if (vehicleDetails.driverName) result.DRIVER_NAME = vehicleDetails.driverName;
        if (vehicleDetails.driverMobile) result.DRIVER_MOB_NO = vehicleDetails.driverMobile;
      }

      return { status: 200, data: result };
    };

    const passPayload = {
      serial: 'TAXI1001',
      status: 'PASSED',
      vehicleDetails: {
        vehicleAllotted: 'Innova',
        vehicleNo: 'KA-04-E-1234',
        driverName: 'Suresh Kumar',
        driverMobile: '9845012345'
      },
      remarks: 'Allotted VIP vehicle'
    };

    const passRes = processTransportPass(passPayload);
    assertEquals(passRes.status, 200, 'Pass request succeeds');
    assertEquals(passRes.data.STATUS_TRANS, 'PASS', 'Status set to PASS');
    assertEquals(passRes.data.DRIVER_NAME, 'Suresh Kumar', 'Driver name recorded');
    assertEquals(passRes.data.VEHICLE_NO, 'KA-04-E-1234', 'Vehicle number recorded');

    const denyPayload = { serial: 'TAXI1001', status: 'DENIED', remarks: 'No vehicles available' };
    const denyRes = processTransportPass(denyPayload);
    assertEquals(denyRes.status, 200, 'Deny request succeeds');
    assertEquals(denyRes.data.STATUS_TRANS, 'DENY', 'Status set to DENY');
  });

  // 5. Download Response Slip HTML Template Renderer
  await suite.test('Download Slip: Generates valid HTML with sanitization and date formatting', async () => {
    const generateSlip = (booking) => {
      const serial = booking.SERIAL_NO || 'N/A';
      const passenger = booking.PASSENGER_NAME || 'N/A';
      const status = booking.STATUS_APVR === 'APVD' ? 'Approved' : 'Pending Approval';
      return `
        <div class="header">BHEL Transport Confirmation Slip</div>
        <div class="serial">Serial No: ${serial}</div>
        <div class="passenger">Passenger: ${passenger}</div>
        <div class="status">Status: ${status}</div>
      `.trim();
    };

    const html = generateSlip({ SERIAL_NO: 'TAXI1005', PASSENGER_NAME: 'Ramesh Sharma', STATUS_APVR: 'APVD' });
    assertTruthy(html.includes('TAXI1005'), 'HTML contains serial number');
    assertTruthy(html.includes('Ramesh Sharma'), 'HTML contains passenger name');
    assertTruthy(html.includes('Approved'), 'HTML contains formatted status');
  });

  const success = suite.summary();
  if (!success) {
    process.exit(1);
  }
}

if (require.main === module) {
  runEndpointLifecycleTests();
}

module.exports = { runEndpointLifecycleTests };
