package com.agustin1730.intervalos.androidsession

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ResultReceiver
import app.tauri.plugin.Invoke
import com.fasterxml.jackson.databind.ObjectMapper
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Duration

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AndroidSessionServiceTest {
  private val sessionId = "test-session"

  @After
  fun tearDown() {
    AndroidSessionService.stop(RuntimeEnvironment.getApplication())
  }

  private fun input() = JSONObject().apply {
    put("id", sessionId)
    put("index", 0)
    put("remaining", 5.0)
    put("finishTitle", "Terminado")
    put("stages", org.json.JSONArray().apply {
      put(JSONObject().put("duration", 5).put("stageName", "Trabajo")
        .put("repeatIndex", 1).put("repeatTotal", 2).put("context", "Round 1"))
      put(JSONObject().put("duration", 2).put("stageName", "Descanso")
        .put("repeatIndex", 1).put("repeatTotal", 2).put("context", "Round 1"))
    })
  }

  private fun service() = Robolectric.buildService(AndroidSessionService::class.java).create().get()

  private fun start(service: AndroidSessionService): JSONObject {
    AndroidSessionService.expectStart(sessionId)
    var result: JSONObject? = null
    var code = -1
    val reply = object : ResultReceiver(Handler(Looper.getMainLooper())) {
      override fun onReceiveResult(resultCode: Int, resultData: Bundle?) {
        code = resultCode
        result = JSONObject(resultData!!.getString("snapshot")!!)
      }
    }
    val intent = Intent(service, AndroidSessionService::class.java).apply {
      action = AndroidSessionService.ACTION_START
      putExtra(AndroidSessionService.EXTRA_ID, sessionId)
      putExtra(AndroidSessionService.EXTRA_STAGES, input().getJSONArray("stages").toString())
      putExtra(AndroidSessionService.EXTRA_INDEX, 0)
      putExtra(AndroidSessionService.EXTRA_REMAINING, 5.0)
      putExtra(AndroidSessionService.EXTRA_FINISH_TITLE, "Terminado")
      putExtra("startReply", reply)
    }
    service.onStartCommand(intent, 0, 1)
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(1, code)
    return result!!
  }

  @Test
  fun pluginDoesNotClaimStartBeforeServiceAcknowledges() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val plugin = AndroidSessionPlugin(activity)
    var response: String? = null
    val invoke = Invoke(1, "start", 0, 1, { _, body -> response = body }, input().toString(), ObjectMapper())
    plugin.start(invoke)
    assertNull("Start must wait for onStartCommand and startForeground", response)
    val intent = shadowOf(activity).nextStartedService
    assertNotNull(intent)
    service().onStartCommand(intent, 0, 1)
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(sessionId, JSONObject(response!!).getString("id"))
    assertTrue(JSONObject(response!!).getBoolean("running"))
  }

  @Test
  fun timedOutStartCannotAppearLaterAsAnActiveSession() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val plugin = AndroidSessionPlugin(activity)
    var response: String? = null
    plugin.start(Invoke(3, "start", 0, 1, { _, body -> response = body }, input().toString(), ObjectMapper()))
    val delayedIntent = shadowOf(activity).nextStartedService
    shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(4600))
    assertNotNull(response)
    service().onStartCommand(delayedIntent, 0, 1)
    shadowOf(Looper.getMainLooper()).idle()
    assertNull(AndroidSessionService.snapshotJson())
  }

  @Test
  fun invalidReplacementDoesNotEraseRunningSession() {
    val service = service()
    start(service)
    var code = -1
    val reply = object : ResultReceiver(Handler(Looper.getMainLooper())) {
      override fun onReceiveResult(resultCode: Int, resultData: Bundle?) { code = resultCode }
    }
    AndroidSessionService.expectStart("invalid-session")
    service.onStartCommand(Intent(service, AndroidSessionService::class.java).apply {
      action = AndroidSessionService.ACTION_START
      putExtra(AndroidSessionService.EXTRA_ID, "invalid-session")
      putExtra(AndroidSessionService.EXTRA_STAGES, "[]")
      putExtra(AndroidSessionService.EXTRA_REPLY, reply)
    }, 0, 2)
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(AndroidSessionService.RESULT_ERROR, code)
    assertEquals(sessionId, AndroidSessionService.snapshotJson()!!.getString("id"))
    assertTrue(AndroidSessionService.snapshotJson()!!.getBoolean("running"))
  }

  @Test
  fun serviceAcknowledgesCompleteStateAndPluginSerializesIt() {
    val service = service()
    val snapshot = start(service)
    assertEquals(sessionId, snapshot.getString("id"))
    assertEquals(0, snapshot.getInt("index"))
    assertTrue(snapshot.getBoolean("running"))
    assertEquals(5.0, snapshot.getDouble("remaining"), 0.1)

    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val plugin = AndroidSessionPlugin(activity)
    var response: String? = null
    plugin.state(Invoke(2, "state", 0, 1, { _, body -> response = body }, "{}", ObjectMapper()))
    assertEquals(sessionId, JSONObject(response!!).getString("id"))
  }

  @Test
  fun pluginCommandsFromAnotherThreadReadStateOnMainThread() {
    start(service())
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val plugin = AndroidSessionPlugin(activity)
    var response: String? = null
    val call = Thread {
      plugin.state(Invoke(4, "state", 0, 1, { _, body -> response = body }, "{}", ObjectMapper()))
    }
    call.start()
    call.join()
    assertNull(response)
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(sessionId, JSONObject(response!!).getString("id"))
  }

  @Test
  fun notificationActionsPauseResumeAndCrossStage() {
    val service = service()
    start(service)
    fun action(value: String) {
      service.onStartCommand(Intent(service, AndroidSessionService::class.java).apply {
        this.action = value
        putExtra(AndroidSessionService.EXTRA_ID, sessionId)
      }, 0, 2)
    }
    action(AndroidSessionService.ACTION_PAUSE)
    assertFalse(AndroidSessionService.snapshotJson()!!.getBoolean("running"))
    action(AndroidSessionService.ACTION_NEXT)
    assertEquals(1, AndroidSessionService.snapshotJson()!!.getInt("index"))
    assertEquals(2.0, AndroidSessionService.snapshotJson()!!.getDouble("remaining"), 0.1)
    action(AndroidSessionService.ACTION_PREVIOUS)
    assertEquals(0, AndroidSessionService.snapshotJson()!!.getInt("index"))
    action(AndroidSessionService.ACTION_RESUME)
    assertTrue(AndroidSessionService.snapshotJson()!!.getBoolean("running"))
    assertFalse(AndroidSessionService.control("another-session", "pause"))
    assertTrue(AndroidSessionService.snapshotJson()!!.getBoolean("running"))
  }

  @Test
  fun finishedStateSurvivesServiceShutdownAndCanBeReplaced() {
    val service = service()
    start(service)
    assertTrue(AndroidSessionService.control(sessionId, "next"))
    shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(2300))
    assertTrue(AndroidSessionService.snapshotJson()!!.getBoolean("finished"))
    service.onDestroy()
    assertTrue(AndroidSessionService.snapshotJson()!!.getBoolean("finished"))
    val nextService = service()
    val restarted = start(nextService)
    assertEquals(0, restarted.getInt("index"))
    assertFalse(restarted.getBoolean("finished"))
  }
}
