package com.nexity.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/** Keeps the process alive so Nearby can advertise and scan after the app leaves the screen. */
class NearbyBleService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    try {
      val notification = buildNotification()
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (_: Exception) {
      stopSelf()
      return START_NOT_STICKY
    }
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // Swiping Nexity away should not stop Nearby.
  }

  private fun buildNotification(): Notification {
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, "Nearby", NotificationManager.IMPORTANCE_LOW)
      channel.setShowBadge(false)
      manager.createNotificationChannel(channel)
    }
    val open = PendingIntent.getActivity(
      this,
      0,
      Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setContentTitle("Nearby is on")
      .setContentText("Nexity is looking for people around you")
      .setSmallIcon(R.drawable.ic_notification)
      .setOngoing(true)
      .setContentIntent(open)
      .build()
  }

  companion object {
    private const val CHANNEL_ID = "nearby_ble"
    private const val NOTIFICATION_ID = 7041
  }
}
