## **Universal Digital Product Standards (UDPS)** 

## **Web Project UI/UX Core Standards (WCAG 2.2 & Universal Design)**

**I. Navigation & Information Architecture**

* **Focus Not Obscured (Min):** When an element gains keyboard focus, it must not be entirely hidden by "sticky" headers, footers, or floating cookie banners.  
* **Consistent Help:** If help features (FAQs, Chat, Contact) are provided on multiple pages, they must appear in the same relative order and location across the site.  
* **Breadcrumb Navigation:** Mandatory for hierarchies deeper than two levels; the current page must be a non-clickable text label.  
* **Active Link Indication:** The current page must be visually distinguished in the menu using more than just color (e.g., an underline or high-contrast border).  
* **Jakob’s Law Compliance:** Use familiar patterns (e.g., shopping cart at top-right, logo at top-left) so users don't have to "re-learn" your system.  
* **3-Click Rule:** Users must be able to reach any primary goal from the homepage within three clicks. \[1, 2, 3, 4, 5, 6, 7\]

**II. Forms & User Input**

* **Redundant Entry Prevention:** Information previously entered in the same session must be auto-populated or available for selection to reduce cognitive load.  
* **Accessible Authentication:** Avoid "cognitive function tests" (like memorizing passwords or solving puzzles) as the only login method. Support password managers, email magic links, or biometrics.  
* **Inline Real-Time Validation:** Error messages must be identified in text and programmatically linked to their specific input fields.  
* **Input Formatting Hints:** Visible labels or instructions must be provided for specific formats, such as `YYYY-MM-DD`.  
* **Show/Hide Password:** Include a visible toggle for all password fields to reduce entry errors.  
* **Preservation of Data:** If a form fails to submit, all valid data previously entered must be retained. \[2, 4, 5, 7, 8, 9, 10\]

**III. Interactions & Operability**

* **Target Size (Minimum):** All interactive elements (buttons, links) must be at least **24x24 CSS pixels** or have enough spacing so that adjacent targets don't overlap.  
* **Dragging Movement Alternatives:** Any action requiring a "dragging" gesture (e.g., sliders, Kanban boards) must have a single-pointer alternative like clicking up/down arrows.  
* **Keyboard Focus Appearance:** The focus indicator must be clearly visible (at least 2px thick) with a 3:1 contrast ratio against the background.  
* **Pointer Cancellation:** Actions triggered by a "down-event" (mouse press) must be reversible by moving the pointer away before releasing.  
* **Micro-interactions:** Every button must have defined states for Normal, Hover, Focus (Keyboard), Active (Pressed), and Disabled.  
* **Destructive Action Dialogs:** Mandatory secondary confirmation for irreversible actions like "Delete" or "Format". \[2, 3, 7, 10, 11, 12, 13, 14\]

**IV. Visual & Accessibility Standards**

* **Non-Text Contrast:** Graphical objects (icons, status dots) and UI component boundaries must have a minimum 3:1 contrast ratio against adjacent colors.  
* **Reflow (Zooming):** Content must support zooming up to 400% without loss of functionality and without requiring horizontal scrolling (except for maps or data tables).  
* **No "Color-Only" Information:** Critical status changes (e.g., red for error) must also be conveyed via an icon or text label.  
* **16px Base Font Size:** Standard body text must be at least 16px with a line height of 1.5x for optimal legibility.  
* **Alt Text for Images:** All non-decorative images must have descriptive `alt` tags; decorative images must have empty `alt=""` tags. \[2, 4, 10, 15\]

**V. Layout & Psychological Principles**

* **Fitts’s Law:** Place frequently used actions (e.g., "Save") in larger, easily accessible areas.  
* **Hick’s Law:** Minimize choices to reduce decision time; use **Progressive Disclosure** to hide advanced features until needed.  
* **Miller’s Law:** Organize content into "chunks" of 5–9 items to prevent overwhelming working memory.  
* **Above-the-Fold Priority:** Primary Call-to-Actions (CTAs) and the core value proposition must be visible immediately without scrolling.  
* **Meaningful Empty States:** If a list or dashboard is empty, provide a helpful graphic and a clear "What to do next" button.  
* **Error Prevention:** Design systems that prevent errors before they happen (e.g., disabling a "Submit" button until required fields are filled). \[1, 6, 10, 14, 15, 16, 17\]

## **System Security Baseline Standards**

**I. Authentication & Access (Who can get in?)**

* **Multi-Factor Authentication (MFA):** Mandatory for all admin/staff accounts and any user dealing with sensitive data.  
* **Principle of Least Privilege:** Users and services should only have the minimum permissions needed to do their specific job.  
* **Secure Password Hashing:** Use slow, industry-standard algorithms like **Argon2** or **Bcrypt**. Never store passwords in plain text or simple MD5/SHA1.  
* **Secure Session Management:** Use `HttpOnly` and `Secure` flags for cookies. Implement automatic session timeouts after inactivity.

