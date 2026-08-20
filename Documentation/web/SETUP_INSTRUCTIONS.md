# Setup Instructions

## Dependencies Installation

Run the following command to install the required dependencies:

```bash
npm install
```

This will install:
- `react-router-dom` - For routing between pages
- `lucide-react` - For icons

## What's Been Set Up

1. **React Router** - Configured in `App.jsx` with protected routes
2. **Layout Component** - Sidebar navigation with menu items
3. **UI Components** - Simplified versions of Card, Badge, Button, Input, Label, Select
4. **DashboardPage** - New dashboard using mockData from Design folder
5. **mockData.js** - Complete mock data from Design folder

## Routes Available

- `/login` - Login page (existing)
- `/dashboard` - New dashboard with Layout (protected route)
- `/forgot-password`, `/enter-code`, `/create-password` - Auth pages (existing)

## Next Steps

1. Run `npm install` to install dependencies
2. Start the dev server: `npm run dev`
3. Navigate to `/dashboard` after logging in
4. Convert additional pages from Design folder as needed:
   - MapViewPage
   - DepartmentsPage
   - TaskBoardPage
   - AuditLogPage
   - AdminActionsPage
   - ProfilePage
   - SettingsPage
   - IncidentDetailsPage

## Notes

- The Layout component reads user data from `localStorage.getItem('user')`
- User data is stored in localStorage after login
- Protected routes require authentication
- All pages use the mockData.js file for data
