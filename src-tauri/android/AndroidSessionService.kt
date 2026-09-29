package com.agustin1730.intervalos.androidsession

import android.app.*
import android.content.*
import android.graphics.Color
import android.os.*
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.min

class AndroidSessionService : Service() {
  data class Stage(val duration: Long, val name: String, val color: String, val repeat: Long, val total: Long, val context: String)
  data class State(var id: String, val stages: List<Stage>, var index: Int, var remainingMs: Long, var running: Boolean, var finished: Boolean, val finishTitle: String)

  private val handler = Handler(Looper.getMainLooper())
  private val ticker = object : Runnable { override fun run() { tick() } }
  private var state: State? = null
  private var deadline = 0L

  override fun onCreate() {
    super.onCreate()
    active = this
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> startSession(intent)
      ACTION_PAUSE -> control(intent.getStringExtra(EXTRA_ID) ?: "", "pause")
      ACTION_RESUME -> control(intent.getStringExtra(EXTRA_ID) ?: "", "resume")
      ACTION_PREVIOUS -> control(intent.getStringExtra(EXTRA_ID) ?: "", "previous")
      ACTION_NEXT -> control(intent.getStringExtra(EXTRA_ID) ?: "", "next")
      ACTION_STOP -> stop(this, intent.getStringExtra(EXTRA_ID))
    }
    return START_NOT_STICKY
  }

  private fun startSession(intent: Intent) {
    @Suppress("DEPRECATION")
    val reply = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(EXTRA_REPLY, ResultReceiver::class.java)
      else intent.getParcelableExtra(EXTRA_REPLY) as? ResultReceiver
    try {
      val id = intent.getStringExtra(EXTRA_ID) ?: throw IllegalArgumentException("Falta el identificador")
      if (pendingStartId != id) throw IllegalStateException("Inicio de sesión cancelado")
      val raw = intent.getStringExtra(EXTRA_STAGES) ?: throw IllegalArgumentException("Faltan etapas")
      val json = JSONArray(raw)
      val stages = (0 until json.length()).map {
        val item = json.getJSONObject(it)
        Stage(item.optLong("duration"), item.optString("stageName"), item.optString("color"), item.optLong("repeatIndex", 1), item.optLong("repeatTotal", 1), item.optString("context"))
      }
      if (stages.isEmpty() || stages.any { it.duration <= 0 }) throw IllegalArgumentException("Etapas inválidas")
      val index = intent.getIntExtra(EXTRA_INDEX, 0)
      if (index !in stages.indices) throw IllegalArgumentException("Índice de etapa inválido")
      val seconds = intent.getDoubleExtra(EXTRA_REMAINING, stages[index].duration.toDouble())
      if (!seconds.isFinite() || seconds <= 0 || seconds > stages[index].duration) throw IllegalArgumentException("Tiempo restante inválido")
      val remaining = (seconds * 1000).toLong().coerceAtLeast(1)
      val previous = state
      val previousDeadline = deadline
      handler.removeCallbacks(ticker)
      state = State(id, stages, index, remaining, true, false, intent.getStringExtra(EXTRA_FINISH_TITLE) ?: "Temporizador finalizado")
      deadline = SystemClock.elapsedRealtime() + remaining
      try {
        startForeground(NOTIFICATION_ID, notification())
      } catch (error: Exception) {
        state = previous
        deadline = previousDeadline
        if (previous != null && previous.running) handler.post(ticker)
        throw error
      }
      sharedState = state
      pendingStartId = null
      tick()
      reply?.send(RESULT_OK, Bundle().apply { putString(EXTRA_SNAPSHOT, snapshotJson()!!.toString()) })
    } catch (error: Exception) {
      cancelExpectedStart(intent.getStringExtra(EXTRA_ID) ?: "")
      if (state != null && sharedState === state && state?.id == intent.getStringExtra(EXTRA_ID)) {
        handler.removeCallbacks(ticker)
        stopForeground(STOP_FOREGROUND_REMOVE)
        sharedState = null
        state = null
      }
      if (state == null) stopSelf()
      reply?.send(RESULT_ERROR, Bundle().apply { putString(EXTRA_MESSAGE, error.message ?: "No se pudo iniciar el servicio") })
    }
  }

  private fun tick() {
    handler.removeCallbacks(ticker)
    val current = state ?: return
    if (current.running) {
      var now = SystemClock.elapsedRealtime()
      while (now >= deadline) {
        if (current.index == current.stages.lastIndex) {
          current.remainingMs = 0
          current.running = false
          current.finished = true
          updateNotification()
          stopForeground(STOP_FOREGROUND_DETACH)
          stopSelf()
          return
        }
        current.index += 1
        current.remainingMs = current.stages[current.index].duration * 1000
        deadline += current.remainingMs
        now = SystemClock.elapsedRealtime()
      }
      current.remainingMs = max(0L, deadline - now)
      updateNotification()
      handler.postDelayed(ticker, 200L)
    } else {
      updateNotification()
    }
  }

  private fun updateNotification() {
    if (state != null) NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, notification())
  }

  private fun notification(): Notification {
    val s = state ?: return NotificationCompat.Builder(this, CHANNEL_ID).setSmallIcon(android.R.drawable.ic_media_play).setContentTitle("Time X").build()
    val stage = s.stages[s.index]
    val remaining = String.format("%02d:%02d", s.remainingMs / 60000, (s.remainingMs / 1000) % 60)
    val progress = ((1.0 - s.remainingMs.toDouble() / (stage.duration * 1000.0)) * 100).toInt().coerceIn(0, 100)
    val pauseIcon = if (s.running) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
    val pauseTitle = if (s.running) "Pausar" else "Reanudar"
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setContentTitle(if (s.finished) s.finishTitle else "Time X · ${stage.name}")
      .setContentText(if (s.finished) "Finalizado" else "$remaining · ${stage.context}")
      .setSubText("Repetición ${stage.repeat}/${stage.total}")
      .setProgress(100, progress, false)
      .setOngoing(!s.finished)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setColor(Color.rgb(255, 153, 0))
      .setContentIntent(mainIntent())
    if (!s.finished) {
      notification.addAction(android.R.drawable.ic_media_previous, "Anterior", actionIntent(ACTION_PREVIOUS))
        .addAction(pauseIcon, pauseTitle, actionIntent(if (s.running) ACTION_PAUSE else ACTION_RESUME))
        .addAction(android.R.drawable.ic_media_next, "Siguiente", actionIntent(ACTION_NEXT))
    }
    return notification.build()
  }

  private fun actionIntent(action: String): PendingIntent {
    val intent = Intent(this, AndroidSessionService::class.java).apply { this.action = action; putExtra(EXTRA_ID, state?.id) }
    return PendingIntent.getService(this, action.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun mainIntent(): PendingIntent {
    val intent = packageManager.getLaunchIntentForPackage(packageName) ?: Intent(this, AndroidSessionService::class.java)
    return PendingIntent.getActivity(this, 100, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  override fun onBind(intent: Intent?): IBinder? = null
  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    if (active === this) {
      active = null
      if (sharedState === state && state?.finished != true) sharedState = null
    }
    super.onDestroy()
  }

  companion object {
    const val ACTION_START = "com.agustin1730.intervalos.START"
    const val ACTION_PAUSE = "com.agustin1730.intervalos.PAUSE"
    const val ACTION_RESUME = "com.agustin1730.intervalos.RESUME"
    const val ACTION_PREVIOUS = "com.agustin1730.intervalos.PREVIOUS"
    const val ACTION_NEXT = "com.agustin1730.intervalos.NEXT"
    const val ACTION_STOP = "com.agustin1730.intervalos.STOP"
    const val EXTRA_ID = "sessionId"
    const val EXTRA_STAGES = "stages"
    const val EXTRA_INDEX = "index"
    const val EXTRA_REMAINING = "remaining"
    const val EXTRA_FINISH_TITLE = "finishTitle"
    const val EXTRA_REPLY = "startReply"
    const val EXTRA_SNAPSHOT = "snapshot"
    const val EXTRA_MESSAGE = "message"
    const val RESULT_OK = 1
    const val RESULT_ERROR = 2
    const val CHANNEL_ID = "timex_timer"
    const val NOTIFICATION_ID = 2701
    private var active: AndroidSessionService? = null
    private var sharedState: State? = null
    private var pendingStartId: String? = null

    fun expectStart(id: String) { pendingStartId = id }
    fun cancelExpectedStart(id: String) { if (pendingStartId == id) pendingStartId = null }

    fun snapshotJson(): JSONObject? {
      val s = sharedState ?: active?.state ?: return null
      val stage = s.stages[s.index]
      return JSONObject().put("id", s.id).put("index", s.index).put("remaining", s.remainingMs / 1000.0).put("running", s.running).put("finished", s.finished).put("stageName", stage.name).put("color", stage.color).put("repeatIndex", stage.repeat).put("repeatTotal", stage.total).put("widgetEnabled", false).put("widgetVisible", false)
    }

    fun control(id: String, action: String): Boolean {
      val service = active ?: return false
      val s = service.state ?: return false
      if (id != s.id) return false
      if (action !in setOf("pause", "resume", "previous", "next", "reset")) return false
      service.handler.removeCallbacks(service.ticker)
      when (action) {
        "pause" -> if (s.running) { s.remainingMs = max(0L, service.deadline - SystemClock.elapsedRealtime()); s.running = false }
        "resume" -> if (!s.running && !s.finished) { s.running = true; service.deadline = SystemClock.elapsedRealtime() + s.remainingMs }
        "previous", "next" -> { s.index = if (action == "next") min(s.index + 1, s.stages.lastIndex) else max(s.index - 1, 0); s.remainingMs = s.stages[s.index].duration * 1000; s.finished = false; if (s.running) service.deadline = SystemClock.elapsedRealtime() + s.remainingMs }
        "reset" -> { s.index = 0; s.remainingMs = s.stages[0].duration * 1000; s.running = false; s.finished = false }
      }
      sharedState = s
      if (s.running) service.tick() else service.updateNotification()
      return true
    }

    fun stop(context: Context, id: String? = null) {
      if (id != null && id != pendingStartId && id != active?.state?.id && id != sharedState?.id) return
      if (pendingStartId != null && id != null && id != pendingStartId) return
      if (id == null || id == pendingStartId) pendingStartId = null
      active?.let { it.handler.removeCallbacks(it.ticker) }
      active?.stopForeground(STOP_FOREGROUND_REMOVE)
      active?.stopSelf()
      active = null
      sharedState = null
      context.stopService(Intent(context, AndroidSessionService::class.java))
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, "Temporizador de Time X", NotificationManager.IMPORTANCE_DEFAULT)
      channel.enableVibration(false)
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
  }
}
