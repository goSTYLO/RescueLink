package com.example.rescuelink_mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterFragmentActivity

class MainActivity : FlutterFragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannels()
        // User opened the app / tapped the tray — stop native amber player.
        AmberAlertPlayerService.stop(this)
    }

    override fun onResume() {
        super.onResume()
        AmberAlertPlayerService.stop(this)
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        createEmergencyChannel(manager)
        createUpdatesChannel(manager)
    }

    /**
     * Must match Backend existing_android_channel_id.
     * Sticky channels — delete then recreate on cold start.
     * Also remove OneSignal's OS_-prefixed dashboard clone if present.
     * Sound/vibe for amber are played by [AmberAlertPlayerService] (channel is visual).
     */
    private fun createEmergencyChannel(manager: NotificationManager) {
        val channelId = "724e011a-e821-4e40-a810-9c175737a997"
        manager.deleteNotificationChannel(channelId)
        manager.deleteNotificationChannel("OS_$channelId")

        val channel = NotificationChannel(
            channelId,
            "RescueLink Emergency",
            NotificationManager.IMPORTANCE_MAX,
        ).apply {
            description = "Amber-style emergency dispatch alerts"
            // Sound+vibe come from AmberAlertPlayerService (reliable when process was
            // swiped away). Channel keeps MAX importance for heads-up tray only.
            enableVibration(false)
            setBypassDnd(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setSound(null, null)
        }
        manager.createNotificationChannel(channel)
    }

    /** High-importance tray channel for quiet / status update pushes. */
    private fun createUpdatesChannel(manager: NotificationManager) {
        val channelId = "rescuelink_updates"
        manager.deleteNotificationChannel(channelId)

        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val channel = NotificationChannel(
            channelId,
            "RescueLink Updates",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Incident status and other non-emergency alerts"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 150, 250)
            setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, attrs)
        }
        manager.createNotificationChannel(channel)
    }
}
