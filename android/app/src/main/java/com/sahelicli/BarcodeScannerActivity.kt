package com.sahelicli

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.*
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class BarcodeScannerActivity : AppCompatActivity() {

    private lateinit var previewView: PreviewView
    private lateinit var overlayView: ScannerOverlayView
    private var camera: Camera? = null
    private lateinit var cameraExecutor: ExecutorService
    private var isTorchOn = false
    private var isScanned = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        cameraExecutor = Executors.newSingleThreadExecutor()

        val rootLayout = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.BLACK)
        }

        // 1. CameraX PreviewView
        previewView = PreviewView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        rootLayout.addView(previewView)

        // 2. HUD Scanner Overlay with Animated Laser Line
        overlayView = ScannerOverlayView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        rootLayout.addView(overlayView)

        // 3. Header Controls (Close X, Title, Flash Toggle)
        val headerLayout = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpToPx(16), dpToPx(36), dpToPx(16), dpToPx(16))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.TOP
            }
        }

        val closeBtn = TextView(this).apply {
            text = "✕"
            textSize = 22f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            val size = dpToPx(40)
            layoutParams = LinearLayout.LayoutParams(size, size)
            val bg = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.OVAL
                setColor(Color.parseColor("#66000000"))
            }
            background = bg
            setOnClickListener {
                onBackPressed()
            }
        }
        headerLayout.addView(closeBtn)

        val titleView = TextView(this).apply {
            text = "Live Barcode Scanner"
            textSize = 16f
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        headerLayout.addView(titleView)

        val flashBtn = TextView(this).apply {
            text = "⚡"
            textSize = 18f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            val size = dpToPx(40)
            layoutParams = LinearLayout.LayoutParams(size, size)
            val bg = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.OVAL
                setColor(Color.parseColor("#66000000"))
            }
            background = bg
            setOnClickListener {
                toggleTorch()
                text = if (isTorchOn) "🔦" else "⚡"
            }
        }
        headerLayout.addView(flashBtn)
        rootLayout.addView(headerLayout)

        // 4. Bottom Hint Label
        val hintView = TextView(this).apply {
            text = "Align barcode inside the frame · Scans automatically"
            textSize = 13f
            setTextColor(Color.parseColor("#E2E8F0"))
            gravity = Gravity.CENTER
            val bg = android.graphics.drawable.GradientDrawable().apply {
                cornerRadius = dpToPx(20).toFloat()
                setColor(Color.parseColor("#880A1124"))
                setStroke(dpToPx(1), Color.parseColor("#4400F0FF"))
            }
            background = bg
            setPadding(dpToPx(16), dpToPx(8), dpToPx(16), dpToPx(8))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                bottomMargin = dpToPx(60)
            }
        }
        rootLayout.addView(hintView)

        setContentView(rootLayout)

        startCamera()
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

            val barcodeScanner = BarcodeScanning.getClient(
                BarcodeScannerOptions.Builder()
                    .setBarcodeFormats(
                        Barcode.FORMAT_EAN_13,
                        Barcode.FORMAT_EAN_8,
                        Barcode.FORMAT_UPC_A,
                        Barcode.FORMAT_UPC_E,
                        Barcode.FORMAT_CODE_128,
                        Barcode.FORMAT_CODE_39,
                        Barcode.FORMAT_CODE_93,
                        Barcode.FORMAT_QR_CODE
                    )
                    .build()
            )

            val imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()

            imageAnalysis.setAnalyzer(cameraExecutor) { imageProxy ->
                processImageProxy(barcodeScanner, imageProxy)
            }

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(
                    this,
                    cameraSelector,
                    preview,
                    imageAnalysis
                )
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @OptIn(ExperimentalGetImage::class)
    private fun processImageProxy(scanner: BarcodeScanner, imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage != null && !isScanned) {
            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
            scanner.process(image)
                .addOnSuccessListener { barcodes ->
                    if (barcodes.isNotEmpty() && !isScanned) {
                        val firstBarcode = barcodes[0]
                        val rawValue = firstBarcode.rawValue ?: firstBarcode.displayValue
                        if (!rawValue.isNullOrBlank()) {
                            isScanned = true
                            vibratePhone()
                            runOnUiThread {
                                BarcodeScannerModule.onBarcodeDetected(rawValue)
                                finish()
                            }
                        }
                    }
                }
                .addOnCompleteListener {
                    imageProxy.close()
                }
        } else {
            imageProxy.close()
        }
    }

    private fun toggleTorch() {
        val cam = camera ?: return
        if (cam.cameraInfo.hasFlashUnit()) {
            isTorchOn = !isTorchOn
            cam.cameraControl.enableTorch(isTorchOn)
        }
    }

    private fun vibratePhone() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val v = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                v?.vibrate(VibrationEffect.createOneShot(100, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                val v = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                @Suppress("DEPRECATION")
                v?.vibrate(100)
            }
        } catch (ignored: Exception) {}
    }

    override fun onBackPressed() {
        if (!isScanned) {
            BarcodeScannerModule.onScanCancelled()
        }
        super.onBackPressed()
    }

    override fun onDestroy() {
        super.onDestroy()
        if (!isScanned) {
            BarcodeScannerModule.onScanCancelled()
        }
        cameraExecutor.shutdown()
    }

    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            resources.displayMetrics
        ).toInt()
    }

    /**
     * Custom HUD view: Dark scrim with transparent central viewport, neon cyan borders,
     * reticle corner brackets, and a sweeping animated laser line.
     */
    inner class ScannerOverlayView(context: Context) : View(context) {

        private val scrimPaint = Paint().apply {
            color = Color.parseColor("#A6050A18")
        }

        private val clearPaint = Paint().apply {
            xfermode = PorterDuffXfermode(PorterDuff.Mode.CLEAR)
        }

        private val borderPaint = Paint().apply {
            style = Paint.Style.STROKE
            color = Color.parseColor("#4400F0FF")
            strokeWidth = dpToPx(1).toFloat()
            isAntiAlias = true
        }

        private val cornerPaint = Paint().apply {
            style = Paint.Style.STROKE
            color = Color.parseColor("#00F0FF")
            strokeWidth = dpToPx(3).toFloat()
            isAntiAlias = true
            strokeCap = Paint.Cap.ROUND
        }

        private val laserPaint = Paint().apply {
            color = Color.parseColor("#00F0FF")
            strokeWidth = dpToPx(2).toFloat()
            isAntiAlias = true
        }

        private val laserAuraPaint = Paint().apply {
            color = Color.parseColor("#4400F0FF")
            strokeWidth = dpToPx(10).toFloat()
            isAntiAlias = true
        }

        private val boxRect = RectF()
        private var laserProgress = 0f
        private var laserAnimator: ValueAnimator? = null

        init {
            setLayerType(LAYER_TYPE_HARDWARE, null)
            laserAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
                duration = 1600
                repeatCount = ValueAnimator.INFINITE
                repeatMode = ValueAnimator.REVERSE
                interpolator = LinearInterpolator()
                addUpdateListener {
                    laserProgress = it.animatedValue as Float
                    invalidate()
                }
                start()
            }
        }

        override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
            super.onSizeChanged(w, h, oldw, oldh)
            val boxWidth = dpToPx(270).toFloat()
            val boxHeight = dpToPx(200).toFloat()
            val left = (w - boxWidth) / 2f
            val top = (h - boxHeight) / 2f - dpToPx(30)
            boxRect.set(left, top, left + boxWidth, top + boxHeight)
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)

            // 1. Draw dark mask over everything
            canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), scrimPaint)

            // 2. Punch transparent hole in the middle
            val cornerRadius = dpToPx(16).toFloat()
            canvas.drawRoundRect(boxRect, cornerRadius, cornerRadius, clearPaint)

            // 3. Draw neon border
            canvas.drawRoundRect(boxRect, cornerRadius, cornerRadius, borderPaint)

            // 4. Draw 4 Corner reticle brackets
            val cl = dpToPx(22).toFloat()
            // Top-Left
            canvas.drawLine(boxRect.left, boxRect.top, boxRect.left + cl, boxRect.top, cornerPaint)
            canvas.drawLine(boxRect.left, boxRect.top, boxRect.left, boxRect.top + cl, cornerPaint)

            // Top-Right
            canvas.drawLine(boxRect.right, boxRect.top, boxRect.right - cl, boxRect.top, cornerPaint)
            canvas.drawLine(boxRect.right, boxRect.top, boxRect.right, boxRect.top + cl, cornerPaint)

            // Bottom-Left
            canvas.drawLine(boxRect.left, boxRect.bottom, boxRect.left + cl, boxRect.bottom, cornerPaint)
            canvas.drawLine(boxRect.left, boxRect.bottom, boxRect.left, boxRect.bottom - cl, cornerPaint)

            // Bottom-Right
            canvas.drawLine(boxRect.right, boxRect.bottom, boxRect.right - cl, boxRect.bottom, cornerPaint)
            canvas.drawLine(boxRect.right, boxRect.bottom, boxRect.right, boxRect.bottom - cl, cornerPaint)

            // 5. Draw sweeping animated laser beam
            val laserY = boxRect.top + (boxRect.height() * laserProgress)
            canvas.drawLine(boxRect.left + dpToPx(6), laserY, boxRect.right - dpToPx(6), laserY, laserAuraPaint)
            canvas.drawLine(boxRect.left + dpToPx(6), laserY, boxRect.right - dpToPx(6), laserY, laserPaint)
        }

        override fun onDetachedFromWindow() {
            super.onDetachedFromWindow()
            laserAnimator?.cancel()
        }
    }
}
