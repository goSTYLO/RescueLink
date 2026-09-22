# RescueLink User Manual

**Audience:** Citizens, volunteer responders, and emergency operations staff who use the system day to day.  
**Platforms covered:** Mobile app (Flutter) and Web Dispatcher Dashboard.  
**Service area:** Dagupan City, Philippines.

> **Important:** RescueLink is a digital reporting and dispatch aid for Dagupan. It does **not** replace national emergency hotlines. For an immediate life-threatening emergency, call **911** (or your local emergency number) in addition to using the app when it is safe to do so.

---

## 1. Introduction

RescueLink helps people in Dagupan report emergencies and helps authorized staff manage those reports.

| Who you are | What you use |
|-------------|----------------|
| Resident / citizen | **Mobile app** — register, send SOS or full reports, track status, manage profile |
| Approved volunteer / first responder | **Mobile app** (Responder tab) — go online, accept alerts, update progress |
| Department staff on the field | **Mobile app** (department ops, when your account has that role) |
| Dispatcher, department admin/head, or system admin | **Web dashboard** in a browser — triage, verify, dispatch, review applications, insights |

You do **not** need to understand technical terms to use this manual. Follow the numbered steps for each task.

---

## 2. Mobile App

### 2.1 Getting started

#### Install and open

1. Install the RescueLink app on your phone (Android or iOS build provided by your organization).
2. Open the app and allow notifications and location when prompted — both are needed for accurate reports and alerts.
3. Make sure you have an internet connection (mobile data or Wi‑Fi).

#### Create an account

1. On the welcome/login screen, choose **Sign up** (or the equivalent create-account option).
2. Enter your details as asked (including phone number).
3. Verify your phone with the one-time code (OTP) sent through the verification flow.
4. Complete **Dagupan residency / service-area** checks when asked. The app confirms you are within the supported area.
5. When setup finishes, you should see confirmation that your account was created, then reach Home.

If the app says you are **outside the service area**, you cannot use RescueLink for operations outside Dagupan. Move into the service area (or use the retry option if GPS was wrong) and try again.

#### Sign in

1. Open the app.
2. Enter your phone (or account credentials as shown) and password.
3. Complete any OTP or verification step if prompted.
4. If you enabled **biometric login** earlier, you may unlock with fingerprint or face instead of typing your password each time.

#### Forgot password

1. On the login screen, choose **Forgot password**.
2. Verify your phone as instructed.
3. Create a new password and confirm it.
4. Sign in with the new password.

#### Sign out

1. Open **Settings**.
2. Choose **Logout** and confirm.
3. If offered, you may also end all sessions on other devices — use that if you believe someone else accessed your account.

---

### 2.2 Home and SOS (quick emergency)

Use SOS when you need help **immediately** and cannot complete a full voice report.

**Ways to start SOS**

- Tap the **SOS** control on Home, or  
- **Shake** the phone while the app is open in the foreground (any Home tab).

**What happens**

1. A short **cancel window** (about 5 seconds) appears so you can abort if it was accidental.
2. If you do not cancel, the app sends a **quick GPS-based SOS** to the operations center (no long audio recording required for this path).
3. You can then follow the report from History / Incident details when it appears.

**Tips**

- Keep location permission **On** so responders know where you are.
- Do not spam SOS; one clear report is better than many duplicates.
- If you can safely record details, use a **full emergency report** (next section) instead of or after SOS.

---

### 2.3 Full emergency report

Use this when you can describe what is happening with your voice (and optional photos/video).

1. From Home, open the **Emergency report** (or equivalent report) screen.
2. Allow microphone access if asked.
3. **Record your voice description** of the emergency (this is required for the full report path). Speak clearly: what happened, where, and how serious it is.
4. Optionally attach a **photo** or **video**.
5. Confirm your location (GPS is captured automatically when permitted).
6. Submit the report and wait for confirmation.
7. Open **Incident details** to track status as staff work the case.

After dispatchers mark an incident resolved, you may be asked to **confirm** that the situation was handled from your side — follow the prompt on the incident screen.

