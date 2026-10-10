package com.nexity.app

import android.bluetooth.BluetoothAdapter
import android.location.LocationManager
import android.os.Build
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.provider.Settings
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.UUID

/**
 * Broadcasts the rotating id inside the advert and reads other phones' ids from their adverts.
 * Phones never connect, pair, or open a GATT link. Vivo and other OEM stacks often reject the
 * first scan or advert, so both are retried until they stick.
 */
class NearbyBleModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val shortId: UUID = UUID.fromString("0000fff0-0000-1000-8000-00805f9b34fb")
  private val shortUuid = ParcelUuid(shortId)
  private val legacyId: UUID = UUID.fromString("6e657869-7479-4e65-6172-627900000001")
  private val legacyUuid = ParcelUuid(legacyId)
  private val handler = Handler(Looper.getMainLooper())
  private var eph = ByteArray(0)
  private var session = 0
  private var scanning = false
  private var advertising = false
  private var scanTries = 0
  private var advertiseTries = 0
  private var compact = false
  private var connectable = false
  private val seenAt = HashMap<String, Long>()

  override fun getName() = NAME

  private fun adapter(): BluetoothAdapter? =
    context.getSystemService(android.bluetooth.BluetoothManager::class.java)?.adapter

  @ReactMethod
  fun supported(promise: Promise) {
    promise.resolve(adapter() != null)
  }

  @ReactMethod
  fun adapterOn(promise: Promise) {
    promise.resolve(adapter()?.isEnabled == true)
  }

  @ReactMethod
  fun scanNeedsLocation(promise: Promise) {
    val brand = Build.MANUFACTURER.lowercase()
    promise.resolve(brand.contains("vivo") || brand.contains("iqoo"))
  }

  @ReactMethod
  fun locationOff(promise: Promise) {
    try {
      val manager = context.getSystemService(LocationManager::class.java)
      val on = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        manager?.isLocationEnabled == true
      } else {
        manager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true ||
          manager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true
      }
      promise.resolve(!on)
    } catch (_: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun openLocationSettings(promise: Promise) {
    val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      val activity = context.currentActivity
      if (activity != null) activity.startActivity(intent) else context.startActivity(intent)
      promise.resolve(true)
    } catch (_: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun requestEnable(promise: Promise) {
    val enable = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
    val activity = context.currentActivity
    try {
      if (activity != null) activity.startActivity(enable)
      else context.startActivity(enable.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      promise.resolve(true)
    } catch (_: Exception) {
      try {
        val settings = Intent(Settings.ACTION_BLUETOOTH_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (activity != null) activity.startActivity(settings)
        else context.startActivity(settings)
        promise.resolve(true)
      } catch (_: Exception) {
        promise.resolve(false)
      }
    }
  }

  @ReactMethod
  fun start(ephId: String, promise: Promise) {
    val radio = adapter()
    val bytes = decode(ephId)
    if (radio == null || bytes == null || bytes.size != 16) {
      promise.resolve(false)
      return
    }
    if (!radio.isEnabled) {
      promise.resolve(false)
      return
    }
    stopInternal()
    val gen = session
    eph = bytes
    handler.post {
      if (gen != session) return@post
      beginScan(gen)
      beginAdvertise(gen)
    }
    promise.resolve(true)
  }

  @ReactMethod
  fun updateId(ephId: String, promise: Promise) {
    val bytes = decode(ephId)
    if (bytes == null || bytes.size != 16) {
      promise.resolve(false)
      return
    }
    if (session == 0) {
      start(ephId, promise)
      return
    }
    eph = bytes
    seenAt.clear()
    val gen = session
    handler.post {
      if (gen != session) return@post
      restartAdvertise(gen)
    }
    promise.resolve(true)
  }

  @ReactMethod
  fun stop(promise: Promise) {
    stopInternal()
    promise.resolve(true)
  }

  @ReactMethod fun addListener(eventName: String) {}

  @ReactMethod fun removeListeners(count: Int) {}

  private fun beginScan(gen: Int) {
    if (gen != session) return
    val radio = adapter()
    val scanner = radio?.bluetoothLeScanner
    if (radio == null || !radio.isEnabled || scanner == null) {
      scheduleScan(gen)
      return
    }
    try {
      if (scanning) scanner.stopScan(scanCallback)
    } catch (_: Exception) {
    }
    try {
      scanner.startScan(filters(), scanSettings(), scanCallback)
      scanning = true
      scanTries = 0
    } catch (_: Exception) {
      scanning = false
      scheduleScan(gen)
    }
  }

  private fun scheduleScan(gen: Int) {
    if (gen != session) return
    scanTries += 1
    if (scanTries > 12) return
    val delay = when {
      scanTries <= 1 -> 400L
      scanTries == 2 -> 1500L
      else -> 5000L
    }
    handler.postDelayed({ beginScan(gen) }, delay)
  }

  private fun beginAdvertise(gen: Int) {
    if (gen != session || eph.size != 16) return
    val radio = adapter()
    val advertiser = radio?.bluetoothLeAdvertiser
    if (radio == null || !radio.isEnabled || advertiser == null) {
      scheduleAdvertise(gen)
      return
    }
    try {
      advertiser.stopAdvertising(advertiseCallback)
    } catch (_: Exception) {
    }
    advertising = false
    try {
      advertiser.startAdvertising(advertiseSettings(), advertiseData(), advertiseCallback)
    } catch (_: Exception) {
      scheduleAdvertise(gen)
    }
  }

  private fun restartAdvertise(gen: Int) {
    advertiseTries = 0
    beginAdvertise(gen)
  }

  private fun scheduleAdvertise(gen: Int) {
    if (gen != session) return
    advertiseTries += 1
    if (advertiseTries >= 2) compact = true
    if (advertiseTries > 12) return
    val delay = when {
      advertiseTries <= 1 -> 400L
      advertiseTries == 2 -> 1500L
      else -> 5000L
    }
    handler.postDelayed({ beginAdvertise(gen) }, delay)
  }

  private fun filters(): List<ScanFilter> = listOf(
    ScanFilter.Builder().setServiceUuid(shortUuid).build(),
    ScanFilter.Builder().setServiceUuid(legacyUuid).build(),
    ScanFilter.Builder().setManufacturerData(MANUFACTURER_ID, byteArrayOf(0), byteArrayOf(0)).build(),
  )

  private fun scanSettings(): ScanSettings = ScanSettings.Builder()
    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
    .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
    .setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
    .setReportDelay(0)
    .build()

  private fun advertiseSettings() = AdvertiseSettings.Builder()
    .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
    .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
    .setConnectable(connectable)
    .setTimeout(0)
    .build()

  /** 16-bit UUID plus the 16-byte id fits in one advert, so a connection is never required. */
  private fun advertiseData(): AdvertiseData {
    val data = AdvertiseData.Builder()
      .setIncludeDeviceName(false)
      .setIncludeTxPowerLevel(false)
    data.addManufacturerData(MANUFACTURER_ID, eph)
    if (!compact) data.addServiceUuid(shortUuid)
    return data.build()
  }

  private fun stopInternal() {
    session += 1
    handler.removeCallbacksAndMessages(null)
    val radio = adapter()
    try {
      radio?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
    } catch (_: Exception) {
    }
    try {
      if (scanning) radio?.bluetoothLeScanner?.stopScan(scanCallback)
    } catch (_: Exception) {
    }
    advertising = false
    scanning = false
    scanTries = 0
    advertiseTries = 0
    compact = false
    connectable = false
    seenAt.clear()
  }

  private fun payloadOf(result: ScanResult): ByteArray? {
    val record = result.scanRecord ?: return null
    val service = record.getServiceData(shortUuid)
    if (service != null && service.size == 16) return service
    val maker = record.getManufacturerSpecificData(MANUFACTURER_ID)
    if (maker != null && maker.size == 16) return maker
    val name = record.deviceName
    if (!name.isNullOrEmpty()) {
      val named = decode(name)
      if (named != null && named.size == 16) return named
    }
    return null
  }

  private fun emit(bytes: ByteArray, rssi: Int) {
    if (bytes.size != 16 || bytes.contentEquals(eph)) return
    val encoded = encode(bytes)
    val now = android.os.SystemClock.elapsedRealtime()
    val previous = seenAt[encoded]
    if (previous != null && now - previous < 1000L) return
    seenAt[encoded] = now
    val payload = Arguments.createMap()
    payload.putString("ephId", encoded)
    payload.putInt("rssi", rssi)
    context
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("NearbyBleSighting", payload)
  }

  private val advertiseCallback = object : AdvertiseCallback() {
    override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
      advertising = true
      advertiseTries = 0
    }

    override fun onStartFailure(errorCode: Int) {
      advertising = false
      val gen = session
      if (errorCode == ADVERTISE_FAILED_ALREADY_STARTED) return
      if (errorCode == ADVERTISE_FAILED_DATA_TOO_LARGE) compact = true
      if (errorCode == ADVERTISE_FAILED_FEATURE_UNSUPPORTED) connectable = true
      handler.post { scheduleAdvertise(gen) }
    }
  }

  private val scanCallback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      val bytes = payloadOf(result) ?: return
      emit(bytes, result.rssi)
    }

    override fun onBatchScanResults(results: MutableList<ScanResult>) {
      for (result in results) onScanResult(ScanSettings.CALLBACK_TYPE_ALL_MATCHES, result)
    }

    override fun onScanFailed(errorCode: Int) {
      scanning = false
      val gen = session
      if (errorCode == SCAN_FAILED_ALREADY_STARTED) return
      handler.post { scheduleScan(gen) }
    }
  }

  private fun decode(ephId: String): ByteArray? = try {
    Base64.decode(ephId, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
  } catch (_: IllegalArgumentException) {
    null
  }

  private fun encode(bytes: ByteArray): String =
    Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)

  companion object {
    const val NAME = "NearbyBle"
    private const val MANUFACTURER_ID = 0x4E58
  }
}
