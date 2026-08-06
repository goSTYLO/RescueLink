# Realtime Sync Design (SSE/WebSocket)

This design documents a migration path from polling-first sync to realtime updates.

## Objectives
- Keep polling as the reliable baseline.
- Add realtime channels for faster UI convergence.
- Preserve deterministic merge/de-dup behavior across dashboard/map/details.

## Proposed architecture
1. **Baseline polling**
   - Keep 30s polling loop for incident list/map.
2. **Realtime channel**
   - Add SSE or WebSocket stream for incident update events.
3. **Event payload**
   - Include `report_id`, `status`, `updated_at`, `request_id`, and optional `blockchain` fields.
4. **Merge policy**
   - Accept newer event only when `updated_at` is newer than local copy.
   - If timestamps are equal, prefer server payload and keep local UI-only fields.
5. **De-dup policy**
   - Use `report_id` as the canonical key.
   - Ignore duplicate events with same `report_id` + `updated_at`.
6. **Fallback policy**
   - If realtime channel drops, show non-blocking fallback notice and continue 30s polling.

## Rollout phases
- **Phase 1:** Polling + event listener architecture in web (completed).
- **Phase 2:** Backend emits incident lifecycle events.
- **Phase 3:** Web subscribes to SSE/WebSocket and merges events using this policy.
- **Phase 4:** Reduce polling cadence when realtime channel is healthy.
