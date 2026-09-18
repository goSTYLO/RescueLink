package com.example.rescuelink_mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/** True only while [MainActivity] is resumed — FCM waking NSE is not "UI foreground". */
object RescueLinkUi {
    @Volatile
    var resumed: Boolean = false
}

class MainActivity : FlutterFragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannels()
        // User opened the app / tapped the tray — stop native amber player.
        stopAmberAndCancelEmergencyTrays()
    }

    override fun onResume() {
        super.onResume()
        RescueLinkUi.resumed = true
        stopAmberAndCancelEmergencyTrays()
    }

    override fun onPause() {
        RescueLinkUi.resumed = false
        super.onPause()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "rescuelink/amber")
            .setMethodCallHandler { call, result ->
                if (call.method == "stop") {
                    stopAmberAndCancelEmergencyTrays()
                    result.success(null)
                } else {
                    result.notImplemented()
                }
            }
    }

    /** Stop FGS player and dismiss emergency-channel trays (that is the 60s WAV). */
    private fun stopAmberAndCancelEmergencyTrays() {
        AmberAlertPlayerService.stop(this)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        val channelId = AmberAlertPlayerService.EMERGENCY_CHANNEL_ID
        for (sbn in manager.activeNotifications) {
            val cid = sbn.notification.channelId
            if (cid == channelId || cid == "OS_$channelId") {
                manager.cancel(sbn.tag, sbn.id)
            }
        }
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
     * Sound/vibe: channel plays emergency_alert (USAGE_ALARM); FGS player is backup
     * when OEM tray is mute.
     */
    private fun createEmergencyChannel(manager: NotificationManager) {
        val channelId = AmberAlertPlayerService.EMERGENCY_CHANNEL_ID
        manager.deleteNotificationChannel(channelId)
        manager.deleteNotificationChannel("OS_$channelId")

        val channel = NotificationChannel(
            channelId,
            "RescueLink Emergency",
            NotificationManager.IMPORTANCE_MAX,
        ).apply {
            description = "Amber-style emergency dispatch alerts"
            // ponytail: channel sound + FGS can double-blare on some OEMs; silence
            // is worse. FGS still covers killed-app when the tray stays mute.
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            setSound(
                android.net.Uri.parse("android.resource://$packageName/${R.raw.emergency_alert}"),
                attrs,
            )
            enableVibration(true)
            setBypassDnd(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
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
