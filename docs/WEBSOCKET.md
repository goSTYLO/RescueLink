# RescueLink WebSocket Live Connection Documentation

This document describes the WebSocket implementation for live updates between the RescueLink backend, web dashboard, and mobile app.

## Overview

WebSocket connections provide real-time updates to all connected clients when incidents are created, updated, or when dispatches are assigned. This eliminates the need for constant page refreshing and provides a more responsive user experience.

## Architecture

```
┌─────────────┐      WebSocket       ┌──────────────┐
│   Web App   │◄────────────────────►│              │
│  (React)    │     ws://host/ws     │   Backend    │
└─────────────┘                      │  (Express)   │
                                     │              │
┌─────────────┐      WebSocket       │  HTTP + WS   │
│ Mobile App  │◄────────────────────►│   Server     │
│  (Flutter)  │     ws://host/ws     │              │
└─────────────┘                      └──────────────┘
```

- **Single HTTP Server**: The WebSocket server is attached to the same HTTP server as the REST API (no extra port needed)
- **JWT Authentication**: Clients authenticate with the same JWT token used for REST API calls
- **Broadcast Model**: Events are broadcast to all connected authenticated clients
- **Rate Limiting Protection**: Built-in debouncing and cooldown mechanisms prevent request storms when multiple clients receive the same broadcast

## Rate Limiting Protection

To prevent WebSocket events from triggering too many API requests (which would hit rate limits), the implementation includes:

### Web (React)

**Debounced Hook**: `useRealtimeEventDebounced`
- Waits 2 seconds after the last event before triggering a refetch
- Prevents multiple rapid refetches when events come in quick succession
- Tracks inflight requests to avoid duplicates

```jsx
useRealtimeEventDebounced(
  ['incident:created', 'incident:updated'],
  (payload) => { fetchData(); },
  2000,  // 2 second debounce
  'unique-request-key'  // Prevents duplicate requests
);
```

**Global Cooldown Tracking**:
- Minimum 2-second interval between realtime-triggered fetches
- Inflight request deduplication

### Mobile (Flutter)

**Cooldown + Debounce**:
- 3-second minimum interval between refreshes (Report History)
- 2-second minimum interval for incident details
- 1.5-second debounce timer to batch rapid events

```dart
void _handleRealtimeEvent(RealtimeEvent event) {
  // Check cooldown
  final now = DateTime.now();
  if (_lastRealtimeRefresh != null) {
    final timeSinceLastRefresh = now.difference(_lastRealtimeRefresh!);
    if (timeSinceLastRefresh < _minRefreshInterval) {
      return; // Skip if within cooldown period
    }
  }

  // Debounce the refresh
  _refreshDebounceTimer?.cancel();
  _refreshDebounceTimer = Timer(const Duration(milliseconds: 1500), () {
    _lastRealtimeRefresh = DateTime.now();
    _loadData();
  });
}
```

## Backend

### Dependencies

```bash
cd Backend
npm install
```

The `ws` package has been added to `Backend/package.json`.

### Running the Backend

```bash
cd Backend
npm run dev    # Development with hot reload
# or
npm start      # Production
```

The WebSocket endpoint is automatically available at:
- **URL**: `ws://localhost:3000/ws` (or `wss://` for HTTPS)
- **Same port**: No extra port or process needed

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP/WebSocket server port |
| `JWT_SECRET` | (required) | Secret for JWT verification |
| `WS_PATH` | /ws | WebSocket endpoint path (optional) |

### Backend Events

The backend broadcasts the following event types:

#### `incident:created`
Emitted when a new incident is reported.

```json
{
  "type": "incident:created",
  "payload": {
    "report_id": 123,
    "status": "pending",
    "severity_level": "high",
    "incident_type": "fire",
    "ai_classified": true,
    "updated_at": "2026-03-11T12:00:00.000Z",
    "request_id": "web-1234567890-abcd1234"
  }
}
```

#### `incident:updated`
Emitted when an incident is modified (status change, verification, reclassification, notes added).

