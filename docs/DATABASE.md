# BHEL Transport Management System - Database Reference Guide

## 1. Overview
The database backend is powered by **Neon Serverless PostgreSQL**, connected via standard TLS-encrypted connection pooling (`pg.Pool`).

- **Database Engine**: PostgreSQL 18.x (Neon AWS Serverless)
- **SSL Mode**: `sslmode=require` (TLS 1.3)
- **Primary Schema**: `public`
- **Default Connection URL Format**: `postgresql://<user>:<password>@<host>/<database>?sslmode=require`

---

## 2. Entity-Relationship & Table Specifications

### 2.1 Table: `axusers`
Stores user credentials, access permissions, and organizational hierarchy.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `username` | `VARCHAR(50)` | `PRIMARY KEY` | Staff Number (e.g. `6234070`) or role ID |
| `password` | `VARCHAR(255)` | `NULLABLE` | Legacy plaintext password (migrated on login) |
| `password_hash` | `VARCHAR(255)` | `NULLABLE` | Bcrypt hashed password (`$2a$` / `$2b$`) |
| `usergroup` | `VARCHAR(50)` | `NOT NULL` | `Employee`, `Manager`, or `Transport` |
| `groupno` | `VARCHAR(50)` | `NULLABLE` | Group identifier |
| `build` | `VARCHAR(10)` | `DEFAULT '0'` | Permission flag for build tools |
| `manage` | `VARCHAR(10)` | `DEFAULT '0'` | Permission flag for manager authorization |
| `tools` | `VARCHAR(10)` | `DEFAULT '0'` | Permission flag for administrative tools |
| `email` | `VARCHAR(100)` | `NULLABLE` | Official email address |
| `pageaccess` | `VARCHAR(50)` | `NULLABLE` | Dashboard routing key (`employee`, `manager`, `transport`) |
| `active` | `VARCHAR(10)` | `DEFAULT '1'` | Account active status (`1` = active, `0` = inactive) |
| `Reportingto` | `VARCHAR(50)` | `NULLABLE` | Staff number of direct manager approver |

---

### 2.2 Table: `cabbooking1_new`
Primary intake table for all employee cab requests.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `BookingID` | `SERIAL` | `PRIMARY KEY` | Auto-incrementing primary key |
| `SERIAL_NO` | `VARCHAR(50)` | `UNIQUE` | Business identifier (`TAXI` + `BookingID`, e.g. `TAXI101`) |
| `PASSENGER_NAME` | `VARCHAR(100)` | `NOT NULL` | Name of passenger |
| `MOB_NO_USER` | `VARCHAR(20)` | `NOT NULL` | Contact number of passenger |
| `INDENTER_NAME` | `VARCHAR(100)` | `NOT NULL` | Name of requisitioning staff |
| `STAFF_NO_INDTR` | `VARCHAR(50)` | `NOT NULL` | Staff number of indenter |
| `STAFF_NO_USER` | `VARCHAR(50)` | `NOT NULL` | Staff number of passenger |
| `DEPT_USER` | `VARCHAR(100)` | `NOT NULL` | Department of user |
| `STARTING_PLACE` | `VARCHAR(200)` | `NOT NULL` | Origin location / Township |
| `DESTINATION` | `VARCHAR(200)` | `NOT NULL` | Trip destination |
| `TRIP_DATE` | `DATE` | `NOT NULL` | Scheduled date of trip |
| `TRIP_TIME` | `VARCHAR(20)` | `NOT NULL` | Scheduled pickup time |
| `INDENT_DATE` | `DATE` | `DEFAULT CURRENT_DATE` | Date request was created |
| `VEH_REQUESTED` | `VARCHAR(50)` | `NOT NULL` | Vehicle type requested (Sedan, SUV, Bus) |
| `PURPOSE` | `TEXT` | `NOT NULL` | Official purpose of trip |
| `STAFF_NO_APVR` | `VARCHAR(50)` | `NOT NULL` | Staff number of designated manager approver |
| `STATUS_APVR` | `VARCHAR(20)` | `DEFAULT 'OPEN'` | Approval status (`OPEN`, `APVD`, `REJ`) |
| `STATUS_USER` | `VARCHAR(20)` | `DEFAULT 'CLSD'` | User lifecycle status |

---