---

### 2.4 Report history and incident details

1. Open the **Reports** / history tab.
2. Pull down to refresh the list.
3. Tap a report to open **Incident details**: status, timeline, type/severity information when available, and evidence (voice playback, images, downloads when allowed).
4. Use this screen to follow progress from submitted → verified → in progress → resolved / closed (wording on screen may vary slightly).

If the system thinks your report may be related to another nearby report, you may see an informational note. You do not need to merge anything yourself — staff handle that on the dashboard.

---

### 2.5 Notifications

1. Open the **Notifications** area from Home (badge shows unread counts).
2. Tap a card to expand details; use **View** to open the related incident when available.
3. Use **Mark all as read** if you want to clear the unread state.
4. Pull down to refresh.

**Push alerts on the phone**

- Allow notifications for RescueLink in phone Settings.
- Critical / emergency-style alerts may play a loud alarm sound for responders and staff — that is intentional for urgent dispatch.
- Tapping a push notification should open the related assignment or incident when you are signed in.

---

### 2.6 Settings and profile

From **Settings** you can typically:

| Option | What it does |
|--------|----------------|
| Profile / Edit profile | Update display information |
| Change password | Set a new password |
| Change phone number | Start a new phone + OTP verification flow |
| Privacy & security | Turn biometric login on/off (may ask for password) |
| Emergency contacts | Save people to contact in a personal emergency |
| Barangay information | View barangay-related reference information |
| About | App information |
| Theme | Light / dark / system appearance (if offered) |
| Apply as First Responder | Start volunteer onboarding (see next section) |

---

### 2.7 Apply as a first responder (volunteer)

Available to citizens who want to help as approved volunteers.

1. Open **Settings** → **Apply as First Responder** (or similar label).
2. Walk through the onboarding tabs:
   - Terms  
   - Role overview  
   - Requirements checklist  
   - Application form  
3. Upload a **government ID** (required). You may also attach training certificates or supporting documents (images or PDF) if you have them.
4. Choose specialization fields (for example Fire, Medical, Police, Disaster) and upload proof when asked.
5. Submit and open **Application status**:
   - **Pending Review** — wait for staff decision  
   - **Approved** — you gain responder capabilities in the app  
   - **Not Approved** — read reviewer notes; you may need to correct and re-apply per local policy  

If an admin **revokes** an approved volunteer status, you will receive a notification with a reason. You may be allowed to re-apply later.

---

### 2.8 Responder mode (approved volunteers / responders)

When your role includes responder access, a **Responder** tab appears in the bottom navigation (with Home, Reports, Settings).

#### Go online

1. Open the **Responder** tab.
2. Turn **Online** on. You only receive live incident alerts while online.
3. Turn **Offline** when you are unavailable.

#### Respond to an alert

1. When an alert appears (in-app modal and/or push), read the summary.
2. Choose **Accept** or **Decline**.
3. If accepted, open the incident: map pin, details, and status steps.
4. Update your progress as you move: **Assigned → En Route → On Scene → Resolved** (as shown on screen).
5. If you are on a **formal team** assignment, you may see “Assigned to my team” and skip a separate Accept step; use the team roster when offered.
6. **Request backup** only when the screen allows it (often disabled once a formal team is already assigned).

Alerts are filtered by your specializations — you should mainly see incidents that match your fields.

#### Response history

Open the responder history list to review completed (resolved) incidents you participated in.

---

### 2.9 Department staff on mobile

If your account is department admin/head (or related field role), you may see a **department operations** area on mobile:

1. Open the department ops dashboard.
2. Review assigned or active incidents for your department.
3. Open an incident for map and operational details.
4. Follow any status or coordination actions your role allows.

Day-to-day city-wide triage, verification, and full admin tools remain on the **web dashboard**.

---

## 3. Web Dispatcher Dashboard

Open the dashboard URL provided by your organization in a modern browser (Chrome, Edge, or Firefox recommended). Sign in with the **email and password** issued for staff accounts (not the citizen phone signup flow).

