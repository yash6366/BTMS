import { query, withTransaction } from "./database"

export interface AdminRequisitionItem {
  bookingId: number
  serialNo: string
  passengerName: string
  staffNo: string
  department: string
  mobileNo: string
  startingPlace: string
  destination: string
  tripDate: string
  tripTime: string
  purpose: string
  vehicleRequested: string
  statusApprover: string // OPEN, APVD, REJ
  statusTransport: string // PEND, PASS, DENY, DISP, COMP
  vehicleAllotted?: string
  vehicleNo?: string
  driverName?: string
  driverMobile?: string
  approverStaffNo?: string
  remarksApprover?: string
  createdDate: string
}

export interface TransportKPIs {
  totalRequisitions: number
  pendingApprovals: number
  pendingAllotment: number
  allottedTrips: number
  todayTrips: number
}

export class AdminTransportService {
  /**
   * High-level operational KPIs for Transport and Requisition lifecycle
   */
  static async getTransportKPIs(): Promise<TransportKPIs> {
    try {
      const res = await query(`
        SELECT 
          COUNT(*) as "totalRequisitions",
          COUNT(*) FILTER (WHERE "STATUS_APVR" = 'OPEN') as "pendingApprovals",
          COUNT(*) FILTER (WHERE "STATUS_APVR" = 'APVD' AND ("STATUS_TRANS" IS NULL OR "STATUS_TRANS" = 'PEND' OR "STATUS_TRANS" = 'OPEN')) as "pendingAllotment",
          COUNT(*) FILTER (WHERE "STATUS_TRANS" = 'PASS') as "allottedTrips",
          COUNT(*) FILTER (WHERE "TRIP_DATE" >= CURRENT_DATE AND "TRIP_DATE" < CURRENT_DATE + INTERVAL '1 day') as "todayTrips"
        FROM "cabbooking1_new"
      `)

      const row = res.rows[0] || {}
      return {
        totalRequisitions: parseInt(row.totalRequisitions || "0", 10),
        pendingApprovals: parseInt(row.pendingApprovals || "0", 10),
        pendingAllotment: parseInt(row.pendingAllotment || "0", 10),
        allottedTrips: parseInt(row.allottedTrips || "0", 10),
        todayTrips: parseInt(row.todayTrips || "0", 10),
      }
    } catch (error) {
      console.error("AdminTransportService.getTransportKPIs error:", error)
      return {
        totalRequisitions: 0,
        pendingApprovals: 0,
        pendingAllotment: 0,
        allottedTrips: 0,
        todayTrips: 0,
      }
    }
  }

