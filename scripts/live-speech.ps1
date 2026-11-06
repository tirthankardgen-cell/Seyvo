param([switch]$Play)
$ErrorActionPreference = 'Stop'
$seyvoSpeechFile = Join-Path (Split-Path $PSScriptRoot) '.tools\live-speech.wav'
if ($Play) {
    $seyvoPlayer = [System.Media.SoundPlayer]::new($seyvoSpeechFile)
    try { $seyvoPlayer.PlaySync() } finally { $seyvoPlayer.Dispose() }
} else {
    Add-Type -AssemblyName System.Speech
    $seyvoSpeech = [System.Speech.Synthesis.SpeechSynthesizer]::new()
    try {
        $seyvoAudio = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
        $seyvoSpeech.SetOutputToWaveFile($seyvoSpeechFile, $seyvoAudio)
        $seyvoPrompt = [System.Speech.Synthesis.PromptBuilder]::new()
        $seyvoPrompt.AppendBreak([TimeSpan]::FromSeconds(1))
        $seyvoPrompt.AppendText('The copper lighthouse stands beside a quiet blue river.')
        $seyvoPrompt.AppendBreak([TimeSpan]::FromSeconds(1))
        $seyvoSpeech.Speak($seyvoPrompt)
    } finally { $seyvoSpeech.Dispose() }
}
