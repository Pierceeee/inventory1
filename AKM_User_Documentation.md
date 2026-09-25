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

> **For IT administrators:** The allowed IP addresses are maintained in `ALLOWED_IPS` in `.env` at the project root (a comma-separated list of single IPs and/or CIDR ranges) - not in `middleware.ts`. Update it when the office ISP assigns a new public IP and restart the server for the change to take effect. Both the primary and backup internet connections should have their IPs listed. See the main README's "Running it for the office" section for the full setup, including the LAN-subnet option for an office server instead of cloud hosting.

---

## 3. User Roles

There are three user roles in AKM. Each role has a different level of access. Roles are assigned by an admin in the **Users** page.

### Admin
- Full access across all departments
- Create, edit, and delete sessions for any department
- Upload Excel files and clear items from any session
- Scan items and undo scans
- View and edit inventory data across all departments
- Manage users, departments, and assign roles
- Archive page and session deletion (with password verification)
- View all reports and dashboards

### Department Head (Head)
- Create and manage sessions for their own department only
- Upload Excel files and clear items from their own sessions
- Scan items in their own department
- View and edit inventory data for their department only
- Export data from their sessions
- View their department's items on the Inventory page
- View their department's archived sessions and export them
- Access custody pages (**Devices**, **Employees**, **Handouts**, **Import**) — company-wide, not scoped by department

### Scanner
- Access the **Sessions** page only (no Inventory, Departments, or Users pages)
- Scan QR codes via camera or manual entry in their assigned department's sessions
- Cannot edit item data, create sessions, upload files, or manage anything
- Can only see sessions and items in their assigned department
- Automatically redirected to the Sessions page on login

---

## 4. Getting Started

### Logging In

1. Connect to any Adspark office WiFi
2. Open the AKM application in your browser
3. Enter your **email address** and **password**
4. Click **Sign In**

> If you do not have an account, contact your admin to register you.

### Dashboard (Admin and Head only)

After logging in, admins and heads are taken to the **Dashboard**.

**Audit Progress Section** (top):
- **Total number of departments** (admins see all; heads see their own)
- **Number of active sessions** (completed or archived sessions do not count)
- **Total items in active sessions** and **number already scanned**
- **Overall scan progress bar** showing percentage
- **Per-department breakdown** with item counts and progress bars for each

Below the audit section are **Custody widgets** (if your role can access them):
- Total devices
- Issued devices
- Available devices
- Devices in repair
- Active staff count

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

You don't need to rename or match any columns. Upload the spreadsheet as it is.

Each item needs a **scan code**, which is the value you scan. The app picks that column for you:
- A column named **Item Code** is always used. The name can be written as `itemCode`, `item-code`, `item_code` or `ITEMCODE`, in any capitals.
- Otherwise it uses a label-like column that is filled in and unique on every row, such as `Asset Tag`, `Barcode`, `Code` or `Serial Number`. If a file has both a new and an old tag column, for example `NEW ASSET TAG` and `OLD ASSET TAG`, the new one is used.
- Failing that, it uses the first column that is filled in and unique on every row.

The upload dialog tells you which column it chose ("Items are scanned by …") before you import.

All other columns are imported as they are, as extra data for each item. There is no fixed schema, so use whatever columns your inventory needs. To choose which columns the session's item table shows, use **Choose columns** on the session page after importing.

**File format:**
- `.xlsx` (Excel 2007+)
- `.xls` (Excel 97-2004)
- `.csv` (comma-separated, saved from Excel)
- Only the **first sheet** is imported

**Example layout:**

| itemCode | itemName | serialNumber | assignedTo | location |
|---|---|---|---|---|
| ITEM001 | Dell Laptop XPS 15 | SN-12345 | Juan dela Cruz | IT Room |
| ITEM002 | iPhone 14 Pro | SN-67890 | Maria Santos | Office 2 |
| ITEM003 | MacBook Air M2 | SN-11223 | Pedro Reyes | Finance |

**Rules:**
- Each row represents one item
- The item code must be unique **within the same session** (the same code can appear in different sessions each quarter)
- Rows without an item code are skipped automatically
- Duplicate item codes within the same session are rejected with a warning
- Reserved columns are ignored on re-import: `Scan Status`, `Scanned At`, `Scanned By`
- **Limits:** 10,000 rows per import; 50,000 total items per session