  /**
   * Search, filter, and paginate ride requisitions across the entire system
   */
  static async getRequisitionsList(params?: {
    status?: string
    search?: string
    department?: string
    page?: number
    pageSize?: number
  }): Promise<{
    requisitions: AdminRequisitionItem[]
    pagination: { page: number; pageSize: number; total: number; totalPages: number }
  }> {
    const status = (params?.status || "ALL").toUpperCase().trim()
    const search = params?.search?.trim() || ""
    const department = params?.department?.trim() || ""
    const page = Math.max(1, params?.page || 1)
    const pageSize = Math.min(100, Math.max(5, params?.pageSize || 25))
    const offset = (page - 1) * pageSize

    let whereClause = " WHERE 1=1"
    const queryParams: unknown[] = []
    let pIdx = 1

    // Status filter logic
    if (status === "PENDING_APPROVAL") {
      whereClause += ` AND cb."STATUS_APVR" = 'OPEN'`
    } else if (status === "PENDING_ALLOTMENT") {
      whereClause += ` AND cb."STATUS_APVR" = 'APVD' AND (COALESCE(cbd."STATUS_TRANS", cb."STATUS_TRANS") IS NULL OR COALESCE(cbd."STATUS_TRANS", cb."STATUS_TRANS") IN ('PEND', 'OPEN', ''))`
    } else if (status === "ALLOTTED") {
      whereClause += ` AND (cbd."STATUS_TRANS" = 'PASS' OR cb."STATUS_TRANS" = 'PASS')`
    } else if (status === "REJECTED") {
      whereClause += ` AND (cb."STATUS_APVR" = 'REJ' OR cbd."STATUS_TRANS" = 'DENY')`
    }

    // Search filter logic
    if (search) {
      whereClause += ` AND (
        LOWER(cb."PASSENGER_NAME") LIKE $${pIdx} OR 
        LOWER(COALESCE(cb."STAFF_NO_USER", cb."STAFF_NO", '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(cb."SERIAL_NO", '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(cb."DESTINATION", '')) LIKE $${pIdx} OR
        LOWER(COALESCE(cb."STARTING_PLACE", '')) LIKE $${pIdx}
      )`
      queryParams.push(`%${search.toLowerCase()}%`)
      pIdx++
    }

    // Department filter logic
    if (department && department !== "ALL") {
      whereClause += ` AND LOWER(cb."DEPT_USER") = $${pIdx}`
      queryParams.push(department.toLowerCase())
      pIdx++
    }

    // Main Query
    const queryText = `
      SELECT 
        cb."BookingID" as "bookingId",
        COALESCE(cb."SERIAL_NO", CAST(cb."BookingID" AS VARCHAR)) as "serialNo",
        COALESCE(cb."PASSENGER_NAME", 'Unknown') as "passengerName",
        COALESCE(cb."STAFF_NO_USER", cb."STAFF_NO", '') as "staffNo",
        COALESCE(cb."DEPT_USER", 'General') as "department",
        COALESCE(cb."MOB_NO_USER", '') as "mobileNo",
        COALESCE(cb."STARTING_PLACE", 'Main Gate') as "startingPlace",
        COALESCE(cb."DESTINATION", 'Unspecified') as "destination",
        cb."TRIP_DATE" as "tripDate",
        COALESCE(cb."TRIP_TIME", '00:00') as "tripTime",
        COALESCE(cb."PURPOSE", 'Official') as "purpose",
        COALESCE(cb."VEH_REQUESTED", 'Sedan') as "vehicleRequested",
        COALESCE(cb."STATUS_APVR", 'OPEN') as "statusApprover",
        COALESCE(cbd."STATUS_TRANS", cb."STATUS_TRANS", 'PEND') as "statusTransport",
        COALESCE(cbd."VEH_ALLOTTED", cb."VEH_ALLOTTED") as "vehicleAllotted",
        COALESCE(cbd."VEHICLE_NO", cb."VEHICLE_NO") as "vehicleNo",
        COALESCE(cbd."DRIVER_NAME", cb."DRIVER_NAME") as "driverName",
        COALESCE(cbd."DRIVER_MOB_NO", cb."DRIVER_MOB_NO") as "driverMobile",
        cb."STAFF_NO_APVR" as "approverStaffNo",
        COALESCE(cbd."REMARKS_APVR", cb."REMARKS_APVR") as "remarksApprover",
        cb."CREATED_DATE" as "createdDate"
      FROM "cabbooking1_new" cb
      LEFT JOIN "CABBOOKING_DETAILS" cbd ON cb."SERIAL_NO" = cbd."SERIAL_NO" OR cb."SERIAL_NO" = cbd."INTERNAL_NO"
      ${whereClause}
      ORDER BY cb."CREATED_DATE" DESC NULLS LAST, cb."BookingID" DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `

    // Count Query
    const countQueryText = `
      SELECT COUNT(*) as count
      FROM "cabbooking1_new" cb
      LEFT JOIN "CABBOOKING_DETAILS" cbd ON cb."SERIAL_NO" = cbd."SERIAL_NO" OR cb."SERIAL_NO" = cbd."INTERNAL_NO"
      ${whereClause}
    `

    const dataParams = [...queryParams, pageSize, offset]
    const countParams = [...queryParams]

    const [dataRes, countRes] = await Promise.all([
      query(queryText, dataParams),
      query(countQueryText, countParams),
    ])

    const total = parseInt(countRes.rows[0]?.count || "0", 10)

    const requisitions: AdminRequisitionItem[] = dataRes.rows.map((r) => ({
      bookingId: r.bookingId,
      serialNo: r.serialNo,
      passengerName: r.passengerName,
      staffNo: r.staffNo,
      department: r.department,
      mobileNo: r.mobileNo,
      startingPlace: r.startingPlace,
      destination: r.destination,
      tripDate: r.tripDate ? new Date(r.tripDate).toISOString() : "",
      tripTime: r.tripTime,
      purpose: r.purpose,
      vehicleRequested: r.vehicleRequested,
      statusApprover: r.statusApprover,
      statusTransport: r.statusTransport,
      vehicleAllotted: r.vehicleAllotted || undefined,
      vehicleNo: r.vehicleNo || undefined,
      driverName: r.driverName || undefined,
      driverMobile: r.driverMobile || undefined,
      approverStaffNo: r.approverStaffNo || undefined,
      remarksApprover: r.remarksApprover || undefined,
      createdDate: r.createdDate ? new Date(r.createdDate).toISOString() : "",
    }))

    return {
      requisitions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    }
  }