```json
{
  "type": "incident:updated",
  "payload": {
    "report_id": 123,
    "status": "verified",
    "verified": true,
    "updated_at": "2026-03-11T12:05:00.000Z",
    "request_id": "web-1234567890-abcd1234",
    "blockchain": {
      "tx_hash": "0x...",
      "block_number": 12345,
      "hash_value": "0x..."
    }
  }
}
```

#### `dispatch:created`
Emitted when responders are dispatched to an incident.

```json
{
  "type": "dispatch:created",
  "payload": {
    "report_id": 123,
    "assignment_group_id": "asg-1234567890-abcd",
    "department_code": "drrmo",
    "team_name": "Rescue Alpha",
    "responder_count": 3,
    "updated_at": "2026-03-11T12:10:00.000Z",
    "request_id": "web-1234567890-abcd1234"
  }
}
```

#### `connection:established`
Sent to a client when they successfully connect.

```json
{
  "type": "connection:established",
  "payload": {
    "connected": true,
    "timestamp": "2026-03-11T12:00:00.000Z"
  }
}
```

## Web (React Frontend)

### Configuration

The WebSocket URL is automatically derived from the `API_URL` in `app.config.js`:

```javascript
// Converts http:// to ws://, https:// to wss://
import { getWebSocketUrl } from '@/core/config/app.config';

const wsUrl = getWebSocketUrl(); // e.g., "ws://localhost:3000/ws?token=xyz"
```

### Setup

The `RealtimeProvider` is already wrapped around the app in `main.jsx`:

```jsx
<RealtimeProvider>
  <App />
</RealtimeProvider>
```

### Using Realtime in Components

#### Hook: `useRealtime()`
Access connection status and control the connection:

```jsx
import { useRealtime } from '@/presentation/context/RealtimeContext.jsx';

function MyComponent() {
  const { isConnected, lastEvent, connect, disconnect } = useRealtime();

  return (
    <div>
      {isConnected ? 'Live updates active' : 'Offline mode'}
    </div>
  );
}
```

#### Hook: `useRealtimeEvent()`
Listen for specific event types:

```jsx
import { useRealtimeEvent } from '@/presentation/context/RealtimeContext.jsx';
import { invalidateIncidentCache } from '@/data/api/incidents.api';

function IncidentList() {
  const fetchIncidents = useCallback(async () => {
    // ... fetch logic
  }, []);

  // Listen for incident events and refresh
  useRealtimeEvent(['incident:created', 'incident:updated'], (payload) => {
    console.log('Incident changed:', payload);
    invalidateIncidentCache();
    fetchIncidents();
  });

  // ...
}
```

### Integrated Pages

The following pages already have realtime integration:
- `DashboardPage.jsx` - Dashboard incident list
- `MapViewPage.jsx` - Map with incident markers
- `AssignedIncidentsPage.jsx` - Department head incident list
- `DepartmentDashboardPage.jsx` - Department admin dashboard
- `IncidentDetailsPage.jsx` - Individual incident details

### Connection Status UI

To show connection status in your component:

```jsx
import { useRealtime } from '@/presentation/context/RealtimeContext.jsx';
import { Wifi, WifiOff } from 'lucide-react';

function ConnectionStatus() {
  const { isConnected } = useRealtime();

  return (
    <div className={`flex items-center gap-2 ${isConnected ? 'text-green-500' : 'text-amber-500'}`}>
      {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
      <span className="text-xs">
        {isConnected ? 'Live' : 'Polling'}
      </span>
    </div>
  );
}
```

## Mobile (Flutter)

### Dependencies

The `web_socket_channel` package has been added to `pubspec.yaml`.

Run this to install:
```bash
cd Frontend/Mobile
flutter pub get
```

### Service: `RealtimeService`

The `RealtimeService` class manages WebSocket connections and provides a stream of events.

#### Connect and Listen

