package org.synthsara.nodezero.launcher

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.GridLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var content: FrameLayout
    private val launcherRepository by lazy { LauncherRepository(this) }
    private val localStore by lazy { LocalStore(this) }
    private val executor = Executors.newSingleThreadExecutor()

    // Sarah chat is deliberately process-memory only in v0.1.
    private val ephemeralSarahLog = mutableListOf<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildShell())
        renderHome()
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun buildShell(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(18), dp(18), dp(12))
            setBackgroundColor(Color.rgb(246, 246, 244))
        }

        root.addView(TextView(this).apply {
            text = "SynthSara"
            textSize = 30f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setTextColor(Color.rgb(25, 25, 25))
        })

        root.addView(TextView(this).apply {
            text = "Node Zero · Android shell v0.1"
            textSize = 13f
            setTextColor(Color.DKGRAY)
            setPadding(0, 0, 0, dp(12))
        })

        val nav = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }
        nav.addView(navButton("Home") { renderHome() })
        nav.addView(navButton("Sarah") { renderSarah() })
        nav.addView(navButton("Projects") { renderProjects() })
        nav.addView(navButton("Apps") { renderApps() })

        root.addView(HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            addView(nav)
        }, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ))

        content = FrameLayout(this)
        root.addView(content, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1f,
        ))

        root.addView(TextView(this).apply {
            text = "Private by default · no durable Sarah chat memory · no optional device scopes"
            textSize = 11f
            setTextColor(Color.GRAY)
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, 0)
        })

        return root
    }

    private fun renderHome() {
        val column = pageColumn()

        column.addView(sectionTitle("Your phone, with SynthSara as the front door"))
        column.addView(bodyText(
            "Android stays underneath. SynthSara handles Home, apps, projects, and a private Gate 0 conversation with Sarah AI.",
        ))

        column.addView(actionButton("Set SynthSara as Home") {
            openHomeSettings()
        })

        column.addView(sectionTitle("Ask Sarah"))
        val prompt = EditText(this).apply {
            hint = "What are we building?"
            minLines = 2
            maxLines = 5
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
        }
        column.addView(prompt)

        val answer = bodyText("Nothing from this box is stored by the launcher.").apply {
            setPadding(0, dp(8), 0, dp(8))
        }
        column.addView(answer)

        val askButton = actionButton("Send through Genesis") {
            val message = prompt.text.toString().trim()
            if (message.isBlank()) return@actionButton
            prompt.isEnabled = false
            answer.text = "Applying Gate 0 and UDS reflection…"
            sendToGenesis(message) { result, error ->
                prompt.isEnabled = true
                if (result != null) {
                    answer.text = buildString {
                        append(result.response)
                        append("\n\n")
                        append("Gate: ${result.gateDecision ?: "unknown"}")
                        append(" · Memory write: ${result.memoryWrite ?: "none"}")
                    }
                    prompt.text.clear()
                } else {
                    answer.text = error ?: "Genesis is unavailable."
                }
            }
        }
        column.addView(askButton)

        column.addView(sectionTitle("Today’s workspace"))
        val projectCount = localStore.projects().size
        column.addView(bodyText(
            "$projectCount local project${if (projectCount == 1) "" else "s"}. Project names stay on this device.",
        ))

        val shortcutRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }
        shortcutRow.addView(actionButton("Projects") { renderProjects() }, weightedButtonParams())
        shortcutRow.addView(actionButton("Open apps") { renderApps() }, weightedButtonParams())
        column.addView(shortcutRow)

        column.addView(sectionTitle("v0.1 boundary"))
        column.addView(bodyText(
            "No contacts, calendar, notifications, files, microphone, location, or background surveillance permissions are requested. Those become opt-in capabilities only when we deliberately add them.",
        ))

        setPage(column)
    }

    private fun renderSarah() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, dp(16), 0, 0)
        }

        root.addView(sectionTitle("Sarah AI · private shadow session"))
        root.addView(bodyText(
            "This session is ephemeral in the launcher. Requests are forced to private consent, shadow mode, and collective_learning=false.",
        ))

        val transcript = TextView(this).apply {
            textSize = 15f
            setTextColor(Color.rgb(30, 30, 30))
            setPadding(dp(12), dp(12), dp(12), dp(12))
            text = sarahTranscript()
        }

        val transcriptScroll = ScrollView(this).apply {
            addView(transcript)
        }
        root.addView(transcriptScroll, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1f,
        ))

        val input = EditText(this).apply {
            hint = "Message Sarah AI"
            maxLines = 4
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
        }
        root.addView(input)

        val sendButton = actionButton("Send") {
            val message = input.text.toString().trim()
            if (message.isBlank()) return@actionButton

            ephemeralSarahLog.add("You: $message")
            transcript.text = sarahTranscript("Sarah: Applying Gate 0…")
            input.text.clear()
            input.isEnabled = false

            sendToGenesis(message) { result, error ->
                input.isEnabled = true
                val reply = if (result != null) {
                    buildString {
                        append("Sarah: ")
                        append(result.response)
                        append("\n[Gate: ${result.gateDecision ?: "unknown"}; memory: ${result.memoryWrite ?: "none"}]")
                    }
                } else {
                    "Sarah: ${error ?: "Genesis is unavailable."}"
                }
                ephemeralSarahLog.add(reply)
                transcript.text = sarahTranscript()
                transcriptScroll.post { transcriptScroll.fullScroll(View.FOCUS_DOWN) }
                input.requestFocus()
            }
        }
        root.addView(sendButton)

        setPage(root)
    }

    private fun renderProjects() {
        val column = pageColumn()
        column.addView(sectionTitle("Projects"))
        column.addView(bodyText(
            "A tiny local workspace for the build-use-critique-modify loop. Long-press a project to remove it.",
        ))

        val input = EditText(this).apply {
            hint = "New project"
            isSingleLine = true
        }
        column.addView(input)
        column.addView(actionButton("Add project") {
            val added = localStore.addProject(input.text.toString())
            if (added) renderProjects() else toast("Give the project a new name.")
        })

        val projects = localStore.projects()
        if (projects.isEmpty()) {
            column.addView(bodyText("No projects yet. Add the first thing you want SynthSara to help you build."))
        } else {
            projects.forEach { project ->
                column.addView(actionButton(project) {
                    toast("$project is local in v0.1. Deeper project context comes next.")
                }.apply {
                    setOnLongClickListener {
                        localStore.removeProject(project)
                        renderProjects()
                        true
                    }
                })
            }
        }

        setPage(column)
    }

    private fun renderApps() {
        val column = pageColumn()
        column.addView(sectionTitle("Apps"))
        column.addView(bodyText("Android is still underneath. SynthSara simply becomes the place you launch from."))

        val progress = ProgressBar(this)
        column.addView(progress)
        setPage(column)

        executor.execute {
            val apps = launcherRepository.loadApps()
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                column.removeView(progress)

                val grid = GridLayout(this).apply {
                    columnCount = 3
                    alignmentMode = GridLayout.ALIGN_BOUNDS
                    useDefaultMargins = false
                }

                apps.forEach { app ->
                    val icon = app.icon?.mutate()?.apply {
                        setBounds(0, 0, dp(36), dp(36))
                    }
                    val button = Button(this).apply {
                        text = app.label
                        textSize = 11f
                        setAllCaps(false)
                        gravity = Gravity.CENTER
                        minHeight = dp(88)
                        setPadding(dp(6), dp(8), dp(6), dp(8))
                        if (icon != null) {
                            setCompoundDrawables(null, icon, null, null)
                            compoundDrawablePadding = dp(5)
                        }
                        setOnClickListener {
                            if (!launcherRepository.launch(app)) {
                                toast("Could not open ${app.label}.")
                            }
                        }
                    }

                    val params = GridLayout.LayoutParams().apply {
                        width = 0
                        height = ViewGroup.LayoutParams.WRAP_CONTENT
                        columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
                        setMargins(dp(3), dp(3), dp(3), dp(3))
                    }
                    grid.addView(button, params)
                }

                column.addView(grid)
            }
        }
    }

    private fun sendToGenesis(
        message: String,
        callback: (GenesisResult?, String?) -> Unit,
    ) {
        executor.execute {
            val attempt = runCatching { GenesisClient.send(message) }
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                callback(
                    attempt.getOrNull(),
                    attempt.exceptionOrNull()?.message,
                )
            }
        }
    }

    private fun openHomeSettings() {
        val primary = Intent(Settings.ACTION_HOME_SETTINGS)
        val fallback = Intent(Settings.ACTION_SETTINGS)
        runCatching { startActivity(primary) }
            .onFailure { runCatching { startActivity(fallback) } }
    }

    private fun sarahTranscript(pending: String? = null): String {
        val entries = ephemeralSarahLog.toMutableList()
        if (pending != null) entries.add(pending)
        return if (entries.isEmpty()) {
            "Sarah is ready. Nothing in this transcript is written to persistent launcher storage."
        } else {
            entries.joinToString("\n\n")
        }
    }

    private fun setPage(view: View) {
        content.removeAllViews()
        val page = if (view.tag == SCROLLABLE_PAGE_TAG) {
            ScrollView(this).apply { addView(view) }
        } else {
            view
        }
        content.addView(page, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        ))
    }

    private fun pageColumn(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(0, dp(16), 0, dp(24))
        tag = SCROLLABLE_PAGE_TAG
    }

    private fun sectionTitle(value: String) = TextView(this).apply {
        text = value
        textSize = 20f
        setTypeface(Typeface.DEFAULT, Typeface.BOLD)
        setTextColor(Color.rgb(24, 24, 24))
        setPadding(0, dp(16), 0, dp(6))
    }

    private fun bodyText(value: String) = TextView(this).apply {
        text = value
        textSize = 15f
        setTextColor(Color.rgb(55, 55, 55))
        setLineSpacing(0f, 1.15f)
    }

    private fun navButton(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        textSize = 13f
        setAllCaps(false)
        setOnClickListener { action() }
    }

    private fun actionButton(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        setAllCaps(false)
        setOnClickListener { action() }
    }

    private fun weightedButtonParams() = LinearLayout.LayoutParams(
        0,
        ViewGroup.LayoutParams.WRAP_CONTENT,
        1f,
    )

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val SCROLLABLE_PAGE_TAG = "synthsara-scrollable-page"
    }
}
