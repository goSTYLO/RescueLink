package com.example.rescuelink_mobile

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.annotation.Keep
import androidx.core.app.NotificationCompat
import com.onesignal.notifications.INotificationReceivedEvent
import com.onesignal.notifications.INotificationServiceExtension

/**
 * Runs when a push arrives even if the Flutter process is dead.
 * Critical amber: start [AmberAlertPlayerService] when MainActivity is not resumed
 * (sound+vibe) + CATEGORY_ALARM / full-screen intent. Tray channel alone is often
 * silent after the app was swiped away.
 *
 * Do not use process importance for "UI foreground" — FCM waking NSE for a killed
 * app looks like a foreground process and used to skip the alarm player.
 */
@Keep
class NotificationServiceExtension : INotificationServiceExtension {
    override fun onNotificationReceived(event: INotificationReceivedEvent) {
        val notification = event.notification
        val data = notification.additionalData
        val critical = data?.optBoolean("critical", false) == true
        if (!critical) return

        val context = event.context
        AmberAlertPlayerService.ensureEmergencyChannel(context)
        if (!RescueLinkUi.resumed) {
            try {
                AmberAlertPlayerService.start(context)
            } catch (e: Exception) {
                android.util.Log.e("RescueLinkAmber", "AmberAlertPlayerService start failed", e)
            }
        }

        val reportId = when {
            data.has("report_id") -> data.opt("report_id")?.toString()
            data.has("reportId") -> data.opt("reportId")?.toString()
            else -> null
        }

        notification.setExtender { builder ->
            val launch = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                if (!reportId.isNullOrBlank()) {
                    putExtra("report_id", reportId)
                }
            }
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_IMMUTABLE
                } else {
                    0
                }
            val fullScreen = PendingIntent.getActivity(
                context,
                reportId?.hashCode() ?: 0,
                launch,
                flags,
            )
            builder
                .setChannelId(AmberAlertPlayerService.EMERGENCY_CHANNEL_ID)
                .setSound(
                    android.net.Uri.parse(
                        "android.resource://${context.packageName}/${R.raw.emergency_alert}",
                    ),
                    android.media.AudioManager.STREAM_ALARM,
                )
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(fullScreen, true)
        }
    }
}
