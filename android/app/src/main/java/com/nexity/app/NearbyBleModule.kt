package com.nexity.app

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Intent
import android.os.ParcelUuid
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.UUID

/**
 * Advertises and scans only Nexity's service. Android puts the rotating id in the advert.
 * iPhone cannot, so this phone also serves that id on a readable characteristic and reads it
 * from phones that do not include it in the advert. No name, MAC or user id is used.
 */
class NearbyBleModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val serviceId: UUID = UUID.fromString("6e657869-7479-4e65-6172-627900000001")
  private val charId: UUID = UUID.fromString("6e657869-7479-4e65-6172-627900000002")
  private val serviceUuid = ParcelUuid(serviceId)
  private var advertiser: BluetoothLeAdvertiser? = null
  private var scanner: BluetoothLeScanner? = null
  private var gattServer: BluetoothGattServer? = null
  private var characteristic: BluetoothGattCharacteristic? = null
  private var eph = ByteArray(0)
  private var advertising = false
  private var scanning = false
  private val reading = HashSet<String>()

  override fun getName() = NAME

  private fun adapter(): BluetoothAdapter? =
    context.getSystemService(BluetoothManager::class.java)?.adapter

  private fun manager(): BluetoothManager? =
    context.getSystemService(BluetoothManager::class.java)

  @ReactMethod
  fun supported(promise: Promise) {
    promise.resolve(adapter() != null)
  }

  @ReactMethod
  fun adapterOn(promise: Promise) {
    promise.resolve(adapter()?.isEnabled == true)
  }

  @ReactMethod
  fun requestEnable(promise: Promise) {
    val intent = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
    promise.resolve(true)
  }

  @ReactMethod
  fun start(ephId: String, promise: Promise) {
    val radio = adapter()
    val bytes = decode(ephId)
    if (radio == null || !radio.isEnabled || bytes == null || bytes.size != 16) {
      promise.resolve(false)
      return
    }
    stopInternal()
    eph = bytes
    openServer()
    advertiser = radio.bluetoothLeAdvertiser
    scanner = radio.bluetoothLeScanner
    advertiser?.startAdvertising(advertiseSettings(), advertiseData(), advertiseCallback)
    val filters = listOf(ScanFilter.Builder().setServiceUuid(serviceUuid).build())
    val scanSettings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_BALANCED).build()
    scanner?.startScan(filters, scanSettings, scanCallback)
    scanning = true
    promise.resolve(true)
  }

  @ReactMethod
  fun updateId(ephId: String, promise: Promise) {
    val bytes = decode(ephId)
    if (bytes == null || bytes.size != 16) {
      promise.resolve(false)
      return
    }
    if (!scanning) {
      start(ephId, promise)
      return
    }
    eph = bytes
    characteristic?.value = bytes
    advertiser?.stopAdvertising(advertiseCallback)
    advertising = false
    advertiser?.startAdvertising(advertiseSettings(), advertiseData(), advertiseCallback)
    promise.resolve(true)
  }

  @ReactMethod
  fun stop(promise: Promise) {
    stopInternal()
    promise.resolve(true)
  }

  @ReactMethod fun addListener(eventName: String) {}

  @ReactMethod fun removeListeners(count: Int) {}

  private fun advertiseSettings() = AdvertiseSettings.Builder()
    .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
    .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
    .setConnectable(true)
    .build()

  /** Service UUID only. A 16-byte id plus this UUID does not fit in one advert, so the id is read from the characteristic. */
  private fun advertiseData() = AdvertiseData.Builder()
    .addServiceUuid(serviceUuid)
    .setIncludeDeviceName(false)
    .setIncludeTxPowerLevel(false)
    .build()

  private fun openServer() {
    val server = manager()?.openGattServer(context, serverCallback) ?: return
    val service = BluetoothGattService(serviceId, BluetoothGattService.SERVICE_TYPE_PRIMARY)
    val ch = BluetoothGattCharacteristic(
      charId,
      BluetoothGattCharacteristic.PROPERTY_READ,
      BluetoothGattCharacteristic.PERMISSION_READ,
    )
    ch.value = eph
    service.addCharacteristic(ch)
    server.addService(service)
    gattServer = server
    characteristic = ch
  }

  private fun stopInternal() {
    if (advertiser != null) advertiser?.stopAdvertising(advertiseCallback)
    if (scanning) scanner?.stopScan(scanCallback)
    gattServer?.close()
    gattServer = null
    characteristic = null
    advertising = false
    scanning = false
    reading.clear()
  }

  private fun finishRead(gatt: BluetoothGatt, value: ByteArray?, status: Int, address: String, rssi: Int) {
    if (!reading.remove(address)) return
    if (status == BluetoothGatt.GATT_SUCCESS && value != null) emit(value, rssi)
    gatt.close()
  }

  private fun emit(bytes: ByteArray, rssi: Int) {
    if (bytes.size != 16) return
    val payload = Arguments.createMap()
    payload.putString("ephId", encode(bytes))
    payload.putInt("rssi", rssi)
    context
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("NearbyBleSighting", payload)
  }

  private val advertiseCallback = object : AdvertiseCallback() {
    override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
      advertising = true
    }
    override fun onStartFailure(errorCode: Int) {
      advertising = false
    }
  }

  private val serverCallback = object : BluetoothGattServerCallback() {
    override fun onCharacteristicReadRequest(
      device: BluetoothDevice,
      requestId: Int,
      offset: Int,
      characteristic: BluetoothGattCharacteristic,
    ) {
      val value = if (offset == 0) eph else eph.copyOfRange(offset.coerceAtMost(eph.size), eph.size)
      gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
    }
  }

  private val scanCallback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      val inline = result.scanRecord?.getServiceData(serviceUuid)
      if (inline != null && inline.size == 16) {
        emit(inline, result.rssi)
        return
      }
      val address = result.device.address ?: return
      if (!reading.add(address)) return
      result.device.connectGatt(context, false, object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
          if (newState == BluetoothProfile.STATE_CONNECTED) gatt.discoverServices()
          else {
            reading.remove(address)
            gatt.close()
          }
        }
        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
          val ch = gatt.getService(serviceId)?.getCharacteristic(charId)
          if (ch == null || !gatt.readCharacteristic(ch)) {
            reading.remove(address)
            gatt.close()
          }
        }
        override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
          finishRead(gatt, characteristic.value, status, address, result.rssi)
        }

        override fun onCharacteristicRead(
          gatt: BluetoothGatt,
          characteristic: BluetoothGattCharacteristic,
          value: ByteArray,
          status: Int,
        ) {
          finishRead(gatt, value, status, address, result.rssi)
        }
      }, BluetoothDevice.TRANSPORT_LE)
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
  }
}