```dart
import 'package:rescuelink_mobile/services/realtime_service.dart';

class _MyScreenState extends State<MyScreen> {
  StreamSubscription<RealtimeEvent>? _subscription;

  @override
  void initState() {
    super.initState();
    _connectRealtime();
  }

  void _connectRealtime() {
    // Connect to WebSocket
    realtimeService.connect().catchError((e) {
      print('Realtime connection failed: $e');
    });

    // Listen for events
    _subscription = realtimeService.eventStream.listen((event) {
      _handleEvent(event);
    });
  }

  void _handleEvent(RealtimeEvent event) {
    switch (event.type) {
      case RealtimeEventType.incidentCreated:
        print('New incident: ${event.payload}');
        _refreshData();
        break;
      case RealtimeEventType.incidentUpdated:
        final reportId = event.payload['report_id'];
        if (reportId == currentIncidentId) {
          _refreshData();
        }
        break;
      default:
        break;
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
```

#### Check Connection Status

```dart
bool isConnected = realtimeService.isConnected;

// Or listen to changes
realtimeService.connectionStream.listen((connected) {
  setState(() => _isConnected = connected);
});
```

### Integrated Screens

The following screens already have realtime integration:
- `report_history_screen.dart` - User's incident history
- `incident_details_screen.dart` - Individual incident view

### WebSocket URL

The URL is automatically derived from `AppConfig.apiBaseUrl`:
- Converts `http://` to `ws://`
- Converts `https://` to `wss://`
- Appends `/ws?token=<jwt>`

For Android emulator: `ws://10.0.2.2:3000/ws`
For real device: Use your PC's LAN IP (e.g., `ws://192.168.1.100:3000/ws`)

## Testing

### Test WebSocket Connection

1. **Backend running**:
   ```bash
   cd Backend
   npm run dev
   ```

2. **Open two browser tabs** with the web dashboard

3. **Create or update an incident** in one tab

4. **Observe** the other tab updates automatically without refresh

### Test via Browser Console

```javascript
// Connect to WebSocket
const token = localStorage.getItem('token');
const ws = new WebSocket(`ws://localhost:3000/ws?token=${token}`);

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};

// Watch for events in console
```

## Troubleshooting

### Connection Issues

**Problem**: WebSocket connection fails
- **Check**: Backend is running on correct port
- **Check**: JWT token is valid and not expired
- **Check**: No firewall blocking WebSocket connections
- **Check**: For mobile: using correct IP (10.0.2.2 for emulator)

**Problem**: Events not received
- **Check**: Client is subscribed to correct event types
- **Check**: Backend is emitting events (check console logs)
- **Check**: No error in browser console or Flutter logs

### Debugging

**Backend logs**:
```
[WS] Client connected: userId=123, role=dispatcher, total clients=2
[WS] Broadcast: type=incident:updated, clients=2, payload={...}
```

**Web browser console**:
```javascript
// Enable debug logging
localStorage.setItem('debug', 'realtime:*');
```

**Flutter debug**:
```dart
// Set in AppConfig
static const bool enableDebugLogging = true;
```

## Security

- **Authentication**: JWT token required in query parameter (`?token=xyz`)
- **Invalid tokens**: Connection is rejected with 401 Unauthorized
- **Same-origin**: WebSocket respects CORS settings from the HTTP server
- **No sensitive data**: Event payloads only include incident metadata, no PII

## Future Enhancements

- **Rooms**: Subscribe to specific departments or incident types
- **Heartbeat**: Ping/pong for detecting stale connections
- **Notifications**: Emit notification events for new alerts
- **Compression**: Enable per-message deflate for larger payloads

## API Reference

### Web (React)

| Hook | Returns | Description |
|------|---------|-------------|
| `useRealtime()` | `{ isConnected, lastEvent, connect, disconnect }` | Connection management |
| `useRealtimeEvent(types, callback)` | void | Subscribe to specific events |

### Mobile (Flutter)

| Method | Returns | Description |
|--------|---------|-------------|
| `realtimeService.connect()` | `Future<void>` | Connect to WebSocket |
| `realtimeService.disconnect()` | void | Disconnect from WebSocket |
| `realtimeService.isConnected` | bool | Connection status |
| `realtimeService.eventStream` | `Stream<RealtimeEvent>` | Event stream |
| `realtimeService.connectionStream` | `Stream<bool>` | Connection status stream |

## Support

For issues or questions:
1. Check server logs for `[WS]` entries
2. Verify WebSocket URL in browser Network tab
3. Test with simple WebSocket client (e.g., websocat)
4. Review this documentation for integration patterns