### 2.3 Table: `CABBOOKING_DETAILS`
Transport pool and vehicle allotment table.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `ID` | `SERIAL` | `PRIMARY KEY` | Auto-incrementing ID |
| `SERIAL_NO` | `VARCHAR(50)` | `UNIQUE` | References `cabbooking1_new.SERIAL_NO` |
| `PASSENGER_NAME` | `VARCHAR(100)` | `NOT NULL` | Name of passenger |
| `STAFF_NO_APVR` | `VARCHAR(50)` | `NULLABLE` | Manager staff number |
| `STATUS_APVR` | `VARCHAR(20)` | `NULLABLE` | `APVD` when synced from manager |
| `STATUS_TRANSPORT` | `VARCHAR(20)` | `DEFAULT 'OPEN'` | Transport status (`OPEN`, `PASS`, `REJ`) |
| `VEH_ALLOTED` | `VARCHAR(50)` | `NULLABLE` | Vehicle registration number allotted |
| `DRIVER_NAME` | `VARCHAR(100)` | `NULLABLE` | Name of assigned driver |
| `DRIVER_PHONE` | `VARCHAR(20)` | `NULLABLE` | Contact number of assigned driver |

---

### 2.4 Table: `APPROVAL_NOTIFICATIONS`
Notification queue for manager approvers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `ID` | `SERIAL` | `PRIMARY KEY` | Auto-incrementing notification ID |
| `SERIAL_NO` | `VARCHAR(50)` | `NOT NULL` | Associated booking serial number |
| `STAFF_NO_APVR` | `VARCHAR(50)` | `NOT NULL` | Manager receiving the alert |
| `MESSAGE` | `TEXT` | `NOT NULL` | Notification text |
| `STATUS` | `VARCHAR(20)` | `DEFAULT 'PENDING'` | `PENDING`, `READ`, or `DISMISSED` |
| `CREATED_AT` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Notification creation time |

---

### 2.5 Table / View: `EDN_PIS_EMPLOYEE_MASTER_VIEW`
Employee master directory view.

| Column | Type | Description |
|---|---|---|
| `EMP_ID` | `VARCHAR(50)` | Employee staff number |
| `EMP_FNAME` | `VARCHAR(50)` | First name |
| `EMP_MNAME` | `VARCHAR(50)` | Middle name |
| `EMP_LNAME` | `VARCHAR(50)` | Last name |
| `EMP_DESIGNATION` | `VARCHAR(100)` | Official designation |
| `EMP_EMAIL_ID` | `VARCHAR(100)` | Official email address |
| `DEPT` | `VARCHAR(100)` | Department name |

---

## 3. Sequence Management & Synchronization
When bulk data is imported or migrated, PostgreSQL auto-incrementing identity sequences must be synchronized to `MAX(id)`:

```sql
SELECT setval(
  pg_get_serial_sequence('"cabbooking1_new"', 'BookingID'),
  COALESCE((SELECT MAX("BookingID") FROM "cabbooking1_new"), 0) + 1,
  false
);

SELECT setval(
  pg_get_serial_sequence('"APPROVAL_NOTIFICATIONS"', 'ID'),
  COALESCE((SELECT MAX("ID") FROM "APPROVAL_NOTIFICATIONS"), 0) + 1,
  false
);
```

To run sequence verification automatically:
```bash
npm run db:sequences
```

---

## 4. PostgreSQL Constraint & Invariant Verification

The PostgreSQL database enforces the following database-level integrity constraints tested via `npm run test:constraints`:

| Constraint Type | Target Object | Expected PostgreSQL Error Code | Enforcement Behavior |
|---|---|---|---|
| **Primary Key / Unique** | `axusers.username` | `23505` (`unique_violation`) | Rejects duplicate user registrations |
| **Primary Key / Unique** | `CABBOOKING_DETAILS.SERIAL_NO` | `23505` (`unique_violation`) | Rejects duplicate transport booking serial records |
| **NOT NULL Constraint** | `axusers.username` | `23502` (`not_null_violation`) | Prevents anonymous/unidentified account records |
| **NOT NULL Constraint** | `CABBOOKING_DETAILS.SERIAL_NO` | `23502` (`not_null_violation`) | Prevents unindexed transport dispatches |
| **Length Overflow Boundary** | `cabbooking1_new.STAFF_NO_USER` (VARCHAR 7) | `22001` (`string_data_right_truncation`) | Rejects staff numbers exceeding 7 characters |
| **Length Overflow Boundary** | `CABBOOKING_DETAILS.TRIP_HR` (VARCHAR 2) | `22001` (`string_data_right_truncation`) | Rejects trip hours exceeding 2 digits |
| **Datetime Format** | `cabbooking1_new.TRIP_DATE` (TIMESTAMPTZ) | `22007` (`invalid_datetime_format`) | Rejects non-ISO/invalid date strings at engine level |
| **Savepoint Rollback** | Transaction Savepoint | `0 Leaked Rows` | Restores transaction health and verifies zero persistence after rollback |

