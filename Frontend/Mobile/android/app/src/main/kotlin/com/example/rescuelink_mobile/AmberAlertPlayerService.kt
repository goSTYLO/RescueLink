package com.example.rescuelink_mobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

/**
 * Plays amber sound + vibe continuously for ~60s when Flutter is not running.
 * Started from [NotificationServiceExtension] on critical pushes.
 */
class AmberAlertPlayerService : Service() {
    private var player: MediaPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private val handler = Handler(Looper.getMainLooper())
    private val stopRunnable = Runnable { stopSelf() }
    private val audioFocusListener = AudioManager.OnAudioFocusChangeListener { change ->
        if (change == AudioManager.AUDIOFOCUS_LOSS) {
            stopSelf()
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            cleanup()
            stopSelf()
            return START_NOT_STICKY
        }

        // Already blaring — keep continuous playback (do not restart / cut).
        if (player?.isPlaying == true) {
            handler.removeCallbacks(stopRunnable)
            handler.postDelayed(stopRunnable, MAX_MS)
            return START_NOT_STICKY
        }

        ensurePlayerChannel()
        val notification = NotificationCompat.Builder(this, PLAYER_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Emergency alert")
            .setContentText("Playing alert sound")
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                FGS_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE,
            )
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                FGS_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
            )
        } else {
            startForeground(FGS_ID, notification)
        }

        acquireWakeLock()
        requestAlarmFocus()
        startPlayback()
        startVibration()
        handler.removeCallbacks(stopRunnable)
        handler.postDelayed(stopRunnable, MAX_MS)
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        cleanup()
        super.onDestroy()
    }

    private fun ensurePlayerChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(PLAYER_CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            PLAYER_CHANNEL_ID,
            "Amber alert player",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Keeps amber sound playing when the app process was closed"
            setSound(null, null)
            enableVibration(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(PowerManager::class.java) ?: return
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "RescueLink:AmberAlert",
        ).apply {
            setReferenceCounted(false)
            acquire(MAX_MS + 5_000L)
        }
    }

    private fun requestAlarmFocus() {
        val am = getSystemService(AudioManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(attrs)
                .setOnAudioFocusChangeListener(audioFocusListener)
                .setAcceptsDelayedFocusGain(false)
                .build()
            audioFocusRequest = req
            am.requestAudioFocus(req)
        } else {
            @Suppress("DEPRECATION")
            am.requestAudioFocus(
                audioFocusListener,
                AudioManager.STREAM_ALARM,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT,
            )
        }
    }

    private fun abandonAudioFocus() {
        val am = getSystemService(AudioManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { am.abandonAudioFocusRequest(it) }
        } else {
            @Suppress("DEPRECATION")
            am.abandonAudioFocus(audioFocusListener)
        }
        audioFocusRequest = null
    }

    private fun startPlayback() {
        if (player != null) return
        try {
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            player = MediaPlayer().apply {
                setAudioAttributes(attrs)
                setWakeMode(this@AmberAlertPlayerService, PowerManager.PARTIAL_WAKE_LOCK)
                isLooping = false
                setDataSource(
                    this@AmberAlertPlayerService,
                    android.net.Uri.parse("android.resource://$packageName/${R.raw.emergency_alert}"),
                )
                setOnCompletionListener { stopSelf() }
                setOnErrorListener { _, _, _ ->
                    stopSelf()
                    true
                }
                prepare()
                start()
            }
        } catch (_: Exception) {
            stopSelf()
        }
    }

    private fun startVibration() {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Vibrator::class.java)
        } ?: return

        // Continuous urgent pulse for ~60s (no long silent gaps).
        val vibrateMs = 400L
        val pauseMs = 200L
        val cycles = (MAX_MS / (vibrateMs + pauseMs)).toInt().coerceAtLeast(1)
        val pattern = LongArray(1 + cycles * 2) { i ->
            when {
                i == 0 -> 0L
                i % 2 == 1 -> vibrateMs
                else -> pauseMs
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(pattern, -1)
        }
    }

    private fun stopVibration() {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Vibrator::class.java)
        } ?: return
        vibrator.cancel()
    }

    private fun cleanup() {
        handler.removeCallbacks(stopRunnable)
        try {
            player?.stop()
        } catch (_: Exception) {
        }
        try {
            player?.release()
        } catch (_: Exception) {
        }
        player = null
        stopVibration()
        abandonAudioFocus()
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Exception) {
        }
        wakeLock = null
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    companion object {
        const val ACTION_START = "com.example.rescuelink_mobile.action.AMBER_START"
        const val ACTION_STOP = "com.example.rescuelink_mobile.action.AMBER_STOP"
        const val EMERGENCY_CHANNEL_ID = "724e011a-e821-4e40-a810-9c175737a997"
        private const val FGS_ID = 72401
        private const val PLAYER_CHANNEL_ID = "rescuelink_amber_player"
        private const val MAX_MS = 60_000L

        fun start(context: Context) {
            val intent = Intent(context, AmberAlertPlayerService::class.java).apply {
                action = ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, AmberAlertPlayerService::class.java).apply {
                action = ACTION_STOP
            }
            try {
                context.startService(intent)
            } catch (_: Exception) {
            }
        }

        /** Create the emergency tray channel if missing. Do not delete it here — NSE can run mid-post. */
        fun ensureEmergencyChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = context.getSystemService(NotificationManager::class.java) ?: return
            manager.deleteNotificationChannel("OS_$EMERGENCY_CHANNEL_ID")
            if (manager.getNotificationChannel(EMERGENCY_CHANNEL_ID) != null) return
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val channel = NotificationChannel(
                EMERGENCY_CHANNEL_ID,
                "RescueLink Emergency",
                NotificationManager.IMPORTANCE_MAX,
            ).apply {
                description = "Amber-style emergency dispatch alerts"
                setSound(
                    android.net.Uri.parse("android.resource://${context.packageName}/${R.raw.emergency_alert}"),
                    attrs,
                )
                enableVibration(true)
                setBypassDnd(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            manager.createNotificationChannel(channel)
        }
    }
}