### 3.1 Sign in and account recovery

1. Go to the login page.
2. Enter email and password.
3. If multi-factor / OTP is enabled for dispatchers, enter the code from your email when asked.
4. You land on the default page for your role.

**Forgot password**

1. Choose **Forgot password**.
2. Enter your email and follow the code / reset screens.
3. Create a new password and sign in again.

**Access denied**

If you open a page your role cannot use, you will see an access notice. Use only menus available to you, or ask an administrator to adjust your role.

---

### 3.2 Who can do what (plain language)

Exact menus vary by role. In general:

| Role (examples) | Typical access |
|-----------------|----------------|
| Dispatcher / Super Admin | City incident queue, applications review, broad ops tools |
| Department Admin | Department dashboard, personnel, insights for their department |
| Department Head | Assigned incidents for their department |
| All signed-in staff | Map, profile, help; incident detail when permitted |
| Super Admin only | Departments list, audit log, admin actions, teams, system settings |

If a menu is missing, your account does not include that permission.

---

### 3.3 Incident queue and detail

1. Open the main **Dashboard** / incident list.
2. Use filters (type, barangay, status, severity, search) to find reports.
3. Open an incident to see timeline, reporter info, AI classification (when available), media, and notes.
4. Common actions (when permitted):
   - **Verify** — confirm the report for operations (may record an audit or blockchain-style verification behind the scenes).
   - **Reclassify** — correct type/severity with a reason when required.
   - **Update status** — move through pending → verified → in progress → resolved → closed.
   - **Force close** — available to certain admin/dispatcher roles when needed.
   - **Internal notes** — add coordination notes for staff (not for the public).
5. After verify/reclassify, wait for success confirmation. If something fails, the screen should roll back — retry or refresh.

---

### 3.4 Possible duplicates

Sometimes two reports describe the same event.

1. Look for a **Possible duplicate** / flagged indicator on the queue or detail page.
2. Open **Related reports**.
3. Use **link** or **unlink** to connect or separate reports (staff judgment — the system does **not** auto-merge).
4. You may browse/search other incidents to pick a parent report, or clear a false flag when appropriate.

---

### 3.5 Map

1. Open **Map**.
2. View live incidents with filters (department, barangay, and related options).
3. Use map tools for situational awareness (closest units / area views when shown).
4. Heatmap / density layers show concentration of recent points — useful for awareness, not a full historical report.

---

### 3.6 Insights (period analytics)

Available to Super Admin and Department Admin (department admins see their own department).

1. Open **Insights**.
2. Pick a date range and (if Super Admin) a department scope, including city-wide or volunteers scope when offered.
3. Review KPIs, SLA-style clocks, demand by type/barangay, exceptions, and outcomes.
4. Use **?** icons for plain definitions of each metric.
5. Export **CSV** or print/PDF when needed.
6. The page can refresh as new incident activity arrives; check the Live / last-updated indicator.

Insights is for **period review**, not the same as the live dispatch queue.

---

### 3.7 Dispatch, departments, and teams

**Creating a dispatch**

1. From an incident (or dispatch UI), assign a **single responder** or a **team** for a department.
2. Follow on-screen suggestions / auto-assign badges when present — confirm a suggested team before relying on it.
3. Reassign if the wrong team was selected (previous team is released according to system rules).
4. Undo a department notification only while no team has been created yet (when that control is available).

**Departments and teams (admin)**

- Manage department details, personnel, and related operational lists from the department / team pages your role allows.
- Use assigned-incidents views for department-scoped work.

---

### 3.8 Review volunteer responder applications

1. Open **Responder applications**.
2. Select an application to review personal info, ID, specializations, and documents.
3. Download documents only through the protected viewer/download controls.
4. **Approve** or **Reject** with clear reviewer notes.
5. The applicant sees the result in the mobile app.

---

### 3.9 Audit log, profile, and help

