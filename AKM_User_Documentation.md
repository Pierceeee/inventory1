# AKM — Adspark Kollection Manager
## User Documentation

---

## Table of Contents

1. [Overview](#1-overview)
2. [Network Access Policy](#2-network-access-policy)
3. [User Roles](#3-user-roles)
4. [Getting Started](#4-getting-started)
5. [Sessions — Your Inventory Buckets](#5-sessions--your-inventory-buckets)
6. [Importing Inventory from Excel](#6-importing-inventory-from-excel)
7. [Scanning Items](#7-scanning-items)
8. [Inventory Page — View and Edit Data](#8-inventory-page--view-and-edit-data)
9. [Departments](#9-departments)
10. [Users](#10-users)
11. [Archive](#11-archive)
12. [Exporting Data](#12-exporting-data)
13. [Deleting a Session](#13-deleting-a-session)
14. [Frequently Asked Questions](#14-frequently-asked-questions)

---

## 1. Overview

**AKM (Adspark Kollection Manager)** is an internal inventory tracking system designed for IT teams to manage physical assets — laptops, phones, peripherals, and any other equipment.

The system is restricted to the Adspark office network and is not publicly accessible on the internet.

The system works in a simple cycle:

1. An admin or department head creates a **Session** (e.g., "Laptop Inventory June 2026")
2. They upload an **Excel file** containing the list of items
3. Team members **scan QR codes** on physical items to mark them as accounted for
4. Management can **view and edit** item data at any time through the Inventory page
5. Once complete, sessions are **archived** automatically after 7 days

---

## 2. Network Access Policy

AKM is accessible **only from within the Adspark office network**. This is a security measure to protect employee information and device records from unauthorized access.

| Location | Access |
|---|---|
| Adspark office (any WiFi) | ✅ Allowed |
| Work from home / remote | ❌ Blocked |
| Mobile data / personal hotspot | ❌ Blocked |

If you attempt to open AKM from outside the office network, you will see an **Access Restricted** screen. No login prompt is shown to unauthorized connections.

> **For IT administrators:** The allowed IP addresses are maintained in `middleware.ts` at the project root. Update the `ALLOWED_IPS` array when the office ISP assigns a new public IP. Both the primary and backup internet connections should have their IPs listed.

---

## 3. User Roles

There are three user roles in AKM. Each role has a different level of access.

### Admin
- Full access to everything in the system
- Can create, manage, and delete sessions for all departments
- Can view and edit all inventory data across all departments
- Can manage users and departments
- Can export data and print QR codes
- Only role that can permanently delete sessions (requires password verification)

### Department Head (Head)
- Can create and manage sessions for their own department only
- Can upload Excel files and clear items from their sessions
- Can view and edit inventory data for their department
- Can export data

### Scanner
- Can only access sessions assigned to their department
- Can scan QR codes via camera or manual entry
- Cannot edit item data or manage sessions
- Redirected directly to the Sessions page on login

---

## 4. Getting Started

### Logging In

1. Connect to any Adspark office WiFi
2. Open the AKM application in your browser
3. Enter your **email address** and **password**
4. Click **Sign In**

> If you do not have an account, contact your admin to register you.

### Dashboard (Admin and Head only)

After logging in, admins and heads are taken to the **Dashboard**, which shows:

- Total number of departments
- Number of active sessions
- Total items across all departments and how many have been scanned
- An overall scan progress bar
- A per-department breakdown with individual progress bars

Scanners are taken directly to the **Sessions** page upon login.

---

## 5. Sessions — Your Inventory Buckets

A **Session** is a named container for a set of inventory items. Think of it as a folder for one specific inventory exercise — for example, "Laptop Inventory Q2 2026" or "Phone Inventory June 2026."

Each session belongs to one department and holds the items uploaded for that exercise.

### Creating a Session

1. Go to **Sessions** in the sidebar
2. Click **New Session**
3. Enter a descriptive name (e.g., "Laptop Inventory June 2026")
4. If you are an admin, select which department this session belongs to. A department head does not choose — the session is created in their own department automatically.
5. Click **Create**

### Session Statuses

| Status | Meaning |
|---|---|
| **Active** | Items can be uploaded and scanned |
| **Completed** | Scanning is closed; data is read-only |
| **Archived** | Automatically set 7 days after completion |

### Marking a Session Complete

Once all items have been accounted for, an admin can close the session (only admins may do this — heads and scanners cannot):

1. Open the session
2. Click **Mark Complete** in the top-right header
3. If any items are still pending, the confirmation dialog tells you how many before you commit

This prevents any further scanning or uploads on that session.

---

## 6. Importing Inventory from Excel

### Preparing Your Excel File

Your Excel file must contain at least one column named **itemCode**. The column name is case-insensitive and accepts spaces or dashes (e.g., `Item Code`, `item-code`, `ITEMCODE` all work).

All other columns in the file are imported automatically as additional data fields for each item. There is no fixed schema — use whatever columns your inventory requires.

**Example layout:**

| itemCode | itemName | serialNumber | assignedTo | location |
|---|---|---|---|---|
| ITEM001 | Dell Laptop XPS 15 | SN-12345 | Juan dela Cruz | IT Room |
| ITEM002 | iPhone 14 Pro | SN-67890 | Maria Santos | Office 2 |
| ITEM003 | MacBook Air M2 | SN-11223 | Pedro Reyes | Finance |

**Rules:**
- Each row represents one item
- The `itemCode` must be unique within the same session
- Rows without an `itemCode` are skipped automatically
- Duplicate item codes within the same session are rejected with a warning

### Uploading the File

1. Go to **Sessions** and find your target session (status must be **Active**)
2. Click **Upload Excel** on the session card
3. Choose your `.xlsx`, `.xls` or `.csv` file (drag and drop onto the box, or click to browse)
4. Select which columns to display in the session's item table
5. Click **Check file** to preview what will happen — this is a dry run; nothing is saved yet
6. Review the preview: how many items will be added, and any rows that will be skipped (with their row number and reason)
7. Click **Import** to commit

The system will show how many items were added and list any rows that were skipped.

> **Note:** Uploading to the same session again adds new items — it does not overwrite existing ones. To start fresh with a new file, use **Clear Items** first (see below).

### Clearing Items and Re-Uploading

If you need to replace the entire dataset in a session with a new file:

1. Open the session
2. Click the **Clear Items** button (eraser icon) in the top header
3. A confirmation dialog appears — type `CLEAR` in the input box
4. Click **Clear All Items**
5. Upload your new Excel file as normal

The session itself, its name, department, and all scan history are preserved. Only the item records are removed, and the session's column list is reset — the next file you upload brings its own columns, so a differently-shaped spreadsheet is never mixed with the old one.

---

## 7. Scanning Items

### Opening the Scanner

1. Go to **Sessions** and click on an **Active** session
2. Click **QR Scanner** panel near the top of the page to expand it

### Scan Modes

**Camera Mode**
- Points your device camera at a QR code printed on the item
- The system detects and processes the code automatically — no button press needed
- Requires a camera and a secure connection (**https://**, or **localhost** on the machine running the
  server). A phone on the office Wi‑Fi needs Phase 8's HTTPS setup before Camera mode will work — until
  then, Manual mode works everywhere, on any connection.

**Manual Mode**
- Type or paste the item code directly using a keyboard or handheld barcode scanner
- Press Enter or click **Scan** to submit
- The input is never disabled while a scan is in flight, and it clears and refocuses immediately after
  each one — a handheld scanner can be fired as fast as items pass by
- Useful when the QR code sticker is damaged or unreadable, or when the camera is unavailable

### Scan Results

| Result | What it means |
|---|---|
| ✅ Green — Success | Item found and marked as scanned |
| ⚠️ Yellow — Warning | Item was already scanned previously |
| ❌ Red — Error | Item code not found in this session |

The **10 most recent scans** are shown below the scanner for quick reference during a scan session.

### Undoing a Scan

Admins can reverse a scan if an item was marked incorrectly:

1. Find the item in the table below the scanner
2. Click the **undo icon (↺)** on the right side of the row
3. The item is reset to **Pending**

### Printing QR Labels

Admins can print a QR code sticker for every item in a session:

1. Open the session and click **Print QR codes**
2. Each item's QR code (encoding just its item code) is generated on the printout, with the code and the
   item's first display column underneath
3. Click **Print** to open the browser's print dialog — the app's sidebar and header are hidden
   automatically so only the label grid prints

---

## 8. Inventory Page — View and Edit Data

The **Inventory** page is accessible from the sidebar by admins and department heads. It is the master data view of all items across the entire database, independent of the scanning workflow.

### Viewing Items

- All items from all sessions are displayed in a single scrollable table
- Every column from the original Excel import is shown as its own column
- Columns where all items have no value are automatically hidden to keep the table clean
- Columns scroll horizontally if there are many fields

### Filtering by Session

Use the **session filter** at the top of the page to narrow down the view:

- Click **All sessions** to see every item across all sessions and departments
- Click any **named session** (e.g., "Laptop Inventory June 2026") to view only that dataset
- When viewing a specific session, the Session column is hidden automatically

Admins see items from all departments. Department heads see only their own department's items.

### Filtering by Scan Status

Click the stat cards near the top to filter:

| Card | Shows |
|---|---|
| Total | All items |
| Scanned | Items already scanned |
| Pending | Items not yet scanned |

### Searching

Use the **search bar** to find items by item code.

### Editing an Item

1. Click the **pencil icon** on any row
2. An edit panel slides in from the right
3. Modify the **Item Code** or any field from the original Excel import
4. Click **Save Changes**

> Editing item data does not change the scan status. A scanned item remains scanned after its data is updated.

### Deleting an Item

Admins can delete individual items by clicking the **trash icon** on a row. A confirmation prompt appears before deletion. This action cannot be undone.

---

## 9. Departments

Departments represent teams or divisions within Adspark (e.g., IT, Finance, Operations, Creative).

### Managing Departments (Admin only)

1. Go to **Departments** in the sidebar
2. Click **Add Department** to create a new one
3. Sessions and items always belong to a specific department

Scanners and department heads can only access data within their assigned department.

---

## 10. Users

### Viewing Users (Admin only)

Go to **Users** in the sidebar to see all registered accounts, their assigned roles, and their departments.
This list includes anyone who was registered through **Register**, as well as anyone who has simply signed in
at least once - a new account defaults to Scanner with no department until an admin assigns it.

### Registering a New User

1. Go to **Register** in the Admin section of the sidebar
2. Fill in the user's email, password, role, and department
3. Click **Register**

> Only admins can create new user accounts.

### Roles at a Glance

| Role | Access Level |
|---|---|
| **Admin** | Full access across all departments |
| **Head** | Department-level access — sessions, items, exports |
| **Scanner** | Scan-only access for their assigned department |

---

## 11. Archive

Sessions that have been marked **Complete** for more than 7 days are automatically moved to the **Archive**. Archiving happens in the background — no manual action is needed.

### Viewing Archived Sessions (Admin only)

Go to **Archive** in the sidebar. Archived sessions are fully **read-only** — no scanning, uploads, or edits are possible.

### Exporting from Archive

You can still export data from any archived session:

1. Find the session in the Archive list
2. Click **Export**
3. An Excel file downloads with all item data and scan results

### Deleting an Archived Session

Archived sessions can be permanently deleted. See [Section 13 — Deleting a Session](#13-deleting-a-session) for the full procedure.

---

## 12. Exporting Data

You can export any session's data as an Excel file at any time from multiple places:

- **Session detail page** — Click **Export** in the top-right header
- **Archive page** — Click **Export** next to any archived session

The exported file includes:
- All item codes
- All data columns from the original Excel import
- Scan status (Scanned / Pending)
- Date and time of scan
- Name of who scanned each item

---

## 13. Deleting a Session

Deleting a session permanently removes the session and **all items inside it**. This cannot be undone. To protect against accidental data loss, deletion requires two steps.

> Only **Admin** users can delete sessions.

### Steps to Delete

1. Find the session in the Sessions list, session detail page, or Archive
2. Click the **trash icon**
3. A centered confirmation dialog appears:

**Step 1 — Download a backup**

Click **Download Excel Backup** to save a copy of all items before proceeding. The downloaded file can be re-imported into a new session later if needed. Once downloaded, the button turns green confirming the backup was saved.

**Step 2 — Enter your admin password**

Type your account password in the password field. Click the eye icon to show or hide the password as you type.

4. Click **Delete Session**

If the password is wrong, an error message appears inline and nothing is deleted. Enter the correct password to proceed.

---

## 14. Frequently Asked Questions

**Q: I can't access AKM from home. What do I do?**
AKM is restricted to the Adspark office network. You must be connected to the office WiFi or LAN. Remote access is intentionally disabled for security reasons. Contact your IT administrator if access is needed outside the office.

**Q: The office changed its internet connection. Now I can't access AKM even from the office.**
The new IP address needs to be added to the allowed list. Contact your IT administrator to update `middleware.ts` with the new IP address.

**Q: Can two sessions have items with the same item code?**
Yes. Item codes are unique within a session but can repeat across different sessions. This is intentional — for example, running a laptop inventory every quarter creates a new session each time.

**Q: What happens if I upload a file with a duplicate item code?**
The duplicate row is skipped and reported as a warning in the upload result. The existing item is kept unchanged.

**Q: Can a scanner see items from other departments?**
No. Scanners only see sessions and items in their assigned department.

**Q: What does "Pending" mean on an item?**
Pending means the item has not yet been scanned. Once its QR code is scanned during a session, it becomes Scanned.

**Q: Can I undo a scan?**
Yes, but only admins can undo scans. Click the undo icon (↺) next to any scanned item in the session detail view. The item returns to Pending status.

**Q: How do I start over with a new Excel file in the same session?**
Use **Clear Items** — open the session, click the eraser icon, type `CLEAR`, and confirm. The session stays intact; only the items are removed. You can then upload a new file.

**Q: How long until a completed session is archived?**
Sessions are automatically archived 7 days after being marked as Completed.

**Q: Can I recover a deleted session?**
No. Deletion is permanent. The system requires downloading a backup before deletion precisely for this reason — keep the exported file as your record.

**Q: Who can delete sessions?**
Only Admin users. Department heads and scanners do not have the ability to delete sessions.

---

*Document version: June 2026 — AKM Internal Use Only*
*For support, contact the Adspark IT Administrator.*
