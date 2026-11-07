# Installed target acceptance: 0.1.7

Observed on 7 November 2026 on the existing Windows 11 x64 workstation at 150% scale. Native helper: `D:\Seyvo\resources\native\Seyvo.Native.exe`, SHA256 `88477c2fd6412fbaae8cace10347aff192e79935b09e66a81e7e7b7a4c98b9da`, from installed source `468d3f3c0e3f`.

| Target | Observed result |
| --- | --- |
| Microsoft Edge, isolated profile, local textarea | Exact Hindi/Bengali/emoji and two-line paste; prior clipboard restored. |
| Same Edge, contenteditable field | Exact same multiline paste; prior clipboard restored. |
| Browser duplicate tokens, password, read-only field, button, changed field and moved caret | Seven expected refusals; protected/different fields stayed unchanged. |
| Microsoft Word, separate `/x /a /q` instance, owned RTF in Compatibility Mode | Exact multiline multilingual suffix; original clipboard restored. Closed without saving. |
| Visual Studio Code, separate profile and extensions directory, extensions disabled, accessibility support on, owned text file | Exact multiline multilingual prefix at the initial caret; original clipboard restored. No input entered the separate chat composer. Owned instance closed. |
| Windows Notepad, owned document | Earlier 0.1.7 multiline Hindi/emoji paste passed, with CR/LF representation normalized during comparison. Direct Unicode remains deliberately refused. |

The new browser/Word/VS Code run adds 11 successful expected outcomes. The VS Code harness initially assumed it had moved the caret to the end, but that editor exposed no usable TextPattern range selection. Its first comparison failed. A bounded follow-up comparison confirmed the complete fixture was inserted once at the start with the original content preserved after it. No product guard or insertion method was changed to make the check pass.

All inputs were synthetic and all target windows belonged to the acceptance runner. Native requests used the installed helper, with independent process/foreground/field checks. The test never sent Enter or submitted a chat message. Reports contain booleans, lengths, versions and coarse errors; comparisons withheld actual clipboard/field values on failure. These are insertion tests, separate from the human microphone and Google tests in [Windows QA](../tests/manual-windows-qa.md).

The installed 0.1.4 observations for the logged-out ChatGPT composer and classic PowerShell console remain [historical evidence](target-acceptance-0.1.4.md). They do not establish 0.1.7 clipboard compatibility in every chat/terminal. Teams, Slack, authenticated chat variants, remote/elevated/protected applications, additional editor configurations and clean-machine/physical display/accessibility coverage remain unaccepted.
