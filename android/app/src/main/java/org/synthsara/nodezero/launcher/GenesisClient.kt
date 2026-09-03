package org.synthsara.nodezero.launcher

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

internal data class GenesisResult(
    val response: String,
    val traceId: String?,
    val gateDecision: String?,
    val memoryWrite: String?,
)

internal object GenesisClient {
    private const val MAX_MESSAGE_LENGTH = 2000
    private const val TIMEOUT_MS = 12_000

    fun send(message: String): GenesisResult {
        val cleanMessage = message.trim()
        require(cleanMessage.isNotEmpty()) { "Message cannot be empty." }
        require(cleanMessage.length <= MAX_MESSAGE_LENGTH) {
            "Message must be $MAX_MESSAGE_LENGTH characters or fewer."
        }

        val endpoint = URL(BuildConfig.SARAH_GATEWAY_URL.trim())
        require(endpoint.protocol == "https") {
            "SynthSara mobile gateway must use HTTPS."
        }

        val envelope = JSONObject()
            .put("request_id", UUID.randomUUID().toString())
            .put("session_id", UUID.randomUUID().toString())
            .put("message", cleanMessage)
            .put("persona", "sarah")
            .put("consent_level", "private")
            .put("collective_learning", false)
            .put("pipeline_mode", "shadow")

        val connection = (endpoint.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = TIMEOUT_MS
            readTimeout = TIMEOUT_MS
            doOutput = true
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Cache-Control", "no-store")
        }

        try {
            connection.outputStream.use { stream ->
                stream.write(envelope.toString().toByteArray(Charsets.UTF_8))
            }

            val status = connection.responseCode
            val responseBody = (if (status >= 400) connection.errorStream else connection.inputStream)
                ?.bufferedReader(Charsets.UTF_8)
                ?.use { it.readText() }
                .orEmpty()

            if (responseBody.isBlank()) {
                error("Genesis returned an empty response (HTTP $status).")
            }

            val payload = JSONObject(responseBody)
            val response = payload.optString("response").trim()
            if (response.isEmpty()) {
                val reason = payload.optString("error").ifBlank { "Genesis returned no reflection." }
                error("$reason (HTTP $status)")
            }

            val receipt = payload.optJSONObject("witness_receipt")
            val gate = payload.optJSONObject("gate_zero")

            return GenesisResult(
                response = response,
                traceId = receipt?.optString("trace_id")?.takeIf { it.isNotBlank() },
                gateDecision = gate?.optString("decision")?.takeIf { it.isNotBlank() },
                memoryWrite = receipt?.optString("memory_write")?.takeIf { it.isNotBlank() },
            )
        } finally {
            connection.disconnect()
        }
    }
}
