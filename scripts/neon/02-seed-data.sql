-- ============================================================================
-- BHEL TRANSPORT MANAGEMENT SYSTEM - SEED / TEST DATA FOR NEON POSTGRESQL
-- ============================================================================

-- 1. axusers test accounts (Admin, Employee, Manager, Transport)
-- Initial passwords will be hashed with bcrypt on first login if plain text
INSERT INTO "axusers" ("username", "password", "password_hash", "usergroup", "groupno", "build", "manage", "tools", "email", "pageaccess", "active", "Reportingto")
VALUES 
  ('2408004', 'Admin01@Bhel.', NULL, 'Admin', 'ADM01', '1', '1', '1', 'btmsadmin@bhel.in', 'admin', '1', NULL),
  ('6234070', 'password123', NULL, 'Employee', 'EMP01', '0', '0', '0', 'employee@bhel.in', 'employee', '1', '3787702'),
  ('3787702', 'manager123', NULL, 'Manager', 'MGR01', '1', '1', '0', 'manager@bhel.in', 'manager', '1', NULL),
  ('transport', 'trans123', NULL, 'Transport', 'TRN01', '0', '0', '1', 'transport@bhel.in', 'transport', '1', NULL)
ON CONFLICT ("username") DO UPDATE SET
  "password" = EXCLUDED."password",
  "password_hash" = NULL,
  "usergroup" = EXCLUDED."usergroup",
  "groupno" = EXCLUDED."groupno",
  "build" = EXCLUDED."build",
  "manage" = EXCLUDED."manage",
  "tools" = EXCLUDED."tools",
  "email" = EXCLUDED."email",
  "pageaccess" = EXCLUDED."pageaccess",
  "active" = EXCLUDED."active";

-- 2. EDN_PIS_EMPLOYEE_MASTER_VIEW initial records
INSERT INTO "EDN_PIS_EMPLOYEE_MASTER_VIEW" ("EMP_ID", "EMP_FNAME", "EMP_MNAME", "EMP_LNAME", "EMP_DESIGNATION", "EMP_EMAIL_ID", "DEPT")
VALUES
  ('2408004', 'BTMS', 'System', 'Admin', 'BHEL Transport Management System Admin', 'btmsadmin@bhel.in', 'Administration'),
  ('6234070', 'Yashwanth', 'M', 'Kumar', 'Senior Engineer', 'yashwanth@bhel.in', 'Information Technology'),
  ('3787702', 'Rajesh', 'K', 'Sharma', 'General Manager', 'rajesh@bhel.in', 'Transport & Logistics')
ON CONFLICT ("EMP_ID") DO UPDATE SET
  "EMP_FNAME" = EXCLUDED."EMP_FNAME",
  "EMP_MNAME" = EXCLUDED."EMP_MNAME",
  "EMP_LNAME" = EXCLUDED."EMP_LNAME",
  "EMP_DESIGNATION" = EXCLUDED."EMP_DESIGNATION",
  "EMP_EMAIL_ID" = EXCLUDED."EMP_EMAIL_ID",
  "DEPT" = EXCLUDED."DEPT";