### Uploading the File

1. Go to **Sessions** and find your target session (status must be **Active**)
2. Click **Upload Excel** on the session card (or the session header if already open)
3. Choose your `.xlsx`, `.xls` or `.csv` file:
   - Drag and drop onto the upload box, or
   - Click the box to browse and select a file
4. The dialog shows the file straight away. Nothing is saved yet. You'll see:
   - The rows exactly as they will be stored, with the scan-code column first and marked **scan code**. Long files show their first 200 rows, but every row is checked and imported.
   - How many items will be added.
   - Any rows that will be skipped or can't be read, with their row number and the reason. These rows are also highlighted in the table.
5. If it looks right, click **Import N items** to save it. Otherwise click **Cancel**, or **Choose a different file**.

The system will show a final result: how many items were added and which rows (if any) were skipped.

> **Note:** Uploading to the same session again **adds** new items — it does not overwrite or update existing ones. To start fresh with a different file, use **Clear Items** first (see below).

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
- Requires a camera and a secure connection: **https://** or **localhost**
- Browsers refuse camera access over plain `http://` for security
- If you're on the office Wi-Fi over HTTP, use **Manual mode** instead (see below)

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
| ⚠️ Yellow — Warning | Item was already scanned previously (shows who scanned it and when) |
| ❌ Red — Error | Item code not found in this session |

The **10 most recent scans** are shown below the scanner for quick reference during a scan session, displaying the item code, result, and timestamp.

### Rate Limiting

To protect the system from abuse (script attacks or stuck retry loops), scan volume is rate-limited per user:
- **Burst:** 20 scans per 2 seconds (10/second sustained peak)
- **Sustained:** 600 scans per 60 seconds (10/second average)

If you hit the limit, you'll see "Too many scans in a row. Wait a moment and try again." This is well above normal scanning speed (2–4 items/second by hand). If you see this limit during normal work, contact your admin.

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

The **Inventory** page is accessible from the sidebar by admins and department heads. It provides a master view of all items across all sessions, independent of the scanning workflow.

### Viewing Items

- All items from all sessions are displayed in a single paginated table (100 items per page by default)
- Every column from the original Excel import is shown as its own column, in its original order
- Columns where **all items have no value** are automatically hidden to keep the table clean
- Columns scroll horizontally on small screens; use horizontal scrolling if there are many fields
- The table includes a **Session** column (hidden when you filter to a single session), **Item Code**, imported columns, **Scan Status**, **Scanned At**, and **Scanned By**

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

Go to **Users** in the sidebar to see all registered accounts, their roles, departments, and status.

This list includes anyone who was registered through **Register**, as well as anyone who has signed in at least once. A new account (first sign-in) defaults to **Scanner** with no department until an admin assigns it.

### Registering a New User

1. Go to **Register** in the Admin section of the sidebar
2. Fill in the user's email, password, role, and department
3. Click **Register**

The new account can sign in immediately with the email and password you set.

> Only admins can create new user accounts.

### Managing User Status

**Deactivating a User:**
- Find the user in the Users list
- Click the **Deactivate** button in their row
- The user can no longer sign in, but their historical data remains

**Reactivating a User:**
- Find the deactivated user in the Users list
- Click the **Reactivate** button in their row
- The user can sign in again with the same email and password

**Notes:**
- Deactivated users see "Account disabled" when they try to log in
- An admin cannot deactivate themselves
- The last active admin cannot be deactivated (system protection)

### Roles at a Glance

| Role | Access Level |
|---|---|
| **Admin** | Full access across all departments |
| **Head** | Department-level access — sessions, items, exports |
| **Scanner** | Scan-only access for their assigned department |

---

## 11. Archive

Sessions that have been marked **Complete** for more than 7 days are automatically moved to the **Archive**. Archiving happens automatically in the background — no manual action is needed.

### Viewing Archived Sessions

- **Admin page:** Go to **Archive** in the sidebar to see all archived sessions across all departments
- **Heads and Admins:** An **Archived** status chip appears on the Sessions page, showing your department's archived sessions
- **Scanners:** Cannot access archived sessions