  /**
   * Controlled Administrator Force-Approval / Override
   * Enforces:
   * 1. Requisition must exist
   * 2. Mandatory reason logged to immutable audit trail
   * 3. Syncs approved requisition to CABBOOKING_DETAILS for transport allotment
   */
  static async overrideRequisitionApproval(params: {
    serialNo: string
    reason: string
    actorUsername: string
    clientIP?: string
  }): Promise<{ success: boolean; serialNo: string; message: string }> {
    const cleanSerial = params.serialNo.trim()
    const cleanReason = params.reason.trim()
    const cleanActor = params.actorUsername.trim()
    const clientIP = params.clientIP || "unknown"

    if (!cleanReason) {
      throw new Error("REASON_REQUIRED: A detailed operational justification is required for an administrator override.")
    }

    return await withTransaction(async (client) => {
      // 1. Fetch current requisition from cabbooking1_new
      const fetchRes = await client.query(
        `SELECT * FROM "cabbooking1_new" WHERE "SERIAL_NO" = $1 OR CAST("BookingID" AS VARCHAR) = $1 FOR UPDATE`,
        [cleanSerial]
      )

      if (fetchRes.rows.length === 0) {
        throw new Error("REQUISITION_NOT_FOUND: The specified requisition does not exist.")
      }

      const req = fetchRes.rows[0]
      const prevStatus = req.STATUS_APVR || "OPEN"

      // 2. Set cabbooking1_new to APVD
      await client.query(
        `
        UPDATE "cabbooking1_new" SET
          "STATUS_APVR" = 'APVD',
          "PASS_DATE_APVR" = NOW(),
          "STAFF_NO_APVR" = $1,
          "REMARKS_APVR" = $2,
          "UPDATED_DATE" = NOW()
        WHERE "SERIAL_NO" = $3 OR "BookingID" = $4
      `,
        [cleanActor, `[ADMIN OVERRIDE: ${cleanReason}]`, req.SERIAL_NO, req.BookingID]
      )

      // 3. Upsert into CABBOOKING_DETAILS so Transport Desk immediately sees it
      const serialKey = req.SERIAL_NO || `ADM-${req.BookingID}`
      const checkDetails = await client.query(
        `SELECT "SERIAL_NO" FROM "CABBOOKING_DETAILS" WHERE "SERIAL_NO" = $1 OR "INTERNAL_NO" = $1`,
        [serialKey]
      )

      if (checkDetails.rows.length === 0) {
        await client.query(
          `
          INSERT INTO "CABBOOKING_DETAILS" (
            "SERIAL_NO",
            "INTERNAL_NO",
            "PASSENGER_NAME",
            "STAFF_NO_USER",
            "MOB_NO_USER",
            "DEPT_USER",
            "STARTING_PLACE",
            "DESTINATION",
            "TRIP_DATE",
            "TRIP_TIME",
            "PURPOSE",
            "VEH_REQUESTED",
            "STATUS_APVR",
            "PASS_DATE_APVR",
            "STAFF_NO_APVR",
            "REMARKS_APVR",
            "STATUS_TRANS",
            "CREATED_DATE",
            "UPDATED_DATE"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'APVD', NOW(), $13, $14, 'PEND', NOW(), NOW()
          )
        `,
          [
            serialKey,
            req.INTERNAL_NO || serialKey,
            req.PASSENGER_NAME,
            req.STAFF_NO_USER || req.STAFF_NO,
            req.MOB_NO_USER,
            req.DEPT_USER,
            req.STARTING_PLACE,
            req.DESTINATION,
            req.TRIP_DATE,
            req.TRIP_TIME,
            req.PURPOSE,
            req.VEH_REQUESTED,
            cleanActor,
            `[ADMIN OVERRIDE: ${cleanReason}]`,
          ]
        )
      } else {
        await client.query(
          `
          UPDATE "CABBOOKING_DETAILS" SET
            "STATUS_APVR" = 'APVD',
            "PASS_DATE_APVR" = NOW(),
            "STAFF_NO_APVR" = $1,
            "REMARKS_APVR" = $2,
            "UPDATED_DATE" = NOW()
          WHERE "SERIAL_NO" = $3 OR "INTERNAL_NO" = $3
        `,
          [cleanActor, `[ADMIN OVERRIDE: ${cleanReason}]`, serialKey]
        )
      }

      // 4. Record Immutable Audit Record
      await client.query(
        `
        INSERT INTO "ADMIN_AUDIT_LOGS" ("action", "target_type", "target_id", "actor", "details", "ip_address", "created_at")
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
        [
          "ADMIN_REQUISITION_OVERRIDE",
          "REQUISITION",
          serialKey,
          cleanActor,
          JSON.stringify({
            previousStatus: prevStatus,
            newStatus: "APVD",
            reason: cleanReason,
            passengerName: req.PASSENGER_NAME,
            staffNo: req.STAFF_NO_USER || req.STAFF_NO,
            tripDate: req.TRIP_DATE,
          }),
          clientIP,
        ]
      )

      return {
        success: true,
        serialNo: serialKey,
        message: `Requisition ${serialKey} successfully approved via Administrator Override. Handed over to Transport Desk for fleet allotment.`,
      }
    })
  }
}
