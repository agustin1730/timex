package com.agustin1730.intervalos.androidsession

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import org.json.JSONArray
import org.json.JSONObject

@InvokeArg
class AndroidStageArg {
  var duration: Long = 0
  var stageName: String = ""
  var color: String = ""
  var repeatIndex: Long = 1
  var repeatTotal: Long = 1
  var context: String = ""
}

@InvokeArg
class AndroidStartArg {
  var id: String = ""
  var stages: List<AndroidStageArg> = emptyList()
  var index: Int = 0
  var remaining: Double = 0.0
  var finishTitle: String = "Temporizador finalizado"
}

@InvokeArg
class AndroidControlArg {
  var id: String = ""
  var action: String = ""
}

@TauriPlugin
class AndroidSessionPlugin(private val activity: Activity) : Plugin(activity) {
  override fun load(webView: WebView) {
    super.load(webView)
  }

  @Command
  fun start(invoke: Invoke) {
    val args = invoke.parseArgs(AndroidStartArg::class.java)
    if (args.id.isBlank() || args.stages.isEmpty()) {
      invoke.reject("Sesión Android inválida")
      return
    }
    val stages = JSONArray()
    args.stages.forEach { stage ->
      stages.put(JSONObject().apply {
        put("duration", stage.duration)
        put("stageName", stage.stageName)
        put("color", stage.color)
        put("repeatIndex", stage.repeatIndex)
        put("repeatTotal", stage.repeatTotal)
        put("context", stage.context)
      })
    }
    val intent = Intent(activity, AndroidSessionService::class.java).apply {
      action = AndroidSessionService.ACTION_START
      putExtra(AndroidSessionService.EXTRA_ID, args.id)
      putExtra(AndroidSessionService.EXTRA_STAGES, stages.toString())
      putExtra(AndroidSessionService.EXTRA_INDEX, args.index)
      putExtra(AndroidSessionService.EXTRA_REMAINING, args.remaining)
      putExtra(AndroidSessionService.EXTRA_FINISH_TITLE, args.finishTitle)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) activity.startForegroundService(intent)
    else activity.startService(intent)
    invoke.resolveObject(AndroidSessionService.snapshotJson())
  }

  @Command
  fun control(invoke: Invoke) {
    val args = invoke.parseArgs(AndroidControlArg::class.java)
    if (!AndroidSessionService.control(args.id, args.action)) {
      invoke.reject("No hay una sesión Android activa")
      return
    }
    invoke.resolveObject(AndroidSessionService.snapshotJson())
  }

  @Command
  fun state(invoke: Invoke) {
    invoke.resolveObject(AndroidSessionService.snapshotJson())
  }

  @Command
  fun stop(invoke: Invoke) {
    AndroidSessionService.stop(activity)
    invoke.resolve()
  }
}