- **Audit log** (admin): filter by action/resource and export when needed. Labels may say blockchain or audit trail depending on system configuration.
- **Profile / password**: update your staff account details.
- **Help & support**: organizational help content for operators.
- **Notifications** on the dashboard: in-app alerts for incident updates; keep the tab open or refresh if something looks stale.

---

## 4. Common problems and how to fix them

Keep this section handy. Fixes are written for everyday users.

### Mobile

| Problem | What to try |
|---------|-------------|
| Cannot register / OTP never arrives | Check phone signal and number spelling. Wait a minute and request a new code. Do not leave the verification screen too long. Restart the app and try again. |
| “Outside service area” / residency blocked | You must be in Dagupan’s supported area. Turn on precise location, step outdoors for a better GPS fix, then use retry. |
| App asks for location again and again | Open phone Settings → Apps → RescueLink → Permissions → Location → Allow (while using / always, as instructed). Turn on device Location/GPS. |
| SOS or report stuck on loading | Check internet. Wait for one attempt to finish. Close and reopen the app, then submit **once**. Avoid tapping submit many times. |
| Cannot record audio | Allow microphone permission. Close other apps using the mic. Try again in a quieter place. |
| Photo/video will not attach | Allow camera / gallery permissions. Prefer a smaller clip if the upload fails. |
| No push / alert sound | Enable notifications for RescueLink. Do not force-stop the app if you need critical alerts. Check phone Do Not Disturb / Bedtime modes. Volume up (alarms may use a special volume). |
| Responder never gets alerts | Turn **Online** on the Responder tab. Confirm your specializations match the incident types. Stay signed in with a working connection. |
| Accepted an alert but details will not open | Pull to refresh. Sign out and sign in once. Tap the notification again while online. |
| Biometric login fails | Use password once, then re-enable biometrics in Privacy & security. Re-enroll fingerprint/face in phone settings if needed. |
| Media will not play in details | Wait for upload to finish. Refresh. If it still fails, contact a dispatcher — the file may be held for safety review. |

### Dashboard

| Problem | What to try |
|---------|-------------|
| Cannot log in | Confirm email/password. Check Caps Lock. Use Forgot password. Ask an admin if your account was deactivated. |
| OTP email missing | Check spam/junk. Wait and request again. Confirm you used the staff email on file. |
| Blank page or “Access denied” | Your role may not include that menu. Go back to Home/Dashboard. Sign out and sign in. Ask admin for the correct role. |
| Incident list looks outdated | Refresh the browser. Confirm you are online. Check filters — clear them and search again. |
| Verify / reclassify failed | Read the error message. Refresh the incident and retry once. If it keeps failing, note the incident number and contact technical support. |
| Cannot open media | Refresh. Another staff member may need to clear a quarantine hold. Do not download unknown files outside official controls. |
| Map empty | Clear filters. Zoom to Dagupan. Confirm incidents exist for the selected filters. |
| Insights empty or wrong department | Confirm date range. Super Admins: pick the intended department or All. Department Admins only see their own department. |
| Session expired mid-work | Sign in again. Re-open the incident from the queue. Unsaved draft notes may need to be re-entered. |

### When nothing works

1. Confirm internet on the device.
2. Fully close and reopen the app or browser tab.
3. Try again after a few minutes (temporary outages happen).
4. Contact your RescueLink administrator with: approximate time, what you tapped, and any on-screen message (screenshot if possible).  
   Do **not** share your password.

---

## 5. Quick reference — incident journey

```text
Citizen reports (SOS or full report)
        ↓
Staff see it on the dashboard queue / map
        ↓
Verify / classify / link duplicates as needed
        ↓
Dispatch team or volunteer responders
        ↓
Responders update En Route → On Scene → Resolved
        ↓
Close out; citizen may confirm resolution
```

---

## 6. Document control

| Item | Value |
|------|--------|
| Document | RescueLink User Manual |
| Scope | Mobile + Web Dashboard end-user procedures |
| Related | Final List of Features; Technical Manual (academic) |
| Note | Describes the **implemented** system. Features such as SMS chat, Google Maps routing, or national 911 API integration are **not** part of this product. |
