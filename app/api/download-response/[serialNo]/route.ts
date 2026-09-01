import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database"
import { getAuthenticatedUser } from "@/lib/secure-auth"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ serialNo: string }> }
) {
  try {
    console.log("=== GET /api/download-response START ===")
    console.log("Request URL:", req.url)
    
    // Get authenticated user
    const user = await getAuthenticatedUser()
    if (!user) {
      console.log("Authentication failed - no user")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const username = user.username
    console.log("Authenticated user:", username)

    const { serialNo } = await params
    console.log("Fetching booking details for serial:", serialNo)

    // Validate serialNo
    if (!serialNo || serialNo.trim() === '') {
      console.log("Invalid serial number:", serialNo)
      return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 })
    }

    // Connect to database and fetch booking details
    console.log("Database connected, executing query...")
    
    const result = await query(`
      SELECT 
        "SERIAL_NO",
        "PASSENGER_NAME",
        "MOB_NO_USER",
        "INDENTER_NAME",
        "MOB_NO_INDTR" as "INDENTER_MOB_NO",
        "TAKE_OFF_FROM",
        "DESTINATION",
        "TRIP_DATE",
        "TRIP_TIME",
        "PURPOSE",
        "VEH_REQUESTED",
        "REMARKS_USER",
        "STATUS_APVR",
        "INDENT_DATE",
        "DEPT_USER",
        "COMPANY_NAME",
        "DURATION_REQ",
        "FLIGHT_TRAIN_NO",
        "OTHER_DETAILS",
        "STAFF_NO_APVR",
        "PASS_DATE_APVR",
        "REMARKS_APVR"
      FROM "cabbooking1_new" 
      WHERE "SERIAL_NO" = $1
    `, [serialNo])
    
    console.log("Query executed, results:", result.rows.length)

    if (result.rows.length === 0) {
      console.log("Booking not found for serial:", serialNo)
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const booking = result.rows[0]
    console.log("Booking found, passenger:", booking.PASSENGER_NAME)

    // Verify user has access to this booking (either they created it or are approver)
    if (booking.PASSENGER_NAME !== username && booking.STAFF_NO_APVR !== username) {
      console.log("Access denied - user:", username, "passenger:", booking.PASSENGER_NAME, "approver:", booking.STAFF_NO_APVR)
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Generate response slip content (HTML format)
    console.log("Generating response slip HTML...")
    
    try {
      const responseSlipContent = generateResponseSlipHTML(booking)
      console.log("Response slip generated, length:", responseSlipContent.length)

      return new NextResponse(responseSlipContent, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="booking-response-${serialNo}.html"`,
        },
      })
    } catch (htmlError) {
      console.error("Error generating HTML:", htmlError)
      return NextResponse.json({ 
        error: "Failed to generate response slip HTML",
        details: htmlError instanceof Error ? htmlError.message : "Unknown HTML generation error"
      }, { status: 500 })
    }

  } catch (error) {
    console.error("Download response error:", error)
    return NextResponse.json({ 
      error: "Failed to generate response slip",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

interface SlipBookingDetails {
  SERIAL_NO?: string
  PASSENGER_NAME?: string
  MOB_NO_USER?: string
  INDENTER_NAME?: string
  INDENTER_MOB_NO?: string
  TAKE_OFF_FROM?: string
  DESTINATION?: string
  TRIP_DATE?: string | Date | null
  TRIP_TIME?: string
  PURPOSE?: string
  VEH_REQUESTED?: string
  REMARKS_USER?: string
  STATUS_APVR?: string
  INDENT_DATE?: string | Date | null
  DEPT_USER?: string
  COMPANY_NAME?: string
  DURATION_REQ?: string
  FLIGHT_TRAIN_NO?: string
  OTHER_DETAILS?: string
  STAFF_NO_APVR?: string
  PASS_DATE_APVR?: string | Date | null
  REMARKS_APVR?: string
  [key: string]: unknown
}

function generateResponseSlipHTML(booking: SlipBookingDetails) {
  const formatDate = (dateStr: string | Date | null | undefined) => {
    try {
      if (!dateStr) return "N/A"
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return "N/A"
      return date.toLocaleDateString("en-GB")
    } catch (error) {
      console.error("Date formatting error:", error, "for value:", dateStr)
      return "N/A"
    }
  }

  const formatDateTime = (dateStr: string | Date | null | undefined) => {
    try {
      if (!dateStr) return "N/A"
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return "N/A"
      return date.toLocaleString("en-GB")
    } catch (error) {
      console.error("DateTime formatting error:", error, "for value:", dateStr)
      return "N/A"
    }
  }

  const getStatusText = (status: string | null | undefined) => {
    if (!status) return 'Unknown'
    switch (status) {
      case 'OPEN': return 'Pending Approval'
      case 'APVD': return 'Approved'
      case 'REJ': return 'Rejected'
      default: return status
    }
  }

  // Safely access booking properties with fallbacks
  const safeBooking = {
    SERIAL_NO: booking.SERIAL_NO || 'N/A',
    PASSENGER_NAME: booking.PASSENGER_NAME || 'N/A',
    MOB_NO_USER: booking.MOB_NO_USER || 'N/A',
    INDENTER_NAME: booking.INDENTER_NAME || '',
    INDENTER_MOB_NO: booking.INDENTER_MOB_NO || 'N/A',
    TAKE_OFF_FROM: booking.TAKE_OFF_FROM || 'N/A',
    DESTINATION: booking.DESTINATION || 'N/A',
    TRIP_DATE: booking.TRIP_DATE,
    TRIP_TIME: booking.TRIP_TIME || 'N/A',
    PURPOSE: booking.PURPOSE || 'N/A',
    VEH_REQUESTED: booking.VEH_REQUESTED || 'N/A',
    REMARKS_USER: booking.REMARKS_USER || 'N/A',
    STATUS_APVR: booking.STATUS_APVR,
    INDENT_DATE: booking.INDENT_DATE,
    DEPT_USER: booking.DEPT_USER || 'N/A',
    COMPANY_NAME: booking.COMPANY_NAME || 'N/A',
    DURATION_REQ: booking.DURATION_REQ || 'N/A',
    FLIGHT_TRAIN_NO: booking.FLIGHT_TRAIN_NO || 'N/A',
    OTHER_DETAILS: booking.OTHER_DETAILS || 'N/A',
    STAFF_NO_APVR: booking.STAFF_NO_APVR || 'N/A',
    PASS_DATE_APVR: booking.PASS_DATE_APVR,
    REMARKS_APVR: booking.REMARKS_APVR || 'N/A'
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cab Booking Response Slip - ${safeBooking.SERIAL_NO}</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
            }
            .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 600;
            }
            .header p {
                margin: 10px 0 0;
                opacity: 0.9;
                font-size: 16px;
            }
            .content {
                padding: 30px;
            }
            .status-badge {
                display: inline-block;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 20px;
            }
            .status-pending { background-color: #fff3cd; color: #856404; }
            .status-approved { background-color: #d4edda; color: #155724; }
            .status-rejected { background-color: #f8d7da; color: #721c24; }
            .info-section {
                margin-bottom: 25px;
            }
            .info-section h3 {
                color: #333;
                margin-bottom: 15px;
                font-size: 18px;
                border-bottom: 2px solid #667eea;
                padding-bottom: 5px;
            }
            .info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 15px;
            }
            .info-item {
                display: flex;
                flex-direction: column;
            }
            .info-label {
                font-weight: 600;
                color: #555;
                margin-bottom: 5px;
                font-size: 14px;
            }
            .info-value {
                color: #333;
                font-size: 16px;
                padding: 8px 12px;
                background-color: #f8f9fa;
                border-radius: 6px;
                border-left: 3px solid #667eea;
            }
            .footer {
                background-color: #f8f9fa;
                padding: 20px 30px;
                border-top: 1px solid #dee2e6;
                text-align: center;
                color: #6c757d;
                font-size: 14px;
            }
            .print-btn {
                position: fixed;
                top: 20px;
                right: 20px;
                background-color: #667eea;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
            }
            @media print {
                body { background: white; }
                .print-btn { display: none; }
                .container { box-shadow: none; }
            }
        </style>
    </head>
    <body>
        <button class="print-btn" onclick="window.print()">🖨️ Print</button>
        
        <div class="container">
            <div class="header">
                <h1>🚗 Cab Booking Response Slip</h1>
                <p>BHEL - Bharat Heavy Electricals Limited</p>
            </div>
            
            <div class="content">
                <div class="status-badge status-${safeBooking.STATUS_APVR?.toLowerCase() || 'pending'}">
                    Status: ${getStatusText(safeBooking.STATUS_APVR)}
                </div>
                
                <div class="info-section">
                    <h3>📋 Booking Information</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Booking ID</div>
                            <div class="info-value">${safeBooking.SERIAL_NO}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Request Date</div>
                            <div class="info-value">${formatDate(safeBooking.INDENT_DATE)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Trip Date</div>
                            <div class="info-value">${formatDate(safeBooking.TRIP_DATE)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Trip Time</div>
                            <div class="info-value">${safeBooking.TRIP_TIME}</div>
                        </div>
                    </div>
                </div>
                
                <div class="info-section">
                    <h3>👤 Passenger Details</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Passenger Name</div>
                            <div class="info-value">${safeBooking.PASSENGER_NAME}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Mobile Number</div>
                            <div class="info-value">${safeBooking.MOB_NO_USER}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Department</div>
                            <div class="info-value">${safeBooking.DEPT_USER}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Company</div>
                            <div class="info-value">${safeBooking.COMPANY_NAME}</div>
                        </div>
                    </div>
                </div>
                
                ${safeBooking.INDENTER_NAME ? `
                <div class="info-section">
                    <h3>🔒 Indenter Details</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Indenter Name</div>
                            <div class="info-value">${safeBooking.INDENTER_NAME}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Indenter Mobile</div>
                            <div class="info-value">${safeBooking.INDENTER_MOB_NO}</div>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <div class="info-section">
                    <h3>📍 Journey Details</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Pick-up From</div>
                            <div class="info-value">${safeBooking.TAKE_OFF_FROM}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Destination</div>
                            <div class="info-value">${safeBooking.DESTINATION}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Vehicle Requested</div>
                            <div class="info-value">${safeBooking.VEH_REQUESTED}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Duration</div>
                            <div class="info-value">${safeBooking.DURATION_REQ}</div>
                        </div>
                    </div>
                </div>
                
                <div class="info-section">
                    <h3>📝 Additional Details</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Purpose</div>
                            <div class="info-value">${safeBooking.PURPOSE}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Flight/Train No.</div>
                            <div class="info-value">${safeBooking.FLIGHT_TRAIN_NO}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">User Remarks</div>
                            <div class="info-value">${safeBooking.REMARKS_USER}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Other Details</div>
                            <div class="info-value">${safeBooking.OTHER_DETAILS}</div>
                        </div>
                    </div>
                </div>
                
                ${safeBooking.STATUS_APVR !== 'OPEN' ? `
                <div class="info-section">
                    <h3>✅ Approval Details</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Approved/Rejected By</div>
                            <div class="info-value">${safeBooking.STAFF_NO_APVR}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Approval Date</div>
                            <div class="info-value">${formatDateTime(safeBooking.PASS_DATE_APVR)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Approval Remarks</div>
                            <div class="info-value">${safeBooking.REMARKS_APVR}</div>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
            
            <div class="footer">
                <p><strong>Generated on:</strong> ${new Date().toLocaleString('en-GB')}</p>
                <p>This is a system-generated document. Please keep it for your records.</p>
            </div>
        </div>
    </body>
    </html>
  `
}