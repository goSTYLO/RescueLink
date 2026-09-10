package com.example.rescuelink_mobile

import android.app.ActivityManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.annotation.Keep
import androidx.core.app.NotificationCompat
import com.onesignal.notifications.INotificationReceivedEvent
import com.onesignal.notifications.INotificationServiceExtension

/**
 * Runs when a push arrives even if the Flutter process is dead.
 * Critical amber: start [AmberAlertPlayerService] when UI is not foreground
 * (sound+vibe) + CATEGORY_ALARM / full-screen intent. Tray channel alone is often
 * silent after the app was swiped away.
 */
@Keep
class NotificationServiceExtension : INotificationServiceExtension {
    override fun onNotificationReceived(event: INotificationReceivedEvent) {
        val notification = event.notification
        val data = notification.additionalData
        val critical = data?.optBoolean("critical", false) == true
        if (!critical) return

        val context = event.context
        if (!isAppUiForeground(context)) {
            try {
                AmberAlertPlayerService.start(context)
            } catch (_: Exception) {
                // Still show tray.
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
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(fullScreen, true)
        }
    }

    /** True when RescueLink UI is visible — Flutter modal owns the blare. */
    private fun isAppUiForeground(context: Context): Boolean {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            ?: return false
        val pkg = context.packageName
        return am.runningAppProcesses.orEmpty().any {
            it.processName == pkg &&
                it.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
        }
    }
}