Archived sessions are fully **read-only** — no scanning, uploads, or edits are possible.

### Exporting from Archive

You can export data from any archived session:

**From the Archive page (admin only):**
1. Go to **Archive** in the sidebar
2. Find the session in the list
3. Click the **Export** button on that row
4. An Excel file downloads with all item data and scan results

**From your Sessions page (heads only):**
1. Change the status filter to show **Archived** sessions
2. Your department's archived sessions appear
3. Click a session to open it
4. Click the **Export** button in the header

### Deleting an Archived Session

Archived sessions can be permanently deleted. See [Section 13 — Deleting a Session](#13-deleting-a-session) for the full procedure. Only admins can delete sessions.

---

## 12. Exporting Data

You can export any session's data as an Excel file. From multiple places:

- **Session detail page** — Click **Export** in the top-right header (active sessions)
- **Archive page** — Click **Export** next to any archived session (admin only)
- **Sessions list** — Click **Export** on the session card (if available)

### What's Included in the Export

The exported `.xlsx` file includes, in this order:

1. **itemCode** — the unique code for this item within the session
2. **All imported columns** — in their original order and names from the upload
3. **Scan Status** — `Scanned` or `Pending`
4. **Scanned At** — the date and time of the scan, in the office's local time zone (default: **Asia/Manila**)
5. **Scanned By** — the full name of the person who scanned it

For pending (unscanned) items, the **Scanned At** and **Scanned By** columns are blank.

The file is a plain `.xlsx` (Excel format) you can open in Excel, Google Sheets, or any spreadsheet app. Re-uploading it back into a session (Section 6) works like any other spreadsheet — the three audit columns (`Scan Status`, `Scanned At`, `Scanned By`) are automatically recognized and ignored on import, so the items re-import as fresh pending items.

### Rate Limiting

To protect the server, export volume is rate-limited per user:
- **Maximum:** 10 exports per 60 seconds per user
- **Single-flight guard:** Only one export is being prepared at a time. If someone else is exporting, you'll see "Another export is being prepared. Try again in a few seconds." and should wait a moment before retrying.

This is well above normal usage (nobody downloads the same backup ten times a minute). If you hit this limit, wait a moment and try again.

---

## 13. Deleting a Session

Deleting a session permanently removes the session and **all items inside it**. This cannot be undone. To protect against accidental data loss, deletion requires two steps and your password.

> Only **Admin** users can delete sessions.

### Steps to Delete

1. Find the session in the **Sessions list**, **session detail page**, or **Archive page**
2. Click the **trash/delete icon** on the session card or row
3. A confirmation dialog appears:

**Step 1 — Download a backup**
- Click **Download Excel Backup** to save a copy of all items before proceeding
- The file can be re-imported into a new session later if needed
- Once downloaded, the **Download Excel Backup** button turns green, confirming the save was successful
- Do not close the dialog yet

**Step 2 — Enter your admin password**
- Type your account password in the password field
- Click the **eye icon** to show or hide the password as you type
- Once both steps are complete, the **Delete Session** button becomes active (red/danger style)
- Click **Delete Session** to confirm

### What Happens

- If the password is **correct**: the session, all its items, and all scan history are deleted immediately and permanently
- If the password is **wrong**: an error message appears inline ("**That password is not correct.**"), and nothing is deleted
- You can try again with the correct password

### Rate Limiting

To prevent password-guessing attacks:
- **Limit:** 5 failed password attempts per 15 minutes
- After 5 wrong attempts, you'll see a message: "Too many failed attempts. Wait a moment and try again."
- Wait 15 minutes before retrying

### Important Notes

- **Backup first:** Always download the Excel backup before deleting — it's your only record
- **You cannot undo deletion** — the session and all items are gone permanently
- **The backup file can be re-imported** — save it somewhere safe if you might need the data later

---

## 14. Frequently Asked Questions

**Q: I can't access AKM from home. What do I do?**
AKM is restricted to the Adspark office network for security. You must be connected to the office WiFi or LAN. Remote access is intentionally disabled. Contact your IT administrator if you need access outside the office.

**Q: The office changed its internet connection. Now I can't access AKM even from the office.**
The office's new public IP address needs to be added to the allowlist. Contact your IT administrator to:
1. Update `ALLOWED_IPS` in the server's `.env` file with the new IP address
2. Restart the server
3. Confirm the new IP works with a test connection

**Q: Can two sessions have items with the same item code?**
Yes. Item codes are unique **within a session** but can repeat across different sessions. This is intentional — for example, running a laptop inventory every quarter creates a new session each time, and you can reuse the same item codes.

**Q: What happens if I upload a file with duplicate item codes?**
The duplicate row is skipped and reported as a warning in the upload result. The existing item is left unchanged. Check the dry-run preview to see which rows will be skipped before committing the import.

**Q: Can a scanner see items from other departments?**
No. Scanners only see sessions and items assigned to their own department. They cannot view other departments' data.

**Q: Can a head see items from other departments?**
No. Department heads see only their own department's items and sessions. Admins see everything.

**Q: What does "Pending" mean on an item?**
Pending means the item has not yet been scanned. Once its QR code is scanned during a session, it becomes Scanned with a timestamp and the scanner's name.

**Q: Can I undo a scan?**
Yes, but only admins can undo scans. In the session detail view:
1. Find the scanned item in the items table
2. Click the **undo icon (↺)** on the right side of the row
3. The item returns to Pending status
4. The undo action is logged in the scan history

**Q: How do I start over with a new Excel file in the same session?**
Use **Clear Items**:
1. Open the session
2. Click the **eraser icon** in the header
3. Type `CLEAR` in the confirmation box
4. Click **Clear All Items**
5. The session name, department, and all scan history stay intact
6. You can then upload a new Excel file
7. The new columns replace the old ones (the next upload brings its own column list)

**Q: How long until a completed session is archived?**
Sessions are automatically archived **7 days** after being marked as Completed. No manual action is needed. The archived date is calculated automatically each time you view the session.

**Q: Can I reopen a completed session?**
No. Once a session is marked Complete, it cannot be reopened. If you need to scan more items, create a new session instead.

**Q: Can I recover a deleted session?**
No. Deletion is permanent and cannot be undone. This is why the system requires you to download an Excel backup before deletion — keep the exported file as your record if you might need the data later.

**Q: Who can delete sessions?**
Only Admin users can delete sessions. Department heads and scanners do not have this ability.

**Q: Why do I need to enter my password to delete a session?**
Password re-confirmation is a security measure to prevent accidental or unauthorized deletion of important data. It ensures only an authenticated admin can delete sessions.

**Q: I'm locked out — I signed in but the app shows me as a scanner with no department, and nobody can promote me. What now?**

**Solution:** Ask your IT administrator to do ONE of the following:

1. **Using `ADMIN_EMAILS` (recommended, fastest):**
   - Your IT administrator adds your email to `ADMIN_EMAILS` in the server's `.env` file (comma-separated list)
   - Restart the server
   - You sign in again — you automatically become an admin on your next request

2. **Using the command line:**
   - You sign in once (so your profile row exists)
   - Your IT administrator runs: `npm run user:role -- your-email@adspark.ph admin`
   - You sign in again — you're now an admin

The `ADMIN_EMAILS` method requires a server restart (the email list is read at startup). Both methods require the Supabase project to have email confirmation enabled — otherwise the server refuses to honour `ADMIN_EMAILS` at all.

**Q: What if I accidentally deactivated the wrong user?**
If an admin deactivated a user by mistake, another admin can reactivate them:
1. Go to **Users** → **Users**
2. Find the deactivated user (they'll have a "Disabled" badge)
3. Click the user's name
4. Click **Reactivate**

The user can sign in again immediately with the same email and password.

**Q: What if our office IP changes and we're all locked out?**
Contact your IT administrator — they must update `ALLOWED_IPS` in the server's `.env` and restart. Have your new IP address ready. If nobody has admin access because everyone is locked out, use the `ADMIN_EMAILS` recovery method above.

---

*Document version: June 2026 — AKM Internal Use Only*
*For support, contact the Adspark IT Administrator.*
