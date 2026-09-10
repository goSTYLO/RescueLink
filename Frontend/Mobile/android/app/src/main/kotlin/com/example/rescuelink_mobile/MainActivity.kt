package com.example.rescuelink_mobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterFragmentActivity

class MainActivity : FlutterFragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        createEmergencyChannel(manager)
        createUpdatesChannel(manager)
    }

    /**
     * Must match Backend / OneSignal dashboard channel UUID + res/raw/emergency_alert.
     * Sticky channels do not update sound/vibration — delete then recreate on cold start
     * so killed-app tray amber keeps custom sound + vibe.
     */
    private fun createEmergencyChannel(manager: NotificationManager) {
        val channelId = "724e011a-e821-4e40-a810-9c175737a997"
        manager.deleteNotificationChannel(channelId)

        val soundUri = Uri.parse("android.resource://$packageName/raw/emergency_alert")
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val channel = NotificationChannel(
            channelId,
            "RescueLink Emergency",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Amber-style emergency dispatch alerts"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 400, 200, 400)
            setSound(soundUri, attrs)
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
