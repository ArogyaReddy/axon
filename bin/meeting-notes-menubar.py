#!/Users/gadea/.claude/bin/.meeting-notes-venv/bin/python3
"""
meeting-notes-menubar -- macOS menu-bar toggle for meeting-notes.

Requires `rumps` (installed in bin/.meeting-notes-venv -- see
docs/guides/meeting-notes-setup.md). System Python is externally-managed
(Homebrew/PEP 668) and cannot install rumps directly, so this script must be
run via the venv's python, either by executing it directly (this shebang) or
with `~/.claude/bin/.meeting-notes-venv/bin/python3 meeting-notes-menubar.py`.
Deliberately thin: shells out to `bin/meeting-notes start|stop|status` for
everything, so there is exactly one implementation of the recording/transcribe/
summarize/email pipeline (shared with the CLI and the hotkey trigger).
"""
import subprocess
from pathlib import Path

import rumps

MEETING_NOTES = str(Path(__file__).resolve().parent / "meeting-notes")


class MeetingNotesApp(rumps.App):
    def __init__(self):
        super().__init__("\u25cf Meeting Notes", quit_button="Quit")
        self.menu = ["Start", "Stop", None, "Status"]
        self.timer = rumps.Timer(self.refresh_status, 10)
        self.timer.start()
        self.refresh_status(None)

    def _is_recording(self):
        result = subprocess.run([MEETING_NOTES, "status"], capture_output=True, text=True)
        return "Recording:" in result.stdout

    def refresh_status(self, _):
        self.title = "\U0001F534 Recording" if self._is_recording() else "\u25cf Meeting Notes"

    @rumps.clicked("Start")
    def start(self, _):
        window = rumps.Window("Meeting title:", "Start Meeting Notes", default_text="Meeting")
        response = window.run()
        meeting_title = response.text if response.clicked else "Meeting"
        subprocess.Popen([MEETING_NOTES, "start", "--title", meeting_title])
        rumps.notification("Meeting Notes", "Recording started", meeting_title)
        self.refresh_status(None)

    @rumps.clicked("Stop")
    def stop(self, _):
        subprocess.Popen([MEETING_NOTES, "stop"])
        rumps.notification("Meeting Notes", "Stopping\u2026", "Transcribing and summarizing \u2014 the markdown file will appear shortly.")
        self.refresh_status(None)

    @rumps.clicked("Status")
    def status(self, _):
        result = subprocess.run([MEETING_NOTES, "status"], capture_output=True, text=True)
        rumps.alert(result.stdout.strip() or "Not recording.")


if __name__ == "__main__":
    MeetingNotesApp().run()
