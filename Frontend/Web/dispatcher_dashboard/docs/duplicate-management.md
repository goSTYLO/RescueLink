# Duplicate Incident Management

This document describes the duplicate incident flow in the dispatcher dashboard, including UI components, API usage, and behavior.

## Overview

- **No auto-linking**: The system never automatically marks incidents as duplicates. AI/geospatial detection only flags incidents for dispatcher review.
- **Possible Duplicate vs Duplicate**: Incidents are tagged as "Possible Duplicate" (`flagged_for_review`) until a dispatcher verifies and manually links them. After linking, they show as "Duplicate" (`is_duplicate`).
- **Related Reports**: When an incident is linked as a duplicate, it joins a cluster. All reports in the cluster are shown as "Related Reports."

## Affected Components

### IncidentDetailsPage

- **Related Reports section**: Collapsible, collapsed by default. Shows other reports in the duplicate cluster.
- **Mark as Possible Duplicate / View Duplicate Cluster button**: Opens the duplicate dialog.
- **Duplicate dialog**:
  - When **not** a duplicate: Shows AI-detected potential duplicates (if any) and a "Browse incidents" button.
  - When **is** a duplicate: Shows the cluster with options to unlink or "Close with related #id."
- **Close with related**: When a related report is already closed, a button appears to close the current incident with that report.
- **Link as duplicate**: Available on each potential duplicate or in the Browse incidents flow.
- **Silent refresh**: After linking/unlinking, the incident is refetched without full-page loading.

### SelectParentIncidentDialog (new)

Reusable dialog for browsing and selecting a parent incident when manually marking as duplicate.

**Features:**

- **Search**: By report ID, description, or barangay (300ms debounce).
- **Filters**: Type, Status, Severity, Barangay.
- **Pagination**: 8 items per page.
- **Excludes current incident**: The incident being linked is excluded from results via `exclude_report_id`.

**Usage:**

- Opened from IncidentDetailsPage via "Browse incidents" in the duplicate dialog.
- Opened from DashboardPage via the Merge (Mark as duplicate) button on each incident row.

**Props:**

- `open`, `onOpenChange` - Dialog visibility
- `currentIncidentId` - Incident being linked (excluded from list)
- `onSelect(parentReportId)` - Called when user selects a parent
- `loading` - Disables "Link as duplicate" buttons during API call

**Select component**: Uses render-props pattern. Children must be a function: `{({ value, dropdownRect }) => (...)}`.

### DashboardPage

- **Mark as duplicate button** (Merge icon): Shown for dispatchers/admins on non-duplicate incidents. Opens `SelectParentIncidentDialog` directly.
- Listens for `incident:updated` to refresh after linking.

## API Integration

### incidents.api.js

- `getIncidents({ search, exclude_report_id, ... })` - Added `search` and `exclude_report_id` for the browse flow.
- `linkDuplicate(id, parentReportId, reason)` - Links incident as duplicate of parent.
- `unlinkDuplicate(id, reason)` - Unlinks from duplicate.
- `getPotentialDuplicates(id)` - Fetches AI-detected potential duplicates.
- `getIncidentDuplicates(id)` - Fetches duplicate cluster info.

### Backend

- `GET /api/incidents` - Supports `search`, `exclude_report_id`, `incident_type`, `barangay`, `exclude_duplicates`.
- `GET /api/incidents/:id/duplicates` - Returns cluster with decrypted descriptions.
- `GET /api/incidents/:id/potential-duplicates` - Returns potential duplicates with decrypted descriptions.
- `POST /api/incidents/:id/link-duplicate` - Manual link.
- `POST /api/incidents/:id/unlink-duplicate` - Manual unlink.

## Data Flow

1. **Flag for review**: Backend sets `flagged_for_review = TRUE` when geospatial detection finds potential duplicates. No linking.
2. **Dispatcher opens dialog**: Fetches potential duplicates (or shows empty state).
3. **Browse incidents**: User clicks "Browse incidents" → `SelectParentIncidentDialog` opens → fetches incidents with filters/search.
4. **Link**: User selects parent → `linkDuplicate(currentId, parentId)` → backend links → frontend refetches incident (silent) → UI updates.

## Mobile

The mobile app does **not** include duplicate management UI. Duplicate linking is a dispatcher-only feature on the web. Mobile incident creation may receive a response indicating a potential related incident; that is informational only.

## Session Changelog (Duplicate Management Updates)

- **Related Reports**: Collapsible section, collapsed by default.
- **Decryption**: Cluster and potential-duplicate descriptions/reporter names decrypted before display.
- **Close with related**: Button to close current incident when a related report is already closed (in dialog and Related Reports section).
- **Possible Duplicate**: System only flags for review; no auto-linking. Dispatcher verifies and manually links.
- **Mark as duplicate button**: Fixed UI not updating (silent refresh, loading state on button).
- **Browse incidents**: New `SelectParentIncidentDialog` with search, filters, pagination for manual parent selection.
- **Backend**: `GET /api/incidents` supports `search`, `exclude_report_id`; duplicate endpoints documented.
