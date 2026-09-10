package com.sahelicli

import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage

class BarcodeScannerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private var activePromise: Promise? = null

        fun onBarcodeDetected(code: String) {
            val p = activePromise
            activePromise = null
            val result = WritableNativeMap().apply {
                putString("rawValue", code)
                putString("displayValue", code)
            }
            p?.resolve(result)
        }

        fun onScanCancelled() {
            val p = activePromise
            activePromise = null
            p?.resolve(null)
        }
    }

    override fun getName(): String = "BarcodeScannerModule"

    @ReactMethod
    fun startLiveScanner(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is not available")
            return
        }

        activePromise = promise
        try {
            val intent = Intent(activity, BarcodeScannerActivity::class.java)
            activity.startActivity(intent)
        } catch (e: Exception) {
            activePromise = null
            promise.reject("LAUNCH_FAILED", "Could not start live barcode scanner: ${e.message}", e)
        }
    }

    @ReactMethod
    fun scanBarcodeFromUri(imageUriString: String, promise: Promise) {
        try {
            val uri = Uri.parse(imageUriString)
            val inputImage: InputImage = try {
                InputImage.fromFilePath(reactApplicationContext, uri)
            } catch (e: Exception) {
                val stream = reactApplicationContext.contentResolver.openInputStream(uri)
                val bitmap = BitmapFactory.decodeStream(stream)
                stream?.close()
                if (bitmap != null) {
                    InputImage.fromBitmap(bitmap, 0)
                } else {
                    throw e
                }
            }

            val scanner = BarcodeScanning.getClient()
            scanner.process(inputImage)
                .addOnSuccessListener { barcodes ->
                    if (barcodes.isNotEmpty()) {
                        val firstBarcode = barcodes[0]
                        val rawValue = firstBarcode.rawValue ?: firstBarcode.displayValue ?: ""
                        val result = WritableNativeMap().apply {
                            putString("rawValue", rawValue)
                            putString("displayValue", firstBarcode.displayValue ?: rawValue)
                            putInt("format", firstBarcode.format)
                        }
                        promise.resolve(result)
                    } else {
                        promise.resolve(null)
                    }
                }
                .addOnFailureListener { e ->
                    promise.reject("SCAN_FAILED", "Failed to scan barcode: ${e.message}", e)
                }
        } catch (e: Exception) {
            promise.reject("IMAGE_ERROR", "Could not process image for barcode scanning: ${e.message}", e)
        }
    }
}