**II. Data Protection (Is the info safe?)**

* **Encryption in Transit (TLS):** Enforce HTTPS (TLS 1.2+) for every connection. Disable all non-secure HTTP ports.  
* **Encryption at Rest:** Encrypt sensitive database fields (like PII or API keys) using AES-256 or a managed Cloud KMS.  
* **Secret Management:** Never hardcode credentials or API keys in the source code. Use environment variables or a dedicated Secrets Vault.  
* **Log Sanitization:** Ensure passwords, credit card numbers, and tokens are automatically scrubbed from application logs.

**III. Backend & API Defense (How do we stop attacks?)**

* **Input Validation & Sanitization:** Treat all user input as "guilty until proven innocent." Validate for type, length, and format before it touches the database.  
* **Parameterized Queries:** Use prepared statements (ORMs/PDO) for all database interactions to prevent **SQL Injection**.  
* **Rate Limiting & Throttling:** Limit the number of requests per IP on sensitive endpoints (Login, Forgot Password, Search) to stop brute-force attacks.  
* **Cross-Site Scripting (XSS) Prevention:** Encode all data rendered in the UI to ensure scripts cannot be injected into the browser.

**IV. Infrastructure & Maintenance (How do we stay safe?)**

* **Automated Dependency Scanning:** Use tools (like GitHub Dependabot) to alert you when a third-party library you use has a known security hole.  
* **Centralized Logging:** Maintain a clear audit trail of who did what (logins, deletions, setting changes) for at least 30 days.  
* **Security Headers:** Implement a **Content Security Policy (CSP)** to control which scripts and resources are allowed to run on your site.  
* **Regular Backups:** Automated daily backups of the database, stored in a separate, secure location, with a tested recovery plan.

## **I. Global Mobile UX Standards**

* **Platform-Native Navigation:**  
  * **iOS:** Primary navigation at the bottom (Tab Bar); use "swipe from left edge" to go back.  
  * **Android:** Primary navigation at the bottom or via a Navigation Drawer; support the system's "Predictive Back" gesture.  
* **The "Thumb Zone" Rule:** Place primary actions (CTAs) and frequent controls in the bottom and middle areas of the screen for easy one-handed reach.  
* **Adaptive Layouts:** Design must reflow seamlessly across "Window Size Classes" (Compact for phones, Medium for foldables, Expanded for tablets).  
* **Progressive Disclosure:** Show only the most critical information first; use "Bottom Sheets" or expandable menus for secondary options to reduce clutter.  
* **Frictionless Onboarding:** Limit initial sign-up steps. Use "Magic Links," Biometrics (FaceID/Fingerprint), or Single Sign-On (SSO) to avoid manual typing.  
* **Predictive AI Personalization:** Interfaces should dynamically adjust (e.g., reordering menu items) based on the user's most frequent actions or time of day. \[5, 6, 7, 8, 9, 10, 11, 12, 13\]

## **II. Mobile UI Components & Visuals**

* **Minimum Touch Targets:** All interactive elements must be at least **44x44 points (iOS)** or **48x48 dp (Android)** to prevent accidental taps.  
* **Liquid & Glassmorphism:** Use translucent, blurred "glass" layers (Apple's **Liquid Glass**) to create depth and keep focus on the foreground content.  
* **Dynamic Color (Material You):** On Android, apps should automatically adapt their color palette to match the user’s device wallpaper for a personal feel.  
* **System Typography:** Use native fonts (**San Francisco** for iOS, **Roboto/Variable Fonts** for Android) to ensure perfect legibility and support for system-wide font scaling.  
* **Haptic Feedback:** Provide subtle vibrations (haptics) to confirm successful actions (e.g., a "rumble" when a task is completed). \[1, 6, 7, 8, 11, 14, 15, 16\]

## **III. Mobile Accessibility (WCAG 2.2 for Apps) \[2\]**

* **Dynamic Type Support:** Text must remain readable when the user increases system font size up to 200% without clipping or overlapping.  
* **Screen Reader Compatibility:** Every interactive element must have a clear label for **VoiceOver (iOS)** or **TalkBack (Android)**.  
* **High Contrast & Low Light:** Support both **Dark Mode** and **Light Mode** natively, ensuring a minimum 4.5:1 contrast ratio in both.  
* **Alternative Input:** Provide voice or gesture-based alternatives for actions that typically require complex dragging or multi-touch movements. \[2, 7, 8, 11, 12, 17, 18, 19\]

## **IV. Performance & Feedback**

* **The 3-Second Rule:** Apps should load essential content in under 3 seconds to prevent abandonment.  
* **Skeleton Screens:** Use placeholder shapes during data fetching to reduce the "perceived" wait time.  
* **Micro-animations:** Use fast (0.2s to 0.5s) transitions for screen changes and button states to make the app feel alive and responsive.  
* **Offline States:** Clearly communicate when a connection is lost and provide a way to continue basic tasks or see cached data. \[9, 11, 17, 20, 21, 22\]

