package com.agustin1730.intervalos.androidsession

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ResultReceiver
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import app.tauri.plugin.JSObject
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

@InvokeArg
class AndroidStopArg {
  var id: String = ""
}

@TauriPlugin
class AndroidSessionPlugin(private val activity: Activity) : Plugin(activity) {
  private val handler = Handler(Looper.getMainLooper())

  private fun onMain(invoke: Invoke, block: () -> Unit) {
    val action = Runnable {
      try { block() } catch (error: Exception) {
        invoke.reject(error.message ?: "Error del servicio Android")
      }
    }
    if (Looper.myLooper() == Looper.getMainLooper()) action.run() else handler.post(action)
  }

  @Command
  fun start(invoke: Invoke) {
    onMain(invoke) { startOnMain(invoke) }
  }

  private fun startOnMain(invoke: Invoke) {
    val args = invoke.parseArgs(AndroidStartArg::class.java)
    if (args.id.isBlank() || args.stages.isEmpty() || args.stages.any { it.duration <= 0 } ||
      args.index !in args.stages.indices || !args.remaining.isFinite() ||
      args.remaining <= 0 || args.remaining > args.stages[args.index].duration) {
      invoke.reject("Sesión Android inválida")
      return
    }
    var completed = false
    val timeout = Runnable {
      if (!completed) {
        completed = true
        AndroidSessionService.stop(activity, args.id)
        invoke.reject("Android no confirmó el inicio del temporizador")
      }
    }
    val reply = object : ResultReceiver(handler) {
      override fun onReceiveResult(resultCode: Int, resultData: Bundle?) {
        val snapshot = resultData?.getString(AndroidSessionService.EXTRA_SNAPSHOT)
        if (completed) {
          if (resultCode == AndroidSessionService.RESULT_OK) AndroidSessionService.stop(activity, args.id)
          return
        }
        completed = true
        handler.removeCallbacks(timeout)
        if (resultCode == AndroidSessionService.RESULT_OK && snapshot != null) {
          invoke.resolve(JSObject(snapshot))
        } else {
          invoke.reject(resultData?.getString(AndroidSessionService.EXTRA_MESSAGE) ?: "No se pudo iniciar el servicio Android")
        }
      }
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
      putExtra(AndroidSessionService.EXTRA_REPLY, reply)
    }
    handler.postDelayed(timeout, 4500L)
    try {
      AndroidSessionService.expectStart(args.id)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) activity.startForegroundService(intent)
      else activity.startService(intent)
    } catch (error: Exception) {
      completed = true
      handler.removeCallbacks(timeout)
      AndroidSessionService.cancelExpectedStart(args.id)
      invoke.reject("Android rechazó el inicio: ${error.message ?: error.javaClass.simpleName}")
    }
  }

  @Command
  fun control(invoke: Invoke) {
    onMain(invoke) {
      val args = invoke.parseArgs(AndroidControlArg::class.java)
      if (!AndroidSessionService.control(args.id, args.action)) {
        invoke.reject("No hay una sesión Android activa")
      } else {
        val snapshot = AndroidSessionService.snapshotJson()
        if (snapshot == null) invoke.reject("No hay una sesión Android activa")
        else invoke.resolve(JSObject(snapshot.toString()))
      }
    }
  }

  @Command
  fun state(invoke: Invoke) {
    onMain(invoke) {
      val snapshot = AndroidSessionService.snapshotJson()
      if (snapshot == null) invoke.resolve()
      else invoke.resolve(JSObject(snapshot.toString()))
    }
  }

  @Command
  fun stop(invoke: Invoke) {
    onMain(invoke) {
      val args = invoke.parseArgs(AndroidStopArg::class.java)
      AndroidSessionService.stop(activity, args.id)
      invoke.resolve()
    }
  }
}
